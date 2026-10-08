# aistudio.google.com/ — Google AI Studio 的户口本

本文件夹 = Google AI Studio（**aistudio.google.com**；未登录 /prompts 跳 accounts.google.com 登录，裸根落 /welcome，2026-09-29 走本机代理探测实证）的知识包。已挂进适配器的站点注册表（`sites.mjs`）。**在役**（2026-09-29 四轮仪表取证当日转正）：座席上线、悬浮球亮。网站事实全谱如下，改站先读这里。

## 网站事实全谱（静态侦察 + 四轮真页仪表取证，2026-09-29）

| 事实 | 值 | 取证方式 |
|---|---|---|
| 站点门牌 | `https://aistudio.google.com`（/prompts 未登录跳 accounts.google.com） | HTTP 探测（走本机代理） |
| 应用形态 | SPA（Angular 系，Material 组件）；自家接口全住第一方 RPC（URL 带 `$rpc` 路径标记，跨源打 `alkalimakersuite-pa.clients6.google.com` 一类主机） | 探针 40+ 条接口上报 |
| 补全接口 | **POST `…/$rpc/google.internal.alkali.applications.makersuite.v1.MakerSuiteService/GenerateContent`**（跨源主机，**页面自己的 XHR 一样过 MAIN world 闸**；匹配词=`MakerSuiteService/GenerateContent` **无前导斜杠**——真 URL 里服务名前面是「点」不是「/」）；标题另有 GenerateTitle，会话保存走 CreatePrompt/UpdatePrompt | 探针（发消息即开火） |
| 会话页形态 | `/prompts/<33位混合id>`（探针地址上报实证；`new_chat` 是新会话占位不是 id；多账号 `/u/<N>/` 前缀已容忍，实案未现） | 探针 |
| 输入框真身 | **Angular CDK 自适应 textarea**（`cdk-textarea-autosize`，全页唯一可见输入元素） | 探针盘点 |
| 发送钮 | Run 钮（aria-label 含 Run；Enter 姿势待首派工定型） | 探针快照 |
| 会话名来源 | **document.title 动态更新**（真页实证「问候与提供帮助 \| Google AI Studio」）——剥站点尾巴即可，无需搭车 | 探针标题快照 |
| 思考 | Gemini 思考摘要**随流可见**（一块一个步骤，如「**Considering User Input**…」）——走 thinking 槽分型攒 | 流全文 |
| 自动化友好度 | Google 系被墙：一切访问须走本机代理；浏览器必须自己能到 aistudio.google.com（登录 Google 账号） | 实测 |
| **DOM 收话锚点** | 回答容器=`ms-chat-turn:not(.thought-activity-host) .chat-turn-container.model .text-chunk`（2026-10-02 收集轮四代探针+解剖拍定谳）。三重语义：①回合级 `ms-chat-turn`（一回合一个 `#turn-<UUID>`，UUID 动态不可锚）；②模型侧（回合内 `.chat-turn-container` 带 `model` 类，用户消息回合无此标）；③非思考宿主（思考摘要住 `ms-chat-turn.thought-activity-host`，其回合 container 同样带 model——不排除会把「Thoughts Expand to view…」折叠标签当回复收）。一条回复=一个 `text-chunk`（570/634 字整条单块实证），取最后一个=最新回复。页上 data-testid 全无——语义锚只此一套 | 四代探针（innerText 判可见——cdk 浮层标记在父容器上，类名过滤失效的教训记探针注释） |
| **忙锚** | 未配：`ms-run-button` 生成中可见两轮实证、但按钮的 aria-label/title 属性值无证据（观察窗只见文本「progress_activity St…」，CSS 无文本匹配）——宁缺勿猜，收话退化「文本连续 3 拍不变」单条件。后续取证：生成中 F12 看 Run 钮属性即得 | 锚点收集轮 2026-10-02 |
| **流式断链（✅ 已修 2026-10-02）** | 上游加「块容器数组」层致解析器 0 收话（17s 生成 delta 1 拍 0 字；fed=11605、head 见九层嵌套）。全形状经 diagKeys 逐条转储到手（48 段 8000 字），深度轨迹分析定谳双层外壳结构，修法=外壳吃两层；真样本实验 25 块全解析（思考 781 字/正文 759 字），回归件已翻新到新形状全绿（mytrashbin/tmp-20260929/aistudio-parser-verify.mjs）。实验件存 cache/aistudio-fix/ | 流式探针+真帧样本 2026-10-02 |

## 流格式（真页取证实录；2026-10-02 真帧样本翻新）

**双层外壳的分块数组流——不是 SSE**：响应外壳 `[` 里套「块容器」`[`（**2026-10-02 上游加的层**；09-29 成例为单层外壳，形状漂移曾致解析器 0 收话——实案见下），块组逐个推进、是容器的并列元素（组内文本深巢至 6 层）。每组形状：

```
[ 深巢消息子树(…[null,"文本"]…), null, [9289, 偏移, 9908, …], null×4, "v1_<token>" ]
```

