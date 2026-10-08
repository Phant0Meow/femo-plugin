/**
 * inject.js — 豆包网络闸（MAIN world，document_start）。2026-09-27 转正。
 *
 * 职责：把「这页豆包说了什么」在网络上说得准。补全接口实证为 POST /chat/
 * completion（真页取证）；fetch 与 XHR 两道闸都架，共用同一套流解析器。
 *
 * 流格式（真页取证原话见 SITE.md）：事件制 SSE——帧是多行的
 * `id: N⏎event: 名字⏎data: {JSON}⏎⏎`。要点：
 *   CHUNK_DELTA {"text":"…"}           正文增量（逐字）；
 *   SSE_REPLY_END {end_type,…}         结束信号（end_type=1 帧的
 *                                      msg_finish_attr.brief 带全文，做对账）；
 *   SSE_ACK {ack_client_meta:{…}}      开场帧，conversation_info 免费捎着
 *                                      会话名（conversation_id+name）——搭车收；
 *   FULL_MSG_NOTIFY / STREAM_CHUNK     用户消息整包 / 块结构补丁（含 TTS 镜像
 *                                      文本），不进话。
 *
 * api 探针保留（/alice/ 命名空间逐条上报）：上游换格式，一次下发就能取证。
 *
 * 2026-10-03 三道防线（job 2689 实案：引擎收到的台词被啃掉头 5 字「SET V」）：
 * ①feed 时把 \r\n 归一成 \n——分帧只扫 \n\n 空行，CRLF 分隔的两帧会并成一帧、
 *   JSON 解析失败被静默吞掉（SSE_ACK 与第一条正文增量恰在此并帧）；
 * ②收尾对账——攒到的正文恰是结束帧全文（msg_finish_attr.brief）的尾巴且更短
 *   = 攒的时候丢了头，改用全文；
 * ③解析丢弃与未知事件不再静默：随 completed 的 diagKeys 上报，进服务日志。
 */
