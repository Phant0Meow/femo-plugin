/**
 * node-retry.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

export type ParkVerdict =
  | { kind: 'retry'; feedback: string; attempt: number; aiName: string }
  | { kind: 'done' }
  | { kind: 'aborted' }

export type ParkerKind = 'subagent' | 'main' | 'human'

export interface ParkerSpec {
  waitKey: string
  nodeName: string
  kind: ParkerKind
  jobId: number
  mainSessionId: string
  controller?: AbortController
  steer(text: string): void
}

// export declare const RETRY_TURN_TIMEOUT_MS: number  // 已退役（观察期 2026-09-27 femo2host 死代码排查）：实现侧同批退役
export declare const SET_VARIABLE_TEACHING: string
export declare function RETRY_STEER_TEXT(attempt: number, message: string): string

export declare class NodeRetryBroker {
  register(spec: ParkerSpec): void
  park(waitKey: string): Promise<ParkVerdict>
  deliverRetry(waitKey: string, feedback: string, attempt: number, aiName: string): void
  steerLease(waitKey: string, text: string): void
  markSettled(waitKey: string): void
  abortAll(reason: string): void
  abortJob(jobId: number, reason: string): void
  has(waitKey: string): boolean
  unregister(waitKey: string): void
  dispose(): void
}
