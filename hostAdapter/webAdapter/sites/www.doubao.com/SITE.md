# sites/www.doubao.com/ — 豆包官网的户口本

本文件夹 = 豆包官网（**www.doubao.com**；doubao.com 双双落到这，2026-09-27 探测）的知识包。已挂进适配器的站点注册表（`sites.mjs`）。**2026-09-27 转正**：一轮探针取证（会话页真形/补全接口/事件制流格式/输入框真身），座席在役（`PROBE_MODE=false`）。

## 网站事实清单（真页实证 2026-09-27）

### 网址与会话身份

- 站点门牌：`https://www.doubao.com`（聊天页 `/chat/` 即落地页）。
- 会话页形态：`/chat/<纯数字长 id>`（实测 17 位；发首条消息前先短暂出现 `local_` 前缀的本地临时号，正式号随后顶上——正则只认纯数字，天然避开临时号）。
- SPA 换页不刷新：content.js 靠 pushState/replaceState/popstate + 定时兜底跟踪。

### 网页元件（DOM 锚点）

| 用途 | 锚点 | 取证 |
|---|---|---|
| 输入框 | `#input-engine-container` 里的 **ProseMirror 富文本编辑器**（`div.tiptap.ProseMirror`，contenteditable）——豆包自家代码就用 `[data-chat-input]`、`#input-engine-container` 锚输入区 | 探针输入区盘点 |
| 发送钮 | 未取证——先派 Enter，发不动再点候选（`[aria-label*="发送"]` 等），还不行大声失败附页面盘点 | 待第一次真派工定型 |
| 回答容器 | **`[data-testid="message_text_content"]`**（2026-10-02 领养盘点实锤转正：探针在 152 字真实回复块上打出该 testid，祖先链的 `container-*` 全是 CSS module 哈希类名不可锚；`lastReplyText` 取 querySelectorAll 最后一个=最新回复，与页上一问一答追加布局吻合） | 领养盘点 2026-10-02（job 2683/2684 实案） |
| 生成中指示 | 未取证——「停止生成」钮真身没抓到，宁缺勿猜（假阳性会卡死领养）；收话判定退化为「文本连续 3 拍不变」单条件，假阴性无害。后续照盘点探针的可见按钮快照取证 | 待取证 |

### 网络接口与流格式（探针头尾 4KB 全文取证）

- 补全接口：`POST /chat/completion`（自家其余接口住 `/alice/` 命名空间）。
- 流形态：**事件制 SSE**——帧是多行的 `id: N` / `event: 名字` / `data: {JSON}`，空行分帧。事件种类：
  - `CHUNK_DELTA` `{"text":"…"}`：**正文增量**（逐字；不含 message id，一场一个回复直接攒）；
  - `SSE_REPLY_END`：**结束信号**（`end_type` 1/2/3 连发三帧；end_type=1 的 `msg_finish_attr.brief` 带全文，可做对账兜底）；
  - `SSE_ACK`：开场帧，`ack_client_meta.conversation_info` 带 `conversation_id + name`——**会话名搭车来源**（网络闸收到即报，content.js 记账）；
  - `STREAM_MSG_NOTIFY`（数据键 content/meta/attr）：**正文快照通道**（2026-10-03 job 2690 仪表实证）——开场 Notify 带着正文开头、CHUNK_DELTA 只续后面，「SET V」啃头两案的头都在它车里；解析器保守合并：只认明显同一条正文的更长快照（空账收头一块、攒到的 text 是快照的头或尾都改用快照），对不上不碰；
  - `FULL_MSG_NOTIFY`（用户消息整包）、`STREAM_CHUNK`（块结构补丁，patch_object=111 是 TTS 镜像文本）、`SSE_HEARTBEAT`（空心跳）——不进话。
