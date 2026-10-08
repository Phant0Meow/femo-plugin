/**
 * background.js — service worker：扩展与本地服务之间的信使。
 *
 * 下行：对本地服务 /extension/poll 做长轮询（MV3 的 SW 里没有 EventSource，
 * fetch 长轮询最皮实），帧 type=deliver 转给对应标签页的 content script。
 * 上行：content 的状态/回复报告 POST /extension/report；标签页清单变化
 * POST /extension/register。侧栏面板的读写也全部经这里代理。
 *
 * SW 会被浏览器休眠：唤醒时顶层代码重跑，轮询循环自愈（connId 存在
 * chrome.storage.session，一次生成终身使用）；alarms 每分钟敲一扇门。
 *
 * 本文件是「信使」，不含任何网站事实：网址、会话 id 正则、开页 URL 全部来自
 * 站点包注册表 sites.mjs（接新官网=加一个站点包文件夹+注册表一行，本文件零改动；
 * SW 是 module，吃 ESM import）。
 */

import { SITES, matchSite, inAnySite, siteById, sessionRef, parseSessionRef } from '../sites.mjs';

// 缺省端口三处互指（service.mjs FEMO_WEB_PORT 缺省 / web-launcher 探活）：
// 扩展与 launcher 都在服务起来之前跑、读不到 env——物理边界，只能注释同改。
const DEFAULT_SERVER = 'http://127.0.0.1:8796';
const REGISTER_INTERVAL_MS = 10_000;
const POLL_ERROR_BACKOFF_MS = 3_000;
const PING_TIMEOUT_MS = 3_000;   // 页面探活超时：超时=不应答（见 pingTab）
const PING_RETRY_DELAY_MS = 600; // 首拍不应答后的重试间隔：一轮失败先重试再判死
const RECHECK_DELAY_MS = 3_000;  // 补注入后的快速复查间隔：不等 10s 周期

let serverUrl = DEFAULT_SERVER;
let connId = '';
let registering = false;

async function loadConfig() {
  const got = await chrome.storage.local.get(['serverUrl']);
  serverUrl = String(got.serverUrl || DEFAULT_SERVER).replace(/\/+$/, '');
  const sess = await chrome.storage.session.get(['connId']);
  connId = sess.connId || '';
  if (!connId) {
    connId = `ext-${crypto.randomUUID().slice(0, 8)}`;
    await chrome.storage.session.set({ connId });
  }
}
loadConfig();

// ── 上行小件 ──────────────────────────────────────────────────────────
async function post(path, body, timeoutMs = 10_000) {
  const res = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res.json();
}

/** 扩展端日志上行：全部汇进本地服务的 service.log，排障不用开 F12。
 *  服务不通时静默（本来就只是日志，别为日志报错刷屏）。 */
function extLog(line) {
  post('/extension/report', { type: 'log', tag: 'bg', line }).catch(() => {});
}

/** 最近选中的站点会话标签页 id（活动会话判定用，见 web-get-state）。 */
let lastActiveTabId = null;
/** 给失效/未注入的标签页整页 reload。**只许人工重连（web-reconnect）用**：
 *  2026-10-02 用户拍板「reload 名单 = mailbox 在飞收件人」——注册巡检的探活
 *  名单是「所有标签页」（含在跑剧本外的角色），在这里 reload 等于全场轮流枪毙
 *  休眠页（实测：剧本外的千问/AIStudio 页每 20 秒被 reload 一次）。休眠页的
 *  救治在派工侧：轮到它发言时 resolveSeat 进唤醒闸 reload 叫醒，孤儿代理一并
 *  清掉；巡检只如实记账「在场但不在线」。 */
const lastReinjectAt = new Map();
/** 已设过「不可自动丢弃」的标签页（保活 B 案，2026-10-02 用户拍板）：席位页
 *  关掉 autoDiscardable，内存节省器/睡眠机制就永不丢这页——顺次模型下页面
 *  活着=零 reload、零风控暴露。每页只设一次（幂等但没必要 10 秒一发）；设
 *  失败（页正关闭等）出账，下轮注册再试。 */
const autoDiscardSet = new Set();
function reinjectTab(tabId, site, force = false) {
  if (!(site.PAGE_SCRIPTS ?? []).length) return false;
  const last = lastReinjectAt.get(tabId) ?? 0;
  if (!force && Date.now() - last < 20_000) return false;
  lastReinjectAt.set(tabId, Date.now());
  chrome.tabs.reload(tabId).catch(e => extLog(`reinject reload failed tab ${tabId}: ${e}`));
  return true;
}
// ── 标签页清单 → 注册 ─────────────────────────────────────────────────
/** 页面探活单拍（web-ping + 超时）。超时必须留着：Chrome 内存节省器会把太久
 *  没激活的后台标签页冻结，对冻结页 sendMessage 消息排队、promise 既不
 *  resolve 也不 reject——没有超时，探活永久挂起（「显示在线却 30s 无回执」
 *  的根因；与 pong 提到 try 外那坑同病第二面）。race 输家的 rejection 由
 *  自己的 catch 消化，不挂 unhandled 噪音。 */
