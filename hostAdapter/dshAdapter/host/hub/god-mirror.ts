/**
 * god-mirror.ts — 主会话 → 投影中心FEMO外旁挂（原「上帝窗镜像」）。
 *
 * 【链路B 2026-09-19 旧链路退役·2026-09-20 大扫除】dsh 窗镜像半边（窗侧写入
 * +三层幂等+开轮锚直写）与水位补齐（god-mirror 水位文件/catch-up/串行化）整段
 * 删除——上帝窗内容由投影中心（hub）供给，「打开即全」由 hub 账本+hub-view
 * 代理承担。本文件只剩活半边：FEMO外轮 hub 旁挂（hubFeedMainEvent）+
 * registerRealtimeListener 实时监听。原双通路架构史见 git log。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { blocksToText } from '../engine-transcript'
import { hubFeedRow, hubHostSegCurrent, hubHostSegOpen, hubHostSegClose } from './hub-feed' // 投影中心：FEMO外轮=宿主自己开的容器（2026-09-19）；无脑映射兜底用 Current（2026-09-21）
import { isFemoSession } from '../session-roster' // FEMO 会话判据（唯一尺子，与名册同源）
import { pluginSourceName } from '../compat/plugin-source' // 插件生产者身份（新旧两形态同判）
import type { PresetBearingIdentity } from '../persona'

/** 主会话事件白名单（实时监听过滤；镜像半边退役后仍喂 hub 旁挂分派）。
 *  turn 号保持主会话原号（1,2,3…），子代理镜像 turn 从 100001 起，天然不冲突。 */
const MIRROR_MAIN_EVENTS = new Set([
  'turn/start', 'step/start', 'step/end', 'turn/end',
  'assistant/message', 'tool/call', 'tool/result',
  'user/message',
])

export interface GodMirror {
  /** 注册实时监听器（主会话事件白名单转发进 hub FEMO外旁挂）。 */
  registerRealtimeListener(ctx: Context): void
}

/** assistant/message 的 content 数组：新旧两版形状（顶层 content / message.content）通吃。 */
function hubContentOf(data: { content?: unknown; message?: { content?: unknown } }): unknown {
  if (Array.isArray(data.content)) return data.content
  return data.message?.content
}

