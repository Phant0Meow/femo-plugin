"""mailbox.py — 驿站（纯消息路由，零引擎依赖）。

世界只有两个角色：驿站（攥着全流程与全部历史）和客户（有需求，来请求和收取）。
一封信由八个维度完全描述（2026-09-15 作者定稿，一维度一格，全部随信走）：
  0. delivery     急件 urgent / 滞留件 held（滞留件压站，同单急件进箱一起放行）
  1. action       寄件 send / 收件 receive
  2. who_move     system_push（驿站送货上门）/ customer_hook（客户跑到站）
  3. who_require  customer_require（客户索要）/ system_require（系统发起）
  4. kind         上下文 context（带参数）/ 发言 speech / 通知 notice
  5. target_host  指定宿主（必填，不留空）
  6. soul         客户 soul id（'main'=主模型；窗挂客户名下 <soul>_viewwindow）
  7. node         节点名（随信说明书，不参与路由）
随信附属：job_id（哪场戏）/ payload（内容本体）/ ref（凭据号 wait_key）/
status（待取 pending → 送达 delivered → 清账 consumed；拒收=死信 dead 留档，
2026-09-26 刀0 起）。

八宫格在用三格：节点发言（寄件+system_require+speech）、节点上下文（收件+
system_require+context）、终局通知（收件+system_require+notice）；warning=
滞留件通知。其余留座不占代码。节点发言两阶段：①收信（驿站投 context，客户
到站取）②发信（客户寄 speech，驿站转交远端、清账）。

驿站动词：post(信进站) / receive(客户到站收件) / drain_outgoing(寄件出站交
远端) / mark_consumed(远端清账) / mark_dead(远端拒收，死信终态)。驿站不认识
宿主实现细节，也不碰引擎。
"""

import json
import os
import sys
import time
import argparse
from contextlib import contextmanager

FEMO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 数据根：FEMO_DATA_DIR 优先（测试/多实例沙盒隔离，与桥 --db 同一口径）——
# 否则测试的信漏进生产信箱，被 Stop 钩子当真通知注入会话（2026-09-15 实锤）。
if os.environ.get('FEMO_DATA_DIR'):
    MAILBOX_DIR = os.path.join(os.environ['FEMO_DATA_DIR'], 'femo', 'mailbox')
else:
    MAILBOX_DIR = os.path.join(FEMO_ROOT, 'user_data', 'mailbox')
MAILBOX_FILE = os.path.join(MAILBOX_DIR, 'mailbox.json')
LOCK_FILE = MAILBOX_FILE + '.lock'
MAX_LETTERS = 500
MAIN = 'main'
ENGINE = 'engine'
KINDS = ('context', 'speech', 'notice')
STALE_LOCK_SECONDS = 10.0   # 锁龄超过此值判陈旧（正常持锁毫秒级；拖 2s 已是病态）


def _load():
    if not os.path.exists(MAILBOX_FILE):
        return {'letters': []}
    try:
        box = json.load(open(MAILBOX_FILE, encoding='utf-8'))
    except Exception:
        return {'letters': []}
    # 旧格式信（八维信封定稿前的存量 mailbox.json）缺 delivery 等维度，
    # 路由/计数会 KeyError——直接丢弃（信是通知不是账本，宁缺勿卡），响亮留痕。
    legacy = [x for x in box.get('letters', []) if 'delivery' not in x]
    if legacy:
        sys.stderr.write(f"mailbox: dropped {len(legacy)} legacy-format letter(s)\n")
        box['letters'] = [x for x in box['letters'] if 'delivery' in x]
        try:
            _save(box)
        except Exception:
            pass
    return box


def _save(box):
    os.makedirs(MAILBOX_DIR, exist_ok=True)
    tmp = MAILBOX_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(box, f, ensure_ascii=False, indent=1)
    os.replace(tmp, MAILBOX_FILE)


