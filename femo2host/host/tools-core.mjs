/**
 * tools-core.mjs — femo 主模型工具「总纲」（host 无关公共层，femo2host）。
 *
 * 七个工具（mount/run/script/soul/chronica/debug）里「决定做什么」的部分
 * 全部只写这一份（2026-09-15 从 zcodeAdapter/mcp/femo-server.mjs 与
 * dshAdapter/host/tools.ts 合并抽出）：
 *   - buildToolSpecs({ host })：工具名、给模型看的描述文案、参数 schema——
 *     一份；host 只影响附加说明段（各家运行通道提示不同）。
 *   - 参数归一/校验：runs/seed/module/chronica/soul 的裁决口径一份。
 *   - createBridgeToolImpls({...})：直连桥形态的完整执行体（zcode 用）——
 *     挂载状态、启动运行/暂停/续跑、角色库、台账查询、干跑全在里面。
 *   - 干跑经 debug-run-core.collectDebugRun（监工核心）。
 *
 * 宿主各留各的「从哪个门进出」：zcode 在 femo-server.mjs 把总纲注册进
 * MCP stdio 协议面；dsh 的 mount/run/script 是会话型（挂载写会话记录、
 * 启动运行走 startJobOnSession、结果进投影窗），在 tools.ts 用自己的依赖注入
 * 实现，但规格与归一口径仍取自本文件——两边不会再各自漂移。
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectDebugRun, debugRunToolOutcome, normalizeModule } from './debug-run-core.mjs';
import { preferenceSet, preferencesView } from './cast-core.mjs';
import { resolveAndPauseJob } from './run-control-core.mjs';
import { findMountRecord, mountLedgerPath, removeMountRecord, upsertMountRecord } from './mount-registry.mjs';

// ═══ 已退役（观察期起 2026-09-27 femo2host 死代码排查，全仓零引用；观察无误后连块删除）：再导出面 export { clampRuns, normalizeModule, normalizeSeed }（无人从 tools-core 导入这三个名字，dsh debug-run.ts 直接从 debug-run-core 再导出；三符号本体在 debug-run-core 活着，上方 import 已随之收紧） ═══
// export { clampRuns, normalizeModule, normalizeSeed };

// ── 工具规格（name / description / parameters）───────────────────────

/**
 * @param {{ host: 'dsh' | 'zcode', possess?: boolean }} opts
 * 返回 [{ name, description, parameters, required? }]。name 统一 snake_case
 * （与引擎协议一致）；dsh 注册时自行转 dash 风格。参数名统一 snake_case
 * （2026-09-15 起 dsh 的 scriptPath 也改为 script_path——preset 只教工具名，
 * 不教参数名，无回归面）。possess=true 才附上 femo_possess 规格（附身能力
 * 需宿主注入会话身份/运行态，见 createBridgeToolImpls 的 opts.possess）。
 */
