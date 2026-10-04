/**
 * hub-feed.ts — 投影中心宿主侧喂送口 = 宿主绑定（协议机已收编公共层）。
 *
 * 【2026-09-25 收编】喂送协议机——双路微批（40ms/20 条、单飞保序）、段引用
 * ref/segRef 语义互斥、宿主轮容器账、best-effort 静默纪律——唯一活在
 * femo2host/host/hub-feed-core.mjs（zcode 网关的同步喂送面也吃同一份）。
 * 本文件只剩宿主注入三件事：
 *  ① feedUrl：hub 地址唯一解析（hub-client.mjs：hub.json 自发现 > env > 8790；
 *    桥重启换端口/停机撤件即刻感知，函数化懒读）；
 *  ② source：宿主自称（env FEMO_HOST_NAME，bridge.start() 从清单写入；懒读——
 *    本模块可能早于 bridge.start() 被加载，顶层读一次会永远拿到空串）；
 *  ③ 会话寻址：`${hostAddr()}:${sid}`（hostAddr 空回退 'dsh'，与读侧同一词——
 *    两侧回退值若不一致，喂进 sessions/<X>/ 的账本读侧就找不到）。
 *
 * 【两边都进、进去一个样，2026-09-19 用户拍板】hub 是 hub：引擎的节点进、宿主的
 * 轮也进，**进来之后都是「开一个容器 → 按同一套规矩往槽里填 → 收口」**——hub 不
 * 看来源，只看帧。两条来路：
 *  ① 引擎节点轮（角色 / 主模型参与运行）：容器由**桥**在 ai_request/human_wait 那拍
 *     开，令牌是引擎发的那枚 wait_key；宿主只管把模型逐字流喂进那个容器，
 *     交卷收口也归桥。
 *  ② 宿主自己的轮（FEMO外主Agent轮）：容器由**宿主自己开**（hubHostSegOpen，令牌是
 *     宿主自造的 h:<sid>:<seq>）、自己收口（hubHostSegClose）。
 *
 * 纪律：best-effort，任何失败静默吞掉——幕布绝不挡运行（产信同款纪律）；
 * 「非 FEMO 会话不发 hub」的闸在 god-mirror 监听入口（判据=session-roster 的
 * isFemoSession，2026-09-23 用户拍板），不在这层。
 */

import { hubBaseUrl } from '../../../../femo2host/host/hub-client.mjs'
import { createHubFeedCore } from '../../../../femo2host/host/hub-feed-core.mjs'

/** 直播帧身份的最小消费面（与 stream-frames 的 FemoStreamBase 同词汇）。
 *  段引用两个字段、**语义互斥**（2026-09-19 实锤修正）：
 *    · ref    = 引擎的**令牌**（wait_key）→ 发 `wait_key`，段键 'w:<令牌>' 由 hub 拼；
 *    · segRef = 宿主**自造**的整键（宿主轮 'h:<sid>:<seq>'）→ 发 `seg`，hub 原样用。
 *  此前两者都塞进 ref 且一律发 `seg`：hub 那边"显式 seg 优先"，令牌被当成完整键，
 *  逐字流全落在不存在的幻影段上——页面一行字都不长（生产台账实锤：job 1856 的
 *  drafts.json 里躺着 'j1856:ai_[投票]_N' 这类裸令牌键，主账段键却是 'w:…'）。 */
export interface HubFeedBase {
  sid: string
  actor: string
  turn?: number
  step?: number
  ref?: string
  segRef?: string
}

/** 流式块的最小消费面（与 stream-frames 的 FemoStreamChunk 同词汇）。 */
export interface HubFeedChunk {
  type?: string
  index?: unknown
  text?: unknown
  name?: unknown
  argumentsDelta?: unknown
}

/** 宿主寻址标签（喂侧与读侧必须同一词）：env FEMO_HOST_NAME（bridge.ts 从清单
 *  host 字段写入），空回退 'dsh'。会话账本的目录与会话寻址读法都用它。
 *  **懒读 env**：本模块可能早于 bridge.start() 被加载，在模块顶层读一次会永远
 *  拿到空串。 */
