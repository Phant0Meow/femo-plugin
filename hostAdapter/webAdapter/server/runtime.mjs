/**
 * runtime.mjs — femo 宿主运行时总装（网页版宿主绑定层）。
 *
 * 拓扑（对标 autoclaw runtime 的总装，物理形态换成「角色席」）：
 *
 *   bridge(引擎) ──事件──► event-core 分诊台 ──幕布──► board（v1 空壳+runlog）
 *        ▲                    └─ai_request 分流─► 主Agent席 / 角色席（seats.mjs）
 *        └── post_speech / actor_failed / collect_notices（宿主命令）
 *
 *   mail_courier ──POST /femo-plugin/mailbox-push──► mailbox-push 分流
 *        （终局整包/启动通知/重试牌 → 操作台；任务面单 → 席位下发）
 *
 * 「怎么真的驱动一个角色」在本宿主的答案：把 FEMO 任务文本写进绑定的网页会话
 * 输入框，等它把话说完，整段收回交引擎。回合簿记（在飞表、超时裁决、恰一
 * 次下发）住本文件；席位状态账住 seats.mjs；网页端的字怎么进、话怎么等，
 * 住 Chrome 扩展（站点包 sites/chat.deepseek.com/content.js）。
 *
 * 回合时序（顺次模型，2026-10-02 用户三锤定案；全场同一时刻至多一个在飞回合）：
 *   下发 →〔顺次闸忙？ 排队（FIFO，且不解析座位——轮到才看活着没）〕→ 轮到：
 *        解析座位（在线直发；休眠经唤醒闸 reload 叫醒，至多一次）→ 推进扩展
 *        下行队列 → 扩展回「已发送」→〔生成中〕→ 扩展回「整段回复」→ 交回
 *        引擎 → 顺次闸放下一个
 *   顺次的理由（作者原话）：「运行中的时候，如果有并发，这样子轮询还是不好，
 *   容易被网站风控」「只 reload 一次，一直活动到收到完整的结束信号为止。然后
 *   再去看下一个活着没，如果没有活着就 reload」「reload 操作之前要检查那个
 *   页面活着没？如果本来就活着就不用 reload 了」。剧本外角色永不 reload
 *   ——注册巡检零 reload（reload 名单=mailbox 在飞收件人，前锤裁决继续成立）。
 *   回合中静默阶梯（2026-10-02 用户定案「收不到内容 30 秒自动 reload」）：
 *   帧推进即武装静默看护（发送期一起管），判据是「收不到内容」不是「ping 不
 *   通」——已发送/流式 delta 都算内容（lastSignAt）。静默 30s → 自动 reload
 *   **恰一次**（不探活：能 30s 无内容还 ping 得通的页恰是假活——网络闸死/收话
 *   判定卡死，reload 正是救法；正常生成 delta 400ms 一拍绝不会触发；对话在网
 *   站服务端，reload 无损，回合领养接回收话）；reload 过了还没内容（静默满
 *   60s）→ 弹提醒喊人**恰一次**（只喊不切焦点，点开即醒）；此后就等着——
 *   不再有任何动作（不 reload 循环：防风控暴露、防页面没冷加载完又被 reload）。
 *   超时三道（2026-10-02 用户拍板「超时永不挂起」）：执行保险丝 3000s（帧推
 *   进起算、「已发送」不清零，连生成期一起管）到点**不判死**——交 ⚠️ 占位
 *   台词收卷跳过该节点，剧本继续跑；整轮兜底 60 分钟（含排队滞留）同款跳过。
 *   全程红线（作者原话）：「所有这种场合，都不许结束 femo，不是 error……切个
 *   页面就救活了算什么 error」——唤醒失败/发送失败/收话失败一律降级留痕等保
 *   险丝，只有活页面报上来的真 error 才走 actor_failed（引擎挂起可续，契约不动）。
 *   运行泵（后台，非阻塞）与 autoclaw 同构：泵只在「人类回合/终态」时让路。
 */

import { createEventCore } from '../../../femo2host/host/event-core.mjs';
import { siteById } from '../sites.mjs'; // model_id 落账换算：site → web:<SITE_LABEL>
import { isStopSignal, formatStopNotice } from '../../../femo2host/host/notice-core.mjs';
import {
  buildSubagentPrompt, readSoulPersona,
} from '../../../femo2host/host/subagent-core.mjs';
import { sendActorFailure } from '../../../femo2host/host/daemon-client.mjs';
import { hasOutVars } from '../../../femo2host/host/hub-render-core.mjs';
import { waitingHumanFromEvent } from '../../../femo2host/host/run-state-core.mjs';
import { draftDropDeltaFrames, postFeedFramesBounded } from '../../../femo2host/host/hub-feed-core.mjs';
import { hubBaseUrl } from '../../../femo2host/host/hub-client.mjs';
import { HOST_NAME } from './bridge.mjs';
import { createBoard } from './board.mjs';
import { createSeatBoard } from './seats.mjs';
import { createMailboxPush } from './mailbox-push.mjs';

const SILENT_RELOAD_MS = 30_000; // 静默阶梯①：30s 收不到任何内容（已发送/delta 都算内容）→ 自动 reload 唤醒，一回合恰一次
const SILENT_REMIND_MS = 60_000; // 静默阶梯②：reload 过了还没内容（静默满 60s）→ 弹提醒喊人恰一次，此后就等着
const SILENT_RESCUE_MS = 120_000; // 静默阶梯③（2026-10-02 用户拍板「追加」）：提醒过了还没内容（静默满 120s）→ 救援 reload 恰一次——四次实案（2683/2684/2687 豆包、2687 DeepSeek）证明冻结快过流程，一次 reload 的活跃窗口不够走完发送+收话；已发送的回合生成在网站服务端继续跑、回复躺在会话历史里，救援 reload 让页面再活几秒走 hello 领养→DOM 收全文。风控账：回合 reload 总数 ≤2，且只对帧已推进的回合（park 漂账不进阶梯，维持现状）
const EXEC_FUSE_MS = 3_000_000;  // 执行保险丝 3000s（2026-10-01 拍板节点超时）：帧推进起算、「已发送」不清零；到点跳过不挂起（2026-10-02 二次拍板「超时永不挂起」）
const SEND_ACTIVE_GRACE_MS = 45_000; // hello 跨标签页认领的宽限窗（j2713 豆包实案）：回合推进后这么久内还有活气（send-failed 的 15s 自动重试也算活气）=现役页正在发送，别的标签页来 hello 不许接走帧——双开的两页同发一句话会打两遍；活气静默超过它=现役页八成死了，换页接管照旧放行
const RETRY_HELLO_MS = 30_000;       // 被拒的标签页过多久再来认领一次（现役页若真死了，接管最迟约两拍后发生；回合收场后认领自然落空、循环自停）
const TURN_TIMEOUT_MS = 60 * 60_000; // 整轮兜底（含排队滞留），对齐引擎 3600s；到点同款跳过——真 error 才挂起
const FLUSH_COOLDOWN_MS = 400;   // 席位空闲后补发队头的节流（给网页一点喘息）

// ── 逐字流（草稿轨）：网页席的生成中快照喂 hub 草稿层 ──────────────────
// 两轨纪律：这里只旁路上墙，交卷轨（reply → submitOutput）独占收口——引擎
// 落账那拍 hub 自动吸收同 kind 草稿，不双份；闭段拒收、重放清残也都是 hub
// 的现成闸。帧对（drop 清槽再放全量）与竞速上界唯一活在公共层 hub-feed-core
// （zcode 收卷器同吃）；只报 wait_key 绝不自造段键（段键构造唯一活在 hub 一处）。
const DRAFT_FEED_TIMEOUT_MS = 1200; // 竞速上界：幕布绝不挡运行
function feedDraftToHub(turn, snap) {
  const waitKey = String(turn?.waitKey ?? '');
  const jobId = Number(turn?.jobId);
  if (!waitKey || !Number.isFinite(jobId) || !jobId) return;
  const frames = [
    ...draftDropDeltaFrames(waitKey, 'reasoning', snap.thinking),
    ...draftDropDeltaFrames(waitKey, 'text', snap.content),
  ];
  if (!frames.length) return;
  void postFeedFramesBounded(`${hubBaseUrl()}/feed`, { job_id: jobId, source: HOST_NAME, frames }, DRAFT_FEED_TIMEOUT_MS);
}

