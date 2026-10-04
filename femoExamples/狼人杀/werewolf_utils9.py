"""狼人杀 9 人局（3狼 + 预言家/女巫/猎人 3神 + 3村民）警长版配套函数。
阵容零硬编码：玩家名单吃剧本的 alive 变量，主持人吃 god 参数（如剧本 @上帝）。
牌型按人数动态铺：固定 3 狼 + 预女猎，其余村民；标准 9 人局即 3狼3神3民。
猎人规则：被刀死或被放逐出局可翻牌开枪带走一人，被女巫毒死不能开枪。"""

import random


def _as_name(v):
    """把 @actor 引用归一化为名字字符串（个别通道会把 @actor 解析成 dict）。"""
    if isinstance(v, dict):
        v = v.get('name', '') or ''
    return str(v).strip() if v is not None else ''


def check_role(target_name, roles_dict):
    """预言家查验：返回 {"seer_check_result": "狼人"/"好人"}。"""
    target_name = _as_name(target_name)
    for actor_ref, role in (roles_dict or {}).items():
        if actor_ref == target_name:
            return {"seer_check_result": "狼人" if role == "狼人" else "好人"}
    return {"seer_check_result": "未知"}


def get_speaker_order_from_start(candidates, start):
    """
    从start开始，返回candidates的循环发言顺序。
    candidates: list 上警玩家
    start: str 起始玩家名
    无人上警（candidates 为空）时返回空列表——后续 for/par 零执行直接穿出。
    """
    if not candidates:
        return []
    if start not in candidates:
        start = candidates[0]
    idx = candidates.index(start)
    return candidates[idx:] + candidates[:idx]

def get_sheriff_voter_order(alive, candidates):
    """
    返回未上警的存活玩家列表（警下投票者）。
    无人上警时返回空列表——没有竞选就没有投票，直接穿出到结算。
    """
    if not candidates:
        return []
    return [p for p in alive if p not in candidates]

def collect_candidacy(candidates, player_name, want):
    """把上警意愿写进共享名单（就地修改，返回同一对象供 out 写回）。
    $sheriff_candidates 是全局一份的 shared 变量：par 并发分支各自写
    不同的追加（list.append GIL 原子），互不覆盖。want 非真 = 不上警。"""
    player_name = _as_name(player_name)
    if isinstance(want, str):
        truthy = want.strip().lower() in ("true", "1", "yes", "y", "是", "上", "上警")
    else:
        truthy = bool(want)
    if player_name and truthy and player_name not in (candidates or []):
        candidates.append(player_name)
    return candidates

def process_election_votes(votes, candidates, alive):
    """
    统计警长竞选投票。
    只有警下存活玩家的投票有效，且只能投给警上玩家。
    唯一最高票 → 当选（@sherif）；平票 → 进入平票 PK（is_pk=True，
    $pk_candidates=平票候选人名单），暂无人当选，由 pk_decide_election 重投裁决。
    """
    from collections import Counter

    candidates = list(candidates or [])
    alive = list(alive or [])
    candidate_set = set(candidates)
    voter_set = set(alive) - candidate_set

    valid_votes = {
        _as_name(v): _as_name(t)
        for v, t in (votes or {}).items()
        if _as_name(v) in voter_set
        and _as_name(t) in candidate_set
    }

    if not valid_votes:
        return {"@sherif": "", "is_pk": False, "$pk_candidates": [], "election_route": "done"}

    counter = Counter(valid_votes.values())
    max_votes = max(counter.values())
    winners = [p for p, c in counter.items() if c == max_votes]

    if len(winners) == 1:
        return {"@sherif": winners[0], "is_pk": False, "$pk_candidates": [],
                "election_route": "done"}

    return {"@sherif": "", "is_pk": True, "$pk_candidates": sorted(winners),
            "election_route": "pk"}


def _judge_game_over(new_alive, roles_dict):
    """屠边制胜负：狼全灭→好人胜；神职（预女猎）全灭或村民全灭→狼人胜。"""
    roles_dict = roles_dict or {}
    alive_wolves = [a for a in new_alive if roles_dict.get(a) == "狼人"]
    alive_gods = [a for a in new_alive if roles_dict.get(a) in ("预言家", "女巫", "猎人")]
    alive_villagers = [a for a in new_alive if roles_dict.get(a) == "村民"]

    if not alive_wolves:
        return True, "好人阵营"
    if not alive_gods or not alive_villagers:
        return True, "狼人阵营"
    return False, ""


