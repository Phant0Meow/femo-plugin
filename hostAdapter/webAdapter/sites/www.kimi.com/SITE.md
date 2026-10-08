# www.kimi.com/ — Kimi 官网的户口本

本文件夹 = Kimi 官网（**www.kimi.com**；kimi.com 双双落到这，2026-09-28 探测）的知识包。已挂进适配器的站点注册表（`sites.mjs`）。**在役**（2026-09-28 三轮探针取证当日转正）：座席上线、悬浮球亮。网站事实全谱如下，改站先读这里。

## 网站事实全谱（静态侦察 + 三轮真页探针，2026-09-28）

| 事实 | 值 | 取证方式 |
|---|---|---|
| 站点门牌 | `https://www.kimi.com`（kimi.com 也落到这） | HTTP 探测 |
| 应用形态 | Vue 3 单页应用（SPA：任意路径都回同一份落地页，路由前端接管）；主包 CDN `statics.moonshot.cn` | 首页 HTML |
| 接口家族 | **ConnectRPC/protobuf**；自家接口全住 `/apiv2/` 前缀（30+ 条探针上报实证）；proto 描述符 base64 内嵌主包 | 主包字符串筛 + 探针 |
| 补全接口 | **POST `/apiv2/kimi.gateway.chat.v1.ChatService/Chat`**，响应 `application/connect+json` | 探针（发消息即开火） |
| 会话页形态 | `/chat/<UUID>`（36 位连字符 UUID，探针地址上报实证） | 探针 |
| 会话领域词 | `chatId`（主包 274 处） | 主包字符串筛 |
| 输入框真身 | **`.chat-input-editor`**（可编辑 DIV，住 `.chat-input-editor-container` 内；真页盘点实证，页面输入类元素唯一命中） | 探针盘点 |
| 会话名来源 | **document.title 剥「- Kimi」尾巴**（动态标题实证：「猫咪打招呼 - Kimi」→「猫咪打招呼」；落地页 SEO 标题无会话 id 不立席位） | 探针标题快照 |
| 发送姿势 | contenteditable 路线（execCommand 写入 + Enter），发送钮候选常备——**真值待第一次真派工定型** | 照 chatglm/豆包成例预置 |
| **DOM 收话锚点** | 回答容器=`.segment-assistant`（消息级语义段）。二代探针两轮同链：AI 正文住 `…segment-content-box ← segment-content ← segment-container ← segment.segment-assistant ← chat-content-item.chat-content-item-assistant`；思考文本（thinking-container/toolcall-flow 体系）10 层深链未见 segment 字样=思考区在 segment 体系外，锚整段不混思考。备选换锚路（若收话混入思考）：`.segment-assistant .markdown-container:not(.toolcall-content-text)`（思考块的 markdown-container 都带 toolcall-content-text 类，代价是长回复分段只收最后一块）。忙锚未配（收集轮未发消息无证据，宁缺勿猜）——收话退化「文本连续 3 拍不变」单条件 | 锚点收集轮 2026-10-02（二代探针） |

## 流格式（真页取证实录）

**Connect 协议分帧**：content-type `application/connect+json`，每帧 = **1 字节 flags + 4 字节大端长度 + JSON 载荷**（二进制头经文本解码会失真——解析必须在字节上拆，正式 inject.js 的 fetch 闸就是这么做的）。

载荷是状态同步语义（`op: set|append` + `mask`）：

| mask / 帧 | 语义 |
|---|---|
| `block.think.content` | **思考增量**（append=加一笔；首个 set=全量） |
| `block.text.content` | **正文增量**（同上） |
| `block.multiStage` / `block.stage` | 思考阶段结构（不进话） |
| `message.status` = `MESSAGE_STATUS_COMPLETED` | **结束信号之一** |
| `{"done":{}}` 帧 | **结束信号之二** |
| flags 结束帧（0x02，trailers） | **结束信号之三**（三层保险，见其一即收） |
| `{"heartbeat":{}}` 帧 | 心跳，不进话 |
| `mask:"message"` + role user/assistant | 用户/助手消息元数据（不进话） |

**页面习性（要害，凡旁听此站响应必须遵守）**：kimi 前端在每条 RPC 完成的**瞬间** abort 自己的请求 signal——clone/tee 出来的旁听分支与原请求共享中断态，一锤子 `text()` 会被连坐杀死（第二轮仪表实锤原话「signal is aborted without reason」，对照组：页面没 abort 的 401 孤儿请求反而完整捕获）。所以一律**增量排空**：边流边攒，中断时手头已到手的字就是全部（abort 前流已放完）。

### 逐字流（2026-09-28 接线）

- inject.js 解析器**边流边发** `phase:'delta'` 事件：thinking/content 两字段的**全量快照**（fetch 闸=字节拆封循环每块一拍；XHR 兜底闸=花括号扫描后一拍）。发全量不发差量——`op:'set'` 的整段覆盖帧天然被快照语义消化。增量排空习性与此相性天然：abort 前流过的每块都已发过 delta。
- content.js 节流 400ms 上报 `{type:'delta', deliveryId, thinking, content}`（completed 补发终值），服务端照 zcode「提交即上墙」同款喂 hub 草稿层（drop+delta 两帧两槽，交卷落账自动吸收）。
- delta 只上墙不碰收话——`completed` 帧仍是收话唯一权威；手工聊天也上报（deliveryId 空=纯面板镜像，服务端不喂 hub）——无引擎即可在侧栏「最近收到的回答」验证流式链路（面板在长字=闸→content→background→服务全通）。

## 同源 checklist（改站两处同改）

- `SESSION_PATH_RE`：site.mjs 与 content.js 顶部 `SESSION_RE` 镜像（经典脚本进不了 ESM）——改一处必改另一处。
- `sessionRef` 形态（`<域名>:<id>`）：site.mjs 为唯一住处，拼装正身=`extension/seat-agent-core.js`（2026-09-29 机器骨架收编后的正身；content.js 经 PAGE_SCRIPTS 首位注入交接）。
- `COMPLETION_PATH`：site.mjs 与 inject.js 顶部 `COMPLETION` 镜像。
- manifest.json 的 matches / host_permissions / content_scripts[].js：site.mjs 的登记镜像。
- 改版重新取证：探针对成例在 git 历史（本包 4f8de22 前身=三轮探针；豆包 c2d4497=第一代探针成例），照 `docs/` 教学抄回再走一遍取证。

## 已知边界与挂账

- **发送姿势待首派工定型**：写输入框（execCommand）+ Enter 已按成例预置，真派工若发不动会大声失败并附页面盘点，照盘点挑锚点。
- 会话 id 只实证过 `/chat/` 路径下的 UUID；kimi 的 tasks/slides 等产品线若也能当演员，id 形态另取证。
- 落地页标题是死的（SEO 文案）；会话页动态标题实证可用。若某天标题不更新，照 chatglm 包的路数搭 GetChat/ListFeeds 接口便车收 `chatId→title`。
