/**
 * client-ui/stream-store.ts — femo 宿主 SSE 共享连接池 + 角色占用缓存。
 *
 * 【2026-09-20 旧直播链退役】本文件原名「femo_stream 直播缓冲」：按桶缓冲
 * 宿主 femo_stream 逐字帧、驱动旧投影窗打字机。链路B 后投影窗内容由投影
 * 中心（hub）供给（历史=journal 快照、打字=hub 草稿帧），宿主 femo_stream
 * 帧已全部停发，整套桶机与消费 hook（useFemoStream*）拆除。保留的都是活件：
 *  - SSE 共享连接池（引用计数+可见性门控）：/femo-plugin/events 单连接多路
 *    复用——角色圆环增量（femo_actor_usage）、编辑器控制事件（script_changed
 *    等）、proj2 的帧接线都搭这条连接；
 *  - 角色上下文占用缓存（useActorUsage，投影窗圆环数据源）；
 *  - femoProjectionActorKey（窗 id 尾段消毒算法，与宿主 projectionActorKey
 *    同款——浏览器无法 import host 代码，两端改动必须同步）。
 */

import { useEffect, useState } from 'react'

/** 投影窗 id 的 actorKey 消毒（与宿主 projectionActorKey 同算法，前端比对用）。 */
export function femoProjectionActorKey(actor: string): string {
  return Array.from(actor).map(ch => (/[A-Za-z0-9_-]/.test(ch) ? ch : `_${(ch.codePointAt(0) ?? 0).toString(16)}`)).join('')
}

// SSE 单例（引用计数 + 可见性门控）：【2026-09-05 连接池修复】从「apply() 页面
// 级预开常驻」改为按需连接——consumer 挂载期间各自 acquire、卸载 release。
// 【2026-09-05 晚·Stage2】连接需求分两池：
//  - 前台池（投影窗直播锚点/角色圆环）：只在页面可见时需要——「看哪个窗连哪个
//    窗」。投影内容的状态完整性由 mux+会话日志回放保证（host 照写 log，切回
//    按 seq 补齐），SSE 只服务前台观感：切后台断、切回连。
//  - 后台池（编辑器）：tab 打开即持有、不看可见性——AI 工具随时可能操作
//    femoGen（script_changed 实时响应是编辑器的硬需求）。
// 连接开启条件 = 后台池>0 || (前台池>0 && 页面可见)。普通（非 femo）页面零
// femo 长连接：官方每页已有 events.mux/events.host 两条 ws，浏览器 HTTP/1.1
// 每域 6 连接池很紧（同源多标签饿死教训，见 2026-09-05 修复）。
// 控制事件（script_changed 等）与角色占用增量共用这条全局 SSE 便车——
// 避免第二条长连接。
let femoStreamEs: EventSource | undefined
let foregroundRefs = 0
let backgroundRefs = 0
let pageVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden'
let visibilityBound = false

/** 连接意愿 = 后台池>0（编辑器常驻）或 前台池>0 且页面可见。 */
function femoStreamWanted(): boolean {
  return backgroundRefs > 0 || (foregroundRefs > 0 && pageVisible)
}

/** 按意愿开/关连接（幂等）：创建时挂 onmessage，关闭即清理。 */
function syncFemoStreamConnection(): void {
  if (femoStreamWanted() && femoStreamEs === undefined) {
    femoStreamEs = new EventSource('/femo-plugin/events')
    femoStreamEs.onmessage = (ev: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(ev.data) as { type?: string; data?: Record<string, unknown> }
        // 角色占用增量（2026-08-31 角色窗圆环）：宿主子代理采样帧，last-wins 入表。
        if (msg.type === 'femo_actor_usage') actorUsageApply(msg.data ?? {})
        // 控制事件转发给单页宿主（script_changed 等）与 proj2 帧接线。
        if (controlHandlers.size > 0) {
          for (const h of [...controlHandlers]) {
            try { h(msg) } catch { /* 单个处理器异常不影响广播 */ }
          }
        }
      } catch {
        // 非 JSON SSE 行忽略
      }
    }
    return
  }
  if (!femoStreamWanted() && femoStreamEs !== undefined) {
    femoStreamEs.close()
    femoStreamEs = undefined
  }
}

function ensureVisibilityGate(): void {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  document.addEventListener('visibilitychange', () => {
    pageVisible = document.visibilityState !== 'hidden'
    syncFemoStreamConnection()
  })
}

