# Femo2Host 架构设计

> 版本：2026-09-24（第六期·收官增补：十连裁全落地+分诊台v2+单通道收官+停演裁决/收信口分拣/桥启动三件/hub发现/身份契约六新件；§五/§六/§十已重写至当前现状，§七以前为历史档案）
> 性质：Femo 多宿主架构的设计总纲——设计理念、问题诊断、裁决、实现清单、验证体系与剩余工作。
> 读者：任何要改 femo-plugin 的人。改公共层之前必读；改宿主适配器之前建议读。
>
> **⚠️ 现状更新（2026-09-26，常驻化第 3 步完工后读本文须知）**：本文成稿于「每宿主一座桥」时代，文中「桥」「桥启动三件」「电话机」等提法是**历史语境**。现行架构=每数据根一座常驻引擎 `femo_daemon.py`（hub+引擎+信柜管家+投递员同进程），宿主经公共层 `daemon-client.mjs` 直连（/cmd 命令 + /engine/events SSE + /engine/doorbell 门铃），不再生 Python 桥子进程；本文八不变量、单通道纪律、ActorTurnSection 等语义裁决**全部继续有效**，只是承载者从「桥」换成「常驻引擎」或「直连客户端」。现行法以《引擎常驻进程施工清单》与本仓 AGENTS.md 家族为准。

---

## 一、这份文档回答什么问题

Femo 引擎本来只有一个宿主（DSH）。后来来了第二个（Zcode），再后来又来了第三个（DeepSeek 网页版）。「让多个 AI 按剧本演戏」这件事的逻辑只有一份，但它的实现被每个宿主各抄了一份——于是每修一个 bug、每改一个措辞，都要在两三处同步，漏一处就是行为漂移。

Femo2Host 是对这个问题的总答案：**把「演出本身」的代码收敛成一个唯一事实源，把「宿主的物理形态」留给各家**。这份文档记录：

1. 重构前我们看到了什么（问题诊断，§三）；
2. 用什么原则裁决「什么该合并、什么该分开」（设计理念，§四）；
3. 公共层现在有什么、谁在消费（目录清单与消费地图，§五、§六）；
4. 每一期做了什么、怎么验证的（实施史与验证体系，§七、§八）；
5. 一路踩过的坑（§九）；
6. 还剩什么、按什么顺序收（剩余工作，§十）；
7. 终局长什么样（§十一）。

---

## 二、全景：一个剧场和它的各色人等

整个系统用剧场比喻理解最省力。先立住角色表，后文全部沿用：

| 比喻 | 实体 | 一句话职责 |
|---|---|---|
| **剧组（哑巴）** | 引擎（femoCompiler，住在桥的进程里） | 埋头演戏：解析剧本、推进节点、发信号等回执。不抬头看观众，不自己叫演员 |
| **桥** | femo_bridge.py | 引擎的「身体」：引擎没有自己的进程，桥启动时把引擎装进肚子。对外一根对讲机（NDJSON over stdio）对宿主，顺路当驿站的引擎侧收发员 |
| **对讲机线** | NDJSON stdio 协议 | 实时、双向、过耳不留：播报下行、命令上行 |
| **电话机** | bridge-client.mjs / 各宿主绑定 | 宿主侧接对讲机的机器：拨号拉桥、请求应答配对、超时、优雅停机 |
| **导播 / 分诊台** | event-core.mjs / 各宿主事件调度 | 引擎每声播报的分诊：这条该写幕布、翻黑板、产信、拉动作还是推帧 |
| **幕布** | 投影窗（dsh 会话窗 / zcode JSONL 三窗） | 把戏誊抄给能看见的世界。上帝窗、舞台窗、每个角色一扇小窗（只誊他看得见的） |
| **黑板** | 运行态镜像（RunState / router.state()） | 「现在演到哪了」的权威快照：演着没、哪个 Job、轮到谁、等哪个凭据 |
| **驿站（柜子）** | mailbox.py | 跨时间的点对点信：信进站、客户来取、寄件出站、清账。管「收信的人现在不在场怎么办」 |
| **投递员** | mail_courier.py | who_move=system_push 的送货上门：urgent 信产出现场直推宿主接收口（dsh=mailbox-push.ts；先投后发事件防竞态），失败信留柜由兜底拉；zcode 未挂铃铛=自取 |
| **监工** | debug-run-core.mjs | 干跑的过程纪律：单飞闸、看门狗、流水收集、终报格式化 |
| **总纲** | tools-core.mjs | 导演工具的唯一定义：名字、描述、参数、校验口径、直连桥形态的执行体 |
| **演员经纪人** | subagent-core.mjs + 各宿主执行体 | 「一个 AI 角色演完一轮」的词汇与簿记：料包、工具面、模型来源、在飞登记、占用采样 |
| **停靠经纪人** | node-retry.mjs | 「重试还是放行」的裁决：引擎喊重试 → 翻译成一纸租约，三种执行者一个信号一份租约 |
| **拼词员** | notice-core.mjs | 停下时刻给主模型的那段话：唯一定义哪些事件算「戏停了」（STOP_SIGNALS）与汇总措辞（formatStopNotice）——信在驿站、词在这里、投递在宿主薄件 |
| **读屏器** | 各宿主瘦身后的事件消费 | 形态 B 终局里宿主的最终形态：只读公告栏和小黑板，不再自己分诊 |

**三条铁打的通道**（谁也替代不了谁）：

1. **对讲机（实时线）**——管「现在」。毫秒级，宿主路由器/直播帧/守卫全靠它。
2. **驿站（磁盘柜）**——管「迟到的人」。导演只在收工时看信、演员要等轮到自己、warning 要压站等急件——这些跨时间的交接全靠它。
3. **幕布（誊抄制度）**——管「看见」。一人写众人看的广播墙，带顺序、去重、视野裁决。

---

## 三、问题诊断：重构前我们看到了什么

对两个宿主适配器做过全量通读（dshAdapter 约 40 个 TS 文件 + client UI，zcodeAdapter 的 mcp/hooks/commands/skills）。结论按严重度排：

