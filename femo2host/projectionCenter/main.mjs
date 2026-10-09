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
import { subscribeCurrent, requestJobs, requestRange, refreshViewsSoon, applyJobs, applyViews, updateJobMeta, loadChronicaView } from './panels.mjs';

const elConn = document.getElementById('conn');
const elConnText = document.getElementById('connText');
// https 下必须 wss（tailscale serve 等反代场景），否则浏览器拦混合内容；
// 没有主机名（异常直开）才落本机缺省口。
// ?win=（2026-10-08 快照窗口化）：告诉 hub 本连接的快照只送头尾各 WIN_BYTES
// 字节、中间省略（elided 元数据随快照回，render 画省略号+展开按钮）。桌面/
// 手机一律窗口化（用户拍板「投影中心整个都这样显示」）——电脑只是网快，
// 形态完全一致；不带参的旧连接 hub 仍回全量（零回归）。
const WIN_BYTES = 1024 * 1024;
const WS_URL = location.host
  ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/?win=' + WIN_BYTES
  : 'ws://127.0.0.1:8790/?win=' + WIN_BYTES;
let backoff = 500;
let elideSeq = 0;   // 省略段对账 etok：每次快照 +1，rows-range 应答按它对号

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
// 主题键曾是那个夜间音乐术语（2026-10-08 用户拍板全局弃词）：现名 theater，直接
// 对应中文名「剧场」；浏览器里存下的旧键在 initTheme 里一次性迁移。
const THEMES = [['theater', '剧场'], ['porcelain', '素瓷'], ['jade', '翡翠']];
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('pc-theme', t); } catch (e) {}
}
// ── 一排按钮、两处出现（2026-10-05 用户拍板「页尾也显示一遍，复用不要重写，
// 改的时候只改一处」）───────────────────────────────────────────────────
// 行为只有一份：所有行内按钮带 data-act，下面的委托监听按 act 分发，顶/底
// 通吃；HTML 只写顶栏一份，boot 时 mirrorRow() 整排深克隆进页尾（#tailbar）。
// 上下唯一的分叉=刷新（用户点名「上下的刷新不一样，逻辑要加判断」）：按
// data-pos 判——顶刷归顶；底刷先把贴底旗写进 sessionStorage（本标签页私有，
// render 起步读旗置 followBottom=true）再 reload，旗用完即焚。
function mirrorRow() {
  const tail = document.getElementById('tailbar');
  const topbar = document.querySelector('.topbar');
  if (!tail || !topbar) return;
  const src = topbar.querySelectorAll(
    ':scope > .runctl, :scope > [data-act="theme"], :scope > [data-act="reload"], :scope > .dbg-wrap');
  for (const n of src) {
    const c = n.cloneNode(true);
    c.removeAttribute('id');
    c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    tail.appendChild(c);
  }
  tail.querySelectorAll('[data-act]').forEach(b => { b.dataset.pos = 'btm'; });
  const rb = tail.querySelector('[data-act="reload"]');
  if (rb) { rb.dataset.tip = '刷新 · 贴底'; rb.setAttribute('aria-label', '刷新 · 贴底'); }
}
function reloadPage(btn) {
  if (btn.dataset.pos === 'btm') {
    try { sessionStorage.setItem('pc-bottom-reload', '1'); } catch (e) {}
  }
  location.reload();
}
// 一份监听管两排（顶/底克隆都吃）：模块级委托，页尾镜像何时入住都不怕。
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.topbtn[data-act]');
  if (!btn) return;
  switch (btn.dataset.act) {
    case 'start': showMountMenu(btn); break;
    case 'resume': actResume(btn); break;
    case 'stop': actStop(btn); break;
    case 'theme': cycleTheme(); break;
    case 'reload': reloadPage(btn); break;
  }
});
function initTheme() {
  const qp = new URLSearchParams(location.search);
  let t = qp.get('theme') || '';
  if (!t) { try { t = localStorage.getItem('pc-theme') || ''; } catch (e) {} }
  if (t === 'nocturne') t = 'theater';   // 旧存档迁移（applyTheme 会把新键写回去）
  if (!THEMES.some(x => x[0] === t)) t = document.documentElement.dataset.theme || 'porcelain';
  applyTheme(t);
  syncThemeBtns();
}
// 主题钮点亮语义（2026-10-04 图标化拍板）：非缺省主题亮青——顶/底两颗同刷。
function syncThemeBtns() {
  const lit = document.documentElement.dataset.theme !== 'porcelain';   // 缺省=素瓷
  document.querySelectorAll('[data-act="theme"]').forEach(b => {
    b.classList.toggle('on', lit);
    b.setAttribute('aria-pressed', String(lit));
  });
}
function cycleTheme() {
  const cur = document.documentElement.dataset.theme;
  const i = Math.max(THEMES.findIndex(x => x[0] === cur), 0);
  applyTheme(THEMES[(i + 1) % THEMES.length][0]);
  syncThemeBtns();
}

