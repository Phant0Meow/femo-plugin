/**
 * hub-proxy.ts — 投影中心只读代理（链路B 薄壳实验 2026-09-19）。
 *
 * 前端锚行节点（client-ui/hub-window.tsx）需要 hub 的行数据。hub
 * （femo2host/projection_hub.py）只绑 127.0.0.1，浏览器跨端口拿不到；
 * 宿主进程（桥同环境，知道 FEMO_PROJECTION_PORT）代理一个只读接口：
 *   GET /femo-plugin/hub-view?sessionId=&win=&job=&after=
 *     → hub GET /view?job=&view=&after=（行 + next），宿主顺带做
 *       「窗 → 视角」与「主会话 → Job」两个映射：
 *   · sessionId 必须是 femo-proj-<主sid>-<win> 形态；win=god/stage/actorKey；
 *   · actorKey → 裸角色名（sessionActors 内存优先，miss 时查 hub /views
 *     花名册——2026-09-20 起取代 turn_scopes 文件回退，新链路=账本自含）
 *     → view='actor:<裸名>'；
 *   · job 缺省解析：runState.sidIndex（内存镜像）优先，会话记录 currentJobId
 *     （state-files 落盘索引）兜底；都拿不到 → hub 花名册按 latest 兜底、
 *     hub-view 返回 live:false 空数据。
 *
 * 本文件同时是宿主侧读 hub 的公用口（2026-09-20）：resolveFemoJobId /
 * fetchHubRoster / hubActorNames / hubActorBareName 导出给 routes 与
 * projection-input 复用——凡是旧链路拿 turn_scopes 文件当「重启后兜底」的
 * 消费点，一律改走这里。
 *
 * best-effort 纪律与 hub-feed 同款：hub 不在线/超时一律 200 + ok:false 空数据，
 * 前端显示连接状态，绝不 5xx 炸 UI。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config'
import type { RunState } from '../events/engine-events'
import { readSessionCurrentJob } from '../state-files'
import { parseProjectionWindowId, projectionActorKey } from '../projection/projection'
import { hostAddr } from './hub-feed' // 会话寻址的宿主标签（与喂侧同一词，空回退同值）
import { writeJson } from '../http'
import { hubBaseUrl } from '../../../../femo2host/host/hub-client.mjs' // hub 地址唯一解析（2026-09-24 A2）

interface HubViewRow {
  n: number
  t?: number
  zone?: string
  kind?: string
  actor?: string
  text?: string
  host?: string
  seg?: string
  open?: boolean
  items?: Array<Record<string, unknown>>
  drafts?: Array<Record<string, unknown>>
  targets?: string[] | null
}

async function hubFetch(path: string, timeoutMs = 4000): Promise<{ ok: boolean; data: unknown }> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const resp = await fetch(`${hubBaseUrl()}${path}`, { signal: ctl.signal })
    return { ok: resp.ok, data: await resp.json() }
  } catch {
    return { ok: false, data: null }
  } finally {
    clearTimeout(timer)
  }
}

/** 主会话当前 Job：runState.sidIndex（内存镜像）优先，会话记录索引兜底，
 * 都没有返回 undefined（调用方自行决定 latest 兜底与否）。 */
export async function resolveFemoJobId(resolved: ResolvedConfig, runState: RunState, mainSid: string): Promise<number | undefined> {
  const memJob = runState.sidIndex.get(mainSid)
  if (memJob !== undefined && runState.jobs.get(memJob) !== undefined) return memJob
  return await readSessionCurrentJob(resolved.femoRoot, mainSid).catch(() => undefined)
}

/** hub 花名册单条：id='actor:<host>:<基形>'，base=基形（targets 匹配用的裸名），
 * name=显示长名（带括号），key=消毒键。 */
export interface HubRosterEntry {
  id: string
  name: string
  base?: string
  host?: string
  key?: string
}

/** 拉 hub /views 花名册（视角清单=新链路唯一权威：启动运行花名册+账本实际出场，
 * 跨重启有效）。jobId 缺省 → hub 按最新场次给。失败 → 空数组（best-effort）。 */
export async function fetchHubRoster(jobId: number | undefined): Promise<HubRosterEntry[]> {
  const q = jobId !== undefined ? `?job=${jobId}` : ''
  const { ok, data } = await hubFetch(`/views${q}`)
  if (!ok || typeof data !== 'object' || data === null) return []
  const views = (data as { views?: unknown }).views
  if (!Array.isArray(views)) return []
  return views.filter((v): v is HubRosterEntry =>
    typeof v === 'object' && v !== null && typeof (v as HubRosterEntry).id === 'string' &&
    String((v as HubRosterEntry).id).startsWith('actor:'))
}

/** 角色基名清单（去重；兜底用——旧链路 /actors 的 turn_scopes 文件回退已由它取代）。 */
export async function hubActorNames(jobId: number | undefined): Promise<string[]> {
  const roster = await fetchHubRoster(jobId)
  return [...new Set(roster.map(v => v.base ?? v.name).filter(n => n.length > 0))]
}

/** actorKey（消毒键）→ 裸角色名：按基形与显示名两个形态的消毒键匹配。 */
export function rosterBareName(roster: HubRosterEntry[], actorKey: string): string | undefined {
  for (const v of roster) {
    if (projectionActorKey(v.base ?? v.name) === actorKey || projectionActorKey(v.name) === actorKey) {
      return v.base ?? v.name
    }
  }
  return undefined
}

