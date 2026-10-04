/**
 * projection-core.mjs — 投影窗公共层（幕布的誊抄制度，host 无关）。
 *
 * 三份实现的语义交集（dsh projection.ts+windowing-native+section-gate、
 * zcode projection-writer.mjs、Python gateway_ui.py）逐行对照后收拢于此
 * （2026-09-16，依《投影合一设计.md》）。窗的物理形态（DSH 会话 / JSONL
 * 文件 / 内存数组）与窗的生老病死是绑定层唯一的工作；本文件只管：
 *
 *   纯函数   actorKeyOf / dedupeStructKey / replayKey / resolveTargets / chatRow
 *   账本     WindowLedger —— 源级+结构级双幂等索引 + 窗内行号游标
 *   闸门     SectionGate —— 回合区块按开跑顺序 FIFO 落盘（par 不穿插）——已退役观察期 2026-09-27（生产端三窗自存退役后零调用）
 *   分派器   createProjectionAppender —— god+stage 恒全量 + scope 分发 + 双幂等拦截
 *
 * 分派语义钉死（三份实现的共同骨架，改前先读《投影合一设计.md》§2.4）：
 *   - 流经分派器的都是FEMO内/运行态内容 → god+stage 恒全量；
 *     FEMO外镜像（dsh god-mirror）不经此处——搜索来源二分的根基；
 *   - skipGod：main 轮专用（god 窗已有镜像覆盖）；
 *   - targets 经 resolveTargets 归一：undefined 与 [] 同义（=全可见，
 *     绝不解释为「无人可见」——2026-08-22 运行中人视角空白教训）；
 *   - 每窗：ledger.check 拦截 → write → ledger.mark（防竞态二次写入）。
 */

/** 结构事件类型（骨架去重键的适用范围）。 */
const STRUCTURAL = new Set(['turn/start', 'turn/end', 'step/start', 'step/end']);

/**
 * 角色名 → 窗键：非 [A-Za-z0-9_-] 逐字符换 `_` + 码点 hex（@ → _40）。
 * 不同角色名必得不同键（旧压 _ 算法双键同窗双写的教训）；文件名安全。
 *
 * 【命名法】所有名字恒以 '@' 开头，@ 是名字的一部分——引擎从解析起就保留
 * @（actors 注册表键='@我'），scope 列表无论 all/self/显式全部产出 '@名'。
 * 因此窗键匹配是【全等匹配】，不做任何 @ 剥离；裸名出现在匹配目标里即是
 * 调用方 bug。
 */
export function actorKeyOf(name) {
  let out = '';
  for (const ch of String(name)) {
    if (/[A-Za-z0-9_-]/.test(ch)) out += ch;
    else out += `_${ch.codePointAt(0).toString(16)}`;
  }
  return out || '_';
}

/** 结构去重键：turn/start|end → `type:turn`；step/start|end → `type:turn:step`；
 *  其余 undefined。 */
export function dedupeStructKey(eventType, d) {
  if (typeof d?.turn !== 'number') return undefined;
  if (eventType === 'turn/start' || eventType === 'turn/end') return `${eventType}:${d.turn}`;
  if ((eventType === 'step/start' || eventType === 'step/end') && typeof d.step === 'number') {
    return `${eventType}:${d.turn}:${d.step}`;
  }
  return undefined;
}

/** 重放/并集身份键：type + data 稳定字段串联（_srcSeq/turn/step/seq/kind/index/actor）。 */
export function replayKey(type, d = {}) {
  return [
    type,
    String(d._srcSeq ?? ''),
    typeof d.turn === 'number' ? String(d.turn) : '',
    typeof d.step === 'number' ? String(d.step) : '',
    String(d.seq ?? ''),
    String(d.kind ?? ''),
    typeof d.index === 'number' ? String(d.index) : '',
    String(d.actor ?? ''),
  ].join('|');
}

/** scope 归一：[] 与 undefined 同义（=全可见，绝不解释为「无人可见」）。
 *  返回 undefined=全员，数组=指定角色窗。 */
export function resolveTargets(targetActors) {
  return targetActors !== undefined && targetActors.length === 0 ? undefined : targetActors;
}

/** chat 行构造（三份实现同 schema）：{actor?, text, kind, visible?, turn?,
 *  step?, _srcSeq?, seq}。seq=Date.now()（两宿主同款）；chatType 由绑定传入
 *  （'femo-plugin/chat' vs 'femo/chat'）。未传字段一律不带键（无损 JSON 纪律）。 */
export function chatRow(chatType, { text, kind, actor, visible, turn, step, srcSeq } = {}) {
  return {
    type: chatType,
    data: {
      ...(actor === undefined ? {} : { actor }),
      text,
      kind,
      ...(visible === undefined ? {} : { visible }),
      ...(turn === undefined ? {} : { turn }),
      ...(step === undefined ? {} : { step }),
      ...(srcSeq === undefined ? {} : { _srcSeq: srcSeq }),
      seq: Date.now(),
    },
  };
}

