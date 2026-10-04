/**
 * daemon-client.mjs — 常驻引擎直连客户端（femo2host 公共层，2026-09-26 第3步）。
 *
 * 常驻化第 3 步「适配器直连」的公共件：适配器不再生 Python 桥子进程，直接与
 * 常驻引擎 femo_daemon.py 的三个 HTTP 面对话——
 *   · POST /cmd/<cmd>      命令（stdio 信封原样；args 注入 _caller_host，
 *                          job_start/job_resume 另注 _host_manifest 清单路径）
 *   · GET  /engine/events  SSE 事件直播（?host=<宿主>=归属闸，live-only——
 *                          历史归 hub 冷唤醒，重放帧跳过，与转发壳同纪律）
 *   · POST /engine/doorbell 全员门铃心跳（10s 一拍，TTL 30s 过期）：推送户带
 *     收件口 URL（急件上门），自取户报空门牌——报到即算在线，闲时散场点名
 *     用（2026-09-27 起自取户也起心跳）
 *
 * 发现与看门（镜像 Python 侧 HubClient.connect + 转发壳 main() 的语义，逐条
 * 对应，不发明新机制）：
 *   · 读 hub.json 自发现账（路径唯一口径 = hub-client.hubJsonPath）；
 *   · 探活双验：/health 的数据根指纹一致（别人家的 hub 不算活）+ /engine/health
 *     报 engine:true（只有 hub 没引擎面 = 旧版 v0 daemon，响亮报错绝不裸奔，
 *     运维：杀旧 femo_daemon，下一座客户端代拉新版）；
 *   · 死/无 → 以**脱离母进程**方式代拉 femo_daemon.py（--data-dir=dirname(hub.json)，
 *     沙盒数据根带 --db；日志 = <projection>/logs/femo_daemon.log，与 Python
 *     代拉同一落点），60s 循环等它写账、命令面随 ready 直接可用；代拉前先抢
 *     跨进程意图锁 daemon-spawn.lock（O_EXCL）——多客户端同刻齐醒只许一家
 *     代拉，其余只探账等写账（2026-09-28 镜窗成群事故收口，引擎侧另有
 *     femo_daemon._claim_ledger 收口闸兜底）；
 *   · 常驻引擎中途死亡：SSE 断流 / 命令连接失败 → 惰性重发现+代拉；hub.json
 *     的 pid 换人了才向宿主报 onExited（宿主据此放弃在飞回合），pid 未变只是
 *     断流则静默重订阅。
 *
 * 对外接口与 bridge-client.BridgeClient 对齐（start/send/stop/alive/onEvent/
 * onExited/log），适配器总装层零改动换芯。语义差异（都是常驻化的本意）：
 *   · stop() 只断自己（关 SSE/门铃），**不发 shutdown**——不强迫引擎随客户端
 *     退场（金标准①关窗戏演完）。宿主要按宿主停戏请显式 send('shutdown')
 *     （daemon 按调用方宿主格限定停场，引擎继续站岗）。2026-09-27 起 daemon
 *     有闲时散场：所有宿主都断了心跳且满宽限期，引擎自己诚实挂起散场——
 *     本客户端的 stop 不触发它，只有「全宿主真下线」才触发；
 *   · onEngineLine/onEngineStderr 不再有数据流——引擎 stderr 归 daemon 日志
 *     文件；参数保留接受，连接事件走 log。
 */

import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { dirname, join } from 'node:path';
import { hubJsonPath } from './hub-client.mjs';

