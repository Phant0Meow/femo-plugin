/**
 * bridge.mjs — 常驻引擎的网页版宿主绑定（直连客户端薄壳，2026-09-26 第3步）。
 *
 * 常驻化第 3 步「适配器直连」：本适配器不再生 Python 桥子进程——直连常驻引擎
 * femo_daemon.py 的三个 HTTP 面。协议机唯一活在 femo2host/host/daemon-client.mjs
 * （公共层，zcode/dsh 同吃），本文件只剩本宿主特有的一件事：宿主自称与清单
 * 路径的注入（+推送户门铃：收件口=本地服务 HTTP，端口经 FEMO_PUSH_PORT env——
 * 入口层构造客户端前已定型，这里拼成 pushUrl 交心跳续期，旧 spawn env 随桥退役）。
 *
 * 宿主自称 web：投影中心来源标签（[web] 行头）、驿站 target_host、
 * 段键命名空间都用它——与 web.host.manifest.json 的 host 字段必须同词。
 * 数据根：FEMO_DATA_DIR 优先（入口层已设好沙盒），daemon 的 --db 随之进沙盒
 * ——三通道（DB/信箱/投影）同根，缺一即漏（femo2host 沙盒铁律）。
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// 公共层静态导入（适配器在仓库内位置固定：../../femo2host/；零构建直跑，
// 禁止顶层 await 的动态探测——zcode 侧 2026-09-22 实锤 SyntaxError）。
import { DaemonClient } from '../../../femo2host/host/daemon-client.mjs';
import { resolveFemoRoot } from '../../../femo2host/femoRoot.mjs';

/** 适配器根（本文件所在目录的上一级 = 适配器根；bridge.mjs 住 server/ 子目录）。 */
export const ADAPTER_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** femoRoot（引擎根）：解析逻辑唯一活在 femo2host/femoRoot.mjs；
 *  FEMO_ROOT env 显式重定向优先（如指向开发仓与其他宿主共用引擎）。 */
export const REPO_ROOT = (process.env.FEMO_ROOT || resolveFemoRoot(ADAPTER_ROOT)).replace(/[\\/]+$/, '');

/** 宿主自称（与 web.host.manifest.json 的 host 字段同词，勿单改一处）。 */
export const HOST_NAME = 'web';

/** 驿站收件口路径（服务端路由同吃这一份；mail_courier.push_url_from_env 写死，勿改）。 */
export const PUSH_PATH = '/femo-plugin/mailbox-push';

/**
 * 常驻引擎直连客户端（对外接口 = 旧 BridgeClient：start/send/stop/alive/
 * onEvent/onExited…）。
 * @param {object} [opts]
 * @param {string}   [opts.python]      Python 可执行名/路径（缺省 FEMO_PYTHON env > 'python'）
 * @param {string}   [opts.femoRoot]    引擎根（缺省 = 仓库根）
 * @param {string}   [opts.hostManifestPath] 宿主清单（缺省 = 适配器根 web.host.manifest.json）
 * @param {(eventType: string, data: unknown) => void} [opts.onEvent] 引擎事件上抛
 * @param {(line: string) => void}   [opts.onEngineLine] 兼容保留（引擎 stderr 归 daemon 日志）
 * @param {(line: string) => void}   [opts.onEngineStderr] 兼容保留（同上）
 * @param {(msg: string) => void}    [opts.log] 诊断日志
 */
export class FemoBridge extends DaemonClient {
  constructor(opts = {}) {
    const femoRoot = opts.femoRoot ?? REPO_ROOT;
    // 身份双词齐传（host + hostName，dsh/autoclaw 同款姿势）；推送户门铃：
    // FEMO_PUSH_PORT env 由入口层在构造本客户端前写好（收件口=本地服务 HTTP）。
    const pushPort = process.env.FEMO_PUSH_PORT || undefined;
    super({
      femoRoot,
      host: HOST_NAME,
      hostName: HOST_NAME,
      hostManifestPath: opts.hostManifestPath ?? join(ADAPTER_ROOT, 'web.host.manifest.json'),
      dataDir: process.env.FEMO_DATA_DIR || undefined,
      pushUrl: pushPort ? `http://127.0.0.1:${pushPort}${PUSH_PATH}` : undefined,
      python: opts.python,
      onEvent: opts.onEvent,
      onEngineLine: opts.onEngineLine,
      onEngineStderr: opts.onEngineStderr,
      log: opts.log,
    });
  }
}
