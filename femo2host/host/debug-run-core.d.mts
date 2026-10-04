/**
 * debug-run-core.mjs 的类型声明（dsh host typecheck 用；
 * 运行时语义见 .mjs 文件头注释）。
 */

/** 一次干跑请求（两条路径共用）。 */
export interface DebugRunRequest {
  /** 脚本文本（挂载版/编辑器版——由调用方决定取哪一份）。 */
  femo: string
  /** 脚本原路径：file: 相对引用按它所在目录解析；缺省回退沙盒目录。 */
  scriptPath?: string
  /** 只干跑某 module（点路径）；缺省整个脚本。 */
  module?: string
  /** 跑几轮（每轮换种子）；缺省 1，钳到 1~20。 */
  runs?: number
  /** 起始种子（可复现）；缺省由调试器随机。 */
  seed?: number
  /** 看门狗上限（毫秒）；缺省 180s。 */
  timeoutMs?: number
}

/** 终报里的一轮结局（femo_debugger --report 的 runs 元素）。 */
export interface DebugReportRun {
  seed: number
  outcome: string
  error: string | null
  elapsed: number
}

/** 变量赋值快照（old/new 已是调试器侧 repr 字符串）。 */
export interface DebugVarSnapshot {
  node: string
  var: string
  old: unknown
  new: unknown
}

/** femo_debugger --report 写出的 JSON 终报形状（字段名即协议，snake_case）。 */
export interface DebugRunReport {
  script: string
  module_mode: string | null
  runs: DebugReportRun[]
  node_visits: Record<string, number>
  node_order: string[]
  edges_taken: string[]
  total_edges: number
  var_snapshots: DebugVarSnapshot[]
  guess_warnings: string[]
  silences: string[]
  flaky_fired: string[]
  unreached_nodes?: string[]
  module_has_out?: boolean | null
}

/** 整跑收集结果（femo-debug 工具的数据面）。 */
export interface DebugRunCollect {
  exitCode: number
  timedOut: boolean
  aborted: boolean
  runs: number
  seed?: number
  elapsedMs: number
  records: Array<Record<string, unknown>>
  report?: DebugRunReport
  transcript: string
  transcriptDropped: number
  partialPath?: string
  stderr: string
  sandboxScript: string
  logPath: string
  reportPath: string
}

/** 宿主 spawn 适配器契约：argv 已含 python 可执行；terminate 必须能杀
 *  整棵进程树；done 在进程退出后 settle。 */
export interface DebugSpawnProc {
  (spec: {
    argv: string[]
    cwd: string
    env: Record<string, string>
    onStderrLine?(line: string): void
    onStdoutChunk?(text: string): void
  }): {
    done: Promise<{ exitCode?: number } | undefined>
    terminate(): void
  }
}

/** 沙盒装配结果。 */
export interface DebugSandbox {
  sandboxScript: string
  logPath: string
  reportPath: string
}

export declare const DEBUG_TIMEOUT_MS: number
export declare function clampRuns(value: unknown): number
export declare function normalizeSeed(value: unknown): number | undefined
export declare function normalizeModule(value: unknown): string | undefined
export declare function acquireDebugRun(): boolean
export declare function releaseDebugRun(): void
export declare function prepareDebugSandbox(femoRoot: string, req: { femo: string }): Promise<DebugSandbox>
export declare function buildDebuggerArgv(opts: {
  femoRoot: string
  sandbox: DebugSandbox
  req: { scriptPath?: string }
  runs?: number
  seed?: number
  module?: string
}): Promise<{ argv: string[]; note?: string }>
export declare function collectDebugRun(opts: {
  femoRoot: string
  spawnProc: DebugSpawnProc
  req: DebugRunRequest
  signal?: AbortSignal
  onProgress?(msg: string): void
  timeoutMs?: number
}): Promise<DebugRunCollect>
export declare function formatDebugRecordLine(rec: Record<string, unknown>): string | null
export declare function debugTranscriptLines(records: Array<Record<string, unknown>>): { lines: string[]; dropped: number }
export declare function debugRunToolOutcome(result: DebugRunCollect): { ok: true; text: string } | { ok: false; error: string }
