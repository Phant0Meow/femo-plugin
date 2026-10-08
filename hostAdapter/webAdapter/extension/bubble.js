/**
 * bubble.js — FEMO 悬浮球（content script；注入范围由 manifest 的 matches 登记，
 * 那是站点包 site.mjs 的镜像键——本文件是纯 UI，零网站事实）。
 *
 * 形态（用户拍板 2026-09-26）：贴右边框、平时只露一小截，靠近滑出、移开收回、
 * 可按住上下拖拽（横向恒贴边）、位置跨页记住。点击开侧栏，侧栏弹出后球自动收回
 * ——戏开场了，门口的引座员就不用杵在那了。
 * 形态修订（用户拍板 2026-09-28）：球径缩至原来的 0.75；logo 占满球身。
 * 形态修订（用户拍板 2026-09-30）：logo 缩至球径的 0.8，球身留呼吸位；
 * 平时藏一半露一半。
 *
 * 稳定性裁决（2026-09-26 两轮实测收敛）：
 * ①绝不用 CSS :hover 驱动球自身位移——球一动命中区跟着动，hover 反复翻转=进出闪；
 *   弹出/收回由 JS 事件状态机管（pointerenter/pointerleave + 迟滞收回）。
 * ②悬停判定圈 = 球直径的两倍（隐形圆垫在球底下承载判定），球心即圈心——
 *   靠得不太近也认、边缘蹭来蹭去不抖（用户点名：判定圈半径取悬浮球的两倍）。
 * ③窗口失焦一律收回：侧栏面板是独立 surface，弹出会抢焦点，球的 pointerleave
 *   可能根本没派到——失焦兜住「移开不收回」的漏。
 *
 * 样式全部住在 Shadow DOM 里。右键点击球 = 暂时隐藏（本页刷新前有效）。
 */

