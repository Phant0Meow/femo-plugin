/**
 * debug-run-core.mjs — 零 token 干跑的「监工」（host 无关公共层，femo2host）。
 *
 * 从 dshAdapter/host/debug-run.ts 抽出的通用件（2026-09-15）：沙盒装配、
 * 调试器 argv 组装、单飞闸、看门狗收集、DebugLogBus 流水渲染、终报格式化、
 * 工具结果裁决。两个宿主（dsh / zcode）共用这一份；各自只保留「怎么把
 * python 子进程拉起来」与「结果给谁看」的宿主形态（DSH 有 HTTP 流式调试窗，
 * zcode 是工具一次性回话）。
 *
 * 与替身本体的分工：femo_debugger.py（FakeHost 替答）是引擎侧；本文件是
 * 宿主侧的过程纪律——同一时刻只许一条干跑（单飞闸：femo_debugger 的类级
 * patch 是进程内的，并发两条会互相污染 tracker）、跑多久算卡死（看门狗）、
 * 流水怎么收、终报怎么读、中断了怎么留档。
 *
 * spawnProc 适配器契约（宿主各写一个）：
 *   spawnProc({ argv, cwd, env, onStderrLine, onStdoutChunk })
 *     → { done: Promise<{ exitCode }>, terminate(): void }
 * done 在进程退出后 settle；terminate 必须能杀整棵进程树。
 */

import { basename, dirname, join } from 'node:path';
import { mkdir, open, readFile, stat, writeFile } from 'node:fs/promises';
import { readdir, unlink } from 'node:fs/promises';

/** 单轮干跑通常秒级；par/fork 重试链可能慢（实测 139s），给 180s 上限。 */
export const DEBUG_TIMEOUT_MS = 180_000;
/** 回传主模型的流水行数上限：超了中段省略（首 600 + 尾 900），完整流水在
 *  jsonl 落盘路径里——剪掉的是重复噪音，不是信息源。 */
const TRANSCRIPT_MAX_LINES = 1500;
const TRANSCRIPT_HEAD_LINES = 600;
/** stderr 回传上限（编译失败的 SyntaxError 原话在 traceback 末尾）。 */
const STDERR_MAX_CHARS = 2000;
/** 终报渲染上限（变量快照/提示逐条列，超了截断并注明总数）。 */
const REPORT_SNAPSHOT_MAX = 40;
const REPORT_WARNING_MAX = 20;

// ── 参数归一（工具/HTTP 两条入口共用同一口径）──────────────────────────

/** runs 钳制：NaN/0/负数 → 1，上限 20（与前端按钮同口径）。 */
export function clampRuns(value) {
  return Math.min(Math.max(Math.trunc(Number(value)) || 1, 1), 20);
}

/** seed 归一：非有限数一律当"没给"（调试器自选随机种子）。 */
export function normalizeSeed(value) {
  return value !== undefined && value !== null && Number.isFinite(Number(value))
    ? Math.trunc(Number(value))
    : undefined;
}

/** module 归一：剥空白与 '&' 前缀（用户习惯 &Mod 引用）；空串当"没给"
 *  （=整个FEMO脚本）。合法性（段存在/嵌套路径）交给调试器编译时响亮校验。 */
export function normalizeModule(value) {
  const s = typeof value === 'string' ? value.trim().replace(/^&+/, '') : '';
  return s.length > 0 ? s : undefined;
}

// ── 单飞闸：同一宿主实例同时只跑一条干跑 ─────────────────────────────

let inFlight = false;

/** 占闸。返回 false = 已有干跑在进行（调用方明确报错）。 */
export function acquireDebugRun() {
  if (inFlight) return false;
  inFlight = true;
  return true;
}

/** 放闸（finally 里必须调）。 */
export function releaseDebugRun() {
  inFlight = false;
}

// ── 沙盒与 argv ─────────────────────────────────────────────────────