### 3.1 字面意义上的两份拷贝（文件头自证）

| zcode 侧 | dsh 侧 | 重复内容 |
|---|---|---|
| `mcp/projection-writer.mjs` | `projection.ts` + `windowing-native.ts` + `section-gate.ts` | 三窗存储、scope 分发（空 scope=全员）、`_srcSeq`/结构键两级去重、跨重启懒建索引、回合区块 FIFO 闸门、replayKey。行 schema 完全同构，唯一差异：zcode 窗=自有 JSONL 文件，dsh 窗=DSH 会话 |
| `mcp/event-router.mjs` | `engine-events.ts`（路由骨架部分） | 引擎事件分发 switch、human_wait 登记、终局检测、运行态镜像、导演指令队列 |
| `mcp/bridge-manager.mjs` | `bridge.ts` | NDJSON 行缓冲、请求应答配对、超时、优雅停机、失败上报 |

### 3.2 结构性的重复

- **dsh 内部**：`subagent.ts`（1205 行，one-shot 执行体）与 `subagent-native.ts`（997 行，0.1.3 常驻执行体）约 700 行逐段同构——镜像缓冲、直播帧链、占用采样三件套、停靠重试主循环。
- **帧映射四份**：「模型逐字增量 → femo_stream 直播帧」的翻译在 dsh 内部存在四份（subagent.ts、subagent-native.ts、engine-events.ts 导演路径、stream-frames.ts 收口）。
- **喂人类节点三处**：dsh 的 routes.ts 与 projection-input.ts 各一份，zcode 的 gateway 一份。
- **工具两份注册**：七个 femo_* 工具的定义/描述/参数裁决，dsh tools.ts 与 zcode femo-server.mjs 各写一遍。
- **SSE 重放环两份**：dsh http.ts 与 zcode gateway.mjs（400 帧环+心跳，注释互指同款）。

### 3.3 最尴尬的一处

`femo_bridge.py`——host 无关的运行控制协议层——躺在 `dshAdapter/python/` 里。zcode 的桥客户端硬编码路径 `join(femoRoot,'hostAdapter','dshAdapter','python','femo_bridge.py')`，导致 **zcode 安装包被迫携带整个 dshAdapter 目录**。共享层名存实亡。

### 3.4 一批「从未工作过」的既有 bug（重构中顺手暴露）

- 桥的 `ensure_default_data()` 引用 `main()` 的局部名 `femo_api`——自诞生起必然 NameError，被 except 吞成一行 stderr。**种子数据初始化从来没成功过**，全靠生产库早就建好才没炸。
- `--db` 指向全新沙盒库时 souls 等表不存在，挂载编译直接报错——初始化只在 job_start 懒触发，check 命令不等它。
- 沙盒隔离三条通道全漏：测试设了 `FEMO_DATA_DIR`，但引擎 DB（桥没传 `--db`）、信箱（mailbox.py 只认 FEMO_ROOT）、投影（这条本来是对的）各有一截漏到生产。实测后果：测试把真 Job 写进生产台账、44 封测试信漏进生产信箱被 Stop 钩子当真通知注入会话。

---

## 四、设计理念与裁决原则

### 4.1 唯一的裁决标准

> **「演出这件事本身」只该有一份；「这件事在某个宿主里的物理形态」各写各的。**

展开成可操作的判据——对任何一段候选代码问三个问题：

1. **换个宿主，这段话还成立吗？**（事件分发表的判断逻辑——成立→公共；「写到 DSH 会话」「zcode 钩子响应格式」——不成立→宿主）
2. **它持有物理形态吗？**（持有内存/文件/进程/会话的→形态件；只做判断和翻译的→协议件）
3. **它重复了几次？**（≥2 且语义必须一致→必须合并，否则必然漂移；只有 1 个消费方的→先别动，等第二个消费方出现再收，否则是假公用）

### 4.2 层次模型

```
┌─────────────────────────────────────────────────────┐
│ 宿主适配器（各写各的物理形态）                          │
│  dsh: 会话窗/HTTP路由/persona/版本胶水/client UI      │
│  zcode: MCP stdio/hooks/commands/信箱CLI寄稿          │
├─────────────────────────────────────────────────────┤
│ femo2host/host/（演出编排公共层，纯 ESM .mjs）          │
│  分诊台·电话机·总纲·监工·演员核心·停靠经纪人·交付队列    │
├─────────────────────────────────────────────────────┤
│ femo2host/ 边界层（引擎的唯一门面）                     │
│  femo_api.py · femo_bridge.py · mailbox.py            │
│  femoRoot.mjs · femo_gen_api.jsx · femoToolcall/      │
├─────────────────────────────────────────────────────┤
│ 引擎（femoCompiler）+ 桥接（femoBridges）+ 编辑器（femoGen）│
└─────────────────────────────────────────────────────┘
```

规矩：**宿主只准消费 femo2host，不深入引擎内部**（引擎内部重构保住门面签名即可，宿主与桥零改动）；公共层不依赖任何宿主。

### 4.3 语言与形态决策

- **公共层用纯 ESM `.mjs`，不用 TypeScript**。zcode 是裸 mjs 直跑（引入构建步骤得不偿失）；dsh 的 esbuild 直接 bundle .mjs 毫无障碍。类型用 JSDoc + 伴生 `.d.mts` 声明文件解决——dsh 的 tsc typecheck 与 IDE 提示都吃它。
- **改壳不改面**：每上移一件，原宿主文件变成「薄绑定/再导出壳」，对外接口一字不变——所有既有消费方零改动。这是三期都能小步快跑的关键。
- **适配器契约**：公共层与宿主的接缝全部是注入式回调，契约写在公共层文件头。已定型的契约：
  - 电话机 `spawnProc({argv,cwd,env}) → 子进程外形`（zcode 传 node child，dsh 传 SubprocessHandle 适配壳）；
  - 分诊台 `board.{ensureWindows,chat}`（写公告落点）+ `send`（回传）；
  - 监工 `spawnProc` 同电话机 + `onProgress`；
  - 采样器 `onPublish/onPersist`；
  - 停靠经纪人 `steer` 租约（登记时闭包捕获自己的执行通道）。

