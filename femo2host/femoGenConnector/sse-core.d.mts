/**
 * sse-core.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs 文件头）。
 */

/** 帧编解码器：把 (type, data, replay) 编成 SSE 帧字符串。
 *  dsh 缺省 = `data: {...}\n\n`；zcode = 具名事件 `event: <type>\ndata: {...,ts}\n\n`。 */
export interface SseFrameCodec {
  encode(type: string, data: unknown, replay: boolean): string
}

export interface SseChannelOpts {
  /** 重放环容量（缺省 400，dsh v8.1 定值）。 */
  cap?: number
  /** 帧编解码（缺省 dsh 形状）。 */
  codec?: SseFrameCodec
  /** 心跳间隔 ms（缺省 15000）。 */
  heartbeatMs?: number
  log?(msg: string): void
}

/** SSE 写入端外形（node ServerResponse 的鸭子类型子集）。 */
export interface SseWriter {
  write(chunk: string): unknown
  on?(event: string, cb: (...args: unknown[]) => void): unknown
}

export interface SseChannel {
  /** 引擎事件入环（短命帧 femo_stream/ai_token/step 自动跳过；checkpoint 原地替换）。 */
  remember(eventType: string, data: unknown): void
  /** 现场广播：入环 + 直推在场客户端（不带 replay 标记）。 */
  broadcast(eventType: string, data: unknown): void
  /** 只直推不入环（宿主自己管环的兼容模式——dsh http.ts broadcastSse 代理用）。 */
  pushLive(eventType: string, data: unknown): void
  /** 新客户端接入：环内补帧（打 replay 标记）+ 心跳托管。返回断开清理函数。 */
  connect(res: SseWriter): () => void
  clientCount(): number
  ringSize(): number
}

export function createSseChannel(opts?: SseChannelOpts): SseChannel
