/**
 * routes/index.ts — 前台接线员（2026-09-25 刀⑤定稿：注册表+小处理体，
 *
 * 全部 HTTP 路由（/femo-plugin/*）的登记处：前端/femoGen 画布来什么请求就
 * 分发给对应模块的执行体，本文件不做业务逻辑（最复杂的 projection-input
 * 三路路由已于 2026-08-26 迁至 ./projection-input）。webServer 服务缺失时
 * 仅打日志。从 index.ts 原样迁出（2026-08-23 重构）。
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FemoBridge } from '../bridge'
import type { ResolvedConfig } from '../config'
import { readBody, writeJson, broadcastSse } from '../http'
import { sseChannel } from '../events/engine-events'
import type { RunState } from '../events/engine-events'
import { activeJobOfSession, projectionStateOf } from '../events/engine-events'
import { actorUsageBySession } from '../../../../femo2host/host/subagent-core.mjs'
import { validateSoulCreate } from '../../../../femo2host/host/tools-core.mjs'
import { readSessionScript, writeSessionScript } from '../state-files'
import { preferenceSet, preferencesView } from '../../../../femo2host/host/cast-core.mjs'
import { readActorUsageFile } from '../actor-usage'
import { handleCreateSession, handleRunOnSession, handleSaveScript, handleReadScript, collectLlmModels, ensureSessionLive } from '../run-control'
import { forgetFemoFile, listFemoFiles, readLedgerFemoFile, rememberFemoFile } from '../femo-files'
import { handleProjectionInput } from './projection-input'
import { registerEngineGateway } from './engine-gateway'
import { isNativeMode } from '../projection/windowing-native'
import { handleDebugRun } from '../debug-run'
import { registerHubProxy } from '../hub/hub-proxy'
// （appendEvent/appendChatProjected 已随 projection-input 体迁至 ./projection-input；
//   GodMirror 的 routes 消费点（水位补齐）已随镜像半边退役——2026-09-20 大扫除。）
import { type ProjectionRegistry } from '../projection/projection'
import { diagTail } from '../diag/diag-feed'
import { hostAddr } from '../hub/hub-feed'
import { handlePickScript, handlePickSavePath } from './dialogs'
import { handleSessionState } from './state'
// （handleJob 已随 /femo-plugin/job 路由进观察期——2026-09-27 死代码排查，全仓零调用方。）
import { handlePause, handleHumanInput } from './run'
import { handleSessionScript } from './script-files'
import { handleActors, handleProjectionState, handleProjectionWindows, handleFemoRelation } from './projection'   // 宿主自称（归属判定 host_refs 键）

export interface RoutesDeps {
  resolved: ResolvedConfig
  bridge: FemoBridge
  runState: RunState
  projections: ProjectionRegistry
  sessionsStore?: { get(id: SessionId): Session | undefined }
  recordError(sessionId: string, text: string): void
}

/** 注册全部 /femo-plugin/* HTTP 路由（index.ts 总装调用一次）。 */
export function registerRoutes(ctx: Context, deps: RoutesDeps): void {
  const { resolved, bridge, runState, projections, sessionsStore, recordError } = deps

  // HTTP routes: create-session + script listing (sidebar button calls these).
  const webServer = ctx.get('webServer') as { register(spec: unknown): void } | undefined
  if (webServer !== undefined && typeof webServer.register === 'function') {
    // 【链路B 薄壳】投影中心只读代理：投影窗锚行节点的内容源（hub GET /view）。
    // 【2026-09-27 复接】刀⑤c-1（087cd3a）前台分家时误删了本调用——hub-view
    // 从此 404，投影窗锚行拿不到 hub 数据整窗空白（新旧版本全中，桌面 rc.2 实案）。
    registerHubProxy(resolved, runState, (spec) => webServer.register(spec))
    // 【刀3（画布直连引擎，2026-10-05）】引擎地址发现 + 透明转发后备：画布
    // 改直连常驻引擎后的两件薄插座（细则见 routes/engine-gateway.ts 头注）。
    registerEngineGateway(resolved, (spec) => webServer.register(spec))
    // 【作者预留·2026-09-27 死代码审计已核】前端调用点已随侧栏按钮清零（2026-08-30），
    // 按档保留作编程式新建 Femo 会话入口（dshPatch/MEOW_MODIFICATIONS.md 明记保留）——非死代码，勿清。
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/create-session',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void handleCreateSession(req, res, ctx, resolved, bridge, runState, projections).catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/run',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void handleRunOnSession(req, res, ctx, resolved, bridge, runState, projections).catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/models',
      handler: (_req: IncomingMessage, res: ServerResponse): void => {
        // 前端 actor source 下拉数据源：dsh 当前可用 provider/模型列表。
        void collectLlmModels(ctx, resolved).then((payload) => {
          writeJson(res, 200, { ok: true, ...payload })
        }).catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/native-flag',
      handler: (_req: IncomingMessage, res: ServerResponse): void => {
        // 客户端版本分流信号（0.1.3+ 原生路径）：目录过滤链据此换用原生 fork
        // 组件（ban femo-proj/femo-actor 条目；旧版组件与历史行为见 client.tsx
        // registerLegacyCatalogUi）。旧版（meow fork）返回 native:false。
        writeJson(res, 200, { ok: true, native: isNativeMode() })
      },
    })
    // 【2026-09-20 摘除】排障临时面 debug-list-children / debug-materialize 已下线：
    // 两者是 2026-09-09 冷装载排障期的探针（自述「随排障结束摘除」），配方早已落进
    // awakenProjectionWindow（projection.ts），且全仓无任何调用方；其中 materialize
    // 还写死了本机 cwd（公开仓不能带本机路径）。
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/actor-usage',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 角色窗圆环数据源：主会话各角色最近一次运行的 provider 实报占用。
        // 内存表优先（实时权威），无（重启后未再演）读档案文件恢复。
        void (async () => {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const sid = url.searchParams.get('sessionId') ?? ''
          if (sid.length === 0) {
            writeJson(res, 400, { ok: false, error: 'sessionId is required' })
            return
          }
          const mem = actorUsageBySession.get(sid)
          if (mem !== undefined) {
            writeJson(res, 200, { ok: true, actors: Object.fromEntries(mem) })
            return
          }
          const actors = await readActorUsageFile(sid)
          writeJson(res, 200, { ok: true, actors: actors ?? {} })
        })().catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    // ── 会话↔角色绑定（cast，2026-09-25）──────────────────────────────────
    // GET：提名账视图 + souls 库（绑定下拉一次拿全）。
    // POST bind/unbind：账本正身住 hub（cast-core 走 /sessions/cast-preference，
    // 提名制——多会话可同提一个 soul，无占用拒绝）；本端点只做本宿主态的两道裁决——
    // human 条目不可绑（AI/human 的正身在FEMO脚本 actors 声明，UI 按 id 约定先挡）+
    // 发起会话有 running Job → 拒（运行冻结：启动运行前定格，运行中不许变）。
    const castBusyJobOf = (sid: string): string | undefined => {
      for (const [jobId, mirror] of runState.jobs) {
        if (mirror.ownerSid === sid && mirror.state === 'running') return String(jobId)
      }
      return undefined
    }
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/cast',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          if (req.method === 'GET') {
            const [prefs, soulsOut] = await Promise.all([
              preferencesView(resolved.femoRoot),
              bridge.send('list_souls', {}, 15000) as Promise<{ souls?: Array<{ soul_id: string; soul_name: string }> } | undefined>,
            ])
            writeJson(res, 200, { ok: true, bindings: prefs.bindings, souls: soulsOut?.souls ?? [] })
            return
          }
          if (req.method !== 'POST') {
            writeJson(res, 405, { ok: false, error: 'method not allowed' })
            return
          }
          const body = await readBody(req) as Record<string, unknown>
          const action = typeof body.action === 'string' ? body.action : ''
          const soulId = typeof body.soul_id === 'string' ? body.soul_id.trim() : ''
          const sid = typeof body.sid === 'string' ? body.sid.trim() : ''
          if ((action !== 'bind' && action !== 'unbind') || soulId.length === 0 || sid.length === 0) {
            writeJson(res, 400, { ok: false, error: 'action(bind|unbind) + soul_id + sid are required' })
            return
          }
          if (soulId === 'human') {
            writeJson(res, 400, { ok: false, error: 'human 角色不参与会话绑定' })
            return
          }
          const busyJob = castBusyJobOf(sid)
          if (busyJob !== undefined) {
            writeJson(res, 409, { ok: false, error: `本会话正在运行（Job ${busyJob}），运行中不许改绑定` })
            return
          }
          if (action === 'bind') {
            const soulsOut = await bridge.send('list_souls', {}, 15000) as { souls?: Array<{ soul_id: string; soul_name: string }> } | undefined
            if (soulsOut?.souls?.find(s => s.soul_id === soulId) === undefined) {
              writeJson(res, 404, { ok: false, error: `角色 "${soulId}" 不在角色库里` })
              return
            }
          }
          // 提名制：hub 无占用拒绝（最后指派算数，定格生效）；缺参错误原话透传。
          const out = await preferenceSet(resolved.femoRoot, hostAddr(), sid, action === 'bind' ? soulId : null)
          if (out.ok !== true) {
            writeJson(res, 409, { ok: false, error: out.error ?? '绑定被拒绝' })
            return
          }
          writeJson(res, 200, { ok: true, soul_id: soulId })
        })().catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })

    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/souls',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          if (req.method !== 'POST') {
            writeJson(res, 405, { ok: false, error: 'method not allowed' })
            return
          }
          const body = await readBody(req) as Record<string, unknown>
          // 创建校验单源工具总纲（2026-09-29）：此前这里只查 soul_id 非空，
          // 与 femo-soul 工具两套口径——HTTP 侧能造出带空格/逗号、脚本里
          // soul:xxx 引用不到的角色。soul_name 也自此必填（与工具同规）。
          const soulError = validateSoulCreate(body)
          if (soulError !== null) {
            writeJson(res, 400, { ok: false, error: soulError })
            return
          }
          const soul_id = typeof body.soul_id === 'string' ? body.soul_id.trim() : ''
          // 插件模式 soul 创建：归属/创建者固定默认用户 u001（前端不再输入）。
          const result = await bridge.send('create_soul', {
            soul_id,
            soul_name: typeof body.soul_name === 'string' ? body.soul_name.trim() : '',
            description: typeof body.description === 'string' ? body.description : '',
            user_id: 'u001',
          }, 15000)
          writeJson(res, 200, { ok: true, soul_id, result })
        })().catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })

    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/pause',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 暂停路由：裁决单份在 run-control.pauseJobResolved，HTTP 呈现在 ./routes/run。
        handlePause({ bridge, runState, recordError }, req, res)
      },
    })
    // ═══ 已退役（观察期起 2026-09-27 死代码排查，全仓零调用方；观察无误后连块删除）：/femo-plugin/jobs（「前端/AI 查历史挂起 Job」的 HTTP 出口从未有消费方） ═══
    // webServer.register({
    //   kind: 'exact',
    //   path: '/femo-plugin/jobs',
    //   handler: (_req: IncomingMessage, res: ServerResponse): void => {
    //     // Job 清单（v1 吸收）：前端/AI 查历史挂起 Job 的 HTTP 出口
    //     // （幽灵书签可达性闭环——配 femo-run resume + job_id）。
    //     bridge.send('list_jobs', {}, 15000).then((result) => {
    //       const jobs = (result as { jobs?: unknown[] } | undefined)?.jobs ?? []
    //       writeJson(res, 200, { ok: true, jobs })
    //     }).catch((error: unknown) => {
    //       writeJson(res, 500, { ok: false, error: String(error) })
    //     })
    //   },
    // })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/diag-tail',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 【诊断 2026-09-06】诊断窗打开时拉历史（此后实时流走 SSE femo_diag）。
        const url = new URL(req.url ?? '/', 'http://localhost')
        const n = Number(url.searchParams.get('n') ?? '300')
        writeJson(res, 200, { ok: true, lines: diagTail(n) })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/debug-run',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 零 token 调试干跑（2026-09-08）：femoGen「🐞 调试」按钮——
        // femo_debugger FakeHost 替 AI/human 发言，DebugLogBus 流水以
        // NDJSON 流式回传（每行一条）。与正式运行/job/SSE 全解耦。
        void handleDebugRun(req, res, ctx, resolved).catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/human-input',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 画布人类节点喂入：B6 防线+speech-core 信封（体在 ./routes/run）。
        handleHumanInput({ bridge, runState }, req, res)
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/scripts',
      handler: (_req: IncomingMessage, res: ServerResponse): void => {
        bridge.send('list_scripts', {}).then((result) => {
          const scripts = (result as { scripts?: unknown[] } | undefined)?.scripts ?? []
          writeJson(res, 200, { ok: true, scripts })
        }).catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/save-script',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void handleSaveScript(req, res, resolved).catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/script',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void handleReadScript(req, res).catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/errors',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const sessionId = url.searchParams.get('sessionId')
        const list = sessionId === null ? [] : (runState.errors.get(sessionId) ?? [])
        writeJson(res, 200, { ok: true, errors: list })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/editor-error',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          // 编辑器前端解析/恢复失败上报：并入 errors 列表（用户可见）+ 可被
          // femo-mount/run 工具结果带回主模型，杜绝「静默吞错」。
          const raw = await readBody(req) as unknown as Record<string, unknown>
          const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId : ''
          const message = typeof raw.message === 'string' ? raw.message.trim() : ''
          const source = typeof raw.source === 'string' && raw.source.length > 0 ? raw.source : 'editor'
          if (sessionId.length === 0 || message.length === 0) {
            writeJson(res, 400, { ok: false, error: 'sessionId and message are required' })
            return
          }
          recordError(sessionId, `[编辑器·${source}] ${message}`)
          writeJson(res, 200, { ok: true })
        })().catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    // 【run-result 路由退役（§8.4，§八.16）】AI 的 femo-run 直调 job_start
    // 后其唯一生产者消失——run_request 全链（index pending Map、本路由、
    // editor-page 触发链）整体退役，不退即死代码。
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/actors',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 视角菜单角色名单（内存优先+hub 花名册兜底，体在 ./routes/projection）。
        handleActors({ ctx, resolved, runState, projections, sessionsStore }, req, res)
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/projection-state',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // composer 按钮权威状态源（体在 ./routes/projection）。
        handleProjectionState({ ctx, resolved, runState, projections, sessionsStore }, req, res)
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/client-probe',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          // 【2026-09-17 alpha.2 排查·投影窗打不开】前端关键分支上报口：
          // 宿主 console 会被 host-log 钩子认领进调试窗 Host 页——前端
          // view-button 的 openSession 全链在此可见，浏览器 F12 同步有份。
          let raw: unknown = null
          try {
            raw = await readBody(req)
          } catch (error: unknown) {
            console.log(`[femo-probe][client] body read failed: ${String(error)}`)
          }
          console.log(`[femo-probe][client] ${JSON.stringify(raw)}`)
          writeJson(res, 200, { ok: true })
        })()
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/session-script',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 会话FEMO脚本记录写（乐观锁/入口归一/多端广播，体在 ./routes/script-files）。
        handleSessionScript(resolved, req, res)
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/session-state',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // femoGen 恢复面+引擎↔镜像对账（体在 ./routes/state；对账状态机已抽
        // 纯函数 reconcileMirrorWithEngine，2026-09-25 刀⑤b）。
        handleSessionState({ resolved, bridge, runState, sessionsStore }, req, res)
      },
    })

    // ═══ 已退役（观察期起 2026-09-27 死代码排查，全仓零调用方；观察无误后连块删除）：/femo-plugin/job（处理体 handleJob 在 ./routes/state 同批退役——注释声称的消费方 femoGen 实测不调它） ═══
    // webServer.register({
    //   kind: 'exact',
    //   path: '/femo-plugin/job',
    //   handler: (req: IncomingMessage, res: ServerResponse): void => {
    //     // Job 档案透传（体在 ./routes/state；引擎档案为权威，宿主不代问代译）。
    //     handleJob(bridge, req, res)
    //   },
    // })

        webServer.register({
      kind: 'exact',
      path: '/femo-plugin/events',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // SSE：引擎事件实时推送给 femoGen 可视化画布（呼吸灯/节点详情/流式文本）。
        // 【2026-09-22 收口】重放环（cap400）/短命帧过滤（femo_stream/ai_token/
        // step 不入环，Job784）/checkpoint 原地替换/replay 标记（v9 防走马灯）/
        // 15s 心跳——全部唯一活在 femoGenConnector/sse-core.mjs；本路由只剩
        // 插座：头 + connect（补帧打标记 + 心跳托管）。
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        })
        res.write(': connected\n\n')
        sseChannel.connect(res)
        req.on('close', () => { /* 清理由 channel 的 res.on('close') 承担 */ })
      },
    })
    // ═══ 已退役（观察期起 2026-09-27 死代码排查，全仓零调用方；观察无误后连块删除）：/femo-plugin/pick-directory（目录挑选已由 pick-script / pick-save-path 承担） ═══
    // webServer.register({
    //   kind: 'exact',
    //   path: '/femo-plugin/pick-directory',
    //   handler: (_req: IncomingMessage, res: ServerResponse): void => {
    //     void (async () => {
    //       // 导出流程：让用户选FEMO脚本保存目录（dsh directory-picker seam：
    //       // native=系统目录选择对话框 / browse=应用内浏览）。返回目录绝对路径。
    //       const picker = ctx.get('directoryPicker') as
    //         | { capability(): { kind: string; pick?(signal: AbortSignal): Promise<string | null>; list?(path?: string): Promise<unknown> } }
    //         | undefined
    //       if (picker === undefined) {
    //         writeJson(res, 500, { ok: false, error: 'directoryPicker service unavailable' })
    //         return
    //       }
    //       const cap = picker.capability()
    //       if (cap.kind === 'native' && typeof cap.pick === 'function') {
    //         const dir = await cap.pick(new AbortController().signal)
    //         writeJson(res, 200, { ok: true, directory: dir })
    //       } else {
    //         // browse 后端无系统对话框：让前端填路径（此处仅声明能力不足）。
    //         writeJson(res, 501, { ok: false, error: 'directoryPicker backend is browse; path entry unsupported yet', kind: cap.kind })
    //       }
    //     })().catch((error: unknown) => {
    //       writeJson(res, 500, { ok: false, error: String(error) })
    //     })
    //   },
    // })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/femo-files',
      handler: (_req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          // 导入清单（2026-09-11）：导入过/导出过的 .femo 历史，导入的第一级
          // 界面（第二级才是系统文件对话框，电脑端专属）。见 ./femo-files。
          const files = await listFemoFiles(resolved.femoRoot)
          writeJson(res, 200, { ok: true, files })
        })().catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/open-femo-file',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          // 从清单里选一条打开：读盘 → 正文回给前端（前端随后走与「浏览选中」
          // 完全相同的收尾：写会话记录 {path, text} + 载入画布）。
          // 只认账本里记过的路径（femo-files 里守卫），不是任意文件读取端点。
          const raw = await readBody(req) as unknown as Record<string, unknown>
          const path = typeof raw.path === 'string' ? raw.path.trim() : ''
          if (path.length === 0) {
            writeJson(res, 400, { ok: false, error: 'path is required' })
            return
          }
          let content: string
          try {
            content = await readLedgerFemoFile(resolved.femoRoot, path)
          } catch (error) {
            // 文件被移走/删掉是常见情况（外接盘、改名），原样上屏给用户判断
            writeJson(res, 404, { ok: false, error: `打不开该文件：${String(error)}` })
            return
          }
          // 打开成功也算一次使用，把它顶到清单最前
          await rememberFemoFile(resolved.femoRoot, path, 'import')
          writeJson(res, 200, { ok: true, path, content })
        })().catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/forget-femo-file',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          // 从清单移除一条（2026-09-13）：只划账本，**源文件零接触**——
          // 移除键的语义边界在 host 侧守住，前端文案只是转述这里的行为。
          // 路径不在账本里也返回 ok（幂等，见 forgetFemoFile 注释）。
          const raw = await readBody(req) as unknown as Record<string, unknown>
          const path = typeof raw.path === 'string' ? raw.path.trim() : ''
          if (path.length === 0) {
            writeJson(res, 400, { ok: false, error: 'path is required' })
            return
          }
          const removed = await forgetFemoFile(resolved.femoRoot, path)
          writeJson(res, 200, { ok: true, removed })
        })().catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/pick-script',
      handler: (_req: IncomingMessage, res: ServerResponse): void => {
        // 导入流程：弹系统打开文件框拿原始路径+正文并入导入账本（2026-08-30
        // 「导入=引用」拍板）。实现体在 ./routes/dialogs（两套 PowerShell 对话框
        // 逐字同构，2026-09-25 刀⑤合并为唯一助手）。
        handlePickScript(res, resolved.femoRoot)
      },
    })

    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/pick-save-path',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 导出·首次保存/另存为：弹系统保存文件框（带默认文件名）。实现体在
        // ./routes/dialogs（同上合并件）。
        void (async () => {
          const raw = await readBody(req) as unknown as Record<string, unknown>
          const rawName = typeof raw.name === 'string' ? raw.name : ''
          const base = (rawName.split(/[\\/]/).pop() ?? '').trim() || 'flow'
          handlePickSavePath(res, base)
        })().catch((error: unknown) => {
          writeJson(res, 500, { ok: false, error: String(error) })
        })
      },
    })

    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/projection-windows',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 视角菜单窗 id 列表（重启冷重建注册表，体在 ./routes/projection）。
        handleProjectionWindows({ ctx, resolved, runState, projections, sessionsStore }, req, res)
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/femo-relation',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 视角按钮门卫：本会话与 FEMO 的戏缘裁决（发起账+在线灵魂绑定，体在 ./routes/projection）。
        handleFemoRelation({ ctx, resolved, runState, projections, sessionsStore }, req, res)
      },
    })
    webServer.register({
      kind: 'exact',
      path: '/femo-plugin/projection-input',
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        // 三路路由业务体（steer 主模型/喂引擎/本地留痕 + 诊断文件日志）已迁至
        // projection-input.ts（2026-08-26 整理）；本文件只留注册与分发。
        void handleProjectionInput(ctx, {
          resolved,
          bridge,
          runState,
          projections,
          sessionsStore,
          // 主会话不在 store（宿主重启后）：按官方路径拉活，ensure 兜底才有 cwd。
          ensureMainLive: (mainSid: string): Promise<Session | undefined> =>
            ensureSessionLive(ctx, SessionId(mainSid), 'projection-input', sessionsStore),
          // 【十连裁⑨】收件口在=人类插话走寄信单通道的前提；未起 → 原地降级直推。
          mailboxPushUp: bridge.pushPort !== undefined,
        }, req, res)
          .catch((error: unknown) => {
            writeJson(res, 500, { ok: false, error: String(error) })
          })
      },
    })
    console.log('[femo-plugin] create-session + scripts + save-script + script + errors routes registered')
  } else {
    console.log('[femo-plugin] webServer unavailable; routes not registered')
  }
}
