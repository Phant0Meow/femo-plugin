/**
 * state-files.mjs — user_data 状态文件读写族（存档管理员，公共层）。
 *
 * 2026-09-20 自 dshAdapter/host/state-files.ts 上移公共层（用户点名：草稿、
 * 「哪个会话对应哪些 Job」这些 user_data 小本子任何宿主都可能用）；dsh 侧
 * 原文件改为再导出壳，消费方零改动。文件头原样保留历史注记。
 *
 * 【2026-09-21 账本多宿主化】会话记录加 host 键：本会话属于哪个宿主
 * （dsh/zcode/…，自报名字），writeSessionRecord 单点盖戳（首次盖后永不改写）。
 * 多宿主共用同一 femoRoot 时靠它区分「哪个宿主的哪个会话」；旧档案缺键
 * =未声明，读取方按需回退（现存档案全是 dsh 写的）。
 *
 * 两套互不相干的 JSON 小文件，全部落在 <femoRoot>/user_data/ 下：
 *  - host-history/drafts/<sid>.json   会话FEMO脚本记录：host 归属 + 文本域
 *                                     （path/text/rev 乐观锁，femoGen 画布恢复）
 *                                     + 运行域（femoSessions 场次账本 /
 *                                     currentJobId / jobIds 索引）。
 *                                     【2026-09-25】actor-usage（角色占用快照，
 *                                     原 projections/actor-usage/<sid>.json）
 *                                     下推回 dshAdapter/host/actor-usage.ts——
 *                                     全仓只有 dsh 一个消费方，属宿主私产，
 *                                     数据随迁 <dshAdapter>/data/actor-usage。
 *
 * 【2026-09-20 turn_scopes 退役】镜像 turn→scope 映射文件族整件删除（原
 * projections/turn-scopes/<sid>.json）：投影中心账本每行自带 targets、/views
 * 花名册随账本落盘，「谁看得见哪段」的持久化与重启后反查全归 hub 新链路；
 * 写侧同日停（dsh subagent(-native) 不再落盘）。旧链路 CSS 视角过滤的
 * 历史兼容读由 dshAdapter routes 本地 legacy 读负责——公共层不再持有。
 *
 * 纯磁盘读写，无任何宿主服务依赖。dsh 侧 2026-08-23 自 index.ts 迁出；
 * 2026-08-25 断点改造：checkpoints/ 文件族退役，断点并入会话记录 resume 块。
 * 【2026-09-06 Job 模型（运行状态链路重构 §6.1）】PlayResume 族整套退役——
 * 断点归引擎 runs/<job_id>.json（JobManager 唯一权威，原子写/对账/六关裁决），
 * 宿主降级为索引：会话记录只存 currentJobId（权威在引擎文件，宿主侧只是
 * 索引，提案 §四）。存量 resume 块按"不用管旧记录，只管新代码优雅"
 * （猫猫 2026-08-27 拍板）自然失效，不迁移。
 */

import { join } from 'node:path'
import { dataRootOf } from '../femoRoot.mjs'

/** 宿主自称（宿主身份契约：env FEMO_HOST_NAME=桥 --host 同词，dsh 部署由
 * bridge.ts 写入）。2026-09-24 A4：去掉静默 'dsh' 回落——env 缺失=空串
 * （未登记），不再替别的宿主盖 dsh 的戳；现存旧档案的 'dsh' 戳仍可读。 */
function recordHost() {
  return String(process.env.FEMO_HOST_NAME ?? '').trim()
}

/** 会话FEMO脚本记录文件的完整形态：host 归属 + 文本域 + 运行域。
 * @typedef {Object} SessionRecordFile
 * @property {string} [sessionId]
 * @property {string} [host]   本会话属于哪个宿主（盖戳式，首写定型）
 * @property {string} [path]
 * @property {string} [text]
 * @property {number} [rev]
 * @property {number[]} [femoSessions]
 * @property {number} [currentJobId]
 * @property {number[]} [jobIds]
 */

/** 读会话记录文件全文（文本域+运行域）。
 * quarantineOnParseError：仅限持锁的写入方开启——锁保证本进程写入互斥，
 * 锁内解析失败=真损坏而非并发撕裂读，此时把坏档改名留证并大声报错
 * （不许静默吞错红线）后按缺失处理。普通读取方严禁开启：并发读到半截
 * 文件属正常瞬态，隔离反而会把好档案误伤走。 */
