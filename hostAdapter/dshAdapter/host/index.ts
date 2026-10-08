/**
 * femo-plugin — Femo integration for DeepSeek Harness.
 *
 * 本文件是「总装车间」：插件门面（name/inject/Config）、事件词汇声明合并、
 * 以及 apply() 编排——把各职责模块按序装配起来。业务逻辑都在对应模块
 * （2026-09-25 九刀分区后的常设区，细则见 ../AGENTS.md §二）：
 *
 *   config.ts         设置表（Config schema + ResolvedConfig）
 *   bridge.ts         常驻引擎直连（daemon-client 组合模式：/cmd+SSE+门铃；C1 自愈保留）
 *   persona.ts        Femo 会话身份证 + 主Agent手册/运行通知注入
 *   http.ts           HTTP 小工具箱（readBody/writeJson/SSE 广播）
 *   state-files.ts    存档文件族再导出壳（checkpoint/turn_scopes/session_script）
 *   session-roster.ts 名册（会话身份族：冷扫描/说话即绑/announce）
 *   actors/           席位执行体（dispatch 唯一派工 + 主演下场 main/ + 常驻演员 native/）
 *   events/           事件调度（engine-events 总调度 + pre-step-gate 门卫 + mailbox-push 驿站收件口）
 *   projection/       幕布形态件（projection 窗管家 / windowing-native 原生兼容 / hub-anchor 锚行常量）
 *   hub/              公告栏四口（hub-feed 喂送 / hub-proxy 只读代理 / god-mirror 戏外旁挂 / stream-frames 直播帧桥）
 *   routes/           前台（index 注册表 + 按域处理体：state/run/script-files/dialogs/projection/projection-input）
 *   tools.ts          主模型专用工具（femo-mount/run/debug/script/soul/chronica/possess；依赖注入在 tool-deps.ts）
 *
 * 历史行为注记（M2 scope）：
 *   1. Femo sessions via sidebar button (POST /femo-plugin/create-session),
 *      optionally with a `femo` script body that auto-starts the engine.
 *   2. No main model while running: pre-step rejects for running Femo sessions
 *      — turn-scoped since 2026-09-11 (only the step-1 gate decides; a turn
 *      already entered keeps its tool-continuation steps, so real user input
 *      typed in the main window runs a full native turn even mid-script).
 *      idle Femo sessions run the main model normally.
 *   3. Engine bridge: 现为常驻引擎直连（2026-09-26 换芯 daemon-client：
 *      /cmd + /engine/events + pushUrl 门铃；旧 Python 子进程桥 femo_bridge.py
 *      已退役移 mytrashbin）。LLM key resolved from ctx.credentials per run.
 *   4. Event bridge: engine events are re-emitted as cordis
 *      'femo-plugin/event'; the event switch turns them into projected chat
 *      lines and main-model notices.
 *   5. Input bridge: user messages on the running Femo session are forwarded
 *      as human input while a human node waits, or hard-pause the run (job_pause)
 *      (interrupt semantics) while the engine is working.
 *
 * NOTE: ctx.logger output is not reliably visible in this deployment, so
 * diagnostics also go to console.log.
 *
 * 2026-08-23 重构：单文件（2733 行）拆分为上述模块；纯搬家+闭包工厂化，
 * 行为零变化。重构前快照见 src/index.ts.bak-20260823-pre-refactor。
 * 2026-09-27 头注对账：模块清单按九刀分区现状照实改写（此前停留在 2026-08
 * 拆分时代的旧文件名）。
 */

import type { Context } from '@deepseek-ai/cordis'
// Value import: SessionId 构造器在 apiRetry 错误上报表用。
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
// Namespace import: `registerSessionEventType` (the runtime event-type
// registration surface) only exists on builds that ship it; on stock builds
// the plugin still loads and live sessions work — only loading history of
// femo-plugin/chat sessions is unavailable there (see README "dsh 版本要求").
// 红线：注册必须只发生在此处一处（external 单例语义，见 build.mjs 注释）。
import * as sessionNS from '@deepseek-ai/dsh-session'

