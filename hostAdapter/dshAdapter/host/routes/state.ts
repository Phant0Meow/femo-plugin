/**
 * state.ts — 会话状态域（2026-09-25 刀⑤b 自 routes.ts 抽出）。
 *
 * femoGen 恢复面的两个读数口：
 *  · /session-state —— 打开画布时的一问三答：FEMO脚本挂载了吗、引擎演到哪了、
 *    断点在哪。内含本域核心：**引擎档案 ↔ 宿主镜像的对账状态机**（已抽为
 *    reconcileMirrorWithEngine，输入输出明确可单测）。
 *  · /job —— Job 档案透传：快照/断点/状态以引擎档案为权威，宿主不代问代译。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
import type { FemoBridge } from '../bridge'
import type { ResolvedConfig } from '../config'
import type { RunState, JobMirror } from '../events/engine-events'
import { jobMirrorSetState, jobMirrorPrearm, broadcastProjectionState, isSessionRunning } from '../events/engine-events'
import { readSessionScript, readSessionScriptText, readSessionCurrentJob, readSessionJobIds } from '../state-files'
import { mainSessionIdOf } from '../projection/projection'
import { pushDiag } from '../diag/diag-feed'
import { writeJson } from '../http'

export interface StateRoutesDeps {
  resolved: ResolvedConfig
  bridge: FemoBridge
  runState: RunState
  sessionsStore?: { get(id: SessionId): Session | undefined }
}

/** 引擎档案 ↔ 宿主镜像对「running」认定相左时的双侧收口（2026-09-25 刀⑤b
 *  抽出，原 /session-state 内联 ~70 行，行为逐字）。
 *
 * 【状态不一致自动收口（2026-09-12 用户拍板）】先发 job_pause 暂停信号（引擎
 * 侧真在跑=停下挂起、断点保留可续跑；已不在跑=幂等回执，档案不会被误写），
 * 再把宿主镜像对齐到引擎回执的终态。只走 API 不摸引擎档案文件；且仅限本宿主
 * 拥有的 session（sessionsStore 里有）——别的进程/宿主的 Job 一个不碰（214
 * 红线）。例外：引擎回执 finished/failed 时以引擎真相为准——终态档案没有 API
 * 可以改写成挂起（job_pause 幂等原样回执），强行把镜像降成挂起反而反向制造
 * 不一致+「可续跑」假象。
 *
 * @returns 对账后的最终 jobState（可能被镜像对齐改写）。 */
