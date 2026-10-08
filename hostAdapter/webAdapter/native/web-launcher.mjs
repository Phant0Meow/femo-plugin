#!/usr/bin/env node
/**
 * web-launcher.mjs — Chrome Native Messaging 宿主：侧栏「一键启动本地服务」的本体。
 *
 * 链路：扩展 background 经 chrome.runtime.sendNativeMessage 发一帧 {"cmd":"start"}
 * → Chrome 按 HKCU 注册表登记的路径拉起本脚本 → 本脚本与 Chrome 之间走
 * Native Messaging 协议（4 字节小端长度前缀 + JSON）→ 分离拉起 node server/service.mjs
 * → /health 探活成功后回 {"ok":true,...} 退出；服务独立存活（detached，不随浏览器死）。
 *
 * 幂等：/health 已通就直接回「已在运行」，不重复拉起。
 * 安全：allowed_origins 锁定本扩展一个 origin（ID 被 manifest.json 的 key 钉死，
 * 登记由本地服务启动时自动完成，见 register-core.mjs）。
 * 兜底红线（全局 §7.1）自查：这里不吞错——健康检查超时、拉起失败都把错误原话回给
 * 扩展展示，不停留在静默。
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';

const ADAPTER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVICE = path.join(ADAPTER_ROOT, 'server', 'service.mjs');

/** Native Messaging 单帧上限：我们发出去的最大是错误文本，1MB 绰绰有余。 */
const MAX_FRAME = 1024 * 1024;

/** 从 stdin 读一帧（4 字节小端长度 + JSON）。没有输入（如双击误跑）就安静退出。 */
function readFrame() {
  return new Promise(resolve => {
    const chunks = [];
    let total = 0;
    const header = [];
    let state = 'header'; // header → body
    let need = 4;
    let bodyLen = 0;
    function onChunk(chunk) {
      let offset = 0;
      while (offset < chunk.length) {
        const take = Math.min(need, chunk.length - offset);
        const piece = chunk.subarray(offset, offset + take);
        offset += take;
        if (state === 'header') {
          header.push(piece);
          need -= take;
          if (need === 0) {
            bodyLen = Buffer.from(Buffer.concat(header)).readUInt32LE(0);
            state = 'body';
            need = bodyLen;
            if (need === 0) { finish(); return; }
          }
        } else {
          chunks.push(piece);
          need -= take;
          if (need === 0) { finish(); return; }
        }
      }
    }
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      process.stdin.removeListener('data', onChunk);
      const body = Buffer.concat(chunks).toString('utf8');
      let msg = {};
      try { msg = JSON.parse(body); } catch { /* 非法帧按空消息处理 */ }
      resolve(msg);
    }
    process.stdin.on('data', onChunk);
    process.stdin.on('end', finish);
    // 现实保险：30 秒还没凑齐一帧就放弃（正常 Chrome 调用瞬间就给全）。
    setTimeout(finish, 30_000).unref();
  });
}

/** 回一帧给 Chrome 再退出。 */
function sendFrame(msg) {
  const body = Buffer.from(JSON.stringify(msg), 'utf8');
  if (body.length > MAX_FRAME) {
    // 超长（理论上只有异常栈会这样）：截断成人话再回，不让 Chrome 静默丢弃。
    const cut = JSON.stringify({ ok: false, error: String(msg.error ?? '').slice(0, 8000) });
    const b2 = Buffer.from(cut, 'utf8');
    const h2 = Buffer.alloc(4);
    h2.writeUInt32LE(b2.length, 0);
    process.stdout.write(h2);
    process.stdout.write(b2);
    return;
  }
  const head = Buffer.alloc(4);
  head.writeUInt32LE(body.length, 0);
  process.stdout.write(head);
  process.stdout.write(body);
}

/** GET /health 单次探测，1.2 秒超时。返回 'up' | 'down'。
 *  端口与 service.mjs 的 FEMO_WEB_PORT 缺省 8796 三处互指（本件与扩展
 *  background 都在服务起来之前跑、读不到 env）——改缺省端口三处同改。 */
function probeOnce() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: 8796, path: '/health', timeout: 1200 }, res => {
      res.resume();
      resolve('up');
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve('down'));
  });
}

/** 轮询 /health 直到 up 或超时。 */
async function probeHealth(waitMs) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    if (await probeOnce() === 'up') return 'up';
    if (Date.now() >= deadline) return 'down';
    await new Promise(r => setTimeout(r, 400));
  }
}

/** 分离拉起本地服务：日志走服务自己的标准落点，本进程不养它。 */
function launchService() {
  const child = spawn(process.execPath, [SERVICE], {
    cwd: ADAPTER_ROOT,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
  child.unref();
  return child.pid;
}

const msg = await readFrame();

// 只认 start 一张脸；其余原话拒绝（不留模糊空间）。
if (msg?.cmd !== 'start') {
  sendFrame({ ok: false, error: `不认识的指令：${JSON.stringify(msg ?? null)}（只支持 {"cmd":"start"}）` });
  process.exit(0);
}

const before = await probeHealth(1500);
if (before === 'up') {
  sendFrame({ ok: true, already: true, message: '本地服务已在运行' });
  process.exit(0);
}

let pid;
try {
  pid = launchService();
} catch (e) {
  sendFrame({ ok: false, error: `拉起失败：${e}` });
  process.exit(0);
}

// 给服务 15 秒起步时间（首次冷启动要读账本、惰性拉桥，留足余量）。
const after = await probeHealth(15_000);
if (after === 'up') {
  sendFrame({ ok: true, pid, message: '本地服务已启动' });
} else {
  sendFrame({ ok: false, error: `服务拉起后 15 秒内未通过 /health 探活（pid ${pid}），去查 server.log 或手动跑 node server/service.mjs 看原话报错` });
}
process.exit(0);
