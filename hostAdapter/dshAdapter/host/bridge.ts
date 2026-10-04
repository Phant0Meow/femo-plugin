/**
 * bridge.ts — DSH 侧引擎绑定（常驻引擎直连，2026-09-26 第3步；薄壳）。
 *
 * 常驻化第 3 步「适配器直连」：DSH 不再生 Python 桥子进程——直连常驻引擎
 * femo_daemon.py 的三个 HTTP 面（发令 /cmd、订阅 /engine/events、门铃
 * /engine/doorbell）。协议机唯一活在 femo2host/host/daemon-client.mjs
 * （公共层，zcode 同吃），本文件只剩 DSH 特有的接线：
 *  ① 身份装配：信箱宿主 id（dsh-<port>，2026-09-24 多实例并存）+ 投影自称
 *     （FEMO_HOST_NAME env / 清单 host 字段）——双词齐传；
 *  ② 推送户门铃：驿站收件口（mailbox-push 监听器）端口经 pushUrl 交客户端
 *     心跳续期（旧世界 FEMO_PUSH_PORT spawn env 由门铃注册表取代）；
 *  ③ 诊断挂钩：事件进诊断流 + emit 插座（index.ts 事后注入）。
 * 对外接口（FemoBridge/start(ctx,config)/send/stop/alive/pushPort/onExited/
 * sendActorFailure）与原版完全一致——index.ts/engine-events/routes/tools/
 * bridge-supervisor 零改动换芯。语义差异（常驻化的本意，见 daemon-client 文件头）：
 * stop() 只断自己不发 shutdown——引擎常驻站岗，关窗戏演完（金标准①）；引擎
 * print/stderr 归 daemon 日志文件（<数据根>/projection/logs/femo_daemon.log），
 * 不再流经本进程。C1 监督（bridge-supervisor）语义保留：daemon 换家（pid 变）
 * 触发 onExited → 清账 → ping 轮询 → 重建索引（start 重入安全，幂等）。
 */

import type { Context } from '@deepseek-ai/cordis'
import { readFileSync } from 'node:fs'
import { pushDiag } from './diag/diag-feed'
import { DaemonClient } from '../../../femo2host/host/daemon-client.mjs'

/** 宿主自称：读本地能力清单（host.manifest.json）的 `host` 字段——'dsh' / 'zcode'。
 *  它就是投影中心的**来源标签**（多宿主共演同一次时，行/段键/信任集都按它分
 *  命名空间，2026-09-19 联机改造）。读不到就空串，hub 退回单来源老行为。 */
function hostNameOf(manifestFile: string): string {
  try {
    const data = JSON.parse(readFileSync(manifestFile, 'utf8')) as { host?: unknown }
    const h = typeof data.host === 'string' ? data.host.trim() : ''
    return h
  } catch {
    return ''
  }
}

/** 信箱宿主 id（驿站 target_host / 归属闸的同一把尺）：检测到 dsh web
 *  进程的 `--port <N>`（两个版本的启动脚本都带）时派生 `dsh-<N>`，多实例并存
 *  时各认各的信、互不抢餐（2026-09-24 双桥抢信事故：3081/3083 并存、两桥都用
 *  默认 'dsh'，台词信被对方桥捞走 → job_not_active 静默吞答案 → 运行卡死）。
 *  检测不到端口回退 'dsh'（单实例/旧形态零感知）。注意这只管「信箱信」这一张
 *  身份——投影来源标签（hostNameOf）与名册/绑定面是另外的身份平面，刻意不动。 */
export function mailboxHostIdOf(argv: string[] = process.argv): string {
  const i = argv.indexOf('--port')
  const port = i >= 0 ? argv[i + 1] : undefined
  return port !== undefined && /^\d+$/.test(port) ? `dsh-${port}` : 'dsh'
}

/** 宿主执行体最终失败信号（B5）：正身唯一活在公共层 daemon-client.mjs（2026-09-26
 *  随常驻化迁入；当时 dsh 这份本地逐字副本漏拆，2026-09-29 退役）——一行再导出
 *  保消费面零改动（dispatch/main/native/mailbox-push 仍从 ../bridge 取）。 */
export { sendActorFailure } from '../../../femo2host/host/daemon-client.mjs'

export class FemoBridge {
  /** 驿站投递员上门端口（index.ts 起好收件口后注入；undefined=自取模式）。
   *  直连后换形为门铃 URL 交 daemon 注册表（每 10s 心跳，TTL 30s 过期留柜）。 */
  pushPort?: number

