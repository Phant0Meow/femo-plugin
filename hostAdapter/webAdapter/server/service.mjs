/**
 * service.mjs — 网页版宿主的本地服务（总装入口，node server/service.mjs）。
 *
 * 物理形态（hostAdapter/AGENTS.md 定案）：Chrome 扩展 + 本地服务。本文件是
 * 「本地服务」那一半：
 *
 *   Chrome 扩展（每个网页会话标签页一把角色椅）                  本地服务（本文件）
 *   ┌──────────────────────────────┐         ┌───────────────────────────────────┐
 *   │ background（service worker）  │◄─HTTP──►│ 下行长轮询 /extension/poll（下行帧）│
 *   │  上行 POST /extension/report │         │ 上行 /extension/register·report    │
 *   │ content script（每页代理）    │         │ 驿站收件口 /femo-plugin/mailbox-push│
 *   └──────────────────────────────┘         │ 主Agent工具 /tools/<name>（操作台用）  │
 *                                            │ 桥 = femo_bridge.py（惰性拉起）     │
 *                                            └───────────────────────────────────┘
 *
 * 下行为什么用长轮询而不是 SSE/WS：MV3 的 service worker 里没有 EventSource，
 * WebSocket 又要多一把协议锁——fetch 长轮询在 SW 里最皮实（响应到达即重连，
 * 服务端握着请求等新帧）。上行一律 POST，一次一路。
 *
 * 数据根（2026-09-25 用户拍板）：缺省不设 FEMO_DATA_DIR——桥与 python 走缺省
 * 分支 <femoRoot>/user_data（与 dsh 生产同口径，全宿主共用一个 world）；
 * WEB_SANDBOX=1 或显式 FEMO_DATA_DIR 时才隔离（<DIR>/femo/ 子树口径）。
 * FEMO_ROOT env 可把引擎根重定向到别的 femo 检出（默认仓库根）。
 */

import { createServer, request as httpRequest } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FemoBridge, REPO_ROOT, ADAPTER_ROOT, HOST_NAME, PUSH_PATH } from './bridge.mjs';
import { readBody } from './http-io.mjs';
import { createFemoRuntime } from './runtime.mjs';
import { createWakeGate } from './keeper.mjs';
import { createCanvasSupport } from './canvas.mjs';
import { parseSessionRef, siteById } from '../sites.mjs';
import { jobIdFromRunResult } from '../shared/run-core.mjs';
import { registerNativeHost, extensionIdFromKey } from '../native/register-core.mjs';
import { ensureBridgeReady, requestDaemonShutdown, fetchDaemonSettings, setDaemonSetting, probeDaemon } from '../../../femo2host/host/daemon-client.mjs';
import { readHubInfo } from '../../../femo2host/host/hub-client.mjs';
import { pickFemoFileViaDialog } from '../../../femo2host/femoGenConnector/file-dialogs.mjs';
import { buildToolSpecs, createBridgeToolImpls, createMountState, scriptActorSouls } from '../../../femo2host/host/tools-core.mjs';
import { preferenceSet, preferencesView, readJobCast } from '../../../femo2host/host/cast-core.mjs';

const TAG = '[web]';
const PORT = Number(process.env.FEMO_WEB_PORT || 8796);
const POLL_MAX_MS = 25_000;
const FRAME_CAP_PER_CONN = 64; // 失联连接的下行帧积压上限（旧帧丢弃并留痕，别无声膨胀）

// ── 数据根（2026-09-25 用户拍板：全宿主公用一个 world）────────────────
// 缺省**不设** FEMO_DATA_DIR——桥与 python 侧走缺省分支 <femoRoot>/user_data
// （无 femo/ 段，与 dsh 生产同口径；hub.json 同在 user_data/projection/）。
// 注意双分支口径（hub-client.mjs 同款）：一旦设 FEMO_DATA_DIR，全部路径切到
// <DIR>/femo/ 子树——那是另一种租户，与生产 world 互不相通（踩过：设成
// user_data 反而住进 user_data/femo/ 平行小世界，hub 自己 8792）。
// 隔离测试：WEB_SANDBOX=1（回落 <adapter>/.femo-data）或显式 FEMO_DATA_DIR。
const SANDBOX = process.env.WEB_SANDBOX === '1';
if (SANDBOX && !process.env.FEMO_DATA_DIR) process.env.FEMO_DATA_DIR = join(ADAPTER_ROOT, '.femo-data');
if (SANDBOX && !existsSync(process.env.FEMO_DATA_DIR)) {
  const { mkdirSync } = await import('node:fs');
  mkdirSync(process.env.FEMO_DATA_DIR, { recursive: true });
}
const DATA_ROOT = process.env.FEMO_DATA_DIR || join(REPO_ROOT, 'user_data'); // 仅本进程用（日志落点等）；不回写 env
process.env.FEMO_PUSH_PORT = String(PORT); // 驿站收件口 = 本服务（先于桥 spawn 定型）
// 文件日志：排障不必盯控制台——服务端全部行（含扩展上行的日志）落这里，
// 出问题直接读文件即可还原现场。
const LOG_FILE = join(DATA_ROOT, 'service.log');
const LOG_TAIL_CAP = 300;      // 侧栏「服务日志」卡的内存环容量（与文件日志同源，只留尾）
const logTail = [];            // {string} 原始行（含 ISO 时间戳前缀）
const log = (...a) => {
  console.log(TAG, ...a);
  const line = `${new Date().toISOString()} ${a.join(' ')}`;
  logTail.push(line);
  if (logTail.length > LOG_TAIL_CAP) logTail.shift();
  try { appendFileSync(LOG_FILE, line + '\n'); } catch { /* 日志写失败不挡服务 */ }
};
log(`host=${HOST_NAME} port=${PORT} dataRoot=${DATA_ROOT} femoRoot=${REPO_ROOT}`);
log(`file log => ${LOG_FILE}`);

// ── 原生宿主自动登记（2026-09-29 一键连接改版）────────────────────────
// 扩展 ID 已被 manifest.json 的 key 钉死（任何机器/Chrome·Edge 同值），登记
// 内容里机器相关的只剩 exe/node 路径——本进程全知道。所以服务每次启动顺手
// 登记一遍（幂等）：新装机的朋友双击一次 start-service.cmd，登记+启动一步到
// 位，侧栏「一键启动」此后永远可用。沙盒（FEMO_DATA_DIR 已设，含
// WEB_SANDBOX）跳过——测试不写真注册表。登记失败不挡服务起（服务本身还能
// 用，一键启动会响亮报错），但必须大声留痕，不许静默。
if (process.env.FEMO_DATA_DIR) {
  log('sandbox mode（FEMO_DATA_DIR 已设）：跳过原生宿主自动登记');
} else {
  try {
    const sum = registerNativeHost();
    log(`原生宿主已登记（自动，幂等）：extId=${sum.extId}${sum.compiled ? '（web-launcher.exe 已重编）' : ''} manifest=${sum.hostManifestPath}`);
  } catch (e) {
    log(`原生宿主自动登记失败（侧栏一键启动将不可用）：${String(e?.message ?? e).slice(0, 300)}`);
  }
}

// ── 扩展下行连接账（长轮询）────────────────────────────────────────────
/** connId → { frames: object[], waiter?: {resolve, timer} } */
const conns = new Map();

/** 最近上下行事件环（/state 的 debug 段带出去）：排障时一条命令看完发生了什么。 */
const recent = [];
function noteRecent(kind, detail) {
  recent.push({ t: Date.now(), kind, detail: String(detail).slice(0, 300) });
  if (recent.length > 120) recent.shift();
}

/** 最近收话环（/state 带出去，侧栏「最近收到」展示用）：人工信与引擎回合都记，
 *  引擎回合 runtime 照常交回，这里只是展示镜像。thinking=思考（CoT）单收。 */
const replies = [];
function noteReply(sessionId, deliveryId, text, thinking) {
  replies.push({ t: Date.now(), sessionId, deliveryId, text: String(text).slice(0, 4000), thinking: String(thinking ?? '').slice(0, 6000) });
  if (replies.length > 30) replies.shift();
  drafts.delete(String(sessionId ?? '')); // 定稿到手，草稿镜使命完成（流式在面板以定稿收尾）
}

