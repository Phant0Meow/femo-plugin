/**
 * persona.ts — Femo 根路径的系统提示段 + 预设历史读法（身份裁决已分家）。
 *
 * 【2026-10 分家】此前本文件兼管两件事：会话身份判定（presetOf / isFemoAgent，
 * 按会话逐个挂 femo:root 段）与根路径注入。作者拍板「彻底去掉预设」后：
 *   · 身份轴 → femoIdentity.ts（权威判据=有戏有账，预设退居历史兼容）；
 *   · 根路径 → 改成**全局一段**（本文件的 femoRootSection，装配期挂一次，
 *     所有会话共享），不再按会话/按预设切换来挂——任何会话都能知道 femo 根在哪。
 *
 * 为什么根路径要注入而不能写死在静态文件里：插件根随安装位置变化，静态
 * yml/常量写不了绝对路径。写法是 systemPrompt.section 一行（不污染用户可见
 * 聊天），全局生效后子代理/角色窗也能看到（无害，且它们在跑 code: 引用时
 * 确实需要知道根在哪）。
 *
 * 与 skill 的分工：教条正文里的 {FEMO_ROOT} 由 femo-skill.ts 在装配期展开成
 * 真路径（模型载入 /femo 即见真路径）；本段是**没载入教条时**也能拿到的根路径
 * 声明，两者同源同值。
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the agent-preset domain's event declarations
// ('agent-preset/selected' merge into cordis Events).
import type {} from '@deepseek-ai/dsh-agent-presets'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { engineRoot } from './config'
import { readSessionEvents } from './compat/session-events'
import { configureFemoIdentity, setPresetOverride } from './femoIdentity'

/** 注入给模型的根路径（= config.femoRoot，装配期 configurePersonaDocs 注入；
 *  缺省回落引擎根推导——语法文档/femoExamples/femo2host CLI 都在仓库根）。 */
let docsFemoRoot = engineRoot
export function configurePersonaDocs(femoRoot: string): void {
  const root = (femoRoot || engineRoot).replace(/[\\/]+$/, '')
  docsFemoRoot = root + '/'
}

/** 根路径归一值（无尾斜杠；诊断与 skill 展开共用同一值）。 */
export function femoRootPath(): string {
  return docsFemoRoot.replace(/[\\/]+$/, '')
}

/**
 * 挂**全局** femo:root section（所有会话可见）。与旧「按 agent 挂」的差别：
 * 不再需要按会话/按预设切换去注入与清除——去掉预设后「谁需要根路径」变成了
 * 「所有会话都可能需要」，按会话开关反而制造了漏挂面。
 * @returns section 的 effect disposer；无 systemPrompt 服务时返回 undefined。
 */
export function installFemoRootSection(ctx: Context): (() => void) | undefined {
  const systemPrompt = (ctx as unknown as { systemPrompt?: { section(s: { name: string; order: number; text: string }): () => void } }).systemPrompt
  if (systemPrompt === undefined) {
    console.log('[femo-plugin] systemPrompt service unavailable; femo:root section not installed')
    return undefined
  }
  try {
    return systemPrompt.section({
      name: 'femo:root',
      order: 50,
      text: `FEMO_ROOT（femo系统根目录；系统提示中写作 {FEMO_ROOT} 的位置都指它）：${femoRootPath()}`,
    })
  } catch (error: unknown) {
    console.log(`[femo-plugin] femo:root section install failed: ${String(error)}`)
    return undefined
  }
}

/**
 * 注册 persona 相关钩子（原 apply() 内的 agent/created + agent-preset/selected，
 * 由 index.ts 总装调用一次）。
 *
 * 【2026-10 起预设退居历史兼容】本插件不再向预设名册注册「FEMO模式」，新会话
 * 也不再标预设；这两个钩子保留只为存量会话：旧会话 header 里可能还写着
 * femo-plugin，从 UI 菜单切过预设的会话要在冷启后能把活覆盖重建出来
 * （femoIdentity 的 presetOverrides 表）。新会话不产生这类数据。
 */
export function registerPersonaHooks(ctx: Context, femoRoot: string): void {
  configurePersonaDocs(femoRoot)
  // 身份轴的根目录（host-history 账判据用）与根路径段同源注入。
  configureFemoIdentity(femoRoot)
  // 冷启重建活覆盖：预设切换只落 'agent-preset/selected' 日志事件，header 是
  // 创建期冷事实不会被改写——从日志末条找最近一次选择。
  ctx.on('agent/created', ({ agent }) => {
    const events = readSessionEvents(agent.session)
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event?.type === 'agent-preset/selected') {
        setPresetOverride(String(agent.session.id), event.data.agentPreset)
        break
      }
    }
  })
  // 'agent-preset/selected' 的事件声明由 @deepseek-ai/dsh-agent-presets 的
  // 模块增强提供；此处经宽化签名调用（运行时同一 ctx.on 同一字符串）。
  ;(ctx.on as (event: string, listener: (sessionId: SessionId, agentPreset: string) => void) => () => void)(
    'agent-preset/selected',
    (sessionId: SessionId, agentPreset: string) => {
      setPresetOverride(String(sessionId), agentPreset)
      console.log(`[femo-plugin] preset override ${sessionId} -> ${agentPreset}（历史兼容读法）`)
    },
  )
}
