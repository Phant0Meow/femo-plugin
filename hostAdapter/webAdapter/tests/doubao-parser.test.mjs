/**
 * doubao-parser.test.mjs — 豆包网络闸解析器的回归锁（2026-10-03）。
 *
 * 锁三件事（job 2689 实案换来的：引擎收到的台词被啃掉头 5 字「SET V」，
 * 引擎因此报「没有检测到对 @KILL 的成功赋值」）：
 * ① 分帧 CRLF 兼容：SSE 帧若用 \r\n\r\n 分隔（ACK 与第一条正文增量之间），
 *    只扫 \n\n 的旧解析器会把两帧并成一帧、JSON 解析失败被静默吞掉——头就这么
 *    丢的；顺带锁跨 chunk 拆开的 \r\n（\r 在上一块尾、\n 在下一块头）也要归一。
 * ② 收尾对账：攒到的正文恰是结束帧全文（msg_finish_attr.brief）的尾巴且更短
 *    = 攒的时候丢了头，必须改用全文——解析器手里其实一直有正确答案。
 * ③ 静默处留痕：解析丢弃 / 未知事件随 completed 的 diagKeys 上报（取证在案的
 *    FULL_MSG_NOTIFY / STREAM_CHUNK 不算未知）；正常流零诊断。
 *
 * 被测函数直接从 inject.js 源码按括号配对抽取（经典脚本没有模块导出；
 * 抽真函数而不是抄副本，抄的会漂移）——姿势照 chatgpt-parser.test.mjs。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADAPTER_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = readFileSync(join(ADAPTER_ROOT, 'sites', 'www.doubao.com', 'inject.js'), 'utf8');

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

const gateLogs = [];
const { makeParser } = new Function('emit', `${extractFn('makeParser')}\nreturn { makeParser };`)(
  d => { if (d?.phase === 'gate-log') gateLogs.push(String(d.line ?? '')); },
);

/** 流头取证行（gate-log 通道）——按需清空。 */
function takeGateLogs() {
  const lines = gateLogs.splice(0);
  return lines.filter(l => l.includes('流头取证'));
}

const FULL = 'SET VARIABLE:<<@KILL = @3号>>';

test('分帧 CRLF 兼容：ACK 与首条正文增量用 \\r\\n\\r\\n 分隔不再并帧啃头', () => {
  const p = makeParser();
  p.feed('id: 1\r\nevent: SSE_ACK\r\ndata: {"ack_client_meta":{"conversation_info":{"conversation_id":"c1","name":"狼人杀"}}}\r\n\r\n'
       + 'id: 2\nevent: CHUNK_DELTA\ndata: {"text":"SET V"}\n\n');
  p.feed('id: 3\nevent: CHUNK_DELTA\ndata: {"text":"ARIABLE:<<@KILL = @3号>>"}\n\n'
       + `id: 4\nevent: SSE_REPLY_END\ndata: {"end_type":1,"msg_finish_attr":{"brief":"${FULL}"}}\n\n`);
  p.flush();
  assert.equal(p.content, FULL, 'CRLF 归一后头 5 个字必须回来');
  assert.equal(p.finished, true);
  assert.deepEqual(p.diag(), {}, '一切照常解析，不应有诊断');
});

test('跨 chunk 拆开的 \\r\\n 也要归一（\\r 在上一块尾、\\n 在下一块头）', () => {
  const p = makeParser();
  p.feed('id: 1\nevent: SSE_ACK\r'); // ← \r\n\r\n 的第一个 \r 落在块尾
  p.feed('\ndata: {"ack_client_meta":{}}\r\n\r\n');
  p.feed(`id: 2\nevent: CHUNK_DELTA\ndata: {"text":"${FULL}"}\n\n`);
  p.flush();
  assert.equal(p.content, FULL);
});

test('收尾对账：正文攒丢了头（首条增量走了未知事件）→ 改用结束帧全文并留痕', () => {
  const p = makeParser();
  p.feed('id: 1\nevent: CHUNK\ndata: {"text":"SET V"}\n\n' // ← 未知事件，若它带正文就是被丢了
       + 'id: 2\nevent: CHUNK_DELTA\ndata: {"text":"ARIABLE:<<@KILL = @3号>>"}\n\n'
       + `id: 3\nevent: SSE_REPLY_END\ndata: {"end_type":1,"msg_finish_attr":{"brief":"${FULL}"}}\n\n`);
  p.flush();
  assert.equal(p.content, FULL, '引擎必须拿到全文');
  const d = p.diag();
  assert.ok(Array.isArray(d.diagKeys) && d.diagKeys.length >= 2, '未知事件与啃头对账都要留痕');
  assert.ok(d.diagKeys.some(s => s.includes('未见过的SSE事件 CHUNK')));
  assert.ok(d.diagKeys.some(s => s.includes('啃头对账')));
});

