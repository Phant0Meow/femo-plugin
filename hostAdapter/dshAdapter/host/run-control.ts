/**
 * run-control.ts — 启动运行流程。
 *
 * 真正让一次运行跑起来的完整动作：读FEMO脚本（inline 文本或文件地址）、写会话FEMO脚本
 * 记录（地址/原文一致性判定）、清/带断点、解析 API key、命令引擎开跑。
 * 前端的运行按钮（/run、/create-session 路由）和 AI 的 femo-run/femo-mount
 * 工具最终都走到 startRunOnSession。另含脚本文件的保存/读取 handler 和
 * LLM 模型目录聚合（前端下拉 + 引擎编译校验白名单共用）。
 * 从 index.ts 原样迁出（2026-08-23 重构）。
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { FemoBridge } from './bridge'
import type { ResolvedConfig } from './config'
import { readBody, writeJson, broadcastSse, type SaveScriptBody } from './http'
import { FEMO_PRESET, presetOf, injectFemoRoot, femoRootSections } from './persona'
import { abortAllSubagents } from '../../../femo2host/host/subagent-core.mjs'
import { dataRootOf } from '../../../femo2host/femoRoot.mjs'   // 数据根单源（含 FEMO_DATA_DIR 分支）
import { pushDiag } from './diag/diag-feed'
import type { RunState } from './events/engine-events'
import { jobMirrorPrearm, broadcastProjectionState, activeJobOfSession } from './events/engine-events'
import { resolveAndPauseJob } from '../../../femo2host/host/run-control-core.mjs'
import { mainSessionIdOf, type ProjectionRegistry } from './projection/projection'
import { broadcastCompat } from './projection/windowing-native'
import {
  setSessionCurrentJob, readSessionCurrentJob, appendSessionJob,
  readSessionScript, writeSessionScript, readSessionScriptText,
} from './state-files'
import { snapshotJobCast } from '../../../femo2host/host/cast-core.mjs'
import { rememberFemoFile } from './femo-files'
import { hostAddr } from './hub/hub-feed'   // 宿主自称（host_refs 归属键，与喂/读侧同一词）

// ── 凭证与模型目录 ────────────────────────────────────────────────────────

/** Resolve the engine's LLM key from dsh credentials (absent → AI nodes fail). */
async function resolveApiKey(ctx: Context, resolved: ResolvedConfig): Promise<string | undefined> {
  const credentials = ctx.get('credentials') as { resolve(ref: unknown): Promise<{ value: string } | undefined> } | undefined
  if (credentials === undefined) return undefined
  const cred = await credentials.resolve(resolved.apiKeyRef)
  return cred !== undefined ? cred.value : undefined
}

interface LlmModelEntry { id: string; name?: string }
interface LlmProviderEntry { id: string; name?: string; models: LlmModelEntry[] }
/** FEMO脚本 source 白名单 payload：引擎编译期校验 + 前端下拉的数据源。 */
interface LlmModelsPayload {
  /** 裸 id source 归属的默认 provider（插件配置 dshProvider）。 */
  defaultProvider: string
  providers: LlmProviderEntry[]
}

/** 聚合 dsh 当前可用 LLM provider/模型列表（前端下拉 + 引擎编译校验白名单）。
 * llm 服务缺失或单个 provider 拉取失败 → 兜底默认/跳过，绝不整体失败。 */
export async function collectLlmModels(ctx: Context, resolved: ResolvedConfig): Promise<LlmModelsPayload> {
  const fallback: LlmModelsPayload = {
    defaultProvider: resolved.dshProvider,
    providers: [{ id: resolved.dshProvider, models: [{ id: resolved.model }] }],
  }
  const llm = ctx.get('llm') as {
    listProviders(): { id: string; name?: string }[]
    listModels(provider: string): Promise<readonly { id: string; name?: string }[]>
  } | undefined
  if (llm === undefined || typeof llm.listProviders !== 'function' || typeof llm.listModels !== 'function') {
    return fallback
  }
  let providers: LlmProviderEntry[]
  try {
    providers = []
    for (const info of llm.listProviders()) {
      try {
        const models = await llm.listModels(info.id)
        providers.push({ id: info.id, name: info.name, models: models.map((m) => ({ id: m.id, name: m.name })) })
      } catch (error: unknown) {
        console.log(`[femo-plugin] listModels(${info.id}) failed: ${String(error)}`)
      }
    }
  } catch (error: unknown) {
    console.log(`[femo-plugin] listProviders failed: ${String(error)}`)
    return fallback
  }
  if (providers.length === 0) return fallback
  return { defaultProvider: resolved.dshProvider, providers }
}

// ── 开跑 ─────────────────────────────────────────────────────────────────

// 【run 诊断】2026-08-29 912 僵尸双跑调查埋点：同一请求的全生命周期（到达→
// 守卫支路→编译→reset/resume 支路→canResume 判定→running 置位→bridge 发送）
// 每步一行带毫秒时间戳与请求编号，terminal 直接看。竞态分析=对比两个请求的
// 置位时刻与守卫通过时刻。
let runDiagSeq = 0
const diagTs = (): string => new Date().toISOString().slice(11, 23)

