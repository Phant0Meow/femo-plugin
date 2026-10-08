/**
 * composer.mjs — 人类席交卷侧（自单文件页拆出，2026-09-26；2026-10-02 席位
 * 清单化）。人类输入只有一口：时间轨里的席位内联输入席（render.mjs doingHtml
 * 画三态：召唤条/展开输入/已寄出），等待中的段整段停靠在时间轨最末（见
 * render 的 docks）。par 并发多条线各自等到人类时多席并存：每席一份草稿与
 * 提交锁（S.ihumanDrafts[wait_key]，本件是唯一写口）；交卷按席的 wait_key
 * 寄信，回执也按 wait_key 落回原席。等待帧与交卷回执的分派入口收在这里
 * （applyWaiting / applyInputResult），WS 分发器只转调。
 */
import { S } from './state.mjs';
import { render, seatForSeg } from './render.mjs';
import { fitTextarea, loadDraftStore, saveDraftStore, pruneDraftStore } from './util.mjs';
import * as HRC from '/host/hub-render-core.mjs';

const elTl = document.getElementById('tl');   // 主轨（节点更新/流式增量在这里重绘）
const elDock = document.getElementById('dock');   // 停靠席（人类输入席住这里，2026-10-03 起与主轨分容器，见 render.mjs elDock 注）

// 草稿的 sessionStorage 镜像（抗刷新，2026-10-08 用户拍板）：正身仍是内存里的
// S.ihumanDrafts，镜像只存 {wait_key → {text, vars}}，刷新后新页面按它接回。
// busy 不进镜像：刷新即解锁可重发，重复信引擎侧死信无害（hub 既有裁决）。
const draftStore = loadDraftStore(sessionStorage);
function persistDrafts() { saveDraftStore(sessionStorage, draftStore); }

// 席位清单变更：按 wait_key 对账草稿——新席立新草稿（镜像里有半截话就原样
// 接回）、离席草稿作废（含收麦/暂停清场，镜像同步撤不留僵尸）、在席重推不
// 重置（同键原位更新：续跑世代键修正的重推不得把「已寄出」锁误开）。render
// 全量重绘不丢草稿不丢焦点（状态全在内存）。
function syncDrafts() {
  const live = new Set();
  for (const seat of S.waitingSeats) {
    const wk = String(seat.wait_key || '');
    if (!wk) continue;
    live.add(wk);
    if (!S.ihumanDrafts[wk]) {
      S.ihumanDrafts[wk] = { wk, expanded: false, text: '', varsOpen: false,
                             vars: {}, err: '', busy: false, _focus: false,
                             _tries: 0, _ackAt: 0 };
      const saved = draftStore[wk];
      if (saved) {
        S.ihumanDrafts[wk].text = String(saved.text || '');
        if (saved.vars && typeof saved.vars === 'object' && !Array.isArray(saved.vars)) {
          S.ihumanDrafts[wk].vars = { ...saved.vars };
        }
      }
    }
  }
  for (const wk of Object.keys(S.ihumanDrafts)) {
    if (!live.has(wk)) delete S.ihumanDrafts[wk];
  }
  const pruned = pruneDraftStore(draftStore, live);
  let changed = false;
  for (const k of Object.keys(draftStore)) {
    if (!pruned[k]) { delete draftStore[k]; changed = true; }
  }
  if (changed) persistDrafts();
}
// 等待态变化（新一轮/收麦/快照/换视角）的同步入口。输入席本身的显隐与画法
// 归 render（doingHtml 每轮按席位+视角现判，停靠也归它），本函数只管对账
// 草稿；main/panels 的既有调用点原样保留。
export function updateComposer() {
  syncDrafts();
}
// 事件目标 → 就地草稿：段内输入区的控件各带 data-seg，先对席位再取草稿。
function draftOf(target) {
  const host = target.closest ? target.closest('[data-seg]') : null;
  if (!host) return null;
  const seat = seatForSeg(host.getAttribute('data-seg'));
  return seat ? (S.ihumanDrafts[seat.wait_key] || null) : null;
}

// ── 寄出帧重发（2026-10-08）────────────────────────────────────────────
// 页面→hub 一跳此前零冗余：帧在 hub 慢活（心跳全城扫描等）后面排队、或连接
// 被静默拆掉时，信不进柜、席位永久卡「已寄出」。现按回执判据重发：发出 2s
// 没等到 human-input-result 就重发同一帧（至多 5 次），线没开就等下一拍——
// 重连后自动补发。重发的安全性由 hub 幂等闸兜底（同 wait_key 在柜未捞的信
// 不叠第二封，mailbox.pending_out_by_ref）。到顶仍无回执=响亮解锁还稿可手发。
const SEND_ACK_MS = 2000;
const SEND_RETRY_MAX = 5;
let sendWatch = null;

