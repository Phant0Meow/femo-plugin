"""群聊室配套：随机发言节奏 + 挑选下一位发言人（模拟真人群聊节奏）。"""

import random
import time

# 发言节奏参数（秒）：等待区间 [WAIT_MIN, WAIT_MAX] 与偏斜强度 WAIT_SKEW。
# WAIT_SKEW 越大，样本越往最短处挤：3 ≈ 约四分之三落在 60~120 秒，
# 剩下的越接近 300 秒越稀，拖成低概率长尾——像真人偶尔冷场。
WAIT_MIN = 60.0
WAIT_MAX = 300.0
WAIT_SKEW = 3.0


def random_interval():
    """每轮 AI 发言前随机等待 15~120 秒。（旧节奏：可退场版/group-chat 仍在用）"""
    time.sleep(random.uniform(15, 120))
    return 0


def pick_wait_seconds():
    """偏斜采样：把均匀随机数 u 取 WAIT_SKEW 次幂压向低端——等待时长在
    20 秒处密度最高、向 70 秒单调衰减。"""
    return WAIT_MIN + (WAIT_MAX - WAIT_MIN) * (random.random() ** WAIT_SKEW)


def random_wait_and_pick(ais):
    """随机睡 20~70 秒（偏斜分布），再从 ais 里随机挑下一位发言人。

    ais 是 femo 传进来的在线 AI 名单（如 ["@DeepSeek", "@GLM", "@豆包"]）。
    返回谁，剧本里 @speaker 就是谁，下一个节点就由谁发言。
    名单空了（全员下线）就返回空字符串，由剧本的流程边守卫跳过发言，
    空转等人类把人拉回来。
    """
    time.sleep(pick_wait_seconds())
    if not ais:
        return ""
    return random.choice(ais)


# 轮替保底参数：某 AI 连续 (在线人数 + FAIR_FLOOR_EXTRA) 轮没发言，
# 下一轮必须是他。2 = 比「其他在线的人各说一轮再多一轮」还多一拍余量。
FAIR_FLOOR_EXTRA = 2


def pick_next_speaker(ais, last_speaker="", silence=None):
    """随机睡一段（偏斜分布），按「轮替 + 保底」规则选出下一位发言人。

    规则：
    - 不与上一位发言人重复（在线只剩他一人时豁免，否则会死空转）；
    - 保底：某位在线 AI 连续 n+2 轮没发言（n=当前在线人数），下一轮必须是他；
      多人同时触发保底时，选沉默最久的那位；
    - 每轮给没被选中的在线 AI 沉默计数 +1，被选中者清零；
      不在线的人不参与计数（不在桌上就不算沉默）。

    ais: 在线名单（femo 传来的 @actor 名列表）
    last_speaker: 上一位发言人（@speaker 原值，空串=开场）
    silence: 各 AI 沉默计数表（femo 的 @actor 键字典直传，如 {@DeepSeek: 0, ...}）
    返回 {"@speaker": 人选, "沉默轮数": 更新后的计数表}——out 两项按字典键映射。
    """
    time.sleep(pick_wait_seconds())
    ais = list(ais or [])
    counts = dict(silence) if silence else {}
    if not ais:
        return {"@speaker": "", "沉默轮数": counts}

    threshold = len(ais) + FAIR_FLOOR_EXTRA
    # 保底池：沉默到阈值的在线 AI 必须优先——保底豁免「不与上次重复」
    floor_pool = [a for a in ais if counts.get(a, 0) >= threshold]
    if floor_pool:
        longest = max(counts.get(a, 0) for a in floor_pool)
        speaker = random.choice([a for a in floor_pool
                                 if counts.get(a, 0) == longest])
    else:
        # 常规轮替：先剔掉上一位，只剩他一人时豁免
        pool = [a for a in ais if a != last_speaker] or ais
        speaker = random.choice(pool)

    for a in ais:
        counts[a] = 0 if a == speaker else counts.get(a, 0) + 1
    return {"@speaker": speaker, "沉默轮数": counts}
