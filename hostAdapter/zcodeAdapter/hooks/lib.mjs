/**
 * lib.mjs — hook 直连客户端共享库（常驻化第 3 步重写，2026-09-26）。
 *
 * 铁律：4s 预算内必答（hooks.json timeoutMs=4000，超时宿主直接杀进程），
 * 任何异常静默退出——hook 绝不卡会话。**钩子绝不代拉引擎**：
 * daemon 不在线就是插件未活动，全部端点安静放行（空对象=不注入）——钩子的
 * 生命周期只有两秒，等不起 daemon 冷启。
 *
 * 直连拓扑（旧链路钩子→网关 HTTP→桥，网关与 gateway.port 共享纸随转发壳退役）：
 *   · 取信   —— 直接跑 mailbox.py receive CLI（本就走磁盘信柜，与网关无关；
 *               【刀2 自取对号】钩子载荷自带 session_id，信带会话号须精确相等才领）
 *   · 注入文案 —— pulled-letter.mjs
 *   · 戏外捕获 —— 直接喂 hub /feed（公共层 hub-feed-core；running 闸=探常驻引擎
 *               /engine/health 的 bound_jobs，探活失败=没在演戏=不录）
 *   · 插话上下文 —— daemon POST /cmd/mail_context（引擎活状态唯一权威在常驻引擎）
 *   · 附身 soul —— hub cast 正身账（公共层 cast-core），本模块不存第二本账
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { findFemoRoot, importCore, dataRoot, HOST_ID } from '../paths.mjs';
import { readMarker, clearMarker, markedSouls, stashTurnEvent, discardTurnSpeech, collectTurnSpeech, submitSpeech, feedDraft, isAnsweredRef, recordAnsweredRef, logAnsweredSkip, recordTurnOpen, recordTurnClose, turnPredatesDeath, rearmCoversDeath, readModelIoRounds, weaveModelIoSteps } from '../runtime/speech-collect.mjs';

export { findFemoRoot };

/** 公共层件按需 import（落点解析唯一出处=paths.mjs，2026-09-28 归拢）。 */
const core = importCore;

/** 本会话的会话 id（钩子侧唯一有 CLAUDE_SESSION_ID 的地方）——随载荷用于自取
 *  对号（信带会话号须精确相等才领）与附身 soul 解析。角色哨兵会话不带。 */
function thisSessionId() {
  // 观察期（2026-09-27 注释退役）：FEMO_ACTOR_SESSION 无子代理化后恒未设，守卫恒不触发。
  // if (process.env.FEMO_ACTOR_SESSION === '1') return undefined;
  return process.env.CLAUDE_SESSION_ID || process.env.ZCODE_SESSION_ID || undefined;
}

/** 从 hook 载荷提取FEMO外台词：transcript.jsonl 单行 {message:{content:[{text}],role}}。
 *  返回 {role, text, sid} 或 undefined（无文件/解析失败/空文本=如实返回，静默跳过）。 */
function extractOutside(payload) {
  try {
    // 观察期（2026-09-27 注释退役）：同 thisSessionId 处，哨兵守卫恒不触发。
    // if (process.env.FEMO_ACTOR_SESSION === '1') return undefined; // 角色哨兵：角色对话不是主Agent台词
    const path = payload?.transcript_path ?? payload?.transcriptPath;
    if (!path || !existsSync(path)) return undefined;
    const raw = readFileSync(path, 'utf8');
    const text = raw.split('\n').filter(l => l.trim().length > 0).map(l => {
      try {
        const line = JSON.parse(l);
        const content = line?.message?.content;
        return Array.isArray(content) ? content.map(c => String(c?.text ?? '')).join('') : '';
      } catch { return ''; }
    }).join('').trim();
    if (text.length === 0) return undefined;
    const role = raw.includes('"role":"user"') ? 'user' : 'main';
    probeOutsideShape(raw, text);
    return { role, text, sid: process.env.CLAUDE_SESSION_ID || undefined };
  } catch { return undefined; }
}