/** Start one engine run bound to a Femo session. Registers the mirror (prearm)
 * BEFORE the engine's flow_start arrives (§八.11：命令成功回执=引擎已接受的
 * 最早证据，pre-step 守卫在秒级窗口不再裸奔）。断点裁决全归引擎 job_resume
 * 六关（§8.1）：宿主不再算指纹、不再持有 resume 块——单一职责。 */
export async function startJobOnSession(
  ctx: Context,
  resolved: ResolvedConfig,
  bridge: FemoBridge,
  runState: RunState,
  sessionId: SessionId,
  scriptText: string,
  scriptPath?: string,
  reset = false,
  jobId?: number,
  projections?: ProjectionRegistry,
): Promise<Array<{ where?: string; message?: string }>> {
  console.log(`[femo-run-diag ${diagTs()}] startJob begin sid=${String(sessionId)} reset=${reset}${jobId !== undefined ? ` jobId=${jobId}` : ''}`)
  const apiKey = await resolveApiKey(ctx, resolved)
  if (apiKey === undefined) {
    console.log(`[femo-plugin] credential ${resolved.apiKeyRef} not resolved; AI nodes will fail`)
  }
  // 会话FEMO脚本记录 + 运行时一致性检测：引擎永远跑「前端文本」；记录形态取决于
  // 地址文件与前端文本是否一致——一致 → 只存地址（不保留原文）；不一致 →
  // 地址与原文并存（text=浏览器端实际运行版本）。读历史时 text 优先。
  const sid = String(sessionId)
  const prev = await readSessionScript(resolved.femoRoot, sid)
  const effectivePath = scriptPath ?? prev?.path
  try {
    if (effectivePath !== undefined) {
      const { readFile } = await import('node:fs/promises')
      let fileText: string | undefined
      try {
        fileText = await readFile(effectivePath, 'utf8')
      } catch {
        fileText = undefined // 地址文件被删：降级为原文态（不报错）
      }
      const same = fileText !== undefined && fileText.replace(/\r\n/g, '\n') === scriptText.replace(/\r\n/g, '\n')
      await writeSessionScript(resolved.femoRoot, sid, same
        ? { path: effectivePath }
        : { path: effectivePath, text: scriptText })
    } else {
      await writeSessionScript(resolved.femoRoot, sid, { text: scriptText })
    }
  } catch (error: unknown) {
    console.log(`[femo-plugin] session script record failed: ${String(error)}`)
  }
  // 记录随运行版本更新（rev 已变）：广播各端静默同步 rev/内容，
  // 避免各页面下次快照写因 rev 滞后而误触 409 冲突弹窗。
  broadcastSse('script_changed', { sessionId })
  // 【2026-08-30 串台修复①→Job 化（§8.1）】开跑前清理上一次残留的在飞子代理。
  // 仅当引擎无活跃 Job（activeJobId undefined）才执行——有活跃 Job 的调用方
  // 本身在越轨开跑（引擎 another_job_active 会拒），此时绝不能误杀在跑FEMO脚本的
  // 合法角色；空闲槽上的在飞子代理必然是残留物（bridge 死亡等异常漏网，
  // flow_paused/flow_error 收口覆盖不到的），全场掐断防其污染新场次的窗口
  // 直播（「角色串台」）。
  if (runState.activeJobId === undefined) {
    const killed = abortAllSubagents('新脚本开跑：清理上一次残留子代理')
    if (killed > 0) console.log(`[femo-plugin] new run: cleaned ${killed} leftover subagent(s)`)
  }
  // 编译警告上浮调用方（femo-run 工具返回值；主模型汇总通道另走驿站滞留件）。
  // 声明在 try 外：return 在收尾（try/catch 之后），块内赋值。
  let startedWarnings: Array<{ where?: string; message?: string }> = []
  try {
    // base_dir = 脚本文件所在目录（todo #2）：code/memory/context 的相对
    // file: 地址基于它解析。有地址（已保存/导入）→ 脚本文件所在目录；
    // 未保存（纯文本）→ 传空字符串，引擎对相对路径直接报错（只支持绝对地址）。
    const baseDir = effectivePath !== undefined
      ? effectivePath.replace(/[\\/][^\\/]*$/, '')
      : ''
    // script_name：Job 档案的可读名（list_jobs/日志用）——有地址取文件名，
    // 未保存取"inline"。
    const scriptName = effectivePath !== undefined
      ? effectivePath.split(/[\\/]/).pop() || 'inline'
      : 'inline'
    if (reset) {
      // fresh：job_start（引擎排他裁决 another_job_active 原话上浮——B4）。
      console.log(`[femo-run-diag ${diagTs()}] job_start SEND sid=${sid}`)
      const res = await bridge.send('job_start', {
        femo: scriptText,
        base_dir: baseDir,
        user_api_key: apiKey,
        user_api_provider: resolved.provider,
        user_api_url: resolved.apiUrl,
        user_api_model: resolved.model,
        host_ai_backend: resolved.hostAiBackend,
        // source 编译期校验白名单：引擎 parse_script 时校验 actors 的 source 字段
        models: await collectLlmModels(ctx, resolved),
        host_ref: sid,
        // 多宿主归属账（2026-09-21 账本多宿主化）：{宿主名: 会话id} 一格一
        // 宿主；host_ref 单值保留（兼容回退读法）。
        host_refs: { [hostAddr()]: sid },
        script_name: scriptName,
        // FEMO脚本快照随 Job 档案落盘（引擎侧 get_job_state 带出——femoGen 凭
        // job_id 渲染/续跑的数据源）。未保存=''（引擎缺省，纯文本次无地址可存）。
        script_path: effectivePath ?? '',
      }, 30_000) as { job_id?: number; warnings?: Array<{ where?: string; message?: string }> } | undefined
      const newJobId = res?.job_id
      if (typeof newJobId !== 'number') {
        throw new Error(`job_start 回执缺 job_id: ${JSON.stringify(res)}`)
      }
      // 编译期警告上浮（2026-09-07 warning 桶）：编译放行但作者应知情。
      // SSE compile_warnings 事件专供 femoGen 调试窗等前端面板（聊天广播到不了
      // 调试窗——它只吃引擎事件流）；信封带 sid 供前端按会话过滤。
      const compileWarnings = Array.isArray(res?.warnings) ? res.warnings : []
      startedWarnings = compileWarnings
      if (compileWarnings.length > 0) {
        console.log(`[femo-plugin] job_start warnings: ${compileWarnings.length} item(s)`)
        broadcastSse('compile_warnings', { sid, job_id: newJobId, warnings: compileWarnings })
      }
      await setSessionCurrentJob(resolved.femoRoot, sid, newJobId)
      await appendSessionJob(resolved.femoRoot, sid, newJobId)
      // 预绑定定格（绑定账正身住 hub）：偏好账全量誊写进本 Job 绑定账
      // （cast/<jobId>.json）。此刻定格——运行中改绑定无效，账随 Job 存档、
      // 续跑恢复。失败只留痕不阻断启动运行（绑定账缺页=该 Job 退回全子代理运行，
      // 不影响正确性）。
      void snapshotJobCast(resolved.femoRoot, newJobId).catch((error: unknown) => {
        console.log(`[femo-plugin] cast snapshot failed (job=${newJobId}): ${String(error)}`)
      })
      jobMirrorPrearm(runState, newJobId, sid)
      // 编译警告的主模型通道=桥产滞留件（job_start 时已进驿站，subkind=
      // warning），随本 Job 下一个停下时刻代取打包 steer（2026-09-16 起宿主
      // 不再自建警告桶）。此处只保留两个显示面：SSE compile_warnings（femoGen
      // 调试窗）与聊天窗逐条广播。
      pushDiag('run', `job_start OK prearm job=${newJobId} sid=${sid.slice(-12)}（activeJobId 已指向本 Job）`)
      broadcastProjectionState(runState, sid)
      // 【2026-09-06 猫猫拍板】开跑/续跑的用户通知在执行体统一广播（主会话+
      // 全部投影窗）——femoGen 右上角按钮与 AI 工具两条入口同观感（原 tools.ts
      // 工具侧广播已删，此处为唯一广播点）。
      if (projections !== undefined) {
        const session = (ctx.get('sessions') as { get(id: SessionId): Session | undefined } | undefined)?.get(SessionId(sid))
        if (session !== undefined) {
          broadcastCompat(ctx, session, projections, '🎬 FEMO 已开始（在上帝视角窗口查看）')
          // 编译警告逐条广播（编译没被阻断，但作者应当知情）。
          for (const w of compileWarnings) {
            broadcastCompat(ctx, session, projections,
              `ℹ️ 编译警告${w.where ? `（${w.where}）` : ''}：${w.message}`)
          }
        }
      }
      console.log(`[femo-run-diag ${diagTs()}] job_start OK job=${newJobId} sid=${sid} (prearm: guard window closed)`)
    } else {
      // resume：断点裁决全归引擎六关（no_such_job/already_running/
      // not_resumable/fingerprint_mismatch/session_missing/no_breakpoint）——
      // 错误原话 throw 上浮（调用方 HTTP 400 / 工具 ❌——B2/C2 死于结构，
      // 不再静默 fresh）。
      const targetJobId = jobId ?? await readSessionCurrentJob(resolved.femoRoot, sid)
      if (targetJobId === undefined) {
        throw new Error('当前会话没有可续跑的 Job（未运行过或已完整跑完），请 fresh_start')
      }
      console.log(`[femo-run-diag ${diagTs()}] job_resume SEND job=${targetJobId} sid=${sid}`)
      const res = await bridge.send('job_resume', {
        job_id: targetJobId,
        femo: scriptText,
        base_dir: baseDir,
        user_api_key: apiKey,
        user_api_provider: resolved.provider,
        user_api_url: resolved.apiUrl,
        user_api_model: resolved.model,
        host_ai_backend: resolved.hostAiBackend,
        // source 编译期校验白名单（与 job_start 同款；resume 也要校验——
        // 改了 source 的脚本续跑同样该在编译期报错）
        models: await collectLlmModels(ctx, resolved),
        host_ref: sid,
        // 多宿主归属账（同 fresh 分支；resume 合并语义——只动自己格）。
        host_refs: { [hostAddr()]: sid },
      }, 30_000) as { resumed?: boolean; warnings?: Array<{ where?: string; message?: string }> } | undefined
      // 编译期警告上浮（2026-09-07 warning 桶，同 fresh 分支）。
      const resumeWarnings = Array.isArray(res?.warnings) ? res.warnings : []
      startedWarnings = resumeWarnings
      if (resumeWarnings.length > 0) {
        console.log(`[femo-plugin] job_resume warnings: ${resumeWarnings.length} item(s)`)
        broadcastSse('compile_warnings', { sid, job_id: targetJobId, warnings: resumeWarnings })
      }
      // mark_running 已由引擎完成；宿主收口：currentJobId 指向本 Job（续旧
      // Job 时会把它提为当前——femoGen 的暂停/继续按钮跟随）、jobIds 幂等登记
      // （fresh 时已记则不动）+ prearm。
      await setSessionCurrentJob(resolved.femoRoot, sid, targetJobId)
      await appendSessionJob(resolved.femoRoot, sid, targetJobId)
      // 续跑同样重放预绑定定格：Job 账已有账则幂等覆盖同值；换宿主/换机续跑
      // 时本宿主的预绑定借此落进账（hub 全局账，只动自己格）。
      void snapshotJobCast(resolved.femoRoot, targetJobId).catch((error: unknown) => {
        console.log(`[femo-plugin] cast snapshot failed (job=${targetJobId}): ${String(error)}`)
      })
      jobMirrorPrearm(runState, targetJobId, sid)
      // 编译警告通道同 fresh 分支：桥产滞留件随停打包，宿主不自建桶。
      pushDiag('run', `job_resume OK prearm job=${targetJobId} sid=${sid.slice(-12)}`)
      broadcastProjectionState(runState, sid)
      if (projections !== undefined) {
        const session = (ctx.get('sessions') as { get(id: SessionId): Session | undefined } | undefined)?.get(SessionId(sid))
        if (session !== undefined) {
          broadcastCompat(ctx, session, projections, '▶️ FEMO 已继续（在上帝视角窗口查看）')
          // 编译警告逐条广播（同 fresh 分支；续跑改了FEMO脚本同样该知情）。
          for (const w of resumeWarnings) {
            broadcastCompat(ctx, session, projections,
              `ℹ️ 编译警告${w.where ? `（${w.where}）` : ''}：${w.message}`)
          }
        }
      }
      console.log(`[femo-run-diag ${diagTs()}] job_resume OK job=${targetJobId} sid=${sid} (prearm: guard window closed)`)
    }
  } catch (error: unknown) {
    // prearm 只在成功回执后执行——失败路径无镜像残留（守卫自然放行）。
    throw error
  }
  console.log(`[femo-plugin] started script on ${sessionId}${scriptPath !== undefined ? ` (${scriptPath})` : ''}`)
  // 编译警告上浮调用方（femo-run 工具返回值——与 zcode 版对齐；主模型汇总
  // 通道另走驿站滞留件，两不误）。
  return startedWarnings
}

