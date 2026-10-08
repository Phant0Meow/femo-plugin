# webAdapter — femo 的网页版宿主适配器（DeepSeek / 智谱清言 / 豆包 / Kimi / ChatGPT / AI Studio / Grok / 千问…）

第四套宿主适配（dsh=会话型、zcode=MCP+hooks、autoclaw=进程内插件、
**web=Chrome 扩展+本地服务**）。把各家 AI 官网（chat.deepseek.com、chatglm.cn、www.doubao.com、www.kimi.com、chatgpt.com、aistudio.google.com、grok.com、www.qianwen.com）的会话标签页
直接接入 FEMO：**一个灵魂绑一个会话标签页**，引擎轮到谁，任务文本就写进
谁的输入框，它把话说完，整段收回来交引擎。

> **要接一家新的网页版官网？** 施工教学唯一一份在 [AGENTS.md](AGENTS.md)——要动哪几个文件、`site.mjs` 契约件怎么探索、探针取证怎么跑、转正怎么换装、实战坑谱。本文管结构与跑法，不再另写第二份接入教学。

## 结构

```
webAdapter/          ← chrome://extensions 加载这个目录
├── manifest.json            扩展清单（住根；代码路径键指进 extension/ 与站点包）
├── sites.mjs                ★ 站点包注册表：机器与站点包之间唯一的接缝——接新
│                              官网=sites/ 下加站点包文件夹+这里 import 一行，机器零改动
├── sites/                   站点包们住这（每家官网一个 <域名>/ 文件夹，sites.mjs 逐家挂号）
│   （座席机器骨架唯一一份在 extension/seat-agent-core.js：守卫/换页跟踪/草稿
│    节流/输入框写入/收话/下发主流程，content.js 只剩站点事实+一行装配）
│   ├── chat.deepseek.com/   ★ 站点包（在役）：这家官网的全部知识（换掉=整文件夹
│   │                        换掉，外面机器零改动；tests/site-boundary.test.mjs
│   │                        机械锁死边界）
│   │   ├── SITE.md        网站事实全谱（网址/会话id格式/DOM锚点/接口/流格式/改版取证法）
│   │   ├── site.mjs       机器可读网站事实唯一清单（经 sites.mjs 供给机器）
│   │   ├── content.js     会话页代理：会话 id、React 写入+Enter 发送、收回复
│   │   └── inject.js      MAIN world 网络闸：拦 completion SSE 听 FINISHED
│   ├── chatglm.cn/          ★ 站点包（在役，2026-09-27 转正）：智谱清言——两轮
│   │                        探针取证（会话页真形/补全接口/流格式/结束信号），
│   │                        座席在役、悬浮球亮；发送姿势待首派工定型
│   │   ├── SITE.md        网站事实全谱（真页实证）+ 同源 checklist
│   │   ├── site.mjs       网站事实唯一清单（经 sites.mjs 供给机器）
│   │   ├── inject.js      MAIN world 网络闸：拦 assistant/stream，分型攒思考/正文
│   │   └── content.js     会话页代理：cid 会话 id、写 textarea+Enter 发送、收回复
│   └── www.doubao.com/      ★ 站点包（在役，2026-09-27 当日转正）：豆包——一轮
│   │                        探针取证（会话页纯数字长 id/补全接口/事件制流格式/
│   │                        ProseMirror 输入框），座席在役、悬浮球亮
│   │   ├── SITE.md        网站事实全谱（真页实证）+ 同源 checklist
│   │   ├── site.mjs       网站事实唯一清单（经 sites.mjs 供给机器）
│   │   ├── inject.js      MAIN world 网络闸：事件制 SSE 解析（CHUNK_DELTA 攒正文、
│   │   │                    SSE_REPLY_END 收卷、SSE_ACK 搭车会话名）
│   │   └── content.js     会话页代理：数字会话 id、ProseMirror 写入+Enter、收回复
│   └── www.kimi.com/        ★ 站点包（在役，2026-09-28 三轮探针取证当日转正）：
│   │                        Kimi——Connect 协议分帧流（字节级拆封）、思考/正文
│   │                        分型（mask）、UUID 会话 id、动态标题剥尾巴；发送
│   │                        姿势待首派工定型
│   │   ├── SITE.md        网站事实全谱（真页实证）+ 同源 checklist
│   │   ├── site.mjs       网站事实唯一清单（经 sites.mjs 供给机器）
│   │   ├── inject.js      MAIN world 网络闸：字节级拆 Connect 信封（1+4 头+JSON
│   │   │                    载荷），mask 分型攒思考/正文，三层结束保险；增量排空
│   │   └── content.js     会话页代理：UUID 会话 id、可编辑 DIV 写入+Enter、收回复
│   └── chatgpt.com/         ★ 站点包（在役，2026-09-29 一轮探针取证当日转正）：
│                            ChatGPT——SSE+JSON 补丁流（粘性指针：裸值帧沿用
│                            上一条指针）、CoT 隐藏站（thinking 恒空）、UUID
│                            会话 id、会话名双路搭车（流内 title_generation+
│                            清单 GET）；发送姿势待首派工定型
│       ├── SITE.md        网站事实全谱（真页实证）+ 同源 checklist
│       ├── site.mjs       网站事实唯一清单（经 sites.mjs 供给机器）
│       ├── inject.js      MAIN world 网络闸：JSON 补丁语义解析（粘性指针）、
│       │                    三层结束保险；会话名双路搭车
│       └── content.js     会话页代理：UUID 会话 id、#prompt-textarea 写入+Enter、收回复
│   └── aistudio.google.com/ ★ 站点包（在役，2026-09-29 四轮仪表取证当日转正）：
│   │                        Google AI Studio——json+protobuf 分块数组流（不是
│   │                        SSE）、思考随流可见按块分型、页面收完即杀 XHR
│   │                        （rs=0=完成、abort/loadend 不发）、33 位混合会话
│   │                        id、动态标题剥尾巴；发送姿势待首派工定型
│   │   ├── SITE.md        网站事实全谱（真页实证+四轮破案实录）+ 同源 checklist
│   │   ├── site.mjs       网站事实唯一清单（经 sites.mjs 供给机器）
│   │   ├── inject.js      MAIN world 网络闸：json+protobuf 分块数组扫描（外层
│   │   │                    数组吞口、字符串感知）、rs=0 交手头全部、三路进料
│   │   └── content.js     会话页代理：混合会话 id、CDK textarea 写入+Enter、收回复
│   └── grok.com/            ★ 站点包（在役，2026-09-29 四轮探针取证当日转正）：
│   │                        Grok——**补全走 WebSocket 不走 fetch/XHR**（闸包
│   │                        装 WS 构造器，一条 message 背靠背拼多事件要平衡
│   │                        扫描拆）；chunk.text.channel 分桶（正文 RESPONSE/
│   │                        思考 NOTETAKER，思考可见照收）；response.done=
│   │                        结束；会话页 /c/<UUID>、输入框 tiptap ProseMirror；
│   │                        国际站：Cloudflare 拦裸 curl（须浏览器过代理直达）
│   │   ├── SITE.md        网站事实全谱（真页实证+四轮探针）+ 同源 checklist
│   │   ├── site.mjs       网站事实唯一清单（经 sites.mjs 供给机器）
│   │   ├── inject.js      MAIN world WS 闸：事件制解析（channel 分桶）、
│   │   │                    平衡扫描拆连排事件；会话名清单搭车
│   │   └── content.js     会话页代理：UUID 会话 id、ProseMirror 写入+Enter、收回复
│   └── www.qianwen.com/     ★ 站点包（在役，2026-09-29 六轮探针取证当日转正）：
│                            千问——SSE 背靠背多帧；思考=bar_thinking/正文=
│                            multi_load/iframe 双快照覆盖式分桶（思考照收）；
│                            sse_end=1 结束；会话页 /chat/<32hex>；会话名
│                            走 session/get 搭车；阿里风控 Baxia 挂壳页
│       ├── SITE.md        网站事实全谱（真页实证+六轮探针）+ 同源 checklist
│       ├── site.mjs       网站事实唯一清单（经 sites.mjs 供给机器）
│       ├── inject.js      MAIN world 网络闸：帧型分桶（双快照覆盖吸收）、
│       │                    会话名详情/清单搭车
│       └── content.js     会话页代理：32hex 会话 id、可编辑 DIV 写入+Enter、收回复
├── shared/                  ★ 两张页面的判断层（磁盘单份：扩展侧打进包 import、
│   │                          操作台侧经 /console/shared/ 路由伺候）——重画护栏、
│   │                          席位状态、人类席变量拼行、运行回执；画法留各页
│   ├── dom.mjs             escapeHtml / shortId / toast 工厂
│   ├── guard.mjs           重画护栏（数据没变不重画、输入中不重画）
│   ├── seats-core.mjs      席位运行状态判断 / 空灵魂绑定拦截
│   ├── human-seat-core.mjs 人类席画面侧拼装（SET VARIABLE 拼行/草稿签名；显隐判据上移公共层，服务端盖布尔下发）
│   └── run-core.mjs        运行回执措辞 / job id 提取
├── server/
│   ├── service.mjs        本地服务总装（node server/service.mjs）：
│   │                        HTTP :8796（FEMO_WEB_PORT 可改）
│   │                        ├─ 扩展协议：/extension/register·poll·report（下行=长轮询）
│   │                        ├─ 驿站收件口 /femo-plugin/mailbox-push（FEMO_PUSH_PORT=本口）
│   │                        ├─ 主Agent工具 /tools/<name> + 应答 /answer（操作台用）
│   │                        ├─ 操作台页 /console + 共享判断层 /console/shared/*
│   │                        ├─ 画布 /canvas + /api/run 族（运行/暂停/续跑/流/人类席）
│   │                        │   + femoGen 自有文件面 /api/femo-files*·canvas/path·
│   │                        │     save-script·projects/*·pick-*（接线在 canvas.mjs）
│   │                        └─ 引擎直连 + 自愈（2026-09-26 常驻化第3步：公共层 daemon-client，直连 femo_daemon.py，不再生 Python 桥子进程）
│   ├── bridge.mjs         DaemonClient 绑定（host=web + 沙盒 --db + 门铃 pushUrl）
│   ├── runtime.mjs        运行时总装：分诊台接线、角色回合簿记（在飞表/两道
│   │                        超时/恰好一次）、主Agent席/人工席分流、运行泵、
│   │                        逐字流草稿喂 hub（drop+delta 两槽，旁路轨）
│   ├── seats.mjs          席位账：sessionId→席位、灵魂唯一绑定、主Agent至多一个、
│   │                        忙时挂队、离线释放
│   ├── mailbox-push.mjs   驿站收件口分流（终局/开跑通知/重试牌/主Agent/人类/角色）
│   ├── canvas.mjs         femoGen 画布宿主绑定：静态伺候 /canvas（dist 播种主题/
│   │                        后端/自动挂载）、SSE 通道、干跑代理 debug-run；
│   │                        femoGen 自有文件面（2026-09-30，能力在公共层
│   │                        femoGenConnector，本文件只是薄伺候）：femo-files 三件套
│   │                        （导入账本）、canvas/path（当前文件槽，落 user_data/
│   │                        femogen_canvas.json）、save-script（存盘三态）、
│   │                        projects/*（目录浏览/新建/打开——客户端拼的路径只准
│   │                        在 projects/ 围栏内）、pick-script·pick-save-path
│   │                        （桌面系统对话框代理，引擎=公共层 file-dialogs）
│   └── board.mjs          幕布空壳（真实幕布=hub 与引擎同进程；runlog 给操作台）
├── console/index.html     操作台（挂载/启动运行/应答/席位/工具）——本宿主没有
│                          会话型主Agent AI，FEMO 的运行控制由人在这亲手操作；
│                          字体链首位带生僻字补字字体（数据内嵌 @font-face，
│                          与 femoGen/src/themes.js FONT_FACE_CSS 同口径，2026-10-08）
├── extension/             Chrome 扩展的通用机器（MV3；零网站事实，网站知识只住
│   │                        各站点包，机器只吃 sites.mjs 注册表）
│   ├── background.js      SW 信使：长轮询下行、报告/注册上行、侧栏代理
│   │                        （多站点：按注册表匹配标签页/围栏/开页/补注入；SW=module）
│   ├── bubble.js          FEMO 悬浮球——机器公共 UI：在役站点都亮（background 按
│   │                        PROBE_MODE 统一附加），取证站点不亮；点击开侧栏、拖拽、右键暂隐
│   ├── sidepanel.html     灵魂面板壳（席位列表/灵魂 chip/手工发消息/人类席；双标签页
│   │                        ——第二标签内嵌本地投影中心；样式内联；字体链首位带
│   │                        生僻字补字字体（数据内嵌，同上口径，2026-10-08））
│   └── sidepanel/         面板逻辑模块（module）：main 总装（状态线/轮询/标签页/
│                           投影 iframe）+ seats 席位卡 / feeds 收话与流水 /
│                           human-seat 人类席 / run-control 挂载运行与状态线 /
│                           svclog 服务日志 / conn 通道
├── tests/                 node --test 单测 + 真引擎/服务冒烟
└── web.host.manifest.json  宿主清单（host=web）
```

