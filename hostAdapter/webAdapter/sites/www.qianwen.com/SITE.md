# www.qianwen.com/ — 千问（阿里 AI 助手）官网的户口本

本文件夹 = 千问官网（**www.qianwen.com**；qianwen.com 落到这，2026-09-29 直连探测实证）的知识包。已挂进适配器的站点注册表（`sites.mjs`）。**在役**（2026-09-29 六轮探针取证当日转正）：座席上线、悬浮球亮。网站事实全谱如下，改站先读这里。

## 网站事实全谱（静态侦察 + 六轮真页探针，2026-09-29）

| 事实 | 值 | 取证方式 |
|---|---|---|
| 站点门牌 | `https://www.qianwen.com`（qianwen.com 落到这） | HTTP 探测（直连） |
| 应用形态 | SPA（React 18.2）；主包公开在 alicdn（@ali/qianwen-web 4.9.x） | 首页 HTML + 主包 |
| **补全接口** | **POST `chat2.qianwen.com/api/v2/chat`**（独立子域；查询参数 biz_id/ut/nonce/timestamp 照页面原样）——SSE（content-type=text/event-stream）；静态侦察即实锤（壳页内联阿里风控 Baxia 脚本 checkApiPath 专盯此路径），R2 捕获全流定谳 | pre.js + R2 捕获 |
| 流格式 | SSE；**一条 chunk 里多个 data: 帧背靠背**（帧间 `}\n\ndata:`），按 data: 边界拆帧；载荷=`data:{...}`；**结束信号 = `"sse_end":"1"`**（尾帧）；`communication.resid` 为流内序号 | R2-R6 |
| 帧型分桶 | `messages[].mime_type`：`signal/post`=首帧元数据（意图/黑名单，不进话）；`bar/workflow`=**思考面板**（meta_data.multi_load[] 各步 type=bar_thinking，content.body=思考文本、title=步名、status=processing→complete，source_seq 每步一号，**覆盖式全量快照**）；`multi_load/iframe`=**正文**（meta_data.multi_load[0].content=正文 markdown **全量快照（覆盖式）**，首帧 first_packet=true） | R5-R6 普查 |
| 会话页形态 | `/chat/<32位十六进制>`（URL 另带 ch= 等投放参数） | R1 地址上报 |
| 输入框真身 | 可编辑 DIV（唯一可见输入元素，cls 含 `whitespace-pre-wrap`；受控富文本编辑器）。**写入只走粘贴事件管线（writeMode='paste'）**：2026-10-03 job 2690 首派工实案——execCommand 把 2010 字直接写进 DOM，绕过编辑器状态管线：字看得见、状态不认账，编辑器拒绝一切后续编辑（真人也删不了字）、发送钮永远灰，回合干等保险丝；改走 onPaste 后状态同步归编辑器自己 | R1 盘点 + job 2690 实案 |
| 会话名来源 | document.title 恒「千问-阿里 AI 助手」是死的（R1 标题快照实证）——靠 **/api/v1/session/get 与 page/list 响应搭车**（R1 实证 session/get 响应带 data.title） | R1-R2 |
| 思考可见性 | bar_thinking 面板文本**照收**（用户拍板「能收就收，收不到就算」） | R5 实证 |
| 自动化友好度 | 直连可达、无 Cloudflare；壳页挂阿里风控（Baxia 无痕验证，专盯补全路径）+ CNZZ 埋点——页面侧行为只旁听不干预 | 壳页内联脚本 |
| **DOM 收话锚点** | 回答容器=`.answer-common-card .qk-markdown`。取证探针两轮同链：回复正文住 `div#qk-markdown-react.qk-markdown`（markdown 渲染根；首轮带 `qk-markdown-complete` 状态类、次轮没有——**状态类不可依赖**），其上是 `div.answer-common-card`（answer 语义卡，用户消息不入此卡，天然排除）；忙锚未配（60 秒观察窗未见「停止/stop」钮，宁缺勿猜）——收话判定退化「文本连续 3 拍不变」单条件 | 锚点收集轮 2026-10-02（取证探针两轮） |