import { Config, resolveConfig, packageRoot } from './config'
import { join } from 'node:path'
import { FemoBridge } from './bridge'
import { registerPersonaHooks } from './persona'
import { installFemoSkill } from './femo-skill'
import { registerSessionRoster } from './session-roster'
import { createProjectionRegistry, awakenedDisposers, disposeProjectionWriters } from './projection/projection'
import { installNativeWindowing, isNativeDshBuild } from './projection/windowing-native'
import { installPersistenceListCache } from './compat/list-cache'
import { createGodMirror } from './hub/god-mirror'
import { type RunState, registerEngineEventHandlers } from './events/engine-events'
import { initDiagFeed } from './diag/diag-feed'
import { installHostLogCapture } from './diag/host-log'
import { registerRoutes } from './routes'
import { startMailboxPushListener } from './events/mailbox-push'
import { registerFemoTools } from './tools'
import { apiRetry } from './api-retry'
import { activeChildRuns } from '../../../femo2host/host/subagent-core.mjs'
import { disposeMainDeliveries, isMainActorNotice, isMainAnswerPending, mainActorSceneActor, pendingNodeName } from './main-actor'
import { broker } from './node-retry'
// 刀④抽出的三件：桥保姆（C1 自愈）/断电索引重建/主Agent工具执行依赖。
import { installBridgeSupervisor } from './bridge-supervisor'
import { rebuildJobIndexFromRecords } from './job-index'
import { createFemoToolDeps } from './tool-deps'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * One Femo engine chat line rendered by the femo-plugin client node.
     * @mode emit
     * @param data - speaker, line text, and line kind.
     */
    'femo-plugin/chat': {
      /** Speaker name (engine node), when the line is a role line. */
      actor?: string
      /** The line's text. */
      text: string
      /** role = AI character line; notice = engine/flow status; human_wait = waiting for the user; prompt = node hint/announcement; error = engine error (red, system-like); thinking = subagent cot (folded); tool_call = subagent tool invocation line (JSON body); speaker = subagent turn header name line; sys = femo-run success receipt (main session surface only, user-facing). */
      kind: 'role' | 'notice' | 'human_wait' | 'prompt' | 'error' | 'thinking' | 'tool_call' | 'speaker' | 'sys'
    }
  }
}

export const name = 'femo-plugin'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /** One Femo engine event, re-emitted verbatim (eventType, data). */
    'femo-plugin/event'(eventType: string, data: unknown): void
  }
}

/** Required services: agent registry + session store + tools (femo-mount/run). */
export const inject = ['agents', 'sessions', 'agentDefaultModel', 'tools', 'webServer']

export { Config }

