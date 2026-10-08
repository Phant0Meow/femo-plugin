/**
 * main.mjs — 侧栏总装：连接状态线、轮询循环、标签页（灵魂/投影中心/调试）。
 *
 * 卡片模块各管各的（seats/feeds/human-seat/run-control/svclog），本文件只管
 * 节奏：每 2.5s 拉一轮状态分发给各卡渲染；卡片动作完成后经 web:refresh 事件
 * 喊一轮即时刷新（解耦：卡片不回头 import 总装）。
 */

import { $, escapeHtml, createToast } from '../../shared/dom.mjs';
import { bg, getState } from './conn.mjs';
import { renderSeats, renderManualTargets } from './seats.mjs';
import { renderReplies, renderRunlog } from './feeds.mjs';
import { renderHumanWait } from './human-seat.mjs';
import { start as startRunControl } from './run-control.mjs';
import { start as startSvclog } from './svclog.mjs';
import { femoLogoSvg } from '../../shared/femo-logo.mjs';

const statusEl = $('#status');
const seatsEl = $('#seats');
const toast = createToast($('#toast'));
$('#brandLogo').innerHTML = femoLogoSvg();   // 品牌图唯一活在 shared/femo-logo.mjs

function renderStatus(state) {
  if (!state?.ok) {
    statusEl.classList.add('bad');
    statusEl.innerHTML = '<span class="dot" style="background:var(--bad)"></span>服务不通';
    return `<div class="down">本地服务未连接（${escapeHtml(state?.serverUrl ?? '?')}）<br>点下面按钮一键启动。<br>首次使用由于系统限制，必须先由人亲手双击：<br><code>femo-plugin\hostAdapter\webAdapter\start-service.cmd</code><br>（启动一次即自动登记，之后此按钮永久可用）<br><button id="startServiceBtn">一键启动本地服务</button></div>`;
  }
  statusEl.classList.remove('bad');
  // 「灵魂 N」=显示出来的卡片里连了几个灵魂（有 soul 绑定的席位）：没绑灵魂的
  // 过路会话不进计数，刚关掉（离线）的绑定席位照算（2026-09-26 用户拍板——
  // 此前数的是席位总数=服务启动以来打开过的会话累计，语义不对）。
  const boundSouls = state.seats.filter(s => s.soul).length;
  statusEl.innerHTML = `<span class="dot on"></span>已连接 · 灵魂 ${boundSouls}`;
  return '';
}

// 轮询自适应：闲时 2.5s 一轮；有草稿在写（/state.drafts 非空=流式进行中）
// 提速到 700ms——面板是被拉的，轮询节奏就是流式的观感（实案：2.5s 恒速把
// 流式看成一截一截）。
const IDLE_POLL_MS = 2500;
const STREAM_POLL_MS = 700;
let pollMs = IDLE_POLL_MS;

async function refresh() {
  const state = await getState();
  pollMs = state?.ok && state.drafts?.length ? STREAM_POLL_MS : IDLE_POLL_MS; // 流式进行中=快轮
  const downBanner = renderStatus(state);
  const old = document.getElementById('downBanner');
  if (old) old.remove();
  if (downBanner) {
    const d = document.createElement('div');
    d.id = 'downBanner';
    d.innerHTML = downBanner;
    seatsEl.before(d);
  }
  renderHumanWait(state?.ok ? state.waitingHuman : null);
  if (state?.ok) {
    renderSeats(state.seats, state.activeSessionId);
    renderManualTargets(state.seats, state.activeSessionId);   // 调试卡目标下拉（自动预选当前会话）
    renderReplies(state.replies, state.drafts);
    renderRunlog(state.runlog);
  }
}
document.addEventListener('web:refresh', () => { refresh(); });

// ── 快捷行（2026-09-28 用户拍板）：侧栏只留常用动作——重启服务/操作台；
// 本地服务地址设置搬进操作台（操作台就住在服务上，地址=页面 origin 不用填）。
// 「关闭服务」2026-09-29 曾进侧栏、2026-09-30 撤回操作台独有（终态按钮不占
// 侧栏版面）；2026-09-30 流程画布自本行搬进 FEMO 脚本卡第二行（挂载/运行的
// 伙伴动作，?mount=1 开页见 server/canvas.mjs）。
$('#restartService').addEventListener('click', async ev => {
  const btn = ev.currentTarget;
  btn.disabled = true;
  btn.textContent = '重启中…';
  // 退场半步：活着就请它优雅退场（专用头防路过网页误触），然后盯 /health 直到
  // 真断——退场要写挂起档（秒级），固定睡一觉会撞上「拉起侧探到还活着」白跑。
  try {
    const state = await getState();
    if (state?.ok) {
      await fetch(`${state.serverUrl}/shutdown`, { method: 'POST', headers: { 'x-femo-shutdown': '1' }, signal: AbortSignal.timeout(2000) });
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        try {
          await fetch(`${state.serverUrl}/health`, { signal: AbortSignal.timeout(800) });
          await new Promise(r => setTimeout(r, 200));   // 还应答=还没退完，再看一眼
        } catch { break; }                              // 不应答=退场完成
      }
    }
  } catch { /* 本来就没在跑，直接进拉起 */ }
  const r = await bg({ type: 'web-launch-service' });
  if (r?.ok) toast(r.message || '本地服务已重启');
  else toast(`重启失败：${r?.error ?? '?'}`, true);
  btn.disabled = false;
  btn.textContent = '重启服务';
  refresh();
});

