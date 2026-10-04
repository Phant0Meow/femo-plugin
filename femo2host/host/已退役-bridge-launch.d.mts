/**
 * bridge-launch.mjs 的类型声明（dsh host typecheck/IDE 用；运行时语义见 .mjs 文件头）。
 */

export declare function bridgePythonPath(femoRoot: string): string

export declare function resolvePythonPath(explicit?: string): string

export interface BridgeLaunchOpts {
  femoRoot: string
  hostManifestPath?: string
  host?: string
  hostName?: string
  dataDir?: string
  pushPort?: string | number
}

export declare function buildBridgeLaunch(opts: BridgeLaunchOpts): {
  argv: string[]
  env: Record<string, string>
}

export declare function nodeSpawnProc(pythonPath: string): (spec: { argv: string[]; cwd?: string; env?: Record<string, string> }) => unknown

export declare function ensureBridgeReady(
  bridge: { alive: boolean; start(): unknown; send(cmd: string, args?: unknown, timeoutMs?: number): Promise<unknown> },
  opts?: { attempts?: number; delayMs?: number; pingTimeoutMs?: number },
): Promise<void>