test('取证在案的不进话事件（FULL_MSG_NOTIFY/STREAM_CHUNK）不算未知', () => {
  const p = makeParser();
  p.feed('id: 1\nevent: FULL_MSG_NOTIFY\ndata: {"msg":{}}\n\n'
       + 'id: 2\nevent: STREAM_CHUNK\ndata: {"patch_object":111}\n\n'
       + 'id: 3\nevent: CHUNK_DELTA\ndata: {"text":"你好"}\n\n');
  p.flush();
  assert.equal(p.content, '你好');
  assert.deepEqual(p.diag(), {});
});

test('解析不了的帧留痕且至多 3 条；正常流零诊断', () => {
  const p = makeParser();
  let bad = '';
  for (let i = 0; i < 5; i++) bad += `id: ${i}\nevent: CHUNK_DELTA\ndata: {"text":Broken${i}}\n\n`;
  bad += 'id: 9\nevent: CHUNK_DELTA\ndata: {"text":"尾巴"}\n\n';
  p.feed(bad);
  p.flush();
  assert.equal(p.content, '尾巴');
  const drops = p.diag().diagKeys.filter(s => s.includes('解析不了'));
  assert.equal(drops.length, 3, '至多留 3 条');

  const q = makeParser();
  q.feed('id: 1\nevent: CHUNK_DELTA\ndata: {"text":"正常"}\n\n');
  q.flush();
  assert.deepEqual(q.diag(), {}, '正常流零诊断');
});

test('流头取证：流的开头原文走 gate-log 通道进服务日志（啃头定谳仪表）', () => {
  takeGateLogs(); // 清空之前用例的残留
  const p = makeParser();
  const head = 'id: 1\nevent: SSE_ACK\ndata: {"ack":1}\n\nid: 2\nevent: CHUNK_DELTA\ndata: {"text":"你好"}';
  p.feed(head);
  p.flush();
  const lines = takeGateLogs();
  assert.ok(lines.length >= 1, 'flush 时余量也要交出');
  assert.ok(lines.join('').includes('SSE_ACK') && lines.join('').includes('你好'), '取证行=流头原文');
});

const NOTIFY_FULL = 'SET VARIABLE: <<want_badge = true>> 我上警，配合@6号，准备悍跳。';

test('STREAM_MSG_NOTIFY 正文快照通道：攒到的 text 是快照的尾巴 → 采纳补回被啃的头', () => {
  const p = makeParser();
  p.feed('id: 1\nevent: CHUNK_DELTA\ndata: {"text":"ARIABLE: <<want_badge = true>> 我上警，配合@6号，准备悍跳。"}\n\n');
  assert.equal(p.content, NOTIFY_FULL.slice(5), '先复现啃头态');
  p.feed(`id: 2\nevent: STREAM_MSG_NOTIFY\ndata: {"content":"${NOTIFY_FULL}","meta":{},"attr":{}}\n\n`);
  assert.equal(p.content, NOTIFY_FULL, '头 5 个字从快照通道回来');
  assert.ok(p.diag().diagKeys.some(s => s.includes('STREAM_MSG_NOTIFY')), '采纳留一痕');
});

test('STREAM_MSG_NOTIFY：空账收头一块、快照增长照收；对不上的快照与 SSE_HEARTBEAT 都不碰不留痕', () => {
  const p = makeParser();
  p.feed('id: 1\nevent: STREAM_MSG_NOTIFY\ndata: {"content":"SET"}\n\n');
  assert.equal(p.content, 'SET', '空账直接收快照（正文头几字在开场 Notify 里）');
  p.feed('id: 2\nevent: STREAM_MSG_NOTIFY\ndata: {"content":"SET VARIABLE"}\n\n');
  assert.equal(p.content, 'SET VARIABLE', '快照增长照收');
  assert.deepEqual(p.diag(), {}, '正常采纳不刷诊断');

  const r = makeParser();
  r.feed('id: 1\nevent: CHUNK_DELTA\ndata: {"text":"你好"}\n\n');
  r.feed('id: 2\nevent: STREAM_MSG_NOTIFY\ndata: {"content":"完全无关的长文本不该被采纳"}\n\n');
  r.feed('id: 3\nevent: SSE_HEARTBEAT\ndata: {}\n\n');
  r.flush();
  assert.equal(r.content, '你好', '对不上的快照不碰');
  assert.deepEqual(r.diag(), {}, '无关快照与心跳都不留痕');
});