export async function apply(ctx: Context, config: unknown): Promise<void> {
  const resolved = resolveConfig(config)
  if (!resolved.enabled) {
    console.log('[femo-plugin] disabled by config')
    return
  }
  // 【2026-10-07 去预设】FEMO 教条从「FEMO模式」预设的 persona 行搬进一个
  // **skill**：任何会话、任何预设都能用（模型自己发现并加载，或用户敲 /femo），
  // 同时全局挂两段提示——femo:root（根路径一行）与 femo:tips（一句话说清本会话
  // 有 femo-* 工具、要写/跑剧本就载入教条）。工具本身早就全局注册（tools.ts）。
  // 不再向预设名册注册/镜像任何预设：本插件不再需要选模式才能用。
  installFemoSkill(ctx, resolved.femoRoot)
  // 全局默认模型选择（用户在模型选择 UI 保存的推理等级在这里）；
  // 子 agent 不走 apiproxy 的 selection 安装，需要手动注入。
  const defaultModel = ctx.get('agentDefaultModel') as
    | { currentSelection(): unknown }
    | undefined

  // Admit the plugin's custom event type ('femo-plugin/chat') into the session
  // event vocabulary at runtime (the persistence read path otherwise refuses
  // logs containing it). Every type the plugin appends to a session log must
  // be registered here — missing one means that session's history fails to
  // load. (turn→scope used to be a log event too; it now persists to the
  // plugin's user_data/host-history/projections/turn-scopes/<sessionId>.json instead.) Registration
  // must precede any session load, so it happens at apply time. Only builds
  // that ship the registration surface (upstreamed feature / meow fork) have
  // it; on stock builds the plugin keeps working for live sessions.
  const registerSessionEventType = (sessionNS as { registerSessionEventType?: (type: string) => () => void }).registerSessionEventType
  if (registerSessionEventType !== undefined) {
    ctx.effect(() => registerSessionEventType('femo-plugin/chat'), 'femo-plugin: session event type')
    // 旧会话日志（turn-scope 文件化改造前）带 femo-plugin/turn-scope 事件；
    // 2026-09-12 femo 改名时存量事件类型已一并迁移，这里照常放行。
    ctx.effect(() => registerSessionEventType('femo-plugin/turn-scope'), 'femo-plugin: session event type (legacy turn-scope)')

  } else {
    console.log('[femo-plugin] this dsh build lacks registerSessionEventType; loading history of femo-plugin sessions is unsupported here (see README)')
  }

  // Crash diagnostics: log uncaught exceptions/rejections instead of taking
  // the process down silently (the 3081 instance is managed by AutoClaw and
  // gets relaunched, so a visible log beats a silent relaunch).
  process.on('uncaughtException', (error: Error) => {
    console.log(`[femo-plugin] uncaughtException: ${String(error?.stack ?? error)}`)
  })
  process.on('unhandledRejection', (reason: unknown) => {
    console.log(`[femo-plugin] unhandledRejection: ${String(reason instanceof Error ? reason.stack : reason)}`)
  })
  // Event-loop heartbeat (2026-08-23 卡死调查): a 1s timer whose drift exposes
  // event-loop stalls. 静态文件活着但 RPC 全挂 = 异步死锁（心跳正常）；
  // 心跳也停 = 事件循环被同步代码堵死。两种病，两副药。
  let heartbeatLast = Date.now()
  const HEARTBEAT_INTERVAL = 1000
  setInterval(() => {
    const now = Date.now()
    const lag = now - heartbeatLast - HEARTBEAT_INTERVAL
    heartbeatLast = now
    if (lag > 2000) {
      console.log(`[femo-plugin] event-loop stall: ${lag}ms behind`)
    }
  }, HEARTBEAT_INTERVAL)

  const bridge = new FemoBridge()
  ;(bridge as unknown as { emit(name: string, ...args: unknown[]): void }).emit = (name, ...args) => {
    ;(ctx.emit as (name: string, ...args: unknown[]) => void)(name, ...args)
  }

  // Run-state bookkeeping（Job 模型新形态 §6.2/§10.2）：jobs=Job 镜像表、
  // sidIndex=sid→最近 Job、activeJobId=引擎活跃 Job（全插件共享同一引用，
  // engine-events/routes/tools deps 显式传参）。
  const runState: RunState = {
    jobs: new Map(),
    sidIndex: new Map(),
    sessionActors: new Map(),
    errors: new Map(),
  }
  // 【诊断 2026-09-06】诊断流落盘初始化（user_data/debug-diag-feed.log）。
  initDiagFeed(resolved.femoRoot)
  // 【调试窗『Host』页 2026-09-11】宿主侧 console 采集：只认本插件代码打的行
  // （栈过滤，见 host-log.ts），进 diag feed 的 tag 'host' 供前端第四页显示。
  installHostLogCapture()

  // 【原生 0.1.3+ 分流】stock 构建安装 windowing-native 层：投影窗保持裸建
  // （原 0.1.3 实测不落盘 ⇒ 自定义事件永不进持久层，无拒载/无砖），窗历史由
  // femo 自有镜像跨重启重放；主会话 sys 回执自动降级为仅窗侧。meow fork
  // （有 registerSessionEventType）不安装，原投影窗路径行为逐字节不变。
  // 【2026-09-25 用户拍板】镜像目录迁插件自有 data/（dsh 私产，不再进共享
  // user_data 的 host-history/projections/——旧目录存量整体搬走，未删任何文件）。
  installNativeWindowing(ctx, {
    native: isNativeDshBuild(sessionNS),
    mirrorDir: join(packageRoot, 'data', 'proj-mirror'),
  })

  const sessionsStore = ctx.get('sessions') as { get(id: SessionId): Session | undefined } | undefined

  // ── 断电闭环 + 索引重建（§10.2，提案 §二.5 闭环的宿主半场）──────────────
  // 扫会话记录的 currentJobId 填 runState.sidIndex——不置 running（引擎
  // reconcile 已把全量 running 判 suspended(crash)，镜像天然干净）。此后：
  // 前端 /session-state 走 get_job_state 代理看到 suspended + checkpoint →
  // 显示「继续」→ job_resume 六关裁决 → 恢复。
  // ── 断电索引重建 + C1 进程监督自愈（§10.2/§十四.1）────────────────────
  // 两件各自成模块（2026-09-25 刀④）：断电索引=job-index.ts（开机一次+桥
  // 重生就绪一次）；桥保姆=bridge-supervisor.ts（暴毙清账+3s respawn+连击
  // 熔断）。这里只装配。
  const bridgeSupervisor = installBridgeSupervisor({ ctx, resolved, bridge, runState })

  /** 投影窗注册表：sid → { god, stage, actors }（上帝/FEMO内/角色视角的子代理窗）。 */
  const projections = createProjectionRegistry(ctx)

  /** 主会话 → 投影中心FEMO外旁挂（实时监听；镜像/水位半边已随链路B 退役）。
   *  【2026-09-23 用户拍板】god 窗口径=main 全部戏外 + 全部角色戏内，main 的
   *  FEMO内排除：mainActorSceneActor 剔参与轮的内容帧，isMainActorNotice 剔参与运行
   *  注入那一拍（含它开容器引发的直播帧泄漏）。 */
  const godMirror = createGodMirror({ mainActorSceneActor, isMainActorNotice })

  const recordError = (sessionId: SessionId, text: string): void => {
    const key = String(sessionId)
    const list = runState.errors.get(key) ?? []
    list.push({ ts: Date.now(), text })
    if (list.length > 50) list.shift()
    runState.errors.set(key, list)
    console.log(`[femo-plugin] error on ${key}: ${text}`)
  }

  // 身份钩子（preset override 重建 + docs section 补注入/清除）。
  registerPersonaHooks(ctx, resolved.femoRoot)

  // FEMO 会话名册（2026-09-21 主会话面板）：冷扫描 + 说话即绑。
  // 必须在 registerPersonaHooks 之后——身份轴（femoIdentity）的根目录在那一步注入。
  registerSessionRoster(ctx, resolved.femoRoot)

  // 运行期总调度：pre-step 门卫 + 输入桥 + 上帝窗实时镜像 + 引擎事件 switch
  // （内部按此顺序注册监听器，与重构前 apply() 的注册顺序一致）。
  registerEngineEventHandlers(ctx, {
    resolved, bridge, runState, sessionsStore, projections, godMirror, defaultModel, recordError,
    broker,
  })

  // ── API 请求错误慢层兜底（第二类错误，施工清单 v4 §2 / §12 Step A）──────
  // agent/request-error 瀑布的下游（base bundle llm-retry 快层之后注册）：
  // femo 角色请求（子代理 + main 在飞回合）五段退避重试（立即/20s/1min/
  // 3min/10min），第五段之后仍败放行 = turn error = 节点按结束。compiler 无感。
  // apiRetry/broker 均为模块级单例（subagent.ts finally 的 clearChild/
  // unregister 与此共用实例）。
  ctx.effect(() => apiRetry.install(ctx, {
    resolveTarget: (childId) => {
      const hit = activeChildRuns.get(childId)
      if (hit !== undefined) {
        return { kind: 'subagent', mainSessionId: hit.mainSid, childSessionId: childId, node: hit.node }
      }
      if (isMainAnswerPending(childId)) {
        return { kind: 'main', mainSessionId: childId, childSessionId: childId, node: pendingNodeName(childId) }
      }
      return undefined
    },
    onRetry: (target, attempt, delayMs, failure) => {
      // 【2026-09-20 大扫除】角色 ⏳ 投影窗行写入已删（重试知情由桥滞留件
      // 随终局打包送达主模型）；慢层重试的通知只剩控制台留痕。
      const delayText = delayMs <= 0 ? '立即' : `${Math.round(delayMs / 1000)} 秒后`
      if (target.kind === 'main') {
        console.log(`[femo-api-retry] main 调用失败（${failure.code}），${delayText}重试（第 ${attempt}/5 次）：node=${target.node} ${failure.message.slice(0, 200)}`)
        return
      }
      console.log(`[femo-api-retry] 角色 ${target.node} 调用失败（${failure.code}），${delayText}重试（第 ${attempt}/5 次）`)
    },
    onExhausted: (target, failure) => {
      if (target.kind === 'main') {
        console.log(`[femo-api-retry] main 连续 5 次 API 失败，节点「${target.node}」执行失败上报引擎（本次挂起可续跑）：${failure.code} ${failure.message.slice(0, 200)}`)
        return
      }
      // 错误面板（主会话错误表）照记——角色 ❌ 投影窗行写入已删（2026-09-20）。
      const text = `角色 ${target.node} 连续 5 次 API 失败，节点执行失败：${failure.code} ${failure.message}（本次将挂起，可点「继续」重演）`
      recordError(SessionId(target.mainSessionId), text)
    },
  }), 'femo-plugin: api retry chain')

  // 停靠经纪人生命周期（第三类脚本错误，施工清单 v4 §5 / §12 Step C）：
  // HMR/插件卸载时清全部 parker 与在飞 timer（abortAll 幂等）。
  ctx.effect(() => () => {
    broker.dispose()
    // 【2026-09-11】FEMO内注入排队件（等主会话轮收口的）一并清，防 HMR 残留。
    disposeMainDeliveries()
  }, 'femo-plugin: node retry broker')

  // HTTP 路由（/femo-plugin/* 注册表，登记与按域处理体见 routes/）。
  registerRoutes(ctx, {
    resolved, bridge, runState, projections, sessionsStore, recordError,
  })

  // ── 驿站投递员的上门收件口（2026-09-16 system_push）───────────────────
  // 先起监听器再放行 bridge.start：实际端口经 bridge.pushUrl 交 daemon-client
  // 门铃心跳上报给常驻引擎（2026-09-26 换形；旧 spawn env FEMO_PUSH_PORT 交付
  // 随桥退役）。起不来（端口全占）=降级自取模式（collect/事件兜底兜住，
  // 不断戏）。收件口与事件现场的互斥由 RunState 三本簿保证（先投后发事件）；
  // 2026-09-17 起角色料包也上门（对齐主模型），defaultModel 供派工函数用。
  const pushListener = await startMailboxPushListener(ctx, {
    resolved, bridge, runState, projections, sessionsStore, defaultModel, recordError,
  })
  bridge.pushPort = pushListener?.port

  // Bridge lifecycle: 连接常驻引擎（daemon-client，不再拉 Python 子进程），stop on dispose.
  setTimeout(() => { bridge.start(ctx, resolved) }, 1000)
  ctx.effect(() => () => {
    // 先置 disposed 再 stop：bridge.stop() 触发的 onExited 据此跳过 C1
    // respawn（插件卸载/HMR 后不留僵尸引擎进程）。
    bridgeSupervisor.markDisposed()
    void bridge.stop()
  }, 'femo-plugin: bridge lifecycle')
  // 唤醒的冷投影窗 detach：插件卸载/HMR 重载时移出 sessions store，防泄漏。
  ctx.effect(() => () => {
    for (const dispose of awakenedDisposers.splice(0)) {
      try { dispose() } catch { /* 已分离则忽略 */ }
    }
    // 【2026-09-11】同时收尾接管的写盘句柄（attachProjectionWriter）——不 close
    // 会把单写者所有权留在进程里，下次 boot 的 open('write') 会被拒。
    disposeProjectionWriters()
  }, 'femo-plugin: awakened projection windows')

  // persistence.list 指纹缓存（2026-08-30 会话列表卡死修复）：session.list /
  // session.history 的全量 header 扫描降到 ~50ms；卸载即恢复裸方法。
  // 停用史：2026-09-08 因 0.1.3-alpha.2 实验实例上冷会话从列表消失而停用。
  // 2026-09-12 复盘并恢复：根因是 0.1.3+ 官方消费方改用 persistence.list({ signal })
  // 选项对象传参，包装层按裸 signal 解析直接 TypeError（list RPC 全体失败）。
  // list-cache.ts 已兼容两种传法；当前实例 0.1.5-rc.1 的列表链路为
  // ApiSessionList.list → sessionQuery.listSessions → SessionCorpus.listSessions
  // → persistence.list()（SQLite 索引只加速搜索，不接管列表），缓存包装点仍是热路径。
  ctx.effect(() => installPersistenceListCache(ctx), 'femo-plugin: persistence list cache')

  // ── 主模型专用工具（femo-mount/run/script/soul/chronica/debug）────────
  //    执行依赖组装迁 tool-deps.ts（2026-09-25 刀④）：总纲唯一活在公共层，
  //    dsh 会话型执行体（挂载写会话记录/启动运行/暂停转调单份裁决/干跑/台账）在彼处，
  //    这里只注入装配好的依赖。
  const toolDeps = createFemoToolDeps({ ctx, resolved, bridge, runState, sessionsStore, projections, recordError })

  // 断电闭环（§10.2）：宿主启动/重启后扫会话记录 currentJobId 重建索引——
  // 引擎 reconcile 已把断电现场判 suspended(crash)，前端经 /session-state
  // 看到挂起+断点即可「继续」。
  void rebuildJobIndexFromRecords(resolved.femoRoot, runState)

  ctx.effect(() => registerFemoTools(ctx, toolDeps, projections), 'femo-plugin: main-model tools')
}
