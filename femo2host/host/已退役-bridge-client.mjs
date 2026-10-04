/**
 * bridge-client.mjs — 引擎桥客户端「电话机」（host 无关公共层，femo2host）。
 *
 * 【已退役（2026-09-26，用户拍板「AutoClaw 当他不存在」）】主力三家（zcode/dsh/deepseekweb）已切
 * 常驻引擎直连（daemon-client.mjs，接口与本件对齐）。本件的在役消费方仅余：
 * autoclaw（其适配器尚未切直连，仍经本件与 femo_bridge.py 的 stdio 信封对话）
 * 与单测（zcode tests/bridge-client.test.mjs、developer/tests/bridge-client-torn
 * .test.mjs）。现执行「已退役-」改名静置；sendActorFailure 已先迁 daemon-client.mjs。
 * 新宿主一律走 daemon-client（接入教学见 docs/Specs/宿主接入清单.md §一）。
 *
 * 从 zcodeAdapter/mcp/bridge-manager.mjs 抽出的协议机（2026-09-15；dsh 的
 * host/bridge.ts 是它的 TS 孪生，等 DSH 解禁后接同一份）。只管与
 * femo_bridge.py 子进程之间的事：行缓冲、请求/应答配对、超时、优雅停机、
 * 事件上抛。**怎么把 python 拉起来**是宿主的事——经 spawnProc 适配器注入。
 *
 * spawnProc 适配器契约（宿主各写一个）：
 *   spawnProc({ argv, cwd, env })
 *     → 子进程外形：{ stdout:{on('data')}, stderr:{on('data')},
 *        stdin:{write(payload, cb)}, on('exit'|'error', cb), pid, kill() }
 *   dsh 的 SubprocessHandle 由 dsh 适配壳补齐 .on('exit') 后注入即可。
 *
 * 协议（femo_bridge.py 文件头同款）：
 *   host → bridge:  {"id":1,"cmd":"job_start","args":{...}}（一行一个 JSON）
 *   bridge → host:  {"type":"response","id":1,"ok":true,"result":...}
 *                   {"type":"response","id":1,"ok":false,"error":code,"detail":人话}
 *                   {"type":"event","event":类型,"data":{...}}
 *   非 '{' 开头的行是引擎自己的 print（traceback 等）——转发不吞。
 */

export class BridgeClient {
  /**
   * @param {object} opts
   * @param {(spec: {argv: string[], cwd: string, env: object}) => object} opts.spawnProc 宿主适配器
   * @param {string[]} opts.argv  桥启动命令行（python 可执行之后的部分；含 python 前缀与否由适配器约定——本层原样传给 spawnProc）
   * @param {string}  opts.cwd    桥工作目录（引擎根）
   * @param {object}  opts.env    子进程环境（宿主负责带全 process.env + UTF-8 两项）
   * @param {(eventType: string, data: unknown) => void} [opts.onEvent] 引擎事件上抛
 * @param {(line: string) => void} [opts.onEngineLine] 引擎 stdout 非协议行
 * @param {(line: string) => void} [opts.onEngineStderr] 引擎 stderr 行
 * @param {(line: string) => void} [opts.onParseFail] 协议行 JSON 解析失败（撕裂取证钩子）
 * @param {(msg: string) => void} [opts.log] 诊断日志
   */
  constructor(opts = {}) {
    this.spawnProc = opts.spawnProc;
    this.argv = opts.argv ?? [];
    this.cwd = opts.cwd;
    this.env = opts.env ?? {};
    this.onEvent = opts.onEvent;
    this.onEngineLine = opts.onEngineLine;
    this.onEngineStderr = opts.onEngineStderr;
    this.onParseFail = opts.onParseFail;
    this.log = opts.log ?? (() => {});
    this.handle = undefined;
    this.pending = new Map();
    this.nextId = 1;
    this.lineBuf = '';
  }

  /** 进程退出回调（总装层接线）：引擎半路死亡时清理孤儿运行态。 */
  onExited = undefined;

  get alive() {
    return this.handle !== undefined;
  }