/** 干跑沙盒滚动清理：删除 mtime 超过 24 小时的旧文件（web-* 三件套与 run-*.wor）。
 *  2026-09-12 由「只建不删」改制——只增不减的沙盒会无限长胖；2026-09-25
 *  保 3 天收紧为 24 小时，与 cache/logs 口径对齐。单文件失败不阻断；
 *  整体失败不影响干跑主路。 */
async function sweepDebugSandbox(sandboxDir, keepHours = 24) {
  try {
    const cutoff = Date.now() - keepHours * 3600_000;
    for (const name of await readdir(sandboxDir)) {
      const fp = join(sandboxDir, name);
      try {
        const st = await stat(fp);
        if (st.isFile() && st.mtimeMs < cutoff) await unlink(fp);
      } catch { /* 单文件失败不阻断 */ }
    }
  } catch { /* 清理失败不影响干跑主路 */ }
}

/**
 * 沙盒装配：FEMO脚本落 cache/debug-sandbox/web-<ts>.femo（与 femo_debugger 的
 * DB 沙盒同目录，滚动保留 24 小时）；流水落 web-<ts>.jsonl、终报落
 * web-<ts>.report.json，都留档可查。
 */
export async function prepareDebugSandbox(femoRoot, req) {
  const sandboxDir = join(femoRoot, 'cache', 'debug-sandbox');
  await mkdir(sandboxDir, { recursive: true });
  void sweepDebugSandbox(sandboxDir);
  const stamp = Date.now();
  const sandboxScript = join(sandboxDir, `web-${stamp}.femo`);
  const logPath = join(sandboxDir, `web-${stamp}.jsonl`);
  const reportPath = join(sandboxDir, `web-${stamp}.report.json`);
  await writeFile(sandboxScript, req.femo, 'utf8');
  return { sandboxScript, logPath, reportPath };
}

/**
 * 调试器 argv 组装（python 可执行之后的部分）。code: file:"xxx.py" 相对
 * 引用的解析目录：带了FEMO脚本原路径就按其所在目录解析（目录不存在则回退
 * 沙盒目录——引用会 404，但报错经 run_end 响亮抵达，不静默）。
 * 返回 { argv, note }，note = 回退等值得日志的一句话（无则 undefined）。
 */
export async function buildDebuggerArgv({ femoRoot, sandbox, req, runs, seed, module }) {
  const argv = [
    join(femoRoot, 'femo2host', 'femoToolcall', 'femo_debugger.py'),
    'run', sandbox.sandboxScript,
    '--quiet', '--log-jsonl', sandbox.logPath,
    // 终报 JSON：工具路径的唯一权威汇总（人读版 print_report 只进 stdout）。
    '--report', sandbox.reportPath,
    '--runs', String(clampRuns(runs)),
  ];
  let note;
  const savedScriptPath = req.scriptPath?.trim() ?? '';
  if (savedScriptPath.length > 0) {
    const dir = dirname(savedScriptPath);
    try {
      await stat(dir);
      argv.push('--base-dir', dir);
    } catch {
      note = `scriptPath 目录不存在，回退沙盒解析: ${dir}`;
    }
  }
  const seedNorm = normalizeSeed(seed);
  if (seedNorm !== undefined) argv.push('--seed', String(seedNorm));
  // 模块单测：调试器合成 wrapper 直进被测模块，嵌套用点路径；未知模块
  // 调试器响亮报错。
  const debugModule = normalizeModule(module);
  if (debugModule !== undefined) argv.push('--module', debugModule);
  return { argv, note };
}

// ── 整跑收集（监工主路）────────────────────────────────────────────

/**
 * 整跑收集一条干跑（工具路径）：起子进程 → 看门狗 → 收流水 + 终报 + stderr。
 * dsh 与 zcode 的 femo-debug 工具共用；DSH 的 HTTP 流式调试窗不走这里
 * （它自己 tail JSONL 转发），但与这里共用单飞闸与沙盒/argv 装配。
 *
 * 参数：
 *   femoRoot  引擎根（沙盒与调试器 CLI 的定位基准）
 *   spawnProc 宿主 spawn 适配器（见文件头契约）
 *   req       { femo, scriptPath?, module?, runs?, seed? }
 *   signal    可选中止信号（工具被取消→terminate，不留僵尸 python）
 *   onProgress 可选 (msg: string) => void：起跑/收尾两条诊断（人看的观测，
 *              不进模型上下文——多轮干跑是线性叠加，观者需分辨「在跑」与「死了」）
 * 返回 DebugRunCollect 形状（见 debugRunToolOutcome）。
 */
