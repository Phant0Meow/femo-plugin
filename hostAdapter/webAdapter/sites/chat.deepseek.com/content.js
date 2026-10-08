/**
 * content.js — DeepSeek 会话页代理（隔离世界，每标签页一份）。
 *
 * 这把「角色椅」的三样本事：
 *   ① 身份：读 URL 拿会话 id（/a/chat/s/<uuid>，SPA 换页不刷新也要跟住）；
 *   ② 发送：FEMO 下发的任务文本写进 #chat-input（React 受控组件要走原生 setter + input 事件），
 *      派发 Enter 键发送（社区 Playwright 实证的发送姿势），发不出去再点发送钮；
 *   ③ 收话：等网络闸（inject.js 的 web-net 事件，FINISHED 为准）——网络闸缺席
 *      时退到「DOM 文本稳定几秒」的笨办法（这是已知降级，超长思考可能误判），
 *      然后把最后一段 .ds-markdown 整段收走交回。
 *
 * 上行全部经 background（chrome.runtime.sendMessage），本脚本不直接碰网络。
 *
 * 归属：本文件住 sites/chat.deepseek.com/（站点包）——DOM 锚点与发送姿势都是这家
 * 官网的事实，「换一家官网=换这个文件夹」。网站事实全谱见同目录 SITE.md。
 * 机器骨架（守卫/换页跟踪/草稿节流/输入框扫描/收话/下发主流程）唯一活在
 * extension/seat-agent-core.js（经 PAGE_SCRIPTS 首位注入，globalThis.FemoSeatCore
 * 交接）——本文件只剩这家站的实证事实。
 */

// content script 是经典脚本进不了 ESM：这份正则是 site.mjs SESSION_PATH_RE 的
// 镜像——改站两处同改（SITE.md 有 checklist）。
const SESSION_RE = /\/a\/chat\/s\/([A-Za-z0-9-]{8,})/;

// 防重复执行（按扩展运行时判代，2026-09-26 二版）：页面的隔离世界在页面不刷新时
// 一直活着，布尔标记会跨扩展重载残留——上一世留下的标记会把补注入的新代理杀死，
// 页面从此永远离线（实测坑：「它离线也是在线」的幽灵根因之一）。
// 判据改为扩展运行时指纹：标记里存 chrome.runtime.id，同扩展 = 同世，拒绝重复；
// 不同扩展运行时 = 上一世旧代理（其 chrome.runtime 已死，收发全废），新代理接管。
if (globalThis.__femoSeatInjected === chrome.runtime.id) {
  throw new Error('femo-seat: already injected (same runtime)');
}
globalThis.__femoSeatInjected = chrome.runtime.id;

/** 输入框候选名单：第一个是社区长期实证的老锚点，后面是结构兜底——
 *  都按「可见尺寸」过滤（页面上可能藏着隐藏模板）。 */
const INPUT_CANDIDATES = [
  '#chat-input',
  'textarea[id*="input" i]',
  'textarea[class*="input" i]',
  '[class*="chat-input"]',
  '[role="textbox"][contenteditable="true"]',
  'textarea',
  '[contenteditable="true"]',
];

/** 发送钮候选：老 id + 常见发送钮特征。 */
const SEND_CANDIDATES = ['#send-message-button', '[aria-label*="发送"]', '[aria-label*="Send" i]', 'button[class*="send" i]'];

/** 会话名（席位显示名）提取——站点私有层：deepseek 实证页面标题即会话名
 *  （无站点尾巴），原样取用。 */
function parseSessionTitle(raw) {
  return String(raw ?? '').trim();
}

FemoSeatCore.createSeatAgent({
  tag: 'content',
  consoleTag: 'femo-seat',
  sessionRe: SESSION_RE,
  parseSessionTitle,
  inputCandidates: INPUT_CANDIDATES,
  sendCandidates: SEND_CANDIDATES,
  // DOM 忙碌锚点：生成中的可见指示（打字/加载容器，或标题带「停止」的按钮）。
  domBusySelector: '.ds-typing-container, [class*="typing" i][class*="container"], button[title*="停止" i], [aria-label*="停止" i]',
  // DOM 收话兜底（网络闸缺席的已知降级）：最后一段回答容器。
  domReplySelector: '.ds-markdown',
  sendFailNote: '发送失败：输入框未清空且未见生成启动',
  noReplyNote: '回复已结束但页面上没有可收的内容（网络闸与 DOM 都空）',
});

// ── 流式诊断探针（常驻轻量仪表；2026-10-02 收集轮装表，用户拍板不删——形状漂移随时可能再来，哨兵常驻）──
// 盲区：delta 到服务端若 deliveryId 不认识是静默丢（防 400ms 噪音）——「流式
// 没收到」在日志里零痕迹。本探针独立监听 web-net（多监听器无害），把发射侧
// 的拍数与字数节奏报进服务日志：手工聊天即可验证全链——心跳在跳=闸与解析器
// 都活着；心跳没有=inject 闸/解析器的问题；心跳在跳而投影页不上墙=服务端/hub
// 侧的事。CoT 与正文分槽计数，思考流有没有一望便知。纯只读不碰收话。
(function deltaProbe() {
  const TAG = 'ds-deltaprobe';
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
