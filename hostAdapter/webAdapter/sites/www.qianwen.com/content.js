/**
 * content.js — 千问会话页代理（隔离世界，每标签页一份）。2026-09-29 转正。
 *
 * 这把「角色椅」的三样本事（锚点全实证）：
 *   ① 身份：读 URL 拿会话 id（/chat/<32位十六进制>，R1 探针地址上报实证；
 *      SPA 换页跟住）；
 *   ② 发送：任务文本写进可编辑 DIV（R1 盘点实证：唯一可见输入元素，
 *      cls 含 whitespace-pre-wrap 的 contenteditable——受控富文本编辑器），
 *      走粘贴事件管线写入（2026-10-03 job 2690 首派工实案：execCommand 绕过
 *      编辑器的状态管线——字进得了框、状态不认账，编辑器拒绝一切后续编辑、
 *      真人也删不了字、发送钮永远灰；见 SITE.md），派发 Enter 发送；发不出
 *      去再点发送钮候选——还不行就大声失败并附页面盘点；
 *   ③ 收话：只认网络闸（inject.js 的 SSE 解析，sse_end=1 收口）——思考
 *      （bar_thinking）与正文（multi_load/iframe）分桶，用户拍板「能收就收」；
 *      闸缺席大声失败，不猜。
 *
 * 会话名：document.title 恒「千问-阿里 AI 助手」是死的（R1 标题快照实证）
 * ——靠会话详情/清单 POST 搭车（inject.js 收拢成 web-net 'titles' 帧交座席
 * 骨架对号；R1 实证 session/get 响应带 data.title）；收不到落「无标题会话」，
 * 无害。
 *
 * 上行全部经 background（chrome.runtime.sendMessage），本脚本不直接碰网络。
 * 机器骨架唯一活在 extension/seat-agent-core.js（经 PAGE_SCRIPTS 首位注入，
 * globalThis.FemoSeatCore 交接）——本文件只剩这家站的实证事实。
 */

// content script 是经典脚本进不了 ESM：这份正则是 site.mjs SESSION_PATH_RE 的
// 镜像——改站两处同改（SITE.md 有 checklist）。
const SESSION_RE = /\/chat\/([0-9a-f]{32})/;

// 防重复执行（按扩展运行时判代，2026-09-26 二版，同 deepseek 包的实测坑）：
// 页面的隔离世界在页面不刷新时一直活着，布尔标记会跨扩展重载残留。
if (globalThis.__femoSeatInjected === chrome.runtime.id) {
  throw new Error('femo-seat: already injected (same runtime)');
}
globalThis.__femoSeatInjected = chrome.runtime.id;

/** 输入框候选：R1 盘点实证的可编辑 DIV（whitespace-pre-wrap 特征）打头，
 *  结构兜底殿后——都按「可见尺寸」过滤。 */
const INPUT_CANDIDATES = [
  'div[contenteditable="true"][class*="whitespace-pre-wrap"]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'textarea',
];

/** 发送钮候选：R1 快照未见具名发送钮，按通用特征兜底——真派工发不动时按
 *  「发送失败盘点」的输出回填。 */
const SEND_CANDIDATES = [
  'button[type="submit"]',
  '[aria-label*="发送"]',
  '[aria-label*="Send" i]',
];

// ── DOM 收话兜底（2026-10-02 锚点收集轮取证转正）─────────────────────────
// 回答容器：取证探针两轮同链——回复正文住 `div#qk-markdown-react.qk-markdown`
// （markdown 渲染根，首轮带 qk-markdown-complete 状态类、次轮没有——状态类
// 不可依赖），其上层层是 `div.answer-common-card`（answer 语义卡，用户消息
// 不入此卡，天然排除）。所以锚「answer 卡内的 qk-markdown」：两段都是页上
// 实证的语义类，任一改版即失配=收话文本空=继续等，假阴性无害。
// 忙锚：60 秒观察窗未见「停止/stop」钮——未配（宁缺勿猜），收话判定退化
// 为「文本连续 3 拍不变」单条件。
const REPLY_SELECTOR = '.answer-common-card .qk-markdown';

/** 会话名（席位显示名）提取——document.title 恒「千问-阿里 AI 助手」是死的
 *  （R1 标题快照实证），剥站点名后为空 = 无名（面板显示「无标题会话」），
 *  正名靠详情/清单搭车。 */
function parseSessionTitle(raw) {
  const s = String(raw ?? '').trim();
  const kept = s.split(/[|·\-—_]/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^(千问|阿里 AI 助手|qianwen)$/i.test(x));
  return kept.join(' · ');
}

FemoSeatCore.createSeatAgent({
  tag: 'qwen-seat',
  consoleTag: 'femo-seat-qwen',
  sessionRe: SESSION_RE,
  parseSessionTitle,
  rideAlongTitles: true,   // 标题恒「千问-阿里 AI 助手」是死的——详情/清单 POST 双路搭车
  titlesLogNote: '从会话详情/清单接口收到',
  inputCandidates: INPUT_CANDIDATES,
  sendCandidates: SEND_CANDIDATES,
  writeMode: 'paste',  // 受控富文本编辑器只认粘贴管线（job 2690 实案：execCommand 把编辑器写成砖——见头注与 SITE.md）
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
  const TAG = 'qwen-deltaprobe';
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
