/**
 * site-boundary.test.mjs — 站点包边界守卫。
 *
 * 裁决：每家官网的全部知识（网址、会话 id 形态、网页元件名、接口路径）只住
 * 自己的站点包（sites/chat.deepseek.com/、sites/chatglm.cn/…）——「想接别家官网=加文件夹
 * 换事实，外面的机器零改动」靠这条边界成立。本测试机械锁死：
 *   ① 机器层（extension/·server/·console/·native/·shared/）不许出现任何登记
 *      站点的事实字样；指向站点包本体的相对路径（import / 注入文件路径 /
 *      文档指路）不算事实，放行。
 *   ② manifest.json 是各站点包 site.mjs 的登记镜像（静态 JSON 进不了 ESM）：
 *      站点名只许出现在 host_permissions / content_scripts[].matches /
 *      content_scripts[].js（指向站点包文件的路径）与说明文字（description、
 *      $comment）里。
 *   ③ sites.mjs 注册表可用：每家站点包都交齐契约件（SITE_ID/网址/围栏/会话
 *      正则/开页拼装），取证中的包只查「证件齐」，不把推测当事实考。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ADAPTER_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE_DIRS = ['chat.deepseek.com', 'chatglm.cn', 'www.doubao.com', 'www.kimi.com', 'chatgpt.com', 'aistudio.google.com', 'grok.com', 'www.qianwen.com'];

/** 各登记站点的事实特征字样：带协议头的网址（机器层谁都不许出现）。 */
const SITE_FACT_PATTERNS = [
  /https:\/\/chat\.deepseek\.com/,
  /https:\/\/chatglm\.cn/,
  /https:\/\/www\.doubao\.com/,
  /https:\/\/www\.kimi\.com/,
  /https:\/\/chatgpt\.com/,
  /https:\/\/aistudio\.google\.com/,
  /https:\/\/grok\.com/,
  /https:\/\/www\.qianwen\.com/,
  /\/a\/chat\/s\//,
  /#chat-input/,
  /\.ds-markdown/,
  /\.ds-typing/,
  /\/api\/v0\//,
  /\/backend-api\//,
  /\/rest\/app-chat\//,
  /\/api\/v2\/chat/,
  /\/api\/v1\/session\//,
  /alkalimakersuite/,
];

/** 递归收目录下的源码文件。 */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(mjs|js|html)$/.test(name)) out.push(p);
  }
  return out;
}

test('机器层不出现任何登记站点的事实（站点包外零知识）', () => {
  for (const dir of ['extension', 'server', 'console', 'native', 'shared']) {
    for (const file of walk(join(ADAPTER_ROOT, dir))) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of SITE_FACT_PATTERNS) {
        if (pattern.test(text)) {
          throw new Error(`网站事实外泄：${file} 命中 ${pattern}——网站知识只许住各站点包（${SITE_DIRS.join(' / ')}）`);
        }
      }
    }
  }
});