- 文本住消息子树深巢里的 **`[null, "文本"]` 对**（「model」「v1_*」等标记的宿主数组首元素不是 null，天然不中）；
- 元数据仍在 **chunk[2]**、判据不变：第 2 格（偏移位）**数字 = 正文增量块**（按流序追加，真帧实证逐块递增 27/51/75…），**null = 思考块**（一块一个步骤，整块推）。
- 解析器=字符串感知扫描吃**两层**外壳后按深度 0 拆块组；真帧样本实验与形状分析件在 `cache/aistudio-fix/`。

### 结束信号（要害，本站独有）

**页面收完就在流中途杀 XHR**——readyState 直接归 0，且 **abort/loadend 事件全不发**（四轮仪表实锤：rs=3 流还在涨 → rs=0 len=0，无任何终态事件）。所以 rs=0 即视为完成、交手头已收的字（kimi「abort 前流已放完=完整捕获」同款纪律）。另有第三方脚本在启动后**覆写 `XMLHttpRequest.prototype.send`**（金丝雀实锤）——我们的包装层在调用链内照常工作，但事件不可全信：进料三路（readystatechange/progress/轮询 400ms）共用一个 ingest，事件哑火也有轮询兜底。

### 逐字流（转正即接，同在役五家成例）

- 解析器每解析一块发 `phase:'delta'`（thinking/content 全量快照），content.js 节流 400ms 上报喂 hub 草稿层。
- 真帧回归锁：`mytrashbin/tmp-20260929/aistudio-parser-verify.mjs`（探针原帧喂闸）——改解析器先跑它。

## 破案实录（四轮，给后来者）

1. 一轮：api 行有、捕获行零——同型探针在别家全好，本站特有问题，不猜、装仪表。
2. 二轮：仪表+WebSocket 探针——用户环境实为**两份扩展并存**（旧拷贝抢走共享守卫旗），清环境后仪表进页。
3. 三轮：定谳 transport=XHR（rt 空）进捕获、事件全哑但页面拿到响应；金丝雀抓到第三方覆写 prototype.send；readystate 逐态自报看到流增长（application/json+protobuf）与 **rs=0 归零**的惊魂一幕。
4. 四轮：rs=0 即终态交货——流全文到手，解析器照写、当日转正。

## 同源 checklist（改站两处同改）

- `SESSION_PATH_RE`：site.mjs 与 content.js 顶部 `SESSION_RE` 镜像（经典脚本进不了 ESM）——改一处必改另一处。
- `sessionRef` 形态（`<域名>:<id>`）：site.mjs 为唯一住处，拼装正身=`extension/seat-agent-core.js`（机器骨架收编后的正身；content.js 经 PAGE_SCRIPTS 首位注入交接）。
- `COMPLETION_PATH`：site.mjs 与 inject.js 顶部 `COMPLETION` 镜像。
- manifest.json 的 matches / host_permissions / content_scripts[].js：site.mjs 的登记镜像。
- 改版重新取证：探针/仪表成例在 git 历史（本包 1ef934e=探针版、24e25a5=二轮仪表、3ef5b72=轮次自报、041a59d=三轮仪表、923feab=rs=0 交货），照 `docs/` 教学抄回再走一遍取证。

## 已知边界与挂账

- **Google 限额（2026-09-29 实证，易误判成 bug）**：发消息条数到限额后，提交被拒/响应换成错误信封——网络闸「流收话 0 字」（响应不是分块数组流，解析器零收获是**对的**，completed 帧的 diagKeys 会显示 fed>0/chunks=0 即此情形）。排查口诀：0/0 收话先想限额，看页面有没有限额提示，别先怀疑解析器。
- **发送姿势**：Ctrl+Enter（2026-09-29 首派实证 Enter 只换行不发送，骨架 sendGesture=ctrlEnter；当时恰逢 Google 限额，Ctrl+Enter 的正send仍待限额恢复后一次成功派工定谳）；Run 钮候选兜底，发不动会大声失败并附「发送失败盘点」（手势/候选命中/下半屏按钮清单）。
- **补全接口在别家域**：manifest matches 只盖 aistudio.google.com（页面注入按标签页 URL 认）；网络闸在 MAIN world 拦页面自己的 XHR，跨源照样过闸，无需额外 host_permissions（只旁听不调接口）。
- **Google 账号登录态**：会话页要求登录；多账号路径前缀已容忍。
- **第三方覆写 prototype.send**（金丝雀实锤，身份不明，疑似 Google 自家完整性脚本）：我们的包装层在调用链内不受影响；若上游升级导致包装层被挤出调用链，症状=网络闸零事件，回三轮仪表取证法复查。
- **共享守卫旗教训**：本站破案途中实锤「同浏览器两份 FEMO 扩展并存」时，inject 的页面共享守卫旗（`window.__webNetGate` 等）会被先到者抢走、后到者整闸失效——排障口诀：日志里上线行不带轮次标记/成对出现=有多份扩展，先清环境再查代码。
- Google 风控（异常自动化触发验证）属页面侧行为，探针与闸只旁听不干预——真演出被拦须人工过验证，是本站使用前提。
