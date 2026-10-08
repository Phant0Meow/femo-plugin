/**
 * engine-gateway.ts — 画布直连引擎的 dsh 网关（刀3，2026-10-05「画布直连引擎」）。
 *
 * 画布改为常驻引擎的一等客户端（事件流/校准/观演直连引擎 HTTP 面，观察者身份
 * 全收）；dsh 从「转播邮局」退回两件薄插座：
 *
 * ① GET /femo-plugin/engine-base —— 引擎地址发现：自发现账+探活双验
 *    （probeDaemon，只读不代拉——显示面不指挥）。活→{ok,base,host,relay}；
 *    死→{ok:false}。画布每次（重）连前现问（引擎代拉重生可能换端口），不写
 *    死端口（公共层既有纪律）。
 * ② /femo-plugin/engine-relay/* —— 透明转发后备：逐字节转引擎的 SSE 事件流
 *    与画布会直发的命令，不解帧、不加闸、不盖章——画布讲的始终是引擎协议，
 *    管子谁拉都行。两个用场：dsh 聊天窗 webview 若有内容安全策略拦跨源连接
 *    （门0 探针，画布侧「从未打开成功就切转发」自动降级），以及未来远程打开
 *    的画布。观察者身份/Last-Event-ID 等查询串原样透传（断点续传随字节流工作）。
 *
 * 转发只对画布消费的命令词表开门（list_jobs/get_job_state/job_pause/
 * job_resume/human_input）——网关不是任意代理，无鉴权服务的攻击面不给大。
 */

import { request as httpRequest } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config'
import { writeJson } from '../http'
import { probeDaemon } from '../../../../femo2host/host/daemon-client.mjs'
import { hostAddr } from '../hub/hub-feed'

const ENGINE_RELAY_ROOT = '/femo-plugin/engine-relay'

/** 画布会直发的命令词表（engine-client.mjs 的消费面；新增命令在此同步）。 */
const RELAY_CMDS = ['list_jobs', 'get_job_state', 'job_pause', 'job_resume', 'human_input']

/** 逐字节转发（不解帧不改写）。SSE 长连接：观众走了就拆上游订阅。 */
function forward(
  res: ServerResponse,
  base: string,
  pathWithQuery: string,
  method: 'GET' | 'POST',
  body?: Buffer,
  clientReq?: IncomingMessage,
): void {
  const u = new URL(base + pathWithQuery)
  const up = httpRequest(
    {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': body.length } : {},
    },
    (upRes) => {
      const headers = { ...upRes.headers }
      delete headers['transfer-encoding']   // node 按自身输出重开 chunked，SSE 不受扰
      res.writeHead(upRes.statusCode ?? 502, headers)
      upRes.pipe(res)
    },
  )
  up.on('error', () => {
    if (!res.headersSent) writeJson(res, 502, { ok: false, error: 'engine unreachable' })
    else res.end()
  })
  if (body !== undefined) up.write(body)
  up.end()   // 无体的 GET 也必须收尾——不 end 请求根本不发出去（夹具实测抓到的坑）
  clientReq?.on('close', () => { try { up.destroy() } catch { /* 已结束 */ } })
}

/** 查询串原样截取（?observer=…&since=… 全透传）。 */
function queryOf(req: IncomingMessage): string {
  const raw = req.url ?? ''
  const i = raw.indexOf('?')
  return i >= 0 ? raw.slice(i) : ''
}

/** 网关注册（routes 总装调用；webServer 缺席时调用方 no-op）。 */
export function registerEngineGateway(
  resolved: ResolvedConfig,
  register: (spec: { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void }) => void,
): void {
  register({
    kind: 'exact',
    path: '/femo-plugin/engine-base',
    handler: (_req, res) => {
      void (async () => {
        const info = await probeDaemon(resolved.femoRoot).catch(() => null)
        if (!info) {
          writeJson(res, 200, { ok: false })
          return
        }
        writeJson(res, 200, { ok: true, base: info.base, relay: ENGINE_RELAY_ROOT, host: hostAddr() || 'dsh' })
      })().catch(() => writeJson(res, 200, { ok: false }))
    },
  })

  register({
    kind: 'exact',
    path: `${ENGINE_RELAY_ROOT}/events`,
    handler: (req, res) => {
      void (async () => {
        const info = await probeDaemon(resolved.femoRoot).catch(() => null)
        if (!info) {
          writeJson(res, 200, { ok: false, error: 'engine offline' })
          return
        }
        forward(res, info.base, `/engine/events${queryOf(req)}`, 'GET', undefined, req)
      })().catch(() => { if (!res.headersSent) writeJson(res, 502, { ok: false }) })
    },
  })

  for (const cmd of RELAY_CMDS) {
    register({
      kind: 'exact',
      path: `${ENGINE_RELAY_ROOT}/cmd/${cmd}`,
      handler: (req, res) => {
        void (async () => {
          const info = await probeDaemon(resolved.femoRoot).catch(() => null)
          if (!info) {
            writeJson(res, 200, { ok: false, error: 'engine offline' })
            return
          }
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = Buffer.concat(chunks)
          forward(res, info.base, `/cmd/${cmd}`, 'POST', body.length > 0 ? body : Buffer.from('{}', 'utf8'), req)
        })().catch(() => { if (!res.headersSent) writeJson(res, 502, { ok: false }) })
      },
    })
  }
}
