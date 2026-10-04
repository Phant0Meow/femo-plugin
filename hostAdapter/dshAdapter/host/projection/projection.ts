/**
 * projection.ts — 投影窗管家。
 *
 * 投影窗（子代理视角窗）：角色/上帝视角从「主会话 CSS 过滤」迁移到
 * 「dsh 原生子代理会话窗」。投影窗 = 无 agent 会话 + origin:subagent +
 * parentSession=主会话 + subagent/descriptor（dsh 原生身份，可进子代理目录、
 * 标题=label、持久化自动）。事件按 turn-scope 投影进对应窗，主会话表面
 * 不再接收角色内容（为「主会话=FEMO外视角」铺路）。
 *
 * 本模块含两块：
 *  1. appendChat / appendChatProjected / appendChatBroadcast —— femo-plugin/chat
 *     行写入（主会话表面；投影窗半边已随链路B 退役——内容由 hub 供给，
 *     2026-09-20 大扫除摘除）；
 *  2. 投影窗生命周期 —— ensure/awaken/registry（幂等、冷唤醒、inflight 串行）；
 *     窗型：上帝窗 god / FEMO内窗 stage / 角色窗 <actorKey>。窗壳是活的：
 *     hub-window 锚行、composer、hub-view 代理都挂在它上面。
 *
 * 【链路B 2026-09-19 断电·2026-09-20 大扫除拆管】原第 3 块 projectionAppend
 * （按 scope 把事件投进对应窗的写入机）与其上游 projectionAppender 整体
 * 删除——write 断点后全链路再无调用方。回滚 = git 历史。
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import { yieldToEventLoop } from '../compat/list-cache'
import { readSessionEventCount, readSessionEvents } from '../compat/session-events'
import { durableProjectionWindows, nativeState } from '../compat/native-state'
import { HUB_ANCHOR_KIND, HUB_ANCHOR_SRC } from './hub-anchor'
import {
  WindowLedger,
  actorKeyOf as coreActorKeyOf,
} from '../../../../femo2host/host/projection-core.mjs'
import { parseProjectionWindowId } from '../../shared/window-id.mjs'

/** 会话事件的动态 append 面：事件类型在运行时来自引擎事件流/镜像白名单
 * （超出静态 SessionEventMap 的字面量联合，如 subagent/descriptor、镜像的
 * turn/step 结构），统一经此宽化签名调用 session.append——方法引用与参数值
 * 与直接调用完全一致，仅收敛类型（2026-08-23 重构类型整理）。
 *
 * 【2026-09-10 turn/end reason 补全】官方 trajectory-turn-end 节点对每条
 * turn/end 无保护读 data.reason.kind，缺 reason 的行（引擎投影簿记行、旧
 * 镜像文件存量行）会在 replaceWindow 中途抛 TypeError，整个转写装配报废
 * =投影窗白屏（0.1.3 实测根因）。此处对 turn/end 统一补默认
 * reason:{kind:'completed'}（dsh 原生 turn/end 恒带 reason；迁移器亦要求
 * 恰好 ['turn','reason'] 两键）；已带 reason 的行原样透传。 */
export function appendEvent(session: Session, type: string, data: unknown, surface?: unknown): void {
  if (type === 'turn/end') {
    const d = (data ?? {}) as Record<string, unknown>
    if (d.reason === undefined) {
      data = { ...d, reason: { kind: 'completed' } }
    }
  }
  ;(session.append as (t: string, d: unknown, s?: unknown) => void)(type, data, surface)
}

// ── 投影窗去重索引（2026-08-26 性能修复；2026-09-16 换核心 WindowLedger）──
// 此前 mirror/projection 的幂等查重是 win.events.some() 全量扫描——投影窗
// 事件积累到 13.7 万级后每次查重 O(n)、事件一多整体 O(n²)，事件循环被同步
// 代码堵死数秒（实锤：event-loop stall 2514~10274ms）。O(1) Set 索引的账本
// 机制（懒构建/增量维护/查重语义）唯一活在核心 WindowLedger；这里只剩 dsh
// 特有的两件事：WeakMap<Session> 键、hasDescriptor 旗标（descriptor 幂等）。
interface WinDedupeIndex {
  ledger: WindowLedger
  hasDescriptor: boolean
  /** 窥视口（既有消费方 .srcSeqs/.structKeys 直访兼容面——与账本底层 Set 同一对象）。 */
  readonly srcSeqs: Set<unknown>
  readonly structKeys: Set<string>
}
const winDedupeIndex = new WeakMap<Session, WinDedupeIndex>()

