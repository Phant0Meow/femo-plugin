/**
 * dialogs.ts — 系统文件对话框的 dsh 路由壳。
 *
 * 弹框引擎（powershell WinForms：TopMost 隐形 owner / ASCII-only 脚本 / 退出码
 * 0=已选 2=取消 / 10 分钟超时）2026-09-30 上移公共层 femo2host/femoGenConnector/
 * file-dialogs.mjs——「选路径」归 femoGen 自有（web 宿主本地服务同吃同一份），
 * 本文件只剩 dsh 的 HTTP 响应形状装配，引擎教训与升级记录见引擎文件头。
 */
import type { ServerResponse } from 'node:http'
import { writeJson } from '../http'
import { rememberFemoFile } from '../femo-files'
import { pickFemoFileViaDialog } from '../../../../femo2host/femoGenConnector/file-dialogs.mjs'

/** POST /femo-plugin/pick-script：导入流程（2026-08-30 猫猫拍板「导入=引用」）——
 *  host 弹系统打开文件对话框，拿用户所选FEMO脚本的**原始位置完整路径**（浏览器
 *  FileReader 出于安全只给文件名不给路径，引用式导入必须由 host 侧选文件）。
 *  适用前提与原 /femo-plugin/pick-directory 路由的 native 后端一致（该路由 2026-09-27
 *  零调用方进观察期）：操作者坐在宿主屏幕前。
 *  选中即读回正文并入导入账本（2026-09-11：手机端下次直接挑，不必再弹框）。 */
export function handlePickScript(res: ServerResponse, femoRoot: string): void {
  void (async () => {
    let picked: string | null
    try {
      picked = await pickFemoFileViaDialog({ mode: 'open', title: 'Import FEMO Script' })
    } catch (error) {
      writeJson(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) })
      return
    }
    if (picked === null) {
      writeJson(res, 200, { ok: true, path: null })
      return
    }
    const { readFileSync } = await import('node:fs')
    let content: string
    try {
      content = readFileSync(picked, 'utf8')
    } catch (error) {
      writeJson(res, 500, { ok: false, error: `cannot read ${picked}: ${String(error)}` })
      return
    }
    await rememberFemoFile(femoRoot, picked, 'import')
    writeJson(res, 200, { ok: true, path: picked, content })
  })().catch((error: unknown) => {
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}

/** POST /femo-plugin/pick-save-path：导出·首次保存/另存为（2026-09-06）——host 弹
 *  系统「保存文件」对话框（带默认文件名；OverwritePrompt 默认开=覆盖前系统确认）。 */
export function handlePickSavePath(res: ServerResponse, defaultName: string): void {
  void (async () => {
    let picked: string | null
    try {
      picked = await pickFemoFileViaDialog({ mode: 'save', title: 'Save FEMO Script', defaultName })
    } catch (error) {
      writeJson(res, 500, { ok: false, error: String(error instanceof Error ? error.message : error) })
      return
    }
    writeJson(res, 200, { ok: true, path: picked })
  })().catch((error: unknown) => {
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}
