/**
 * projection-core.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

export declare function actorKeyOf(name: string): string
export declare function dedupeStructKey(eventType: string, d: Record<string, unknown> | undefined): string | undefined
export declare function replayKey(type: string, d?: Record<string, unknown>): string
export declare function resolveTargets(targetActors: string[] | undefined): string[] | undefined
export declare function chatRow(
  chatType: string,
  fields: { text: string; kind?: string; actor?: string; visible?: string[]; turn?: number; step?: number; srcSeq?: string | number },
): { type: string; data: Record<string, unknown> }

export interface LedgerRow {
  type: string
  data?: Record<string, unknown>
  seq?: number
}

export declare class WindowLedger {
  readonly srcSeqs: Set<unknown>
  readonly structKeys: Set<string>
  cursor: number
  seeded: boolean
  seed(rows: Iterable<LedgerRow>): void
  check(type: string, data?: Record<string, unknown>): 'ok' | 'dup-src' | 'dup-struct'
  mark(type: string, data?: Record<string, unknown>): void
  nextSeq(): number
}

// ═══ 已退役（观察期起 2026-09-27 femo2host 死代码排查，全仓零引用；观察无误后连块删除）：GateTraceInfo（唯一读者 SectionGate 同批退役） ═══
// export interface GateTraceInfo {
//   turn?: number
//   actorKey?: string
//   queueLen?: number
//   headTurn?: number
//   readyPattern?: string
//   hasHook?: boolean
//   remaining?: number
// }

// ═══ 已退役（观察期起 2026-09-27 femo2host 死代码排查，全仓零引用；观察无误后连块删除）：SectionGate（实现侧 projection-core.mjs 同批退役） ═══
// export declare class SectionGate {
//   constructor(opts?: { trace?: (event: string, info: GateTraceInfo) => void })
//   begin(sid: string, turn: number, actorKey: string): void
//   waitActorFlush(sid: string, actorKey: string): Promise<void>
//   commit(sid: string, turn: number, actorKey: string, run: () => void): void
//   dropPending(sid: string): number[]
// }

/** 窗集合（scope 的解析产物）。god/stage 可缺（窗未建时逐窗跳过）。 */
export interface WindowSet<WinRef> {
  god?: WinRef
  stage?: WinRef
  actors: Map<string, WinRef>
}

export interface ProjectionAppenderOpts<WinRef> {
  windowsOf(scope: unknown): WindowSet<WinRef> | undefined
  ledgerOf(winRef: WinRef): WindowLedger
  write(winRef: WinRef, type: string, data: Record<string, unknown>, surfaceOp?: Record<string, unknown>, winName?: string): void
  keyOf?(name: string): string
  onWriteError?(error: unknown, winName: string, type: string): void
  onSkip?(reason: 'dup-src' | 'dup-struct', winName: string, type: string): void
}

export interface AppendOpts {
  targetActors?: string[]
  skipGod?: boolean
  surfaceOp?: Record<string, unknown>
}

export declare function createProjectionAppender<WinRef>(opts: ProjectionAppenderOpts<WinRef>): (
  scope: unknown,
  type: string,
  data: Record<string, unknown>,
  appendOpts?: AppendOpts,
) => number
