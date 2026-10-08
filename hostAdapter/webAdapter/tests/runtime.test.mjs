/**
 * tests/runtime.test.mjs — 单测（node --test，桩桥零依赖零网络）。
 *
 * 覆盖三块纯逻辑：席位账（seats）注册/上下线/主Agent/挂队补发（灵魂绑定不住
 * 这里——唯一一笔账在 hub cast，runtime 经注入的 resolveSeat 解析座位）；
 * 收件口分流（mailbox-push）的终局/启动/重试/主Agent/人类/角色与去重；
 * 运行时回合簿记（runtime）的下发/排队/超时裁决/失败上报（桩桥+桩帧口+桩座位解析）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeatBoard } from '../server/seats.mjs';
import { createMailboxPush } from '../server/mailbox-push.mjs';
import { createFemoRuntime } from '../server/runtime.mjs';

// ── seats ─────────────────────────────────────────────────────────────
test('seats: 注册/上下线/忙闲（纯物理账，无灵魂状态）', () => {
  const board = createSeatBoard({ log: () => {} });
  board.upsertTabs('connA', [
    { tabId: 1, sessionId: 'aaaaaaaa-1111', title: '甲', busy: false },
    { tabId: 2, sessionId: 'bbbbbbbb-2222', title: '乙', busy: true },
  ]);
  assert.equal(board.list().length, 2);
  assert.equal(board.bySession('aaaaaaaa-1111').busy, false);
  assert.equal(board.bySession('bbbbbbbb-2222').busy, true);

  // 离线：连接消失的席位掉线（灵魂绑定在 hub，不随椅子存亡）
  board.markOffline('connA');
  assert.equal(board.bySession('bbbbbbbb-2222').online, false);

  // 重新上线复活
  board.upsertTabs('connA', [{ tabId: 2, sessionId: 'bbbbbbbb-2222', title: '乙', busy: false }]);
  assert.equal(board.bySession('bbbbbbbb-2222').online, true);
});

test('seats: 冻结页登记为在场休眠——present 与 online 分离，页关才出账', () => {
  const board = createSeatBoard({ log: () => {} });
  const tab = online => ({ tabId: 1, sessionId: 'chat.deepseek.com:aaaa-1', site: 'chat.deepseek.com', title: '甲', busy: false, online });
  board.upsertTabs('connA', [tab(true)]);
  // 下一轮同页不应答探活（浏览器冻结）：照样在场，只是休眠——按需唤醒靠这条账
  board.upsertTabs('connA', [tab(false)]);
  let s = board.bySession('chat.deepseek.com:aaaa-1');
  assert.equal(s.present, true, '页开着=在场');
  assert.equal(s.online, false, '没应答探活=不在线');
  // 旧扩展不上报 online 字段：照旧全算应答过（兼容未刷新的扩展）
  board.upsertTabs('connA', [{ tabId: 1, sessionId: 'chat.deepseek.com:aaaa-1', site: 'chat.deepseek.com', title: '甲', busy: false }]);
  assert.equal(board.bySession('chat.deepseek.com:aaaa-1').online, true);
  assert.equal(board.bySession('chat.deepseek.com:aaaa-1').present, true);
  // 页关了：本轮没再报到 → 出账（在场+在线双假）
  board.upsertTabs('connA', []);
  s = board.bySession('chat.deepseek.com:aaaa-1');
  assert.equal(s.present, false);
  assert.equal(s.online, false);
});

test('seats: 座席上行到达=活气翻在线——探活之外的第二判据（GLM 实案回归锁）', () => {
  const board = createSeatBoard({ log: () => {} });
  const tab = online => ({ tabId: 1, sessionId: 'chatglm.cn:0123456789abcdef012345ab', site: 'chatglm.cn', title: '乙', busy: false, online });
  board.upsertTabs('connA', [tab(false)]); // reload 后页面几秒又被冻：探活不应答=休眠
  assert.equal(board.bySession('chatglm.cn:0123456789abcdef012345ab').online, false);
  // 座席上线报到（report 到达服务端）=sendMessage 通道通着的铁证——当场翻在线：
  // 唤醒闸不必干等 10s 一轮的探活，75s 等窗不再白白超时拒派
  assert.equal(board.markAlive('chatglm.cn:0123456789abcdef012345ab'), true);
  assert.equal(board.bySession('chatglm.cn:0123456789abcdef012345ab').online, true);
  assert.equal(board.bySession('chatglm.cn:0123456789abcdef012345ab').present, true);
  // 已在线的重复上行不重复翻（返回 false 无副作用）
  assert.equal(board.markAlive('chatglm.cn:0123456789abcdef012345ab'), false);
  // 下一轮 register 用探活结果覆盖回真实状态（页又冻=翻回休眠）
  board.upsertTabs('connA', [tab(false)]);
  assert.equal(board.bySession('chatglm.cn:0123456789abcdef012345ab').online, false);
  // 空 sessionId（新会话未发首条）与查无此席：安静不翻
  assert.equal(board.markAlive(''), false);
  assert.equal(board.markAlive('chatglm.cn:deadbeef'), false);
});

test('seats: 会话引用——宽松找兼容旧账裸 id，视图派生来源显示名与短 id', () => {
  const board = createSeatBoard({ log: () => {} });
  board.upsertTabs('connA', [
    { tabId: 1, sessionId: 'chat.deepseek.com:aaaaaaaa-1111', site: 'chat.deepseek.com', title: '甲', busy: false },
    { tabId: 2, sessionId: 'chatglm.cn:0123456789abcdef012345ab', site: 'chatglm.cn', title: '乙', busy: false },
  ]);
  // 精确找：完整引用（`<域名>:<id>`，形态契约在 sites.mjs）
  assert.equal(board.bySession('chat.deepseek.com:aaaaaaaa-1111').title, '甲');
  // 宽松找：hub 旧绑定存的裸 id 对上带前缀的席位；完整引用也照常走宽松口
  assert.equal(board.bySessionLoose('aaaaaaaa-1111').title, '甲');
  assert.equal(board.bySessionLoose('chat.deepseek.com:aaaaaaaa-1111').title, '甲');
  // 带前缀却查无 = 真没这席位，不兜底
  assert.equal(board.bySessionLoose('chat.deepseek.com:deadbeef-9999'), undefined);
  // 视图派生（账本不记，出口现算）：来源显示名 + 剥掉前缀的短 id
  const view = board.list().find(s => s.siteLabel === 'DeepSeek');
  assert.equal(view.siteLabel, 'DeepSeek');
  assert.equal(view.sidShort, 'aaaaaaaa');
  // 灵魂镜像的兼容对：旧账裸 id 键也能对上带前缀的席位
  const soulView = board.list({ 'aaaaaaaa-1111': 'littlecat' }).find(s => s.siteLabel === 'DeepSeek');
  assert.equal(soulView.soul, 'littlecat');
});

test('seats: list 支持外部灵魂展示镜像（hub 视图算好传入）', () => {
  const board = createSeatBoard({ log: () => {} });
  board.upsertTabs('connA', [{ tabId: 1, sessionId: 'cccccccc-3333', title: '丙', busy: false }]);
  const rows = board.list({ 'cccccccc-3333': 'wolf-seer' });
  assert.equal(rows[0].soul, 'wolf-seer');
  assert.equal(board.list()[0].soul, undefined, '不传就是纯物理账');
});

test('seats: 挂队与取队（忙不出队，闲才出）', () => {
  const board = createSeatBoard({ log: () => {} });
  board.upsertTabs('connA', [{ tabId: 1, sessionId: 'cccccccc-3333', title: '丙', busy: true }]);
  const frame = { deliveryId: 'x', sessionId: 'cccccccc-3333' };
  assert.equal(board.enqueuePending('cccccccc-3333', frame).queued, true);
  assert.equal(board.takePending('cccccccc-3333'), undefined, '忙时不给');
  board.setBusy('cccccccc-3333', false);
  assert.equal(board.takePending('cccccccc-3333'), frame, '闲了给');
  assert.equal(board.pendingCount('cccccccc-3333'), 0);
});

test('seats: 主Agent至多一个', () => {
  const board = createSeatBoard({ log: () => {} });
  board.upsertTabs('connA', [
    { tabId: 1, sessionId: 'dddddddd-4444', title: '丁', busy: false },
    { tabId: 2, sessionId: 'eeeeeeee-5555', title: '戊', busy: false },
  ]);
  assert.equal(board.setMain('dddddddd-4444').ok, true);
  assert.equal(board.mainSeat()?.sessionId, 'dddddddd-4444');
  board.setMain('eeeeeeee-5555');
  assert.equal(board.mainSeat()?.sessionId, 'eeeeeeee-5555');
  board.setMain(null);
  assert.equal(board.mainSeat(), undefined);
});

// ── mailbox-push ──────────────────────────────────────────────────────
function makePush() {
  const calls = { submitOutput: [], submitHumanOutput: [] };
  const push = createMailboxPush({
    submitOutput: async (...a) => { calls.submitOutput.push(a); return {}; },
    submitHumanOutput: async (...a) => { calls.submitHumanOutput.push(a); return {}; },
    log: () => {},
  });
  return { push, calls };
}

test('push: 终局整包 → handled=stop（已喊簿去重）', async () => {
  const { push } = makePush();
  const body = { outcome: 'finished', job_id: 7, letters: [{ kind: 'notice', job_id: 7, payload: '戏散了' }] };
  const r1 = await push.handlePush(body);
  assert.equal(r1.handled, 'stop');
  assert.equal(r1.jobId, 7);
  assert.match(r1.notice, /7/);
  const r2 = await push.handlePush(body);
  assert.equal(r2.handled, 'stop-duplicate');
});

test('push: 启动信/重试牌/主Agent/人类/角色 全分流', async () => {
  const { push } = makePush();
  const play = await push.handlePush({ letters: [{ kind: 'notice', subkind: 'play_start', job_id: 9, payload: '启动' }] });
  assert.equal(play.handled, 'play_start');

  const retryMain = await push.handlePush({ letters: [{ kind: 'notice', subkind: 'node_retry', job_id: 9 }], retry: { wait_key: 'wk-1', actor_name: 'main', feedback: '重写', attempt: 2 } });
  assert.equal(retryMain.handled, 'node_retry-main');
  assert.equal(retryMain.attempt, 2);

  const retryActor = await push.handlePush({ letters: [{ kind: 'notice', subkind: 'node_retry', job_id: 9 }], retry: { wait_key: 'wk-2', actor_name: 'wolf-seer', feedback: '不许暴露', attempt: 1 } });
  assert.equal(retryActor.handled, 'node_retry-actor');
  assert.equal(retryActor.jobId, 9, '重试面单带 jobId（座位解析要查 Job 选角账）');

  const mainBrief = await push.handlePush({ letters: [{ kind: 'context', job_id: 9, ref: 'wk-3' }], brief: { source: 'main', job_id: 9, wait_key: 'wk-3', node_name: 'planner', blocks: { prompt: '开场白' } } });
  assert.equal(mainBrief.handled, 'main');
  // 同 wait_key 再来（事件通道的重复帧）→ 已办
  const mainAgain = await push.consumedMain({ wait_key: 'wk-3' });
  assert.equal(mainAgain, true);

  const humanBrief = await push.handlePush({ letters: [{ kind: 'context', job_id: 9, ref: 'wk-4' }], brief: { job_id: 9, wait_key: 'wk-4', prompt: '请投票', scope: ['villager-a'] } });
  assert.equal(humanBrief.handled, 'human');
  assert.equal(humanBrief.soul, 'villager-a');

  const actorBrief = await push.handlePush({ letters: [{ kind: 'context', job_id: 9, ref: 'wk-5' }], brief: { job_id: 9, wait_key: 'wk-5', node_name: '狼人', actor_name: 'wolf-seer', source: 'deepseek-chat', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: '你睁眼' } } });
  assert.equal(actorBrief.handled, 'actor');
  assert.equal(actorBrief.brief.wait_key, 'wk-5');
});

test('push: 分拣归公共层后的校验分支——非法结局响亮丢弃、插话信登记', async () => {
  const { push } = makePush();
  // 非法 outcome：绝不静默归 finished（把没跑完的戏当已跑完=少兜底红线禁止）。
  const badStop = await push.handlePush({ outcome: 'exploded', job_id: 7, letters: [{ kind: 'notice', job_id: 7 }] });
  assert.equal(badStop.handled, 'stop-invalid');
  // 人类插话信（十连裁⑨）：web 无导演会话，响亮登记不静默落 letters-only。
  const interjection = await push.handlePush({ letters: [{ kind: 'notice', subkind: 'user_interjection', job_id: 7, payload: '让甲先说' }], interjection: { mainSid: 'sess-abc' } });
  assert.equal(interjection.handled, 'interjection');
  assert.equal(interjection.mainSid, 'sess-abc');
  // 缺面单的插话 → 响亮丢弃。
  const badInter = await push.handlePush({ letters: [{ kind: 'notice', subkind: 'user_interjection', payload: 'x' }], interjection: {} });
  assert.equal(badInter.handled, 'interjection-dropped');
});

// ── runtime 回合簿记（桩桥+桩帧口+桩座位解析）───────────────────────────
function makeRuntime({ resolveSeat, bridge, draftFeed, wakeSeat, broadcastFrame, silentReloadMs, silentRemindMs, silentRescueMs, execFuseMs, turnTimeoutMs, sendGraceMs, retryHelloMs } = {}) {
  const sent = [];
  const failures = [];
  const stubBridge = bridge ?? {
    alive: true,
    send: async (cmd, args) => ({ cmd, args, letters: [] }),
  };
  const frames = [];
  const rt = createFemoRuntime({
    bridge: stubBridge,
    log: () => {},
    deliverFrame: (connId, frame) => { frames.push(frame); if (!frame.type) sent.push(frame); return true; },
    surface: {},
    resolveSeat: resolveSeat ?? (async () => { throw new Error('no resolver'); }),
    wakeSeat: wakeSeat ?? null,
    draftFeed: draftFeed ?? null,
    broadcastFrame: broadcastFrame ?? null,
    silentReloadMs, silentRemindMs, silentRescueMs, execFuseMs, turnTimeoutMs, sendGraceMs, retryHelloMs,
  });
  return { rt, sent, frames, failures, bridge: stubBridge };
}

const SEAT = { sessionId: 'ffffffff-6666', tabId: 9, title: '己', busy: false, connId: 'connA' };

test('runtime: 角色回合下发→sent→reply 全程恰一次交回（座位经 resolveSeat 解析）', async () => {
  const { rt, sent } = makeRuntime({
    resolveSeat: async (jobId, soul) => {
      assert.equal(jobId, 3);
      assert.equal(soul, 'wolf-seer');
      return SEAT;
    },
  });
  rt.seats.upsertTabs('connA', [SEAT]);

  const r = await rt.dispatchActorRequest({
    job_id: 3, wait_key: 'wk-a', node_name: '狼人', actor_name: 'wolf-seer',
    actor_info: { soul: 'wolf-seer' }, blocks: { prompt: '你睁眼了' },
  });
  assert.equal(r.accepted, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /你睁眼了/);
  assert.equal(sent[0].sessionId, SEAT.sessionId);

  // 重复下发同一 wait_key → duplicate
  const dup = await rt.dispatchActorRequest({ job_id: 3, wait_key: 'wk-a', node_name: '狼人', actor_name: 'wolf-seer', blocks: { prompt: 'x' } });
  assert.equal(dup.accepted, false);
  assert.equal(dup.reason, 'duplicate');

  assert.equal(rt.onSeatReport({ type: 'sent', deliveryId: sent[0].deliveryId, sessionId: SEAT.sessionId }).handled, true);
  const reply = rt.onSeatReport({ type: 'reply', deliveryId: sent[0].deliveryId, sessionId: SEAT.sessionId, text: '我是预言家（狼人身份）' });
  assert.equal(reply.handled, true);
  await new Promise(r2 => setTimeout(r2, 20)); // submitOutput 异步落
  assert.equal(rt.stats().inflight, 0);
});

test('runtime: 逐字流 delta 走旁路——喂草稿不碰在飞表，交卷恰好一次不受扰', async () => {
  const drafts = [];
  const { rt, sent } = makeRuntime({
    resolveSeat: async () => SEAT,
    draftFeed: (turn, snap) => drafts.push({ waitKey: turn.waitKey, jobId: turn.jobId, ...snap }),
  });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 5, wait_key: 'wk-d', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: '发言' } });
  const deliveryId = sent[0].deliveryId;

  // 未知 deliveryId（手工聊天/已交卷）：handled=true 但不喂——旁路轨静默丢
  const unk = rt.onSeatReport({ type: 'delta', deliveryId: 'nope', thinking: 'x', content: 'y' });
  assert.equal(unk.handled, true, 'delta 必须回已处理（否则服务端按 unhandled 大声留痕）');
  assert.equal(drafts.length, 0);

  // 在飞回合的 delta：喂草稿、在飞表纹丝不动
  rt.onSeatReport({ type: 'delta', deliveryId, thinking: '思考中', content: '' });
  rt.onSeatReport({ type: 'delta', deliveryId, thinking: '思考中', content: '正文一' });
  assert.equal(drafts.length, 2);
  assert.deepEqual(drafts[0], { waitKey: 'wk-d', jobId: 5, thinking: '思考中', content: '' });
  assert.equal(rt.stats().inflight, 1, 'delta 不碰在飞表');

  // 交卷照旧恰好一次；交卷后迟到的 delta 静默丢（草稿以落账定稿为准）
  assert.equal(rt.onSeatReport({ type: 'reply', deliveryId, sessionId: SEAT.sessionId, text: '正文一' }).handled, true);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(rt.stats().inflight, 0);
  rt.onSeatReport({ type: 'delta', deliveryId, thinking: '迟到', content: '迟到' });
  assert.equal(drafts.length, 2, '交卷后的 delta 不喂');
});

test('runtime: 顺次闸——前一个回合收场才轮到下一个（同席连发排队不推帧）', async () => {
  const { rt, sent } = makeRuntime({
    resolveSeat: async () => SEAT,
  });
  rt.seats.upsertTabs('connA', [SEAT]);

  const r1 = await rt.dispatchActorRequest({ job_id: 4, wait_key: 'wk-b', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: '第一轮发言' } });
  assert.equal(r1.accepted, true);
  assert.equal(sent.length, 1);

  // 前一个还在飞：第二个到站排顺次队——帧不推、座位不解析（轮到才看活着没）
  const r2 = await rt.dispatchActorRequest({ job_id: 4, wait_key: 'wk-c', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: '第二轮发言' } });
  assert.equal(r2.accepted, true);
  assert.equal(r2.queued, true);
  assert.equal(sent.length, 1, '前一个没收场，下一帧不推');

  // 第一个收场（reply=完整结束信号）→ 闸放行第二个
  rt.onSeatReport({ type: 'reply', deliveryId: sent[0].deliveryId, sessionId: SEAT.sessionId, text: '第一轮说完了' });
  await new Promise(r => setTimeout(r, 30));
  assert.equal(sent.length, 2, '收场后第二个推帧');
  assert.match(sent[1].text, /第二轮发言/);
});

test('runtime: 顺次闸跨席——闸忙时不解析下一站座位（轮到才看活着没=轮到才唤醒）', async () => {
  const seatB = { ...SEAT, sessionId: 'eeeeeeee-5555', tabId: 2 };
  const resolved = [];
  const { rt, sent } = makeRuntime({
    resolveSeat: async (_jobId, soul) => { resolved.push(soul); return soul === 'seer' ? SEAT : seatB; },
  });
  rt.seats.upsertTabs('connA', [SEAT, seatB]);

  await rt.dispatchActorRequest({ job_id: 30, wait_key: 'wk-s1', node_name: '甲', actor_name: 'seer', actor_info: { soul: 'seer' }, blocks: { prompt: '第一个' } });
  assert.equal(sent.length, 1);
  assert.deepEqual(resolved, ['seer']);

  const r2 = await rt.dispatchActorRequest({ job_id: 30, wait_key: 'wk-s2', node_name: '乙', actor_name: 'witch', actor_info: { soul: 'witch' }, blocks: { prompt: '第二个' } });
  assert.equal(r2.accepted, true);
  assert.equal(r2.queued, true);
  assert.deepEqual(resolved, ['seer'], '闸忙不唤醒下一页（防多页 reload 风控暴露）');

  rt.onSeatReport({ type: 'reply', deliveryId: sent[0].deliveryId, sessionId: SEAT.sessionId, text: '完了' });
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(resolved, ['seer', 'witch'], '轮到了才解析座位（活着直发、死了唤醒闸 reload 一次）');
  assert.equal(sent.length, 2);
  assert.equal(sent[1].sessionId, seatB.sessionId, '第二个帧发到第二席');
});

test('runtime: 停演清空顺次队列——排队任务作废不再派发', async () => {
  const resolved = [];
  const { rt, sent } = makeRuntime({ resolveSeat: async (_j, soul) => { resolved.push(soul); return SEAT; } });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 31, wait_key: 'wk-q1', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  assert.equal(sent.length, 1);
  const r2 = await rt.dispatchActorRequest({ job_id: 31, wait_key: 'wk-q2', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'y' } });
  assert.equal(r2.queued, true);
  rt.abortAll('test-stop');
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(resolved, ['wolf-seer'], '排队任务作废：座位不再被解析');
  assert.equal(sent.length, 1, '排队帧不推');
  assert.equal(rt.stats().inflight, 0, '在飞回合随停收走');
});

test('runtime: 席位 busy 残留时进闸任务挂席位队，转闲补发', async () => {
  const { rt, sent } = makeRuntime({
    resolveSeat: async () => SEAT,
  });
  rt.seats.upsertTabs('connA', [SEAT]);

  await rt.dispatchActorRequest({ job_id: 4, wait_key: 'wk-b1', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: '第一轮发言' } });
  assert.equal(sent.length, 1);
  // 页面报忙；回合收场（busy:false 未及上报）→ busy 残留
  rt.onSeatReport({ type: 'busy', sessionId: SEAT.sessionId, busy: true });
  rt.onSeatReport({ type: 'reply', deliveryId: sent[0].deliveryId, sessionId: SEAT.sessionId, text: '第一轮说完了' });
  await new Promise(r => setTimeout(r, 20));

  const r2 = await rt.dispatchActorRequest({ job_id: 4, wait_key: 'wk-b2', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: '第二轮发言' } });
  assert.equal(r2.accepted, true);
  assert.equal(r2.queued, true, '席位 busy 残留 → 挂席位队');
  assert.equal(sent.length, 1);

  rt.onSeatReport({ type: 'busy', sessionId: SEAT.sessionId, busy: false }); // 转闲
  await new Promise(r => setTimeout(r, 600)); // 补发节流 400ms
  assert.equal(sent.length, 2, '补发队头');
  assert.match(sent[1].text, /第二轮发言/);
});

test('runtime: 座位解析失败 → 降级不停引擎：不报 actor_failed，立即提醒，回合留账等保险丝占位跳过', async () => {
  const calls = [];
  const bridge = { alive: true, send: async (cmd, args) => { calls.push({ cmd, args }); return {}; } };
  const { rt, frames } = makeRuntime({
    bridge,
    execFuseMs: 40,
    resolveSeat: async () => { throw new Error('选角账查无 "nobody" 的座位（Job 5）'); },
  });
  const r = await rt.dispatchActorRequest({ job_id: 5, wait_key: 'wk-d', node_name: '乙', actor_name: 'nobody', actor_info: { soul: 'nobody' }, blocks: { prompt: 'x' } });
  assert.equal(r.accepted, false);
  assert.match(r.reason ?? '', /no-seat/);
  assert.equal(rt.stats().inflight, 1, '回合留在账上（提醒喊人+等保险丝，不是 error 终局）');
  assert.equal(frames.filter(f => f.type === 'remind').length, 1, '唤醒失败立即弹提醒（已等过唤醒闸 75s，不再静默 30s）');
  const parkRemind = frames.find(f => f.type === 'remind');
  assert.match(parkRemind.message, /没能自动唤醒/);
  assert.match(parkRemind.message, /戏不会停/);
  await new Promise(res => setTimeout(res, 150));
  assert.equal(rt.stats().inflight, 0, '保险丝到点占位跳过、回合出账');
  assert.equal(calls.filter(c => c.cmd === 'actor_failed').length, 0, '不上报 actor_failed（引擎不停、不挂起）');
  const speech = calls.find(c => c.cmd === 'post_speech');
  assert.ok(speech, '占位台词交卷（剧本继续跑下一个节点）');
  assert.match(JSON.stringify(speech.args), /执行超时跳过/);
});

test('runtime: park 降级的提醒帧带会话引用（「切过去」按钮的寻址）', async () => {
  // 唤醒失败错误尾缀 ref=<会话引用>（service.resolveSeat 抛错时缀上）→ park
  // 提醒帧回填 sessionId——扩展横条按钮/系统通知按引用现场认页，没有它就是
  // 死按钮（2026-10-02「切过去没反应」实案第二根因）。
  const { rt, frames } = makeRuntime({
    execFuseMs: 40,
    resolveSeat: async () => {
      throw new Error('「狼人」绑定指向的会话（chatglm.cn:abc123）等待自动唤醒 75s 后仍不在线——检查该标签页是否开着；ref=chatglm.cn:abc123');
    },
  });
  const r = await rt.dispatchActorRequest({ job_id: 7, wait_key: 'wk-ref', node_name: '丙', actor_name: 'wolf', actor_info: { soul: 'wolf' }, blocks: { prompt: 'x' } });
  assert.equal(r.accepted, false);
  const parkRemind = frames.find(f => f.type === 'remind');
  assert.ok(parkRemind, '唤醒失败立即提醒');
  assert.equal(parkRemind.sessionId, 'chatglm.cn:abc123', '提醒帧带会话引用——按钮按引用切页');
  assert.equal(rt.seats.mainSeat(), undefined, 'park 账本仍是漂账：不碰席位账');
  await new Promise(res => setTimeout(res, 120)); // 保险丝到点收账，不悬挂
});

test('runtime: 绑定别家宿主的灵魂不是本宿主的活——不派工、不弹提醒、不立账（2026-10-06 ai7 实案）', async () => {
  // service.resolveSeat 对「绑定在别家宿主」的座位抛带 foreignHost 标记的错误
  // （现实形态：本场由 web 开，事件流全量送到 web，但引擎产信那一拍已按选角账把
  // 信改寄对方格留柜等自取）。旧版 resolveSeat 这行引用未初始化的 sid，抛的是
  // TDZ 的 ReferenceError「Cannot access 'sid' before initialization」——被当成
  // 唤醒失败 park 掉，全页面贴顶横条弹「ai7 绑定的网页没能自动唤醒」（用户实报）。
  const calls = [];
  const bridge = { alive: true, send: async (cmd, args) => { calls.push({ cmd, args }); return {}; } };
  const foreignSeatError = () => {
    const e = new Error('"ai7" 绑定指向别的宿主（zcode）——信留驿站等对方自取，本宿主不派工；ref=zcode:sess-1');
    e.foreignHost = 'zcode';
    return e;
  };
  const { rt, frames, sent } = makeRuntime({
    bridge,
    execFuseMs: 40,
    resolveSeat: async (_jobId, soul) => { if (soul === 'ai7') throw foreignSeatError(); return SEAT; },
  });
  rt.seats.upsertTabs('connA', [SEAT]);

  const r = await rt.dispatchActorRequest({
    job_id: 2716, wait_key: 'j2716:ai_[AI发言]_2', node_name: '[AI发言]',
    actor_name: '@Zcode（AI-7）', actor_info: { soul: 'ai7' }, blocks: { prompt: '轮到你发言' },
  });
  assert.equal(r.accepted, false);
  assert.match(String(r.reason), /foreign-host/);
  assert.equal(frames.filter(f => f.type === 'remind').length, 0, '别家宿主的灵魂不弹提醒横条');
  assert.equal(rt.stats().inflight, 0, '不立漂账（本宿主没有要收的回合）');
  // 料包拼词（get_soul 读人设）在进闸前就做了——归属到座位解析那一刻才知道，
  // 这一次读无害（唯一动作）；但绝不能有占位台词/actor_failed 这类「越权替对方
  // 收场」的动作：那不是本宿主的活（信留驿站等对方自取）。
  assert.deepEqual(calls.map(c => c.cmd), ['get_soul'], '只留下进闸前的料包拼词读，没有越权动作');
  await new Promise(res => setTimeout(res, 120));
  assert.equal(calls.filter(c => c.cmd === 'post_speech' || c.cmd === 'actor_failed').length, 0, '保险丝也不武装（不留任何后手动作）');

  // 重试牌同款（趁闸还空着）：别家灵魂的重演也不归本宿主办
  const retry = await rt.dispatchActorRetry({
    actorName: '@Zcode（AI-7）', waitKey: 'j2716:ai_[AI发言]_2', feedback: '重说', attempt: 1, jobId: 2716,
  });
  assert.equal(retry.accepted, false);
  assert.match(String(retry.reason), /foreign-host/);
  assert.equal(frames.filter(f => f.type === 'remind').length, 0, '重试牌也不弹提醒横条');

  // 顺次闸当场放行：下一位 web 自己的灵魂照常派得出去
  const own = await rt.dispatchActorRequest({
    job_id: 2716, wait_key: 'j2716:ai_[AI发言]_3', node_name: '[AI发言]',
    actor_name: '@GPT（AI-5）', actor_info: { soul: 'ai5' }, blocks: { prompt: '轮到你发言' },
  });
  assert.equal(own.accepted, true, '闸没被别家的活占住');
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /轮到你发言/);
});

test('runtime: 主Agent回合没设主Agent席 → 落操作台（surface 回调）', async () => {
  let surfaced;
  const rt = createFemoRuntime({
    bridge: { alive: true, send: async () => ({}) },
    log: () => {}, deliverFrame: () => true,
    surface: { onMainBrief: b => { surfaced = b; } },
  });
  await rt.dispatchMainBrief({ jobId: 6, waitKey: 'wk-e', node: 'planner', blocks: { prompt: '启动指令' } });
  assert.ok(surfaced);
  assert.equal(surfaced.waitKey, 'wk-e');
});

test('runtime: 主席休眠 → wakeSeat 唤醒后再派；唤醒超时照旧挂队不炸回合', async () => {
  // 唤醒器桩：把席位翻回在线后报成功
  let woke = 0;
  const { rt, sent } = makeRuntime({
    wakeSeat: async () => {
      woke += 1;
      rt.seats.upsertTabs('connA', [{ ...SEAT, online: true, present: true }]);
      return true;
    },
  });
  rt.seats.upsertTabs('connA', [{ ...SEAT, online: false, present: true }]);
  rt.seats.setMain(SEAT.sessionId);
  const r = await rt.dispatchMainBrief({ jobId: 8, waitKey: 'wk-m', node: 'planner', blocks: { prompt: '启动' } });
  assert.equal(woke, 1, '休眠主席先唤醒');
  assert.equal(r.accepted, true);
  assert.equal(sent.length, 1, '唤醒成功后帧发出');

  // 唤醒失败（超时）：照旧挂队（remind 兜底），回合不炸
  const rt2 = makeRuntime({ wakeSeat: async () => false }).rt;
  rt2.seats.upsertTabs('connA', [{ ...SEAT, online: false, present: true }]);
  rt2.seats.setMain(SEAT.sessionId);
  const r2 = await rt2.dispatchMainBrief({ jobId: 9, waitKey: 'wk-m2', node: 'planner', blocks: { prompt: '启动' } });
  assert.equal(r2.accepted, true);
  assert.equal(r2.queued, true, '等不到上线照旧挂队');
  assert.equal(rt2.seats.pendingCount(SEAT.sessionId), 1);

  // 没注入 wakeSeat（缺省 null）：休眠主席同款挂队，回归锁（唤醒是增强不是依赖）
  const rt3 = makeRuntime({}).rt;
  rt3.seats.upsertTabs('connA', [{ ...SEAT, online: false, present: true }]);
  rt3.seats.setMain(SEAT.sessionId);
  const r3 = await rt3.dispatchMainBrief({ jobId: 10, waitKey: 'wk-m3', node: 'planner', blocks: { prompt: '启动' } });
  assert.equal(r3.queued, true);
});

test('runtime: human_done 的人类发言落流水（kind=human 带 soul；空输入不记）', () => {
  const { rt, bridge } = makeRuntime({});
  bridge.onEvent('human_wait', {
    job_id: 7, wait_key: 'wk-h', node_name: '发言', prompt: '说点什么', scope: ['@Eve'],
    out_vars: ['票', ''],
  });
  assert.ok(rt.humanWait);
  // 字段映射单源=公共层 waitingHumanFromEvent（2026-09-29 收编）：归一只剥非串
  // （引擎契约变量名非空，不再本地多剥一层兜底）。
  assert.deepEqual(rt.humanWait.out_vars, ['票', ''], 'out_vars 归一随公共层单源（剥非串）');
  assert.equal(rt.humanWait.hasOutVars, true, '赋值钮显隐布尔=公共层 hub-render-core 判定盖章');
  bridge.onEvent('human_done', { node_name: '发言', input: '我投一号。' });
  assert.equal(rt.humanWait, undefined);
  const rows = rt.runlog().filter(r => r.kind === 'human');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor, '@Eve');
  assert.equal(rows[0].text, '我投一号。');

  // 空输入（超时放行）不记：流水记「收到的话」，不是「等过人」。
  bridge.onEvent('human_wait', { job_id: 7, wait_key: 'wk-h2', node_name: '发言', prompt: '…', scope: ['@Eve'] });
  bridge.onEvent('human_done', { node_name: '发言', input: '' });
  assert.equal(rt.runlog().filter(r => r.kind === 'human').length, 1);
});

test('runtime: 停下三信号收掉人类等待镜像（侧栏人类卡随停隐藏）', () => {
  const { rt, bridge } = makeRuntime({});
  // 暂停：镜像收起；续跑引擎重发 human_wait 自然重立。
  bridge.onEvent('human_wait', { job_id: 7, wait_key: 'wk-i', node_name: '发言', prompt: '说点什么', scope: ['@Eve'] });
  assert.ok(rt.humanWait);
  bridge.onEvent('flow_paused', { job_id: 7 });
  assert.equal(rt.humanWait, undefined, '暂停后等待镜像收起');

  // 报错终止：镜像收起（运行没了，等不到那个回合了）。
  bridge.onEvent('human_wait', { job_id: 7, wait_key: 'wk-j', node_name: '发言', prompt: '…', scope: ['@Eve'] });
  bridge.onEvent('flow_error', { job_id: 7, error: 'boom' });
  assert.equal(rt.humanWait, undefined, '报错终止后等待镜像收起');

  // 跑完：镜像收起。
  bridge.onEvent('human_wait', { job_id: 7, wait_key: 'wk-k', node_name: '发言', prompt: '…', scope: ['@Eve'] });
  bridge.onEvent('bridge_run_ended', { job_id: 7 });
  assert.equal(rt.humanWait, undefined, '跑完后等待镜像收起');
});

test('runtime: human_wait 镜像带 showprompt（侧栏人类卡节词段数据源）', () => {
  const { rt, bridge } = makeRuntime({});
  bridge.onEvent('human_wait', {
    job_id: 7, wait_key: 'wk-sp', node_name: '陈述', prompt: '请陈述你的推理',
    showprompt: '夜幕降临，村民们围坐在篝火旁。', scope: ['@Eve'],
  });
  assert.equal(rt.humanWait.showprompt, '夜幕降临，村民们围坐在篝火旁。');
  assert.equal(rt.humanWait.prompt, '请陈述你的推理');
  // 无 showprompt 的节点：空串不缺字段
  bridge.onEvent('human_done', { node_name: '陈述', input: '好' });
  bridge.onEvent('human_wait', { job_id: 7, wait_key: 'wk-sp2', node_name: '陈述', prompt: 'x', scope: ['@Eve'] });
  assert.equal(rt.humanWait.showprompt, '');
});

test('runtime: 交卷对账出队+停下拆残留头——泵拿残留头复活等待态的病根封死', async () => {
  const { rt, bridge } = makeRuntime({});
  bridge.onEvent('human_wait', { job_id: 7, wait_key: 'wk-r', node_name: '发言', prompt: '…', scope: ['@Eve'] });
  assert.equal(rt.router.head()?.kind, 'human_wait', 'queue 遗留账：等待拍入队');

  // 交卷（/answer 与 push 两条路都经此包装）：落账后同拍把这一拍的头出队
  await rt.submitHumanOutput(7, 'wk-r', '我投一号。', '@Eve', {});
  assert.equal(rt.router.head(), undefined, '交卷后等待头出队');
  rt.clearHumanWait();
  rt.startPump();   // 泵扫一眼：无头+不running → 立退，不许把等待态写回来
  await new Promise(r => setTimeout(r, 1300));
  assert.equal(rt.humanWait, undefined, '镜像被清后不许从残留头复活');

  // 停下清场：残留的等待头一并拆（否则泵永久停驻+卡复活）。
  bridge.onEvent('human_wait', { job_id: 7, wait_key: 'wk-r2', node_name: '发言', prompt: '…', scope: ['@Eve'] });
  assert.equal(rt.router.head()?.kind, 'human_wait');
  rt.abortAll('test-stop');
  assert.equal(rt.router.head(), undefined, '停下后等待头出队');
  assert.equal(rt.humanWait, undefined, '停下后镜像收起');

  // 换场：新等待自动拆掉不同 wait_key 的残留头（旧头不许堵住队首）。
  bridge.onEvent('human_wait', { job_id: 8, wait_key: 'wk-old', node_name: '旧', prompt: '…', scope: ['@A'] });
  bridge.onEvent('human_wait', { job_id: 9, wait_key: 'wk-new', node_name: '新', prompt: '…', scope: ['@B'] });
  assert.equal(rt.router.head()?.wait_key, 'wk-new', '残留旧头被新等待拆掉');
});

// ── 回合领养（hello 三态）：页因任何原因重载都从这接回收话 ──────────────
test('runtime: hello 领养三态——已发送给 adopt、未发送重发原帧（同 tab reload）、无回合给空', async () => {
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 11, wait_key: 'wk-a1', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: '你睁眼' } });
  assert.equal(frames.length, 1);

  // 无回合的会话：空应答
  assert.deepEqual(rt.onSeatReport({ type: 'hello', sessionId: 's:nobody' }), { handled: true });

  // 已推进未发送 + 同 tab（reload 不换 tab id）：replay——原帧随应答重发（服务端不往
  // 长轮询队列重推：页面经 hello 应答自取，双通道各发一遍=同一句话打两遍）。
  const r1 = rt.onSeatReport({ type: 'hello', sessionId: SEAT.sessionId, tabId: SEAT.tabId });
  assert.equal(r1.replay?.deliveryId, frames[0].deliveryId);
  assert.equal(r1.replay.text, frames[0].text, '原帧正文原样');
  assert.equal(r1.replay.tabId, SEAT.tabId, '同 tab reload：寻址不变');

  // 防双页同发闸（j2713 豆包实案）：另一个标签页来认领发送中的回合（宽限窗内
  // 还有活气）——不重发，回 retryHelloMs 让它半分钟后再来。
  const r2 = rt.onSeatReport({ type: 'hello', sessionId: SEAT.sessionId, tabId: 77 });
  assert.equal(r2.replay, undefined, '现役页还在发送，帧不换页');
  assert.equal(r2.adopt, undefined);
  assert.equal(typeof r2.retryHelloMs, 'number', '被拒页拿到重认领间隔');
  assert.equal(frames.length, 1, '回合仍归现役页');

  // 已发送未回：adopt（领账查岗收尾）——adopt 不设闸，谁认领都给（first reply wins）
  rt.onSeatReport({ type: 'sent', deliveryId: frames[0].deliveryId });
  const r3 = rt.onSeatReport({ type: 'hello', sessionId: SEAT.sessionId, tabId: 77 });
  assert.equal(r3.adopt, frames[0].deliveryId);
  assert.equal(r3.replay, undefined, '已发送不再重发');

  // 收到结尾出列后再 hello：空（回合已收干净）
  rt.onSeatReport({ type: 'reply', deliveryId: frames[0].deliveryId, sessionId: SEAT.sessionId, text: '我是预言家' });
  await new Promise(r => setTimeout(r, 20));
  const r4 = rt.onSeatReport({ type: 'hello', sessionId: SEAT.sessionId });
  assert.deepEqual(r4, { handled: true }, '没有在飞回合=空');
});

test('runtime: hello 跨页接管——现役页活气静默超过宽限窗，别的标签页才接走帧', async () => {
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT, sendGraceMs: 40, retryHelloMs: 30 });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 12, wait_key: 'wk-a2', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });

  // 宽限窗内：另一页认领被拒（现役页刚推进，可能正在发送）
  const refused = rt.onSeatReport({ type: 'hello', sessionId: SEAT.sessionId, tabId: 88 });
  assert.equal(refused.replay, undefined);
  assert.equal(typeof refused.retryHelloMs, 'number');

  // 活气静默超过宽限窗（现役页八成死了）：放行接管，帧换新页寻址
  await new Promise(r => setTimeout(r, 80));
  const taken = rt.onSeatReport({ type: 'hello', sessionId: SEAT.sessionId, tabId: 88 });
  assert.equal(taken.replay?.deliveryId, frames[0].deliveryId, '静默超窗后换页接管');
  assert.equal(taken.replay.tabId, 88, '接管帧换新页寻址');
  assert.equal(taken.retryHelloMs, undefined, '放行时无需重认领');
});

test('runtime: send-failed 是活气——15s 自动重试中的页不被静默阶梯 reload（j2713 豆包实案回归锁）', async () => {
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT, silentReloadMs: 150, silentRemindMs: 10_000 });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 27, wait_key: 'wk-a3', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  const deliveryId = frames[0].deliveryId;

  // 发送失败重试链：每 50ms 一拍 send-failed（真实节奏 15s，这里拨快），持续
  // 300ms——远超 150ms 的 reload 线，但活气不断线，一次都不该 reload。
  for (let i = 1; i <= 6; i++) {
    await new Promise(r => setTimeout(r, 50));
    rt.onSeatReport({ type: 'send-failed', deliveryId, tries: i, message: '输入框未清空且未见生成启动' });
  }
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 0, '重试中的页是活页，阶梯不许 reload 它');

  // 重试链停了（页面真死了）：静默满线才 reload，且只此一次
  await new Promise(r => setTimeout(r, 300));
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 1, '活气断线、静默满线 → reload 照常接管');
});

// ── 静默阶梯（2026-10-02 用户定案+同日追加拍板：30s reload → 60s 提醒 → 120s 救援 reload，各恰一次 → 死等）──
// 时序余量：Windows 真实定时器粒度 ~15.6ms——阈值与等待都留足倍数，不赌粒度。
test('runtime: 静默阶梯——30s reload 恰一次，reload 后仍无内容才提醒，提醒后救援 reload 恰一次，之后死等', async () => {
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT, silentReloadMs: 20, silentRemindMs: 300, silentRescueMs: 600 });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 20, wait_key: 'wk-t1', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });

  await new Promise(r => setTimeout(r, 60));
  const reloads = frames.filter(f => f.type === 'reload-tab');
  assert.equal(reloads.length, 1, '静默 30s（拨快 20ms）自动 reload 恰一次');
  assert.equal(reloads[0].tabId, SEAT.tabId, 'reload 帧指向回合所在标签页');
  assert.ok(!frames.some(f => f.type === 'remind'), 'reload 没试过之前不弹提醒（阶梯①在②前）');
  assert.equal(rt.stats().inflight, 1, 'reload 不掐戏：回合仍在飞');

  await new Promise(r => setTimeout(r, 320)); // reload 后仍无内容 → 静默满提醒线（拨快 300ms）
  const remind = frames.find(f => f.type === 'remind');
  assert.ok(remind, 'reload 过了还没内容 → 弹提醒（阶梯②）');
  assert.match(remind.message, /已自动刷新仍未恢复内容/);
  assert.match(remind.message, /请在浏览器切换到那个标签页，这样点开就能简单的把他唤醒。$/, '提醒文案保留用户原话');
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 1, 'reload 恰一次（不循环轰炸）');
  assert.equal(rt.stats().inflight, 1, '提醒不掐戏：回合仍在飞');

  await new Promise(r => setTimeout(r, 420)); // 提醒后仍无内容 → 静默满救援线（拨快 600ms）
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 2, '提醒后仍无内容 → 救援 reload（阶梯③，回合 reload 总数 ≤2）');
  assert.equal(rt.stats().inflight, 1, '救援 reload 不掐戏：回合仍在飞');

  await new Promise(r => setTimeout(r, 120)); // 阶梯④：就等着
  assert.equal(frames.filter(f => f.type === 'remind').length, 1, '提醒恰一次');
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 2, '救援后不再 reload（不循环轰炸）');

  // 页面自己醒了（sent）→ 提醒撤回（remind-cancel）
  rt.onSeatReport({ type: 'sent', deliveryId: remind.deliveryId });
  assert.ok(frames.find(f => f.type === 'remind-cancel'), '醒了撤提醒');
});

test('runtime: reload 后页面重载 hello——未发送领到重发帧重走发车（阶梯①的接回闭环）', async () => {
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT, silentReloadMs: 20, silentRemindMs: 10_000 });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 26, wait_key: 'wk-t1b', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  await new Promise(r => setTimeout(r, 60));
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 1, '静默 reload 已发');

  // reload 不换 tab id（Chrome 语义）：同 tab 的 hello 在宽限窗内也放行（同页
  // 自己认领，不是别的标签页来抢）。
  const h = rt.onSeatReport({ type: 'hello', sessionId: SEAT.sessionId, tabId: SEAT.tabId });
  assert.equal(h.replay?.deliveryId, frames[0].deliveryId, 'reload 后页面 hello 领到重发帧');
  assert.equal(h.replay.tabId, SEAT.tabId, '重发帧寻址=同一个标签页');

  // 重发车后页面回 sent → 回合正常收尾路径不受阶梯干扰
  rt.onSeatReport({ type: 'sent', deliveryId: frames[0].deliveryId });
  const reply = rt.onSeatReport({ type: 'reply', deliveryId: frames[0].deliveryId, sessionId: SEAT.sessionId, text: '说完' });
  assert.equal(reply.handled, true);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(rt.stats().inflight, 0);
});

test('runtime: 有活气（delta）不 reload——静默基点随内容刷新', async () => {
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT, silentReloadMs: 120, silentRemindMs: 400 });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 25, wait_key: 'wk-t6', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  const deliveryId = frames[0].deliveryId;
  // delta 以远小于阈值的间隙持续到来（真实间隙 ~15.6ms << 120ms），跑过阈值线：
  // 一次 reload 都不该有
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 10));
    rt.onSeatReport({ type: 'delta', deliveryId, thinking: '', content: `${i}` });
  }
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 0, '流式活气在，不 reload');
  assert.ok(!frames.some(f => f.type === 'remind'), '也不提醒');

  // delta 停了：静默满线才 reload
  await new Promise(r => setTimeout(r, 180));
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 1, 'delta 停下、静默满线（拨快 120ms）→ reload');
});

test('runtime: 执行保险丝 3000s 到点——交 ⚠️ 占位台词跳过节点，不报 actor_failed', async () => {
  const calls = [];
  const bridge = { alive: true, send: async (cmd, args) => { calls.push({ cmd, args }); return {}; } };
  const { rt } = makeRuntime({ resolveSeat: async () => SEAT, bridge, execFuseMs: 40 });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 21, wait_key: 'wk-t2', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  await new Promise(r => setTimeout(r, 150));
  assert.equal(rt.stats().inflight, 0, '超时跳过：回合收走');
  assert.equal(calls.filter(c => c.cmd === 'actor_failed').length, 0, '超时不走 actor_failed（不挂起）');
  const speech = calls.find(c => c.cmd === 'post_speech');
  assert.ok(speech, '占位台词交卷（引擎正常落账，流程继续跑下一个节点）');
  assert.match(JSON.stringify(speech.args), /执行超时跳过/);
});

test('runtime: 闸内排队迟到拍被拒——同 id 面单在闸门口就响亮拒绝（去重守漏斗）', async () => {
  // 复刻 2026-10-02 幽灵回合实案：双来路面单 A/B 竞态，A 占闸派发、B 过了闸外
  // 检查——旧法 B 在闸里排队、A 交卷后进闸静默自去重（节点账面无回合）；现在
  // 闸门口就查同 id（占闸者/排队者），响亮拒绝。唤醒窗（75s）把这条缝拉大到
  // 整个 resolveSeat 期间，门口查同 id 是第四道闸（DeepSeek 实案：B 静默自吞
  // 后节点只剩 park 漂账干等保险丝）。
  const { rt, sent, frames } = makeRuntime({
    resolveSeat: async () => { await new Promise(r => setTimeout(r, 30)); return SEAT; },
  });
  rt.seats.upsertTabs('connA', [SEAT]);
  const brief = { job_id: 41, wait_key: 'wk-q', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } };
  const a = rt.dispatchActorRequest(brief);
  await new Promise(r => setTimeout(r, 5));   // A 已占闸（还在解析座位），B 此刻过闸外检查
  const b = await rt.dispatchActorRequest(brief);
  assert.equal(b.accepted, false);
  assert.equal(b.reason, 'duplicate', 'B 在闸门口被同 id 查重响亮拒绝');
  await a;
  assert.equal(sent.length, 1, 'A 正常下发一次');
  rt.onSeatReport({ type: 'reply', deliveryId: sent[0].deliveryId, text: '说完' });
  await new Promise(r => setTimeout(r, 80));  // 放闸 → B 的闸任务执行
  assert.equal(sent.length, 1, '迟到拍没有第二次下发（幽灵回合根除）');
  assert.equal(rt.stats().inflight, 0, '账上没有幽灵');
});

test('runtime: parked 帧也进静默阶梯——busy 卡死时 30s reload 唤醒冻页，busy:false 到达后补发', async () => {
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT, silentReloadMs: 20, silentRemindMs: 10_000 });
  rt.seats.upsertTabs('connA', [{ ...SEAT, busy: true }]); // busy 卡死（页面 busy:false 上报丢失的复刻）
  const r = await rt.dispatchActorRequest({ job_id: 27, wait_key: 'wk-p', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  assert.equal(r.accepted, true);
  assert.equal(r.queued, true, 'busy 残留 → 挂席位队');
  assert.ok(!frames.some(f => !f.type), '帧未推（busy 卡死，没有下发帧）');
  await new Promise(r2 => setTimeout(r2, 40));
  assert.equal(frames.filter(f => f.type === 'reload-tab').length, 1, 'parked 静默 30s（拨快 20ms）→ reload 唤醒冻页');

  // 页面复活：busy:false 到达（reload 后 pong 同样会清）→ 补发节流后推帧
  rt.onSeatReport({ type: 'busy', sessionId: SEAT.sessionId, busy: false });
  await new Promise(r2 => setTimeout(r2, 600));
  const deliver = frames.find(f => !f.type);
  assert.ok(deliver, 'busy:false 后补发队头');
  assert.equal(deliver.sessionId, SEAT.sessionId);

  rt.onSeatReport({ type: 'sent', deliveryId: deliver.deliveryId });
  const reply = rt.onSeatReport({ type: 'reply', deliveryId: deliver.deliveryId, sessionId: SEAT.sessionId, text: '说完' });
  assert.equal(reply.handled, true);
  await new Promise(r2 => setTimeout(r2, 20));
  assert.equal(rt.stats().inflight, 0);
});

test('runtime: 重试牌唤醒失败 → 同款 park 降级（立即提醒+保险丝+终局撤条），attempt 入账对号', async () => {
  const calls = [];
  const bridge = { alive: true, send: async (cmd, args) => { calls.push({ cmd, args }); return {}; } };
  const { rt, frames } = makeRuntime({
    bridge,
    execFuseMs: 40,
    resolveSeat: async () => { throw new Error('唤醒超时'); },
  });
  const r = await rt.dispatchActorRetry({ actorName: 'wolf-seer', waitKey: 'wk-r1', feedback: '重写', attempt: 2, jobId: 28 });
  assert.equal(r.accepted, false);
  const remind = frames.find(f => f.type === 'remind');
  assert.ok(remind, '重试牌唤醒失败立即提醒（不再干等引擎 3600s 无声）');
  assert.equal(remind.deliveryId, '28/wk-r1/2', 'attempt 入账：与首发同 wait_key 不同 attempt，id 对得上号');
  await new Promise(res => setTimeout(res, 120));
  assert.equal(rt.stats().inflight, 0, '保险丝到点占位跳过、回合出账');
  assert.equal(calls.filter(c => c.cmd === 'actor_failed').length, 0, '不挂起');
  assert.match(JSON.stringify(calls.find(c => c.cmd === 'post_speech').args), /执行超时跳过/);
  assert.ok(frames.some(f => f.type === 'remind-cancel'), 'park 回合终局也撤横条（没有 connId → 广播撤）');
});

test('runtime: 重试牌座位解析用上一回合的 soul——actor_name 是显示名，选角账按 soul id 键查不中', async () => {
  // 引擎 node_retry 信不带面单（brief 恒缺），retry.actor_name 是「@角色名（灵魂名）」
  // 显示形态——狼人杀实案 soul='ai4'、actor_name='@4号（AI-4号）'，拿它查 cast 账
  // 必落空 → 重演永远到不了网页（老病：只落提醒+保险丝占位跳过）。
  const resolved = [];
  const { rt, sent } = makeRuntime({
    resolveSeat: async (jobId, soul) => { resolved.push(`${jobId}/${soul}`); return SEAT; },
  });
  rt.seats.upsertTabs('connA', [SEAT]);

  const first = await rt.dispatchActorRequest({
    job_id: 30, wait_key: 'wk-rt', node_name: '守卫', actor_name: '@4号（AI-4号）',
    actor_info: { soul: 'ai4' }, blocks: { prompt: '你睁眼了' },
  });
  assert.equal(first.accepted, true);
  rt.onSeatReport({ type: 'sent', deliveryId: sent[0].deliveryId, sessionId: SEAT.sessionId });
  rt.onSeatReport({ type: 'reply', deliveryId: sent[0].deliveryId, sessionId: SEAT.sessionId, text: '我守了4号' });
  await new Promise(r => setTimeout(r, 20));

  const r = await rt.dispatchActorRetry({ actorName: '@4号（AI-4号）', waitKey: 'wk-rt', feedback: '必须赋值 @CHECK', attempt: 1, jobId: 30 });
  assert.equal(r.accepted, true);
  assert.deepEqual(resolved, ['30/ai4', '30/ai4'], '首发与重试都拿 soul id 解座——重试从上一回合记忆捞回，不拿显示名硬查');
  assert.equal(sent.length, 2);
  assert.match(sent[1].text, /重审请求/);
  assert.equal(sent[1].meta.attempt, 1);
  assert.equal(sent[1].meta.soul, 'ai4', '重演回合 soul 正身入账（交卷信封不再带显示名）');
  assert.equal(sent[1].sessionId, SEAT.sessionId);
});

test('runtime: 重试牌座位解析补一级——首发没到过席位（park/别家宿主）也从首发料包登记表捞回正身', async () => {
  // doneByWait 只记「真到过席位」的回合（park 漂账不记，防毒化）。首发落 park
  // 的场合旧版重试牌只剩 actor_name 兜底——拿显示名查账必落空，又弹一张「查无
  // 座位」横条。补级=ai_request 那一拍记下的显示名↔正身对照（引擎唯一同时带
  // 两样的信；别家宿主绑定的灵魂正是靠这一级才判得出 foreignHost 而静默跳过）。
  const resolved = [];
  let seatCalls = 0;
  const { rt, sent, frames } = makeRuntime({
    execFuseMs: 40,
    resolveSeat: async (jobId, soul) => {
      resolved.push(`${jobId}/${soul}`);
      seatCalls += 1;
      if (seatCalls === 1) throw new Error('唤醒超时；ref=chat.deepseek.com:abc');
      return SEAT;
    },
  });
  rt.seats.upsertTabs('connA', [SEAT]);

  const first = await rt.dispatchActorRequest({
    job_id: 44, wait_key: 'wk-reg', node_name: '守卫', actor_name: '@4号（AI-4号）',
    actor_info: { soul: 'ai4' }, blocks: { prompt: '你睁眼了' },
  });
  assert.equal(first.accepted, false);
  assert.match(String(first.reason), /no-seat/);
  assert.equal(frames.filter(f => f.type === 'remind').length, 1, 'web 自己的灵魂唤醒失败照旧弹提醒');

  const retry = await rt.dispatchActorRetry({ actorName: '@4号（AI-4号）', waitKey: 'wk-reg', feedback: '必须赋值', attempt: 1, jobId: 44 });
  assert.equal(retry.accepted, true);
  assert.deepEqual(resolved, ['44/ai4', '44/ai4'], '首发与重试都拿 soul id 解座——重试从首发料包登记表捞回，不拿显示名硬查');
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /重审请求/);
  assert.equal(sent[0].meta.soul, 'ai4');
  await new Promise(res => setTimeout(res, 120)); // 前一个 park 的保险丝收账，不悬挂
});

test('runtime: 「已发送」不清零执行保险丝——生成期超时同款跳过', async () => {
  const calls = [];
  const bridge = { alive: true, send: async (cmd, args) => { calls.push({ cmd, args }); return {}; } };
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT, bridge, execFuseMs: 60 });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 22, wait_key: 'wk-t3', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  rt.onSeatReport({ type: 'sent', deliveryId: frames[0].deliveryId }); // 已发送（进入生成期）
  await new Promise(r => setTimeout(r, 200));
  assert.equal(rt.stats().inflight, 0, '生成期超时同样跳过（节点超时按整节点理解）');
  assert.equal(calls.filter(c => c.cmd === 'actor_failed').length, 0, '不挂起');
  assert.match(JSON.stringify(calls.find(c => c.cmd === 'post_speech').args), /执行超时跳过/);
});

test('runtime: 活页面的真 error 仍判死（契约不动）——actor_failed 挂起可续', async () => {
  const failures = [];
  const bridge = { alive: true, send: async (cmd, args) => { if (cmd === 'actor_failed') failures.push(args); return {}; } };
  const { rt, frames } = makeRuntime({ resolveSeat: async () => SEAT, bridge });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 23, wait_key: 'wk-t4', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  rt.onSeatReport({ type: 'error', deliveryId: frames[0].deliveryId, kind: 'error', message: '发送手势失败' });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(failures.length, 1, '真 error 照旧 actor_failed（引擎挂起可续）');
  assert.equal(rt.stats().inflight, 0);
});

test('runtime: 定向投递失败→广播兜底（阶梯帧不卡在死连接上）', async () => {
  const broadcasts = [];
  const direct = [];
  const rt = createFemoRuntime({
    bridge: { alive: true, send: async () => ({}) },
    log: () => {},
    deliverFrame: (connId, frame) => { direct.push(frame.type); return !frame.type; }, // 下发帧成功推进；阶梯帧（reload/remind）定向必败
    broadcastFrame: frame => { broadcasts.push(frame); return true; },
    surface: {},
    resolveSeat: async () => SEAT,
    silentReloadMs: 20,
    silentRemindMs: 45,
  });
  rt.seats.upsertTabs('connA', [SEAT]);
  await rt.dispatchActorRequest({ job_id: 24, wait_key: 'wk-t5', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  await new Promise(r => setTimeout(r, 70));
  assert.equal(broadcasts.filter(f => f.type === 'reload-tab').length, 1, 'reload 帧定向失败回落广播');
  assert.equal(broadcasts.filter(f => f.type === 'remind').length, 1, '提醒定向失败回落广播');
  assert.match(broadcasts.find(f => f.type === 'remind').message, /已自动刷新仍未恢复内容/);
});

test('runtime: model_id 落账——交卷信封带 web:<站点名>；席位无 site 不伪造', async () => {
  // 存储层贯通（2026-10-02）：回合立账时按席位物理账的 site 换算 web:<SITE_LABEL>，
  // reply 交卷随信封 body.model_id 上交引擎落 react_steps.model_id。
  const calls = [];
  const bridge = { alive: true, send: async (cmd, args) => { calls.push({ cmd, args }); return {}; } };
  const SEAT_GLM = { ...SEAT, sessionId: 'chatglm.cn:0123456789abcdef012345ab', site: 'chatglm.cn' };
  const { rt, sent } = makeRuntime({ resolveSeat: async () => SEAT_GLM, bridge });
  rt.seats.upsertTabs('connA', [SEAT_GLM]);
  await rt.dispatchActorRequest({ job_id: 51, wait_key: 'wk-m1', node_name: '乙', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  rt.onSeatReport({ type: 'sent', deliveryId: sent[0].deliveryId, sessionId: SEAT_GLM.sessionId });
  rt.onSeatReport({ type: 'reply', deliveryId: sent[0].deliveryId, sessionId: SEAT_GLM.sessionId, text: '说完了' });
  await new Promise(r => setTimeout(r, 20));
  const speech = calls.find(c => c.cmd === 'post_speech');
  assert.ok(speech, '正常交卷');
  assert.equal(speech.args.body.model_id, 'web:ChatGLM', 'model_id=web:站点显示名（SITE_LABEL，站点包契约件换算）');

  // 席位物理账没 site（异常态）→ 信封不带 model_id，引擎落空串（登记制不伪造）
  const calls2 = [];
  const bridge2 = { alive: true, send: async (cmd, args) => { calls2.push({ cmd, args }); return {}; } };
  const { rt: rt2, sent: sent2 } = makeRuntime({ resolveSeat: async () => SEAT, bridge: bridge2 });
  rt2.seats.upsertTabs('connA', [SEAT]);
  await rt2.dispatchActorRequest({ job_id: 52, wait_key: 'wk-m2', node_name: '甲', actor_name: 'wolf-seer', actor_info: { soul: 'wolf-seer' }, blocks: { prompt: 'x' } });
  rt2.onSeatReport({ type: 'sent', deliveryId: sent2[0].deliveryId, sessionId: SEAT.sessionId });
  rt2.onSeatReport({ type: 'reply', deliveryId: sent2[0].deliveryId, sessionId: SEAT.sessionId, text: '说完了' });
  await new Promise(r => setTimeout(r, 20));
  const speech2 = calls2.find(c => c.cmd === 'post_speech');
  assert.ok(speech2, '无 site 席位照常交卷');
  assert.equal(speech2.args.body.model_id, undefined, '无 site 不伪造 model_id（信封不带该栏）');
});
