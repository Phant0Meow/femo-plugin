/**
 * actors/main/capture.ts — 主Agent参与运行的捕获锚定（2026-09-26 刀⑥自 main-actor.ts
 * 迁出，纯搬家）。
 *
 * 「交卷」= 把主模型某一轮的回答当台词寄给引擎。铁律：**这一轮必须是由我们那条
 * 注入通知开出来的**——否则交出的是别的东西（Job 2471：用户排障轮的分析被当成
 * @铲屎官 的 [看牌] 台词寄走；Job 2472：meow-memory 反思轮的整篇输出被当成
 * [看牌]_6 台词）。本件持 PendingAnswer 在飞表与 captureVerdict 裁决纯函数；
 * 回合接线（mainSessionEventHook）住 index.ts——钩子的 turn/end 尾部要回叫
 * 交付面（flushNextMainDelivery），交付面又要写本表，钩子与表同层必然成环
 * （刀③刚解完环），故表在叶层、钩子在上层。
 *
 * 共享内存表归属裁决（刀⑥）：pending 表归本件（捕获是第一读写方），delivery/
 * notice/index 经下方窄接口（rearm/take/peek）访问，不直摸 Map。
 *
 * 【三个观测面都在 session/event 上，不依赖宿主内部状态：
 *   · 通知以 user/message 进轮 —— 正文逐字比对（steerMainAgent 原样注入该 text）；
 *   · 本轮第一条 admitted 消息是不是它 —— 不是（真人消息、别的插件 steer 先到）
 *     就说明这轮的主人是别人，一律不交卷；
 *   · 进轮时本轮是否已 step/end —— 首步 claim 就吃到=我们开的轮（干净）；后续步
 *     才吃到=被正在跑的那一轮吞掉（脏）。实测事件序：turn/start → inbox claim →
 *     step/start 1 → user/message（所以"干净"= 见过 turn/start 且未见 step/end）；
 *   · 本轮是否混进真人消息（source.kind==='user'，与 engine-events 补课判定同款
 *     口径）——「FEMO内外不掺一轮」，混了不交卷。
 * 兼容性：user/message 是核心会话事件——任意来源的消息经 pre-step 放行后都由
 * agent-loop 统一 `session.append("user/message", …)`（0.1.6 源码实证，与 source
 * 无关；被门卫 reject 的批次不落），故锚点在各版本都可观测。万一某宿主不发它，
 * noticeEntered 恒假 → 按「本轮不是我们的」处理：那一轮不交卷、等下一轮（宁可推迟
 * 也不把用户对话当台词寄出去；引擎 3600s 等待超时是最后安全网）。】
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ResolvedConfig } from '../../config'
import { appendDebugLog } from '../../diag/debug-log'

/** 分身调试日志（排错观测点，host console 不可见故落文件）。【刀⑥】随表落
 *  叶层 capture——四个新件与 engine-events 都要用，放这里每步依赖都向下。 */
export function debugLogMainActor(resolved: ResolvedConfig, line: string): void {
  appendDebugLog(resolved.femoRoot, 'debug-main-actor.log',
    '[' + new Date().toISOString() + '] ' + line)
}

// ── 运行态（按主会话 sid 键控，内存态）──────────────────────────────────────

