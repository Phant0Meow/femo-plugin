/**
 * hub-feed-core.mjs 的类型声明（dsh host typecheck/IDE 用；运行时语义见 .mjs 文件头）。
 */

/** 直播帧身份的最小消费面（段引用两字段语义互斥：segRef=宿主自造整键、ref=引擎令牌）。 */
export interface HubFeedBase {
  sid: string
  step?: number
  ref?: string
  segRef?: string
}

/** 流式块的最小消费面（text-delta / reasoning-delta / tool-call-delta）。 */
export interface HubFeedChunk {
  type?: string
  index?: unknown
  text?: unknown
  name?: unknown
  argumentsDelta?: unknown
}

export interface HubFeedCoreOptions {
  /** POST 目标（一般为 `${hubBaseUrl()}/feed`）。 */
  feedUrl: () => string
  /** POST body 的来源标签（懒读 env，可空串）。 */
  source: () => string
  /** 会话寻址地址（'host:sid'，与读侧同一词）。 */
  sessionAddr: (sid: string) => string
}

export interface HubFeedCore {
  /** 场次登记：引擎事件入口每事件刷新；null=停喂 job 寻址路（会话寻址不过这道闸）。 */
  setJob(jobId: number | null): void
  /** 流式块 → 草稿帧。 */
  feedChunk(base: HubFeedBase, chunk: HubFeedChunk): void
  /** 清屏（内容交接/孤儿 attempt）：撤该容器里的草稿，容器留着。 */
  clearBucket(base: HubFeedBase): void
  /** 开宿主轮容器（重复开=先收旧的）；返回段键 'h:<sid>:<seq>'。 */
  hostSegOpen(sid: string, opts: { seq: number | string; turn?: number }): string
  /** 本 sid 当前开着的宿主轮容器；没开就没有。 */
  hostSegCurrent(sid: string): string | undefined
  /** 收口宿主轮（定稿 items 交 hub，同 kind 草稿被吸收、缺的草稿转正兜底）。 */
  hostSegClose(sid: string, items: Array<Record<string, unknown>>): void
  /** 通用 op 喂送口：job 寻址专用（闸门照旧）。 */
  feedOp(op: Record<string, unknown>): void
  /** 行旁挂：会话寻址直投、无戏照喂。 */
  feedRow(sid: string, row: Record<string, unknown>): void
}

export declare function createHubFeedCore(opts: HubFeedCoreOptions): HubFeedCore

/** 戏外行 op（同步组装场景用）：kind 缺省按 role 猜（user→whisper、其余→say）。 */
export declare function outsideRowOp(line: {
  kind?: unknown
  role?: unknown
  actor?: unknown
  text?: unknown
  src_seq?: unknown
}): Record<string, unknown>

/** 喂 hub 一个 POST（同步场景直接用；返回 fetch 原样 Promise，错误处置归调用方）。 */
export declare function postFeedFrames(feedUrl: string, payload: unknown): Promise<Response>

/** 草稿快照帧对（「提交即上墙」词汇单份）：drop 清槽再放全量（幂等）；text 空出 []。 */
export declare function draftDropDeltaFrames(waitKey: string, kind: string, text: unknown): Array<Record<string, unknown>>

/** best-effort POST 带竞速上界（旁路轨专用）：超时不等、失败静默，永不 reject。 */
export declare function postFeedFramesBounded(feedUrl: string, payload: unknown, timeoutMs: number): Promise<void>
