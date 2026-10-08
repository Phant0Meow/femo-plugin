/**
 * inject.js — Kimi 网络闸（MAIN world，document_start）。2026-09-28 转正。
 *
 * 职责：把「这页 Kimi 说了什么」在网络上说得准。补全接口实证为
 * POST /apiv2/kimi.gateway.chat.v1.ChatService/Chat（真页取证）；fetch 与
 * XHR 两道闸都架（本站对话实证走 fetch，XHR 闸常备预防），共用一套流解析器。
 *
 * 流格式（真页取证原话见 SITE.md）：**Connect 协议分帧**——content-type
 * application/connect+json，每帧 = 1 字节 flags + 4 字节大端长度 + JSON 载荷。
 * 语义层是状态同步（op set/append + mask）：
 *   mask block.think.content           思考增量（append=加一笔，set=全量）；
 *   mask block.text.content            正文增量（同上）；
 *   mask message.status = COMPLETED    结束信号之一；
 *   {done:{}} 帧 / flags 结束帧         结束信号之二三（三层保险，见其一即收）；
 *   {heartbeat:{}} 帧                   心跳，不进话。
 *
 * 本站习性（取证实录，正式闸同守）：页面在每条 RPC 完成瞬间 abort 自己的
 * 请求 signal，clone/tee 出来的分支共享中断态——所以一律**增量排空**：边流
 * 边攒，中断时手头已到手的字就是全部（abort 前流已放完）。
 *
 * api 探针保留（/apiv2/ 前缀逐条上报）：上游换格式，一次下发就能取证。
 */