export function buildToolSpecs({ host, possess = false }) {
  const dsh = host === 'dsh';
  const specs = [
    {
      name: 'femo_mount',
      description: dsh
        ? '把脚本文件挂载到当前 Femo 会话：用户会在 femogen 编辑器里立刻看到这个FEMO脚本，可以查看/编辑。'
          + '写脚本时用文件工具把 .femo 写到 user_data/projects/ 下，然后调用本工具挂载。'
          + '参数 script_path 是脚本文件的完整路径。'
        : '把FEMO脚本挂载到当前 Femo 运行时（编译校验）。'
          + '写脚本时用文件工具把 .femo 写到 user_data/projects/ 下，然后调用本工具挂载；未保存的脚本文本也可用 femo_text 直接传。'
          + '挂载后用 femo_run 启动运行。',
      parameters: {
        type: 'object',
        properties: {
          script_path: { type: 'string', description: '脚本文件完整路径（.femo）' },
          ...(dsh ? {} : {
            femo_text: { type: 'string', description: '脚本文本（未保存时用；与 script_path 二选一）' },
          }),
        },
      },
      required: dsh ? ['script_path'] : undefined,
    },
    {
      name: 'femo_run',
      description:
        '控制当前运行时的FEMO 运行。action 必填，四选一：\n'
        + '- fresh_start：从头运行已挂载的脚本（上一次若挂起会自动存档，可续跑找回）；返回值带本次启动运行的 job_id\n'
        // 2026-09-24 B3 去 dsh 门控：job_id 强停三宿主通用（impl 走
        // run-control-core 引擎档案裁决，归属+状态预检；zcode/autoclaw 同享）。
        + '- pause：暂停并挂起正在运行的脚本（断点保留，可 resume 续跑）；缺省自动停本宿主正在跑的 Job，也可带 job_id 强制暂停指定 Job（前后端状态混乱时的强停入口；list_jobs 可查 job_id）\n'
        + '- resume：从挂起处续跑，必须带 job_id 指名要续跑哪个 Job（六关裁决，改了FEMO脚本/无断点会明确报错）\n'
        + '- list_jobs：列出全部 Job（状态/场次——查找挂起 Job 的 job_id 用）\n'
        + (dsh
          ? '运行后FEMO 由引擎驱动，角色发言显示在投影窗，不进入你的上下文；'
            + '编译错误随本工具返回值给出；跑到一半报错或全部跑完时，会有一条 [femo-plugin] 开头的插件消息直接发进你的对话流。'
          : '运行由引擎驱动；启动后按本宿主的运行循环推进演出（轮到角色发言时，信会经驿站送达本会话），详见 skills/femo/SKILL.md。'),
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['fresh_start', 'pause', 'resume', 'list_jobs'],
            description: '对FEMO 运行的控制动作：fresh_start=从头运行 / pause=暂停并挂起 / resume=从挂起处续跑 / list_jobs=列出全部 Job',
          },
          job_id: {
            type: 'number',
            description: 'resume 必填：要续跑的 Job 编号（先 list_jobs 查询）。pause 可选：强制暂停指定 Job。fresh_start / list_jobs 不需要传本参数',
          },
          session: {
            type: 'string',
            description: '（拉取宿主建议携带，dsh 不需要）开演/续跑方会话号：终端 `echo $CLAUDE_SESSION_ID` 取值原样带回。信封按（宿主,会话号）双词对号投递——不带号的会话领不到带号信，续跑时也是收养改贴号的凭证',
          },
        },
        required: ['action'],
      },
    },
    {
      name: 'femo_debug',
      description:
        '零 token 空跑（干跑）当前挂载的脚本：不调用任何 AI/人类——所有 AI 动作与人类输入由调试器合成替答，'
        + '引擎按真实管线（赋值校验/条件边/循环/并行/模块/@func）跑完整流程。\n'
        + '用途：正式运行前自检FEMO脚本——语法与接线、分支走向、变量赋值、循环能不能退出、死循环、一次都没走到的节点，'
        + '都能从返回里看出来。写完或改完FEMO脚本先干跑一遍，有问题照着流水改，改完再跑，直到干跑干净再 femo_run。\n'
        + '脚本分模块时，可用 module 参数只干跑某个模块（模块单测，嵌套用点路径 外层.内层）——改了哪个模块就先单测哪个，再跑整个FEMO脚本。\n'
        + '返回：①逐条调试流水（节点进出、变量 old→new、合成赋值与来源、重试、告警）；'
        + '②终报（每轮结局与报错、节点执行顺序、边覆盖、变量快照 diff、未达节点）。编译失败时把编译器报错原话返回。\n'
        + '特性：不占 Job、不写生产台账（独立 DB 沙盒）'
        + (dsh ? '、可与正式运行并行、同一时刻只允许一条干跑（调试窗正在跑时会明确报错）' : '、可反复调用')
        + '；耗时：小脚本几秒，大脚本每轮可能十几秒，runs 线性叠加——先单轮跑通，确要撞随机分支再加轮数。'
        + (dsh ? '跑的是「当前挂载的脚本」（挂载后改动要重新挂载）；合成输入是调试器按声明猜的，只验证流程不代表内容质量。' : ''),
      parameters: {
        type: 'object',
        properties: {
          runs: { type: 'number', description: '跑几轮（可选；默认 1，上限 20）。每轮换种子——多跑几轮能撞出概率型分支/随机沉默的路径。注意耗时线性叠加' },
          seed: { type: 'number', description: '起始随机种子（可选；同一个 seed 可复现同一次干跑，排查随机分支时用）' },
          module: {
            type: 'string',
            description: '只干跑某个 module（可选；模块单测）。传脚本里的模块名，嵌套模块用点路径如 外层.内层。'
              + (dsh
                ? '只跑该模块自己的流程（合成 wrapper 直进，母链变量与全局变量照常可见），终报的边覆盖/未达节点也按该模块自己的 flow 算。'
                  + '持续循环型模块（无 [OUT]/[BREAK] 出口）跑满步数预算即停，max_steps 结局不算错误。'
                : '')
              + '缺省=跑整个FEMO脚本',
          },
        },
      },
    },
    {
      name: 'femo_script',
      description:
        '查看当前运行时挂载的脚本完整内容（最终生效版本）。返回脚本全文与来源。'
        + '写脚本/改脚本前先调用本工具，了解当前挂载的脚本是什么；'
        + (dsh ? '会话未挂载FEMO脚本时会明确报错。' : '未挂载FEMO脚本时会明确报错。'),
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'femo_soul',
      description:
        '管理角色库（souls）：\n'
        + '- list：查看库中全部角色（soul_id + 名字）。写脚本挑角色前先调用本工具查库；\n'
        + '- create：新建角色。参数 soul_id（脚本里用 soul:xxx 引用，不能含空格/逗号）、soul_name（显示名）；description（角色的灵魂设定，注入给运行该角色的 AI）可空——无设定的灵魂直接不传。\n'
        + '角色是全局的（所有FEMO脚本可用）。soul 非必须：无角色设定的简单FEMO脚本可以不写 soul；'
        + '需要角色设定的脚本，库里没有的角色先用本工具 create 新建，再在脚本里引用。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'create'], description: 'list=查看全部角色 / create=新建角色' },
          soul_id: { type: 'string', description: 'create 必填：角色唯一标识（脚本里 soul:xxx 引用；不能含空格/逗号）' },
          soul_name: { type: 'string', description: 'create 必填：角色显示名' },
          description: { type: 'string', description: 'create 可空：角色的灵魂设定（system prompt 片段，出演该角色的 AI 会看到）；不传=无设定空灵魂' },
        },
        required: ['action'],
      },
    },
    {
      name: 'femo_chronica',
      description:
        '查询 Femo 运行台账（Chronica.wor 编年史）：返回指定场次的【对话流】'
        + '（showprompt 旁白 + AI 发言 + 人类输入，按时间交织）与【幕后指令】附录（节点 prompt，不属对话流）。\n'
        + '- 无参数 = 最新一次的两大段全文——脚本跑完后看结果、复盘都用这个；\n'
        + '- list=只列最近 N 场一览（场次号/剧名/发言数，优先于 show）；\n'
        + '- show=指定场次号；scope=每行附带可见用户/可见角色（排查视野类问题用）；\n'
        + '- full=发言全文不截断（默认对话流行截 110 字、指令 90 字；细读诗作/长台词时开）。',
      parameters: {
        type: 'object',
        properties: {
          show: { type: 'number', description: '场次号（可选；缺省=最新一次）' },
          list: { type: 'number', description: '只列最近 N 场一览（可选；给了就忽略 show）' },
          scope: { type: 'boolean', description: '每行附带可见性信息（可选；排查视野类问题用）' },
          full: { type: 'boolean', description: '发言全文不截断（可选；默认截断）' },
        },
      },
    },
  ];
  if (possess) {
    // 附身（多主会话参与运行，2026-09-25；提名制 2026-09-26）：会话↔灵魂绑定。
    // 提名账（cast-preferences）在 hub，定格按「最后一次指派」选唯一演员，
    // 投递查每场选角账不查提名账；执行体需要宿主注入 possess 三件
    // （本会话身份/运行态/名册联动），见 createBridgeToolImpls 的 opts.possess。
    specs.push({
      name: 'femo_possess',
      description:
        '附身/解附身（多主会话参与运行）：把一个会话注册为某个灵魂（soul）的出演者——那个会话从此就是该角色本人。\n'
        + '- possess：附身。soul_id 必填（先 femo_soul list 查角色库）。开演定格后：脚本里该 soul 的 AI 角色轮到发言时，料包信直接送到那个会话（由它本尊出演该角色，保留其全部会话上下文），主Agent不再为它拉子代理；轮到发言时正常作答即可，所在宿主自动收卷交回引擎（无需调用任何工具或命令交卷）。\n'
        + '- release：解附身。退掉目标会话的这一票（可带 soul_id 核对）。\n'
        + '- session_id：可选，缺省=本会话；写别的会话 id 即替它分配角色（主Agent分配角色）。\n'
        + '- host：可选，缺省=本宿主；写别的宿主名即可跨宿主分配角色（前提：目标宿主已接入绑定账分流）。\n'
        + '规则：提名制——同一角色允许多个会话先后提名，最后一次指派算数，自下一次开演定格起生效（演出中改提名不影响在跑的戏，本会话演出中不许改）；human 角色不可附身。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['possess', 'release'], description: 'possess=附身（会话成为该 soul 的出演者）/ release=解附身' },
          soul_id: { type: 'string', description: 'possess 必填：要附身的灵魂 id（femo_soul list 查得）；release 可选（核对该会话当前绑定）' },
          session_id: { type: 'string', description: '可选：目标会话 id。缺省=本会话；写别的会话 id 即替它附身/解附身（主Agent分配角色）' },
          host: { type: 'string', description: '可选：目标会话所在宿主。缺省=本宿主；写别的宿主名即可跨宿主分配角色' },
        },
        required: ['action'],
      },
    });
  }
  return specs;
}

