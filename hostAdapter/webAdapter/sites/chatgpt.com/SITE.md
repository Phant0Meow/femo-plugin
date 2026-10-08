# chatgpt.com/ — ChatGPT 官网的户口本

本文件夹 = ChatGPT 官网（**chatgpt.com**；www.chatgpt.com 与 chat.openai.com 三家全落到这，2026-09-29 走本机代理探测实证）的知识包。已挂进适配器的站点注册表（`sites.mjs`）。**在役**（2026-09-29 一轮探针取证当日转正）：座席上线、悬浮球亮。网站事实全谱如下，改站先读这里。

## 网站事实全谱（静态侦察 + 一轮真页探针，2026-09-29）

| 事实 | 值 | 取证方式 |
|---|---|---|
| 站点门牌 | `https://chatgpt.com`（www 与 chat.openai.com 双双落到这） | HTTP 探测（走本机代理） |
| 应用形态 | SPA；未登录访问回营销壳（`/unauth-mweb/` 资产），登录后是应用壳；自家接口全住 `/backend-api/` 前缀（40+ 条探针上报实证） | 首页 HTML + 探针 |
| 补全接口 | **POST `/backend-api/f/conversation`**（注意带 f/ 前缀；首页发起新会话另有 POST `/backend-api/conversation/init` 引导——不是补全，别拦错）。**同前缀兄弟端点 `/backend-api/f/conversation/prepare`（sentinel 预备包，POST 非 SSE，2026-10-01 实证）不是补全**——闸只拦路径全等的本体，见下节教训 | 探针（发消息即开火） |
| 会话页形态 | `/c/<36位连字符 UUID>`（探针地址上报实证；瞬态 `/c/WEB:<uuid>` 是路由内部形态，随后归一化，正则天然不认） | 探针 |
| 输入框真身 | **`#prompt-textarea`**（ProseMirror 可编辑 DIV；真页盘点实证，可见输入元素唯一命中；页上另藏一个不可见的 fallback textarea，被可见过滤排除） | 探针盘点 |
| 发送钮 | `.composer-submit-button-color`（可见按钮快照实证；data-testid="send-button" 作候选兜底） | 探针快照 |
| 会话名来源 | **双路搭车**：补全流内 `title_generation` 帧（新会话，主）+ 会话清单/详情 GET 响应（旧会话续聊，备）；document.title 恒为「ChatGPT」是死的（标题快照实证），不可用 | 探针（尾段实拍） |
| CoT | **思考对用户隐藏**（用户实证），流里没有可收的思考正文——解析器 thinking 恒空，属设计内，不是缺口 | 用户拍板 |
| 自动化友好度 | Cloudflare 把守：裸 curl 403，静态侦察必须带浏览器头；本机 DNS 对本站被污染（解析到 Facebook 段等假地址），一切访问须走本机代理——**浏览器自己必须能直达 chatgpt.com**，否则席位无从谈起 | 实测 |
| **DOM 收话锚点** | 回答容器=`[data-testid^="conversation-turn-"] .markdown.prose`；忙锚=`[data-testid="stop-button"]`。取证探针实证：每回合一张 testid（conversation-turn-1..4 编号连发，用户/AI 都算 turn）、回复正文住 `.markdown.prose`（LR5Y_W_ 前缀哈希类不锚）；忙锚抓个正着——生成中发送钮变 stop（testid=stop-button，空闲是 send-button），精确 testid 零假阳性 | 锚点收集轮 2026-10-02（取证探针） |

## 流格式（真页取证实录）

**SSE + JSON 补丁语义（`{p,o,v}`=指针/操作/值）**，开张 `event: delta_encoding` 声明 v1。**2026-10-08 上游翻新协议**（j2724 流头取证仪表当日定谳，改前三处假设全部过期）：① assistant 落位帧（含裸形）的 parts[0] 自带首段正文，不再恒空串；② 正文追加改住批量补丁 `{p:"",o:"patch",v:[…]}` 里（旧协议是顶层 append 帧）；③ 批补丁带过正文后，长回复以裸值帧续发（旧代码批补丁后清粘性=裸帧全丢——当日两案长回复只剩中段碎片的根因）。解析器三处已跟进并有实帧回归锁；流内取证仪表（消息落位/批补丁/裸帧逐条留痕）继续在岗，残余未知帧型下一轮定谳。