/** 取证探针（2026-09-28，实锤后与疑点一并修）：extractOutside 把 transcript_path
 *  整文件拼一行、role 靠全文子串猜、幂等键=整段哈希——若宿主给的是整场转写
 *  而非末条消息，运行中每次捕获都会把越滚越长的全文重复喂进 hub 会话账本
 *  （哈希每轮都变，src_seq 幂等失效）。记录行数/字节数/提取长度的真容供真演出
 *  取证（host-history/zcode/capture-probe.jsonl，超 256KB 重开）；写失败不抛
 *  ——探针绝不让捕获炸。 */
function probeOutsideShape(raw, text) {
  try {
    const pp = join(dataRoot(findFemoRoot()), 'host-history', 'zcode', 'capture-probe.jsonl');
    try { if (statSync(pp).size > 262144) unlinkSync(pp); } catch { /* 无账 */ }
    mkdirSync(dirname(pp), { recursive: true });
    appendFileSync(pp, JSON.stringify({
      at: new Date().toISOString(),
      sid: process.env.CLAUDE_SESSION_ID || '',
      bytes: raw.length,
      lines: raw.split('\n').filter(l => l.trim().length > 0).length,
      textLen: text.length,
    }) + '\n', 'utf8');
  } catch { /* 旁挂 */ }
}

/** 常驻引擎探活（**只探不拉**——钩子等不起冷启）：双验正身=公共层
 *  probeDaemon（2026-09-29 收编：此前本函数手抄半截谓词，漏 /health 面，
 *  与 DaemonClient._probe 两份必漂）。quiet404=旧版 v0 daemon（引擎面 404）
 *  安静放行——钩子纪律：绝不代拉引擎、daemon 不在线就是插件未活动。 */
async function daemonBase() {
  const root = findFemoRoot();
  const { probeDaemon } = await core('daemon-client.mjs');
  const hit = await probeDaemon(root, { quiet404: true, timeoutSec: 1 });
  return hit ? { base: hit.base, health: hit.health } : null;
}

/** FEMO外捕获（钩子直喂 hub）：running 闸=常驻引擎 bound_jobs 非空——运行中才录，
 *  闲时全录会把普通聊天混进历届主会话。best-effort：短超时竞速，失败静默
 *  （src_seq 幂等，重发不重账）。 */
async function captureOutside(outside) {
  try {
    const text = String(outside?.text ?? '').trim();
    if (text.length === 0) return;
    const hit = await daemonBase();
    if (!hit || !Array.isArray(hit.health?.bound_jobs) || hit.health.bound_jobs.length === 0) return;
    const sid = String(outside?.sid ?? 'femo-main');
    const srcSeq = `zcap:${sid}:${createHash('sha1').update(text).digest('hex').slice(0, 16)}`;
    const { outsideRowOp, postFeedFrames } = await core('hub-feed-core.mjs');
    const { hubBaseUrl } = await core('hub-client.mjs');
    const frame = outsideRowOp({
      role: outside.role === 'user' ? 'user' : 'main',
      actor: outside.role === 'user' ? '用户' : '主Agent',
      text, src_seq: srcSeq,
    });
    await Promise.race([
      postFeedFrames(`${hubBaseUrl()}/feed`, {
        session: sid.includes(':') ? sid : `${HOST_ID}:${sid}`,
        source: HOST_ID,
        frames: [frame],
      }),
      new Promise(r => setTimeout(r, 800)),              // 幕布是旁挂：不拖钩子应答
    ]);
  } catch { /* 旁挂失败静默 */ }
}

/** 拉信 soul 解析：显式 body.soul 优先；之后按序查本窗口灵魂——
 *  ① soul-hints.json（MCP possess 落账时写的投递缓存，即时新鲜——hub 正身账
 *     延迟落盘、查 hub HTTP 又会顶破 4s 钩子寿命，双实证）；
 *  ② cast-preferences.json（hub 落盘账，可能滞后但聊胜于无）；
 *  会话号缺失（如后台任务唤起的钩子周期）退唯一在牌灵魂兜底（单窗单魂设计内）；
 *  都没有 → 'main'。
 *  【2026-09-29 收编】两级读口单源 session-registry.readSoulHint（写口也在
 *  那件里）——此前本函数自拆账本形状，格式知识溢出到第三个知情人。 */
