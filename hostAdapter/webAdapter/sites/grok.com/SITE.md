# grok.com/ — Grok 官网的户口本

本文件夹 = Grok 官网（**grok.com**；www.grok.com 落到这，2026-09-29 走本机代理探测实证）的知识包。已挂进适配器的站点注册表（`sites.mjs`）。**在役**（2026-09-29 四轮探针取证当日转正）：座席上线、悬浮球亮。网站事实全谱如下，改站先读这里。

## 网站事实全谱（静态侦察 + 四轮真页探针，2026-09-29）

| 事实 | 值 | 取证方式 |
|---|---|---|
| 站点门牌 | `https://grok.com`（www.grok.com 落到这） | HTTP 探测（走本机代理，跳转链落点实证） |
| 应用形态 | SPA；**补全不走 fetch/XHR**——走 **WebSocket**（页面开场即接 `wss://grok.com/ws/mgw/?uid=…`，R1 定谳两道闸只看得见历史加载 `load-responses`，R2 实证补全帧全在此通道） | 四轮探针 |
| **补全通道** | **WebSocket**（事件制 JSON 帧）：`response.created` → `output_item.added` → `content_part.added` → `response.chunk`×N → `output_text.done`/`content_part.done`/`output_item.done` → **`response.done`（status=completed，权威结束）**；**一条 message 会背靠背拼多个事件**（裸 JSON 连排，R4 实证）——解析须按平衡扫描逐事件拆，不能整条 parse | R2-R5 探针 |
| 增量分型 | `chunk.text.text`=逐字增量；`chunk.text.channel` 分桶——`CHANNEL_ASSISTANT_RESPONSE`=正文、`CHANNEL_ASSISTANT_NOTETAKER_HEADER`=思考文本（**思考可见且照收**，用户拍板「能收到就收」）；无 text 的 chunk（ui_layout/phase_marker）不进话 | R3-R5 |
| 历史重放 | 页面加载时 WS 重放 `conversation.history.item`（含完整 output_chunks：布局帧→思考→phase_marker KIND_THINKING_START/KIND_RESPONSE_START→正文）+ `conversation.history.done`——**不进话**，座席只收直播回合（`response.created` 开轮） | R4 |
| 会话页形态 | `/c/<36位连字符 UUID>`（URL 另带 `?rid=<responseId>`；**上一版推测的 /conversation/ 形态作废**——公开资料的非官方客户端与真页不符） | R1 地址上报 |
| 输入框真身 | **`div.tiptap.ProseMirror`**（可编辑 DIV，placeholder「Ask Grok anything」；页上另有空 class 的 TEXTAREA 兄弟节点，被候选次序排后） | R1 盘点 |
| 会话名来源 | document.title 恒「Grok」是死的（R1 标题快照实证，不可用）——靠会话清单/详情 GET 搭车（uuid 形 id+title 同体对象通用收法）；收不到落「无标题会话」，无害 | R1 + 通用走法 |
| 思考可见性 | **协议里思考文本可见**（NOTETAKER 通道逐字流；历史帧同构）——此前判「CoT 隐藏不收集」，用户改判「能收到就收，收不到就算」→ 照收进 thinking | R4 实证 + 用户拍板 |
| 自动化友好度 | Cloudflare managed challenge 把守（裸 curl 与带浏览器头都 403，静态侦察拿不到应用 HTML）；本机直连不通，**一切访问都须走本机代理**——浏览器自己必须能直达 grok.com | 实测 |
| **DOM 收话锚点** | 回答容器=`[data-testid="assistant-message"]`；忙锚=`[aria-label="停止模型响应"]`。testid 清单实证 assistant-message×5 / user-message×4 分侧清楚，五家里语义最硬；忙锚观察窗生成中实证可见，但标签若出自按钮文本而非 aria-label 属性则选择器永远落空=假阴性无害（退化「文本连续 3 拍不变」单条件），精确全等不假阳性 | 锚点收集轮 2026-10-02（取证探针） |

## 流格式要点（正式 inject.js 已实现）

- WS 闸包装构造器，每只新连接补装消息旁听（addEventListener 包装 + onmessage setter 双路 + 兜底旁路；双喂无害——解析器按回合重开，completed 幂等）。
- 残尾缓冲 + 平衡扫描（字符串感知）拆连排事件；`response.created` 开新一轮（清思考/正文、发 'start'）；`response.done` 收口发 'completed'。
- 逐字流：解析器快照有变即发 `phase:'delta'`（全量快照，thinking+content），喂帧处发射。

## 同源 checklist（改站两处同改）

- `SESSION_PATH_RE`：site.mjs 与 content.js 顶部 `SESSION_RE` 镜像（经典脚本进不了 ESM）——改一处必改另一处。
- `sessionRef` 形态（`<域名>:<id>`）：site.mjs 为唯一住处，拼装正身=`extension/seat-agent-core.js`（机器骨架收编后的正身；content.js 经 PAGE_SCRIPTS 首位注入交接）。
- `COMPLETION_PATH`：本站**不适用**（补全走 WS 不走 HTTP 拦截），留空；正式闸语义见 inject.js 文件头。
- manifest.json 的 matches / host_permissions / content_scripts[].js：site.mjs 的登记镜像。
- 改版重新取证：探针对成例在 git 历史（本包探针版=6 轮演进 f15c6ea→445a078 前身，WS 旁听全套在 R2；kimi 4f8de22 前身=三轮含仪表破案、豆包 c2d4497=第一代成例），照 `docs/` 教学抄回再走一遍取证。

## 已知边界与挂账

- **发送姿势待首派工定型**：写输入框（execCommand，ProseMirror 路线）+ Enter 已按成例预置；发送钮候选是通用兜底（R1 快照被 OneTrust 弹窗污染，未见具名发送钮）——真派工发不动会大声失败并附页面盘点，照盘点回填。
- **Cloudflare 人机验证**：页面侧若弹「验证你是人类」，探针与闸只旁听不干预——须人工过一道，这是本站使用前提，不是插件可修的事。
- 思考收集的口径：NOTETAKER 通道是「思考摘要」性质（页面上折叠面板的文案），不是完整 CoT 原文；照收，用户拍板「收不到就算」。
- 会话名搭车字段名未逐一取证（通用收法兜着）；首次真派工看席位名牌即知对错。
- api 探针保留（/rest/app-chat/ 前缀逐条上报）：上游换格式一次下发就能取证。
- OneTrust 隐私弹窗：不干预；若影响 DOM 锚点，人工点掉即可。
