/**
 * inject.js — ChatGPT 网络闸（MAIN world，document_start）。2026-09-29 当日取证转正。
 *
 * 职责：把「这页 ChatGPT 说了什么」在网络上说得准。补全接口实证为
 * POST /backend-api/f/conversation（真页取证，注意是带 f/ 前缀的新接口——
 * 首页发起的新会话另有 POST /backend-api/conversation/init 引导，不是补全）；
 * fetch 与 XHR 两道闸都架（本站对话实证走 fetch，XHR 闸常备预防），共用一套
 * 流解析器。
 *
 * 流格式（真页取证原话见 SITE.md）：SSE；开张 event:delta_encoding 声明 v1；
 * 数据帧=JSON 补丁语义 {p,o,v}（指针/操作/值）：
 *   {p:"",o:"add",v:{message}}           整条消息落位（user/assistant/system）；
 *   {p:"/message/content/parts/0",o:"append",v:"…"}   正文增量（带指针）；
 *   {v:"…"}                              裸值帧——**沿用上一条指针**（粘性指针，
 *                                         站点把重复的前缀省了，这是本协议的
 *                                         要害：指针会话间有状态）；
 *   {p:"",o:"patch",v:[{p:"/message/status",o:"replace",v:"finished_successfully"},…]}
 *                                        结束补丁（批量）；
 *   {"type":"message_stream_complete"}   结束信号之二（权威）；
 *   data:[DONE]                          结束信号之三；
 *   {"type":"title_generation",title,…}  **会话名在流里搭车**（新会话标题生成时）。
 * CoT 收集豁免（用户实证：思考对用户隐藏）：只认 assistant 且 content_type=text
 *   的 parts/0 指针——思考/工具等一切旁支指针天然不进话，thinking 恒空。
 *
 * 会话名双来源：流内 title_generation（新会话，主）+ 会话清单/详情 GET 响应
 *   搭车（旧会话续聊，备）——都收进 web-net 'titles' 帧交座席骨架对号。
 *
 * api 探针保留（/backend-api/ 前缀逐条上报）：上游换格式一次下发就能取证。
 *
 * 2026-10-01 实案教训：闸对补全接口只做「路径全等」，不做子串包含——上游在
 * 同一前缀下新添了兄弟端点 /backend-api/f/conversation/prepare（sentinel
 * 预备包，POST 非 SSE），子串包含把它当补全本体拦下，其 JSON 响应走「非
 * SSE=即时结束」支路发出静默 done，座席在真补全流开演前就误判「生成已结
 * 束」——回复蒸发（job 2670 实录，09-29 首次真派工即同病）。
 *
 * 2026-10-08 实案定谳（j2724 流头取证）：上游当日翻新流协议——① assistant
 * 落位帧的 parts[0] 自带首段正文（旧协议恒空串）；② 正文追加改住批量补丁
 * {p:"",o:"patch",v:[…]} 里（旧协议是顶层 append 帧）；③ 批补丁带过正文后
 * 长回复以裸值帧续发（旧代码批补丁后清粘性=裸帧全丢）。解析器三处已跟进；
 * 残余未知帧型由流内取证仪表（裸帧/批补丁逐条留痕）下一轮定谳。
 */