function pingTabOnce(tabId, timeoutMs = PING_TIMEOUT_MS) {
  const pong = chrome.tabs.sendMessage(tabId, { type: 'web-ping' });
  pong.catch(() => { /* 失败分支 probeTab 已按不应答处理 */ });
  return Promise.race([
    pong,
    new Promise(resolve => setTimeout(() => resolve(undefined), timeoutMs)),
  ]);
}

/** 页面探活（首拍不应答先重试一次再判死）。一次不应答多半是瞬时抖动——页面
 *  主线程忙、刚被解冻、消息通道换手，都有几秒不应期；一轮失败就钉死会把
 *  用户眼前开着的「当前」页也标成离线（服务日志实测：席位 2↔3 席反复横跳）。
 *  两拍都不应答才交 reinject/离线裁决。 */
async function pingTab(tabId) {
  const first = await pingTabOnce(tabId);
  if (first?.type === 'web-pong') return first;
  await new Promise(r => setTimeout(r, PING_RETRY_DELAY_MS));
  return pingTabOnce(tabId);
}

async function collectTabs(forceReinject = false) {
  const tabs = await chrome.tabs.query({ url: SITES.map(s => s.SITE_MATCH) });
  let reloaded = 0;
  // 并行探活：正常页 ping 毫秒级无感；异常页（冻结/失效）不必串行排队拖住
  // 整轮注册（单页最坏两拍 ~7s，四页串行就是半分钟）。
  const probed = await Promise.all(tabs.map(async t => {
    const hit = matchSite(t.url ?? '');
    if (!hit) return null; // 裸首页（会话未生成）不立席位
    // sessionId 用会话引用（`<域名>:<id>`，见 sites.mjs）——跨站唯一、自带来源。
    // 冻结页也认得出：引用从 URL 解析，不依赖页内应答（2026-10-01 按需唤醒的地基）。
    const ref = sessionRef(hit.site, hit.sessionId);
    if (!autoDiscardSet.has(t.id)) {
      autoDiscardSet.add(t.id);
      chrome.tabs.update(t.id, { autoDiscardable: false }).catch(() => autoDiscardSet.delete(t.id));
    }
    let pong;
    try { pong = await pingTab(t.id); } catch { /* content script 没注入/已失效（扩展重载后旧页全失效） */ }
    if (pong?.type !== 'web-pong') {
      // 不应答=探活够不着（页被浏览器冻结/脚本失效/孤儿代理）：照常登记在场
      // （online:false）——派工与点名只认「在场」，轮到它发言时请台 reload 唤醒。
      // 但绝不能标在线：收不了下发的席位标在线，帧派进去就是静默丢（实测坑——
      // 「已发送但页面没动静」的根因）。
      // **巡检绝不 reload**（2026-10-02 用户拍板）：这里的名单是「所有标签页」，
      // 不是「mailbox 收件人」——在跑剧本外的休眠页也在这份名单里，reload
      // 一律不许发生；只有人工重连（侧栏圆点，force）才当场补一枪抢救。
      if (forceReinject && reinjectTab(t.id, hit.site, true)) {
        reloaded += 1;
        extLog(`reinject: tab ${t.id}（${hit.sessionId.slice(0, 8)}… @${hit.site.SITE_ID}）人工重连未应答探活，已 reload 抢救`);
      }
      return { tabId: t.id, sessionId: ref, site: hit.site.SITE_ID, title: String(t.title ?? ''), busy: false, online: false };
    }
    // 名字已经过站点包解析（空=真无名），不许拿浏览器缓存的原始标题顶回去；
    // pong 带页面实时标题——t.title 是缓存，会话改名后慢半拍（实测坑）。
    return { tabId: t.id, sessionId: ref, site: hit.site.SITE_ID, title: String(pong.title ?? ''), busy: Boolean(pong.busy), online: true };
  }));
  // 人工重连 reload 过的页要等脚本立起来才应答：3 秒后快速复查一轮（不带
  // force，纯记账），别让救活的页再挂 10 秒离线（registering 旗天然防与周期
  // 注册叠跑）。周期巡检（不带 force）零 reload，永远不会走到这。
  if (reloaded > 0) setTimeout(register, RECHECK_DELAY_MS);
  return probed.filter(Boolean);
}

async function register(forceReinject = false) {
  if (registering) return;
  registering = true;
  try {
    const tabs = await collectTabs(forceReinject);
    await post('/extension/register', { connId, tabs });
    chrome.action.setBadgeText({ text: tabs.length ? String(tabs.length) : '' });
    // 席位清单变化才记日志（10 秒一报会把日志刷成噪音）。在场=开着（含休眠）。
    const awake = tabs.filter(t => t.online !== false).length;
    const summary = `register: ${tabs.length} 席在场（在线 ${awake}${awake < tabs.length ? `·休眠 ${tabs.length - awake}` : ''}）[${tabs.map(t => t.sessionId.slice(0, 8)).join(',')}]`;
    if (summary !== lastRegisterSummary) {
      lastRegisterSummary = summary;
      extLog(summary);
    }
  } catch (e) {
    extLog(`register 失败：${e}（服务没起？）`);
  } finally { registering = false; }
}
let lastRegisterSummary = '';