/** 取某投影窗的去重索引（懒构建：首次遍历现有 events 全量建账本）。 */
export function dedupeIndexFor(session: Session): WinDedupeIndex {
  let idx = winDedupeIndex.get(session)
  if (idx === undefined) {
    const ledger = new WindowLedger()
    let hasDescriptor = false
    const rows: Array<{ type: string; data?: Record<string, unknown> }> = []
    for (const e of readSessionEvents(session)) {
      if ((e.type as string) === 'subagent/descriptor') hasDescriptor = true
      rows.push({ type: e.type as string, data: (e.data ?? {}) as Record<string, unknown> })
    }
    ledger.seed(rows)
    idx = {
      ledger,
      hasDescriptor,
      get srcSeqs() { return ledger.srcSeqs },
      get structKeys() { return ledger.structKeys },
    }
    winDedupeIndex.set(session, idx)
  }
  return idx
}

/** 增量补键（仅对已建索引的窗；未建索引的窗无需——首次查询会懒构建）。
 *  挂在全局 session/event 钩子上，保证任何 append 来源都不漏键。 */
export function dedupeMarkIndexed(session: Session, type: string, data: unknown): void {
  const idx = winDedupeIndex.get(session)
  if (idx === undefined) return
  idx.ledger.mark(type, data as Record<string, unknown>)
  if (type === 'subagent/descriptor') idx.hasDescriptor = true
}

// ── 1) chat 行写入 ────────────────────────────────────────────────────────

/** Append a chat line to a Femo session as a femo-plugin/chat event.
 * @param visible - actor names this line is visible to (the action's scope);
 * absent = visible to everyone (used by role/prompt/human_wait lines whose
 * scope is unknown); caller omits it for god-only meta lines (notice/error/
 * thinking), which the frontend hides in role views. */
function appendChat(
  ctx: Context,
  session: Session,
  text: string,
  kind: 'role' | 'notice' | 'human_wait' | 'prompt' | 'error' | 'thinking' | 'sys' = 'notice',
  actor?: string,
  visible?: string[],
): void {
  try {
    session.append('femo-plugin/chat', {
      ...actor === undefined ? {} : { actor },
      text,
      kind,
      ...visible === undefined ? {} : { visible },
    })
    console.log(`[femo-plugin] chat: kind=${kind} actor=${actor ?? '-'} len=${text.length}`)
  } catch (error: unknown) {
    console.log(`[femo-plugin] appendChat failed: ${String(error)}`)
  }
}

/** 引擎 chat 行投影：【2026-09-20 大扫除后】只剩 alsoMainSession=true 的主会话
 *  半（llmBridge 直连模式无子代理镜像，role 行是主会话唯一显示面）；投影窗
 *  半边随链路B 退役——内容由 hub 供给。windowing-native 的 projectedCompat
 *  仍调用本函数（主会话半）。 */
export function appendChatProjected(
  ctx: Context,
  session: Session,
  _projections: ProjectionRegistry,
  text: string,
  kind: 'role' | 'notice' | 'human_wait' | 'prompt' | 'error' | 'thinking',
  actor?: string,
  visible?: string[],
  alsoMainSession = false,
): void {
  if (alsoMainSession) {
    appendChat(ctx, session, text, kind, actor, visible)
  }
}

/** 主会话表面系统回执（kind='sys'）：femo-run 四动作成功后的用户可见状态条。
 * 与FEMO内信息走向相反——这条只进主会话、不进投影窗（god 窗的运行状态由引擎
 * 事件 notice 承载；MIRROR_MAIN_EVENTS 白名单不含 femo-plugin/chat，镜像天然
 * 不收）。不进模型上下文：纯 UI 显示；需要唤醒主模型请用 engine-events 的
 * steerMainAgent，两者勿混用。 */
export function appendChatMain(ctx: Context, session: Session, text: string): void {
  appendChat(ctx, session, text, 'sys')
}

/** 运行状态通知（主会话表面 sys 一条）。【2026-09-20 大扫除】原「主会话+
 * 上帝窗+全部角色窗」的全窗广播随链路B 退役——god/stage 的运行状态由
 * 引擎事件 notice 承载（桥落账）；主会话 sys 回执保留（femo-run 四动作
 * 回执的用户可见状态条，前端全视角可见、居中灰字渲染）。 */
