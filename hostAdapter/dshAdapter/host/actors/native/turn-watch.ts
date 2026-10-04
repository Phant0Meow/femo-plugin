/**
 * actors/native/turn-watch.ts — 常驻角色的回合收口追踪（2026-09-26 刀⑥自
 * subagent-native.ts 迁出）。
 *
 * 复用子代理没有 run.result，回合边界=turn/end。本件管四件事：
 *  - 回合收口追踪：settledTurns/baselineCount/pendingTurn——「send 之后到达的
 *    第一个本子代理 turn/end」就是本节点回合，FIFO 取第 baseline 个之后的收口。
 *  - 打捞时间锚（j1716）：兜底只认锚点之后新落的收口。**锚的赋值时序留在主
 *    流程**（prevLock 等待之后、监听注册到轮询启动之间的同步段）——锚早了会把
 *    上一节点的迟到收口放进锚后，复读首答病根（j1698/j1716）重开。
 *  - 完成探测兜底轮询（j1695）：ctx 'session/event' 对个别原生常驻子代理回合
 *    失明，有等待者时每 2s 直读活子代理会话事件补收口。
 *  - 看门狗 armIdle：空闲超时掐回合（0.1.3 生成长回合期间没有任何会话事件，
 *    只有帧——不接这条会让满负荷生成的节点被空闲超时误杀）。
 *
 * 【刀⑥ 改写说明（纯搬家唯一允许的非机械处）】原主函数 ~600 行单函数里的内联
 * 闭包（settledTurns/baselineCount/childTurnEvents/allChildEvents/pendingTurn/
 * pollAdded/rescueAnchorMs/idleTimer）逐字段收进 TurnWatchState 显式状态对象，
 * 函数正身逐字随迁、只加 tw. 前缀；逻辑顺序零变化。
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { ResolvedConfig } from '../../config'
import { readSessionEvents, type FemoSessionEventLike } from '../../compat/session-events'

/** 常驻子代理的 live Agent 消费面（0.1.3 Agent；ctx.agents.get(childId) 解析）。
 *  【刀⑥】随打捞轮询落本件（轮询的观测对象）；主流程的 NativeContent/
 *  NativeSubagents 面仍住 index。 */
interface NativeChildAgent {
  id: SessionId
  session?: { append(type: string, data: unknown, surface?: unknown): void }
  ctx?: Context
  /** 空闲时开新回合、运行中在最近 step 边界消费（0.1.3 Agent.steer）。 */
  steer?(message: unknown): void
  whenIdle?(): Promise<void>
}
export type { NativeChildAgent }

/** 回合收口追踪的显式状态对象：原单函数内联闭包逐字段收编（刀⑥）。 */
export interface TurnWatchState {
  /** 已收口的回合号（按收口顺序）；baselineCount 是本节点的观测起点。 */
  settledTurns: number[]
  /** 投递前已收口的 turn 数（waitTurnAfterBaseline 取第 baseline 个之后的收口）。 */
  baselineCount: number
  /** 回合事件按原始子代理 turn 号归档。 */
  childTurnEvents: Map<number, SessionEvent[]>
  /** 本节点观察到的全部子代理事件（错误判定/兜底取数的原料）。 */
  allChildEvents: SessionEvent[]
  /** 等待回合收口的等待者队列。 */
  pendingTurn: { slot: Array<{ resolve: (turn: number) => void; reject: (e: unknown) => void }> }
  /** 打捞时间锚（毫秒）。初值 0 不可观测：主流程在创建后、监听注册前的同步段
   *  就地赋值 Date.now()（j1716 时序约束，见文件头），此间无任何读者。 */
  rescueAnchorMs: number
  /** 打捞轮询的补采集去重账。 */
  pollAdded: Set<unknown>
  /** 看门狗定时器句柄（armIdleWatchdog 写）。 */
  idleTimer: ReturnType<typeof setTimeout> | undefined
}

export function createTurnWatchState(): TurnWatchState {
  return {
    settledTurns: [],
    baselineCount: 0,
    childTurnEvents: new Map(),
    allChildEvents: [],
    pendingTurn: { slot: [] },
    rescueAnchorMs: 0,
    pollAdded: new Set(),
    idleTimer: undefined,
  }
}

