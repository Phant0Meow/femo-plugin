/**
 * render.mjs — 时间轨渲染管线（自单文件页拆出，2026-09-26）。
 * 全量重绘制：rows + 直播块 → HTML 串，与上次相同就不写 DOM（让 CSS 动画播完）；
 * 重绘前后做焦点/光标保卫（直播打字与就地输入不丢字）。就地输入的草稿值不进
 * 渲染串、写完 DOM 后回填（2026-09-26）——打字不改渲染串，护栏不被打字击穿。
 * 本件的 seatForSeg/seatAllowed/outVarsFor/draftOfSeg 是「等待态问询」的判据
 * 单源（2026-10-02 等待席位清单化：段键对席位、席位问视角/变量/草稿）：
 * composer 单向 import 本件，反向绝不 import composer——环不存在（施工清单 §六）。
 * pendingPlugins（插件注入行攒队）是本件私有：render 从 rows 里摘出来、并进
 * 位置最近的段，WS 分发器不碰它。
 */
import { S } from './state.mjs';
import { esc, hostTag, faIcon, tagHtml, hhmmss, fitTextarea } from './util.mjs';
import * as HRC from '/host/hub-render-core.mjs';

const elTl = document.getElementById('tl');
// 停靠席独占容器（2026-10-03 拆分）：人类输入席住在 #dock，与主轨分开重绘——
// 上面节点的更新与流式增量只重写 #tl，#dock 纹丝不动，输入框的聚焦/光标/
// 输入法组词不被拆建打断（修「流式输出影响人类输入框」的根）。
const elDock = document.getElementById('dock');
// 已退役-遥测带（2026-10-03 用户拍板「我们不需要显示它」）：#stats 槽位已从
// index.html 注释退场，取元素与下方填充段同批注释——留着就是每轮渲染空引用。
// const elStats = document.getElementById('stats');
let pendingPlugins = [];   // 待并入下一段的插件注入行（render 每轮消费，见头部注释）

// 段键 → 等待席位：2026-10-02 复数化后等待态是席位清单，段靠 seg 对上其中
// 一席。段键的权威在 hub（含续跑世代键 :gN——hub 定、页面照抄，不自己拼）。
export function seatForSeg(seg) {
  const s = String(seg || '');
  if (!s) return null;
  return S.waitingSeats.find(x => String(x.seg || '') === s) || null;
}
// 本视角是否许在这一席输入（§5.3 可见性矩阵收共享规范件 hub-render-core）。
export function seatAllowed(seat) {
  return HRC.composerAllowedFor(S.currentView, seat);
}
// 席位所在节点声明的 out 变量名（2026-09-24 赋值浮层数据源，与 DSH 投影窗
// composer 的 run.outVars 同源——引擎 human_wait 事件 out_vars 字段经 hub
// 等待态捎带）。
export function outVarsFor(seat) {
  const v = seat ? seat.out_vars : null;
  return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
}
// 段键 → 该席的就地草稿（段先对上席位，再按 wait_key 取草稿）。
export function draftOfSeg(seg) {
  const seat = seatForSeg(seg);
  return seat ? (S.ihumanDrafts[seat.wait_key] || null) : null;
}

// ── 贴底跟随 + 滚到底按钮（2026-09-21；刷新归顶同日二次拍板）：和所有 AI 网页
// 同款——流式输出期间**本来在底**才跟着长，往上翻了绝不打扰；右下角圆钮点一下
// 回到底，到底自动隐身。
// 贴底判据是 followBottom 旗，不是渲染瞬间的位置：开屏账本还空着、任何位置都
// 是「底」，拿位置判会把首帧快照误判成贴底、刷新就一头扎到底（本条修的正是它）。
// 旗的走向：刷新起步 false（= 归顶）；scroll 事件实时校准（上翻即假，条件3）；
// 点圆钮置真（点了即「就在最底」，条件2）。渲染只认旗（条件1）。
// 整页滚动（.tl 无自身 overflow），判定挂 window；阈值 64px 容忍行高抖动。──
function atBottom() {
  const doc = document.documentElement;
  return window.innerHeight + window.scrollY >= doc.scrollHeight - 64;
}
function scrollToBottom() {
  window.scrollTo(0, document.documentElement.scrollHeight);
}
let followBottom = false;
// 贴底刷新（2026-09-29 用户拍板）：底部刷新钮在 reload 前把旗写进 sessionStorage
// （本标签页私有，别的窗不受影响），这里起步读旗——有旗=本次刷新要保持贴底：
// 置 followBottom=true，首帧快照落地就扎底、之后照常跟随；用完即焚，顶部刷新
// 与浏览器 F5 不带旗，仍归顶（2026-09-21 拍板不动）。
try {
  if (sessionStorage.getItem('pc-bottom-reload') === '1') {
    sessionStorage.removeItem('pc-bottom-reload');
    followBottom = true;
  }
} catch (e) {}
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';   // 刷新归顶：浏览器别恢复上次位置
const elJump = document.getElementById('jumpBtm');
elJump.innerHTML = faIcon('chevdown', 16);
elJump.addEventListener('click', () => { followBottom = true; scrollToBottom(); });
// 回顶圆钮（2026-10-04）：与回底钮镜像——位置镜像（右上对右下）、行为镜像
// （点了就离开底：旗写 false，否则下一轮流式更新会被 stick 又拽回底）。
const elJumpTop = document.getElementById('jumpTop');
elJumpTop.innerHTML = faIcon('chevup', 16);
elJumpTop.addEventListener('click', () => { followBottom = false; window.scrollTo(0, 0); });
// 拆分注记（2026-09-26）：updateJump 在单文件里同名定义过两遍（旧 1224/1232，
// 后者无声覆盖前者），死版已随拆清掉，只留生效版；两个 scroll 监听也只挂一个。
// 阈值内防抖（2026-09-22）：刚才在底、现在只在阈值 64px 邻域里不算上翻——
// 流式长高时 scroll 事件在底附近抖，没有这层会把「本来在底」误判假、跟丢。
let lastNearBottom = true;
function updateJump() {
  elJumpTop.hidden = window.scrollY <= 0;   // 回顶钮：离开页顶即现身（页顶没有底部那层抖动，判据用不着阈值）
  const b = atBottom();
  if (!b && lastNearBottom && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 64 - 48) {
    elJump.hidden = false; return;   // 阈值邻域：只更新按钮显隐，不动旗
  }
  lastNearBottom = b;
  followBottom = b;
  elJump.hidden = b;
}
window.addEventListener('scroll', updateJump, { passive: true });
// 开屏「刷新即扎底」真凶（2026-09-22 终修）：render() 每轮都调 updateJump()，
// 而首帧快照到达前页面高度不足一屏，atBottom() 平凡为真——旗被提前写真，
// 首帧真内容一落地就被 stick 滚到底。改法：渲染路径里只更新按钮显隐，
// 不写旗；旗只由真实用户滚动/点圆钮驱动（快照到达后由 scroll 事件校准）。
function updateJumpFromRender() {
  elJumpTop.hidden = window.scrollY <= 0;
  elJump.hidden = atBottom() || !S.snapSeen;
}

