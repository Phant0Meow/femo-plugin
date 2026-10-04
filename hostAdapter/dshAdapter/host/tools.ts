/**
 * tools.ts — femo-plugin 主模型专用工具（femo-mount / femo-run / femo-script /
 * femo-soul / femo-chronica / femo-debug）。
 *
 * 只注册给主模型（无 parentSession 的 femo 会话 agent）；子代理（角色）
 * 不可见——挂载/运行/调试FEMO脚本是主Agent的事。
 *
 * 2026-09-15 分层：工具的「总纲」（名字/描述/参数 schema/归一口径）上移
 * femo2host/host/tools-core.mjs（zcode 同源共用，两边不再各自漂移）；本文件
 * 只剩 DSH 特有的执行体——挂载/运行/读FEMO脚本是会话型（写会话记录、走
 * startJobOnSession、结果进投影窗），经依赖注入复用 index.ts 现成链路。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ProjectionRegistry } from './projection/projection'
import { debugRunToolOutcome } from './debug-run'
import type { DebugRunCollect } from './debug-run'
import {
  buildToolSpecs,
  createBridgeToolImpls,
  normalizeChronicaOpts,
  validateSoulCreate,
} from '../../../femo2host/host/tools-core.mjs'
import { hostAddr } from './hub/hub-feed'   // 宿主自称（femo_possess 的 host 缺省值）
import { rosterNameOfSession } from './session-roster' // 会话显示名（挂载账本 session_name）

/** index.ts 注入给工具的执行依赖。 */
export interface FemoToolDeps {
  /** 挂载FEMO脚本到会话（写会话记录 {path}，用户 femogen 立即可见）；
   *  sessionName=会话显示名（挂载共同账本的 session_name 用，可空）。 */
  mountScript(sessionId: string, scriptPath: string, sessionName?: string): Promise<void>

  /** 取走自上次调用以来的编辑器上报错误（restore/解析失败等），随工具结果回传主模型。 */
  takeEditorErrors?(sessionId: string): string[]
  /** 开 Job（fresh=job_start 从头 / resume=job_resume 六关裁决续跑）——
   *  实现落 index.ts（§10.2）：错误原话抛出（six-gate code+detail）。返回的
   *  warnings=编译警告（与 zcode 版对齐；主模型汇总另走驿站滞留件随停打包）。 */
  startJob(sessionId: string, mode: 'fresh' | 'resume', jobId?: number): Promise<{ ok: true; jobId: number; note?: string; warnings?: Array<{ where?: string; message?: string }> } | { ok: false; error: string }>
  /** 暂停本会话正在运行的 Job（缺省自动解析；幂等——引擎侧 suspended/
   *  finished/failed 照样回执 paused:true）。
   *  【2026-09-20 强停入口】带 jobId：按引擎档案裁决归属后强制暂停指定
   *  Job（不信任宿主内存镜像）；缺省：镜像解析不到时降级 list_jobs 查
   *  引擎档案兜底，引擎也确认无 running 才回 paused:false。 */
  pauseScript(sessionId: string, jobId?: number): Promise<{ paused: boolean; state?: string; jobId?: number }>
  /** Job 清单（femo-run list_jobs——bridge list_jobs 代理）。 */
  listJobs(): Promise<Array<{ job_id: number; state: string; reason: string; waiting_human: boolean; femo_session_id: number | null; host_ref: string; host_refs: Record<string, string>; script_name: string; created_at: string; updated_at: string; has_breakpoint: boolean }>>
  /** 读会话当前挂载的脚本内容（最终生效文本 + 来源记录）。 */
  readScript(sessionId: string): Promise<{ path?: string; text?: string; finalText: string } | undefined>
  /** 列出全部角色（soul_id + soul_name，精简；femo-soul list）。 */
  soulList(): Promise<{ souls: Array<{ soul_id: string; soul_name: string }> }>
  /** 新建角色（全局，所有FEMO脚本可用；归属 u001；femo-soul create）。 */
  soulCreate(soulId: string, soulName: string, description: string): Promise<unknown>
  /** 查询运行台账（Chronica 编年史；复用插件根目录 chronica.py CLI，一次性子进程）。返回两幕文本。 */
  chronicaQuery(opts: { show?: number; list?: number; scope?: boolean; full?: boolean }): Promise<string>
  /** 零 token 干跑：把会话当前挂载的脚本交给 femo_debugger（FakeHost 替 AI/
   *  人类发言，不调任何模型），返回完整调试流水 + 终报。不占 Job、不写生产
   *  台账（独立 DB 沙盒），可与正式运行并行。编译失败抛 Error（原话上浮）。 */
  debugRun(sessionId: string, opts: { runs?: number; seed?: number; module?: string; signal?: AbortSignal }): Promise<DebugRunCollect>
  /** 是否为 femo 主会话（无 parentSession）——工具调用者校验。 */
  isFemoMainSession(agent: Agent): boolean
  /** 引擎根（femo_possess 写 hub 绑定账用）。 */
  femoRoot: string
  /** 桥命令直通（femo_possess 核对角色库 list_souls 用）。 */
  bridgeSend(cmd: string, args?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
  /** 运行态：该会话有 running Job=启动运行锁冻结绑定（femo_possess 注入件）。 */
  sessionBusy(sessionId: string): boolean
}

/** 工具 schema：name/description/parameters（与 ToolSchema 对齐的最小面）。 */
interface FemoToolSchema {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties: boolean
  }
}