// ── 下行长轮询 ────────────────────────────────────────────────────────
async function pollLoop() {
  let errCount = 0;
  for (;;) {
    try {
      const res = await fetch(`${serverUrl}/extension/poll?conn=${encodeURIComponent(connId)}&timeout=25000`, {
        signal: AbortSignal.timeout(35_000),
      });
      const data = await res.json();
      if (errCount > 0) { extLog(`poll 恢复（此前失败 ${errCount} 次）`); errCount = 0; }
      for (const frame of data?.frames ?? []) handleFrame(frame);
    } catch (e) {
      errCount += 1;
      // 失败限流：第 1 次和之后每 20 次记一笔，服务没起时不刷屏。
      if (errCount === 1 || errCount % 20 === 0) extLog(`poll 失败 x${errCount}：${e}`);
      await new Promise(r => setTimeout(r, POLL_ERROR_BACKOFF_MS));
    }
  }
}

function handleFrame(frame) {
  if (frame?.type === 'attendance') {
    // 服务端点名（运行前 /seats/attendance 发的）：立即跑一轮注册——10 秒周期
    // 等不起，运行按钮正等着拿新鲜席位账。不 await：register 自带防重入，
    // 服务端按 lastRegisterAt 推进判「已答」。
    register();
    return;
  }
  if (frame?.type === 'open-tab') {
    // 服务端请台：该会话的标签页没开，后台静默开一个（不抢焦点）；
    // 页面加载完 content script 注册后，pending 队列自然补发。
    // sessionId 是会话引用（`<域名>:<id>`）——拆开拿站点包与真 id（引用的
    // 拼拆是站点私有层，注册表只代派）；旧账裸 id（无前缀）靠帧上的 site
    // 格（席位物理账）认站；两样都没有 = 大声跳过，不默认任何一家。
    const sid = String(frame.sessionId ?? '');
    const parsed = parseSessionRef(sid);
    const site = parsed?.site ?? siteById(String(frame.site ?? ''));
    const realId = parsed?.sessionId ?? sid;
    if (!site || !site.SESSION_ID_RE.test(realId)) {
      extLog(`open-tab skipped: 站点不明或 id 不合法（ref=${sid.slice(0, 24)} site=${String(frame.site ?? '?')}）——旧裸 id 绑定重新绑定一次即升级为引用形态`);
      return;
    }
    chrome.tabs.query({ url: site.SITE_MATCH }).then(tabs => {
      const hit = tabs.find(t => (t.url ?? ``).includes(realId));
      if (hit) {
        // 已有标签页：服务端只在席位离线时才发 open-tab——这页多半是被浏览器
        // 冻结的后台页。reload 唤醒（不抢焦点；页面聊天记录在服务端，重载无
        // 损），加载完 content script 重新注册即上线。旧法「跳过」让冻结页
        // 永远醒不来（实案：六席点名只开出一页，其余五页休眠空转）。
        extLog(`open-tab: 已有标签页但离线，reload 唤醒 ${realId.slice(0, 8)}（tab ${hit.id}）`);
        chrome.tabs.reload(hit.id).catch(e2 => extLog(`open-tab reload failed: ${e2}`));
        return;
      }
      chrome.tabs.create({ url: site.sessionUrl(realId), active: false }, tab => extLog(`open-tab: 已后台打开 ${site.SITE_ID}/${realId.slice(0, 8)}（tab ${tab?.id}）`));
    }).catch(e => extLog(`open-tab failed: ${e}`));
    return;
  }
  if (frame?.type === 'reload-tab') {
    // 静默看护的 reload 拍（runtime 静默阶梯①，2026-10-02 用户定案「收不到
    // 内容 30 秒自动 reload」）：在飞回合 30s 无任何内容（已发送/流式 delta 都
    // 算内容）——**不探活直接 reload**。判据是「收不到内容」不是「ping 不通」：
    // 能静默 30s 还应答得了探活的页恰是假活（网络闸死/收话判定卡死），reload
    // 正是救法；正常生成中 delta 400ms 一拍绝不会触发。对话记录在网站服务端，
    // reload 无损；reload 后回合领养（hello）接回收话。一回合恰一次（runtime
    // 记账），不探活也免了「页面主线程忙 1.5s 应不上被误判」的误伤面。
    const tabId = Number(frame.tabId ?? 0);
    if (!tabId) { extLog(`reload-tab skipped: 帧没带有效 tabId（${frame.deliveryId ?? '?'}）`); return; }
    extLog(`reload-tab: tab ${tabId} 静默无内容——自动 reload 唤醒（回合领养会接回收话）`);
    chrome.tabs.reload(tabId).catch(e => extLog(`reload-tab failed: ${e}`));
    return;
  }
  if (frame?.type === 'turn-closed') {
    // 服务端关单广播（回合终局：交卷/保险丝跳过/停演/失败）：转发给所有登记
    // 站点页，各页自己核对 deliveryId 放手——页面侧回合账不许自设超时，节点
    // 什么时候结束只有服务端知道（2026-10-02 用户定案）。
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: SITES.map(s => s.SITE_MATCH) });
        for (const t of tabs) {
          chrome.tabs.sendMessage(t.id, { type: 'femo-turn-closed', deliveryId: frame.deliveryId }).catch(() => {});
        }
      } catch (e) { extLog(`turn-closed broadcast failed: ${e}`); }
    })();
    return;
  }
  if (frame?.type === 'remind') {
    // 提醒喊人（不掐戏不抢焦点）：横条群发**所有登记站点页**——用户看哪个页都
    // 能看见（2026-10-02 用户拍板：弹在所有页面、贴顶横条）。一个都没弹出来
    // （用户停在站外）才回落系统通知（点通知直达那个标签页，人工切=自愿）。
    // 落点=tabId 缓存 + 会话引用（引用是正身），账住 storage.session——旧内存
    // 单槽随 SW 休眠清零，用户隔一阵点「切过去」时账已空=按钮没反应（实案根因）。
    const target = { tabId: Number(frame.tabId ?? 0), sessionId: String(frame.sessionId ?? ''), deliveryId: String(frame.deliveryId ?? '') };
    if (!target.sessionId) extLog(`remind 帧没带会话引用（${target.deliveryId}）——「切过去」按钮将无寻址可认`);
    setRemindTarget(target);
    // 到货即查：目标页此刻就是激活页（提醒飞行路上用户已点开）——不弹、撤旧提。
    // handleFrame 是同步函数，await 检查包进异步拍，不阻塞帧循环。
    (async () => {
      let activeTabId = 0;
      try {
        const [at] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        activeTabId = at?.id ?? 0;
      } catch { /* 查不到就照常弹 */ }
      if (activeTabId && target.tabId && activeTabId === target.tabId) {
        extLog(`remind ${target.deliveryId} 到货时目标页已是激活页——提醒过期，不弹`);
        await dismissExpiredRemind();
        return;
      }
      showFreezeOverlayOnAllPages(frame);
    })();
    return;
  }
  if (frame?.type === 'remind-cancel') {
    // 服务端撤回（页面自己醒了/回合已终局）：收掉所有页上的横条
    setRemindTarget(null);
    hideFreezeOverlayOnAllPages();
    return;
  }
  if (frame?.type === 'deliver') {
    extLog(`帧下发 → tab ${frame.tabId}（${frame.deliveryId}）`);
    chrome.tabs.sendMessage(frame.tabId, {
      type: 'web-deliver',
      deliveryId: frame.deliveryId,
      text: frame.text,
      meta: frame.meta ?? {},
    }).then(() => extLog(`帧已被 tab ${frame.tabId} 收下（${frame.deliveryId}）`)).catch(e => {
      // 标签页收不了（关了/刷新中/没注入）：只大声留痕，不上报 error（2026-10-02
      // 用户拍板：「页面暂时够不着」切个页/reload 就能救活，不是执行体失败——
      // 这里报 error 会被运行时按契约判死、整场戏挂起（tab unreachable 秒挂起
      // 实案）。extLog 本身就进服务端日志，可观测性不丢；恢复交给静默看护的
      // reload + hello 领养重发，60s 提醒喊人，3000s 执行保险丝跳过节点。
      extLog(`帧投递失败 tab ${frame.tabId}（${frame.deliveryId}）：${e}——不报 error，静默看护接管恢复`);
    });
  }
}