const HTTP_TIMEOUT_SEC = 120;      // 命令 HTTP 超时（转发壳同款固定值；调用方超时另算）
const DISCOVER_DEADLINE_SEC = 60;  // 代拉循环窗（HubClient.connect 同款）
const SPAWN_LOCK_TTL_MS = 30_000;  // 代拉意图锁时效（持锁者一轮代拉最多 ~12s，超时视为死锁接管）
const DOORBELL_PERIOD_MS = 10_000; // 门铃心跳（TTL 30s，daemon 侧定）
const DAEMON_LOG_REL = join('logs', 'femo_daemon.log');   // 与 Python 代拉同一落点

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** 一发 JSON（GET/POST）；返回 {status, body, raw}。连接类失败抛错（调用方分拣）。
 *  agent:false + 显式 Content-Length 两件都是给 Python http.server 的：其一，
 *  无 Content-Length 的请求体 node 默认走 chunked，python 不认 chunked、响应后
 *  把体字节留在套接字里，连接复用时残留字节会被当成下一张应答解析（实测
 *  Parse Error: Expected HTTP/）；其二，不复用连接，thread-per-connection 的
 *  python 侧不留挂着的线程。 */
function httpJson(base, pathAndQuery, { method = 'GET', body, timeoutSec = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname, search } = new URL(base + pathAndQuery);
    const payload = body === undefined || typeof body === 'string' ? body : JSON.stringify(body);
    const r = httpRequest({
      hostname, port, path: pathname + search, method,
      agent: false,
      headers: payload !== undefined
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        : {},
      timeout: timeoutSec * 1000,
    }, resp => {
      let buf = '';
      resp.on('data', c => { buf += c; });
      resp.on('end', () => {
        let out = null;
        try { out = JSON.parse(buf); } catch { /* 非 JSON（404 页等）保持 null */ }
        resolve({ status: resp.statusCode, body: out, raw: buf });
      });
    });
    r.on('timeout', () => { r.destroy(new Error(`timeout ${timeoutSec}s: ${pathAndQuery}`)); });
    r.on('error', reject);
    if (payload !== undefined) r.write(payload);
    r.end();
  });
}

/** 只读探活（**不代拉**；2026-09-29 收编导出）：数据根指纹 + 引擎面的双验
 *  正身。此前只活在 DaemonClient._probe 里，zcode 钩子手抄半截（漏 /health
 *  面、404 语义相反）——两份必漂。返回 {base, pid, health} 或 null（死/无/
 *  装配中）；旧版 v0 daemon（引擎面 404）默认响亮抛错（客户端纪律：绝不
 *  裸奔），opts.quiet404 供钩子的纪律（绝不代拉、安静放行）按没就绪处理。
 *  timeoutSec 两探各用一次（钩子 4s 预算传小值；客户端缺省 3）。 */
export async function probeDaemon(femoRoot, { quiet404 = false, timeoutSec = 3 } = {}) {
  const addrPath = hubJsonPath(femoRoot);
  if (!existsSync(addrPath)) return null;
  let addr;
  try {
    addr = JSON.parse(readFileSync(addrPath, 'utf8'));
  } catch { return null; }                 // 半截 JSON（原子写竞态窗）：当没账
  const port = Number(addr?.port);
  if (!Number.isFinite(port) || port <= 0) return null;
  const base = `http://127.0.0.1:${port}`;
  let health;
  try {
    health = await httpJson(base, '/health', { timeoutSec });
  } catch { return null; }                 // 连不上：死账
  if (health.status !== 200 || health.body?.ok !== true) return null;
  // 数据根指纹：账与 /health 都报了 data 且不一致 = 别人家的 hub，不算活
  const want = dirname(addrPath);
  const got = String(health.body?.data || '');
  if (got && want !== got) return null;
  // 引擎面：404 = 旧版 v0 daemon（只有 hub）
  let eng;
  try {
    eng = await httpJson(base, '/engine/health', { timeoutSec });
  } catch { return null; }
  if (eng.status === 404) {
    if (quiet404) return null;
    throw new Error('常驻引擎缺引擎面（旧版 v0 daemon，HTTP 404）——'
      + '运维：杀旧 femo_daemon（hub.json pid=' + (addr.pid ?? '?') + '），'
      + '下一座客户端代拉新版。');
  }
  if (eng.status !== 200 || eng.body?.engine !== true) return null;   // 装配中：当没就绪
  return { base, pid: Number(addr.pid) || 0, health: eng.body };
}