/** 在飞注入：已 steer 进主窗口、等待主模型回合回答的 main 节点。 */
export interface PendingAnswer {
  waitKey: string
  nodeName: string
  /** 所属 Job（交卷（speech 信）带 job_id——协议要求，§9.2）。 */
  jobId: number
  /** 执行者名（actor_name，如 @天使）。 */
  actor: string
  /** 交卷 soul（信封收件人同款派生：actor_info.soul 优先、'main' 兜底；
   *  绑定会话角色=角色自己的 soul，2026-09-25 泛化）。 */
  soul: string
  /** 本节点 scope（可见角色 actor 名；空=未限定全可见）。 */
  scopes: string[]
  /** 回合事件缓冲（assistant/message、tool/call、tool/result）。 */
  buffer: SessionEvent[]
  /** 已见到本回合 turn/start（防止误捕上一回合尾部事件）。 */
  sawTurnStart: boolean
  /** 【2026-09-23 捕获锚定】注入正文：交卷前必须确认「这一轮真认领了它」，
   *  否则用户FEMO外轮会被误当台词交卷（当日事故：flow_start 清了轮开闭账 →
   *  注入被 steer 进正在跑的用户轮 → 下一次任意轮被当成参与轮）。 */
  notice: string
  /** 本通知是否已作为 user/message 进过某一轮（捕获锚点的唯一观测面）。 */
  noticeEntered: boolean
  /** 进轮时它是不是「我们自己开出来的轮」：turn/start 在投递之后、且本轮尚未
   *  step/end——即本轮首个 claim 就吃到了它（转投/被吞的分界）。 */
  noticeEnteredClean: boolean
  /** 本轮是否已收过 step/end（上一格"首个 claim"的判定源）。 */
  stepEnded: boolean
  /** 本轮是否混进过真人消息（FEMO内外不掺一轮：混入=本轮不交卷，重投）。 */
  userMessageInTurn: boolean
  /** 本轮第一条被 admitted（通过 pre-step 门卫、真进了上下文）的消息是不是
   *  我们那条通知；'none'=还没见到任何一条。锚点核心：**轮必须由我们那条通知
   *  开出来**——'other'（真人消息 / 别的插件 steer 先到，如 meow-memory 反思
   *  任务、play_start 开跑通知）说明这轮的主人是别人，主模型的回答不属于本节点，
   *  绝不交卷（2026-09-23 Job 2472 实证：反思轮的输出被当成 [看牌] 台词）。 */
  firstAdmitted: 'none' | 'ours' | 'other'
  settled: boolean
  resolve: () => void
  /** 【V6.3】节点 showprompt（context_ready 暂存；引擎对所有 AI 节点统一发，
   *  main 节点同样有值；缺失=不落 📢 行）。 */
  showprompt?: string
  /** 【V6.3】本回合主会话原生 turn 号（turn/start 时记录；mainActorSceneActor
   *  FEMO内反查、帧桥与交卷收口都用它）。 */
  turn?: number
}

const pending = new Map<string, PendingAnswer>()

/** 窄接口·写（登记/重臂在飞注入）。 */
export function rearmPending(
  sid: string,
  fields: {
    waitKey: string
    nodeName: string
    actor: string
    soul: string
    scopes: string[]
    jobId: number
    showprompt?: string
    /** 注入正文（捕获锚点：交卷前拿它核对"这一轮认领的是不是我们的通知"）。 */
    notice: string
  },
  /** 交卷槽（2026-09-11）：缺省 no-op（重试轮调用面）；首轮交付传自己的
   *  `answer` resolve，交卷时唤醒它。 */
  resolve?: () => void,
): void {
  pending.set(sid, {
    waitKey: fields.waitKey,
    nodeName: fields.nodeName,
    actor: fields.actor,
    soul: fields.soul,
    jobId: fields.jobId,
    scopes: fields.scopes,
    buffer: [],
    sawTurnStart: false,
    notice: fields.notice,
    noticeEntered: false,
    noticeEnteredClean: false,
    stepEnded: false,
    userMessageInTurn: false,
    firstAdmitted: 'none',
    settled: false,
    resolve: resolve ?? (() => { /* no-op：见 docstring，停靠循环以 broker.park 为同步锚 */ }),
    ...(fields.showprompt !== undefined ? { showprompt: fields.showprompt } : {}),
  })
}

/** 窄接口·取出（取走并删除在飞注入；无则 undefined）。abandon/requeue/清场/
 *  交卷收口共用。 */
export function takePending(sid: string): PendingAnswer | undefined {
  const p = pending.get(sid)
  if (p !== undefined) pending.delete(sid)
  return p
}

/** 窄接口·窥视（不删除；回合接线与直播桥的只读判定面）。 */
export function peekPending(sid: string): PendingAnswer | undefined {
  return pending.get(sid)
}