// ── 提醒喊人机构（remind 帧；到点自动切已退役，2026-10-02）─────────────
// 恢复靠人工点开标签页（点开即醒，回合领养把收话接回来），零抢焦点；remind
// 只负责「喊人」：浮层投给用户当前活跃页（content script 渲染）；当前页不在
// 登记站点时回落系统通知。「现在就切」按钮=人工切（自愿抢焦点），切完提醒作废。
// （自动恢复另有静默看护的 reload-tab 帧：在飞回合 30s 无内容 reload 恰一次
//   ——原 check-tab 周期查岗与 patrolTab 早已退役，现在唯一剩下的自动 reload
//   就是这一发，用户的四级阶梯：保活→30s reload→reload 无效提醒→死等保险丝。）
// 提醒落点账（remindTarget）住 chrome.storage.session 不住 SW 内存（2026-10-02
// 「切过去没反应」实案根因）：SW 一休眠内存单槽清零，用户隔一阵才点按钮时账已
// 是空——按钮按下查无落点、静默没反应。session 存储跨 SW 重启存活、关浏览器即
// 清，正好是「这轮戏的提醒落点」该有的寿命。落点除 tabId 缓存外必带会话引用
// （引用是正身：页可能被关掉重开、tabId 已换，点击时按引用现场重新认页）。
const REMIND_KEY = 'remindTarget';
async function setRemindTarget(target) {
  try { await chrome.storage.session.set({ [REMIND_KEY]: target }); }
  catch (e) { extLog(`remindTarget 存不进 session：${e}`); }
}

/** 提醒过期即撤（2026-10-02 用户补刀）：目标页已被激活，提醒就过期了——
 *  全局收横条 + 清落点账 + 清同单系统通知（对得上单才清，别的通知不动）。 */
