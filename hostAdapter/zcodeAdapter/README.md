# zcodeAdapter — zcode 接口侧

FEMO 引擎与 ZCode 宿主之间的全部胶水代码。与 `dshAdapter/`（dsh 侧）同栖
`hostAdapter/`（宿主适配层，2026-09-13 归拢）；引擎侧的 `femoCompiler/`（本体）、
`femoGen/`（编辑器）与边界层 `femo2host/`（门面 API + CLI 工具箱）在仓库根——
整个仓库双宿主：dsh 装 dshAdapter，ZCode 装本目录
（根 `.zcode-plugin/plugin.json` 的组件字段指进 hostAdapter/zcodeAdapter/）。

## 结构

```
zcodeAdapter/
├── paths.mjs                   落点解析唯一出处（引擎根/数据根/公共层 importCore/宿主自称）
├── mcp/                        导演会话面（MCP 进程内的一切，随会话启动长驻）
│   ├── femo-server.mjs         MCP stdio 入口（总纲工具全套零本地实现 + 总装 + 名册 announce）
│   ├── engine-bind.mjs         常驻引擎直连绑定（2026-09-26 换芯直连；2026-09-28 由 bridge-manager 正名）
│   ├── event-router.mjs        分诊台薄绑定（公共层 event-core v2；投影落点缺省空）
│   └── 已退役-gateway.mjs      本地 HTTP 网关（2026-09-28 退役静置：生产零消费，待移 mytrashbin）
├── runtime/                    演出循环机件（钩子与守夜共用的宿主私有件）
│   ├── femo-possess.mjs        附身+守夜一体（2026-09-28 自前身 femo-sentinel 正名扩能：参数口径同 femo_possess 工具；自证附身=CLAIM 暗号→exec 目录搜回本窗会话号→公共层链路落账；带 --session_id 为派角一次性；守夜=盯信柜，信到退出=宿主原生唤醒窗口）
│   ├── speech-collect.mjs      表演回合收集器（挂牌握手、全程收集、自动交驿、草稿上墙）
│   └── pulled-letter.mjs       信件注入文案（纯函数，单测锁死「零命令教学」）
├── hooks/                      宿主钩子（hooks.json 接线，4 秒寿命内必答）
│   ├── hooks.json              UserPromptSubmit→mail-context / Stop→stop-intent / PostToolUse→turn-collect
│   ├── lib.mjs                 薄客户端共享库（取信/收卷/插话/捕获/认领消费，直连驿站/引擎/hub）
│   └── mail-context / stop-intent / turn-collect .mjs   三个一行薄入口
├── skills/femo/SKILL.md        工作流教学 + 语法文档指路
├── commands/                   /femo 快捷入口
└── tests/                      node --test 单测 + 冒烟 + 内存投影 store（memory-store.mjs）
```

## 投影与 hub（2026-09-25 现状）

投影历史的唯一数据面是**投影中心 hub**（`femo2host/projection_hub.py`，跑在
常驻引擎进程里），宿主侧不自存投影历史。zcode 与 hub 的三根管子：

- **FEMO内行**：常驻引擎的 EventProjector 在引擎事件现场喂（所有宿主同一根管子），
  行带 `source=zcode`，落 `user_data/projection/<job_id>/`。
- **FEMO外行**：Stop / UserPromptSubmit 钩子把宿主转写（transcript_path）直喂
  hub /feed（公共层 hub-feed-core，**运行中**才录——running 闸=探常驻引擎
  /engine/health 的 bound_jobs，闲时不录，防普通聊天混进历届主会话），
  按行协议 §5.5 会话寻址直投会话账本，src_seq 幂等（角色哨兵会话绝不捕获）。
- **名册**：启动运行即 `POST /sessions/announce`（upsert+bind femo-main）——
  投影中心网页的主会话面板与 god:zcode 视角由此认得 zcode。

逐字流走 hub 草稿层（2026-09-26 无子代理化定稿）：ZCode 不向插件暴露逐字观测面
（钩子只有七个边界事件，无 token 流），交卷改由 Stop 钩子自动收卷（hooks/
speech-collect.mjs）——模型被节点信唤醒后的整回合发言（text/thinking/tool_use
分类压平，纯文本回合原样零污染）在收尾时自动交驿站，同拍把台词按 wait_key 喂
hub 草稿层（draft-drop+draft-delta 同帧批发，重跑不叠字），投影页「提交即上墙」；
收口权仍归引擎出站（段由引擎在 ai_request 开、落账吸收定稿，双份由 hub 兜住）。
粒度到不了逐字，比「等整段落账」早一拍。观看实况与回看一律读投影中心网页
（hub `GET /view`）；本地网关（femoGen 画布面）已于 2026-09-28 整体退役
（生产零消费：画布 bundle 要的是 dsh 路由词汇，从网关打开的画布实时面 404）。

## 运行测试

```bash
node --test zcodeAdapter/tests/event-router.test.mjs   等单测
node zcodeAdapter/tests/hooks-smoke.mjs                钩子直连集成（含 hub 实读断言）
node zcodeAdapter/tests/main-actor.mjs                 主Agent循环端到端（旗舰场景）
```

冒烟沙盒锚在本目录 `.tmp/`（持久沙盒，跑之前注意旧信干扰）；**必设
FEMO_DATA_DIR 沙盒隔离**——DB/驿站/hub 三通道都进沙盒，漏任何一条测试的信
就会漏进生产。

## 注意

- 本侧的 `zcode.host.manifest.json`（`host:"zcode"`）经直连客户端随场注入引擎
  （job_start/job_resume 的 _host_manifest），与 dsh 侧仓库根 `host.manifest.json` 互不干扰。
- `FEMO_ROOT` env 显式重定向引擎根（当前指向开发仓，与 dsh 共用同一套
  剧本/台账——共享数据根=同一个租户，是拍板过的设计）。