/** 逐字流草稿镜（/state.drafts 带出去，侧栏「正在写…」流式展示）：每会话一格
 *  最新快照，delta 上行照单更新（手工聊天没有 deliveryId 也照记——无引擎即可
 *  验证 delta 链路：面板在长字=闸→content→background→服务全通，hub 喂送是
 *  服务端拿同一份数据做的另一跳）。13 分钟无续写过期（> 整轮保险丝 12 分，
 *  页关了/流断了不挂僵尸格）；同会话 reply 到达即清（见 noteReply）。 */
const drafts = new Map();
const DRAFT_TTL_MS = 13 * 60_000;
function noteDelta(sessionId, deliveryId, thinking, text) {
  const sid = String(sessionId ?? '');
  if (!sid) return;
  const t = Date.now();
  drafts.set(sid, { t, deliveryId: String(deliveryId ?? ''), thinking: String(thinking ?? '').slice(0, 6000), text: String(text ?? '').slice(0, 4000) });
  for (const [k, d] of drafts) if (t - d.t > DRAFT_TTL_MS) drafts.delete(k);
}

const CONN_DEAD_MS = 90_000; // 长轮询周期 25s+register 10s——90s 无任何到达=扩展半死（SW 被浏览器挂起且 alarms 没敲醒），往死连接投帧=无声蒸发

function connOf(connId) {
  let c = conns.get(connId);
  if (!c) { c = { frames: [], waiter: undefined, lastPollAt: Date.now() }; conns.set(connId, c); }
  return c;
}

/** 扩展连接生命线：poll/register 到达即续命；投帧前判死——死连接剔除并大声
 *  留痕（此前死连接永不出账，提醒/横条/reload 帧投进去无声蒸发，2026-10-02
 *  DeepSeek 实案：SW 半死，服务端提醒「弹了」用户却什么都没看见，两头都
 *  不知道断在哪）。 */
function connAlive(connId) {
  const conn = conns.get(String(connId));
  if (!conn) return false;
  if (Date.now() - conn.lastPollAt > CONN_DEAD_MS) {
    conns.delete(String(connId));
    log(`conn ${String(connId).slice(0, 8)}… 超过 ${Math.round(CONN_DEAD_MS / 1000)}s 无任何长轮询/注册——判死出账（扩展 SW 失联；页面解冻或扩展重载后会重新登记）`);
    return false;
  }
  return true;
}

/** runtime 下发帧的下行出口。连接不在 = false（runtime 把帧退回席位 pending）。
 *  帧的 type 标签在此统一贴（background 按 type 路由）；自带 type 的帧（如
 *  runtime 的 remind 提醒）靠 spread 顺序原样压过缺省标签——语义在此写明。 */
function deliverFrame(connId, frame) {
  if (!connAlive(connId)) return false;
  const conn = conns.get(String(connId));
  const tagged = { type: 'deliver', ...frame };
  noteRecent('frame-down', `conn=${String(connId).slice(0, 12)} delivery=${frame.deliveryId} seat=${frame.sessionId?.slice(0, 8)} ${conn.waiter ? '(waiter 拿走)' : `(排队 depth=${conn.frames.length + 1})`}`);
  if (conn.waiter) {
    clearTimeout(conn.waiter.timer);
    conn.waiter.resolve([tagged]);
    conn.waiter = undefined;
    return true;
  }
  conn.frames.push(tagged);
  if (conn.frames.length > FRAME_CAP_PER_CONN) {
    const dropped = conn.frames.splice(0, conn.frames.length - FRAME_CAP_PER_CONN);
    log(`conn ${String(connId).slice(0, 8)}… backlog overflow — dropped ${dropped.length} stale frame(s)`);
  }
  return true;
}

// ── 桥与运行时 ────────────────────────────────────────────────────────
// 镜窗可见性归引擎设置中心（setting.json 愿望∩在线，缺省隐藏）——web 不再
// 注入任何开关（2026-09-29 的 hideConsole 注入实际也断线：FemoBridge 从未
// 转发给客户端，桌面长窗与否从来是引擎自己的事）。
const bridge = new FemoBridge({
  onEngineLine: line => { if (line.trim()) log('[engine]', line.slice(0, 200)); },
  onEngineStderr: line => { if (line.trim()) log('[engine:err]', line.slice(0, 240)); },
  log,
});
bridge.onExited = ({ code }) => {
  log(`bridge exited (code=${code}) — 在飞回合已放弃；下次工具调用自动重拉`);
  rt?.abortAll('bridge exited');
};
const ensureBridge = () => ensureBridgeReady(bridge);

/** 操作台状态面（轮询读，不推）。 */
const consoleState = {
  lastStop: undefined,   // {jobId, outcome, notice, at}
  playStart: undefined,  // {jobId, text, at}
  mainRetry: undefined,  // {waitKey, feedback, attempt, at}
  startedAt: Date.now(),
};

/** 广播兜底：一帧发给所有在册扩展连接（正长轮询的 waiter 优先——立刻拿走）。
 *  定向投递的 connId 陈旧（浏览器整重启后扩展换新连接）时由 runtime/闸回落到
 *  这里——提醒/请台帧一个都不能卡在死连接上（「30s reload 没起来」死角）。
 *  返回是否至少送出一个连接。 */
function broadcastFrame(frame) {
  const connIds = [...conns.keys()].filter(connAlive); // 死连接先剔除（顺带大声留痕）
  if (!connIds.length) { log(`broadcast ${frame.type ?? ''} 发不出：扩展长轮询全断（SW 失联）——提醒类帧请看系统通知是否回落，重载扩展可自愈`); return false; }
  const waiterIds = connIds.filter(id => conns.get(id)?.waiter);
  for (const id of (waiterIds.length ? waiterIds : connIds)) deliverFrame(id, frame);
  return true;
}

// ── 唤醒闸（顺次模型的「叫醒」半边，2026-10-02）───────────────────────────
// 并发 reload 预算 2（6 连 reload 浏览器撑不住的根治）、排队 FIFO、上线或超时
// 放行。顺次定案后唯一叫醒路=派工侧 resolveSeat（轮到谁才唤醒谁，闸在顺次闸
// 内）；点名请台（只开没开的页）同走这个闸。open-tab 帧的站点解析住在闸里
// （席位物理账有 site 用 site，没有按会话引用拆）。seats 取 rt 用闭包：闸先建、
// 取值在 rt 初始化之后才发生（TDZ 安全，与 resolveSeat 同款姿势）。
const gate = createWakeGate({
  sendToAll: broadcastFrame,
  seats: () => rt.seats,
  log,
});

/** 座位解析（hub cast 账唯一正身，dsh 收件口同款姿势）：Job 选角账优先
 *  （开演定格的冻结账），缺页回落偏好账（覆盖手动补绑的场外情况）。
 *  返回 seat（保证在线）；解析不了就抛错（调用方大声 actor_failed）。
 *  「轮到谁唤醒谁」（2026-10-01）+ 进闸限流（2026-10-02）：席位查无=标签页没开
 *  （请台开新页）；在册但离线=多半被浏览器冻结了（请台 reload 叫醒）——两态都
 *  进唤醒闸排队、等上线再发话，等不到才大声报错（引擎挂起可续：唤醒网页后
 *  「继续」即可重演该节点）。 */