export function appendChatBroadcast(
  ctx: Context,
  session: Session,
  _projections: ProjectionRegistry,
  text: string,
): void {
  appendChatMain(ctx, session, text)
}

// ── 2) 投影窗生命周期 ─────────────────────────────────────────────────────

/** 保留 actor 名：上帝窗（ensureProjectionWindows 固定传 'god'）。 */
export const GOD_ACTOR = 'god'

/** 保留 actor 名：FEMO内窗（2026-08-27 搜索去重方案新增）——脚本内全部事件的
 *  唯一归档窗：收全部FEMO内内容（聊天行/名字行/结构/引擎通知），不含主会话
 *  镜像（god-mirror 只写 god 窗，不经 projectionAppend）。搜索来源二分：
 *  主会话=FEMO外 / FEMO内窗=FEMO内，同一段对话的命中唯一。 */
export const STAGE_ACTOR = 'stage'

/** 单主会话的投影窗集合（host 侧窗引用的统一形状）。
 *  god=上帝窗（全视：FEMO内全量 + 主会话镜像）；stage=FEMO内窗（纯FEMO内归档）；
 *  actors=角色窗（scope 过滤）。 */
export interface ProjectionWindows {
  god?: Session
  stage?: Session
  actors: Map<string, Session>
}

/** 投影窗 actor 消毒：语义唯一活在核心 actorKeyOf（非 [A-Za-z0-9_-] → _+码点
 *  十六进制，不同角色名必不相同——旧压 _ 算法双键同窗双写的教训；zcode 同源）。
 *  2026-08-31 起同时是角色占用数据（actor-usage）的 key 消毒。 */
export function projectionActorKey(actor: string): string {
  return coreActorKeyOf(actor)
}

/** 投影窗 id：上帝窗 god / FEMO内窗 stage / 角色窗 <actorKey>。id 规则化 → 重启后可推导。 */
function projectionId(sid: string, actor: string): string {
  return `femo-proj-${sid}-${projectionActorKey(actor)}`
}

/** 投影窗 id → 主会话 id（2026-09-06 猫猫拍板：投影窗是主会话的遥控器）。
 *  非 femo-proj- 前缀原样返回；femo-proj-<主sid>-<actorKey> 剥出主 sid
 *  （actorKey 不含 '-'，末段必属 actorKey）。FEMO脚本数据面（run /
 *  session-state / session-script）入口都应经此归一——Job 与FEMO脚本记录
 *  永远挂主会话名下。 */
export function mainSessionIdOf(sessionId: string): string {
  return parseProjectionWindowId(sessionId)?.mainSid ?? sessionId
}

// 投影窗 id 拆解正身住 ../../shared/window-id.mjs（2026-09-29：宿主与聊天窗
// bundle 同吃一份，proj2/window-id.ts 的孪生抄写退役）。此处再导出保既有
// import 面（hub-proxy / routes/* 零改动）。
export { parseProjectionWindowId, PROJECTION_WINDOW_PREFIX } from '../../shared/window-id.mjs'

/** 投影窗 descriptor 显示名：god=上帝视角 / stage=FEMO内视角 / 其余=🎭角色。 */
function descriptorLabel(actor: string): string {
  return actor === GOD_ACTOR ? '👁 上帝视角' : actor === STAGE_ACTOR ? 'FEMO内视角' : `🎭 ${actor}`
}

/** 投影窗是否已带 subagent/descriptor（幂等：fold 取第一个事件为权威，不得重复）。
 *  O(1) 走去重索引（懒构建一次性全扫，此后增量）；旧实现每次 .some() 全扫
 *  events——投影窗 13.7 万事件级时每次 ensure 都是一次全数组扫描。 */
function projectionHasDescriptor(session: Session): boolean {
  return dedupeIndexFor(session).hasDescriptor
}

/** 唤醒的冷投影窗 detach 收集器：apply 的 effect 统一挂清理（插件卸载时
 * 把唤醒的会话移出 store，防 HMR 重载泄漏 store 条目）。index.ts 总装持有清理 effect。 */
export const awakenedDisposers: Array<() => void> = []

