/**
 * actor-usage.ts — 角色上下文占用档案（角色窗圆环数据源，dsh 私产）。
 *
 * 2026-09-25 用户拍板下推宿主自有：公共层 state-files.mjs 里这一族只有 dsh
 * 一个消费方（routes 的 /femo-plugin/actor-usage 读、subagent-native 写），
 * 按「只有一份的先别急着抽公共」收回宿主；数据目录随迁 <插件根>/data/actor-usage
 * ——宿主内部状态不再进共享 user_data（租户纪律：数据目录就是租户边界）。
 * 实现自 state-files.mjs 原样迁出，含会话级串行锁语义（锁本体公用公共层一份）。
 */
import { join } from 'node:path'
import { packageRoot } from './config'
import { withRecordLock } from '../../../femo2host/host/state-files.mjs'

/** 一个角色最近一次运行的上下文占用快照。usedTokens=该角色上一次发言时发给
 * API 的完整 prompt 的 provider 实报 token 量（input+缓存读写，不含输出——
 * 官方 pressureTokens 同语义，2026-08-31 猫猫拍板语义）；contextWindow=该
 * 模型 request/context 记录的容量（adapter 未广告时 host 兜底 1_000_000）。 */
export interface ActorUsageRecord {
  provider: string
  model: string
  contextWindow: number
  usedTokens: number
  updatedAt: number
}

function actorUsagePath(sessionId: string): string {
  return join(packageRoot, 'data', 'actor-usage', `${sessionId}.json`)
}

/** 读主会话的角色占用档案（{ 消毒后 actorKey: 快照 }，key 与投影窗 id 尾段
 * 同款消毒——前端从 sessionId 解析出的正是该形态）；不存在/损坏返回 undefined
 * （普通读取方：并发读到半截文件属正常瞬态，与 sessions 记录同哲学，不隔离）。 */
export async function readActorUsageFile(sessionId: string): Promise<Record<string, ActorUsageRecord> | undefined> {
  const { readFile } = await import('node:fs/promises')
  try {
    const raw = await readFile(actorUsagePath(sessionId), 'utf8')
    const parsed = JSON.parse(raw) as { actors?: Record<string, ActorUsageRecord> }
    return typeof parsed.actors === 'object' && parsed.actors !== null ? parsed.actors : undefined
  } catch {
    return undefined
  }
}

/** 合并写一个角色的占用快照（锁内 read-merge-write：par 兄弟 run 的收尾
 * 并发不会互相覆盖丢 actor）。actorKey=消毒后的投影窗尾段（与前端一致）。 */
export async function mergeActorUsageFile(sessionId: string, actorKey: string, record: ActorUsageRecord): Promise<void> {
  await withRecordLock(sessionId, async () => {
    const fs = await import('node:fs/promises')
    const existing = await readActorUsageFile(sessionId) ?? {}
    const actors = { ...existing, [actorKey]: record }
    await fs.mkdir(join(packageRoot, 'data', 'actor-usage'), { recursive: true })
    await fs.writeFile(actorUsagePath(sessionId), JSON.stringify({ sessionId, actors }, null, 2), 'utf8')
  })
}
