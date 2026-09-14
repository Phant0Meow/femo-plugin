/**
 * persona.ts — Femo 会话的身份证 + 运行时根路径注入。
 *
 * 身份判定：presetOf / isFemoAgent（会话 header 的 agentPreset 标记 + UI 切换
 * 的 live override）。主模型注入面：femo:root——插件根目录只有运行时才知道
 * （随插件安装位置变化，静态 persona yml 写不了绝对路径），走
 * systemPrompt.section 注入一行绝对路径，不污染用户可见聊天。语法文档/示例/
 * 台账等教学生活在 preset 的 agent.cordis.yml persona 里（2026-09-14 从本
 * 文件的 femo:docs 段并入）；运行结果通知不走这里：已改为 agent.steer 对话流
 * 直达（见 engine-events.ts steerMainAgent，2026-08-23 废弃 femo:notify
 * section）。registerPersonaHooks 负责 agent/created（override 重建）与
 * agent-preset/selected（切换时补注入/清除 root section）两个钩子。从
 * index.ts 原样迁出（2026-08-23 重构）。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
// Type-only: pulls the agent-preset domain's event declarations
// ('agent-preset/selected' merge into cordis Events).
import type {} from '@deepseek-ai/dsh-agent-presets'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { engineRoot } from './config'
import { readSessionEvents } from './session-events'

/** Femo sessions carry this agentPreset marker in their session header. */
export const FEMO_PRESET = 'femo-plugin'

/**
 * Session-level preset overrides: the session header is a deep-frozen
 * creation fact, so a preset picked from the UI menu (agentPreset.select →
 * recompose) never rewrites it — the switch only lands as an
 * 'agent-preset/selected' log event. Mirrors dsh-agent-presets'
 * resolveSessionPreset: newest selection wins, header is the fallback.
 */
const presetOverrides = new Map<string, string>()

/**
 * femo:root section 的 effect disposer 表（按 sessionId）：
 * - 防重：同名 section 在同一 agent scope 重复注册会抛错（systemPrompt 约束）；
 * - 切走 preset 时调用 disposer 清除，普通会话不留 Femo 根路径段。
 * 会话销毁时 section 随 agent ctx 的 effect 自动清理（条目残留无害，disposer 幂等）。
 * run-control 的 handleCreateSession 在 setup 回调里写入（导出供跨模块共用同一实例）。
 */
export const femoRootSections = new Map<string, () => void>()

/** One session's frozen creation facts, the minimum presetOf needs. */
export interface PresetBearingIdentity {
  readonly id: SessionId
  readonly header: { readonly agentPreset?: string }
}

/** The preset one session actually runs (override first, header fallback). */
export function presetOf(session: PresetBearingIdentity): string | undefined {
  return presetOverrides.get(String(session.id)) ?? session.header.agentPreset
}

/** Whether an agent belongs to a Femo session (subagents excluded: they
 * inherit the parent's agentPreset but must run normally). */
export function isFemoAgent(agent: Agent): boolean {
  return presetOf(agent.session) === FEMO_PRESET
    && agent.session.header.parentSession === undefined
}

/**
 * 向一个 agent ctx 注入 femo:root section（插件根目录绝对路径，scoped：只对
 * 主会话 agent 生效，子代理不继承，角色不需要）。setup（create-session）与
 * agent-preset/selected 兜底（下拉菜单 recompose 路径）两条路径共用。
 * @returns section 的 effect disposer；无 systemPrompt 或注册失败（如同名
 * 重复）返回 undefined。
 */
/** 根路径的引擎根（= config.femoRoot，装配期 configurePersonaDocs 注入；
 * 缺省回落引擎根推导——语法文档/femoExamples/femo2host CLI 都在仓库根）。 */
let docsFemoRoot = engineRoot
export function configurePersonaDocs(femoRoot: string): void {
  const root = (femoRoot || engineRoot).replace(/[\/]+$/, '')
  docsFemoRoot = root + '/'
}

export function injectFemoRoot(agentCtx: Context): (() => void) | undefined {
  const systemPrompt = (agentCtx as unknown as { systemPrompt?: { section(s: { name: string; order: number; text: string }): () => void } }).systemPrompt
  if (systemPrompt === undefined) return undefined
  try {
    return systemPrompt.section({
      name: 'femo:root',
      order: 50,
      text: `FEMO_ROOT（femo系统根目录；系统提示中写作 {FEMO_ROOT} 的位置都指它）：${docsFemoRoot.replace(/[\\/]+$/, '')}`,
    })
  } catch (error: unknown) {
    console.log(`[femo-plugin] femo:root section inject failed: ${String(error)}`)
    return undefined
  }
}

/**
 * 注册 persona 相关钩子（原 apply() 内的 agent/created + agent-preset/selected，
 * 由 index.ts 总装调用一次）。
 */
export function registerPersonaHooks(ctx: Context, femoRoot: string): void {
  configurePersonaDocs(femoRoot)
  // Preset switches from the UI menu land as 'agent-preset/selected' log
  // events (recompose does not touch the frozen header); keep a live override
  // so isFemoAgent sees the switch. Rebuilt from the log on agent creation so
  // a cold-resumed switched session still rejects.
  ctx.on('agent/created', ({ agent }) => {
    const events = readSessionEvents(agent.session)
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event?.type === 'agent-preset/selected') {
        presetOverrides.set(String(agent.session.id), event.data.agentPreset)
        break
      }
    }
  })
  // 'agent-preset/selected' 的事件声明由 @deepseek-ai/dsh-agent-presets 的
  // 模块增强提供；此处经宽化签名调用（运行时同一 ctx.on 同一字符串）。
  ;(ctx.on as (event: string, listener: (sessionId: SessionId, agentPreset: string) => void) => () => void)(
    'agent-preset/selected',
    (sessionId: SessionId, agentPreset: string) => {
    presetOverrides.set(String(sessionId), agentPreset)
    console.log(`[femo-plugin] preset override ${sessionId} -> ${agentPreset}`)
    // femo:root 注入兜底：下拉菜单切 Femo 模式走 recompose，不执行 create-session 的
    // setup 回调（section 只在那条路径注入过）——这里补注入；切走时清除。
    const sid = String(sessionId)
    if (agentPreset !== FEMO_PRESET) {
      const dispose = femoRootSections.get(sid)
      if (dispose !== undefined) {
        dispose()
        femoRootSections.delete(sid)
        console.log(`[femo-plugin] femo:root section removed (preset -> ${agentPreset})`)
      }
      return
    }
    if (femoRootSections.has(sid)) return
    const agent = ctx.agents.get(sessionId)
    if (agent === undefined) {
      console.log(`[femo-plugin] femo:root inject skipped: agent for ${sessionId} not found`)
      return
    }
    const dispose = injectFemoRoot(agent.ctx)
    if (dispose !== undefined) {
      femoRootSections.set(sid, dispose)
      console.log(`[femo-plugin] femo:root section injected (recompose path)`)
    }
    },
  )
}
