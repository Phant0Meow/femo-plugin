/**
 * main.mjs — 入口（自单文件页拆出，2026-09-26）：WS 生命周期、消息分发器、
 * 心跳看门狗（半死连接探活）、主题/刷新钮、连接灯、boot。全页唯一的「触发」
 * 集中地：模块顶层只准定义与注册，各件的启动都收进底部 boot 按序显式调用
 * ——connect 永远最后。
 * 分发器只转调：等待帧→composer.applyWaiting、回执→composer.applyInputResult、
 * 名册→sessions.applySessionsPayload、print 家族→debug-panel，其余就地记账。
 */
import { S } from './state.mjs';
import { render } from './render.mjs';
import { applyWaiting, applyInputResult, updateComposer } from './composer.mjs';
import { dbgLocal, dbgAppend, dbgSetItems, dbgClearAll, dbgReconnectRefresh } from './debug-panel.mjs';
import { startSessions, applySessionsPayload } from './sessions.mjs';
import { subscribeCurrent, requestJobs, refreshViewsSoon, applyJobs, applyViews, updateJobMeta, loadChronicaView } from './panels.mjs';

const elConn = document.getElementById('conn');
const elConnText = document.getElementById('connText');
// https 下必须 wss（tailscale serve 等反代场景），否则浏览器拦混合内容；
// 没有主机名（异常直开）才落本机缺省口。
const WS_URL = location.host
  ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/'
  : 'ws://127.0.0.1:8790/';
let backoff = 500;

// ── 心跳看门狗（2026-10-03）：半死连接的页面侧探活 ─────────────────────────
// 手机经 tailscale 反代直接看戏时，链路会「无声死掉」（息屏冻结、切网、中继
// 换路——TCP 断得不发 FIN，两端都不知道）：onclose 不触发，页面停在「已连接」，
// 新行一行不来，只能手刷。hub 每 15s 有协议层 ws ping，但浏览器在协议层自动
// 回 pong，JS 既看不见也收不到事件——活气必须页面自己挣：定期向 hub 要一次
// jobs 清单（hub 对 ctrl:'jobs' 必有应答，本就是它已有的服务，hub 零改动）。
// 判据用「问过没回」的欠账数，不用「多久没听到帧」——夹具实测教训：后台/
// 遮挡时浏览器把计时器冻到一分钟一拍（visibilityState 还会说 visible），
// 墙钟静默是节流冻出来的假证据，会空杀健康连接；而「发问」与「收应答」都走
// 网络，不受计时器节流——欠账只可能攒在真死管道上，节流免疫。
// 拆线用硬拆立连：半死管道上 close() 的关闭回执永远等不来，浏览器要空等
// 60 秒超时才放 onclose（夹具实测）——所以摘掉旧线回调直接拉新线，恢复
// 秒级；旧线残骸的 onclose 已被摘除，绝不触发 retry 叠加重连。重连自带新
// 快照，等于自动替用户刷新了页面。
const HB_POLL_MS = 15000;     // 探活拍：每拍向 hub 发一次 jobs 问询兼续命
const HB_MAX_PENDING = 3;     // 欠账线：连着 3 问一帧未回，管道判死
const HB_PROBE_MS = 4000;     // 回前台归期：欠账在身时给 4s（活 hub 应答毫秒级）
let pendingPolls = 0;         // 已发问未听到任何回音的问询数（任意帧皆算回音）

function sendPoll() {
  if (!S.ws || S.ws.readyState !== 1) return;
  S.ws.send(JSON.stringify({ ctrl: 'jobs' }));
  pendingPolls++;
}

function teardownAndReconnect(reason) {
  const old = S.ws;
  S.ws = null;   // 先断共用发信口：旧线从此无人写
  pendingPolls = 0;
  if (old) {
    old.onopen = old.onmessage = old.onclose = old.onerror = null;
    try { old.close(); } catch (e) {}
  }
  dbgLocal(reason);
  connect();   // 直接拉新线（新线自带快照重同步），不等旧线的关闭回执
}

function heartbeat() {
  const ws = S.ws;
  if (!ws || ws.readyState !== 1) return;   // 断线/重连的收尾自归 retry
  if (pendingPolls >= HB_MAX_PENDING) {     // 连问连欠：管道死了，实锤
    teardownAndReconnect('心跳 ' + pendingPolls + ' 问无回音：连接失活，拆线重连');
    return;
  }
  sendPoll();   // 问询即探活：应答一到，pendingPolls 清零
}

