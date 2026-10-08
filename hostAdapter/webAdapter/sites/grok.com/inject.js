/**
 * inject.js — Grok 网络闸（MAIN world，document_start）。2026-09-29 四轮探针取证当日转正。
 *
 * 职责：把「这页 Grok 说了什么」在网络上说得准。本站补全**不走 fetch/XHR**
 * （R1 定谳：两道闸只看得见历史加载，补全本体零经过）——走 **WebSocket**：
 * 页面开场即接 wss://grok.com/ws/mgw/?uid=…，全部对话以事件制 JSON 帧在此
 * 通道上流过。本闸包装 WebSocket 构造器，给每只新建的连接补装消息旁听
 * （onmessage setter + addEventListener 双路），按事件类型分桶攒话。
 *
 * 流格式（四轮取证原话见 SITE.md）——一条 WS message 可能**背靠背拼多个事
 * 件**（裸 JSON 连排，R4 实证），先按平衡扫描逐事件拆再喂解析器：
 *   response.created            回合开始（本闸据此发 'start'，重开解析器）；
 *   response.chunk              增量帧：chunk.text.text=逐字增量，
 *                               chunk.text.channel 分型——
 *                               CHANNEL_ASSISTANT_RESPONSE=正文（进 content）、
 *                               CHANNEL_ASSISTANT_NOTETAKER_HEADER=思考摘要
 *                               （进 thinking；用户拍板「能收到就收」）；
 *                               无 text 的帧（ui_layout/phase_marker）不进话；
 *   response.output_text.done / response.content_part.done /
 *   response.output_item.done  收尾三连（各自带终值，本闸只看 response.done）；
 *   response.done               **权威结束**（status=completed）；
 *   conversation.history.item   页面加载时的历史重放（含完整 output_chunks），
 *                               不进话——座席只收直播回合。
 * 思考分型口径（R4 探针实证 + 用户拍板）：协议里思考文本可见
 * （NOTETAKER 通道），照收进 thinking；正文与思考天然分桶不混。
 *
 * 会话名：document.title 恒「Grok」是死的——会话清单/详情 GET 响应搭车
 * （树里「uuid 形 id + title」同体的对象都收，chatgpt 包同款通用走法；字段
 * 名未逐一取证，收不到就落「无标题会话」，无害）。
 *
 * api 探针保留（/rest/app-chat/ 前缀逐条上报）：上游换格式一次下发就能取证。
 */