async function resolveSeat(jobId, soul) {
  let entry;
  if (Number(jobId) > 0) {
    const jobCast = await readJobCast(REPO_ROOT, Number(jobId));
    entry = jobCast?.[String(soul)];
  }
  if (!entry) {
    const view = await preferencesView(REPO_ROOT);
    entry = view.bindings?.[String(soul)];
  }
  if (!entry || !entry.sid) throw new Error(`选角账查无 "${soul}" 的座位（Job ${jobId}）——在侧栏/操作台绑定后再跑（绑定须在开演前）`);
  // hub 旧绑定存的裸 id（无来源前缀）——宽松找兼容读，对上号后一切按席位正字 id 走。
  const sid = String(entry.sid);
  // 绑定指向别的宿主：多宿主共演同一场时，这本选角账上本来就有别家的灵魂（本场
  // 由 web 开，事件流全量送到本宿主——但产信那一拍引擎已按选角账把信改寄对方格
  // **留柜等自取**，桥侧 foreign_pickup）。所以这封信压根不归本宿主办：**不是唤醒
  // 失败**，抛错只为喊停派工，标记 foreignHost 让调用方（runtime）静默跳过——不弹
  // 提醒横条、不立漂账（提醒横条只服务「web 自己的会话没响应」，与 dsh 侧
  // mailbox-push 的 foreign host 裁决同款）。
  // 旧版这行写在 const sid 之前，引用 sid 撞 TDZ——抛出去的是 ReferenceError
  // 「Cannot access 'sid' before initialization」，真正的「绑在别家」被吞掉，被当
  // 成唤醒失败 park 掉，横条上写的就是这句天书（2026-10-06 用户实报：zcode 的
  // ai7 让 web 弹了「绑定的网页没能自动唤醒」的假警报）。
  if (entry.host && entry.host !== HOST_NAME) {
    const err = new Error(`"${soul}" 绑定指向别的宿主（${entry.host}）——信留驿站等对方自取，本宿主不派工；ref=${sid}`);
    err.foreignHost = String(entry.host);
    throw err;
  }
  let seat = rt.seats.bySessionLoose(sid);
  if (seat?.online) return seat;
  const siteLabel = (seat && siteById(seat.site)?.SITE_LABEL) || parseSessionRef(sid)?.site?.SITE_LABEL || '对应网站';
  const waking = Boolean(seat); // 账上有椅子=唤醒（重载）；没有=开新页
  log(`"${soul}" 的会话（${sid.slice(0, 8)}…）${waking ? '在册休眠——进闸 reload 叫醒' : '没开——进闸自动开页'}，等待上线…`);
  const ok = await gate.wake(sid);
  // 错误尾缀 ref=<会话引用>：唤醒失败的 park 降级提醒靠它回填寻址，扩展的
  // 「切过去」按钮/系统通知才能按引用认页（2026-10-02 实案：帧上 tabId=0、
  // 无引用，按钮两处全死）。「选角账查无座位」的错误没有 sid 不加缀——那种
  // 提醒本就无处可切，扩展按 canSwitch 不画按钮。
  if (!ok) throw new Error(`"${soul}" 绑定指向的会话（${sid.slice(0, 8)}… @${siteLabel}）等待自动${waking ? '唤醒' : '开页'} 75s 后仍不在线——检查该标签页是否开着、加载是否完成（可能没登录或加载卡住）；ref=${sid}`);
  seat = rt.seats.bySessionLoose(sid);
  log(`seat ${sid.slice(0, 8)}… 上线（自动${waking ? '唤醒' : '开页'}成功），继续派工`);
  return seat;
}
const rt = createFemoRuntime({
  bridge,
  log,
  deliverFrame,
  broadcastFrame,                            // 定向 conn 陈旧时的提醒广播兜底
  resolveSeat,
  wakeSeat: sid => gate.wake(sid),           // 主Agent席走同一个闸
  surface: {
    onStopNotice: s => { consoleState.lastStop = { ...s, at: Date.now() }; log(`STOP job=${s.jobId} ${s.outcome}（详见操作台/投影中心）`); },
    onMainBrief: b => log(`主Agent回合落到操作台人工席（没设主Agent席）：job=${b.jobId} node=${b.node} wait_key=${b.waitKey} — 到操作台应答`),
    onHumanWait: h => log(`人类等待 job=${h.jobId} node=${h.node}（投影中心输入席或操作台应答）`),
    onPlayStart: p => { consoleState.playStart = { ...p, at: Date.now() }; },
    onMainRetry: r => { consoleState.mainRetry = { ...r, at: Date.now() }; log(`主Agent重试牌 wait_key=${r.waitKey} attempt=${r.attempt}——到操作台改后重交`); },
  },
});

// ── 主Agent工具（公共层全套直连桥；操作台是本宿主的「手」）──────────────────
const spawnPython = (cliArgs, timeoutMs) => new Promise((resolve, reject) => {
  import('node:child_process').then(({ spawn }) => {
    const p = spawn(process.env.FEMO_PYTHON ?? 'python', cliArgs, {
      cwd: REPO_ROOT,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => { try { p.kill(); } catch { /* 已退出 */ } reject(new Error(`python 子进程超时（${timeoutMs / 1000}s）：${cliArgs[0]}`)); }, timeoutMs);
    p.stdout.on('data', c => { out += c; });
    p.stderr.on('data', c => { out += c; });
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('exit', code => { clearTimeout(timer); resolve({ output: out, exitCode: code ?? -1 }); });
  });
});

const debugSpawnProc = async ({ argv, cwd, env, onStderrLine, onStdoutChunk }) => {
  const { spawn } = await import('node:child_process');
  const p = spawn(process.env.FEMO_PYTHON ?? 'python', argv, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', c => onStdoutChunk?.(c.toString('utf8')));
  p.stderr.on('data', c => {
    for (const line of c.toString('utf8').split(/\r?\n/)) {
      if (line.trim().length > 0) onStderrLine?.(line);
    }
  });
  return {
    done: new Promise(resolve => {
      p.on('error', () => resolve(undefined));
      p.on('exit', code => resolve({ exitCode: code ?? -1 }));
    }),
    terminate: () => { try { p.kill(); } catch { /* 已退出 */ } },
  };
};

const impls = createBridgeToolImpls({
  ensureBridge,
  send: (cmd, args, timeoutMs) => bridge.send(cmd, args, timeoutMs),
  femoRoot: REPO_ROOT,
  host: HOST_NAME, // host_refs 字典键（pause 归属裁决用，=桥 --host 标签）
  hostRef: 'web-femo',
  // 挂载共同账本（<数据根>/mounts.json，mount-registry 单点读写）：web 的挂载
  // 都来自侧栏/画布的用户动作，session 统一记 User、显示名同词（2026-10-04
  // 用户拍板）。服务重启时从账本恢复本家条目（细则见 tools-core 头注）。
  mounts: createMountState({ host: HOST_NAME, session: 'User', sessionName: 'User', femoRoot: REPO_ROOT }),
  spawnPython,
  debugSpawnProc,
  onProgress: m => log(`femo-debug: ${m}`),
  runNextHint: '启动运行后运行由本地服务推进：AI 角色由绑定的网页会话自动运行；轮到主Agent/人类时到操作台或投影中心应答。',
});
const restoredMount = impls.mounts.get();
if (restoredMount) log(`挂载恢复：${restoredMount.scriptPath}`);

// ── femoGen 画布（流程画布；细则见 server/canvas.mjs 文件头）─────────────────
const canvas = createCanvasSupport({
  femoRoot: REPO_ROOT,
  projectsDir: join(DATA_ROOT, 'projects'),
  spawnProc: debugSpawnProc,
  log,
});
// 引擎事件分流一跳给画布（SSE 通道 + run_state 合成 + 变量世界归一）：
// bridge.onEvent 已被 runtime 接管，这里包一层原样透传，谁也不挡谁。
const rtOnEvent = bridge.onEvent;
bridge.onEvent = (eventType, data) => {
  canvas.feed(eventType, data);
  rtOnEvent?.(eventType, data);
};

// ── 刀4（画布直连引擎，2026-10-05）：web 网关两件薄插座 ────────────────────
// ① GET /femo-plugin/engine-base —— 引擎地址发现：探活（只读不代拉，显示面
//    不指挥）+ 按请求 Host 头裁决可达性——回环打开的页面=本机浏览器，给直连
//    地址；非回环（tailscale 反代等）=浏览器够不着绑 127.0.0.1 的引擎，只给
//    转发路。规则简单确定可解释：页面从哪个地址打开，浏览器就在哪。
// ② /femo-plugin/engine-relay/* —— 透明转发后备：逐字节转引擎的 SSE 事件流
//    与画布会直发的命令，不解帧、不加闸、不盖章——画布讲的始终是引擎协议。
//    观察者身份/Last-Event-ID 等查询串原样透传（断点续传随字节流工作）。
//    转发只对画布消费的命令词表开门——网关不是任意代理（无鉴权服务，攻击面
//    不给大）。
const ENGINE_RELAY_ROOT = '/femo-plugin/engine-relay';
const RELAY_CMDS = ['list_jobs', 'get_job_state', 'job_pause', 'job_resume', 'human_input'];

function engineForward(res, base, pathWithQuery, method, body, clientReq) {
  const u = new URL(base + pathWithQuery);
  const up = httpRequest(
    {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json', 'Content-Length': body.length } : {},
    },
    (upRes) => {
      const headers = { ...upRes.headers };
      delete headers['transfer-encoding'];   // node 按自身输出重开 chunked，SSE 不受扰
      res.writeHead(upRes.statusCode ?? 502, headers);
      upRes.pipe(res);
    },
  );
  up.on('error', () => {
    if (!res.headersSent) json(res, 502, { ok: false, error: 'engine unreachable' });
    else res.end();
  });
  if (body !== undefined) up.write(body);
  up.end();   // 无体的 GET 也必须收尾——不 end 请求根本不发出去（夹具实测抓到的坑）
  clientReq?.on('close', () => { try { up.destroy(); } catch { /* 已结束 */ } });
}

async function engineBaseInfo(req) {
  const info = await probeDaemon(REPO_ROOT).catch(() => null);
  if (!info) return null;
  const host = String(req.headers.host || '');
  const loopback = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host);
  return { ok: true, base: loopback ? info.base : '', relay: ENGINE_RELAY_ROOT, host: HOST_NAME };
}

/** 席位展示账（/seats 与 /seats/attendance 共吃）：物理席位账 + hub 偏好账的
 *  soul 展示镜像拼合——供席位卡名牌显示。运行前点名的对账不在这算：attendance
 *  按挂载剧本要的灵魂 × 角色账逐魂另判（2026-09-30 三态对账，见其路由注释）。 */
async function seatsView() {
  const view = await preferencesView(REPO_ROOT).catch(() => ({ bindings: {} }));
  const soulBySession = {};
  for (const [soul, b] of Object.entries(view.bindings ?? {})) {
    if (b?.host === HOST_NAME && b?.sid) soulBySession[String(b.sid)] = String(soul);
  }
  return rt.seats.list(soulBySession);
}

/** 最近一次扩展注册（席位账刷新）的时刻：/seats/attendance 等它推进 =
 *  「点名已答，账是新的」。 */
let lastRegisterAt = 0;

/** 侧栏选路对话框的单飞旗（/api/pick-mount-path；模块层——请求作用域拦不住并发）。 */
let pickMountInFlight = false;

/** 门铃簿活心跳全表（GET /engine/doorbell 的 hosts 格，2026-09-30 点名对账用）：
 *  报到即算在线（含空门牌自取户，如 zcode），返回 Set。引擎不在就顺手代拉——
 *  反正点完名就要点运行。读不了（应答怪/连不上）返回 null：他宿主的在位判不了
 *  就**不拦**——缺席指控必须是可靠事实，通道故障不栽赃成「宿主没打开」
 *  （绑定信留柜自取的语义照旧兜着这场戏）。 */
async function doorbellHosts() {
  try {
    await ensureBridge();
    const r = await fetch(`${bridge.base}/engine/doorbell`);
    const out = await r.json();
    return Array.isArray(out?.hosts) ? new Set(out.hosts.map(String)) : null;
  } catch (e) {
    log(`attendance: 门铃簿读不了（${String(e).slice(0, 120)}）——他宿主在位无法判定`);
    return null;
  }
}

function readProjectionInfo() {
  const hub = readHubInfo(REPO_ROOT);
  if (!hub) return undefined;
  return { url: `http://127.0.0.1:${hub.port}/projection_center.html`, port: hub.port };
}

// ── HTTP 小件（请求体收集唯一活在 server/http-io.mjs，canvas 代理同吃）──
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) {
    const err = new Error(`bad json: ${String(e).slice(0, 80)}`);
    err.statusCode = 400;
    throw err;
  }
}