/**
 * 从持久化唤醒一个冷投影窗（重启后 sessions store 为空、create 会撞持久化
 * id 抛 "already exists"，导致整次运行的上帝窗写入全部静默丢弃——2026-08-22）。
 * prepare 加载持久化日志为未发布 Session，enter+announce 发布进 store；
 * detach 交给 awakenedDisposers 随插件卸载清理。目标不存在（全新窗）返回
 * undefined，调用方走 create 新建。
 * 【0.1.3 原生冷装载】sessionPersistence.prepare 已不存在（实测 false）；
 * 原生路径改用 readStoredLog(locate(cwd,id).path, id) 读存储记录，再
 * sessions.prepare({eventState, seed: events, meta, inheritedEventCount}) +
 * enter + announce 物化回 store（配方经 debug-materialize 实测验证）。
 */
async function awakenProjectionWindow(
  ctx: Context,
  sessions: {
    enter?(session: Session): () => void
    announce?(session: Session): void
    prepare?(id: SessionId, options?: unknown): Session
  },
  id: string,
  cwd: string,
): Promise<Session | undefined> {
  const persistence = ctx.get('sessionPersistence') as
    | {
      prepare?(id: SessionId): Promise<{ session: Session }>
      locate?(meta: { cwd?: string; id: SessionId }): { path: string } | undefined
      readStoredLog?(path: string, id: SessionId): Promise<unknown>
    }
    | undefined
  if (persistence === undefined) return undefined
  // ── 0.1.3 原生冷装载（readStoredLog → sessions.prepare/enter/announce）──
  if (nativeState.native && typeof persistence.readStoredLog === 'function'
    && typeof persistence.locate === 'function'
    && sessions.prepare !== undefined && sessions.enter !== undefined && sessions.announce !== undefined) {
    const t0 = Date.now()
    try {
      const loc = persistence.locate({ cwd, id: SessionId(id) })
      if (loc === undefined) {
        console.log(`[femo-plugin] awaken ${id}: no stored log (fresh window)`)
        return undefined
      }
      const stored = (await persistence.readStoredLog(loc.path, SessionId(id))) as
        | {
          status?: string
          meta?: Record<string, unknown>
          eventState?: 'shared-frozen' | 'detached'
          events?: Array<Record<string, unknown>>
          inheritedEventCount?: number
        }
        | undefined
      if (stored === undefined || stored.status !== 'current' || !Array.isArray(stored.events)) {
        console.log(`[femo-plugin] awaken ${id}: stored log not usable (status=${String(stored?.status)})`)
        return undefined
      }
      // 【2026-09-10 turn/end reason 补全（存量行）】旧构建/旧镜像写入的
      // turn/end 可能缺 reason——官方 trajectory-turn-end 节点读 reason.kind
      // 直接抛错，整窗转写装配报废（白屏）。种子在此统一补默认；补齐与
      // appendEvent 漏斗的同款兜底互为表里（seed 行不走 appendEvent）。
      const sanitized = stored.events.map((raw) => {
        const e = raw as { type?: string; data?: Record<string, unknown> }
        if (e?.type === 'turn/end' && (e.data?.reason === undefined)) {
          return { ...e, data: { ...(e.data ?? {}), reason: { kind: 'completed' } } }
        }
        return raw
      })
      const session = sessions.prepare(SessionId(id), {
        eventState: stored.eventState ?? 'shared-frozen',
        seed: sanitized,
        meta: stored.meta,
        inheritedEventCount: stored.inheritedEventCount ?? 0,
      } as unknown as Record<string, unknown>)
      const detach = sessions.enter(session)
      sessions.announce(session)
      awakenedDisposers.push(detach)
      console.log(`[femo-plugin][diag] awaken ${id}: durable load ${Date.now() - t0}ms, events=${stored.events.length}`)
      return session
    } catch (error: unknown) {
      console.log(`[femo-plugin] awaken ${id} durable load failed: ${String(error instanceof Error ? error.message : error)} (after ${Date.now() - t0}ms)`)
      return undefined
    }
  }
  // ── 旧版路径（meow fork：sessionPersistence.prepare）──
  if (persistence.prepare === undefined || sessions.enter === undefined || sessions.announce === undefined) {
    return undefined
  }
  let prep: { session: Session }
  const t0 = Date.now()
  try {
    prep = await persistence.prepare(SessionId(id))
    // [femo-diag] 事件循环 stall 排查：prepare 内部同步解压+解析大会话日志，
    // 大投影窗一次唤醒可堵秒级——打点量化，与心跳 stall 时间对齐定位热点。
    console.log(`[femo-plugin][diag] awaken ${id}: prepare ${Date.now() - t0}ms, events=${readSessionEventCount(prep.session)}`)
  } catch (error: unknown) {
    // 2026-08-23 卡死调查：此前这里静默吞错导致"god 窗每次都 created 新空窗"
    // 无从定位。真实错误必须落日志。
    console.log(`[femo-plugin] awaken ${id} PREPARE FAILED: ${String(error instanceof Error ? error.message : error)} (after ${Date.now() - t0}ms)`)
    return undefined
  }
  try {
    const detach = sessions.enter(prep.session)
    sessions.announce(prep.session)
    awakenedDisposers.push(detach)
    return prep.session
  } catch (error: unknown) {
    console.log(`[femo-plugin] awaken ${id} enter failed: ${String(error)}`)
    return undefined
  }
}

