/**
 * debug-run.ts — DSH 侧干跑入口（宿主形态件）。
 *
 * 通用「监工」（沙盒装配、argv、单飞闸、看门狗收集、流水/终报渲染、结果
 * 裁决）已上移 femo2host/host/debug-run-core.mjs（2026-09-15，zcode 同源
 * 共用）。本文件只剩 DSH 特有的两件事：
 *  ① 编辑器「🐞 调试」按钮 → POST /femo-plugin/debug-run：NDJSON 流式转发，
 *     前端逐行渲染进调试窗——人看的路径（zcode 无此形态）；
 *  ② dsh subprocess 服务的 spawn 适配器（resolveExecutable/SubprocessHandle），
 *     把通用 collectDebugRun 接到宿主的子进程机制上。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import { join } from 'node:path'
import { open } from 'node:fs/promises'
import { readBody, writeJson } from './http'
import { pushDiag } from './diag/diag-feed'
import type { ResolvedConfig } from './config'
import {
  acquireDebugRun,
  buildDebuggerArgv,
  DEBUG_TIMEOUT_MS,
  collectDebugRun as coreCollectDebugRun,
  prepareDebugSandbox,
  releaseDebugRun,
} from '../../../femo2host/host/debug-run-core.mjs'
import type { DebugRunCollect, DebugRunRequest, DebugSpawnProc } from '../../../femo2host/host/debug-run-core.mjs'

export type { DebugRunCollect, DebugRunReport, DebugRunRequest } from '../../../femo2host/host/debug-run-core.mjs'
export { debugRunToolOutcome, formatDebugRecordLine, debugTranscriptLines, clampRuns, normalizeSeed, normalizeModule } from '../../../femo2host/host/debug-run-core.mjs'

const TAIL_INTERVAL_MS = 150

interface DebugRunBody {
  femo?: unknown
  runs?: unknown
  seed?: unknown
  module?: unknown
  scriptPath?: unknown
}

/** dsh subprocess 服务的 spawn 适配器（契约见 debug-run-core.mjs 文件头）。 */
function makeDshSpawnProc(ctx: Context, resolved: ResolvedConfig, mode: 'stream' | 'capture'): DebugSpawnProc {
  return (spec) => {
    const subprocess = ctx.get('subprocess') as {
      resolveExecutable(command: string): Promise<string>
      spawn(spec: unknown): SubprocessHandle
    } | undefined
    if (subprocess === undefined) {
      throw new Error('subprocess 服务不可用（无法拉起调试器子进程）')
    }
    // resolveExecutable 是异步的，而适配器契约是同步返回句柄——先缓存
    // 已解析的 python（collectDebugRun / handleDebugRun 均为每实例单飞，
    // 不存在竞态窗口；首次解析失败经 catch 上浮为 spawn 失败）。
    let handle: SubprocessHandle
    const ready = subprocess.resolveExecutable(resolved.python).then((pythonPath) => {
      handle = subprocess.spawn({
        argv: [pythonPath, ...spec.argv],
        cwd: spec.cwd,
        stdio: {
          stdin: 'ignore',
          stdout: mode === 'capture' && spec.onStdoutChunk ? 'pipe' : 'ignore',
          // 'pipe' (not collect): the caller owns the stream and forwards
          // tracebacks live; a collect buffer would swallow them silently.
          stderr: 'pipe',
        },
        graceMs: 3000,
        env: spec.env,
      })
      return handle
    })
    const out = { done: undefined as unknown as Promise<{ exitCode?: number } | undefined>, terminate: () => { try { handle?.terminate() } catch { /* 未起/已退则忽略 */ } } }
    out.done = ready.then((h) => {
      h.stderr?.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString('utf8').split(/\r?\n/)) {
          if (line.trim().length === 0) continue
          if (mode === 'capture') spec.onStderrLine?.(line)
          // 【2026-09-11 Host 页口径】调试器(引擎)的 stderr 是"引擎的话"，绕过
          // console 直写 stdout——harness 日志照旧有，但不进调试窗『Host』页。
          else process.stdout.write(`[femo-debug:stderr] ${line}\n`)
          // 【2026-09-11 编译器页补 stderr】两条路径都补一路进调试窗『编译器』页。
          pushDiag('engine', `[stderr] ${line}`.slice(0, 400))
        }
      })
      if (mode === 'capture' && spec.onStdoutChunk) {
        h.stdout?.on('data', (chunk: Buffer) => spec.onStdoutChunk!(chunk.toString('utf8')))
      }
      return h.done.then((outcome: unknown) => (outcome as { exitCode?: number } | undefined), () => undefined)
    }, (error: unknown) => {
      throw new Error(`调试器子进程启动失败: ${String(error)}`)
    })
    return out
  }
}