export function createGodMirror(deps: {
  /** FEMO内参与轮反查（main-actor 提供；注入而非 import，避免 main-actor →
   *  engine-events → god-mirror 的循环依赖）。 */
  mainActorSceneActor?: (sid: string, turn: number) => string | undefined
  /** 【2026-09-23 用户拍板】这条 user/message 是不是 main 下场注入（上场/重试
   *  通知）。上帝视角口径=「main 全部FEMO外内容 + 全部角色FEMO内内容，main 的FEMO内
   *  排除」：参与运行通知属于FEMO内管线（内容由引擎路落账），这里整拍剔除——既不发
   *  旁白行，也**不开宿主轮容器**。容器不开，主Agent直播桥（engine-events）就
   *  自然不喂帧（它先查 hubHostSegCurrent），参与轮的 cot/台词不会再以「主Agent」
   *  身份抄进 god 窗（Job 2471/2473 实证：drafts.json 里那个 h:…:<seq> 容器装的
   *  就是参与轮自己的 reasoning/say）。 */
  isMainActorNotice?: (sid: string, text: string) => boolean
}): GodMirror {

  /** tool/call 的 callId→name 登记（tool/result 喂 hub 时取名用；超上限整表
   *  清防胀——查不到名只是网页上「工具结果」少个名字，无正确性影响）。 */
  const hubToolNames = new Map<string, string>()

  /** 【2026-09-22 meow 排除】meow-memory 插件内容的投影静默，两类：
   *  ① 指令轮整轮屏蔽：meow-memory 的 reflect/dream 指令消息（steer/followup 落成
   *     user/message，正文带标记）引发的整轮 AI 回答——指令帧登记禁轮（轮号从
   *     turn/start 跟踪表取；user/message 事件本身不带 turn），同轮的思考链/工具/
   *     台词/收口全丢，turn/end 解禁；真人插话在 steer 语义下会并进禁轮的后续
   *     step，故真人消息当场赎回、从那一拍起恢复投影。
   *  ② 上下文注入只丢帧：快照/命中/压缩重注入/welcome 通知永远与真人消息同批
   *     落账且排在其前——丢掉注入帧后，真人消息照常进账开容器，账面与「没注入
   *     过」一致，不产生空锚点。 */
  const MEOW_BAN_UNTIL_TURN_END = -1
  const meowBannedTurns = new Map<string, number>() // sid -> 被禁 turn（-1=轮号未知，禁到 turn/end）
  const sidCurTurn = new Map<string, number>() // sid -> turn/start 跟踪的最新轮号
  const MEOW_DIRECTIVE_MARKERS = [
    '[meow-memory-reflect]',
    '[meow-memory-dream]',
    '【记忆整理标记】', // 旧 delegate 打点（v0.23 遗留识别，与 meow-memory 自身口径一致）
    '【记忆反思标记】',
    '【记忆反思完成标记】',
  ]

  /** 戏外回合缓冲（2026-09-19 用户拍板「戏外一整轮也要放到一起不能分开」）：
   *  一个 main 回合的思考链/工具/台词攒一盘，turn/end 收口→一条 section 行
   *  fill-slot 回填空位（空位=user 发言时占住的下一个行号，回话位置紧跟
   *  user 发言，中途FEMO内行照常往后排）。sid 一盘（main 回合天然串行）。 */
  const hubTurnBuf = new Map<string, { turn: number; items: Array<Record<string, unknown>> }>()

  function hubTurnBufOf(sid: string, turn: number): { turn: number; items: Array<Record<string, unknown>> } {
    const buf = hubTurnBuf.get(sid)
    if (buf !== undefined) {
      if (buf.turn !== turn) {
        flushHubTurnBuf(sid)   // 上一回合没收口就来了新回合：先把旧的落账
        return hubTurnBufOf(sid, turn)
      }
      return buf
    }
    const fresh = { turn, items: [] as Array<Record<string, unknown>> }
    hubTurnBuf.set(sid, fresh)
    return fresh
  }

  /** FEMO外回合收口（2026-09-19 三期：从「空位回填」改成「宿主自己开的容器」）。
   *  容器在 user 发言那拍就开好了（hubHostSegOpen），这里把攒下的一盘定稿 items
   *  交给 hub 收口：同 kind 的流式草稿被吸收、没流到的 kind 由草稿转正兜底。
   *  没有 buf 也要收——不收就会留一个永远「正在…」的空块。
   *  幂等靠 hubHostSegOpen 里那枚由 seq 推出来的键（重放不重账）。 */
  function flushHubTurnBuf(sid: string): void {
    const buf = hubTurnBuf.get(sid)
    hubTurnBuf.delete(sid)
    hubHostSegClose(sid, buf?.items ?? [])
  }

  /** 【2026-09-21 无脑映射】补开宿主轮容器（本回合没有 user/message 打头时）：
   *  已开（正常 user 打头）→ no-op。段键 h:<sid>:a<seq>——从触发帧的源事件号
   *  推出，重放重算同键，hub 开段幂等（同 seg 不重复开）。 */
  function ensureHostSeg(sid: string, seq: number | string, turn: number): void {
    if (hubHostSegCurrent(sid) !== undefined) return
    hubHostSegOpen(sid, { seq: `a${seq}`, turn: Number.isFinite(turn) ? turn : undefined })
  }


  /** 戏外旁挂投影中心（2026-09-19 用户拍板：hub 两边都收、收下来一个样）。
   *  【2026-09-21 用户拍板：主会话戏外无脑映射】戏外内容一律进账一律开容器，
   *  来源用 actor 区分（用户气泡 / 插件旁白）；唯一例外=主 agent 参与轮，
   *  其内容引擎路（wait_key 织入）已以运行结构落账，镜像再抄就是双份，
   *  故 mainActorSceneActor 反查命中即跳过（防双份留在喂侧，hub 不做内容去重）：
   *  · user/message：一律喂行（真用户 role:'human' 画气泡；plugin 拍 actor='插件'
   *    灰色旁白）+ 一律开宿主轮容器——它是回合锚点，后面主Agent的字有家可归；
   *  · 非 user 打头的回合（AI 自发起轮等）：第一个内容帧补开容器（ensureHostSeg）；
   *  · 其余事件进回合缓冲（思考链/工具/台词按到达序攒一盘），turn/end 收口 →
   *    hubHostSegClose 定稿交 hub（同 kind 草稿被吸收、不双份）；
   *  · tool-call 块在 assistant/message 里跳过（tool/call 事件单独进缓冲，防双份）；
   *    tool_result 的名字靠 callId 反查，查不到留空；
   *  · 【2026-09-22 meow 排除】meow-memory 指令轮整轮静默（meowBannedTurns）、
   *    上下文注入只丢帧——见上方 meow 排除注。 */
  function hubFeedMainEvent(sid: string, event: SessionEvent): void {
    try {
      const data = event.data as {
        turn?: unknown; text?: unknown; content?: unknown
        callId?: unknown; name?: unknown; arguments?: unknown
        source?: { kind?: unknown; plugin?: unknown }
        message?: { content?: unknown; source?: { callId?: unknown } }
      }
      const mT = Number(data.turn)
      const mTn = Number.isFinite(mT) ? mT : -1
      const srcSeq = `main:${sid}:${event.seq}`
      const turnField = Number.isFinite(mT) ? { turn: mT } : {}
      // 【meow 排除①】被禁轮的思考链/工具/台词一律不进投影；turn/end 只用来解禁
      // （禁轮无容器无缓冲，收口对 hub 本就是 no-op）。
      const meowBan = meowBannedTurns.get(sid)
      if (meowBan !== undefined) {
        if (event.type === 'turn/end') {
          meowBannedTurns.delete(sid)
          return
        }
        if (meowBan === MEOW_BAN_UNTIL_TURN_END || mTn === meowBan) return
      }
      if (event.type === 'user/message') {
        // 【2026-09-21 用户拍板：主会话戏外无脑映射】user/message 一律进账，
        // 来源用 actor 区分（延续 2026-09-19 拍板：机器指令不冒充用户）：
        // · 真用户（source.kind==='user'，缺失按真用户放行）→ actor='用户'
        //   + role:'human'，页面画用户气泡；
        // · 插件注入（plugin 来源：派工回执/重试反馈/停止运行通知）→ actor='插件'，
        //   灰色旁白行——这也是会话里真实发生过的一拍，收戏后的复盘轮就挂在
        //   派工后面；不进账则整轮失去锚点（2026-09-21 实锤：job 1949 收戏
        //   后两轮全丢：容器只由真用户发言开，plugin 拍 return 掉了）。
        const srcKind = data.source?.kind
        const isHuman = srcKind === undefined || srcKind === 'user'
        const text = typeof data.text === 'string' && data.text.trim() !== ''
          ? data.text
          : blocksToText(hubContentOf(data))
        // 【2026-09-23 用户拍板：god=main 全部戏外 + 全部角色戏内，main 戏内排除】
        // 参与运行注入（参与/重试通知）是FEMO内管线的一拍：FEMO内段落账里已有它的
        // prompt，这里再抄一遍就是双份；更要紧的是它会开出一个宿主轮容器，而
        // 主Agent直播桥只认「容器在不在」——参与轮自己的 cot/台词就被当成主Agent的
        // 字喂进去（Job 2471 n=63/n=74、Job 2473 n=29/n=34 实证）。整拍剔除。
        if (deps.isMainActorNotice?.(sid, text) === true) return
        // 【meow 排除①】指令消息（带 meow-memory 标记；真人亲手发的 srcKind='user'
        // 绝不判标记——与 meow-memory 自身防误伤口径一致）：登记禁轮后整帧丢弃。
        if (srcKind !== 'user' && MEOW_DIRECTIVE_MARKERS.some((m) => text.includes(m))) {
          meowBannedTurns.set(sid, sidCurTurn.get(sid) ?? MEOW_BAN_UNTIL_TURN_END)
          return
        }
        // 【meow 排除②】meow-memory 上下文注入（快照/命中/重注入/welcome）：只丢
        // 这一帧——它永远排在同批真人消息前面，真人消息紧接着照常进账开容器。
        // 双形态同判（dsh 0.1.7 v4 起 kind='plugin:meow-memory' 且 plugin 字段
        // 丢弃；旧日志仍是 kind='plugin'+plugin 字段）。
        if (pluginSourceName(data.source) === 'meow-memory') return
        // 禁轮内真人插话（steer 语义并入同轮）= 赎回：从这一拍起恢复本轮投影；
        // 禁轮内其他插件行（如 femo 回执）随轮静默。
        if (meowBan !== undefined) {
          if (isHuman) meowBannedTurns.delete(sid)
          else return
        }
        if (text.trim() !== '') {
          // 发言 + 开容器两帧同一微批（同一同步块内 push，必然相邻入账）：
          // 容器占住下一个行号，主Agent流往里喂字，turn/end 收口——位置锁死在本拍之后。
          // 【2026-09-20 会话账本】两帧都按会话直投（hubFeedRow 带 sid）——无运行照收，
          // 录制不等开戏也不等绑定。
          hubFeedRow(sid, {
            zone: 'outside', kind: 'whisper',
            actor: isHuman ? '用户' : '插件', ...(isHuman ? { role: 'human' } : { role: 'plugin' }),
            text, ...turnField, src_seq: srcSeq,
          })
        }
        // 空拍（纯注入无文本）也开容器：事件本身是回合起点，后面主Agent的字有家可归。
        hubHostSegOpen(sid, { seq: event.seq, turn: Number.isFinite(mT) ? mT : undefined })
        return
      }
      if (Number.isFinite(mT) && deps.mainActorSceneActor?.(sid, mT) !== undefined) return
      // 【2026-09-21 无脑映射兜底】本 sid 还没开宿主轮容器（本回合不是
      // user/message 打头：AI 自发起轮等）→ 第一个内容帧到达时补开：段键仍从
      // 源事件 seq 推（a<seq>），重放重算同键，hub 同 seg 幂等不重开。开场
      // 时机=hubTurnBufOf 新建 buf 的同一拍（旧回合未收口会先 flush 再建新
      // buf，所以「无容器」在此必然=本回合第一帧），不会叠容器。
      if (event.type === 'assistant/message' || event.type === 'tool/call') {
        ensureHostSeg(sid, event.seq, mTn)
      }
      if (event.type === 'assistant/message') {
        const content = hubContentOf(data)
        if (!Array.isArray(content)) return
        const buf = hubTurnBufOf(sid, mTn)
        for (const block of content) {
          const bl = block as { type?: string; text?: unknown }
          const t = String(bl.text ?? '')
          if (bl.type === 'reasoning' && t.trim() !== '') {
            buf.items.push({ kind: 'cot', text: t })
          } else if (bl.type === 'text' && t.trim() !== '') {
            buf.items.push({ kind: 'say', text: t })
          }
          // tool-call 块跳过：tool/call 事件单独进缓冲（防双份）
        }
        return
      }
      if (event.type === 'tool/call') {
        const name = typeof data.name === 'string' ? data.name : ''
        if (typeof data.callId === 'string' && name !== '') {
          if (hubToolNames.size > 1000) hubToolNames.clear()
          hubToolNames.set(data.callId, name)
        }
        hubTurnBufOf(sid, mTn).items.push({
          kind: 'tool', text: '',
          toolCall: { name: name || 'unknown', arguments: typeof data.arguments === 'string' ? data.arguments : '' },
        })
        return
      }
      if (event.type === 'tool/result') {
        const callId = typeof data.message?.source?.callId === 'string' ? data.message.source.callId : undefined
        const name = callId !== undefined ? hubToolNames.get(callId) : undefined
        const items = Array.isArray(data.message?.content) ? data.message.content : []
        let text = ''
        for (const block of items) {
          const bl = block as { type?: string; text?: unknown; content?: unknown }
          if (bl.type !== 'tool-result') continue
          text = typeof bl.text === 'string' ? bl.text : blocksToText(bl.content)
          if (text.trim() !== '') break
        }
        if (text.trim() === '') return
        hubTurnBufOf(sid, mTn).items.push({
          kind: 'tool_result', text: '',
          toolResult: { node: name ?? '', output: text },
        })
        return
      }
      if (event.type === 'turn/end') {
        flushHubTurnBuf(sid)
      }
    } catch { /* 幕布旁路绝不挡运行 */ }
  }

  /** 主会话事件分派：白名单内事件喂投影中心FEMO外旁挂。
   *  2026-09-19 二期：喂全主AgentFEMO外干活全程（cot/tool/tool_result），FEMO内轮
   *  在 hubFeedMainEvent 内部按 turn 反查剔除（post_speech 段落已覆盖）。
   *  turn/end 也在内：FEMO外回合收口→整轮成段回填空位。 */
  function mirrorMainEventToGod(sid: string, event: SessionEvent): void {
    if (event.type === 'turn/start') {
      // 【meow 排除①】轮号跟踪：指令 user/message 事件不带 turn，禁轮登记从这里取号。
      const t = Number((event.data as { turn?: unknown } | undefined)?.turn)
      sidCurTurn.set(sid, Number.isFinite(t) ? t : MEOW_BAN_UNTIL_TURN_END)
      return
    }
    if (event.type === 'user/message' || event.type === 'assistant/message'
      || event.type === 'tool/call' || event.type === 'tool/result'
      || event.type === 'turn/end') {
      hubFeedMainEvent(sid, event)
    }
  }

  /** 实时监听：主会话事件白名单转发。投影窗自身与子代理会话都带
   * parentSession（header），在此天然排除——无递归、无重复。
   * 【2026-09-23 用户拍板「非 FEMO 会话不发」】会话直投（feed_session）链的
   * 唯一咽喉在此：user 行/容器开关/回合缓冲全是本监听喂的，主Agent流（engine-
   * events）只往这里开出的容器里喂字——这里静默，非 FEMO 会话整条直投链就
   * 断了根（hub 那边 feed 首见即收 mains，普通聊天会话混进历届主会话的病根
   * 实锤：session-4101a8e9）。判据与名册同一把尺（isFemoSession）；正向记忆：
   * FEMO 身份只增不减（选预设/首跑FEMO脚本后不会退回），命中即永久放行；**阴性
   * 绝不缓存**——会话可能中途变 FEMO（首次 /femo 建 host-history 账），当拍
   * 起自然放行。 */
  const femoFedSids = new Set<string>()
  function registerRealtimeListener(ctx: Context): void {
    ctx.on('session/event', (session: { header: { parentSession?: unknown }; id: unknown }, event: SessionEvent) => {
      if (session.header.parentSession !== undefined) return
      if (!MIRROR_MAIN_EVENTS.has(event.type)) return
      const sid = String(session.id)
      if (!femoFedSids.has(sid)
        && !isFemoSession(sid, session as unknown as PresetBearingIdentity)) return
      femoFedSids.add(sid)
      mirrorMainEventToGod(sid, event)
    })
  }

  return { registerRealtimeListener }
}