## 关键裁决

- **站点包边界：网站知识只住各家站点包，机器只认注册表**。网址、会话 id 形态、
  会话引用的拼装拆解、会话名的提取规则、网页元件名、接口路径、SSE 流格式
  全是「某家官网的事实」，一概不住站点包外——会话引用/会话名各自是站点包
  契约件（谁家的引用谁家拆，注册表只代派；站点不明不默认任何一家），机器
  只当不透明字符串；信使/席位账/面板/操作台只经 `sites.mjs` 注册表消费
  站点包，不许直接 import 具体站点。接新官网=新文件夹+注册表一行；`site.mjs`
  是机器可读事实的唯一清单（每家带 SITE_ID 做站点名）；manifest.json 的
  matches/host_permissions 是登记镜像（静态 JSON 进不了 ESM，改站两处同改）；
  content.js/inject.js 是经典脚本进不了 ESM，锚点正则内嵌一份镜像（引用拼装
  已上移 extension/seat-agent-core.js 四家唯一一份）——同源纪律全在各自 SITE.md。**取证模式**：页面事实没取证的站点只登记不注入——
  围栏与标签页识别生效，但不立席位、不发任务（extensions 只认应答过 ping
  的页，天然兜住）；取证前不许把猜测写成事实（chatglm.cn 已于 2026-09-27
  走完两轮探针取证转正）。