/**
 * @param {object} opts
 * @param {object} opts.bridge   FemoBridge（本函数接线其 onEvent）
 * @param {(msg:string)=>void} [opts.log]
 * @param {(connId:string, frame:object)=>boolean} opts.deliverFrame
 *     把一帧下发塞进扩展下行队列（service.mjs 的长轮询队列）；连接不在= false。
 * @param {object} [opts.surface] 操作台出口（没设主Agent席/人类等待/终局/开跑通知）：
 *     { onStopNotice({jobId,outcome,notice}), onMainBrief(brief), onHumanWait(h),
 *       onPlayStart({jobId,text}), onMainRetry({waitKey,feedback,attempt}) }
 * @param {(sessionId:string)=>Promise<boolean>} [opts.wakeSeat] 主Agent席按需唤醒
 *     （service 注入：走唤醒闸，reload/开页+等上线）——主席在册休眠时先唤醒再派；
 *     没注入或唤醒超时就照旧挂队。角色席与重试牌走 resolveSeat（自带唤醒）。
 * @param {(turn:object, snap:{thinking:string,content:string})=>void} [opts.draftFeed]
 *     逐字流草稿喂送（缺省 feedDraftToHub 打真 hub；测试注入记录桩）。
 * @param {(frame:object)=>boolean} [opts.broadcastFrame] 广播兜底口（service 注入）：
 *     定向 connId 陈旧（浏览器整重启后换新）时把提醒帧发给全体连接。
 * @param {number} [opts.silentReloadMs] 静默 30s reload 线（测试拨快）。
 * @param {number} [opts.silentRemindMs] 静默 60s 提醒线（测试拨快）。
 * @param {number} [opts.execFuseMs] 3000s 执行保险丝时长（测试拨快）。
 * @param {number} [opts.turnTimeoutMs] 整轮兜底时长（测试拨快）。
 * @param {number} [opts.sendGraceMs] hello 跨标签页认领的宽限窗（测试拨快）：
 *     回合推进后这么久内现役页还有活气（含 15s 自动重试的 send-failed），
 *     别的标签页来 hello 不接走帧（防双页同发）；活气静默超过它=换页接管放行。
 * @param {number} [opts.retryHelloMs] 被拒标签页的重认领间隔（测试拨快）。
 */
