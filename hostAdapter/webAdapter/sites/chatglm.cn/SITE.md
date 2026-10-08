# sites/chatglm.cn/ — 智谱清言官网的户口本

本文件夹 = ChatGLM 官网（**chatglm.cn**；chatglm.com 不通，2026-09-27 探测）的知识包。已挂进适配器的站点注册表（`sites.mjs`）。**2026-09-27 转正**：两轮探针取证（一轮：会话页真形/补全接口/输入框；二轮：流格式全文/结束信号），座席在役（`PROBE_MODE=false`）。

## 网站事实清单（真页实证 2026-09-27）

### 网址与会话身份

- 会话页形态：`/main/alltoolsdetail?lang=zh&cid=<id>`（发首条消息后 cid 才出现；`/detail`、`/prompt` 重定向到 `/main/detail`，实际对话在 alltoolsdetail）。
- 会话 id 格式：**24 位小写十六进制**（Mongo ObjectId 形；领域词 `conversation_id`，recent_list 接口同词互证）。
- SPA 换页不刷新：content.js 靠 pushState/replaceState/popstate + 定时兜底跟踪。

### 网页元件（DOM 锚点）

| 用途 | 锚点 | 取证 |
|---|---|---|
| 输入框 | 全页**唯一可见 `textarea`**（class `scroll-display-none`，无 id、无 placeholder） | 探针元素盘点 |
| 会话名 | **不在 document.title**（SPA 标题恒「智谱清言」，实测）——从页面自取的 `recent_list` 响应搭车收集（inject.js 收、content.js 记，席位心跳带上） | 探针两轮实证 |
| 发送钮 | 未取证（快照为空）——先派 Enter，发不动再点候选（`[aria-label*="发送"]` 等），还不行大声失败附页面盘点 | 待第一次真派工定型 |
| 回答容器 | **`.answer-content .markdown-body`**——回答语义的 markdown 正文（真页类名链：`div.markdown-body.md-body.tl ← … ← div.answer-content-wrap ← div.code-box.flex1`）；只匹配回答不匹配提问，回复没上页时匹配为空=继续等。**教训**：打包代码里搜到的 `markdown-body common-answer` 是另一创作面的类，主聊天不用——侦察级证据必须经真页盘点校验 | 2026-10-02 座席「领养盘点」探针真页实证 |
| 生成中指示 | **`.stop-generate`**（「停止生成」钮，v-if 条件渲染在 loading 态内；真页空闲盘点=命中0，符合「空闲不存在」）。取证只落到创作面加载态，主聊天生成中的停止钮真身未取证——假阴性无害（退化为纯文本稳定判定），不猜 | 2026-10-02 应用包渲染代码+CSS 实证（部分）；真页空闲盘点佐证 |

### 网络接口与流格式（第二轮探针全文取证）

- 补全接口：`POST /chatglm/backend-api/assistant/stream`（自家接口都住 `<xxx>-api/` 命名空间；站内埋点在 `sdata.chatglm.cn/frontend/chatglm/track`，别碰）。
- 流形态：SSE，`data: <整条消息快照 JSON>`，空行分隔（`data:` 后两个空格）。**帧是消息快照不是纯 delta**：`parts[]` 内容分型——
  - `type:"think"`（思考，`.think` 字段）、`type:"text"`（正文，`.text` 字段）、`type:"tool_calls"`（内部信号，如 name:"finish"，忽略）；
  - 中间帧是**增量**；`part.status === "finish"` 的帧带**该段全文**（解析器覆盖不叠加）；
  - 顶层 `status === "finish"` = 生成结束（末帧 `meta_data` 带 `total_time`、`answer_type`）。
- 思考/正文天然分型分段（logic_id 各一段），网络闸直接分两路攒；**DOM 兜底自 2026-10-02 起必备**——查岗收割模型的领养收尾（页冻→reload→从历史渲染）不重放补全 SSE，只认网络闸永远等不到结尾（实案 job 2675：领养死循环卡死发言节点）。

### 查岗收割与领养收尾（2026-10-02 补证）

页被浏览器冻结→查岗轮 reload→领养收尾的判据：网络闸 FINISHED（重连续流才有——本站 reload 后**不重放**，等不到）或 DOM 文本稳定+忙锚消失。两件锚点见上表。已知边界：

- `.stop-generate` 若在主聊天生成中另有真身（未取证），领养收尾在「页冻着、生成仍在服务端跑」的窗口里靠纯文本稳定判定——部分文本停 3 秒即收，可能收半截；真演出若见「收来的全文混入思考文本/半截收话」，照改版取证法复查容器结构。
- 领养收的 DOM 全文若混入思考文本（思考块疑似独立渲染，未逐字验证），同样以真演出目检定谳。

### 改版取证法

- inject.js 保留 api 探针（`-api/` 逐条上报，去重在收端）——上游换接口一次下发就能看见。
- **DOM 锚点改版**：本站 curl 全程被阿里云 WAF 挡（拿到的永远是挑战页）——用真页上下文抓应用包再 grep（登录页 F12 控制台或浏览器自动化在页面内 `fetch` 同源 `.js` 后搜 `class:"…"` 字面量与「停止」等 UI 串）；容器类名是语义命名（`common-answer`/`stop-generate`），非哈希，可锚。
- 流格式变了：`[femo-seat-cglm] 回复已结束但网络闸没有收到正文` 会大声报错；把正式 inject.js 的解析器照新格式改即可。
- 页面 F12 看 `[femo-seat-cglm]` 前缀流水。

### 逐字流（2026-09-28 接线）

- inject.js 解析器**边流边发** `phase:'delta'` 事件：thinking/content 两字段的**全量快照**（发射点=两道闸的行缓冲循环后，每网络块一拍；parts 快照 getter 现算）。发全量不发差量——`part.status==='finish'` 的整段覆盖帧天然被快照语义消化，不需要 append/set 算子过线。
- content.js 节流 400ms 上报 `{type:'delta', deliveryId, thinking, content}`（completed 补发终值），服务端照 zcode「提交即上墙」同款喂 hub 草稿层（drop+delta 两帧两槽，交卷落账自动吸收）。
- delta 只上墙不碰收话——`completed` 帧仍是收话唯一权威；手工聊天也上报（deliveryId 空=纯面板镜像，服务端不喂 hub）——无引擎即可在侧栏「最近收到的回答」验证流式链路（面板在长字=闸→content→background→服务全通）。

## 同源纪律（改站 checklist）

| 事实 | 唯一住处 | 镜像（改站同改） |
|---|---|---|
| 网址/matches | `site.mjs`（SITE_URL/SITE_MATCH/SITE_FENCE_RE） | `manifest.json` 的 `host_permissions`、三段 `content_scripts[].matches` |
| 会话 id 正则 | `site.mjs`（SESSION_PATH_RE） | `content.js`（经典脚本进不了 ESM，内嵌一份） |
| 会话引用拼拆 | `site.mjs`（sessionRef/parseSessionRef） | `extension/seat-agent-core.js`（2026-09-29 机器骨架收编后的正身；content.js 经 PAGE_SCRIPTS 首位注入交接） |
| 会话名提取 | `content.js`（sessionTitle：优先网络闸搭车收的会话清单；`document.title` 剥尾巴只是退路——它是死标题） | `inject.js`（emitTitles 搭车）、本文表格 |
| 接口路径/流格式 | `inject.js` | `site.mjs`（COMPLETION_PATH）、本文档 |
| DOM 锚点/发送姿势 | `content.js` | 本文档表格 |

改完跑 `node --test tests/site-boundary.test.mjs` 与 `node --test tests/runtime.test.mjs`。