// ── 路由 ─────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  try {
    // 探活/状态
    // 服务日志尾读（侧栏「服务日志」卡）：after=已有行数，返回其后增量 + 当前行数。
    if (req.method === 'GET' && path === '/log') {
      const after = Math.max(0, Number(url.searchParams.get('after') || 0));
      return json(res, 200, { total: logTail.length, lines: logTail.slice(after) });
    }
    if (req.method === 'GET' && path === '/health') {
      return json(res, 200, {
        ok: true, host: HOST_NAME, bridgeAlive: bridge.alive,
        dataDir: DATA_ROOT, stats: rt.stats(),
      });
    }
    // 远程退场（侧栏「重启服务」的退场半步，拉起归原生宿主 web-launcher 幂等兜住）。
    // 只认带专用头的 POST：跨域网页造不出自定义头（preflight 就被挡），路过页面
    // 顺手杀服务的路被结构性堵死。
    // ?daemon=1（侧栏「关闭服务」）：退场前先请求引擎立即散场（daemon_shutdown）
    // ——引擎自己点名门铃簿，还有别家宿主在线就拒绝（别家不想被灭灯），只剩本家
    // 才真关；关失败（拒绝/引擎不通）服务照退，不挡。
    if (req.method === 'POST' && path === '/shutdown') {
      if (req.headers['x-femo-shutdown'] !== '1') return json(res, 403, { ok: false, error: '缺专用头，不让关' });
      const wantDaemon = url.searchParams.get('daemon') === '1';
      log(wantDaemon ? 'shutdown requested via HTTP（侧栏关闭服务，含引擎散场）'
                     : 'shutdown requested via HTTP（侧栏重启服务）');
      json(res, 200, { ok: true });
      setTimeout(() => shutdown('HTTP /shutdown', { daemon: wantDaemon }), 150).unref();
      return;
    }
    // 设置中心（2026-09-30 设置中心刀）：读数据根设置与镜窗现况、写本宿主
    // （web）一格愿望。引擎是唯一权威（setting.json 归它读），本服务只是
    // 代理。POST 认专用头（同 /shutdown：跨域网页造不出自定义头，路过页面
    // 改设置的路被结构性堵死）。
    if (req.method === 'GET' && path === '/setting') {
      const out = await fetchDaemonSettings(REPO_ROOT).catch(() => null);
      if (!out) return json(res, 503, { ok: false, error: '引擎不通（设置随引擎走）' });
      if (out.ok === false) return json(res, 502, { ok: false, error: out.error, detail: out.detail });
      return json(res, 200, { ok: true, ...out.result });
    }
    if (req.method === 'POST' && path === '/setting') {
      if (req.headers['x-femo-setting'] !== '1') return json(res, 403, { ok: false, error: '缺专用头，不让改' });
      const body = await readJson(req).catch(() => ({}));
      const value = body?.value;
      if (value !== 'show' && value !== 'hide') return json(res, 400, { ok: false, error: 'value 只能是 show/hide' });
      const out = await setDaemonSetting(REPO_ROOT, HOST_NAME, 'console_window', value).catch(() => null);
      if (!out) return json(res, 503, { ok: false, error: '引擎不通（设置随引擎走）' });
      if (out.ok === false) return json(res, 200, { ok: false, error: out.error, detail: out.detail });
      return json(res, 200, { ok: true, ...out.result });
    }
    if (req.method === 'GET' && path === '/state') {
      const head = rt.router.head();
      const s = rt.state();
      return json(res, 200, {
        host: HOST_NAME,
        bridgeAlive: bridge.alive,
        running: s.running, playName: s.playName,
        pendingMain: head?.kind === 'directive' ? { job_id: head.job_id, wait_key: head.wait_key, node: head.node, prompt: String(head.prompt ?? '').slice(0, 2000) } : undefined,
        waitingHuman: rt.humanWait,
        mainRetry: consoleState.mainRetry,
        lastStop: consoleState.lastStop,
        playStart: consoleState.playStart,
        projection: readProjectionInfo(),
        stats: rt.stats(),
        runlog: rt.runlog().slice(-30),
        replies: replies.slice(-10),
        drafts: [...drafts.entries()].map(([sessionId, d]) => ({ sessionId, ...d })),
        debug: {
          conns: [...conns.entries()].map(([id, c]) => ({ connId: id, queued: c.frames.length, waiting: Boolean(c.waiter) })),
          recent: recent.slice(-40),
        },
      });
    }

    // 操作台页
    if (req.method === 'GET' && (path === '/' || path === '/console')) {
      const html = await readFile(join(ADAPTER_ROOT, 'console', 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }

    // 操作台的共享判断层（shared/ 磁盘单份：扩展侧打进包 import，操作台侧本路由
    // 伺候同一批文件）。只放行 shared/ 下的 .mjs 文件名（无路径分隔符，防穿越）。
    if (req.method === 'GET' && path.startsWith('/console/shared/')) {
      const name = path.slice('/console/shared/'.length);
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.mjs$/.test(name)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('not found');
      }
      try {
        const js = await readFile(join(ADAPTER_ROOT, 'shared', name));
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(js);
      } catch {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('not found');
      }
    }

    // 席位面（操作台/侧栏共用）。soul 展示镜像=hub 偏好账视图实时算出，
    // 本地不自养灵魂账（2026-09-25 用户定案：全系统只记一笔账）。
    if (req.method === 'GET' && path === '/seats') {
      return json(res, 200, { seats: await seatsView() });
    }

    // ── femoGen 画布（流程画布；路由契约见 server/canvas.mjs 文件头）──────
    if (req.method === 'GET' && (path === '/canvas' || path === '/canvas/')) return canvas.serveIndex(res);
    // 【刀4】画布直连引擎的 web 网关（地址发现 + 透明转发；注释见上方定义处）
    if (req.method === 'GET' && path === '/femo-plugin/engine-base') {
      return json(res, 200, (await engineBaseInfo(req)) ?? { ok: false });
    }
    if (req.method === 'GET' && path === `${ENGINE_RELAY_ROOT}/events`) {
      const info = await probeDaemon(REPO_ROOT).catch(() => null);
      if (!info) return json(res, 200, { ok: false, error: 'engine offline' });
      const qi = (req.url ?? '').indexOf('?');
      return engineForward(res, info.base, `/engine/events${qi >= 0 ? (req.url ?? '').slice(qi) : ''}`, 'GET', undefined, req);
    }
    {
      const m = path.match(new RegExp(`^${ENGINE_RELAY_ROOT}/cmd/(${RELAY_CMDS.join('|')})$`));
      if (req.method === 'POST' && m) {
        const info = await probeDaemon(REPO_ROOT).catch(() => null);
        if (!info) return json(res, 200, { ok: false, error: 'engine offline' });
        const raw = await readBody(req);
        return engineForward(res, info.base, `/cmd/${m[1]}`, 'POST', Buffer.from(raw || '{}', 'utf8'), req);
      }
    }
    // 画布自动挂载面（2026-09-30）：?mount=1 开页的画布页播种脚本读这里——
    // 本服务挂载态（tools-core 的 mounts，侧栏挂载/画布开跑共写）里当前脚本的
    // 只读快照（femo_script 原样，不碰引擎）。没挂载=ok:false，播种脚本安静作罢。
    if (req.method === 'GET' && path === '/canvas/mounted') {
      const s = await impls.femo_script();
      if (s?.error) return json(res, 200, { ok: false, error: s.error });
      return json(res, 200, { ok: true, script: s.script, text: s.text });
    }
    // 画布成品里的引用是根级绝对路径（/assets/*、/favicon.ico），服务在根上伺候。
    if (req.method === 'GET' && path.startsWith('/assets/')) return canvas.serveAsset(res, path.slice(1));
    if (req.method === 'GET' && path === '/favicon.ico') return canvas.serveAsset(res, 'favicon.ico');
    // 画布独立模式后端面（/api/*；地址由画布页播种指向本服务）。运行起点=
    // 内容存盘→挂载→fresh_start，run_id=Job 号（后续 pause/resume/stream 全按它）。
    if (req.method === 'POST' && path === '/api/run') {
      const body = await readJson(req);
      const femo = String(body.femo ?? '');
      if (!femo.trim()) return json(res, 400, { error: 'FEMO脚本文本为空' });
      const scriptPath = await canvas.saveScript(femo);
      // 挂载失败不抛错、只回 {error}（编译器连灵魂存在都核）：接住回 400，
      // 别带着空挂载状态去 femo_run——那只会换来一句「尚未挂载」掩盖真因。
      const mounted = await impls.femo_mount({ script_path: scriptPath });
      if (mounted?.error) return json(res, 400, { error: `挂载失败：${mounted.error}` });
      const r = await impls.femo_run({ action: 'fresh_start' });
      const jobId = jobIdFromRunResult(r);
      if (!jobId) return json(res, 500, { error: `运行启动失败：${JSON.stringify(r ?? null).slice(0, 300)}` });
      log(`canvas: run started job=${jobId} script=${scriptPath}`);
      return json(res, 200, { run_id: jobId });
    }
    {
      const m = path.match(/^\/api\/run\/(\d+)\/(stream|pause|resume|human-input)$/);
      if (m) {
        const jobId = Number(m[1]);
        if (req.method === 'GET' && m[2] === 'stream') return canvas.connectStream(res);
        if (req.method === 'POST' && m[2] === 'pause') {
          const r = await impls.femo_run({ action: 'pause', job_id: jobId });
          return json(res, 200, r ?? { paused: false });
        }
        if (req.method === 'POST' && m[2] === 'resume') {
          const r = await impls.femo_run({ action: 'resume', job_id: jobId });
          return json(res, 200, { ok: true, result: r });
        }
        if (req.method === 'POST' && m[2] === 'human-input') {
          // 画布人类席：wait_key 对上引擎现等待态才收（对不上=已收卷/超时放行，
          // delivered:false 让画布把失败亮出来）。
          const body = await readJson(req);
          const hw = rt.humanWait;
          if (!hw || String(hw.waitKey) !== String(body.wait_key ?? '')) {
            return json(res, 409, { delivered: false, note: '引擎没有在等这个 wait_key（可能已收卷或超时放行）' });
          }
          const soul = String(hw.scope?.[0] || 'human');
          const r = await rt.submitHumanOutput(hw.jobId, hw.waitKey, String(body.chat_text ?? ''), soul, body.variables);
          if (r?.posted === true) rt.clearHumanWait();
          rt.startPump();
          return json(res, 200, { delivered: true, result: r });
        }
      }
    }
    if (req.method === 'POST' && path === '/api/souls/create') {
      // 画布独立模式直打的建灵魂旧路：改调同文件已装配的工具执行体
      // impls.femo_soul——校验（soul_id 不含空格逗号、soul_name 必填）与命令
      // 组装唯一活在公共层 tools-core，本路由只剩响应形状适配。此前手搓
      // bridge.send 绕过校验、还带着引擎本就缺省的 user_id:'u001'（漂移实案）。
      const body = await readJson(req);
      const out = await impls.femo_soul({
        action: 'create',
        soul_id: body.soul_id,
        soul_name: body.soul_name,
        description: body.description,
      });
      if (out?.error) return json(res, 400, { error: `创建失败：${String(out.error).slice(0, 200)}` });
      return json(res, 200, { ok: true, soul_id: String(body.soul_id ?? '').trim(), result: out?.result ?? out });
    }
    // 画布源码里无门控直打的两根 dsh 词汇旧路：models=web 无模型清单，如实报
    // （画布下拉显示错误文案）；debug-run=公共层监工流式代理。
    if (req.method === 'GET' && path === '/femo-plugin/models') {
      return json(res, 200, { ok: false, error: 'web 宿主没有模型清单：各官网会话用什么模型由网站自己定' });
    }
    if (req.method === 'POST' && path === '/femo-plugin/debug-run') return canvas.handleDebugRun(req, res);

    // ── femoGen 自有文件面（2026-09-30）：画布独立模式的导入/导出。能力与安全
    //    围栏都在 canvas.mjs 对应 handlers（账本/path 槽/系统对话框=公共层单源）；
    //    dsh 的同款词汇走 /femo-plugin/*，这里走画布自己的 /api/ 面。 ──
    if (req.method === 'POST' && path === '/api/femo-files') return json(res, 200, await canvas.listFemoFilesRt());
    if (req.method === 'POST' && path === '/api/femo-files/open') return json(res, 200, await canvas.openFemoFileRt(await readJson(req)));
    if (req.method === 'POST' && path === '/api/femo-files/forget') return json(res, 200, await canvas.forgetFemoFileRt(await readJson(req)));
    if (req.method === 'GET' && path === '/api/canvas/path') return json(res, 200, await canvas.getCanvasPathRt());
    if (req.method === 'POST' && path === '/api/save-script') return json(res, 200, await canvas.saveScriptRt(await readJson(req)));
    if (req.method === 'POST' && path === '/api/projects/browser') return json(res, 200, await canvas.browseProjectsRt(await readJson(req)));
    if (req.method === 'POST' && path === '/api/projects/mkdir') return json(res, 200, await canvas.mkdirProjectsRt(await readJson(req)));
    if (req.method === 'POST' && path === '/api/projects/open') return json(res, 200, await canvas.openProjectFileRt(await readJson(req)));
    if (req.method === 'POST' && path === '/api/pick-script') return json(res, 200, await canvas.pickScriptDialogRt());
    if (req.method === 'POST' && path === '/api/pick-save-path') return json(res, 200, await canvas.pickSavePathDialogRt(await readJson(req)));
    if (req.method === 'POST' && path === '/api/pick-mount-path') {
      // 侧栏「浏览」的选路对话框（2026-10-01）：浏览器文件选择器在扩展沙箱里
      // 拿不到本机绝对路径（旧法读内容走 femo_text，挂载行只能显示 unsaved），
      // 系统对话框拿得到。只选路、不读文、不碰画布簿记——挂载仍走
      // /tools/femo_mount 的 script_path，绝对路径回填给用户看。系统对话框
      // 引擎=公共层 file-dialogs（画布同吃一份引擎，单飞各自记账）；等人裁决
      // 可能很久，这条路由没有内部超时。pickMountInFlight 在模块层（单飞
      // 旗放请求作用域就成了摆设）。
      if (pickMountInFlight) return json(res, 409, { ok: false, error: '已有一个文件对话框在等裁决' });
      pickMountInFlight = true;
      try {
        const dir = join(DATA_ROOT, 'projects');
        await mkdir(dir, { recursive: true }).catch(() => {});   // 对话框起始目录
        const picked = await pickFemoFileViaDialog({ mode: 'open', title: '选择要挂载的 FEMO 脚本', initialDirectory: dir });
        return json(res, 200, { ok: true, path: picked });
      } finally {
        pickMountInFlight = false;
      }
    }

    if (req.method === 'POST' && path === '/seats/bind') {
      // 绑定（cast 挑角色）：唯一一笔账=hub cast 正身（cast-core 走
      // /sessions/cast-preference，提名制——多会话可同提一个 soul，无占用拒绝，
      // 最后指派算数、下一场定格生效——dsh 绑定按钮同一套契约）。
      // 本地不落任何绑定状态（唯一账定案）。
      const body = await readJson(req);
      const sessionId = String(body.sessionId ?? '');
      const soul = String(body.soul ?? '').trim();
      if (!rt.seats.bySession(sessionId)) return json(res, 404, { ok: false, error: `seat not found: ${sessionId}` });
      if (soul === 'human') return json(res, 400, { ok: false, error: 'human 角色不参与会话绑定' });
      if (soul) {
        // 角色库在册核查（拼错灵魂名当场拦下）。
        // 前提是桥活着才核查：桥死时不把「拉桥」这个重操作（冷启动可达十秒级）
        // 绑进绑定路径——2026-09-26 实测绑定慢的根因就是它。拼错名字的兑底仍在：
        // 派工时 resolveSeat 查无席位会大声报 actor_failed。
        if (bridge.alive) {
          try {
            const soulsOut = await bridge.send('list_souls', {}, 15000);
            if (soulsOut?.souls?.find(s => s.soul_id === soul) === undefined) {
              return json(res, 404, { ok: false, error: `角色 "${soul}" 不在角色库里` });
            }
          } catch (e) {
            return json(res, 502, { ok: false, error: `角色库核查失败（桥没应答）：${String(e).slice(0, 120)}` });
          }
        } else {
          log(`seats: bind 桥不在，跳过角色库核查（soul=${soul}，拼错由派工侧报错兑底）`);
        }
      }
      let out;
      try {
        out = await preferenceSet(REPO_ROOT, HOST_NAME, sessionId, soul || null);
      } catch (e) {
        return json(res, 502, { ok: false, error: `hub cast 账不可达：${String(e).slice(0, 120)}` });
      }
      if (out?.ok !== true) return json(res, 409, { ok: false, error: out?.error ?? '绑定被 hub 拒绝' });
      // 会话引用定形（2026-09-27）之前的绑定账是裸 id——hub 退票按 sid 精确删格，
      // 引用串删不到它，刚解绑的灵魂会经展示回落/开演选举复活（littlecat 实案）。
      // 同一会话只该有一格：解绑=连旧格一起清（解绑=清零），绑定=顺手清旧格
      // （新格已立，旧灵魂的票作废）。失败不拦主写，下次绑定/解绑重试。
      const bare = parseSessionRef(sessionId)?.sessionId;
      if (bare) {
        try {
          await preferenceSet(REPO_ROOT, HOST_NAME, bare, null);
        } catch (e) {
          log(`seats: bind 旧裸 id 格清理失败（下次绑定/解绑重试）：${String(e).slice(0, 120)}`);
        }
      }
      log(`seats: bind ${sessionId.slice(0, 8)}… soul=${soul || '(解绑)'}（hub 正身）`);
      return json(res, 200, { ok: true, hub: true });
    }
    if (req.method === 'POST' && path === '/seats/main') {
      const body = await readJson(req);
      const r = rt.seats.setMain(body.sessionId ?? null);
      return json(res, r.ok ? 200 : 404, r);
    }
    if (req.method === 'POST' && path === '/seats/attendance') {
      // 运行前点名：物理事实（标签页此刻应不应答）只有扩展探得到——服务端只
      // 发「立即应到」帧催扩展当场跑一轮 register（ping 全部标签页），等席位账
      // 刷新后把最新账交回去。等不到（扩展没在长轮询/SW 休眠中）就把现账交出，
      // 不硬等——点名结果再旧也旧不过按钮按下前侧栏轮询的那份。
      const atBody = await readJson(req).catch(() => ({}));
      const before = lastRegisterAt;
      // 服务刚重启的头几秒，扩展长轮询还没握上来（SW 断线 3s 退避重连 + 10s
      // 注册周期内必到）——先等一手再下「扩展没连上」的结论。实测：重启完
      // 立刻点运行必撞这个空窗，把好好连着的扩展诬成没连。
      if (!conns.size) {
        const connDeadline = Date.now() + 6_000;
        while (!conns.size && Date.now() < connDeadline) await new Promise(r => setTimeout(r, 200));
      }
      const connIds = [...conns.keys()];
      for (const id of connIds) deliverFrame(id, { type: 'attendance', deliveryId: `attendance/${Date.now()}` });
      if (!connIds.length) log('attendance: 无扩展连接——按现账点名');
      const deadline = Date.now() + 6_000; // ping 超时 3s（每页串行至多一轮）+ 余量
      while (lastRegisterAt <= before && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 150));
      }
      // 对账三态（2026-09-30 用户定案；2026-10-01 按需唤醒翻新判据）：
      // 挂载剧本要的灵魂逐个 × 角色账——
      //   账里从来没有 = 缺灵魂（点名拦下，提示绑定）；
      //   绑在别家宿主且那家没心跳 = 那边没打开（点名拦下，说明绑在谁家）；
      //   绑在本宿主（web）：**页开着（哪怕休眠）=到场，不拦不叫醒**——轮到它
      //     发言时派工侧会自动 reload 唤醒，现在叫醒了等开演的几分钟里又冻回去，
      //     白醒；标签页真没开的才请台开新页（派工侧另有「轮到谁唤醒谁」兜着）。
      // 绑定解析与派工 resolveSeat 同款优先级（Job 冻结账优先，偏好账兜底）——
      // 点名对的就是派工要用的那本账。续跑（带 job_id）按冻结账对，改名改绑
      // 都不追溯。needed 每项 {actor, soul, bound, host?, online?, present?,
      // ledgerEmpty?}，判据与文案唯一活在 shared/seats-core.offlineRollCall。
      // web 缺席项（页没开）再带：askedOpen=请台帧递出没有；siteKnown=这条绑定
      // 记没记「哪家网站」（席位没注册过还能按引用拆；裸 id 旧绑定两头都空，
      // 自动开页无从开起——askedOpen 只在 siteKnown 时才可能是真，扩展没连/
      // 开不了都如实是假，点名行分流教话）。
      const mounted = impls.mounts.get();
      const soulNeeds = mounted ? scriptActorSouls(mounted.femoText).filter(e => e.soul) : [];
      const jobCast = soulNeeds.length && Number(atBody.job_id) > 0
        ? await readJobCast(REPO_ROOT, Number(atBody.job_id)) : {};
      const prefs = await preferencesView(REPO_ROOT);
      const ledgerEmpty = Object.keys(prefs.bindings ?? {}).length === 0;
      const liveHosts = await doorbellHosts();
      const needed = [];
      const openTargets = [];   // {soul, sid}——请了台（开新页）的席，等「页出现」
      for (const { actor, soul } of soulNeeds) {
        const entry = jobCast[String(soul)] ?? prefs.bindings?.[String(soul)];
        const sid = entry?.sid ? String(entry.sid) : '';
        if (!sid) { needed.push({ actor, soul, bound: '', ...(ledgerEmpty ? { ledgerEmpty: true } : {}) }); continue; }
        const host = String(entry.host ?? '');
        if (host && host !== HOST_NAME) {
          needed.push({ actor, soul, bound: 'other', host, online: liveHosts ? liveHosts.has(host) : true });
          continue;
        }
        const seat = rt.seats.bySessionLoose(sid); // 本宿主（web）：账上那把椅子
        if (seat?.present) { needed.push({ actor, soul, bound: 'web', online: Boolean(seat.online), present: true }); continue; }
        const siteKnown = Boolean(seat?.site || parseSessionRef(sid)?.site?.SITE_ID);
        // 请台进唤醒闸（预算内两两放行，见 createWakeGate）：12s 等窗等不到就
        // 照实出缺席行「已排入唤醒队列」，派工侧的 75s 等待接手——点名不再
        // 一口气开 6 页。askedOpen=请求已受理（扩展连着才受理，点名行说真话）。
        const askedOpen = siteKnown && conns.size ? (void gate.wake(sid), true) : false;
        if (askedOpen) openTargets.push({ soul, sid });
        needed.push({ actor, soul, bound: 'web', online: false, present: false, askedOpen, siteKnown });
      }
      // 请台后等一会儿：新开的页要加载+注册才进账（扩展 onUpdated 即触发
      // register）。等的是「页出现」（present）不是探活应答——新页加载完天然
      // 在线，没加载完也算在场，开演后轮到它再等上线（按需唤醒）。等到了当场
      // 就能开演（用户不必点两次运行）；等不到的照实出缺席行（页面可能没登录/
      // 加载卡住）。
      if (openTargets.length) {
        const openDeadline = Date.now() + 12_000;
        while (Date.now() < openDeadline) {
          await new Promise(r => setTimeout(r, 800));
          if (openTargets.every(w => rt.seats.bySessionLoose(w.sid)?.present)) break;
        }
        for (const w of openTargets) {
          const back = rt.seats.bySessionLoose(w.sid);
          for (const n of needed) {
            if (n.bound === 'web' && n.soul === w.soul) {
              n.present = Boolean(back?.present);
              n.online = Boolean(back?.online);
            }
          }
        }
      }
      return json(res, 200, { ok: true, refreshed: lastRegisterAt > before, seats: await seatsView(), needed });
    }
    if (req.method === 'POST' && path === '/seats/deliver') {
      // 手工发消息（侧栏「手动发消息」/操作台测试）：走与引擎下发同一条下行帧通道，
      // 但不建在飞回合——回执只进 runlog，交不了卷。
      const body = await readJson(req);
      const seat = rt.seats.bySession(String(body.sessionId ?? ''));
      if (!seat) return json(res, 404, { ok: false, error: 'seat not found' });
      if (!seat.online) return json(res, 409, { ok: false, error: 'seat offline' });
      const ok = deliverFrame(seat.connId, {
        deliveryId: `manual/${Date.now()}`,
        connId: seat.connId, tabId: seat.tabId, sessionId: seat.sessionId,
        text: String(body.text ?? ''), meta: { manual: true, actorName: 'operator' },
      });
      return json(res, ok ? 200 : 409, { ok });
    }

    // 扩展协议
    // 扩展 ID 出借口（操作台「让扩展连到这里」按钮用）：ID 被 manifest.json
    // 的 key 钉死，现算即可——不依赖登记文件，服务没登记过（还没启动过生产
    // 模式）也答得上来。只回 ID 不带别的。
    if (req.method === 'GET' && path === '/extension/extid') {
      try {
        const m = JSON.parse(await readFile(join(ADAPTER_ROOT, 'manifest.json'), 'utf8'));
        if (!m.key) throw new Error('key 字段缺失');
        return json(res, 200, { ids: [extensionIdFromKey(m.key)] });
      } catch (e) {
        return json(res, 200, { ids: [], error: `扩展 ID 取不出（manifest.json 缺 key 或文件读不到）：${String(e).slice(0, 100)}` });
      }
    }
    if (req.method === 'POST' && path === '/extension/register') {
      const body = await readJson(req);
      const connId = String(body.connId ?? '');
      if (!connId) return json(res, 400, { ok: false, error: 'connId required' });
      connOf(connId).lastPollAt = Date.now();
      const tabs = Array.isArray(body.tabs) ? body.tabs : [];
      noteRecent('register', `conn=${connId.slice(0, 12)} seats=[${tabs.map(t => String(t.sessionId ?? '').slice(0, 8)).join(',')}]`);
      lastRegisterAt = Date.now();
      rt.seats.upsertTabs(connId, tabs);
      for (const t of tabs) {
        if (t.sessionId) rt.pokeSeat(String(t.sessionId)); // 重新上线补发暂停帧
      }
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && path === '/extension/poll') {
      const connId = url.searchParams.get('conn') ?? '';
      const timeoutMs = Math.min(Math.max(Number(url.searchParams.get('timeout') || POLL_MAX_MS), 1000), POLL_MAX_MS);
      if (!connId) return json(res, 400, { frames: [], error: 'conn required' });
      const conn = connOf(connId);
      conn.lastPollAt = Date.now();
      if (conn.frames.length > 0) return json(res, 200, { frames: conn.frames.splice(0) });
      const frames = await new Promise(resolve => {
        const timer = setTimeout(() => { conn.waiter = undefined; resolve([]); }, timeoutMs);
        conn.waiter = { resolve: f => resolve(f), timer };
      });
      return json(res, 200, { frames });
    }
    if (req.method === 'POST' && path === '/extension/report') {
      const body = await readJson(req);
      rt.seats.markAlive(body.sessionId); // 座席上行=活气，翻在线（GLM 实案：reload 后页几秒又冻，探活永假致唤醒闸白等 75s）
      // 扩展端的日志行（content/background 都走这条汇入服务日志）。
      if (body.type === 'log') {
        noteRecent('ext-log', `[${body.tag}] ${body.line}`);
        log(`[ext:${body.tag ?? '?'}] ${String(body.line ?? '').slice(0, 400)}`);
        return json(res, 200, { handled: true });
      }
      // delta 400ms 一拍会把排障环灌爆——草稿镜（noteDelta）即它的记录，不入 recent。
      if (body.type !== 'delta') noteRecent('report', JSON.stringify(body).slice(0, 200));
      if (body.type === 'register-ack') return json(res, 200, { ok: true });
      // 页面上线哨（登记半区已覆盖）：安静认领，不进 unhandled 噪音。
      if (body.type === 'url') return json(res, 200, { handled: true });
      // 回答展示镜像（引擎回合 runtime 照常交回，这里只管给面板看）。
      if (body.type === 'reply') noteReply(String(body.sessionId ?? ''), String(body.deliveryId ?? ''), String(body.text ?? ''), String(body.thinking ?? ''));
      // 逐字流草稿镜（面板「正在写」流式；runtime 另按 deliveryId 查在飞表喂 hub）。
      if (body.type === 'delta') noteDelta(String(body.sessionId ?? ''), String(body.deliveryId ?? ''), String(body.thinking ?? ''), String(body.content ?? ''));
      const r = await rt.onSeatReport(body);
      // 大声留痕：没人认领的上行（手工帧的回执/已失效席位的报错）不静默吞。
      if (!r?.handled) log(`report unhandled: ${JSON.stringify(body).slice(0, 200)} — ${r?.reason ?? '?'}`);
      return json(res, 200, r);
    }

    // 主Agent工具（操作台是本宿主唯一有「手」的地方）
    if (req.method === 'GET' && path === '/tools') {
      return json(res, 200, { tools: buildToolSpecs({ host: HOST_NAME }).map(s => ({ name: s.name, description: s.description, parameters: s.parameters })) });
    }
    if (req.method === 'POST' && path.startsWith('/tools/')) {
      const name = path.slice('/tools/'.length);
      if (typeof impls[name] !== 'function') return json(res, 404, { error: `no such tool: ${name}` });
      const params = await readJson(req);
      const result = await impls[name](params);
      return json(res, 200, result);
    }

    // 操作台应答（主Agent人工席 / 人类席）
    if (req.method === 'POST' && path === '/answer') {
      const body = await readJson(req);
      const text = String(body.text ?? '');
      if (!text.trim()) return json(res, 400, { error: 'empty text' });
      const kind = String(body.kind ?? 'main');
      if (kind === 'human') {
        const hw = rt.humanWait;
        if (!hw?.waitKey) return json(res, 409, { error: '引擎没有在等人类。' });
        const soul = String(hw.scope?.[0] || 'human');
        const r = await rt.submitHumanOutput(hw.jobId, hw.waitKey, text, soul, body.variables);
        // 引擎收下（post_speech 小票 posted=true）才收等待镜像；拒收保持等待态
        // ——侧栏卡上错误原样亮着，改改重寄（镜子里还在等，收了它引擎就没人等
        // 了=发言凭空丢失）。
        if (r?.posted === true) rt.clearHumanWait();
        rt.startPump();
        return json(res, 200, { answered: true, kind: 'human', wait_key: hw.waitKey, result: r });
      }
      const head = rt.router.head();
      if (head?.kind === 'directive' && head.wait_key) {
        rt.router.takeHead();
        const r = await rt.router.submitOutput(head.job_id, head.wait_key, text, undefined, 'main');
        rt.startPump();
        return json(res, 200, { answered: true, kind: 'main', wait_key: head.wait_key, result: r });
      }
      return json(res, 409, { error: '引擎没有在等主Agent。用 /state 查看当前状态。' });
    }

    // 驿站上门收件口（投递员是本机桥进程 127.0.0.1，无 token——自验证，同 autoclaw）
    if (req.method === 'POST' && path === PUSH_PATH) {
      const body = await readJson(req);
      try {
        const result = await rt.push.handlePush(body);
        // 终局/开演/重试三态的落账动词=rt.surface 回调（与事件通道同一份写口，
        // consoleState 手工映射第二份已退役）；clearHumanWait 留在本路由——
        // 运行停了「等人类」即过期，与事件通道 abortAll 同语义，双通道各自收口。
        if (result?.handled === 'stop') {
          rt.surface.onStopNotice?.({ jobId: result.jobId, outcome: result.outcome, notice: result.notice });
          rt.clearHumanWait();
        } else if (result?.handled === 'play_start') {
          rt.surface.onPlayStart?.({ jobId: result.jobId, text: result.text });
        } else if (result?.handled === 'node_retry-main') {
          rt.surface.onMainRetry?.({ waitKey: result.waitKey, feedback: result.feedback, attempt: result.attempt });
        } else if (result?.handled === 'main') {
          rt.dispatchMainBrief(result).catch(e => log(`main dispatch failed: ${String(e).slice(0, 200)}`));
        } else if (result?.handled === 'actor') {
          rt.dispatchActorRequest(result.brief).catch(e => log(`actor dispatch failed: ${String(e).slice(0, 200)}`));
        } else if (result?.handled === 'human') {
          log(`human brief via push: job=${result.jobId} wait_key=${result.waitKey}（事件通道马上会登记等待镜像）`);
        } else if (result?.handled === 'node_retry-actor') {
          rt.dispatchActorRetry(result).catch(e => log(`actor retry dispatch failed: ${String(e).slice(0, 200)}`));
        }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, handled: result?.handled ?? 'letters-only' }));
      } catch (e) {
        log(`push handler failed: ${String(e).slice(0, 200)}`);
        res.statusCode = 200; // 业务失败也让投递员记送达（信包已收下，别重投）
        return res.end(JSON.stringify({ ok: true, handled: 'error' }));
      }
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  } catch (err) {
    const code = err?.statusCode ?? 500;
    if (code >= 500) log(`route ${req.method} ${path} failed: ${String(err?.stack ?? err).slice(0, 400)}`);
    json(res, code, { error: String(err?.message ?? err) });
  }
});

