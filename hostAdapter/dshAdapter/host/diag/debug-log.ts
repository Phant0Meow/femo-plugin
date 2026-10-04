/**
 * debug-log.ts — 排障日志统一落点：<femoRoot>/cache/logs/。
 *
 * 排障日志是可再生的诊断输出，不是用户数据——不入 user_data（那里只放
 * 「搬文件夹要带走」的东西）。写入时自动建目录；每行写入前过两道闸：
 * ①时效——文件超过 24 小时没动过即删（下次写入重新创建）；
 * ②大小——文件超过 5MB 即轮转（当前文件改名 .1 留一代，再写新一代），
 *   .1 超过 24 小时也删。光有时效管不住热文件：一直在写的日志 mtime
 *   永远新鲜，2026-09-25 发现 debug-diag-feed.log 因此长到 288MB——
 *   时效 + 轮转两道闸一起才封得住顶。
 */
import { appendFileSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'

const KEEP_DAYS = 1
const ROTATE_BYTES = 5 * 1024 * 1024
const NL = String.fromCharCode(10)

export function debugLogPath(femoRoot: string, name: string): string {
  return join(femoRoot, 'cache', 'logs', name)
}

/** 追加一行（自动补行尾换行）；目录自动创建，过期/超大的旧文件按上面两道闸处理，任何失败静默（观测绝不反噬主路）。 */
export function appendDebugLog(femoRoot: string, name: string, line: string): void {
  try {
    const file = debugLogPath(femoRoot, name)
    const gen1 = file + '.1'
    mkdirSync(dirname(file), { recursive: true })
    const now = Date.now()
    try {
      if (statSync(file).mtimeMs < now - KEEP_DAYS * 86400_000) unlinkSync(file)
    } catch { /* 不存在 = 正常 */ }
    try {
      if (statSync(gen1).mtimeMs < now - KEEP_DAYS * 86400_000) unlinkSync(gen1)
    } catch { /* 不存在 = 正常 */ }
    try {
      if (statSync(file).size > ROTATE_BYTES) {
        try { unlinkSync(gen1) } catch { /* 没有旧一代 = 正常 */ }
        renameSync(file, gen1)
      }
    } catch { /* 不存在 = 正常 */ }
    appendFileSync(file, line.endsWith(NL) ? line : line + NL, 'utf8')
  } catch { /* 日志失败不影响主路 */ }
}