export function hostAddr(): string {
  return String(process.env.FEMO_HOST_NAME ?? '').trim() || 'dsh'
}

const core = createHubFeedCore({
  feedUrl: () => `${hubBaseUrl()}/feed`,
  source: () => String(process.env.FEMO_HOST_NAME ?? '').trim(),
  sessionAddr: (sid) => `${hostAddr()}:${sid}`,
})

/** 场次登记：引擎事件入口（带 job_id）每事件刷新；null=停喂 job 寻址路。
 *  【2026-09-20 会话账本】只管 **job 寻址**的帧（引擎路径）；会话寻址帧
 *  （宿主FEMO外直投）不过这道闸——录制无条件，无运行照收。 */
export function hubFeedSetJob(jobId: number | null): void {
  core.setJob(jobId)
}

/** 流式块 → 喂 hub（broadcastStreamChunk 顶部旁挂）。
 *  【会话寻址】segRef（宿主自造整键 h:<sid>:…）→ 会话直投（无运行照喂，录制
 *  无条件）；ref（引擎令牌）→ job 路径（闸门照旧——角色/主模型参与运行的字只在
 *  有戏时存在）。 */
export function hubFeedChunk(base: HubFeedBase, chunk: HubFeedChunk): void {
  core.feedChunk(base, chunk)
}

/** 清屏（clearLiveBucket）：内容交接/孤儿 attempt——这一拍已经写出去的字作废。
 *  hub 撤掉该容器里的草稿（页面同步撤），容器本身留着。寻址分叉同 hubFeedChunk。 */
export function hubFeedClearBucket(base: HubFeedBase): void {
  core.clearBucket(base)
}

/** 回合收口（endTurn）：**什么都不做**。容器的收口权归开容器的人——引擎节点轮
 *  由桥在交卷那拍收（定稿吸收草稿、剩余转正），宿主自己的轮由 hubHostSegClose
 *  收。宿主在这里一收，反而抢在桥前面把自己的草稿先转正、再被定稿顶出双份。 */
export function hubFeedEndTurn(_base: HubFeedBase): void {
  /* 有意为空：见上 */
}

/** 开一个宿主轮容器（user 发言那拍调用：位置就此锁定在 user 之后）。
 *  重复开（同一 sid 上一轮还没收口）= 先把旧的收掉，绝不叠容器。
 *  【会话寻址】帧直投会话账本（无运行照喂——录制无条件，2026-09-20）。 */
export function hubHostSegOpen(sid: string, opts: { seq: number | string; turn?: number }): string {
  return core.hostSegOpen(sid, opts)
}

/** 本 sid 当前开着的宿主轮容器（主Agent流据此把字喂进去）；没开就没有
 *  ——FEMO内轮不开宿主容器，它的字由桥那条路（wait_key）喂。 */
export function hubHostSegCurrent(sid: string): string | undefined {
  return core.hostSegCurrent(sid)
}

/** 收口本 sid 的宿主轮（turn/end 那拍）：定稿 items 交给 hub，同 kind 的流式
 *  草稿被吸收、没流到的 kind 由草稿转正兜底（宿主不必自己防双份）。 */
export function hubHostSegClose(sid: string, items: Array<Record<string, unknown>>): void {
  core.hostSegClose(sid, items)
}

/** 通用 op 喂送口：**job 寻址**专用（闸门照旧；现无生产调用方，留给调试与
 *  未来引擎侧直投；会话寻址帧走 hubFeedRow / 宿主轮三口，不走这里）。
 *  【作者预留·2026-09-27 死代码审计已核】知情保留，非死代码，勿清。 */
export function hubFeedOp(op: Record<string, unknown>): void {
  core.feedOp(op)
}

/** 行旁挂（【会话寻址】FEMO外私聊 user 发言等——2026-09-20 起按会话直投，无运行
 *  照喂；src_seq 由调用方给足 main:sid:seq，hub 幂等去重。best-effort 同纪律）。 */
export function hubFeedRow(sid: string, row: Record<string, unknown>): void {
  core.feedRow(sid, row)
}
