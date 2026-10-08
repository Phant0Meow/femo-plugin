/**
 * content.js — ChatGLM 会话页代理（隔离世界，每标签页一份）。2026-09-27 转正。
 *
 * 这把「角色椅」的三样本事（锚点换实证值）：
 *   ① 身份：读 URL 拿会话 id（/main/alltoolsdetail?…&cid=<24位hex>，SPA 换页跟住）；
 *   ② 发送：任务文本写进全页唯一可见的 textarea（Vue 受控组件，原生 setter +
 *      input 事件），派发 Enter 发送；发不出去再点发送钮候选——还不行就大声
 *      失败并附页面盘点（发送姿势的真值等第一次真派工定型）；
 *   ③ 收话：网络闸为主（inject.js 的 web-net 事件，顶层 status finish 为准，
 *      思考/正文分离全文收尾）；闸缺席时退 DOM 兜底（REPLY_SELECTOR 文本稳定
 *      数秒）——查岗收割模型的领养收尾全靠这条（reload 后历史渲染不重放 SSE，
 *      2026-10-02 补取证，见 SITE.md）。
 *
 * 会话名双来源：搭车收的会话清单（主）+ document.title 剥站点尾巴（备）。
 *
 * 上行全部经 background（chrome.runtime.sendMessage），本脚本不直接碰网络。
 * 机器骨架唯一活在 extension/seat-agent-core.js（经 PAGE_SCRIPTS 首位注入，
 * globalThis.FemoSeatCore 交接）——本文件只剩这家站的实证事实。
 */

// content script 是经典脚本进不了 ESM：这份正则是 site.mjs SESSION_PATH_RE 的
// 镜像——改站两处同改（SITE.md 有 checklist）。
const SESSION_RE = /\/main\/(?:alltoolsdetail|detail)\/?.*?[?&]cid=([0-9a-f]{24})/;

// 防重复执行（按扩展运行时判代，2026-09-26 二版，同 deepseek 包的实测坑）：
// 页面的隔离世界在页面不刷新时一直活着，布尔标记会跨扩展重载残留。
if (globalThis.__femoSeatInjected === chrome.runtime.id) {
  throw new Error('femo-seat: already injected (same runtime)');
}
globalThis.__femoSeatInjected = chrome.runtime.id;

/** 输入框候选：全页唯一可见 textarea（真页盘点实证）；后面是结构兜底。 */
const INPUT_CANDIDATES = [
  'textarea',
  '[role="textbox"][contenteditable="true"]',
  '[contenteditable="true"]',
];

/** 发送钮候选：常见发送钮特征。 */
const SEND_CANDIDATES = ['[aria-label*="发送"]', '[aria-label*="Send" i]', 'button[class*="send" i]'];

// ── DOM 收话兜底（2026-10-02 补取证，查岗收割模型的领养收尾要靠它）─────────
// 背景：GLM 页被浏览器冻结→查岗轮 reload→领养收尾时，网站从会话历史渲染
// 回复、**不重放补全 SSE**——旧裁决「收话只认网络闸」下领养永远等不到结尾
// （实案 job 2675：卡在发言节点，冻结→reload→领养每 15 秒一轮死循环）。
//
// 回答容器=回答语义的 markdown 正文（真页盘点定案 2026-10-02：领养盘点探针
// 报出可见大文本类名链 `div.markdown-body.md-body.tl ← div ← div ←
// div.answer-content-wrap ← div.code-box.flex1`；打包代码里的
// `markdown-body common-answer` 是另一创作面的类，主聊天不用——侦察级证据
// 不敌真页盘点，教训记 SITE.md）。用 `.answer-content` 限定回答语义：不匹配
// 用户消息，当前回复没渲染到页上时匹配为空 → 收话文本空 → 继续等。
const REPLY_SELECTOR = '.answer-content .markdown-body';

// 忙碌锚点：生成中的「停止生成」钮（class:"stop-generate"，渲染代码里 v-if
// 条件挂在 loading 态内、空闲不存在——假阳性即空闲仍命中，会卡死领养，所以
// 只给有渲染证据的）。取证只落到创作面的加载态，主聊天生成中的停止钮真身
// 未取证——宁可少给不猜：假阴性无害（领养收尾退化为纯「文本稳定数秒」判定）。
const BUSY_SELECTOR = '.stop-generate';

/** 会话名（席位显示名）提取——站点私有层：SPA 标题默认整顶「智谱清言」
 *  （首页 <title> 实证），即使随会话更新也多半带站点尾巴。剥尾巴，剥完为空
 *  =无名（面板显示「无标题会话」）。真页格式若与推断不符，照服务日志的
 *  raw 行校准本函数。 */
function parseSessionTitle(raw) {
  const s = String(raw ?? '').trim();
  const kept = s.split(/[|·\-—_]/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^(智谱清言|chatglm|z\.ai)$/i.test(x));
  return kept.join(' · ');
}

FemoSeatCore.createSeatAgent({
  tag: 'cglm-seat',
  consoleTag: 'femo-seat-cglm',
  sessionRe: SESSION_RE,
  execHref: true,   // 会话页 cid 在查询串里：对整串 href exec（其余站 pathname 就够）
  parseSessionTitle,
  rideAlongTitles: true,            // SPA 标题恒「智谱清言」不随会话变——搭车清单为主
  titlesLogNote: '从页面自取的会话清单收到',
  inputCandidates: INPUT_CANDIDATES,
  sendCandidates: SEND_CANDIDATES,
  domReplySelector: REPLY_SELECTOR,  // 领养收尾的 DOM 全文（历史渲染的完整回复）
  domBusySelector: BUSY_SELECTOR,    // 生成中指示（「停止生成」钮；主聊天未取证，宁缺勿猜）
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
  const TAG = 'cglm-deltaprobe';
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
