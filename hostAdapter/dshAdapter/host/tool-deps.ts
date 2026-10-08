/**
 * tool-deps.ts — 主Agent工具的执行依赖（2026-09-25 刀④自 index.ts 抽出，逻辑逐字）。
 *
 * 工具的「总纲」（名字/描述/参数/归一口径）唯一活在公共层 tools-core；本文件
 * 是 dsh 特有的**会话型执行体**：挂载写会话记录、启动运行走 startJobOnSession、
 * 暂停裁决转调单份化正身（run-control.pauseJobResolved）、干跑走监工、台账
 * 查询直跑 chronica.py CLI。原为 index.ts 内联的 toolDeps 字面量（~230 行）。
 */
import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
import type { FemoBridge } from './bridge'
import type { ResolvedConfig } from './config'
import type { RunState } from './events/engine-events'
import { broadcastSse } from './http'
import {
  readSessionScript, writeSessionScript,
  readSessionScriptText, readSessionCurrentJob,
} from './state-files'
import { assertRunAllowed, startJobOnSession, collectLlmModels, pauseJobResolved } from './run-control'
import { isFemoMainAgent } from './femoIdentity'   // 身份轴（2026-10-07 去预设后唯一尺子）
import { rememberFemoFile } from './femo-files'
import { collectDebugRun } from './debug-run'
import type { DebugRunCollect } from './debug-run'
import { chronicaCliArgs } from '../../../femo2host/host/tools-core.mjs'
import { mountLedgerPath, upsertMountRecord } from '../../../femo2host/host/mount-registry.mjs'
import type { ProjectionRegistry } from './projection/projection'
import type { FemoToolDeps } from './tools'

