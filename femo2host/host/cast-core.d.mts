/**
 * cast-core.d.mts — 会话↔角色选角账·宿主侧客户端类型（正身见 cast-core.mjs）。
 */

export interface CastEntryView {
  sid: string
  host?: string
}

export interface CastPreferencesView {
  ok: true
  bindings: Record<string, CastEntryView>
  hosts: Record<string, Record<string, { soul: string }>>
}

export declare function readJobCast(femoRoot: string, jobId: number): Promise<Record<string, CastEntryView>>
export declare function putJobCastEntry(femoRoot: string, jobId: number, soulId: string, sid: string, host?: string): Promise<unknown>
export declare function snapshotJobCast(femoRoot: string, jobId: number): Promise<number>
export declare function preferenceSet(femoRoot: string, host: string, sid: string, soul: string | null): Promise<{ ok: boolean; error?: string }>
export declare function preferencesView(femoRoot: string, scope?: 'all' | 'online'): Promise<CastPreferencesView>
