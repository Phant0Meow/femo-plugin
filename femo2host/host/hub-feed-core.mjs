/**
 * hub-feed-core.mjs — 投影中心宿主侧喂送协议机（2026-09-25 收编）。
 *
 * 判据「公共层缺 + ≥2 宿主都在写」：dsh hub-feed.ts 的全量机制与 zcode gateway
 * /api/god-outside 的手搓简版在此合流为唯一一份。幕布是广播墙，喂送是所有宿主
 * 同一套物理规矩，宿主不需要各写第二遍。
 *
 * 「宿主 → hub」上行的全部学问（宿主不需要再知道第二遍）：
 *  - 微批：40ms / 20 条一个 POST；job 与会话两条路各一套缓冲，各自单飞行保序；
 *  - best-effort：任何失败静默吞掉——幕布绝不挡运行（产信同款纪律）。
 *    要「诚实失败」的同步场景（调用方在等结果、要向上报错的）用 postFeedFrames
 *    自己接，不走微批；
 *  - 段引用两字段、语义互斥（2026-09-19 实锤修正，混用=字落幻影段、页面不长字）：
 *      · ref    = 引擎发给这一拍的令牌（wait_key）→ 发 `wait_key`，段键
 *                 'w:<令牌>' 由 hub 拼（角色/主模型参与运行的字，有戏才有）；
 *      · segRef = 宿主自己造的整键（宿主轮 'h:<sid>:<seq>'）→ 发 `seg`，
 *                 hub 原样用（会话寻址直投，无运行照收——录制不等开戏）；
 *  - 宿主轮容器账：开容器 → 填槽 → 收口，与引擎节点轮同一套规矩，只是令牌由
 *    宿主自造——从源事件 seq 算得，水位重放算出的键一模一样（hub 同 seg 不重复
 *    开容器、同 src_seq 不重账）。
 *
 * 宿主注入三件事（契约；dsh 见 hub-feed.ts，zcode 见 gateway 同步面）：
 *  - feedUrl:     () => string        POST 目标（一般为 `${hubBaseUrl()}/feed`）
 *  - source:      () => string        POST body 的来源标签（懒读 env，可空串）
 *  - sessionAddr: (sid) => string     会话寻址地址（'host:sid'，与读侧同一词）
 */

const HAS_FETCH = typeof fetch === 'function' // 极旧 node 无全局 fetch：整路停用

/** 段引用帧的公共字段：自造整键优先（宿主轮），否则报令牌让 hub 拼键。
 *  两者都没有 → undefined（这拍字不属于任何段，不喂）。 */
function segFieldOf(base) {
  if (typeof base.segRef === 'string' && base.segRef.length > 0) return { seg: base.segRef }
  if (typeof base.ref === 'string' && base.ref.length > 0) return { wait_key: base.ref }
  return undefined
}

/** 槽键：一种内容一次 burst 一个槽——同一时刻只有一条 text / 一条 reasoning 在写，
 *  工具调用可能连着几个；键取 (kind, step, index)，重试撤掉后重开同一个键也不串。 */
function draftKeyOf(base, index, kind) {
  return [kind, base.step ?? '-', index ?? '-'].join('#')
}

/** FEMO外行 op（同步组装场景用；zcode 网关人类输入面同款形状）。
 *  kind 缺省按 role 猜：user→whisper、其余→say；actor/src_seq 空值不给键。 */
export function outsideRowOp(line) {
  return {
    op: 'row',
    zone: 'outside',
    kind: String(line.kind ?? (line.role === 'user' ? 'whisper' : 'say')),
    ...(line.actor !== undefined && line.actor !== '' ? { actor: String(line.actor) } : {}),
    text: String(line.text ?? ''),
    ...(line.src_seq !== undefined && line.src_seq !== '' ? { src_seq: String(line.src_seq) } : {}),
  }
}

/** 喂 hub 一个 POST（同步场景直接用；微批机内部也走这里）。
 *  返回 fetch 原样 Promise——错误处置（静默吞/如实上报）归调用方。 */
