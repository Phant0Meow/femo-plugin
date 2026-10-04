/**
 * delivery-queue.mjs — 「FEMO内注入等本轮收口」队列（femo2host 公共层）。
 *
 * 从 dshAdapter/host/main-delivery-queue.ts 原样上移（2026-09-15；纯状态机，
 * 零宿主依赖，zcode 的 directive 队列是它的同构亲族）。语义：注入不能插进
 * 正在飞的会话回合（会被消费进那轮的上下文/交卷），等轮收口后作为新一轮的
 * 开头交付；一次只放一条——每个节点各占一轮。
 */

export class MainDeliveryQueue {
  /** 主会话最近一次轮开启记下的轮号（有轮在飞；轮收口删条目）。 */
  open = new Map();
  /** 排队中的交付件（FIFO，按会话）。 */
  queued = new Map();

  /** 轮开启：本会话有轮在飞。 */
  noteTurnStart(sid, turn) {
    this.open.set(sid, turn);
  }

  /** 轮收口（此后交付立即放行，直到下一次轮开启）。 */
  noteTurnEnd(sid) {
    this.open.delete(sid);
  }

  /** 在飞轮号（无 → undefined；日志/诊断用）。 */
  openTurn(sid) {
    return this.open.get(sid);
  }

  /** 排队条数。 */
  queuedCount(sid) {
    return this.queued.get(sid)?.length ?? 0;
  }

  /** 投递一条交付件：true = 立即交付（无轮在飞），false = 已排队等本轮收口。 */
  offer(sid, item) {
    if (this.open.get(sid) === undefined) return true;
    this.enqueue(sid, item);
    return false;
  }

  /** 显式入队（2026-09-23）：调用方已判定"必须排队"（账本说轮在飞 / driver
   *  实际忙）——只入队，不查轮开闭、不去重。与 offer 的分工：offer 是"问一句
   *  能不能立即交付"，enqueue 是"我知道要排队，替我排上"。 */
  enqueue(sid, item) {
    let q = this.queued.get(sid);
    if (q === undefined) {
      q = [];
      this.queued.set(sid, q);
    }
    q.push(item);
  }

  /** 队首只读（交付前窥视：等待期间被作废 → 自然不再交付）。 */
  peek(sid) {
    return this.queued.get(sid)?.[0];
  }

  /** 轮收口：取队首一条（无 → undefined）。 */
  takeNext(sid) {
    const q = this.queued.get(sid);
    if (q === undefined || q.length === 0) return undefined;
    const next = q.shift();
    if (q.length === 0) this.queued.delete(sid);
    return next;
  }

  /** 作废本会话排队件（FEMO脚本停止/出错）：返回被丢弃条目——调用方负责 resolve
   *  其交卷槽，防悬挂。轮开闭状态不动（用户可能还在说话）。 */
  dropAll(sid) {
    const q = this.queued.get(sid);
    this.queued.delete(sid);
    return q ?? [];
  }

  /** 按条件剔除排队件（节点收尾兜底：等它的那个人已经走了）。返回被剔除条目。 */
  dropWhere(sid, match) {
    const q = this.queued.get(sid);
    if (q === undefined || q.length === 0) return [];
    const kept = [];
    const dropped = [];
    for (const item of q) (match(item) ? dropped : kept).push(item);
    if (kept.length === 0) this.queued.delete(sid);
    else this.queued.set(sid, kept);
    return dropped;
  }

  /** 彻底遗忘本会话（换场/卸载）：队列 + 轮开闭状态全清。 */
  forget(sid) {
    const dropped = this.dropAll(sid);
    this.open.delete(sid);
    return dropped;
  }

  /** 全清（卸载）。 */
  clear() {
    this.queued.clear();
    this.open.clear();
  }
}