/**
 * 请求常驻引擎立即散场（2026-09-29，webAdapter「关闭服务」专用；其他宿主不消费）。
 * 只传话不代拉、不重试——引擎散场引擎自己裁（门铃簿点名：还有别家宿主在线就
 * 拒绝，别家不想被灭灯）。返回应答信封；连接不上=引擎本来就不在（返回 null）。
 * @param {string} femoRoot 引擎根（发现账的锚）
 */
export async function requestDaemonShutdown(femoRoot) {
  const hit = await probeDaemon(femoRoot);
  if (!hit) return null;                       // 引擎不在：无需散场
  return httpJson(hit.base, '/cmd/daemon_shutdown', {
    method: 'POST',
    body: JSON.stringify({ id: 1, cmd: 'daemon_shutdown', args: { _caller_host: 'web' } }),
    timeoutSec: 15,
  }).then(out => {
    if (out.status === 200 && out.body?.type === 'response') return out.body;
    throw new Error(`daemon_shutdown 应答异常（HTTP ${out.status}）：${String(out.raw ?? '').slice(0, 160)}`);
  });
}

/**
 * 读数据根设置（2026-09-30 设置中心刀；引擎唯一权威，宿主不各读各的
 * setting.json——同样的逻辑写两份必然漂移）。连接不上=引擎本来就不在
 * （返回 null）；应答异常响亮抛。
 * @param {string} femoRoot 引擎根（发现账的锚）
 */
export async function fetchDaemonSettings(femoRoot) {
  const hit = await probeDaemon(femoRoot);
  if (!hit) return null;
  return httpJson(hit.base, '/cmd/config_get', {
    method: 'POST',
    body: JSON.stringify({ id: 1, cmd: 'config_get', args: {} }),
    timeoutSec: 10,
  }).then(out => {
    if (out.status === 200 && out.body?.type === 'response') return out.body;
    throw new Error(`config_get 应答异常（HTTP ${out.status}）：${String(out.raw ?? '').slice(0, 160)}`);
  });
}

/**
 * 写本宿主一格设置（现役键 console_window，值 show/hide）。callerHost 必须
 * 与本宿主门铃登记同格（散场话同一身份纪律：报错格=写不进自己那格还被引擎
 * 点名拦住，冒别人格=冒写别家的愿望）。业务错（未知键/错值/缺身份）按
 * ok:false 信封原样返回，不抛；连接不上=引擎不在（返回 null）。
 * @param {string} femoRoot   引擎根（发现账的锚）
 * @param {string} callerHost 本宿主门铃格（如 'web' / 'dsh-8123'）
 * @param {string} key        设置键（现役只有 'console_window'）
 * @param {string} value      'show' | 'hide'
 */
export async function setDaemonSetting(femoRoot, callerHost, key, value) {
  const hit = await probeDaemon(femoRoot);
  if (!hit) return null;
  return httpJson(hit.base, '/cmd/config_set', {
    method: 'POST',
    body: JSON.stringify({ id: 1, cmd: 'config_set', args: { _caller_host: callerHost, key, value } }),
    timeoutSec: 10,
  }).then(out => {
    if (out.status === 200 && out.body?.type === 'response') return out.body;
    throw new Error(`config_set 应答异常（HTTP ${out.status}）：${String(out.raw ?? '').slice(0, 160)}`);
  });
}