/** POST /femo-plugin/debug-run：NDJSON 流式响应（每行一条 DebugLogBus 记录）。 */
export async function handleDebugRun(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: Context,
  resolved: ResolvedConfig,
): Promise<void> {
  // 单飞闸在核心（与 femo-debug 工具同闸：调试窗正在跑时工具明确报错，反之亦然）。
  if (!acquireDebugRun()) {
    writeJson(res, 409, { ok: false, error: '已有调试干跑在进行中，请等它结束再点' })
    return
  }
  const body = await readBody(req) as DebugRunBody
  const femo = typeof body.femo === 'string' ? body.femo : ''
  if (femo.trim().length === 0) {
    releaseDebugRun()
    writeJson(res, 400, { ok: false, error: 'FEMO脚本文本为空' })
    return
  }
  const runs = Number(body.runs)
  const seed = typeof body.seed === 'number' ? body.seed : undefined
  const module = typeof body.module === 'string' ? body.module : undefined
  const scriptPath = typeof body.scriptPath === 'string' ? body.scriptPath : undefined

  // ── 流式会话状态（try 前声明：close 回调 / finally 都要摸到）──
  let streaming = false        // writeHead 之后 true——只有它为 true 才允许 res.end()
  let clientGone = false
  let procHandle: SubprocessHandle | undefined
  let exited = false
  const onClientClose = (): void => {
    clientGone = true
    // 客户端走人＝干跑失去意义：不留僵尸 python
    if (!exited && procHandle !== undefined) {
      try { procHandle.terminate() } catch { /* 已退出则忽略 */ }
    }
  }

  try {
    // 沙盒 + argv 装配在核心（与工具路径同源）；spawn 用 dsh 'stream' 形态：
    // stdout 丢弃、stderr 转发控制台——与调试窗按钮的历史行为逐字一致。
    let sandbox
    let argv: string[]
    try {
      sandbox = await prepareDebugSandbox(resolved.femoRoot, { femo })
      const built = await buildDebuggerArgv({ femoRoot: resolved.femoRoot, sandbox, req: { scriptPath }, runs, seed, module })
      argv = built.argv
      if (built.note !== undefined) console.log(`[femo-plugin] debug-run: ${built.note}`)
    } catch (error: unknown) {
      writeJson(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) })
      return
    }
    const subprocess = ctx.get('subprocess') as {
      resolveExecutable(command: string): Promise<string>
      spawn(spec: unknown): SubprocessHandle
    } | undefined
    if (subprocess === undefined) {
      writeJson(res, 500, { ok: false, error: 'subprocess 服务不可用（无法拉起调试器子进程）' })
      return
    }
    let handle: SubprocessHandle
    try {
      const pythonPath = await subprocess.resolveExecutable(resolved.python)
      handle = subprocess.spawn({
        argv: [pythonPath, ...argv],
        cwd: resolved.femoRoot,
        stdio: { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' },
        graceMs: 3000,
        env: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      })
    } catch (error: unknown) {
      writeJson(res, 500, { ok: false, error: `调试器子进程启动失败: ${String(error)}` })
      return
    }
    procHandle = handle
    const logPath = sandbox.logPath
    req.on('close', onClientClose)
    res.on('close', onClientClose)
    handle.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        if (line.trim().length === 0) continue
        // 【2026-09-11 Host 页口径】引擎 stderr 直写 stdout，不进『Host』页。
        process.stdout.write(`[femo-debug:stderr] ${line}\n`)
        pushDiag('engine', `[stderr] ${line}`.slice(0, 400))
      }
    })

    // ── 流式阶段开始：之后任何失败都以一条 debug_error 记录收尾（响应头
    //    已发出，半路换状态码是谎报）。
    streaming = true
    res.writeHead(200, {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache',
    })
    const send = (rec: unknown): void => {
      if (!clientGone && !res.destroyed) res.write(`${JSON.stringify(rec)}\n`)
    }

    // tail JSONL：offset 增量读，按行转发（femo_debugger 每条 flush，延迟≈TAIL 间隔）
    let offset = 0
    let tailRemainder = ''
    const tailOnce = async (): Promise<void> => {
      let fh
      try { fh = await open(logPath, 'r') } catch { return }   // 文件未创建＝还没跑到
      try {
        const st = await fh.stat()
        if (st.size > offset) {
          const buf = Buffer.alloc(st.size - offset)
          const { bytesRead } = await fh.read(buf, 0, buf.length, offset)
          offset += bytesRead
          tailRemainder += buf.toString('utf8')
          let idx: number
          while ((idx = tailRemainder.indexOf('\n')) !== -1) {
            const line = tailRemainder.slice(0, idx).trim()
            tailRemainder = tailRemainder.slice(idx + 1)
            if (line.length === 0) continue
            try { send(JSON.parse(line)) } catch {
              send({ kind: 'debug_error', error: `日志行解析失败: ${line.slice(0, 200)}` })
            }
          }
        }
      } finally {
        await fh.close()
      }
    }

    void handle.done.then(() => {
      exited = true
    }, () => { exited = true })

    const started = Date.now()
    let timedOut = false
    let exitCode = -1
    const timeoutMs = DEBUG_TIMEOUT_MS
    while (!exited && !clientGone) {
      await tailOnce()
      if (exited || clientGone) break
      if (Date.now() - started > timeoutMs) {
        timedOut = true
        try { handle.terminate() } catch { /* 已退出则忽略 */ }
        break
      }
      await sleep(TAIL_INTERVAL_MS)
    }
    const outcome = await handle.done.catch(() => undefined as unknown)
    exitCode = (outcome as { exitCode?: number } | undefined)?.exitCode ?? -1
    await tailOnce()   // 进程退出后再 drain 一次残余日志

    if (timedOut) send({ kind: 'debug_error', error: `调试干跑超时（${timeoutMs / 1000}s），已强制终止` })
    send({ kind: 'debug_done', exitCode })
  } finally {
    releaseDebugRun()
    req.off?.('close', onClientClose)
    res.off?.('close', onClientClose)
    if (streaming && !clientGone && !res.destroyed) res.end()
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * 主模型工具路径：整跑收集（不流式）。装配与监工全在核心，这里只把 dsh
 * subprocess 服务适配进去（'capture' 形态：stdout/stderr 收集回传）。
 */
export async function collectDebugRun(
  ctx: Context,
  resolved: ResolvedConfig,
  req: DebugRunRequest,
  signal?: AbortSignal,
): Promise<DebugRunCollect> {
  return coreCollectDebugRun({
    femoRoot: resolved.femoRoot,
    spawnProc: makeDshSpawnProc(ctx, resolved, 'capture'),
    req,
    signal,
    onProgress: msg => pushDiag('femo-debug', msg),
  })
}
