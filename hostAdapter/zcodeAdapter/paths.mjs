/**
 * paths.mjs — 本适配器落点解析唯一出处（2026-09-28 归拢）。
 *
 * 此前 importCore／数据根口径／宿主自称在五个文件里各写一份（femo-server、
 * bridge-manager、event-router、hooks/lib、已退役-gateway，tests/memory-store
 * 又有半份）——femoRoot.mjs 2026-09-15 就收编过找根逻辑，这批是收敛前的残迹，
 * 漂移风险真实（哨兵里还写死过作者开发机绝对路径当缺省根）。归拢于此：
 *
 *   PLUGIN_ROOT   插件根：ZCODE_PLUGIN_ROOT / CLAUDE_PLUGIN_ROOT env 优先；
 *                 缺省=本文件所在目录（zcodeAdapter/）。
 *   findFemoRoot  引擎根：FEMO_ROOT env 重定向优先（安装态非自包含的活路）；
 *                 余下按布局探测——开发态嵌套（zcodeAdapter → hostAdapter →
 *                 仓库根）与安装态平铺（femo2host 与本目录并排）。解析逻辑
 *                 唯一活在 femo2host/femoRoot.mjs（dshAdapter 同源）。
 *   importCore    公共层件按需 import：femo2host/host/<rel>，同一套探测，
 *                 失败响亮抛错（不静默——少兜底纪律）。
 *   dataRoot      运行时数据根：FEMO_DATA_DIR 整包重定向 → <DIR>/femo/ 子树；
 *                 缺省 <引擎根>/user_data——缺省分支没有 femo/ 段，与 python
 *                 侧同口径，勿「修正」（hub-client.mjs 文件头同款警告）。
 *   HOST_ID       本宿主自称（FEMO_HOST_NAME env）：绑定账三元组、名册 source、
 *                 驿站 target_host 同一个词。
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PLUGIN_ROOT = process.env.ZCODE_PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || dirname(fileURLToPath(import.meta.url));

let resolveFemoRootImpl;
{
  const hrefs = process.env.FEMO_ROOT
    ? [pathToFileURL(join(process.env.FEMO_ROOT, 'femo2host', 'femoRoot.mjs')).href]
    : [];
  for (const rel of ['femo2host/femoRoot.mjs', '../femo2host/femoRoot.mjs', '../../femo2host/femoRoot.mjs', '../../../femo2host/femoRoot.mjs']) {
    hrefs.push(new URL(rel, import.meta.url).href);
  }
  for (const href of hrefs) {
    if (existsSync(fileURLToPath(href))) {
      resolveFemoRootImpl = (await import(href)).resolveFemoRoot;
      break;
    }
  }
}
resolveFemoRootImpl ??= (startDir => startDir);

export function findFemoRoot() {
  // FEMO_ROOT env 显式重定向优先（如让 zcode 指向开发仓，与 DSH 共用同一套数据）。
  return (process.env.FEMO_ROOT || resolveFemoRootImpl(PLUGIN_ROOT)).replace(/[\\/]+$/, '');
}

/** 公共层件按需 import（file URL 绝对路径；FEMO_ROOT 重定向 + 双布局探测）。 */
export async function importCore(rel) {
  const hrefs = [];
  if (process.env.FEMO_ROOT) {
    hrefs.push(pathToFileURL(join(process.env.FEMO_ROOT, 'femo2host', 'host', rel)).href);
  }
  for (const prefix of ['./', '../', '../../', '../../../']) {
    hrefs.push(new URL(`${prefix}femo2host/host/${rel}`, import.meta.url).href);
  }
  for (const href of hrefs) {
    if (existsSync(fileURLToPath(href))) return import(href);
  }
  throw new Error(`femo2host/host/${rel} not found (FEMO_ROOT & dev & flat layouts all missed)`);
}

/** 运行时数据根（femoRoot 可省，缺省自解析；与 hooks/lib.mjs 旧口径同序）。
 *  与公共层 femoRoot.dataRootOf（宿主状态文件的数据根，env 分支**不带** femo
 *  段）是两个口径，勿「统一」：本函数对齐 python 侧引擎世界（驿站信柜/
 *  projection），FEMO_DATA_DIR 设了就进 <DIR>/femo/ 子树——信柜路径
 *  （mailbox/mailbox.json）必须与 mailbox.py 同词，改了就找错柜。 */
export function dataRoot(femoRoot) {
  return process.env.FEMO_DATA_DIR
    ? join(process.env.FEMO_DATA_DIR, 'femo')
    : join(femoRoot ?? findFemoRoot(), 'user_data');
}

export const HOST_ID = String(process.env.FEMO_HOST_NAME || 'zcode');
