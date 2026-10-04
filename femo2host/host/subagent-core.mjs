/**
 * subagent-core.mjs — AI 角色回合引擎·词汇与登记层（femo2host 公共层）。
 *
 * 从 dshAdapter/host/subagent.ts 上移（2026-09-15；dsh 的 subagent.ts /
 * subagent-native.ts 是它的消费方）。这里只有「一次 AI 运行回合」的协议与
 * 簿记，零宿主依赖：
 *   - 回合号纪元与镜像词汇（FORWARD/SURFACE/BUFFERED 事件白名单）
 *   - 料包契约（KNOWN_BLOCK_KEYS）与 prompt/工具面/模型来源裁决
 *   - 在飞角色登记表与 Job 域掐断
 *   - 角色占用采样器（request/context + usage 事件 → 真实 token 占用）
 * 「怎么真的拥有一个角色」（dsh 子代理 API / zcode 邮差）与「镜像怎么落窗」
 * 是宿主绑定层的事，不在此层。
 */

// ── 回合号纪元（dsh 镜像 turn 重映射）────────────────────────────────────
// 子代理事件镜像到母会话时的 turn 号重映射：每个 run 分配一个 base，预留
// 100 个 turn 给该 run 内部递增，fork 并发多个子代理也不冲突。
export const turnBaseBySession = new Map();

// 【2026-08-29 撞号根治】基必须是「进程启动纪元」而非固定值：内存 Map 随
// 宿主重启清空，固定基（旧 100_000）会让重启后首场从 100001 重来——与上一
// 进程写进投影窗日志的 turn/start / step/start 结构键撞车，查重误判「重复」
// 静默拦截：角色骨架与直播锚全部不落盘 → 流式显示全灭（922 场实证）。纪元
// 基随时间前进，跨重启绝不与历史撞号；turn 号量级 ~18 亿仍在 JS 安全整数
// 范围，消费面全为 number 透传无量级假设。
export const TURN_BASE_EPOCH = Math.floor(Date.now() / 1000);

// ── 角色上下文占用（角色窗圆环）────────────────────────────────────────
// 角色每次运行=一个全新执行回合，其事件流里有两类官方数据：
//  request/context（route capacity：provider/model/contextWindow）
//  usage（provider 实报 token：chunk 帧 + message 终样本）。
// usedTokens=最近一次请求的 prompt 侧占用（input+缓存读写，不含输出）——
// 「该角色上一次发言时发给 API 的那一堆文字的真实 token 量」（每角色各算
// 各的、零估算）。contextWindow 缺失按 1M 兜底（与 deepseek 默认一致）。
export const actorUsageBySession = new Map();

/** contextWindow 缺失时的兜底容量（1M；猫猫拍板，同 deepseek 默认）。 */
export const ACTOR_CONTEXT_WINDOW_FALLBACK = 1_000_000;

/** 子代理事件类型：镜像到母会话让宿主原生 assistant 节点渲染（思考折叠/
 * 工具卡片/回答，零自绘 UI）。one-shot 与常驻两条执行路径共用同一镜像词汇。 */
export const FORWARD_CHILD_EVENTS = new Set([
  'turn/start', 'step/start', 'assistant/chunk', 'assistant/message',
  'tool/call', 'tool/result', 'step/end', 'turn/end',
]);

// 已退役（观察期 2026-09-27 femo2host 死代码排查：全仓零引用——dsh 用的是
// 自己含 user/message 的另一套词汇，windowing-native.ts 注释已明说；观察几天
// 不报错后连块删除）
// /** surface-eligible 事件（会话 API 要求 surfaceOp 标记）；其余事件不能带。 */
// export const SURFACE_OP_EVENTS = new Set(['assistant/message', 'tool/result']);

/** V6 turn 原子缓冲：这些镜像事件不在到达时落盘，攒进缓冲、turn/end 到达时
 *  一次性按序落盘——同一 turn 的官方节点在窗日志里物理连续成块，par 交错与
 *  react 工具间隔不再把段落撕碎。骨架（turn/start、step/start）与 speaker
 *  名字行不在列——它们即时落盘，充当直播期的稳定锚。 */