export async function collectDebugRun({ femoRoot, spawnProc, req, signal, onProgress, timeoutMs }) {
  const runs = clampRuns(req.runs);
  const seed = normalizeSeed(req.seed);
  const budget = timeoutMs ?? DEBUG_TIMEOUT_MS;
  // 调用方已经撤销（工具 round 被中断/用户按了停止）：别再起子进程——
  // 起了也留不住结果，只会白跑一次、把单飞闸占住直到跑完。
  if (signal?.aborted === true) {
    return emptyCollect(runs, seed);
  }
  if (!acquireDebugRun()) {
    throw new Error('已有调试干跑在进行中（调试窗或另一次 femo-debug 调用），请等它结束再试');
  }
  const startedAt = Date.now();
  let timedOut = false;
  let aborted = false;
  let proc;
  const onAbort = () => {
    aborted = true;
    try { proc?.terminate(); } catch { /* 已退出则忽略 */ }
  };
  try {
    const sandbox = await prepareDebugSandbox(femoRoot, req);
    const { argv, note } = await buildDebuggerArgv({ femoRoot, sandbox, req, runs, seed, module: req.module });
    if (note !== undefined) onProgress?.(note);
    const err = [];
    const out = [];
    try {
      proc = spawnProc({
        argv,
        cwd: femoRoot,
        env: { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
        onStderrLine: line => err.push(line),
        onStdoutChunk: text => out.push(text),
      });
    } catch (error) {
      throw new Error(`调试器子进程启动失败: ${String(error)}`);
    }
    if (signal !== undefined) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    onProgress?.(`干跑启动：${runs} 轮${seed !== undefined ? `，seed=${seed}` : ''}（沙盒脚本 ${basename(sandbox.sandboxScript)}）`);
    const done = proc.done.then(outcome => outcome, () => undefined);
    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.terminate(); } catch { /* 已退出则忽略 */ }
    }, budget);
    let outcome;
    try {
      outcome = await done;
    } finally {
      clearTimeout(timer);
    }
    const exitCode = outcome?.exitCode ?? -1;

    // ── 收账：流水 JSONL（半行=终止时最后一行不完整，丢弃不谎报）+ 终报 ──
    const rawLog = await readFile(sandbox.logPath, 'utf8').catch(() => '');
    const records = [];
    for (const line of rawLog.split(/\r?\n/)) {
      if (line.trim().length === 0) continue;
      try {
        records.push(JSON.parse(line));
      } catch { /* 截断的半行：跳过（不计入流水行数） */ }
    }
    let report;
    try {
      report = JSON.parse(await readFile(sandbox.reportPath, 'utf8'));
    } catch { report = undefined; }

    const { lines, dropped } = debugTranscriptLines(records);
    const stderr = err.join('\n');
    const elapsedMs = Date.now() - startedAt;
    // 被中断（撤销/超时）但已产出流水：同目录留一份可读留档（.partial.md）。
    // 框架会把 aborted 的工具结果整条替换——数据实时产出了却没人看到；
    // 留档后用户/AI 都能按路径把它捞出来。
    let partialPath;
    if ((aborted || timedOut) && lines.length > 0) {
      partialPath = sandbox.logPath.replace(/\.jsonl$/, '.partial.md');
      const header = `# 干跑被中断时的部分信息（${aborted ? '调用方撤销（回合被中断/用户停止）' : '看门狗超时强制终止'}）\n\n`
        + `- 沙盒FEMO脚本：${sandbox.sandboxScript}\n- 原始流水(JSONL)：${sandbox.logPath}\n`
        + `- 用时：${(elapsedMs / 1000).toFixed(1)}s　流水：${records.length} 条\n`
        + `- 终报：未生成（引擎未跑完，没有 --report 产出）\n\n## 流水（与调试窗同款渲染）\n\n`;
      try {
        await writeFile(partialPath, header + lines.join('\n') + '\n', 'utf8');
      } catch {
        partialPath = undefined;   // 留档失败不拦主流程（原流水仍在）
      }
    }
    onProgress?.(`干跑结束：exit=${exitCode} 流水 ${records.length} 条 终报${report === undefined ? '无' : '有'}`
      + `${timedOut ? '（看门狗超时）' : ''}${aborted ? '（被撤销）' : ''} 用时 ${(elapsedMs / 1000).toFixed(1)}s`
      + `${partialPath !== undefined ? `　部分信息留档：${partialPath}` : ''}`);
    return {
      exitCode,
      timedOut,
      aborted,
      runs,
      ...(seed !== undefined ? { seed } : {}),
      elapsedMs,
      records,
      ...(report !== undefined ? { report } : {}),
      transcript: lines.join('\n'),
      transcriptDropped: dropped,
      ...(partialPath !== undefined ? { partialPath } : {}),
      stderr: stderr.length > STDERR_MAX_CHARS ? stderr.slice(-STDERR_MAX_CHARS) : stderr,
      sandboxScript: sandbox.sandboxScript,
      logPath: sandbox.logPath,
      reportPath: sandbox.reportPath,
    };
  } finally {
    releaseDebugRun();
    if (signal !== undefined) signal.removeEventListener('abort', onAbort);
  }
}

