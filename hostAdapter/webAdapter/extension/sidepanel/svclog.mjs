/**
 * svclog.mjs — 服务日志卡：增量尾读 /log，终端式贴底，错误行着色。
 * 数据源与服务端 service.log 同源（内存环 300 行），after=行号拉增量，不重复不漏。
 */

import { $, escapeHtml, createToast } from '../../shared/dom.mjs';
import { getState, api } from './conn.mjs';

const svclogEl = $('#svclog');
const toast = createToast($('#toast'));
let logAfter = 0;          // 已读行数（增量游标）
let logLines = [];         // 已渲染的原始行（清屏时只清视图、游标不动）
let logAutoFollow = true;  // 贴底跟随：用户上翻即暂停跟随（与投影中心同款纪律）
let logPollOn = true;      // 清屏后 2 秒内暂停拉取（防刚清完就被增量顶下去）

function classifyLog(line) {
  if (/error|failed|失败|炸|TIMEOUT|超时|refused|unhandled/i.test(line)) return 'err';
  if (/warn|⚠|重试/i.test(line)) return 'warn';
  if (/ready|listening|started|已启动|上线|绿/.test(line)) return 'ok';
  return '';
}

function renderSvcLog() {
  svclogEl.innerHTML = logLines.map(l => {
    const cls = classifyLog(l);
    return '<div' + (cls ? ' class="' + cls + '"' : '') + '>' + escapeHtml(l) + '</div>';
  }).join('');
  if (logAutoFollow) svclogEl.scrollTop = svclogEl.scrollHeight;
}

async function pollSvcLog() {
  if (!logPollOn) return;
  try {
    const state = await getState();
    if (!state?.ok) return;
    const r = await api(state, '/log?after=' + logAfter, { timeoutMs: 4000 });
    if (r?.lines?.length) {
      logLines.push(...r.lines);
      if (logLines.length > 400) logLines.splice(0, logLines.length - 400); // 视图上限，防长跑撑爆
      logAfter = r.total;
      renderSvcLog();
    } else if (Number.isFinite(r?.total)) {
      logAfter = Math.min(logAfter, r.total); // 服务重启过：环被清，游标回落
    }
  } catch { /* 服务不通：静默，连接横幅已示警 */ }
}

svclogEl.addEventListener('scroll', () => {
  logAutoFollow = svclogEl.scrollTop + svclogEl.clientHeight >= svclogEl.scrollHeight - 24;
});
$('#logCopy').addEventListener('click', async () => {
  // 复制当前视图全文（原始行，未着色）；剪贴板失败回落 execCommand（旧侧栏环境兜底）。
  const text = logLines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制 ' + logLines.length + ' 行日志');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('已复制 ' + logLines.length + ' 行日志');
  }
});
$('#logClear').addEventListener('click', () => {
  logLines = [];
  svclogEl.innerHTML = '<div style="color:var(--faint)">已清屏（游标仍在，后续增量照常跟上）。</div>';
  logPollOn = false;
  setTimeout(() => { logPollOn = true; }, 2000);
});

/** 总装调用：起本卡的轮询节奏。 */
export function start() {
  pollSvcLog();
  setInterval(pollSvcLog, 2000);
}