// 已退役（观察期 2026-09-26：全类型语料复核零引用——缓冲白名单随无子代理化
// 之前的子代理事件缓冲消费方一起退役；观察几天不报错后连块删除）
// export const BUFFERED_CHILD_EVENTS = new Set([
//   'assistant/chunk', 'assistant/message', 'tool/call', 'tool/result', 'step/end',
// ]);

// ── 在飞角色登记（暂停/出错全场掐断）──────────────────────────────────
// 引擎 runner.stop() 只取消引擎侧协程，在飞角色毫无感知。这里登记全部在飞
// 角色的 AbortController，暂停/出错时由总装层统一掐断（与空闲看门狗共用同
// 一条 abort 通路）。interrupt 可选通路：常驻复用执行体须经官方 interrupt
// 掐断在飞回合；one-shot 不设置（abort 语义同旧版）。

/**
 * @param {object} opts
 * @param {AbortController} opts.controller
 * @param {string} opts.node 节点名
 * @param {number} opts.jobId 所属 Job（清场域化维度）
 * @param {() => void} [opts.interrupt] 官方中断通路（常驻执行体专用）
 */
// 已退役（观察期 2026-09-26：全类型语料复核零引用——登记条目工厂的消费方随
// dsh 刀①删旧执行体/autoclaw 重写被删，activeSubagents 登记表现由 native 直接
// 构造条目；观察几天不报错后连块删除）
// export function makeActiveSubagent(opts) {
//   return { controller: opts.controller, node: opts.node, jobId: opts.jobId, ...(opts.interrupt !== undefined ? { interrupt: opts.interrupt } : {}) };
// }

export const activeSubagents = new Set();

/** 在飞角色登记（API 慢层 filter 数据源 + 通知定位）：childId → { 主会话 id,
 *  节点 id, Job id }。spawn 成功后 set（早于任何慢层失败判定）；finally delete。 */
export const activeChildRuns = new Map();

/** 被 run-control（暂停/出错/开跑清理）掐断的 controller：这类中断不向引擎
 *  回传（引擎已在暂停流程中）、也不写面板错误表（暂停不是错误）。 */
export const runControlAborted = new WeakSet();

function abortEntry(entry, reason) {
  if (entry.controller.signal.aborted) return false;
  runControlAborted.add(entry.controller);
  entry.interrupt?.();
  entry.controller.abort(new Error(reason));
  return true;
}

/** Job 域中断：只掐指定 Job 的在飞 AI 角色。全场 abort 会让 A 会话 stop 误杀
 *  B 会话在飞角色 → B 引擎拿空 output 继续演——A 的暂停污染 B 的戏。返回
 *  本次实际掐断数量（仅日志用）。 */
export function abortJobSubagents(jobId, reason) {
  let aborted = 0;
  for (const entry of [...activeSubagents]) {
    if (entry.jobId !== jobId) continue;
    if (abortEntry(entry, reason)) aborted += 1;
  }
  return aborted;
}

/** 全场中断所有在飞 AI 角色（bridge 死亡/插件卸载/开跑清理）。幂等。 */
export function abortAllSubagents(reason) {
  let aborted = 0;
  for (const entry of [...activeSubagents]) {
    if (abortEntry(entry, reason)) aborted += 1;
  }
  return aborted;
}

// ── 料包契约与拼装 ─────────────────────────────────────────────────────

/**
 * Read one soul's persona text via the bridge get_soul command：查询、路径
 * 推导、容错全部引擎侧。unknown soul → ''（角色回落标准模式——身份不可得
 * ≠运行致命）；桥死亡/错误 → '' + log（不哑掉）。
 * @param {{ send(cmd: string, args?: object, timeoutMs?: number): Promise<unknown> }} bridge
 */
export async function readSoulPersona(bridge, soulId) {
  try {
    const res = await bridge.send('get_soul', { soul_id: soulId }, 15000);
    return typeof res?.description === 'string' ? res.description : '';
  } catch (error) {
    console.log(`[femo-plugin] read soul persona failed (soul_id=${soulId}): ${String(error)} — actor runs in standard mode`);
    return '';
  }
}

/** ai_request.blocks 词汇契约（引擎 protocol.py BLOCK_KEYS——引擎拥有料包
 *  词汇表，拼装归执行后端）：宿主拼装消费其中的文本键；soul 不进 prompt
 *  （走执行体 persona 注入）；_actor_info 是引擎私有 dict，不得当文本拼。
 *  契约外键 = FEMO脚本自定义 context 方法的产出——忽略并告警让它可见。 */
