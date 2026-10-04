/**
 * notice-core.mjs — 停下时刻通知（host 无关公共层，femo2host）。
 *
 * 「通知主模型」链路的公共一半（2026-09-16 system_push 落地）：
 *   产信=桥（事件现场，先信后事件）→ 放柜=mailbox（急件放行滞留件）
 *   → 代取=桥 collect_notices → 拼词=本文件 formatStopNotice（唯一一份措辞）
 *   → 投递=宿主薄件（dsh=steerMainAgent；zcode=Stop 钩子到站取，拉模式不经
 *     代取，但拼词同一份）。
 *
 * 停下信号表（STOP_SIGNALS）：宿主在哪些引擎事件上喊话——
 *   flow_error / flow_paused 各自事件现场（宿主 handler 先落状态再喊，
 *   isSessionRunning 已 false，不被 pre-step 门卫吞）；
 *   bridge_run_ended（worker run() 返回后）而非 flow_done——引擎逻辑完成时
 *   角色 settled 通知还在飞，早喊会被空轮吃掉（Job 761 实证）。
 * 这张表原是 dsh engine-events 注释里的私有知识，现升公共规则，产信时机在
 * 桥侧一并对齐（跑完急件由桥在 bridge_run_ended 才产）。新宿主接通知只需：
 * 在这三个信号上代取（bridge collect_notices）→ formatStopNotice → 投递。
 */

export const STOP_SIGNALS = new Set(['flow_error', 'flow_paused', 'bridge_run_ended']);

/** 事件是否为停下信号（宿主喊话时机判定）。 */
export function isStopSignal(eventType) {
  return STOP_SIGNALS.has(eventType);
}

/**
 * 把一次代取的信包拼成给主模型的一段话（唯一措辞，两宿主共享）。
 * @param {object} opts
 * @param {number}  opts.jobId
 * @param {'finished'|'failed'|'paused'} opts.outcome   宿主从自己的状态镜像判定
 * @param {string}  [opts.detail]    failed 时的错误原文（事件字段；缺省回落急件信文）
 * @param {Array<{kind?:string, payload?:string, delivery?:string, subkind?:string}>} [opts.letters]
 *     代取回的信包；subkind='error' 进错误段、'warning' 进警告段（桥产信时标），
 *     终局急件信（无 subkind）不进正文——它的内容由标题承担。
 * @param {string}  [opts.tag='[femo-plugin]']  行首标签（宿主自品牌，zcode 用 '[femo]'）
 * @param {boolean} [opts.panelNote=true]  错误段尾注「完整清单见错误面板」（dsh 有
 *     错误面板；无面板的宿主传 false）
 */
export function formatStopNotice({ jobId, outcome, detail, letters = [], tag = '[femo-plugin]', panelNote = true }) {
  const errors = [];
  const warnings = [];
  for (const x of letters) {
    if (x === null || typeof x !== 'object') continue;
    if (x.kind !== 'notice') continue;
    const text = String(x.payload ?? '').trim();
    if (text.length === 0) continue;
    if (x.subkind === 'error') errors.push(text);
    else if (x.subkind === 'warning') warnings.push(text);
  }
  let headline;
  if (outcome === 'finished') {
    headline = `✅ Job ${jobId} 已完整跑完。若要重跑请用 fresh_start（不能 resume 续跑）。`;
  } else if (outcome === 'failed') {
    const err = detail !== undefined && detail.length > 0
      ? detail
      : String(letters.find(x => x !== null && typeof x === 'object'
          && x.kind === 'notice' && x.delivery === 'urgent')?.payload ?? 'unknown error');
    headline = `❌ 运行出错。错误信息：${err}——可修复FEMO脚本后再 fresh_start。`;
  } else {
    headline = `⏸ 已暂停（挂起，断点保留）。可用 resume 续跑或 fresh_start 重跑。`;
  }
  let text = `${tag} FEMO 运行结果：${headline}`;
  if (errors.length > 0) {
    text += `\n\n⚠️ 以下节点出现过脚本错误：\n- ${errors.join('\n- ')}`;
    if (panelNote) text += '\n完整清单见错误面板。';
  }
  if (warnings.length > 0) {
    text += `\n\nℹ️ 以下警告出现过（不阻断，供修FEMO脚本参考）：\n- ${warnings.join('\n- ')}`;
  }
  return text;
}

/** FEMO脚本状态广播词（2026-09-23 单份化，十连裁后批次 D 措辞收口）：flow_done/
 *  flow_error/flow_paused 落到会话窗的终局行，措辞唯一权威在此——历史漂移
 *  实证：event-core v1 曾写「⏹ FEMO 已停止」，dsh 是「⏸ FEMO 已暂停」（09-12
 *  stop→pause 改名后的权威口径），以此为准拽正（2026-09-24 event-core 三处
 *  改吃本表，漂移源头清除）。 */
export const PLAY_BROADCAST = {
  done: '✅ FEMO 已跑完',
  error: (detail) => `❌ FEMO 运行出错：${detail}`,
  paused: (detail) => `⏸ FEMO 已暂停（可续跑）${detail ? `：${detail}` : ''}`,
};
