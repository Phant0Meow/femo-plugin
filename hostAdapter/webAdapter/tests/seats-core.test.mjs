/**
 * tests/seats-core.test.mjs — shared 席位判断层的单测（运行前点名判据）。
 * 判据（2026-09-30 用户定案；2026-10-01 按需唤醒翻新）：**页开着（哪怕休眠）
 * =到场，不拦不叫醒**——轮到它发言时派工侧会自动 reload 唤醒；只有标签页真
 * 没开的才拦。回归锁：旧剧本的历史提名不许拦新戏（needed 之外的离线席位一律
 * 视而不见）。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seatState, offlineRollCall, attendanceRefusal } from '../shared/seats-core.mjs';

test('seatState 四态：忙 > 在线 > 休眠 > 网页未打开', () => {
  assert.deepEqual(seatState({ busy: true, online: true, present: true }), { key: 'run', label: '运行中' });
  assert.deepEqual(seatState({ busy: false, online: true, present: true }), { key: 'on', label: '在线' });
  assert.deepEqual(seatState({ busy: false, online: false, present: true }), { key: 'dormant', label: '休眠中' });
  assert.deepEqual(seatState({ busy: false, online: false, present: false }), { key: 'off', label: '网页未打开' });
  assert.deepEqual(seatState(undefined), { key: 'off', label: '网页未打开' }, '缺省席位照旧有态可上');
});

test('点名：全在线直接放行（web 席在线 + 他宿主心跳在）', () => {
  const seats = [
    { sessionId: 'chat.deepseek.com:f7a1', soul: 'ai4', online: true, siteLabel: 'DeepSeek', sidShort: 'f7a1', title: '' },
  ];
  const needed = [
    { actor: 'AI1', soul: 'ai4', bound: 'web', online: true },
    { actor: '小机', soul: 'ai7', bound: 'other', host: 'zcode', online: true },
  ];
  assert.deepEqual(offlineRollCall(seats, needed), []);
});

test('点名：休眠页（开着但冻结）=到场放行，不出行不拦', () => {
  const out = offlineRollCall([], [{ actor: 'AI2', soul: 'ai5', bound: 'web', online: false, present: true }]);
  assert.deepEqual(out, [], '轮到它发言会自动唤醒，点名不为难休眠页');
  // 席位视图里的休眠主Agent席同理放行
  const seats = [{ sessionId: 'chat.deepseek.com:abc', soul: '', online: false, present: true, isMain: true, siteLabel: 'DeepSeek', sidShort: 'abc', title: '' }];
  assert.deepEqual(offlineRollCall(seats, []), []);
});

test('点名：web 绑定页没开 → 出一行（已请台说真话，不谎报）', () => {
  const out = offlineRollCall([], [{ actor: 'AI2', soul: 'ai5', bound: 'web', online: false, present: false, askedOpen: true }]);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('ai5'));
  assert.ok(out[0].includes('已自动打开对应页面'));
  assert.ok(out[0].includes('亲手开一下'), '没开出来的指导要在行里');
  // 旧形状（没带 present 字段的服务端/needed）：不在线照旧出行（向后兼容）
  const legacy = offlineRollCall([], [{ actor: 'AI2', soul: 'ai5', bound: 'web', online: false, askedOpen: true }]);
  assert.equal(legacy.length, 1);
  assert.ok(legacy[0].includes('已自动打开对应页面'));
});

test('点名：web 绑定页没开且扩展没连 → 明说扩展没连，不谎报已开页', () => {
  const needed = [{ actor: 'AI2', soul: 'ai5', bound: 'web', online: false, present: false, askedOpen: false }];
  const out = offlineRollCall([], needed);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('扩展没连'));
  assert.ok(!out[0].includes('已自动打开'));
});

test('点名：绑在别家宿主且那家没心跳 → 一行说明绑在谁家 + 两条路', () => {
  const needed = [{ actor: '小机', soul: 'ai7', bound: 'other', host: 'zcode', online: false }];
  const out = offlineRollCall([], needed);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('zcode'));
  assert.ok(out[0].includes('改绑'));
});

test('点名：账里从来没有的灵魂 → 一行教绑定；账整个是空的附旁注', () => {
  const out = offlineRollCall([], [{ actor: 'AI3', soul: 'ai9', bound: '' }]);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('缺少灵魂 ai9'));
  assert.ok(out[0].includes('绑定上去'));
  const out2 = offlineRollCall([], [{ actor: 'AI3', soul: 'ai9', bound: '', ledgerEmpty: true }]);
  assert.ok(out2[0].includes('投影中心没连上'), '通道故障不栽赃成没绑定');
  assert.ok(!out[0].includes('投影中心没连上'), '账非空时不加旁注');
});

test('点名（上轮 bug 回归锁）：旧剧本提名的离线席位不在本场 needed，视而不见', () => {
  const seats = [
    { sessionId: 'chatglm.cn:6ab8', soul: 'ai2', online: false, siteLabel: '智谱清言', sidShort: '6ab8', title: '' },
    { sessionId: 'www.doubao.com:1000', soul: 'ai3', online: false, siteLabel: '豆包', sidShort: '1000', title: '' },
    { sessionId: 'chat.deepseek.com:f7a1', soul: 'ai4', online: true, siteLabel: 'DeepSeek', sidShort: 'f7a1', title: '' },
    { sessionId: 'www.kimi.com:1a0e', soul: 'ai5', online: true, siteLabel: 'Kimi', sidShort: '1a0e', title: '' },
  ];
  const needed = [
    { actor: 'AI1', soul: 'ai4', bound: 'web', online: true },
    { actor: 'AI2', soul: 'ai5', bound: 'web', online: true },
  ];
  assert.deepEqual(offlineRollCall(seats, needed), []);
});

test('点名：旧格式裸 id 绑定（不知道哪家网站）→ 明说自动开页开不了，教重绑升级', () => {
  const needed = [{ actor: '小机', soul: 'debugcoder1', bound: 'web', online: false, present: false, askedOpen: false, siteKnown: false }];
  const out = offlineRollCall([], needed);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('debugcoder1'));
  assert.ok(out[0].includes('旧格式绑定'));
  assert.ok(out[0].includes('改绑'));
  assert.ok(!out[0].includes('已自动打开'), '开不了页不许谎报已开');
});

test('点名：主Agent席页没开出一行指导；休眠主席与在线/未绑定的过路席不点', () => {
  const seats = [
    { sessionId: 'chat.deepseek.com:abc', soul: '', online: false, present: false, isMain: true, siteLabel: 'DeepSeek', sidShort: 'abc', title: '' },
    { sessionId: 'chatglm.cn:def', soul: '', online: false, siteLabel: '智谱清言', sidShort: 'def', title: '过路' },
  ];
  const out = offlineRollCall(seats, []);
  assert.equal(out.length, 1);
  assert.ok(out[0].includes('主Agent席'));
  assert.ok(out[0].includes('点开那张标签页'));
});

test('点名：needed 空/缺省/空账不炸=放行', () => {
  assert.deepEqual(offlineRollCall(undefined, undefined), []);
  assert.deepEqual(offlineRollCall([], []), []);
  assert.deepEqual(offlineRollCall([{ online: true }], [{ actor: 'n', soul: 'ai4', bound: 'web', online: true }]), []);
});

test('总文案：总起一行 + 序号行间空行，每个缺席灵魂一条（指导自成一条）', () => {
  const absent = [
    '灵魂 ai7（@小机）绑在 zcode 宿主的会话上，那个宿主现在没打开——把 zcode 打开，他就会来取信开演；如果不想用 zcode，就在网页端，打开任意历史会话，在 web 座席面板操作，把 ai7 改绑到这里的会话上',
    '缺少灵魂 ai9（@AI3）：这个灵魂从未绑定任何会话——在浏览器开一张会话网页（哪家站点的都行），到座席面板那张席位卡上把他绑定上去',
  ];
  const text = attendanceRefusal(absent, '运行');
  assert.ok(text.startsWith('点名发现缺员'));
  assert.ok(text.includes('再运行：'));
  assert.ok(text.includes('\n\n1. '), '序号 1 空行起');
  assert.ok(text.includes('\n\n2. '), '条目间空行+序号');
  const items = text.split('\n\n').slice(1);
  assert.equal(items.length, 2, '每个缺席灵魂独占一条');
  assert.ok(items[0].startsWith('1. '), '首条带序号 1');
  assert.ok(items[1].startsWith('2. '), '次条带序号 2');
});