/** 总纲规格（dsh 版描述）→ dsh 工具 schema：名字转 dash、补
 *  additionalProperties:false（dsh 工具面要求无损参数）。possess=true 才
 *  附上 femo_possess 规格（能力开关：总纲执行体需 dsh 注入会话身份/运行态）。 */
function specToSchema(name: string, possess = false): FemoToolSchema {
  const spec = buildToolSpecs({ host: 'dsh', possess }).find(s => s.name === name)
  if (spec === undefined) throw new Error(`tool spec missing: ${name}`)
  return {
    name: spec.name.replace(/_/g, '-'),
    description: spec.description,
    parameters: {
      type: 'object',
      properties: spec.parameters.properties,
      ...(spec.parameters.required !== undefined ? { required: spec.parameters.required } : {}),
      additionalProperties: false,
    },
  }
}

const mountTool = specToSchema('femo_mount')
const runTool = specToSchema('femo_run')
const debugTool = specToSchema('femo_debug')
const viewScriptTool = specToSchema('femo_script')
const soulTool = specToSchema('femo_soul')
const chronicaTool = specToSchema('femo_chronica')
const possessTool = specToSchema('femo_possess', true)

/** 调用者会话 id（主模型专用校验 + 提取）。返回 null = 非主模型调用。 */
function callerSessionId(deps: FemoToolDeps, agent: Agent | undefined): string | null {
  if (agent === undefined || !deps.isFemoMainSession(agent)) return null
  return String(agent.session.id)
}

/** 注册 femo 主模型工具（幂等：重复调用先注销再注册）。
 * projections 用于把动作回执广播进投影窗（主会话+god+全部角色窗统一通知）。 */
