/**
 * actors/main/index.ts — 主Agent参与运行（source:main）· 主窗口回答制 · 主流程。
 *
 * 【刀⑥ 分家】原 main-actor.ts 单文件四拆，本文件收主入口 runMainModelTurn
 * （串行队列包装 + 停靠重试循环）、主会话事件钩子 mainSessionEventHook（轮次
 * 捕获与交卷接线）、原生流帧直播桥 installMainActorStreamBridge、交卷与兜底
 * （settleMainAnswer/recordEmpty）：
 *  - ./capture.ts   pending 在飞表 + captureVerdict 裁决纯函数 + 窄接口；
 *  - ./delivery.ts  交付排队（三道时序门）+ 作废/退队；
 *  - ./notice.ts    注入文案 + 流水水位六张表。
 * 消费方：mailbox-push（runMainModelTurn/noteMainActor）、engine-events（钩子/
 * 清场/直播桥等九件）——都经 main-actor.ts 壳零改动（壳保留原因：单测打包
 * 该路径取 captureVerdict，不许改测试）。
 *
 * 最终方案（2026-08-31 定稿；旧"分身直调"方案已废弃回滚，备份见
 * MEOW_backups/main-actor.ts.bak-20260831-rollback）：
 *  - main 节点不拉子代理、不直调 LLM。宿主把「增量 main 可见剧内发言 + 节点
 *    提醒」以 steer 注入发进主窗口；主模型在主窗口正常回答（流式主屏，
 *    thinking/tools 全保留——天使降临人间还是有魔法的）；宿主捕获被注入唤起
 *    的这一整轮（多步 react），寄 speech 信交卷——引擎按 AI 节点规则
 *    落库（prompt/showprompt→dialog、回答→react_steps，soul_id=main、
 *    model_id=main）并继续流程。台词来源变了，落库路径零特例。
 *  - 主窗口=主模型视角窗：全剧只有一个上下文，剧内事件以消息流进主窗口——
 *    KV 缓存（消息追加=前缀追加）、记忆带出（台词天然在主窗口历史里）、
 *    user 开黑插话（穿插）全部自然成立。
 *  - 上帝窗：god-mirror 现成镜像主会话，零改动（主模型发言天然流失到上帝窗）。
 *    角色窗/戏内窗：v1 role 行灰框投影已于 2026-09-01 按猫猫拍板整体移除
 *    （god 窗重复塞入=画蛇添足；stage/角色窗的 main 发言之后复用投影窗自己的
 *    镜像/流式逻辑另做，不在此处塞 UI 行）。
 *  - 【V6.3 2026-09-01】stage/角色窗 main 轮戏内投影（猫猫拍板"复用之前成功
 *    的投影方法"）：mainSessionEventHook 轮次捕获点上同步挂 V6 同款投影——
 *    原生骨架（turn/start、step/start，主会话轮自带真实结构）即时落盘 →
 *    speaker/📢 showprompt 行（带 turn 归属，V6.2 同款，渲染位由 femo-turn-head
 *    决定）→ 内容（chunk 块边界/message/tool/call/tool/result/step/end）进
 *    投影缓冲，turn/end 原子落地成连续区块（「日志顺序即容器」，与其他节点
 *    零交错）；chunk 全量旁路广播 femo_stream（actor=main 角色名，block_end 带
 *    retain——V6 角色直播语义，前端直播桶 turn 关闭即隐藏）。分发=stage 全量
 *    + 节点 scope 命中的角色窗，**god 窗 skipGod 零写入**（god-mirror 已覆盖，
 *    2026-08-31 回滚教训：重复骨架=孤儿事件、裸 _srcSeq 撞 god 去重——本次
 *    物理隔离+_srcSeq 独立命名空间 `main#<seq>` 双保险）。前端零改动：head/
 *    stream 节点与 useFemoStream 均按 turn/actor 通用机制工作。
 *
 * 状态全部内存态（按主会话 sid 键控）：FEMO 运行是进程内活动，重启即重跑
 * （fresh_start），水位/流水无需持久化。
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { FemoBridge } from '../../bridge'
import type { ResolvedConfig } from '../../config'
import { broadcastSse } from '../../http'
import { broadcastStreamChunk, LiveStreamFrames, onAssistantStreamFrames, type FemoStreamChunk } from '../../hub/stream-frames'
import { projectionActorKey, type ProjectionRegistry } from '../../projection/projection'
import { sendActorFailure } from '../../bridge'
import { buildTranscript } from '../../engine-transcript'
import { broker } from '../../node-retry'
import { apiRetry } from '../../api-retry'
import { executorSpeechArgs } from '../../../../../femo2host/host/speech-core.mjs'
import { actorNameOf, soulIdentityOf } from '../../actor-name'   // 执行者名/灵魂身份的唯一取值口
// 捕获锚定迁 actors/main/capture.ts（2026-09-26 刀⑥）：pending 表+裁决纯函数
// 正身在该文件，本文件经窄接口（peek/take）访问；debugLogMainActor 随表落叶层。
import {
  captureVerdict, debugLogMainActor, peekPending, takePending,
  userMessageTextOf, isRealUserMessage,
  type PendingAnswer,
} from './capture'
// 交付面迁 actors/main/delivery.ts（2026-09-26 刀⑥）：队列+三道时序门正身在
// 该文件；本文件的钩子与主入口经 import 取用。
import {
  deliveries, flushNextMainDelivery, queueOrDeliverMain,
  requeueSwallowedInjection,
  type MainDelivery,
} from './delivery'
import { flows, mainRetrySteerText, playNames, queues, stageNotice, waterMarks } from './notice'

// ── 主入口 ──────────────────────────────────────────────────────────────────

/** 引擎 ai_request(source:main) 的回答入口（串行队列包装）。 */
export function runMainModelTurn(
  ctx: Context,
  resolved: ResolvedConfig,
  bridge: FemoBridge,
  session: Session,
  request: Record<string, unknown>,
  recordError: (sessionId: SessionId, text: string) => void,
  projections?: ProjectionRegistry,
  nodeScopes?: ReadonlyMap<string, string[]>,
  nodeShowprompts?: ReadonlyMap<string, string>,
  jobId: number = -1,
): Promise<void> {
  const sid = String(session.id)
  const prev = queues.get(sid) ?? Promise.resolve()
  const call = prev.catch(() => undefined).then(() =>
    runMainModelTurnInner(ctx, resolved, bridge, session, request, recordError, projections, nodeScopes, nodeShowprompts, jobId),
  )
  queues.set(sid, call.catch(() => undefined))
  return call
}

