/**
 * run-state-core.mjs — 运行态镜簿骨架（femo2host 公共层，2026-09-23 批次 D）。
 *
 * 「一次运行在宿主侧的抄本」：Job 镜像状态机（prearm→correct→setState→clear
 * 生命周期、活跃指针、节点登记表、waitingHuman 快照）与全部推导查询。纯数据
 * +纯转移，零宿主依赖、零 IO、零显示——广播/落窗是宿主插座的事（dsh 侧由
 * engine-events 的再导出壳在状态变化时推 run_state/projection_state）。
 *
 * 状态权威在引擎（runs/<job_id>.json），镜簿只是翻译层+索引——三条对账源
 * （§八.11）：①job_start/job_resume 命令回执（prearm，最早证据）②引擎事件
 * 到达（correct/setState 校正）③进程死亡（宿主清账）。nodeActors/nodeScopes/
 * nodeShowprompts 随 Job 生灭——同一节点名跨 Job 复用是 A4 串台的一半病根。
 *
 * 纯函数风格：全部函数吃 state（结构兼容即可：{jobs,sidIndex,activeJobId}），
 * 不包裹、不 class——宿主把自己的 extras（sessionActors/errors 等）挂在同一
 * 个对象上，结构子类型天然兼容。
 */

/** 生命周期登记（命令成功回执即调，§八.11 最早证据）——pre-step 守卫在
 *  flow_start 到达前的秒级窗口不再裸奔。 */
export function jobMirrorPrearm(state, jobId, ownerSid) {
  state.jobs.set(jobId, {
    jobId,
    ownerSid,
    state: 'running',
    nodeActors: new Map(),
    nodeScopes: new Map(),
    nodeShowprompts: new Map(),
  })
  state.sidIndex.set(ownerSid, jobId)
  state.activeJobId = jobId
}

/** flow_start 到达校正（幂等）：镜像未登记（理论不可达，防御）则补建。 */
export function jobMirrorCorrect(state, jobId, ownerSid) {
  const mirror = state.jobs.get(jobId)
  if (mirror !== undefined) return
  jobMirrorPrearm(state, jobId, ownerSid)
}

/** 状态翻转。返回 'changed' | 'unchanged'（同态不重复）——宿主广播与否据此
 *  判定（run_state 随真变化伴生，B7 死于结构：不再有本地兜底覆盖）。 */
export function jobMirrorSetState(state, jobId, newState) {
  const mirror = state.jobs.get(jobId)
  if (mirror === undefined || mirror.state === newState) return 'unchanged'
  mirror.state = newState
  return 'changed'
}

/** running→suspended（可续跑）+ 清活跃指针（镜像本身保留供 /session-state
 *  等消费）。返回 'changed' | 'unchanged'（同 jobMirrorSetState）。 */
export function jobMirrorClear(state, jobId) {
  const mirror = state.jobs.get(jobId)
  if (mirror === undefined) return 'unchanged'
  let result = 'unchanged'
  if (mirror.state === 'running') {
    mirror.state = 'suspended'
    result = 'changed'
  }
  if (state.activeJobId === jobId) state.activeJobId = undefined
  return result
}

/** 清活跃指针（终态三兄弟共用；state 翻转由 jobMirrorSetState 承担）。 */
export function clearActiveIfActive(state, jobId) {
  if (state.activeJobId === jobId) {
    state.activeJobId = undefined
    return true
  }
  return false
}

/** 本会话绑定的 Job 是引擎活跃 Job？（pre-step 守卫判定源——现状
 *  "running && owner 匹配 && 活跃"三条件。） */
export function isSessionRunning(state, sessionId) {
  const jobId = state.sidIndex.get(sessionId)
  if (jobId === undefined) return false
  const mirror = state.jobs.get(jobId)
  return mirror !== undefined && mirror.state === 'running' && state.activeJobId === jobId
}

/** 会话的活跃/最近 Job 镜像（routes/projection-input/tools 消费）。 */
export function activeJobOf(state, sessionId) {
  const jobId = state.sidIndex.get(sessionId)
  return jobId === undefined ? undefined : state.jobs.get(jobId)
}