def resolve_night(kill_target, save, poison_target, alive_players, has_antidote, has_poison,
                  wolves, roles_dict, hunter, god=""):
    """夜晚结算：
    - 刀：目标必须在场；女巫用解药（且有药、目标在场）则救下，否则死亡。
    - 毒：规则每晚最多一瓶——解药生效当晚毒药作废；毒目标必须在场才生效。
    - 用药实际生效才扣瓶。
    - 同步维护 wolves / wolf_room：死掉的狼剔出夜间名单（防幽灵之刀），上帝照旧坐镇（god 参数，如剧本 @上帝）。
    - 猎人 flags：hunter_dead_tonight=猎人今夜是否倒牌；被毒死不能开枪（hunter_can_shoot=false），被刀死可以。
    - 顺带按屠边制重判胜负——天亮就可能分出胜负，白天开场的 game_over 检查靠它，别只等投票结算。
    返回 dead_tonight / alive / wolves / wolf_room / witch_has_antidote / witch_has_poison /
    hunter_dead_tonight / hunter_can_shoot / game_over / winner。"""
    kill_target = _as_name(kill_target)
    poison_target = _as_name(poison_target)
    alive_players = list(alive_players or [])
    wolves = list(wolves or [])
    roles_dict = roles_dict or {}
    hunter = _as_name(hunter)
    god = _as_name(god)
    dead = []
    poison_used = False

    saved = bool(save) and bool(has_antidote) and bool(kill_target) \
        and kill_target in alive_players
    if kill_target and kill_target in alive_players and not saved:
        dead.append(kill_target)

    if (poison_target and poison_target != "none" and has_poison
            and not saved and poison_target in alive_players):
        dead.append(poison_target)
        poison_used = True

    dead = list(dict.fromkeys(dead))  # 刀毒同一人不重复报
    new_alive = [a for a in alive_players if a not in dead]
    new_wolves = [w for w in wolves if w not in dead]

    hunter_dead_tonight = bool(hunter) and hunter in dead
    hunter_can_shoot = not (poison_used and poison_target == hunter)

    game_over, winner = _judge_game_over(new_alive, roles_dict)

    return {
        "dead_tonight": dead,
        "alive": new_alive,
        "wolves": new_wolves,
        "wolf_room": ([god] if god else []) + new_wolves,
        "witch_has_antidote": (False if saved else has_antidote),
        "witch_has_poison": (False if poison_used else has_poison),
        "hunter_dead_tonight": hunter_dead_tonight,
        "hunter_can_shoot": hunter_can_shoot,
        "game_over": game_over,
        "winner": winner,
    }


def build_witch_prompt(has_antidote, has_poison, kill_target, alive_players, witch_name):
    """按药瓶实况生成女巫夜晚行动提示词：有什么药才引导输出对应的 SET VARIABLE，
    没药就明说并禁止输出对应赋值，避免"永远在引导用药"的误导。
    返回 {"witch_prompt_text": ...}。"""
    witch_name = _as_name(witch_name) or "女巫"
    alive_names = [_as_name(a) for a in (alive_players or []) if _as_name(a)]
    kill_target = _as_name(kill_target)
    if kill_target and kill_target not in alive_names:
        kill_target = ""
    alive_str = "、".join(alive_names)
    lines = [f"现在是夜晚行动时间。你是{witch_name}，你的身份是女巫。"]

    if not has_antidote and not has_poison:
        lines.append(
            "你的解药和毒药都已经用完了，今晚无药可用。"
            "请直接简短说明你已无药可用，严禁输出任何 SET VARIABLE 赋值语句。"
        )
        return {"witch_prompt_text": "\n".join(lines)}

    if has_antidote:
        if kill_target:
            lines.append(
                f"今晚 {kill_target} 被袭击了。你手里还有一瓶解药："
                "如果要救他，请输出：SET VARIABLE:<< SAVE = true >>；"
                "如果决定不救，就不要输出 SAVE 赋值。"
            )
        else:
            lines.append("今晚没有人被袭击，解药今晚用不上。不要输出 SAVE 赋值。")
    else:
        lines.append(
            "你的解药已经用完，今晚救不了任何被袭击的玩家。"
            "严禁输出 SET VARIABLE:<< SAVE = ... >>。"
        )

    if has_poison:
        lines.append(
            f"你手里还有一瓶毒药，可以毒杀一名存活玩家（当前存活：{alive_str}）。"
            "如果要使用毒药，请输出：SET VARIABLE:<< @POISON = @目标名字 >>；"
            "如果决定不用，就不要输出 @POISON 赋值。"
        )
    else:
        lines.append("你的毒药已经用完，今晚无法毒人。严禁输出 SET VARIABLE:<< @POISON = ... >>。")

    if has_antidote and has_poison:
        lines.append(
            "注意：女巫一晚只能使用一瓶药，上面两个 SET VARIABLE 最多只能输出其中一个，也可以都不输出。"
        )

    return {"witch_prompt_text": "\n".join(lines)}


