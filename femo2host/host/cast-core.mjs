/**
 * cast-core.mjs — 会话↔角色绑定账·宿主侧客户端（femo2host 公共层）。
 *
 * 账本正身住 hub（cast-preferences.json 提名账 + cast/<jobId>.json 每场选角账，
 * 裁决与落盘契约见 projection_hub.py cast 段）：投影中心「本尊出演」标注、
 * 名册绑定展示、各宿主派工分流读同一份——2026-09-25 自 dsh 本地磁盘账
 * （state-files cast 段，已删）上收。本件是各宿主消费它的唯一读写口：
 *
 *   readJobCast(femoRoot, jobId)                    → {soul: {sid, host}}
 *   putJobCastEntry(femoRoot, jobId, soul, sid, host?) → cast（幂等覆盖）
 *   snapshotJobCast(femoRoot, jobId)                → 定格条数（开演选举誊写提名账，只补空位）
 *   preferenceSet(femoRoot, host, sid, soul|null)   → {ok, error?}
 *   preferencesView(femoRoot, scope?)               → {bindings: {soul: {sid, host}}, hosts}
 *                                                     （scope='online'：只认在线宿主里的
 *                                                       最新提名，在线判据=门铃簿）
 *
 * 键纪律不变：soul 与桥产信收件人同源同词（actor_info.soul 优先、裸执行者
 * 兜底执行者名；main 伪 soul 就是 "main"）。hub 地址走 hub-client 唯一解析口
 * （hub.json 实况 > env——桥端口顺延不会喂错邻居，真实事故的教训）。
 */

import { hubBaseUrl } from './hub-client.mjs';

/** hub GET。失败抛错——调用方按各自语义处置（登记留痕/派工报错），不静默。 */
async function castGet(femoRoot, path, timeoutMs = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${hubBaseUrl(femoRoot)}${path}`, { signal: ctl.signal });
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/** hub POST。返回解析后的 JSON（{ok, error?}）。 */
async function castPost(femoRoot, path, body, timeoutMs = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${hubBaseUrl(femoRoot)}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 读一个 Job 的绑定账；hub 不可达/无档一律空账（缺页=还没登记，派工侧
 *  自有「无绑定→子代理」的既定语义，这里不制造第二种失败形态）。 */
export async function readJobCast(femoRoot, jobId) {
  try {
    const data = await castGet(femoRoot, `/cast?job=${Number(jobId)}`);
    return (data !== null && typeof data === 'object' && data.cast !== null && typeof data.cast === 'object')
      ? data.cast
      : {};
  } catch {
    return {};
  }
}

/** Job 绑定账登记一条（幂等覆盖）。失败抛错（调用方 catch 留痕）。 */
export async function putJobCastEntry(femoRoot, jobId, soulId, sid, host = '') {
  const out = await castPost(femoRoot, '/cast', { job_id: Number(jobId), soul: soulId, sid, host });
  if (out === null || typeof out !== 'object' || out.ok !== true) {
    throw new Error(`cast entry put failed (job=${jobId}, soul=${soulId}): ${out?.error ?? 'unknown'}`);
  }
  return out;
}

/** 开演定格：提名账选举誊写进 Job 选角账（只补空位不覆写）。**以当前在线
 *  为准**（2026-09-28 拍板）：只在在线宿主（门铃簿活心跳）的提名里选举，
 *  不在线宿主上更新的同 soul 提名按没提过算。返回定格条数。 */
export async function snapshotJobCast(femoRoot, jobId) {
  const out = await castPost(femoRoot, '/cast', { job_id: Number(jobId), subkind: 'snapshot' });
  if (out === null || typeof out !== 'object' || out.ok !== true) {
    throw new Error(`cast snapshot failed (job=${jobId}): ${out?.error ?? 'unknown'}`);
  }
  return Number(out.count ?? 0);
}

/** 提名/退票（soul=null 退票）。提名制：hub 不裁占用（多会话可同提一个
 *  soul，谁当选由开演定格按最后指派裁决），仅缺 host/sid 时拒绝——
 *  {ok:false,error} 原样透传给调用方。 */
export async function preferenceSet(femoRoot, host, sid, soul, timeoutMs) {
  // timeoutMs 可选（2026-09-28 增）：拉取宿主的钩子在 4s 寿命内调用时显式收紧，
  // 缺省 8s 不变——dsh/web 等长命消费方零感知。
  return castPost(femoRoot, '/sessions/cast-preference', { host, sid, soul }, timeoutMs);
}

/** 提名账视图：{bindings: {soul: {sid, host}}, hosts: 分格}。bindings=
 *  各 soul 的当选提名（seq 最大者=最后一次指派算数）。scope（2026-09-28）：
 *  'all'（缺省）全账选举不看在线；'online' 由 hub 先把不在线宿主（门铃簿
 *  无活心跳）的提名整格排除再选举——某个 soul 更新的提名在不在线宿主上时
 *  按没提过算，只在在线宿主里挑最新。开演定格恒按同一在线口径（见
 *  snapshotJobCast）——界面与下一场开演永远同一本账。
 *  hub 不可达按空视图（下拉全可点，读失败不误伤交互）。 */
export async function preferencesView(femoRoot, scope = 'all') {
  try {
    const data = await castGet(femoRoot, scope === 'online'
      ? '/sessions/cast-preferences?scope=online'
      : '/sessions/cast-preferences');
    return (data !== null && typeof data === 'object' && typeof data.bindings === 'object' && data.bindings !== null)
      ? data
      : { bindings: {}, hosts: {} };
  } catch {
    return { bindings: {}, hosts: {} };
  }
}
