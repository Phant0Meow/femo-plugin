/**
 * content.js — ChatGPT 会话页代理（隔离世界，每标签页一份）。2026-09-29 转正。
 *
 * 这把「角色椅」的三样本事（锚点全实证）：
 *   ① 身份：读 URL 拿会话 id（/c/<36位连字符UUID>，SPA 换页跟住；探针地址上报
 *      实证。瞬态地址 /c/WEB:<uuid> 是路由内部形态，正则天然不认，随后归一化
 *      的正规地址会来）；
 *   ② 发送：任务文本写进 #prompt-textarea（ProseMirror 可编辑 DIV，真页盘点
 *      实证——页上另有隐藏 fallback textarea，被可见过滤天然排除；同款写入
 *      姿势见豆包包），派发 Enter 发送；发不出去再点发送钮候选——还不行就
 *      大声失败并附页面盘点（发送姿势的真值等第一次真派工定型）；
 *   ③ 收话：只认网络闸（inject.js 的 web-net 事件，三层结束保险）——正文按
 *      粘性指针攒、思考全剔除（CoT 隐藏站），不需要 DOM 兜底；闸缺席大声失败，
 *      不猜。
 *
 * 会话名双来源（标题恒「ChatGPT」是死的，探针标题快照实证）：流内
 * title_generation 搭车（新会话，主）+ 会话清单/详情 GET 响应搭车（旧会话续聊，
 * 备），由 inject.js 收拢成 web-net 'titles' 帧交座席骨架对号。
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

/** 输入框候选：真页盘点实证的 #prompt-textarea（ProseMirror 可编辑 DIV）打头，
 *  后面是结构兜底——都按「可见尺寸」过滤（页上藏着一个不可见的 fallback
 *  textarea，会被排除）。 */
const INPUT_CANDIDATES = [
  '#prompt-textarea',
  'form[class*="composer"] [contenteditable="true"]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'textarea',
];

/** 发送钮候选：composer 提交钮类名（真页按钮快照实证）打头，常见特征兜底。 */
const SEND_CANDIDATES = [
  '.composer-submit-button-color',
  'button[data-testid="send-button"]',
  '[aria-label*="发送"]',
  '[aria-label*="Send" i]',
];

// ── DOM 收话兜底（2026-10-02 锚点收集轮取证转正）─────────────────────────
// 回答容器：每个回合一张 testid（探针页上 conversation-turn-1..4 编号连发，
// 用户/AI 回合都算 turn），回复正文住 `.markdown.prose`（探针链实证；
// LR5Y_W_ 前缀哈希类不锚）。两段取交集：turn 限定会话流、markdown.prose
// 限定回答正文——用户回合是否也有 markdown.prose 未取证，但收话取
// querySelectorAll 最后一个，正常领养场景末位就是 AI 回复。
// 忙锚：取证探针 busy 观察窗抓个正着——生成中发送钮变 stop
// （data-testid="stop-button"，空闲是 send-button），精确 testid 零假阳性。
const REPLY_SELECTOR = '[data-testid^="conversation-turn-"] .markdown.prose';
const BUSY_SELECTOR = '[data-testid="stop-button"]';

/** 会话名（席位显示名）提取——站点私有层的标题退路：document.title 恒为
 *  「ChatGPT」（探针标题快照实证，死的），剥站点尾巴后为空 = 无名（面板显示
 *  「无标题会话」），正名靠 rideAlongTitles 的双路搭车。 */
function parseSessionTitle(raw) {
  const s = String(raw ?? '').trim();
  const kept = s.split(/[|·\-—_]/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^(chatgpt|chat\.openai\.com)$/i.test(x));
  return kept.join(' · ');
}

FemoSeatCore.createSeatAgent({
  tag: 'cgpt-seat',
  consoleTag: 'femo-seat-cgpt',
  sessionRe: SESSION_RE,
  parseSessionTitle,
  rideAlongTitles: true,   // 标题恒「ChatGPT」是死的——流内 title_generation + 清单 GET 双路搭车
  titlesLogNote: '从补全流与清单接口收到',
  inputCandidates: INPUT_CANDIDATES,
  sendCandidates: SEND_CANDIDATES,
  domReplySelector: REPLY_SELECTOR,  // 领养收尾的 DOM 全文（历史渲染的完整回复）
  domBusySelector: BUSY_SELECTOR,    // 生成中指示（发送钮变身的 stop 钮）
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
  const TAG = 'cgpt-deltaprobe';
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
