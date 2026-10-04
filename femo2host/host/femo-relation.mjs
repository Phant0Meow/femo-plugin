/**
 * femo-relation.mjs — 本会话与 FEMO 的关系裁决（femo2host 公共层，2026-09-28
 * 自 dshAdapter host/routes/projection.ts 上移：判断材料本就住在公共层——发起
 * 账=会话记录（state-files）、参演账=在线口径当选视图（cast-core），拼装的
 * 裁决各宿主通用，按归属口诀上收；宿主只留薄绑定，易失信号以注入喂入）。
 *
 *   sessionFemoRelation(femoRoot, sessionId, opts?) → {ok, related, launched,
 *     acting, latestJob}
 *
 * 裁决（二者其一即 related，2026-09-28 dsh 视角菜单门卫定稿同源）：
 *   ① 发起过戏（launched）：会话记录 jobIds 非空（宿主启动/续跑运行时写入，
 *      跨重启），或 opts.isRunning(sid) 为真（宿主注入的易失运行信号——内存
 *      运行态里它正在跑）。
 *   ② 戏里有它（acting）：当前在线宿主最新当选的灵魂绑定（cast-core
 *      preferencesView 'online'，与开演定格同判据）里有本会话。
 * latestJob=该会话最近发起的 Job（jobIds 末位；undefined=从未发起）。
 * hub 不可达时 acting 按空账（preferencesView 的既定语义），launched 照裁。
 */

import { readSessionJobIds } from './state-files.mjs';
import { preferencesView } from './cast-core.mjs';

export async function sessionFemoRelation(femoRoot, sessionId, opts = {}) {
  const sid = String(sessionId ?? '').trim();
  if (sid.length === 0) {
    return { ok: true, related: false, launched: false, acting: false, latestJob: undefined };
  }
  const [jobIds, prefs] = await Promise.all([
    readSessionJobIds(femoRoot, sid).catch(() => undefined),
    opts.castView ?? preferencesView(femoRoot, 'online'),
  ]);
  const launched = (Array.isArray(jobIds) && jobIds.length > 0)
    || (typeof opts.isRunning === 'function' && opts.isRunning(sid) === true);
  const acting = Object.values(prefs?.bindings ?? {}).some(entry => entry?.sid === sid);
  const latestJob = Array.isArray(jobIds) && jobIds.length > 0
    ? jobIds[jobIds.length - 1]
    : undefined;
  return { ok: true, related: launched || acting, launched, acting, latestJob };
}
