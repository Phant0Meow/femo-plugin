/**
 * tools-core.mjs 的类型声明（dsh host typecheck 用；
 * 运行时语义见 .mjs 文件头注释）。
 */

import type { DebugRunCollect, DebugSpawnProc } from './debug-run-core.mjs'

/** 工具规格（name/description/parameters——给模型看的面）。 */
export interface FemoToolSpec {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export declare function buildToolSpecs(opts: { host: 'dsh' | 'zcode'; possess?: boolean }): FemoToolSpec[]
export declare function normalizeChronicaOpts(args: Record<string, unknown>): {
  show?: number
  list?: number
  scope?: boolean
  full?: boolean
}
export declare function chronicaCliArgs(opts: { show?: number; list?: number; scope?: boolean; full?: boolean }): string[]
export declare function validateSoulCreate(args: Record<string, unknown>): string | null

/** 挂载状态（运行时内一份）。 */
export interface MountState {
  get(): { femoText: string; scriptPath?: string; baseDir?: string; scriptName: string } | undefined
  mountFromPath(scriptPath: unknown): { error: string } | null
  mountFromText(femoText: string): void
  clear(): void
}
export declare function createMountState(): MountState

/** 直连桥形态的工具执行体（zcode 用）。femo_possess 仅在注入 possess 能力时存在。 */
export interface BridgeToolImpls {
  mounts: MountState
  femo_mount(args: Record<string, unknown>): Promise<Record<string, unknown>>
  femo_run(args: Record<string, unknown>): Promise<Record<string, unknown>>
  femo_script(args: Record<string, unknown>): Promise<Record<string, unknown>>
  femo_soul(args: Record<string, unknown>): Promise<Record<string, unknown>>
  femo_chronica(args: Record<string, unknown>): Promise<Record<string, unknown>>
  femo_debug(args: Record<string, unknown>): Promise<Record<string, unknown>>
  femo_possess?(args: Record<string, unknown>): Promise<Record<string, unknown>>
}

/** 附身能力注入（femo_possess 用；宿主提供本会话身份/演出态/名册联动）。 */
export interface PossessCapability {
  selfSid(): string | undefined
  running(): boolean
  announce?(sid: string, soulName: string): void
}

export declare function createBridgeToolImpls(opts: {
  ensureBridge(): Promise<void>
  send(cmd: string, args?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
  femoRoot: string
  /** 宿主自称（femo_possess 的 target host 缺省值；漏声明补于 09-25 dsh 接入时）。 */
  host?: string
  hostRef: string
  spawnPython(cliArgs: string[], timeoutMs: number): Promise<{ output: string; exitCode: number }>
  debugSpawnProc: DebugSpawnProc
  onProgress?(msg: string): void
  runNextHint?: string
  mounts?: MountState
  possess?: PossessCapability
}): BridgeToolImpls

export type { DebugRunCollect }