// ── 折叠（思考链/工具调用/工具结果；2026-09-20 cot 拍板、2026-09-21 工具两行跟进）：
// 默认全折，点头部展开/收起。展开状态存内存 Set（页面不落盘，刷新即回默认）；
// 整页重渲染靠 data-foldkey 找回状态。
// key 约定：独立行=t:n，段内条目=t:n:i，段内草稿=t:n:d<i>，直播块=live:<blockKey>。──
const foldOpen = new Set();
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.fold-head');
  if (!btn) return;
  const k = btn.getAttribute('data-foldkey');
  if (!k) return;
  if (foldOpen.has(k)) foldOpen.delete(k); else foldOpen.add(k);
  render();
});
// 折叠块唯一构造口：boxCls=容器类（cot / tool / tool toolres），fold.open 挂容器；
// bodyCls 落在 .fold-body（草稿光标随正文，折叠时不漏出来）。
function foldDiv(key, boxCls, headHtml, bodyHtml, bodyCls) {
  const open = foldOpen.has(String(key));
  return '<div class="' + boxCls + ' fold' + (open ? ' open' : '') + '">' +
    '<button class="fold-head" type="button" data-foldkey="' + esc(String(key)) + '">' +
    headHtml + '<span class="fold-caret"></span></button>' +
    '<div class="fold-body' + (bodyCls ? ' ' + bodyCls : '') + '">' + bodyHtml + '</div></div>';
}

