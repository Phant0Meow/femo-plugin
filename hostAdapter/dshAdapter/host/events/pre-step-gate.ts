/**
 * pre-step-gate.ts — agent/pre-step 门卫的裁决面（2026-09-11 自 engine-events
 * 抽出为纯函数：tests/pre-step-gate.test.mjs 用真 AgentLoop 直接驱动它回归）。
 *
 * 为什么必须按「轮」裁决，而不是按「步」：
 * dsh 的 agent/pre-step **每个 ReAct 步都跑一次**（agent.ts 的 turn 循环
 * `while (true) { await this.preStep(target, {turn, step}) ... }`），每步各自
 * `inbox.claim()`：
 *   - 轮首步（step=1）claim = 全部 next-step + 1 条 next-turn（那条用户消息）；
 *   - 之后各步（工具续跑所在步）claim = 只有 next-step，实测为空批次
 *     （dsh-agent-loop 自家 tests/interception.spec.ts 断言
 *     `[{turn:1,step:1,messages:1},{turn:1,step:2,messages:0}]`；工具结果本身
 *     是 `tool/result` 事件、`source.kind==='tool'`，只有工具给的
 *     additionalContexts 才进 next-step）。
 * 而 reject 的语义是「本批已 claim 的消息整批丢弃 + **整个 turn 以
 * reason=blocked 收场**」（`if (decision.kind === 'reject') { turnEnds =
 * {kind:'blocked'}; return false }`）。
 *
 * 【2026-09-16 晚用户拍板：running-reject 退役】时机裁决权全部上收 mailbox 的
 * delivery 字段（urgent=FEMO中也当场插话；held=攒到终局急件一起放行）——宿主
 * 不再持有「运行中吞插件注入」的判断（旧兜底「其余（运行中的 plugin 来源注
 * 入）→ reject（引擎拥有会话）」整条删除）。主模型FEMO中被叫醒后干什么（含调
 * 工具）由主模型自己决定——FEMO脚本可能就是让主模型干活的工作流。工具本来就不
 * 拦（①的轮内自由），现在「叫醒」也不拦了。
 *
 * 门卫剩余职责（唯一）：**角色噪音过滤**——这不是时机裁决，是卫生：dsh 子代
 * 理运行时每节点一条的 settled 通告与子代理回母消息是后台机器噪音，不该进
 * 主模型上下文；整批纯噪音且在轮首步时不开轮（reject=不唤醒也不落盘）。
 * 其余一切消息（用户/插件/mailbox 喊话）任何时刻一律放行。
 */

/** 门卫认的消息面：只用到 source（噪音判定；不依赖 dsh-session 类型，
 *  以便测试里塞纯字面量）。 */
export interface GateMessage {
  source?: { kind?: string; senderSessionId?: unknown }
}

/** 本步裁决结果（enter 的 messages 保持调用方泛型，原样回传）。 */
export type GateDecision<M extends GateMessage> =
  | { kind: 'enter'; messages: M[] }
  | { kind: 'reject' }

export interface GateFacts<M extends GateMessage> {
  /** 本步 claim 的原始批次（含角色噪音）。 */
  messages: readonly M[]
  /** 拟进入的步号（payload.step；1 = 轮首步）。 */
  step: number
  /** 本会话是否有在飞的 main 节点注入（isMainAnswerPending）。
   *  【2026-09-16 running-reject 退役后不再参与裁决，保留入参兼容旧接线】 */
  mainAnswerPending: boolean
  /** 本会话绑定的 Job 是否引擎活跃 Job（isSessionRunning）。
   *  【2026-09-16 running-reject 退役后不再参与裁决，保留入参兼容旧接线】 */
  running: boolean
  /** 日志用会话标识（宿主为 agent.session.id；日志行格式与抽出前逐字一致，
   *  既有日志 grep 口径不变）。 */
  tag: string
}

/** 角色子代理流出的「噪音消息」（不该进主模型上下文）：
 *  - subagent-settled：dsh 子代理运行时对常驻子代理自然收口的通告
 *    （每个节点跑完都会发一条，还会唤醒主模型）；
 *  - agent-message：子代理经 send_message 直接回母的消息。
 *  两者仅当 senderSessionId 属于本插件的常驻执行体（femo-actor- 前缀）时成立；
 *  用户自己拉的子代理与真实用户输入一律不受影响。 */
export function isActorChildNoise(message: GateMessage): boolean {
  const source = message.source
  if (source === undefined) return false
  if (source.kind !== 'subagent-settled' && source.kind !== 'agent-message') return false
  return typeof source.senderSessionId === 'string' && source.senderSessionId.startsWith('femo-actor-')
}

/** 轮首步噪音裁决 + 其余一律放行（口径见文件头）。 */
export function gatePreStep<M extends GateMessage>(facts: GateFacts<M>): GateDecision<M> {
  const { messages, tag } = facts
  const who = typeof tag === 'string' && tag.length > 0 ? tag : '(unknown session)'
  // step 非正数/缺失（老宿主 payload 无该字段）保守当轮首步：噪音过滤在任何
  // 步都该做，误判步号只影响「整批噪音 reject」的适用面，不产生额外放行。
  const step = Number.isFinite(facts.step) && facts.step > 0 ? facts.step : 1
  const admitted = messages.filter((message) => !isActorChildNoise(message))
  if (admitted.length !== messages.length) {
    console.log(`[femo-plugin] pre-step dropped ${messages.length - admitted.length} actor-child notice(s) for ${who}`)
    // 整批噪音且是轮首步：不唤醒主模型（旧行为逐字保留）。后继步绝不可走
    // 这里——噪音恰好落在完轮后的补步上时，reject 会把 completed 改判 blocked。
    if (admitted.length === 0 && step === 1) return { kind: 'reject' }
  }
  // 其余一切（用户输入 / 插件注入 / mailbox 喊话，FEMO内外）一律放行——
  // 时机归 mailbox 的 delivery 字段（2026-09-16 用户拍板，running-reject 退役）。
  return { kind: 'enter', messages: admitted }
}
