/**
 * session-roster.ts — FEMO 会话名册（宿主方言 → 投影中心 hub）。
 *
 * 「哪些会话算 FEMO 会话」是宿主的事。dsh 的判据（2026-10-07 换轴，唯一尺子在
 *  femoIdentity.isFemoSession）：**有戏有账**——宿主 host-history 有账
 *  （user_data/host-history/drafts/<sid>.json 存在 = 挂过脚本/跑过 Job）即算；
 *  旧会话 header 里的预设标记 'femo-plugin' 只当 legacy 兜底。此前的主判据
 *  「agentPreset 命中」随「去预设」退役——那正是历史坑：/femo 路径的会话不走
 *  模式菜单、preset 判不到（实锤：真主会话 session-89aba104 是这类），换轴后
 *  这类会话天然入册。
 * hub 只记账出清单（roster.json + GET /sessions + WS ctrl 'sessions'），
 * 网页主会话面板按宿主分组画下拉；zcode 以后实现自己的 announcer（它自己定义
 * 什么算 FEMO 会话），hub/页面零改动。
 *
 * 三条上报路径（全部 best-effort，hub 不在线绝不挡会话）：
 *  ① 冷扫描（插件启动）：ctx.sessionQuery.listSessions() 枚举全部持久化会话，
 *    **只取主会话**（无 parentSession、非 subagent），有戏有账者入册——老会话
 *    不打开也进下拉。零 I/O 冷读与 dsh 自己的冷清单同款
 *    （sessionProjectionCache.cachedSnapshot；seeded 走 cachedPredecessorTitle）。**不 bind**：换绑只归「说话即绑」与面板。
 *    名字在宿主侧解析成成品再上报（2026-09-21 拍板「hub 不劳心」）：dsh 列表页
 *    同款 displayTitleOf 回退（title → cwd 工作区名 → 空）；没被用户碰过的空壳
 *    （无 title 事件也无 job 账）随单 delist（hub 只标 active=False 不删档，
 *    「说话即绑」会把真用到的会话自动重新激活）。
 *  ② 说话即绑（2026-09-21 用户拍板）：用户在 FEMO 主会话发言（session/event
 *    的 user/message 真用户）→ upsert+bind 一并公告 = HTML 投影中心的 dsh
 *    主会话当场切过去（名单里没有就先加入再上台）。steer 派工料包（插件
 *    来源：旧版 kind='plugin'、0.1.7 起 kind='plugin:femo-plugin'）不算用户说话。
 *  （原「③ 选预设入册」已随去预设整条退役，2026-10-07。）
 *
 * 上报形态：**只有增量、没有快照覆盖**（POST /sessions/announce
 * {source, upsert, bind, delist}，hub 幂等）——本进程重启后内存空了也绝不冲掉
 * hub 已有名单。失败重试 5s×12 次，之后放弃（说话/切预设的自然重报兜底）。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, SessionEvent } from '@deepseek-ai/dsh-session'
import { isFemoSession } from './femoIdentity'
import { readSessionEvents } from './compat/session-events'
import { readSessionCurrentJob, readSessionJobIds } from './state-files'
import { hostAddr } from './hub/hub-feed' // 宿主标签（announce 的 source 与喂/读侧同一词）
import { hubBaseUrl } from '../../../femo2host/host/hub-client.mjs' // hub 地址唯一解析（2026-09-24 A2）

const HAS_FETCH: boolean = typeof fetch === 'function'
const announceUrl = (): string => `${hubBaseUrl()}/sessions/announce`

// ── 上报队列（增量 + 失败重试）────────────────────────────────────────────
export interface RosterEntry {
  sid: string
  name?: string
  /** 该会话最新场次（host-history 账的 currentJobId，jobIds 兜底）——
   *  页面选中主会话时顺藤挂上那场戏。 */
  job?: number
}
const pendingUpserts = new Map<string, RosterEntry>()
/** 宿主 UI 顺序（上次完整公告的 sid 序；说话/切预设把新会话提到队首后更新）。
 *  dsh 的排法=DSH 列表页同款：最后活动时间（max(createdAt, lastPromptAt)）降序。 */
