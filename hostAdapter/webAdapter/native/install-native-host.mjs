#!/usr/bin/env node
/**
 * install-native-host.mjs — 原生宿主登记的手动入口（调试/手工重跑用）。
 *
 * 2026-09-29 起登记在本地服务每次启动时自动完成（幂等，见 register-core.mjs
 * 文件头）——日常不再需要本脚本：双击 start-service.cmd 就把登记+启动全办了。
 * 保留它只为两条路：改了 manifest.json 的 key（扩展 ID 变了）之后想立刻重登
 * 记；或不想启动服务、只想把登记写进去。
 *
 * 用法：node install-native-host.mjs
 */

import { registerNativeHost, pinnedExtensionId, HOST_NAME } from './register-core.mjs';

try {
  const extId = pinnedExtensionId();
  const sum = registerNativeHost();
  console.log(`已登记原生消息宿主 ${HOST_NAME}`);
  console.log(`  扩展 ID（manifest.json key 钉死，任何机器/Chrome·Edge 同值）：${extId}`);
  if (sum.compiled) console.log('  已编译 web-launcher.exe');
  console.log(`  host manifest：${sum.hostManifestPath}`);
  console.log(`  node 提示文件：${sum.nodeHint}`);
  console.log('  → 侧栏「一键启动本地服务」现在可用；扩展页里的 ID 应与上面一致。');
} catch (e) {
  console.error(`登记失败：${e?.message ?? e}`);
  process.exit(1);
}
