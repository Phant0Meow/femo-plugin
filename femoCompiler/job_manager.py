# femoCompiler/job_manager.py
"""
job_manager.py — Job 状态机与状态文件（运行状态链路重构，施工清单 v3 §4.1）。
==================================================================

职责四样（架构提案 v2 §二"引擎拥有"）：
1. Job 状态机 + 状态文件：每个 Job（一次运行）一份
   `<user_data>/runs/<job_id>.json`，temp+rename 原子写（C5 死于结构）；
2. 启动对账 reconcile：扫目录，state==running 而无执行体 → suspended(reason=crash)；
3. 命令裁决：create_job 活跃排他（B4）+ resume 六关（§八.18）；
4. 断点编解码：复用 vars/checkpoint.py 的 dump/restore 产物（本文件只存取，
   不重复造）。

依赖方向（试金石=直连模式）：只 import 标准库 + get_dir.get_user_dir +
db_utils.session_exists（六关第⑤关用，只读）。**不 import FEMO_runtime**——
构造 Runner、起 worker 线程全留在 bridge（bridge 是"接入陌生 agent 框架的
翻译模块"雏形，猫猫 2026-09-05 纲领原话）。收益：JobManager 可脱离引擎
单测，对账/裁决/并发落盘测试不需要拉起真 Runner。

状态机（提案 §3.4）：
  （不存在）--job_start--> running --flow_done--> finished
                                |--job_pause----> suspended(user_pause)
                                |--取消路径-----> suspended(user_pause|cancelled)
                                |--FEMORunPaused-> suspended(node_pause)
                                |--节点异常-----> suspended(node_pause)
                                  （2026-10-01 用户拍板：一切 error 挂起可续，
                                   续否/改稿重跑都是用户的事；failed 仅存于
                                   构造期崩溃——无断点可续的场）
  （启动时）running 且无执行体 --> suspended(crash)
  suspended --job_resume(六关)--> running

写码纪律（猫猫 2026-09-04）：def 归属想清楚——新逻辑全部进本文件，
FEMO_runtime/vars 六件套只动清单列明的旁挂点与两课。
"""

import hashlib
import json
import os
import re
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional

from femoBridges.getDir.get_dir import get_user_dir, get_data_dir


def _os_replace_retry(src: str, dst: str, attempts: int = 4) -> None:
    """os.replace 带 Windows 共享冲突小重试（2026-09-16 真运行 1609 场实锤加固）。

    原子替换的目标文件恰好被并发读者打开时（3081 网页轮询任务清单/会话状态、
    杀毒软件扫刚写的临时文件），Windows 报 PermissionError([Errno 13]/WinError 5)
    ——瞬时态，占用几十毫秒内消失。按 0.05s/0.1s/0.2s 退避重试（合计 ~0.35s），
    仍败才原样抛出：主档案路径由调用方的节点失败挂起存档兜底，侧写路径本就
    静默降级。POSIX 上首试即成功，语义不变。"""
    for attempt in range(attempts):
        try:
            os.replace(src, dst)
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(0.05 * (2 ** attempt))


# ── 状态机常量 ────────────────────────────────────────────────────────────

STATE_RUNNING = 'running'
STATE_SUSPENDED = 'suspended'
STATE_FINISHED = 'finished'
STATE_FAILED = 'failed'

# suspended 的原因（crash 只来自对账；user_pause 来自 pause/取消；node_pause 来自直连 AI 失败挂起）
REASON_USER_PAUSE = 'user_pause'
REASON_CRASH = 'crash'
REASON_NODE_PAUSE = 'node_pause'

# finalize 只接受这两种终态（幂等闸门内的合法性校验）
_FINAL_STATES = (STATE_FINISHED, STATE_FAILED)


def fingerprint_script(text: str) -> str:
    """脚本文本指纹：CRLF→LF 归一 + sha256，形如 "sha256:<hex>"。

    镜像宿主旧 state-files.scriptFingerprint 语义（JS: text.replace(/\\r\\n/g,'\\n')
    + sha256(hex)），便于对账调试；引擎自洽使用，不依赖宿主。
    指纹裁决归引擎 job_resume 第④关——宿主不再算指纹（单一职责）。"""
    normalized = (text or '').replace('\r\n', '\n')
    digest = hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    return f"sha256:{digest}"


# ── flow 域指纹（2026-09-06 用户拍板的宽松续跑语义）───────────────────────
#
# 断点由三部分组成（vars/checkpoint.py dump_state）：位置账本（node_id +
# 模块栈 + 循环合成节点）、per-task 变量世界、场次挂钩。其中**只有位置账本
# 强依赖流程图结构**——变量世界整包恢复（新脚本装配的世界被丢弃），action
# 的 prompt/in/out 改动由"从断点往后跑新定义"自然消化。故续跑可行性指纹
# = flow + mainflow 结构：
#   - 布局（sketch 注释）、台词、vars 增删、注释与空白 → 不触发重跑
#   - 流程节点/连线/分支结构变了 → 断点位置在新图里无处安放 → 必须重跑
# ⚠️ 已知边界（拍板接受）：恢复=整包替换，新增 vars 不会进入恢复后的世界，
# 续跑路径"先赋值再读"才安全；根治需恢复后补种新声明变量（另行立项）。

def _strip_flow_comment(line: str) -> str:
    """剥一行注释：首个 # 或 // 起整段丢弃（含 sketch 布局——节点拖动只改
    注释坐标，天然不入指纹）。flow 区无字符串字面量的常规形态下安全；
    引号内出现 #/// 的病理情形接受误伤（只影响指纹相等性，不影响执行）。"""
    cut = len(line)
    for mark in ('#', '//'):
        i = line.find(mark)
        if 0 <= i < cut:
            cut = i
    return line[:cut]


