/**
 * site.mjs — 这家网站的「户口本」：机器可读的网站事实唯一清单。
 *
 * 本文件夹（www.qianwen.com/）= 千问（阿里 AI 助手）官网的知识包。站点包契
 * 约见同目录 SITE.md；多站点登记见适配器根 sites.mjs。**在役**（2026-09-29
 * 六轮探针取证当日转正）：座席上线、悬浮球亮。取证全谱：门牌=www.qianwen.com
 * （国内站直连可达）；补全 = POST chat2.qianwen.com/api/v2/chat（SSE）；
 * 会话页 /chat/<32hex>；思考=bar_thinking 快照（照收，用户拍板能收就收）、
 * 正文=multi_load/iframe 快照（均覆盖式全量）——全谱见 SITE.md。
 */

/** 站点名（=文件夹名；正式门牌 www.qianwen.com——qianwen.com 落到这，
 *  2026-09-29 直连探测实证：双域名落点都是 https://www.qianwen.com/）。 */
export const SITE_ID = 'www.qianwen.com';

/** 站点首页（SPA：任意路径都回这份壳，路由由前端接管）。 */
export const SITE_URL = 'https://www.qianwen.com';

/** 扩展登记与标签页查询用的通配。 */
export const SITE_MATCH = 'https://www.qianwen.com/*';

/** 侧栏站点围栏正则。 */
export const SITE_FENCE_RE = /^https:\/\/www\.qianwen\.com\//;

/** 本包自己的页面脚本（正式代理一对；PAGE_SCRIPTS 亦是 manifest 注入清单
 *  的镜像）。座席机器骨架排首位——content.js 之前，经典脚本按序注入同一
 *  隔离世界。 */
export const PAGE_SCRIPTS = ['extension/seat-agent-core.js', 'sites/www.qianwen.com/content.js', 'sites/www.qianwen.com/inject.js'];

/** 在役：探针已退役，座席上线（悬浮球随在役亮起）。 */
export const PROBE_MODE = false;

// 【已实证·探针地址上报】会话页 = /chat/<32位十六进制>（2026-09-29 R1
// 真页地址上报实证：/chat/7e26f4a360e24b1ebf502999afad6763 等，32 hex 无连字
// 符；URL 另带 ch= 等投放查询参数，正则天然不认）。若后续地址上报出现他形
// id，正则放宽一档并记录。
export const SESSION_PATH_RE = /\/chat\/([0-9a-f]{32})/;

/** 会话 id 本体校验（与 SESSION_PATH_RE 同源，open-tab 帧防注入）。 */
export const SESSION_ID_RE = /^[0-9a-f]{32}$/;

/** 会话 id → 会话页 URL（与 SESSION_PATH_RE 同源）。 */
export function sessionUrl(sessionId) {
  return `${SITE_URL}/chat/${sessionId}`;
}

/** 对话补全接口路径（六轮探针定谳）：POST chat2.qianwen.com/api/v2/chat——
 *  请求打独立子域 chat2.qianwen.com，路径即拦截凭据（匹配任何域名上的这个
 *  路径，与页面行为同构）；流格式见 SITE.md。 */
export const COMPLETION_PATH = '/api/v2/chat';

/** 自家接口探针宽匹配（静态实锤：自家接口住 /api/ 前缀，另有 chat2-api
 *  子域字样；inject.js 探针按词命中 URL 逐条上报，收端去重）。 */
export const API_PROBE = '/api/';

/** 站点显示名。 */
export const SITE_LABEL = '千问';

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
