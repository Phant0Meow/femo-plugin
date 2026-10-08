/**
 * variable-api.test.mjs — 变量世界观测 API 单测（2026-09-23 十连裁⑤）。
 * 运行：node --test zcodeAdapter/tests/variable-api.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createVariableApi, VARIABLE_EVENTS } from '../../../femo2host/host/variable-api.mjs';

test('handles：三事件管辖，其余不认', () => {
  const api = createVariableApi();
  assert.deepEqual([...VARIABLE_EVENTS].sort(), ['assign_result', 'checkpoint', 'func_result']);
  assert.equal(api.handles('checkpoint'), true);
  assert.equal(api.handles('func_result'), true);
  assert.equal(api.handles('assign_result'), true);
  assert.equal(api.handles('node_start'), false);
  assert.equal(api.handles('human_wait'), false);
});

test('ingest checkpoint：brief 剥 state 变量世界整包，full 原样', () => {
  const api = createVariableApi();
  const briefs = [];
  const fulls = [];
  api.subscribe('brief', (r) => briefs.push(r));
  api.subscribe('full', (r) => fulls.push(r));
  api.ingest('checkpoint', {
    job_id: 7,
    checkpoints: { '__main__': '第3场' },
    state: { 金币: 42, 密信: '……' },
  });
  assert.equal(briefs.length, 1);
  assert.equal(briefs[0].kind, 'checkpoint');
  assert.equal(briefs[0].jobId, 7);
  assert.deepEqual(briefs[0].checkpoints, { '__main__': '第3场' });
  assert.equal('state' in briefs[0], false, 'brief 不得外泄变量世界整包');
  assert.equal(fulls[0].state.金币, 42, 'full 保留变量世界整包');
});

test('ingest func/assign：brief 剥 input，output 两档都有', () => {
  const api = createVariableApi();
  const seen = { brief: [], full: [] };
  api.subscribe('brief', (r) => seen.brief.push(r));
  api.subscribe('full', (r) => seen.full.push(r));
  api.ingest('func_result', { job_id: 3, node_name: '[掷骰]', input: { sides: 6 }, output: { 点数: 5 } });
  api.ingest('assign_result', { job_id: 3, node_name: '[记账]', input: { expr: '金币+=5' }, output: { 金币: 47 } });
  for (const r of seen.brief) {
    assert.equal('input' in r, false, 'brief 不得外泄入参');
    assert.ok(r.output, 'brief 保留结果');
    assert.ok(r.node, '归一字段 node=node_name');
  }
  assert.equal(seen.full[0].input.sides, 6);
  assert.equal(seen.full[1].output.金币, 47);
});

test('退订生效 + 非管辖事件零分发', () => {
  const api = createVariableApi();
  const hits = [];
  const off = api.subscribe('full', (r) => hits.push(r));
  off();
  api.ingest('checkpoint', { job_id: 1, checkpoints: { a: 'b' } });
  assert.equal(hits.length, 0, '退订后不再收到');
  const on = api.subscribe('full', (r) => hits.push(r));
  api.ingest('checkpoint', { job_id: 1, checkpoints: { a: 'b' } });
  assert.equal(hits.length, 1);
  on();
  api.ingest('checkpoint', { job_id: 1, checkpoints: { a: 'b' } });
  assert.equal(hits.length, 1, '再次退订后仍不再收到');
  assert.equal(api.ingest('node_start', { job_id: 1 }), null, '非管辖事件返回 null 且不分发');
});

test('订阅者抛异常不影响其他订阅者', () => {
  const api = createVariableApi();
  const seen = [];
  api.subscribe('brief', () => { throw new Error('坏订阅者'); });
  api.subscribe('brief', (r) => seen.push(r));
  const rec = api.ingest('assign_result', { job_id: 2, node_name: 'x', output: { v: 1 } });
  assert.ok(rec);
  assert.equal(seen.length, 1, '坏订阅者被吞、好订阅者照收');
});