/** 空结果（调用方在起子进程前就撤销了）：形状与真结果一致，让裁决函数
 *  统一按「没跑起来 + 被撤销」处理，不必在调用方分叉。 */
function emptyCollect(runs, seed) {
  return {
    exitCode: -1,
    timedOut: false,
    aborted: true,
    runs,
    ...(seed !== undefined ? { seed } : {}),
    elapsedMs: 0,
    records: [],
    transcript: '',
    transcriptDropped: 0,
    stderr: '',
    sandboxScript: '',
    logPath: '',
    reportPath: '',
  };
}

// ── 流水渲染 / 终报格式化 / 工具结果裁决 ───────────────────────────

/**
 * DebugLogBus 记录 → 一行可读流水。与调试窗同款语义（同一套 kind、同一套
 * 丢弃规则）：edge 高频噪音不上流水（边覆盖在终报里给全）、flow_outcome 与
 * run_end 重复、debug_done 是收尾哨兵。返回 null = 这条不上流水。
 */
export function formatDebugRecordLine(rec) {
  const s = value => (value === undefined || value === null ? '' : String(value));
  switch (rec.kind) {
    case 'run_start':
      return `▶ 第 ${s(rec.run) || '-'} 轮干跑开始：${s(rec.script) || '（未命名）'}`
        + `${rec.module ? `（module ${s(rec.module)}）` : ''}（seed=${s(rec.seed) || '-'}）`;
    case 'node_start':
      return `→ ${s(rec.node)}${rec.node_type ? `（${s(rec.node_type)}）` : ''}`;
    case 'action_outs': {
      const exprs = Array.isArray(rec.exprs) ? rec.exprs.map(String).join('，') : '';
      if (exprs.length === 0) return null;
      return rec.node_type === 'func'
        ? `🔧 ${s(rec.node)} 写回：${exprs}`
        : `📝 ${s(rec.node)} 赋值：${exprs}`;
    }
    case 'func_result': {
      const out = rec.output === null || rec.output === undefined
        ? ''
        : typeof rec.output === 'object' ? JSON.stringify(rec.output) : String(rec.output);
      if (out.length === 0) return null;
      let ins = '';
      const input = rec.func_input;
      if (input !== null && typeof input === 'object') {
        const keys = Object.keys(input);
        if (keys.length > 0) ins = `（入参 ${keys.map(k => `${k}=${JSON.stringify(input[k])}`).join('，')}）`;
      }
      return `🔧 ${s(rec.node)} 函数返回：${out.slice(0, 300)}${ins}`;
    }
    case 'assign':
      return `${s(rec.node)}  ${s(rec.var)}: ${s(rec.old)} → ${s(rec.new)}`;
    case 'ai_reply': {
      const values = rec.values ?? {};
      const entries = Object.entries(values);
      if (entries.length === 0) return null;
      return `🤖 ${s(rec.node)} 合成赋值：${entries.map(([k, v]) => `${k}=${s(v?.value)}（${s(v?.source)}）`).join('，')}`;
    }
    case 'human_input': {
      const parts = Object.entries(rec.variables ?? {}).map(([k, v]) => `${k}=${s(v)}`);
      if (parts.length === 0) return null;
      return `👤 ${s(rec.node)} 合成输入：${parts.join('，')}`;
    }
    case 'retry':
      return `🔁 ${s(rec.node)} 重试换值：${s(rec.feedback).slice(0, 160)}`;
    case 'silence':
      return `🎲 ${s(rec.node)} 概率沉默（不赋值 ${s(rec.var)}）`;
    case 'flaky':
      return `💥 ${s(rec.node)} 注入无效赋值（测重试链路）`;
    case 'warning':
      return `⚠ ${s(rec.msg)}`;
    case 'flow_outcome':
      return null;   // run_end 已带结局，不重复
    case 'run_end':
      return `${rec.outcome === 'completed' ? '■' : '❌'} 第 ${s(rec.run) || '-'} 轮结束：${s(rec.outcome)}`
        + `${rec.error ? ` — ${String(rec.error).slice(0, 200)}` : ''}（${s(rec.elapsed) || '?'}s）`;
    case 'debug_done':
      return null;   // 退出码语义见终报尾部说明；真崩溃经 stderr/退出码表达
    case 'debug_error':
      return `❌ ${s(rec.error)}`;
    default:
      return null;
  }
}

