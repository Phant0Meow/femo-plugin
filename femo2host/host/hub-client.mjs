/**
 * hub-client.mjs — 投影中心（hub）地址唯一解析（2026-09-24 收编，审计 A2）。
 *
 * 旧态：dsh 三份手写「FEMO_PROJECTION_PORT||8790」算式（hub-feed/hub-proxy/
 * session-roster，模块级常量），都不读桥写的自发现件 hub.json——桥端口被占
 * 时 resolve_port 会向上探 20 个，宿主却仍按 8790 喂 → 行静默喂进邻居 hub
 * （喂错对象不报错）。autoclaw 另有一份 hub.json 读取。收编于此：
 *
 *   hubJsonPath(femoRoot)    自发现件路径（python 侧 PROJECTION_DIR 同口径：
 *                            FEMO_DATA_DIR → <DIR>/femo/projection/，缺省
 *                            → <femoRoot>/user_data/projection/——注意缺省
 *                            分支没有 femo/ 段，照抄 python 勿「修正」）
 *   readHubInfo(femoRoot)    读 hub.json（mtime+size 缓存；桥停机撤件即回落）
 *   resolveHubPort(femoRoot) hub.json.port（桥实况）> env（宿主显式指定）
 *                            > 8790（老缺省）
 *   hubBaseUrl(femoRoot)     http://127.0.0.1:<port>
 *
 * femoRoot 可省（自解析：env FEMO_ROOT > 含 femo2host/ 的祖先目录，同
 * femoRoot.mjs）。缓存按 stat mtime+size 失效：hub.json 重写/删除即刻感知，
 * 常态零重复读盘（喂行 40ms 微批不产生 IO 放大）。
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFemoRoot } from '../femoRoot.mjs';

let _defaultRoot;
function defaultFemoRoot() {
  if (process.env.FEMO_ROOT) return process.env.FEMO_ROOT.replace(/[\\/]+$/, '');
  _defaultRoot ??= resolveFemoRoot(dirname(fileURLToPath(import.meta.url)));
  return _defaultRoot;
}

export function hubJsonPath(femoRoot) {
  const root = femoRoot ?? defaultFemoRoot();
  if (process.env.FEMO_DATA_DIR) return join(process.env.FEMO_DATA_DIR, 'femo', 'projection', 'hub.json');
  return join(root, 'user_data', 'projection', 'hub.json');
}

let _cache = { path: '', mtimeMs: -1, size: -1, info: undefined };

/** 读自发现件：{ port, host?, pid?, started? }；缺件/坏件=undefined（不算错）。
 *  停机即撤（桥删 hub.json）→ 缓存失效回落 env/缺省，喂侧 fetch 自然失败静默
 *  ——与旧行为一致，但不再可能喂错「活着的邻居」。 */
export function readHubInfo(femoRoot) {
  const path = hubJsonPath(femoRoot);
  try {
    const st = statSync(path);
    if (_cache.path === path && _cache.mtimeMs === st.mtimeMs && _cache.size === st.size) return _cache.info;
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const port = Number(raw?.port);
    const info = Number.isFinite(port) && port > 0
      ? { port, host: typeof raw.host === 'string' ? raw.host : undefined }
      : undefined;
    _cache = { path, mtimeMs: st.mtimeMs, size: st.size, info };
    return info;
  } catch {
    if (_cache.path === path) _cache = { path: '', mtimeMs: -1, size: -1, info: undefined };
    return undefined;
  }
}

export function resolveHubPort(femoRoot) {
  const fromFile = readHubInfo(femoRoot);
  if (fromFile) return fromFile.port;
  const env = String(process.env.FEMO_PROJECTION_PORT ?? '');
  if (/^\d+$/.test(env)) return Number(env);
  return 8790;
}

export function hubBaseUrl(femoRoot) {
  return `http://127.0.0.1:${resolveHubPort(femoRoot)}`;
}
