/**
 * sse.ts — 插座单例（2026-09-25 解环刀自 engine-events 抽出）。
 *
 * 两个「长在事件调度文件里的插座」搬回自己家：
 *  · sseChannel —— femoGen 画布 SSE 通道：重放环 cap400/短命帧过滤/checkpoint
 *    原地替换/replay 标记/15s 心跳全部唯一活在公共层 sse-core（2026-09-22 收口），
 *    这里只 new 出单例。消费方：http.broadcastSse（直推）、routes /events
 *    （connect 入座）、engine-events rememberEvent（入环）。
 *  · variableApi —— 变量世界观测 API 单例（checkpoint/func_result/assign_result
 *    归一分发，2026-09-23 十连裁⑤）；engine-events 入口分流 ingest + 定向接线。
 *
 * 【为什么单独住】原住 engine-events 时，http 要插座、调度器要广播，两头互抓
 * 成环；单例独居后依赖单向：engine-events → http → sse → 公共层，无人再为
 * 单例反向依赖调度器。
 */

import { createSseChannel } from '../../../femo2host/femoGenConnector/sse-core.mjs'
import { createVariableApi } from '../../../femo2host/host/variable-api.mjs'

/** 画布 SSE 通道单例（模块级；客户端表由通道自持——connect 时 routes.ts
 *  /events 把 res 交给通道，broadcast 时通道直推）。 */
export const sseChannel = createSseChannel()

/** 变量世界 API 单例（模块级；宿主侧插件 import { variableApi } 直接订阅）。
 *  brief 缺省/full 显式；画布 func/assign 的 In/Out 气泡面板与断点显示的
 *  活供给（variable_record 定向接线，engine-events 接线闸防双订阅）。 */
export const variableApi = createVariableApi({ log: (m) => console.log(`[femo-plugin] ${m}`) })