/** 流水行（含超限时的中段省略：首段 + 尾段，尾部是结局/报错最密的区段）。 */
export function debugTranscriptLines(records) {
  const all = [];
  for (const rec of records) {
    const line = formatDebugRecordLine(rec);
    if (line !== null) all.push(line);
  }
  if (all.length <= TRANSCRIPT_MAX_LINES) return { lines: all, dropped: 0 };
  const tailCount = TRANSCRIPT_MAX_LINES - TRANSCRIPT_HEAD_LINES;
  const dropped = all.length - TRANSCRIPT_MAX_LINES;
  return {
    lines: [
      ...all.slice(0, TRANSCRIPT_HEAD_LINES),
      `…（中段 ${dropped} 行已省略——完整流水见 jsonl 落盘路径）…`,
      ...all.slice(all.length - tailCount),
    ],
    dropped,
  };
}

/** 退出码语义（femo_debugger CLI 契约，2026-09-12 起 max_steps 算可接受结局
 *  ——跑满步数预算未停=「可能是无限循环」，退出码 0 非错误）。 */
function exitCodeNote(exitCode) {
  return exitCode === 0 ? '0（全部轮次 completed，或 max_steps=可能是无限循环）'
    : exitCode === 2 ? '2（部分轮次 completed/max_steps）'
      : exitCode === 1 ? '1（无一轮可接受结局 / 编译或装配失败）'
        : `${exitCode}（非正常退出）`;
}

