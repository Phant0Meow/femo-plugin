/**
 * seats.mjs — 灵魂席位卡：谁在线/忙/绑了哪个灵魂、是不是当前会话、改绑定、手工发消息。
 *
 * 呈现口径（2026-09-26 用户拍板）：当前会话永远置顶（无论绑没绑灵魂），其余
 * 只显已绑灵魂的——没绑定的过路会话不占版面。状态判断/重画护栏/空灵魂拦截
 * 走 shared 判断层，本文件只管画法与交互。
 */

import { $, escapeHtml, shortId, createToast } from '../../shared/dom.mjs';
import { createRepaintGuard } from '../../shared/guard.mjs';
import { seatState, bindRefusal } from '../../shared/seats-core.mjs';
import { bg, getState, requestRefresh } from './conn.mjs';

const seatsEl = $('#seats');
const toast = createToast($('#toast'));
const guard = createRepaintGuard();

const EMPTY_SEATS_SVG = `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="13" rx="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

/** 席位重画护栏（shared 判断层）：数据没变不重画；正在输入灵魂 id 时不重画。 */
export function renderSeats(seats, activeSessionId) {
  const active = String(activeSessionId ?? '');
  const shown = seats.filter(x => x.sessionId === active || x.soul)
    .sort((a, b) => (b.sessionId === active) - (a.sessionId === active)); // 当前会话排最前，其余保序
  const sig = JSON.stringify([shown, active]);
  if (guard.skip(sig, seatsEl)) return;
  if (!shown.length) {
    // 文案分情况：有会话但都被过滤（=当前会话未绑定）和真没会话，对人话术不同。
    seatsEl.innerHTML = `<div class="empty">${EMPTY_SEATS_SVG}<br>${seats.length ? '当前会话还没绑定灵魂——在下面输入灵魂 id 绑定，或切到已绑定的会话。' : '你还没有打开会话！<br>请打开任意会话。<br>打开会话指的是点进你和AI的任意历史会话，或者你新建一个会话也行<br>——但是必须有至少一条对话记录显示在屏幕上。'}</div>`;
    return;
  }
  seatsEl.innerHTML = '';
  for (const s of shown) {
    const div = document.createElement('div');
    div.className = 'seat' + (s.busy ? ' running' : '');
    const dormant = s.present && !s.online; // 页开着但被冻结（2026-10-01 按需唤醒）
    const dotCls = s.busy ? 'dot busy' : (s.online ? 'dot on' : (dormant ? 'dot dormant' : 'dot'));
    const dotTip = s.busy ? '运行中——点击也可强制重探'
      : (s.online ? '在线——点击强制重探'
        : (dormant ? '休眠中（网页开着，被浏览器冻结）——轮到它发言会自动唤醒；点击立即重连'
          : '网页未打开——点击立即重连（重新探活并补注入）'));
    const curBadge = s.sessionId === active ? '<span class="badge main">当前</span>' : '';
    const st = seatState(s);
    const state = `<span class="state-${st.key}">${st.label}</span>`;
    const pending = s.pending ? `<span class="chip">队列 ${s.pending}</span>` : '';
    const soulChip = s.soul
      ? `<span class="chip soul" title="${escapeHtml(s.soul)}">${escapeHtml(s.soul)}</span>`
      : '<span class="chip">未绑定</span>';
    div.innerHTML = `
      <div class="seat-top"><span class="${dotCls}" data-act="reconnect" title="${dotTip}"></span>${curBadge}<span class="seat-title">${escapeHtml(s.title || '(无标题会话)')}</span></div>
      <div class="seat-meta">
        ${s.siteLabel ? `<span class="chip" title="${escapeHtml(s.site ?? '')}">${escapeHtml(s.siteLabel)}</span>` : ''}
        <span class="chip">${escapeHtml(s.sidShort ?? shortId(s.sessionId))}</span>
        ${state}${pending}
        <span>灵魂 ${soulChip}</span>
      </div>
      <div class="seat-actions">
        <input type="text" placeholder="灵魂 id" value="${escapeHtml(s.soul ?? '')}" data-sid="${s.sessionId}" class="soul-input" />
        <button data-act="bind" data-sid="${s.sessionId}">绑定</button>
        <button data-act="unbind" data-sid="${s.sessionId}">解绑</button>
      </div>`;
    seatsEl.appendChild(div);
  }
}

// ── 一键启动（空态横幅里的按钮）：经 background 走 Native Messaging 拉起本地服务 ──
// 注意：横幅是 main.mjs 用 seatsEl.before(...) 插在席位卡**外面**的兄弟节点，
// 不是席位卡的后代——委托必须挂 document，挂 seatsEl 上事件冒泡不进来，
// 按钮就是死的（实测坑：点了没反应，服务拉不起来）。
document.addEventListener('click', async ev => {
  const btn = ev.target.closest('#startServiceBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '正在启动…';
  const r = await bg({ type: 'web-launch-service' });
  if (r?.ok) toast(r.message || '本地服务已就绪');
  else toast(`启动失败：${r?.error ?? '?'}`, true);
  btn.disabled = false;
  btn.textContent = '一键启动本地服务';
  requestRefresh();
});

seatsEl.addEventListener('click', async ev => {
  // 状态点点击 = 手动重连：当场探一轮（补注入绕过限流）+ 刷新席位账。
  // 灰点（离线）是主用例；在线/运行中的点强探也无害（结果只是刷新账本）。
  const dot = ev.target.closest('[data-act="reconnect"]');
  if (dot) {
    dot.style.pointerEvents = 'none';
    toast('重连中：正在重新探活所有会话页…');
    const r = await bg({ type: 'web-reconnect' }).catch(e => ({ ok: false, error: String(e) }));
    if (r?.ok) {
      const all = r.seats ?? [];
      const online = all.filter(x => x.online).length;
      const dormant = all.filter(x => x.present && !x.online).length;
      const total = all.length;
      toast(`重连完成：${online}/${total} 席在线${dormant ? `（另有 ${dormant} 席休眠——网页开着，轮到发言自动唤醒）` : ''}${online + dormant < total ? '——仍没开网页的席位请把对应会话页打开' : ''}`);
    } else {
      toast(`重连失败：${r?.error ?? '?'}`, true);
    }
    dot.style.pointerEvents = '';
    requestRefresh();
    return;
  }
  const btn = ev.target.closest('button');
  if (!btn) return;
  btn.blur(); // 动作后焦点交还：防「焦点在按钮上」把重画护栏挡死（实测坑）
  const sid = btn.dataset.sid;
  const act = btn.dataset.act;
  if (act === 'bind') {
    const input = seatsEl.querySelector(`.soul-input[data-sid="${sid}"]`);
    const soul = input?.value?.trim();
    const refuse = bindRefusal(soul);
    if (refuse) { toast(refuse, true); return; }
    const r = await bg({ type: 'web-action', path: '/seats/bind', body: { sessionId: sid, soul } });
    if (!r?.ok || r.result?.ok === false) toast(`绑定失败：${r?.result?.error ?? r?.error ?? '?'}`, true);
    else toast('已绑定');
  }
  if (act === 'unbind') {
    await bg({ type: 'web-action', path: '/seats/bind', body: { sessionId: sid, soul: '' } });
    toast('已解绑');
  }
  requestRefresh();
});

// ── 手工发消息：手工测试通道，走与引擎下发同一条下行帧，交不了卷 ────────
// 目标选择（2026-09-27 用户拍板「普遍适配」）：下拉列出全部席位、自动预选
// 当前会话——站点无关，坐的是席位账现成的站点视图字段（siteLabel/sidShort），
// 投递链路本身也是全站同一条下行帧。旧「手输前 8 位 startsWith」随会话引用
// 定形（sid 带站点前缀）已经匹配不上，正是豆包上发不出去的根因。
let targetSig = '';
export function renderManualTargets(seats, activeSessionId) {
  const el = $('#target');
  const list = (seats ?? []).slice().sort((a, b) => (b.online ?? false) - (a.online ?? false)); // 在线在前
  const labelOf = s => `${s.siteLabel ?? '?'}·${s.sidShort ?? shortId(s.sessionId)} · ${s.title || '(无标题)'} · ${s.soul ?? '未绑定'}${s.online ? '' : (s.present ? ' · 休眠中' : ' · 网页未打开')}`;
  const sig = JSON.stringify([list.map(s => [s.sessionId, labelOf(s)]), activeSessionId]);
  if (sig === targetSig) return;   // 选项没变不重建——下拉展开着不被 2.5s 轮询打断
  targetSig = sig;
  const prev = el.value;
  el.innerHTML = '';
  if (!list.length) {
    el.disabled = true;
    el.appendChild(new Option('暂无在线席位——先打开会话页', ''));
    return;
  }
  el.disabled = false;
  for (const s of list) el.appendChild(new Option(labelOf(s), s.sessionId));
  // 预选：上次选的还在→保持；否则当前会话；否则第一个在线席位
  const want = list.some(s => s.sessionId === prev) ? prev
    : list.some(s => s.sessionId === activeSessionId) ? activeSessionId
    : list.find(s => s.online)?.sessionId ?? list[0].sessionId;
  el.value = want;
}

$('#send').addEventListener('click', async () => {
  const sid = $('#target').value;
  const text = $('#text').value;
  const out = $('#sendResult');
  if (!sid) { out.textContent = '没有可用的席位——先打开会话页。'; out.className = 'err'; return; }
  if (!text.trim()) { out.textContent = '要发的内容不能为空。'; out.className = 'err'; return; }
  const seat = (await getState())?.seats?.find(s => s.sessionId === sid);
  if (!seat) { out.textContent = '该席位已不存在——重新选一个。'; out.className = 'err'; return; }
  if (!seat.online) {
    out.textContent = seat.present
      ? '该席位休眠中（网页开着但被浏览器冻结）——引擎派工会自动唤醒它；手动消息请先点开那张标签页再发。'
      : '该席位的网页未打开（标签页关了）。';
    out.className = 'err';
    return;
  }
  const r = await bg({ type: 'web-action', path: '/seats/deliver', body: { sessionId: seat.sessionId, text } });
  if (r?.ok && r.result?.ok) { out.textContent = '已发送。'; out.className = 'ok'; }
  else { out.textContent = `失败：${r?.result?.error ?? r?.error ?? '?'}`; out.className = 'err'; }
});
