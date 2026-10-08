/**
 * shared/guard.mjs — 重画护栏（两页同款纪律的唯一一份）。
 *
 * 纪律：数据没变不重画；用户正在输入时不重画——轮询重建 DOM 会把焦点/光标
 * 拆掉（「光标出现一下就消失」「未绑定不刷新」的实测坑，判据只认 INPUT/
 * TEXTAREA：按钮焦点不挡重画，挡死了绑定结果出不来——侧栏先修的坑，操作台
 * 共用后一并吃到）。
 */

/**
 * 造一个护栏。想重画时问 guard.skip(sig, containerEl)：
 *   sig 与上次相同            → true（数据没变）；
 *   焦点在 containerEl 里的输入框上 → true（正在输入；sig 不记，失焦后下一轮再画）；
 *   否则                      → false（记下 sig，可以画）。
 */
export function createRepaintGuard() {
  let lastSig = '';
  return {
    skip(sig, containerEl) {
      if (sig === lastSig) return true;
      const ae = document.activeElement;
      if (containerEl && ae && containerEl.contains(ae)
          && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return true;
      lastSig = sig;
      return false;
    },
  };
}