/** 终报 → 文本（节点顺序 / 边覆盖 / 变量快照 / 提示 / 未达节点）。 */
function formatReport(report, timeoutNote) {
  const lines = [];
  const okRuns = report.runs.filter(r => r.outcome === 'completed').length;
  const loopRuns = report.runs.filter(r => r.outcome === 'max_steps').length;
  // 各轮合计耗时（多轮=线性叠加；用户实测「AI 调一次等很久」就是 runs 开大的
  // 正常代价——把成本摆在结局行，模型下次自己就会掂量轮数）。
  const sumElapsed = report.runs.reduce((sum, r) => sum + (Number.isFinite(r.elapsed) ? r.elapsed : 0), 0);
  lines.push(`结局：${okRuns}/${report.runs.length} 轮 completed（各轮合计 ${sumElapsed.toFixed(1)}s）`
    + (loopRuns > 0 ? `，${loopRuns} 轮 max_steps（跑满步数预算未停——可能是无限循环，非错误）` : '')
    + `${timeoutNote !== undefined ? `　${timeoutNote}` : ''}`);
  if (report.module_mode) {
    lines.push(`范围：module ${report.module_mode}`
      + (report.module_has_out === false
        ? '（无 [OUT]/[BREAK] 出口——持续循环型设计，max_steps 属预期）'
        : ''));
  }
  for (const r of report.runs) {
    lines.push(`  seed=${r.seed}: ${r.outcome === 'max_steps' ? 'max_steps（可能是无限循环，非错误）' : r.outcome}`
      + (r.error ? ` — ${String(r.error).slice(0, 300)}` : '')
      + `（${r.elapsed}s）`);
  }
  if (report.node_order.length > 0) {
    lines.push(`节点执行（${report.node_order.length} 步）：${report.node_order.slice(0, 60).join(' → ')}`
      + (report.node_order.length > 60 ? ' …' : ''));
  } else {
    lines.push('节点执行：（无——一个节点都没跑到）');
  }
  const coverage = report.total_edges > 0
    ? `${report.edges_taken.length}/${report.total_edges} (${Math.round(report.edges_taken.length / report.total_edges * 100)}%)`
    : '0/0';
  lines.push(`边覆盖：${coverage}`);
  if (report.edges_taken.length > 0) {
    lines.push(`  走过的边：${report.edges_taken.slice(0, 40).join('，')}`
      + (report.edges_taken.length > 40 ? ` …共 ${report.edges_taken.length} 条` : ''));
  }
  if (report.var_snapshots.length > 0) {
    lines.push(`变量快照（${report.var_snapshots.length} 条）：`);
    for (const s of report.var_snapshots.slice(0, REPORT_SNAPSHOT_MAX)) {
      lines.push(`  ${String(s.node)}  ${String(s.var)}: ${String(s.old)} → ${String(s.new)}`);
    }
    if (report.var_snapshots.length > REPORT_SNAPSHOT_MAX) {
      lines.push(`  …（还有 ${report.var_snapshots.length - REPORT_SNAPSHOT_MAX} 条）`);
    }
  }
  const warnings = [
    ...report.guess_warnings,
    ...report.silences.map(s => `概率沉默: ${s}`),
    ...report.flaky_fired.map(s => `flaky 无效赋值: ${s}`),
  ];
  if (warnings.length > 0) {
    lines.push(`⚠ 提示 ${warnings.length} 条（调试器猜值降级/兜底/概率沉默等）：`);
    for (const w of warnings.slice(0, REPORT_WARNING_MAX)) lines.push(`  • ${w}`);
    if (warnings.length > REPORT_WARNING_MAX) lines.push(`  …（还有 ${warnings.length - REPORT_WARNING_MAX} 条）`);
  }
  const unreached = report.unreached_nodes ?? [];
  if (unreached.length > 0) {
    lines.push(`未达节点（本次一次没走到——死分支/漏接线/条件永远为假）：${unreached.join('，')}`);
  }
  return lines;
}

/**
 * 工具结果裁决 + 完整文本：
 *  - 干跑完全没跑起来（无流水、无终报、非零退出）= 编译/装配失败 → ok:false，
 *    把 stderr 末尾的异常原话（如 SyntaxError: 条件 "y == 1" 引用了未声明的
 *    变量…）放在最前，traceback 尾巴附后；
 *  - 其余（含超时、跑挂的轮次）都有信息可回 → ok:true，流水 + 终报全文。
 */