### 4.4 事件路由：五动作与形态 A/B

事件路由每天干的活只有五类去处，这也是分诊台的完整接口清单：

1. **产信**——点对点的信（终局/主演轮次/warning/角色料包）。**已归驿站**：桥在事件现场产信，分诊台不再重复。
2. **写公告**——幕布行。高频、共享、有顺序。不能当信寄（驿站每信只服务唯一客户 vs 幕布一人写众人看；信是点对点邮资，幕布是广播墙）。
3. **翻黑板**——运行态快照。随时可重算的状态，不是一次性事件。
4. **拉动作**——发令枪（轮到 AI→派演员；轮到人类→开席；卡住→停靠裁决）。
5. **推帧**——现场直播（逐字增量）。永远不走文件，这是剧场现场的实时转播。

两条实现路线（都成立，分两步走）：

- **形态 A（现在）**：分诊台进公共代码层（event-core.mjs），宿主注入落点。zcode 已切；dsh 未接（见 §十）。
- **形态 B（终点）**：分诊台搬进桥（Python 单份），桥顺手产**公告栏**（中立投影行文件）和**小黑板**（运行态快照文件），两个宿主瘦成读屏器。这正是「窗两段式=历史从驿站账本回放+实时流从宿主来，接缝=账本序号」的愿景。A 的落点接口按 B 的形状设计（产信/写公告/翻黑板），到时公共层退化成薄读屏器，接口不变。

**为什么不全走驿站**：拿自己定过的纪律判——「驿站每条消息只对唯一客户服务」（幕布天然违反）、「一次性事件归滞留件、可重算状态归现拼」（黑板违反）、邮资经济性（拿快递单号发弹幕）。电话线管现在，柜子管迟到的人——两者性格相反，合并不了。

### 4.5 驿站模型（另一窗口定稿，此处存档要点）

世界只有两个角色：驿站（攥全流程与全部历史）和客户（宿主/引擎/角色）。信由八个维度完全描述：delivery（急件/滞留件）、action（寄件/收件）、who_move（上门/到站）、who_require（客户索要/系统发起）、kind（context/speech/notice）、target_host（必填精确匹配）、soul（main=主模型保留地址）、node（随信说明书不路由）。状态三段：pending → delivered → consumed。四个动词：post / receive / drain_outgoing / mark_consumed（+mark_delivered 补记账）。节点发言两阶段：①收料包信 ②寄发言信（ref=凭据号 wait_key 对号入座）。滞留件规则：同 Job 同 soul 的急件进站才放行。**驿站从不知道时机，路由器从不投递，桥两头跑腿**——时机归事件流，交接归驿站。

### 4.7 多层时钟的错位阶梯（API 请求错误兜底 + 重试家族的时间设计）

AI 演员的失败有四层兜底，每层的时钟**刻意错位**，外层超时必须大于内层总耗时，
否则内层还在重试、外层已经判死——这套错位是设计核心，改动任何一层前先对表：

```
官方快层（base bundle dsh-llm-retry）    ≤5 次，500ms→10s    总耗时 ~1min 内
femo 慢层（api-retry.ts）                五段：立即/20s/1min/3min/10min  总计 ~14.4min
停靠经纪人超时（node-retry park）        15min（P4：刻意 > 慢层总耗时）
引擎人类/AI 等待                         3600s（最终兜底，AI 沉默 move on）
```

慢层设计要点（dsh api-retry.ts 已实现）：
- **挂接**：官方快层先消费同一条请求错误瀑布，耗尽才轮到慢层——「同一 turn 同一
  step、同一 durable history 原地重跑」是宿主层的语义。
- **连续计数口径（P1）**：按 (turn, step) 连续失败计数，中间有 step 成功推进即清零
  ——多步 react 各步的偶发失败各自享"立即重试"，长退避只在持续故障时发生。
- **永久码直通（P3）**：NO_ADAPTER/INVALID_CREDENTIAL/QUOTA/CONTEXT_WINDOW_
  EXCEEDED 等重试恒同败，立即放行（白等 14 分钟无意义）。
- **过滤与取消**：只认在飞演员登记表（导演轮次/用户聊天透传零影响）；turn 中止或
  插件卸载秒级打断在飞延迟；收尾路径清计数防孤儿泄漏。
- **耗尽出口**：第五段后放行 = turn error = 既有 recordError/交卷路径；彻底零产出
  → B5 actor_failed 显式上报（引擎沉默收场裁决）。

### 4.6 沙盒隔离三通道（测试卫生的铁规矩）

任何测试/多实例场景设 `FEMO_DATA_DIR` 后，三条数据通道必须全部进沙盒：

1. **引擎 DB**：bridge-manager 组装 `--db <DATA_DIR>/femo/memory/Chronica.wor`；
2. **投影**：femo-server 的 DATA_DIR 本来就随 FEMO_DATA_DIR 走；
3. **信箱**：mailbox.py 定位 `<DATA_DIR>/femo/mailbox/`。

漏任何一条，测试的信/Job 就漏进生产，被钩子当真通知。教训实测过三次，见 §九。

---

## 五、femo2host 目录清单（2026-09-24 现状）

