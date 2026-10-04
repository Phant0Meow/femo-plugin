/**
 * event-core.mjs — 引擎事件分诊台 v2（host 无关公共层，femo2host）。
 *
 * 【2026-09-24 B2 收官】十连裁定基：派工单通道=驿站（信），事件退**纯记账**。
 * v2 分诊台只剩三件事：
 *   ① 记账        —— 事件现场登记节点视野/角色名/showprompt（随 Job 生灭）
 *   ② 黑板翻转    —— Job 镜像状态机唯一活在 run-state-core（flow 事件驱动
 *                    prearm/correct/setState/clear，节点登记与 waitingHuman
 *                    快照挂镜像上——A4 串台病根随镜像生灭根治）
 *   ③ 分拣        —— 终局/等待/重试等信号的幕布行与终止标记（落点经 board）
 * 派工（主Agent/角色拍队列）在默认模式**不再产**：料包唯一走驿站投递员。
 *
 * dispatch 模式（拉取队列的退役过渡）：
 *   - 'off'（默认，v2 单通道）：无队列活动，head()/takeDirective() 恒空。
 *   - 'queue'（v1 遗留契约）：ai_request/human_wait 照旧入队、flow 终态推终
 *     止标记——仅供尚未完成单通道对齐的宿主过渡（autoclaw runtime）；
 *     zcode 侧已无生产消费方，勿新增依赖。
 *
 * 回传合约不变：submitOutput/submitHumanOutput 寄 speech 信（speech-core 唯一
 * 信封），projectUserLine 落角色窗。宿主差异留在各自绑定层（zcode 一律写
 * role 行 / dsh 的 steer/followup/god-mirror 等）。
 *
 * 对外 state() 形状向后兼容（running/playName/actors/mainActors/waitingHuman
 * [wire 形状 job_id/wait_key/node_name/prompt/scope]/pendingDirectives），新增
 * jobId 字段。
 */

import { executorSpeechArgs, humanSpeechArgs } from './speech-core.mjs';
import { PLAY_BROADCAST } from './notice-core.mjs';
import {
  jobMirrorPrearm, jobMirrorSetState, clearActiveIfActive, activeJobOf,
  noteNodeScope, noteNodeActor, noteNodeShowprompt,
  waitingHumanFromEvent, setMirrorWaitingHuman, clearMirrorWaitingHuman,
} from './run-state-core.mjs';

/** 单运行时事件分诊台。
 * @param {object} opts
 * @param {object}  opts.board  幕布落点：{ ensureWindows(actors), chat(text, rowOpts, scopeOpts) }
 * @param {string}  [opts.sid]  投影窗会话键（单运行时，恒 'femo-main'）
 * @param {(cmd: string, args?: object, timeoutMs?: number) => Promise<unknown>} opts.send
 *     bridge.send 的绑定（speech 回传走这里；测试可注入桩）
 * @param {('off'|'queue')} [opts.dispatch] 派工队列模式：'off'=单通道纯记账
 *     （v2 默认）；'queue'=v1 遗留拉取队列（过渡期宿主自选）
 * @param {(msg: string) => void} [opts.log]
 * @param {object}  [opts.store] 【v2.1 接入面】外置账本（{jobs, sidIndex,
 *     activeJobId}——dsh 的 RunState 形状兼容）。缺省自建；多会话宿主把总装
 *     创建的共享账本注入，镜像与各消费方同源。
 * @param {(jobId: number, d: object) => string} [opts.resolveSid] 【v2.1】
 *     事件归属会话解析（dsh：Job 镜像反查 ownerSid；单运行时缺省恒 sid）。
 * @param {object} [opts.verbs] 【v2.1】分拣行的显示裁决（缺省=zcode 行为：
 *     chat 落行）。每个钩子收事件数据 d，裁决权在宿主——dsh 的行显示归桥
 *     EventProjector/自绘窗，verbs 多为广播转接。
 * @param {string[]} [opts.skip] 【v2.1】整事件跳过名单（宿主自有语义全接管，
 *     如 dsh 的 human_wait=驿站投递员领拍、flow_start=会话物理面）。
 */
