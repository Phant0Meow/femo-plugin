"""femo_api.py — Femo 引擎对宿主的唯一公开 API（Facade / 门面）。

2026-09-13 API 化改造：宿主桥（hostAdapter/dshAdapter/python/femo_bridge.py，
以及未来任何宿主的桥/内嵌宿主）只准 import 本文件，不再直接触碰引擎内部模块
（FEMO_parser / FEMO_runtime / job_manager / db_utils / FEMO_config /
host_manifest / protocol）。引擎内部重构只要保住本文件的签名与语义，
宿主零改动——这正是门面存在的目的。本文件现居 femo2host/（引擎→宿主边界层：
门面 API 与 CLI 工具集中于此，宿主只看这个文件夹）。

分组（宿主消费的全部引擎面，一条不缺）：
  ① 环境与生命周期  set_db_path / init_database / seed_default_data /
                    apply_host_manifest_file
  ② 同步编译        compile_script / fingerprint_script / soul_exists /
                    list_all_soul_ids
  ③ Job 状态机      get_job_manager（进程级单例）/ bound_job_ids /
                    JobError / JobBusyError（错误码契约：宿主按
                    {ok:false, error:<code>, detail:<人话>} 上浮）
  ④ 运行时执行体    create_runner（替代宿主直接构造 FEMORunner + 私有属性
                    注入——_human_input_event/_host_ai_backend/_context_mode
                    在这里收口为显式参数，引擎内部改名不再波及宿主）
  ⑤ 角色库          get_soul / list_souls / soul_exists / create_soul
                    （宿主零直读 SQLite——B4 红线）
  ⑥ 剧本发现        list_scripts
  ⑦ 零 token 干跑    debug_dry_run（CLI run 子命令的编程面——同一 argv 实现，
                    行为永不漂移；femo_debugger 消费的全是现成引擎接口，
                    它就是引擎能力，2026-09-13 二次补充收编）
  ⑧ 握手词汇        AI_REQUEST_BLOCK_KEYS（ai_request.blocks 料包键契约，
                    权威定义在 protocol.py，此处只读透出）

与 CLI 的关系：
  - 干跑已进本文件（debug_dry_run），但 dsh 宿主仍以一次性子进程跑 CLI
    （femo2host/femoToolcall/femo_debugger.py run）：干跑要能被 terminate
    不留僵尸、不与运行桥同进程（桥进程内禁用本函数——cmd_run/print_report
    的 print 会污染 NDJSON 事件流）。本函数面向内嵌宿主与测试进程内直用。
  - 台账直查（femo2host/femoToolcall/chronica.py）不进本文件：它是裸 sqlite3
    只读（WAL/immutable URI）+ 人读排版，不经任何引擎接口——展示层工具，
    不是引擎 API 消费者，谈不上"封装引擎接口"。

宿主必读的语义注意：
  - CompileResult.script 是引擎 Script 对象的**不透明句柄**：只许原样传回
    create_runner，禁止解引用（其字段词汇不属于宿主契约）。
  - create_runner 固定以 wait_key 信箱模式装配（等 wait_key 通道而非
    stdin）——这是 human_input / actor_failed 命令的前提，宿主协议假定恒开。
  - JobManager 每进程一个（排他裁决/落盘/对账的唯一权威）：同一桥进程同时
    只跑一个 Job（JobBusyError 带 active_job_id/active_host_ref）。
  - 本模块 import 时把递归上限提到 200_000：fork 循环回流每轮嵌套一层
    asyncio 任务（FEMO_runtime._run_fork），深层任务链的 Task.cancel() 是
    同步递归，默认 1000 栈深会在 stop 时 RecursionError。内嵌宿主直接用本
    API 即自动获得此兜底，无需自行设置。
"""

import json
import os
import sys
import threading
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

sys.setrecursionlimit(200_000)

from femoCompiler.FEMO_config import set_db_path as _set_db_path
from femoCompiler.FEMO_parser import parse_script as _parse_script
from femoCompiler.FEMO_runtime import FEMORunner
from femoCompiler.job_manager import (
    JobManager,
    JobError,
    JobBusyError,
    fingerprint_script as _fingerprint_script,
)
from femoCompiler.db_utils import (
    init_database as _init_database,
    ensure_default_data as _ensure_default_data,
    get_soul_by_id as _get_soul_by_id,
    list_souls as _list_souls,
    create_soul as _create_soul,
    check_soul_id_exists as _check_soul_id_exists,
    list_all_soul_ids as _list_all_soul_ids,
)
from femoCompiler import host_manifest as _host_manifest
from femoCompiler.protocol import BLOCK_KEYS as _BLOCK_KEYS

