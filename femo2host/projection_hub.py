#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""projection_hub.py — 投影中心：投影窗数据的唯一事实源（femo2host 侧）。

分工总纲（2026-09-18 定稿）：
  hub 负责「整理与记账」——哪个 Job、哪几扇窗、每行投哪、排第几（行号 n 在
  这里分配，是全系统唯一的排序权威）、正在打字的直播块、历史落盘。
  宿主只负责两件事：
    「喂」——上行 POST /feed：整理好的行 + 原始直播帧；
    「画」——下行订阅行协议，渲染自家的投影窗 UI。
  宿主侧不再存投影历史；冷唤醒=GET /view 读历史，实时=WS 订阅，
  接缝=行号 n（窗两段式）。

行协议（唯一 schema，dsh 'femo-plugin/chat' / zcode 'femo/chat' /
projection_center.html 三套旧格式以此为准归一）：
  {"n": 42, "t": 1726..., "host": "dsh", "zone": "inplay", "kind": "say",
   "actor": "小明", "text": "...",
   "targets"?: null | ["乙","丙"],
   "turn"?: 3, "step"?: 1, "session"?: "宿主会话标签",
   "toolCall"?: {"name","arguments"}, "toolResult"?: {"node","output"},
   "src_seq"?: "宿主幂等键"}
  - n / t / host 由 hub 分配（到达序=权威序），宿主给的版本号一律不作数；
    host = 本行来源宿主名，取该批 feed 的 source（宿主自称，见下「多宿主联机」）；
  - zone：inplay(戏内) | outside(戏外，只进上帝窗) | meta(场次行，**全视角可见**
    ——开演/续跑/落幕/暂停/出错是戏级公告，2026-09-21 用户拍板)；
  - targets：null/[] = 全员可见（空 scope=全员，2026-08-22 剧中人空白教训），
    列表 = 只进指定角色窗；
  - src_seq：宿主侧幂等键（复合键如「子会话id#seq」），hub 按 Job 查重丢重放，
    账本重载后依然有效（冷唤醒不破幂等）；
  - session 只是展示标签：hub 一律按 job_id 记账，不按 session 路由——
    resume/换宿主续演时 session 会换、job 不换。

多宿主联机（2026-09-19 用户拍板「一个投影 hub 管所有宿主」）：
  多个宿主（dsh / zcode …）共用同一本 Chronica、指向同一个 sessionid、各认领不同
  角色 = **共演同一场戏**。job_id 相同、落盘仍是 projection/<job_id>/ 一个柜位
  （一场戏一本账），差别的只是每行要说得清来路。四条改动：
  ① host：feed 的 source（宿主自称，取 host.manifest.json 的 host 字段）落进每行；
  ② 段键带 host 段（w:<host>:<wait_key>）——共演时两台的 wait_key（run_tag 都是
     'j<job_id>:'、counter 各从 0 起数）必然撞，不隔开则两台的逐字流落进同一容器；
  ③ 信任集按 host 分格（set_owner(job, sid, host)）——改前单值 sid，第二台喂来的
     戏外行会被当"别人的会话"在 feed 期丢弃（不入账、页面看不见）；
  ④ 角色的身份是 (host, 基名)：/views 的 id/key 带 host，**显示名与 targets 里
     永远是裸名**——'[dsh]' 这类前缀只由渲染端拼，塞进数据会破坏基名匹配。
  不带 source 的老宿主行为与改前一致（行无 host、段键 w:<wait_key>、信任集记全局格）。
  契约细节见 docs/Specs/投影中心行协议.md §1.5；端到端验证见 scripts 外的 mytrashbin/probe-host-join.py。

会话账本（2026-09-20 定稿：上帝视角改绑宿主主会话）：
  两种账本并存——job 账本（projection/<job_id>/，一场戏一本，舞台窗/角色窗的读法）
  与会话账本（projection/sessions/<host>/<sid>/，一个会话一生一本，上帝窗的唯一读法）。
  动机：原「上帝窗」本质是「这场戏的窗」——没戏 running 时用户跟主 Agent 说话
  不进任何账本，上帝窗内容不完整。改造后：
  · 录制与展示分离：宿主把「用户↔主 Agent」的戏外内容按 session 寻址直投
    （POST /feed {"session":"host:sid", frames}），**无戏照收**，录制不等开戏、
    不等绑定；绑定（bindings.json：每宿主 {current, mains}）只是「看哪本」的
    展示指针（POST /bind 换绑，开戏自动收录 mains），GET /sessions 出清单。
  · 行路由（feed 的 zone 收口）：inplay/meta → job 账本（照旧）+ **织入**开戏
    会话的账本（副本带 job_id 标）——上帝窗由此在会话的一生里看到每一场戏；
    outside → owner（信任集 host_ref）已登记时**改道**只进会话账本，未登记
    回落 job 账本（防丢）。织入归属跟戏走，与绑定无关。
  · 读法：GET /view?session=<host>:<sid>（'default'=最近活动会话）——同三道闸
    （视角过滤+显示策略+草稿合成），无信任集过滤（按 sid 定址天然隔离）。
  · 幂等/段键地基照旧：戏外行 src_seq=main:<sid>:<seq>、宿主轮段键 h:<sid>:<seq>
    ——会话账本按 sid 天然隔离；job 账本的信任集过滤器对新写入退役（保留读旧账）。

窗 = 读法，不是存储：一本总账，三种过滤读法——
  god      全部（戏内+戏外+场次）
  stage    场次行（戏级公告，全视角）+ 仅戏内（纯戏内归档）
  actor:X  同 stage，戏内行再按 (targets 空 或 含 X) 裁
  在此之上还有一道显示策略（VIEW_POLICY，模块顶常量，2026-09-20）：按视角类别
  （god/stage/main/human/ai）在出料口扣过程类槽（prompt/cot/react）——
  改这一处常量=改所有宿主的窗口显示，宿主仍是无脑渲染。

直播块（打字机）：四种帧，hub 按 (job_id, key) 聚合，done 时转正为一行进总账。
  块静置超 _LIVE_TTL 秒视为宿主尸块（打字打到一半死掉），hub 懒清扫收尸
  （清块不转正，广播 ctrl live-done 撤页面幽灵块）。
  {"op":"live-start","key","actor","blockKind":"text|reasoning|toolcall","name"?}
  {"op":"live-delta","key","text"}          ← text 为增量
  {"op":"live-done","key","row"?}           ← 无 row 则按累计文本合成一行
  {"op":"live-clear"}                        ← 场次边界清桶（广播 ctrl 让页面清屏）
  帧永不落盘；下行广播 ctrl:'live' / 'live-done' / 'live-clear'——全部视角
  都收（2026-09-19 用户拍板：切到哪个窗就播哪个窗）；角色视角只收「本人在打」
  的块：按块的 actor 与视角名做基形匹配，别人正打的半截话不进别人窗。

上行（POST /feed，批量）：
  {"job_id": 123, "source": "dsh", "frames": [
      {"op":"row", ...行字段...},     # op 可省略：带 zone/kind/text 的直接当行
      {"op":"live-start", ...}, ...]}
  source = 宿主的自称（'dsh'/'zcode'…；缺省空串=老宿主/裸跑，退回单来源行为），
  整批帧都归它；行/段键/信任集的 host 维度全部由此而来（见上「多宿主联机」）。
  返回 {"ok","job_id","appended","live","failed":[{index,reason}]}——被拒帧
  （非对象/未知 op/缺 row）逐条回报，喂方按 index 只补失败帧。

空位与回填（2026-09-19 用户拍板：user 戏外找 main，回话虽是另一轮，位置必须
紧跟 user 发言）：宿主在 user/message 进账的同一拍喂一个空位行
  {"op":"row", "kind":"section", "actor":"导演", "items":[], "slot":1, ...}
占住下一个行号；导演回合收口时喂
  {"op":"fill-slot", "row": {整段 section 行}}
——n/t 沿用空位（位置不动）、journal 原位改写、广播 ctrl 'row-update'；
找不到空位就按普通行追加（回话绝不丢）。空位（items 空）页面不渲染。

段与草稿层（2026-09-19 用户拍板：「槽分『流式输出中／输出完落盘』两态」）：
  section 行是**段**（一个节点实例 = 一个 n），段里的内容叫**槽**，两态——
  草稿（正在写，逐字长）与定稿（写完了，就是 items 里的一条）。
  喂方只管报「这批字属于哪个段的哪一种」，hub 定了算：
  {"op":"draft-start","seg","key","kind":"text|reasoning|toolcall",...}
  {"op":"draft-delta","seg","key","text","kind"?}     ← 增量字
  {"op":"draft-drop","seg"?,"key"?}                   ← 作废（重试/中断/清桶）
  两条规矩替掉喂方自己防双份：①**吸收**——seg-fill 里出现某种 kind 的定稿时，
  同 kind 的草稿整条丢弃；②**转正**——段收口时还没被吸收的草稿就地变成定稿
  （喂方没交卷也不丢历史）。段行在下行多一个可选字段 drafts=[...]，页面画在
  段尾带光标；**没在写的段没有这个字段**。
  草稿只活内存 + 旁账 <job>/drafts.json（节流刷，段收口即撤），**永不进主账**
  ——主账一行一改是整文件重写，流式每秒几十个 chunk 进去必炸。快照 = 主账 +
  旁账合成，所以刷新/换端/重启接得上；页面不做打字动画（显示的就是这份文本，
  动画会变成第二个真相源）。段键由喂方自报（桥用 w:<wait_key>），草稿可先于
  seg-open 到达（两条路各有先后），开段那拍带上。

下行：
  WS   ws://127.0.0.1:<port>/?job=&view=&after=
       连上即推 {"ctrl":"snapshot","proto","job","view","next","rows":[...],"live":[...]}，
       live=当前正在打字的块（已按视角过滤）——换视角/断线重连即刻接上，
       不丢半截话；
       之后推新行（行 JSON 本体）与直播 ctrl 消息；
       客户端可随时发 {"ctrl":"view","job"?,"view"?} 换视角重取快照。
  轮询 GET /view?job=&view=&after=   → {"job","view","rows","next"}
  视角 GET /views?job=               → {"job","views":[{id,name,key?}...]}
       （god/stage + 账本里收出的全部角色；id='actor:'+基形=稳定键——显示名
        变长不换 id，前端选中态跨轮有效；name=显示名；数据管理面在 Python）
  回放 GET /replay?job=              → NDJSON（一行一行）
  目录 GET /jobs · GET /live?job= · GET /health · GET /diag（排障面）
  信任账 GET /owner?job=             → {"owners":{host:[sid,..]}}（复用模式桥的
       has_owner 判据——喂行前查，漏登记走 /hub-register 补）
  复用登记 POST /hub-register        → 桥侧喂方登记四件合一（hub 唯一化 2026-09-25）：
       {"kind":"host","name"}=自称登记（回归一名）；
       {"kind":"cast","job_id","actors"}=开演花名册；
       {"kind":"display","job_id","name"}=带括号显示名；
       {"kind":"owner","job_id","sid","host"}=主会话信任集登记；
       {"kind":"waiting","state"}=人类等待镜像推拍。
  页面 GET /                          → 托管 projectionCenter/index.html（页面壳唯一份）
  页面 GET /pc/<白名单名>             → 页面资产（main.mjs 等；未命中 404 JSON）
  调试 GET /prints?limit=200         → {"ctrl":"prints","items":[…]}（print 旁路镜像）
       print 旁路（2026-09-19「加一路显示」）：桥装 install_stdio_print_bypass 后，
       桥进程 stdout/stderr 的行进环形缓冲（_PRINT_CAP 条）并广播 ctrl 'print'；
       WS 发 {'ctrl':'prints'} 拉历史、{'ctrl':'prints-clear'} 清空。原管道分毫
       不动——femogen『编译器』页走宿主读 OS 管道那路，互不相干。
   图标 GET /favicon.ico               → 插件根 favicon.ico（浏览器自动探测，缺文件 404）

历史落盘：femo2host 侧一场一个文件夹——
  <FEMO_DATA_DIR|FEMO_ROOT>/femo/projection/<job_id>/journal.jsonl
  （与 mailbox.py 同款 FEMO_DATA_DIR 隔离纪律，三通道之三）。
  同场还有一本草稿旁账 drafts.json（段内正在写的字，节流刷、段收口即撤；
  草稿是易失过程态，主账才是事实——两本分开正是为了不让流式把主账拖垮）。
  文件夹里放的是总账，不是每窗一个文件：窗=读法，分窗落盘会把排序与
  去重问题请回来（那正是 hub 要消灭的病）。同场伴生件将来也住这个
  文件夹（小黑板快照 blackboard.json、meta 等），一场戏一个柜位。

嵌入（hub 是库也是服务）：
  宿主 Python 进程（桥 / app.py）内 ProjectionHub(...) + start_hub_server(hub)
  ——端口走 env FEMO_PROJECTION_PORT（缺省 8790，占用向上探），写 hub.json
  自发现（stop_server 干净停机即撤件——读者摸到死端口先怀疑旧件）。桥同时用 EventProjector 在事件现场喂行（2026-09-19 接线）：
  make_event_callback / post_speech / human_input 三个咽喉，喂送 best-effort
  绝不挡演出。AI 演员的逐字流帧不过桥，打字机效果属宿主喂（第二步）。
  注意：一个 hub 一个数据目录；**多宿主联机 = 共演同一场、共用一个 hub**（见上
  「多宿主联机」），每台把自称放进 feed 的 source 即可，账本仍是一场一本。
  两台各自起 hub、各自写自己的 projection 目录仍然是两台孤岛（要合起来就让它们
  指向同一个 hub）。
  **hub 唯一化（2026-09-25 定稿，docs/ActiveRoadmaps/hub唯一化设计.md）**：桥
  启动不再无条件自起——先探本数据根 hub.json 指向的 hub，活着就复用（不自起、
  不覆写地址簿，喂送/登记全走 HTTP），死/无才自起（现行行为零变化）。桥侧封装
  是 HubClient（local/remote 两态同名方法，见类注释）；寄信走共享信柜（跨进程
  文件锁），寄信宿主以**等待态自带的 host 优先**（见 human_input）。

零依赖：纯标准库（桥是 stdio 进程，不得引入三方包）。
协议：docs/Specs/投影中心行协议.md（版本 proto: 1——快照与 /view /health /diag 均带）。
自检：python projection_hub.py --selftest
单跑：python projection_hub.py --port 8765 [--data-dir ...]
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import queue
import socket
import struct
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from collections import deque
from urllib.parse import urlparse, parse_qs
import urllib.error
import urllib.request

FEMO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 数据根：FEMO_DATA_DIR 优先（测试/多实例沙盒隔离，与 mailbox.py 同一口径）
if os.environ.get('FEMO_DATA_DIR'):
    PROJECTION_DIR = os.path.join(os.environ['FEMO_DATA_DIR'], 'femo', 'projection')
else:
    PROJECTION_DIR = os.path.join(FEMO_ROOT, 'user_data', 'projection')

ZONES = ('inplay', 'outside', 'meta')
PROTO_VERSION = 1     # 行协议版本：破坏性变更才 +1（见 docs/Specs/投影中心行协议.md；新增字段不升版）
HUB_REV = '2026-09-25a-hub-unify'  # 代码修订号（不动协议）：排障时「跑的是哪一版」
                                     # 以 /diag 的 rev 为准——桥是 python 进程，改了
                                     # 文件不重启就还是旧码，别拿眼神判断。
_SUB_Q_MAX = 500      # 单订阅投递队列上限：满即断连（消费端卡死防线，重连有快照）
_LIVE_TTL = 15 * 60   # 打字块静置秒数上限：超时收尸（宿主打字打到一半死掉的尸块）
_BOOK_TTL = 3600      # 冷账本逐出秒数：没人摸超时即从内存卸下（盘上 journal 是真身）
_DRAFT_FLUSH_SEC = 0.5  # 草稿旁账节流：流式每秒几十个 chunk，落盘必须被限流
# 投影页（2026-09-26 拆分）：单文件时代结束，页面搬进 projectionCenter/ 文件夹。
# hub 仍不做通用静态目录——白名单表逐个登记（路径全是代码常量，零目录穿越面）；
# 未命中必须回非 HTML 的 404 且注册在未知路径兜底之前：浏览器对 module 强制
# MIME 检查，兜底回 HTML 就是整页黑加一行报错、服务端零痕迹（施工清单 §五）。
PC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'projectionCenter')
PAGE_FILE = os.path.join(PC_DIR, 'index.html')
PC_FILES = {
    '/pc/index.html': 'index.html',
    '/pc/main.mjs': 'main.mjs',
    '/pc/state.mjs': 'state.mjs',
    '/pc/util.mjs': 'util.mjs',
    '/pc/render.mjs': 'render.mjs',
    '/pc/composer.mjs': 'composer.mjs',
    '/pc/sessions.mjs': 'sessions.mjs',
    '/pc/panels.mjs': 'panels.mjs',
    '/pc/debug-panel.mjs': 'debug-panel.mjs',
    '/pc/theme.css': 'theme.css',
    '/pc/app.css': 'app.css',
}
_PC_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
}
FAVICON_FILE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, 'favicon.ico'))

_ASCII_KEY_OK = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-')

# 宿主直播块的词表 → 段内草稿的 kind（text/reasoning/toolcall 是宿主侧词汇，
# say/cot/tool 是行词汇）：映射收在 hub，宿主只管说自己那一套。
_DRAFT_KINDS = {'text': 'say', 'reasoning': 'cot', 'toolcall': 'tool'}

# print 旁路（2026-09-19 用户拍板「加一路显示」）：桥进程 stdout/stderr 的旁观镜像。
# 原管道分毫不动——镜像只进这里（环形缓冲 + WS 广播），给投影页右上角调试浮层。
_PRINT_CAP = 500           # 环形缓冲条数（内存态，hub 重启即重来——观测面不是档案）
_PRINT_TAIL_DEFAULT = 200  # /prints 与 WS {'ctrl':'prints'} 缺省回放条数


def _seg_host(seg) -> str:
    """段键 w:<host>:<wait_key> 的宿主段：host 不含冒号，取 w: 后首个冒号前的段。
    【裸键判据】带 host 的键在 host 段后必还跟着 wait_key 段（wait_key 可含
    冒号，host 不含）——w: 后整段无冒号即必裸键（老桥产物）；宿主段形如
    j<数字>（引擎 wait_key 的世代前缀）同样视为裸。非 w: 键（speech:/human:
    /h:<sid>:…）返回 ''。（JS 侧同款判断在 hub-render-core.mjs segHostOf——
    跨语言一份裁决两份实现，改动须两边同改。）
    【刀1 归属单源 2026-09-26】job 行本体不再盖宿主章（行 host 字段退役），
    行级归属一律剖段键——本函数是行级归属的唯一读法。产线桥恒 set_host+
    投递事实，段键恒带归属；裸键只在旧账本（行自带 host 章，轮不到本函数）
    与无 host 投影器的人造场景出现。"""
    s = str(seg or '')
    if not s.startswith('w:'):
        return ''
    rest = s[2:]
    i = rest.find(':')
    if i <= 0:
        return ''
    cand = rest[:i]
    if cand[:1] == 'j' and cand[1:].isdigit():
        return ''
    return cand


def _hosts_of_rows(rows) -> list:
    """某场行里出现过的来源 host（按出现序去重）。联机共演的场次会列出多台。
    【刀1 归属单源】优先行 host 字段（旧账本），空则剖段键（新账本行不带
    host，归属在段键里）。"""
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        h = r.get('host')
        if not (isinstance(h, str) and h):
            h = _seg_host(r.get('seg'))
        if isinstance(h, str) and h and h not in out:
            out.append(h)
    return out


def _draft_kind(k) -> str:
    k = str(k or 'text')
    return _DRAFT_KINDS.get(k, k)


# 草稿槽的语义序（2026-09-30 拍板修「思考链行上下跳」）：一轮模型调用里内容的
# 天然先后=思考→工具→台词。同轮同类的多条（并行工具）再按槽键里的 index 排。
_DRAFT_KIND_RANK = {'cot': 0, 'tool': 1, 'say': 2}


def _draft_slot_order(it):
    """草稿槽的展示序键（hub 定槽序，页面照抄）。槽表是按到达序建的 dict，而
    草稿的 drop+delta 节奏（哪路有字哪路整对重发）会让被重插的槽挪到字典末尾
    ——批与批之间哪几路重发不同，插入序就翻面，页面上的思考链/台词行跟着
    上下互换。这里按槽键 kind#step#index 排出确定序：轮次（step）升序、同轮
    按语义序、同类按 index；无号段（'-'，整轮一次性快照槽）垫底——它比任何
    带轮次的槽都新。同键全等时靠排序稳定性保持先到先排。"""
    parts = str(it.get('key') or '').split('#')

    def num(x, no_num):
        try:
            return (0, float(x))
        except ValueError:
            return (no_num, 0.0)
    return (num(parts[1], 1) if len(parts) > 1 else (1, 0.0),
            _DRAFT_KIND_RANK.get(str(it.get('kind') or ''), len(_DRAFT_KIND_RANK)),
            num(parts[2], -1) if len(parts) > 2 else (-1, 0.0))


def _norm_host(h) -> str:
    """来源宿主名归一（2026-09-19 用户拍板：host 自报名字，hub 只收不管）。

    宿主把名字放在 feed 的 source 字段里；hub 不写死白名单（接入新宿主=喂一个
    新 source），只做形状归一：去空白、限长、**去过列分隔符与空白**（host 会进
    段键与幂等键的命名空间，混进 ':' 会把键切错）。
    无 host（老宿主/裸跑）→ ''，退回不过滤的老行为。"""
    s = str(h or '').strip()
    if not s:
        return ''
    out = []
    for ch in s[:64]:
        out.append('_' if (ch.isspace() or ch in ':|') else ch)
    return ''.join(out)


def _split_session(session):
    """'host:sid' → (host, sid)（2026-09-20 会话账本）：两段都过 _norm_host 归一
    （去空白/冒号/竖线、限长），并拒掉会进目录路径的形状（空/./..、路径分隔符）。
    不带冒号 = 形状不对，返回 ('', None)——调用方按错误回执处理。"""
    s = str(session or '').strip()
    if ':' not in s:
        return '', None

    def _safe(v: str) -> str:
        v = _norm_host(v)
        if not v or v in ('.', '..') or '/' in v or '\\' in v:
            return ''
        return v
    h, sid = s.split(':', 1)
    h, sid = _safe(h), _safe(sid)
    if not sid:
        return '', None
    return h, sid   # host 允许空串（老宿主/无主格的账本落 sessions/<sid>/）


def _seg_ref(f, host: str = '') -> str:
    """帧里的段引用：显式 seg 优先，否则由 wait_key 合成 'w:<host>:<wait_key>'。

    段键的构造规则只写在这一处——喂方只管报它手上那个令牌（宿主拿到的就是引擎
    在 ai_request/human_wait 里发的那枚 wait_key），不必知道 hub 怎么拼段键，也
    不必自己造键来对齐（2026-09-19 用户拍板：宿主侧要薄，只当一个壳）。

    【host 进段键·2026-09-19 联机改造】wait_key = f"{run_tag}ai_{node}_{counter}"，
    run_tag 由桥注入 = f"j{job_id}:"，counter 是**每个 Runner 实例**的计数器。
    多宿主共演同一场（同一 job_id）时 run_tag 完全相同、两边 counter 各从 0 起数
    ——同节点同轮**必然得到一模一样的 wait_key**。不把 host 拼进段键命名空间，
    两台的逐字流会落进同一个容器、字一字一字交错着长（与 1856 场那类幻影段同款
    死法，只不过这次键不是拼错，是真的重了）。

    【显式 seg 也要归一·2026-09-19 修孪生段】桥的 EventProjector 走的是
    `_seg_key()`（产**裸键** `w:<wait_key>`），而宿主喂 draft 只报 wait_key
    → 本函数拼**带 host 的键**。同一个 hub、两条入口、两套键 → draft 挂到
    "孪生段"上、页面那个容器永远收不到逐字流（job 1927 实锤：journal 段键
    `w:j1927:ai_[看牌]_2`，drafts 段键 `w:dsh:j1927:ai_[看牌]_2`，零匹配）。
    修法：**段键归一收口在本函数**——显式 seg 若没带 host 段就补上，两条入口
    从此汇成同一套键。"""
    seg = str(f.get('seg') or '')
    if seg:
        # 【2026-09-25 多宿主】显式 seg 恒原样信（幂等）。新版桥/EventProjector
        # 产的段键恒带归属 host 段（w:<演员归属>:<wait_key>，演员可属外宿主；
        # 会话账本另有 h: 形态）——旧的「喂方前缀判定补 host」会把异 host 键
        # 误当裸键再拼一层（实测 w:dsh-3081:zcode:j2566:…）。只有「帧不带
        # seg、只报 wait_key」才由本函数按喂方 host 合成（宿主侧要薄，不自己
        # 造键对齐——2026-09-19 拍板）。
        return seg
    wk = str(f.get('wait_key') or '')
    if not wk:
        return ''
    return ('w:%s:%s' % (host, wk)) if host else ('w:%s' % wk)


def sanitize_key(name) -> str:
    """角色名 → 窗键：非 [A-Za-z0-9_-] 逐字符换 _码点hex（@ → _40）。
    与 projection-core.mjs 的 actorKeyOf 同算法，不同名必得不同键。"""
    out = []
    for ch in str(name or ''):
        out.append(ch if ch in _ASCII_KEY_OK else '_%x' % ord(ch))
    return ''.join(out)


def _base_name(name) -> str:
    """去括号基形：'@Eve（Eve）'→'@Eve'，'@铲屎官（main）'→'@铲屎官'。
    引擎 actor_name 带（soul/备注）后缀，剧本 actors 是裸名——同一角色两种写法。"""
    s = str(name or '')
    for open_ch, close_ch in (('（', '）'), ('(', ')')):
        i = s.find(open_ch)
        if 0 < i and s.endswith(close_ch):
            return s[:i]
    return s


def _name_bases(name) -> set:
    """名字与其基形全集（视角过滤用：长名目标命中短名视角，反之亦然）。"""
    s = str(name or '')
    return {s, _base_name(s)}


def _view_actor(view: str) -> str:
    """从 actor 视角名里取出「角色那一段」，供基名匹配。

    视角 id 有两种写法（2026-09-19 联机改造后带 host）：
      · 'actor:@Eve'        —— 单来源（host 缺省）
      · 'actor:dsh:@Eve'    —— 带来源宿主
    host 本身经 _norm_host 归一（不含 ':'），故按末节取角色名是安全的；
    取出来的永远是**裸角色名**——前缀只活在视角 id 里，不进 targets/scope
    匹配（往数据里塞前缀会让角色窗当场空掉）。"""
    v = str(view or '')
    if not v.startswith('actor:'):
        return ''
    rest = v[6:]
    if ':' in rest:
        rest = rest.rsplit(':', 1)[-1]
    return rest


def view_filter(view: str, row: dict) -> bool:
    """视角过滤：god=全部；meta=场次行（开演/续跑/落幕/暂停/出错——戏级公告，
    全视角可见，2026-09-21 用户拍板「所有投影窗都有 FEMO 开始/已跑完/暂停/
    继续这类消息」）；stage=仅戏内；actor:X=戏内且 targets 空或含 X。
    outside（戏外私聊/引擎耳语）仍只进上帝窗。"""
    zone = row.get('zone')
    if view == 'god' or zone == 'meta':
        return True
    if view == 'stage':
        return zone == 'inplay'
    if view and view.startswith('actor:'):
        if zone != 'inplay':
            return False
        targets = row.get('targets')
        if not targets:
            return True
        want = _name_bases(_view_actor(view))
        for t in targets:
            if _name_bases(t) & want:
                return True
        # 归属演员自身恒可见（旧段落没做 speaker 补录，这里兜住）
        if row.get('actor') and (_name_bases(row['actor']) & want):
            return True
        return False
    return True


def _host_seg_sid(seg) -> str:
    """宿主轮的段键是 'h:<sid>:<seq>'（宿主自己开容器时的键）——取出里面的 sid。
    不是宿主轮（桥的 'w:<wait_key>'）→ ''。跨会话过滤据此认人：段键里就写着这条
    内容属于哪个 dsh 会话，不必再让宿主额外交一个 sid 字段（2026-09-19）。"""
    s = str(seg or '')
    if not s.startswith('h:'):
        return ''
    parts = s.split(':', 2)
    return parts[1] if len(parts) >= 2 else ''


# 认段引用的帧：seg 或 wait_key 二者其一即可（脚本里喂出来的段键一律是 'w:<host>:<wk>'）
_SEG_OPS = ('seg-open', 'seg-fill', 'seg-close', 'draft-start', 'draft-delta', 'draft-drop')

# 容器槽序（2026-09-19 用户拍板）：hub 是排序的唯一权威。头部三件套位置固定——
#   showprompt（演出提示）→ prompt（本节点指令）→ name（名字槽），
# 其余槽（retry/cot/tool/tool_result/say/fail…）按发生序跟在后面。喂方只管
# 「来的什么写什么」按到货顺序塞，hub 落账前统一规整（宿主与页面都不掺和）；
# 名字槽归 hub 注入，宿主/桥不许喂。旧账里的 narrate 槽原样保留（渲染端兜底），
# 不迁移。
_HEAD_KINDS = ('showprompt', 'prompt')

# 落幕扫除判据（2026-09-21 用户拍板）：段里只剩这些槽（提问还挂着但没人接）
# 或整段为空 =「建立了段但没发言」——play_end 落账那一刻整行删除；有其余任何
# 槽（cot/台词/工具/重试反馈…）=有角色产出，是历史，一律保留。
_UNSPOKEN_HEAD_KINDS = ('showprompt', 'prompt', 'name')


def _canonical_items(items, actor=''):
    """槽序规整 + 名字槽注入（槽序权威的实现体，见上）。幂等：对已规整的
    items 原样返回。名字槽归 hub 独有——喂方带来的 name 槽一律剥掉，由 hub
    按 actor 重插到 prompt 之后（actor 空=不插，绝不渲染空名字）；头部槽
    （showprompt/prompt）恒提到内容槽之前，晚到的兜底 showprompt 也归位、
    不插进内容中间；同类头部槽之间保持到货序，showprompt 恒在 prompt 前。"""
    head, body = [], []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        kind = str(it.get('kind') or 'say')
        if kind == 'name':
            continue   # 名字槽 hub 独有：喂方的不认
        dit = {'kind': kind, 'text': str(it.get('text') or '')}
        for k in ('toolCall', 'toolResult'):
            if isinstance(it.get(k), dict):
                dit[k] = it[k]
        (head if kind in _HEAD_KINDS else body).append(dit)
    head.sort(key=lambda d: 0 if d['kind'] == 'showprompt' else 1)
    actor = str(actor or '').strip()
    if actor and (head or body):
        head.append({'kind': 'name', 'text': actor})   # 空段不注入：空位行与
        # 「正在…」空块保持零内容（名字由渲染端从行 actor 兜底，见页面契约）
    return head + body


# ── 显示策略（2026-09-20 用户拍板：全局唯一的显示规则，改这里=改所有宿主）────
# 行=视角类别，列=受管内容；True=发给该视角，False=扣下。hub 在出料口
# （snapshot / WS 广播）按窗口视角执行——宿主拿到的料包已按此滤好，无脑渲染。
# 视角类别：god=上帝视角；stage=戏内视角；main=主 Agent 角色窗；
#   human=人类角色窗（席位是人）；ai=其余 AI 角色窗（席位是 AI 演员的角色）。
# 受管列（过程类内容）：*_prompt=AI 的指令 prompt 槽（main=主 Agent / own=视角
#   本人 / other=其他 AI）；*_cot=思考链；*_react=React 过程（工具调用+结果）；
#   human_prompt=人类节点的指令 prompt 槽。
# **showprompt（演出提示）不受管**——永远显示，所有视角都能看（2026-09-20
# 用户定案「只显示 Show Prompt，AI 的 Prompt 全程不用显示」）。
# 台词（say）、名字（name）、公告（notice）、旁白、重试/失败行同样不受管——
# 可见性仍按 zone/targets 老规矩；本策略只管「过程」，戏词永远公开。
# prompt 槽（2026-10-03 用户定稿口径）：「等待的时候人类节点 showprompt 和
# prompt 都要有，等待的时候 AI 节点只有 showprompt。展示席人类和 AI 节点都是
# 只有 showprompt。showprompt 相当于 notice，要 show 出来。而 prompt 只有人类
# 输入的时候能看见。输入完就不用了。AI 其实也是，AI 输入的时候也会发给他们，
# 只不过也不用展示在投影中心。」——即：AI 的 prompt 全视角永不显示（原样）；
# 人类的 prompt 以**等待席在册**为准（正在输入才显示，收口/历史一概扣下，
# 见 _apply_view_policy.keep 的 human_prompt 支路）。
_VIEW_COLS = ('main_prompt', 'main_cot', 'main_react',
              'own_prompt', 'own_cot', 'own_react',
              'other_prompt', 'other_cot', 'other_react', 'human_prompt')

VIEW_POLICY = {
    # 上帝：AI 的 prompt 不显示，人类 prompt 显示（等待中；收口由席位状态扣下）
    'god':   {'main_prompt': False, 'main_cot': True, 'main_react': True,
              'own_prompt': False, 'own_cot': True, 'own_react': True,
              'other_prompt': False, 'other_cot': True, 'other_react': True,
              'human_prompt': True},
    # 戏内：人类 prompt 等待中同样显示（输入席在 stage 也亮，题要跟着输入席走；
    # 收口同样由席位状态扣下——2026-10-03 用户拍板）
    'stage': {'main_prompt': False, 'main_cot': True, 'main_react': True,
              'own_prompt': False, 'own_cot': True, 'own_react': True,
              'other_prompt': False, 'other_cot': True, 'other_react': True,
              'human_prompt': True},
    # 主 Agent 角色窗：同戏内
    'main':  {'main_prompt': False, 'main_cot': True, 'main_react': True,
              'own_prompt': False, 'own_cot': True, 'own_react': True,
              'other_prompt': False, 'other_cot': True, 'other_react': True,
              'human_prompt': False},
    # 人类角色窗：人类 prompt 显示（要看见自己的题；收口由席位状态扣下）
    'human': {'main_prompt': False, 'main_cot': True, 'main_react': True,
              'own_prompt': False, 'own_cot': True, 'own_react': True,
              'other_prompt': False, 'other_cot': True, 'other_react': True,
              'human_prompt': True},
    # 其余 AI 角色窗：同戏内
    'ai':    {'main_prompt': False, 'main_cot': True, 'main_react': True,
              'own_prompt': False, 'own_cot': True, 'own_react': True,
              'other_prompt': False, 'other_cot': True, 'other_react': True,
              'human_prompt': False},
}

# 受管槽 kind → 内容类别（prompt/cot/react）；不在表里=不受管（永远随行走）。
# showprompt 特意不在表里：演出提示永远公开（2026-09-20 用户定案）
_POLICY_KINDS = {'prompt': 'prompt',
                 'cot': 'cot', 'tool': 'react', 'tool_result': 'react'}

# 段角色（section 行上的 role 标，喂方在开段那拍自报；旧账无 role 按 ai 处理）
_SECTION_ROLES = ('main', 'ai', 'human')


def _policy_column(role, is_self, kind):
    """(段角色, 是否视角本人, 槽 kind) → 策略列名；不受管的槽返回 None。"""
    cat = _POLICY_KINDS.get(str(kind or ''))
    if cat is None:
        return None
    if role == 'human':
        return 'human_prompt'   # 人类节点的过程类内容只有 prompt 一列
    who = 'main' if role == 'main' else ('own' if is_self else 'other')
    return '%s_%s' % (who, cat)


def _normalize_row(raw: dict, n: int, t: int, host: str = '') -> dict:
    """行归一。host 与 n/t 同性质：**hub 分配，不吃宿主自报**（2026-09-19）——
    宿主报的是整批 feed 的来源（feed 的 source 参数），单帧自带的 host 一律不作数。"""
    zone = raw.get('zone') or 'inplay'
    if zone not in ZONES:
        zone = 'inplay'
    row = {
        'n': n, 't': t, 'zone': zone,
        'kind': str(raw.get('kind') or 'say'),
        'actor': str(raw.get('actor') or ''),
        'text': str(raw.get('text') or ''),
    }
    if host:
        row['host'] = host
    if raw.get('targets'):
        row['targets'] = [str(x) for x in raw['targets']]
    for k in ('turn', 'step', 'session', 'node'):
        if raw.get(k) is not None:
            row[k] = raw[k]
    # 台账场次号（2026-09-29 整场回放）：只收 int 正号——开演行（play_start/
    # play_resume）随行落账，其余行不吃这个字段（号是场次身份不是行属性，
    # 只有章节头携带；宿主伪造其他行的号一律丢弃）。
    if isinstance(raw.get('femo_session_id'), int) and raw['femo_session_id'] > 0 \
            and row['kind'] in ('play_start', 'play_resume'):
        row['femo_session_id'] = raw['femo_session_id']
    if raw.get('slot'):
        row['slot'] = 1   # 预留空位（等导演回话来填）；填过后随 items 非空自然失效
    for k in ('toolCall', 'toolResult'):
        if isinstance(raw.get(k), dict):
            row[k] = raw[k]
    if raw.get('src_seq'):
        row['src_seq'] = str(raw['src_seq'])
    if raw.get('seg'):
        # 段生命周期（2026-09-19 用户拍板：进节点即开块、有内容就往里填）
        row['seg'] = str(raw['seg'])
    if raw.get('open'):
        row['open'] = True      # 未收口：页面画「正在…」，后续 seg-fill 原位长内容
    if raw.get('kind') == 'section' and isinstance(raw.get('items'), list):
        items = []
        for it in raw['items']:
            if not isinstance(it, dict):
                continue
            item = {'kind': str(it.get('kind') or 'say'), 'text': str(it.get('text') or '')}
            for k in ('toolCall', 'toolResult'):
                if isinstance(it.get(k), dict):
                    item[k] = it[k]
            items.append(item)
        # 槽序规整+名字槽注入在这里统一做（2026-09-19 用户拍板：槽序 hub 定，
        # 宿主无脑照抄）——row op、seg-open、fill-slot 三条路都过这里。
        row['items'] = _canonical_items(items, row.get('actor'))
    if raw.get('role') in _SECTION_ROLES:
        row['role'] = raw['role']   # 段角色标（显示策略用，2026-09-20）
    if raw.get('job_id') is not None:
        row['job_id'] = raw['job_id']   # 织入行的出处标（会话账本专属；job 账本行无此字段）
    return row


def _synthesize_row(blk: dict) -> dict:
    """live-done 无 row 时按累计文本合成转正行。"""
    bk = blk.get('blockKind') or 'text'
    if bk == 'reasoning':
        return {'zone': 'inplay', 'kind': 'cot', 'actor': blk.get('actor') or '',
                'text': blk.get('text') or ''}
    if bk == 'toolcall':
        return {'zone': 'inplay', 'kind': 'tool', 'actor': blk.get('actor') or '',
                'text': '', 'toolCall': {'name': blk.get('name') or 'unknown',
                                         'arguments': blk.get('text') or ''}}
    return {'zone': 'inplay', 'kind': 'say', 'actor': blk.get('actor') or '',
            'text': blk.get('text') or ''}


_JSTAT_CACHE = {}   # path -> (mtime_ns, size, (rows, first_t, last_t))——轻量盘点缓存


def _stat_journal(path: str) -> tuple:
    """不物化账本的轻量盘点：(有效行数, 首行 t, 末行 t, 来源 host 集)。
    /jobs 清单与「最新」指针专用——绝不为盘点把整本 journal 装进内存
    （懒加载有去无回：books 永不逐出，页面每次打开都拉一遍清单=全历史进内存）。
    坏行跳过口径与 _JobBook._load 一致；(mtime_ns, size) 未变直接吃缓存。
    host 集按出现序去重（联机共演的场次会列出多台——2026-09-19 联机改造）。"""
    try:
        st = os.stat(path)
        mtime, size = st.st_mtime_ns, st.st_size
    except OSError:
        _JSTAT_CACHE.pop(path, None)
        return (0, None, None, [])
    hit = _JSTAT_CACHE.get(path)
    if hit and hit[0] == mtime and hit[1] == size:
        return hit[2]
    rows = 0
    first_t = last_t = None
    hosts = []
    try:
        with open(path, 'rb') as f:
            for line in f:
                s = line.strip()
                if not s:
                    continue
                try:
                    obj = json.loads(s)
                except ValueError:
                    continue
                if obj.get('del'):
                    continue   # 墓碑行（落幕扫除）：不占行数、不带时戳/宿主
                rows += 1
                t = obj.get('t')
                if isinstance(t, int):
                    if first_t is None:
                        first_t = t
                    last_t = t
                h = obj.get('host')
                if isinstance(h, str) and h and h not in hosts:
                    hosts.append(h)
    except OSError:
        return (0, None, None, [])
    val = (rows, first_t, last_t, hosts)
    _JSTAT_CACHE[path] = (mtime, size, val)
    return val


_JSESS_CACHE = {}   # path -> (mtime_ns, size, session_id|None)——首行台账号缓存


def _session_of_job(path: str):
    """一本 job 账的台账场次号：只读 journal 首行 play_start/play_resume 行
    的 femo_session_id（2026-09-29 整场回放拍板）。与 _stat_journal 同纪律：
    (mtime, size) 未变吃缓存，绝不物化账本。无号（旧账未回填/CLI 裸跑无幕布
    时代的首行 section）→ None；判据只有首行，多 job 共一场里每本独立取号。"""
    try:
        st = os.stat(path)
        mtime, size = st.st_mtime_ns, st.st_size
    except OSError:
        _JSESS_CACHE.pop(path, None)
        return None
    hit = _JSESS_CACHE.get(path)
    if hit and hit[0] == mtime and hit[1] == size:
        return hit[2]
    sid = None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                s = line.strip()
                if not s:
                    continue
                obj = json.loads(s)
                if obj.get('kind') in ('play_start', 'play_resume'):
                    v = obj.get('femo_session_id')
                    if isinstance(v, int) and v > 0:
                        sid = v
                break   # 只看首行：场次身份开演那拍即定
    except (OSError, ValueError):
        sid = None
    _JSESS_CACHE[path] = (mtime, size, sid)
    return sid


def _seg_base_gen(seg):
    """段键 → (路由基键, 世代号)。

    【2026-09-28 续跑世代让位】引擎续跑按检查点重建运行实例，wait_key 计数器
    从零重数——同一场戏里同一个 wait_key 会第二次出现（直启分支重跑，引擎正常
    机制）。wait_key 在引擎侧只是一次性信箱地址（发牌收信一轮用完即弃，引擎
    语义自洽，用户实测引擎收信/落库/上下文全对）；投影层把它借来当跨时间的段
    键，键重现的裁决就归投影层：已收口的段键又见开段 = 新的一轮等待，开新段、
    行 seg 带世代后缀 ':g<N>'，旧段原样保留为历史——新台词不再 fill 进旧发言
    里（旧段有 say 时页面会新旧两条一起显示，用户实测报障即此）。
    无后缀 = 第一代（世代号 1）。"""

    i = seg.rfind(':g')
    if i > 0 and seg[i + 2:].isdigit() and int(seg[i + 2:]) > 0:
        return seg[:i], int(seg[i + 2:])
    return seg, 1


class _JobBook:
    """一本总账：内存行 + src_seq 幂等索引 + 追加式落盘。懒加载（冷唤醒种子）。
    布局：projection/<job_id>/journal.jsonl——一场一个文件夹，总账在内。

    草稿旁账（2026-09-19 用户拍板「打字机积累的内容也要稍微存一下」）：
    projection/<job_id>/drafts.json——段内**正在写**的那几条。主账的改写是
    整文件重写（_rewrite_journal_line），草稿每秒几十次进去必炸；所以草稿
    另开一本小册子，节流刷（_DRAFT_FLUSH_SEC），段收口时整条撤走、定稿并进
    主账（journal 一行不动到收口那一刻）。"""

    def __init__(self, job_id: int, dir_path: str, rel: str = ''):
        self.job_id = job_id
        # 会话账本（2026-09-20）：rel='sessions/<host>' 时 job_id=sid（仅目录名与
        # live 键用，无 job 语义）；sess=(host, sid)，job 账本恒 None。
        self.sess = None
        self.dir = os.path.join(dir_path, rel, str(job_id)) if rel \
            else os.path.join(dir_path, str(job_id))
        self.path = os.path.join(self.dir, 'journal.jsonl')
        self.drafts_path = os.path.join(self.dir, 'drafts.json')
        self.rows = []
        self.src_seqs = set()
        self.segs = {}      # seg → n（段生命周期索引：开块定位/填充定位；冷加载重建）
        self.seg_zone = {}  # seg → zone（路由判定：seg-fill/draft 帧不带 zone，按段查）
        self.seg_gen = {}   # 段路由基键 → 已用最大世代号（续跑世代让位，见 _seg_base_gen）
        # 冷加载遗产的让位许可集（续跑世代让位，2026-09-28）：daemon 重启后
        # EventProjector 也重建、重发的开段帧打不了 regen 标——冷加载时把「账上
        # 已收口段的路由基键」记下，首个同键开段帧据此让位。本进程落账的键不入集
        # （重投防线保住：同进程重投无 waiting/regen/遗产三个许可，照旧幂等拒）。
        self.seg_regen_ready = set()
        # 本进程已落过续跑开场行（play_resume）：冷加载遗产许可的附加闸——真实
        # 续跑时 resume 行先于撞号的开段帧落账；冷加载后的重放开段帧（协议 §8
        # 防线，2026-09-27 墓碑诈尸修复同款）没有这一拍，照旧拒。
        self.resumed_seen = False
        self.drafts = {}    # seg → {key: {key,kind,text,name?,actor?,act}}（草稿层，永不进主账）
        self.drafts_dirty = False
        self.drafts_at = 0.0   # 上次刷旁账的时刻（0=这本还没刷过：首批草稿即刻落）
        self.next_n = 1
        self._fh = None
        self.touched = time.time()   # 逐出判据：最近有人摸的时刻（_book 刷新）
        self._load()

    def _load(self):
        if not os.path.isfile(self.path):
            self._load_drafts()      # 空场也要回血（草稿可能先于开段落过旁账）
            return
        with open(self.path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if row.get('del'):
                    # 墓碑行（落幕扫除删段的残迹）：行没了、幂等键还得在——
                    # 冷加载收割 src_seq，晚到的重放开段帧不得把空段诈尸回来
                    if row.get('src_seq'):
                        self.src_seqs.add(row['src_seq'])
                    if isinstance(row.get('n'), int):
                        self.next_n = max(self.next_n, row['n'] + 1)
                    continue
                self.rows.append(row)
                if row.get('src_seq'):
                    self.src_seqs.add(row['src_seq'])
                if row.get('seg'):
                    sg = str(row['seg'])
                    self.segs[sg] = row.get('n')
                    self.seg_zone[sg] = row.get('zone') or 'inplay'
                    base, gen = _seg_base_gen(sg)
                    if base != sg:
                        # 世代段行（续跑让位）：路由键（基键）指向最新世代——账序
                        # 靠后的世代行覆盖靠前的；世代簿同步回血，下次让位接着编
                        self.segs[base] = row.get('n')
                        self.seg_zone[base] = self.seg_zone[sg]
                        if gen > self.seg_gen.get(base, 1):
                            self.seg_gen[base] = gen
                if isinstance(row.get('n'), int):
                    self.next_n = max(self.next_n, row['n'] + 1)
        for sg in self.segs:
            n = self.segs.get(sg)
            row = next((r for r in self.rows if r.get('n') == n), None)
            if row is not None and not row.get('open'):
                self.seg_regen_ready.add(_seg_base_gen(sg)[0])   # 冷加载遗产：可让位
        self._load_drafts()

    def _load_drafts(self):
        """草稿旁账回血（刷新/重启/换端接得上）。读坏了就当没有——草稿是易失
        的过程态，主账才是事实，不值得为它中断冷唤醒。
        已收口的段一概不要：旁账是节流刷的，段收口那一刻的残影可能还留在盘上，
        捞回来就会在定稿旁边长出第二条（双份）。"""
        try:
            with open(self.drafts_path, 'r', encoding='utf-8') as f:
                raw = json.load(f)
        except (OSError, ValueError):
            return
        if not isinstance(raw, dict):
            return
        closed = {str(r['seg']) for r in self.rows if r.get('seg') and not r.get('open')}
        dropped = False
        for seg, slots in raw.items():
            if str(seg) in closed:
                dropped = True
                continue
            if not isinstance(slots, dict):
                continue
            keep = {str(k): v for k, v in slots.items() if isinstance(v, dict)}
            if keep:
                self.drafts[str(seg)] = keep
        if dropped:
            self.drafts_dirty = True   # 顺手把残影从旁账里抹掉（下次节流刷写下去）

    def append(self, row: dict):
        if self._fh is None:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            self._fh = open(self.path, 'a', encoding='utf-8')
        self._fh.write(json.dumps(row, ensure_ascii=False) + '\n')
        self._fh.flush()
        self.rows.append(row)
        if row.get('src_seq'):
            self.src_seqs.add(row['src_seq'])
        self.next_n = row['n'] + 1


class _Sub:
    """下行订阅者：视角 + 投递队列（每条 WS 连接一个，写线程独占消费）。
    队列设上限：消费端卡死（标签页冻结/JS 停摆）时满即断连——断开比让广播
    线程陪葬好，重连有快照，历史不丢。
    会话订阅（2026-09-21）：view='god:<host>' 时 god_host=宿主名、sess=解析出
    的具体 (host, sid)（绑定换绑后由 _push_snapshot 重解析跟随）；sess 非空的
    订阅者由 _broadcast_sess 按会话维度投递。"""
    __slots__ = ('job_id', 'view', 'q', 'ws', 'god_host', 'sess', '_via_god',
                 'echo_view')

    def __init__(self, job_id, view, ws=None, maxsize=None):
        self.job_id = int(job_id) if job_id is not None else None  # None=跟随最新场
        self.view = view or 'god'
        self.q = queue.Queue(_SUB_Q_MAX if maxsize is None else maxsize)
        self.ws = ws
        self.god_host = None   # 'god:<host>' 视角的宿主名（其余视角 None）
        self.sess = None       # 解析出的具体会话 (host, sid)；god:<host> 未解析到=None
        self._via_god = False  # 裸 god 升级订户（2026-09-22）：快照/直播跟会话账走
        self.echo_view = None  # 本订阅当前视角的规范 id（_resolve_god_sub 回填）


class ProjectionHub:
    """投影中心本体。线程安全：一把锁护 books/live/subs，广播走订阅者队列。"""

    def __init__(self, data_dir: str = None):
        self.dir_path = data_dir or PROJECTION_DIR
        self._lock = threading.RLock()
        self._books = {}   # job_id -> _JobBook
        self._sbooks = {}  # (host, sid) -> _JobBook（会话账本，2026-09-20）
        self._live = {}    # (job_id, key) -> block dict
        self._subs = set()
        self._cast = {}     # job_id → 花名册（flow_start 的剧本 actors）
        self._display = {}  # job_id → {基名: 带括号显示名}（ai_request 登记）
        self._owners = {}   # job_id → {host: {sid,...}} 本场信任来源（戏外行过滤；
                            # host 空串=老宿主/裸跑的全局格，见 set_owner/_owner_for）
        self._hosts = {}    # host 名 → 最近活动时刻（见到即登记；多宿主名册面）
        self._host_caps = {}   # host 名 → {god_window: bool} 宿主申报的能力（缺 host=全按缺省）
                               # god_window：上帝视角窗（投影中心行协议 §6）。hub 不替宿主
                               # 猜——没申报的宿主按「有」办（老宿主零回归）。内存账：随
                               # 客户端重连的 /hub-register 自愈，不落盘（与 _hosts 同命运）
        self._owner_resolver = None   # 桥注入：job_id → 从 job 档案取 host_ref 登记
                                      # （hub 是纯标准库，不认识 job 档案；见 feed 懒登记）
        self._last_job = None
        self._last_session = None   # (host, sid)：本进程最近说话的会话（god 缺省指针）
        self._bindings = None       # {host: {current, mains}}：主 session 榜单（懒加载 bindings.json）
        self._roster = None         # {host: {sid: {name, since_t, active, job}}}：FEMO 会话名册
                                    # （懒加载 roster.json；宿主经 /sessions/announce 上报，
                                    #  主会话面板的下拉数据源，2026-09-21）
                                    # cast-preferences 不设内存字段：选角账每次现读盘
                                    # （文件=唯一正身，见 _load_cast_prefs）
        self._roster_order = None   # {host: [sid,...]}：宿主 UI 顺序（宿主说它的界面
                                    # 怎么排咱们就怎么排；hub 只存不判）
        self._server = None
        self._wssocks = set()
        # 挂载路由（第2步 常驻引擎增量A）：外部面（daemon 的 /cmd 命令面）借道
        # 本服务器——一张嘴一个端口一本发现账（hub.json 不造第二本）。hub 只提供
        # 通用挂载机制，不认识挂上来的东西是什么（hub 不喂引擎纪律不动）。
        self._mounted = []
        # print 旁路（2026-09-19）：桥进程 stdout/stderr 的镜像环 + 自增序号
        self._prints = deque(maxlen=_PRINT_CAP)
        self._print_seq = 0
        # 人类等待镜像（2026-09-20 投影页人类输入；2026-10-02 复数化）：EventProjector
        # 经 set_waiting 推入；快照捎带 + ctrl:waiting 广播 + POST /api/human-input
        # 的校验面。形态=有序 dict {wait_key: 席位状态}——par 并发多条线各自等到
        # 人类时全部在册（标量时代第二席覆盖第一席、先等者交不了卷的根因修）；
        # 插入序=human_wait 到达序，投影页底部停靠照此排。
        self._waiting = {}
        # 驿站模块由桥注入（hub 保持纯标准库，不 import 兄弟件）；None=不可用。
        self._mailbox = None
        # 草稿批内攒推旗（2026-09-30 修「思考链行上下跳」）：None=不在批内（草稿
        # 一变立即推）；set=正在处理一批 feed 帧——_push_drafts 只记账不广播，
        # 批尾统一推一次。drop+delta 是两帧，「drop 那拍槽暂时不在」的中间态若
        # 逐帧广播，页面就看见思考链行闪没又闪回；攒到批尾页面只见终态。
        self._draft_hold = None
        # 门铃簿活心跳宿主名的 callable（daemon 注入，同上依赖倒置）：cast
        # 在线视图（cast_preferences_view scope='online'）的唯一在线判据——
        # 报到即算在线，无论有无门牌。None=没注入，online 视图退化为全账。
        self._doorbell_live_hosts = None
        # 信箱宿主 id（2026-09-24 多实例并存）：桥注入（=桥的 args.host），
        # 寄人类信的 target_host 用它——与本桥 drain_outgoing 的过滤词同源。
        # 空=回退旧行为（拿等待记录的 host 字段即投影自称；单实例两词本同值）。
        self._mailbox_host = ''

    # ── 上行 ──────────────────────────────────────────────────────────

    def register_host(self, name, god_window=None) -> str:
        """宿主注册自己的名字（2026-09-19 用户拍板：宿主自报名字，hub 只收不管）。

        「femo-plugin 作为插件注册进各个 host 的时候，也同时让 host 在 hub 这儿
        注册一下名字」——names 就取宿主能力清单 host.manifest.json 里那个
        `"host": "dsh"`（现成词汇，不新发明）。hub 不写白名单：接新宿主 = 它报个
        新名字。名字同时是行/段键/信任集的命名空间标签，故过 _norm_host 归一。
        返回归一后的名字（''=没名字，退回老行为）。

        god_window=宿主申报的上帝视角窗能力（2026-09-28）：清单里声明了布尔才
        传，None=没申报（保留已有申报不动；首次见到即落「有」缺省）。申报经由
        直连客户端 /hub-register 随登记上来，读自同一份清单的 god_window 字段。"""
        host = _norm_host(name)
        if host:
            with self._lock:
                self._hosts[host] = time.time()
                if god_window is not None:
                    self._host_caps.setdefault(host, {})['god_window'] = bool(god_window)
        return host

    def _has_god_window(self, host) -> bool:
        """该宿主申报了上帝视角窗吗（缺申报=有，2026-09-28）。持锁调用。"""
        return bool((self._host_caps.get(host) or {}).get('god_window', True))

    def set_owner_resolver(self, fn) -> None:
        """注入「本场信任来源解析器」：fn(job_id) → 自行调 set_owner 登记。
        桥在启动时注入（它才认识 job 档案）；hub 保持纯标准库。"""
        self._owner_resolver = fn

    def hosts(self) -> list:
        """见过的宿主名册（按名字排序）：页面/排障面看「这个 hub 管着谁」。"""
        with self._lock:
            return [{'name': h, 'last_t': int(t * 1000)}
                    for h, t in sorted(self._hosts.items())]

    def _mounts_path(self) -> str:
        """挂载共同账本路径（2026-10-04）：<数据根>/mounts.json——数据根=投影
        目录的上一层（投影账本住 <数据根>/projection/，mounts.json 与
        femo_files.json 同层，mount-registry.mjs 单点写、hub 只读）。"""
        return os.path.join(os.path.dirname(os.path.abspath(self.dir_path)),
                            'mounts.json')

    def host_book(self, job_id) -> dict:
        """本场的来源账（排障面）：host → 该格的信任 sid 集。
        host 空串=老宿主/裸跑（键 'default'）。持锁调用。"""
        job_id = int(job_id)
        with self._lock:
            self._cast_of(job_id)
            fam = self._owners.get(job_id) or {}
            return {(h or 'default'): sorted(v) for h, v in fam.items() if v}

    def _book(self, job_id: int) -> _JobBook:
        """取账本，懒加载（首次摸到即从磁盘种子）。持锁调用。"""
        book = self._books.get(job_id)
        if book is None:
            book = self._books[job_id] = _JobBook(job_id, self.dir_path)
        book.touched = time.time()
        return book

    def _sbook(self, host: str, sid: str) -> _JobBook:
        """取会话账本，懒加载（2026-09-20 会话账本改造）。持锁调用。"""
        key = (host, sid)
        book = self._sbooks.get(key)
        if book is None:
            book = self._sbooks[key] = _JobBook(
                sid, self.dir_path, rel=os.path.join('sessions', host))
            book.sess = key
        book.touched = time.time()
        return book

    def feed(self, job_id, frames, source: str = '') -> dict:
        """宿主唯一上行口：一批 帧/行 原子性不强求，逐帧按序处理。
        被拒帧逐条回报进 failed（[{index,reason}]）——喂方按 index 只补失败帧；
        未知 op 照旧不处理（向前兼容），但会让喂方看得见，不再静默。

        source = **来源宿主名**（2026-09-19 联机改造启用）：进段键与幂等键的
        命名空间、进 owner 信任集、喂信任过滤；【刀1 2026-09-26】job 账本行不再
        盖此章（行级归属单源=段键），会话账本行保留。空值=老宿主/裸跑，行为退回
        改造前（键不带 host 段、owner 不过滤）。"""
        job_id = int(job_id)
        host = _norm_host(source)
        appended = 0
        updated = 0
        skipped = 0
        failed = []
        with self._lock:
            self._last_job = job_id
            if host:
                self._hosts[host] = time.time()   # 见到即登记（host 名册的自发现面）
            # 信任来源懒登记（2026-09-19 联机改造）：本帧这个 host 还没被认识时，
            # 借桥注入的解析器去 job 档案取 host_ref。多宿主共演时第二台第一次 feed
            # 就走这条路被学会——不然它的戏外行会被 _foreign_owner_row 当"别人的
            # 会话"在下面的循环里 skipped 丢弃（表现为另一台的用户发言与导演轮无声
            # 消失）。判据按**host 格**（不是"本场有没有来源"）：否则头一台登记完，
            # 后面每一台都会被判成"已有来源"而永远学不会；代价是同一 host 的后续
            # feed 可能多问几次档案（解析器自己幂等，且它由桥提供——hub 保持纯标准库）。
            if host and not self._owner_for(job_id, host) and self._owner_resolver is not None:
                try:
                    self._owner_resolver(job_id)
                except Exception:  # noqa: BLE001 — 解析器是旁路，绝不挡演出
                    pass
            self._sweep(job_id)   # feed 就是心跳：顺手做家务（收尸+逐出冷账本）
            book = self._book(job_id)
            targets = self._weave_targets(job_id)   # 织入目标：信任集全部 (host,sid) 格
            if not isinstance(frames, list):
                raise ValueError('frames must be a list')
            self._draft_hold = set()   # 批内攒推：草稿 row-update 批尾统一发（页面不见 drop 中间态）
            for i, f in enumerate(frames):
                try:
                    if not isinstance(f, dict):
                        failed.append({'index': i, 'reason': 'frame not an object'})
                        continue
                    op = f.get('op')
                    if op is None and ('zone' in f or 'kind' in f or 'text' in f):
                        op = 'row'
                    if op in _SEG_OPS:
                        # 段键归一一律走 _seg_ref（它对显式 seg 是幂等的：带 host 的原样、
                        # 裸键补 host）。**不能只在"帧没带 seg"时才归一**——桥的
                        # EventProjector 会带裸键来（_seg_key 产 w:<wait_key>），宿主喂
                        # draft 只报 wait_key，两条路靠这一处汇成同一套键；漏掉前者就是
                        # 孪生段（job 1927：journal 无 host、drafts 有 host，逐字流挂不上）。
                        seg_ref = _seg_ref(f, host)
                        if seg_ref and seg_ref != f.get('seg'):
                            f = dict(f, seg=seg_ref)   # 段引用归一（补 host / wait_key → 段键）
                    # 跨会话过滤（唯一收口处）：段帧同样要过——宿主轮段键里写着它属于
                    # 哪个 dsh 会话（h:<sid>:…），别的会话的戏外轮绝不能混进本场
                    # （2026-09-19 实锤：job 1856 账本里混进了 session-d052de57 的两个
                    # 宿主轮容器——老的行过滤只认 src_seq=main:<sid>，压不住段帧）。
                    # 【会话账本】必须挡在路由**之前**：别会话的戏外帧既不进本场
                    # job 账本、也绝不许织入本场的会话账本。
                    chk = f.get('row') if op == 'fill-slot' else f
                    if (op == 'row' or op in _SEG_OPS or op == 'fill-slot') \
                            and isinstance(chk, dict) \
                            and self._foreign_owner_row(job_id, chk, host):
                        skipped += 1
                        continue
                    zone = self._frame_zone(book, f, op)
                    if zone == 'outside' and targets:
                        # 【会话账本·改道】owner 已登记的戏外帧只进会话账本（织入带
                        # job 标）——job 账本里的 outside 行唯一读者是 god，而 god 读法
                        # 已整体迁去会话账本；owner 未登记时 targets 为空，自然回落
                        # job 账本（老档案/裸跑防丢，行为同改前）。
                        if self._weave(job_id, f, op, host, targets):
                            appended += 1
                        continue
                    res = self._apply_frame(book, f, op, host)
                    if res == 'appended':
                        appended += 1
                    elif res == 'updated':
                        updated += 1
                    elif res == 'skipped':
                        skipped += 1
                    if targets and zone in ('inplay', 'meta'):
                        # 【会话账本·织入】inplay/meta 的副本按时序进开戏会话的账本
                        # （带 job_id 标）：上帝窗=会话账本的唯一读法，一场戏由此织进
                        # 会话的一生。幂等靠会话账本自己的 src_seq/段键查重。
                        self._weave(job_id, f, op, host, targets)
                    # op=None 且不带行字段：哑帧，静默忽略（原语义）
                except Exception as exc:  # noqa: BLE001 — 单帧坏不拖累整批
                    failed.append({'index': i,
                                   'reason': str(exc) or exc.__class__.__name__})
            self._flush_draft_holds()   # 批尾统一推（攒下的草稿段一次发终态）
            self._persist_drafts(book)   # 节流刷旁账（首批草稿即刻落，之后 _DRAFT_FLUSH_SEC 一次）
        return {'ok': True, 'job_id': job_id, 'appended': appended,
                'updated': updated, 'live': self.live_count(job_id),
                'skipped': skipped, 'failed': failed}

    def feed_session(self, session, frames, source: str = '') -> dict:
        """会话寻址上行口（2026-09-20 会话账本改造）：宿主把「用户↔主 Agent」的
        戏外内容按会话直投——**无戏照收**，录制不等开戏也不等绑定（录制与展示
        分离）。与 feed() 同一套帧分诊（_apply_frame），落
        sessions/<host>/<sid>/journal.jsonl，n 由会话账本自分配（本窗排序权威）。
        无 job 语义：不动 _last_job（无戏聊天绝不能劫走「跟随最新场」的 WS 订阅）、
        无信任集过滤（按 sid 定址天然隔离）、无 owner 懒登记。
        session='host:sid'；source 仅在地址缺 host 段时兜底行的 host 标。"""
        host, sid = _split_session(session)
        if sid is None:
            return {'ok': False, 'error': 'session must be "host:sid"'}
        if not host:
            host = _norm_host(source)
        appended = updated = skipped = 0
        failed = []
        with self._lock:
            if host:
                self._hosts[host] = time.time()
            self._binding_touch(host, sid)     # 榜单自动收录（首见即记；current 空缺才补）
            self._last_session = (host, sid)   # god 缺省指针（内存态；不动 _last_job）
            self._sweep(keep_sess=(host, sid))
            book = self._sbook(host, sid)
            if not isinstance(frames, list):
                raise ValueError('frames must be a list')
            self._draft_hold = set()   # 批内攒推：同 feed()
            for i, f in enumerate(frames):
                try:
                    if not isinstance(f, dict):
                        failed.append({'index': i, 'reason': 'frame not an object'})
                        continue
                    op = f.get('op')
                    if op is None and ('zone' in f or 'kind' in f or 'text' in f):
                        op = 'row'
                    if op in _SEG_OPS:
                        seg_ref = _seg_ref(f, host)
                        if seg_ref and seg_ref != f.get('seg'):
                            f = dict(f, seg=seg_ref)   # h:<sid>:… 显式键原样过；裸键补 host
                    res = self._apply_frame(book, f, op, host, session_mode=True)
                    if res == 'appended':
                        appended += 1
                    elif res == 'updated':
                        updated += 1
                    elif res == 'skipped':
                        skipped += 1
                except Exception as exc:  # noqa: BLE001 — 单帧坏不拖累整批
                    failed.append({'index': i,
                                   'reason': str(exc) or exc.__class__.__name__})
            self._flush_draft_holds()   # 批尾统一推（同 feed()）
            self._persist_drafts(book)
        return {'ok': True, 'session': '%s:%s' % (host, sid), 'appended': appended,
                'updated': updated, 'live': 0, 'skipped': skipped, 'failed': failed}

    # ── 会话账本路由与织入（2026-09-20）────────────────────────────────
    # 上帝视角改绑 (host, 主会话)：会话账本=sessions/<host>/<sid>/，god 的唯一
    # 读法。job 寻址的帧在 feed() 里按 zone 收口：inplay/meta → job 账本 + 织入；
    # outside → owner 已登记时改道会话账本（owner 未登记回落 job 账本防丢）。
    # 归属跟戏走（信任集 host_ref），与绑定无关。

    def _frame_zone(self, book: _JobBook, f, op):
        """本帧的内容区（路由判定）：row/seg-open=帧自带 zone；seg-fill/seg-close
        与 draft-*=按段开块时登记的 zone（段不在账内按 inplay——引擎段恒戏内）；
        无段引用的 draft 帧（全场清一类）与其余 op 返回 None=不参与路由、不织入
        （全场 draft-drop 织入会误清会话账本的导演轮草稿）。持锁调用。"""
        if op == 'row' or op == 'seg-open':
            z = f.get('zone') or 'inplay'
        elif op in ('seg-fill', 'seg-close', 'draft-start', 'draft-delta', 'draft-drop'):
            seg = str(f.get('seg') or '')
            if not seg:
                return None
            z = book.seg_zone.get(seg, 'inplay')
        else:
            return None
        return z if z in ZONES else 'inplay'

    def _weave_targets(self, job_id: int) -> list:
        """本场织入目标：信任集的全部 (host, sid) 格（多宿主共演各织一份）。
        owner 未登记（老档案/裸跑）→ []：inplay/meta 照旧只进 job 账本、outside
        回落 job 账本（防丢）。持锁调用。"""
        self._cast_of(job_id)   # 冷启动顺带恢复信任集
        fam = self._owners.get(job_id) or {}
        return [(h, s) for h, sids in fam.items() for s in sids]

    def _weave(self, job_id: int, f, op, host: str, targets) -> bool:
        """把 job 寻址的一帧织入目标会话账本：副本带 job_id 标，**原样重放**同一套
        _apply_frame（seg-open=追加占号、seg-fill=原位改写、draft=进旁账——机制
        全部复用，没有第二套实现）。幂等靠各账本自己的 src_seq/段键查重。返回
        是否有账本真的入了账。织入是旁路：单帧失败绝不反噬主账。持锁调用。"""
        hit = False
        for (th, tsid) in targets:
            sb = self._sbook(th, tsid)
            try:
                res = self._apply_frame(sb, dict(f, job_id=job_id), op, host,
                                        session_mode=True)
                if res in ('appended', 'updated'):
                    hit = True
                self._persist_drafts(sb)   # 节流刷（与主账同纪律）
            except Exception:  # noqa: BLE001
                pass
        return hit

    def _apply_frame(self, book: _JobBook, f, op, host: str,
                     session_mode: bool = False) -> str:
        """单帧入一本账：op 分派（原 feed() 帧循环体，job/织入/会话直投三路共用）。
        返回 'appended' / 'updated' / 'skipped' / ''（哑帧）。信任集过滤与段键归一
        都归调用方（织入重放的帧已带最终段键，不得二次加 host 段——_seg_ref 对
        异 host 裸键会重复补段）。unknown op / fill-slot 缺 row 抛 ValueError，
        由调用方按单帧 failed 接住。持锁调用。
        【刀1 行章退役 2026-09-26】job 账本的行不再盖投喂者 host 章——行级归属
        单源=段键（_seg_host），两份抄本必漂移（2585 实锤：小猫咪的段标了 zcode）。
        会话账本行保留（按宿主分格是会话账本的语义本体，非归属标注）。"""
        jid = book.job_id
        stamp = host if session_mode else ''   # 行 host 章：只盖会话账本
        if op == 'row':
            return 'appended' if self._append_row(book, f, stamp) else ''
        # ── 老打字桶（live-*）：已无生产者，接收端留观（原语义）──────────
        if op == 'live-start':
            blk = {'actor': str(f.get('actor') or ''),
                   'blockKind': str(f.get('blockKind') or 'text'),
                   'name': f.get('name'), 'text': '',
                   'act': time.time()}
            self._live[(jid, str(f.get('key')))] = blk
            self._broadcast_live(jid, str(f.get('key')), blk)
            return ''
        if op == 'live-delta':
            blk = self._live.get((jid, str(f.get('key'))))
            if blk is not None:
                blk['text'] += str(f.get('text') or '')
                blk['act'] = time.time()
                self._broadcast_live(jid, str(f.get('key')), blk)
            return ''
        if op == 'live-done':
            key = str(f.get('key'))
            blk = self._live.pop((jid, key), None)
            done = {'ctrl': 'live-done', 'key': key}
            if blk is not None and blk.get('actor'):
                done['actor'] = blk['actor']
            self._broadcast(jid, done, live=True,
                            actor=str((blk or {}).get('actor') or ''))
            if blk is not None and (f.get('row') or blk.get('text')):
                if self._append_row(book, f.get('row') or _synthesize_row(blk)):
                    return 'appended'
            return ''
        if op == 'fill-slot':
            row_dict = f.get('row')
            if not isinstance(row_dict, dict):
                raise ValueError('fill-slot needs row object')
            return 'appended' if self._fill_slot(book, row_dict, stamp) else ''
        if op == 'seg-open':
            return 'appended' if self._seg_open(book, f, stamp) else ''
        if op == 'seg-fill':
            return 'updated' if self._seg_fill(book, f) else ''
        if op == 'seg-close':
            return 'updated' if self._seg_fill(
                book, {'seg': f.get('seg'), 'open': False,
                       'items': f.get('items') or [],
                       'src_seq': f.get('src_seq')}) else ''
        if op == 'draft-start':
            return 'updated' if self._draft_start(book, f) else ''
        if op == 'draft-delta':
            return 'updated' if self._draft_delta(book, f) else ''
        if op == 'draft-drop':
            return 'updated' if self._draft_drop(book, f) else ''
        if op == 'live-drop':
            key = str(f.get('key'))
            blk = self._live.pop((jid, key), None)
            drop = {'ctrl': 'live-done', 'key': key}
            if blk is not None and blk.get('actor'):
                drop['actor'] = blk['actor']
            self._broadcast(jid, drop, live=True,
                            actor=str((blk or {}).get('actor') or ''))
            return ''
        if op == 'live-clear':
            for k in [k for k in self._live if k[0] == jid]:
                self._live.pop(k, None)
            self._broadcast(jid, {'ctrl': 'live-clear'}, live=True)
            return ''
        if op is not None:
            raise ValueError('unknown op: %s' % op)
        return ''   # op=None 且不带行字段：哑帧，静默忽略（原语义）

    def _foreign_owner_row(self, job_id: int, row, host: str = '') -> bool:
        """这条行/帧是不是「别的 Session」的戏外内容（该丢）——2026-09-19 用户拍板：
        只投影当前 Job 所在的那个主 Session，dsh 侧同时开着别的干活会话，那些
        对话不该进本场投影。

        判据全在行/帧自己身上（两条，任一命中即丢）：
          · `src_seq = 'main:<sid>:<seq>'`——宿主喂的戏外行（用户发言/导演回话）；
          · `seg = 'h:<sid>:<seq>'`——宿主轮的容器（段键里就写着它属于哪个会话）。
            这条是 2026-09-19 补的洞：宿主轮改成「宿主自己开容器」之后，段帧不带
            src_seq，老判据压不住，于是别的会话的戏外轮混进了正在跑的场次
            （实锤：job 1856 账本里出现 session-d052de57 的两个容器）。
        本场主会话 sid = 本 Job 档案里的 host_ref（桥在 flow_start 现场登记，
        job_manager 落盘、引擎不懂），与它对不上即丢。桥喂的戏内行（speech:/
        human: 前缀、w:<wait_key> 段、narrate 无 src_seq）一律不受影响；owner
        未登记（老桥/老档案）时放行——退回不过滤的老行为，绝不误杀。持锁调用。

        【host 维度的信任集·2026-09-19 联机改造】信任集按来源宿主分格：本帧的
        host 报什么，就查那一格。多宿主共演同一场时，**每台各登记各的 host_ref
        ——两边都能过**（改前只有单值 sid：B 台喂来的戏外行会被当"别人的会话"
        在 feed 期 skipped 丢弃、不入账，联机时表现为「另一台的用户发言和导演
        轮无声消失」）。host 为空（老宿主）回落全局格 ''，行为与改前一致。"""
        if not isinstance(row, dict):
            return False
        row_host = _norm_host(row.get('host')) or host
        owner = self._owner_for(job_id, row_host)
        if not owner:
            self._cast_of(job_id)      # 冷启动：顺带从 cast.json 恢复 owner
            owner = self._owner_for(job_id, row_host)
        if not owner:
            return False
        seg_sid = _host_seg_sid(row.get('seg'))
        if seg_sid:
            return seg_sid not in owner
        src = row.get('src_seq')
        if not isinstance(src, str) or not src.startswith('main:'):
            return False
        sid = src.split(':', 2)[1] if src.count(':') >= 2 else ''
        return bool(sid) and sid not in owner

    def _owner_for(self, job_id: int, host: str = '') -> set:
        """本场该 host 格子的信任 sid 集（可能空）。host 空 → 全局格 ''。持锁调用。"""
        fam = self._owners.get(job_id)
        if not fam:
            return set()
        return set(fam.get(host) or fam.get('') or ())

    def set_owner(self, job_id, owner_sid, host: str = '') -> None:
        """本场主会话登记（桥在 flow_start 现场喂 job 档案的 host_ref）：
        内存 + cast.json 落盘（冷启动随花名册一起恢复，桥重启也不用重喂）。

        信任集是**多值 + 按 host 分格**的：同一场可以登记多台宿主的 host_ref
        （联机共演），各自只让自己那格的 sid 过。host 空串 = 老宿主/裸跑，
        记在全局格 ''（该场任何来源都用这一格兜底）。"""
        job_id = int(job_id)
        owner = str(owner_sid or '').strip()
        if not owner:
            return
        host = _norm_host(host)
        with self._lock:
            fam = self._owners.get(job_id)
            if fam is None:
                # 冷启动：先把盘上的登记捞回本进程，免得覆盖丢历史
                self._cast_of(job_id)
                fam = self._owners.setdefault(job_id, {})
            bucket = fam.setdefault(host, set())
            fresh = owner not in bucket
            bucket.add(owner)
            # 「跟最新」收尾（2026-10-03，见 _follow_latest_god）：本场=最新
            # （新场 id 恒增，>= 兜住 job_start 先于 flow_start 行的先后序）时，
            # 跟随模式的升级订户重对家——新场开在别家宿主，老订阅不动=新场内容
            # 全盲（AI 不出字、等待座位却照出现）。
            if job_id >= (self.latest_job() or 0):
                self._follow_latest_god(job_id)
            # 主 session 榜单自动收录（2026-09-20 会话账本）：开戏=该会话是投影
            # 材料——织入归属的同一枚 (host, sid) 进 bindings 的 mains。
            self._binding_touch(host, owner)
            if not fresh:
                return
            self._persist_meta(job_id)

    def has_owner(self, job_id, host: str = '') -> bool:
        """本场登记过信任来源没有（桥的懒登记判据：有行流入的场次一律补齐）。
        传 host → 问该格；不传 → 问**任意格**（本场是否已认识来源，联机时第二台
        的懒登记判据也走这条，不因"头一格不是我"而误判为没人登记）。
        持锁调用；冷启动顺带从 cast.json 恢复。"""
        job_id = int(job_id)
        with self._lock:
            if host:
                if self._owner_for(job_id, _norm_host(host)):
                    return True
                self._cast_of(job_id)
                return bool(self._owner_for(job_id, _norm_host(host)))
            if self._owners.get(job_id):
                return True
            self._cast_of(job_id)
            return bool(self._owners.get(job_id))

    # ── 主 session 榜单与绑定（bindings.json，2026-09-20 会话账本）────────
    # 「每个宿主唯一主 session、可换绑」：current=当前主 session（god 缺省看它），
    # mains=历届主 session 榜单（开戏 set_owner 自动收录 + 会话 feed 首见 + 显式
    # 换绑）。**录制从不依赖绑定**——绑定只是展示层「看哪本」的指针；未绑定时
    # god 缺省回落最近活动的会话账本。

    def _bindings_path(self) -> str:
        return os.path.join(self.dir_path, 'bindings.json')

    def _load_bindings(self) -> dict:
        if self._bindings is None:
            try:
                with open(self._bindings_path(), encoding='utf-8') as f:
                    data = json.load(f)
                self._bindings = data if isinstance(data, dict) else {}
            except (OSError, ValueError):
                self._bindings = {}
        return self._bindings

    def _persist_bindings(self) -> None:
        """bindings.json 原子落盘（tmp+replace：整写小件同 cast.json 先例；
        journal 原位改写的 tmp+replace 禁令只针对常开句柄的主账）。持锁调用。"""
        try:
            tmp = self._bindings_path() + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(self._bindings or {}, f, ensure_ascii=False)
            os.replace(tmp, self._bindings_path())
        except OSError:
            pass

    def _binding_touch(self, host: str, sid: str) -> None:
        """榜单自动收录：mains 幂等追加；该宿主还没有 current 时补 current
        （首见即主）。显式换绑走 bind()。持锁调用。"""
        if not host or not sid:
            return
        b = self._load_bindings().setdefault(host, {'current': None, 'mains': []})
        changed = False
        if sid not in b.get('mains', []):
            b.setdefault('mains', []).append(sid)
            changed = True
        if not b.get('current'):
            b['current'] = sid
            changed = True
        if changed:
            self._persist_bindings()

    def bind(self, session: str) -> dict:
        """显式换绑主 session（POST /bind {"session":"host:sid"}；WS ctrl 'bind'
        与宿主「说话即绑」公告同汇于此——**说话即绑走 announce 路径不联动**，
        只有这条显式换绑路带跨宿主联动）。换绑只动「看哪本」的指针：老账本定格
        为档案，新账本从自己的历史接着长（录制从未停过，换绑即见全史），账本
        永不合并。联动（2026-09-22 用户拍板）：换绑后找到该会话最新场次，这场
        戏的班底（cast.json owners 账本）里其他宿主的主 session 一并设过去，
        与这场戏无关的已知宿主 current 清空（面板显示「-」）。"""
        host, sid = _split_session(session)
        if sid is None:
            return {'ok': False, 'error': 'session must be "host:sid"'}
        with self._lock:
            self._bind_locked(host, sid)
            job = self._session_latest_job(host, sid)
            linked = self._link_job_owners(job, keep_host=host) if job is not None else 0
            self._notify_bind(host, focus_job=job)
        try:
            print('[god-view] bind %s:%s 最新场=%s 联动=%d 宿主 绑定=%s'
                  % (host, sid[:24], job, linked,
                     json.dumps(self.bindings_view(), ensure_ascii=False)))
        except Exception:
            pass
        return {'ok': True, 'host': host, 'current': sid, 'job': job, 'linked': linked}

    def _bind_locked(self, host: str, sid: str) -> None:
        """换绑落账（bindings.json 原子写；mains 幂等收录）。持锁调用。"""
        b = self._load_bindings().setdefault(host, {'current': None, 'mains': []})
        if sid not in b.get('mains', []):
            b.setdefault('mains', []).append(sid)
        b['current'] = sid
        self._persist_bindings()

    # ── 主 session ↔ 场次 跨宿主联动（2026-09-22 用户拍板）────────────────
    # 全局只有一个「当前戏」语境：改任何宿主的主 session → 顺藤（名册里宿主
    # 上报的该会话最新场次）找到场次 → 这场戏的班底账本（cast.json 的 owners：
    # job → {host: [sid,…]}，桥在开演现场喂的 host_ref）里其他宿主的主 session
    # 一并设过去；与这场戏无关的已知宿主 current 清空——面板显示「-」（
    # god:<host> 解析对空 current 有「回落最近会话账本」的兜底，清了不瞎）。
    # 反向：改场次 → 直接按 owners 账本给每个已知宿主设它那格的主 session
    # （未必是该会话的最新场，账本说了算）。**联动只挂显式动作**（面板选中/
    # POST /bind/改场次）；「说话即绑」只动说话那台——不然两台轮流说话会把
    # 对方面板来回掰。

    def _session_latest_job(self, host: str, sid: str):
        """名册里宿主上报的该会话最新场次（找不到/没报过 → None）。持锁调用。"""
        entry = (self._load_roster().get(host) or {}).get(sid) or {}
        job = entry.get('job')
        return int(job) if isinstance(job, int) and job > 0 else None

    def _known_hosts(self) -> set:
        """面板上有行的宿主（名册 ∪ 绑定；空 host=老宿主全局格不算）。持锁调用。"""
        hosts = set(self._load_roster().keys())
        hosts.update(self._load_bindings().keys())
        hosts.discard('')
        return hosts

    def _link_host(self, host: str, sids: set) -> bool:
        """单个宿主按班底账本设绑：集里有它 current 就不动（少一次落盘）；
        否则取排序首位（落盘即 sorted，稳定）；空集清 current（面板「-」）。
        返回是否动了账。**只做本宿主，不再二级传播**。持锁调用。"""
        b = self._load_bindings().setdefault(host, {'current': None, 'mains': []})
        cur = b.get('current')
        if cur and cur in sids:
            return False
        nxt = sorted(sids)[0] if sids else None
        if (cur or None) == nxt:
            return False
        if nxt is not None and nxt not in b.get('mains', []):
            b.setdefault('mains', []).append(nxt)
        b['current'] = nxt
        self._persist_bindings()
        return True

    def _link_job_owners(self, job_id, keep_host: str = None) -> int:
        """把 job_id 的班底设到每个已知宿主的绑上（keep_host=发起方显式选择，
        用户选的那个赢过账本不动它）。班底里出现名册/绑定之外的新宿主也收
        （开过戏就是面板一行）。空账本（这场戏没登记过 host_ref）= 零联动。
        返回联动到的宿主数。持锁调用。"""
        if job_id is None:
            return 0
        job_id = int(job_id)
        self._cast_of(job_id)                    # 冷启动懒恢复信任集
        fam = self._owners.get(job_id) or {}
        hosts = self._known_hosts()
        hosts.update(h for h in fam.keys() if h)
        n = 0
        for h in sorted(hosts):
            if keep_host is not None and h == keep_host:
                continue
            self._link_host(h, set(fam.get(h) or ()))
            n += 1
        return n

    def bind_job(self, job) -> dict:
        """改场次联动（WS ctrl 'bind-job'）：job 空 = 跟最新。按 owners 账本
        给每个已知宿主设它那格的主 session（未必是该会话的最新场）；账本里
        没有的宿主 current 清空（面板「-」）。落账后 _notify_bind 广播。"""
        with self._lock:
            if job is None or str(job).strip() == '':
                jid = self.latest_job()
            elif str(job).strip().isdigit():
                jid = int(str(job).strip())
            else:
                jid = None
            if jid is None:
                return {'ok': False, 'error': 'no such job'}
            n = self._link_job_owners(jid)
            self._notify_bind(set(self._known_hosts()), focus_job=jid)
        try:
            print('[god-view] bind-job %s 换绑=%s'
                  % (jid, json.dumps(self.bindings_view(), ensure_ascii=False)))
        except Exception:
            pass
        return {'ok': True, 'job': jid, 'linked': n}

    def _notify_bind(self, host, focus_job=None) -> None:
        """换绑后的收尾广播（持锁调用）：①ctrl 'sessions' 播给全部订阅者——
        各页面主会话面板当场刷新；②god:<host> 订阅者当场重解析绑定并推新快照
        ——面板里一点，上帝窗立刻跟过去（旧语义只有手动 ctrl:view 才重解析）。
        host 可传单个宿主名或宿主集合（跨宿主联动一次动好几台）。
        focus_job=这次换绑围绕的场次（bind/bind_job 传入）：**视角跟随**
        （2026-09-22 用户拍板）——订阅的宿主与这场无关（绑定被清）时，god 订阅
        自动跟到这场班底的宿主（选 j2084 独属 standalone → god:dsh 跟成
        god:standalone），echo 让页面菜单高亮同步。说话即绑不带 focus_job，
        只动说话那台。取数自取锁（RLock 可重入），put_nowait 不阻塞。"""
        hosts = {host} if isinstance(host, str) else set(host or ())
        payload = json.dumps(self.sessions_payload(), ensure_ascii=False)
        for sub in list(self._subs):
            try:
                sub.q.put_nowait(payload)
            except queue.Full:
                pass
        targets = None
        if focus_job is not None:
            self._cast_of(int(focus_job))
            # 跟随目标读视角规则单源（2026-10-03 收 view_plan）：本场班底 ∩
            # god_window 申报。跟到一家没申报的，页面会把视角 echo 到清单里不
            # 存在的 god:<host>，与回落逻辑打架来回横跳；班底里没有一家申报了
            # 上帝窗 → targets 空=没得跟就不跟，内容由会话账本空的兜底（读那场
            # job 账本）接住。plan 持锁可调（RLock 可重入）。
            targets = self.view_plan(int(focus_job))['god_hosts']
        for sub in list(self._subs):
            if getattr(sub, 'god_host', None) is None:
                continue
            if focus_job is not None and targets and sub.god_host not in targets:
                cur = str((self._load_bindings().get(sub.god_host) or {})
                          .get('current') or '')
                if not cur:
                    # 宿主与这场无关（绑定被联动清空）→ 视角跟到班底宿主
                    sub.god_host = targets[0]
                    sub.echo_view = 'god:%s' % targets[0]
            # 统一走 _push_snapshot（2026-09-22）：旧手写帧固定 job=None、
            # 没有「session 账本空 → 兜底读那场 job 账本」——换绑后推的空帧
            # 会把订阅方刚收到的兜底帧覆盖掉（「点哪个显示的不是那场」的
            # 收尾一环）。带 echo 让页面视角 id 同步校正。
            _HubHandler._push_snapshot(self, sub, 0, via_god=True)

    def bindings_view(self) -> dict:
        with self._lock:
            return {h: {'current': b.get('current'),
                        'mains': list(b.get('mains') or [])}
                    for h, b in self._load_bindings().items()}

    # ── FEMO 会话名册（roster.json，2026-09-21 主会话面板）────────────────
    # 「哪些会话算 FEMO 会话」是宿主方言（dsh=选了 femo 预设的会话，宿主侧
    # session-roster.ts 判定上报；zcode 以后实现自己的 announcer），hub 只记账
    # 出清单。与 bindings 分家各管一件事：名册=名单（宿主说了算），bindings=
    # 「主 session 是谁」的展示指针（面板选中/宿主说话即绑说了算）。

    def _roster_path(self) -> str:
        return os.path.join(self.dir_path, 'roster.json')

    def _load_roster(self) -> dict:
        """懒加载 roster.json，回填 _roster/_roster_order 两本。新形状
        {"hosts":…, "order":…}；旧形状（裸 {host: entries}，order 诞生前的档）
        自愈迁移——order 缺席=hub 首见序，宿主下次带 order 的公告覆盖。"""
        if self._roster is None or self._roster_order is None:
            hosts, order = {}, {}
            try:
                with open(self._roster_path(), encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    if isinstance(data.get('hosts'), dict):
                        hosts = data['hosts']
                        if isinstance(data.get('order'), dict):
                            order = data['order']
                    else:
                        hosts = data
            except (OSError, ValueError):
                pass
            self._roster = {h: (v if isinstance(v, dict) else {})
                            for h, v in hosts.items()}
            self._roster_order = order
        return self._roster

    def _persist_roster(self) -> None:
        """roster.json 原子落盘（tmp+replace：整写小件，同 bindings.json）。持锁调用。"""
        try:
            tmp = self._roster_path() + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump({'hosts': self._roster or {},
                           'order': self._roster_order or {}}, f,
                          ensure_ascii=False)
            os.replace(tmp, self._roster_path())
        except OSError:
            pass

    def roster_view(self) -> dict:
        """{host: [{sid, name, active, since_t, job}]}——**按宿主上报的 UI 顺序**
        （order 段；宿主界面咋排咱就咋排，hub 只存不判）。order 缺席的 sid 垫
        末尾（hub 首见序）。job=宿主报的该会话最新场次。持锁调用。"""
        with self._lock:
            self._load_roster()
            out = {}
            for h, entries in (self._roster or {}).items():
                seq = [s for s in ((self._roster_order or {}).get(h) or [])
                       if s in entries]
                seq += [s for s in entries if s not in set(seq)]
                out[h] = [dict(sid=sid, name=str(entries[sid].get('name') or ''),
                               active=bool(entries[sid].get('active', True)),
                               since_t=entries[sid].get('since_t'),
                               job=entries[sid].get('job'))
                          for sid in seq]
            return out

    # ── 会话↔角色绑定（cast 选角账，2026-09-25；提名制改判 2026-09-26）────
    # 两段式的 hub 半场：提名账（cast-preferences.json，按宿主分格、跨 Job）
    # + Job 选角账（cast/<jobId>.json，(soul → session) 对）。账本正身——
    # 宿主派工分流、投影中心「本尊出演」标注、名册绑定展示都读它。
    # 提名制（2026-09-26 改判，废 09-25「唯一占用」）：偏好是票不是锁——多个
    # 会话可同时提名同一个 soul；开演定格按 seq 选出唯一演员（最后一次指派
    # 算数）写进该场选角账，演出中冻结，戏散了没有任何锁残留。投递按
    # (job, soul) 查选角账、永不读提名账——多会话同好不产生投递歧义。
    # 注意与 self._cast（flow_start 的剧本演员花名册）是两回事：那是「戏里有
    # 哪些角色」，这才是「角色由哪个会话演」。
    def _cast_prefs_path(self) -> str:
        return os.path.join(self.dir_path, 'cast-preferences.json')

    def _load_cast_prefs(self):
        """读 cast-preferences.json：{"seq": N, "hosts": {host: {sid: {soul, seq}}}}，
        返回 (hosts, seq)。seq=提名序号（每次提名单调递增），定格选举的唯一
        消费方；旧格式无 seq 记 0。每次现读盘——文件是唯一正身。hub 实例并存
        （桥重启自愈窗口）时，懒加载内存副本会互踩写、界面读到陈旧账（job 2578
        根因），故不缓存。"""
        hosts, seq = {}, 0
        try:
            with open(self._cast_prefs_path(), encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, dict):
                if isinstance(data.get('hosts'), dict):
                    hosts = data['hosts']
                seq = int(data.get('seq') or 0)
        except (OSError, ValueError):
            pass
        return {h: (v if isinstance(v, dict) else {}) for h, v in hosts.items()}, seq

    def _persist_cast_prefs(self, prefs: dict, seq: int) -> None:
        """cast-preferences.json 原子落盘（tmp+replace，同 roster.json）。持锁
        调用；写入内容由调用方给定（=刚改过的那份），不回读任何字段。"""
        try:
            tmp = self._cast_prefs_path() + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump({'seq': int(seq), 'hosts': prefs or {}}, f, ensure_ascii=False)
            os.replace(tmp, self._cast_prefs_path())
        except OSError:
            pass

    @staticmethod
    def _cast_elect(prefs: dict) -> dict:
        """提名→当选：每个 soul 取 seq 最大的提名者（最后一次指派算数），返回
        {soul: (sid, host, seq)}。显示（cast_preferences_view）与定格
        （cast_job_snapshot）共用这一份裁决——界面与下一场开演永远同一本账。"""
        elected = {}
        for h, entries in prefs.items():
            for sid, entry in entries.items():
                soul = entry.get('soul')
                if not soul:
                    continue
                n = int(entry.get('seq') or 0)
                if soul not in elected or n > elected[soul][2]:
                    elected[soul] = (sid, h, n)
        return elected

    def cast_preference_set(self, host: str, sid: str, soul) -> dict:
        """提名/退票（soul=None 退票）。提名制：不做任何占用拒绝——多个会话可
        同时提名同一个 soul；一个会话一格，提新 soul 直接顶替（免先退票）。
        每次提名盖一枚递增 seq，谁当选由开演定格裁决。返回 {ok} 或 {ok:False, error}。"""
        host, sid = str(host or '').strip(), str(sid or '').strip()
        soul = str(soul or '').strip() or None
        if not host or not sid:
            return {'ok': False, 'error': 'host and sid required'}
        with self._lock:
            prefs, seq = self._load_cast_prefs()
            if soul:
                prefs.setdefault(host, {})[sid] = {'soul': soul, 'seq': seq + 1}
                self._persist_cast_prefs(prefs, seq + 1)
            else:
                (prefs.get(host) or {}).pop(sid, None)
                self._persist_cast_prefs(prefs, seq)
        return {'ok': True}

    def _cast_prefs_scoped(self, prefs, scope):
        """在线口径过滤（scope='online'，2026-09-28 用户拍板「分配灵魂以当前
        在线为准」）：把不在线宿主（门铃簿无活心跳）的提名整格排除——某个
        soul 更新的提名在不在线宿主上时按没提过算，只在在线宿主里挑最新。
        在线判据=门铃簿活心跳，报到即算、无论有无门牌；钩子未注入（单跑
        hub/测试）=判据缺失，原样放行（退化为全账）。"""
        if scope != 'online' or self._doorbell_live_hosts is None:
            return prefs
        live = set(self._doorbell_live_hosts() or [])
        return {h: v for h, v in prefs.items() if h in live}

    def cast_preferences_view(self, scope: str = 'all') -> dict:
        """{bindings: {soul: {sid, host}}, hosts: 分格}——网页标注与宿主
        下拉共用一份视图。bindings=每个 soul 的当选提名（seq 最大者，即下一场
        定格将选出的人）。scope='online'：先把不在线宿主的提名整格排除再选举
        （见 _cast_prefs_scoped），此时 hosts=排除后的分格。开演定格
        （cast_job_snapshot）同吃这一判据（恒按 online 口径）——界面与下一场
        开演永远同一本账。"""
        with self._lock:
            prefs, _seq = self._load_cast_prefs()
            prefs = self._cast_prefs_scoped(prefs, scope)
        elected = self._cast_elect(prefs)
        bindings = {soul: {'sid': sid, 'host': h} for soul, (sid, h, _n) in elected.items()}
        return {'ok': True, 'bindings': bindings, 'hosts': prefs}

    def _cast_job_path(self, job_id) -> str:
        return os.path.join(self.dir_path, 'cast', f'{int(job_id)}.json')

    def cast_entry_put(self, job_id, soul, sid, host: str = '') -> dict:
        """Job 选角账登记一条（幂等覆盖，账面随时反映实际执行体）。"""
        soul, sid = str(soul or '').strip(), str(sid or '').strip()
        if not soul or not sid:
            return {'ok': False, 'error': 'soul and sid required'}
        path = self._cast_job_path(job_id)
        with self._lock:
            cast = {}
            try:
                with open(path, encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, dict) and isinstance(data.get('cast'), dict):
                    cast = data['cast']
            except (OSError, ValueError):
                pass
            cast[soul] = {'sid': sid, 'host': str(host or '')}
            try:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                tmp = path + '.tmp'
                with open(tmp, 'w', encoding='utf-8') as f:
                    json.dump({'jobId': int(job_id), 'cast': cast}, f, ensure_ascii=False)
                os.replace(tmp, path)
            except OSError as exc:
                return {'ok': False, 'error': str(exc)}
        return {'ok': True}

    def cast_job(self, job_id) -> dict:
        """读一个 Job 的选角账；无档按空账返回（选角是渐进账，缺页=还没登记）。"""
        path = self._cast_job_path(job_id)
        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get('cast'), dict):
                return {'ok': True, 'jobId': int(job_id), 'cast': data['cast']}
        except (OSError, ValueError):
            pass
        return {'ok': True, 'jobId': int(job_id), 'cast': {}}

    def cast_job_snapshot(self, job_id) -> dict:
        """开演定格：提名账选举誊写进 Job 选角账（宿主在 job_start/续跑成功后
        调一次）。**以当前在线为准**（2026-09-28 用户拍板，恒按 online 口径）：
        同一 soul 多个会话提名时，只在在线宿主（门铃簿活心跳）的提名里取 seq
        最大者——不在线宿主上更新的提名按没提过算（只有 dsh 在线时，zcode 上
        更新的同 soul 提名也不管）。门铃钩子未注入（单跑 hub/测试）退化为全账。
        只补空位不覆写：选角账已有的条目（首拍定格、演出中实际执行体登记）
        原样保留，续跑重入不会把在跑的戏改彩。此刻定格——演出中改提名不影响
        已在跑的戏。"""
        with self._lock:
            prefs, _seq = self._load_cast_prefs()
            prefs = self._cast_prefs_scoped(prefs, 'online')
        elected = self._cast_elect(prefs)
        existing = self.cast_job(job_id).get('cast') or {}
        count = 0
        for soul, (sid, h, _n) in elected.items():
            if soul in existing:
                continue
            if self.cast_entry_put(job_id, soul, sid, h).get('ok'):
                count += 1
        return {'ok': True, 'count': count}

    def announce(self, source: str, upserts=None, delist=None, bind_sid=None,
                 order=None) -> dict:
        """宿主上报名册（POST /sessions/announce {source, upsert:[{sid,name,job}],
        delist:[sid], bind:"<sid>", order:[sid,…]}）。upsert 幂等（同 id 同名同
        job 跳过、改名/换 job 更新、重报即重新激活）；job=宿主 host-history 账
        里该会话的最新场次（选主会话时页面顺藤挂上那场戏）。**order=宿主 UI 的
        会话顺序**（宿主界面咋排咱就咋排——dsh 按最后活动降序照抄自己列表页；
        hub 只存不判，缺 sid 垫尾，非宿主语言一概不管）。delist 只标 active=False
        不删档（切走预设降级——dsh 没法切走预设不上报这个，语义留给 zcode）。
        bind 非空=宿主「说话即绑」一并换绑主 session（upsert 先行：新会话当拍
        就在册再上台）。**只有增量上报、没有快照覆盖**——宿主重启后内存空了
        也绝不冲掉 hub 名册。"""
        host = _norm_host(str(source or ''))
        if not host:
            return {'ok': False, 'error': 'source (host name) required'}
        ups = [u for u in (upserts or []) if isinstance(u, dict)]
        des = [str(s).strip() for s in (delist or []) if str(s).strip()]
        bsid = str(bind_sid or '').strip()
        order_sids = [str(s).strip() for s in (order or []) if str(s).strip()]
        with self._lock:
            entries = self._load_roster().setdefault(host, {})
            changed = False
            for u in ups:
                sid = str(u.get('sid') or '').strip()
                if not sid:
                    continue
                name = str(u.get('name') or '').strip()
                raw_job = u.get('job')
                job = None
                if isinstance(raw_job, bool) or raw_job is None:
                    job = None
                elif isinstance(raw_job, int):
                    job = raw_job
                elif isinstance(raw_job, str) and raw_job.strip().isdigit():
                    job = int(raw_job.strip())
                entry = entries.get(sid)
                if entry is None:
                    fresh = {'name': name, 'since_t': time.time(), 'active': True}
                    if job is not None:
                        fresh['job'] = job
                    entries[sid] = fresh
                    changed = True
                else:
                    if name and name != entry.get('name'):
                        entry['name'] = name
                        changed = True
                    if job is not None and job != entry.get('job'):
                        entry['job'] = job
                        changed = True
                    if not entry.get('active', True):
                        entry['active'] = True
                        changed = True
            for sid in des:
                entry = entries.get(sid)
                if entry is not None and entry.get('active', True):
                    entry['active'] = False
                    changed = True
            bound = None
            if bsid:
                if not entries.get(bsid):
                    entries[bsid] = {'name': '', 'since_t': time.time(),
                                     'active': True}
                    changed = True
                self._bind_locked(host, bsid)   # bindings.json 由它落盘
                bound = bsid
            if order_sids:
                # 宿主 UI 顺序：只收在本场名册里确实存在的 sid（宿主视角外的
                # 遗漏垫尾，绝不忘名）；顺序变了才落盘+广播。
                seq = [s for s in dict.fromkeys(order_sids) if s in entries]
                seq += [s for s in entries if s not in set(seq)]
                if seq != (self._roster_order or {}).get(host):
                    self._roster_order = self._roster_order or {}
                    self._roster_order[host] = seq
                    changed = True
            if changed:
                self._persist_roster()
            if bound is not None:
                self._notify_bind(host)
            active = sum(1 for e in entries.values() if e.get('active', True))
        return {'ok': True, 'host': host, 'bound': bound, 'active': active}

    def sessions_payload(self) -> dict:
        """ctrl 'sessions' 下行载荷：主会话面板的数据源（宿主清单+FEMO 名册+
        绑定+会话账本盘点）。持锁调用安全（各取数口自取锁，RLock 可重入）。"""
        with self._lock:
            lst = self.sessions_list()
            return {'ctrl': 'sessions',
                    'hosts': self._hosts_sorted(),
                    'roster': self.roster_view(),
                    'bindings': self.bindings_view(),
                    'sessions': lst,
                    'latest': lst[0]['session'] if lst else None}

    def sessions_list(self) -> list:
        """会话账本轻量盘点（**绝不物化账本**，_stat_journal 吃缓存——与 /jobs
        同纪律）：按最近活动降序。持锁调用。"""
        out = []
        root = os.path.join(self.dir_path, 'sessions')
        if os.path.isdir(root):
            for h in sorted(os.listdir(root)):
                hdir = os.path.join(root, h)
                if not os.path.isdir(hdir):
                    continue
                for s in sorted(os.listdir(hdir)):
                    jp = os.path.join(hdir, s, 'journal.jsonl')
                    if not os.path.isfile(jp):
                        continue
                    rows, first_t, last_t, hosts = _stat_journal(jp)
                    out.append({'session': '%s:%s' % (h, s), 'rows': rows,
                                'first_t': first_t, 'last_t': last_t, 'hosts': hosts})
        out.sort(key=lambda x: x['last_t'] or 0, reverse=True)
        return out

    def sessions(self) -> dict:
        """GET /sessions：会话账本清单 + 主 session 榜单 + FEMO 会话名册
        （换绑选择器/主会话面板的数据源）。"""
        with self._lock:
            out = self.sessions_payload()
            out.pop('ctrl', None)
            return out

    def _default_session(self):
        """god 缺省落脚（/view?session=default）：本进程最近说话的会话优先，
        回落盘上最近的会话账本（sessions_list 同款轻量盘点）。都没有 → ('', None)。
        持锁调用。"""
        if self._last_session is not None:
            return self._last_session
        lst = self.sessions_list()
        if lst:
            return _split_session(lst[0]['session'])
        return '', None

    def _latest_god_host(self):
        """裸 god 升级用（2026-09-22「刷新即假上帝视角」根治）：**读视角规则
        单源**——「最新场」的 plan.god_hosts 第一家（班底序）。旧实现按「最近
        活动的会话账本宿主 ∩ roster」启发式（09-22 反残渣拍板），2026-10-03
        起 god 清单规则统一收 view_plan（见其注释）：残渣账本不是任何真场的
        班底、天然进不来，比 roster 启发式更硬。计划为空（空世界）→ None。
        持锁调用。"""
        plan = self.view_plan(None)
        return plan['god_hosts'][0] if plan['god_hosts'] else None

    def _resolve_god_sub(self, vnew: str, sub: _Sub) -> str:
        """god 族订阅统一解析口（2026-09-22）：把 sub 的会话订阅状态按视角
        vnew 落定。返回**规范视角 id**——裸 god 升级成功时是 'god:<host>'（页面
        据此回显），升级失败维持 'god'（=job 订阅，老语义兜底）。'god:<host>'
        解析不到绑定也原样返回（god_host 已记下，绑上后 _notify_bind 重推）。
        设计（2026-09-22 用户拍板重申）：选了 Job = 看 Job 对应的 Session——
        换绑归 bind_job 联动（bindings.current 换成该场 owners 里的 session，
        god:<host> 重解析即跟随），裸 god 升级不掺和 job。持锁调用。"""
        if vnew == 'god':
            gh = self._latest_god_host()
            if gh:
                vnew = 'god:%s' % gh
        if vnew.startswith('god:'):
            sub.god_host = _norm_host(vnew[4:])
            sess = self._resolve_god_view(vnew)
            sub.sess = _split_session(sess) if sess else None
            sub.view = 'god'
            sub._via_god = sess is not None   # 升级订户：直播跟会话账走
        else:
            # 其余一律清会话订阅状态——**裸 god 也要清**：旧写法
            # startswith('god') 不带冒号，把裸 god 也留在 god:host
            # 订阅上，进过一次主会话视角就永远逃不回场次视角
            # （2026-09-21「切主会话后显示不变」真凶之二）。
            sub.god_host = None
            sub.sess = None
            sub.view = vnew
            sub._via_god = False
        return vnew

    def snapshot_session(self, session: str, view: str = 'god', after: int = 0) -> dict:
        """会话账本读法（GET /view?session=）：与 snapshot 同三道闸（视角过滤 +
        显示策略 + 草稿合成），**无信任集过滤**——会话账本按 sid 定址，天然隔离。
        织入行保持 zone=inplay，stage/actor 视角在会话账本上同样成立（v1 消费方
        只用 god）。session='default'/空 → 最近活动会话。"""
        with self._lock:
            if not session or str(session) == 'default':
                host, sid = self._default_session()
            else:
                host, sid = _split_session(session)
            if sid is None:
                return {'proto': PROTO_VERSION, 'session': None, 'view': view,
                        'rows': [], 'next': 0}
            book = self._sbook(host, sid)
            rows = []
            for r in book.rows:
                if r['n'] <= after or not view_filter(view, r):
                    continue
                prow = self._apply_view_policy(book, view, self._compose(book, r))
                if prow is not None:
                    rows.append(prow)
            return {'proto': PROTO_VERSION, 'session': '%s:%s' % (host, sid),
                    'view': view, 'rows': rows, 'next': book.next_n - 1,
                    'hosts': _hosts_of_rows(book.rows)}

    def _sweep(self, keep_job=None, keep_sess=None):
        """feed 心跳顺手做的家务（持锁调用，不设专职线程）：
        ①打字尸块收尸：宿主打字打到一半死掉（done/drop 永远等不到）的块，
          静置超 _LIVE_TTL 按 live-drop 同款收尸——清块不转正，广播 ctrl 撤
          页面幽灵块；
        ②冷账本逐出：超 _BOOK_TTL 没人摸的 book 从内存卸下（keep_job/keep_sess=
          正在喂的本场/本会话不逐）——真身是盘上 journal，谁再来谁懒加载回血，
          rows/src_seqs/next_n 全量重建，无状态损失。
        ③草稿收尸：静置超 _LIVE_TTL 的草稿，按直播尸块同款撤掉（桥死了、段永远
          没等到收口——收口那条路会在 _seg_fill 里把草稿转正，这里只处理没人
          来收口的残骸）。job 账本与会话账本同扫。"""
        now = time.time()
        for k in [k for k, b in self._live.items() if now - b.get('act', 0) > _LIVE_TTL]:
            blk = self._live.pop(k)
            self._broadcast(k[0], {'ctrl': 'live-done', 'key': k[1],
                                   'actor': blk.get('actor') or ''},
                            live=True, actor=str(blk.get('actor') or ''))
        for book in list(self._books.values()) + list(self._sbooks.values()):
            for seg in list(book.drafts):
                slots = book.drafts[seg]
                dead = [k for k, it in slots.items()
                        if now - float(it.get('act') or 0) > _LIVE_TTL]
                for k in dead:
                    slots.pop(k, None)
                if not slots:
                    book.drafts.pop(seg, None)
                if dead:
                    book.drafts_dirty = True
                    self._push_drafts(book, seg)
            self._persist_drafts(book, force=True)
        for jid in [j for j, b in self._books.items()
                    if j != keep_job and now - b.touched > _BOOK_TTL]:
            book = self._books.pop(jid)
            self._persist_drafts(book, force=True)
            if book._fh is not None:
                try:
                    book._fh.close()
                except OSError:
                    pass
        for sk in [k for k, b in self._sbooks.items()
                   if k != keep_sess and now - b.touched > _BOOK_TTL]:
            book = self._sbooks.pop(sk)
            self._persist_drafts(book, force=True)
            if book._fh is not None:
                try:
                    book._fh.close()
                except OSError:
                    pass

    def _append_row(self, book: _JobBook, raw: dict, host: str = '') -> bool:
        """编号→查重→落盘→广播。返回是否真的入了账。持锁调用。"""
        return self._append_row_obj(book, raw, host) is not None

    def _append_row_obj(self, book: _JobBook, raw: dict, host: str = ''):
        """同上，但把落账后的行（含分配好的 n）交回调用方。持锁调用。"""
        src = raw.get('src_seq')
        if src and str(src) in book.src_seqs:
            return None
        row = _normalize_row(raw, book.next_n, int(time.time() * 1000), host)
        book.append(row)
        if row.get('kind') == 'play_resume':
            book.resumed_seen = True   # 续跑开场行落账：冷加载遗产许可的附加闸开启
        self._emit(book, self._compose(book, row), live=False)
        if row.get('kind') == 'play_end':
            # 落幕扫除（2026-09-21 用户拍板）：以 play_end 落账为准——此刻全场
            # 未收口的段刚被收口（草稿已转正），谁还没发言就整行拆谁。job 账本
            # 与织入的会话账本各自落各自的 play_end 副本，各扫各的，天然全覆盖。
            self._sweep_unspoken_sections(book)
        return row

    # ── 段生命周期（seg-open / seg-fill / seg-close，2026-09-19 用户拍板）──────
    # 「进了节点立即建一个新块，然后有啥往里填」：块 = 一个节点实例的段，
    # seg 键取引擎的 turn 号（每节点实例唯一，par 同名节点各拿各的、不串段）。
    # 开块即落账占号（页面立刻见块），后续每一拍原位改写该行 + 广播
    # ctrl row-update（页面按 n 原位替换，块不换位、行号不重排）。
    # 例外（2026-09-27 用户拍板）：人类段收口交卷这一拍整段搬到账末重新落号——
    # AI 段仍以开段到达序为准，人类段以完成时间为准（见 _seg_relocate_to_end）。

    def _seg_open(self, book: _JobBook, f, host: str = '') -> bool:
        """开块：本节点实例的段行（items 可空）。持锁调用。

        同键段已收口又见开段 = 续跑重跑的新一轮等待（引擎 Runtime 重建计数器归
        零，wait_key 撞旧键——见 _seg_base_gen 的裁决注记）：世代让位开新段，行
        seg 带 ':g<N>' 后缀、路由键（帧键）指向新段——后续 fill/草稿帧仍报旧键
        照常路由，新台词不再 fill 进旧发言里。旧段还开着则照旧幂等拒（重复投喂
        防线不变）。"""
        seg = str(f.get('seg') or '')
        route = seg
        if not seg:
            return False
        n = book.segs.get(seg)
        if n is not None:
            old = None
            for r in book.rows:
                if r.get('n') == n:
                    old = r
                    break
            if old is None or old.get('open'):
                return False   # 仍在进行中（或索引悬空）：重复开段幂等
            # 让位许可（2026-09-28）：续跑重发与帧重投在 hub 眼里同构（同键、同
            # src_seq），只有三个信号能证明「引擎真的在等新一轮」——等待镜像正
            # 亮着该键（human 段）/ 帧带 regen 标（EventProjector 清场后重新登记
            # 同键，AI 段同进程续跑）/ 冷加载遗产许可集（daemon 重启后续跑）。
            # 三者皆无 = 旧帧重投，照旧幂等拒（协议 §8 重放防线不破）。
            # 2026-10-02 镜像复数化：任一席位的 seg 亮着该键即算（多席并发时
            # 挨个比对，不再只看「当前那一席」）。
            w_segs = {str(x.get('seg') or '') for x in self._waiting.values()}
            regen_ok = f.get('regen') == 1 \
                or seg in w_segs \
                or (seg in book.seg_regen_ready and book.resumed_seen)
            if not regen_ok:
                return False
            book.seg_regen_ready.discard(seg)
            base, gen = _seg_base_gen(seg)
            gen = max(gen, book.seg_gen.get(base, 1)) + 1
            new_seg = '%s:g%d' % (base, gen)
            while new_seg in book.segs:
                gen += 1
                new_seg = '%s:g%d' % (base, gen)
            book.seg_gen[base] = gen
            seg = new_seg
            # 等待镜像的 seg 在 human_wait 那拍已广播（早于段落账半拍，当时查不到
            # 世代行）——段这一拍落地了，把带世代键的镜像重推一遍（页面输入席
            # 位置跟到新段）。EventProjector 是单场投影器，waiting 必属本场；
            # 会话账本织入的让位重推同值（幂等，无害）。复数化后原位改该席的
            # seg（upsert 保位，其余席位不动）。
            for x in self._waiting.values():
                if str(x.get('seg') or '') == route:
                    self.set_waiting(dict(x, seg=seg))
                    break
        row = {
            'zone': f.get('zone') or 'inplay',
            'kind': 'section',
            'actor': str(f.get('actor') or ''),
            'items': list(f.get('items') or []),
            'seg': seg,
            'open': True,
            'src_seq': 'seg:%s:open' % seg,
        }
        for k in ('node', 'targets', 'turn'):
            if f.get(k) is not None:
                row[k] = f[k]
        if f.get('job_id') is not None:
            row['job_id'] = f['job_id']   # 织入副本的出处标（会话账本段行也认得出哪场戏）
        if f.get('role') in _SECTION_ROLES:
            row['role'] = f['role']   # 段角色标（显示策略用，2026-09-20）
        out = self._append_row_obj(book, row, host)
        if out is None:
            return False
        book.segs[route] = out['n']
        book.seg_zone[route] = row.get('zone') or 'inplay'   # 路由判定用（_frame_zone）
        return True

    # ── 段内草稿层（2026-09-19 用户拍板：「槽分『流式输出中／输出完落盘』两态」）──
    # 模型：段是容器，容器里的**槽**有两种状态——
    #   · 草稿（draft）：正在写的那条，宿主把逐字增量喂进来，字一个个往里长；
    #     只活在内存 + 旁账（drafts.json），**永不进主账**；
    #   · 定稿（final）：写完了的那条，就是段行 items 里实实在在的一条。
    # 谁都能填：桥喂定稿（交卷那拍），宿主喂草稿（流式那几拍）。hub 说了算——
    # 「进主账还是进草稿、什么时候落盘、刷新之后看到什么」全在这里定，宿主只管
    # 报「这批字属于哪个段的哪一种」。页面不做打字动画：显示的就是这一层的文本
    # 本身，所以刷新/换端/重连天然接得上。
    #
    # 两条规矩（替掉「live-done 只清块不转正」那句人工纪律）：
    #   · 吸收：喂定稿时，同 kind 的草稿整条丢弃（定稿是权威版本，不双份）；
    #   · 转正：段收口时，还没被吸收的草稿就地变成定稿（桥没交卷也不丢历史）。

    def _draft_slots(self, book: _JobBook, seg, create: bool = False):
        """取某段的草稿槽表（段键 → {键: item}）。create=True 时不存在则建。
        已收口的段不再收草稿（宿主晚到的增量不能把闭了的块写活），返回 None。持锁调用。"""
        seg = str(seg or '')
        if not seg:
            return None
        n = book.segs.get(seg)
        if n is not None and not any(r.get('n') == n and r.get('open') for r in book.rows):
            return None
        slots = book.drafts.get(seg)
        if slots is None and create:
            slots = book.drafts[seg] = {}
        return slots

    def _draft_start(self, book: _JobBook, f) -> bool:
        """开一条草稿槽（宿主报到「这一种内容开始写了」；重复开=幂等）。持锁调用。"""
        seg, key = str(f.get('seg') or ''), str(f.get('key') or '')
        if not seg or not key:
            return False
        slots = self._draft_slots(book, seg, create=True)
        if slots is None:
            return False
        item = slots.get(key)
        if item is None:
            item = {'key': key, 'kind': _draft_kind(f.get('kind')),
                    'text': '', 'act': time.time()}
            slots[key] = item
        for k in ('name', 'actor'):
            if f.get(k) and not item.get(k):
                item[k] = f[k]
        book.drafts_dirty = True
        return self._push_drafts(book, seg)

    def _draft_delta(self, book: _JobBook, f) -> bool:
        """往草稿槽追加字（流式主用；槽不在就顺手开一条——宿主不必先 start）。持锁调用。"""
        seg, key = str(f.get('seg') or ''), str(f.get('key') or '')
        text = str(f.get('text') or '')
        if not seg or not key or not text:
            return False
        slots = self._draft_slots(book, seg, create=True)
        if slots is None:
            return False
        item = slots.get(key)
        if item is None:
            item = {'key': key, 'kind': _draft_kind(f.get('kind')),
                    'text': '', 'act': time.time()}
            slots[key] = item
        for k in ('name', 'actor'):    # 工具名这类随首批到的标注：只补不覆盖
            if f.get(k) and not item.get(k):
                item[k] = f[k]
        item['text'] += text
        item['act'] = time.time()
        book.drafts_dirty = True
        return self._push_drafts(book, seg)

    def _draft_drop(self, book: _JobBook, f) -> bool:
        """作废草稿（重试/中断/场次边界）：带 key 撤一条，带 seg 撤该段全部，
        都不带=全场撤（宿主的清桶）。作废是有意义的边界，立即刷旁账。持锁调用。"""
        seg, key = str(f.get('seg') or ''), str(f.get('key') or '')
        if not seg:
            if not book.drafts:
                return False
            segs = list(book.drafts)
            book.drafts.clear()
            book.drafts_dirty = True
            self._persist_drafts(book, force=True)
            hit = False
            for s in segs:
                hit = self._push_drafts(book, s) or hit
            return hit
        slots = book.drafts.get(seg)
        if not slots:
            return False
        if key:
            if slots.pop(key, None) is None:
                return False
        else:
            slots.clear()
        if not slots:
            book.drafts.pop(seg, None)
        book.drafts_dirty = True
        self._persist_drafts(book, force=True)
        return self._push_drafts(book, seg)

    def _compose(self, book: _JobBook, row: dict) -> dict:
        """行 + 本段草稿的合成态（页面看到的就是它）。没草稿时原样返回。
        草稿只贴给**还开着**的段：段一收口，草稿早已吸收/转正完（见 _seg_fill），
        此后晚到的增量一律不再生效——否则收口的块会重新长出「正在写」。持锁调用。"""
        seg = row.get('seg')
        if not seg or not row.get('open'):
            return row
        slots = book.drafts.get(str(seg))
        if not slots:
            return row
        out = dict(row)
        out['drafts'] = [dict(it) for it in sorted(slots.values(), key=_draft_slot_order)]
        return out

    def _push_drafts(self, book: _JobBook, seg) -> bool:
        """草稿变了 → 把所属段行的合成态推给看得见它的人（页面只认 row-update）。
        段还没开（宿主抢在桥前面报到）时草稿先记下，开段那拍 _compose 自然带上；
        段已收口则不再推（草稿已无意义）。批内（feed 帧循环中）只记账、批尾统一
        推（见 __init__ _draft_hold 注）——页面只见批终态，不见 drop 的中间态。
        返回是否真的推出去了（攒批也算：草稿确实变了，批尾必推）。持锁调用。"""
        n = book.segs.get(str(seg))
        if n is None:
            return False
        for r in book.rows:
            if r.get('n') == n:
                if not r.get('open'):
                    return False
                hold = self._draft_hold
                if hold is not None:
                    hold.add((book, str(seg)))
                    return True
                self._emit(book,
                           {'ctrl': 'row-update', 'row': self._compose(book, r)},
                           live=False, filter_row=r)
                return True
        return False

    def _flush_draft_holds(self):
        """批尾统一推（feed/feed_session 帧循环后调用）：一笔一 seg 只推终态。
        必须持锁调用（与帧循环同锁域）。"""
        hold, self._draft_hold = self._draft_hold, None
        for hb, hs in (hold or ()):
            self._push_drafts(hb, hs)

    def _persist_drafts(self, book: _JobBook, force: bool = False):
        """草稿旁账落盘（节流；force=边界时刻立即落）。整本小册子重写，代价恒定
        ——草稿就是易失的过程态，写坏了下次读不到也无所谓，故不走 tmp+replace
        （那是给主账留的谨慎，见 _rewrite_journal_line 的 Windows 占用坑）。持锁调用。"""
        if not book.drafts_dirty:
            return
        now = time.time()
        if not force and now - book.drafts_at < _DRAFT_FLUSH_SEC:
            return
        book.drafts_at = now
        book.drafts_dirty = False
        try:
            os.makedirs(os.path.dirname(book.drafts_path), exist_ok=True)
            with open(book.drafts_path, 'w', encoding='utf-8') as f:
                json.dump(book.drafts, f, ensure_ascii=False)
        except OSError:
            pass

    def _seg_fill(self, book: _JobBook, f) -> bool:
        """往已开的块里塞内容：items 按发生序追加（同尾重复=重试/重放的同一句，
        跳过不双份），actor/node 只在空时补，open=False 收口。原位改写 journal +
        广播 ctrl row-update。持锁调用。

        草稿层两条规矩在这里执行（2026-09-19 用户拍板）：
        ① 吸收——本批定稿的 kind 里有的草稿，整条丢弃（定稿是权威版本，不双份）；
        ② 转正——本拍是收口（open=False）时，还没被吸收的草稿就地变成定稿
           （桥没交卷/交卷失败也不丢历史），随后该段草稿一条不剩。"""
        seg = str(f.get('seg') or '')
        n = book.segs.get(seg) if seg else None
        if not seg or n is None:
            return False
        fill_src = str(f.get('src_seq') or '')
        if fill_src and fill_src in book.src_seqs:
            return False        # 重放（水位补齐/重发）：这一拍早已入账，不重账
        idx = None
        for i, r in enumerate(book.rows):
            if r.get('n') == n:
                idx = i
                break
        if idx is None:
            return False
        old = book.rows[idx]
        items = list(old.get('items') or [])
        changed = False
        added = []
        for it in (f.get('items') or []):
            if not isinstance(it, dict):
                continue
            item = {'kind': str(it.get('kind') or 'say'), 'text': str(it.get('text') or '')}
            for k in ('toolCall', 'toolResult'):
                if isinstance(it.get(k), dict):
                    item[k] = it[k]
            if item['kind'] in _HEAD_KINDS:
                # 头部槽（showprompt/prompt）会被规整到段首——同题去重按全段查，
                # 段尾比对够不着（晚到兜底/重放的防线）
                if any(x.get('kind') == item['kind'] and x.get('text') == item['text']
                       for x in items):
                    continue
            elif items and items[-1].get('kind') == item['kind'] \
                    and items[-1].get('text') == item['text']:
                continue          # 段尾同句：重试轮/重放不双份
            items.append(item)
            added.append(item)
            changed = True
        # ① 吸收：同 kind 的草稿由定稿接管（位置不动——草稿本就长在段尾）
        closing = 'open' in f and not f['open']
        if added:
            slots = book.drafts.get(seg)
            if slots:
                kinds = {a['kind'] for a in added}
                for k in [k for k, it in slots.items() if it.get('kind') in kinds]:
                    slots.pop(k, None)
                if not slots:
                    book.drafts.pop(seg, None)
                book.drafts_dirty = True
        # ② 转正：收口时把剩下的草稿变成定稿（历史不丢）
        if closing:
            slots = book.drafts.pop(seg, None)
            if slots:
                book.drafts_dirty = True
                have = {(it.get('kind'), it.get('text')) for it in items}
                for it in slots.values():
                    text = str(it.get('text') or '')
                    if not text or (it.get('kind'), text) in have:
                        continue
                    items.append({'kind': it.get('kind') or 'say', 'text': text})
                    changed = True
        new_row = dict(old)
        for k in ('actor', 'node'):
            if f.get(k) and not new_row.get(k):
                new_row[k] = f[k]
                changed = True
        # 槽序规整+名字槽注入（2026-09-19 用户拍板：槽序 hub 定）——actor 晚到
        # 合并后再规整，名字槽原位补上/改写；对已规整的 items 幂等（原样返回、
        # 不触发多余改写）。旧账 narrate 行被摸到时顺手归位（自愈，不迁移）。
        canon = _canonical_items(items, new_row.get('actor'))
        if canon != items:
            items = canon
            changed = True
        if changed:
            new_row['items'] = items
        if 'open' in f and bool(f['open']) != bool(new_row.get('open')):
            if f['open']:
                new_row['open'] = True
            else:
                new_row.pop('open', None)   # 收口：卸任标记（页面不再画「正在…」）
            changed = True
        if not changed:
            return False
        if fill_src:
            book.src_seqs.add(fill_src)   # 幂等键入册（同拍重放不再落第二遍）
        book.rows[idx] = new_row
        if closing and str(new_row.get('role') or '') == 'human' \
                and idx < len(book.rows) - 1 \
                and any(str(it.get('kind') or '') not in _UNSPOKEN_HEAD_KINDS
                        for it in (new_row.get('items') or [])):
            # 人类发言按完成时间插入排序（2026-09-27 用户拍板，方案B）：人类段
            # 仍照旧在 human_wait 那拍开段占号（showprompt/prompt 头部槽随时可读、
            # 等待块照常可见），人真正交卷、段收口这一拍把整段搬到账末重新落号。
            # 判据复用落幕扫除同款「有产出」标准：说了话才搬，没说话的空段留给
            # 落幕扫除；已是账末不搬（无意义的行号翻动）；AI 段一律不搬。
            return self._seg_relocate_to_end(book, new_row, idx)
        self._rewrite_journal_line(book, old, new_row)
        # 广播按【行本体】过滤视角（ctrl 帧顶层没有 zone，拿帧去 filter 会
        # 把 stage/角色视角全滤掉——段的内容更新必须发给看得见这段的人）
        self._emit(book,
                   {'ctrl': 'row-update', 'row': self._compose(book, new_row)},
                   live=False, filter_row=new_row)
        return True

    def _seg_relocate_to_end(self, book: _JobBook, row: dict, idx: int) -> bool:
        """人类段交卷搬家（2026-09-27 用户拍板：人类发言以完成时间为准插入排序，
        AI 段仍以开段到达序为准）。段收口这一拍把整段搬到账本末尾重新落号：
        旧行号位置留墓碑（幂等键保留，晚到的重放开段帧不得诈尸，同落幕扫除）；
        新行号=当前 next_n；时戳=交卷时刻（完成时间就此入账）；幂等键换
        seg:<段键>:moved。journal 先删后加，同一把锁内串行，与 _rewrite_journal_line
        同纪律：原文件重写，不走 tmp+replace（Windows 占用坑）。广播=ctrl row-del
        （旧行号，filter_row=旧行本体）+ 新行正常广播——词汇都是既有词汇，页面
        与各端零改动。织入的会话账本副本无需另行处理：_weave 原样重放同一帧、
        走同一个 _seg_fill，各账本各自搬家，天然一致。返回是否真的搬了。持锁调用。"""
        seg = str(row.get('seg') or '')
        old = dict(row)
        moved = dict(row)
        moved['n'] = book.next_n
        moved['t'] = int(time.time() * 1000)   # 完成时刻取代开段时刻
        if seg:
            moved['src_seq'] = 'seg:%s:moved' % seg
            base, _g = _seg_base_gen(seg)
            book.segs[base] = moved['n']   # 段路由键跟到新号（后续填充/草稿定位不变）
            if base != seg:
                book.segs[seg] = moved['n']
        book.rows.pop(idx)
        self._drop_journal_rows(book, [old])   # 旧位留墓碑（幂等键拦重放）
        book.append(moved)   # 落到账末（src_seqs 随 append 入册）
        self._emit(book, {'ctrl': 'row-del', 'n': old.get('n'), 'seg': seg},
                   live=False, filter_row=old)
        self._emit(book, self._compose(book, moved), live=False)
        return True

    def _fill_slot(self, book: _JobBook, row_dict: dict, host: str = '') -> bool:
        """把导演回合段填进最新一个未填空位：n/t 沿用空位（位置紧跟 user 发言）、
        落盘行原位改写、广播 ctrl row-update。找不到空位→按普通行追加（绝不丢
        回话）；回话 src_seq 已入账（重放）→ 幂等跳过。持锁调用。"""
        src = str(row_dict.get('src_seq') or '')
        if src and src in book.src_seqs:
            return False
        idx = None
        for i, r in enumerate(book.rows):
            if r.get('slot') and not r.get('items'):
                idx = i   # 取最新未填空位（多连发时回话贴最近一条 user 发言）
        if idx is None:
            return self._append_row(book, row_dict, host)
        slot = book.rows[idx]
        new_row = _normalize_row(row_dict, slot['n'], slot['t'], host)
        new_row.pop('slot', None)   # 填满即卸任
        book.rows[idx] = new_row
        if new_row.get('src_seq'):
            book.src_seqs.add(new_row['src_seq'])
        self._rewrite_journal_line(book, slot, new_row)
        self._emit(book, {'ctrl': 'row-update', 'row': new_row},
                   live=False, filter_row=new_row)
        return True

    def _rewrite_journal_line(self, book: _JobBook, old_row: dict, new_row: dict):
        """journal.jsonl 原位改写一行（按 src_seq+n 对位）。**原文件 r+ 重写，
        不走 tmp+os.replace**——账本常年开着 append 句柄，Windows 上 replace
        撞占用必炸（j1609 Errno 13 同款坑）；已开句柄是 'a' 模式（O_APPEND，
        每次写自动贴新 EOF），与这里的 r+ 重写在锁内串行，互不踩。"""
        if not os.path.isfile(book.path):
            return
        try:
            with open(book.path, 'r+', encoding='utf-8') as f:
                lines = [l for l in f.read().splitlines() if l.strip()]
                out = []
                for line in lines:
                    try:
                        obj = json.loads(line)
                    except ValueError:
                        out.append(line)
                        continue
                    if obj.get('src_seq') == old_row.get('src_seq') and obj.get('n') == old_row.get('n'):
                        out.append(json.dumps(new_row, ensure_ascii=False))
                    else:
                        out.append(line)
                f.seek(0)
                f.write('\n'.join(out) + '\n')
                f.truncate()
        except OSError:
            pass

    # ── 落幕扫除（2026-09-21 用户拍板）───────────────────────────────────
    # 人类节点是旁路无限循环：想插话就插话，不插也行。AI 线跑到落幕时，人类
    # 没插过话的段（如 chat_human）会以「开着口、零内容」永远挂在账本里；问了
    # 没人答的段同理。以 play_end 落账为准整行删除——「结束信号」是唯一扳机，
    # 不做超时兜底、不做猜测性清理。

    def _sweep_unspoken_sections(self, book: _JobBook) -> list:
        """play_end 落账那一刻的收尾扫除：全场「建立了段但没发言」的段行整行
        删除，AI/人类一视同仁。判据=槽里没有任何角色产出：只剩头部提问槽
        （showprompt/prompt/name）或整段为空。有产出的段（cot/台词/工具，哪怕
        只剩重试反馈或收口转正的草稿）是历史，一律保留。
        时序依赖：EventProjector 的 flow_done 批次里收口帧（草稿转正）恒先于
        play_end 行，故扫到的一定是转正后的最终形态。
        journal 整行删除走 _drop_journal_rows（同 r+ 重写纪律，不走 tmp+replace，
        被删行原位留墓碑：行没了幂等键还在，冷加载也拦得住诈尸）；
        内存摘行+摘段索引；广播 ctrl row-del（带被删行做可见性判据：看得到它的
        人才收得到拆消息，REST 轮询端下次快照自然不见）。幂等：无可删即静默。
        返回被删的行。持锁调用。"""
        dead = []
        for r in book.rows:
            if r.get('kind') != 'section':
                continue
            items = [it for it in (r.get('items') or []) if isinstance(it, dict)]
            if any(str(it.get('kind') or '') not in _UNSPOKEN_HEAD_KINDS
                   for it in items):
                continue   # 有角色产出：历史，保留
            dead.append(r)
        if not dead:
            return []
        dead_ns = {r.get('n') for r in dead}
        for r in dead:
            seg = str(r.get('seg') or '')
            if seg:
                book.segs.pop(seg, None)
                book.seg_zone.pop(seg, None)
                base, _g = _seg_base_gen(seg)
                if base != seg and book.segs.get(base) == r.get('n'):
                    # 死行是路由键当前指向的世代段：路由键一并摘（指向更新世代的
                    # 活段时不摘——那是别的行）
                    book.segs.pop(base, None)
                    book.seg_zone.pop(base, None)
                if book.drafts.pop(seg, None):
                    book.drafts_dirty = True   # 死段的残草一并带走
        book.rows = [r for r in book.rows if r.get('n') not in dead_ns]
        self._drop_journal_rows(book, dead)
        for r in dead:
            self._emit(book, {'ctrl': 'row-del', 'n': r.get('n'),
                              'seg': str(r.get('seg') or '')},
                       live=False, filter_row=r)
        return dead

    def _drop_journal_rows(self, book: _JobBook, dead_rows: list):
        """journal.jsonl 整行删除（落幕扫除专用）：r+ 整文件重写，被删行原位
        换成**墓碑行** {n, del:true, src_seq}（行没了、幂等键还在——冷加载据
        src_seq 拦晚到的重放开段帧，空段不得诈尸；墓碑不计行数，见
        _stat_journal/_JobBook._load）。与 _rewrite_journal_line 同一套纪律——
        原文件重写，不走 tmp+os.replace（账本常年开着 append 句柄，Windows 上
        replace 撞占用必炸，j1609 同款坑）；对位判据一致：src_seq + n。持锁调用。"""
        if not os.path.isfile(book.path) or not dead_rows:
            return
        gone = {(str(r.get('src_seq')), r.get('n')) for r in dead_rows}
        try:
            with open(book.path, 'r+', encoding='utf-8') as f:
                out = []
                for line in f.read().splitlines():
                    if not line.strip():
                        continue
                    try:
                        obj = json.loads(line)
                    except ValueError:
                        out.append(line)
                        continue
                    if (str(obj.get('src_seq')), obj.get('n')) in gone:
                        out.append(json.dumps({'n': obj.get('n'), 'del': True,
                                               'src_seq': obj.get('src_seq') or ''},
                                              ensure_ascii=False))
                        continue
                    out.append(line)
                f.seek(0)
                f.write('\n'.join(out) + '\n')
                f.truncate()
        except OSError:
            pass

    # ── 下行（库面）───────────────────────────────────────────────────

    def _role_actors(self, book: '_JobBook') -> dict:
        """账本里出现过的段角色归属：{'main': {基形}, 'human': {基形}}——
        actor 视角窗的类别判定依据（谁是主 Agent、谁的席位是人，都从段行
        role 标里收出来，喂方不必另行登记）。持锁调用。"""
        out = {'main': set(), 'human': set()}
        for r in book.rows:
            role = r.get('role')
            if role in out and r.get('actor'):
                out[role].add(_base_name(r['actor']))
        return out

    def _policy_class(self, book: '_JobBook', view: str):
        """视角 → 策略行键 (vclass, 裸角色名)。god/stage 直取；actor:X 按
        账本收出的段角色归属分类：主 Agent 角色窗(main) / 人类角色窗(human) /
        其余 AI 角色窗(ai)——对不上 main/human 的都算 ai。"""
        if view in ('god', 'stage'):
            return view, ''
        if view.startswith('actor:'):
            vactor = _view_actor(view)
            want = _name_bases(vactor)
            roles = self._role_actors(book)
            for cls in ('main', 'human'):
                if any(_name_bases(a) & want for a in roles[cls]):
                    return cls, vactor
            return 'ai', vactor
        return 'god', ''   # 未知视角按最宽读法（与 view_filter 兜底一致）

    def _follow_latest_god(self, job_id: int) -> None:
        """「跟最新」订阅的跨场跟随收尾（2026-10-03 用户实报「按下运行后新 job
        第一条不出字/不出内容，多少条都不出，刷新才好」实案根治）：页面无参刷新
        =跟随最新，裸 god 升级那一刻把 god 目标定在「当时最新场的班底」——之后
        新场开在**别家宿主**，升级订户停在旧家：等待控制帧全场广播（座位/提示照
        出现），行内容全走会话维度、按 god_host 匹配不上（AI 不出字、多少条都不
        出），刷新重新升级才跟对新家（⇒永远「刷新之后就好了」）。本场开演登记
        owners（set_owner，桥 job_start 现场喂）且本场=最新时重算：**跟最新模式**
        （job_id=None）的升级订户按 plan.god_default 重对家——换家即 view-echo +
        重快照（页面菜单高亮/内容一次到位）；web 独演这类班底里没有一家申报上帝
        窗的场，god_default 落裸 god，订户从会话路径回落 job 路径（读本场账本，
        正确姿势）。钉了场次的订阅不动（用户指哪看哪）。本来就在家的不折腾。
        持锁调用。"""
        plan = self.view_plan(job_id)
        target = plan['god_default']
        for sub in list(self._subs):
            if sub.job_id is not None:
                continue   # 钉了场次：指哪看哪，不跟
            cur = getattr(sub, 'echo_view', None) or (
                ('god:%s' % sub.god_host) if sub.god_host else (sub.view or 'god'))
            if cur == target:
                continue   # 本来就在家
            if target == 'god' and sub.god_host is None and not sub._via_god:
                continue   # 本来就是裸 god job 路径：_last_job 指针已跟随，无需折腾
            self._resolve_god_sub(target, sub)
            if target.startswith('god:'):
                # 开演瞬间绑定 current/会话账本可能还没长出来（_resolve_god_view
                # 会落 None→_via_god=False→会话路径掉线，行帧收不到——⑮ 实测抓到）。
                # 跟随订阅强制保持会话路径在册：god_host+via_god 站住、sess 留 None
                # （绑定重解析在每次快照时进行，既有语义；快照空由「账本空→读最新
                # job 账本」兜底接住——同 _push_snapshot god 路径哲学）。
                sub.god_host = _norm_host(target[4:])
                sub._via_god = True
                sub.sess = None
            try:
                sub.q.put_nowait(json.dumps({'ctrl': 'view-echo', 'view': target},
                                            ensure_ascii=False))
            except queue.Full:
                pass
            # 快照直接对齐新场（不走出厂 _push_snapshot：其 job 兜底用 latest_job，
            # job_start 先于 flow_start 行时指针还停在旧场——过渡快照会把旧场内容
            # 带给页面）。此刻新场多半只有开局行，后续实时帧从会话路径源源到达。
            snap = self.snapshot(plan['job'], 'god', 0)
            try:
                sub.q.put_nowait(json.dumps(
                    {'ctrl': 'snapshot', 'proto': PROTO_VERSION, 'job': snap['job'],
                     'session': None, 'view': target, 'next': snap['next'],
                     'rows': snap['rows'], 'hosts': snap.get('hosts') or [],
                     'waiting': self.current_waiting_unlocked(), 'live': [],
                     'god_fallback_job': snap['job']}, ensure_ascii=False))
            except queue.Full:
                pass

    def _apply_view_policy(self, book: '_JobBook', view: str, row: dict):
        """显示策略（VIEW_POLICY，模块顶常量）的行级执行——只动出料拷贝，
        账本原文分毫不动。按视角类别扣下受管槽（prompt/cot/react 过程类）；
        showprompt/台词/名字/公告等不受管槽照走。整行剪空 → None（不露
        「有货被藏」的空壳）。非 section / 无槽行原样返回。持锁调用。
        上帝视角同样过矩阵（2026-09-20 用户定案：AI 的 prompt 全程不显示——
        包括上帝窗），god 行照常量执行，无特殊放行。"""
        vclass, vactor = self._policy_class(book, view)
        items = row.get('items')
        drafts = row.get('drafts')
        if not items and not drafts:
            return row
        want = _name_bases(vactor) if vactor else None
        role = str(row.get('role') or 'ai')
        is_self = bool(want) and bool(row.get('actor')) \
            and bool(_name_bases(row['actor']) & want)

        def keep(it) -> bool:
            col = _policy_column(role, is_self, it.get('kind'))
            if col is None:
                return True
            if col == 'human_prompt':
                # prompt 只有人类输入的时候能看见（2026-10-03 用户定稿口径，见
                # VIEW_POLICY 块注）：视角列放行之外，还须该席**正在等待**——
                # 收口/历史人类节点的 prompt 一概扣下。等待事实以席位镜像为准
                # （不读行 open：续跑世代键、human_wait 早于段落账半拍的窗口期，
                # 行态都会骗人；席位在册=引擎真的在等这份输入）。
                return VIEW_POLICY[vclass][col] and self._human_prompt_live(row)
            return VIEW_POLICY[vclass][col]

        kept_items = [it for it in (items or []) if keep(it)]
        kept_drafts = [it for it in (drafts or []) if keep(it)]
        if len(kept_items) == len(items or []) and len(kept_drafts) == len(drafts or []):
            return row   # 一刀未剪：原样返回（省一次拷贝）
        if not kept_items and not kept_drafts:
            return None
        out = dict(row)
        if items:
            out['items'] = kept_items
        if drafts:
            out['drafts'] = kept_drafts
        return out

    def _human_prompt_live(self, row: dict) -> bool:
        """本行的 prompt 槽是否该显示=该席人类是否正在等待（持锁调用）。按段键
        对席位镜像；段键两种形态（带宿主 w:<host>:<wait_key> / 裸 w:<wait_key>）
        都用「以席位 wait_key 收尾」对上，宿主段在不在都不误判。"""
        seg = str(row.get('seg') or '')
        if not seg or not self._waiting:
            return False
        for s in self._waiting.values():
            wk = str(s.get('wait_key') or '')
            if str(s.get('seg') or '') == seg or (wk and seg.endswith(':' + wk)):
                return True
        return False

    def _resolve_god_view(self, view: str):
        """'god:<host>' → 该宿主当前绑定的会话（'host:sid' 字符串）。未绑定时
        回落该宿主最近活动的会话账本；什么都没有 → None。持锁调用。"""
        host = _norm_host(str(view)[4:])
        if not host:
            return None
        b = self._load_bindings().get(host) or {}
        cur = str(b.get('current') or '')
        if cur:
            return '%s:%s' % (host, cur)
        for x in self.sessions_list():
            if x['session'].split(':', 1)[0] == host:
                return x['session']
        return None

    def snapshot(self, job_id, view: str = 'god', after: int = 0) -> dict:
        # god 族视角（2026-09-21 起）：按宿主解析到当前绑定的会话账本——上帝窗
        # 改绑 (host, 主会话) 后，网页的上帝窗认 host 不认 job。**裸 god 同义**
        # （2026-09-22「刷新即假上帝视角」根治的 REST 面）：未钉场次时升级到
        # 最近活动宿主；一个会话账本都没有（纯场记账/冷启动）才落回 job 账本
        # ——与 WS 订阅（_resolve_god_sub）同一套词汇，REST 与页面不再各说各话。
        if isinstance(view, str) and (view == 'god' or view.startswith('god:')):
            host = self._latest_god_host() if (view == 'god' and job_id is None)                 else (_norm_host(view[4:]) if view != 'god' else '')
            sess = self._resolve_god_view('god:%s' % host) if host else None
            if sess is not None:
                return self.snapshot_session(sess, 'god', after)
            if view != 'god':
                return {'proto': PROTO_VERSION, 'session': None, 'view': 'god',
                        'rows': [], 'next': 0}
            # 裸 god 无账可升：落到底下 job 账本读法（老语义兜底）
        with self._lock:
            if job_id is None:
                job_id = self.latest_job()   # 「最新」：内存指针优先，重启后回落盘上最近场
                if job_id is None:
                    return {'proto': PROTO_VERSION, 'job': None, 'view': view,
                            'rows': [], 'next': 0}
            book = self._book(int(job_id))
            # 读侧同尺过滤（2026-09-19）：本场 owner 登记后，历史里混进来的
            # 「别的 Session」的行也不再投给页面（journal 原文不动——不删数据，
            # 行号原位保留，页面只是看不到那几行）。
            # 显示策略（2026-09-20）：按视角类别扣受管槽——宿主拿到的就是滤好
            # 的料包，渲染端无脑照画。
            rows = []
            for r in book.rows:
                if r['n'] <= after or not view_filter(view, r) \
                        or self._foreign_owner_row(book.job_id, r):
                    continue
                prow = self._apply_view_policy(book, view, self._compose(book, r))
                if prow is not None:
                    rows.append(prow)
            return {'proto': PROTO_VERSION, 'job': book.job_id, 'view': view,
                    'rows': rows, 'next': book.next_n - 1,
                    'hosts': _hosts_of_rows(book.rows)}

    def replay(self, job_id) -> list:
        with self._lock:
            book = self._book(int(job_id))
            return [self._compose(book, r) for r in book.rows]

    def jobs(self) -> list:
        with self._lock:
            ids = set(self._books)
            if os.path.isdir(self.dir_path):
                for fn in os.listdir(self.dir_path):   # 布局：<job_id>/journal.jsonl
                    if fn.isdigit() and os.path.isdir(os.path.join(self.dir_path, fn)):
                        ids.add(int(fn))
            out = []
            for jid in sorted(ids):
                book = self._books.get(jid)
                if book is not None:
                    rows = book.rows
                    out.append({'job_id': jid, 'rows': len(rows),
                                'first_t': rows[0]['t'] if rows else None,
                                'last_t': rows[-1]['t'] if rows else None,
                                'hosts': _hosts_of_rows(rows)})
                else:
                    # 未装载的场只轻量盘点盘上文件——绝不 _book() 物化：清单被
                    # 页面每次打开拉一遍，懒加载会把全部历史装进内存且永不逐出
                    st = _stat_journal(os.path.join(self.dir_path, str(jid),
                                                    'journal.jsonl'))
                    out.append({'job_id': jid, 'rows': st[0],
                                'first_t': st[1], 'last_t': st[2],
                                'hosts': st[3]})
            # 最近活动降序（场次下拉第一屏就是最新几场；与 /sessions 同尺）。
            # 「最新」伪条目恒在清单顶（页面加的），列表本身再 oldest-first 就反了。
            out.sort(key=lambda x: x['last_t'] or 0, reverse=True)
            return out

    def chronica_sessions(self) -> list:
        """台账场次清单（2026-09-29 整场回放）：按台账号归拢 job——号取自各 job
        账首行（_session_of_job，轻量首行扫描不物化）。无号的 job 不出场（旧账
        未回填/裸跑无幕布时代）。返回按最近活动降序：
        [{session, jobs:[...], first_t, last_t, rows}]——rows=各 job 行数合计。"""
        by = {}
        for j in self.jobs():
            sid = _session_of_job(os.path.join(self.dir_path,
                                               str(j['job_id']), 'journal.jsonl'))
            if sid is None:
                continue
            e = by.setdefault(sid, {'session': sid, 'jobs': [],
                                    'first_t': None, 'last_t': None, 'rows': 0})
            e['jobs'].append(j['job_id'])
            e['rows'] += j['rows']
            if j['first_t'] is not None and (e['first_t'] is None or j['first_t'] < e['first_t']):
                e['first_t'] = j['first_t']
            if j['last_t'] is not None and (e['last_t'] is None or j['last_t'] > e['last_t']):
                e['last_t'] = j['last_t']
        out = sorted(by.values(), key=lambda x: x['last_t'] or 0, reverse=True)
        for e in out:
            e['jobs'].sort()   # job 号升序=开演顺序（场次快照拼接同尺）
        return out

    def snapshot_chronica(self, session_id, view: str = 'god', after: int = 0) -> dict:
        """整场快照（2026-09-29 拍板）：同一台账场次下的所有 job 账按 job 号升序
        依次拼接（用户裁决：「依次显示」——job 号即开演顺序，块内保持各账本行序
        与行号；不按时间戳交错）。每 job 块独立跑 snapshot 同尺三道闸（视角
        过滤/显示策略/信任集），next=各块 next 的累计偏移（「j<job>:<n>」）供
        增量拉取；直播块不进整场视图（易失过程态，整场回放是复盘镜头）。"""
        session_id = int(session_id)
        with self._lock:
            jobs = [e for e in self.chronica_sessions() if e['session'] == session_id]
            if not jobs:
                return {'proto': PROTO_VERSION, 'chronica': session_id,
                        'view': view, 'rows': [], 'next': 0, 'jobs': []}
            rows = []
            next_off = 0
            jids = []
            for jid in jobs[0]['jobs']:   # 已升序：开演顺序
                snap = self.snapshot(jid, view, 0)
                if snap.get('job') is None:
                    continue
                jids.append(jid)
                next_off += snap['next'] + 1
                rows.extend(snap['rows'])
            return {'proto': PROTO_VERSION, 'chronica': session_id, 'view': view,
                    'rows': rows, 'next': next_off - 1, 'jobs': jids}

    def view_plan(self, job_id) -> dict:
        """【视角规则单源（2026-10-03 用户拍板「规则应该统一放到一处，写个 def
        专门算每个 job 的视角，其他地方读」）】一场 job 的视角计划：与本场有关
        的宿主、上帝窗清单、裸 god 升级目标、整场回放条目——视角相关的所有裁决
        只活在这一个函数里，views()/_latest_god_host()/_notify_bind 全是读壳。

        「与本场有关的宿主」= 班底 ∩（∪）登场，按强度取并集、班底在前：
        ①班底：owners 账本（开演 set_owner 登记的本场班底，cast.json 落盘）；
        ②登场：本场行上实际出现过的宿主（旧账无登记也能接住）。
        上帝窗清单 = 相关宿主 ∩ god_window 申报（2026-09-28 拍板：申报了没有
        上帝窗的宿主不列）——相关性判定与展示资格是两件事，不混。相关宿主里
        没有一家申报了上帝窗 → 不出 god:<host>、god_default 落裸 'god'（读本场
        job 账本——web 独演的场，这正是「看这场戏」的正确姿势）。

        残渣账本（daemon/pytest/dsh-308x 多实例历史名）天然进不来：它不是任何
        真场的班底、行上也没出现过——旧规则（god 条目按「有会话数据的宿主」
        三来源并集）被本规则覆盖，_latest_god_host 的 roster 启发式（09-22
        「只认名册宿主」反残渣拍板）随之退役为读壳。"""
        job_id = int(job_id) if job_id is not None else None
        with self._lock:
            if job_id is None:
                job_id = self.latest_job()
            # 「最新」也不存在（空世界）：无相关宿主、无升级目标
            if job_id is None:
                return {'job': None, 'hosts': [], 'god_hosts': [],
                        'god_default': 'god', 'chronica': None}
            # ①班底（owners，冷启动懒恢复）②登场（本场行上的宿主）
            self._cast_of(job_id)
            fam = self._owners.get(job_id) or {}
            rel = [h for h in sorted(fam.keys()) if h]
            for r in self._book(job_id).rows:
                rh = str(r.get('host') or '') or _seg_host(r.get('seg'))
                if rh and rh not in rel:
                    rel.append(rh)
            # god_window 申报过滤（09-28 拍板）+ 升级目标：班底序第一家，没有
            # 一家申报了 → 落裸 god（读本场 job 账本）
            god_hosts = [h for h in rel if self._has_god_window(h)]
            god_default = ('god:%s' % god_hosts[0]) if god_hosts else 'god'
            csid = _session_of_job(os.path.join(self.dir_path,
                                                str(job_id), 'journal.jsonl'))
            return {'job': job_id, 'hosts': rel, 'god_hosts': god_hosts,
                    'god_default': god_default, 'chronica': csid}

    def views(self, job_id=None) -> dict:
        """视角清单（角色视角窗的数据管理面，全在 Python——任何宿主据此搭切换器）：
        god / stage 两个固定视角 + 角色名单。角色两个来源合并（按窗键去重）：
        ①开演花名册（flow_start 的剧本 actors 定义区，cast.json 落盘——开演即有，
        不等第一段落地，2026-09-19 用户拍板）；②账本实际出场（actor/targets）。

        【host 维度·2026-09-19 联机改造】角色的身份是 `(host, 基名)`，不是裸基名：
        多宿主共演时 `[dsh]main` 与 `[zcode]main` 是两个席位，各有各的窗。于是
        id = 'actor:<host>:<基形>'、key = <host>:<基形>（稳定键；host 由行上取，
        页面按 host 决定画不画 [dsh] 前缀——**名字本身永远保持裸名**，前缀只在
        渲染层拼，往数据里塞会破坏 targets/scope 的基名匹配）。
        宿主自己喂的行若不带 host（老桥/裸跑），退化成全部归 '' 一格，行为同改前。"""
        with self._lock:
            plan = self.view_plan(job_id)   # 视角规则单源（2026-10-03，见其注释）
            job_id = plan['job']
            all_hosts = self._hosts_sorted()
            # god 按宿主拆分（2026-09-21 用户拍板：上帝窗带 host 来源，多宿主
            # 不混）——清单只出「与本场有关的宿主 ∩ god_window 申报」的 god:，
            # 没有一家就回落裸 'god'（读本场 job 账本）。规则正文见 view_plan。
            god_hosts = plan['god_hosts']
            if god_hosts:
                base = [{'id': 'god:%s' % h, 'name': '上帝视角', 'host': h}
                        for h in god_hosts]
            else:
                base = [{'id': 'god', 'name': '上帝视角'}]
            base.append({'id': 'stage', 'name': '舞台（纯戏内）'})
            # 整场视角条目（2026-09-29 拍板）：当前场次有台账号的，出一条例目
            # 「整场回放」——指向同一台账场次下的全部 job 拼接视图。无号的场次
            # （旧账未回填/裸跑）不出条目；不是错误，是自然边界。
            csid = plan['chronica']
            if csid is not None:
                base.append({'id': 'chronica:%d' % csid,
                             'name': '整场回放', 'chronica': csid})
            if job_id is None:
                return {'job': None, 'views': base, 'hosts': all_hosts}
            job_id = int(job_id)
            book = self._book(job_id)
            # (host, 基名) 去重：显示取长名（带括号更清楚，2026-09-19 用户拍板）。
            # id/key 里带 host → 显示名再长、同名角色再多也不换 id：前端选中态与
            # view 参数跨轮有效（过滤本就按基形相交）。
            actors, pos = [], {}

            def _add(nm, host=''):
                nm = str(nm)
                bk = min(_name_bases(nm))
                k = (host, bk)
                if k not in pos:
                    pos[k] = len(actors)
                    actors.append({'id': 'actor:' + (host + ':' if host else '') + bk,
                                   'name': nm, 'base': bk, 'host': host,
                                   'key': sanitize_key((host + ':' if host else '') + bk)})
                elif len(nm) > len(actors[pos[k]]['name']):
                    actors[pos[k]]['name'] = nm   # 只换显示名；id/key 稳定不换

            for nm in self._cast_of(job_id):
                _add(nm)         # 花名册未标来源：归 '' 格（老桥/未接线宿主）
            for r in book.rows:
                if r.get('zone') != 'inplay':
                    continue
                # 行归属：旧账本读行 host 章；新账本行不带（刀1），剖段键
                rh = str(r.get('host') or '') or _seg_host(r.get('seg'))
                if r.get('actor'):
                    _add(r['actor'], rh)
                for t in (r.get('targets') or []):
                    _add(t, rh)
            # 显示名合成：ai_request 现场登记的带括号长名优先（用户拍板：菜单带括号）
            disp = self._display_of(job_id)
            for (h, bk), idx in pos.items():
                long = disp.get(bk)
                if long and len(long) > len(actors[idx]['name']):
                    actors[idx]['name'] = long   # 只换显示名；id/key 稳定不换
            # 花名册（host=''）× 实际出场（带 host）并档：同一基形两边都有时，
            # 带宿主条目胜出、无宿主条目撤下。view_filter 只按基形相交、host
            # 不参与匹配，两条目本就是同一个窗；不并档就是视角菜单里「dsh 组」
            # 与「未标来源组」整列重复（2026-09-20 用户实锤：cast.json 裸名开演
            # 即入 '' 格，同批角色上场后又带 host 入格，身份键 (host,基名) 拦不住）。
            # 花名册独有的角色（还没上过场）留在未标来源——「开演即有」不丢。
            stamped = {bk for (h, bk) in pos if h}
            if stamped:
                actors = [a for a in actors if a['host'] or a['base'] not in stamped]
            return {'job': book.job_id, 'views': base + actors,
                    'hosts': self._hosts_sorted()}

    def _hosts_sorted(self) -> list:
        """见过的 host 名（含本场行里出现过的），排序去重。持锁调用。"""
        out = set(self._hosts)
        for book in self._books.values():
            out.update(_hosts_of_rows(book.rows))
        out.discard('')
        return sorted(out)

    def _cast_of(self, job_id: int) -> list:
        """花名册：内存优先，冷启动从 <job_id>/cast.json 恢复（连同 display、
        owner——owner=本场主会话 sid 的**信任集**，戏外行过滤用；按来源宿主分格，
        联机共演时每台各一格）。"""
        if job_id not in self._cast:
            names, disp, owners = [], {}, {}
            try:
                with open(os.path.join(self.dir_path, str(job_id), 'cast.json'),
                          encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data.get('actors'), list):
                    names = [str(a) for a in data['actors'] if str(a).strip()]
                if isinstance(data.get('display'), dict):
                    disp = {str(k): str(v) for k, v in data['display'].items()}
                # 新形状 owners = {host: [sid,...]}（host 空串 = 老宿主/裸跑的全局格）
                raw_owners = data.get('owners')
                if isinstance(raw_owners, dict):
                    for h, v in raw_owners.items():
                        hh = _norm_host(h)
                        lst = v if isinstance(v, list) else [v]
                        got = {str(x).strip() for x in lst if str(x or '').strip()}
                        if got:
                            owners[hh] = got
                # 兼容老形状 owner（单个字符串）：当作全局格的唯一元素
                elif isinstance(data.get('owner'), str) and data['owner'].strip():
                    owners[''] = {data['owner'].strip()}
            except (OSError, ValueError):
                pass
            self._cast[job_id] = names
            self._display[job_id] = disp
            if owners and not self._owners.get(job_id):
                self._owners[job_id] = owners
        return self._cast[job_id]

    def _display_of(self, job_id: int) -> dict:
        """显示名映射（基名 → 带括号长名）：与花名册同文件同加载。"""
        self._cast_of(job_id)   # 同一文件——顺带确保两侧都已装载
        return self._display.get(job_id, {})

    def set_cast(self, job_id, actors) -> None:
        """开演花名册登记（桥在 flow_start 现场喂）：内存 + cast.json 原子落盘。"""
        names = [str(a).strip() for a in (actors or []) if isinstance(a, str) and a.strip()]
        job_id = int(job_id)
        # 开演定格上收 hub（2026-09-25，job 2569 实证缺口）：flow_start 现场若
        # Job 选角账缺页，就地从偏好账誊写——此前只有 dsh 在宿主侧开演后自己补
        # 这一刀，直用工具总纲的宿主（zcode/autoclaw）没人誊写，选角账空账导致
        # 产信回落本宿主、外宿主绑定的角色信寄错格。缺页才补：续跑时账已随
        # 档案存在，自然跳过，不重定格。
        if not os.path.exists(self._cast_job_path(job_id)):
            self.cast_job_snapshot(job_id)
        with self._lock:
            self._cast[job_id] = names
            self._display.setdefault(job_id, {})
            self._persist_meta(job_id)

    def remember_display(self, job_id, name) -> None:
        """登记带括号的显示名（桥在 ai_request 现场喂——派工瞬间菜单即可长出
        括号，不用等段落落账）。基名相同、更长才更新。"""
        nm = str(name or '').strip()
        if not nm:
            return
        job_id = int(job_id)
        key = min(_name_bases(nm))
        with self._lock:
            self._cast_of(job_id)                        # 确保已装载（不重读盘）
            disp = self._display.setdefault(job_id, {})
            if len(disp.get(key, '')) >= len(nm):
                return
            disp[key] = nm
            self._persist_meta(job_id)

    def _persist_meta(self, job_id: int) -> None:
        """cast.json 原子落盘（actors 花名册 + display 显示名映射 + owners 信任集）。
        owners 形状 {host: [sid,...]}；host 空串=老宿主/裸跑的全局格。
        兼容读取见 _cast_of（老文件里的单值 owner 照收）。持锁调用。"""
        try:
            book_dir = os.path.join(self.dir_path, str(job_id))
            os.makedirs(book_dir, exist_ok=True)
            fam = self._owners.get(job_id) or {}
            owners = {h: sorted(v) for h, v in fam.items() if v}
            tmp = os.path.join(book_dir, 'cast.json.tmp')
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump({'actors': self._cast.get(job_id, []),
                           'display': self._display.get(job_id, {}),
                           'owners': owners},
                          f, ensure_ascii=False)
            os.replace(tmp, os.path.join(book_dir, 'cast.json'))
        except OSError:
            pass

    def live_blocks(self, job_id=None, view: str = None) -> list:
        """正在打字的块。view 给定时按视角过滤：角色视角只收本人在打的块
        （与 _broadcast 的直播过滤同尺），god/stage 全收。"""
        with self._lock:
            out = []
            for (jid, key), b in self._live.items():
                if job_id is not None and jid != int(job_id):
                    continue
                if view and view.startswith('actor:') \
                        and not (_name_bases(b.get('actor') or '') & _name_bases(_view_actor(view))):
                    continue
                out.append({'key': key, **b})
            return out

    def live_count(self, job_id) -> int:
        return sum(1 for k in self._live if k[0] == int(job_id))

    # ── print 旁路（2026-09-19 用户拍板「加一路显示」）────────────────────
    # 桥进程 stdout/stderr 的旁观镜像：一行一条，环形缓冲 + 全订阅广播。
    # 消费面只有投影页右上角的调试浮层（projection_center.html）；femogen 的
    # 『编译器』页走宿主读 OS 管道那路（bridge stderr → diag-feed），与此互不相干。

    def add_print(self, text: str, stream: str = 'stdout') -> None:
        """入账一行镜像（采集端已按行切好）并广播。绝不写 stdout/stderr——
        镜像自己再进镜像就是死循环。text 过一遍 utf-8 往返：孤代理（lone
        surrogate）替换掉，保证 WS 帧 encode 不炸。"""
        stream = 'stderr' if stream == 'stderr' else 'stdout'
        line = str(text or '')
        try:
            line.encode('utf-8')
        except UnicodeEncodeError:
            line = line.encode('utf-8', 'replace').decode('utf-8')
        with self._lock:
            self._print_seq += 1
            item = {'seq': self._print_seq, 't': int(time.time() * 1000),
                    'stream': stream, 'text': line}
            self._prints.append(item)
            try:
                self._broadcast_print(item)
            except Exception:  # noqa: BLE001 — 旁路绝不反噬主路
                pass

    def prints_tail(self, limit=None) -> list:
        """最近 n 条（时间正序；缺省 _PRINT_TAIL_DEFAULT，上限 _PRINT_CAP）。"""
        try:
            n = int(limit) if limit is not None else _PRINT_TAIL_DEFAULT
        except (TypeError, ValueError):
            n = _PRINT_TAIL_DEFAULT
        n = max(1, min(n, _PRINT_CAP))
        with self._lock:
            return list(self._prints)[-n:]

    def clear_prints(self) -> None:
        """清空镜像环（投影页调试浮层「清空」按钮）。"""
        with self._lock:
            self._prints.clear()

    def _broadcast_print(self, item: dict) -> None:
        """print 广播：不带 job/视角语义，全部订阅者都收（浮层是页面级的，
        不跟场次走）。持锁调用（q.put 不阻塞）；满队列断连同 _broadcast。"""
        data = json.dumps({'ctrl': 'print', **item}, ensure_ascii=False)
        for sub in list(self._subs):
            try:
                sub.q.put_nowait(data)
            except queue.Full:
                if sub.ws is not None:
                    sub.ws.close()

    # ── 人类等待镜像 + 投影页收件口（2026-09-20）────────────────────────
    def set_mailbox(self, mailbox_mod) -> None:
        """桥注入驿站模块（hub 不 import 兄弟件，依赖倒置）；None=信箱不可用。"""
        self._mailbox = mailbox_mod

    def set_doorbell_live_hosts(self, fn) -> None:
        """daemon 注入门铃簿活心跳宿主名的 callable（报到即算在线，无论有无
        门牌）——cast 在线视图的唯一在线判据；None=没注入，online 视图退化
        为全账（与 all 同义，不造第二种裁决）。"""
        self._doorbell_live_hosts = fn

    def set_mailbox_host(self, host) -> None:
        """桥注入信箱宿主 id（2026-09-24 多实例并存）=桥的 args.host：寄人类信
        的 target_host **兜底**用它（2026-09-25 hub 唯一化：等待态自带的 host
        优先——见 human_input；单实例下两词同值，兜底等于原路径）。"""
        self._mailbox_host = str(host or '')

    def set_waiting(self, state) -> None:
        """等待态入账（EventProjector 经 sink 调，事件线程拍）：存镜像 + 广播。
        waiting 是**控制态不是行**：不过 VIEW_POLICY、不落账本，全订阅者无差别
        广播——亮不亮输入框由页面拿它和自己的视角现算。
        2026-10-02 复数化（par 并发多条线各自等到人类）：镜像=有序 dict
        {wait_key: 席位}。入参三种：list=整表替换（EventProjector 的正身推法，
        序=human_wait 到达序）；dict=单席 upsert（/api feed 的单席老形态与单测
        直调兼容，键=wait_key，已在该键上则原位更新）；None=全清（落幕/出错/
        暂停收麦）。
        席位['seg'] 由 EventProjector 报初值（路由键）；**世代键修正只归
        _seg_open**——续跑让位开新段那一拍段已落地、重推修正过的镜像（在
        human_wait 那拍修会在段落账前查到上一代行，改错还卡住重推判定）。
        2026-10-03 prompt 状态闸配套：席位**离册**（收麦/清场）时受影响的段行
        重播一遍 row-update——prompt 显示跟着席位走（_apply_view_policy 的
        human_prompt 支路），但广播帧是行、镜像变化不是行：交卷落账那一拍席位
        还在册（human_done 晚于 fill 半拍），帧里的 prompt 按当时事实放行，页面
        拿着旧帧会一直挂到刷新（用户实测稳定复现）。离册即按新事实重播，活页面
        即时收敛。"""
        with self._lock:
            prev = dict(self._waiting)
            if state is None:
                self._waiting = {}
            elif isinstance(state, list):
                self._waiting = {str(s.get('wait_key') or ''): dict(s)
                                 for s in state if isinstance(s, dict)
                                 and str(s.get('wait_key') or '')}
            elif isinstance(state, dict):
                wk = str(state.get('wait_key') or '')
                if wk:
                    self._waiting[wk] = dict(state)
            msg = json.dumps({'ctrl': 'waiting',
                              'waiting': self.current_waiting_unlocked()},
                             ensure_ascii=False)
            for s in list(self._subs):
                try:
                    s.q.put_nowait(msg)
                except queue.Full:
                    pass   # 满队列=该连接已在断开流程，重连快照自带最新态
            for wk, seat in prev.items():
                if wk not in self._waiting:
                    self._reemit_seg_for_seat(seat)

    def _reemit_seg_for_seat(self, seat: dict) -> None:
        """席位离册后的显示收尾（2026-10-03，见 set_waiting 块注）：该席段行重播
        一遍 row-update（重过 _apply_view_policy——此刻席位已不在册，prompt 槽
        按新事实扣下，收口段=「showprompt(如有)+ID+发言内容」）。**两个维度都要
        到**：job 簿订户走 _broadcast；god:<host> 升级订户读的是织入副本（行维度
        广播明确不投会话订户——「织入行绝不双份」），副本在 _sbooks 里由织入
        原样重放同帧而来、prompt 同样在册——只播 job 维度，会话订户的页面照样
        挂着旧提示到刷新（v3 帧日志+真页复现实锤）。找不到段行（行还没落账/
        账本被逐出）静默——快照兜底接住。持锁调用。"""
        seg = str(seat.get('seg') or '')
        if not seg:
            return
        try:
            job_id = int(seat.get('job_id'))
        except (TypeError, ValueError):
            return
        if job_id in self._books:
            book = self._books[job_id]
            row = next((r for r in book.rows if str(r.get('seg') or '') == seg), None)
            if row is not None:
                self._emit(book, {'ctrl': 'row-update', 'row': self._compose(book, row)},
                           live=False, filter_row=row)
        for sb in list(self._sbooks.values()):
            srow = next((r for r in sb.rows if str(r.get('seg') or '') == seg), None)
            if srow is not None:
                self._broadcast_sess(sb, {'ctrl': 'row-update', 'row': self._compose(sb, srow)},
                                     live=False, filter_row=srow)

    def current_waiting_unlocked(self):
        """席位清单（插入序=human_wait 到达序）。持锁调用（广播/快照同一把锁内
        取值用）；对外只走 current_waiting。"""
        return [dict(s) for s in self._waiting.values()]

    def current_waiting(self):
        with self._lock:
            return self.current_waiting_unlocked()

    def human_input(self, wait_key, text, variables=None):
        """投影页人类席交卷：校验当前等待 → 八维 speech 信进驿站（与 DSH 投影窗
        的 feedHumanNode、CLI 手写信同一出站口，桥出站轮询 ≤0.5s 喂引擎）。
        返回 (http_code, body)。信封词汇 body={'chat_text', variables?}——
        引擎 _try_apply_human_variables 直取（变量赋值绕过文本解析的根治路）。
        不在这里清等待镜像：等引擎 human_done 事件自然收麦（≤1s），提交期间
        双击由 wait_key 校验+前端禁用双保险挡住（第二封成死信，无害）。"""
        text = str(text or '')
        clean_vars = {}
        if isinstance(variables, dict):
            clean_vars = {str(k): str(v) for k, v in variables.items()
                          if str(v).strip()}
        # wait_key 随每一张回执（2026-10-02 复数化）：受理与失败都要——多席并发时
        # 投影页按它把回执落回对应席位；失败不带键会让该席的 busy 态无人解锁。
        _wk = str(wait_key or '')
        if not text.strip() and not clean_vars:
            return 400, {'ok': False, 'wait_key': _wk,
                         'error': 'text or variables required'}
        with self._lock:
            seat = self._waiting.get(str(wait_key)) if wait_key else None
            w = dict(seat) if seat else None
            empty = not self._waiting
        if not w:
            if empty:
                return 409, {'ok': False, 'wait_key': _wk,
                             'error': 'engine is not waiting for human input'}
            return 409, {'ok': False, 'wait_key': _wk,
                         'error': 'wait_key mismatch (stale input?)'}
        if self._mailbox is None:
            return 503, {'ok': False, 'wait_key': _wk,
                         'error': 'mailbox unavailable'}
        body_payload = {'chat_text': text}
        if clean_vars:
            body_payload['variables'] = clean_vars
        # 寄信宿主优先级（2026-09-25 hub 唯一化反转，设计稿 §三「寄信语义坑」）：
        # **等待态自带的 host 优先**——等待镜像是哪个宿主的桥推来的，信就寄给谁。
        # 复用模式下唯一 hub 是别家养的，本 hub 的 _mailbox_host=养桥；若养桥优先，
        # 别家等待的人类信会被寄进养桥的格子，被养桥捞走又因 job 不是它的而丢弃
        # ——那家的戏就卡死等人。_mailbox_host 降为等待态无 host 时的兜底
        # （单实例下两词同值，行为零变化）。
        target = str(w.get('host') or '') or self._mailbox_host
        letter = self._mailbox.post(
            job_id=int(w.get('job_id') or 0),
            soul=str(w.get('actor') or 'human'),
            kind='speech', payload=text, action='send', delivery='urgent',
            who_move='customer_hook', who_require='system_require',
            target_host=target,
            node=w.get('node'), ref=str(wait_key), body=body_payload)
        # wait_key 随回执（2026-10-02 复数化）：多席并发时投影页按它把受理/失败
        # 落到对应席位，不再只认「当前那一席」（各失败分支同款，见上）。
        return 200, {'ok': True, 'posted': True, 'wait_key': _wk,
                     'letter_id': letter.get('id')}

    def diag(self) -> dict:
        """排障面（只读）：协议版本、代码修订号、订阅数/打字块数/已装载账本数/在写草稿数、
        来源宿主名册、最新场的来源账（host→信任 sid 集，联机排障用）、主 session
        榜单与已装载会话账本数（2026-09-20 会话账本）。"""
        with self._lock:
            drafts = sum(len(s) for b in self._books.values() for s in b.drafts.values())
            drafts += sum(len(s) for b in self._sbooks.values() for s in b.drafts.values())
            latest = self.latest_job()
            last_sess = ('%s:%s' % self._last_session) if self._last_session else None
            return {'ok': True, 'proto': PROTO_VERSION, 'rev': HUB_REV, 'dir': self.dir_path,
                    'subs': len(self._subs), 'ws': len(self._wssocks),
                    'prints': len(self._prints),
                    'live_blocks': len(self._live), 'draft_slots': drafts,
                    'books_loaded': len(self._books),
                    'session_books_loaded': len(self._sbooks),
                    'latest_session': last_sess,
                    'bindings': self.bindings_view(),
                    'roster_hosts': sorted(self._load_roster().keys()),
                    'hosts': [h for h, _ in sorted(self._hosts.items())],
                    'owners': self.host_book(latest) if latest is not None else {},
                    'latest_job': latest}

    def latest_job(self):
        # _last_job 是内存态（hub 重启即失）；「最新」回落到盘上最近有活动的一场
        return self._last_job if self._last_job is not None else self._latest_journal_job()

    def _latest_journal_job(self):
        """目录扫描取最近有行的场次（按末行时刻）。只轻量盘点不物化——
        「最新」是每条 WS 订阅的缺省落脚点，原来这条路径会把盘上全部历史
        逐本装进内存（每次页面打开都来一遍）。"""
        ids = set(self._books)
        if os.path.isdir(self.dir_path):
            for fn in os.listdir(self.dir_path):
                if fn.isdigit() and os.path.isdir(os.path.join(self.dir_path, fn)):
                    ids.add(int(fn))
        best, best_t = None, None
        for jid in sorted(ids):
            book = self._books.get(jid)
            if book is not None:
                t = book.rows[-1]['t'] if book.rows else None
            else:
                t = _stat_journal(os.path.join(self.dir_path, str(jid),
                                               'journal.jsonl'))[2]
            if t is None:
                continue
            if best is None or t > best_t:
                best, best_t = jid, t
        return best

    # ── 广播 ──────────────────────────────────────────────────────────

    def _emit(self, book: _JobBook, msg, live: bool, actor=None, filter_row=None):
        """账本 → 订阅者的分派口（2026-09-21）：job 账本走 _broadcast（job 维度
        匹配）；会话账本走 _broadcast_sess（sess 维度匹配，同一套视角/策略闸）。
        持锁调用。"""
        if book.sess is not None:
            self._broadcast_sess(book, msg, live=live, actor=actor, filter_row=filter_row)
        else:
            self._broadcast(book.job_id, msg, live=live, actor=actor, filter_row=filter_row)

    def _broadcast_sess(self, book: _JobBook, msg, live: bool, actor=None, filter_row=None):
        """会话账本广播：投给 god:<host> 订阅者（sub.sess 与本账相同）。
        视角过滤/显示策略/live actor 过滤与 _broadcast 同尺；row 与 row-update
        按订阅各序列化一份（策略逐窗执行）。持锁调用。"""
        if not isinstance(msg, dict):
            return
        for sub in list(self._subs):
            if sub.sess is not None:
                if sub.sess != book.sess:
                    continue
            elif not (sub._via_god and sub.god_host == book.sess[0]):
                continue   # 非本宿主的会话订户不收；升级订户（god:host）跟随
            if live:
                if sub.view.startswith('actor:') and actor is not None \
                        and not (_name_bases(str(actor)) & _name_bases(_view_actor(sub.view))):
                    continue
            elif not view_filter(sub.view, filter_row if filter_row is not None else msg):
                continue
            row_src = msg.get('row') if isinstance(msg.get('row'), dict) else (
                msg if ('kind' in msg and 'n' in msg and 'ctrl' not in msg) else None)
            payload = json.dumps(msg, ensure_ascii=False)
            if row_src is not None:
                prow = self._apply_view_policy(book, sub.view, row_src)
                if prow is None:
                    continue   # 本视角下整行被策略扣下
                payload = json.dumps(
                    {'ctrl': 'row-update', 'row': prow} if filter_row is not None else prow,
                    ensure_ascii=False)
            try:
                sub.q.put_nowait(payload)
            except queue.Full:
                if sub.ws is not None:
                    sub.ws.close()

    def _broadcast(self, job_id: int, msg, live: bool, actor=None, filter_row=None):
        """行/ctrl 消息推给匹配视角的订阅者。持锁调用（q.put 不阻塞）。
        直播块（live=True）同样进角色视角——只播「本人在打」的块：块的 actor
        与视角名做基形匹配（2026-09-19 用户拍板：切到哪个窗就播哪个窗；别人
        正打的半截话不进别人窗，空 actor=身份不明同样不进）。actor=None
        （live-clear 等全场级 ctrl）对全部视角放行。
        会话账本（job_id=sid 字符串）在此空转：v1 无 WS 会话订阅面（dsh 读侧走
        REST 轮询），WS session 订阅留待网页端接入时再加。"""
        if not isinstance(msg, dict):
            return
        if not isinstance(job_id, int):
            return   # 会话账本：无订阅者，绝不能让 int() 转换炸进织入/直投路径
        if filter_row is not None:
            # row-update：msg['row'] 是合成好的行（带 drafts）；filter_row 只是
            # 老式可见性判据（裸行）——序列化必须用合成那份，否则丢草稿层
            row_src = msg.get('row') if isinstance(msg.get('row'), dict) else filter_row
        else:
            row_src = msg if ('kind' in msg and 'n' in msg and 'ctrl' not in msg) else None
        # 纯 ctrl 帧（waiting/live-clear/row-del/live-done 等，无行体）：消息
        # 原样下发——绝不许被下面的 row-update 包装逻辑拿去当行体。带 filter_row
        # 的（row-del 一类）只借行判可见性（看得到那行的视角才收得到）。这里
        # 曾经把 pure_ctrl 用「row_src is None」二次赋值覆盖：row-del 恰好带着
        # filter_row（旧行本体），row_src 非空 → 删除帧被包装成旧行的 row-update
        # ——删不掉还诈尸，活页面旧行带着台词复活，与搬家新行双份；刷新读账本
        # （墓碑已滤）又只剩一份（2026-10-02 人类段搬家双份实案，落幕扫除的
        # 空段删除同病）。
        pure_ctrl = bool(msg.get('ctrl')) and not isinstance(msg.get('row'), dict)
        data = json.dumps(msg, ensure_ascii=False) if (pure_ctrl or row_src is None) else None
        book = self._books.get(int(job_id)) if (row_src is not None and not pure_ctrl) else None
        # 全场级 ctrl（无 filter_row 的，如 waiting/live-clear）：会话订户也照收
        # ——只有「行」才按会话/job 二选一投递（2026-09-22）；row-del 带行判据，
        # 归 job 簿自己的订户（会话簿的删除由织入侧自己的 row-del 送达，行号各归各）。
        for sub in list(self._subs):
            if (sub.sess is not None or sub._via_god) and not (pure_ctrl and filter_row is None):
                continue   # 会话订户（含升级订户）只走会话广播：织入行绝不双份
            if sub.job_id is not None:
                if sub.job_id != job_id:
                    continue
            elif self._last_job != job_id:
                continue
            if live:
                if sub.view.startswith('actor:') and actor is not None \
                        and not (_name_bases(str(actor)) & _name_bases(_view_actor(sub.view))):
                    continue
            elif not view_filter(sub.view, filter_row if filter_row is not None else msg):
                continue
            payload = data
            if pure_ctrl:
                payload = data if data is not None else json.dumps(msg, ensure_ascii=False)
            elif row_src is not None:
                prow = self._apply_view_policy(book, sub.view, row_src) \
                    if book is not None else row_src
                if prow is None:
                    continue   # 本视角下整行被策略扣下
                payload = json.dumps(
                    {'ctrl': 'row-update', 'row': prow} if filter_row is not None else prow,
                    ensure_ascii=False)
            try:
                sub.q.put_nowait(payload)
            except queue.Full:
                # 消费端卡死：满即断这条连接（ws 关闭 → 读写线程各自退场），
                # 重连有快照，历史不丢
                if sub.ws is not None:
                    sub.ws.close()

    def _broadcast_live(self, job_id: int, key: str, blk: dict):
        msg = {'ctrl': 'live', 'key': key, 'actor': blk.get('actor') or '',
               'blockKind': blk.get('blockKind') or 'text', 'text': blk.get('text') or ''}
        if blk.get('name'):
            msg['name'] = blk['name']
        # 块级帧恒带块 actor 过滤（空 actor=身份不明，不进任何角色窗）
        self._broadcast(job_id, msg, live=True, actor=str(blk.get('actor') or ''))

    # ── 服务面 ────────────────────────────────────────────────────────

    def mount_route(self, method: str, prefix: str, fn) -> None:
        """挂载外部路由（施工清单 §五第 2 步 HTTP 面+风险表「挂载口子」）：
        先查挂载路由再走原链。fn(handler, path, body_bytes) 收到原始请求柄——
        返回 True=已自答（含 SSE 式长驻流，自行写响应）；返回 False/None=让路，
        继续走 hub 原链。异常沿 handler 既有 except 走 400/500，绝不静默。
        纪律：POST 路由在让路前已读走请求体——挂载前缀不得与 hub 原链 POST
        路径重叠（重叠处让路=原链拿到空体）；GET 无体，无此限制。"""
        method = str(method).upper()
        for i, (m, p, _f) in enumerate(self._mounted):
            if m == method and p == prefix:
                self._mounted[i] = (method, prefix, fn)
                return
        self._mounted.append((method, prefix, fn))

    def route_for(self, method: str, path: str):
        """最长前缀匹配（/cmd/job_start 命中 /cmd/ 而不误吞更长的兄弟前缀）。"""
        best = None
        for m, p, fn in self._mounted:
            if m == method and path.startswith(p):
                if best is None or len(p) > len(best[0]):
                    best = (p, fn)
        return best[1] if best else None

    def start_server(self, host='127.0.0.1', port=0):
        """开本地 HTTP/WS 端口（mailbox-push 自管端口同款先例）。返回 (port, thread)。"""
        hub = self

        class Handler(_HubHandler):
            hub_ref = hub

        class QuietServer(ThreadingHTTPServer):
            """静音断连噪音：socketserver 默认把每个 ConnectionResetError
            （WinError 10054 远程主机强迫关闭）打成整屏 traceback——浏览器
            预连接/页签关闭/桥重启时客户端先撤连接是家常便饭，全无害；print
            镜像里不该全是这个。其余异常照旧大声。"""
            def handle_error(self, request, client_address):
                exc = sys.exc_info()[1]
                if isinstance(exc, (ConnectionError, TimeoutError)):
                    return
                super().handle_error(request, client_address)

        srv = QuietServer((host, port), Handler)
        srv.daemon_threads = True
        self._server = srv
        th = threading.Thread(target=srv.serve_forever, kwargs={'poll_interval': 0.5},
                              daemon=True)
        th.start()
        return srv.server_address[1], th

    def stop_server(self):
        srv, self._server = self._server, None
        if srv is None:
            return
        with self._lock:
            socks = list(self._wssocks)
        for s in socks:
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                s.close()
            except OSError:
                pass
        srv.shutdown()
        srv.server_close()
        try:
            # 撤自发现件：干净停机不留死端口地址
            os.remove(os.path.join(self.dir_path, 'hub.json'))
        except OSError:
            pass


# ── 最小 WebSocket（RFC6455 服务端，零依赖：文本帧收发 + ping/pong + close）──

_WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'


def _read_exact(rfile, n: int) -> bytes:
    buf = rfile.read(n)
    if buf is None or len(buf) != n:
        raise ConnectionError('ws short read')
    return buf


class _WS:
    def __init__(self, sock, rfile, wfile):
        self.sock = sock
        self.rfile = rfile
        self.wfile = wfile
        self.alive = True
        self._wlock = threading.Lock()

    @staticmethod
    def accept_key(key: str) -> str:
        digest = hashlib.sha1((key + _WS_GUID).encode('ascii')).digest()
        return base64.b64encode(digest).decode('ascii')

    def recv_frame(self):
        """返回 (opcode, payload)。只解客户端掩码帧；EOF 抛 ConnectionError。"""
        h = _read_exact(self.rfile, 2)
        opcode = h[0] & 0x0F
        masked = bool(h[1] & 0x80)
        ln = h[1] & 0x7F
        if ln == 126:
            ln = struct.unpack('>H', _read_exact(self.rfile, 2))[0]
        elif ln == 127:
            ln = struct.unpack('>Q', _read_exact(self.rfile, 8))[0]
        mask = _read_exact(self.rfile, 4) if masked else b''
        payload = _read_exact(self.rfile, ln) if ln else b''
        if mask:
            payload = bytes(b ^ mask[i & 3] for i, b in enumerate(payload))
        return opcode, payload

    def _send(self, opcode: int, payload: bytes):
        h = bytearray([0x80 | opcode])
        n = len(payload)
        if n < 126:
            h.append(n)
        elif n < 65536:
            h.append(126)
            h += struct.pack('>H', n)
        else:
            h.append(127)
            h += struct.pack('>Q', n)
        with self._wlock:
            self.wfile.write(bytes(h) + payload)
            self.wfile.flush()

    def send_text(self, s: str):
        self._send(0x1, s.encode('utf-8'))

    def send_ping(self):
        self._send(0x9, b'')

    def send_pong(self, payload: bytes):
        self._send(0xA, payload)

    def send_close(self):
        try:
            self._send(0x8, b'')
        except OSError:
            pass

    def close(self):
        self.alive = False
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        try:
            self.sock.close()
        except OSError:
            pass


def _ws_writer(ws: _WS, sub: _Sub):
    """单写线程：按序吐队列；15s 无消息发 ws ping 当心跳兼探活。"""
    while ws.alive:
        try:
            msg = sub.q.get(timeout=15)
        except queue.Empty:
            try:
                ws.send_ping()
            except OSError:
                break
            continue
        if msg is None:
            break
        try:
            ws.send_text(msg)
        except OSError:
            break
    ws.alive = False


class _HubHandler(BaseHTTPRequestHandler):
    hub_ref: ProjectionHub = None  # 子类注入
    protocol_version = 'HTTP/1.1'
    server_version = 'femo-projection-hub/0.1'

    def log_message(self, fmt, *args):  # 桥是 stdio 进程：默认静默
        pass

    # ── 基础 ──
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # 页面与 API 一律禁缓存：投影是实况，浏览器缓存会把旧页面/旧清单
        # 钉在屏上（2026-09-19 实锤：用户刷新仍见旧下拉）。
        self.send_header('Cache-Control', 'no-store')

    def _json(self, code: int, obj, content_type='application/json; charset=utf-8'):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    # ── 路由 ──
    def do_POST(self):
        hub = self.hub_ref
        try:
            path = urlparse(self.path).path
            _m = hub.route_for('POST', path)
            if _m is not None:
                _len = int(self.headers.get('Content-Length') or 0)
                _body = self.rfile.read(_len) if _len else b''
                if _m(self, path, _body):
                    return               # 挂载路由已自答
                # 让路：继续走 hub 原链
            if path == '/prints':
                # print 旁路上行（第1步 常驻化 2026-09-26）：桥在复用模式下把
                # 自己的 stdout/stderr 镜像投给常驻 hub（_RemotePrintSink）——
                # 浮层常驻必有，不再只有养桥有。best-effort：坏包 400，不接疑似
                # 超长（_RemotePrintSink 已截 2000 字）。
                ln = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(ln) if ln else b'{}'
                try:
                    req = json.loads(body.decode('utf-8'))
                except Exception:
                    self._json(400, {'ok': False, 'error': 'bad json'})
                    return
                hub.add_print(str(req.get('text') or ''),
                              str(req.get('stream') or 'stdout'))
                self._json(200, {'ok': True})
                return
            if path == '/api/human-input':
                # 投影页人类席交卷（REST 面；页面本体走 WS ctrl:human-input 同源，
                # 这里给程序化调用/selftest 用）。校验+寄信全在 hub.human_input。
                ln = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(ln) if ln else b'{}'
                req = json.loads(body.decode('utf-8'))
                code, out = hub.human_input(req.get('wait_key'), req.get('text'),
                                            req.get('variables'))
                self._json(code, out)
                return
            if path == '/sessions/announce':
                # 宿主上报 FEMO 会话名册（2026-09-21 主会话面板）：
                # {source, upsert:[{sid,name,job}], delist:[sid], bind:"<sid>",
                #  order:[sid,…]=宿主 UI 顺序}
                ln = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(ln) if ln else b'{}'
                req = json.loads(body.decode('utf-8'))
                out = hub.announce(str(req.get('source') or ''),
                                   req.get('upsert'), req.get('delist'),
                                   req.get('bind'), req.get('order'))
                self._json(200 if out.get('ok') else 400, out)
                return
            if path == '/bind':
                # 显式换绑主 session（2026-09-20 会话账本）：{"session":"host:sid"}
                ln = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(ln) if ln else b'{}'
                req = json.loads(body.decode('utf-8'))
                out = hub.bind(str(req.get('session') or ''))
                self._json(200 if out.get('ok') else 400, out)
                return
            if path == '/sessions/cast-preference':
                # 会话↔角色绑定（cast 选角账·偏好半场）：{host, sid, soul|null}
                ln = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(ln) if ln else b'{}'
                req = json.loads(body.decode('utf-8'))
                out = hub.cast_preference_set(req.get('host'), req.get('sid'),
                                              req.get('soul'))
                self._json(200 if out.get('ok') else 409, out)
                return
            if path == '/cast':
                # Job 选角账：{job_id, soul, sid, host?}=登记一条；
                # {job_id, subkind:"snapshot"}=开演定格（偏好账誊写）
                ln = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(ln) if ln else b'{}'
                req = json.loads(body.decode('utf-8'))
                job_id = req.get('job_id')
                if job_id is None:
                    self._json(400, {'error': 'job_id required'})
                    return
                if str(req.get('subkind') or '') == 'snapshot':
                    out = hub.cast_job_snapshot(job_id)
                else:
                    out = hub.cast_entry_put(job_id, req.get('soul'),
                                             req.get('sid'), req.get('host'))
                self._json(200 if out.get('ok') else 400, out)
                return
            if path == '/hub-register':
                # 复用模式的喂方登记四件合一（hub 唯一化 2026-09-25）：桥不自起、
                # 全部交互走 HTTP 时，原来对进程内 hub 的四处直调改走这里——
                # 花名册（cast）/显示名（display）/归属登记（owner）/等待态
                # （waiting），外加自称登记（host，返回归一名）。
                ln = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(ln) if ln else b'{}'
                req = json.loads(body.decode('utf-8'))
                kind = str(req.get('kind') or '')
                if kind == 'host':
                    self._json(200, {'ok': True,
                                     'host': hub.register_host(req.get('name'),
                                                               req.get('god_window'))})
                elif kind == 'cast':
                    hub.set_cast(req.get('job_id'), req.get('actors'))
                    self._json(200, {'ok': True})
                elif kind == 'display':
                    hub.remember_display(req.get('job_id'), req.get('name'))
                    self._json(200, {'ok': True})
                elif kind == 'owner':
                    hub.set_owner(req.get('job_id'), req.get('sid'),
                                  str(req.get('host') or ''))
                    self._json(200, {'ok': True})
                elif kind == 'waiting':
                    hub.set_waiting(req.get('state'))
                    self._json(200, {'ok': True})
                else:
                    self._json(400, {'error': 'kind must be '
                                     'host/cast/display/owner/waiting'})
                return
            if path != '/feed':
                self._json(404, {'error': 'not found'})
                return
            ln = int(self.headers.get('Content-Length') or 0)
            body = self.rfile.read(ln) if ln else b'{}'
            req = json.loads(body.decode('utf-8'))
            # 双寻址（2026-09-20 会话账本）：job_id（引擎/戏内）与 session
            # （宿主戏外直投）二选一——都带是喂方 bug，都缺是老请求。
            has_job = req.get('job_id') is not None
            has_sess = bool(str(req.get('session') or '').strip())
            if has_job and has_sess:
                self._json(400, {'error': 'job_id and session are mutually exclusive'})
                return
            if not has_job and not has_sess:
                self._json(400, {'error': 'job_id or session required'})
                return
            if has_sess:
                res = hub.feed_session(str(req.get('session')), req.get('frames'),
                                       str(req.get('source') or ''))
                if not res.get('ok'):
                    self._json(400, res)
                    return
                self._json(200, res)
                return
            res = hub.feed(req['job_id'], req.get('frames'), str(req.get('source') or ''))
            self._json(200, res)
        except (ValueError, json.JSONDecodeError) as exc:
            self._json(400, {'error': str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._json(500, {'error': str(exc)})

    def do_GET(self):
        url = urlparse(self.path)
        if (self.headers.get('Upgrade') or '').lower() == 'websocket':
            self._ws_upgrade(url)
            return
        try:
            path, q = url.path, parse_qs(url.query)
            hub = self.hub_ref
            _m = hub.route_for('GET', path)
            if _m is not None and _m(self, path, b''):
                return                   # 挂载路由已自答（GET 无体可读）
            if path == '/health':
                self._json(200, {'ok': True, 'proto': PROTO_VERSION,
                                 'data': hub.dir_path,
                                 'latest_job': hub.latest_job(),
                                 'hosts': hub._hosts_sorted(),
                                 'jobs': len(hub.jobs()),
                                 'waiting': hub.current_waiting()})
            elif path == '/diag':
                self._json(200, hub.diag())
            elif path == '/prints':
                # print 旁路镜像回放（2026-09-19「加一路显示」）：?limit=n 缺省 200
                self._json(200, {'ctrl': 'prints', 'items': hub.prints_tail(
                    (q.get('limit') or [None])[0])})
            elif path == '/hosts':
                self._json(200, {'hosts': hub.hosts()})
            elif path == '/mounts':
                # 挂载共同账本（2026-10-04，用户拍板「投影中心做的超然一些」）：
                # 各宿主挂了哪些剧本，投影中心开始钮的下拉菜单从这里来。账本
                # 正身=mount-registry.mjs 单点写的 <数据根>/mounts.json（与
                # femo_files.json 同层的跨宿主小本子），hub 只读不写（单写者
                # 纪律）；缺文件/坏文件=空清单（投影中心没有挂载概念，读到
                # 什么算什么），坏文件不挡页面。
                try:
                    with open(hub._mounts_path(), 'r', encoding='utf-8') as _f:
                        reg = json.load(_f)
                    mounts = reg.get('mounts') if isinstance(reg, dict) else None
                    self._json(200, {'mounts': mounts if isinstance(mounts, list) else []})
                except (OSError, ValueError):
                    self._json(200, {'mounts': []})
            elif path == '/jobs':
                self._json(200, {'jobs': hub.jobs(),
                                 'hosts': hub._hosts_sorted(),
                                 'latest': hub.latest_job()})
            elif path == '/sessions':
                # 会话账本清单 + 主 session 榜单（2026-09-20 会话账本）
                self._json(200, hub.sessions())
            elif path == '/sessions/cast-preferences':
                # 会话↔角色绑定视图（cast 选角账·偏好半场）；?scope=online=
                # 只认在线宿主里的最新提名（在线判据=门铃簿，见视图 docstring）
                self._json(200, hub.cast_preferences_view(
                    str((q.get('scope') or ['all'])[0])))
            elif path == '/cast':
                # Job 选角账（?job=N；缺 job=400——选角账没有「最新场」缺省语义，
                # 消费方明确知道自己在看哪场戏）
                job = self._qjob(q)
                if job is None:
                    self._json(400, {'error': 'job query param required'})
                else:
                    self._json(200, hub.cast_job(job))
            elif path == '/owner':
                # 本场主会话信任账（hub 唯一化 2026-09-25）：复用模式的桥喂行前
                # 查这个（=进程内的 has_owner 任意格判据），漏登记走 /hub-register 补
                job = self._qjob(q)
                if job is None:
                    self._json(400, {'error': 'job query param required'})
                else:
                    self._json(200, {'ok': True, 'job': job,
                                     'owners': hub.host_book(job)})
            elif path == '/chronica':
                # 台账场次清单（2026-09-29 整场回放）：按台账号归拢的 job 分组，
                # 最近活动降序——页面「整场视角」下拉与诊断同源。
                self._json(200, {'chronica': hub.chronica_sessions()})
            elif path == '/chronica/view':
                # 整场快照：session=台账号（必填）。轮询增量用 after=next+1，
                # next 是跨 job 的累计偏移（“j<job>:<n>” 字符串）。
                sid = (q.get('session') or [None])[0]
                if sid is None:
                    self._json(400, {'error': 'session query param required'})
                else:
                    self._json(200, hub.snapshot_chronica(
                        sid, (q.get('view') or ['god'])[0],
                        int((q.get('after') or ['0'])[0])))
            elif path == '/views':
                self._json(200, hub.views(self._qjob(q)))
            elif path == '/view':
                # session= 与 job= 二选一（都缺→按 job 缺省「最新场」老语义不动）
                sess = (q.get('session') or [None])[0]
                if sess:
                    self._json(200, hub.snapshot_session(sess, (q.get('view') or ['god'])[0],
                                                         int((q.get('after') or ['0'])[0])))
                else:
                    self._json(200, hub.snapshot(self._qjob(q), (q.get('view') or ['god'])[0],
                                                 int((q.get('after') or ['0'])[0])))
            elif path == '/replay':
                rows = hub.replay(self._qjob(q) or 0)
                body = ''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows)
                data = body.encode('utf-8')
                self.send_response(200)
                self._cors()
                self.send_header('Content-Type', 'application/x-ndjson; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            elif path == '/live':
                self._json(200, {'job': self._qjob(q), 'blocks': hub.live_blocks(self._qjob(q))})
            elif path in ('/', '/projection_center.html', '/index.html'):
                self._page()
            elif path == '/host/hub-render-core.mjs':
                self._host_module()
            elif path in PC_FILES:
                self._pc_file(PC_FILES[path])
            elif path.startswith('/pc/'):
                # /pc/ 下的未命中：干净 404，绝不兜底回 HTML——浏览器对 module
                # 强制 MIME 检查，拿到 HTML 是整页黑加一行报错、服务端零痕迹。
                self._json(404, {'error': 'not found: ' + path})
            elif path == '/favicon.ico':
                self._favicon()
            else:

                # 未知路径兜底回投影页：部分浏览器/预览面板会请求
                # /index.html 等习惯路径，回 JSON 404 会被当成整页报错。
                self._page()
        except (ValueError, KeyError) as exc:
            self._json(400, {'error': str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._json(500, {'error': str(exc)})

    @staticmethod
    def _qjob(q):
        v = (q.get('job') or [None])[0]
        return int(v) if v is not None else None

    def _page(self):
        try:
            with open(PAGE_FILE, 'rb') as f:
                data = f.read()
        except OSError:
            data = (b'<h1>projectionCenter/index.html \xe6\x9c\xaa\xe6\x89\xbe\xe5\x88\xb0</h1>')
            code = 404
        else:
            code = 200
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _pc_file(self, name: str):
        """投影页资产伺候（2026-09-26 拆分）：白名单文件从 projectionCenter/ 读，
        按扩展名给类型；no-store 由 _cors 统一覆盖（改件刷新即生效）。只服务
        白名单登记过的名字，缺文件回干净 404 JSON、绝不兜底回 HTML——浏览器对
        module 强制 MIME 检查，回 HTML 的症状是整页黑加一行报错、服务端零痕迹。"""
        ctype = _PC_TYPES.get(os.path.splitext(name)[1])
        try:
            with open(os.path.join(PC_DIR, name), 'rb') as f:
                data = f.read()
        except OSError:
            self._json(404, {'error': 'projectionCenter/' + name + ' not found'})
            return
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', ctype or 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _host_module(self):
        """共享规范件伺候（2026-09-24）：femo2host/host/hub-render-core.mjs——
        投影页经 <script type=module> 引用的端上 UI 规范/解释层（输入席可见性
        §5.3/场次 meta 词表/工具槽配对；呈现留在端）。与页面同源（本文件同目录
        的 host/ 子目录）；no-store：改件 Ctrl+F5 即生效，不强缓存。"""
        try:
            with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   'host', 'hub-render-core.mjs'), 'rb') as f:
                data = f.read()
        except OSError:
            self._json(404, {'error': 'hub-render-core.mjs not found'})
            return
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'text/javascript; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def _favicon(self):
        try:
            with open(FAVICON_FILE, 'rb') as f:
                data = f.read()
        except OSError:
            # 缺文件就干净 404，不兜底回 HTML：图标位静默失败即可，页面照常。
            self.send_response(404)
            self._cors()
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'image/x-icon')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # ── WebSocket 订阅 ──

    def _ws_upgrade(self, url):
        key = self.headers.get('Sec-WebSocket-Key')
        if not key:
            self._json(400, {'error': 'websocket key missing'})
            return
        self.send_response(101, 'Switching Protocols')
        self.send_header('Upgrade', 'websocket')
        self.send_header('Connection', 'Upgrade')
        self.send_header('Sec-WebSocket-Accept', _WS.accept_key(key))
        self.end_headers()
        self.wfile.flush()
        self.close_connection = True

        hub = self.hub_ref
        ws = _WS(self.connection, self.rfile, self.wfile)
        with hub._lock:
            hub._wssocks.add(self.connection)

        q = parse_qs(url.query)
        vparam = (q.get('view') or ['god'])[0]
        sub = _Sub(self._qjob(q), vparam, ws=ws)
        # god 族统一解析（2026-09-22「刷新即假上帝视角」根治）：**裸 god 也升级**
        # ——有会话账本时刷新首帧直接读到「戏外+织入」的真上帝视角；升级返回
        # 规范 id（god:<host>）记在 echo_view，快照后回显给页面校正。
        with hub._lock:
            sub.echo_view = hub._resolve_god_sub(str(vparam), sub)
            # 快照与入册同一临界区：分离的话，中间一拍 feed 行两边都不沾
            # （不在快照里、也没广播到未入册的它）——演出中刷新页面即丢行
            self._push_snapshot(hub, sub, int((q.get('after') or ['0'])[0]))
            hub._subs.add(sub)

        writer = threading.Thread(target=_ws_writer, args=(ws, sub), daemon=True)
        writer.start()
        try:
            while ws.alive:
                opcode, payload = ws.recv_frame()
                if opcode == 0x8:            # close
                    ws.send_close()
                    break
                if opcode == 0x9:            # ping → pong
                    ws.send_pong(payload)
                    continue
                if opcode != 0x1:
                    continue
                try:
                    msg = json.loads(payload.decode('utf-8'))
                except (ValueError, UnicodeDecodeError):
                    continue
                if isinstance(msg, dict) and msg.get('ctrl') == 'view':
                    with hub._lock:
                        # 换视角与取快照同锁：旧视角残帧只可能排在快照之前
                        # （客户端快照=整屏替换），绝不排在新快照之后
                        sub.job_id = int(msg['job']) if msg.get('job') is not None else None
                        vnew = str(msg.get('view') or sub.view)
                        # god 族统一解析口（2026-09-22）：裸 god 与 god:<host>
                        # 同路——刷新（upgrade）与切回（ctrl:view）自此同源，
                        # 「切走再切回才变好」的相位差拔根。
                        sub.echo_view = hub._resolve_god_sub(vnew, sub)
                        self._push_snapshot(hub, sub, 0, via_god=True)
                elif isinstance(msg, dict) and msg.get('ctrl') == 'jobs':
                    # 清单也走 WS（2026-09-19）：file:// 直开的页面 fetch 全废，
                    # 一条通道全搞定——页面从任何地方打开都完整可用。
                    try:
                        sub.q.put_nowait(json.dumps(
                            {'ctrl': 'jobs', 'jobs': hub.jobs(),
                             'hosts': hub._hosts_sorted(),
                             'latest': hub.latest_job()}, ensure_ascii=False))
                    except queue.Full:
                        pass
                elif isinstance(msg, dict) and msg.get('ctrl') == 'views':
                    vs = hub.views(msg.get('job'))
                    try:
                        sub.q.put_nowait(json.dumps(
                            {'ctrl': 'views', 'job': vs['job'],
                             'hosts': vs.get('hosts') or [],
                             'views': vs['views']}, ensure_ascii=False))
                    except queue.Full:
                        pass
                elif isinstance(msg, dict) and msg.get('ctrl') == 'chronica':
                    # 台账场次清单（2026-09-29 整场回放）：与 /jobs 同理走 WS 单通道
                    # （file:// 直开页面 fetch 全废的老教训）。快照本身走 REST
                    # （/chronica/view，一次性拼拼读，无订阅语义）。
                    try:
                        sub.q.put_nowait(json.dumps(
                            {'ctrl': 'chronica',
                             'chronica': hub.chronica_sessions()},
                            ensure_ascii=False))
                    except queue.Full:
                        pass
                elif isinstance(msg, dict) and msg.get('ctrl') == 'sessions':
                    # 主会话面板清单（2026-09-21）：file:// 直开 fetch 全废的老教训
                    # ——清单一律走 WS 单通道；announce/bind 变化时 hub 也主动广播
                    # 同款载荷（_notify_bind），页面零轮询跟着刷新。
                    try:
                        sub.q.put_nowait(json.dumps(
                            hub.sessions_payload(), ensure_ascii=False))
                    except queue.Full:
                        pass
                elif isinstance(msg, dict) and msg.get('ctrl') == 'bind':
                    # 面板选中主 session：hub.bind 落账（含跨宿主联动）后
                    # _notify_bind 已广播 ctrl 'sessions'（含本页）+ god:<host>
                    # 订阅者推新快照。
                    out = hub.bind(str(msg.get('session') or ''))
                    try:
                        sub.q.put_nowait(json.dumps(
                            {'ctrl': 'bind-result', **out}, ensure_ascii=False))
                    except queue.Full:
                        pass
                elif isinstance(msg, dict) and msg.get('ctrl') == 'bind-job':
                    # 面板改场次（2026-09-22 联动）：按 owners 账本给每个已知
                    # 宿主设它那格的主 session，落账后 _notify_bind 广播同款
                    # 载荷——页面零轮询跟着刷新。
                    out = hub.bind_job(msg.get('job'))
                    try:
                        sub.q.put_nowait(json.dumps(
                            {'ctrl': 'bind-job-result', **out}, ensure_ascii=False))
                    except queue.Full:
                        pass
                elif isinstance(msg, dict) and msg.get('ctrl') == 'human-input':
                    # 投影页人类席交卷（WS 单通道：file:// 直开的页面 fetch 全废，
                    # 与 jobs/views 同理——页面从任何地方打开都完整可用）。
                    code, out = hub.human_input(msg.get('wait_key'), msg.get('text'),
                                                msg.get('variables'))
                    try:
                        sub.q.put_nowait(json.dumps(
                            {'ctrl': 'human-input-result', 'code': code, **out},
                            ensure_ascii=False))
                    except queue.Full:
                        pass
                elif isinstance(msg, dict) and msg.get('ctrl') == 'prints':
                    # print 旁路回放（2026-09-19）：{'ctrl':'prints','limit':n} → 历史
                    try:
                        sub.q.put_nowait(json.dumps(
                            {'ctrl': 'prints', 'items': hub.prints_tail(msg.get('limit'))},
                            ensure_ascii=False))
                    except queue.Full:
                        pass
                elif isinstance(msg, dict) and msg.get('ctrl') == 'prints-clear':
                    # 清空镜像环；广播 prints-cleared 让所有开着的浮层同步清屏
                    hub.clear_prints()
                    with hub._lock:
                        cleared = json.dumps({'ctrl': 'prints-cleared'},
                                             ensure_ascii=False)
                        for s in list(hub._subs):
                            try:
                                s.q.put_nowait(cleared)
                            except queue.Full:
                                if s.ws is not None:
                                    s.ws.close()
        except (ConnectionError, OSError):
            pass
        finally:
            with hub._lock:
                hub._subs.discard(sub)
                hub._wssocks.discard(self.connection)
            try:
                sub.q.put_nowait(None)
            except queue.Full:
                pass   # 队列满：ws 已关，写线程自行退场
            ws.close()

    @staticmethod
    def _push_snapshot(hub: ProjectionHub, sub: _Sub, after: int,
                       via_god: bool = False):
        if via_god:
            # ctrl:view 触发的快照，前置一条 'view-echo'：把回落/升级后的规范
            # 视角 id 校正给页面（裸 god 升级 → god:<host>）。upgrade 首帧不用：
            # 快照自带规范 id（见下）。
            try:
                sub.q.put_nowait(json.dumps(
                    {'ctrl': 'view-echo',
                     'view': getattr(sub, 'echo_view', None)
                     or (('god:%s' % sub.god_host) if sub.god_host
                         else (sub.view or 'god'))},
                    ensure_ascii=False))
            except queue.Full:
                pass
        if sub.god_host is not None:
            # god:<host> 订阅（2026-09-21）：每次快照重解析绑定（换绑即跟随）。
            # **不用 _resolve_god_view**（2026-09-22 用户报「显示的根本不是这个
            # job」）：它对空 current 会回落该宿主最近活动的账本——绑定被联动
            # 清空=「这个宿主与你点的这场无关」，回落等于拿一本不相干的账冒充
            # 内容。订阅侧绑定空就当没账本（sess=None），往下走场次兜底。
            with hub._lock:
                b = hub._load_bindings().get(sub.god_host) or {}
                cur = str(b.get('current') or '')
                sess = ('%s:%s' % (sub.god_host, cur)) if cur else None
                sub.sess = _split_session(sess) if sess else None
                snap = hub.snapshot_session(sess, 'god', after) if sess else \
                    {'session': None, 'rows': [], 'next': 0, 'hosts': []}
            # 兜底（2026-09-22 用户报「点哪个显示的根本不是那场」+「狼人杀明明
            # 有内容」）：会话账本没内容（织入上线前的旧场，session 账本根本没
            # 建）时，直接读**那场的 job 账本**——场次优先取订阅带的（用户点了
            # 哪场看哪场），没带就反查名册里这个 session 的最新场（开屏「最新」
            # 档也能看到主 session 对应的那场戏，不再空屏）。新场织入在线，账本
            # 一有行就自然回到会话账本读法。
            if not snap['rows'] and not after:
                fb_job = sub.job_id
                if fb_job is None and sub.sess:
                    fb_job = hub._session_latest_job(sub.sess[0], sub.sess[1])
                if fb_job is None:
                    # 兜底链收尾（2026-10-03 用户报「刷新后 job 显示对、下面却
                    # 空，非得重选一次才出来」实案根治）：订阅没钉场次（刷新
                    # 无参 boot 的常态）、会话账本存在但空、会话又没链到任何
                    # 场——fb_job 到此为 None，兜底整条断掉、空帧直达页面。
                    # 收尾=跟「最新」（latest_job，与场次下拉「最新」同义）：
                    # 刷新即看到最新一场，重选不需要。
                    fb_job = hub.latest_job()
                if fb_job is not None:
                    try:
                        print('[god-view] %s 会话账本无内容，兜底读 j%s 账本'
                              % (sub.god_host, fb_job))
                    except Exception:
                        pass
                    fb = hub.snapshot(fb_job, 'god', after)
                    try:
                        sub.q.put_nowait(json.dumps(
                            {'ctrl': 'snapshot', 'proto': PROTO_VERSION,
                             'job': fb['job'], 'session': None,
                             'view': 'god:%s' % sub.god_host,
                             'next': fb['next'], 'rows': fb['rows'],
                             'hosts': fb.get('hosts') or [],
                             'waiting': hub.current_waiting(),
                             'live': [], 'god_fallback_job': fb['job']},
                            ensure_ascii=False))
                    except queue.Full:
                        pass   # 满队列=这条连接已在断开流程，快照随重连再来
                    return
            try:
                sub.q.put_nowait(json.dumps(
                    {'ctrl': 'snapshot', 'proto': PROTO_VERSION, 'job': None,
                     'session': snap.get('session'),
                     'view': 'god:%s' % sub.god_host,
                     'next': snap['next'], 'rows': snap['rows'],
                     'hosts': snap.get('hosts') or [],
                     'waiting': hub.current_waiting(), 'live': []},
                    ensure_ascii=False))
            except queue.Full:
                pass   # 满队列=这条连接已在断开流程，快照随重连再来
            return
        snap = hub.snapshot(sub.job_id, sub.view, after)
        # 快照捎带正在打字的块（按同视角过滤）：换视角/断线重连即刻接上，
        # 不丢半截话（2026-09-19 用户拍板「读现有的记录，流式接上」）。
        live = hub.live_blocks(snap['job'], sub.view) if snap['job'] is not None else []
        try:
            sub.q.put_nowait(json.dumps(
                {'ctrl': 'snapshot', 'proto': PROTO_VERSION, 'job': snap['job'],
                 'view': snap['view'], 'next': snap['next'], 'rows': snap['rows'],
                 'hosts': snap.get('hosts') or [],
                 'waiting': hub.current_waiting(),
                 'live': live}, ensure_ascii=False))
        except queue.Full:
            pass   # 满队列=这条连接已在断开流程，快照随重连再来


# ── 引擎事件 → 行 的小分诊表（桥内嵌喂送用）──────────────────────────────

def _strip_quotes(s: str) -> str:
    """引擎个别事件里的文本会多包一层引号（实测 context_ready/blocks.showprompt
    的部分分支是 '"【发牌】…"'）——剥掉首尾一层成对引号。"""
    s = str(s).strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        s = s[1:-1].strip()
    return s


class EventProjector:
    """引擎事件/交卷命令 → 投影行（形态 B 预演转正：分诊表进桥，单份）。
    种子 = _tmp/fallback/gateway_ui.py 的 handle_event 分诊表（词表与 event-core
    对齐）。桥只看得到引擎事件与两个交卷命令（post_speech/human_input）——
    AI 演员的逐字流帧不过桥（模型调用在宿主进程），打字机效果待宿主喂。
    只登记 scope / 角色名，行本体交给 ProjectionHub 编号落账。

    段落闸门（2026-09-19 用户拍板，两轮定稿）：showprompt / cot / 工具 / 回答
    不再各占一个行号——它们装进**同一个 section 行**（kind=section，items 数组
    按发生序），一段一个行号 n。段=账本的一行，同段永不拆散也永不被插队，
    行号即段落号（每人的回合一段，甲乙乙甲天然不换位）。
    - showprompt / 人类提问扣在 pending（按 wait_key），交卷时作为段首 item；
    - CoT/工具来自 body.steps（TranscriptStep 引擎契约，三条款都带全量转写）；
    - reply 不逐项落（防与最终台词双份）；
    - 戏收场时剩余未交卷的提问补投（历史不丢）。"""

    def __init__(self):
        self.node_scopes = {}   # node_name → targets
        self.briefs = {}        # wait_key → {actor_name, targets, node}
        self.node_wait = {}     # node_name → wait_key（ai_request 登记）
        self.pending = {}       # wait_key → 扣住的提问行（交卷时作段首 item）
        self.node_pending = {}  # node_name → 扣住的提问行（context_ready 早于 ai_request 的时序缓冲）
        self.retries = {}       # wait_key → [重试反馈 item]（node_retry 扣住，交卷时入段）
        self.served = set()     # 已交卷消费掉的 wait_key——context_ready 兜底绝不再扣
                                # （par 同名节点下，晚到的 context_ready 会反查到别的
                                #  分支已消费的 wait_key 重复扣账，落幕 flush 全变
                                #  无主 showprompt——j1810 实锤 4×发牌+3×投票）
        self.prompted = set()   # 提问已落地的 wait_key（段首或段内）——段开之后晚到的
                                # 同题 context_ready 不再补第二份、也不再扣成 pending
                                # （2026-09-19 修「落幕裸露重复 showprompt」：段已开还扣
                                #  pending，新路交卷不 pop → 收官补投成顶格裸行，job 1920
                                #  实锤 4 个 AI 分支各漏一条）
        # ── 段生命周期（2026-09-19 用户拍板：「进了节点立即建一个新块，然后有啥
        #    就往里填」）：块键 = **wait_key**（引擎按请求分配的唯一键，par 同名节点
        #    各拿各的，不像 node_name 那样会串——所以引擎一行都不用改）。开块落在
        #    ai_request / human_wait 那两拍：它俩都带 wait_key，归属无歧义；而
        #    node_start → 这两拍在引擎里是同一个同步块（无 await、无内容），差的是
        #    毫秒，观感就是「进节点即见块」。context_ready 早到的 showprompt 照旧
        #    扣住，开块那拍一并填进去。没有 wait_key 的事件（notice/func/assign 与
        #    老调用方）不参与段，走下面那套「扣住 → 交卷成段」的老路。──
        # 投递事实查询口（2026-09-25 多宿主）：fn(job_id, soul) -> host or None。
        # 桥产信留柜时记下「这个 soul 的料包实际寄给了哪个宿主格」，段键据此取
        # 归属宿主——mailbox 投递事实优先于喂行方自称（作者裁决）。
        self.dispatch_lookup = None
        self.segs = {}          # seg(=w:<host>:<wait_key>) → {node, actor, targets}
        # 开过段的键（清场不清——flow_paused/done/error 只清 segs）。续跑时引擎
        # Runtime 重建计数器归零、wait_key 撞旧键重发，这里据此在重发的开段帧上
        # 打 regen 标（hub 只对带许可的帧做世代让位——重投的旧帧没有许可，照旧
        # 幂等拒，2026-09-28）。
        self.segs_seen = set()
        # 来源宿主名：段键与 hub 入口 _seg_ref 必须用**同一个** host，否则同一条
        # 引擎轮会开出两个"孪生段"——桥这边用裸键、宿主喂 draft 那边用带 host 的键，
        # 逐字流永远挂不上容器（job 1927 实锤）。桥在 hub 起来后调 set_host()。
        self.host = ''
        # ── 人类等待镜像（2026-09-20 投影页人类输入；2026-10-02 复数化）：
        #    human_wait SET（按 wait_key upsert）/ human_done（按事件带的
        #    wait_key 清那一席；老引擎不带键=全清，标量时代字面行为）、
        #    flow_done/error/paused 全清。状态经 _waiting_sink 推给 hub（广播
        #    ctrl:waiting + 快照捎带 + POST /api/human-input 的校验面）——推的是
        #    整张席位清单（list，序=human_wait 到达序）。本投影器持一份镜像供
        #    测试/自查；hub 的副本才是对外权威。par 并发多条线各自等到人类时
        #    全部在册：标量时代第二席覆盖第一席、先等者交不了卷（human_input
        #    校验只认「当前那一席」）的根因修。
        self.waiting = {}
        self._waiting_sink = None

    def set_host(self, name):
        """登记本桥的宿主自称（与 hub.register_host 同一个词），段键据此统一。"""
        self.host = str(name or '')

    def set_dispatch_lookup(self, fn):
        """注入投递事实查询口（桥闭包：查产信时记下的实际投递格）。"""
        self.dispatch_lookup = fn

    def _dispatch_host(self, d):
        """本事件的段归属宿主：事件 soul → 投递事实 → None（回落喂行方）。
        soul 取顶层 actor_info.soul 优先（resume 重发的内层 soul_id 可空）。"""
        fn = self.dispatch_lookup
        if fn is None:
            return None
        info = d.get('actor_info') if isinstance(d.get('actor_info'), dict) else {}
        blocks = d.get('blocks') if isinstance(d.get('blocks'), dict) else {}
        inner = blocks.get('_actor_info') if isinstance(blocks.get('_actor_info'), dict) else {}
        soul = str(info.get('soul') or inner.get('soul_id') or '') or None
        if soul is None:
            return None
        try:
            return fn(int(d.get('job_id')), soul)
        except Exception:
            return None

    def set_waiting_sink(self, fn):
        """登记等待态出口（hub.set_waiting）：等待态每一拍推它。sink 自己吞异常
        （幕布纪律：旁路绝不挡演出），这里裸调。"""
        self._waiting_sink = fn

    def _waiting_views(self, actor, scope):
        """该亮「人类输入框」的 actor 视角 id 清单（god/stage 两视角页面自判，
        这里只出角色视角）。基形口径与 views() 同源（min(_name_bases)），host
        前缀同款——保证与 /views 清单里的 id 逐字可比对。"""
        ids, seen = [], set()
        for nm in ([actor] if actor else []) + list(scope or []):
            bk = min(_name_bases(nm))
            if bk and bk not in seen:
                seen.add(bk)
                ids.append('actor:' + (self.host + ':' if self.host else '') + bk)
        return ids

    def _waiting_push(self):
        """等待态变更单点：推整张席位清单给 sink（hub 广播+快照捎带）。"""
        if self._waiting_sink is not None:
            try:
                self._waiting_sink(self._waiting_list())
            except Exception:  # noqa: BLE001 — 幕布旁路绝不挡演出
                pass

    def _waiting_list(self):
        """席位清单（插入序=human_wait 到达序）。"""
        return [dict(x) for x in self.waiting.values()]

    def _waiting_upsert(self, state):
        """单席入账/原位更新（human_wait 那拍；键=wait_key）。"""
        if not isinstance(state, dict):
            return
        wk = str(state.get('wait_key') or '')
        if not wk:
            return
        self.waiting[wk] = dict(state)
        self._waiting_push()

    def _waiting_clear(self, wait_key=None):
        """收席：wait_key 在=清那一席（human_done 按键收麦）；None=全清
        （落幕/出错/暂停，及不带键的老引擎 human_done——字面退回标量行为）。"""
        if wait_key:
            self.waiting.pop(str(wait_key), None)
        else:
            self.waiting = {}
        self._waiting_push()

    # ── 段生命周期 ──
    def _seg_key(self, d):
        """本事件的段键 = 'w:<host>:<wait_key>'（无 host 时退化为 'w:<wait_key>'）。
        没有 wait_key → ''（不参与段）。"""
        wk = d.get('wait_key')
        if not wk:
            return ''
        host = self._dispatch_host(d) or self.host
        return ('w:%s:%s' % (host, wk)) if host else ('w:%s' % wk)

    def _seg_of_wk(self, wk):
        """wait_key → 已开段的键（交卷/重试据此认领自己的块）。"""
        suffix = ':' + wk
        for seg in self.segs:
            if seg.endswith(suffix):
                return seg
        return ''

    def _seg_open(self, d, actor='', items=None, role=''):
        """开块：产 seg-open 帧（hub 落段行占住行号并立刻广播）。

        `items` = 这个容器开张时就带着的槽（如 showprompt 旁白）——2026-09-19
        用户拍板：「Show prompt 和后续有这个 show prompt 所在节点产生的内容不能
        分开，它们应该是在同一个容器里」。故旁白作为 items[0] 随开块帧落进同一
        段行，**不再另起一条 narrate 行**（一个节点实例 = 一个容器 = 一个行号）。
        `role` = 段角色标（main/ai/human，显示策略用，2026-09-20）——开段那拍
        是谁的声音 hub 无法反推，由这里如实报。
        注：只有首开才回帧；段已存在时返回值是空（重复开块幂等），此时 items
        不会重复进账（调用方的那份内容已由首开那拍带上）。"""
        seg = self._seg_key(d)
        if not seg or seg in self.segs:
            return []
        node = d.get('node_name')
        scope = d.get('scope') if isinstance(d.get('scope'), list) else None
        if scope is None:
            scope = d.get('scope_info') if isinstance(d.get('scope_info'), list) else None
        if node is not None and scope is not None:
            self.node_scopes[node] = scope
        targets = scope if scope is not None else self.node_scopes.get(node)
        # 执行者名的兜底只在「scope 恰好单人」时才敢用（scope: self 就是这种）。
        # 多席位 scope（如 scope: all）是**顺序无意义的集合**，首元素不是发言人
        # ——2026-09-19 实锤：人类节点的块头被写成排序第一的 @Eve。名字该由引擎
        # 报（actor_name），报不了就空着，绝不瞎指。
        if not actor and scope and len(scope) == 1:
            actor = str(scope[0])
        regen = seg in self.segs_seen   # 清场后重新登记同键 = 续跑重发（帧打 regen 标）
        self.segs[seg] = {'node': node, 'actor': actor, 'targets': targets}
        self.segs_seen.add(seg)
        frame = {'op': 'seg-open', 'seg': seg, 'node': node, 'actor': actor,
                 'targets': targets, 'zone': 'inplay'}
        if regen:
            frame['regen'] = 1
        if role:
            frame['role'] = role
        if items:
            frame['items'] = [dict(it) for it in items]   # 容器开张自带的槽
        return [frame]

    def _seg_fill(self, seg, items, actor=None, close=False):
        """往本节点的块里填内容（items 按发生序追加）；close=收口。"""
        if not seg or seg not in self.segs:
            return []
        f = {'op': 'seg-fill', 'seg': seg, 'items': list(items or [])}
        if actor:
            self.segs[seg]['actor'] = actor
            f['actor'] = actor
        if close:
            f['open'] = False
        return [f]

    def _seg_close_all(self):
        """落幕：还没收口的段各自收口（页面撤掉「正在…」），索引清空。"""
        rows = [{'op': 'seg-fill', 'seg': seg, 'items': [], 'open': False}
                for seg in list(self.segs)]
        self.segs.clear()
        self.prompted.clear()   # 段全收了，提问落地簿随场清空
        return rows

    # ── 提问扣住 ──
    def _hold(self, wait_key, node, text, targets, kind='showprompt'):
        """扣住一条提问（2026-09-19 用户拍板：同键可多条，按发生序排——
        人类节点=showprompt 演出提示在前、prompt 指令在后，两条同段不丢）。
        槽 = {'targets', 'items'}；交卷时整槽作段首 items，落幕时逐条补投。
        kind=真实类别（2026-09-19 用户拍板「来的什么写什么」）：showprompt /
        prompt / retry…各归各，不再有 narrate 大杂烩——显示层按 kind 选样式。"""
        item = {'kind': kind, 'text': str(text)}
        if wait_key:
            slot = self.pending.get(wait_key)
            if slot is None:
                slot = {'targets': targets, 'items': []}
                self.pending[wait_key] = slot
        elif node is not None:
            slot = self.node_pending.get(node)
            if slot is None:
                slot = {'targets': targets, 'items': []}
                self.node_pending[node] = slot
        else:
            return
        slot['items'].append(item)

    def _pop_prompt_item(self, wait_key):
        """扣住的提问 → 段首 items（kind/text；targets 由段行统一带）。"""
        slot = self.pending.pop(str(wait_key or ''), None)
        if slot is None:
            return []
        return [dict(it) for it in slot.get('items') or []]

    def _section(self, actor, items, wk, prefix, targets=None, node=None):
        # 可见性规整：自己发的段自己必然看得见（dsh 同语义——本人窗口恒有本人回合）
        if targets is not None and actor and actor not in targets:
            targets = list(targets) + [actor]
        row = {'zone': 'inplay', 'kind': 'section', 'actor': actor, 'text': '',
               'items': items, 'src_seq': prefix + ':' + wk}
        if targets:
            row['targets'] = targets
        if node:
            row['node'] = node
        return row

    def _prompt_rows(self, items, targets=None, node=None):
        """把一批槽转成**独立旁白行**（不带 actor）——现在只服务「段最终没开成」的兜底。

        【2026-09-19 二次拍板·正路已改】提问不再独立成行了：showprompt 随
        `_seg_open(items=[…])` 作为**容器里的第一个槽**落进同一段行——用户原话
        「Show prompt 和后续有这个 show prompt 所在节点产生的内容不能分开，它们应该
        是在同一个容器里」。本方法保留给 `flush_pending` 之类「没有容器可进的残料」
        （历史不丢：宁可落一条裸旁白行，也不丢内容）。"""
        rows = []
        for it in items or []:
            if not isinstance(it, dict):
                continue
            row = {'zone': 'inplay', 'kind': it.get('kind') or 'say',
                   'text': str(it.get('text') or '')}
            if targets:
                row['targets'] = list(targets)
            if node:
                row['node'] = node
            rows.append(row)
        return rows

    def flush_pending(self):
        """戏收场：剩余未交卷的提问/重试反馈补投（不再等待）。
        槽内多条（showprompt + 等待提示）逐条成行——历史不丢。"""
        rows = []
        for slot in list(self.node_pending.values()) + list(self.pending.values()):
            for it in slot.get('items') or []:
                row = {'zone': 'inplay', 'kind': it['kind'], 'text': it['text']}
                if slot.get('targets'):
                    row['targets'] = slot['targets']
                rows.append(row)
        self.node_pending.clear()
        self.pending.clear()
        for items in self.retries.values():
            rows.extend(items)   # 节点没等来交卷：反馈各自成行（历史不丢）
        self.retries.clear()
        return rows

    def _pop_retry_items(self, wait_key):
        """扣住的重试反馈 → 段内 items（提问之后、思考/台词之前）。"""
        return self.retries.pop(str(wait_key or ''), [])

    def on_event(self, et, d):
        d = d if isinstance(d, dict) else {}
        rows = []
        if et == 'flow_start':
            name = d.get('name') if isinstance(d.get('name'), str) else ''
            # 续跑也走 flow_start（引擎 checkpoint 重启重跑），桥给投影注 resumed
            # 标——「继续」与「开场」分开写（2026-09-21 场次消息家族）。
            kind = 'play_resume' if d.get('resumed') else 'play_start'
            row = {'zone': 'meta', 'kind': kind, 'text': name or ''}
            # 台账场次号落账（2026-09-29 拍板）：引擎 flow_start 自带 session_id
            # （Chronica 场次号，引擎场次身份——设计内字段），开演那拍随行入账。
            # 归属裁决：场次号归引擎（hub 不发号），hub 只记「引擎报来的事实」；
            # journal 保持 job→台账场次映射的唯一权威，整场回放/两本号对照不
            # 再去翻引擎侧 .meta。int 收口（引擎侧是 int，防未来浮点化漂移）。
            sid = d.get('session_id')
            if isinstance(sid, int) and sid > 0:
                row['femo_session_id'] = sid
            rows.append(row)
        elif et == 'node_start':
            node = d.get('node_name')
            scope = d.get('scope') if isinstance(d.get('scope'), list) else None
            if node is not None and scope is not None:
                self.node_scopes[node] = scope
            ntype = d.get('node_type')
            # notice 即投（归属=scope 席位名——发牌类同文案多分支从此分得清给谁的）：
            # 公告没有「后续内容」，不需要段生命周期，照旧一条旁白行。
            # kind='notice'（2026-09-19 用户拍板：公告=显示层 notice 样式=居中灰字，
            # showprompt 与它同款——数据面必须是不同 kind 显示层才分得开）。
            # （AI / 人类节点不在这里开块：node_start 不带 wait_key，par 同名节点
            #   下拿 node_name 归属必串段——开块挪到各自的 ai_request / human_wait，
            #   那两拍才有唯一键；中间只隔同一个同步块，观感仍是「进节点即见块」。）
            if ntype == 'notice' and str(d.get('prompt') or '').strip():
                rows.append({'zone': 'inplay', 'kind': 'notice',
                             'text': str(d['prompt']),
                             'actor': scope[0] if scope else '',
                             'targets': scope})
        elif et == 'context_ready':
            # 兜底来源：context_ready 没有 wait_key 且 par 下 node 名会重名
            # （实测 [看牌] 三分支同名），拿它配对必然串段——首选一直是
            # ai_request.blocks.showprompt（每分支自带 wait_key）。这里只在
            # ai_request 还没给过该段提问时补位，绝不覆盖。
            sp = d.get('showprompt')
            if isinstance(sp, str) and sp.strip():
                node = d.get('node_name')
                text = _strip_quotes(sp)
                wk = self.node_wait.get(node)
                if wk:
                    # served 防重复扣账：par 同名节点下 node_wait 反查到的可能是
                    # 别的分支【已交卷消费掉】的 wait_key——再扣就是永无主的无主
                    # showprompt（j1810 实锤），必须跳过。
                    if wk not in self.pending and wk not in self.served:
                        seg = self._seg_of_wk(wk)
                        if seg:
                            # 【2026-09-19 修裸露重复 showprompt】段已经开了：这枚
                            # wait_key 的提问只有一个去处——那个段。块首那份
                            # （blocks.showprompt，每分支自带）是权威，已在 prompted
                            # 里就整条丢掉（它就是重复）；块首没有（老引擎无 blocks）
                            # 才往段尾补一条，并记账防重放补两遍。**绝不扣成 pending**
                            # ——新路交卷只 served.add 不 pop，扣下来没人认领，收官
                            # flush_pending 会把它补投成一条顶格裸行（job 1920 实锤：
                            # [投票] 4 个 AI 分支各漏一条裸露同题）。
                            if wk not in self.prompted:
                                self.prompted.add(wk)
                                rows.extend(self._seg_fill(
                                    seg, [{'kind': 'showprompt', 'text': text}]))
                        else:
                            self._hold(wk, None, text, self.node_scopes.get(node))
                elif node is not None and node not in self.node_pending:
                    self._hold(None, node, text, self.node_scopes.get(node))
        elif et == 'ai_request':
            node = d.get('node_name')
            scope = d.get('scope_info') if isinstance(d.get('scope_info'), list) else None
            if node is not None and scope is not None:
                self.node_scopes[node] = scope
            wk = str(d.get('wait_key') or '')
            blocks = d.get('blocks') if isinstance(d.get('blocks'), dict) else {}
            sp = blocks.get('showprompt')
            sp_text = _strip_quotes(sp) if isinstance(sp, str) and sp.strip() else ''
            pr = blocks.get('prompt')
            prompt_text = _strip_quotes(pr) if isinstance(pr, str) and pr.strip() else ''
            # 执行者名：新名 actor_name 优先，旧名 actor_name 过渡兼容
            # （2026-09-19 正名：它是执行者的名字，不只属于 AI）
            actor = str(d.get('actor_name') or '')
            if wk:
                self.node_wait[node] = wk   # par 同名节点会覆盖——但不依赖它配对
                self.briefs[wk] = {'actor': actor, 'targets': scope, 'node': node}
            seg = self._seg_key(d)
            if seg:
                # 【开块】本请求的块：wait_key 唯一归属（par 同名也不串），块一到
                # 页面就出现「@角色 · 正在…」，角色名这时也知道了。段首旁白把
                # context_ready 早到扣住的那份一并带上（blocks 那份是首选来源，
                # 同文案只留一份）。
                items = []
                held = self.node_pending.pop(node, None)
                pended = self.pending.pop(wk, None)
                if sp_text:
                    # blocks.showprompt 是首选来源（每分支自带、wait_key 归属）：
                    # context_ready 兜底那份同题让位，免得段首落双份/落错人。
                    items.append({'kind': 'showprompt', 'text': sp_text})
                else:
                    items.extend(list((held or {}).get('items') or []))
                    items.extend(list((pended or {}).get('items') or []))
                if prompt_text:
                    # blocks.prompt=本节点指令（引擎 block_collector 拼装，一直在
                    # blocks 里、此前被投影丢掉）。2026-09-19 用户拍板：Prompt 与
                    # Show Prompt 不是一回事，都得有、prompt 在 showprompt 之下；
                    # 头部槽序（showprompt→prompt→名字）归 hub 定，这里按到货塞。
                    items.append({'kind': 'prompt', 'text': prompt_text})
                # 提问作为容器里的第一个槽（2026-09-19 用户拍板：showprompt 与
                # 本节点产生的内容不能分开，必须在同一个容器里）——随开块帧一起落，
                # 于是「旁白 → 名字 → cot/工具/台词」全在一个行号内，顺序仍由数据定。
                if items and wk:
                    self.prompted.add(wk)   # 晚到的同题 context_ready 据此不再补第二份
                rows.extend(self._seg_open(d, actor=actor, items=items, role='ai'))
            elif wk:
                # 老路（无 wait_key 的帧走不到这里；兼容旧调用方）：
                # showprompt 首选来源（2026-09-19 修串段）：blocks.showprompt
                # 每分支自带，wait_key 天然归属——par 同名节点也不串。
                held = self.node_pending.pop(node, None)
                if held is not None and not sp_text:
                    # 时序缓冲（context_ready 早到）搬进本 wait_key 的槽；blocks
                    # 那份是首选来源，它来了就让缓冲让位（同题不落双份）。
                    if held.get('items'):
                        slot = self.pending.setdefault(
                            wk, {'targets': held.get('targets'), 'items': []})
                        slot['items'][:0] = held['items']
                if sp_text:
                    self._hold(wk, None, sp_text, scope)
                if prompt_text:
                    self._hold(wk, None, prompt_text, scope, kind='prompt')
        elif et == 'human_wait':
            wk = str(d.get('wait_key') or '')
            scope = d.get('scope') if isinstance(d.get('scope'), list) else []
            prompt = str(d.get('prompt') or '').strip()
            node = d.get('node_name')
            # 人类节点 showprompt（演出提示）与 prompt（本节点指令）同段各一个槽
            # （2026-09-19 用户拍板「来的什么写什么」：prompt 槽存引擎原始字段；
            # 「等待你的回应：」这类包装话是显示层的活，不再合成进数据——没出现
            # 就不写这一行，等待状态由段行的 open 表达）。
            sp = d.get('showprompt')
            sp_text = _strip_quotes(sp) if isinstance(sp, str) and sp.strip() else ''
            held = self.node_pending.pop(node, None)   # 早到的同题若在，随段不丢
            # 执行者名：引擎报的 actor_name 是权威（2026-09-19 修「人类节点块头写成
            # 别人」——它此前只把执行者并进 scope 快照且排序，位置无意义，投影侧拿
            # 首元素当发言人，`scope: all` 就瞎指排序第一的人）。真报不出来（老引擎）
            # 时才回落：且只在「scope 恰好单人」（scope: self）时才敢用，否则空着。
            actor = str(d.get('actor_name') or '')
            if not actor and len(scope) == 1:
                actor = str(scope[0])
            if wk:
                self.briefs[wk] = {'actor': actor, 'targets': scope,
                                   'node': node}   # 人类席位簿
                # 人类等待镜像（2026-09-20 投影页人类输入）：引擎这一拍起，人类
                # 席位开麦——有 wait_key 才可交卷，无键的罕见形态不进镜像。
                # out_vars（2026-09-24）：节点声明的 out 变量名随等待态下发，
                # 投影页据此亮「变量赋值」浮层（与 DSH 投影窗 composer 同一数据源
                # ——引擎 human_wait 事件的 out_vars 字段）。
                _ov = d.get('out_vars')
                self._waiting_upsert({
                    'job_id': d.get('job_id'), 'wait_key': wk, 'node': node,
                    'actor': actor or '', 'scope': list(scope or []),
                    'prompt': prompt, 'host': self.host,
                    # 本轮等待的段键初值（路由键口径；续跑世代让位后 hub 会按段行
                    # 修正成带 :gN 的世代键——页面匹配输入席位置照抄它，不自己拼）
                    'seg': self._seg_key(d),
                    'out_vars': [str(x) for x in _ov if isinstance(x, str)]
                                if isinstance(_ov, list) else [],
                    'views': self._waiting_views(actor, scope),
                })
            seg = self._seg_key(d)
            if seg:
                # 【开块】等待人类这一刻就建块（wait_key 唯一归属）：席位名开块即有
                # （引擎报的执行者名），showprompt 旁白 + 等待提示两拍都填进这块。
                prompt_items = [{'kind': it.get('kind') or 'showprompt', 'text': it['text']}
                                for it in ((held or {}).get('items') or [])]
                if sp_text and sp_text not in [it.get('text') for it in prompt_items]:
                    prompt_items.append({'kind': 'showprompt', 'text': sp_text})
                # 同 AI 节点：showprompt 演出提示 + prompt 指令都进**同一个容器**
                # （2026-09-19 用户拍板：showprompt 不能与所在节点的内容分开）。
                # 顺序：头部槽序（showprompt→prompt→名字）归 hub 定，这里按到货塞。
                if prompt_items and wk:
                    self.prompted.add(wk)
                open_items = list(prompt_items)
                if prompt:
                    open_items.append({'kind': 'prompt', 'text': prompt})
                rows.extend(self._seg_open(d, actor=actor, items=open_items, role='human'))
            elif wk:
                if held is not None and not sp_text and held.get('items'):
                    slot = self.pending.setdefault(
                        wk, {'targets': held.get('targets'), 'items': []})
                    slot['items'][:0] = held['items']
                if sp_text:
                    self._hold(wk, None, sp_text, scope)
                if prompt:
                    self._hold(wk, None, prompt, scope, kind='prompt')
            else:
                # 无 wait_key（罕见）：退回节点名下缓冲，总比丢强
                if sp_text:
                    self._hold(None, node, sp_text, scope)
                if prompt:
                    self._hold(None, node, prompt, scope, kind='prompt')
        elif et == 'flow_done':
            self._waiting_clear()   # 落幕：人类席位收麦（等待中即停也照清）
            rows = self.flush_pending()
            rows.extend(self._seg_close_all())   # 未收口的段收口（撤页面「正在…」）
            rows.append({'zone': 'meta', 'kind': 'play_end',
                         'text': str(d.get('summary') or '')})
        elif et == 'flow_error':
            self._waiting_clear()
            rows = self.flush_pending()
            rows.extend(self._seg_close_all())
            # 出错=场次行（2026-09-21 拍板：暂停/出错这类消息全视角可见）——
            # 不再走 outside 耳语（那种只进上帝窗，且 owner 登记后连 job 账本
            # 都不进，舞台/角色窗永远看不到）。
            rows.append({'zone': 'meta', 'kind': 'play_error',
                         'text': 'FEMO 运行出错：%s' % (d.get('error') or 'unknown')})
        elif et == 'flow_paused':
            self._waiting_clear()   # 暂停即收麦：引擎不再消费；续跑重进节点会重发 human_wait（全新 wait_key），输入框自动回来
            rows = self.flush_pending()
            rows.extend(self._seg_close_all())
            rows.append({'zone': 'meta', 'kind': 'play_paused',
                         'text': 'FEMO 已暂停（断点保留，可续跑）'})
        elif et == 'human_done':
            # 输入被引擎消费（正常/超时放行均走此信号）：按事件带的 wait_key 收
            # 那一席（2026-10-02 起 human_done 带 wait_key——par 并发同名节点下
            # 节点名不可辨，按键清才不会误伤隔壁席）。老引擎不带键=全清（字面
            # 退回标量时代行为）。
            self._waiting_clear(str(d.get('wait_key') or '') or None)
        elif et == 'node_retry':
            # 编译器重试反馈（2026-09-19 用户拍板：一个节点内的重试必须和节点
            # 回答同段）——新路直接填进本节点的块；老路按 wait_key 扣住，交卷时
            # 作为段内 item（提问→反馈→思考→工具→台词同一条 section）。无
            # wait_key 的罕见形态回落独立戏外行（总比丢强）。
            wk = str(d.get('wait_key') or '')
            msg = str(d.get('feedback') or '').strip()
            if not msg:
                errs = d.get('error') if isinstance(d.get('error'), list) else []
                msg = '; '.join(str(e) for e in errs)
            if not msg:
                return rows
            seg = self._seg_of_wk(wk)
            if seg:
                rows.extend(self._seg_fill(seg, [{'kind': 'retry', 'text': msg}]))
            elif wk:
                self.retries.setdefault(wk, []).append(
                    {'kind': 'retry', 'text': msg})
            else:
                rows.append({'zone': 'outside', 'kind': 'whisper', 'actor': '',
                             'text': msg})
        elif et == 'notify_author':
            # agent_error 与 node_retry 同文案（编译器单点拼装）——反馈已随
            # 段落入账，这里不再单发（双份）。warning/fatal/giveup 不是重试
            # 循环的一部分，照旧独立戏外行。
            if d.get('severity') == 'agent_error':
                return rows
            msg = str(d.get('message') or '').strip()
            if msg:
                rows.append({'zone': 'outside', 'kind': 'whisper', 'actor': '', 'text': msg})
        return rows

    def on_post_speech(self, args):
        """post_speech 交卷 → 本节点段的收尾批次（items=逐步(cot→发言→工具→结果) + 台词）。
        新路：段已在 node_start 开好（turn_id 归属），这里只把内容填进去并收口；
        老路（引擎没给 turn_id）：整段一次成行，items=[showprompt?, 反馈…, 上述]。
        角色显示名/scope 从 ai_request 登记的 wait_key 簿反查，查不到回落 soul。"""
        text = str(args.get('payload') or '')
        if not text:
            body = args.get('body') if isinstance(args.get('body'), dict) else {}
            # 台词正身=steps 末步 reply（2026-09-27 output 字段退役、不兼容读；
            # 本文件单文件纯标准库，此处内联 mailbox.last_step_reply 的孪生实现，
            # 改形态两处同改）
            _steps = body.get('steps') if isinstance(body.get('steps'), list) else []
            _last = _steps[-1] if _steps else None
            _last_reply = str(_last.get('reply') or '') if isinstance(_last, dict) else ''
            text = str(_last_reply or body.get('chat_text') or '')
        if not text.strip():
            return []
        wk = str(args.get('wait_key') or '')
        brief = self.briefs.get(wk, {})
        actor = brief.get('actor') or str(args.get('soul', '') or '')
        seg = self._seg_of_wk(wk)
        prompt_items = [] if seg else self._pop_prompt_item(wk)   # 提问 → 容器之前独立成行
        items = list(prompt_items)
        if not seg:
            items.extend(self._pop_retry_items(wk))   # 重试反馈随段（提问→反馈→…→台词）
        body = args.get('body') if isinstance(args.get('body'), dict) else {}
        steps = body.get('steps') if isinstance(body.get('steps'), list) else []
        for si, st in enumerate(steps):
            if not isinstance(st, dict):
                continue
            cot = str(st.get('cot') or '').strip()
            if cot:
                items.append({'kind': 'cot', 'text': cot})
            # 中间轮发言（2026-09-29 全谱收集）：契约里 reply=「该轮台词」，非末步
            # 的 reply=过程性发言（zcode 收卷织入的中间轮）——成 say 项随段上墙；
            # 末步 reply=正式台词正身，由段尾那条 say（text）承担，此处跳过防重。
            if si < len(steps) - 1:
                mid = str(st.get('reply') or '').strip()
                if mid and mid != text.strip():
                    items.append({'kind': 'say', 'text': mid})
            calls = st.get('tool_calls') if isinstance(st.get('tool_calls'), list) else []
            results = st.get('tool_results') if isinstance(st.get('tool_results'), list) else []
            for i, tc in enumerate(calls):
                if isinstance(tc, dict):
                    name, targs = str(tc.get('name') or 'unknown'), str(tc.get('arguments') or '')
                else:
                    name, targs = str(tc or 'unknown'), ''
                items.append({'kind': 'tool', 'text': '',
                              'toolCall': {'name': name, 'arguments': targs}})
                if i < len(results):
                    # tool_result 槽全链唯一形状=协议 schema toolResult:{node,output}
                    # （2026-09-21 用户拍板一条链路一种形状）：text 恒空，真文本在
                    # toolResult.output，与 god-mirror 织入路径同款——渲染端只认
                    # 这一种（旧账本里的 text 形状由渲染端兜底，账本不迁移）。
                    items.append({'kind': 'tool_result', 'text': '',
                                  'toolResult': {'node': name, 'output': str(results[i] or '')}})
        items.append({'kind': 'say', 'text': text})
        if seg:
            if wk:
                self.served.add(wk)   # 本 wait_key 已消费：context_ready 晚到绝不再扣
            return self._seg_fill(seg, items, actor=actor or None, close=True)
        if wk:
            self.served.add(wk)   # 本 wait_key 已消费：context_ready 晚到绝不再扣
        rows = self._prompt_rows(prompt_items, targets=brief.get('targets'),
                                 node=brief.get('node'))
        rows.append(self._section(actor, items, wk, 'speech',
                                  targets=brief.get('targets'), node=brief.get('node')))
        return rows

    def on_human_input(self, args):
        """human_input 交卷 → 本节点段的收尾（新路：台词填进已开的块并收口；
        老路：一个段落行，items=[扣住的提问?, 人类台词]）。"""
        body = args.get('body') if isinstance(args.get('body'), dict) else {}
        text = str(body.get('output') or body.get('reply') or body.get('chat_text') or '')
        if not text.strip():
            return []
        wk = str(args.get('wait_key') or '')
        brief = self.briefs.get(wk, {})
        targets = brief.get('targets') or []
        actor = targets[0] if targets else '用户'
        seg = self._seg_of_wk(wk)
        if seg:
            if wk:
                self.served.add(wk)
            return self._seg_fill(seg, [{'kind': 'say', 'text': text}], close=True)
        items = self._pop_prompt_item(wk)
        prompt_items = list(items)                 # 提问 → 容器之前独立成行
        items.extend(self._pop_retry_items(wk))   # 人类重试反馈（你的输入未被接受…）随段
        items.append({'kind': 'say', 'text': text})
        if wk:
            self.served.add(wk)
        rows = self._prompt_rows(prompt_items, targets=targets or None,
                                 node=brief.get('node'))
        rows.append(self._section(actor, items, wk, 'human',
                                  targets=targets or None, node=brief.get('node')))
        return rows

    def on_actor_failed(self, args):
        """actor_failed（B5 执行体最终失败）→ 本节点段填一条失败行并收口
        （老路：一个段落行 items=[showprompt?, 重试反馈…, 失败行]）。"""
        wk = str(args.get('wait_key') or '')
        detail = str(args.get('detail') or '') or str(args.get('kind') or 'executor_error')
        brief = self.briefs.get(wk, {})
        seg = self._seg_of_wk(wk)
        fail = {'kind': 'fail', 'text': '（节点执行失败：%s）' % detail}
        if seg:
            if wk:
                self.served.add(wk)
            return self._seg_fill(seg, [fail], close=True)
        items = self._pop_prompt_item(wk)
        prompt_items = list(items)                 # 提问 → 容器之前独立成行
        items.extend(self._pop_retry_items(wk))
        items.append(fail)
        if wk:
            self.served.add(wk)
        rows = self._prompt_rows(prompt_items, targets=brief.get('targets'),
                                 node=brief.get('node'))
        rows.append(self._section(brief.get('actor') or '', items, wk, 'fail',
                                  targets=brief.get('targets'), node=brief.get('node')))
        return rows


def resolve_port(host='127.0.0.1') -> int:
    """嵌入宿主的缺省端口：env FEMO_PROJECTION_PORT（缺省 8790），占用则向上探 20 个。"""
    env = os.environ.get('FEMO_PROJECTION_PORT', '')
    base = int(env) if env.isdigit() else 8790
    for p in range(base, base + 20):
        try:
            s = socket.socket()
            s.bind((host, p))
            s.close()
            return p
        except OSError:
            continue
    return base


def start_hub_server(hub: ProjectionHub, host='127.0.0.1', port=None,
                     write_ledger=True) -> int:
    """宿主进程嵌入专用：缺省端口探测 + 写 hub.json（工具/页面的自发现面）。
    全程只写 stderr——桥的 stdout 是 NDJSON 协议线，一个字都不能上。
    write_ledger=False 只绑定不写账：femo_daemon 专用——无条件覆写会把并发
    出生时的孪生裁决搅成「最后写者赢」，账由 daemon 的收口循环按探活裁决写
    （femo_daemon._claim_ledger）。"""
    if port is None:
        port = resolve_port(host)
    actual, _th = hub.start_server(host, port)
    if write_ledger:
        try:
            os.makedirs(hub.dir_path, exist_ok=True)
            with open(os.path.join(hub.dir_path, 'hub.json'), 'w', encoding='utf-8') as f:
                json.dump({'host': host, 'port': actual, 'pid': os.getpid(),
                           'data': hub.dir_path,
                           'started': int(time.time() * 1000)}, f)
        except OSError:
            pass
    return actual


class _HubConnDead(Exception):
    """远端 hub 连接不上（连接拒绝/超时）。与 hub 的业务错误（4xx/5xx，hub 活着、
    是喂的数据问题）严格分开——只有前者参与「唯一 hub 已死」的判据。"""


class HubClient:
    """桥侧 hub 客户端（hub 唯一化 2026-09-25，docs/ActiveRoadmaps/hub唯一化设计.md）。

    全局任意时刻只该有一个活 hub。启动探本数据根 hub.json 指向的 hub：
      · 活    → **复用模式（remote）**：不自起、不覆写地址簿；喂行走现成 /feed，
                花名册/显示名/归属登记/等待态走 POST /hub-register，信任账查询走
                GET /owner。
      · 死/无 → **自起模式（local）**：现行行为零变化（起服务+写 hub.json）。

    两态同名方法——桥的装配段与全部 hub.xxx 调用两种模式一字不改。复用模式的
    三个注入（驿站/信箱宿主/信任解析器）是**记录在案的无操作**：寄信走共享信柜
    （mailbox 的锁是跨进程 O_EXCL 文件锁，多实例并发已实证）；信任集由喂方登记
    （本桥喂行前查 /owner、漏了就 HTTP 补登记）+ 养桥注入的解析器兜底。

    failover 一期降级（设计稿 §三）：复用 hub 中途死亡 → 连续「连接不上」计满
    阈值 → 大声 stderr 留痕，**不做运行中热接管**——桥重启自愈（重启时探不到
    死 hub，自然走自起）。窗口内实时行丢几条（内存的），磁盘账不丢（每行即时
    flush），投影窗冷唤醒自愈。判据纪律：只有「连接不上」计数；业务错误（4xx/
    5xx）不计——那是喂的数据问题，修数据不换 hub。

    事故区纪律（设计稿 §五）：本类的一切失败都大声 stderr，绝不静默裸奔
    ——2026-09-19 的 NameError 被 except 吞掉、hub 静默不启动，前科在案。"""

    PING_TIMEOUT = 1.5        # 启动探活短超时（秒）：死端口通常立刻拒绝，超时算死
    CALL_TIMEOUT = 15         # 运行期调用超时（秒）：冷唤醒读大账本可能要几秒
    FAIL_THRESHOLD = 10       # 连续「连接不上」计满 → 大声宣告唯一 hub 已死
    FAIL_ECHO_SEC = 60.0      # 宣告后的重复留痕节流（秒）

    def __init__(self, data_dir: str = None, spawner=None):
        self._addr_path = os.path.join(data_dir or PROJECTION_DIR, 'hub.json')
        self._remote = False
        self._port = 0
        self._base = ''
        self._hub = None          # local 模式的真身；remote 模式恒 None（不构造）
        self._fails = 0
        self._dead_announced = False
        self._last_banner = 0.0
        self._fail_lock = threading.Lock()
        # 代拉器（第1步 常驻化）：缺省=脱离母进程拉起 femo_daemon.py；
        # 测试注入进程内起 hub 的假代拉（自检/单测不起真子进程）。
        self._spawner = spawner

    # ── 模式面 ──
    @property
    def local(self) -> bool:
        """自起模式（True=本进程养着唯一 hub；False=复用别家养的）。"""
        return not self._remote

    @property
    def hub(self):
        """local 模式的真身（装 print 旁路等进程内装配用）；remote 恒 None。"""
        return self._hub

    @classmethod
    def attach_local(cls, hub: 'ProjectionHub', data_dir: str, port: int) -> 'HubClient':
        """进程内直连（第2步 常驻引擎增量A）：daemon 肚里 hub 与引擎同进程——
        客户端直接挂到本进程 hub 真身上，local 模式方法族原样直通 self._hub。
        绝不走 connect()：daemon 探自己的 hub 会复用自己=HTTP 自环（自己 POST
        自己，交接说明皱褶③明令禁止）。addr_path 照记（/health 指纹等读端
        语义不变），只是永远不必探。"""
        client = cls(data_dir=data_dir)
        client._hub = hub
        client._port = int(port)
        client._base = 'http://127.0.0.1:%d' % int(port)
        return client

    @property
    def port(self) -> int:
        return self._port

    def connect(self, register_name='') -> str:
        """启动握手：探地址簿 → 复用；死/无 → 代拉常驻引擎 femo_daemon（脱离
        母进程独立存活）→ 等它写账 → 复用。返回归一后的宿主名（桥拿它当
        host_name：投影自称/段键命名空间/feed 来源标签）。

        【第1步 常驻化 2026-09-26】本进程**永不养 hub**——自起路径整条退役：
        「养桥关机=剧场消失」「桥自起第二座」两病同根拔除（施工清单 §五 第 1 步
        隐藏触点）。print 浮层随之升级常驻必有（旁路改走 HTTP，见 print_sink）。

        复用成立的门槛=一次成功的 register 往返：探活过了但登记失联（hub 恰在
        两步之间死掉）→ 按死 hub 处理、进代拉循环——绝不拿着半截复用裸奔。登记
        遇业务错误（hub 活着但拒了请求，版本差/名字形状）→ 留痕后**仍走复用**
        （代拉会在活 hub 旁边再造第二本，正是本刀要消灭的病；漏登记由 feed 的
        source 自发现面自愈）。"""
        addr = self._read_addr()
        if addr and self._probe(addr):
            self._enter_remote(addr)
            try:
                name = self.register_host(register_name)
            except _HubConnDead as exc:
                sys.stderr.write(
                    'femo_bridge: [hub-unify] hub.json 指向 %s，探活通过但登记失联'
                    '（%s）——按死 hub 处理，进代拉。\n' % (self._base, exc))
            else:
                sys.stderr.write(
                    'femo_bridge: [hub-unify] 复用模式：检测到活 hub %s（pid=%s），'
                    '本桥不自起、不覆写地址簿，喂送与登记全走 HTTP；唯一 hub 死亡'
                    '则大声留痕、桥重启自愈（failover 一期不热接管）。\n'
                    % (self._base, addr.get('pid') or '?'))
                return name
        elif addr:
            sys.stderr.write(
                'femo_bridge: [hub-unify] hub.json 指向 %s:%s 但探活失败——'
                '按无 hub 处理，代拉常驻引擎。\n'
                % (addr.get('host') or '127.0.0.1', addr.get('port') or '?'))
        # 代拉循环（自起路径退役，见 connect 文档）：代拉（幂等，活 hub 在
        # daemon 自退）→ 等它写账 → 复用登记；hub 恰死在两步之间就再来一轮。
        data_dir = os.path.dirname(self._addr_path)
        deadline = time.time() + 60
        last_err = ''
        while time.time() < deadline:
            try:
                self._spawn_daemon(data_dir)
            except Exception as exc:                       # noqa: BLE001 — 大声留痕后重试
                last_err = str(exc)
                sys.stderr.write('femo_bridge: [daemon] 代拉失败: %s\n' % exc)
            for _ in range(12):                            # 每轮最多等 ~12s（daemon 冷启毫秒级）
                addr = self._read_addr()
                if addr and self._probe(addr):
                    self._enter_remote(addr)
                    try:
                        name = self.register_host(register_name)
                    except _HubConnDead:
                        break                              # 恰死在两步之间 → 下一轮再代拉
                    return name
                time.sleep(1)
        raise RuntimeError(
            'femo_daemon 代拉失败（60s 内 hub 未就绪）: %s' % (last_err or 'timeout'))

    def _enter_remote(self, addr) -> None:
        self._remote = True
        self._port = int(addr.get('port') or 0)
        self._base = 'http://127.0.0.1:%d' % self._port

    def _spawn_daemon(self, data_dir) -> None:
        """代拉常驻引擎（幂等：hub 已活则零动作）。脱离母进程独立存活——
        母（桥/窗口）死了它继续活，这是「剧场不随窗口散场」的机制本体。"""
        addr = self._read_addr()
        if addr and self._probe(addr):
            return
        if self._spawner is not None:                  # 测试注入缝（不起真子进程）
            self._spawner(data_dir)
            return
        import subprocess
        daemon_py = os.path.join(os.path.dirname(
            os.path.abspath(__file__)), 'python', 'femo_daemon.py')
        log_dir = os.path.join(data_dir, 'logs')
        os.makedirs(log_dir, exist_ok=True)
        logf = open(os.path.join(log_dir, 'femo_daemon.log'), 'ab')
        kwargs = {}
        if os.name == 'nt':
            kwargs['creationflags'] = (getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
                                       | getattr(subprocess, 'DETACHED_PROCESS', 0))
        else:
            kwargs['start_new_session'] = True
        # PYTHONUNBUFFERED（与 daemon-client 同课）：stdout/stderr 重定向进日志
        # 文件后 python 转块缓冲，引擎 print 不实时落盘——排障取证全靠这份日志。
        env = dict(os.environ)
        env.setdefault('PYTHONUNBUFFERED', '1')
        subprocess.Popen([sys.executable, daemon_py, '--data-dir', data_dir],
                         stdin=subprocess.DEVNULL, stdout=logf, stderr=logf,
                         close_fds=True, env=env, **kwargs)
        sys.stderr.write('femo_bridge: [daemon] 已代拉常驻引擎 femo_daemon'
                         '（脱离母进程，日志 %s）\n' % logf.name)

    def print_sink(self):
        """print 旁路的目标（install_stdio_print_bypass 的水槽）：remote 模式走
        HTTP 水槽（POST /prints 投给常驻 hub）——浮层升级常驻必有，每座桥的
        print 都进浮层，不再只有养桥有。"""
        if self._remote:
            return _RemotePrintSink(self._base)
        return self._hub

    # ── 桥消费面（local 直通真身 / remote 走 HTTP，同名同形状）──────────

    def register_host(self, name) -> str:
        if self._remote:
            out = self._post('/hub-register', {'kind': 'host', 'name': name})
            return str(out.get('host') or '')
        return self._hub.register_host(name)

    def feed(self, job_id, frames, source: str = '') -> dict:
        if self._remote:
            return self._post('/feed', {'job_id': job_id, 'frames': frames,
                                        'source': source})
        return self._hub.feed(job_id, frames, source=source)

    def has_owner(self, job_id) -> bool:
        if self._remote:
            out = self._get('/owner?job=%d' % int(job_id))
            return bool(out.get('owners'))
        return self._hub.has_owner(job_id)

    def set_owner(self, job_id, owner_sid, host: str = '') -> None:
        if self._remote:
            self._post('/hub-register', {'kind': 'owner', 'job_id': job_id,
                                         'sid': owner_sid, 'host': host})
            return
        self._hub.set_owner(job_id, owner_sid, host=host)

    def set_cast(self, job_id, actors) -> None:
        if self._remote:
            self._post('/hub-register', {'kind': 'cast', 'job_id': job_id,
                                         'actors': actors})
            return
        self._hub.set_cast(job_id, actors)

    def cast_job(self, job_id) -> dict:
        """Job 选角账读取（多宿主派工：桥产信前查绑定归属，外宿主留柜自取）。"""
        if self._remote:
            try:
                return self._get('/cast?job=%d' % int(job_id))
            except Exception:
                return {'ok': False, 'cast': {}}
        return self._hub.cast_job(job_id)

    def remember_display(self, job_id, name) -> None:
        if self._remote:
            self._post('/hub-register', {'kind': 'display', 'job_id': job_id,
                                         'name': name})
            return
        self._hub.remember_display(job_id, name)

    def set_waiting(self, state) -> None:
        if self._remote:
            self._post('/hub-register', {'kind': 'waiting', 'state': state})
            return
        self._hub.set_waiting(state)

    def set_mailbox(self, mailbox_mod) -> None:
        """local：注驿站真身。remote：无操作——唯一 hub 用养桥注入的驿站模块，
        信柜是共享盘上的同一本（mailbox 跨进程文件锁），信不会丢格。"""
        if not self._remote:
            self._hub.set_mailbox(mailbox_mod)

    def set_mailbox_host(self, host) -> None:
        """local：注信箱宿主 id。remote：无操作（同上——寄信方是养桥那半边）。"""
        if not self._remote:
            self._hub.set_mailbox_host(host)

    def set_owner_resolver(self, fn) -> None:
        """local：注信任解析器。remote：无操作——远端 hub 已有养桥的解析器，
        且两台读的是同一份 job 档案盘；本桥的信任登记走喂方登记（喂行前查
        /owner 漏了就 /hub-register 补），解析器职责已覆盖。"""
        if not self._remote:
            self._hub.set_owner_resolver(fn)

    # ── HTTP 底座 ──
    def _read_addr(self):
        """读本数据根的地址簿（hub.json）。缺/坏 → None（按无 hub 处理）。"""
        try:
            with open(self._addr_path, encoding='utf-8') as f:
                addr = json.load(f)
            return addr if isinstance(addr, dict) and addr.get('port') else None
        except (OSError, ValueError):
            return None

    def _probe(self, addr) -> bool:
        """GET /health 短超时探活。应答须是 hub 的 /health 形状（ok:true）——
        端口被无关服务顶了的旧地址簿不许误判成活 hub。
        【第1步 身份指纹 2026-09-26】账与 /health 都报了 data（数据根）且不一致
        = 别人家的 hub，不算活（实测事故：测试沙盒 daemon 抢生产端口 8790，
        生产桥探活只查活不查谁，错把空账沙盒当自己家）。旧账/旧 hub 两边都没报
        → 宽容放行（双态兼容）。"""
        url = 'http://127.0.0.1:%d/health' % int(addr.get('port') or 0)
        try:
            with urllib.request.urlopen(url, timeout=self.PING_TIMEOUT) as resp:
                body = json.load(resp)
            if not body.get('ok'):
                return False
            want = str(addr.get('data') or '')
            got = str(body.get('data') or '')
            if want and got and want != got:
                return False
            return True
        except Exception:  # noqa: BLE001 — 探活：任何失败都算死
            return False

    def _post(self, path, body) -> dict:
        req = urllib.request.Request(
            self._base + path,
            data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
            headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=self.CALL_TIMEOUT) as resp:
                out = json.load(resp)
        except urllib.error.HTTPError as exc:
            # 业务错误（4xx/5xx）：hub 活着——不计死亡、不当死处理，原样大声上抛
            # （与 local 模式 hub 抛异常同一待遇：调用方的 except 落 stderr）。
            try:
                detail = exc.read().decode('utf-8', 'replace')
            except OSError:
                detail = ''
            raise Exception('hub %s -> HTTP %d: %s' % (path, exc.code, detail)
                            ) from exc
        except Exception as exc:  # noqa: BLE001 — 连接拒绝/超时=唯一 hub 已死
            self._count_fail()
            raise _HubConnDead('%s: %s' % (path, exc)) from exc
        self._count_ok()
        return out

    def _get(self, path) -> dict:
        try:
            with urllib.request.urlopen(self._base + path,
                                        timeout=self.CALL_TIMEOUT) as resp:
                out = json.load(resp)
        except urllib.error.HTTPError as exc:
            raise Exception('hub %s -> HTTP %d' % (path, exc.code)) from exc
        except Exception as exc:  # noqa: BLE001
            self._count_fail()
            raise _HubConnDead('%s: %s' % (path, exc)) from exc
        self._count_ok()
        return out

    # ── failover 一期：大声留痕（不热接管，桥重启自愈）───────────────────
    def _count_fail(self) -> None:
        with self._fail_lock:
            self._fails += 1
            now = time.time()
            if self._fails < self.FAIL_THRESHOLD:
                return
            if self._dead_announced and now - self._last_banner < self.FAIL_ECHO_SEC:
                return
            self._dead_announced = True
            self._last_banner = now
        sys.stderr.write(
            'femo_bridge: [hub-unify] ⚠ 唯一 hub @ %s 已死（连续 %d 次连接不上）：'
            '喂送停摆，本桥照常演出、行只进磁盘账（每行即时 flush 不丢），投影窗'
            '冷唤醒自愈；重启本桥即接管自起（failover 一期不热接管）。\n'
            % (self._base, self._fails))

    def _count_ok(self) -> None:
        with self._fail_lock:
            self._fails = 0
            self._dead_announced = False


class _StdioTap:
    """stdout/stderr 旁观代理（print 旁路的采集端，2026-09-19「加一路显示」）。

    write() 先把文本镜像给 hub（环形缓冲 + WS 广播，消费面=投影页右上角调试
    浮层），再原样转交真身——代理不缓冲、不改写、不吞字，原流分毫不动。
    行聚合：按换行切行入账；无换行的残段暂存，flush() 时放出，超长残段
    （>2000 字，进度条类不换行刷屏的防线）截断入账。协议行过滤：桥的 NDJSON
    线（'{' 开头且含 '"type"'）不进镜像——那是协议不是 print，镜像里全是噪音。
    防线：镜像自身出错一律吞掉，绝不反噬原写入；递归防火墙 _in_tap 挡住
    「镜像引发镜像」。多线程并发写时，镜像顺序与原流顺序在相邻两行间可能互换
    （调试镜像可接受，原流顺序不受任何影响）。"""

    _FRAGMENT_MAX = 2000

    def __init__(self, real, hub, stream: str):
        self._real = real
        self._hub = hub
        self._stream = stream
        self._pending = ''
        self._in_tap = False
        self._lock = threading.Lock()

    def write(self, s):
        if not self._in_tap and isinstance(s, str) and s:
            self._in_tap = True
            try:
                with self._lock:
                    self._pending += s
                    lines = []
                    while True:
                        i = self._pending.find('\n')
                        if i < 0:
                            break
                        lines.append(self._pending[:i].rstrip('\r'))
                        self._pending = self._pending[i + 1:]
                    if len(self._pending) > self._FRAGMENT_MAX:
                        lines.append(self._pending[:self._FRAGMENT_MAX] + '…')
                        self._pending = ''
                for ln in lines:
                    if not ln.strip():
                        continue
                    if ln.lstrip().startswith('{') and '"type"' in ln:
                        continue   # 桥的 NDJSON 协议线：不进镜像
                    self._hub.add_print(ln, self._stream)
            except Exception:  # noqa: BLE001 — 旁路绝不反噬原流
                pass
            finally:
                self._in_tap = False
        return self._real.write(s)

    def flush(self):
        try:
            if not self._in_tap:
                self._in_tap = True
                try:
                    with self._lock:
                        rest, self._pending = self._pending, ''
                    if rest.strip():
                        self._hub.add_print(rest, self._stream)
                finally:
                    self._in_tap = False
        except Exception:  # noqa: BLE001
            pass
        return self._real.flush()

    def __getattr__(self, name):
        return getattr(self._real, name)


class _RemotePrintSink:
    """复用模式的 print 旁路水槽（第1步 常驻化）：add_print 走 HTTP 投给常驻
    hub（POST /prints）。鸭子型兼容 _StdioTap 对水槽的唯一调用面（add_print）。
    幕布纪律：旁路绝不挡演出——任何失败静默吞掉（也不写 stderr，写它会递归
    过旁路自己）。"""

    def __init__(self, base: str):
        self._base = str(base).rstrip('/')

    def add_print(self, text, stream: str = 'stdout') -> None:
        try:
            req = urllib.request.Request(
                self._base + '/prints',
                data=json.dumps({'text': str(text)[:2000],
                                 'stream': str(stream or 'stdout')}).encode('utf-8'),
                headers={'Content-Type': 'application/json'}, method='POST')
            urllib.request.urlopen(req, timeout=2).read()
        except Exception:               # noqa: BLE001 — 静默（见类注）
            pass


def install_stdio_print_bypass(hub: 'ProjectionHub') -> None:
    """把本进程 sys.stdout / sys.stderr 换成旁观代理（幂等：重装只换目标 hub）。

    装上之后，桥进程里的 print()、sys.stderr.write、未捕获 traceback、
    ThreadingHTTPServer 的 handle_error 全部镜像进 hub（投影页右上角调试浮层），
    同时原流分毫不动——femogen『编译器』页那路（宿主读桥进程的 OS 管道）
    完全不受影响。只镜像安装点之后的行：桥启动更早的 print（宿主清单两行）
    不进浮层，宿主 stderr 里仍可见。
    【第1步 常驻化】目标可以是 _RemotePrintSink（HTTP 水槽，见 HubClient.print_sink）
    ——duck 型只要求 add_print(text, stream)。"""
    for attr, stream in (('stdout', 'stdout'), ('stderr', 'stderr')):
        cur = getattr(sys, attr, None)
        if isinstance(cur, _StdioTap):
            cur._hub = hub   # 幂等：重装只换目标 hub
            continue
        if cur is None:
            continue
        setattr(sys, attr, _StdioTap(cur, hub, stream))


# ── 自检与单跑 ─────────────────────────────────────────────────────────

def _selftest():
    import io
    import tempfile
    import urllib.request

    tmp = tempfile.mkdtemp(prefix='femo-hub-test-')
    hub = ProjectionHub(data_dir=tmp)

    frames = [
        {'op': 'row', 'zone': 'meta', 'kind': 'play_start', 'text': '第一幕'},
        {'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '甲', 'text': '你好'},
        {'op': 'live-start', 'key': 't1', 'actor': '乙', 'blockKind': 'text'},
        {'op': 'live-delta', 'key': 't1', 'text': '我想'},
        {'op': 'live-delta', 'key': 't1', 'text': '想'},
        {'op': 'live-done', 'key': 't1'},
        {'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '乙',
         'text': '我想想，好', 'targets': ['丙']},
        {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户', 'text': '耳语'},
        {'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '甲',
         'text': '重复', 'src_seq': 'sub7#1'},
        {'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '甲',
         'text': '重复', 'src_seq': 'sub7#1'},
    ]
    res = hub.feed(1, frames, source='selftest')
    assert res['appended'] == 6, res

    god = hub.snapshot(1, 'god')['rows']
    assert [r['n'] for r in god] == [1, 2, 3, 4, 5, 6]
    assert god[2]['text'] == '我想想', god[2]           # 直播块合成转正
    stage = hub.snapshot(1, 'stage')['rows']
    # 2026-09-21 场次行全视角：stage/角色窗也看得到开演行（n=1）；outside
    # 耳语（n=5）仍只进上帝窗
    assert [r['n'] for r in stage] == [1, 2, 3, 4, 6]
    pc = hub.snapshot(1, 'actor:丙')['rows']
    assert [r['n'] for r in pc] == [1, 2, 3, 4, 6]
    pd = hub.snapshot(1, 'actor:丁')['rows']
    assert [r['n'] for r in pd] == [1, 2, 3, 6]         # targets 命中过滤

    # 冷唤醒：换一个实例从账本重载，幂等键依然拦得住，行号接着排
    hub2 = ProjectionHub(data_dir=tmp)
    assert len(hub2.snapshot(1, 'god')['rows']) == 6
    r2 = hub2.feed(1, [{'op': 'row', 'zone': 'inplay', 'kind': 'say',
                        'actor': '甲', 'text': '重复', 'src_seq': 'sub7#1'}])
    assert r2['appended'] == 0, r2
    r3 = hub2.feed(1, [{'op': 'row', 'zone': 'inplay', 'kind': 'say',
                        'actor': '甲', 'text': '第七行'}])
    assert r3['appended'] == 1
    assert hub2.snapshot(1, 'god')['rows'][-1]['n'] == 7
    assert os.path.isfile(os.path.join(tmp, '1', 'journal.jsonl'))

    # 重启兜底：全新 hub 实例（内存无 _last_job）订阅「最新」→ 回落盘上最近场
    hub3 = ProjectionHub(data_dir=tmp)
    snap3 = hub3.snapshot(None, 'god')
    assert snap3['job'] == 1 and snap3['rows'][-1]['n'] == 7, snap3
    assert hub3.latest_job() == 1

    # 服务面：HTTP + WS 全链
    port = start_hub_server(hub2, port=0)
    assert os.path.isfile(os.path.join(tmp, 'hub.json'))    # 自发现件已写
    base = 'http://127.0.0.1:%d' % port
    with urllib.request.urlopen(base + '/health', timeout=5) as resp:
        hbody = json.load(resp)
    assert hbody['ok'] is True and hbody['proto'] == 1, hbody
    with urllib.request.urlopen(base + '/view?job=1&view=stage&after=6', timeout=5) as resp:
        vbody = json.load(resp)
    assert vbody['proto'] == 1 and [r['n'] for r in vbody['rows']] == [7], vbody
    with urllib.request.urlopen(base + '/diag', timeout=5) as resp:
        dg = json.load(resp)
    assert dg['proto'] == 1 and dg['subs'] == 0 and dg['books_loaded'] >= 1, dg
    with urllib.request.urlopen(base + '/jobs', timeout=5) as resp:
        assert json.load(resp)['latest'] == 1
    with urllib.request.urlopen(base + '/', timeout=5) as resp:
        assert b'Projection' in resp.read()

    # 页面资产白名单（2026-09-26 拆分）：资产 200 且类型正确；未命中 404 且非
    # HTML——兜底吞 404 回 HTML 会害浏览器拒执行 module（整页黑、服务端零痕迹）。
    for _pc_path, _pc_kind in (('/pc/main.mjs', 'text/javascript'),
                               ('/pc/theme.css', 'text/css'),
                               ('/pc/app.css', 'text/css')):
        with urllib.request.urlopen(base + _pc_path, timeout=5) as resp:
            assert resp.status == 200 and resp.headers['Content-Type'].startswith(_pc_kind), \
                (_pc_path, resp.status, resp.headers.get('Content-Type'))
    try:
        with urllib.request.urlopen(base + '/pc/nope.mjs', timeout=5) as resp:
            raise AssertionError('/pc/ 未命中应 404，实际 ' + str(resp.status))
    except urllib.error.HTTPError as exc:
        assert exc.code == 404 and exc.headers.get('Content-Type', '').startswith('application/json'), \
            (exc.code, exc.headers.get('Content-Type'))

    # WS：握手 → 快照 → feed 推行/推直播
    import socket as _s
    c = _s.create_connection(('127.0.0.1', port), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    c.sendall(('GET /?job=1&view=stage HTTP/1.1\r\nHost: 127.0.0.1:%d\r\n'
               'Upgrade: websocket\r\nConnection: Upgrade\r\n'
               'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n'
               % (port, key)).encode())
    buf = b''
    while b'\r\n\r\n' not in buf:
        buf += c.recv(4096)
    assert b'101' in buf.split(b'\r\n')[0], buf[:120]
    rf = c.makefile('rb')

    def ws_read(rfile=None):
        r = rfile or rf
        h = _read_exact(r, 2)
        ln = h[1] & 0x7F
        if ln == 126:
            ln = struct.unpack('>H', _read_exact(r, 2))[0]
        elif ln == 127:
            ln = struct.unpack('>Q', _read_exact(r, 8))[0]
        return json.loads(_read_exact(r, ln).decode('utf-8'))

    def ws_connect(query):
        """再开一条 WS 订阅（带 query，如 view=...），返回 (socket, rfile)。"""
        cc = _s.create_connection(('127.0.0.1', port), timeout=5)
        kk = base64.b64encode(os.urandom(16)).decode()
        cc.sendall(('GET /?%s HTTP/1.1\r\nHost: 127.0.0.1:%d\r\n'
                    'Upgrade: websocket\r\nConnection: Upgrade\r\n'
                    'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n'
                    % (query, port, kk)).encode())
        bb = b''
        while b'\r\n\r\n' not in bb:
            bb += cc.recv(4096)
        assert b'101' in bb.split(b'\r\n')[0], bb[:120]
        return cc, cc.makefile('rb')

    snap = ws_read()
    # stage 视角 WS 快照：场次行（n=1）也进（2026-09-21 全视角拍板）
    assert snap['ctrl'] == 'snapshot' and snap.get('proto') == 1 \
        and [r['n'] for r in snap['rows']] == [1, 2, 3, 4, 6, 7], snap

    def feed(frames):
        req = urllib.request.Request(
            base + '/feed', data=json.dumps({'job_id': 1, 'frames': frames}).encode(),
            headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.load(resp)

    feed([{'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '甲', 'text': 'ws行'}])
    assert ws_read()['n'] == 8
    feed([{'op': 'live-start', 'key': 'k2', 'actor': '乙', 'blockKind': 'reasoning'},
          {'op': 'live-delta', 'key': 'k2', 'text': '思考中'}])
    live0 = ws_read()   # live-start 也广播一次：块先出现（空文本），delta 再逐次推
    assert live0['ctrl'] == 'live' and live0['text'] == ''
    live = ws_read()
    assert live['ctrl'] == 'live' and live['text'] == '思考中' and live['blockKind'] == 'reasoning'
    feed([{'op': 'live-done', 'key': 'k2',
           'row': {'zone': 'inplay', 'kind': 'say', 'actor': '乙', 'text': '成品'}}])
    done = ws_read()
    assert done['ctrl'] == 'live-done' and done['key'] == 'k2'
    row = ws_read()
    assert row['n'] == 9 and row['text'] == '成品'

    # 角色视角直播（2026-09-19 用户拍板：切到哪个窗就播哪个窗）
    # ①库面：live_blocks 按视角过滤——角色视角只收本人在打的块
    hub2.feed(1, [{'op': 'live-start', 'key': 'va', 'actor': '乙', 'blockKind': 'text'},
                  {'op': 'live-delta', 'key': 'va', 'text': '乙在打'}])
    assert 'va' in [b['key'] for b in hub2.live_blocks(1, 'actor:乙')]
    assert hub2.live_blocks(1, 'actor:丙') == []
    assert len(hub2.live_blocks(1, 'god')) == 1 and len(hub2.live_blocks(1, 'stage')) == 1
    # ②WS：乙视角订阅者收快照捎带的 va；甲的直播帧被滤掉，下一帧是乙的增量
    c2, rf2 = ws_connect('job=1&view=actor:%E4%B9%99')
    snap2 = ws_read(rf2)
    assert snap2['ctrl'] == 'snapshot' and [b['key'] for b in snap2['live']] == ['va'], snap2
    feed([{'op': 'live-start', 'key': 'jia1', 'actor': '甲', 'blockKind': 'text'},
          {'op': 'live-delta', 'key': 'jia1', 'text': '甲在打'},
          {'op': 'live-delta', 'key': 'va', 'text': '!'}])
    nxt = ws_read(rf2)
    assert nxt['ctrl'] == 'live' and nxt['key'] == 'va' and nxt['text'] == '乙在打!', nxt
    # ③撤块 ctrl 带打字人；正式行照常推
    feed([{'op': 'live-done', 'key': 'va',
           'row': {'zone': 'inplay', 'kind': 'say', 'actor': '乙', 'text': '乙完工'}}])
    done2 = ws_read(rf2)
    assert done2['ctrl'] == 'live-done' and done2['key'] == 'va' and done2['actor'] == '乙', done2
    row2 = ws_read(rf2)
    assert row2['n'] == 10 and row2['text'] == '乙完工', row2
    # ④stage 视角「直播全收」的既有语义不回归：c 队列积压帧逐一对账后排干
    st = ws_read(); assert st['ctrl'] == 'live' and st['key'] == 'va' and st['text'] == '', st
    st = ws_read(); assert st['key'] == 'va' and st['text'] == '乙在打', st
    st = ws_read(); assert st['key'] == 'jia1' and st['text'] == '', st
    st = ws_read(); assert st['key'] == 'jia1' and st['text'] == '甲在打', st
    st = ws_read(); assert st['key'] == 'va' and st['text'] == '乙在打!', st
    st = ws_read(); assert st['ctrl'] == 'live-done' and st['key'] == 'va', st
    st = ws_read(); assert st['n'] == 10, st
    c2.close()

    # live-clear 广播（2026-09-19 补哑巴）：清桶必须喊一嗓子——快照捎带活块，
    # 清场后全视角收到 ctrl live-clear，桶见底
    hub2.feed(1, [{'op': 'live-drop', 'key': 'jia1'}])   # 收拾②留下的甲块
    st = ws_read(); assert st['ctrl'] == 'live-done' and st['key'] == 'jia1', st
    hub2.feed(1, [{'op': 'live-start', 'key': 'vc', 'actor': '甲', 'blockKind': 'text'}])
    c3, rf3 = ws_connect('job=1&view=god')
    snap3 = ws_read(rf3)
    assert snap3['ctrl'] == 'snapshot' and [b['key'] for b in snap3['live']] == ['vc'], snap3
    hub2.feed(1, [{'op': 'live-clear'}])
    clr = ws_read(rf3)
    assert clr['ctrl'] == 'live-clear', clr
    st = ws_read(); assert st['ctrl'] == 'live' and st['key'] == 'vc', st   # stage 排干
    st = ws_read(); assert st['ctrl'] == 'live-clear', st
    assert hub2.live_blocks(1) == []
    c3.close()

    # 空位与回填（2026-09-19 用户拍板：user 戏外找 main，回话位置紧跟 user 发言）
    hub6 = ProjectionHub(data_dir=tmp)
    hub6.feed(4, [
        {'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '甲', 'text': '戏内行'},
        {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户', 'text': '导演在吗',
         'src_seq': 'u1'},
        {'op': 'row', 'zone': 'outside', 'kind': 'section', 'actor': '导演', 'text': '',
         'items': [], 'slot': 1, 'src_seq': 'u1:slot'},
    ])
    g6 = hub6.snapshot(4, 'god')['rows']
    assert [r['n'] for r in g6] == [1, 2, 3] and g6[2].get('slot') == 1 and g6[2]['items'] == []
    hub6.feed(4, [{'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '乙', 'text': '插队行'}])
    assert hub6.snapshot(4, 'god')['rows'][-1]['n'] == 4   # 空位占住 3 号，插队行排 4
    ok6 = hub6.feed(4, [{'op': 'fill-slot', 'row': {
        'zone': 'outside', 'kind': 'section', 'actor': '导演', 'text': '',
        'items': [{'kind': 'cot', 'text': '想'}, {'kind': 'say', 'text': '在的'}],
        'turn': 5, 'src_seq': 'main:turn5'}}])
    assert ok6['appended'] == 1
    rows6 = hub6.snapshot(4, 'god')['rows']
    assert [r['n'] for r in rows6] == [1, 2, 3, 4]
    assert rows6[2]['n'] == 3 and not rows6[2].get('slot')
    # 回填段同样过槽序规整：名字槽（导演）注入在内容槽之前
    assert [i['kind'] for i in rows6[2]['items']] == ['name', 'cot', 'say']
    assert rows6[2]['items'][0]['text'] == '导演'
    ok6b = hub6.feed(4, [{'op': 'fill-slot', 'row': {   # 同 src_seq 重放：幂等跳过
        'zone': 'outside', 'kind': 'section', 'actor': '导演', 'text': '',
        'items': [{'kind': 'say', 'text': '在的'}], 'src_seq': 'main:turn5'}}])
    assert ok6b['appended'] == 0
    # 冷唤醒：回填态从盘上恢复；没有空位可填→按普通行追加（回话绝不丢）
    hub7 = ProjectionHub(data_dir=tmp)
    rows7 = hub7.snapshot(4, 'god')['rows']
    assert [i['kind'] for i in rows7[2]['items']] == ['name', 'cot', 'say']
    ok7 = hub7.feed(4, [{'op': 'fill-slot', 'row': {
        'zone': 'outside', 'kind': 'section', 'actor': '导演', 'text': '',
        'items': [{'kind': 'say', 'text': '没人占位也能说'}], 'src_seq': 'main:turn9'}}])
    assert ok7['appended'] == 1
    rows7 = hub7.snapshot(4, 'god')['rows']
    assert rows7[-1]['n'] == 5 and rows7[-1]['items'][-1]['text'] == '没人占位也能说'
    jlines = [json.loads(l) for l in open(os.path.join(tmp, '4', 'journal.jsonl'),
                                          encoding='utf-8') if l.strip()]
    assert [r['n'] for r in jlines] == [1, 2, 3, 4, 5]   # 原位改写：5 行、n 顺序
    assert jlines[2]['items'][-1]['text'] == '在的' and not jlines[2].get('slot')

    # 清单走 WS（file:// 直开的页面没有 fetch）：ctrl jobs / views 往返
    def ws_send(obj, sock=None):
        data = json.dumps(obj).encode('utf-8')
        mask = os.urandom(4)
        h = bytearray([0x81])
        n = len(data)
        if n < 126:
            h.append(0x80 | n)
        elif n < 65536:
            h.append(0x80 | 126)
            h += struct.pack('>H', n)
        else:
            h.append(0x80 | 127)
            h += struct.pack('>Q', n)
        h += mask
        (sock or c).sendall(bytes(h) + bytes(b ^ mask[i & 3] for i, b in enumerate(data)))

    ws_send({'ctrl': 'views'})
    vmsg = ws_read()
    assert vmsg['ctrl'] == 'views' and vmsg['views'][0]['id'] == 'god', vmsg
    ws_send({'ctrl': 'jobs'})
    jmsg = ws_read()
    assert jmsg['ctrl'] == 'jobs' and jmsg['latest'] == 1, jmsg

    # 草稿层走 WS（页面就是靠这条 row-update 接住「正在写的字」）：开段=行本体，
    # 草稿增量=同 n 原位 row-update（帧里带 drafts），收口=草稿消失、定稿上位。
    # （放在最后：它会给已在册的 c 队列添帧，前面那些逐帧对账的断言不受影响。）
    cd, rfd = ws_connect('job=1&view=god')
    snapd = ws_read(rfd)
    assert snapd['ctrl'] == 'snapshot', snapd
    feed([{'op': 'seg-open', 'seg': 'w:wsD', 'actor': '乙', 'node': '发言'}])
    segrow = ws_read(rfd)
    assert segrow['kind'] == 'section' and segrow['open'] is True \
        and 'drafts' not in segrow, segrow
    feed([{'op': 'draft-delta', 'seg': 'w:wsD', 'key': 'x', 'kind': 'text', 'text': '你'}])
    upd = ws_read(rfd)
    assert upd['ctrl'] == 'row-update' and upd['row']['n'] == segrow['n'], upd
    assert [d['text'] for d in upd['row']['drafts']] == ['你'], upd
    feed([{'op': 'seg-fill', 'seg': 'w:wsD', 'items': [{'kind': 'say', 'text': '你好'}]},
          {'op': 'seg-close', 'seg': 'w:wsD'}])
    upd = ws_read(rfd)
    assert upd['ctrl'] == 'row-update' and 'drafts' not in upd['row'], upd
    # 名字槽随这次 fill 注入（此前空段不带名字）：say 在最后
    assert [i['text'] for i in upd['row']['items']] == ['乙', '你好'], upd
    cd.close()
    c.close()
    # ── print 旁路（2026-09-19 用户拍板「加一路显示」）：环形缓冲 + /prints +
    #    WS 广播/清空 + 旁路代理。放在所有严格 ws_read 序列之后：print 广播
    #    不带 job/视角语义、全体订阅者都收，插进前面会打乱既有的逐帧对账。
    hub2.add_print('p1', 'stdout')
    hub2.add_print('p2', 'stderr')
    with urllib.request.urlopen(base + '/prints?limit=10', timeout=5) as resp:
        pbody = json.load(resp)
    assert [x['text'] for x in pbody['items']] == ['p1', 'p2'], pbody
    assert pbody['items'][1]['stream'] == 'stderr', pbody
    c4, rf4 = ws_connect('job=1&view=stage')
    assert ws_read(rf4)['ctrl'] == 'snapshot'
    hub2.add_print('p3-live', 'stdout')
    pm = ws_read(rf4)
    assert pm['ctrl'] == 'print' and pm['text'] == 'p3-live' \
        and pm['stream'] == 'stdout', pm
    ws_send({'ctrl': 'prints', 'limit': 5}, c4)
    pm = ws_read(rf4)
    assert pm['ctrl'] == 'prints' and \
        [x['text'] for x in pm['items']] == ['p1', 'p2', 'p3-live'], pm
    ws_send({'ctrl': 'prints-clear'}, c4)
    assert ws_read(rf4)['ctrl'] == 'prints-cleared'
    assert hub2.prints_tail() == []
    c4.close()
    # 旁路代理本体：镜像行聚合 + 原流字节级保真（StringIO 当真身）
    _real = io.StringIO()
    _tap = _StdioTap(_real, hub2, 'stdout')
    _tap.write('hello\nwor')
    _tap.write('ld\npartial-no-newline')
    _tap.flush()
    assert _real.getvalue() == 'hello\nworld\npartial-no-newline', repr(_real.getvalue())
    assert [x['text'] for x in hub2.prints_tail()] == \
        ['hello', 'world', 'partial-no-newline']
    _tap.write('{"type": "response", "id": 9}\n')
    assert _real.getvalue().endswith('{"type": "response", "id": 9}\n')  # 原流照写
    assert hub2.prints_tail()[-1]['text'] == 'partial-no-newline'        # 协议线不进镜像
    hub2.stop_server()
    assert not os.path.isfile(os.path.join(tmp, 'hub.json'))   # 干净停机撤自发现件

    # feed 被拒帧回报：非对象/未知 op/缺 row 逐帧给 reason（未知 op 照旧不
    # 处理——向前兼容不破坏，只是让喂方看得见）
    rbad = hub2.feed(1, [{'op': 'row', 'zone': 'inplay', 'kind': 'say',
                          'actor': '甲', 'text': '好帧'},
                         '垃圾帧',
                         {'op': 'mystery'},
                         {'op': 'fill-slot'}])
    assert rbad['appended'] == 1 and len(rbad['failed']) == 3, rbad
    assert [f['reason'] for f in rbad['failed']] == \
        ['frame not an object', 'unknown op: mystery', 'fill-slot needs row object'], rbad

    # 打字块懒清扫：静置超 _LIVE_TTL 的尸块在下次 feed 时收尸（清块不转正）
    hub2.feed(1, [{'op': 'live-start', 'key': 'corpse', 'actor': '甲', 'blockKind': 'text'}])
    assert hub2.live_blocks(1)
    hub2._live[(1, 'corpse')]['act'] = 0   # 造尸：最后活动时刻归零
    hub2.feed(1, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper',
                   'actor': '', 'text': 'tick'}])
    assert hub2.live_blocks(1) == [], hub2.live_blocks(1)

    # 视角词表 & 消毒算法抽查
    assert sanitize_key('我是卧底@甲') == '_6211_662f_5367_5e95_40_7532'
    assert view_filter('actor:甲', {'zone': 'inplay', 'targets': None}) is True
    assert view_filter('stage', {'zone': 'outside'}) is False

    # 引擎事件分诊表：开场→提问扣住→交卷成段（一段一个行号）→失败成段→落幕补投
    pr = EventProjector()
    rows = pr.on_event('flow_start', {'name': '谁是卧底'})
    assert rows[0]['kind'] == 'play_start' and rows[0]['zone'] == 'meta'
    # 台账号随开场行落账（2026-09-29 拍板）：引擎 flow_start 自带 session_id；
    # 无号（旧引擎/裸喂）不落字段，行为同改前。
    rows_sid = EventProjector().on_event('flow_start',
                                         {'name': '谁是卧底', 'session_id': 4460})
    assert rows_sid[0].get('femo_session_id') == 4460, rows_sid
    assert rows[0].get('femo_session_id') is None, rows
    rr_sid = EventProjector().on_event('flow_start',
                                       {'name': '谁是卧底', 'session_id': 4461,
                                        'resumed': True})
    assert rr_sid[0]['kind'] == 'play_resume' \
        and rr_sid[0].get('femo_session_id') == 4461, rr_sid
    # 场次行全视角可见（2026-09-21 用户拍板：所有投影窗都有 FEMO 开始/已跑完/
    # 暂停/继续这类消息）；续跑（桥注 resumed 标）写「继续」而非第二张开场
    assert view_filter('stage', rows[0]) is True
    assert view_filter('actor:甲', rows[0]) is True
    rr = EventProjector().on_event('flow_start', {'name': '谁是卧底', 'resumed': True})
    assert rr[0]['kind'] == 'play_resume' and rr[0]['zone'] == 'meta', rr
    assert view_filter('actor:乙', rr[0]) is True
    rp = EventProjector().on_event('flow_paused', {})
    assert rp[-1]['kind'] == 'play_paused' and rp[-1]['zone'] == 'meta', rp
    assert view_filter('stage', rp[-1]) is True and view_filter('actor:乙', rp[-1]) is True
    re_ = EventProjector().on_event('flow_error', {'error': 'boom'})
    assert re_[-1]['kind'] == 'play_error' and re_[-1]['zone'] == 'meta', re_
    assert view_filter('stage', re_[-1]) is True
    assert view_filter('stage', {'zone': 'outside', 'kind': 'whisper'}) is False  # 戏外仍只进上帝窗

    # 公告节点：notice 独立 kind（2026-09-19 用户拍板：与 showprompt 同款居中
    # 灰字显示，数据面分家显示层才分得开），归属=scope 首席位
    rows = pr.on_event('node_start', {'node_name': 'n0', 'node_type': 'notice',
                                      'scope': ['丙'], 'prompt': '【发牌】给丙'})
    assert rows[0]['kind'] == 'notice' and rows[0]['text'] == '【发牌】给丙', rows
    assert rows[0]['actor'] == '丙' and rows[0]['targets'] == ['丙'], rows

    # 无 showprompt 的台词：ai_request 那拍开块（wait_key 唯一归属）→ 交卷把
    # 台词填进同一块并收口
    frames = pr.on_event('ai_request', {'node_name': 'n1', 'wait_key': 'w1',
                                        'actor_name': '甲', 'scope_info': ['丙']})
    assert pr.briefs['w1'] == {'actor': '甲', 'targets': ['丙'], 'node': 'n1'}
    assert [f['op'] for f in frames] == ['seg-open'], frames
    assert frames[0]['seg'] == 'w:w1' and frames[0]['targets'] == ['丙'], frames[0]
    frames += pr.on_post_speech({'wait_key': 'w1', 'soul': 'jia', 'payload': '我的台词'})
    assert [f['op'] for f in frames] == ['seg-open', 'seg-fill'], frames
    assert [i['kind'] for i in frames[1]['items']] == ['say']
    assert frames[1]['open'] is False and frames[1]['actor'] == '甲'
    r1 = hub2.feed(1, frames)
    assert r1['appended'] == 1 and r1['updated'] == 1 and r1['skipped'] == 0, r1
    r1b = hub2.feed(1, frames)   # 开块 src_seq=seg:<seg>:open 幂等：重放不重账
    assert r1b['appended'] == 0, r1b

    # showprompt 早于 ai_request（时序缓冲）→ 开块那拍把提问**作为容器第一个槽**带上
    # （2026-09-19 用户拍板：「Show prompt 和后续有这个 show prompt 所在节点产生的
    #  内容不能分开，它们应该是在同一个容器里」——一个节点实例 = 一个行号）
    pr.on_event('context_ready', {'node_name': 'n2', 'showprompt': '请发言'})
    frames = pr.on_event('ai_request', {'node_name': 'n2', 'wait_key': 'w2', 'actor_name': '乙'})
    assert [f.get('op') for f in frames] == ['seg-open'], frames
    assert [i['text'] for i in frames[0]['items']] == ['请发言'], frames[0]
    assert hub2.feed(1, frames)['appended'] == 1     # 旁白与容器同行：只有一个号
    frames = pr.on_post_speech({'wait_key': 'w2', 'payload': '乙的台词'})
    assert [i['text'] for i in frames[0]['items']] == ['乙的台词']
    assert hub2.feed(1, frames)['updated'] == 1      # 台词填进同一块（不新增行）

    # 人类节点：human_wait 那拍开块——showprompt（演出提示）与 prompt（本节点
    # 指令）**同容器各一个槽**。kind=真实类别（2026-09-19 用户拍板「来的什么
    # 写什么」）：prompt 槽存引擎原始字段，「等待你的回应：」包装话归显示层。
    frames = pr.on_event('human_wait', {'wait_key': 'w3', 'node_name': 'n3',
                                        'scope': ['丙'], 'prompt': '投票',
                                        'showprompt': '轮到丙投票了'})
    assert [f.get('op') for f in frames] == ['seg-open'], frames
    assert frames[0]['actor'] == '丙', frames[0]
    assert [i['text'] for i in frames[0]['items']] == ['轮到丙投票了', '投票'], frames[0]
    assert [i['kind'] for i in frames[0]['items']] == ['showprompt', 'prompt'], frames[0]
    frames = pr.on_human_input({'wait_key': 'w3', 'body': {'reply': '投甲'}})
    assert [i['text'] for i in frames[0]['items']] == ['投甲'], frames
    assert frames[0]['open'] is False

    # 无 showprompt 的人类节点：只有 prompt 指令那一条（没出现的不写）
    frames = pr.on_event('human_wait', {'wait_key': 'w3b', 'node_name': 'n3b',
                                        'scope': ['丙'], 'prompt': '再说一句'})
    assert [i['text'] for i in frames[0]['items']] == ['再说一句'], frames

    # 失败收口：块里已有段首旁白 → 补一条失败行（kind=fail）并收口
    pr.on_event('context_ready', {'node_name': 'n4', 'showprompt': '轮到丁'})
    pr.on_event('ai_request', {'node_name': 'n4', 'wait_key': 'w4', 'actor_name': '丁'})
    frames = pr.on_actor_failed({'wait_key': 'w4', 'kind': 'executor_error', 'detail': '超时'})
    assert [i['kind'] for i in frames[0]['items']] == ['fail'], frames
    assert '超时' in frames[0]['items'][0]['text'] and frames[0]['open'] is False

    # 收场补投：没等到交卷的孤提问不丢（孤提问仍是独立行）；未收口的段一并收口
    pr.on_event('context_ready', {'node_name': 'n5', 'showprompt': '孤儿提问'})
    rows = pr.on_event('flow_done', {'summary': '完'})
    plain = [r for r in rows if not r.get('op')]
    assert [r['kind'] for r in plain] == ['showprompt', 'play_end'], rows
    assert plain[0]['text'] == '孤儿提问'
    assert any(r.get('op') == 'seg-fill' and r.get('open') is False for r in rows), rows
    assert pr.on_event('flow_error', {'error': 'boom'})[0]['zone'] == 'meta'

    # CoT/工具落地（body.steps 引擎契约）全填在同一个段里：cot→tool→result→cot→say
    frames = pr.on_event('ai_request', {'node_name': 'n6', 'wait_key': 'w6', 'actor_name': '戊'})
    frames += pr.on_post_speech({'wait_key': 'w6', 'payload': '最终台词', 'body': {
        'output': '最终台词',
        'steps': [
            {'step': 0, 'cot': '想一想', 'reply': '过程话',
             'tool_calls': [{'name': 'search', 'arguments': '{"q":"x"}'}],
             'tool_results': ['结果A']},
            {'step': 1, 'cot': '再想想', 'reply': '最终台词',
             'tool_calls': [], 'tool_results': []},
        ]}})
    items = frames[1]['items']
    assert [i['kind'] for i in items] == \
        ['cot', 'say', 'tool', 'tool_result', 'cot', 'say'], items
    assert items[0]['text'] == '想一想'
    assert items[1]['text'] == '过程话'            # 中间轮发言上墙
    assert items[2]['toolCall'] == {'name': 'search', 'arguments': '{"q":"x"}'}
    # tool_result 槽唯一形状（2026-09-21）：text 恒空 + toolResult{node,output}，
    # 与 god-mirror 织入路径同款——text 载文本的旧形状已废，渲染端只兜底不依赖。
    assert items[3].get('text') == '' and items[3].get('toolResult') == \
        {'node': 'search', 'output': '结果A'}, items
    assert items[4]['text'] == '再想想'
    assert items[5]['text'] == '最终台词'
    assert frames[1]['actor'] == '戊' and frames[1]['open'] is False
    r6 = hub2.feed(1, frames)
    assert r6['appended'] == 1, r6

    # 视角清单（角色视角窗数据管理面）：god/stage + 账本收出的全部角色。
    # 【刀1】视角宿主格剖段键——本场景投影器无 host=裸段键=裸视角 id
    # （产线桥恒 set_host+投递事实，段键带归属格；带格正例见 job 77 的 Eve）
    vs = hub2.views(1)
    ids = [v['id'] for v in vs['views']]
    assert ids[:2] == ['god', 'stage'], ids
    for want in ('actor:甲', 'actor:乙', 'actor:丙', 'actor:戊'):
        assert want in ids, (want, ids)
    assert hub2.views(None)['job'] == 1     # 「最新」回落
    view_rows = hub2.snapshot(1, 'actor:丙')['rows']
    # 2026-09-21 场次行全视角：角色窗=inplay+meta（outside 仍不可见）
    assert all(r['zone'] in ('inplay', 'meta') for r in view_rows)

    # 开演花名册（剧本 actors 定义区）：开演即有全部角色，cast.json 重启不丢
    hub2.set_cast(2, ['@猫猫', '@小机', '@Eve', '@猫猫'])   # 重复名去重
    ids2 = [v['id'] for v in hub2.views(2)['views']]
    assert ids2[:2] == ['god', 'stage'] and 'actor:@猫猫' in ids2
    assert ids2.count('actor:@猫猫') == 1
    assert os.path.isfile(os.path.join(tmp, '2', 'cast.json'))
    hub4 = ProjectionHub(data_dir=tmp)                       # 冷启动：cast.json 恢复
    assert 'actor:@Eve' in [v['id'] for v in hub4.views(2)['views']]
    # 花名册与账本出场合并去重（同一角色两种来源只出现一次）：【刀1】行不带
    # host 后甲的出场是裸条目，花名册的裸甲与它同键吸收成一条；新人没上过场，
    # 留在无宿主格（带宿主格吸收正例见下方 hubv 的段键场景）
    hub2.set_cast(1, ['甲', '新人'])
    ids1 = [v['id'] for v in hub2.views(1)['views']]
    assert 'actor:甲' in ids1 and 'actor:新人' in ids1, ids1
    assert sum(1 for v in hub2.views(1)['views'] if _view_actor(v['id']) == '甲') == 1
    # 花名册（无 host）× 实际出场（带 host）并档（2026-09-20 用户实锤：视角
    # 菜单 dsh 组与未标来源组整列重复——身份键 (host,基名) 拦不住同一角色进
    # 两桶，而 view_filter 只按基形匹配，两桶本就是同一个窗）：同基形两边都有
    # 时只留带 host 条目；花名册独有的角色保留在未标来源（开演即有不丢）
    hubv = ProjectionHub(data_dir=tmp)
    hubv.set_cast(9, ['@Eve', '@小机', '@影子'])
    hubv.feed(9, [{'op': 'row', 'zone': 'inplay', 'kind': 'section',
                   'actor': '@Eve', 'text': '',
                   'items': [{'kind': 'say', 'text': '词'}],
                   'targets': [], 'src_seq': 's9#1',
                   # 【刀1】行不带 host 章：出场归属剖段键（产线段键由桥带归属）
                   'seg': 'w:dsh:s9'}], source='dsh')
    idsv = [v['id'] for v in hubv.views(9)['views']]
    assert 'actor:dsh:@Eve' in idsv and 'actor:@Eve' not in idsv, idsv
    assert 'actor:@小机' in idsv and 'actor:@影子' in idsv, idsv   # 没上过场：留在未标来源
    assert sum(1 for v in hubv.views(9)['views'] if _view_actor(v['id']) == '@Eve') == 1

    # 名字变体归一（2026-09-19 用户实锤下拉重复）：@X（Y） 与 @X 同角色一条
    hub2.set_cast(3, ['@Eve', '@小机'])
    hub2.feed(3, [{'op': 'row', 'zone': 'inplay', 'kind': 'section',
                   'actor': '@Eve（Eve）', 'text': '',
                   'items': [{'kind': 'say', 'text': '词'}],
                   'targets': ['@Eve（Eve）'], 'src_seq': 's3#1'}])
    assert [v['name'] for v in hub2.views(3)['views']][2:] == ['@Eve（Eve）', '@小机']
    v3 = {v['name']: v['id'] for v in hub2.views(3)['views']}
    assert v3['@Eve（Eve）'] == 'actor:@Eve', v3   # id=基形稳定键：显示名再长不换 id
    snapv = hub2.snapshot(3, 'actor:@Eve')['rows']
    assert len(snapv) == 1 and snapv[0]['actor'] == '@Eve（Eve）'   # 基形匹配命中
    pr2 = EventProjector()
    pr2.on_event('flow_start', {'name': 'X', 'actors': ['@Eve', '@小机']})
    pr2.on_event('ai_request', {'node_name': 'n9', 'wait_key': 'w9',
                                'actor_name': '@Eve（Eve）',
                                'blocks': {'showprompt': '你好'}})
    assert pr2.briefs['w9']['actor'] == '@Eve（Eve）'   # 执行者名保持引擎原样

    # 显示名映射（ai_request 现场登记）：裸名数据也能在菜单里显示带括号长名；
    # id 不随显示名变（稳定键）——前端选中态跨轮有效
    ids_disp = [v['id'] for v in hub2.views(2)['views']]
    hub2.remember_display(2, '@Eve（Eve）')
    names2 = [v['name'] for v in hub2.views(2)['views']]
    assert '@Eve（Eve）' in names2, names2
    assert [v['id'] for v in hub2.views(2)['views']] == ids_disp, (ids_disp, names2)
    hub5 = ProjectionHub(data_dir=tmp)                    # 冷启动：display 从 cast.json 恢复
    assert '@Eve（Eve）' in [v['name'] for v in hub5.views(2)['views']]

    # par 同名节点串段修复（2026-09-19 实测 [看牌] 三分支同名）：
    # 段的归属靠 wait_key（唯一）——同名分支各开各的块，showprompt 各归各家
    pr.on_event('context_ready', {'node_name': '[看牌]', 'actor_name': '乙',
                                  'showprompt': '"【发牌】给乙。"'})
    fA = pr.on_event('ai_request', {'node_name': '[看牌]', 'wait_key': 'wA', 'actor_name': '甲',
                                    'blocks': {'showprompt': '"【发牌】给甲。"'}})
    pr.on_event('context_ready', {'node_name': '[看牌]', 'actor_name': '乙',
                                  'showprompt': '"【发牌】给乙。"'})
    fB = pr.on_event('ai_request', {'node_name': '[看牌]', 'wait_key': 'wB', 'actor_name': '乙',
                                    'blocks': {'showprompt': '"【发牌】给乙。"'}})
    assert fA[0]['items'][0]['text'] == '【发牌】给甲。' and fA[0]['seg'] == 'w:wA', fA
    assert fB[0]['items'][0]['text'] == '【发牌】给乙。' and fB[0]['seg'] == 'w:wB', fB
    rows_a = pr.on_post_speech({'wait_key': 'wA', 'payload': '甲收到'})
    rows_b = pr.on_post_speech({'wait_key': 'wB', 'payload': '乙收到'})
    assert rows_a[0]['seg'] == 'w:wA' and rows_a[0]['items'][0]['text'] == '甲收到', rows_a
    assert rows_b[0]['seg'] == 'w:wB' and rows_b[0]['items'][0]['text'] == '乙收到', rows_b

    # served 防重复扣账（j1810 实锤：晚到 context_ready 反查到已交卷的 wait_key
    # 再扣，落幕 flush 冒出无主 showprompt）——交卷后同节点晚到兜底绝不再扣
    pr.on_event('ai_request', {'node_name': '[看牌]', 'wait_key': 'wA2', 'actor_name': '丙',
                               'blocks': {'showprompt': '"【发牌】给丙。"'}})
    pr.on_post_speech({'wait_key': 'wA2', 'payload': '丙收到'})
    pr.on_event('context_ready', {'node_name': '[看牌]', 'actor_name': '丙',
                                  'showprompt': '"【发牌】给丙。"'})   # 晚到：node_wait 反查到 wA2（已 served）
    rows = pr.on_event('flow_done', {'summary': '收'})
    assert all('【发牌】给丙' not in str(r.get('text')) for r in rows), rows   # 不冒无主提问
    assert rows[-1]['kind'] == 'play_end'

    # 重试反馈随段（2026-09-19 用户拍板：节点内重试与回答同一个 Block）：
    # 新语义：node_retry 直接填进本节点的块 → 交卷再填台词并收口
    pr2b = EventProjector()
    fR = pr2b.on_event('ai_request', {'node_name': '[PK申辩]', 'wait_key': 'wR',
                                      'actor_name': '@Eve（Eve）',
                                      'blocks': {'showprompt': '请申辩'}})
    assert fR[0]['items'][0]['text'] == '请申辩' and fR[0]['seg'] == 'w:wR', fR
    fb = '剧本错误（agent桶）@ 节点 [PK申辩]（@Eve（Eve））：变量越界（第 1/2 次反馈）'
    fR2 = pr2b.on_event('node_retry', {'wait_key': 'wR', 'feedback': fb})
    assert fR2[0]['op'] == 'seg-fill' and fR2[0]['items'][0]['text'] == fb, fR2
    assert fR2[0]['items'][0]['kind'] == 'retry', fR2   # 重试反馈自己的 kind
    rows = pr2b.on_post_speech({'wait_key': 'wR', 'payload': '我改，重新申辩'})
    assert [i['kind'] for i in rows[0]['items']] == ['say'], rows[0]['items']
    # agent_error 的 notify_author 与 node_retry 同文案：不再单发（防双份）
    assert pr2b.on_event('notify_author', {'severity': 'agent_error', 'message': fb}) == []
    # warning 照旧独立戏外行
    rows = pr2b.on_event('notify_author', {'severity': 'warning', 'message': '提醒'})
    assert rows[0]['zone'] == 'outside' and rows[0]['text'] == '提醒'
    # 失败段也带反馈：重试反馈先填进块，失败行再填一条并收口
    pr2b.on_event('ai_request', {'node_name': '[PK申辩]', 'wait_key': 'wF',
                                 'actor_name': '@Eve（Eve）',
                                 'blocks': {'showprompt': '再申辩'}})
    pr2b.on_event('node_retry', {'wait_key': 'wF', 'feedback': '第2次反馈'})
    rows = pr2b.on_actor_failed({'wait_key': 'wF', 'kind': 'executor_error', 'detail': '超限'})
    assert [i['kind'] for i in rows[0]['items']] == ['fail'], rows[0]['items']  # 帧是增量
    assert rows[0]['items'][0]['text'].startswith('（节点执行失败') and rows[0]['open'] is False
    # 没等到交卷的反馈：新语义下 node_retry 已直接填进本节点的块（不靠落幕补投），
    # 落幕时未收口的段统一收口（页面撤「正在…」）
    pr2b.on_event('ai_request', {'node_name': '[散场]', 'wait_key': 'wG', 'actor_name': '戊'})
    fG = pr2b.on_event('node_retry', {'wait_key': 'wG', 'feedback': '孤反馈'})
    assert fG[0]['op'] == 'seg-fill' and fG[0]['items'][0]['text'] == '孤反馈', fG
    rows = pr2b.on_event('flow_done', {'summary': '完'})
    assert any(r.get('op') == 'seg-fill' and r.get('seg') == 'w:wG'
               and r.get('open') is False for r in rows), rows
    assert rows[-1]['kind'] == 'play_end'

    # 槽序与名字槽（2026-09-19 用户拍板：hub 是排序唯一权威，宿主无脑照抄）——
    # 头部三件套 showprompt→prompt→名字由 hub 规整注入，其余槽按发生序跟后
    pr3 = EventProjector()
    fS = pr3.on_event('ai_request', {'node_name': 'nS', 'wait_key': 'wS',
                                     'actor_name': '甲',
                                     'blocks': {'showprompt': '演出提示',
                                                'prompt': '甲的指令'}})
    assert [i['kind'] for i in fS[0]['items']] == ['showprompt', 'prompt'], fS
    fS += pr3.on_post_speech({'wait_key': 'wS', 'payload': '台词', 'body': {'steps': []}})
    assert hub2.feed(1, fS)['appended'] == 1
    sec = [r for r in hub2.snapshot(1, 'god')['rows'] if r.get('seg') == 'w:wS'][0]
    assert [i['kind'] for i in sec['items']] == \
        ['showprompt', 'name', 'say'], sec['items']   # prompt 槽被显示策略扣下
    # 槽序以账本为准（显示策略只剪出料）：showprompt→prompt→name→say
    repS = [r for r in hub2.replay(1) if r.get('seg') == 'w:wS'][0]
    assert [i['kind'] for i in repS['items']] == \
        ['showprompt', 'prompt', 'name', 'say'], repS['items']
    assert repS['items'][2] == {'kind': 'name', 'text': '甲'}, repS['items']
    assert sec['items'][0]['text'] == '演出提示', sec['items']
    # 晚到的兜底 showprompt 归位段首（不插进内容中间）；全段同题去重防重放
    hub2.feed(1, [{'op': 'seg-fill', 'seg': 'w:wS',
                   'items': [{'kind': 'showprompt', 'text': '迟到的提示'}]}])
    sec = [r for r in hub2.snapshot(1, 'god')['rows'] if r.get('seg') == 'w:wS'][0]
    assert [i['kind'] for i in sec['items']] == \
        ['showprompt', 'showprompt', 'name', 'say'], sec['items']
    rD = hub2.feed(1, [{'op': 'seg-fill', 'seg': 'w:wS',
                        'items': [{'kind': 'showprompt', 'text': '迟到的提示'}]}])
    assert rD['updated'] == 0, rD   # 头部槽全段查重：重放不双份
    # 名字槽归 hub 独有：宿主偷喂的 name 槽剥掉，按行上 actor 重插
    hub2.feed(1, [{'op': 'row', 'zone': 'inplay', 'kind': 'section', 'actor': '乙',
                   'text': '', 'items': [{'kind': 'name', 'text': '假的'},
                                         {'kind': 'cot', 'text': '想'}],
                   'src_seq': 's9#1'}])
    row9 = hub2.snapshot(1, 'god')['rows'][-1]
    assert row9['src_seq'] == 's9#1' and [i['kind'] for i in row9['items']] == \
        ['name', 'cot'], row9
    assert row9['items'][0]['text'] == '乙', row9
    # actor 为空：不插名字槽（绝不渲染空名字）
    hub2.feed(1, [{'op': 'row', 'zone': 'inplay', 'kind': 'section', 'actor': '',
                   'text': '', 'items': [{'kind': 'say', 'text': '无名'}],
                   'src_seq': 's9#2'}])
    row9b = hub2.snapshot(1, 'god')['rows'][-1]
    assert [i['kind'] for i in row9b['items']] == ['say'], row9b
    # actor 晚到：seg-fill 补 actor 那拍名字槽原位补上（槽序仍由 hub 定）
    hub2.feed(1, [{'op': 'seg-open', 'seg': 'w:wL', 'zone': 'inplay', 'actor': '',
                   'items': []}])
    hub2.feed(1, [{'op': 'seg-fill', 'seg': 'w:wL', 'actor': '丙',
                   'items': [{'kind': 'say', 'text': '话'}]}])
    rowL = [r for r in hub2.snapshot(1, 'god')['rows'] if r.get('seg') == 'w:wL'][0]
    assert [i['kind'] for i in rowL['items']] == ['name', 'say'], rowL
    assert rowL['items'][0] == {'kind': 'name', 'text': '丙'}, rowL

    # 显示策略（2026-09-20 用户拍板：全局唯一显示规则，hub 出料口执行）——
    # VIEW_POLICY 常量矩阵（改一处=改所有宿主）；只管过程类槽，台词/名字不受管；
    # 账本原文不动，剪的只是各视角窗的出料拷贝。
    assert set(VIEW_POLICY) == {'god', 'stage', 'main', 'human', 'ai'}
    assert all(set(v) == set(_VIEW_COLS) and all(isinstance(x, bool) for x in v.values())
               for v in VIEW_POLICY.values())

    def seg_kinds(view, segkey):
        for r in hub2.snapshot(1, view)['rows']:
            if r.get('seg') == segkey:
                return [i['kind'] for i in r.get('items') or []]
        return None

    prP = EventProjector()
    prP.set_waiting_sink(hub2.set_waiting)   # 等待镜像进 hub（⑭ 口径：prompt 跟席位在册走）
    # 甲的 AI 段（role=ai）：演出提示+指令+react+台词
    fP = prP.on_event('ai_request', {'node_name': 'nP', 'wait_key': 'wP',
                                     'actor_name': '甲',
                                     'blocks': {'showprompt': '甲的演出提示',
                                                'prompt': '甲的指令'}})
    fP += prP.on_post_speech({'wait_key': 'wP', 'payload': '甲的台词', 'body': {
        'steps': [{'cot': '甲想', 'tool_calls': [{'name': 't', 'arguments': '{}'}],
                   'tool_results': ['果']}]}})
    assert hub2.feed(1, fP)['appended'] == 1
    # 猫猫的人类段（role=human）：演出提示+指令+台词。scope 带上甲——让甲的
    # 角色窗也能见到这行，专测「ai 类视角扣人类 prompt」（否则 targets 老规矩
    # 先裁，策略层测不到）
    fH = prP.on_event('human_wait', {'node_name': 'nH', 'wait_key': 'wH',
                                     'actor_name': '猫猫', 'scope': ['猫猫', '甲'],
                                     'prompt': '请投票', 'showprompt': '轮到猫猫'})
    assert hub2.feed(1, fH)['appended'] == 1
    assert hub2.feed(1, prP.on_human_input({'wait_key': 'wH', 'body': {'reply': '投甲'}}))['updated'] == 1
    # 主 Agent 段（role=main，戏外直喂）
    hub2.feed(1, [{'op': 'row', 'zone': 'outside', 'kind': 'section', 'actor': '导演',
                   'text': '', 'role': 'main', 'seg': 'm:P',
                   'items': [{'kind': 'cot', 'text': '导演想'}, {'kind': 'say', 'text': '导演说'}],
                   'src_seq': 'sP#1'}])

    # 2026-09-20 二次定案：AI 的 prompt 全视角不显示，showprompt 永远显示；
    # 人类 prompt 只进上帝窗与人类角色窗。2026-10-03 三次定稿（用户口径）：
    # 人类 prompt 再加「等待席在册」闸——正在输入才显示，输入完就不用了
    # （stage 等待中同样放行：输入席在 stage 也亮）；收麦即扣，下面收麦后验。
    visP = ['showprompt', 'name', 'cot', 'tool', 'tool_result', 'say']
    # 上帝视角：showprompt 显示、AI prompt 扣下、人类 prompt 显示（等待中）
    assert seg_kinds('god', 'w:wP') == visP
    assert seg_kinds('god', 'w:wH') == ['showprompt', 'prompt', 'name', 'say']
    assert seg_kinds('god', 'm:P') == ['name', 'cot', 'say']
    # 戏内视角：AI 段 prompt 扣、showprompt 照显示；人类段等待中 prompt 同样在
    assert seg_kinds('stage', 'w:wP') == visP
    assert seg_kinds('stage', 'w:wH') == ['showprompt', 'prompt', 'name', 'say']
    # AI 角色窗（甲）：自己的段 prompt 扣、showprompt 照显示；人类段扣 prompt
    assert seg_kinds('actor:甲', 'w:wP') == visP
    assert seg_kinds('actor:甲', 'w:wH') == ['showprompt', 'name', 'say']
    # 人类角色窗（猫猫，human 类）：自己的题看得见（等待中）
    assert seg_kinds('actor:猫猫', 'w:wH') == ['showprompt', 'prompt', 'name', 'say']
    # 收麦（human_done 全清同款）→ prompt 全视角扣下：「输入完就不用了」；
    # showprompt 照在。此后各视角断言都在收麦态下跑（历史段的 prompt 不可见）。
    hub2.set_waiting(None)   # 全清（None=落幕收麦同款；空 dict 是无键 no-op）
    assert seg_kinds('god', 'w:wH') == ['showprompt', 'name', 'say']
    assert seg_kinds('stage', 'w:wH') == ['showprompt', 'name', 'say']
    assert seg_kinds('actor:猫猫', 'w:wH') == ['showprompt', 'name', 'say']
    # 主 Agent 角色窗（导演，main 类）：main_* 列全 True → 戏内主段照显示；
    # 戏外主段按 zone 老规矩不进角色窗（策略不越权，可见性规矩独立）
    hub2.feed(1, [{'op': 'row', 'zone': 'inplay', 'kind': 'section', 'actor': '导演',
                   'text': '', 'role': 'main', 'seg': 'm:P2', 'targets': ['导演'],
                   'items': [{'kind': 'cot', 'text': '戏内主段想'}],
                   'src_seq': 'sP#2'}])
    assert seg_kinds('actor:导演', 'm:P2') == ['name', 'cot']
    assert seg_kinds('actor:导演', 'm:P') is None
    # 账本原文不动：replay（档案读法）永远全量
    repH = [r for r in hub2.replay(1) if r.get('seg') == 'w:wH'][0]
    assert [i['kind'] for i in repH['items']] == ['showprompt', 'prompt', 'name', 'say']

    # 订阅队列上限（消费端卡死防线）：塞满后广播不再入队、不炸不堵——真实
    # 场景由 _broadcast 断连收场（ws 非 None），重连有快照不丢历史
    small = _Sub(1, 'god', maxsize=2)
    hub2._subs.add(small)
    rfull = hub2.feed(1, [{'op': 'row', 'zone': 'inplay', 'kind': 'say',
                           'actor': '甲', 'text': 'a'},
                          {'op': 'row', 'zone': 'inplay', 'kind': 'say',
                           'actor': '甲', 'text': 'b'},
                          {'op': 'row', 'zone': 'inplay', 'kind': 'say',
                           'actor': '甲', 'text': 'c'}])
    assert rfull['appended'] == 3 and small.q.qsize() == 2, (rfull, small.q.qsize())
    hub2._subs.discard(small)

    # /jobs 轻量盘点（评审外自查缺口）：未装载的场只扫盘不物化——清单与
    # 「最新」指针都不再把全历史装进内存
    hub8 = ProjectionHub(data_dir=tmp)
    jl = hub8.jobs()
    jrows = {x['job_id']: x['rows'] for x in jl}
    assert sorted(jrows) == [1, 2, 3, 4, 9] and jrows[2] == 0 and jrows[3] == 1 \
        and jrows[4] == 5 and jrows[9] == 1, jrows          # 9=花名册×出场并档测试场
    assert not hub8._books, hub8._books.keys()          # 清单没把账本装进来
    assert hub8.latest_job() == 1 and not hub8._books   # 「最新」同样只盘点
                                                        #（末行时刻最新的是 j1——队列上限测试刚喂过）

    # 冷账本逐出：TTL 临时调小，feed 心跳顺手把没人摸的 book 卸下（正在喂的本场除外）
    global _BOOK_TTL
    hub8._books[9] = _JobBook(9, tmp)
    hub8._books[9].touched = 0.0            # 造「一小时没人摸」
    hub8._books[4] = _JobBook(4, tmp)
    hub8._books[4].touched = 0.0            # 下一拍的本场：同样陈旧但不该被逐
    _BOOK_TTL, ttl_save = 1, _BOOK_TTL
    try:
        hub8.feed(4, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper',
                       'actor': '', 'text': 'heartbeat'}])
    finally:
        _BOOK_TTL = ttl_save
    assert 9 not in hub8._books and 4 in hub8._books, hub8._books.keys()

    # 盘点缓存失效：追加后 mtime 变，重扫盘行数跟得上；依旧不物化
    hub9 = ProjectionHub(data_dir=tmp)
    jrows9 = {x['job_id']: x['rows'] for x in hub9.jobs()}
    assert jrows9[4] == 6 and not hub9._books, jrows9

    # 整场回放（2026-09-29 拍板）：台账号随开场行入账，清单/拼接快照/视角
    # 条目三位一体。多 job 共一场：两个 job 各自开演都指向同一台账场次。
    hubcs = ProjectionHub(data_dir=tmp)
    pj = EventProjector()
    hubcs.feed(71, pj.on_event('flow_start', {'name': '第一幕', 'session_id': 5001}))
    hubcs.feed(71, [{'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '甲',
                     'text': '第一幕台词', 'src_seq': 's71:1'}])
    hubcs.feed(72, pj.on_event('flow_start', {'name': '第二幕', 'session_id': 5001}))
    hubcs.feed(72, [{'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '乙',
                     'text': '第二幕台词', 'src_seq': 's72:1'}])
    hubcs.feed(73, pj.on_event('flow_start', {'name': '独立一场', 'session_id': 5002}))
    # 时序差：feed 的 t 由 hub 分配（毫秒级），同拍落账的场次排序不稳定；
    # 补一行让 5002 确实更新（真实场景各场次活动时间天然不同）。
    time.sleep(0.01)
    hubcs.feed(73, [{'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '丙',
                     'text': '独立场台词', 'src_seq': 's73:1'}])
    # 无号的场（旧账形状：裸喂行）不出清单——自然边界非错误
    hubcs.feed(74, [{'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '丙',
                     'text': '无号旧账', 'src_seq': 's74:1'}])
    cs = hubcs.chronica_sessions()
    assert [e['session'] for e in cs] == [5002, 5001], cs   # 最近活动降序
    e5001 = [e for e in cs if e['session'] == 5001][0]
    assert e5001['jobs'] == [71, 72], e5001                  # job 号升序=开演顺序
    snap = hubcs.snapshot_chronica(5001)
    kinds = [(r.get('kind'), r.get('text')) for r in snap['rows']]
    # 依次拼接：两场各自的 play_start 是天然章节头
    assert kinds == [('play_start', '第一幕'), ('say', '第一幕台词'),
                     ('play_start', '第二幕'), ('say', '第二幕台词')], kinds
    assert snap['jobs'] == [71, 72] and snap['chronica'] == 5001, snap
    # stage 视角同尺拼接（视角过滤逐块照常）；无号场次查询 → 空结果非报错
    snap_st = hubcs.snapshot_chronica(5001, view='stage')
    assert [r.get('text') for r in snap_st['rows']].count('第一幕台词') == 1
    assert hubcs.snapshot_chronica(9999)['rows'] == []
    # 视角清单：有号场次出「整场回放」条目，无号场次不出
    v71 = hubcs.views(71)['views']
    assert any(x.get('id') == 'chronica:5001' for x in v71), v71
    v74 = hubcs.views(74)['views']
    assert not any(str(x.get('id', '')).startswith('chronica:') for x in v74), v74
    # 首行扫描器：只认首行 play_start/play_resume 的号；无号→None
    assert _session_of_job(os.path.join(hubcs.dir_path, '71',
                                        'journal.jsonl')) == 5001
    assert _session_of_job(os.path.join(hubcs.dir_path, '74',
                                        'journal.jsonl')) is None

    # 跨 Session 过滤（2026-09-19 用户拍板：只投影当前 Job 所在的主 Session）：
    # 别的 dsh 会话喂来的戏外行（src_seq=main:<sid>:…）不落账；本场的照收；
    # 桥喂的戏内行不带 main: 前缀，不受影响；owner 未登记则放行（老行为）。
    # 【2026-09-20 会话账本】owner 已登记时，本场戏外行**改道**会话账本
    # （job 账本里的 outside 行唯一读者是 god，god 读法已整体迁去会话账本）。
    hubx = ProjectionHub(data_dir=tmp)
    hubx.set_owner(11, 'session-own')
    res = hubx.feed(11, [
        {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户',
         'text': '本场悄悄话', 'src_seq': 'main:session-own:1'},
        {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户',
         'text': '别场悄悄话', 'src_seq': 'main:session-other:2'},
        {'op': 'row', 'zone': 'inplay', 'kind': 'say', 'actor': '甲',
         'text': '戏内台词', 'src_seq': 'speech:w9'},
        {'op': 'fill-slot', 'row': {'zone': 'outside', 'kind': 'section',
                                    'actor': '导演', 'text': '', 'items': [],
                                    'slot': 1,
                                    'src_seq': 'main:session-other:turn3'}},
    ])
    # 两条别场（row + fill-slot 回话）被挡在账本外；本场悄悄话改道会话账本
    # （织入成功计 appended）+ 戏内台词照旧进 job 账本，共 2 条入账。
    assert res['appended'] == 2 and res['skipped'] == 2, res
    assert hubx.has_owner(11) is True and hubx.has_owner(12) is False
    texts = [r.get('text') for r in hubx.snapshot(11, 'god')['rows']]
    assert texts == ['戏内台词'], texts
    stexts = [r.get('text') for r in hubx.snapshot_session(':session-own')['rows']]
    # 会话账本：本场悄悄话（改道）+ 戏内台词（织入）按时序都在，均带 job_id 出处标
    assert stexts == ['本场悄悄话', '戏内台词'], stexts
    srows = hubx.snapshot_session(':session-own')['rows']
    assert all(r.get('job_id') == 11 for r in srows) \
        and srows[0]['zone'] == 'outside' and srows[1]['zone'] == 'inplay', srows
    # 冷启动（新实例从 cast.json 恢复 owner）同样拦得住
    huby = ProjectionHub(data_dir=tmp)
    res = huby.feed(11, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper',
                          'actor': '用户', 'text': '别场又来',
                          'src_seq': 'main:session-other:9'}])
    assert res['appended'] == 0 and res['skipped'] == 1, res
    # owner 未登记（老档案/裸跑）：放行，绝不误杀
    hubz = ProjectionHub(data_dir=tmp)
    res = hubz.feed(12, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper',
                          'actor': '用户', 'text': '未知场',
                          'src_seq': 'main:session-x:3'}])
    assert res['appended'] == 1 and res['skipped'] == 0, res

    # 读侧过滤：owner 登记前就落账的历史混入行，登记后不再投给页面（账本不动）
    hubw = ProjectionHub(data_dir=tmp)
    hubw.feed(13, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户',
                    'text': '历史混入', 'src_seq': 'main:session-late:5'},
                   {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户',
                    'text': '历史本场', 'src_seq': 'main:session-here:6'}])
    assert len(hubw.snapshot(13, 'god')['rows']) == 2     # 未登记 owner：都看得见
    hubw.set_owner(13, 'session-here')
    left = [r['text'] for r in hubw.snapshot(13, 'god')['rows']]
    assert left == ['历史本场'], left
    assert len(hubw.replay(13)) == 2                     # 账本原文未动（不删数据）

    # 段生命周期（2026-09-19 用户拍板：进节点即开块、有啥就往里填）：
    # 开块落在 ai_request / human_wait（带 wait_key，唯一归属——par 同名节点也不
    # 串；node_start 不带 wait_key，不参与段）→ 段首旁白/提问随块同批落账 →
    # 交卷往里填内容并收口；全程只有一行（原位改写），行号不重排。
    hubs = ProjectionHub(data_dir=tmp)
    pr3 = EventProjector()
    assert pr3.on_event('node_start', {'node_name': 'n1', 'node_type': 'ai',
                                       'scope': ['甲']}) == []          # 不开块
    assert pr3.on_event('context_ready', {'node_name': 'n1',
                                          'showprompt': '请发言'}) == []  # 先扣住
    frames = pr3.on_event('ai_request', {'node_name': 'n1', 'wait_key': 'w201',
                                         'actor_name': '甲', 'scope_info': ['甲'],
                                         'blocks': {'showprompt': '请发言'}})
    assert [f.get('op') for f in frames] == ['seg-open'], frames
    assert frames[0]['items'][0]['text'] == '请发言' and frames[0]['seg'] == 'w:w201', frames
    assert frames[0]['actor'] == '甲', frames[0]
    res = hubs.feed(21, frames)
    rows = hubs.snapshot(21, 'god')['rows']
    # 旁白与容器同一个行号（2026-09-19 用户拍板：showprompt 与节点内容不分开）
    assert [r['n'] for r in rows] == [1], rows
    assert rows[0]['open'] is True and rows[0]['actor'] == '甲', rows[0]
    assert rows[0]['kind'] == 'section' and rows[0]['items'][0]['text'] == '请发言', rows[0]
    # 交卷：内容原位长进同一行（不新增行），收口卸 open
    hubs.feed(21, pr3.on_post_speech({'wait_key': 'w201', 'payload': '我说',
                                      'body': {'steps': [{'cot': '想想', 'reply': 'x'}]}}))
    rows = hubs.snapshot(21, 'god')['rows']
    # 旁白 + cot + 台词全在**同一行**（容器），收口只是卸掉 open
    assert [r['n'] for r in rows] == [1], rows
    assert rows[0].get('open') is None, rows[0]
    assert [i['kind'] for i in rows[0]['items']] == \
        ['showprompt', 'name', 'cot', 'say'], rows[0]['items']
    assert rows[0]['items'][0]['text'] == '请发言', rows[0]['items'][0]
    with open(os.path.join(tmp, '21', 'journal.jsonl'), encoding='utf-8') as f:
        assert len([x for x in f.read().splitlines() if x.strip()]) == 1   # 一场一节点一行
    # 人类节点同构：human_wait 那拍开块（席位名开块即有）——旁白与等待提示同容器
    pr4 = EventProjector()
    f4 = pr4.on_event('human_wait', {'node_name': 'n2', 'wait_key': 'w202',
                                     'scope': ['乙'], 'prompt': '投票',
                                     'showprompt': '轮到乙了'})
    assert [f.get('op') for f in f4] == ['seg-open'], f4
    assert f4[0]['seg'] == 'w:w202' and f4[0]['actor'] == '乙', f4[0]
    assert [i['text'] for i in f4[0]['items']] == ['轮到乙了', '投票'], f4[0]
    f4 = pr4.on_human_input({'wait_key': 'w202', 'body': {'reply': '投甲'}})
    assert f4[0]['open'] is False and f4[0]['items'][0]['text'] == '投甲', f4

    # 人类段交卷搬家（2026-09-27 用户拍板：人类发言以完成时间为准插入排序，
    # AI 段仍以开段到达序为准）：human_wait 那拍照旧开块占号，交卷收口这一拍
    # 整段搬到账末重新落号，旧位留墓碑；中间有别的行（AI 段）才搬，已在账末不搬。
    hubR = ProjectionHub(data_dir=tmp)
    prR = EventProjector()
    prR.set_waiting_sink(hubR.set_waiting)
    # 先来一个 AI 段（w201R），占住前面的号
    fr = prR.on_event('ai_request', {'node_name': 'nR1', 'wait_key': 'w201R',
                                     'actor_name': '甲', 'blocks': {'showprompt': '甲开始'}})
    assert hubR.feed(61, fr)['appended'] == 1
    # 人类节点开块（等待期块可见，头部槽照常可读）
    fr = prR.on_event('human_wait', {'node_name': 'nR2', 'wait_key': 'w202R',
                                     'actor_name': '乙', 'scope': ['乙'],
                                     'prompt': '投票', 'showprompt': '轮到乙了'})
    assert hubR.feed(61, fr)['appended'] == 1
    # 又来一个 AI 段（par 兄弟分支），把人类段顶离账末
    fr = prR.on_event('ai_request', {'node_name': 'nR3', 'wait_key': 'w203R',
                                     'actor_name': '丙', 'blocks': {'showprompt': '丙开始'}})
    assert hubR.feed(61, fr)['appended'] == 1
    rows = hubR.snapshot(61, 'god')['rows']
    assert [r['n'] for r in rows] == [1, 2, 3], rows
    assert [r['seg'] for r in rows] == ['w:w201R', 'w:w202R', 'w:w203R'], rows
    # 人类交卷：段应从 2 号搬到 4 号（账末），1、3 号 AI 段原地不动
    res = hubR.feed(61, prR.on_human_input({'wait_key': 'w202R', 'body': {'reply': '投甲'}}))
    rows = hubR.snapshot(61, 'god')['rows']
    assert [r['n'] for r in rows] == [1, 3, 4], rows
    assert [r['seg'] for r in rows] == ['w:w201R', 'w:w203R', 'w:w202R'], rows
    hm = [r for r in rows if r['n'] == 4][0]
    assert hm['role'] == 'human' and hm.get('open') is None, hm
    assert [i['kind'] for i in hm['items']] == ['showprompt', 'prompt', 'name', 'say'], hm
    # journal：旧位墓碑 + 新位整段，行数=3 行实体 + 1 墓碑
    jlR = [json.loads(x) for x in open(os.path.join(tmp, '61', 'journal.jsonl'),
                                       encoding='utf-8') if x.strip()]
    assert sum(1 for o in jlR if o.get('del')) == 1, jlR
    tomb = [o for o in jlR if o.get('del')][0]
    assert tomb['n'] == 2 and tomb['src_seq'] == 'seg:w:w202R:open', tomb
    mv = [o for o in jlR if o.get('n') == 4][0]
    assert mv['seg'] == 'w:w202R' and mv['src_seq'] == 'seg:w:w202R:moved', mv
    # 段索引跟到新号：晚到的草稿/填充帧按段键仍能定位（已收口拒草稿）
    assert not hubR.feed(61, [{'op': 'draft-delta', 'seg': 'w:w202R',
                               'key': 'kx', 'text': '迟到'}])['appended']
    # AI 段收口不搬家：丙交卷，仍在 3 号
    hubR.feed(61, prR.on_post_speech({'wait_key': 'w203R', 'payload': '丙说',
                                      'body': {'steps': [{'cot': '想想', 'reply': 'x'}]}}))
    rows = hubR.snapshot(61, 'god')['rows']
    assert [r['n'] for r in rows] == [1, 3, 4], rows
    # 已在账末的人类段不搬（无意义行号翻动）：再来一个 AI 段占 5 号后乙的段仍在 4
    fr = prR.on_event('ai_request', {'node_name': 'nR4', 'wait_key': 'w204R',
                                     'actor_name': '甲', 'blocks': {'showprompt': '再来'}})
    assert hubR.feed(61, fr)['appended'] == 1
    rows = hubR.snapshot(61, 'god')['rows']
    assert [r['n'] for r in rows] == [1, 3, 4, 5], rows
    # 冷加载：段索引从账本重建，搬走的段按新号认领、墓碑拦重放开段帧
    hubR2 = ProjectionHub(data_dir=tmp)
    assert hubR2._book(61).segs.get('w:w202R') == 4, hubR2._book(61).segs
    assert hubR2.feed(61, [{'op': 'seg-open', 'seg': 'w:w202R', 'actor': '乙'}])['appended'] == 0

    # ── 续跑世代让位（2026-09-28 用户拍板）：暂停→续跑，引擎 Runtime 重建计数器
    # 归零，wait_key 撞旧键重发——已收口的段键又见开段 = 新的一轮等待，开新世代
    # 段（seg 带 :gN 后缀），新台词不再 fill 进旧发言里（旧段有 say 时页面新旧
    # 两条一起显示，用户实测报障即此）；等待镜像的 seg 随段落地修正重推。──
    hubG = ProjectionHub(data_dir=tmp)
    prG = EventProjector()
    prG.set_waiting_sink(hubG.set_waiting)
    W1 = 'w:wg1'
    hubG.feed(71, prG.on_event('flow_start', {'name': '世代'}))
    hubG.feed(71, prG.on_event('human_wait', {'node_name': '[发言]', 'wait_key': 'wg1',
                                              'actor_name': '@人类', 'scope': ['@人类'],
                                              'prompt': '请发言'}))
    hubG.feed(71, prG.on_event('ai_request', {'node_name': '[说话]', 'wait_key': 'wa1',
                                              'actor_name': '@乙', 'scope': ['@乙']}))
    assert hubG.feed(71, prG.on_human_input(
        {'wait_key': 'wg1', 'body': {'reply': '第一条'}}))['updated'] == 1
    hubG.feed(71, prG.on_event('flow_paused', {}))
    hubG.feed(71, prG.on_event('flow_start', {'name': '世代', 'resumed': True}))
    hubG.feed(71, prG.on_event('human_wait', {'node_name': '[发言]', 'wait_key': 'wg1',
                                              'actor_name': '@人类', 'scope': ['@人类'],
                                              'prompt': '请发言'}))
    bg = hubG._book(71)
    assert bg.seg_gen.get(W1) == 2, bg.seg_gen
    _wl = hubG.current_waiting()
    assert len(_wl) == 1 and _wl[0].get('seg') == W1 + ':g2', _wl
    assert hubG.feed(71, prG.on_human_input(
        {'wait_key': 'wg1', 'body': {'reply': '第二条'}}))['updated'] == 1
    hubG.feed(71, prG.on_event('human_done', {}))
    bg = hubG._book(71)
    secs = [r for r in bg.rows if r.get('kind') == 'section' and r.get('role') == 'human']
    says = [[i.get('text') for i in (r.get('items') or []) if i.get('kind') == 'say']
            for r in secs]
    assert len(secs) == 2 and says == [['第一条'], ['第二条']], says
    assert secs[1]['seg'] == W1 + ':g2', secs[1]['seg']
    assert bg.segs.get(W1) == secs[1]['n'], bg.segs.get(W1)
    # 旧段还开着时同键开段照旧幂等拒（重复投喂防线不变）
    hubG.feed(71, prG.on_event('flow_paused', {}))
    hubG.feed(71, prG.on_event('flow_start', {'name': '世代', 'resumed': True}))
    hubG.feed(71, prG.on_event('human_wait', {'node_name': '[发言]', 'wait_key': 'wg1',
                                              'actor_name': '@人类', 'scope': ['@人类'],
                                              'prompt': '请发言'}))
    bg = hubG._book(71)
    assert bg.seg_gen.get(W1) == 3, bg.seg_gen
    _wl3 = hubG.current_waiting()
    assert len(_wl3) == 1 and _wl3[0].get('seg') == W1 + ':g3', _wl3
    g3n = [r for r in bg.rows if r.get('seg') == W1 + ':g3'][-1]['n']
    assert bg.segs.get(W1) == g3n, bg.segs.get(W1)
    assert hubG.feed(71, [{'op': 'seg-open', 'seg': W1, 'actor': '@人类'}])['appended'] == 0, \
        '开着的世代段：重复开段仍幂等拒'
    # 冷加载：路由键指向最新世代行、世代簿回血，下次让位接着编
    hubG2 = ProjectionHub(data_dir=tmp)
    b2 = hubG2._book(71)
    assert b2.segs.get(W1) == g3n, b2.segs.get(W1)
    assert b2.seg_gen.get(W1) == 3, b2.seg_gen
    assert hubG2.feed(71, [{'op': 'seg-open', 'seg': W1, 'actor': '@人类'}])['appended'] == 0

    # row-update 的视角过滤必须走【行本体】：ctrl 帧顶层没有 zone，拿帧去
    # view_filter 会把 stage/角色视角全滤掉（段的内容更新就发不出去了）
    hubs._subs.clear()
    st = _Sub(21, 'stage')
    hubs._subs.add(st)
    hubs._broadcast(21, {'ctrl': 'row-update', 'row': {'n': 1, 'zone': 'inplay'}},
                    live=False, filter_row={'n': 1, 'zone': 'inplay'})
    assert st.q.qsize() == 1, 'stage 视角应收本场戏内段的更新'
    hubs._broadcast(21, {'ctrl': 'row-update', 'row': {'n': 1, 'zone': 'inplay'}},
                    live=False)   # 不给行本体：退回旧行为（会被 stage 滤掉）
    assert st.q.qsize() == 1
    hubs._subs.clear()

    # 段内草稿层（2026-09-19 用户拍板：槽分「流式输出中／输出完落盘」两态）：
    # 草稿只活内存 + 旁账、永不进主账；定稿吸收同 kind 的草稿（不双份）；
    # 收口时剩下的草稿就地转正（桥没交卷也不丢历史）；刷新/换端从旁账接得上。
    hubd = ProjectionHub(data_dir=tmp)
    hubd.feed(31, [
        {'op': 'seg-open', 'seg': 'w:d1', 'actor': '乙', 'node': '发言',
         'targets': ['乙']},
        {'op': 'draft-start', 'seg': 'w:d1', 'key': 'k1', 'kind': 'reasoning'},
        {'op': 'draft-delta', 'seg': 'w:d1', 'key': 'k1', 'text': '我在想'},
        {'op': 'draft-delta', 'seg': 'w:d1', 'key': 'k1', 'text': '…'},
        {'op': 'draft-delta', 'seg': 'w:d1', 'key': 'k2', 'kind': 'text',
         'text': '你好'},   # 没先 start 也能长（槽不存在就顺手开一条）
    ])
    r = hubd.snapshot(31, 'god')['rows']
    assert len(r) == 1 and r[0]['open'] is True, r
    assert [d['kind'] for d in r[0]['drafts']] == ['cot', 'say'], r[0].get('drafts')
    assert [d['text'] for d in r[0]['drafts']] == ['我在想…', '你好'], r[0]['drafts']
    jl = [json.loads(x) for x in open(os.path.join(tmp, '31', 'journal.jsonl'),
                                      encoding='utf-8') if x.strip()]
    assert 'drafts' not in jl[0] and jl[0]['items'] == []          # 草稿永不进主账
    assert os.path.isfile(os.path.join(tmp, '31', 'drafts.json'))  # 旁账落了
    # 冷唤醒：草稿从旁账回血（刷新/换端接得上），主账那边仍是空段
    r = ProjectionHub(data_dir=tmp).snapshot(31, 'god')['rows']
    assert [d['text'] for d in r[0]['drafts']] == ['我在想…', '你好'], r
    # 吸收：同 kind 的定稿一到，草稿整条丢弃（不双份），别的 kind 的草稿还在
    hubd.feed(31, [{'op': 'seg-fill', 'seg': 'w:d1',
                    'items': [{'kind': 'cot', 'text': '我在想…（定稿）'}]}])
    r = hubd.snapshot(31, 'god')['rows']
    assert [i['kind'] for i in r[0]['items']] == ['name', 'cot'], r[0]['items']
    assert [d['kind'] for d in r[0]['drafts']] == ['say'], r[0]['drafts']
    # 收口：吸收 + 转正（这里 say 草稿被定稿接管），草稿账见底、旁账残影不复活
    hubd.feed(31, [{'op': 'seg-close', 'seg': 'w:d1',
                    'items': [{'kind': 'say', 'text': '你好呀'}]}])
    r = hubd.snapshot(31, 'god')['rows']
    assert r[0].get('open') is None and 'drafts' not in r[0], r[0]
    assert [(i['kind'], i['text']) for i in r[0]['items']] == \
        [('name', '乙'), ('cot', '我在想…（定稿）'), ('say', '你好呀')], r[0]['items']
    assert hubd._book(31).drafts == {}, hubd._book(31).drafts
    assert 'drafts' not in ProjectionHub(data_dir=tmp).snapshot(31, 'god')['rows'][0]
    # 转正（桥压根没交卷）：收口时草稿就地变成定稿——历史不丢
    hubd.feed(31, [
        {'op': 'seg-open', 'seg': 'w:d2', 'actor': '丙'},
        {'op': 'draft-delta', 'seg': 'w:d2', 'key': 'z', 'kind': 'text', 'text': '半句话'},
        {'op': 'seg-close', 'seg': 'w:d2'},
    ])
    r = hubd.snapshot(31, 'god')['rows']
    assert [i['text'] for i in r[-1]['items']] == ['丙', '半句话'] and 'drafts' not in r[-1], r[-1]
    # 作废（重试/中断）：撤了就是撤了，不进历史
    hubd.feed(31, [
        {'op': 'seg-open', 'seg': 'w:d3', 'actor': '丁'},
        {'op': 'draft-delta', 'seg': 'w:d3', 'key': 'r', 'kind': 'text', 'text': '废稿'},
        {'op': 'draft-drop', 'seg': 'w:d3', 'key': 'r'},
        {'op': 'seg-close', 'seg': 'w:d3'},
    ])
    r = hubd.snapshot(31, 'god')['rows']
    assert 'drafts' not in r[-1] and r[-1]['items'] == [], r[-1]
    # 收口后的段不再长草稿（宿主冲刺的晚到增量不能把收口的块写活）
    hubd.feed(31, [{'op': 'draft-delta', 'seg': 'w:d3', 'key': 'late',
                    'kind': 'text', 'text': '迟到的字'}])
    assert 'drafts' not in hubd.snapshot(31, 'god')['rows'][-1]
    assert hubd._book(31).drafts == {}, hubd._book(31).drafts   # 收口的段根本不收
    # 旁账残影（节流刷留下的那一拍）：段已收口 → 冷载时丢掉，不许在定稿旁边复活
    with open(os.path.join(tmp, '31', 'drafts.json'), 'w', encoding='utf-8') as f:
        json.dump({'w:d1': {'ghost': {'key': 'ghost', 'kind': 'say', 'text': '残影'}}}, f)
    hubg = ProjectionHub(data_dir=tmp)
    assert hubg._book(31).drafts == {}, hubg._book(31).drafts
    assert 'drafts' not in hubg.snapshot(31, 'god')['rows'][0]
    # 草稿抢在开段前面到（宿主与桥两条路各有先后）：先记下，开段那拍带上
    hubd.feed(32, [{'op': 'draft-delta', 'seg': 'w:d4', 'key': 'early',
                    'kind': 'text', 'text': '先说上了'}])
    assert hubd.snapshot(32, 'god')['rows'] == []
    hubd.feed(32, [{'op': 'seg-open', 'seg': 'w:d4', 'actor': '甲'}])
    r = hubd.snapshot(32, 'god')['rows']
    assert [d['text'] for d in r[0]['drafts']] == ['先说上了'], r
    # 段引用归一：喂方只报它手上那枚令牌（wait_key），段键由 hub 拼成 'w:<wk>'——
    # 宿主因此不必知道段、不必自己造键对齐（薄壳契约，2026-09-19）
    # （带来源宿主时键为 'w:<host>:<wk>'，见后面的联机段；这一批没报 source，故无 host 段）
    hubk = ProjectionHub(data_dir=tmp)
    hubk.feed(33, [{'op': 'seg-open', 'wait_key': 'WK9', 'actor': '甲'}])
    hubk.feed(33, [{'op': 'draft-delta', 'wait_key': 'WK9', 'key': 's',
                    'kind': 'text', 'text': '令牌即段'}])
    r = hubk.snapshot(33, 'god')['rows']
    assert r[0]['seg'] == 'w:WK9' and [d['text'] for d in r[0]['drafts']] == ['令牌即段'], r
    hubk.feed(33, [{'op': 'draft-drop', 'wait_key': 'WK9'}])
    assert 'drafts' not in hubk.snapshot(33, 'god')['rows'][0]

    # 草稿槽序（2026-09-30 修「思考链行上下跳」）：drop+delta 整对重发会把被重插的
    # 槽挪到字典末尾（写入序随批翻面），hub 出料按槽键定序——页面不再两头跳。
    hubS = ProjectionHub(data_dir=tmp)
    hubS.feed(34, [
        {'op': 'seg-open', 'seg': 'w:s1', 'actor': '甲'},
        {'op': 'draft-delta', 'seg': 'w:s1', 'key': 'text#-#-', 'kind': 'text', 'text': '先写台词'},
        {'op': 'draft-delta', 'seg': 'w:s1', 'key': 'reasoning#-#-', 'kind': 'reasoning',
         'text': '后到的思考'},   # 思考后到：写入序是 say→cot，出料仍按语义序
    ])
    r = hubS.snapshot(34, 'god')['rows']
    assert [d['kind'] for d in r[0]['drafts']] == ['cot', 'say'], r[0]['drafts']
    # web 式重发（思考这路整对 drop+delta，台词路这批没字不发）：重插不挪位
    hubS.feed(34, [
        {'op': 'draft-drop', 'seg': 'w:s1', 'key': 'reasoning#-#-'},
        {'op': 'draft-delta', 'seg': 'w:s1', 'key': 'reasoning#-#-', 'kind': 'reasoning',
         'text': '后到的思考（重发）'},
    ])
    r = hubS.snapshot(34, 'god')['rows']
    assert [d['kind'] for d in r[0]['drafts']] == ['cot', 'say'], r[0]['drafts']
    # 多轮 react 槽序：轮次（step）升序、轮内思考→工具→台词；无号段垫底
    hubS.feed(35, [
        {'op': 'seg-open', 'seg': 'w:s2', 'actor': '乙'},
        {'op': 'draft-delta', 'seg': 'w:s2', 'key': 'toolcall#1#0', 'kind': 'toolcall',
         'text': '{}', 'name': '看牌'},
        {'op': 'draft-delta', 'seg': 'w:s2', 'key': 'reasoning#1#-', 'kind': 'reasoning',
         'text': '第二轮想'},
        {'op': 'draft-delta', 'seg': 'w:s2', 'key': 'reasoning#0#-', 'kind': 'reasoning',
         'text': '第一轮想'},
        {'op': 'draft-delta', 'seg': 'w:s2', 'key': 'text#1#-', 'kind': 'text', 'text': '台词'},
        {'op': 'draft-delta', 'seg': 'w:s2', 'key': 'reasoning#-#-', 'kind': 'reasoning',
         'text': '整轮快照槽'},
    ])
    r = hubS.snapshot(35, 'god')['rows']
    assert [d['key'] for d in r[0]['drafts']] == \
        ['reasoning#0#-', 'reasoning#1#-', 'toolcall#1#0', 'text#1#-', 'reasoning#-#-'], \
        r[0]['drafts']
    # 批内原子（/feed 一批只发终态）：drop 那拍「槽暂时不在」的中间态不广播——
    # 逐帧广播时页面会看见思考链行闪没又闪回，正是用户报的「一闪一闪」。
    hubS._subs.clear()
    stS = _Sub(34, 'god')
    hubS._subs.add(stS)
    hubS.feed(34, [
        {'op': 'draft-drop', 'seg': 'w:s1', 'key': 'reasoning#-#-'},
        {'op': 'draft-delta', 'seg': 'w:s1', 'key': 'reasoning#-#-', 'kind': 'reasoning',
         'text': '后到的思考（再发）'},
    ])
    ups = []
    while not stS.q.empty():
        m = json.loads(stS.q.get_nowait())   # 队列载荷是序列化帧（_broadcast）
        if m.get('ctrl') == 'row-update':
            ups.append(m['row'])
    assert len(ups) == 1, ups   # 两帧只发一次终态，中间态不出门
    assert [d['kind'] for d in ups[0]['drafts']] == ['cot', 'say'], ups
    hubS._subs.clear()

    # 人类节点的执行者名（2026-09-19 修「块头写成别人」）：引擎 human_wait 现在报
    # actor_name（正名后；旧名已删）。此前只能拿 scope 快照首元素兜底，而快照是
    # sorted(...) 过的多席位集合——`scope: all` 就会瞎指排序第一的人（@Eve）。
    prh = EventProjector()
    fh = prh.on_event('human_wait', {'node_name': '[陈述]', 'wait_key': 'wH1',
                                     'actor_name': '@猫猫', 'prompt': '你手里没有词',
                                     'scope': ['@Eve', '@小猫咪', '@猫猫']})
    assert fh[0]['op'] == 'seg-open' and fh[0]['actor'] == '@猫猫', fh[0]
    assert [i['text'] for i in fh[0]['items']] == ['你手里没有词'], fh[0]
    # 名字缺失（老引擎/异常）＋多席位 scope：宁可空着，也不瞎指第一个人
    fh = EventProjector().on_event('human_wait', {'node_name': '[陈述]', 'wait_key': 'wH3',
                                                 'scope': ['@Eve', '@小猫咪', '@猫猫']})
    assert fh[0]['actor'] == '', fh[0]
    # 单人 scope（scope: self）照旧兜底
    fh = EventProjector().on_event('human_wait', {'node_name': '[投票]', 'wait_key': 'wH4',
                                                 'scope': ['@猫猫']})
    assert fh[0]['actor'] == '@猫猫', fh[0]

    # 人类等待镜像（2026-09-20 投影页人类输入；2026-10-02 复数化）：human_wait
    # SET（按 wait_key upsert）→ sink 收整张席位清单（list，序=human_wait 到达
    # 序）；human_done 按事件带的 wait_key 清那一席（不带键=全清，老引擎字面
    # 行为）；flow_paused / flow_done 全清。无 wait_key 的罕见形态不进镜像。
    # views=该亮输入框的 actor 视角 id，与 /views 清单同口径。
    prw = EventProjector()
    prw.set_host('dsh')
    wgot = []
    prw.set_waiting_sink(wgot.append)
    prw.on_event('human_wait', {'job_id': 61, 'node_name': '[陈述]', 'wait_key': 'wW1',
                                'actor_name': '@猫猫', 'prompt': '请投票',
                                'scope': ['@Eve', '@猫猫'],
                                'out_vars': ['票', '理由']})
    assert len(prw.waiting) == 1 and wgot, (prw.waiting, wgot)
    w = wgot[-1][-1]
    assert w['job_id'] == 61 and w['wait_key'] == 'wW1' and w['actor'] == '@猫猫', w
    assert w['host'] == 'dsh' and w['node'] == '[陈述]' and w['prompt'] == '请投票', w
    assert w['out_vars'] == ['票', '理由'], w   # out 变量名随等待态下发（赋值浮层数据源，2026-09-24）
    assert w['views'] == ['actor:dsh:@猫猫', 'actor:dsh:@Eve'], w   # 与 views() id 逐字可比
    # ── 多席并发（2026-10-02 复数化的靶心用例）：par 两条线各自等到人类——
    # 同名节点、同 actor、同时等待，第二席不得覆盖第一席（标量时代的根因）。
    prw.on_event('human_wait', {'job_id': 61, 'node_name': '[陈述]', 'wait_key': 'wW2',
                                'actor_name': '@猫猫', 'scope': ['@猫猫']})
    assert [s['wait_key'] for s in prw._waiting_list()] == ['wW1', 'wW2'], prw._waiting_list()
    assert [s['wait_key'] for s in wgot[-1]] == ['wW1', 'wW2'], wgot[-1]   # 推整张清单
    # 收麦按键清：human_done 带 wW1 只清第一席，第二席照常在册可交卷
    prw.on_event('human_done', {'job_id': 61, 'wait_key': 'wW1', 'input': '投乙'})
    assert [s['wait_key'] for s in prw._waiting_list()] == ['wW2'], prw._waiting_list()
    # 老引擎不带键=全清（字面退回标量行为）
    prw.on_event('human_wait', {'job_id': 61, 'node_name': '[陈述]', 'wait_key': 'wW3',
                                'actor_name': '@猫猫', 'scope': ['@猫猫']})
    prw.on_event('human_done', {'job_id': 61})
    assert prw.waiting == {} and wgot[-1] == []
    prw.on_event('human_wait', {'job_id': 61, 'node_name': '[陈述]', 'wait_key': 'wW2',
                                'actor_name': '@猫猫', 'scope': ['@猫猫']})
    assert prw.waiting['wW2']['out_vars'] == [], prw.waiting['wW2']   # 节点未声明 out=空清单（不亮赋值钮）
    # 同键重推=原位更新不添席（续跑世代键修正那一拍的重推形态）
    prw._waiting_upsert(dict(prw.waiting['wW2'], seg='w:dsh:wW2:g2'))
    assert len(prw.waiting) == 1 and prw.waiting['wW2']['seg'] == 'w:dsh:wW2:g2', prw.waiting
    prw.on_event('flow_paused', {})
    assert prw.waiting == {} and wgot[-1] == []   # 暂停收麦（续跑重发 human_wait 自愈）
    prw.on_event('human_wait', {'node_name': '[怪节点]', 'wait_key': '',
                                'scope': ['@猫猫']})
    assert prw.waiting == {}                        # 无键不可交卷：不进镜像
    prw.on_event('flow_done', {})
    assert prw.waiting == {} and wgot[-1] == []

    # 跨会话过滤也要盖住宿主轮段帧（2026-09-19 补洞：宿主轮段键 h:<sid>:… 自报名分，
    # 别的会话的戏外轮不许进本场——实锤是 job 1856 里混进了 session-d052de57 的容器）
    hubf = ProjectionHub(data_dir=tmp)
    hubf.feed(51, [
        {'op': 'row', 'zone': 'meta', 'kind': 'play_start', 'text': '本场'},
        {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户',
         'text': '本场主会话的话', 'src_seq': 'main:sess-A:1'},
        {'op': 'seg-open', 'seg': 'h:sess-A:1', 'zone': 'outside', 'actor': '导演'},
        {'op': 'seg-close', 'seg': 'h:sess-A:1', 'items': [{'kind': 'say', 'text': '本场导演回话'}],
         'src_seq': 'main:sess-A:seg1:turn'},
    ])
    assert len(hubf.snapshot(51, 'god')['rows']) == 3
    hubf.set_owner(51, 'sess-A')      # 本场主会话登记
    hubf.feed(51, [{'op': 'seg-open', 'seg': 'h:sess-A:2', 'zone': 'outside', 'actor': '导演'}])
    hubf.feed(51, [{'op': 'draft-delta', 'seg': 'h:sess-A:2', 'kind': 'text',
                    'key': 'k', 'text': '本场在写'}])
    # 【2026-09-20 会话账本】owner 登记后宿主轮戏外帧改道会话账本：job 账本停在
    # 登记前的 3 行（末行已收口），「正在写」的容器与草稿长在会话账本里。
    assert len(hubf.snapshot(51, 'god')['rows']) == 3
    r = hubf.snapshot_session(':sess-A')['rows']
    assert r[-1]['open'] is True and [d['text'] for d in r[-1]['drafts']] == ['本场在写'], r[-1]
    res = hubf.feed(51, [                      # 别的会话：整帧丢，不落账也不长出容器
        {'op': 'seg-open', 'seg': 'h:sess-B:9', 'zone': 'outside', 'actor': '导演'},
        {'op': 'draft-delta', 'seg': 'h:sess-B:9', 'kind': 'text', 'key': 'k', 'text': '别场的话'},
        {'op': 'seg-close', 'seg': 'h:sess-B:9', 'items': [{'kind': 'say', 'text': '别场回话'}]},
        {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户', 'text': '别场的私聊',
         'src_seq': 'main:sess-B:1'},
    ])
    assert res['skipped'] == 4 and res['appended'] == 0 and res['updated'] == 0, res
    rows = [x for x in hubf.snapshot(51, 'god')['rows'] if 'sess-B' in str(x.get('seg'))]
    assert rows == [], rows                    # 读侧同尺：页面上一条都看不到
    srows = hubf.snapshot_session(':sess-A')['rows']
    assert [x for x in srows if 'sess-B' in str(x.get('seg'))] == []   # 会话账本同样收信任过滤
    # 冷唤醒后依旧看不见（owner 随 cast.json 恢复）
    assert [x for x in ProjectionHub(data_dir=tmp).snapshot(51, 'god')['rows']
            if 'sess-B' in str(x.get('seg'))] == []

    # 宿主轮的容器（2026-09-19 用户拍板「hub 两边都收、收下来一个样」）：戏外一轮
    # = 宿主自己开/收的段，与引擎节点轮同一套规矩——开容器那拍占号（位置锁在 user
    # 之后）→ 喂字 → 收口（定稿吸收草稿）；带 src_seq 的收口重放不重账（水位补齐）。
    hubo = ProjectionHub(data_dir=tmp)
    hubo.feed(41, [
        {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户',
         'text': '导演在吗', 'src_seq': 'main:s1:5'},
        {'op': 'seg-open', 'seg': 'h:s1:5', 'zone': 'outside', 'actor': '导演'},
    ])
    r = hubo.snapshot(41, 'god')['rows']
    assert [x['n'] for x in r] == [1, 2], r
    assert r[1]['open'] is True and r[1]['zone'] == 'outside' and r[1]['actor'] == '导演', r[1]
    assert hubo.snapshot(41, 'stage')['rows'] == []      # 戏外段不进戏内窗
    hubo.feed(41, [{'op': 'draft-delta', 'seg': 'h:s1:5', 'key': 'say#0#0',
                    'kind': 'text', 'text': '在的，'}])
    assert [d['text'] for d in hubo.snapshot(41, 'god')['rows'][1]['drafts']] == ['在的，']
    hubo.feed(41, [{'op': 'seg-close', 'seg': 'h:s1:5',
                    'items': [{'kind': 'say', 'text': '在的，什么事？'}],
                    'src_seq': 'main:s1:seg5:turn3'}])
    r = hubo.snapshot(41, 'god')['rows']
    assert r[1].get('open') is None and 'drafts' not in r[1], r[1]
    assert [i['text'] for i in r[1]['items']] == ['导演', '在的，什么事？'], r[1]['items']
    # 收口重放（水位补齐/断线补写）：同一 src_seq 不重账，也不长出第二条
    rep = hubo.feed(41, [{'op': 'seg-close', 'seg': 'h:s1:5',
                          'items': [{'kind': 'say', 'text': '在的，什么事？'}],
                          'src_seq': 'main:s1:seg5:turn3'}])
    assert rep['updated'] == 0, rep
    assert len(hubo.snapshot(41, 'god')['rows'][1]['items']) == 2   # 名字槽+台词，不重账
    # 空轮收口也要收口（否则页面上永远挂一个「正在…」的空块）
    hubo.feed(41, [{'op': 'seg-open', 'seg': 'h:s1:9', 'zone': 'outside', 'actor': '导演'}])
    hubo.feed(41, [{'op': 'seg-close', 'seg': 'h:s1:9', 'items': []}])
    assert hubo.snapshot(41, 'god')['rows'][-1].get('open') is None

    # 落幕不许冒出裸露重复 showprompt（2026-09-19 用户实报「跑完又冒四条顶格同题」，
    # job 1920 台账实锤：[投票] 4 个 AI 分支）。成因：段已开之后晚到的 context_ready
    # 又扣成 pending[wk]，而新路交卷只 served.add 不 pop → 收官 flush_pending 补投成
    # 无主裸行。规矩：**段开了以后，提问只往段里落地，绝不再扣 pending**。
    proj_lk = EventProjector()
    hubx = ProjectionHub(data_dir=tmp)
    SP = '【投票】轮到你投票：先给一句怀疑理由，再在下面的选择器里选你要投的人。'
    hubx.feed(42, proj_lk.on_event('ai_request', {
        'node_name': '[投票]', 'wait_key': 'wX', 'actor_name': '@甲',
        'scope_info': ['@甲'], 'blocks': {'showprompt': SP}}))
    hubx.feed(42, proj_lk.on_event('context_ready', {'node_name': '[投票]', 'showprompt': SP}))  # 晚到同题
    hubx.feed(42, proj_lk.on_post_speech({'wait_key': 'wX', 'payload': '我投乙'}))
    assert proj_lk.flush_pending() == [], '落幕不该补投：同题已落在容器里'
    rows42 = hubx.snapshot(42, 'god')['rows']
    # 旁白与容器同行（2026-09-19 用户拍板：showprompt 与节点内容不能分开）
    assert sum(1 for r in rows42 if r.get('text') == SP) == 0, rows42   # 没有独立旁白行
    seg42 = [r for r in rows42 if r.get('seg')]
    assert sum(1 for it in seg42[0]['items'] if it['text'] == SP) == 1, seg42[0]  # 容器里就一份
    # 块首缺这份（老引擎无 blocks）时：晚到的同题补进段里、只补一次，也不裸露
    proj_lk2 = EventProjector()
    hubx.feed(43, proj_lk2.on_event('ai_request', {
        'node_name': '[投票]', 'wait_key': 'wY', 'actor_name': '@乙',
        'scope_info': ['@乙'], 'blocks': {}}))
    f1 = proj_lk2.on_event('context_ready', {'node_name': '[投票]', 'showprompt': SP})
    f2 = proj_lk2.on_event('context_ready', {'node_name': '[投票]', 'showprompt': SP})  # 重放
    assert [x['op'] for x in f1] == ['seg-fill'], f1
    assert f2 == [], f2                    # 补过了：重放不再补第二份
    hubx.feed(43, f1)
    hubx.feed(43, proj_lk2.on_post_speech({'wait_key': 'wY', 'payload': '我投丙'}))
    rows43 = [x for x in hubx.snapshot(43, 'god')['rows'] if x.get('seg')]
    assert sum(1 for it in rows43[0]['items'] if it['text'] == SP) == 1, rows43[0]
    assert proj_lk2.flush_pending() == [], '块首缺这份时也不该补投成裸行'
    # 老路（无 wait_key）的「历史不丢」不受影响：照旧补投
    proj_lk3 = EventProjector()
    proj_lk3.on_event('context_ready', {'node_name': 'n9', 'showprompt': '无令牌节点的题'})
    assert len(proj_lk3.flush_pending()) == 1

    # ── 联机：多宿主共演同一场（2026-09-19 用户拍板「一个投影hub管所有宿主」）──
    # 背景：dsh 与 zcode 用同一本 Chronica、指向同一个 sessionid、各认领不同角色，
    # 于是 job_id 相同、**两个宿主的帧都该进同一本账**，只是每行要辨得出来源。
    # 这里钉死三件事：①谁的来源标谁（行 host / 段键 host 段）；②两台不互相吞
    # （改前 owner 是单值 sid，B 台的戏外行会在 feed 期被 skipped 丢弃）；③签名
    # 相同的令牌（联机时 run_tag 都是 'j77:'、counter 各从 0 起数，必然撞）不串段。
    hubl = ProjectionHub(data_dir=tmp)
    hubl.set_owner(77, 'session-A', host='dsh')
    hubl.set_owner(77, 'session-B', host='zcode')
    assert hubl.host_book(77) == {'dsh': ['session-A'], 'zcode': ['session-B']}, \
        hubl.host_book(77)
    # 两台各自的戏外行（src_seq 各带自己的 sid）：都该入账，谁都不吞谁。
    # 【2026-09-20 会话账本】owner 已登记的戏外行**改道**会话账本（job 账本不再
    # 收），织入信任集全部 (host,sid) 格——联机共演每台的上帝窗都看得到全场。
    r_a = hubl.feed(77, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper',
                          'actor': '用户', 'text': 'A台说话',
                          'src_seq': 'main:session-A:1'}], source='dsh')
    r_b = hubl.feed(77, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper',
                          'actor': '用户', 'text': 'B台说话',
                          'src_seq': 'main:session-B:1'}], source='zcode')
    assert r_a['appended'] == 1 and r_a['skipped'] == 0, r_a   # 改道织入成功=appended
    assert r_b['appended'] == 1 and r_b['skipped'] == 0, r_b   # 改前这里必是 skipped=1
    sa = hubl.snapshot_session('dsh:session-A')['rows']
    sb_ = hubl.snapshot_session('zcode:session-B')['rows']
    assert [r['text'] for r in sa] == ['A台说话', 'B台说话'], sa
    assert [r['text'] for r in sb_] == ['A台说话', 'B台说话'], sb_
    # 无关会话照旧被挡（联机不等于把全世界都收进来）
    r_x = hubl.feed(77, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper',
                          'actor': '用户', 'text': '别场闲话',
                          'src_seq': 'main:session-X:1'}], source='dsh')
    assert r_x['appended'] == 0 and r_x['skipped'] == 1, r_x
    # 同一枚令牌、两台各喂逐字流：段键带 host 段 → 两条独立的段，字不相交
    hubl.feed(77, [{'op': 'seg-open', 'wait_key': 'SAME', 'actor': '@Eve'},
                   {'op': 'draft-delta', 'wait_key': 'SAME', 'key': 'k',
                    'kind': 'text', 'text': 'A的字'}], source='dsh')
    hubl.feed(77, [{'op': 'seg-open', 'wait_key': 'SAME', 'actor': '@Eve'},
                   {'op': 'draft-delta', 'wait_key': 'SAME', 'key': 'k',
                    'kind': 'text', 'text': 'B的字'}], source='zcode')
    segs = [r for r in hubl.snapshot(77, 'god')['rows'] if r.get('seg')]
    assert sorted(r['seg'] for r in segs) == ['w:dsh:SAME', 'w:zcode:SAME'], segs
    for r in segs:
        got = [d['text'] for d in (r.get('drafts') or [])]
        # 【刀1 归属单源】行不带 host 章，归属剖段键
        assert got == (['A的字'] if _seg_host(r['seg']) == 'dsh' else ['B的字']), (r['seg'], got)
    # 【刀1】job 行本体不带宿主字段；来源剖段键/hosts 集聚合
    rows77 = hubl.snapshot(77, 'god')['rows']
    assert all(not r.get('host') for r in rows77), rows77
    assert {_seg_host(r.get('seg')) for r in rows77 if r.get('seg')} == {'dsh', 'zcode'}
    assert hubl.snapshot(77, 'god')['hosts'] == ['dsh', 'zcode']
    assert hubl.hosts() and {x['name'] for x in hubl.hosts()} == {'dsh', 'zcode'}, hubl.hosts()
    assert [j for j in hubl.jobs() if j['job_id'] == 77][0]['hosts'] == ['dsh', 'zcode']
    # 同名角色各归各的窗：id/key 带 host，**显示名保持裸名**（前缀只在渲染层拼），
    # 过滤仍按裸基名匹配（往数据里塞前缀会让角色窗当场空掉）
    vs = hubl.views(77)['views']
    eve = [v for v in vs if v.get('base') == '@Eve']
    assert {v['host'] for v in eve} == {'dsh', 'zcode'}, eve
    assert {v['id'] for v in eve} == {'actor:dsh:@Eve', 'actor:zcode:@Eve'}, eve
    assert all('[' not in v['name'] for v in eve), eve
    assert view_filter('actor:dsh:@Eve', {'zone': 'inplay', 'targets': ['@Eve']}) is True
    assert view_filter('actor:dsh:@Eve', {'zone': 'inplay', 'targets': ['@猫猫']}) is False
    # 信任来源懒登记：第二台第一次 feed 时借解析器被学会（桥注入才认识 job 档案）
    hubm = ProjectionHub(data_dir=tmp)
    seen = []
    hubm.set_owner_resolver(lambda jid: seen.append(jid) or hubm.set_owner(
        jid, 'session-A' if seen.count(jid) == 1 else 'session-B',
        host='dsh' if seen.count(jid) == 1 else 'zcode'))
    hubm.feed(88, [{'op': 'row', 'kind': 'say', 'actor': '甲', 'text': '一'}], source='dsh')
    hubm.feed(88, [{'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户',
                    'text': '二', 'src_seq': 'main:session-B:88'}], source='zcode')
    assert seen == [88, 88], seen            # 第二台进来时又解析了一次（学会 B）
    assert hubm.host_book(88) == {'dsh': ['session-A'], 'zcode': ['session-B']}, \
        hubm.host_book(88)
    # 【2026-09-20 会话账本】inplay 行照进 job 账本（刀1 起行不带 host 章），
    # owner 学会后到达的戏外行改道会话账本（两台各织一份，host 标保持来源宿主）
    jrows = hubm.snapshot(88, 'god')['rows']
    assert [r['text'] for r in jrows] == ['一'] and not jrows[-1].get('host'), jrows
    for addr, want in (('dsh:session-A', ['一', '二']), ('zcode:session-B', ['二'])):
        # 共享 tmp：该会话账本里还有上一块（job 77）织入的行——按 job_id 过滤。
        # B 台是 '二' 到达时才被懒登记学会的，先喂的 '一' 不补织（织入按当时
        # 已知信任集——归属跟戏走，不做追溯）。
        srows = [r for r in hubm.snapshot_session(addr)['rows'] if r.get('job_id') == 88]
        assert [r['text'] for r in srows] == want, (addr, srows)
        assert srows[-1]['host'] == 'zcode', (addr, srows[-1])

    # ── 会话账本全链（2026-09-20）：session 直投/幂等/绑定/HTTP 面/织入
    #    生命周期/jobs 隔离/冷唤醒 ──
    assert _split_session('dsh:session-x') == ('dsh', 'session-x')
    assert _split_session('nohost') == ('', None)
    assert _split_session('dsh:..') == ('', None)
    assert _split_session('dsh:a/b') == ('', None)
    assert _split_session(':legacy') == ('', 'legacy')   # 无主格（老宿主）
    hubs_ = ProjectionHub(data_dir=tmp)
    res = hubs_.feed_session('dsh:session-ledger', [
        {'op': 'row', 'zone': 'outside', 'kind': 'whisper', 'actor': '用户',
         'text': '会话账本第一句', 'src_seq': 'main:session-ledger:1'},
        {'op': 'seg-open', 'seg': 'h:session-ledger:1', 'zone': 'outside', 'actor': '导演'},
        {'op': 'draft-delta', 'seg': 'h:session-ledger:1', 'kind': 'text',
         'key': 'k', 'text': '导演回话在写'},
        {'op': 'seg-close', 'seg': 'h:session-ledger:1',
         'items': [{'kind': 'say', 'text': '导演回话'}],
         'src_seq': 'main:session-ledger:seg1:turn'},
    ])
    assert res['ok'] is True and res['appended'] == 2 and res['updated'] == 2, res
    assert os.path.isfile(os.path.join(tmp, 'sessions', 'dsh', 'session-ledger',
                                       'journal.jsonl'))
    srows = hubs_.snapshot_session('dsh:session-ledger')['rows']
    assert [r['n'] for r in srows] == [1, 2], srows           # n 独立成序
    assert srows[0]['text'] == '会话账本第一句'
    assert srows[1]['seg'] == 'h:session-ledger:1' and 'open' not in srows[1]
    assert any(it['text'] == '导演回话' for it in srows[1]['items'])   # 收口转正进 items
    res2 = hubs_.feed_session('dsh:session-ledger', [          # 重放幂等
        {'kind': 'whisper', 'text': '会话账本第一句',
         'src_seq': 'main:session-ledger:1'}])
    assert res2['appended'] == 0, res2
    assert hubs_.feed_session('bad-shape', [])['ok'] is False
    hubs_.feed(501, [{'op': 'row', 'zone': 'inplay', 'kind': 'say', 'text': 'x'}])
    hubs_.feed_session('dsh:session-ledger', [{'kind': 'whisper', 'text': 'y'}])
    assert hubs_._last_job == 501, hubs_._last_job   # 会话直投绝不劫走「跟随最新场」
    # 绑定：首见自动收录（mains 幂等追加）+ 显式换绑 + 全新宿主「首见即主」
    assert 'session-ledger' in hubs_.bindings_view()['dsh']['mains']
    assert hubs_.bind('dsh:session-old')['ok'] is True
    assert hubs_.bindings_view()['dsh']['current'] == 'session-old'
    assert 'session-old' in hubs_.bindings_view()['dsh']['mains']
    hubs_.feed_session('freshhost:s1', [{'kind': 'whisper', 'text': 'y2'}])
    assert hubs_.bindings_view()['freshhost'] == {'current': 's1', 'mains': ['s1']}
    # jobs/「最新场」不收 sessions/ 目录（纯数字目录过滤天然隔离）
    assert all(isinstance(j['job_id'], int) for j in hubs_.jobs())
    # 织入生命周期：开段→织草稿→填段原位改写（行数都不涨）→meta 双落
    hubwv = ProjectionHub(data_dir=tmp)
    hubwv.set_owner(601, 'session-wv', host='dsh')
    hubwv.feed(601, [{'op': 'seg-open', 'wait_key': 'wv1', 'actor': '甲',
                      'zone': 'inplay'}], source='dsh')
    hubwv.feed(601, [{'op': 'draft-delta', 'wait_key': 'wv1', 'key': 'k',
                      'kind': 'text', 'text': '在写'}], source='dsh')
    jb601 = os.path.join(tmp, '601', 'journal.jsonl')
    sv601 = os.path.join(tmp, 'sessions', 'dsh', 'session-wv', 'journal.jsonl')
    assert os.path.isfile(sv601) and len(open(sv601, encoding='utf-8').read().splitlines()) == 1
    n601 = len(open(jb601, encoding='utf-8').read().splitlines())
    wrows = hubwv.snapshot_session('dsh:session-wv')['rows']
    assert len(wrows) == 1 and wrows[0]['seg'] == 'w:dsh:wv1' \
        and wrows[0].get('job_id') == 601 \
        and [d['text'] for d in wrows[0]['drafts']] == ['在写'], wrows   # 草稿织进会话段
    hubwv.feed(601, [{'op': 'seg-fill', 'wait_key': 'wv1',
                      'items': [{'kind': 'say', 'text': '台词'}]}], source='dsh')
    wrows = hubwv.snapshot_session('dsh:session-wv')['rows']
    assert len(wrows) == 1 and any(it['text'] == '台词' for it in wrows[0]['items']) \
        and 'drafts' not in wrows[0], wrows      # 填段原位改写：吸收草稿、行数不涨
    assert len(open(jb601, encoding='utf-8').read().splitlines()) == n601 \
        and len(open(sv601, encoding='utf-8').read().splitlines()) == 1
    hubwv.feed(601, [{'op': 'row', 'zone': 'meta', 'kind': 'play_start',
                      'text': '第X场'}], source='dsh')
    assert any(r['kind'] == 'play_start' for r in hubwv.snapshot(601, 'god')['rows'])
    assert any(r['kind'] == 'play_start' for r in
               hubwv.snapshot_session('dsh:session-wv')['rows'])   # meta 双落
    # 会话直投不碰 job 账本（改道后的 job 账本字节不变）
    before601 = open(jb601, 'rb').read()
    hubwv.feed_session('dsh:session-wv', [{'kind': 'whisper', 'text': '直投不进 job 账'}])
    assert open(jb601, 'rb').read() == before601
    # 冷唤醒：会话账本与绑定都从盘上回血
    hubcold = ProjectionHub(data_dir=tmp)
    cold_rows = hubcold.snapshot_session('dsh:session-ledger')['rows']
    assert [r['text'] for r in cold_rows if r['kind'] == 'whisper'] == \
        ['会话账本第一句', 'y'], cold_rows
    assert hubcold.bindings_view()['dsh']['current'] == 'session-old'
    # HTTP 面：/feed 双寻址、/view?session=、/sessions、/bind、/diag
    hubsn = ProjectionHub(data_dir=tmp)
    ports_ = start_hub_server(hubsn, port=0)
    base_ = 'http://127.0.0.1:%d' % ports_
    req = urllib.request.Request(base_ + '/feed',
                                 data=json.dumps(
                                     {'session': 'dsh:session-http', 'frames': [
                                         {'kind': 'whisper', 'actor': '用户',
                                          'text': 'http 直投',
                                          'src_seq': 'main:session-http:1'}]}).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as resp:
        fb = json.load(resp)
    assert fb['ok'] is True and fb['session'] == 'dsh:session-http' \
        and fb['appended'] == 1, fb
    req = urllib.request.Request(base_ + '/feed',
                                 data=json.dumps({'job_id': 1, 'session': 'dsh:x',
                                                  'frames': []}).encode(),
                                 headers={'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(req, timeout=5)
        assert False, '双寻址必须 400'
    except Exception as e:  # noqa: BLE001 — HTTPError 即预期
        assert getattr(e, 'code', None) == 400, e
    with urllib.request.urlopen(base_ + '/view?session=dsh:session-http',
                                timeout=5) as resp:
        vb = json.load(resp)
    assert vb['session'] == 'dsh:session-http' \
        and [r['text'] for r in vb['rows']] == ['http 直投'], vb
    sb_before = set(hubsn._sbooks.keys())
    with urllib.request.urlopen(base_ + '/sessions', timeout=5) as resp:
        sb = json.load(resp)
    assert any(x['session'] == 'dsh:session-http' for x in sb['sessions']), sb
    assert sb['latest'] is not None and 'bindings' in sb
    assert set(hubsn._sbooks.keys()) == sb_before, hubsn._sbooks.keys()   # 清单绝不物化
    req = urllib.request.Request(base_ + '/bind',
                                 data=json.dumps({'session': 'dsh:session-http'}).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as resp:
        assert json.load(resp)['ok'] is True
    with urllib.request.urlopen(base_ + '/diag', timeout=5) as resp:
        dg = json.load(resp)
    assert dg['bindings']['dsh']['current'] == 'session-http', dg
    assert 'session_books_loaded' in dg and 'latest_session' in dg
    # god:<host> 视角（2026-09-21）：views 按宿主拆 god、读路径解析绑定会话
    with urllib.request.urlopen(base_ + '/views', timeout=5) as resp:
        vs = json.load(resp)
    vids = [v['id'] for v in vs['views']]
    assert 'god:dsh' in vids and 'god' not in vids, vids   # 有会话数据：god 分家
    assert [v for v in vs['views'] if v['id'] == 'god:dsh'][0]['host'] == 'dsh', vs
    with urllib.request.urlopen(base_ + '/view?view=god:dsh', timeout=5) as resp:
        gv = json.load(resp)
    assert gv['session'] == 'dsh:session-http' \
        and [r['text'] for r in gv['rows']] == ['http 直投'], gv
    with urllib.request.urlopen(base_ + '/view?view=god:nohost', timeout=5) as resp:
        gv2 = json.load(resp)
    assert gv2['session'] is None and gv2['rows'] == [], gv2   # 无数据宿主=空窗
    # WS：god:dsh 订阅 → 快照带 session；feed_session 实时推行（会话广播路由）
    c5 = _s.create_connection(('127.0.0.1', ports_), timeout=5)
    kk5 = base64.b64encode(os.urandom(16)).decode()
    c5.sendall(('GET /?view=god:dsh HTTP/1.1\r\nHost: 127.0.0.1:%d\r\n'
                'Upgrade: websocket\r\nConnection: Upgrade\r\n'
                'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n'
                % (ports_, kk5)).encode())
    bb5 = b''
    while b'\r\n\r\n' not in bb5:
        bb5 += c5.recv(4096)
    assert b'101' in bb5.split(b'\r\n')[0], bb5[:120]
    rf5 = c5.makefile('rb')
    snap5 = ws_read(rf5)
    assert snap5['ctrl'] == 'snapshot' and snap5.get('session') == 'dsh:session-http' \
        and [r['text'] for r in snap5['rows']] == ['http 直投'], snap5
    hubsn.feed_session('dsh:session-http', [
        {'kind': 'whisper', 'text': 'ws 实时行', 'src_seq': 'main:session-http:2'}])
    live5 = ws_read(rf5)
    assert live5.get('text') == 'ws 实时行', live5   # 行本体直达会话订阅者
    c5.close()
    # FEMO 会话名册（2026-09-21 主会话面板）：announce upsert/bind/delist 全语义
    def _post(path, body):
        req = urllib.request.Request(base_ + path,
                                     data=json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.load(resp)
    ra = _post('/sessions/announce', {'source': 'dsh', 'upsert': [
        {'sid': 'session-http', 'name': '主演彩排', 'job': 1948},
        {'sid': 'session-b', 'name': ''}]})
    assert ra['ok'] is True and ra['host'] == 'dsh' and ra['active'] == 2, ra
    assert 'session-b' not in hubsn.bindings_view()['dsh']['mains'], \
        hubsn.bindings_view()   # announce 不带 bind 绝不动绑定
    rb = _post('/sessions/announce', {'source': 'dsh', 'bind': 'session-b',
                                      'upsert': [{'sid': 'session-b', 'name': '二号机'}]})
    assert rb['bound'] == 'session-b', rb
    assert hubsn.bindings_view()['dsh']['current'] == 'session-b'
    assert hubsn.bindings_view()['dsh']['mains'][-1] == 'session-b'   # 说话即绑：上台即入榜
    rj = _post('/sessions/announce', {'source': 'dsh',
                                      'upsert': [{'sid': 'session-http', 'name': '主演彩排', 'job': 1999}]})
    assert rj['ok'] is True, rj   # 换 job：幂等路径上的字段更新
    rd = _post('/sessions/announce', {'source': 'dsh', 'delist': ['session-b']})
    assert rd['active'] == 1, rd   # delist 降级不删档
    _post('/sessions/announce', {'source': 'dsh',
                                 'upsert': [{'sid': 'session-b', 'name': '二号机'}]})
    rz = _post('/sessions/announce', {'source': 'zcode',
                                      'upsert': [{'sid': 'z-1', 'name': 'zcode 席'}]})
    assert rz['host'] == 'zcode' and rz['active'] == 1, rz   # 多宿主分格不串
    # 宿主 UI 顺序：order 照单全收（hub 只存不判）；order 外的 sid 垫尾
    ro = _post('/sessions/announce', {'source': 'dsh', 'order': [
        'session-b', 'ghost-x', 'session-http']})
    assert ro['ok'] is True, ro
    with urllib.request.urlopen(base_ + '/sessions', timeout=5) as resp:
        sb2 = json.load(resp)
    dsh_order = [e['sid'] for e in sb2['roster']['dsh']]
    assert dsh_order == ['session-b', 'session-http'], \
        dsh_order   # ghost-x 不在册被滤掉；此时名册只有这两个 sid（bindings 主会话账不进名册）
    with urllib.request.urlopen(base_ + '/sessions', timeout=5) as resp:
        sb2 = json.load(resp)
    assert 'roster' in sb2 and 'hosts' in sb2, sb2.keys()
    dsh_entries = {e['sid']: e for e in sb2['roster']['dsh']}
    assert dsh_entries['session-http']['name'] == '主演彩排', sb2['roster']
    assert dsh_entries['session-http']['job'] == 1999, dsh_entries   # 最新场次随名册走
    assert dsh_entries['session-b'].get('job') is None, dsh_entries   # 没报过 job=缺省
    assert any(e['sid'] == 'z-1' for e in sb2['roster']['zcode']), sb2['roster']
    try:
        _post('/sessions/announce', {'upsert': [{'sid': 'x', 'name': 'y'}]})
        assert False, '无 source 必须拒收（名册必须知宿主）'
    except Exception as e:  # noqa: BLE001 — HTTPError 即预期
        assert getattr(e, 'code', None) == 400, e
    # 名册与绑定一样从盘上回血（重启不丢）
    hubroster = ProjectionHub(data_dir=tmp)
    assert any(e['sid'] == 'session-http' and e['name'] == '主演彩排'
               for e in hubroster.roster_view()['dsh']), hubroster.roster_view()
    assert hubroster.bindings_view()['dsh']['current'] == 'session-b'
    hubsn.stop_server()

    # ── 主 session ↔ 场次 跨宿主联动（2026-09-22）：显式换绑/改场次按 owners
    #    班底账本给各宿主设绑，无关宿主清「-」；说话即绑（announce）不联动 ──
    tmp2 = tempfile.mkdtemp(prefix='femo-hub-link-')
    hublk = ProjectionHub(data_dir=tmp2)
    hublk.announce('dsh', upserts=[{'sid': 'm-dsh', 'name': 'dsh 主会话', 'job': 3001}])
    hublk.announce('zcode', upserts=[{'sid': 'm-zcode', 'name': 'zcode 主会话', 'job': 3002}])
    hublk.set_owner(3001, 'm-dsh', 'dsh')
    hublk.set_owner(3001, 'm-zcode', 'zcode')     # 3001 = 两台联机共演
    hublk.set_owner(3002, 'm-zcode', 'zcode')     # 3002 = zcode 独演
    # ① 换绑 dsh 主 session（其最新场 3001）→ zcode 按账本跟到 m-zcode
    out = hublk.bind('dsh:m-dsh')
    assert out['ok'] is True and out['job'] == 3001 and out['linked'] >= 1, out
    bv = hublk.bindings_view()
    assert bv['dsh']['current'] == 'm-dsh' and bv['zcode']['current'] == 'm-zcode', bv
    # ② 换绑 zcode（其最新场 3002 独演）→ dsh 与这场无关 → current 清「-」
    out = hublk.bind('zcode:m-zcode')
    assert out['ok'] is True and out['job'] == 3002, out
    bv = hublk.bindings_view()
    assert bv['zcode']['current'] == 'm-zcode' and bv['dsh']['current'] is None, bv
    # ③ 说话即绑（announce 路径）不联动：dsh 说话只动 dsh，zcode 保持原样不被掰
    hublk.announce('dsh', bind_sid='m-dsh')
    bv = hublk.bindings_view()
    assert bv['dsh']['current'] == 'm-dsh' and bv['zcode']['current'] == 'm-zcode', bv
    # ④ 改场次 3001 → 按账本两台都设回去；名册新客与本场无关 → 保持「-」
    hublk.announce('third', upserts=[{'sid': 'm-third', 'name': '第三席', 'job': 3003}])
    out = hublk.bind_job(3001)
    assert out['ok'] is True and out['job'] == 3001, out
    bv = hublk.bindings_view()
    assert bv['dsh']['current'] == 'm-dsh' and bv['zcode']['current'] == 'm-zcode', bv
    assert bv['third']['current'] is None, bv
    # ⑤ 改「最新」（job 空）→ latest_job()（feed 一行把指针拨到 3002）
    hublk.feed(3002, [{'kind': 'narrate', 'text': '有行', 'src_seq': 'main:m-zcode:9'}])
    out = hublk.bind_job('')
    assert out['ok'] is True and out['job'] == 3002, out
    bv = hublk.bindings_view()
    assert bv['zcode']['current'] == 'm-zcode' and bv['dsh']['current'] is None, bv
    # ⑥ 冷启动：owners 从盘上 cast.json 回血后，联动照常
    hublk2 = ProjectionHub(data_dir=tmp2)
    out = hublk2.bind_job(3001)
    assert out['ok'] is True and out['job'] == 3001, out
    bv = hublk2.bindings_view()
    assert bv['dsh']['current'] == 'm-dsh' and bv['zcode']['current'] == 'm-zcode', bv
    # ⑦ god 族订阅解析（2026-09-22）：裸 god 升级目标=「最新场」班底的上帝窗
    #   （2026-10-03 起读视角规则单源 view_plan——旧「最近活动账本宿主」启发式
    #   退役，升级不掺和 job 的设计不变，只是目标跟了最新场的班底）。
    sub_b = _Sub(None, 'god')
    ret = hublk._resolve_god_sub('god', sub_b)   # 最新场 j3002=zcode 独演：升级 zcode
    assert ret == 'god:zcode' and sub_b.god_host == 'zcode' \
        and sub_b.sess == ('zcode', 'm-zcode') and sub_b._via_god, \
        (ret, sub_b.god_host, sub_b.sess)
    hublk.feed_session('dsh:m-dsh', [{'kind': 'narrate', 'text': '戏外一行',
                                      'src_seq': 'main:m-dsh:1'}])
    sub_c = _Sub(None, 'god')
    ret = hublk._resolve_god_sub('god', sub_c)          # 班底没变：仍升 god:zcode
    assert ret == 'god:zcode' and sub_c.god_host == 'zcode' \
        and sub_c.sess == ('zcode', 'm-zcode') and sub_c._via_god, \
        (ret, sub_c.god_host, sub_c.sess)
    # ⑧ god:<host> 兜底（2026-09-22 用户报「点哪个显示的根本不是那场」）：
    #    session 账本无内容而订阅带明确场次 → 直接读那场 job 账本。
    #    third 没绑过主 session（current=None）→ 解析不到账本 → 兜底 j3001。
    hublk.feed(3001, [{'kind': 'narrate', 'text': '戏内一行',
                       'src_seq': 'main:m-zcode:11'}])
    sub_d = _Sub(3001, 'god:third')
    sub_d.god_host = 'third'
    _HubHandler._push_snapshot(hublk, sub_d, 0, via_god=True)
    _ = json.loads(sub_d.q.get(timeout=2))              # view-echo
    snapd = json.loads(sub_d.q.get(timeout=2))
    assert snapd['job'] == 3001 and snapd.get('god_fallback_job') == 3001 \
        and len(snapd['rows']) == 1, snapd
    # ⑧b 开屏（订阅不带场次）也兜底：session 账本空 → 反查名册里它的最新场
    hublk.announce('dsh', upserts=[{'sid': 'm-fresh', 'name': '新客', 'job': 3002}])
    hublk._bind_locked('dsh', 'm-fresh')                # 绑到一本不存在的账
    sub_e = _Sub(None, 'god:dsh')
    sub_e.god_host = 'dsh'
    _HubHandler._push_snapshot(hublk, sub_e, 0, via_god=True)
    _ = json.loads(sub_e.q.get(timeout=2))              # view-echo
    snape = json.loads(sub_e.q.get(timeout=2))
    assert snape['job'] == 3002 and snape.get('god_fallback_job') == 3002 \
        and len(snape['rows']) >= 1, snape
    # ⑨ 升级目标只认名册宿主：无 announcer 的残渣账本不许抢开屏（feed 的
    #    「首见即主」扶正挡不住，过滤必须看 roster）
    hublk.feed_session('ghost2:gs1',
                       [{'kind': 'narrate', 'text': 'x',
                         'src_seq': 'main:gs1:1'}])
    gh9 = hublk._latest_god_host()
    assert gh9 in ('dsh', 'zcode', 'third'), gh9         # ghost2（无名义）被过滤
    # ⑩ 视角跟随（2026-09-22 用户报「要看的其实是 standalone god」）：换绑后
    #    订阅的宿主与这场无关（绑定被清）→ god 订阅自动跟到该场班底的宿主。
    sub_f = _Sub(None, 'god:dsh')
    sub_f.god_host = 'dsh'
    hublk._subs.add(sub_f)
    hublk.bind_job(3002)                                 # 3002=zcode 独演 → dsh 被清
    assert sub_f.god_host == 'zcode' and sub_f.echo_view == 'god:zcode', \
        (sub_f.god_host, sub_f.echo_view)
    fb_frames = [sub_f.q.get(timeout=2) for _ in range(2)]   # echo + snapshot（排空防串味）
    hublk._subs.discard(sub_f)
    # ⑪ 绑定空的宿主不许拿旧账本冒充内容：god:dsh 解析在 current 空时无账本
    #    （不回落最近活动账本），有场次意图就走兜底。
    hublk._bind_locked('dsh', 'm-void')                  # 绑一本不存在的账
    sub_g = _Sub(3001, 'god:dsh')
    sub_g.god_host = 'dsh'
    _HubHandler._push_snapshot(hublk, sub_g, 0, via_god=True)
    _ = json.loads(sub_g.q.get(timeout=2))               # view-echo
    snapg = json.loads(sub_g.q.get(timeout=2))
    assert snapg['job'] == 3001 and snapg.get('god_fallback_job') == 3001, snapg
    # ⑪b 兜底链收尾（2026-10-03 用户报「刷新后 job 显示对、下面却空，非得重选
    #    一次」实案根治）：订阅不带场次（job_id=None——刷新无参 boot 的常态）+
    #    会话账本存在但空（m-void）+ 会话没链到任何场——fb_job 到此为 None，
    #    旧码兜底整条断掉、空帧直达页面（升级帧与 ctrl:view 快照双中招）。
    #    收尾=跟「最新」（latest_job，与场次下拉「最新」同义）：刷新即见最新场。
    sub_k = _Sub(None, 'god:dsh')
    hublk._resolve_god_sub('god:dsh', sub_k)
    _HubHandler._push_snapshot(hublk, sub_k, 0, via_god=True)
    _ = json.loads(sub_k.q.get(timeout=2))               # view-echo
    snapk = json.loads(sub_k.q.get(timeout=2))
    assert snapk['job'] is not None and snapk.get('god_fallback_job') == snapk['job'] \
        and len(snapk['rows']) >= 1, snapk
    # ⑫ 宿主能力申报 god_window（2026-09-28）：申报了「没有上帝窗」的宿主——
    #    ①视角清单不出它的 god:<host> 条目；②裸 god 升级绝不落它头上；
    #    ③视角跟随不跟到它（没得跟就不跟，内容由 job 账本兜底接住）。
    hublk.register_host('webfoo', god_window=False)
    hublk.feed_session('webfoo:ws1',
                       [{'kind': 'narrate', 'text': 'x', 'src_seq': 'main:ws1:1'}])
    ids12 = [v['id'] for v in hublk.views()['views']]
    assert 'god:webfoo' not in ids12 and 'stage' in ids12, ids12
    assert hublk._latest_god_host() != 'webfoo', hublk._latest_god_host()
    sub_h = _Sub(None, 'god')
    ret = hublk._resolve_god_sub('god', sub_h)
    assert ret != 'god:webfoo' and sub_h.god_host != 'webfoo', (ret, sub_h.god_host)
    hublk.set_owner(3004, 'ws1', 'webfoo')               # webfoo 独演一场
    sub_i = _Sub(None, 'god:dsh')
    sub_i.god_host = 'dsh'
    hublk._subs.add(sub_i)
    hublk.bind_job(3004)
    assert sub_i.god_host == 'dsh', sub_i.god_host       # 不跟到无上帝窗的宿主
    _ = sub_i.q.get(timeout=2); _ = sub_i.q.get(timeout=2)   # echo + snapshot 排空
    hublk._subs.discard(sub_i)

    # ⑬ 视角规则单源 view_plan（2026-10-03 用户拍板「规则应该统一放到一处，
    #    写个 def 专门算每个 job 的视角，其他地方读」）：清单只出「本场班底 ∪
    #    本场登场 ∩ god_window 申报」的 god: 条目——
    #    ①web 独演场（申报无上帝窗）：god 清单空、god_default 落裸 god（读本场
    #      job 账本），清单里不再出现其他宿主的上帝窗（用户实报「web 端开的场，
    #      其他宿主压根不知道这个 job 的存在，不应该显示其他宿主的上帝视角」）；
    #    ②dsh 独演场：只出 god:dsh，别家不出；
    #    ③残渣账本宿主（ghost2 有会话账本、不是任何场班底）：不上任何清单。
    hublk.register_host('web', god_window=False)
    hublk.set_owner(3010, 'ws9', 'web')
    hublk.feed(3010, [{'kind': 'narrate', 'text': 'web 独演一行',
                       'src_seq': 'human:ws9:1', 'seg': 'w:web:wgx'}])
    p10 = hublk.view_plan(3010)
    assert p10['hosts'] == ['web'] and p10['god_hosts'] == [] \
        and p10['god_default'] == 'god', p10
    ids10 = [v['id'] for v in hublk.views(3010)['views']]
    assert 'god' in ids10 and not any(x.startswith('god:') for x in ids10), ids10
    hublk.set_owner(3011, 'm-solo', 'dsh')
    hublk.feed(3011, [{'kind': 'narrate', 'text': 'dsh 独演一行',
                       'src_seq': 'human:m-solo:1', 'seg': 'w:dsh:sgx'}])
    p11 = hublk.view_plan(3011)
    assert p11['hosts'] == ['dsh'] and p11['god_hosts'] == ['dsh'] \
        and p11['god_default'] == 'god:dsh', p11
    ids11 = [v['id'] for v in hublk.views(3011)['views']]
    assert 'god:dsh' in ids11 \
        and not any(x.startswith('god:') and x != 'god:dsh' for x in ids11), ids11
    assert 'ghost2' not in p11['hosts'] and 'ghost2' not in p11['god_hosts'], p11
    assert not any('ghost2' in v['id'] for v in hublk.views(3011)['views']), ids11

    # ⑭ prompt 槽显示规则（2026-10-03 用户定稿口径）：「prompt 只有人类输入的
    #    时候能看见。输入完就不用了」——等待席在册才放行（以席位镜像为准，不读
    #    行 open），收口/历史人类节点的 prompt 一概扣下；showprompt 相当于
    #    notice 永远公开；AI 的 prompt 全视角永不显示。stage 视角等待中同样
    #    放行（输入席在 stage 也亮，题跟着输入席走）。
    hublk.set_owner(3012, 'm-hs', 'dsh')
    hublk.feed(3012, [
        {'kind': 'section', 'role': 'human', 'seg': 'w:dsh:jw:human_ask', 'open': True,
         'items': [{'kind': 'showprompt', 'text': '幕布落下'},
                   {'kind': 'prompt', 'text': '请作答'}]},
        {'kind': 'section', 'role': 'human', 'seg': 'w:dsh:jw:human_done', 'open': False,
         'actor': '@人类',
         'items': [{'kind': 'prompt', 'text': '旧题'},
                   {'kind': 'say', 'text': '答过了'}]},
        {'kind': 'section', 'role': 'ai', 'seg': 'w:dsh:jw:ai_ask', 'open': True,
         'actor': '@AI', 'items': [{'kind': 'prompt', 'text': 'AI 的题'}]},
    ])
    hublk.set_waiting({'job_id': 3012, 'wait_key': 'jw:human_ask',
                       'seg': 'w:dsh:jw:human_ask', 'node': 'ask', 'actor': '@人类',
                       'scope': [], 'prompt': '请作答', 'host': 'dsh',
                       'out_vars': [], 'views': []})

    def _sec_kinds(view):
        out = {}
        for r in hublk.snapshot(3012, view)['rows']:
            if r.get('kind') == 'section':
                out[str(r.get('seg'))] = [i.get('kind') for i in (r.get('items') or [])]
        return out
    g14 = _sec_kinds('god')
    assert g14['w:dsh:jw:human_ask'] == ['showprompt', 'prompt'], g14    # 等待中双槽齐
    assert g14['w:dsh:jw:human_done'] == ['name', 'say'], g14            # 收口 prompt 扣下
    assert 'prompt' not in g14['w:dsh:jw:ai_ask'], g14                   # AI 永不显示
    s14 = _sec_kinds('stage')
    assert s14['w:dsh:jw:human_ask'] == ['showprompt', 'prompt'], s14    # stage 等待中同放行
    assert 'prompt' not in s14['w:dsh:jw:human_done'], s14
    # 收麦重播（2026-10-03 prompt 状态闸配套，用户实测稳定复现「交卷后提示挂到
    # 刷新」）：席位离册时该席段行重播 row-update——活页面不等刷新即时收敛。
    sub14 = _Sub(3012, 'god')
    hublk._subs.add(sub14)
    hublk.set_waiting(None)   # 全清                                                # 收麦（human_done 全清同款）
    f14 = None
    for _ in range(6):
        try:
            j14 = json.loads(sub14.q.get(timeout=2))
        except queue.Empty:
            break
        if j14.get('ctrl') == 'row-update' and j14.get('row', {}).get('seg') == 'w:dsh:jw:human_ask':
            f14 = j14
            break
    hublk._subs.discard(sub14)
    assert f14 is not None and [i['kind'] for i in f14['row']['items']] == ['showprompt'], f14
    g14b = _sec_kinds('god')
    assert g14b['w:dsh:jw:human_ask'] == ['showprompt'], g14b            # 席位不在册：prompt 扣下

    # ⑮ 跟最新订阅跨场跟随（2026-10-03 用户实报「按下运行后新 job 第一条不出字/
    #    不出内容，多少条都不出，刷新才好」实案根治）：页面无参=跟最新，升级目标
    #    定在载入那一刻——新场开在别家宿主后老订阅停在旧家（等待控制帧全场广播
    #    所以座位照出现，行内容全走会话维度匹配不上=不出字）。本场开演登记 owners
    #    即重对家（view-echo+重快照）；钉了场次的不动。
    tmpF = tempfile.mkdtemp()
    hubF = ProjectionHub(data_dir=tmpF)
    prF = EventProjector()
    prF.set_waiting_sink(hubF.set_waiting)
    # 第一场：zcode 独演（god_window 未申报=有）→ 无参页面升级 god:zcode
    hubF.set_owner(4001, 'm-z1', 'zcode')
    hubF.feed(4001, [{'kind': 'narrate', 'text': '旧场一行', 'src_seq': 'main:m-z1:1'}])
    subF = _Sub(None, 'god')
    hubF._resolve_god_sub('god', subF)
    assert subF.god_host == 'zcode' and subF._via_god, (subF.god_host, subF.echo_view)
    # 第二天按下运行：新场开在 web（申报无上帝窗）→ 跟随落回裸 god（读最新场账本）
    subP = _Sub(4001, 'god:zcode')                       # 钉了场次的对照：不动
    subP.god_host = 'zcode'
    hubF._subs.add(subF); hubF._subs.add(subP)
    hubF.set_owner(4002, 'm-w1', 'web')
    # web 在 hubF 未申报 god_window=false → 正常跟到 god:web（会话路径强制在册：
    # 开演瞬间绑定/账本未长出，_via_god 站住、行帧按 god_host 匹配）
    assert subF.god_host == 'web' and subF._via_god and subF.sess is None, \
        (subF.god_host, subF._via_god, subF.sess)
    assert subP.god_host == 'zcode', subP.god_host       # 钉场次不被劫走
    echoF = json.loads(subF.q.get(timeout=2))
    assert echoF == {'ctrl': 'view-echo', 'view': 'god:web'}, echoF
    snapF = None
    for _ in range(4):                                    # 跟随 echo + 快照自带 echo，取到快照为止
        m = json.loads(subF.q.get(timeout=2))
        if m.get('ctrl') == 'snapshot':
            snapF = m
            break
    assert snapF is not None and snapF.get('job') == 4002, snapF   # 快照对准新场（此刻 0 行=flow_start 未喂）
    hubF.feed(4002, [{'kind': 'narrate', 'text': '新场一行', 'src_seq': 'main:m-w1:1'}])
    # 会话路径在册的收益：新场行帧按 god_host 到达（无需刷新、无需重订阅）
    gotRow = None
    for _ in range(3):
        m = json.loads(subF.q.get(timeout=2))
        if 'ctrl' not in m:
            gotRow = m
            break
    assert gotRow is not None and gotRow.get('text') == '新场一行', gotRow
    # 第三场开回 dsh（申报了上帝窗）→ 跟随重升级 god:dsh（同款强制在册）
    hubF.set_owner(4003, 'm-d2', 'dsh')
    assert subF.god_host == 'dsh' and subF._via_god and subF.sess is None, \
        (subF.god_host, subF._via_god, subF.sess)
    echoF2 = json.loads(subF.q.get(timeout=2))
    assert echoF2['ctrl'] == 'view-echo' and echoF2['view'] == 'god:dsh', echoF2
    snapF2 = None
    for _ in range(4):
        m = json.loads(subF.q.get(timeout=2))
        if m.get('ctrl') == 'snapshot':
            snapF2 = m
            break
    assert snapF2 is not None and snapF2.get('job') == 4003, snapF2
    hubF.feed(4003, [{'kind': 'narrate', 'text': '三场一行', 'src_seq': 'main:m-d2:1'}])
    gotRow2 = None
    for _ in range(3):
        m = json.loads(subF.q.get(timeout=2))
        if 'ctrl' not in m:
            gotRow2 = m
            break
    assert gotRow2 is not None and gotRow2.get('text') == '三场一行', gotRow2
    hubF._subs.discard(subF); hubF._subs.discard(subP)

    # ── 投影页人类席交卷全链（2026-09-20）：等待镜像 → health/快照捎带 →
    #    REST/WS 两路交卷 → 驿站信封八维逐项对账 → wait_key 校验拒旧信/空转 ──
    hubi = ProjectionHub(data_dir=tmp)
    posted_box = []

    class _FakeBox:
        def post(self, **kw):
            posted_box.append(kw)
            return dict(kw, id='fake-1')
    hubi.set_mailbox(_FakeBox())
    hubi.set_waiting({'job_id': 99, 'wait_key': 'wI1', 'node': '[陈述]',
                      'actor': '@猫猫', 'scope': ['@猫猫'], 'prompt': '请发言',
                      'host': 'dsh', 'views': ['actor:dsh:@猫猫']})
    assert [s['wait_key'] for s in hubi.current_waiting()] == ['wI1']
    porti = start_hub_server(hubi, port=0)
    basei = 'http://127.0.0.1:%d' % porti
    with urllib.request.urlopen(basei + '/health', timeout=5) as resp:
        assert [s['wait_key'] for s in json.load(resp)['waiting']] == ['wI1']

    def _post_human(payload, expect):
        req = urllib.request.Request(basei + '/api/human-input',
                                     data=json.dumps(payload).encode(),
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                code, body = resp.status, json.load(resp)
        except urllib.error.HTTPError as exc:
            code, body = exc.code, json.loads(exc.read().decode('utf-8'))
        assert code == expect, (code, body)
        return body
    _post_human({'wait_key': 'WRONG', 'text': '旧信'}, 409)     # 旧信/伪造键拒收
    _post_human({'wait_key': 'wI1', 'text': '   '}, 400)       # 空文本无变量拒收
    b = _post_human({'wait_key': 'wI1', 'text': '我投 @Eve',
                     'variables': {'票': '@Eve'}}, 200)
    assert b['posted'] is True and len(posted_box) == 1, (b, posted_box)
    kw = posted_box[0]
    assert kw['job_id'] == 99 and kw['ref'] == 'wI1' and kw['target_host'] == 'dsh', kw
    assert kw['soul'] == '@猫猫' and kw['kind'] == 'speech' and kw['action'] == 'send', kw
    assert kw['delivery'] == 'urgent', kw
    assert kw['who_move'] == 'customer_hook' and kw['who_require'] == 'system_require', kw
    assert kw['body'] == {'chat_text': '我投 @Eve', 'variables': {'票': '@Eve'}}, kw

    # ── hub 唯一化：人类信寄信宿主优先级反转（2026-09-25 设计稿 §三）──────
    # 等待态自带的 host 优先（等待镜像是哪个宿主的桥推来的，信就寄给谁）；
    # 养桥注入的 _mailbox_host 降为等待态无 host 时的兜底。反转会卡死别家的戏
    # （复用模式下信被寄进养桥的格子，养桥捞走又丢弃）。
    hubj = ProjectionHub(data_dir=tmp)
    boxj = []

    class _BoxJ:
        def post(self, **kwj):
            boxj.append(kwj)
            return dict(kwj, id='fake-j')

    hubj.set_mailbox(_BoxJ())
    hubj.set_mailbox_host('bridge-B')
    hubj.set_waiting({'job_id': 7, 'wait_key': 'wJ1', 'node': '[陈述]',
                      'actor': '@猫猫', 'scope': ['@猫猫'], 'prompt': '请发言',
                      'host': 'bridge-A', 'views': []})
    codej, outj = hubj.human_input('wJ1', '投甲')
    assert codej == 200 and boxj[0]['target_host'] == 'bridge-A', (codej, boxj)
    hubj.set_waiting({'job_id': 7, 'wait_key': 'wJ2', 'node': '[陈述]',
                      'actor': '@猫猫', 'scope': ['@猫猫'], 'prompt': '请发言',
                      'host': '', 'views': []})
    hubj.human_input('wJ2', '兜底')
    assert boxj[1]['target_host'] == 'bridge-B', boxj

    def _ws_open(px, query=''):
        cc = _s.create_connection(('127.0.0.1', px), timeout=5)
        kk = base64.b64encode(os.urandom(16)).decode()
        cc.sendall(('GET /?%s HTTP/1.1\r\nHost: 127.0.0.1:%d\r\n'
                    'Upgrade: websocket\r\nConnection: Upgrade\r\n'
                    'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n'
                    % (query, px, kk)).encode())
        bb = b''
        while b'\r\n\r\n' not in bb:
            bb += cc.recv(4096)
        assert b'101' in bb.split(b'\r\n')[0], bb[:120]
        return cc, cc.makefile('rb')
    ci, rfi = _ws_open(porti, 'view=stage')

    def _ws_read_msg(r):
        h = _read_exact(r, 2)
        ln = h[1] & 0x7F
        if ln == 126:
            ln = struct.unpack('>H', _read_exact(r, 2))[0]
        elif ln == 127:
            ln = struct.unpack('>Q', _read_exact(r, 8))[0]
        return json.loads(_read_exact(r, ln).decode('utf-8'))
    snapi = _ws_read_msg(rfi)
    assert snapi['ctrl'] == 'snapshot' and \
        [s.get('wait_key') for s in (snapi.get('waiting') or [])] == ['wI1'], \
        snapi.get('waiting')

    def _ws_send(conn, obj):
        payload = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        header = bytearray([0x81])
        n = len(payload)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack('>H', n)
        else:
            header.append(0x80 | 127)
            header += struct.pack('>Q', n)
        mask = os.urandom(4)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        conn.sendall(bytes(header) + masked)
    _ws_send(ci, {'ctrl': 'human-input', 'wait_key': 'wI1', 'text': 'WS 路也到'})
    resi = _ws_read_msg(rfi)
    assert resi['ctrl'] == 'human-input-result' and resi['ok'] is True \
        and resi.get('wait_key') == 'wI1', resi
    assert len(posted_box) == 2 and posted_box[1]['ref'] == 'wI1', posted_box
    hubi.set_waiting(None)
    wclr = _ws_read_msg(rfi)
    assert wclr['ctrl'] == 'waiting' and wclr['waiting'] == [], wclr   # 收麦广播（空清单=全视角熄输入框）
    _ws_send(ci, {'ctrl': 'human-input', 'wait_key': 'wI1', 'text': '迟到的信'})
    resi = _ws_read_msg(rfi)
    assert resi['ctrl'] == 'human-input-result' and resi['ok'] is False, resi
    ci.close()

    # ── 落幕扫除（2026-09-21 用户拍板）：play_end 落账=扳机，「建立了段但没发言」
    # 的段整行删除（人类旁路空段 + 问了没人答的段），有角色产出的一律保留。
    # job 账本与织入的会话账本各扫各的。
    tmp9 = tempfile.mkdtemp(prefix='femo-hub-sweep-')
    hub9 = ProjectionHub(data_dir=tmp9)
    hub9.set_owner(91, 'sess-sweep', host='dsh')
    prS = EventProjector()
    prS.set_host('dsh')   # 【多宿主】新版桥产的段键恒带 host 段（裸键形态已退役）
    f9 = []
    f9 += prS.on_event('ai_request', {'node_name': 'nAI', 'wait_key': 'wAI',
                                      'actor_name': '甲',
                                      'blocks': {'showprompt': '甲的提问', 'prompt': '甲的指令'}})
    f9 += prS.on_post_speech({'wait_key': 'wAI', 'payload': '甲说了',
                              'body': {'steps': [{'cot': '甲想'}]}})
    f9 += prS.on_event('human_wait', {'node_name': '[chat_human]', 'wait_key': 'wHU',
                                      'actor_name': '猫猫', 'scope': ['猫猫']})   # 无 prompt：开段即全空
    f9 += prS.on_event('human_wait', {'node_name': '[ask]', 'wait_key': 'wASK',
                                      'actor_name': '乙', 'scope': ['乙'],
                                      'prompt': '乙被问却没答'})
    res9 = hub9.feed(91, f9, source='dsh')
    assert res9['failed'] == [] and res9['appended'] == 3, res9   # 3 个开段（交卷是原位改写）
    assert [r['n'] for r in hub9.snapshot(91, 'god')['rows']] == [1, 2, 3]
    # 幕落：收口帧（草稿转正）在前、play_end 收尾——与 EventProjector.flow_done 同构
    f9end = prS.on_event('flow_done', {'summary': '完'})
    assert f9end[-1]['kind'] == 'play_end'
    hub9.feed(91, f9end, source='dsh')
    god9 = hub9.snapshot(91, 'god')['rows']
    # 甲的段（有 cot+台词）保留；猫猫的空旁路段、乙的只剩提问槽的段=没发言，整行拆除；
    # play_end 自占 n=4（被拆的 2/3 行号不回收）
    assert [(r['n'], r.get('actor'), r.get('kind')) for r in god9] \
        == [(1, '甲', 'section'), (4, '', 'play_end')], god9
    assert [i['kind'] for i in god9[0]['items']][:2] == ['showprompt', 'name'] and 'cot' in [i['kind'] for i in god9[0]['items']]
    # journal 真身同步删行：两空段原位留墓碑（幂等键在、行数不计）
    with open(os.path.join(tmp9, '91', 'journal.jsonl'), encoding='utf-8') as _f9h:
        _rows9 = [json.loads(_l9) for _l9 in _f9h if _l9.strip()]
    assert len(_rows9) == 4, len(_rows9)
    _tomb9 = [r for r in _rows9 if r.get('del')]
    assert len(_tomb9) == 2 and all(_t['src_seq'].startswith('seg:') for _t in _tomb9), _tomb9
    # 重启冷加载：墓碑收割幂等键——晚到的重放开段帧不得把空段诈尸回来
    hub9b = ProjectionHub(data_dir=tmp9)
    assert [r['n'] for r in hub9b.snapshot(91, 'god')['rows']] == [1, 4], '冷加载须与内存一致'
    r9c = hub9b.feed(91, [{'op': 'seg-open', 'seg': 'w:dsh:wHU', 'actor': '猫猫'}], source='dsh')
    assert r9c['appended'] == 0, r9c   # 墓碑拦住开段帧
    # 行号不回收：落幕后再来的行接着 5 排
    hub9b.feed(91, [{'op': 'row', 'zone': 'inplay', 'kind': 'say',
                     'actor': '甲', 'text': '落幕后的加演'}])
    assert hub9b.snapshot(91, 'god')['rows'][-1]['n'] == 5
    # 织入侧：会话账本里的空段副本同样被扫掉（各自落 play_end 各自扫），有货的段还在
    sess9 = hub9b.snapshot_session('dsh:sess-sweep', 'god')['rows']
    assert [r.get('seg') for r in sess9 if r.get('kind') == 'section'] == ['w:dsh:wAI'], sess9

    # ── cast 选角账（会话↔角色绑定；提名制 2026-09-26 改判）──────────────
    hub10 = ProjectionHub(data_dir=tmp)
    # 提名：多会话可同提一个 soul（无占用拒绝），最后指派算数
    assert hub10.cast_preference_set('dsh', 's1', '小猫') == {'ok': True}
    assert hub10.cast_preference_set('deepseek', 'tab9', '小猫')['ok']   # 同 soul 第二票
    view = hub10.cast_preferences_view()
    assert view['bindings']['小猫'] == {'sid': 'tab9', 'host': 'deepseek'}, view
    # 单槽直顶：会话提新 soul 直接换，免先退票
    assert hub10.cast_preference_set('dsh', 's1', 'Eve')['ok']
    view = hub10.cast_preferences_view()
    assert view['bindings'] == {'小猫': {'sid': 'tab9', 'host': 'deepseek'},
                                'Eve': {'sid': 's1', 'host': 'dsh'}}, view
    # 定格：按最新提名选举誊写 + 单条登记（幂等覆盖）+ 读回
    snap = hub10.cast_job_snapshot(77)
    assert snap == {'ok': True, 'count': 2}, snap
    assert hub10.cast_entry_put(77, 'main', 'owner-sid', 'dsh')['ok']
    assert hub10.cast_entry_put(77, '小猫', 'femo-actor-j77-x', 'deepseek')['ok']
    job77 = hub10.cast_job(77)
    assert job77['cast']['小猫']['sid'] == 'femo-actor-j77-x', job77   # 实际执行体登记覆盖提名
    assert job77['cast']['main']['sid'] == 'owner-sid', job77
    assert hub10.cast_job(78)['cast'] == {}                            # 无档=空账
    # 演出中改提名不影响在跑的戏：第三会话抢提 + 定格重入只补空位不覆写
    assert hub10.cast_preference_set('dsh', 's2', '小猫')['ok']
    snap2 = hub10.cast_job_snapshot(77)
    assert snap2 == {'ok': True, 'count': 0}, snap2                    # 小猫/Eve/main 已有，全跳过
    assert hub10.cast_job(77)['cast']['小猫']['sid'] == 'femo-actor-j77-x'
    assert hub10.cast_job_snapshot(78) == {'ok': True, 'count': 2}     # 新戏按最新提名重选
    assert hub10.cast_job(78)['cast']['小猫']['sid'] == 's2'
    # 退票：退掉当选者，剩余旧票中 seq 最大者自动顶上；全退光=角色自由身
    assert hub10.cast_preference_set('dsh', 's2', None)['ok']
    assert hub10.cast_preferences_view()['bindings']['小猫'] == {'sid': 'tab9', 'host': 'deepseek'}
    assert hub10.cast_preference_set('deepseek', 'tab9', None)['ok']
    assert '小猫' not in hub10.cast_preferences_view()['bindings']
    # 冷加载一致（新 hub 实例读同一目录）
    hub10b = ProjectionHub(data_dir=tmp)
    assert hub10b.cast_job(77)['cast']['Eve']['sid'] == 's1'
    assert hub10b.cast_preferences_view()['bindings']['Eve']['sid'] == 's1'

    # ── cast 在线口径（2026-09-28 拍板：分配灵魂以当前在线为准）──────────
    # 只认在线宿主（门铃簿活心跳）里的提名：不在线宿主上更新的同 soul 提名
    # 按没提过算。视图与开演定格同吃这一判据（_cast_prefs_scoped 唯一一份）。
    hub10.set_doorbell_live_hosts(lambda: ['dsh'])          # 只有 dsh 在线
    hub10.cast_preference_set('dsh', 's3', '小猫')           # dsh 的旧票
    hub10.cast_preference_set('deepseek', 'tab9', '小猫')    # deepseek 更新的同 soul 票
    _v10a = hub10.cast_preferences_view('all')
    assert _v10a['bindings']['小猫'] == {'sid': 'tab9', 'host': 'deepseek'}, _v10a  # 全账最新者赢
    _v10b = hub10.cast_preferences_view('online')
    assert _v10b['bindings']['小猫'] == {'sid': 's3', 'host': 'dsh'}, _v10b        # 在线视图：deepseek 整格不在
    assert 'deepseek' not in _v10b['hosts'], _v10b
    snap79 = hub10.cast_job_snapshot(79)                    # 定格同判据：选 dsh 的旧票
    assert snap79 == {'ok': True, 'count': 2}, snap79       # Eve(dsh s1) + 小猫(dsh s3)
    assert hub10.cast_job(79)['cast']['小猫']['host'] == 'dsh', hub10.cast_job(79)
    hub10.set_doorbell_live_hosts(lambda: [])               # 全离线：无可选人
    assert hub10.cast_job_snapshot(80) == {'ok': True, 'count': 0}
    hub10.set_doorbell_live_hosts(None)                     # 判据缺失（单跑 hub/测试）：退化全账
    snap81 = hub10.cast_job_snapshot(81)
    assert snap81 == {'ok': True, 'count': 2}, snap81       # 退化全账：Eve + 小猫（deepseek 新票赢）
    assert hub10.cast_job(81)['cast']['小猫']['host'] == 'deepseek'

    # ── hub 唯一化：HubClient 双模客户端（2026-09-25）────────────────────
    # ① 复用模式：地址簿指向活 hub → 不自起、不覆写地址簿，喂送/登记全走
    #    HTTP，落进同一本账。
    hubk = ProjectionHub(data_dir=tmp)
    portk = start_hub_server(hubk, port=0)          # 自起+写地址簿（模拟养桥）
    ck = HubClient(data_dir=tmp)
    namek = ck.connect('Client A')
    assert ck.local is False and ck.port == portk, (ck.local, ck.port)
    assert namek == 'Client_A', namek               # 归一名与 local 模式同函数同果
    assert ck.feed(50, [{'op': 'row', 'zone': 'inplay', 'kind': 'say',
                         'actor': '@A', 'text': '一行'}],
                   source=namek)['appended'] == 1
    rows50 = hubk.snapshot(50, 'god')['rows']
    assert rows50[-1]['text'] == '一行' and not rows50[-1].get('host'), rows50[-1]
    assert ck.has_owner(50) is False                # 信任账查询（GET /owner）
    ck.set_owner(50, 'sess-k', host=namek)
    assert ck.has_owner(50) is True and hubk.host_book(50) == {'Client_A': ['sess-k']}
    ck.set_cast(50, ['@A', '@B'])
    assert hubk._cast.get(50) == ['@A', '@B']
    ck.remember_display(50, '@A（猫猫）')
    assert any('猫猫' in v for v in hubk._display[50].values())
    ck.set_waiting({'job_id': 50, 'wait_key': 'wK1', 'host': 'Client_A',
                    'views': []})
    assert [s['wait_key'] for s in hubk.current_waiting()] == ['wK1']
    with open(os.path.join(tmp, 'hub.json'), encoding='utf-8') as f:
        assert json.load(f)['port'] == portk        # 复用模式绝不覆写地址簿
    # 复用模式三注入=记录在案的无操作（驿站/信箱宿主/解析器都不上远端 hub）
    ck.set_mailbox(None)
    ck.set_mailbox_host('x')
    ck.set_owner_resolver(lambda job: None)
    assert hubk._mailbox is None and hubk._owner_resolver is None

    # ② 代拉模式（第1步 常驻化）：无地址簿 → 代拉（自检注入进程内假代拉，
    #    不起真子进程）→ 复用之。本进程永不养 hub——local 恒 False。
    #    （端口护栏：resolve_port 缺省从 8790 起真绑——自检跑在开发机上会撞
    #    生产 hub 的端口段；压成 0=随机ephemeral，全程不碰 8790+。）
    _saved_port_env = os.environ.get('FEMO_PROJECTION_PORT')
    os.environ['FEMO_PROJECTION_PORT'] = '0'
    try:
        tmpL = tempfile.mkdtemp(prefix='femo-hub-client-local-')
        held = []

        def fake_spawner(dd):
            h = ProjectionHub(data_dir=dd)
            held.append((h, start_hub_server(h)))

        cl = HubClient(data_dir=tmpL, spawner=fake_spawner)
        namel = cl.connect('Local A')
        assert cl.local is False and cl.port > 0 and namel == 'Local_A', (cl.local, namel)
        assert os.path.isfile(os.path.join(tmpL, 'hub.json'))
        assert cl.feed(1, [{'kind': 'narrate', 'text': '代拉'}],
                       source=namel)['appended'] == 1
        for h, _port in held:
            h.stop_server()                             # 干净停机撤地址簿
        assert not os.path.isfile(os.path.join(tmpL, 'hub.json'))

        # ③ 死址接管：地址簿指向死端口 → 探活失败 → 代拉（接管语义：新 hub
        #    覆写死址）。daemon 的活者接管同款在 femo_daemon.py 竞态自裁段。
        tmpD = tempfile.mkdtemp(prefix='femo-hub-client-dead-')
        with open(os.path.join(tmpD, 'hub.json'), 'w', encoding='utf-8') as f:
            json.dump({'host': '127.0.0.1', 'port': 1, 'pid': 0, 'started': 0}, f)
        held_d = []

        def fake_spawner_d(dd):
            h = ProjectionHub(data_dir=dd)
            held_d.append((h, start_hub_server(h)))

        cd = HubClient(data_dir=tmpD, spawner=fake_spawner_d)
        named = cd.connect('Dead A')
        assert cd.local is False and named == 'Dead_A', (cd.local, named)
        assert json.load(open(os.path.join(tmpD, 'hub.json'), encoding='utf-8')
                         )['port'] == cd.port           # 代拉接管覆写死址
        for h, _port in held_d:
            h.stop_server()
    finally:
        if _saved_port_env is None:
            os.environ.pop('FEMO_PROJECTION_PORT', None)
        else:
            os.environ['FEMO_PROJECTION_PORT'] = _saved_port_env

    # ④ failover 一期：连续「连接不上」计满阈值 → 大声留痕（不热接管）；
    #    业务错误（HTTPError）不计死亡——喂的数据问题修数据，不换 hub。
    cf = HubClient(data_dir=tmp)
    cf._remote = True
    cf._base = 'http://127.0.0.1:1'                 # 死端口
    for _ in range(HubClient.FAIL_THRESHOLD):
        try:
            cf.has_owner(50)
        except Exception:
            pass
    assert cf._dead_announced is True and cf._fails >= HubClient.FAIL_THRESHOLD
    cb = HubClient(data_dir=tmp)
    cb._remote = True
    cb._base = 'http://127.0.0.1:%d' % portk        # 活 hub：业务错误面
    try:
        cb._post('/no-such-path', {})               # 404=hub 的应答——不计死亡
    except Exception:
        pass
    assert cb._fails == 0 and cb._dead_announced is False

    print('projection_hub selftest ok  (dir=%s)' % tmp)


def main():
    ap = argparse.ArgumentParser(description='femo projection hub')
    ap.add_argument('--port', type=int, default=0)
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--data-dir', default=None)
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()
    if args.selftest:
        _selftest()
        return
    hub = ProjectionHub(data_dir=args.data_dir)
    port, _th = hub.start_server(host=args.host, port=args.port)
    print('[projection-hub] serving on http://%s:%d (dir=%s)' % (args.host, port, hub.dir_path))
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        hub.stop_server()


if __name__ == '__main__':
    main()
