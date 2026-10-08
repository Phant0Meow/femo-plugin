/**
 * content.js — 豆包会话页代理（隔离世界，每标签页一份）。2026-09-27 转正。
 *
 * 这把「角色椅」的三样本事（锚点换实证值）：
 *   ① 身份：读 URL 拿会话 id（/chat/<纯数字长 id>，SPA 换页跟住；发首条前
 *      的 local_ 临时号不匹配——正则只认纯数字）；
 *   ② 发送：任务文本写进 #input-engine-container 里的 ProseMirror 富文本
 *      编辑器（contenteditable 路线：execCommand 写入），派发 Enter 发送；
 *      发不出去再点发送钮候选——还不行就大声失败并附页面盘点（发送姿势的
 *      真值等第一次真派工定型）；
 *   ③ 收话：网络闸为主（inject.js 的 web-net 事件，SSE_REPLY_END 为准）——
 *      正文走 CHUNK_DELTA 增量，结束帧 brief 带全文可对账；FINISHED 一到同拍
 *      直报（亚秒冻结窗口已关）。DOM 兜底（REPLY_SELECTOR 文本连续 3 拍不变）
 *      是静默阶梯领养收尾的救命绳——reload 后网站从会话历史渲染回复、不重放
 *      补全 SSE，收结束信号全靠它（2026-10-02 补取证，见 SITE.md）。
 *
 * 会话名双来源：SSE_ACK 搭车收的会话清单（主）+ document.title 剥站点尾巴
 * （备）。
 *
 * 上行全部经 background（chrome.runtime.sendMessage），本脚本不直接碰网络。
 * 机器骨架唯一活在 extension/seat-agent-core.js（经 PAGE_SCRIPTS 首位注入，
 * globalThis.FemoSeatCore 交接）——本文件只剩这家站的实证事实。
 */

// content script 是经典脚本进不了 ESM：这份正则是 site.mjs SESSION_PATH_RE 的
// 镜像——改站两处同改（SITE.md 有 checklist）。
const SESSION_RE = /\/chat\/([0-9]{10,})/;

// 防重复执行（按扩展运行时判代，2026-09-26 二版，同 deepseek 包的实测坑）：
// 页面的隔离世界在页面不刷新时一直活着，布尔标记会跨扩展重载残留。
if (globalThis.__femoSeatInjected === chrome.runtime.id) {
  throw new Error('femo-seat: already injected (same runtime)');
}
globalThis.__femoSeatInjected = chrome.runtime.id;

/** 输入框候选：豆包自家锚定的输入区里的 ProseMirror 编辑器（真页盘点实证）
 *  打头，后面是结构兜底——都按「可见尺寸」过滤。 */
const INPUT_CANDIDATES = [
  '#input-engine-container [contenteditable="true"]',
  '[data-chat-input] [contenteditable="true"]',
  '#input-engine-container textarea',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'textarea',
];

/** 发送钮候选：常见发送钮特征。 */
const SEND_CANDIDATES = ['[aria-label*="发送"]', '[aria-label*="Send" i]', 'button[class*="send" i]'];

// ── DOM 收话兜底（2026-10-02 领养盘点实锤转正）─────────────────────────────
// 回答容器=回答语义的 testid：领养盘点探针在 152 字真实回复块上打出
// `div[data-testid="message_text_content"]`（祖先链上的 container-* 全是 CSS
// module 哈希类名，不可锚——见 SITE.md）。lastReplyText 取 querySelectorAll
// 最后一个=最新回复，恰好对上「一场戏一问一答、页上按序追加」的布局。
// 忙锚（生成中的「停止生成」钮）未取证——宁缺勿猜（假阳性会卡死领养）：
// 收话判定退化为「文本连续 3 拍不变」单条件，假阴性无害。
const REPLY_SELECTOR = '[data-testid="message_text_content"]';

/** 会话名（席位显示名）提取——站点私有层的标题退路：剥「豆包」站点尾巴
 *  （react-helmet 动态标题，会话名大概率进标题但带尾巴；剥完为空=无名）。 */
function parseSessionTitle(raw) {
  const s = String(raw ?? '').trim();
  const kept = s.split(/[|·\-—_]/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^(豆包|doubao)$/i.test(x));
  return kept.join(' · ');
}

FemoSeatCore.createSeatAgent({
  tag: 'doubao-seat',
  consoleTag: 'femo-seat-doubao',
  sessionRe: SESSION_RE,
  parseSessionTitle,
  rideAlongTitles: true,            // SSE_ACK 搭车收的会话清单为主，标题剥尾巴为备
  titlesLogNote: '从 SSE_ACK 搭车收到',
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
  const TAG = 'doubao-deltaprobe';
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