async function pullSoulOf(body) {
  if (body.soul) return String(body.soul);
  const sid = body.session_id;
  if (!sid) {
    const souls = markedSouls(findFemoRoot());
    return souls.length === 1 ? souls[0] : 'main';
  }
  const dataDir = dataRoot(findFemoRoot());
  const { readSoulHint } = await core('session-registry.mjs');
  return readSoulHint(join(dataDir, 'host-history', 'zcode', 'soul-hints.json'),
    dataDir, HOST_ID, sid) ?? 'main';
}

// 直取驿站 CLI 已随轮末代领退役（2026-09-28）：信柜的消费归 femo-possess 进程。

/** 查询端点并原样输出其 JSON（空对象 = 不注入）。
 *  stdin 载荷（宿主给的 hook JSON）带 session_id / outside 上行语义不变。 */
export async function relay(endpoint) {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { stdin += d; });
  process.stdin.on('end', async () => {
    try {
      let payload;
      try { payload = JSON.parse(stdin || '{}'); } catch { payload = {}; }
      payload.session_id = thisSessionId();
      payload.outside = extractOutside(payload);
      const out = endpoint === 'stop-intent'
        ? await onStopIntent(payload)
        : endpoint === 'mail-context'
          ? await onMailContext(payload)
          : endpoint === 'turn-collect'
            ? await onTurnCollect(payload)
            : {};
      if (out && Object.keys(out).length > 0) process.stdout.write(JSON.stringify(out));
    } catch (e) {
      // 留痕不静默：钩子异常只进 stderr（宿主忽略 stderr，不影响应答）——
      // 2026-09-26 收卷 bug 全靠这条才查得动，静默吞错是 bug 的藏身处。
      try { console.error('[femo-hook] ' + String((e && e.stack) || e)); } catch { /* 连 stderr 都不给就真没了 */ }
    }
    process.exit(0);
  });
}

/** PostToolUse 钩子（回合内收集，2026-09-27 全程收集改版）：表演回合进行中，
 *  每次工具边界把过程料折进本回合收集文件（stashTurnEvent）。闸=本席挂牌——
 *  无牌的回合（普通聊天、领拍之前）零收集零开销。失败静默：收集是 best-effort，
 *  丢了过程料最多 steps 缺步，绝不卡宿主工具调用。 */
async function onTurnCollect(payload) {
  const root = findFemoRoot();
  const sid = payload?.session_id;
  const pullSoul = await pullSoulOf(payload);
  const soul = readMarker(root, pullSoul, sid) ? pullSoul
    : (pullSoul !== 'main' && readMarker(root, 'main', sid)) ? 'main' : null;
  if (!soul) return {};
  const p = payload || {};
  const pick = (...keys) => { for (const k of keys) { if (p[k] !== undefined) return p[k]; } return undefined; };
  stashTurnEvent(root, soul, {
    toolName: pick('tool_name', 'toolName'),
    toolInput: pick('tool_input', 'toolInput'),
    toolOutput: pick('tool_response', 'toolResponse', 'tool_output', 'toolOutput'),
    transcriptPath: pick('transcript_path', 'transcriptPath'),
  });
  return {};
}

/** Stop 钩子：交卷（表演回合收尾）；顺手 FEMO外捕获（Stop=主Agent最后一句
 *  完整回复；演出回合不入会话账本——台词已按节点行经引擎投影，再录就是双份）。
 *  【2026-09-28 换轨】信的投递/消费归 femo-possess 进程（领拍即取信、渲染进
 *  唤醒通知）——轮末「取信→注入→挂新牌」检查已退役，本钩子只认牌收卷，
 *  不碰信柜、不注入、不拦回合。 */