function sendFrame(seat, draft) {
  if (!S.ws || S.ws.readyState !== 1) return false;
  const c = HRC.composeHumanSubmission(draft.text, draft.vars);
  if (c.error) return false;
  // 结构化 variables 仍随信走——引擎直取路径不变；text 里是拼好 SET VARIABLE
  // 行的完整发言（显示与文本解析双保险，拼装在公共层）。
  S.ws.send(JSON.stringify({ ctrl: 'human-input', wait_key: seat.wait_key, text: c.text, variables: c.variables }));
  return true;
}

function ensureSendWatch() {
  if (sendWatch) return;
  sendWatch = setInterval(() => {
    const now = Date.now();
    let pending = false, dirty = false;
    for (const wk of Object.keys(S.ihumanDrafts)) {
      const d = S.ihumanDrafts[wk];
      if (!d.busy) continue;
      pending = true;
      const seat = S.waitingSeats.find(x => x.wait_key === wk);
      if (!seat) continue;                       // 席位已撤：对账清场，不替它发
      if (d._ackAt && now - d._ackAt < SEND_ACK_MS) continue;   // 回执未逾期
      if (d._tries >= SEND_RETRY_MAX) {          // 到顶：响亮还稿（正文保留可手发）
        d.busy = false;
        d._ackAt = 0;
        d.expanded = true;
        d.err = '重发 ' + SEND_RETRY_MAX + ' 次没等到回执，先还给你（可再点寄出）';
        dirty = true;
        continue;
      }
      if (sendFrame(seat, d)) {
        d._tries += 1;
        d._ackAt = now;
      }
    }
    if (dirty) render();
    if (!pending && sendWatch) { clearInterval(sendWatch); sendWatch = null; }
  }, 1000);
}

function submitHumanText(seat, draft, raw) {
  if (!seat || !draft || draft.busy) return;
  // 拼装判据唯一活在公共层 hub-render-core.composeHumanSubmission（2026-09-29
  // 收编：投影中心/dsh 投影窗/web 人类席三处各写的 SET VARIABLE 拼行与只收
  // 非空口径归一）。全空=静默不寄（召唤条不点开寄不了，这里只兜住展开席）。
  const c = HRC.composeHumanSubmission(raw, draft.vars);
  if (c.error) return;
  draft.busy = true;   // 该席提交锁：已寄出未收账禁双投（doingHtml 翻「已寄出」态）
  draft.err = '';
  draft._tries = 0;
  draft._ackAt = 0;    // 0=还没出门；线开着当场首发，没开就等巡检补发
  if (sendFrame(seat, draft)) { draft._tries = 1; draft._ackAt = Date.now(); }
  ensureSendWatch();
  render();   // 该席立即翻到「已寄出」态
}

// ── 变量赋值浮层（2026-09-24，DSH 投影窗 composer 同款逻辑）：节点声明 out
// 时输入框上方亮赋值钮，确认把非空行收成结构化 variables 随发言寄出。浮层
// 面板由 render 的 doingHtml 画（varPanelHtml），草稿值存该席 draft.vars。──
// 内联席确认（面板随 render 全量重绘，值从该席 draft.vars 收）。
function ihumanVarsConfirm(draft) {
  if (!draft || draft.busy) return;
  const seat = S.waitingSeats.find(x => x.wait_key === draft.wk);
  const vals = {};
  for (const n of Object.keys(draft.vars || {})) {
    const v = String(draft.vars[n] == null ? '' : draft.vars[n]).trim();
    if (v) vals[n] = v;
  }
  if (Object.keys(vals).length === 0) { draft.varsOpen = false; render(); return; }
  submitHumanText(seat, draft, draft.text);
}

