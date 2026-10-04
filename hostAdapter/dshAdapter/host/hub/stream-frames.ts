/**
 * stream-frames.ts — 0.1.3 原生 assistant 流帧 → femo_stream 直播帧桥（2026-09-10）。
 *
 * 背景（0.1.3 实测根因，2026-09-10）：0.1.x 官方把「模型流式增量」从会话事件
 * 改成了 agent 级瞬时帧——agent-loop 的 AssistantStreamAttempt 每收一个 chunk
 * 就 emit 一发 agent/assistant-stream（core/agent-loop/src/agent.ts +
 * assistant-stream.ts），持久层只留一条把整段 stream 折叠进 data.stream 的
 * assistant/message（v2 会话格式），KNOWN_SESSION_EVENT_TYPES 里已无
 * assistant/chunk。于是本插件三条直播链路（AI 角色/主模型参与运行/主Agent）原先挂在
 * session/event 的 assistant/chunk 上的广播全部空转：投影窗失去打字机，内容只
 * 能在 turn/end 原子缓冲落地时一次性出现（「非得等 AI 全说完才猛一下出全文」的
 * 真凶）。本模块把这套帧按【既有 femo_stream 帧词汇】原样转出，前端 stream-store
 * 零改动（chunk 词汇没变：text-delta/reasoning-delta/tool-call-delta/
 * block-start/block-end，与旧 chunk 路径逐帧同形）。
 *
 * 另转出回合状态帧（turn_status，running=true/false）：前端据此在**各角色自己
 * 的块末行**点亮/熄灭「Deep diving…」状态行——与主窗口同规则（首次请求一起就
 * 显示，不等首 token；整 turn 常亮，工具执行/后续 react 步都不闪；回合收口才灭）。
 *
 * 【两条路径互斥，无需版本开关】旧版（meow fork 0.1.1-rc.2）只有会话事件
 * assistant/chunk、源码里没有 agent/assistant-stream；0.1.3 只有本帧、没有
 * chunk 会话事件（两版源码实证）。故同一宿主上不可能同时生效，不会重复广播。
 */

import type { Context } from '@deepseek-ai/cordis'
import { hubFeedChunk, hubFeedClearBucket, hubFeedEndTurn } from './hub-feed' // 投影中心直播帧旁路（2026-09-19）

/** llm StreamChunk 的消费面（与各调用点既有鸭子类型一致）。 */
export interface FemoStreamChunk {
  type?: string
  index?: number
  blockType?: string
  text?: unknown
  name?: unknown
  argumentsDelta?: unknown
  usage?: unknown
  block?: { type?: string }
}

/** 0.1.3 官方 AssistantStreamFrame 的消费面（start/chunk/end 三态）。 */
export interface AssistantStreamFrame {
  type?: string
  turn?: unknown
  step?: unknown
  chunk?: FemoStreamChunk
  outcome?: { kind?: string; eventType?: string }
}

/** agent/assistant-stream 载荷（官方 `{ agent, frame }`）。 */
export interface AssistantStreamPayload {
  agent?: { id?: unknown; session?: { id?: unknown; header?: { parentSession?: unknown } } }
  frame?: AssistantStreamFrame
}

/** 直播帧身份（与旧 chunk 路径同词汇：sid + 角色 + 步号）。
 *  【诊断 2026-09-11】新增可选 `turn`——排查"桶只有角色名没有轮次"用；
 *  目前只有 actor 路径会带（subagent-native 传 baseTurn），其余来源为空。
 *  【投影中心 2026-09-19】段引用分两个字段——**令牌与整键不能混用**（混用=字
 *  落进不存在的段，页面一个字都不长，见下）：
 *    · `ref`    = 引擎发给这一拍的**令牌**（wait_key）。宿主只管报令牌，段键
 *                 'w:<令牌>' 由 hub 拼——这是绝大多数出流点（角色/主模型参与运行）。
 *    · `segRef` = 宿主**自己造**的整键（宿主轮容器 'h:<sid>:<seq>'，主Agent流喂进
 *                 自己开的那只容器）。整键原样交给 hub，绝不能再套一层前缀。
 *    【2026-09-19 实锤】此前两者都塞进 `ref`，而 hub-feed 一律当完整键发给 hub
 *    ——hub 认段是"显式 seg 优先，否则由 wait_key 拼 'w:<wait_key>'"，于是令牌被
 *    当成整键，草稿全落在幻影段上（投影页自 14dd2c7 宿主薄壳化起再无打字机，
 *    生产 drafts.json 里全是 'j1856:ai_[投票]_N' 这种裸令牌键）。 */
export interface FemoStreamBase {
  sid: string
  node_name: string
  actor: string
  step?: number
  turn?: number
  ref?: string
  segRef?: string
}

/** 按旧 chunk 路径逐帧同形的词汇广播一个流式块。
 *  【链路B 2026-09-19 旧链路退役·2026-09-20 大扫除】femo_stream SSE 直播帧
 *  整段删除：投影窗打字机唯一来源 = hub 草稿（draft-delta），本函数只剩
 *  hubFeedChunk 旁挂这一件实事（保留函数形态=调用点零改动+留收口接缝）。 */
export function broadcastStreamChunk(base: FemoStreamBase, chunk: FemoStreamChunk): void {
  hubFeedChunk(base, chunk)  // 投影中心：报了段引用（令牌/整键）就长进那个段
}