async function runMainModelTurnInner(
  ctx: Context,
  resolved: ResolvedConfig,
  bridge: FemoBridge,
  session: Session,
  request: Record<string, unknown>,
  recordError: (sessionId: SessionId, text: string) => void,
  projections?: ProjectionRegistry,
  nodeScopes?: ReadonlyMap<string, string[]>,
  nodeShowprompts?: ReadonlyMap<string, string>,
  jobId: number = -1,
): Promise<void> {
  const sid = String(session.id)
  const waitKey = String(request.wait_key ?? '')
  const nodeName = String(request.node_name ?? '')
  const actor = actorNameOf(request) || `@${nodeName}`
  // 交卷 soul（信封收件人同款派生）：actor_info.soul 优先；source:main 与裸
  // 执行者兜底 'main'——绑定会话角色在此拿到自己的 soul，交卷落对角色账。
  const soul = soulIdentityOf(request) || 'main'
  const blocks = (request.blocks as Record<string, unknown> | undefined) ?? undefined
  const prompt = typeof blocks?.prompt === 'string' ? String(blocks.prompt) : ''
  // 【2026-09-12】场上信息改走 Block Collector 产物：引擎对 main 节点与其他
  // 节点走同一条 collect_blocks（first_full_then_incremental + actors_def 双名
  // 制），blocks.context 即「[名字]：\n内容」排版的标准上下文——替换原流水行
  // 拼装（半角冒号名行+无标签 markdown 块，用户实测太乱）。缺/空时 stageNotice
  // 内部退回流水行。
  const fieldContext = typeof blocks?.context === 'string' ? String(blocks.context) : ''
  const scopes = nodeScopes?.get(nodeName)
  debugLogMainActor(resolved, `[宿主] main 节点进入: node=${nodeName} actor=${actor} wait_key=${waitKey} 场上信息=BC(${fieldContext.length}ch) 流水=${flows.get(sid)?.length ?? 0}条 水位=${waterMarks.get(sid) ?? 0}`)

  if (waitKey.length === 0) {
    debugLogMainActor(resolved, `!! wait_key 为空，放弃（引擎将等待超时）`)
    return
  }

  // 增量注入：流水按水位取增量，注入后推进水位（场上信息走 BC context 后，
  // 流水水位仍照常推进——运行结束补遗的"自上次注入起的尾巴"语义依赖它）。
  const all = flows.get(sid) ?? []
  const mark = waterMarks.get(sid) ?? 0
  const delta = all.slice(mark)
  waterMarks.set(sid, all.length)
  const notice = stageNotice(sid, nodeName, actor, prompt, delta, false, fieldContext)
  debugLogMainActor(resolved, `注入组装完成: 增量=${delta.length}条 BC=${fieldContext.length}ch 通知=${notice.length}ch`)

  // node-retry 持久登记（2026-09-05 Step D，施工清单 v4 §7.1）：在登记 pending
  // 之前——早于任何交卷，与门卫豁免时序对齐（登记永远早于引擎可能发出的
  // 第一个 node_retry，不存在"信号到了没人接"的窗口）。租约=重试轮的"继续
  // 跑"翻译：先 rearmPending（pre-step 门卫豁免源 isMainAnswerPending 先就绪）
  // 再 steerMainAgent，时序物理封装在租约内。
  broker.register({
    waitKey,
    nodeName,
    kind: 'main',
    jobId,
    mainSessionId: sid,
    steer: (text) => {
      // 【2026-09-11】重试轮的"继续跑"同样过队列：它不是新节点（waitKey/节点
      // 身份不变，交付后照旧 park 等裁决），但若此刻主模型正在跟用户说话，
      // 也不能插进那一轮（捕获面 sawTurnStart 永假 → 既污染用户回合又交不上卷）。
      // 排队只推迟交付时点，节点边界不变。
      queueOrDeliverMain(ctx, resolved, sid, {
        waitKey, nodeName, actor, soul, scopes: scopes ?? [], jobId,
        ...(nodeShowprompts?.get(nodeName) !== undefined ? { showprompt: nodeShowprompts.get(nodeName) } : {}),
        text, via: '重试',
      })
    },
  })
  // 登记在飞（先登记再 steer——pre-step 放行判定必须在回合唤醒前就绪）。
  // 【V6.3】showprompt 从 context_ready 暂存取（引擎对所有 AI 节点统一发
  // context_ready，main 节点同款）；投影缓冲/工具名表随登记对象初始化。
  // 【2026-09-11】交付过队列：主模型正在跟用户说话（有轮在飞）时先排队，
  // 等那一轮彻底结束再作为新一轮的开头交付（FEMO内外不掺一轮）。pending 登记
  // 与 steer 都在交付那一刻发生——在飞期间 isMainAnswerPending 为假，捕获面
  // 不会把用户那轮当成交卷内容。
  const delivery: MainDelivery = {
    waitKey, nodeName, actor, soul, scopes: scopes ?? [], jobId, text: notice, via: '首轮',
    ...(nodeShowprompts?.get(nodeName) !== undefined ? { showprompt: nodeShowprompts.get(nodeName) } : {}),
  }
  const answer = new Promise<void>((resolve) => { delivery.resolve = resolve })
  try {
    queueOrDeliverMain(ctx, resolved, sid, delivery)
    debugLogMainActor(resolved, `注入已投递（若主模型在飞则排队），等待主模型回合...`)
    await answer
    debugLogMainActor(resolved, `回合结束，交卷完成`)
    // ── 停靠循环（2026-09-05 Step D，施工清单 v4 §7.2）────────────────────
    // 首次交卷≠节点审结：引擎校验失败发 node_retry（broker deliverRetry 解析
    // 为 retry verdict）。retry → 经租约 steer（rearmPending+steerMainAgent 都
    // 封装在租约回调里，循环体零特殊）→ 主模型新回合 → mainSessionEventHook
    // 既有捕获（turn/start 重置逻辑天然多轮兼容）→ turn/end → settleMainAnswer
    // 交卷 → 再次 park。done（node_settled ok/gave_up）或 aborted（暂停/出错/
    // bridge 死亡/15min 超时）→ 收尾。flows/水位不动（v4 §7.2）：流水已在首轮
    // 注入（水位已推进），反馈自带节点/角色身份，重注=重复刷屏。
    let verdict = await broker.park(waitKey)
    while (verdict.kind === 'retry') {
      debugLogMainActor(resolved, `停靠重试: node=${nodeName} attempt=${verdict.attempt} feedback=${verdict.feedback.length}ch`)
      broker.steerLease(waitKey, mainRetrySteerText(playNames.get(sid) ?? 'FEMO脚本', nodeName, actor, verdict.attempt, verdict.feedback))
      verdict = await broker.park(waitKey)
    }
    debugLogMainActor(resolved, `停靠结束: node=${nodeName} verdict=${verdict.kind}`)
  } catch (error: unknown) {
    debugLogMainActor(resolved, `!! 异常: ${error instanceof Error ? error.message : String(error)}`)
    takePending(sid)
    recordError(SessionId(sid), `主模型参与运行注入失败：${error instanceof Error ? error.message : String(error)}`)
    await sendActorFailure(bridge, jobId, waitKey, 'main_executor_error',
      error instanceof Error ? error.message : String(error)).catch(() => undefined)
  } finally {
    // 停靠登记与 API 慢层计数兜底清（幂等；done/aborted/异常全路径都到这，
    // 与 subagent.ts finally 同款）。flows/水位不动（v4 §7.2 收尾语义）。
    // 【2026-09-11】本 waitKey 还排着队的交付件一并剔除：等它的停靠循环已经
    // 收场（done/aborted/异常），再交付=对空气说话（还会拿旧 wait_key 交卷）。
    const stale = deliveries.dropWhere(sid, d => d.waitKey === waitKey)
    if (stale.length > 0) {
      debugLogMainActor(resolved, `排队注入随节点收尾剔除: wait_key=${waitKey} 条=${stale.length}`)
      for (const d of stale) d.resolve?.()
    }
    broker.unregister(waitKey)
    apiRetry.clearChild(sid)
  }
}

