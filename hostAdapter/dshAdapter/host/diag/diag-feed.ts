/**
 * diag-feed.ts — 运行时诊断中枢（2026-09-06 排查"投影窗人类发言不发人类节点"）。
 *
 * 纯新增观测面，零行为影响：关键路径埋点调用 pushDiag，条目进 ① 内存环形
 * 缓冲（diag-tail 路由拉历史）②SSE femo_diag 广播（前端诊断窗实时流）
 * ③cache/logs/debug-diag-feed.log 文件（走 debug-log.ts 统一出口：24 小时
 * 时效 + 超 5MB 轮转保一代，host 重启后仍在、且封得住顶——2026-09-25 曾
 * 因只写不清长到 288MB）。
 *
 * 为什么不会影响别处：pushDiag 只做 append + 已有 broadcastSse 复用，
 * 无任何分支/状态写入；调用点全部是"原本就 console.log 或纯追加"的位置。
 */

import { broadcastSse } from '../http'
import { appendDebugLog } from './debug-log'

export interface DiagEntry {
  ts: string
  tag: string
  msg: string
}

const CAP = 800
const ring: DiagEntry[] = []
let femoRoot: string | undefined

/** index.ts 装配时调用一次；未 init 时 pushDiag 只走内存+SSE（可测性）。 */
export function initDiagFeed(root: string): void {
  femoRoot = root
}

/** 诊断埋点唯一入口：环形缓冲 + SSE + 文件三路落点，失败静默（观测绝不反噬主路）。 */
export function pushDiag(tag: string, msg: string): void {
  const entry: DiagEntry = { ts: new Date().toISOString(), tag, msg }
  ring.push(entry)
  if (ring.length > CAP) ring.shift()
  try {
    broadcastSse('femo_diag', entry)
  } catch { /* SSE 失败不影响观测主路 */ }
  if (femoRoot !== undefined) {
    appendDebugLog(femoRoot, 'debug-diag-feed.log', `[${entry.ts}] [${tag}] ${msg}`)
  }
}

/** GET /femo-plugin/diag-tail?n=300 —— 最近 n 条（时间正序）。 */
export function diagTail(n: number): DiagEntry[] {
  const count = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), CAP) : 300
  return ring.slice(-count)
}
