/**
 * speech-collect.mjs — 表演回合收集器（无子代理化定稿，2026-09-26；全程收集改版 2026-09-27）。
 *
 * 【它解决什么】zcode 模型被节点信唤醒后的整回合发言就是节点台词，但模型只管
 * 正常说话、不敲任何命令——收集、分类、交驿全是插件的事（钩子完成）。
 *
 * 【收集窗口=死讯→回合闭合（2026-09-27 用户拍板）】从哨兵死讯（或钩子注入）
 * 唤醒那轮开始，思考、每一次工具调用、最终台词全部收集，多步全量收入交卷体
 * steps（TranscriptStep 生料，契约见 femoCompiler/protocol.py）——结构解释权
 * 归引擎，宿主只递生料不解释。宿主观测面两处：
 *   · 回合内 PostToolUse（hooks.json 接线）：工具边界事件折进本回合收集文件
 *     turn-speech/<soul>.jsonl（stashTurnEvent，伪转写行与宿主转写同构）；
 *   · Stop 转写：只有本回合最后一条消息（刀7 探针实证）——台词正身仍须最后说。
 * 收卷时两路折叠、按行去重、分类，交驿后清收集文件。
 *
 * 【握手协议=挂牌（2026-09-28 改 (job, ref) 建档）】节拍信交付时刻（钩子注入
 * 或哨兵守到）写挂牌：host-history/zcode/turn-marker/<soul>/<job>__<ref>.json =
 * { job_id, soul, node, ref, target_host, session, delivered_at, delivered_by }。
 * 一魂一份的旧牌在「双开同灵魂并发场次」下互相覆盖（施工清单 §六缺口①，
 * 本场靠时序运气走完）；改按 (job, ref) 一拍一牌后，读取按收件会话号优先选牌
 * （session 字段），各窗口各对各的牌。本回合收尾（下一次 Stop）见到挂牌 →
 * 折叠收集 → 交卷（daemon /cmd/post_speech，ref 对号入座，信封=公共层
 * executorSpeechArgs）→ 撤牌 → 清收集文件。挂牌同时是回合内收集的闸：无牌的
 * 回合（普通聊天、领拍之前）零收集零开销。
 * 【2026-09-29 窗口锚定+交卷换道】①挂牌时刻即清该魂过程料文件——收集窗口=
 * 死讯开始的那一轮，不再跨轮累积（详见 writeMarker 内注）；②交卷从 mailbox
 * CLI 改走 daemon HTTP /cmd/post_speech（命令行 ~32K 上限曾把超限信封打成
 * EINVAL 秒败且静默吞掉，详见 submitSpeech 内注）；③交卷失败必落诊断账
 * submit-errors.jsonl（少兜底：断在哪一环，盘上必有行）。
 *
 * 【已答节拍短账（2026-09-28，施工清单 §六缺口②；判据细化 2026-10-06）】交卷成功
 * 即把 (job, ref, 信id) 记入 answered-refs.json（24h TTL，随记随剪）——同一封
 * 信重复送达时不再交卷。键必须带信 id：引擎续跑重建 Runtime 后拍子编号从 0
 * 重计、ref 同场复用，粗键 (job, ref) 会把续跑后的新拍当重复拍吞掉（j2716
 * 实案：_9 撞 19:15 旧账，台词蒸发全城卡场）；引擎本身容忍重复 ref，防重只认
 * 「同一封信」。重演信是 notice（subkind=node_retry）不走此闸：重演本就带着
 * 「上一轮没过」的事实，闸了它重演通路就断。
 *
 * 【分门别类】折叠行按块分类：思考/工具按发生序归 steps（带序号，hub post_speech
 * 拆 cot/工具槽），台词归 text（构造信封时自立末步 reply——台词唯一正身）。
 * 例外说明：回合中间的 assistant 文本块罕见（zcode 一轮通常只有末条文本），
 * 与末条台词合并进同一段 reply——「全部收入 reply」的字面执行。
 *
 * 【思考第三路源（2026-09-29）】cot 一直全空的根：PostToolUse 只有工具轮、
 * Stop 转写只装末条消息——思考在 zcode 的钩子观测面里结构性不可见，上面的
 * thinking 解析从此空转（chronica/hub/网页三层 cot 列同空，2646 实证）。宿主
 * 自己的 wire 日志 ~/.zcode/cli/rollout/model-io-<会话号>.jsonl 每次模型调用
 * 一行（startedAt/completedAt + response.reasoningText/text/toolCalls 逐轮
 * 齐全）——收卷时按收卷窗口尾读补齐（readModelIoRounds + weaveModelIoSteps，
 * 按工具调用数对齐织入，不按内容匹配）。按「适配事实而非契约」对待：读不到
 * =软失败响亮留痕，绝不挡收卷主路。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync, appendFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { dataRoot, importCore, HOST_ID } from '../paths.mjs';

/** 宿主历史目录（落点解析唯一出处=paths.mjs，2026-09-28 归拢）。 */
function hostHistoryDir(femoRoot) {
  return join(dataRoot(femoRoot), 'host-history');
}