// ── 主会话事件钩子（轮次捕获）─────────────────────────────────────────────

/** main 轮 chunk 直播帧（V6 角色同款语义：delta/start/block_end，block_end 带
 *  retain=true——块保留在前端直播桶里直到 turn 落地接管）。actor=main 角色名，
 *  与主Agent直播帧（actor='主Agent'）分桶互不干扰。
 *  @param step - 本帧所属 react 步号（旧路径取事件 data.step，0.1.3 原生帧自带）。 */
function broadcastMainChunk(
  p: PendingAnswer,
  sid: string,
  step: number,
  chunk: FemoStreamChunk,
): void {
  broadcastStreamChunk({ sid, node_name: p.nodeName, actor: p.actor, step, ref: p.waitKey }, chunk)
}

// ── 0.1.3 原生流帧直播桥（主模型参与运行）─────────────────────────────────────

/** per-sid 直播位（角色名随节点变：actor 变了换桶，旧桶由 turn 关闭回收）。 */
const mainLiveFrames = new Map<string, { actor: string; frames: LiveStreamFrames }>()

/** 订阅宿主原生 assistant 流帧，把在飞 main 节点的模型增量转成 femo_stream
 *  直播帧（stage/角色窗的打字机）。与旧 chunk 路径互斥（0.1.3 无 chunk 会话
 *  事件、旧版无本帧——见 stream-frames 头注释），不会重复广播。 */
