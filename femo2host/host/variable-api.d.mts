export declare const VARIABLE_EVENTS: Set<string>;
export interface VariableRecord {
  kind: 'checkpoint' | 'func_result' | 'assign_result'
  jobId?: number
  node?: string
  /** checkpoint 专有：断点位置+label 映射。 */
  checkpoints?: unknown
  /** checkpoint 专有：变量世界整包——仅 full 视图外发。 */
  state?: unknown
  /** func/assign 专有：算出/写入的值。 */
  output?: unknown
  /** func/assign 专有：入参全量——仅 full 视图外发。 */
  input?: unknown
  [k: string]: unknown
}
export declare function createVariableApi(opts?: {
  log?: (msg: string) => void
}): {
  handles(eventType: string): boolean
  ingest(eventType: string, data: unknown): VariableRecord | null
  toView(record: VariableRecord, view?: 'brief' | 'full'): VariableRecord
  subscribe(view: 'brief' | 'full', fn: (record: VariableRecord) => void): () => void
}