/** zcode 私产格（2026-09-28 聚拢，私产下推裁决：宿主内部状态不摊在共享
 *  host-history 根下——挂牌/收集文件只按 soul 命名，跨宿主同魂同名会撞）。 */
function privateDir(femoRoot) {
  return join(hostHistoryDir(femoRoot), 'zcode');
}

/** 一魂的牌格（一拍一牌：turn-marker/<soul>/<job>__<ref>.json）。 */
function markerSoulDir(femoRoot, soul) {
  return join(privateDir(femoRoot), 'turn-marker', String(soul));
}

/** 牌文件名：<job>__<消毒 ref>-<短哈希>.json——ref 形如 j17:ai_[open]_1，含
 *  文件名非法字符；消毒后不同 ref 仍可能撞成同串，短哈希兜底唯一。 */
function markerFileName(marker) {
  const ref = String(marker.ref ?? '');
  const safe = ref.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'ref';
  const hash = createHash('sha1').update(ref).digest('hex').slice(0, 8);
  return `${Number(marker.job_id) || 0}__${safe}-${hash}.json`;
}

export function writeMarker(femoRoot, soul, marker) {
  const p = join(markerSoulDir(femoRoot, soul), markerFileName(marker));
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(marker, null, 1), 'utf8');
  // 收集窗口锚定（2026-09-29）：过程料收集窗口=哨兵死讯开始的**那一轮**——
  // 挂牌即清上轮残留，步骤料不再跨轮累积（旧账：文件只在交卷成功后清，失败/
  // 跳过轮次的工具调用永久滚存，把无关轮次折进下一拍的 steps，还把信封滚过
  // 命令行上限造成交卷永久失败）。旧文件内容若属于未交卷的上一拍，那一拍按
  // latest-wins 本就已被新牌顶掉。
  discardTurnSpeech(femoRoot, soul);
}

/** 读本魂的牌（2026-09-28 改 (job, ref) 建档的配套语义）：
 *  · 带收件会话号 → 只认本窗的牌（session 相等；无 session 字段的旧牌按可领
 *    算，作缓存刷新的升级过渡窗）。绝不跨窗互抢——本窗无牌即无牌，这正是
 *    「一魂一份牌被并发的另一窗捡走收卷」缺口（清单 §六①）的修复点；
 *  · 不带号（后台任务唤起的钩子周期）→ 取最新 delivered_at 兜底。
 *  无牌/半截牌=null。 */
export function readMarker(femoRoot, soul, sid) {
  const dir = markerSoulDir(femoRoot, soul);
  let files = [];
  try { files = readdirSync(dir).filter(f => f.endsWith('.json')); } catch { return null; }
  const loaded = files.map(f => {
    try { return { ...JSON.parse(readFileSync(join(dir, f), 'utf8')), _file: f }; }
    catch { return null; } // 半截牌（写读竞态）：当没牌
  }).filter(Boolean);
  if (loaded.length === 0) return null;
  const pool = sid ? loaded.filter(m => m.session === sid || m.session === undefined) : loaded;
  pool.sort((a, b) => String(b.delivered_at ?? '').localeCompare(String(a.delivered_at ?? '')));
  return pool[0] ?? null;
}

