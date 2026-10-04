/**
 * run-control-core.mjs — 运行运行控制裁决（femo2host 公共层，2026-09-24 B3 收编）。
 *
 * 「暂停一个 Job」的完整裁决语义唯一活在本文（原 dsh run-control.pauseJobResolved
 * 的 JS 正身；此前 tools-core 的 pause 只认进程内 lastJobId 且无条件包装
 * paused:true——引擎对 finished Job 也回 paused:true，挂起已归档的戏会误报
 * 成功；MCP 重启后 lastJobId 失忆则连在跑的戏都停不掉）：
 *
 *   显式 jobId：绕过宿主镜像，按引擎档案裁决——get_job_state 查现态与归属
 *   （host_refs[hostKey] 字典优先，回退 host_ref 单值旧档），属于本宿主且
 *   running 才发 job_pause（引擎幂等+强停兜底）；no_such_job / 异归属 /
 *   非 running 各自成案。
 *
 *   缺省：镜像快路径（可选注入 findMirrorTarget——dsh 传内存镜像双判定，
 *   zcode/autoclaw 不传）不认时降级 list_jobs 查引擎档案兜底——镜像只是
 *   缓存，引擎档案才是真相。始终不裸发 job_pause。
 *
 * 裁决是纯判断+桥命令，宿主呈现（工具 ❌ / HTTP 错误面板+诊断流）留插座。
 * 时长契约（§4.7）：job_pause 发送超时 15s > 引擎侧强停兜底 join 10s+0.2s
 * 退出缓冲——慢收场（强停路径）不等价于失败，回执总能赶上。
 */

export const PAUSE_SEND_TIMEOUT_MS = 15_000

/**
 * 解析并执行「暂停一个 Job」。
 * @param {object} opts
 * @param {(cmd: string, args?: object, timeoutMs?: number) => Promise<unknown>} opts.send
 *     bridge.send 绑定
 * @param {string} [opts.hostKey]     host_refs 字典键=宿主自称（桥 --host 标签）
 * @param {string} opts.ownerRef      归属值=Job 登记的 host_ref（dsh=会话 id；
 *                                    zcode/autoclaw=工具层的 hostRef 标签）
 * @param {number} [opts.jobId]       显式指定（强停入口；缺省=自动解析）
 * @param {() => number | undefined} [opts.findMirrorTarget]
 *                                    宿主镜像快路径（dsh 内存镜像双判定；缺省无=纯档案）
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{kind:'paused', jobId:number, paused:boolean, state?:string}
 *                   |{kind:'no-such-job', jobId:number|undefined}
 *                   |{kind:'not-owner', ownerShow:string}
 *                   |{kind:'idle', state:string, jobId:number}
 *                   |{kind:'none'}>}
 *     桥不通时 send 抛错原样上浮（调用方呈现）。
 */
export async function resolveAndPauseJob(opts) {
  const { send, hostKey, ownerRef, jobId, findMirrorTarget, timeoutMs = PAUSE_SEND_TIMEOUT_MS } = opts;
  const ownerOf = j => (j?.host_refs?.[hostKey] ?? j?.host_ref);
  if (jobId !== undefined) {
    const st = await send('get_job_state', { job_id: jobId }, timeoutMs);
    if (st === undefined || st.state === undefined) {
      // 恒 ok 回执但 state 缺失 = no_such_job（2026-09-10 判据）。
      return { kind: 'no-such-job', jobId };
    }
    if (ownerOf(st) !== ownerRef) {
      return { kind: 'not-owner', ownerShow: JSON.stringify(st.host_refs ?? st.host_ref ?? '?') };
    }
    if (st.state !== 'running') {
      return { kind: 'idle', state: st.state, jobId };
    }
    const result = await send('job_pause', { job_id: jobId }, timeoutMs);
    return { kind: 'paused', jobId, paused: result?.paused === true, state: result?.state };
  }
  let target = findMirrorTarget?.();
  if (target === undefined) {
    // 镜像不认 ≠ 没在跑：查引擎档案兜底（镜像滞后/丢失/重启清空的场景）。
    const listed = await send('list_jobs', {}, timeoutMs);
    const engineRunning = listed?.jobs?.find(j => j.state === 'running' && ownerOf(j) === ownerRef);
    target = engineRunning?.job_id;
  }
  if (target === undefined) return { kind: 'none' };
  const result = await send('job_pause', { job_id: target }, timeoutMs);
  return { kind: 'paused', jobId: target, paused: result?.paused === true, state: result?.state };
}
