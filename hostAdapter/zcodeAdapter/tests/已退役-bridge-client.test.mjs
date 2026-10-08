/**
 * bridge-client.test.mjs — 桥电话机协议机单测（假子进程，无真桥无真引擎）
 * 运行：node --test zcodeAdapter/tests/bridge-client.test.mjs
 * 钉住 femo2host/host/bridge-client.mjs 的契约——dsh 解禁后接同一份，这里防回归。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { BridgeClient, sendActorFailure } from '../../../femo2host/host/已退役-bridge-client.mjs';

/** 假子进程：stdout/stderr 可手动喂行，记录 stdin 写入，kill 可触发 exit。 */
function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdinWrites = [];
  child.stdin = { write: (payload, cb) => { child.stdinWrites.push(payload); if (cb) cb(null); } };
  child.pid = 4242;
  child.exitCode = null;
  child.killed = false;
  child.kill = () => { child.exitCode = 0; child.emit('exit', 0, null); child.killed = true; };
  child.feed = line => child.stdout.emit('data', Buffer.from(`${line}\n`, 'utf8'));
  return child;
}

function rig() {
  const child = fakeChild();
  const spawnSpecs = [];
  const client = new BridgeClient({
    spawnProc: spec => { spawnSpecs.push(spec); return child; },
    argv: ['femo_bridge.py', '--fe4m', '/root'],
    cwd: '/root',
    env: { PYTHONUTF8: '1' },
    onEvent: (t, d) => child.events.push([t, d]),
    onEngineLine: l => child.engineLines.push(l),
    onEngineStderr: l => child.engineStderr.push(l),
  });
  child.events = [];
  child.engineLines = [];
  child.engineStderr = [];
  return { client, child, spawnSpecs };
}

const resp = (id, body) => JSON.stringify({ type: 'response', id, ...body });

test('start：spawn 适配器收到 argv/cwd/env，事件经 onEvent 上抛', () => {
  const { client, child, spawnSpecs } = rig();
  client.start();
  assert.equal(spawnSpecs.length, 1);
  assert.deepEqual(spawnSpecs[0].argv, ['femo_bridge.py', '--fe4m', '/root']);
  assert.equal(spawnSpecs[0].cwd, '/root');
  assert.equal(client.alive, true);

  child.feed(JSON.stringify({ type: 'event', event: 'flow_done', data: { job_id: 1 } }));
  assert.deepEqual(child.events, [['flow_done', { job_id: 1 }]]);
});

test('send/配对：请求带自增 id，应答 resolve result；detail 优先于 error code', async () => {
  const { client, child } = rig();
  client.start();
  const p1 = client.send('ping', {}, 1000);
  const p2 = client.send('list_jobs', {}, 1000);
  assert.equal(child.stdinWrites.length, 2);
  const req1 = JSON.parse(child.stdinWrites[0]);
  const req2 = JSON.parse(child.stdinWrites[1]);
  assert.equal(req1.id, 1);
  assert.equal(req1.cmd, 'ping');
  assert.equal(req2.id, 2);

  child.feed(resp(2, { ok: true, result: { jobs: [] } }));   // 乱序应答也能配对
  assert.deepEqual(await p2, { jobs: [] });
  child.feed(resp(1, { ok: false, error: 'six_gate', detail: '第②关：剧本指纹不符' }));
  await assert.rejects(p1, /第②关：剧本指纹不符/);           // detail 优先（B2）
});

test('超时：无应答按 timeoutMs 拒绝', async () => {
  const { client } = rig();
  client.start();
  await assert.rejects(client.send('ping', {}, 30), /timed out/);
});

test('非协议行/撕裂行：引擎 print 转发 onEngineLine，坏 JSON 不炸不丢后续', () => {
  const { client, child } = rig();
  client.start();
  child.feed('[bridge] 宿主清单已应用');                     // 引擎 print
  child.feed('{"type": "event", torn');                      // 撕裂行
  child.feed(JSON.stringify({ type: 'event', event: 'node_start', data: {} }));
  assert.deepEqual(child.engineLines, ['[bridge] 宿主清单已应用']);
  assert.deepEqual(child.events, [['node_start', {}]]);
  child.stderr.emit('data', Buffer.from('Traceback: boom\n', 'utf8'));
  assert.deepEqual(child.engineStderr, ['Traceback: boom']);
});

test('stop：先发 shutdown 再 kill，退出后 alive=false 且 pending 清空', async () => {
  const { client, child } = rig();
  client.start();
  const never = client.send('slow', {}, 60_000);
  const stopping = client.stop();
  await assert.rejects(never, /bridge exited/);              // 挂起请求被退出拒绝
  await stopping;
  assert.equal(client.alive, false);
  assert.equal(child.killed, true);
  assert.equal(JSON.parse(child.stdinWrites.at(-1)).cmd, 'shutdown'); // 优雅关闭先行（最后一条写入）
});

test('桥死亡：挂起请求全部拒绝，onExited 通知总装层', async () => {
  const { client, child } = rig();
  let exited = false;
  client.onExited = () => { exited = true; };
  client.start();
  const p = client.send('ping', {}, 5000);
  child.exitCode = null;
  child.emit('exit', 1, null);                               // 桥暴毙
  await assert.rejects(p, /bridge exited \(code=1\)/);
  assert.equal(client.alive, false);
  assert.equal(exited, true);
});

test('sendActorFailure：B5 失败上报合约（actor_failed，detail 截 500）', async () => {
  const { client, child } = rig();
  client.start();
  const p = sendActorFailure(client, 3, 'wk-9', 'timeout', 'x'.repeat(600));
  const req = JSON.parse(child.stdinWrites[0]);
  req.args.detail.length === 500;                            // 截断
  child.feed(resp(req.id, { ok: true, result: {} }));
  await p;
  assert.equal(req.cmd, 'actor_failed');
  assert.equal(req.args.job_id, 3);
  assert.equal(req.args.wait_key, 'wk-9');
  assert.equal(req.args.detail.length, 500);
});