/** 【步3.5 2026-09-11】god-mirror 写主会话开轮锚点时反查：这个 turn 是不是
 *  戏内下场轮？是 → 返回戏内演员名（god 窗名字行用戏内名字，用户拍板：
 *  "FEMO内节点的话应该用FEMO内的名字，FEMO外主模型发言才是主Agent"）。
 *  时序说明：本函数在 turn/start 镜像时被调，此时 p.turn 可能尚未被本模块的
 *  事件钩子写上（ctx.on 执行顺序无保证，Job 796 教训）——注入发出后 p 就在，
 *  第一个开的主会话轮必是参与轮，故 p.turn 未定时也认。空轮误标无害：前端
 *  对"无内容的主会话轮"不画名字行（v9.4）。 */
export function mainActorSceneActor(sid: string, turn: number): string | undefined {
  const p = pending.get(sid)
  // settled=已交卷（后续主会话轮归主Agent）；未在飞=不存在参与轮。
  if (p === undefined || p.settled) return undefined
  // p.turn 已定时必须对上号；未定时（钩子还没跑到，ctx.on 顺序无保证）——
  // 注入发出后第一个开的主会话轮必是参与轮，认。
  if (p.turn !== undefined && p.turn !== turn) return undefined
  return p.actor
}

/** 【2026-09-23 用户拍板：god 窗只投「main 全部戏外 + 全部角色戏内」，main 的
 *  FEMO内排除】这条 user/message 是不是本会话 main 参与运行注入的正文（参与/重试通知）。
 *  god-mirror 用它整拍剔除参与运行注入：不发旁白行、不开宿主轮容器——容器不开，
 *  主Agent直播桥自然不喂帧，参与轮的 cot/台词不会再被当「主Agent」的字抄进 god 窗
 *  （与捕获锚点同源判据：pending.notice 就是 steer 出去的那段正文，逐字比对）。 */
export function isMainActorNotice(sid: string, text: string): boolean {
  const p = pending.get(sid)
  return p !== undefined && p.notice.length > 0 && text === p.notice
}

/** 主模型是否正在回答 main 注入（pre-step 放行 + 输入桥豁免的判定源）。 */
export function isMainAnswerPending(sid: string): boolean {
  return pending.has(sid)
}

/** main 在飞注入的节点名（api-retry 通知/错误表定位用；不在飞返回 ''）。 */
export function pendingNodeName(sid: string): string {
  return pending.get(sid)?.nodeName ?? ''
}

/** user/message 事件的正文（兼容 data.content 与 data.message.content 两形态）。 */
export function userMessageTextOf(event: SessionEvent): string {
  const d = (event.data ?? {}) as { content?: unknown; message?: { content?: unknown } }
  const content = Array.isArray(d.content)
    ? d.content
    : (Array.isArray(d.message?.content) ? d.message.content : [])
  let out = ''
  for (const part of content as Array<{ type?: unknown; text?: unknown }>) {
    if (part?.type === 'text' && typeof part.text === 'string') out += part.text
  }
  return out
}

/** 真人消息（与 engine-events 的补课判定同款）：source.kind === 'user'。 */
export function isRealUserMessage(event: SessionEvent): boolean {
  const d = (event.data ?? {}) as { source?: { kind?: unknown } }
  return d.source?.kind === 'user'
}

/** turn/end 的交卷裁决（2026-09-23，纯函数可单测；语义见文件头锚点注释）：
 *   · settle —— 轮由我们那条通知开出（首条 admitted 即它）、首步 claim 吃到、
 *     且没混真人消息：交卷；
 *   · requeue —— 认领过我们的通知但轮不是我们的（别人先到 / 被正在跑的轮吞掉 /
 *     混了真人消息）：不交卷，退回队列重投；
 *   · wait   —— 本轮压根没认领我们的通知（别人的轮/噪音空轮）：继续等。 */
export type CaptureVerdict = 'settle' | 'requeue' | 'wait'

export function captureVerdict(f: {
  noticeEntered: boolean
  noticeEnteredClean: boolean
  userMessageInTurn: boolean
  firstAdmitted: 'none' | 'ours' | 'other'
}): CaptureVerdict {
  if (!f.noticeEntered) return 'wait'
  if (f.firstAdmitted !== 'ours') return 'requeue'
  if (!f.noticeEnteredClean || f.userMessageInTurn) return 'requeue'
  return 'settle'
}
