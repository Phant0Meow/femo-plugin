/**
 * site.mjs — 这家网站的「户口本」：机器可读的网站事实唯一清单。
 *
 * 本文件夹（grok.com/）= Grok 官网的知识包。站点包契约见同目录 SITE.md；
 * 多站点登记见适配器根 sites.mjs。**在役**（2026-09-29 四轮探针取证当日转
 * 正）：座席上线、悬浮球亮。取证全谱：门牌=grok.com（www 落到它，静态探测
 * 实证）；补全**不走 fetch/XHR**——走 WebSocket（wss://grok.com/ws/mgw/，事
 * 件制协议，四轮探针定谳）；会话页 /c/<UUID>、输入框 tiptap ProseMirror、
 * 思考可见（NOTETAKER 通道，用户拍板能收就收）——全谱见 SITE.md。
 */

/** 站点名（=文件夹名；正式门牌 grok.com——www.grok.com 落到这，2026-09-29
 *  走本机代理探测实证：跳转链落点=https://grok.com/）。 */
export const SITE_ID = 'grok.com';

/** 站点首页（SPA：任意路径都回同一份壳，路由由前端接管）。 */
export const SITE_URL = 'https://grok.com';

/** 扩展登记与标签页查询用的通配。 */
export const SITE_MATCH = 'https://grok.com/*';

/** 侧栏站点围栏正则。 */
export const SITE_FENCE_RE = /^https:\/\/grok\.com\//;

/** 本包自己的页面脚本（正式代理一对；PAGE_SCRIPTS 亦是 manifest 注入清单
 *  的镜像）。座席机器骨架排首位——content.js 之前，经典脚本按序注入同一
 *  隔离世界。 */
export const PAGE_SCRIPTS = ['extension/seat-agent-core.js', 'sites/grok.com/content.js', 'sites/grok.com/inject.js'];

/** 在役：探针已退役，座席上线（悬浮球随在役亮起）。 */
export const PROBE_MODE = false;

// 【已实证·探针地址上报】会话页 = /c/<36位连字符 UUID>（2026-09-29 R1
// 真页地址上报实证：/c/f0e046e8-97a2-…?rid=…；上一版推测的 /conversation/ 形
// 态作废）。若后续地址上报出现他形 id，正则放宽一档并记录。
export const SESSION_PATH_RE = /\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

/** 会话 id 本体校验（与 SESSION_PATH_RE 同源，open-tab 帧防注入）。 */
export const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 会话 id → 会话页 URL（与 SESSION_PATH_RE 同源）。 */
export function sessionUrl(sessionId) {
  return `${SITE_URL}/c/${sessionId}`;
}

/** 对话补全通道（四轮探针定谳）：**WebSocket**（wss://grok.com/ws/mgw/）——
 *  本站补全不走 fetch/XHR（R1 定谳两道闸只看得见历史加载）。正式 inject.js
 *  闸 WS 构造器；此路径留作档案与 SITE.md 指路（正式闸不走 HTTP 拦截，
 *  COMPLETION_PATH 的「拦截路径」语义对本站不适用，留空）。 */
export const COMPLETION_PATH = '';

/** 自家接口探针宽匹配（【取证中·最佳推测】公开资料普遍指自家接口住
 *  /rest/app-chat/ 前缀；inject.js 探针另加 conversation/message 领域词兜
 *  旁路）。收端去重，猜错了也无害——真补全请求另由抓取词表兜住上报。 */
export const API_PROBE = '/rest/app-chat/';

/** 站点显示名。 */
export const SITE_LABEL = 'Grok';

// ── 会话引用与会话名（站点私有的「名字」层）──────────────────────────
/** 会话引用：`<本站域名>:<会话id>`——形态契约本包所有（整串当 sid 全链流转）。
 *  content.js 是经典脚本进不了 ESM，拼装正身住 extension/seat-agent-core.js
 *  （机器骨架收编后的唯一一份；本包转正时经 PAGE_SCRIPTS 首位注入）。 */
export function sessionRef(sessionId) {
  return `${SITE_ID}:${sessionId}`;
}

/** 拆会话引用：本站的引用 → 会话 id；不是本站的 → undefined。 */
export function parseSessionRef(ref) {
  const prefix = `${SITE_ID}:`;
  const s = String(ref ?? '');
  return s.startsWith(prefix) ? s.slice(prefix.length) : undefined;
}
