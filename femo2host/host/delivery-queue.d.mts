/**
 * delivery-queue.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

export declare class MainDeliveryQueue<T> {
  noteTurnStart(sid: string, turn: number): void
  noteTurnEnd(sid: string): void
  openTurn(sid: string): number | undefined
  queuedCount(sid: string): number
  offer(sid: string, item: T): boolean
  enqueue(sid: string, item: T): void
  peek(sid: string): T | undefined
  takeNext(sid: string): T | undefined
  dropAll(sid: string): T[]
  dropWhere(sid: string, match: (item: T) => boolean): T[]
  forget(sid: string): T[]
  clear(): void
}
