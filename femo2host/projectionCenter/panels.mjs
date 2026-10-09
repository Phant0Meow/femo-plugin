/**
 * panels.mjs — 清单与面板（自单文件页拆出，2026-09-26）：自绘下拉组件、
 * 场次/视角两实例、清单申请与应用、订阅口。数据全走 WS 一条通道（file://
 * 直开时代 fetch 全废的教训已成历史，WS 单通道是现行法）。
 * 依赖方向：本件 import composer（applyViews 时同步等待草稿）与
 * debug-panel（dbgLocal 诊断行）；sessions 反向 import 本件——环不存在。
 */
import { S } from './state.mjs';
import { esc } from './util.mjs';
import { render } from './render.mjs';
import { dbgLocal } from './debug-panel.mjs';
import { updateComposer } from './composer.mjs';

const elJobMeta = document.getElementById('jobMeta');

// ── 自绘下拉（统一组件）：场次/视角/主会话面板各宿主下拉同走这一套。
// set(items, current) 里 items 是 {v,label} 与 {group} 的有序混合数组，
// group 项画成「线—名—线」分割线；选中项高亮、触发键自动换名。──
const DD_ALL = [];   // 全部下拉的 close：开一个，关掉其余
export function attachDropdown(dd, btn, menu, onPick) {
  let lastItems = [];
  const close = () => { menu.hidden = true; };
  DD_ALL.push(close);
  // 屏幕自适应定位（2026-09-22）：菜单改 fixed，开/滚/缩放时按可视区现算落位。
  // 水平：默认右对齐按钮（同原 right:0 观感），左边放不下换左对齐，再不行硬夹
  // 回屏内；垂直：默认正放（同原 top:100%+6 观感），正放装不下且上方更宽敞才
  // 整体上翻；屏内放不全就压 maxHeight 让内部滚动——任何窗口形状都完整可见。
  function place() {
    if (menu.hidden) return;
    if (menu.style.maxHeight) menu.style.maxHeight = '';   // 上次的净高限制清掉再量
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, M = 12, GAP = 6;
    menu.style.minWidth = Math.max(180, Math.ceil(r.width)) + 'px';
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = r.right - mw;
    if (left < M) left = Math.min(r.left, vw - M - mw);
    left = Math.max(M, Math.min(left, vw - M - mw));
    const below = vh - M - (r.bottom + GAP), above = r.top - GAP - M;
    const top = (mh <= below || below >= above) ? r.bottom + GAP
                                                : r.top - GAP - Math.min(mh, above);
    const T = Math.max(M, top);
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(T) + 'px';
    const avail = vh - M - T;
    if (menu.offsetHeight > avail) menu.style.maxHeight = Math.max(Math.round(avail), 80) + 'px';
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    DD_ALL.forEach(f => f());
    menu.hidden = !open;   // 先全关再按原状态翻转：自己不会被自己关掉
    if (!menu.hidden) place();
  });
  // 窗口变形/页面滚动时跟着重算（capture 收一切内层滚动；hidden 菜单零开销）。
  // 菜单自己内部的滚动不算——重算会清 maxHeight，滚着滚着展开就闹鬼了。
  // document 级监听只增不减：靠 hidden 早退幂等续命（拆分纪律：原样保留，
  // 不许「顺手优化」成单例或改重建时机——行为会变）。
  window.addEventListener('resize', place, { passive: true });
  document.addEventListener('scroll', (e) => {
    if (!menu.hidden && !menu.contains(e.target)) place();
  }, { capture: true, passive: true });
  document.addEventListener('click', (e) => { if (!dd.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.dd-item');
    if (!b) return;
    const v = String(b.dataset.v);
    menu.querySelectorAll('.dd-item').forEach(x => x.classList.toggle('on', x.dataset.v === v));
    renderTrigger(lastItems.find(x => !x.group && String(x.v) === v));
    close();
    onPick(v);
  });
  // item 可带 side（受控 HTML，如场次下拉的宿主签）：菜单里画成左主文案 +
  // 右签的 flex 行；触发键上签贴右缘箭头（dd-btn 本就 space-between）。
  function renderTrigger(cur) {
    if (!cur) return;
    btn.innerHTML = '<span class="dd-label">' + esc(cur.label) + '</span>' +
      (cur.side ? '<span class="dd-side">' + cur.side + '</span>' : '');
  }
  function renderMenu(items, current) {
    return items.map(it => {
      if (it.group) return '<div class="dd-group"><span>' + esc(it.group) + '</span></div>';
      const on = String(it.v) === String(current) ? ' on' : '';
      if (it.side) return '<button type="button" class="dd-item dd-flex' + on +
        '" data-v="' + esc(it.v) + '"><span class="dd-main">' + esc(it.label) +
        '</span><span class="dd-side">' + it.side + '</span></button>';
      return '<button type="button" class="dd-item' + on + '" data-v="' + esc(it.v) + '">' +
        esc(it.label) + '</button>';
    }).join('');
  }
  return {
    set(items, current) {
      lastItems = items;
      menu.innerHTML = renderMenu(items, current);
      renderTrigger(items.find(x => !x.group && String(x.v) === String(current)));
    },
    setLabel(html) { btn.innerHTML = html; },   // 触发键自定义文案（主会话行用）
  };
}
function makeDropdown(name, onPick) {
  return attachDropdown(
    document.getElementById(name + 'DD'),
    document.getElementById(name + 'DDBtn'),
    document.getElementById(name + 'DDMenu'),
    onPick);
}
const ddJob = makeDropdown('job', (v) => {
  dbgLocal('选 Job j' + (v || '最新') + '（bind-job 联动，视角 ' + S.currentView + ' 不切）');
  S.selectedJob = v;
  // 整场视角下换 job = 离开整场回放、回到正常订阅（视角拉回 god——job 视角
  // 与整场视角是两套读法，选了 job 就看 job）。
  if (S.currentView && String(S.currentView).indexOf('chronica:') === 0) {
    S.currentView = 'god';
    S.chronicaSession = null;
    const u0 = new URL(location.href);
    u0.searchParams.delete('view');
    history.replaceState(null, '', u0);
  }
  const u = new URL(location.href);
  if (S.selectedJob) u.searchParams.set('job', S.selectedJob); else u.searchParams.delete('job');
  history.replaceState(null, '', u);   // 场次进 URL：可分享、刷新不丢
  requestViews();
  subscribeCurrent();
  // 改场次联动（2026-09-22 用户拍板的设计：选了 Job=看 Job 对应的 Session）：
  // hub 按 owners 账本给每个宿主换绑该场的 session，god:<host> 重解析即跟随
  // ——视角不用切，上帝视角自动变成那场戏对应 session 的视角。
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ ctrl: 'bind-job', job: v || '' }));
});
const ddView = makeDropdown('view', (v) => {
  // 整场视角（2026-09-29 拍板）：REST 一次拼拼读（无 WS 订阅语义——直播帧是
  // 易失过程态，整场回放是复盘镜头）；id 形如 chronica:<台账号>。
  if (String(v).indexOf('chronica:') === 0) {
    S.currentView = v;
    const u = new URL(location.href);
    u.searchParams.set('view', v);
    history.replaceState(null, '', u);
    loadChronicaView(v.slice(10));
    return;
  }
  S.currentView = v;
  const u = new URL(location.href);
  if (S.currentView && S.currentView !== 'god') u.searchParams.set('view', S.currentView);
  else u.searchParams.delete('view');
  history.replaceState(null, '', u);
  subscribeCurrent();
});

