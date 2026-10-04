/**
 * plugin-source.ts — 插件消息的生产者身份（dsh 0.1.7 v4 消息准入的版本胶水）。
 *
 * dsh 0.1.7 起，v4 会话要求每条 durable 消息的生产者「自报家门」：source.kind
 * 必须是非空且不等于 'plugin' 的字符串，否则写入侧当场抛
 * `format v4 message requires a producer-owned source kind`（encode 落盘前
 * 抛出，日志里一行都没有）。第三方插件的规范形态是 `plugin:<包名>`——与官方
 * 迁移器对历史会话的改写一致：`{ kind:'plugin', plugin:'femo-plugin' }` →
 * `{ kind:'plugin:femo-plugin' }`（plugin 字段丢弃，其余原样保留）。
 *
 * 新形态两端全兼容：0.1.6（v3）全链对 kind 零校验，渲染也只特判 'user'；
 * 0.1.7 的 chat 端对 user 角色消息只判 `source.kind !== 'user'` 即渲染成
 * steering/注入节点——两种 kind 同待遇。所以写入侧无版本分流，一律新形态。
 * 识别侧（读历史行/事件认「这条是不是某插件生产的」）则必须双形态同判：
 * 新形态来自各插件新写入的消息，退役形态来自尚未迁移的旧日志。
 */

/** 本插件写入消息时声明的生产者 kind。 */
export const FEMO_PLUGIN_KIND = 'plugin:femo-plugin'

/** 本插件 steer/注入消息共用的 source 基座。 */
export const FEMO_PLUGIN_SOURCE = { kind: FEMO_PLUGIN_KIND } as const

/** 消息 source 的最小可判别形状（durable 行与事件载荷通用）。 */
interface SourceLike {
  kind?: unknown
  plugin?: unknown
}

/** 从一条消息 source 认出生产它的插件名（双形态同判）：
 *  新形态 `plugin:<名>` 取前缀后段；退役形态 kind='plugin' 取 plugin 字段。
 *  一方 kind（user/model/tool…）或缺失返回 undefined。 */
export function pluginSourceName(source: unknown): string | undefined {
  if (source === null || typeof source !== 'object') return undefined
  const record = source as SourceLike
  if (typeof record.kind === 'string' && record.kind.startsWith('plugin:')) {
    return record.kind.slice('plugin:'.length)
  }
  if (record.kind === 'plugin' && typeof record.plugin === 'string') return record.plugin
  return undefined
}
