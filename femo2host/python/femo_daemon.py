"""femo_daemon.py — 引擎常驻进程（v1：hub + 引擎收编，第2步增量A/B）。

每数据根一座的常驻进程，脱离一切窗口与桥。v0 肚里只有投影中心 hub；
第2步起引擎全家（build_stage 装配段：JobManager/Runner/产信/出站轮询/事件
回调/worker）搬进同一进程，并经 hub 服务器的**挂载口**暴露：
  · POST /cmd/<cmd>   —— stdio 命令信封原样复用（清单§五：照抄不重新发明），
    body={"id","cmd","args"}，应答=stdio response 信封原样 JSON；
  · GET  /engine/health —— 引擎装配事实（bound_jobs/runners/hub_inproc=…）；
  · GET  /engine/events —— SSE 事件流（增量B：重放环+心跳+归属闸，帧=stdio
    事件信封原样，壳按行转播即成 stdio 事件）。
增量B 已落地：产信宿主语义（daemon 产信收件宿主=job 档案「最新发起方」格，
_job_host/engine_mode）、出站轮询 all_hosts（常驻引擎一座养全场，认领纪律仍
由 bound_job_ids 站岗）、事件推流。仍未定稿（增量C）：**调用方身份**（壳经
/cmd 转发时以谁的宿主格收发——mailbox_post/collect_notices/readdress 等信柜
命令按调用方身份记账，现在落在占位自称 'daemon' 上）与**门铃注册表**（投递员
按注册表上门）、**常驻 shutdown 语义**（杀引擎还是适配器解挂——涉事命令响亮
拒绝 error=engine_stage_gate，绝不静默）、皱褶①的帧宿主上下文随事件带。

出生与看门（无专职守护，惰性代拉）：
  · HubClient 探活失败时以**脱离母进程**方式代拉本文件——母死了它继续活，
    「养桥关机=剧场消失」的老债就此清账；
  · 本进程自己探 hub.json：活（另一座已在）→ 大声留痕、自退——一座数据根
    只养一座，竞态孪生自裁；死/无 → 装配 hub、写账（pid=本进程）、常驻。
  · 杀掉本进程 → 下一座桥的客户端惰性探活失败 → 代拉新的（接管语义）。

日志镜窗（2026-09-27 三版）：被代拉出生的进程没有窗、输出全进日志——引擎在
桌面上没了脸。一版 AllocConsole 被 Win11「默认终端=Windows Terminal」委派
机制吞窗（控制台对象在、横幅在案、物理窗从未出现，实锤退役）；二版 tkinter
被 PATH 首位 python 卡死（AutoClaw 精简版不带 tkinter，宿主拉 daemon 用的
恰是它）。三版 ctypes 直调 Win32：普通 GUI 窗口不经过控制台委派，ctypes 是
任何 CPython 都带的纯标准库——谁拉都能开窗。窗=日志文件的只读镜像（200ms
跟随，增量追加、超 3000 行掐头），输出链零改动；关窗=杀引擎（下一座客户端
会代拉重生）。可见性（2026-09-30 设置中心刀）：出生不再无条件开窗，归
_ConsoleGate 管——setting.json 里各宿主的愿望 ∩ 门铃簿在线，任一人 show
才显示，缺省隐藏；/cmd/config_set 与 0.5s 设置轮询实时显隐（ShowWindow，
不碰 WM_CLOSE——杀车语义只归真人点 X）；FEMO_DAEMON_CONSOLE=0 或
--no-console 或终端手动跑永远静音，压过一切愿望（测试沙盒静音）。

闲时散场（2026-09-27 二次拍板，取代「闲时不散场」旧拍板）：点名看门铃簿
（四家宿主直连客户端每 10s 心跳一次，自取户报空门牌）。心跳簿全空、持续
满宽限期（缺省 1 分钟，FEMO_DAEMON_IDLE_GRACE_SEC 可调；2026-09-30 用户拍板
由 5 分钟收紧——代拉重生是秒级事，宽限没必要陪长）→ 有活 runner 先
诚实挂起（断点与信柜原样留盘，回来续跑即收养在柜信）→ 引擎干净退场。
running 但宿主全离线的场不陪死等——信寄出去没人取，挂起把等待收口；
挂起档在场不影响退场。测试缝：FEMO_DAEMON_WATCHDOG_PERIOD_SEC（点名周期）。

运行形态：python femo_daemon.py --data-dir <hub数据目录> [--db …] [--no-engine]
日志：被代拉时 stdout/stderr 由代拉方重定向到 <数据根>/logs/femo_daemon.log。
升级窗口：诚实挂起 + 断点续跑（引擎六关现成）——本进程死了在跑的戏由
引擎既有懒对账判挂起，不丢账。
"""

import argparse
import json
import os
import queue
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))            # femo2host/python
FEMO2HOST = os.path.dirname(HERE)                            # femo2host/

# ── 阶段闸（不是兜底——见文件头）──────────────────────────────────────────
# 增量C 已解锁 shutdown（按宿主限定：停本宿主导演的场次，常驻引擎不死——
# 由 _cmd_route 直接待，不经 dispatch 的旧全场语义）。
_STAGE_REJECTED = frozenset()


class _DoorbellRegistry:
    """门铃注册表（第2步增量C）：壳代登记本宿主的推送口——投递员搬进常驻
    引擎后不认识各宿主的门（FEMO_PUSH_PORT 只在壳的环境里，清单§五复审缺口③）。
    TTL 心跳：壳启动登记+每 10s 续期；过期=门没了，信留柜自取（清单§五：
    没门铃的目标留柜自取，zcode 语义不变）。"""

    TTL_SEC = 30.0

    def __init__(self):
        self._lock = threading.Lock()
        self._doors = {}             # host -> [url, last_seen(monotonic)]

    def register(self, host, url):
        with self._lock:
            self._doors[str(host)] = [str(url), time.monotonic()]

    def url_of(self, host):
        with self._lock:
            hit = self._doors.get(str(host))
            if hit is None:
                return ''
            if time.monotonic() - hit[1] > self.TTL_SEC:
                return ''            # 过期：心跳断了=门没了，留柜自取
            return hit[0]            # 空串=自取户报了到但没门，同样留柜

    def doors(self):
        """有门的活心跳户（投递员上门用；自取户空门牌不在此列）。"""
        with self._lock:
            now = time.monotonic()
            return [(h, d[0]) for h, d in self._doors.items()
                    if d[0] and now - d[1] <= self.TTL_SEC]

    def hosts(self):
        """全部活心跳的宿主名（闲时散场点名用——报到即算在线，无论有无门牌）。"""
        with self._lock:
            now = time.monotonic()
            return [h for h, d in self._doors.items()
                    if now - d[1] <= self.TTL_SEC]