export function installMainActorStreamBridge(ctx: Context): void {
  onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === undefined) return
    const sid = String(agent?.session?.id ?? agent?.id ?? '')
    if (sid.length === 0) return
    const p = peekPending(sid)
    // 只有「本会话有在飞 main 节点且本回合已开」的增量属于参与轮（其余归主Agent
    // 桥/原生渲染）；门控与旧 chunk 分支同款。
    if (p === undefined || p.settled || !p.sawTurnStart) return
    let live = mainLiveFrames.get(sid)
    if (live === undefined || live.actor !== p.actor) {
      live = { actor: p.actor, frames: new LiveStreamFrames({ sid, node_name: p.nodeName, actor: p.actor, turn: p.turn, ref: p.waitKey }) }
      mainLiveFrames.set(sid, live)
    }
    live.frames.frame(frame)
  })
}

/** engine-events 的 session/event 订阅转发进来：缓冲回答事件，turn/end 交卷；
 *  【V6.3】同一捕获点上同步挂 stage/角色窗FEMO内投影（骨架即时、内容缓冲
 *  turn/end 原子落地、chunk 旁路直播帧）。god 窗零写入（skipGod——god-mirror
 *  已覆盖主模型发言，2026-08-31 回滚教训：再写=孤儿骨架+去重撞车）。 */