// ── 参数归一 / 校验（两个宿主同一口径）───────────────────────────────

/** chronica 参数归一：非有限数/非法布尔一律丢弃。返回 {show?, list?, scope?, full?}。 */
export function normalizeChronicaOpts(args) {
  const opts = {};
  if (typeof args.show === 'number' && Number.isFinite(args.show)) opts.show = Math.trunc(args.show);
  if (typeof args.list === 'number' && Number.isFinite(args.list) && args.list > 0) opts.list = Math.trunc(args.list);
  if (args.scope === true) opts.scope = true;
  if (args.full === true) opts.full = true;
  return opts;
}

/** chronica.py CLI 参数（能力只有一份：femo2host/femoToolcall/chronica.py）。 */
export function chronicaCliArgs(opts) {
  const cli = [];
  if (opts.list !== undefined) cli.push('--list', String(opts.list));
  else if (opts.show !== undefined) cli.push(String(opts.show));
  if (opts.scope === true) cli.push('--scope');
  if (opts.full === true) cli.push('--full');
  return cli;
}

/** femo_soul create 参数裁决。返回 null=合法；字符串=错误原话。
 *  description 可空（2026-09-27 作者拍板：允许无设定的空灵魂），缺省落空串。 */
export function validateSoulCreate(args) {
  const soulId = typeof args.soul_id === 'string' ? args.soul_id.trim() : '';
  const soulName = typeof args.soul_name === 'string' ? args.soul_name.trim() : '';
  const description = typeof args.description === 'string' ? args.description : '';
  if (soulId.length === 0 || soulName.length === 0) {
    return 'create 需要 soul_id / soul_name 两个参数（全部必填；description 可空）';
  }
  if (/[\s,，]/.test(soulId)) {
    return `soul_id "${soulId}" 不能含空格或逗号（脚本里 soul:xxx 引用用）`;
  }
  return null;
}