export async function reconcileMirrorWithEngine(opts: {
  bridge: FemoBridge
  runState: RunState
  jobId: number
  mainSid: string
  /** 该 session 是否归属本宿主（sessions store 里有）——非本宿主不发暂停信号。 */
  sessionKnown: boolean
  /** 引擎回执的状态（state 字段非缺失的前提下调用）。 */
  jobState: string
}): Promise<string> {
  const { bridge, runState, jobId, mainSid, sessionKnown, jobState } = opts
  const mirror = runState.jobs.get(jobId)
  const mirrorRunning = mirror !== undefined && mirror.state === 'running'
  const engineRunning = jobState === 'running'
  // 镜像对齐收口（缺失则 prearm 补建再对齐——jobMirrorSetState 的
  // 变更广播照常拿到），并同步投影窗按钮状态。
  const settleMirror = (finalState: JobMirror['state']): void => {
    if (runState.jobs.get(jobId) === undefined) {
      jobMirrorPrearm(runState, jobId, mainSid)
    }
    jobMirrorSetState(runState, jobId, finalState)
    if (finalState !== 'running' && runState.activeJobId === jobId) {
      runState.activeJobId = undefined
    }
    broadcastProjectionState(runState, mainSid)
  }
  if (sessionKnown && mirrorRunning !== engineRunning) {
    console.log(`[femo-plugin] session-state 状态不一致收口: job=${jobId} sid=${mainSid.slice(-12)} 引擎=${jobState} 镜像=${mirror?.state ?? '无'} → 发送 job_pause`)
    pushDiag('session-state', `状态不一致 job=${jobId} 引擎=${jobState} 镜像=${mirror?.state ?? '无'} → job_pause 收口`)
    let pauseState: string | undefined
    try {
      const pause = await bridge.send('job_pause', { job_id: jobId }, 15000) as { paused?: boolean; state?: string } | undefined
      pauseState = pause?.state
    } catch (error: unknown) {
      // 暂停信号失败（no_such_job/桥抖动）：按查询到的引擎状态对齐镜像
      console.log(`[femo-plugin] session-state job_pause 收口失败，按查询状态对齐: ${String(error instanceof Error ? error.message : error)}`)
    }
    if (!engineRunning) {
      // 宿主说跑、引擎说不跑：镜像落到引擎终态——suspended=两边同
      // 挂起；finished/failed=引擎真相优先（见上方例外注释）。
      const finalState = (pauseState ?? jobState) as JobMirror['state']
      settleMirror(finalState)
      return finalState
    }
    if (pauseState === 'running') {
      // 引擎说跑、宿主不认（宿主重启后镜像丢失的僵尸场）：stop_job
      // 的有挂靠路径回执时档案仍是 running（优雅暂停在途）——prearm
      // 认领镜像，让随后的 flow_paused 走既有管道收口（suspended+
      // 全窗通知+主模型 steer）。事件若丢，下次打开本接口再兜底。
      settleMirror('running')
      return jobState
    }
    // 无挂靠的直接落盘路径（pause_job 回执已带终态）或幂等回执：
    // 引擎已终态化，镜像直接对齐。
    const finalState = (pauseState ?? 'suspended') as JobMirror['state']
    settleMirror(finalState)
    return finalState
  }
  if (mirrorRunning && !engineRunning) {
    // 旧单向自愈保留（非本宿主 session，不发暂停信号）：镜像
    // running、引擎已终态——以引擎为准降级并广播 run_state，只降
    // 不升：running 镜像不会从引擎旧终态"复活"。
    jobMirrorSetState(runState, jobId, jobState as JobMirror['state'])
  }
  return jobState
}

/** 冷启动/桥未应答的 pending 语义回（前端「引擎启动中」+ 2s 自动补拉）。 */
async function writePending(deps: StateRoutesDeps, res: ServerResponse, mainSid: string, jobId: number | undefined, script: string | undefined, record: { path?: string; rev?: number } | undefined): Promise<void> {
  const pendingJobIds = await readSessionJobIds(deps.resolved.femoRoot, mainSid)
  writeJson(res, 200, {
    ok: true,
    pending: true,
    hasScript: script !== undefined,
    script: script ?? undefined,
    scriptPath: record?.path ?? undefined,
    rev: record?.rev ?? 0,
    jobId,
    ...(pendingJobIds !== undefined ? { jobIds: pendingJobIds } : {}),
    checkpoint: {},
    running: false,
  })
}

/** GET /femo-plugin/session-state —— femoGen 恢复面（§8.4）：形状保持
 *  {ok, hasScript, script, scriptPath, rev, checkpoint, running}（前端无感）
 *  ——checkpoint 来源从宿主 resume 块改为引擎 get_job_state 代理翻译
 *  （D1：checkpoint_labels → 前端 label；state 字段一并返回）。 */