// ── 运行控制三钮（2026-10-04 用户拍板）：顶栏 开始/继续/停止（纯图标）──────
// 全走引擎既有命令面（POST /cmd/<cmd>）：
//   开始  弹挂载清单下拉（投影中心超然于各 Host——2026-10-04 用户拍板：开始
//         不是"重开上一场"，而是从各 Host 挂载的剧本里挑一个开跑；清单来自
//         hub GET /mounts=挂载共同账本 mounts.json 的只读面）→ 选中项走
//         job_restart {script_path}（引擎读盘上现稿、班底按同名剧本沿袭）；
//   继续  看「当前投影显示的这场」（快照帧落的 S.currentJobId）：在跑→当没按
//         （连 flash 都不走）；没在跑（挂起/停过）→ get_job_state 取冻结的
//         script_text → job_resume（六关裁决，指纹对上冻结档）。
//         不再「挑最近挂起场」——那会在多场挂起时连环复活别的场（2026-10-04
//         实案：想推正在看的场一把，连点三下把下午挂着的三场全捞醒，两场并行
//         抢同一批网页演员）。
//   停止  看「当前投影显示的这场」（S.currentJobId）：在跑→job_pause（挂起
//         落断点，幂等可续）；没在跑（本来就挂着）→当没按（连 flash 都不走）。
//         不再「全停 runners」——那会把显示的场之外的在跑场一起拖下水
//         （与继续钮同一把尺：都只管你正看着的这一场）。
// 反馈统一：按钮暂禁 + 结果进 print 浮层；无目标响亮留痕不假装成功。
async function engineCmd(cmd, args) {
  const r = await fetch('/cmd/' + cmd, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: Date.now(), cmd, args: args || {} }),
  }).then(x => x.json());
  if (!r || r.ok !== true) throw new Error((r && (r.error || r.detail)) || ('cmd ' + cmd + ' 失败'));
  return r.result;
}
async function flashBtn(btnOrId, done) {
  const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
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
    await flashBtn(btn, async () => {
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
// 继续=续「场次下拉选中的这场」（2026-10-09 用户拍板，改判 2026-10-04「当前显示场」：
// 双胞胎同跑时「跟最新」会把显示面拽向新场，按钮跟着拽走就停错戏——按钮只认用户
// 手选的下拉项；下拉选「最新」时才退回当前显示场）：目标场在跑→响亮说一句
// 「已在跑」，不再无声吞按；没在跑才从断点续跑。
function actionTargetJob() {
  const sel = S.selectedJob ? Number(S.selectedJob) : NaN;
  if (!Number.isNaN(sel) && sel > 0) return sel;
  return S.currentJobId == null ? null : Number(S.currentJobId);
}
async function actResume(btn) {
  const target = actionTargetJob();
  if (target == null) { dbgLocal('继续：没有对准的场次（下拉未选、当前也无显示场），不动作'); return; }
  let runners = [];
  try {
    const h = await fetch('/engine/health').then(x => x.json());
    runners = Array.isArray(h.runners) ? h.runners : [];
  } catch (e) { dbgLocal('继续：引擎状态拉不到（' + (e && e.message ? e.message : e) + '）'); return; }
  if (runners.map(Number).includes(target)) { dbgLocal('继续 → j' + target + ' 本来就在跑，不用继续'); return; }   // 在跑：响亮不动作
  await flashBtn(btn, async () => {
    const st = await engineCmd('get_job_state', { job_id: target });
    if (!st || !st.script_text) throw new Error('档案里没有剧本原文（j' + target + '），无法续跑');
    await engineCmd('job_resume', {
      femo: st.script_text, job_id: target, host_ai_backend: true,
    });
    dbgLocal('继续 → j' + target + '（下拉选中场）从断点续跑');
  });
}
// 停止=停「场次下拉选中的这场」（2026-10-09 用户拍板，沿革见 actResume 头注）：
// 目标场不在引擎在跑清单→响亮留痕（含 runners 现值——2026-10-08 实案：引擎强杀
// 重启后档案停在 running 的僵尸场不在 runners 里，旧版静默 return，用户按了
// 以为停了其实什么都没发生）；在跑才挂起。
async function actStop(btn) {
  const target = actionTargetJob();
  if (target == null) { dbgLocal('停止：没有对准的场次（下拉未选、当前也无显示场），不动作'); return; }
  let runners = [];
  try {
    const h = await fetch('/engine/health').then(x => x.json());
    runners = Array.isArray(h.runners) ? h.runners : [];
  } catch (e) { dbgLocal('停止：引擎状态拉不到（' + (e && e.message ? e.message : e) + '）'); return; }
  if (!runners.map(Number).includes(target)) {
    dbgLocal('停止 → j' + target + ' 不在引擎在跑清单里（runners=[' + runners.join(',') + ']），未动作。'
      + '若这场档案显示 running 却停不了，多半是上次引擎强杀重启留下的僵尸档案，重开一局即可');
    return;
  }
  await flashBtn(btn, async () => {
    const r = await engineCmd('job_pause', { job_id: target });
    dbgLocal('停止 → j' + target + '（下拉选中场）' + (r && r.paused ? '已挂起，断点保留' : '未挂起'));
  });
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
      // 窗口化省略段（2026-10-08）：hub 只送了头尾时，把中间的账记下来——
      // render 在分界画省略号+展开按钮，rows-range 增量按这份账对号入座。
      S.elide = null;
      if (j.elided && Array.isArray(j.rows) && j.rows.length) {
        S.elide = {
          job: j.job != null ? j.job : null,
          sess: j.session || null,
          headEnd: j.elided.head_end, tailStart: j.elided.tail_start,
          headEnd0: j.elided.head_end, tailStart0: j.elided.tail_start,
          rows: j.elided.rows || 0, bytes: j.elided.bytes || 0,
          etok: ++elideSeq, _busy: false,
        };
        dbgLocal('快照窗口化：中间省略 ' + S.elide.rows + ' 条（约 ' +
                 Math.max(1, Math.round(S.elide.bytes / 1024)) + 'KB），点省略号两侧可展开');
      }
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
    if (j.ctrl === 'rows-range') {   // 省略段展开到货（2026-10-08）：按 token 对号，头尾各归各位
      if (!S.elide || j.tok !== S.elide.etok || !Array.isArray(j.rows)) return;
      S.elide._busy = false;
      const rows = j.rows;
      if (!rows.length) { if (j.met) S.elide = null; render(); return; }
      S.elide.rows = Math.max(0, S.elide.rows - rows.length);   // 省略计数同步递减（块上文案跟着走）
      if (j.dir === 'dn') {
        const i = S.rows.findIndex(x => x.n === S.elide.headEnd);
        if (i < 0) { S.elide = null; render(); return; }   // 账已换（理论不可达）：摘省略号靠快照重同步
        S.rows.splice(i + 1, 0, ...rows);
        S.elide.headEnd = rows[rows.length - 1].n;   // 升序块的末行=新的头边界
      } else {
        const k = S.rows.findIndex(x => x.n === S.elide.tailStart);
        if (k < 0) { S.elide = null; render(); return; }
        S.rows.splice(k, 0, ...rows.slice().reverse());   // up 块到货是倒序：转正序插入才贴合时间轨
        S.elide.tailStart = rows[rows.length - 1].n;   // 倒序块的末行=最低行号=新的尾边界（记错会插重）
      }
      S.elide.bytes = 0;   // 展开过就不再报字节数（页面侧无法精确记账，宁少说不少说错）
      if (j.met) S.elide = null;   // 中间取空：头尾接上了，省略号退休
      render();
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
mirrorRow();   // 先镜像后初始化：主题点亮等按类全场刷的逻辑才罩得住页尾克隆
initTheme();
initHeartbeat();
startSessions();
// 省略段展开按钮（2026-10-08 窗口化）：头侧按钮向下加一块、尾侧按钮向上加
// 一块，各 1MB（连接预算）；中间没货了 hub 回 met，省略号自动退休。
document.addEventListener('click', (e) => {
  const b = e.target.closest('.elide-btn');
  if (b) requestRange(b.getAttribute('data-elide') === 'up' ? 'up' : 'dn');
});
// URL 带整场视角（分享/刷新）：直接拉整场快照（不走 WS 订阅）；hub 不可达
// 时 dbgLocal 留痕，重连后不自动重试（刷新即重试）。
if (S.currentView && String(S.currentView).indexOf('chronica:') === 0)
  loadChronicaView(String(S.currentView).slice(10));
connect();
setInterval(render, 120); // 打字机刷新