let lastOrder: string[] = []
let pendingBind: string | null = null
let pendingOrder: string[] | null = null
let pendingDelist: string[] | null = null
let flushTimer: ReturnType<typeof setTimeout> | undefined
let attempts = 0

/** 公告一批会话（幂等排队）；bindSid 非空 = 顺带把主 session 换成它（说话即绑）；
 *  order 非空 = 宿主 UI 顺序全列表（hub 只存不判，照单排）；
 *  delist 非空 = 这些 sid 在 hub 名册降级（active=False，不删档）。 */
export function announceSessions(entries: Array<RosterEntry>, bindSid?: string,
                                 order?: string[], delist?: string[]): void {
  if (!HAS_FETCH) return
  let dirty = false
  for (const e of entries ?? []) {
    const sid = String(e?.sid ?? '').trim()
    if (sid === '') continue
    pendingUpserts.set(sid, {
      sid,
      name: String(e?.name ?? '').trim(),
      ...(typeof e?.job === 'number' && Number.isFinite(e.job) ? { job: e.job } : {}),
    })
    dirty = true
  }
  const bind = String(bindSid ?? '').trim()
  if (bind !== '') {
    pendingBind = bind
    dirty = true
  }
  if (Array.isArray(order) && order.length > 0) {
    lastOrder = order.map(s => String(s))
    pendingOrder = lastOrder
    dirty = true
  }
  if (Array.isArray(delist) && delist.length > 0) {
    pendingDelist = delist.map(s => String(s))
    dirty = true
  }
  if (!dirty) return
  attempts = 0
  if (flushTimer === undefined) {
    flushTimer = setTimeout(() => {
      flushTimer = undefined
      void flush()
    }, 50)
  }
}

async function flush(): Promise<void> {
  if (pendingUpserts.size === 0 && pendingBind === null && pendingOrder === null
      && pendingDelist === null) return
  const body: Record<string, unknown> = {
    source: hostAddr(),
    upsert: [...pendingUpserts.values()].map((e) => ({
      sid: e.sid, name: e.name,
      ...(e.job !== undefined ? { job: e.job } : {}),
    })),
  }
  if (pendingBind !== null) body.bind = pendingBind
  if (pendingOrder !== null) body.order = pendingOrder
  if (pendingDelist !== null) body.delist = pendingDelist
  // 上报补超时（2026-09-29）：此前裸 fetch——挂住的连接会把这一轮 flush 吊死，
  // 而下方重试只在「报错」时触发，救不了「永远不返回」。
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 8_000)
  try {
    const resp = await fetch(announceUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
    if (!resp.ok) throw new Error(`hub responded ${resp.status}`)
    pendingUpserts.clear()
    pendingBind = null
    pendingOrder = null
    pendingDelist = null
    attempts = 0
  } catch {
    if (++attempts <= 12) {
      if (flushTimer === undefined) {
        flushTimer = setTimeout(() => {
          flushTimer = undefined
          void flush()
        }, 5000)
      }
    } else {
      // 放弃这一批（hub 长时间不在线）：说话/切预设会自然重报，不丢名单语义
      pendingUpserts.clear()
      pendingBind = null
      pendingOrder = null
      pendingDelist = null
      attempts = 0
    }
  } finally {
    clearTimeout(timer)
  }
}

// ── 名字与判据 ────────────────────────────────────────────────────────────

/** 会话标题：session/title 日志事件倒扫（与 presetOverrides 重建同款回放）；
 *  无标题回退空串（成品名由 displayNameOf 继续走 cwd 工作区名回退）。 */
function titleOfSession(session: unknown): string {
  const events = readSessionEvents(session)
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'session/title') continue
    const title = event.data?.title
    if (typeof title === 'string' && title.trim() !== '') return title.trim()
  }
  return ''
}

/** dsh 列表页同款工作区名（workspaceTitleOf，dsh-api-session-controller）：
 *  路径末段（分隔符归一）。 */
function workspaceTitleOf(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '')
  const separator = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return trimmed.slice(separator + 1)
}