export function mainSessionEventHook(
  ctx: Context,
  session: Session,
  event: SessionEvent,
  bridge: FemoBridge,
  resolved: ResolvedConfig,
  projections?: ProjectionRegistry,
): void {
  const sid = String(session.id)
  // ── 主会话轮开闭跟踪（2026-09-11）────────────────────────────────────────
  // FEMO内注入的排队判定源（见 main-delivery-queue.ts / queueOrDeliverMain）。
  // 必须先于 pending 早退：FEMO外轮（用户跟主模型说话）没有 pending，但它恰恰
  // 是"不能插进FEMO内通知"的那一轮。turn/end 时要做的两件事：
  //  ①登记轮收口（此后交付立即放行）；
  //  ②把排队中的下一节点作为新一轮开头交付——放在本 hook 末尾（本轮的
  //    交卷先做完再放行下一个，见下方两处 flush 调用点）。
  if (event.type === 'turn/start') {
    const turn = (event.data as { turn?: unknown } | undefined)?.turn
    if (typeof turn === 'number') deliveries.noteTurnStart(sid, turn)
  } else if (event.type === 'turn/end') {
    deliveries.noteTurnEnd(sid)
  }
  const p = peekPending(sid)
  if (p === undefined || p.settled) {
    // 本轮没有在飞注入（用户FEMO外轮收口 / 已交卷轮）：放行排队中的下一节点。
    if (event.type === 'turn/end') flushNextMainDelivery(ctx, resolved, sid)
    return
  }
  // 【2026-09-20 大扫除】投影窗引用拆除——旧链路写入退役，钩子只剩
  // 轮次捕获（交卷料）与 SSE 直播帧两件实事。
  if (event.type === 'turn/start') {
    p.sawTurnStart = true
    p.buffer = []
    // 【2026-09-23 捕获锚点】每轮重置进轮判定（通知的 user/message 恒在本轮
    // turn/start 之后才到，见上方锚点注释）。
    p.noticeEntered = false
    p.noticeEnteredClean = false
    p.stepEnded = false
    p.userMessageInTurn = false
    p.firstAdmitted = 'none'
    // turn 号照记：mainActorSceneActor FEMO内反查（god-mirror）、帧桥、合成
    // 收口都用它（与投影无关的活数据）。
    const turn = (event.data as { turn?: unknown } | undefined)?.turn
    if (typeof turn === 'number') p.turn = turn
    return
  }
  if (event.type === 'user/message') {
    const text = userMessageTextOf(event)
    const ours = p.notice.length > 0 && text === p.notice
    if (p.firstAdmitted === 'none') {
      p.firstAdmitted = ours ? 'ours' : 'other'
      if (!ours) {
        debugLogMainActor(resolved, `本轮非我们的轮（首条 admitted 不是本节点通知）: node=${p.nodeName} turn=${p.turn === undefined ? '?' : String(p.turn)}`)
      }
    }
    if (ours) {
      p.noticeEntered = true
      p.noticeEnteredClean = p.sawTurnStart && !p.stepEnded
      debugLogMainActor(resolved, `通知进轮: node=${p.nodeName} clean=${p.noticeEnteredClean} first=${p.firstAdmitted} turn=${p.turn === undefined ? '?' : String(p.turn)}`)
    } else if (isRealUserMessage(event)) {
      p.userMessageInTurn = true
      debugLogMainActor(resolved, `本轮混入真人消息: node=${p.nodeName} turn=${p.turn === undefined ? '?' : String(p.turn)}`)
    }
    return
  }
  if (event.type === 'step/end') {
    p.stepEnded = true
    return
  }
  if (event.type === 'assistant/chunk') {
    if (!p.sawTurnStart) return
    const raw = (event.data ?? {}) as Record<string, unknown>
    const chunk = raw.chunk as FemoStreamChunk | undefined
    if (chunk === undefined) return
    // 直播帧全量旁路（纯 SSE 零落盘）。
    // 【0.1.3 注】本段在原生构建下恒不触发（无 assistant/chunk 会话事件），
    // 直播由 installMainActorStreamBridge 的原生帧桥承担。
    broadcastMainChunk(p, sid, typeof raw.step === 'number' ? raw.step : 0, chunk)
    return
  }
  if (event.type === 'assistant/message' || event.type === 'tool/call' || event.type === 'tool/result') {
    if (!p.sawTurnStart) return
    // 【2026-09-25 清淤】toolNames 取名表随 tool_result 停发帧一并摘除——
    // 工具卡片与结果显示由交卷 steps 经桥 EventProjector 落账。
    p.buffer.push(event)
    return
  }
  if (event.type === 'turn/end') {
    // 【2026-09-10】回合收口 → 熄灭本角色状态行（整 turn 常亮；attempt 级 end
    // 帧不熄，工具执行期不闪）。
    mainLiveFrames.get(sid)?.frames.endTurn()
    // 【2026-09-23 捕获锚定】交卷判据见上方锚点注释与 captureVerdict：
    //   干净（本轮首步 claim 吃到我们的通知、且没混真人消息）→ 交卷；
    //   认领过但脏（被别人的轮吞掉 / 混了真人消息）→ 不交卷，退回队列重投；
    //   压根没认领（子代理收口噪音开的空轮、别人的轮）→ 不是本节点的轮，继续等。
    const verdict = captureVerdict(p)
    if (verdict !== 'settle') {
      if (verdict === 'requeue') {
        requeueSwallowedInjection(ctx, resolved, sid, p,
          p.userMessageInTurn ? '本轮混入真人消息' : '注入被正在跑的轮吃掉')
        return
      }
      p.sawTurnStart = false   // 本轮跑完的模型回答不属于本节点；下轮重新判定
      debugLogMainActor(resolved, `turn/end 未见本节点通知 → 继续等: node=${p.nodeName} turn=${p.turn === undefined ? '?' : String(p.turn)}`)
      return
    }
    // 【2026-09-20 大扫除】turn/end 投影半（缓冲推送+闸门 commit）随旧链路
    // 退役——投影窗内容由 hub 供给。
    takePending(sid)
    p.settled = true
    p.resolve()
    void settleMainAnswer(ctx, session, p, bridge, resolved, projections).catch((error: unknown) => {
      debugLogMainActor(resolved, `!! 交卷异常: ${error instanceof Error ? error.message : String(error)}`)
      recordEmpty(p, bridge)
    })
    // 【2026-09-11】本节点交卷已发起（buffer 已同步取走）——若还有节点在排队
    // （主模型跟用户说话期间引擎又走到下一个 main 节点），此刻作为新一轮开头
    // 交付：FEMO内每个节点各占一轮，绝不与上一节点/用户那轮同轮。
    flushNextMainDelivery(ctx, resolved, sid)
  }
}

