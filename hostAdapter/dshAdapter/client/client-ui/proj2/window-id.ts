/**
 * client-ui/proj2/window-id.ts — 投影窗 id 解析（聊天窗侧消费形状）。
 *
 * 拆解正身唯一住在 dshAdapter/shared/window-id.mjs（2026-09-29 收拢：本文件
 * 与宿主 projection.ts 此前各抄一份、靠注释人工同步——esbuild 两半都会把
 * shared 揉进产物，抄写义务退役）。本文件只剩聊天窗的旧契约：字段名
 * winActorKey、「拆不出=空对象」；windowShowsActor 是纯展示判断留此。
 */
import { parseProjectionWindowId } from '../../../shared/window-id.mjs'

export interface ProjectionWindow {
  /** 主会话 id（SSE 帧的 sid 就是它）。 */
  readonly mainSid?: string
  /** 窗身份段：god / stage / <角色 actorKey>。 */
  readonly winActorKey?: string
}

export function projectionWindowOf(sessionId: string | undefined): ProjectionWindow {
  const parsed = sessionId === undefined ? undefined : parseProjectionWindowId(sessionId)
  return parsed !== undefined ? { mainSid: parsed.mainSid, winActorKey: parsed.win } : {}
}

/** 本窗是否该渲染该角色的轮（god/stage 全显；角色窗只认自己的 actorKey）。 */
export function windowShowsActor(winActorKey: string | undefined, actorKey: string): boolean {
  if (winActorKey === undefined) return false
  return winActorKey === 'god' || winActorKey === 'stage' || winActorKey === actorKey
}
