/**
 * inject.js — 千问网络闸（MAIN world，document_start）。2026-09-29 六轮探针取证当日转正。
 *
 * 职责：把「这页千问说了什么」在网络上说得准。补全接口实证为
 * POST chat2.qianwen.com/api/v2/chat（请求打独立子域；查询参数照页面原样），
 * fetch 与 XHR 两道闸都架（本站对话实证走 fetch，XHR 闸常备预防），共用一套
 * 流解析器。
 *
 * 流格式（六轮取证原话见 SITE.md）：SSE（content-type=text/event-stream）；
 * **一条 chunk 里多个 data: 帧背靠背**（帧间 `}\n\ndata:`），按 data: 边界
 * 拆帧逐帧 parse；载荷=data.{...}，messages[] 按帧型走：
 *   mime_type=signal/post        首帧元数据（意图分类/黑名单），不进话；
 *   mime_type=bar/workflow       思考面板：meta_data.multi_load[] 各步
 *                                type=bar_thinking，content.body=思考文本、
 *                                title=步名、status=processing|complete——
 *                                **覆盖式全量快照**（后帧含前帧），直接覆盖
 *                                思考缓冲（按 source_seq 各步拼行）；
 *                                deep_think_generate="1"=本轮开了思考；
 *   mime_type=multi_load/iframe  正文：meta_data.multi_load[0].content=
 *                                正文 markdown **全量快照（覆盖式）**，直接
 *                                覆盖正文缓冲（R6 定谳：content 字段，首帧
 *                                first_packet=true）；
 *   data.sse_end="1"            **权威结束**（尾帧）；
 *   data.communication.resid    流内序号（递增，可用于丢弃乱序旧帧）。
 * 思考收集（用户拍板「能收就收」）：bar_thinking 文本照收进 thinking；
 * 收不到（上游改版）就落空，无害。
 *
 * 会话名双来源：document.title 恒「千问-阿里 AI 助手」是死的（R1 标题快照
 * 实证）——会话详情/清单 POST 响应搭车（/api/v1/session/get 与 page/list，
 * 树里 session_id+title 同体的对象都收；R1 实证 session/get 响应带
 * data.title）+ 流内 bar/workflow 无标题字段不搭车。由 inject.js 收拢成
 * web-net 'titles' 帧交座席骨架对号。
 *
 * api 探针保留（/api/ 前缀逐条上报）：上游换格式一次下发就能取证。
 */