/** 剧本演员表解析（actors 区语法唯一一份）：提取「需要窗口出演」的 ai 角色
 *  [{actor, soul}]，soul 未写的为 null。source:main 是导演亲自出演，不算。
 *  纯函数：femoText → 名单，方便单测。消费方两处：开演校验（unboundActorSouls）
 *  与 web 宿主运行前点名（/seats/attendance 的 needed——点名只对这场戏要的
 *  灵魂负责，历史提名不拦路）。 */
export function scriptActorSouls(femoText) {
  const out = [];
  let inActors = false;
  for (const line of String(femoText ?? '').split(/\r?\n/)) {
    if (/^\s*(meta|actors|vars|code|mainflow|module|action)\s*:/.test(line) || /^action\s/.test(line)) {
      inActors = /^\s*actors\s*:/.test(line);
      continue;
    }
    if (!inActors) continue;
    const actor = line.match(/^\s*ai\s+@(\S+?)\s*=/);
    if (!actor) continue;
    if (/\bsource:\s*main\b/.test(line)) continue;   // 导演亲自出演
    out.push({ actor: actor[1], soul: line.match(/\bsoul:\s*([^\s,，]+)/)?.[1] ?? null });
  }
  return out;
}

/** 开演校验（无子代理化 2026-09-26）：剧本 ai 角色必须全部已提名——有 soul 的
 *  按 soul 查提名，裸 ai 角色直接算缺员，返回缺员描述数组（空=通过）。
 *  纯函数：femoText + 已提名 soul 数组 → 缺员数组，方便单测。 */
export function unboundActorSouls(femoText, nominatedSouls) {
  const bound = new Set(nominatedSouls);
  return scriptActorSouls(femoText).flatMap(({ actor, soul }) => {
    if (!soul) return [`角色@${actor} 在剧本里没有指定灵魂（soul），无法绑定窗口`];
    return bound.has(soul) ? [] : [`灵魂：${soul} （他在femo剧本中的角色名为@${actor}）`];
  });
}

// ── 直连桥形态的完整执行体（zcode 用；dsh 的会话型执行体自备）────────

/**
 * 挂载状态（运行时内一份）。挂载记录：{ femoText, scriptPath?, baseDir?, scriptName }。
 *
 * 挂载账本（2026-10-04 用户拍板「各家把挂载剧本的事儿都写到一处，写在一个
 * 文件里」）：opts 传 host（+session：会话型宿主传会话标识，服务级挂载传
 * null）+ femoRoot 时，挂载动作同步记进共同账本 <数据根>/mounts.json
 * （mount-registry.mjs；registryPath 仅测试注入用，传了 host 就必须二者居其
 * 一，缺了响亮报错——静默不记账比炸更糟）：按路径挂载成功记地址、文本挂载
 * 记文字、clear 撤本键记录。创建时从账本恢复本（host, session）的**地址挂载**
 * （指向的文件已不在盘上=撤账回未挂载；文本挂载是一次性的，不复活、记录
 * 留账）；恢复不做编译检查——不为恢复顺手拉引擎，挂载/开演时自有 check。
 * 不传 host 即旧形态（纯内存），零回归——zcode MCP 就地保持纯内存（多窗
 * 并存没有「唯一当前剧本」，跨窗语义未拍板不做）。挂载是宿主侧导演工作台
 * 状态，不是引擎状态；账本只做记录，活真相永远在各家内存里。
 */