(() => {
  if (globalThis.__femoBubble) return;
  globalThis.__femoBubble = true;

  // 前朝僵尸球清扫（2026-09-26 双球 bug）：上面这面守卫旗只活在「本扩展在本页
  // 的内容脚本世界」里——扩展重载/更新后旧世界被孤立，旗没了但旧球还挂在文档
  // 上（还会响应悬停，点击发不出信）；新世界注入时旗是空的、守卫放行，再立
  // 一球=双球（时有时无：只在扩展重载后开着旧页时发生）。能走到这里而文档里
  // 已有 host，那 host 必属孤立旧世界（同一个世界有旗拦着，走不到这）——全部
  // 拆掉再立新球；纵向位置在 localStorage 跨页记住，新球自动回到原位。
  for (const stale of document.querySelectorAll('#femo-bubble-host')) stale.remove();

  // ── 形态参数 ──
  const SIZE = 33;            // 球直径（2026-09-28 拍板：原 44 的 0.75）
  const PEEK = SIZE / 2;      // 平时露出边框外的宽度（2026-09-28 拍板：藏一半露一半）
  const REST = 16;            // 冒出后离右边的距离（≥绿光晕外扩量 14px blur+1px spread，贴太近光晕被屏幕边缘裁掉）
  const HIT = SIZE * 2;       // 悬停判定圈直径（用户点名：半径=球的两倍）
  const HIDE_DELAY = 280;     // 移开后延迟收回（迟滞：防边界处进出抖动）
  const POS_KEY = 'femo-bubble-top';

  const host = document.createElement('div');
  host.id = 'femo-bubble-host';
  host.style.cssText = 'position:fixed;right:0;top:0;width:0;height:0;z-index:2147483646;';
  const shadow = host.attachShadow({ mode: 'closed' });

  // 与侧栏品牌区同源的 FEMO logo（mask id 加前缀防文档级冲突）。
  // ⚠️ 已知镜像：正身=shared/femo-logo.mjs（console/侧栏同吃）——本文件是
  // content script 经典脚本进不了 ESM，留同形镜像，改 path/viewBox 两处同改。
  // viewBox 纵向以 logo 主体中心 (200,200) 取框（y=16, 高=368）——原框 y=30 高=364
  // 中心在 212，画出来主体偏上 12 个单位，球里看着不居中（实测截图校准，
  // 2026-09-29 正身与镜像已统一到此框）。
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="27.169998168945312 16 345.6600341796875 368">
    <defs>
      <mask id="femo-bubble-cut">
        <rect x="0" y="0" width="400" height="480" fill="#ffffff"/>
        <path d="M 187.5 200 L 212.5 200 L 262.5 359 L 200 384 L 137.5 359 Z" fill="none" stroke="#000000" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="200" cy="200" r="15" fill="#000000"/>
        <line x1="35" y1="100" x2="200" y2="75" stroke="#000000" stroke-width="16" stroke-linecap="round"/>
        <line x1="200" y1="75" x2="365" y2="100" stroke="#000000" stroke-width="16" stroke-linecap="round"/>
        <line x1="30.92" y1="107.11" x2="91.75" y2="262.5" stroke="#000000" stroke-width="16" stroke-linecap="round"/>
        <line x1="369.08" y1="107.11" x2="308.25" y2="262.5" stroke="#000000" stroke-width="16" stroke-linecap="round"/>
      </mask>
    </defs>
    <g mask="url(#femo-bubble-cut)">
      <polygon points="200,40 338.56,120 338.56,280 200,360 61.44,280 61.44,120" fill="none" stroke="#8FDD55" stroke-width="32" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="200" y1="200" x2="61.44" y2="120" stroke="#8FDD55" stroke-width="32" stroke-linecap="round"/>
      <line x1="200" y1="200" x2="338.56" y2="120" stroke="#8FDD55" stroke-width="32" stroke-linecap="round"/>
      <path d="M 187.5 200 L 212.5 200 L 262.5 359 L 200 384 L 137.5 359 Z" fill="#8FDD55"/>
      <path d="M 75.78 197.79 L 37.17 105.58 L 135.99 93.53 L 68.63 132.43 L 75.78 120 Z" fill="#8FDD55"/>
      <path d="M 324.22 197.79 L 362.83 105.58 L 264.01 93.53 L 331.37 132.43 L 324.22 120 Z" fill="#8FDD55"/>
    </g>
    <circle cx="200" cy="200" r="30" fill="none" stroke="#8FDD55" stroke-width="32"/>
  </svg>`;

  const style = document.createElement('style');
  style.textContent = `
    /* 命中区：隐形圆垫，承载悬停判定与拖拽/点击；球只是它中心的一幅画。 */
    .hit {
      position: fixed;
      right: ${PEEK - SIZE * 1.5}px;          /* 收起态：球心=PEEK-SIZE/2（见下） */
      width: ${HIT}px; height: ${HIT}px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      transform: translateY(-50%);
      /* 不可见但可命中：不设 background 也能收事件，transparent 防意外绘制。 */
      background: transparent;
      transition: right .22s cubic-bezier(.2,.8,.25,1);
      cursor: grab;
      user-select: none; -webkit-user-select: none;
      touch-action: none;
    }
    .hit.out { right: ${REST - SIZE / 2}px; }
    .hit:active { cursor: grabbing; }
    .hit.dragging { transition: none; cursor: grabbing; }
    .ball {
      width: ${SIZE}px; height: ${SIZE}px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(160deg, rgba(20, 26, 22, 0.92), rgba(12, 15, 18, 0.92));
      /* 描边整圈同亮（2026-09-30 用户拍板：此前 border-right 单独调暗，圆上
         border-right 画的是右侧整段弧——绿圈右边看着缺一块，像被切了）。 */
      border: 1px solid rgba(143, 221, 85, 0.4);
      box-shadow: -2px 2px 12px rgba(0, 0, 0, 0.35);
      opacity: 0.9;
      transition: opacity .18s ease, box-shadow .18s ease;
      backdrop-filter: blur(6px);
      pointer-events: none;                    /* 判定全归命中区，球不截事件 */
    }
    .hit.out .ball { opacity: 1; box-shadow: -3px 3px 16px rgba(0,0,0,.45), 0 0 14px 1px rgba(143,221,85,.25); }
    /* logo 随球径走（2026-09-28 拍板：占满球身；2026-09-30 用户拍板：缩至球径的
       0.8——贴边顶满太挤，球身留呼吸位）；球是 flex 居中，缩了自动回正中。 */
    .ball svg { width: ${SIZE * 0.8}px; height: ${SIZE * 0.8}px; display: block; }
  `;
  shadow.appendChild(style);

  const hit = document.createElement('div');
  hit.className = 'hit';
  hit.title = 'FEMO：点击开侧栏；拖拽上下挪位；右键暂时隐藏';

  const ball = document.createElement('div');
  ball.className = 'ball';
  ball.innerHTML = LOGO_SVG;
  hit.appendChild(ball);

  shadow.appendChild(hit);
  document.documentElement.appendChild(host);

  // ── 纵向位置：跨页记住 ──
  const half = SIZE / 2;
  let topPx = Math.round(window.innerHeight * 0.55 - half);
  try {
    const saved = Number(localStorage.getItem(POS_KEY));
    if (Number.isFinite(saved) && saved >= 4 && saved <= 96) {
      topPx = Math.round((saved / 100) * window.innerHeight - half);
    }
  } catch { /* 隐私模式等拿不到就不记 */ }
  function clampTop(px) {
    return Math.min(window.innerHeight - half - 4, Math.max(half + 4, px));
  }
  function applyTop() { hit.style.top = `${clampTop(topPx) + half}px`; }
  applyTop();
  window.addEventListener('resize', applyTop);
  function saveTop() {
    try {
      const pct = Math.round(((clampTop(topPx) + half) / window.innerHeight) * 100);
      localStorage.setItem(POS_KEY, String(pct));
    } catch { /* 不记就不记 */ }
  }

  // ── 弹出/收回状态机（判定圈=球的两倍大，事件全在 .hit 上） ──
  let hideTimer = 0;
  function show() { clearTimeout(hideTimer); hit.classList.add('out'); }
  function retract() { clearTimeout(hideTimer); hit.classList.remove('out'); }
  function scheduleRetract() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!drag) hit.classList.remove('out'); }, HIDE_DELAY);
  }
  hit.addEventListener('pointerenter', show);
  hit.addEventListener('pointerleave', () => { if (!drag) scheduleRetract(); });
  // 侧栏弹出会抢焦点（面板是独立 surface，pointerleave 可能丢）：失焦一律收回。
  window.addEventListener('blur', () => { if (!drag) retract(); });

  // ── 拖拽（只动纵向）与点击的裁决：位移 < 5px 算点击 ──
  let drag = null; // { startY, startTopPx, moved }
  hit.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    drag = { startY: ev.clientY, startTopPx: ball.getBoundingClientRect().top + half, moved: false };
    hit.setPointerCapture(ev.pointerId);
  });
  hit.addEventListener('pointermove', ev => {
    if (!drag) return;
    const dy = ev.clientY - drag.startY;
    if (Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    hit.classList.add('dragging');
    topPx = drag.startTopPx + dy;
    applyTop();
  });
  hit.addEventListener('pointerup', ev => {
    if (ev.button !== 0 || !drag) return;
    const wasClick = !drag.moved;
    const wasDrag = drag.moved;
    hit.classList.remove('dragging');
    drag = null;
    if (wasClick) {
      // 同步发消息（点击手势链路）；侧栏弹出后球主动收回——戏开了，引座员退场。
      try { chrome.runtime.sendMessage({ type: 'web-open-panel' }); } catch { /* SW 竞态：忽略 */ }
      retract();
      return;
    }
    saveTop();
    if (!hit.matches(':hover')) scheduleRetract();
  });
  hit.addEventListener('pointercancel', () => { drag = null; hit.classList.remove('dragging'); });

  // 右键：暂时隐藏（本页刷新前有效）。
  hit.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    host.remove();
  });
})();