class _EngineEventChannel:
    """引擎事件 SSE 通道（第2步增量B）：femo2host/femoGenConnector/sse-core.mjs
    语义的 Python 移植（清单§五：照抄不重新发明）——
      · 重放环 400（v8.1 实测：100 环被一次长 AI 回复的逐 token 帧冲爆）；
      · 短命帧（femo_stream/ai_token/step）不入环——现场直推，「此刻在飞的
        流式状态」重放会让旧轮 delta 再长一遍字（Job784 实锤）；
      · checkpoint 原位替换只留最新（变量世界快照不回放堆积）；
      · 重放帧信封顶层 replay:true——追平帧只恢复状态绝不触发浮层；
      · 15s 心跳注释行，防代理/浏览器判死空闲连接。
    帧载荷=stdio 事件信封原样（{'type':'event','event':…,'data':…}），壳
    （增量C）按行转播给适配器即成 stdio 事件，适配器全程冻结。
    归属闸（裁决⑤）：订阅带 ?host=<宿主id> 只收本场 host_refs 含该宿主的
    事件（job 归属解析带 1s 缓存，档案读不放大盘）；不带货=全收（增量C 起
    壳必须带货，注册表定稿后收紧为必带）。"""

    RING_CAP = 400
    EPHEMERAL = frozenset({'femo_stream', 'ai_token', 'step'})
    HEARTBEAT_SEC = 15.0

    def __init__(self, job_hosts_of):
        self._lock = threading.Lock()
        self._ring = []              # [(seq, envelope_dict)]
        self._seq = 0
        self._clients = {}           # id(queue) -> (queue, host_or_None)
        self._job_hosts_of = job_hosts_of   # job_id -> frozenset(hosts)（装配段供，带缓存）

    def emit(self, envelope):
        """引擎事件入口（build_stage 的 emit 注入此口）：入环（短命帧跳过、
        checkpoint 原位替换）+ 按归属闸直推在场订阅者。"""
        etype = str(envelope.get('event') or '')
        data = envelope.get('data') if isinstance(envelope.get('data'), dict) else {}
        job_id = data.get('job_id')
        with self._lock:
            self._seq += 1
            seq = self._seq
            if etype not in self.EPHEMERAL:
                replaced = False
                if etype == 'checkpoint':
                    for i, (_s, ev) in enumerate(self._ring):
                        if ev.get('event') == 'checkpoint':
                            self._ring[i] = (seq, envelope)
                            replaced = True
                            break
                if not replaced:
                    self._ring.append((seq, envelope))
                    if len(self._ring) > self.RING_CAP:
                        self._ring.pop(0)
            for key, (q, host) in list(self._clients.items()):
                if host is not None and job_id is not None:
                    try:
                        hosts = self._job_hosts_of(job_id)
                    except Exception:
                        hosts = None
                    if hosts is not None and host not in hosts:
                        continue          # 归属闸：别家的戏不点亮
                q.put((seq, envelope))

    def attach(self, q, host):
        with self._lock:
            self._clients[id(q)] = (q, host)

    def detach(self, q):
        with self._lock:
            self._clients.pop(id(q), None)

    def replay(self, since):
        """重放环快照（seq>since）：connect 时先补历史再进直播。"""
        with self._lock:
            return [(s, ev) for s, ev in self._ring if s > since]

    @staticmethod
    def frame(seq, envelope, replay=False):
        body = dict(envelope)
        if replay:
            body['replay'] = True         # 信封顶层标记（v9）：追平帧不触发浮层
        return ('id: %d\ndata: %s\n\n'
                % (seq, json.dumps(body, ensure_ascii=False))).encode('utf-8')


def _read_addr(data_dir):
    """读 hub.json 自发现账（与 HubClient._read_addr 同形状，不 import 兄弟件
    之外的东西——本文件保持零依赖单文件形态）。"""
    path = os.path.join(data_dir, 'hub.json')
    if not os.path.isfile(path):
        return None
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _probe(addr, timeout=1.5, data_dir=None):
    """探活：GET /health 短超时（死端口通常立刻拒绝，超时算死）。
    data_dir 给出时做身份比对：账与 /health 都报了 data 且不一致=别人家的
    hub（多数据根并存：测试沙盒与生产各认各的），不算活。"""
    try:
        base = 'http://127.0.0.1:%d' % int(addr.get('port') or 0)
        if not addr.get('port'):
            return False
        with urllib.request.urlopen(base + '/health', timeout=timeout) as resp:
            body = json.load(resp)
        if not body.get('ok'):
            return False
        if data_dir:
            want = str(data_dir)
            got = str(body.get('data') or '')
            if got and want != got:
                return False
        return True
    except Exception:
        return False


def _write_addr(data_dir, port):
    """写自发现账（与 start_hub_server 同形状）。"""
    with open(os.path.join(data_dir, 'hub.json'), 'w', encoding='utf-8') as f:
        json.dump({'host': '127.0.0.1', 'port': port, 'pid': os.getpid(),
                   'started': int(time.time() * 1000)}, f)


def _pid_alive(pid):
    """pid 还活着吗（Win32：OpenProcess+零超时等待；非 Windows 走信号 0）。
    打不开句柄分两种：已退出→死；拒访（权限够不着）→当活——收口宁可多等
    一拍，绝不误抢活人的账。"""
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return False
    if pid <= 0:
        return False
    if os.name != 'nt':
        try:
            os.kill(pid, 0)                         # POSIX：信号 0 只探存在不杀
            return True
        except OSError:
            return False
    try:
        import ctypes as ct
        k32 = ct.WinDLL('kernel32', use_last_error=True)
        k32.OpenProcess.restype = ct.c_void_p
        k32.OpenProcess.argtypes = [ct.c_uint32, ct.c_int, ct.c_uint32]
        h = k32.OpenProcess(0x00100000, False, pid)     # SYNCHRONIZE
        if not h:
            return ct.get_last_error() == 5             # ERROR_ACCESS_DENIED=活着但够不着
        k32.WaitForSingleObject.restype = ct.c_uint32
        k32.WaitForSingleObject.argtypes = [ct.c_void_p, ct.c_uint32]
        alive = k32.WaitForSingleObject(h, 0) == 0x102  # WAIT_TIMEOUT=还没退
        k32.CloseHandle.argtypes = [ct.c_void_p]
        k32.CloseHandle(h)
        return alive
    except Exception:
        return True                                 # 探不动：当活，交给宽限


def _claim_ledger(data_dir, port, settle_sec=None):
    """绑定后收口（2026-09-28 镜窗成群事故）：一座数据根只养一座 hub 的裁决闸。

    hub.json 是最后写者赢的弱账——并发出生时每个孪生都会把账覆写成自己，
    旧法「睡一拍看账上是不是自己的 pid」等于查了个寂寞（最后写者必读到
    自己、直接放行），一波孪生全员开张、各开各的镜窗。所以裁决不靠账上是
    谁，靠「账上别人探不探得活」（/health 绑完端口毫秒级就应答）：
      · 探得活 → 让贤自退（返回 False，调用方即退，镜窗都不会开）；
      · 探不活且账主活着 → 可能还在装配，宽限内边等边探；
      · 探不活且账主已死 → 死址占账，抢写回自己再复核（最多两抢——抢不动
        说明有活人在写账，让贤）；
      · 账上是自己 → 睡一拍复核没被同时抢账的孪生覆写，没被就持账开张。
    宽限缺省 10s（FEMO_DAEMON_TWIN_SETTLE_SEC 可调），只对「活着却不应答」
    的账主生效——真死址秒抢，不耗宽限。"""
    if settle_sec is None:
        settle_sec = float(os.environ.get('FEMO_DAEMON_TWIN_SETTLE_SEC') or 10)
    deadline = time.monotonic() + settle_sec
    grabs = 0
    while True:
        addr = _read_addr(data_dir)
        if addr is None:
            _write_addr(data_dir, port)             # 无主之账：占下，回头复核
            time.sleep(1.0)
            continue
        if str(addr.get('pid') or '') == str(os.getpid()):
            time.sleep(1.0)                         # 复核拍：给同时抢账的孪生留覆写窗
            addr = _read_addr(data_dir)
            if addr is not None and str(addr.get('pid') or '') != str(os.getpid()):
                continue                            # 被覆写了：回循环头重新裁决
            return True
        # 端口撞号自查（2026-09-28 生产实测）：账上的地址就是我刚绑的这个口
        # （前任退场、端口被我接班）——这笔账探不得，探的就是自己的门，必得
        # 「活 hub」假象、新生儿出生即自裁，账从此死锁在死人手里。同号=前任
        # 必已退场，直接当死址走抢账。
        same_port = int(addr.get('port') or 0) == int(port)
        if not same_port and _probe(addr, data_dir=data_dir):
            sys.stderr.write('femo_daemon: 孪生常驻 hub 先到 %s:%s（pid=%s）——'
                             '本进程自退。\n' % (addr.get('host') or '127.0.0.1',
                                                addr.get('port'), addr.get('pid')))
            return False
        if not same_port and _pid_alive(addr.get('pid')) and time.monotonic() < deadline:
            time.sleep(0.5)                         # 活着却不应答：可能还在装配，边等边探
            continue
        if grabs >= 2:
            sys.stderr.write('femo_daemon: 账上 %s:%s（pid=%s）始终探不活且账抢'
                             '不动——让贤自退，看门者稍后代拉。\n'
                             % (addr.get('host') or '127.0.0.1', addr.get('port'),
                                addr.get('pid') or '?'))
            return False
        grabs += 1
        sys.stderr.write('femo_daemon: 账被死址占着（%s:%s，pid=%s）——抢写回自己'
                         '再复核。\n' % (addr.get('host') or '127.0.0.1',
                                        addr.get('port'), addr.get('pid') or '?'))
        _write_addr(data_dir, port)
        time.sleep(1.0)


