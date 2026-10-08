#!/usr/bin/env node
/**
 * femo-server.mjs — zcodeAdapter 的 MCP stdio 入口（唯一常驻进程/总装层）。
 *
 * 协议：标准 MCP（JSON-RPC 2.0 over stdio），照 example-plugin 模式零依赖手写。
 * 总装（常驻化第 3 步：引擎直连，桥子进程退役；本地网关 2026-09-28 退役——
 * 生产零消费，人类输入真通道=投影中心网页输入席，见 mcp/已退役-gateway.mjs）：
 *   daemon-client(常驻引擎 femo_daemon.py 的 HTTP 面) ──事件(SSE)──► event-router
 *   main 拍经 hook 注入/收割（钩子直连驿站/引擎/hub，见 hooks/lib.mjs）；
 *   AI 拍=信送出演窗口（每角色一个独立窗口 possess 认领，缺员开演拒演）；
 *   人类拍走投影中心网页输入席（hub 直收）。
 *
 * 防递归哨兵：FEMO_ACTOR_SESSION=1 的会话（角色/无头）只注册空工具面，
 * 不连引擎——插件在角色会话里静默。（观察期 2026-09-27：无子代理化
 * 后角色会话形态已废、env 恒未设，分支注释退役中，见 ACTOR_SENTINEL 处。）
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { ZcodeDaemonClient, REPO_ROOT, PLUGIN_ROOT } from './engine-bind.mjs';
import { createEventRouter } from './event-router.mjs';
import { importCore, dataRoot, HOST_ID } from '../paths.mjs';

const { buildToolSpecs, createBridgeToolImpls } = await importCore('tools-core.mjs');
const { ensureBridgeReady, probeDaemon } = await importCore('daemon-client.mjs');
const { hubBaseUrl } = await importCore('hub-client.mjs');
const { expandSkillTemplate } = await importCore('skill-expand.mjs');
// 附身入口 2026-09-28 起是 runtime/femo-possess.mjs 程序（自证附身+守夜一体，
// 参数口径与 femo_possess 工具一致）——MCP 不再暴露 femo_possess 工具，zcode 的
// AI 只见程序入口；跨会话派角/解附身也走程序（带 --session_id）。

/** 运行时数据：FEMO_DATA_DIR 优先（ZCODE_PLUGIN_DATA 注入），缺省仓库内自包含。 */
const DATA_DIR = dataRoot();
// 观察期（2026-09-27 注释退役）：无子代理化后角色/无头会话不复存在，env 恒未设，
// 原式 `process.env.FEMO_ACTOR_SESSION === '1'` 恒假——先钉死为 false 观察，无恙后
// 连同 tools/call 守卫与网关守卫连块删除。
// const ACTOR_SENTINEL = process.env.FEMO_ACTOR_SESSION === '1';
const ACTOR_SENTINEL = false;

const log = (...a) => process.stderr.write(`[femo] ${a.join(' ')}\n`); // stderr = MCP 日志通道

// ── 开窗报到（2026-10-01）─────────────────────────────────────────────────
// zcode 的门铃心跳原本只随「用到 femo 工具」的 ensure 链路启动——窗口开着、
// 会话闲着，MCP 进程活着却从没报过到，web 的开演对账就把开着的 zcode 断成
// 「没打开」（引擎门铃簿实证：hosts 里恒无 zcode，而 dsh/web 的心跳都住在
// 常开进程里）。MCP 启动即起心跳：**只报到、不代拉**——引擎死了不 spawn
// （开个 zcode 窗口不该顺手拉起 Python 引擎，谁真用 femo 谁拉），每 10s 探
// 一拍，引擎活着就 POST /engine/doorbell 报空门牌（自取户，报到即算在线），
// 死了静默等下一拍；探活/报到失败同样安静——报到是添头，绝不为它吵。
{
  const heartbeat = async () => {
    try {
      const hit = await probeDaemon(REPO_ROOT, { quiet404: true, timeoutSec: 2 });
      if (!hit) return;
      await fetch(`${hit.base}/engine/doorbell`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ host: HOST_ID, url: '' }),
        signal: AbortSignal.timeout(4000),
      });
    } catch { /* 引擎不在/抖动：下一拍再来 */ }
  };
  heartbeat();
  setInterval(heartbeat, 10_000);
}

