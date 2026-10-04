# -*- coding: utf-8 -*-
"""谁是卧底：发牌、顺序、投票计票、胜负判定。

设计要点：
- 发牌（deal_cards）同狼人杀 assign_roles：全员盲抽，返回字典，FEMO 侧 out: 按 key 接。
- 判定（process_votes / next_round_stage / verdict）全在这里做，剧本里不写业务逻辑。
- 名字统一用 "@名" 形式（和 vars 里的 @actor 列表一致）。
- 2026-09-12 起支持**双卧底**：两个卧底各拿一个不同的相近词（都区别于平民词），
  场上因此有三张不同的牌在走——平民要靠"谁跟谁对不上"抓两个人。白板仍是 1 人。
"""

import json
import os
import random
import re
from datetime import datetime

# ---------------------------------------------------------------- 词库
# 每对 (平民词, 卧底词)。双卧底局里卧底词有两个：优先从本对取，再从不含平民词的
# 其它对里随机挑一个（三张牌互不相同，也不会出现"卧底词撞平民词"）。
DECK = [
    ("牛奶",   "豆浆"),
    ("牙膏",   "洗面奶"),
    ("可乐",   "雪碧"),
    ("电风扇", "空调"),
    ("拖鞋",   "凉鞋"),
    ("泡面",   "拌面"),
    ("日记",   "周记"),
    ("蜡烛",   "台灯"),
    ("口香糖", "薄荷糖"),
    ("睫毛膏", "眼线笔"),
    ("火锅",   "麻辣烫"),
    ("围巾",   "丝巾"),
    ("公交车", "地铁"),
    ("雨伞",   "阳伞"),
    ("枕头",   "抱枕"),
    ("手电筒", "探照灯"),
    ("电影院", "剧院"),
    ("橡皮擦", "修正带"),
    ("冰淇淋", "雪糕"),
    ("键盘",   "钢琴"),
]

BLANK_WORD = "？？？"


def _as_name(v):
    """把 @actor 引用归一化成名字字符串（个别通道会把 @actor 解析成 dict）。"""
    if isinstance(v, dict):
        v = v.get("name", "") or ""
    return str(v).strip() if v is not None else ""


def _pick_text(deck):
    if deck is None:
        deck = DECK
    try:
        pairs = list(deck)
    except TypeError:
        pairs = list(DECK)
    return random.choice(pairs or DECK)


def pick_undercover_count(n_players):
    """卧底人数随人数走（2026-09-13 猫猫拍板，取经典板子的经验值）。

    ≤7 人 → 1 名卧底；≥8 人 → 2 名卧底（且两人同词，见 deal_cards）；
    10 人以上仍封顶 2——人再多也不加，否则场上"怪词"太多，平民只能靠蒙。

    为什么 6 人给 1 个：偶数人 + 两个方向不同的卧底词时，票型很容易裂成
    2:2 反复平票（2026-09-12 场次实测一局连平四轮、无人出局）；
    卧底越多，平民的票越难集中，"可疑"就越不等于"是卧底"。
    """
    try:
        n = int(n_players)
    except (TypeError, ValueError):
        n = 0
    if n < 3:
        return 1
    return 1 if n <= 7 else 2


def _second_undercover_word(deck, civilian_word, first_word):
    """【已弃用 2026-09-13：双卧底改为同词】双卧底的第二个词：从不含平民词的其它对里挑。

    保留函数只为历史引用不炸；deal_cards 已不再调用它。留在这里当反面教材：
    它会让第二个卧底拿到一个与平民词毫不相干的词（实测「公交车」局抽到「凉鞋」），
    那人第一次发言就必然穿帮——等于把"卧底"变成"抓傻子"。
    """
    try:
        pairs = list(deck)
    except TypeError:
        pairs = list(DECK)
    if not pairs:
        pairs = list(DECK)
    pool = []
    for pair in pairs:
        words = [w for w in (list(pair) if isinstance(pair, (list, tuple)) else [pair]) if w]
        if civilian_word in words:
            continue
        pool.extend(w for w in words if w and w != first_word)
    if not pool:
        head = pairs[0] if isinstance(pairs[0], (list, tuple)) else [pairs[0]]
        pool = [w for w in head if w and w != first_word]
    return random.choice(pool or [first_word])