## 流格式要点（正式 inject.js 已实现）

- 两道闸（fetch+XHR）拦 `/api/v2/chat`，tee 旁听；SSE 按 `\n` 行缓冲跨 chunk 拼接，每行 `data:` 载荷逐帧 parse。
- 思考缓冲=按 source_seq 收步、整包按序拼行（各步覆盖式）；正文缓冲=multi_load[0].content 直接覆盖。
- 逐字流：解析器快照有变即发 `phase:'delta'`（全量快照，thinking+content）——覆盖式快照天然消化成正确的渐进全文。
- 会话名搭车：树里「32hex 形 session_id + title」同体对象都收（详情 get 与清单 page/list，都是 POST）。

## 同源 checklist（改站两处同改）

- `SESSION_PATH_RE`：site.mjs 与 content.js 顶部 `SESSION_RE` 镜像（经典脚本进不了 ESM）——改一处必改另一处。
- `sessionRef` 形态（`<域名>:<id>`）：site.mjs 为唯一住处，拼装正身=`extension/seat-agent-core.js`（机器骨架收编后的正身；content.js 经 PAGE_SCRIPTS 首位注入交接）。
- `COMPLETION_PATH`：site.mjs 与 inject.js 顶部 `COMPLETION` 镜像。
- manifest.json 的 matches / host_permissions / content_scripts[].js：site.mjs 的登记镜像。
- 改版重新取证：探针对成例在 git 历史（本包探针版=6 轮演进 13c8117→445a078 前身，帧型普查在 R6；kimi 4f8de22 前身=三轮含仪表破案、豆包 c2d4497=第一代成例），照 `docs/` 教学抄回再走一遍取证。

## 已知边界与挂账

- **流早夭实案与仪表（2026-10-03 job 2690）**：god 首轮自动派工——发送成功（粘贴管线首胜）后 0.4s 流即断：解析器只见到第一批帧（0 正文 0 思考、无 sse_end），页面 DOM 却已渲染出正文头几个字；seat 旧法拿 DOM 兜底抓到 3 个字「SET」就交了卷（10-02 手工聊天同款早夭：1s、思考 48 字、无正文）。两道修法：①骨架「流早夭闸」——completed 无正文且无结束标记不当收口，改等「文本稳定 3 拍」收页面渲染完的全文；②解析器装豆包同款仪表（未知 mime/无 messages 帧/解析失败留痕 + 「正常关流 vs 异常中断」随 diagKeys 上报）——流为什么早夭、正文坐哪型帧，下一轮自动派工定谳。
- **发送姿势：粘贴管线已转正（2026-10-03 job 2690 首派工实案），Enter 手势与发送钮候选待真发送成功回填**。首派工实录：execCommand 写入把编辑器写成砖（实案见「输入框真身」行），换 `writeMode: 'paste'`（骨架通用能力，本包选装）；Enter 与 `[aria-label*="发送"]`(32x32) 两次都发不动——但那是在编辑器已被写成砖的状态下试的，粘贴管线下是否可用待回填。发送失败盘点已带 disabled 标记与浮层检测（elementFromPoint），照盘点回填。
- **风控前置**：壳页挂阿里风控 Baxia（专盯补全路径）——页面侧行为，探针与闸只旁听不干预；真演出时若弹验证，须人工过一道，这是本站使用前提，不是插件可修的事。
- 思考面板是多步结构（bar_thinking 各步），正式解析器按步拼行；若上游把步改成流式增量（现在是覆盖式快照），解析器要跟着改——api 探针保留，一眼见新格式。
- 埋点接口（dw-data-channel、px.effirst 等）与探针抓取词表无关（R2 起抓取只认 /api/v2/chat），不会吃名额。
- 会话 id 只实证过 32 位十六进制形态；其他产品线页面若也能当演员，id 形态另取证。