(() => {
  if (window.__webNetGate) return; // 脚本被重复注入时静默退出
  window.__webNetGate = true;

  const COMPLETION = '/chat/completion';

  const emit = detail => {
    try { window.dispatchEvent(new CustomEvent('web-net', { detail })); } catch { /* 事件派发不可失败 */ }
  };

  // 逐字流（草稿轨）：解析器快照有变就发 delta——全量快照不带算子，content.js
  // 节流后上报服务端喂 hub 草稿层。流内无思考分型，delta 的 thinking 恒空
  // （SITE.md 留位）；start 时清长度指纹，防上轮残留压住本轮第一拍。
  let deltaLen = -1;
  const emitDelta = (thinking, content) => {
    const n = (thinking?.length ?? 0) + (content?.length ?? 0);
    if (n === deltaLen) return;
    deltaLen = n;
    emit({ phase: 'delta', thinking: String(thinking ?? ''), content: String(content ?? ''), ts: Date.now() });
  };

  /** 事件帧解析器：按空行分帧，帧内拆 event/data；正文攒 CHUNK_DELTA，
   *  结束听 SSE_REPLY_END，会话名从 SSE_ACK 搭车（收到即报，不等流完）。
   *  解析丢弃与没见过的帧不再静默：记进 notes，随 completed 的 diagKeys 上报。 */
  function makeParser(onTitles) {
    const titles = {}; // conversation_id → name（SSE_ACK 搭车）
    let text = '';
    let brief = '';
    let finished = false;
    const notes = []; // 诊断留痕（随 completed 上报；名额有限防长流刷屏）
    let dropLogged = 0;
    let notifyAdopted = false; // STREAM_MSG_NOTIFY 采纳留痕（一名一拍）
    const seenEvents = new Set(); // 已留痕的未知事件名（一名一拍）
    // 流头取证（2026-10-03）：「SET V」啃头三案，对账网与 NOTIFY 合并都没接住
    // ——头坐哪个帧里不再猜，每条流的前 2000 字节原文（ACK+全部开场帧）直接
    // 进服务日志，一拍定谳。走 gate-log 通道即时上报（不等 completed，不挤
    // diagKeys，服务日志一行 400 字上限，按 340 字切行）。
    let rawHead = '';
    let headDumped = false;
    const dumpHead = () => {
      headDumped = true;
      for (let i = 0; i < rawHead.length; i += 340) {
        emit({ phase: 'gate-log', line: `流头取证[${Math.floor(i / 340) + 1}] ${rawHead.slice(i, i + 340)}`, ts: Date.now() });
      }
    };
    function handleFrame(frameText) {
      let event = 'message';
      const datas = [];
      for (const line of frameText.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) datas.push(line.slice(5).trim());
      }
      const raw = datas.join('\n');
      if (!raw) return;
      let obj;
      try { obj = JSON.parse(raw); } catch { obj = null; }
      if (!obj || typeof obj !== 'object') {
        if (dropLogged < 3) { dropLogged += 1; notes.push(`SSE帧解析不了被丢弃（前80字）${raw.slice(0, 80)}`); }
        return;
      }
      if (event === 'CHUNK_DELTA' && typeof obj.text === 'string') { text += obj.text; return; }
      if (event === 'SSE_REPLY_END') {
        finished = true;
        const b = obj?.msg_finish_attr?.brief;
        if (typeof b === 'string' && b) brief = b;
        return;
      }
      if (event === 'SSE_ACK') {
        const info = obj?.ack_client_meta?.conversation_info;
        if (info && typeof info.conversation_id === 'string' && typeof info.name === 'string' && info.name.trim()) {
          titles[info.conversation_id] = info.name.trim();
          onTitles?.({ ...titles });
        }
        return;
      }
      if (event === 'STREAM_MSG_NOTIFY') {
        // 正文快照通道（数据键 content,meta,attr——2026-10-03 job 2690 仪表实证；
        // 「SET V」啃头两案的头都在它车里：开场 Notify 带着正文开头，CHUNK_DELTA
        // 只续后面的）。保守合并：只认「明显是同一条正文的更长快照」——空账收
        // 头一块；攒到的 text 是快照的头（正常增长）或尾（头被啃）都改用快照；
        // 对不上的一律不碰（宁缺勿毒）。
        const c = typeof obj.content === 'string' ? obj.content : '';
        if (c.length > text.length && (!text || c.startsWith(text) || c.endsWith(text))) {
          if (text && !c.startsWith(text) && !notifyAdopted) {
            // 只给「补被啃的头」留痕（攒到的 text 不是快照的头=头丢过）；正常增长静默
            notifyAdopted = true;
            notes.push(`正文改从 STREAM_MSG_NOTIFY 收（攒${text.length}字 → 快照${c.length}字）`);
          }
          text = c;
        }
        return;
      }
      // FULL_MSG_NOTIFY / STREAM_CHUNK / SSE_HEARTBEAT 是取证在案的不进话事件（SITE.md）；此外的
      // 陌生事件留一拍——哪天正文改从新事件来，这里第一眼就能看见。
      if (event !== 'FULL_MSG_NOTIFY' && event !== 'STREAM_CHUNK' && event !== 'SSE_HEARTBEAT' && !seenEvents.has(event) && notes.length < 6) {
        seenEvents.add(event);
        const keys = Object.keys(obj).slice(0, 5).join(', ');
        notes.push(`未见过的SSE事件 ${event}（数据键 ${keys || '无'}）——若它带正文就是被丢了`);
      }
    }
    let buf = '';
    return {
      get thinking() { return ''; }, // 观测流内未见思考分型（block 型思考若上线照 SITE.md 取证法补）
      get content() { return text.trim() || brief; },
      get finished() { return finished; },
      /** 诊断随 completed 上报（seat-agent-core 打进服务日志）；无诊断不带字段。 */
      diag() { return notes.length ? { diagKeys: notes.slice(0, 6) } : {}; },
      feed(chunk) {
        buf += chunk;
        if (!headDumped && rawHead.length < 2000) {
          rawHead += chunk;
          if (rawHead.length >= 2000) dumpHead();
        }
        // 分帧只扫 \n\n 空行：CRLF 行尾不归一，\r\n\r\n 分隔的两帧会并成一帧、
        // JSON 解析失败被静默吞掉（job 2689 啃头实案——ACK+首条正文增量恰在此）。
        if (buf.includes('\r')) buf = buf.replace(/\r\n/g, '\n');
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) { // 帧以空行分隔（跨 chunk 缓冲拼接）
          handleFrame(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
        }
      },
      flush() {
        if (buf.trim()) handleFrame(buf);
        buf = '';
        if (!headDumped && rawHead) dumpHead();
        // 收尾对账：攒到的正文恰是结束帧全文的尾巴且更短 = 攒的时候丢了头——
        // 改用全文（end_type=1 的 brief 带全文，SITE.md 取证在案；job 2689 实案）。
        const t = text.trim();
        const b = brief.trim();
        if (t && b.length > t.length && b.endsWith(t)) {
          notes.push(`啃头对账：攒到的正文(${t.length}字)恰是结束帧全文(${b.length}字)的尾巴——攒的时候丢了头，已改用全文`);
          text = brief;
        }
      },
    };
  }

  // ── fetch 闸 ────────────────────────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
    // 探针：页面调了哪些自家接口（按 URL 去重，只记一遍）——上游换接口一次下发就能取证。
    if (typeof url === 'string' && url.includes('/alice/')) emit({ phase: 'api', url: String(url).slice(0, 140), ts: Date.now() });
    const res = await origFetch.apply(this, args);
    try {
      if (typeof url === 'string' && url.includes(COMPLETION)) {
        emit({ phase: 'start', path: location.pathname, ts: Date.now() });
        deltaLen = -1;
        const ct = res.headers?.get?.('content-type') ?? '';
        if (ct.includes('text/event-stream') && res.body) {
          const [keep, probe] = res.body.tee();
          const parser = makeParser(t => emit({ phase: 'titles', titles: t, ts: Date.now() }));
          probe
            .pipeThrough(new TextDecoderStream())
            .pipeTo(new WritableStream({
              write(chunk) { parser.feed(chunk); emitDelta(parser.thinking, parser.content); },
              close() { parser.flush(); emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ...parser.diag(), ts: Date.now() }); },
            }))
            .catch(() => { parser.flush(); emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ...parser.diag(), ts: Date.now() }); });
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
      if (u.includes('/alice/')) emit({ phase: 'api', url: u.slice(0, 140), ts: Date.now() });
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
        const parser = makeParser(t => emit({ phase: 'titles', titles: t, ts: Date.now() }));
        let lastLen = 0;
        xhr.addEventListener('progress', () => {
          try {
            const text = xhr.responseText ?? '';
            if (text.length <= lastLen) return;
            parser.feed(text.slice(lastLen)); // SSE 响应只追加，增量接解析器
            lastLen = text.length;
            emitDelta(parser.thinking, parser.content);
          } catch { /* responseType 非 text：解析不了就只在 loadend 报个空 */ }
        });
        xhr.addEventListener('loadend', () => {
          parser.flush();
          emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: parser.finished, ...parser.diag(), ts: Date.now() });
        });
      }
    } catch { /* 闸绝不干扰页面本体 */ }
    return origSend.call(this, body);
  };
})();
