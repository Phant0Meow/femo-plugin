/**
 * run-control-core.mjs 的类型声明（dsh host typecheck/IDE 用；运行时语义见 .mjs 文件头）。
 */

export declare const PAUSE_SEND_TIMEOUT_MS: number

export type PauseOutcomeCore =
  | { kind: 'paused'; jobId: number; paused: boolean; state?: string }
  | { kind: 'no-such-job'; jobId: number | undefined }
  | { kind: 'not-owner'; ownerShow: string }
  | { kind: 'idle'; state: string; jobId: number }
  | { kind: 'none' }

export interface ResolvePauseOpts {
  send: (cmd: string, args?: object, timeoutMs?: number) => Promise<unknown>
  hostKey?: string
  ownerRef: string
  jobId?: number
  findMirrorTarget?: () => number | undefined
  timeoutMs?: number
}

export declare function resolveAndPauseJob(opts: ResolvePauseOpts): Promise<PauseOutcomeCore>
