/**
 * subagent-core.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

export interface ActorUsageRecord {
  provider: string
  model: string
  contextWindow: number
  usedTokens: number
  updatedAt: number
}

export interface ActiveSubagent {
  controller: AbortController
  node: string
  jobId: number
  interrupt?: () => void
}

export declare const turnBaseBySession: Map<string, number>
export declare const TURN_BASE_EPOCH: number
export declare const actorUsageBySession: Map<string, Map<string, ActorUsageRecord>>
export declare const ACTOR_CONTEXT_WINDOW_FALLBACK: number
export declare const FORWARD_CHILD_EVENTS: Set<string>
// export declare const SURFACE_OP_EVENTS: Set<string>  // 已退役（观察期 2026-09-27 femo2host 死代码排查）：实现侧同批退役
export declare const BUFFERED_CHILD_EVENTS: Set<string>

export declare function makeActiveSubagent(opts: {
  controller: AbortController
  node: string
  jobId: number
  interrupt?: () => void
}): ActiveSubagent
export declare const activeSubagents: Set<ActiveSubagent>
export declare const activeChildRuns: Map<string, { mainSid: string; node: string; jobId: number }>
export declare const runControlAborted: WeakSet<AbortController>
export declare function abortJobSubagents(jobId: number, reason: string): number
export declare function abortAllSubagents(reason: string): number

export declare function readSoulPersona(
  bridge: { send(cmd: string, args?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> },
  soulId: string,
): Promise<string>

export declare const KNOWN_BLOCK_KEYS: ReadonlySet<string>
export declare function buildSubagentPrompt(blocks: Record<string, unknown>): string

export declare const ACTOR_DENIED_TOOLS: readonly string[]
export declare function toolFilterOf(
  resolved: { defaultActorTools: boolean; toolWhitelist: string[] },
  request: Record<string, unknown>,
): { toolFilter: { allow?: string[]; deny?: string[] } }

export declare const ACTOR_SANDBOX_MODE: 'workspace-write'
export declare const ACTOR_APPROVAL_POLICY: 'ask'
export declare const FEMO_CHILD_SCOPE_TEXT: string
export declare function appendActorPolicyPins(session: { append(type: string, data: unknown): void }): void

export declare function resolveMainModel(
  parent: { session: { requestHeader?(): { config?: { provider?: unknown; model?: unknown } } | undefined } },
  defaultModel?: { currentSelection(): unknown },
): { provider: string; model: string } | undefined

export declare function resolveSourceModel(
  resolved: { dshProvider: string },
  source: unknown,
  mainModel?: { provider: string; model: string },
): { agentOptions?: { provider: string; model: string } }

export interface ActorUsageSampler {
  capture(event: { type?: unknown; data?: unknown }): void
  applyUsage(usage: unknown): void
  publish(): void
  persist(): void
  modelIdNow(): string
  current: { provider?: string; model?: string; contextWindow?: number; usedTokens?: number }
}
export declare function createActorUsageSampler(opts: {
  onPublish(record: ActorUsageRecord): void
  onPersist(record: ActorUsageRecord): void
}): ActorUsageSampler
