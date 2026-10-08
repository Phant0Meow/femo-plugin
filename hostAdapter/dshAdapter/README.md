# dshAdapter — dsh 接口侧

Femo 引擎与 dsh 宿主之间的全部胶水代码。现居 `hostAdapter/`（宿主适配层，
与 `zcodeAdapter/` 并列，2026-09-13 归拢）；引擎侧 `femoCompiler/`（本体）、
`femoGen/`（编辑器）与边界层 `femo2host/`（门面 API + 公共层）在仓库根。

两半，**两半零共享文件**（2026-08-23 重构定的线）：

```
dshAdapter/
├── host/     Node 侧：跑在 dsh 宿主进程，入口 index.ts  → lib/index.js
└── client/   浏览器侧：打进聊天窗 bundle，入口 client.tsx → lib/client.js
```

（原第三半 python/ 已退役：旧桥 femo_bridge.py 转发壳 2026-09-26 随常驻化移
mytrashbin，最后的开发工具 dev-bridge-test.py 2026-09-27 移 mytrashbin——
引擎收编常驻进程 femo_daemon.py 后宿主不再拉 Python 桥。「三半」成史称。）

构建：`build.mjs` 两个 entryPoints 分别指向这两个入口；产物都在 `lib/`，
`package.json` exports 的 `.` / `./client` 不变，dsh 无感。
构建前 `check-imports.mjs` 先做跨文件引用体检。

## host/ — Node 侧（2026-09-25 九刀分区，依赖只向下；细则见 ../AGENTS.md §二）

- **总装与接入**：`index.ts`（总装车间：门面 / apply 编排）、`config.ts`（配置）、
  `bridge.ts`（常驻引擎直连，daemon-client 组合模式）、`bridge-supervisor.ts`
  （C1 自愈：暴毙清账 + respawn + 熔断）、`job-index.ts`（断电索引重建）、
  `http.ts`（readBody/writeJson/SSE 广播）、`verbs.ts`（喊话动词）、`sse.ts`
  （SSE 插座）、`femoIdentity.ts`（会话身份轴：有戏有账即 FEMO 会话，
  2026-10-07 去预设后的唯一尺子）、`femo-skill.ts`（把 FEMO 教条注册成全局
  skill `/femo`，另挂 femo:root 与 femo:tips 两段全局系统提示）
- **events/ — 事件调度**：`engine-events.ts`（运行中总调度：记账/黑板/终态清场
  走公共分诊台，本地只剩 dsh 物理动词）、`pre-step-gate.ts`（轮首门卫裁决，
  纯函数单独立件）、`mailbox-push.ts`（驿站收件口：按信分流——主演唤醒 /
  插话转交 / 重试面单；2026-09-27 自根目录归位）
- **actors/ — 席位执行体**：`dispatch.ts`（唯一派工体）+ `main/`（主演下场四件：
  capture 捕获表与裁决 / delivery 交付排队 / notice 注入文案与流水 / index 主入口）
  + `native/`（常驻演员四件：index 主流程 / registry 复用注册表与串行锁 /
  turn-watch 回合追踪与打捞 / child-setup 首建设置）
- **projection/ — 幕布形态件**：`projection.ts`（窗生命周期 / 写盘权 / 去重账本）、
  `windowing-native.ts`（原生构建兼容层 + 镜像重放）、`hub-anchor.ts`（锚行常量）
- **hub/ — 公告栏四口**：`hub-feed.ts`（喂送）、`hub-proxy.ts`（只读代理）、
  `god-mirror.ts`（戏外旁挂）、`stream-frames.ts`（直播帧桥）
- **routes/ — 前台**：`index.ts`（纯注册表）+ 按域处理体：`state.ts`（会话状态）、
  `run.ts`（开演与人类输入）、`script-files.ts`（会话剧本文件）、`dialogs.ts`
  （系统文件对话框，全仓唯一实现）、`projection.ts`（投影窗查询）、
  `projection-input.ts`（投影窗输入三路路由；2026-09-27 自根目录归位）
- **diag/ — 诊断区（正式工与临时探针分院）**：`diag-feed.ts`（诊断账本）、
  `debug-log.ts`（排障日志统一落点：时效 + 轮转两道闸）、`host-log.ts`
  （宿主话语采集）；临时探针住 `diag/probes/`（现无在役探针）
- **compat/ — 版本胶水小件**：`native-state.ts`（模式旗标，专断模块环）、
  `dsh-session-host.ts`（会话宿主实例桥，经构建别名顶替官方包，挪它要连
  build.mjs 对账）、`session-events.ts`（事件读取双兼容）、`list-cache.ts`
  （persistence.list 指纹缓存）、`plugin-source.ts`
