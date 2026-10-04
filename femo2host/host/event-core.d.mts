/**
 * event-core.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

/** 幕布落点（dsh 绑会话窗投影；zcode 绑 projection-writer；形态 B 绑桥产公告栏）。 */
export interface EventBoard {
  ensureWindows(actors: string[]): unknown
  chat(text: string, rowOpts: Record<string, unknown>, scopeOpts: { targetActors?: string[] }): unknown
}

/** 【v2.1】分诊账本最小形状（dsh 的 RunState 兼容——镜像值类型各宿主自定，
 *  这里 any 放行 Map 不变性；核心只做登记与读取）。 */
export interface EventCoreStore {
  jobs: Map<number, any>
  sidIndex: Map<string, number>
  activeJobId?: number
}

/** 【v2.1】分拣行的显示裁决（缺省=zcode chat 落行；宿主逐个覆盖）。 */
export interface EventVerbs {
  flowStarted?(d: Record<string, unknown>, playName: string, actors: string[]): unknown
  nodePrompt?(d: Record<string, unknown>, prompt: string, scope?: string[]): unknown
  nodeShowprompt?(d: Record<string, unknown>, showprompt: string, scope?: string[]): unknown
  humanWaiting?(d: Record<string, unknown>, snap: unknown, scope: string[]): unknown
  aiSpoken?(d: Record<string, unknown>, output: string, actor: string, scope?: string[]): unknown
  /** changed=镜像状态本次真变化（宿主的 run_state 广播插座按它发）。 */
  playDone?(d: Record<string, unknown>, changed: boolean): unknown
  playError?(d: Record<string, unknown>, detail: string, changed: boolean): unknown
  playPaused?(d: Record<string, unknown>, changed: boolean): unknown
  authorNotice?(d: Record<string, unknown>, message: string): unknown
}

export interface EventCoreOpts {
  board: EventBoard
  sid?: string
  /** 仅 submitOutput/submitHumanOutput 回传用；不走核心回传的宿主（dsh）可不传。 */
  send?(cmd: string, args?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
  log?(msg: string): void
  /** 【v2.1 接入面】外置账本（多会话宿主注入共享账本；缺省自建）。 */
  store?: EventCoreStore
  /** 【v2.1】事件归属会话解析（dsh 按 Job 镜像反查；缺省恒 sid）。 */
  resolveSid?(jobId: number, d: Record<string, unknown>): string
  /** 【v2.1】分拣行显示裁决覆盖。 */
  verbs?: EventVerbs
  /** 【v2.1】整事件跳过名单（宿主自有语义全接管）。 */
  skip?: string[]
}

export interface WaitingHuman {
  job_id: number | undefined
  wait_key: string
  node_name?: string
  prompt: string
  scope: string[]
}

export interface EventCoreState {
  sid: string
  running: boolean
  playName: string
  actors: string[]
  mainActors: string[]
  waitingHuman: WaitingHuman | undefined
  pendingDirectives: number
}

export declare function createEventCore(opts: EventCoreOpts): {
  handleEvent(eventType: string, data?: Record<string, unknown>): { eventType: string; jobId: unknown }
  takeDirective(): Record<string, unknown> | undefined
  waitDirective(): Promise<Record<string, unknown>>
  pendingDirectiveCount(): number
  head(): Record<string, unknown> | undefined
  takeHead(): Record<string, unknown> | undefined
  submitOutput(jobId: number | undefined, waitKey: string, output: string, steps?: unknown): Promise<unknown>
  submitHumanOutput(jobId: number | undefined, waitKey: string, output: string, soul?: string, variables?: Record<string, string>): Promise<unknown>
  projectUserLine(actorName: string, text: string, scope?: string[]): unknown
  state(): EventCoreState
  _internal: {
    nodeScopes: Map<string, string[]>
    nodeActors: Map<string, string>
    waitingHuman(): WaitingHuman | undefined
    running(): boolean
  }
}
