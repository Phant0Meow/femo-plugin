/**
 * engine-events.ts — 运行中的总调度。
 *
 * 引擎运行期间的所有钩子集中在这：
 *  1. agent/pre-step —— 门卫接线（裁决面在 pre-step-gate.ts，纯函数可测）。
 *     【2026-09-16 running-reject 退役】时机裁决权已上收驿站 delivery 字段
 *     （urgent=FEMO中当场插话/held=攒到终局放行），宿主不再持有「运行中吞注入」
 *     的判断。门卫唯一剩余职责=角色噪音过滤（整批纯机器噪音且轮首步 → 不开
 *     轮，其余一切任何时刻放行）；同关卡另办 main 暗聊补课注入（mail_catchup，
 *     只加消息不拦截，2026-09-17）。
 *  2. session/event —— 只剩主模型参与轮次捕获（mainSessionEventHook）；
 *     旧输入桥（human 转发/硬停）依赖的 user/message 事件在 pre-step
 *     reject 下从未发生过（死代码），且放行后会错误硬停FEMO脚本，已随
 *     2026-09-05 主窗口原生聊天语义删除；human 节点喂入=投影窗通道。
 *  3. 上帝窗实时镜像监听器（由 deps.godMirror 注册，保持原注册顺序）；
 *  4. femo-plugin/event 事件 switch —— 引擎每个事件的记账/黑板翻转/兜底派发。
 * 原 apply() 内联逻辑提为注册函数，依赖经 EngineEventsDeps 显式注入
 * （2026-08-23 重构，行为零变化；监听器注册顺序与原版一致）。
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { SessionId, type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { FemoBridge } from '../bridge'
import type { ResolvedConfig } from '../config'
import { broadcastSse } from '../http'
import { FEMO_PRESET, presetOf, isFemoAgent } from '../persona'
import { appendChatProjected, type ProjectionRegistry } from '../projection/projection'
import { broadcastCompat, projectedCompat } from '../projection/windowing-native'
import { type GodMirror } from '../hub/god-mirror'
// Job 域掐在飞角色：正身在公共层角色核心（原经已退役文件转手，2026-09-25 直连）。
import { abortJobSubagents } from '../../../../femo2host/host/subagent-core.mjs'
import { pushDiag } from '../diag/diag-feed'
import { actorNameOf } from '../actor-name'   // 执行者名的唯一取值口
import { hubFeedSetJob, hubHostSegCurrent } from '../hub/hub-feed'
import {
  clearMainPlayState, clearGuestActors, noteFlowLineAll,
  isMainAnswerPending, abandonMainAnswer, flushMainFinalDelta, mainSessionEventHook,
  debugLogMainActor, installMainActorStreamBridge,
} from '../main-actor'
import { LiveStreamFrames, onAssistantStreamFrames } from '../hub/stream-frames'
import { appendFemoSession } from '../state-files'
import type { NodeRetryBroker } from '../node-retry'
// 门卫裁决面（含角色噪音判定）已抽为纯函数：按「轮」裁决，见该文件头注释。
import { gatePreStep } from './pre-step-gate'
import { FEMO_PLUGIN_SOURCE } from '../compat/plugin-source'
// 停下通知的公共一半（措辞/分桶/时机规则）：信在驿站（桥产）、拼词在公共层，
// dsh 只剩投递动作（steerMainAgent）——2026-09-16 system_push 落地。
// 【2026-09-23 单通道】宿主侧拼词随 collect 兜底一并退役（终局信措辞唯一活在
// 桥产信现场/notice-core），本文件不再 import notice-core。
// 画布 SSE 通道与变量世界 API 单例（2026-09-25 解环刀迁 sse.ts）：本文件自用
// import；routes 的转口靠下方 export-from 零改动保住（该文件另有在途改动零触碰）。
import { sseChannel, variableApi } from '../sse'
// 主模型席位的两个喊话动词（2026-09-25 解环刀迁 verbs.ts）：本文件自用
// steerMainAgent（运行结束补遗）；mailbox-push/projection-input 经转口零改动。
import { steerMainAgent } from '../verbs'
// 运行态镜簿骨架（2026-09-23 批次 D 上收）：Job 镜像状态机/生命周期/推导查询
// 唯一活在公共层——本文件的六个镜像函数只剩再导出壳（消费方零改动），状态
// 变化的广播插座留在壳里（run_state/projection_state 是 dsh SSE 物理）。
import * as runStateCore from '../../../../femo2host/host/run-state-core.mjs'
import { clearActiveIfActive } from '../../../../femo2host/host/run-state-core.mjs'
// waitingHuman 快照翻译/写清唯一活在公共层（2026-09-24 B1 收编）。
import { clearMirrorWaitingHuman } from '../../../../femo2host/host/run-state-core.mjs'
// 派工体正身迁 actors/dispatch.ts（2026-09-26 刀⑥）：本文件内部只剩 4 处快照
// 广播自用（human_done/flow_done/flow_error/flow_paused），从新家进口。
import { broadcastProjectionState } from '../actors/dispatch'
// FEMO脚本状态广播词（单份化）：✅/❌/⏸ 措辞唯一权威在 notice-core。
import { PLAY_BROADCAST } from '../../../../femo2host/host/notice-core.mjs'
// 公共分诊台（2026-09-26 最后一役接入面）：记账/黑板翻转/终态清场唯一活在
// event-core——账本注入本插件的 RunState（同源），事件按 Job 镜像反查归属，
// 行显示裁决全交还本文件（dsh 的行归桥 EventProjector 与自绘窗，见 verbs 全
// no-op + board no-op）。skip 名单=宿主自有语义整事件接管。
import { createEventCore } from '../../../../femo2host/host/event-core.mjs'

// 转口（2026-09-25 解环刀）：消费方 import 路径零改动——sseChannel 供
// routes /events（connect 入座）、两个喊话动词供 mailbox-push/projection-input。
export { sseChannel } from '../sse'
export { steerMainAgent, followupMain } from '../verbs'
// 转口（2026-09-26 刀⑥）：派工体迁 actors/dispatch.ts——mailbox-push 从这里拿
// dispatchActorTurn/applyHumanWait（零改动）；projectionStateOf/broadcastProjectionState
// 的五个消费方（run-control/bridge-supervisor/routes×3）同享此转口。
export {
  dispatchActorTurn, applyHumanWait, projectionStateOf, broadcastProjectionState,
} from '../actors/dispatch'

/** 变量世界→画布 SSE 接线幂等闸（registerEngineEventHandlers 每进程一次，闸防双订阅）。 */
let variableCanvasWired = false