/** 成品显示名（dsh displayTitleOf 同款回退）：标题 → cwd 工作区名 → 空串。
 *  2026-09-21 拍板：名字在宿主侧解析成成品再上报——hub 只收 id+名字，页面只展示。 */
function displayNameOf(title: string, cwd: string): string {
  if (title !== '') return title
  if (cwd !== '') {
    const base = workspaceTitleOf(cwd)
    if (base !== '') return base
  }
  return ''
}

/** 会话 header 的 cwd（冷事实；取不到=空串）。 */
function cwdOfSession(session: unknown): string {
  const header = (session as { header?: { cwd?: unknown } } | undefined)?.header
  return typeof header?.cwd === 'string' ? header.cwd : ''
}

/** 按会话对象取成品显示名（与 announce 上报的 name 同口径：标题→工作区名
 *  回退；取不到=空串）。挂载共同账本的 session_name 用——session id 无人
 *  看得懂，下拉菜单之类给人看的场合显示它（2026-10-04 用户拍板）。 */
export function rosterNameOfSession(session: unknown): string {
  return displayNameOf(titleOfSession(session), cwdOfSession(session))
}

/** 冷枚举用的最小消费面（真服务由 dsh 挂在 ctx 上；字段缺失=此部署没挂，跳过）。 */
interface ColdHeaderLike {
  id?: unknown
  agentPreset?: unknown
  parentSession?: unknown
  origin?: unknown
  cwd?: unknown
  /** DSH 列表页排序键前半截（updatedAt = max(createdAt, lastPromptAt)）。 */
  createdAt?: unknown
}

/** 软取宿主服务：**必须走 ctx.get**（返回 undefined=没挂），不能属性访问——
 *  cordis 对未声明 inject 的服务属性访问直接抛 'without inject'（list-cache 的
 *  sessionPersistence 同款纪律：不声明 inject 避免 PENDING，运行时软取）。 */
function getService(ctx: Context, name: string): unknown {
  try {
    return (ctx as unknown as { get?: (n: string) => unknown }).get?.(name)
  } catch {
    return undefined
  }
}

/** 冷观察取会话标题 + lastPromptAt（DSH 列表页排序键的后半截）：
 *  sessionQuery.observeSession（dsh 搜索同款「不开代理读会话」通道）→
 *  title/sessionListMetadata 投影 → events 倒扫 session/title 兜底标题。
 *  租约用完即弃；任何失败静默（标题空、排序键留 createdAt）。 */
async function observeTitle(query: unknown, sessionId: string, keys?: Map<string, number>): Promise<string> {
  const observe = (query as { observeSession?: (id: unknown, opts?: unknown) => Promise<unknown> }).observeSession
  if (typeof observe !== 'function') return ''
  let obs: unknown
  try {
    obs = await observe.call(query, sessionId, { projectionMode: 'all' })
    const o = obs as {
      projections?: { values?: Record<string, unknown> }
      events?: Array<{ type?: string; data?: { title?: unknown } }>
    }
    const values = o.projections?.values
    if (keys !== undefined && values) {
      const meta = values.sessionListMetadata as { lastPromptAt?: unknown } | undefined
      const lp = typeof meta?.lastPromptAt === 'number' ? meta.lastPromptAt : 0
      if (lp > (keys.get(sessionId) ?? 0)) keys.set(sessionId, lp)
    }
    const title = values?.title
    if (typeof title === 'string' && title.trim() !== '') return title.trim()
    const events = o.events
    if (Array.isArray(events)) {
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index]
        if (event?.type !== 'session/title') continue
        const t = event.data?.title
        if (typeof t === 'string' && t.trim() !== '') return t.trim()
      }
    }
    return ''
  } catch {
    return ''
  } finally {
    if (obs !== undefined) {
      try {
        const sym = (Symbol as { dispose?: symbol }).dispose
        const bySym = sym !== undefined ? (obs as Record<PropertyKey, unknown>)[sym] : undefined
        if (typeof bySym === 'function') (bySym as () => void).call(obs)
        else {
          const dispose = (obs as { dispose?: () => void }).dispose
          if (typeof dispose === 'function') dispose.call(obs)
        }
      } catch { /* best effort */ }
    }
  }
}

