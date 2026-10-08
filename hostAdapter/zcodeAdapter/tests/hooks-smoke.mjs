/**
 * hooks-smoke.mjs — 钩子直连集成检测（驿站信箱 + 钩子链 + hub 实读 + possess 全链）
 * 手动运行：node zcodeAdapter/tests/hooks-smoke.mjs
 * 前身 gateway-smoke.mjs：本地网关（SSE / human-input / session-state / god-outside /
 * 静态托管）已于 2026-09-28 随作者拍板整体退役——生产零消费，画布 bundle 要的是
 * dsh 路由词汇，钩子的戏外捕获早已直喂 hub。网关断言拆除，钩子直连/hub 实读/
 * possess 全链断言留任，测试更名跟戏走。
 * 架构（2026-09-15 驿站定稿）：终局/轮次信走 mailbox（引擎产信，客户到站取）。
 * 钩子用例经 tests/harness.mjs runHook 直接拉起钩子脚本（真链路）。
 * 时序说明：附身（femo-possess CLI）全链排在开演之前的闲时段；
 * 闲时捕获闸也在开演前断言（daemon 已起、bound_jobs 空=真闲时）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHook, killSandboxDaemon } from './harness.mjs';

const ADAPTER = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ADAPTER, 'mcp', 'femo-server.mjs');
const MAILBOX = join(ADAPTER, '..', '..', 'femo2host', 'mailbox.py');
const TMP = join(ADAPTER, '.tmp'); // 冒烟自留沙盒：锚定本适配器目录，随目录搬家不受影响
mkdirSync(TMP, { recursive: true });
// 沙盒自洁：清掉上一轮留下的 hub 地址簿。.tmp 跨轮持久，陈年 hub.json 指去的
// 端口今天可能住着生产 hub——直连客户端「活着=复用」会顺藤摸过去，整场冒烟
// （含 possess 写账）全打进生产账本（2026-09-26 实证三处假红+生产账被读写）。
// 删掉它，daemon-client 按「死/无=代拉」在沙盒里现起一座，地址簿随本轮重生。
try { unlinkSync(join(TMP, 'femo', 'projection', 'hub.json')); } catch {}
// 收卷牌同理：上一轮女巫信交付写的牌若滞留（测试没有表演回合消费它），下一轮
// 同 ref 信会被旧牌防重注逻辑吞掉（红绿交替假红实证）。开局清牌。
try { rmSync(join(TMP, 'femo', 'host-history', 'zcode', 'turn-marker'), { recursive: true, force: true }); } catch {}
// 投影账本也清：某次跑次在 daemon 未解绑完时竞态写入的会话账行会跨跑次留存
// （闲时捕获闸断言「不入账」，读到陈年行=假红）。hub 每轮重生，账本目录一并
// 清掉（沙盒隔离，碰不到生产）。
try { rmSync(join(TMP, 'femo', 'projection'), { recursive: true, force: true }); } catch {}
// 信柜清柜：上一轮残留的 pending 信（料包/终局）跨测试串场（同 main-actor 口径）。
try { unlinkSync(join(TMP, 'femo', 'mailbox', 'mailbox.json')); } catch {}

const proc = spawn(process.execPath, [SERVER], { cwd: TMP, env: { ...process.env, FEMO_DATA_DIR: TMP, CLAUDE_SESSION_ID: 'smoke-session-1' }, stdio: ['pipe', 'pipe', 'pipe'] });
proc.stderr.on('data', () => {}); // 静音服务端日志

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
const POSS = join(ADAPTER, 'runtime', 'femo-possess.mjs');
/** femo-possess CLI（2026-09-28 换轨：附身入口=本机程序，MCP 的 femo_possess 工具
 *  在 zcode 退役）。冒烟带 --session_id 走派角路（一次性落账；自证路要宿主 exec
 *  目录，无头环境不可得）。返回 { code, out, err }。 */
