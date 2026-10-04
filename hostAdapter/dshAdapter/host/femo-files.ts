/**
 * femo-files.ts — femoGen 脚本文件账本（dsh 消费口）。
 *
 * 2026-09-20 上移公共层并正名 femoGen Files：账本唯一活在
 * femo2host/femoGenConnector/femogen-files.mjs（纯磁盘读写零宿主依赖；别的
 * 宿主接 femoGen 导入/导出时直接消费）。2026-09-26 过版删除中转壳——本文件
 * 直连新家。落盘文件名保持 femo_files.json（既有数据不跟模块改名走）。
 */
export * from '../../../femo2host/femoGenConnector/femogen-files.mjs'