// 【cp 诊断】到达时刻打点（Job 模型：断点已由引擎落盘，此处只剩到达观测）。
const diagTs = (): string => new Date().toISOString().slice(11, 23)

/** 角色子代理流出的「噪音消息」判定已迁 pre-step-gate.ts（门卫裁决面同处）。 */
/** 两个喊话动词（steerMainAgent/followupMain）已迁 verbs.ts（2026-09-25 解环刀，
 *  定义与完整出处注释见该文件；上方 export-from 转口保消费方零改动）。 */
/** 角色派工体（dispatchActorTurn/applyHumanWait）与投影快照广播两小件
 *  （projectionStateOf/broadcastProjectionState）已迁 actors/dispatch.ts
 *  （2026-09-26 刀⑥，纯搬家；转口见上方 export-from）。 */

/** 主模型补课便签头（2026-09-17 mail_catchup，who_require=客户索要）：main
 *  暗聊时随用户消息注入的「错过进展」材料措辞。契约：先接进展再回用户、
 *  不复读全文、材料只有 main 可见。 */
const MAIN_CATCHUP_NOTE_PREFIX = '【后台补课】以下是「你上次登台发言 → 现在」你错过的剧情进展（本材料只有你能看到）。用户正在和你交谈：先消化下面的进展再回应用户，不要原文复述这份材料。\n\n'

/** Job 镜像（Job 模型，运行状态链路重构 §6.2）：一个 Job 的宿主侧显示面
 *  簿记。状态权威在引擎 runs/<job_id>.json，宿主只是翻译层+索引——镜像
 *  三收敛源（§八.11）：①job_start/job_resume 命令成功回执（prearm，最早
 *  证据）②引擎事件到达（correct/setState 校正）③进程死亡（onExited 清账）。
 *  nodeActors/nodeScopes/nodeShowprompts 随 Job 生灭——同一节点名跨 Job
 *  复用是 A4 串台的一半病根，此处根治。 */
export interface JobMirror {
  jobId: number
  ownerSid: string
  state: 'running' | 'suspended' | 'finished' | 'failed'
  /** 引擎等待人类输入快照（human_wait SET / human_done 清）。全量字段
   *  （上下文/提示/出参）供 /session-state 带回前端——刷新页面后按此恢复
   *  画布人类输入气泡（SSE 重放环可能已把该事件挤出去，这里是权威兜底）。 */
  waitingHuman?: {
    waitKey: string
    nodeName?: string
    context?: string
    memory?: string
    showprompt?: string
    prompt?: string
    outVars?: string[]
    /** 等待节点的投影 scope（引擎 human_wait 事件自带，到达时现场冻结）。
     *  【2026-09-08 角色窗按钮不亮根因】旧实现事后查 nodeScopes 表——该表按
     *  节点名收纳 node_start 的 scope，par 并发（投票/上警的 par 分支共享同名
     *  节点）时同键互相覆盖、最后到达者胜：人类分支不经 LLM 通常最先进入等待，
     *  随后 AI 分支的 node_start 把 scope 覆盖成 AI 的（如 [@上帝,@小机]）→
     *  waitScope 永不含人类角色 → 角色窗按钮恒灰、切窗重挂拉到的仍是坏值
     *  （上帝/FEMO内窗只看 waiting 布尔不受影响——正是「只有人类角色窗坏」的
     *  症状）。冻结快照免疫并发覆盖。 */
    waitScope?: string[]
  }
  nodeActors: Map<string, string>
  nodeScopes: Map<string, string[]>
  nodeShowprompts: Map<string, string>
  /** 脚本错误/警告攒桶职能已上收驿站（2026-09-16 system_push 落地）：桥在
   *  事件现场产信（错误/警告=滞留件，终局=急件），停下时刻宿主经桥代取
   *  （collect_notices）拿整包——宿主不再自建内存桶（原先 giveups/warnings
   *  双轨就是与驿站滞留件平行的第二套攒桶）。 */
}

/** 引擎运行状态簿记（index.ts 总装创建唯一实例，全插件共享引用）：
 *  jobs=Job 镜像表；sidIndex=sid → 最近 Job（currentJobId 内存镜像，单值够用
 *  ——消费方只关心活跃/最近 Job）；sessionActors/errors 保留 sid 键
 *  （视角菜单重启回退 / 错误面板跨 Job 历史 / SSE 重放——信封带 sid 后前端
 *  自行过滤）。 */
export interface RunState {
  jobs: Map<number, JobMirror>
  sidIndex: Map<string, number>
  /** 引擎活跃 Job（全引擎同时至多一个；引擎排他裁决的镜像）。 */
  activeJobId?: number
  /** Per-session script actors (flow_start) for the view-perspective menu. */
  sessionActors: Map<string, string[]>
  /** Per-session engine errors (meta info for the Femo script panel). */
  errors: Map<string, Array<{ ts: number; text: string }>>
  /** 【2026-09-23 十连裁②⑩ 单通道】四本已办簿（pushedMainBriefs/ActorBriefs/
   *  HumanWaits/StopNotices）整体退役：push 是唯一通道（事件侧无兜底派工、
   *  停下通知无 collect 兜底），一次产信恰一次投递，无可去重之事；送失的信
   *  由投递员重投（mail_courier.retry_pending，pending_urgent 年龄门槛防双投）
   *  ——邮差扑空修邮差。 */
}

/** 重放缓冲写入（2026-09-22 委托公共层）：环/短命帧过滤/checkpoint 原地
 *  替换/_CAP400 唯一活在 femoGenConnector/sse-core.mjs（rememberEvent v8.1/v9
 *  的语义原样收口——Job784 冲环与走马灯教训见该文件头）。
 *  【2026-09-25】runState.lastEvents 兼容字段已删。 */
function rememberEvent(eventType: string, data: unknown): void {
  sseChannel.remember(eventType, data)
}

// ── Job 镜像 helper（落本文件不造新组件文件，提案 §七）────────────────────

/** 命令成功回执即调（§八.11：引擎已接受的最早证据）——pre-step 守卫在
 *  flow_start 到达前的秒级窗口不再裸奔。 */
export function jobMirrorPrearm(runState: RunState, jobId: number, ownerSid: string): void {
  runStateCore.jobMirrorPrearm(runState, jobId, ownerSid)
}

