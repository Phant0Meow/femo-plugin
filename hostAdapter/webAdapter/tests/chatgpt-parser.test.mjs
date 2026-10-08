/**
 * chatgpt-parser.test.mjs — chatgpt 包网络闸的回归锁（2026-10-01）。
 *
 * 锁两件事（都是真页实案换来的）：
 * ① 闸匹配=路径全等：上游在补全接口同前缀下新添兄弟端点
 *    /backend-api/f/conversation/prepare（sentinel 预备包，POST 非 SSE），
 *    子串包含曾把它当补全本体拦下——其 JSON 响应走「非 SSE=即时结束」支路
 *    发出静默 done，座席在真补全流开演前误判「生成已结束」→ 回复蒸发
 *    （job 2670 / 09-29 首次真派工两度实录）。
 * ② 解析器正文组装：JSON 补丁语义 + 粘性指针（裸值帧沿用上一条 parts/0
 *    指针、带指针帧刷新、指针挪去别处清粘性）+ 三层结束信号。
 *
 * 被测函数直接从 inject.js 源码按括号配对抽取（经典脚本没有模块导出；
 * 抽真函数而不是抄副本，抄的会漂移）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADAPTER_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = readFileSync(join(ADAPTER_ROOT, 'sites', 'chatgpt.com', 'inject.js'), 'utf8');

/** 从源码里按名字抽函数定义（括号配对找收尾），返回函数源文本。 */
function extractFn(name) {
  const start = SRC.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `inject.js 里找不到 function ${name}`);
  let i = SRC.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') depth += 1;
    else if (SRC[j] === '}') { depth -= 1; if (depth === 0) { i = j; break; } }
  }
  return SRC.slice(start, i + 1);
}

globalThis.location = { origin: 'https://chatgpt.com' };
const emitted = [];
const emit = d => emitted.push(d);
const factory = new Function('emit', `${extractFn('gatePath')}\n${extractFn('makeParser')}\nreturn { gatePath, makeParser };`);
const { gatePath, makeParser } = factory(emit);

const COMPLETION = '/backend-api/f/conversation';

test('闸匹配=路径全等：同前缀兄弟端点（prepare）不拦，query 不参与', () => {
  assert.equal(gatePath('https://chatgpt.com/backend-api/f/conversation/prepare'), '/backend-api/f/conversation/prepare');
  assert.notEqual(gatePath('https://chatgpt.com/backend-api/f/conversation/prepare'), COMPLETION, 'prepare 是兄弟端点，不是补全本体——拦了就吞回复');
  assert.equal(gatePath(`https://chatgpt.com${COMPLETION}?mode=chat&x=1`), COMPLETION, 'query 剥掉后全等');
  assert.equal(gatePath(COMPLETION), COMPLETION, '相对路径就地全等');
  assert.equal(gatePath('https://chatgpt.com/backend-api/sentinel/chat-requirements/prepare'), '/backend-api/sentinel/chat-requirements/prepare');
});

test('解析器：粘性指针攒正文、三层结束信号、会话名搭车、CoT 恒空', () => {
  const p = makeParser();
  const lines = [
    'event: delta_encoding',
    'data: {"p":"","o":"add","v":{"message":{"id":"m1","author":{"role":"user"},"content":{"content_type":"text","parts":["夜里狼人睁眼了吗"]}}}}',
    '',
    'data: {"p":"","o":"add","v":{"message":{"id":"m2","author":{"role":"assistant"},"content":{"content_type":"text","parts":[""]},"status":"in_progress"}}}',
    'data: {"p":"/message/content/parts/0","o":"append","v":"（夜晚，狼队视角。队友是@6号，避开队友。）"}',
    'data: {"v":" SET VARIABLE:<<@KILL = @1号>>"}',           // 裸值帧：沿用上一条 parts/0 指针
    'data: {"p":"/message/metadata/finish_reason","o":"replace","v":"stop"}',  // 指针挪去别处=清粘性
    'data: {"v":"这段不该进话"}',                              // 粘性已清，裸帧不进
    'data: {"p":"/message/content/parts/0","o":"append","v":"（重新指向正文，继续进话）"}',
    'data: {"type":"title_generation","title":"第一夜","conversation_id":"6abb5ee6-99c8-83ea-a108-9566eb1e62fc"}',
    'data: {"p":"","o":"patch","v":[{"p":"/message/status","o":"replace","v":"finished_successfully"}]}',
    'data: {"type":"message_stream_complete"}',
    'data: [DONE]',
  ];
  for (const l of lines) p.feedLine(l);
  assert.equal(p.content, '（夜晚，狼队视角。队友是@6号，避开队友。） SET VARIABLE:<<@KILL = @1号>>（重新指向正文，继续进话）');
  assert.equal(p.thinking, '', 'CoT 隐藏站思考恒空');
  assert.equal(p.finished, true, '三层结束信号任一见即收');
  assert.equal(p.sawData, true);
  const title = emitted.find(e => e.phase === 'titles');
  assert.ok(title && title.titles['6abb5ee6-99c8-83ea-a108-9566eb1e62fc'] === '第一夜', 'title_generation 搭车要发 titles 帧');
});