(() => {
  if (window.__webNetGate) return; // 脚本被重复注入时静默退出
  window.__webNetGate = true;

  const COMPLETION = '/apiv2/kimi.gateway.chat.v1.ChatService/Chat';
  const API_PROBE = '/apiv2/';

  const emit = detail => {
    try { window.dispatchEvent(new CustomEvent('web-net', { detail })); } catch { /* 事件派发不可失败 */ }
  };

  // 逐字流（草稿轨）：解析器快照有变就发 delta——全量快照不带算子（op set 的
  // 整段覆盖天然被快照语义消化），content.js 节流后上报服务端喂 hub 草稿层。
  // start 时清长度指纹，防上轮残留压住本轮第一拍。
  let deltaLen = -1;
  const emitDelta = (thinking, content) => {
    const n = (thinking?.length ?? 0) + (content?.length ?? 0);
    if (n === deltaLen) return;
    deltaLen = n;
    emit({ phase: 'delta', thinking: String(thinking ?? ''), content: String(content ?? ''), ts: Date.now() });
  };

  /** 流解析器：字节级拆 Connect 信封（5 字节二进制头经文本解码会失真，必须
   *  在字节上拆），载荷 JSON 按语义分型攒话。 */
  function makeParser() {
    let thinking = '';
    let content = '';
    let finished = false;

    function handlePayload(text, flags) {
      let obj;
      try { obj = JSON.parse(text); } catch { /* 非 JSON 帧（如空载荷）忽略 */ }
      if (!obj || typeof obj !== 'object') return;
      if (obj.done) { finished = true; return; }
      if (obj.message?.status === 'MESSAGE_STATUS_COMPLETED') finished = true;
      const block = obj.block;
      if (!block) return;
      const mask = obj.mask;
      const append = obj.op === 'append';
      if (mask === 'block.think.content' && typeof block.think?.content === 'string') {
        thinking = append ? thinking + block.think.content : block.think.content;
      } else if (mask === 'block.text.content' && typeof block.text?.content === 'string') {
        content = append ? content + block.text.content : block.text.content;
      } else if (mask === 'block.think' && typeof block.think?.content === 'string') {
        thinking = block.think.content; // 整块 set=全量
      } else if (mask === 'block.text' && typeof block.text?.content === 'string') {
        content = block.text.content;
      }
    }

    return {
      get thinking() { return thinking; },
      get content() { return content.trim(); },
      get finished() { return finished; },
      /** 喂一段字节：按信封拆帧（1 字节 flags + 4 字节大端长度 + 载荷）。 */
      feed(bytes) {
        let buf = bytes;
        for (;;) {
          if (buf.length < 5) return buf;
          const len = ((buf[1] << 24) | (buf[2] << 16) | (buf[3] << 8) | buf[4]) >>> 0;
          if (buf.length < 5 + len) return buf;
          const flags = buf[0];
          const payload = new TextDecoder().decode(buf.subarray(5, 5 + len));
          if (flags & 0x02) finished = true; // Connect 结束帧（trailers）
          handlePayload(payload, flags);
          buf = buf.slice(5 + len);
        }
      },
    };
  }

  // ── fetch 闸（本站对话的实证通道）────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
    try { if (typeof url === 'string' && url.includes(API_PROBE)) emit({ phase: 'api', url: String(url).slice(0, 140), ts: Date.now() }); } catch { /* 探针绝不干扰页面 */ }
    const res = await origFetch.apply(this, args);
    try {
      if (typeof url === 'string' && url.includes(COMPLETION)) {
        emit({ phase: 'start', path: location.pathname, ts: Date.now() });
        deltaLen = -1;
        const ct = res.headers?.get?.('content-type') ?? '';
        if (res.body && (ct.includes('application/connect+json') || ct.includes('text/event-stream'))) {
          // tee 一份旁听，页面拿原样那份（status/headers 保真）
          const [keep, probe] = res.body.tee();
          const parser = makeParser();
          // 增量排空（本站习性：页面完成即 abort，tee 分支共享中断态——
          // 边流边攒，中断时手头就是全部；绝不干扰页面）
          (async () => {
            let buf = new Uint8Array(0);
            try {
              const reader = probe.getReader();
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                const merged = new Uint8Array(buf.length + value.length);
                merged.set(buf); merged.set(value, buf.length);
                buf = parser.feed(merged);
                emitDelta(parser.thinking, parser.content);
              }
            } catch { /* 中断：流已放完，手头即全部 */ }
            emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ts: Date.now() });
          })();
          return new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        emit({ phase: 'done', ts: Date.now() }); // 非 SSE/Connect 形态（JSON 报错等）= 即时结束
      }
    } catch { /* 网络闸绝不干扰页面本体：任何异常都放行原响应 */ }
    return res;
  };

  // ── XHR 闸（常备预防；本站对话实证走 fetch）─────────────────────────
  // 文本通道里 5 字节二进制头退化为控制字符，按「读到顶层 JSON 才解析」的
  // 粗 Extraction 兜底：偶尔会被恰好等于 123/34 字节的帧长（0x7B/0x22）骗到
  // 丢一帧——预防通道可接受，主通道（fetch）走上面的字节级精确拆封。
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
      if (u.includes(COMPLETION)) {
        emit({ phase: 'start', ts: Date.now() });
        deltaLen = -1;
        let thinking = '';
        let content = '';
        let finished = false;
        let buf = '';
        let depth = 0; let start = -1; let inStr = false; let esc = false;
        const handleText = text => {
          let obj; try { obj = JSON.parse(text); } catch { return; }
          if (obj?.done) finished = true;
          if (obj?.message?.status === 'MESSAGE_STATUS_COMPLETED') finished = true;
          const block = obj?.block; if (!block) return;
          const append = obj.op === 'append';
          if (obj.mask === 'block.think.content' && typeof block.think?.content === 'string') thinking = append ? thinking + block.think.content : block.think.content;
          else if (obj.mask === 'block.text.content' && typeof block.text?.content === 'string') content = append ? content + block.text.content : block.text.content;
        };
        const lastLen = { n: 0 };
        xhr.addEventListener('progress', () => {
          try {
            const text = xhr.responseText ?? '';
            if (text.length <= lastLen.n) return;
            buf += text.slice(lastLen.n);
            lastLen.n = text.length;
            for (let i = 0; i < buf.length; i++) {
              const ch = buf[i];
              if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
              if (ch === '"') { inStr = true; continue; }
              if (ch === '{') { if (depth === 0) start = i; depth++; continue; }
              if (ch === '}') { depth--; if (depth === 0 && start >= 0) { handleText(buf.slice(start, i + 1)); start = -1; } }
            }
            buf = (depth > 0 && start >= 0) ? buf.slice(start) : '';
            emitDelta(thinking, content);
          } catch { /* responseType 非 text：解析不了就只在 loadend 报个空 */ }
        });
        xhr.addEventListener('loadend', () => {
          emit({ phase: 'completed', thinking, content: content.trim(), finished, ts: Date.now() });
        });
      }
    } catch { /* 闸绝不干扰页面本体 */ }
    return origSend.call(this, body);
  };
})();
