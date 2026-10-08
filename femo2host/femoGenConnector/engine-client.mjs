/**
 * engine-client.mjs — 画布浏览器版引擎直连客户端（刀1，2026-10-05「画布直连引擎」）。
 *
 * femoGen 与常驻引擎的直连面：从 daemon-client.mjs（Node 宿主用）抽浏览器可搬的
 * 一半——fetch 发命令、EventSource 订阅事件流（观察者身份）、健康探针、job 清单
 * 与档案读取、跟随策略纯函数。发现与代拉（spawn 子进程、读盘）天生留在宿主——
 * 浏览器读不了 hub.json，引擎地址由伺候方经同源 GET /femo-plugin/engine-base
 * 现喂（dsh/web 各自实现，画布每次（重）连前现问，不写死端口）。
 *
 * 与 daemon-client 的语义对齐（不发明新机制）：
 *   · 命令：POST /cmd/<cmd>，body={id,cmd,args}；应答=stdio 信封原样
 *     {type:'response',id,ok,result|error,detail}——本客户端原样上交，调用方查 ok。
 *   · 事件流：GET /engine/events?observer=femogen（刀0 观察者格=合法全场观看，
 *     归属闸对它不生效）；断线重连浏览器自动带 Last-Event-ID，引擎重放环续传。
 *   · 帧开壳一处：引擎 SSE 帧是 {type:'event',event:<名>,data,replay?}，画布
 *     消费的是宿主转播形状 {type:<名>,data,replay?}——unwrapEngineFrame 对齐
 *     （daemon-client.mjs 出口同款姿势），开壳之后画布整条处理链零改动。
 *
 * 双路传输（直连/转发）：本机浏览器直连 base（引擎绑 127.0.0.1，安全姿态）；
 * 远程浏览器（手机反代等）够不着引擎，走伺候方的透明转发路径（relay，同源
 * 相对路径，逐字节转引擎流——不解帧不加闸不盖章）。构造时给哪个就走哪个，
 * useRelay() 随时切换（直连被 CSP/网络挡住时的后备，画布负责判死切换）。
 *
 * 零依赖、纯 ESM、浏览器与 Node（测试注入 fetch/EventSource 假件）通用。
 */

/** 观察者身份（刀0 立的合法格：全收、不报门铃、不构成「该继续演」的理由）。 */
export const OBSERVER_ID = 'femogen';

/**
 * 跟随目标挑选（2026-10-08 用户拍板：画布改盯 runners，不盯 running）。
 * runners=引擎内存里真在执行的场（/engine/health 的 runners 数组）——盘上
 * 台账的 running 是「没人收尸的账」会有大量僵尸（2719 事故取证：47 个 running
 * 对 1 个真在跑），内存里有多少收多少、不封顶；台账 running 不再参与跟随，
 * 挂起场按 updated_at 兜底。多 job 未来=本函数扩签名，订阅与渲染零改动。
 * @param {number[]} runners         /engine/health 的 runners（已排好序）
 * @param {Array<{job_id:number,state:string,updated_at?:string}>} jobs  台账元数据行
 * @param {{hostGrid?: string}} [opts]
 * @returns {object|null} 跟随目标行（jobs 里对应的那行；纯 runners 情形=壳行）
 */
