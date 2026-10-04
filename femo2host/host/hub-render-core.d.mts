/**
 * hub-render-core.mjs 的类型声明（dsh client/host typecheck 用；运行时语义见 .mjs 文件头）。
 */

export interface WaitingLike {
  actor?: string
  scope?: unknown[]
  out_vars?: unknown[]
  views?: unknown[]
  [key: string]: unknown
}

export declare function composerAllowedFor(view: unknown, waiting: WaitingLike | null | undefined): boolean

export declare function seatWho(waiting: WaitingLike | null | undefined): string

export declare function hasOutVars(waiting: WaitingLike | null | undefined): boolean

/** 人类席交卷拼装（唯一一份）：全空 → {error}；否则 {text, variables}。 */
export declare function composeHumanSubmission(textRaw: unknown, variables: unknown):
  { error: string } | { error?: undefined; text: string; variables: Record<string, string> }

export interface MetaRow {
  label?: string
  tone?: 'gold' | 'end'
  plain?: boolean
  error?: boolean
}
export declare function metaRowOf(kind: string | undefined): MetaRow | undefined

export declare function isBannerKind(kind: string | undefined): boolean

export interface RenderItem {
  kind?: string
  text?: string
  name?: string
  toolCall?: { name?: string; arguments?: string }
  toolResult?: { node?: string; output?: string }
  orphan?: boolean
  pairedOutput?: unknown
  [key: string]: unknown
}
export declare function pairToolSlots(items: RenderItem[] | undefined | null): RenderItem[]