- **两张页面一份判断（2026-09-27）**：侧栏面板与操作台共用的判断——重画护栏
  （数据没变不重画、输入中不重画）、席位运行状态、空灵魂拦截、人类席变量
  赋值契约、运行回执措辞——唯一活在 `shared/`，画法（侧栏卡片/操作台表格）
  留各页。同一把尺子：同样的判断写两份就必然漂移（操作台人类席漏变量赋值
  就是实案）。
- **本宿主拉起的引擎不开窗，关灯走侧栏「关闭服务」（2026-09-29）**：常驻引擎
  被代拉时桌面那间日志镜窗是引擎自己开的（femo_daemon._open_console）——本
  适配器拉桥时注入 hideConsole，引擎就自不开窗，桌面不再长黑窗。引擎的关灯
  唯一入口是侧栏快捷卡「关闭服务」：服务退场前把 daemon_shutdown 递给引擎，
  **散场裁决归引擎**（门铃簿点名：还有别家宿主在线就拒绝、只剩本家才真关）——
  宿主只递话不裁决，谁在线的权威账在引擎手里。在跑的场诚实挂起，断点信柜留
  盘，回来续跑即收养。「重启服务」不带这个口：重启是暫时退场，引擎照常站岗。
- **角色=标签页，领域锚=会话引用（2026-09-27 定形）**：会话 id 全链用**会话引用**
  `<站点域名>:<会话id>`（如 `chat.deepseek.com:6eba8944-…`，拼拆唯一活在
  sites.mjs）——多站在役后各家 id 形态互不相同，来源写在 id 自己脸上，跨站
  不撞号；hub cast 账是所有宿主共用的账，**不改结构**，web 格的 sid 从此自带
  来源，翻账一眼知道是谁家。旧绑定存的裸 id 走 `bySessionLoose` 兼容读
  （后缀匹配，不迁移账，重绑一次即换新形态）。席位卡/操作台来源显示名与短 id
  是出口现算的视图派生，账本不记。新会话发首条消息后才生成 id，之前不立席位。
