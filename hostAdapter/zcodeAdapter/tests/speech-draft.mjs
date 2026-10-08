/**
 * speech-draft.mjs — 逐字流草稿层端到端（zcode 侧，2026-09-26）
 * FEMO脚本（source:main 单拍）→ run → femo-possess 领拍（取信消费+挂牌）→ 模型整回合
 * 发言 → stop-intent 收卷（自动交卷+喂草稿）→ 断言①草稿即上墙（段行带 drafts、
 * 文本=台词）→ 断言②引擎落账后吸收干净（台词恰一次、草稿撤净）→ flow_done。
 * 手动运行：node zcodeAdapter/tests/speech-draft.mjs
 *
 * 背景：ZCode 无逐字观测面（钩子只有边界事件），交卷时刻是宿主拿到台词的最早
 * 时刻——收卷器把台词按 wait_key 喂 hub 草稿层（draft-drop+draft-delta 同帧批发，
 * 重跑不叠字）；收口权归引擎出站（定稿吸收同 kind 草稿）。本测试锁两条线上语义：
 * 「提交即上墙」与「落账吸收不双份」。
 * 【2026-09-26 无子代理化定稿】交卷从模型跑 CLI 薄壳改为 Stop 钩子自动收卷
 * （speech-collect.mjs）：宿主只把本回合最后一条消息交给钩子（探针实证）——
 * 测试用「覆写转写=仅最后一条消息」模拟真实形态，喂草稿与交卷同拍发生在钩子
 * 里。会话号显式固定 'femo-main'（host_refs/信格/对号/捕获四处同词）。
 * 【2026-09-28 换轨】信的投递/消费归 runtime/femo-possess.mjs——领拍改走
 * harness.possessPickup（取信消费+挂牌），Stop 钩子不再碰信柜。
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHook, possessPickup, killSandboxDaemon } from './harness.mjs';

const ADAPTER = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ADAPTER, 'mcp', 'femo-server.mjs');
const TMP = join(ADAPTER, '.tmp');
mkdirSync(TMP, { recursive: true });
// 沙盒自洁：清掉上一轮残留的 pending 信（跨测试串场，同 main-actor 口径）。
try { unlinkSync(join(TMP, 'femo', 'mailbox', 'mailbox.json')); } catch {}

const proc = spawn(process.execPath, [SERVER], { cwd: TMP, env: { ...process.env, FEMO_DATA_DIR: TMP, CLAUDE_SESSION_ID: 'femo-main' }, stdio: ['pipe', 'pipe', 'pipe'] });
proc.stderr.on('data', () => {});
let id = 0;
const pending = new Map();
let buf = '';
proc.stdout.on('data', d => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    try { const m = JSON.parse(line); if (m.id !== undefined) { const r = pending.get(m.id); if (r) { pending.delete(m.id); r(m); } } } catch {}
  }
});
const call = (method, params) => new Promise(res => { const mid = ++id; pending.set(mid, res); proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: mid, method, params }) + '\n'); });
const tool = async (name, args) => {
  const r = await call('tools/call', { name, arguments: args });
  if (r.error || !r.result?.content?.[0]) throw new Error(`${name}: ${JSON.stringify(r.error ?? r.result).slice(0, 200)}`);
  return JSON.parse(r.result.content[0].text);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, timeoutMs = 30000) { const t0 = Date.now(); while (!(await fn())) { if (Date.now() - t0 > timeoutMs) throw new Error('timeout: ' + label); await sleep(200); } }
/** 只读翻信柜（不取信——信可能已被钩子收走，只验存在性）。 */
const mailboxFile = join(TMP, 'femo', 'mailbox', 'mailbox.json');
const mailboxHas = pred => {
  try {
    const data = JSON.parse(readFileSync(mailboxFile, 'utf8'));
    return (data?.letters ?? []).some(pred);
  } catch { return false; }
};
  const transcriptFile = join(TMP, 'draft-transcript.jsonl');
  // 宿主语义：每回合转写=仅本回合最后一条消息（覆写，非追加）。
  const writeTurn = text => writeFileSync(transcriptFile, `${JSON.stringify({ message: { content: [{ text, type: 'text' }], role: 'assistant' } })}\n`, 'utf8');
  writeTurn('（收工前的架哨兵汇报）');