__all__ = [
    # ① 环境与生命周期
    'set_db_path', 'init_database', 'seed_default_data', 'apply_host_manifest_file',
    # ② 同步编译
    'CompileResult', 'compile_script', 'fingerprint_script', 'soul_exists', 'list_all_soul_ids',
    # ③ Job 状态机
    'get_job_manager', 'bound_job_ids', 'JobError', 'JobBusyError',
    # ④ 运行时执行体
    'create_runner',
    # ⑤ 角色库
    'get_soul', 'list_souls', 'soul_exists', 'create_soul',
    # ⑥ 剧本发现
    'list_scripts',
    # ⑦ 零 token 干跑
    'debug_dry_run',
    # ⑧ 握手词汇
    'AI_REQUEST_BLOCK_KEYS',
]


# ════════════════════════════════════════════════════════════════════════
#  ① 环境与生命周期
# ════════════════════════════════════════════════════════════════════════

def set_db_path(path: str) -> None:
    """台账库（Chronica.wor）指向独立文件（测试沙盒等用）；生产默认不受影响。
    必须在第一个库消费（含 seed_default_data / get_job_manager）之前调用。"""
    _set_db_path(path)


def init_database() -> None:
    """建表（幂等）。一般不必单独调——seed_default_data 内含。"""
    _init_database()


def seed_default_data() -> None:
    """补种 Femo 内置角色/用户（幂等）：ai_name 解析（get_soul）要能找到
    内置角色（Eve、littlecat……）。宿主在 job_start/job_resume 动手前调用；
    失败是否致命由宿主定（dsh 桥选择 stderr 记一笔继续跑）。"""
    _init_database()
    _ensure_default_data()


def apply_host_manifest_file(path: str) -> Tuple[Optional[List[str]], Optional[str]]:
    """应用宿主能力清单文件（harness 词汇：thinking 档位/默认用户等）。

    返回 (notes, error)：error 非 None = 清单未应用（引擎回落内置缺省词汇，
    notes 为 None）；成功时 notes 是应用说明（可能为空列表）。
    绝不因清单问题抛异常/炸宿主启动（A2.1 解耦承诺：缺失/损坏回落内置缺省，
    standalone 自圆满）。"""
    data, err = _host_manifest.load_manifest_file(path)
    if err is not None:
        return None, err
    try:
        return _host_manifest.apply_manifest(data), None
    except Exception as exc:   # 防御：清单内容病态也不许炸启动
        return None, f'清单应用失败：{exc}'


# ════════════════════════════════════════════════════════════════════════
#  ② 同步编译
# ════════════════════════════════════════════════════════════════════════

@dataclass
class CompileResult:
    """compile_script 的回执。script 是不透明句柄（只许传回 create_runner）。"""
    script: Any                      # 引擎 Script 对象（不透明句柄）
    warnings: List[Dict[str, Any]]   # 编译警告桶（编译放行但作者应知情，2026-09-07）
    action_count: int                # 顶层动作数（check 命令的 actions 字段）


def _make_soul_checker() -> Callable[[str], bool]:
    """构造 soul 存在性检查器：parse_script 编译期校验 actors 的 soul 用。
    携带 _soul_ids 可用列表，报错文案末尾附上（db_utils 无列表函数时省略）。
    每次编译新建一份——_soul_ids 随当次库况刷新，报错文案的列表不陈旧。"""
    def checker(sid: str) -> bool:
        return _check_soul_id_exists(sid)

    checker._soul_ids = _list_all_soul_ids()
    return checker


