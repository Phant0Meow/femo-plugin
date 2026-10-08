/**
 * inject.js — AI Studio 网络闸（MAIN world，document_start）。2026-09-29 当日
 * 取证转正（四轮仪表破案，实录见 SITE.md）。
 *
 * 职责：把「这页 AI Studio 说了什么」在网络上说得准。补全接口实证为
 * POST …/$rpc/…MakerSuiteService/GenerateContent（跨源打 clients6 主机——
 * 页面自己的 XHR 一样过闸；fetch 与 XHR 两道闸都架，本站实证走 XHR）。
 *
 * 流格式（真帧样本定谳 2026-10-02，实验件 cache/aistudio-fix/）：**双层外壳
 * 的分块数组流**——不是 SSE：响应外壳 `[` 里套「块容器」`[`，块组逐个推进。
 * 每组：消息子树（文本住深巢里的 [null,"文本"] 对，组内最深 6 层）+ 元数据
 * [9289, 偏移, …]（chunk[2]，判据与成例同）+ 回合 token——
 *   偏移是数字 = 正文增量块（按流序追加）；
 *   偏移是 null = 思考块（Gemini 思考摘要，一块一个步骤，整块推）。
 * （09-29 成例为单层外壳，上游加了容器层——形状漂移曾致 0 收话，实案见
 * SITE.md。）
 *
 * 结束信号：页面收完**在流中途杀 XHR**（readyState 归 0，且不发 abort/loadend，
 * 四轮仪表实锤）——rs=0 即视为完成，交手头已收的字（kimi「abort 前流已放完=
 * 完整捕获」同款纪律）。另有第三方脚本在启动后覆写 prototype.send（金丝雀
 * 实锤）——我们的包装层在调用链里照常工作，但**事件不可全信**：进料三路
 * （readystatechange/progress/轮询）共用一个 ingest，事件哑火也有轮询兜底。
 *
 * api 探针保留（$rpc 前缀逐条上报）：上游换格式一次下发就能取证。
 */