test('解析器：行被拆在两片里——残片不成帧不炸，补全后照常成帧', () => {
  const p = makeParser();
  p.feedLine('data: {"p":"","o":"add","v":{"message":{"id":"m2","author":{"role":"assistant"},"content":{"content_type":"text","parts":[""]}}}}');
  assert.doesNotThrow(() => p.feedLine('data: {"p":"/message/content/parts/0","o":"append","v":"第一半'), 'JSON 未闭合的残行忽略不炸');
  assert.doesNotThrow(() => p.feedLine('")')); // 不是 data: 行，忽略
  assert.equal(p.content, '', '残片不成帧不产生半截字');
  assert.doesNotThrow(() => p.feedLine('data: [DONE]'));
  assert.equal(p.finished, true);
});

test('解析器：user 消息落位后指针归零，旁支消息的字不进话', () => {
  const p = makeParser();
  for (const l of [
    'data: {"p":"","o":"add","v":{"message":{"id":"m1","author":{"role":"assistant"},"content":{"content_type":"text","parts":[""]}}}}',
    'data: {"p":"/message/content/parts/0","o":"append","v":"上一轮"}',
    'data: {"p":"","o":"add","v":{"message":{"id":"m3","author":{"role":"tool"},"content":{"content_type":"text","parts":[""]}}}}',
    'data: {"p":"/message/content/parts/0","o":"append","v":"工具的话不进话"}',
    'data: {"v":"粘性也进不来"}',
  ]) p.feedLine(l);
  assert.equal(p.content, '上一轮');
  assert.equal(p.finished, false, '没见结束信号就是没结束');
});

test('新协议（2026-10-08 j2724 流头取证实帧）：落位帧自带首段+批补丁带正文+裸帧续发不丢', () => {
  const p = makeParser();
  const lines = [
    // ① assistant 落位帧=裸 {v:{message}}，parts[0] 自带首段正文（旧协议恒空串）
    'data: {"v":{"message":{"id":"b1","author":{"role":"assistant","name":null,"metadata":{}},"create_time":1791451458.5,"update_time":null,"content":{"content_type":"text","parts":["@GPT：哈哈哈，这个"]},"status":"in_progress","end_turn":null,"weight":1.0,"metadata":{},"recipient":"all","channel":null},"conversation_id":"c1"}}',
    // ② 正文追加住在批量补丁里（旧协议是顶层 append 帧）
    'data: {"p":"","o":"patch","v":[{"p":"/message/content/parts/0","o":"append","v":"学徒属于是赶上风口了！😂"}]}',
    // ③ 批补丁带过正文后，长回复以裸值帧续发——旧代码在这里全丢（j2724 实锤的 4 条 ∅o 裸帧）
    'data: {"v":"欧洲昏睡诅咒爆发，大家疯狂找护身符，"}',
    'data: {"v":"结果一个黑魔法学校学徒突然发现：我学的东西好像能换钱了！"}',
  ];
  for (const l of lines) p.feedLine(l);
  assert.equal(p.content, '@GPT：哈哈哈，这个学徒属于是赶上风口了！😂欧洲昏睡诅咒爆发，大家疯狂找护身符，结果一个黑魔法学校学徒突然发现：我学的东西好像能换钱了！',
    '落位首段（种子）+批补丁追加+裸帧续发三段都要在');
});

