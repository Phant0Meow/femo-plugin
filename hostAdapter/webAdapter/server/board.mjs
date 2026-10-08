/**
 * board.mjs — 网页版宿主幕布落点（v1 空壳，薄）。
 *
 * event-core 分诊台的 board 契约：{ ensureWindows(actors), chat(text, rowOpts, scopeOpts) }。
 *
 * 本宿主 v1 的幕布 = 桥内嵌投影中心（femo_bridge.py 启动即自动拉起 hub，引擎
 * 事件由桥的事件回调原样投影上墙）——宿主侧无需再写任何投影行（autoclaw 同款
 * 形态 B 短路，空壳即正解）。保守起见 chat() 仍把行文本写进环形缓冲（runlog），
 * 供操作台展示最近动态，也可在诊断时证明「事件确实到了宿主」。
 */

const MAX_RUNLOG = 200;

export function createBoard({ log = () => {} } = {}) {
  const runlog = []; // {t, kind, text, actor?} 环形缓冲

  function record(text, rowOpts) {
    runlog.push({
      t: Date.now(),
      kind: String(rowOpts?.kind ?? 'sys'),
      actor: rowOpts?.actor !== undefined ? String(rowOpts.actor) : undefined,
      text: String(text),
    });
    if (runlog.length > MAX_RUNLOG) runlog.splice(0, runlog.length - MAX_RUNLOG);
  }

  return {
    runlog,
    /** board 契约①：启动运行确保角色窗存在（v1 无自有窗体，记账即可）。 */
    ensureWindows(actors) {
      if (Array.isArray(actors) && actors.length > 0) {
        log(`board: windows ensured for [${actors.join(', ')}] (projection = bridge hub)`);
      }
    },
    /** board 契约②：落一行公告（v1 只进 runlog；真实幕布在桥内嵌 hub）。 */
    chat(text, rowOpts = {}, scopeOpts = {}) {
      record(text, rowOpts);
      log(`board: [${rowOpts?.kind ?? 'sys'}] ${String(text).slice(0, 120)}`);
      return { ok: true, sink: 'bridge-hub' };
    },
  };
}
