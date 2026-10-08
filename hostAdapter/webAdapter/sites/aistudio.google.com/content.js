/**
 * content.js — AI Studio 会话页代理（隔离世界，每标签页一份）。2026-09-29 转正。
 *
 * 这把「角色椅」的三样本事（锚点全实证）：
 *   ① 身份：读 URL 拿会话 id（/prompts/<33位混合id>，SPA 换页跟住；探针地址
 *      上报实证；new_chat 是新会话占位不是 id，正则负向排除；Google 多账号
 *      /u/<N>/ 前缀一并容忍）；
 *   ② 发送：任务文本写进 textarea（Angular CDK 自适应 textarea，真页盘点
 *      实证——原生 setter + input 事件），Ctrl+Enter 派发发送（真页实证
 *      Enter 只换行不发送：下发后 CountTokens 起了、GenerateContent 没来）；
 *      发不出去再点 Run 钮候选——还不行就大声失败并附发送失败盘点（手势与
 *      候选钮的真值以盘点日志为准）；
 *   ③ 收话：只认网络闸（inject.js 的 web-net 事件，页面收完杀 XHR=完成）——
 *      正文/思考按块元数据分型攒，json+protobuf 分块解析；闸缺席大声失败，
 *      不猜。
 *
 * 会话名来源：document.title 动态更新（真页实证「问候与提供帮助 | Google AI
 * Studio」），剥「| Google AI Studio」站点尾巴即可，无需搭车。
 *
 * 上行全部经 background（chrome.runtime.sendMessage），本脚本不直接碰网络。
 * 机器骨架唯一活在 extension/seat-agent-core.js（经 PAGE_SCRIPTS 首位注入，
 * globalThis.FemoSeatCore 交接）——本文件只剩这家站的实证事实。
 */

// content script 是经典脚本进不了 ESM：这份正则是 site.mjs SESSION_PATH_RE 的
// 镜像——改站两处同改（SITE.md 有 checklist）。
const SESSION_RE = /\/(?:u\/\d+\/)?prompts\/((?!new_chat)[a-zA-Z0-9_-]{8,})/;

// 防重复执行（按扩展运行时判代，2026-09-26 二版，同 deepseek 包的实测坑）：
// 页面的隔离世界在页面不刷新时一直活着，布尔标记会跨扩展重载残留。
if (globalThis.__femoSeatInjected === chrome.runtime.id) {
  throw new Error('femo-seat: already injected (same runtime)');
}
globalThis.__femoSeatInjected = chrome.runtime.id;

/** 输入框候选：真页盘点实证的 Angular CDK 自适应 textarea 打头（全页唯一
 *  可见输入元素），后面是结构兜底——都按「可见尺寸」过滤。 */
const INPUT_CANDIDATES = [
  'textarea',
  '[role="textbox"]',
  '[contenteditable="true"]',
];

/** 发送钮候选：AI Studio 的 Run 钮特征（Enter 发不动时兜底用）。 */
const SEND_CANDIDATES = [
  '[aria-label*="Run" i]',
  'button[class*="run-button" i]',
  '[aria-label*="发送"]',
  '[aria-label*="Send" i]',
];

// ── DOM 收话兜底（2026-10-02 锚点收集轮四代探针+解剖拍取证转正）─────────────
// 回答容器三重语义：`ms-chat-turn:not(.thought-activity-host)
// .chat-turn-container.model .text-chunk`——①回合级（ms-chat-turn，一个回合
// 一个 #turn-<UUID>）；②模型侧（回合内 div.chat-turn-container 带 model 类，
// 解剖拍 chunk1/3/4 三例一致；用户消息回合无此标）；③非思考宿主（思考摘要
// 住 ms-chat-turn.thought-activity-host，其回合内 container 同样带 model——
// 不排除会把「Thoughts Expand to view…」折叠标签当回复收进来）。一条回复=
// 一个 text-chunk（570/634 字整条单块实证），lastReplyText 取最后一个=最新
// 回复 ✓。UUID 动态不可锚，元素名与语义类稳定。
// 忙锚未配（ms-run-button 生成中可见两轮实证、但按钮的 aria-label/title 属性
// 无证据，文本匹配无选择器可用——宁缺勿猜）：收话退化「文本连续 3 拍不变」
// 单条件。
const REPLY_SELECTOR =
  'ms-chat-turn:not(.thought-activity-host) .chat-turn-container.model .text-chunk';

