/**
 * event-router.mjs — 引擎事件总调度（ZCode 绑定层，薄壳）。
 *
 * 2026-09-15 分诊台上移：事件分发骨架/运行态镜像/主Agent员队列/回传合约唯一
 * 活在 femo2host/host/event-core.mjs（dsh 的 engine-events.ts 是它的 TS 孪生，
 * 解禁后接同一份——落点接口按形态 B 预留：写公告/翻黑板/拉动作）。
 * 本文件只剩 ZCode 绑定：send 接桥。
 * 【2026-09-25 幕布自存落点退役】hub 是投影唯一数据面（宿主侧不存投影历史
 * ——femo2host/AGENTS §四现行法），三窗 JSONL 自存柜整体退役（projection-writer
 * 移 mytrashbin）。store 参数仅测试注入（tests/memory-store.mjs 钉落点语义），
 * 缺省空实现。
 */

import { importCore } from '../paths.mjs';

const { createEventCore } = await importCore('event-core.mjs');

/** 单运行时事件路由器（对外接口与原版完全一致——gateway/femo-server/测试零改动）。
 * @param {object} opts
 * @param {object}  [opts.store] 内存投影 store（仅测试；生产缺省=空幕布落点）
 * @param {string}  [opts.sid]   投影窗会话键（v1 单运行时，恒 'femo-main'）
 * @param {('off'|'queue')} [opts.dispatch] 分诊台派工模式（v2 默认 'off'=单通道
 *     纯记账；'queue'=v1 遗留拉取队列）——透传 event-core
 * @param {(cmd: string, args?: object, timeoutMs?: number) => Promise<unknown>} opts.send
 *     bridge.send 的绑定（human_input 回传走这里；测试可注入桩）
 * @param {(msg: string) => void} [opts.log]
 */
export function createEventRouter({ store, sid = 'femo-main', send, dispatch, log = () => {} }) {
  return createEventCore({
    sid,
    send,
    dispatch,
    log,
    // 幕布落点：生产=空实现（投影历史归 hub）；注入 store=测试内存窗。
    board: store
      ? {
          ensureWindows: actors => store.ensureWindows(sid, actors),
          chat: (text, rowOpts, scopeOpts) => store.chat(sid, text, rowOpts, scopeOpts),
        }
      : { ensureWindows: () => {}, chat: () => {} },
  });
}