def get_order(from_, sheriff, alive):
    """根据警长决定的方向，生成白天发言顺序。"""

    alive = [_as_name(p) for p in alive]
    sheriff = _as_name(sheriff)
    from_ = _as_name(from_)

    if not alive:
        return []

    # 没有警长，直接按照存活名单顺序发言
    if not sheriff or sheriff not in alive:
        return alive

    sheriff_index = alive.index(sheriff)

    # 从警长左边开始
    if from_ == "左":
        return [
            alive[(sheriff_index + i) % len(alive)]
            for i in range(1, len(alive) + 1)
        ]

    # 从警长右边开始
    if from_ == "右":
        return [
            alive[(sheriff_index - i) % len(alive)]
            for i in range(1, len(alive) + 1)
        ]

    # 如果 AI 没有正确输出“左/右”，给一个稳定的兜底
    return [
        alive[(sheriff_index + i) % len(alive)]
        for i in range(1, len(alive) + 1)
    ]


def announce_death(dead_tonight):
    """晨间播报文案。"""
    dead = [_as_name(d) for d in (dead_tonight or []) if _as_name(d)]
    if not dead:
        return {"announcement": "昨晚是平安夜，没有人死亡。"}
    return {"announcement": f"昨晚死亡：{'、'.join(dead)}。"}


def collect_vote(votes, voter_name, target):
    """把一票写进共享票箱（就地修改）。
    $vote_results 是全局一份的 shared 变量：par 并发分支各自写不同的键
    （dict 单键赋值 GIL 原子），互不覆盖；返回同一对象供 out 写回（幂等）。"""
    voter_name = _as_name(voter_name)
    target = _as_name(target)
    if voter_name:
        votes[voter_name] = target
    return votes


def process_votes_and_end(votes, alive_players, roles_dict, wolves, sheriff, hunter="", god=""):
    """计票 -> 放逐 -> 判胜负（屠边制）。

    普通玩家投票权重为1，警长投票权重为1.5。
    只统计投给存活玩家的票；空串/场外名字视为弃票。
    平票→进入平票 PK：本轮无人出局，is_pk=True、$pk_candidates=并列最高者名单，
    由 pk_decide_votes 在 PK 重投后裁决。
    不清空票箱：announce_vote 还要念票，次日由 DayPhase.init 清空。
    同步维护 wolves / wolf_room（上帝来自 god 参数，如剧本 @上帝）。
    猎人被放逐出局 → hunter_dead_today=true（放逐出局可以开枪）。
    """
    alive_players = list(alive_players or [])
    alive_set = {str(a) for a in alive_players}
    roles_dict = roles_dict or {}
    wolves = list(wolves or [])
    sheriff = _as_name(sheriff)
    hunter = _as_name(hunter)
    god = _as_name(god)
    is_pk = False
    pk_candidates = []

    clean = {}
    for voter, target in (votes or {}).items():
        voter = _as_name(voter)
        target = _as_name(target)

        if voter and target and voter in alive_set and target in alive_set:
            clean[voter] = target

    if not clean:
        eliminated_today = "无人"
    else:
        counts = {}

        for voter, target in clean.items():
            # 警长1.5票，其他玩家1票
            weight = 1.5 if voter == sheriff else 1
            counts[target] = counts.get(target, 0) + weight

        max_votes = max(counts.values())
        top = [name for name, v in counts.items() if v == max_votes]

        if len(top) > 1:
            # 平票 → 平票 PK：本轮无人出局，谁都不走，交给 PK 重投裁决
            eliminated_today = "无人"
            is_pk = True
            pk_candidates = top
        else:
            eliminated_today = top[0]
            is_pk = False
            pk_candidates = []

    if eliminated_today == "无人":
        new_alive = list(alive_players)
    else:
        new_alive = [a for a in alive_players if a != eliminated_today]

    new_wolves = [w for w in wolves if w in new_alive]

    game_over, winner = _judge_game_over(new_alive, roles_dict)

    return {
        "eliminated_today": eliminated_today,
        "alive": new_alive,
        "wolves": new_wolves,
        "wolf_room": ([god] if god else []) + new_wolves,
        "game_over": game_over,
        "winner": winner,
        "is_pk": is_pk,
        "$pk_candidates": pk_candidates,
        "vote_route": ("pk" if is_pk else
                       ("transfer" if (sheriff and sheriff not in new_alive) else "out")),
        "hunter_dead_today": bool(hunter) and eliminated_today == hunter,
    }