```
femo2host/
├── femo_api.py              引擎唯一门面：编译/Job状态机/角色库/干跑编程面。宿主零直读引擎内部
├── femoRoot.mjs             引擎根唯一解析器：向上≤6级找含 femo2host/ 的目录；FEMO_ROOT env 优先
├── femo_gen_api.jsx         可视化编辑器唯一门面（dsh client 源码级打包；dist 由 zcode 网关托管）
├── mailbox.py               驿站：八字段信封/四动词/三态/滞留件/两阶段发言（见 §4.5）；
│                            push_extra 面单随信入库（重投同形，09-24）
├── mail_courier.py          投递员：system_push 上门/留柜自取/retry_pending 重投
│                            （面单自信上读=重投同形；FEMO_PUSH_PORT 铃铛契约）
├── projection_hub.py        投影中心（馆）：账本/视角/VIEW_POLICY/WS/REST 全宿主共享，
│                            hub.json 自发现件；HUB_REV=2026-09-24a-var-out
├── projectionCenter/        投影中心网页端（2026-09-26 自单文件拆分：index壳+两css+
│                            七模块，共享状态住 state.mjs 账本；hub 白名单伺候）
├── python/
│   └── femo_bridge.py       桥本体：NDJSON 协议+Job状态机接线+驿站产信+出站轮询
│                            （出站手写信兜底按 soul 双词汇：human/@角色→chat_text，其余→output）
├── femoToolcall/
│   ├── chronica.py          台账只读直查 CLI（两宿主工具同款消费，宿主无关）
│   └── femo_debugger.py     FakeHost 干跑替身 CLI（监工的看管对象）
│                            （femo-chat.mjs 读 DSH 会话 zstd，2026-09-22 已移回 dshAdapter/）
├── femoGenConnector/        【2026-09-22 新建】femoGen 相关公用元素集中地
│   ├── SKILL.common.md      FEMO 教条正文唯一份（dsh persona / zcode SKILL 经 INCLUDE 展开，
│   │                        {HOST} 占位符由加载器替换；宿主差异在各宿主附录）
│   ├── sse-core.mjs         画布 SSE 通道：重放环 cap400/短命帧过滤(femo_stream,ai_token,
│   │                        step)/checkpoint 原地替换/replay:true 标记/15s 心跳；
│   │                        帧格式（dsh data: vs zcode 具名事件）经 codec 注入
│   ├── femogen-files.mjs    femoGen 剧本文件账本（09-20 自 dshAdapter 上移，09-22 移入本目录；
│   │                        host/ 原位留再导出壳，dsh femo-files.ts 零改动）
│   └── *.d.mts              TS 声明
└── host/（演出编排公共层，纯 ESM）
    ├── tools-core.mjs        工具总纲：buildToolSpecs + createBridgeToolImpls +归一口径
    ├── debug-run-core.mjs    干跑监工：沙盒装配/argv/单飞闸/看门狗收集/流水渲染/终报/裁决
    ├── bridge-client.mjs     电话机协议机：行缓冲/配对/超时/优雅停机/B5失败上报/onParseFail钩子
    ├── event-core.mjs        分诊台 v2【09-24 B2 收官】：记账+黑板翻转+分拣三件事——
    │                         黑板=run-state-core Job 镜像（随戏生灭，A4 串台根治），
    │                         派工退出默认语义（单通道=驿站）；dispatch:'queue'=
    │                         v1 拉取队列遗留模式（autoclaw 过渡自挂）；
    │                         submitOutput/submitHumanOutput 回传合约不变
    ├── subagent-core.mjs     演员核心：回合号纪元/镜像白名单三件/料包契约/在飞登记/占用采样器
    ├── node-retry.mjs        停靠经纪人：park/deliverRetry/markSettled/abortAll/abortJob
    ├── delivery-queue.mjs    「戏内注入等本轮收口」队列（纯状态机；offer=问一句
    │                         能否立即交付 / enqueue=已判定要排队的显式入队）
    ├── notice-core.mjs       拼词员：STOP_SIGNALS + formatStopNotice（停下汇总唯一措辞）
    ├── speech-core.mjs       【09-20 新建】交卷信封唯一出处：humanSpeechArgs（{chat_text,
    │                         variables}）+ executorSpeechArgs（{output,steps?,model_id?}）
    ├── projection-core.mjs   【09-16 投影合一】幕布誊抄制度：纯函数(actorKeyOf/dedupeStructKey/
    │                         replayKey/resolveTargets/chatRow)+WindowLedger 双幂等账本+
    │                         SectionGate 回合闸门+createProjectionAppender scope 分派器
    ├── state-files.mjs       【09-20 上移】user_data 状态文件族（会话记录含 host 键/
    │                         文本域 rev 乐观锁/演出域场次账本；09-25 角色占用快照
    │                         下推 dshAdapter 私产、cast 绑定段迁 cast-core 后，
    │                         本件回归纯「会话记录+Job 索引」账本）
    ├── api-retry.mjs         【09-20 批次C】AI 演员请求错误慢层：可重试码表/五段退避/连续计数
    │                         口径/决策与可取消排程（dsh api-retry.ts 只剩 request-error 插座）
    ├── run-state-core.mjs    【09-23 批次D】运行态镜簿：Job 镜像状态机（prearm/correct/
    │                         setState/clear/clearActiveIfActive/推导查询）+节点登记表
    │                         三件+waitingHuman 快照（09-24 B1 归一：waitingHumanFromEvent/
    │                         set·clearMirrorWaitingHuman）+assertRunAllowed 运行守卫
    ├── variable-api.mjs      【09-23 十连裁⑤】变量世界观测 API：checkpoint/func_result/
    │                         assign_result 三事件归一 VariableRecord，brief|full 一参两档，
    │                         进程内订阅（画布断点/In·Out 面板供给）
    ├── run-control-core.mjs  【09-24 B3】停演裁决：resolveAndPauseJob 唯一裁决（显式=引擎
    │                         档案归属+状态预检；缺省=镜像快路径→list_jobs 档案兜底；
    │                         始终不裸发 job_pause）——dsh run-control 壳+tools-core pause 同吃
    ├── bridge-launch.mjs     【09-24 A1】桥启动三件：buildBridgeLaunch（argv/env 组装，
    │                         身份 host/hostName 分立）+nodeSpawnProc+ensureBridgeReady
    ├── hub-client.mjs        【09-24 A2】投影中心地址唯一解析：hub.json 自发现>env>8790，
    │                         mtime+size 缓存（dsh 三份手写算式收编）
    ├── mailbox-push-core.mjs 【09-24 A3】上门信分拣裁决：decidePush 纯函数（终局整包/开演信/
    │                         重试牌/插话/料包三路+invalid 案类）——宿主只剩插座
    ├── hub-render-core.mjs   【09-24】端上共享规范件：投影输入席可见性（PROTOCOL §5.3
    │                         代码化：composerAllowedFor/seatWho/hasOutVars）+行解释层
    │                         去重（场次 meta 词表 metaRowOf/横幅类 isBannerKind/
    │                         工具槽配对 pairToolSlots）——hub 静态伺候 /host/ 路由供
    │                         投影页 <script type=module> 引用，dsh client esbuild 打包；
    │                         呈现（组件/样式/主题）永远留在端
    ├── hub-feed-core.mjs     【09-25】投影中心喂送协议机：双路微批（job 路有戏才喂/
    │                         会话路无戏照喂，各 40ms/20 条单飞）+段引用 ref（引擎
    │                         令牌）/segRef（宿主自造键）互斥+宿主轮容器账；
    │                         best-effort 静默，诚实失败走 postFeedFrames 同步面
    │                         （dsh hub-feed.ts 注入壳；zcode gateway god-outside 同吃）
    ├── cast-core.mjs         【09-25】会话↔角色选角账·宿主侧唯一读写口（账本正身住
    │                         projection_hub：cast-preferences.json 偏好账按宿主分格
    │                         + cast/<jobId>.json 选角账存 (soul→session,host)，唯一
    │                         占用 hub 全局裁决，API 四路见 PROTOCOL §5.7）——绑定
    │                         的角色由会话本尊出演（dsh 收件口查账分流；zcode
    │                         femo_possess 工具退役，附身走本机 femo-possess
    │                         程序自证）；与剧本演员花名册 _cast 两回事
    └── *.d.mts               上述各件的 TS 声明（dsh typecheck/IDE 消费）
```

