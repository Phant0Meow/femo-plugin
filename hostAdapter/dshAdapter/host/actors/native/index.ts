/**
 * actors/native/index.ts — 常驻 AI 角色执行体主流程（0.1.3 原生 stock 构建）。
 *
 * 【刀⑥ 分家】原 subagent-native.ts 单文件四拆，本文件收主流程
 * runAiSubagentNative + 官方面鸭子类型（NativeContent/NativeSubagents）：
 *  - ./registry.ts   复用注册表 + 同角色串行锁 + childId 规则化；
 *  - ./child-setup.ts 首建设置 + 回合错误描摹 + 档位日志员；
 *  - ./turn-watch.ts  回合收口追踪 + 打捞轮询 + 时间锚 + 看门狗。
 * 消费方：actors/dispatch.ts（唯一派工体的下游）。
 *
 * 与 subagent.ts（one-shot 每节点新子代理，meow fork 旧版路径）并存的历史：
 * one-shot 已随刀①删除，常驻版是唯一执行体。
 *
 * 核心语义：**同一 Job 内同一 actor 复用同一个子代理作为执行体**；角色内容
 * 的显示面 = 旧版同款 femo-proj 角色投影窗（角色气泡/turn 段落头那套自绘
 * 渲染），子代理窗本身只是引擎，不对用户展示（目录里重新 ban，对齐旧版
 * 效果：节点拉起的子代理不出现在子代理列表）。
 *  - 复用：以 (主会话, Job, actorKey) 为键，经 0.1.3 官方 subagents.startContinuable
 *    建立 durable continuable child（childId 规则化 =
 *    femo-actor-j<jobId>-<主sid>-<actorKey>，跨重启可推导）；后续节点经
 *    subagents.sendMessage 投递（空闲目标自动开新回合；进程重启后持久化子代理
 *    自动冷恢复）。轮到角色说话时把最新上下文+prompt 发给他（每轮 sendMessage
 *    全量投递），收集其流式输出经既有镜像链路投影进 god/stage/角色投影窗。
 *  - 生命周期：节点间不 dispose（复用的前提）；run-control 掐断经官方
 *    subagents.interrupt（ActiveSubagent.interrupt 通路）；同一 Job×actor 的
 *    并发节点（par 同角色）经 per-actor 锁串行，防 steer 把两个节点的台词搅进
 *    同一回合。
 *  - 归档豁免：子代理会话留在 dsh 会话树里（不 archive、不 moveChildSessionOut
 *    ——subagent.ts finally 的归档只在旧版路径执行）；常驻执行体的冷恢复依赖
 *    持久化，且目录/列表不可见由前端显示层过滤承担。
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import { randomUUID } from 'node:crypto'
import type { FemoBridge } from '../../bridge'
import { sendActorFailure } from '../../bridge'
import type { ResolvedConfig } from '../../config'
import { buildTranscript, type TranscriptStep } from '../../engine-transcript'
import { broadcastSse } from '../../http'
import { LiveStreamFrames, onAssistantStreamFrames, broadcastActorStreamChunk } from '../../hub/stream-frames'
import { actorNameOf } from '../../actor-name'   // 执行者名的唯一取值口（漏了这个 import 就是运行期 ReferenceError）
import { createActorUsageSampler } from '../../../../../femo2host/host/subagent-core.mjs'
import { executorSpeechArgs } from '../../../../../femo2host/host/speech-core.mjs'
import { mergeActorUsageFile, type ActorUsageRecord } from '../../actor-usage'
import { projectionActorKey, type ProjectionRegistry } from '../../projection/projection'
import { readJobCast, putJobCastEntry } from '../../../../../femo2host/host/cast-core.mjs'
import { hostAddr } from '../../hub/hub-feed'   // 宿主自称（cast 账的宿主分格键）
import { readSessionEvents } from '../../compat/session-events'
// 回合收口追踪迁 actors/native/turn-watch.ts（2026-09-26 刀⑥）：内联闭包收进
// 显式状态对象 tw，函数正身在该文件（纯搬家唯一允许的非机械处，逐字段对应）。
import {
  armIdleWatchdog, createTurnWatchState, eventAfterAnchor, rejectPendingTurn,
  resolvePendingTurn, startRescuePoll, waitTurnAfterBaseline,
  type NativeChildAgent,
} from './turn-watch'
import { apiRetry } from '../../api-retry'
import { broker, RETRY_STEER_TEXT } from '../../node-retry'
import { safeSteer } from '../../safe-steer'
import { FEMO_PLUGIN_SOURCE } from '../../compat/plugin-source'
import {
  TURN_BASE_EPOCH, turnBaseBySession, actorUsageBySession,
  FORWARD_CHILD_EVENTS,
  activeSubagents, activeChildRuns, runControlAborted, type ActiveSubagent,
  readSoulPersona, buildSubagentPrompt, KNOWN_BLOCK_KEYS,
  toolFilterOf, resolveMainModel, resolveSourceModel,
  appendActorPolicyPins, FEMO_CHILD_SCOPE_TEXT,
} from '../../../../../femo2host/host/subagent-core.mjs'
import { appendDebugLog } from '../../diag/debug-log'
// 身份件迁 actors/native/registry.ts（2026-09-26 刀⑥，纯搬家）：复用注册表/
// 同角色串行锁/childId 规则化正身在该文件。
import { actorChildren, actorRegistryKey, actorTurnLocks, nativeChildId, type NativeActorEntry } from './registry'
// 首建设置/错误描摹/档位日志员迁 actors/native/child-setup.ts（2026-09-26 刀⑥，纯搬家）。
import { childTurnError, debugEffortLog, setupChildAgent } from './child-setup'

// ── 0.1.3 subagents 官方面（鸭子类型：只声明我们消费的子集）─────────────────
// NativeChildAgent 已随打捞轮询迁 turn-watch.ts（刀⑥，上方 import 引用）。

interface NativeContent { type: 'text'; text: string }

/** ctx.subagents 的 continuable 消费面（0.1.3 SubagentRuntime 子集）。 */
interface NativeSubagents {
  startContinuable(spec: {
    provider: string
    label: string
    /** 调用方预留的持久身份：规则化 id 让重启后仍能找到同一角色的子代理。 */
    childId?: SessionId
    request: {
      prompt: NativeContent[]
      parent: NativeChildAgent
      persona?: string
      agentOptions?: { provider?: string; model?: string }
      toolFilter?: { allow: string[] }
    }
    signal: AbortSignal
  }): Promise<{ childId: SessionId }>
  /** 空闲目标开新回合；运行中目标在最近 step 边界 steer；持久化缺失的
   *  direct child 自动冷恢复。sender 必须是 exact live parent Agent。 */
  sendMessage(sender: NativeChildAgent, targetId: SessionId, content: NativeContent[], options: { signal: AbortSignal }): Promise<unknown>
  /** 掐断常驻子代理当前回合（idle/absent 目标为合法 no-op）。 */
  interrupt(targetSessionId: SessionId, authority: { kind: 'user'; parentSessionId: SessionId } | { kind: 'ancestor'; agent: NativeChildAgent }): void
}