def pk_decide_votes(votes, pk_candidates, alive_players, roles_dict, wolves, sheriff, day=0,
                    hunter="", god=""):
    """平票 PK 重投计票 -> 放逐 -> 判胜负（屠边制）。
    有效票三条件：投票者存活、投票者不是平票候选人、目标在平票名单里。
    警长票按 1.5 计（在场且非候选人时）。
    再次平票或无有效票 → 今日无人出局（狼人杀惯例：平票不放逐，入夜继续）。
    票箱已在剧本 pk_init 节点清空（第一轮的票已由 announce_vote 念过，之后无人再用），
    本函数只认 PK 重投的票，并生成只含 PK 票的公告 announce_text（明细与计票同口径）。
    同步维护 wolves / wolf_room（上帝来自 god 参数，如剧本 @上帝）。
    猎人被 PK 重投放逐 → hunter_dead_today=true（放逐出局可以开枪）。"""
    alive_players = list(alive_players or [])
    roles_dict = roles_dict or {}
    wolves = list(wolves or [])
    sheriff = _as_name(sheriff)
    hunter = _as_name(hunter)
    god = _as_name(god)
    cand_set = {_as_name(c) for c in (pk_candidates or []) if _as_name(c)}
    voters_ok = [a for a in (_as_name(a) for a in alive_players)
                 if a and a not in cand_set]

    clean = {}
    for voter, target in (votes or {}).items():
        v, t = _as_name(voter), _as_name(target)
        if v in voters_ok and t in cand_set:
            clean[v] = t

    counts = {}
    for voter, target in clean.items():
        weight = 1.5 if voter == sheriff else 1
        counts[target] = counts.get(target, 0) + weight

    if not counts:
        eliminated_today = "无人"
    else:
        max_votes = max(counts.values())
        top = [name for name, v in counts.items() if v == max_votes]
        eliminated_today = top[0] if len(top) == 1 else "无人"

    # 公告文案：明细只含本次 PK 重投的票（与 clean 同口径），弃权如实标注。
    parts = []
    for v in voters_ok:
        t = clean.get(v)
        t_raw = _as_name((votes or {}).get(v))
        if t:
            parts.append(f"{v}→{t}")
        elif t_raw:
            parts.append(f"{v}→{t_raw}（无效票）")
        else:
            parts.append(f"{v}→弃权")
    detail = ("PK 投票明细：" + "、".join(parts)) if parts else "PK 投票明细：（无有资格投票人）"
    note = ("PK 计票：" + "、".join(f"{n} {c} 票" for n, c in
             sorted(counts.items(), key=lambda kv: -kv[1]))
            if counts else "PK 计票：无人投出有效票")
    if counts and sheriff and sheriff in voters_ok and clean.get(sheriff):
        note += "（警长票按1.5计）"

    if eliminated_today != "无人":
        reason = f"{eliminated_today} 在平票 PK 重投中得票最多，被放逐。"
    elif counts:
        reason = "、".join(top) + " 再次平票——今日无人出局，夜晚照常降临。"
    else:
        reason = "PK 重投无有效票——今日无人出局，夜晚照常降临。"

    announce = (f"—— 第 {day} 天 · 平票 PK 结果 ——\n"
                f"{detail}\n{note}\n{reason}")

    if eliminated_today == "无人":
        new_alive = list(alive_players)
    else:
        new_alive = [a for a in alive_players if a != eliminated_today]

    new_wolves = [w for w in wolves if w in new_alive]

    game_over, winner = _judge_game_over(new_alive, roles_dict)

    return {
        "eliminated_today": eliminated_today,
        "alive": new_alive,
        "wolves": new_wolves,
        "wolf_room": ([god] if god else []) + new_wolves,
        "game_over": game_over,
        "winner": winner,
        "vote_route": ("transfer" if (sheriff and sheriff not in new_alive) else "out"),
        "announce_text": announce,
        "hunter_dead_today": bool(hunter) and eliminated_today == hunter,
    }


