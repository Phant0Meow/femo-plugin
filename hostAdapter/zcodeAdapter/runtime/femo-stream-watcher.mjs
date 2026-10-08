#!/usr/bin/env node
/**
 * femo-stream-watcher.mjs — zcode 表演回合的「流观察者」（准流式投影，2026-09-29）。
 *
 * 为什么存在：zcode 给插件的钩子只有七个边界事件，没有逐字流；表演期间也没有
 * 任何插件进程活着（possess 哨兵信到即退出=唤醒信号本身）——所以此前 zcode 的
 * 「流式投影」= Stop 钩子交卷那一拍全文一次性上墙，整场静止、末尾蹦全文。
 * 破局点（2026-09-29 取证实锤）：宿主自己有一本 wire 日志
 * ~/.zcode/cli/rollout/model-io-<会话号>.jsonl，**每次模型调用完成那一刻整行
 * 落盘**（completedAt/durationMs/usage 皆终值），思考/正文/工具调用齐全——粒度
 * 不是逐字，是「一次模型调用」。观察者表演期间轮询它的增量，把每个新完成的
 * 调用轮次立刻喂 hub 草稿层：思考进 cot 槽、正文进 say 槽、工具进 tool 槽。
 * 投影页从「静止」变成「思考一段段长、发言一段段长」的准流式——这是 zcode
 * 观测面内能做到的极限（dsh 是宿主原生逐字流帧，没法比）。
 *
 * 生命线（谁拉起、怎么退）：
 *   · 拉起：femo-possess 领拍挂牌后、退出唤醒前，spawn detached（不挡唤醒——
 *     possess 的退出本身就是唤醒信号，观察者必须与它解耦）。
 *   · 退出三闸：①牌被清（Stop 钩子交卷成功清牌）即退；②硬超时兜底（默认
 *     60 分钟）即退；③段已收口（hub 那本账里该 wait_key 的段 open=false，
 *     落账吸收已完成）即退。任一命中干净退场，绝不赖着。
 *   · 观察者只写旁账（hub 草稿层），**收口权一点不动**：交卷仍归 Stop 钩子、
 *     转正单点归引擎落账（同 kind 吸收）；Stop 那拍的全量保底喂稿保留，双写
 *     无害（吸收规则天然去重）。
 *
 * 纪律（与仓库红线对齐）：
 *   · 旁挂：观察者任何失败静默退场（stderr 留痕），绝不影响表演与交卷主路。
 *   · 只喂本席的段：wait_key 精确对牌上的 ref，多窗并行各喂各的（一窗一
 *     观察者，各盯各的 wire 日志文件，天然不串）。
 *   · 尾读不整读：wire 日志几十 MB，只读上次位置之后的增量；文件被截断/换新
 *     （会话重启）按从零重扫处理。
 */
import { existsSync, openSync, readSync, closeSync, statSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findFemoRoot, importCore, HOST_ID, dataRoot } from '../paths.mjs';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const log = m => { try { process.stderr.write(`[femo-stream-watcher] ${m}\n`); } catch { /* */ } };
const die = m => { log(`✗ ${m}`); process.exit(0); }; // 旁挂纪律：失败=静默退场（exit 0，绝不非零——没人收尸）

// ── 参数（possess 内部 spawn，口径不外露）──────────────────────────────
const femoRoot = String(arg('root', '')).trim() || findFemoRoot();
const sid = String(arg('sid', '')).trim();
const soul = String(arg('soul', '')).trim();
const waitKey = String(arg('wait-key', '')).trim();
const jobId = Number(arg('job', NaN));
const POLL_MS = Number(arg('poll-ms', 2000));
const TIMEOUT_MS = Number(arg('timeout-ms', 60 * 60 * 1000)); // 60 分钟硬顶
const TAIL_LIMIT = 6 * 1024 * 1024;  // 与 readModelIoRounds 同款尾读上限