// ── 主流程 ────────────────────────────────────────────────────────────────

/** One engine AI turn executed through the actor's REUSED continuable child
 * (0.1.3 native only). 签名与 subagent.runAiSubagent 完全同形（调用点同款
 * catch 兜底）。 */
export async function runAiSubagentNative(
  ctx: Context,
  resolved: ResolvedConfig,
  bridge: FemoBridge,
  session: Session,
  request: Record<string, unknown>,
  recordError: (sessionId: SessionId, text: string) => void,
  defaultModel?: { currentSelection(): unknown },
  nodeActors: ReadonlyMap<string, string> = new Map(),
  projections?: ProjectionRegistry,
  nodeShowprompts: ReadonlyMap<string, string> = new Map(),
  jobId: number = -1,
): Promise<void> {
  if (projections === undefined) throw new Error('projections registry unavailable')
  const waitKey = String(request.wait_key ?? '')
  if (waitKey.length === 0) return
  const subagents = ctx.get('subagents') as NativeSubagents | undefined
  if (subagents === undefined) {
    throw new Error('subagents service unavailable (continuable subagents require the 0.1.3 subagent runtime)')
  }
  const parent = ctx.agents.get(session.id) as NativeChildAgent | undefined
  if (parent === undefined) {
    throw new Error(`parent agent for ${session.id} is not live`)
  }

  // 料包拼装与身份（与旧路径同源：buildSubagentPrompt/readSoulPersona 共用）。
  const blocks = (request.blocks ?? {}) as Record<string, unknown>
  const unknownBlockKeys = Object.keys(blocks).filter(k => !KNOWN_BLOCK_KEYS.has(k))
  if (unknownBlockKeys.length > 0) {
    console.log(`[femo-plugin][native] ai_request(node=${String(request.node_name ?? '')}) blocks 含契约外语料键（宿主拼装器不识别已忽略）: ${unknownBlockKeys.join(', ')}`)
  }
  const prompt = buildSubagentPrompt(blocks)
  const actorInfo = (request.actor_info ?? {}) as { soul?: unknown }
  const soulId = typeof actorInfo.soul === 'string' ? actorInfo.soul : ''
  const soulPersona = soulId.length > 0 ? await readSoulPersona(bridge, soulId) : ''
  if (soulPersona.includes('{{')) {
    console.log(`[femo-plugin][native] WARNING soul persona (soul_id=${soulId}) contains "{{" — dsh prompt assembly treats it as a template variable and will fail loud`)
  }
  const blk = (key: string): string => typeof blocks[key] === 'string' ? String(blocks[key]) : ''
  const nodeName = String(request.node_name ?? '')
  console.log(`[femo-plugin][native] ai_request node=${nodeName} scope=${String(request.scope ?? '')} soul_id=${soulId}`
    + ` blocks: context=${blk('context').length}ch soul=${blk('soul').length}ch memory=${blk('memory').length}ch prompt=${blk('prompt').length}ch`)

  // 角色身份（par 安全：本次请求自带的执行者名优先，与旧路径同款三级兜底）。
  // 取值走 actor-name 唯一口（事件字段 2026-09-19 由 ai_name 正名为 actor_name）。
  const requestActorName = actorNameOf(request) || undefined
  const actor = requestActorName ?? nodeActors.get(nodeName) ?? nodeName
  const actorKey = projectionActorKey(actor)
  // 绑定账键（cast 两段式）：与桥产信收件人同款派生（soul_id 优先、裸执行者
  // 兜底 actor 名）——账里的键和信上的收件人永远是同一个词。
  const castSoul = soulId.length > 0 ? soulId : actor
  const sid = String(session.id)
  const actorThinking = typeof request.actor_thinking === 'string' && request.actor_thinking.trim().length > 0
    ? request.actor_thinking.trim()
    : undefined

  // ── 在飞登记 + 看门狗（abort 同款语义；interrupt 走官方 interrupt）──────
  const controller = new AbortController()
  const interruptRef: { fn?: () => void } = {}
  const activeEntry: ActiveSubagent = {
    controller,
    node: nodeName,
    jobId,
    interrupt: () => { interruptRef.fn?.() },
  }
  activeSubagents.add(activeEntry)
  // 看门狗（armIdle）与回合追踪同住下方 tw 状态对象（刀⑥）：armIdle 是一行
  // 绑定箭头，依赖 interruptRef/controller/resolved 三个本流程局部量，正身在
  // turn-watch.ts。

  // ── 同 Job×同角色 串行锁（含停靠重试环全程）──────────────────────────
  const lockKey = actorRegistryKey(sid, jobId, actorKey)
  const prevLock = actorTurnLocks.get(lockKey) ?? Promise.resolve()
  let releaseLock!: () => void
  const lockGate = new Promise<void>(resolve => { releaseLock = resolve })
  const lockTicket = prevLock.then(() => lockGate)
  actorTurnLocks.set(lockKey, lockTicket)
  lockTicket.catch(() => undefined)
  try {
    await prevLock
  } catch {
    // 前一节点失败不阻塞本节点（各自独立上报引擎）。
  }

  // turn 号纪元重映射（每节点预留 100 个 turn）。
  const baseTurn = (turnBaseBySession.get(sid) ?? TURN_BASE_EPOCH) + 1
  turnBaseBySession.set(sid, baseTurn + 100)
  // 【2026-09-20 旧直播链退役】段落闸门（sectionGate waitActorFlush/begin/commit）
  // 整体拔除——它的唯一职责是排序 end 清桶帧，帧已停发；角色串行由 per-actor
  // 锁保证（与投影无关）。

  // scope_info 先于建窗解析（建窗兜底要按本节点 scope 补建角色窗）。
  const scopeInfo = Array.isArray(request.scope_info)
    ? request.scope_info.filter((x): x is string => typeof x === 'string')
    : undefined

  // 投影窗壳兜底建（活：hub-window 锚行/composer/hub-view 代理都挂在窗会话上；
  // registry 缺窗时按本节点 scope 补建——flow_start 已全量建过，此处是重启
  // 恢复/动态角色的兜底）。
  let windowsOrUndefined = projections.get(sid)
  if (windowsOrUndefined === undefined) {
    const headerCwd = (session.header as { cwd?: string } | undefined)?.cwd
    if (headerCwd === undefined || headerCwd.length === 0) {
      activeSubagents.delete(activeEntry)
      releaseLock()
      throw new Error(`session ${sid} cwd missing — projection windows cannot be ensured (process.cwd() fallback forbidden)`)
    }
    windowsOrUndefined = await projections.ensure(sid, scopeInfo ?? [], headerCwd)
  }
  void windowsOrUndefined

  // 【2026-09-20 旧直播链退役】turn→scope 内存簿随 CSS 视角过滤拆除——
  // /turn-scopes 端点退役，无消费方。

  const toolNamesByCallId = new Map<string, string>()

  // ── 角色占用采样（协议机在公共层 createActorUsageSampler；applyUsage 留给
  // 0.1.3 原生流帧的 onChunk 旁挂）────────────────────────────────────────
  const usage = createActorUsageSampler({
    onPublish: record => {
      let byActor = actorUsageBySession.get(sid)
      if (byActor === undefined) {
        byActor = new Map()
        actorUsageBySession.set(sid, byActor)
      }
      byActor.set(actorKey, record)
      broadcastSse('femo_actor_usage', { sid, actorKey, ...record })
    },
    onPersist: record => {
      void mergeActorUsageFile(sid, actorKey, record).catch((error: unknown) => {
        console.log(`[femo-plugin][native] write actor-usage failed: ${String(error)}`)
      })
    },
  })
  // ── 回合收口追踪（复用子代理没有 run.result，回合边界=turn/end）────────
  // per-actor 锁保证我们 send 时子代理空闲，故「send 之后到达的第一个本子代理
  // turn/end」就是本节点回合。baseline=投递前已收口的 turn 数（防用户经官方
  // composer 插话产生的历史收口被误认），FIFO 取第 baseline 个之后的收口。
  // 【刀⑥ 状态显式化】上段闭包（settledTurns/baselineCount/childTurnEvents/
  // allChildEvents/pendingTurn，外加下方 pollAdded/rescueAnchorMs 与看门狗
  // idleTimer）逐字段收进显式状态对象 tw，函数正身迁 turn-watch.ts。
  // 位置纪律：tw 创建先于事件监听注册（监听闭包读 tw）；时间锚赋值留在下方
  // 原位（prevLock 等待之后——锚早了会把上一节点的迟到收口放进锚后，
  // j1698/j1716 复读首答病根重开）；创建到赋值之间全同步，无事件可入。
  const tw = createTurnWatchState()
  const armIdle = (): void => armIdleWatchdog(tw, interruptRef, controller, resolved)

  // 【2026-09-20 大扫除】骨架合成（ensureTurnStart/ensureStepStart）随旧链路
  // 退役——镜像落盘没了，合成件失去唯一去处；turnScopes 簿已上移到节点开跑处。

  // ── 子代理事件监听：回合追踪 + 直播帧 + 看门狗再武装（先于建/发注册）──────
  // childId 在 ensure 阶段才确定；监听器经 ref 读取。
  const childIdRef: { id: string } = { id: '' }
  const onChildEvent = (watched: Session, watchedEvent: SessionEvent): void => {
    if (String(watched.id) !== childIdRef.id || childIdRef.id === '') return
    armIdle()
    usage.capture(watchedEvent)
    tw.allChildEvents.push(watchedEvent)
    // 回合事件按原始子代理 turn 号归档；turn/end 推进收口队列。
    // 【v7.1】状态行不在此熄灭：节点内 steer 重试会让子代理再开回合，
    // 「Deep diving」要贯穿整轮（含轮内 steer），熄灭权威在节点审结处。
    // 回合事件按原始子代理 turn 号归档；turn/end 推进收口队列。
    const rawTurn0 = (watchedEvent.data ?? {}) as { turn?: unknown }
    if (typeof rawTurn0.turn === 'number') {
      let bucket = tw.childTurnEvents.get(rawTurn0.turn)
      if (bucket === undefined) {
        bucket = []
        tw.childTurnEvents.set(rawTurn0.turn, bucket)
      }
      bucket.push(watchedEvent)
      if (watchedEvent.type === 'turn/end') {
        // 幂等护栏（2026-09-17 j1698）：轮询兜底可能先于本钩子把同回合收口
        // （事件迟到），重复入队会挤歪重试基线（baselineCount 按位数取回合）。
        // 时间锚同闸（j1716）：锚点前的 turn/end 是旧回合迟到重放，收下会
        // 让 waitTurnAfterBaseline 快路返回旧回合号（与打捞轮询同一把尺）。
        if (!tw.settledTurns.includes(rawTurn0.turn)) {
          const evtTime = Number((watchedEvent as { time?: unknown }).time)
          if (!Number.isFinite(evtTime) || evtTime > tw.rescueAnchorMs) {
            tw.settledTurns.push(rawTurn0.turn)
            resolvePendingTurn(tw, rawTurn0.turn)
          }
        }
      }
    }
    if (!FORWARD_CHILD_EVENTS.has(watchedEvent.type) && watchedEvent.type !== 'assistant/chunk') return
    const isChunk = watchedEvent.type === 'assistant/chunk'
    const chunkWrap = isChunk
      ? (watchedEvent.data as {
          chunk?: { type?: string; index?: number; blockType?: string; text?: unknown; name?: unknown; argumentsDelta?: unknown; block?: { type?: string } }
          turn?: unknown
          step?: unknown
        })
      : undefined
    const chunk = chunkWrap?.chunk
    const raw = (watchedEvent.data ?? {}) as Record<string, unknown>
    const mappedStep = typeof raw.step === 'number' ? raw.step : 0
    // 流式直播（SSE，零落盘）——与旧路径同帧词汇。【0.1.3 注】本段在原生构建
    // 下恒不触发（0.1.3 无 assistant/chunk 会话事件，增量走 agent 级瞬时帧），
    // 直播由下方 stream-frames 的帧桥承担；此处保留为旧宿主形态的存量护栏。
    if (isChunk && chunk !== undefined) {
      broadcastActorStreamChunk({ sid, node_name: nodeName, actor, step: mappedStep, ref: waitKey }, chunk)
    }
    if (watchedEvent.type === 'tool/call') {
      if (typeof raw.callId === 'string' && typeof raw.name === 'string') {
        toolNamesByCallId.set(raw.callId, raw.name)
      }
    } else if (watchedEvent.type === 'tool/result') {
      const msg = (watchedEvent.data as {
        message?: {
          source?: { callId?: unknown }
          content?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>
        }
      }).message
      const callId = typeof msg?.source?.callId === 'string' ? msg.source.callId : undefined
      let text = ''
      for (const part of msg?.content ?? []) {
        for (const inner of part?.content ?? []) {
          if (inner?.type === 'text' && typeof inner.text === 'string' && inner.text.length > 0) {
            text = inner.text
            break
          }
        }
        if (text.length > 0) break
      }
      const name = callId !== undefined ? toolNamesByCallId.get(callId) : undefined
      // 【2026-09-20 旧直播链停发】tool_result 帧下线：投影窗的工具卡片与结果
      // 由交卷 steps 经桥 EventProjector 落账（且不截 2000 字，比旧帧更全）；
      // 前端 femo_stream 残链退役时一并摘除。
      // broadcastSse('femo_stream', {
      //   kind: 'tool_result', sid, node_name: nodeName, actor, step: mappedStep,
      //   ...(name !== undefined ? { name } : {}),
      //   text: text.length > 2000 ? `${text.slice(0, 2000)}…` : text,
      // })
    }
    // 【2026-09-20 大扫除】镜像半（mirroredSeqs 账本/speaker/📢 行/结构内容
    // 落窗/错误行归属）整段删除——投影窗内容由桥 EventProjector 段落供给。
  }
  const disposeListener = ctx.on('session/event', onChildEvent)

  // ── 完成探测兜底轮询（2026-09-17 j1695 险情）─────────────────────────────
  // 打捞时间锚（2026-09-17 j1716 实锤，取代 j1698 轮询基线）：旧方案在武装
  // 时刻「直读活会话」算基线——但复用子代理在 sendMessage 物化之前不在
  // ctx.agents（j1716 投票轮四角色同时如此），直读静默落空 → 基线退化成
  // 空集 → 投递后第一拍把看牌/陈述两个旧 turn/end 全捞走，buildTranscript
  // 拿旧回合 bucket 组装台词交卷（j1698 复读首答病的根因没除干净）。
  // 改为纯时间锚：兜底只服务「本节点投递之后新落日志」的收口——会话事件
  // 自带 time（毫秒、同进程时钟），锚点时刻或更早的一律是旧回合，与基线
  // 读不读得到无关；冷恢复、钩子失明、首建秒回三种场景同一把尺。轮内
  // steer 重试在投递前把锚点前移。
  // 【刀⑥】锚赋值必须在此原位（prevLock 等待之后、监听注册之后的同步段），
  // 不可随状态对象创建提前；轮询正身（含 j1695 全注）迁 turn-watch.ts。
  tw.rescueAnchorMs = Date.now()
  const pollTimer = startRescuePoll(ctx, tw, childIdRef, armIdle, nodeName)

  // ── 0.1.3 原生流帧直播（打字机本体）────────────────────────────────────
  // 本子代理的模型增量经 agent/assistant-stream 到达（会话事件里没有 chunk），
  // 按既有 femo_stream 词汇转出 → god/stage/角色投影窗实时逐字渲染；看门狗同步
  // 再武装（0.1.3 生成长回合期间没有任何会话事件，只有帧——不接这条会让满负荷
  // 生成的节点被空闲超时误杀）。
  const liveFrames = new LiveStreamFrames(
    // ref=waitKey：投影中心据此把逐字流喂进桥开好的那个段（宿主不认识段键）
    { sid, node_name: nodeName, actor, turn: baseTurn, ref: waitKey },
    chunk => { if (chunk.type === 'usage') usage.applyUsage(chunk.usage) },
  )
  const disposeFrameListener = onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === undefined || childIdRef.id === '') return
    if (String(agent?.id ?? agent?.session?.id ?? '') !== childIdRef.id) return
    armIdle()
    liveFrames.frame(frame)
  })

  // ── 子代理 ensure：复用或创建（Job×角色 身份钉子）───────────────────────
  let entry = actorChildren.get(actorRegistryKey(sid, jobId, actorKey))
  const wasNew = entry === undefined
  let created = false
  try {
    if (entry !== undefined) {
      // 复用既有条目：把本节点调用的推理档位交给钩子 holder。
      entry.reasoning.actorThinking = actorThinking
      childIdRef.id = entry.childId
    } else {
      // 冷恢复探测正身查绑定账（cast 两段式，2026-09-25）：上次登记的执行体
      // 会话 id 从账里拿，不再靠「上次也按同样规则起名」的约定反推。仅当账上
      // 的 id 是本家子代理（femo-actor- 前缀，与前端目录过滤同一身份标记）才
      // 用于冷恢复——预绑定条目（用户主会话 sid，派工分流刀启用）不走这里。
      // 账无页（存量 Job / 登记失败）回落规则化拼名——拼名从此只是新角色起名
      // 的实现细节，不是绑定的查询依据（迁移期回落，存量 Job 自然跑完后删）。
      const castEntry = (await readJobCast(resolved.femoRoot, jobId))[castSoul]
      const resumedSid = typeof castEntry?.sid === 'string' && castEntry.sid.startsWith('femo-actor-')
        ? castEntry.sid
        : undefined
      const childId = resumedSid ?? nativeChildId(sid, jobId, actorKey)
      childIdRef.id = childId
      const persistence = ctx.get('sessionPersistence') as
        | { stat?(id: SessionId, options?: unknown): Promise<unknown> }
        | undefined
      let persisted = false
      try {
        persisted = (await persistence?.stat?.(SessionId(childId))) !== undefined
      } catch (statError: unknown) {
        console.log(`[femo-plugin][native] persistence stat(${childId}) failed: ${String(statError)} — treating as absent`)
      }
      const newEntry: NativeActorEntry = { childId, actor, jobId, reasoning: { actorThinking }, hooked: false }
      // 档位钉法落盘备查（user_data/debug-effort-hook.log）。
      debugEffortLog(resolved, 'create',
        `child=${childId} actor=${JSON.stringify(actor)} actor_thinking=${JSON.stringify(actorThinking)}`
        + ` source=${JSON.stringify(String(request.source ?? ''))}`)
      if (!persisted) {
        // 首建：durably continuable child，初始 prompt 随建随投（官方 inbox 接受）。
        const mainModel = resolveMainModel(parent as unknown as Parameters<typeof resolveMainModel>[0], defaultModel)
        const sourceOptions = resolveSourceModel(resolved, request.source, mainModel)
        // thinking 档位在**建子代理时**就钉进 agentOptions（2026-09-10 修）：
        // 初始 prompt 这一轮不经过 agent/request 钩子（钩子在 startContinuable
        // 之后才装，见下方 setupChildAgent），旧代码只给钩子钉档位、建的时候
        // 不给，于是首轮继承主会话的 reasoningEffort（本机 = deepseek + high），
        // 非推理模型（local/gemma-3-4b-it）当场 400 UNSUPPORTED_REASONING_EFFORT。
        // 语义（与FEMO脚本解析一致：不写 thinking = default = 不下发档位）：
        // 声明了 → 显式钉该档位；没声明 → 不带字段，由模型/部署自决。
        //
        // 注意不能写 `{ agentOptions: { ...sourceOptions.agentOptions, reasoningEffort } }`
        // ——reasoningEffort 为 undefined 时键仍存在、会盖掉 dsh
        // resolveChildAgentOptions 的「换模型即删继承 effort」语义，故用条件展开。
        const agentOptions = {
          ...sourceOptions.agentOptions,
          ...actorThinking !== undefined ? { reasoningEffort: actorThinking } : {},
        }
        await subagents.startContinuable({
          provider: resolved.subagentProvider,
          label: actor,
          childId: SessionId(childId),
          request: {
            prompt: [{ type: 'text', text: prompt }],
            parent,
            persona: soulPersona,
            agentOptions,
            ...toolFilterOf(resolved, request),
          },
          signal: controller.signal,
        })
        created = true
        setupChildAgent(ctx, childId, newEntry.reasoning, resolved, defaultModel, true)
        newEntry.hooked = true
        // 绑定账登记（cast 两段式）：本 Job 该角色的执行体会话 id 落账——
        // 冷恢复的正身依据；失败只留痕（回落拼名仍在，行为不变）。
        void putJobCastEntry(resolved.femoRoot, jobId, castSoul, childId, hostAddr())
          .catch((error: unknown) => { console.log(`[femo-plugin][native] cast 登记 ${castSoul} 失败 (job=${jobId}): ${String(error)}`) })
        console.log(`[femo-plugin][native] actor child created: ${childId} (${actor}, job=${jobId})`)
      } else {
        // 上一进程留下的持久子代理：本轮 sendMessage 自动冷恢复；agent/request
        // 钩子不持久，投递后对新 Agent 实例重装（见下方 needsHookInstall）。
        console.log(`[femo-plugin][native] actor child persisted from previous process: ${childId} (${actor}, job=${jobId}) — will cold-resume on send`)
      }
      entry = newEntry
      actorChildren.set(actorRegistryKey(sid, jobId, actorKey), entry)
    }
  } catch (error: unknown) {
    disposeListener()
    disposeFrameListener()
    activeSubagents.delete(activeEntry)
    releaseLock()
    throw error
  }
  const childId = entry.childId
  // interrupt 通路（首建与复用统一在此接线；abortAll/abortJob 与看门狗共用）。
  interruptRef.fn = (): void => {
    try {
      subagents.interrupt(SessionId(childId), { kind: 'user', parentSessionId: SessionId(sid) })
    } catch { /* 未物化/已释放：官方语义 no-op 或可吞的授权错误 */ }
  }

  // api-retry / node-retry 登记（与旧路径同款：早于任何慢层失败判定/重试信号）。
  activeChildRuns.set(childId, { mainSid: sid, node: nodeName, jobId })
  const steerChild = (text: string): void => {
    const live = ctx.agents.get(SessionId(childId)) as NativeChildAgent | undefined
    if (live?.steer !== undefined) {
      // 0.1.5 起 steer 可能抛（inbox 改 session projection、投影未激活即抛）——
      // 走 safeSteer 兜底，失败就落到下面的官方 sendMessage 面，不往上炸。
      const delivered = safeSteer(live, {
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text }],
        source: FEMO_PLUGIN_SOURCE,
      }, `child ${childId}`)
      if (delivered) return
    }
    // 非驻留（冷恢复期）或 steer 投递失败：官方 sendMessage 面投递（steer 语义）。
    void subagents.sendMessage(parent, SessionId(childId), [{ type: 'text', text }], { signal: controller.signal })
      .catch(() => undefined)
  }
  broker.register({
    waitKey,
    nodeName,
    kind: 'subagent',
    jobId,
    mainSessionId: sid,
    controller,
    steer: steerChild,
  })

  // 回传给引擎的模型标识（usage 采样喂给，与旧路径同款）。

  // abort → 回合等待者立刻失败：被掐断的回合不会再有 turn/end（旧路径由
  // run.result 的 rejection 承担同一语义），不接这条，等待协程会永久挂死。
  const onAbortReject = (): void => {
    const reason = controller.signal.reason
    rejectPendingTurn(tw, reason instanceof Error ? reason : new Error(String(reason ?? 'aborted')))
  }
  controller.signal.addEventListener('abort', onAbortReject)

  try {
    armIdle()
    // 时间锚已在函数体前段划好（rescueAnchorMs，见其注释）：兜底只认投递后
    // 新落的收口。不再做「武装时刻读活会话」——复用子代理在 sendMessage 物化
    // 前不在 ctx.agents，旧基线直读静默落空即 j1716 投票轮复读首答的根因。
    // 投递：首建回合已随 startContinuable 起跑；复用/冷恢复经 sendMessage。
    if (!created) {
      // 官方注释：空闲目标开新回合。锁保证此刻空闲；驻留代理若仍有残余活动
      // （如用户经官方 composer 触发的回合），best-effort 等它收口再投递。
      const live = ctx.agents.get(SessionId(childId)) as NativeChildAgent | undefined
      if (live?.whenIdle !== undefined) {
        await Promise.race([
          live.whenIdle(),
          new Promise<void>(resolve => { setTimeout(resolve, 30_000) }),
          new Promise<void>((_resolve, reject) => {
            controller.signal.addEventListener('abort', () => reject(new Error('aborted while waiting for idle')), { once: true })
          }),
        ])
        armIdle()
      }
      tw.baselineCount = tw.settledTurns.length
      await subagents.sendMessage(parent, SessionId(childId), [{ type: 'text', text: prompt }], { signal: controller.signal })
      // 冷恢复路径：sendMessage 内部已把持久子代理物化为新 Agent 实例——
      // agent/request 钩子不持久，这里补装（委派权限钉子已随日志 fold 恢复，
      // 不重复 append）。
      if (entry.hooked !== true) {
        setupChildAgent(ctx, childId, entry.reasoning, resolved, defaultModel, false)
        entry.hooked = true
      }
    }
    console.log(`[femo-plugin][native] node dispatched to actor child ${childId}: node=${nodeName} created=${String(created)} reused=${String(!wasNew)}`)

    // 等本节点回合收口 → 组装回传（与旧路径同款 trajectory 词汇）。
    let output = ''
    let steps: TranscriptStep[] = []
    const turnObserveFrom = tw.allChildEvents.length   // 本节点回合的观测起点（历史回合不参与错误判定）
    const firstTurn = await waitTurnAfterBaseline(tw)
    const built = buildTranscript(tw.childTurnEvents.get(firstTurn) ?? [])
    output = built.output
    steps = built.steps
    if (output.length === 0) {
      // 兜底（仅取日志的最终 assistant 输出，不取 steps——复用会话的历史
      // 回合不属于本节点）：逐 turn 归档漏采时的最后防线。只认锚点后新落的
      // 事件——全量日志的最终 assistant 输出必是上一轮的台词，正是 j1716
      // 复读家族的又一条通路（eventAfterAnchor 见打捞时间锚注释）。
      const live = ctx.agents.get(SessionId(childId)) as NativeChildAgent | undefined
      output = live?.session !== undefined
        ? buildTranscript(readSessionEvents(live.session as unknown as Session).filter(ev => eventAfterAnchor(tw, ev))).output
        : ''
    }
    if (steps.length === 0 && output.length > 0) {
      steps = [{ step: 0, cot: '', reply: output, tool_calls: [], tool_results: [] }]
    }
    // 回合以 error 收场（执行体层面失败：provider 拒绝/协议错/网关错）→ 上报
    // 执行失败信封，而不是伪装成空台词交卷（2026-09-10）。引擎按
    // FEMOActorExecutionError 裁决：通知作者 + 节点挂起保留断点，续跑换执行体。
    // 只认「本节点投递之后观察到的」回合，不拿复用会话的历史回合顶罪。
    const firstTurnError = childTurnError(tw.allChildEvents.slice(turnObserveFrom))
    if (firstTurnError !== undefined && output.length === 0) {
      console.log(`[femo-plugin][native] 子代理回合以 error 收场（node=${nodeName}）：${firstTurnError.detail}`)
      await sendActorFailure(bridge, jobId, waitKey, firstTurnError.kind, firstTurnError.detail)
      return
    }
    // 首轮交卷（节点发言第二阶段，2026-09-16 统一寄 speech 信；空产出也交，
    // 优劣由引擎校验裁决）。
    await bridge.send('post_speech', executorSpeechArgs({
      jobId, waitKey, soul: actor, node: nodeName, output, steps, modelId: usage.modelIdNow(),
    }))

    // 停靠（与旧路径同语义：首次交卷≠审结，node_retry 经租约 steer 续跑）。
    if (!runControlAborted.has(controller)) {
      if (tw.idleTimer !== undefined) { clearTimeout(tw.idleTimer); tw.idleTimer = undefined }
      let verdict = await broker.park(waitKey)
      while (verdict.kind === 'retry') {
        armIdle()
        // 重试取答前必须重定基线：baselineCount 停在首投递前，旧基线下
        // waitTurnAfterBaseline 会瞬间返回旧回合，误判重试回合零产出。
        tw.baselineCount = tw.settledTurns.length
        tw.rescueAnchorMs = Date.now()   // 重试锚点前移：只认 steer 之后新落的收口
        const snapshotLen = tw.allChildEvents.length
        // 轮内 steer 重试：直播残留清桶帧已随旧直播链停发（2026-09-20）——
        // 新回合的逐字内容由 hub 草稿帧承担，无残留可清。
        steerChild(RETRY_STEER_TEXT(verdict.attempt, verdict.feedback))
        const retryTurn = await waitTurnAfterBaseline(tw)
        const retryEvents = tw.allChildEvents.slice(snapshotLen)
        const builtRetry = buildTranscript(retryEvents.some(e => e.type === 'turn/end')
          ? tw.childTurnEvents.get(retryTurn) ?? retryEvents
          : retryEvents)
        // 重试回合也以 error 收场 → 同样上报执行失败（与首轮同款，2026-09-10）。
        const retryError = childTurnError(retryEvents)
        if (retryError !== undefined && builtRetry.output.length === 0) {
          console.log(`[femo-plugin][native] 重试回合以 error 收场（node=${nodeName}）：${retryError.detail}`)
          await sendActorFailure(bridge, jobId, waitKey, retryError.kind, retryError.detail).catch(() => undefined)
          break
        }
        if (!retryEvents.some(e => e.type === 'turn/end') && builtRetry.steps.length === 0 && builtRetry.output.length === 0) {
          console.log(`[femo-plugin][native] 节点重试回合未观测到 turn/end 且零产出（node=${nodeName}），上报执行体失败`)
          await sendActorFailure(bridge, jobId, waitKey, 'turn_timeout', '重试回合超时且零产出').catch(() => undefined)
          break
        }
        output = builtRetry.output
        steps = builtRetry.steps.length > 0 ? builtRetry.steps
          : output.length > 0 ? [{ step: 0, cot: '', reply: output, tool_calls: [], tool_results: [] }] : []
        // 重试回合交卷（同首轮：speech 信代寄）。
        await bridge.send('post_speech', executorSpeechArgs({
          jobId, waitKey, soul: actor, node: nodeName, output, steps, modelId: usage.modelIdNow(),
        }))
        if (tw.idleTimer !== undefined) { clearTimeout(tw.idleTimer); tw.idleTimer = undefined }
        verdict = await broker.park(waitKey)
      }
      if (verdict.kind === 'aborted' && !runControlAborted.has(controller)) {
        await sendActorFailure(bridge, jobId, waitKey, 'park_timeout',
          '停靠等待超时（15min），执行体未在时限内交出重试回合').catch(() => undefined)
      }
    }
    console.log(`[femo-plugin][native] subagent node done: ${nodeName} child=${childId} output=${output.length}ch steps=${steps.length}`)
    if (output.length > 0) {
      console.log(`[femo-plugin][native] subagent output head: ${output.slice(0, 300).replace(/\n/g, '\\n')}`)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (runControlAborted.has(controller)) {
      console.log(`[femo-plugin][native] subagent stopped by run-control: ${nodeName} ${message}`)
    } else {
      recordError(session.id, `子 agent 中断：${message}`)
      console.log(`[femo-plugin][native] subagent interrupted: ${nodeName} ${message}`)
      await sendActorFailure(bridge, jobId, waitKey, 'executor_error', message).catch((sendError: unknown) => {
        console.log(`[femo-plugin][native] 执行失败信号回传失败: ${String(sendError)}`)
      })
    }
  } finally {
    activeSubagents.delete(activeEntry)
    activeChildRuns.delete(childId)
    broker.unregister(waitKey)
    apiRetry.clearChild(childId)
    usage.persist()
    // 【2026-09-20 旧直播链退役】区块释放（releaseSection/段落闸门）整体拔除——
    // 镜像落盘/合成收口/end 帧全部退役，无账可放。
    // 节点收尾兜底熄状态行（幂等；正常路径已在本节点 turn/end 处熄过）。
    liveFrames.endTurn()
    if (tw.idleTimer !== undefined) clearTimeout(tw.idleTimer)
    clearInterval(pollTimer)
    controller.signal.removeEventListener('abort', onAbortReject)
    disposeListener()
    disposeFrameListener()
    rejectPendingTurn(tw, new Error('node settled'))
    releaseLock()
    // 与旧路径的关键差异：不 dispose（复用前提——子代理继续驻留）、不归档、
    // 不移出会话树。常驻执行体的冷恢复依赖持久化；它不对用户展示（目录里
    // ban），观看面是 femo-proj 角色投影窗。
    console.log(`[femo-plugin][native] subagent node settled (child kept alive): ${nodeName} child=${childId}`)
  }
}