/** 角色窗窗名：sessionActors 内存优先、hub 花名册回退（2026-09-20 起
 * 取代 turn_scopes 文件——花名册随账本落盘，重启后照常可查）。 */
async function resolveActorName(runState: RunState, mainSid: string, actorKey: string, jobId: number | undefined): Promise<string | undefined> {
  const mem = runState.sessionActors.get(mainSid)
  const hit = mem?.find(name => projectionActorKey(name) === actorKey)
  if (hit !== undefined) return hit
  return rosterBareName(await fetchHubRoster(jobId), actorKey)
}

/** 窗参数（god/stage/actorKey）→ hub 视角名。 */
async function viewOf(runState: RunState, mainSid: string, win: string, jobId: number | undefined): Promise<string> {
  if (win === 'god') return 'god'
  if (win === 'stage') return 'stage'
  const actor = await resolveActorName(runState, mainSid, win, jobId)
  return `actor:${actor ?? win}`
}

function mainSidOf(url: URL): string | undefined {
  const sessionId = url.searchParams.get('sessionId') ?? ''
  const parsed = parseProjectionWindowId(sessionId)
  return parsed !== undefined && parsed.mainSid.length > 0 ? parsed.mainSid : undefined
}

/** 诊断：每个 (sid,win) 的解析签名变化才打 log（前端 1.5s 轮询不刷屏）。 */
const proxyLastSig = new Map<string, string>()

/** 注册只读代理路由（routes.ts 总装调用；webServer 缺席时 no-op）。 */
export function registerHubProxy(
  resolved: ResolvedConfig,
  runState: RunState,
  register: (spec: { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void }) => void,
): void {
  register({
    kind: 'exact',
    path: '/femo-plugin/hub-view',
    handler: (req, res) => {
      void (async (): Promise<void> => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const mainSid = mainSidOf(url)
        if (mainSid === undefined) {
          writeJson(res, 200, { ok: false, error: 'sessionId (femo-proj-*) required', live: false, rows: [], next: 0 })
          return
        }
        const win = url.searchParams.get('win') ?? 'god'
        const after = Math.max(0, Number(url.searchParams.get('after') ?? '0') || 0)
        const jobParam = Number(url.searchParams.get('job'))
        const explicitJob = Number.isFinite(jobParam) && jobParam > 0 ? jobParam : undefined
        // ── 上帝窗=会话寻址（2026-09-20 会话账本）─────────────────────────
        // god 绑 (host, 主会话)：会话账本永远在记（录制无条件），无运行也照读。
        // 显式带 job 参数仍走 job 读法（手工探测/对账用）。
        if (win === 'god' && explicitJob === undefined) {
          const session = `${hostAddr()}:${mainSid}`
          const sigS = `${mainSid}|god|session`
          if (proxyLastSig.get(`${mainSid}|god`) !== sigS) {
            proxyLastSig.set(`${mainSid}|god`, sigS)
            console.log(`[femo-hub][proxy] god(session): mainSid=${mainSid.slice(-12)} session=${session} after=${after}`)
          }
          const { ok, data } = await hubFetch(`/view?session=${encodeURIComponent(session)}&view=god&after=${after}`)
          if (!ok || typeof data !== 'object' || data === null) {
            console.log(`[femo-hub][proxy] hub fetch failed: session=${session}（hub 不在线或超时）`)
            writeJson(res, 200, { ok: false, live: false, job: null, view: 'god', rows: [] as HubViewRow[], next: after })
            return
          }
          const bodyS = data as { rows?: HubViewRow[]; next?: number }
          writeJson(res, 200, { ok: true, live: true, job: null, view: 'god', rows: bodyS.rows ?? [], next: bodyS.next ?? after })
          return
        }
        const jobId = explicitJob ?? await resolveFemoJobId(resolved, runState, mainSid)
        if (jobId === undefined) {
          // 本会话还没有运行过任何 Job：空态（不是错误）。
          writeJson(res, 200, { ok: true, live: false, job: null, view: win, rows: [], next: 0 })
          return
        }
        const view = await viewOf(runState, mainSid, win, jobId)
        const sig = `${mainSid}|${win}|${jobId}|${view}`
        if (proxyLastSig.get(`${mainSid}|${win}`) !== sig) {
          proxyLastSig.set(`${mainSid}|${win}`, sig)
          console.log(`[femo-hub][proxy] ${win}: mainSid=${mainSid.slice(-12)} job=${jobId} view=${view} after=${after}`)
        }
        const { ok, data } = await hubFetch(`/view?job=${jobId}&view=${encodeURIComponent(view)}&after=${after}`)
        if (!ok || typeof data !== 'object' || data === null) {
          console.log(`[femo-hub][proxy] hub fetch failed: job=${jobId} view=${view}（hub 不在线或超时）`)
          writeJson(res, 200, { ok: false, live: false, job: jobId, view, rows: [] as HubViewRow[], next: after })
          return
        }
        const body = data as { rows?: HubViewRow[]; next?: number }
        writeJson(res, 200, { ok: true, live: true, job: jobId, view, rows: body.rows ?? [], next: body.next ?? after })
      })().catch(() => {
        writeJson(res, 200, { ok: false, live: false, rows: [], next: 0 })
      })
    },
  })
}