async function dismissExpiredRemind() {
  const got = await chrome.storage.session.get(REMIND_KEY);
  if (got[REMIND_KEY]) await setRemindTarget(null);
  hideFreezeOverlayOnAllPages();
  try {
    const clicks = await chrome.storage.session.get(REMIND_CLICK_KEY);
    for (const [nid, hit] of Object.entries(clicks[REMIND_CLICK_KEY] ?? {})) {
      if (Number(hit?.tabId ?? 0) !== activateId) continue;
      await setRemindClick(nid, null);
      chrome.notifications.clear(nid).catch(() => {});
    }
  } catch { /* 通知账读不到就算了：横条已收，通知另有 60s 自灭兜底 */ }
}

/** tab 还在册且仍是登记站点页吗（页关了/换了地址都算不在）。 */
async function tabOnSite(tabId) {
  try { return Boolean(matchSite((await chrome.tabs.get(tabId)).url ?? '')); }
  catch { return false; }
}

/** 点「切过去」时现场认页：缓存的 tabId 还活着就直切；不行就按会话引用全窗
 *  重找（matchSite 认门牌，URL 含会话 id 即认）。认不到返回 0——响亮留痕，
 *  不静默装切成功。 */
async function resolveRemindTab(target) {
  const cachedId = Number(target?.tabId ?? 0);
  if (cachedId && await tabOnSite(cachedId)) return cachedId;
  const ref = String(target?.sessionId ?? '');
  if (!ref) return 0;
  const parsed = parseSessionRef(ref);
  if (!parsed || !parsed.sessionId) return 0;
  try {
    const tabs = await chrome.tabs.query({ url: parsed.site.SITE_MATCH });
    const hit = tabs.find(t => sessionRef(parsed.site, parsed.sessionId) === ref || String(t.url ?? '').includes(parsed.sessionId));
    return hit?.id ?? 0;
  } catch { return 0; }
}

/** 人工切（自愿抢焦点）：拉窗 + 激活页。 */
function switchToTabNow(tabId, sessionId = '') {
  (async () => {
    let id = Number(tabId ?? 0);
    if (!id || !(await tabOnSite(id))) id = await resolveRemindTab({ tabId: id, sessionId });
    if (!id) { extLog(`manual switch: 落点页已不在，按会话引用（${String(sessionId || '').slice(0, 24)}）也没找到——切不了`); return; }
    try {
      const t = await chrome.tabs.get(id);
      await chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
      await chrome.tabs.update(id, { active: true });   // 切过去即唤醒冻结页
      activateId = id;                // 激活事件的题设已亲手达成
      await dismissExpiredRemind();   // 点了「切过去」=提醒使命完成：全局撤
    } catch (e) { extLog(`manual switch failed (tab ${id} 已关？): ${e}`); }
  })();
}

async function activeTab() {
  let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tabs.length) tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

/** 带超时的页面sendMessage：冻结页的 sendMessage 不 resolve 不 reject、永久挂起
 *  （守则坑12 同款习性）——await 它会把群发循环卡死在第一个冻结页上（横条没弹、
 *  系统通知回落永远走不到，2026-10-02 实案），一切「发到页面」的动作都过这里。 */
function sendToTabWithTimeout(tabId, payload, ms = 1500) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), ms);
    chrome.tabs.sendMessage(tabId, payload)
      .then(() => { clearTimeout(timer); resolve(true); })
      .catch(() => { clearTimeout(timer); resolve(false); });
  });
}

function showFreezeOverlayOnAllPages(frame) {
  (async () => {
    const payload = {
      type: 'femo-freeze-overlay',
      actor: String(frame.actor ?? ''),
      soul: String(frame.soul ?? ''),
      message: String(frame.message ?? ''),
      seconds: Number(frame.seconds ?? 60),
      deliveryId: String(frame.deliveryId ?? ''),
      sessionId: String(frame.sessionId ?? ''),
    };
    let shown = 0;
    try {
      const tabs = await chrome.tabs.query({ url: SITES.map(s => s.SITE_MATCH) });
      // 并行发+每页 1.5s 封顶：活页秒回计入 shown；冻结页挂起只算没弹，不拖群发
      const results = await Promise.all(tabs.map(t => sendToTabWithTimeout(t.id, payload)));
      shown = results.filter(Boolean).length;
    } catch (e) { extLog(`remind broadcast failed: ${e}`); }
    if (!shown) {
      // 一张都没弹出来（全冻结/用户停在登记站点之外）：回落系统通知。点通知直达
      // =人工自愿切；落点带会话引用、账住 storage.session（旧内存账随 SW 休眠
      // 清零——「点了没反应」同根因同修，2026-10-02）。
      const nid = `remind/${frame.deliveryId ?? Date.now()}`;
      setRemindClick(nid, { tabId: Number(frame.tabId ?? 0), sessionId: String(frame.sessionId ?? '') });
      chrome.notifications.create(nid, {
        type: 'basic',
        iconUrl: 'extension/icons/icon128.png',
        title: 'FEMO：网页席位未响应',
        message: String(frame.message ?? ''),
      }).then(() => setTimeout(() => { chrome.notifications.clear(nid).catch(() => {}); setRemindClick(nid, null); }, 60_000))
        .catch(e2 => extLog(`remind notification failed: ${e2}`));
    }
  })();
}

