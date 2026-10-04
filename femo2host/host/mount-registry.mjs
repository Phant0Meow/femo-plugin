/**
 * mount-registry.mjs — 各宿主挂载剧本的共同账本（femo2host 公共层）。
 *
 * 2026-10-04 用户拍板：「各家把挂载剧本的事儿都写到一处，写在一个文件里」。
 * 账本是一个 JSON 文件，住数据根 <数据根>/mounts.json（dataRootOf 口径，与
 * femo_files.json 等跨宿主小本子同层；数据根=租户边界，换数据根=换一本账）；
 * 管它的读写口只有本文件一份，各家宿主都从这里走。文件形状：
 *
 *   { "version": 1, "mounts": [ {host, session, time, script_path | femo_text}, ... ] }
 *
 * 每条记录 = 某（宿主, 会话）**最近一次**挂载动作：
 *   - host         宿主身份（web/autoclaw/dsh/zcode…）
 *   - session      会话标识；null = 无会话概念的服务级挂载（autoclaw）
 *   - session_name 会话显示名（挂载那刻从宿主名册取的成品名，dsh=标题→
 *                  工作区名回退；web 恒 User；取不到=不写字段）——session id
 *                  无人看得懂，下拉菜单之类给人看的场合显示它（2026-10-04
 *                  用户拍板），缺了回退显示 session
 *   - time         挂载时刻 ISO
 *   - script_path 与 femo_text **互斥**：有地址就没有文字（脚本正身在盘上）；
 *     有文字就是一次性的文本挂载，不指向任何本地文件（用户拍板）
 * 按（host, session）撞键覆盖：重挂=替换旧条目、时间刷新——账本记现态，
 * 不滚成流水。以后 compiler 同时跑多个剧本时，多条记录天然并存。
 *
 * 账本是「记录」，不是活查询：文本挂载是一次性的，重启不复活、记录留账；
 * 某家此刻真挂着什么，以那家宿主的内存挂载态为准。
 *
 * 并发口径：各宿主进程写同一个文件——挂载是低频动作，整文件重写（临时文件
 * +同目录改名防写一半被读），最后写入者赢，不做文件锁。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dataRootOf } from '../femoRoot.mjs';

/** 账本文件路径（数据根之下；femoRoot=引擎根，测试可不走这层直接传路径）。 */
export function mountLedgerPath(femoRoot) {
  return join(dataRootOf(femoRoot), 'mounts.json');
}

function freshLedger() {
  return { version: 1, mounts: [] };
}

function keyOf(rec) {
  return `${rec?.host ?? ''}|${rec?.session ?? ''}`;
}

/** 读账本。文件不在=空白账；损坏=整本搬进 mounts.json.corrupt-<时刻> 另存
 *  （不悄悄销毁现场）再从空白重开——账本是记录不是正身，不能让它挡挂载。 */
export function readMountLedger(ledgerPath) {
  let raw;
  try {
    raw = readFileSync(ledgerPath, 'utf8');
  } catch {
    return freshLedger();
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.mounts)) return { version: 1, mounts: parsed.mounts };
  } catch { /* 落入下面的隔离 */ }
  try {
    renameSync(ledgerPath, `${ledgerPath}.corrupt-${Date.now()}`);
  } catch { /* 连隔离都失败就当没有 */ }
  return freshLedger();
}

function writeLedger(ledgerPath, ledger) {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  const tmp = `${ledgerPath}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(ledger, null, 1), 'utf8');
  renameSync(tmp, ledgerPath);
}

/** 记一笔（撞键覆盖）。entry = { host, session?, sessionName?, scriptPath | femoText }，time=现在。 */
export function upsertMountRecord(entry, ledgerPath) {
  if (typeof entry?.host !== 'string' || !entry.host.trim()) {
    throw new Error('挂账需要 host');
  }
  const rec = { host: entry.host, session: entry.session ?? null, time: new Date().toISOString() };
  if (typeof entry.sessionName === 'string' && entry.sessionName.trim()) rec.session_name = entry.sessionName.trim();
  if (typeof entry.femoText === 'string' && entry.femoText) rec.femo_text = entry.femoText;
  else if (typeof entry.scriptPath === 'string' && entry.scriptPath) rec.script_path = entry.scriptPath;
  else throw new Error('挂账需要 scriptPath 或 femoText 之一');
  const ledger = readMountLedger(ledgerPath);
  const idx = ledger.mounts.findIndex(r => keyOf(r) === keyOf(rec));
  if (idx >= 0) ledger.mounts[idx] = rec;
  else ledger.mounts.push(rec);
  writeLedger(ledgerPath, ledger);
}

/** 撤一笔（解除挂载；没有该键=无动作）。 */
export function removeMountRecord(host, session, ledgerPath) {
  const ledger = readMountLedger(ledgerPath);
  const key = `${host ?? ''}|${session ?? ''}`;
  const next = ledger.mounts.filter(r => keyOf(r) !== key);
  if (next.length === ledger.mounts.length) return;
  ledger.mounts = next;
  writeLedger(ledgerPath, ledger);
}

/** 查某（宿主, 会话）的现记录；没有返回 undefined。 */
export function findMountRecord(host, session, ledgerPath) {
  const key = `${host ?? ''}|${session ?? ''}`;
  return readMountLedger(ledgerPath).mounts.find(r => keyOf(r) === key);
}

/** 盘上有没有这份账本文件（测试与诊断用；无文件≠无账，读时按空白账处理）。 */
export function mountLedgerExists(ledgerPath) {
  return existsSync(ledgerPath);
}
