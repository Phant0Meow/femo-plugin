/**
 * shared/run-core.mjs — FEMO 运行控制回执的判断（唯一一份）。
 */

/** 工具回执 → 一句人话（挂载/启动/继续/暂停；其余原样 JSON 兜底）。
 *  挂载行跟绝对地址（2026-10-01 用户拍板：编译信息不展示——那是引擎的语法
 *  检查，有错本来就走错误行；用户对的是文件路径，不是编译器内部话）。 */
export function runResultBrief(r) {
  if (r?.error) return `错误：${r.error}`;
  if (r?.mounted) return `已挂载：${r.path ?? r.script ?? 'unsaved'}`;
  if (r?.started) return `已启动：job ${r.job_id}`;
  if (r?.resumed) return `已继续：job ${r.job_id}`;
  if ('paused' in (r ?? {})) return `暂停：job ${r.job_id} — ${r.note ?? 'ok'}`;
  return JSON.stringify(r);
}

/** 从运行回执里取 job id（started/resumed 各页记下来给「继续」用）；没有则 undefined。 */
export function jobIdFromRunResult(r) {
  return (r?.started || r?.resumed) ? String(r.job_id ?? '') : undefined;
}