/** 运行守卫（GUARD 同款判定）：2026-09-24 B1 收公共层——语义唯一活在
 *  run-state-core.assertRunAllowed，此处引入+再导出（index/routes 零改动）。 */
import { assertRunAllowed } from '../../../femo2host/host/run-state-core.mjs'
export { assertRunAllowed }

// ── 暂停/强停裁决（唯一语义份，2026-09-24 B3 收公共层）──────────────────

export type PauseOutcome =
  | { kind: 'paused'; jobId: number; paused: boolean; state?: string }
  | { kind: 'no-such-job'; jobId?: number }
  | { kind: 'not-owner'; ownerShow: string }
  | { kind: 'idle'; state: string; jobId: number }
  | { kind: 'none'; mirrorJobId?: number; activeJobId?: number | null }

/** 解析并执行「暂停本会话的一个 Job」，femo-run 工具路径（index.pauseScript）
 *  与 HTTP /pause 路由（routes.ts）的共用入口。裁决语义 2026-09-24 B3 收编
 *  公共层 run-control-core.resolveAndPauseJob（显式=引擎档案归属+状态预检、
 *  缺省=镜像快路径→list_jobs 档案兜底、始终不裸发 job_pause；zcode/autoclaw
 *  的 tools-core pause 同吃这一份）——本壳只补 dsh 特有：①内存镜像双判定
 *  作快路径注入 ②'none' 案附带镜像诊断字段。呈现形态（工具 ❌ 抛错 / HTTP
 *  错误面板+诊断流留痕）留各自调用方。桥不通时 send 抛错原样上浮。 */