function initHeartbeat() {
  // 手机锁屏/切后台回来：若线上还欠着应答，给 4 秒归期——活 hub 应答毫秒级，
  // 到点没回就是死管道，拆线重连拿新快照（隔久了本来也该重同步）；账清白就
  // 先探一拍（应答顺带把场次清单也刷新了）。
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!S.ws || S.ws.readyState !== 1) return;
    if (pendingPolls > 0) {
      setTimeout(() => {
        if (pendingPolls > 0 && S.ws && S.ws.readyState === 1)
          teardownAndReconnect('回到前台：欠着 ' + pendingPolls + ' 问无回音，判死重连');
      }, HB_PROBE_MS);
    } else {
      sendPoll();
    }
  });
  setInterval(heartbeat, HB_POLL_MS);
}

// 等待态归一（2026-10-02 复数化）：hub 广播/快照带的是席位清单（数组）；老
// hub 发单个对象也接住（包成单席清单），空/null=没人在等。
function normWaiting(w) {
  if (Array.isArray(w)) return w;
  return w ? [w] : [];
}

function setConn(on, text) {
  elConn.classList.toggle('on', on);
  elConnText.textContent = text || (on ? '已连接' : '已断开');
}

// ── 主题切换：token 层随 <html data-theme> 生效。优先级：URL ?theme= >
// localStorage > html 属性缺省。加新主题 = theme.css 加一个 token 块 + 这里登个记。
// 2026-09-22 改版：主题收进顶栏一个按钮（不用下拉）；点击轮着切。
// 按钮文案 2026-09-27 用户拍板：显示**当前**主题的名字（三主题后「下一个」
// 的读法对不上号），点下去换下一个、按钮跟着变成新的当前名。
const THEMES = [['nocturne', '剧场'], ['porcelain', '素瓷'], ['jade', '翡翠']];
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('pc-theme', t); } catch (e) {}
}
function initReload() {
  const elReload = document.getElementById('pageReload');
  if (elReload) elReload.addEventListener('click', () => location.reload());
  // 底部刷新（2026-09-29 用户拍板）：同样整页 reload，但刷新后保持贴底跟随——
  // 先把旗写进 sessionStorage（本标签页私有）再 reload，render 起步读旗置
  // followBottom=true；旗用完即焚，顶部刷新仍归顶。
  const elReloadBottom = document.getElementById('pageReloadBottom');
  if (elReloadBottom) elReloadBottom.addEventListener('click', () => {
    try { sessionStorage.setItem('pc-bottom-reload', '1'); } catch (e) {}
    location.reload();
  });
}
function initTheme() {
  const qp = new URLSearchParams(location.search);
  let t = qp.get('theme') || '';
  if (!t) { try { t = localStorage.getItem('pc-theme') || ''; } catch (e) {} }
  if (!THEMES.some(x => x[0] === t)) t = document.documentElement.dataset.theme || 'porcelain';
  applyTheme(t);
  // toggle 按钮：纯图标（2026-10-04 用户拍板「主题改成画板那个图标」顶栏全部
  // 图标化）——主题名文字退场，按钮只留点亮语义：非缺省主题亮青。
  const elBtn = document.getElementById('themeToggle');
  const sync = () => {
    const cur = document.documentElement.dataset.theme;
    const lit = cur !== 'porcelain';   // 非缺省主题亮青（缺省=素瓷）
    elBtn.classList.toggle('on', lit);
    elBtn.setAttribute('aria-pressed', String(lit));
  };
  elBtn.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme;
    const i = Math.max(THEMES.findIndex(x => x[0] === cur), 0);
    applyTheme(THEMES[(i + 1) % THEMES.length][0]);
    sync();
  });
  sync();
}

