/**
 * mount-state.test.mjs — 挂载态「缓存的是 path、跑前对盘」的回归锁
 * （2026-10-01 用户拍板：挂载之后改剧本，运行跑的就是改后版）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createMountState } from '../../../femo2host/host/tools-core.mjs';
import { findMountRecord, readMountLedger } from '../../../femo2host/host/mount-registry.mjs';

test('对盘：挂载后改文件，freshen 重读现稿；fresh_start 语义=盘上当下这一版', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femo-mount-'));
  const p = join(dir, 's.femo');
  writeFileSync(p, 'meta:\n  name = v1\n', 'utf8');
  const m = createMountState();
  assert.equal(m.mountFromPath(p), null);
  assert.ok(m.get().femoText.includes('v1'));
  writeFileSync(p, 'meta:\n  name = v2\n', 'utf8');
  assert.equal(m.freshen(), null, '对盘成功');
  assert.ok(m.get().femoText.includes('v2'), '挂载态已换成现稿');
  assert.equal(m.get().scriptPath, p, 'path 不变');
  rmSync(dir, { recursive: true, force: true });
});

test('对盘：文件被删/移动 → 响亮报错，不拿旧稿假装没事', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femo-mount-'));
  const p = join(dir, 's.femo');
  writeFileSync(p, 'meta:\n  name = x\n', 'utf8');
  const m = createMountState();
  m.mountFromPath(p);
  rmSync(p);
  const out = m.freshen();
  assert.ok(out?.error?.includes('脚本文件读不到了'), JSON.stringify(out));
  rmSync(dir, { recursive: true, force: true });
});

test('文本挂载没有 path，freshen 原样放行（保持原稿）', () => {
  const m = createMountState();
  m.mountFromText('meta:\n  name = t\n');
  assert.equal(m.freshen(), null);
  assert.ok(m.get().femoText.includes('name = t'));
  assert.equal(m.freshen(), null, '未挂载时同样放行（无 mounted）');
});

// ── 挂载共同账本（2026-10-04 用户拍板「各家挂剧本都往一个文件写」）──────────

test('账本：挂载即记账（host+session+显示名+地址），新实例（模拟重启）从账本原样恢复', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femo-mount-'));
  const p = join(dir, '可退场版.femo');
  writeFileSync(p, 'meta:\n  name = v1.4\n', 'utf8');
  const ledgerPath = join(dir, 'data', 'mounts.json');
  const opts = { host: 'web', session: 'User', sessionName: '测试主会话', registryPath: ledgerPath };
  const m = createMountState(opts);
  assert.equal(m.mountFromPath(p), null);
  const rec = findMountRecord('web', 'User', ledgerPath);
  assert.equal(rec.script_path, p, '账本记了地址');
  assert.equal(rec.femo_text, undefined, '有地址就没有文字');
  assert.equal(rec.session_name, '测试主会话', '记了会话显示名（下拉菜单给人看的就是它）');
  assert.ok(rec.time, '记了时间');
  const m2 = createMountState(opts);
  assert.ok(m2.get(), '重启后从账本恢复');
  assert.equal(m2.get().scriptPath, p);
  assert.ok(m2.get().femoText.includes('v1.4'));
  assert.equal(m2.get().scriptName, '可退场版.femo');
  assert.equal(m2.freshen(), null, '恢复态照常对盘');
  rmSync(dir, { recursive: true, force: true });
});

test('账本：文本挂载记文字（无地址）；一次性——重启不复活，记录留账', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femo-mount-'));
  const ledgerPath = join(dir, 'mounts.json');
  const opts = { host: 'zcode', session: 'sess1', registryPath: ledgerPath };
  const m = createMountState(opts);
  m.mountFromText('meta:\n  name = t\n');
  const rec = findMountRecord('zcode', 'sess1', ledgerPath);
  assert.ok(rec.femo_text.includes('name = t'), '账本记了文字');
  assert.equal(rec.script_path, undefined, '有文字就没有地址');
  assert.equal(rec.session_name, undefined, '没给显示名就不写这字段');
  assert.equal(createMountState(opts).get(), undefined, '文本挂载不复活');
  assert.ok(findMountRecord('zcode', 'sess1', ledgerPath), '记录仍留账');
  rmSync(dir, { recursive: true, force: true });
});

test('账本：clear 撤本键记录，别家（别键）记录不受伤', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femo-mount-'));
  const p = join(dir, 's.femo');
  writeFileSync(p, 'meta:\n  name = x\n', 'utf8');
  const ledgerPath = join(dir, 'mounts.json');
  const a = createMountState({ host: 'web', session: 'User', registryPath: ledgerPath });
  const b = createMountState({ host: 'autoclaw', session: null, registryPath: ledgerPath });
  a.mountFromPath(p);
  b.mountFromText('meta:\n  name = y\n');
  a.clear();
  assert.equal(findMountRecord('web', 'User', ledgerPath), undefined, '本键撤账');
  assert.ok(findMountRecord('autoclaw', null, ledgerPath)?.femo_text.includes('name = y'), '别家记录不动');
  rmSync(dir, { recursive: true, force: true });
});

test('账本：恢复时指向的文件已不在盘上 → 撤账回未挂载', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femo-mount-'));
  const p = join(dir, 's.femo');
  writeFileSync(p, 'meta:\n  name = x\n', 'utf8');
  const ledgerPath = join(dir, 'mounts.json');
  const opts = { host: 'web', session: 'User', registryPath: ledgerPath };
  createMountState(opts).mountFromPath(p);
  rmSync(p);
  assert.equal(createMountState(opts).get(), undefined, '文件没了=没得恢复');
  assert.equal(findMountRecord('web', 'User', ledgerPath), undefined, '死账撤掉');
  rmSync(dir, { recursive: true, force: true });
});

test('账本：撞键覆盖只留一条；损坏账本隔离另存、从空白重开', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femo-mount-'));
  const p = join(dir, 's.femo');
  writeFileSync(p, 'meta:\n  name = x\n', 'utf8');
  const p2 = join(dir, 's2.femo');
  writeFileSync(p2, 'meta:\n  name = y\n', 'utf8');
  const ledgerPath = join(dir, 'mounts.json');
  const opts = { host: 'web', session: 'User', registryPath: ledgerPath };
  const m = createMountState(opts);
  m.mountFromPath(p);
  m.mountFromPath(p2);
  const ledger = readMountLedger(ledgerPath);
  assert.equal(ledger.mounts.length, 1, '撞键覆盖不滚成流水');
  assert.equal(ledger.mounts[0].script_path, p2, '留的是最新一笔');
  writeFileSync(ledgerPath, '{oops', 'utf8');
  const fresh = readMountLedger(ledgerPath);
  assert.deepEqual(fresh.mounts, [], '损坏账当空白账开');
  const quarantined = readdirSync(dir).filter(n => n.startsWith('mounts.json.corrupt-'));
  assert.equal(quarantined.length, 1, '坏账隔离另存不销毁现场');
  rmSync(dir, { recursive: true, force: true });
});

test('账本：不传 host = 旧形态纯内存，盘上不留任何账；host 缺落位响亮报错', () => {
  const dir = mkdtempSync(join(tmpdir(), 'femo-mount-'));
  const p = join(dir, 's.femo');
  writeFileSync(p, 'meta:\n  name = x\n', 'utf8');
  const m = createMountState();
  assert.equal(m.mountFromPath(p), null);
  assert.equal(m.get().scriptPath, p);
  assert.equal(readdirSync(dir).filter(n => n.endsWith('.json')).length, 0, '目录里没有账本文件');
  assert.throws(() => createMountState({ host: 'web' }), /femoRoot 或 registryPath/, 'host 缺落位=响亮报错');
  rmSync(dir, { recursive: true, force: true });
});


