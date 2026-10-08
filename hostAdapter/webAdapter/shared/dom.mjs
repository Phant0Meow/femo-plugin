/**
 * shared/dom.mjs — 侧栏面板与操作台两页共用的小五金。
 *
 * 归属：适配器内的「判断层」——只放两页都要的判断与铁工具；呈现（HTML 画法、
 * 样式）留各页，谁家独用的东西不住这里（私产下推同款纪律）。磁盘上只有这一份：
 * 扩展侧（sidepanel）打进扩展包 import；操作台（console）由本地服务的
 * /console/shared/ 静态路由伺候同一批文件。
 */

/** 查元素（两页脚本的原用法同名同义）。 */
export const $ = sel => document.querySelector(sel);

/** HTML 转义：属性/文本两用（连单引号一起逃——旧版两页各写一半漂移过，收编）。 */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 会话 id 展示缩写（前 8 位）。 */
export function shortId(sid) { return String(sid).slice(0, 8); }

/** toast 工厂：绑一个提示元素，返回 toast(msg, isErr)。两页同款节奏；错误态
 *  驻留拉长（8s vs 正常 2.6s）——带路径的操作指引两三秒读不完，一闪而过
 *  等于没说（2026-09-29：一键启动首次指引带全路径，读时长是硬需求）。 */
export function createToast(el) {
  let timer = 0;
  return (msg, isErr = false) => {
    el.textContent = msg;
    el.classList.toggle('err', isErr);
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), isErr ? 8000 : 2600);
  };
}
