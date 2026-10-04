/**
 * client-ui/proj2/frame-router.ts — 直播帧 → 轮桶（显示层 v9 的路由器）。
 *
 * 与旧 stream-store 的关键差别：**桶按轮，不按角色**。
 *   旧：`sid → actorKey → entry`（同一角色的两轮共享一个桶 → 甲1/甲2 同位置同时长字）
 *   新：`sid → turn → entry`（帧自带 turn，直接落进它自己那一轮）
 *
 * 【2026-09-20 旧直播链退役】【刀⑧-3 裁至诊断入口】宿主侧 femo_stream 帧已
 * 全部停发（投影窗内容由 hub 供给），生产路径无帧可喂；直播渲染半边
 * （useFemo2Live 与 femo-stream-live.tsx）随之退役。本文件只剩诊断入口：
 *  - femo2FeedFrame：离线重放面（window.__femo2Feed 同源）；
 *  - femo2DumpBuckets：桶快照（window.__femo2Buckets，见 proj2/index）；
 *  - run_state{running} 的场次清桶（防御性，桶本就不再增长）。
 *
 * 【场次边界】轮号按 Job 重置（TURN_BASE_EPOCH + 100n），所以任何"跨轮记忆"
 * 都必须按场清零：run_state{running} 到达即清空本会话全部轮桶（v8.2 的
 * femoMaxTurnSeen 跨场残留坑，不再重演——新链路干脆不存跨轮状态）。
 */

import { subscribeControlEvents } from '../stream-store'

/** 直播块（toolcall 块带 result=官方工具行的结果文本）。 */
export interface Femo2LiveBlock {
  readonly kind: 'text' | 'reasoning' | 'toolcall'
  readonly text: string
  readonly name?: string
  readonly index?: number
  readonly step?: number
  /** toolcall 块：官方工具行的结果文本（undefined=调用还在跑）。 */
  readonly result?: string
}

export interface Femo2LiveState {
  readonly blocks: readonly Femo2LiveBlock[]
  /** 本回合是否在飞（0.1.3 原生 turn_status 帧驱动）→ Deep diving 状态行。 */
  readonly running: boolean
  /** 本回合首次请求时刻（状态行计时起点）。 */
  readonly since: number | null
}

const IDLE: Femo2LiveState = { blocks: [], running: false, since: null }
const EMPTY_BLOCKS: readonly Femo2LiveBlock[] = []

/** 主会话 id → 轮号 → 该轮直播态（全内存；不落盘）。 */
const buckets = new Map<string, Map<number, Femo2LiveState>>()

function bucketOf(sid: string): Map<number, Femo2LiveState> {
  let byTurn = buckets.get(sid)
  if (byTurn === undefined) {
    byTurn = new Map()
    buckets.set(sid, byTurn)
  }
  return byTurn
}

function entryOf(sid: string, turn: number): Femo2LiveState {
  return buckets.get(sid)?.get(turn) ?? IDLE
}

function patch(sid: string, turn: number, next: Partial<Femo2LiveState>): void {
  const byTurn = bucketOf(sid)
  byTurn.set(turn, { ...entryOf(sid, turn), ...next })
}

/** 全场清空（run_state{running}=新一次启动运行；轮号纪元复位，旧桶全部作废）。 */
export function femo2ResetAll(sid?: string): void {
  if (sid === undefined) {
    buckets.clear()
  } else {
    buckets.delete(sid)
  }
}

/** 帧的消费面（与宿主 broadcastSse('femo_stream', …) 同词汇）。 */
interface Femo2Frame {
  kind?: unknown
  sid?: unknown
  actor?: unknown
  turn?: unknown
  step?: unknown
  index?: unknown
  blockKind?: unknown
  text?: unknown
  name?: unknown
  retain?: unknown
  running?: unknown
}

function blockKindOf(value: unknown): Femo2LiveBlock['kind'] {
  if (value === 'reasoning') return 'reasoning'
  if (value === 'toolcall') return 'toolcall'
  return 'text'
}

function sameStep(a: number | undefined, b: number | undefined): boolean {
  return a === b
}

function findBlockAt(blocks: readonly Femo2LiveBlock[], index: number, step: number | undefined, kind: Femo2LiveBlock['kind']): number {
  if (index >= 0) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i]
      if (block?.index === index && sameStep(block.step, step) && block.kind === kind) return i
    }
    return -1
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]?.kind === kind) return i
  }
  return -1
}

/** 应用一条 femo_stream 帧；无轮号的帧（旧通路）不属于本台账，直接忽略。
 *  【刀⑧-3 后唯一入口=诊断/离线重放】（window.__femo2Feed 同源），生产无帧。 */