/** 控制事件订阅（editor-page 单页宿主/proj2 帧接线用）：全局 SSE 收到的每条消息都会转发。 */
const controlHandlers = new Set<(msg: { type?: string; data?: Record<string, unknown> }) => void>()

export function subscribeControlEvents(h: (msg: { type?: string; data?: Record<string, unknown> }) => void): () => void {
  controlHandlers.add(h)
  return () => { controlHandlers.delete(h) }
}

/**
 * 获取一条 SSE 依赖（引用计数）。
 * @param opts.background - true = 后台池（编辑器）：tab 打开即持有、不看可见性；
 *   缺省 = 前台池：页面切后台自动断、切回自动重连。
 * @returns 释放函数（卸载时调用，恰好一次）。
 */
export function femoStreamAcquire(opts?: { background?: boolean }): () => void {
  ensureVisibilityGate()
  if (opts?.background === true) backgroundRefs += 1
  else foregroundRefs += 1
  syncFemoStreamConnection()
  return () => {
    if (opts?.background === true) backgroundRefs -= 1
    else foregroundRefs -= 1
    syncFemoStreamConnection()
  }
}

// ── 角色上下文占用（2026-08-31 角色窗圆环）────────────────────────────────
// 宿主子代理采样（request/context 分母 + provider usage 分子——该角色上一
// 次发言时发给 API 的完整 prompt 实报 token 量），SSE femo_actor_usage 实时
// 推送 + user_data/host-history/projections/actor-usage/<sid>.json 档案。
// key=消毒后的 actorKey（与投影窗 id 尾段同算法，前端从 sessionId 解析）。

export interface ActorUsage {
  provider: string
  model: string
  contextWindow: number
  usedTokens: number
  updatedAt: number
}

/** 主 sid → (actorKey → 最近一次运行占用)。内存缓存，SSE 增量 + GET 全量合并。 */
const actorUsages = new Map<string, Map<string, ActorUsage>>()
const actorUsageListeners = new Set<() => void>()

function actorUsageApply(d: Record<string, unknown>): void {
  const sid = typeof d.sid === 'string' ? d.sid : undefined
  const actorKey = typeof d.actorKey === 'string' ? d.actorKey : undefined
  if (sid === undefined || actorKey === undefined) return
  let byActor = actorUsages.get(sid)
  if (byActor === undefined) {
    byActor = new Map()
    actorUsages.set(sid, byActor)
  }
  byActor.set(actorKey, {
    provider: typeof d.provider === 'string' ? d.provider : '',
    model: typeof d.model === 'string' ? d.model : '',
    contextWindow: typeof d.contextWindow === 'number' && d.contextWindow > 0 ? d.contextWindow : 1_000_000,
    usedTokens: typeof d.usedTokens === 'number' ? d.usedTokens : 0,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
  })
  for (const l of [...actorUsageListeners]) {
    try { l() } catch { /* 单个订阅者异常不影响其他 */ }
  }
}

/**
 * 读某主会话某角色的最近一次运行占用（角色窗圆环数据源）。挂载期间维持
 * SSE 连接接收增量；首次另发一次 GET 全量拉取（SSE 断线/重启后宿主内存
 * 空时由宿主读档案文件兜底）。
 */
export function useActorUsage(mainSid: string | undefined, actorKey: string | undefined): ActorUsage | undefined {
  const [value, setValue] = useState<ActorUsage | undefined>(undefined)
  useEffect(() => {
    if (mainSid === undefined || actorKey === undefined) {
      setValue(undefined)
      return
    }
    let alive = true
    const read = (): void => { setValue(actorUsages.get(mainSid)?.get(actorKey)) }
    read()
    void fetch(`/femo-plugin/actor-usage?sessionId=${encodeURIComponent(mainSid)}`)
      .then(response => response.json() as Promise<{ ok?: boolean; actors?: Record<string, ActorUsage> }>)
      .then((data) => {
        if (!alive || data?.ok !== true || data.actors === undefined || typeof data.actors !== 'object') return
        let byActor = actorUsages.get(mainSid)
        if (byActor === undefined) {
          byActor = new Map()
          actorUsages.set(mainSid, byActor)
        }
        for (const [key, rec] of Object.entries(data.actors)) {
          if (rec !== null && typeof rec === 'object') byActor.set(key, rec)
        }
        read()
      })
      .catch(() => { /* 拉取失败静默：SSE 增量仍会到达 */ })
    const release = femoStreamAcquire()
    actorUsageListeners.add(read)
    return () => {
      alive = false
      actorUsageListeners.delete(read)
      release()
    }
  }, [mainSid, actorKey])
  return value
}
