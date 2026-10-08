#!/usr/bin/env node
/**
 * smoke-service.mjs — 本地服务冒烟（手动运行，不拉真桥、不碰真浏览器）。
 *
 * 起 service.mjs（随机端口+一次性沙盒），打一遍扩展协议面与操作台协议面：
 *   /health /console /seats /seats/bind /extension/register /extension/poll
 *   /extension/report /seats/deliver /state /tools
 * 运行：node tests/smoke-service.mjs
 */

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ADAPTER_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.FEMO_DATA_DIR = mkdtempSync(join(tmpdir(), 'femo-web-svc-smoke-'));
process.env.FEMO_WEB_PORT = '18796';

const child = spawn(process.execPath, [join(ADAPTER_ROOT, 'server', 'service.mjs')], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', c => process.stdout.write(`[svc] ${c}`));
child.stderr.on('data', c => process.stdout.write(`[svc:err] ${c}`));

const BASE = 'http://127.0.0.1:18796';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitHealthy() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return r.json();
    } catch { /* 还没起 */ }
    await sleep(300);
  }
  throw new Error('service did not become healthy in 9s');
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
}

let ok = true;
try {
  const health = await waitHealthy();
  console.log('health        =>', JSON.stringify(health).slice(0, 140));
  assertEq(health.host, 'web', 'host 自称');

  const seats0 = await (await fetch(`${BASE}/seats`)).json();
  assertEq(seats0.seats.length, 0, '初始无席位');

  // 会话引用形态（`<域名>:<id>`，见 sites.mjs）——多站在役后的正字 id
  const REF = 'chat.deepseek.com:12345678-abcd';
  const reg = await post('/extension/register', { connId: 'conn-test', tabs: [{ tabId: 11, sessionId: REF, site: 'chat.deepseek.com', title: '冒烟会话', busy: false }] });
  assertEq(reg.json.ok, true, '注册成功');
  assertEq(reg.status, 200);

  const seats1 = await (await fetch(`${BASE}/seats`)).json();
  assertEq(seats1.seats.length, 1, '注册后一席');
  assertEq(seats1.seats[0].online, true);
  assertEq(seats1.seats[0].present, true, '在场=页开着');
  assertEq(seats1.seats[0].siteLabel, 'DeepSeek', '视图派生来源显示名');
  assertEq(seats1.seats[0].sidShort, '12345678', '视图派生短 id（剥来源前缀）');

  // 冻结页登记（2026-10-01 按需唤醒）：online:false 的页照样在场（present:true）；
  // 页关了（下轮没报到）才出账；恢复上报后席位复活（后面的绑定/下发要用它）。
  await post('/extension/register', { connId: 'conn-test', tabs: [{ tabId: 11, sessionId: REF, site: 'chat.deepseek.com', title: '冒烟会话', busy: false, online: false }] });
  const seatsFrozen = await (await fetch(`${BASE}/seats`)).json();
  assertEq(seatsFrozen.seats[0].present, true, '冻结页照样在场');
  assertEq(seatsFrozen.seats[0].online, false, '冻结页不在线');
  await post('/extension/register', { connId: 'conn-test', tabs: [] });
  const seatsGone = await (await fetch(`${BASE}/seats`)).json();
  assertEq(seatsGone.seats[0].present, false, '页关了=出账');
  assertEq(seatsGone.seats[0].online, false);
  await post('/extension/register', { connId: 'conn-test', tabs: [{ tabId: 11, sessionId: REF, site: 'chat.deepseek.com', title: '冒烟会话', busy: false, online: true }] });

  // 绑定要过 hub cast 账 + 角色库核查——先等桥/hub 就绪（投影中心地址解析出来即算）
  let projPort = 0;
  for (let i = 0; i < 40 && !projPort; i++) {
    const st = await fetch(`${BASE}/state`).then(r => r.json()).catch(() => undefined);
    projPort = st?.projection?.port ?? 0;
    if (!projPort) await sleep(300);
  }
  assertOk(projPort > 0, 'hub 就绪（投影中心地址已解析）');

  const soulsR = await post('/tools/femo_soul', { action: 'list' });
  const soulId = soulsR.json?.result?.souls?.map(s => s.soul_id).find(id => id && id !== 'human');
  assertOk(Boolean(soulId), `角色库可读（取 ${soulId} 冒烟；human 不可绑）`);

  const bind = await post('/seats/bind', { sessionId: REF, soul: soulId });
  assertEq(bind.json.ok, true, '绑定灵魂（hub cast 正身账 + 本地席位）');
  assertEq(bind.json.hub, true, '绑定写进 hub 正身账');

  const miss = await post('/seats/bind', { sessionId: 'nope', soul: soulId });
  assertEq(miss.status, 404, '无此席位 404');

  const rebind = await post('/seats/bind', { sessionId: REF, soul: soulId });
  assertEq(rebind.json.ok, true, '同魂同椅重复绑定幂等');

  // 长轮询：挂一个 poll，然后 deliver 应立刻送出
  const pollP = fetch(`${BASE}/extension/poll?conn=conn-test&timeout=3000`).then(r => r.json());
  await sleep(300);
  const dv = await post('/seats/deliver', { sessionId: REF, text: '冒烟测试一句话' });
  assertEq(dv.json.ok, true, '手工发消息受理');
  const pollR = await pollP;
  assertEq(pollR.frames.length, 1, 'poll 拿到下发帧');
  assertEq(pollR.frames[0].type, 'deliver');

  // 上行报告：busy/reply（reply 是 manual 帧 → runtime 无此 deliveryId，handled=false 也算通）
  const rep = await post('/extension/report', { type: 'busy', sessionId: REF, busy: true });
  assertEq(rep.json.handled, true, 'busy 上行受理');

  // ── 别家宿主绑定的灵魂：本场由 web 开、事件流全量送到 web，但信按设计留驿站等
  //    对方自取——web 一步都不许动（不派工、不弹提醒横条）。2026-10-06 用户实报：
  //    贴顶横条写「ai7 绑定的网页没能自动唤醒（Cannot access 'sid' before
  //    initialization）」——service.resolveSeat 的外宿主闸引用未初始化的 sid 撞
  //    TDZ，真正的「绑在别家」被 ReferenceError 顶掉，于是被当成唤醒失败 park 了。
  //    本段是这条链的端到端锁（真服务 + 真 hub 选角账 + 真驿站上门口）：外宿主判定
  //    要抛得出来（服务日志见 skip 行），且一个提醒帧都不许发给扩展（全页面贴顶横条
  //    的真身就是消息通道里的提醒帧）。
  const hubCast = await fetch(`http://127.0.0.1:${projPort}/cast`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ job_id: 2716, soul: 'ai7', sid: 'sess-zcode-1', host: 'zcode' }),
  }).then(r => r.json());
  assertEq(hubCast.ok, true, 'hub 选角账写入外宿主绑定（job 2716 / ai7 → zcode）');
  const logFile = join(process.env.FEMO_DATA_DIR, 'service.log');
  const logMark = readFileSync(logFile, 'utf8').length;
  const foreignPush = await post('/femo-plugin/mailbox-push', {
    letters: [{ kind: 'context', job_id: 2716, ref: 'wk-foreign' }],
    brief: {
      job_id: 2716, wait_key: 'wk-foreign', node_name: '[AI发言]', actor_name: '@Zcode（AI-7）',
      source: '', actor_info: { soul: 'ai7' }, blocks: { prompt: '轮到你发言' },
    },
  });
  assertEq(foreignPush.status, 200, '外宿主料包信上门照旧收下（驿站回执）');
  await sleep(800); // 派工在路由返回之后异步跑
  const afterLog = readFileSync(logFile, 'utf8').slice(logMark);
  assertOk(afterLog.includes('绑定在别家宿主（zcode）'), '外宿主灵魂被认出来并静默跳过（日志留痕）');
  assertOk(!/Cannot access 'sid'/.test(afterLog) && !afterLog.includes('没能自动唤醒'),
    '没有任何「唤醒失败」降级——TDZ 天书与提醒横条都不许出现');
  const pollAfter = await fetch(`${BASE}/extension/poll?conn=conn-test&timeout=300`).then(r => r.json()).catch(() => ({ frames: [] }));
  assertEq((pollAfter.frames ?? []).filter(f => f.type === 'remind').length, 0, '提醒横条一帧都没发（别家会话没响应不是本宿主的事）');

  const st = await (await fetch(`${BASE}/state`)).json();
  assertEq(st.host, 'web');
  assertOk(Array.isArray(st.runlog), 'state 带 runlog');

  const tools = await (await fetch(`${BASE}/tools`)).json();
  assertOk(Array.isArray(tools.tools) && tools.tools.length >= 6, `FEMO 运行控制工具 ${tools.tools?.length ?? 0} 个在册`);

  const consoleHtml = await (await fetch(`${BASE}/console`)).text();
  assertOk(consoleHtml.includes('操作台'), 'console 页可取');

  // 本地服务卡（2026-09-30 定名并收编侧栏快捷卡三钮）：标题与三钮接线要在页面上。
  assertOk(consoleHtml.includes('本地服务') && consoleHtml.includes('id="svcAddr"'), '/console 有「本地服务」卡');
  assertOk(consoleHtml.includes('id="restartService"') && consoleHtml.includes('id="stopService"') && consoleHtml.includes('id="mirrorToggle"'),
    '/console 本地服务卡收编重启/关闭/镜窗三钮');

  // 共享判断层（侧栏/操作台单份磁盘文件）：操作台侧经本路由取到。
  const sharedDom = await (await fetch(`${BASE}/console/shared/dom.mjs`)).text();
  assertOk(sharedDom.includes('export function escapeHtml'), '/console/shared/ 伺候判断层模块');

  // 画布（流程画布，server/canvas.mjs）：页面两段播种脚本齐全（主题/后端 +
  // 自动挂载）；自动挂载面在冒烟里没挂载过任何东西，应 ok:false 不给文本。
  const canvasHtml = await (await fetch(`${BASE}/canvas`)).text();
  assertOk(canvasHtml.includes('femo_backend_host'), '/canvas 注入主题与后端播种');
  assertOk(canvasHtml.includes("fetch('/canvas/mounted')") && canvasHtml.includes('femo_canvas_mount_applied'),
    '/canvas 注入自动挂载播种段');
  const mountedFace = await (await fetch(`${BASE}/canvas/mounted`)).json();
  assertEq(mountedFace.ok, false, '/canvas/mounted 未挂载时 ok:false');

  // femoGen 自有文件面（2026-09-30）：path 槽 → 按名存（三态）→ 清单出现 →
  // 打开回读（槽跟随）→ 目录浮层面（新建/浏览/围栏）→ 移除。系统对话框
  // （pick-* 两个）要弹真窗口，不进冒烟，覆盖面在单测围栏 + 人工验收。
  const path0 = await (await fetch(`${BASE}/api/canvas/path`)).json();
  assertOk(path0.ok && (path0.path === null || typeof path0.path === 'string'), '/api/canvas/path 可读');
  const save1 = await post('/api/save-script', { dir: '', name: '冒烟剧本', femo: 'flow x=1' });
  assertEq(save1.json.ok, true, '/api/save-script 按名存盘');
  assertEq(save1.json.changed, true, '首存=真写');
  const save2 = await post('/api/save-script', { dir: '', name: '冒烟剧本', femo: 'flow x=1' });
  assertEq(save2.json.changed, false, '同内容再存=未改动不重写');
  const list1 = await post('/api/femo-files', {});
  assertOk(Array.isArray(list1.json.files) && list1.json.files.some(f => f.path === save1.json.path),
    '存盘后 /api/femo-files 清单出现该文件');
  const open1 = await post('/api/femo-files/open', { path: save1.json.path });
  assertEq(open1.json.content, 'flow x=1', '/api/femo-files/open 回读正文');
  const path1 = await (await fetch(`${BASE}/api/canvas/path`)).json();
  assertEq(path1.path, save1.json.path, 'path 槽跟随打开动作');
  const mk = await post('/api/projects/mkdir', { dir: '', name: '冒烟目录' });
  assertEq(mk.json.ok, true, '/api/projects/mkdir 新建文件夹');
  const br = await post('/api/projects/browser', { dir: '冒烟目录' });
  assertEq(br.json.ok, true, '/api/projects/browser 围栏内浏览');
  assertOk(br.json.dirs.length === 0 && br.json.files.length === 0, '新目录为空清单');
  const deny = await post('/api/projects/browser', { dir: '..' });
  assertEq(deny.status, 400, '围栏拒绝 .. 越界');
  const forget1 = await post('/api/femo-files/forget', { path: save1.json.path });
  assertEq(forget1.json.removed, true, '/api/femo-files/forget 移除');

  console.log('SMOKE OK');
} catch (e) {
  ok = false;
  console.log('SMOKE FAIL:', String(e).slice(0, 500));
} finally {
  child.kill();
  // 【2026-09-26 常驻化第 3 步】服务直连后会把常驻引擎代拉成脱离母进程的
  // 进程——按沙盒 hub.json 的 pid 收尸，不留野 daemon。
  await sleep(300);
  try {
    const { existsSync, readFileSync } = await import('node:fs');
    const hubJson = join(process.env.FEMO_DATA_DIR || '', 'femo', 'projection', 'hub.json');
    if (existsSync(hubJson)) {
      const pid = Number(JSON.parse(readFileSync(hubJson, 'utf8'))?.pid) || 0;
      if (pid > 0) { try { process.kill(pid); console.log('[cleanup] killed sandbox daemon pid', pid); } catch { /* 已死 */ } }
    }
  } catch { /* 无账 */ }
  await sleep(300);
  process.exitCode = ok ? 0 : 1;
}

function assertEq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  console.log(`  ok: ${label}`);
}
function assertOk(cond, label) {
  if (!cond) throw new Error(`${label}: 不成立`);
  console.log(`  ok: ${label}`);
}