/** 组装主Agent工具的执行依赖（apply 装配调用一次，闭包注入现成链路）。 */
export function createFemoToolDeps(deps: {
  ctx: Context
  resolved: ResolvedConfig
  bridge: FemoBridge
  runState: RunState
  sessionsStore?: { get(id: SessionId): Session | undefined }
  projections: ProjectionRegistry
  recordError(sessionId: SessionId, text: string): void
}): FemoToolDeps {
  const { ctx, resolved, bridge, runState, sessionsStore, projections, recordError } = deps

  // 公共解析：会话校验 + 读挂载FEMO脚本（text 优先）+ 编译校验（check 命令）。
  // fresh_start 与 resume 共用——AI 看到的=AI 跑的=编译过的。
  const resolveMounted = async (sessionId: string): Promise<{ sid: SessionId; scriptText: string; effectivePath?: string }> => {
    const sid = SessionId(sessionId)
    const session = sessionsStore?.get(sid)
    if (session === undefined) {
      throw new Error(`会话 ${sessionId} 不存在`)
    }
    // 【2026-09-19 取消限制】非 FEMO 会话也允许 femo-mount / femo-run——
    // 运行期对话接管由运行态门卫（assertRunAllowed / pre-step gate）保证。
    // 守卫（§10.2）：本会话活跃才拒；他 session 活跃由引擎 another_job_active
    // 拒并原话上浮——文案信息化保留。
    assertRunAllowed(runState, sessionId)
    const scriptText = await readSessionScriptText(resolved.femoRoot, sessionId)
    if (scriptText === undefined) {
      throw new Error('会话未挂载FEMO脚本：请先 femo-mount 或用 femoGen 编辑器写入FEMO脚本')
    }
    const prev = await readSessionScript(resolved.femoRoot, sessionId)
    const effectivePath = prev?.path
    // 编译校验（femo-run 路径）：编译错误作为工具返回结果给主模型，
    // 带细节（parse_script 的行号/变量名）指导改脚本；不启动运行、无状态残留。
    const baseDir = effectivePath !== undefined
      ? effectivePath.replace(/[\\/][^\\/]*$/, '')
      : ''
    try {
      await bridge.send('check', { femo: scriptText, base_dir: baseDir, models: await collectLlmModels(ctx, resolved) }, 30_000)
    } catch (error: unknown) {
      throw new Error(`FEMO脚本编译失败：${String(error instanceof Error ? error.message : error)}`)
    }
    return { sid, scriptText, effectivePath }
  }

  return {
    // editor_errors 回传：只取编辑器来源（带 [编辑器·] 前缀）的错误，取走即从
    // 列表删除。engine 来源的错误（flow_error / 子 agent 失败等）不带走——它们
    // 已有 steer ❌ 必达通道，不应再经工具返回体重复通知主模型。
    // errors 大列表保留供画布面板 /femo-plugin/errors GET 显示用。
    takeEditorErrors: (sessionId: string): string[] => {
      const list = runState.errors.get(sessionId) ?? []
      if (list.length === 0) return []
      const taken: string[] = []
      const remaining: typeof list = []
      for (const e of list) {
        if (e.text.startsWith('[编辑器·')) {
          taken.push(e.text)
        } else {
          remaining.push(e)
        }
      }
      if (taken.length > 0) {
        runState.errors.set(sessionId, remaining)
      }
      return taken
    },
    mountScript: async (sessionId, scriptPath, sessionName) => {
      // 挂载=全新开始（用户语义「我就要这一版」）：旧版遗留的报错与本次
      // 挂载无关，先清空本会话错误列表——mount 之后之前的报错一律作废。
      runState.errors.delete(sessionId)
      // 双链路①：path + text 一起写。恢复面读取是 text 优先（实际运行版本），
      // mount 只写 path 的话，任何后续快照写回的 stale text 都会遮蔽新挂载的
      // FEMO脚本（2026-08-21「挂载后画布空白」bug 根因）。text 始终与文件内容一致。
      const { readFile } = await import('node:fs/promises')
      let text: string
      try {
        text = await readFile(scriptPath, 'utf8')
      } catch (error) {
        throw new Error(`无法读取脚本文件 ${scriptPath}：${String(error instanceof Error ? error.message : error)}`)
      }
      // 同步校验本次挂载文本（与 run 的 resolveMounted 同一套 check；base_dir=
      // 脚本文件所在目录，file: 相对引用按FEMO脚本位置解析）：mount 返回应报
      //「当前 mount 文本」的错误——历史残留已清、编辑器异步上报慢一拍，
      // 这里才是 mount 时刻的权威校验。有错只记不拦（挂载不受阻，编辑器可见）。
      const baseDir = scriptPath.replace(/[\\/][^\\/]*$/, '')
      try {
        await bridge.send('check', { femo: text, base_dir: baseDir, models: await collectLlmModels(ctx, resolved) }, 30_000)
      } catch (error: unknown) {
        recordError(SessionId(sessionId), `[编辑器·mount] ${String(error instanceof Error ? error.message : error)}`)
      }
      await writeSessionScript(resolved.femoRoot, sessionId, { path: scriptPath, text })
      // 挂载共同账本（2026-10-04 用户拍板「各家挂剧本都往一个文件写」）：
      // dsh 是会话型执行体，内存挂载=会话记录（画布编辑域照旧不动），这里只
      // 向 <数据根>/mounts.json 记一笔 {host, session, session_name, time,
      // script_path}——显示名挂载那刻从名册取（id 无人看得懂，给人看的场合
      // 显示它）。账本是记录不是正身：写失败打日志，不挡挂载。
      try {
        upsertMountRecord(
          {
            host: process.env.FEMO_HOST_NAME || 'dsh',
            session: sessionId,
            ...(sessionName ? { sessionName } : {}),
            scriptPath,
          },
          mountLedgerPath(resolved.femoRoot),
        )
      } catch (error) {
        console.log(`[femo-plugin] mount ledger write failed: ${String(error instanceof Error ? error.message : error)}`)
      }
      // 入账（2026-09-12）：AI femo-mount 的脚本与人工导入同待遇——进导入
      // 清单（femogen 导入浮层），手机端才能直接挑到 AI 刚挂载的那份。
      // rememberFemoFile 自吞写失败（只打日志），不会让挂载本身变失败。
      await rememberFemoFile(resolved.femoRoot, scriptPath, 'import')
      console.log(`[femo-plugin] femo-mount ${sessionId} <- ${scriptPath}`)
      // 双链路②：记录已更新 → 推信号让已打开的编辑器重读。否则旧画布的
      // 3s 防抖回写会用内存旧本盖掉新写入的地址，重新挂载等于白挂。
      broadcastSse('script_changed', { sessionId })
    },
    startJob: async (sessionId, mode, jobId) => {
      // §10.2：fresh——resolveMounted（守卫+读FEMO脚本+check 保留）→ 查旧
      // currentJobId 供幽灵书签 note → startJobOnSession(reset=true)；
      // resume——同 resolveMounted → startJobOnSession(reset=false, jobId)。
      // 六关/排他错误原话上浮（B2：不再静默）。
      const { sid, scriptText, effectivePath } = await resolveMounted(sessionId)
      if (mode === 'fresh') {
        // 幽灵书签 note：旧 Job 确为 suspended 才附注（get_job_state 失败不阻塞）。
        let note: string | undefined
        try {
          const oldJobId = await readSessionCurrentJob(resolved.femoRoot, sessionId)
          if (oldJobId !== undefined) {
            const st = await bridge.send('get_job_state', { job_id: oldJobId }, 15000) as { state?: string } | undefined
            if (st?.state === 'suspended') {
              note = `上一次 Job ${oldJobId} 已挂起存档，可 femo-run resume + job_id 或 list_jobs 找回`
            }
          }
        } catch { /* note 是增强信息，失败不阻塞主流程 */ }
        const warnings = await startJobOnSession(ctx, resolved, bridge, runState, sid, scriptText, effectivePath, true, undefined, projections)
        // jobId 从镜像取（prearm 已写入）
        const activeId = runState.activeJobId
        return { ok: true, jobId: activeId ?? -1, ...(note !== undefined ? { note } : {}), ...(warnings.length > 0 ? { warnings } : {}) }
      }
      const warnings = await startJobOnSession(ctx, resolved, bridge, runState, sid, scriptText, effectivePath, false, jobId, projections)
      const activeId = runState.activeJobId
      return { ok: true, jobId: activeId ?? jobId ?? -1, ...(warnings.length > 0 ? { warnings } : {}) }
    },
    pauseScript: async (sessionId, jobId) => {
      // 【2026-09-20 强停入口】【2026-09-24 单份化】裁决语义唯一活在
      // run-control.pauseJobResolved（显式走引擎档案归属+状态预检、缺省走
      // 镜像双判定→list_jobs 档案兜底、始终不裸发 job_pause；HTTP /pause
      // 路由同一份）。本壳只做工具呈现：not-owner 抛错原话上浮为 ❌，
      // 其余映射回执。
      const out = await pauseJobResolved(bridge, runState, sessionId, jobId)
      if (out.kind === 'no-such-job') {
        console.log(`[femo-plugin] femo-run pause (explicit) ${sessionId} job=${String(jobId)} -> no_such_job`)
        return { paused: false, jobId }
      }
      if (out.kind === 'not-owner') {
        throw new Error(`Job ${jobId} 不属于会话 ${sessionId}（归属 ${out.ownerShow}），拒绝暂停`)
      }
      if (out.kind === 'idle') {
        console.log(`[femo-plugin] femo-run pause (explicit) ${sessionId} job=${String(out.jobId)} -> idle state=${out.state}`)
        return { paused: false, state: out.state, jobId: out.jobId }
      }
      if (out.kind === 'none') {
        console.log(`[femo-plugin] femo-run pause ${sessionId} -> no running job (mirror=${String(out.mirrorJobId ?? '-')}, active=${String(out.activeJobId ?? '-')})`)
        return { paused: false }
      }
      console.log(`[femo-plugin] femo-run pause ${sessionId} job=${String(out.jobId)} -> paused=${out.paused} state=${String(out.state ?? '-')}`)
      return { paused: out.paused, state: out.state, jobId: out.jobId }
    },
    listJobs: async () => {
      const result = await bridge.send('list_jobs', {}, 15000) as { jobs?: Array<{ job_id: number; state: string; reason: string; waiting_human: boolean; femo_session_id: number | null; host_ref: string; host_refs: Record<string, string>; script_name: string; created_at: string; updated_at: string; has_breakpoint: boolean }> } | undefined
      return result?.jobs ?? []
    },
    // 【2026-10-07 去预设换轴】工具的调用者校验＝**本会话就是 FEMO 会话**
    // （身份轴 femoIdentity：权威判据=有戏有账，挂过脚本/跑过 Job；旧预设标记
    //  只作 legacy 命中）。角色子代理（parentSession 在场）仍被拒——工具面的
    // 角色噪音过滤不放松（作者铁律）。
    isFemoMainSession: (agent) => isFemoMainAgent(agent),
    // ── 附身工具（femo_possess，2026-09-25 接总纲收编版）──────────────────
    // 执行体在总纲（tools-core createBridgeToolImpls），dsh 只注入 IO 三件：
    // 桥命令直通、引擎根、运行态（本会话有 running Job=启动运行锁冻结绑定）。
    femoRoot: resolved.femoRoot,
    bridgeSend: (cmd, args, timeoutMs) => bridge.send(cmd, args ?? {}, timeoutMs ?? 15000),
    sessionBusy: (sessionId) => {
      for (const mirror of runState.jobs.values()) {
        if (mirror.ownerSid === sessionId && mirror.state === 'running') return true
      }
      return false
    },
    soulList: async () => {
      // femo-soul list：主模型写脚本挑角色前查角色库（bridge 直读 DB）。
      const result = await bridge.send('list_souls', {}, 15000) as { souls?: Array<{ soul_id: string; soul_name: string }> } | undefined
      return { souls: result?.souls ?? [] }
    },
    soulCreate: async (soulId, soulName, description) => {
      // femo-soul create：新建全局角色（归属/创建者固定 u001，与前端 soul 弹窗同链路）。
      return bridge.send('create_soul', { soul_id: soulId, soul_name: soulName, description, user_id: 'u001' }, 15000)
    },
    readScript: async (sessionId) => {
      const record = await readSessionScript(resolved.femoRoot, sessionId)
      if (record === undefined) return undefined
      const finalText = await readSessionScriptText(resolved.femoRoot, sessionId)
      if (finalText === undefined) return undefined
      return { path: record.path, text: record.text, finalText }
    },
    debugRun: async (sessionId, opts) => {
      // femo-debug：零 token 干跑当前挂载的脚本（与 femoGen 调试窗同一台
      // femo_debugger）。与 femo-run 的差别：不查 Job 守卫、不开 Job、不广播、
      // 不 check——调试器自己会编译并原话报错；跑的是独立沙盒，不碰生产台账。
      // 读文本与 femo-script 同源（text 优先，实际运行版本），scriptPath 供
      // code: file:"xxx.py" 相对引用解析（与正式运行同语义）。
      const scriptText = await readSessionScriptText(resolved.femoRoot, sessionId)
      if (scriptText === undefined) {
        throw new Error('会话未挂载FEMO脚本：请先 femo-mount 挂载，或用 femoGen 编辑器写入FEMO脚本')
      }
      const prev = await readSessionScript(resolved.femoRoot, sessionId)
      const started = Date.now()
      const result = await collectDebugRun(ctx, resolved, {
        femo: scriptText,
        ...(prev?.path !== undefined ? { scriptPath: prev.path } : {}),
        ...(opts.module !== undefined && opts.module.length > 0 ? { module: opts.module } : {}),
        ...(opts.runs !== undefined ? { runs: opts.runs } : {}),
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
      }, opts.signal)
      console.log(`[femo-plugin] femo-debug ${sessionId} → exit=${result.exitCode}`
        + ` records=${result.records.length} report=${result.report !== undefined}`
        + ` timedOut=${result.timedOut}`
        + `${opts.module !== undefined && opts.module.length > 0 ? ` module=${opts.module}` : ''}`
        + `（${Date.now() - started}ms）`)
      return result
    },
    chronicaQuery: async (opts) => {
      // femo-chronica：直接复用 femo2host/femoToolcall/chronica.py CLI。
      // 只读查询，一次性子进程——不走 bridge（那条链路是运行控制/写库用的）。
      // CLI 拼装走总纲（tools-core，zcode 同一份，2026-09-15）。
      const args = chronicaCliArgs(opts)
      const subprocess = ctx.get('subprocess') as {
        resolveExecutable(command: string): Promise<string>
      } | undefined
      if (subprocess === undefined) {
        throw new Error('subprocess 服务不可用（无法解析 python 可执行文件）')
      }
      const pythonPath = await subprocess.resolveExecutable(resolved.python)
      const [{ execFile }, { promisify }, { join }] = await Promise.all([
        import('node:child_process'),
        import('node:util'),
        import('node:path'),
      ])
      try {
        const { stdout } = await promisify(execFile)(
          pythonPath,
          [join(resolved.femoRoot, 'femo2host', 'femoToolcall', 'chronica.py'), ...args],
          {
            timeout: 15_000,
            maxBuffer: 32 * 1024 * 1024,
            encoding: 'utf8',
            env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
          },
        )
        return stdout
      } catch (error: unknown) {
        // 红线：不许静默吞错——退出码/stderr 原样带回给主模型。
        const err = error as { code?: unknown; stderr?: unknown; killed?: boolean; message?: unknown }
        if (err.killed === true) throw new Error('chronica.py 查询超时（15s）')
        const stderr = typeof err.stderr === 'string' && err.stderr.length > 0 ? err.stderr : String(err.message ?? '')
        throw new Error(`chronica.py 查询失败（退出码 ${String(err.code ?? '?')}）：${stderr.slice(-800)}`)
      }
    },
  }
}
