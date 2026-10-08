# docs — 给改码人的文档区

> 运行时喂给 AI 的教条链（`femo2host/femoGenConnector/SKILL.common.md`、`语法文档.md`、
> 各宿主 preset/commands）**不在本区、也不归本区管**，它们有自己的注入链。
> 本区只收「人（或 AI 贡献者）改代码时要读的东西」，分三类、三个文件夹。

## Specs/ ——长期实时更新的细节契约（随公开镜像发布）

| 文档 | 说什么 | 什么时候读 |
|---|---|---|
| [投影中心行协议.md](Specs/投影中心行协议.md) | 投影中心行协议（proto:1）：账本行、上下行帧、人类输入席规范；第三方宿主十分钟接入清单 | 接投影中心 / 改 projection_hub / 改任何投影端时 |
| [宿主接入清单.md](Specs/宿主接入清单.md) | 接入一个新宿主（或盘点老宿主）要实现哪些接口：接引擎（直连）/工具面/驿站/黑板/幕布五组，每节人话讲是什么 + 怎么接（公共件、注入清单、参照实现、四家对照、接入顺序） | 接入新宿主 / 盘点某家适配器能力面时 |

## ActiveRoadmaps/ ——在途施工的总纲与清单（随公开镜像发布）

| 文档 | 说什么 | 什么时候读 |
|---|---|---|
| [ARCHITECTURE.md](ActiveRoadmaps/ARCHITECTURE.md) | 本轮「公共层收敛」重构的总纲：剧场比喻角色表、三条铁打通道、多宿主收敛原则、实施史与剩余工作 | 改公共层之前必读；改宿主适配器之前建议读 |
| [dshAdapter-重构施工清单.md](ActiveRoadmaps/dshAdapter-重构施工清单.md) | dshAdapter 整体重构的九刀工单：每刀动什么/为什么/怎么验 + 裁决记录 | 动 dshAdapter 重构相关代码之前 |

## CompletedRoadmaps/ ——已完成的施工清单与设计稿（只读不可删；公开镜像不含本区）

引擎代码注释仍按章节号引用这里的施工清单作为语义出处（如「施工清单 v4 §4③」），引用前先验落款。

- 历次重构的施工工单（文件名即主题）：**运行状态链路重构**、**变量与task系统重构**、**停止链修复**、**账本多宿主化**、**node-notice通告节点**、**错误注入续聊**，以及**两个待解决的问题**。代码注释里旧称呼「施工清单 v2/v3/v4」等按 [00-路径对照说明](CompletedRoadmaps/00-路径对照说明.md) 的对照表对到现文件。
- **投影合一设计.md** — 投影语义三实现逐行对照、收敛为 projection-core 的设计定稿。
- **驿站设计.md** — mailbox（驿站）作者亲笔第一手设计意图（已全文收编于 `femo2host/AGENTS.md`）。
- **投影窗重设计-讨论稿.md** — 投影合一的前身讨论稿，已被《投影合一设计》取代。
- **导演手册-driver2.md** — driver2 直驱演出循环的手册。
- **zcode-femo-架构设计-v3.md** — zcode 适配的旧架构设计稿。
- **00-路径对照说明.md** — 档案里 `tests/…`、`scripts/…` 是施工当时现场路径，现已迁往 `developer/tests/`、`developer/scripts/`；档案正文按「只读不改」纪律保持原样。

## 不在本区的常读文件（原地不动）

- 模块守则：仓库根与四模块的 `AGENTS.md`（地图见根文件 §1.1）
- 各宿主适配器说明：`hostAdapter/{dsh,zcode}Adapter/README.md、hostAdapter/autoclawAdapter/readme.md`
- dsh 对 DSH 本体的 fork 改动笔记：`hostAdapter/dshAdapter/dshPatch/MEOW_MODIFICATIONS.md`（私有开发日志，2026-10-08 起连私有源仓 git 也不再跟踪——文件本体留盘，不进任何镜像与 npm 包）
- 对外门面：仓库根 `README.md`（项目介绍）与 `语法文档.md`（.femo 语言规范，兼作运行时 AI 手册）