def compile_script(femo_text: str, base_dir: Optional[str] = None,
                   models: Optional[Dict[str, Any]] = None,
                   soul_checker: Optional[Callable[[str], bool]] = None) -> CompileResult:
    """同步编译（check / job_start / job_resume 共用一份）：编译错误在此抛出，
    调用方须保证失败时连 Job 档案都不产生（脏 Job 号零残留，§7.2）。

      femo_text  剧本全文
      base_dir   剧本文件所在目录（code/memory/context 相对 file: 地址的解析
                 目录）；空串 = 未保存的合法语义（引擎对相对路径报错），
                 不要拿别的目录兜底；None = 引擎缺省（当前工作目录）
      models     宿主模型白名单（{defaultProvider, providers:[{id, models}]}；
                 validate_actor_sources 编译期校验 source 用；None 跳过校验）
      soul_checker  自定义 soul 存在性检查器；缺省用引擎内置（查角色库）

    编译成功时顺带取出 script.warnings（warning 桶：编译不阻断的提示，随
    回执上浮宿主转告作者）；取不到按空列表（旧 Script 无此字段防 AttributeError）。"""
    script = _parse_script(
        femo_text,
        base_dir=base_dir if base_dir is not None else '.',
        soul_checker=soul_checker or _make_soul_checker(),
        models=models,
    )
    return CompileResult(
        script=script,
        warnings=list(getattr(script, 'warnings', None) or []),
        action_count=len(script.actions),
    )


def fingerprint_script(text: str) -> str:
    """剧本指纹（六关第③关 fingerprint_mismatch 的裁决依据）。
    job_start 落档 / job_resume 携新文本对表都用它。"""
    return _fingerprint_script(text)


def soul_exists(soul_id: str) -> bool:
    """soul_id 是否已存在（创建前去重 / 编译期校验同源）。"""
    return _check_soul_id_exists(soul_id)


def list_all_soul_ids() -> List[str]:
    """全部可用 soul_id（报错文案提示"可用的角色"用）。"""
    return _list_all_soul_ids()


# ════════════════════════════════════════════════════════════════════════
#  ③ Job 状态机（引擎侧唯一权威）
# ════════════════════════════════════════════════════════════════════════

_job_manager: Optional[JobManager] = None


def get_job_manager(runs_dir: Optional[str] = None) -> JobManager:
    """进程级 JobManager 单例：Job 排他裁决 / 档案落盘 / 僵死对账 / 六关的
    唯一权威。runs_dir 仅首次调用生效（测试沙盒指独立目录用；缺省 = 引擎
    缺省 runs/ 目录，即 get_user_dir()/user_data/jobs/runs）。

    消费面（宿主桥用到的方法，签名见 job_manager.JobManager）：
      create_job / resume_job / pause_job / get_job_state / list_jobs /
      deliver_human_input / reconcile_stale / build_resume_state /
      attach / detach / runner_of / mark_running / mark_session /
      merge_checkpoint / suspend / finalize / observe_event
    JobError / JobBusyError 按本模块 re-export 的类捕获（同一类对象）。"""
    global _job_manager
    if _job_manager is None:
        _job_manager = JobManager(runs_dir=runs_dir)
    return _job_manager


def bound_job_ids() -> List[int]:
    """当前挂靠了活跃 Runner 的 Job 号清单（shutdown 全场停止的遍历用）。
    替代宿主直挖 JobManager._bound 私有字段。"""
    return list(get_job_manager()._bound)


# ════════════════════════════════════════════════════════════════════════
#  ④ 运行时执行体
# ════════════════════════════════════════════════════════════════════════