export function pickFollowJob(runners, jobs, { hostGrid = '' } = {}) {
  const rows = Array.isArray(jobs)
    ? jobs.filter((j) => j && Number.isFinite(Number(j.job_id)))
    : [];
  const byRecency = (a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
  const byHost = (arr) => {
    if (!hostGrid) return arr;
    const own = arr.filter((j) => j.host_refs && Object.prototype.hasOwnProperty.call(j.host_refs, hostGrid));
    return own.length > 0 ? own : arr;
  };
  // 内存真相优先：runners 里有几个收几个（台账行拼形状，hostGrid 优先）
  if (Array.isArray(runners) && runners.length > 0) {
    const runnerIds = runners.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    const known = runnerIds
      .map((id) => rows.find((j) => Number(j.job_id) === id))
      .filter(Boolean);
    if (known.length > 0) return byHost(known)[0];
    if (runnerIds.length > 0) {
      // runners 有场但台账还没落行（开演瞬间竞态）：回壳行，调用方仍能盯场号
      return { job_id: byHost(runnerIds.map((id) => ({ job_id: id })))[0].job_id, state: 'running' };
    }
  }
  // 无 runners：台账挂起场按最近兜底（running 不认——那是没尸检的账）
  const suspended = rows.filter((j) => j.state === 'suspended').sort(byRecency);
  return suspended.length > 0 ? suspended[0] : null;
}

/**
 * 跟随策略（刀1，2026-10-08 起画布校准改吃 pickFollowJob；本函数保留给
 * 纯台账形状的独立消费者）。
 * @param {Array<{job_id:number,state:string,updated_at?:string,host_refs?:Record<string,string>}>} jobs
 * @param {{hostGrid?: string}} [opts]
 * @returns {object|null} 跟随目标行（list_jobs 的元数据行原样）
 */
export function pickJob(jobs, { hostGrid = '' } = {}) {
  if (!Array.isArray(jobs)) return null;
  const rows = jobs.filter((j) => j && Number.isFinite(Number(j.job_id)));
  const byRecency = (a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
  const running = rows.filter((j) => j.state === 'running').sort(byRecency);
  if (running.length > 0) {
    // 未来多 job：本宿主班底的场排前（单 job 时代全场至多一场，排序无感）
    const own = hostGrid
      ? running.filter((j) => j.host_refs && Object.prototype.hasOwnProperty.call(j.host_refs, hostGrid))
      : [];
    return (own.length > 0 ? own : running)[0];
  }
  const suspended = rows.filter((j) => j.state === 'suspended').sort(byRecency);
  return suspended.length > 0 ? suspended[0] : null;
}

/**
 * 引擎 SSE 帧开壳（画布事件入口唯一要做的适配）：{type:'event',event,data,replay?}
 * → {type:<event 名>,data,replay}；非事件帧（应答等不该出现在事件流上的东西）
 * 返回 null，调用方跳过。
 */
export function unwrapEngineFrame(obj) {
  if (!obj || typeof obj !== 'object' || obj.type !== 'event') return null;
  return { type: String(obj.event || ''), data: (obj.data ?? {}), replay: obj.replay === true };
}

/** 剧本快照比对（观演判定用）：CRLF 归一 + 收尾空白裁掉，其余逐字比。 */
export function sameScriptText(a, b) {
  const norm = (s) => String(s ?? '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
  return norm(a) === norm(b) && String(a ?? '').trim().length > 0;
}

/**
 * @param {object} opts
 * @param {string} [opts.base]      引擎基址（http://127.0.0.1:<port>）；空=只能走 relay
 * @param {string} [opts.relay]     伺候方透明转发根路径（同源相对，如 /femo-plugin/engine-relay）
 * @param {typeof fetch} [opts.fetchImpl]     注入用（Node 单测）
 * @param {typeof EventSource} [opts.eventSourceImpl] 注入用（Node 单测）
 * @param {(m:string)=>void} [opts.onLog]
 */
export function createEngineClient({ base = '', relay = '', fetchImpl = fetch, eventSourceImpl = typeof EventSource !== 'undefined' ? EventSource : undefined, onLog = () => {} } = {}) {
  let useRelayNow = !base && !!relay;      // 没基址=生在转发路上
  let seq = 0;
  let lastEventAt = 0;                     // 事件流最后一帧到达时刻（毫秒，0=没收到过）——帧龄判据用

  const url = (path) => (useRelayNow ? `${relay}${path}` : `${base}${path}`);

  async function cmd(name, args = {}) {
    seq += 1;
    const payload = { id: seq, cmd: name, args };
    const resp = await fetchImpl(url(`/cmd/${name}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
    });
    const body = await resp.json().catch(() => null);
    if (body === null) throw new Error(`引擎应答不是 JSON（HTTP ${resp.status}）：${name}`);
    return body;                            // 信封原样：{ok,result|error,detail}
  }

  return {
    /** 当前是否走在转发路上（诊断/显示用）。 */
    isRelay: () => useRelayNow,
    /** 直连被拦时切到伺候方透明转发（画布判死后调；没有 relay 可切=原样）。 */
    useRelay() {
      if (!relay) return false;
      if (!useRelayNow) onLog(`[engine-client] 直连不可达，切转发路 ${relay}`);
      useRelayNow = true;
      return true;
    },
    /** 重置回直连（重新发现拿到新基址后调）。 */
    resetTransport() { useRelayNow = !base && !!relay; },

    /** 一发引擎命令；返回应答信封原样（调用方查 .ok / .result / .error）。 */
    cmd,

    /**
     * 引擎健康探针；活=true。
     * 返回值：2026-10-08 起返回真值对象 {ok, runners, ssePing}（旧布尔真值
     * 语义不变——if 判断照旧成立）；引擎没说 runners/sse_ping 就不给键，
     * 调用方按「有没有这个键」区分新旧引擎。
     *   · runners：引擎内存里真在执行的场号清单（盘上台账的 running 会有
     *     僵尸，跟随目标只认内存真相）。
     *   · ssePing：SSE 心跳是否已是 JS 可见的 ping 数据帧（画布帧龄判据的
     *     开关——老引擎只有注释行心跳，帧龄判据必须关着，否则误判空转管道）。
     */
    async health() {
      try {
        const resp = await fetchImpl(url('/engine/health'), {
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
        });
        const body = await resp.json().catch(() => null);
        if (body?.ok !== true) return false;
        const out = { ok: true };
        if (Array.isArray(body.runners)) out.runners = body.runners;
        if (body.sse_ping === true) out.ssePing = true;
        return out;
      } catch {
        return false;
      }
    },

    /** 全场 job 清单（元数据行，无剧本正文）；失败回 []。 */
    async listJobs() {
      const body = await cmd('list_jobs').catch(() => null);
      const jobs = body?.ok ? body?.result?.jobs : null;
      return Array.isArray(jobs) ? jobs : [];
    },

    /** 单场档案全量（含剧本正文快照）；无此场/失败回 null。 */
    async getJobState(jobId) {
      const body = await cmd('get_job_state', { job_id: Number(jobId) }).catch(() => null);
      return body?.ok ? (body?.result ?? null) : null;
    },

    /** 暂停（幂等——suspended/finished 照样 {paused:true,state}）。 */
    async pause(jobId) {
      return cmd('job_pause', { job_id: Number(jobId) });
    },

    /** 续跑：档案里的剧本原文快照由调用方给（三步走的第三步）。 */
    async resume(jobId, femoText) {
      return cmd('job_resume', { job_id: Number(jobId), femo: String(femoText ?? '') });
    },

    /** 人类席交卷：信封词汇唯一出处=公共层 speech-core——人类席 {chat_text, variables?}。 */
    async humanInput(jobId, waitKey, text, variables) {
      const bodyPayload = { chat_text: String(text ?? '') };
      if (variables && typeof variables === 'object' && Object.keys(variables).length > 0) {
        bodyPayload.variables = variables;
      }
      return cmd('human_input', { job_id: Number(jobId), wait_key: String(waitKey ?? ''), body: bodyPayload });
    },

    /**
     * 订阅事件流（观察者身份）。返回 {close()}。
     * onFrame 收到的是开壳后的 {type,data,replay}；onOpen/onError 直传。
     * 任何 SSE message（含引擎 ping 心跳帧）都会刷新 lastEventAt——画布
     * 帧龄判据「同一条管子问话」的依据；onFrame 只收 event 帧（ping 被开壳丢弃）。
     */
    openEvents({ onFrame, onOpen, onError } = {}) {
      if (!eventSourceImpl) throw new Error('EventSource 不可用（非浏览器环境且未注入假件）');
      const es = new eventSourceImpl(`${url('/engine/events')}?observer=${encodeURIComponent(OBSERVER_ID)}`);
      es.onopen = () => onOpen?.();
      es.onmessage = (event) => {
        lastEventAt = Date.now();
        let obj;
        try { obj = JSON.parse(event.data); } catch { return; }
        const frame = unwrapEngineFrame(obj);
        if (frame) onFrame?.(frame);
      };
      es.onerror = (event) => onError?.(event);
      return { close: () => es.close() };
    },

    /** 事件流最后一帧到达时刻（毫秒，0=这条线从没收到过帧）——帧龄判据用。 */
    lastEventAt: () => lastEventAt,
  };
}

/**
 * 伺候方地址发现（同源 GET /femo-plugin/engine-base，dsh/web 各自实现）：
 * {ok:true, base, relay?, host?} | {ok:false}。失败/离线回 null——画布显
 * 「引擎离线」并按调用方的节奏重问，绝不自己代拉引擎。
 */
export async function discoverEngine({ fetchImpl = fetch, endpoint = '/femo-plugin/engine-base' } = {}) {
  try {
    const resp = await fetchImpl(endpoint, {
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
    });
    const body = await resp.json().catch(() => null);
    if (!body || body.ok !== true) return null;
    const base = typeof body.base === 'string' ? body.base.replace(/\/+$/, '') : '';
    const relay = typeof body.relay === 'string' ? body.relay.replace(/\/+$/, '') : '';
    if (!base && !relay) return null;
    return { base, relay, host: typeof body.host === 'string' ? body.host : '' };
  } catch {
    return null;
  }
}
