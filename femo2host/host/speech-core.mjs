/**
 * speech-core.mjs — 交卷信封构造（host 无关公共层，femo2host）。
 *
 * 节点发言第二阶段的 speech 信封词汇表唯一出处（2026-09-20 抽取）：信进驿站
 * （mailbox.post 八维）→ 桥出站轮询喂引擎（deliver_human_input）。此前 dsh
 * 投影窗 feedHumanNode 与 zcode event-core submitOutput 各拼一份、投影页
 * human_input 是第三份——本文只收口**宿主侧 TS 一份**（python 侧的信封权威
 * 本就是 mailbox.post 签名本身，hub/桥同进程直调，无重复）。
 *
 * 【2026-09-21 全面收口】公共层内部的第四份手拼（event-core.submitOutput）改用
 * executorSpeechArgs；新增 submitHumanOutput 给 zcode 网关——引擎人类节点只读
 * chat_text/variables，{output} 形态会被读成空台词（zcode 人类席现行 bug 修正）。
 * executorSpeechArgs 增 modelId（角色落库 model_id，subagent-native 同款字段）。
 *
 * 两类交卷体（body 词汇，引擎按此直取）：
 *  · 人类席：{chat_text, variables?}——变量赋值绕过引擎 chat_text 文本解析
 *    （_try_apply_human_variables 直取，人类指令跟随差的根治路）；
 *  · 执行体（主Agent/AI 角色）：{steps}——steps=TranscriptStep 生料
 *    （契约见 femoCompiler/protocol.py）。
 *
 * 【output 字段退役（2026-09-27 用户拍板）】台词唯一正身=steps 末步的 reply——
 * 一个回合按序发生：先思考、（可能）用工具、最后开口说话，所以读末步。宿主
 * 调用面不变（output 参数照传），信封构造时把它合并进末步 reply（宿主自填的
 * reply 不覆写；没 steps 合成单步），body 不再携带 output 字段——引擎交接面
 * 的 output 由驿站 handin 时派生注入（mailbox.last_step_reply，引擎零感知）。
 * 读台词的唯一入口=lastStepReply()（Python 孪生=mailbox.last_step_reply）。
 */

/** 读交卷体的台词：steps 末步的 reply；steps 非列表/末步非字典/没填 = 空串。 */
export function lastStepReply(steps) {
  const list = Array.isArray(steps) ? steps : []
  const last = list.length > 0 ? list[list.length - 1] : undefined
  return last && typeof last === 'object' ? String(last.reply ?? '') : ''
}

/** 人类席交卷信封（post_speech 参数）。soul 缺省 'human'；dsh 传等待 scope
 *  首选、投影页传引擎报的执行者名——soul 只进驿站账本，引擎路由只认 ref。 */
export function humanSpeechArgs({ jobId, waitKey, soul, node, text, variables = {} }) {
  const cleanVars = {}
  for (const [k, v] of Object.entries(variables ?? {})) {
    if (typeof v === 'string' && v.trim().length > 0) cleanVars[k] = v.trim()
  }
  return {
    job_id: jobId,
    wait_key: waitKey,
    soul: soul || 'human',
    ...(node ? { node } : {}),
    payload: text,
    body: { chat_text: text, ...(Object.keys(cleanVars).length > 0 ? { variables: cleanVars } : {}) },
  }
}

/** 执行体（主Agent/AI 角色）交卷信封（post_speech 参数）。output 参数=台词
 *  文本（构造时合并进末步 reply，信封上不再有 output 字段）；steps 可不给。 */
export function executorSpeechArgs({ jobId, waitKey, soul = 'main', node, output, steps, modelId }) {
  const merged = (Array.isArray(steps) ? steps : [])
    .map(s => (s && typeof s === 'object' ? { ...s } : { reply: String(s ?? '') }))
  if (merged.length > 0) {
    const last = merged[merged.length - 1]
    if (String(last.reply ?? '').trim().length === 0) last.reply = output
  } else {
    merged.push({ step: 0, reply: output })
  }
  return {
    job_id: jobId,
    wait_key: waitKey,
    soul,
    ...(node ? { node } : {}),
    payload: output,
    body: {
      steps: merged,
      ...(modelId === undefined ? {} : { model_id: modelId }),
    },
  }
}
