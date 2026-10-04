/**
 * state-files.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 * 【2026-09-25】actor-usage 族下推 dshAdapter/host/actor-usage.ts（dsh 私产，
 * 类型随迁真身），此处删声明、只留 withRecordLock（下推件仍公用这一把锁）。
 */

export interface SessionScriptRecord {
  path?: string
  text?: string
  rev?: number
}

export type WriteSessionScriptResult =
  | { ok: true; rev: number }
  | { ok: false; reason: 'conflict'; record: SessionScriptRecord }

export declare function withRecordLock(sessionId: string, fn: () => Promise<void>): Promise<void>

/** host-history/drafts 目录（会话FEMO脚本记录的家；dsh 断电索引重建同吃）。 */
export declare function draftsDirOf(femoRoot: string): string

export declare function setSessionCurrentJob(femoRoot: string, sessionId: string, jobId: number | null): Promise<void>
export declare function readSessionCurrentJob(femoRoot: string, sessionId: string): Promise<number | undefined>
export declare function readSessionJobIds(femoRoot: string, sessionId: string): Promise<number[] | undefined>
export declare function readSessionHost(femoRoot: string, sessionId: string): Promise<string | undefined>
export declare function appendSessionJob(femoRoot: string, sessionId: string, jobId: number): Promise<void>
export declare function appendFemoSession(femoRoot: string, sessionId: string, femoSessionId: number): Promise<void>
export declare function writeSessionScript(
  femoRoot: string,
  sessionId: string,
  record: SessionScriptRecord,
  expectRev?: number,
): Promise<WriteSessionScriptResult>
export declare function readSessionScript(femoRoot: string, sessionId: string): Promise<SessionScriptRecord | undefined>
export declare function readSessionScriptText(femoRoot: string, sessionId: string): Promise<string | undefined>
