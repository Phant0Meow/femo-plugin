/**
 * bridge-supervisor.ts — 桥的保姆：C1 进程监督自愈（2026-09-25 刀④自 index.ts 抽出）。
 *
 * bridge 半路死亡 → 清账（onExited）→ 延迟 3s 自动 respawn + ping 轮询 →
 * 就绪后重建 Job 索引（Job 档案在引擎侧未丢——新进程 reconcile 已把 running
 * 判 suspended(crash)，runs 目录是权威）。两道防线：
 *  ① dispose 标志：插件卸载/HMR 时 bridge.stop() 也会触发 onExited——
 *    卸载后绝不允许僵尸 respawn（调用方在 bridge lifecycle effect 里先
 *    markDisposed 再 stop）；
 *  ② 崩溃连击退避：30s 窗口内连续死亡 ≥3 次（spawn 即死/启动即崩）→
 *    停止自动重启并大声 log——监督自愈不能变成重启风暴（防反复烧桥）。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { FemoBridge } from './bridge'
import type { ResolvedConfig } from './config'
import type { RunState } from './events/engine-events'
import { broadcastProjectionState } from './events/engine-events'
import { pushDiag } from './diag/diag-feed'
import { abortAllSubagents } from '../../../femo2host/host/subagent-core.mjs'
import { broker } from './node-retry'
import { rebuildJobIndexFromRecords } from './job-index'

export interface BridgeSupervisor {
  /** 插件卸载/HMR：置 disposed——bridge.stop() 触发的 onExited 据此跳过
   *  respawn（装配方在 bridge lifecycle effect 里先调它再 stop）。 */
  markDisposed(): void
}

export function installBridgeSupervisor(opts: {
  ctx: Context
  resolved: ResolvedConfig
  bridge: FemoBridge
  runState: RunState
}): BridgeSupervisor {
  const { ctx, resolved, bridge, runState } = opts
  let bridgeDisposed = false
  let bridgeCrashStreak = 0
  let lastCrashAt = 0

  /** 轮询 ping 等重生后的 bridge 就绪（最多 15s），就绪即重建 Job 索引。 */
  const pingBridgeUntilAlive = async (): Promise<void> => {
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (bridgeDisposed) return
      try {
        await bridge.send('ping', {}, 3000)
        console.log(`[femo-plugin] C1 self-heal: bridge respawned and ready (after ~${i + 1}s); rebuilding job index`)
        await rebuildJobIndexFromRecords(resolved.femoRoot, runState)
        return
      } catch { /* spawn 中/未就绪：继续等 */ }
    }
    console.log('[femo-plugin] C1 self-heal: bridge ping not ready after 15s; subsequent commands will surface errors if still down')
  }

  // 引擎进程半路死亡时不会有任何终止事件，镜像会卡孤儿 running——这里清账
  // 并自愈重启（第一步只清账+log，C1 自愈为第二步收尾，§十四.1）。
  bridge.onExited = (): void => {
    if (runState.activeJobId !== undefined || runState.jobs.size > 0) {
      console.log('[femo-plugin] bridge exited mid-run; clearing stale job mirrors')
      pushDiag('bridge', 'exited mid-run → 清全部 Job 镜像 waitingHuman + activeJobId（C1 自愈将重建索引）')
    }
    // 清场：全场掐断在飞角色 + 放行全部停靠者 + jobs 全部 state 校正。
    abortAllSubagents('bridge exited')
    broker.abortAll('bridge exited')
    for (const [jobId, mirror] of runState.jobs) {
      if (mirror.state === 'running') mirror.state = 'failed'
      mirror.waitingHuman = undefined
    }
    runState.activeJobId = undefined
    // sidIndex 保留（respawn 后 pingBridgeUntilAlive / 重启 rebuild 重建）。
    // 清账后向各 Job 归属会话广播投影窗状态（全部转非 running）。
    for (const mirror of runState.jobs.values()) {
      broadcastProjectionState(runState, mirror.ownerSid)
    }
    void rebuildJobIndexFromRecords(resolved.femoRoot, runState)

    if (bridgeDisposed) return
    const now = Date.now()
    bridgeCrashStreak = (now - lastCrashAt < 30_000) ? bridgeCrashStreak + 1 : 1
    lastCrashAt = now
    if (bridgeCrashStreak >= 3) {
      console.log('[femo-plugin] C1 self-heal: bridge crashed 3x within 30s; auto-respawn disabled (needs manual restart)')
      return
    }
    setTimeout(() => {
      if (bridgeDisposed) return
      console.log(`[femo-plugin] C1 self-heal: respawning bridge (crash streak=${bridgeCrashStreak})`)
      bridge.start(ctx, resolved)
      void pingBridgeUntilAlive()
    }, 3000)
  }

  return {
    markDisposed: (): void => { bridgeDisposed = true },
  }
}
