/**
 * debug-panel.mjs — print 旁路调试浮层（自单文件页拆出，2026-09-26）。
 * 数据源=桥进程 stdout/stderr 的旁观镜像（hub 广播 ctrl 'print'，与时间轨共用
 * 同一条 WS）。只读镜像：这里的一切在桥/引擎原管道里原样存在。
 * 数据面纪律（2026-09-22 修过 bug，注释有案底）：dbgClearAll 必须**整体替换**、
 * dbgSetItems 是「按 seq 合并」语义（拉历史用）——清空按钮曾被合并语义两头吃掉，
 * 这两个函数不许被后人「统一」。
 */
import { S } from './state.mjs';
import { esc, hhmmss } from './util.mjs';

let dbgOpen = false;
let dbgItems = [];            // [{seq,t,stream,text}] 时间正序；上限与 hub 环同款
const DBG_CAP = 500;
// 双实例（2026-10-05 页尾镜像行）：这排钮在顶栏和页尾各住一份（页尾是
// main.mjs mirrorRow 的克隆、id 已剥）——面板/徽章/清空/复制一律按类名
// 全场查询、逐实例写，不认 id；开合状态只有一份（dbgOpen），两处同步开合。
const dbgWraps  = () => document.querySelectorAll('.dbg-wrap');
const dbgBtns   = () => document.querySelectorAll('.topbtn[data-act="dbg"]');
const dbgCnts   = () => document.querySelectorAll('.tb-badge.cnt');
const dbgBodies = () => document.querySelectorAll('.dbg-body');

function dbgCntText(n) { return n > 999 ? '999+' : String(n); }
function dbgLineHtml(it) {
  const err = it.stream === 'stderr';
  return '<div class="dbg-line' + (err ? ' stderr' : '') + '"><span class="lt">' +
    hhmmss(it.t) + '</span><span class="ls">' + (err ? 'stderr' : 'stdout') +
    '</span><span class="lx">' + esc(it.text) + '</span></div>';
}
export function dbgAppend(it) {
  if (!it || typeof it.text !== 'string') return;
  dbgItems.push(it);
  while (dbgItems.length > DBG_CAP) dbgItems.shift();
  const cnt = dbgCntText(dbgItems.length);
  for (const el of dbgCnts()) el.textContent = cnt;
  if (!dbgOpen) return;                    // 关着时只记数，不动 DOM
  for (const body of dbgBodies()) {
    const empty = body.querySelector('.dbg-empty');
    if (empty) empty.remove();
    const stick = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
    body.insertAdjacentHTML('beforeend', dbgLineHtml(it));
    while (body.children.length > DBG_CAP + 20) body.removeChild(body.firstChild);
    if (stick) body.scrollTop = body.scrollHeight;
  }
}
// ── 页面本地诊断行（2026-09-22）：打进 print 浮层——手机没有 F12，视角流转
// （订阅发出/快照回执/回显校正/清单回落）全在这条线里看得见。seq 用负数递减
// （绝不与 hub 的正 seq 相撞），排序时映射到尾部：本地行恒在最底、最新。──
let dbgLocalSeq = 0;
export function dbgLocal(text) {
  dbgAppend({ seq: --dbgLocalSeq, local: true, t: Date.now(),
              stream: 'stdout', text: '◇ ' + text });
}
export function dbgSetItems(items) {
  // 与实时帧可能交叠（开浮层拉历史的那一拍）：按 seq 去重合并，序号排好再截断
  const bySeq = new Map(dbgItems.map(x => [x.seq, x]));
  for (const it of (Array.isArray(items) ? items : [])) bySeq.set(it.seq, it);
  dbgItems = [...bySeq.values()]
    .sort((a, b) => (a.local ? 1e18 + (a.seq || 0) : (a.seq || 0)) -
                     (b.local ? 1e18 + (b.seq || 0) : (b.seq || 0)))
    .slice(-DBG_CAP);
  const cnt = dbgCntText(dbgItems.length);
  const html = dbgItems.length
    ? dbgItems.map(dbgLineHtml).join('')
    : '<div class="dbg-empty">暂无 print。桥进程里任何 print / stderr 行都会出现在这里。</div>';
  for (const el of dbgCnts()) el.textContent = cnt;
  for (const body of dbgBodies()) {
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;
  }
}
function dbgRequestHistory() {
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ ctrl: 'prints', limit: 200 }));
}
// 清空（2026-09-22 修）：必须走替换而非 dbgSetItems([])——后者是拉历史用的
// 合并语义（现有内容 ∪ 新清单），传空集等于什么也不干，清空按钮两头都被它
// 吃掉（本地清不掉；hub 回的 prints-cleared 也清不掉）。替换后新 print 照常
// append，本地诊断行也会重新长（清的是屏不是关诊断）。
export function dbgClearAll() {
  dbgItems = [];
  const empty = '<div class="dbg-empty">暂无 print。桥进程里任何 print / stderr 行都会出现在这里。</div>';
  for (const el of dbgCnts()) el.textContent = '0';
  for (const body of dbgBodies()) {
    body.innerHTML = empty;
    body.scrollTop = 0;
  }
}
export function dbgReconnectRefresh() {
  if (dbgOpen) dbgRequestHistory();   // 浮层开着时重连补历史
}
// 开合委托（2026-10-05 镜像行）：顶/底两颗虫子钮是克隆关系，按 data-act 认亲
// 不认 id——谁点都拨同一个 dbgOpen，两处面板/按钮同步。
document.addEventListener('click', (e) => {
  if (!e.target.closest('.topbtn[data-act="dbg"]')) return;
  dbgOpen = !dbgOpen;
  for (const w of dbgWraps()) w.classList.toggle('open', dbgOpen);
  for (const b of dbgBtns()) {
    b.classList.toggle('on', dbgOpen);           // 新拟物压凹激活态
    b.setAttribute('aria-pressed', String(dbgOpen));
  }
  if (dbgOpen) dbgRequestHistory();        // 开浮层拉一次历史（hub 是权威）
});
// 清空委托（2026-09-22 的替换语义不动，只换成双实例认亲）：两处清空钮等价。
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dbg-clear')) return;
  dbgClearAll();
  if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ ctrl: 'prints-clear' }));
});
// 复制：把当前镜像环导出成「[时间][流] 内容」逐行文本。clipboard API 需要
// 安全上下文（localhost/https/file 都算），execCommand 兜底其余场景。
// 委托同上：两处复制钮等价，闪的只是点中的那颗。
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.dbg-copy');
  if (!btn) return;
  const text = dbgItems.map(it =>
    '[' + hhmmss(it.t) + '][' + (it.stream === 'stderr' ? 'stderr' : 'stdout') + '] ' + it.text
  ).join('\n');
  const flash = (ok) => {
    btn.textContent = ok ? '已复制' : '复制失败';
    btn.classList.toggle('flash-ok', ok);
    setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('flash-ok'); }, 1200);
  };
  const fallbackCopy = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove(); return ok;
    } catch (e) { return false; }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => flash(true), () => flash(fallbackCopy()));
  } else flash(fallbackCopy());
});