- **发送姿势**：React 受控组件必须走原型原生 setter + `input` 事件写输入框，
  再发送 Enter 键（keyCode 13）；发不动才点发送钮（锚点与姿势的取证细节在
  站点包 SITE.md）。
- **逐字流两轨（2026-09-28）**：生成中的思考/正文经网络闸全程快照（`phase:'delta'`，
  各家 inject.js 边流边发、content.js 400ms 节流上行）喂 hub 草稿层——
  `draft-drop`+`draft-delta` 两帧两槽（text/reasoning）、wait_key 定段，
  zcode「提交即上墙」同款。**旁路轨绝不碰回合生命周期**：交卷轨（reply）
  独占收口，恰好一次/两道保险丝照旧，落账时 hub 自动吸收草稿不双份；未知
  deliveryId 静默丢。发全量快照不发差量——chatglm 的整段覆盖帧、kimi 的
  op set 帧（连「完成即 abort」习性）全被快照语义天然消化；豆包流内无思考
  分型，thinking 留位。**面板同镜（2026-09-28）**：服务端每会话一格草稿镜
  （`/state.drafts`），侧栏「最近收到的回答」钉顶展示「正在写…」脉动卡，定稿
  到手即撤以 replies 收尾；手工聊天也流式（deliveryId 空=只镜像不喂 hub）——
  无引擎即可验证 delta 链路全通。面板是被拉的不是被推的：轮询自适应
  （闲时 2.5s，有草稿在写 700ms）——恒速慢轮会把流式看成一截一截（实案）。