export function render() {
  const mainParts = [];
  const dockParts = [];   // 停靠席行（容器=#dock，见文件头 elDock 注）
  // 独立行（旧账兜底）同款合并（2026-09-21 拍板，纯显示层）：工具结果紧跟工具
  // 调用才配对；配不上的孤儿随结果栏退役不显示。段内 items 的配对在 rowHtml。
  const disp = [];
  // 底部停靠席（2026-10-02 用户拍板）：open 且对得上等待席位、本视角又许输入
  // 的人类段，整段从自然行位摘出，钉在时间轨最末（直播块之后）——等待中新到的
  // AI 流式输出长在它上面；交卷收口 hub 搬家落号账末（视觉上就在原位转正），
  // 停靠随之消失。多席并发按行序（=human_wait 到达序）一条条排。
  const docks = [];
  const docked = (r) => {
    if ((r.kind || '') !== 'section' || !r.open) return false;
    const seat = seatForSeg(r.seg);
    return !!(seat && seatAllowed(seat));
  };
  // 插件注入行（2026-09-21 三次拍板修正）：**各并进自己位置之后最近的一个段**
  // ——第一版全局队列会把整场的料包都吸给第一段，位置全丢。这里单遍顺序走：
  // 插件行进 pendingPlugins；遇到段容器（kind=section 且非插件/用户之外的特殊
  // 行）就把**当前攒着的**料包挂到该段 _plugs 上并清空队列——后续料包归后续段。
  // 结尾没等到段的，render 末尾兜底独立折叠块，不丢内容。
  for (const r of S.rows) {
    const prev = disp[disp.length - 1];
    if ((r.kind || '') === 'tool_result' && prev && (prev.kind || '') === 'tool' && !prev._res) {
      disp[disp.length - 1] = Object.assign({}, prev, { _res: r });
      continue;
    }
    if ((r.zone || '') === 'outside' && (r.kind || '') === 'whisper' && r.actor === '插件') { pendingPlugins.push(r); continue; }
    if ((r.kind || '') === 'section' && pendingPlugins.length) {
      r._plugs = pendingPlugins.splice(0);
    }
    if (docked(r)) docks.push(r); else disp.push(r);
  }
  for (const r of disp) mainParts.push(rowHtml(r));
  // 位置在最后、没等到段的插件行（后面全是直播块/账本结尾）：兜底独立折叠块
  for (const p of pendingPlugins.splice(0)) mainParts.push(rowHtml(p));
  // 打字机中的块
  for (const b of S.liveBlocks.values()) mainParts.push(liveRowHtml(b));
  // 停靠席行进 #dock（序=行序=human_wait 到达序；行还没落账的席位这拍不画，
  // 下一拍行到了自然出现——human_wait 广播早于段落账半拍，hub 既有节奏）
  for (const r of docks) dockParts.push(rowHtml(r));
  // 空态提示（首帧快照到达后才判空——开屏的一瞬不算）：空账本≠坏掉，
  // 告诉用户去看哪、等什么（2026-09-21「经常不加载对话」排障附带）。
  if (S.snapSeen && S.rows.length === 0 && S.liveBlocks.size === 0) {
    const emptyText = String(S.currentView).indexOf('god:') === 0
      ? '这本主会话账本还没有内容——它记的是这扇窗里FEMO外的对话；想看运行实况，在「Job」菜单选（或视角回落「上帝视角」）。'
      : '这本账还没有内容（新 Job 启动运行或说话后，这里会长出字）。';
    mainParts.push('<div class="row metaRow"><div class="meta plain"><span>' + esc(emptyText) + '</span></div></div>');
  }
  // 双容器各记各的备忘、各写各的（2026-10-03 拆分的意义）：上面节点的更新与
  // 流式增量只动主轨——#dock 整块纹丝不动，正在打字的输入框不被拆建，聚焦/
  // 光标/输入法组词全程不被打断；#dock 只在人类席自身状态变化（点开/收起/
  // 寄出/席位增减）时才重写。让呼吸/光标这些 CSS 动画能完整播完的老规矩照旧。
  const mainHtml = mainParts.join('');
  const dockHtml = dockParts.join('');
  if (mainHtml !== render._lastMain || dockHtml !== render._lastDock) {
    const stick = followBottom;   // 只认贴底旗（刷新起步=false 归顶；上翻即假）；开屏空账本拿位置判会误贴底
    // 内联输入席防抖（2026-09-21）：重绘会拆掉 textarea——写之前抓焦点与光标，
    // 写完原样接回；点开那一拍（_focus）直接聚焦新输入行。直播打字与全量重绘
    // 再多，就地输入也不丢字、不丢焦点。
    const ael = document.activeElement;
    const held = ael && ael.classList && ael.classList.contains('ihuman-text');
    const heldSeg = held ? ael.getAttribute('data-seg') : null;
    const heldPos = held ? [ael.selectionStart, ael.selectionEnd] : null;
    // 点开请求焦点的那一席（_focus 每席一份，找到即取其段键）
    let wantFocus = null;
    for (const seat of S.waitingSeats) {
      const d = S.ihumanDrafts[seat.wait_key];
      if (d && d._focus) { wantFocus = String(seat.seg || ''); d._focus = false; break; }
    }
    if (mainHtml !== render._lastMain) { render._lastMain = mainHtml; elTl.innerHTML = mainHtml; }
    if (dockHtml !== render._lastDock) { render._lastDock = dockHtml; elDock.innerHTML = dockHtml; }
    // 草稿回填（草稿不进渲染串，见 doingHtml/varRowsHtml 注）：真重绘后把内存
    // 草稿按 data-seg 对号接回各席的新壳（多席并发各回各的）。同一拍完成不产
    // 生中间帧；下面的焦点保卫靠值先回到框里。两容器都查（输入席在 #dock）。
    for (const root of [elTl, elDock]) {
      for (const ta of root.querySelectorAll('textarea.ihuman-text')) {
        const d = draftOfSeg(ta.getAttribute('data-seg'));
        if (d) { ta.value = d.text; fitTextarea(ta); }   // 回填后照内容撑高（单行起步随内容长，2026-10-02 人类席拍板）
      }
      for (const inp of root.querySelectorAll('input.var-input[data-varname]')) {
        const d = draftOfSeg(inp.getAttribute('data-seg'));
        const n = inp.getAttribute('data-varname') || '';
        if (d && n) inp.value = String(d.vars[n] ?? '');
      }
    }
    const refocusSeg = heldSeg || wantFocus;
    if (refocusSeg) {
      const q = String(refocusSeg).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const ta = elDock.querySelector('textarea.ihuman-text[data-seg="' + q + '"]') ||
        elTl.querySelector('textarea.ihuman-text[data-seg="' + q + '"]');
      if (ta) {
        ta.focus();
        try { ta.setSelectionRange(heldPos ? heldPos[0] : ta.value.length, heldPos ? heldPos[1] : ta.value.length); } catch (e) {}
      }
    }
    if (stick) scrollToBottom();
  }
  // 已退役-遥测带（2026-10-03 用户拍板「我们不需要显示它」）：填充段与取元素、
  // index.html 槽位三处同批注释（恢复=三块连解注）。
  // const cnt = {};
  // for (const r of S.rows) cnt[r.zone] = (cnt[r.zone] || 0) + 1;
  // elStats.innerHTML =
  //   '<span class="stat"><i>Job</i><b>' + (S.currentJobId == null ? '—' : 'j' + S.currentJobId) + '</b></span>' +
  //   '<span class="stat"><i>视角</i><b>' + esc(S.currentView) + '</b></span>' +
  //   '<span class="stat"><i>语义行</i><b>' + S.rows.length + '</b></span>' +
  //   '<span class="stat"><i>FEMO内</i><b>' + (cnt.inplay || 0) + '</b></span>' +
  //   '<span class="stat"><i>FEMO外</i><b>' + (cnt.outside || 0) + '</b></span>' +
  //   '<span class="stat"><i>运行事件</i><b>' + (cnt.meta || 0) + '</b></span>' +
  //   '<span class="stat"><i>直播</i><b>' + S.liveBlocks.size + '</b></span>';
  updateJumpFromRender();   // 内容长高了：只更新按钮显隐（旗不写，见函数注释）
}

