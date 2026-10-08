/**
 * run-state-core.test.mjs — 运行态镜簿骨架单测（2026-09-23 批次 D 上收）。
 * 运行：node --test zcodeAdapter/tests/run-state-core.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  jobMirrorPrearm, jobMirrorCorrect, jobMirrorSetState, jobMirrorClear,
  clearActiveIfActive, isSessionRunning, activeJobOf, projectionStateOf,
  noteNodeScope, noteNodeActor, noteNodeShowprompt,
} from '../../../femo2host/host/run-state-core.mjs';

function freshState() {
  return { jobs: new Map(), sidIndex: new Map(), activeJobId: undefined };
}

test('prearm：登记+sidIndex+活跃指针三连；correct 幂等不覆盖', () => {
  const s = freshState();
  jobMirrorPrearm(s, 1, 'session-a');
  assert.equal(s.activeJobId, 1);
  assert.equal(s.jobs.get(1).state, 'running');
  jobMirrorCorrect(s, 1, 'session-a');   // 已登记 → 零操作
  assert.equal(s.jobs.get(1).ownerSid, 'session-a');
});

test('setState：同态 unchanged、异态 changed（宿主广播据此判定）', () => {
  const s = freshState();
  jobMirrorPrearm(s, 1, 'session-a');
  assert.equal(jobMirrorSetState(s, 1, 'running'), 'unchanged', '同态不重复');
  assert.equal(jobMirrorSetState(s, 1, 'finished'), 'changed');
  assert.equal(s.jobs.get(1).state, 'finished');
  assert.equal(jobMirrorSetState(s, 99, 'failed'), 'unchanged', '无 mirror 不炸');
});

test('clear：running→suspended 且清活跃指针；非 running 只清指针', () => {
  const s = freshState();
  jobMirrorPrearm(s, 1, 'session-a');
  assert.equal(jobMirrorClear(s, 1), 'changed');
  assert.equal(s.jobs.get(1).state, 'suspended');
  assert.equal(s.activeJobId, undefined);
  jobMirrorSetState(s, 1, 'finished');
  assert.equal(jobMirrorClear(s, 1), 'unchanged', '非 running 不再翻 suspended');
});

test('isSessionRunning：running+owner+活跃 三条件缺一不可', () => {
  const s = freshState();
  jobMirrorPrearm(s, 1, 'session-a');
  assert.equal(isSessionRunning(s, 'session-a'), true);
  assert.equal(isSessionRunning(s, 'session-b'), false, '无账会话');
  jobMirrorSetState(s, 1, 'suspended');
  assert.equal(isSessionRunning(s, 'session-a'), false, '非 running');
  jobMirrorPrearm(s, 2, 'session-b');
  assert.equal(isSessionRunning(s, 'session-a'), false, '有 running 镜像但不是活跃 Job');
});

test('projectionStateOf：waiting 快照优先+outVars/prompt；非等待全空', () => {
  const s = freshState();
  jobMirrorPrearm(s, 1, 'session-a');
  assert.deepEqual(projectionStateOf(s, 'session-a'), {
    running: true, waiting: false, waitScope: [], outVars: [],
  });
  const mirror = activeJobOf(s, 'session-a');
  mirror.waitingHuman = {
    waitKey: 'k1', nodeName: '[投票]', prompt: '请投票',
    outVars: ['票'], waitScope: ['@上帝', '@小机'],
  };
  const st = projectionStateOf(s, 'session-a');
  assert.equal(st.waiting, true);
  assert.deepEqual(st.waitScope, ['@上帝', '@小机'], '冻结快照优先（par 覆盖免疫）');
  assert.deepEqual(st.outVars, ['票']);
  assert.equal(st.prompt, '请投票');
  mirror.waitingHuman.waitScope = undefined;  // 旧形态无快照 → 回退 nodeScopes 查表
  noteNodeScope(mirror, '[投票]', ['@上帝']);
  assert.deepEqual(projectionStateOf(s, 'session-a').waitScope, ['@上帝']);
});

test('节点登记表：undefined/空名不写入', () => {
  const s = freshState();
  jobMirrorPrearm(s, 1, 'session-a');
  const m = activeJobOf(s, 'session-a');
  noteNodeScope(m, undefined, ['x']);
  noteNodeScope(m, '[a]', undefined);
  noteNodeActor(m, '[a]', '');
  noteNodeShowprompt(m, undefined, '提示');
  assert.equal(m.nodeScopes.size, 0);
  assert.equal(m.nodeActors.size, 0);
  assert.equal(m.nodeShowprompts.size, 0);
  noteNodeScope(m, '[a]', ['@上帝']);
  noteNodeActor(m, '[a]', '@上帝');
  noteNodeShowprompt(m, '[a]', '开场白');
  assert.equal(m.nodeScopes.get('[a]')[0], '@上帝');
  assert.equal(m.nodeActors.get('[a]'), '@上帝');
  assert.equal(m.nodeShowprompts.get('[a]'), '开场白');
});
