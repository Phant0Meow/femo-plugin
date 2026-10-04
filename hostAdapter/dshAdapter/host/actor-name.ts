/**
 * actor-name.ts — 执行者名的唯一取值口。
 *
 * 【正名 2026-09-19 用户拍板】事件里那个字段原本叫 `ai_name`，用户看着别扭：
 * 「明明应该叫 actorname」——对，它是**执行者**的名字，不只属于 AI（人类节点等
 * 的也是同一个执行者）。全仓已改彻底：引擎发 `actor_name`，桥 / hub / 宿主 ts /
 * femoGen 前端 / deepseek 扩展 / zcode 适配器一律读 `actor_name`，旧名连同过渡
 * 别名一起删掉了。
 *
 * 宿主侧一律经本函数取值，不要各写各的 typeof 判断（六处调用点，一处口径）：
 *   - 字段在 → 它的字符串值；
 *   - 不在 / 不是字符串 / 空串 → ''（调用方自行决定兜底，如回落节点名）。
 */

export function actorNameOf(src: Record<string, unknown> | undefined): string {
  if (src === undefined) return ''
  const name = src.actor_name
  return typeof name === 'string' ? name : ''
}

/** soul 身份取值口（2026-09-25，cast 绑定账配套）：面单/事件里的角色灵魂 id。
 *  信封收件人、绑定账键、交卷 soul 三处同源同词——key 必须等于登记时的词。
 *   - actor_info.soul 字段在 → 它的字符串值（trim）；
 *   - 不在 / 不是字符串 / 空串 → ''（调用方自行兜底，如回落执行者名）。 */
export function soulIdentityOf(src: Record<string, unknown> | undefined): string {
  if (src === undefined) return ''
  const info = src.actor_info as { soul?: unknown } | undefined
  const soul = info?.soul
  return typeof soul === 'string' ? soul.trim() : ''
}
