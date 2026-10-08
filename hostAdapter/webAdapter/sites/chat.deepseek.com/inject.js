/**
 * inject.js — MAIN world 网络闸（document_start，跑在页面自己的 JS 世界里）。
 *
 * 职责：把「这页 DeepSeek 说了什么」在网络上说得准——思考（CoT）与正文分两路
 * 攒，生成开始/流收话各发一信。真页面实证对话请求走 XHR 不走 fetch（fetch 闸
 * 只看得见门口），两道闸都架，共用同一套流解析器。
 *
 * 流格式两代（社区逆向实证 + 2026-09-25 真页面 diagKeys 取证）：
 *   旧格式：{"p":"response/thinking_content","v":"…"} / {"p":"response/content","v":"…"}
 *           无 p 的 {"v":"…"} 为续段，沿用上一路径
 *   新格式（现行）：片段开张帧 {"p":"response/fragments","o":"APPEND",
 *           "v":[{type:"THINK"|"RESPONSE","content":"…"}]}，其后
 *           {"p":"response/fragments/-1/content","v":"…"} 归当前片段类型的桶
 *   结束帧：{"p":"response/status","v":"FINISHED"}（流 close/loadend 亦算结束）
 * diagKeys 把流内真实键名带回日志——上游再换格式，一次下发就能取证。
 *
 * 归属：本文件住 sites/chat.deepseek.com/（站点包）——接口路径与流格式都是这家官网
 * 的事实。MAIN world 经典脚本进不了 ESM：拦的路径字面量是 site.mjs
 * COMPLETION_PATH 的镜像，改站两处同改。事实全谱见同目录 SITE.md。
 */
