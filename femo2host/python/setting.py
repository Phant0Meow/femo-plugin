"""setting.py — FEMO 数据根级设置中心（setting.json 的唯一读写口）。

setting.json（2026-09-30 设置中心刀）住数据根：FEMO_DATA_DIR 沙盒优先，否则
<FEMO_ROOT>/user_data（mailbox.py 同口径）——整个数据根搬走它跟着走，测试
沙盒天然各用各的。引擎（femo_daemon 的 /cmd/config_get、/cmd/config_set）是
唯一权威读写口，宿主不各读各的文件（同样的逻辑写两份必然漂移）；手工编辑
容错：坏值响亮留痕后按缺省算、绝不静默吞，也不炸读者——但 set_* 遇到读不
出来的现状会拒绝覆盖（保住手编的其余内容，交调用方裁决）。

现役键（平铺；缺省与校验都住本模块，新设置在这里登记）：
  console_window: {<宿主格>: "show"|"hide"} — 各宿主对日志镜窗的愿望。
      聚合裁决归引擎（femo_daemon._ConsoleGate）：在线（门铃簿活心跳）且
      任一人 show 才显示——显示大于隐藏，缺省（没格/hide/文件不存在）=隐藏。
      FEMO_DAEMON_CONSOLE=0 / --no-console / 终端手动跑在引擎侧永远静音，
      压过一切愿望（测试沙盒的安静靠 env，绝不能被配置翻盘）。
"""

import json
import os
import sys
import tempfile

FEMO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SET_FILE_NAME = 'setting.json'
CONSOLE_SHOW = 'show'
CONSOLE_HIDE = 'hide'
_CONSOLE_VALUES = (CONSOLE_SHOW, CONSOLE_HIDE)

_warned_sig = None        # 同一份文件内容的告警只发一轮（0.5s 轮询防刷屏）


def data_root(femo_root=None):
    """数据根：FEMO_DATA_DIR 优先（租户边界，mailbox/projection 同口径），
    否则 <FEMO_ROOT>/user_data。femo_root 缺省读 FEMO_ROOT env，再退本文件
    位置反推的仓库根。"""
    root = femo_root or os.environ.get('FEMO_ROOT') or FEMO_ROOT
    if os.environ.get('FEMO_DATA_DIR'):
        return os.environ['FEMO_DATA_DIR']
    return os.path.join(root, 'user_data')


def settings_path(femo_root=None):
    return os.path.join(data_root(femo_root), SET_FILE_NAME)


def file_signature(femo_root=None):
    """(mtime_ns, size) 或 None（无文件）——轮询线程的改动探测信号。"""
    try:
        st = os.stat(settings_path(femo_root))
    except OSError:
        return None
    return (st.st_mtime_ns, st.st_size)


def _read_raw(femo_root=None):
    """读原始 dict。文件不存在/空=({}, None)；坏 JSON/坏根类型=(None, 原因)。"""
    path = settings_path(femo_root)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            text = f.read()
    except FileNotFoundError:
        return {}, None
    except OSError as exc:
        return None, '读不到 %s：%s' % (path, exc)
    if not text.strip():
        return {}, None
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        return None, 'setting.json 不是合法 JSON（%s）' % exc
    if not isinstance(data, dict):
        return None, 'setting.json 顶层必须是对象（拿到 %s）' % type(data).__name__
    return data, None


def load(femo_root=None):
    """全量设置；坏文件响亮留痕后当空（手工编辑容错，不炸读者）。"""
    data, err = _read_raw(femo_root)
    if err:
        sys.stderr.write('setting: %s——按缺省算\n' % err)
        return {}
    return data


def console_wishes(femo_root=None):
    """镜窗愿望：{宿主格: show|hide}。坏型/坏值丢弃并留痕（同一份文件内容
    只告警一轮，防 0.5s 轮询刷屏）；合法条目照常返回，一颗老鼠屎不倒整锅。"""
    global _warned_sig
    data = load(femo_root)
    raw = data.get('console_window')
    if raw is None:
        return {}
    sig = file_signature(femo_root)
    quiet = (sig == _warned_sig)
    out = {}
    drops = []
    if not isinstance(raw, dict):
        drops.append('console_window 必须是对象（拿到 %s），整键弃用' % type(raw).__name__)
    else:
        for host, val in raw.items():
            if val in _CONSOLE_VALUES:
                out[str(host)] = val
            else:
                drops.append('console_window[%r]=%r 不是 show/hide，弃用' % (host, val))
    if drops and not quiet:
        for line in drops:
            sys.stderr.write('setting: %s\n' % line)
        _warned_sig = sig
    return out


def set_console_wish(host, value, femo_root=None):
    """写本宿主一格愿望，保留他人格与未知顶层键。原子写（临时文件+os.replace，
    hub.json 同款）——轮询线程永远读不到半截。读不出现状（坏 JSON 等）=拒绝
    覆盖并抛 RuntimeError；非法 value/host=ValueError（命令面已校验，这是
    底线闸）。返回落盘路径。"""
    if value not in _CONSOLE_VALUES:
        raise ValueError('console_window 愿望只能是 show/hide，拿到 %r' % (value,))
    host = str(host or '').strip()
    if not host:
        raise ValueError('宿主格必填（caller 身份，门铃登记同格）')
    data, err = _read_raw(femo_root)
    if err:
        raise RuntimeError('setting.json 现状读不出来，拒绝覆盖：%s' % err)
    cw = data.get('console_window')
    if not isinstance(cw, dict):
        cw = {}
    cw[host] = value
    data['console_window'] = cw
    path = settings_path(femo_root)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.setting-', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write('\n')
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return path


def console_should_show(online_hosts, wishes):
    """聚合纯函数（裁决正身）：在线 ∧ 任一人 show。显示大于隐藏——没人 show
    （没格/hide/不在线/空册）就是隐藏。"""
    for host in online_hosts or ():
        if wishes.get(str(host)) == CONSOLE_SHOW:
            return True
    return False
