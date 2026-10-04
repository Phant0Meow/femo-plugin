/**
 * state-files.ts — user_data 状态文件读写族（dsh 再导出壳）。
 *
 * 2026-09-20 整族上移公共层：唯一活在 femo2host/host/state-files.mjs
 * （纯磁盘读写零宿主依赖——会话FEMO脚本记录/场次账本/Job 索引/actor-usage）。
 * 本文件只剩再导出——engine-events/hub-proxy/index/projection-input/
 * subagent(-native)/run-control/routes 零改动。
 * turn_scopes 同日退役：hub 账本行自带 targets、/views 花名册随账本落盘，
 * 「谁看得见哪段」归新链路；dsh 消费点（hub-proxy/projection-input/routes
 * 的 /actors、/projection-state、projection-windows）已全部切 hub，写侧已停，
 * 旧链路 CSS 视角过滤的历史兼容读留在 routes 本地 legacy 函数。
 */
export * from '../../../femo2host/host/state-files.mjs'
