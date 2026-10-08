/**
 * engine-bind.mjs — 常驻引擎直连绑定（ZCode 侧薄壳；2026-09-28 正名，前身
 * bridge-manager.mjs/FemoBridge——「桥」已随 2026-09-26 常驻化退役，旧名在撒谎）。
 *
 * 常驻化第 3 步「适配器直连」：ZCode 不再生 Python 桥子进程——直连常驻引擎
 * femo_daemon.py 的三个 HTTP 面（发令 /cmd、订阅 /engine/events、自取户无门铃）。
 * 协议机唯一活在 femo2host/host/daemon-client.mjs（公共层，autoclaw 同吃），
 * 本文件只剩 ZCode 特有的三件事：
 *   - 引擎根/插件根解析（唯一出处=../paths.mjs）；
 *   - ZCode 自称与清单路径的注入（host='zcode'，身份双词同词）；
 *   - 沙盒数据根透传（FEMO_DATA_DIR 才带 --db，桥启动三件套同语义）。
 *
 * 接口与旧 BridgeClient 形对齐（start/send/stop/alive/onEvent/onExited）。语义
 * 差异见 daemon-client.mjs 文件头：stop() 只断自己不发 shutdown——关窗戏演完
 * （金标准①），引擎常驻站岗。
 */

import { join } from 'node:path';
import { PLUGIN_ROOT, findFemoRoot, importCore } from '../paths.mjs';

export { PLUGIN_ROOT };

const { DaemonClient } = await importCore('daemon-client.mjs');

/** femoRoot（引擎根）：解析逻辑唯一活在 femo2host/femoRoot.mjs（paths.mjs 归拢）。 */
export const REPO_ROOT = findFemoRoot();

/**
 * 常驻引擎直连客户端（对外接口与原 FemoBridge 一致：start/send/stop/alive/
 * onEvent/onEngineLine/onEngineStderr/log/onExited）。
 * @param {object} opts
 * @param {string}   [opts.python]      Python 可执行名/路径
 * @param {string}   [opts.femoRoot]    引擎根（缺省 = 仓库根，自包含布局）
 * @param {string}   [opts.hostManifestPath] 宿主清单（缺省 = zcodeAdapter/zcode.host.manifest.json）
 * @param {(eventType: string, data: unknown) => void} [opts.onEvent] 引擎事件上抛
 * @param {(line: string) => void}   [opts.onEngineLine] 兼容保留（引擎 stderr 归 daemon 日志）
 * @param {(line: string) => void}   [opts.onEngineStderr] 兼容保留（同上）
 * @param {(msg: string) => void}    [opts.log] 诊断日志
 */
export class ZcodeDaemonClient extends DaemonClient {
  constructor(opts = {}) {
    const femoRoot = opts.femoRoot ?? REPO_ROOT;
    super({
      femoRoot,
      host: 'zcode',
      hostName: 'zcode', // 2026-09-24 A4：身份双词齐传（dsh 同款姿势）
      hostManifestPath: opts.hostManifestPath ?? join(PLUGIN_ROOT, 'zcode.host.manifest.json'),
      dataDir: process.env.FEMO_DATA_DIR || undefined, // 沙盒策略：FEMO_DATA_DIR 在才 --db（缺省共享数据根，多实例=多宿主拍板）
      python: opts.python,
      onEvent: opts.onEvent,
      onEngineLine: opts.onEngineLine,
      onEngineStderr: opts.onEngineStderr,
      log: opts.log,
    });
  }
}