- **收话以网络为准**：页面 completion 回复是 SSE，终止帧 `FINISHED`
  （inject.js 拦流听它）——旧方案「文本稳定几秒」对超长思考会误判，这里只作
  网络闸缺席时的降级。流格式两代的原话见站点包 SITE.md。
- **回合静默阶梯（2026-10-02 用户四级定案）+ 超时保险丝**：一个席位同时至多一
  个回合；忙则挂队。阶梯判据是「收不到内容」不是「ping 不通」（已发送/流式
  delta 都算内容）：①静默 30s → **自动 reload 恰一次**（不探活——能 30s 无内
  容还应答得了探活的页恰是假活：网络闸死/收话判定卡死，reload 正是救法；正常
  生成 delta 400ms 一拍绝不会触发；reload 后回合领养接回收话）；②reload 过了
  还没内容（静默满 60s）→ 弹提醒喊人恰一次（全页面横条，只喊不切焦点，点开
  即醒）；③此后就等着，不再有任何动作（不 reload 循环：防风控暴露，也防页面
  没冷加载完又被 reload）。执行保险丝 3000s（帧推进起算，「已发送」不清零，连
  生成期一起管）与整轮兜底 60 分钟（含排队滞留）到点都**跳过**：交 ⚠️ 占位台
  词收卷，warning 上墙，剧本继续跑下一个节点——超时永不挂起。全程红线（作者
  原话）：「所有这种场合，都不许结束femo，不是error……切个页面就救活了算什么
  error」——页面侧 error 上报已全部退役（收话失败/正文空也降级留痕，reload 领
  养可救）；服务端 error 契约保留给真终局（挂队溢出等）。
- **按需唤醒（2026-10-01 用户拍板：不追「一直在线」，只认「页开着」）**：浏览器
  内存节省器会冻结后台标签页，六个网页演员不可能同时常驻在线。席位账因此把
  两态分开记：`present`=标签页开着（扩展按 URL 就认得出，不依赖页内应答）、
  `online`=此刻应答过探活能收帧；帧只发 online 的席位（派进冻结页=静默丢）。
  派工侧**轮到谁唤醒谁**：`resolveSeat` 发现席位在册休眠就请台 reload 唤醒（不抢
  焦点，聊天记录在网站服务端，重载无损）、原地等上线再发话（75s 等不到大声报错，
  引擎挂起可续）；运行前点名（`/seats/attendance`）把**页开着（含休眠）直接算
  到场**——现在叫醒了等开演的几分钟里又冻回去，白醒。席位卡四态：运行中 >
  在线 > 休眠中 > 网页未打开。回合中途冻结（已发话才冻）由 30s 提醒浮层喊人 +
  收割轮 reload 查岗兜底（到点自动切焦点已随查岗收割模型退役）。
