/**
 * actors/main/notice.ts — 主Agent参与运行的注入文案与流水水位（2026-09-26 刀⑥自
 * main-actor.ts 迁出，纯搬家）。
 *
 * 按 sid 键控的六张内存表（重启即重跑，无需持久化）：mainActorNames（角色名集）、
 * flows/waterMarks（剧内发言流水与已注入水位）、playNames（FEMO脚本名）、queues
 * （注入串行队列——原住主入口旁，随 clearMainPlayState 落此：清场要清它，
 * 主入口要用它，放中间层两边都向下）。文案两件（节点通知 stageNotice /
 * 重试反馈 mainRetrySteerText）与运行结束补遗同件。
 * pending 表在 capture、队列正身在 delivery——本件经窄接口/直接 import 取用。
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { ResolvedConfig } from '../../config'
import { steerMainAgent } from '../../verbs'
import { SET_VARIABLE_TEACHING } from '../../node-retry'
import { debugLogMainActor, takePending } from './capture'
import { dropMainDeliveries } from './delivery'

// ── 运行态（按主会话 sid 键控，内存态）──────────────────────────────────────

/** main 角色名集（ai_request source=main 的 actor_name）。 */
const mainActorNames = new Map<string, Set<string>>()
/** main 可见剧内发言流水（非 main 角色的、节点 scope 含 main 角色的发言）。 */
export interface FlowLine { actor: string; text: string }
const flows = new Map<string, FlowLine[]>()
/** 已注入水位（flows 的已消费条数）。 */
const waterMarks = new Map<string, number>()
const playNames = new Map<string, string>()
/** 注入串行队列（par 多 main 节点排队，一次只让主模型答一个节点）。
 *  【刀⑥】主入口（index）读写、清场（本件）删除，落中间层两边向下。 */
export const queues = new Map<string, Promise<void>>()
/** 供 index 主入口取增量用（读写方还有 runMainModelTurnInner 的水位推进）。 */
export {
  flows, waterMarks, playNames,
}

/** flow_start 清场：上一次的流水/水位/在飞全部作废；记FEMO脚本名 + 登记 main
 * 角色静态名单（编译期声明，开跑即知——运行时登记会漏首个 main 节点之前
 * 的发言，1005 场实测教训）。
 *
 *  ⚠️ 2026-09-23（事故修正）：**轮开闭账不清**。旧实现顺手 `deliveries.forget`
 *  连"第 N 轮在飞"一起清，可那本账记的是「主会话 driver 现在有没有轮在跑」，
 *  换场/续跑（flow_start）根本不改变宿主会话的轮状态。当日事故链：主模型自己
 *  pause/resume（resume 发 flow_start）→ 轮开闭账被清、而用户第 12 轮还在跑 →
 *  下一封主模型料包信误判"无在飞轮"→ 注入被 steer 进正在跑的用户轮 → 那段通知
 *  被吞、随后一整条用户轮被当台词交卷。该清的是"上一次的活"（排队件/在飞
 *  pending），不是宿主会话的轮事实。 */
export function clearMainPlayState(sid: string, name: string, mainActors?: string[]): void {
  // 在飞 pending 作废并**释放交卷槽**：旧实现只 delete 不 resolve，
  // runMainModelTurnInner 的 `await answer` 会永久悬挂；放行后它继续走到
  // broker.park，而租约已随暂停/收工 abortJob 清掉 → 立即 aborted 收场。
  const inflight = takePending(sid)
  if (inflight !== undefined) {
    inflight.settled = true
    inflight.resolve()
  }
  mainActorNames.delete(sid)
  flows.delete(sid)
  waterMarks.delete(sid)
  queues.delete(sid)
  // 【2026-09-11】换场：排队中的参与运行注入（上一次的）作废；轮开闭账保留（见上）。
  dropMainDeliveries(sid, '换场清场')
  if (name.trim().length > 0) playNames.set(sid, name.trim())
  else playNames.delete(sid)
  if (mainActors !== undefined && mainActors.length > 0) {
    const set = new Set<string>()
    for (const n of mainActors) if (n.length > 0) set.add(n)
    if (set.size > 0) mainActorNames.set(sid, set)
  }
}

/** ai_request(source=main) 登记角色名（后续 scope 判定用）。 */
export function noteMainActor(sid: string, actorName: string): void {
  if (actorName.length === 0) return
  let set = mainActorNames.get(sid)
  if (set === undefined) { set = new Set<string>(); mainActorNames.set(sid, set) }
  set.add(actorName)
}

/** 换场清场补全（cast 泛化后，2026-09-25）：清掉客串会话角色（绑定会话）的
 *  登记残留——mainActorNames/流水/水位三张表。保守排除在跑 Job 的 owner
 *  （并行 Job 各自的 main 登记不能互删）；绑定 sid 下一次派工时重新登记，
 *  清掉无副作用。pending 不在此清：收工时 abortJob 已清租约，残留 pending
 *  的判定方向是「放行」不是「拒绝」，无卡死面。 */