// ── 运行控制三钮（2026-10-04 用户拍板）：顶栏 开始/继续/停止（纯图标）──────
// 全走引擎既有命令面（POST /cmd/<cmd>）：
//   开始  弹挂载清单下拉（投影中心超然于各 Host——2026-10-04 用户拍板：开始
//         不是"重开上一场"，而是从各 Host 挂载的剧本里挑一个开跑；清单来自
//         hub GET /mounts=挂载共同账本 mounts.json 的只读面）→ 选中项走
//         job_restart {script_path}（引擎读盘上现稿、班底按同名剧本沿袭）；
//   继续  list_jobs 挑最近挂起的场 → get_job_state 取冻结的 script_text →
//         job_resume（六关裁决，指纹对上冻结档）；
//   停止  /engine/health 取 runners → 逐个 job_pause（挂起落断点，幂等可续）。
// 反馈统一：按钮暂禁 + 结果进 print 浮层；无目标响亮留痕不假装成功。
async function engineCmd(cmd, args) {
  const r = await fetch('/cmd/' + cmd, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: Date.now(), cmd, args: args || {} }),
  }).then(x => x.json());
  if (!r || r.ok !== true) throw new Error((r && (r.error || r.detail)) || ('cmd ' + cmd + ' 失败'));
  return r.result;
}
async function flashBtn(id, done) {
  const btn = document.getElementById(id);
  if (!btn || btn.dataset.busy) return false;
  btn.dataset.busy = '1';
  btn.disabled = true;
  try { await done(); return true; }
  catch (e) { dbgLocal('操作失败：' + (e && e.message ? e.message : e)); return false; }
  finally { delete btn.dataset.busy; setTimeout(() => { btn.disabled = false; }, 1200); }
}
// 挂载清单下拉（开始钮的菜单）：复用 dd-menu 皮肤，屏内定位同 attachDropdown
// 的现算法（按钮贴边/窗口变形都不出屏）。
function placeMenu(btn, menu) {
  menu.style.maxHeight = '';
  const r = btn.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight, M = 12, GAP = 6;
  menu.style.minWidth = Math.max(200, Math.ceil(r.width)) + 'px';
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = r.left;
  if (left + mw > vw - M) left = vw - M - mw;
  left = Math.max(M, left);
  const below = vh - M - (r.bottom + GAP), above = r.top - GAP - M;
  const top = (mh <= below || below >= above) ? r.bottom + GAP
                                              : r.top - GAP - Math.min(mh, above);
  menu.style.left = Math.round(left) + 'px';
  menu.style.top = Math.round(Math.max(M, top)) + 'px';
  const avail = vh - M - top;
  if (menu.offsetHeight > avail) menu.style.maxHeight = Math.max(Math.round(avail), 80) + 'px';
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
async function showMountMenu(btn) {
  let mounts = [];
  try {
    mounts = (await fetch('/mounts').then(x => x.json())).mounts || [];
  } catch (e) { dbgLocal('挂载清单拉不到：' + (e && e.message ? e.message : e)); return; }
  let menu = document.getElementById('mountMenu');
  if (menu) { menu.remove(); return; }   // 开着再点=收起
  menu = document.createElement('div');
  menu.className = 'dd-menu';
  menu.id = 'mountMenu';
  const items = mounts.map(m => {
    const who = esc(String(m.session_name || m.host || '?'));
    if (m.script_path) {
      const name = esc(String(m.script_path).split(/[\\/]/).pop() || m.script_path);
      return '<button type="button" class="dd-item" data-sp="' + esc(m.script_path) + '">' +
        '<b>' + name + '</b>&ensp;<span style="opacity:.6">' + who + '</span></button>';
    }
    const head = esc(String(m.femo_text || '').split('\n', 1)[0] || '文本挂载');
    return '<button type="button" class="dd-item" data-text="1" title="文本挂载：内容随账本走，无盘上文件">' +
      '<b>' + (head.slice(0, 24) || '文本挂载') + '</b>&ensp;<span style="opacity:.6">' + who + '</span></button>';
  });
  menu.innerHTML = items.length
    ? items.join('')
    : '<div class="dd-item" style="opacity:.6;cursor:default">还没有 Host 挂载过剧本——各家挂载后这里会出现。</div>';
  document.body.appendChild(menu);
  placeMenu(btn, menu);
  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('button.dd-item');
    if (!b) return;
    menu.remove();
    await flashBtn('startBtn', async () => {
      if (b.dataset.sp) {
        const r = await engineCmd('job_restart', { script_path: b.dataset.sp });
        dbgLocal('开始 → 从挂载开跑 j' + (r && r.job_id) + ' ← ' + b.dataset.sp.split(/[\\/]/).pop());
      } else {
        const m2 = mounts.find(x => !x.script_path);
        const r = await engineCmd('job_start', { femo: (m2 && m2.femo_text) || '', host_ai_backend: true });
        dbgLocal('开始 → 文本挂载开跑 j' + (r && r.job_id));
      }
    });
  });
  // 点外面/Esc 收起（一次性监听，收起即拆）
  const close = (ev) => {
    if (ev.type === 'keydown' && ev.key !== 'Escape') return;
    if (ev.type === 'click' && menu.contains(ev.target)) return;
    menu.remove();
    document.removeEventListener('click', close);
    document.removeEventListener('keydown', close);
  };
  setTimeout(() => {
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
  }, 0);
}
function initRunCtl() {
  const startBtn = document.getElementById('startBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const stopBtn = document.getElementById('stopBtn');
  if (startBtn) startBtn.addEventListener('click', () => showMountMenu(startBtn));
  if (resumeBtn) resumeBtn.addEventListener('click', () => flashBtn('resumeBtn', async () => {
    const jobs = await engineCmd('list_jobs', {});
    const suspended = (jobs.jobs || [])
      .filter(j => j.state === 'suspended')
      .sort((a, b) => b.job_id - a.job_id);
    if (!suspended.length) { dbgLocal('继续：没有挂起的场（停止过才有断点）'); return; }
    const target = suspended[0].job_id;
    const st = await engineCmd('get_job_state', { job_id: target });
    if (!st || !st.script_text) throw new Error('档案里没有剧本原文（j' + target + '），无法续跑');
    await engineCmd('job_resume', {
      femo: st.script_text, job_id: target, host_ai_backend: true,
    });
    dbgLocal('继续 → j' + target + ' 从断点续跑');
  }));
  if (stopBtn) stopBtn.addEventListener('click', () => flashBtn('stopBtn', async () => {
    const h = await fetch('/engine/health').then(x => x.json());
    const runners = Array.isArray(h.runners) ? h.runners : [];
    if (!runners.length) { dbgLocal('停止：没有在跑的场'); return; }
    const out = [];
    for (const jid of runners) {
      try { const r = await engineCmd('job_pause', { job_id: jid }); out.push('j' + jid + (r && r.paused ? '✓' : '✗')); }
      catch (e) { out.push('j' + jid + '✗'); }
    }
    dbgLocal('停止 → ' + out.join(' '));
  }));
}

function connect() {
  setConn(false, '连接中… ' + WS_URL);
  try { S.ws = new WebSocket(WS_URL); } catch (e) { retry(); return; }
  S.ws.onopen = () => {
    backoff = 500;
    pendingPolls = 0;   // 新线开张，欠账清零
    setConn(true, '已连接');
    subscribeCurrent();
    requestJobs();
    // URL 带场次（分享/刷新）= 一次「选场次」：同步给 hub 联动换绑——不然
    // 场次下拉显示 j1948、god:<host> 还挂在上一次的 session 上，内容对不上
    // （2026-09-22「点哪个显示的不是那场」的刷新变体）。
    if (S.selectedJob && S.ws && S.ws.readyState === 1)
      S.ws.send(JSON.stringify({ ctrl: 'bind-job', job: S.selectedJob }));
    if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ ctrl: 'sessions' }));   // 主会话面板清单
    dbgReconnectRefresh();   // 浮层开着时重连补历史
  };
  S.ws.onmessage = (ev) => {
    pendingPolls = 0;   // 任何帧都是回音（解不动的帧也算链路活着）
    let j; try { j = JSON.parse(ev.data); } catch { return; }
    if (j.ctrl === 'view-echo') {   // hub 对裸 god 升级/回落的校正（2026-09-22）
      if (j.view && j.view !== S.currentView) {
        dbgLocal('视角校正 ← ' + j.view + '（原 ' + S.currentView + '）');
        S.currentView = j.view; render();
      }
      return;
    }
    if (j.ctrl === 'snapshot') {
      // 整场回放视角（REST 视图）：WS 快照不适用——多 job 拼接无「当前 job」
      // 语义；忽略（不覆盖已拉的整场行；切回正常视角自然恢复订阅流）。
      if (S.currentView && String(S.currentView).indexOf('chronica:') === 0) return;
      S.snapSeen = true;
      dbgLocal('快照 ← Job=' + (j.job == null ? '无' : 'j' + j.job) +
               ' 视角=' + (j.view || '?') + ' 行=' + (j.rows ? j.rows.length : 0) +
               (j.session ? ' 账本=' + j.session : ''));
      S.currentJobId = j.job; if (j.view) S.currentView = j.view;
      if (Array.isArray(j.hosts)) S.knownHosts = j.hosts.slice();
      S.waitingSeats = normWaiting(j.waiting);   // 快照捎带：刷新/切视角即刻接上等待席位
      S.rows = j.rows || [];
      S.liveBlocks.clear();   // 换场/换视角：旧直播块一并清场
      for (const b of (j.live || []))   // 快照捎带的正在打的块：切过来即刻接上
        S.liveBlocks.set(b.key, { actor: b.actor, blockKind: b.blockKind, text: b.text, host: b.host });
      for (const r of S.rows) if (r.zone === 'meta' && r.kind === 'play_start' && r.text) S.currentPlay = r.text;
      updateJobMeta();
      refreshViewsSoon();   // 角色中途才登场：快照后也刷一次视角清单
      updateComposer();
      render(); return;
    }
    if (j.ctrl === 'jobs') { applyJobs(j); return; }
    if (j.ctrl === 'views') { applyViews(j); return; }
    if (j.ctrl === 'sessions') { applySessionsPayload(j); return; }   // 主会话面板（含 announce/bind 变化广播）
    if (j.ctrl === 'bind-result') { return; }   // 失败也等广播的 sessions 校正，无需提示
    if (j.ctrl === 'hosts') { if (Array.isArray(j.hosts)) S.knownHosts = j.hosts; render(); return; }
    if (j.ctrl === 'live') { S.liveBlocks.set(j.key, { actor: j.actor, blockKind: j.blockKind, text: j.text, host: j.host }); return; }
    if (j.ctrl === 'live-done') { S.liveBlocks.delete(j.key); render(); return; }
    if (j.ctrl === 'live-clear') { S.liveBlocks.clear(); render(); return; }   // 场次边界：全清
    if (j.ctrl === 'row-update') {   // 空位回填：原位替换（n 不变，位置不动）
      const i = S.rows.findIndex(x => x.n === j.row.n);
      if (i >= 0) S.rows[i] = j.row;
      render(); return;
    }
    if (j.ctrl === 'row-del') {   // 运行结束扫除：没发言的空段整行拆除（本来就没见过的 n 静默忽略）
      const i = S.rows.findIndex(x => x.n === j.n);
      if (i >= 0) { S.rows.splice(i, 1); render(); }
      return;
    }
    if (j.ctrl === 'waiting') { applyWaiting(normWaiting(j.waiting)); return; }
    if (j.ctrl === 'human-input-result') { applyInputResult(j); return; }
    if (j.ctrl === 'print') { dbgAppend(j); return; }          // print 旁路（调试浮层）
    if (j.ctrl === 'prints') { dbgSetItems(j.items || []); return; }
    if (j.ctrl === 'prints-cleared') { dbgClearAll(); return; }
    if (j.ctrl) return;
    S.rows.push(j);
    if (j.zone === 'meta' && j.kind === 'play_start' && j.text) { S.currentPlay = j.text; updateJobMeta(); }
    if (j.kind === 'section') refreshViewsSoon();   // 新段落=可能有新角色：刷新视角清单
    render();
  };
  S.ws.onclose = () => { setConn(false, '断开，重连中…'); retry(); };
  S.ws.onerror = () => { try { S.ws.close(); } catch (e) {} };
}
function retry() { setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 5000); }

// ── boot：全页唯一的「触发」集中地（拆分纪律：模块顶层只准定义与注册）────
initReload();
initTheme();
initRunCtl();
initHeartbeat();
startSessions();
// URL 带整场视角（分享/刷新）：直接拉整场快照（不走 WS 订阅）；hub 不可达
// 时 dbgLocal 留痕，重连后不自动重试（刷新即重试）。
if (S.currentView && String(S.currentView).indexOf('chronica:') === 0)
  loadChronicaView(String(S.currentView).slice(10));
connect();
setInterval(render, 120); // 打字机刷新