- **任务看护：顺次闸 + 唤醒闸 + 回合领养（2026-10-02 三锤定案「顺次进行」，零抢焦点）**：
  Edge 对后台页的猎杀快到「6 连 reload 每页只活 1 秒」——保活在这个环境里不成立；
  而并发轮转查岗（原 15s 收割轮）又容易被网站风控。终局形态是**顺次**（作者原话：
  「Mailbox 那边不变，但是 Mailbox 的任务发到 Web Adapter 这边的时候，Web Adapter
  改成顺次进行」「只 reload 一次，一直活动到收到完整的结束信号为止。然后再去看
  下一个活着没，如果没有活着就 reload」「reload 操作之前要检查那个页面活着没？
  如果本来就活着就不用 reload 了」）：
  **顺次闸**（runtime）——mailbox 任务到网页席位一个一个来，同一时刻至多一个
  任务占闸（占闸段=解析座位→推帧→回合收场）；闸忙时排队**不解析座位**（轮到
  才看活着没，不在闸外提前唤醒下一页）；闸内在线直发、休眠经唤醒闸 reload
  **至多一次**，然后盯到完整结束信号才放下一个。**唤醒闸**（server/keeper.mjs
  createWakeGate）——并发 reload 预算 2、排队 FIFO、上线或 75s 超时放行；派工
  侧 resolveSeat 与主Agent席 wakeSeat 走它，运行前点名请台（只开没开的页）也走
  它。**回合领养**——页因任何原因重载（唤醒 reload/人工刷新/扩展重载）都向
  服务端 hello 认领在飞回合：已发送→领账收尾；未发送→原帧随应答重发。剧本外
  角色永不 reload：注册巡检（10s 一轮探活注册）零 reload（reload 名单=mailbox
  在飞收件人）。回合中途被冻的恢复走静默阶梯（见上一条：30s 无内容自动 reload
  恰一次 → reload 无效才提醒 → 死等保险丝）。remind 浮层/系统通知只喊人（浮层「切过去」/点系统通知=人工自愿切页：落点账住 storage.session 并带会话引用，点击时现场重认——SW 休眠/页重开都切得动，寻址全无的提醒不画按钮；目标页被用户激活即提醒过期——切页激活/到货已是激活页/人工切成功三处收口，全局收横条、清落点与同单系统通知）
  默认保活（autoDiscardable=false，防内存节省器丢弃，防不了冻结）；用户侧缓解：
  关掉 Edge「睡眠标签页」/Chrome 内存节省器能显著拉长清醒窗口。
- **角色可重演**：网页会话天然记着上文，审稿意见直接递进同一会话让它改
  （zcode/autoclaw 做不到的，这里是顺手的）。
- **绑定账（cast 挑角色）：全系统只记一笔账**（2026-09-25 用户定案）。正身=hub
  cast 偏好账（cast-core `preferenceSet`，dsh 绑定按钮同一契约：角色库核查→
  hub 全局唯一占用 409 原话透传），开演定格进 Job 绑定账；本地 seats 是**纯物理账**
  （标签页/忙闲/排队/主Agent席），零灵魂状态。派工最后一程=runtime `resolveSeat`：
  Job 绑定账优先、偏好账回退（dsh 收件口同款 readJobCast 姿势）——**绑定要在 femo_run 之前**。
- **下行为什么长轮询**：MV3 service worker 没有 EventSource；fetch 长轮询
  最皮实，不需要引 WS 协议锁。