  /** Spawn the bridge and wire stdout line parsing. 返回即已 spawn（异步等退出）。 */
  start() {
    if (this.handle !== undefined) return;
    const handle = this.spawnProc({ argv: this.argv, cwd: this.cwd, env: this.env });
    this.handle = handle;
    handle.stdout.on('data', chunk => this.onData(chunk));
    handle.stderr.on('data', chunk => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        if (line.trim().length === 0) continue;
        this.onEngineStderr?.(line);
      }
    });
    handle.on('exit', (code, signal) => {
      this.log(`bridge exited: code=${code} signal=${signal}`);
      for (const [, pending] of this.pending) {
        pending.reject(new Error(`bridge exited (code=${code})`));
      }
      this.pending.clear();
      this.handle = undefined;
      this.onExited?.({ code, signal });
    });
    handle.on('error', error => {
      this.log(`bridge spawn failed: ${String(error)}`);
      this.handle = undefined;
    });
    this.log(`bridge started (pid=${handle.pid})`);
  }

  /** Send one command; resolves with the bridge's response result。 */
  send(cmd, args = {}, timeoutMs = 15_000) {
    const handle = this.handle;
    if (handle === undefined) return Promise.reject(new Error('bridge not running'));
    const id = this.nextId++;
    const payload = `${JSON.stringify({ id, cmd, args })}\n`;
    // 【2026-09-23 观测】命令出站留痕。与桥的 rx/done 两行三方对表，即可分辨
    // 「命令没到桥」（只有本行）／「桥处理慢」（rx→done 间隔大）／
    // 「响应到了但被吞」（桥 tx 有、本机 rx 无）。
    this.log(`bridge-trace tx cmd=${cmd} id=${id} timeout=${timeoutMs}ms`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.log(`bridge-trace TIMEOUT cmd=${cmd} id=${id} after ${timeoutMs}ms（始终没等到回执）`);
        reject(new Error(`bridge command "${cmd}" timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      handle.stdin.write(payload, error => {
        if (error) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  }

  /** Terminate the bridge process tree (graceful shutdown command first)。 */
  async stop() {
    const handle = this.handle;
    if (handle === undefined) return;
    try {
      await this.send('shutdown', {}, 2000);
    } catch {
      // fall through to kill
    }
    handle.kill();
    await new Promise(resolve => {
      if (handle.exitCode !== null || this.handle === undefined) return resolve();
      handle.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
    this.handle = undefined;
  }

  onData(chunk) {
    this.lineBuf += chunk.toString('utf8');
    let idx;
    while ((idx = this.lineBuf.indexOf('\n')) !== -1) {
      const line = this.lineBuf.slice(0, idx).trim();
      this.lineBuf = this.lineBuf.slice(idx + 1);
      if (line.length === 0) continue;
      // 引擎自己的 print 与协议行共享 stdout：非 JSON 行是"引擎的话"，转发不吞。
      if (!line.startsWith('{')) {
        // 【2026-09-24 撕裂抢救（j2477/j2478 断戏根因）】引擎 print 与桥的
        // response 粘成一行=TORN_LINE 时，协议帧往往仍是完整的——先试着把
        // 它从行里抠出来认领，抠得动就当协议帧用（j2478 的 job_start 回执
        // 就是这么被吞的：30s 超时 → job 不入册 → 首料包 unknown job 拒收 →
        // 全场卡死）。抠不动才是引擎的话，照旧转发；若残渣里看得出协议
        // 回执，大声留痕供对表。
        const salvaged = this.salvageFrame(line);
        if (salvaged !== undefined) {
          this.log(`bridge-trace TORN_FRAME_SALVAGED type=${salvaged.type} `
            + `id=${salvaged.id ?? '-'} event=${salvaged.event ?? '-'} `
            + `len=${line.length}: ${line.slice(0, 240)}`);
          this.handleFrame(salvaged);
          continue;
        }
        if (line.includes('"type":"response"') || line.includes('"type": "response"')) {
          const m = line.match(/"id"\s*:\s*(\d+)/);
          this.log(`bridge-trace TORN_RESPONSE_SWALLOWED id=${m ? m[1] : '?'} `
            + `len=${line.length}: ${line.slice(0, 240)}`);
        }
        this.onEngineLine?.(line);
        continue;
      }
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        // 头部完整、尾部粘了引擎文本的形态：截到最后一个 } 再抢救一次。
        msg = this.salvageFrame(line);
        if (msg === undefined) {
          this.onParseFail?.(line);
          this.log(`JSON_PARSE_FAIL: ${line.slice(0, 300)}`); // 撕裂行无痕丢弃=丢事件
          continue;
        }
        this.log(`bridge-trace TORN_FRAME_SALVAGED(tail) type=${msg.type} `
          + `id=${msg.id ?? '-'} len=${line.length}`);
      }
      this.handleFrame(msg);
    }
  }

  /** 撕裂行抢救：从一行里抠出完整的协议帧（type=response/event 的 JSON）。
   * 先试「首个 { 到行尾」，再试「首个 { 到末个 }」（引擎文本粘尾的形态）；
   * 都抠不动返回 undefined，调用方按引擎话/解析失败处理。 */
  salvageFrame(line) {
    const start = line.indexOf('{');
    if (start < 0) return undefined;
    const candidates = [line.slice(start)];
    const end = line.lastIndexOf('}');
    if (end > start) candidates.unshift(line.slice(start, end + 1));
    for (const cand of candidates) {
      try {
        const msg = JSON.parse(cand);
        if (msg && (msg.type === 'response' || msg.type === 'event')) return msg;
      } catch { /* 换下一形态再试 */ }
    }
    return undefined;
  }

  /** 协议帧分派（response 认领 pending / event 上抛）——正常行与撕裂抢救共路。 */
  handleFrame(msg) {
    if (msg.type === 'response') {
      const pending = this.pending.get(msg.id);
      if (pending === undefined || msg.id === undefined) {
        // 【观测】迟到/重复/无人认领的响应——单通道下这种多半意味着
        // 该命令早已超时被判死（宿主已 reject），或配对号被上游搞混。
        this.log(`bridge-trace rx response id=${msg.id} ok=${msg.ok}（无等待者：迟到或重复）`);
        return;
      }
      this.pending.delete(msg.id);
      this.log(`bridge-trace rx response id=${msg.id} ok=${msg.ok}`);
      if (msg.ok === true) pending.resolve(msg.result);
      // 错误形态（Job 模型 §7.2）：{ok:false, error:<code>, detail:<人话>}——detail 优先。
      else pending.reject(new Error(String(msg.detail ?? msg.error ?? 'bridge error')));
    } else if (msg.type === 'event') {
      this.onEvent?.(String(msg.event), msg.data);
    }
  }
}

/** 宿主执行体最终失败信号（B5）：执行者死亡/超时/API 预算耗尽——显式上报，
 *  引擎按「沉默收场」裁决。宿主不伪装空台词（output:'' 会让错误体系失明）。 */
export async function sendActorFailure(bridge, jobId, waitKey, kind, detail) {
  await bridge.send('actor_failed', {
    job_id: jobId,
    wait_key: waitKey,
    kind,
    detail: String(detail).slice(0, 500),
  }, 10_000);
}
