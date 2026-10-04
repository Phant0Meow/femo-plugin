/**
 * shared/window-id.mjs — 投影窗 id 解析（宿主进程侧与聊天窗 bundle 共吃的一份）。
 *
 * dsh 自有的窗 id 规则：`femo-proj-<主sid>-<win>`，win=god / stage / <actorKey>，
 * actorKey 不含 '-'（projectionActorKey 同款消毒，非 [A-Za-z0-9_-] 字符编码成
 * _<hex>），故末段必属 win。2026-09-29 收拢：此前宿主侧 projection.ts 与聊天窗
 * proj2/window-id.ts 各抄一份、注释要求「两端改动必须同步」——实际 esbuild 两半
 * 都会把本件揉进各自产物，抄写义务退役。拍板：投影窗是 dsh 独有 UI 概念，收在
 * 适配器根 shared/、不进公共层（只此一家不进公共客厅）。
 */

export const PROJECTION_WINDOW_PREFIX = 'femo-proj-'

/** 投影窗 id 解析：`femo-proj-<主sid>-<win>` → { mainSid, win }；非投影窗 id
 *  返回 undefined。 */
export function parseProjectionWindowId(sessionId) {
  if (!sessionId.startsWith(PROJECTION_WINDOW_PREFIX)) return undefined
  const suffix = sessionId.slice(PROJECTION_WINDOW_PREFIX.length)
  const cut = suffix.lastIndexOf('-')
  if (cut <= 0) return undefined
  return { mainSid: suffix.slice(0, cut), win: suffix.slice(cut + 1) }
}