export function clearMarker(femoRoot, soul, sid) {
  const m = readMarker(femoRoot, soul, sid);
  if (!m?._file) return;
  try { unlinkSync(join(markerSoulDir(femoRoot, soul), m._file)); } catch { /* 无牌即了 */ }
}

/** 列出全部挂牌灵魂（会话号缺失时的唯一在牌兜底用——单窗单魂设计内）。 */
export function markedSouls(femoRoot) {
  const dir = join(privateDir(femoRoot), 'turn-marker');
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  } catch { return []; }
}

// ── 已答节拍短账（同拍重复产信防重，2026-09-28；判据细化到信 id，2026-10-06）──
// 【判据，j2716 实案】键原为 (job, ref)。但引擎拍子编号计数器是运行时内存态、
// 不进续跑档案：续跑重建 Runtime 后计数器从 0 重计，ref 在同一场内复用
// （暂停前的 _9 与续跑后的 _9 同号）。引擎本身容忍重复 ref——每拍等待各自
// 独立，同 ref 两轮交卷均被正常吸收——所以防重唯一该认的是「同一封信」：
// 信 id 才是投递实例的正身。同信重投=真重复（跳过）；同号异信=新拍子
// （绝不跳过——旧粗键在这里把新拍台词当重复拍吞掉，全城卡场）。
// 信无 id 同样绝不跳过：宁可多交一封死信（引擎出站口响亮记账，不回炉），
// 不吞一拍。
const ANSWERED_TTL_MS = 24 * 60 * 60 * 1000;
const answeredKey = (jobId, ref, letterId) => `j${Number(jobId) || 0}:${String(ref)}:${String(letterId)}`;

export function isAnsweredRef(femoRoot, jobId, ref, letterId) {
  if (ref === undefined || ref === null || ref === '') return false;
  if (letterId === undefined || letterId === null || letterId === '') return false; // 无实例身份=不跳过
  try {
    const ts = JSON.parse(readFileSync(join(privateDir(femoRoot), 'answered-refs.json'), 'utf8'))[answeredKey(jobId, ref, letterId)];
    return Number.isFinite(ts) && Date.now() - ts <= ANSWERED_TTL_MS;
  } catch { return false; }
}

/** 交卷成功后记一笔（TTL 过期项随记随剪）。键带信 id（判据见 answeredKey 节）；
 *  牌上无信 id 不记——没身份就没法防重，如实不记账（宁可重交不可吞拍）。
 *  写失败留痕不抛——短账是防重旁挂，丢了最多多注一圈回声，不挡交卷主路。 */
export function recordAnsweredRef(femoRoot, marker) {
  if (!marker?.ref) return;
  const letterId = marker.letter?.id ?? marker.letter_id;
  if (!letterId) {
    try { console.error('[femo-hook] answered-ref: 牌上无信 id，不记防重账（宁重交不吞拍）'); } catch { /* */ }
    return;
  }
  const p = join(privateDir(femoRoot), 'answered-refs.json');
  try {
    let acct = {};
    try { acct = JSON.parse(readFileSync(p, 'utf8')); } catch { /* 新账 */ }
    const now = Date.now();
    for (const [k, ts] of Object.entries(acct)) {
      if (!Number.isFinite(ts) || now - ts > ANSWERED_TTL_MS) delete acct[k];
    }
    acct[answeredKey(marker.job_id, marker.ref, letterId)] = now;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(acct), 'utf8');
  } catch (e) {
    try { console.error(`[femo-hook] answered-ref record failed: ${String((e && e.message) || e)}`); } catch { /* */ }
  }
}

/** 本回合收集文件（按灵魂一格）：回合内 PostToolUse 攒的过程料。 */
export function turnSpeechPath(femoRoot, soul) {
  return join(privateDir(femoRoot), 'turn-speech', `${soul}.jsonl`);
}

