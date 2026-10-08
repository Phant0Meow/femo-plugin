/**
 * event-router.test.mjs — 引擎事件路由器单测（合成事件，无真桥无真引擎）
 * 运行：node --test zcodeAdapter/tests/event-router.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryStore as createProjectionStore } from './memory-store.mjs';
import { createEventRouter } from '../mcp/event-router.mjs';

function rig(t, { dispatch } = {}) {
  const store = createProjectionStore();
  const sent = [];
  const router = createEventRouter({
    store,
    sid: 'femo-main',
    dispatch, // 'queue'=v1 遗留拉取队列契约的回归测试用；v2 默认 'off'=单通道纯记账
    send: async (cmd, args) => { sent.push({ cmd, args }); return { ok: true }; },
  });
  return { store, router, sent };
}

const godTexts = (store, sid = 'femo-main') => store.readWindow(sid, 'god').map(r => `${r.data.kind ?? r.type}:${r.data.text ?? ''}`);

test('flow_start：建窗 + 开演行 + 运行态', t => {
  const { store, router } = rig(t);
  router.handleEvent('flow_start', { job_id: 1, name: '狼人杀', actors: ['@女巫', '@猎人'], main_actors: ['导演'] });
  const st = router.state();
  assert.equal(st.running, true);
  assert.equal(st.playName, '狼人杀');
  assert.deepEqual(st.actors, ['@女巫', '@猎人']);
  assert.deepEqual(st.mainActors, ['导演']);
  assert.ok(godTexts(store)[0].includes('启动运行'));
  assert.ok(store.hasWindow('femo-main', '@女巫'));
});

test('human 节点：📢 提示行 + human_wait 登记与清除 + 交卷', async t => {
  const { store, router, sent } = rig(t);
  router.handleEvent('flow_start', { job_id: 7, name: 'x', actors: ['@村民'] });
  router.handleEvent('node_start', { job_id: 7, node_name: 'n1', node_type: 'human', prompt: '请投票', scope: ['@村民'] });
  assert.ok(godTexts(store).some(x => x.includes('prompt:📢 请投票')));

  router.handleEvent('human_wait', { job_id: 7, node_name: 'n1', wait_key: 'r1human_n1_1', prompt: '请投票', scope: ['@村民'] });
  assert.equal(router.state().waitingHuman.wait_key, 'r1human_n1_1');
  assert.ok(godTexts(store).some(x => x.includes('human_wait:🎭 等待你的回应：请投票')));

  // 交卷走 human_input 合约（台词唯一正身=steps 末步 reply）
  await router.submitOutput(7, 'r1human_n1_1', '我投女巫');
  assert.deepEqual(sent[0].args, { job_id: 7, wait_key: 'r1human_n1_1', soul: 'main', payload: '我投女巫', body: { steps: [{ step: 0, reply: '我投女巫' }] } });

  // 人类席交卷走人类信封（2026-09-21）：引擎人类节点只读 chat_text/variables
  await router.submitHumanOutput(7, 'r1human_n1_2', '我投女巫', '@村民', { 票数: '1' });
  assert.deepEqual(sent[1].args, {
    job_id: 7, wait_key: 'r1human_n1_2', soul: '@村民', payload: '我投女巫',
    body: { chat_text: '我投女巫', variables: { 票数: '1' } },
  });

  // 用户输入落角色窗（scope 过滤）
  router.projectUserLine('@村民', '我投女巫', ['@村民']);
  const villager = store.readWindow('femo-main', '@村民').map(r => r.data.text);
  assert.ok(villager.includes('我投女巫'));

  router.handleEvent('human_done', { job_id: 7 });
  assert.equal(router.state().waitingHuman, undefined);
});

test('ai_request 分流：main 进 directive 队列，非 main 不进；blocks 原样转发（queue 遗留契约）', t => {
  const { router } = rig(t, { dispatch: 'queue' });
  router.handleEvent('flow_start', { job_id: 1, name: 'x', actors: ['女巫'] });
  router.handleEvent('ai_request', {
    job_id: 1, wait_key: 'r1ai_n1_1', node_name: 'n1', actor_name: '女巫', source: '',
    blocks: { context: 'CTX', memory: 'MEM', prompt: '演吧' }, scope_info: ['@女巫'],
  });
  const an = router.takeDirective();
  assert.equal(an.kind, 'ai_node'); // 非 main = ai_node 拍（模型 spawn 子代理演）
  assert.equal(an.brief_id, 'r1ai_n1_1');

  router.handleEvent('ai_request', {
    job_id: 1, wait_key: 'r1ai_n2_1', node_name: 'n2', actor_name: '导演', source: 'main',
    blocks: { context: 'CTX2', memory: 'MEM2', prompt: '到你了' }, scope_info: ['@导演'],
  });
  assert.equal(router.pendingDirectiveCount(), 1);
  const d = router.takeDirective();
  assert.equal(d.kind, 'directive');
  assert.equal(d.prompt, '到你了');
  assert.equal(d.context, 'CTX2');
  assert.equal(d.memory, 'MEM2');
  assert.equal(d.wait_key, 'r1ai_n2_1');
  assert.equal(takeUndefined(router), undefined); // 队列已空
});

function takeUndefined(router) { return router.takeDirective(); }

test('ai_done：role 行按 nodeActors 解析演员名，scope 过滤生效', t => {
  const { store, router } = rig(t);
  router.handleEvent('flow_start', { job_id: 1, name: 'x', actors: ['@女巫', '@猎人'] });
  router.handleEvent('context_ready', { job_id: 1, node_name: 'n1', actor_name: '女巫' });
  router.handleEvent('ai_request', { job_id: 1, wait_key: 'k', node_name: 'n1', actor_name: '女巫', source: '', blocks: {}, scope_info: ['@女巫'] });
  router.handleEvent('ai_done', { job_id: 1, node_name: 'n1', output: '我怀疑猎人。' });

  const witch = store.readWindow('femo-main', '@女巫').map(r => r.data);
  const hunter = store.readWindow('femo-main', '@猎人').map(r => r.data);
  const roleRow = witch.find(d => d.kind === 'role');
  assert.ok(roleRow && roleRow.text.includes('我怀疑猎人') && roleRow.actor === '女巫');
  assert.ok(!hunter.some(d => d.kind === 'role' && d.text.includes('我怀疑猎人'))); // scope 隔离
});

test('waitDirective：队列空时挂起，事件到达即唤醒（queue 遗留契约）', async t => {
  const { router } = rig(t, { dispatch: 'queue' });
  router.handleEvent('flow_start', { job_id: 1, name: 'x', actors: [] });
  const pending = router.waitDirective();
  await new Promise(r => setTimeout(r, 20));
  router.handleEvent('ai_request', {
    job_id: 1, wait_key: 'k1', node_name: 'n', actor_name: '导演', source: 'main', blocks: { prompt: 'p' },
  });
  const d = await pending;
  assert.equal(d.kind, 'directive');
});

test('终态：flow_done / flow_error / flow_paused 唤醒等待者并清队列（queue 遗留契约）', async t => {
  const { store, router } = rig(t, { dispatch: 'queue' });
  router.handleEvent('flow_start', { job_id: 1, name: 'x', actors: [] });
  router.handleEvent('ai_request', { job_id: 1, wait_key: 'k', node_name: 'n', actor_name: 'd', source: 'main', blocks: {} });
  assert.equal(router.takeDirective().kind, 'directive'); // 先取走 directive，队列空
  const pending = router.waitDirective();                 // 此时挂起
  router.handleEvent('flow_done', { job_id: 1, summary: '好人胜' });
  const done = await pending; // 终态标记唤醒等待者
  assert.equal(done.kind, 'flow_done');
  assert.equal(router.state().running, false);
  assert.ok(godTexts(store).some(x => x.includes('✅ FEMO 已跑完')));
  assert.ok(godTexts(store).some(x => x.includes('✅ FEMO 已跑完')));

  const { store: s2, router: r2 } = rig(t, { dispatch: 'queue' });
  r2.handleEvent('flow_start', { job_id: 1, name: 'x', actors: [] });
  const p2 = r2.waitDirective();
  r2.handleEvent('flow_error', { job_id: 1, error: '语法炸了' });
  const term2 = await p2;
  assert.equal(term2.kind, 'flow_error');
  assert.equal(term2.error, '语法炸了');

  const { router: r3 } = rig(t, { dispatch: 'queue' });
  r3.handleEvent('flow_start', { job_id: 1, name: 'x', actors: [] });
  r3.handleEvent('ai_request', { job_id: 1, wait_key: 'k', node_name: 'n', actor_name: 'd', source: 'main', blocks: {} });
  assert.equal(r3.takeDirective().kind, 'directive'); // 先取走 directive，队列空
  const p3 = r3.waitDirective();
  r3.handleEvent('flow_paused', { job_id: 1 });
  const term3 = await p3;
  assert.equal(term3.kind, 'flow_paused');
  assert.equal(r3.state().waitingHuman, undefined);
});

test('notify_author：notice 行进窗；ai_retry 已拔管不产行', t => {
  const { store, router } = rig(t);
  router.handleEvent('flow_start', { job_id: 1, name: 'x', actors: [] });
  router.handleEvent('ai_retry', { job_id: 1, node_name: 'n', errors: ['SET VARIABLE 缺失'], attempt: 2 });
  router.handleEvent('notify_author', { job_id: 1, message: '第 2 节点两次失败' });
  const texts = godTexts(store);
  assert.ok(!texts.some(x => x.includes('SET VARIABLE 缺失')), 'ai_retry 已拔管（2026-09-23）：不再产显示行');
  assert.ok(texts.some(x => x.includes('第 2 节点两次失败')));
});
