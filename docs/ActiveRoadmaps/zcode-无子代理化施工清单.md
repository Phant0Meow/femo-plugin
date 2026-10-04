# zcode 无子代理化施工清单（2026-09-26 定案；常驻化地基重校+施工记录）

> 定案人：作者。一句话：**zcode 侧彻底放弃子代理出演——每个角色=一个独立 zcode 窗口，
> 亲手 possess 一个 soul，各自的哨兵守各自的信，信到自己醒、亲自演、交完接着睡。**
> 依据三条实验：后台监护只对开着会话生效（投信秒醒实测）；完成态子代理不可唤醒
> （两轮心跳实验）；decision:"block" 是唯一唤醒词（continue:true 是哑弹）。

## 〇、地基变更（施工中途隔壁窗口落地，本清单已按此重校）

常驻化第 3 步（f8d4758 等）在本文书起草后落地，zcode 适配器换了地基：

- **Python 桥子进程退役**：femo-server 经 daemon-client（公共层）直连常驻引擎
  femo_daemon.py 的 HTTP 面（发令 /cmd、订阅 /engine/events）。
- **钩子直连**（hooks/lib.mjs 整体重写）：取信直接跑 mailbox.py receive CLI、
  戏外捕获直喂 hub /feed、插话上下文走 /cmd/mail_context——网关 /hook/* 端点
  随转发壳退役，gateway.mjs 瘦身 169 行。
- **信件会话号盖章（刀2/刀3）**：引擎产信带 target_sid；钩子取信按会话号精确
  对号（_sid_ok：信带号须精确相等，无号信宿主级匹配）——「隔壁窗口领不走
  别人 main 的信」（2585 李鬼病根）。
- **possess 提名制**：多会话可同提一个 soul，开演定格按「最后一次指派」选唯一
  演员；hub 409 占用拒绝语义废除。

原清单 §一/§二/§三 按此重校，标注见施工记录。

## 一、施工记录（2026-09-26 凌晨，全部已落地并验证）

| 刀 | 内容 | 文件 | 验证 |
|---|---|---|---|
| 1 | **哑弹修复（关键）**：取信唤醒词 continue:true → decision:"block"（实测宿主无视 continue:true——这是历史上钩子从没叫醒过导演的根因）；顺手修 pullSoulOf 漏传 femoRoot 的潜伏 bug（原写法附身解析永远静默回落 main） | hooks/lib.mjs | main-actor 单测全绿（拦截+领拍+两场交卷+终局+戏外捕获十项） |
| 2 | **possess 认领式**：env 无会话身份时不再报死错——挂 90s 认领牌（soul），钩子下一次触发携真实 sid 消费认领牌 → 写 hub 提名账正身 → 本窗口即刻按新 soul 取信 | femo2host/host/session-registry.mjs（新公共层模块）+ tools-core.mjs possess 分支 + hooks/lib.mjs consumeClaim | 登记簿挂牌/消费/防重三案单测绿 |
| 3 | **登记簿注入**：femo-server 建 session-registry（DATA_DIR/host-history/zcode-sessions.json，MCP 进程与钩子进程跨进程共用文件）注入 possess | mcp/femo-server.mjs | 语法+套件绿 |
| 4 | **哨兵会话号对号**：--session 参数，信带 target_sid 精确匹配（无号信放行，_sid_ok 同款语义） | mcp/femo_sentinel.mjs | 与钩子刀2 同语义 |
| 5 | **开演校验（拒演响亮报错）**：femo_run fresh_start 前，actors 区声明的 ai 角色必须全部已提名——裸 ai 角色（无 soul）直接算缺员；缺=报错列缺员名单+指引认领。提名账为空/投影中心不可达时如实注明并拒演 | tools-core.mjs unboundActorSouls 纯函数导出 + femo_run 集成 | 单测两案（缺员/全绑定） |
| 6 | **测试口径随新契约**：三个测试文件的 continue 断言全部改 decision:"block" | tests/main-actor.mjs、speech-draft.mjs、gateway-smoke.mjs | 套件 38/38 绿（单并发；并行跑沙盒互踩属既有现象） |

缓存镜像已同步（hooks/lib.mjs、mcp/femo_sentinel.mjs、mcp/femo-server.mjs、
femo2host/host/tools-core.mjs + session-registry.mjs）。**生效条件=重开会话**
（钩子脚本与 MCP 进程随会话启动装载）。

## 二、原清单条目重校（弃用/删除项的现状）

| 原条目 | 现状 |
|---|---|
| 「AI 拍直发子代理」架构自述 | **已改**（2026-09-27：femo-server.mjs 头注改为「信送出演窗口、缺员拒演」） |
| FEMO_ACTOR_SESSION=1 角色哨兵会话 + 空工具面 | **注释退役观察期**（2026-09-27：真演出已确认无消费方，ACTOR_SENTINEL 钉死 false、tools/call 守卫与 lib 两处哨兵守卫注释；无恙后连块删） |
| zcode 绑定假名 zcode-actor-session | 认领式落地后新绑定全是真 id；账里旧假名条目等下一次真演出前手工清 |
| 取信唤醒词 continue:true | **已修**（刀1） |
| possess env 身份通道 | **已改直达式**（2026-09-27：possess 取登记簿「最近提交的会话」直达落提名；zcode 侧 selfSid env 注入点注释退役观察期——宿主未来真注入 env 时放开即恢复直绑） |
| stop-intent 回合结束拉信 | **不再是问题**：直连架构里回合结束拉信就是设计内的注入时刻（decision:block 生效后）；原「会漏迟到的信」由哨兵长守补位 |
| 女巫测试演员定义 | 挂账待清（用户级配置，非本仓） |

## 三、金标准验收（下一步）

三窗口真演出扩展版：导演窗（main）+ 两个演员窗（其一可为 dsh 小猫咪）。
验收点：无子代理；非自己拍时各窗口页面真停；插话即时；台词全部入账；
job finished 零报错；全程无手动搬信。

## 四、不受影响面

引擎 femoCompiler、常驻引擎 daemon 的信产格式（本清单只消费）、驿站信柜格式、
hub 账本结构、dshAdapter、deepseekwebAdapter、femoGen。

## 五、无子代理化二期：交卷自动化（2026-09-26 晚，文案先行+代码随后，同日落地）

作者定稿心智模型：**模型只管说人话**——被节点信唤醒后的整回合发言就是节点
台词，收集、分类、交驿全是插件的事；回执命令教学（speech-send CLI）整体退役。
实施顺序=文案先行（82f3e16）+ 代码随后（本批）。

| 刀 | 内容 | 文件 | 验证 |
|---|---|---|---|
| 1 | 文案先行：SKILL 守夜哨兵节按「醒了=本回合就是节点发言」重写；pulled-letter 节点通知按附身灵魂点名、不再教任何命令；跨宿主指南一句话流程/§三/§五-9 重写 | skills/femo/SKILL.md、hooks/pulled-letter.mjs、docs/Specs/跨宿主对话操作指南.md | pulled-letter 单测 7/7（82f3e16） |
| 2 | **表演回合收集器**：挂牌握手（perf-marker/<soul>.json：job/soul/node/ref/转写行数）+ 转写增量收集（text/thinking/tool_use 分类压平，纯文本回合原样零污染）+ 收卷（mailbox send，ref 对号）+ 草稿同拍（提交即上墙） | hooks/speech-collect.mjs（新） | speech-draft 端到端绿 |
| 3 | Stop 钩子接线：交付即挂新牌、见牌即收卷撤牌、演出回合跳过戏外捕获（防会话账本双份）、导演席信件（soul=main）按会话号代领防压柜、会话号缺失退唯一在牌灵魂兜底 | hooks/lib.mjs | main-actor 两拍端到端绿 |
| 4 | 哨兵升级：守到信写牌（收卷握手）+ 输出完整节点通知（替代 500 字截断摘要）+ 数据根 FEMO_DATA_DIR 口径补齐 | mcp/femo_sentinel.mjs | 随真演出金标准验收 |
| 5 | 测试随新契约：main-actor/speech-draft 改「追加转写行模拟表演回合」；沙盒开局清柜（上一轮残留终局信跨测试串场实测假红——本轮领拍捞到别场终局信） | tests/main-actor.mjs、tests/speech-draft.mjs | main-actor / speech-draft / gateway-smoke / pulled-letter 全绿 |
| 6 | 文档对账：AGENTS/README 逐字流条目改口（收卷器为准，薄壳退役观察期） | hostAdapter/AGENTS.md、zcodeAdapter/README.md | — |

遗留与备注：
- speech-send.mjs 零引用进观察期（连块退役待令）；pulled-letter 单测里以
  「不得出现」断言钉死命令教学绝迹。
- 旧「恒 main」回执的根因=渲染器硬编码（pullSoulOf 本身健康，刀1 修的
  femoRoot 漏传是另一处真雷）。
- 生效条件=重开会话（钩子/MCP 随会话装载）；dist 与安装缓存随批刷新。
- 金标准：三窗口真演出扩展版（导演窗+演员窗，其一可为 dsh 小猫咪），
  验收点同 §三，外加「全程模型零命令交卷」。

## 六、二期实战修正（2026-09-26 深夜，job 2602 真演出+三窗口冒烟抓出）

真演出第一场（job 2602，跨宿主 zcode×deepseekweb，含重启续跑）打出的三刀，
全部有探针/轨迹实证：

| 刀 | 内容 | 实证 |
|---|---|---|
| 7 | **宿主转写真容=仅本回合最后一条消息**（README 旧注「Stop=导演最后回复全文」即此意）：整回合转写+行号增量设计在真实宿主上空手而归（首拍静默丢卷）。收卷器改整文件收取、撤销行数握手；纪律改「先架哨兵、后开口」——台词必须是本回合最后一条消息（附带好处：架哨兵的工具调用根本不进转写，台词天然零污染） | 探针 outside.text=72 字恰为末条消息 |
| 8 | **钩子寿命只有 4s**（hooks.json timeoutMs，超时宿主直接杀进程=信已取走应答没写出=信丢失）：附身账查询改读本地投递缓存 soul-hints.json（MCP possess 落账时同步写，dsh「投递缓存+注册回填」同款先例；hub 正身账延迟落盘、HTTP 查询会撞预算，双实证）+收信 spawnSync 收紧 2.5s+钩子异常改 stderr 留痕不再静默 | 女巫用例偶发红+出口探针 pullSoul=main |
| 9 | **防重注只限哨兵写的牌**：钩子交付写的牌（信已消费离柜）不再过滤同 ref 信——否则滞留旧牌把下一个同 ref 新信误吞（测试硬编码 ref+无表演回合=红绿严格交替，六连绿根除） | 出口探针轨迹交替规律 |
| 10 | 测试 harness 竞态：钩子进程 exit 可能抢在 stdout 末块之前，长 JSON 截断→假 {}——改 exit+流结束双条件再解析 | 连跑六遍全绿 |
| 11 | **插话横幅关系裁决**：mail_context 不再广播——钩子传会话号，daemon 回横幅前对班底账（导演=job 档案 host_refs 对上；演员=cast/&lt;job&gt;.json 的 soul→(sid,host) 对上），无关会话回空串（实测任何窗口说话都收到「正在运行中」误导案）；横幅台账号标注澄清；gw-smoke 补无关会话沉默断言+开演带会话号对齐纪律 | femo2host/python/femo_bridge.py、hooks/lib.mjs、tests/gateway-smoke.mjs；gw-smoke 两连绿 |

双开实测（同日，同灵魂两场并行）另暴露两缺口待修：①收卷牌按灵魂一魂一份，并发场次互相覆盖（本场靠时序运气走完）；②同一拍重复产信无防重，钩子来一封注一封多绕一圈回声。修法方向：牌按 (job, ref) 建档；钩子按 ref 已答过去重。

真演出金标准（模型零命令交卷）已达成：Eve 两拍台词全部由收卷器自动收取交驿
（第一拍经「恢复牌+末条消息」路径，第二拍经原生「钩子注入唤醒→架哨兵→开口」
路径）；重启续跑按双词寻址收养在柜信、possess 改绑新会话号，全链无手动搬信。
台账 4398 四行（含小猫咪首拍失败的空行存档与重演）为真容。出口/载荷探针留在
代码里（debug-stop-*.jsonl/json），稳定后撤。

## 七、交卷信封对齐公共层（2026-09-27）

裁决：**交卷信封唯一出处=公共层 executorSpeechArgs，zcode 收卷器不自拼。**
依据：2026-09-27 定形「台词唯一正身=body.steps 末步 reply」，桥出站按
last_step_reply 派生 output、无 payload 兜底；收卷器旧写法把台词只放
--payload、steps（{cot}/{tool_calls}）从不带 reply——纯文本回合走手写信兜底
侥幸没事，转写一旦含思考/工具块，桥派生 output=空、引擎收空台词（节点等于
沉默开演）。旧注释「缺 reply 落回 payload」在桥上并不存在，是想然。

| 刀 | 内容 | 文件 | 验证 |
|---|---|---|---|
| 12 | submitSpeech 改 async，信封改由公共层 executorSpeechArgs 构造（台词并入末步 reply，纯文本回合合成单步——与 dsh 执行体同一信封形状）；lib 调用点改 await（钩子进程退前必须落地）；speech-draft 表演回合转写加思考块锁死契约 | hooks/speech-collect.mjs、hooks/lib.mjs、tests/speech-draft.mjs | main-actor 十项全绿、speech-draft 全绿（含思考块表演回合台词落账）、pulled-letter 7/7 |
| 附 | 顺手修 sync-zcode-dist.ps1 老毛病：语法文档拷贝改逐字路径（旧通配符连 AGENTS.md 也命中且排在前面，语法文档反而落选）；含中文的 .ps1 补回 UTF-8 BOM（PS 5.1 无 BOM 按 ANSI 误读，中文注释即炸解析） | developer/scripts/sync-zcode-dist.ps1 | dist 根 = icon/LICENSE/README/清单/语法文档，五件无多余 |

## 八、全程收集改版（2026-09-27 用户拍板，同日落地）

裁决：**收集窗口=死讯→回合闭合**——从哨兵死讯（或钩子注入）唤醒那轮开始，
思考、每一次工具调用、最终台词全部收集，多步全量进交卷体 steps（生料）；
**结构解释权归引擎**，宿主只递生料不解释。推翻旧「只有末条消息进交卷」的
勉强形态（宿主观测面限制被当成了业务形态）。旧纪律「先架哨兵、后开口」仍
成立（哨兵是唯一的唤醒器；台词仍须是末条消息），但回合内的工具步不再丢失。

| 刀 | 内容 | 文件 | 验证 |
|---|---|---|---|
| 13 | 收集器改版：回合内工具边界折进收集文件 turn-speech/<soul>.jsonl（伪转写行与宿主转写同构，按行去重保序）；收卷两路折叠、分类，思考/工具按发生序进 steps（带序号），台词自立末步 reply（末步已是发言步才合并——「末步 reply=台词」的正身是发言步，不是载着工具调用的步） | hooks/speech-collect.mjs | main-actor 新增四断言：steps 多步、工具步在首、末步 reply=台词、收后清柜；第二场单步（新窗口干净） |
| 14 | 回合内接线：新 PostToolUse 钩子 turn-collect.mjs（薄壳）→ lib onTurnCollect——闸=本席挂牌，无牌回合零收集零开销；收集是 best-effort，绝不卡宿主工具调用 | hooks/turn-collect.mjs、hooks/lib.mjs、hooks/hooks.json | 回合内收集不拦断言；gateway-smoke 全绿（钩子链无回归） |
| 15 | 新牌开窗清残料：交卷后、挂新牌前 discardTurnSpeech——旧过程料不跨场串味 | hooks/lib.mjs | 第二场单步断言 |

已知边界：PostToolUse 事件形态按 Anthropic 钩子惯例取 tool_name/tool_input/
tool_response（多别名兼容）；宿主真名不同时收集文件仍会开格（transcript 收入
兜底），过程料缺失只影响 steps 完整度、不影响台词正身——真演出金标准验收
时按实况校正别名。

## 九、重构收尾（2026-09-28，双子代理独立设计竞标、用户拍板合并方案）

「桥退役+无子代理化+清扫」三轮大改后的适配器整体重构，六刀全部落账。骨架
裁决不变：MCP 总装+钩子直连+守夜哨兵+收卷器四个进程形态各司其职，公共层
消费面零复制。落刀明细（commit 号见 git log）：

| 刀 | 内容 | 验证 |
|---|---|---|
| 1 | 卫生清淤：.tmp-dirty-0256（79 个被 git 跟踪的沙盒陈旧副本，还被 sync 原样拷进 dist）移 mytrashbin；.gitignore 补 .tmp-dirty-*/ 与 mytrashbin/；sync 排除清单补 .tmp-*；bridge-smoke 补 FEMO_DATA_DIR 沙盒（此前直探生产 daemon） | bridge-smoke 修后首跑沙盒实锤 |
| 2 | plugin.json 描述对账无子代理化（旧文案「子代理当角色」与定案正面冲突，且是插件市场门面） | — |
| 3 | 网关退役（作者拍板）：gateway.mjs「已退役-」改名静置（生产零消费：画布 bundle 要 dsh 路由词汇、钩子捕获已直喂 hub、人类输入真通道=hub 页内席）；femo-server 摘全部接线；gateway-smoke 拆网关断言留钩子链断言改名 hooks-smoke | hooks-smoke 22 断言全绿 |
| 4 | 落点归拢：新建 paths.mjs 唯一出处（importCore 五份/数据根五份/HOST_ID 四份归一）；修哨兵写死的开发机绝对路径；钩子 daemonBase 换芯公共层 hub-client（手搓读 hub.json 的历史事故面绝根） | 六冒烟全绿 |
| 5 | 归位正名：runtime/ 区收编哨兵+收卷器+注入文案（消除 mcp→hooks 逆向依赖）；bridge-manager/FemoBridge→engine-bind/ZcodeDaemonClient（桥已退役，旧名撒谎）；femo_sentinel→femo-sentinel；perf-marker→turn-marker；私产五件聚拢 host-history/zcode/ 格（跨宿主同魂撞名绝根） | 六冒烟全绿 |
| 6 | §六双开缺口双修：收卷牌 (job, ref) 一拍一牌+session 选牌（本窗无牌不捡别窗牌）；已答节拍短账 answered-refs.json（24h TTL）防重复产信回声，重演信（notice/node_retry）不走闸；预算收紧 submitSpeech 8s→2.5s、consumeClaim 1200ms（公共层 cast-core 增可选 timeoutMs，只增不改） | 单测 35/35（新增 turn-marker 三项）+六冒烟 |
| 7 | **附身换轨：MCP femo_possess 工具在 zcode 退役，入口改 runtime/femo-possess.mjs 程序**（femo-sentinel 正名扩能，附身+守夜一体）。参数口径与工具完全一致（--action/--soul_id/--host/--session_id）。自证附身（用户拍板）：程序打 CLAIM 暗号（`CLAIM_femo-possess_ACTION=<action>_<时间戳>_<随机6位>_SOUL-ID=<soul>`）→宿主把 stdout 落进 exec/sess_<真号>/call_*.log→程序拿暗号搜回本窗会话号（进程亲缘，替代「最近按回车」直达式猜测——多窗并存猜错窗口、两窗互顶灵魂事故 09-28 两连实证）→走公共层执行体落账（createBridgeToolImpls 同套，list_souls 核对/human 拦截/提名话术单源）→守夜循环原样保留。带 --session_id=派角/解附身别人（一次性落账即退，链路同源复用）；--soul_id main=纯守夜不落账。投递缓存写口收编 session-registry.recordSoulHint（femo-server 内联版随工具退役删除）；搜不到暗号响亮报错 exit 1，绝不静默回落猜测 | 自证 release/自证 possess/派角一次性/main 纯守夜/--host 缺号响亮拒绝 五路真机全过；单测 35/35 |
| 8 | **参数面收口+去戏剧化用词（用户拍板）**：进程只收工具口径四参数（--action/--soul_id/--host/--session_id）——--job（等信不限场，精度由会话号对号承担）、--timeout-min（等信不限时，认领一次守到信来）及 mailbox/out/femo-root/exec-root 内部旗标全撤，路径改既定事实硬编码；SKILL/提示语/stdout 全线去「哨兵/守夜」，只叫 femo-possess 进程、等信就说等信，超时/时间字样一个不提 | 单测 35/35；真机在岗等信实证（窗口=不限→输出不再含时间字样） |
| 9 | **工具轮台账饥饿双 bug 修复（审计 2638 发现）**：真演出四拍全交了卷、台账却只有四句 response——工具轮全程没进账。帧级排查（v1~v3 探针迭代：PostToolUse 确认派发、payload 全量截获）定位双缺陷：①`stashTurnEvent` 的「有 transcript_path 就跳过 tool_use 合成」排他分支——工具边界时点的宿主转写常是空的（它只在回合收尾才装末条消息），tool_use 合成行被饿死，只剩孤儿 tool_result 被折叠按无配对丢弃；②`tool_response` 是结构化对象，`String()` 攒出「[object Object]」。修：合成行与转写互补不互斥（去重兜底）；对象走 JSON 序列化。另一附带发现：折叠的「空台词整包不交」契约会吞纯工具回合（设计内，留档不改） | 单测 35/35；真机复验：攒料=tool_use+JSON 结果，折叠产出工具步（此前恒 null）；探针现场全清 |
| 10 | **钩子三块退役+信消费移交（用户拍板「这三块清掉」）**：①Stop 钩子轮末「取信→注入→挂新牌」检查退役——信的投递/消费移交 femo-possess（领拍三连：取信消费→挂牌→渲染唤醒通知；信滞留 pending 会让重架无限重复叫醒，故消费必须随投递走）；②登记簿「谁刚按回车」提交登记退役——消费方就是直达式猜号；③认领牌消费路径退役——MCP possess 换轨后挂牌入口已死。连带：session-registry.mjs 收缩为只剩投递缓存写口 recordSoulHint（三本账随消费方齐亡）；tools-core 直达式/认领牌分支裁撤（号源全失响亮报错绝不猜）；release 的 soul_id 放宽可选（对齐工具口径）；**收卷定序翻转：先上墙、后交卷**——旧序「先 submit 后 feed」里引擎吸收能抢在喂稿前落地，草稿永久缺席（speech-draft 假红，stash 基线对照实证为旧序结构竞态、换刀提速显形），新序下吸收必然在草稿之后，竞态根灭；测试：main-actor/speech-draft 领拍改走 harness.possessPickup（取信+挂牌同套动作），hooks-smoke 附身改 CLI 派角路、新增「stop-intent 不再代领」回归断言，mcp-smoke 工具面 7→6 | 单测 35/35+六冒烟全绿；speech-draft 定序修正后 4/4 稳定；真机等信在岗复验 |
| 11 | **唤醒轮判别（用户投影窗抓包 2643）**：[speak] 段收进的是开演报告而非真台词——导演开演拍同回合「架进程+flow_start」，死讯在回合中途写牌，收卷器见牌就收、把回合开头的话误当台词并撤牌，真拍子连台词带工具轮整轮漏收（违反落账口径「收集窗口自哨兵死讯起」）。修=回合开合游标（speech-collect 适配器私产 turn-cursor.json：open=UserPromptSubmit 记、close=Stop 记——登记簿已收缩不复活，判据只有 zcode 钩子消费=私产下推）；Stop 收卷前判「死讯晚于本回合开场、且本回合此后未关过」→ 跳过收卷不撤牌，牌和过程料留给死讯唤醒的那一轮（stderr 留痕可查）。**双账真机实证（2643）**：[speak_1] 段 items=tool/tool_result×3+say（投影窗工具卡可见）；Chronica 4455 turn6=4 步（3 工具步+台词步）——「死讯起、全收、双账落」口径全链达成。边界留档：牌无 delivered_at（旧牌）按不判陈=现行行为 | 单测 35/35；真机 2643 [speak_1] 全链入账 |
| 12 | **删 main 席设定（用户拍板「zcode 里就不该有 main」）**：AI-5 误架 main 席实锤死锁（SKILL 教「演完改架 main 等终局」，但交卷静默无自证——它以为交成功了，main 干等散场信、[reply_1] 干等 ai5 进程，两边互等）。删 femo-possess 的 main 特例（传了由角色库核对如实拒绝）+SKILL 两处 main 姿态教学；补等信过滤场务信捎带——本魂拍子信之外，引擎寄导演席 main 的散场/暂停/警告由本窗在岗灵魂进程接住，一窗一魂一条进程不换席，误架物理上不可能；顺带修正 SKILL 过时句（只读信柜→领拍即取信）。公共层的 main（邮箱寻址/产信收件席）是 femo 系统概念不动 | 单测 35/35；缓存已刷（main 姿态字样清零） |

挂账：extractOutside「整场转写疑点」已留取证探针（host-history/zcode/
capture-probe.jsonl 记每次捕获的行数/字节真容），真演出读账定谳后再修或撤。
诚实边界：Stop 收卷路径最坏预算（取信+交卷+草稿竞速）理论上仍可顶破 4s 钩子
寿命，实际均为毫秒级磁盘写/本机 HTTP——结构性根治需重构收卷时序，真演出
金标准护航。
