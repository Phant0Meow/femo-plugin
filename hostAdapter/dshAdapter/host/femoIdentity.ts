/**
 * femoIdentity.ts — 「这个会话是 FEMO 会话吗」的唯一裁决轴（2026-10-07 立）。
 *
 * 【为什么单独立件】此前两根轴混着走：新会话靠**预设标记**（会话 header 的
 * agentPreset='femo-plugin'）认亲，老会话靠宿主 host-history 账
 * （drafts/<sid>.json 存在）兜底——名册、门卫、戏外旁挂、视角菜单各读一支，
 * 谁漏了哪支就会出现「我明明在跑戏，面板里没有我」「视角菜单不给我开」这类
 * 症状（历史实锤：真主会话 session-89aba104 就不走模式菜单，preset 判不到）。
 *
 * 作者 2026-10 拍板「彻底去掉预设」后，预设这根轴正式退居**历史兼容**：
 *   · 权威轴 = **有戏有账**（该会话挂过脚本/跑过 Job → host-history 有档案）；
 *   · 旧会话 header 里的 'femo-plugin' 只当 legacy 命中（旧数据不判死）。
 * 于是「任何会话都能用 femo」不是靠预设放行，而是靠身份轴本身与预设解绑。
 *
 * 【为什么是叶件】判据只有「读一个文件存在与否」+「查 header/活覆盖」，
 * 不需要任何服务与宿主状态；而 persona / session-roster / engine-events /
 * tool-deps 都要用它。放叶子层就没有环（依赖只向下，见 hostAdapter 守则 §二）。
 *
 * 【femoRoot 为什么归这里】它是身份判据的输入（账本在 <femoRoot>/user_data/
 * host-history/drafts/），不是投影窗的私产；装配期由 index.ts 注入一次，
 * 与 persona 的根路径段注入同源同值。
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 【历史兼容值】旧会话 header / 旧活覆盖里的预设 id。2026-10 起本插件**不再
 * 注册这个预设**，新会话也不再标它；此常量只为认下旧数据（存量会话照跑不误）。
 */
export const FEMO_PRESET = 'femo-plugin'

/**
 * 会话级预设覆盖：会话 header 是创建期冷事实，从 UI 菜单切预设不重写它，
 * 切换只落成 'agent-preset/selected' 日志事件。冷启时按日志重建，与
 * dsh-agent-presets 的 resolveSessionPreset 同序（最新一次选择算数，header 兜底）。
 * 【2026-10 起只是历史读法】新会话不再有预设，这张表通常为空。
 */
const presetOverrides = new Map<string, string>()

/** 一根会话身份的最小面（header 冷事实；测试与调用方都不用造真会话）。 */
export interface PresetBearingIdentity {
  readonly id: unknown
  readonly header: { readonly agentPreset?: string; readonly parentSession?: unknown }
}

/** femo 的 host-history 账根目录（<femoRoot>/user_data/host-history），
 *  由 configureFemoIdentity 在装配期注入一次；空串=未装配（判据保守返回 false）。 */
let femoRootDir = ''

/** 装配期注入 femo 根（幂等；尾斜杠归一）。index.ts 先于一切会话调用。 */
export function configureFemoIdentity(femoRoot: string): void {
  femoRootDir = String(femoRoot ?? '').replace(/[\\/]+$/, '')
}

/** 读当前注入的 femo 根（诊断/测试用）。 */
export function femoIdentityRoot(): string {
  return femoRootDir
}

/**
 * 记录/更新一个会话的预设覆盖（'agent-preset/selected' 的活映射）。
 * 【历史兼容】只有旧会话还会走到这里。
 */
export function setPresetOverride(sessionId: string, agentPreset: string): void {
  presetOverrides.set(String(sessionId), agentPreset)
}

/** 一个会话实际跑的预设（活覆盖优先，header 兜底）。 */
export function presetOf(session: { id: unknown; header: { agentPreset?: string } }): string | undefined {
  return presetOverrides.get(String(session.id)) ?? session.header.agentPreset
}

/** 该会话是否就是「跑过/正在跑戏」的那个会话（权威判据：host-history 有账）。 */
export function hasFemoActivity(sessionId: string): boolean {
  const sid = String(sessionId ?? '').trim()
  if (sid === '' || femoRootDir === '') return false
  return existsSync(join(femoRootDir, 'user_data', 'host-history', 'drafts', `${sid}.json`))
}

/**
 * FEMO 会话判据（全插件唯一尺子，2026-10 换轴）：**有戏有账**优先，旧预设标记
 * 兜底。名册、门卫、戏外旁挂、视角归属一律用它，杜绝各写一套判据漂移。
 * @param identity - 手里已有会话对象时传（省一次 String 化）；只给 sid 也行。
 */
export function isFemoSession(sessionId: string, identity?: PresetBearingIdentity): boolean {
  if (hasFemoActivity(sessionId)) return true
  if (identity !== undefined && presetOf(identity as { id: unknown; header: { agentPreset?: string } }) === FEMO_PRESET) {
    return true
  }
  return false
}

/**
 * 主会话（非子代理）才配有 femo 剧本工具与门卫；子代理/角色窗不在此列。
 * 名字里的 Main 是重点：这条判据**不含**预设，任何会话的主模型都成立。
 */
export function isFemoMainAgent(agent: { session: { id: unknown; header: { agentPreset?: string; parentSession?: unknown } } }): boolean {
  if (agent.session.header.parentSession !== undefined) return false
  return isFemoSession(String(agent.session.id), agent.session as unknown as PresetBearingIdentity)
}