let fail = 0;
const check = (l, ok, d = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${d ? '  ' + d : ''}`); if (!ok) fail = 1; };

try {
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'speech-draft', version: '0' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const script = `meta:
  name = 逐字草稿冒烟
  session = new

actors:
  ai @主Agent = source:main

action solo @ai(@主Agent):
  prompt: 请以主Agent身份说一句开场白

mainflow:
  [START] -> solo -> [END]
`;
  const mount = await tool('femo_mount', { femo_text: script });
  check('挂载', mount.mounted === true, JSON.stringify(mount).slice(0, 200));
  // session=开演方会话号（刀2 双词契约，同 main-actor）：main 信按号贴签对领。
  const run = await tool('femo_run', { action: 'fresh_start', session: 'femo-main' });
  check('启动运行', run.started === true, `job=${run.job_id}`);

  // 领拍（femo-possess 通道：取信消费+挂牌，2026-09-28 换轨）
  await waitFor(() => {
    try {
      const data = JSON.parse(readFileSync(mailboxFile, 'utf8'));
      return (data?.letters ?? []).some(x => x.status === 'pending' && x.kind === 'context' && x.soul === 'main');
    } catch { return false; }
  }, '料包信进箱');
  const pick = possessPickup({ soul: 'main', session: 'femo-main', dataDir: TMP });
  check('领拍取信消费', pick.letters.length > 0, `取 ${pick.letters.length} 封`);
  const markerDir = join(TMP, 'femo', 'host-history', 'zcode', 'turn-marker', 'main');
  let marker = null;
  await waitFor(() => {
    try {
      const f = readdirSync(markerDir).find(x => x.endsWith('.json'));
      if (!f) return false;
      marker = JSON.parse(readFileSync(join(markerDir, f), 'utf8'));
      return Boolean(marker.ref);
    } catch { return false; }
  }, '领拍挂牌');
  check('领拍挂牌含 ref', Boolean(marker?.ref), `ref=${marker?.ref}`);

  // hub 就绪（桥拉起，与 main-actor 同口径）
  const hubPortFile = join(TMP, 'femo', 'projection', 'hub.json');
  let hubBase = '';
  await waitFor(async () => {
    try {
      if (!existsSync(hubPortFile)) return false;
      hubBase = `http://127.0.0.1:${JSON.parse(readFileSync(hubPortFile, 'utf8')).port}`;
      return (await (await fetch(`${hubBase}/health`)).json()).ok === true;
    } catch { return false; }
  }, '投影中心 hub 就绪', 30000);
  const godView = async () => (await (await fetch(`${hubBase}/view?job=${run.job_id}&view=god`)).json()).rows ?? [];

  // ── 断言①：表演回合收卷 → 草稿即上墙（段行带 drafts，文本=台词）────────────
  const LINE = '女士们先生们，欢迎来到逐字草稿冒烟。';
  // 末条消息带思考块（steps 非空形态）：锁「台词并入 steps 末步 reply」契约——
  // 不并入时桥派生 output=空、引擎收空台词，下面的落账断言即红（2026-09-27 实证缺口）。
  writeFileSync(transcriptFile, `${JSON.stringify({ message: { content: [{ type: 'thinking', thinking: '（开演前想一拍）' }, { type: 'text', text: LINE }], role: 'assistant' } })}
`, 'utf8');
  const si2 = await runHook('stop-intent', { transcript_path: transcriptFile }, { sessionId: 'femo-main', dataDir: TMP });
  check('收卷不拦', !si2.decision, JSON.stringify(si2).slice(0, 100));
  let draftRow = null;
  await waitFor(async () => {
    draftRow = (await godView()).find(r => Array.isArray(r.drafts) && r.drafts.some(d => String(d.text ?? '').includes(LINE))) ?? null;
    return draftRow !== null;
  }, '草稿上墙（段行 drafts 含台词）', 8000);
  check('草稿即上墙（提交→落账空窗里有字）', draftRow !== null && draftRow.open === true,
    draftRow ? `seg=${draftRow.seg} drafts=${draftRow.drafts.length}` : '（未见）');

  // ── 断言②：引擎落账 → 吸收干净（台词恰一次、草稿撤净）+ 场终局照常 ──────────
  await waitFor(async () => {
    const rows = await godView();
    return rows.some(r => (r.items ?? []).some(i => String(i.text ?? '').includes(LINE)));
  }, '台词落账（段 items）', 20000);
  const rows = await godView();
  const hits = rows.flatMap(r => [r.text, ...(r.items ?? []).map(i => i.text)]).map(t => String(t ?? '')).filter(t => t.includes(LINE));
  check('台词恰好一次（定稿吸收未出双份）', hits.length === 1, `命中 ${hits.length} 处`);
  const draftLeft = rows.some(r => Array.isArray(r.drafts) && r.drafts.some(d => String(d.text ?? '').includes(LINE)));
  check('落账后草稿撤净', !draftLeft);
  // 终局信可能已被钩子代领取走，只验存在性（收卷链路未被破坏）
  await waitFor(() => mailboxHas(x => x.kind === 'notice' && String(x.payload ?? '').includes('✅ FEMO 已跑完')), '终局信进箱');
  check('flow_done 终局照常（收卷链路未破坏寄信闭环）', true);
} catch (e) {
  console.log('❌ EXCEPTION:', String(e).slice(0, 250));
  fail = 1;
} finally {
  proc.kill();
  killSandboxDaemon(TMP);   // 直连后 MCP 代拉的是脱离母进程的常驻引擎，必须收尸
  console.log(fail === 0 ? 'SPEECH-DRAFT OK' : 'SPEECH-DRAFT FAIL');
  process.exitCode = fail;
}