- **根目录横件**：`persona.ts`（人设）、`session-roster.ts`（名册，身份族留根）、
  `actor-name.ts`（执行者名唯一取值口）、`actor-usage.ts`（角色占用档案，
  私产下推件）、`engine-transcript.ts`（引擎档案转写翻译官）、`api-retry.ts`
  （LLM 请求五段退避）、`safe-steer.ts`（steer 守卫）、`run-control.ts`
  （开演/运行控制裁决面，routes + tools 共享执行体）、`debug-run.ts`（零 token
  干跑，同上共享）、`tools.ts` + `tool-deps.ts`（工具注册与执行依赖组装）、
  `main-actor.ts` / `main-delivery-queue.ts` / `femo-files.ts` / `state-files.ts` /
  `node-retry.ts`（再导出绑定壳——developer/tests 打包点名这些路径，壳必须保留）
- `data/`：dsh 私产抽屉（投影窗镜像 proj-mirror、角色占用档案 actor-usage），
  宿主内部状态不进共享 user_data（2026-09-25 私产下推裁决）。

## client/ — 浏览器侧模块

- `client.tsx`：总装（slots 注册：chat 节点 / composer / 视角与选角按钮 /
  编辑器页 / 调试窗 Host 页）
- `client-ui/`：`composer.tsx`（投影窗输入本体）+ `composer-common` /
  `composer-permission` / `composer-ring` / `composer-run-state` /
  `composer-stats`（按状态域分件）、`chat-node.tsx`（会话节点定义 + 行渲染）、
  `hub-window.tsx`（上帝窗）、`view-button.tsx` / `view-state.ts`（视角菜单）、
  `cast-button.tsx`（选角下拉）、`editor-page.tsx` / `editor-view.tsx`（编辑器
  标签页，经 `femoGen/femo_gen_api.jsx` 门面 import 编辑器应用——宿主不深入
  femoGen/src 内部）、`catalog-dropdown.jsx`（子代理目录下拉，仿官方钥匙，
  新旧宿主自适配）、`stream-store.ts`（SSE 共享连接池）、`proj2/`（存量转写
  渲染器：服务旧档案，保留不动）、`hub-constants.ts` / `styles.ts` /
  `primitives-compat.ts`（宿主图标跨版本取用）
- 散件：`lineage-fork.jsx`（谱系分叉 UI）、`fa-icons.tsx`（Font Awesome 内联
  SVG）、`femo-reasoning-row.tsx`（思考折叠行）、`femo-tool-row.tsx`（工具调用行）

## 根目录配置件

- `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml`：插件包与构建依赖
- `tsconfig.json` / `tsconfig.host.json`：host 类型检查基线
- `tsconfig.host-verify.json`：手工类型核对用——借 dsh-src 0.1.7 的 @types 跑
  `tsc -p`（零脚本引用属有意；内嵌本机 dsh-src 绝对路径，勿入公开镜像）
- `host.manifest.json`：宿主能力清单（引擎侧按清单自述读取）
- `cordis.patch.yml`：宿主包补丁声明（package.json `dsh.bundle.patch` 引用）
- `femo-chat.mjs`：手工 CLI 应急工具（读 dsh 会话 zstd）
- `dshPatch/`：旧版 dsh 补丁黑历史存档（守则明说原地不动）
- `build.mjs` / `check-imports.mjs`：构建与构建前体检

## 注意

- **本目录就是 dsh 插件根**（2026-09-13 插件根下沉）：package.json / lib/ /
  cordis.patch.yml / host.manifest.json / tsconfig 都在这里，构建请在本目录跑
  （`npm run build` 或 `node build.mjs`）。引擎侧（femoCompiler / femoGen /
  femo2host / user_data）在仓库根——config.ts 的 femoRoot / engineRoot 负责
  向上指回，仍可被 dsh 配置显式覆盖。
- `developer/tests/` 里打 dshAdapter 源文件的单测（safe-steer / pre-step-gate /
  main-delivery-queue / debug-log）用 esbuild 直接打包
  `host/` 源文件跑，改路径记得同步——`main-actor.ts` 等再导出壳就是为它们
  保留的。`已退役-preset-declare.test.mjs` 随「去预设」退役（缺件即安静跳过，
  件在 mytrashbin），留在 tests/ 当那段历史的档案。
- 干跑（debug-run）走一次性子进程 CLI（spawn 公共层 `femoToolcall/
  femo_debugger.py`），不走常驻引擎：要能被 terminate 不留僵尸、与生产引擎
  结构性隔离——干跑沙盒永不碰生产引擎，常驻引擎死了编译/干跑也得活着。

（2026-09-27 文档对账：本清单按九刀分区现状照实改写，此前版本停留在
2026-08 单文件拆分时代、列了大量已不存在的文件名。）
