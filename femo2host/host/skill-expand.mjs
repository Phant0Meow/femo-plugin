/**
 * skill-expand.mjs — 宿主附录 {{INCLUDE}} 展开器（唯一一份，2026-09-29 收编）。
 *
 * 「教条分两层」的装配机械（判据见 hostAdapter 守则 §四：公用正文唯一份活在
 * femoGenConnector/SKILL.common.md，宿主附录经 {{INCLUDE:路径}} 引入正文）：
 * 此前四家宿主各手写一份同构解析循环（zcode femo-server / dsh preset-install /
 * autoclaw render-skill + skill-inject），漂移已经实证——
 *   · CRLF 归一与逐行缩进只有 dsh 修过（其余三家产物行尾混合）；
 *   · zcode/dsh 的「先换 {FEMO_ROOT} 再展开」把公共正文**自带**的占位符永远
 *     漏在产物里（dsh 安装产物 6 处、zcode 产物整段），只有 autoclaw 的
 *     「先展开后换」是完整语义——本件统一为后者。
 *
 * 展开两步：
 *   ① {{INCLUDE:相对 femoRoot 的路径}} → 公共正文（指令必须整行独占，行首
 *     可有缩进；展开体逐行对齐同一缩进——YAML block 标量靠这个不提前终结，
 *     markdown 无缩进场景=空串零影响）。公共文件缺失=指令原样保留（保守，
 *     绝不静默清空 persona），onMissing 可留痕。
 *   ② {FEMO_ROOT} / {HOST} 全文替换（在展开之后——正文自带的占位符一并换）。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {string} text 宿主附录模板（含 {{INCLUDE}} 与占位符）
 * @param {string} femoRoot 引擎根（占位符替换值与 INCLUDE 相对路径的锚）
 * @param {string} host 宿主名（{HOST} 替换值，如 'dsh'/'zcode'/'autoclaw'）
 * @param {{ onMissing?: (path: string) => void }} [opts] 公共文件缺失时的留痕口
 * @returns {string} 展开后的全文
 */
export function expandSkillTemplate(text, femoRoot, host, { onMissing } = {}) {
  const root = String(femoRoot).replace(/[\\/]+$/, '');
  const re = /^[ ]*\{\{INCLUDE:([^}]+)\}\}/gm;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    out += text.slice(last, m.index);
    last = m.index + m[0].length;
    const indent = m[0].slice(0, m[0].indexOf('{{'));
    try {
      const body = readFileSync(join(root, m[1].trim()), 'utf8').replace(/\r\n/g, '\n');
      out += body.split('\n').map(l => (l.length > 0 ? indent + l : l)).join('\n');
    } catch {
      out += m[0]; // 公共文件缺失：指令原样保留（保守，不静默清空 persona）
      try { onMissing?.(m[1].trim()); } catch { /* 留痕口不许炸展开 */ }
    }
  }
  out += text.slice(last);
  return out.replaceAll('{FEMO_ROOT}', root).replaceAll('{HOST}', host);
}
