/**
 * bridge-client.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

/** 子进程外形（node child_process 的协议子集；dsh 的 SubprocessHandle 由
 *  适配壳补齐 .on('exit'/'error') 后注入）。 */
export interface BridgeChild {
  stdout: { on(event: 'data', cb: (chunk: Buffer) => void): unknown }
  stderr: { on(event: 'data', cb: (chunk: Buffer) => void): unknown }
  stdin: { write(payload: string, cb?: (error?: Error | null) => void): unknown }
  on(event: 'exit', cb: (code: number | null, signal: string | null) => void): unknown
  on(event: 'error', cb: (error: Error) => void): unknown
  pid?: number
  kill(): unknown
  exitCode: number | null
  once(event: 'exit', cb: () => void): unknown
}

export interface BridgeClientOpts {
  spawnProc(spec: { argv: string[]; cwd: string; env: Record<string, string> }): BridgeChild
  argv?: string[]
  cwd?: string
  env?: Record<string, string>
  onEvent?(eventType: string, data: unknown): void
  onEngineLine?(line: string): void
  onEngineStderr?(line: string): void
  onParseFail?(line: string): void
  log?(msg: string): void
}

export declare class BridgeClient {
  constructor(opts: BridgeClientOpts)
  /** 子类/延迟装配可改写的 spawn 三要素（dsh 适配壳在 subprocess 服务就绪后赋值再 start）。 */
  spawnProc: BridgeClientOpts['spawnProc']
  argv: string[]
  cwd: string | undefined
  env: Record<string, string>
  onExited: ((outcome: { code: number | null; signal: string | null }) => void) | undefined
  get alive(): boolean
  start(): void
  send(cmd: string, args?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
  stop(): Promise<void>
  protected onData(chunk: Buffer): void
}

export declare function sendActorFailure(
  bridge: BridgeClient, jobId: number, waitKey: string, kind: string, detail: string,
): Promise<unknown>
