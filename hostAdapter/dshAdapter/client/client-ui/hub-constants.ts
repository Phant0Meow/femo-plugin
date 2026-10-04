/**
 * hub-constants.ts — 前端锚行常量（与 host/hub-anchor.ts 字面量双处锚定：
 * tsconfig.host exclude client-ui，两端不共享模块，改名须同步）。
 */

/** 锚行 kind（femo-plugin/chat 数据里的 kind 字段值）。 */
export const HUB_ANCHOR_KIND = 'hub'

/** 锚行幂等键（宿主写入 data._srcSeq；前端只认 kind）。 */
export const HUB_ANCHOR_SRC = 'femo-hub-anchor'
