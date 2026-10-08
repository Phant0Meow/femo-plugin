/**
 * site.mjs — 这家网站的「户口本」：机器可读的网站事实唯一清单。
 *
 * 本文件夹（sites/chat.deepseek.com/）= 这家官网的全部知识。想接别家的官网？
 * 整个文件夹换掉就行：外面的机器（本地服务、运行时、扩展信使、面板）不许
 * 出现这家网站的任何事实——网址、会话 id 形态、网页元件名、接口路径、流格式
 * 一概不住文件夹外（tests/site-boundary.test.mjs 机械锁死）。
 *
 * 本文件收的是「机器要用的」网站事实；「页面怎么操作」的本事在 content.js
 * （会话页代理）与 inject.js（网络闸）里，也住本文件夹。给人读的网站事实
 * 全谱（id 格式、流格式两代、改版取证法）见同目录 SITE.md。
 *
 * 同源纪律：manifest.json 是静态 JSON 进不了 ESM，它的 matches /
 * host_permissions 两键是本清单的**登记镜像**——改站两处同改（边界测试
 * 只放行 manifest 这两键出现网址）。
 */

/** 站点名（=文件夹名；sites.mjs 注册表与 seats 物理账用它当站点标识）。 */
export const SITE_ID = 'chat.deepseek.com';

/** 站点首页（开页 URL 由 sessionUrl() 拼，别手拼）。 */
export const SITE_URL = 'https://chat.deepseek.com';

/** 扩展登记与标签页查询用的通配（manifest matches / tabs.query 同词）。 */
export const SITE_MATCH = 'https://chat.deepseek.com/*';

/** 本包自己的页面脚本（补注入用；manifest content_scripts js 的登记镜像）。
 *  悬浮球不在此列——那是机器的公共 UI：在役站点都亮，由 background 按
 *  PROBE_MODE 统一附加，不归任何一家的包。 */
export const PAGE_SCRIPTS = ['extension/seat-agent-core.js', 'sites/chat.deepseek.com/content.js'];

/** 取证模式：false = 座席在役（立席位、派任务、亮悬浮球）。 */
export const PROBE_MODE = false;

/** 侧栏站点围栏正则：只在这个站的标签页可开侧栏。 */
export const SITE_FENCE_RE = /^https:\/\/chat\.deepseek\.com\//;

/** 会话 URL 形态 /a/chat/s/<id>；从路径里抓会话 id。id=字母数字连字符、8 位起
 *  （真页面是 uuid；8 位下限是放宽，兼容短 id 的历史页面）。content.js 是经典
 *  脚本进不了 ESM，里面这份正则是本条的**镜像**——改站两处同改。 */
export const SESSION_PATH_RE = /\/a\/chat\/s\/([A-Za-z0-9-]{8,})/;

/** 会话 id 本体校验（服务端发来的 open-tab 帧防注入）。 */
export const SESSION_ID_RE = /^[A-Za-z0-9-]{8,}$/;

/** 会话 id → 会话页 URL（后台静默开页用）。 */
export function sessionUrl(sessionId) {
  return `${SITE_URL}/a/chat/s/${sessionId}`;
}

// ── 会话引用与会话名（站点私有的「名字」层）──────────────────────────
/** 会话引用：`<本站域名>:<会话id>`——形态契约本包所有（整串当 sid 全链流转：
 *  席位账、hub cast 账、面板/操作台）。content.js 是经典脚本进不了 ESM，
 *  内嵌同形镜像，改形态两处同改。 */
export function sessionRef(sessionId) {
  return `${SITE_ID}:${sessionId}`;
}

/** 拆会话引用：本站的引用 → 会话 id；不是本站的 → undefined。 */
export function parseSessionRef(ref) {
  const prefix = `${SITE_ID}:`;
  const s = String(ref ?? '');
  return s.startsWith(prefix) ? s.slice(prefix.length) : undefined;
}

/** 对话补全接口路径（网络闸只拦它；fetch 闸与 XHR 闸同词）。 */
export const COMPLETION_PATH = '/api/v0/chat/completion';

/** 自家接口探针宽匹配（取证用：页面真在调哪些接口）。 */
export const API_PROBE = '/api/';

/** 站点显示名（文案/报错里指代这家网站用）。 */
export const SITE_LABEL = 'DeepSeek';