def _flow_scope_groups(region_lines: list) -> list:
    """区域行 → 规范化语句组：一行 + 其缩进更深的后续行（控制块体）为一组，
    组内去全部空白，组间排序——声明/书写顺序不参与指纹（画布重排不触发重跑，
    for/fork 体与自己的头绑定不散架）。"""
    groups: list = []
    cur_indent = None
    for raw in region_lines:
        if not raw.strip():
            continue
        indent = len(raw) - len(raw.lstrip())
        if cur_indent is None or indent <= cur_indent:
            cur_indent = indent
            groups.append([raw])
        else:
            groups[-1].append(raw)
    out = []
    for lines in groups:
        body = ''.join(''.join(l.split()) for l in lines)
        if body:
            out.append(body)
    out.sort()
    return out


def extract_flow_scope(text: str) -> str:
    """提取FEMO脚本的 flow/mainflow 区域并规范化（check_fingerprint 的比对域）：
    1) 顶层切出 mainflow: 块与各 module 的 flow: 子块；
    2) 每行剥 # 与 // 注释；3) 去除全部空白；4) 语句组排序后拼接。
    返回规范化串（空串=两份文本都无 flow 区，视为相等由调用方裁决）。"""
    if not text:
        return ''
    lines = [_strip_flow_comment(l) for l in text.replace('\r\n', '\n').split('\n')]
    # 顶层块边界：非注释后仍非空、且零缩进的行开一块
    tops = [i for i, l in enumerate(lines) if l.strip() and not l[0].isspace()]
    regions: list = []
    for k, start in enumerate(tops):
        end = tops[k + 1] if k + 1 < len(tops) else len(lines)
        header = lines[start].strip()
        if header == 'mainflow:':
            regions.append(lines[start + 1:end])
            continue
        if re.match(r'^module\s+.+:$', header):
            block = lines[start + 1:end]
            for j, l in enumerate(block):
                if l.strip() != 'flow:':
                    continue
                flow_indent = len(l) - len(l.lstrip())
                sub_end = len(block)
                for j2 in range(j + 1, len(block)):
                    l2 = block[j2]
                    if not l2.strip():
                        continue
                    if len(l2) - len(l2.lstrip()) <= flow_indent:
                        sub_end = j2
                        break
                regions.append(block[j + 1:sub_end])
                break
    parts: list = []
    for r in regions:
        parts.extend(_flow_scope_groups(r))
    parts.sort()
    return '\x00'.join(parts)


# ━━━ 已退役·观察期（2026-09-26 起）━━━ flow_scope_hash：全仓零引用（双窗口交叉扫描+逐项复核）。
# 续跑指纹的现行正身是 fingerprint_script（门面在导出、resume_job 第④关在用），
# 这是被取代的旧指纹口径。无报错数日后整段删除（含本注）。
# def flow_scope_hash(text: str) -> str:
#     """flow 域指纹：extract_flow_scope 规范化串的 sha256。"""
#     return hashlib.sha256(extract_flow_scope(text).encode('utf-8')).hexdigest()
# ━━━ 观察期退役段结束：flow_scope_hash ━━━


# ── Job 档案 ──────────────────────────────────────────────────────────────