**消费地图（2026-09-24 现状；autoclaw 为第四宿主列）**：

| 公共件 | dsh 消费方 | zcode 消费方 | autoclaw 消费方 |
|---|---|---|---|
| femo_api.py | 桥（进程内） | 桥（进程内） | 桥（进程内） |
| femoRoot.mjs | config.ts | bridge-manager/hooks/lib/gateway(importSseCore) | bridge.mjs（静态 import） |
| femo_gen_api.jsx | client/editor-page | （经 dist 静态托管） | （投影页 URL 直连 hub） |
| mailbox.py | 桥产信（进程内） | 网关 receive / 模型 send CLI / 桥出站轮询 | 桥产信（进程内） |
| mail_courier.py | 桥雇佣（唯一雇主） | —（zcode 无铃铛=自取） | 桥雇佣 |
| projection_hub.py / projection_center.html | hub-feed/hub-proxy/god-mirror 喂读；hub-window 读 | god-outside 喂戏外行+测试实读（2026-09-25 hub 化落地，挂起解除） | 读 hub.json 给投影页 URL |
| femo_bridge.py | bridge-launch（bridge.ts 消费） | bridge-launch（bridge-manager 消费） | bridge-launch（bridge.mjs 消费） |
| tools-core | tools.ts（规格+归一+会话型执行体） | femo-server.mjs（全套执行体，零本地定义） | index.mjs（全套+自加 femo_answer/femo_next） |
| debug-run-core | debug-run.ts（流式路径+spawn 适配） | femo-server（femo_debug 工具） | index.mjs（femo_debug 工具） |
| bridge-client | bridge.ts（extends 适配壳） | bridge-manager.mjs（extends 绑定） | bridge.mjs（extends 绑定） |
| bridge-launch【A1】 | —（bridge.ts 形态件暂不接） | bridge-manager + femo-server(ensureBridgeReady) | bridge.mjs + index.mjs |
| event-core【v2.1 接入面】 | events/engine-events 注入绑定（09-26 最后一役：账本注入 RunState+resolveSid 反查+skip 名单+终局 verbs 出真变化信号；行显示仍归桥 EventProjector/自绘窗） | event-router.mjs（默认单通道） | runtime.mjs（dispatch:'queue' 遗留过渡） |
| run-state-core【批次D】 | engine-events（六壳+note 三件+waitingHuman）、run-control、routes、mailbox-push | 测试 | （经 event-core v2 内部） |
| variable-api【十连裁⑤】 | engine-events（单例+画布供给） | 测试 | — |
| run-control-core【B3】 | run-control（pauseJobResolved 壳） | —（tools-core pause 间接） | —（同左） |
| mailbox-push-core【A3】 | mailbox-push.ts | — | —（旧代际收信口未迁，宿主自取） |
| hub-render-core【输入席§5.3+行解释层】 | client hub-window.tsx（metaRowOf/pairToolSlots/isBannerKind） | — | 投影中心页（hub /host/ 路由伺候，window.HubRenderCore） |
| hub-feed-core【09-25 喂送协议机】 | hub-feed.ts（注入壳：地址/来源/会话寻址） | gateway /api/god-outside（同步面：outsideRowOp+postFeedFrames） | —（投影走桥内嵌 hub） |
| hub-client【A2】 | hub-feed/hub-proxy/session-roster | — | index.mjs（readProjectionInfo） |
| subagent-core | subagent-native + index/run-control/routes | ❌（导演邮差形态） | actors.mjs（真第二消费方） |
| node-retry | node-retry.ts（壳+单例） | 拉取模式自认降级【09-25】：重试牌入柜+取信口重演教学已通（无租约——无可暂存的在飞执行体，引擎 3600s 兜底） | ❌ 能力缺口（宿主自取，不追） |
| delivery-queue | main-delivery-queue.ts（壳） | ❌ 队列死重（v2 已默认不产） | ❌ |
| projection-core | projection.ts（WindowLedger+actorKeyOf）+windowing-native（replayKey） | tests/memory-store.mjs（仅测试；生产自存已退役 2026-09-25） | — |
| speech-core | main-actor/subagent-native/projection-input/routes(/human-input) | event-router→submit(Human)Output | runtime→router 同款 |
| notice-core | engine-events + mailbox-push | ❌（gateway 手拼措辞，宿主自取不追） | runtime + mailbox-push |
| state-files | index/run-control/routes/engine-events 等九文件 | ❌ 未消费 | ❌ 未消费 |
| api-retry | api-retry.ts（cordis 插座） | ❌（演员不经宿主 API） | ❌（同左，自认降级） |
| femoGenConnector/sse-core | http.ts + routes.ts + engine-events | gateway.mjs（codec 注入） | — |
| femoGenConnector/femogen-files | femo-files.ts（壳） | 可直接消费 | 可直接消费 |
| femoGenConnector/SKILL.common.md | preset-install.ts（INCLUDE 展开） | femo-server.mjs（INCLUDE 展开） | —（无 SKILL 面） |