export function createEventCore({ board, sid = 'femo-main', send, dispatch = 'off', log = () => {}, store: externalStore, resolveSid, verbs: verbsOpt, skip = [] }) {
  // ── 黑板（2026-09-24 B2 收 run-state-core）：Job 镜像=随戏生灭的登记抄本
  //    （nodeActors/nodeScopes/nodeShowprompts/waitingHuman 全挂镜像——A4 串台
  //    根治：新 Job 新镜像，旧账不再污染）。场景场记（剧名/角色表）非镜像
  //    词汇，留本地。────────────────────────────────────────────────────
  const store = externalStore ?? { jobs: new Map(), sidIndex: new Map(), activeJobId: undefined };
  const sidOf = resolveSid ?? (() => sid);
  const skipEvents = new Set(skip);
  /** 分拣行显示裁决（缺省=zcode 行为：chat 落行；v2.1 宿主可逐个换成自己的
   *  动词。注意：waitingHuman 快照登记不归 verbs——那是黑板簿记，verbs 只管
   *  「这行怎么显示」）。 */
  const verbs = {
    flowStarted: (d, playName) => chat(`🎬 《${playName || '未命名脚本'}》启动运行`, 'sys'),
    nodePrompt: (d, prompt, scope) => chat(`📢 ${prompt}`, 'prompt', {}, scope),
    nodeShowprompt: (d, showprompt, scope) => chat(`📢 ${showprompt}`, 'prompt', {}, scope),
    humanWaiting: (d, snap, scope) => chat(d.prompt?.trim?.().length > 0 ? `🎭 等待你的回应：${d.prompt}` : '🎭 等待你的回应', 'human_wait', {}, scope),
    aiSpoken: (d, output, actor, scope) => chat(output, 'role', { actor }, scope),
    playDone: (d, _changed) => chat(PLAY_BROADCAST.done, 'sys'),
    playError: (d, detail, _changed) => chat(PLAY_BROADCAST.error(detail), 'error'),
    playPaused: (d, _changed) => chat(PLAY_BROADCAST.paused, 'sys'),
    authorNotice: (d, message) => chat(`⚠️ ${message}`, 'notice'),
    ...(verbsOpt ?? {}),
  };
  let playName = '';
  let actors = [];
  let mainActors = [];
  const mirrorOf = jobId => (Number.isFinite(jobId) ? store.jobs.get(jobId) : undefined);
  const scopeIn = (jobId, nodeName) => {
    if (nodeName === undefined) return undefined;
    return mirrorOf(jobId)?.nodeScopes.get(nodeName);
  };

  // ── 拉取队列（dispatch:'queue' 遗留契约专用；'off' 下恒空）────────────
  const directiveQueue = [];         // 主Agent员 directive / 终态标记 FIFO
  const directiveWaiters = [];       // 拉取端的 pending resolve
  function wakeOne() {
    while (directiveWaiters.length > 0 && directiveQueue.length > 0) {
      directiveWaiters.shift()(directiveQueue.shift());
    }
  }
  function pushDirective(item) {
    if (dispatch !== 'queue') return; // v2 单通道：派工唯一走驿站，不入队
    directiveQueue.push(item);
    wakeOne();
  }
  /** 引擎终态：清空 pending directive，等待者按终态标记唤醒（仅 queue 模式）。 */
  function terminate(kind, extra = {}) {
    if (dispatch !== 'queue') return;
    directiveQueue.length = 0;
    pushDirective({ kind, ...extra });
  }

  // ── 投影便捷写（幕布落点经 board）────────────────────────────────────
  const chat = (text, kind, opts = {}, targetActors) => board.chat(text, { kind, ...opts }, { targetActors });

  // ── 事件分发（分诊表 v2：记账 + 黑板翻转 + 分拣；v2.1 起显示裁决走 verbs、
  //    账本/会话解析可注入、skip 名单整事件让渡宿主）──────────────────────
  function handleEvent(eventType, d0) {
    const d = d0 ?? {};
    const jobId = Number.isFinite(d.job_id) ? d.job_id : undefined;
    if (skipEvents.has(eventType)) return { eventType, jobId }; // 宿主自有语义全接管
    switch (eventType) {
      case 'flow_start': {
        actors = Array.isArray(d.actors) ? d.actors.filter(x => typeof x === 'string') : [];
        mainActors = Array.isArray(d.main_actors) ? d.main_actors.filter(x => typeof x === 'string') : [];
        playName = typeof d.name === 'string' ? d.name : '';
        // 新镜像=新黑板（A4 根治）。event-core 无命令回执，flow_start 兼任
        // prearm：首演建镜像、续跑（挂起镜像复活）同 dsh resume 回执口径。
        if (jobId !== undefined) jobMirrorPrearm(store, jobId, sidOf(jobId, d));
        board.ensureWindows(actors);
        verbs.flowStarted(d, playName, actors);
        break;
      }
      case 'node_start': {
        const nodeName = typeof d.node_name === 'string' ? d.node_name : undefined;
        const scopeInfo = Array.isArray(d.scope) ? d.scope.filter(x => typeof x === 'string') : undefined;
        const mirror = mirrorOf(jobId);
        if (mirror !== undefined) noteNodeScope(mirror, nodeName, scopeInfo);
        // human / notice 节点的 📢 舞台提示即时落行（AI 节点的 showprompt 走 context_ready）
        if ((d.node_type === 'human' || d.node_type === 'notice') &&
            typeof d.prompt === 'string' && d.prompt.trim().length > 0) {
          verbs.nodePrompt(d, d.prompt, scopeIn(jobId, nodeName));
        }
        break;
      }
      case 'context_ready': {
        const nodeName = typeof d.node_name === 'string' ? d.node_name : undefined;
        const actorName = typeof d.actor_name === 'string' && d.actor_name.length > 0 ? d.actor_name : undefined;
        const showprompt = typeof d.showprompt === 'string' && d.showprompt.trim().length > 0 ? d.showprompt : undefined;
        const mirror = mirrorOf(jobId);
        if (mirror !== undefined) {
          noteNodeActor(mirror, nodeName, actorName);
          noteNodeShowprompt(mirror, nodeName, showprompt);
        }
        if (showprompt !== undefined) {
          if (nodeName === undefined) verbs.nodeShowprompt(d, showprompt, scopeIn(jobId, nodeName));
        }
        break;
      }
      case 'human_wait': {
        // 等待快照挂镜像（wire 形状经 state() 出料——gateway/hooks 消费）。
        const mirror = mirrorOf(jobId);
        const snap = waitingHumanFromEvent(d);
        if (mirror !== undefined) setMirrorWaitingHuman(mirror, snap);
        const scope = snap.waitScope ?? [];
        verbs.humanWaiting(d, snap, scope);
        // 对话通道（queue 遗留模式）：human_wait 拍入队给拉取端；v2 单通道不产。
        pushDirective({ kind: 'human_wait', job_id: jobId, wait_key: snap.waitKey, prompt: snap.prompt, scope });
        break;
      }
      case 'human_done': {
        const mirror = mirrorOf(jobId);
        if (mirror !== undefined) clearMirrorWaitingHuman(mirror); // 输入被引擎消费（正常/超时放行均走此信号）
        break;
      }
      case 'ai_done': {
        // 绑定层裁量行（zcode：一律写 role 行——无子代理镜像通路，ai_done 是
        // 引擎确认的最终台词）。actor 名按 ai_request 时登记的 nodeActors 解析。
        const nodeName = typeof d.node_name === 'string' ? d.node_name : undefined;
        const output = typeof d.output === 'string' && d.output.length > 0 ? d.output : undefined;
        if (output !== undefined && nodeName !== undefined) {
          const actor = mirrorOf(jobId)?.nodeActors.get(nodeName) ?? nodeName;
          verbs.aiSpoken(d, output, actor, scopeIn(jobId, nodeName));
        }
        break;
      }
      case 'ai_request': {
        // 纯记账：scope_info 登记节点视野（后续 ai_done 的 role 行按此过滤）。
        // queue 遗留模式照旧入队拍。v2 单通道：派工唯一在驿站（投递员按
        // brief 面单上门），事件侧零派工零兜底——十连裁①。
        const nodeName = typeof d.node_name === 'string' ? d.node_name : undefined;
        const scopeInfo = Array.isArray(d.scope_info) ? d.scope_info.filter(x => typeof x === 'string') : undefined;
        const mirror = mirrorOf(jobId);
        if (mirror !== undefined) noteNodeScope(mirror, nodeName, scopeInfo);
        if (String(d.source ?? '') === 'main') {
          const b = (d.blocks ?? {}) instanceof Object ? d.blocks : {};
          pushDirective({
            kind: 'directive',
            node: String(d.node_name ?? ''),
            actor_name: String(d.actor_name ?? ''),
            prompt: String(b.prompt ?? ''),
            context: String(b.context ?? ''),
            memory: String(b.memory ?? ''),
            job_id: jobId,
            wait_key: String(d.wait_key ?? ''),
            scope: Array.isArray(d.scope_info) ? d.scope_info.filter(x => typeof x === 'string') : undefined,
          });
        } else {
          pushDirective({
            kind: 'ai_node',
            node: String(d.node_name ?? ''),
            actor_name: String(d.actor_name ?? ''),
            brief_id: String(d.wait_key ?? ''),
            job_id: jobId,
            wait_key: String(d.wait_key ?? ''),
            scope: Array.isArray(d.scope_info) ? d.scope_info.filter(x => typeof x === 'string') : undefined,
          });
        }
        break;
      }
      case 'flow_done': {
        // changed 出料给动词（dsh 的 run_state SSE 广播插座按真变化发——状态
        // 翻转在核心、广播归宿主物理面）。
        const changed = jobId !== undefined ? jobMirrorSetState(store, jobId, 'finished') : undefined;
        clearActiveIfActive(store, jobId);
        verbs.playDone(d, changed === 'changed'); // 终局全窗广播（措辞唯一活在 notice-core）
        terminate('flow_done', { summary: typeof d.summary === 'string' ? d.summary : '' });
        break;
      }
      case 'flow_error': {
        const changed = jobId !== undefined ? jobMirrorSetState(store, jobId, 'failed') : undefined;
        clearActiveIfActive(store, jobId);
        verbs.playError(d, String(d.error ?? 'unknown error'), changed === 'changed');
        terminate('flow_error', { error: String(d.error ?? 'unknown error') });
        break;
      }
      case 'flow_paused': {
        const mirror = mirrorOf(jobId);
        const changed = jobId !== undefined ? jobMirrorSetState(store, jobId, 'suspended') : undefined;
        if (mirror !== undefined) clearMirrorWaitingHuman(mirror);
        clearActiveIfActive(store, jobId);
        verbs.playPaused(d, changed === 'changed');
        terminate('flow_paused');
        break;
      }
      case 'notify_author': {
        // 脚本错误通知作者（giveup 链路）：notice 行进窗。
        if (typeof d.message === 'string' && d.message.length > 0) verbs.authorNotice(d, d.message);
        break;
      }
      default:
        // checkpoint / ai_token / node_settled / node_retry / bridge_run_ended：
        // v2 投影不落行（ai_token 将来接直播帧）。
        break;
    }
    return { eventType, jobId };
  }

  // ── 拉取端（queue 遗留契约；off 模式恒空）───────────────────────────
  /** 非阻塞取一拍。队列空返回 undefined。 */
  function takeDirective() {
    return directiveQueue.shift();
  }
  /** 队首窥视（不取）。Stop hook 判定用：队首是真 directive 才拦截收工，
   *  human_wait 拍留在队列里给拉取端。 */
  function head() {
    return directiveQueue[0];
  }
  /** 取队首（与 head 配对的取出动作）。 */
  function takeHead() {
    return directiveQueue.shift();
  }
  /** 阻塞等一拍。宿主对该 Promise 自行加超时/progress 续命。 */
  function waitDirective() {
    if (directiveQueue.length > 0) return Promise.resolve(directiveQueue.shift());
    return new Promise(resolve => directiveWaiters.push(resolve));
  }
  /** 待取 directive 数（hooks 状态播报 / Stop hook 判定用）。 */
  function pendingDirectiveCount() {
    return directiveQueue.filter(x => x.kind === 'directive').length;
  }

  // ── 回传（统一寄 speech 信：系统要回答、客户发件——引擎对 AI/人类/主Agent
  //    不分家；桥轮询出站喂引擎）─────────────────────────────────────────
  /** 交卷：主Agent台词 / 子代理后端的角色结果（执行体信封，词汇收口 speech-core）。
   *  modelId（2026-10-02 存储层贯通）：本轮实际响应模型标识，落账 react_steps.model_id
   *  ——登记制不校验格式（dsh/zcode=provider/model，web=web:<站点名>，main 固定
   *  'main'；宿主取不到就不传，引擎落空串）。位置在第 6 参（soul 之后），旧调用方
   *  零改动。 */
  function submitOutput(jobId, waitKey, output, steps, soul = 'main', modelId) {
    return send('post_speech', executorSpeechArgs({ jobId, waitKey, soul, output, steps,
      ...(modelId === undefined ? {} : { modelId }) }), 30_000);
  }
  /** 人类席交卷（人类信封 body={chat_text, variables}，与 dsh projection-input
   *  同一份词汇）。引擎人类节点只读 chat_text/variables——{output} 会被读成
   *  空台词（2026-09-21 zcode 网关由此改道本动词，见 speech-core 头注）。 */
  function submitHumanOutput(jobId, waitKey, output, soul, variables) {
    return send('post_speech', humanSpeechArgs({ jobId, waitKey, soul, text: output, variables }), 30_000);
  }
  /** 人类玩家输入落角色窗（提词器/网关回传时调用；角色名=执行者）。 */
  function projectUserLine(actorName, text, scope) {
    chat(text, 'role', { actor: actorName }, scope);
  }

  // ── 黑板出料（wire 形状向后兼容；镜像 camelCase 快照 → snake_case 线形）──
  function wireWaitingHuman() {
    const mirror = activeJobOf(store, sid);
    const wh = mirror?.waitingHuman;
    if (wh === undefined) return undefined;
    return {
      job_id: mirror.jobId,
      wait_key: wh.waitKey,
      node_name: wh.nodeName,
      prompt: wh.prompt,
      scope: wh.waitScope ?? [],
    };
  }

  function state() {
    const activeMirror = activeJobOf(store, sid);
    return {
      sid,
      running: activeMirror !== undefined && activeMirror.state === 'running',
      playName,
      actors,
      mainActors,
      jobId: activeMirror?.jobId,
      waitingHuman: wireWaitingHuman(),
      pendingDirectives: pendingDirectiveCount(),
    };
  }

  return {
    handleEvent, takeDirective, waitDirective, pendingDirectiveCount,
    head, takeHead,
    submitOutput, submitHumanOutput, projectUserLine, state,
    // 供测试/诊断窥视：
    _internal: { store, running: () => state().running, waitingHuman: () => wireWaitingHuman() },
  };
}
