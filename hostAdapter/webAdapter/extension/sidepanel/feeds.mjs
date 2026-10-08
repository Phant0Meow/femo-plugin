/**
 * feeds.mjs — 两张只读卡：最近收到的回答（replies 环）与引擎流水（runlog 环）。
 * 重画护栏走 shared 判断层——数据没变不重画，保滚动位（长内容读到一半被轮询
 * 重置滚动很难受）。
 */

import { $, escapeHtml, shortId } from '../../shared/dom.mjs';
import { createRepaintGuard } from '../../shared/guard.mjs';

const EMPTY_REPLIES_SVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const repliesGuard = createRepaintGuard();
const runlogGuard = createRepaintGuard();

/** 最近收到的回答（服务端 replies 环，人工信与引擎回合都算）：确认收话链路用。
 *  思考（CoT）与正文分开收时折叠展示。drafts=逐字流草稿镜（/state.drafts）：
 *  钉顶展示并带「正在写…」脉动徽标——面板在长字=delta 链路（闸→content→
 *  background→服务）全通，无引擎即可验证；定稿到手草稿格即撤，以 replies 收尾。 */
export function renderReplies(list, drafts = []) {
  const el = $('#replies');
  const sig = JSON.stringify([list, drafts]);
  if (repliesGuard.skip(sig)) return;
  if (!list?.length && !drafts?.length) {
    el.innerHTML = `<div class="empty">${EMPTY_REPLIES_SVG}<br>还没有收到过回答<br>发送消息（或开始运行）后，网页的回话会出现在这里。</div>`;
    return;
  }
  const rows = [...(drafts ?? []).map(d => ({ ...d, streaming: true })), ...list.slice().reverse()]; // 草稿钉顶（正在写的必是最新的），定稿最新在上
  el.innerHTML = rows.map(r => `
    <div class="reply">
      <div class="reply-meta">
        <svg viewBox="0 0 24 24" fill="none" style="width:11px;height:11px;opacity:.7"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        ${new Date(r.t).toLocaleTimeString()} · 会话 ${shortId(r.sessionId)}…${r.streaming ? '<span class="writing">正在写…</span>' : ''}
      </div>
      ${r.thinking ? '<details class="cot"><summary>思考过程</summary><div class="cot-body"></div></details>' : ''}
      <div class="reply-text"></div>
    </div>`).join('');
  el.querySelectorAll('.reply').forEach((node, i) => {
    const cot = node.querySelector('.cot-body');
    if (cot) cot.textContent = rows[i].thinking;
    node.querySelector('.reply-text').textContent = rows[i].text;
  });
}

/** 引擎流水（/state.runlog 行环）：等宽小字滚动视图。 */
export function renderRunlog(list) {
  const el = $('#runlog');
  const sig = JSON.stringify(list);
  if (runlogGuard.skip(sig)) return;
  if (!list?.length) {
    el.innerHTML = '<div class="empty">还没有流水——挂载脚本并运行后，这里滚动显示。</div>';
    return;
  }
  const rows = list.slice().reverse(); // 最新在上
  el.innerHTML = rows.map(r =>
    `<div><span class="rl-t">${new Date(r.t).toLocaleTimeString()}</span><span class="rl-k">${escapeHtml(String(r.kind ?? ''))}</span>${r.actor ? `<span class="rl-a">${escapeHtml(String(r.actor))}</span>` : ''}<span>${escapeHtml(String(r.text ?? ''))}</span></div>`
  ).join('');
}