## 六、两条宿主剥离后各自剩什么

### dshAdapter（DSH 宿主胶水）

- **总装** index.ts：插件 apply、桥自愈（onExited→3s respawn）、Job 索引重建、工具依赖注入。
- **接桥**：bridge.ts = 电话机适配壳（subprocess 服务轮询 + SubprocessHandle 契约翻译 + 诊断挂钩）。
- **事件面**：engine-events.ts——豪华版调度（Job 镜像簿记、子代理派发、停靠租约接线、多路广播、steer）。❗这是 dsh 剩余的最大单体，瘦身路径见 §十。
- **形态件**：投影子系统（projection.ts 窗生命周期/god-mirror/windowing-native/native-state/session-events/list-cache 版本胶水）、HTTP 路由壳（routes.ts）、persona/preset 安装、client/ 全部 UI、build.mjs（ModuleLoader banner）、dshPatch。
- **工具**：tools.ts = 会话型执行体（挂载写会话记录、开演走 startJobOnSession）+ 总纲规格消费。
- **干跑**：debug-run.ts = HTTP 流式调试窗路径 + spawn 适配（监工在公共层）。

### zcodeAdapter（Zcode 宿主胶水）

- **总装** femo-server.mjs：MCP stdio JSON-RPC 框架、演员哨兵（FEMO_ACTOR_SESSION 工具面置空）、SKILL.md 占位符落盘替换、importCore 三档布局探测。
- **接桥**：bridge-manager.mjs = 电话机绑定（引擎根解析 + 启动命令行含 FEMO_DATA_DIR→--db + node spawn 适配）。
- **事件面**：event-router.mjs = 分诊台薄绑定（board 缺省空落点——投影历史归 hub，2026-09-25 三窗自存退役）；gateway.mjs = HTTP/SSE 壳 + stop-intent 的 zcode hook 响应格式 + 驿站 receive/send 接线 + god-outside 戏外行喂 hub。
- **机制件**：hooks 四薄壳（hooks.json 只剩 Stop→stop-intent + mail-context）、commands/femo.md、skills/femo/SKILL.md（zcode 演出通道附录）、交卷薄壳 mcp/speech-send.mjs（回信命令接收体：寄信同拍把台词按 wait_key 喂 hub 草稿层——zcode 逐字流的宿主侧喂字口，收口权归桥）。
- **工具**：femo-server 直接用总纲执行体（femo_mount/run/script/soul/chronica/debug 全套），零本地实现。

---

### autoclawAdapter（OpenClaw/AutoClaw 宿主胶水，2026-09-22 新增第四宿主；09-24 补录）

- **总装** index.mjs：八个工具（总纲六件零本地定义 + 自加拉取席 femo_answer/femo_next）、驿站收件口 HTTP 路由（收件口=gateway HTTP，FEMO_PUSH_PORT=网关端口）、终局/主演/人类三拍 → enqueueNextTurnInjection 注入主会话（hooks 已配置再 best-effort wake）。
- **接桥**：bridge.mjs = bridge-launch 消费壳（身份 autoclaw 双词齐传）+ bridge-client extends；ensureBridgeReady。
- **事件面**：runtime.mjs = event-core 绑定（**dispatch:'queue' 遗留模式**——pump/femo_answer 吃拉取队列，单通道对齐前自挂）+ actors.mjs（subagent-core 消费、one-shot 执行体、事件现场派工）。
- **收件口**：mailbox-push.mjs = 十连裁前夜旧代际翻版（双通道+去重簿+collect 兜底），**未迁 mailbox-push-core**——迁移前先做单通道对齐（用户判据：宿主侧债不追，宿主自取）。
- 已知降级（自认）：steps 生料不可得、无逐字流、无占用采样、无 api-retry 慢层、node_retry 无停靠租约（引擎 3600s 兜底）。

## 七、实施史（四期 + 收官期，每期独立可验证）

### 第一期：地基三件（桥上移 + 工具总纲 + 干跑监工）

- 桥本体迁入 `femo2host/python/`，旧路径转发壳；两端引用+五个测试文件+sync 脚本全改；zcode 安装包不再携带 dshAdapter 目录。
- `tools-core.mjs`：参数名统一 snake_case（查证 preset 只教工具名，无回归面）。
- `debug-run-core.mjs`：单飞闸/看门狗/裁决一份；zcode 干跑从「抓 6000 字尾巴」升级成完整监工。
- 顺手修三个既有 bug：femo_api 全局绑定 NameError、桥启动即建表+种子、FEMO_DATA_DIR→--db 引擎隔离。

### 驿站期（另一窗口，本档案存档）

mailbox.py 重写为八维驿站，桥产信+出站轮询、网关 receive/send 两阶段闭环、滞留件、gateway-smoke 重写 13/13、3081 重启。遗留的 FEMO_DATA_DIR 缺口由第一期侧补齐。

### 第二期：电话机 + 分诊台（zcode 先切）

- `bridge-client.mjs`：协议机唯一份，zcode bridge-manager 瘦成绑定；`event-core.mjs`：分诊台唯一份，zcode event-router 瘦成 40 行绑定。对外接口零变化（femo-server/测试零改动）。
- 新增 bridge-client 假子进程单测（7 项：乱序配对/detail 优先/超时/停机/暴毙/B5 截断）。
- 修复两个测试自身隐患：gateway-smoke 取信没带沙盒（一直假绿）、integration-human 裸拉桥漏信进生产。