/** dsh 方言的「FEMO 会话」判据：**唯一尺子在 femoIdentity.isFemoSession**
 *  （2026-10-07 换轴：权威=host-history 有账即「有戏有账」，旧预设标记只当
 *  legacy 命中）。这里只做再导出，供戏外旁挂等同尺消费——全插件只有一份判据，
 *  杜绝另写一套漂移（原两路并集的第二路「preset 命中」已降级为兼容读法）。
 *  导出=全插件唯一尺子（2026-09-23 用户拍板「非 FEMO 会话不发」：god-mirror
 *  喂侧同尺拦闸）。 */
export { isFemoSession }

/** 引擎根（registerSessionRoster 注入；host-history 账本判定用的那根已在
 *  femoIdentity 里配置，这里保留一份供本文件读最新场次用）。 */
let femoRootDir = ''

/** 读会话最新场次：host-history 账（drafts/<sid>.json）的 currentJobId 优先，
 *  jobIds 末位兜底；账缺席（从没跑过 femo 的会话）→ undefined。 */
async function readLatestJob(femoRoot: string, sid: string): Promise<number | undefined> {
  if (femoRoot === '' || sid === '') return undefined
  try {
    const cur = await readSessionCurrentJob(femoRoot, sid)
    if (typeof cur === 'number' && cur > 0) return cur
    const ids = await readSessionJobIds(femoRoot, sid)
    const last = Array.isArray(ids) ? ids[ids.length - 1] : undefined
    if (typeof last === 'number' && last > 0) return last
  } catch {
    /* 账缺席：正常（从没跑过 femo） */
  }
  return undefined
}

/** ① 冷扫描：全部持久化主会话里的 FEMO 会话入册（不 bind），并按 **DSH 自己
 *  列表页的排法**（updatedAt = max(createdAt, lastPromptAt) 降序，dsh-api-
 *  session-controller 同款公式）排出 order 随单上报——宿主界面咋排咱就咋排。
 *  第一遍零 I/O 过滤+记 createdAt/cwd；第二遍对命中者冷观察取标题与
 *  lastPromptAt（8 个一批，setImmediate 让路 event loop），名字按 dsh 列表页
 *  displayTitleOf 回退成品化，空壳（无 title 无 job）随单 delist（hub 只标
 *  active=False）。服务未挂（装配序）稍后重试；三次都缺就放弃——钩子路径兜底。 */
