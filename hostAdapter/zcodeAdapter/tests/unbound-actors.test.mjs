/**
 * unbound-actors.test.mjs — 剧本演员表解析（tools-core 单源）的回归锁。
 * scriptActorSouls 是 actors 区语法的唯一一份解析：开演校验（zcode/web 的
 * femo_run 准入）与 web 运行前点名（/seats/attendance 的 needed）共吃，
 * 解析一动两处同时变——这里锁行为。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scriptActorSouls, unboundActorSouls } from '../../../femo2host/host/tools-core.mjs';

// 写实形状：照 femoExamples 的真实写法（soul: 后可不带空格；human 行不匹配；
// source:main 是导演亲自出演）。
const SCRIPT = `meta:
  name: 连通测试
actors:
  ai @AI1 = soul:ai4
  ai @AI2 = soul: ai5
  ai @导演 = source:main
  human @人类 = soul:human
  ai @幽灵 =
vars:
  done = false
mainflow:
  - say @AI1: "hi"
`;

test('演员表解析：只收 actors 区的 ai 角色；soul 缺省 null；source:main 不算；出区即停', () => {
  assert.deepEqual(scriptActorSouls(SCRIPT), [
    { actor: 'AI1', soul: 'ai4' },
    { actor: 'AI2', soul: 'ai5' },
    { actor: '幽灵', soul: null },
  ]);
  assert.deepEqual(scriptActorSouls(undefined), []);
  assert.deepEqual(scriptActorSouls('meta:\n  name: x\n'), []);
});

test('开演校验：缺提名的列出来（原措辞），齐了过；裸 ai 角色算缺员', () => {
  assert.deepEqual(unboundActorSouls(SCRIPT, ['ai4', 'ai5']), [
    '角色@幽灵 在剧本里没有指定灵魂（soul），无法绑定窗口',
  ]);
  assert.deepEqual(unboundActorSouls(SCRIPT, []), [
    '灵魂：ai4 （他在femo剧本中的角色名为@AI1）',
    '灵魂：ai5 （他在femo剧本中的角色名为@AI2）',
    '角色@幽灵 在剧本里没有指定灵魂（soul），无法绑定窗口',
  ]);
});
