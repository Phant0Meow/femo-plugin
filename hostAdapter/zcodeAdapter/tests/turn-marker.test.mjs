/**
 * turn-marker.test.mjs — 挂牌 (job, ref) 建档与已答节拍短账的单测（2026-09-28 刀6）。
 * 锁两条线上语义（施工清单 §六双开缺口的宿主侧修法）：
 *   ①一拍一牌：同灵魂并发两场互不覆盖，读取按收件会话号优先选牌；
 *   ②已答短账：交卷成功的 (job, ref, 信id) 记账可查；同号异信/无信id 不误伤
 *     （判据细化 2026-10-06，j2716 撞号实案——防重只认「同一封信」）。
 * 【2026-09-29 交卷换道批】另锁两条：
 *   ③收集窗口锚定：挂牌即清该魂过程料文件（收集窗口=死讯开始的那一轮，不跨轮累积）；
 *   ④交卷失败必留痕：daemon 不在线时 submitSpeech 返回 null 且 submit-errors.jsonl 有账。
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sandbox = mkdtempSync(join(tmpdir(), 'femo-turn-marker-'));
process.env.FEMO_DATA_DIR = sandbox; // 沙盒隔离：实落 <sandbox>/femo/host-history/zcode/
const ROOT = join(sandbox, 'repo');  // femoRoot 假根（FEMO_DATA_DIR 在时不走它）
const sc = await import('../runtime/speech-collect.mjs');

after(() => {
  delete process.env.FEMO_DATA_DIR;
  rmSync(sandbox, { recursive: true, force: true });
});

const M = { job_id: 17, soul: 'witch', node: '[open]', ref: 'j17:ai_[open]_1', target_host: 'zcode', delivered_at: '2026-09-28T10:00:00Z', delivered_by: 'hook' };

describe('turn-marker (job, ref) 建档 + 已答短账', () => {
  test('一拍一牌：同魂两场互不覆盖，按收件会话号选牌、不跨窗互抢', () => {
    sc.writeMarker(ROOT, 'witch', { ...M, session: 'sidA' });
    sc.writeMarker(ROOT, 'witch', { ...M, job_id: 18, ref: 'j18:ai_[open]_1', session: 'sidB', delivered_at: '2026-09-28T10:01:00Z' });
    assert.equal(sc.readMarker(ROOT, 'witch', 'sidA')?.job_id, 17);
    assert.equal(sc.readMarker(ROOT, 'witch', 'sidB')?.job_id, 18);
    assert.ok(sc.markedSouls(ROOT).includes('witch'));
    sc.clearMarker(ROOT, 'witch', 'sidA');
    assert.equal(sc.readMarker(ROOT, 'witch', 'sidA'), null);      // A 的牌撤了
    assert.equal(sc.readMarker(ROOT, 'witch', 'sidB')?.job_id, 18); // B 的还在
    // A 无牌时不许捡 B 的牌（旧一魂一份牌被并发另一窗收卷=缺口①的本体）
    sc.clearMarker(ROOT, 'witch', 'sidB');
    assert.equal(sc.readMarker(ROOT, 'witch', 'sidB'), null);
    assert.equal(sc.readMarker(ROOT, 'witch', 'sidC'), null);
  });

  test('无会话号兜底取最新牌（后台任务唤起的钩子周期）', () => {
    sc.writeMarker(ROOT, 'main', { ...M, soul: 'main', ref: 'j17:ai_[a]_1', session: 'sidX', delivered_at: '2026-09-28T10:00:00Z' });
    sc.writeMarker(ROOT, 'main', { ...M, soul: 'main', ref: 'j17:ai_[b]_1', session: 'sidY', delivered_at: '2026-09-28T10:05:00Z' });
    assert.equal(sc.readMarker(ROOT, 'main')?.ref, 'j17:ai_[b]_1');
  });

  test('已答短账：同信命中；异信/异 ref/异 job/无信id 不误伤', () => {
    // 判据细化（2026-10-06，j2716 实案）：键带信 id——引擎续跑后 ref 同场复用，
    // 防重只认「同一封信」，粗键 (job, ref) 会把新拍当重复拍吞掉。
    const L1 = { ...M, letter: { id: 'aaa-111' } };
    sc.recordAnsweredRef(ROOT, L1);
    assert.equal(sc.isAnsweredRef(ROOT, 17, 'j17:ai_[open]_1', 'aaa-111'), true);   // 同信重投=真重复
    assert.equal(sc.isAnsweredRef(ROOT, 17, 'j17:ai_[open]_1', 'bbb-222'), false);  // 同号异信=新拍（2716 撞号锁）
    assert.equal(sc.isAnsweredRef(ROOT, 17, 'j17:ai_[open]_1'), false);             // 无信id=不跳过（宁重交不吞拍）
    assert.equal(sc.isAnsweredRef(ROOT, 17, 'j17:ai_[close]_1', 'aaa-111'), false); // 异 ref（重演判定的姊妹拍）
    assert.equal(sc.isAnsweredRef(ROOT, 18, 'j17:ai_[open]_1', 'aaa-111'), false);  // 异 job
    assert.equal(sc.isAnsweredRef(ROOT, 17, '', 'aaa-111'), false);                 // 空 ref 不查
  });

  test('牌上无信 id 不记防重账（下次收卷照常交卷）', () => {
    sc.recordAnsweredRef(ROOT, { ...M, ref: 'j17:ai_[noid]_1' });   // 无 letter 字段
    assert.equal(sc.isAnsweredRef(ROOT, 17, 'j17:ai_[noid]_1', 'any'), false);
  });

  test('撤牌留痕：logAnsweredSkip 在诊断账留 already_answered_skip 行', () => {
    sc.logAnsweredSkip(ROOT, { ...M, letter: { id: 'aaa-111' } });
    const ledger = join(sandbox, 'femo', 'host-history', 'zcode', 'submit-errors.jsonl');
    const line = JSON.parse(readFileSync(ledger, 'utf8').trim().split('\n').pop());
    assert.equal(line.reason, 'already_answered_skip');
    assert.equal(line.ref, 'j17:ai_[open]_1');
    assert.equal(line.letter_id, 'aaa-111');
  });

  test('收集窗口锚定：挂牌即清该魂过程料（不跨轮累积）', () => {
    // 上轮残留：旧世界失败轮次攒下的工具过程料
    sc.stashTurnEvent(ROOT, 'witch', { toolName: 'Bash', toolInput: { command: 'ls' }, toolOutput: '旧轮残留' });
    const p = sc.turnSpeechPath(ROOT, 'witch');
    assert.ok(existsSync(p));
    // 新一拍挂牌（哨兵死讯）→ 上轮过程料必须清零：收集窗口=死讯开始的那一轮
    sc.writeMarker(ROOT, 'witch', { ...M, session: 'sidA', delivered_at: '2026-09-28T11:00:00Z' });
    assert.equal(existsSync(p), false);
    assert.equal(sc.collectTurnSpeech(ROOT, 'witch', undefined), null);   // 无转写无过程料=空回合
  });

  test('交卷失败必留痕：daemon 不在线 → null + 诊断账', async () => {
    sc.writeMarker(ROOT, 'witch', { ...M, session: 'sidA', delivered_at: '2026-09-28T12:00:00Z' });
    const marker = sc.readMarker(ROOT, 'witch', 'sidA');
    const receipt = await sc.submitSpeech(ROOT, marker, '台词一句', []);   // 沙盒无 hub.json → 探活 null
    assert.equal(receipt, null);
    const ledger = join(sandbox, 'femo', 'host-history', 'zcode', 'submit-errors.jsonl');
    assert.ok(existsSync(ledger), 'submit-errors.jsonl 必须有账');
    const line = JSON.parse(readFileSync(ledger, 'utf8').trim().split('\n').pop());
    assert.equal(line.reason, 'daemon_offline');
    assert.equal(line.ref, 'j17:ai_[open]_1');
  });

  test('重架判别：回合内重架且晚于死讯、会话对号 → 本回合即唤醒轮', async () => {
    const D = Date.parse('2026-09-28T12:00:00Z');
    assert.equal(sc.rearmCoversDeath(ROOT, 'owl', 'sidA', D), false);      // 无重架记录=维持跳过
    sc.writeRearmRecord(ROOT, 'owl', 'sidA');                              // 重架时刻=now，必晚于 D
    assert.equal(sc.rearmCoversDeath(ROOT, 'owl', 'sidA', D), true);       // 本回合即唤醒轮
    assert.equal(sc.rearmCoversDeath(ROOT, 'owl', 'sidB', D), false);      // 异窗不许顶
    assert.equal(sc.rearmCoversDeath(ROOT, 'owl', 'sidA', Date.now() + 60_000), false); // 重架早于死讯=旧记录
    assert.equal(sc.rearmCoversDeath(ROOT, 'owl', 'sidA', NaN), false);    // 死讯时刻不可判=不判活
  });
});
