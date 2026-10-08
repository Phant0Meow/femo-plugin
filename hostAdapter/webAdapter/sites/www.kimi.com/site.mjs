/**
 * site.mjs — 这家网站的「户口本」：机器可读的网站事实唯一清单。
 *
 * 本文件夹（www.kimi.com/）= Kimi 官网的知识包。站点包契约见同目录 SITE.md；
 * 多站点登记见适配器根 sites.mjs。2026-09-28 三轮探针取证当日转正（会话页、
 * 补全接口、流格式、输入框真身、会话名来源全部实证——事实全谱见 SITE.md）。
 */

/** 站点名（=文件夹名；正式门牌带 www——kimi.com 与 www 双双落到这里）。 */
export const SITE_ID = 'www.kimi.com';

/** 站点首页（SPA：任意路径都回这份落地页，路由由前端接管）。 */
export const SITE_URL = 'https://www.kimi.com';

/** 扩展登记与标签页查询用的通配。 */
export const SITE_MATCH = 'https://www.kimi.com/*';

/** 侧栏站点围栏正则。 */
export const SITE_FENCE_RE = /^https:\/\/www\.kimi\.com\//;

/** 本包自己的页面脚本（正式代理一对；PAGE_SCRIPTS 亦是 manifest 注入清单的镜像）。 */
export const PAGE_SCRIPTS = ['extension/seat-agent-core.js', 'sites/www.kimi.com/content.js', 'sites/www.kimi.com/inject.js'];

/** 在役：探针已退役，座席上线（悬浮球随在役亮起）。 */
export const PROBE_MODE = false;

// 【已实证·探针地址上报】会话页 = /chat/<UUID>（36 位连字符 UUID；2026-09-28
// 真页地址上报实证）。若后续地址上报出现他形 id，正则放宽一档并记录。
export const SESSION_PATH_RE = /\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

/** 会话 id 本体校验（与 SESSION_PATH_RE 同源，open-tab 帧防注入）。 */
export const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 会话 id → 会话页 URL（与 SESSION_PATH_RE 同源）。 */
export function sessionUrl(sessionId) {
  return `${SITE_URL}/chat/${sessionId}`;
}

/** 对话补全接口路径（探针实证：发消息即开火的就是它；流格式见 SITE.md）。 */
export const COMPLETION_PATH = '/apiv2/kimi.gateway.chat.v1.ChatService/Chat';

/** 自家接口探针宽匹配（探针实证：自家接口全住 /apiv2/ 前缀；正式 inject.js
 *  保留逐条上报——上游换格式一次下发就能取证）。 */
export const API_PROBE = '/apiv2/';

/** 站点显示名。 */
export const SITE_LABEL = 'Kimi';

// ── 会话引用与会话名（站点私有的「名字」层）──────────────────────────
/** 会话引用：`<本站域名>:<会话id>`——形态契约本包所有（整串当 sid 全链流转）。
 *  content.js 是经典脚本进不了 ESM，内嵌同形镜像，改形态两处同改。 */
export function sessionRef(sessionId) {
  return `${SITE_ID}:${sessionId}`;
}

/** 拆会话引用：本站的引用 → 会话 id；不是本站的 → undefined。 */
export function parseSessionRef(ref) {
  const prefix = `${SITE_ID}:`;
  const s = String(ref ?? '');
  return s.startsWith(prefix) ? s.slice(prefix.length) : undefined;
}