// 行骨架：左轨节点 + 行头（来源宿主 · 时间戳 · #号）+ 内容
function rowShell(pip, head, body) {
  return '<div class="row"><div class="rail"><span class="pip ' + pip + '"></span></div>' +
    '<div class="cell"><div class="rowhead">' + head + '</div>' + body + '</div></div>';
}
function bannerHtml(mod, cls, icon, label, text) {
  return '<div class="banner' + (mod ? ' ' + mod : '') + cls + '">' + tagHtml(icon, label) +
    '<span class="txt">' + esc(text) + '</span></div>';
}
// 段落文本（思考链/正式回答共用）：连续空行（pre-wrap 下=整行高）折成一个按块
// 定高的小垫（.pgap），正文字符不动；只在渲染层折行距，hub/journal 数据不改。
function paraText(t) {
  return esc(String(t ?? '').replace(/\r\n?/g, '\n').replace(/\s+$/, ''))
    .replace(/\n[ \t]*(?:\n[ \t]*)+/g, '<span class="pgap"></span>');
}
// ── 正式发言 Markdown 渲染（2026-09-21 拍板）：say 槽与独立 say 气泡走 mdHtml；
// 思考链/耳语/场注等仍纯文本。手写小渲染器不引外部库（拆分后依旧），只收常用
// 件：围栏代码块（带语言签）/行内码/标题/列表（两级）/引用/管道表格/分隔线/
// 加粗斜体删除线/链接（仅 http(s)/mailto）。安全姿势：一切先 esc，转换只产
// 出自家标签，绝不回插外源 HTML；行内码内容抽 token 隔离，不吃其他转换。──
function mdInline(raw) {
  let s = esc(String(raw ?? ''));
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, (m, txt, url) =>
      '<a href="' + url.replace(/"/g, '%22') + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code class="mdinline">' + codes[+i] + '</code>');
}
function mdList(items) {
  const tops = [];
  for (const it of items) {
    if (it.lvl === 0 || !tops.length) tops.push({ ord: it.ord, txt: it.txt, kids: [] });
    else tops[tops.length - 1].kids.push(it);
  }
  // 相邻同 ord 的 top 归一张表；ord 变了另起（ul/ol 混排不串种，1. 不并进 - ）
  const groups = [];
  for (const tp of tops) {
    const g = groups[groups.length - 1];
    if (!g || g.ord !== tp.ord) groups.push({ ord: tp.ord, arr: [tp] });
    else g.arr.push(tp);
  }
  const rl = (arr, ord) => '<' + (ord ? 'ol' : 'ul') + '>' + arr.map(x =>
    '<li>' + mdInline(x.txt) + ((x.kids && x.kids.length) ? rl(x.kids, x.kids[0].ord) : '') + '</li>').join('') + '</' + (ord ? 'ol' : 'ul') + '>';
  return groups.map(g => rl(g.arr, g.ord)).join('');
}
function mdText(t) {
  t = String(t ?? '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  const lines = t.split('\n');
  const out = [];
  const cells = ln => { let x = ln.trim(); if (x.startsWith('|')) x = x.slice(1); if (x.endsWith('|')) x = x.slice(0, -1); return x.split('|').map(c => c.trim()); };
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i], tr = ln.trim();
    if (/^```/.test(tr)) {
      const lang = tr.slice(3).trim();
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++;
      out.push('<div class="mdcode">' + (lang ? '<div class="mdlang">' + esc(lang) + '</div>' : '') + '<pre><code>' + esc(buf.join('\n')) + '</code></pre></div>');
      continue;
    }
    if (tr === '') { i++; continue; }
    const hm = tr.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { out.push('<div class="md-h md-h' + hm[1].length + '">' + mdInline(hm[2]) + '</div>'); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(tr)) { out.push('<div class="md-hr"></div>'); i++; continue; }
    if (tr.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { buf.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      out.push('<div class="mdbq">' + mdInline(buf.join('\n')).replace(/\n/g, '<br>') + '</div>');
      continue;
    }
    if (tr.indexOf('|') >= 0 && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|[\s:|-]*$/.test(lines[i + 1])) {
      const headC = cells(tr); i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].indexOf('|') >= 0) { rows.push(cells(lines[i])); i++; }
      out.push('<div class="mdtabwrap"><table class="mdtable"><thead><tr>' + headC.map(c => '<th>' + mdInline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + headC.map((c, ci) => '<td>' + mdInline(r[ci] ?? '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(ln)) {
      const items = [];
      while (i < lines.length) {
        const mm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!mm) break;
        items.push({ lvl: mm[1].length >= 2 ? 1 : 0, ord: /\d/.test(mm[2]), txt: mm[3] });
        i++;
      }
      out.push(mdList(items));
      continue;
    }
    const buf = [];
    while (i < lines.length) {
      const x = lines[i], xt = x.trim();
      if (xt === '' || /^```/.test(xt) || /^#{1,6}\s+/.test(xt) || /^>/.test(xt) ||
          /^\s*([-*+]|\d+[.)])\s+/.test(x)) break;
      buf.push(x); i++;
    }
    if (!buf.length) { i++; continue; }
    out.push('<div class="mdp">' + mdInline(buf.join('\n')).replace(/\n/g, '<br>') + '</div>');
  }
  return out.join('');
}
function mdHtml(t) { return '<div class="md">' + mdText(t) + '</div>'; }