(() => {
  if (window.__webNetGate) return; // 脚本被重复注入时静默退出
  window.__webNetGate = true;

  // 注意无前导斜杠：真 URL 里服务名前面是「点」（…v1.MakerSuiteService/…），
  // 带 '/' 永远匹配不上（真帧回归锁抓过这个 bug，见 mytrashbin 回归件）。
  const COMPLETION = 'MakerSuiteService/GenerateContent';
  const API_PROBE = '$rpc';

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

  /** 流解析器：字符串感知的增量 JSON 数组扫描——整个响应体是一个流式增长的
   *  大数组，扫出每个顶层元素（块）就解析一块。fedBytes/chunkCount/skipCount
   *  是常开诊断计数（completed 帧带出，0/0 收话一类悬案靠它定谳）。 */
  function makeParser() {
    let thinking = '';
    let content = '';
    let fedBytes = 0;
    let chunkCount = 0;
    let skipCount = 0;
    let skipMetaCount = 0; // parse 过但元数据不合块形被跳的块数（形状漂移的第一信号）
    let maxDepth = 0;      // 扫描期见过的最大嵌套深度（流形状取证：取证成例是浅层块）
    const buf = { text: '', outerOpened: false, depth: 0, inStr: false, esc: false, raw: '' };

    /** 从消息子树里收全部 [null,"文本"] 对的文本（「model」「v1_*」等标记
     *  的宿主数组首元素不是 null，天然不中）。 */
    function harvest(node, out) {
      if (!Array.isArray(node)) return;
      if (node[0] === null && typeof node[1] === 'string' && node[1]) out.push(node[1]);
      for (const x of node) harvest(x, out);
    }

    function handleChunk(chunkText) {
      let chunk;
      try { chunk = JSON.parse(chunkText); } catch { skipCount += 1; return; }
      if (!Array.isArray(chunk)) { skipCount += 1; return; }
      chunkCount += 1;
      const meta = chunk[2];
      if (!Array.isArray(meta) || typeof meta[0] !== 'number') { skipMetaCount += 1; return; } // 不合块形的（echoed 请求等）跳过
      const texts = [];
      harvest(chunk[0], texts);
      if (!texts.length) return;
      const isContent = typeof meta[1] === 'number'; // 偏移数字=正文；null=思考块
      if (isContent) {
        for (const t of texts) content += t;
      } else {
        if (thinking) thinking += '\n\n';
        thinking += texts.join('\n\n');
      }
    }

    return {
      get thinking() { return thinking; },
      get content() { return content.trim(); },
      get finished() { return false; }, // 结束信号在闸层（rs=0/4），不在流内容里
      get diag() { return [`fed=${fedBytes}`, `chunks=${chunkCount}`, `skip=${skipCount}`, `skipMeta=${skipMetaCount}`, `maxDepth=${maxDepth}`]; },
      /** 零收话时的转储（2026-10-02 实案升级：220 字只照见九层嵌套开括号、
       *  看不全形状——留 8000 字、170 字一段（JSON 转义膨胀近半，340 会被
       *  服务日志一行 400 字截断），形状漂移靠它对形修解析器）。 */
      get headDump() {
        if (content || !fedBytes) return [];
        const raw = String(buf.raw ?? '');
        const parts = [];
        for (let i = 0; i < Math.min(raw.length, 8000); i += 170) {
          parts.push(`head[${i}]=${JSON.stringify(raw.slice(i, i + 170))}`);
        }
        return parts;
      },
      /** 喞一段文本：字符串感知扫描，攒完整块就解析。流形状=**双层外壳的
       *  大 JSON 数组**（2026-10-02 真帧样本定谳，cache/aistudio-fix 有实验；
       *  09-29 取证成例是单层外壳——上游加了「块容器数组」层）：响应外壳
       *  `[` 里套块容器 `[`，块组（文本子树+元数据+token）是容器的并列元素，
       *  组内文本深巢至 6 层。先吃两层外壳，此后深度 0 处的 `[` 即块组起点、
       *  深度回 0 即块组完结；负深度=容器自身收口（流尾）。块组元数据仍在
       *  chunk[2]、判据不变（[1] 数字=正文 / null=思考）。*/
      feedText(text) {
        fedBytes += text.length;
        if (buf.raw.length < 8000) buf.raw += text; // 首段留档：零收话时转储辨形用
        buf.text += text;
        if (!buf.outerOpened) {
          const i = buf.text.indexOf('[[');
          if (i < 0) { buf.text = ''; return; } // 还没开双层外壳（前导空白等）
          buf.text = buf.text.slice(i + 2);
          buf.outerOpened = true;
        }
        let depth = 0;
        let chunkBegin = -1;
        let s = false; let esc = false;
        for (let k = 0; k < buf.text.length; k++) {
          const ch = buf.text[k];
          if (s) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') s = false; continue; }
          if (ch === '"') { s = true; continue; }
          if (ch === '[') { if (depth === 0) chunkBegin = k; depth++; if (depth > maxDepth) maxDepth = depth; continue; }
          if (ch === ']') {
            depth--;
            if (depth === 0 && chunkBegin >= 0) { handleChunk(buf.text.slice(chunkBegin, k + 1)); chunkBegin = -1; }
            if (depth < 0) { buf.text = ''; return; } // 外层数组收口：整个响应体完结
          }
        }
        buf.text = chunkBegin >= 0 ? buf.text.slice(chunkBegin) : ''; // 未完块留待下轮；已完块清场
      },
    };
  }

  // ── fetch 闸（常备预防；本站对话实证走 XHR）─────────────────────────
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
        if (res.body && (ct.includes('json') || ct.includes('event-stream'))) {
          // tee 一份旁听，页面拿原样那份（status/headers 保真）；增量排空
          const [keep, probe] = res.body.tee();
          const parser = makeParser();
          (async () => {
            try {
              const reader = probe.pipeThrough(new TextDecoderStream()).getReader();
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                parser.feedText(value);
                emitDelta(parser.thinking, parser.content);
              }
            } catch { /* 中断：流已放完，手头即全部 */ }
            emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: true, diagKeys: [...parser.diag, ...parser.headDump], ts: Date.now() });
          })();
          return new Response(keep, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        emit({ phase: 'done', ts: Date.now() }); // 非 JSON/流形态（报错等）= 即时结束
      }
    } catch { /* 网络闸绝不干扰页面本体：任何异常都放行原响应 */ }
    return res;
  };

  // ── XHR 闸（本站对话的实证通道）────────────────────────────────────
  // 进料三路共用 ingest（readystatechange/progress/轮询）——本站页面在流中途
  // 杀 XHR 且不发 abort/loadend（四轮仪表实锤），事件不可全信；rs=0 即完成。
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
        const parser = makeParser();
        let lastLen = 0;
        let done = false;
        const finish = how => {
          if (done) return;
          done = true;
          clearInterval(poll);
          const diag = [`how=${how}`, ...parser.diag, ...parser.headDump];
          emit({ phase: 'completed', thinking: parser.thinking, content: parser.content, finished: true, how, diagKeys: diag, ts: Date.now() });
        };
        const ingest = () => {
          let text = '';
          try { text = xhr.responseText ?? ''; } catch { return; }
          if (text.length <= lastLen) return;
          parser.feedText(text.slice(lastLen));
          lastLen = text.length;
          emitDelta(parser.thinking, parser.content);
        };
        xhr.addEventListener('readystatechange', () => {
          try {
            if (xhr.readyState === 0) { ingest(); finish('rs=0 被页面中断'); return; } // 本站习性：收完即杀，手头即全部
            if (xhr.readyState === 4) { ingest(); finish('rs=4'); return; }
            if (xhr.readyState >= 3) ingest();
          } catch { /* 闸不干扰页面 */ }
        });
        xhr.addEventListener('progress', () => { try { ingest(); } catch { /* 闸不干扰页面 */ } });
        xhr.addEventListener('load', () => finish('load'));
        xhr.addEventListener('error', () => finish('error'));
        xhr.addEventListener('abort', () => finish('abort'));
        xhr.addEventListener('timeout', () => finish('timeout'));
        xhr.addEventListener('loadend', () => finish('loadend'));
        const poll = setInterval(() => { // 事件哑火时的兜底进料
          try {
            if (done) { clearInterval(poll); return; }
            if (xhr.readyState === 0) { ingest(); finish('poll(rs=0 被页面中断)'); return; }
            if (xhr.readyState === 4) { ingest(); finish('poll(rs=4)'); return; }
            ingest();
          } catch { clearInterval(poll); }
        }, 400);
      }
    } catch { /* 闸绝不干扰页面本体 */ }
    return origSend.call(this, body);
  };
})();