/** 投影窗 descriptor 数据（【2026-09-09】版本按构建分流：0.1.3 runtime 的
 *  SUBAGENT_DESCRIPTOR_VERSION=3 且 strict 校验，版本不符身份投影直接解析
 *  为空（目录不收录该子项）；rc.2 旧版 runtime 仍用 v2。 */
function descriptorPayload(actor: string): Record<string, unknown> {
  return {
    version: nativeState.native ? 3 : 2,
    mode: 'one-shot',
    provider: 'femo-plugin',
    label: descriptorLabel(actor),
  }
}

/** 投影窗写入器持有表：窗 id → write handle（插件卸载时统一 close）。
 *  【2026-09-11】配合 attachProjectionWriter——重启后被官方冷装载的投影窗，
 *  femo 必须自己拿写权，否则事件只在内存、永不落盘（见该函数注释）。 */
const projectionWriters = new Map<string, { close(): Promise<void> }>()

/**
 * 给投影窗挂上"写盘所有权"（2026-09-11，Job 787/788 实测修）。
 *
 * 【为什么必须有这一步】dsh 官方持久化模型＝**每个会话一个 write handle**
 * （`sessionPersistence.open(id, 'write')`，单写者互斥；`SessionReadOnlyError`
 * 说明读写句柄是分开的）。官方 `agentLoop.resume()` 复活既有会话的配方就是
 * 「open('write') → handle.read(0) → sessions.prepare(seed) → appendUnstoredSuffix」，
 * 写入由 handle 负责。
 *
 * 而 femo 的 awakenProjectionWindow 只做了 readStoredLog + prepare/enter/announce
 * ——**没有拿 write handle**。于是：宿主重启后，官方把已存在的 god/stage 窗冷
 * 装载进 sessions store（`sessions.get(id)` 命中，走本函数的 existing 分支），
 * 此后 projectionAppend 的每次 append 都只进内存——**jsonl 一个字节不写**
 * （Job 787/788 探针实测：main/角色窗正常追加，god/stage 纹丝不动；前端照旧
 * 能显示，因为读的是活会话——一旦重启/重载就只剩残缺历史）。
 *
 * 【做法】照官方配方补齐：拿 write 权 → 补写内存里尚未落盘的后缀 → 订阅本窗
 * 后续事件继续写。**拿不到写权就原样不动**（说明已有别的持有者在写，例如
 * agent-loop 建的角色窗——那种情况落盘本来就正常）。
 *
 * @param ctx - 插件上下文（订阅随 fiber 卸载清理）。
 * @param session - 目标投影窗会话。
 * @param id - 窗 id（femo-proj-…）。
 */