function hideFreezeOverlayOnAllPages() {
  (async () => {
    try {
      const tabs = await chrome.tabs.query({ url: SITES.map(s => s.SITE_MATCH) });
      // 同款带超时：撤横条不许被冻结页挂死（撤不到的横条另有 60s 自灭兜底）
      await Promise.all(tabs.map(t => sendToTabWithTimeout(t.id, { type: 'femo-freeze-overlay-hide' })));
    } catch { /* 无标签页：横条随页面自灭 */ }
  })();
}

// （原 FREEZE_SWITCH_ALARM 到点自动切监听已随查岗收割模型退役，2026-10-02：
//   恢复职责归收割轮的 reload 查岗+领养重发，零抢焦点；SW 敲门监听在文件尾。）

// ── 提醒通知的点击直达（remind 帧）：点通知=人工切（自愿抢焦点）──────────
// nid→落点 账住 chrome.storage.session——旧版内存对象随 SW 休眠清零，SW 重启后
// 点通知同样没反应（与浮层「切过去」按钮同根因同修，2026-10-02）。
const REMIND_CLICK_KEY = 'remindClickMap';
async function setRemindClick(nid, hit) {
  try {
    const got = await chrome.storage.session.get(REMIND_CLICK_KEY);
    const map = got[REMIND_CLICK_KEY] ?? {};
    if (hit) map[nid] = hit; else delete map[nid];
    await chrome.storage.session.set({ [REMIND_CLICK_KEY]: map });
  } catch (e) { extLog(`remindClick 账写失败：${e}`); }
}
chrome.notifications.onClicked.addListener(nid => {
  (async () => {
    const got = await chrome.storage.session.get(REMIND_CLICK_KEY);
    const hit = (got[REMIND_CLICK_KEY] ?? {})[nid];
    if (!hit) return;
    await setRemindClick(nid, null);
    switchToTabNow(hit.tabId, hit.sessionId);
    await chrome.notifications.clear(nid).catch(() => {});
  })();
});

// 顶层自愈：SW 每次被唤醒都会重跑这里；globalThis 守卫防同生命周期内叠环。
if (!globalThis.__webPolling) {
  globalThis.__webPolling = true;
  extLog('SW 唤醒，长轮询启动');
  pollLoop();
}

