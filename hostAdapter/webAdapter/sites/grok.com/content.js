/**
 * content.js — Grok 会话页代理（隔离世界，每标签页一份）。2026-09-29 转正。
 *
 * 这把「角色椅」的三样本事（锚点全实证）：
 *   ① 身份：读 URL 拿会话 id（/c/<36位连字符UUID>，R1 探针地址上报实证——
 *      上一版推测的 /conversation/ 形态作废；SPA 换页跟住）；
 *   ② 发送：任务文本写进 tiptap ProseMirror 可编辑 DIV（R1 盘点实证：
 *      cls 含 tiptap ProseMirror、placeholder「Ask Grok anything」——页上
 *      另有一个空 class 的 TEXTAREA 兄弟节点，被候选次序天然排后），派发
 *      Enter 发送；发不出去再点发送钮候选——还不行就大声失败并附页面盘点
 *      （发送姿势的真值等第一次真派工定型）；
 *   ③ 收话：只认网络闸（inject.js 的 WS 事件流解析，response.done 收口）——
 *      思考走 NOTETAKER 通道单独分桶（用户拍板「能收到就收」），不需要 DOM
 *      兜底；闸缺席大声失败，不猜。
 *
 * 会话名：document.title 恒「Grok」是死的（R1 标题快照实证）——靠清单/详情
 * GET 搭车（inject.js 收拢成 web-net 'titles' 帧交座席骨架对号）；收不到就
 * 落「无标题会话」，无害。
 *
 * 上行全部经 background（chrome.runtime.sendMessage），本脚本不直接碰网络。
 * 机器骨架唯一活在 extension/seat-agent-core.js（经 PAGE_SCRIPTS 首位注入，
 * globalThis.FemoSeatCore 交接）——本文件只剩这家站的实证事实。
 */

// content script 是经典脚本进不了 ESM：这份正则是 site.mjs SESSION_PATH_RE 的
// 镜像——改站两处同改（SITE.md 有 checklist）。
const SESSION_RE = /\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

// 防重复执行（按扩展运行时判代，2026-09-26 二版，同 deepseek 包的实测坑）：
// 页面的隔离世界在页面不刷新时一直活着，布尔标记会跨扩展重载残留。
if (globalThis.__femoSeatInjected === chrome.runtime.id) {
  throw new Error('femo-seat: already injected (same runtime)');
}
globalThis.__femoSeatInjected = chrome.runtime.id;

/** 输入框候选：R1 盘点实证的 tiptap ProseMirror 可编辑 DIV 打头（placeholder
 *  「Ask Grok anything」），结构兜底殿后——都按「可见尺寸」过滤。 */
const INPUT_CANDIDATES = [
  'div.tiptap.ProseMirror',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'textarea',
];

/** 发送钮候选：R1 按钮快照未见具名发送钮（快照被 OneTrust 弹窗污染），先按
 *  通用特征兜底——真派工发不动时按「发送失败盘点」的输出回填。 */
const SEND_CANDIDATES = [
  'button[type="submit"]',
  '[aria-label*="Send" i]',
  '[aria-label*="发送"]',
];

// ── DOM 收话兜底（2026-10-02 锚点收集轮取证转正）─────────────────────────
// 回答容器=自家 testid：取证探针页上 assistant-message×5 / user-message×4
// 分侧清清楚楚，五家里语义最硬的一家（领养收尾从历史 DOM 收全文）。
// 忙锚=「停止模型响应」钮（忙锚观察窗生成中实证可见）：标签若出自按钮文本
// 而非 aria-label 属性，选择器永远落空=假阴性无害（退化为「文本连续 3 拍
// 不变」单条件）；精确全等不会假阳性，骨架判定自带可见性护栏。
const REPLY_SELECTOR = '[data-testid="assistant-message"]';
const BUSY_SELECTOR = '[aria-label="停止模型响应"]';

/** 会话名（席位显示名）提取——document.title 恒「Grok」是死的（R1 标题快照
 *  实证），剥站点名后为空 = 无名（面板显示「无标题会话」），正名靠清单
 *  搭车。 */
function parseSessionTitle(raw) {
  const s = String(raw ?? '').trim();
  const kept = s.split(/[|·\-—_]/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^grok$/i.test(x));
  return kept.join(' · ');
}

FemoSeatCore.createSeatAgent({
  tag: 'grok-seat',
  consoleTag: 'femo-seat-grok',
  sessionRe: SESSION_RE,
  parseSessionTitle,
  rideAlongTitles: true,   // 标题恒「Grok」是死的——清单/详情 GET 双路搭车
  titlesLogNote: '从会话清单接口收到',
  inputCandidates: INPUT_CANDIDATES,
  sendCandidates: SEND_CANDIDATES,
  domReplySelector: REPLY_SELECTOR,  // 领养收尾的 DOM 全文（历史渲染的完整回复）
  domBusySelector: BUSY_SELECTOR,    // 生成中指示（「停止模型响应」钮）
  sendFailNote: '发送失败：输入框未清空且未见生成启动（发送姿势待定型——盘点见日志）',
  noReplyNote: '回复已结束但网络闸没有收到正文（WS 流格式变了？照 SITE.md 取证法复查）',
  logTitleCalibration: true,
});

// ── 流式诊断探针（常驻轻量仪表；2026-10-02 收集轮装表，用户拍板不删——形状漂移随时可能再来，哨兵常驻）──
// 盲区：delta 到服务端若 deliveryId 不认识是静默丢（防 400ms 噪音）——「流式
// 没收到」在日志里零痕迹。本探针独立监听 web-net（多监听器无害），把发射侧
// 的拍数与字数节奏报进服务日志：手工聊天即可验证全链——心跳在跳=闸与解析器
// 都活着；心跳没有=inject 闸/解析器的问题；心跳在跳而投影页不上墙=服务端/hub
// 侧的事。CoT 与正文分槽计数，思考流有没有一望便知。纯只读不碰收话。
(function deltaProbe() {
  const TAG = 'grok-deltaprobe';
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
