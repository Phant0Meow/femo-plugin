/**
 * femogen-files.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

export type FemoFileSource = 'import' | 'export'

/** 清单条目 = 落盘记录（path/name/source/firstSeenAt/lastUsedAt）+ 现算的磁盘状态。 */
export interface FemoFileEntry {
  path: string
  name: string
  source: FemoFileSource
  firstSeenAt: number
  lastUsedAt: number
  exists: boolean
  size?: number
  mtimeMs?: number
}

export declare function rememberFemoFile(femoRoot: string, path: string, source: FemoFileSource): Promise<void>
export declare function listFemoFiles(femoRoot: string): Promise<FemoFileEntry[]>
export declare function forgetFemoFile(femoRoot: string, path: string): Promise<boolean>
export declare function readLedgerFemoFile(femoRoot: string, path: string): Promise<string>
