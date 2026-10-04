/**
 * api-retry.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

/** 一次慢层重试的作用对象。 */
export interface ActorTarget {
  kind: 'subagent' | 'main'
  mainSessionId: string
  childSessionId: string
  node: string
}

export interface ApiRetryFailure {
  code: string
  message: string
}

/** 宿主装配回调（插座实现方注入）。 */
export interface ApiRetryDeps {
  resolveTarget(childSessionId: string): ActorTarget | undefined
  onRetry(target: ActorTarget, attempt: number, delayMs: number, failure: ApiRetryFailure): void
  onExhausted(target: ActorTarget, failure: ApiRetryFailure): void
}

/** 归一失败事实（宿主从自家事件 payload 翻译而来）。 */
export interface ApiRetryFact {
  childId: string
  turn: number
  step: number
  signal: AbortSignal
  failure: ApiRetryFailure
}

export declare const RETRYABLE_CODES: ReadonlySet<string>
export declare const SLOW_DELAYS_MS: readonly number[]
export declare const MAX_CONSECUTIVE_FAILURES: number

export declare class ApiRetryChain {
  handleFailure(fact: ApiRetryFact, deps: ApiRetryDeps, pass: () => unknown): Promise<unknown>
  clearChild(childSessionId: string): void
  dispose(): void
}

export declare const apiRetry: ApiRetryChain