export function createMountState(opts = {}) {
  const host = typeof opts.host === 'string' && opts.host.trim() ? opts.host.trim() : undefined;
  const session = opts.session === undefined ? null : opts.session;
  const sessionName = typeof opts.sessionName === 'string' && opts.sessionName.trim() ? opts.sessionName.trim() : undefined;
  if (host && !opts.registryPath && !opts.femoRoot) {
    throw new Error('createMountState：传了 host 就必须给 femoRoot 或 registryPath（挂载账本要落位），缺了响亮报错');
  }
  const ledgerPath = host ? (opts.registryPath ?? mountLedgerPath(opts.femoRoot)) : undefined;

  function mountedFromPath(p) {
    return {
      femoText: readFileSync(p, 'utf8'),
      scriptPath: p,
      baseDir: join(p, '..'),
      scriptName: p.split(/[\\/]/).pop(),
    };
  }
  function toLedger(entry) {
    if (!ledgerPath) return;
    try {
      upsertMountRecord({ host, session, sessionName, ...entry }, ledgerPath);
    } catch { /* 账本是记录不是正身：写失败不挡挂载本身（服务日志同款取舍） */ }
  }
  function dropLedger() {
    if (!ledgerPath) return;
    try { removeMountRecord(host, session, ledgerPath); } catch { /* 同上，不挡主流程 */ }
  }
  function restoreFromLedger() {
    if (!ledgerPath) return undefined;
    let rec;
    try {
      rec = findMountRecord(host, session, ledgerPath);
    } catch {
      return undefined; // 账本读不了：回到未挂载（挂载/开演时自有 check 把关）
    }
    if (!rec) return undefined;
    if (typeof rec.femo_text === 'string' && rec.femo_text) return undefined; // 文本挂载一次性：不复活
    const p = rec.script_path;
    if (typeof p !== 'string' || !p || !existsSync(p)) {
      dropLedger(); // 指向的文件没了：这笔账已死，撤掉
      return undefined;
    }
    return mountedFromPath(p);
  }

  let mounted = restoreFromLedger();
  return {
    get: () => mounted,
    /** 读文件挂载（文件不存在返回错误对象；调用方直接回传）。 */
    mountFromPath(scriptPath) {
      const p = typeof scriptPath === 'string' ? scriptPath : '';
      if (!p || !existsSync(p)) return { error: `脚本文件不存在：${p || '(未提供)'}` };
      mounted = mountedFromPath(p);
      toLedger({ scriptPath: p });
      return null;
    },
    mountFromText(femoText) {
      mounted = { femoText, scriptPath: undefined, baseDir: undefined, scriptName: 'unsaved' };
      toLedger({ femoText });
    },
    /** 跑前对盘（2026-10-01 用户拍板「缓存的是 path」）：有 path 的挂载在用之前
     *  重读文件现稿——挂载之后改了剧本，运行跑的就是改后版，不必重新挂载。
     *  path 是事实源：文件没了响亮报错，不许拿旧稿假装没事。femo_text 挂载
     *  没有 path，保持原稿（调用方原地改 mounted.femoText，拿到的引用仍是
     *  新稿）。返回 null=已对齐；{error}=响亮报错对象。 */
    freshen() {
      if (!mounted?.scriptPath) return null;
      const p = mounted.scriptPath;
      if (!existsSync(p)) return { error: `脚本文件读不到了：${p}（挂载之后被删除或移动了？）` };
      mounted.femoText = readFileSync(p, 'utf8');
      return null;
    },
    clear() { mounted = undefined; dropLedger(); },
  };
}

/**
 * 直连桥形态的六个工具执行体。参数：
 *   ensureBridge   async () => void（桥没起则拉起并等就绪）
 *   actorAdmission 'nominated'（缺省，开演校验提名）| 'auto-seat'（席位自动立，
 *                  免校验——autoclaw 演出形态）
 *   send           (cmd, args, timeoutMs) => Promise（桥命令）
 *   femoRoot       引擎根（调试器/台账 CLI 定位）
 *   hostRef        job_start 的 host_ref 标签（如 'zcode-femo'）
 *   spawnPython    async (cliArgs: string[], timeoutMs: number) => { output, exitCode }
 *                  —— python 一次性子进程（台账查询用）；env 由宿主补 UTF-8
 *   debugSpawnProc 干跑监工的 spawn 适配器（见 debug-run-core.mjs 文件头契约）
 *   onProgress     可选，干跑进度诊断（人看）
 * 每个执行体 async (args) => 结果对象；错误统一 { error: 原话 }。
 */