export function createFemoRuntime({ bridge, log = () => {}, deliverFrame, surface = {}, resolveSeat, wakeSeat = null, draftFeed = null, broadcastFrame = null, silentReloadMs = SILENT_RELOAD_MS, silentRemindMs = SILENT_REMIND_MS, silentRescueMs = SILENT_RESCUE_MS, execFuseMs = EXEC_FUSE_MS, turnTimeoutMs = TURN_TIMEOUT_MS, sendGraceMs = SEND_ACTIVE_GRACE_MS, retryHelloMs = RETRY_HELLO_MS }) {
  const board = createBoard({ log });
  const seats = createSeatBoard({ log });
  const rt = { router: undefined, push: undefined, humanWait: undefined, lastEventAt: 0 };
  const feedDraft = draftFeed ?? feedDraftToHub;

  /** 座位解析缺省实现：没有注入解析器就大声失败（hub cast 账是唯一正身，
   *  service.mjs 注入真实现=readJobCast+preferencesView 回退）。 */
  resolveSeat ??= function defaultResolveSeat() {
    throw new Error('resolveSeat 未注入（hub cast 账解析器缺失）');
  };

  /** 在飞回合表：deliveryId → turn（领域锚 = `${jobId}/${waitKey}/${attempt}`） */
  const inflight = new Map();

  // ── 已终局回合短账（防双来路重放，2026-10-02 实案）────────────────────
  // actor 任务有「引擎事件现场」与「mailbox push 面单」两个来路：在飞时靠
  // inflight 挡重复，但交卷删账之后第二来路才到，同 deliveryId 就原样再发一遍
  // （实案：DeepSeek 交卷后 8ms 第二帧推进，同一句话连说两遍）。dropTurn 是
  // 唯一终局口，落账在此；账目 10 分钟过期（长于任何合法重派的间隔）。
  const doneLedger = new Map();
  /** wait_key 指纹（`job/wait_key`）→ 上一回合的 {soul, sessionId, at}：
   *  重试牌座位解析的权威记忆。引擎 node_retry 信不带面单（brief 只在首发
   *  料包里），retry.actor_name 是「@角色名（灵魂名）」显示形态、选角账按
   *  soul id 键——拿它查账必落空，重演就到不了网页。首发必经本进程
   *  （引擎只在收到交卷后才发重试牌），上一回合的 soul 是唯一靠得住的来源。
   *  与 doneLedger 同窗过期（10 分钟，远长于重试牌的到达间隔）。 */
  const doneByWait = new Map();
  function markTurnDone(turn) {
    const now = Date.now();
    doneLedger.set(turn.deliveryId, now);
    // 只记真到过席位的回合（park 漂账 sessionId 空、soul 还是没解开的显示名，
    // 记进去只会毒化下一次重试的座位解析）。
    if (turn.sessionId) doneByWait.set(`${turn.jobId}/${turn.waitKey}`, { soul: turn.soul, sessionId: turn.sessionId, at: now });
    for (const [id, t] of doneLedger) if (now - t > 600_000) doneLedger.delete(id);
    for (const [k, t] of doneByWait) if (now - t.at > 600_000) doneByWait.delete(k);
  }
  function doneTurnFor(jobId, waitKey) {
    const t = doneByWait.get(`${Number(jobId ?? 0)}/${String(waitKey ?? '')}`);
    if (!t) return undefined;
    if (Date.now() - t.at > 600_000) return undefined;
    return t;
  }
  function isTurnDoneRecently(deliveryId) {
    const t = doneLedger.get(deliveryId);
    if (!t) return false;
    if (Date.now() - t > 600_000) { doneLedger.delete(deliveryId); return false; }
    return true;
  }

  // ── 显示名 → soul id 正身（2026-10-06，重试牌座位阶梯的补级）────────────
  // 引擎 ai_request 同时带 actor_name（「@角色名（灵魂名）」显示形态）与
  // actor_info.soul（正身），重试牌只带前者——记下这份对照，重试牌的座位解析
  // 就多一级靠得住的来源。doneByWait 只记「真到过席位」的回合，补这一级补的
  // 正是那些**没到过席位**的首发：唤醒失败落 park、以及绑定在别家宿主（信按
  // 设计留驿站等对方自取，本宿主一步都不动）。没有它，这些灵魂的重试牌拿显示
  // 名查选角账必落空，又被当成唤醒失败弹横条（别家灵魂的假警报同款，2026-10-06
  // 用户实报）。同 10 分钟窗过期——重试牌只在收到交卷后几分钟内到。
  const soulByActorName = new Map();
  function rememberActorName(actorName, soul) {
    const name = String(actorName ?? '');
    if (!name || !soul) return;
    const now = Date.now();
    soulByActorName.set(name, { soul: String(soul), at: now });
    for (const [k, v] of soulByActorName) if (now - v.at > 600_000) soulByActorName.delete(k);
  }
  function soulOfActorName(actorName) {
    const name = String(actorName ?? '');
    const e = soulByActorName.get(name);
    if (!e) return undefined;
    if (Date.now() - e.at > 600_000) { soulByActorName.delete(name); return undefined; }
    return e.soul;
  }

  // ── 顺次闸（2026-10-02 用户三锤定案「顺次进行」）──────────────────────
  // mailbox 任务到网页席位一律一个一个来：同一时刻至多一个任务占闸，占闸段=
  // 「解析座位（在线直发/休眠经唤醒闸 reload 一次）→推帧→回合收场」。并发
  // 轮转查岗容易被网站风控，顺次把 reload 压到每任务至多一次、页面一次只醒
  // 一个。三条纪律：
  //   · 闸忙时排队**不解析座位**——「轮到才看活着没」，不在闸外提前唤醒下一页
  //    （提前 reload 了排队期间又冻回去，白 reload 还多一次风控暴露）；
  //   · 释放权唯一归 dropTurn（reply/error/失败/停演四路终局全经它）——占闸者
  //     一旦真接手了回合（推进或挂席位队），只有回合收场才放闸；
  //   · 进闸后没接手回合的失败路径（解析座位失败等）自己放（幂等）。
  let seqActive = null;   // 当前占闸的 deliveryId
  const seqQueue = [];    // [{deliveryId, fn}]——FIFO
  function runGateTask(deliveryId, fn, rethrow) {
    return (async () => {
      let handedOff = false;
      try {
        const r = await fn();
        handedOff = Boolean(r?.accepted); // 真接手（推进或挂队）=释放权归 dropTurn
        return r;
      } catch (e) {
        if (rethrow) throw e;
        log(`sequential gate: queued task failed: ${String(e).slice(0, 200)}`);
        return undefined;
      } finally {
        if (!handedOff) releaseSeqSlot(deliveryId);
      }
    })();
  }
  /** 进闸：闸空=当场执行（promise 等到派发结果）；闸忙=排队并立即回
   *  {accepted:true, queued:true}（真派发等前一个回合收场）。
   *  同 id 拒之门外（2026-10-02 DeepSeek 实案补的第四道闸）：双来路面单的第一
   *  路占闸后卡在 75s 唤醒窗里——inflight 还没立账，第二路的闸外查重放行、在闸
   *  里排队；第一路唤醒失败 park 立账、放闸，第二路进闸才在 dispatchToSeat 撞
   *  duplicate——**静默**返回，节点就此只剩 park 漂账干等保险丝。门口先查同 id
   *  （占闸者/排队者），响亮拒绝。 */
  function enterTurnGate(deliveryId, fn) {
    if (seqActive === deliveryId || seqQueue.some(e => e.deliveryId === deliveryId)) {
      log(`sequential gate: duplicate rejected at door（同 id 已占闸或排队）: ${deliveryId}`);
      return Promise.resolve({ accepted: false, reason: 'duplicate' });
    }
    if (seqActive) {
      seqQueue.push({ deliveryId, fn });
      return Promise.resolve({ accepted: true, queued: true });
    }
    seqActive = deliveryId;
    return runGateTask(deliveryId, fn, true);
  }
  /** 放闸（幂等）：只认当前占闸者；放闸即唤醒队头。 */
  function releaseSeqSlot(deliveryId) {
    if (seqActive !== deliveryId) return;
    seqActive = null;
    const next = seqQueue.shift();
    if (next) {
      seqActive = next.deliveryId;
      void runGateTask(next.deliveryId, next.fn, false);
    }
  }

  /** 按会话找在飞回合（领养用）：席位内串行保证至多一个；旧页可能还报裸 id
   *  （无前缀）——宽松对，与席位账 bySessionLoose 同姿势。 */
  function turnForSession(sessionId) {
    const id = String(sessionId ?? '');
    if (!id) return undefined;
    for (const t of inflight.values()) if (t.sessionId === id) return t;
    if (id.includes(':')) return undefined;
    for (const t of inflight.values()) if (t.sessionId.endsWith(`:${id}`)) return t;
    return undefined;
  }

  rt.router = createEventCore({
    sid: 'web-main',
    send: (cmd, args, timeoutMs) => bridge.send(cmd, args, timeoutMs),
    // 分诊台 v2 默认单通道纯记账；本 runtime 是「事件现场下发+拉取队列」的
    // v1 契约（pump/操作台应答吃队列）——与 autoclaw 同款显式 legacy 挂法。
    dispatch: 'queue',
    log,
    board,
  });

  /** 拆队头残留的 human_wait 拍（queue 遗留账，四处对账共用一具）：mode=
   *   'match'   → 只拆与 key 同拍的（交卷对账：这一拍使命已完成）
   *   'differs' → 只拆与 key 不同拍的（新等待到场，旧头是残留账）
   *   'any'     → 队头是 human_wait 就拆（等待终结/停场清账） */
  function takeHumanWaitHead(mode, key = '') {
    const h = rt.router.head();
    if (h?.kind !== 'human_wait') return;
    const same = String(h.wait_key ?? '') === String(key);
    if ((mode === 'match' && same) || (mode === 'differs' && !same) || mode === 'any') rt.router.takeHead();
  }

  const submitOutput = (jobId, waitKey, output, steps, soul, modelId) => rt.router.submitOutput(jobId, waitKey, output, steps, soul, modelId);
  const submitHumanOutput = (jobId, waitKey, text, soul, variables) =>
    rt.router.submitHumanOutput(jobId, waitKey, text, soul, variables).finally(() => {
      // 交卷落账即对账：队列里这一拍 human_wait 头使命完成（queue 遗留账）。
      // 不取走的话，泵会在镜像被清的窗口里拿残留头把等待态「复活」——卡重亮
      // 甚至永不收（引擎拒收=human_done 永不来）。
      takeHumanWaitHead('match', waitKey);
    });

  rt.push = createMailboxPush({ submitOutput, submitHumanOutput, log });

  // ── 回合簿记 ────────────────────────────────────────────────────────
  const turnId = (jobId, waitKey, attempt) => `${jobId}/${waitKey}/${attempt ?? 0}`;

  function dropTurn(deliveryId) {
    const turn = inflight.get(deliveryId);
    if (!turn) return undefined;
    markTurnDone(turn);
    clearTimeout(turn.execTimer);
    clearTimeout(turn.stallTimer);
    clearTimeout(turn.doneTimer);
    inflight.delete(deliveryId);
    releaseSeqSlot(deliveryId); // 顺次闸：完整结束信号已到（或回合已终局）——放下一个
    if (turn.reminded) {
      // 提醒过的回合走到任何终局（交卷/失败/跳过/中止）都撤掉扩展侧提醒——页面
      // 要么已醒、要么戏已收，都不该再喊人。以前守着 turn.connId 在场才撤：
      // park 降级回合没有 connId（帧从未推进）、浏览器重启后连接换新——两种
      // 场合横条都挂在所有页面撤不掉（「莫名其妙」实锤）。定向不在=广播撤。
      const cancel = { type: 'remind-cancel', deliveryId: turn.deliveryId };
      if (!deliverFrame(turn.connId, cancel)) broadcastFrame?.(cancel);
    }
    // 关单广播（2026-10-02 用户定案「页面不许自设超时」）：回合的所有终局都经
    // 这里，页面侧捏着的回合账/武装着的重试一律凭这帧对齐放手——节点什么时候
    // 结束只有服务端知道（保险丝跳过/停演/失败），页面猜不如听。
    const closed = { type: 'turn-closed', deliveryId: turn.deliveryId };
    if (!deliverFrame(turn.connId, closed)) broadcastFrame?.(closed);
    return turn;
  }

  async function failTurn(turn, kind, message) {
    dropTurn(turn.deliveryId);
    log(`turn FAILED (${kind}): ${turn.actorName} wait_key=${turn.waitKey} — ${message}`);
    try {
      await sendActorFailure(bridge, turn.jobId, turn.waitKey, kind, message);
    } catch (e) {
      log(`actor_failed report also failed: ${String(e).slice(0, 200)}`);
    }
    tryDeliverNext(turn.sessionId);
  }

  /** 超时跳过（2026-10-02 用户拍板「超时永不挂起」）：执行保险丝/整轮兜底到点
   *  ——交 ⚠️ 占位台词收卷，引擎正常落账、剧本继续跑下一个节点。与 failTurn 的
   *  分工：活页面报上来的真 error 才走 actor_failed（挂起可续，契约不动）；「等
   *  不来」的死等只 warning 不掐戏——占位台词随段上墙=投影里看得见的警告。 */
  async function skipTurn(turn, reason) {
    dropTurn(turn.deliveryId);
    log(`turn TIMEOUT-SKIP: ${turn.actorName} wait_key=${turn.waitKey} — ${reason}`);
    const text = `⚠️（执行超时跳过：${reason}）`;
    const soulForEngine = turn.isMain ? 'main' : turn.actorName;
    try {
      await submitOutput(turn.jobId, turn.waitKey, text, undefined, soulForEngine, turn.modelId);
    } catch (e) {
      log(`timeout-skip submitOutput failed: ${String(e?.message ?? e).slice(0, 200)}`);
    }
    tryDeliverNext(turn.sessionId);
  }

  /** 在飞静默看护（2026-10-02 用户四级阶梯定案）：帧推进即武装（发送期一起管），
   *  判据是「收不到内容」不是「ping 不通」——已发送/流式 delta 都算内容
   *  （lastSignAt 活气打点）。阶梯：
   *    ①静默 30s → 自动 reload 恰一次（发 reload-tab 帧，background 直接
   *      tabs.reload，不探活——能 30s 无内容还应答得了的页恰是假活，reload 正是
   *      救法；正常生成 delta 400ms 一拍绝不会触发。reload 后回合领养接回收话）；
   *    ②reload 过了还没内容（静默满 60s）→ 弹提醒喊人恰一次（全页面横条，
   *      只喊不切焦点，点开即醒）；
   *    ③提醒过了还没内容（静默满 120s）→ 救援 reload 恰一次（2026-10-02 用户
   *      拍板「追加」）：已发送的回合生成在网站服务端继续跑、回复躺在会话历史
   *      里，再给一次激活窗口走 hello 领养→DOM 收全文。风控账：回合 reload
   *      总数 ≤2，只对帧已推进的回合（park 漂账不进阶梯）；
   *    ④此后就等着——收钟，不再有任何动作（不 reload 循环：防风控暴露，也防
   *      页面没冷加载完又被 reload）。
   *  3000s 执行保险丝在阶梯之外独立兜底。计时用「检查点重排」不用轮询：每站
   *  按当前 lastSignAt 重算到期时刻，活气刷新基点后到点自会发现没到线、按新
   *  基点重排——活气侧零挂钩。 */
  function armStallWatch(turn) {
    clearTimeout(turn.stallTimer);
    const base = turn.lastSignAt ?? turn.startedAt;
    const due = !turn.stallReloaded ? base + silentReloadMs
      : !turn.reminded ? base + silentRemindMs
      : !turn.rescued ? base + silentRescueMs
      : null; // 阶梯走完：就等着，3000s 保险丝兜底
    if (due == null) return;
    turn.stallTimer = setTimeout(() => stallCheck(turn), Math.max(due - Date.now(), 0));
    turn.stallTimer.unref?.();
  }

  function stallCheck(turn) {
    if (inflight.get(turn.deliveryId) !== turn) return;
    const silent = Date.now() - (turn.lastSignAt ?? turn.startedAt);
    if (!turn.stallReloaded && silent >= silentReloadMs) {
      turn.stallReloaded = true;
      turn.reloadAt = Date.now();
      const frame = turn.frame ?? {};
      log(`turn stall-reload: ${turn.actorName} wait_key=${turn.waitKey} 静默 ${Math.round(silent / 1000)}s 无任何内容——自动 reload（一回合恰一次），回合领养接回收话`);
      const reload = { type: 'reload-tab', deliveryId: turn.deliveryId, tabId: frame.tabId ?? 0, sessionId: turn.sessionId };
      if (!deliverFrame(turn.connId, reload)) broadcastFrame?.(reload);
      armStallWatch(turn); // 下一站：提醒检查点
      return;
    }
    if (!turn.reminded && silent >= silentRemindMs) {
      turn.reminded = true;
      const seat = seats.bySession(turn.sessionId);
      const where = [seat?.title, seat?.siteLabel].filter(Boolean).join('·');
      const name = where ? `「${turn.actorName}」（${where}）` : `「${turn.actorName}」`;
      const msg = `${name}的页面已自动刷新仍未恢复内容，可能是被浏览器冻结了。请在浏览器切换到那个标签页，这样点开就能简单的把他唤醒。`;
      log(`turn stall-remind: ${turn.actorName} wait_key=${turn.waitKey} reload 后仍静默 ${Math.round(silent / 1000)}s——弹提醒喊人（下一站：救援 reload）`);
      const remind = { type: 'remind', deliveryId: turn.deliveryId, tabId: turn.frame?.tabId ?? 0, sessionId: turn.sessionId, message: msg, actor: turn.actorName, soul: turn.soul };
      if (!deliverFrame(turn.connId, remind)) broadcastFrame?.(remind);
      armStallWatch(turn); // 下一站：救援 reload 检查点
      return;
    }
    if (!turn.rescued && silent >= silentRescueMs) {
      turn.rescued = true;
      const frame = turn.frame ?? {};
      log(`turn stall-rescue: ${turn.actorName} wait_key=${turn.waitKey} 提醒后仍静默 ${Math.round(silent / 1000)}s——救援 reload（一回合恰一次，已发送未完成的回合再给一次激活窗口；此后收钟等保险丝）`);
      const reload = { type: 'reload-tab', deliveryId: turn.deliveryId, tabId: frame.tabId ?? 0, sessionId: turn.sessionId };
      if (!deliverFrame(turn.connId, reload)) broadcastFrame?.(reload);
      return; // 收钟：就等着（阶梯④）
    }
    armStallWatch(turn); // 活气刷新过/还没到线——按新基点重排
  }

  /** 执行保险丝 3000s（「已发送」不清零——节点超时按整节点理解，连生成期一起
   *  管）：到点**不判死不挂起**——交 ⚠️ 占位台词跳过该节点，剧本继续跑。
   *  推进和领养重推都要走（重推=新的执行窗口，保险丝重开）；原 30s 提醒钟已
   *  并入静默看护阶梯（提醒挪到 reload 之后）。 */
  function armExecFuse(turn) {
    clearTimeout(turn.execTimer);
    turn.execTimer = setTimeout(() => {
      if (inflight.get(turn.deliveryId) !== turn) return;
      skipTurn(turn, `节点执行超 ${Math.round(execFuseMs / 1000)}s 无果（页面反复被冻结或一直没能把消息发完/收回）`);
    }, execFuseMs);
    turn.execTimer.unref?.();
  }

  /** 帧真正推进扩展队列的那一刻武装计时（排队/暂停不算迟到）。顺次闸在进闸
   *  时已占，推帧只是占闸段的中间动作。 */
  function pushTurn(turn, frame) {
    const ok = deliverFrame(frame.connId, frame);
    if (!ok) {
      // 连接不在了：帧退回席位 pending，标签页重新上线（register）时补发；
      // 整轮兜底仍在走，等不到人就超时跳过（不挂起）。
      seats.enqueuePending(frame.sessionId, frame);
      log(`deliver: conn ${frame.connId} gone — frame parked for ${frame.sessionId.slice(0, 8)}…`);
      return;
    }
    turn.frame = frame;           // 领养重发要用：页重载/重开后 hello 认领，原帧换新页寻址重发
    turn.connId = frame.connId;   // remind-cancel 回程要用（failTurn 时 frame 已不在手上）
    turn.lastSignAt = Date.now(); // 活气原点：静默看护从推进起算（发送期一起管）
    armExecFuse(turn);
    armStallWatch(turn);
  }

  /** 席位空闲：把队头发出去（唯一消费 pending 的地方，同步执行无并发交错）。 */
  function tryDeliverNext(sessionId) {
    const frame = seats.takePending(sessionId);
    if (!frame) return;
    const turn = inflight.get(frame.deliveryId);
    if (!turn) return; // 已被 abort/重复裁决收走的残帧，丢弃
    pushTurn(turn, frame);
  }

  /** 席位空闲后补发队头的节流入口。 */
  function flushSeat(sessionId) {
    if (!seats.pendingCount(sessionId)) return;
    setTimeout(() => tryDeliverNext(sessionId), FLUSH_COOLDOWN_MS);
  }

  /** 下发一个回合到席位：真实执行 = 写网页输入框 → 等它回完 → 整段收回。 */
  async function dispatchToSeat(seat, d, text, meta) {
    const jobId = Number(d.job_id ?? 0);
    const waitKey = String(d.wait_key ?? '');
    const attempt = Number(meta.attempt ?? 0);
    const deliveryId = turnId(jobId, waitKey, attempt);
    if (inflight.has(deliveryId)) {
      log(`dispatch deduped: ${deliveryId} 已有在飞账（不该走到这——进闸门口已拒，留着当最后防线）`);
      return { accepted: false, reason: 'duplicate' };
    }
    if (isTurnDoneRecently(deliveryId)) {
      // 去重必须守在注册漏斗（2026-10-02 实案二改）：双来路面单在闸外查过一次，
      // 但「交卷放闸→排队者进闸」这条路绕过闸外检查——幽灵回合在账上永等结尾，
      // 静默看护反复 reload 健康页、横条常驻不撤（用户看到的就是它）。已交卷
      // 的同 id 面单在这里响亮丢弃（重试牌 attempt 不同 id，不受影响）。
      log(`dispatch deduped (funnel): ${deliveryId} 已交卷，丢弃迟到拍`);
      return { accepted: false, reason: 'duplicate (already completed)' };
    }
    const turn = {
      deliveryId, jobId, waitKey,
      actorName: String(meta.actorName ?? d.actor_name ?? d.node_name ?? 'actor'),
      soul: String(meta.soul ?? seat.soul ?? d.actor_name ?? d.node_name ?? 'actor'),
      sessionId: seat.sessionId,
      isMain: Boolean(meta.isMain),
      // model_id 落账（2026-10-02 存储层）：本回合台词的出处=哪家官网——网页里
      // 模型由网站和用户随时切，site 才是稳定事实；模型名不追（站点包网络闸
      // 将来若能稳定取证再升格 web:<site>/<model>，前缀结构不破）。site→LABEL
      // 换算走站点包契约件 sites.mjs，公共层不掺和站点知识。席位物理账没 site
      // （异常态）不填，引擎落空串——登记制不伪造。
      modelId: seat.site ? `web:${siteById(seat.site)?.SITE_LABEL ?? seat.site}` : undefined,
      startedAt: Date.now(),
    };
    inflight.set(deliveryId, turn);
    // 整轮兜底立即武装（排队滞留也算在戏里）；执行保险丝推进时才武装。
    // unref：保险丝不拖住进程退出（服务长驻无感；测试里残回合不吊住 event loop）。
    turn.doneTimer = setTimeout(() => {
      if (inflight.get(turn.deliveryId) !== turn) return;
      skipTurn(turn, `整轮超 ${Math.round(turnTimeoutMs / 60000)} 分钟未结束（排队滞留或网页端没回完）`);
    }, turnTimeoutMs);
    turn.doneTimer.unref?.();

    const frame = { deliveryId, connId: seat.connId, tabId: seat.tabId, sessionId: seat.sessionId, text, meta: { ...meta, actorName: turn.actorName, soul: turn.soul } };
    if (seat.busy || !seat.online || seats.pendingCount(seat.sessionId) > 0) {
      const r = seats.enqueuePending(seat.sessionId, frame);
      if (!r.queued) {
        await failTurn(turn, 'error', `席位不可下发且挂队失败：${r.reason}`);
        return { accepted: false, reason: r.reason };
      }
      log(`turn queued on seat ${seat.sessionId.slice(0, 8)}…: ${turn.actorName} wait_key=${waitKey} (depth=${r.depth})`);
      // parked 帧也进静默阶梯：busy 卡死（页面的 busy:false 上报会丢——report()
      // 对扩展重载窗口是静默丢弃）或席位掉线时，帧停在队里没有推帧、没有计时，
      // 整场戏最坏干等 60 分钟零动静。30s 静默 → reload 唤醒冻页（复活链：页面
      // 起来 → register → pong 把 busy 清回 false → pokeSeat 补发）→ 60s 提醒
      // →收钟。真推上帧时 pushTurn 会整组重武装（lastSignAt 重记，不冲突）。
      turn.frame = frame;
      turn.lastSignAt = Date.now();
      armStallWatch(turn);
      tryDeliverNext(seat.sessionId); // 刚才只是「看起来忙」，能推就推
      return { accepted: true, queued: true };
    }
    pushTurn(turn, frame);
    return { accepted: true };
  }

  /** 「这封信不是本宿主的活」：resolveSeat 对**绑定在别家宿主**的座位抛错时打的
   *  foreignHost 标记（多宿主共演同一场——本场由 web 开、别家灵魂也在这本选角账
   *  上；引擎产信那一拍已把信改寄对方格留柜等自取，桥侧 foreign_pickup）。判据只
   *  认这个标记、不看文案——与 dsh 侧 mailbox-push 的 foreign host 裁决同款
   *  （「bound to foreign host … letter stays in mailbox for self-pickup」）。
   *  这样的回合**一步都不许动**：不弹提醒横条（横条只服务「web 自己的会话没响应」，
   *  2026-10-06 用户实报的假警报）、不立漂账、不进保险丝、不交占位台词。 */
  function foreignHostOf(e) {
    return String(e?.foreignHost ?? '');
  }

  /** 唤醒失败降级（2026-10-02 用户拍板「这类事不许停引擎」）：解析座位/唤醒页
   *  面失败不上报 actor_failed（那会挂起整场戏）——立回合账、立即弹提醒喊人、
   *  留在账上让执行保险丝到点 ⚠️ 占位跳过。账挂着期间同 deliveryId 的迟到面单
   *  一律拒（duplicate/已交卷短账），引擎不会派新活堵门。
   *  park 回合是「漂账」：帧从未推进、没有 connId、sessionId 留空（早年在这里
   *  seats.list().find(s => s.soul === …) 永远扑空——席位物理账不存 soul，list()
   *  没喂映射；据此立账反而诚实）。hello 领养对不上号、reload 没有目标，静默
   *  阶梯对它无事可做——只挂执行保险丝，不进阶梯。要让它可自愈（页面复活后
   *  经闸重派）得让 hello 重放走顺次闸，另立账再议。 */
  function parkWakeFailedTurn(jobId, waitKey, soulId, cause, attempt = 0) {
    const deliveryId = turnId(Number(jobId ?? 0), String(waitKey ?? ''), Number(attempt ?? 0));
    const msg = String(cause?.message ?? cause);
    if (inflight.has(deliveryId) || isTurnDoneRecently(deliveryId)) {
      log(`actor dispatch refused (deduped): ${msg}`);
      return { accepted: false, reason: 'duplicate' };
    }
    log(`actor dispatch refused: ${msg} — 降级为提醒+保险丝（不是 error，引擎不停）`);
    const turn = {
      deliveryId, jobId: Number(jobId ?? 0), waitKey: String(waitKey ?? ''),
      actorName: soulId, soul: soulId,
      sessionId: '',
      isMain: false,
      startedAt: Date.now(),
    };
    inflight.set(deliveryId, turn);
    // 唤醒失败已等过唤醒闸 75s——提醒立即弹（广播：没有 connId 可定向），不再
    // 静默 30s；额度记掉，终局撤条走广播。
    turn.reminded = true;
    // 提醒帧带会话引用（从唤醒失败错误尾缀 ref= 回填，service.resolveSeat 抛错
    // 时缀上）——扩展的「切过去」按钮/系统通知按引用现场认页，没有它两处都是
    // 死按钮（2026-10-02「切过去没反应」实案第二根因）。park 账本仍是漂账：
    // turn.sessionId 不动（领养/reload 对漂账本就无事可做）。
    const refHint = msg.match(/ref=([^\s）」]+)/)?.[1] ?? '';
    const remind = {
      type: 'remind', deliveryId, tabId: 0, sessionId: refHint,
      message: `「${soulId}」绑定的网页没能自动唤醒（${msg.slice(0, 80)}）。切到那个标签页点开可以唤醒它；本节点会在超时后自动跳过，戏不会停。`,
      actor: soulId, soul: soulId,
    };
    if (!deliverFrame('', remind)) broadcastFrame?.(remind);
    armExecFuse(turn); // 3000s 到点 ⚠️ 占位跳过——与推进过的回合同一契约
    return { accepted: false, reason: 'no-seat (demoted: remind + fuse skip)' };
  }

  /** 任务面单 → 回复文本（persona 折进正文：网页没有 system prompt 通道。
   *  段序=上下文在前、角色设定殿后——引导语「你的角色是：」+换行接 soul
   *  prompt（2026-09-26 用户定稿格式）。 */
  async function composeActorText(d) {
    const blocks = (d.blocks && typeof d.blocks === 'object') ? d.blocks : {};
    const prompt = buildSubagentPrompt(blocks);
    if (!prompt) throw new Error('empty actor prompt (no blocks)');
    const soulId = String(d.actor_info?.soul || d.actor_info?.soul_id || d.actor_name || d.node_name || 'actor');
    const persona = await readSoulPersona(bridge, soulId);
    return persona
      ? `${prompt}\n\n──────────\n\n你的角色是：\n${persona}`
      : prompt;
  }

  /** 角色席下发统一入口（事件现场 + push 面单两来路，wait_key 恰好一次）。
   *  座位解析走 resolveSeat(jobId, soul)（hub cast 账唯一正身，service 注入）——
   *  本地不再自养灵魂账（2026-09-25 用户定案）。
   *  顺次闸（2026-10-02 三锤）：座位解析（含「活着没」检查与唤醒）在闸内——
   *  闸忙时排队不解析座位，轮到才看活着没；重复面单在进闸前就拒（恰一次）。 */
  async function dispatchActorRequest(d) {
    const waitKey = String(d?.wait_key ?? '');
    if (!waitKey) return { accepted: false, reason: 'no wait_key' };
    const soulId = String(d.actor_info?.soul || d.actor_info?.soul_id || d.actor_name || d.node_name || 'actor');
    // 记下显示名↔正身对照（重试牌只带显示名，见 soulByActorName 段注）：本拍的
    // ai_request 是唯一同时带两样的信，无论这一拍后来发得出去发不出去都要记。
    rememberActorName(d.actor_name, d.actor_info?.soul || d.actor_info?.soul_id);
    const jobId = Number(d.job_id ?? 0);
    const deliveryId = turnId(jobId, waitKey, 0);
    if (inflight.has(deliveryId)) return { accepted: false, reason: 'duplicate' };
    if (isTurnDoneRecently(deliveryId)) {
      // 双来路重放（事件现场+push 面单）：第一路已交卷，第二路迟 to——原样再发
      // 会让角色把同一句话说两遍（2026-10-02 实案），响亮丢弃。
      log(`actor dispatch deduped: ${deliveryId} 已在本场交卷（双来路迟到拍），丢弃`);
      return { accepted: false, reason: 'duplicate (already completed)' };
    }
    let text;
    try {
      text = await composeActorText(d);
    } catch (e) {
      const msg = String(e?.message ?? e);
      log(`actor compose failed: ${msg}`);
      try { await sendActorFailure(bridge, jobId, waitKey, 'error', msg); } catch { /* 失败上报也失败=已大声留痕 */ }
      return { accepted: false, reason: msg };
    }
    return enterTurnGate(deliveryId, async () => {
      let seat;
      try {
        seat = await resolveSeat(jobId, soulId);
      } catch (e) {
        // 绑定在别家宿主：不是我们的活（信留驿站等对方自取）——静默跳过，放闸。
        const foreign = foreignHostOf(e);
        if (foreign) {
          log(`actor dispatch skipped: "${soulId}" 绑定在别家宿主（${foreign}）——信留驿站等对方自取，本宿主不派工、不弹提醒`);
          return { accepted: false, reason: `foreign-host (${foreign})` };
        }
        // 唤醒失败（页没开/冻着唤不醒）＝「切页面/点开就能救活」的场合：不是
        // error，不上报 actor_failed（那会挂起整场戏——2026-10-02 用户拍板：
        // 这类事永远不许停引擎）。立回合账 + 弹提醒喊人 + 留在账上等保险丝
        // （3000s 到点 ⚠️ 占位跳过，剧本继续跑）。
        return parkWakeFailedTurn(jobId, waitKey, soulId, e);
      }
      return dispatchToSeat(seat, d, text, { actorName: String(d.actor_name || d.node_name || 'actor'), soul: soulId, attempt: 0 });
    });
  }

  /** 主Agent回合：有主Agent席就自动应答；没有 → 操作台人工席。唤醒+派发在顺次
   *  闸内（与角色回合同一条队——网页一次只伺候一个）；没注入 wakeSeat（测试桩
   *  环境）或唤醒超时就照旧挂队，remind 兜底，不在这炸回合。 */
  async function dispatchMainBrief(brief) {
    let seat = seats.mainSeat();
    if (!seat) {
      surface.onMainBrief?.(brief);
      return { accepted: false, reason: 'no-main-seat (operator console)' };
    }
    const deliveryId = turnId(Number(brief.jobId ?? 0), String(brief.waitKey ?? ''), 0);
    if (inflight.has(deliveryId)) return { accepted: false, reason: 'duplicate' };
    if (isTurnDoneRecently(deliveryId)) return { accepted: false, reason: 'duplicate (already completed)' };
    return enterTurnGate(deliveryId, async () => {
      // 进闸再取一次主席（排队期间可能换椅/掉椅）+ 按需唤醒（页可能被关了重开，
      // tabId/online 都变了——主Agent席旗随旧页出账清掉属设计内，下次派工落回
      // 操作台人工席，用户重设即可）。
      let s = seats.mainSeat() ?? seat;
      if (!s.online && wakeSeat) {
        await wakeSeat(s.sessionId);
        s = seats.bySession(s.sessionId) ?? s;
      }
      const b = (brief.blocks && typeof brief.blocks === 'object') ? brief.blocks : {};
      const text = [b.prompt, b.context, b.memory].filter(x => String(x ?? '').trim()).join('\n\n──────────\n\n');
      return dispatchToSeat(s, { job_id: brief.jobId, wait_key: brief.waitKey, node_name: brief.node }, text, { actorName: 'main', soul: 'main', isMain: true, attempt: 0 });
    });
  }

  /** 重试牌：网页角色天然可重演——同一会话还记着上文，把审稿意见递进去让它改。
   *  座位解析（含唤醒）同样在顺次闸内；唤醒失败与首发同款降级（park：立即提醒
   *  +保险丝跳过），不再干等引擎 3600s 全程无声。
   *  soul 来源阶梯（重演能不能真正到网页的关键）：①面单 brief（引擎 node_retry
   *  信今天不带，恒缺）②上一回合记忆 doneTurnFor——首发必经本进程、引擎交卷
   *  后才发重试牌，那里的 soul 是 soul id 正身 ③**首发料包登记表** soulOfActorName
   *  ——补②漏掉的那些「没到过席位」的首发（唤醒失败 park、绑定别家宿主留驿站）
   *  ④actor_name 兜底——它是「@角色名（灵魂名）」显示形态，选角账按 soul id 键
   *  基本对不上（对不上=落 park：提醒喊人+保险丝占位跳过，戏不停）。 */
  async function dispatchActorRetry({ actorName, waitKey, feedback, attempt, brief, jobId }) {
    const jid = Number(jobId ?? brief?.job_id ?? 0);
    const prev = doneTurnFor(jid, waitKey);
    const named = soulOfActorName(actorName);
    const soulId = String(brief?.actor_info?.soul || brief?.actor_info?.soul_id || prev?.soul || named || actorName);
    log(`node_retry 重演: actor="${actorName}" wait_key=${waitKey} attempt=${attempt ?? 0} soul=${soulId}（${brief ? '面单' : prev ? '上一回合记忆' : named ? '首发料包登记表' : 'actor_name 兜底'}）`);
    const deliveryId = turnId(jid, String(waitKey ?? ''), Number(attempt ?? 0));
    const d = brief ?? { job_id: jid, wait_key: waitKey, node_name: actorName };
    const retryText = `【重审请求】你上一份提交未通过审查。\n审稿意见：${feedback}\n请结合会上已有的讨论，重新给出完整回复（不要只回「好的」，直接给出修改后的正式回答）。`;
    return enterTurnGate(deliveryId, async () => {
      let seat;
      try {
        seat = await resolveSeat(jid, soulId);
      } catch (e) {
        // 绑定在别家宿主：重演也不归本宿主办（同首发裁决）——静默跳过，不弹提醒。
        const foreign = foreignHostOf(e);
        if (foreign) {
          log(`node_retry skipped: "${soulId}" 绑定在别家宿主（${foreign}）——不是本宿主的活（wait_key=${waitKey}）`);
          return { accepted: false, reason: `foreign-host (${foreign})` };
        }
        log(`node_retry for "${actorName}" (wait_key=${waitKey}) — ${String(e?.message ?? e)}，降级为提醒+保险丝（不是 error，引擎不停）`);
        return parkWakeFailedTurn(jid, String(waitKey ?? ''), soulId, e, Number(attempt ?? 0));
      }
      return dispatchToSeat(seat, d, retryText, { actorName, soul: soulId, attempt, retry: true });
    });
  }

  // ── 扩展上行（service.mjs 转发）────────────────────────────────────
  function onSeatReport(report) {
    const type = String(report?.type ?? '');
    const sessionId = String(report?.sessionId ?? '');
    if (type === 'hello') {
      // 回合领养（2026-10-02）：页面每次加载来认领在飞回合——页因任何原因重载
      // （唤醒闸 reload / 人工刷新 / 扩展重载），页面上正在等结尾的收话机一起
      // 销毁，网站把回复拉回来显示，新收话机从这里接回 deliveryId。三态：
      //   已发送未回   → adopt：领账收尾（content 等「完事」报 reply）；
      //   已推进未发送 → replay：旧帧死在重开的页里，原帧换新页寻址（hello 带
      //                  sender 的 tabId）原样重发——页上重走打字发车；
      //   没有在飞回合 → 空（照常待命）。
      // 防双页同发闸（j2713 豆包实案，2026-10-05）：会话可能同时开着不止一个
      // 标签页（open-tab 帧广播给所有扩展连接，每实例各开一页）——第二页上线
      // hello 时，现役页可能还在发送/自动重试中（send-failed 每 15s 一拍也算
      // 活气）。此时把帧重发给第二页=同一句话两个页各发一遍，还把回合的 tabId
      // 抢到别的连接上（静默阶梯的 reload 从此指错门）。所以：宽限窗内有活气
      // 的未发送回合不换页——现役页自己有 15s 重试链会救；真死了（活气静默超
      // 过宽限窗）才放行接管，被拒页约半分钟后可再来认领。
      const turn = turnForSession(sessionId);
      if (!turn) return { handled: true };
      if (turn.sentAt) {
        log(`hello: ${sessionId.slice(0, 8)}… 领养在飞回合 ${turn.deliveryId}（已发送，领账收尾）`);
        return { handled: true, adopt: turn.deliveryId };
      }
      if (turn.frame) {
        const tabId = Number(report.tabId ?? 0) || turn.frame.tabId;
        const signAge = Date.now() - (turn.lastSignAt ?? turn.startedAt);
        if (tabId && turn.frame.tabId && tabId !== turn.frame.tabId && signAge < sendGraceMs) {
          log(`hello: ${sessionId.slice(0, 8)}… 另一标签页（tab ${tabId}）认领发送中的回合——现役 tab ${turn.frame.tabId} ${Math.round(signAge / 1000)}s 前还有活气，不重发（防双页同发）；${Math.round(retryHelloMs / 1000)}s 后可再来认领`);
          return { handled: true, retryHelloMs };
        }
        const tabIdForReplay = Number(report.tabId ?? 0) || turn.frame.tabId;
        turn.frame = { ...turn.frame, tabId: tabIdForReplay };
        // 重推=新的执行窗口：保险丝重开；静默看护按新基点重排（reload 恰一次/
        // 提醒恰一次的额度是回合级的，不随重推返还——防 reload 循环）。
        turn.lastSignAt = Date.now();
        armExecFuse(turn);
        armStallWatch(turn);
        log(`hello: ${sessionId.slice(0, 8)}… 未发送——原帧随应答重发（tab ${tabIdForReplay}，页面自取重走发车）`);
        return { handled: true, replay: turn.frame };
      }
      return { handled: true };
    }
    if (type === 'busy') {
      // 页面代理的上报带会话引用；扩展重载后没刷新的旧页可能还报裸 id（无前缀）
      // ——宽松找，对上号后一切按席位账里的正字 id 走。
      const seat = seats.bySessionLoose(sessionId);
      const wasBusy = seat?.busy;
      if (seat) {
        seats.setBusy(seat.sessionId, Boolean(report.busy));
        if (wasBusy && !report.busy) flushSeat(seat.sessionId);
      }
      return { handled: true };
    }
    if (type === 'sent') {
      const turn = inflight.get(String(report.deliveryId ?? ''));
      if (turn) {
        // 注意：这里**不**清执行保险丝——「已发送」只是发送期结束，生成期仍在
        // 节点的 3000s 预算里（2026-10-02 拍板：节点超时按整节点理解）。
        // 静默看护已在推进时武装、自我重排——这里只打活气点：已发送算内容，
        // 阶梯的静默钟从这一刻重新起算（delta 到来同理，见 delta 分支）。
        turn.sentAt = Date.now();
        turn.lastSignAt = turn.sentAt;
        log(`turn sent: ${turn.actorName} wait_key=${turn.waitKey}`);
        if (turn.reminded) {
          // 页面自己醒了（用户点开了标签页）：撤掉提醒，别再喊人。定向不在
          // （park 降级回合无 connId/浏览器重启换新）→ 广播撤。
          const cancel = { type: 'remind-cancel', deliveryId: turn.deliveryId };
          if (!deliverFrame(turn.connId, cancel)) broadcastFrame?.(cancel);
        }
      }
      return { handled: true };
    }
    if (type === 'send-failed') {
      // 发送姿势失败（输入框 20s 未就绪/写了没清空/生成没启动）——「切页面就
      // 能救活」的场合（页面半冷加载/冻结边缘/站方改了姿势）：**不是 error，引擎
      // 不停**（2026-10-02 用户拍板）。处置=页面侧 15s 自动重试链（2026-10-05
      // 用户拍板，取代旧的一次性 focus 重试）：没见到 sent 成功信号就每 15s 重喂
      // 一拍，发出即停；收话段的问题归静默阶梯，不进这条重试链。这里把每次
      // 失败当活气打点（重试中的页是活页，静默阶梯不许把它 reload 掉——reload
      // 只会把冷加载计时清零，让编辑器挂载遥遥无期）；页面真死了打点自然停，
      // 阶梯照常接管。
      const turn = inflight.get(String(report.deliveryId ?? ''));
      if (turn) {
        turn.lastSignAt = Date.now();
        const tries = Number(report.tries ?? 0);
        log(`turn send-failed (kept alive${tries ? `，自动重试第 ${tries} 拍仍失败` : ''}): ${turn.actorName} wait_key=${turn.waitKey} — ${String(report.message ?? '')}`);
      }
      return { handled: true };
    }
    if (type === 'delta') {
      // 逐字流旁路：只上墙，绝不碰回合生命周期（恰好一次/计时器/收口仍由
      // reply 独占）。未知 deliveryId（已交卷/重试换拍/手工聊天）=静默丢——
      // 草稿轨丢几拍不伤账；必须回 handled:true，否则服务端把节流上报全当
      // 「无人认领」大声留痕（每 400ms 一条噪音）。
      const turn = inflight.get(String(report.deliveryId ?? ''));
      if (turn) {
        turn.lastSignAt = Date.now(); // 流还在滴=页面活着，静默看护的活气打点
        feedDraft(turn, { thinking: String(report.thinking ?? ''), content: String(report.content ?? '') });
      }
      return { handled: true };
    }
    if (type === 'reply') {
      const turn = dropTurn(String(report.deliveryId ?? ''));
      if (!turn) return { handled: false, reason: 'unknown deliveryId' };
      const text = String(report.text ?? '');
      // 思考链随交卷进信封（body.steps → hub post_speech 拆 cot 槽）。网页席没有
      // 工具调用，steps 只有思考一节；不填=投影段只剩台词槽（job 2595-2602 实测
      // 全场丢 cot，旧桥时代的段是有思考链折叠块的——extension 一直有上报，本席漏装）。
      // reply 必带：引擎落账契约 steps[].reply=该轮台词（FEMO_runtime 拿到 steps
      // 就不再用 output 兜底）——只带 cot 台账 response 落空串，下游角色拼上下文
      // 时这些行被整条丢弃，料包永远没上下文（job 2605 实证）。
      const thinking = String(report.thinking ?? '').trim();
      const steps = thinking ? [{ cot: thinking, reply: text }] : undefined;
      log(`turn done: ${turn.actorName} wait_key=${turn.waitKey} ${text.length} chars in ${Math.round((Date.now() - turn.startedAt) / 1000)}s`);
      const soulForEngine = turn.isMain ? 'main' : turn.actorName;
      submitOutput(turn.jobId, turn.waitKey, text, steps, soulForEngine, turn.modelId)
        .catch(e => log(`submitOutput failed: ${String(e).slice(0, 200)}`))
        .finally(() => { flushSeat(sessionId); tryDeliverNext(sessionId); });
      return { handled: true };
    }
    if (type === 'error') {
      const turn = inflight.get(String(report.deliveryId ?? ''));
      if (turn) failTurn(turn, String(report.kind ?? 'error'), String(report.message ?? 'web seat error'));
      return { handled: true };
    }
    return { handled: false, reason: `unknown report type: ${type}` };
  }

  /** 停下/桥死亡：全场在飞回合就地放弃（引擎已结束，再报失败是写给已关闭的运行）。
   *  顺次队列一并清空：排队中的任务作废不再派发（停下=戏散；续跑/下一场由引擎
   *  重新派）。人类等待镜像随停收起：运行停了/挂了，「等人类」就是过期状态——
   *  侧栏人类发言卡与操作台人工席都读这面镜子，不清会一直挂着一个不会再来的
   *  回合（2026-09-27 用户拍板）。续跑后引擎重发 human_wait，镜子自然重立。 */
  function abortAll(reason) {
    seqQueue.length = 0; // 先清队：占闸回合的 dropTurn 放闸时不会再唤醒任何排队者
    for (const turn of [...inflight.values()]) {
      dropTurn(turn.deliveryId);
      log(`turn aborted (${reason}): ${turn.actorName} wait_key=${turn.waitKey}`);
    }
    if (rt.humanWait !== undefined) {
      rt.humanWait = undefined;
      log(`human wait cleared (${reason})`);
    }
    // 队里挂着的 human_wait 头一并拆：运行停了这是残留账，泵会拿它复活等待态。
    takeHumanWaitHead('any');
  }

  // ── 桥事件接线（事件通道；push 通道在 service.mjs 的收件口路由里）──────
  bridge.onEvent = (eventType, d) => {
    const data = d ?? {};
    rt.lastEventAt = Date.now();
    try {
      if (eventType === 'ai_request') {
        if (String(data.source ?? '') === 'main') {
          // 主Agent回合双来路去重：push 先到已登记 → 事件现场跳过。
          if (!rt.push.consumedMain(data)) {
            const b = (data.blocks && typeof data.blocks === 'object') ? data.blocks : {};
            dispatchMainBrief({
              jobId: Number(data.job_id ?? 0),
              waitKey: String(data.wait_key ?? ''),
              node: String(data.node_name ?? ''),
              blocks: b,
            }).catch(e => log(`main dispatch unhandled: ${String(e).slice(0, 200)}`));
          }
        } else {
          dispatchActorRequest(data).catch(e => log(`actor dispatch unhandled: ${String(e).slice(0, 200)}`));
        }
      }
      if (eventType === 'human_wait') {
        // 新等待到场：先拆掉可能残留的上一拍 human_wait 头（不同 wait_key=残留
        // 账——运行被换场后旧头会永远堵在队首，挡住后面 main directive 的应答）。
        takeHumanWaitHead('differs', String(data.wait_key ?? ''));
        // 字段映射唯一活在公共层 run-state-core.waitingHumanFromEvent（分诊台
        // 记账同一份，8 字段全量）；本宿主动词只补三样：jobId（等待是本场戏的、
        // /state 与画布人类席路由按它寻址）、since（本宿主「等了多久」的钟）、
        // hasOutVars（赋值钮显隐布尔，判定唯一活在公共层 hub-render-core，2026-
        // 09-28 收编）。此前 8 字段手抄一份已随收编退役（曾漏抄 context/memory）。
        const snap = waitingHumanFromEvent(data);
        const outVars = snap.outVars;
        rt.humanWait = {
          jobId: Number(data.job_id ?? 0),
          waitKey: snap.waitKey,
          node: snap.nodeName ?? '',
          prompt: snap.prompt,
          // showprompt 随事件带上（引擎 human_wait 自带；侧栏人类卡「节词」段
          // 数据源，2026-09-27 补传——此前 prompt/showprompt 只进投影、侧栏被丢）。
          showprompt: snap.showprompt ?? '',
          scope: snap.waitScope ?? [],
          // 节点声明的 out 变量名（引擎 human_wait 事件自带；侧栏人类席赋值钮
          // 数据源，与投影中心等待态同源同词——2026-09-26 补传，此前被丢）。
          out_vars: outVars,
          hasOutVars: hasOutVars({ out_vars: outVars }),
          since: Date.now(),
        };
        surface.onHumanWait?.(rt.humanWait);
      }
      if (eventType === 'human_done') {
        // 人类发言落流水（调试面收话确认）：引擎 human_done 自带 input 原文，
        // 投影中心/操作台两条提交路径都收敛到这一个引擎信号——全路径可见。
        // 空输入（超时放行）不记：流水记「收到的话」，不是「等过人」。
        const said = String(data.input ?? '');
        if (said.trim()) {
          const who = rt.humanWait?.scope?.[0];
          board.chat(said, { kind: 'human', actor: who ? String(who) : undefined });
        }
        rt.humanWait = undefined;
        // 等待终结（收账/超时放行）：队头的 human_wait 一并出队——超时放行没有
        // 交卷对账可走，不拆的话残留头会堵住后续 main directive 的应答入口。
        takeHumanWaitHead('any');
      }

      // 事件记账 + 幕布空壳（真实幕布=桥内嵌 hub）。
      rt.router.handleEvent(eventType, data);

      if (isStopSignal(eventType)) {
        abortAll(`stop signal: ${eventType}`);
        if (eventType === 'bridge_run_ended') announceStop(Number(data.job_id ?? 0), 'finished');
        if (eventType === 'flow_error') announceStop(Number(data.job_id ?? 0), 'failed', String(data.error ?? ''));
        if (eventType === 'flow_paused') announceStop(Number(data.job_id ?? 0), 'paused', String(data.error ?? ''));
      }
    } catch (error) {
      log(`event ${eventType} dispatch failed: ${String(error).slice(0, 200)}`);
    }
  };

  /** 终局通知（collect_notices 代取 → 拼词 → 出口）。push 已办=跳过。 */
  async function announceStop(jobId, outcome, detail) {
    try {
      if (rt.push.isAnnounced(jobId)) return;
      rt.push.markAnnounced(jobId, outcome);
      let letters = [];
      try {
        const got = await bridge.send('collect_notices', { job_id: jobId, soul: 'main' }, 15_000);
        letters = Array.isArray(got?.letters) ? got.letters : [];
      } catch (e) {
        log(`collect_notices failed (title-only notice): ${String(e).slice(0, 160)}`);
      }
      const notice = formatStopNotice({ jobId, outcome, detail, letters, tag: '[femo]', panelNote: false });
      log(`stop: job=${jobId} outcome=${outcome} letters=${letters.length}`);
      surface.onStopNotice?.({ jobId, outcome, notice });
    } catch (error) {
      log(`announceStop failed: ${String(error).slice(0, 200)}`);
    }
  }

  // ── 运行泵（后台，与 autoclaw 同构）────────────────────────────────
  const pump = { running: false, idleSince: 0, wake: null };
  const PUMP_IDLE_MS = 150;
  const PUMP_MAX_IDLE_MS = 90_000;

  function waitIdle(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(done, ms);
      function done() { pump.wake = null; clearTimeout(timer); resolve(); }
      pump.wake = done;
    });
  }

  async function pumpLoop() {
    pump.running = true;
    pump.idleSince = Date.now();
    try {
      while (true) {
        const head = rt.router.head();
        if (!head) {
          const s = rt.router.state();
          if (!s.running) break;
          if (Date.now() - Math.max(pump.idleSince, rt.lastEventAt) > PUMP_MAX_IDLE_MS) {
            log('pump: idle timeout (engine silent) — sleeping until next femo_run');
            break;
          }
          await waitIdle(PUMP_IDLE_MS);
          continue;
        }
        pump.idleSince = Date.now();
        if (head.kind === 'ai_node') { rt.router.takeHead(); continue; }       // 事件现场已接走
        if (head.kind === 'human_wait') {
          // 等待镜像唯一写口=human_wait 事件现场。这里不再重建——镜像被清后
          // 拿残留头写回来正是「卡收不掉」的病灶，且头上的形状缺斤短两（无
          // node/out_vars/showprompt）。泵在此只停驻等人类；头由交卷对账、
          // 等待终结、停下清场三处收走。
          await waitIdle(1000);
          continue;
        }
        if (head.kind === 'directive') { rt.router.takeHead(); continue; }     // 主Agent回合已在事件现场派发
        rt.router.takeHead();
        break;
      }
    } finally {
      pump.running = false;
    }
  }

  function startPump() {
    if (!pump.running) pumpLoop().catch(e => log(`pump crashed: ${String(e).slice(0, 200)}`));
    else pump.wake?.();
  }

  return {
    router: rt.router,
    seats,
    push: rt.push,
    surface,
    dispatchActorRequest,
    dispatchMainBrief,
    dispatchActorRetry,
    onSeatReport,
    /** 标签页重新上线/席位转闲后的补发口（service 层 register 后逐席调用）。 */
    pokeSeat: tryDeliverNext,
    abortAll,
    submitHumanOutput,   // 带交卷对账（队列等待头同拍出队）——人类交卷唯一入口
    startPump,
    announceStop,
    get humanWait() { return rt.humanWait; },
    clearHumanWait: () => { rt.humanWait = undefined; },
    state: () => rt.router.state(),
    runlog: () => board.runlog.slice(-60),
    stats: () => {
      const all = seats.list();
      return { inflight: inflight.size, seats: all.length, online: all.filter(s => s.online).length };
    },
  };
}
