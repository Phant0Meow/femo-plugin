/**
 * canvas.mjs — femoGen 画布的网页版宿主绑定（2026-09-28 流程画布接入）。
 *
 * 画布=vite 成品（femoGen/dist，构建唯一出处 femoGen 目录 npm run build），以
 * 「独立模式」运行：后端地址由本服务注入 index.html 时播种（=本服务同源），
 * 调用面 /api/run 族 + 两处历史遗留无门控直打的 /femo-plugin/*（models、
 * debug-run——dsh 词汇的旧账，web 侧照单伺候，别处不开画布时无人消费）。
 *
 * 三件事：
 * ① 静态伺候 /canvas 与 /assets|根资产：index.html 只注入一段播种脚本——
 *    默认主题=Web 操作台（localStorage 'femo_theme'，用户自选过就不覆写）；
 *    独立模式后端地址写 sessionStorage（每次装载都写，永远指向当前服务地址）；
 *    另一段是自动挂载播种（2026-09-30）：?mount=1 开页且本服务挂载态有脚本
 *    （GET /canvas/mounted 供稿，service.mjs 那头）就驱动画布隐藏 file input
 *    自动导入——femoGen 零改动。
 * ② 画布 SSE 通道：公共层 sse-core 单例（dsh 同款缺省帧形 {type,data}，画布
 *    两种模式同吃）。引擎事件由 service 在 bridge.onEvent 分流一跳 feed()：
 *    原始帧直推；变量世界三事件不双推（variable-api 归一出 variable_record，
 *    断点/气泡供给，dsh engine-events 同款姿势）；run_state 快照按四个迁移点
 *    合成——画布的运行状态键只认宿主广播的快照，这四个引擎事件本身就是迁移。
 * ③ 干跑代理 /femo-plugin/debug-run：公共层 debug-run-core（监工）装配 +
 *    服务现成 debugSpawnProc 拉调试器 + sandbox.logPath JSONL 尾随 NDJSON
 *    转发（dsh debug-run.ts 流式半场的同款形状，逐行进画布调试窗）。
 */