/** 角色回合的 chunk 直播（两条执行路径的旧 chunk 链收口于此——2026-09-15
 *  全项目帧映射唯一份）：ai_token 台词条帧已随旧链路退役（2026-09-20 删净），
 *  其余与 broadcastStreamChunk 同形（step 经 base 携带）。 */
export function broadcastActorStreamChunk(base: FemoStreamBase, chunk: FemoStreamChunk): void {
  broadcastStreamChunk(base, chunk)
}

/** 清一个直播位的块（客户端按 sid+actorKey 清块：内容交接/孤儿 attempt 专用；
 *  条目与状态行保留）。 */
export function clearLiveBucket(base: FemoStreamBase): void {
  hubFeedClearBucket(base)  // 投影中心：有 ref 就撤该段的草稿；没有则撤老打字块（不转正）
}

/**
 * 订阅宿主原生 assistant 流帧（`ctx.on('agent/assistant-stream', …)`）。
 *
 * 事件名与载荷由 @deepseek-ai/dsh-agent 声明，本插件不依赖该包的类型面，故与
 * 官方消费方（api/session-controller/src/history.ts）同款手工注册：名字 + 鸭子
 * 类型载荷。`global` 与「未打标签监听器对 scope 事件全局可见」的 scope 语义一致
 * （packages/core/scope/src/index.ts scopeTarget），显式写上以防上层被包进 scope。
 *
 * @param ctx - 插件上下文（监听随插件 fiber 卸载）。
 * @param handler - 每帧回调（自行按 agent 身份过滤）。
 * @returns 注销函数。
 */
export function onAssistantStreamFrames(
  ctx: Context,
  handler: (payload: AssistantStreamPayload) => void,
): () => void {
  const on = ctx.on as unknown as (
    name: string,
    listener: (payload: AssistantStreamPayload) => void,
    options?: { global?: boolean },
  ) => () => void
  return on.call(ctx, 'agent/assistant-stream', handler, { global: true })
}

/**
 * 一个直播位（一个角色 / 一轮主模型参与运行 / 一条主Agent流）的帧折叠器。
 *
 * 除逐帧转出外，负责孤儿清屏：attempt 以 abandoned/<非 message> 收口时它的文字
 * 永远不会落进会话日志（落地的只有 assistant/message），若不清桶，客户端会在同
 * 一个 (index, step) 块上把两次尝试的 delta 拼成一坨。
 */
export class LiveStreamFrames {
  private orphan = false

  /**
   * @param base - 直播帧身份（sid/actor/node_name；step 逐帧覆盖）。
   * @param onChunk - 每个 chunk 帧的旁挂（如占用采样），不参与广播。
   */
  constructor(
    private readonly base: FemoStreamBase,
    private readonly onChunk?: (chunk: FemoStreamChunk) => void,
  ) {}

  /** 折叠一帧；非 chunk 帧只维护孤儿状态与回合状态行。 */
  frame(frame: AssistantStreamFrame): void {
    if (frame.type === 'start') {
      // 上一次尝试没交出 message（失败重试/中止）→ 清掉它的残留再重新开始。
      if (this.orphan) this.clear()
      // 首次请求即点亮，此后整 turn 常亮（react 多步之间工具执行期不灭——与
      // 官方 ChatView TurnStatus「rides the whole running turn」同规则）；
      // 熄灭权威在回合收口（endTurn，各路径在自己的 turn/end 处调用）。
      this.broadcastTurnStatus(true)
      return
    }
    if (frame.type === 'end') {
      // attempt 收口不熄状态行：turn 可能还有下一步（工具执行中）。
      const outcome = frame.outcome
      if (outcome?.kind === 'abandoned') { this.clear(); return }
      this.orphan = outcome?.eventType === 'assistant/attempt'
      return
    }
    if (frame.type !== 'chunk' || frame.chunk === undefined) return
    this.onChunk?.(frame.chunk)
    broadcastStreamChunk(this.baseFor(frame.step), frame.chunk)
  }

  /** 回合收口 → 熄灭本直播位的状态行（各路径在自己的 turn/end 处调用；幂等）。 */
  endTurn(): void {
    hubFeedEndTurn(this.base)  // 投影中心：FEMO内轮不收口（收口权归桥）；主Agent流清老桶
    this.broadcastTurnStatus(false)
  }

  /** 状态帧（前端按直播位点亮/熄灭「Deep diving…」）。【链路B 退役·2026-09-20
   *  大扫除】turn_status 帧整段删除（「正在…」由 hub 段 open 标记承担）；本方法
   *  只剩 trace——**收口接缝保留**：桥收口后若要恢复宿主侧信号即在此接。 */
  private broadcastTurnStatus(running: boolean): void {
  }

  /** 清本直播位（客户端删桶）。 */
  clear(): void {
    this.orphan = false
    clearLiveBucket(this.base)
  }

  /** 帧自带步号优先（0.1.3 帧恒带 turn/step）；缺省回落本直播位的步号。 */
  private baseFor(step: unknown): FemoStreamBase {
    const resolved = typeof step === 'number' ? step : this.base.step
    return resolved === undefined ? this.base : { ...this.base, step: resolved }
  }
}