// ── SKILL.md {FEMO_ROOT} 落盘替换（对齐 dshAdapter installFemoPreset 的语义）──
// SKILL.md 正文教路径时写 {FEMO_ROOT} 占位符；安装态（宿主注入 PLUGIN_ROOT env）
// 随 MCP 每会话启动，把缓存副本里的占位符替换成本机真实引擎根——模型读到的就
// 是可直接使用的路径。开发态（无 env，跑在源仓库）绝不写，避免污染源文件占位
// 符；幂等：无占位符即跳过。正文 replacement 由 frontmatter description 保持
// 无路径（描述经宿主静态注入，先于本进程，占位符没机会被替换）。
if (process.env.ZCODE_PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT) {
  try {
    const skillPath = join(PLUGIN_ROOT, 'skills', 'femo', 'SKILL.md');
    // 模板源优先引擎根下的 zcodeAdapter 源文件（FEMO_ROOT 重定向到开发仓时天然
    // 存在且带占位符）——env 变更后能自愈重写；平铺布局没有它时回落目标文件
    // 自身（仅其仍含占位符时生效）。
    const templateSources = [
      join(REPO_ROOT, 'hostAdapter', 'zcodeAdapter', 'skills', 'femo', 'SKILL.md'),
      skillPath,
    ];
    const template = templateSources
      .map(p => (existsSync(p) ? readFileSync(p, 'utf8') : ''))
      .find(text => text.includes('{FEMO_ROOT}'));
    if (template !== undefined) {
      // 通用教条展开（2026-09-22 SKILL 拆分；2026-09-29 收编唯一份
      // skill-expand.mjs——手写份与 dsh/autoclaw 漂移，且旧序「先换
      // {FEMO_ROOT} 再展开」把公共正文自带的占位符永远漏在产物里）。
      // 公共文件缺失=指令原样保留（保守）。
      let desired = expandSkillTemplate(template, REPO_ROOT, 'zcode');
      if (!existsSync(skillPath) || readFileSync(skillPath, 'utf8') !== desired) {
        mkdirSync(dirname(skillPath), { recursive: true });
        writeFileSync(skillPath, desired);
        log(`SKILL.md {FEMO_ROOT} -> ${REPO_ROOT}`);
      }
    }
  } catch (error) {
    log(`SKILL.md placeholder patch failed: ${String(error)}`);
  }
}

// ── 总装（bridge ↔ router）──────────────────────────────────────────────
// 【2026-09-25 投影自存退役】三窗 JSONL 柜（projection-writer）整体移除——
// hub 是投影唯一数据面（桥 EventProjector 喂FEMO内行），宿主侧不再自存投影历史，
// <DATA_DIR>/host-history/proj-mirror 目录从此不再创建（空文件夹问题绝根）。
let router;

const bridge = new ZcodeDaemonClient({
  onEvent: (type, data) => {
    if (type === 'flow_start') {
      // 投影中心名册接入（行协议 §5.6）：单运行时恒 femo-main，启动运行即
      // upsert+bind——手机端主会话面板与 god:zcode 视角由此认得 zcode。
      // best-effort：名册是旁挂，hub 未起/不在线时自然失败（fetch reject 吞掉）。
      const jobId = Number.isFinite(data?.job_id) ? data.job_id : undefined;
      announceSession('femo-main', 'ZCode 主会话', jobId, true);
    }
    router?.handleEvent(type, data);
  },
  log,
});

// ── 事件总装（分诊台薄绑定；投影历史归 hub，宿主纯记账）────────────────
router = createEventRouter({
  sid: 'femo-main',
  send: (cmd, args, timeoutMs) => bridge.send(cmd, args, timeoutMs),
  log,
});

/** 等桥就绪收公共层（2026-09-24 A1：惰性拉起+ping 重试与 autoclaw 逐字同构）。 */
function ensureBridge() {
  return ensureBridgeReady(bridge);
}

/** 名册公告（行协议 §5.6）：upsert 会话入册；doBind=true 时连「主会话」指针一起
 *  换绑（仅主Agent开场那拍用——附身是参与运行，不动主会话指针）。best-effort 静默。 */
function announceSession(sid, name, jobId, doBind) {
  void (async () => {
    try {
      await fetch(`${hubBaseUrl()}/sessions/announce`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: HOST_ID,
          upsert: [{ sid, name, ...(Number.isFinite(jobId) ? { job: jobId } : {}) }],
          ...(doBind ? { bind: sid } : {}),
        }),
      });
    } catch { /* 名册是旁挂 */ }
  })();
}

// ── 工具：总纲（femo2host/host/tools-core.mjs）+ 宿主 spawn 适配 ────────
/** python 一次性子进程（台账 chronica.py 用）。返回 { output, exitCode }。
 *  正身=debugSpawnProc 的流式原语（2026-09-29 收编：spawn 纪律一份——python
 *  解析、UTF-8 env、超时击杀不再两份）；本函数只剩「积攒成串+超时拒绝」的
 *  契约形状。启动失败如实拒绝（done=undefined），与旧语义一致。 */