export function debugRunToolOutcome(result) {
  const stderrTail = result.stderr.trim();
  if (result.records.length === 0 && result.report === undefined && result.exitCode !== 0) {
    if (result.aborted) {
      // 收窄口径（用户指正 2026-09-11）：干跑数据是实时产的，中途被撤销时上面
      // 那条 records>0 分支会把已产出的流水照常回传——走到这里只可能是「还没
      // 写出任何一条流水就被撤销」（起步阶段/主会话未装载等），别一律说"没有
      // 产生调试数据"（那会冤枉整条链路）。
      return {
        ok: false,
        error: '本次干跑在产出任何流水之前就被撤销（回合被中断/用户停止；也可能卡在起跑阶段——看诊断流的「干跑启动」那行有没有出现）。'
          + '需要结果的话重新调用一次（轮数别开太大：runs 是线性耗时，每轮≈一次调试窗调试）。',
      };
    }
    const errorLine = stderrTail.split('\n').reverse()
      .find(line => /^[A-Za-z_][\w.]*(Error|Exception|Warning)?:\s/.test(line.trim()))?.trim();
    return {
      ok: false,
      error: `干跑未能跑起来（退出码 ${result.exitCode}）——`
        + `${result.timedOut ? '看门狗超时强制终止' : '编译/装配错误原话'}：\n`
        + (errorLine !== undefined ? `${errorLine}\n\n` : '')
        + (stderrTail.length > 0 ? stderrTail : '（stderr 为空——可直接跑「编译」看报错）'),
    };
  }

  const parts = [];
  parts.push('📋 FEMO脚本干跑（零 token 空跑：AI/人类节点全部由调试器合成替答，未调用任何模型）');
  parts.push('');
  if (result.aborted) {
    parts.push('⏹ 本次干跑被调用方撤销（回合被中断/用户停止）；**已实时产出的流水照常回传在下方**'
      + '——注意：框架会把 aborted 的工具结果整条替换成 "tool call aborted"，这种时候这份数据到你手里可能已经丢了，'
      + (result.partialPath !== undefined
        ? `可让用户按留档路径直接读：${result.partialPath}`
        : '沙盒里的原始 JSONL 仍在。'));
    parts.push('');
  }
  if (result.timedOut) {
    parts.push(`⏱ 干跑超时（${DEBUG_TIMEOUT_MS / 1000}s 看门狗）已强制终止——疑似死循环，或 par/fork 重试链太慢；以下是终止前跑出的部分信息。`);
    parts.push('');
  }
  if (result.report !== undefined) {
    parts.push(...formatReport(result.report, undefined));
  } else {
    // 终报缺席但流水在（超时/被撤销）：从 run_end 记录拼结局，诚实标注。
    const ends = result.records.filter(r => r.kind === 'run_end');
    parts.push(`结局：终报未生成（干跑未正常跑完）${ends.length > 0 ? '；已跑完的轮次：' : ''}`);
    for (const e of ends) {
      parts.push(`  第 ${String(e.run ?? '-')} 轮：${String(e.outcome ?? '?')}`
        + (e.error ? ` — ${String(e.error).slice(0, 300)}` : '')
        + `（${String(e.elapsed ?? '?')}s）`);
    }
  }
  parts.push('');
  const transcriptLines = result.transcript.length > 0 ? result.transcript.split('\n').length : 0;
  parts.push(`──── 调试流水（${transcriptLines} 行${result.transcriptDropped > 0 ? `，中段省略 ${result.transcriptDropped} 行` : ''}）────`);
  parts.push(result.transcript.length > 0 ? result.transcript : '（无流水记录——先看上面的结局/报错）');
  parts.push('');
  parts.push(`退出码 ${exitCodeNote(result.exitCode)}`
    + `　·　用时 ${(result.elapsedMs / 1000).toFixed(1)}s`
    + `　·　沙盒FEMO脚本：${result.sandboxScript}`
    + `　·　完整流水(JSONL)：${result.logPath}`
    + (result.partialPath !== undefined ? `　·　部分信息留档：${result.partialPath}` : '')
    + (result.report !== undefined ? `　·　终报(JSON)：${result.reportPath}` : ''));
  if (result.stderr.trim().length > 0 && result.report === undefined) {
    parts.push('');
    parts.push(`引擎 stderr 尾部（诊断用）：\n${result.stderr.trim().slice(-800)}`);
  }
  return { ok: true, text: parts.join('\n') };
}