- **数据根=公共 user_data（2026-09-25 用户拍板：全宿主公用连起来玩）**：
  缺省**不设** FEMO_DATA_DIR——引擎与 python 走缺省分支 `<femoRoot>/user_data`
  （无 femo/ 段，与 dsh 生产同口径）：同一个投影中心（hub 唯一化：常驻引擎每
  数据根一座，客户端经 hub.json 复用）、同一个驿站信柜（外宿主的信留柜自取）、
  同一本角色库/台账与 cast 绑定账（跨宿主灵魂唯一占用由 hub 裁决）。
  **双分支口径坑（踩过）**：一旦设 FEMO_DATA_DIR，全部路径切到 `<DIR>/femo/`
  子树——设成 user_data 反而住进 user_data/femo/ 平行小世界，与生产互不相通。
  隔离测试：`set WEB_SANDBOX=1` 回落 .femo-data。

## 跑起来

**首选：侧栏一键启动**（新装机只需双击一次 start-service.cmd）

1. 浏览器扩展页（chrome://extensions 或 edge://extensions）→ 开发者模式 →
   加载解压扩展 → 选 webAdapter/ 本身（manifest.json 在适配器根，代码在
   extension/）。扩展 ID 已被 manifest.json 的 key 字段钉死：任何机器、
   Chrome 与 Edge 都是同一个 ID，原生宿主登记因此可以一步锁准。
2. **首次启动：由于系统限制，必须由人亲手双击**
   `femo-plugin\hostAdapter\webAdapter\start-service.cmd`
   （即 femo-plugin 文件夹里的 hostAdapter\webAdapter\start-service.cmd，
   从仓库下载/克隆得到 femo-plugin 文件夹后，这个相对位置对任何机器都成立；
   盘符与你把仓库放在哪无关紧要，从 femo-plugin 这一层往下对所有人都是
   同一条路）。双击后启动本地服务并**顺手自动登记原生宿主**（写 host
   manifest + HKCU 注册表 Chrome 与 Edge 两键，免管理员，幂等；服务日志有
   「原生宿主已登记（自动）」一行），登记+启动一步到位。之所以必须由人
   亲手双击一次：登记要写注册表和 host manifest，浏览器扩展住往沙箱里，
   既拿不到插件在磁盘上的位置、也不能替你写注册表——只有被双击拉起的本地
   服务自己能做这件事。此后就不需要再双击了：就算服务停了，侧栏断连横幅
   里的「一键启动本地服务」按钮也能靠 Native Messaging 把它拉起来（扩展→
   Chrome→native/web-launcher → 拉起 node 服务，分离启动不随浏览器关闭而死；
   已在跑时幂等不重复拉）。
3. `native/install-native-host.mjs` 降级为手动登记入口（改了 manifest 的 key
   之后想立刻重登记、或不想启动服务只想登记时用），日常不用跑。

**手动路线**：

```powershell
# 1) 本地服务（缺省即公共 user_data world，与各宿主共用；
#    要隔离测试先 set WEB_SANDBOX=1，回落 adapter/.femo-data 沙盒）
cd hostAdapter\webAdapter
node server/service.mjs            # 监听 127.0.0.1:8796；FEMO_WEB_PORT 可改

# 2) Chrome 扩展：chrome://extensions → 开发者模式 → 加载解压扩展 →
#    选 webAdapter/ 本身（manifest.json 在适配器根，代码在 extension/）
# 3) 打开若干 chat.deepseek.com 会话页；扩展图标 → 灵魂面板：给每个席位绑灵魂
# 4) 操作台 http://127.0.0.1:8796/console：挂载FEMO脚本 → fresh_start 启动运行
#    人类节点在投影中心输入席或操作台应答；主Agent席没设时主Agent任务落操作台
```

## 排障速查

**侧栏点「一键启动」报启动失败**——按顺序查：