export function registerFemoTools(
  ctx: Context,
  deps: FemoToolDeps,
  projections: ProjectionRegistry,
): () => void {
  // cordis 服务注入后直接挂 ctx 属性（dsh-tool-todo 等插件同样用法）。
  const tools = (ctx as unknown as { tools?: {
    register(def: {
      name: string
      description: string
      parameters: unknown
      output: {
        schema: unknown
        render(args: unknown, value: { ok: boolean; error?: string }): Array<{ type: 'text'; text: string }>
      }
      execute(args: unknown, exec: { agent?: Agent; signal: AbortSignal }): Promise<unknown>
    }): () => void
  } }).tools
  if (tools === undefined) {
    console.log('[femo-plugin] tools service unavailable; femo-mount/femo-run/femo-script not registered')
    return () => undefined
  }

  const disposers: Array<() => void> = []

  const register = (
    schema: FemoToolSchema,
    run: (args: Record<string, unknown>, agent: Agent, exec: { signal: AbortSignal }) => Promise<unknown>,
    renderText?: (value: { ok: boolean; error?: string; script?: string; source?: string; lines?: number; path?: string; souls?: Array<{ soul_id: string; soul_name: string }>; note?: string; output?: string; text?: string }) => string,
  ): void => {
    const dispose = tools.register({
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args: unknown, value: { ok: boolean; error?: string; script?: string; source?: string; lines?: number; path?: string; output?: string; text?: string }) => [{
          type: 'text',
          text: value.ok === true
            ? (renderText !== undefined ? renderText(value) : JSON.stringify(value))
            : `❌ ${value.error ?? '未知错误'}`,
        }],
      },
      execute: async (args, exec) => {
        const sid = callerSessionId(deps, exec.agent)
        if (sid === null) {
          return { ok: false, error: '该工具仅 Femo 主会话可用（角色/子代理不可调用）' }
        }
        try {
          return await run((args ?? {}) as Record<string, unknown>, exec.agent!, { signal: exec.signal })
        } catch (error: unknown) {
          return { ok: false, error: String(error instanceof Error ? error.message : error) }
        }
      },
    })
    disposers.push(dispose)
    console.log(`[femo-plugin] tool registered: ${schema.name}`)
  }

  register(mountTool, async (args, agent) => {
    const scriptPath = typeof args.script_path === 'string' && args.script_path.trim().length > 0
      ? args.script_path.trim()
      : ''
    if (scriptPath.length === 0) {
      return { ok: false, error: 'script_path 是必填参数' }
    }
    await deps.mountScript(String(agent.session.id), scriptPath, rosterNameOfSession(agent.session))
    const editorErrors = deps.takeEditorErrors?.(String(agent.session.id)) ?? []
    return { ok: true, mounted: scriptPath, ...(editorErrors.length > 0 ? { editor_errors: editorErrors } : {}) }
  })

  register(runTool, async (args, agent) => {
    const action = typeof args.action === 'string' ? args.action.trim() : ''
    if (action !== 'fresh_start' && action !== 'pause' && action !== 'resume' && action !== 'list_jobs') {
      return { ok: false, error: 'action 是必填参数：fresh_start / pause / resume / list_jobs 四选一' }
    }
    const sid = String(agent.session.id)
    const jobIdArg = typeof args.job_id === 'number' && Number.isFinite(args.job_id)
      ? Math.trunc(args.job_id)
      : undefined
    switch (action) {
      case 'fresh_start': {
        // 直调 host 开 Job（§10.1——B1 死于结构：编辑器未打开也成功）。
        const result = await deps.startJob(sid, 'fresh')
        if (result.ok !== true) {
          return { ok: false, error: result.error }
        }
        // 成功回执广播（🎬 FEMO 已开始 → 主会话+全部投影窗）已下沉至
        // startJobOnSession 执行体（2026-09-06：femoGen 按钮与工具同观感），
        // 此处不再重复写。
        // 幽灵书签 note（§八.14）：上一次挂起的 Job 若有，明示找回入口。
        // job_id 结构化回传：主模型据此可对同一 Job 发 resume/pause。
        // warnings=编译警告即时回执（zcode 同款；滞留件汇总通道并行不悖）。
        return {
          ok: true, action, job_id: result.jobId,
          ...(result.warnings !== undefined && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
          note: `已从头开始运行FEMO脚本（Job ${result.jobId}）${result.note ? `；${result.note}` : ''}`,
        }
      }
      case 'pause': {
        // 暂停=挂起（断点保留可续跑）。缺省不带 job_id（2026-09-06 猫猫拍板）：
        // 执行体自动解析本会话正在运行的 Job（镜像解析不到时查引擎档案兜底）；
        // 带 job_id=强制暂停指定 Job（引擎档案归属裁决，2026-09-20 强停入口）。
        // 解析不到活跃 Job 时明示主模型带 job_id，不再含糊说"没有正在运行的
        // FEMO脚本"。暂停的用户通知由引擎 flow_paused 统一广播，工具侧不重复写。
        const result = await deps.pauseScript(sid, jobIdArg)
        if (result.paused !== true) {
          return {
            ok: true, action,
            ...(jobIdArg !== undefined
              ? { note: result.state !== undefined
                  ? `Job ${jobIdArg} 当前状态为 ${result.state}（非 running），无需暂停`
                  : `Job ${jobIdArg} 不存在（引擎无此档案）；可用 list_jobs 查询全部 Job` }
              : { note: '当前无活跃 job，引擎不知道你要挂起哪个。如果需要强制停止某 job，请带 job_id（可先 list_jobs 查询）' }),
          }
        }
        // note 里 undefined 插值会出字面量——jobId 条件展开（无损 JSON 约束）。
        return {
          ok: true,
          action,
          ...(result.jobId !== undefined ? { job_id: result.jobId } : {}),
          note: `已暂停挂起（${result.jobId !== undefined ? `Job ${result.jobId}，` : ''}断点保留，可 resume 续跑）`,
        }
      }
      case 'resume': {
        // resume 必须指名 Job（2026-09-06 猫猫拍板）：一个会话可能挂起多个
        // Job，缺省回退会续错场——直接报错引导先 list_jobs。
        if (jobIdArg === undefined) {
          return { ok: false, error: 'resume 必须指定 job_id：先 list_jobs 查询本会话挂起的 Job，再带 job_id 续跑' }
        }
        // 六关裁决错误原话 ❌（B2：不再固定"已续跑"）。
        const result = await deps.startJob(sid, 'resume', jobIdArg)
        if (result.ok !== true) {
          return { ok: false, error: result.error }
        }
        // ▶️ 广播已同上沉至 startJobOnSession（唯一广播点）。
        return {
          ok: true, action, job_id: result.jobId,
          ...(result.warnings !== undefined && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
          note: `已从挂起处续跑（Job ${result.jobId}）`,
        }
      }
      case 'list_jobs': {
        // AI 查历史挂起 Job 的唯一入口（v1 吸收——§八.14 闭环）。
        const jobs = await deps.listJobs()
        return { ok: true, action, jobs }
      }
    }
  })

  register(debugTool, async (args, agent, exec) => {
    // runs/seed/module 归一口径在总纲（debug-run-core 的 clamp/normalize），
    // deps.debugRun 执行体内部再走一次同一套归一——双入口同口径。
    const result = await deps.debugRun(String(agent.session.id), {
      runs: typeof args.runs === 'number' ? args.runs : undefined,
      ...(typeof args.seed === 'number' ? { seed: args.seed } : {}),
      ...(typeof args.module === 'string' && args.module.trim().length > 0 ? { module: args.module } : {}),
      signal: exec.signal,
    })
    const verdict = debugRunToolOutcome(result)
    if (verdict.ok !== true) {
      return { ok: false, error: verdict.error }
    }
    return {
      ok: true,
      runs: result.runs,
      ...(result.seed !== undefined ? { seed: result.seed } : {}),
      exit_code: result.exitCode,
      timed_out: result.timedOut,
      // 墙钟耗时（多轮线性叠加）：模型下次自己掂量轮数用。
      elapsed_ms: result.elapsedMs,
      outcomes: result.report?.runs.map(r => r.outcome) ?? [],
      log_path: result.logPath,
      // 被中断但有流水时的可读留档（框架会丢掉 aborted 的工具结果，靠它捞回）。
      ...(result.partialPath !== undefined ? { partial_path: result.partialPath } : {}),
      // text 已含流水 + 终报 + 落盘路径：render 原样上屏，UI/其他消费方也能取全文。
      text: verdict.text,
    }
  }, (value) => value.text ?? JSON.stringify(value))

  register(viewScriptTool, async (_args, agent) => {
    const record = await deps.readScript(String(agent.session.id))
    if (record === undefined) {
      return { ok: false, error: '会话未挂载FEMO脚本：请先 femo-mount 挂载，或用 femoGen 编辑器写入FEMO脚本' }
    }
    return {
      ok: true,
      source: record.path !== undefined ? 'file' : 'session-text',
      ...(record.path !== undefined ? { path: record.path } : {}),
      lines: record.finalText.split('\n').length,
      script: record.finalText,
    }
  }, (value) => {
    const head = `📜 挂载FEMO脚本（${value.source ?? ''}${value.path !== undefined ? `: ${value.path}` : ''}，${value.lines ?? '?'} 行）`
    return `${head}\n\n${value.script ?? ''}`
  })

  register(soulTool, async (args) => {
    if (args.action === 'list') {
      const { souls } = await deps.soulList()
      return { ok: true, souls }
    }
    if (args.action === 'create') {
      // 校验口径在总纲（soul_id 禁空格/逗号等）。
      const invalid = validateSoulCreate(args)
      if (invalid !== null) {
        return { ok: false, error: invalid }
      }
      await deps.soulCreate(String(args.soul_id).trim(), String(args.soul_name).trim(), String(args.description))
      return { ok: true, note: `已创建角色 ${String(args.soul_name).trim()}（soul_id=${String(args.soul_id).trim()}，脚本里用 soul:${String(args.soul_id).trim()} 引用）` }
    }
    return { ok: false, error: 'action 必填：list 或 create 二选一' }
  }, (value) => {
    if (value.note !== undefined) return value.note
    if (Array.isArray(value.souls)) {
      if (value.souls.length === 0) return '角色库为空'
      return `🎭 角色库（${value.souls.length} 个角色）：\n`
        + value.souls.map(s => `- ${s.soul_id}（${s.soul_name}）`).join('\n')
    }
    return JSON.stringify(value)
  })

  register(chronicaTool, async (args) => {
    // 参数归一与 CLI 拼装在总纲（zcode 同一份）。
    const opts = normalizeChronicaOpts(args)
    const output = await deps.chronicaQuery(opts)
    // dsh 工具结果要求无损 JSON：undefined 键会整个被拒（"not lossless JSON"），
    // 未传的参数一律不带键（条件展开），不能写 show: opts.show。
    return {
      ok: true,
      ...(opts.show !== undefined ? { show: opts.show } : {}),
      ...(opts.list !== undefined ? { list: opts.list } : {}),
      ...(opts.scope !== undefined ? { scope: opts.scope } : {}),
      ...(opts.full !== undefined ? { full: opts.full } : {}),
      output,
    }
  }, (value) => value.output ?? JSON.stringify(value))

  // ── 附身（femo_possess，2026-09-25 接总纲收编版；提名制 2026-09-26）───
  // 执行体唯一活在总纲（createBridgeToolImpls，zcode 同一份）：soul 存在性
  // 核对、hub 提名账正身写入（提名制无占用拒绝，最后指派算数定格生效）、
  // running 锁、human 排除、跨宿主/跨会话 host+session_id 全在总纲。dsh 只注入
  // 三件——本会话身份（调用者=主会话本体，execute 时动态取）、运行态、
  // 桥命令直通；announce 不注入：名册标注走投影中心渲染层（名册 name
  // 保持纯数据）。
  let possessCallerSid: string | undefined
  const possessImpls = createBridgeToolImpls({
    ensureBridge: async () => { /* dsh bridge.send 自带就绪队列，无独立 ensure 面 */ },
    send: (cmd, args, timeoutMs) => deps.bridgeSend(cmd, args, timeoutMs),
    femoRoot: deps.femoRoot,
    host: 'dsh',
    hostRef: hostAddr(),
    spawnPython: async () => { throw new Error('dsh 未启用总纲 spawn 路径（femo_possess 不经过它）') },
    debugSpawnProc: undefined as never,
    possess: {
      selfSid: () => possessCallerSid,
      running: () => possessCallerSid !== undefined && deps.sessionBusy(possessCallerSid),
    },
  })
  register(possessTool, async (args, agent) => {
    const sid = callerSessionId(deps, agent)
    if (sid === null) return { ok: false, error: 'femo-possess 仅主会话可用' }
    possessCallerSid = sid
    try {
      const v = await possessImpls.femo_possess!(args) as { error?: string; result?: Record<string, unknown>; note?: string }
      if (v.error !== undefined) return { ok: false, error: v.error }
      return { ok: true, ...(v.result ?? {}), ...(v.note !== undefined ? { note: v.note } : {}) }
    } finally {
      possessCallerSid = undefined
    }
  }, (value) => value.note ?? JSON.stringify(value))

  return () => {
    for (const dispose of disposers) {
      try { dispose() } catch { /* 注销失败不阻塞 */ }
    }
    disposers.length = 0
  }
}
