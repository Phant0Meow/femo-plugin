/**
 * pulled-letter.test.mjs — 信件注入文案渲染单测。
 * 运行：node --test zcodeAdapter/tests/pulled-letter.test.mjs
 *
 * 注入文案只点名与给料，交卷=Stop 钩子自动收集整回合发言——文案里不得出现
 * 任何交卷命令教学（单测锁死）。
 * 验四件事：node_retry 重演通知按 pullSoul 点名、context 开口通知按 pullSoul
 * 点名（附身/main 两形态）、其余 kind 透传、任何分支都不含命令教学。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderPulledLetter } from '../runtime/pulled-letter.mjs';
import { SET_VARIABLE_TEACHING } from '../../../femo2host/host/node-retry.mjs';

describe('node_retry 重演通知', () => {
  const letter = {
    kind: 'notice', subkind: 'node_retry', job_id: 7,
    soul: 'wytch', node: '[看牌]', ref: 'j7:ai_[看牌]_2', target_host: 'zcode',
    payload: 'SET VARIABLE 行格式错误：缺 variables 前缀',
    push_extra: { retry: { wait_key: 'j7:ai_[看牌]_2', attempt: 2, feedback: 'SET VARIABLE 行格式错误：缺 variables 前缀', actor_name: 'wytch' } },
  };

  test('按会话附身角色点名，带反馈正文与自动交卷说明，无命令教学', () => {
    const out = renderPulledLetter(letter, 'wytch');
    assert.ok(out.includes('轮到你（wytch）重演（第 2 次反馈）（节点「[看牌]」）'), out);
    assert.ok(out.includes('未通过FEMO脚本校验'), out);
    assert.ok(out.includes('SET VARIABLE 行格式错误：缺 variables 前缀'), out);
    assert.ok(out.includes('最后一条消息'), out);
    // 赋值格式教学与推送宿主同源（2026-09-29 收编：措辞唯一权威=node-retry，
    // 此前拉取路漏了教学，重演赋值节点时演员拿不到格式提示）。
    assert.ok(out.includes(SET_VARIABLE_TEACHING), out);
    assert.ok(!out.includes('--soul'), out);
  });

  test('main 席点名不带灵魂名', () => {
    const out = renderPulledLetter(letter, 'main');
    assert.ok(out.includes('轮到你（main）重演'), out);
  });

  test('attempt 缺省不带次数控', () => {
    const bare = { ...letter, push_extra: { retry: { wait_key: 'k', feedback: 'x', actor_name: 'wytch' } } };
    const out = renderPulledLetter(bare, 'wytch');
    assert.ok(!out.includes('第  次'), out);
    assert.ok(out.includes('重演（节点「[看牌]」）'), out);
  });
});

describe('context 开口通知', () => {
  test('附身会话按 pullSoul 点名，教先架哨兵后开口，无命令', () => {
    const letter = { kind: 'context', job_id: 4, node: '[open]', ref: 'j4:ai_[open]_1', target_host: 'zcode', payload: '料包正文' };
    const out = renderPulledLetter(letter, 'the1stlittlesoul');
    assert.equal(
      out,
      `[femo] 轮到你（the1stlittlesoul）发言（节点「[open]」）：\n料包正文\n[femo] 本回合就是你的节点发言：先架好哨兵，再把台词作为本回合最后一条消息正常说出（纯文本即可）——插件自动收卷它交卷，不要调用任何 femo 工具或命令来交卷。`,
    );
  });

  test('main 席形态', () => {
    const letter = { kind: 'context', job_id: 4, node: '[open]', ref: 'j4:ai_[open]_1', target_host: 'zcode', payload: '料包正文' };
    const out = renderPulledLetter(letter, 'main');
    assert.ok(out.startsWith('[femo] 轮到你（main）发言（节点「[open]」）：'), out);
    assert.ok(!out.includes('--soul'), out);
  });
});

describe('其余透传', () => {
  test('普通 notice 与未知 kind', () => {
    assert.equal(renderPulledLetter({ kind: 'notice', payload: '终局了' }, 'main'), '[femo] 终局了');
    assert.equal(renderPulledLetter({ kind: 'speech', payload: '奇怪的信' }, 'main'), '[femo] speech：奇怪的信');
  });

  test('subkind=node_retry 但面单缺失 → 不走重演教学，按普通 notice 透传', () => {
    const out = renderPulledLetter({ kind: 'notice', subkind: 'node_retry', payload: '裸反馈' }, 'main');
    assert.equal(out, '[femo] 裸反馈');
  });
});