// ── 一键拉起本地服务（侧栏/操作台共用，2026-09-30 抽单份）──────────────────
// 先探 /health（活着就不惊动原生宿主），没活才走 Native Messaging。宿主侧
// 幂等（已在跑直接回），这里再挡一道是为了省一次进程拉起的开销。
function launchLocalService(sendResponse) {
  (async () => {
    const probe = async () => {
      try {
        const r = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(1500) });
        return r.ok;
      } catch { return false; }
    };
    if (await probe()) { sendResponse({ ok: true, already: true, message: '本地服务已在运行' }); return; }
    const NATIVE_HOST = 'com.femo.web_launcher';
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, { cmd: 'start' }, reply => {
        const err = chrome.runtime.lastError;
        if (err) {
          // 典型形态：没登记（"未找到指定的原生消息宿主"）——把人话指引给出去。
          // 登记已自动化（2026-09-29）：本地服务首次启动时自动登记，所以指路
          // start-service.cmd 而不是旧的手工安装器。地址写仓库根锚定的全路径：
          // 扩展沙箱拿不到插件在磁盘上的位置，写死本机盘符就是假地址；锚定
          // femo-plugin 文件夹（下载/克隆仓库得到的那一层）才是对所有用户
          // 都成立的真话——盘符随各人安装位置变，从 femo-plugin 往下的每一
          // 级对谁都一样。系统限制：原生宿主登记（写注册表+host manifest）
          // 浏览器与扩展都做不到，只有本地服务自己能做——所以第一次必须由
          // 人亲手双击 start-service.cmd 把服务拉起来（顺手完成登记），此后
          // 一键启动才能靠 Native Messaging 把服务叫醒。
          sendResponse({ ok: false, error: `${err.message}（原生宿主还没登记：由于系统限制，第一次必须由人亲手双击 femo-plugin\hostAdapter\webAdapter\start-service.cmd 启动一次本地服务（顺手自动登记）；之后就可以直接一键启动了）` });
          return;
        }
        sendResponse(reply ?? { ok: false, error: '原生宿主无回帧' });
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
}

// ── content / 侧栏 的信口 ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'web-ping-echo') {
    // 页面 pong 前的运行时回声（孤儿代理自检，见 seat-agent-core web-ping）：
    // 能到这 = 桥活着；孤儿代理的 sendMessage 根本到不了这，自己就 reject 了。
    sendResponse({ ok: true });
    return;
  }
  if (msg?.type === 'web-report') {
    post('/extension/report', msg.payload).catch(() => {});
    return;
  }
  if (msg?.type === 'web-hello') {
    // 回合领养信口（2026-10-02 查岗收割模型）：页面每次加载来认领在飞回合。
    // 转服务端 /extension/report（type=hello，tabId 带 sender 页——服务端重发
    // 帧要换新页寻址），JSON 应答原样带回页面。
    post('/extension/report', {
      type: 'hello',
      sessionId: String(msg.sessionId ?? ''),
      tabId: _sender?.tab?.id ?? 0,
    }).then(r => sendResponse(r ?? {})).catch(() => sendResponse({}));
    return true; // 异步应答
  }
  if (msg?.type === 'web-get-state') {
    (async () => {
      try {
        // 当前会话：最后聚焦窗口的活动标签页若是登记站点的会话页，取其会话 id。
        // 侧栏用它把「当前会话」置顶显示（用户拍板 2026-09-26）。
        let activeSessionId = '';
        try {
          const [at] = await chrome.tabs.query({ active: true, lastFocusedWindow: true, url: SITES.map(s => s.SITE_MATCH) });
          const hit = at ? matchSite(at.url ?? '') : null;
          if (hit) { activeSessionId = sessionRef(hit.site, hit.sessionId); lastActiveTabId = at.id; }
          else if (lastActiveTabId != null) {
            // 焦点已离开站点（比如点开了侧栏）：回落「最近选中的站点会话标签页」记忆——
            // 侧栏开着时焦点永远在侧栏，瞬时焦点查询必空，不能用（实测坑：切换会话后侧栏变空态）。
            const t = await chrome.tabs.get(lastActiveTabId).catch(() => undefined);
            const hit2 = t ? matchSite(t.url ?? '') : null;
            if (hit2) activeSessionId = sessionRef(hit2.site, hit2.sessionId);
          }
        } catch { /* 拿不到就空着 */ }
        const [seatsR, stateR] = await Promise.all([
          fetch(`${serverUrl}/seats`, { signal: AbortSignal.timeout(4000) }).then(r => r.json()),
          fetch(`${serverUrl}/state`, { signal: AbortSignal.timeout(4000) }).then(r => r.json()).catch(() => undefined),
        ]);
        sendResponse({
          ok: true, serverUrl,
          seats: seatsR.seats ?? [], activeSessionId,
          replies: stateR?.replies ?? [], drafts: stateR?.drafts ?? [], projection: stateR?.projection,
          // 人类发言席与引擎流水吃的字段——此前漏传，两张卡永远不亮（实测坑）。
          waitingHuman: stateR?.waitingHuman, runlog: stateR?.runlog ?? [],
          running: stateR?.running, playName: stateR?.playName,
        });
      } catch (e) {
        sendResponse({ ok: false, serverUrl, error: String(e) });
      }
    })();
    return true;
  }
  if (msg?.type === 'web-open-panel') {
    // 悬浮球点击开侧栏。命门：open() 必须在用户手势这一拍同步发起——手势
    // 上下文撑不过任何 await（上一版先 await setOptions 再 open，手势被等丢，
    // open 被浏览器拒绝=点了不弹，实测坑）。所以先 open；围栏若还没给该页
    // 就位配置（极少见），失败后补 setOptions 再重试一次。
    const tabId = _sender?.tab?.id;
    const open = () => (tabId != null ? chrome.sidePanel.open({ tabId }) : chrome.sidePanel.open({}));
    open().catch(() => {
      if (tabId == null) { return; }
      chrome.sidePanel.setOptions({ tabId, path: PANEL_PATH, enabled: true })
        .then(() => open().catch(e => extLog(`openPanel 重试仍失败：${e}`)))
        .catch(e => extLog(`openPanel setOptions 失败：${e}`));
    });
    return;
  }
  if (msg?.type === 'web-launch-service') {
    launchLocalService(sendResponse);
    return true; // 异步应答
  }
  if (msg?.type === 'web-reconnect') {
    // 侧栏席位卡的圆点点击（手动重连）：当场探一轮（补注入绕过 20s 限流）+
    // 登记，回最新席位账。registering 旗下撞车时本轮放空——在跑的那轮本身
    // 就是新鲜探活，读到的账不旧。
    (async () => {
      try {
        await register(true);
        const seatsR = await fetch(`${serverUrl}/seats`, { signal: AbortSignal.timeout(4000) }).then(r => r.json());
        sendResponse({ ok: true, seats: seatsR.seats ?? [] });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg?.type === 'web-action') {
    (async () => {
      try {
        const result = await post(msg.path, msg.body ?? {});
        sendResponse({ ok: true, result });
        if (msg.path === '/seats/bind' || msg.path === '/seats/main') register();
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg?.type === 'femo-freeze-action') {
    // 冻结浮层的两个按钮（content script 的页内消息，原先误挂 onMessageExternal
    // ——那是外部扩展/网页的信口，页内消息根本到不了，按钮从出生就是死的，
    // 2026-10-02 用户实点「没反应」发现）：现在切（人工切=自愿抢焦点，切最新
    // 提醒指向的页）/忽略（浮层 DOM 由 content 侧自拆）。自动切已退役，只听人手。
    // 落点读 storage.session 账（SW 重启不丢）；tabId 失效就按会话引用现场重认，
    // 认不到响亮留痕——旧版读 SW 内存单槽，SW 一睡账就空，点了没反应（实案）。
    sendResponse({ ok: true });
    (async () => {
      const got = await chrome.storage.session.get(REMIND_KEY);
      const target = got[REMIND_KEY] ?? null;
      if (msg.action === 'switch') {
        if (target) await setRemindTarget(null);
        const tabId = Number(target?.tabId ?? 0);
        const sessionId = String(target?.sessionId ?? '');
        if (!tabId && !sessionId) extLog('freeze-action switch: 落点账是空的（SW 重启前的老提醒且没带引用）——切不了');
        else switchToTabNow(tabId, sessionId);
      } else if (target) {
        await setRemindTarget(null);
      }
    })().catch(e => extLog(`freeze-action 处理失败：${e}`));
    return;
  }
  return undefined;
});

// ── 操作台直邮信口（2026-09-28 地址设置自侧栏搬入操作台）─────────────────
// 操作台页（本地服务自己开的网页）一键告知「服务在这个地址」：存盘 + 当场换线，
// 轮询下一拍就走新地址。发信资格被清单 externally_connectable 锁死在本机回环
// （127.0.0.1/localhost），别的网页调不进来；地址本身仍验一道形态。
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  // 操作台直邮信口收两种信：web-set-server（告知地址）+ web-launch-service
  // （一键拉起，2026-09-30 自侧栏快捷卡收编进操作台「本地服务」卡——本页就
  // 住在服务上，服务死了页还在，重启得靠扩展的 Native Messaging 叫醒）。
  if (msg?.type === 'web-set-server') {
    const raw = String(msg.url ?? '').replace(/\/+$/, '');
    let shapeOk = false;
    try {
      const u = new URL(raw);
      shapeOk = (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname);
    } catch { shapeOk = false; }
    if (!shapeOk) { sendResponse({ ok: false, error: `地址不像话：${raw}` }); return undefined; }
    serverUrl = raw;
    chrome.storage.local.set({ serverUrl: raw }).then(() => {
      extLog(`serverUrl switched to ${raw}（操作台告知）`);
      register().catch(() => {});
      sendResponse({ ok: true, serverUrl: raw });
    });
    return true; // 异步应答
  }
  if (msg?.type === 'web-launch-service') {
    launchLocalService(sendResponse);
    return true; // 异步应答
  }
  // （冻结浮层的 femo-freeze-action 信口 2026-10-02 迁回 onMessage——页内消息
  //   到不了这个外部信口，挂在这里按钮就是死的。）
  return undefined;
});

// ── 生命周期 ──────────────────────────────────────────────────────────
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ── 侧栏站点围栏：只在登记站点（sites.mjs 注册表）的标签页可开 ────────
// 围栏判断走注册表（inAnySite）；本文件只管围栏的开收机制。
// 全局默认关，再按标签页放行；标签页导航离开后 setOptions 翻回关，围栏自动收口。
// SW 唤醒/浏览器重启后按现存标签页重扫一遍（标签页级设置不保证跨重启留存）。
const PANEL_PATH = "extension/sidepanel.html"; // 与 manifest 的 side_panel.default_path 同源
async function applyPanelFence(tabId, url) {
  const want = inAnySite(url);
  try {
    // 注意：对某页调过 setOptions 后，该页配置整体替换、不回退全局缺省——
    // 所以启用分支必须自带 path，否则「启用但无内容」，点击图标不弹（实测坑）。
    await chrome.sidePanel.setOptions({ tabId, path: PANEL_PATH, enabled: want });
  } catch { /* 标签页已关等竞态：不追 */ }
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.title || change.status === 'complete') register();
  if (change.url) applyPanelFence(tabId, change.url);
  else if (change.status === 'complete') applyPanelFence(tabId, tab?.url);
});
chrome.tabs.onCreated.addListener(tab => applyPanelFence(tab.id, tab.url));
// 用户切标签页时更新「最近选中的站点会话标签页」记忆（活动会话判定的依据）。
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then(t => {
    if (inAnySite(t.url ?? '')) lastActiveTabId = tabId;
  }).catch(() => {});
});

