/**
 * inject.js — ChatGLM 网络闸（MAIN world，document_start）。
 *
 * 职责：把「这页 ChatGLM 说了什么」在网络上说得准——思考与正文分两路攒，
 * 生成开始/流收话各发一信。补全接口实证为 POST /chatglm/backend-api/assistant/
 * stream（2026-09-27 真页取证）；fetch 与 XHR 两道闸都架，共用同一套流解析器。
 *
 * 流格式（真页取证原话见 SITE.md）：SSE `data: <整条消息快照>`；parts[] 内容
 * 分型——type:think（思考，.think 字段）/ type:text（正文，.text 字段）/
 * type:tool_calls（内部信号，忽略）。中间帧是增量；part.status==='finish'
 * 的帧带该段全文（覆盖不叠加）。顶层 status==='finish' = 生成结束。
 *
 * api 探针保留（同 deepseek 包的理由）：上游换格式/换接口，一次下发就能取证。
 */
(() => {
  if (window.__webNetGate) return; // 脚本被重复注入时静默退出
  window.__webNetGate = true;

  const COMPLETION = '/chatglm/backend-api/assistant/stream';

  const emit = detail => {
    try { window.dispatchEvent(new CustomEvent('web-net', { detail })); } catch { /* 事件派发不可失败 */ }
  };

  // 逐字流（草稿轨）：解析器快照有变就发 delta——全量快照不带算子（finish 帧
  // 的整段覆盖天然被快照语义消化），content.js 节流后上报服务端喂 hub 草稿层。
  // start 时清长度指纹，防上轮残留压住本轮第一拍。
  let deltaLen = -1;
  const emitDelta = (thinking, content) => {
    const n = (thinking?.length ?? 0) + (content?.length ?? 0);
    if (n === deltaLen) return;
    deltaLen = n;
    emit({ phase: 'delta', thinking: String(thinking ?? ''), content: String(content ?? ''), ts: Date.now() });
  };

  /** 流解析器：按段（logic_id）攒，段完成帧覆盖为全文，顶层 finish 收卷。 */
  function makeParser() {
    const parts = new Map(); // logic_id → {type:'think'|'text', text, done}
    const order = [];
    let finished = false;
    function handleObj(obj) {
      if (obj && Array.isArray(obj.parts)) {
        for (const p of obj.parts) {
          const key = p?.logic_id || p?.id || '';
          if (!key) continue;
          if (!parts.has(key)) {
            parts.set(key, { type: 'think', text: '', done: false });
            order.push(key);
          }
          const rec = parts.get(key);
          const done = p?.status === 'finish';
          for (const c of (Array.isArray(p?.content) ? p.content : [])) {
            if (c?.type === 'think' && typeof c.think === 'string') {
              rec.text = done ? c.think : rec.text + c.think;
            } else if (c?.type === 'text' && typeof c.text === 'string') {
              rec.type = 'text';
              rec.text = done ? c.text : rec.text + c.text;
            }
            // type:tool_calls（内部 finish 信号等）不进话
          }
          if (done) rec.done = true;
        }
      }
      if (obj?.status === 'finish') finished = true;
    }
    const byType = type => order.filter(k => parts.get(k).type === type).map(k => parts.get(k).text).join('');
    return {
      get thinking() { return byType('think'); },
      get content() { return byType('text'); },
      get finished() { return finished; },
      feedLine(line) {
        const t = line.trim();
        if (!t.startsWith('data:')) return;
        const payload = t.slice(5).trim();
        if (!payload) return;
        try { handleObj(JSON.parse(payload)); } catch { /* 心跳等非 JSON 行忽略 */ }
      },
    };
  }

  // ── 会话名搭车（SPA 标题恒为「智谱清言」不随会话变——实测，会话名只能
  //    从页面自取的会话清单响应里收）：recent_list 等响应过闸时，树里任何
  //    同时带 conversation_id 与 title 的对象都收进清单，整包发一信。
  function emitTitles(text) {
    let json;
    try { json = JSON.parse(text); } catch { return; }
    const titles = {};
    (function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 6) return;
      if (Array.isArray(node)) { for (const x of node) walk(x, depth + 1); return; }
      if (typeof node.conversation_id === 'string' && typeof node.title === 'string' && node.title.trim()) {
        titles[node.conversation_id] = node.title;
      }
      for (const v of Object.values(node)) walk(v, depth + 1);
    })(json, 0);
    if (Object.keys(titles).length) emit({ phase: 'titles', titles, ts: Date.now() });
  }

  // ── fetch 闸 ────────────────────────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
    // 探针：页面调了哪些自家接口（按 URL 去重，只记一遍）——上游换接口一次下发就能取证。
    if (typeof url === 'string' && url.includes('-api/')) emit({ phase: 'api', url: String(url).slice(0, 140), ts: Date.now() });
    const res = await origFetch.apply(this, args);
    try {
      if (typeof url === 'string' && url.includes('/mainchat-api/conversation/')) {
        res.clone().text().then(t => emitTitles(t)).catch(() => { /* 搭车失败不干扰页面 */ });
      }
      if (typeof url === 'string' && url.includes(COMPLETION)) {
        emit({ phase: 'start', path: location.pathname, ts: Date.now() });
        deltaLen = -1;
        const ct = res.headers?.get?.('content-type') ?? '';
        if (ct.includes('text/event-stream') && res.body) {
          const [keep, probe] = res.body.tee();
          const parser = makeParser();
          let buf = '';
          probe
            .pipeThrough(new TextDecoderStream())
            .pipeTo(new WritableStream({
              write(chunk) {
                buf += chunk;
                let idx;
                while ((idx = buf.indexOf('\n')) >= 0) { // 跨 chunk 缓冲：一行可能被拆在两片里
                  parser.feedLine(buf.slice(0, idx));
                  buf = buf.slice(idx + 1);
                }
                emitDelta(parser.thinking, parser.content);
              },
              close() {
                if (buf.trim()) parser.feedLine(buf);
                emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ts: Date.now() });
              },
            }))
            .catch(() => emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ts: Date.now() }));
          // 把留给自己页面的那份原样还回去（status/headers 保真）
          return new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        emit({ phase: 'done', ts: Date.now() }); // 非 SSE 形态（JSON 报错等）= 即时结束
      }
    } catch { /* 网络闸绝不干扰页面本体：任何异常都放行原响应 */ }
    return res;
  };

  // ── XHR 闸（真站走哪条通道以页面为准，两道都架）────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      const u = typeof url === 'string' ? url : String(url);
      this.__webUrl = u;
      if (u.includes('-api/')) emit({ phase: 'api', url: u.slice(0, 140), ts: Date.now() });
    } catch { /* 探针绝不干扰页面 */ }
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    try {
      const u = String(xhr.__webUrl ?? '');
      if (u.includes('/mainchat-api/conversation/')) {
        xhr.addEventListener('loadend', () => {
          try { emitTitles(String(xhr.responseText ?? '')); } catch { /* 搭车失败不干扰页面 */ }
        });
      }
      if (u.includes(COMPLETION)) {
        emit({ phase: 'start', ts: Date.now() });
        deltaLen = -1;
        const parser = makeParser();
        let buf = '';
        let lastLen = 0;
        xhr.addEventListener('progress', () => {
          try {
            const text = xhr.responseText ?? '';
            if (text.length <= lastLen) return;
            buf += text.slice(lastLen);
            lastLen = text.length;
            let idx;
            while ((idx = buf.indexOf('\n')) >= 0) { parser.feedLine(buf.slice(0, idx)); buf = buf.slice(idx + 1); }
            emitDelta(parser.thinking, parser.content);
          } catch { /* responseType 非 text：解析不了就只在 loadend 报个空 */ }
        });
        xhr.addEventListener('loadend', () => {
          if (buf.trim()) parser.feedLine(buf);
          emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ts: Date.now() });
        });
      }
    } catch { /* 闸绝不干扰页面本体 */ }
    return origSend.call(this, body);
  };
})();
