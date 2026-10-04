/**
 * bridge-launch.mjs — 桥启动三件套（2026-09-24 收编，审计 A1）。
 *
 * 【已退役（2026-09-26，用户拍板「AutoClaw 当他不存在」）】主力三家（zcode/dsh/deepseekweb）已切
 * 常驻引擎直连（daemon-client.mjs），不再生桥。本文件现存两块：
 *   · ensureBridgeReady —— **已迁 daemon-client.mjs**（直连客户端的在役件）；
 *   · buildBridgeLaunch / nodeSpawnProc / bridgePythonPath —— 随桥退役（autoclaw
 *     适配器断供待其重写时自行处理；单测随本文件改名继续在跑，锁历史协议形状）。
 * 新宿主一律走 daemon-client（接入教学见 docs/Specs/宿主接入清单.md §一）。
 *
 * 「宿主怎么把桥拉起来」的三段逐字同构代码（zcode bridge-manager ↔ autoclaw
 * bridge.mjs）唯一活在本文：
 *   ① buildBridgeLaunch  启动命令行组装（桥路径唯一权威 + argv + env）
 *   ② nodeSpawnProc      node:child_process spawn 适配壳（BridgeClient.spawnProc 契约）
 *   ③ ensureBridgeReady  惰性拉起 + ping 就绪（25×300ms，ping 2s）
 *
 * 口径统一（三宿主漂移在此拽正）：
 *   - 桥本体路径唯一权威 <femoRoot>/femo2host/python/femo_bridge.py；
 *   - python 解析：显式参 > FEMO_PYTHON env > 'python'（zcode 旧版不认
 *     FEMO_PYTHON——自家 spawnPython 认、拉桥不认，漂移顺带拽正）；
 *   - 数据根：dataDir 传入才带 --db（沙盒/分桶）；缺省不传=共享数据根
 *     （多实例=多宿主拍板，dsh 形态）；
 *   - 身份：host（--host，驿站归属键）与 hostName（--host-name + env
 *     FEMO_HOST_NAME，投影自称）分立可传——dsh 双词齐传是正确姿势。
 *
 * dsh bridge.ts 暂不接：它是 TS 形态件（subprocess 服务轮询 + SubprocessHandle
 * 契约翻译 + 诊断挂钩），argv 段将来可换用本件。（已过时：dsh 2026-09-26 直连
 * 换芯，不再消费本件生桥段。）
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

/** 桥本体路径（唯一权威；03.3 最尴尬教训：路径漂移=宿主被迫互带目录）。 */
export function bridgePythonPath(femoRoot) {
  return join(femoRoot, 'femo2host', 'python', 'femo_bridge.py');
}

/** python 可执行解析：显式参 > FEMO_PYTHON env > 'python'。 */
export function resolvePythonPath(explicit) {
  return explicit ?? process.env.FEMO_PYTHON ?? 'python';
}

/**
 * 组装桥启动 argv 与 env。
 * @param {object} opts
 * @param {string} opts.femoRoot           引擎根（--fe4m；cwd 由调用方给，同值）
 * @param {string} [opts.hostManifestPath] 宿主清单（--host-manifest）
 * @param {string} [opts.host]             宿主自称（--host：驿站 target_host/归属键）
 * @param {string} [opts.hostName]         投影自称（--host-name + env FEMO_HOST_NAME）
 * @param {string} [opts.dataDir]          数据根沙盒（FEMO_DATA_DIR 场景才传 → --db <dataDir>/femo/memory/Chronica.wor）
 * @param {string|number} [opts.pushPort]  收件口端口（env FEMO_PUSH_PORT；缺省不设=自取模式）
 * @returns {{ argv: string[], env: Record<string, string> }}
 */
export function buildBridgeLaunch(opts) {
  if (!opts?.femoRoot) throw new Error('buildBridgeLaunch: femoRoot is required');
  const argv = [bridgePythonPath(opts.femoRoot), '--fe4m', opts.femoRoot];
  if (opts.hostManifestPath) argv.push('--host-manifest', opts.hostManifestPath);
  if (opts.host) argv.push('--host', opts.host);
  if (opts.hostName) argv.push('--host-name', opts.hostName);
  if (opts.dataDir) argv.push('--db', join(opts.dataDir, 'femo', 'memory', 'Chronica.wor'));
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
  if (opts.hostName) env.FEMO_HOST_NAME = opts.hostName;
  if (opts.pushPort) env.FEMO_PUSH_PORT = String(opts.pushPort);
  return { argv, env };
}

/**
 * node spawn 适配壳（BridgeClient.spawnProc 契约：spec={argv,cwd,env}）。
 * stderr 必须 pipe 不用 ignore：traceback 要活出来；cwd 给桥可污染的工作区
 * （它会把 debug_normalized_output.femo 写进 CWD）。
 * @param {string} pythonPath resolvePythonPath() 的结果
 */
export function nodeSpawnProc(pythonPath) {
  return spec => spawn(pythonPath, spec.argv, {
    cwd: spec.cwd,
    env: spec.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 惰性拉起 + ping 就绪（桥冷启 ~1s；25×300ms + ping 2s 窗口，zcode/autoclaw
 * 同款参数收编于此）。bridge.alive 已活时零开销直返。
 * @param {import('./已退役-bridge-client.mjs').BridgeClient} bridge
 */
export async function ensureBridgeReady(bridge, { attempts = 25, delayMs = 300, pingTimeoutMs = 2000 } = {}) {
  if (bridge.alive) return;
  bridge.start();
  for (let i = 0; i < attempts; i++) {
    try { await bridge.send('ping', {}, pingTimeoutMs); return; } catch { await sleep(delayMs); }
  }
  throw new Error('bridge did not become ready (python/femo_bridge.py)');
}