/** 交卷（纯引擎落库，零 UI 投影）：台词寄 speech 信进驿站，桥轮询出站喂引擎落库。
 * 【2026-09-01 猫猫拍板】v1 的 role 行灰框投影整体移除——god 窗由 god-mirror
 * 镜像天然覆盖主模型发言（重复塞入=画蛇添足）；stage/角色窗的 main 内容之后
 * 复用投影窗自己的镜像/流式逻辑另做（本轮只删 UI，轮次捕获/交卷判定保留复用）。
 * 【2026-08-31 回滚注】合成镜像组实验（speaker/showprompt/turn 骨架+内容重映射）
 * 已撤销——无 _srcSeq 的骨架事件写进了 god 窗（孤儿骨架污染上帝视角），带
 * _srcSeq 的内容反被 god 窗去重拦截（stage 长度 185→185 铁证）。god 窗里的
 * 孤儿骨架数据未清理（用户拍板：先不管窗数据）。 */
async function settleMainAnswer(
  ctx: Context,
  session: Session,
  p: PendingAnswer,
  bridge: FemoBridge,
  resolved: ResolvedConfig,
  projections?: ProjectionRegistry,
): Promise<void> {
  const { output, steps } = buildTranscript(p.buffer)
  debugLogMainActor(resolved, `交卷: node=${p.nodeName} output=${output.length}ch steps=${steps.length} buffer=${p.buffer.length}事件`)
  // 节点发言第二阶段（2026-09-16 统一）：台词寄 speech 信进驿站（系统要
  // 回答、客户发件），桥轮询出站喂引擎——与角色/人类/另一宿主同一出站口；
  // 回执=受理（posted），引擎消费在轮询后（≤0.5s），喂不进由出站口记死信。
  await bridge.send('post_speech', executorSpeechArgs({
    jobId: p.jobId, waitKey: p.waitKey, soul: p.soul, node: p.nodeName, output, steps,
  }))
}

// ── 运行结束补遗 ────────────────────────────────────────────────────────────────

function recordEmpty(p: PendingAnswer, bridge: FemoBridge): void {
  // 交卷回传本身失败（B5）：显式上报执行失败，不伪装空台词。
  void sendActorFailure(bridge, p.jobId, p.waitKey, 'deliver_error',
    '主模型回合交卷异常（回传失败）').catch(() => undefined)
}