@contextmanager
def _locked():
    """跨进程文件锁（O_EXCL 抢锁 + 陈旧锁自愈 + 超时强闯）。

    2026-09-17 j1695 事故加固：旧实现 2s 抢不到就无锁强闯，但强闯后**不删
    锁文件**——若上次持锁进程异常退出（0 字节锁残留），此后所有进程永远
    强闯，并发读改写互相覆盖（Eve 的投票信即此丢失）。现在：
    ① 抢锁超时后检查锁龄（mtime 距今），超过 STALE_LOCK_SECONDS 判陈旧、
      删除重抢——一次进程异常不再永久瘫痪互斥；
    ② 强闯是最后手段（陈旧判定失败才走），且强闯前留响亮 stderr 痕。
    正常路径（锁干净时）行为与旧版完全一致（毫秒级抢锁，零额外开销）。"""
    os.makedirs(MAILBOX_DIR, exist_ok=True)
    fd = None
    for _ in range(50):
        try:
            fd = os.open(LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except FileExistsError:
            pass                  # 锁在那儿：这一拍没抢到 → 走下面的等锁/陈旧自愈
        except OSError as exc:
            # 【2026-09-19 实锤·FEMO脚本卡死级】Windows 上 O_CREAT|O_EXCL 撞到一个
            # **正被删除**的锁，抛的是 PermissionError(WinError 5)，**不是**
            # FileExistsError——旧代码只捕前者，异常直接穿透 _locked()，一路顶到
            # femo_bridge.dispatch → deliver_error，主模型交卷失败、整场挂起
            # （job 1927：[看牌] 节点，主 agent 明明答了却报「回传失败」）。
            # 语义与 FileExistsError 相同：文件在那儿、这一拍没抢到 → 继续等。
            if not os.path.exists(LOCK_FILE):
                continue          # 其实已被释放：立刻下一拍抢
            sys.stderr.write(f"mailbox: lock contended ({exc.__class__.__name__}): "
                             f"{LOCK_FILE}\n")
        try:
            age = time.time() - os.stat(LOCK_FILE).st_mtime
        except OSError:
            continue              # 锁刚被释放：下一拍抢
        if age > STALE_LOCK_SECONDS:
            # 陈旧锁（持锁进程已死）：删除重抢。竞态下 remove 失败=别人
            # 先删先抢，照常下一拍；删成+再抢失败=别人抢到，照常等。
            try:
                sys.stderr.write(
                    f"mailbox: stale lock ({age:.1f}s old) removed: {LOCK_FILE}\n")
                os.remove(LOCK_FILE)
            except OSError:
                pass
        time.sleep(0.05)
    if fd is None:
        sys.stderr.write(
            f"mailbox: lock timeout after 2.5s, entering WITHOUT lock "
            f"(concurrent write risk): {LOCK_FILE}\n")
        yield
        return
    try:
        os.close(fd)
        yield
    finally:
        try:
            os.remove(LOCK_FILE)
        except OSError:
            pass


def _prune(letters):
    letters[:] = [x for x in letters if x['status'] == 'pending'] + \
                 [x for x in letters if x['status'] != 'pending'][-100:]
    if len(letters) > MAX_LETTERS:
        del letters[:len(letters) - MAX_LETTERS]


def last_step_reply(steps):
    """读交卷体的台词：steps 末步的 reply（2026-09-27 定形——台词唯一正身）。

    【output 字段退役】执行体交卷体从此是 {steps, model_id?}：台词只住在
    分步表末步的 reply 键里，不再另发一份 output（旧的 {output, steps?} 形态
    在读方按兼容容忍）。一个回合按序发生：先思考、（可能）用工具、最后开口
    ——说话永远在末步，所以读末步。JS 侧同款=speech-core.mjs 的 lastStepReply
    （两语言一对孪生，改形态两处同改）。steps 非列表/末步非字典/没填 reply
    = 空串。"""
    if not isinstance(steps, list) or not steps:
        return ''
    last = steps[-1]
    if not isinstance(last, dict):
        return ''
    return str(last.get('reply', '') or '')


def post(*, job_id, soul, kind, payload, action, delivery, who_move,
         who_require, target_host, target_sid=None, node=None, ref=None,
         subkind=None, body=None, push_extra=None):
    """信进驿站。八字段一维一格，全部显式必填。随信说明书四件（均不参与路由）：
    subkind（'error'/'warning'，停下打包分桶）、body（speech 信的引擎交卷体
    完整字典 {steps, model_id?}（执行体；**末步 reply=台词**，output 字段已
    退役且无兼容读——信上带了也一律无视，handin 时由桥按 last_step_reply
    派生注入引擎交接面）或 {chat_text, variables}（人类席）。
    手写信（CLI send 只填 payload）由桥按 soul 兜底选词（human/@角色→
    chat_text，其余→合成单步），零负担）、
    push_extra（2026-09-24 面单入库：投递员上门时随包附上的面单
    {brief}/{retry}/…——**随信存储**，重投（retry_pending）据此重建完整包裹；
    旧洞=面单只活在产信现场闭包，重投裸信被宿主丢弃却记送达=信账两清）、
    node。返回整封信。
    【双词寻址（2026-09-26 引擎常驻化刀2）】target_sid=收件会话号（结构化
    第二词，随信入账）：收件方向的自取对号用（receive 按 it 对号），不搞
    「host:sid」地址拼词——拼词会漏进 dispatch_facts 把投影归属弄脏。
    发件方向（speech 交卷）不按会话路由，target_sid 恒空。"""
    assert kind in KINDS, f'unknown kind: {kind}'
    assert delivery in ('urgent', 'held'), delivery
    assert action in ('send', 'receive'), action
    assert who_move in ('system_push', 'customer_hook'), who_move
    assert who_require in ('customer_require', 'system_require'), who_require
    assert target_host, 'target_host 必填（不留空）'
    letter = {
        'id': f'{int(time.time() * 1000):x}-{os.urandom(3).hex()}',
        'job_id': job_id,
        'delivery': delivery,          # 0
        'action': action,              # 1
        'who_move': who_move,          # 2
        'who_require': who_require,    # 3
        'kind': kind,                  # 4
        'target_host': target_host,    # 5
        'target_sid': str(target_sid) if target_sid else None,  # 5b 收件会话号（刀2）
        'soul': soul,                  # 6
        'node': node,                  # 7
        'payload': payload, 'ref': ref, 'subkind': subkind, 'body': body,
        'push_extra': push_extra,
        'status': 'pending',
        'created_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'posted_at': time.time(),      # 修邮差：重投年龄门槛用（防产信投递窗口双投）
        'sent_at': None, 'sent_via': None,
    }
    # 写后校验（2026-09-17 j1695 事故）：post 的「读-改-写」在无锁强闯下会
    # 被并发写覆盖（整文件覆盖，后写者赢）。落盘后回读确认自己的信（按 id）
    # 还在，不在则重试（重新读-改-写）——最多 3 次，仍失败则响亮报错（调用
    # 方桥侧 post_speech 拿到异常，不再回假 ok）。有锁路径零额外读（校验
    # 在锁内做，一次 _save 后立即 _load 复核即可）。
    for attempt in range(3):
        with _locked():
            box = _load()
            box['letters'].append(letter)
            _prune(box['letters'])
            _save(box)
            # 校验与写入在同一锁窗口内：锁正常时必然通过（无人能插进来覆盖）；
            # 无锁强闯时可能失败（被并发 _save 覆盖）→ 出锁重试。
            if any(x.get('id') == letter['id'] for x in _load()['letters']):
                break
        sys.stderr.write(
            f"mailbox: post verify failed (attempt {attempt + 1}/3, letter {letter['id']}) — retrying\n")
    else:
        raise RuntimeError(
            f"mailbox post failed: letter {letter['id']} lost after 3 attempts "
            f"(concurrent overwrite suspected)")
    return letter


def pending_urgent(host, min_age_seconds=5):
    """没送到的 urgent 收件信（2026-09-23 修邮差，十连裁②⑩配套）：status=
    pending、action=receive、delivery=urgent、target_host=本宿主，且在柜时间
    ≥min_age_seconds——年龄门槛防重投竞态（事件线程产信后正在投递的毫秒窗口
    里，轮询线程不得看见同一封信）。只读不记账；重投送达由投递员回执逐封
    mark_delivered。旧信无 posted_at 视为够老（照重投）。"""
    now = time.time()
    out = []
    with _locked():
        box = _load()
        for x in box['letters']:
            if x['status'] != 'pending' or x['action'] != 'receive':
                continue
            if x.get('delivery') != 'urgent' or x.get('target_host') != host:
                continue
            if now - float(x.get('posted_at') or 0) < min_age_seconds:
                continue
            out.append(dict(x))
    return out


def _released(x, letters):
    """滞留件放行：同单同客户的急件已在驿站（不论是否被领），滞留件即解禁。"""
    if x['delivery'] != 'held':
        return True
    return any(y['job_id'] == x['job_id'] and y['soul'] == x['soul']
               and y['delivery'] == 'urgent' for y in letters)


def _sid_ok(letter, session) -> bool:
    """自取对号（刀2）：双方都带号→精确相等才中（隔壁窗口领不走别人 main 的
    信——2585 李鬼病根）；信无号（旧信）→宿主级匹配（老行为，旧信照取）；
    调用方不带号（未刷新的旧钩子/CLI）→放行=今天的行为（不回归；该调用方
    刷新后自然进入严格对号）。"""
    lsid = letter.get('target_sid')
    if not lsid:
        return True
    if not session:
        return True
    return str(session) == str(lsid)


def _iter_receive_matches(box, host, *, soul, kind, job_id, session, check_sid):
    """收件过滤正身（2026-09-29 单源收编：receive/withdraw 此前各抄一遍过滤
    链，已在侧夜哨兵误醒事故里证明「谓词多一处抄写多一处漂移」）。锁内调用；
    yield 信本体——消费方在锁内改状态（receive）或取抄本（withdraw）。
    check_sid=False 供投递员口（宿主级门牌，不做会话对号）。"""
    for x in box['letters']:
        if x['status'] != 'pending' or x['action'] != 'receive':
            continue
        if x['target_host'] != host:
            continue
        if check_sid and not _sid_ok(x, session):
            continue
        if soul is not None and x['soul'] != soul:
            continue
        if kind is not None and x['kind'] != kind:
            continue
        if job_id is not None and x['job_id'] != job_id:
            continue
        if not _released(x, box['letters']):
            continue
        yield x


def receive(host, *, soul=MAIN, kind=None, job_id=None, session=None):
    """客户到站收件：取走 action='receive' 且属于自己（target_host 精确匹配）
    的待取信（取走即记送达）。soul/kind/job_id=None 表示不过滤。job_id 过滤
    供宿主「代取」口用（桥 collect_notices）：只取本 Job 的信包——宿主崩溃
    在取件前时旧 Job 的信压站，不过滤会在下一次停下时被一并捞走串场。
    session（刀2 自取对号）：信带会话号须精确相等才中、信无号宿主级匹配
    （见 _sid_ok）。滞留件按放行规则（同 Job 同 soul 的急件在箱即解禁，与
    job_id 过滤天然相容：滞留件本来就只被本 Job 的急件放行）。"""
    out = []
    with _locked():
        box = _load()
        for x in _iter_receive_matches(box, host, soul=soul, kind=kind,
                                       job_id=job_id, session=session,
                                       check_sid=True):
            x.update(status='delivered', sent_at=time.strftime('%Y-%m-%d %H:%M:%S'), sent_via=host)
            out.append(dict(x))
        if out:
            _save(box)
    return out


def withdraw(host, *, soul=MAIN, job_id=None, session=None):
    """投递员取包（system_push 专用，2026-09-16 上门投递落地）：取出本宿主
    的待取信（急件+已放行滞留件，过滤口径与 receive 完全一致）但**不改状态**——
    信仍在柜中 pending；投递员送达（宿主回执）后逐封 mark_delivered(id,
    'system_push')，失败则什么都不做（信原样留柜，宿主侧事件兜底会拉到）。
    与 receive 的分工：receive=客户到站取走即记送达（客户亲手拿走）；
    withdraw=投递员先抄走包裹去送、送达才记账（送丢了柜里还有底）。
    session（刀2）：投递员是宿主自己的腿、门是宿主级的（会话级门牌第 2 步
    登记簿才有）——缺省不过滤，**不做** receive 的严格对号。"""
    out = []
    with _locked():
        box = _load()
        for x in _iter_receive_matches(box, host, soul=soul, kind=None,
                                       job_id=job_id, session=None,
                                       check_sid=False):
            out.append(dict(x))
    return out


def drain_outgoing(host, only_job_ids=None, all_hosts=False):
    """寄件出站：把寄给本宿主（target_host 精确匹配）的 action='send' 信整批
    交远端。**必须按 target_host 过滤**——两座桥共用同一信箱时，不看出站的
    目标就会把别家桥的发言信吃掉，台词直接丢失。桥按 ref（凭据号）对号入座
    喂引擎；喂不进的由调用方记死信并记日志。
    【出站认领纪律（2026-09-26，引擎常驻化刀0）】only_job_ids 非 None 时只
    交出这些场次的信（None=不过滤，CLI 零变化）。出站口是「喂引擎」的入口，
    而多宿主并存时全城引擎各有其主——不养这场戏的桥在结构上就不许捞走别家
    的回信（job 2585 实锤：野桥捞走销账，引擎空等 3600s 空放散场）。被过滤
    的信原样留柜 pending，等养它的那座桥来捞。
    【all_hosts（2026-09-26 第2步增量B，daemon 信柜管家专用）】常驻引擎一座
    进程养全场（bound=全数据根的场次），本场次的回信无论寄到哪个宿主格都归
    它喂——不再按 target_host 过滤。认领纪律仍由 only_job_ids 站岗；裸
    all_hosts（无 only_job_ids）=全城乱捞，响亮拒绝。
    【退回重投（2026-10-07，j2717 文件锁吞信事故）】投递遇瞬时错误被 requeue
    退回的信带 retry_not_before（退避到点时刻），未到点不出站——邮差的「过会
    再来一趟」，避免对同一把没松的锁热循环。"""
    if all_hosts and only_job_ids is None:
        raise ValueError('drain_outgoing: all_hosts 必须与 only_job_ids 同用'
                         '（认领纪律是唯一防乱捞的闸）')
    out = []
    with _locked():
        box = _load()
        for x in box['letters']:
            if x['status'] == 'pending' and x['action'] == 'send' \
                    and (all_hosts or x['target_host'] == host) \
                    and float(x.get('retry_not_before') or 0) <= time.time():
                if only_job_ids is not None and x.get('job_id') not in only_job_ids:
                    continue
                x.update(status='delivered', sent_at=time.strftime('%Y-%m-%d %H:%M:%S'), sent_via='station')
                out.append(dict(x))
        if out:
            _save(box)
    return out


def pending_out_by_ref(ref):
    """出站口「同凭据在柜未捞」查询（2026-10-08 寄出帧重发的幂等闸配套）：
    回执丢失/迟到的寄件方重发同一 wait_key 时，若第一封还在柜里 pending 没
    被任何桥捞出站，就不该叠第二封——返回在柜信 id，没有则 None。只查不改，
    锁内快照；信被捞出站（delivered）后即视作「已出门」，再查为 None。"""
    with _locked():
        box = _load()
        for x in box['letters']:
            if x['status'] == 'pending' and x['action'] == 'send' \
                    and x.get('ref') == ref:
                return x['id']
    return None


def mark_delivered(letter_id, via):
    """驿站上门（宿主不经 receive 的原生投递，如 dsh 事件现场 steer）事后记账。"""
    with _locked():
        box = _load()
        for x in box['letters']:
            if x['id'] == letter_id:
                x.update(status='delivered', sent_at=time.strftime('%Y-%m-%d %H:%M:%S'), sent_via=via)
                _save(box)
                return True
    return False


def mark_consumed(letter_id):
    """远端清账：寄出的信被远端真正吃掉（台词入台账）后记账。"""
    with _locked():
        box = _load()
        for x in box['letters']:
            if x['id'] == letter_id:
                x['status'] = 'consumed'
                _save(box)
                return True
    return False


def requeue(letter_id, reason='', delay_sec=0):
    """出站投递遇**瞬时**错误把信退回在柜重投（2026-10-07，j2717 文件锁吞信
    事故）：Permission denied 这类下一秒就自愈的错误，旧法一步记死信，用户的
    话当场蒸发。requeue 把状态回 pending、清送达戳、记重试次数（handin_retries）
    与退避到点时刻（retry_not_before，drain_outgoing 未到点不出站）——「邮差
    扑空是修邮差的事情」：重投次数与到顶改判死信归调用方（出站轮询）裁决，
    驿站只管退回与放行。"""
    with _locked():
        box = _load()
        for x in box['letters']:
            if x['id'] == letter_id:
                x['status'] = 'pending'
                x.pop('sent_at', None)
                x.pop('sent_via', None)
                x['handin_retries'] = int(x.get('handin_retries') or 0) + 1
                if reason:
                    x['last_handin_error'] = str(reason)[:200]
                x['retry_not_before'] = time.time() + max(0.0, float(delay_sec or 0))
                _save(box)
                return True
    return False


def mark_dead(letter_id, reason=''):
    """远端拒收（2026-09-26 引擎常驻化刀0，诚实闸配套）：出站喂引擎被拒
    （job_not_active 等）→ 死信终态留档。'consumed' 的定义是「引擎真吃掉」，
    拿它记拒收信是撒谎——死信带原因留档可查。死信不回炉：引擎的等待超时
    与续跑是既定裁决，回炉只会热循环（信已被本桥捞出站口，别人也不会再来捞）。"""
    with _locked():
        box = _load()
        for x in box['letters']:
            if x['id'] == letter_id:
                x['status'] = 'dead'
                if reason:
                    x['dead_reason'] = str(reason)[:200]
                _save(box)
                return True
    return False


def readdress(host, *, job_id, session):
    """续跑收养（2026-09-26 刀2）：导演窗换了会话号（关了重开），续跑那一刻
    把本宿主本 Job 在柜待领信的会话号改贴新号——收养的唯一合法凭证就是续跑
    登记（清单 §四从严裁决），平时号不符=不领不记。只动 pending 收件信；
    寄件信（speech）归引擎认领，不归它管。返回改贴了几封。"""
    assert session, 'readdress 需要 新会话号'
    with _locked():
        box = _load()
        n = 0
        for x in box['letters']:
            if x['status'] == 'pending' and x['action'] == 'receive' \
                    and x['target_host'] == host and x['job_id'] == job_id:
                x['target_sid'] = str(session)
                n += 1
        if n:
            _save(box)
        return n


def count():
    with _locked():
        box = _load()
    pending = [x for x in box['letters'] if x['status'] == 'pending']
    return {'pending': len(pending),
            'held': len([x for x in pending if x['delivery'] == 'held']),
            'outgoing': len([x for x in pending if x['action'] == 'send']),
            'total': len(box['letters'])}


def main():
    ap = argparse.ArgumentParser(description='femo mailbox（驿站）')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('receive', help='客户到站收件（JSON 到 stdout）')
    p.add_argument('--host', required=True)
    p.add_argument('--soul', default=MAIN, help='客户过滤；--soul all 不过滤')
    p.add_argument('--kind', default=None, help='内容类型过滤')
    p.add_argument('--job', default=None, type=int,
                   help='只取该 Job 的信（桥 collect_notices 代取口同款过滤）')
    p.add_argument('--session', default=None,
                   help='收件会话号（刀2 自取对号）：信带号须精确相等；不带号=只领无号信')
    p_send = sub.add_parser('send', help='寄件（节点发言第二阶段）')
    p_send.add_argument('--job', required=True, type=int)
    p_send.add_argument('--soul', required=True)
    p_send.add_argument('--kind', default='speech', choices=KINDS)
    p_send.add_argument('--payload', required=True)
    p_send.add_argument('--body', default=None,
                        help='结构化 body（JSON 对象字符串，如 {"steps":[…]}——末步 reply=台词）；'
                             '缺省=不带 body 的手写信（出站按 soul 选词兜底）')
    p_send.add_argument('--ref', default=None, help='凭据号（wait_key）')
    p_send.add_argument('--node', default=None)
    p_send.add_argument('--host', required=True, help='target_host（必填）')
    p_send.add_argument('--who-require', default='system_require',
                        choices=('customer_require', 'system_require'),
                        help='节点发言是还系统的账，默认 system_require')
    p = sub.add_parser('drain', help='驿站内部：寄件出站交远端（JSON 到 stdout）')
    p.add_argument('--host', required=True, help='只交出寄给该宿主的件')
    sub.add_parser('count', help='诊断计数')
    args = ap.parse_args()
    if args.cmd == 'receive':
        out = receive(args.host, soul=None if args.soul == 'all' else args.soul,
                      kind=args.kind, job_id=args.job, session=args.session)
        print(json.dumps(out, ensure_ascii=False, indent=1))
    elif args.cmd == 'send':
        body = None
        if args.body is not None:
            try:
                body = json.loads(args.body)
            except json.JSONDecodeError as exc:
                raise SystemExit(f'--body 不是合法 JSON：{exc}')
            if not isinstance(body, dict):
                raise SystemExit('--body 必须是 JSON 对象')
        letter = post(job_id=args.job, soul=args.soul, kind=args.kind,
                      payload=args.payload, action='send', delivery='urgent',
                      who_move='customer_hook', who_require=args.who_require,
                      target_host=args.host, node=args.node, ref=args.ref,
                      body=body)
        print(json.dumps(letter, ensure_ascii=False, indent=1))
    elif args.cmd == 'drain':
        print(json.dumps(drain_outgoing(args.host), ensure_ascii=False, indent=1))
    elif args.cmd == 'count':
        print(json.dumps(count(), ensure_ascii=False))


if __name__ == '__main__':
    main()