test('新协议边界：元数据批补丁（不带正文）之后裸帧照旧不进话；正文批补丁后落位新消息重开一轮', () => {
  // 元数据批补丁不带正文→清粘，裸帧丢弃（旧语义不回归）
  const p1 = makeParser();
  p1.feedLine('data: {"p":"","o":"patch","v":[{"p":"/message/metadata/conversation_followup_suggestions_eligible","o":"replace","v":true}]}');
  p1.feedLine('data: {"v":"这段不该进话"}');
  assert.equal(p1.content, '', 'status/元数据批补丁不清出正文通道');

  // 落位新 assistant 消息（自带新首段）→按新首段重开一轮，旧轮不残留
  const p2 = makeParser();
  p2.feedLine('data: {"v":{"message":{"id":"a","author":{"role":"assistant"},"content":{"content_type":"text","parts":["第一轮"]}}}}');
  p2.feedLine('data: {"v":"续"}');
  p2.feedLine('data: {"v":{"message":{"id":"b","author":{"role":"assistant"},"content":{"content_type":"text","parts":["第二轮"]}}}}');
  assert.equal(p2.content, '第二轮', '新落位=重开一轮，正文从新首段重新计');

  // 旧协议形状（落位 parts[0]=空串）行为不变：从零积累
  const p3 = makeParser();
  p3.feedLine('data: {"p":"","o":"add","v":{"message":{"id":"c","author":{"role":"assistant"},"content":{"content_type":"text","parts":[""]}}}}');
  p3.feedLine('data: {"p":"/message/content/parts/0","o":"append","v":"旧协议"}');
  assert.equal(p3.content, '旧协议');
});

test('新协议二刀（j2726 20:00 实帧）：裸数组信封 {"v":[…]} 扛正文主体，顶层无 o 也认', () => {
  const p = makeParser();
  const lines = [
    // system 落位（裸形）——旁支不进话
    'data: {"v":{"message":{"id":"s1","author":{"role":"system","name":null,"metadata":{}},"content":{"content_type":"text","parts":[""]},"status":"finished_successfully"}}}',
    // assistant 落位（裸形）自带首段 14 字
    'data: {"v":{"message":{"id":"m1","author":{"role":"assistant","name":null,"metadata":{}},"content":{"content_type":"text","parts":["哈哈哈哈，Eli 这边根本是"]},"status":"in_progress"}}}',
    // 旧信封批补丁带 15 字
    'data: {"o":"patch","v":[{"p":"/message/content/parts/0","o":"append","v":"双线程运行：表面上被同学找麻烦，"}]}',
    // 裸数组信封（顶层无 o）：长回复主体住在这里（j2726 实锤连续 4 条）
    'data: {"v":[{"p":"/message/content/parts/0","o":"append","v":"心里却在推演怎么救整个欧洲，顺便研究怎么解决一个已经永生的 Boss。😂\\n\\n"}]}',
    'data: {"v":[{"p":"/message/content/parts/0","o":"append","v":"他的魔法理论也跟着休眠了。"}]}',
    // 已结束信号也住裸数组里
    'data: {"v":[{"p":"/message/status","o":"replace","v":"finished_successfully"},{"p":"/message/end_turn","o":"replace","v":true}]}',
  ];
  for (const l of lines) p.feedLine(l);
  assert.equal(p.content,
    '哈哈哈哈，Eli 这边根本是双线程运行：表面上被同学找麻烦，心里却在推演怎么救整个欧洲，顺便研究怎么解决一个已经永生的 Boss。😂\n\n他的魔法理论也跟着休眠了。',
    '裸数组信封扛的正文主体不能丢');
  assert.equal(p.finished, true, '裸数组里的 status replace 也算结束信号');
});
