/**
 * speech-core.mjs 的类型声明（dsh host typecheck 用；
 * 运行时语义见 .mjs 文件头注释）。
 */

/** 人类席交卷信封（post_speech 参数，body={chat_text, variables?}）。 */
export declare function humanSpeechArgs(opts: {
  jobId: number
  waitKey: string
  soul?: string
  node?: string
  text: string
  variables?: Record<string, string>
}): {
  job_id: number
  wait_key: string
  soul: string
  node?: string
  payload: string
  body: { chat_text: string; variables?: Record<string, string> }
}

/** 读交卷体的台词：steps 末步的 reply；没 steps/没填 = 空串。 */
export declare function lastStepReply(steps: unknown): string

/** 执行体（主演/AI 演员）交卷信封（post_speech 参数，body={steps}——
 *  台词唯一正身=末步 reply，构造时由 output 合并注入；信封上无 output 字段）。 */
export declare function executorSpeechArgs(opts: {
  jobId: number
  waitKey: string
  soul?: string
  node?: string
  output: string
  steps?: unknown
  modelId?: string
}): {
  job_id: number
  wait_key: string
  soul: string
  node?: string
  payload: string
  body: { steps: Array<Record<string, unknown>>; model_id?: string }
}