/** 追加行（去重、保序）。伪转写行与宿主转写同构，分类一份代码。 */
function appendTurnLines(femoRoot, soul, lines) {
  const fresh = lines.filter(l => typeof l === 'string' && l.trim().length > 0);
  if (fresh.length === 0) return 0;
  const p = turnSpeechPath(femoRoot, soul);
  let known = new Set();
  try { known = new Set(readFileSync(p, 'utf8').split('\n')); } catch { /* 新格 */ }
  const add = fresh.filter(l => !known.has(l));
  if (add.length === 0) return 0;
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, add.join('\n') + '\n', 'utf8');
  return add.length;
}

/** 回合内事件折进收集文件（PostToolUse 钩子调）。事件带 transcript_path 时收其
 *  行（宿主转写=末条消息，与已收行按行去重）。tool_use 合成行与转写**互补不
 *  互斥**（2026-09-28 修）：工具边界时点的转写常是空的（它只在回合收尾才装
 *  末条消息），曾因「有转写就跳过合成」把 tool_use 饿死、只剩孤儿 tool_result
 *  被折叠丢弃——工具轮从此进不了台账（真演出 2638 实证）。工具结果
 *  （tool_output/tool_response）宿主转写从不装（刀7 实证），恒合成 tool_result
 *  伪行；它可能是对象（宿主发结构化 toolResponse），String() 会攒出
 *  「[object Object]」——对象走 JSON 序列化（同批修）。返回追加了 few 行。 */
export function stashTurnEvent(femoRoot, soul, { toolName, toolInput, toolOutput, transcriptPath } = {}) {
  const lines = [];
  if (transcriptPath && existsSync(transcriptPath)) {
    for (const l of readFileSync(transcriptPath, 'utf8').split('\n')) lines.push(l);
  }
  if (toolName) {
    lines.push(JSON.stringify({ message: { role: 'assistant', content: [{ type: 'tool_use', name: String(toolName), input: toolInput ?? {} }] } }));
  }
  const raw = toolOutput;
  const out = raw == null ? '' : (typeof raw === 'string' ? raw : JSON.stringify(raw));
  if (out.trim()) {
    lines.push(JSON.stringify({ message: { role: 'user', content: [{ type: 'tool_result', content: out }] } }));
  }
  return appendTurnLines(femoRoot, soul, lines);
}

/** 清本回合收集文件（收卷后/新牌前；无文件静默）。 */
export function discardTurnSpeech(femoRoot, soul) {
  try { unlinkSync(turnSpeechPath(femoRoot, soul)); } catch { /* 无文件即了 */ }
}

// ── 回合开合游标（唤醒轮判据，2026-09-29）────────────────────────────────
// 落账口径：每个节点的收集窗口=哨兵死讯开始，到本轮结束。死讯可能落在某个
// 「非唤醒回合」的中间（导演开演拍：架进程+flow_start 同回合，信在回合中途
// 到站、进程死讯写牌）——那个回合收尾时若照常收卷，会把回合开头的话误当台词
// （Job 2643 实证：开演报告被收成 [speak]，真拍子连台词带工具轮整轮漏收）。
// 判据：游标记每窗「回合开场时刻」（UserPromptSubmit 钩子记）与「上次收尾
// 时刻」（Stop 钩子记）。牌的死讯时刻 D 晚于本回合开场、且本回合此后没关过
// （开场时刻比上次收尾还新）→ 死讯落在本回合中间 → 本回合不收不撤，牌和
// 过程料都留给死讯唤醒的那一轮。适配器私产（只有 zcode 钩子消费）。
const turnCursorFile = femoRoot => join(privateDir(femoRoot), 'turn-cursor.json');

function loadTurnCursor(femoRoot) {
  try {
    const d = JSON.parse(readFileSync(turnCursorFile(femoRoot), 'utf8'));
    return { open: d?.open && typeof d.open === 'object' ? d.open : {}, close: d?.close && typeof d.close === 'object' ? d.close : {} };
  } catch { return { open: {}, close: {} }; }
}