def apply_hunter_shot(shot_target, alive_players, roles_dict, wolves, sheriff, god=""):
    """猎人开枪结算：中枪者必须是存活玩家，否则视为空放（枪响没人倒下）。
    中枪者当场出局，同步维护 wolves / wolf_room（上帝来自 god 参数，如剧本 @上帝），
    并按屠边制重判胜负——猎人一枪完全可能终局。
    返回 shot_announce / alive / wolves / wolf_room / game_over / winner。"""
    shot_target = _as_name(shot_target)
    alive_players = list(alive_players or [])
    roles_dict = roles_dict or {}
    wolves = list(wolves or [])
    sheriff = _as_name(sheriff)
    god = _as_name(god)

    if shot_target and shot_target in alive_players:
        new_alive = [a for a in alive_players if a != shot_target]
        announce = f"猎人扣动扳机，{shot_target} 应声倒地！"
    else:
        new_alive = list(alive_players)
        announce = "猎人没有开枪（或枪口没有指向场上的存活玩家），无人倒下。"

    new_wolves = [w for w in wolves if w in new_alive]
    game_over, winner = _judge_game_over(new_alive, roles_dict)

    return {
        "shot_announce": announce,
        "alive": new_alive,
        "wolves": new_wolves,
        "wolf_room": ([god] if god else []) + new_wolves,
        "game_over": game_over,
        "winner": winner,
    }


def pk_announce(pk_candidates, alive_players, sheriff, day):
    """白天放逐投票平票 PK 的公开播报。
    PK 重投的合法投票人 = 存活玩家 − 平票候选人；警长若存活且非候选人，
    照常参与重投且按 1.5 票计（pk_decide_votes 同口径）。
    返回 {"announce_text": 播报, "$pk_voters": 重投票人名单}——
    两个 key 都必须在剧本 out: 中声明。"""
    cands = [_as_name(c) for c in (pk_candidates or []) if _as_name(c)]
    voters = _alive_minus(alive_players, cands)
    cand_str = "、".join(cands)
    sheriff = _as_name(sheriff)
    right_note = (f"警长{sheriff}的重投票按 1.5 票计。"
                  if sheriff and sheriff in voters else "")
    announce = (
        f"—— 第 {day} 天 · 平票 PK ——\n"
        f"放逐投票平票的是：{cand_str}，本轮暂无人出局。\n"
        f"现在进入 PK 环节：{cand_str} 每人再说一句话为自己申辩；"
        f"然后由其余 {len(voters)} 位（{'、'.join(voters)}）在平票的玩家里重投，"
        f"得票多者被放逐。{right_note}\n"
        f"若再次平票，今日无人出局，夜晚照常降临。"
    )
    return {"announce_text": announce, "$pk_voters": voters}


def _alive_minus(alive_players, exclude):
    """存活名单 − 排除名单（全部归一化为名字字符串后过滤）。"""
    excl = {_as_name(x) for x in (exclude or []) if _as_name(x)}
    return [a for a in (_as_name(p) for p in (alive_players or []))
            if a and a not in excl]


def pk_announce_election(pk_candidates, candidates, alive_players):
    """警长竞选平票 PK 的公开播报。
    PK 重投的合法投票人 = 警下玩家（存活 − 全部上警候选人，与首轮竞选投票同权）。
    返回 {"announce_text": 播报, "$pk_voters": 重投票人名单}。"""
    cands = [_as_name(c) for c in (pk_candidates or []) if _as_name(c)]
    all_candidates = [_as_name(c) for c in (candidates or []) if _as_name(c)]
    voters = _alive_minus(alive_players, all_candidates)
    cand_str = "、".join(cands)
    announce = (
        f"—— 警长竞选 · 平票 PK ——\n"
        f"警长竞选中平票的是：{cand_str}，暂无人当选警长。\n"
        f"平票的候选人每人再说一句话为自己拉票；"
        f"然后由警下玩家（{len(voters)} 位：{'、'.join(voters)}）"
        f"在平票的候选人里重投，得票多者当选警长。\n"
        f"若再次平票，本轮无人当选警长，今日白天按无警长进行。"
    )
    return {"announce_text": announce, "$pk_voters": voters}


