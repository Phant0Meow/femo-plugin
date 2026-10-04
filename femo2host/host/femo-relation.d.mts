/**
 * femo-relation.d.mts — 本会话与 FEMO 的关系裁决类型（正身见 femo-relation.mjs）。
 */

export interface FemoRelationOpts {
  /** 宿主注入的易失运行信号：本会话当前是否有在跑的 Job（如 dsh 的
   *  runState.sidIndex）。不注入=只按落盘账裁。 */
  isRunning?(sid: string): boolean
  /** 已持有的在线口径当选视图（cast-core preferencesView(femoRoot,'online')
   *  的返回）——直传可省一次 hub 往返；缺省现查。 */
  castView?: { bindings: Record<string, { sid?: string; host?: string }> }
}

export interface FemoRelationView {
  ok: true
  related: boolean
  launched: boolean
  acting: boolean
  latestJob: number | undefined
}

export declare function sessionFemoRelation(femoRoot: string, sessionId: string, opts?: FemoRelationOpts): Promise<FemoRelationView>