export async function pauseJobResolved(
  bridge: Pick<FemoBridge, 'send'>,
  runState: RunState,
  sessionId: string,
  jobId?: number,
): Promise<PauseOutcome> {
  const job = activeJobOfSession(runState, sessionId)
  const mirrorTarget = job?.state === 'running' && runState.activeJobId === job.jobId
    ? job.jobId
    : undefined
  const out = await resolveAndPauseJob({
    send: (cmd, args, timeoutMs) => bridge.send(cmd, args as Record<string, unknown>, timeoutMs),
    hostKey: hostAddr(),
    ownerRef: sessionId,
    jobId,
    findMirrorTarget: () => mirrorTarget,
  })
  if (out.kind === 'none') {
    return { kind: 'none', mirrorJobId: job?.jobId, activeJobId: runState.activeJobId ?? null }
  }
  return out
}

// ── 脚本文件读写 handler ──────────────────────────────────────────────────

/** Read one run's script text from an inline body or a script path. */
async function readScriptText(femo: string | undefined, scriptPath: string | undefined): Promise<string> {
  if (femo !== undefined) return femo
  const { readFileSync } = await import('node:fs')
  return readFileSync(scriptPath!, 'utf8')
}

/** Save a user-pasted script into the Femo project's user_data/projects. */
export async function handleSaveScript(
  req: IncomingMessage,
  res: ServerResponse,
  resolved: { femoRoot: string },
): Promise<void> {
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: 'method not allowed' })
    return
  }
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  let body: SaveScriptBody = {}
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as SaveScriptBody
  } catch {
    writeJson(res, 400, { ok: false, error: 'invalid json body' })
    return
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const content = typeof body.content === 'string' ? body.content : ''
  const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim().length > 0 ? body.sessionId.trim() : ''
  const rawPath = typeof body.path === 'string' && body.path.trim().length > 0 ? body.path.trim() : ''
  // 两种保存形态（2026-08-30 导出三态契约）：path 直写（导出/覆盖保存，前端
  // 只发 {path, content, sessionId}）不要求 name；仅按名存 projects/ 才要求。
  // 校验顺序必须与契约一致——否则导出流程误报 400「name is required」
  // （2026-08-30 实测 bug：femoGen 导出按钮 save-script HTTP 400）。
  if (rawPath.length === 0 && name.length === 0) {
    writeJson(res, 400, { ok: false, error: 'name is required' })
    return
  }
  if (content.trim().length === 0) {
    writeJson(res, 400, { ok: false, error: 'content is required' })
    return
  }
  const saveRecord = async (savedPath: string): Promise<void> => {
    // 导出/覆盖保存（2026-08-30 统一格式）：文件写成功 → 会话记录同步写
    // {path, text}（mount 同款并存格式，text=刚保存的内容=最新版）。
    // 显式保存动作，无条件写（不走乐观锁）；广播各端重载。
    const result = await writeSessionScript(resolved.femoRoot, sessionId, { path: savedPath, text: content })
    broadcastSse('script_changed', { sessionId })
    console.log(`[femo-plugin] session record updated: ${sessionId} <- ${savedPath} (rev ${result.ok ? String(result.rev) : 'conflict'})`)
  }
  const { mkdirSync, writeFileSync } = await import('node:fs')
  if (rawPath.length > 0) {
    // 导出流程：用户经系统目录选择器选定目录 + 文件名 → 绝对路径直写。
    // 确保扩展名 .femo（用户目录选择器只选目录，文件名由前端拼接）。
    const path = rawPath.toLowerCase().endsWith('.femo') ? rawPath : `${rawPath}.femo`
    writeFileSync(path, content, 'utf8')
    console.log(`[femo-plugin] saved script to ${path}`)
    if (sessionId.length > 0) await saveRecord(path)
    // 入账（2026-09-11）：导出过的也进导入清单，下次直接挑，不必重走保存框
    await rememberFemoFile(resolved.femoRoot, path, 'export')
    writeJson(res, 200, { ok: true, path })
    return
  }
  // Sanitize the file name: keep safe chars, force .femo.
  const safe = name.replace(/[\\/:*?"<>|]/g, '_').replace(/\.femo$/i, '')
  // 数据根走公共层单源（2026-09-29）：曾自拼 femoRoot\user_data 漏 FEMO_DATA_DIR
  // 分支——沙盒/多实例部署下读侧走分桶根、这里写落主根，读写分家。
  const projectsDir = join(dataRootOf(resolved.femoRoot), 'projects')
  mkdirSync(projectsDir, { recursive: true })
  const path = `${projectsDir}\\${safe}.femo`
  writeFileSync(path, content, 'utf8')
  console.log(`[femo-plugin] saved script to ${path}`)
  if (sessionId.length > 0) await saveRecord(path)
  // 入账（2026-09-11）：同上（按名存 projects/ 这条老路径同样算导出）
  await rememberFemoFile(resolved.femoRoot, path, 'export')
  writeJson(res, 200, { ok: true, path })
}

/** GET /femo-plugin/script?path=... — read one script file's content. */
export async function handleReadScript(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.searchParams.get('path')
  if (path === null || path.trim().length === 0) {
    writeJson(res, 400, { ok: false, error: 'path is required' })
    return
  }
  const { readFileSync } = await import('node:fs')
  try {
    const content = readFileSync(path, 'utf8')
    writeJson(res, 200, { ok: true, content })
  } catch (error: unknown) {
    writeJson(res, 404, { ok: false, error: `cannot read ${path}: ${String(error)}` })
  }
}

// ── HTTP handler：在既有会话上启动运行 / 新建会话即启动运行 ────────────────────────

/** 【原生 0.1.3+ 兜底】store 未命中时把持久化会话拉活。0.1.3 的侧边栏打开
 *  不进内存 store（历史走持久化句柄直读），run/pause/resume 的 store 查找会
 *  未命中；meow fork 上打开即进 store，此兜底永不触发。走官方 agents.resume
 *  （与 web 打开会话同一路径），setup 挂 FEMO_PRESET（与 create-session 同款），
 *  主Agent人设与 femo:root 在拉活后仍在。返回 store 里的活会话；失败返回
 *  undefined（调用方维持原 404 行为）。
 *  【2026-09-11 导出】投影窗路径也要用它：宿主重启后主会话不在 store ⇒
 *  子代理目录/描述符都不在 ⇒ 客户端 openSubagent 必被拒（descriptor
 *  unavailable）、投影窗输入 404（用户实测「刷新后窗口不存在/菜单切不过去」）。
 *  视角菜单数据源（projection-windows）与 projection-input 的 ensure 兜底都
 *  改走这里把主会话拉活，用户不必先手动打开一次主会话。 */
export async function ensureSessionLive(
  ctx: Context,
  sessionId: SessionId,
  tag: string,
  sessionsStore: { get(id: SessionId): Session | undefined } | undefined,
): Promise<Session | undefined> {
  const agents = ctx.get('agents') as {
    resume?(args: {
      resumeSessionId: SessionId
      /** 【2026-09-12】冷装载的 agent 必须自带模型路由：新 resume 出来的 agent
       *  三无——本进程无请求头、会话日志无 model/selection 事件（实测主会话 0 条）、
       *  AgentOptions 空 ⇒ agent.followup（上帝窗 branch①）一起跑就报
       *  "has no provider/model"。原生主窗口没事，是因为它每次请求都经官方
       *  selectionFor 显式带模型。 */
      agentOptions?: { provider?: string; model?: string; reasoningEffort?: string }
      setup?: (agentCtx: Context) => Promise<void>
    }): Promise<{ agent: unknown }>
  } | undefined
  if (agents?.resume === undefined) return undefined
  // 模型取宿主默认（dsh-agent-default-model 服务）——与官方 selectionFor 的
  // 最后一级兜底同源；服务缺席时退回裸 resume（维持旧行为）。
  type DefaultModelSel = { provider?: string; model?: string; reasoningEffort?: string }
  const defaultModelSvc = (ctx as unknown as { agentDefaultModel?: { currentSelection?(): DefaultModelSel } }).agentDefaultModel
  const sel = defaultModelSvc?.currentSelection?.()
  const agentOptions = sel?.provider !== undefined && sel.provider.length > 0
    && sel.model !== undefined && sel.model.length > 0
    ? {
        provider: sel.provider,
        model: sel.model,
        ...(sel.reasoningEffort !== undefined && sel.reasoningEffort.length > 0 ? { reasoningEffort: sel.reasoningEffort } : {}),
      }
    : undefined
  if (agentOptions === undefined) {
    console.log(`[femo-run-diag ${diagTs()}] ${tag} agentDefaultModel unavailable; resuming without agentOptions`)
    pushDiag('run', `${tag} 冷装载无默认模型服务（agentDefaultModel 缺席），裸 resume——followup 可能报 no provider/model`)
  } else {
    pushDiag('run', `${tag} 冷装载带模型路由 provider=${agentOptions.provider} model=${agentOptions.model}`)
  }
  try {
    console.log(`[femo-run-diag ${diagTs()}] ${tag} store miss → agents.resume (0.1.3 native reload)${agentOptions !== undefined ? ` model=${agentOptions.model}` : ''}`)
    await agents.resume({
      resumeSessionId: sessionId,
      ...(agentOptions !== undefined ? { agentOptions } : {}),
      setup: async (agentCtx: Context): Promise<void> => {
        const presets = agentCtx.get('agentPresets') as { mount?(agentCtx: Context, id: string): Promise<unknown> } | undefined
        if (presets?.mount !== undefined) {
          try {
            await presets.mount(agentCtx, FEMO_PRESET)
            const dispose = injectFemoRoot(agentCtx)
            if (dispose !== undefined) femoRootSections.set(String(sessionId), dispose)
          } catch (error: unknown) {
            console.log(`[femo-plugin] preset mount failed: ${String(error)}`)
          }
        }
      },
    })
  } catch (error: unknown) {
    console.log(`[femo-run-diag ${diagTs()}] ${tag} agents.resume FAILED: ${String(error instanceof Error ? error.message : error).slice(0, 200)}`)
    return undefined
  }
  return sessionsStore?.get(sessionId)
}

/**
 * POST /femo-plugin/run — play a script on an EXISTING Femo session (the script
 * panel's "save and run" lands here; create-session stays for the sidebar's
 * new-session flow). 【2026-09-19 取消限制】非 FEMO 会话也可以启动运行：运行期的
 * 对话接管由运行态门卫（runState 活跃 Job / pre-step gate）保证，与 preset 无关，
 * 事件钩子已按「有活跃 Job」放开（engine-events.ts）。
 */
export async function handleRunOnSession(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: Context,
  resolved: ResolvedConfig,
  bridge: FemoBridge,
  runState: RunState,
  projections?: ProjectionRegistry,
): Promise<void> {
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: 'method not allowed' })
    return
  }
  const body = await readBody(req)
  const seq = ++runDiagSeq
  const tag = `#${seq}`
  const sessionId0 = typeof body.sessionId === 'string' && body.sessionId.trim().length > 0 ? body.sessionId : '-'
  const reqJobId = typeof body.jobId === 'number' && Number.isFinite(body.jobId) ? Math.trunc(body.jobId) : undefined
  // 【2026-09-06 猫猫拍板】投影窗入口归一（host 接口职责，前端零感知）：
  // 从投影窗（femo-proj-<主sid>-<actorKey>）打开的 femoGen 点跑/继续时，
  // Job 挂在主会话上——此处把投影窗 id 就地解析回母会话再走查 session/
  // 守卫/开 Job 全流程（与 projection-input 三路路由同款解析；解析式与
  // projection.ts projectionId 规则互为逆）。
  const sidNormalized = mainSessionIdOf(sessionId0)
  console.log(`[femo-run-diag ${diagTs()}] ${tag} === POST /run arrive === sid=${sessionId0}${sidNormalized !== sessionId0 ? ` → main=${sidNormalized}` : ''} reset=${String(body.reset === true)}${reqJobId !== undefined ? ` jobId=${reqJobId}` : ''} activeJobId=${String(runState.activeJobId ?? '-')}`)
  const sessionId = sidNormalized.trim().length > 0
    ? SessionId(sidNormalized)
    : undefined
  if (sessionId === undefined) {
    writeJson(res, 400, { ok: false, error: 'sessionId is required' })
    return
  }
  const sessionsStore = ctx.get('sessions') as { get(id: SessionId): Session | undefined } | undefined
  let session = sessionsStore?.get(sessionId)
  if (session === undefined) {
    // 【原生 0.1.3+ 兜底】0.1.3 起侧边栏打开会话不再进内存 store（历史改走
    // 持久化句柄直读），run 的 store 查找会未命中 → femoGen 点运行"没反应"
    // （2026-09-08 实测）。meow fork 上打开即进 store，此兜底永不触发。
    // 走官方 agents.resume 把持久化会话拉活（与 web 打开会话同一路径），
    // setup 挂 FEMO_PRESET（与 create-session 同款），主Agent人设/femo:root 不丢。
    session = await ensureSessionLive(ctx, sessionId, tag, sessionsStore)
  }
  if (session === undefined) {
    console.log(`[femo-run-diag ${diagTs()}] ${tag} REJECT-404 (session not in store)`)
    writeJson(res, 404, { ok: false, error: `session ${sessionId} not found` })
    return
  }
  // 【2026-09-19 取消限制】非 FEMO 会话也可启动运行——只留一条信息化日志备查。
  if (presetOf(session) !== FEMO_PRESET) {
    console.log(`[femo-run-diag ${diagTs()}] ${tag} NOTE (non-femo preset='${presetOf(session) ?? '-'}' allowed to run)`)
  }
  // GUARD（§8.2 镜像读）：引擎有活跃 Job 即 409，文案带活跃 Job 归属
  // （信息化——跨会话语义：可先暂停或等它挂起）。
  try {
    assertRunAllowed(runState, String(sessionId))
  } catch (error: unknown) {
    console.log(`[femo-run-diag ${diagTs()}] ${tag} GUARD-REJECT-409 (${String(error instanceof Error ? error.message : error)})`)
    writeJson(res, 409, { ok: false, error: String(error instanceof Error ? error.message : error) })
    return
  }
  console.log(`[femo-run-diag ${diagTs()}] ${tag} GUARD-PASS (no active job)`)
  const femo = typeof body.femo === 'string' && body.femo.trim().length > 0 ? body.femo : undefined
  const scriptPath = typeof body.scriptPath === 'string' && body.scriptPath.trim().length > 0 ? body.scriptPath : undefined
  if (femo === undefined && scriptPath === undefined) {
    console.log(`[femo-run-diag ${diagTs()}] ${tag} REJECT-400 (no femo/scriptPath)`)
    writeJson(res, 400, { ok: false, error: 'femo or scriptPath is required' })
    return
  }
  // 「运行」= fresh 从头；「继续」= resume（六关裁决归引擎）。
  const reset = body.reset === true
  try {
    const scriptText = await readScriptText(femo, scriptPath)
    // 后端编译检查（各自闭环：compiler 纯后端也有自己的语法检查）。
    // 配合 parse_script 的变量声明校验，编译期就能拦住 @speaker 未声明等错误，
    // 不启动引擎、无状态残留。base_dir = 脚本文件所在目录（相对 file: 解析用）。
    const baseDir = scriptPath !== undefined
      ? scriptPath.replace(/[\\/][^\\/]*$/, '')
      : ''
    console.log(`[femo-run-diag ${diagTs()}] ${tag} check start (bridge compile, guard slot NOT yet occupied by startJob)`)
    try {
      const checkRes = await bridge.send('check', { femo: scriptText, base_dir: baseDir, models: await collectLlmModels(ctx, resolved) }, 30_000) as { ok?: boolean; warnings?: Array<{ where?: string; message?: string }> } | undefined
      // 编译警告此处只记日志（广播归 job_start/job_resume 分支，防双份）。
      const checkWarnings = Array.isArray(checkRes?.warnings) ? checkRes.warnings : []
      if (checkWarnings.length > 0) {
        console.log(`[femo-plugin] check warnings: ${checkWarnings.map(w => `[${w.where ?? ''}] ${w.message ?? ''}`).join(' | ')}`)
      }
      console.log(`[femo-run-diag ${diagTs()}] ${tag} check OK`)
    } catch (error: unknown) {
      console.log(`[femo-run-diag ${diagTs()}] ${tag} check FAILED: ${String(error instanceof Error ? error.message : error)}`)
      writeJson(res, 400, { ok: false, error: `FEMO脚本编译失败：${String(error instanceof Error ? error.message : error)}` })
      return
    }
    // jobId：前端显式指定的续跑目标（femoGen 续跑旧 Job——"以该场次快照继续"）。
    // fresh 分支会忽略它（fresh 永远开新 Job）；resume 不带时回退
    // readSessionCurrentJob（startJobOnSession 既有语义）。
    await startJobOnSession(ctx, resolved, bridge, runState, sessionId, scriptText, scriptPath, reset, reqJobId, projections)
    writeJson(res, 200, { ok: true, sessionId: String(sessionId) })
  } catch (error: unknown) {
    // 六关裁决/引擎排他错误原话 400 透传（§8.2——B2/C2 死于结构：不再静默
    // fresh 也不再 500 咒语）。
    console.log(`[femo-run-diag ${diagTs()}] ${tag} run-on-session FAILED: ${String(error)}`)
    writeJson(res, 400, { ok: false, error: String(error instanceof Error ? error.message : error) })
  }
}