def pk_decide_election(votes, pk_candidates, candidates, alive):
    """警长竞选 PK 重投计票。
    有效票：投票者是警下存活玩家（存活 − 全部上警候选人）、目标在平票名单里。
    得票多者当选；再次平票或无有效票 → 无人当选（@sherif 返回空串）。
    票箱已在剧本 竞选pk重置 节点清空，公告 announce_text 只含 PK 重投的票
    （明细与计票同口径，弃权如实标注）。"""
    from collections import Counter

    candidates = list(candidates or [])
    alive = list(alive or [])
    candidate_set = set(candidates)
    voter_set = set(alive) - candidate_set
    cand_set = {_as_name(c) for c in (pk_candidates or []) if _as_name(c)}

    valid_votes = {
        _as_name(v): _as_name(t)
        for v, t in (votes or {}).items()
        if _as_name(v) in voter_set and _as_name(t) in cand_set
    }

    # 公告文案：明细只含本次 PK 重投的票（与 valid_votes 同口径），弃权如实标注。
    voter_order = [p for p in (_as_name(a) for a in alive) if p in voter_set]
    parts = []
    for v in voter_order:
        t = valid_votes.get(v)
        t_raw = _as_name((votes or {}).get(v))
        if t:
            parts.append(f"{v}→{t}")
        elif t_raw:
            parts.append(f"{v}→{t_raw}（无效票）")
        else:
            parts.append(f"{v}→弃权")
    detail = ("PK 投票明细：" + "、".join(parts)) if parts else "PK 投票明细：（无警下投票人）"

    if not valid_votes:
        announce = ("—— 警长竞选 · 平票 PK 结果 ——\n"
                    f"{detail}\n"
                    "PK 计票：无人投出有效票。本轮无人当选警长，今日白天按无警长进行。")
        return {"@sherif": "", "election_route": "done", "announce_text": announce}

    counter = Counter(valid_votes.values())
    max_votes = max(counter.values())
    winners = [p for p, c in counter.items() if c == max_votes]
    note = ("PK 计票：" + "、".join(f"{p} {c} 票" for p, c in
            sorted(counter.items(), key=lambda kv: -kv[1])))

    if len(winners) == 1:
        announce = ("—— 警长竞选 · 平票 PK 结果 ——\n"
                    f"{detail}\n{note}\n"
                    f"{winners[0]} 在 PK 重投中得票最多，当选警长。")
        return {"@sherif": winners[0], "election_route": "done", "announce_text": announce}

    announce = ("—— 警长竞选 · 平票 PK 结果 ——\n"
                f"{detail}\n{note}\n"
                + "、".join(winners)
                + " 再次平票——本轮无人当选警长，今日白天按无警长进行。")
    return {"@sherif": "", "election_route": "done", "announce_text": announce}


def assign_roles(players, god=""):
    """按传入的玩家名单全员盲抽发牌——名单直接吃剧本的 alive 变量，场上玩家随便改不用动这里。
    牌型按人数动态铺：固定 3 狼 + 预言家 + 女巫 + 猎人，其余全是村民（标准 9 人局 = 3狼3神3民）；
    不足 7 人（3狼3神之外连 1 个村民都凑不出）响亮报错。
    god 是主持人（如剧本 @上帝），不参与、不发牌，坐镇夜间狼人房：wolf_room = 上帝 + 全体狼人。
    @村民1/@村民2/@村民3 只记录前三位村民（剧本就这三个变量），完整名单以 roles 为准。"""
    players = [_as_name(p) for p in (players or []) if _as_name(p)]
    if len(set(players)) != len(players):
        raise ValueError(f"玩家名单有重复：{players}")
    if len(players) < 7:
        raise ValueError(f"玩家至少要 7 人才能开局（当前 {len(players)} 人：{players}）"
                         "——牌型固定 3狼+预言家+女巫+猎人，其余村民。")
    role_pool = ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人"] + ["村民"] * (len(players) - 6)
    random.shuffle(role_pool)
    roles = dict(zip(players, role_pool))

    wolves = [p for p, r in roles.items() if r == "狼人"]
    seer = next(p for p, r in roles.items() if r == "预言家")
    witch = next(p for p, r in roles.items() if r == "女巫")
    hunter = next(p for p, r in roles.items() if r == "猎人")
    villagers = [p for p, r in roles.items() if r == "村民"]
    god = _as_name(god)

    return {
        "roles": roles,
        "wolves": wolves,
        "wolf_room": ([god] if god else []) + wolves,
        "@预言家": seer,
        "@女巫": witch,
        "@猎人": hunter,
        "@村民1": villagers[0] if villagers else "",
        "@村民2": villagers[1] if len(villagers) > 1 else "",
        "@村民3": villagers[2] if len(villagers) > 2 else "",
    }