// ── 启动 ─────────────────────────────────────────────────────────────
server.on('error', err => {
  if (err?.code === 'EADDRINUSE') {
    // 端口被占=旧的服务进程还活着（EADDRINUSE 时新代码没接手，旧进程继续跑
    // 旧逻辑——绑定类修复「改了没生效」多半是它）。给出明白话，别甩调用栈。
    console.error(`${TAG} 端口 ${PORT} 已被占用：旧的服务进程还在跑。`);
    console.error(`${TAG} 处置：关掉旧的服务窗口；或 PowerShell 执行`);
    console.error(`${TAG}   Get-NetTCPConnection -LocalPort ${PORT} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
    console.error(`${TAG} 然后重新启动本服务。`);
    process.exit(1);
  }
  log(`server error: ${err?.stack ?? err}`);
});
server.listen(PORT, '127.0.0.1', () => {
  log(`listening http://127.0.0.1:${PORT}/console （操作台）`);
  log(`mailbox push armed: FEMO_PUSH_PORT=${PORT}（构造桥前已定型进 spawn env）`);
  // 惰性拉桥：首拍工具/事件需要时 ensureBridge()；这里只预热。
  ensureBridge().then(() => log('bridge ready (preheated)')).catch(e => log(`bridge preheat failed (will retry on demand): ${String(e).slice(0, 160)}`));
});

async function shutdown(signal, { daemon = false } = {}) {
  log(`${signal}${daemon ? '（含引擎散场）' : ''} — shutting down`);
  try { rt.abortAll('service stopping'); } catch { /* 尽力而为 */ }
  // 引擎散场（2026-09-29「关闭服务」）：只传话不代拉——引擎活着才递，拒绝
  // （别家宿主在线）与引擎不在都落日志不挡服务自己的退场；成功则常驻引擎
  // 诚实挂起在跑的场后干净退场，投影中心一并熄灯（web 拉起的引擎本就藏窗，
  // 关灯唯一入口就是这个按钮）。
  if (daemon) {
    try {
      const r = await requestDaemonShutdown(REPO_ROOT);
      if (r === null) log('引擎散场：引擎本来就不在，跳过');
      else if (r.ok) log(`引擎已散场（停场 ${r.result?.stopped_jobs?.length ?? 0} 场）`);
      else log(`引擎拒绝散场：${String(r.detail ?? r.error ?? '?').slice(0, 200)}`);
    } catch (e) {
      log(`引擎散场请求失败（服务照退）：${String(e).slice(0, 200)}`);
    }
  }
  try { await bridge.stop(); } catch { /* 尽力而为 */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
