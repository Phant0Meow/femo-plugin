/**
 * daemon-client.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 * 常驻引擎直连客户端——适配器不再生 Python 桥子进程，直连 femo_daemon.py 三个
 * HTTP 面（/cmd、/engine/events、/engine/doorbell）。
 */

export interface DaemonClientOpts {
  femoRoot: string
  host: string
  hostName?: string
  hostManifestPath?: string
  dataDir?: string
  pushUrl?: string
  python?: string
  onEvent?(eventType: string, data: unknown): void
  onEngineLine?(line: string): void
  onEngineStderr?(line: string): void
  log?(msg: string): void
}

export declare class DaemonClient {
  constructor(opts: DaemonClientOpts)
  femoRoot: string
  host: string
  hostName: string
  hostManifestPath: string
  dataDir: string
  pushUrl: string
  projectionDir: string
  daemonPy: string
  onEvent?: (eventType: string, data: unknown) => void
  onEngineLine?: (line: string) => void
  onEngineStderr?: (line: string) => void
  log: (msg: string) => void
  onExited: ((outcome: { code: number | null; signal: string | null }) => void) | undefined
  get alive(): boolean
  get base(): string
  start(): void
  send(cmd: string, args?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
  /** 只断自己（关 SSE/门铃），不发 shutdown——常驻引擎继续站岗。 */
  stop(): Promise<void>
}

/** 只读探活（不代拉）：数据根指纹 + 引擎面双验正身——客户端 _probe 与
 *  zcode 钩子同吃（2026-09-29 收编导出）。quiet404=旧版 v0 daemon 安静放行。 */
export declare function probeDaemon(
  femoRoot: string,
  opts?: { quiet404?: boolean; timeoutSec?: number },
): Promise<{ base: string; pid: number; health: Record<string, unknown> } | null>

/** 客户端就绪等待（alive 检查 + start + ping 轮询；原 bridge-launch 件迁入）。 */
export declare function ensureBridgeReady(
  bridge: DaemonClient,
  opts?: { attempts?: number; delayMs?: number; pingTimeoutMs?: number },
): Promise<void>

/** 宿主执行体最终失败信号（actor_failed 上报）。只摸客户端的 send 面——
 *  DaemonClient 与 dsh 的 FemoBridge 组合壳同吃（2026-09-29：dsh bridge.ts
 *  的本地逐字副本退役，改为一行再导出本件正身）。 */
export declare function sendActorFailure(
  bridge: { send(cmd: string, args?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> },
  jobId: number, waitKey: string, kind: string, detail: string,
): Promise<void>