async function readSessionRecord(femoRoot, sessionId, quarantineOnParseError = false) {
  const { readFile } = await import('node:fs/promises')
  let raw
  try {
    raw = await readFile(sessionScriptPath(femoRoot, sessionId), 'utf8')
  } catch {
    return undefined // 文件不存在=正常缺省
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    if (!quarantineOnParseError) return undefined
    const { rename } = await import('node:fs/promises')
    const quarantined = `${sessionScriptPath(femoRoot, sessionId)}.corrupt-${Date.now()}`
    try {
      await rename(sessionScriptPath(femoRoot, sessionId), quarantined)
      console.log(`[femo-plugin] ⚠️ 会话记录损坏，原档已隔离留证: ${quarantined}（${String(error)}）`)
    } catch (renameError) {
      console.log(`[femo-plugin] ⚠️ 会话记录解析失败且隔离失败: ${String(error)} / ${String(renameError)}`)
    }
    return undefined
  }
}

// ── 会话记录并发控制（2026-08-26 记录剥空 bug 修复）─────────────────────
//
// 病根：全部写入方都是「async 读 → 改 → async 写」三段式且彼此无互斥。
// fs.writeFile 有 truncate→write 的中间窗口，并发的读撞进窗口会读到半个
// JSON，解析失败被静默当作「档案不存在」，写入方遂从空底重写整份文件——
// path/text/rev/femoSessions 全部蒸发（实测 2026-08-25 场次 869 运行收尾时
// 剥空成 {sessionId}）。药方：同一 sessionId 的所有记录变更经
// withRecordLock 串行化；锁内解析失败按真损坏隔离留证。
const recordLocks = new Map()

/** 同一 sessionId 的记录变更串行队列：fn 排在前一变更之后执行，
 * 读到写的全程不与其他变更交错。（2026-09-25 起导出：dshAdapter actor-usage
 * 下推后仍公用这一把锁。） */
export function withRecordLock(sessionId, fn) {
  const prev = recordLocks.get(sessionId) ?? Promise.resolve()
  const next = prev.then(() => fn(), () => fn())
  recordLocks.set(sessionId, next)
  return (async () => {
    try {
      return await next
    } finally {
      if (recordLocks.get(sessionId) === next) recordLocks.delete(sessionId)
    }
  })()
}

/** 写回会话记录文件整对象。不碰 rev——rev 只归文本快照协议管，
 * 运行态（运行域）写入不该惊动前端的乐观锁。
 * host 盖戳（2026-09-21 账本多宿主化）：record 里已有 host 则原样保留
 * （首写定型，永不改写）；缺省盖当前宿主名。所有写入方（文本域/运行域）
 * 都走本函数，单点收口。 */
async function writeSessionRecord(femoRoot, sessionId, record) {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const path = sessionScriptPath(femoRoot, sessionId)
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify({ ...record, sessionId,
    host: record.host ?? recordHost() }, null, 2), 'utf8')
}

/** 锁内读-改-写会话记录的 currentJobId（null=删除键）。经会话记录串行队列
 * 执行；只动 currentJobId 键，不碰文本域与 femoSessions。 */
export async function setSessionCurrentJob(femoRoot, sessionId, jobId) {
  await withRecordLock(sessionId, async () => {
    const record = { ...(await readSessionRecord(femoRoot, sessionId, true) ?? {}) }
    if (jobId === null) delete record.currentJobId
    else record.currentJobId = jobId
    await writeSessionRecord(femoRoot, sessionId, record)
  })
}

/** 读会话记录的 currentJobId 索引；无记录/无键返回 undefined。 */
export async function readSessionCurrentJob(femoRoot, sessionId) {
  const record = await readSessionRecord(femoRoot, sessionId)
  return record?.currentJobId
}

/** 读会话激活过的全部 Job（无记录/无键返回 undefined——旧记录自然缺省）。 */
export async function readSessionJobIds(femoRoot, sessionId) {
  const record = await readSessionRecord(femoRoot, sessionId)
  return record?.jobIds
}

/** 读会话档案的宿主归属（账本多宿主化）：undefined=旧档未声明（现存档案
 * 全是 dsh 写的，消费方可按需回退 'dsh'）；有值=该会话属于哪个宿主。
 * 本期无消费方，占位明义——多宿主共根部署时的区分读法。 */
// 已退役（观察期 2026-09-26：全类型语料复核零引用——消费方随 dsh 重构删除；
// 观察几天不报错后连块删除，见根 AGENTS §7.1 文件清理规则）
// export async function readSessionHost(femoRoot, sessionId) {
//   const record = await readSessionRecord(femoRoot, sessionId)
//   return record?.host
// }

/** 登记一个激活过的 Job（幂等：已在列则不动）。开跑/续跑成功回执后调用。
 * 经会话记录串行队列执行；只动 jobIds 键，不碰文本域。 */
export async function appendSessionJob(femoRoot, sessionId, jobId) {
  await withRecordLock(sessionId, async () => {
    const record = { ...(await readSessionRecord(femoRoot, sessionId, true) ?? {}) }
    if (record.jobIds?.includes(jobId)) return
    record.jobIds = [...(record.jobIds ?? []), jobId]
    await writeSessionRecord(femoRoot, sessionId, record)
  })
}

