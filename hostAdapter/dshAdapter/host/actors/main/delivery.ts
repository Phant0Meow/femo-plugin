/**
 * actors/main/delivery.ts — 主Agent参与运行的交付排队（2026-09-26 刀⑥自 main-actor.ts
 * 迁出，纯搬家）。
 *
 * 「FEMO内外不掺一轮」的交付纪律都在这：主会话有轮在飞时注入排队等收口、
 * 轮收口后过三道时序门再 steer、被别人的轮吞掉就退队重投、FEMO脚本停下就作废
 * 交卷槽。队列状态机正身在公共层（main-delivery-queue.ts 壳转出）。
 * pending 表正身在 capture.ts——本件经其窄接口（rearm/take）读写。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../../config'
import { steerMainAgent } from '../../verbs'
import type { ProjectionRegistry } from '../../projection/projection'
import { broker } from '../../node-retry'
import { pushDiag } from '../../diag/diag-feed'
import { MainDeliveryQueue } from '../../main-delivery-queue'
import { debugLogMainActor, rearmPending, takePending, type PendingAnswer } from './capture'

/** 一次待交付的 main 节点注入（首轮节点通知 / 重试反馈信同构）。 */
export interface MainDelivery {
  waitKey: string
  nodeName: string
  actor: string
  /** 交卷 soul（信封收件人同款派生：actor_info.soul 优先、'main' 兜底——
   *  【2026-09-25 泛化】绑定会话角色交卷记自己的 soul，不再硬编码 main）。 */
  soul: string
  scopes: string[]
  jobId: number
  showprompt?: string
  /** 交付文案：首轮 = stageNotice，重试轮 = mainRetrySteerText。 */
  text: string
  /** 交付来源（日志/诊断：'首轮' | '重试'）。 */
  via: string
  /** 首轮交卷槽（重试轮无——其交卷由停靠循环重新 park 承担）。 */
  resolve?: () => void
}

/** 【2026-09-11】主会话轮开闭 + FEMO内注入排队（FEMO内外不掺一轮；状态机走
 *  main-delivery-queue.ts，纯函数可测）。 */
export const deliveries = new MainDeliveryQueue<MainDelivery>()

// ── 交付面（排队 / 交付 / 轮收口放行 / 作废）───────────────────────────────

/** 交付一条 main 节点注入：pending 登记（=rearm 语义：重置回合捕获，先于
 *  steer——pre-step 门卫放行豁免的时序要求）+ steer 主模型。 */
function deliverMain(ctx: Context, sid: string, d: MainDelivery): void {
  rearmPending(sid, {
    waitKey: d.waitKey,
    nodeName: d.nodeName,
    actor: d.actor,
    soul: d.soul,
    scopes: d.scopes,
    jobId: d.jobId,
    notice: d.text,
    ...(d.showprompt !== undefined ? { showprompt: d.showprompt } : {}),
  }, d.resolve)
  steerMainAgent(ctx, sid, d.text)
}

/** 排队或立即交付（2026-09-11 用户拍板：**戏内戏外不掺一轮**）：主会话有轮在飞
 *  （用户正在跟主模型说话、可能多步调工具）时不插进去——dsh 的 steer 会在下
 *  一个 step 边界被那一轮消费，用户回合里就混进FEMO内通知、回答还会被捕获成交卷。
 *  排到该轮 turn/end 之后，作为新一轮的开头交付（见 main-delivery-queue.ts）。
 *
 *  【2026-09-23 双证据】"轮在飞"有两个独立来源，**任一为真都排队**：
 *  ① 账本（本模块的 turn/start→turn/end 记账，见 mainSessionEventHook）；
 *  ② driver 实际状态（agent.status，dsh 的事实源）。
 *  加 ② 的原因=当日事故：resume 的 flow_start 把账本清了（旧实现连轮开闭一起
 *  forget），而第 12 轮其实还在跑 → 只看账本就会 steer 进正在跑的用户轮，
 *  用户那轮随后被当台词交卷。账本可能因任何原因失真，事实源不会。 */