/** 投影窗 composer 按钮状态的权威推导（2026-09-06 猫猫拍板：各投影窗发送/
 * 停止钮按「窗型×FEMO脚本态」统一控制）：
 *  running=本会话 Job 是引擎活跃 Job 且 running；waiting=running 且 human 节点
 *  等输入；waitScope=等待节点 scope 的原始角色名列表（判定哪个角色窗是人类窗
 *  ——AI 角色不会出现在 human 节点 scope，天然区分）。
 * 【2026-09-08 修复】waitScope 优先 human_wait 到达时冻结的现场快照（par 并发
 * 同名节点互相覆盖免疫，引擎保证含执行者本人）；快照缺失（理论防御：旧形态
 * 事件不带 scope）才回退 nodeScopes 事后查表。 */
export function projectionStateOf(state, mainSid) {
  const job = activeJobOf(state, mainSid)
  const running = job !== undefined && job.state === 'running' && state.activeJobId === job.jobId
  const waiting = running && job.waitingHuman !== undefined
  const waitScope = waiting
    ? (job.waitingHuman?.waitScope
      ?? (job.waitingHuman?.nodeName !== undefined ? job.nodeScopes.get(job.waitingHuman.nodeName) ?? [] : []))
    : []
  return {
    running,
    waiting,
    waitScope,
    outVars: waiting ? job.waitingHuman?.outVars ?? [] : [],
    ...(waiting ? { prompt: job.waitingHuman?.prompt } : {}),
  }
}

// ── 节点登记表（随 Job 生灭，A4 串台根治）────────────────────────────

export function noteNodeScope(mirror, nodeName, scope) {
  if (nodeName !== undefined && scope !== undefined) mirror.nodeScopes.set(nodeName, scope)
}

export function noteNodeActor(mirror, nodeName, actorName) {
  if (nodeName !== undefined && actorName !== undefined && actorName.length > 0) {
    mirror.nodeActors.set(nodeName, actorName)
  }
}

export function noteNodeShowprompt(mirror, nodeName, showprompt) {
  if (showprompt !== undefined && nodeName !== undefined) mirror.nodeShowprompts.set(nodeName, showprompt)
}

// ── waitingHuman 快照（2026-09-24 B1 收编）────────────────────────────

/** human_wait 引擎事件 → 等待快照（全量 8 字段，dsh mirror 形状=权威）。
 *  字段现场冻结：scope/outVars 由事件自带（2026-09-08 修复口径：par 并发
 *  同名节点互相覆盖免疫，引擎保证 scope 含执行者本人），不事后查表。 */
export function waitingHumanFromEvent(d) {
  d = d ?? {}
  return {
    waitKey: String(d.wait_key ?? ''),
    nodeName: typeof d.node_name === 'string' ? d.node_name : undefined,
    context: typeof d.context === 'string' ? d.context : '',
    memory: typeof d.memory === 'string' ? d.memory : '',
    showprompt: typeof d.showprompt === 'string' ? d.showprompt : undefined,
    prompt: typeof d.prompt === 'string' ? d.prompt : '',
    outVars: Array.isArray(d.out_vars) ? d.out_vars.filter(x => typeof x === 'string') : [],
    waitScope: Array.isArray(d.scope) ? d.scope.filter(x => typeof x === 'string') : undefined,
  }
}

/** 写镜像等待快照（SET 后的广播/诊断是宿主插座的事，本层只管账）。 */
export function setMirrorWaitingHuman(mirror, snapshot) {
  mirror.waitingHuman = snapshot
  return 'changed'
}

/** 清镜像等待快照（human_done 正常/超时放行、flow_paused、bridge_run_ended
 *  三触发点共用）。返回 'changed' | 'unchanged'（同 jobMirrorSetState 约定）。 */
export function clearMirrorWaitingHuman(mirror) {
  if (mirror.waitingHuman === undefined) return 'unchanged'
  mirror.waitingHuman = undefined
  return 'changed'
}

/** 运行守卫（§8.3 GUARD 同款判定，handleRunOnSession/handleCreateSession/
 *  femo_mount 工具门共用）：引擎有活跃 Job 即拒，错误文案带活跃 Job 归属
 *  （信息化——跨会话语义：可先暂停或等它挂起）。他 session 活跃由引擎
 *  another_job_active 二次拒绝兜底（原话上浮）。 */
export function assertRunAllowed(state, sessionId) {
  const activeId = state.activeJobId
  if (activeId === undefined) return
  const mirror = state.jobs.get(activeId)
  const owner = mirror?.ownerSid ?? '?'
  const where = owner === sessionId ? '本会话' : `另一会话（${owner}）`
  throw new Error(`${where}的 Job ${activeId} 活跃中，可先暂停或等它挂起`)
}