# ---------------------------------------------------------------- 发牌
def deal_cards(players, deck=None, n_undercover=None,
               civilian_word=None, undercover_word=None):
    """发牌：平民共用一个词 + n 个卧底（**同拿一个相近词**）+ 1 个白板（无词）。

    参数：
        players:      玩家名单（@actor 列表或名字列表）
        deck:         词库，缺省用模块内的 DECK
        n_undercover: 卧底人数；**缺省 None = 按人数自动定**
                      （pick_undercover_count：≤7 人 1 个、≥8 人 2 个）。
                      传具体数字可覆盖——老剧本显式传 2 时行为不变。
        civilian_word / undercover_word:
                      **出题官现场出的词**（2026-09-16 加）。两个都给了且不相同
                      就用它；缺一个、相等或为空 → 退回 deck 抽（_pick_text），
                      所以老剧本不传这两个参数时行为和以前一字不差。
    返回字典（key 与剧本 out: 声明一一对应）：
        roles       {玩家名: "平民"/"卧底"/"白板"}
        words       {玩家名: 该玩家拿到的词}
        @卧底       卧底玩家名（多名卧底时取第一个；本局所有卧底同词）
        @白板       白板玩家名
        deck_word   [平民词, 卧底词1, 卧底词2, 人类可读词对说明]，供赛后复盘
    """
    names = [_as_name(p) for p in (players or []) if _as_name(p)]
    if len(names) < 3:
        raise ValueError("谁是卧底至少需要 3 名玩家，实际收到：%r" % (players,))
    if n_undercover is None:
        n_uc = pick_undercover_count(len(names))
    else:
        try:
            n_uc = max(1, int(n_undercover))
        except (TypeError, ValueError):
            n_uc = pick_undercover_count(len(names))
    if len(names) < n_uc + 2:
        n_uc = max(1, len(names) - 2)

    rnd = random.SystemRandom()
    shuffled = list(names)
    rnd.shuffle(shuffled)
    undercovers = shuffled[:n_uc]
    blank = shuffled[n_uc]

    # 词面：优先用出题官现场出的那对，没给/不合法才回落到固定题库。
    cw = _quiz_clean(civilian_word) if civilian_word else ""
    uw = _quiz_clean(undercover_word) if undercover_word else ""
    if not (cw and uw and cw != uw):
        cw, uw = _pick_text(deck)
    civilian_word, undercover_word = cw, uw
    # 【2026-09-13 猫猫拍板：双卧底同词】旧实现给第二名卧底另抽一个"其它对"里的词
    # （实测抽到「凉鞋」配平民「公交车」）——那不是相近词，是另一个词：拿它的人
    # 第一次发言就必然穿帮，"抓卧底"直接退化成"抓傻子"。现在所有卧底共用对子里
    # 的同一个卧底词，卧底的伪装难度回到"描述的分寸"上。
    uc_words = [undercover_word] * max(1, n_uc)

    roles, words = {}, {}
    for i, n in enumerate(undercovers):
        roles[n] = "卧底"
        words[n] = uc_words[i]
    for n in names:
        if n in roles:
            continue
        if n == blank:
            roles[n] = "白板"
            words[n] = BLANK_WORD
        else:
            roles[n] = "平民"
            words[n] = civilian_word

    if n_uc >= 2:
        pairs_note = (f"平民「{civilian_word}」 / 卧底「{uc_words[0]}」"
                      f"（{n_uc} 名卧底同词）")
    else:
        pairs_note = f"平民「{civilian_word}」 / 卧底「{uc_words[0]}」"

    return {
        "roles": roles,
        "words": words,
        "@卧底": undercovers[0],
        "@白板": blank,
        "deck_word": [civilian_word] + uc_words + [pairs_note],
    }


def shuffle_order(players):
    """每轮打乱一次发言/投票顺序，让座位顺位不至于固定。

    key 必须逐字写成 "$alive"：引擎经 `_extract_var_name` 取 out 名时只处理
    带点路径里的 `@`（'vote_results.@voter'→'vote_results'），**不剥 `$`**，
    所以 `out: $alive` 期望的 key 就是 '$alive'（写回时由 facade 的
    `_decl_for` 剥 `$` 落到 shared 槽位）。
    """
    names = [_as_name(p) for p in (players or []) if _as_name(p)]
    random.shuffle(names)
    return {"$alive": names}


# ---------------------------------------------------------------- 渲染辅助
def names(players):
    """把玩家列表拼成「@A、@B、@C」这种好读的串，供 prompt 里的 {u.names($alive)} 用。"""
    items = [_as_name(p) for p in (players or []) if _as_name(p)]
    return "、".join(items) if items else "（无）"


def roster(roles):
    """把 roles 字典的键（玩家名）拼成名单串，供「场上 N 个人：…」这类播报用。"""
    if isinstance(roles, dict):
        keys = list(roles.keys())
    else:
        keys = list(roles or [])
    return names(keys)


def count_undercover(roles):
    """卧底人数（公告与终局文案用；单/双卧底自适应）。"""
    if isinstance(roles, dict):
        return sum(1 for r in roles.values() if r == "卧底")
    return 0


def card_texts(words):
    """每个玩家的「牌面文案」：看牌/陈述 prompt 里用 {words_text.@speaker} 取。

    【2026-09-13 猫猫拍板】白板以前只显示 BLANK_WORD（"？？？"），演员第一反应是
    "是不是渲染坏了"——它需要一句明确的"你手里没有词"，否则会像 2026-09-12 那局
    的弱模型一样胡说（@看图梗 拿着"凉鞋"老实描述反而被当成胡话）。
    平民/卧底仍是"你拿到的词是【X】"。返回 {"words_text": {...}}，key 与剧本 out 对齐。
    """
    src = words if isinstance(words, dict) else {}
    out = {}
    for name, word in src.items():
        w = "" if word is None else str(word)
        if w == BLANK_WORD or w.strip() == "":
            out[name] = ("你手里没有词——你是【白板】。没有牌面可描述，只能顺着别人的话"
                         "混过去；你的目标是不被投出去（活到终局就算白板赢）。")
        else:
            out[name] = f"你拿到的词是【{w}】。"
    return {"words_text": out}


def board_notice(roles):
    """开局公告的牌面段（人数、卧底数、白板有无都按**实际发牌**现算）。

    以前这段是剧本里写死的"6 人局：3 平民 + 2 卧底 + 1 白板"，板子一改（比如
    6 人局改回 1 卧底）公告就会说谎——而 in/out 对齐测试只查声明，查不出文案里的
    谎话，只能靠这里现算。返回纯文本，剧本 prompt 用 {u.board_notice(roles)} 内联。
    """
    roles = roles if isinstance(roles, dict) else {}
    all_names = list(roles.keys())
    n = len(all_names)
    n_uc = count_undercover(roles)
    has_blank = any(r == "白板" for r in roles.values())
    parts = [
        f"【谁是卧底 · {n} 人局】",
        f"场上 {n} 个人：{names(all_names)}。",
        "牌已经发到各自手里了——你只能看到自己的牌面，看不到自己是什么身份。",
    ]
    if n_uc >= 2:
        parts.append(f"这一局场上有 {n_uc} 名卧底：他们拿的是跟平民词相近的那个词（两名卧底同词）。")
    else:
        parts.append("这一局场上只有 1 名卧底：他拿的是跟平民词相近的词。")
    if has_blank:
        parts.append("另外还有一个白板，手里什么词都没有。")
    return "\n".join(parts)


