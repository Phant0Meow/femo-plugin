/**
 * api-retry.ts — femo AI 角色 API 请求错误慢层兜底（dsh 插座壳）。
 *
 * 2026-09-20 规则表上移公共层（批次 C）：可重试码表 / 五段退避阶梯 / 连续计数
 * 口径 / 决策与可取消排程唯一活在 femo2host/host/api-retry.mjs（§4.7 时钟阶梯
 * 慢层，协议归公共）。本文件只剩 dsh 插座：把 cordis `agent/request-error`
 * 瀑布 payload 翻译成归一失败事实（childId/turn/step/signal/failure）交给核心
 * handleFailure，并持有官方 request-error 语义的 next 透传——装配点/官方快层
 * 先后关系（base bundle 先装配 → 快层先消费，profile patch 插件晚装配 → 快层
 * 耗尽才落到这里，cordis.patch.yml L84-85）不变。别的宿主接宿主侧 LLM 调用
 * 时照本文件形状写自己的挂接壳。
 *
 * 消费方零改动：index.ts 的 `ctx.effect(() => apiRetry.install(ctx, {...}))`
 * 与 subagent(-native)/main-actor 的 `apiRetry.clearChild(...)` 原样。
 */

import type { Context } from '@deepseek-ai/cordis'
import { ApiRetryChain as CoreApiRetryChain } from '../../../femo2host/host/api-retry.mjs'
import type { ApiRetryDeps } from '../../../femo2host/host/api-retry.mjs'

export type { ActorTarget, ApiRetryFailure, ApiRetryDeps } from '../../../femo2host/host/api-retry.mjs'

/** dsh 插座：`agent/request-error` 瀑布下游 listener。返回 disposer（HMR 安全：
 * 移除 listener + 中止在飞延迟 + 清计数——dispose 在核心）。 */
export class ApiRetryChain extends CoreApiRetryChain {
  install(ctx: Context, deps: ApiRetryDeps): () => void {
    const disposeListener = ctx.on('agent/request-error', async (payload, next) => {
      // 核心返回 pass() 的透传值 / {kind:'retry'} / undefined——契约上就是这个
      // 并集，收窄以匹配 cordis request-error 的 handler 返回形状。
      const verdict = await this.handleFailure({
        childId: String(payload.agent.session.id),
        turn: payload.turn,
        step: payload.step,
        signal: payload.signal,
        failure: { code: String(payload.failure.code), message: String(payload.failure.message) },
      }, deps, next)
      return verdict as undefined | { kind: 'retry' }
    })
    return () => {
      disposeListener()
      this.dispose()
    }
  }
}

/** 插件级单例：index.ts 装配 install 与 subagent(-native)/main-actor finally 的
 *  clearChild 共用同一实例（模块级常量风格，与 node-retry broker 一致）。 */
export const apiRetry = new ApiRetryChain()