function spawnPython(cliArgs, timeoutMs) {
  return new Promise((resolve, reject) => {
    let out = '';
    const proc = debugSpawnProc({
      argv: cliArgs,
      cwd: REPO_ROOT,
      env: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      onStdoutChunk: c => { out += c; },
      onStderrLine: l => { out += l + '\n'; },
    });
    const timer = setTimeout(() => {
      proc.terminate();
      reject(new Error(`python 子进程超时（${timeoutMs / 1000}s）：${cliArgs[0]}`));
    }, timeoutMs);
    proc.done.then(code => {
      clearTimeout(timer);
      if (code === undefined) reject(new Error(`python 子进程启动失败：${cliArgs[0]}`));
      else resolve({ output: out, exitCode: code.exitCode });
    });
  });
}
/** 干跑监工的 spawn 适配器（契约见 debug-run-core.mjs 文件头）。 */
function debugSpawnProc({ argv, cwd, env, onStderrLine, onStdoutChunk }) {
  const p = spawn(process.env.FEMO_PYTHON || 'python', argv,
    { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', c => onStdoutChunk?.(c.toString('utf8')));
  p.stderr.on('data', c => {
    for (const line of c.toString('utf8').split(/\r?\n/)) {
      if (line.trim().length > 0) onStderrLine?.(line);
    }
  });
  return {
    done: new Promise(resolve => {
      p.on('error', () => resolve(undefined));
      p.on('exit', code => resolve({ exitCode: code ?? -1 }));
    }),
    terminate: () => { try { p.kill(); } catch { /* 已退出则忽略 */ } },
  };
}

const impls = createBridgeToolImpls({
  ensureBridge,
  send: (cmd, args, timeoutMs) => bridge.send(cmd, args, timeoutMs),
  femoRoot: REPO_ROOT,
  host: 'zcode', // host_refs 字典键（B3 pause 归属裁决用，=桥 --host 标签）
  hostRef: 'zcode-femo',
  spawnPython,
  debugSpawnProc,
  onProgress: msg => log(`femo-debug: ${msg}`),
  runNextHint: '启动运行后按演出循环推进：每拍先架 femo-possess 进程（Bash 后台，认领角色+后台等信一体）→把台词作为本回合最后一条消息说出→真闭合→被唤醒即演，详见 SKILL。',
});

// 模型可见面：总纲规格（zcode 版描述；possess=false——附身走 femo-possess 程序，
// 见文件头）+ TOOL_IMPLS 注册。
const TOOL_DEFS = buildToolSpecs({ host: 'zcode', possess: false });
const TOOL_IMPLS = {
  femo_mount: impls.femo_mount,
  femo_run: impls.femo_run,
  femo_script: impls.femo_script,
  femo_soul: impls.femo_soul,
  femo_debug: impls.femo_debug,
  femo_chronica: impls.femo_chronica,
};

// ── MCP 协议面（JSON-RPC 2.0 over stdio）────────────────────────────────
function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}


// 投递缓存 soul-hints.json 的写口已收编 session-registry.recordSoulHint，
// 唯一消费者=femo-possess 程序（落账成功后同拍写）；本进程不再经手附身。

async function dispatch(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'femo', version: '0.1.0' },
      });
      return;
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return; // 通知无需应答
    case 'ping':
      reply(id, {});
      return;
    case 'tools/list':
      // 【2026-09-25 MCP 合规】工具总纲的规格把参数叫 parameters（dsh 形状），
      // MCP 协议要求 inputSchema——原样透传会被客户端以「inputSchema undefined」
      // 整批拒收（连接失败，实测实锤）。这里做形状映射：parameters 本身已是
      // {type:'object', properties} 形状，原样抬进 inputSchema，required 随行。
      reply(id, {
        tools: ACTOR_SENTINEL ? [] : TOOL_DEFS.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: {
            type: 'object',
            properties: (t.parameters && t.parameters.properties) || {},
            ...(t.required ? { required: t.required } : {}),
          },
        })),
      });
      return;
    case 'tools/call': {
      // 观察期（2026-09-27）：哨兵会话已废，守卫恒不触发，注释退役（见 ACTOR_SENTINEL 处）。
      // if (ACTOR_SENTINEL) { reply(id, { content: [{ type: 'text', text: 'femo actor session: tools disabled' }], isError: true }); return; }
      const name = params?.name;
      const impl = TOOL_IMPLS[name];
      if (impl === undefined) { replyError(id, -32602, `unknown tool: ${name}`); return; }
      try {
        const result = await impl(params.arguments ?? {}, params._meta);
        const isError = result !== undefined && result !== null && typeof result === 'object' && result.error !== undefined;
        reply(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(isError ? { isError: true } : {}) });
      } catch (error) {
        reply(id, { content: [{ type: 'text', text: `工具执行异常：${String(error).slice(0, 400)}` }], isError: true });
      }
      return;
    }
    default:
      if (id !== undefined) replyError(id, -32601, `method not found: ${method}`);
  }
}

let stdinBuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  stdinBuf += chunk;
  let idx;
  while ((idx = stdinBuf.indexOf('\n')) !== -1) {
    const line = stdinBuf.slice(0, idx).trim();
    stdinBuf = stdinBuf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { log(`bad json line: ${line.slice(0, 120)}`); continue; }
    dispatch(msg).catch(error => {
      log(`dispatch error: ${String(error)}`);
      if (msg?.id !== undefined) replyError(msg.id, -32603, String(error).slice(0, 300));
    });
  }
});
process.stdin.on('end', () => {
  bridge.stop().finally(() => process.exit(0));
});
log(`femo-server ready (data=${DATA_DIR}${ACTOR_SENTINEL ? ', actor-sentinel: tools disabled' : ''})`);
