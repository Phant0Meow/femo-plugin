/**
 * verbs.ts — 主模型席位的两个喊话动词（2026-09-25 解环刀自 engine-events 抽出）。
 *
 * 把话递进主会话对话流只有两个动词，按「来源身份」分立、不可混用：
 *  · steerMainAgent —— 系统插话（plugin 来源）：渲染成"注入上下文"context 节点
 *    且标记"插话（steering）"。引擎结局通知/节点料包参与/重试反馈/运行结束补遗走它。
 *  · followupMain —— 真人直述（user 来源）：渲染成用户气泡；主窗口默认 queue
 *    正门语义（空闲立即开新回合、忙碌排队至当前回合结束）。投影窗上帝窗FEMO外
 *    发言走它（2026-09-06 猫猫拍板：无剧本时上帝窗发言=真实 user 消息）。
 *
 * 两个动词只认宿主 agents 服务，不认识任何业务状态——所以能住进最底层，
 * 调度器、主Agent执行体、驿站收件口、投影输入路由谁都可以来取，无人成环。
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { FEMO_PLUGIN_SOURCE } from './compat/plugin-source'

/** 引擎运行结局直达主模型对话流：以 plugin 来源构造 user 消息并 agent.steer()。
 * dsh 官方语义（dsh-agent）：空闲的主模型立即开新回合收到通知；忙碌时在
 * 下一 step 边界消费——必达、不打断当前回合。取代旧 femo:notify
 * systemPrompt section（布告栏式注入易被模型漏读，2026-08-23 废弃）。
 * 2026-08-24 起导出共用：投影窗输入框「FEMO脚本未跑→直达主模型」路由同款通道。 */
export function steerMainAgent(ctx: Context, sessionId: string | SessionId, text: string): void {
  try {
    const sid = String(sessionId)
    const bag = ctx as unknown as {
      agents?: { get(id: string): { steer?: unknown } | undefined }
      get?(name: string): { get(id: string): { steer?: unknown } | undefined } | undefined
    }
    const viaProp = bag.agents?.get(sid)
    const viaSvc = typeof bag.get === 'function' ? bag.get('agents')?.get(sid) : undefined
    const agent = (viaProp ?? viaSvc) as { steer?(message: unknown): void } | undefined
    if (agent === undefined || typeof agent.steer !== 'function') {
      console.log(`[femo-plugin] steer skipped (main agent unavailable): sid=${sid}`)
      return
    }
    agent.steer({
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: FEMO_PLUGIN_SOURCE,
    })
    console.log(`[femo-plugin] steered main agent: sid=${sid} len=${text.length}`)
  } catch (error: unknown) {
    console.log(`[femo-plugin] steer failed: ${String(error)}`)
  }
}

/** 人类直述投递（2026-09-23 十连裁⑨自 projection-input 抽出共用）：投影窗
 *  上帝窗FEMO外发言以「真实用户消息」进主会话对话流。与 steerMainAgent 是两个
 *  动词——plugin 来源会被渲染成"注入上下文"context 节点且标记"插话（steering）"，
 *  用户直述必须 source kind 'user' + agent.followup（=主窗口默认 queue 正门
 *  语义：空闲立即开新回合、忙碌排队至当前回合结束）。信化路径（mailbox-push
 *  收 user_interjection 信）与降级路径（bridge 不在/寄信失败原地直推）共用。 */
export function followupMain(ctx: Context, sessionId: string | SessionId, text: string): void {
  try {
    const sid = String(sessionId)
    const bag = ctx as unknown as {
      agents?: { get(id: string): { followup?: unknown } | undefined }
      get?(name: string): { get(id: string): { followup?: unknown } | undefined } | undefined
    }
    const viaProp = bag.agents?.get(sid)
    const viaSvc = typeof bag.get === 'function' ? bag.get('agents')?.get(sid) : undefined
    const agent = (viaProp ?? viaSvc) as { followup?(message: unknown): void } | undefined
    if (agent === undefined || typeof agent.followup !== 'function') {
      console.log(`[femo-plugin] followup skipped (main agent unavailable): sid=${sid}`)
      return
    }
    agent.followup({
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'user' },
    })
    console.log(`[femo-plugin] followed up main agent: sid=${sid} len=${text.length}`)
  } catch (error: unknown) {
    console.log(`[femo-plugin] followup failed: ${String(error)}`)
  }
}
