/**
 * hub-anchor.ts — 投影窗内容接缝·锚行常量（链路B 薄壳实验 2026-09-19）。
 *
 * 拍板：投影窗还是 dsh 原生投影窗（侧边栏/开窗链路/composer/输入路由全不动），
 * 但窗内内容整体改为「来自投影中心（femo2host/projection_hub.py）、无脑渲染」：
 * 宿主在每扇投影窗 materialize 时写一条一次性锚行 femo-plugin/chat{kind:'hub'}
 * （见 projection.ts ensureHubAnchor）——它是前端「内容接缝」的挂载点；前端
 * 锚行节点（client-ui/hub-window.tsx femo-hub-anchor）在锚点位置渲染 hub 数据
 * （GET /femo-plugin/hub-view，宿主代理）；锚行之前的存量历史由官方渲染器
 * 原样呈现（兼容期）。
 *
 * 【2026-09-25 清淤】旧「内容关闸」开关（isHubContentGated/setHubContentGate）
 * 删除——被它短路的投影写入机已随链路B 大扫除整台拆管，闸无闸可关；
 * 本文件只剩下面两个常量。
 */

/** 锚行 kind（femo-plugin/chat 数据里的 kind 字段值）。 */
export const HUB_ANCHOR_KIND = 'hub'

/** 锚行幂等键（写进 data._srcSeq；账本懒构建/增量维护都按它查重）。 */
export const HUB_ANCHOR_SRC = 'femo-hub-anchor'
