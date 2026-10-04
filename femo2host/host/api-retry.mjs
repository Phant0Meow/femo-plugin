/**
 * api-retry.mjs — femo AI 角色 API 请求错误慢层兜底（规则表/决策器，公共层）。
 *
 * 2026-09-20 自 dshAdapter/host/api-retry.ts 上移公共层（批次 C，用户拍板
 * 「先把规则表搬了」）：可重试码表、五段退避阶梯、连续计数口径、决策与可取消
 * 排程是协议（docs/ActiveRoadmaps/ARCHITECTURE.md §4.7 时钟阶梯的慢层）——换宿主都成立；`agent/
 * request-error` 瀑布挂接是宿主插座，留各家（dsh 在 hostAdapter/dshAdapter/
 * host/api-retry.ts 壳里把自家事件 payload 翻译成归一失败事实后调
 * handleFailure；别家宿主接宿主侧 LLM 调用时照此形状写自己的挂接）。
 *
 * 位置在多层时钟阶梯的第二层（外层超时必须大于内层总耗时，改动任何一层前
 * 先对表）：
 *   官方快层（dsh base bundle dsh-llm-retry）  ≤5 次 500ms→10s，总 ~1min
 *   本慢层（这里）                             五段 立即/20s/1min/3min/10min，总 ~14.4min
 *   停靠经纪人 park 超时（node-retry.mjs）      15min（刻意 > 慢层总耗时）
 *   引擎 AI 等待                               3600s（最终兜底，AI 沉默 move on）
 *
 * 计数口径（P1 已裁决：连续计数·成功清零）：按 childId 记录 (turn, step)
 * 连续失败序列——新失败与上次记录的 (turn,step) 不同（=中间有 step 成功
 * 推进）→ 计数重置 1；相同 → +1。多轮 react 各 step 的偶发失败各自享
 * "立即重试"，长退避只在持续故障时发生。
 *
 * 永久性错误码不重试（P3）：NO_ADAPTER / INVALID_CREDENTIAL / MISSING_CREDENTIAL /
 * QUOTA / CONTEXT_WINDOW_EXCEEDED 等重试恒同败——这些码在官方快层就被放行
 * 根本到不了这里；此处再过滤一遍是防御装配顺序变化。
 *
 * 宿主语义契约（返回值与官方 request-error 一致）：
 *   pass() 透传 = 交还上游收尾（turn error → 宿主既有 recordError/交卷路径）；
 *   {kind:'retry'} = 同 turn 同 step、同一 durable history 原地重跑；
 *   undefined = 吞掉（延迟被 abort 打断，不透传不重试——turn 已中止/插件卸载）。
 */

/** 可重试错误码：与官方 llm-retry 快层五码一致。 */
export const RETRYABLE_CODES = new Set([
  'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT', 'EMPTY_RESPONSE',
])

/** 五段慢层退避（协议常量，猫猫纲领）：立即 / 20s / 1min / 3min / 10min。 */
export const SLOW_DELAYS_MS = [0, 20_000, 60_000, 180_000, 600_000]

/** 连续失败上限：第五次慢层重试（10min 段）之后仍失败 → 放行。没有第六次。 */
export const MAX_CONSECUTIVE_FAILURES = 5

/**
 * 一次慢层重试的作用对象。
 * @typedef {Object} ActorTarget
 * @property {'subagent' | 'main'} kind
 * @property {string} mainSessionId  主会话 id（通知/错误表定位）。
 * @property {string} childSessionId  触发失败的 agent 会话 id（子代理=run.id；main=主会话 id）。
 * @property {string} node  引擎节点 id。
 */

/**
 * 归一化后的失败事实。
 * @typedef {Object} ApiRetryFailure
 * @property {string} code
 * @property {string} message
 */

/**
 * 宿主装配回调（插座实现方注入）。
 * @typedef {Object} ApiRetryDeps
 * @property {(childSessionId: string) => (ActorTarget | undefined)} resolveTarget
 *           childId → 角色 target；未命中（主Agent轮次/用户聊天/陌生 agent/已收尾）→ undefined 透传。
 * @property {(target: ActorTarget, attempt: number, delayMs: number, failure: ApiRetryFailure) => void} onRetry
 *           每次慢层重试排程后的通知（投影窗 ⏳ / console，装配处实现）。
 * @property {(target: ActorTarget, failure: ApiRetryFailure) => void} onExhausted
 *           连续第 5 次失败：放行前通知（recordError + 投影窗 ❌，装配处实现）。
 */

