/**
 * keeper.mjs — 任务看护：唤醒闸（2026-10-02 用户三锤定案后的最终形态）。
 *
 * 同日三锤（后锤覆盖前锤；原话逐字见根 AGENTS.md §9.1 与 webAdapter 守则坑18）：
 *   ①「查岗收割」：Edge 对后台页猎杀太快、保活不成立——冻掉无所谓，定期醒来
 *     查岗收割（15s 报数轮转 reload 查岗 + 回合领养）。
 *   ②「发给谁就 reload 谁」：reload 名单=mailbox 在飞收件人——注册巡检（名单是
 *     所有标签页）零 reload，剧本外角色绝不 reload；单成员不查岗。
 *   ③「顺次进行」（终局形态）：「运行中的时候，如果有并发，这样子轮询还是不好，
 *     容易被网站风控」——Mailbox 任务到 web 侧改成顺次执行：一次只 reload 一次、
 *     盯到完整结束信号才下一个，轮到谁才看谁活着没。15s 查岗轮（本文件原
 *     createHarvestWheel）随此整体退役删除；回合领养（hello）保留——它接的是
 *     「页因任何原因重载」的收话，不是查岗。
 *
 * 本文件现在只剩「唤醒闸」：把「请台（reload/开页一体）」限流成至多 reloadBudget
 * 个同时在途、排队 FIFO、上线或超时放行。服务三处：派工侧 resolveSeat（顺次闸
 * 内「轮到谁才唤醒谁」）、主Agent席 wakeSeat、运行前点名请台（只开没开的页）。
 */

import { parseSessionRef } from '../sites.mjs';

/** 唤醒闸：把「请台（reload/开页）」限流成至多 reloadBudget 个同时在途。 */
export function createWakeGate({
  sendToAll,              // (frame) => void —— open-tab 帧发全体长轮询连接（waiter 优先）
  seats,                  // () => 席位账（bySessionLoose）——上线判定与站点解析
  log = () => {},
  reloadBudget = 2,       // 并发 reload 预算（6 连 reload 浏览器撑不住的实测上限）
  wakeTimeoutMs = 75_000, // 单次唤醒的等待上限（对齐派工侧等窗）
  pollMs = 500,           // 扫账节拍（上线判定靠它，够轻）
}) {
  /** 占预算的唤醒：sid → {startedAt} */
  const slots = new Map();
  /** 排队（FIFO）：[sid] */
  const queue = [];
  /** 在途等待者：sid → {resolve, promise}——同 sid 共享同一个 Promise（天然去重，
   *  取代旧 30s 去重账：重复请台不必拒，等同一结果就行）。 */
  const waiters = new Map();
  let scanner = null;

  const online = sid => Boolean(seats().bySessionLoose(sid)?.online);

  function settle(sid, ok) {
    const w = waiters.get(sid);
    if (!w) return;
    waiters.delete(sid);
    w.resolve(ok);
  }

  function releaseSlot(sid, ok) {
    slots.delete(sid);
    settle(sid, ok);
    pump();
  }

  /** 放行队头：有空预算就把下一个排队者推上台（发 open-tab 帧）。 */
  function pump() {
    while (slots.size < reloadBudget && queue.length) {
      const sid = queue.shift();
      if (!waiters.has(sid)) continue;
      slots.set(sid, { startedAt: Date.now() });
      const seat = seats().bySessionLoose(sid);
      const site = seat?.site || parseSessionRef(sid)?.site?.SITE_ID || '';
      sendToAll({ type: 'open-tab', sessionId: sid, ...(site ? { site } : {}) });
      if (!site) log(`wake-gate: 请台帧发出（裸 id 拆不出站点，扩展会大声跳过）：${String(sid).slice(0, 8)}…`);
      else log(`wake-gate: 请台帧发出 ${String(sid).slice(0, 8)}… @${site}（在途 ${slots.size}/${reloadBudget}，排队 ${queue.length}）`);
    }
  }

  function scan() {
    // 占位的：上线→放行（真）；超时→放行（假，诚实失败交给调用方）
    for (const [sid, s] of [...slots]) {
      if (online(sid)) { log(`wake-gate: ${String(sid).slice(0, 8)}… 上线，放行`); releaseSlot(sid, true); continue; }
      if (Date.now() - s.startedAt > wakeTimeoutMs) {
        log(`wake-gate: ${String(sid).slice(0, 8)}… 唤醒超时（${Math.round(wakeTimeoutMs / 1000)}s 仍不在线）`);
        releaseSlot(sid, false);
      }
    }
    // 排队的：自己上线了（用户手点了）→ 不占预算直接放行
    for (let i = queue.length - 1; i >= 0; i--) {
      if (online(queue[i])) {
        const sid = queue.splice(i, 1)[0];
        log(`wake-gate: ${String(sid).slice(0, 8)}… 排队中自己上线，直接放行`);
        settle(sid, true);
      }
    }
    pump();
    arm();
  }

  function arm() {
    const needed = slots.size > 0 || queue.length > 0;
    if (needed && !scanner) { scanner = setInterval(scan, pollMs); scanner.unref?.(); }
    if (!needed && scanner) { clearInterval(scanner); scanner = null; }
  }

  /** 请求唤醒（reload/开页一体）：resolve true=已上线，false=超时。扩展没连也
   *  照常等待——SW 几秒内重连，已开着的页一注册就上线。 */
  function wake(sid) {
    sid = String(sid);
    if (online(sid)) return Promise.resolve(true);
    const w = waiters.get(sid);
    if (w) return w.promise;
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    waiters.set(sid, { resolve, promise });
    queue.push(sid);
    log(`wake-gate: 排队唤醒 ${String(sid).slice(0, 8)}…（在途 ${slots.size}/${reloadBudget}，排队 ${queue.length}）`);
    arm();
    scan(); // 立即扫一拍：有空预算当场放行
    return promise;
  }

  return { wake };
}