# ---------------------------------------------------------------- 公告文案
# 【2026-09-14 猫猫局】每轮换一种"陈述方式"，免得一局玩成复读机（人人都是
# "甜甜的、凉凉的"）。轮到后面越绕，卧底越难照抄平民的现成说法。
ROUND_TASKS = [
    "本轮陈述任务：一句话说说它【是什么样、什么味儿】，别用比喻，也别太具体。",
    "本轮陈述任务：不许说用途，改说你【上一次跟它打交道】的场面。",
    "本轮陈述任务：把它【比作另一样东西】（打个比方），那个比方别贴脸。",
    "本轮陈述任务：只说它给你留下的【一种感觉或一个画面】，不许再提实物特征。",
    "本轮陈述任务：先给一句怀疑的理由（觉得谁最不像话），再补一句你自己的牌面描述。",
    "本轮陈述任务：用【反问句】描述它（「那玩意儿不就是……吗」），越含糊越好。",
]


def round_announcement(round_no, alive_players):
    """回合开始播报：存活名单 + 本轮指定的陈述方式（文案按轮次循环）。"""
    alive_str = "、".join(_as_name(a) for a in (alive_players or []))
    try:
        idx = (int(round_no) - 1) % len(ROUND_TASKS)
    except (TypeError, ValueError):
        idx = 0
    task = ROUND_TASKS[idx]
    return {
        "announce_text": f"—— 第 {round_no} 轮 · 陈述阶段 ——\n当前存活玩家：{alive_str}",
        "round_task": f"【第 {round_no} 轮】{task}",
    }


# ---------------------------------------------------------------- 投票
def collect_vote(vote_results, voter_name, target):
    """把一票写进共享票箱（就地修改，返回同一对象供 out 写回）。

    空票写成 "?" 而不是留空：下一轮（或 PK 重投）该玩家真投了票就能覆盖它，
    但他若已经出局，票箱里这笔旧票会被 _clean_votes 按投票人白名单过滤掉，
    不会在明细里留下「@A→？（弃权）」这种看不懂的残迹（2026-09-14 实跑修正：
    平票当事人张较真、猫猫在 PK 明细里各显示一条弃权，其实是他们本轮已无权投票）。
    """
    voter = _as_name(voter_name)
    target = _as_name(target) if _as_name(target) else "?"
    vote_results = vote_results if isinstance(vote_results, dict) else {}
    if voter:
        vote_results[voter] = target
    return vote_results


def _clean_votes(vote_results, alive, voters=None):
    """只留「该由本人投出」的有效票：投票者与目标都在存活名单里、不能投自己。

    【2026-09-14 实跑修正】票箱是全局共享的，平票 PK 重投时如果照单全收，
    本轮已平票出局的玩家（以及上一轮淘汰的人）留在票箱里的旧票会被重复计进
    PK 结果——实跑第 3757 场就出了这个岔子：PK 公告写「由其余 4 位重投」，
    计票却把两名当事人的旧票也算上，凑成 2:2 又触发随机送走。
    voters 给了白名单就按白名单收票（pk_decide 传「存活且非候选人」）。
    """
    alive_set = set(alive)
    voters_set = set(voters) if voters is not None else None
    votes = {}
    for voter, target in (vote_results or {}).items():
        v, t = _as_name(voter), _as_name(target)
        if voters_set is not None and v not in voters_set:
            continue
        if v in alive_set and t in alive_set and t != v:
            votes[v] = t
    return votes


def vote_box(vote_results, alive_players, candidates=None):
    """[@投票人→@被投人] 明细串（谁投了谁，供公告前台公开）。

    与计票同源口径（_clean_votes / pk_decide 的有效票判定），但**不吞信息**：
    自投、投给名单外/非候选人的票、没投的人，全部如实标出——
    - 没投或目标为空 → 「@A→？（弃权）」
    - 投给自己 → 「@A→@A（自投，废票）」
    - 候选名单给了（PK 重投）且目标不在名单里／投票人自己是候选人
      → 「@A→@B（无效票）」
    - 其余 → 「@A→@B」（有效票）

    有效票判定必须与计票函数逐字一致，否则公告的"明细"会和"计票"打起来。
    """
    alive = [_as_name(a) for a in (alive_players or [])]
    cands = [_as_name(c) for c in (candidates or []) if _as_name(c)]
    cand_set = set(cands)
    votes = vote_results if isinstance(vote_results, dict) else {}

    parts = []
    for voter in alive:
        # PK 重投时当事人自己也在这份名单里，但他没有投票权——不列他的票，
        # 免得明细里冒出一条「@A→？（弃权）」（2026-09-14 实跑修正）。
        if cand_set and voter in cand_set:
            continue
        raw = votes.get(voter)
        target = _as_name(raw) if raw is not None else ""
        if not target or target == "?":
            parts.append(f"{voter}→？（弃权）")
            continue
        if target == voter:
            parts.append(f"{voter}→{target}（自投，废票）")
            continue
        if cand_set:
            if target not in cand_set:
                parts.append(f"{voter}→{target}（无效票）")
            else:
                parts.append(f"{voter}→{target}")
        else:
            if target not in alive:
                parts.append(f"{voter}→{target}（无效票）")
            else:
                parts.append(f"{voter}→{target}")
    return "投票明细：" + "、".join(parts) if parts else "投票明细：（无人有资格投票）"


