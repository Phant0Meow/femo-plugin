/**
 * femoRoot.mjs — femo 引擎根目录的唯一解析器（各宿主适配器共用）。
 *
 * 引擎根 = 含 femo2host/ 的目录（仓库根）。原先 dshAdapter（host/config.ts 的
 * engineRoot）与 zcodeAdapter（mcp/bridge-manager.mjs、hooks/lib.mjs 的
 * resolveFemoRoot）各持一份找根逻辑，2026-09-15 起统一收敛到这里。
 *
 * 两种安装布局都随树携带本文件，向上找 femo2host 的语义不变：
 *  - 开发态：  <仓库根>/hostAdapter/<adapter>/…   → 向上解析到 <仓库根>
 *  - 安装态：  <pluginRoot>/mcp | hooks/…          → 命中 <pluginRoot> 本身
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * 从 startDir 向上（最多 6 级）找第一个含 femo2host/ 的目录。
 * @param {string} startDir 起点目录（通常 = 插件根，或调用方模块所在目录）
 * @returns {string} 引擎根；找不到时回落 startDir（自包含/平铺布局天然命中）
 */
export function resolveFemoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'femo2host'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * 数据根 = FEMO_DATA_DIR 环境变量，缺省 <引擎根>/user_data。
 * 数据目录就是租户边界：多实例分桶与测试沙盒都靠设这个 env 把引擎的库、
 * 驿站、投影账本整包搬进另一棵树。2026-09-29 收口：此前 state-files、
 * femogen-files、dshAdapter 各手写了一遍这个表达式，dsh 有两处漏了 env
 * 分支（读走分桶根、写落主根，读写分家）——「数据根在哪」与「引擎根在哪」
 * 一样，从今天起只有这一个答案。
 * @param {string} femoRoot 引擎根（resolveFemoRoot 的产物）
 * @returns {string} 数据根目录
 */
export function dataRootOf(femoRoot) {
  return process.env.FEMO_DATA_DIR || join(femoRoot, 'user_data');
}
