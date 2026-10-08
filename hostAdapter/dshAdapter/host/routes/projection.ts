/**
 * projection.ts — 投影窗域的 HTTP 处理体（2026-09-25 刀⑤c 自 routes.ts 抽出）。
 *
 * 三个读数口：/actors（视角菜单角色名单，内存优先+hub 花名册兜底）、
 * /projection-state（composer 发送/停止钮的权威状态源）、/projection-windows
 * （视角菜单的窗 id 列表，重启后冷重建注册表）。/projection-input 的业务体
 * 早在 projection-input.ts，注册表直接委派，不经此文件。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
import type { Context } from '@deepseek-ai/cordis'
import type { ResolvedConfig } from '../config'
import type { RunState } from '../events/engine-events'
import { projectionStateOf } from '../events/engine-events'
import { parseProjectionWindowId, projectionActorKey, type ProjectionRegistry } from '../projection/projection'
import { resolveFemoJobId, hubActorNames, fetchHubRoster, rosterBareName } from '../hub/hub-proxy'
import { sessionFemoRelation } from '../../../../femo2host/host/femo-relation.mjs'
import { ensureSessionLive } from '../run-control'
import { writeJson } from '../http'

export interface ProjectionRoutesDeps {
  ctx: Context
  resolved: ResolvedConfig
  runState: RunState
  projections: ProjectionRegistry
  sessionsStore?: { get(id: SessionId): Session | undefined }
}

/** GET /femo-plugin/actors —— Script actors of one session's latest run, for
 *  the view menu. 内存命中优先（flow_start 写入）；miss 时查 hub /views 花名册
 *  ——2026-09-20 起取代 turn_scopes 文件回退（花名册随账本落盘，重启后照常
 *  可查；jobId 缺省时 hub 按最新场次给）。 */
export function handleActors(deps: ProjectionRoutesDeps, req: IncomingMessage, res: ServerResponse): void {
  const { resolved, runState } = deps
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    if (sessionId === null || sessionId.length === 0) {
      writeJson(res, 200, { ok: true, actors: [] })
      return
    }
    const mem = runState.sessionActors.get(sessionId)
    console.log(`[femo-plugin][diag] GET /actors ${sessionId}: mem=${mem === undefined ? 'undefined' : JSON.stringify(mem)}`)
    if (mem !== undefined && mem.length > 0) {
      writeJson(res, 200, { ok: true, actors: mem })
      return
    }
    const jobId = await resolveFemoJobId(resolved, runState, sessionId)
    const actors = await hubActorNames(jobId)
    console.log(`[femo-plugin][diag] GET /actors ${sessionId}: mem miss, hub roster fallback=${JSON.stringify(actors)}`)
    writeJson(res, 200, { ok: true, actors })
  })().catch((error: unknown) => {
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}

/** GET /femo-plugin/projection-state —— 【2026-09-06 猫猫拍板】投影窗 composer
 *  发送/停止钮的权威状态源：按投影窗 sessionId（femo-proj-<主sid>-<actorKey>）
 *  返回窗型、本窗角色原始名、FEMO 运行/人类等待/waitScope。前端打开时拉一次建
 *  基线，之后由 SSE projection_state 增量覆盖（engine-events 各状态变化点广播）。 */
export function handleProjectionState(deps: ProjectionRoutesDeps, req: IncomingMessage, res: ServerResponse): void {
  const { resolved, runState } = deps
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId') ?? ''
    const parsedWin = parseProjectionWindowId(sessionId)
    if (parsedWin === undefined) {
      writeJson(res, 200, { ok: true, winKind: 'none' })
      return
    }
    const mainSid = parsedWin.mainSid
    const actorKey = parsedWin.win
    const winKind = actorKey === 'god' ? 'god' : actorKey === 'stage' ? 'stage' : 'actor'
    const state = projectionStateOf(runState, mainSid)
    const resolveActor = (actors: string[]): string | undefined =>
      actors.find(name => projectionActorKey(name) === actorKey)
    const mem = runState.sessionActors.get(mainSid)
    if (mem !== undefined && mem.length > 0) {
      writeJson(res, 200, { ok: true, sid: mainSid, winKind, actor: resolveActor(mem), ...state })
      return
    }
    // mem miss → hub /views 花名册反查（2026-09-20 起取代 turn_scopes 文件）。
    const jobId = await resolveFemoJobId(resolved, runState, mainSid)
    const actor = rosterBareName(await fetchHubRoster(jobId), actorKey)
    writeJson(res, 200, { ok: true, sid: mainSid, winKind, actor, ...state })
  })().catch(() => {
    // 角色名解析失败不阻塞状态：actor undefined → 前端按 AI 角色窗降级（灰）
    const url = new URL(req.url ?? '/', 'http://localhost')
    const parsedWin = parseProjectionWindowId(url.searchParams.get('sessionId') ?? '')
    const mainSid = parsedWin?.mainSid ?? ''
    const actorKey = parsedWin?.win
    const winKind = actorKey === 'god' ? 'god' : actorKey === 'stage' ? 'stage' : actorKey === undefined ? 'none' : 'actor'
    const state = parsedWin === undefined ? { winKind: 'none' } : { sid: mainSid, winKind, actor: undefined, ...projectionStateOf(runState, mainSid) }
    writeJson(res, 200, { ok: true, ...state })
  })
}