// 整场快照：REST 拉取 + 填充时间线。直播/等待态不适用（多 job 拼接无当前
// 等待一说）；拉不到响亮报错，不静默空屏。
export async function loadChronicaView(sid) {
  try {
    const r = await fetch('/chronica/view?session=' + encodeURIComponent(sid));
    const j = await r.json();
    if (!j || !Array.isArray(j.rows)) throw new Error('bad payload');
    S.currentView = 'chronica:' + sid;
    S.currentJobId = null;          // 整场视图不归单个 job；场次栏显示台账号
    S.currentPlay = '';             // 各 job 的 play_start 是章节头，不当本剧名
    S.chronicaSession = Number(sid);
    S.rows = j.rows;
    S.liveBlocks.clear();
    S.snapSeen = true;
    updateJobMeta();
    render();
    dbgLocal('整场快照 ← 台账场次 ' + sid + ' jobs=[' + (j.jobs || []).join(',') + '] 行=' + j.rows.length);
  } catch (e) {
    dbgLocal('整场快照失败：' + (e && e.message ? e.message : e));
  }
}

export function subscribeCurrent() {
  if (!S.ws || S.ws.readyState !== 1) return;
  dbgLocal('订阅 → Job=' + (S.selectedJob || '最新') + ' 视角=' + (S.currentView || '(空)'));
  S.ws.send(JSON.stringify({
    ctrl: 'view',
    job: S.selectedJob ? Number(S.selectedJob) : undefined,
    view: S.currentView || undefined,
  }));
}

