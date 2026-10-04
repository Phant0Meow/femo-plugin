/**
 * variable-api.mjs — 变量世界观测 API（femo2host 公共层，2026-09-23 十连裁⑤）。
 *
 * 引擎的三个工程事件（checkpoint / func_result / assign_result）不属于戏剧事件流：
 * 它们是「变量世界」的观测面——断点存档点、函数算出的值、写进变量的值。本模块
 * 把三者归一成一种记录（VariableRecord），按调用方要的档位分发：
 *
 *  - 宿主侧进程内插件（可信）：subscribe('full') 或 toView(r,'full') 拿全量
 *    （含 checkpoint 的变量世界整包 state、func/assign 的 input 入参）；
 *  - 浏览器信道（不可信/省流量）：subscribe('brief') / toView(r,'brief')——
 *    checkpoint 只给位置+label（变量世界整包不上线，原 D5 半个口径），
 *    func/assign 剥 input。默认档=brief。
 *
 * 归一形状（字段名归一：node_name→node；engine 的 job_id 原样带 jobId）：
 *   { kind:'checkpoint',    jobId, checkpoints:{node:label}, state? }  state 仅 full
 *   { kind:'func_result',   jobId, node, output, input? }              input 仅 full
 *   { kind:'assign_result', jobId, node, output, input? }              input 仅 full
 *
 * 谁不归它管：戏剧账（hub EventProjector 段落账）照旧；黑板（运行态镜像）没有
 * 这三样的格子；state 原始动机是省流量非保密（「前端只需位置+label」D5 半个），
 * 「谁能要 full」由宿主接线决定，本层不做鉴权。
 */

export const VARIABLE_EVENTS = new Set(['checkpoint', 'func_result', 'assign_result']);

/**
 * @param {object} [opts]
 * @param {(msg: string) => void} [opts.log]
 */
export function createVariableApi({ log = () => {} } = {}) {
  /** @type {Set<{view:'brief'|'full', fn:(r:Record<string,unknown>)=>void}>} */
  const listeners = new Set();

  /** 是否本 API 管辖的事件（宿主事件入口用它分流，不进通用戏剧事件流）。 */
  function handles(eventType) {
    return VARIABLE_EVENTS.has(eventType);
  }

  /**
   * 吃一条引擎事件，归一成 VariableRecord 并分发给全部订阅者（按各自档位投影）。
   * 非管辖事件返回 null（宿主照旧走自己的路径）。
   */
  function ingest(eventType, data) {
    if (!handles(eventType)) return null;
    const d = (data ?? {});
    /** @type {Record<string, unknown>} */
    const record = {
      kind: eventType,
      jobId: typeof d.job_id === 'number' ? d.job_id : undefined,
      node: typeof d.node_name === 'string' ? d.node_name : undefined,
    };
    if (eventType === 'checkpoint') {
      record.checkpoints = (d.checkpoints ?? {});
      record.state = d.state; // 变量世界整包；仅 full 视图外发
    } else {
      record.output = d.output;
      record.input = d.input; // 入参全量；仅 full 视图外发
    }
    for (const l of [...listeners]) {
      try { l.fn(toView(record, l.view)); } catch (e) {
        log(`[variable-api] subscriber failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    return record;
  }

  /**
   * 视图投影：brief=对外口径（checkpoint 剥 state 变量世界整包、func/assign 剥
   * input 入参）；full=原样。缺省 brief。
   */
  function toView(record, view = 'brief') {
    if (view === 'full') return record;
    const r = { ...record };
    delete r.state;
    delete r.input;
    return r;
  }

  /**
   * 订阅增量。view 决定拿到的档位；返回退订函数（恰好一次语义由 Set 保证）。
   * 浏览器信道想挂这里时，由宿主接线代选档位——本层不鉴权。
   */
  function subscribe(view, fn) {
    const l = { view: view === 'full' ? 'full' : 'brief', fn };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }

  return { handles, ingest, toView, subscribe };
}