def create_runner(script, *, base_dir: str, event_callback=None,
                  verbose: bool = False,
                  user_api_key: Optional[str] = None,
                  user_api_provider: Optional[str] = None,
                  user_api_url: Optional[str] = None,
                  user_api_model: Optional[str] = None,
                  resume_state: Optional[dict] = None,
                  runtime_callbacks: Optional[dict] = None,
                  run_tag: str = '',
                  host_ai_backend: bool = False) -> FEMORunner:
    """构造 FEMORunner 并按宿主协议装配到位（原宿主「构造 + 私有属性注入」
    全流程内聚于此）。

      script            compile_script 回执里的不透明句柄，原样传入
      base_dir          剧本文件所在目录；空串 = 未保存（相对路径报错）
      event_callback    callable(event_type, data_dict)：引擎事件上行通道
                        （宿主桥在此包信封 emit；Job 旁挂观察也挂这里）
      runtime_callbacks Job 旁挂窄回调契约（§4.2 依赖倒置）：可选键
                        on_flow_start / on_checkpoint / on_state_change /
                        on_run_end——Runtime 不认识 Job，翻译归宿主桥
      run_tag           wait_key 世代前缀（如 f"j{job_id}:"——跨 Job 键
                        永不重合的机制性免疫，§5.6）
      host_ai_backend   True = AI 节点交宿主执行体：_exec_ai 上行 ai_request
                        事件后等宿主经 human_input 回传（wait_key 形如
                        j<N>:ai_*），上下文拼接钉「首轮全量、之后增量」
                        （dsh harness 的窗口记忆契约）；False = 引擎直连
                        LLM 出口（user_api_* 四参生效）

    wait_key 信箱恒开（等通道而非 stdin——与 main.py server 模式同款驱动），
    这是 human_input / actor_failed 命令投递的前提。
    返回的 runner：run() / stop() / engine.shutdown() 是宿主可调的全部方法面
    （run 前构造期异常、run 后节点异常的收口语义见 job_manager 的 finalize）。"""
    runner = FEMORunner(
        script,
        base_dir=base_dir,
        verbose=verbose,
        event_callback=event_callback,
        user_api_key=user_api_key,
        user_api_provider=user_api_provider,
        user_api_url=user_api_url,
        user_api_model=user_api_model,
        resume_state=resume_state,
        runtime_callbacks=runtime_callbacks,
        run_tag=run_tag,
    )
    runner._human_input_event = threading.Event()
    runner._human_input_data = None
    if host_ai_backend:
        runner._host_ai_backend = True
        # 惰性 import：femoBridges 缺席只应炸 host_ai_backend 这条路，
        # 不许拖累引擎直连模式（与旧桥同款时机）。
        from femoBridges.ContextExample import MODE_FIRST_FULL_THEN_INCREMENTAL
        runner._context_mode = MODE_FIRST_FULL_THEN_INCREMENTAL
    return runner


# ════════════════════════════════════════════════════════════════════════
#  ⑤ 角色库（宿主零直读 SQLite——B4 红线）
# ════════════════════════════════════════════════════════════════════════

def get_soul(soul_id: str) -> Optional[Dict[str, Any]]:
    """单个角色档案（子代理 persona 注入用）。未知 soul → None（宿主按
    「演员回落标准模式」降级，容错同旧语义）。路径推导/表结构回归引擎内部。"""
    return _get_soul_by_id(soul_id)


def list_souls() -> List[Dict[str, str]]:
    """全部角色（精简 id + 名字）——主模型写剧本选角用。"""
    return _list_souls()


def create_soul(soul_id: str, soul_name: str, description: str,
                user_id: str = 'u001') -> None:
    """新建角色（归属默认用户，插件/宿主模式前端不再输入 user）。
    重号抛 ValueError（人话文案，宿主原样上浮）——去重检查内聚在此，
    宿主不再自带 check-then-create 两段式。"""
    if _check_soul_id_exists(soul_id):
        raise ValueError(f'soul_id "{soul_id}" 已存在（角色库中已有同名角色，请换一个 soul_id）')
    _create_soul(soul_id, soul_name, description, user_id)


# ════════════════════════════════════════════════════════════════════════
#  ⑥ 剧本发现
# ════════════════════════════════════════════════════════════════════════

def list_scripts(femo_root: str) -> List[str]:
    """扫 .femo 剧本：引擎自带 projects 目录 + 宿主用户目录（get_user_dir
    可解析到别处）都算，去重；project 子目录一层 + 散件，按名排序稳定输出。"""
    from femoBridges.getDir.get_dir import get_user_dir
    candidates = []
    local_projects = os.path.join(femo_root, "user_data", "projects")
    if os.path.isdir(local_projects):
        candidates.append(local_projects)
    home_projects = os.path.join(get_user_dir(), "user_data", "projects")
    if os.path.isdir(home_projects) and home_projects not in candidates:
        candidates.append(home_projects)
    scripts = []
    for projects in candidates:
        for name in sorted(os.listdir(projects)):
            sub = os.path.join(projects, name)
            if os.path.isdir(sub):
                for f in sorted(os.listdir(sub)):
                    if f.endswith(".femo"):
                        scripts.append(os.path.join(sub, f))
            elif name.endswith(".femo"):
                scripts.append(sub)
    return scripts


# ════════════════════════════════════════════════════════════════════════
#  ⑦ 零 token 干跑（femo_debugger CLI run 子命令的编程面）
# ════════════════════════════════════════════════════════════════════════