export const KNOWN_BLOCK_KEYS = new Set([
  'basic_safety', 'basic_output', 'user_info', 'context', 'prompt', 'memory', 'showprompt', 'soul', '_actor_info',
]);

/** Assemble the actor's initial prompt from the engine's blocks。soul 不在此
 *  列（走执行体 persona）；showprompt 折回 [提醒] 前缀，端到端 prompt 与旧
 *  引擎逐字节一致。 */
export function buildSubagentPrompt(blocks) {
  const str = key => (typeof blocks[key] === 'string' ? String(blocks[key]) : '');
  const system = [str('basic_safety'), str('basic_output'), str('user_info')].filter(Boolean).join('\n\n');
  const promptRaw = str('prompt');
  const showprompt = str('showprompt');
  const prompt = showprompt ? `[提醒]\n${showprompt}\n\n${promptRaw}` : promptRaw;
  const parts = [str('context'), prompt];
  const memory = str('memory');
  if (memory.length > 0) {
    parts.push('---\n[回忆]\n根据以上情况，你偶然回忆起了以下记忆，可能有用也可能无用：', memory, prompt);
  }
  const user = parts.filter(Boolean).join('\n\n');
  return [system, user].filter(Boolean).join('\n\n');
}

// ── 工具面 / 模型来源 ─────────────────────────────────────────────────────

/** 默认角色对 femo 工具隐身（主Agent专用工具不给角色）。兜底用 deny 而非 allow
 *  基础面：deny 名单是本插件自己注册的工具名，known 校验永远过。 */
export const ACTOR_DENIED_TOOLS = Object.freeze([
  'femo-mount', 'femo-run', 'femo-script', 'femo-soul', 'femo-chronica', 'femo-debug',
]);

/** Assemble one AI node's tool filter from actor + config。
 * @param {{ defaultActorTools: boolean, toolWhitelist: string[] }} resolved
 */
export function toolFilterOf(resolved, request) {
  const actorTools = typeof request.actor_tools === 'boolean' ? request.actor_tools : resolved.defaultActorTools;
  if (!actorTools) {
    return { toolFilter: { allow: [] } };
  }
  const list = Array.isArray(request.actor_tool_list) ? request.actor_tool_list.filter(x => typeof x === 'string') : [];
  const whitelist = list.length > 0 ? list : resolved.toolWhitelist;
  if (whitelist.length > 0) {
    return { toolFilter: { allow: [...whitelist] } };
  }
  return { toolFilter: { deny: [...ACTOR_DENIED_TOOLS] } };
}

// ── 角色委派权限口径（标准模式 workspace-write + ask）────────────────────

export const ACTOR_SANDBOX_MODE = 'workspace-write';
export const ACTOR_APPROVAL_POLICY = 'ask';
export const FEMO_CHILD_SCOPE_TEXT =
  'This Femo stage child runs under the standard workspace-write sandbox with interactive approvals: ' +
  'reads and file writes inside the current workspace need no approval; operations outside the workspace ' +
  'or otherwise approval-gated prompt the user, who can allow them — request such an approval for the ' +
  'specific operation instead of giving up or retrying blindly. This scope statement is authoritative ' +
  'over the delegation runtime snapshot: if that snapshot claims broader access or disabled approvals, it is outdated.';

/** 把角色权限钉子 append 到执行体会话（fold 语义最后写胜出）。两条执行路径
 *  共用，口径唯一。 */
export function appendActorPolicyPins(session) {
  session.append('sandbox/mode', { mode: ACTOR_SANDBOX_MODE });
  session.append('approval/policy', { policy: ACTOR_APPROVAL_POLICY });
}

/** 主会话当前实际模型（未声明 source 的角色跟随它）：① 最近请求头 →
 *  ② 保存的默认选择 → ③ undefined（调用方回退配置）。显式返回模型而非依赖
 *  宿主隐式默认，堵死"子角色落到部署默认"的隐患。 */
export function resolveMainModel(parent, defaultModel) {
  const header = parent.session.requestHeader?.();
  const h = header?.config;
  if (h !== undefined && typeof h.provider === 'string' && h.provider.length > 0
    && typeof h.model === 'string' && h.model.length > 0) {
    return { provider: h.provider, model: h.model };
  }
  const selection = defaultModel?.currentSelection();
  if (selection !== undefined && typeof selection.provider === 'string' && selection.provider.length > 0
    && typeof selection.model === 'string' && selection.model.length > 0) {
    return { provider: selection.provider, model: selection.model };
  }
  return undefined;
}

