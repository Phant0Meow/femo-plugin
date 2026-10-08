#!/usr/bin/env node
/**
 * femo-possess.mjs — 附身+等信一体进程（zcode 无子代理化：每角色一窗，本窗认领灵魂）。
 * 2026-09-28 起是 zcode 的附身唯一入口——MCP 的 femo_possess 工具在 zcode 退役，
 * 本进程参数口径与其完全一致，且只收这四个（用户拍板，其他一律不开口）：
 *   --action / --soul_id / --host / --session_id
 *
 * 用法（AI 以 Bash 后台任务运行；自证附身不用等它退出，落账确认看输出）：
 *   附身自己（主形态；不带 --session_id）：
 *     node femo-possess.mjs --action possess --soul_id ai5
 *     行为：stdout 打 CLAIM 暗号 → 宿主把输出落盘 exec/sess_<真号>/call_*.log →
 *     进程拿暗号搜出本窗会话号（进程亲缘自证：这个后台任务是谁生的，目录就是谁的）
 *     → 走公共层 femo_possess 执行体落账 → 留在本窗后台等信（信到即退出，
 *     宿主唤醒窗口开演）。
 *   附身/解附身别人（带 --session_id；一次性，落账即退，不等信）：
 *     node femo-possess.mjs --action possess --soul_id ai5 --session_id sess_xxx [--host zcode]
 *   解附身自己（--action release 不带 --session_id）：
 *     打 ACTION=release 暗号自证 → 走公共层链路退票 → 退出。
 *   human：拒绝（口径同工具）；main：无此设定（2026-09-29 用户拍板删——zcode
 *   每窗只有一个身份，不设「演完换 main 席」；角色库本就无此灵魂，执行体如实
 *   报错）。
 *
 * 自证机制（2026-09-28 定案）：暗号=CLAIM_femo-possess_ACTION=<action>_<时间戳>_
 * <随机6位>_SOUL-ID=<soul id>，时间戳+随机防撞、整串精确匹配不需要解析。exec 目录
 * 布局（~/.zcode/cli/exec/sess_<会话号>/call_*.log）是 zcode 宿主现行为的适配事实而
 * 非契约——搜不到就响亮报错退出（exit 1），绝不静默回落猜测（「最近按回车的会话」
 * 猜错窗口、两窗互顶灵魂的事故在档）。
 *
 * 等信行为：盯驿站信柜（1s 轮询），出现「寄给本宿主本会话的 pending 收件信」即
 * 退出——本魂的拍子信 + 本窗的场务信（引擎寄给导演席 main 的开演/散场/暂停/警告）
 * 都接（2026-09-29 起：一个窗口一个身份一条进程，拍子与散场不再换席）。两类信两治：
 * 拍子信按灵魂+会话号对号，不限场；场务信是「本场」的事，归不归本窗按 job 档案
 * host_ref 查表裁决（本场负责人=动手 run 的人；session 只有宿主认识、引擎只认
 * soul，这张表只有 host 层能查——引擎、femo2host、驿站零改动，见 isMyDirectorMail）。
 * 不限场次、不限时长（认领一次守到信来；窗口关闭随宿主退场）。退出前做两件事：
 * ①写表演回合挂牌（host-history/zcode/turn-marker/<soul>.json，收卷握手——见
 * runtime/speech-collect.mjs）；②把信渲染成完整节点通知打到 stdout（另存 UTF-8
 * 干净副本，防宿主读 stdout 遇编码坑）。模型被唤醒后照通知开演。
 * 纪律（2026-09-28 换轨定稿）：领拍即取信——本进程是本席信的唯一投递通道，渲染
 * 唤醒通知的同时把信从信柜收走（消费），防重架重复叫醒（Stop 钩子已不管信柜）。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { findFemoRoot, dataRoot, importCore, HOST_ID } from '../paths.mjs';
import { renderPulledLetter } from './pulled-letter.mjs';
import { writeMarker, writeRearmRecord } from './speech-collect.mjs';
import { mailboxCli } from './mailbox-cli.mjs';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const say = m => process.stdout.write(`[femo-possess] ${m}\n`);
const die = m => { process.stderr.write(`[femo-possess] ✗ ${m}\n`); process.exit(1); };

// 参数面收口（2026-09-28 用户拍板）：只收工具口径四参数；信柜/等信副本路径、
// 引擎根（FEMO_ROOT env）都是内部既定事实，不再开接收口。等信不限场不限时。
const femoRoot = findFemoRoot().replace(/[\\/]+$/, '');
const dataRootDir = dataRoot(femoRoot);
const action = String(arg('action', '')).trim().toLowerCase();
const soulId = String(arg('soul_id', '')).trim();
const targetHost = String(arg('host', '')).trim();
const explicitSid = String(arg('session_id', '')).trim();
const mailboxPath = join(dataRootDir, 'mailbox', 'mailbox.json');
const outPath = join(dataRootDir, 'host-history', 'zcode', 'wait-letter-last.json');
const execRoot = join(homedir(), '.zcode', 'cli', 'exec');
const POLL_MS = 1000;

// ── 参数校验（口径与 femo_possess 工具一致）──────────────────────────────
if (action !== 'possess' && action !== 'release') {
  die('需要 --action possess|release（与公共层 femo_possess 工具同口径）');
}
if (action === 'possess' && !soulId) {
  die('需要 --soul_id（要附身的灵魂；先 femo_soul list 查角色库）');
}
if (targetHost && !explicitSid) {
  die('--host 只能与 --session_id 同用——跨宿主派角请带目标会话号（不带号=附身自己，宿主恒是本宿主）');
}

// ── 公共层 femo_possess 执行体（与 MCP 服务同一套，假装工具调用，逻辑单源）──
const { createBridgeToolImpls } = await importCore('tools-core.mjs');
const { ensureBridgeReady } = await importCore('daemon-client.mjs');
const { recordSoulHint } = await importCore('session-registry.mjs');
const { ZcodeDaemonClient } = await import('../mcp/engine-bind.mjs');
const hintsPath = join(dataRootDir, 'host-history', 'zcode', 'soul-hints.json');

/** 引擎直连客户端（只服务 possess 链路的 list_souls 角色库核对；用完即断，
 *  stop 只断自己不发 shutdown——关窗戏演完，引擎常驻站岗）。 */