1. 报错里含「原生消息宿主」字样 = 没登记：首次使用由于系统限制，必须由人
   亲手双击 `femo-plugin\hostAdapter\webAdapter\start-service.cmd` 启动一次
   （启动即自动登记；之后边栏一键启动永久可用），或手动
   `node native/install-native-host.mjs`。报
   「Access … forbidden」= 浏览器扩展页里的 ID 与登记的 allowed_origins 对不上
   （多半是扩展没重载、还在用改 key 之前的旧 ID）：重载扩展再看 ID。
   报「Error when communicating with the native messaging host」= 宿主进程没
   跑起来或帧没送到：新版 Chromium/Edge 对宿主走「可执行文件直启」，批处理壳
   起不来——确认 host manifest 的 path 指的是 `web-launcher.exe`（登记器会
   自动编译，缺 csc.exe 时按报错装 .NET Framework 4.x 后重跑）；本机 node 不在
   系统 PATH 时靠 native/node.path 提示文件，别删它，node 挪窝后重启服务
   （自动登记会刷新）。
2. 已登记还报「探活超时」= 服务拉起后起不来：手动跑 `node server/service.mjs`
   看原话报错（端口占用、缺 node 都会在这现形）。
3. 仓库挪过窝 = host manifest 里的 exe 绝对路径失效：重启一次服务（自动登记
   幂等重写）。manifest.json 的 key 改过 = 扩展 ID 变了：重载扩展，服务下次
   启动自动按新 ID 重登记。

**发送显示「已发送」但页面没动静**——按顺序查三处：

1. 侧栏席位列表里这个席位还在吗、什么色的点？亮绿=在线；暗琥珀=休眠中（页开着
   被浏览器冻结——轮到引擎派工会自动 reload 唤醒，也可手动点开那张标签页）；
   灰点/不在 = 席位脚本没活着：**刷新对应站点的标签页**（装扩展/改扩展之前就
   开着的页面不会被注入，Chrome 只给加载后新开或刷新的页面注入 content script）。
2. 在对应站点页面按 F12 开控制台：应有 `[femo-seat] 座席代理已上线` 行；
   下发后应有「收到下发，发送/已发送/回复结束」流水。没有上线行 = 注入没发生
   （刷新页面或检查 chrome://extensions 里扩展是否报错）。
3. 服务端控制台：上行报告无人认领会打 `report unhandled: …`，原话就在后面。
   另有扩展日志行 `[ext:bg] 帧投递失败 …`——那是「页面暂时够不着」（关闭/刷新
   中/没注入）的留痕：不上报 error、不挂起（2026-10-02 拍板），静默看护 30s 会
   自动 reload（回合领养接回收话），reload 无效 60s 提醒喊人，3000s 执行保险丝
   才跳过节点。

## 已知边界（v1）

- **侧栏只在 chat.deepseek.com 可开**（站点围栏，2026-09-26）：其他网站点扩展图标不弹侧栏；
  在站点页把网址切走，该页的侧栏资格自动收掉。坑：setOptions 按页配置会
  整体替换、不回退 manifest 缺省，启用分支必须带 path（修在 background.js 围栏处）。
- 依赖各官网的网页界面结构（如 DeepSeek 的 `ds-` 设计系统类）；官网改版要跟着更新——全部
  锚点清单与改版取证法（diagKeys/api 探针）在站点包 SITE.md；哈希类名
  （如 `fbb737a4`）勿锚。
- 服务无鉴权（只绑 127.0.0.1，与驿站收件口同款自验证态度）；别把端口暴露出去。
- 逐字流（草稿层）未接：投影中心等整段落账，没打字机。
- 侧栏「手动发消息」是手工测试通道，不建在飞回合、交不了卷。
- 会话标题用 `document.title`（跟随网页自身起名）；无历史回放（引擎台账兜底）。

## 验证

```bash
node --test tests/runtime.test.mjs   # 单测（席位账/收件口分流/回合簿记，桩桥零依赖）
node --test tests/site-boundary.test.mjs  # 站点包边界守卫（网站事实不外泄）
node --test tests/canvas-files.test.mjs   # femoGen 文件面单测（账本/存盘三态/围栏）
                                     # 勿用 node --test tests/：目录形式会把 smoke-*.mjs
                                     # 也当测试跑（Node v22 实测 fail）
node tests/smoke-bridge.mjs   # 真引擎直连冒烟（沙盒隔离）
node tests/smoke-service.mjs  # 服务冒烟（协议面/长轮询/收件口/画布文件面）
```

金标准仍是真运行目检上帝窗（全局验收铁律）。
