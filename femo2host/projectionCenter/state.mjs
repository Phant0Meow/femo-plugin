/**
 * state.mjs — 投影页共享状态账本（projectionCenter 拆分件）。
 *
 * ── 为什么需要本件（ES module 的账本规则）─────────────────────────────
 * import 进来的变量是「只读视图」：A 模块 import 了 B 的 rows，A 这边写
 * rows = xxx 直接抛错，改不了别人家的绑定。要改只能在 B 里写 setRows()
 * 一类的 setter——十来个共享字段就得配十来个 setter，仪式重。
 * 唯一轻量合法形态：**一个引用永不换的对象，各方改它的属性**。属性赋值
 * 走的是对象本身，不经过 import 绑定，天然可写；大家拿到的是同一个对象，
 * 谁改了全体下回读到的都是新值。本件导出的 S 就是那本公共账本。
 *
 * ── 收编纪律（本件只收什么）──────────────────────────────────────────
 * 只收「真正跨模块读写」的字段（全页逐变量盘点过，读写方见各字段注释）；
 * 只在一个模块里活的一律不上账，留各自模块当私有：
 *   render.mjs 私有：pendingPlugins（插件行攒队）/ foldOpen（折叠开合）
 *                    / followBottom + lastNearBottom（贴底旗与防抖，
 *                    滚动跟随整组住 render）/ render._last（重绘 memo）
 *   composer.mjs 私有：（原底部赋值浮层的 composerVarsOpen / composerVarsKey
 *                    随 2026-10-02 底部输入框退役一并拆走；交卷回执走
 *                    composer 的处理函数，不共享变量）
 *   sessions.mjs 私有：sessState / sessSig / castByHost（名册与 cast 标注）
 *   debug-panel.mjs 私有：dbgOpen / dbgItems / dbgLocalSeq（重连补历史走
 *                    dbg 的 onReconnect() 函数调用）
 *   panels.mjs 私有：viewsTimer（视角清单去抖）/ 下拉实例 ddJob/ddView
 *   main.mjs 私有：backoff（重连退避）/ WS_URL / THEMES / 主题与刷新按钮
 * 函数一律不上账：跨模块调用走显式 import（函数声明允许环形互调，只要
 * 双方都不在顶层求值期触碰对方绑定——本页全部调用都发生在回调/分派期，
 * 现状搬过来即安全）。本件零 import：整个依赖图的底座，解环桩。
 *
 * ── 写法约定 ─────────────────────────────────────────────────────────
 *   import { S } from './state.mjs';
 *   S.rows = j.rows || [];     // 整体换值：属性赋值
 *   S.liveBlocks.clear();      // 原地变异（Map/Set）：照旧
 *   S.ws?.readyState === 1     // ws 可能断着：先判空
 * 禁止解构缓存：const { rows } = S 拿到的是当下那一份，S.rows 换新数组后
 * 缓存就成了孤儿——处处老老实实写 S.rows。
 *
 * 顺带：拆成模块后 hub-render-core 直接静态 import，window.HubRenderCore
 * 寄存 + HRC() 就绪闸门这组单文件时代的戏法整体退役，本件不收。
 */

const INIT_QP = new URLSearchParams(location.search);

export const S = {

  // ── 连接 ────────────────────────────────────────────────────────────
  // WebSocket 实例。main.mjs（connect）唯一写入口；发信口全民共享——订阅/
  // 选场/选会话/交卷/print 清空都往这条线上写帧，读 readyState 前先判非空。
  ws: null,

  // ── 时间线数据（main 的 WS 分派器写，render 读）─────────────────────
  // 当前视角的时间轨语义行：快照整发（换值），增量帧追加/原位替换。
  rows: [],
  // 打字机中的直播块：key → {actor, blockKind, text, host}。live/live-done
  // 逐块增删，live-clear 换场全清，快照捎带的正在打块也落这里。
  liveBlocks: new Map(),
  // 已收到过首帧快照：空态提示与回底按钮只在它之后才出现（开屏一瞬不算）。
  snapSeen: false,

  // ── 「我在看什么」四元组 ────────────────────────────────────────────
  // 所选场次：''=跟随最新场。下拉/选会话联动写，订阅/快照/清单纯读。
  // 进 URL（?job=）可分享、刷新不丢——初值就从 URL 带。
  selectedJob: INIT_QP.get('job') || '',
  // 当前实际场次号：hub 快照回执为准（「所选」与「实收」分开记）。
  // 场次栏与统计条读。
  currentJobId: null,
  // 当前视角 id（god / god:<host> / stage / actor:<soul> / chronica:<台账号>）。
  // URL 带初值；视角下拉、清单回落、view-echo 校正、选会话联动都写这里；
  // 输入席可见性与时间轨空态文案读。chronica:* 是整场回放视角（REST 拼接，
  // 不走 WS 订阅——见 panels.loadChronicaView）。
  currentView: INIT_QP.get('view') || 'god',
  // 整场回放所在的台账场次号（chronica: 视角下非空；其余视角 null）。
  // updateJobMeta 读它画场次栏「台账场次 N」。
  chronicaSession: null,
  // FEMO脚本名（play_start 行携带）——场次栏展示用，分辨「这是哪场」。
  currentPlay: '',
  // 本 hub 见过的来源宿主名（applyJobs/快照/hosts 三处写）。目前只写无读——
  // 「字段要有消费方」三问的挂账件，拆分按逐字纪律保留，别顺手删（施工清单 §八）。
  knownHosts: [],

  // ── 人类席（main 的 WS 分派器写，composer / render 读）───────────────
  // hub ctrl:waiting / 快照捎带：**席位清单**（2026-10-02 复数化——par 并发
  // 多条线各自等到人类时全部在册）。每席 {job_id,wait_key,node,actor,scope,
  // prompt,host,out_vars,views,seg}；序=human_wait 到达序，底部停靠照此排。
  waitingSeats: [],
  // 每席就地输入草稿：{wait_key → {wk, expanded, text, varsOpen, vars, err,
  // busy, _focus}}。composer 唯一写口（applyWaiting 按清单增删保留——席位
  // 消失=草稿作废；同席重推不重置 busy，交卷锁只在新建/回执失败时归零）；
  // render 读（doingHtml 画停靠席、重绘时按 _focus 接回焦点、草稿回填）。
  // busy（原全局 composerBusy 下放每席）：已寄出未收账禁双投。
  // 状态全在内存：全量重绘不丢草稿不丢焦点。
  ihumanDrafts: {},
};