async function coldScanRoster(ctx: Context, femoRoot: string, attempt: number): Promise<void> {
  try {
    const query = getService(ctx, 'sessionQuery') as
      | { listSessions?: (signal?: unknown) => Promise<Array<{ header?: ColdHeaderLike }>> }
      | undefined
    if (typeof query?.listSessions !== 'function') {
      if (attempt < 2) {
        setTimeout(() => { void coldScanRoster(ctx, femoRoot, attempt + 1) }, attempt === 0 ? 3000 : 10000)
      }
      return
    }
    const records = await query.listSessions()
    const entries: RosterEntry[] = []
    const keys = new Map<string, number>()   // sid → updatedAt（DSH 列表页排序键）
    const cwds = new Map<string, string>()   // sid → cwd（displayTitleOf 的无名回退）
    for (const record of records ?? []) {
      const header = record?.header
      if (!header || header.id === undefined) continue
      if (header.origin === 'subagent' || header.parentSession !== undefined) continue
      const sid = String(header.id)
      // 身份判据（2026-10-07 换轴）：**有戏有账**即入册——user_data/host-history/
      // drafts/<sid>.json 存在（挂过脚本或跑过 Job）。旧预设标记在 femoIdentity
      // 里当 legacy 兜底，此处不必单独问 header。
      if (!isFemoSession(sid)) continue
      entries.push({ sid, name: '' })
      keys.set(sid, typeof header.createdAt === 'number' ? header.createdAt : 0)
      if (typeof header.cwd === 'string' && header.cwd !== '') cwds.set(sid, header.cwd)
    }
    // 第二遍：标题 + 最新场次 + lastPromptAt（DSH 排序键的后半截）。名字=成品
    // （displayTitleOf 回退）；分拣：被用户碰过（有 title）或跑过戏（有 job）
    // 才在册，空壳（都没有）delist——hub 只标 active=False，说话即绑会把真
    // 用到的自动重新激活。
    const inRoster: RosterEntry[] = []
    const emptySids: string[] = []
    let withTitle = 0
    for (let i = 0; i < entries.length; i += 8) {
      const batch = entries.slice(i, i + 8)
      await Promise.all(batch.map(async (e) => {
        const title = await observeTitle(query, e.sid, keys)
        e.job = await readLatestJob(femoRootDir, e.sid)
        e.name = displayNameOf(title, cwds.get(e.sid) ?? '')
        if (title !== '') withTitle += 1
        if (title !== '' || e.job !== undefined) inRoster.push(e)
        else emptySids.push(e.sid)
      }))
      await new Promise(resolve => setImmediate(resolve))
    }
    inRoster.sort((a, b) => (keys.get(b.sid) ?? 0) - (keys.get(a.sid) ?? 0))
    console.log(`[femo-plugin] session roster cold scan: ${inRoster.length} femo session(s) / ${records?.length ?? 0} total, ${withTitle} titled, ${emptySids.length} empty delisted (DSH UI order)`)
    if (inRoster.length > 0 || emptySids.length > 0) {
      announceSessions(inRoster, undefined,
        inRoster.length > 0 ? inRoster.map(e => e.sid) : undefined, emptySids)
    }
  } catch (error) {
    console.log(`[femo-plugin] session roster cold scan failed: ${String(error)}`)
  }
}

/** 把一个 sid 提到宿主 UI 顺序的队首（刚活跃的会话在 DSH 列表页也排最前），
 *  返回新 order；lastOrder 同步更新。 */
function promoteInOrder(sid: string): string[] {
  const next = [sid, ...lastOrder.filter(x => x !== sid)]
  lastOrder = next
  return next
}

/** 注册名册钩子（index.ts 总装调用一次；必须在 registerPersonaHooks 之后——
 *  身份轴（femoIdentity）的根目录在那一步注入）。
 *  femoRoot=引擎根（host-history 账本判定与读最新场次共用）。 */
export function registerSessionRoster(ctx: Context, femoRoot: string): void {
  femoRootDir = String(femoRoot || '').replace(/[\\/]+$/, '')
  // 【2026-10-07 去预设】旧的「③ 选预设入册」整条退役：本插件不再有预设，
  // 也没有「选 FEMO 模式」这个动作；会话入册只剩两条路——冷扫描（有戏有账）
  // 与说话即绑。存量会话若还带着旧预设标记，冷扫描那路照样认得（femoIdentity
  // 的 legacy 命中），无需这里再补一条。
  // ② 说话即绑：用户在 FEMO 主会话发言 → upsert + bind（投影窗自身与子代理
      // 会话带 parentSession，天然排除；steer 派工（插件来源：旧 kind='plugin'、
      // 0.1.7 起 kind='plugin:femo-plugin'）都不算说话——只认缺 source 与 'user'。
  ctx.on('session/event', (session: { id: unknown; header: { parentSession?: unknown } }, event: SessionEvent) => {
    try {
      if (session.header.parentSession !== undefined) return
      if (event.type !== 'user/message') return
      const data = event.data as { source?: { kind?: unknown } }
      const srcKind = data.source?.kind
      if (srcKind !== undefined && srcKind !== 'user') return
      if (!isFemoSession(String(session.id))) return
      const sid = String(session.id)
      void (async (): Promise<void> => {
        const job = await readLatestJob(femoRootDir, sid)
        announceSessions([{ sid, name: displayNameOf(titleOfSession(session), cwdOfSession(session)), job }],
                          sid, promoteInOrder(sid))
      })()
    } catch {
      /* 名册是旁路，绝不挡会话 */
    }
  })
  // ① 冷扫描（后台，不挡装配）
  void coldScanRoster(ctx, femoRoot, 0)
}