@dataclass
class JobRecord:
    """一个 Job 的完整档案（提案 §3.1 字段全表）。job_id 与场次号两套编号
    各数各的（场次=书，Job=阅读）。"""
    job_id: int
    state: str = STATE_RUNNING
    reason: str = ''                      # suspended 的原因：user_pause / crash / node_pause
    waiting_human: bool = False           # running 的子标记（human_wait 置 / human_done 清 / 挂起清）
    script_fingerprint: str = ''
    script_name: str = ''                 # 诊断可读（list_jobs/日志里人能看懂）
    script_path: str = ''                 # 开跑时宿主给的脚本文件地址（未保存=''/缺省）
    script_text: str = ''                 # 开跑那一刻的脚本原文快照（运行快照，resume 六关保证不漂移）
    host_ref: str = ''                   # 宿主塞的不透明标签（如其会话标识），透传存档，引擎不懂
    # 多宿主归属账（2026-09-21 账本多宿主化）：{host名: 会话标识}，一格一宿主
    # 互不覆盖（联机共演一次=多格并存）；引擎依旧不透明透传，只存取/合并。
    host_refs: Dict[str, str] = field(default_factory=dict)
    femo_session_id: Optional[int] = None  # 挂靠场次（on_flow_start 回填；resume 裁决用）
    checkpoints: Dict[str, str] = field(default_factory=dict)        # {task_id: node_id}
    checkpoint_labels: Dict[str, str] = field(default_factory=dict)  # {task_id: label}（D1）
    # 交付游标（2026-09-28 漏台词定案）：{soul_id: turn}，增量上下文窗口基线。
    # 只活在 ContextExample 内存会随进程重启丢——丢了回落「自己最近发言 turn」
    # （收卷一拍后=收卷号），续跑吞掉「收到节点提醒→说完落账」之间别人的发言。
    # 随 checkpoint 落盘（merge_checkpoint），续跑经 build_resume_state 回填。
    delivery_cursors: Dict[str, int] = field(default_factory=dict)
    vars_state: Optional[Dict[str, Any]] = None   # dump_state 整包（编解码走 vars/checkpoint.py）
    error: str = ''                       # failed 摘要（诊断）
    created_at: str = ''
    updated_at: str = ''

    def to_dict(self) -> Dict[str, Any]:
        return {
            'job_id': self.job_id,
            'state': self.state,
            'reason': self.reason,
            'waiting_human': self.waiting_human,
            'script_fingerprint': self.script_fingerprint,
            'script_name': self.script_name,
            'script_path': self.script_path,
            'script_text': self.script_text,
            'host_ref': self.host_ref,
            'host_refs': dict(self.host_refs),
            'femo_session_id': self.femo_session_id,
            'checkpoints': dict(self.checkpoints),
            'checkpoint_labels': dict(self.checkpoint_labels),
            'delivery_cursors': dict(self.delivery_cursors),
            'vars_state': self.vars_state,
            'error': self.error,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'JobRecord':
        """缺键容忍默认、未知键忽略（前向兼容写入）。"""
        if not isinstance(data, dict):
            raise ValueError(f"JobRecord.from_dict 需要 dict，得到 {type(data).__name__}")
        return cls(
            job_id=int(data.get('job_id', 0)),
            state=str(data.get('state', STATE_RUNNING)),
            reason=str(data.get('reason', '')),
            waiting_human=bool(data.get('waiting_human', False)),
            script_fingerprint=str(data.get('script_fingerprint', '')),
            script_name=str(data.get('script_name', '')),
            script_path=str(data.get('script_path', '')),
            script_text=str(data.get('script_text', '')),
            # 旧档案键 owner_tag 兼容读（改名前的存档文件）
            host_ref=str(data.get('host_ref', data.get('owner_tag', ''))),
            # 多宿主归属账缺键容忍（旧档案自然缺省空字典）
            host_refs={str(k): str(v) for k, v in dict(data.get('host_refs') or {}).items()},
            femo_session_id=data.get('femo_session_id'),
            checkpoints=dict(data.get('checkpoints') or {}),
            checkpoint_labels=dict(data.get('checkpoint_labels') or {}),
            delivery_cursors={
                str(k): int(v) for k, v in dict(data.get('delivery_cursors') or {}).items()
                if isinstance(v, (int, float))
            },
            vars_state=data.get('vars_state'),
            error=str(data.get('error', '')),
            created_at=str(data.get('created_at', '')),
            updated_at=str(data.get('updated_at', '')),
        )


class JobError(Exception):
    """结构化错误：.code 给宿主分发，.detail 是人话（命令-结果契约，B5 死于结构）。"""

    def __init__(self, code: str, detail: str = ''):
        self.code = code
        self.detail = detail or code
        super().__init__(f"[{code}] {self.detail}")


class JobBusyError(JobError):
    """活跃排他失败（B4"Job 创建即占位"）：另带活跃 Job 归属，供宿主信息化文案。"""

    def __init__(self, active_job_id: int, active_host_ref: str = ''):
        self.active_job_id = active_job_id
        self.active_host_ref = active_host_ref
        super().__init__(
            'another_job_active',
            f'Job {active_job_id}（宿主标签 {active_host_ref or "?"}）活跃中，'
            f'可先暂停或等它挂起')


def _now_iso() -> str:
    return datetime.now().isoformat(timespec='seconds')


# ── JobManager ────────────────────────────────────────────────────────────

class JobManager:
    """Job 状态机唯一权威（每引擎进程一个；bridge main() 装配）。

    落盘线程模型（§八.19）：同一 Job 的全部落盘（checkpoint 落盘 + finalize）
    都在 worker 单线程，天然串行无并发写；进程内锁保留为防御性
    （防未来异步化落盘），§12.2.8 用 8 线程并发 _save 验证它保序。
    """

    def __init__(self, runs_dir: Optional[str] = None):
        if runs_dir is None:
            runs_dir = os.path.join(get_data_dir(), 'jobs', 'runs')
        self.runs_dir = runs_dir
        os.makedirs(self.runs_dir, exist_ok=True)
        # §八.2 防御锁：同 Job 落盘串行化（世界单调推进，后写自然含先写）
        self._lock = threading.RLock()
        # 挂靠登记 job_id → 活跃 FEMORunner 实例（duck 访问：.stop() /
        # .engine.human_input；本文件不 import FEMO_runtime）
        self._bound: Dict[int, Any] = {}

    # ── 路径与读写 ──

    def _job_path(self, job_id: int) -> str:
        return os.path.join(self.runs_dir, f'{job_id}.json')

    def _meta_path(self, job_id: int) -> str:
        """元数据侧写地址（.meta 结尾，刻意不带 .json——allocate/list_jobs 的
        主档扫描都按 '.json'+纯数字词干过滤，侧写天然不进主档名单）。"""
        return os.path.join(self.runs_dir, f'{job_id}.meta')

    def _load(self, job_id: int) -> Optional[JobRecord]:
        """读单份档案。文件缺失 → None；JSON 损坏 → rename 留证（.corrupt-<ts>）
        + stderr 大声报错 → None（对账判定就靠这文件，坏档不能静默当存在）。
        【读侧共享冲突小重试（2026-10-07，j2717 人类信被咬实案，用户拍板）】
        写侧 os.replace 自 09-16 就有同款装甲（_os_replace_retry：并发读者/
        杀毒扫刚写的文件），读侧一直没有——出站轮询投递的第一步就是本方法，
        撞上「场册刚被检查点重写、正被杀软/索引器扫」的瞬时窗口时
        PermissionError 直接上抛，用户的话当场蒸发。按写方同款退避
        （0.05/0.1/0.2s）重试；仍败原样抛出。FileNotFoundError 等非瞬时错误
        不进重试，语义不变。"""
        path = self._job_path(job_id)
        raw = None
        for attempt in range(4):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    raw = f.read()
                break
            except FileNotFoundError:
                return None
            except PermissionError:
                if attempt == 3:
                    raise
                time.sleep(0.05 * (2 ** attempt))
        try:
            return JobRecord.from_dict(json.loads(raw))
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            stamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            quarantined = f'{path}.corrupt-{stamp}'
            try:
                os.rename(path, quarantined)
                sys.stderr.write(
                    f'[job_manager] ⚠️ Job 档案损坏，原档已隔离留证: {quarantined}（{exc}）\n')
            except OSError as rename_exc:
                sys.stderr.write(
                    f'[job_manager] ⚠️ Job 档案损坏且隔离失败: {exc} / {rename_exc}\n')
            return None

    def _save(self, rec: JobRecord) -> None:
        """原子落盘：temp 同目录（.<id>.tmp-<pid>）→ os.replace 原子替换（C5）。
        RLock 内（同 Job 串行化，保序防旧快照覆盖新快照）；updated_at 刷新。
        主档落盘后同步写 <id>.meta 元数据侧写（list_jobs 加速档，~200B）——
        list_jobs 优先读它，不再全量 json.loads 主档案（script_text/checkpoints/
        vars_state 都可能很大）。侧写与主档非联合原子：断电窗口内可能落后一拍，
        下次 _save 自愈；缺失/损坏由读侧回落全量 _load 兜底，绝不阻塞读。"""
        with self._lock:
            rec.updated_at = _now_iso()
            path = self._job_path(rec.job_id)
            tmp = os.path.join(self.runs_dir, f'.{rec.job_id}.tmp-{os.getpid()}')
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(rec.to_dict(), f, ensure_ascii=False, default=str)
            # 同目录 replace：Windows/POSIX 上都是原子替换——断电瞬间要么旧
            # 文件要么新文件，绝无半截 JSON（C5 死于结构的结构修复）。
            # Windows 共享冲突小重试（并发读者开着目标文件的瞬时态）。
            _os_replace_retry(tmp, path)
            # 元数据侧写：写失败不影响主档（读侧回落全量 _load），只大声留痕。
            meta_tmp = os.path.join(self.runs_dir, f'.{rec.job_id}.meta-{os.getpid()}')
            try:
                with open(meta_tmp, 'w', encoding='utf-8') as f:
                    json.dump(self._meta_fields(rec), f, ensure_ascii=False, default=str)
                _os_replace_retry(meta_tmp, self._meta_path(rec.job_id))
            except OSError as exc:
                sys.stderr.write(
                    f'[job_manager] ⚠️ Job 元数据侧写失败（list_jobs 将回落全量读取）: {exc}\n')

    def allocate_job_id(self) -> int:
        """扫目录现有 job_id 取 max+1。无独立计数文件——文件在编号就在，
        断电不丢号。"""
        best = 0
        try:
            names = os.listdir(self.runs_dir)
        except OSError:
            names = []
        for name in names:
            if name.endswith('.json') and name[:1].isdigit():
                stem = name[:-len('.json')]
                if stem.isdigit():
                    best = max(best, int(stem))
        return best + 1

    # ── 懒对账（2026-09-07 214 事故改造：启动扫全目录 → 摸到才对账）────────
    #
    # 旧 reconcile() 在 bridge 启动时无条件扫 runs/ 全目录，把所有 running
    # 档案按"不在我内存里=主人死了"判 crash。判定依据是【本进程】的 _bound，
    # 而档案是磁盘上多进程共享资源——pytest/第二个宿主的 bridge 一启动，
    # 就会把活着进程的 Job 误杀成 crash（214 实锤：引擎僵死挂着 runner，
    # 测试 bridge 启动对账把它写成 crash，之后每次暂停都落进幂等空转）。
    # 改为懒对账：只对【本宿主 session 路由会摸到的那个 job】、在【被摸到的
    # 时刻】裁决；_bound 主人检查永远先行（我是主人=它活着，哪怕循环僵死
    # 也轮不到对账判死）。

    # 触摸式对账的新鲜度下限：档案 updated_at 距今不足该秒数不动手——
    # 防 create_job 落盘后、worker attach 前的窗口被并发的状态查询误判
    # （镜像 prearm 已在宿主侧挡住正常路径，此为纵深保险）。
    RECONCILE_MIN_AGE_SECONDS = 60.0

    def reconcile_stale(self, job_id: int) -> Optional[dict]:
        """单档案懒对账：running 且无挂靠执行体 → suspended(reason=crash)。
        返回对账后的档案 dict（动了才返回，None=没动）。
        三道闸门（顺序即安全序）：
        ① `_bound` 主人检查——本进程挂着执行体=它活着（哪怕引擎循环僵死），
           绝不动手；
        ② 非 running 档案不碰（幂等：suspended/finished/failed 原样）；
        ③ updated_at 距今不足 RECONCILE_MIN_AGE_SECONDS 不碰（新鲜度保险，
           见上注释）。"""
        with self._lock:
            if job_id in self._bound:
                return None                  # ① 我是主人：它活着，不判死
            rec = self._load(job_id)
            if rec is None or rec.state != STATE_RUNNING:
                return None                  # ② 非 running：没的可对
            try:
                age = (datetime.now() - datetime.fromisoformat(rec.updated_at)).total_seconds()
            except (ValueError, TypeError):
                age = self.RECONCILE_MIN_AGE_SECONDS  # 时间戳坏档：按够旧处理
            if age < self.RECONCILE_MIN_AGE_SECONDS:
                return None                  # ③ 新鲜档案：可能正在 attach，不动手
            rec.state = STATE_SUSPENDED
            rec.reason = REASON_CRASH
            rec.waiting_human = False
            self._save(rec)
            sys.stderr.write(
                f'[job_manager] ⚠️ 懒对账：Job {job_id} 档案 running 但无挂靠执行体'
                f'（updated_at={rec.updated_at}，距今 {age:.0f}s）→ 判 crash 挂起\n')
            return rec.to_dict()

    # ── 命令裁决 ──

    def create_job(self, fingerprint: str, host_ref: str = '',
                   script_name: str = '', script_path: str = '',
                   script_text: str = '',
                   host_refs: Optional[Dict[str, str]] = None) -> JobRecord:
        """开新 Job。活跃排他裁决（B4）：_bound 非空 → JobBusyError（带归属）。
        → allocate → 建 running 档 → 落盘 → 返回。
        script_path/script_text = 开跑那一刻的脚本快照（文本+地址，有啥存啥）：
        resume 六关的 fingerprint_mismatch 保证可续跑 Job 的文本不漂移，
        故只需在 create 时存一次。
        host_refs = 多宿主归属账开局入账（账本多宿主化 §3.3）；host_ref 单值
        保留「最新发起方」语义不动，兼容旧宿主/内嵌直调。"""
        with self._lock:
            if self._bound:
                active = self.active_job()
                active_id = active.job_id if active is not None else -1
                active_tag = active.host_ref if active is not None else ''
                raise JobBusyError(active_id, active_tag)
            # 【跨进程抢号防线（2026-09-24 多实例并存）】allocate 的 max+1 只在
            # 单进程内安全——两个引擎进程同瞬间启动运行会同号互覆。档案文件本身当
            # 锁：独占创建（'x' 模式）写入完整档案，撞号（隔壁桥进程抢先落档）
            # 跳号重试；重试天然收敛（目录 max 随每次落档单调涨）。
            rec = None
            for _ in range(1000):
                rec = JobRecord(
                    job_id=self.allocate_job_id(),
                    state=STATE_RUNNING,
                    script_fingerprint=fingerprint,
                    script_name=script_name,
                    script_path=script_path,
                    script_text=script_text,
                    host_ref=host_ref,
                    host_refs={str(k): str(v) for k, v in dict(host_refs or {}).items()},
                    created_at=_now_iso(),
                )
                try:
                    with open(self._job_path(rec.job_id), 'x', encoding='utf-8') as f:
                        json.dump(rec.to_dict(), f, ensure_ascii=False, default=str)
                    break
                except FileExistsError:
                    continue
                except OSError:
                    raise
            else:
                raise JobError('job_id_exhausted', '启动运行失败：连续 1000 次 Job 号撞号（runs 目录异常？）')
            self._save(rec)
            return rec

    def resume_job(self, job_id: int, fingerprint: str,
                   host_ref: str = '', new_text: str = '',
                   host_refs: Optional[Dict[str, str]] = None) -> JobRecord:
        """续跑六关裁决（§八.18 顺序），任一关失败 raise JobError(code, 人话)。
        全过 → 返回 rec（state 置 running 由调用方在 Runner 构造成功后经
        mark_running 确认——裁决通过到构造成功之间文件仍是 suspended，
        构造失败 worker except 收口 failed，不停僵尸 running）。
        new_text：本次续跑提交的脚本文本（flow 域比对用，见第④关）。"""
        with self._lock:
            # ① no_such_job：文件不存在
            rec = self._load(job_id)
            if rec is None:
                raise JobError('no_such_job', f'Job {job_id} 不存在（无该运行的档案文件）')
            # ② already_running：running 态（_bound 有挂靠=真活跃；无挂靠=
            #   对账漏网，防御同样拒）
            if rec.state == STATE_RUNNING:
                raise JobError('already_running', f'Job {job_id} 正在运行中，不能续跑')
            # ③ not_resumable：finished / failed（终态不可续，断点字段已作废）
            if rec.state in _FINAL_STATES:
                raise JobError('not_resumable',
                               f'Job {job_id} 已{"完整跑完" if rec.state == STATE_FINISHED else "以失败收场"}'
                               f'（{rec.state}），不能再续跑；请 fresh_start')
            # （state 应为 suspended；其余未知状态按 not_resumable 处理）
            if rec.state != STATE_SUSPENDED:
                raise JobError('not_resumable',
                               f'Job {job_id} 状态为 {rec.state!r}，不可续跑')
            # ④ fingerprint_mismatch：断点可行性=流程图结构（flow/mainflow）。
            #   【2026-09-06 宽松化，用户拍板】vars 增删（runtime 补种新声明）、
            #   台词/prompt、布局（sketch 注释）、注释与空白改动不再触发重跑；
            #   只有流程结构变了，断点位置在新图里才真的无处安放。
            #   新档案（有 script_text 快照）走 flow 域比对；旧档案回退整文指纹。
            if rec.script_text:
                if extract_flow_scope(rec.script_text) != extract_flow_scope(new_text or ''):
                    raise JobError('fingerprint_mismatch',
                                   f'Job {job_id} 的断点所属的流程图（flow/mainflow）'
                                   f'与提交版本不一致。流程结构变了断点无处安放'
                                   f'——请 fresh_start 从头跑')
            elif rec.script_fingerprint and rec.script_fingerprint != fingerprint:
                raise JobError('fingerprint_mismatch',
                               f'Job {job_id} 的断点属于另一个版本的脚本（指纹不符）。'
                               f'改了FEMO脚本就是新戏——请 fresh_start 从头跑，或先恢复原脚本文本')
            # ⑤ session_missing：挂靠场次不存在=拒绝失忆续跑（现状
            #   FEMO_runtime resume 分支同语义平移；None=无场次可校验则跳过）
            if rec.femo_session_id is not None:
                from femoCompiler.db_utils import session_exists
                if not session_exists(int(rec.femo_session_id)):
                    raise JobError('session_missing',
                                   f'Job {job_id} 的断点指向的场次 {rec.femo_session_id} 不存在'
                                   f'（运行台账可能已被清空），拒绝失忆续跑；请 fresh_start')
            # ⑥ no_breakpoint：文件在但断点为空（防御关）
            if not rec.checkpoints:
                raise JobError('no_breakpoint',
                               f'Job {job_id} 没有可续跑的断点（档案存在但执行位置为空）')
            # 全过：host_ref 更新为本次续跑发起方（透传存档）
            rec.host_ref = host_ref or rec.host_ref
            # 多宿主归属账合并（2026-09-21 账本多宿主化）：只更新发起方自己
            # 的格子，绝不碰别家格（联机共演=多格并存；消灭旧单值「后写顶掉
            # 先写」的覆盖病灶）。
            if host_refs:
                rec.host_refs.update({str(k): str(v) for k, v in host_refs.items()})
            self._save(rec)
            return rec

    def attach_host_refs(self, job_id: int, refs: Optional[Dict[str, str]]) -> Dict[str, str]:
        """中途挂账（联机中途进场，2026-09-21 账本多宿主化 §3.3）：把 refs
        合并进 host_refs（同 host 重发覆盖=幂等），不动状态机/断点/其他字段。
        running 态 resume 会被六关第②关 already_running 拦死——本命令是第二台
        宿主中途进场的唯一入口。返回合并后的完整 host_refs。"""
        with self._lock:
            rec = self._load(job_id)
            if rec is None:
                raise JobError('no_such_job', f'Job {job_id} 不存在（无该运行的档案文件）')
            clean = {str(k).strip(): str(v) for k, v in dict(refs or {}).items()
                     if str(k).strip() and str(v)}
            if clean:
                rec.host_refs.update(clean)
                self._save(rec)
            return dict(rec.host_refs)

    # ━━━ 已退役·观察期（2026-09-26 起）━━━ check_fingerprint：全仓零调用（双窗口交叉扫描+逐项复核）。
    # 自述"诊断/宿主查询用"，但门面与各宿主都没接它；同一套判定活在 resume_job 第④关里。
    # 无报错数日后整段删除（含本注）。
    # def check_fingerprint(self, job_id: int, new_text: str) -> dict:
    #     """续跑可行性指纹校验（不 raise——诊断/宿主查询用，裁决仍在
    #     resume_job 第④关，同一套判定）。
    #     - mode='flow'：新档案有快照文本 → flow/mainflow 结构比对（宽松语义：
    #       vars 增删/台词/布局/注释不触发，流程结构变才触发）；
    #     - mode='raw'：旧档案只有整文指纹 → 整文 sha256 比对；
    #     - mode='no_such_job' / 'none'：档案缺失/无指纹可校验。"""
    #     rec = self._load(job_id)
    #     if rec is None:
    #         return {'match': False, 'mode': 'no_such_job',
    #                 'detail': f'Job {job_id} 不存在'}
    #     if rec.script_text:
    #         return {'match': extract_flow_scope(rec.script_text) == extract_flow_scope(new_text or ''),
    #                 'mode': 'flow', 'detail': 'flow/mainflow 结构比对（宽松语义）'}
    #     if rec.script_fingerprint:
    #         return {'match': rec.script_fingerprint == fingerprint_script(new_text or ''),
    #                 'mode': 'raw', 'detail': '整文 sha256 比对（旧档案回退）'}
    #     return {'match': False, 'mode': 'none', 'detail': '档案既无快照文本也无指纹'}
    # ━━━ 观察期退役段结束：check_fingerprint ━━━

    def mark_running(self, job_id: int) -> None:
        """resume 的 Runner 构造成功后调用：state=running, reason='' 落盘。"""
        rec = self._load(job_id)
        if rec is None:
            raise JobError('no_such_job', f'Job {job_id} 不存在，无法置 running')
        rec.state = STATE_RUNNING
        rec.reason = ''
        self._save(rec)

    def pause_job(self, job_id: int) -> dict:
        """暂停一个 Job（=挂起，断点保留可续跑；2026-09-12 stop→pause 全链路改名，原名 stop_job）。幂等。
        - running 且 _bound 有挂靠 → runner.stop()（flow_paused 照发、协程取消
          链启动）；**状态落盘不在这一步**——suspended 的落盘在 Runtime 取消
          路径的 on_state_change 回调（状态机变更单一来源=回调+finalize，
          防双写竞态）。
        - running 但无挂靠（B5 死过的窗口）→ 直接落盘 suspended(reason=user_pause)
          （诚实化：没有执行体就是挂起，不是成功）。
        - 非 running → {paused:True, state:<现态>} 幂等返回。"""
        with self._lock:
            rec = self._load(job_id)
            if rec is None:
                raise JobError('no_such_job', f'Job {job_id} 不存在，无法暂停')
            if rec.state == STATE_RUNNING:
                runner = self._bound.get(job_id)
                if runner is not None:
                    runner.stop()
                    return {'paused': True, 'state': rec.state}
                # running 但无执行体：诚实化（B5 死于结构）
                rec.state = STATE_SUSPENDED
                rec.reason = REASON_USER_PAUSE
                rec.waiting_human = False
                self._save(rec)
                return {'paused': True, 'state': rec.state}
            return {'paused': True, 'state': rec.state}

    def deliver_human_input(self, job_id: int, wait_key: str, body) -> dict:
        """人类/AI 回传投递。活跃+_bound 校验（B6/孤儿信投递侧防线：不盲投信箱）。
        不活跃/无挂靠 → {delivered:False, error:...}，不假成功（B5 死于结构）。"""
        rec = self._load(job_id)
        runner = self._bound.get(job_id)
        # 【2026-09-24 抢信验尸日志（用户令「先多加点 log」）】直接落盘、不走
        # stdout 管道——管道会吞行（✗ 失败行从未在 diag 出现过）。双桥同 inbox
        # 时凭 pid 区分是哪座桥在投喂、各自看到的世界（state/runner）是什么。
        try:
            import os as _os
            import time as _t
            with open(_os.path.join(_os.environ.get('FEMO_DATA_DIR') or _os.path.join(get_user_dir(), 'user_data'), 'debug-mailbox-poll.log'), 'a', encoding='utf-8') as _f:
                _f.write(f"{_t.strftime('%Y-%m-%d %H:%M:%S')} pid={_os.getpid()} "
                         f"deliver-enter job={job_id} ref={wait_key} "
                         f"state={getattr(rec, 'state', 'NO_REC')} "
                         f"runner={'bound' if runner is not None else 'NONE'} "
                         f"bound_n={len(self._bound)}\n")
        except Exception:
            pass
        if rec is None:
            print(f"[deliver] ✗ job={job_id} ref={wait_key} no_such_job")
            return {'delivered': False, 'error': 'no_such_job'}
        if rec.state != STATE_RUNNING or runner is None:
            # 【2026-09-23 观测】把「为什么投不进」一次说全：state 与 runner
            # 各是什么。此前这条失败只以返回值表达，调用方不读 → 静默丢信。
            print(f"[deliver] ✗ job={job_id} ref={wait_key} job_not_active "
                  f"(state={rec.state} / 期望={STATE_RUNNING}, "
                  f"runner={'已挂靠' if runner is not None else '未挂靠'})")
            return {'delivered': False, 'error': 'job_not_active'}
        runner.engine.human_input.provide_input(wait_key, body)
        print(f"[deliver] ✓ job={job_id} ref={wait_key} → 已塞进引擎信箱")
        return {'delivered': True}

    # ── 查询 ──

    def get_job_state(self, job_id: int) -> dict:
        """文件原文 to_dict；不存在 → {'error':'no_such_job'}。"""
        rec = self._load(job_id)
        if rec is None:
            return {'error': 'no_such_job'}
        return rec.to_dict()

    def _meta_fields(self, rec: JobRecord) -> dict:
        """list_jobs 行字段（元数据侧写内容）。与 list_jobs 返回行逐字段一致；
        has_breakpoint 派生自 checkpoints 非空。"""
        return {
            'job_id': rec.job_id,
            'state': rec.state,
            'reason': rec.reason,
            'waiting_human': rec.waiting_human,
            'femo_session_id': rec.femo_session_id,
            'host_ref': rec.host_ref,
            'host_refs': dict(rec.host_refs),
            'script_name': rec.script_name,
            'created_at': rec.created_at,
            'updated_at': rec.updated_at,
            'has_breakpoint': bool(rec.checkpoints),
        }

    def _load_meta_row(self, job_id: int) -> Optional[dict]:
        """list_jobs 单行：优先读 <id>.meta 侧写（~200B），缺失/损坏/job_id
        对不上（半截写入等）一律回落全量 _load 取元数据字段。回落成功时顺手
        补写侧写——存量老档案第一次被扫到即完成迁移，之后永远走快路径。
        补写失败静默（读路径不嗓噪，下次再试）。"""
        try:
            with open(self._meta_path(job_id), 'r', encoding='utf-8') as f:
                row = json.load(f)
        except (OSError, ValueError):
            row = None
        if isinstance(row, dict) and row.get('job_id') == job_id:
            row['has_breakpoint'] = bool(row.get('has_breakpoint'))
            return row
        rec = self._load(job_id)
        if rec is None:
            return None
        row = self._meta_fields(rec)
        try:
            meta_tmp = os.path.join(self.runs_dir, f'.{job_id}.meta-{os.getpid()}')
            with open(meta_tmp, 'w', encoding='utf-8') as f:
                json.dump(row, f, ensure_ascii=False, default=str)
            _os_replace_retry(meta_tmp, self._meta_path(job_id))
        except OSError:
            pass
        return row

    def list_jobs(self) -> list:
        """扫目录元数据行——优先读 <id>.meta 侧写，不全量 json.loads 主档案
        （script_text/checkpoints/vars_state 都可能很大；读侧写从根上免疫档案
        体积增长）。主档案仍是存在性权威：只认 '.json'+纯数字词干，侧写/隔离
        留证文件天然不在名单里。供 /jobs 路由与 femo-run list_jobs 消费
        （幽灵书签可达性，§八.14）。"""
        jobs = []
        try:
            names = os.listdir(self.runs_dir)
        except OSError:
            return jobs
        for name in sorted(names, key=lambda n: (len(n), n)):
            if not name.endswith('.json') or not name[:1].isdigit():
                continue
            stem = name[:-len('.json')]
            if not stem.isdigit():
                continue
            row = self._load_meta_row(int(stem))
            if row is None:
                continue
            jobs.append(row)
        return jobs

    # ── 挂靠登记族 ──

    def attach(self, job_id: int, runner: Any) -> None:
        """挂靠登记：拿到 Runner 就绪开跑的时刻。顺带调
        runner.engine.human_input.discard_all()——任何"就绪开跑"时刻信箱
        必须从零开始（清无主滞留信，同 Runner 生命周期内的保险，幂等零成本）。"""
        self._bound[job_id] = runner
        try:
            runner.engine.human_input.discard_all()
        except AttributeError:
            # 防御：测试假 runner 无 discard_all 时跳过（真实引擎必然有，步2 落地）
            pass

    def detach(self, job_id: int) -> None:
        self._bound.pop(job_id, None)

    def runner_of(self, job_id: int) -> Optional[Any]:
        return self._bound.get(job_id)

    def active_job(self) -> Optional[JobRecord]:
        """引擎活跃 Job（全引擎同时至多一个=_bound 至多一个挂靠）。"""
        if not self._bound:
            return None
        job_id = next(iter(self._bound))
        return self._load(job_id)

    # ── 状态机旁挂（bridge 事件入口，职责表 §7.5）──

    def observe_event(self, job_id: int, event_type: str, data: dict) -> None:
        """bridge per-job 事件包装的旁挂入口：
        checkpoint → merge_checkpoint；flow_done → finalize(finished)；
        human_wait/human_done → mark_waiting(True/False)；其余忽略
        （flow_paused 不在此落盘——suspended 单一来源=on_state_change 回调）。"""
        if event_type == 'checkpoint':
            self.merge_checkpoint(job_id, data if isinstance(data, dict) else {})
        elif event_type == 'flow_done':
            self.finalize(job_id, STATE_FINISHED)
        elif event_type == 'human_wait':
            self.mark_waiting(job_id, True)
        elif event_type == 'human_done':
            self.mark_waiting(job_id, False)
        # 其余事件不参与状态机（显示事件）

    def merge_checkpoint(self, job_id: int, payload: dict) -> None:
        """checkpoint 落盘（§八.17 防半失忆）：
        - checkpoints/checkpoint_labels 全量覆盖；
        - payload 带 'state' 才覆盖 vars_state（条件保留旧值——照搬现状
          宿主侧 checkpoint 分支防线：引擎去重后仅变量变化时携带，
          无条件覆盖会写出"只有位置没有变量"的残缺文件）；
        - 带 session_id 回填 femo_session_id；落盘。"""
        with self._lock:
            rec = self._load(job_id)
            if rec is None:
                # Job 文件不在（极端：档案被外部移走）——响亮不静默
                sys.stderr.write(f'[job_manager] ⚠️ checkpoint for missing job {job_id}\n')
                return
            cp = payload.get('checkpoints')
            if isinstance(cp, dict):
                rec.checkpoints = {str(k): str(v) for k, v in cp.items()}
            labels = payload.get('checkpoint_labels')
            if isinstance(labels, dict):
                rec.checkpoint_labels = {str(k): str(v) for k, v in labels.items()}
            dc = payload.get('delivery_cursors')
            if isinstance(dc, dict):
                rec.delivery_cursors = {str(k): int(v) for k, v in dc.items()
                                        if isinstance(v, (int, float))}
            if payload.get('state') is not None and isinstance(payload.get('state'), dict):
                rec.vars_state = payload['state']
            sid = payload.get('session_id')
            if isinstance(sid, int) and sid > 0:
                rec.femo_session_id = sid
            self._save(rec)

    def mark_waiting(self, job_id: int, waiting: bool) -> None:
        """waiting_human 子标记置/清 + 落盘（human_wait/human_done 走既有事件，
        Runtime 零新触点）。"""
        with self._lock:
            rec = self._load(job_id)
            if rec is None:
                return
            if rec.waiting_human == waiting:
                return
            rec.waiting_human = waiting
            self._save(rec)

    def mark_session(self, job_id: int, session_id: Optional[int]) -> None:
        """femo_session_id 回填（on_flow_start 落点）。"""
        if not isinstance(session_id, int) or session_id <= 0:
            return
        with self._lock:
            rec = self._load(job_id)
            if rec is None:
                return
            rec.femo_session_id = session_id
            self._save(rec)

    def suspend(self, job_id: int, reason: str, error: str = '') -> None:
        """挂起落盘（on_state_change('suspended', ...) 落点）：
        state=suspended, reason=..., waiting_human=False。error=挂起时的错误
        摘要（2026-10-01 起一切运行期 error 落 suspended——「为什么停」必须
        进档案，续跑界面与诊断都靠它；空串不覆写既有摘要）。"""
        with self._lock:
            rec = self._load(job_id)
            if rec is None:
                return
            rec.state = STATE_SUSPENDED
            rec.reason = reason
            rec.waiting_human = False
            rec.error = error or rec.error
            self._save(rec)

    def has_checkpoints(self, job_id: int) -> bool:
        """该场是否已拍过断点（walk 起步的判据——worker 收尾分流用：
        有断点的场异常落 suspended 可续，无断点的构造期崩溃保持 failed）。"""
        with self._lock:
            rec = self._load(job_id)
            return bool(rec and rec.checkpoints)

    def finalize(self, job_id: int, final_state: str, error: str = '') -> None:
        """幂等终态化：**仅 rec.state==running 时生效**（§八.10 三面收口的
        统一闸门——回调链已落 suspended/finished 则 no-op）；断点字段作废=
        checkpoints/labels 清空 + vars_state=None（文件保留，红线）；final_state
        合法性校验（只接受 finished/failed）。"""
        if final_state not in _FINAL_STATES:
            raise JobError('invalid_final_state',
                           f'finalize 只接受 finished/failed，得到 {final_state!r}')
        with self._lock:
            rec = self._load(job_id)
            if rec is None:
                return
            if rec.state != STATE_RUNNING:
                return                      # 已终态/已挂起：幂等 no-op
            rec.state = final_state
            rec.error = error or rec.error
            rec.waiting_human = False
            rec.checkpoints = {}
            rec.checkpoint_labels = {}
            rec.delivery_cursors = {}
            rec.vars_state = None
            self._save(rec)

    # ── 续跑载荷 ──

    def build_resume_state(self, rec: JobRecord) -> dict:
        """构造 FEMORunner 的 resume_state 载荷：{checkpoints, session_id,
        state: vars_state, delivery_cursors}。vars_state None 且 checkpoints
        非空 = 异常态（防御：raise JobError('job_file_inconsistent')，诚实
        不半失忆——半失忆续跑=位置在变量丢，比 fresh 更危险）。"""
        if rec.vars_state is None and rec.checkpoints:
            raise JobError('job_file_inconsistent',
                           f'Job {rec.job_id} 档案不一致：有断点位置但没有变量世界快照，'
                           f'拒绝半失忆续跑（请 fresh_start）')
        return {
            'checkpoints': dict(rec.checkpoints),
            **({'session_id': int(rec.femo_session_id)} if rec.femo_session_id is not None else {}),
            **({'state': rec.vars_state} if rec.vars_state is not None else {}),
            **({'delivery_cursors': dict(rec.delivery_cursors)} if rec.delivery_cursors else {}),
        }