export function createBridgeToolImpls(opts) {
  const { ensureBridge, send, femoRoot, host, hostRef, spawnPython, debugSpawnProc, onProgress, possess } = opts;
  // 开演准入形态：'nominated'（缺省）=剧本 ai 角色须全部已提名才准开演；
  // 'auto-seat'=席位由宿主按信自动立起（autoclaw），免校验。
  const actorAdmission = opts.actorAdmission === 'auto-seat' ? 'auto-seat' : 'nominated';
  // 选角账读取口（测试注入口；缺省=hub 正身账）
  const castView = opts.castView ?? preferencesView;
  const mounts = opts.mounts ?? createMountState();
  const state = { lastJobId: undefined }; // femo_run 专用：最近一次启动运行/续跑的 Job
  const runNextHint = opts.runNextHint;

  async function requireMounted() {
    const m = mounts.get();
    if (!m) return [null, { error: '尚未挂载FEMO脚本：先调 femo_mount。' }];
    return [m, null];
  }

  const impls = {
    mounts,

    async femo_mount(args) {
      const femoText = typeof args.femo_text === 'string' ? args.femo_text : '';
      try {
        if (!femoText) {
          const err = mounts.mountFromPath(args.script_path);
          if (err) return err;
        } else {
          mounts.mountFromText(femoText);
        }
        const m = mounts.get();
        const check = await ensureBridge().then(() => send('check', { femo: m.femoText, base_dir: m.baseDir ?? null }, 20_000));
        // path=绝对地址（femo_text 挂载没有=undefined）：宿主展示层「已挂载：」跟它
        // ——用户对的是文件，不是文件名，更不是编译器内部话。
        return { mounted: true, script: m.scriptName, path: m.scriptPath ?? undefined, compile: check ?? 'ok' };
      } catch (e) {
        mounts.clear();
        return { error: `编译失败：${String(e).slice(0, 400)}` };
      }
    },

    async femo_run(args) {
      await ensureBridge();
      switch (args.action) {
        case 'fresh_start': {
          const [m, err] = await requireMounted();
          if (err) return err;
          // 跑前对盘：读文件现稿（fresh_start 只认盘上当下这一版；resume 不对盘
          // ——续跑对的是冻结档，中途改稿本就与档案对不上，引擎会响亮拒绝）。
          const fr = mounts.freshen();
          if (fr) return fr;
          // 开演校验（无子代理化 2026-09-26）：提名列名形态（zcode/web
          // ——角色必须绑定窗口/席位）下，剧本 ai 角色必须全部已提名，缺=响亮
          // 拒演列缺员——否则该角色信无人认领，引擎干等 3600s（静默卡死是纪律
          // 禁止的兜底形态）。auto-seat 形态（autoclaw——席位按 soul 自动立起，
          // 信到即演）没有「无人认领」态，不做此校验（2026-09-27 实测误伤修复）。
          if (actorAdmission === 'nominated') try {
            const view = await castView(femoRoot);
            const nominated = Object.keys(view.bindings ?? {});
            const missing = unboundActorSouls(m.femoText, nominated);
            if (missing.length > 0) {
              const empty = Object.keys(view.hosts ?? {}).length === 0
                ? '（提名账为空或投影中心不可达）' : '';
              return {
                error: `开演校验失败：还有几个灵魂没有绑定窗口！${empty}\n请再开几个会话，绑定以下这些灵魂：\n${missing.join('\n')}\n剧本中所有灵魂，都必须绑定窗口，才能开始运行。`,
              };
            }
          } catch (e) {
            return { error: `开演校验无法完成（选角账不可达）：${String(e).slice(0, 200)}` };
          }
          // 【刀2 双词寻址·命门】session=开演方会话号（模型经工具参数带回，
          // echo $CLAUDE_SESSION_ID）：盖进档案 host_refs 的导演格，产信端据此
          // 给 main 信贴会话号，钩子按号对领——不换真号，双词寻址空转。
          // host_ref 与导演格必须同值（引擎配对契约：_job_host/_director_sid/
          // post_speech 跨宿主反推全靠「host_ref ∈ host_refs.values()」定位
          // 发起方，2026-09-26 第3步实测：贴旧标签则产信收件宿主解析落空，
          // main 信寄去 daemon 占位格永无人领）。不带 session 时维持旧标签。
          const sessionTag = typeof args.session === 'string' ? args.session.trim() : '';
          const r = await send('job_start', {
            femo: m.femoText,
            base_dir: m.baseDir ?? null,
            script_path: m.scriptPath ?? '',
            script_name: m.scriptName,
            host_ref: sessionTag || hostRef,
            ...(sessionTag ? { host_refs: { [host]: sessionTag } } : {}),
            host_ai_backend: true, // AI 节点交宿主执行（子代理/主Agent），引擎不发直连
          }, 30_000);
          state.lastJobId = r.job_id;
          return { started: true, job_id: r.job_id, state: r.state, warnings: r.warnings, ...(runNextHint !== undefined ? { next: runNextHint } : {}) };
        }
        case 'pause': {
          // 2026-09-24 B3：停止运行裁决唯一活在 run-control-core.resolveAndPauseJob
          // （dsh run-control.pauseJobResolved 同吃一份）。旧版三病：只认进程内
          // lastJobId（MCP 重启即失忆，引擎确在跑也报「没有活动 Job」）、无条件
          // 包装 paused:true（引擎对 finished Job 也回 paused:true=误报成功）、
          // 忽略 job_id（dsh 门控）。现走引擎档案：显式 job_id=归属+状态预检，
          // 缺省=本宿主 running 档案兜底（无镜像快路径，档案即真相）。
          const outcome = await resolveAndPauseJob({
            send,
            hostKey: host,
            ownerRef: hostRef,
            jobId: typeof args.job_id === 'number' ? args.job_id : undefined,
          });
          if (outcome.kind === 'no-such-job') {
            return { paused: false, job_id: outcome.jobId, note: `Job ${String(outcome.jobId)} 不存在（no_such_job）` };
          }
          if (outcome.kind === 'not-owner') {
            return { error: `Job ${String(args.job_id)} 不属于本宿主（归属 ${outcome.ownerShow}），拒绝暂停` };
          }
          if (outcome.kind === 'idle') {
            return { paused: false, job_id: outcome.jobId, state: outcome.state, note: `Job 未在运行（state=${outcome.state}）` };
          }
          if (outcome.kind === 'none') {
            return { paused: false, note: '没有正在运行的 Job（引擎档案亦无 running；list_jobs 可查挂起场）' };
          }
          state.lastJobId = outcome.jobId;
          return { paused: outcome.paused, job_id: outcome.jobId, ...(outcome.state !== undefined ? { state: outcome.state } : {}) };
        }
        case 'resume': {
          const [m, err] = await requireMounted();
          if (err) return err;
          if (typeof args.job_id !== 'number') return { error: 'resume 需要 job_id（list_jobs 里找）。' };
          // host_ai_backend 与 job_start 同款必传：漏传=引擎回落直连发模型请求，
          // 桥的 python 沙盒没装 requests 当场炸（job 2569 实证）。
          // 【刀2 续跑收养】session=续跑方会话号：导演格改贴新号+在柜待领信过户。
          // host_ref 同步换新号（配对契约同 fresh_start，见上注）。
          const sessionTagResume = typeof args.session === 'string' ? args.session.trim() : '';
          const r = await send('job_resume', {
            femo: m.femoText, job_id: args.job_id, host_ai_backend: true,
            ...(sessionTagResume ? { host_ref: sessionTagResume, host_refs: { [host]: sessionTagResume } } : {}),
          }, 30_000);
          state.lastJobId = args.job_id;
          return { resumed: true, job_id: args.job_id, result: r, ...(runNextHint !== undefined ? { next: runNextHint } : {}) };
        }
        case 'list_jobs':
          return { jobs: await send('list_jobs', {}, 15_000) };
        default:
          return { error: `未知 action：${args.action}` };
      }
    },

    async femo_script() {
      const [m, err] = await requireMounted();
      if (err) return err;
      return { script: m.scriptName, text: m.femoText };
    },

    async femo_soul(args) {
      try {
        await ensureBridge();
        if (args.action === 'list') return { result: await send('list_souls', {}, 15_000) };
        const invalid = validateSoulCreate(args);
        if (invalid) return { error: invalid };
        return {
          result: await send('create_soul', {
            soul_id: args.soul_id.trim(),
            soul_name: args.soul_name.trim(),
            description: typeof args.description === 'string' ? args.description : '',
          }, 15_000),
          note: `已创建角色 ${String(args.soul_name).trim()}（soul_id=${String(args.soul_id).trim()}，脚本里用 soul:${String(args.soul_id).trim()} 引用）`,
        };
      } catch (e) {
        return { error: String(e).slice(0, 300) };
      }
    },

    async femo_chronica(args) {
      const cliArgs = [join(femoRoot, 'femo2host', 'femoToolcall', 'chronica.py'), ...chronicaCliArgs(normalizeChronicaOpts(args))];
      try {
        const { output, exitCode } = await spawnPython(cliArgs, 30_000);
        return { chronica: output.slice(-6000), exit_code: exitCode };
      } catch (e) {
        return { error: String(e).slice(0, 300) };
      }
    },

    async femo_debug(args) {
      const [m, err] = await requireMounted();
      if (err) return err;
      // 未保存文本先落临时文件（调试器按路径收FEMO脚本）。
      let tmpDir;
      let scriptPath = m.scriptPath;
      if (!scriptPath) {
        tmpDir = mkdtempSync(join(tmpdir(), 'femo-debug-'));
        scriptPath = join(tmpDir, 'script.femo');
        writeFileSync(scriptPath, m.femoText, 'utf8');
      }
      try {
        const result = await collectDebugRun({
          femoRoot,
          spawnProc: debugSpawnProc,
          req: {
            femo: m.femoText,
            scriptPath,
            ...(typeof args.runs === 'number' ? { runs: args.runs } : {}),
            ...(typeof args.seed === 'number' ? { seed: args.seed } : {}),
            ...(normalizeModule(args.module) !== undefined ? { module: args.module } : {}),
          },
          onProgress,
        });
        const verdict = debugRunToolOutcome(result);
        if (verdict.ok !== true) return { error: verdict.error };
        return {
          ok: true,
          runs: result.runs,
          ...(result.seed !== undefined ? { seed: result.seed } : {}),
          exit_code: result.exitCode,
          timed_out: result.timedOut,
          elapsed_ms: result.elapsedMs,
          log_path: result.logPath,
          ...(result.partialPath !== undefined ? { partial_path: result.partialPath } : {}),
          text: verdict.text,
        };
      } finally {
        if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  };

  // ── 附身（femo_possess，2026-09-25 收编总纲；提名制 2026-09-26）────────
  // 「一个会话 = 一个角色」：会话↔soul 绑定写在投影中心提名账正身（提名制：
  // 多会话可同提一个 soul，开演定格按「最后一次指派」选出唯一演员；投递永远
  // 查每场戏的选角账，不查提名账）。宿主注入三件：本会话身份、运行态（启动
  // 运行锁）、名册联动。
  if (possess) {
    impls.femo_possess = async (args) => {
      // 会话定位（2026-09-28 收口）：显式 session_id → 宿主注入的 selfSid。
      // 【直达式/认领牌退役】旧的「最近按回车的会话」猜测与 90 秒认领牌随
      // zcode 换轨 femo-possess 进程（CLAIM 暗号自证，进程亲缘）一并退役
      // ——多窗并存时猜测会认错窗口、两窗互顶灵魂（09-28 两连事故在档）；
      // 号源全失现响亮报错，绝不猜。
      const explicitSid = String(args.session_id ?? '').trim();
      const targetSid = explicitSid || possess.selfSid?.() || '';
      const targetHost = String(args.host ?? '').trim() || host;
      if (possess.running()) {
        return { error: 'FEMO脚本正在运行中——启动运行后绑定锁定，等本次跑完（或暂停）再改。' };
      }
      if (!targetSid && args.action === 'release') {
        return { error: '解附身需要定位「本会话」——本宿主拿不到会话身份，请带 session_id。' };
      }
      if (args.action === 'release') {
        // 解附身：核对（可选）后写 hub 正身（soul=null=解绑）。hub 不在线=如实报错。
        if (args.soul_id !== undefined && args.soul_id !== '') {
          const view = await preferencesView(femoRoot);
          const current = view.hosts?.[targetHost]?.[targetSid]?.soul;
          if (current !== undefined && current !== args.soul_id) {
            return { error: `${targetHost} 的会话 ${targetSid} 附身的是 ${current}，不是 ${args.soul_id}——核对后再解` };
          }
        }
        try {
          const r = await preferenceSet(femoRoot, targetHost, targetSid, null);
          if (r?.ok === false) return { error: r.error ?? '投影中心拒绝了解附身。' };
        } catch (e) {
          return { error: `投影中心不可达，解附身未生效：${String(e).slice(0, 200)}` };
        }
        return {
          result: { released: args.soul_id ?? null, session: targetSid, host: targetHost },
          note: '已解附身（退掉该会话的提名）——本会话不再出演该角色；若别的会话仍提名此角色，下一场归它，否则主Agent启动运行时会为它拉子代理。',
        };
      }
      // possess
      const soulId = String(args.soul_id ?? '').trim();
      if (soulId.length === 0) return { error: 'possess 需要 soul_id（先 femo_soul list 查角色库）。' };
      if (soulId === 'human') {
        // 与挑角色 UI 端点同款：human 是玩家席（FEMO脚本 human 声明走人类节点路径，
        // 不查绑定账）——附身它没有任何派工效果，只会白占占用。
        return { error: 'human 角色不参与附身。' };
      }
      // soul 必须真实存在（从引擎角色库核对，顺便拿显示名）
      let souls = [];
      try {
        await ensureBridge();
        const listed = await send('list_souls', {}, 15_000);
        souls = Array.isArray(listed?.souls) ? listed.souls : Array.isArray(listed) ? listed : [];
      } catch (e) {
        return { error: `核对角色库失败（桥未就绪？）：${String(e).slice(0, 200)}` };
      }
      const soulCard = souls.find(s => String(s?.soul_id ?? s?.id ?? '') === soulId);
      if (souls.length > 0 && soulCard === undefined) {
        return { error: `角色库里没有 soul_id=${soulId}——先 femo_soul list 核对，或 femo_soul create 新建。` };
      }
      if (!targetSid) {
        // 号源全失：宿主既没显式带 session_id 也没注入 selfSid——响亮报错，
        // 绝不猜（认领牌兜底已随直达式退役，见上注）。
        return { error: '无法定位「本会话」——请显式带 session_id（宿主未注入会话身份时必带）。' };
      }
      // 写 hub 正身（提名制：无占用拒绝，最后一次指派算数；hub 仅缺 host/sid 时拒绝）
      try {
        const r = await preferenceSet(femoRoot, targetHost, targetSid, soulId);
        if (r?.ok === false) return { error: r.error ?? '投影中心拒绝了这次附身。' };
      } catch (e) {
        return { error: `投影中心不可达，附身未生效：${String(e).slice(0, 200)}` };
      }
      const soulName = String(soulCard?.soul_name ?? soulCard?.name ?? soulId);
      possess.announce?.(targetSid, soulName);
      return {
        result: { possessed: soulId, session: targetSid, host: targetHost },
        note: `已附身 ${soulName}（soul_id=${soulId}）——自下一次开演定格起，该角色的台词送到会话 ${targetSid}，由它本尊出演（轮到发言时正常作答即可，所在宿主自动收卷交回引擎）。若此前别的会话也提名过此角色，以本次最新指派为准；在跑的戏不受影响。解附身用 action=release。`,
      };
    };
  }

  return impls;
}