async function withToolImpls(fn) {
  const client = new ZcodeDaemonClient({ log: m => process.stderr.write(`[femo-possess] ${m}\n`) });
  try {
    const impls = createBridgeToolImpls({
      ensureBridge: () => ensureBridgeReady(client),
      send: (cmd, args, timeoutMs) => client.send(cmd, args, timeoutMs),
      femoRoot,
      host: HOST_ID,
      hostRef: 'zcode-femo',
      // spawnPython/debugSpawnProc 只服务其他工具（chronica/干跑），本程序不调用
      possess: {
        // CLI 无 MCP 运行态：提名随时可改（在跑的戏开演时已定格，不受影响）。
        running: () => false,
      },
    });
    return await fn(impls.femo_possess);
  } finally {
    client.stop().catch(() => {});
  }
}

/** 落账成功后同拍写投递缓存（读方 hooks/lib.mjs boundSoulFromDisk；
 *  格式与语义单源在 session-registry.recordSoulHint）。 */
function writeHint(sid, soul) {
  const ok = recordSoulHint(hintsPath, HOST_ID, sid, soul);
  say(`投递缓存${ok ? '已更新' : '写失败（旁挂，不挡附身）'}: ${HOST_ID}/${sid} -> ${soul ?? '(released)'}`);
}

