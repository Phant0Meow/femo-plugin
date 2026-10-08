/**
 * modelio-weave.test.mjs — 思考第三路源织入的纯函数测试（2026-09-29）。
 * 被测件：runtime/speech-collect.mjs 的 weaveModelIoSteps——模型轮次
 * （rollout wire 日志的 reasoningText/text/toolCalls 计数）按工具调用数对齐
 * 织进现有 steps，cot 作独立步、中途发言作独立 reply 步、整体重排序号、
 * 对不齐时现有 steps 全数保底。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { weaveModelIoSteps } from '../runtime/speech-collect.mjs';

const toolStep = (name) => ({ step: 0, tool_calls: [{ name, arguments: '{}' }], tool_results: ['ok'] });

test('思考作独立 cot 步插在其轮工具步之前，序号整体重排', () => {
  const steps = [toolStep('Bash'), toolStep('Read')];
  const rounds = [
    { cot: '先查账本', text: '', nCalls: 1 },
    { cot: '再读档案', text: '', nCalls: 1 },
  ];
  const out = weaveModelIoSteps(steps, rounds);
  assert.equal(out.length, 4);
  assert.equal(out[0].cot, '先查账本');
  assert.equal(out[1].tool_calls[0].name, 'Bash');
  assert.equal(out[2].cot, '再读档案');
  assert.equal(out[3].tool_calls[0].name, 'Read');
  assert.deepEqual(out.map(s => s.step), [0, 1, 2, 3]);
});

test('中途发言作独立 reply 步；台词正身仍是末步 reply（lastStepReply 口径）', () => {
  const steps = [toolStep('Bash')];
  const rounds = [
    { cot: '想一下', text: '我先看看现状', nCalls: 1 },
    { cot: '收尾', text: '', nCalls: 0 },
  ];
  const out = weaveModelIoSteps(steps, rounds);
  assert.equal(out[1].reply, '我先看看现状');
  assert.equal(out[out.length - 1].reply, undefined); // 末步无 reply→交卷时台词自立末步
  assert.equal(out[0].cot, '想一下');
});

test('一轮并行多个调用吃掉多个工具步', () => {
  const steps = [toolStep('Bash'), toolStep('Bash'), toolStep('Read')];
  const rounds = [{ cot: '并行三个', text: '', nCalls: 3 }];
  const out = weaveModelIoSteps(steps, rounds);
  assert.equal(out.length, 4);
  assert.equal(out[0].cot, '并行三个');
  assert.equal(out.filter(s => s.tool_calls).length, 3);
});

test('轮次与工具步对不齐：现有 steps 全数保底顺序输出，只增不删', () => {
  const steps = [toolStep('Bash'), toolStep('Read')];
  const rounds = [{ cot: '孤儿思考', text: '', nCalls: 5 }]; // 声明 5 个调用、实际只有 2 步
  const out = weaveModelIoSteps(steps, rounds);
  assert.equal(out.filter(s => s.tool_calls).length, 2); // 两个工具步一个不少
  assert.equal(out[0].cot, '孤儿思考');
});

test('空轮次/空思考：steps 原样通过', () => {
  const steps = [toolStep('Bash')];
  assert.deepEqual(weaveModelIoSteps(steps, []), [{ ...steps[0], step: 0 }]);
  const out = weaveModelIoSteps(steps, [{ cot: '', text: '', nCalls: 0 }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].tool_calls[0].name, 'Bash');
});

test('readModelIoRounds 的 model 字段拼 provider/model 传给 submitSpeech——信封 body.model_id（2026-10-02 存储层）', async () => {
  // 直测提交链的拼装口径（不走真 wire 日志/真 daemon）：readModelIoRounds 返回
  // 末轮 model={modelId, providerId}，hooks/lib 拼成 provider/model 作第 5 参
  // 传 submitSpeech，executorSpeechArgs 把它拼进 body.model_id。这里用桩核
  // 「submitSpeech 的 modelId → 信封」这一段（前半段拼装在 lib.mjs，语义见
  // 其注释；本锁钉信封形状防回归）。
  const { executorSpeechArgs } = await import('../../../femo2host/host/speech-core.mjs');
  const env = executorSpeechArgs({
    jobId: 9, waitKey: 'wk-z', soul: 'wolf-seer', output: '说完', steps: [{ step: 0 }],
    modelId: 'account:bigmodel-individual-coding-plan/GLM-5.3-Flash',
  });
  assert.equal(env.body.model_id, 'account:bigmodel-individual-coding-plan/GLM-5.3-Flash');

  // 取不到 model（老 wire 日志顶层无 model 键）→ lib 传空串 → submitSpeech 不带 modelId → 信封无该栏
  const envBare = executorSpeechArgs({ jobId: 9, waitKey: 'wk-z', soul: 's', output: 'x', steps: [{ step: 0 }] });
  assert.equal(envBare.body.model_id, undefined);
});