export function queueOrDeliverMain(ctx: Context, resolved: ResolvedConfig, sid: string, d: MainDelivery): void {
  const busy = mainDriverBusy(ctx, sid)
  const queuedByLedger = !deliveries.offer(sid, d)   // true=账本说轮在飞（offer 已入队）
  if (!queuedByLedger && !busy) {
    debugLogMainActor(resolved, `交付注入(via=${d.via}): node=${d.nodeName}（账本无在飞轮 + driver 空闲 → 立即 steer）`)
    deliverMain(ctx, sid, d)
    return
  }
  if (!queuedByLedger) deliveries.enqueue(sid, d)    // 账本失真（如被清场清掉）→ driver 忙兜底排队
  const why = queuedByLedger ? '账本轮在飞' : 'driver 忙'
  const open = deliveries.openTurn(sid)
  const line = `注入排队(via=${d.via}, ${why}): node=${d.nodeName} 等主会话第 ${open ?? '?'} 轮收口（队列 ${deliveries.queuedCount(sid)} 条）`
  console.log(`[femo-plugin] ${line}`)
  debugLogMainActor(resolved, line)
  pushDiag('main-actor', `FEMO脚本节点「${d.nodeName}」等主模型把当前这轮说完（第 ${open ?? '?'} 轮收口后登场，via=${d.via}）`)
}

/** 主模型 agent 取用（状态判定用；与 steerMainAgent 同款查找面）。 */
function mainAgentOf(ctx: Context, sid: string): { status?: unknown } | undefined {
  const bag = ctx as unknown as {
    agents?: { get(id: string): { status?: unknown } | undefined }
    get?(name: string): { get(id: string): { status?: unknown } | undefined } | undefined
  }
  return bag.agents?.get(sid) ?? (typeof bag.get === 'function' ? bag.get('agents')?.get(sid) : undefined)
}

/** 主 agent driver 是否忙（2026-09-23）——「忙」的唯一定义，`tryDeliverNext` 与
 *  `queueOrDeliverMain` 共用。dsh 的 AgentStatus = 'idle' | 'running'（0.1.3~
 *  0.1.6 实测一致）；读不到 / 未知字符串一律当空闲（fail-open）——绝不因宿主
 *  版本差异把参与运行注入误停成"排队等到天荒地老"。 */
function mainDriverBusy(ctx: Context, sid: string): boolean {
  const status = mainAgentOf(ctx, sid)?.status
  return typeof status === 'string' && status !== 'idle'
}

/** 主会话轮收口（turn/end）后的交付尝试。三道时序门（全部实测得来）：
 *  ① **跳出本轮 append 发布**：dsh 里 steer 会写会话投影（inbox splice →
 *     session append），在 turn/end 的 append 发布中同步再入会抛
 *     `session append cannot reenter while another append is being published`；
 *  ② **等 driver 转 idle**：dsh 的 steer 对非 idle driver 只做 latch
 *     （`wakeDriver`：除 maintenance/wakeAfterAbort 外不记 wakeRequested）——
 *     已过认领点但还没转 idle 的窗口里投递会被**静默停放**（注入进了 inbox，
 *     新回合却起不来）。等 status=idle 再 steer；
 *  ③ **用户又开了一轮就继续等**：等的过程里用户又发了话（openTurn 又有值）
 *     → 不交付，留给那一轮的 turn/end（队首不动，顺序与作废语义都不受影响）。
 *  队列是唯一真源：全程先 peek 后 take——期间 abandonMainAnswer/节点收尾把
 *  它剔掉了就自然不再交付（不会对空气说话）。 */
export function flushNextMainDelivery(ctx: Context, resolved: ResolvedConfig, sid: string): void {
  if (deliveries.queuedCount(sid) === 0) return
  tryDeliverNext(ctx, resolved, sid, 0)
}

function tryDeliverNext(ctx: Context, resolved: ResolvedConfig, sid: string, tries: number): void {
  queueMicrotask(() => {
    const next = deliveries.peek(sid)
    if (next === undefined) return
    if (mainDriverBusy(ctx, sid)) {
      if (tries < 40) {
        setTimeout(() => tryDeliverNext(ctx, resolved, sid, tries + 1), 50)
      } else {
        // 极端长忙（driver 一直不空闲）：不硬塞（会被静默停放），留给下一次轮收口。
        debugLogMainActor(resolved, `交付等待 driver 空闲超时（${tries}×50ms）: node=${next.nodeName}`)
      }
      return
    }
    if (deliveries.openTurn(sid) !== undefined) return // 用户又开了一轮 → 等它的 turn/end
    // 交付前活性复核（2026-09-11）：runMainModelTurn 是异步起跑的（microtask 才
    // 走到登记/排队），引擎可能在同一 tick 里就 flow_paused/flow_error 了——
    // 那次 abandon 早于本条入队，谁也作废不到它。停靠登记（broker）是节点还在
    // 等答案的唯一权威凭据：登记没了 = FEMO脚本已停/节点已收尾，本条直接作废，
    // 绝不对着已死的引擎交卷（否则会以空 output 落到旧 wait_key 上）。
    if (!broker.has(next.waitKey)) {
      const dropped = deliveries.dropWhere(sid, d => d === next)
      for (const d of dropped) d.resolve?.()
      const line = `排队注入作废（节点已收尾/停止运行）: node=${next.nodeName} wait_key=${next.waitKey}`
      console.log(`[femo-plugin] ${line}`)
      debugLogMainActor(resolved, line)
      return
    }
    const taken = deliveries.takeNext(sid)
    if (taken === undefined) return
    debugLogMainActor(resolved, `轮收口 → 交付排队注入(via=${taken.via}): node=${taken.nodeName}`)
    pushDiag('main-actor', `轮收口 → FEMO脚本节点「${taken.nodeName}」登场（via=${taken.via}）`)
    deliverMain(ctx, sid, taken)
  })
}