def debug_dry_run(script_path: str, *, runs: int = 1,
                  seed: Optional[int] = None,
                  module: Optional[str] = None,
                  base_dir: Optional[str] = None,
                  set_vars: Optional[List[str]] = None,
                  assign_prob: float = 1.0,
                  flaky: float = 0.0,
                  max_steps: int = 200,
                  quiet: bool = True,
                  log_jsonl: Optional[str] = None,
                  report_path: Optional[str] = None) -> Dict[str, Any]:
    """零 token 干跑剧本：FakeHost 替 AI/人类发言（按种子合成值），DB 走
    沙盒库（cache/debug-sandbox/run-*.wor，退出恢复原 db 路径，每轮重新
    编译=干净世界）。返回 {'exit_code': int, 'report': dict|None}：
    exit_code 三档——全好 0 / 部分好 2 / 全坏 1（completed 与 max_steps 都算
    可接受结局，2026-09-12 拍板）；report 为 write_json_report 的终报 JSON
    （report_path 未给或未写出时为 None）。

      script_path   .femo 剧本路径（未保存的文本先由宿主写临时文件——
                    与 dsh debug-run.ts 同款做法）
      runs          多轮跑（每轮换种子 seed+i）
      seed          基础随机种子（同种子可复现；None=随机取）
      module        模块单测：调试器合成 wrapper 直进被测模块（嵌套用点路径
                    如 Outer.Inner）；未知模块响亮报错
      base_dir      code: 相对引用（file:"xxx.py"）解析目录；None=剧本所在目录
      set_vars      定向注入变量值 k=v / k=v1|v2（可多项；@actor 可用）
      assign_prob   赋值概率 0~1（<1 概率沉默，模拟 out 是权限不是义务）
      flaky         概率输出无效赋值（触发 assign_error→node_retry 链路）
      max_steps     步数预算（死循环保险）
      quiet         抑制引擎 print（[debug] 横幅与 print_report 仍进 stdout）
      log_jsonl     实时调试日志 JSONL 路径（每条 flush，宿主/前端可 tail）
      report_path   JSON 终报输出路径

    ⚠️ 实现面与 CLI 逐字节同源：惰性调 femo2host/femoToolcall/femo_debugger 的
    main(['run', ...])——CLI 是本函数的子进程形态（dsh debug-run.ts 仍走
    CLI：干跑要能被 terminate 不留僵尸、不占运行桥；femo_debugger 消费的
    全是现成引擎接口，实现留在 femo2host/femoToolcall 不动它的测试与引用面）。
    ⚠️ 运行桥进程内禁用：cmd_run/print_report 的 print 会污染 NDJSON 流——
    本函数面向内嵌宿主与测试。log-kinds/log-console 两个纯 CLI 体验参数
    未进本 API 面。"""
    from femo2host.femoToolcall import femo_debugger
    argv = ['run', script_path, '--runs', str(max(1, int(runs))),
            '--assign-prob', str(assign_prob), '--flaky', str(flaky),
            '--max-steps', str(int(max_steps))]
    if seed is not None:
        argv += ['--seed', str(int(seed))]
    if module:
        argv += ['--module', str(module)]
    if base_dir is not None:
        argv += ['--base-dir', base_dir]
    for kv in (set_vars or []):
        argv += ['--set', str(kv)]
    if quiet:
        argv += ['--quiet']
    if log_jsonl:
        argv += ['--log-jsonl', log_jsonl]
    if report_path:
        argv += ['--report', report_path]
    try:
        code = int(femo_debugger.main(argv))
    except SystemExit as exc:      # argparse 拒单（正常构造到不了这里）
        code = int(exc.code) if exc.code else 2
    out: Dict[str, Any] = {'exit_code': code}
    if report_path:
        try:
            with open(report_path, encoding='utf-8') as f:
                out['report'] = json.load(f)
        except (OSError, ValueError):
            out['report'] = None   # 干跑炸了可能没写出报告——诚实标注，不装成功
    return out


# ════════════════════════════════════════════════════════════════════════
#  ⑧ 宿主握手词汇（只读）
# ════════════════════════════════════════════════════════════════════════

#: ai_request.blocks 料包键词汇契约（引擎拥有词汇表；拼装归执行后端）。
#: 宿主拼装器消费其中的文本键；'_actor_info' 是引擎私有 dict（身份元数据，
#: 随包透传、不得当文本拼）；契约外键 = 剧本自定义 context 方法的产出
#: （宿主拼装器不识别 → 忽略 + 告警，自定义料仅直连模式生效——已知边界）。
#: 权威定义：femoCompiler/protocol.py BLOCK_KEYS。
AI_REQUEST_BLOCK_KEYS: Dict[str, str] = dict(_BLOCK_KEYS)