function saveTurnCursor(femoRoot, cursor) {
  try {
    mkdirSync(dirname(turnCursorFile(femoRoot)), { recursive: true });
    writeFileSync(turnCursorFile(femoRoot), JSON.stringify(cursor), 'utf8');
  } catch { /* 游标是旁挂：写失败退化为「永不判陈」=现行行为 */ }
}

/** 回合开场（UserPromptSubmit 钩子调；每次用户回车刷新本窗游标）。 */
export function recordTurnOpen(femoRoot, sid) {
  if (!sid) return;
  const c = loadTurnCursor(femoRoot);
  c.open[sid] = Date.now();
  saveTurnCursor(femoRoot, c);
}

/** 回合收尾（Stop 钩子末尾调；无论收没收卷，回合都算关了）。 */
export function recordTurnClose(femoRoot, sid) {
  if (!sid) return;
  const c = loadTurnCursor(femoRoot);
  c.close[sid] = Date.now();
  saveTurnCursor(femoRoot, c);
}

/** 死讯是否落在本回合中间（true=本回合不是唤醒轮，不得收卷）。
 *  牌没写死讯时刻（旧牌）一律按不是，行为同修复前。 */
export function turnPredatesDeath(femoRoot, sid, deliveredAtMs) {
  if (!Number.isFinite(deliveredAtMs)) return false;
  const c = loadTurnCursor(femoRoot);
  const open = c.open[sid];
  const close = c.close[sid];
  return open != null && open < deliveredAtMs && (close == null || close < open);
}

// ── 重架记录（「死讯已被本回合消化」的判据，2026-09-29）──────────────────
// 「死讯落在回合中间→留给唤醒轮」有个盲区：导播窗开演即给自己发拍时，信在
// 开演回合中途到站、模型在回合内读完通知、按纪律「先架哨兵后开口」亲手重架
// possess、把台词说成本回合末条消息——此后**不存在下一轮唤醒**，旧判据把牌
// 永远留给一个不会来的回合（2645 首拍实证：15:34 的收卷被跳过，台词滞留
// 两小时直到人工戳窗）。判别信号=重架本身：femo-possess 认领成功即落本记录
// （每魂一格），收卷器见「重架时刻晚于牌的死讯时刻且会话号对上」即认定
// 本回合就是唤醒轮，照常收卷。
const rearmPath = (femoRoot, soul) => join(privateDir(femoRoot), 'rearm', `${soul}.json`);

export function writeRearmRecord(femoRoot, soul, sid) {
  try {
    const p = rearmPath(femoRoot, soul);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ sid: sid ?? null, at: new Date().toISOString() }), 'utf8');
  } catch { /* 旁挂：写失败退化为「永不判活」=旧跳过行为 */ }
}

/** 重架是否晚于死讯且会话对号（true=本回合即唤醒轮，可收卷）。 */
export function rearmCoversDeath(femoRoot, soul, sid, deliveredAtMs) {
  if (!Number.isFinite(deliveredAtMs)) return false;
  try {
    const d = JSON.parse(readFileSync(rearmPath(femoRoot, soul), 'utf8'));
    if (!d?.at || (sid && d.sid !== sid)) return false;
    const at = Date.parse(d.at);
    return Number.isFinite(at) && at > deliveredAtMs;
  } catch { return false; }
}

/** 收卷折叠：本回合收集文件（回合内攒的工具步）+ 末条消息转写，按行去重后
 *  分类。返回 { text, steps } 或 null（空回合/末条无台词的残局不交——空台词信
 *  引擎怎么消费没有定约，不发明语义）。steps 带序号（step 从 0 起）。 */