/** flow_start 到达校正（幂等）：镜像未登记（理论不可达，防御）则补建。 */
export function jobMirrorCorrect(runState: RunState, jobId: number, ownerSid: string): void {
  runStateCore.jobMirrorCorrect(runState, jobId, ownerSid)
}

/** 终态/校正统一入口：每次 state 真变化伴生 run_state 快照广播（v1 吸收——
 *  前端显示者数据源=快照事件，B7 死于结构：不再有本地兜底覆盖）。变化判定
 *  在核心（run-state-core），本壳只剩广播插座。 */
export function jobMirrorSetState(runState: RunState, jobId: number, state: JobMirror['state']): void {
  if (runStateCore.jobMirrorSetState(runState, jobId, state) === 'changed') {
    const mirror = runState.jobs.get(jobId)
    if (mirror !== undefined) broadcastSse('run_state', { sid: mirror.ownerSid, job_id: jobId, state })
  }
}

/** running→终态：清活跃指针（镜像本身保留供 /session-state 等消费）。 */
export function jobMirrorClear(runState: RunState, jobId: number): void {
  if (runStateCore.jobMirrorClear(runState, jobId) === 'changed') {
    const mirror = runState.jobs.get(jobId)
    if (mirror !== undefined) broadcastSse('run_state', { sid: mirror.ownerSid, job_id: jobId, state: 'suspended' })
  }
}

/** 本会话绑定的 Job 是引擎活跃 Job？（pre-step 守卫判定源——现状
 *  "running && owner 匹配"的 Job 化等价改写。） */
export function isSessionRunning(runState: RunState, sessionId: string): boolean {
  return runStateCore.isSessionRunning(runState, sessionId)
}

/** 会话的活跃/最近 Job 镜像（routes/projection-input/tools 消费）。 */
export function activeJobOfSession(runState: RunState, sessionId: string): JobMirror | undefined {
  return runStateCore.activeJobOf(runState, sessionId) as JobMirror | undefined
}

export interface EngineEventsDeps {
  resolved: ResolvedConfig
  bridge: FemoBridge
  runState: RunState
  sessionsStore?: { get(id: SessionId): Session | undefined }
  projections: ProjectionRegistry
  godMirror: GodMirror
  defaultModel?: { currentSelection(): unknown }
  recordError(sessionId: SessionId, text: string): void
  /** 停靠经纪人（v4 §8.1）：node_retry/notify_author/node_settled 三信号的
   *  接收端；human_wait 时登记 human 租约。缺省 no-op+log（可测性）。 */
  broker?: NodeRetryBroker
}