- 思考（CoT）：观测流内未见分型（短对话；若深度思考模式有，照取证法补——`thinking` 一路已留位）。
- 正常路径收话以网络闸为准（FINISHED 一到即同拍直报，亚秒冻结窗口已关——见 seat-agent-core `reportReplyNow`）；DOM 兜底是静默阶梯领养收尾的救命绳（reload 后不重放 SSE，只能从历史 DOM 收全文），回答容器已转正（见上表）、忙锚未取证。
- **分帧与对账三道防线（2026-10-03，job 2689 啃头实案）**：引擎收到的台词被啃掉头 5 字（「SET V」没了，赋值正则对不上）——根因=解析器分帧只扫 `\n\n` 空行，SSE_ACK 与首条正文增量之间用 `\r\n\r\n` 分隔时两帧并成一帧、JSON 解析失败被静默吞掉；是否触发取决于那条流行尾用哪种（服务端/代理行为），所以时好时坏。三道：①feed 时 `\r\n` 归一成 `\n`（跨 chunk 拆开的 `\r\n` 同吃）；②收尾对账——攒到的正文恰是 `SSE_REPLY_END` 全文（`msg_finish_attr.brief`）的尾巴且更短 = 攒的时候丢了头，改用全文；③解析丢弃/未知事件随 completed 的 `diagKeys` 上报进服务日志（seat-agent-core 的「键样例」槽），不再静默。回归锁 `tests/doubao-parser.test.mjs`。

### 会话名

双来源：SSE_ACK 搭车收的 `conversation_id → name`（主，content.js `titleBySid`）+ `document.title` 剥「豆包」尾巴（备，react-helmet 动态标题；剥完为空=无名）。content.js 上线日志带 `会话名解析校准：raw=… → …` 行，真页不符照日志校准。

### 改版取证法

- inject.js 保留 api 探针（`/alice/` 逐条上报，去重在收端）——上游换接口一次下发就能看见。
- 流格式变了：`[femo-seat-doubao] 回复已结束但网络闸没有收到正文` 会大声报错；照本节原话改解析器。
- 页面 F12 看 `[femo-seat-doubao]` 前缀流水。

### 逐字流（2026-09-28 接线）

- inject.js 解析器**边流边发** `phase:'delta'` 事件：thinking/content 两字段的**全量快照**（发射点=两道闸喂帧后，每网络块一拍）。**本站流内无思考分型（见上），delta 的 thinking 恒空**——草稿层只有正文槽在写；分型上线后照取证法补。
- content.js 节流 400ms 上报 `{type:'delta', deliveryId, thinking, content}`（completed 补发终值），服务端照 zcode「提交即上墙」同款喂 hub 草稿层（drop+delta 两帧两槽，交卷落账自动吸收）。
- delta 只上墙不碰收话——`completed` 帧仍是收话唯一权威；手工聊天也上报（deliveryId 空=纯面板镜像，服务端不喂 hub）——无引擎即可在侧栏「最近收到的回答」验证流式链路（面板在长字=闸→content→background→服务全通）。

## 同源纪律（改站 checklist）

| 事实 | 唯一住处 | 镜像（改站同改） |
|---|---|---|
| 网址/matches | `site.mjs`（SITE_URL/SITE_MATCH/SITE_FENCE_RE） | `manifest.json` 的 `host_permissions`、三段 `content_scripts[].matches` |
| 会话 id 正则 | `site.mjs`（SESSION_PATH_RE） | `content.js`（经典脚本进不了 ESM，内嵌一份） |
| 会话引用拼拆 | `site.mjs`（sessionRef/parseSessionRef） | `extension/seat-agent-core.js`（2026-09-29 机器骨架收编后的正身；content.js 经 PAGE_SCRIPTS 首位注入交接） |
| 会话名提取 | `content.js`（sessionTitle：SSE_ACK 搭车为主、标题剥尾巴为备） | `inject.js`（SSE_ACK 搭车）、本文表格 |
| 接口路径/流格式 | `inject.js` | `site.mjs`（COMPLETION_PATH）、本文档 |
| DOM 锚点/发送姿势 | `content.js` | 本文档表格 |

改完跑 `node --test tests/site-boundary.test.mjs` 与 `node --test tests/runtime.test.mjs`。
