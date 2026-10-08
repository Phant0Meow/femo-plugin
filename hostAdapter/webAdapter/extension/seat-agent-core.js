/**
 * seat-agent-core.js — 网页席座席代理的机器骨架（隔离世界经典脚本，2026-09-29 收编）。
 *
 * 四家站点包的 content.js 曾把与任何网站无关的机器逻辑逐字节复制四份（守卫、
 * SPA 换页跟踪、逐字流草稿节流、输入框扫描与受控写入、Enter 派发、发送判定、
 * 网络闸收话、下发主流程、信口）——修一处要同改四遍，漏一处即站点间行为漂移。
 * 本件把骨架收成唯一一份：createSeatAgent(site) 吃站点事实（正则/候选名单/
 * 标题规则/日志名牌），接管全部机器骨架；content.js 只剩站点事实 + 一行装配。
 * 边界（tests/site-boundary.test.mjs 锁死）：本文件零网站事实——网址、选择器、
 * 会话正则一概不住这里。
 *
 * 注入契约：content script 经典脚本进不了 ESM，靠 manifest content_scripts[].js
 * 与站点包 PAGE_SCRIPTS 的**多文件按序注入**（本件必须排在 content.js 之前），
 * 经 globalThis.FemoSeatCore 交接。
 *
 * 站点事实（site 参数）：
 *   tag / consoleTag       日志名牌（服务日志 [ext:<tag>] 行 / 控制台前缀）
 *   sessionRe, execHref    会话 id 正则 + 是否对 location.href 整串 exec（缺省 pathname）
 *   parseSessionTitle(raw) 会话名提取（站点私有层）
 *   rideAlongTitles        会话名搭车（web-net 'titles' 帧收 titleBySid）
 *   titlesLogNote          搭车来源措辞（「从页面自取的会话清单收到」等）
 *   inputCandidates        输入框候选选择器（自家锚打头，结构兜底殿后）
 *   sendCandidates         发送钮候选选择器
 *   sendGesture            发送手势：'enter'（缺省，派发回车）| 'ctrlEnter'
 *                          （Ctrl+Enter——AI Studio 实证 Enter 只换行不发送）
 *   writeMode              富文本写入姿势：'command'（缺省，execCommand——
 *                          四家在役真演出实证）| 'paste'（粘贴事件管线——
 *                          千问 2026-10-03 实案：execCommand 绕过受控编辑器
 *                          的状态管线，字进得了框、状态不认账，编辑器拒绝
 *                          一切后续编辑、真人也删不了字、发送钮永远灰）
 *   domBusySelector        DOM 忙碌锚点（可选；未取证就别给——不猜）
 *   domReplySelector       DOM 收话兜底的回复容器（可选；给了才启用「文本稳定
 *                          数秒」降级与 DOM 兜底收话——网络闸缺席的已知降级）
 *   sendFailNote/noReplyNote  两句失败文案（各家按取证状态自定）
 *   logTitleCalibration    上线时打一行会话名解析校准日志（标题剥尾巴的站开着）
 */

