/**
 * harness.mjs — 冒烟测试共用小件（常驻化第 3 步引入）。
 *
 * 三件事：
 *   · runHook —— 把钩子脚本当真子进程拉起（stdin 喂载荷、stdout 收 JSON）：
 *     钩子直连驿站/常驻引擎/hub，测试走真链路，不打 HTTP。
 *   · possessPickup —— femo-possess 领拍替身（2026-09-28 换轨：信的投递/消费
 *     归 runtime/femo-possess.mjs，Stop 钩子不再碰信柜）：测试里做同一套动作
 *     （mailbox.py receive 取走本席信 → 节拍信挂牌 writeMarker）。
 *   · killSandboxDaemon —— MCP 经 daemon-client 代拉的是**脱离母进程**
 *     的常驻引擎，测试收尾必须按 hub.json 的 pid 收尸，否则野 daemon 常驻。
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFemoRoot } from '../paths.mjs';
import { writeMarker } from '../runtime/speech-collect.mjs';
import { renderPulledLetter } from '../runtime/pulled-letter.mjs';

// 冒烟沙盒不弹引擎桌面控制台窗（daemon 2026-09-27 起被代拉时自开窗；本闸对
// 导入 harness 的全部冒烟生效——daemon 由 MCP 服务器经 process.env 继承）。
process.env.FEMO_DAEMON_CONSOLE = process.env.FEMO_DAEMON_CONSOLE ?? '0';

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks');
/** 拉起钩子脚本跑一趟。返回解析后的 stdout JSON（空输出/坏 JSON={}=不注入）；
 *  stderr 附在返回值 _stderr 上（钩子的留痕日志，排障用）。 */
export function runHook(endpoint, payload = {}, { sessionId, dataDir, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
    if (sessionId) env.CLAUDE_SESSION_ID = sessionId;
    if (dataDir) env.FEMO_DATA_DIR = dataDir;
    const p = spawn(process.execPath, [join(HOOKS_DIR, `${endpoint}.mjs`)], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let exited = false, outEnded = false, errEnded = false, settled = false;
    const timer = setTimeout(() => { try { p.kill(); } catch { /* 已退 */ } reject(new Error(`hook ${endpoint} timeout`)); }, timeoutMs);
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    // exit 与流结束双条件齐了才解析——exit 可能抢在 stdout 最后一块 data 之前
    // 到（实测：长 JSON 注入串被截断→parse 假 {}，绿红交替的假红根因）。
    const maybe = () => {
      if (settled || !exited || !outEnded || !errEnded) return;
      settled = true;
      clearTimeout(timer);
      let parsed = {};
      try { parsed = JSON.parse(out || '{}'); } catch { /* 坏输出={} */ }
      resolve(Object.assign(parsed, err ? { _stderr: err } : {}));
    };
    p.on('exit', () => { exited = true; maybe(); });
    p.stdout.on('end', () => { outEnded = true; maybe(); });
    p.stderr.on('end', () => { errEnded = true; maybe(); });
    p.stdin.write(JSON.stringify(payload));
    p.stdin.end();
  });
}

/** possessPickup —— femo-possess 领拍替身：取走本席信（消费）+ 节拍信挂牌，
 *  与 runtime/femo-possess.mjs 领拍三连的「取信→挂牌」同套动作。返回
 *  { letters, notice }（取到的信与渲染好的唤醒通知）。 */
export function possessPickup({ soul, session, dataDir }) {
  process.env.FEMO_DATA_DIR = dataDir; // writeMarker 的 dataRoot 走本进程 env
  const args = [process.env.FEMO_PYTHON || 'python', join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'femo2host', 'mailbox.py'), 'receive', '--host', 'zcode', '--soul', soul];
  if (session) args.push('--session', String(session));
  const r = spawnSync(args[0], args.slice(1), { encoding: 'utf8', timeout: 5000, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
  const letters = JSON.parse(r.stdout || '[]');
  const beat = Array.isArray(letters) ? letters.find(x => x.kind === 'context' || (x.kind === 'notice' && x.subkind === 'node_retry')) : undefined;
  if (beat) {
    writeMarker(findFemoRoot(), String(beat.soul ?? soul), {
      job_id: beat.job_id, soul: String(beat.soul ?? soul), node: beat.node, ref: beat.ref,
      target_host: beat.target_host, session: session || undefined,
      delivered_at: new Date().toISOString(), delivered_by: 'possess',
    });
  }
  const notice = Array.isArray(letters) ? letters.map(x => renderPulledLetter(x, String(x.soul ?? soul))).join('\n') : '';
  return { letters: Array.isArray(letters) ? letters : [], notice };
}

/** 按 hub.json 的 pid 收掉沙盒 daemon（幂等；无账/已死静默）。 */
export function killSandboxDaemon(dataDir) {
  const hubJson = join(dataDir, 'femo', 'projection', 'hub.json');
  try {
    if (!existsSync(hubJson)) return;
    const pid = Number(JSON.parse(readFileSync(hubJson, 'utf8'))?.pid) || 0;
    if (pid > 0) {
      try { process.kill(pid); } catch { /* 已死 */ }
    }
  } catch { /* 半截账：下一轮再看 */ }
}
