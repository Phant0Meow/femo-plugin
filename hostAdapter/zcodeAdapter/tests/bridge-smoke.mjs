// bridge 冒烟：真绑定 ping / list_jobs / list_scripts（手动运行）
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZcodeDaemonClient, REPO_ROOT } from '../mcp/engine-bind.mjs';
import { killSandboxDaemon } from './harness.mjs';

// 沙盒隔离（模块纪律：跑测试必设 FEMO_DATA_DIR——DB/驿站/hub 三通道都进沙盒）。
// 此前本冒烟不设沙盒：直探生产 hub.json、还会顺手代拉生产 daemon（2026-09-28 修）。
const ADAPTER = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ADAPTER, '.tmp'); // 冒烟自留沙盒：锚定本适配器目录，随目录搬家不受影响
mkdirSync(TMP, { recursive: true });
process.env.FEMO_DATA_DIR = TMP;

const bridge = new ZcodeDaemonClient({
  onEvent: (type, data) => console.log('[event]', type, JSON.stringify(data).slice(0, 120)),
  log: m => console.log('[bridge]', m),
});
bridge.start();
await new Promise(r => setTimeout(r, 2500)); // 等绑定起
try {
  const pong = await bridge.send('ping');
  console.log('ping =>', JSON.stringify(pong).slice(0, 200));
  const jobs = await bridge.send('list_jobs');
  console.log('list_jobs =>', JSON.stringify(jobs).slice(0, 200));
  const scripts = await bridge.send('list_scripts');
  const n = Array.isArray(scripts?.scripts) ? scripts.scripts.length : JSON.stringify(scripts).length;
  console.log('list_scripts =>', Array.isArray(scripts?.scripts) ? `${n} scripts` : String(n).slice(0, 120));
  console.log('SMOKE OK  femoRoot =', REPO_ROOT);
} catch (e) {
  console.log('SMOKE FAIL:', String(e).slice(0, 300));
  process.exitCode = 1;
} finally {
  await bridge.stop();
  killSandboxDaemon(TMP);   // 代拉的是脱离母进程的常驻引擎，必须收尸
}