/**
 * 常驻引擎直连客户端。
 * @param {object} opts
 * @param {string}  opts.femoRoot   引擎根（发现账与 daemon 路径的锚）
 * @param {string}  opts.host       宿主格（--host 同词：归属闸/host_refs 键/门铃键）
 * @param {string}  [opts.hostName] hub 登记名与投影自称（缺省 = host）
 * @param {string}  [opts.hostManifestPath] 宿主清单路径（job_start/job_resume 随场注入）
 * @param {string}  [opts.dataDir]  沙盒数据根（传入才带 --db，桥启动三件套同语义）
 * @param {string}  [opts.pushUrl]  本宿主收件口完整 URL（门牌：急件上门用）。心跳与它
 *                          无关——全员照起（2026-09-27 起），不传=自取户空门牌只报
 *                          在线（见文件头门铃段；旧注「传入则开门铃心跳」已作废）
 * @param {string}  [opts.python]   python 可执行（缺省 FEMO_PYTHON env > 'python'）
 * @param {(eventType: string, data: unknown) => void} [opts.onEvent] 引擎事件上抛
 * @param {(line: string) => void}   [opts.onEngineLine] 保留兼容（引擎 stderr 现归 daemon 日志）
 * @param {(line: string) => void}   [opts.onEngineStderr] 保留兼容（同上）
 * @param {(msg: string) => void}    [opts.log] 诊断日志
 */
export class DaemonClient {
  constructor(opts = {}) {
    if (!opts.femoRoot) throw new Error('DaemonClient: femoRoot is required');
    if (!opts.host) throw new Error('DaemonClient: host is required');
    this.femoRoot = opts.femoRoot;
    this.host = String(opts.host);
    this.hostName = String(opts.hostName || opts.host);
    this.hostManifestPath = opts.hostManifestPath || '';
    this.dataDir = opts.dataDir || '';
    this.pushUrl = opts.pushUrl || '';
    this.pythonPath = opts.python ?? process.env.FEMO_PYTHON ?? 'python';
    this.onEvent = opts.onEvent;
    this.onEngineLine = opts.onEngineLine;
    this.onEngineStderr = opts.onEngineStderr;
    this.log = opts.log ?? (() => {});
    this.onExited = undefined;      // 宿主接线：daemon 换家（pid 变）时通知
    this.projectionDir = dirname(hubJsonPath(this.femoRoot));
    this.daemonPy = join(this.femoRoot, 'femo2host', 'python', 'femo_daemon.py');
    /** @type {Promise<{base:string,pid:number}> | null} ensure 全链（发现/代拉/就绪） */
    this._ready = null;
    this._readyLock = Promise.resolve();
    this._base = '';
    this._pid = 0;
    this._sseAbort = undefined;     // {stop:boolean} SSE 循环停车牌
    this._doorbellAbort = undefined;
    this._stopped = false;
    this._idSeq = 0;
  }

  get alive() {
    return this._ready !== null && this._base !== '';
  }

  /** 当前引擎地址（诊断用）。 */
  get base() { return this._base; }

  // ── 发现 / 代拉 / 就绪 ────────────────────────────────────────────────

  /** 探活双验（数据根指纹 + 引擎面）。返回 {base,pid} 或 null（死/无）；
   *  旧版 v0 daemon 抛错（响亮，绝不裸奔）。正身=模块级 probeDaemon
   *  （2026-09-29 收编导出，zcode 钩子同吃一份）。 */
  async _probe() {
    return probeDaemon(this.femoRoot);
  }

