/**
 * session-registry.mjs — zcode 灵魂投递缓存写口（femo2host 公共层）。
 *
 * 【2026-09-28 收缩】前身是「钩子登记、possess 消费」的三本账（sessions 在册 /
 * prompts 提交登记 / claim 认领牌），服务 possess 直达式猜号与认领牌兜底。附身
 * 换轨 femo-possess 进程自证（CLAIM 暗号→exec 目录搜回本窗会话号，进程亲缘零
 * 竞态）后，直达式与认领牌整体退役，三本账无消费方——本文件只剩投递缓存写口：
 *
 *   recordSoulHint(hintsPath, host, sid, soul)  → bool
 *
 * 投递缓存 soul-hints.json（2026-09-26 无子代理化）：提名/解绑落账成功即写
 * sid→soul 提示档，钩子取信时读它解析本窗口灵魂（hooks/lib.mjs
 * boundSoulFromDisk 是读方）。为什么要缓存：hub 正身账是延迟落盘的，钩子在信
 * 到瞬间读文件会踩到旧值、查 hub HTTP 又会顶破 4s 钩子寿命（信已取走应答没
 * 写出=信丢失，女巫用例偶发红双实证）。提示档只是适配器私有投递缓存（dsh 席
 * 位「投递缓存+注册回填」同款先例），正身仍在 hub；提名恒先于开演产信，缓存
 * 不会晚于第一封信。soul=null（release）删除该格。写口单源于此：femo-possess
 * 程序与宿主共用一份，避免两处手写格式漂移。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function recordSoulHint(hintsPath, host, sid, soul) {
  try {
    let hints = { hosts: {} };
    try { hints = JSON.parse(readFileSync(hintsPath, 'utf8')); } catch { /* 首写 */ }
    hints.hosts = hints.hosts ?? {};
    hints.hosts[host] = hints.hosts[host] ?? {};
    if (soul) hints.hosts[host][sid] = { soul: String(soul), at: new Date().toISOString() };
    else delete hints.hosts[host][sid]; // release：提示随解绑撤销
    mkdirSync(dirname(hintsPath), { recursive: true });
    writeFileSync(hintsPath, JSON.stringify(hints), 'utf8');
    return true;
  } catch {
    return false; // 缓存是旁挂：写失败不挡附身（读方还有 cast-preferences 兜底档）
  }
}

/** 读口（2026-09-29 收编：读口同住一份——此前 hooks/lib 的 boundSoulFromDisk
 *  自拆账本形状，本文件的写口格式知识溢出到第三处）。两级按序：
 *  ① hintsPath 指的投递缓存（本写口落的，即时新鲜）；
 *  ② <dataDir>/projection/cast-preferences.json（hub 落盘提名账，可能滞后
 *    但聊胜于无；形状契约见 projection_hub.py cast 段）。
 *  都没有返回 null。zcode 私产路径由调用方拼（读方 hooks/lib）——本件不认
 *  宿主布局。 */
export function readSoulHint(hintsPath, dataDir, host, sid) {
  for (const p of [hintsPath, join(dataDir, 'projection', 'cast-preferences.json')]) {
    try {
      const v = JSON.parse(readFileSync(p, 'utf8'));
      const soul = v?.hosts?.[host]?.[sid]?.soul;
      if (soul) return String(soul);
    } catch { /* 下一档 */ }
  }
  return null;
}
