/**
 * femogen-canvas-state.mjs — femoGen 画布的「当前文件」path 槽（独立模式文档锚）。
 *
 * 2026-09-30 立件（用户拍板「femogen 的 path 放 user data 里，这样就做得到直接
 * 存盘了」）：画布独立模式没有宿主会话账本（dsh 的 scriptPath 住在每会话记录里，
 * 那是宿主私产），但「现在编辑的是哪个文件」这个文档锚必须有个家——归 femoGen
 * 自有，落数据根 femogen_canvas.json（user_data 搬走它跟着走）。web 服务的
 * 存盘/打开路由写它，画布开页读它当 savedPath。
 *
 * 槽是单格（一个数据根一个「当前文件」）：web 画布常态就一个页面，多标签页
 * 同开互抢属边缘场景，后写者赢——与 dsh 按会话分格是两种形态，不互通用。
 *
 * 与 femogen-files.mjs（导入/导出历史账本）是邻居不是一家人：账本记「用过哪些
 * 文件」，本槽记「正在编辑哪个」——AI 的 femo-mount 也进账本但不改本槽，槽只
 * 跟画布上的导入/导出动作走。
 */

import { join } from 'node:path'
import { dataRootOf } from '../femoRoot.mjs'

function slotPath(femoRoot) {
  return join(dataRootOf(femoRoot), 'femogen_canvas.json')
}

/**
 * 读当前文件路径。文件不存在/损坏/形状不对一律回 null——槽丢了顶多回到
 * 「未保存」状态重新指一次，不值得为它炸任何流程（与 femogen-files 读账本
 * 同一取向：可疑状态要可见，但不是把用户的真实动作变成失败）。
 * @returns {Promise<string|null>}
 */
export async function getCanvasPath(femoRoot) {
  const { readFile } = await import('node:fs/promises')
  try {
    const raw = await readFile(slotPath(femoRoot), 'utf8')
    const parsed = JSON.parse(raw)
    const path = parsed?.path
    return typeof path === 'string' && path.trim().length > 0 ? path : null
  } catch {
    return null
  }
}

/**
 * 写当前文件路径（传 null = 清空，回到「未保存」）。原子写：先 .tmp 再同目录
 * rename（NTFS 上原子），读方永远不会见到半截 JSON。单格盲写无需账本那套
 * 读-改-写串行化——后写者赢是这个槽的语义。
 */
export async function setCanvasPath(femoRoot, path) {
  const { mkdir, rename, writeFile } = await import('node:fs/promises')
  const normalized = typeof path === 'string' && path.trim().length > 0 ? path : null
  await mkdir(dataRootOf(femoRoot), { recursive: true })
  const target = slotPath(femoRoot)
  const tmp = `${target}.tmp`
  await writeFile(tmp, JSON.stringify({ version: 1, path: normalized }, null, 2), 'utf8')
  await rename(tmp, target)
}
