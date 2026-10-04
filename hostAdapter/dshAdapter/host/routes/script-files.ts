/**
 * script-files.ts — 脚本文件域（2026-09-25 刀⑤c 自 routes.ts 抽出）。
 *
 * 会话FEMO脚本记录写（session-script）：画布防抖快照与导入/另存为的统一入口，
 * 乐观锁冲突 409、投影窗入口归一到主会话、多端重载广播。
 * （/scripts、/save-script、/script 三路由执行体在 run-control.ts，注册表
 * 一行委派，不经此文件。）
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config'
import { readSessionScript, writeSessionScript } from '../state-files'
import { mainSessionIdOf } from '../projection/projection'
import { broadcastSse } from '../http'
import { readBody, writeJson } from '../http'

/** POST /femo-plugin/session-script —— 会话剧本记录写（2026-08-30 猫猫拍板
 *  统一为 mount 同款 {path,text} 并存格式——导入/导出不再清原文，text 恒为
 *  最新版）：
 *   - {sessionId, femo}：画布编辑防抖的原文快照（保留已有地址，走乐观锁）
 *   - {sessionId, femo, scriptPath}：导入/另存为 → 写 text + 地址覆盖为
 *     scriptPath（指向原始位置/新位置；显式动作，跳过乐观锁无条件写） */
export function handleSessionScript(resolved: ResolvedConfig, req: IncomingMessage, res: ServerResponse): void {
  void (async () => {
    const raw = await readBody(req) as unknown as Record<string, unknown>
    const sessionId = typeof raw.sessionId === 'string' && raw.sessionId.trim().length > 0 ? raw.sessionId.trim() : ''
    if (sessionId.length === 0) {
      writeJson(res, 400, { ok: false, error: 'sessionId is required' })
      return
    }
    const scriptPath = typeof raw.scriptPath === 'string' && raw.scriptPath.trim().length > 0 ? raw.scriptPath.trim() : ''
    const femo = typeof raw.femo === 'string' && raw.femo.trim().length > 0 ? raw.femo : ''
    const baseRev = typeof raw.baseRev === 'number' ? raw.baseRev : undefined
    const pageId = typeof raw.pageId === 'string' ? raw.pageId : ''
    if (femo.length === 0) {
      writeJson(res, 400, { ok: false, error: 'femo is required' })
      return
    }
    // 投影窗入口归一：保存/读取都以主会话记录为准（FEMO脚本数据面挂主会话名下）。
    const scriptMainSid = mainSessionIdOf(sessionId)
    const prev = await readSessionScript(resolved.femoRoot, scriptMainSid)
    const explicit = scriptPath.length > 0
    const result = await writeSessionScript(
      resolved.femoRoot,
      scriptMainSid,
      {
        ...(explicit ? { path: scriptPath } : prev?.path === undefined ? {} : { path: prev.path }),
        text: femo,
      },
      explicit ? undefined : baseRev,
    )
    if (!result.ok) {
      writeJson(res, 409, { ok: false, error: 'conflict', record: result.record })
      return
    }
    // 广播其他端重载（pageId=快照写者自身，前端跳过自己的广播防回环；
    // 显式保存不带 pageId=全端重载，与旧导出/导入行为一致）。
    broadcastSse('script_changed', explicit ? { sessionId: scriptMainSid } : { sessionId: scriptMainSid, pageId })
    writeJson(res, 200, { ok: true, rev: result.rev })
  })().catch((error: unknown) => {
    // 防御：响应已发出后再出错，绝不能二次 writeJson（ERR_HTTP_HEADERS_SENT
    // 会作为 unhandledRejection 把整个 dsh 进程带崩——2026-08-21 实测教训）。
    if (res.headersSent) {
      console.warn('[femo-plugin] session-script handler failed after response:', String(error))
      return
    }
    writeJson(res, 500, { ok: false, error: String(error) })
  })
}