def vote_recap(vote_results, all_players, candidates=None):
    """赛后复盘用的投票明细：按**全体参赛者**核票。

    与 vote_box 的唯一差别在名单口径——终局时若拿"最后存活名单"核票，
    早先被淘汰者投的票会被误标成无效票（_test_vote_box.py 第 4 例实测），
    复盘图的正是"谁当时投了谁"，必须算数。
    """
    names = [_as_name(p) for p in (all_players or []) if _as_name(p)]
    return vote_box(vote_results, names, candidates)


def _counts_note(counts, votes, alive, voters=None):
    """计票明面文案：[@A 3 票、@B 1 票] + 弃权数。

    弃权数按**有投票权的人数**算：PK 重投时当事人也在存活名单里但无权投票，
    用 len(alive) 会凭空多出一条"弃权"（2026-09-14 实跑修正）。
    """
    note = "计票：" + "、".join(f"{n} {c} 票" for n, c in
                             sorted(counts.items(), key=lambda kv: -kv[1]))
    eligible = len(alive) if voters is None else len(voters)
    abstain = eligible - len(votes)
    if abstain > 0:
        note += f"（{abstain} 人弃权）"
    return note


def _pick_eliminated(top_names, alive, roles):
    """无人投出有效票／再次平票时的送走规则：能点卧底就点卧底。

    【2026-09-14 实跑修正】旧实现是纯随机：第 3757 场头一轮 3:3 打平、
    PK 又 2:2，随机把平民送走了——玩家对此完全无从施加影响，观感很亏。
    现在先看这几个平票的人里有没有卧底（身份只有引擎知道），有就送卧底走；
    没有（都是好人、或白板）才随机。这样僵局仍必然收敛，但对玩家更讲理。
    """
    cands = [n for n in (top_names or []) if n in (alive or [])]
    if not cands:
        return "" if not alive else random.SystemRandom().choice(list(alive))
    packed = [n for n in cands if (roles or {}).get(n) == "卧底"]
    return random.SystemRandom().choice(packed or cands)


def process_votes(vote_results, alive_players, roles, round_no):
    """第一轮计票 -> 定 PK 名单 / 淘汰 -> 判定。

    - 只统计存活玩家投给存活玩家、且不投自己的票，其余视为废票；
    - 得票唯一最高者出局；
    - **平票（≥2 人并列最高）→ 进入 PK 环节**：谁都不出局，
      pk_candidates 记下并列最高的几位，由 pk_decide 在重投后裁决。
    返回 dict（key 与剧本 out: 声明一一对应）。
    """
    alive = [_as_name(a) for a in (alive_players or [])]
    roles = roles or {}
    votes = _clean_votes(vote_results, alive)

    counts = {}
    for t in votes.values():
        counts[t] = counts.get(t, 0) + 1

    note = _counts_note(counts, votes, alive)
    is_pk = False
    pk_candidates = []
    eliminated = "无人"

    if not counts:
        # 【2026-09-13 兜底】整轮没人投出有效票（全员弃权／自投／投名单外的人）：
        # 旧文案"无人出局"会让这一轮原地打转——干跑实测第 5 轮起死循环，每轮真烧
        # token 却永远不收敛。改为送走一人：僵局只有这一种出口。
        eliminated = _pick_eliminated(alive, alive, roles)
        if eliminated:
            reason = ("本轮没有人投出有效票——僵局不再空转，"
                      f"送走一人：{eliminated} 出局。")
        else:
            reason = "本轮没有人投出有效票，无人出局。"
    else:
        top = max(counts.values())
        top_names = [n for n, c in counts.items() if c == top]
        if len(top_names) > 1:
            # 平票 → PK：本轮无人离场，进入重投
            is_pk = True
            pk_candidates = top_names
            reason = ("、".join(top_names)
                      + f" 平票（各 {top} 票）——本轮无人离场，进入【平票 PK】，"
                      + "由 PK 重投决出谁出局。")
        else:
            eliminated = top_names[0]
            reason = f"{eliminated} 得票最多（{top} 票），被淘汰出局。"

    new_alive = [a for a in alive if a != eliminated]
    announce = (f"—— 第 {round_no} 轮 · 投票结果 ——\n"
                f"{vote_box(vote_results, alive)}\n"
                f"{note}\n{reason}")
    game_over, winner = _judge(new_alive, roles)
    return {
        "eliminated": eliminated,
        "$alive": new_alive,
        "is_pk": is_pk,
        "$pk_candidates": pk_candidates,
        "announce_text": announce,
        "game_over": game_over,
        "winner": winner,
    }


def pk_voters(pk_candidates, alive_players):
    """PK 重投的合法投票人 = 存活者 − 候选人（与 pk_decide 的 voters_ok 同口径）。

    剧本侧用它当循环体名单，公告文案也用它——这样"谁有资格投"只有一个出处，
    不会出现公告说"其余 3 位重投"、流程却把候选人也喊去投的分歧
    （2026-09-11 猫猫拍板：既然有 voters_ok，就直接在它上面循环）。
    """
    cands = {_as_name(c) for c in (pk_candidates or []) if _as_name(c)}
    return [a for a in (_as_name(x) for x in (alive_players or []))
            if a and a not in cands]


def vote_scope_note(pk_candidates):
    """投票节点的「该投谁」说明文本——供剧本 [投票] prompt 用 {u.vote_scope_note($pk_candidates)} 引用。

    常规轮次 pk_candidates 为空（$pk_candidates 初值 []）→ 全体存活玩家都可投；
    PK 重投时 pk_candidates 是平票名单 → 只有这几位能投，投别人算无效票。

    【2026-09-23 干跑修正】[投票] 是常规轮与 PK 重投共用的节点，此前 prompt 一律写
    「只能填存活玩家名单里真实存在的名字」，跟 PK 公告「在平票的人里重投」打架。
    干跑（谁是卧底3·八人双卧底，seed=808928）第 3 轮 PK 的 4 张票全是无效票
    （@小机→@老李、@猫猫→@小机、@老李→@小机，@Eve 自投），pk_decide 收不到有效票，
    只能走「僵局兜底」优先送走卧底/随机送人——PK 环节形同虚设、结果与票型无关。
    现在由本函数按轮次类型给出准确的投票范围。
    """
    cands = [_as_name(c) for c in (pk_candidates or []) if _as_name(c)]
    if not cands:
        return "投票对象：本轮所有存活玩家（除了你自己）。"
    return ("投票对象：本次是【平票 PK 重投】，你只能在平票的这几位里二选一／多选一："
            + "、".join(cands)
            + "。投给其他任何人（哪怕他还活着、哪怕你觉得他更可疑）都算无效票。")


