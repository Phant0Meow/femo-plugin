/** shared/window-id.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。 */

export declare const PROJECTION_WINDOW_PREFIX: string

export declare function parseProjectionWindowId(sessionId: string): { mainSid: string; win: string } | undefined
