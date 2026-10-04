/**
 * job-index.ts — 断电索引重建（2026-09-25 刀④自 index.ts 抽出，逻辑逐字）。
 *
 * 断电闭环（§10.2）的宿主半场：宿主启动/重启后扫会话记录的 currentJobId 填
 * runState.sidIndex——不置 running（引擎 reconcile 已把全量 running 判
 * suspended(crash)，镜像天然干净）。此后：前端 /session-state 走 get_job_state
 * 代理看到 suspended + checkpoint → 显示「继续」→ job_resume 六关裁决 → 恢复。
 * 消费方两处：apply 装配尾跑一次（开机重建）；桥保姆 C1 自愈在桥重生就绪后
 * 再跑一次（respawn 后新进程 reconcile 完、runs 目录是权威）。
 */
import type { RunState } from './events/engine-events'
import { draftsDirOf, readSessionCurrentJob } from './state-files'

export async function rebuildJobIndexFromRecords(femoRoot: string, runState: RunState): Promise<void> {
  const { readdir } = await import('node:fs/promises')
  // 数据根单源 state-files.draftsDirOf（2026-09-29）：曾自拼路径漏 FEMO_DATA_DIR
  // 分支——沙盒/多实例部署下会扫不到分桶根里的会话账，索引重建落空。
  const sessionsDir = draftsDirOf(femoRoot)
  let names: string[] = []
  try {
    names = await readdir(sessionsDir)
  } catch {
    return
  }
  let rebuilt = 0
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const sid = name.slice(0, -'.json'.length)
    const jobId = await readSessionCurrentJob(femoRoot, sid)
    if (jobId !== undefined) {
      runState.sidIndex.set(sid, jobId)
      rebuilt += 1
    }
  }
  if (rebuilt > 0) console.log(`[femo-plugin] job index rebuilt from session records: ${rebuilt} entr(y|ies)`)
}