(() => {
  if (globalThis.FemoSeatCore) return;

  const SEND_SETTLE_MS = 3000;    // 发送判定的等待上限（输入框被清空/开始生成）
  const POLL_INTERVAL_MS = 1000;
  const INPUT_WAIT_MS = 20000;    // 下发前等输入框就绪的上限（唤醒即派的车要等页面冷加载完，job 2672 实案）
  const SEND_RETRY_INTERVAL_MS = 15000; // 发送失败自动重试的节拍（2026-10-05 用户拍板：没见到 sent 成功信号就每 15s 重喂，发出即停）
  const COMPLETION_TIMEOUT_MS = 3_100_000; // 比宿主执行保险丝（3000s，到点跳过节点）略长：裁决权统一在宿主——真先到点的只会是宿主的「超时跳过」；这里只兜宿主保险丝失灵的死角（那时报 error 交运行时判死）
  const IDLE_POLLS_FOR_STABLE = 3; // DOM 降级判定：文本连续 3 次轮询不变 = 说完了
  const DRAFT_THROTTLE_MS = 400;   // 逐字流草稿轨尾随节流

  function createSeatAgent(site) {
    function parseSessionId() {
      const m = site.sessionRe.exec(site.execHref ? location.href : location.pathname);
      return m ? m[1] : '';
    }
    let sessionId = parseSessionId();
    let busy = false;
    let netActive = false;       // 网络闸视角：本轮生成是否在途
    let lastNetDoneAt = 0;
    let inflight = null;         // {deliveryId, startedAt} 同一时刻至多一个在飞回合

    // ── 小件 ────────────────────────────────────────────────────────────
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    /** 会话引用（`<域名>:<id>`）：形态契约=各站点包 site.mjs 的 sessionRef
     *  镜像——上报统一带来源，服务端席位账按引用立账。 */
    function sessionRef(id) {
      return id ? `${location.hostname}:${id}` : id;
    }

    function report(payload) {
      try { chrome.runtime.sendMessage({ type: 'web-report', payload: { sessionId: sessionRef(sessionId), ...payload } }); } catch { /* 扩展重载中，丢一次状态上报无妨 */ }
    }

    /** 座席流水：控制台一份、服务日志一份（排障不必开 F12，服务端文件里全有）。 */
    function seatLog(line, level = 'info') {
      (console[level] ?? console.log)(`[${site.consoleTag}] ${line}`);
      report({ type: 'log', tag: site.tag, line });
    }

    // ── 后台保活：WebRTC 环回（2026-10-03）────────────────────────────
    // 浏览器把后台页冻掉/节流是「唤醒后走不完流程」的根因（deepseek/豆包收帧
    // 即冻实案；机器级 flags 用户不想动）。WebRTC 是两家官方的冻结豁免通道：
    // 页面挂着活的 RTCPeerConnection 就不进冻结/睡眠名单、后台计时器不被重
    // 节流。这对环回纯本机——数据通道自己连自己，零权限零声音零焦点零外网
    // 流量。若某版本不认这个豁免，保活只是无效、无副作用：静默阶梯照旧兜底。
    (function keepAliveWebrtc() {
      try {
        const a = new RTCPeerConnection();
        const b = new RTCPeerConnection();
        a.onicecandidate = e => { if (e.candidate) b.addIceCandidate(e.candidate).catch(() => {}); };
        b.onicecandidate = e => { if (e.candidate) a.addIceCandidate(e.candidate).catch(() => {}); };
        const dc = a.createDataChannel('femo-keepalive');
        dc.onopen = () => {
          seatLog('后台保活：WebRTC 环回已连通（本页不进冻结/睡眠名单）');
          setInterval(() => { try { dc.send('❤'); } catch { /* 通道死了拉倒 */ } }, 25000);
        };
        a.createOffer()
          .then(o => a.setLocalDescription(o))
          .then(() => b.setRemoteDescription(a.localDescription))
          .then(() => b.createAnswer())
          .then(ans => b.setLocalDescription(ans))
          .then(() => a.setRemoteDescription(b.localDescription))
          .catch(() => { /* 架不起来就算了——静默阶梯照旧兜底 */ });
      } catch { /* 无 WebRTC 的环境同上 */ }
    })();

    // ── ① 身份：SPA 换页跟踪（SPA 换页不刷新，pushState/popstate + 兜底轮询）──
    function onPathMaybeChanged() {
      const sid = parseSessionId();
      if (sid === sessionId) return;
      sessionId = sid;
      report({ type: 'url', sessionId });
    }

    const origPush = history.pushState?.bind(history);
    const origReplace = history.replaceState?.bind(history);
    if (origPush) history.pushState = function (...a) { const r = origPush(...a); onPathMaybeChanged(); return r; };
    if (origReplace) history.replaceState = function (...a) { const r = origReplace(...a); onPathMaybeChanged(); return r; };
    window.addEventListener('popstate', onPathMaybeChanged);
    setInterval(onPathMaybeChanged, 1500); // 兜底：别的换页通道（前端路由 hack）也跟住

    // ── 网络闸事件（inject.js → 这里）──────────────────────────────────
    const seenApi = new Set();
    let gateResult = null; // 最近一次闸收话：{thinking, content, finished, at}
    const titleBySid = new Map(); // 会话 id → 会话名（网络闸搭车收来的会话清单）
    let titlesLogged = false;
    // ── 逐字流（草稿轨）：闸全程快照 → 节流上报，服务端喂 hub 草稿层 ────────
    // 旁路轨：只上墙，绝不碰收话时序（completed 仍是唯一权威）。有在飞回合带
    // deliveryId（服务端喂 hub 草稿层）；手工聊天没有回合也上报（deliveryId 空
    // =纯面板镜像，服务端不喂 hub）——无引擎即可在面板验证流式链路。尾随节流，
    // completed 补发终值；交卷落账时 hub 自动吸收草稿，以定稿为准不双份。
    let draftSnap = null;
    let draftLastSentAt = 0;
    let draftTimer = 0;
    function sendDraftNow() {
      if (draftTimer) { clearTimeout(draftTimer); draftTimer = 0; }
      if (!draftSnap) return;
      report({ type: 'delta', deliveryId: inflight?.deliveryId ?? '', thinking: draftSnap.thinking, content: draftSnap.content });
      draftLastSentAt = Date.now();
      draftSnap = null;
    }
    function onDraftDelta(d) {
      draftSnap = { thinking: String(d?.thinking ?? ''), content: String(d?.content ?? '') };
      const wait = DRAFT_THROTTLE_MS - (Date.now() - draftLastSentAt);
      if (wait <= 0) { sendDraftNow(); return; }
      if (!draftTimer) draftTimer = setTimeout(() => { draftTimer = 0; sendDraftNow(); }, wait);
    }

    window.addEventListener('web-net', ev => {
      const phase = ev?.detail?.phase;
      if (phase === 'gate-log') {
        // 网络闸的取证留痕（MAIN world 摸不到 chrome.runtime，从这里中转进服务日志）
        const line = String(ev?.detail?.line ?? '');
        if (line) seatLog(line);
        return;
      }
      if (phase === 'api') {
        // 探针留续：页面真实在调的接口（按 URL 去重，只记一遍）。
        const u = String(ev?.detail?.url ?? '');
        if (u && !seenApi.has(u)) { seenApi.add(u); seatLog(`网络闸看见接口：${u}`); }
        return;
      }
      if (phase === 'delta') {
        onDraftDelta(ev.detail); // 无在飞回合也上报：deliveryId 空=纯面板镜像，服务端不喂 hub
        return;
      }
      if (phase === 'titles') {
        if (!site.rideAlongTitles) return;
        const titles = ev?.detail?.titles ?? {};
        let added = 0;
        for (const [sid, t] of Object.entries(titles)) {
          if (t && !titleBySid.has(sid)) { titleBySid.set(sid, String(t)); added += 1; }
        }
        if (added && !titlesLogged) { titlesLogged = true; seatLog(`会话名来源就位：${site.titlesLogNote} ${titleBySid.size} 个会话名`); }
        return;
      }
      if (phase === 'start') {
        seatLog('网络闸：生成开始');
        gateResult = null;
        draftSnap = null;
        netActive = true;
        setBusy(true, 'net');
        return;
      }
      if (phase === 'completed') {
        const d = ev?.detail ?? {};
        // 流早夭闸（千问 2026-10-03 实案：0.4s 流断、无正文无结束标记，DOM 兜底
        // 抓到刚冒头的 3 个字就交了卷）：没正文又没结束标记不是收口——真回复
        // 多半还在页面上渲染。当无事发生：不记收口时刻（lastNetDoneAt 保持
        // 旧值，轮询的「net 收口」早退分支不触发），交给「文本稳定 3 拍」收
        // 页面上渲染完的全文；后续真流再来照常走下面。
        if (!String(d.content ?? '') && !d.finished) {
          seatLog('网络闸：流早夭（无正文无结束标记）——不交卷，改等 DOM 稳定收全文', 'warn');
          netActive = false;
          setBusy(false);
          return;
        }
        gateResult = { thinking: String(d.thinking ?? ''), content: String(d.content ?? ''), finished: Boolean(d.finished), at: Date.now() };
        const diag = Array.isArray(d.diagKeys) ? `；诊断：${d.diagKeys.slice(0, 6).join('；')}` : '';
        seatLog(`网络闸：流收话（FINISHED=${gateResult.finished}；思考 ${gateResult.thinking.length} 字 / 正文 ${gateResult.content.length} 字${diag}）`);
        netActive = false;
        lastNetDoneAt = Date.now();
        setBusy(false);
        sendDraftNow();
        reportReplyNow(); // FINISHED 一到就交卷——不等轮询（亚秒冻结窗口，豆包实案）
        return;
      }
      if (phase === 'finished' || phase === 'done') {
        netActive = false;
        lastNetDoneAt = Date.now();
        setBusy(false);
      }
    });

    // ── 忙碌态（网络闸为准；domBusySelector 给了才做 DOM 指示器兜底）────────
    /** 「生成中指示」以可见为准：querySelector 只认在不在、不认看没看得见，
     *  display:none 藏在 DOM 里的指示器不是指示——隐藏的「停止生成」残留会让
     *  忙锚永真，领养收尾的「文本稳定+忙锚消失」永远差最后一关（2026-10-02）。 */
    function domBusySignal() {
      if (!site.domBusySelector) return false;
      const el = document.querySelector(site.domBusySelector);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    if (site.domBusySelector) {
      setInterval(() => {
        if (!netActive && domBusySignal()) setBusy(true, 'dom');
        else if (!netActive) setBusy(false);
      }, POLL_INTERVAL_MS);
    }

    function setBusy(next, source) {
      if (busy === next) return;
      busy = next;
      report({ type: 'busy', busy, source: source ?? '' });
    }

    /** 席位显示名：搭车站优先 ride-along 清单，退回标题规则（站点私有层）。 */
    function sessionTitle() {
      return site.rideAlongTitles
        ? (titleBySid.get(sessionId) || site.parseSessionTitle(document.title))
        : site.parseSessionTitle(document.title);
    }

    // ── ② 发送 ──────────────────────────────────────────────────────────
    function isUsable(el) {
      const r = el.getBoundingClientRect();
      return r.width > 10 && r.height > 10;
    }

    /** 命中返回 {el, sel}，全落空返回 null。候选都按「可见尺寸」过滤
     *  （页面上可能藏着隐藏模板）。 */
    function findInput() {
      for (const sel of site.inputCandidates) {
        for (const el of document.querySelectorAll(sel)) {
          if (isUsable(el)) return { el, sel };
        }
      }
      return null;
    }

    /** 全落空时的自诊断：把页面里输入类元素的真实长相报进日志（选锚点用）。 */
    function describeEditors() {
      const nodes = document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]');
      return {
        editors: [...nodes].map(el => ({
          tag: el.tagName,
          id: el.id || undefined,
          cls: typeof el.className === 'string' ? el.className.slice(0, 90) : undefined,
          placeholder: el.getAttribute?.('placeholder') || el.getAttribute?.('aria-label') || undefined,
        })),
        iframes: document.querySelectorAll('iframe').length,
      };
    }

    /** 输入框就绪轮询：「元素在页」与「元素可用」是两回事——唤醒闸 reload
     *  叫醒后页面还在冷加载，DOM 已挂出但未布局，可见尺寸过滤全落空
     *  （job 2672 实案：座席上线 7 秒半后派帧，盘点里有元素、可用的没有）。
     *  每拍重扫全部候选（元素可能先挂隐藏模板、布局完成后才可见），首拍
     *  即中零等待，等过 200ms 才打一行日志留影。超上限返回 null，由调用方
     *  响亮失败带页面盘点（不静默兜底）。 */
    async function waitForInput(deadlineMs) {
      const start = Date.now();
      for (;;) {
        const hit = findInput();
        if (hit) {
          const waited = Date.now() - start;
          if (waited > 200) seatLog(`输入框等了 ${waited}ms 才就绪（页面冷加载中）`);
          return hit;
        }
        if (Date.now() - start >= deadlineMs) return null;
        await sleep(POLL_INTERVAL_MS);
      }
    }

    function setInputValue(el, text) {
      el.focus();
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        // 受控组件（React/Vue 同样认原生 setter + input 事件）：直接赋值会被骨架吞掉。
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (!setter) throw new Error('input value setter 不可用');
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (site.writeMode === 'paste') {
        // 粘贴管线：编辑器自己的 onPaste 收字，状态同步是它自己的事——受控
        // 富文本编辑器只认这条进状态的路（execCommand 路线的实案见头部注）。
        document.execCommand('selectAll', false, null);
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      } else {
        // 富文本编辑器（ProseMirror 等 contenteditable）：全选后用 insertText 替换。
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
    }

    function dispatchEnter(el) {
      const ctrl = site.sendGesture === 'ctrlEnter';
      const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, ctrlKey: ctrl, metaKey: ctrl };
      el.dispatchEvent(new KeyboardEvent('keydown', init));
      el.dispatchEvent(new KeyboardEvent('keyup', init));
    }

    function tryClickSendButton() {
      // 候选名单（站点给）；找不到就明说，不乱点。
      for (const sel of site.sendCandidates) {
        const btn = document.querySelector(sel);
        if (btn && isUsable(btn)) { btn.click(); return true; }
      }
      return false;
    }

    function editorValue(el) {
      return (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) ? el.value : (el.textContent ?? '');
    }

    /** 发送判定：输入框被清空，或本页开始新一轮生成（网络闸/DOM 任一）。 */
    async function waitSentCleared(deadlineMs) {
      const start = Date.now();
      while (Date.now() - start < deadlineMs) {
        const hit = findInput();
        if (hit && editorValue(hit.el) === '') return true;
        if (netActive || domBusySignal()) return true;
        await sleep(200);
      }
      const hit = findInput();
      return Boolean(hit && editorValue(hit.el) === '');
    }

    // ── ③ 收话 ──────────────────────────────────────────────────────────
    /** DOM 收话兜底（只对给了 domReplySelector 的站启用）：最后一段回复容器文本。 */
    function lastReplyText() {
      if (!site.domReplySelector) return '';
      const nodes = document.querySelectorAll(site.domReplySelector);
      const last = nodes[nodes.length - 1];
      return last ? (last.innerText ?? '').trim() : '';
    }

    /** 收话对账（豆包啃头四案，2026-10-04）：闸攒的正文若恰是页面上渲染完的
     *  全文的尾巴且更短＝闸在流里丢了头——以页面渲染为准（页面拿到的是全量，
     *  解析器只见部分通道；格式考古交给流头取证，这里先保证交卷是全的）。
     *  只有 DOM 全文确实「收尾＝闸文本」才改用，拿错节点不误伤；闸空照旧走
     *  DOM 兜底。 */
    function reconcileWithDom(gateText) {
      const dom = lastReplyText();
      if (!gateText) return dom;
      if (dom && dom.length > gateText.length && dom.endsWith(gateText)) {
        seatLog(`收话对账：闸攒${gateText.length}字恰是页面渲染${dom.length}字的尾巴——丢了头，改用页面全文`);
        return dom;
      }
      return gateText;
    }

    /** 等回复结束：网络闸优先（FINISHED/done），给了 domReplySelector 的站
     *  退「文本稳定数秒」笨办法（已知降级，超长思考可能误判）。 */
    async function awaitCompletion(startedAt) {
      const deadline = startedAt + COMPLETION_TIMEOUT_MS;
      let stableText = '';
      let stableCount = 0;
      while (Date.now() < deadline) {
        if (!netActive && lastNetDoneAt > startedAt) return 'net';
        if (!netActive && site.domReplySelector) {
          const text = lastReplyText();
          if (text && text === stableText && !domBusySignal()) {
            stableCount += 1;
            if (stableCount >= IDLE_POLLS_FOR_STABLE) return 'dom-stable';
          } else {
            stableCount = 0;
            stableText = text;
          }
        } else {
          stableCount = 0;
        }
        await sleep(POLL_INTERVAL_MS);
      }
      return 'timeout';
    }

    // ── 下发主流程 ──────────────────────────────────────────────────────
    /** 受理下发（同步受理、异步执行）：写输入框发车收话是分钟级长跑，消息通道
     *  只活一拍——立即应答受理结果，跑完的收尾走 report 上行。（2026-10-02 豆包
     *  实案：原先整个回合持有通道，reload 一断通道就报「帧投递失败」——发送明
     *  明早就成功了，留痕全是误导。）同单重试放行（send-failed 后账还捏在手里，
     *  重试带的正是同一张单）；生成在跑时一律拒（busy=迟到的发送已生效，
     *  账会兜住 FINISHED，重发只会双发）。 */
    function offerDeliver(msg) {
      const id = String(msg.deliveryId ?? '');
      if (inflight && inflight.deliveryId !== id) return { accepted: false, reason: 'busy (turn in flight)' };
      if (busy) return { accepted: false, reason: 'busy (generating)' };
      inflight = { deliveryId: id, startedAt: Date.now() };
      void runDeliver(msg);
      return { accepted: true };
    }

    /** FINISHED 一到就交卷（2026-10-02 豆包实案）：完成事件里思考/正文已经齐了
     *  ——旧法留给 runDeliver 的 1s 轮询去发现「已收口」再上报，页面在「收完
     *  最后一块」到「下一拍轮询」之间的亚秒窗口被浏览器冻结，全文在手也报不
     *  出去（后台待过一阵的页随时会冻，刚打开的页还轮不到冻——这正是「刚打开
     *  就收得到结束标记、放久了收不到」的分界）。现在收话完成的同一拍直接交卷。
     *  只管 fresh 回合：领养的回合归 adoptWait（DOM 全文优先——网站续流可能
     *  只有半截）；空正文也交回轮询路径按降级留痕。 */
    function reportReplyNow() {
      if (!inflight || inflight.adopted) return;
      const deliveryId = inflight.deliveryId;
      const startedAt = inflight.startedAt;
      const gate = (gateResult && gateResult.at >= startedAt) ? gateResult : null;
      const reply = reconcileWithDom((gate?.content || '').trim());
      if (!reply) return;
      const thinking = (gate?.thinking || '').trim();
      inflight = null; // 消费掉回合：runDeliver 的轮询醒来见人去楼空即退（所有权守卫）
      cancelSendRetry?.(); // 交卷了：同单的焦点重试撤掉，别再把话发一遍
      seatLog(`回复结束（${gate ? 'net直报' : 'dom直报'}），正文 ${reply.length} 字${thinking ? ` / 思考 ${thinking.length} 字` : ''}`);
      report({ type: 'reply', deliveryId, text: reply, ...(thinking ? { thinking } : {}) });
    }

    async function runDeliver(msg) {
      const deliveryId = inflight.deliveryId;
      const startedAt = inflight.startedAt;
      const text = msg.text;
      let phase = 'send'; // send=打字发车段（可自救）；collect=等收尾/收话段（失败降级留痕）
      let keepInflight = false;
      try {
        // 唤醒即派：keeper 把休眠页 reload 叫醒后马上派帧，页面还在冷加载
        // ——旧法一拍 findInput 不中立即报死（job 2672：整场因此 failed）。
        // 现在轮询等就绪（上限 INPUT_WAIT_MS，覆盖唤醒~就绪的常态 5~15s，
        // 也在服务端发送期 120s 保险丝之内）；上限内仍无=真问题（选择器
        // 失效/页面没加载出输入区），响亮失败带盘点，不掩盖。
        const hit = await waitForInput(INPUT_WAIT_MS);
        if (!hit) throw new Error(`等 ${INPUT_WAIT_MS / 1000}s 输入框仍未就绪。页面输入类元素盘点：${JSON.stringify(describeEditors())}`);
        seatLog(`输入框命中：${hit.sel}（tag=${hit.el.tagName}${hit.el.id ? ` #${hit.el.id}` : ''}）`);
        setInputValue(hit.el, text);
        await sleep(150);
        dispatchEnter(hit.el);
        let sent = await waitSentCleared(SEND_SETTLE_MS);
        if (!sent) {
          sent = tryClickSendButton() && (await waitSentCleared(SEND_SETTLE_MS));
        }
        if (!sent) {
          // 发送失败盘点：手势、各候选命中情况、输入区附近（下半屏）可见按钮
          // ——手势与候选钮的真值靠它定型，没有这份盘点就只能瞎猜选择器。
          // 附输入框自检：contenteditable 还在不在、中心点落点被谁顶替（透明
          // 浮层会吃掉真人与机器的点击，2026-10-03 千问「真人也编辑不了」装表）。
          const inR = hit.el.getBoundingClientRect();
          const inTop = document.elementFromPoint(inR.left + inR.width / 2, inR.top + inR.height / 2);
          const occluded = inTop && inTop !== hit.el && !hit.el.contains(inTop)
            ? `；输入框中心点落点被 <${inTop.tagName} ${String(inTop.className || '').slice(0, 50)}> 顶替（有浮层挡着）`
            : '；输入框中心点落点=输入框自己（无浮层）';
          const cand = site.sendCandidates.map(sel => {
            const b = document.querySelector(sel);
            const r = b?.getBoundingClientRect();
            const dis = b && (b.disabled || b.getAttribute('aria-disabled') === 'true') ? '，disabled' : '';
            return `${sel}→${b ? `命中(${Math.round(r?.width ?? 0)}x${Math.round(r?.height ?? 0)}${dis})` : '无'}`;
          });
          const near = [...document.querySelectorAll('button')]
            .filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top > innerHeight * 0.5; })
            .slice(0, 12)
            .map(b => `${b.getAttribute('aria-label') || b.title || ''}|${b.getAttribute('data-testid') || ''}|${typeof b.className === 'string' ? b.className.slice(0, 40) : ''}`);
          seatLog(`发送失败盘点——手势=${site.sendGesture ?? 'enter'}；contenteditable=${hit.el.getAttribute('contenteditable') ?? '（没了！）'}${occluded}；候选：${cand.join(' ；')}；下半屏可见按钮：${JSON.stringify(near)}`, 'warn');
          throw new Error(site.sendFailNote);
        }
        seatLog(`已发送，等回复结束…（${text.length} 字）`);
        report({ type: 'sent', deliveryId });
        phase = 'collect';

        const how = await awaitCompletion(startedAt);
        if (how === 'timeout') throw new Error(`等回复超时（${COMPLETION_TIMEOUT_MS / 60000} 分钟）`);
        if (!inflight || inflight.deliveryId !== deliveryId) {
          // 回合已被 FINISHED 直报收走（reportReplyNow 消费了 inflight）——轮询
          // 醒来见人去楼空，静默退出。
          return { accepted: true };
        }
        // 收话两路：网络闸解析出的思考/正文分离结果优先（gateResult 必须属于
        // 本轮）；给了 domReplySelector 的站，闸缺席时 DOM 兜底取最后一段回答
        // （思考拿不到就留空，绝不拿别的节点凑数）。
        const gate = (gateResult && gateResult.at >= startedAt) ? gateResult : null;
        const reply = reconcileWithDom((gate?.content || '').trim());
        const thinking = (gate?.thinking || '').trim();
        if (!reply) throw new Error(site.noReplyNote);
        const gateNote = site.domReplySelector ? `${gate ? '+网络闸' : ''}` : '';
        seatLog(`回复结束（${how}${gateNote}），正文 ${reply.length} 字${thinking ? ` / 思考 ${thinking.length} 字` : ''}`);
        cancelSendRetry?.(); // 交卷了：同单的焦点重试撤掉，别再把话发一遍
        report({ type: 'reply', deliveryId, text: reply, ...(thinking ? { thinking } : {}) });
        return { accepted: true };
      } catch (e) {
        if (phase === 'send') {
          // 发送姿势失败（输入框 20s 未就绪/写了没清空/生成没启动）＝「切页面就
          // 能救活」的场合（页面半冷加载、冻结边缘、姿势被站方改了）：不是
          // error——上报 send-failed（非终局，服务端当活气打点不掐戏），引擎
          // 不停；15s 自动重试链接管（2026-10-05 用户拍板：没见到 sent 就每
          // 15s 重喂，发出即停——2026-10-02 拍板「这类事永远不许停引擎」）。
          seatLog(`发送失败（回合保活，15s 后自动重试）：${e?.message ?? e}`, 'warn');
          report({ type: 'send-failed', deliveryId, tries: msg.tries ?? 0, message: String(e?.message ?? e) });
          armSendRetry(msg);
          // 发送失败**不丢回合账，也不自设时限**（2026-10-02 豆包 _5 实案 + 用户
          // 拍板「节点都没结束这些地方瞎超时啥呢」）：半醒页面上的发送会迟到——
          // 07:23:51 判失败放手、07:23:54 生成才开始、07:23:58 FINISHED（89 字
          // 全文），inflight 已清，回复死在页面里。账持有到 FINISHED 直报收卷，
          // 或服务端 turn-closed 关单（保险丝跳过/停演/失败——节点什么时候结束
          // 只有服务端知道，页面猜不如听）。
          keepInflight = true;
        } else {
          // 收话段失败（等回复超时/闸说完了正文是空的）：按「收不到内容」降级
          // 留痕，**绝不是 error**——回复全文躺在会话历史里，reload 后回合领养
          // 走 DOM 全文兜底就能接回来（切个页面就救活了算什么 error，2026-10-02
          // 用户定案：这类事永远不许停引擎）。回合留在服务端账上，静默看护
          // 30s reload → hello 领养重收；一直收不到就 3000s 保险丝占位跳过。
          seatLog(`收话失败（回合保活，等静默看护 reload 领养重收）：${e?.message ?? e}`, 'warn');
        }
        return { accepted: false, reason: String(e?.message ?? e) };
      } finally {
        // 所有权守卫：只收自己的账——回合可能已被直报消费、或被新回合顶替。
        // send-failed 例外：账留给迟到的发送/FINISHED 直报（服务端 turn-closed
        // 关单负责放手——页面无自设时限）。
        if (!keepInflight && inflight && inflight.deliveryId === deliveryId) inflight = null;
      }
    }

    /** 发送失败后的自救（2026-10-05 用户拍板「如果没喂成功，15 秒重试；发出去了
     *  就停，后面的问题不纳入这条重试」）：每 15s 自动重喂一拍，不再等用户点开
     *  页面——冷加载的后台页恰恰没人点开，编辑器晚挂载一拍发送就成。成功信号=
     *  sent（waitSentCleared：输入框清空或生成已启动）；见到它重试链即撤。其余
     *  终局：服务端关单（turn-closed 撤钟）、交卷（cancelSendRetry）、页面账被
     *  消费（inflight 走空，下一拍自然退出）。429 无虞：发送失败的阶段里没有任何
     *  请求到达站方（Enter 打在没挂载的编辑器/disabled 的按钮上），重试只动本页
     *  DOM；生成真跑起来 busy 挡住重发。外界兜底=服务端 3000s 保险丝（关单撤钟）。
     *  每次失败武装一次；重试再失败会再武装——机器不放弃也不双发。 */
    let cancelSendRetry = null;
    function armSendRetry(payload) {
      cancelSendRetry?.();
      const timer = setTimeout(() => {
        cancelSendRetry = null;
        if (!inflight || inflight.deliveryId !== payload.deliveryId) return; // 关单/已交卷：单没了
        if (busy) return; // 生成已在跑（迟到的那次发送其实生效了）：等 FINISHED 交卷
        payload.tries = (payload.tries ?? 0) + 1;
        seatLog(`第 ${payload.tries} 次自动重试发送（每 ${SEND_RETRY_INTERVAL_MS / 1000}s 一拍，发出即停）…`);
        const ack = offerDeliver(payload);
        if (!ack.accepted) {
          seatLog(`重试发送被拒：${ack.reason}`, 'warn');
          armSendRetry(payload); // 拒绝不是终局——下一拍再来（生成在跑的拒绝下一拍会自然停）
        }
      }, SEND_RETRY_INTERVAL_MS);
      cancelSendRetry = () => { clearTimeout(timer); cancelSendRetry = null; };
    }

    // ── 回合领养（查岗收割模型，2026-10-02）────────────────────────────
    // reload 把页面上正在等结尾的收话机（inflight 上下文）一起销毁了——网站把
    // 回复拉回来显示，但新的收话机不知道记到哪个任务账上。这里在每次加载后向
    // 服务端认领：adopt=领账查岗收尾；replay=原帧重发（发送被打断的场合）。
    function helloServer() {
      const ref = sessionRef(sessionId);
      if (!ref) return; // 裸首页（会话未生成）没有可认领的账
      try {
        Promise.resolve(chrome.runtime.sendMessage({ type: 'web-hello', sessionId: ref }))
          .then(r => {
            const out = r ?? {};
            if (out.adopt) {
              seatLog(`领养在飞回合 ${out.adopt}——查岗等回复完事…`);
              adoptWait(String(out.adopt));
            } else if (out.replay?.deliveryId) {
              seatLog(`领到重发帧 ${out.replay.deliveryId}——重新发车`);
              const ack = offerDeliver(out.replay);
              if (!ack.accepted) seatLog(`重发被拒：${ack.reason}`, 'warn');
            } else if (out.retryHelloMs) {
              // 认领被拒（现役页还在发送/重试中，防双页同发——j2713 豆包实案）：
              // 约半分钟后再来认领；现役页真死了接管最迟两拍后发生，回合收场后
              // 服务端回空应答、循环自停。
              setTimeout(helloServer, Number(out.retryHelloMs) || 30000);
            }
          })
          .catch(() => { /* 后台没起来/扩展重载中：下次 reload 再认领 */ });
      } catch { /* 扩展上下文失效 */ }
    }

    /** 领养收尾：等「完事」（网络闸 FINISHED=重连续流；DOM 稳定+忙锚消失=历史
     *  里已渲染完），正文 **DOM 全文优先**——网站续流可能只给半截，历史里渲染
     *  的是完整回复；思考链能从续流捞到就带上。收尾期内被冻无害：服务端静默
     *  看护按阶梯 reload（一回合恰一次）→ 新页 hello 再领养接回。 */
    /** 锚点取证盘点（纯仪表，不碰收话）：选择器命中数、忙锚可见性、末块大文
     *  本的祖先链——类名链之外带 id/data-testid（CSS module 哈希类名不可锚，
     *  改版即换；语义锚才是取证要找的）。领养与未配锚点的站共用。 */
    function scanReplyDom() {
      const replyDesc = !site.domReplySelector ? '未配'
        : `命中${document.querySelectorAll(site.domReplySelector).length}`;
      const busyEl = site.domBusySelector ? document.querySelector(site.domBusySelector) : null;
      const busyDesc = !site.domBusySelector ? '未配'
        : !busyEl ? '命中0'
        : (() => { const r = busyEl.getBoundingClientRect();
            return `命中1 可见=${r.width > 0 && r.height > 0} 文本=${(busyEl.textContent || '').trim().slice(0, 20)}`; })();
      let chain = '（没有可见大文本块——页上可能没有会话内容）';
      // textContent 找候选（不触发重排），逐个一次 rect 验可见；跳过 captcha/waf
      // 容器（WAF 隐藏组件混进来会冒充回答块——chatglm 实案）；报前三个可见块。
      const seen = [];
      const all = document.querySelectorAll('div,section,article,p');
      for (let i = all.length - 1; i >= 0 && seen.length < 3; i--) {
        const el = all[i];
        if (/captcha|waf|audit/i.test(String(el.className || ''))) continue;
        if ((el.textContent || '').length < 120) continue;
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) continue;
        const parts = [];
        for (let a = el; a && a !== document.body && parts.length < 5; a = a.parentElement) {
          const key = a.id ? `#${a.id}`
            : (a.getAttribute?.('data-testid') ? `[data-testid="${a.getAttribute('data-testid')}"]` : '');
          const c = a.className && String(a.className).trim() ? '.' + String(a.className).trim().split(/\s+/).join('.') : '';
          parts.push(a.tagName.toLowerCase() + key + c);
        }
        seen.push(parts.join(' ← ') + `（${(el.textContent || '').length}字）`);
      }
      if (seen.length) chain = seen.join(' ｜ ');
      return `replySel ${replyDesc}，busySel ${busyDesc}；末块大文本链（叶→根）：${chain}`;
    }

    /** 领养 5s 未决=盘点一次真 DOM（2026-10-02 chatglm 卡判定实案装表）：选择器
     *  对不对让页面自己说话（坑15：探针静默失败先装仪表）。每次领养至多一拍，不扰收话。 */
    function armAdoptProbe(startedAt) {
      setTimeout(() => {
        if (!inflight || !inflight.adopted || inflight.startedAt !== startedAt) return;
        seatLog(`领养盘点：${scanReplyDom()}`);
      }, 5000);
    }

    async function adoptWait(deliveryId) {
      const startedAt = Date.now();
      inflight = { deliveryId, startedAt, adopted: true };
      armAdoptProbe(startedAt);
      try {
        const how = await awaitCompletion(startedAt);
        if (how === 'timeout') throw new Error('领养后等回复超时');
        const gate = (gateResult && gateResult.at >= startedAt) ? gateResult : null;
        const dom = lastReplyText();
        const reply = dom.trim() || (gate?.content || '').trim();
        const thinking = (gate?.thinking || '').trim();
        if (!reply) throw new Error(site.noReplyNote);
        seatLog(`查岗收割完成（${how}），正文 ${reply.length} 字${thinking ? ` / 思考 ${thinking.length} 字` : ''}`);
        report({ type: 'reply', deliveryId, text: reply, ...(thinking ? { thinking } : {}) });
      } catch (e) {
        // 领养收尾失败与收话失败同款待遇（2026-10-02 用户定案）：降级留痕，绝
        // 不是 error——服务端回合还在账上，静默看护 30s reload（额度没用完时）
        // → 新页 hello 再领养；额度用完就提醒喊人、3000s 保险丝占位跳过。
        seatLog(`收割失败（回合保活，等静默看护 reload 再领养）：${e?.message ?? e}`, 'warn');
      } finally {
        // 所有权守卫：只收自己的账（同 runDeliver——inflight 是唯一通行证）
        if (inflight && inflight.deliveryId === deliveryId) inflight = null;
      }
    }

    // ── 冻结提醒横条（remind 帧）：只喊人不自动切，全宽贴顶通知横条——所有
    //    登记站点页都会投一份（background 群发），用户看哪个页都能看见。Shadow
    //    DOM 隔离站点样式，配色镜像侧栏。───
    let freezeHost = null;
    function removeFreezeOverlay() {
      if (freezeHost) { freezeHost.remove(); freezeHost = null; }
    }
    function showFreezeOverlay(msg) {
      removeFreezeOverlay();
      const actor = String(msg.actor ?? '');
      const soul = String(msg.soul ?? '');
      // 「切过去」画不画看寻址：有 tabId 或会话引用才画——寻址全无的提醒（如
      // 唤醒失败且服务没回填引用）按钮画了也切不动，诚实 UI 不画死按钮。
      const canSwitch = Boolean(Number(msg.tabId ?? 0)) || Boolean(String(msg.sessionId ?? ''));
      const text = String(msg.message ?? '')
        || `${actor}${soul ? `（soul: ${soul}）` : ''}的页面未响应，请在浏览器切换到那个标签页，点开就能唤醒。`;
      freezeHost = document.createElement('div');
      freezeHost.setAttribute('data-femo-freeze', '');
      // all:initial 必须放在声明块最前——它展开成全部属性，写在后面会把排在前面的
      // 定位全数抹掉（实案 2026-10-02：浮层掉回文档流飘进页面中间、无层叠上下文被
      // 页面文字盖画，看起来半透明）。
      freezeHost.style.cssText = 'all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647;';
      document.documentElement.appendChild(freezeHost);
      const root = freezeHost.attachShadow({ mode: 'closed' });
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;'
        + 'padding:9px 16px;background:#0c0f12;color:#e9eef0;'
        + 'border-bottom:1px solid rgba(255,255,255,0.16);box-shadow:0 6px 24px rgba(0,0,0,0.45);'
        + 'font:13px/1.5 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;'
        + 'background-image:linear-gradient(90deg, rgba(111,191,58,0.14), transparent 30%);';
      const brand = document.createElement('span');
      brand.style.cssText = 'flex:none;font-weight:700;font-size:12px;letter-spacing:0.4px;color:#8fdd55;';
      brand.textContent = 'FEMO';
      const body = document.createElement('span');
      body.style.cssText = 'flex:1 1 auto;min-width:0;word-break:break-word;';
      body.textContent = text;
      let btnGo = null;
      if (canSwitch) {
        btnGo = document.createElement('button');
        btnGo.setAttribute('data-femo-switch', '');
        btnGo.style.cssText = 'flex:none;cursor:pointer;border-radius:8px;padding:5px 12px;font:12.5px/1.4 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;'
          + 'background:linear-gradient(135deg,#8fdd55 0%,#57b33a 100%);color:#0c0f12;font-weight:600;border:none;';
        btnGo.textContent = '切过去';
      }
      const btnCancel = document.createElement('button');
      btnCancel.setAttribute('data-femo-cancel', '');
      btnCancel.style.cssText = 'flex:none;cursor:pointer;border-radius:8px;padding:5px 10px;font:12.5px/1.4 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;'
        + 'background:transparent;color:#8b96a0;border:1px solid rgba(255,255,255,0.16);';
      btnCancel.textContent = '知道了';
      bar.append(brand, body);
      if (btnGo) bar.append(btnGo);
      bar.append(btnCancel);
      root.append(bar);
      btnCancel.addEventListener('click', () => {
        removeFreezeOverlay();
        chrome.runtime.sendMessage({ type: 'femo-freeze-action', action: 'cancel' }).catch(() => {});
      });
      if (btnGo) {
        btnGo.addEventListener('click', () => {
          removeFreezeOverlay();
          chrome.runtime.sendMessage({ type: 'femo-freeze-action', action: 'switch' }).catch(() => {});
        });
      }
    }

    // ── 与 background 的信口 ────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'web-ping') {
        // 孤儿代理不自证活着（2026-10-02 重载实案死锁）：扩展重载后，页里旧代理
        // 的运行时桥已死——发不出 hello、不能上报——但监听器还在、照样应 pong，
        // 查岗轮就以为页活着永不 reload，同运行时守卫又挡住补注入，三方僵到保险
        // 丝。应 pong 前先走一遍运行时回声：桥死了就闭嘴，让查岗轮 reload 换新。
        chrome.runtime.sendMessage({ type: 'web-ping-echo' })
          .then(() => sendResponse({ type: 'web-pong', sessionId, busy, title: sessionTitle() }))
          .catch(() => { /* 桥已死（孤儿）：不应答——patrol 会 reload 本页换新 */ });
        return true; // 异步应答
      }
      if (msg?.type === 'femo-freeze-overlay') {
        showFreezeOverlay(msg);
        return;
      }
      if (msg?.type === 'femo-freeze-overlay-hide') {
        removeFreezeOverlay();
        return;
      }
      if (msg?.type === 'femo-turn-closed') {
        // 服务端关单广播（保险丝跳过/停演/失败——节点什么时候结束只有服务端
        // 知道）：页面这边无论账在不在、重试武没武装，一律对齐放手。
        if (inflight && inflight.deliveryId === String(msg.deliveryId ?? '')) {
          inflight = null;
          seatLog(`服务端关单 ${msg.deliveryId}——回合账放手`);
        }
        cancelSendRetry?.();
        return;
      }
      if (msg?.type === 'web-deliver') {
        seatLog(`收到下发 ${msg.deliveryId}，正文 ${String(msg.text ?? '').length} 字`);
        const ack = offerDeliver(msg); // 同步受理——不为整个回合持有消息通道
        sendResponse(ack);
        return;
      }
      return undefined;
    });

    seatLog(`座席代理已上线。会话 id = ${sessionId || '（尚未生成——发过第一条消息后出现）'}`);
    seatLog(`DOM 收话兜底装配：reply=${site.domReplySelector ?? '无'} busy=${site.domBusySelector ?? '无'}`);
    if (!site.domReplySelector || !site.domBusySelector) {
      // 静默阶梯时代 DOM 锚点（回答容器/忙锚）是领养收尾的救命绳——reload 后
      // 流不重放，收结束信号全靠它（「收话只认网络闸」旧裁决已翻案）。未配齐
      // 的站每次加载 5s 后自动打一轮取证盘点（纯仪表）：候选链直接进服务日志，
      // 照单转正即可，不用等出事故。
      setTimeout(() => seatLog(`锚点取证盘点（本站锚点未配齐，领养收尾全靠它）：${scanReplyDom()}`), 5000);
    }
    if (site.logTitleCalibration) seatLog(`会话名解析校准：raw="${String(document.title).trim()}" → "${site.parseSessionTitle(document.title)}"`);

    report({ type: 'url' }); // 上线报到（sessionId 可能还没生成：空串也让服务端记账）
    helloServer(); // 领养在飞回合（查岗收割模型：reload 后接回 deliveryId 继续收结尾）
  }

  globalThis.FemoSeatCore = { createSeatAgent };
})();