export function femo2FeedFrame(raw: Femo2Frame): void {
  const sid = typeof raw.sid === 'string' ? raw.sid : ''
  const turn = typeof raw.turn === 'number' ? raw.turn : undefined
  if (sid === '' || turn === undefined) return
  const kind = typeof raw.kind === 'string' ? raw.kind : ''
  const step = typeof raw.step === 'number' ? raw.step : undefined
  const index = typeof raw.index === 'number' ? raw.index : -1
  const prev = entryOf(sid, turn)

  if (kind === 'end') {
    // 闭轮帧（宿主在段落落盘后发，带 turn）：只清自己这一轮的块，
    // 不熄状态行、不删条目（状态行生杀权在 turn_status 帧）。
    if (prev.blocks.length > 0) patch(sid, turn, { blocks: EMPTY_BLOCKS })
    return
  }
  if (kind === 'turn_status') {
    const running = raw.running === true
    if (running === prev.running) return
    patch(sid, turn, { running, since: running ? (prev.running ? prev.since : Date.now()) : null })
    return
  }
  const blockKind = blockKindOf(raw.blockKind)
  if (kind === 'start') {
    if (index >= 0 && prev.blocks.some(b => b.index === index && sameStep(b.step, step))) return
    patch(sid, turn, {
      blocks: [...prev.blocks, {
        kind: blockKind, text: '',
        ...index >= 0 ? { index } : {},
        ...step !== undefined ? { step } : {},
      }],
    })
    return
  }
  if (kind === 'delta') {
    const text = typeof raw.text === 'string' ? raw.text : ''
    const name = typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : undefined
    const at = findBlockAt(prev.blocks, index, step, blockKind)
    if (at < 0) {
      // 块的首个 delta（toolcall 无 start 帧；text/reasoning 空文本不建块）。
      if (blockKind === 'toolcall' || text.length > 0) {
        patch(sid, turn, {
          blocks: [...prev.blocks, {
            kind: blockKind, text,
            ...name !== undefined ? { name } : {},
            ...index >= 0 ? { index } : {},
            ...step !== undefined ? { step } : {},
          }],
        })
      }
      return
    }
    const target = prev.blocks[at] as Femo2LiveBlock
    const next = prev.blocks.slice()
    next[at] = {
      ...target,
      text: target.text + text,
      ...name !== undefined && target.name === undefined ? { name } : {},
    }
    patch(sid, turn, { blocks: next })
    return
  }
  if (kind === 'tool_result') {
    const name = typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : undefined
    const text = typeof raw.text === 'string' ? raw.text : ''
    if (name === undefined && text.length === 0) return
    let at = -1
    for (let i = prev.blocks.length - 1; i >= 0; i--) {
      const block = prev.blocks[i]
      if (block?.kind !== 'toolcall' || block.result !== undefined) continue
      if (name !== undefined && block.name !== name) continue
      if (step !== undefined && block.step !== undefined && block.step !== step) continue
      at = i
      break
    }
    if (at >= 0) {
      const next = prev.blocks.slice()
      next[at] = { ...(prev.blocks[at] as Femo2LiveBlock), result: text }
      patch(sid, turn, { blocks: next })
    } else {
      patch(sid, turn, {
        blocks: [...prev.blocks, {
          kind: 'toolcall', text: '',
          ...name !== undefined ? { name } : {},
          ...step !== undefined ? { step } : {},
          result: text,
        }],
      })
    }
    return
  }
  if (kind === 'block_end') {
    // 角色路径的 retain 帧：块保留在桶里（等段落落盘 + 闭轮帧接管）；
    // 无 retain（旧通路）维持"落地即移除"。
    if (raw.retain === true) return
    const at = findBlockAt(prev.blocks, index, step, blockKind)
    if (at < 0) return
    const next = prev.blocks.slice()
    next.splice(at, 1)
    patch(sid, turn, { blocks: next })
  }
}

let wired = false
/** 挂上全局事件转发（模块级一次）。【刀⑧-3】femo_stream 帧接线已随旧直播链
 *  摘除；只保留 run_state{running} 的场次清桶（防御性，桶本就不再增长）。 */
function ensureWired(): void {
  if (wired) return
  wired = true
  subscribeControlEvents((msg) => {
    if (msg.type === 'run_state') {
      const data = msg.data ?? {}
      if (data.state === 'running') {
        const sid = typeof data.sid === 'string' ? data.sid : undefined
        femo2ResetAll(sid)
      }
    }
  })
}

/** 诊断用：某会话当前桶快照（含块文本预览；window.__femo2Buckets 见 proj2/index）。 */
export function femo2DumpBuckets(sid: string): Array<{ turn: number; blocks: number; running: boolean; text: string }> {
  const byTurn = buckets.get(sid)
  if (byTurn === undefined) return []
  return [...byTurn.entries()].map(([turn, entry]) => ({
    turn,
    blocks: entry.blocks.length,
    running: entry.running,
    text: entry.blocks.map(b => `${b.kind === 'toolcall' ? `⚙${b.name ?? ''}:` : ''}${b.text}`).join('|').slice(0, 60),
  }))
}

// 模块加载即挂上事件入口（帧总是先于渲染位挂载到达；现仅剩场次清桶一路）。
ensureWired()