/** 【2026-09-23 捕获锚定】注入被别人的轮吃掉（通知进了正在跑的轮 / 那轮混进真人
 *  消息）——**不交卷**：作废本 pending，把同一条注入退回队列，等下一个干净轮再
 *  参与；交卷槽原样带走（runMainModelTurnInner 的 `await answer` 继续等）。
 *  旧行为（当日事故）：pending 留着，下一次任意 turn/start——哪怕几分钟后用户
 *  自己发起的FEMO外轮——都被认领成交卷轮，用户的排障回答被当成FEMO内台词寄给引擎。 */
export function requeueSwallowedInjection(
  ctx: Context,
  resolved: ResolvedConfig,
  sid: string,
  p: PendingAnswer,
  why: string,
): void {
  takePending(sid)
  deliveries.enqueue(sid, {
    waitKey: p.waitKey,
    nodeName: p.nodeName,
    actor: p.actor,
    soul: p.soul,
    scopes: p.scopes,
    jobId: p.jobId,
    ...(p.showprompt !== undefined ? { showprompt: p.showprompt } : {}),
    text: p.notice,
    via: '重投',
    resolve: p.resolve,
  })
  const line = `注入被吞(${why})：node=${p.nodeName} → 退回队列，等下一个干净轮重投`
  console.log(`[femo-plugin] main injection swallowed (${why}): node=${p.nodeName}`)
  debugLogMainActor(resolved, line)
  // 立刻尝试交付（driver 已空闲则本轮收口后立即作为新一轮开场；忙则继续等）。
  flushNextMainDelivery(ctx, resolved, sid)
}

/** 作废本会话排队件（FEMO脚本暂停/出错/换场/卸载）：resolve 交卷槽防
 *  runMainModelTurnInner 悬挂在 `await answer`（其后的 broker.park 因 parker
 *  已被 abortJob 清除而立即 aborted 收场，整条收尾链不卡）。
 *  【2026-09-23】轮开闭账不在本函数职责内——它记的是宿主会话的轮事实，
 *  换场/暂停都不该动它（旧 forgetTurn 参数已随事故修正删除）。 */
export function dropMainDeliveries(sid: string, reason: string, resolved?: ResolvedConfig): number {
  const dropped = deliveries.dropAll(sid)
  for (const d of dropped) d.resolve?.()
  if (dropped.length > 0) {
    const line = `排队注入作废(${reason}): ${dropped.length} 条 [${dropped.map(d => d.nodeName).join(', ')}]`
    console.log(`[femo-plugin] ${line}`)
    if (resolved !== undefined) debugLogMainActor(resolved, line)
  }
  return dropped.length
}

/** HMR/插件卸载：清全部排队件与轮开闭状态（幂等）。 */
export function disposeMainDeliveries(): void {
  deliveries.clear()
}

/** flow_paused/flow_error：作废在飞注入（引擎已死，交卷无处可去；主模型
 * 那轮回答就当普通FEMO外回答留在主窗口）。被作废者不回传引擎、不写错误表。
 * 【V6.3】投影兜底：turn/start 已落（骨架+名字已在 stage/角色窗）而 turn/end
 * 不会再来——flush 半截内容+合成 turn/end 收整成块（与 subagent finally 同款；
 * 结构键幂等，turn/end 不带 _srcSeq）。骨架都没落（主模型尚未开始回答）→
 * 零投影零合成。 */
export function abandonMainAnswer(
  sid: string,
  reason: string,
  _projections?: ProjectionRegistry,
): boolean {
  // 【2026-09-11】排队中的参与运行注入一并作废（可能在飞注入都没有：节点还排在队里）。
  dropMainDeliveries(sid, reason)
  const p = takePending(sid)
  if (p === undefined) return false
  // 【2026-09-20 大扫除】投影兜底（半截缓冲 flush+合成 turn/end）随旧链路
  // 退役——投影窗内容由 hub 供给；这里只剩 pending 清账与收尾。
  p.settled = true
  p.resolve()
  console.log(`[femo-plugin] main-actor answer abandoned: node=${p.nodeName} (${reason})`)
  return true
}
