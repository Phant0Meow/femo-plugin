/**
 * mailbox-push-core.mjs 的类型声明（dsh host typecheck/IDE 用；运行时语义见 .mjs 文件头）。
 */

export interface PushLetter {
  id?: string
  job_id?: unknown
  kind?: string
  subkind?: string
  payload?: unknown
  ref?: string | null
  [key: string]: unknown
}

export interface PushBrief {
  wait_key?: unknown
  source?: unknown
  node_name?: unknown
  actor_name?: unknown
  scope_info?: unknown
  blocks?: unknown
  scope?: unknown
  [key: string]: unknown
}

export type PushDecision =
  | { kind: 'stop'; jobId: number; outcome: 'finished' | 'failed' | 'paused'; detail?: string; letters: unknown[] }
  | { kind: 'stop-invalid'; outcome: string | undefined; jobId: number | undefined }
  | { kind: 'play-start'; jobId: number | undefined; text: string }
  | { kind: 'node-retry'; waitKey: string; feedback: string; attempt: number; actorName: string; jobId?: number }
  | { kind: 'retry-invalid' }
  | { kind: 'interjection'; mainSid: string; text: string }
  | { kind: 'interjection-invalid' }
  | { kind: 'brief-main'; ref: string; jobId: number; brief: PushBrief }
  | { kind: 'brief-actor'; ref: string; jobId: number; brief: PushBrief }
  | { kind: 'brief-human'; ref: string; jobId: number; brief: PushBrief }
  | { kind: 'brief-invalid' }
  | { kind: 'letters-only'; count: number }

export declare function decidePush(body: Record<string, unknown>): PushDecision
