/**
 * site.mjs — 这家网站的「户口本」：机器可读的网站事实唯一清单。
 *
 * 本文件夹（sites/www.doubao.com/）= 豆包官网的知识包。站点包契约见同目录 SITE.md；
 * 多站点登记见适配器根 sites.mjs。2026-09-27 转正：一轮探针取证拿回会话页
 * 真形（纯数字长 id）、补全接口（/chat/completion）、事件制流格式与输入框
 * 真身（ProseMirror），座席在役（PROBE_MODE=false）。
 */

/** 站点名（=文件夹名；正式门牌带 www——doubao.com 与 www 双双落到这里）。 */
export const SITE_ID = 'www.doubao.com';

/** 站点首页（聊天页即落地页 /chat/）。 */
export const SITE_URL = 'https://www.doubao.com';

/** 扩展登记与标签页查询用的通配。 */
export const SITE_MATCH = 'https://www.doubao.com/*';

/** 侧栏站点围栏正则。 */
export const SITE_FENCE_RE = /^https:\/\/www\.doubao\.com\//;

/** 本包自己的页面脚本（探针一对；转正后换正式代理）。 */
export const PAGE_SCRIPTS = ['extension/seat-agent-core.js', 'sites/www.doubao.com/content.js', 'sites/www.doubao.com/inject.js'];

/** 取证模式：false = 座席在役（立席位、派任务、亮悬浮球）。2026-09-27 转正
 *  （发送姿势待第一次真派工定型，失败大声报错）。 */
export const PROBE_MODE = false;

/** 会话 URL 形态（真页实证 2026-09-27：/chat/<纯数字长 id>；发首条前先短暂
 *  出现 local_ 前缀临时号——正则只认纯数字，天然避开）。 */
export const SESSION_PATH_RE = /\/chat\/([0-9]{10,})/;

/** 会话 id 本体校验（open-tab 帧防注入）。 */
export const SESSION_ID_RE = /^[0-9]{10,}$/;

/** 会话 id → 会话页 URL（后台静默开页用）。 */
export function sessionUrl(sessionId) {
  return `${SITE_URL}/chat/${sessionId}`;
}

/** 对话补全接口路径（真页实证 2026-09-27：发消息瞬间开火的那条）。 */
export const COMPLETION_PATH = '/chat/completion';

/** 自家接口探针宽匹配（打包包实证：自家接口都住 /alice/ 命名空间）。 */
export const API_PROBE = '/alice/';

/** 站点显示名。 */
export const SITE_LABEL = '豆包';

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
