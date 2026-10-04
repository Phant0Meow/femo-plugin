#!/usr/bin/env python3
"""mail_courier.py — 驿站投递员（who_move=system_push 的送货上门，2026-09-16）。

用户的原始设计兑现：mailbox 负责把消息发给宿主，两条链路——
  ①送货上门（system_push）：本投递员直接调宿主的接收口（dsh 的
    /femo-plugin/mailbox-push）；
  ②留柜自取（customer_hook）：宿主不支持直呼（zcode），信压柜等 Stop 钩子来取。
投递员是驿站的雇员，随桥上班（桥是唯一常驻驿站旁的进程）；它只认识
「往哪个门牌送、怎么记账」，不懂 femo 业务语义（面单附件由桥随包附带）。

时序契约（防双投/防丢，2026-09-16 定稿）：桥产信后**先投递后发事件**——
投递员送达（宿主回执 200，宿主在回执前已登记「已喊/已参与」）或投递失败
（信留柜 pending）之后，对应事件才发给宿主。宿主事件现场查簿：push 已办
就跳过，没办（push 失败）就走事件数据/collect 兜底——两侧天然互斥，无竞态。

记账：withdraw 取包不记账（信仍在柜，送丢还有底）；送达回执后逐封
mark_delivered(via='system_push')。投递失败零动作（pending=宿主兜底可拉）。
"""

import json
import os
import sys
import urllib.request

try:
    from femo2host import mailbox
except Exception as _exc:  # 信箱不可用则投递员不挂牌（桥照常运行）
    mailbox = None
    sys.stderr.write(f"mail_courier: mailbox unavailable: {_exc}\n")


def push_url_from_env():
    """上门地址：FEMO_PUSH_PORT（宿主拉桥时注入；缺省空=未挂铃铛，自取模式）。"""
    port = os.environ.get('FEMO_PUSH_PORT', '')
    if not port.isdigit():
        return ''
    return f'http://127.0.0.1:{int(port)}/femo-plugin/mailbox-push'


def _post(url, body, timeout=3.0):
    req = urllib.request.Request(
        url, data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json; charset=utf-8'}, method='POST')
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return 200 <= resp.status < 300


def deliver(push_url, letters, extra=None):
    """上门投递一包信（letters=信体数组，extra=面单附件原样随包）。
    返回 True=送达并记账；False=投递失败（信留柜，宿主兜底会拉到）；
    None=宿主未挂铃铛（customer_hook 自取模式，不跑腿）。
    extra=None 且单信投递时回落信上存储的 push_extra（2026-09-24 面单入库：
    桥产信时面单随信存进驿站，重投据此重建完整包裹——旧洞=重投裸信被宿主
    丢弃却记送达=信账两清）；多信整包面单是包级的，仍由调用方显式传。"""
    if not push_url:
        return None
    if not letters:
        return True
    if mailbox is None:
        return False
    if extra is None and len(letters) == 1:
        extra = letters[0].get('push_extra') if isinstance(letters[0], dict) else None
    try:
        ok = _post(push_url, {'letters': letters, **(extra or {})})
    except Exception as exc:
        sys.stderr.write(f"mail_courier: push failed ({len(letters)} letter(s)): {exc}\n")
        return False
    if not ok:
        sys.stderr.write(f"mail_courier: push rejected ({len(letters)} letter(s))\n")
        return False
    for x in letters:
        try:
            mailbox.mark_delivered(x['id'], 'system_push')
        except Exception as exc:
            sys.stderr.write(f"mail_courier: mark_delivered failed: {exc}\n")
    return True


def deliver_pack(push_url, host, job_id, extra=None, soul=mailbox.MAIN if mailbox else 'main'):
    """终局整包上门：withdraw 本 Job 给 soul 的信包（终局急件+已放行滞留件，
    取包不记账）→ 送达后逐封清账。空包不跑腿（返回 True）。"""
    if not push_url:
        return None
    if mailbox is None:
        return False
    letters = mailbox.withdraw(host, soul=soul, job_id=job_id)
    if not letters:
        return True
    return deliver(push_url, letters, extra)


def retry_pending(push_url, host, min_age_seconds=5):
    """重投没送到的 urgent 收件信（2026-09-23 修邮差，十连裁②⑩配套）：单通道
    后宿主不再兜底，送失的信由投递员自己重送直到送达为止（回执即清账）。
    mailbox.pending_urgent 自带年龄门槛，防「事件线程正在投」的毫秒窗口双投。
    逐封重投（2026-09-24 面单入库配套）：单信投递回落信上存储的 push_extra
    ——面单随信走，重投的包裹与首投同形（旧版裸信重投会被宿主丢弃）。
    返回本次重投的信数（0=没有欠账）。"""
    if not push_url or mailbox is None:
        return 0
    letters = mailbox.pending_urgent(host, min_age_seconds)
    for x in letters:
        deliver(push_url, [x])
    return len(letters)