function bannerMeta(kind) {
  if (kind === 'prompt') return { mod: 'prompt', icon: 'pen', label: '输入提示' };
  if (kind === 'notice') return { mod: '', icon: 'horn', label: '公告' };
  return { mod: 'showprompt', icon: 'horn', label: '公告' };
}
function liveRowHtml(b) {
  const head = hostTag(b.host) + '<span class="t">' + hhmmss(Date.now()) + ' · 直播</span>';
  if (b.blockKind === 'reasoning') {
    return rowShell('k-teal', head, foldDiv('live:' + b.key, 'cot', tagHtml('brain', '思考链 · 正在思考…'), paraText(b.text), 'draft'));
  }
  return rowShell('k-gold', head, '<div class="bubble live"><div class="bwho">' + esc(b.actor || '') +
    ' · 正在输入…</div><span class="draft">' + esc(b.text) + '</span></div>');
}
// 工具结果内嵌行（2026-09-21 用户拍板：结果栏退役，结果并进工具调用折叠体）。
// **纯显示层合并，hub 数据结构不动**。入参=结果槽/结果行本体（带 toolResult，
// 定稿形状 toolResult{node,output}；旧账 text 兜底），在此统一拆包。
function reslineHtml(res) {
  const tr = res && res.toolResult ? res.toolResult : (res || {});
  const outStr = typeof tr.output === 'string' ? tr.output
    : (tr.output !== undefined ? JSON.stringify(tr.output) : String(tr.text ?? ''));
  return '<div class="resline">' + tagHtml('terminal', '工具结果' + (tr.node ? ' · ' + tr.node : '')) +
    '<code>' + esc(outStr.slice(0, 400)) + '</code></div>';
}
function itemHtml(it, draft, foldKey, whoTools) {
  // 容器里的槽（items）**不带来源前缀**：数据结构上 host 在段行（容器）上，
  // 槽没有 host——一个容器里的内容必然同源，标签画在容器头一次就够
  // （2026-09-19 用户拍板：页面要信实、严格地体现 hub 的数据结构）。
  // 段内条目（section.items）：**顺序就是 hub 定好的槽序**，这里只按 kind
  // 选样式、按数组序逐块照画，不排序不重排、不额外拼任何行
  // （2026-09-19 用户拍板：宿主无脑照抄）。
  // draft=正在写的那条（r.drafts）：同款样式 + 光标，写完原地变成历史条目。
  // whoTools=本段是人类展开席时挂在名字行右端的工具组（寄出/变量赋值）——
  // 只随名字槽出现（2026-10-02 用户拍板：按钮上名行，不另起行不撑行高）。
  // prompt 槽**到达即显示**（2026-10-03 用户报收口后看不见，拍板退役旧闸）：
  // 旧闸「点开才显（09-28）→ 在输入席就显（10-03）」整条退役——prompt 是头部
  // 槽，hub 槽序规整恒在人名之前、段收口后照存，视角取舍归 hub 策略矩阵
  // （VIEW_POLICY：god/人类视角发人类 prompt，stage/AI 视角不发），页面不再
  // 自设第二道闸——双重闸只会把收口后的历史人类节点藏成哑巴。
  const cls = draft ? ' draft' : '';
  const kind = it.kind || 'say';
  if (kind === 'name') {
    // 名字槽：hub 注入的头部槽之一——按 tag 选用段头样式，原位渲染纯名字
    if (whoTools) return '<div class="who"><span class="who-name">' + esc(it.text) + '</span>' + whoTools + '</div>';
    return '<div class="who">' + esc(it.text) + '</div>';
  }
  if (kind === 'cot') {
    const cotHead = tagHtml('brain', '思考链');
    if (foldKey == null) return '<div class="cot' + cls + '">' + cotHead + paraText(it.text) + '</div>';
    return foldDiv(foldKey, 'cot', cotHead, paraText(it.text), cls);
  }
  if (HRC.isBannerKind(kind)) {
    const m = bannerMeta(kind);
    return bannerHtml(m.mod, cls, m.icon, m.label, it.text);
  }
  if (kind === 'retry') return '<div class="retry' + cls + '">' + esc('重试反馈：' + String(it.text ?? '')) + '</div>';
  if (kind === 'fail') return '<div class="fail' + cls + '">' + esc('失败：' + String(it.text ?? '')) + '</div>';
  if (kind === 'narrate') return '<div class="narrate' + cls + '">' + esc(it.text) + '</div>';
  if (kind === 'tool') {
    const tc = it.toolCall || {};
    const nm = tc.name || it.name || 'unknown';   // 草稿态的工具名在 it.name 上（定稿在 toolCall 里）
    const argsStr = typeof tc.arguments === 'string' ? tc.arguments
      : (tc.arguments !== undefined ? JSON.stringify(tc.arguments) : String(it.text ?? ''));
    const toolHead = tagHtml('wrench', '工具调用 · ' + nm);
    // _res=rowHtml 段内配对时并入的结果槽（显示层字段，hub 不产）——展开即见
    const toolBody = '<code>' + esc(argsStr.slice(0, 400)) + '</code>' +
      (it._res ? reslineHtml(it._res) : '');
    if (foldKey == null) return '<div class="tool' + cls + '">' + toolHead + toolBody + '</div>';
    return foldDiv(foldKey, 'tool', toolHead, toolBody, cls);
  }
  if (kind === 'tool_result') {
    // 结果栏退役（2026-09-21 拍板）：正常路径已并进前面的工具调用折叠体
    // （配对见 rowHtml section 分支）；漏配的孤儿也不单独成栏。
    return '';
  }
  // 正式发言（say 槽）走 Markdown（2026-09-21 拍板）；思考链/场注等仍纯文本。
  return '<div class="say' + cls + '">' + mdHtml(it.text) + '</div>';
}
// 展开席右上工具组（2026-10-02 用户拍板）：变量赋值（节点声明 out 才画）+ 寄出，
// 与人类名字同行靠右（whoTools 挂进名字槽，见 itemHtml），高度压在原行高内。
// 变量面板本体仍由 doingHtml 画（开才画，挂名行之下、输入框之上）。
function seatToolsHtml(seat, draft, seg) {
  const vars = outVarsFor(seat);
  return '<span class="who-tools">' +
    (vars.length ? '<button type="button" class="varbtn" data-ihvar-toggle="1" data-seg="' + esc(seg) +
      '" aria-expanded="' + (draft.varsOpen ? 'true' : 'false') + '">' + faIcon('code', 11) + '<span>变量赋值</span></button>' : '') +
    '<button type="button" class="ihuman-send" data-seg="' + esc(seg) + '">寄出</button>' +
    '</span>';
}
// 「正在…」槽（2026-09-21 改版；2026-10-02 按席化+停靠+召唤行同款化+三拍收口）：
// AI 节点照旧呼吸「正在…」；轮到人类的那块（seg 对上等待席位 + 视角允许）：
// 收起=召唤行（「点这里输入发言……」，与 AI「正在…」行同款，只是可点；有草稿时
// 行内亮草稿首行——失焦收起草稿不丢，再点原地回到输入框继续）；展开=单行起步
// 随内容长高的输入框（寄出/变量赋值在名字行右端，见 seatToolsHtml）；已寄出=
// 等收账提示，出错就地显示、改改就能重寄。Esc 收起与快捷键提示行均已退役
// （2026-10-02 用户拍板：失焦即收）。本块随所在段整段停靠在时间轨最末（docks）。
function doingHtml(r) {
  const seat = seatForSeg(r.seg);
  const draft = seat ? S.ihumanDrafts[seat.wait_key] : null;
  if (!seat || !draft || !seatAllowed(seat)) {
    return '<div class="narrate doing">正在…</div>';
  }
  if (draft.busy) {
    return '<div class="ihuman-note busy">已寄出，等引擎收账…</div>';
  }
  if (!draft.expanded) {
    const t = String(draft.text || '');
    const has = !!t.trim();
    const label = has ? (t.split('\n')[0] || '…') : '点这里输入发言……';
    return '<button type="button" class="ihuman-hint narrate doing' + (has ? ' has-draft' : '') +
      '" data-seg="' + esc(r.seg) + '" title="' + (has ? '草稿已保留 · 点击继续输入' : '点击就地输入') + '">' +
      esc(label) + '</button>';
  }
  // 变量面板（2026-09-24）：节点声明 out 且已展开面板才画；赋值钮自身在名字行
  // （seatToolsHtml）。值存该席草稿的 vars，render 重绘不丢。
  const varUi = (outVarsFor(seat).length > 0 && draft.varsOpen)
    ? '<div class="varpanel">' + varPanelHtml(r.seg) + '</div>'
    : '';
  return varUi +
    // 草稿值不进渲染串（render 写完 DOM 后经 .value 回填+fit 撑高）：打字只改
    // DOM 现值、渲染串不动，「与上次相同就不写 DOM」的护栏才守得住——此前草稿
    // 拼在串里，每敲一个键整条时间轨跟着全量重画（IME 组合被打断=中文打不进；
    // 实测 web 侧栏投影中心）。
    '<textarea class="ihuman-text" data-seg="' + esc(r.seg) + '" rows="1" ' +
    'placeholder="直接输入 · Enter 寄出 · Shift+Enter 换行"></textarea>' +
    (draft.err ? '<div class="ihuman-note err">' + esc(draft.err) + '</div>' : '');
}
// 席位内联变量浮层的面板（DSH 投影窗 composer 同款构造；底部输入框退役后，
// 消费方只剩本件 doingHtml——同样语义只许一份，收归内部不再导出）。
// seg 随面板下发：多席并发时各控件带 data-seg，事件与草稿按段对号入席。
function varRowsHtml(seg) {
  // 赋值框现值同样不进渲染串（同 textarea 一款病）：各席草稿由 render 回填。
  return outVarsFor(seatForSeg(seg)).map(n =>
    '<div class="var-row"><span class="var-name" title="' + esc(n) + '">' + esc(n) + '</span>' +
    '<span class="var-eq" aria-hidden="true">=</span>' +
    '<input class="var-input" data-varname="' + esc(n) + '" data-seg="' + esc(seg) + '" placeholder="留空=不赋值" spellcheck="false"></div>').join('');
}
function varPanelHtml(seg) {
  return '<div class="var-head">本节点变量赋值（可只填其中几项）</div>' + varRowsHtml(seg) +
    '<button type="button" class="var-confirm" data-seg="' + esc(seg) + '">' + faIcon('check', 12) +
    '<span>确认赋值并发送</span></button>';
}
function rowHtml(r) {
  // 来源标签画在**行头**（时间戳那一行）——2026-09-19 用户拍板。数据侧
  // 没变（host 仍在段行上），只是换了个落点：行头标来源，容器头与正文保持干净。
  // 2026-09-22 拍板：行号（#n）不再显示（排查价值低、占视觉）；n 仍是数据主键。
  // （引擎常驻化施工清单挂账的「行头徽标改读段键」一刀落在这里。）
  // 行头徽标：新账本行不带 host 字段（刀1 归属单源），剖段键取宿主段
  const head = hostTag(r.host || HRC.segHostOf(r.seg)) + '<span class="t">' + hhmmss(r.t) + '</span>';
  // Job 栏（2026-09-21 起是整个运行状态消息家族：运行开始/继续/运行结束/暂停/出错——
  // hub 对 meta 全视角放行，每个投影窗都看得到这几句）不是某人的话，
  // 不标来源：分隔式，居中
  if (r.zone === 'meta') {
    // 词表与分类收共享规范件（2026-09-24：运行开始/继续/运行结束/暂停/出错唯一活在
    // hub-render-core.metaRowOf）；图标/配色是本端画法，留在页面。
    const meta = HRC.metaRowOf(r.kind);
    if (meta && !meta.plain) {
      const icon = meta.label === '运行开始' ? 'play' : (meta.label === '继续' ? 'rotate' : 'check');
      return '<div class="row metaRow"><div class="meta ' + (meta.tone || '') + '">' + faIcon(icon, 13) + '<span class="mtxt">' + meta.label + '</span></div></div>';
    }
    if (meta && meta.plain) {
      const err = meta.error;
      return '<div class="row metaRow"><div class="meta plain' + (err ? ' err' : '') + '">' + faIcon(err ? 'warn' : 'pause', 12) + '<span>' + hhmmss(r.t) + ' · ' + esc(r.text) + '</span></div></div>';
    }
    return '<div class="row metaRow"><div class="meta plain"><span>' + hhmmss(r.t) + ' · ' + esc(r.text) + '</span></div></div>';
  }
  if (r.kind === 'section') {
    // 空块不渲染：占着号但没有内容的段（预留空位 / 宿主轮开了却整轮没产出）不该
    // 在页面上留个空框。**开着的**空块照画——那是「进节点即见块、正在…」。
    if (!r.open && !(r.items || []).length && !(r.drafts || []).length) return '';
    // 一个节点的整段回合 = 一行 = 一个 # 号：showprompt/思考链/工具/台词同块。
    // 块在 node_start 就开好（r.seg + r.open）——内容还没到时也画出来，
    // 让人看见「这个节点进场了、正在…」；后续内容原位长进这块（row-update）。
    // 段里就是 hub 给的槽：逐块照画。名字（若有）是槽、随槽序原位出现，页面
    // **不额外拼名字行**、也不从行上字段补任何内容。
    // 工具结果并进工具调用（2026-09-21 用户拍板，**纯显示层**——hub 数据不动）：
    // tool 向后找最近的未消费 tool_result，且不越过下一个 tool（并行未归的结果
    // 不硬配，随结果栏退役不显示）。foldKey 仍用原槽号，row-update 重渲染时
    // 折叠开合状态不漂。
    const rawItems = r.items || [];
    const consumed = new Set();
    const mergedItems = rawItems.map((x, i) => {
      if ((x.kind || '') !== 'tool') return x;
      for (let j = i + 1; j < rawItems.length; j++) {
        const kk = rawItems[j].kind || '';
        if (kk === 'tool') break;
        if (kk === 'tool_result' && !consumed.has(j)) {
          consumed.add(j);
          return Object.assign({}, x, { _res: rawItems[j] });
        }
      }
      return x;
    });
    const _seat = seatForSeg(r.seg);
    const _draft = _seat ? S.ihumanDrafts[_seat.wait_key] : null;
    // 人类输入席（本视角可输入的等待段）：展开席的右上工具组挂名字行
    // （2026-10-02 用户拍板，见 itemHtml whoTools）；段里没有名字槽的
    // （老账/非常规段），兜底整行画在输入框上方，不丢寄出口。
    // prompt/showprompt 槽本身不再有显示闸（2026-10-03 拍板，见 itemHtml 注）
    // ——分区提前画只为「等待中」的席保证「showprompt、prompt、ID、输入框」
    // 顺序稳定；收口段按 hub 规整好的槽序自然呈现，同序。
    const canType = !!(_seat && _draft && r.open) && seatAllowed(_seat);
    const seatOpen = canType && !!_draft.expanded;
    const tools = seatOpen ? seatToolsHtml(_seat, _draft, r.seg) : '';
    const headHtml = [];
    const restHtml = [];
    let nameSeen = false;
    mergedItems.forEach((x, i) => {
      if (consumed.has(i)) return '';
      const k = (x.kind || '');
      if (k === 'name' && tools) nameSeen = true;
      // 槽的渲染照旧按数组序、foldKey 按原槽号（重绘后折叠状态不漂）；只是
      // 输入席把 showprompt/prompt 两类槽先画（稳定分区，其余槽保持原相对序）。
      const html = itemHtml(x, false, r.t + ':' + r.n + ':' + i, k === 'name' ? tools : '');
      if (html) (canType && (k === 'showprompt' || k === 'prompt') ? headHtml : restHtml).push(html);
      return '';
    });
    const items = headHtml.join('') + restHtml.join('');
    // 草稿层（r.drafts）：正在写的那几条，贴在本段末尾；定稿一到它们就消失、
    // 由 items 里同位置的定稿顶上（hub 那条 row-update 就是这一拍）。
    const drafts = (r.drafts || []).map((x, i) => itemHtml(x, true, r.t + ':' + r.n + ':d' + i)).join('');
    const doing = (r.open && !(r.drafts || []).length)
      ? (tools && !nameSeen ? '<div class="who">' + tools + '</div>' : '') + doingHtml(r)
      : '';
    // 挂在本段上的插件注入折叠块（配对见 render：位置在本段之前的最近料包），
    // 放槽序最前（名字槽之前）——本段回合的输入侧。
    const plug = (r._plugs || []).map(p =>
      foldDiv(p.t + ':' + p.n, 'plugin', tagHtml('puzzle', '插件注入'), esc(p.text))).join('');
    // humanwait=本段对得上等待席位（在等人类）——等人类的场面不算「输出中」，
    // 翡翠主题的运行中卡不点亮（显示层标记；2026-10-02 起看等待事实本身，
    // 不再叠视角/展开态——不能输入的视角下等人类同样不是输出中）。
    const humanWait = !!_seat;
    return rowShell('k-gold', head, '<div class="section' + (r.open ? ' open' : '') +
      (humanWait ? ' humanwait' : '') + '">' + plug + items + drafts + doing + '</div>');
  }
  if (HRC.isBannerKind(r.kind)) {
    if (r.kind === 'prompt') return '';   // 独立 prompt 行（老账）：提示只住输入席（2026-09-28 用户拍板）
    const m = bannerMeta(r.kind);
    return rowShell('k-gold', head, bannerHtml(m.mod, '', m.icon, m.label, r.text));
  }
  if (r.kind === 'retry') return rowShell('k-amber', head, '<div class="retry">' + esc('重试反馈：' + String(r.text ?? '')) + '</div>');
  if (r.kind === 'fail') return rowShell('k-red', head, '<div class="fail">' + esc('失败：' + String(r.text ?? '')) + '</div>');
  if (r.kind === 'narrate') return rowShell('k-dim', head, '<div class="narrate">' + esc(r.text) + '</div>');
  if (r.kind === 'cot') return rowShell('k-teal', head, foldDiv(r.t + ':' + r.n, 'cot', tagHtml('brain', '思考链'), paraText(r.text)));
  if (r.kind === 'tool') {
    const tc = r.toolCall || {};
    const argsStr = typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments ?? '');
    // _res=render 相邻配对并入的结果行（显示层字段）
    return rowShell('k-green', head, foldDiv(r.t + ':' + r.n, 'tool', tagHtml('wrench', '工具调用 · ' + (tc.name || 'unknown')),
      '<code>' + esc(argsStr.slice(0, 400)) + '</code>' + (r._res ? reslineHtml(r._res) : '')));
  }
  if (r.kind === 'tool_result') return '';   // 结果栏退役：已并进前面的工具调用（配对见 render）
  if (r.kind === 'whisper_user' || r.kind === 'whisper_reply') return rowShell('k-amber', head, '<div class="whisper">' + tagHtml('chat', '耳语') + esc(r.text) + '</div>');
  // 戏外用户发言 → 默认气泡（2026-09-21 用户拍板终态：跟其他气泡同款 UI，
  // 名字行保留——本页自己的审美，名字行好看就留着，不参照任何别处实现）。
  // 即：不进FEMO外素框，落到底部默认 bubble（bwho=actor、k-dim 节点，与FEMO内
  // 独立 say 行完全同款）。识别条件：kind==='whisper' 且 role==='human'，
  // 旧账无 role 用 actor==='用户' 兜底。其余FEMO外行（主Agent等）照旧素框。
  const isHumanOutside = r.zone === 'outside' && r.kind === 'whisper'
    && ((r.role === 'human') || (r.actor === '用户'));
  if (r.zone === 'outside' && !isHumanOutside) {
    // 插件注入（god-mirror 拍板：plugin 料包 actor='插件'）已由 render 摘出、
    // 并进下一段（见 section 分支）；轮到这里还在=后面没有段容器可并（账本
    // 结尾/段全开完），兜底照旧独立折叠块，不丢内容。折叠块换蓝族、默认全折。
    if (r.actor === '插件') return rowShell('k-blue', head,
      foldDiv(r.t + ':' + r.n, 'plugin', tagHtml('puzzle', '插件注入'), esc(r.text)));
    return rowShell('k-dim', head, '<div class="outside">' + tagHtml('masks', 'FEMO外 · ' + (r.actor || '')) + esc(r.text) + '</div>');
  }
  if (isHumanOutside) return rowShell('k-dim', head, '<div class="bubble">' + (r.actor ? '<div class="who">' + esc(r.actor) + '</div>' : '') + esc(r.text) + '</div>');
  // 独立 say 行（老格式）= 默认气泡，正式发言同样走 Markdown（2026-09-21 拍板）。
  return rowShell('k-dim', head, '<div class="bubble"><div class="bwho">' + esc(r.actor || '') + '</div>' + mdHtml(r.text) + '</div>');
}