(() => {
  if (window.__webNetGate) return; // 脚本被重复注入时静默退出
  window.__webNetGate = true;

  const API_PROBE = '/rest/app-chat/';
  const TITLES_RIDE = '/rest/app-chat/conversations'; // 清单 GET 与详情 conversations_v2/<id> 的公共前缀
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  const emit = detail => {
    try { window.dispatchEvent(new CustomEvent('web-net', { detail })); } catch { /* 事件派发不可失败 */ }
  };

  // 逐字流（草稿轨）：解析器快照有变就发 delta——全量快照，content.js 节流后
  // 上报服务端喂 hub 草稿层。start 时清长度指纹，防上轮残留压住本轮第一拍。
  let deltaLen = -1;
  const emitDelta = (thinking, content) => {
    const n = (thinking?.length ?? 0) + (content?.length ?? 0);
    if (n === deltaLen) return;
    deltaLen = n;
    emit({ phase: 'delta', thinking: String(thinking ?? ''), content: String(content ?? ''), ts: Date.now() });
  };

  /** 按平衡扫描把一条 message 里的连排 JSON 对象逐个拆出（R4 实证一条
   *  message 背靠背拼多事件；字符串里的引号/花括号要绕开）。残尾留缓冲。 */
  function* splitEvents(buf) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = -1;
    for (let i = 0; i < buf.length; i += 1) {
      const c = buf[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === '{') { if (depth === 0) start = i; depth += 1; continue; }
      if (c === '}') {
        depth -= 1;
        if (depth === 0 && start >= 0) { yield buf.slice(start, i + 1); start = -1; }
      }
    }
  }

  /** 流解析器：事件制，按 channel 分桶；只认直播回合（response.created 开新
   *  轮，历史重放不进话）。 */
  function makeParser() {
    let thinking = '';
    let content = '';
    let finished = false;
    let live = false; // response.created 之后=直播回合

    function handleEvent(ev) {
      const type = ev?.type;
      if (type === 'response.created') {
        live = true;
        thinking = '';
        content = '';
        finished = false;
        deltaLen = -1;
        emit({ phase: 'start', path: location.pathname, ts: Date.now() });
        return;
      }
      if (!live) return; // 历史重放等一切回合外事件不进话
      if (type === 'response.chunk') {
        const text = ev?.chunk?.text;
        if (!text || typeof text.text !== 'string') return; // ui_layout/phase_marker 帧不进话
        if (text.channel === 'CHANNEL_ASSISTANT_RESPONSE') content += text.text;
        else if (text.channel === 'CHANNEL_ASSISTANT_NOTETAKER_HEADER') thinking += text.text;
        // 其余通道（搜索结果等旁支）不进话
        return;
      }
      if (type === 'response.done') {
        finished = ev?.response?.status !== 'failed';
        emit({ phase: 'completed', thinking, content, finished, ts: Date.now() });
        live = false;
      }
    }

    return {
      get thinking() { return thinking; },
      get content() { return content; },
      get finished() { return finished; },
      feedChunk(text) {
        for (const raw of splitEvents(String(text ?? ''))) {
          let ev;
          try { ev = JSON.parse(raw); } catch { /* 非完整 JSON 忽略 */ }
          if (ev) handleEvent(ev?.event ?? ev);
        }
      },
    };
  }

  // ── 会话名搭车：会话清单/详情 GET 响应里「uuid 形 id + title」同体的对象
  //    都收进清单，整包发一信（chatgpt 包同款通用走法）。
  function emitTitles(text) {
    let json;
    try { json = JSON.parse(text); } catch { return; }
    const titles = {};
    (function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 6) return;
      if (Array.isArray(node)) { for (const x of node) walk(x, depth + 1); return; }
      const id = typeof node.conversationId === 'string' ? node.conversationId
        : typeof node.id === 'string' ? node.id : '';
      if (id && UUID_RE.test(id) && typeof node.title === 'string' && node.title.trim()) {
        titles[id] = node.title.trim();
      }
      for (const v of Object.values(node)) walk(v, depth + 1);
    })(json, 0);
    if (Object.keys(titles).length) emit({ phase: 'titles', titles, ts: Date.now() });
  }

  // ── WebSocket 闸：包装构造器，给每只新连接补装消息旁听 ────────────────
  //    本站补全走 WS（fetch/XHR 两道闸看不见），这是本站唯一的闸。
  try {
    const OrigWS = window.WebSocket;
    function PatchedWS(url, protocols) {
      const sock = protocols === undefined ? new OrigWS(url) : new OrigWS(url, protocols);
      try {
        const parser = makeParser();
        let buf = '';
        const origAdd = sock.addEventListener?.bind(sock);
        if (origAdd) {
          sock.addEventListener = function (type, fn, opts) {
            try {
              if (String(type) === 'message' && typeof fn === 'function') {
                const wrapped = ev => {
                  try {
                    if (typeof ev?.data === 'string') {
                      buf += ev.data;
                      for (const piece of splitEvents(buf)) parser.feedChunk(piece);
                      buf = ''; // 整段送进扫描器：残尾由下一次 message 接上
                      emitDelta(parser.thinking, parser.content);
                    }
                  } catch { /* 闸绝不干扰页面 */ }
                  return fn.call(this, ev);
                };
                return origAdd('message', wrapped, opts);
              }
            } catch { /* 闸绝不干扰页面 */ }
            return origAdd(type, fn, opts);
          };
        }
        // onmessage 直赋值的站也要接得住：defineProperty 包 setter
        const desc = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
        if (desc && desc.set) {
          const origSet = desc.set;
          Object.defineProperty(sock, 'onmessage', {
            set(fn) {
              try {
                origSet.call(this, function (ev) {
                  try {
                    if (typeof ev?.data === 'string') {
                      buf += ev.data;
                      for (const piece of splitEvents(buf)) parser.feedChunk(piece);
                      buf = '';
                      emitDelta(parser.thinking, parser.content);
                    }
                  } catch { /* 闸绝不干扰页面 */ }
                  return fn.call(this, ev);
                });
              } catch { try { origSet.call(this, fn); } catch { /* 放弃 */ } }
            },
            get: desc.get,
            configurable: true,
          });
        }
        if (origAdd) origAdd('message', ev => {
          // 兜底旁路：页面两条路都没挂时这里也喂（双喂无害——解析器按回合
          // 重开，重复 completed 幂等）。
          try {
            if (typeof ev?.data === 'string') {
              buf += ev.data;
              for (const piece of splitEvents(buf)) parser.feedChunk(piece);
              buf = '';
              emitDelta(parser.thinking, parser.content);
            }
          } catch { /* 闸绝不干扰页面 */ }
        });
      } catch { /* 闸绝不干扰页面 */ }
      return sock;
    }
    PatchedWS.prototype = OrigWS.prototype;
    window.WebSocket = PatchedWS;
  } catch { /* WS 闸装不上就算了——本站无备选通道，座席会大声失败 */ }

  // ── fetch 闸（补全不走此道；只伺候会话名搭车与 api 探针）────────────────
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
    const method = String(args[1]?.method ?? args[0]?.method ?? 'GET').toUpperCase();
    try { if (typeof url === 'string' && url.includes(API_PROBE)) emit({ phase: 'api', url: String(url).slice(0, 140), ts: Date.now() }); } catch { /* 探针绝不干扰页面 */ }
    const res = await origFetch.apply(this, args);
    try {
      if (typeof url === 'string' && url.includes(TITLES_RIDE)) {
        res.clone().text().then(t => emitTitles(t)).catch(() => { /* 搭车失败不干扰页面 */ });
      }
    } catch { /* 网络闸绝不干扰页面本体：任何异常都放行原响应 */ }
    return res;
  };

  // ── XHR 闸（同上，常备预防）────────────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      const u = typeof url === 'string' ? url : String(url);
      this.__webUrl = u;
      if (u.includes(API_PROBE)) emit({ phase: 'api', url: u.slice(0, 140), ts: Date.now() });
    } catch { /* 探针绝不干扰页面 */ }
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    try {
      const u = String(xhr.__webUrl ?? '');
      if (u.includes(TITLES_RIDE)) {
        xhr.addEventListener('loadend', () => {
          try { emitTitles(String(xhr.responseText ?? '')); } catch { /* 搭车失败不干扰页面 */ }
        });
      }
    } catch { /* 闸绝不干扰页面本体 */ }
    return origSend.call(this, body);
  };
})();