def pk_prompt(pk_candidates, alive_players, round_no):
    """PK 环节的公开播报（申辩与重投的提示词写在剧本节点里）。

    返回 {"announce_text": 播报, "$pk_voters": 合法投票人名单}——两个 key 都必须在
    剧本 `out:` 里逐字声明（引擎严格校验，多一个 key 就报「返回字典中的 key 未在
    out 中声明」）。剧本的 PK 重投循环直接遍历 $pk_voters，不再遍历全体存活者。
    """
    cands = [_as_name(c) for c in (pk_candidates or []) if _as_name(c)]
    voters = pk_voters(cands, alive_players)
    cand_str = "、".join(cands)
    announce = (
        f"—— 第 {round_no} 轮 · 平票 PK ——\n"
        f"平票的是：{cand_str}。本轮无人出局。\n"
        f"现在进入 PK 环节：{cand_str} 每人再说一句话为自己申辩；"
        f"然后由其余 {len(voters)} 位（{'、'.join(voters)}）在平票的人里重投，"
        f"得票多者出局；若再次平票，则这几位里如果要有人顶缸，优先送走拿着怪词的那个（僵局不再空转）。"
    )
    return {"announce_text": announce, "$pk_voters": voters}


def pk_decide(vote_results, pk_candidates, alive_players, roles, round_no):
    """PK 重投计票 -> 淘汰 -> 判定。

    有效票三条件：投票者**存活**、投票者不是 PK 选手、目标在 PK 名单里。
    （只判"不是 PK 选手"会把已出局的人也算成投票者——干跑流水里抓到过这个漏洞。）
    得票多者出局；再次平票、或一条有效票都没有（含"所有存活者都是候选人"这种
    结构性无票可投），一律送走一人（2026-09-13 平票兜底：僵局必须有出口；
    2026-09-14 起改为优先送走卧底，见 _pick_eliminated）。
    """
    alive = [_as_name(a) for a in (alive_players or [])]
    cands = [_as_name(c) for c in (pk_candidates or []) if _as_name(c)]
    roles = roles or {}
    cand_set = set(cands)
    voters_ok = [a for a in alive if a not in cand_set]   # 存活且非 PK 选手

    # 票箱是共享的，PK 重投只认「存活且非候选人」投出的、且投给候选人的票。
    votes = {}
    for voter, target in (vote_results or {}).items():
        v, t = _as_name(voter), _as_name(target)
        if v in voters_ok and t in cand_set:
            votes[v] = t

    counts = {}
    for t in votes.values():
        counts[t] = counts.get(t, 0) + 1

    note = ("PK 重投：" + ("、".join(f"{n} {c} 票" for n, c in
                                   sorted(counts.items(), key=lambda kv: -kv[1]))
                          if counts else "无人投出有效票"))
    eliminated = "无人"
    if counts:
        top = max(counts.values())
        top_names = [n for n, c in counts.items() if c == top]
        if len(top_names) > 1:
            # 【2026-09-13 平票兜底】旧规则"再次平票 = 本轮无人出局"会让
            # "票型天生 2:2"的局无限空转（2026-09-12 实测连平四轮、每轮都真烧
            # token，谁都出不去）。现在改为送走一人：僵局只有这一种出口。
            eliminated = _pick_eliminated(top_names, alive, roles)
            reason = ("、".join(top_names)
                      + f" 再次平票（各 {top} 票）——僵局不再空转，"
                      + f"送走一人：{eliminated} 出局。")
        else:
            eliminated = top_names[0]
            reason = f"{eliminated} 在 PK 重投中得票最多（{top} 票），被淘汰出局。"
    else:
        # 【2026-09-13 兜底】PK 重投没有有效票，有两种成因：
        # ①全员弃权/自投；②**所有存活者都是 PK 候选人**（3 人局三人平票时必然发生，
        # 此时 $pk_voters 为空，谁都没资格投）——后者是结构性的，不兜底就永远出不去。
        if cands:
            eliminated = _pick_eliminated(cands, alive, roles)
            reason = ("PK 重投无人投出有效票——僵局不再空转，"
                      f"送走一人：{eliminated} 出局。")
        else:
            reason = "PK 重投无人投出有效票，本轮无人出局。"

    new_alive = [a for a in alive if a != eliminated]
    announce = (f"—— 第 {round_no} 轮 · PK 结果 ——\n"
                f"{vote_box(vote_results, alive, cands)}\n"
                f"{note}\n{reason}")
    game_over, winner = _judge(new_alive, roles)

    return {
        "eliminated": eliminated,
        "$alive": new_alive,
        "$pk_candidates": [],
        "announce_text": announce,
        "game_over": game_over,
        "winner": winner,
    }