if (!sid || !soul || !waitKey || !Number.isFinite(jobId)) {
  die('参数不全（需要 --sid --soul --wait-key --job）——观察者不上岗');
}
const dataDir = dataRoot(femoRoot);
const markerDir = join(dataDir, 'host-history', 'zcode', 'turn-marker', soul);
// wire 日志落点：环境可注入（测试沙盒造不出 ~/.zcode 里的真日志——可测性
// 开口，生产不设 env 即落真路径，零行为差异）。
const wirePath = process.env.FEMO_WATCHER_WIRE
  ? String(process.env.FEMO_WATCHER_WIRE)
  : join(homedir(), '.zcode', 'cli', 'rollout', `model-io-${sid}.jsonl`);
if (!existsSync(wirePath)) die(`wire 日志不存在（${wirePath}）——本拍无流可观察`);

// ── 公共层件（槽键单源 draftKeyOf；喂送词汇与 web/zcode 收卷器同款）─────────
const { draftDropDeltaFrames, postFeedFramesBounded } = await importCore('hub-feed-core.mjs');
const { hubBaseUrl } = await importCore('hub-client.mjs');
const feedUrl = `${hubBaseUrl(femoRoot)}/feed`;

// ── 尾读器：wire 日志增量读取（记住上次读到的位置，只读增量）────────────────
// 窗口起点：上岗时刻减 5 分钟（时钟差余量）——只喂「上岗之后完成的调用」。
// 领拍前窗内可能有旧调用（比如模型读信那轮），它们不属于本拍表演回合；
// 但领拍→唤醒→开口有间隙，模型响应的第一轮可能 startedAt 早于上岗时刻，
// 所以按 completedAt ≥ 上岗时刻 - 5min 过滤，宁可多喂几轮旧思考，不可
// 漏掉表演第一轮（多喂的会被引擎落账吸收规则收编，无害；漏喂第一轮
// 投影页就死气沉沉）。
const bootFloorMs = Date.now() - 5 * 60 * 1000;
let readPos = 0;
let lastSize = 0;
function readIncrement() {
  let st;
  try { st = statSync(wirePath); } catch { return null; } // 文件没了（会话目录被清）：按截断处理
  if (st.size < lastSize) { readPos = 0; }                // 截断/换新：从零重扫
  lastSize = st.size;
  if (st.size === readPos) return [];                     // 无新内容
  // 单次增量超过尾读上限：只留最近 TAIL_LIMIT 字节（老内容不回头补——观察者只管「现在起」）
  if (st.size - readPos > TAIL_LIMIT) readPos = st.size - TAIL_LIMIT;
  const start = readPos;
  const len = st.size - start;
  let text = '';
  try {
    const fh = openSync(wirePath, 'r');
    try {
      const buf = Buffer.alloc(len);
      readSync(fh, buf, 0, len, start);
      text = buf.toString('utf8');
    } finally { closeSync(fh); }
  } catch { return []; }
  readPos = st.size;
  // 行对齐：增量末行多半被截半——把没读到换行符的尾巴退回去（位置回退，下轮续读）
  const lastNl = text.lastIndexOf('\n');
  if (lastNl < text.length - 1) {
    readPos -= (text.length - 1 - lastNl);
    text = text.slice(0, lastNl + 1);
  }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (d?.type !== 'model_io') continue;
    const done = Date.parse(d.completedAt ?? '');
    if (Number.isFinite(done) && done < bootFloorMs) continue; // 上岗前的旧轮次：不是本拍的戏
    out.push(d);
  }
  return out;
}

