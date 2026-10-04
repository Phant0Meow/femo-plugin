/**
 * http.ts — HTTP 小工具箱。
 *
 * 请求体读取 / JSON 响应写出 / SSE 长连接客户端表与广播。纯工具，无业务逻辑，
 * 全插件共用。从 index.ts 原样迁出（2026-08-23 重构）。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** POST /femo-plugin/create-session body. */
export interface CreateSessionBody {
  cwd?: unknown
  femo?: unknown
  scriptPath?: unknown
  /** POST /femo-plugin/run only: the Femo session to play the script on. */
  sessionId?: unknown
  /** POST /femo-plugin/run only: true = 作废 checkpoint 从头跑（缺省带断点续跑）。 */
  reset?: unknown
}

/** POST /femo-plugin/save-script body. */
export interface SaveScriptBody {
  name?: unknown
  content?: unknown
  /** 绝对路径直写（导出流程：用户经系统目录选择器选定目录 + 文件名）。 */
  path?: unknown
  /** 带上则文件写成功后顺写会话FEMO脚本记录 {path, text}（导出/覆盖保存统一
   *  为 mount 同款并存格式，2026-08-30 猫猫拍板）+ 广播 script_changed。 */
  sessionId?: unknown
}

/** Read a JSON request body (empty body tolerated). */
export async function readBody(req: IncomingMessage): Promise<CreateSessionBody> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim().length === 0) return {}
  try {
    return JSON.parse(text) as CreateSessionBody
  } catch {
    return {}
  }
}

/** Write a JSON response. */
export function writeJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

// ── SSE broadcast（femoGen 可视化运行的实时事件通道）───────────────────────
// 【2026-09-22 收口】环/短命帧过滤/replay 标记/心跳/客户端表唯一活在
// femoGenConnector/sse-core.mjs；本文件只剩兼容代理——broadcastSse 的 8 个
// 消费方 import 零改动。注意：本代理只直推不入环（入环由 engine-events 的
// rememberEvent 显式负责，二者是既有两步，勿合并否则同帧记两次）。
// 【2026-09-25 清淤】sseClients 兼容别名已删（全仓零消费方）。

import { sseChannel } from './sse'

/** 向所有 SSE 客户端广播一个事件（画布可视化运行按 node_name 匹配节点）。
 *  只直推在场端；入环由调用方 rememberEvent 显式负责（环语义在公共层）。 */
export function broadcastSse(eventType: string, data: unknown): void {
  sseChannel.pushLive(eventType, data)
}