export function postFeedFrames(feedUrl, payload) {
  return fetch(feedUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/** 草稿快照帧对（「提交即上墙」词汇单份）：drop 清槽再放全量（幂等，重跑
 *  不叠字）。text 有字才出帧；槽键=kind#-#-（draftKeyOf 的缺省拼法——同一
 *  时刻一个 kind 只有一条流在写）。zcode 收卷器与 web 网页席同吃这一份
 *  （2026-09-29 收编，此前两宿主各手搓一份同构小喂送机）。 */
export function draftDropDeltaFrames(waitKey, kind, text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const key = draftKeyOf({}, undefined, kind)   // 缺省槽键单源（2026-09-29：手拼改调 draftKeyOf）
  return [
    { op: 'draft-drop', wait_key: waitKey, key },
    { op: 'draft-delta', wait_key: waitKey, key, kind, text },
  ]
}

/** best-effort POST 带竞速上界（旁路轨喂送专用：幕布绝不挡运行）——超时
 *  不等、失败静默，返回 Promise 永不 reject。要「诚实失败」的同步场景
 *  （调用方在等结果、要向上报错的）用 postFeedFrames 自己接。 */
export function postFeedFramesBounded(feedUrl, payload, timeoutMs) {
  return Promise.race([
    postFeedFrames(feedUrl, payload),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]).catch(() => {})
}

/**
 * 造一台喂送机（无模块级状态；一宿主一台，同宿主多处共用同一台）。
 * @param {object} opts
 * @param {() => string} opts.feedUrl
 * @param {() => string} opts.source
 * @param {(sid: string) => string} opts.sessionAddr
 */
export function createHubFeedCore(opts) {
  /** 单飞微批通道（2026-09-29 收编：job 路与会话路此前各手抄一台同构微批机
   *  ——40ms/20 条/单飞/best-effort 的纪律只剩一份，差异只在分桶与闸，作
   *  参数注入）。chain={promise} 由调用方持有：job 路一台通道一条链；会话路
   *  多桶共享一条全局链（跨桶保序）。payloadOf 在冲批时刻调用——job 路凭此
   *  拿到「冲批时刻的场次」（与收编前语义一致）。 */
  function microbatchChannel({ chain, gate, payloadOf }) {
    let buffer = []
    let timer

    function push(op) {
      if (gate && !gate()) return
      buffer.push(op)
      if (buffer.length >= 20) {
        void flush()
        return
      }
      if (timer === undefined) {
        timer = setTimeout(() => {
          timer = undefined
          void flush()
        }, 40)
      }
    }

    function flush() {
      const ops = buffer
      buffer = []
      if (ops.length === 0) return chain.promise
      // payload 在冲批时刻定格（job 路凭此拿到「冲批时刻的场次」；返回 null=
      // 闸在冲批后才翻落——这批作废，与收编前 run 内判空丢弃同义）。
      const payload = payloadOf(ops)
      if (payload === null) return chain.promise
      const run = async () => {
        try {
          await postFeedFrames(opts.feedUrl(), payload)
        } catch {
          /* hub 不在线：静默（投影是旁路，绝不影响运行） */
        }
      }
      chain.promise = chain.promise.then(run)
      return chain.promise
    }

    return { push, flush }
  }

  // ── job 寻址微批（引擎路径：角色/主模型参与运行的字，有戏才有）────────────────
  let currentJob = null
  const jobChannel = microbatchChannel({
    chain: { promise: Promise.resolve() },
    gate: () => currentJob !== null && HAS_FETCH,
    payloadOf: ops => currentJob === null
      ? null
      : { job_id: currentJob, source: opts.source(), frames: ops },
  })

  // ── 会话寻址微批（宿主FEMO外直投，无运行照喂）────────────────────────────────
  // 每个会话地址一桶（一批 POST 打死一个 session，hub 按地址入账），不看场次；
  // 全局一条单飞链保跨桶顺序。
  const sessChain = { promise: Promise.resolve() }
  const sessChannels = new Map()
  const sessChannelOf = addr => {
    let ch = sessChannels.get(addr)
    if (ch === undefined) {
      ch = microbatchChannel({
        chain: sessChain,
        gate: () => HAS_FETCH,
        payloadOf: ops => ({ session: addr, source: opts.source(), frames: ops }),
      })
      sessChannels.set(addr, ch)
    }
    return ch
  }
  const sessPush = (addr, op) => sessChannelOf(addr).push(op)
  const sessFlush = addr => sessChannelOf(addr).flush()

  // ── 宿主轮容器账（FEMO外主Agent轮：自己开容器、自己收口）──────────────────────
  // seg = h:<sid>:<seq>，从源事件算得（重放同键，hub 幂等）。sid 的FEMO外轮天然
  // 串行，一人一格簿；重复开 = 先把旧的收掉，绝不叠容器。
  const hostSegs = new Map()

  function hostSegClose(sid, items) {
    const cur = hostSegs.get(sid)
    hostSegs.delete(sid)
    if (cur === undefined) return
    sessPush(opts.sessionAddr(sid), { op: 'seg-close', seg: cur.seg, items, src_seq: cur.closeSrc })
  }

  return {
    /** 场次登记：引擎事件入口（带 job_id）每事件刷新；null=停喂 job 寻址路。
     *  会话寻址帧不过这道闸（录制无条件）。 */
    setJob(jobId) {
      currentJob = jobId
    },

    /** 流式块 → 草稿帧（词汇判定：text-delta/reasoning-delta/tool-call-delta；
     *  只有名字没参数的工具块不开槽，等参数到了再开）。 */
    feedChunk(base, chunk) {
      try {
        const ref = segFieldOf(base) // 令牌（引擎轮）或整键（宿主轮）：hub 说了算
        if (ref === undefined) return
        const sess = ref.seg !== undefined
        if (!sess && currentJob === null) return
        const emit = (op) => {
          if (sess) sessPush(opts.sessionAddr(base.sid), op)
          else jobChannel.push(op)
        }
        if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
          if (typeof chunk.text !== 'string' || chunk.text.length === 0) return
          const kind = chunk.type === 'reasoning-delta' ? 'reasoning' : 'text'
          emit({ op: 'draft-delta', ...ref, key: draftKeyOf(base, chunk.index, kind), kind, text: chunk.text })
        } else if (chunk.type === 'tool-call-delta') {
          const name = typeof chunk.name === 'string' && chunk.name.length > 0 ? chunk.name : undefined
          const args = typeof chunk.argumentsDelta === 'string' ? chunk.argumentsDelta : ''
          if (args.length === 0) return // 只有名字没内容：等参数到了再开槽
          emit({
            op: 'draft-delta', ...ref, key: draftKeyOf(base, chunk.index, 'toolcall'),
            kind: 'toolcall', text: args, ...(name !== undefined ? { name } : {}),
          })
        }
      } catch {
        /* 静默 */
      }
    },

    /** 清屏（内容交接/孤儿 attempt）：这一拍已写出去的字作废，hub 撤该容器里的
     *  草稿（页面同步撤），容器本身留着。寻址分叉同 feedChunk。 */
    clearBucket(base) {
      const ref = segFieldOf(base)
      if (ref === undefined) return
      if (ref.seg !== undefined) sessPush(opts.sessionAddr(base.sid), { op: 'draft-drop', ...ref })
      else jobChannel.push({ op: 'draft-drop', ...ref })
    },

    /** 开一个宿主轮容器（user 发言那拍调用：位置就此锁定在 user 之后）。
     *  重复开（同一 sid 上一轮还没收口）= 先把旧的收掉，绝不叠容器。 */
    hostSegOpen(sid, o) {
      const prev = hostSegs.get(sid)
      if (prev !== undefined) hostSegClose(sid, [])
      const seg = `h:${sid}:${o.seq}`
      hostSegs.set(sid, {
        seg,
        /** 收口用的幂等键（从同一枚 seq 推出来，重放时一模一样）。 */
        closeSrc: `main:${sid}:seg${o.seq}:turn`,
      })
      sessPush(opts.sessionAddr(sid), {
        // role:'main'=段角色标（显示策略用）：宿主轮容器=主 Agent 的声音
        op: 'seg-open', seg, zone: 'outside', actor: '主Agent', node: '', text: '', role: 'main',
        ...(o.turn !== undefined ? { turn: o.turn } : {}),
      })
      return seg
    },

    /** 本 sid 当前开着的宿主轮容器（主Agent流据此把字喂进去）；没开就没有
     *  ——FEMO内轮不开宿主容器，它的字由桥那条路（wait_key）喂。 */
    hostSegCurrent(sid) {
      return hostSegs.get(sid)?.seg
    },

    /** 收口本 sid 的宿主轮（turn/end 那拍）：定稿 items 交给 hub，同 kind 的
     *  流式草稿被吸收、没流到的 kind 由草稿转正兜底（宿主不必自己防双份）。 */
    hostSegClose(sid, items) {
      hostSegClose(sid, items)
    },

    /** 通用 op 喂送口：**job 寻址**专用（闸门照旧；调试与未来引擎侧直投用）。
     *  会话寻址帧走 feedRow / 宿主轮三口，不走这里。 */
    feedOp(op) {
      jobChannel.push(op)
    },

    /** 行旁挂：会话寻址直投、无运行照喂（src_seq 由调用方给足，hub 幂等去重）。 */
    feedRow(sid, row) {
      sessPush(opts.sessionAddr(sid), { op: 'row', ...row })
    },
  }
}