export function collectTurnSpeech(femoRoot, soul, transcriptPath) {
  const lines = [];
  const seen = new Set();
  const take = l => { if (typeof l === 'string' && l.trim().length > 0 && !seen.has(l)) { seen.add(l); lines.push(l); } };
  try { for (const l of readFileSync(turnSpeechPath(femoRoot, soul), 'utf8').split('\n')) take(l); } catch { /* 无过程料 */ }
  if (transcriptPath && existsSync(transcriptPath)) {
    for (const l of readFileSync(transcriptPath, 'utf8').split('\n')) take(l);
  }
  const speech = [];
  const steps = [];
  let cur = null;   // 正在攒的 step：{cot} 或 {tool_calls, tool_results}
  let seq = 0;
  const flush = () => { if (cur) { cur.step = seq++; steps.push(cur); } cur = null; };
  for (const line of lines) {
    let d; try { d = JSON.parse(line); } catch { continue; }
    const msg = d?.message;
    if (!msg || !msg.content) continue;
    if (msg.role === 'user') {
      // 工具结果行（role=user 的 tool_result 块）：并进当前工具 step，按位配对
      const content = Array.isArray(msg.content) ? msg.content : [];
      for (const b of content) {
        if (String(b?.type ?? '') !== 'tool_result') continue;
        const out = typeof b?.content === 'string' ? b.content : JSON.stringify(b?.content ?? '');
        if (cur && Array.isArray(cur.tool_calls)) cur.tool_results.push(String(out ?? ''));
      }
      continue;
    }
    if (msg.role !== 'assistant') continue;
    const content = typeof msg.content === 'string'
      ? (msg.content.trim() ? [{ type: 'text', text: msg.content }] : [])
      : (Array.isArray(msg.content) ? msg.content : []);
    for (const b of content) {
      const t = String(b?.type ?? '');
      if (t === 'text' && String(b?.text ?? '').trim()) speech.push(String(b.text).trim());
      else if ((t === 'thinking' || t === 'reasoning') && String(b?.thinking ?? b?.text ?? '').trim()) {
        const piece = String(b.thinking ?? b.text).trim();
        if (cur && cur.cot != null) cur.cot += '\n\n' + piece;
        else { flush(); cur = { cot: piece }; }
      } else if (t === 'tool_use') {
        flush();
        cur = { tool_calls: [{ name: String(b?.name ?? 'tool'), arguments: JSON.stringify(b?.input ?? {}) }], tool_results: [] };
      }
    }
  }
  flush();
  if (speech.length === 0 && steps.length === 0) return null;
  if (!speech.join('\n').trim()) return null;
  return { text: speech.join('\n'), steps };
}

// ── 思考第三路源：rollout 模型收发日志（2026-09-29，见文件头注）────────────
const MODELIO_TAIL = 6 * 1024 * 1024; // 尾读上限：单回合几十轮≈几 MB，6MB 兜底

/** 读本会话 rollout wire 日志里收卷窗口内的模型轮次。
 *  返回 [{startedAt, cot, text, nCalls, model}]（按发生序；model={modelId,
 *  providerId} 为该轮实际响应模型，老日志缺这行顶层键= null）。文件读不到/
 *  解析零行=返回空数组（log 收响亮留痕），绝不抛——旁挂不挡收卷主路。 */
export function readModelIoRounds(sid, windowStartMs, log = () => {}) {
  if (!sid || !Number.isFinite(windowStartMs)) return [];
  const p = join(homedir(), '.zcode', 'cli', 'rollout', `model-io-${sid}.jsonl`);
  let text = '';
  try {
    const st = statSync(p);
    const start = Math.max(0, st.size - MODELIO_TAIL);
    const fh = openSync(p, 'r');
    try {
      const buf = Buffer.alloc(st.size - start);
      readSync(fh, buf, 0, buf.length, start);
      text = buf.toString('utf8');
    } finally { closeSync(fh); }
    if (start > 0) text = text.slice(text.indexOf('\n') + 1); // 首行多半被截半，丢弃
  } catch (e) {
    log(`rollout 日志读不到（${p}）：${e.message}——本拍无思考/中途发言补齐`);
    return [];
  }
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (d?.type !== 'model_io') continue;
    const done = Date.parse(d.completedAt ?? '');
    if (!(Number.isFinite(done) && done >= windowStartMs)) continue;
    const r = d.response ?? {};
    rows.push({
      startedAt: Date.parse(d.startedAt ?? '') || done,
      cot: String(r.reasoningText ?? ''),
      text: String(r.text ?? ''),
      nCalls: Array.isArray(r.toolCalls) ? r.toolCalls.length : 0,
      // 模型标识（2026-10-02 存储层贯通）：wire 行顶层 model={modelId,providerId}
      // ——收卷时取末轮拼 provider/model 落账 react_steps.model_id（登记制，取不到留空）。
      model: d.model ?? null,
    });
  }
  rows.sort((a, b) => a.startedAt - b.startedAt);
  return rows;
}