const possessCli = args => new Promise(resolve => {
  const p = spawn(process.execPath, [POSS, ...args], { cwd: TMP, env: { ...process.env, FEMO_DATA_DIR: TMP, FEMO_ROOT: join(ADAPTER, '..', '..') }, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', d => { out += d; });
  p.stderr.on('data', d => { err += d; });
  p.on('exit', code => resolve({ code, out, err }));
});
const tool = async (name, args) => {
  const r = await call('tools/call', { name, arguments: args });
  if (r.error) throw new Error(`RPC ${name}: ${JSON.stringify(r.error).slice(0, 200)}`);
  if (!r.result?.content?.[0]) throw new Error(`RPC ${name}: no content — ${JSON.stringify(r.result).slice(0, 200)}`);
  return JSON.parse(r.result.content[0].text);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, label, timeoutMs = 30000) { const t0 = Date.now(); while (!(await fn())) { if (Date.now() - t0 > timeoutMs) throw new Error('timeout: ' + label); await sleep(200); } }

let fail = 0;
const check = (l, ok, d = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${d ? '  ' + d : ''}`); if (!ok) fail = 1; };
const rowsTexts = rows => rows.flatMap(r => [r.text, ...((r.items ?? []).map(i => i.text))]).map(t => String(t ?? ''));

try {
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'hooks-smoke', version: '0' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // 挂载（首条命令经 daemon-client 惰性代拉常驻引擎；未开演=bound_jobs 空=闲时）
  const script = `meta:\n  name = 钩链冒烟\n  session = new\n\nactors:\n  human @我 = soul:human\n\naction ask @human(@我):\n  prompt: 请说点什么\n\nmainflow:\n  [START] -> ask -> [END]\n`;
  const mount = await tool('femo_mount', { femo_text: script });
  check('挂载', mount.mounted === true);

  // hub 就绪（daemon 内装配 hub；hub.json 自发现）
  const hubPortFile = join(TMP, 'femo', 'projection', 'hub.json');
  let hubBase = '';
  await waitFor(async () => {
    try {
      if (!existsSync(hubPortFile)) return false;
      hubBase = `http://127.0.0.1:${JSON.parse(readFileSync(hubPortFile, 'utf8')).port}`;
      return (await (await fetch(`${hubBase}/health`)).json()).ok === true;
    } catch { return false; }
  }, '投影中心 hub 就绪（MCP 代拉）', 30000);

  // 空闲面：插话钩子沉默（未开演，引擎回空）+ 闲时捕获闸（running 闸=bound_jobs
  // 空，不入账——普通聊天不混历届主会话，dsh 09-23 事故闸门）。
  const mc0 = await runHook('mail-context', { session_id: 'smoke-session-1' }, { sessionId: 'smoke-session-1', dataDir: TMP });
  check('mail-context 空闲沉默', !mc0.additionalContext);
  const idleTranscript = join(TMP, 'smoke-idle-transcript.jsonl');
  writeFileSync(idleTranscript, `${JSON.stringify({ message: { content: [{ text: '（不该入账的闲聊）', type: 'text' }], role: 'assistant' } })}\n`, 'utf8');
  await runHook('stop-intent', { transcript_path: idleTranscript }, { sessionId: 'smoke-s1', dataDir: TMP });
  await sleep(1200);
  const idleSess = await (await fetch(`${hubBase}/view?session=zcode:smoke-s1&view=god`)).json();
  const idleSess2 = await (await fetch(`${hubBase}/view?session=zcode:smoke-session-1&view=god`)).json();
  const idleHasCapture = rows => rowsTexts(rows ?? []).some(t => t.includes('（不该入账的闲聊）'));
  check('闲时捕获闸（未开演不入账）', !idleHasCapture(idleSess.rows) && !idleHasCapture(idleSess2.rows),
    `${(idleSess.rows ?? []).length}/${(idleSess2.rows ?? []).length} 行`);

  // 附身（femo-possess 程序，2026-09-28 换轨）：本会话注册为某 soul 的出演者——
  // 正身=hub 提名账（cast-preferences）；提名制：多会话可同提一个 soul，当选=最后
  // 指派（bindings）。CLI 口径与 femo_possess 工具一致（--action/--soul_id/
  // --session_id/--host）；冒烟带 --session_id 走派角路（自证路要宿主 exec 目录，
  // 无头环境不可得——那条路今日真机已验）。【时序】附身全链在开演前做完。
  await tool('femo_soul', { action: 'create', soul_id: 'smoke_witch', soul_name: '冒烟女巫', description: '钩链冒烟临时角色' });
  const pos = await possessCli(['--action', 'possess', '--soul_id', 'smoke_witch', '--session_id', 'smoke-session-1']);
  check('附身成功', pos.code === 0 && pos.out.includes('possess 完成'), (pos.out + pos.err).slice(-160));
  let pv = await (await fetch(`${hubBase}/sessions/cast-preferences`)).json();
  check('绑定账正身入 hub（三元组）', pv.hosts?.zcode?.['smoke-session-1']?.soul === 'smoke_witch', JSON.stringify(pv.hosts ?? {}).slice(0, 160));
  const dup = await possessCli(['--action', 'possess', '--soul_id', 'smoke_witch', '--session_id', 'smoke-session-1']);
  check('重复附身幂等', dup.code === 0 && dup.out.includes('possess 完成'));
  // 提名制：别的会话抢提同一个 soul 照常入账（最后一票算数，下一场定格生效）
  const steal = await (await fetch(`${hubBase}/sessions/cast-preference`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: 'zcode', sid: 'smoke-other', soul: 'smoke_witch' }) })).json();
  check('soul 提名制（抢提照常入账）', steal.ok === true, JSON.stringify(steal).slice(0, 140));
  pv = await (await fetch(`${hubBase}/sessions/cast-preferences`)).json();
  check('当选随最后指派（bindings 走新票）', pv.bindings?.smoke_witch?.sid === 'smoke-other', JSON.stringify(pv.bindings ?? {}).slice(0, 140));

  // 远程分配角色：带 session_id 替别的会话附身（主Agent分配角色）+ 单槽直顶：
  // 同一会话提新角色直接换，旧角色当选自动回落上一票
  await tool('femo_soul', { action: 'create', soul_id: 'smoke_owl', soul_name: '冒烟猫头鹰', description: '远程分配角色测试' });
  const remote = await possessCli(['--action', 'possess', '--soul_id', 'smoke_owl', '--session_id', 'smoke-other']);
  check('远程分配角色成功', remote.code === 0 && remote.out.includes("session=smoke-other"), (remote.out + remote.err).slice(-160));
  pv = await (await fetch(`${hubBase}/sessions/cast-preferences`)).json();
  check('远程附身入正身（单槽直顶女巫）', pv.hosts?.zcode?.['smoke-other']?.soul === 'smoke_owl');
  check('女巫当选回落上一票', pv.bindings?.smoke_witch?.sid === 'smoke-session-1', JSON.stringify(pv.bindings ?? {}).slice(0, 140));
  const steal2 = await possessCli(['--action', 'possess', '--soul_id', 'smoke_witch', '--session_id', 'smoke-other']);
  check('换提照常成功（最后指派算数）', steal2.code === 0 && steal2.out.includes('possess 完成'));
  const relR = await possessCli(['--action', 'release', '--session_id', 'smoke-other']);
  check('远程解附身', relR.code === 0 && relR.out.includes('release 完成'));
  // 钩子按绑定拉信已退役（2026-09-28 换轨）：信的投递/消费归 femo-possess 进程，
  // stop-intent 不再碰信柜。给该 soul 造一封入站料包信（同引擎产信形状），断言：
  // ①stop-intent 沉默且信留柜；②receive 取走（信归 femo-possess 通道）。
  // （job_id 用独立假号：信柜不验 job 存在性，本断言只验「按 soul 对号拉信」。）
  const femo2hostDir = join(ADAPTER, '..', '..', 'femo2host').replaceAll('\\', '/');
  const postPy = `import sys; sys.path.insert(0, r'${femo2hostDir}'); import mailbox; mailbox.post(job_id=99901, soul='smoke_witch', kind='context', payload='轮到女巫发言', action='receive', delivery='urgent', who_move='customer_hook', who_require='system_require', target_host='zcode', ref='smoke:witch:1'); print('posted')`;
  const posted = spawnSync('python', ['-c', postPy], { encoding: 'utf8', timeout: 5000, env: { ...process.env, FEMO_DATA_DIR: TMP, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
  check('女巫料包信已造', posted.stdout.includes('posted'), String(posted.stderr ?? '').slice(0, 120));
  const siW = await runHook('stop-intent', { session_id: 'smoke-session-1' }, { sessionId: 'smoke-session-1', dataDir: TMP });
  check('stop-intent 不再代领（信留给 femo-possess）', !siW.decision, JSON.stringify(siW).slice(0, 120));
  const gotW = spawnSync('python', [MAILBOX, 'receive', '--host', 'zcode', '--soul', 'smoke_witch', '--session', 'smoke-session-1'], { encoding: 'utf8', timeout: 5000, env: { ...process.env, FEMO_DATA_DIR: TMP, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
  const gotLetters = JSON.parse(gotW.stdout || '[]');
  check('信由 femo-possess 通道取走（收到女巫料包）', Array.isArray(gotLetters) && gotLetters.some(x => String(x.payload ?? '').includes('女巫')), String(gotW.stdout).slice(0, 120));
  const rel = await possessCli(['--action', 'release', '--session_id', 'smoke-session-1']);
  check('解附身成功', rel.code === 0 && rel.out.includes('release 完成'));
  pv = await (await fetch(`${hubBase}/sessions/cast-preferences`)).json();
  check('解附身后绑定账清空', pv.hosts?.zcode?.['smoke-session-1']?.soul === undefined, JSON.stringify(pv.hosts ?? {}).slice(0, 140));

  // 信已取走：stop-intent 不拦（FEMO外无 pending）
  const si = await runHook('stop-intent', {}, { sessionId: 'smoke-session-1', dataDir: TMP });
  check('stop-intent 取完不拦', !si.continue && !si.decision);

  // 开演（挂运行中状态，供插话横幅断言；不经网关交卷——人类输入真通道=
  // 投影中心网页输入席，hub 直收，本冒烟不覆盖）。
  const run = await tool('femo_run', { action: 'fresh_start', session: 'smoke-session-1' });
  check('启动运行', run.started === true, `job=${run.job_id}`);

  // FEMO中插话（用户索要上下文）：运行中注入剧情速览（钩子直连 daemon /cmd）。
  // 【关系裁决 2026-09-27】横幅只发给本场班底——导演（host_refs 对上）或选角
  // 演员；无关会话（不在 host_refs 也不在选角账）一律沉默。
  let mc = {};
  await waitFor(async () => {
    mc = await runHook('mail-context', { session_id: 'smoke-session-1' }, { sessionId: 'smoke-session-1', dataDir: TMP });
    return Boolean(mc.additionalContext);
  }, 'mail-context FEMO中注入');
  check('mail-context FEMO中注入（导演窗）', (mc.additionalContext ?? '').includes('钩链冒烟'));
  const mcForeign = await runHook('mail-context', { session_id: 'unrelated-sid' }, { sessionId: 'unrelated-sid', dataDir: TMP });
  check('mail-context 无关会话沉默', !mcForeign.additionalContext, JSON.stringify(mcForeign).slice(0, 120));

  // 投影历史（2026-09-25 起唯一数据面 = hub：引擎 EventProjector 喂 FEMO内行）。
  let godTexts = [];
  await waitFor(async () => {
    const v = await (await fetch(`${hubBase}/view?job=${run.job_id}&view=god`)).json();
    godTexts = rowsTexts(v.rows ?? []);
    return godTexts.some(t => t.includes('钩链冒烟'));
  }, 'hub 上帝窗收到FEMO内行（剧名行）', 20000);
  check('投影历史入 hub（FEMO内行）', true, `${godTexts.length} 行`);

  // 名册接入（§5.6）：启动运行即 announce+bind——手机端主会话面板由此认得 zcode
  const ss = await (await fetch(`${hubBase}/sessions`)).json();
  check('名册绑定 femo-main', JSON.stringify(ss.bindings ?? {}).includes('femo-main'), JSON.stringify(ss.bindings ?? {}).slice(0, 140));

  // 收尾：强停本宿主场（沙盒不留挂起场；收尸在 finally）
  await tool('femo_run', { action: 'pause' });
} catch (e) {
  console.log('❌ EXCEPTION:', String(e).slice(0, 250));
  fail = 1;
} finally {
  proc.kill();
  killSandboxDaemon(TMP);   // 直连后 MCP 代拉的是脱离父进程的常驻引擎，必须收尸
  console.log(fail === 0 ? 'HOOKS SMOKE OK' : 'HOOKS SMOKE FAIL');
  process.exitCode = fail;
}
