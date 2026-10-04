/**
 * notice-core.mjs 的类型声明（dsh host typecheck 用；
 * 运行时语义见 .mjs 文件头注释）。
 */

/** 代取回的通知信（mailbox 信件的宿主侧最小面）。 */
export interface NoticeLetter {
  kind?: string
  payload?: string
  delivery?: string
  subkind?: string
  [key: string]: unknown
}

export type StopOutcome = 'finished' | 'failed' | 'paused'

export declare const STOP_SIGNALS: Set<string>
export declare function isStopSignal(eventType: string): boolean

export declare function formatStopNotice(opts: {
  jobId: number
  outcome: StopOutcome
  detail?: string
  letters?: NoticeLetter[]
  tag?: string
  panelNote?: boolean
}): string

export declare const PLAY_BROADCAST: {
  done: string
  error: (detail: string) => string
  paused: string
}