  /** 代拉 femo_daemon.py（脱离母进程；镜像 Python 侧 _spawn_daemon 的全部落点）。 */
  _spawnDaemon() {
    if (!existsSync(this.daemonPy)) {
      throw new Error(`femo_daemon.py 不存在：${this.daemonPy}（引擎根指错或安装缺件）`);
    }
    mkdirSync(join(this.projectionDir, 'logs'), { recursive: true });
    const logPath = join(this.projectionDir, DAEMON_LOG_REL);
    const logf = openSync(logPath, 'a');
    // PYTHONUNBUFFERED：daemon 的 stdout/stderr 重定向进日志文件后 python 转
    // 块缓冲，引擎 print 不落盘实时可见（排障取证全靠这份日志）。
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PYTHONUNBUFFERED: '1', FEMO_ROOT: this.femoRoot };
    const argv = [this.daemonPy, '--data-dir', this.projectionDir];
    if (this.dataDir) {
      // 沙盒数据根：账本 --db（桥启动三件套同语义），FEMO_DB_PATH 环境接力
      const db = join(this.dataDir, 'femo', 'memory', 'Chronica.wor');
      env.FEMO_DB_PATH = db;
      argv.push('--db', db);
    }
    const child = spawn(this.pythonPath, argv,
      { cwd: this.femoRoot, env, detached: true, windowsHide: true, stdio: ['ignore', logf, logf] });
    child.unref();
    this.log(`daemon spawned (pid=${child.pid}) log=${logPath}`);
  }

  /** 跨进程代拉意图锁（2026-09-28 镜窗成群事故）：hub.json 死账谁探到谁就想
   *  代拉，多客户端同刻齐醒就是一波孪生 daemon。锁文件 O_EXCL 建锁（驿站信柜
   *  同款跨进程原语），同数据根同一时刻只许一家代拉——没抢到的只探账不抢生
   *  （引擎侧另有收口闸 femo_daemon._claim_ledger 兜底，这里是少生浪费进程）。 */
  _spawnLockPath() { return join(this.projectionDir, 'daemon-spawn.lock'); }

  /** 试拿代拉锁：建锁成功=拿到；已存在则看持锁者——活着且未超时不抢，
   *  已死（pid 探不到）或超时（30s，防 pid 复用假活）删锁接管。 */
  _acquireSpawnLock() {
    const lockPath = this._spawnLockPath();
    // 全新数据根上 projection/ 尚无人建过（建目录在 _spawnDaemon，跑在拿锁之后）
    // ——先补目录再建锁，否则首跑代拉 ENOENT（实锤：全新 Temp 沙盒冒烟必炸）。
    mkdirSync(this.projectionDir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = openSync(lockPath, 'wx');        // O_CREAT|O_EXCL：建锁即拿锁
        try {
          writeSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }));
        } finally { closeSync(fd); }
        return true;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
      let holder = null;
      try { holder = JSON.parse(readFileSync(lockPath, 'utf8')); } catch { holder = null; }
      let holderAlive = false;
      if (Number(holder?.pid) > 0) {
        try { process.kill(Number(holder.pid), 0); holderAlive = true; } catch { holderAlive = false; }
      }
      const fresh = Date.now() - Number(holder?.ts || 0) < SPAWN_LOCK_TTL_MS;
      if (holderAlive && fresh) return false;       // 别家正拉着：不抢生
      try { unlinkSync(lockPath); } catch { }       // 死锁/陈锁：接管
    }
    return false;                                   // 两拍都没拿到：当别人在拉
  }

  /** 放锁——只删自己名下的（被接管者覆写过的锁不动它）。 */
  _releaseSpawnLock() {
    try {
      const holder = JSON.parse(readFileSync(this._spawnLockPath(), 'utf8'));
      if (Number(holder?.pid) === process.pid) unlinkSync(this._spawnLockPath());
    } catch { }
  }

  /** ensure 全链：发现 → 死/无则代拉循环（60s）→ 就绪后补登记/开播/开门铃。
   *  代拉节奏镜像 Python 侧 connect：spawn 一发后先探 ~12s 再下一发——daemon
   *  冷启（hub+引擎装配）要几秒才写账，1s 一发会养出竞态孪生。 */
  _ensure() {
    const run = async () => {
      const t0 = Date.now();
      let hit = null;
      let lastErr = '';
      const probeOnce = async () => {
        try {
          hit = await this._probe();
        } catch (e) {
          this.log(`daemon probe fatal: ${String(e.message ?? e)}`);
          throw e;                              // 旧版 daemon：响亮，不进循环
        }
        return hit !== null;
      };
      while (!hit && Date.now() - t0 < DISCOVER_DEADLINE_SEC * 1000) {
        if (await probeOnce()) break;
        if (!this._acquireSpawnLock()) {
          // 别家进程正在代拉同一座数据根：不抢生——每 2s 探一次账，等它起的 daemon 写账
          await sleep(2000);
          continue;
        }
        try {
          try { this._spawnDaemon(); } catch (e) {
            lastErr = String(e.message ?? e);
            this.log(`daemon spawn failed: ${lastErr}`);
          }
          for (let i = 0; i < 12 && !hit; i++) {  // 每轮最多等 ~12s（daemon 冷启毫秒级~秒级）
            await sleep(1000);
            if (Date.now() - t0 >= DISCOVER_DEADLINE_SEC * 1000) break;
            await probeOnce();
          }
        } finally {
          this._releaseSpawnLock();
        }
      }
      if (!hit) throw new Error(`常驻引擎代拉失败（${DISCOVER_DEADLINE_SEC}s 内未就绪）${lastErr ? '：' + lastErr : ''}`);
      this._base = hit.base;
      this._pid = hit.pid;
      this.log(`daemon discovered: ${this._base} (pid=${this._pid})`);
      await this._registerHost();
      this._startSse();
      this._startDoorbell();   // 全员报到：推送户带门牌，自取户空门牌（散场点名用）
      return hit;
    };
    const p = this._readyLock.then(run, run);
    this._readyLock = p.catch(() => {});        // 失败不锁死后续重试
    return p;
  }

  /** hub 宿主登记（转发壳 HubClient.connect(register_name) 的直连版；best-effort——
   *  信任集由喂方登记兜底，花名册少一行不挡运行）。登记体捎带清单申报的能力
   *  （god_window 等，投影中心据申报决定给不给这家出上帝视角条目）：清单读
   *  不到/没申报的字段就不带——hub 对缺省字段一律按「有」办，老宿主零回归。 */
  _manifestCaps() {
    if (!this.hostManifestPath || !existsSync(this.hostManifestPath)) return {};
    try {
      const m = JSON.parse(readFileSync(this.hostManifestPath, 'utf8'));
      const caps = {};
      if (typeof m.god_window === 'boolean') caps.god_window = m.god_window;
      return caps;
    } catch {
      return {};   // 清单坏了不带能力：hub 缺省=有，登记本身不许被清单炸掉
    }
  }

  async _registerHost() {
    try {
      await httpJson(this._base, '/hub-register',
        { method: 'POST', body: { kind: 'host', name: this.hostName, ...this._manifestCaps() }, timeoutSec: 5 });
    } catch (e) {
      this.log(`hub-register failed (best-effort): ${String(e.message ?? e).slice(0, 160)}`);
    }
  }

  /** 惰性重发现（引擎死后恢复）：清 ready 状态重跑 ensure；返回新址。 */
  async _rediscover() {
    this._ready = null;
    this._base = '';
    this._pid = 0;
    return this._ensure();
  }

  // ── SSE 事件直播（live-only）──────────────────────────────────────────

  _startSse() {
    if (this._sseAbort) this._sseAbort.stop = true;   // 重发现换台：旧循环先停车（孤儿循环会代拉野 daemon）
    const stopFlag = { stop: false };
    this._sseAbort = stopFlag;
    void (async () => {
      while (!stopFlag.stop) {
        const pidBefore = this._pid;
        try {
          await this._sseOnce(stopFlag);
        } catch (e) {
          if (stopFlag.stop) return;
          this.log(`sse down: ${String(e.message ?? e).slice(0, 160)} — rediscover in 1s`);
        }
        if (stopFlag.stop) return;
        // 引擎换家（pid 变）才向宿主报 onExited：宿主据此放弃在飞回合
        try {
          const hit = await this._rediscover();
          if (pidBefore && hit.pid && hit.pid !== pidBefore && this.onExited) {
            this.onExited({ code: null, signal: null });
          }
        } catch (e) {
          this.log(`rediscover failed: ${String(e.message ?? e).slice(0, 160)}`);
        }
        await sleep(1000);
      }
    })();
  }

  _sseOnce(stopFlag) {
    return new Promise((resolve, reject) => {
      const { hostname, port } = new URL(this._base);
      const path = '/engine/events?host=' + encodeURIComponent(this.host) + '&since=1000000000';
      // timeout 给 60s 作空转保险丝：daemon 15s 心跳持续保活，真死连接 60s 内
      // 触发重发现。**r.end() 必须调**：不 end 请求头永远不会发出（socket 连上
      // 也不发），python 侧看不到请求、永不应答——首轮实测就栽在这。
      const r = httpRequest({ hostname, port, path, timeout: 60_000, agent: false }, resp => {
        this.log(`sse connected status=${resp.statusCode}`);
        if (resp.statusCode !== 200) {
          reject(new Error(`sse HTTP ${resp.statusCode}`));
          resp.resume();
          return;
        }
        let buf = '';
        resp.on('data', chunk => {
          buf += chunk.toString('utf8');
          let idx;
          while ((idx = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line.startsWith('data: ')) continue;      // 心跳注释行/空行
            let env;
            try { env = JSON.parse(line.slice(6)); } catch { continue; }
            if (env.replay) continue;                      // live-only：重放帧跳过
            if (env.type === 'event') this.onEvent?.(String(env.event ?? ''), env.data);
          }
        });
        resp.on('end', () => resolve());                   // 服务端断流：正常返回
        resp.on('error', reject);
      });
      r.on('timeout', () => r.destroy(new Error('sse idle timeout')));
      r.on('error', reject);
      r.end();                                            // 不 end 请求头永不发出
      // 停车牌：stop 时砸连接让 Promise 落定
      const timer = setInterval(() => {
        if (stopFlag.stop) { try { r.destroy(); } catch { /* 已断 */ } clearInterval(timer); }
      }, 200);
      r.on('close', () => clearInterval(timer));
    });
  }

  // ── 门铃心跳（全员报到：推送户带门牌可上门，自取户空门牌只报在线）──────

  _startDoorbell() {
    if (this._doorbellAbort) this._doorbellAbort.stop = true;   // 同 _startSse：旧循环先停车
    const stopFlag = { stop: false };
    this._doorbellAbort = stopFlag;
    void (async () => {
      while (!stopFlag.stop) {
        try {
          await httpJson(this._base, '/engine/doorbell',
            { method: 'POST', body: { host: this.host, url: this.pushUrl }, timeoutSec: 5 });
        } catch (e) {
          this.log(`doorbell register failed: ${String(e.message ?? e).slice(0, 120)}`);
        }
        for (let i = 0; i < DOORBELL_PERIOD_MS / 100 && !stopFlag.stop; i++) await sleep(100);
      }
    })();
  }

  // ── 命令与生命周期 ────────────────────────────────────────────────────

  /** 发命令；resolve=result / reject=Error(detail||error)。语义与 BridgeClient.send
   *  对齐（含超时）；连接类失败惰性重发现+代拉后重试一次，再失败诚实报错——
   *  业务错误（HTTP 200 的 ok:false 信封）不重试，不会重复 job_start。 */
  send(cmd, args = {}, timeoutMs = 15_000) {
    if (this._stopped) return Promise.reject(new Error('daemon client stopped'));
    if (!this._ready) this._ready = this._ensure().catch(e => { this._ready = null; throw e; });
    const attempt = async () => {
      let out;
      try {
        out = await httpJson(this._base, '/cmd/' + encodeURIComponent(cmd), {
          method: 'POST',
          body: JSON.stringify({ id: ++this._idSeq, cmd, args: this._bindCaller(cmd, args) }),
          timeoutSec: HTTP_TIMEOUT_SEC,
        });
      } catch (e) {
        const err = new Error('daemon_unreachable');
        err.detail = `常驻引擎不可达（${String(e.message ?? e).slice(0, 200)}）`;
        throw err;
      }
      const env = out.body;
      if (out.status !== 200 || !env || env.type !== 'response') {
        const err = new Error('daemon_bad_response');
        err.detail = `/cmd/${cmd} 应答异常（HTTP ${out.status}）：${String(out.raw ?? '').slice(0, 160)}`;
        throw err;
      }
      if (env.ok === true) return env.result;
      // 人话进 message（宿主 catch 里 String(e) 直接可见），code/detail 留字段
      // 供程序化分拣——2026-09-27 实测「daemon error」裸奔把真实原因吞了。
      const reason = String(env.detail ?? env.error ?? '').trim();
      const err = new Error(reason ? `daemon error: ${reason}` : 'daemon error');
      err.detail = reason;
      err.code = env.error;
      throw err;
    };
    const run = async () => {
      const t0 = Date.now();
      for (let tries = 0; ; tries++) {
        try {
          if (!this._base) await this._ready;    // ensure 未落定：先等就绪
          return await attempt();
        } catch (e) {
          const connDead = e.message === 'daemon_unreachable';
          if (!connDead || tries >= 1 || Date.now() - t0 > timeoutMs) throw e;
          this.log(`send ${cmd} connection dead — rediscover & retry once`);
          await this._rediscover();
        }
      }
    };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`daemon command "${cmd}" timed out`)), timeoutMs);
      run().then(v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); });
    });
  }

  /** 调用方身份与清单随命令走（转发壳 dispatch 的直连版）。 */
  _bindCaller(cmd, args) {
    const a = { ...(args && typeof args === 'object' ? args : {}), _caller_host: this.host };
    if ((cmd === 'job_start' || cmd === 'job_resume')
      && this.hostManifestPath && existsSync(this.hostManifestPath)) {
      a._host_manifest = this.hostManifestPath;
    }
    return a;
  }

  /** 启动（异步 ensure 在后台跑；send 会排队等就绪——ensureBridgeReady 的
   *  ping 重试语义不变）。 */
  start() {
    if (this._stopped) return;
    if (!this._ready) this._ready = this._ensure().catch(e => { this._ready = null; throw e; });
  }

  /** 只断自己：关 SSE/门铃、弃 pending——**不发 shutdown**，常驻引擎继续站岗
   *  （金标准①）。宿主要按宿主停戏请显式 send('shutdown')。 */
  async stop() {
    this._stopped = true;
    this._ready = null;
    if (this._sseAbort) this._sseAbort.stop = true;
    if (this._doorbellAbort) this._doorbellAbort.stop = true;
  }
}

