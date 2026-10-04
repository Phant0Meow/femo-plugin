/**
 * run.ts — 启动运行域的 HTTP 处理体（2026-09-25 刀⑤c 自 routes.ts 抽出）。
 *
 * /run 与 /create-session 的执行体本就住在 run-control.ts（启动运行流程域），
 * routes 注册表一行委派；本文件收的是留在注册表里的两块大内联体：
 *  · handlePause —— 暂停路由：裁决已是单份（run-control.pauseJobResolved），
 *    这里只做 HTTP 呈现（错误面板留痕+诊断流+回执映射）；
 *  · handleHumanInput —— 画布人类节点喂入：B6 投递侧防线+speech-core 信封。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FemoBridge } from '../bridge'
import type { RunState } from '../events/engine-events'
import { activeJobOfSession } from '../events/engine-events'
import { pauseJobResolved, type PauseOutcome } from '../run-control'
import { humanSpeechArgs } from '../../../../femo2host/host/speech-core.mjs'
import { pushDiag } from '../diag/diag-feed'
import { readBody, writeJson } from '../http'

export interface RunRoutesDeps {
  bridge: FemoBridge
  runState: RunState
  recordError(sessionId: string, text: string): void
}

/** POST /femo-plugin/pause —— Hard-pause the session's running Job（§8.4，B3
 *  归属解析）：query 带 sessionId 必填——只认本会话绑定，不再"停别家的戏"。
 *  【2026-09-24 单份化】裁决语义唯一活在 run-control.pauseJobResolved（与
 *  femo-run 工具路径同一份：显式=引擎档案归属+状态预检——旧版缺预检，finished
 *  Job 会被引擎幂等回执误报 paused:true；缺省=镜像双判定→list_jobs 档案兜底
 *  ——旧版缺兜底，镜像滞后时停不掉）。本路由只做 HTTP 呈现：错误面板留痕+
 *  诊断流+writeJson。 */