// ── 窗账本（每窗一份的幂等索引）──────────────────────────────────────

/**
 * 源级+结构级双幂等账本（O(1) Set，语义与 dsh dedupeIndexFor / zcode WindowCtx
 * 完全等价）。
 *  - seed(rows)：懒构建来源由绑定注入（zcode 传文件行 {type,data,seq}，
 *    dsh 传 readSessionEvents 结果）；只建一次；行带数字 seq 时顺带恢复行号游标。
 *  - check(type, data) → 'ok' | 'dup-src' | 'dup-struct'
 *  - mark(type, data)：write 成功后补键（也供绑定的带外钩子调用——dsh 的全局
 *    session/event 钩子对已建账本的窗同步补键，任何 append 来源不漏键）。
 *  - nextSeq()：窗内单调行号游标（JSONL 绑定用；dsh 不需要可不用）。
 *  - srcSeqs / structKeys：底层 Set 窥视口（dsh 消费方的 .has() 直访兼容面）。
 */
export class WindowLedger {
  constructor() {
    this.srcSeqs = new Set();
    this.structKeys = new Set();
    this.cursor = 0;
    this.seeded = false;
  }

  seed(rows) {
    if (this.seeded) return;
    this.seeded = true;
    for (const row of rows) {
      const d = row.data ?? {};
      if (d._srcSeq !== undefined) this.srcSeqs.add(d._srcSeq);
      const sk = dedupeStructKey(row.type, d);
      if (sk !== undefined) this.structKeys.add(sk);
      if (typeof row.seq === 'number' && row.seq > this.cursor) this.cursor = row.seq;
    }
  }

  check(type, data) {
    const d = data ?? {};
    if (d._srcSeq !== undefined && this.srcSeqs.has(d._srcSeq)) return 'dup-src';
    const sk = dedupeStructKey(type, d);
    if (sk !== undefined && this.structKeys.has(sk)) return 'dup-struct';
    return 'ok';
  }

  mark(type, data) {
    const d = data ?? {};
    if (d._srcSeq !== undefined) this.srcSeqs.add(d._srcSeq);
    const sk = dedupeStructKey(type, d);
    if (sk !== undefined) this.structKeys.add(sk);
  }

  nextSeq() {
    return ++this.cursor;
  }
}

// ── 回合区块闸门（par 不穿插的机制本身）──────────────────────────────

// ═══ 已退役（观察期起 2026-09-27 femo2host 死代码排查，全仓零引用；观察无误后连块删除）：SectionGate（回合区块闸门；生产端三窗自存退役后，段闸门语义实际由 WindowLedger/createProjectionAppender 内部记账实现，此类零调用） ═══
// /**
//  * 整段区块按开跑顺序 FIFO 落盘（讨论稿第三节「作为一整块；par 不能穿插」的
//  * 机制实现）。上帝窗段落顺序 = 角色开跑顺序（甲乙乙甲），段内恒完整、绝不
//  * 换位。begin 占顺位 / waitActorFlush 同角色防串桶 / commit 挂 runner 按序
//  * 冲刷就绪前缀 / dropPending 停止运行清队。runner 均为同步写窗，单线程绝不交错。
//  * 全部内存态，重启即空。trace?: (event, info) => void 注入诊断埋点
//  * （dsh 挂 projTrace，zcode 不挂）。
//  */
// export class SectionGate {
//   constructor({ trace } = {}) {
//     this.queues = new Map();    // sid → Entry[]
//     this.actorLast = new Map(); // `sid\u0000actorKey` → { promise, resolve }
//     this.trace = trace;
//   }
//
//   #readyPattern(q) {
//     return q.map(e => (e.ready ? 'R' : '-')).join('');
//   }
//
//   /** 节点开跑登记（ai_request 处理起点），占据 FIFO 顺位；同 turn 重复 begin 幂等。 */
//   begin(sid, turn, actorKey) {
//     let q = this.queues.get(sid);
//     if (q === undefined) { q = []; this.queues.set(sid, q); }
//     if (q.some(e => e.turn === turn)) return;
//     const entry = { turn, actorKey, ready: false, run: undefined };
//     let resolve;
//     const promise = new Promise(r => { resolve = r; });
//     entry.hook = { promise, resolve };
//     q.push(entry);
//     this.actorLast.set(`${sid}\u0000${actorKey}`, entry.hook);
//     this.trace?.('begin', { turn, actorKey, queueLen: q.length, headTurn: q[0]?.turn, readyPattern: this.#readyPattern(q) });
//   }
//
//   /** 同角色上一区块的落盘完成钩子（未登记过 = 立即通过）。必须在 begin(自己) 前 await。 */
//   waitActorFlush(sid, actorKey) {
//     const hook = this.actorLast.get(`${sid}\u0000${actorKey}`);
//     this.trace?.('waitFlush', { actorKey, hasHook: hook !== undefined });
//     return hook?.promise ?? Promise.resolve();
//   }
//
//   /** 区块就绪：挂 runner 按序冲刷就绪前缀。commit 无对应 begin 时（重试回合等
//    *  二次提交）就绪 entry 排到队尾，保持相对顺序。幂等由调用方 released 旗标保证。 */
//   commit(sid, turn, actorKey, run) {
//     let q = this.queues.get(sid);
//     if (q === undefined) { q = []; this.queues.set(sid, q); }
//     const entry = q.find(e => e.turn === turn);
//     if (entry === undefined) q.push({ turn, actorKey, ready: true, run });
//     else { entry.run = run; entry.ready = true; }
//     this.trace?.('commit', { turn, actorKey, queueLen: q.length, headTurn: q[0]?.turn, readyPattern: this.#readyPattern(q) });
//     this.#tryFlush(sid);
//   }
//
//   /** 丢弃未就绪区块（Job 停止/flow_done 收尾用，防永久堵队）。返回被丢弃的 turn 列表。 */
//   dropPending(sid) {
//     const q = this.queues.get(sid);
//     if (q === undefined) return [];
//     const dropped = q.filter(e => !(e.ready && e.run !== undefined)).map(e => e.turn);
//     this.queues.delete(sid);
//     return dropped;
//   }
//
//   #tryFlush(sid) {
//     const q = this.queues.get(sid);
//     if (q === undefined) return;
//     while (q.length > 0 && q[0].ready && q[0].run !== undefined) {
//       const entry = q.shift();
//       this.trace?.('flush', { turn: entry.turn, actorKey: entry.actorKey, remaining: q.length });
//       entry.run();
//       entry.hook?.resolve();
//     }
//   }
// }