  /** 投影事件插座（index.ts 事后注入 `(bridge as any).emit = ...`）。 */
  emit?: (name: string, ...args: unknown[]) => void

  /** 引擎半路死亡回调（bridge-supervisor 的 C1 自愈接线点）。 */
  onExited?: () => void

  private client?: DaemonClient

  constructor() {}

  get alive(): boolean {
    return this.client?.alive ?? false
  }

  /** 发命令（与原 BridgeClient.send 同形同义：resolve=result、reject=Error）。 */
  send(cmd: string, args?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    const client = this.client
    if (client === undefined) return Promise.reject(new Error('bridge not running'))
    return client.send(cmd, args, timeoutMs)
  }

  /** 装配并连上常驻引擎（原签名不变；重入安全——C1 respawn 幂等）。
   *  旧世界的 subprocess 服务 spawn 退役；dsh 配置的 python 仍经 subprocess
   *  服务解析成绝对路径（解析不到就回落原词，daemon 侧 spawn 再兜 FEMO_PYTHON/
   *  'python' 并响亮报错）。 */
  start(ctx?: Context, config?: { python: string; femoRoot: string; hostManifest: string }): void {
    if (this.alive) return
    if (config === undefined) {
      throw new Error('femo-plugin: bridge.start(config) is required')
    }
    // 宿主自称（清单 host 字段）：写进本进程 env，hub-feed 按同一个词报来源。
    // 【2026-09-24 多实例】config.ts 按端口把 env 定成 dsh-<port>（本进程 TS 侧
    // 读取方已统一走 env）；env 没有才回落清单 host 字段（单实例老形态）。
    const hostName = process.env.FEMO_HOST_NAME?.trim() || hostNameOf(config.hostManifest)
    if (hostName !== '') process.env.FEMO_HOST_NAME = hostName
    const mailboxHostId = mailboxHostIdOf()
    console.log(`[femo-plugin] bridge mailbox host id = ${mailboxHostId}`)
    void this.connect(ctx, config, hostName, mailboxHostId)
  }

  private async connect(
    ctx: Context | undefined,
    config: { python: string; femoRoot: string; hostManifest: string },
    hostName: string,
    mailboxHostId: string,
  ): Promise<void> {
    // python 解析走 dsh subprocess 服务（可用时）；解析不到回落原词。
    let pythonPath = config.python
    try {
      const subprocess = ctx?.get('subprocess') as {
        resolveExecutable(command: string, env?: Record<string, string>, signal?: AbortSignal): Promise<string>
      } | undefined
      if (subprocess !== undefined) pythonPath = await subprocess.resolveExecutable(config.python)
    } catch (error) {
      console.log(`[femo-plugin] python resolve via subprocess failed (${String(error)}); falling back to '${config.python}'`)
    }
    const client = new DaemonClient({
      femoRoot: config.femoRoot,
      host: mailboxHostId,
      hostName: hostName !== '' ? hostName : mailboxHostId,
      hostManifestPath: config.hostManifest,
      // FEMO_DATA_DIR 刻意不透传 dataDir/--db：数据根共享（多实例连跑同一个
      // Job 的多宿主本意，2026-09-24 用户拍板）；沙盒场景 env FEMO_DATA_DIR
      // 由测试/多实例自设，daemon-client 的发现账路径同一口径读 env。
      python: pythonPath,
      ...(this.pushPort !== undefined
        ? { pushUrl: `http://127.0.0.1:${this.pushPort}/femo-plugin/mailbox-push` }
        : {}),
      onEvent: (eventType, data) => {
        pushDiag('bridge', `event ${eventType} job=${String((data as Record<string, unknown> | undefined)?.job_id ?? '-')}`)
        this.emit?.('femo-plugin/event', eventType, data)
      },
      log: msg => console.log(`[femo-plugin] ${msg}`),
    })
    client.onExited = () => { this.onExited?.() }
    this.client = client
    client.start()
  }

  /** 只断自己：关 SSE/门铃——**不发 shutdown**，常驻引擎继续站岗（金标准①）。
   *  引擎面要按宿主停戏请走运行控制（job_pause），引擎死亡由 daemon 看门自愈。 */
  async stop(): Promise<void> {
    await this.client?.stop()
    this.client = undefined
  }
}
