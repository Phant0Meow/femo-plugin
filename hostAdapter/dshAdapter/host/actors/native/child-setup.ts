/**
 * actors/native/child-setup.ts — 常驻角色子代理的一次性设置与错误描摹
 * （2026-09-26 刀⑥自 subagent-native.ts 迁出，纯搬家）。
 *
 * 三件：
 *  - setupChildAgent：首建/冷恢复后的子代理设置——委派权限钉子 + 官方澄清段
 *    + 推理档位钩子（唯一调用点在主流程首建与冷恢复重装两处）。
 *  - childTurnError：回合是否以「执行体错误」收场的描摹（纯函数）。
 *  - debugEffortLog：档位钉法落盘日志员（唯一调用点在首建路径；刀①自
 *    已退役文件迁来，刀⑥再随主流程分家落此）。
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { ResolvedConfig } from '../../config'
import { appendDebugLog } from '../../diag/debug-log'
import { appendActorPolicyPins, FEMO_CHILD_SCOPE_TEXT } from '../../../../../femo2host/host/subagent-core.mjs'

// ── 角色子代理诊断日志 ─────────────────────────────────────────────────────
/** 把"建角色子代理时钉了什么档位/来源"落盘（cache/logs/debug-effort-hook.log）。
 *  宿主 console 在生产实例里看不到，档位/模型这类请求参数只有落盘才能事后
 *  对账（2026-09-10 gemma 空台词事故即靠它反查）。【2026-09-25 迁入】原住
 *  已退役文件，唯一消费方就是本文件，随该文件删除落在调用点旁。 */
export function debugEffortLog(resolved: ResolvedConfig, tag: string, detail: string): void {
  appendDebugLog(resolved.femoRoot, 'debug-effort-hook.log',
    '[' + new Date().toISOString() + '] ' + tag + ' ' + detail)
}

/** 子代理一次性设置：委派权限钉子 + 官方澄清段 + 推理档位钩子。与旧路径
 *  （subagent.ts runAiSubagent 中段）语义逐条对齐；钩子闭包经 holder 读
 *  「最近一次节点调用」的 actor thinking（跨节点更新由注册表条目承担）。
 *  @param policyAppends - true=首建（append 沙箱/审批钉子）；false=冷恢复
 *  重装（钉子已随日志 fold 恢复，只补 agent-scoped 的钩子与澄清段）。 */
export function setupChildAgent(
  ctx: Context,
  childId: string,
  reasoningHolder: { actorThinking?: string },
  resolved: ResolvedConfig,
  defaultModel?: { currentSelection(): unknown },
  policyAppends: boolean = true,
): void {
  const agent = ctx.agents.get(SessionId(childId)) as
    | { session?: { append(type: string, data: unknown, surface?: unknown): void }; ctx?: Context }
    | undefined
  if (agent === undefined) {
    console.log(`[femo-plugin][native] child agent ${childId} not live after creation — delegation/reasoning setup skipped`)
    return
  }
  if (policyAppends && agent.session !== undefined) {
    // 委派权限（与旧路径同款：标准模式 workspace-write + ask；fold 最后写胜出）。
    appendActorPolicyPins(agent.session)
  }
  const childSystemPrompt = (agent.ctx as unknown as {
    systemPrompt?: { context(c: { name: string; order: number; text: string }): () => void }
  } | undefined)?.systemPrompt
  childSystemPrompt?.context({
    name: 'femo:child-scope',
    order: 121,
    text: FEMO_CHILD_SCOPE_TEXT,
  })
  // 推理档位钩子（2026-09-10 与FEMO脚本解析对齐）：
  //   - 角色声明了 thinking（femo 已把显式 default 归一化为"未声明"）→ 钉该档位；
  //   - 没声明 → **不下发 reasoningEffort 字段**（= 宿主/部署自决，语义同模型
  //     选择器的 Default 项）。旧代码在这里回落到插件 subagentReasoning 或全局
  //     默认模型档位，会把主会话的 high 硬塞给"没声明档位"的角色——非推理模型
  //     （local/gemma-3-4b-it）直接 400。档位一律由角色声明决定，不猜。
  // 剥离继承 effort 仍是必须的：dsh 会把母会话最近一次请求的 effort 复制给子
  // 代理，不清就会漏给下游模型。
  agent.ctx?.on('agent/request', async (_payload: unknown, next: (p: unknown) => Promise<Record<string, unknown>>) => {
    const resolvedCall = await next(_payload)
    const effort = reasoningHolder.actorThinking
    const { reasoningEffort: _inherited, ...withoutInherited } = resolvedCall
    return {
      ...withoutInherited,
      ...effort !== undefined && effort.length > 0 ? { reasoningEffort: effort } : {},
    } as Record<string, unknown>
  })
}

/**
 * 本回合是否以「执行体错误」收场（而非正常答完）。
 *
 * 背景（2026-09-10 gemma 空台词事故）：子代理回合可以以
 * `turn/end{reason:{kind:'error'}}` 结束（如 provider 400
 * UNSUPPORTED_REASONING_EFFORT）。旧代码对这种回合照样回一个
 * `human_input{output:''}`，引擎只看到"空台词、无赋值错误"，于是静默跳过
 * 节点——宿主明明知道执行体失败了，作者（用户/主模型）却什么也收不到，
 * 违反"不许静默吞错"红线。
 *
 * 返回错误描摹；非错误回合返回 undefined。
 */
export function childTurnError(events: readonly SessionEvent[]): { kind: string; detail: string } | undefined {
  for (const event of events) {
    if (event.type !== 'turn/end') continue
    const reason = (event.data as { reason?: { kind?: unknown; error?: { message?: unknown; code?: unknown } } }).reason
    if (reason === undefined || reason.kind !== 'error') continue
    const message = typeof reason.error?.message === 'string' ? reason.error.message : ''
    const code = typeof reason.error?.code === 'string' ? reason.error.code : ''
    const detail = [message, code.length > 0 ? `(${code})` : ''].filter(Boolean).join(' ')
    return { kind: 'executor_error', detail: detail.length > 0 ? detail : '子代理回合以 error 收场（无错误详情）' }
  }
  return undefined
}