(() => {
  if (window.__webNetGate) return; // 脚本被重复注入时静默退出
  window.__webNetGate = true;

  const emit = detail => {
    try { window.dispatchEvent(new CustomEvent('web-net', { detail })); } catch { /* 事件派发不可失败 */ }
  };

  // 逐字流（草稿轨）：解析器快照有变就发 delta——全量快照不带算子，content.js
  // 节流后上报服务端喂 hub 草稿层。start 时清长度指纹，防上轮残留压住本轮第一拍。
  let deltaLen = -1;
  const emitDelta = (thinking, content) => {
    const n = (thinking?.length ?? 0) + (content?.length ?? 0);
    if (n === deltaLen) return;
    deltaLen = n;
    emit({ phase: 'delta', thinking: String(thinking ?? ''), content: String(content ?? ''), ts: Date.now() });
  };

  /** 流解析器工厂：fetch 闸与 XHR 闸各持一份状态，喂 data 行即可。 */
  function makeParser() {
    const st = { lastKey: null, fragmentType: null, thinking: '', content: '', finished: false, diag: new Set() };
    const bucket = (type, text) => { if (type === 'THINK') st.thinking += text; else st.content += text; };
    function handleObj(obj) {
      const val = obj?.v;
      const path = typeof obj?.p === 'string' ? obj.p : '';
      if (val !== null && typeof val === 'object') {
        st.diag.add(path || '(meta)');
        // 片段开张帧：v 是片段对象数组，类型与首段内容都在里面
        if (path === 'response/fragments' && Array.isArray(val)) {
          for (const frag of val) {
            if (frag && typeof frag === 'object') {
              if (typeof frag.type === 'string' && frag.type) st.fragmentType = frag.type;
              if (typeof frag.content === 'string' && frag.content) bucket(st.fragmentType, frag.content);
            }
          }
          return;
        }
        // 元数据帧：{"v":{"response":{...}}}——批内 fragments 带 type+content
        const resp = val.response;
        if (resp && typeof resp === 'object' && Array.isArray(resp.fragments)) {
          for (const frag of resp.fragments) {
            if (frag && typeof frag === 'object') {
              if (typeof frag.type === 'string' && frag.type) st.fragmentType = frag.type;
              if (typeof frag.content === 'string' && frag.content) bucket(st.fragmentType, frag.content);
            }
          }
        }
        return;
      }
      if (typeof val !== 'string' || val === '') return;
      st.diag.add(path || '(continuation)');
      // 新格式：最新片段的正文，按片段类型归桶（类型未知按 RESPONSE，宁缺勿混的同义面=正文兜底）
      if (path === 'response/fragments/-1/content') { bucket(st.fragmentType ?? 'RESPONSE', val); return; }
      // 旧格式双键
      if (path === 'response/content') { st.content += val; st.lastKey = path; return; }
      if (path === 'response/thinking_content') { st.thinking += val; st.lastKey = path; return; }
      if (path === 'response/status') { if (val === 'FINISHED') st.finished = true; return; }
      if (path) return; // 其他路径（耗时统计等）只记 diag
      // 无 p 续段：新格式按片段类型，旧格式按上一路径
      if (st.fragmentType !== null) { bucket(st.fragmentType, val); return; }
      if (st.lastKey === 'response/thinking_content') { st.thinking += val; return; }
      if (st.lastKey === 'response/content') { st.content += val; return; }
    }
    return {
      st,
      feedLine(line) {
        const t = line.trim();
        if (!t.startsWith('data:')) return;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        try { handleObj(JSON.parse(payload)); } catch { /* 心跳等非 JSON 行忽略 */ }
      },
    };
  }

  // ── fetch 闸 ────────────────────────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
    // 探针：页面调了哪些自家接口（含非 completion 的），逐个上报取证。
    if (typeof url === 'string' && url.includes('/api/')) emit({ phase: 'api', url: String(url).slice(0, 140), ts: Date.now() });
    const res = await origFetch.apply(this, args);
    try {
      if (typeof url === 'string' && url.includes('/api/v0/chat/completion')) {
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
                emitDelta(parser.st.thinking, parser.st.content);
              },
              close() {
                if (buf.trim()) parser.feedLine(buf);
                emit({ phase: 'completed', thinking: parser.st.thinking, content: parser.st.content, finished: parser.st.finished, diagKeys: [...parser.st.diag], ts: Date.now() });
              },
            }))
            .catch(() => emit({ phase: 'completed', thinking: parser.st.thinking, content: parser.st.content, finished: parser.st.finished, diagKeys: [...parser.st.diag], ts: Date.now() }));
          // 把留给自己页面的那份原样还回去（status/headers 保真）
          return new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        emit({ phase: 'done', ts: Date.now() }); // 非 SSE 形态（JSON 报错等）= 即时结束
      }
    } catch { /* 网络闸绝不干扰页面本体：任何异常都放行原响应 */ }
    return res;
  };

  // ── XHR 闸（真页面实证：对话请求走 XHR——fetch 闸只看得见门口）────────
  // open 记 URL（api 探针在此取证）；send 里对 completion 请求挂 progress
  // 监听，responseText 增量部分接进行缓冲，流结束（loadend）一次性 emit。
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      const u = typeof url === 'string' ? url : String(url);
      this.__webUrl = u;
      if (u.includes('/api/')) emit({ phase: 'api', url: u.slice(0, 140), ts: Date.now() });
    } catch { /* 探针绝不干扰页面 */ }
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    try {
      const u = String(xhr.__webUrl ?? '');
      if (u.includes('/api/v0/chat/completion')) {
        emit({ phase: 'start', ts: Date.now() });
        deltaLen = -1;
        const parser = makeParser();
        let buf = '';
        let lastLen = 0;
        xhr.addEventListener('progress', () => {
          try {
            const text = xhr.responseText ?? ''; // responseType 非 text 时会抛，接住即可
            if (text.length <= lastLen) return;
            buf += text.slice(lastLen); // SSE 响应只追加，增量接缓冲
            lastLen = text.length;
            let idx;
            while ((idx = buf.indexOf('\n')) >= 0) { parser.feedLine(buf.slice(0, idx)); buf = buf.slice(idx + 1); }
            emitDelta(parser.st.thinking, parser.st.content);
          } catch { /* responseType 非 text：解析不了就只在 loadend 报个空 */ }
        });
        xhr.addEventListener('loadend', () => {
          if (buf.trim()) parser.feedLine(buf);
          emit({ phase: 'completed', thinking: parser.st.thinking, content: parser.st.content, finished: parser.st.finished, diagKeys: [...parser.st.diag], ts: Date.now() });
        });
      }
    } catch { /* 闸绝不干扰页面本体 */ }
    return origSend.call(this, body);
  };
})();