/** 把模型轮次的思考/中途发言织进步数组（纯函数，测试直驱）。
 *  对齐口径=工具调用数不按内容匹配：每轮声明 nCalls 个调用，就吃掉现有 steps
 *  里随后的 nCalls 个工具步；思考作独立 {cot} 步、中途发言作独立 {reply} 步
 *  （wire 契约 {step,cot,reply,tool_calls,tool_results} 任缺其一合法；台词
 *  正身仍是末步 reply，lastStepReply 只读末步不受影响）。对不齐时现有 steps
 *  全数保底顺序输出——织入只增不删，绝不丢过程料。 */
export function weaveModelIoSteps(steps, rounds) {
  const out = [];
  let k = 0;
  for (const r of rounds) {
    if (r.cot) out.push({ cot: r.cot });
    if (r.text) out.push({ reply: r.text });
    let taken = 0;
    while (taken < r.nCalls && k < steps.length && Array.isArray(steps[k]?.tool_calls)) {
      out.push(steps[k++]);
      taken++;
    }
  }
  while (k < steps.length) out.push(steps[k++]);
  return out.map((s, i) => ({ ...s, step: i })); // 织入后整体重排序号，保持从 0 单调
}

/** 交卷失败诊断账（少兜底纪律的留痕面：交卷链断在哪一环，这里必有行；
 *  「应交未交」的收卷跳过行也在此账——logAnsweredSkip）。双写 stderr 与
 *  submit-errors.jsonl。写账失败不抛。 */
function logSubmitFailure(femoRoot, marker, reason, detail) {
  const line = JSON.stringify({
    at: new Date().toISOString(), job_id: marker?.job_id, ref: marker?.ref,
    soul: marker?.soul, reason, ...(detail !== undefined ? { detail: String(detail).slice(0, 500) } : {}),
  });
  try { console.error(`[femo-hook] submit failed: ${line}`); } catch { /* */ }
  try {
    const p = join(privateDir(femoRoot), 'submit-errors.jsonl');
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, line + '\n', 'utf8');
  } catch { /* 旁挂 */ }
}

/** 「应交未交」响亮留痕（2026-10-06，j2716 实案）：Stop 钩子按已答短账撤牌时
 *  也在此账留一行。撤牌本是正路（同信重投=真重复），但旧粗键判据错杀新拍时
 *  这条路**无声**吞台词、全城卡场，查无可查——撤牌留一行，判据错了才有得查。
 *  写账失败不抛（旁挂）。 */
export function logAnsweredSkip(femoRoot, marker) {
  const line = JSON.stringify({
    at: new Date().toISOString(), job_id: marker?.job_id, ref: marker?.ref,
    soul: marker?.soul, reason: 'already_answered_skip',
    ...(marker?.letter?.id ? { letter_id: marker.letter.id } : {}),
  });
  try { console.error(`[femo-hook] answered skip: ${line}`); } catch { /* */ }
  try {
    const p = join(privateDir(femoRoot), 'submit-errors.jsonl');
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, line + '\n', 'utf8');
  } catch { /* 旁挂 */ }
}