async function attachProjectionWriter(ctx: Context, session: Session, id: string): Promise<void> {
  if (projectionWriters.has(id)) return
  const persistence = ctx.get('sessionPersistence') as
    | {
      open?(id: SessionId, access: 'read' | 'write'): Promise<{
        read(from: number, to?: number): Promise<{ events?: readonly SessionEvent[] }>
        append(events: readonly SessionEvent[]): Promise<void>
        close(): Promise<void>
      }>
    }
    | undefined
  if (persistence?.open === undefined) return
  try {
    const handle = await persistence.open(SessionId(id), 'write')
    try {
      const stored = await handle.read(0)
      let nextSeq = Array.isArray(stored.events) ? stored.events.length : 0
      // 串行化写入链：append 必须按 seq 连续（官方 assertContiguous），
      // 并发 append 会让后端拒绝整批。
      let chain: Promise<void> = Promise.resolve()
      const enqueue = (events: readonly SessionEvent[]): void => {
        if (events.length === 0) return
        chain = chain.then(() => handle.append(events)).catch((error: unknown) => {
          console.log(`[femo-plugin] 写盘失败 ${id}: ${String(error instanceof Error ? error.message : error).slice(0, 120)}`)
        })
      }
      // ① 先订阅（先到达的事件进缓冲），② 再读内存快照补后缀，③ 之后的新事件
      // 直接入链——三步都在同一 tick 内完成，中间不会漏事件也不会重复写。
      const buffered: SessionEvent[] = []
      let subscribed = false
      ctx.on('session/event', (target: Session, event: SessionEvent) => {
        if (target !== session) return
        if (!subscribed) {
          buffered.push(event)
          return
        }
        const seq = typeof (event as { seq?: unknown }).seq === 'number' ? (event as { seq: number }).seq : -1
        if (seq >= 0 && seq < nextSeq) return // 已写过（补后缀时含进去了）
        nextSeq = seq + 1
        enqueue([event])
      })
      const all = readSessionEvents(session)
      const suffix = all.slice(nextSeq)
      enqueue(suffix)
      nextSeq = all.length
      subscribed = true
      buffered.length = 0
      projectionWriters.set(id, handle)
    } catch (error: unknown) {
      await handle.close().catch(() => { /* 关闭失败不影响主流程 */ })
      throw error
    }
  } catch (error: unknown) {
    // 已有写者（agent-loop 建的角色窗等）→ 落盘本来就正常，保持原样。
  }
}

/** 插件卸载时收尾：flush + close 全部接管的写句柄（防句柄泄漏）。 */
export function disposeProjectionWriters(): void {
  for (const [id, handle] of projectionWriters) {
    void handle.close().catch(() => { /* 忽略 */ })
  }
  projectionWriters.clear()
}

/** 投影窗内容接缝·锚行（链路B 薄壳实验 2026-09-19）：每扇投影窗恰一条
 *  femo-plugin/chat{kind:'hub'}（幂等键 _srcSeq='femo-hub-anchor'，去重账本
 *  查重）。它是前端锚行节点（client-ui/hub-window.tsx）的挂载点：锚行位置
 *  起窗内容改由投影中心（hub）渲染；锚行之前的存量历史保持原样（兼容期）。
 *  surfaceOp 缺省（非 surface-eligible 事件，与 speaker/notice 行同款）。 */
function ensureHubAnchor(session: Session): void {
  try {
    const idx = dedupeIndexFor(session)
    if (idx.srcSeqs.has(HUB_ANCHOR_SRC)) return
    appendEvent(session, 'femo-plugin/chat', {
      kind: HUB_ANCHOR_KIND,
      text: '',
      _srcSeq: HUB_ANCHOR_SRC,
    })
    idx.srcSeqs.add(HUB_ANCHOR_SRC)
    console.log('[femo-plugin] hub anchor written (content seam → projection hub)')
  } catch (error: unknown) {
    console.log(`[femo-plugin] hub anchor write failed: ${String(error)}`)
  }
}

/** 创建/复用投影窗会话。幂等：内存命中直接返回；重启后冷投影窗从持久化
 *  唤醒（见 awakenProjectionWindow）；都不存在才新建。
 *  【2026-09-09 深夜改版】原生 + 白名单构建上，新建走 agent-loop
 *  （ctx.agents.create）持久化创建——0.1.3 里 origin:subagent 会话的历史
 *  加载必须走母地址且要求子项在官方目录（持久化子代理），裸会话两条路都
 *  不通（实测「not a healthy catalog child」）。agent-loop 创建带来：原生
 *  落盘（femo-plugin/chat 白名单补丁保证可载，JSONL 镜像重放降级为兜底）、
 *  官方目录收录（selectSubagent 可开）、侧边栏依旧隐藏。旧版路径与
 *  无补丁原生构建维持裸建（bare session 行为逐字节不变）。 */
