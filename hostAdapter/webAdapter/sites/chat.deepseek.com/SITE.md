# sites/chat.deepseek.com/ — 这家官网的户口本

本文件夹 = DeepSeek 官网（chat.deepseek.com）的全部知识。**想接别家的官网，把整个文件夹换掉就行**——文件夹外面的机器（本地服务 server/、扩展信使与面板 extension/、操作台 console/）不许出现这家网站的任何事实，`tests/site-boundary.test.mjs` 机械锁死这条边界。

## 里面住着什么

| 文件 | 管什么 |
|---|---|
| `site.mjs` | 机器可读网站事实唯一清单（网址、会话 id 正则、接口路径……），信使（background）与本地服务从这里 import |
| `content.js` | 会话页代理（隔离世界，每标签页一份）：读会话 id、往输入框写任务文本、等回复结束、整段收话 |
| `inject.js` | MAIN world 网络闸：拦对话补全接口的 SSE 流，把思考/正文分开攒，听结束帧 |
| `SITE.md` | 本文——给人读的网站事实全谱 |

## 网站事实清单

### 网址与会话身份

- 站点：`https://chat.deepseek.com`
- 会话页形态：`https://chat.deepseek.com/a/chat/s/<id>`
- 会话 id 格式：字母数字连字符、8 位起（真页面是 uuid；8 位下限是放宽）。
- **新会话发过第一条消息后才生成 id**——之前 URL 是裸首页，不立席位（background 与 seats 同守此约）。
- SPA 换页不刷新页面：会话 id 要靠 pushState/replaceState/popstate 跟踪 + 定时兜底轮询（content.js 已做）。

### 网页元件（DOM 锚点）

DeepSeek 改版要跟着更新；**哈希类名（如 `fbb737a4`）勿锚**。

| 用途 | 锚点 |
|---|---|
| 输入框（老锚点，社区长期实证） | `#chat-input` |
| 输入框候选兜底 | `textarea[id*="input" i]`、`textarea[class*="input" i]`、`[class*="chat-input"]`、`[role="textbox"][contenteditable="true"]`、`textarea`、`[contenteditable="true"]` |
| 发送钮 | `#send-message-button`、`[aria-label*="发送"]`、`[aria-label*="Send" i]`、`button[class*="send" i]` |
| 回答块（收话取最后一段） | `.ds-markdown` |
| 生成中指示（DOM 兜底判忙） | `.ds-typing-container`、`[class*="typing" i][class*="container"]`、`button[title*="停止" i]`、`[aria-label*="停止" i]` |

候选都按「可见尺寸」过滤（页面里可能藏着隐藏模板）。

### 发送姿势

- 输入框是 **React 受控组件**：直接赋值会被骨架吞掉，必须走原型原生 setter + `input` 事件（content.js `setInputValue`）。
- 发送 = 派发 Enter 键（keyCode 13，社区 Playwright 实证姿势）；发不动再点发送钮。
- 发送成功的判定：输入框被清空，或本页开始新一轮生成（网络闸/DOM 任一）。

### 网络接口与流格式

- 对话补全接口：`/api/v0/chat/completion`。**真页面实证对话请求走 XHR 不走 fetch**（fetch 闸只看得见门口）——inject.js 两道闸都架，共用同一套流解析器。
- 回复是 SSE。流格式两代（社区逆向实证 + 2026-09-25 真页面 diagKeys 取证），inject.js 两代都认：
  - 旧格式：`{"p":"response/thinking_content","v":"…"}` / `{"p":"response/content","v":"…"}`；无 `p` 的 `{"v":"…"}` 为续段，沿用上一路径。
  - 新格式（现行）：片段开张帧 `{"p":"response/fragments","o":"APPEND","v":[{type:"THINK"|"RESPONSE","content":"…"}]}`，其后 `{"p":"response/fragments/-1/content","v":"…"}` 归当前片段类型的桶。
  - 结束帧：`{"p":"response/status","v":"FINISHED"}`（流 close/loadend 亦算结束）。
- 收话以网络闸为准；「DOM 文本稳定几秒」只是网络闸缺席时的降级（超长思考可能误判，已知边界）。

### 改版取证法（上游换了格式/元件时）

- inject.js 的 **diagKeys 探针**：把流内真实键名带回服务日志（`[ext:content] 网络闸：流收话…键样例 …`）——上游再换格式，一次下发就能取证。
- inject.js 还有 **api 探针**：页面调的每个 `/api/` 接口按 URL 去重上报（`网络闸看见接口：…`）。
- content.js 找不到输入框时会把页面输入类元素的真实长相（tag/id/class/placeholder）盘点进报错——照着挑新锚点。
- DeepSeek 页 F12 控制台看 `[femo-seat]` 前缀流水（座席代理上线/下发/收话全在）。

### 逐字流（2026-09-28 接线）

- inject.js 解析器**边流边发** `phase:'delta'` 事件：thinking/content 两字段的**全量快照**（发射点=两道闸的行缓冲循环后，每网络块一拍；start 时清长度指纹防上轮残留）。
- content.js 节流 400ms 上报 `{type:'delta', deliveryId, thinking, content}`（completed 补发终值），服务端照 zcode「提交即上墙」同款喂 hub 草稿层（drop+delta 两帧两槽，交卷落账自动吸收）。
- delta 只上墙不碰收话——`completed` 帧仍是收话唯一权威；手工聊天也上报（deliveryId 空=纯面板镜像，服务端不喂 hub）——无引擎即可在侧栏「最近收到的回答」验证流式链路（面板在长字=闸→content→background→服务全通）。

## 同源纪律（改站 checklist）

| 事实 | 唯一住处 | 镜像（改站同改） |
|---|---|---|
| 网址/matches | `site.mjs`（SITE_URL/SITE_MATCH/SITE_FENCE_RE） | `manifest.json` 的 `host_permissions`、三段 `content_scripts[].matches`（静态 JSON 进不了 ESM） |
| 会话 id 正则 | `site.mjs`（SESSION_PATH_RE） | `content.js`（经典脚本进不了 ESM，内嵌一份） |
| 会话引用拼拆 | `site.mjs`（sessionRef/parseSessionRef） | `extension/seat-agent-core.js`（2026-09-29 机器骨架收编后的正身；content.js 经 PAGE_SCRIPTS 首位注入交接） |
| 会话名提取 | `content.js`（parseSessionTitle——站点私有的名字规则） | 本文档表格 |
| 接口路径/流格式 | `inject.js` | `site.mjs`（COMPLETION_PATH，给未来服务侧消费留口） |
| DOM 锚点/发送姿势 | `content.js` | 本文档表格 |

改完跑 `node --test tests/site-boundary.test.mjs`（网站字样不外泄）与 `node --test tests/runtime.test.mjs`。
