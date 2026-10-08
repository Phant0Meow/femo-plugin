/**
 * tests/keeper.test.mjs — 唤醒闸的单测（node --test）。
 * 顺次模型（2026-10-02 用户三锤定案）：唤醒闸把并发 reload 限流成预算内两两
 * 放行，服务派工侧「轮到谁才唤醒谁」。原收割轮（15s 查岗轮转）已随顺次定案
 * 退役删除，其回归锁一并退役。测试手动拨拨件不睡真时钟。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWakeGate } from '../server/keeper.mjs';

// ── 唤醒闸 ────────────────────────────────────────────────────────────

/** 桩世界：seats 账可随手翻在线；帧全收进 frames。pollMs 调小=毫秒级扫账。 */
function makeGate({ reloadBudget = 2, wakeTimeoutMs = 75_000, pollMs = 15 } = {}) {
  const online = new Set();
  const frames = [];
  const gate = createWakeGate({
    sendToAll: frame => frames.push(frame),
    seats: () => ({ bySessionLoose: sid => ({ online: online.has(sid) }) }),
    log: () => {},
    reloadBudget,
    wakeTimeoutMs,
    pollMs,
  });
  const settleIn = (predicate, ms = 2000) => new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (predicate()) { clearInterval(iv); resolve(true); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); reject(new Error('桩世界等待超时')); }
    }, 5);
  });
  const sleepMs = ms => new Promise(r => setTimeout(r, ms)); // 引用计时：给 unref 的扫账器机会跑
  return { gate, online, frames, settleIn, sleepMs };
}

test('闸：并发预算 2，第三个排队；占位者上线后放行队头', async () => {
  const { gate, online, frames, settleIn, sleepMs } = makeGate();
  let paDone = false, pbDone = false, pcDone = false;
  const pa = gate.wake('s:a').then(v => (paDone = true, v));
  const pb = gate.wake('s:b').then(v => (pbDone = true, v));
  const pc = gate.wake('s:c').then(v => (pcDone = true, v));
  await settleIn(() => frames.length === 2);
  assert.equal(frames.length, 2, '只放行两个（预算内）');
  assert.equal(frames[0].type, 'open-tab');
  assert.equal(frames[0].sessionId, 's:a');
  assert.equal(frames[1].sessionId, 's:b');
  await sleepMs(60); // 给扫账几拍：c 不该被放行
  assert.equal(frames.length, 2, 'c 还在排队，没发帧');

  online.add('s:a'); // a 上线 → 放行 c
  await settleIn(() => paDone);
  assert.equal(await pa, true, 'a 唤醒成功');
  await settleIn(() => frames.length === 3);
  assert.equal(frames[2].sessionId, 's:c', '队头 c 补位放行');
  online.add('s:c');
  await settleIn(() => pcDone);
  assert.equal(await pc, true);
  online.add('s:b');
  await settleIn(() => pbDone);
  assert.equal(await pb, true);
});

test('闸：唤醒超时如实回 false（诚实失败，调用方报错挂起可续）', async () => {
  const { gate, settleIn } = makeGate({ wakeTimeoutMs: 60, pollMs: 10 });
  let done = false;
  const p = gate.wake('s:never').then(v => (done = true, v));
  const t0 = Date.now();
  await settleIn(() => done);
  assert.equal(await p, false);
  assert.ok(Date.now() - t0 < 5000, '超时按配置的短窗走（不睡满缺省 75s）');
});

test('闸：同 sid 重复唤醒共享同一等待（不重复发帧）', async () => {
  const { gate, online, frames, settleIn, sleepMs } = makeGate();
  let done = false;
  const p1 = gate.wake('s:same').then(v => (done = true, v));
  const p2 = gate.wake('s:same');
  await settleIn(() => frames.length === 1);
  await sleepMs(60); // 给扫账几拍：不该重发
  assert.equal(frames.length, 1, '重复唤醒不重发请台帧');
  online.add('s:same');
  await settleIn(() => done);
  assert.equal(await p1, true);
  assert.equal(await p2, true, '两个等待者一起被放行');
});

test('闸：排队中自己上线（用户手点了）→ 不占预算直接放行', async () => {
  const { gate, online, frames, settleIn, sleepMs } = makeGate();
  gate.wake('s:x');
  gate.wake('s:y');
  await settleIn(() => frames.length === 2);
  let zDone = false;
  const pz = gate.wake('s:z').then(v => (zDone = true, v));
  online.add('s:z'); // z 自己上线了
  await settleIn(() => zDone);
  assert.equal(await pz, true);
  await sleepMs(60); // 给扫账几拍：不该为 z 发帧
  assert.equal(frames.length, 2, 'z 没占预算、没发帧');
});

test('闸：站点解析随帧走（席位账没有就拆会话引用）', async () => {
  const { gate, frames, settleIn } = makeGate();
  gate.wake('chat.deepseek.com:abcd-1');
  await settleIn(() => frames.length === 1);
  assert.equal(frames[0]?.site, 'chat.deepseek.com', '引用自带站点');
});
