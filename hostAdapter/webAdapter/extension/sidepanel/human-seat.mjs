/**
 * human-seat.mjs — 人类发言席卡：引擎等人类节点时亮出（默认隐藏），寄出后收起。
 *
 * 信号链：/state.waitingHuman（引擎 human_wait 事件的本地镜像）→ 亮卡；
 * /answer kind=human 成功应答后服务 clearHumanWait() → 下一轮轮询不再有 → 收卡。
 * 变量赋值的提交契约（只收非空、SET VARIABLE 拼行）唯一活在
 * shared/human-seat-core.mjs；赋值钮显隐判据唯一活在公共层 hub-render-core
 * （服务端盖成 /state.waitingHuman.hasOutVars 布尔随镜像下发），本文件只管
 * 画面板与寄信。
 */

import { $, escapeHtml } from '../../shared/dom.mjs';
import { createRepaintGuard } from '../../shared/guard.mjs';
import { humanWaitKey, composeHumanSubmission, collectNonEmptyVars, answerOutcome } from '../../shared/human-seat-core.mjs';
import { getState, api } from './conn.mjs';

const humanCard = $('#humanCard');
const humanVarsPanel = $('#humanVarsPanel');
const humanVarBtn = $('#humanVarBtn');
let humanVarsOpen = false;
let humanVarsKey = '';     // 回合+变量清单键：变了才重建（打字草稿不被清，DSH 同款）
let humanVars = {};        // 草稿值
const waitGuard = createRepaintGuard();

function renderHumanVarsPanel() {
  const names = Object.keys(humanVars);
  if (!humanVarsOpen || !names.length) { humanVarsPanel.hidden = true; return; }
  humanVarsPanel.hidden = false;
  humanVarsPanel.innerHTML =
    '<div class="var-name" style="min-width:auto;margin-bottom:5px;color:var(--muted)">本节点变量赋值（可只填几项）</div>' +
    names.map(n =>
      `<div class="var-row"><span class="var-name" title="${escapeHtml(n)}">${escapeHtml(n)}</span><input type="text" data-varname="${escapeHtml(n)}" value="${escapeHtml(humanVars[n] ?? '')}" placeholder="留空=不赋值" /></div>`
    ).join('') +
    '<div class="var-actions"><button id="humanVarsConfirm" class="primary">确认赋值并发送</button><button id="humanVarsCancel">收起</button></div>';
}

function showHumanCard(hw) {
  humanCard.hidden = false;
  $('#humanNode').textContent = hw.node || '人类节点';
  $('#humanJobInfo').textContent = `job ${hw.jobId}${hw.scope?.length ? ' · 席 ' + hw.scope.join(' ') : ''}`;
  // 节词（showprompt，如有）与输入提示（prompt）：引擎 human_wait 事件自带，
  // 经 /state.waitingHuman 镜像带来；空段不占位。
  const sp = $('#humanShowprompt');
  const spText = String(hw.showprompt ?? '').trim();
  sp.textContent = spText;
  sp.hidden = !spText;
  const pr = $('#humanPrompt');
  const prText = String(hw.prompt ?? '').trim();
  pr.textContent = prText;
  pr.hidden = !prText;
  // 回合变了：作废上一轮草稿与浮层（等待回合切换即换新状态，投影中心同款）
  const key = humanWaitKey(hw);
  if (key !== humanVarsKey) {
    humanVarsKey = key;
    humanVarsOpen = false;
    humanVars = {};
    for (const n of (hw.out_vars ?? [])) humanVars[n] = '';
    $('#humanText').value = '';
  }
  humanVarBtn.hidden = !hw.hasOutVars;
  if (!humanVarBtn.hidden) humanVarBtn.classList.toggle('active', humanVarsOpen);
  renderHumanVarsPanel();
}

/** 挂进 refresh 轮询：waitingHuman 有无 → 显隐（签名护栏：变化才动 DOM，草稿不丢）。 */
export function renderHumanWait(hw) {
  const sig = hw ? JSON.stringify([hw.jobId, hw.waitKey, hw.node, hw.out_vars, hw.prompt, hw.showprompt]) : '';
  if (waitGuard.skip(sig)) return;
  if (hw) showHumanCard(hw);
  else { humanCard.hidden = true; humanVarsOpen = false; }
}

async function submitHuman(textRaw, vars) {
  const c = composeHumanSubmission(textRaw, vars ?? humanVars);
  const out = $('#humanResult');
  if (c.error) { out.textContent = c.error; out.className = 'err'; return; }
  out.className = '';
  out.textContent = '已寄出，等引擎收账…';
  try {
    const state = await getState();
    if (!state?.ok) throw new Error('本地服务不通');
    const r = await api(state, '/answer', { body: { kind: 'human', text: c.text, variables: c.variables }, timeoutMs: 30_000 });
    // 成败判据唯一活在 shared/human-seat-core.answerOutcome：post_speech 小票
    // posted=true 才算投递成功，拒收卡不收、改改就能重寄；引擎收账后的处理
    // 错误（如赋值不合法）属于运行错误，走运行状态绿字报错线，不在这条回执里。
    const o = answerOutcome(r);
    out.textContent = o.message;
    out.className = o.ok ? 'ok' : 'err';
    if (o.ok) humanCard.hidden = true;   // 引擎收下才收卡；拒收留着改
  } catch (e) { out.textContent = String(e); out.className = 'err'; }
}

$('#humanSend').addEventListener('click', () => submitHuman($('#humanText').value));
$('#humanText').addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229) return;   // 中文 IME：选词回车不算寄出
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitHuman($('#humanText').value); }
});
humanVarBtn.addEventListener('click', () => { humanVarsOpen = !humanVarsOpen; renderHumanVarsPanel(); });
humanVarsPanel.addEventListener('click', e => {
  if (e.target.id === 'humanVarsCancel') { humanVarsOpen = false; renderHumanVarsPanel(); return; }
  if (e.target.id !== 'humanVarsConfirm') return;
  // DOM 只管读值，收拢判据（trim+滤空）唯一活在 shared 的 collectNonEmptyVars。
  const raw = {};
  humanVarsPanel.querySelectorAll('.var-row input').forEach(inp => {
    const n = inp.getAttribute('data-varname') || '';
    if (n) raw[n] = inp.value;
  });
  const vals = collectNonEmptyVars(raw);
  if (Object.keys(vals).length === 0) { humanVarsOpen = false; renderHumanVarsPanel(); return; }
  submitHuman($('#humanText').value, vals);
});