export function clearGuestActors(protectedOwners: Iterable<string>): void {
  const keep = new Set(protectedOwners)
  for (const sid of [...mainActorNames.keys()]) {
    if (keep.has(sid)) continue
    mainActorNames.delete(sid)
    flows.delete(sid)
    waterMarks.delete(sid)
  }
}

/** 某节点的发言是否 main 可见：scope 未限定=全可见；否则 scope 含任一 main 角色。 */
function isMainVisible(sid: string, scopes: string[] | undefined): boolean {
  if (scopes === undefined || scopes.length === 0) return true
  const mains = mainActorNames.get(sid)
  if (mains === undefined) return false
  return scopes.some(name => mains.has(name))
}

/** 剧内发言入流水（ai_done / human 输入时调用；main 角色本人发言不入——
 * 台词天然在主窗口历史里，注入回自己没有意义）。返回入账后流水总条数
 * （-1=未入账，观测判定用）。 */
export function noteFlowLine(
  sid: string,
  actor: string,
  text: string,
  scopes: string[] | undefined,
): number {
  if (text.length === 0) return -1
  if (mainActorNames.get(sid)?.has(actor)) return -1
  if (!isMainVisible(sid, scopes)) return -1
  let list = flows.get(sid)
  if (list === undefined) { list = []; flows.set(sid, list) }
  list.push({ actor, text })
  return list.length
}

/** ai_done 剧内发言入流水（全场会话执行体角色版，2026-09-25）：owner 的 main
 *  之外，绑定会话角色（经 noteMainActor 登记者）各自维护「窗口已见剧内发言」
 *  水位——注入通知的增量段与运行结束补遗按同一把尺子取数。scope 判定复用
 *  isMainVisible（按各会话登记的角色名集自动匹配）。返回入账的会话数。 */
export function noteFlowLineAll(actor: string, text: string, scopes: string[] | undefined): number {
  let counted = 0
  for (const actorSid of mainActorNames.keys()) {
    if (noteFlowLine(actorSid, actor, text, scopes) >= 0) counted += 1
  }
  return counted
}

// ── 注入组装 ────────────────────────────────────────────────────────────────

/** main 专属重试反馈文案（2026-09-05 Step D，施工清单 v4 §7.2）：带FEMO内身份
 *  （剧名/节点/出演的角色）——与 subagent 的 RETRY_STEER_TEXT（node-retry.ts，
 *  通用措辞）分立：主模型在主窗口有"角色是谁、在演什么"的上下文值得点名，
 *  两者不共用避免 node-retry 长出 main 依赖。 */
export function mainRetrySteerText(
  play: string,
  nodeName: string,
  actor: string,
  attempt: number,
  feedback: string,
): string {
  return `[femo-plugin·节点重试] FEMO脚本《${play}》节点「${nodeName}」（你的角色是 ${actor}）的上一轮输出未通过FEMO脚本校验（第 ${attempt} 次反馈）：\n${feedback}\n请重新输出该节点的台词（${SET_VARIABLE_TEACHING}）。`
}

export function stageNotice(sid: string, nodeName: string, actor: string, prompt: string, delta: FlowLine[], final: boolean, context = ''): string {
  const play = playNames.get(sid)
  const parts = final
    ? [`[femo-plugin·运行结束补遗] FEMO脚本《${play ?? 'FEMO脚本'}》已跑完，以下是最后一截你可见的运行期间发言。`]
    : [`[femo-plugin·节点通知] FEMO脚本《${play ?? 'FEMO脚本'}》进行到节点「${nodeName}」，轮到 ${actor} 说话。`]
  // 场上信息优先 Block Collector 产物（2026-09-12）：`[名字]：\n内容` 排版、
  // 含人类发言、scope 过滤与其他节点同语义。旧引擎 payload 无 context 或为空
  // 时退回本地流水行（原行为）；运行结束补遗无 request 恒走流水行。
  const flowLines = delta.map(l => `${l.actor}：${l.text}`).join('\n')
  const field = context.trim().length > 0 ? context : flowLines
  if (field.length > 0) parts.push(`〖场上信息〗\n${field}`)
  if (!final) parts.push(`〖本节点指令〗\n${prompt}`)
  if (!final) parts.push(`〖要求〗现在轮到你的运行中回合：只输出台词正文。${SET_VARIABLE_TEACHING}。`)
  return parts.join('\n\n')
}

// ── 运行结束补遗 ────────────────────────────────────────────────────────────────

/** flow_done：把剩余未注入的 main 可见发言补进主窗口（有则发，无则静默）。 */
export function flushMainFinalDelta(ctx: Context, sessionId: string | SessionId, resolved: ResolvedConfig): void {
  const sid = String(sessionId)
  const all = flows.get(sid) ?? []
  const mark = waterMarks.get(sid) ?? 0
  const delta = all.slice(mark)
  waterMarks.set(sid, all.length)
  if (delta.length === 0) return
  const notice = stageNotice(sid, '', '', '', delta, true)
  steerMainAgent(ctx, sid, notice)
  debugLogMainActor(resolved, `运行结束补遗注入: ${delta.length}条 ${notice.length}ch`)
}