// ── 投影分派器 ─────────────────────────────────────────────────────

/**
 * scope 分派 + 双窗全量 + 幂等拦截——三份实现的共同骨架。
 *
 * @param opts.windowsOf(scope) → { god?, stage?, actors: Map<窗键, winRef> } | undefined
 *   scope 是不透明令牌：zcode 传 sid（内部查会话表），dsh 直接传窗对象
 *   （windowsOf = w => w）。
 * @param opts.ledgerOf(winRef) → WindowLedger（绑定负责先完成懒构建种子）
 * @param opts.write(winRef, type, data, surfaceOp?, winName?) → void
 *   物理落一行（已过账本 check）。**write 抛错 = 该窗未 mark**（失败事件可重试）；
 *   其余窗继续（经 onWriteError 上报）或整体上抛（未注入 onWriteError 时，
 *   保持各宿主现状）。
 * @param opts.keyOf?  目标角色名 → actors Map 键（zcode 传 actorKeyOf——Map 以
 *   消毒键存窗；dsh 缺省恒等——Map 以原始角色名存窗）。
 * @param opts.onWriteError? (error, winName, type) => void
 * @param opts.onSkip? (reason: 'dup-src'|'dup-struct', winName, type) => void
 *   幂等拦截埋点（dsh 挂 projTrace 诊断，zcode 不挂）。
 * 返回 append(scope, type, data, { targetActors?, skipGod?, surfaceOp? }) → written
 */
export function createProjectionAppender(opts) {
  const { windowsOf, ledgerOf, write, keyOf = name => name, onWriteError, onSkip } = opts;
  return function append(scope, type, data, { targetActors, skipGod, surfaceOp } = {}) {
    const s = windowsOf(scope);
    if (s === undefined) return 0;
    const targets = resolveTargets(targetActors);
    let written = 0;
    const appendTo = (win, winName) => {
      if (win === undefined) return;
      const ledger = ledgerOf(win);
      const verdict = ledger.check(type, data);
      if (verdict !== 'ok') {
        onSkip?.(verdict, winName, type);
        return;
      }
      try {
        write(win, type, data, surfaceOp, winName);
      } catch (error) {
        if (onWriteError === undefined) throw error;
        onWriteError(error, winName, type);
        return;
      }
      ledger.mark(type, data);
      written += 1;
    };
    if (skipGod !== true) appendTo(s.god, 'god');
    // stage 与 god 同权：全部流经本函数的事件都是FEMO内/运行态内容，FEMO内窗全量
    // 归档（主会话镜像走 god-mirror 直写 god 窗，不经此处——搜索来源二分的根基）。
    appendTo(s.stage, 'stage');
    if (targets === undefined) {
      for (const [name, win] of s.actors.entries()) appendTo(win, `角色:${name}`);
    } else {
      for (const name of targets) appendTo(s.actors.get(keyOf(name)), `角色:${name}`);
    }
    return written;
  };
}