// 席位输入区委托：主轨与停靠席两根容器都挂（挂点不随重绘生死；输入席控件只
// 出现在这两处）。
for (const elRoot of [elTl, elDock]) {
elRoot.addEventListener('click', (e) => {
  if (e.target.closest('.ihuman-hint')) {
    const d = draftOf(e.target);
    if (!d || d.busy) return;
    d.expanded = true;
    d._focus = true;   // 重绘后把焦点送进新 textarea
    render();
    return;
  }
  if (e.target.closest('[data-ihvar-toggle]')) {
    const d = draftOf(e.target);
    if (!d || d.busy) return;
    d.varsOpen = !d.varsOpen;
    render();
    return;
  }
  if (e.target.closest('.var-confirm')) { ihumanVarsConfirm(draftOf(e.target)); return; }
  if (e.target.closest('.ihuman-send')) ihumanSend(draftOf(e.target));
});
elRoot.addEventListener('input', (e) => {
  const ta = e.target.closest('.ihuman-text');
  if (ta) {
    const d = draftOf(ta);
    if (!d) return;
    d.text = ta.value;   // 草稿进内存：render 重绘后原样接回
    d.err = '';
    if (draftStore[d.wk]) draftStore[d.wk].text = d.text;   // 镜像跟写（抗刷新）
    persistDrafts();
    fitTextarea(ta);     // 单行起步随内容长高（2026-10-02 人类席拍板）
    return;
  }
  const vi = e.target.closest('.var-input');   // 赋值草稿同款进内存（2026-09-24）
  if (vi) {
    const d = draftOf(vi);
    const n = vi.getAttribute('data-varname') || '';
    if (d && n) {
      d.vars[n] = vi.value;
      if (draftStore[d.wk]) draftStore[d.wk].vars = { ...d.vars };   // 镜像跟写
      persistDrafts();
    }
  }
});
// 失焦收起（2026-10-02 用户拍板，Esc 收起退役）：焦点离开输入框就收回召唤行；
// 草稿留在席不丢（收起面亮草稿首行），再点原地回到输入框继续。焦点还在同一段
// 的工具间移动（寄出/变量赋值/赋值输入框）不算离开——relatedTarget 落在同一
// .section 里就当没走。节点被程序拆除（重绘换壳）引发的 focusout 不算失焦：
// 那不是人点走的，流式重绘不得收起输入席（2026-10-03 用户拍板）。
elRoot.addEventListener('focusout', (e) => {
  const ta = e.target.closest ? e.target.closest('.ihuman-text') : null;
  if (!ta || !ta.isConnected) return;
  const rt = e.relatedTarget;
  if (rt && rt.closest && rt.closest('.section')) return;
  const d = draftOf(ta);
  if (!d || !d.expanded) return;
  d.expanded = false;
  render();
});
// 名字行工具钮（寄出/变量赋值）的 mousedown 不抢焦点：Safari 点按钮不聚焦、
// relatedTarget 落空，会被上面的失焦收起抢先拆台（按钮还没点到就被重绘拆掉）。
// 压掉 mousedown 默认行为=焦点留在输入框，click 照常到达。
elRoot.addEventListener('mousedown', (e) => {
  if (e.target.closest && e.target.closest('.who-tools')) e.preventDefault();
});
elRoot.addEventListener('keydown', (e) => {
  const vi = e.target.closest('.var-input');
  if (vi && e.key === 'Escape') {   // Esc 只收赋值浮层，不惊动整个输入席
    e.preventDefault();
    e.stopPropagation();
    const d = draftOf(vi);
    if (d) { d.varsOpen = false; render(); }
    return;
  }
  const ta = e.target.closest('.ihuman-text');
  if (!ta) return;
  if (e.isComposing || e.keyCode === 229) return;   // 中文 IME：选词回车不算寄出
  // Enter/Shift+Enter 都不拦——textarea 默认行为就是换行；只有 Ctrl+Enter 寄出
  // （2026-10-05 用户拍板）。手机没有 Ctrl，虚拟键盘回车（长短按=同一颗 Enter）
  // 一律换行，发送只认页面上的寄出钮。
  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); ihumanSend(draftOf(ta)); return; }
  // Esc 收起退役（2026-10-02 用户拍板）：失焦即收，Esc 不再管输入席。
});
}
function ihumanSend(draft) {
  if (!draft || draft.busy) return;
  const seat = S.waitingSeats.find(x => x.wait_key === draft.wk);
  submitHumanText(seat, draft, draft.text);
}

// ── WS 分派入口（分派器只转调，逻辑住这里）────────────────────────────
// 人类等待态（席位清单整发：SET 增改/收麦删/清场空表，hub 每拍推全量）。
export function applyWaiting(list) {
  S.waitingSeats = Array.isArray(list) ? list : [];
  updateComposer(); return;
}
// 交卷回执（按 wait_key 落回原席）：受理=该席草稿功成身退、保持禁用等
// human_done 收麦；拒绝=解锁就地报错可重试。
export function applyInputResult(j) {
  const d = j && j.wait_key ? S.ihumanDrafts[String(j.wait_key)] : null;
  if (!d) return;
  d._ackAt = 0;   // 回执到了（受理/拒绝都算）：重发巡检对这席收工
  d._tries = 0;
  if (j.ok) {
    d.text = '';   // 已受理：就地草稿与赋值浮层功成身退（失败才保留重试）
    d.varsOpen = false;
    d.vars = {};
    if (draftStore[d.wk]) {   // 镜像同清：已受理的半截话不该在刷新后还魂
      draftStore[d.wk].text = '';
      draftStore[d.wk].vars = {};
      persistDrafts();
    }
  } else {
    d.busy = false;   // 解锁可重试
    d.err = '寄出失败：' + (j.error || '未知') + '（可重试）';
    d.expanded = true;
  }
  render();
}
