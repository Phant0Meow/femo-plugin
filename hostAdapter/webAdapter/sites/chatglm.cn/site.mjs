/**
 * site.mjs — 这家网站的「户口本」：机器可读的网站事实唯一清单。
 *
 * 本文件夹（sites/chatglm.cn/）= 智谱清言官网的知识包。站点包契约见同目录 SITE.md；
 * 多站点登记见适配器根 sites.mjs。2026-09-27 转正：会话页真形、补全接口、
 * 流格式与结束信号全部真页实证（两轮探针取证），座席在役（PROBE_MODE=false）。
 */

/** 站点名（=文件夹名）。 */
export const SITE_ID = 'chatglm.cn';

/** 站点首页。chatglm.com 不通（2026-09-27 探测），正门是 .cn。 */
export const SITE_URL = 'https://chatglm.cn';

/** 扩展登记与标签页查询用的通配。 */
export const SITE_MATCH = 'https://chatglm.cn/*';

/** 本包自己的页面脚本（补注入用）。取证阶段=探针一对；转正后换正式代理。 */
export const PAGE_SCRIPTS = ['extension/seat-agent-core.js', 'sites/chatglm.cn/content.js', 'sites/chatglm.cn/inject.js'];

/** 取证模式：false = 座席在役（立席位、派任务、亮悬浮球）。2026-09-27 转正
 *  （流格式与结束信号已实证；发送姿势待第一次真派工定型，失败大声报错）。 */
export const PROBE_MODE = false;

/** 侧栏站点围栏正则。 */
export const SITE_FENCE_RE = /^https:\/\/chatglm\.cn\//;

/** 会话 URL 形态（真页实证 2026-09-27：/main/alltoolsdetail?lang=zh&cid=<id>，
 *  发首条消息后 cid 才出现）。会话 id = 24 位小写十六进制（Mongo ObjectId 形），
 *  领域词 conversation_id（recent_list 接口同词互证）。 */
export const SESSION_PATH_RE = /\/main\/(?:alltoolsdetail|detail)\/?.*?[?&]cid=([0-9a-f]{24})/;

/** 会话 id 本体校验（open-tab 帧防注入）。 */
export const SESSION_ID_RE = /^[0-9a-f]{24}$/;

/** 会话 id → 会话页 URL（后台静默开页用）。 */
export function sessionUrl(sessionId) {
  return `${SITE_URL}/main/alltoolsdetail?cid=${sessionId}`;
}

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

/** 对话补全接口路径（真页实证 2026-09-27：发消息瞬间开火的那条）。 */
export const COMPLETION_PATH = '/chatglm/backend-api/assistant/stream';

/** 自家接口探针宽匹配。打包包取证：自家接口都住 <xxx>-api/ 命名空间
 *  （mainchat-api / backend-api / member-api / operation-api…）。 */
export const API_PROBE = '-api/';

/** 站点显示名。 */
export const SITE_LABEL = 'ChatGLM';