test('manifest.json 里站点名只许住在登记键与说明文字里', () => {
  const manifest = JSON.parse(readFileSync(join(ADAPTER_ROOT, 'manifest.json'), 'utf8'));
  const siteNames = SITE_DIRS;
  const offenders = [];
  const walkJson = (node, path) => {
    if (typeof node === 'string') {
      if (siteNames.some(n => node.includes(n))) offenders.push(path);
      return;
    }
    if (Array.isArray(node)) { node.forEach((x, i) => walkJson(x, `${path}[${i}]`)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walkJson(v, path ? `${path}.${k}` : k);
    }
  };
  walkJson(manifest, '');
  // 登记镜像只许 matches/host_permissions；content_scripts[].js 是指向站点包文件
  // 的路径（同 background 的 import，属「引用站点包」而非网站事实）；
  // description 与 $comment 是给人看的说明文字，非功能键——均放行。
  const allowed = p => p === 'host_permissions' || p.startsWith('host_permissions[')
    || /^content_scripts\[\d+\]\.matches/.test(p)
    || /^content_scripts\[\d+\]\.js/.test(p)
    || p === 'description' || p === '$comment';
  const bad = offenders.filter(p => !allowed(p));
  assert.deepEqual(bad, [], `manifest.json 里这些键不该出现站点名（功能键只许 matches/host_permissions，js 路径与说明文字放行）：${bad.join(', ')}`);
});

test('sites.mjs 注册表：每家站点包证件齐全', async () => {
  const { SITES } = await import(pathToFileURL(join(ADAPTER_ROOT, 'sites.mjs')).href);
  assert.ok(Array.isArray(SITES) && SITES.length >= 8, '注册表至少挂了 deepseek/chatglm/doubao/kimi/chatgpt/aistudio/grok/qianwen 八家');
  const ids = new Set();
  for (const site of SITES) {
    for (const key of ['SITE_ID', 'SITE_URL', 'SITE_MATCH', 'PAGE_SCRIPTS', 'PROBE_MODE', 'SITE_FENCE_RE', 'SESSION_PATH_RE', 'SESSION_ID_RE', 'sessionUrl', 'sessionRef', 'parseSessionRef', 'SITE_LABEL']) {
      assert.ok(site[key] !== undefined && site[key] !== null, `${site.SITE_ID ?? '?'} 缺契约件 ${key}`);
    }
    assert.ok(!ids.has(site.SITE_ID), `站点名重复：${site.SITE_ID}`);
    ids.add(site.SITE_ID);
    assert.ok(site.SITE_FENCE_RE.test(site.SITE_URL + '/'), `${site.SITE_ID} 围栏应放过自家首页`);
    assert.ok(Array.isArray(site.PAGE_SCRIPTS), `${site.SITE_ID} PAGE_SCRIPTS 应为数组`);
    for (const f of site.PAGE_SCRIPTS) {
      assert.ok(existsSync(join(ADAPTER_ROOT, f)), `${site.SITE_ID} PAGE_SCRIPTS 指到的文件不存在：${f}`);
    }
    assert.equal(typeof site.PROBE_MODE, 'boolean', `${site.SITE_ID} 应显式声明 PROBE_MODE（取证与否是载重状态）`);
  }
});

test('会话引用归站点包私有：谁家的引用谁家拼拆，注册表只代派', async () => {
  const { SITES, sessionRef, parseSessionRef } = await import(pathToFileURL(join(ADAPTER_ROOT, 'sites.mjs')).href);
  const ds = SITES.find(s => s.SITE_ID === 'chat.deepseek.com');
  const cg = SITES.find(s => s.SITE_ID === 'chatglm.cn');
  const ref = ds.sessionRef('abc-123');
  assert.equal(ref, 'chat.deepseek.com:abc-123', 'deepseek 引用形态=<域名>:<id>');
  assert.equal(ds.parseSessionRef(ref), 'abc-123', '本站的引用本站拆得开');
  assert.equal(cg.parseSessionRef(ref), undefined, '别家的引用不该认领');
  assert.equal(cg.parseSessionRef(cg.sessionRef('6ab80912aa2cdafd0758bb0d')), '6ab80912aa2cdafd0758bb0d');
  // 注册表代派：拼用站点包的，拆逐站认领。
  assert.equal(sessionRef(ds, 'abc-123'), ref);
  assert.deepEqual(parseSessionRef(ref), { site: ds, sessionId: 'abc-123' });
  assert.equal(parseSessionRef('裸id旧账'), undefined, '裸 id 没人认领');
});

test('deepseek 站点包：会话 id 抓取与开页 URL 拼装（已取证，可实考）', async () => {
  const { SITES } = await import(pathToFileURL(join(ADAPTER_ROOT, 'sites.mjs')).href);
  const site = SITES.find(s => s.SITE_ID === 'chat.deepseek.com');
  const url = 'https://chat.deepseek.com/a/chat/s/abc12345-6789-4def-a012-3456789abcde';
  const m = site.SESSION_PATH_RE.exec(new URL(url).pathname);
  assert.ok(m, '会话 URL 应命中会话 id 正则');
  assert.equal(m[1], 'abc12345-6789-4def-a012-3456789abcde');
  assert.ok(site.SESSION_ID_RE.test(m[1]), '抓出的 id 应通过本体校验');
  assert.equal(site.sessionUrl(m[1]), url, 'sessionUrl 应能拼回原会话页地址');
});

test('matchSite 认门牌再抽 id：同形会话页不串门（2026-10-01 实案回归锁）', async () => {
  const { SITES, matchSite } = await import(pathToFileURL(join(ADAPTER_ROOT, 'sites.mjs')).href);
  // grok 与 chatgpt 会话页同为 /c/<UUID>——注册表里 chatgpt 排前面，
  // 只按 id 正则匹配会把 grok 的页面派成 chatgpt 包（job 2657 实录）。
  const uuid = '6abb5ee6-99c8-83ea-a108-9566eb1e62fc';
  const grok = matchSite(`https://grok.com/c/${uuid}`);
  assert.ok(grok, 'grok 会话页应命中');
  assert.equal(grok.site.SITE_ID, 'grok.com', 'grok 页面必须派给 grok 包——门牌先于正则');
  const cgpt = matchSite(`https://chatgpt.com/c/${uuid}`);
  assert.ok(cgpt && cgpt.site.SITE_ID === 'chatgpt.com');
  // 逐家抽验：每家门牌内的同形地址都该回到自家（其余六家门牌互不相交，
  // 一家越界即全体错派）。
  for (const site of SITES) {
    const hit = matchSite(site.SITE_URL + '/');
    assert.equal(hit, null, `${site.SITE_ID} 首页无会话 id，不应立席`);
  }
  assert.equal(matchSite('https://evil.example.com/c/' + uuid), null, '未挂号站点不认领');
});