export function requestJobs() {
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ ctrl: 'jobs' }));
}
// 省略段展开（2026-10-08 快照窗口化配套）：向 hub 要中间的一段。dir 'dn'=头段
// 向下加一块、'up'=尾段向上加一块，各按连接预算（?win=）切块、跨线行整行带走。
// 一次一发（_busy 到货才放）防连点刷屏；token 让迟到的应答对不上号时安静作废。
export function requestRange(dir) {
  if (!S.elide || S.elide._busy) return;
  if (!S.ws || S.ws.readyState !== 1) return;
  S.elide._busy = true;
  dbgLocal('展开省略段 ' + (dir === 'up' ? '↑（尾侧向上）' : '↓（头侧向下）') + ' …');
  S.ws.send(JSON.stringify({
    ctrl: 'range', dir: dir === 'up' ? 'up' : 'dn',
    head_end: S.elide.headEnd, tail_start: S.elide.tailStart,
    job: S.selectedJob ? Number(S.selectedJob) : undefined,
    tok: S.elide.etok,
  }));
}
export function requestViews() {
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ ctrl: 'views', job: S.selectedJob ? Number(S.selectedJob) : undefined }));
}
let viewsTimer = null;
export function refreshViewsSoon() {
  // 角色是运行中途才登场的：段落落地后去抖刷新视角清单（2s 一次足够）
  if (viewsTimer !== null) return;
  viewsTimer = setTimeout(() => { viewsTimer = null; requestViews(); }, 2000);
}
export function updateJobMeta() {
  // 整场视角：场次栏显示「台账场次 N」而非 job 号——整场回放不归单个 job
  if (S.currentView && String(S.currentView).indexOf('chronica:') === 0) {
    elJobMeta.textContent = '台账场次 ' + (S.chronicaSession != null ? S.chronicaSession : '?');
    return;
  }
  elJobMeta.textContent = (S.currentPlay ? S.currentPlay + ' · ' : '') +
    (S.currentJobId != null ? 'Job j' + S.currentJobId : '');
}
export function applyJobs(j) {
  if (Array.isArray(j.hosts)) S.knownHosts = j.hosts.slice();
  const cur = String(S.selectedJob);
  const items = [{ v: '', label: '最新' }];
  for (const x of (j.jobs || [])) {
    // 场次的来源标注（2026-09-22 改版）：宿主不再拼进纯文本尾巴，改画右缘
    // 小铭牌签——联机共演的多台一眼可辨；单来源同样亮签（zcode 单挂的场也是
    // 出处），无 host 字段的老场不占地方。
    const hosts = (Array.isArray(x.hosts) ? x.hosts : []).filter(h => typeof h === 'string' && h);
    const side = hosts.length > 0
      ? '<span class="jhosts">' + hosts.map(h => '<span class="jhost">' + esc(h) + '</span>').join('') + '</span>'
      : '';
    items.push({ v: String(x.job_id), label: 'j' + x.job_id + ' · ' + x.rows + ' 行', side });
  }
  if (cur && !(j.jobs || []).some(x => String(x.job_id) === cur)) {
    items.push({ v: cur, label: 'j' + cur });   // URL 指向清单外的老场：兜底
  }
  ddJob.set(items, cur);
  updateJobMeta();
  requestViews();
}
export function applyViews(j) {
  // 视角菜单（2026-10-06 用户拍板简化）：上帝(如有)→纯戏内→整场回放→角色
  // 一列——一个角色一行（hub views 按基形合并，不再按 (host,角色) 拆席），
  // 行尾挂 [host] 铭牌（该角色的出场宿主集合，复用场次下拉的 .jhost）。
  // 不再按宿主分组画分割线；无分组就不存在「未标来源」垫底的问题。
  const views = j.views || [];
  if (!views.some(x => String(x.id) === String(S.currentView))) {
    // 已在整场视角（REST 视图不在本清单）：不动——清单刷新不能把整场视角
    // 挤回 god（subscribeCurrent 也不发；切回正常视角才重新订阅）。
    if (S.currentView && String(S.currentView).indexOf('chronica:') === 0) return;
    // 回落优先 god:<host>（「刷新即真上帝视角」配套）：hub 清单挂规范 id——
    // 回落也落成规范 id，选中态高亮、URL、快照回显三者一致。无 god:host 条目
    // （hub 无任何会话账本/开演家没申报上帝窗）才回落裸 god（=job 账本）。
    const was = S.currentView;
    const gh = views.find(x => String(x.id).indexOf('god:') === 0);
    S.currentView = gh ? String(gh.id) : 'god';
    if (S.currentView !== was) dbgLocal('视角清单回落 ' + was + ' → ' + S.currentView);
  }
  updateComposer();   // 同步等待草稿（输入席显隐由 render 每轮按等待态+视角现判）
  const cur = String(S.currentView);
  // 上帝视角条目的宿主签（2026-09-22）：god:<host> 挂 [host] 铭牌，裸 god 挂
  // [最新]（跟随最新场账本的老语义）——收起的触发键也能看出是哪台的上帝窗
  // （用户：不展开菜单总不知道看的是哪台）。签复用场次下拉的 .jhost 铭牌。
  const godSide = (v) => {
    const id = String(v.id || '');
    if (id === 'god') return '<span class="jhosts"><span class="jhost">最新</span></span>';
    if (id.indexOf('god:') === 0)
      return '<span class="jhosts"><span class="jhost">' +
        esc(String(v.host || id.slice(4)).trim()) + '</span></span>';
    return '';
  };
  // 角色条目的宿主签（2026-10-06）：出场宿主集合去重并排（常态一家；多宿主
  // 共演同名角色时并排挂多个）。
  const side = (v) => {
    const id = String(v.id || '');
    if (id === 'god' || id.indexOf('god:') === 0) return godSide(v);
    const hs = Array.isArray(v.hosts) ? v.hosts.filter(h => typeof h === 'string' && h) : [];
    return hs.length
      ? '<span class="jhosts">' + hs.map(h => '<span class="jhost">' + esc(h) + '</span>').join('') + '</span>'
      : '';
  };
  const items = views.map(v => ({ v: v.id, label: v.name, side: side(v) }));
  ddView.set(items, cur);
}
