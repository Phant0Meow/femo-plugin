/**
 * canvas-files.test.mjs — femoGen 自有文件面单测（server/canvas.mjs 2026-09-30
 * 新增的 handlers：导入账本三件套 / 当前 path 槽 / 存盘三态 / projects 围栏）。
 *
 * 直驱 handlers 不起服务：FEMO_DATA_DIR 每例指到新临时目录（引擎的库、驿站、
 * 投影账本一并进沙盒——conftest 的铁律在 Node 侧同样成立），projectsDir 也锚在
 * 临时目录里。系统对话框（pick-* 两个）要弹真窗口，不进自动测试，覆盖面留给
 * 人工验收；dsh 侧同款引擎（公共层 file-dialogs）已带全套路教注释。
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.FEMO_DATA_DIR = mkdtempSync(join(tmpdir(), 'femo-canvas-files-'));
const { createCanvasSupport } = await import('../server/canvas.mjs');
const { getCanvasPath, setCanvasPath } = await import('../../../femo2host/femoGenConnector/femogen-canvas-state.mjs');

let TMP = '';
let canvas = null;

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'femo-canvas-files-'));
  process.env.FEMO_DATA_DIR = TMP; // dataRootOf 每次调用都读 env，换沙盒即时生效
  canvas = createCanvasSupport({
    femoRoot: join(TMP, 'root'),
    projectsDir: join(TMP, 'projects'),
    spawnProc: async () => ({ done: Promise.resolve({ exitCode: 0 }), terminate: () => {} }),
    log: () => {},
  });
});

test('空 projects：浏览返回空清单（目录还没建出来也是诚实空态）', async () => {
  const r = await canvas.browseProjectsRt({});
  assert.equal(r.ok, true);
  assert.equal(r.dir, '');
  assert.deepEqual(r.dirs, []);
  assert.deepEqual(r.files, []);
});

test('新建文件夹 + 浏览可见；坏名字一律 400 拒绝', async () => {
  const r = await canvas.mkdirProjectsRt({ dir: '', name: '场景一' });
  assert.equal(r.ok, true);
  assert.equal(r.dir, '场景一');
  const b = await canvas.browseProjectsRt({});
  assert.deepEqual(b.dirs, ['场景一']);
  await assert.rejects(() => canvas.mkdirProjectsRt({ dir: '', name: '..' }), (e) => e.statusCode === 400);
  await assert.rejects(() => canvas.mkdirProjectsRt({ dir: '', name: 'a/b' }), (e) => e.statusCode === 400);
  await assert.rejects(() => canvas.mkdirProjectsRt({ dir: '', name: 'x?y' }), (e) => e.statusCode === 400);
  await assert.rejects(() => canvas.mkdirProjectsRt({ dir: '', name: '' }), (e) => e.statusCode === 400);
});

test('projects/ 围栏：.. 段与绝对路径越界一律拒绝（存盘同受围栏）', async () => {
  await assert.rejects(() => canvas.browseProjectsRt({ dir: '..' }), (e) => e.statusCode === 400);
  await assert.rejects(() => canvas.browseProjectsRt({ dir: 'a/../..' }), (e) => e.statusCode === 400);
  await assert.rejects(() => canvas.browseProjectsRt({ dir: 'C:\\Windows' }), (e) => e.statusCode === 400);
  await assert.rejects(() => canvas.saveScriptRt({ dir: '../outside', name: 'x', femo: 'flow x=1' }), (e) => e.statusCode === 400);
});

test('按名存三态：首存落盘 / 未改动不重写（CRLF 归一）/ force 覆盖 / 有变覆盖', async () => {
  const first = await canvas.saveScriptRt({ dir: '', name: 'hello', femo: 'flow x=1\r\n' });
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(first.existed, false);
  assert.ok(first.path.endsWith('.femo'));

  const same = await canvas.saveScriptRt({ dir: '', name: 'hello', femo: 'flow x=1\n' });
  assert.equal(same.changed, false); // 归一后与盘上一致 → 不写盘，让画布弹「未改动」

  const forced = await canvas.saveScriptRt({ dir: '', name: 'hello', femo: 'flow x=1', force: true });
  assert.equal(forced.changed, true);
  assert.equal(forced.existed, true);

  const changed = await canvas.saveScriptRt({ dir: '', name: 'hello', femo: 'flow x=2' });
  assert.equal(changed.changed, true);
  assert.equal(readFileSync(changed.path, 'utf8'), 'flow x=2');
});

test('按名存的名字消毒（dsh 同款：坏字符换 _，.femo 后缀补齐）', async () => {
  const r = await canvas.saveScriptRt({ dir: '', name: 'a/b?c.femo', femo: 'flow x=1' });
  assert.ok(r.path.endsWith('a_b_c.femo'), `实际落点 ${r.path}`);
});

test('直写形态：绝对路径任意落点（系统对话框产物），缺 .femo 后缀补齐', async () => {
  const target = join(TMP, 'elsewhere', 'script');
  const r = await canvas.saveScriptRt({ path: target, femo: 'flow x=1' });
  assert.equal(r.changed, true);
  assert.ok(r.path.endsWith('script.femo'), `实际落点 ${r.path}`);
  assert.equal(readFileSync(r.path, 'utf8'), 'flow x=1');
});

test('存盘入导出账本 + 记 path 槽；清单可见、可打开、可移除（移除幂等）', async () => {
  const saved = await canvas.saveScriptRt({ dir: '', name: '账本回路', femo: 'flow x=1' });

  const list = await canvas.listFemoFilesRt();
  const hit = list.files.find((f) => f.path === saved.path);
  assert.ok(hit, '存盘后清单应出现该文件');
  assert.equal(hit.source, 'export');

  const opened = await canvas.openFemoFileRt({ path: saved.path });
  assert.equal(opened.content, 'flow x=1');
  assert.equal(await getCanvasPath(join(TMP, 'root')), saved.path); // 打开也记槽

  assert.equal((await canvas.forgetFemoFileRt({ path: saved.path })).removed, true);
  assert.equal((await canvas.forgetFemoFileRt({ path: saved.path })).removed, false); // 幂等
  await assert.rejects(() => canvas.openFemoFileRt({ path: saved.path }), (e) => e.statusCode === 404);
});

test('账本外的路径打不开（open-femo-file 不是任意文件读取器）', async () => {
  const secret = join(TMP, 'secret.txt');
  writeFileSync(secret, 'topsecret', 'utf8');
  await assert.rejects(() => canvas.openFemoFileRt({ path: secret }), (e) => e.statusCode === 404);
});

test('工程目录按名打开：围栏内读盘、只认 .femo、坏名字拒绝', async () => {
  const saved = await canvas.saveScriptRt({ dir: '', name: '浮层开', femo: 'flow y=1' });
  const r = await canvas.openProjectFileRt({ dir: '', name: '浮层开.femo' });
  assert.equal(r.path, saved.path);
  assert.equal(r.content, 'flow y=1');
  await assert.rejects(() => canvas.openProjectFileRt({ dir: '', name: '浮层开' }), (e) => e.statusCode === 400);
  await assert.rejects(() => canvas.openProjectFileRt({ dir: '', name: 'a/b.femo' }), (e) => e.statusCode === 400);
});

test('path 槽：存盘跟随、可清空、空文件按 null 处理', async () => {
  const root = join(TMP, 'root');
  assert.equal(await getCanvasPath(root), null);
  const saved = await canvas.saveScriptRt({ dir: '', name: '槽', femo: 'flow x=1' });
  assert.equal(await getCanvasPath(root), saved.path);
  await setCanvasPath(root, null);
  assert.equal(await getCanvasPath(root), null);
  assert.equal((await canvas.getCanvasPathRt()).path, null);
});