export function handleSessionState(deps: StateRoutesDeps, req: IncomingMessage, res: ServerResponse): void {
  const { resolved, bridge, runState, sessionsStore } = deps
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    if (sessionId === null || sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: 'sessionId is required' })
      return
    }
    // 投影窗入口归一（mainSessionIdOf）：FEMO脚本记录/Job 档案挂主会话名下，
    // 从投影窗打开的 femoGen 读的是母会话的数据面。
    const mainSid = mainSessionIdOf(sessionId)
    const record = await readSessionScript(resolved.femoRoot, mainSid)
    const script = await readSessionScriptText(resolved.femoRoot, mainSid)
    // 冷启动窗口（§八.15）：bridge 延迟 spawn + Python 启动 2-3s——
    // 返回 pending:true（前端"引擎启动中"加载态，宿主不双写状态副本）。
    // jobId/jobIds 纯文件读，不依赖 bridge，冷启动也照常带出。
    const pendingJobId = await readSessionCurrentJob(resolved.femoRoot, mainSid)
    if (!bridge.alive) {
      await writePending(deps, res, mainSid, pendingJobId, script, record)
      return
    }
    // 断点来自引擎档案（Job suspended 才有断点——B2 修复：前端不再给
    // "必假继续"）。checkpoint= 引擎 checkpoint_labels 翻译成前端 label
    // （前端画布按 label 匹配节点）。
    let checkpoint: Record<string, string> = {}
    let jobState: string | undefined
    let lastError: string | undefined
    const jobId = pendingJobId
    if (jobId !== undefined) {
      // 【2026-09-07 懒对账】打开 session 的这一问就是对账点：仅当该
      // session 归属本宿主（sessions store 里有）才让引擎顺带裁决这个
      // 唯一的 currentJobId（引擎侧 _bound 主人检查先行，活 Job 绝不
      // 误判）——别的进程/别的 session 的档案一个不碰（214 事故根因）。
      const sessionKnown = (() => {
        try { return sessionsStore?.get(SessionId(mainSid)) !== undefined } catch { return false }
      })()
      // 【2026-09-19 冷启动补拉配套】桥活着但没应答（刚 spawn 还在初始化/
      // 命令超时）时按 pending 语义回 200（前端「引擎启动中」+ 2s 自动补拉），
      // 不再让 send 的 reject 冒泡成 500——那会让页面卡死在无状态态且无重试。
      // 对前端而言「引擎没起」和「起了还没答」是同一件事：稍后再问。
      let state: {
        error?: string; state?: string; checkpoints?: Record<string, string>; checkpoint_labels?: Record<string, string>
      } | undefined
      try {
        state = await bridge.send('get_job_state', {
          job_id: jobId,
          ...(sessionKnown ? { reconcile_if_stale: true } : {}),
        }, 15000) as {
          error?: string; state?: string; checkpoints?: Record<string, string>; checkpoint_labels?: Record<string, string>
        } | undefined
      } catch (error: unknown) {
        console.log(`[femo-plugin] session-state get_job_state failed → pending 语义返回: ${String(error instanceof Error ? error.message : error)}`)
        await writePending(deps, res, mainSid, jobId, script, record)
        return
      }
      if (state !== undefined && state.state !== undefined) {
        // ⚠️ 判据是 state 字段而非 error（2026-09-10）：桥接恒 ok 后回执
        // 恒带档案原文——error:''=正常，非空=failed 场次的存档错误（是
        // 查询的答案，不是查询失败），state 缺失=no_such_job。按 error
        // 判会把 failed 场次整段跳过（存档错误毒倒画布恢复的实锤现场）。
        jobState = state.state
        if (jobState === 'failed' && state.error !== undefined && state.error.length > 0) {
          lastError = state.error
        }
        jobState = await reconcileMirrorWithEngine({ bridge, runState, jobId, mainSid, sessionKnown, jobState })
        const labels = state.checkpoint_labels ?? {}
        checkpoint = Object.fromEntries(
          Object.entries(state.checkpoints ?? {}).map(([tid, nid]) => [tid, labels[tid] ?? nid]),
        )
        // 【2026-09-07 B1 拆除】草稿 vs 运行快照的宿主比对退役：
        // 比对职责归位——femoGen 跑前用自身脏标志比对定版（runGuard），
        // 引擎 job_resume 第④关做 checkpoint 指纹裁决（原话上浮）。
        // 宿主只存草稿、只转发，不再复刻引擎解析器。
      } else if (state !== undefined) {
        // no_such_job（runs 档案没了，引擎无从停起）：镜像还咬定
        // running 的话降级为挂起——引擎侧无档案可改，宿主侧先说实话。
        const ghostMirror = runState.jobs.get(jobId)
        if (ghostMirror !== undefined && ghostMirror.state === 'running') {
          jobMirrorSetState(runState, jobId, 'suspended')
          if (runState.activeJobId === jobId) runState.activeJobId = undefined
          broadcastProjectionState(runState, mainSid)
          console.log(`[femo-plugin] session-state job=${jobId} no_such_job：残留 running 镜像降级 suspended`)
        }
      }
      // no_such_job / 无绑定 → checkpoint={}（引擎已终态化的 Job 断点作废）
    }
    const jobIds = await readSessionJobIds(resolved.femoRoot, mainSid)
    // 等待人类输入快照（2026-09-06）：mirror.waitingHuman 在 human_wait
    // SET / human_done 清——带出到前端，刷新页面后画布据此恢复人类
    // 输入气泡（不依赖 SSE 重放环覆盖）。
    const waitingMirror = jobId !== undefined ? runState.jobs.get(jobId) : undefined
    writeJson(res, 200, {
      ok: true,
      hasScript: script !== undefined,
      script: script ?? undefined,
      scriptPath: record?.path ?? undefined,
      rev: record?.rev ?? 0,
      jobId,
      ...(jobIds !== undefined ? { jobIds } : {}),
      checkpoint,
      state: jobState,
      running: isSessionRunning(runState, mainSid),
      ...(lastError !== undefined ? { lastError } : {}),
      ...(waitingMirror?.waitingHuman !== undefined ? { waitingHuman: waitingMirror.waitingHuman } : {}),
    })
  })().catch((error: unknown) => {
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}

// ═══ 已退役（观察期起 2026-09-27 死代码排查，全仓零调用方；观察无误后连块删除）：handleJob + /femo-plugin/job 路由（注释声称的消费方 femoGen 实测只吃 8 条路由，不含它） ═══
// /** GET /femo-plugin/job —— Job 档案透传（2026-09-06 job 快照改造）：femoGen 凭
//  *  job_id 直接问引擎——快照文本/地址、断点、状态全部以引擎档案为权威（宿主
//  *  不再代问代译）。no_such_job 等引擎原话 404 上浮。 */
// export function handleJob(bridge: FemoBridge, req: IncomingMessage, res: ServerResponse): void {
//   void (async () => {
//     const url = new URL(req.url ?? '/', 'http://localhost')
//     const raw = url.searchParams.get('job_id')
//     const jobId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : undefined
//     if (jobId === undefined) {
//       writeJson(res, 400, { ok: false, error: 'job_id is required' })
//       return
//     }
//     if (!bridge.alive) {
//       writeJson(res, 503, { ok: false, error: '引擎启动中（bridge 未就绪）' })
//       return
//     }
//     try {
//       const job = await bridge.send('get_job_state', { job_id: jobId }, 15000) as { error?: string; state?: string } | undefined
//       // 桥接恒 ok（2026-09-10）：404 语义改按档案缺失判（state 字段缺失
//       // =no_such_job），引擎原话上浮；failed 场次档案照常 200——存档
//       // error 是数据不是查询失败，快照/断点查询不受影响。
//       if (job?.state === undefined) {
//         writeJson(res, 404, { ok: false, error: String(job?.error ?? 'no_such_job') })
//         return
//       }
//       writeJson(res, 200, { ok: true, job })
//     } catch (error: unknown) {
//       const msg = String(error instanceof Error ? error.message : error)
//       writeJson(res, 404, { ok: false, error: msg })
//     }
//   })().catch((error: unknown) => {
//     writeJson(res, 500, { ok: false, error: String(error) })
//   })
// }
