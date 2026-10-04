/**
 * main-delivery-queue.ts — 「FEMO内注入等本轮收口」队列（dsh 绑定壳）。
 *
 * 2026-09-15 上移：队列状态机唯一活在 femo2host/host/delivery-queue.mjs
 * （纯状态机零宿主依赖；zcode 的 directive 队列是它的同构亲族，phase3 收编）。
 * 本文件只剩再导出——main-actor.ts / engine-events.ts / tests 零改动。
 */
export { MainDeliveryQueue } from '../../../femo2host/host/delivery-queue.mjs'
