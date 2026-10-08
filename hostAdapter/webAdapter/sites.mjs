/**
 * sites.mjs — 站点包注册表：本适配器认得的官网都在这挂号。
 *
 * 接新官网 = 新建 sites/<域名>/ 站点包（照 sites/chat.deepseek.com/SITE.md 的契约）+
 * 在这里 import 一行——信使、席位账、面板、操作台零改动。
 * 本文件是机器与站点包之间唯一的接缝：机器层不许直接 import 具体站点包
 * （tests/site-boundary.test.mjs 锁边界）。
 */

import * as deepseek from './sites/chat.deepseek.com/site.mjs';
import * as chatglm from './sites/chatglm.cn/site.mjs';
import * as doubao from './sites/www.doubao.com/site.mjs';
import * as kimi from './sites/www.kimi.com/site.mjs';
import * as chatgpt from './sites/chatgpt.com/site.mjs';
import * as aistudio from './sites/aistudio.google.com/site.mjs';
import * as grok from './sites/grok.com/site.mjs';
import * as qianwen from './sites/www.qianwen.com/site.mjs';

/** 登记册（顺序即匹配优先级）。 */
export const SITES = [deepseek, chatglm, doubao, kimi, chatgpt, aistudio, grok, qianwen];

/** 按 URL 找站点包并解出会话 id。都不认得 = null。
 *  两道门：先认门牌（SITE_FENCE_RE——这串 URL 是谁家的地盘），再抽会话 id。
 *  只看 id 正则会串门：grok 与 chatgpt 的会话页同为 /c/<UUID>，注册表里
 *  chatgpt 排在前面，grok 的页面就被派成 chatgpt 包（2026-10-01 实案：grok
 *  标签页跑着 cgpt 座席、job 选角账记错站点）——正则不认门牌，门牌才认。 */
export function matchSite(url) {
  const u = String(url ?? '');
  for (const site of SITES) {
    if (!site.SITE_FENCE_RE.test(u)) continue;
    const m = site.SESSION_PATH_RE.exec(u);
    if (m) return { site, sessionId: m[1] };
  }
  return null;
}

/** URL 是否属于任一登记站点（侧栏围栏用）。 */
export function inAnySite(url) {
  return SITES.some(s => s.SITE_FENCE_RE.test(String(url ?? '')));
}

/** 按站点名取站点包；没挂号 = undefined。 */
export function siteById(id) {
  return SITES.find(s => s.SITE_ID === id);
}

// ── 会话引用（自带来源的会话 id）──────────────────────────────────────
// 形态归各站点包所有：sessionRef/parseSessionRef 是站点包契约件（content.js
// 经典脚本内嵌同形镜像）——本文件只代派，不持有任何一家的拼拆规则。
// 引用整串当会话 id 在全链流转（席位账、hub cast 账、驿站日志、面板/操作台），
// 不改任何账本结构，来源就写在 id 自己脸上。拆不开的（旧账裸 id）走兼容读
// （见 seats 账的 bySessionLoose），不迁移账。

/** 拼会话引用（扩展从 URL 立席位的唯一出口用）：形态归站点包，这里代派。 */
export function sessionRef(site, sessionId) {
  return site.sessionRef(sessionId);
}

/** 拆会话引用：逐站请本包解析器认领（谁家的引用谁家拆）；
 *  没人认领（旧账裸 id / 未挂号站点）= undefined。 */
export function parseSessionRef(ref) {
  for (const site of SITES) {
    const sessionId = site.parseSessionRef(ref);
    if (sessionId) return { site, sessionId };
  }
  return undefined;
}