### 第三期：DSH 清账 + 演员核心（本期）

- **dsh bridge.ts 接公共层电话机**：extends BridgeClient 适配壳；核心补 onParseFail 钩子；3081 重启进程表实证新栈拉桥。
- **engine-events 不硬接**（诚实结论）：894 行豪华版不是薄壳关系，硬套=重写生产最要命文件。瘦身归演员批次与形态 B。
- **`subagent-core.mjs` 演员核心**：词汇/登记/料包/采样器上移；subagent.ts 剪 ~350 行改再导出壳（八个消费方零改动）；native 同批手术（applyUsage 经采样器同名方法保留给 0.1.3 流帧路径）。
- **帧映射收敛**：`broadcastActorStreamChunk` 收口——dsh 内部四份 chunk→femo_stream 翻译只剩一份。
- **`node-retry.mjs` + `delivery-queue.mjs` 上移**：dsh 改壳（空子类导出保 class 值+类型双语义——const 导出丢 instance type 的 TS2749 教训）。

---

### 收官期（2026-09-23~09-24：十连裁落地 + 公共层收官，十二刀）

明细见 git log（e29e499→06834f6）。刀序：ai_retry 拔管→Variable API→开演信→插话信化→node_retry 信化→单通道主刀（删兜底+修邮差+面单入库）→镜簿上收 run-state-core→措辞单份化（PLAY_BROADCAST）→B1 waitingHuman 归一→B3 停演裁决 run-control-core→A1 桥启动三件 bridge-launch→A2 hub 发现 hub-client→A3 收信口分拣 mailbox-push-core→B2 分诊台 v2→A4 身份契约（桥去 'dsh' 魔法/who_move 按铃铛/state-files 去回落/zcode 补双词）。验收=3081 实机演出全链 + 单测/回归 300+ 过 + 每刀重启武装 VERIFY。

### cast 期（2026-09-25：多主会话互聊，dsh 侧五刀 + 上收 hub）

「多主会话互聊」=会话↔角色绑定。dsh 五刀（c22b461→36cf825）：绑定按钮（会话 header 下拉选 soul）+两段式账本（先本地后上收）→派工分流（mailbox-push brief-actor 查账：绑定角色走会话本尊 runMainModelTurn 泛化机器、交卷 soul=角色自己，无绑定照旧子代理，绑定会话不在 store 大声报错）→上收 hub（cast-core.mjs 客户端+hub cast 账两半场+API 四路）→since_t 对齐删除（zcode 裁决采纳）→换场清场补全（clearGuestActors 保守清客串）。真演出 job 2562 混合形态（1 绑定本尊+4 子代理+main）金标准通过。**与 zcode 并行线对账**：zcode 的 femo_possess 附身工具同日落地（f6796fe/16294c8），两本账撞车后拍板账本合一——zcode 换轨 cast-core/hub 正身（进行中），soul-bindings.json 退役；契约权威=PROTOCOL §5.7。已知挂账：多 hub 内存缓存分叉（双实例各嵌 hub、hub.json 最后写赢）、角色窗本尊标注待 soul→actor 名映射、绑定 sid 投影窗显示待修整（随投影窗重构）。

## 八、验证体系（每期的验收标准）

1. **构建**：dsh `npm run build`（esbuild 把公共层 bundle 进 lib/）。
2. **typecheck 对基线**：tsc -p tsconfig.host.json 的错误数与类别对照基线——只允许减不允许增。基线错误（`@deepseek-ai/*` 模块解析、FemoSessionEventLike 版本漂移等）是另一个待修的债，不是本重构的回归面。
3. **zcode 全家桶**：projection-writer(10) + event-router(7) + bridge-client(7) 单测、bridge-smoke（真桥）、mcp-smoke（挂载→开演→干跑→暂停）、gateway-smoke（13 项）、integration-human（全链路）。全绿才算过。
4. **平铺态冒烟**：dist 重建后以安装态布局实测 MCP 握手+工具。
5. **上线实证**：3081 重启后查进程表——桥的命令行路径是硬证据。
6. **三份同步纪律**：开发仓 → dist（sync-zcode-dist.ps1）→ 安装缓存（手工拷贝，真正生效的副本）。GitHub 镜像与 npm 压着，**全部做完验证通过才发布**。

---

## 九、踩坑档案（后人勿重蹈）