export default DaemonClient;

/** 宿主执行体最终失败信号（B5）：执行者死亡/超时/API 预算耗尽——显式上报，
 *  引擎按「沉默收场」裁决，宿主不伪装空台词。形状与旧 bridge-client 的同名
 *  函数一致。【补漏 2026-09-26】zcode bridge-manager 换芯时从本件解构此名，
 *  但本件当时并未导出——拿到 undefined，演员失败上报路径静默失效（冒烟无
 *  失败路径故未炸）。 */
export async function sendActorFailure(bridge, jobId, waitKey, kind, detail) {
  await bridge.send('actor_failed', {
    job_id: jobId,
    wait_key: waitKey,
    kind,
    detail: String(detail).slice(0, 500),
  }, 10_000);
}

/** 客户端就绪等待（原 bridge-launch.mjs 的 ensureBridgeReady，2026-09-26 随
 *  生桥机器退役迁入本件）：alive 检查 + start + ping 轮询（25×300ms，ping 2s）。
 *  对 DaemonClient 与旧 BridgeClient 形状的客户端同样适用（只摸 alive/start/
 *  send 三个面）。 */
export async function ensureBridgeReady(bridge, { attempts = 25, delayMs = 300, pingTimeoutMs = 2000 } = {}) {
  if (bridge.alive) return;
  bridge.start();
  for (let i = 0; i < attempts; i++) {
    try { await bridge.send('ping', {}, pingTimeoutMs); return; } catch { await sleep(delayMs); }
  }
  throw new Error('daemon client did not become ready');
}
