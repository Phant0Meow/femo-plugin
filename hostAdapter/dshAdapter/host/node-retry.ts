/**
 * node-retry.ts — 停靠经纪人（dsh 绑定壳）。
 *
 * 2026-09-15 协议上移：停靠模型/信号翻译/安全网唯一活在
 * femo2host/host/node-retry.mjs（零宿主依赖；原 safeSteer 依赖已内联为守卫）。
 * 本文件只剩插件级单例 broker 与类型/常量再导出——所有 './node-retry' 消费方
 * （subagent/subagent-native/engine-events/main-actor/index）零改动。
 */
import { NodeRetryBroker as CoreNodeRetryBroker } from '../../../femo2host/host/node-retry.mjs'

// ═══ 已退役（观察期起 2026-09-27 死代码排查，全仓零消费——公共层正身 node-retry.mjs 同况，停靠实用同文件私有 PARK_TIMEOUT_MS；观察无误后连行删除） ═══
// export { RETRY_TURN_TIMEOUT_MS } from '../../../femo2host/host/node-retry.mjs'
export { RETRY_STEER_TEXT, SET_VARIABLE_TEACHING } from '../../../femo2host/host/node-retry.mjs'
export type { ParkVerdict, ParkerKind, ParkerSpec } from '../../../femo2host/host/node-retry.mjs'

/** 空子类导出（保留 class 的值+实例类型双语义——`import type { NodeRetryBroker }`
 *  与 `new NodeRetryBroker()` 都照旧）。 */
export class NodeRetryBroker extends CoreNodeRetryBroker {}

/** 插件级单例：subagent.ts（登记/停靠）、engine-events.ts（信号接线）、
 *  index.ts（onExited/dispose）与 main-actor.ts 共用同一实例。 */
export const broker = new NodeRetryBroker()