$('#lnkConsole').addEventListener('click', async ev => {
  ev.preventDefault();
  const state = await getState();
  if (state?.ok) chrome.tabs.create({ url: `${state.serverUrl}/console` });
  else toast('本地服务不通，开不了操作台', true);
});

$('#lnkCanvas').addEventListener('click', async () => {
  // 流程画布（2026-09-28 接入 femoGen）：本地服务伺候的独立模式画布页，
  // 默认主题=Web 操作台（服务端注入播种，见 server/canvas.mjs）。
  // 2026-09-30 搬进 FEMO 脚本卡第二行，开页带 ?mount=1：服务端挂载态里有脚本
  // 就由画布页里的播种脚本自动导入显示（本服务 GET /canvas/mounted 供脚本，
  // femoGen 零改动），没挂载就照常开空画布。
  const state = await getState();
  if (!state?.ok) { toast('本地服务不通，开不了流程画布', true); return; }
  chrome.tabs.create({ url: `${state.serverUrl}/canvas?mount=1` });
});

// ── 标签页：灵魂 / 投影中心 / 调试 ────────────────────────────────────────────
const seatPanel = $('#seatPanel');
const projPanel = $('#projPanel');
const debugPanel = $('#debugPanel');
const projFrame = $('#projFrame');

/** which: 'seats' | 'proj' | 'debug' */
function switchTab(which) {
  $('#tabSeats').classList.toggle('active', which === 'seats');
  $('#tabProj').classList.toggle('active', which === 'proj');
  $('#tabDebug').classList.toggle('active', which === 'debug');
  seatPanel.hidden = which !== 'seats';
  projPanel.hidden = which !== 'proj';
  debugPanel.hidden = which !== 'debug';
  // 品牌头只在灵魂标签显示，投影中心要满幅
  document.querySelector('header.only-seats').hidden = which !== 'seats';
  if (which === 'proj') loadProjection(false); // 首次切过去就解析；不强制刷新 iframe
}

/** 解析 hub 自发现地址并装进 iframe。force=true（点刷新）时连端口变化也重取。 */
let projLoadedUrl = '';

/** 内嵌投影中心的默认主题=翡翠 + 默认视角=戏内席（本宿主私有偏好，投影中心
 *  本身零改动）：主题按播种式——首次装载带 ?theme=jade，投影中心把主题写进
 *  它自己（hub 源）的 localStorage，此后装载不再带参；用户手选的主题自记自保。
 *  视角则每次装载都带 ?view=stage：web 宿主申报没有上帝席（清单 god_window=false），
 *  默认看戏内席是本宿主的常设缺省，不是一次性的——刷新/重开都回到戏内席，
 *  会话内手选别的视角照常自由（页内切换不重载，不受参数影响）。 */
async function seededProjUrl(url) {
  const u = new URL(url);
  u.searchParams.set('view', 'stage');
  const got = await chrome.storage.local.get(['projThemeSeededFor']);
  if (got.projThemeSeededFor === url) return u.toString();
  u.searchParams.set('theme', 'jade');
  await chrome.storage.local.set({ projThemeSeededFor: url });
  return u.toString();
}

async function loadProjection(force) {
  try {
    const state = await getState();
    if (!state?.ok) { toast('本地服务不通，解析不了投影中心地址', true); return; }
    const st = await (await fetch(`${state.serverUrl}/state`, { signal: AbortSignal.timeout(4000) })).json();
    const url = st?.projection?.url;
    if (!url) { toast('投影中心未启动（启动本地服务或开始运行后自动起）', true); return; }
    // 重载判据用自发现地址（无参）：播种参数只该影响首次装载，别让它把
    // 「地址没变就不重载、保页面状态」破坏成每次切标签都重载。
    const want = await seededProjUrl(url);
    if (!force && url === projLoadedUrl) return;
    projLoadedUrl = url;
    projFrame.src = want;
  } catch (e) {
    toast(`解析投影中心地址失败：${e}`, true);
  }
}

$('#tabSeats').addEventListener('click', () => switchTab('seats'));
$('#tabProj').addEventListener('click', () => switchTab('proj'));
$('#tabDebug').addEventListener('click', () => switchTab('debug'));

async function pollLoop() {
  try {
    await refresh();
  } catch { /* refresh 内部已兜；这里防未预期异常断链 */ }
  setTimeout(pollLoop, pollMs);
}
refresh();
startRunControl();
startSvclog();
pollLoop();