# ---------------------------------------------------------------- 胜负判定
def _judge(alive, roles):
    """胜负判定（process_votes / pk_decide / next_round_stage 共用）。

    结束条件（单/双卧底自适应，公式本身与人数无关）：
    - 卧底全被投出去 → 平民阵营胜；
    - 场上剩下的好人 ≤ 存活卧底数（卧底的票已经压过好人）→ 卧底阵营胜。
      白板算好人一边，且**只有当平民全没了**时才会作为"最后的好人"顶上去——
      所以"卧底 + 白板 + 1 平民"这类局面仍判卧底胜。
    """
    alive = [_as_name(a) for a in (alive or [])]
    roles = roles or {}
    alive_undercover = [a for a in alive if roles.get(a) == "卧底"]
    alive_good = [a for a in alive if roles.get(a) != "卧底"]

    if not alive_undercover:
        return True, "平民阵营"
    if len(alive_good) <= len(alive_undercover):
        return True, "卧底阵营"
    return False, ""


# ---------------------------------------------------------------- 胜负判定（对外入口）
def next_round_stage(alive_players, roles):
    """投票结算后判定游戏是否结束。返回 {"game_over": bool, "winner": str}。
    裁决口径见 _judge（与 process_votes / pk_decide 完全同源，避免两处漂移）。"""
    game_over, winner = _judge(alive_players, roles)
    return {"game_over": game_over, "winner": winner}


def _word_display(name, words):
    """终局文案里的词面：白板的 BLANK_WORD 显示成「（没有词）」。

    否则复盘时它和"占位符没渲染"长得一模一样（2026-09-12 我第一眼就怀疑是渲染故障）。
    """
    w = (words or {}).get(name)
    w = "" if w is None else str(w)
    return "（没有词）" if (w == BLANK_WORD or w.strip() == "") else w


def verdict(eliminated, roles, words, alive_players, winner, deck_word=None,
            vote_results=None, pk_vote_results=None):
    """终局判决文案。全部身份与词在这里揭晓（附最后一轮的投票明细）。

    投票资料（2026-09-11 加）：vote_results = 本轮常规投票票箱，
    pk_vote_results = PK 重投票箱（走没走 PK 由调用方决定传不传）——
    谁投了谁必须留痕，否则复盘时只剩"几票"没有"谁投的"。
    双卧底（2026-09-12）：deck_word 末位是词对说明串，文案收尾用它。
    """
    roles = roles or {}
    words = words or {}
    alive = [_as_name(a) for a in (alive_players or [])]
    elim = _as_name(eliminated)
    n_uc = count_undercover(roles)

    lines = ["—— 终局 ——"]
    if elim and elim != "无人":
        role = roles.get(elim, "？")
        lines.append(f"{elim} 被投出局，他的身份是【{role}】，词是「{_word_display(elim, words)}」。")
    else:
        lines.append("场上再无人被投出局。")
    # 【2026-09-14】卧底赢的局，旧文案只说「场上再无人被投出局」+「卧底隐藏到了
    # 最后」，却没点出卧底是谁——明明身份表就在下面几行，第一次看还是懵。补一句。
    if winner == "卧底阵营":
        alive_uc = [a for a in alive if roles.get(a) == "卧底"]
        if alive_uc:
            lines.append("活到最后、把大家骗过去的是：" + "、".join(alive_uc) + "。")

    lines.append(f"本局卧底 {n_uc} 人。所有人的身份与词：")
    # 先点卧底，再把其余人按原顺序列出——复盘时一眼看到重点
    order = ([n for n, r in roles.items() if r == "卧底"]
             + [n for n, r in roles.items() if r != "卧底"])
    for name in order:
        lines.append(f"　　{name}——{roles[name]}，词：{_word_display(name, words)}")
    # 投票明细不在这里重复打印：终局公告永远紧跟"投票结果/PK 结果"公告，
    # 那条已经用 vote_box 把明细摊开了（2026-09-11 拍板）。参数保留——要做
    # "赛后复盘单页"、或以后终局改由常规轮直接结束时，调 vote_recap 即可。
    _ = (vote_results, pk_vote_results)

    note = ""
    if isinstance(deck_word, (list, tuple)) and deck_word:
        tail = deck_word[-1]
        if isinstance(tail, str) and ("「" in tail or "平民" in tail):
            note = tail
        elif len(deck_word) >= 2:
            note = f"平民「{deck_word[0]}」 / 卧底「{deck_word[1]}」"
    if note:
        lines.append(f"（本局词对：{note}）")

    if winner == "平民阵营":
        lines.append("卧底已经被全部投出局 —— 平民阵营获胜！")
    elif winner == "卧底阵营":
        lines.append("卧底隐藏到了最后 —— 卧底阵营获胜！")
    else:
        lines.append("游戏结束。")

    # 【2026-09-13 白板胜负单列】猫猫问"白板赢了算什么"——本局定义：白板是独立
    # 目标，只要没被投出去、混到终局，白板自己就算赢；它不改变平民/卧底的胜负
    # 判定（_judge 里白板仍按"好人"计入人数，避免两处口径漂移）。
    for b in [n for n, r in roles.items() if r == "白板"]:
        if b in alive:
            lines.append(f"白板 {b} 混到了终局、没被投出去 —— 白板自己也算赢。")
        else:
            lines.append(f"白板 {b} 被投出局了 —— 白板这一局没混过去。")

    if alive:
        lines.append(f"最后的存活玩家：{'、'.join(alive)}")

    text = "\n".join(lines)
    return {"verdict_text": text, "announce_text": text}


# ================================================================ 出题官（LLM 现场出题）
# 【2026-09-16 猫猫提出】固定题库只有 20 对，玩两局就撞词。改成 @出题官 现场出：
#   quiz_seed() 每局现算一张"题签"（日期/星期/时刻 + 随机校验码 + 随机方向/关系/
#   角度 + 禁用词表 + 最近用过的词）喂给出题官 → 它出词 → check_quiz() 硬校验 →
#   不合格就把理由连同"退回记录"喂回去重出。
# 为什么要三保险：LLM 的默认档位就是"牛奶/豆浆"——光在 prompt 里写"别重复"没用。
#   随机种子（换脑子）+ 禁用表（堵老路）+ 跨局已用记录（记住历史），三样一起上，
#   才真的每局不重样。
# 为什么不要"备用卧底词"：双卧底按 2026-09-13 的裁决是**同词**（deal_cards 里
#   uc_words = [undercover_word] * n_uc），所以只需要一对词，多问一个只会给出题官
#   多一个写歪的机会。

