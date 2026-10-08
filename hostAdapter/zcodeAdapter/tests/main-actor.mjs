/**
 * main-actor.mjs — 主Agent循环端到端（旗舰场景）
 * source:main FEMO脚本 → run → 【femo-possess 领拍（取信消费+挂牌）】→ 模型表演回合
 * → 【Stop-hook 收卷（收取转写→分类压平→自动交卷）】→ 第二拍 → 收卷 → flow_done
 * 手动运行：node zcodeAdapter/tests/main-actor.mjs
 * 【2026-09-26 无子代理化定稿】交卷不再靠模型跑命令：领拍挂牌（turn-marker），
 * 下一次 Stop 见牌即收卷——speech-collect.mjs 收取转写交驿。
 * 【2026-09-28 换轨】信的投递/消费归 runtime/femo-possess.mjs（领拍即取信），
 * Stop 钩子退役轮末代领——测试用 harness.possessPickup 做同一套领拍动作。
 * 【宿主转写真容】zcode 只把本回合最后一条消息交给钩子（探针实证）——测试用
 * 「覆写转写=仅最后一条消息」模拟真实形态；纪律=先架 femo-possess 后开口，台词
 * 必须最后说。会话号全程显式固定 'femo-main'：MCP 的 host_refs、信的会话格、钩子
 * 的自取对号与 FEMO外捕获落格四处同词。
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHook, possessPickup, killSandboxDaemon } from './harness.mjs';

const ADAPTER = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ADAPTER, 'mcp', 'femo-server.mjs');
const TMP = join(ADAPTER, '.tmp'); // 冒烟自留沙盒：锚定本适配器目录，随目录搬家不受影响
mkdirSync(TMP, { recursive: true });
// 沙盒自洁：上一轮残留的 pending 信（终局信等）跨测试串场——本轮领拍会先捞到
// 别场的信（实测：上一轮终局信被本轮 Stop#1 注入，领拍断言全歪）。开局清柜。
try { unlinkSync(join(TMP, 'femo', 'mailbox', 'mailbox.json')); } catch {}

const SID = 'femo-main';
const proc = spawn(process.execPath, [SERVER], { cwd: TMP, env: { ...process.env, FEMO_DATA_DIR: TMP, CLAUDE_SESSION_ID: SID }, stdio: ['pipe', 'pipe', 'pipe'] });
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
  const transcriptFile = join(TMP, 'dbg-transcript.jsonl');
  // 宿主语义：每回合转写=仅本回合最后一条消息（覆写，非追加）。
  const writeTurn = text => writeFileSync(transcriptFile, `${JSON.stringify({ message: { content: [{ text, type: 'text' }], role: 'assistant' } })}\n`, 'utf8');

let fail = 0;
const check = (l, ok, d = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${d ? '  ' + d : ''}`); if (!ok) fail = 1; };

try {
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'main-smoke', version: '0' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const script = `meta:
  name = 主Agent冒烟
  session = new

actors:
  ai @主Agent = source:main

action open @ai(@主Agent):
  prompt: 请以主Agent身份说一句开场白

action close @ai(@主Agent):
  prompt: 请再说一句谢幕词

mainflow:
  [START] -> open -> close -> [END]
`;
  const mount = await tool('femo_mount', { femo_text: script });
  check('挂载', mount.mounted === true, JSON.stringify(mount).slice(0, 250));
  // session=开演方会话号（生产由模型 echo $CLAUDE_SESSIONID 带回）——盖进档案
  // 导演格，main 信按号贴签，钩子 --session 精确对领（刀2 双词寻址契约）。
  const run = await tool('femo_run', { action: 'fresh_start', session: SID });
  check('启动运行', run.started === true, `job=${run.job_id}`);

  // 转写文件：预置一行FEMO外台词（领拍时钩子的转写捕获正例素材）
  const OUTSIDE_LINE = '（调试转写）主Agent正在后台清点道具。';
  writeFileSync(transcriptFile, `${JSON.stringify({ message: { content: [{ text: OUTSIDE_LINE, type: 'text' }], role: 'assistant' } })}\n`, 'utf8');

  // ── femo-possess 领拍：信到→取信消费→挂牌（2026-09-28 换轨：信的投递/消费
  //    归 runtime/femo-possess.mjs，Stop 钩子只认牌收卷、不再碰信柜）──────────
  await waitFor(() => mailboxHas(x => x.status === 'pending' && x.kind === 'context' && x.soul === 'main'), '主Agent料包信进箱');
  const si0 = await runHook('stop-intent', { transcript_path: transcriptFile }, { sessionId: SID, dataDir: TMP });
  check('stop-intent 不再代领（信留给 femo-possess）', !si0.decision, JSON.stringify(si0).slice(0, 100));
  const pick1 = possessPickup({ soul: 'main', session: SID, dataDir: TMP });
  check('领拍取信消费（信归 femo-possess）', pick1.letters.length > 0, `取 ${pick1.letters.length} 封`);
  check('领拍通知含开场白提示', pick1.notice.includes('开场白'), pick1.notice.slice(0, 120));
  check('领拍通知无命令教学（新契约）', !pick1.notice.includes('--soul') && !pick1.notice.includes('第二阶段回信'), pick1.notice.slice(-120));
  const markerDirOf = soul => join(TMP, 'femo', 'host-history', 'zcode', 'turn-marker', soul);
  const markerFiles = soul => { try { return readdirSync(markerDirOf(soul)).filter(f => f.endsWith('.json')); } catch { return []; } };
  let marker1 = null;
  await waitFor(() => {
    const fs = markerFiles('main');
    if (fs.length === 0) return false;
    marker1 = JSON.parse(readFileSync(join(markerDirOf('main'), fs[0]), 'utf8'));
    return Boolean(marker1.ref);
  }, '领拍挂牌');
  check('领拍挂牌（ref 齐备）', Boolean(marker1?.ref), `ref=${marker1?.ref}`);
  check('牌带收件会话号（双开防互覆）', marker1?.session === SID, `session=${marker1?.session}`);

  // ── 表演回合全程收集（2026-09-27 改版）：回合内工具边界（架哨兵）折进过程料，
  //    台词末条消息交卷——steps 多步、台词自立末步 reply。
  const tc = await runHook('turn-collect', { tool_name: 'Bash', tool_input: { command: 'node femo-possess.mjs --action possess --soul_id main --job ' + run.job_id }, tool_response: '[femo-possess] 上岗等信' }, { sessionId: SID, dataDir: TMP });
  check('回合内收集不拦', !tc.decision, JSON.stringify(tc).slice(0, 80));

  // ── 表演回合：模型说出台词（覆写转写=仅最后一条消息）→ 下一次 Stop 收卷 ────
  const LINE1 = '女士们先生们，欢迎来到这次冒烟测试。';
  writeTurn(LINE1);
  const si2 = await runHook('stop-intent', { transcript_path: transcriptFile }, { sessionId: SID, dataDir: TMP });
  check('收卷不拦（交完静默）', !si2.decision, JSON.stringify(si2).slice(0, 100));
  check('收卷后撤牌', markerFiles('main').length === 0);
  let beat1 = null;
  await waitFor(() => {
    try {
      const data = JSON.parse(readFileSync(mailboxFile, 'utf8'));
      beat1 = (data?.letters ?? []).find(x => x.kind === 'speech' && String(x.payload ?? '').includes(LINE1)) ?? null;
      return beat1 !== null;
    } catch { return false; }
  }, '收卷信落柜');
  check('台词自动交卷（speech 信 payload=台词）', beat1 !== null);
  check('收卷零污染（此前回合的消息不被卷入）', beat1 && !String(beat1.payload).includes(OUTSIDE_LINE), String(beat1?.payload ?? '').slice(0, 80));
  const beat1Steps = Array.isArray(beat1?.body?.steps) ? beat1.body.steps : [];
  check('全程收集：steps 多步（工具步+台词步）', beat1Steps.length === 2, JSON.stringify(beat1Steps).slice(0, 200));
  check('工具步在首（架哨兵）', beat1Steps[0]?.tool_calls?.[0]?.name === 'Bash' && String(beat1Steps[0]?.tool_results?.[0] ?? '').includes('上岗等信'), JSON.stringify(beat1Steps[0] ?? {}).slice(0, 120));
  check('台词唯一正身=末步 reply', String(beat1Steps[beat1Steps.length - 1]?.reply ?? '').includes(LINE1) && beat1Steps.slice(0, -1).every(s => !String(s.reply ?? '').trim()), JSON.stringify(beat1Steps.at(-1) ?? {}).slice(0, 120));
  check('过程料收后清柜', !existsSync(join(TMP, 'femo', 'host-history', 'zcode', 'turn-speech', 'main.json')));

  // ── 第二场（close）：领拍 → 表演 → 收卷 ────────────────────────────────────
  await waitFor(() => mailboxHas(x => x.status === 'pending' && x.kind === 'context' && x.soul === 'main'), '第二场料包信进箱');
  const pick2 = possessPickup({ soul: 'main', session: SID, dataDir: TMP });
  check('第二场领拍', pick2.notice.includes('谢幕词'), pick2.notice.slice(0, 120));
  const LINE2 = '感谢各位的观看，散场。';
  writeTurn(LINE2);
  await runHook('stop-intent', { transcript_path: transcriptFile }, { sessionId: SID, dataDir: TMP });
  await waitFor(() => mailboxHas(x => x.kind === 'speech' && String(x.payload ?? '').includes(LINE2)), '第二场收卷信落柜');
  check('第二场收卷', true);
  // 第二场无回合内工具：steps 应回落到单步（旧料不跨场串味）。
  try {
    const data2 = JSON.parse(readFileSync(mailboxFile, 'utf8'));
    const beat2 = (data2?.letters ?? []).find(x => x.kind === 'speech' && String(x.payload ?? '').includes(LINE2));
    const steps2 = Array.isArray(beat2?.body?.steps) ? beat2.body.steps : [];
    check('第二场单步（新收集窗口干净）', steps2.length === 1 && String(steps2[0]?.reply ?? '').includes(LINE2), JSON.stringify(steps2).slice(0, 120));
  } catch (e) { check('第二场单步（新收集窗口干净）', false, String(e).slice(0, 80)); }

  // 终局信（notice 急件）落驿站——可能已被钩子代领取走，只验存在性
  await waitFor(() => mailboxHas(x => x.kind === 'notice' && String(x.payload ?? '').includes('✅ FEMO 已跑完')), '终局信进箱');
  check('flow_done 终局信', true);

  // 台词入投影（2026-09-25 起唯一数据面 = hub）：行文本在裸行 text 与
  // section 行 items[].text 两处都有，断言取并集。
  const hubPortFile = join(TMP, 'femo', 'projection', 'hub.json');
  let hubBase = '';
  await waitFor(async () => {
    try {
      if (!existsSync(hubPortFile)) return false;
      hubBase = `http://127.0.0.1:${JSON.parse(readFileSync(hubPortFile, 'utf8')).port}`;
      return (await (await fetch(`${hubBase}/health`)).json()).ok === true;
    } catch { return false; }
  }, '投影中心 hub 就绪（桥拉起）', 30000);
  const rowsTexts = rows => rows.flatMap(r => [r.text, ...((r.items ?? []).map(i => i.text))]).map(t => String(t ?? ''));
  let godTexts = [];
  await waitFor(async () => {
    const v = await (await fetch(`${hubBase}/view?job=${run.job_id}&view=god`)).json();
    godTexts = rowsTexts(v.rows ?? []);
    return godTexts.includes(LINE1) && godTexts.includes(LINE2);
  }, 'hub 上帝窗收齐两场台词', 20000);
  check('两场台词均入 hub 上帝窗', true, `${godTexts.length} 行`);

  // FEMO外捕获入会话账本（running 闸正例收口）：领拍时带的转写台词应已在册。
  // （演出台词不入会话账本自查——收卷分支跳过捕获是结构保证；会话视图本身
  // 织入全场戏行，从视图侧分不出own/weave，无从断言。）
  await waitFor(async () => {
    const v = await (await fetch(`${hubBase}/view?session=zcode:femo-main&view=god`)).json();
    return rowsTexts(v.rows ?? []).some(t => t.includes(OUTSIDE_LINE));
  }, 'hub 会话账本收到转写台词', 15000);
  check('转写台词入 hub 会话账本（FEMO外捕获）', true);
} catch (e) {
  console.log('❌ EXCEPTION:', String(e).slice(0, 250));
  fail = 1;
} finally {
  proc.kill();
  killSandboxDaemon(TMP);   // 直连后 MCP 代拉的是脱离母进程的常驻引擎，必须收尸
  console.log(fail === 0 ? 'MAIN-ACTOR OK' : 'MAIN-ACTOR FAIL');
  process.exitCode = fail;
}