export function handlePause(deps: RunRoutesDeps, req: IncomingMessage, res: ServerResponse): void {
  const { bridge, runState, recordError } = deps
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    if (sessionId === null || sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: 'sessionId is required' })
      return
    }
    const rawJobId = url.searchParams.get('jobId')
    const explicitJobId = rawJobId !== null && /^\d+$/.test(rawJobId) ? Number(rawJobId) : undefined
    let out: PauseOutcome
    try {
      out = await pauseJobResolved(bridge, runState, sessionId, explicitJobId)
    } catch (error: unknown) {
      const msg = String(error instanceof Error ? error.message : error)
      console.log(`[femo-plugin] pause sid=${sessionId} job=${String(explicitJobId ?? '-')} FAILED: ${msg}`)
      // 214 事故主形态：bridge 无回应（超时）=引擎侧已不可达——错误面板
      // 留痕（此前仅 console.log，femoGen 里零感知）。
      recordError(sessionId, `⏸ 暂停失败：引擎无响应（${msg}）。引擎可能已僵死，重启宿主后对账恢复`)
      pushDiag('pause', `FAILED sid=${sessionId} job=${String(explicitJobId ?? '-')}: ${msg}`)
      writeJson(res, 500, { ok: false, error: msg })
      return
    }
    if (out.kind === 'not-owner') {
      const denied = `Job ${String(explicitJobId)} 不属于会话 ${sessionId}（归属 ${out.ownerShow}），拒绝暂停`
      // 暂停被拒=动作失败（非静默，2026-09-07 214 事故收尾）：错误面板
      // 留痕 + 诊断流，前端据非 2xx 在画布上可见报错。
      recordError(sessionId, `⏸ 暂停失败：${denied}`)
      pushDiag('pause', `DENIED sid=${sessionId} job=${String(explicitJobId)}（归属 ${out.ownerShow}）`)
      writeJson(res, 403, { ok: false, error: denied })
      return
    }
    if (out.kind === 'no-such-job') {
      console.log(`[femo-plugin] pause (explicit) sid=${sessionId} job=${String(out.jobId)} -> no_such_job`)
      writeJson(res, 404, { ok: false, error: `Job ${String(out.jobId)} 不存在（no_such_job）` })
      return
    }
    if (out.kind === 'idle') {
      console.log(`[femo-plugin] pause (explicit) sid=${sessionId} job=${String(out.jobId)} -> idle state=${out.state}`)
      writeJson(res, 200, { ok: true, paused: false, state: out.state, job_id: out.jobId, note: `Job 未在运行（state=${out.state}）` })
      return
    }
    if (out.kind === 'none') {
      console.log(`[femo-plugin] pause sid=${sessionId} mirrorJob=${String(out.mirrorJobId ?? '-')} activeJobId=${String(out.activeJobId ?? '-')} -> none（引擎档案亦无 running）`)
      writeJson(res, 200, { ok: true, paused: false, note: '该会话无活跃FEMO脚本' })
      return
    }
    console.log(`[femo-plugin] pause sid=${sessionId} job=${String(out.jobId)} -> paused=${out.paused} state=${String(out.state ?? '-')}`)
    writeJson(res, 200, { ok: true, paused: out.paused, state: out.state, job_id: out.jobId })
  })().catch((error: unknown) => {
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}

/** POST /femo-plugin/human-input —— 画布人类节点喂入：B6 投递侧防线
 *  （sessionId → 活跃 Job，不盲投）+ 交卷体词汇走 speech-core 唯一出处。 */
export function handleHumanInput(deps: { bridge: FemoBridge; runState: RunState }, req: IncomingMessage, res: ServerResponse): void {
  const { bridge, runState } = deps
  void (async () => {
    const raw = await readBody(req) as unknown as Record<string, unknown>
    const waitKey = typeof raw.wait_key === 'string' ? raw.wait_key : ''
    const chatText = typeof raw.chat_text === 'string' ? raw.chat_text : ''
    const variables = (raw.variables ?? {}) as Record<string, unknown>
    const hasVars = typeof variables === 'object' && variables !== null && Object.keys(variables).length > 0
    const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId : ''
    if (waitKey.length === 0 || (chatText.length === 0 && !hasVars) || sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: 'sessionId, wait_key and chat_text/variables are required' })
      return
    }
    // B6 投递侧防线：sessionId → 活跃 Job，不盲投（无活跃 → 明确不投递）。
    const job = activeJobOfSession(runState, sessionId)
    if (job === undefined || job.state !== 'running' || job.waitingHuman === undefined) {
      // 【诊断 2026-09-06】画布 UI 不看 delivered 无条件标 human_done，
      // 此拦截此前静默——"画布显示已提交但引擎没收到"的直接证据源。
      pushDiag('canvas-input', `B6-INTERCEPT sid=${sessionId.slice(-12)} job=${job?.jobId ?? '-'} state=${job?.state ?? '-'} waitHuman=${job?.waitingHuman === undefined ? 'none' : 'set'} wait_key=${waitKey}`)
      console.log(`[femo-plugin] /human-input B6-intercept: sid=${sessionId} job=${job?.jobId ?? '-'} state=${job?.state ?? '-'} waitHuman=${job?.waitingHuman === undefined ? 'none' : 'set'} wait_key=${waitKey}`)
      writeJson(res, 200, { ok: true, delivered: false, note: 'no active job' })
      return
    }
    pushDiag('canvas-input', `feeding job=${job.jobId} wait_key=${waitKey} len=${chatText.length}`)
    // 交卷体词汇唯一活在 speech-core（2026-09-24 收口：原手拼
    // {chat_text, variables} 是 humanSpeechArgs 之外的第 5 份同形词汇）。
    // human_input 命令只读 job_id/wait_key/body，多带的 soul/payload
    // 桥与投影（on_human_input 只读 body+wait_key）均不消费。
    const speech = humanSpeechArgs({ jobId: job.jobId, waitKey, text: chatText, variables: variables as Record<string, string> })
    const delivered = await bridge.send('human_input', {
      job_id: speech.job_id,
      wait_key: speech.wait_key,
      body: speech.body,
    })
    writeJson(res, 200, { ok: true, delivered: (delivered as { delivered?: boolean } | undefined)?.delivered ?? false })
  })().catch((error: unknown) => {
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}