/** 会话名（席位显示名）提取——站点私有层：标题动态更新（真页实证），剥
 *  「| Google AI Studio」站点尾巴（「|」与「-」都认），剥完为空 = 无名。 */
function parseSessionTitle(raw) {
  const s = String(raw ?? '').trim();
  const kept = s.split(/[|·\-—_]/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^(google ai studio|aistudio)$/i.test(x));
  return kept.join(' · ');
}

FemoSeatCore.createSeatAgent({
  tag: 'aistudio-seat',
  consoleTag: 'femo-seat-aistudio',
  sessionRe: SESSION_RE,
  parseSessionTitle,
  sendGesture: 'ctrlEnter',  // Enter 只换行不发送（真页实证）；Ctrl+Enter 是本站发送
  inputCandidates: INPUT_CANDIDATES,
  sendCandidates: SEND_CANDIDATES,
  domReplySelector: REPLY_SELECTOR,  // 领养收尾的 DOM 全文（历史渲染的完整回复）
  sendFailNote: '发送失败：输入框未清空且未见生成启动（盘点见日志——照发送失败盘点挑锚点）',
  noReplyNote: '回复已结束但网络闸没有收到正文（流格式变了？照 SITE.md 取证法复查）',
  logTitleCalibration: true,
});

// ── 流式诊断探针（常驻轻量仪表，2026-10-02 定位翻新：原收集轮临时件转常驻）──
// 盲区：delta 到服务端若 deliveryId 不认识是静默丢（防 400ms 噪音）——「流式
// 没收到」在日志里零痕迹。本探针独立监听 web-net（多监听器无害），把发射侧
// 的拍数与字数节奏报进服务日志：手工聊天即可验证全链——心跳在跳=闸与解析器
// 都活着；心跳没有=inject 闸/解析器的问题；心跳在跳而投影页不上墙=服务端/hub
// 侧的事。CoT 与正文分槽计数，思考流有没有一望便知。纯只读不碰收话。
// 2026-10-02 实战战绩：抓到 aistudio 解析器 0 收话实案（SITE.md 在案已修）。
(function deltaProbe() {
  const TAG = 'aistudio-deltaprobe';
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

// ── 临时：流收话诊断转储（2026-10-02 流式修闸取证专用，解析器修复后整段删除）──
// 背景：零收话回合的流体形状转储（head[N] 分段）住在 completed 帧的 diagKeys
// 数组尾部，骨架「流收话」一行日志被服务端 400 字截断吞掉——本探针独立监听
// web-net，把 diagKeys 逐条上报（每条一行日志，转储完整落账）。同期实案：
// fed=11605 / chunks=1 / skipMeta=1 / maxDepth=7——上游流形状与解析器假设脱钩
// （09-29 成例是浅层块数组，现 fluid 深嵌套），照全形状修闸。
(function diagDump() {
  const TAG = 'aistudio-recon';
  const send = (line) => {
    try { console.info(`[${TAG}] ${line}`); } catch {}
    try { chrome.runtime.sendMessage({ type: 'web-report', payload: { sessionId: '', type: 'log', tag: TAG, line: String(line).slice(0, 380) } }); } catch { /* 扩展重载中，丢一次无妨 */ }
  };
  window.addEventListener('web-net', (ev) => {
    if (ev?.detail?.phase !== 'completed') return;
    const keys = ev?.detail?.diagKeys ?? [];
    if (!keys.length) return;
    send(`流收话诊断 ${keys.length} 条，逐条如下`);
    keys.forEach((k, i) => send(`diag[${i}] ${k}`));
  });
})();
