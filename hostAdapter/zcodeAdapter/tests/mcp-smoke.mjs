/**
 * mcp-smoke.mjs — femo-server MCP 层集成检测
 * 把 server 当真子进程拉起，走 MCP 握手 + 完整工具循环：
 *   initialize → tools/list → femo_mount → femo_run(fresh_start) → list_jobs
 *   → femo_debug（零 token 干跑）
 * 历史注（2026-09-15）：femo_wait/femo_submit/femo_brief 已退役（讨论稿第六节
 * 裁定——主拍经 hook 注入/收割，人类拍走席位直投），从本冒烟移除；人类输入
 * 全链路见 integration-human.mjs。
 * 手动运行：node zcodeAdapter/tests/mcp-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { killSandboxDaemon } from './harness.mjs';

const ADAPTER = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ADAPTER, 'mcp', 'femo-server.mjs');
const TMP = join(ADAPTER, '.tmp'); // 冒烟自留沙盒：锚定本适配器目录，随目录搬家不受影响
mkdirSync(TMP, { recursive: true });

const proc = spawn(process.execPath, [SERVER], {
  cwd: TMP,
  env: { ...process.env, FEMO_DATA_DIR: TMP },
  stdio: ['pipe', 'pipe', 'pipe'],
});
let buf = '';
const pending = new Map();
const notes = [];
let id = 0;
proc.stdout.on('data', d => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const r = pending.get(msg.id); if (r) { pending.delete(msg.id); r(msg); }
    } else if (msg.method) notes.push(msg.method);
  }
});
proc.stderr.on('data', d => process.stderr.write(`  [srv] ${d}`.slice(0, 300)));

const call = (method, params) => new Promise(res => {
  const mid = ++id;
  pending.set(mid, res);
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: mid, method, params }) + '\n');
});
const tool = (name, args, meta) => call('tools/call', { name, arguments: args, ...(meta ? { _meta: meta } : {}) });
const resultOf = r => {
  if (r.error) throw new Error(`RPC error: ${JSON.stringify(r.error).slice(0, 200)}`);
  return JSON.parse(r.result.content[0].text);
};

let fail = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? '✅' : '❌'} ${label}${detail ? '  ' + detail : ''}`); if (!ok) fail = 1; };

try {
  // 握手
  const init = await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } });
  check('initialize', init.result?.serverInfo?.name === 'femo', `server=${init.result?.serverInfo?.name} proto=${init.result?.protocolVersion}`);
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const list = await call('tools/list', {});
  const names = list.result.tools.map(t => t.name);
  check('tools/list 6 个（femo_possess 已退役，附身走 femo-possess 程序）', names.length === 6 && !names.includes('femo_possess'), names.join(','));

  // 挂载（内联 human FEMO脚本）
  const script = `meta:\n  name = MCP冒烟\n  session = new\n\nactors:\n  human @我 = soul:human\n\naction ask @human(@我):\n  prompt: 请说点什么\n\nmainflow:\n  [START] -> ask -> [END]\n`;
  const mount = resultOf(await tool('femo_mount', { femo_text: script }));
  check('femo_mount', mount.mounted === true, JSON.stringify(mount).slice(0, 120));

  // 启动运行（引擎 DB 已随 FEMO_DATA_DIR 指进沙盒——不污染生产台账）
  const run = resultOf(await tool('femo_run', { action: 'fresh_start' }));
  check('femo_run fresh_start', run.started === true && typeof run.job_id === 'number', `job=${run.job_id}`);

  // Job 清单
  const jobs = resultOf(await tool('femo_run', { action: 'list_jobs' }));
  check('list_jobs', Array.isArray(jobs.jobs?.jobs) ? jobs.jobs.jobs.length >= 0 : Array.isArray(jobs.jobs));

  // 零 token 干跑（监工核心：femo2host/host/debug-run-core.mjs）
  const dbg = resultOf(await tool('femo_debug', {}));
  check('femo_debug', dbg.ok === true && typeof dbg.text === 'string' && dbg.exit_code === 0,
    `exit=${dbg.exit_code} text=${String(dbg.text ?? dbg.error).split('\n')[1]?.slice(0, 100)}`);

  // 暂停收尾
  const pause = resultOf(await tool('femo_run', { action: 'pause' }));
  check('femo_run pause', pause.paused === true);
  console.log(`   progress notifications sent: ${notes.filter(m => m === 'notifications/progress').length}`);
} catch (e) {
  console.log('❌ EXCEPTION:', String(e).slice(0, 300));
  fail = 1;
} finally {
  proc.kill();
  killSandboxDaemon(TMP);   // 直连后 MCP 代拉的是脱离母进程的常驻引擎，必须收尸
  console.log(fail === 0 ? 'MCP SMOKE OK' : 'MCP SMOKE FAIL');
  process.exitCode = fail;
}