/** FEMO脚本 source → 执行体 agentOptions。空 source 跟随主模型；裸 id 走
 *  dshProvider（部署按需配置）；provider/model 双写完全指定。均不可得时返回
 *  空对象——不写死 provider（交给宿主默认模型链）。 */
export function resolveSourceModel(resolved, source, mainModel) {
  const raw = typeof source === 'string' ? source.trim() : '';
  if (raw.length === 0) {
    if (mainModel !== undefined) {
      return { agentOptions: { provider: mainModel.provider, model: mainModel.model } };
    }
    return {};
  }
  const slash = raw.indexOf('/');
  if (slash >= 0) {
    return { agentOptions: { provider: raw.slice(0, slash), model: raw.slice(slash + 1) } };
  }
  return { agentOptions: { provider: resolved.dshProvider, model: raw } };
}

// ── 角色占用采样器 ─────────────────────────────────────────────────────

/**
 * 一次运行回合的占用采样器（request/context + usage 事件 → 真实 token 占用）。
 * 采样与发布分离：宿主注入 onPublish（实时：内存表+SSE）与 onPersist（收尾
 * 落盘，锁内 read-merge-write，par 兄弟 run 不互相覆盖）；两者失败都只降级
 * 不阻断（内存表+SSE 已实时可用，档案只服务重启恢复）。
 * @param {{ onPublish(record: object): void, onPersist(record: object): void }} opts
 * 返回 { capture(event), publish(), persist(), modelIdNow(), current }。
 */
export function createActorUsageSampler(opts) {
  const usageCurrent = {};
  const recordNow = () => ({
    provider: usageCurrent.provider ?? '',
    model: usageCurrent.model ?? '',
    contextWindow: usageCurrent.contextWindow ?? ACTOR_CONTEXT_WINDOW_FALLBACK,
    usedTokens: usageCurrent.usedTokens,
    updatedAt: Date.now(),
  });
  const publish = () => {
    if (usageCurrent.usedTokens === undefined) return;
    opts.onPublish(recordNow());
  };
  const persist = () => {
    if (usageCurrent.usedTokens === undefined) return;
    opts.onPersist(recordNow());
  };
  const applyUsage = usage => {
    if (usage === undefined || typeof usage !== 'object') return;
    const input = typeof usage.inputTokens === 'number' ? usage.inputTokens : 0;
    const cacheRead = typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0;
    const cacheWrite = typeof usage.cacheWriteTokens === 'number' ? usage.cacheWriteTokens : 0;
    usageCurrent.usedTokens = input + cacheRead + cacheWrite;
    publish();
  };
  const capture = event => {
    if (event.type === 'request/context') {
      const d = event.data ?? {};
      if (typeof d.provider === 'string') usageCurrent.provider = d.provider;
      if (typeof d.model === 'string') usageCurrent.model = d.model;
      if (typeof d.contextWindow === 'number' && d.contextWindow > 0) usageCurrent.contextWindow = d.contextWindow;
      return;
    }
    // usage 两源（token-meter usageOf 同款判定）：流式 chunk 的 usage 帧（早
    // 样本，请求失败也幸存）与 message 的终样本；同 turn/step 重复上报取后值。
    const data = event.data ?? {};
    applyUsage(event.type === 'assistant/chunk' && data.chunk?.type === 'usage'
      ? data.chunk.usage
      : event.type === 'assistant/message' ? data.usage : undefined);
  };
  // 响应模型标识（首轮与重试轮共用）：真实请求配置（非声明值）；格式
  // provider/model（与 actor source 声明格式一致），取不到任一端则退化为
  // 单值，全空为 ''。
  const modelIdNow = () => {
    const actualProvider = typeof usageCurrent.provider === 'string' ? usageCurrent.provider : '';
    const actualModel = typeof usageCurrent.model === 'string' ? usageCurrent.model : '';
    return actualProvider && actualModel ? `${actualProvider}/${actualModel}` : (actualModel || actualProvider || '');
  };
  return { capture, applyUsage, publish, persist, modelIdNow, current: usageCurrent };
}