export function registerEngineEventHandlers(ctx: Context, deps: EngineEventsDeps): void {
  const { resolved, bridge, runState, sessionsStore, projections, godMirror, recordError, broker } = deps

  // 0.5) 公共分诊台（2026-09-26 最后一役接入面）：记账（noteNode*）/黑板翻转
  //     （setState/clearActive/clearWaiting）唯一活在 event-core——账本注入
  //     本插件的 RunState（同源，routes/mailbox-push 等消费方读同一份）。
  //     skip 名单=宿主自有语义整事件接管：flow_start（cwd 守卫/建窗/会话档案
  //     全是 dsh 会话物理面）、human_wait（快照唯一登记权在驿站投递员的
  //     applyHumanWait——料包信先到、全量快照先立，事件若再登会把薄快照覆到
  //     全量上）、ai_done（无公共记账，role 行=下方 dsh 物理 case）、checkpoint/
  //     bridge_run_ended/node_retry/node_settled/notify_author（核心无账可记，
  //     动作全在下方 case）。verbs/board：dsh 的行显示归桥 EventProjector
  //     （随段落账）与下方 switch 的自绘窗广播——verbs 全体不落行，唯独三个
  //     终局收「真变化」信号点亮 run_state SSE 广播插座（原 jobMirrorSetState
  //     包装的语义原样搬进 verbs：状态翻转在核心、广播是 dsh SSE 物理）。
  const broadcastRunStateChange = (jobId: number | undefined, changed: boolean, state: JobMirror['state']): void => {
    if (!changed || jobId === undefined) return
    const mirror = runState.jobs.get(jobId)
    if (mirror !== undefined) broadcastSse('run_state', { sid: mirror.ownerSid, job_id: jobId, state })
  }
  const triage = createEventCore({
    store: runState,
    resolveSid: (jobId) => {
      const mirror = runState.jobs.get(jobId)
      return mirror !== undefined ? String(mirror.ownerSid) : ''
    },
    board: { ensureWindows: () => {}, chat: () => {} },
    verbs: {
      playDone: (d, changed) => broadcastRunStateChange(typeof d.job_id === 'number' ? d.job_id : undefined, changed, 'finished'),
      playError: (d, _detail, changed) => broadcastRunStateChange(typeof d.job_id === 'number' ? d.job_id : undefined, changed, 'failed'),
      playPaused: (d, changed) => broadcastRunStateChange(typeof d.job_id === 'number' ? d.job_id : undefined, changed, 'suspended'),
    },
    skip: ['flow_start', 'human_wait', 'ai_done', 'checkpoint',
           'bridge_run_ended', 'node_retry', 'node_settled', 'notify_author'],
  })

  // 0) 变量世界 → 画布 SSE（2026-09-24 接线）：十连裁⑤把三事件从通用代播摘除
  //    时判了「浏览器零消费」——实际画布 func/assign 节点的 In/Out 气泡面板
  //    （ns.ins/ns.outs）正是 input/output 的消费方，Femo 编辑器拿不到变量值
  //    即此断点。此处按 Variable API 定向供给画布：新事件名 variable_record，
  //    func/assign 档位 full（In 面板吃 input 入参）；checkpoint 一并上线
  //    （2026-09-23 用户令「画布上会显示断点」）：brief 档=位置+label 出线、
  //    变量世界整包 state 不外发——画布断点/当前节点高亮的活供给（此前断点
  //    显示只靠 /session-state 拉）。信封补 sid（画布按会话过滤）与 job_id
  //    （画布 Job 跟随）；环内重放与旧引擎事件同权（刷新后 In/Out 面板不丢）。
  if (!variableCanvasWired) {
    variableCanvasWired = true
    variableApi.subscribe('full', (record) => {
      // checkpoint：按裁参数化取 brief 视图（state 整包不出线）；func/assign
      // 保持 full（In 面板吃 input）。
      const out = record.kind === 'checkpoint' ? variableApi.toView(record, 'brief') : record
      const mirror = typeof out.jobId === 'number' ? runState.jobs.get(out.jobId) : undefined
      const envelope = {
        ...out,
        job_id: out.jobId,
        ...(mirror !== undefined ? { sid: mirror.ownerSid } : {}),
      }
      broadcastSse('variable_record', envelope)
      rememberEvent('variable_record', envelope)
    })
  }

  // 1) Femo sessions: idle → main model runs normally (dsh default);
  //    running → reject (the engine owns the conversation), except main-node
  //    injections and real user input (main-window native chat semantics).
  //    【2026-09-11 修】裁决面全部落在轮首步（step=1）：dsh 的 pre-step 每步都
  //    跑，reject = 整个 turn 以 blocked 收场——按步裁决会让轮首步已放行的
  //    回合在工具续跑步被砍掉（主模型只调得动一轮工具）。裁决口径与理由见
  //    pre-step-gate.ts 文件头；这里只做接线（agent 判定 + 两个事实源查询）。
  ctx.on('agent/pre-step', async ({ agent, messages, step, signal }, next): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision === undefined || signal.aborted) return decision
    if (decision.kind !== 'enter') return decision
    // 【2026-09-19 取消限制】非 FEMO 会话启动运行期间同样要过门卫（引擎 owns 对话/
    // 用户插话放行/角色噪音过滤/补课），判定依据从 preset 放宽为「有活跃 Job」。
    if (!isFemoAgent(agent) && !isSessionRunning(runState, String(agent.session.id))) return decision
    const sid = String(agent.session.id)
    const gated = gatePreStep({
      messages: decision.messages,
      step,
      mainAnswerPending: isMainAnswerPending(sid),
      running: isSessionRunning(runState, sid),
      tag: sid,
    })
    if (gated.kind !== 'enter') return gated
    // ── 主模型补课（2026-09-17 mail_catchup，who_require=客户索要）────────
    // FEMO running 中用户在主窗口与 main 暗聊：轮首步且批次含真实用户消息时，
    // 同步向驿站索取「main 上次登台→现在」的可见增量（宿主主动要，非
    // system_require 的FEMO中喊话），随用户消息同一轮注入——main 接得住最新
    // 剧情。引擎回空串（main 不在戏里/无新进展）不注入；桥不在/索取失败不
    // 挡轮（暗聊永远可用，补课是尽力而为）。工具续跑步（step>1）与插件注
    // 入轮不触发。
    if (step === 1 && isSessionRunning(runState, sid)
        && gated.messages.some(m => m.source?.kind === 'user')) {
      const jobId = runState.sidIndex.get(sid) ?? runState.activeJobId
      if (jobId !== undefined) {
        try {
          const res = await bridge.send('mail_catchup', { job_id: jobId }, 15_000) as { text?: string } | undefined
          const text = typeof res?.text === 'string' ? res.text.trim() : ''
          if (text.length > 0) {
            // 补课便签（消息形状与 steerMainAgent 同款），插在批次末尾那条
            // next-turn 用户消息之前——先看进展，再听用户说话。
            const note = {
              id: randomUUID(),
              role: 'user',
              content: [{ type: 'text', text: MAIN_CATCHUP_NOTE_PREFIX + text }],
              source: FEMO_PLUGIN_SOURCE,
            } as unknown as (typeof gated.messages)[number]
            const admitted = gated.messages.slice()
            admitted.splice(Math.max(admitted.length - 1, 0), 0, note)
            console.log(`[femo-plugin] main catchup injected: job=${jobId} ctx=${text.length}ch`)
            return { kind: 'enter', messages: admitted }
          }
        } catch (error) {
          console.log(`[femo-plugin] main catchup skipped: ${String(error instanceof Error ? error.message : error)}`)
        }
      }
    }
    return gated
  })

  // 2) Session event hook: main-actor answer capture only.
  //    【2026-09-05 语义拍板】主窗口回归 dsh 原生聊天——运行中用户消息随放行
  //    的回合自然落盘、主模型原生回答。旧输入桥（human 转发 / main 在飞留
  //    inbox / 硬停）依赖的 user/message 事件在 pre-step reject 时代从未发生
  //    （门卫在 claim 时已把消息丢弃；dsh interception.spec 实证 reject 后
  //    user/message === false），三分支全是死代码；用户批次放行后若保留反而
  //    会错误触发硬停。human 节点的喂入通道=投影窗（projection-input ②）。
  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    // 【2026-09-19 取消限制】非 FEMO 会话启动运行期间主模型交卷捕获也要工作；
    // 无活跃 Job 且无在飞交卷时提前返回，普通会话事件零开销直通。
    if (presetOf(session) !== FEMO_PRESET
        && !isSessionRunning(runState, String(session.id))
        && !isMainAnswerPending(String(session.id))) return
    if (session.header.parentSession !== undefined) return // subagent sessions
    // 主模型参与轮次捕获（main 节点在飞时缓冲回答事件、turn/end 交卷）。
    mainSessionEventHook(ctx, session, event, bridge, resolved, projections)
  })

  // 3) 实时镜像监听器（原 apply 内联位置：输入桥之后、事件 switch 之前——
  //    保持注册顺序不变）。
  godMirror.registerRealtimeListener(ctx)

  // 3.4)【步3 2026-09-11】主 Agent 轮的开轮锚点**不在这里写**了。
  //      踩坑实录（Job 795/796）：装配器硬规矩「start 必须是该 context 收到的
  //      第一个事件」，而 god-mirror 会把主会话 turn/start 先镜像进上帝窗——锚晚
  //      一步就抛 `received an update before its start Match`、整轮装配失败。
  //      ⚠️ 把钩子"注册在 god-mirror 之前"**不管用**：实测 ctx.on 的执行顺序不
  //      保证等于注册顺序（前移后锚仍晚一位）。顺序只能由同一段代码保证，故锚已
  //      移入 god-mirror 的 mirrorMainEventToGod——写 turn/start 之前先补锚。

  // 3.5) 主Agent直播（2026-08-25 方案B Step2）：主模型在上帝窗的发言此前要等
  //      assistant/message 整块落地（MIRROR 白名单不含 chunk）。这里把主会话
  //      chunk 旁路广播成 femo_stream（actor='主Agent'），前端在上帝窗最新一条用
  //      户消息节点下自绘打字机。只对存在投影窗的 Femo 会话生效；纯 SSE 零落
  //      盘，不写事件、不动 MIRROR 白名单与水位。
  // 3.5) 主Agent回合收口（原「主Agent chunk 旁路」已随旧链路退役——0.1.3 无
  //      assistant/chunk 会话事件、femo_stream 打字机唯一来源=hub 草稿，
  //      2026-09-20 大扫除删净）。只保留一件实事：主会话 turn/end →
  //      主Agent直播位熄灭（与 3.6 帧桥配套；endTurn 现只剩 trace+hub 空收口，
  //      接缝保留）。
  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    if (session.header.parentSession !== undefined) return
    if (event.type === 'turn/end') directorLive.get(String(session.id))?.frames.endTurn()
  })

  // 3.6) 0.1.3 原生流帧桥（2026-09-10）：0.1.3 起模型增量不再是会话事件
  //      （assistant/chunk 已不在 KNOWN_SESSION_EVENT_TYPES，改走 agent 级瞬时
  //      帧 agent/assistant-stream）——上面 3.5 与 main-actor 的 chunk 分支在
  //      原生构建下恒不触发=投影窗失去打字机。这里按同一 femo_stream 词汇转出
  //      原生帧：主Agent流（上帝窗）与主模型参与运行（stage/角色窗）各一座桥。两条
  //      chunk 路径与帧桥互斥（旧版无本帧、0.1.3 无 chunk 事件），不重复广播。
  const directorLive = new Map<string, { turn: number | undefined; seg: string; frames: LiveStreamFrames }>()
  onAssistantStreamFrames(ctx, ({ agent, frame }) => {
    if (frame === undefined) return
    if (agent?.session?.header?.parentSession !== undefined) return // subagent sessions
    const sid0 = String(agent?.session?.id ?? agent?.id ?? '')
    if (sid0.length === 0) return
    // 【2026-09-20 会话账本】录制不再要求 projections 里有 god 窗
    // （旧闸门会让「从未开过戏的会话」的主Agent流进不了会话账本——而会话寻址帧
    // 本就不看 currentJob）。下面的 hubHostSegCurrent 仍兜底：没开着宿主轮
    // 容器（=FEMO内轮，字归引擎令牌那条路）一个字都不喂，归属不乱。
    // 【2026-09-23】非 FEMO 会话整条直投链在 god-mirror 监听入口拦死（用户
    // 拍板「非 FEMO 会话不发」）——容器根本不开，这里天然静默，无需另设闸。
    // 【2026-09-19 用户拍板「hub 两边都收、收下来一个样」】导演流也是往**容器**里
    // 喂字，不再走打字桶：容器 = god-mirror 在 user 发言那拍开的那个宿主轮
    // （hubHostSegCurrent）。没开着容器（= 这是FEMO内轮：角色/main 参与运行的字由它们
    // 自己那条路带 wait_key 喂）就一个字都不喂——位置与归属都归容器说了算。
    const seg = hubHostSegCurrent(sid0)
    if (seg === undefined) return
    // 【步3 2026-09-11】主Agent流补轮次维度：帧自带主会话原生 turn → 前端按
    // (sid, turn) 入桶，主 Agent 打字机归自己那一轮（旧实现无轮次维度，只能挂
    // "最新锚点"，于是插在角色块中间）。turn 变了换新直播位——一轮一个位。
    const turn = typeof frame.turn === 'number' ? frame.turn : undefined
    let live = directorLive.get(sid0)
    if (live === undefined || (turn !== undefined && live.turn !== turn) || live.seg !== seg) {
      live = {
        turn,
        seg,
        frames: new LiveStreamFrames({
          // 主Agent流喂的是**宿主自造的整键**（h:<sid>:<seq>）——必须走 segRef：
          // 塞进 ref 会被 hub 当成引擎令牌再套一层 'w:'，字就落进幻影段了
          // （2026-09-19：ref=令牌 / segRef=整键 两个字段语义互斥，见 hub-feed.ts）。
          sid: sid0, node_name: '', actor: '主Agent', segRef: seg,
          ...(turn !== undefined ? { turn } : {}),
        }),
      }
      directorLive.set(sid0, live)
    }
    live.frames.frame(frame)
  })
  installMainActorStreamBridge(ctx)

  // 4) Event bridge: engine events -> chat messages on the run's session.
  //    【Job 模型 §6.2】入口解信封：事件自带 job_id（bridge make_event_callback
  //    注入），按 mirror 反查归属会话——A4 死于结构（事件认 Job，跨会话不串台）。
  ctx.on('femo-plugin/event', (eventType: string, data: unknown) => {
    if (eventType === 'flow_start') console.log(`[femo-plugin][diag] flow_start event received; activeJobId=${String(runState.activeJobId ?? '-')}`)
    const d0 = (data ?? {}) as Record<string, unknown>
    // 变量世界三事件改走 Variable API（归一+进程内订阅分发），不再通用代播。
    const onVariableBus = variableApi.handles(eventType)
    if (onVariableBus) variableApi.ingest(eventType, d0)
    const jobId = typeof d0.job_id === 'number' ? d0.job_id : undefined
    hubFeedSetJob(jobId ?? null)  // 投影中心：当前场次登记（直播帧旁路的 job 归属）
    const mirror = jobId !== undefined ? runState.jobs.get(jobId) : undefined
    if (jobId === undefined || mirror === undefined) {
      // 防御（§6.2.1）：jobId 缺失或 mirror 未登记 → log + 仅透传 broadcast +
      // return。重启后 bridge 新进程不会为旧 suspended Job 发事件，此路理论
      // 不可达；真到达也绝不路由到错误会话。
      // 【诊断 2026-09-06】此早退=human_wait 无法 SET waitingHuman 的候选断点
      // 之一（事件到了宿主但找不到归属 mirror）——落诊断流可观测。
      pushDiag('ev-in', `${eventType} DROPPED(no-mirror) job=${String(d0.job_id ?? '-')}`)
      if (eventType === 'flow_start') console.log('[femo-plugin][diag] flow_start without mirror: broadcast only')
      console.log(`[femo-plugin] event ${eventType} without mirror (job_id=${String(d0.job_id ?? '-')}); broadcast only`)
      if (!onVariableBus) {
        broadcastSse(eventType, data)
        rememberEvent(eventType, data)
      }
      return
    }
    const sessionId = SessionId(mirror.ownerSid)
    // broadcastSse 载荷统一包信封（A4 前端过滤地基）。变量世界三事件不走这里
    // （2026-09-23 十连裁⑤：Variable API 供给）——画布的 func/assign 消费面
    // 由 variable_record 定向接线补回（见本函数顶部），checkpoint 保持不上线。
    const envelope: Record<string, unknown> = { ...d0, sid: mirror.ownerSid, job_id: jobId }
    if (!onVariableBus) {
      broadcastSse(eventType, envelope)
      // 事件缓冲：SSE 新连接（运行中打开编辑器标签）先重放已发生的事件。
        rememberEvent(eventType, envelope)
    }
    const session = sessionsStore?.get(sessionId)
    if (session === undefined) {
      // [femo-diag] 此早退在 broadcastSse 之后：帧已发给前端，但 mem 不更新。
      // 【诊断 2026-09-06】同样=human_wait SET 不上的候选断点（session 不在
      // store）——此前除 flow_start 外完全静默。
      pushDiag('ev-in', `${eventType} DROPPED(no-session) job=${jobId} sid=${String(sessionId)}`)
      if (eventType === 'flow_start') console.log(`[femo-plugin][diag] flow_start broadcast done but DROPPED before sessionActors.set: session ${String(sessionId)} not in store`)
      return
    }
    // 【诊断 2026-09-06】事件通过全部早退=即将进入 switch（对照 bridge 层的
    // event 记录：两处都有=分发链完整；bridge 有此处无=在这两段之间丢失）。
    // 【2026-09-26 顺修】此诊断原引用下方才声明的 d（TDZ 隐患：human_wait
    // 一到就 ReferenceError）——改用顶部 d0，声明提前一并落定。
    if (eventType === 'human_wait' || eventType === 'human_done') {
      pushDiag('ev-in', `${eventType} dispatched job=${jobId} wait_key=${String(d0.wait_key ?? '-')}`)
    }
    // 公共分诊先行（最后一役）：记账/黑板翻转/终态清场在核心；本 switch 只剩
    // dsh 物理动词（SSE/自绘窗/主模型参与运行/派工清场）。核心没账可记的事件
    // （skip 名单）原样落进下方 case。context_ready 的执行者名在绑定层归一化
    // （actorNameOf 新名优先/旧名兼容——核心只认新字段，宿主方言翻译官职责）。
    triage.handleEvent(eventType, eventType === 'context_ready' ? { ...d0, actor_name: actorNameOf(d0) } : d0)
    const d = d0
    switch (eventType) {
      case 'flow_start': {
        // Script actors feed the view-perspective menu + projection windows.
        const actors = Array.isArray(d.actors)
          ? d.actors.filter((x): x is string => typeof x === 'string')
          : []
        runState.sessionActors.set(String(sessionId), actors)
        // 主模型参与运行状态清场 + 记FEMO脚本名 + 登记 main 角色静态名单（编译期声明）。
        clearMainPlayState(
          String(sessionId),
          typeof d.name === 'string' ? d.name : '',
          Array.isArray(d.main_actors) ? d.main_actors.filter((x): x is string => typeof x === 'string') : [],
        )
        // 客串角色残留清理（cast 泛化）：上一次绑定会话的登记/流水/水位——
        // 保护所有在跑 Job 的 owner（并行运行互不误删），绑定 sid 派工时重登。
        clearGuestActors([...runState.jobs.values()].map(m => m.ownerSid))
        console.log(`[femo-plugin][diag] flow_start processed: sessionActors[${String(sessionId)}]=${JSON.stringify(actors)} (femoSession=${String(d.session_id)})`)
        // flow_start 到达校正（§6.2.3，幂等）：prearm 已登记则零操作。
        jobMirrorCorrect(runState, jobId, String(sessionId))
        // 引擎场次身份入账本：dsh 会话 ↔ femo 场次一对多（末位=当前场次）。
        if (typeof d.session_id === 'number') {
          void appendFemoSession(resolved.femoRoot, String(sessionId), d.session_id)
            .catch((error: unknown) => console.log(`[femo-plugin] femoSessions append failed: ${String(error)}`))
        }
        // 上帝窗无条件创建（actors 为空的脚本也要有引擎通知的落点）；
        // 角色窗按FEMO脚本角色。幂等创建/复用/冷唤醒；异步，失败仅打日志。
        // 【cwd 守卫】与 routes.ts projection-windows 同款：主会话 cwd 缺失时
        // 不建窗——cwd 绝不能落到 process.cwd()，否则投影窗建进宿主启动目录
        // 分组 → duplicate session id 整树拒绝加载（2026-08-23 事故定案原则：
        // 分组键绝不允许环境兜底）。同会话 header.cwd 要么一直有要么一直无，
        // 守卫跳过不会误伤"registry 已有窗"的复用场景。
        const header = session.header as { cwd?: string } | undefined
        debugLogMainActor(resolved, `[宿主] flow_start 建窗检查: cwd=${header?.cwd ?? '无'} actors=${JSON.stringify(actors)}`)
        if (header?.cwd === undefined || header.cwd.length === 0) {
          console.log(`[femo-plugin] flow_start ${String(sessionId)}: session cwd missing — projection windows NOT ensured (process.cwd() fallback forbidden)`)
          break
        }
        // 【2026-09-09 晚改版】新旧版行为归一：god/stage/角色投影窗全建。
        // 0.1.3 原生版同样恢复 femo-proj 角色窗——角色内容由 subagent-native
        // 把常驻执行体子代理的镜像事件按 scope 投进来（子代理窗只是执行体，
        // 显示面回归 femo 自绘投影窗；femo-actor 子代理在目录里重新 ban）。
        void projections.ensure(String(sessionId), actors, header.cwd).then(() => {
          debugLogMainActor(resolved, `[宿主] flow_start ensure 完成: ${JSON.stringify(actors)}`)
        }).catch((error: unknown) => {
          debugLogMainActor(resolved, `!! flow_start ensure 失败: ${error instanceof Error ? error.message : String(error)}`)
          console.log(`[femo-plugin] flow_start ensure projection windows failed: ${String(error)}`)
        })
        // 【2026-09-20 大扫除】god-mirror 水位补齐调用随镜像半边退役——
        // 上帝窗「打开即全」由 hub 账本 + hub-view 代理承担。
        break
      }
      case 'node_start': {
        // 节点视野登记走公共分诊台（最后一役）；human/notice 节点的 📢 提示行
        // 写入已删（2026-09-20 大扫除）——showprompt 显示由桥 EventProjector
        // 的 prompt 槽承担（随段落账）。
        break
      }
      case 'context_ready': {
        // 角色名/showprompt 登记走公共分诊台（最后一役）。旧「无 node_name
        // 立即落盘」兜底随死写入删除（2026-09-20 大扫除）——显示由桥 prompt
        // 槽承担。
        break
      }
      case 'human_wait': {
        // 【2026-09-23 十连裁② 单通道】登记唯一在投递员（mailbox-push 收信 →
        // applyHumanWait 显示给人类看，快照/广播/租约全在登记体里）——本事件
        // 退为记账：到达即留痕，不再兜底登记（邮差扑空修邮差）。
        console.log(`[femo-plugin] human_wait received (bookkeeping; apply via mailbox-push): job=${jobId} node=${String(d.node_name ?? '-')} wait_key=${String(d.wait_key ?? '-')}`)
        pushDiag('human_wait', `ARRIVE job=${jobId} node=${String(d.node_name ?? '-')} wait_key=${String(d.wait_key ?? '-')}`)
        break
      }
      case 'human_done': {
        // waitingHuman 清空走公共分诊台（最后一役）。【诊断 2026-09-06】到达
        // 即留痕（输入被引擎消费：正常输入/空输入超时放行均走此信号）。
        console.log(`[femo-plugin] human_done received: job=${jobId} -> waitingHuman CLEARED`)
        pushDiag('human_done', `CLEARED job=${jobId} (输入被引擎消费：正常输入/空输入超时放行均走此信号)`)
        broadcastProjectionState(runState, String(sessionId))
        break
      }
      case 'checkpoint': {
        // 断点已由引擎落盘（Job 模型 §6.2.4）：runs/<job_id>.json 经
        // JobManager.merge_checkpoint 原子写（A3/C5 死于结构）——宿主不再
        // 持久化 resume 块。保留到达观测日志。
        const cp = (d.checkpoints ?? {}) as Record<string, string>
        console.log(`[femo-cp-diag ${diagTs()}] checkpoint ARRIVE sid=${String(sessionId)} job=${jobId} cps=${JSON.stringify(cp)} femoSession=${String(d.session_id ?? '-')} 断点已由引擎落盘`)
        break
      }
      case 'ai_done': {
        // dsh 后端模式：回答已由子代理事件镜像（原生 assistant 节点）显示，
        // 这里不再自绘 role 行；llmBridge 直连模式无镜像，role 行是主会话
        // 唯一显示面（alsoMainSession=true 双写）。
        // main 可见流水记账（主模型参与运行）：该节点 scope 含 main 角色时入流水。
        {
          const doneNode = typeof d.node_name === 'string' ? d.node_name : undefined
          const doneOutput = typeof d.output === 'string' ? d.output : ''
          if (doneNode !== undefined) {
            const doneActor = mirror.nodeActors.get(doneNode) ?? doneNode
            const doneScopes = mirror.nodeScopes.get(doneNode)
            // 【2026-09-25 泛化】全场会话执行体角色记账：owner 的 main 之外，
            // 绑定会话角色（noteMainActor 登记者）各自维护窗口流水——按 scope
            // 自动判定（isMainVisible），发言者本人不入（台词天然在窗口历史）。
            const counted = noteFlowLineAll(doneActor, doneOutput, doneScopes)
            debugLogMainActor(resolved, `[宿主] ai_done 记账: node=${doneNode} actor=${doneActor} out=${doneOutput.length}ch scopes=${JSON.stringify(doneScopes ?? null)} → 会话角色入账=${counted}`)
          }
        }
        if (resolved.hostAiBackend) break
        const output = typeof d.output === 'string' && d.output.length > 0 ? d.output : undefined
        if (output !== undefined) {
          const nodeName = typeof d.node_name === 'string' ? d.node_name : undefined
          const actor = nodeName === undefined ? undefined : mirror.nodeActors.get(nodeName) ?? nodeName
          projectedCompat(ctx, session, projections, output, 'role', actor, nodeName === undefined ? undefined : mirror.nodeScopes.get(nodeName), true)
        }
        break
      }
      case 'ai_request': {
        // 【2026-09-23 十连裁② 单通道】派工唯一在投递员（mailbox-push 收信 →
        // source=main 走 runMainModelTurn / 其余 dispatchActorTurn）——节点视野
        // 登记走公共分诊台（最后一役），本 case 只剩到达日志。
        console.log(`[femo-plugin] ai_request received (bookkeeping; dispatch via mailbox-push) node=${String(d.node_name ?? '')} source=${String(d.source ?? '-')} wait_key=${String(d.wait_key ?? '')} job=${jobId}`)
        break
      }
      case 'flow_done': {
        console.log(`[femo-cp-diag ${diagTs()}] flow_done ARRIVE sid=${String(sessionId)} job=${jobId} → Job finished（断点作废由引擎 finalize 承担）`)
        // 镜像 finished + 清活跃指针走公共分诊台（最后一役）。
        broadcastProjectionState(runState, String(sessionId))
        // 结局通知全窗广播（主会话+god+角色窗统一可见，2026-08-23 通知统一改造）；
        // 措辞唯一权威=notice-core.PLAY_BROADCAST（2026-09-23 单份化）。
        broadcastCompat(ctx, session, projections, PLAY_BROADCAST.done)
        // 主模型参与运行：运行结束补遗——把剩余未注入的 main 可见发言补进主窗口
        // （有则发；main 的台词天然在主窗口历史里，无需日记）。
        flushMainFinalDelta(ctx, sessionId, resolved)
        // 跑完通知的 steer **不在此处**（2026-09-10 猫猫拍板）：挪到
        // bridge_run_ended（整场真正终止）再发。理由：flow_done 是"引擎逻辑
        // 完成"这个过早的窗口，此刻角色子代理的 settled 通知还在飞，steer 会
        // 以 next-step 投递、被 settled 通知开的空 turn 吃掉而滞留（Job 761
        // 实证：通知拖到用户下一条消息才随新 turn 的 step1 送达，主模型不
        // 醒来）。桥侧同款对齐：跑完急件也在 bridge_run_ended 才产（信到即取
        // 无竞态）。
        break
      }
      case 'flow_error': {
        // 【Job 域清场（§6.2.8，§八.4 域化）】只掐本 Job 的在飞角色——
        // 全场 abortActiveSubagents 会误杀 B 会话在飞角色（B 的 subagent
        // catch 走空回传 → B 引擎拿空 output 继续演 = A 的停止污染 B 的戏）。
        const abortedOnError = abortJobSubagents(jobId, 'FEMO 运行出错：中断在飞 AI 角色')
        if (abortedOnError > 0) console.log(`[femo-plugin] flow_error: aborted ${abortedOnError} in-flight subagent(s) of job ${jobId}`)
        abandonMainAnswer(String(sessionId), 'FEMO 运行出错，在飞注入作废', projections)
        // 本 Job 的停靠者立即放行（aborted verdict → 既有 finally 清理）。
        broker?.abortJob(jobId, 'flow error')
        // 镜像 failed + 清活跃指针走公共分诊台（最后一役）。
        broadcastProjectionState(runState, String(sessionId))
        const detail = String(d.error ?? 'unknown error')
        const text = `FEMO 运行出错：${detail}`
        recordError(session.id, text)
        // 报错通知全窗广播（含主会话；❌ 前缀补足原 error 红行的警示性）；
        // 措辞唯一权威=notice-core.PLAY_BROADCAST（2026-09-23 单份化）。
        broadcastCompat(ctx, session, projections, PLAY_BROADCAST.error(detail))
        // 通知主模型：终局急件由桥在事件现场产信+投递员整包直推（含本次报错
        // detail）。【2026-09-23 十连裁②⑩ 单通道】宿主 collect 兜底已废——
        // 送失的信由投递员重投（retry_pending），邮差扑空修邮差。
        break
      }
      case 'flow_paused': {
        // 【Job 域清场】同 flow_error（§6.2.9）。
        const abortedOnPause = abortJobSubagents(jobId, 'FEMO脚本暂停：中断在飞 AI 角色')
        if (abortedOnPause > 0) console.log(`[femo-plugin] flow_paused: aborted ${abortedOnPause} in-flight subagent(s) of job ${jobId}`)
        abandonMainAnswer(String(sessionId), 'FEMO脚本暂停，在飞注入作废', projections)
        // 本 Job 停靠者立即放行。
        broker?.abortJob(jobId, 'flow paused')
        // 挂起（可续跑）：断点保留在引擎 runs 档案；镜像 suspended + waitingHuman
        // 清 + 清活跃指针走公共分诊台（最后一役）。
        pushDiag('flow_paused', `suspended + waitingHuman CLEARED job=${jobId}`)
        broadcastProjectionState(runState, String(sessionId))
        // 全窗广播：工具与前端按钮触发的停止都由此统一通知所有窗口
        // （femo-run 工具侧已不再重复写）；措辞唯一权威=PLAY_BROADCAST。
        broadcastCompat(ctx, session, projections, PLAY_BROADCAST.paused(String(d.error ?? '')))
        // 通知主模型：暂停急件由桥在事件现场产信+投递员整包直推（滞留件随包，
        // 2026-09-16 汇总随停口径）。【2026-09-23 十连裁②⑩ 单通道】宿主
        // collect 兜底已废（同 flow_error）。
        break
      }
      case 'bridge_run_ended': {
        // mirror 复位（§6.2.10）：state 校正 + humanWait 清 + 本 Job 停靠者放行。
        broker?.abortJob(jobId, 'bridge run ended')
        hubFeedSetJob(null)  // 投影中心：整场收工，直播帧旁路停喂
        clearMirrorWaitingHuman(mirror)
        pushDiag('bridge_run_ended', `waitingHuman CLEARED job=${jobId} ok=${String(d.ok ?? '-')}`)
        if (mirror.state === 'running') {
          // worker 收尾了但没等到终态事件（理论不可达，防御）：按引擎侧
          // finalize 兜底语义校正为 failed（get_job_state 可查证）。
          jobMirrorSetState(runState, jobId, 'failed')
        }
        clearActiveIfActive(runState, jobId)
        // 【跑完通知归桥（2026-09-23 十连裁②⑩ 单通道）】终局急件由桥在
        // bridge_run_ended 现场产信+投递员整包直推（_post_final_done；时机即
        // 规则：run() 返回=引擎与角色全收工，无 settled 空轮吃信——Job 761；
        // finished/暂停的分界由桥侧 final_payloads 暂存承担：无 flow_done 不产
        // 跑完信，暂停信归 flow_paused——Job 762/763 的 ok=true 陷阱在桥侧
        // 消解）。宿主 collect 兜底已废，镜簿 state 校验随之退役。
        break
      }
      case 'node_retry': {
        // 【2026-09-23 十连裁③ 信化】重试牌改走驿站（mailbox-push 收 node_retry
        // 信按 wait_key 交停靠经纪人，租约保留超时/中止职能）——本事件退为记账
        // （retry 槽显示归桥 EventProjector），不再直接 deliverRetry（单通道，
        // 无兜底双路；开跑通知同款「邮差扑空修邮差」取舍）。
        break
      }
      case 'notify_author': {
        const severity = String(d.severity ?? '')
        const message = String(d.message ?? '')
        if (severity === 'fatal') {
          // fatal：仅 log——实际作者投递由紧随的 flow_error 三通道承担（引擎
          // dispatch FATAL 后必 raise → worker flow_error，防双份，v4 §3.3/§8.1）。
          console.log(`[femo-plugin] notify_author(fatal) node=${String(d.node_name ?? '')}: ${message}`)
          break
        }
        if (severity === 'warning') {
          // 警告（不阻断，知情类）：①错误面板留痕 ②聊天窗广播。主模型汇总
          // 不走宿主桶——桥已产滞留件（subkind=warning），随停下时刻代取打包。
          recordError(session.id, message)
          broadcastCompat(ctx, session, projections, `ℹ️ ${message}`)
          break
        }
        // agent_error（报错即通知作者，2026-09-05 猫猫实测修订：不再等重试用尽
        // ——执行者可能"聪明规避"报错，作者必须第一时间知道）与 agent_giveup
        // （超限收场）同走显示三通道：①错误面板 ②聊天窗 ③主模型汇总——第三
        // 通道由桥的滞留件（subkind=error）承担，随 flow_done/flow_error/
        // flow_paused/bridge_run_ended 的代取打包 steer（运行中直接 steer 必被
        // pre-step 门卫吞掉，门卫坑 v4 §8.3）。parker 解除由 node_settled 承担
        // （payload 无 wait_key；引擎超限路径 break→落盘→node_settled 确定性）。
        recordError(session.id, message)
        broadcastCompat(ctx, session, projections, `⚠️ ${message}`)
        break
      }
      case 'node_settled': {
        // 节点审结（ok/gave_up）：解除对应 parker（ai/human 同发，wait_key
        // 键控 par 分支隔离）。
        broker?.markSettled(String(d.wait_key ?? ''))
        break
      }
      default:
        break
    }
  })
}