/** GET /femo-plugin/projection-windows —— 视角菜单数据源：主会话的上帝窗 +
 *  角色窗 id 列表。重启后 registry 是内存态（空）：投影窗 id 规则化可推导，
 *  从持久化会话+hub 花名册重建注册表，视角菜单重启即可用。 */
export function handleProjectionWindows(deps: ProjectionRoutesDeps, req: IncomingMessage, res: ServerResponse): void {
  const { ctx, resolved, runState, projections, sessionsStore } = deps
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    if (sessionId === null || sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: 'sessionId is required' })
      return
    }
    let windows = projections.get(sessionId)
    if (windows === undefined) {
      // 主会话未加载时不建窗：cwd 绝不能落到 process.cwd()——否则投影窗
      // 会建进错误的 workspace 分组，与原窗形成 duplicate session id，
      // 整个 workspace 拒绝加载（2026-08-23 事故）。
      // 【2026-09-11 修复·用户实测「刷新后视角菜单点了不切窗」】旧行为在
      // 主会话不在 store 时直接 503（宿主重启后必然如此：0.1.3 的侧边栏
      // 打开只走持久化句柄，不进内存 store），前端 catch 静默降级 ⇒ 菜单
      // 项还在（数据源 /actors 有花名册回退）但点下去解析不到
      // 投影窗 id，只剩 CSS 过滤分支——用户看到「菜单列着窗口、内容完全
      // 不变」。现在先按官方路径把主会话拉活（ensureSessionLive：
      // agents.resume，run/pause 同款兜底；2026-10-07 去预设后不再补挂预设），拉活后 cwd
      // 与子代理目录齐备，ensure 才有落点。
      let main = sessionsStore?.get(SessionId(sessionId))
      if (main === undefined) {
        main = await ensureSessionLive(ctx, SessionId(sessionId), 'projection-windows', sessionsStore)
      }
      const cwd = (main?.header as { cwd?: string } | undefined)?.cwd
      if (main === undefined || cwd === undefined) {
        // 拉活也失败（会话不存在/持久化不可达）：503 如实报错并带 kind，
        // 前端据此给出可操作提示（不再无声无息地「点了没反应」）。
        writeJson(res, 503, {
          ok: false,
          kind: 'main-not-loaded',
          error: '主会话未装载（自动拉活失败）：先打开一次主会话（FEMO外 · 主模型）再点视角；一直失败请看宿主日志 [femo-run-diag]',
        })
        return
      }
      // 角色表查 hub /views 花名册（2026-09-20 起取代 turn_scopes 文件——
      // 花名册随账本落盘，重启缝隙照常可查；与 projection-input 冷装载同源）。
      const jobId = await resolveFemoJobId(resolved, runState, sessionId)
      const scopeActors = await hubActorNames(jobId)
      windows = await projections.ensure(sessionId, scopeActors, cwd)
    }
    const actors: Record<string, string> = {}
    for (const [actor, win] of windows.actors) actors[actor] = String(win.id)
    writeJson(res, 200, {
      ok: true,
      god: windows.god === undefined ? undefined : String(windows.god.id),
      stage: windows.stage === undefined ? undefined : String(windows.stage.id),
      actors,
    })
  })().catch((error: unknown) => {
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}

/** GET /femo-plugin/femo-relation —— 视角按钮的门卫数据源（2026-09-28 二次
 *  拍板）：本会话与 FEMO 有没有关系——裁决正身已上收公共层
 *  sessionFemoRelation（发起账+在线口径参演账，各宿主通用）；dsh 只注入自己
 *  的易失运行信号（runState.sidIndex）。普通会话无关系 → 前端不显示视角菜单
 *  （没跑过戏时上帝视角与主会话视角必然相同，按钮是冗余信息）。 */
export function handleFemoRelation(deps: ProjectionRoutesDeps, req: IncomingMessage, res: ServerResponse): void {
  const { resolved, runState } = deps
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId') ?? ''
    const out = await sessionFemoRelation(resolved.femoRoot, sessionId, {
      isRunning: sid => runState.sidIndex.get(sid) !== undefined,
    })
    writeJson(res, 200, out)
  })().catch((error: unknown) => {
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}
