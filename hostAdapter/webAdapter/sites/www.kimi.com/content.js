/**
 * content.js — Kimi 会话页代理（隔离世界，每标签页一份）。2026-09-28 转正。
 *
 * 这把「角色椅」的三样本事（锚点换实证值）：
 *   ① 身份：读 URL 拿会话 id（/chat/<UUID>，SPA 换页跟住；探针实证 36 位
 *      连字符 UUID 形态）；
 *   ② 发送：任务文本写进 .chat-input-editor（可编辑 DIV，真页盘点实证——
 *      contenteditable 路线：execCommand 写入），派发 Enter 发送；发不出去
 *      再点发送钮候选——还不行就大声失败并附页面盘点（发送姿势的真值等第
 *      一次真派工定型）；
 *   ③ 收话：网络闸为主（inject.js 的 web-net 事件，message.status COMPLETED
 *      /done 帧/Connect 结束帧三层保险）——思考与正文按 mask 分型攒，结束
 *      帧对账。DOM 兜底（.segment-assistant 文本稳定 3 拍）是静默阶梯领养
 *      收尾的救命绳（reload 后 Connect 流不重放，只能从历史 DOM 收全文，
 *      2026-10-02 取证转正，见 SITE.md）。
 *
 * 会话名来源：document.title 剥「- Kimi」尾巴（真页实证「猫咪打招呼 - Kimi」，
 * 动态标题随会话名更新）。
 *
 * 上行全部经 background（chrome.runtime.sendMessage），本脚本不直接碰网络。
 * 机器骨架唯一活在 extension/seat-agent-core.js（经 PAGE_SCRIPTS 首位注入，
 * globalThis.FemoSeatCore 交接）——本文件只剩这家站的实证事实。
 */

// content script 是经典脚本进不了 ESM：这份正则是 site.mjs SESSION_PATH_RE 的
// 镜像——改站两处同改（SITE.md 有 checklist）。
const SESSION_RE = /\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

// 防重复执行（按扩展运行时判代，2026-09-26 二版，同 deepseek 包的实测坑）：
// 页面的隔离世界在页面不刷新时一直活着，布尔标记会跨扩展重载残留。
if (globalThis.__femoSeatInjected === chrome.runtime.id) {
  throw new Error('femo-seat: already injected (same runtime)');
}
globalThis.__femoSeatInjected = chrome.runtime.id;

/** 输入框候选：真页盘点实证的 .chat-input-editor（可编辑 DIV）打头，后面是
 *  结构兜底——都按「可见尺寸」过滤。 */
const INPUT_CANDIDATES = [
  '.chat-input-editor',
  '.chat-input-editor-container [contenteditable="true"]',
  '.chat-input-editor-container [role="textbox"]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'textarea',
];

/** 发送钮候选：常见发送钮特征。 */
const SEND_CANDIDATES = ['[aria-label*="发送"]', '[aria-label*="Send" i]', 'button[class*="send" i]'];

// ── DOM 收话兜底（2026-10-02 锚点收集轮二代探针取证转正）───────────────────
// 回答容器=`.segment-assistant`（消息级语义段）。取证证据：AI 正文链两轮同形
// `… ← div.segment-content-box ← div.segment-content ← div.segment-container
//  ← div.segment.segment-assistant ← div.chat-content-item.chat-content-item-
//  assistant`；思考文本（thinking-container/toolcall-flow 体系）10 层深链未见
// segment 字样——思考区在 segment 体系之外，锚整段不混思考。
// 备选换锚路（若真演出发现收话混入思考）：`.segment-assistant
// .markdown-container:not(.toolcall-content-text)`——思考块的 markdown-container
// 都带 toolcall-content-text 类、正文的不带，代价是长回复分段时只收最后一块。
// 忙锚未配（收集轮 kimi 页未发消息，观察窗无证据，宁缺勿猜）——收话判定退化
// 为「文本连续 3 拍不变」单条件。
const REPLY_SELECTOR = '.segment-assistant';

/** 会话名（席位显示名）提取——站点私有层的标题退路：剥「- Kimi」站点尾巴
 *  （真页实证动态标题「猫咪打招呼 - Kimi」；没尾巴就不剥，落地页 SEO 标题
 *  无会话 id 不立席位，无所谓）。 */
function parseSessionTitle(raw) {
  const s = String(raw ?? '').trim();
  const m = /^(.*?)\s*[-·—|]\s*Kimi\s*$/i.exec(s);
  return m ? m[1].trim() : s;
}

FemoSeatCore.createSeatAgent({
  tag: 'kimi-seat',
  consoleTag: 'femo-seat-kimi',
  sessionRe: SESSION_RE,
  parseSessionTitle,
  inputCandidates: INPUT_CANDIDATES,
  sendCandidates: SEND_CANDIDATES,
  domReplySelector: REPLY_SELECTOR,  // 领养收尾的 DOM 全文（历史渲染的完整回复）
  sendFailNote: '发送失败：输入框未清空且未见生成启动（发送姿势待定型——盘点见日志）',
  noReplyNote: '回复已结束但网络闸没有收到正文（流格式变了？照 SITE.md 取证法复查）',
  logTitleCalibration: true,
});

// ── 流式诊断探针（常驻轻量仪表；2026-10-02 收集轮装表，用户拍板不删——形状漂移随时可能再来，哨兵常驻）──
// 盲区：delta 到服务端若 deliveryId 不认识是静默丢（防 400ms 噪音）——「流式
// 没收到」在日志里零痕迹。本探针独立监听 web-net（多监听器无害），把发射侧
// 的拍数与字数节奏报进服务日志：手工聊天即可验证全链——心跳在跳=闸与解析器
// 都活着；心跳没有=inject 闸/解析器的问题；心跳在跳而投影页不上墙=服务端/hub
// 侧的事。CoT 与正文分槽计数，思考流有没有一望便知。纯只读不碰收话。
(function deltaProbe() {
  const TAG = 'kimi-deltaprobe';
  const send = (line) => {
    try { console.info(`[${TAG}] ${line}`); } catch {}
    try { chrome.runtime.sendMessage({ type: 'web-report', payload: { sessionId: '', type: 'log', tag: TAG, line: String(line).slice(0, 380) } }); } catch { /* 扩展重载中，丢一次无妨 */ }
  };
  let beats = 0, think = 0, content = 0, lastBeatLog = 0, started = 0;
  window.addEventListener('web-net', (ev) => {
    const d = ev?.detail ?? {};
    if (d.phase === 'start') { started = Date.now(); send('流式探针：生成开始'); return; }
    if (d.phase === 'completed') {
      const dur = started ? `${Math.round((Date.now() - started) / 1000)}s` : '时长未知';
      send(`流式探针：生成结束（${dur}，delta ${beats} 拍 / 思考峰值 ${think} 字 / 正文峰值 ${content} 字）`);
      beats = 0; think = 0; content = 0; started = 0;
      return;
    }
    if (d.phase !== 'delta') return;
    beats += 1;
    think = Math.max(think, String(d.thinking ?? '').length);
    content = Math.max(content, String(d.content ?? '').length);
    const now = Date.now();
    if (now - lastBeatLog >= 5000) {
      lastBeatLog = now;
      send(`流式探针：delta 心跳 累计${beats}拍 思考${think}字 正文${content}字`);
    }
  });
})();
