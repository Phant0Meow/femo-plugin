# dshAdapter — dsh 接口侧

Femo 引擎与 dsh 宿主之间的全部胶水代码。与 `femoCompiler/`（引擎本体）、`femoGen/`（编辑器）、`femoBridges/`（引擎 LLM 出口）平级。

分两半，**两半零共享文件**（2026-08-23 重构定的线）：

```
dshAdapter/
├── host/     Node 侧：跑在 dsh 宿主进程，入口 index.ts  → lib/index.js
├── client/   浏览器侧：打进聊天窗 bundle，入口 client.tsx → lib/client.js
└── python/   桥进程 femo_bridge.py（stdio JSON-RPC，host/ 的 bridge.ts 拉起）
```

构建：`build.mjs` 两个 entryPoints 分别指向这两个入口；产物都在 `lib/`，
`package.json` exports 的 `.` / `./client` 不变，dsh 无感。

## host/ — Node 侧模块

- **接入层**：`index.ts`（插件入口，注册钩子/路由/工具）、`config.ts`（配置）、
  `http.ts`、`routes.ts`（`/dsh-femo/*` HTTP 路由 + SSE 事件流）、`host-log.ts`
- **会话钩子与导控**：`pre-step-gate.ts`（轮首拦截 plugin 注入）、`session-events.ts`、
  `tools.ts`（femo-mount/run/debug 等工具注册）、`safe-steer.ts`、`section-gate.ts`、
  `run-control.ts`、`persona.ts`、`main-actor.ts` + `main-delivery-queue.ts`
  （主模型 = 导演；戏内戏外不掺一轮的下场排队）
- **投影窗 / 子代理**：`projection.ts`、`projection-input.ts`、`proj-trace.ts`、
  `subagent.ts`、`subagent-native.ts`、`god-mirror.ts`（上帝窗镜像）、
  `stream-frames.ts`、`windowing-native.ts`、`native-state.ts`、`state-files.ts`
- **引擎桥**：`bridge.ts`（拉起 `python/femo_bridge.py`，stdio JSON-RPC）、
  `femo-files.ts`、`debug-run.ts`（零 token 干跑）、`engine-events.ts`、
  `engine-transcript.ts`（事件重放/转写）、`diag-feed.ts`、`list-cache.ts`
- **重试设施**：`api-retry.ts`（LLM 请求退避）、`node-retry.ts`（节点重演）

## client/ — 浏览器侧模块

- `client-ui/`：聊天窗 React 组件——`composer.tsx`（输入）、`chat-node.tsx` /
  `turn-nodes.tsx`（回合渲染）、`femo-stream-live.tsx`（SSE 活帧）、
  `stream-store.ts` / `view-state.ts`（状态）、`editor-page.tsx` / `editor-view.tsx`
  （编辑器标签页，经 `femoGen/femo_gen_api.jsx` 门面 import 编辑器应用——
  宿主不深入 femoGen/src 内部）、`proj2/`（转写层）
- 散件：`lineage-fork.jsx` / `lineage-fork-native.jsx`（谱系分叉 UI）、
  `fa-icons.tsx`、`femo-reasoning-row.tsx`

## python/ — 桥进程

`femo_bridge.py`（stdio NDJSON JSON-RPC，`host/bridge.ts` 拉起）。引擎面唯一
入口 = `femoCompiler/femo_api.py`（2026-09-13 API 化改造）：桥只准 import 这个
门面，不直接 import 引擎内部模块（parse_script / FEMORunner / JobManager /
db_utils / host_manifest）——引擎内部重构保住门面签名即可，桥与宿主零改动。
私有属性注入（`_human_input_event` / `_host_ai_backend` / `_context_mode`）
已在门面 `create_runner` 收口为显式参数。

零 token 干跑也已收进门面（`femo_api.debug_dry_run`，与 CLI run 子命令同一
实现面），但本宿主仍走一次性子进程 CLI（`debug-run.ts` spawn
`femoToolcall/femo_debugger.py`）：干跑要能被 terminate 不留僵尸、不与运行桥
同进程（门面函数在桥进程内禁用——print 会污染 NDJSON 流）。

## 注意

- `host.manifest.json` 留在**仓库根**——dsh 按插件根目录约定找它，挪进 dshAdapter 会失联。
- `tests/` 里三个 mjs 单测（safe-steer / pre-step-gate / main-delivery-queue）
  用 esbuild 直接打包 `dshAdapter/host/` 的源文件跑，改路径记得同步。