async function ensureProjectionWindow(
  ctx: Context,
  sid: string,
  actor: string,
  cwd: string,
): Promise<Session | undefined> {
  const sessions = ctx.get('sessions') as
    | {
      get(id: SessionId): Session | undefined
      create(id: string, options: { seed?: unknown[]; meta: Record<string, unknown> }): Session
      enter?(session: Session): () => void
      announce?(session: Session): void
    }
    | undefined
  if (sessions === undefined) return undefined
  const id = projectionId(sid, actor)
  try {
    const existing = sessions.get(SessionId(id))
    if (existing !== undefined) {
      // 补 descriptor（旧会话/重启恢复的投影窗可能缺身份）
      if (!projectionHasDescriptor(existing)) {
        appendEvent(existing, 'subagent/descriptor', descriptorPayload(actor))
      }
      // 【2026-09-11】这类会话最常见来源＝官方冷装载（重启后）——它没有写句柄，
      // 不补这一步的话本窗之后写什么都只进内存（Job 787/788 实测 god/stage 的
      // jsonl 纹丝不动）。异步拿写权，不阻塞本窗的首次写入。
      void attachProjectionWriter(ctx, existing, id)
      ensureHubAnchor(existing)
      return existing
    }
    const awakened = await awakenProjectionWindow(ctx, sessions, id, cwd)
    if (awakened !== undefined) {
      if (!projectionHasDescriptor(awakened)) {
        appendEvent(awakened, 'subagent/descriptor', descriptorPayload(actor))
      }
      // 【2026-09-11】唤醒路径同样必须补写权（readStoredLog + prepare 只把历史
      // 装进内存，写入这一侧官方 resume 是用 open('write') + appendUnstoredSuffix）。
      await attachProjectionWriter(ctx, awakened, id)
      ensureHubAnchor(awakened)
      console.log(`[femo-plugin] projection window awakened: ${id} (${actor})`)
      return awakened
    }
    if (durableProjectionWindows()) {
      // 【0.1.3 持久化投影窗】agent-loop 创建（与主会话同生命周期语义）。
      // descriptor 在 create 返回后补写即可（实测会随会话落盘）。
      // ⚠️ create 报 SessionAlreadyExists（持久化文件已存在但本 boot 未装载）
      // 时【绝不回退裸建】——裸建的新头与持久化旧头构成双源冲突，会让官方
      // 目录列表直接抛错挂起（2026-09-09 实测）。此时本窗本轮不可写（投影
      // 事件丢弃、仅日志），等待冷复活机制落地。
      const agents = ctx.get('agents') as
        | { create(spec: { sessionId: SessionId; meta: Record<string, unknown> }): Promise<{ agent?: { session?: Session } }> }
        | undefined
      if (agents !== undefined) {
        try {
          const handle = await agents.create({
            sessionId: SessionId(id),
            meta: { cwd, parentSession: sid, origin: 'subagent' },
          })
          const session = handle.agent?.session
          if (session !== undefined) {
            appendEvent(session, 'subagent/descriptor', descriptorPayload(actor))
            ensureHubAnchor(session)
            console.log(`[femo-plugin] projection window created (durable): ${id} (${actor})`)
            return session
          }
          console.log(`[femo-plugin] durable projection window ${id}: no session on handle — window unavailable this boot`)
          return undefined
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          if (message.includes('already exists')) {
            // 持久化文件已在、本 boot 未装载：跳过本窗（不裸建、不投毒）。
            console.log(`[femo-plugin] durable projection window ${id} exists but is not live — window unavailable this boot`)
            return undefined
          }
          console.log(`[femo-plugin] durable projection window ${id} create failed: ${String(error)} — falling back to bare create`)
        }
      }
    }
    const created = sessions.create(id, {
      meta: { cwd, parentSession: sid, origin: 'subagent' },
    })
    appendEvent(created, 'subagent/descriptor', descriptorPayload(actor))
    ensureHubAnchor(created)
    console.log(`[femo-plugin] projection window created: ${id} (${actor})`)
    return created
  } catch (error: unknown) {
    console.log(`[femo-plugin] ensureProjectionWindow(${actor}) failed: ${String(error)}`)
    return undefined
  }
}

/** 上帝窗 + FEMO内窗 + 该FEMO脚本全部角色窗的集合（创建/复用）。
 *  唤醒错峰（2026-08-30）：每个窗的冷唤醒（persistence.prepare）内部同步解压+
 *  解析整份日志，大会话一次可堵 event loop 秒级（diag 实锤 stall 2.5~10s）。
 *  窗与窗之间 yield 把控制权还给事件循环，让前端心跳/其他请求能穿插呼吸——
 *  不减少总耗时，但把「一次连堵 N 秒」摊平成 N 次短堵，UI 不再整段冻结。 */
