/**
 * register-core.mjs — 原生消息宿主登记的唯一实现（install-native-host.mjs 与
 * server/service.mjs 同吃）。
 *
 * 2026-09-29 一键连接改版：未打包扩展的 ID 本按所在文件夹路径散列，换机器/
 * 换文件夹就变，登记（allowed_origins）永远慢一拍——新装机的朋友必须先手工跑
 * 安装器才能用「一键启动」。现在扩展 ID 由 manifest.json 的 key 字段钉死
 * （固定 RSA 公钥派生，任何机器、Chrome/Edge 全同一个 ID），登记内容里机器
 * 相关的只剩两样——web-launcher.exe 的绝对路径、node.exe 的绝对路径，本机
 * 服务自己都知道。于是登记从「新机手工跑一次」改成「本地服务每次启动顺手做」
 * （幂等）：朋友双击一次 start-service.cmd，登记+启动一步到位，侧栏「一键
 * 启动」此后永远可用。install-native-host.mjs 降级为手动重跑入口（改了 key、
 * 或不想启动服务只想登记时用），与本件同吃一份实现。
 *
 * 登记做三件事（原 installer 逐条继承，实测坑全保留）：
 * 1) 写 host manifest JSON（com.femo.web_launcher.json）：allowed_origins 锁
 *    钉死的扩展 ID，type=stdio，path 指向 web-launcher.exe（实测坑：新版
 *    Chromium/Edge 对 Native Messaging 宿主走「可执行文件直启」，.cmd/.bat
 *    批处理壳起不来，扩展只见「Error when communicating with the native
 *    messaging host」；exe 壳把标准句柄显式传给 node 子进程，帧零接触过手）；
 * 2) 编译 web-launcher.exe（csc.exe，.NET Framework 自带；exe 缺或比 .cs 旧
 *    才重编）并写 node.path 提示文件（本机 node 不在系统 PATH 时 exe 靠它找
 *    node——实案：机器上只有 AutoClaw 自带的 node，Chrome 拉起的宿主进程
 *    PATH 里没有它）；
 * 3) 写 HKCU 注册表两处（Chrome 与 Edge 同名键各一处，各写缺省值 = host
 *    manifest 的完整路径，免管理员权限）——实测坑：只登记 Chrome 键时，用户
 *    在 Edge 里用扩展，一键启动报「Access to the specified native messaging
 *    host is forbidden」（浏览器只认自家的键，两家不互通）。
 *
 * 仓库挪窝后 host manifest 里的 exe 路径会失效——服务下次启动自动重写（幂等）。
 * manifest.json 的 key 一动 ID 就变——所有已装机器须重载扩展，服务下次启动
 * 会自动按新 ID 重登记。
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const ADAPTER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HOST_NAME = 'com.femo.web_launcher';

const CSC_CANDIDATES = [
  'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
  'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
];

/** manifest.json 的 key 字段（base64 的 DER 公钥）→ 32 位 a-p 扩展 ID（Chromium 固定算法）。 */
export function extensionIdFromKey(keyB64) {
  const der = Buffer.from(String(keyB64), 'base64');
  return createHash('sha256').update(der).digest('hex').slice(0, 32)
    .split('').map(c => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16))).join('');
}

/** 钉死的扩展 ID：唯一事实源 = manifest.json 的 key 字段。 */
export function pinnedExtensionId(root = ADAPTER_ROOT) {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (!m.key) throw new Error('manifest.json 缺 key 字段——扩展 ID 靠它钉死，登记无从谈起');
  return extensionIdFromKey(m.key);
}

/** 登记全套（幂等，可重复跑）。返回摘要；失败抛错，留痕方式由调用方定。 */
export function registerNativeHost({ root = ADAPTER_ROOT, nodeExe = process.execPath } = {}) {
  const nativeDir = path.join(root, 'native');
  const extId = pinnedExtensionId(root);
  const hostManifestPath = path.join(nativeDir, `${HOST_NAME}.json`);
  const launcherExe = path.join(nativeDir, 'web-launcher.exe');
  const launcherCs = path.join(nativeDir, 'web-launcher.cs');
  const nodeHint = path.join(nativeDir, 'node.path');

  // ── 1) host manifest ──
  // path 指向 web-launcher.exe（批处理壳在新内核上起不来，见文件头实测坑）。
  const manifest = {
    name: HOST_NAME,
    description: 'FEMO 网页座席：按侧栏指令拉起本地服务（node server/service.mjs）。',
    path: launcherExe,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extId}/`],
  };
  fs.writeFileSync(hostManifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  // ── 2) exe 壳：缺或比源码旧就编译；node.path 提示文件同批写 ──
  let compiled = false;
  if (!fs.existsSync(launcherExe) || fs.statSync(launcherExe).mtimeMs < fs.statSync(launcherCs).mtimeMs) {
    const csc = CSC_CANDIDATES.find(p => fs.existsSync(p));
    if (!csc) {
      throw new Error('找不到 csc.exe（.NET Framework 自带），编不了 web-launcher.exe；请装 .NET Framework 4.x 或手动编译后重跑');
    }
    execSync(`"${csc}" /nologo /out:"${launcherExe}" /target:exe "${launcherCs}"`, { stdio: 'pipe' });
    compiled = true;
  }
  fs.writeFileSync(nodeHint, nodeExe + '\n', 'utf8');

  // ── 3) HKCU 注册表（Chrome 与 Edge 双键同登）──
  for (const hive of ['Google\\Chrome', 'Microsoft\\Edge']) {
    execSync(`reg add "HKCU\\Software\\${hive}\\NativeMessagingHosts\\${HOST_NAME}" /ve /d "${hostManifestPath}" /f`, { stdio: 'pipe' });
  }

  return { extId, hostManifestPath, compiled, nodeHint };
}