import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { readBody } from './http-io.mjs';
import { readFile, open, mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { listFemoFiles, rememberFemoFile, forgetFemoFile, readLedgerFemoFile } from '../../../femo2host/femoGenConnector/femogen-files.mjs';
import { getCanvasPath, setCanvasPath } from '../../../femo2host/femoGenConnector/femogen-canvas-state.mjs';
import { pickFemoFileViaDialog } from '../../../femo2host/femoGenConnector/file-dialogs.mjs';
import { createSseChannel } from '../../../femo2host/femoGenConnector/sse-core.mjs';
import { createVariableApi } from '../../../femo2host/host/variable-api.mjs';
import {
  acquireDebugRun,
  buildDebuggerArgv,
  prepareDebugSandbox,
  releaseDebugRun,
  DEBUG_TIMEOUT_MS,
} from '../../../femo2host/host/debug-run-core.mjs';

/** 画布运行状态键的合成表：引擎的四个迁移事件 → run_state 快照。
 *  【已退役-观察期（2026-10-05 画布直连刀4）】run_state 合成广播退役——画布
 *  改直连引擎后由四个迁移事件直接驱动按钮态（画布事件入口本就直吃这四个），
 *  宿主合成成了第二份。表保留观察，观察无误后连块删。 */
const RUN_STATE_OF = {
  flow_start: 'running',
  flow_paused: 'suspended',
  bridge_run_ended: 'finished',
  flow_error: 'failed',
};
const RUN_STATE_RETIRED = true;   // 观察期开关：合成广播已停发，回滚=改回 false

const MIME = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

/** dist 根部的散件白名单（构建产物按绝对路径引用的根级资产）。 */
const ROOT_ASSETS = new Set(['favicon.ico', 'femo-logo.svg', 'femo-logo-slogan.svg', 'character_need.ttf']);

const notFound = (res) => { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('not found'); };

/**
 * @param {object} opts
 * @param {string} opts.femoRoot     引擎根（dist 与干跑沙盒都锚在它下面）
 * @param {string} opts.projectsDir  画布运行起点存脚本的目录（随数据根走沙盒）
 * @param {(spec: {argv: string[], cwd: string, env: object, onStderrLine?: (l: string) => void}) =>
 *          Promise<{done: Promise<{exitCode?: number}|undefined>, terminate: () => void}>} opts.spawnProc
 *   服务现成的 debugSpawnProc（femo_debug 工具路径同款）
 * @param {(m: string) => void} [opts.log]
 */
export function createCanvasSupport({ femoRoot, projectsDir, spawnProc, log = () => {} }) {
  const DIST = join(femoRoot, 'femoGen', 'dist');

  // ── ② 画布 SSE 通道 + 引擎事件入口 ──────────────────────────────────
  const channel = createSseChannel({ log });
  const variableApi = createVariableApi({ log: m => log(`[variable-api] ${m}`) });
  // 断点/气泡供给：checkpoint 按 brief 出线（变量世界整包不出）、func/assign 全量
  // （In 面板吃 input）；job_id 回填引擎词汇（画布按 job_id 跟随当前 Job）。
  // 【已退役-观察期（刀4）】variable_record 定向广播退役——画布直吃引擎三个
  // 原生事件（字段同名同形），宿主供给成了第二份。ingest 照旧（分流裁决不变）。
  variableApi.subscribe('full', record => {
    log(`[variable-api] variable_record(退役观察): kind=${record?.kind} job=${record?.jobId ?? '-'}`);
  });

  /** 引擎事件分流入口（service 在 bridge.onEvent 上包一层调这里）。 */
  function feed(eventType, data) {
    const d = data ?? {};
    if (variableApi.handles(eventType)) { variableApi.ingest(eventType, d); return; }
    channel.broadcast(eventType, d);
    // 【已退役-观察期（刀4）】run_state 合成广播退役（表与开关见文件头）。
    if (!RUN_STATE_RETIRED) {
      const state = RUN_STATE_OF[eventType];
      if (state) channel.broadcast('run_state', { state, job_id: d.job_id });
    }
  }

  /** 画布运行流（EventSource）：SSE 头 + 通道入座（重放+心跳托管在公共层）。
   *  flushHeaders 立即发头：空环时首帧要等心跳（15s），浏览器干等不如先握手。 */
  function connectStream(res) {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.flushHeaders?.();
    channel.connect(res);
  }

  // ── ① 静态伺候 ─────────────────────────────────────────────────────
  async function serveIndex(res) {
    try {
      let html = await readFile(join(DIST, 'index.html'), 'utf8');
      const inject = `<script>
  /* web 宿主播种（本地服务注入，2026-09-28）：默认主题=Web 操作台——localStorage
     里用户自选过主题就不覆写；独立模式后端=本服务，host 不带端口、端口单放
     （画布按 host:port 自拼）。sessionStorage 每次装载都写：永远指向当前地址。 */
  try {
    if (!localStorage.getItem('femo_theme')) localStorage.setItem('femo_theme', 'web');
    sessionStorage.setItem('femo_backend_host', location.protocol + '//' + location.hostname);
    sessionStorage.setItem('femo_backend_port', location.port || (location.protocol === 'https:' ? '443' : '80'));
  } catch {}
</script>
<script>
  /* web 宿主自动挂载（2026-09-30）：侧栏「流程画布」按钮带 ?mount=1 开页——
     本服务挂载态里有脚本（GET /canvas/mounted 有货）就把它自动「导入」进画布：
     走画布自己的隐藏 file input（handleImportFile→applyFEMOText，即人类导入
     那条路——mount≈导入，同一语义），femoGen 零改动。一次开页只灌一次：
     sessionStorage 邮票挡住同标签页刷新重灌（免得盖掉用户手上的画布），新开
     标签页才再灌。没挂载/导入口没等到=没这回事，安静作罢不报错。 */
  try {
    if (new URLSearchParams(location.search).has('mount')
        && !sessionStorage.getItem('femo_canvas_mount_applied')) {
      sessionStorage.setItem('femo_canvas_mount_applied', '1');
      fetch('/canvas/mounted').then(r => r.json()).then(s => {
        if (!s || !s.ok || !s.text) return;
        const deadline = Date.now() + 15000;   // React 挂载前导入口还不存在，轮询等它
        (function hunt() {
          const input = document.querySelector('input[type=file][accept=".femo"]');
          if (!input) {
            if (Date.now() >= deadline) { console.warn('[web] 画布自动挂载：导入口没等到，作罢'); return; }
            return setTimeout(hunt, 200);
          }
          const dt = new DataTransfer();
          dt.items.add(new File([s.text], 'mounted.femo'));
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        })();
      }).catch(e => console.warn('[web] 画布自动挂载失败：', e));
    }
  } catch {}
</script>`;
      html = html.replace('</head>', `${inject}\n</head>`);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`画布成品读不到（先在 femoGen 目录 npm run build）：${String(e).slice(0, 120)}`);
    }
  }

  async function serveAsset(res, name) {
    const rel = String(name).replace(/\\/g, '/');
    let target = null;
    if (rel.startsWith('assets/') && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(rel.slice('assets/'.length))) {
      target = join(DIST, 'assets', rel.slice('assets/'.length));
    } else if (ROOT_ASSETS.has(rel)) {
      target = join(DIST, rel);
    }
    if (!target) return notFound(res);
    try {
      const buf = await readFile(target);
      res.writeHead(200, {
        'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=3600',
      });
      res.end(buf);
    } catch {
      notFound(res);
    }
  }

  // ── 画布运行起点：脚本存盘（同内容复用同路径，反复运行不堆文件）──────
  let lastSave = { hash: '', path: '' };
  async function saveScript(femo) {
    const hash = createHash('sha256').update(femo).digest('hex').slice(0, 16);
    if (lastSave.hash === hash && lastSave.path) return lastSave.path;
    await mkdir(projectsDir, { recursive: true });
    const p = join(projectsDir, `web-canvas-${Date.now()}.femo`);
    await writeFile(p, femo, 'utf8');
    lastSave = { hash, path: p };
    log(`canvas: script saved => ${p}`);
    return p;
  }

  // ── femoGen 自有文件面（2026-09-30）：独立模式的导入/导出宿主绑定 ─────
  // 能力都在 femoGen 公共层（导入账本=femogen-files、当前 path 槽=femogen-canvas-state、
  // 系统对话框=file-dialogs），本节只是 web 本地服务的薄伺候——这正是「femoGen
  // 原生能力、宿主只出路由」的裁决：下一个宿主照抄这一节即可。
  // 安全围栏：客户端拼出来的路径（浏览/新建/按名打开/按名保存）必须落在
  // projects/ 内——本服务无鉴权，这条围栏是安全下限；绝对路径直写与系统
  // 对话框产生的路径是操作者亲手选的，与 dsh 同一权限面，不设限。

  /** 项目名/目录名消毒：坏字符与点目录直接拒绝（服务在替磁盘把关，宁拒勿改）。 */
  function rejectBadName(name, label) {
    const n = String(name ?? '').trim();
    if (n.length === 0 || n === '.' || n === '..' || /[\\/:*?"<>|]/.test(n)) {
      throw Object.assign(new Error(`${label}不合法：${name}`), { statusCode: 400 });
    }
    return n;
  }

  /** projects/ 围栏：客户端给的相对目录 → 绝对路径；`..` 段与绝对路径越界一律拒绝。 */
  function resolveInsideProjects(relDir) {
    const root = resolve(projectsDir);
    const rel = String(relDir ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (rel.split('/').some((seg) => seg === '..')) {
      throw Object.assign(new Error(`目录越界：${relDir}`), { statusCode: 400 });
    }
    const abs = resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + sep)) {
      throw Object.assign(new Error(`目录越界：${relDir}`), { statusCode: 400 });
    }
    return abs;
  }

  /** 围栏内绝对路径 → 给客户端回显的相对目录（正斜杠，根=''）。 */
  function relInsideProjects(abs) {
    return relative(resolve(projectsDir), abs).replace(/\\/g, '/');
  }

  const normText = (s) => s.replace(/\r\n/g, '\n');

  /** 导入清单（画布导入的第一级）。数据=公共层账本，web 与 dsh 共享同一本。 */
  async function listFemoFilesRt() {
    return { ok: true, files: await listFemoFiles(femoRoot) };
  }

  /** 从清单打开一条：账本门禁读盘（不在账本=打不开，不是任意文件读取端点）
   *  → 记一次使用（顶到清单最前）→ 记当前 path 槽。 */
  async function openFemoFileRt(body) {
    const path = typeof body.path === 'string' ? body.path.trim() : '';
    if (path.length === 0) throw Object.assign(new Error('path is required'), { statusCode: 400 });
    let content;
    try {
      content = await readLedgerFemoFile(femoRoot, path);
    } catch (e) {
      // 文件被移走/删掉是常见情况（外接盘、改名），带 404 原样上屏给用户判断
      throw Object.assign(new Error(`打不开该文件：${String(e)}`), { statusCode: 404 });
    }
    await rememberFemoFile(femoRoot, path, 'import');
    await setCanvasPath(femoRoot, path);
    return { ok: true, path, content };
  }

  /** 从清单移除一条：只划账本，源文件零接触；不在账本也 ok（幂等，dsh 同款）。 */
  async function forgetFemoFileRt(body) {
    const path = typeof body.path === 'string' ? body.path.trim() : '';
    if (path.length === 0) throw Object.assign(new Error('path is required'), { statusCode: 400 });
    const removed = await forgetFemoFile(femoRoot, path);
    return { ok: true, removed };
  }

  /** 当前 path 槽读取（画布开页播种 savedPath）。 */
  async function getCanvasPathRt() {
    return { ok: true, path: await getCanvasPath(femoRoot) };
  }

  /**
   * 存盘（dsh save-script 两形态同款契约，2026-08-30 导出三态）：
   *  - {path, femo} 直写：绝对路径（系统对话框产物）任意落点，缺 .femo 后缀补齐；
   *  - {dir, name, femo} 按名存：客户端拼路径，必须过 projects/ 围栏。
   * 「未改动不写」三态裁决：与盘上内容一致（CRLF 归一）且未 force → 不写盘
   * 不入账，回 changed:false 让画布弹「未改动」提醒；真写了则入导出账本 +
   * 记当前 path 槽。槽只在真写时动——「依然保存」也算一次导出。
   */
  async function saveScriptRt(body) {
    const femo = typeof body.femo === 'string' ? body.femo : '';
    const rawPath = typeof body.path === 'string' && body.path.trim().length > 0 ? body.path.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (rawPath.length === 0 && name.length === 0) {
      throw Object.assign(new Error('name is required（path 直写形态除外）'), { statusCode: 400 });
    }
    if (femo.trim().length === 0) throw Object.assign(new Error('FEMO脚本文本为空'), { statusCode: 400 });
    let target;
    if (rawPath.length > 0) {
      target = rawPath.toLowerCase().endsWith('.femo') ? rawPath : `${rawPath}.femo`;
    } else {
      const safe = name.replace(/[\\/:*?"<>|]/g, '_').replace(/\.femo$/i, '');
      target = join(resolveInsideProjects(body.dir), `${safe}.femo`);
    }
    let existing = null;
    try { existing = await readFile(target, 'utf8'); } catch { /* 不存在=首存 */ }
    if (existing !== null && normText(existing) === normText(femo) && body.force !== true) {
      return { ok: true, path: target, changed: false };
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, femo, 'utf8');
    await rememberFemoFile(femoRoot, target, 'export');
    await setCanvasPath(femoRoot, target);
    log(`canvas: script saved => ${target}`);
    return { ok: true, path: target, changed: true, existed: existing !== null };
  }

  /** projects/ 目录浏览（手机端工程目录浮层的数据面）：子目录 + .femo 文件；
   *  projects 还没建出来=空清单，是诚实状态不是错误。 */
  async function browseProjectsRt(body) {
    const abs = resolveInsideProjects(body.dir);
    let entries = [];
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return { ok: true, dir: relInsideProjects(abs), dirs: [], files: [] };
    }
    const dirs = [];
    const files = [];
    for (const ent of entries) {
      if (ent.isDirectory()) dirs.push(ent.name);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.femo')) {
        const st = await stat(join(abs, ent.name)).catch(() => undefined);
        files.push({ name: ent.name, size: st?.size, mtimeMs: st?.mtimeMs });
      }
    }
    dirs.sort();
    files.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    return { ok: true, dir: relInsideProjects(abs), dirs, files };
  }

  /** projects/ 里新建文件夹（手机端浮层的新建键）。 */
  async function mkdirProjectsRt(body) {
    const name = rejectBadName(body.name, '文件夹名');
    const base = resolveInsideProjects(body.dir);
    const target = join(base, name);
    await mkdir(target, { recursive: true });
    return { ok: true, dir: relInsideProjects(target) };
  }

  /** projects/ 里按名打开（浮层 open 模式）：围栏内读盘 → 入账本 + 记当前 path 槽。 */
  async function openProjectFileRt(body) {
    const name = rejectBadName(body.name, '文件名');
    if (!name.toLowerCase().endsWith('.femo')) {
      throw Object.assign(new Error('只认 .femo 文件'), { statusCode: 400 });
    }
    const target = join(resolveInsideProjects(body.dir), name);
    let content;
    try {
      content = await readFile(target, 'utf8');
    } catch (e) {
      throw Object.assign(new Error(`打不开该文件：${String(e)}`), { statusCode: 404 });
    }
    await rememberFemoFile(femoRoot, target, 'import');
    await setCanvasPath(femoRoot, target);
    return { ok: true, path: target, content };
  }

  // 桌面端系统对话框（引擎=公共层 file-dialogs）：单飞——同屏叠两个系统对话框
  // 没有意义，第二个响亮拒绝（dsh 放行叠窗各随其主；web 是无鉴权服务，收紧）。
  let dialogInFlight = false;

  /** 导入·第二级（桌面端）：弹系统打开文件框 → 原始路径读盘入账本 + 记槽。 */
  async function pickScriptDialogRt() {
    if (dialogInFlight) throw Object.assign(new Error('已有一个文件对话框在等裁决'), { statusCode: 409 });
    dialogInFlight = true;
    try {
      await mkdir(projectsDir, { recursive: true }).catch(() => {});   // 对话框起始目录
      const picked = await pickFemoFileViaDialog({ mode: 'open', title: 'Import FEMO Script', initialDirectory: projectsDir });
      if (picked === null) return { ok: true, path: null };
      const content = await readFile(picked, 'utf8');
      await rememberFemoFile(femoRoot, picked, 'import');
      await setCanvasPath(femoRoot, picked);
      return { ok: true, path: picked, content };
    } finally {
      dialogInFlight = false;
    }
  }

  /** 导出·首存/另存为（桌面端）：弹系统保存文件框（缺省名+起始目录照发）。
   *  只取路径不写盘——落盘统一走 saveScriptRt（三态/账本/槽都在那一处）。 */
  async function pickSavePathDialogRt(body) {
    if (dialogInFlight) throw Object.assign(new Error('已有一个文件对话框在等裁决'), { statusCode: 409 });
    dialogInFlight = true;
    try {
      await mkdir(projectsDir, { recursive: true }).catch(() => {});
      const rawName = typeof body.name === 'string' ? body.name : '';
      const base = (rawName.split(/[\\/]/).pop() ?? '').trim() || 'flow';
      const picked = await pickFemoFileViaDialog({ mode: 'save', title: 'Save FEMO Script', defaultName: base, initialDirectory: projectsDir });
      return { ok: true, path: picked };
    } finally {
      dialogInFlight = false;
    }
  }

  // ── ③ 干跑代理（NDJSON 流式；dsh debug-run.ts 流式半场同款）─────────
  // 请求体收集唯一活在 server/http-io.mjs（服务总装同吃）；解析坏帧回 {}
  // 是本路的既有语义（落到「脚本文本为空」400），不悄悄改。
  async function readJsonBody(req) {
    const raw = await readBody(req, 4 * 1024 * 1024);
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }

  async function handleDebugRun(req, res) {
    // 单飞闸在核心（与 femo-debug 工具同闸：调试窗在跑时工具明确报错，反之亦然）。
    if (!acquireDebugRun()) {
      res.writeHead(409, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: '已有调试干跑在进行中，请等它结束再点' }));
    }
    let streaming = false;
    let clientGone = false;
    let handle;
    let exited = false;
    const onClientClose = () => {
      clientGone = true;
      // 客户端走人＝干跑失去意义：不留僵尸 python。
      if (!exited && handle) { try { handle.terminate(); } catch { /* 已退出则忽略 */ } }
    };
    try {
      const body = await readJsonBody(req);
      const femo = typeof body.femo === 'string' ? body.femo : '';
      if (!femo.trim()) {
        releaseDebugRun();
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'FEMO脚本文本为空' }));
      }
      // 沙盒 + argv 装配在核心（与工具路径同源）。
      const sandbox = await prepareDebugSandbox(femoRoot, { femo });
      const built = await buildDebuggerArgv({
        femoRoot,
        sandbox,
        req: { scriptPath: typeof body.scriptPath === 'string' ? body.scriptPath : undefined },
        runs: Number(body.runs),
        seed: typeof body.seed === 'number' ? body.seed : undefined,
        module: typeof body.module === 'string' ? body.module : undefined,
      });
      if (built.note !== undefined) log(`debug-run: ${built.note}`);
      handle = await spawnProc({
        argv: built.argv,
        cwd: femoRoot,
        env: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
        onStderrLine: line => log(`[femo-debug:stderr] ${String(line).slice(0, 240)}`),
      });
      req.on('close', onClientClose);
      res.on('close', onClientClose);

      // ── 流式阶段开始：之后任何失败都以一条 debug_error 收尾（头已发出）。──
      streaming = true;
      res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache' });
      const send = rec => { if (!clientGone && !res.destroyed) res.write(`${JSON.stringify(rec)}\n`); };

      // tail JSONL：offset 增量读，按行转发（femo_debugger 每条 flush，延迟≈150ms）。
      const logPath = sandbox.logPath;
      let offset = 0;
      let remainder = '';
      const tailOnce = async () => {
        let fh;
        try { fh = await open(logPath, 'r'); } catch { return; }   // 文件未创建＝还没跑到
        try {
          const st = await fh.stat();
          if (st.size > offset) {
            const buf = Buffer.alloc(st.size - offset);
            const { bytesRead } = await fh.read(buf, 0, buf.length, offset);
            offset += bytesRead;
            remainder += buf.toString('utf8');
            let idx;
            while ((idx = remainder.indexOf('\n')) !== -1) {
              const line = remainder.slice(0, idx).trim();
              remainder = remainder.slice(idx + 1);
              if (!line) continue;
              try { send(JSON.parse(line)); } catch { send({ kind: 'debug_error', error: `日志行解析失败: ${line.slice(0, 200)}` }); }
            }
          }
        } finally { await fh.close(); }
      };

      handle.done.then(() => { exited = true; }, () => { exited = true; });
      const started = Date.now();
      let timedOut = false;
      while (!exited && !clientGone) {
        await tailOnce();
        if (exited || clientGone) break;
        if (Date.now() - started > DEBUG_TIMEOUT_MS) {
          timedOut = true;
          try { handle.terminate(); } catch { /* 已退出则忽略 */ }
          break;
        }
        await new Promise(r => setTimeout(r, 150));
      }
      const outcome = await handle.done.catch(() => undefined);
      await tailOnce();   // 进程退出后再 drain 一次残余日志
      if (timedOut) send({ kind: 'debug_error', error: `调试干跑超时（${DEBUG_TIMEOUT_MS / 1000}s），已强制终止` });
      send({ kind: 'debug_done', exitCode: outcome?.exitCode ?? -1 });
    } catch (e) {
      if (!streaming) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e).slice(0, 300) }));
      } else if (!clientGone && !res.destroyed) {
        res.write(`${JSON.stringify({ kind: 'debug_error', error: String(e?.message ?? e).slice(0, 300) })}\n`);
      }
    } finally {
      releaseDebugRun();
      req.off?.('close', onClientClose);
      res.off?.('close', onClientClose);
      if (streaming && !clientGone && !res.destroyed) res.end();
    }
  }

  return {
    feed, connectStream, serveIndex, serveAsset, saveScript, handleDebugRun,
    // femoGen 自有文件面（导入/导出/path 槽/目录浮层/系统对话框）
    listFemoFilesRt, openFemoFileRt, forgetFemoFileRt, getCanvasPathRt, saveScriptRt,
    browseProjectsRt, mkdirProjectsRt, openProjectFileRt, pickScriptDialogRt, pickSavePathDialogRt,
  };
}