// 提醒过期即撤（2026-10-02 用户补刀「通知已经过期了嘛」）：目标页被用户亲手
// 激活=提醒过期——全局收横条、清落点账、清同单系统通知。人工「切过去」的收尾
// 也走这里（activateId 亲手设），两路同源。SW 可能已重启：activateId 缓存的
// tabId 失效时按落点账里的会话引用现场认页（与「切过去」同一套认页）。
let activateId = 0;
chrome.tabs.onActivated.addListener(({ tabId }) => {
  activateId = tabId;
  (async () => {
    const got = await chrome.storage.session.get(REMIND_KEY);
    const target = got[REMIND_KEY] ?? null;
    if (target && Number(target.tabId ?? 0) === tabId) { await dismissExpiredRemind(); return; }
    if (target?.sessionId) {
      const resolved = await resolveRemindTab(target);
      if (resolved && resolved === tabId) await dismissExpiredRemind();
    }
  })().catch(() => {});
});
chrome.tabs.onRemoved.addListener(() => register());

// SW 唤醒/浏览器重启后的首轮清扫：现存标签页按当前 URL 逐个定开关。
chrome.tabs.query({}).then(tabs => { for (const t of tabs) applyPanelFence(t.id, t.url); }).catch(() => {});

chrome.alarms.create('web-keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'web-keepalive') {
    register();
    if (!globalThis.__webPolling) { globalThis.__webPolling = true; pollLoop(); }
  }
});

setInterval(register, REGISTER_INTERVAL_MS);
register();