/** 记一次运行：宿主会话 ↔ femo 场次的一对多账本（末位=当前场次）。连续去重。
 * 经会话记录串行队列执行。 */
export function appendFemoSession(femoRoot, sessionId, femoSessionId) {
  return withRecordLock(sessionId, async () => {
    const record = { ...(await readSessionRecord(femoRoot, sessionId, true) ?? {}) }
    const list = record.femoSessions ?? []
    if (list[list.length - 1] === femoSessionId) return
    record.femoSessions = [...list, femoSessionId]
    await writeSessionRecord(femoRoot, sessionId, record)
  })
}

/** host-history/drafts 目录（会话FEMO脚本记录的家；dsh 断电索引重建扫同
 *  一棵树——2026-09-29 起导出单源，dsh 自拼路径漏 FEMO_DATA_DIR 的洞就此闭）。 */
export function draftsDirOf(femoRoot) {
  return join(dataRootOf(femoRoot), 'host-history', 'drafts')
}

/** 会话FEMO脚本记录路径（femoGen 刷新/重启后恢复画布用；JSON 单文件）。 */
function sessionScriptPath(femoRoot, sessionId) {
  return join(draftsDirOf(femoRoot), `${sessionId}.json`)
}

/** 会话FEMO脚本记录：path=脚本文件地址（导出/导入产生），text=浏览器端FEMO脚本原文
 * （未保存态；或已保存但前端修改过、运行检测不一致时保存的实际运行版本）。
 * rev=乐观锁版本号：每次写入自增；前端快照写带 baseRev 做多端并发裁决。
 * 读取优先级：text（实际运行的版本）→ path 指向文件内容。
 * @typedef {Object} SessionScriptRecord
 * @property {string} [path]
 * @property {string} [text]
 * @property {number} [rev]
 */

/** @typedef {{ok: true, rev: number} | {ok: false, reason: 'conflict', record: SessionScriptRecord}} WriteSessionScriptResult */

/** 写会话FEMO脚本记录（覆盖式，自动 rev+1）。expectRev 非空时做乐观锁校验：
 * 与服务端当前 rev 不符 → 拒绝写入并返回当前记录（多端并发编辑，后写者输）。
 * 经会话记录串行队列执行。 */
export function writeSessionScript(femoRoot, sessionId, record, expectRev) {
  return withRecordLock(sessionId, async () => {
    const prevFile = await readSessionRecord(femoRoot, sessionId, true)
    if (expectRev !== undefined && (prevFile?.rev ?? 0) !== expectRev) {
      const conflictRecord = {}
      if (prevFile?.path !== undefined) conflictRecord.path = prevFile.path
      if (prevFile?.text !== undefined) conflictRecord.text = prevFile.text
      if (prevFile?.rev !== undefined) conflictRecord.rev = prevFile.rev
      return { ok: false, reason: 'conflict', record: conflictRecord }
    }
    const rev = (prevFile?.rev ?? 0) + 1
    // 文本域（path/text）整体以本次传入为准——「一致→只存地址」依赖字段替换语义；
    // 运行域（femoSessions/currentJobId/jobIds）是 host 独占的运行态，跨文本写入保留。
    const next = {
      ...(prevFile?.femoSessions !== undefined ? { femoSessions: prevFile.femoSessions } : {}),
      ...(prevFile?.currentJobId !== undefined ? { currentJobId: prevFile.currentJobId } : {}),
      ...(prevFile?.jobIds !== undefined ? { jobIds: prevFile.jobIds } : {}),
      ...(prevFile?.host !== undefined ? { host: prevFile.host } : {}),
      ...record,
      rev,
    }
    await writeSessionRecord(femoRoot, sessionId, next)
    return { ok: true, rev }
  })
}

/** 读会话FEMO脚本记录；不存在返回 undefined。 */
export async function readSessionScript(femoRoot, sessionId) {
  const { readFile } = await import('node:fs/promises')
  try {
    const raw = await readFile(sessionScriptPath(femoRoot, sessionId), 'utf8')
    const parsed = JSON.parse(raw)
    return {
      ...parsed.path === undefined ? {} : { path: parsed.path },
      ...parsed.text === undefined ? {} : { text: parsed.text },
      ...parsed.rev === undefined ? {} : { rev: parsed.rev },
    }
  } catch {
    return undefined
  }
}

/** 读会话FEMO脚本的最终文本：text 优先（实际运行版本）→ path 指向的文件内容 → undefined。 */
export async function readSessionScriptText(femoRoot, sessionId) {
  const record = await readSessionScript(femoRoot, sessionId)
  if (record === undefined) return undefined
  if (record.text !== undefined && record.text.trim().length > 0) return record.text
  if (record.path !== undefined) {
    try {
      const { readFile } = await import('node:fs/promises')
      return await readFile(record.path, 'utf8')
    } catch {
      return undefined
    }
  }
  return undefined
}
