/**
 * site.mjs — 这家网站的「户口本」：机器可读的网站事实唯一清单。
 *
 * 本文件夹（aistudio.google.com/）= Google AI Studio 的知识包。站点包契约见
 * 同目录 SITE.md；多站点登记见适配器根 sites.mjs。2026-09-29 四轮探针取证
 * 当日转正（会话页、补全接口、流格式、输入框真身、会话名来源全部实证——
 * 事实全谱与破案实录见 SITE.md）。
 */

/** 站点名（=文件夹名；正式门牌 aistudio.google.com——未登录 /prompts 会跳
 *  accounts.google.com 登录，裸根落 /welcome，2026-09-29 走本机代理探测实证）。 */
export const SITE_ID = 'aistudio.google.com';

/** 站点首页（SPA：任意路径都回这份落地页，路由由前端接管）。 */
export const SITE_URL = 'https://aistudio.google.com';

/** 扩展登记与标签页查询用的通配。 */
export const SITE_MATCH = 'https://aistudio.google.com/*';

/** 侧栏站点围栏正则。 */
export const SITE_FENCE_RE = /^https:\/\/aistudio\.google\.com\//;

/** 本包自己的页面脚本（正式代理一对；PAGE_SCRIPTS 亦是 manifest 注入清单的
 *  镜像）。座席机器骨架排首位——content.js 之前，经典脚本按序注入同一隔离
 *  世界。 */
export const PAGE_SCRIPTS = ['extension/seat-agent-core.js', 'sites/aistudio.google.com/content.js', 'sites/aistudio.google.com/inject.js'];

/** 在役：探针已退役，座席上线（悬浮球随在役亮起）。 */
export const PROBE_MODE = false;

// 【已实证·探针地址上报】会话页 = /prompts/<33位混合id>（2026-09-29 真页地址
// 上报实证；new_chat 是新会话占位不是 id，负向排除；Google 多账号 /u/<N>/
// 前缀一并容忍）。若后续地址上报出现他形 id，正则放宽一档并记录。
export const SESSION_PATH_RE = /\/(?:u\/\d+\/)?prompts\/((?!new_chat)[a-zA-Z0-9_-]{8,})/;

/** 会话 id 本体校验（与 SESSION_PATH_RE 同源，open-tab 帧防注入）。 */
export const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,}$/;

/** 会话 id → 会话页 URL（与 SESSION_PATH_RE 同源；多账号 /u/N 路径不拼也通，
 *  Google 会自动归到当前账号）。 */
export function sessionUrl(sessionId) {
  return `${SITE_URL}/prompts/${sessionId}`;
}

/** 对话补全接口路径（四轮探针实证：发消息即开火的就是它；跨源打 clients6
 *  主机但页面自己的 XHR 一样过闸。**无前导斜杠**——真 URL 里服务名前面是
 *  「点」（…v1.MakerSuiteService/…），带 '/' 匹配不上。流格式见 SITE.md）。 */
export const COMPLETION_PATH = 'MakerSuiteService/GenerateContent';

/** 自家接口探针宽匹配（探针实证：自家接口全住 $rpc 路径标记下；正式
 *  inject.js 保留逐条上报——上游换格式一次下发就能取证）。 */
export const API_PROBE = '$rpc';

/** 站点显示名。 */
export const SITE_LABEL = 'Google';

// ── 会话引用与会话名（站点私有的「名字」层）──────────────────────────
/** 会话引用：`<本站域名>:<会话id>`——形态契约本包所有（整串当 sid 全链流转）。
 *  content.js 是经典脚本进不了 ESM，拼装正身住 extension/seat-agent-core.js
 *  （机器骨架收编后的唯一一份；经 PAGE_SCRIPTS 首位注入交接）。 */
export function sessionRef(sessionId) {
  return `${SITE_ID}:${sessionId}`;
}

/** 拆会话引用：本站的引用 → 会话 id；不是本站的 → undefined。 */
export function parseSessionRef(ref) {
  const prefix = `${SITE_ID}:`;
  const s = String(ref ?? '');
  return s.startsWith(prefix) ? s.slice(prefix.length) : undefined;
}