| 帧 | 语义 |
|---|---|
| `{p:"",o:"add",v:{message}}` / 裸 `{v:{message}}` | 整条消息落位（**裸形也见过**）；靠 `author.role=assistant` + `content.content_type=text` 认正文骨架；**新协议：落位帧 parts[0] 自带首段正文**（旧协议恒空串），解析器按种子归零/接续 |
| `{p:"",o:"patch",v:[…]}` / **裸数组 `{"v":[…]}`（顶层无 o，j2726 实帧）** | 批量补丁：**新协议的正文追加住在这里**（旧协议是顶层 append 帧）；子操作自带 (p,o,v) 指针，信封不参与语义；带过正文的批补丁=指针有效，紧随裸帧续发进话；不带正文的（status/元数据）批补丁照旧清粘；已结束的 status replace 也常住裸数组里 |
| `{v:"…"}` | **裸值帧——沿用上一条指针**（粘性指针，本协议的要害：前缀省略靠会话间状态）；**新协议：正文批补丁之后的裸帧是长回复的主通道**（17:23 取证实证 ∅o 裸帧×4 扛全文主体） |
| `{p:"",o:"patch",v:[…]}` | 批量补丁：`/message/status → finished_successfully` = **结束信号之一** |
| `{"type":"message_stream_complete"}` | **结束信号之二**（权威） |
| `data: [DONE]` | **结束信号之三**（见其一即收） |
| `{"type":"title_generation",title,conversation_id}` | **会话名搭车**（新会话标题生成时，可能多帧，后者为终名） |
| `{"type":"message_marker"}` / `resume_conversation_token` / `server_ste_metadata` / `conversation_detail_metadata` | 元帧，不进话 |

解析器要点（正式 inject.js 已实现，真帧回归锁在 `mytrashbin/tmp-20260929/chatgpt-parser-verify.mjs`；现行回归锁=适配器 tests/chatgpt-parser.test.mjs）：粘性指针只对「带指针的帧」刷新，裸帧沿用不刷新；正文只认 assistant+text 的 parts/0——思考/工具等一切旁支指针天然不进话；指针挪去别处（元数据补丁）即清粘性。

**闸匹配纪律（2026-10-01 实案教训）：路径全等，不子串包含。** 上游在补全接口同一前缀下新添了 sentinel 预备端点 `/backend-api/f/conversation/prepare`（POST 非 SSE），子串包含把它当补全本体拦下——其 JSON 响应走「非 SSE=即时结束」支路发出静默 done，座席在真补全流开演前就误判「生成已结束」，症状=报「回复已结束但网络闸没有收到正文」而页面明明答了（job 2670 实录，09-29 首次真派工即同病）。修法：闸匹配先剥 query 再按 pathname 与 COMPLETION 全等（`gatePath` 助手），兄弟端点交给 api 探针逐条上报留痕。

### 逐字流（转正即接，同在役四家成例）

- inject.js 解析器快照（content）有变即发 `phase:'delta'`——全量快照不发差量，粘性指针的增量帧天然喂出正确全文。
- content.js 节流 400ms 上报 `{type:'delta', deliveryId, content}`，服务端照 zcode「提交即上墙」同款喂 hub 草稿层。

## 同源 checklist（改站两处同改）

- `SESSION_PATH_RE`：site.mjs 与 content.js 顶部 `SESSION_RE` 镜像（经典脚本进不了 ESM）——改一处必改另一处。
- `sessionRef` 形态（`<域名>:<id>`）：site.mjs 为唯一住处，拼装正身=`extension/seat-agent-core.js`（机器骨架收编后的正身；content.js 经 PAGE_SCRIPTS 首位注入交接）。
- `COMPLETION_PATH`：site.mjs 与 inject.js 顶部 `COMPLETION` 镜像。
- manifest.json 的 matches / host_permissions / content_scripts[].js：site.mjs 的登记镜像。
- 改版重新取证：探针对成例在 git 历史（本包 bdd2ca3=探针版；豆包 c2d4497=第一代探针成例、kimi 4f8de22 前身=三轮含仪表破案），照 `docs/` 教学抄回再走一遍取证。

## 已知边界与挂账

- **发送姿势已定型（2026-10-01 job 2670 真页实测）**：写输入框（execCommand，豆包同款 ProseMirror 路线）+ Enter 真页发送成功（772 字进、输入框清空、生成启动三要素齐）。
- **Cloudflare 人机验证**：页面侧若弹「验证你是人类」，探针与闸只旁听不干预——须人工过一道，这是本站使用前提，不是插件可修的事。
- 会话 id 只实证过 `/c/` 路径下的连字符 UUID；ChatGPT 的 GPTs/Canvas 等产品线页面若也能当演员，id 形态另取证。
- 上游若把补全从 `/backend-api/f/conversation` 挪走：正式 inject.js 的 api 探针（`/backend-api/` 逐条上报）还开着，服务日志一眼见新接口。
- 模型限额（如 image_gen/reason 用尽）由页面自管，与座席无涉；流被限额打断时收话为空、报错里见页面盘点。
