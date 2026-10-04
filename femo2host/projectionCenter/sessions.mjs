/**
 * sessions.mjs — 主会话面板（自单文件页拆出，2026-09-26）：常驻一等面板，
 * 每接入宿主一行 = 宿主名 + 该宿主 FEMO 会话下拉。数据=hub ctrl 'sessions'
 * （roster=宿主上报的名单、bindings=当前主会话指针）；选中即 ctrl 'bind'，
 * hub 换绑后广播同款载荷（含 god:<host> 新快照）——页面零轮询跟着刷新。
 * 渲染串比对：签名不变不重建 DOM（下拉开合不被打断）。
 * 会话↔角色绑定标注（cast 偏好账，2026-09-25）：名册条目后缀「（绑:soul）」
 * =该会话认领的角色（FEMO 会话 header 绑定按钮写进 hub 的 cast-preferences）。
 * 轮询刷新——绑定多发生在启动运行前，页面不是实况镜，30s 量级足够。
 */
import { S } from './state.mjs';
import { esc } from './util.mjs';
import { attachDropdown, requestJobs, requestViews, subscribeCurrent } from './panels.mjs';
import { dbgLocal } from './debug-panel.mjs';

let sessState = {};        // hub ctrl 'sessions' 载荷原样（roster/bindings/hosts）
let sessSig = '';          // 渲染串比对签名
const elSessBody = document.getElementById('sessPanelBody');
let castByHost = {};
async function refreshCastPrefs() {
  try {
    const r = await fetch('/sessions/cast-preferences');
    const data = await r.json();
    if (data && data.ok) {
      castByHost = data.hosts || {};
      sessSig = '';            // 强制重渲染名册（标注可能变了）
    }
  } catch { /* hub 不可达：无名册标注，不影响其他 */ }
}
// 启动口：cast 偏好账拉一次 + 30s 轮询 + 折叠态接线（拆分纪律：顶层只准定义
// 与注册，「触发」收进 main 的 boot，经此口启动）。
export function startSessions() {
  refreshCastPrefs();
  setInterval(refreshCastPrefs, 30000);
  setupCollapse();
}
// ── 折叠（2026-09-27 用户拍板收成卡片；2026-10-03 用户拍板：对所有生效——主会话
// 默认折叠）：每次载入一律收起，点头部可展开，刷新回缺省。原「状态记 localStorage
// （pc-sesspanel），没动过才缺省收起」随本条退役——存过「展开」的浏览器会永远
// 开着，默认值形同虚设。名册是「设好就不常动」的东西，不常驻占版面。──
function setupCollapse() {
  const panel = document.getElementById('sessPanel');
  const head = document.getElementById('sessPanelHead');
  if (!panel || !head) return;
  let expanded = false;   // 缺省收起（2026-10-03 拍板）；点击翻转，只活本页，刷新回缺省
  const apply = () => {
    panel.classList.toggle('collapsed', !expanded);
    head.setAttribute('aria-expanded', String(expanded));
  };
  head.addEventListener('click', () => { expanded = !expanded; apply(); });
  apply();
}
function castSuffix(host, sid) {
  const soul = ((castByHost[host] || {})[String(sid)] || {}).soul;
  return soul ? '（绑:' + esc(soul) + '）' : '';
}
function sessLabel(e) { return (e && e.name && String(e.name).trim() !== '') ? e.name : String(e.sid); }
function applySessions() {
  const roster = sessState.roster || {}, bindings = sessState.bindings || {};
  const hosts = [...new Set([...Object.keys(roster), ...Object.keys(bindings)])].sort();
  const perHost = hosts.map(h => {
    const cur = (bindings[h] && bindings[h].current) ? String(bindings[h].current) : '';
    // 名字=宿主上报的成品（roster 全量含 active=false：历届 mains 与兜底 current
    // 的显示名反查都用它——hub 不解析名字，页面只查表展示）。
    const nameBySid = new Map((roster[h] || []).map(e => [String(e.sid), sessLabel(e)]));
    const entries = (roster[h] || [])
      .filter(e => e.active !== false)
      .map(e => ({ v: String(e.sid), label: sessLabel(e) + castSuffix(h, e.sid) }));
    if (cur && !entries.some(e => e.v === cur)) entries.unshift({ v: cur, label: (nameBySid.get(cur) || cur) + castSuffix(h, cur) });
    // 顺序=hub 给的（宿主 UI 序，宿主界面咋排咱就咋排）；只把当前主会话拉顶。
    entries.sort((a, b) => (a.v === cur ? -1 : b.v === cur ? 1 : 0));
    // 「-」的判据=hub 的绑定账（current 空=与本次无关），不是名册有无——
    // standalone 这类没报名册的宿主（没有宿主进程 announcer）也参过戏，
    // current 已被联动清空，按名册判会误显「暂无 FEMO 会话」。历届 mains
    // 兜底进菜单（分组垫底），这样的宿主也能显式换绑。
    const mains = ((bindings[h] && bindings[h].mains) || [])
      .filter(s => s && !entries.some(e => e.v === String(s)));
    const legacy = mains.length > 0
      ? [{ group: '历届主会话' }].concat(mains.map(s => ({ v: String(s), label: nameBySid.get(String(s)) || String(s) })))
      : [];
    return { h, cur, entries, legacy };
  });
  const sig = JSON.stringify(perHost);
  if (sig === sessSig) return;
  sessSig = sig;
  elSessBody.innerHTML = '';
  if (perHost.length === 0) return;
  for (const { h, cur, entries, legacy } of perHost) {
    const row = document.createElement('div');
    row.className = 'sessrow';
    row.innerHTML = '<span class="sesshost">' + esc(h) + '</span>' +
      '<span class="dd"><button type="button" class="dd-btn"><span class="dd-label"></span></button>' +
      '<div class="dd-menu" hidden></div></span>';
    elSessBody.appendChild(row);
    const ddEl = row.querySelector('.dd');
    const dd = attachDropdown(ddEl, ddEl.querySelector('.dd-btn'), ddEl.querySelector('.dd-menu'), (v) => {
      if (v === '' || !S.ws || S.ws.readyState !== 1) return;
      dbgLocal('选中主会话 ' + h + ':' + v + '（bind+联动）');
      S.ws.send(JSON.stringify({ ctrl: 'bind', session: h + ':' + v }));
      // 选中主会话 → 自动挂上该会话的最新场次（roster 条目自带 job，宿主
      // 从 host-history 账读出来的 currentJobId）：场次下拉、URL、时间线一起切。
      // 视角同时拉回裸 god（若停在 god:<host> 主会话生活账上，切 job 也不会
      // 变——那视角不读 job；既然要「加载那场戏」，就看最新运行）。
      const entry = ((sessState.roster || {})[h] || []).find(e => String(e.sid) === v);
      const job = entry && typeof entry.job === 'number' && entry.job > 0 ? String(entry.job) : '';
      if (job) {
        S.selectedJob = job;
        S.currentView = 'god';
        const u = new URL(location.href);
        u.searchParams.set('job', S.selectedJob);
        u.searchParams.delete('view');
        history.replaceState(null, '', u);
        requestJobs();        // 场次下拉刷新（applyJobs 认 selectedJob 换触发键名）
        requestViews();
        subscribeCurrent();   // 时间线切到那场戏
      }
    });
    // 现役名单 + 历届 mains 合并展示（2026-09-22 用户拍板「统一起来都加上」）：
    // 旧写法 entries 非空时历届组整个不画——dsh 名册空但绑定账有 current，
    // current 被 unshift 进 entries，历届 mains 就永远轮不到；只有 standalone
    // 这种无现役的宿主才看得见历届。现在一律现役在前、历届分组垫底。
    const items = entries.length > 0 || legacy.length > 0
      ? entries.concat(legacy)
      : [{ v: '', label: '暂无 FEMO 会话' }];
    dd.set(items, cur);
    // current 空=该宿主与当前场次无关（跨宿主联动清的，2026-09-22）：触发键
    // 显示「-」；只要绑定账里有历史（名单或历届 mains），菜单就能点选换绑。
    // 「暂无 FEMO 会话」只剩兜底：名册与绑定对这个宿主一无所知。
    if (entries.length === 0 && legacy.length === 0)
      dd.setLabel('<span class="dd-label sessempty">暂无 FEMO 会话</span>');
    else if (!cur) dd.setLabel('<span class="dd-label sessempty">-</span>');
  }
}
// WS 分派入口（分派器只转调）：载荷进本件私有账，再走渲染比对。
export function applySessionsPayload(j) {
  sessState = j;
  applySessions();
}
