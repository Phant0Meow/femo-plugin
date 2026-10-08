/**
 * shared/human-seat-core.mjs — 人类席画面侧拼装（唯一一份）。
 *
 * 契约与投影中心人类输入席同一套（composer 2026-09-24 定稿）：只收非空值；
 * 提交时结构化 variables 随信 + 台词末尾按 FEMO脚本语言原样拼
 * SET VARIABLE: <<名 = 值>> 行（显示与文本解析双保险）。
 * 侧栏全功能在先；操作台共用后补齐变量赋值（此前只会发纯文本——漂移实案）。
 *
 * 赋值钮显隐判据（原 hasOutVars）2026-09-28 收编上移：判定唯一活在公共层
 * hub-render-core.hasOutVars，服务端引用后盖成 /state.waitingHuman.hasOutVars
 * 布尔随镜像下发，两端只照布尔显隐（扩展页受浏览器安全策略所限、引不到扩展根
 * 外的公共层文件——判定集中到服务端正是为绕开这堵墙）。
 */

/** 等待态签名：回合或变量清单变了 → 草稿作废（各页据此重建面板、清空台词）。 */
export function humanWaitKey(hw) {
  return hw ? `${String(hw.waitKey)}\u0000${(hw.out_vars ?? []).map(x => String(x)).join('\u0000')}` : '';
}

/** 收拢草稿：只留非空值（前后空白剥掉，剥完为空的键丢掉）。 */
export function collectNonEmptyVars(draft) {
  const out = {};
  for (const [k, v] of Object.entries(draft ?? {})) {
    const t = String(v ?? '').trim();
    if (t) out[k] = t;
  }
  return out;
}

/** 组装人类席提交。返回 {text, variables}；发言与赋值一项都没有 → {error}。
 *  text = 台词 + 变量行（SET VARIABLE 原样拼），variables = 结构化值（双保险）。
 *  ⚠️ 已知镜像（2026-09-29）：本函数的判据正身=公共层
 *  hub-render-core.composeHumanSubmission（投影中心/dsh 同吃）——扩展页引不到
 *  扩展根外的公共层文件（浏览器安全墙），墙内留同形镜像；改动两处同改。
 *  （segHostOf 跨语言镜像同款 tolerance。） */
export function composeHumanSubmission(textRaw, draft) {
  const text = String(textRaw || '').trim();
  const variables = collectNonEmptyVars(draft);
  if (!text && Object.keys(variables).length === 0) {
    return { error: '发言与赋值至少有一项。' };
  }
  const lines = [text]
    .concat(Object.keys(variables).map(n => `SET VARIABLE: <<${n} = ${variables[n]}>>`))
    .filter(p => p.length > 0);
  return { text: lines.join('\n'), variables };
}

/** /answer 回执 → 成败与人话（唯一一份，主Agent/人类两席同吃）：
 *  result=post_speech 小票，posted=true 才算投递成功（信进了引擎；引擎不用
 *  ok 这个词）。拒收（wait_key 对不上、信封词汇错位等）原样把错误亮出来，
 *  卡不收、改改就能重寄。此前操作台只看 answered，拒收也报成功并清掉用户
 *  刚打的稿子（2026-09-29 漂移实案，随本判据收编归正）。 */
export function answerOutcome(r) {
  if (r?.answered && r.result?.posted === true) return { ok: true, message: '已投递。' };
  return { ok: false, message: `投递失败：${r?.result?.error ?? r?.error ?? '引擎没有应答'}` };
}