(() => {
  if (window.__webNetGate) return; // 脚本被重复注入时静默退出
  window.__webNetGate = true;

  const COMPLETION = '/backend-api/f/conversation';
  const TITLES_RIDE = '/backend-api/conversation'; // 会话清单 GET /backend-api/conversations 与详情 GET /backend-api/conversation/<id> 的公共前缀
  const API_PROBE = '/backend-api/';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  /** 闸匹配助手：取 URL 的 pathname（相对路径就地补全，query 不参与）。
   *  补全接口一律 pathname 与 COMPLETION 全等，同前缀兄弟端点不拦（见文件头
   *  2026-10-01 实案）；它们交给 api 探针逐条上报留痕。 */
  function gatePath(url) {
    const s = String(url ?? '');
    try {
      if (s.startsWith('/')) return s.split('?')[0];
      return new URL(s, location.origin).pathname;
    } catch { return s; }
  }

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

  /** 取证行进服务日志（gate-log 通道；服务端一行 400 字上限，按 340 切）。
   *  2026-10-08 加装：GPT 长回复只剩中段碎片两案（j2722_6/j2724_3），多打印
   *  定谳用——GPT 收话恢复全长后随流取证一并拆除。 */
  function gateLog(tag, text) {
    const s = String(text ?? '');
    if (!s) return;
    for (let i = 0; i < s.length; i += 340) {
      emit({ phase: 'gate-log', line: `${tag}: ${s.slice(i, i + 340)}`, ts: Date.now() });
    }
  }

  // ── WebSocket 取证探针（2026-10-08 加装，纯旁听不拦截不改写）：上游若把
  //    正文改走 WS（celsius/ws 一类），fetch/XHR 闸结构性全聋——只加监听记
  //    首几条消息与关闭小结，页面语义零扰动。随流取证一并拆除。
  const OrigWS = window.WebSocket;
  window.WebSocket = class WebSocketProbe extends OrigWS {
    constructor(url, protocols) {
      if (protocols === undefined) super(url); else super(url, protocols);
      try {
        const s = String(url ?? '');
        if (/celsius|\/ws(\/|\?|$)|stream/i.test(s)) {
          let n = 0, bytes = 0, dumpedMsgs = 0;
          this.addEventListener('message', (ev) => {
            n += 1;
            const d = typeof ev.data === 'string' ? ev.data : (ev.data ? `(${ev.data?.constructor?.name ?? '非字符串'})` : '');
            bytes += d.length;
            if (dumpedMsgs < 3 && d) { dumpedMsgs += 1; gateLog(`WS消息[${s.slice(-50)}]#${n}`, d.slice(0, 300)); }
          });
          this.addEventListener('close', () => gateLog(`WS关闭[${s.slice(-50)}]`, `共 ${n} 条 / ${bytes} 字节`));
        }
      } catch { /* 探针绝不干扰页面 */ }
    }
  };

  /** 流解析器：JSON 补丁语义 + 粘性指针；只收 assistant text 的 parts/0。
   *  2026-10-08 取证加装（只记账不改收话语义）：GPT 长回复只剩「中段碎片」
   *  两案——页面渲染全文、流式探针实证整条流解析器只进账一帧（6/9 字），
   *  本地改动作案排除（inject.js 10-01 后零改动、web 服务 10-07 起未重启、
   *  两案均早于当日并行测试进程），主疑上游翻新帧型配比或正文改道
   *  （replace_stream_status / celsius WS）。仪表清单见各处注释。 */
  function makeParser() {
    let content = '';
    let finished = false;
    let inAssistantText = false; // 当前在流的消息 = assistant 且 content_type=text
    let stickyParts0 = false;    // 上一条指针指向 parts/0（裸 v 帧沿用它）
    let sawData = false;

    // ── 取证仪表（纯记账；取证行走 gate-log 通道，≤340 字/行）────────
    const stats = { lines: 0, bytes: 0, shapes: {}, samples: {}, msgAdds: 0, logged: 0, stickyClears: 0, bareLogged: 0, batchLogged: 0 };
    let rawHead = '';
    let rawTail = '';
    let dumped = false;
    const log = (tag, text) => {   // 不引用外层 gateLog：测试按括号配对抽本函数，外层名字带不出去（豆包成例同款约束）
      const s = String(text ?? '');
      if (!s) return;
      for (let i = 0; i < s.length; i += 340) {
        emit({ phase: 'gate-log', line: `${tag}${i > 0 ? `…续${Math.floor(i / 340) + 1}` : ''}: ${s.slice(i, i + 340)}`, ts: Date.now() });
      }
    };
    const shapeOf = (p, o) => `${o ?? '∅o'} ${p === undefined ? '(裸指针)' : `p=${p}`}`;
    function note(shape, obj) {
      stats.shapes[shape] = (stats.shapes[shape] ?? 0) + 1;
      if (!stats.samples[shape] && Object.keys(stats.samples).length < 14) {
        try { stats.samples[shape] = (JSON.stringify(obj) ?? 'null').slice(0, 260); } catch { stats.samples[shape] = '(不可序列化)'; }
      }
    }
    /** 收流终点一次性倒账：流头/流尾原文 + 帧型直方图 + 各型首见样本。 */
    function dumpForensics() {
      if (dumped) return;
      dumped = true;
      log('流头取证', rawHead || '(空)');
      log('流尾取证', rawTail || '(空)');
      const hist = Object.entries(stats.shapes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join('；');
      log('帧型直方图', `共 ${stats.lines} 行 data / ${stats.bytes} 字节 / ${Object.keys(stats.shapes).length} 型：${hist || '(无)'}`);
      for (const [shape, sample] of Object.entries(stats.samples)) log(`样本[${shape}]`, sample);
    }

    /** 单条补丁帧（顶层）：驱动粘性指针与正文积累。 */
    function handlePatch(p, o, v, frame) {
      // 整条消息落位——带不带 p/o 都见过（真页实证：user 是 {p:"",o:"add"}，
      // system 是裸 {v:{message}}；指针省略是本协议常态）
      if (v && typeof v === 'object' && !Array.isArray(v) && v.message) {
        note(shapeOf(p, o), frame);
        const msg = v.message;
        inAssistantText = msg?.author?.role === 'assistant' && msg?.content?.content_type === 'text';
        // 新协议（2026-10-08 j2724 实帧定谳）：assistant 落位帧的 parts[0] 自带
        // 首段正文（旧协议恒空串，按空串种子归零行为不变）——按落位正文做种子，
        // 后续追加接着长，不再把开头几个字扔掉。
        const seedParts0 = inAssistantText && typeof msg?.content?.parts?.[0] === 'string' ? msg.content.parts[0] : '';
        if (inAssistantText) content = seedParts0;
        stickyParts0 = false;
        stats.msgAdds += 1;
        if (inAssistantText && stats.msgAdds <= 10) { // 消息落位明细：parts0len 是「整包 replace 流」的指纹
          const parts = msg?.content?.parts;
          log('消息落位', `#msg${stats.msgAdds} role=${msg?.author?.role} ctype=${msg?.content?.content_type} status=${msg?.status ?? '?'} `
            + `parts数=${Array.isArray(parts) ? parts.length : '?'} parts0len=${typeof parts?.[0] === 'string' ? parts[0].length : '?'} `
            + `parts0头200字="${String(parts?.[0] ?? '').slice(0, 200)}"`);
        }
        return;
      }
      // 批量补丁：正文追加/结束信号住在这里。信封两形（j2726 实帧）：
      //   {p:"",o:"patch",v:[…]} 旧形；{"v":[…]} 新裸形（顶层连 o 都省了，
      //   长回复主体住在这里——只认 o==='patch' 会把它们全丢）。
      //   子操作自带 (p,o,v) 指针，信封不参与语义。
      if (Array.isArray(v)) {
        if (stats.batchLogged < 12) { // 批补丁逐条留痕（新协议的正文追加住在这里，整包留痕定谳用）
          stats.batchLogged += 1;
          let s; try { s = JSON.stringify(frame) ?? 'null'; } catch { s = '(不可序列化)'; }
          log(`批补丁#${stats.batchLogged}`, s.slice(0, 600));
        }
        let batchAppended = false;
        for (const sub of v) {
          note(`patch子 ${sub?.o ?? '?'} ${sub?.p ?? '(裸)'}`, sub);
          if (sub?.p === '/message/status' && sub?.o === 'replace' && typeof sub?.v === 'string'
            && sub.v.startsWith('finished_')) finished = true;
          if (inAssistantText && sub?.p === '/message/content/parts/0' && sub?.o === 'append'
            && typeof sub?.v === 'string') { content += sub.v; batchAppended = true; }
        }
        // 新协议（2026-10-08 定谳）：正文追加住在批补丁里（旧协议是顶层 append
        // 帧）——批补丁带过正文，紧随的裸值帧就该沿用它的指针继续进话；没带
        // 过正文，维持旧语义清粘（status/元数据批补丁之后的裸帧不进话）。
        stickyParts0 = batchAppended;
        return;
      }
      if (typeof v === 'string') {
        note(shapeOf(p, o), frame);
        const onParts0 = p === undefined // 裸值帧：沿用上一条指针
          ? stickyParts0
          : p === '/message/content/parts/0';
        if (onParts0) {
          if (!inAssistantText) return; // 指针在别家消息上，不进话
          content += v;
          if (stats.logged < 8) { // 进话帧留痕（封顶 8 帧，健康流不刷屏；坏流里它就是「哪一帧进了话」的直接答案）
            stats.logged += 1;
            log('进话帧', `#${stats.logged} +${v.length}字 累计${content.length}字 v="${v.slice(0, 200)}"`);
          }
        }
        if (p !== undefined) stickyParts0 = onParts0; // 带指针的帧刷新粘性；裸帧不改
      } else if (p !== undefined && p !== '/message/content/parts/0') {
        note(shapeOf(p, o), frame);
        if (stickyParts0 && stats.stickyClears < 4) { // 粘性被清=此后裸帧断流，断点值得留痕
          stats.stickyClears += 1;
          log('粘性清', `指针挪去 p=${p}——此后裸值帧不再进话，直到下一条显式 parts/0 指针`);
        }
        stickyParts0 = false; // 指针挪去别处（元数据补丁等）
      } else {
        note(shapeOf(p, o), frame); // 其余形状也记一笔（防漏型）
      }
    }

    function handleObj(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (typeof obj.type === 'string') {
        note(`type:${obj.type}`, obj);
        if (obj.type === 'message_stream_complete') finished = true;
        if (obj.type === 'title_generation' && typeof obj.title === 'string' && obj.title.trim()
          && typeof obj.conversation_id === 'string') {
          emit({ phase: 'titles', titles: { [obj.conversation_id]: obj.title.trim() }, ts: Date.now() });
        }
        return; // message_marker / server_ste_metadata / resume_conversation_token 等元帧不进话
      }
      if (typeof obj.p === 'string' || obj.v !== undefined || obj.o !== undefined) {
        if (obj.p === undefined && stats.bareLogged < 24) { // 裸帧逐条留痕：17:23 那批没认领的 ∅o×4 就在这里现形
          stats.bareLogged += 1;
          let s; try { s = JSON.stringify(obj) ?? 'null'; } catch { s = '(不可序列化)'; }
          log(`裸帧#${stats.bareLogged}`, s.slice(0, 600));
        }
        handlePatch(obj.p, obj.o, obj.v, obj);
      }
    }

    return {
      get thinking() { return ''; }, // CoT 隐藏站：思考不收集（见文件头）
      get content() { return content.trim(); },
      get finished() { return finished; },
      get sawData() { return sawData; },
      feedLine(line) {
        const t = line.trim();
        if (!t.startsWith('data:')) return; // event: 行不管（补丁语义看载荷就够）
        const payload = t.slice(5).trim();
        if (!payload) return;
        sawData = true;
        stats.lines += 1;
        if (payload === '[DONE]') { finished = true; note('type:[DONE]', null); return; }
        let obj;
        try { obj = JSON.parse(payload); } catch { /* 非 JSON 行忽略 */ }
        handleObj(obj);
      },
      /** 原文取证（2026-10-08）：闸在行切分前把原始 chunk 喂进来，只记头尾与字节数。 */
      feedRaw(chunk) {
        const s = String(chunk ?? '');
        if (!s) return;
        stats.bytes += s.length;
        if (rawHead.length < 4000) rawHead += s.slice(0, 4000 - rawHead.length);
        rawTail = (rawTail + s).slice(-1500);
      },
      dumpForensics,
    };
  }

  // ── 会话名搭车（旧会话续聊时流里没有 title_generation）：会话清单/详情 GET
  //    响应过闸时，树里任何「会话 id（uuid 形）+ title」同体的对象都收进清单，
  //    整包发一信（chatglm 包成例；id 加 uuid 形校验，防把 GPTs 等杂项收进来）。
  function emitTitles(text) {
    let json;
    try { json = JSON.parse(text); } catch { return; }
    const titles = {};
    (function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 6) return;
      if (Array.isArray(node)) { for (const x of node) walk(x, depth + 1); return; }
      const id = typeof node.conversation_id === 'string' ? node.conversation_id
        : typeof node.id === 'string' ? node.id : '';
      if (id && UUID_RE.test(id) && typeof node.title === 'string' && node.title.trim()) {
        titles[id] = node.title.trim();
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
      if (typeof url === 'string' && method === 'GET' && gatePath(url).startsWith(TITLES_RIDE)) {
        res.clone().text().then(t => {
          if (gatePath(url).endsWith('/stream_status')) gateLog('stream_status响应取证', t.slice(0, 2400)); // 2026-10-08：正文改道疑点之一
          emitTitles(t);
        }).catch(() => { /* 搭车失败不干扰页面 */ });
      }
      if (typeof url === 'string' && gatePath(url) === COMPLETION) {
        emit({ phase: 'start', path: location.pathname, ts: Date.now() });
        deltaLen = -1;
        const reqBody = typeof args[1]?.body === 'string' ? args[1].body : '';
        if (reqBody) gateLog(`补全请求体(${reqBody.length}字)`, reqBody.slice(0, 900)); // 请求参数翻新也会改流形状，一并取证
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
                parser.feedRaw(chunk); // 原文取证（流头/流尾/字节数），在行切分之前
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
                try { parser.dumpForensics(); } catch { /* 仪表不干扰收话 */ }
                emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ts: Date.now() });
              },
            }))
            .catch(() => {
              try { parser.dumpForensics(); } catch { /* 仪表不干扰收话 */ }
              emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ts: Date.now() });
            });
          return new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        emit({ phase: 'done', ts: Date.now() }); // 非 SSE 形态（JSON 报错等）= 即时结束
        // 2026-10-08 取证：若补全本体改回非 SSE（JSON ACK/报错），响应体就是正文改道的直接证据
        res.clone().text().then(t => gateLog('补全非SSE响应体取证', t.slice(0, 900))).catch(() => { /* 取证失败不干扰页面 */ });
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
      if (String(xhr.__webMethod ?? '').toUpperCase() === 'GET' && gatePath(u).startsWith(TITLES_RIDE)) {
        xhr.addEventListener('loadend', () => {
          try { emitTitles(String(xhr.responseText ?? '')); } catch { /* 搭车失败不干扰页面 */ }
        });
      }
      if (gatePath(u) === COMPLETION) {
        emit({ phase: 'start', ts: Date.now() });
        deltaLen = -1;
        if (typeof body === 'string' && body) gateLog(`补全请求体XHR(${body.length}字)`, body.slice(0, 900));
        const parser = makeParser();
        let buf = '';
        let lastLen = 0;
        xhr.addEventListener('progress', () => {
          try {
            const text = xhr.responseText ?? '';
            if (text.length <= lastLen) return;
            const fresh = text.slice(lastLen);
            parser.feedRaw(fresh); // 原文取证，在行切分之前
            buf += fresh;
            lastLen = text.length;
            let idx;
            while ((idx = buf.indexOf('\n')) >= 0) { parser.feedLine(buf.slice(0, idx)); buf = buf.slice(idx + 1); }
            emitDelta(parser.thinking, parser.content);
          } catch { /* responseType 非 text：解析不了就只在 loadend 报个空 */ }
        });
        xhr.addEventListener('loadend', () => {
          if (buf.trim()) parser.feedLine(buf);
          try { parser.dumpForensics(); } catch { /* 仪表不干扰收话 */ }
          emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ts: Date.now() });
        });
      }
    } catch { /* 闸绝不干扰页面本体 */ }
    return origSend.call(this, body);
  };
})();