/** 交卷（daemon HTTP /cmd/post_speech，ref 对号；收口权仍归引擎出站）。返回
 *  回执 {id} 或 null（失败——reason 必有诊断账）。
 *  信封唯一出处=公共层 executorSpeechArgs（2026-09-27 定形：台词唯一正身=
 *  body.steps 末步 reply）。台词不并进工具步：末步已是发言步（带 reply）才
 *  合并，否则台词自立末步。modelId（第 5 参，2026-10-02 存储层）：本轮实际
 *  响应模型 provider/model，随信封 body.model_id 上交引擎落账。
 *  【2026-09-29 换道：mailbox CLI → daemon HTTP】旧路把整个 steps 信封塞进
 *  spawnSync 的单个命令行参数——Windows ~32K 上限（引号扩展后更早触顶）把
 *  超限信封打成 EINVAL 秒败、mailbox-cli 静默吞 null，收集文件只增不减后
 *  交卷永久失败（05:12/13:56 两轮台词即此蒸发，submit-errors.jsonl 立账前
 *  零痕迹）。现走 /cmd/post_speech（dsh 交卷同款命令）：信封 JSON 走 HTTP 体
 *  无长度上限，跨宿主回信的 target 解析（档案 host_refs）由它单源负责。
 *  引擎不在线=交卷搁浅（响亮留痕；牌与牌上信 payload 在盘，等下一拍重试）。 */
export async function submitSpeech(femoRoot, marker, speech, steps, modelId) {
  if (!marker?.ref || !speech || !speech.trim()) return null;
  let envelope;
  try {
    const core = await importCore('speech-core.mjs');
    const stepList = Array.isArray(steps) ? steps : [];
    const last = stepList[stepList.length - 1];
    const own = !(last && typeof last === 'object' && String(last.reply ?? '').trim());
    envelope = core.executorSpeechArgs({
      jobId: Number(marker.job_id), waitKey: String(marker.ref), soul: String(marker.soul),
      ...(marker.node ? { node: String(marker.node) } : {}),
      output: speech,
      steps: own ? [...stepList, { step: stepList.length }] : stepList,
      // model_id 落账（2026-10-02 存储层）：本轮实际响应模型 provider/model，
      // 取自 wire 日志末轮（hooks 侧传入）；取不到不传=引擎落空串，登记制不伪造。
      ...(modelId ? { modelId } : {}),
    });
  } catch (e) {
    logSubmitFailure(femoRoot, marker, 'envelope_build', (e && e.stack) || e);
    return null;
  }
  try {
    const { probeDaemon } = await importCore('daemon-client.mjs');
    const hit = await probeDaemon(femoRoot, { quiet404: true, timeoutSec: 1 });
    if (!hit) {
      logSubmitFailure(femoRoot, marker, 'daemon_offline', '引擎不在线，交卷搁浅（牌与牌上信 payload 在盘，等下一拍重试）');
      return null;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    let env;
    try {
      const res = await fetch(`${hit.base}/cmd/post_speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1, cmd: 'post_speech',
          args: {
            job_id: Number(envelope.job_id), wait_key: String(envelope.wait_key),
            soul: String(envelope.soul), payload: String(envelope.payload),
            ...(envelope.node ? { node: String(envelope.node) } : {}),
            body: envelope.body,
          },
        }),
        signal: ctl.signal,
      });
      env = await res.json();
    } finally {
      clearTimeout(timer);
    }
    if (env?.ok && env?.result?.posted) return { id: env.result.letter_id };
    logSubmitFailure(femoRoot, marker, 'post_speech_rejected', env?.error ?? JSON.stringify(env).slice(0, 300));
    return null;
  } catch (e) {
    logSubmitFailure(femoRoot, marker, 'post_speech_unreachable', (e && e.message) || e);
    return null;
  }
}

/** 台词喂 hub 草稿层（提交即上墙；best-effort——幕布绝不挡交卷）。 */
export async function feedDraft(femoRoot, marker, text) {
  try {
    if (!marker?.ref || !Number.isFinite(Number(marker.job_id))) return;
    const hub = await importCore('hub-client.mjs');
    const core = await importCore('hub-feed-core.mjs');
    // 帧对（drop 清槽再放全量）与竞速上界唯一活在 hub-feed-core（web 网页席
    // 同吃——2026-09-29 收编，此前两宿主各手搓一份同构小喂送机）。
    await core.postFeedFramesBounded(`${hub.hubBaseUrl(femoRoot)}/feed`, {
      job_id: Number(marker.job_id),
      source: HOST_ID,
      frames: core.draftDropDeltaFrames(marker.ref, 'text', text),
    }, 1200);
  } catch { /* 幕布绝不挡运行 */ }
}