_QUIZ_DIR = os.path.dirname(os.path.abspath(__file__))
QUIZ_USED_FILE = os.path.join(_QUIZ_DIR, "quiz_used.json")
QUIZ_USED_KEEP = 30          # 跨局已用记录保留多少对（也是喂回 prompt 的上限）

# 出题方向：每局随机抽 3 个，第 1 个是硬性主方向，后两个是备选
QUIZ_AREAS = [
    "厨房灶台", "日用小物", "文具办公", "通勤交通", "零食饮料", "洗漱护理",
    "家用电器", "衣服配饰", "鞋子袜子", "宠物用品", "手机数码", "学校教室",
    "菜市场", "运动健身", "出门旅游", "客厅家具", "床上用品", "儿童玩具",
    "雨天用品", "过年过节", "理发店", "小卖部", "车里", "医院药房",
]

# 词对关系：决定"相近"是哪种相近，避免每局都是同一款近义词
QUIZ_STYLES = [
    "同场景姊妹物：两样东西总在同一个地方出现，但不是同一个东西",
    "同类不同做法：同一个用途，两种做法／两种口味／两种规格",
    "新老两代：一个老物件和一个新物件，干的是同一件事",
    "长得像、用处不同：摆在一起像亲兄弟，用起来完全两回事",
    "一件事的两副面孔：同一件事的两种说法，或者它的两个阶段",
    "贴身搭档：总是配套出现，少了另一个就不完整",
]

# 灵感角度：给出题官一个偏门的"从哪儿想起"的入口
QUIZ_ANGLES = [
    "从一个十岁小孩的眼睛里能看见的",
    "搬家时最先装箱的",
    "你妈会唠叨你少碰的东西",
    "深夜还醒着的东西",
    "第一次去别人家做客会注意到的",
    "摸起来手感差别最大的",
    "拆快递时会一起拿出来的",
    "下雨天忽然变得很重要的",
    "买的时候要挑半天、买回来又不太用的",
    "能塞进兜里的",
]

# 额外禁用：不在 DECK 里、但太烂大街的词（一提到近义词对，人人先想到这些）
QUIZ_BANNED_EXTRA = [
    "苹果", "香蕉", "西瓜", "手机", "电脑", "电视", "椅子", "水杯", "纸巾",
    "牙刷", "毛巾", "书包", "眼镜", "手表", "月饼", "粽子", "饺子", "米饭",
]

_REJECT_LOG = []   # 本轮被打回的词对（下一次出题时喂回去，堵住它拿同一对再试）

# 占位词垃圾：干跑（femo-debug）时 AI 节点由调试器合成替答，它会照着 prompt 里的
# 「<<civilian_word = 平民词>>」直接抄出"平民词"/"卧底词"这种东西。这些不是真词对，
# 一旦写进跨局禁用表，下次正式开局就会拿它们当"已用过的词"（还会把真词表冲淡）。
# 所以这类词只在"记入已用表"时丢掉，校验/出题流程本身不受影响。
QUIZ_JUNK_WORDS = {"平民词", "卧底词", "备用卧底词", "词", "词面", "答案",
                   "debug", "test", "示例", "空", "?", "？？？"}


def _quiz_junk(*words):
    return any(str(w).strip() in QUIZ_JUNK_WORDS for w in words)


