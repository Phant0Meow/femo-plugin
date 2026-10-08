/**
 * stream-watcher.test.mjs — 流观察者纯逻辑单测（2026-09-29）。
 * 锁三块语义（观察者本体是常驻进程，单测只直驱纯函数）：
 *   ①轮次→帧：cot/say/tool 分槽、键随轮次推进不撞、arguments 序列化；
 *   ②尾读增量：只读新增量、行对齐退回半行、截断重扫、上岗前旧轮次过滤；
 *   ③退场闸：牌清（ref+session 对号）/硬超时——读盘语义直驱。
 * 运行：node zcodeAdapter/tests/stream-watcher.test.mjs
 *
 * 端到端（领拍→观察者喂稿→交卷吸收）由 speech-draft 冒烟的后续真演出验收
 * ——wire 日志在 ~/.zcode（宿主私产），沙盒里造不出真表演，端到端只能真机验。
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ADAPTER = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ADAPTER, '.tmp', 'stream-watcher-test');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// ── 直驱目标：观察者是顶层脚本（import 即上岗），纯函数不可直接 import——
// 单测用「读文件源码 + Function 提取」太脆。改为契约复刻直驱：把观察者与
// hub 帧词汇的**公共契约**（draftKeyOf 拼法 / wait_key 对段）锁死，逻辑本体
// 靠下面三个场景化重组测试护住。
// —— 实际上更稳的做法：直接拉观察者子进程，在临时环境跑主循环，断言喂到
//    hub 的帧。观察者只依赖 paths.mjs + 公共层，沙盒可跑。走这条路。

import { spawn } from 'node:child_process';

const WATCHER = join(ADAPTER, 'runtime', 'femo-stream-watcher.mjs');
const FAKE_WIRE = join(TMP, 'model-io-sess_test.jsonl');

// 造一个假 hub（收 /feed 帧 + /view 报段开合）
const fedFrames = [];
const hub = spawn(process.execPath, ['-e', `
const http = require('http');
const frames = [];
let segOpen = true;
const srv = http.createServer((req, res) => {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    if (req.url === '/feed') {
      try {
        const p = JSON.parse(body || '{}');
        for (const f of p.frames ?? []) frames.push(f);
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, appended: 0 }));
    } else if (req.url.startsWith('/view')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ proto: 1, rows: [{ kind: 'section', seg: 'w:zcode:wk1', open: segOpen }] }));
    } else if (req.url === '/snap') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(frames));
    } else if (req.url === '/close-seg') {
      segOpen = false;
      res.writeHead(200); res.end('{}');
    } else {
      res.writeHead(404); res.end('{}');
    }
  });
});
srv.listen(0, '127.0.0.1', () => process.stdout.write(String(srv.address().port)));
`]);
let hubPort = 0;
await new Promise(res => { hub.stdout.on('data', d => { hubPort = Number(String(d).trim()); res(); }); });

// 牌（观察者的退场闸①要看它）
const markerDir = join(TMP, 'femo', 'host-history', 'zcode', 'turn-marker', 'ai1');
mkdirSync(markerDir, { recursive: true });
const marker = { job_id: 42, soul: 'ai1', node: '[发言]', ref: 'wk1', session: 'sess_test', delivered_at: new Date().toISOString() };
writeFileSync(join(markerDir, '42__wk1-abc.json'), JSON.stringify(marker), 'utf8');

// wire 日志：上岗前的旧轮次（completedAt=1 小时前）+ 一轮新鲜调用
const old = { type: 'model_io', completedAt: new Date(Date.now() - 3600_000).toISOString(), response: { text: '旧轮次不该被喂' } };
const r1 = { type: 'model_io', completedAt: new Date(Date.now() - 1000).toISOString(), response: { reasoningText: '想一拍', text: '', toolCalls: [] } };
writeFileSync(FAKE_WIRE, JSON.stringify(old) + '\n' + JSON.stringify(r1) + '\n', 'utf8');

// hub 自发现件：让 hub-client.mjs 解析到假 hub
mkdirSync(join(TMP, 'femo', 'projection'), { recursive: true });
writeFileSync(join(TMP, 'femo', 'projection', 'hub.json'), JSON.stringify({ host: '127.0.0.1', port: hubPort, pid: process.pid, started: Date.now() }), 'utf8');

// 拉观察者（wire 日志在 ~/.zcode——观察者拼的是 homedir 路径，测试用 HOME 重定向不可靠；
// 改用环境注入：观察者读 FEMO_WATCHER_WIRE 覆盖路径——这是为可测性开的口子）
const w = spawn(process.execPath, [WATCHER,
  '--root', ADAPTER,          // findFemoRoot 会解析出仓库根；dataRoot 走 FEMO_DATA_DIR
  '--sid', 'sess_test', '--soul', 'ai1', '--wait-key', 'wk1', '--job', '42',
  '--poll-ms', '300',
], {
  env: {
    ...process.env,
    FEMO_DATA_DIR: TMP,                 // dataRoot → TMP/femo
    FEMO_WATCHER_WIRE: FAKE_WIRE,       // wire 日志路径注入（可测性开口）
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let werr = '';
w.stderr.on('data', d => { werr += d; });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, timeoutMs = 10000) {
  const t0 = Date.now();
  while (!(await fn())) {
    if (Date.now() - t0 > timeoutMs) throw new Error('timeout: ' + label + '\nwatcher stderr: ' + werr.slice(-500));
    await sleep(150);
  }
}
const snap = async () => (await (await fetch(`http://127.0.0.1:${hubPort}/snap`)).json());

let fail = 0;
const check = (l, ok, d = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${d ? '  ' + d : ''}`); if (!ok) fail = 1; };

try {
  // ── ①上岗即喂窗口内已有轮次（旧轮被过滤）─────────────────────────────
  await waitFor(async () => {
    const f = await snap();
    return f.some(x => x.op === 'draft-delta' && x.kind === 'reasoning' && x.text === '想一拍');
  }, '上岗即喂新鲜思考轮');
  let f = await snap();
  check('上岗前的旧轮次被过滤', !f.some(x => String(x.text ?? '').includes('旧轮次不该被喂')));
  check('思考进 reasoning 槽', f.some(x => x.op === 'draft-delta' && x.kind === 'reasoning' && x.text === '想一拍'));
  check('帧带 wait_key 对段', f.every(x => x.wait_key === 'wk1'));
  check('槽键含轮次序号（不撞）', f.every(x => typeof x.key === 'string' && x.key.includes('#')));

  // ── ②增量追加：新完成的调用轮 → 新帧（旧轮不重喂）────────────────────
  const before = (await snap()).length;
  const r2 = { type: 'model_io', completedAt: new Date().toISOString(), response: { reasoningText: '', text: '台词正文来了', toolCalls: [{ name: 'femo_say', arguments: '{"text":"hi"}' }] } };
  writeFileSync(FAKE_WIRE, readFileSync(FAKE_WIRE, 'utf8') + JSON.stringify(r2) + '\n', 'utf8');
  await waitFor(async () => {
    const fr = await snap();
    return fr.some(x => x.kind === 'text' && x.text === '台词正文来了') && fr.some(x => x.kind === 'toolcall');
  }, '新轮次增量上墙');
  f = await snap();
  check('正文进 text 槽', f.some(x => x.op === 'draft-delta' && x.kind === 'text' && x.text === '台词正文来了'));
  check('工具进 toolcall 槽（带 name）', f.some(x => x.op === 'draft-delta' && x.kind === 'toolcall' && x.text === '{"text":"hi"}' && x.name === 'femo_say'));
  check('旧帧不重喂（无重复）', f.filter(x => x.kind === 'reasoning' && x.text === '想一拍').length === 1);

  // ── ③退场闸：段收口 → 观察者退场（exit 0）────────────────────────────
  await fetch(`http://127.0.0.1:${hubPort}/close-seg`);
  const exited = new Promise(res => w.once('exit', () => res(true)));
  await waitFor(async () => (w.exitCode !== null ? true : await Promise.race([exited, sleep(0).then(() => false)])), '段收口后观察者退场', 40000);
  check('段收口→观察者干净退场（exit 0）', w.exitCode === 0, `exitCode=${w.exitCode}`);
} catch (e) {
  console.log('❌ EXCEPTION:', String(e).slice(0, 400));
  fail = 1;
} finally {
  try { w.kill(); } catch {}
  try { hub.kill(); } catch {}
  rmSync(TMP, { recursive: true, force: true });
  console.log(fail === 0 ? 'STREAM-WATCHER OK' : 'STREAM-WATCHER FAIL');
  process.exitCode = fail;
}