// ── 自证：暗号 → exec 目录搜回本窗会话号 ────────────────────────────────
function discoverSidByToken(token, t0Ms) {
  const floor = t0Ms - 2000; // mtime 时钟/落盘时序留 2s 余量
  for (let round = 0; round < 50; round++) { // 300ms × 50 ≈ 15s
    let sessNames = [];
    try {
      sessNames = readdirSync(execRoot, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.startsWith('sess_'))
        .map(d => d.name);
    } catch (e) {
      throw new Error(`exec 目录读不到（${execRoot}）：${e.message}——宿主布局适配失效，改用 --session_id 显式指号`);
    }
    for (const name of sessNames) {
      const dir = join(execRoot, name);
      let files;
      try { files = readdirSync(dir); } catch { continue; }
      for (const f of files) {
        if (!f.endsWith('.log')) continue;
        let st;
        try { st = statSync(join(dir, f)); } catch { continue; }
        if (st.mtimeMs < floor) continue;
        let text;
        try { text = readFileSync(join(dir, f), 'utf8'); } catch { continue; }
        if (text.includes(token)) return name; // 目录名即会话号（exec/sess_<sid>/）
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  }
  return undefined;
}

// ── 主流程 ──────────────────────────────────────────────────────────────
const selfMode = !explicitSid; // 不带 --session_id=操作自己（自证）；带了=替别人派角（一次性）
let watchSid = explicitSid;    // 守夜信过滤的会话号（自证或显式）

if (selfMode) {
  // 自己的操作（possess/release）：暗号自证会话号再走链路
  const token = `CLAIM_femo-possess_ACTION=${action}_${Date.now()}_${randomBytes(3).toString('hex')}_SOUL-ID=${soulId}`;
  say(`自证暗号: ${token}`);
  let sid;
  try {
    sid = discoverSidByToken(token, Date.now());
  } catch (e) {
    die(String(e.message ?? e));
  }
  if (!sid) {
    die(`15 秒内没在 exec 目录搜到暗号——宿主没把本进程 stdout 落进 ${execRoot}/sess_<号>/。` +
        '检查是否以 Bash 后台任务方式运行；若宿主布局变更，改用 --session_id 显式指号。');
  }
  say(`自证会话号 ${sid}`);
  watchSid = sid;
}

// human 口径（与工具一致）：human 是玩家席不参与附身，拒绝。main 无此设定
// （2026-09-29 用户拍板删）——传了会被执行体的角色库核对如实拒绝，不另设特例。
if (action === 'possess' && soulId === 'human') die('human 角色不参与附身（口径与 femo_possess 工具一致）');

{
  const outcome = await withToolImpls(async possessImpl =>
    possessImpl({ action, ...(soulId ? { soul_id: soulId } : {}), ...(watchSid ? { session_id: watchSid } : {}), ...(targetHost ? { host: targetHost } : {}) }));
  if (!outcome || outcome.error) die(outcome?.error ?? '公共层执行体无返回');

  const res = outcome.result ?? {};
  if (action === 'possess' && res.possessed && watchSid) writeHint(watchSid, res.possessed);
  if (action === 'release' && watchSid) writeHint(watchSid, null);
  say(`${action} 完成: soul=${res.possessed ?? soulId} session=${res.session ?? watchSid} host=${res.host ?? HOST_ID}${outcome.note ? `\n${outcome.note}` : ''}`);
}

if (action === 'release' || !selfMode) process.exit(0); // 派角/解附身都是一次性，到此为止；附身自己→继续守夜

// 重架记录（收卷握手第二半，2026-09-29）：领拍即退场后，模型按纪律「先架
// 哨兵后开口」重架本进程——认领成功即落账，收卷器据此识别「死讯已被本回合
// 消化」（见 speech-collect.mjs 重架记录节：否则开演即给自己发拍的首拍，
// 台词会被「留给唤醒轮」留给一个不存在的下一轮）。
writeRearmRecord(femoRoot, soulId, watchSid);

/** 领拍即取信（2026-09-28 换轨）：本进程是本席信的唯一投递通道——渲染唤醒
 *  通知的同时把信从信柜取走（消费），否则信滞留 pending，重架会无限重复叫醒
 *  （Stop 钩子已不管信柜）。取 3 遍防空锁；取空=信可能刚被别处领走，响亮留痕。
 *  （CLI 包装单源 mailbox-cli.mjs，2026-09-29 收编。）
 *  场务信第二遍（2026-09-29 散场信收端最后一米）：导演席 main 的场务信由本场
 *  负责人窗捎带接——只取预筛查表放行的那些 job（--job 逐场取，别场的 main 信
 *  留在柜里给正主窗；engine 的 main 信不带会话号，receive 的 --session 走
 *  宿主级匹配）。 */
function takeMail(hits) {
  const got = [];
  const args = ['receive', '--host', HOST_ID, '--soul', soulId];
  if (watchSid) args.push('--session', String(watchSid));
  for (let i = 0; i < 3; i++) {
    const batch = mailboxCli(femoRoot, args);
    if (Array.isArray(batch) && batch.length > 0) { got.push(...batch); break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
  }
  const directorJobs = [...new Set((hits ?? [])
    .filter(x => x.soul === 'main').map(x => String(x.job_id)))];
  for (const jid of directorJobs) {
    const mArgs = ['receive', '--host', HOST_ID, '--soul', 'main', '--job', jid];
    if (watchSid) mArgs.push('--session', String(watchSid));
    for (let i = 0; i < 3; i++) {
      const batch = mailboxCli(femoRoot, mArgs);
      if (Array.isArray(batch) && batch.length > 0) { got.push(...batch); break; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    }
  }
  return got;
}

/** 流观察者分身（2026-09-29）：领拍挂牌后 spawn 一个 detached 后台进程盯本窗
 *  wire 日志，把每个完成的模型调用轮次喂 hub 草稿层（准流式投影）——表演期间
 *  没有任何插件进程活着的结构性空档由它填补。旁挂纪律：spawn 失败静默
 *  （stderr 留痕），绝不影响唤醒主路；观察者自己带三重退场闸（牌清/段收口/
 *  硬超时），见 runtime/femo-stream-watcher.mjs。 */
function spawnStreamWatcher(beat) {
  try {
    if (!watchSid || !beat?.ref || !Number.isFinite(Number(beat.job_id))) return;
    const p = spawn(process.execPath, [
      join(dirname(fileURLToPath(import.meta.url)), 'femo-stream-watcher.mjs'),
      '--root', femoRoot,
      '--sid', String(watchSid),
      '--soul', String(beat.soul ?? soul),
      '--wait-key', String(beat.ref),
      '--job', String(beat.job_id),
    ], {
      detached: true, stdio: 'ignore',              // 脱离母进程：possess 退场≠观察者死
      env: { ...process.env },                       // FEMO_ROOT/FEMO_DATA_DIR 随批传递
    });
    p.unref();
    say(`流观察者已上岗（pid=${p.pid}）——表演期间的模型调用轮次将准流式上墙`);
  } catch (e) {
    process.stderr.write(`[femo-possess] 流观察者 spawn 失败（旁挂，不影响表演）：${e?.message ?? e}\n`);
  }
}

// ── 等信循环（附身自己才走到这；职能与原守夜哨兵逐行同源）────────────────
const host = HOST_ID;
const soul = soulId;
// ── 场务信认亲：main 信归不归本窗，按档案「最新发起方」格查表（09-29 定案）──
// main 的语义是本场负责人（动手 run 这场 job 的人），而 session 只有宿主认识
// （引擎只认 soul）——「main 信该落到哪个会话」是 host 层的题，答案住在 job
// 档案的 host_ref 格（femo_run 开场申报、过户续跑覆盖=永远指向现任负责人）。
// 查表只发生在柜里真出现 main 信的那一刻（一封一次，不贵）；档案读不到=
// fail closed 不取，每 job 响亮一次。
const complainedJobs = new Set();
function jobOpenerSid(jobId) {
  try {
    const d = JSON.parse(readFileSync(join(dataRootDir, 'jobs', 'runs', `${jobId}.json`), 'utf8'));
    return d?.host_ref ?? d?.host_refs?.[HOST_ID] ?? undefined;
  } catch { return undefined; }
}
function isMyDirectorMail(x) {
  if (!watchSid) return false;
  const opener = jobOpenerSid(x.job_id);
  if (opener === undefined) {
    if (!complainedJobs.has(x.job_id)) {
      complainedJobs.add(x.job_id);
      process.stderr.write(`[femo-possess] main 信（job ${x.job_id}）档案读不到/无发起方格——fail closed 不取\n`);
    }
    return false;
  }
  return String(opener) === String(watchSid);
}
// 预筛（便宜触发器，免得每秒起一个 python 子进程）：只做磁盘上的粗筛，是
// 驿站 receive 过滤正身的**超集**——不查滞留件放行（_released，同单急件
// 在箱才解禁），那部分交给 takeMail 的 CLI 权威裁决。缺 action 过滤的事故
// 在档：交卷 speech 信（action='send'、target_sid 恒空）被预筛当拍，自家
// 台词误醒自己（2026-09-29 修）。
const readPending = () => {
  try {
    const data = JSON.parse(readFileSync(mailboxPath, 'utf8'));
    const letters = Array.isArray(data?.letters) ? data.letters : [];
    return letters.filter(x =>
      x.status === 'pending'
      && x.action === 'receive'            // 寄件信归引擎出站捞，永不叫醒本席
      && x.target_host === host
      // 本魂的拍子信 + 本窗的场务信（引擎寄导演席 main 的开演/散场/暂停/警告）。
      // zcode 不设 main 席（一个窗口一个身份一条进程，拍子与散场不换席），main 信
      // 由本场负责人窗的在岗哨兵捎带接——归不归本窗按 host_ref 查表。此前的洞：
      // 预筛认 main、取信 CLI 只喊本魂，信命中却永远取不到，全宿主哨兵在每封
      // main 信上空转、窗永不醒（2645「✅已跑完」压柜实证，2026-09-29 修）
      && (x.soul === soul || (x.soul === 'main' && isMyDirectorMail(x)))
      // 会话号对号（刀2 同款语义）：信带号→精确相等；信无号→放行
      && (!watchSid || !x.target_sid || String(x.target_sid) === String(watchSid)));
  } catch { return []; } // 信柜被原子替换的瞬间读到半截：下一轮再看
};

const summary = letters => letters.map(x => ({
  job_id: x.job_id, soul: x.soul, node: x.node, ref: x.ref,
  kind: x.kind, payload: (x.payload || '').slice(0, 500),
}));

say(`上岗等信 host=${host} sid=${watchSid} soul=${soul}`);
let lastEmptyNoteMs = 0;
while (true) {
  const hits = readPending();
  if (hits.length > 0) {
    // 领拍三连：取信（消费，防重复叫醒）→ 挂牌（收卷握手）→ 渲染唤醒通知。
    // 唤醒与否以 takeMail（驿站 receive 正身）为准：预筛只是便宜触发器、是
    // 过滤口径的超集，取空=柜里没有本席可领的信（滞留件未放行/竞态已被领），
    // 照旧等。**绝不拿预筛结果凑数唤醒**——旧兜底（取空也渲染 hits）把交卷
    // speech 信当通知渲染，自家台词误醒自己、重架再醒一次（2026-09-29 修）。
    const letters = takeMail(hits);
    if (letters.length === 0) {
      if (Date.now() - lastEmptyNoteMs > 30_000) {   // 节流：预筛常驻命中时不刷屏
        lastEmptyNoteMs = Date.now();
        process.stderr.write('[femo-possess] 预筛命中但驿站无可领信（滞留件未放行或已被领走）——继续等\n');
      }
    } else {
      const show = letters;
      // 表演回合挂牌：收卷握手——模型被唤醒后的整回合发言由 Stop 钩子按此牌收集交卷。
      // 一柜多信取第一封节拍信（context/重演）挂牌；纯通知（终局等）无需表演。
      const beat = show.find(x => x.kind === 'context' || (x.kind === 'notice' && x.subkind === 'node_retry'));
      if (beat) {
        try {
          writeMarker(femoRoot, String(beat.soul ?? soul), {
            job_id: beat.job_id, soul: String(beat.soul ?? soul), node: beat.node, ref: beat.ref,
            target_host: beat.target_host, session: watchSid || undefined,
            delivered_at: new Date().toISOString(), delivered_by: 'possess',
            letter: beat,   // 全信随牌入档（payload 在内，2026-09-29）：领拍即取信
                            // 之后信柜已无副本，交卷若搁浅，牌是 payload 的唯一
                            // 存身处——重投/修复凭它，不再两眼一抹黑。
          });
          spawnStreamWatcher(beat);   // 流观察者上岗（旁挂，不挡唤醒）
        } catch { /* 挂牌失败=下一拍收卷退化为例外路径，不挡唤醒 */ }
      }
      const notice = show
        .map(x => renderPulledLetter(x, String(x.soul ?? soul)))
        .join('\n');
      const out = JSON.stringify({ timeout: false, letters: summary(show) }, null, 1);
      try { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, out, 'utf8'); } catch {}
      process.stdout.write(notice + '\n' + out + '\n');
      process.exit(0);
    }
  }
  await new Promise(r => setTimeout(r, POLL_MS));
}