// ── 轮次 → 草稿帧（分槽：cot / say / tool；键随轮次推进不撞）───────────────
let roundSeq = 0;
const toolNameOf = tc => String(tc?.name ?? 'tool');
/** 一个完成的模型调用轮次 → 若干 draft-delta 帧（wait_key 对段，hub 拼段键）。 */
function framesOfRound(d) {
  const r = d?.response ?? {};
  const frames = [];
  const idx = roundSeq++;
  const base = { wait_key: waitKey };
  const cot = String(r.reasoningText ?? '');
  if (cot) frames.push({ op: 'draft-delta', ...base, key: `reasoning#${idx}#-`, kind: 'reasoning', text: cot });
  const text = String(r.text ?? '');
  if (text) frames.push({ op: 'draft-delta', ...base, key: `text#${idx}#-`, kind: 'text', text });
  const calls = Array.isArray(r.toolCalls) ? r.toolCalls : [];
  calls.forEach((tc, k) => {
    const args = typeof tc?.arguments === 'string' ? tc.arguments : JSON.stringify(tc?.arguments ?? {});
    frames.push({ op: 'draft-delta', ...base, key: `toolcall#${idx}#${k}`, kind: 'toolcall', text: args, name: toolNameOf(tc) });
  });
  return frames;
}

// ── 退出闸 ──────────────────────────────────────────────────────────────
const t0 = Date.now();
/** 牌还在吗？（Stop 交卷成功即清牌——观察者的主退场信号）。半截牌/无牌=已清。 */
function markerGone() {
  try {
    let files = [];
    try { files = readdirSync(markerDir); } catch { return true; } // 目录没了=清光了
    if (files.length === 0) return true;
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const m = JSON.parse(readFileSync(join(markerDir, f), 'utf8'));
        // 本席的牌还在吗：ref 对号 + 会话对号（readMarker 同款语义，只认本窗的牌）。
        if (String(m.ref ?? '') === waitKey
            && (m.session === undefined || String(m.session ?? '') === String(sid))) return false;
      } catch { /* 半截牌（写读竞态）：当还在，等下一轮再看 */ }
    }
    return true; // 没有本席的牌=已交卷清牌
  } catch { return true; }
}

/** 段收口了吗？（hub 快照里该段 open=false——落账吸收完成，观察者退场）。 */
async function segClosed() {
  try {
    const base = hubBaseUrl(femoRoot).replace(/\/$/, '');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    let rows;
    try {
      const res = await fetch(`${base}/view?job=${jobId}&view=god`, { signal: ctl.signal });
      const j = await res.json();
      rows = j?.rows ?? [];
    } finally { clearTimeout(timer); }
    const seg = `w:${HOST_ID}:${waitKey}`;
    for (const r of rows) {
      if (String(r.seg ?? '') === seg) return !r.open; // 找到段：open=false 即收口
    }
    return false; // 没找到段（快照滞后/视角过滤）：继续等
  } catch { return false; }
}

/** 喂帧（best-effort 竞速上界；失败静默——旁挂纪律）。 */
async function feed(frames) {
  if (frames.length === 0) return;
  await postFeedFramesBounded(feedUrl, { job_id: jobId, source: HOST_ID, frames }, 1500);
}

// ── 主循环 ──────────────────────────────────────────────────────────────
log(`上岗 sid=${sid} soul=${soul} job=${jobId} wait_key=${waitKey} poll=${POLL_MS}ms`);
let lastHeartbeat = 0;
while (true) {
  // 闸①：牌被清（交卷成功）→ 退场
  if (markerGone()) { log('牌已清（交卷完成）——观察者退场'); process.exit(0); }
  // 闸②：硬超时 → 退场
  if (Date.now() - t0 > TIMEOUT_MS) { log(`硬超时（${Math.round((Date.now() - t0) / 60000)} 分钟）——观察者退场`); process.exit(0); }
  try {
    // 读增量
    const rounds = readIncrement();
    if (rounds.length > 0) {
      const frames = rounds.flatMap(framesOfRound);
      if (frames.length > 0) await feed(frames);
    }
    // 闸③：段收口 → 退场（每 30 秒探一次，便宜）
    if (Date.now() - lastHeartbeat > 30_000) {
      lastHeartbeat = Date.now();
      if (await segClosed()) { log('段已收口（引擎落账吸收完成）——观察者退场'); process.exit(0); }
    }
  } catch (e) {
    log(`主循环异常（旁挂继续）：${e?.message ?? e}`);
  }
  await new Promise(r => setTimeout(r, POLL_MS));
}