def _quiz_load_used():
    """读跨局已用词对：[["平民词","卧底词"], ...]。读不到就当空表。"""
    try:
        with open(QUIZ_USED_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return []
    out = []
    if isinstance(data, list):
        for item in data:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                if _quiz_junk(item[0], item[1]):
                    continue          # 干跑合成出来的占位词，丢掉
                out.append([str(item[0]), str(item[1])])
    return out


def _quiz_save_used(pair):
    """把一对词记进跨局已用表，供以后的局禁用。写盘失败不影响牌局，静默放过。"""
    try:
        if _quiz_junk(pair[0], pair[1]):
            return
        used = _quiz_load_used()
        pair = [str(pair[0]), str(pair[1])]
        if pair not in used:
            used.append(pair)
        used = used[-QUIZ_USED_KEEP:]
        with open(QUIZ_USED_FILE, "w", encoding="utf-8") as f:
            json.dump(used, f, ensure_ascii=False, indent=1)
    except Exception:
        pass


def _quiz_banned(deck=None):
    """禁用词集合 = 内置题库全部词 + 烂大街词 + 跨局已用过的词。"""
    banned = set(QUIZ_BANNED_EXTRA)
    for pair in (deck or DECK):
        try:
            banned.update(_as_name(w) for w in pair)
        except TypeError:
            pass
    for pair in _quiz_load_used():
        banned.update(pair)
    banned.discard("")
    return banned


def quiz_seed(deck=None):
    """现算本局的"题签"文本（喂给出题官的那个 prompt 块）。

    每局必不相同：时刻精确到秒 + 随机校验码 + 随机抽的方向/关系/角度 + 禁用表 +
    最近用过的词 + 本轮被打回过的词。返回 {"quiz_seed_text": str}，key 与剧本 out 对齐。
    """
    rnd = random.SystemRandom()
    now = datetime.now()
    weekday = "一二三四五六日"[now.weekday()]
    areas = rnd.sample(QUIZ_AREAS, 3)
    style = rnd.choice(QUIZ_STYLES)
    angle = rnd.choice(QUIZ_ANGLES)
    codes = [f"{rnd.randint(0, 0xFFFF):04X}"]
    codes += [str(rnd.randint(1, 9999)) for _ in range(3)]
    n_lo, n_hi = rnd.choice([(2, 3), (2, 4), (3, 4)])

    banned = sorted(_quiz_banned(deck))
    used = _quiz_load_used()
    used_words = []
    for pair in used[-QUIZ_USED_KEEP:]:
        used_words.extend(pair)
    used_words = sorted(set(w for w in used_words if w))

    lines = [
        "—— 本局题签（开局现算，别拿这些数字当题目）——",
        f"此刻：{now.strftime('%Y年%m月%d日')} 周{weekday} "
        f"{now.strftime('%H:%M:%S')}",
        "随机校验码：" + " / ".join(codes),
        f"【本次指定方向】{areas[0]}（备选：{areas[1]}、{areas[2]}）",
        f"【本次指定关系】{style}",
        f"【本次指定角度】{angle}",
        f"【词长】平民词和卧底词都控制在 {n_lo}–{n_hi} 个字",
    ]
    if used_words:
        lines.append("【最近几局已经用过，禁止再用】" + "、".join(used_words))
    lines.append("【烂大街、禁止再出】" + "、".join(sorted(set(QUIZ_BANNED_EXTRA))))
    lines.append("【内置题库里的老题，禁止再出】"
                 + "、".join(sorted(set(w for p in DECK for w in p))))
    if _REJECT_LOG:
        lines.append("【刚才被系统打回的词，禁止再出现】" + "；".join(_REJECT_LOG))
        lines.append(f"（这已经是第 {len(_REJECT_LOG) + 1} 次出题，"
                     "别再绕着同一对词打转，换一套完全不同的东西。）")
    return {"quiz_seed_text": "\n".join(lines)}


def _quiz_clean(w):
    """把 LLM 可能带出来的包装剥干净：标签前缀、「」引号、括号注释、句末标点。

    出题官多半会写成「平民词=牛奶」或者「牛奶（早上喝的）」，这里统一还原成裸词。
    """
    s = "" if w is None else str(w)
    s = s.strip().splitlines()[0].strip() if s.strip() else ""
    if not s:
        return ""
    for tag in ("平民词", "卧底词", "备用卧底词", "答案", "词面", "词汇", "词"):
        for sep in ("=", "＝", ":", "：", "是", "为"):
            if s.startswith(tag + sep):
                s = s[len(tag) + len(sep):].strip()
                break
    s = re.sub(r"[（(【\[][^）)】\]]*[）)】\]]", "", s)      # 括号注释
    s = s.strip(" 　\"'“”‘’《》〈〉【】[]（）()·,，。.、;；:：!！?？-—~～*")
    return s.strip()


def check_quiz(civilian_word, undercover_word, attempt=1, max_attempt=4, deck=None):
    """校验出题官给的这对词。返回 {"quiz_ok", "quiz_problem", "civilian_word",
    "undercover_word", "quiz_note"}，key 与剧本 out 对齐。

    硬校验（都是"必须重出"的硬伤）：非空、两词不同、谁也不包含谁、词长 2–8 字、
    不在禁用表里。
    软校验没法做——"这两个词到底近不近"只有语义能判断，交给出题官自己，Python
    不越权猜。连错 max_attempt 次就换内置题库，保证牌局一定开得起来。
    """
    global _REJECT_LOG
    cw = _quiz_clean(civilian_word)
    uw = _quiz_clean(undercover_word)
    banned = _quiz_banned(deck)

    def _reject(reason):
        global _REJECT_LOG
        pair_txt = f"平民「{cw or '空'}」/ 卧底「{uw or '空'}」"
        _REJECT_LOG.append(f"{pair_txt}——{reason}")
        # 兜底判据用 attempt（剧本里 quiz_try 自增的那次），不用日志长度——
        # 日志长度会被上一局的残留污染（2026-09-16 自测踩到：连打三次 attempt=1
        # 就直接触发了兜底）。
        try:
            tried = max(1, int(attempt))
        except (TypeError, ValueError):
            tried = 1
        if tried >= max(1, int(max_attempt)):
            # 兜底：换回内置题库，牌局照样能开（词会出现在赛后复盘里）
            fcw, fuw = _pick_text(deck)
            _quiz_save_used([fcw, fuw])
            _REJECT_LOG = []
            return {
                "quiz_ok": True,
                "quiz_problem": f"出题官连续 {attempt} 次没出合格题（最后一次：{reason}），"
                                "已改用内置备用题库。",
                "civilian_word": fcw,
                "undercover_word": fuw,
                "quiz_note": "本局题目来自备用题库（出题官本局失手）。",
            }
        return {
            "quiz_ok": False,
            "quiz_problem": f"第 {attempt} 次出题被打回：{reason}（{pair_txt}）",
            "civilian_word": cw,
            "undercover_word": uw,
            "quiz_note": "",
        }

    if not cw or not uw:
        return _reject("有一个词是空的，两个都必须填")
    if cw == uw:
        return _reject("两个词一模一样，卧底会当场露馅")
    if cw in uw or uw in cw:
        return _reject("一个词包含了另一个，太容易一眼分清")
    if not (2 <= len(cw) <= 8) or not (2 <= len(uw) <= 8):
        return _reject("词长不在 2–8 字之间")
    for w in (cw, uw):
        if w in banned:
            return _reject(f"「{w}」在禁用表里（最近用过或太烂大街）")

    _quiz_save_used([cw, uw])
    _REJECT_LOG = []
    return {
        "quiz_ok": True,
        "quiz_problem": "",
        "civilian_word": cw,
        "undercover_word": uw,
        "quiz_note": "本局题目由 @出题官 现场所出，不是题库里的老题。",
    }

