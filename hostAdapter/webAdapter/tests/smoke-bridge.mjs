#!/usr/bin/env node
/**
 * smoke-bridge.mjs — 真桥冒烟（手动运行，沙盒隔离不写生产）。
 *
 * 验证链路：FemoBridge spawn → ping → list_jobs → list_souls →
 * 沙盒落点（FEMO_DATA_DIR 下三通道就位）→ shutdown。
 * 运行：node tests/smoke-bridge.mjs
 */

import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FemoBridge, REPO_ROOT, HOST_NAME } from '../server/bridge.mjs';

// 沙盒：三通道（DB/信箱/投影）随 FEMO_DATA_DIR 全部落进一次性目录。
process.env.FEMO_DATA_DIR = mkdtempSync(join(tmpdir(), 'femo-web-smoke-'));

const events = [];
const bridge = new FemoBridge({
  onEvent: (type, data) => events.push({ type, data }),
  onEngineLine: line => console.log('[engine]', line.slice(0, 160)),
  onEngineStderr: line => console.log('[stderr]', line.slice(0, 240)),
  log: m => console.log('[bridge]', m),
});

console.log(`femoRoot = ${REPO_ROOT}`);
console.log(`host     = ${HOST_NAME}`);
console.log(`dataDir  = ${process.env.FEMO_DATA_DIR}`);

bridge.start();
// 【2026-09-26 常驻化第 3 步】直连后首个 send 会排队等 daemon 就绪（代拉+装配
// 数秒），长超时一次到位即可；send 内部自带惰性代拉。
let ok = true;
try {
  const pong = await bridge.send('ping', {}, 90_000);
  console.log('ping        =>', JSON.stringify(pong).slice(0, 160));

  const jobs = await bridge.send('list_jobs');
  console.log('list_jobs   =>', JSON.stringify(jobs).slice(0, 160));

  const souls = await bridge.send('list_souls');
  console.log('list_souls  =>', JSON.stringify(souls).slice(0, 160));

  const dataDir = process.env.FEMO_DATA_DIR;
  const dbReady = existsSync(join(dataDir, 'femo', 'memory'));
  console.log(`sandbox db dir  : ${dbReady ? 'ready' : '(created on first job — ok)'}`);

  console.log('SMOKE OK');
} catch (e) {
  ok = false;
  console.log('SMOKE FAIL:', String(e).slice(0, 400));
} finally {
  await bridge.stop();
  // 直连后客户端代拉的是脱离母进程的常驻引擎——按 hub.json pid 收尸。
  try {
    const hubJson = join(process.env.FEMO_DATA_DIR, 'femo', 'projection', 'hub.json');
    if (existsSync(hubJson)) {
      const { readFileSync } = await import('node:fs');
      const pid = Number(JSON.parse(readFileSync(hubJson, 'utf8'))?.pid) || 0;
      if (pid > 0) { try { process.kill(pid); console.log('[cleanup] killed sandbox daemon pid', pid); } catch { /* 已死 */ } }
    }
  } catch { /* 无账 */ }
  console.log(`events seen during smoke: ${events.length}`);
  process.exitCode = ok ? 0 : 1;
}