async function onStopIntent(payload) {
  const root = findFemoRoot();
  const pullSoul = await pullSoulOf(payload);
  const sid = payload.session_id;
  let performed = false;
  const markerSoul = pullSoul !== 'main' ? [pullSoul, 'main'].find(s => readMarker(root, s, sid)?.ref) : (readMarker(root, pullSoul, sid)?.ref ? pullSoul : null);
  const marker = markerSoul ? readMarker(root, markerSoul, sid) : null;
  // 唤醒轮判别（2026-09-29，落账口径=收集窗口自哨兵死讯起）：牌可能是本回合
  // 开着的时候挂上的（导演开演拍：架进程+flow_start 同回合，信在回合中途到
  // 站、死讯写牌）——死讯落在回合中间=本回合不是死讯唤醒的那一轮，照常收卷
  // 会把回合开头的话误当台词、真拍子连台词带工具轮整轮漏收（Job 2643 实证：
  // 开演报告被收成 [speak]）。判陈则只捕戏外，牌和过程料原样留给死讯唤醒的
  // 那一轮。
  const staleWomb = marker ? turnPredatesDeath(root, sid, Date.parse(marker.delivered_at ?? '')) : false;
  // 重架判别（2026-09-29）：死讯落在回合中间原本一律留给「唤醒轮」，但模型若
  // 已在回合内亲手重架哨兵（先架哨兵后开口），死讯通知就是被本回合消化的——
  // 不再有下一轮唤醒，本回合就是唤醒轮，照常收卷（2645 首拍实证：导播窗开演
  // 即给自己发拍，信在回合中途到站、模型回合内读完并开口，旧判据把台词留给
  // 一个不存在的下一轮，滞留两小时直到人工戳窗）。会话号与死讯时刻双对号才认。
  const wokenInTurn = staleWomb && markerSoul
    ? rearmCoversDeath(root, markerSoul, sid, Date.parse(marker.delivered_at ?? ''))
    : false;
  if (marker?.ref) {
    if (!staleWomb || wokenInTurn) {
      if (wokenInTurn) {
        try { console.error(`[femo-hook] 死讯落在回合中间，但回合内已重架哨兵——本回合即唤醒轮，照常收卷（${marker.ref}）`); } catch { /* */ }
      }
      // 已答防重（2026-09-28，清单 §六缺口②；判据细化 2026-10-06）：同一封信
      // 重复送达让领拍又挂了一块牌时，交卷过一次的**这封信**直接撤牌不重演。
      // 键必须带信 id（marker.letter.id）——引擎续跑后拍子编号重计、ref 同场
      // 复用，粗键 (job, ref) 会把新拍当重复拍吞掉（j2716 实案）；引擎容忍
      // 重复 ref，同号异信照常交卷，喂不进由引擎出站口响亮记死信。
      if (!isAnsweredRef(root, marker.job_id, marker.ref, marker.letter?.id)) {
        // 全程收集（2026-09-27）：回合内 PostToolUse 攒的过程料 + 末条消息转写
        // 两路折叠、按行去重、分类——思考/工具按发生序进 steps，台词自立末步 reply。
        const said = collectTurnSpeech(root, markerSoul, payload.transcript_path);
        // 思考第三路源（2026-09-29）：思考在钩子观测面结构性不可见（PostToolUse
        // 只有工具轮、转写只装末条），cot 从此按收卷窗口读宿主 rollout wire 日志
        // 补齐（response.reasoningText/text 逐轮都有）——按调用数对齐织入，旁挂
        // 不挡收卷。末轮 text=已收的台词正身，置空不重折。
        let turnModelId = '';
        try {
          const rounds = readModelIoRounds(sid, Date.parse(marker.delivered_at ?? '') || 0,
            m => { try { console.error(`[femo-hook] ${m}`); } catch { /* */ } });
          if (rounds.length > 0 && said?.steps) {
            rounds[rounds.length - 1].text = '';
            said.steps = weaveModelIoSteps(said.steps, rounds);
          }
          // model_id 落账（2026-10-02 存储层）：收卷窗口内最后一轮的 wire model
          // （{modelId, providerId}）拼 provider/model——窗口内多轮（工具调用
          // 换模型）以最后一轮为准：落账语义=「说出最终台词的那次调用」。
          const lastRound = rounds[rounds.length - 1];
          const mid = lastRound?.model ?? null;
          turnModelId = mid && mid.modelId
            ? (mid.providerId ? `${mid.providerId}/${mid.modelId}` : String(mid.modelId))
            : '';
        } catch (e) { try { console.error(`[femo-hook] modelio weave failed: ${e.message}`); } catch { /* */ } }
        if (said?.text?.trim()) {
          // 先上墙、后交卷（2026-09-28 换刀定序）：草稿喂在 submit 之前——引擎吸收
          // 必然发生在草稿之后，落账前墙上必有字（旧序「先交卷后喂」里吸收能抢在
          // 喂稿前落地，草稿永久缺席，speech-draft 冒烟 1/3 假红实证）。喂稿失败
          // 不挡交卷（幕布是旁挂）；提交失败的残留草稿由下一拍 drop 覆写。
          await feedDraft(root, marker, said.text);            // 提交即上墙（best-effort，自带竞速上界）
          const receipt = await submitSpeech(root, marker, said.text, said.steps, turnModelId); // 交卷（信封=公共层 executorSpeechArgs；modelId 落账）
          // 交卷成功才记已答：失败=节拍还在，宁多演一圈也不吞拍。
          if (receipt !== null) await recordAnsweredRef(root, marker);
          performed = true;
          // 台词真的交出去了才闭合窗口（2026-09-29）：牌与过程料在交卷成功前
          // 保留——纯工具回合/交卷失败时收集窗口继续开，下一回合续折（引擎
          // 3600s 兜底封顶）。旧版无条件撤牌，空台词回合会把牌清掉，beat 从此
          // 永远等不到台词（2643 邻窗过户实证）。
          if (receipt !== null) {
            clearMarker(root, markerSoul, sid);
            discardTurnSpeech(root, markerSoul);
          }
        }
        // said 空（本回合没说出台词）：同上，窗口继续开，牌留着
      } else {
        logAnsweredSkip(root, marker);                       // 撤牌留痕（应交未交必有账）
        clearMarker(root, markerSoul, sid);                  // 已答过：清残牌
        discardTurnSpeech(root, markerSoul);
      }
    } else {
      try { console.error(`[femo-hook] 收卷跳过：牌（${marker.ref}）挂在本回合开场之后，且回合内未见重架——死讯落在回合中间，留给唤醒轮`); } catch { /* */ }
    }
  }
  // 捕获必须 await（内部自带 800ms 竞速上界）：钩子进程应答完即退出，
  // fire-and-forget 的喂行 POST 会随进程一起死（旧世界捕获住在长命的 MCP 里）。
  if (!performed) await captureOutside(payload.outside);
  recordTurnClose(root, sid);                            // 回合关闭游标（唤醒轮判据用）
  return {};
}

/** UserPromptSubmit 钩子：用户FEMO中插话——流程运行中才注入引擎剧情速览；
 *  顺手捕获用户原话（running 闸同 Stop）。
 *  【2026-09-28 换轨】提交登记（谁刚按回车）与认领消费随 possess 直达式退役
 *  ——附身走 femo-possess 进程自证，登记簿不再有消费方。 */
async function onMailContext(payload) {
  recordTurnOpen(findFemoRoot(), payload.session_id);    // 回合开场游标（唤醒轮判据用）
  await captureOutside(payload.outside);                 // 同 onStopIntent：有界等待
  const hit = await daemonBase();
  if (!hit) return {};                                   // 引擎不在：无事发生
  const askSoul = await pullSoulOf(payload);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(hit.base + '/cmd/mail_context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, cmd: 'mail_context', args: { soul: askSoul, session: payload.session_id || '', _caller_host: HOST_ID } }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    const env = await res.json();
    const text = env?.ok ? String(env.result?.text ?? '') : '';
    if (!text) return {};
    return { additionalContext: `[femo] ${text}（用户这句话可能是在FEMO中对你说话，结合剧情回应。）` };
  } catch { return {}; }
}