/** Create one Femo session; when a femo script body is supplied, start it. */
export async function handleCreateSession(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: Context,
  resolved: ResolvedConfig,
  bridge: FemoBridge,
  runState: RunState,
  projections?: ProjectionRegistry,
): Promise<void> {
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: 'method not allowed' })
    return
  }
  const body = await readBody(req)
  const cwd = typeof body.cwd === 'string' && body.cwd.trim().length > 0 ? body.cwd : process.cwd()
  // 模型来源（2026-08-24 用户拍板「不要写provider」）：不写配置默认（deepseek
  // 系在 meow 等部署无 adapter → NO_ADAPTER），跟随用户保存的默认模型选择
  // （与 dsh web 建会话的 selectionFor 语义一致）。未保存过默认 → 不传，
  // 首个主Agent轮次会响亮报错提示去选模型，绝不静默落到部署隐式默认。
  const defaultModel = ctx.get('agentDefaultModel') as { currentSelection?(): unknown } | undefined
  const sel = defaultModel?.currentSelection?.() as { provider?: unknown; model?: unknown } | undefined
  const agentOptions = typeof sel?.provider === 'string' && sel.provider.length > 0
    && typeof sel.model === 'string' && sel.model.length > 0
    ? { provider: sel.provider, model: sel.model }
    : undefined
  const id = SessionId(`femo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`)
  try {
    const handle = await ctx.agents.create({
      sessionId: id,
      meta: {
        cwd,
        agentPreset: FEMO_PRESET,
      },
      ...agentOptions !== undefined ? { agentOptions } : {},
      // Mount the preset composition (persona + tools) so subagents spawned
      // under this session join it — without this the child sees no preset
      // tools and no persona (the RPC create path does this in its setup).
      setup: async (agentCtx: Context): Promise<void> => {
        const presets = ctx.get('agentPresets') as { mount?(agentCtx: Context, id: string): Promise<unknown> } | undefined
        if (presets?.mount === undefined) return
        try {
          await presets.mount(agentCtx, FEMO_PRESET)
          // 注入插件根目录（插件自包含布局，路径随插件位置变化——动态算）。
          const dispose = injectFemoRoot(agentCtx)
          if (dispose !== undefined) femoRootSections.set(String(id), dispose)
        } catch (error: unknown) {
          console.log(`[femo-plugin] preset mount failed: ${String(error)}`)
        }
      },
    })
    console.log(`[femo-plugin] created femo session ${handle.agent.id} (cwd=${cwd})`)
    const femo = typeof body.femo === 'string' && body.femo.trim().length > 0 ? body.femo : undefined
    const scriptPath = typeof body.scriptPath === 'string' && body.scriptPath.trim().length > 0 ? body.scriptPath : undefined
    if (femo !== undefined || scriptPath !== undefined) {
      const scriptText = await readScriptText(femo, scriptPath)
      // B4 守卫（§8.3）：直接开跑被拒时【不 500】——会话已创建是事实；
      // 返回 run_started:false + 信息化错误（新路径无兼容负担）。
      try {
        assertRunAllowed(runState, String(id))
        await startJobOnSession(ctx, resolved, bridge, runState, id, scriptText, scriptPath, true, undefined, projections)
      } catch (error: unknown) {
        const runError = String(error instanceof Error ? error.message : error)
        console.log(`[femo-plugin] create-session auto-run skipped: ${runError}`)
        writeJson(res, 200, { ok: true, sessionId: String(id), run_started: false, run_error: runError })
        return
      }
    }
    writeJson(res, 200, { ok: true, sessionId: String(id) })
  } catch (error: unknown) {
    console.log(`[femo-plugin] create-session FAILED: ${String(error)}`)
    writeJson(res, 500, { ok: false, error: String(error) })
  }
}