/**
 * 归一失败事实（宿主从自家事件 payload 翻译而来）。
 * @typedef {Object} ApiRetryFact
 * @property {string} childId  触发失败的 agent 会话 id。
 * @property {number} turn
 * @property {number} step
 * @property {AbortSignal} signal  turn 中止信号（用户停止FEMO脚本）。
 * @property {ApiRetryFailure} failure
 */

export class ApiRetryChain {
  constructor() {
    /** 同一 childId 的连续失败记录：(turn,step) 相同 = 同一步骤连续败。 */
    this.attempts = new Map()
    this.lifetime = new AbortController()
  }

  /**
   * 瀑布下游决策 + 排程（宿主 listener 翻译完事实后调用）。
   * @param {ApiRetryFact} fact
   * @param {ApiRetryDeps} deps
   * @param {() => unknown} pass  宿主的 next()（透传放行）
   * @returns {Promise<unknown>} pass() 的返回值 / {kind:'retry'} / undefined（见头注契约）
   */
  async handleFailure(fact, deps, pass) {
    // 1. filter 未命中 → 透传（宿主默认零变——零影响关键）。顺带清掉已收尾
    //    agent 的计数残留（孤儿防泄漏：登记表已删 = 该 agent 不再归我们管）。
    const target = deps.resolveTarget(fact.childId)
    if (target === undefined) {
      this.attempts.delete(fact.childId)
      return pass()
    }
    // 2. turn 已中止（用户停止FEMO脚本）→ 不再排程重试，交还上游收尾。
    if (fact.signal.aborted) return pass()
    // 3. 永久性错误码（P3）：重试恒同败，立即放行。
    if (!RETRYABLE_CODES.has(fact.failure.code)) return pass()
    // 4. (turn,step) 连续计数（P1）：新 (turn,step) = 中间有成功推进 → 重置 1。
    const previous = this.attempts.get(fact.childId)
    const count = previous !== undefined
      && previous.turn === fact.turn && previous.step === fact.step
      ? previous.count + 1
      : 1
    if (count > MAX_CONSECUTIVE_FAILURES) {
      // 第五段（10min）重试之后仍失败：放行 = turn error = 既有 recordError/
      // 交卷路径 = 节点按结束（compiler 无感）。
      this.attempts.delete(fact.childId)
      deps.onExhausted(target, fact.failure)
      return pass()
    }
    this.attempts.set(fact.childId, { turn: fact.turn, step: fact.step, count })
    const delayMs = SLOW_DELAYS_MS[count - 1] ?? 0
    deps.onRetry(target, count, delayMs, fact.failure)
    // 5. 可取消延迟：turn abort / 宿主 dispose 都能秒级打断，不占着瀑布。
    const fused = AbortSignal.any([fact.signal, this.lifetime.signal])
    if (fused.aborted) return undefined
    const completed = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        fused.removeEventListener('abort', onAbort)
        resolve(true)
      }, delayMs)
      function onAbort() {
        clearTimeout(timer)
        resolve(false)
      }
      fused.addEventListener('abort', onAbort, { once: true })
    })
    if (!completed) return undefined
    // 6. 同 turn 同 step、同一 durable history 原地重跑（官方 request-error 语义）。
    return { kind: 'retry' }
  }

  /** 显式清某个 child 的失败计数（子代理/main 收尾路径可调用；幂等）。 */
  clearChild(childSessionId) {
    this.attempts.delete(childSessionId)
  }

  /** 宿主卸载（插件 dispose / HMR）：中止在飞延迟 + 清计数。 */
  dispose() {
    this.lifetime.abort(new Error('femo api-retry chain disposed'))
    this.attempts.clear()
  }
}

/** 通用单例（dsh 壳自建带插座的子类实例；轻量宿主可直接用这一份 + 自写挂接）。 */
export const apiRetry = new ApiRetryChain()