async function ensureProjectionWindows(
  ctx: Context,
  sid: string,
  actors: string[],
  cwd: string,
): Promise<ProjectionWindows> {
  const god = await ensureProjectionWindow(ctx, sid, GOD_ACTOR, cwd)
  await yieldToEventLoop()
  const stage = await ensureProjectionWindow(ctx, sid, STAGE_ACTOR, cwd)
  await yieldToEventLoop()
  const map = new Map<string, Session>()
  for (const actor of actors) {
    const win = await ensureProjectionWindow(ctx, sid, actor, cwd)
    if (win !== undefined) map.set(actor, win)
    await yieldToEventLoop()
  }
  return { god, stage, actors: map }
}

// ── 3) 投影写入（已拆管）────────────────────────────────────────────────
// 【链路B 2026-09-19 断电·2026-09-20 大扫除拆管】projectionAppender /
// projectionAppend 整体删除——断电时本处是唯一收口断点（write 直接 return），
// 大扫除后全链路（appendChatProjected/appendChatBroadcast 窗半、
// subagent(-native)/main-actor 镜像、engine-events 行写入）再无调用方，机器
// 随之退役。投影窗内容由投影中心（hub）供给：桥三个咽喉落账 + 宿主
// hub-feed 实时草稿。回滚 = git 历史（e85a929 之前版本含完整写入机）。

/** 单会话投影窗注册表：sid → 投影窗集合（含角色窗）。ensure 异步（冷投影窗
 * 唤醒要走持久化 I/O），inflight 按 sid 链式串行——flow_start 与 ai_request
 * 并发调用时后者等待前者完成再幂等复用，绝不并发双建同 id 窗。 */
export interface ProjectionRegistry {
  windows: Map<string, ProjectionWindows>
  ensure(sid: string, actors: string[], cwd: string): Promise<ProjectionWindows>
  get(sid: string): ProjectionWindows | undefined
}

export function createProjectionRegistry(ctx: Context): ProjectionRegistry {
  const windows = new Map<string, ProjectionWindows>()
  const inflight = new Map<string, Promise<unknown>>()

  // 去重索引的全局增量钩子（2026-08-26 性能修复配套）：任何会话事件落地后
  // 给【已建索引】的窗补键——无论 append 来自插件（projectionAppend/mirror/
  // subagent）还是 dsh 内部机制（surface 自动补 turn/start 等），索引不漏键。
  // 未建索引的会话（普通主会话/陌生窗）WeakMap 查询即返回，开销 O(1) 可忽略。
  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    dedupeMarkIndexed(session, event.type, event.data)
  })

  const buildOnce = async (sid: string, actors: string[], cwd: string): Promise<void> => {
    const existing = windows.get(sid)
    if (existing !== undefined) {
      // 补充新角色窗（多FEMO脚本/角色追加）；补充唤醒同样逐窗错峰。
      for (const actor of actors) {
        if (!existing.actors.has(actor)) {
          const win = await ensureProjectionWindow(ctx, sid, actor, cwd)
          if (win !== undefined) existing.actors.set(actor, win)
          await yieldToEventLoop()
        }
      }
      if (existing.god === undefined) {
        existing.god = await ensureProjectionWindow(ctx, sid, GOD_ACTOR, cwd)
        await yieldToEventLoop()
      }
      // FEMO内窗同上帝窗兜底（旧 registry 条目/重启前建的窗可能没有 stage）。
      if (existing.stage === undefined) {
        existing.stage = await ensureProjectionWindow(ctx, sid, STAGE_ACTOR, cwd)
        await yieldToEventLoop()
      }
    } else {
      const created = await ensureProjectionWindows(ctx, sid, actors, cwd)
      windows.set(sid, created)
    }
  }
  return {
    windows,
    ensure(sid, actors, cwd) {
      const prev = inflight.get(sid) ?? Promise.resolve()
      const task = prev.then(() => buildOnce(sid, actors, cwd))
      inflight.set(sid, task)
      void task.catch(() => undefined) // 调用方持有 task 处理错误；这里只防 unhandledRejection
      const cleanup = (): void => {
        if (inflight.get(sid) === task) inflight.delete(sid)
      }
      task.then(cleanup, cleanup)
      return task.then(() => windows.get(sid)!)
    },
    get(sid) {
      return windows.get(sid)
    },
  }
}

// ── 4) 主会话 → 上帝窗镜像 → 已迁至 god-mirror.ts（2026-08-26 整理）───────