(() => {
  if (window.__webNetGate) return; // 脚本被重复注入时静默退出
  window.__webNetGate = true;

  const COMPLETION = '/api/v2/chat';
  const TITLES_RIDE = '/api/v1/session/'; // 详情 get 与清单 page/list 的公共前缀（都是 POST）
  const API_PROBE = '/api/';

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

  /** 流解析器：帧型分桶；思考与正文都是覆盖式全量快照，直接覆盖缓冲。
   *  解析不了的帧与没见过的 mime 不再静默：记进 notes，随 completed 的
   *  diagKeys 上报（2026-10-03 实案：流 0.4s 早夭、正文 0 字而页面在渲染
   *  ——正文到底坐哪型帧，全靠这条留痕定谳）。 */
  function makeParser() {
    let thinkingParts = new Map(); // source_seq → {title, body, status}
    let thinkingOrder = [];
    let content = '';
    let finished = false;
    let sawData = false;
    const notes = []; // 诊断留痕（随 completed 上报；名额有限防长流刷屏）
    let dropLogged = 0;
    const seenMimes = new Set(); // 已留痕的未知 mime（一名一拍）

    function handleFrame(obj) {
      const data = obj?.data ?? obj; // 载荷=data.{...}（容裸形）
      if (!data || typeof data !== 'object') {
        if (dropLogged < 3) { dropLogged += 1; notes.push(`帧形不认识（前100字）${JSON.stringify(obj)?.slice(0, 100) ?? ''}`); }
        return;
      }
      if (data.sse_end === '1' || data.sse_end === 1) { finished = true; return; }
      const msgs = Array.isArray(data?.messages) ? data.messages : [];
      if (!msgs.length) {
        if (dropLogged < 3) { dropLogged += 1; notes.push(`无 messages 的帧（键 ${Object.keys(data).slice(0, 5).join(',') || '无'}）`); }
        return;
      }
      for (const msg of msgs) {
        const mime = String(msg?.mime_type ?? '');
        const meta = msg?.meta_data ?? {};
        if (mime === 'bar/workflow') {
          // 思考面板：multi_load[] 各步覆盖式快照——按 source_seq 收步、整包重排
          const loads = Array.isArray(meta?.multi_load) ? meta.multi_load : [];
          for (const step of loads) {
            if (step?.type !== 'bar_thinking') continue;
            const seq = String(step?.source_seq ?? '');
            if (!seq) continue;
            if (!thinkingParts.has(seq)) thinkingOrder.push(seq);
            thinkingParts.set(seq, {
              title: String(step?.content?.title ?? ''),
              body: String(step?.content?.body ?? ''),
              status: String(step?.content?.status ?? ''),
            });
          }
        } else if (mime === 'multi_load/iframe') {
          // 正文：multi_load[0].content 全量快照——直接覆盖
          const loads = Array.isArray(meta?.multi_load) ? meta.multi_load : [];
          const body = String(loads?.[0]?.content ?? '');
          if (body) content = body;
        } else if (mime !== 'signal/post' && !seenMimes.has(mime)) {
          // signal/post 是取证在案的首帧元数据（不进话）；其余陌生 mime 留一拍
          // ——若哪天正文改从新帧型来，这里第一眼就能看见。
          seenMimes.add(mime);
          if (notes.length < 6) notes.push(`未见过的 mime_type=${mime}（键 ${Object.keys(msg || {}).slice(0, 5).join(',') || '无'}）——若它带正文就是被丢了`);
        }
        // signal/post 等其余帧型不进话
      }
    }

    return {
      get thinking() {
        const parts = [];
        for (const seq of thinkingOrder) {
          const p = thinkingParts.get(seq);
          if (p?.body) parts.push(p.title ? `【${p.title}】\n${p.body}` : p.body);
        }
        return parts.join('\n\n');
      },
      get content() { return content; },
      get finished() { return finished; },
      get sawData() { return sawData; },
      /** 诊断随 completed 上报（seat-agent-core 打进服务日志）；无诊断不带字段。 */
      diag() { return notes.length ? { diagKeys: notes.slice(0, 6) } : {}; },
      feedChunk(text) {
        const s = String(text ?? '');
        let from = 0;
        for (;;) {
          const nl = s.indexOf('\n', from);
          const line = (nl >= 0 ? s.slice(from, nl) : s.slice(from)).replace(/\r$/, '');
          from = nl >= 0 ? nl + 1 : s.length;
          const t = line.trim();
          if (t.startsWith('data:')) {
            const payload = t.slice(5).trim();
            if (payload) {
              sawData = true;
              let obj;
              try { obj = JSON.parse(payload); } catch { obj = null; }
              if (obj) handleFrame(obj);
              else if (dropLogged < 3) { dropLogged += 1; notes.push(`data 帧解析不了（前80字）${payload.slice(0, 80)}`); }
            }
          }
          if (nl < 0) break;
        }
      },
    };
  }

  // ── 会话名搭车：会话详情/清单 POST 响应里「session_id + title」同体的对象
  //    都收进清单，整包发一信（R1 实证 session/get 响应带 data.title）。
  function emitTitles(text) {
    let json;
    try { json = JSON.parse(text); } catch { return; }
    const titles = {};
    const SID_RE = /^[0-9a-f]{32}$/;
    (function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 6) return;
      if (Array.isArray(node)) { for (const x of node) walk(x, depth + 1); return; }
      const sid = typeof node.session_id === 'string' ? node.session_id
        : typeof node.sessionid === 'string' ? node.sessionid : '';
      if (sid && SID_RE.test(sid) && typeof node.title === 'string' && node.title.trim()) {
        titles[sid] = node.title.trim();
      }
      for (const v of Object.values(node)) walk(v, depth + 1);
    })(json, 0);
    if (Object.keys(titles).length) emit({ phase: 'titles', titles, ts: Date.now() });
  }

  // ── fetch 闸 ────────────────────────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
    const method = String(args[1]?.method ?? args[0]?.method ?? 'GET').toUpperCase();
    try { if (typeof url === 'string' && url.includes(API_PROBE)) emit({ phase: 'api', url: String(url).slice(0, 140), ts: Date.now() }); } catch { /* 探针绝不干扰页面 */ }
    const res = await origFetch.apply(this, args);
    try {
      if (typeof url === 'string' && url.includes(TITLES_RIDE) && method === 'POST'
        && !url.includes(COMPLETION)) {
        res.clone().text().then(t => emitTitles(t)).catch(() => { /* 搭车失败不干扰页面 */ });
      }
      if (typeof url === 'string' && url.includes(COMPLETION)) {
        emit({ phase: 'start', path: location.pathname, ts: Date.now() });
        deltaLen = -1;
        const ct = res.headers?.get?.('content-type') ?? '';
        if (ct.includes('text/event-stream') && res.body) {
          // tee 一份旁听，页面拿原样那份（status/headers 保真）
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
                  parser.feedChunk(buf.slice(0, idx));
                  buf = buf.slice(idx + 1);
                }
                emitDelta(parser.thinking, parser.content);
              },
              close() {
                if (buf.trim()) parser.feedChunk(buf);
                notes.push('流结束：服务端正常关流');
                emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ...parser.diag(), ts: Date.now() });
              },
            }))
            .catch(e => {
              if (buf.trim()) parser.feedChunk(buf); // 中断时交出手头已到手的字（坑 14：边流边攒）
              notes.push(`流异常中断：${String(e?.message ?? e).slice(0, 60)}`);
              emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ...parser.diag(), ts: Date.now() });
            });
          return new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        emit({ phase: 'done', ts: Date.now() }); // 非 SSE 形态（JSON 报错等）= 即时结束
      }
    } catch { /* 网络闸绝不干扰页面本体：任何异常都放行原响应 */ }
    return res;
  };

  // ── XHR 闸（常备预防；本站对话实证走 fetch）─────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      const u = typeof url === 'string' ? url : String(url);
      this.__webUrl = u;
      this.__webMethod = String(method ?? 'GET').toUpperCase();
      if (u.includes(API_PROBE)) emit({ phase: 'api', url: u.slice(0, 140), ts: Date.now() });
    } catch { /* 探针绝不干扰页面 */ }
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    try {
      const u = String(xhr.__webUrl ?? '');
      const m = String(xhr.__webMethod ?? '').toUpperCase();
      if (u.includes(TITLES_RIDE) && m === 'POST' && !u.includes(COMPLETION)) {
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
            while ((idx = buf.indexOf('\n')) >= 0) { parser.feedChunk(buf.slice(0, idx)); buf = buf.slice(idx + 1); }
            emitDelta(parser.thinking, parser.content);
          } catch { /* responseType 非 text：解析不了就只在 loadend 报个空 */ }
        });
        xhr.addEventListener('loadend', () => {
          if (buf.trim()) parser.feedChunk(buf);
          emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ...parser.diag(), ts: Date.now() });
        });
      }
    } catch { /* 闸绝不干扰页面本体 */ }
    return origSend.call(this, body);
  };
})();