1. **局部名引用模块级函数**：桥 `ensure_default_data` 引 `main()` 局部名 femo_api → 永远 NameError 被 except 吞。同款坑出现过两次（set_db_path 的 UnboundLocalError 文档在案）。教训：桥里引擎门面一律 `global` 声明。
2. **懒初始化不够**：`check` 等命令不等 job_start 的懒建表——`--db` 全新沙盒库第一个命令就会撞缺表。初始化提到桥启动时。
3. **沙盒隔离是三通道不是一条**：DB、信箱、投影各查一遍。测试信漏进生产信箱会被钩子当真通知注入——用户看到的是「幽灵通知」。
4. **测试的沙盒要两端一致**：服务器带 FEMO_DATA_DIR、测试取信不带 → 翻错柜子 → 断言假绿（隔离修复前只有一个柜子所以从未暴露）。
5. **再导出壳的类要空子类**：`export const X = CoreX` 丢 instance type（TS2749）；`export class X extends CoreX {}` 值与类型双保。
6. **采样器提取时别把邻近定义一起裹走**：actorKey 定义在原三件套区域顶部，剪块时一起没了——typecheck 立刻抓到（这正是每步跑 typecheck 的价值）。
7. **上移函数前先查它的引用面**：femo_bridge.py 靠 sys.path 找引擎所以搬家零成本；但每处硬编码路径（bridge.ts/bridge-manager/tests×5/sync 脚本（tests、scripts 现居 developer/ 下））都要 grep 清零。
8. **文档措辞的坑**：「dsh 写个薄壳就能接」——对电话机成立，对 engine-events 不成立。承诺前先读代码，读完如实修正口径。
9. **轮开闭账不属于清场，捕获必须有锚点**（2026-09-23 事故，Job 2471 + Job 2472 两场
   实证）：2471：主模型自己调 pause/resume 排障时用户轮还在飞；resume 的 flow_start 走
   `clearMainPlayState` 把「第 N 轮在飞」一起 forget → 主模型料包信（驿站直推，链路本身
   没错）误判「无在飞轮」→ steer 进正在跑的用户轮（通知被吞、那句戏内台词静默丢失）；
   随后 pending 仍活着，**下一条任意 turn/start（几分钟后用户发起的戏外轮）被认领成交卷
   轮**，排障回答被当台词寄给引擎。2472（同一 bug 的另一张脸）：开演信开的聊天轮还在跑时
   收到主模型料包信 → 同样立即 steer；紧接着 meow-memory 的**反思任务**开下一轮 →
   **整篇记忆反思输出被当成 [看牌]_6 台词**。三条修为：①清场只清排队件/在飞 pending，
   轮开闭是宿主会话事实，任何 flow 事件都不许动它；②交付前另查 driver 实际状态（账本会
   失真，`agent.status` 不会）；③捕获加锚点——交卷前必须确认「**这一轮是由我们那条通知
   开出来的**：首条 admitted 消息即它、首步 claim 吃到它、且没混真人消息」（纯函数
   `main-actor.captureVerdict`：settle/requeue/wait），脏则把注入退回队列重投，没认领则
   继续等。回放测试见 `developer/tests/main-delivery-queue.test.mjs`（integ-5 + 8 项裁决单测）。

---

## 十、剩余工作（2026-09-24 重写：结构性批次全部收官，只余发布与过渡项）

> 本节 09-22/09-23 版的批次 A/B/C/D 明细已完成历史使命，全部落地并入 §七 收官期条目；
> 逐刀明细与验证记录见 git log（e29e499→06834f6）。

### 剩余（按用户判据「公共层已有、别家重抄不追；公共层缺+≥2 宿主写=收」收窄）

1. **发布**：GitHub 镜像 + npm。真演出总验收已过（八刀上过场）；发布前按惯例
   验一次 autoclaw 装机形态（静态导入无 TLA——815e2d8 夹带教训）。
2. **autoclaw 过渡项（宿主自取，不追）**：单通道对齐（拆事件侧派工/三本去重簿/
   collect 兜底）→ 换 mailbox-push-core；node_retry 演员重演对应物（one-shot=
   带反馈重跑，无租约）；FEMO_PUSH_PORT 修复+信封协议对齐后在真 OpenClaw 环境
   实测一场。
3. **挂起决策**：~~已退役-subagent.ts 彻底删除~~（2026-09-25 刀①落地）；~~zcode hub 化——projection-writer 三窗退役、hub-feed 平移、逐字流草稿层~~（前两者 2026-09-25 落地；逐字流 2026-09-26 落地=交卷薄壳 speech-send.mjs 喂草稿——ZCode 无逐字观测面，「提交即上墙」，收口归桥；缓存更新与真演出验收待做）；deepseek 宿主复活（补
   hub 注册+驿站两阶段；现挂起维护是有意决策）；多 hub 并存账本互斥（单桥在跑
   时不成立）。
4. **测试债**：tsc 存量基线 17 错（@deepseek-ai 模块解析/版本漂移；2026-09-25 重构开工当日实测定基线，此后只减未增）另立债清偿；
   femoparser_validation.test 旧目录时代死测（找 python/goblin-demo.femo）待删；
   gateway-smoke 持久沙盒跑前注意陈信。

## 十一、终局愿景（形态 B 与功能向）

**结构终局**：引擎演戏；桥=神经末梢+搬运工+分诊台+誊抄间（产信/公告栏/小黑板全在事件现场单份产出）；驿站=柜子；宿主=读屏器+席位（dsh 的席位是会话窗与 steer，zcode 的席位是 MCP 工具+钩子+终端席）。到那时本文 §4.4 的形态 A 分诊台完成历史使命自然退化，两条宿主的事件面代码趋近于零。

**功能向后续**（依赖结构终局或至少桥的稳定）：

1. **Block Collector ask 过桥**：collect_blocks 的 14 个参数全是引擎内存活体（action 对象/VarFacade/Evaluator/Runner）——序列化不了也不该上路。宿主→驿站只带业务参数（to + want），桥用 runner 活状态补齐胖参数，文本原路捎回。**凡参数表含活体对象的引擎能力，只有桥进程有资格调**。
2. **演员信分发（phase3）**：驿站当前只送 to=main；角色料包已走 context 信，演员的发言催办/多演员并发投递等宿主 Carrier 机制待设计。
3. **窗两段式**：历史从驿站账本回放 + 实时流从宿主来，接缝=账本序号——形态 B 落地后的自然产物。

---

## 附：快速判决手册

> 【2026-09-26 单页化】本手册与散在各守则里的公共层操作约束已汇总为单页：docs/Specs/公共层设计约束.md——动公共层前过那一页；本附录保留为历史出处，两边打架以守则原话为准。

改代码前问自己：

- 这段逻辑换一个宿主还成立吗？→ 成立：进公共层；不成立：留在适配器。
- 它是「判断/翻译」还是「持有形态」？→ 前者公共层优先；后者永远是宿主的。
- 同样的语义已经有几份了？≥2 必须合并；=1 先等第二个消费方。
- **公共层已有的、别宿主又抄一遍的 → 不追**（宿主侧债宿主自取）；**公共层缺的、
  ≥2 宿主都在写的 → 收**（09-24 用户判据）。
- 新增引擎事件？→ 分诊表加一行（公共层），落点各宿主自接；需要通知导演/演员的，桥产信进驿站，不走路由器。
- 新增工具？→ 总纲加规格与执行体，两边注册壳零改动自动获得。
- 写测试？→ 先确认 FEMO_DATA_DIR 三通道都进沙盒（DB/信箱/投影）。