export function resolvePendingTurn(tw: TurnWatchState, turn: number): void {
  const waiter = tw.pendingTurn.slot.shift()
  if (waiter === undefined) return
  waiter.resolve(turn)
}

export function rejectPendingTurn(tw: TurnWatchState, error: unknown): void {
  for (const waiter of tw.pendingTurn.slot.splice(0)) waiter.reject(error)
}

export function waitTurnAfterBaseline(tw: TurnWatchState): Promise<number> {
  if (tw.settledTurns.length > tw.baselineCount) {
    return Promise.resolve(tw.settledTurns[tw.baselineCount])
  }
  return new Promise<number>((resolve, reject) => {
    tw.pendingTurn.slot.push({ resolve, reject })
  })
}

/** 事件是否落在打捞时间锚之后（j1716：锚点前的一律是旧回合）。 */
export function eventAfterAnchor(tw: TurnWatchState, e: FemoSessionEventLike): boolean {
  const t = Number((e as { time?: unknown }).time)
  return Number.isFinite(t) && t > tw.rescueAnchorMs
}

/** 看门狗再武装：空闲超时掐回合（abort 语义，interrupt 走官方 interrupt）。 */
export function armIdleWatchdog(
  tw: TurnWatchState,
  interruptRef: { fn?: () => void },
  controller: AbortController,
  resolved: ResolvedConfig,
): void {
  if (tw.idleTimer !== undefined) clearTimeout(tw.idleTimer)
  tw.idleTimer = setTimeout(() => {
    interruptRef.fn?.()
    controller.abort(new Error(`子 agent 空闲超时（${Math.round(resolved.subagentIdleTimeoutMs / 1000)}s 无输出）`))
  }, resolved.subagentIdleTimeoutMs)
}

/** 完成探测兜底轮询（2026-09-17 j1695 险情）：ctx 'session/event' 对个别原生
 *  常驻子代理回合失明（j1695 实锤：@Eve 投票回合——会话事件已落盘、
 *  assistant-stream 帧正常、同批其余孩子正常，唯独本钩子不响，直到 15min
 *  停靠超时才捞回，全场冻结）。完成探测不能单腿：有等待者时每 2s 直读活子
 *  代理会话事件，发现事件路径漏掉的 turn/end 即整回合补采集（seq/身份去重，
 *  transcript 不缺料）并收口唤醒。事件路径正常时每拍只做一次空比对，零副作用。 */
export function startRescuePoll(
  ctx: Context,
  tw: TurnWatchState,
  childIdRef: { id: string },
  armIdle: () => void,
  nodeName: string,
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (childIdRef.id === '') return
    if (tw.pendingTurn.slot.length === 0) return
    let live: NativeChildAgent | undefined
    let events: readonly FemoSessionEventLike[]
    try {
      live = ctx.agents.get(SessionId(childIdRef.id)) as NativeChildAgent | undefined
      if (live?.session === undefined) return
      events = readSessionEvents(live.session as unknown as Session)
    } catch {
      return
    }
    for (const e of events) {
      if (e.type !== 'turn/end') continue
      const turn = (e.data as { turn?: unknown } | undefined)?.turn
      if (typeof turn !== 'number' || !eventAfterAnchor(tw, e) || tw.settledTurns.includes(turn)) continue
      for (const x of events) {
        if (tw.pollAdded.has(x)) continue
        if (tw.allChildEvents.includes(x)) { tw.pollAdded.add(x); continue }
        const xt = (x.data as { turn?: unknown } | undefined)?.turn
        if (xt !== turn) continue
        tw.pollAdded.add(x)
        tw.allChildEvents.push(x)
        let bucket = tw.childTurnEvents.get(turn)
        if (bucket === undefined) tw.childTurnEvents.set(turn, bucket = [])
        bucket.push(x)
      }
      tw.settledTurns.push(turn)
      armIdle()
      resolvePendingTurn(tw, turn)
      console.log(`[femo-plugin][native] turn-end rescued by poll (session/event blind): child=${childIdRef.id} turn=${turn} node=${nodeName} anchorAge=${Date.now() - tw.rescueAnchorMs}ms`)
    }
  }, 2_000)
}