# ── 桌面日志镜窗（2026-09-27 三版：Win32 原生，零依赖零前提）──────────────
# 一版 AllocConsole 被 Win11「默认终端=Windows Terminal」委派吞窗（实锤退役）；
# 二版 tkinter 被 PATH 首位 python 卡死（AutoClaw 精简版不带 tkinter，宿主拉
# daemon 用的恰是它）。三版 ctypes 直调 Win32：普通 GUI 窗口不经过控制台委
# 派，ctypes 是任何 CPython（含精简发行版）都带的纯标准库——谁拉都能开窗。

class _LogMirrorWindow:
    """日志镜窗：Win32 小窗（多行只读 EDIT 控件），200ms 轮询跟随 daemon 日志
    文件的增量。窗是脸不是命——只读镜像，不碰输出链；关窗=杀引擎（用户拍板
    语义）。在守护线程里自建自跑（消息循环留在造窗的线程）。"""

    POLL_MS = 200
    TRIM_LINES = 3000           # 窗里最多留的行数（镜像不是账本，防内存无底洞）
    CHUNK_MAX = 256 * 1024      # 单次灌入上限（防历史全量/日志爆发卡死窗线程）

    # Win32 常量（就地定义，零 import 面）
    _WS_OVERLAPPEDWINDOW = 0x00CF0000
    _WS_VISIBLE = 0x10000000
    _WS_CHILD = 0x40000000
    _WS_VSCROLL = 0x00200000
    _ES_LEFT = 0x0000
    _ES_MULTILINE = 0x0004
    _ES_AUTOVSCROLL = 0x0040
    _ES_READONLY = 0x0800
    _WM_CLOSE = 0x0010
    _WM_DESTROY = 0x0002
    _WM_SIZE = 0x0005
    _WM_TIMER = 0x0113
    _WM_SETFONT = 0x0030
    _WM_CTLCOLOREDIT = 0x0133
    _WM_CTLCOLORSTATIC = 0x0138
    _EM_SETSEL = 0x00B1
    _EM_REPLACESEL = 0x00C2
    _EM_SCROLLCARET = 0x00B7
    _EM_GETLINECOUNT = 0x00BA
    _EM_LINEINDEX = 0x00BB
    _EM_SETLIMITTEXT = 0x00C5
    _IDI_APPLICATION = 32512
    _COLOR_WINDOW = 5

    def __init__(self, log_path):
        self._log_path = log_path
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def is_alive(self):
        """窗还活着（窗线程造窗成功且 hwnd 未销毁）——跨线程查 IsWindow 合法。
        窗线程还没跑到造窗那步（_state 未建）=当没活，闸会等下拍。"""
        state = getattr(self, '_state', None)
        hwnd = state.get('hwnd') if state else None
        return bool(hwnd) and bool(self._user32.IsWindow(hwnd))

    def set_shown(self, shown):
        """程序化显/隐（2026-09-30 设置中心）：ShowWindow 直调，绝不碰
        WM_CLOSE——「关窗=杀引擎」只归真人点 X。重显用 SW_SHOWNOACTIVATE
        （4）不抢焦点；SW_HIDE=0。hwnd 已销毁=安静返回（闸的 is_alive 会
        安排重建）。"""
        state = getattr(self, '_state', None)
        hwnd = state.get('hwnd') if state else None
        if not hwnd or not self._user32.IsWindow(hwnd):
            return
        self._user32.ShowWindow(hwnd, 4 if shown else 0)

    def _run(self):
        try:
            self._win32_main()
        except Exception as exc:             # 窗是脸不是命：开不成大声留痕，引擎照常
            import traceback
            sys.stderr.write('femo_daemon: 日志镜窗退场（%s）——只看日志。\n%s'
                             % (exc, traceback.format_exc()))

    def _win32_main(self):
        import ctypes as ct
        from ctypes import wintypes as wt
        user32 = ct.WinDLL('user32', use_last_error=True)
        gdi32 = ct.WinDLL('gdi32', use_last_error=True)
        kernel32 = ct.WinDLL('kernel32', use_last_error=True)

        WNDPROC = ct.WINFUNCTYPE(ct.c_longlong, wt.HWND, ct.c_uint, wt.WPARAM, wt.LPARAM)
        user32.DefWindowProcW.restype = ct.c_longlong
        user32.DefWindowProcW.argtypes = [wt.HWND, ct.c_uint, wt.WPARAM, wt.LPARAM]
        user32.CreateWindowExW.restype = wt.HWND
        user32.CreateWindowExW.argtypes = [wt.DWORD, wt.LPCWSTR, wt.LPCWSTR, wt.DWORD,
                                           ct.c_int, ct.c_int, ct.c_int, ct.c_int,
                                           wt.HWND, ct.c_void_p, wt.HINSTANCE, ct.c_void_p]
        user32.SetWindowLongPtrW.restype = ct.c_longlong
        user32.SetWindowLongPtrW.argtypes = [wt.HWND, ct.c_int, ct.c_longlong]
        user32.GetWindowLongPtrW.restype = ct.c_longlong
        user32.GetWindowLongPtrW.argtypes = [wt.HWND, ct.c_int]
        user32.SendMessageW.restype = ct.c_longlong
        user32.SendMessageW.argtypes = [wt.HWND, ct.c_uint, ct.c_ulonglong, ct.c_void_p]
        user32.IsWindow.restype = wt.BOOL
        user32.IsWindow.argtypes = [wt.HWND]
        self._user32 = user32
        self._gdi32 = gdi32
        state = {'edit': None, 'font': None, 'brush': None, 'pos': 0, 'hwnd': None}
        self._state = state

        def _append(text):
            u, e = user32, state['edit']
            if not e:
                return
            # EDIT 控件只认 \r\n（CRLF）——日志文件是 \n，直喂全挤一行（实锤）
            text = text.replace('\r\n', '\n').replace('\n', '\r\n')
            u.SendMessageW(e, self._EM_SETSEL, 0x7FFFFFFF, 0x7FFFFFFF)   # 文末
            buf = ct.create_unicode_buffer(text)
            u.SendMessageW(e, self._EM_REPLACESEL, 0, ct.cast(buf, ct.c_void_p))
            lines = u.SendMessageW(e, self._EM_GETLINECOUNT, 0, 0)
            if lines > self.TRIM_LINES:
                cut = u.SendMessageW(e, self._EM_LINEINDEX, lines - self.TRIM_LINES, 0)
                u.SendMessageW(e, self._EM_SETSEL, 0, cut)
                u.SendMessageW(e, self._EM_REPLACESEL, 0, None)
            u.SendMessageW(e, self._EM_SETSEL, 0x7FFFFFFF, 0x7FFFFFFF)
            u.SendMessageW(e, self._EM_SCROLLCARET, 0, 0)

        self._pump = self._make_pump(_append)

        def wndproc(hwnd, msg, wp, lp):
            if msg == self._WM_CLOSE:
                user32.DestroyWindow(hwnd)
                return 0
            if msg == self._WM_DESTROY:
                user32.PostQuitMessage(0)
                return 0
            if msg == self._WM_SIZE and state['edit']:
                user32.MoveWindow(state['edit'], 0, 0,
                                  int(lp & 0xFFFF), int((lp >> 16) & 0xFFFF), True)
                return 0
            if msg == self._WM_TIMER:
                try:
                    self._pump()
                except Exception as exc:
                    sys.stderr.write('femo_daemon: 镜窗跟随失败（%s）\n' % exc)
                return 0
            if msg in (self._WM_CTLCOLOREDIT, self._WM_CTLCOLORSTATIC) and state['brush']:
                dc = wt.HDC(wp)
                gdi32.SetBkColor(dc, 0x0014100A)        # 深底（COLORREF 0x00BBGGRR）
                gdi32.SetTextColor(dc, 0x00E9DED8)      # 浅字
                return state['brush']                   # 整数直还（包实例会炸回调）
            return user32.DefWindowProcW(hwnd, msg, wp, lp)

        wndproc_ref = WNDPROC(wndproc)
        self._wndproc_ref = wndproc_ref                 # 防 GC（回调被收=窗僵死）
        hinst = kernel32.GetModuleHandleW(None)
        title = 'FEMO 引擎常驻进程 pid=%d —— 关窗=杀引擎（会自动重生）' % os.getpid()

        class _WNDCLASSW(ct.Structure):              # wintypes 不带 WNDCLASSW，就地定义
            _fields_ = [('style', ct.c_uint),
                        ('lpfnWndProc', WNDPROC),
                        ('cbClsExtra', ct.c_int),
                        ('cbWndExtra', ct.c_int),
                        ('hInstance', wt.HINSTANCE),
                        ('hIcon', wt.HANDLE),
                        ('hCursor', wt.HANDLE),
                        ('hbrBackground', wt.HANDLE),
                        ('lpszMenuName', wt.LPCWSTR),
                        ('lpszClassName', wt.LPCWSTR)]
        wc = _WNDCLASSW()
        wc.lpfnWndProc = ct.cast(wndproc_ref, WNDPROC)
        wc.lpszClassName = 'FemoDaemonMirror'
        wc.hInstance = hinst
        wc.hCursor = user32.LoadCursorW(None, 32512)    # IDC_ARROW
        wc.hIcon = user32.LoadIconW(None, self._IDI_APPLICATION)
        wc.hbrBackground = wt.HANDLE(self._COLOR_WINDOW + 1)
        if not user32.RegisterClassW(ct.byref(wc)):
            raise OSError('RegisterClassW 失败')

        hwnd = user32.CreateWindowExW(
            0, wc.lpszClassName, title,
            self._WS_OVERLAPPEDWINDOW | self._WS_VISIBLE,
            60, 60, 1000, 600, None, None, hinst, None)
        if not hwnd:
            raise OSError('CreateWindowExW 失败')
        state['hwnd'] = hwnd
        # 显式亮窗：宿主代拉带 windowsHide（STARTUPINFO SW_HIDE），首窗创建会被
        # 它按住（实锤：窗对象在、IsWindowVisible=False）——ShowWindow 翻盘。
        user32.ShowWindow(hwnd, 5)                      # SW_SHOW
        user32.UpdateWindow(hwnd)

        state['edit'] = user32.CreateWindowExW(
            0, 'EDIT', '',
            self._WS_CHILD | self._WS_VISIBLE | self._WS_VSCROLL |
            self._ES_MULTILINE | self._ES_AUTOVSCROLL | self._ES_READONLY,
            0, 0, 980, 560, hwnd, None, hinst, None)
        if not state['edit']:
            raise OSError('EDIT 控件创建失败')
        user32.SendMessageW(state['edit'], self._EM_SETLIMITTEXT, 0x4000000, 0)  # 64MB 上限
        font = gdi32.CreateFontW(-18, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, 'Consolas')
        state['font'] = font
        user32.SendMessageW(state['edit'], self._WM_SETFONT, font, 1)
        state['brush'] = gdi32.CreateSolidBrush(0x0014100A)

        user32.SetTimer(hwnd, 1, self.POLL_MS, None)
        self._pump()                                    # 首拍：把启动横幅补进窗
        msg = wt.MSG()
        while user32.GetMessageW(ct.byref(msg), None, 0, 0) > 0:
            user32.TranslateMessage(ct.byref(msg))
            user32.DispatchMessageW(ct.byref(msg))
        sys.stderr.write('femo_daemon: 日志镜窗被关闭——关窗=杀引擎，散场。\n')
        os._exit(0)

    def _make_pump(self, append):
        """日志增量读取（窗线程每拍调）：跟随文件尾巴，截断回绕自动重头。
        【2026-09-28 单次灌入上限】pos 到文件尾超过 CHUNK_MAX 时只取尾部
        （前面留一行「略去」标记）——新生首拍会把整份历史日志灌进 EDIT 控件
        （实锤：日志已 135MB，daemon 每次重生镜窗必卡死 not responding 数
        分钟），日志爆发时同理。窗口是给人看的，历史归日志文件。"""
        def pump():
            try:
                size = os.path.getsize(self._log_path)
            except OSError:
                return
            pos = self._state['pos']
            if size < pos:                              # 日志被清/轮转：从头跟随
                self._state['pos'] = 0
                u = self._user32
                u.SendMessageW(self._state['edit'], self._EM_SETSEL, 0, 0)
                u.SendMessageW(self._state['edit'], self._EM_REPLACESEL, 0, None)
                pos = 0
            if size <= pos:
                return
            skipped = 0
            start = pos
            if size - pos > self.CHUNK_MAX:
                skipped = size - pos - self.CHUNK_MAX
                start = size - self.CHUNK_MAX
            with open(self._log_path, 'r', encoding='utf-8', errors='replace') as f:
                f.seek(start)
                chunk = f.read()
                self._state['pos'] = f.tell()
            if skipped:
                append('…（日志爆发，略去 %d KB）…\n' % (skipped // 1024))
            if chunk:
                append(chunk)
        return pump


def _truncate_log_keep_tail(path, keep=4 * 1024 * 1024):
    """把日志文件原地截到保留最近 keep 字节（2026-09-28 用户拍板：**开演时
    清、只留最新 4MB、跑完不清、下次开演再清**）。checkpoint 事件整包倾倒
    会把日志养到百 MB 级（群聊室一夜 135MB，96% 是它），文件尺寸由此兜住。
    原地重写（seek 0 写尾+truncate）不换文件——本进程的 stdout/stderr 句柄
    继续有效，调用方随后把自己的指针 lseek 到新尾即可。未超限=零动作。"""
    size = os.path.getsize(path)
    if size <= keep:
        return False
    with open(path, 'r+b') as f:
        f.seek(-keep, 2)                     # 尾部 keep 字节
        tail = f.read()
        f.seek(0)
        f.write(('…（%s 开演清理：日志只保留最近 %d MB，更早内容已移除）…\n'
                 % (time.strftime('%m-%d %H:%M'), keep // (1024 * 1024))).encode('utf-8'))
        f.write(tail)
        f.truncate()
    return True


def _resolve_femo_root():
    """引擎根：FEMO_ROOT env > FE4M env（历史别名）> 仓库根（本文件位置反推）。
    唯一一份——装配段与镜窗闸两处共用（同样的逻辑写两份必漂移）。"""
    return (os.environ.get('FEMO_ROOT', '').strip()
            or os.environ.get('FE4M', '').strip()
            or os.path.dirname(FEMO2HOST))


class _ConsoleGate:
    """镜窗可见性闸（2026-09-30 设置中心刀，取代出生一次性的 _open_console）：
    愿望（setting.json 的 console_window，按宿主格，setting.py 是唯一读写口）
    ∩ 在线（门铃簿活心跳）→ 任一人 show 才显示，缺省隐藏（显示大于隐藏）。
    四拍生效：/cmd/config_set 命令即时；本闸轮询线程 0.5s 一拍盯 setting.json
    并重算在线交集——宿主上线随下一拍心跳 ≤0.5s 收敛，下线随心跳过期
    ≤TTL+0.5s。FEMO_DAEMON_CONSOLE=0 / --no-console / 终端手动跑（isatty）
    永远静音——测试沙盒的安静靠 env，绝不被配置翻盘。显隐走 ShowWindow、
    不经 WM_CLOSE，「关窗=杀引擎」只归真人点 X；窗是脸不是命，开砸了响亮
    留痕照常站岗，CREATE_RETRY_SEC 退避重试（0.5s 拍里连开连炸会刷屏）。"""

    POLL_SEC = 0.5
    CREATE_RETRY_SEC = 5.0

    def __init__(self, femo_root, log_path, disabled=False):
        self._femo_root = femo_root
        self._log_path = log_path
        self._window = None                # _LogMirrorWindow 或 None
        self._shown = False                # 已应用态：只在翻转时碰 ShowWindow（常驻 SW_SHOW 会反复抢焦点）
        self._last_create = 0.0
        self._lock = threading.Lock()      # 轮询线程与 /cmd 线程并发 reconcile
        self._muted = bool(disabled) or os.name != 'nt' \
            or str(os.environ.get('FEMO_DAEMON_CONSOLE', '')).strip() == '0' \
            or sys.stderr.isatty() or sys.stdout.isatty()

    @property
    def muted(self):
        return self._muted

    def is_showing(self):
        with self._lock:
            return self._shown and bool(self._window and self._window.is_alive())

    def reconcile(self, online_hosts):
        """重算可见性并落到窗上（幂等；轮询线程与 config_set 命令都调）。"""
        with self._lock:
            if self._muted:
                return
            import setting                        # 同目录（随本文件入 sys.path）
            wishes = setting.console_wishes(self._femo_root)
            want = setting.console_should_show(online_hosts, wishes)
            alive = bool(self._window and self._window.is_alive())
            if want:
                if not alive:
                    now = time.monotonic()
                    if (now - self._last_create < self.CREATE_RETRY_SEC
                            or not os.path.isfile(self._log_path)):
                        return                    # 刚炸过/极早夭（镜无可镜）：下拍再说
                    self._last_create = now
                    self._window = _LogMirrorWindow(self._log_path)   # 出生即亮
                    self._shown = True
                elif not self._shown:
                    self._window.set_shown(True)
                    self._shown = True
            elif alive and self._shown:
                self._window.set_shown(False)
                self._shown = False

    def start_poller(self, online_hosts_of):
        """0.5s 一拍：setting.json 变了重读愿望，每拍重算在线∩愿望。
        门铃注册/过期不挂钩子——本拍已覆盖，同样的收敛速度少一处接线。"""
        def _loop():
            while True:
                time.sleep(self.POLL_SEC)
                try:
                    self.reconcile(online_hosts_of())
                except Exception as exc:          # 脸不是命：轮询病了引擎照常站岗
                    sys.stderr.write('femo_daemon: 设置轮询失败（%s）\n' % exc)
        threading.Thread(target=_loop, name='setting-poller', daemon=True).start()


# ── 引擎收编（第2步增量A）─────────────────────────────────────────────────

def _assemble_engine(args, hub, port, mailbox, mail_courier, projection_hub,
                     doorbells, console_gate):
    """装配引擎全家（femo_bridge.build_stage——装配段自桥纯搬移的搭台函数），
    并把 /cmd 命令面与 /engine/health 挂进 hub 服务器（一张嘴一个端口一本
    发现账，hub.json 不造第二本）。装配失败大声炸（看门者=下一客户端代拉），
    绝不降级成 hub-only 静默续命——少兜底红线。doorbells 由 main 造好传入
    （镜窗闸与散场点名同一本门铃簿）；console_gate 同理（config_set 路由
    要即时 reconcile）。"""
    sys.path.insert(0, HERE)                     # import femo_bridge（同目录非包）
    import femo_bridge
    from femo2host import femo_api
    # 模块级门面引用显式提前绑定：ensure_default_data 引用的是 femo_bridge 的
    # 模块全局 femo_api（桥路径由 main() 的 global 绑定供给，daemon 不经 main）
    # ——不绑则种子静默失败（「no such table: souls」，该函数 docstring 记载过
    # 同款前科）；build_stage 首调也会绑同一对象，此处提前只为种子先于命令面。
    femo_bridge.femo_api = femo_api

    if args.db:
        # 账本指向独立库（测试沙盒等用）；生产默认不受影响（桥同款语义）
        femo_api.set_db_path(os.path.abspath(args.db))
    femo_bridge.ensure_default_data()

    femo_root = _resolve_femo_root()
    os.chdir(femo_root)   # 与桥同款：parse_script 的 debug 文件别落调用方 cwd

    # 协议出站口（daemon 版）：
    #  · send_response 按 req_id 落槽——dispatch 同步返回后由 /cmd 处理器取走
    #    （命令-结果契约：每命令恰好一次 send_response，且在 dispatch 调用帧
    #    内完成；job_pause 强停/shutdown 的 os._exit 路径见阶段闸注记）；
    #  · emit=事件出口（增量B）：引擎事件进 SSE 通道（重放环+归属闸+心跳），
    #    stderr 同步留痕（日志面不丢）。
    _slots = {}
    _slots_lock = threading.Lock()

    def _send_response(req_id, ok, result=None, error=None, detail=None, extra=None):
        payload = {"type": "response", "id": req_id, "ok": ok}
        if ok:
            payload["result"] = result
        else:
            payload["error"] = error
            if detail:
                payload["detail"] = detail
            if extra:
                payload.update(extra)
        with _slots_lock:
            _slots[str(req_id)] = payload

    def _trace(msg):
        try:
            sys.stderr.write('femo_daemon[trace]: %s\n' % msg)
        except Exception:
            pass

    # 归属闸的 job 归属解析（1s 缓存——档案读不放大到每事件每订阅者）。
    _job_hosts_cache = {}
    _job_hosts_at = [0.0]

    def _job_hosts_of(job_id):
        now = time.time()
        if now - _job_hosts_at[0] > 1.0:
            _job_hosts_cache.clear()
            _job_hosts_at[0] = now
        hit = _job_hosts_cache.get(job_id)
        if hit is None:
            rec = jm_ref['jm'].get_job_state(int(job_id)) or {}
            refs = rec.get('host_refs') if isinstance(rec.get('host_refs'), dict) else {}
            hit = frozenset(str(h) for h in refs if str(h))
            if not hit:
                hit = None              # 无归属账（裸跑/旧档案）=闸放行
            _job_hosts_cache[job_id] = hit
        return hit

    channel = _EngineEventChannel(_job_hosts_of)
    jm_ref = {'jm': None}               # stage 就绪后回填（通道路由要用）
    # doorbells 由 main 造好传入：镜窗闸（config_set 即时 reconcile）与散场
    # 点名同一本账，闸在装配前就得拿到心跳源。
    hub.set_doorbell_live_hosts(doorbells.hosts)   # cast 在线视图的在线判据

    def _emit(obj):
        try:
            channel.emit(obj)
        except Exception as exc:
            sys.stderr.write('femo_daemon: event broadcast failed: %s\n' % exc)
        try:
            sys.stderr.write('femo_daemon[engine-event] %s\n'
                             % json.dumps(obj, ensure_ascii=False))
        except Exception:
            pass

    def _hub_connector(hub_name):
        # 进程内直连（皱褶③：绝不 connect 探自己的 hub——daemon 复用自己=
        # HTTP 自环，自己 POST 自己）。host_name 交空串=裸跑语义（段键不带
        # host 段）：daemon 不是宿主，皱褶①的「帧宿主上下文随事件带」在
        # 增量C 定稿，引擎事件的 job 归属走 dispatch_facts/档案。
        return (projection_hub.HubClient.attach_local(hub, args.data_dir, port), '')

    stage = femo_bridge.build_stage(
        args=args, femo_root=femo_root,
        mailbox=mailbox, mail_courier=mail_courier, projection_hub=projection_hub,
        # 门铃（FEMO_PUSH_PORT）刻意不继承：壳环境里的铃是那一座壳的门，不是
        # 全城的门——daemon 投递按注册表上门（增量C），没注册的留柜自取
        # （who_move=customer_hook，与 zcode 自取语义同款）。
        push_url='',
        emit=_emit, send_response=_send_response, _trace=_trace,
        hub_connector=_hub_connector,
        engine_mode=True,
        doorbell_of=doorbells.url_of, doorbell_hosts=doorbells.doors,
        caller_host_of=lambda args_obj: (
            str(args_obj.get('_caller_host') or '') or None))
    jm_ref['jm'] = stage.jm

    def _cmd_route(hreq, path, body=b''):
        """POST /cmd/<cmd>：stdio 命令信封原样（清单§五：HTTP 面复用现有命令
        契约，另定 REST 等于重发明）。body={"id","cmd","args"}（cmd 以路径为
        准）；应答=stdio response 信封原样 JSON。恒返回 True（已自答）。"""
        cmd = path[len('/cmd/'):].strip('/')
        if not cmd:
            hreq._json(400, {'error': 'cmd path required (/cmd/<cmd>)'})
            return True
        try:
            req = json.loads(body.decode('utf-8')) if body else {}
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            hreq._json(400, {'error': 'bad json: %s' % exc})
            return True
        req = req if isinstance(req, dict) else {}
        if cmd in _STAGE_REJECTED:
            hreq._json(200, {"type": "response", "id": req.get('id'), "ok": False,
                             "error": "engine_stage_gate",
                             "detail": "引擎常驻化第2步：该命令的常驻语义（shutdown="
                                       "杀常驻还是适配器解挂）在增量C 定稿，暂不受理"
                                       "——响了拒绝，绝不静默。"})
            return True
        req_id = req.get('id')
        args_obj = req.get('args')
        if not isinstance(args_obj, dict):
            args_obj = {}
        # 清单词汇随命令注入（增量C）：壳把本宿主清单路径塞进 job_start/
        # job_resume 的 args——开跑前应用（单场并发禁令下无竞态），多宿主清单
        # 各随各场，不再是进程级全局词。
        if cmd in ('job_start', 'job_resume'):
            _mp = str(args_obj.get('_host_manifest') or '')
            if _mp and os.path.isfile(_mp):
                try:
                    femo_api.apply_host_manifest_file(_mp)
                except Exception as exc:
                    sys.stderr.write('femo_daemon: host manifest apply failed: %s\n' % exc)
        # daemon_shutdown（2026-09-29，webAdapter 侧栏「关闭服务」）：**立即散场**
        # 命令——散场裁决正身归引擎（门铃簿=「谁在线」的唯一权威账，闲时散场
        # 点名同源）。除调用方外还有别家宿主报着到（TTL 30s 内有心跳）就响亮
        # 拒绝，绝不替别人关灯；只剩自己（或别家已离线未续）才收场：先回执，
        # 再走闲时散场同款 settle_jobs 诚实挂起（stop→join→等 suspended 落盘
        # 确认），账落了 os._exit——磁盘账先落再退进程，与散场守卫同序。
        if cmd == 'daemon_shutdown':
            _caller = str(args_obj.get('_caller_host') or '') or args.host
            _others = [h for h in doorbells.hosts() if h != _caller]
            if _others:
                hreq._json(200, {"type": "response", "id": req_id, "ok": False,
                                 "error": "other_hosts_online",
                                 "detail": "还有其他宿主在线（%s），引擎不能散场——各家关各家的，别替别人关灯。"
                                           % '、'.join(_others)})
                return True
            # 先写一笔散场横幅再收尾（日志镜窗/日志文件里留痕）。
            sys.stderr.write('femo_daemon: %s 请求立即散场（最后一家宿主退场）——收场中…\n' % _caller)
            import femo_bridge                       # 同目录模块（装配段已排好 sys.path）
            _stopped = femo_bridge.settle_jobs(
                stage.jm, stage.workers, femo_api.bound_job_ids(),
                log_tag='daemon_shutdown 停场')
            hreq._json(200, {"type": "response", "id": req_id, "ok": True,
                             "result": {"bye": True, "stopped_jobs": _stopped}})
            try:
                sys.stderr.flush()
            except Exception:
                pass
            # 回执先干净出门（0.2s 让 HTTP 应答收尾），再退进程——直接 os._exit
            # 有 RST 掐断应答的风险，测试实测过连接类坑不差这一个。
            threading.Timer(0.2, lambda: os._exit(0)).start()
        # config_get / config_set（2026-09-30 设置中心刀）：数据根级设置的唯一
        # 读写口——宿主不各读各的 setting.json（两份逻辑必漂移），全走这里。
        # config_set 只准写本宿主的一格（_caller_host 与门铃登记同格，散场话
        # 同一身份纪律），写完立即 reconcile——设置按钮一发，窗当场显/隐。
        if cmd == 'config_get':
            import setting                        # 同目录（随本文件入 sys.path）
            hreq._json(200, {"type": "response", "id": req_id, "ok": True, "result": {
                "setting_file": setting.settings_path(femo_root),
                "console_window": setting.console_wishes(femo_root),
                "online_hosts": doorbells.hosts(),
                "console_visible": console_gate.is_showing() if console_gate else False,
                "muted": console_gate.muted if console_gate else True}})
            return True
        if cmd == 'config_set':
            _caller = str(args_obj.get('_caller_host') or '') or str(args.host or '')
            _key = str(args_obj.get('key') or '')
            _val = args_obj.get('value')
            if _key != 'console_window':
                hreq._json(200, {"type": "response", "id": req_id, "ok": False,
                                 "error": "unknown_setting_key",
                                 "detail": "现役设置键只有 console_window（收到 %r）" % _key})
                return True
            if _val not in ('show', 'hide'):
                hreq._json(200, {"type": "response", "id": req_id, "ok": False,
                                 "error": "bad_setting_value",
                                 "detail": "console_window 愿望只能是 show/hide（收到 %r）" % (_val,)})
                return True
            if not _caller:
                hreq._json(200, {"type": "response", "id": req_id, "ok": False,
                                 "error": "caller_required",
                                 "detail": "缺 _caller_host——写愿望必须报门铃登记同格的身份"})
                return True
            import setting                        # 同目录（随本文件入 sys.path）
            setting.set_console_wish(_caller, _val, femo_root)
            if console_gate:
                console_gate.reconcile(doorbells.hosts())
            sys.stderr.write('femo_daemon: setting console_window[%s]=%s（镜窗现%s）\n'
                             % (_caller, _val,
                                '显' if (console_gate and console_gate.is_showing()) else '隐'))
            hreq._json(200, {"type": "response", "id": req_id, "ok": True, "result": {
                "host": _caller, "wish": _val,
                "console_visible": console_gate.is_showing() if console_gate else False}})
            return True
        # shutdown 直待（增量C 定稿）：停**本宿主导演的**场次（runner.stop→
        # 诚实挂起，断点保留），常驻引擎不死——旧桥「停全场+进程退出」的常驻版；
        # 壳收到回执后自己退，daemon 继续站岗。
        if cmd == 'shutdown':
            _caller = str(args_obj.get('_caller_host') or '') or args.host
            # 停场收尾正身 settle_jobs（2026-09-29 收编：与闲时散场/回滚壳
            # shutdown 同吃一份；收编前本路只 join 不等账，回执可能先于落盘）。
            import femo_bridge                       # 同目录模块（装配段已排好 sys.path）
            _stopped = femo_bridge.settle_jobs(
                stage.jm, stage.workers, femo_api.bound_job_ids(),
                log_tag='shutdown stop', host_of=stage._job_host, host_filter=_caller)
            hreq._json(200, {"type": "response", "id": req_id, "ok": True,
                             "result": {"bye": True, "stopped_jobs": _stopped,
                                        "daemon": "alive"}})
            return True
        slot_key = str(req_id)
        with _slots_lock:
            _slots.pop(slot_key, None)
        try:
            stage.dispatch(req_id, cmd, args_obj)
        except Exception as exc:
            # dispatch 自身已兜 JobError 契约；此处只防「应答都没落」的暴炸
            with _slots_lock:
                _slots.setdefault(slot_key,
                                  {"type": "response", "id": req_id, "ok": False,
                                   "error": "daemon_internal", "detail": str(exc)})
        # 【2026-09-28 开演日志保尾（用户拍板）】新开演成功时把引擎日志截到
        # 最近 4MB：开演时清、跑完不清、下次开演再清；续跑不触发。失败只
        # 留痕不挡开演——日志维护不是演出语义。
        if cmd == 'job_start':
            with _slots_lock:
                _resp = _slots.get(slot_key)
            if _resp is not None and _resp.get('ok'):
                try:
                    _log_path = os.path.join(args.data_dir, 'logs', 'femo_daemon.log')
                    if _truncate_log_keep_tail(_log_path):
                        for _fd in (1, 2):
                            try:
                                os.lseek(_fd, 0, os.SEEK_END)   # 自家指针跟到新尾
                            except OSError:
                                pass                             # 终端/管道不可寻址：本就没写它
                except Exception as exc:
                    sys.stderr.write('femo_daemon: 开演日志保尾失败（不影响演出）：%s\n' % exc)
        with _slots_lock:
            resp = _slots.pop(slot_key, None)
        if resp is None:
            resp = {"type": "response", "id": req_id, "ok": False,
                    "error": "no_response",
                    "detail": "dispatch 未应答（命令-结果契约违例，B5 同款病）"}
        hreq._json(200, resp)
        return True

    def _engine_health(hreq, path, body=b''):
        try:
            bound = sorted(int(j) for j in femo_api.bound_job_ids())
        except Exception:
            bound = []
        hreq._json(200, {'ok': True, 'engine': True, 'stage': 'B',
                         'data': args.data_dir, 'port': port, 'host': args.host,
                         'host_name': stage.host_name, 'bound_jobs': bound,
                         'runners': sorted(stage.runners.keys()),
                         'workers': sorted(stage.workers.keys()),
                         'sse_clients': len(channel._clients),
                         # 进程内直连的机械证据：attach_local 挂了真身（remote
                         # 模式此值恒 None）——自环禁令的验收断言面。
                         'hub_inproc': bool(stage.hub is not None
                                            and stage.hub.hub is not None)})
        return True

    def _events_route(hreq, path, body=b''):
        """GET /engine/events（增量B）：SSE 直播+重放。?host=<宿主id>=归属闸
        （只收本场 host_refs 含该宿主的事件）；?since=<seq> 或 Last-Event-ID
        头=重放起点。帧形状见 _EngineEventChannel。"""
        u = urllib.parse.urlparse(hreq.path)
        q = urllib.parse.parse_qs(u.query)
        host = (q.get('host') or [''])[0] or None
        lie = hreq.headers.get('Last-Event-ID') or (q.get('since') or [''])[0]
        try:
            since = int(lie)
        except (TypeError, ValueError):
            since = 0
        hreq.send_response(200)
        hreq._cors()
        hreq.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        hreq.send_header('Cache-Control', 'no-store')
        hreq.end_headers()
        hreq.close_connection = True       # 连接-delimited：SSE 流到断开为止
        client_q = queue.Queue()
        channel.attach(client_q, host)
        try:
            for seq, env in channel.replay(since):
                hreq.wfile.write(channel.frame(seq, env, replay=True))
            hreq.wfile.flush()
            while True:
                try:
                    seq, env = client_q.get(timeout=_EngineEventChannel.HEARTBEAT_SEC)
                except queue.Empty:
                    hreq.wfile.write(b': heartbeat\n\n')
                else:
                    hreq.wfile.write(channel.frame(seq, env, replay=False))
                hreq.wfile.flush()
        except (ConnectionError, TimeoutError, OSError):
            pass                           # 订阅者撤了：正常离场
        finally:
            channel.detach(client_q)
        return True

    def _doorbell_route(hreq, path, body=b''):
        """POST /engine/doorbell（增量C）：壳代登记本宿主推送口——壳启动登记+
        每 10s 心跳续期，TTL 30s 过期=留柜自取。body={host,url}；url 空=注销。
        GET=诊断（?host= 查一格，无参回全表；hosts=活心跳全表含空门牌自取户
        ——web 点名对账「他宿主在不在」用，2026-09-30）。"""
        u = urllib.parse.urlparse(hreq.path)
        if hreq.command == 'POST':
            try:
                dreq = json.loads(body.decode('utf-8')) if body else {}
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                hreq._json(400, {'error': 'bad json: %s' % exc})
                return True
            dhost = str(dreq.get('host') or '')
            durl = str(dreq.get('url') or '')
            if not dhost:
                hreq._json(400, {'error': 'host required'})
                return True
            # 空门牌也登记（2026-09-27 闲时散场：报到即算在线——自取户没有
            # 收件口，但它的心跳是「宿主还活着」的证据）。url 空=留柜自取，
            # 投递语义不变（url_of 空=没门）。
            doorbells.register(dhost, durl)
            hreq._json(200, {'ok': True, 'host': dhost, 'registered': True})
            return True
        dq = urllib.parse.parse_qs(u.query)
        dhost = (dq.get('host') or [''])[0]
        hreq._json(200, {'host': dhost,
                         'url': doorbells.url_of(dhost) if dhost else None,
                         'doors': doorbells.doors(),
                         'hosts': doorbells.hosts()})
        return True

    hub.mount_route('POST', '/cmd/', _cmd_route)
    hub.mount_route('GET', '/engine/health', _engine_health)
    hub.mount_route('GET', '/engine/events', _events_route)
    hub.mount_route('POST', '/engine/doorbell', _doorbell_route)
    hub.mount_route('GET', '/engine/doorbell', _doorbell_route)
    sys.stderr.write('femo_daemon: 引擎已入列（第2步增量C）——/cmd 命令面、'
                     '/engine/health、/engine/events（SSE+归属闸）、'
                     '/engine/doorbell（门铃注册表）已挂载（host=%s）\n' % args.host)
    return stage, doorbells


# ── 管家开荒杂务（2026-09-28 拍板，chamberlain/AGENTS.md §三）──────────────
def _chamberlain_on_boot(data_dir):
    """引擎每次被拉起，顺手清一遍仓库 cache/ 的过期缓存（24h 保留期）。
    管家件=chamberlain/purge_cache.py（默认干跑，这里显式 --apply）。只认
    本仓库的 user_data 世界：data_dir 落在 <仓库根>/user_data 下才做——测试
    沙盒引擎（pytest-tmp、各家沙盒数据根）不管仓库杂务，测试开场 conftest
    自有清扫。杂务失败响亮进日志，绝不挡开演。"""
    repo_root = os.path.dirname(FEMO2HOST)
    world = os.path.join(repo_root, 'user_data') + os.sep
    if not os.path.abspath(data_dir).startswith(world):
        return
    script = os.path.join(repo_root, 'chamberlain', 'purge_cache.py')
    if not os.path.isfile(script):
        sys.stderr.write('femo_daemon: 管家件缺失（%s）——开荒杂务跳过\n' % script)
        return
    try:
        done = subprocess.run([sys.executable, script, '--apply'], timeout=120,
                              capture_output=True, text=True,
                              encoding='utf-8', errors='replace')
        sys.stderr.write('femo_daemon: 管家开荒杂务（cache 24h 清理）退出码 %s\n%s%s'
                         % (done.returncode, done.stdout or '', done.stderr or ''))
    except Exception as _exc:
        sys.stderr.write('femo_daemon: 管家杂务失败（不挡开演）：%s\n' % _exc)


def main():
    ap = argparse.ArgumentParser(description='femo_daemon（引擎常驻进程：hub+引擎）')
    ap.add_argument('--data-dir', required=True,
                    help='hub 数据目录（hub.json 所在；与 ProjectionHub data_dir 同口）')
    ap.add_argument('--host', default='daemon',
                    help='信箱 id（驿站 target_host 键）。daemon 不是宿主：产信收件'
                         '宿主按 job 档案 host_refs 解析（增量B），此值仅为装配段'
                         '接缝的占位自认')
    ap.add_argument('--host-name', default=None,
                    help='投影自称（多实例）；daemon 交空=裸跑语义（增量B 接帧上下文）')
    ap.add_argument('--host-manifest', default=None,
                    help='宿主能力清单 JSON（增量A透传；多宿主词汇入注册表=增量C）')
    ap.add_argument('--db', default=os.environ.get('FEMO_DB_PATH') or None,
                    help='账本 DB 覆盖（测试沙盒用；缺省=数据根默认库；'
                         '增量C：壳以 FEMO_DB_PATH 环境接力，代拉时随 env 继承）')
    ap.add_argument('--no-engine', action='store_true',
                    help='只养 hub（回退 v0 形态；引擎收编排障用逃生口）')
    ap.add_argument('--no-console', action='store_true',
                    help='不开桌面控制台窗（测试沙盒静音；也可设 '
                         'FEMO_DAEMON_CONSOLE=0；已在终端手动跑时本来就不开）')
    args = ap.parse_args()
    os.makedirs(args.data_dir, exist_ok=True)

    sys.path.insert(0, os.path.dirname(FEMO2HOST))             # 仓库根入查找路径
    from femo2host import projection_hub                       # 模块本名（引擎装配传参用）
    from femo2host.projection_hub import ProjectionHub, start_hub_server

    # 先到开庙：账上有活 hub 就不留第二座（代拉方多半是竞态的第二只手）
    addr = _read_addr(args.data_dir)
    if addr and _probe(addr, data_dir=args.data_dir):
        sys.stderr.write('femo_daemon: 活 hub 已在 %s:%s（pid=%s）——本进程自退，'
                         '一座数据根只养一座。\n'
                         % (addr.get('host') or '127.0.0.1', addr.get('port'),
                            addr.get('pid') or '?'))
        return 0

    hub = ProjectionHub(data_dir=args.data_dir)
    # 绑定先于写账，账由收口循环按探活裁决写（2026-09-28 镜窗成群事故收口）：
    # 旧法绑定即无条件覆写账、再睡 1.5s 看「账上是不是自己的 pid」——并发出生
    # 时最后写者必读到自己的 pid 直接放行，一波孪生全员开张、各开各的镜窗。
    port = start_hub_server(hub, write_ledger=False)
    if not _claim_ledger(args.data_dir, port):
        return 0                                    # 让贤：活 hub 已在，本进程自退

    sys.stderr.write('femo_daemon: hub 常驻 http://127.0.0.1:%d/ (pid=%s, data=%s)\n'
                     % (port, os.getpid(), args.data_dir))

    # 管家开荒杂务：引擎每次被拉起（赢下收口闸的本座，让贤的孪生不清），
    # 顺手清一遍仓库过期缓存。后台线程做，开演不等杂务。
    threading.Thread(target=_chamberlain_on_boot, args=(args.data_dir,),
                     name='chamberlain-on-boot', daemon=True).start()

    # 镜窗（2026-09-30 设置中心刀）：出生不再无条件开窗——可见性归闸管
    # （愿望∩在线，缺省隐藏），这里只把日志文件立起来、把闸立起来；轮询
    # 线程等引擎装配完（拿到门铃簿）再起。--no-engine 是人守着的排障形态，
    # 不起轮询（镜窗不参与，看日志走文件/终端）。
    log_dir = os.path.join(args.data_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, 'femo_daemon.log')
    open(log_path, 'ab').close()
    doorbells = _DoorbellRegistry()         # 上提：闸与装配同吃一本门铃簿
    console_gate = _ConsoleGate(_resolve_femo_root(), log_path,
                                disabled=args.no_console)

    if args.no_engine:
        sys.stderr.write('femo_daemon: --no-engine：只养 hub（v0 形态）。\n')
        try:
            while True:
                time.sleep(3600)                    # 排障逃生口：人守着，不参与散场
        except KeyboardInterrupt:
            pass
        return 0

    # 引擎收编：装配失败大声炸（进程退出，看门者代拉）——绝不降级静默续命
    # 兄弟件三 try（桥同款：缺件不挡 hub，引擎装配里照旧判空降级）
    mailbox = mail_courier = None
    try:
        from femo2host import mailbox               # 驿站（产信/出站轮询的柜子）
    except Exception as _exc:
        sys.stderr.write('femo_daemon: mailbox unavailable: %s\n' % _exc)
    try:
        from femo2host import mail_courier          # 投递员（增量C 接门铃注册表）
    except Exception as _exc:
        sys.stderr.write('femo_daemon: mail_courier unavailable: %s\n' % _exc)

    def _assembling(hreq, path, body=b''):
        hreq._json(200, {'ok': True, 'engine': False, 'stage': 'assembling',
                         'data': args.data_dir})
        return True
    hub.mount_route('GET', '/engine/health', _assembling)
    stage, doorbells = _assemble_engine(args, hub, port, mailbox, mail_courier,
                                        projection_hub, doorbells=doorbells,
                                        console_gate=console_gate)
    console_gate.start_poller(doorbells.hosts)   # 0.5s 盯 setting.json + 在线交集

    # 闲时散场（2026-09-27 二次拍板）：点名门铃簿，全空满宽限即散场。
    # running 但宿主全离线的场不陪死等——停场诚实挂起（信柜/断点留盘，回来
    # 续跑收养在柜信）；挂起档在场不影响退场。宽限防宿主重启间隙误杀。
    from femo2host import femo_api
    _GRACE = float(os.environ.get('FEMO_DAEMON_IDLE_GRACE_SEC') or 60)
    _PERIOD = float(os.environ.get('FEMO_DAEMON_WATCHDOG_PERIOD_SEC') or 30)
    last_alive = time.monotonic()                   # 出生即起算：刚醒簿子空不算离线
    try:
        while True:
            time.sleep(_PERIOD)
            if doorbells.hosts():
                last_alive = time.monotonic()
                continue
            if time.monotonic() - last_alive < _GRACE:
                continue
            # 停场收尾正身 settle_jobs（2026-09-29 收编）：stop→join→等
            # suspended 落盘确认——退进程前必须确认账落了（stop→协程取消→
            # on_state_change 是异步链，状态机单一来源=回调）。
            import femo_bridge                       # 同目录模块（装配段已排好 sys.path）
            stopped = femo_bridge.settle_jobs(stage.jm, stage.workers,
                                              femo_api.bound_job_ids(),
                                              log_tag='散场停场')
            sys.stderr.write('femo_daemon: 全宿主离线已满 %ds——引擎散场（诚实挂起 %s；'
                             '信柜与断点原样留盘，回来续跑即收养）。\n'
                             % (int(_GRACE), stopped or '无（纯闲）'))
            try:
                sys.stderr.flush()
            except Exception:
                pass
            os._exit(0)                             # 磁盘账已落（shutdown 同款 os._exit 先例）
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == '__main__':
    sys.exit(main())
