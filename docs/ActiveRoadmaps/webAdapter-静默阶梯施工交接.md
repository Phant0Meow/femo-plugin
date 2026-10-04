# webAdapter 静默阶梯与站包锚点——施工交接（2026-10-02）

> 上一窗口把「网页席位对后台标签页冻结」的处置整套重做了。本文是交接：设计为什么是这样、
> 改了什么、实案证据、以及下一窗口从哪继续。配套必读：webAdapter 守则坑12/17/18/22/23、
> readme「关键裁决」两条（回合静默阶梯 / 任务看护）。冲突时以源码为准。

## 一、背景：这台机器的浏览器会猎杀后台页

用户的 Edge 对后台标签页的冻结快得反常（坑18 实测「6 连 reload 每页只活 1 秒」；本轮再实测：
豆包页**加载后 6~12 秒**内 JS 停摆，比一次发送流程还快）。「让页面一直活着」在这个环境不成立，
所以整套设计的重心是：**冻了之后怎么把话收回来**，而不是防冻。用户侧根治手段是浏览器设置
（edge://settings/system 的效率模式/睡眠标签页 + 站点「从不睡眠」名单），这不是代码活，但它是
根——页面不冻，下面整套阶梯根本不会被触发。扩展里设的 autoDiscardable=false 只防「丢弃」、
防不了「睡眠/冻结」，是已知边界。

## 二、设计定案：四级静默阶梯（用户原话逐字）

> 「0.默认保活。 1.节点未结束，收不到内容 30 秒， 自动 reload。2.reload 还收不到，弹提醒。
> 3.弹提醒还收不到，就等着，3000 秒超时，报 warning，运行到下一个节点。」

> 「所有这种场合，都不许结束femo，不是error，甚至不是warning，切个页面就救活了算什么error。
> warning并且到下一个节点，直到这个时候都不要停止引擎。」

裁决依据（每条都用户拍板过，别翻案）：

- **判据是「收不到内容」不是「ping 不通」**：已发送/流式 delta 都算内容（lastSignAt 活气打点）。
  能 30s 无内容还应答得了探活的页恰是假活（网络闸死/收话判定卡死），reload 正是救法；正常生成
  delta 400ms 一拍绝不会误触发。因此探活整个删掉——顺带消灭「1.5s 单拍误伤活页」的误伤面。
- **reload 恰一次**：防网站风控暴露，也防「页面还没冷加载完又被 reload」的自残循环。
- **提醒恰一次、挪到 reload 之后**：reload 没试过之前喊人是假警报（已发送后的长思考回合 30s 必误报）。
- **提醒后收钟死等**：3000s 保险丝 ⚠️ 占位跳过收卷，剧本继续——超时永不挂起。
- **「切页面就能救活」的场合永远不是 error**：唤醒失败/发送失败/收话失败/正文空一律降级留痕，
  绝不 actor_failed（那会挂起整场戏）。页面侧 error 上报已全部退役；服务端 error 契约保留给真终局。

**目的与手段的对齐（用户在窗口里最后纠正的，最重要）**：reload 只是手段，**收结束信号才是目的**。
reload 本身不产结束信号，它只是把收话机弄醒；收话机两条感官——网络闸（reload 后**必死**：网站从
历史渲染回复、不重放流）和 DOM 兜底（reload 后**唯一活路**：从页面历史读全文）。所以
**「reload 能收到结束信号」⟺ 站包配齐 DOM 收话锚点（domReplySelector + domBusySelector）**。
锚点从「可选优化」升格为「阶梯的命根子」。八家在役站包目前 deepseek、chatglm 配齐，豆包候选已
实锤，其余五家欠账。

## 三、已落地清单（全部已部署生效，job 2684 已跑在新代码上）

**server/runtime.mjs（核心）**

- 静默看护重写为阶梯：帧推进即武装（发送期一起管），「检查点重排」计时——每站按当前 lastSignAt
  重算到期时刻，活气刷新基点后到点自会发现没到线、按新基点重排；活气侧零挂钩。
  静默 30s → 发 reload-tab 帧（恰一次，记 stallReloaded）；静默 60s → remind 横条（恰一次，
  记 reminded）；之后收钟死等。领养重推（replay）只刷新基点，**额度是回合级不随重推返还**
  （防 reload 循环，也保住 doubao 实案「提醒饿死」的教训）。
- 原 30s ACK 提醒钟删除，armTurnTimers 缩成 armExecFuse（3000s 保险丝，推进起算、「已发送」不清零）。
- parkWakeFailedTurn 定形为「漂账」：帧从未推进、无 connId、sessionId 留空，立即提醒（广播）+
  执行保险丝，不进阶梯（hello 对不上号、reload 没目标）。原 `seats.list().find(s=>s.soul===…)`
  死代码删除（席位物理账不存 soul、list() 不喂映射，永远扑空），text-less frame 地雷一并拆除
  （若查中会让 hello 重放把 `undefined` 打进聊天框）。
- dispatchToSeat 的 parked 帧也进阶梯（busy 卡死/掉线时帧停在席位队里原本人间蒸发 60 分钟；
  复活链已验证：reload → register → pong 清 busy → pokeSeat 补发）。
- 提醒横条撤回（dropTurn 终局 + 页面苏醒两处）不再守 connId 在场——定向必失败一律广播撤
  （park 回合/浏览器重启换连接两种场合横条曾永不消失）。
- **闸门口查同 id**（第四道去重闸）：enterTurnGate 先查 seqActive/seqQueue 里的同 deliveryId，
  响亮拒绝。起因 DeepSeek 实案：双来路面单的第一路占闸后卡在 75s 唤醒窗，第二路过了闸外查重
  在闸里排队；第一路 park 立账放闸，第二路进闸才撞 duplicate——**静默自吞**，节点只剩漂账干等
  保险丝。dispatchToSeat 的两处去重也补了日志。
- send-failed 只留痕（提醒额度让给阶梯第②步；页面侧有 focus 自救，30s 静默 reload 后 hello
  领重发帧重新发车）。

**extension/background.js**：stall-check 查岗帧 → reload-tab 帧，直接 chrome.tabs.reload，**删探活**
（1.5s 单拍误伤面归零）；tabId=0 大声留痕；投递失败注释同步。

**extension/seat-agent-core.js**

- **reportReplyNow——FINISHED 同拍直报**（本批最重要的修复）：完成事件里思考/正文已齐，同一拍
  直接交卷，不再等 1s 轮询醒来。关闭「FINISHED 已处理完到下一拍轮询」之间的亚秒冻结窗口
  （job 2683 实案：147 字全文在手、日志里 FINISHED=true，reply 就是出不去）。只管 fresh 回合；
  领养回合仍归 adoptWait（DOM 全文优先——续流可能半截）。
- **offerDeliver/runDeliver 拆分**：消息通道立即应答受理结果，不再持有整个回合（原先是通道持有
  到回合收尾，reload 一断就报误导性的「帧投递失败」，发送其实早就成功了）。
- 回合账「消费」语义 + 所有权守卫：直报置空 inflight；runDeliver/adoptWait 的 finally 只清自己的账
  （`inflight.deliveryId === deliveryId`），不误伤后来回合。
- 收话失败/领养收割失败（含正文空）降级留痕，不上报 error。
- **scanReplyDom 常态取证探针**：没配齐锚点的站，页面每次加载 5s 后自动打一轮盘点（选择器命中数、
  忙锚可见性、末块大文本祖先链——链上带 id/data-testid，哈希类名不可锚）；领养时打同一份。

**测试**：runtime 33/33（含阶梯三锁「30s reload 恰一次→reload 后仍无内容才提醒→死等」「reload 后
hello 领重发帧」「有活气不 reload」、parked 帧阶梯、重试牌 park+终局撤条、闸门口拒绝同 id——原
「排队后静默自去重」测试升级为「门口响亮拒绝」）+ keeper 5/5 + site-boundary 6/6 + canvas 10/10 +
chatgpt 4/4 + 服务冒烟 SMOKE OK。时序测试按 Windows 定时器粒度（~15.6ms）留余量。

**文档**：全局 AGENTS.md §9.1 新增「静默阶梯定稿」条目（含四刀复查记录）；webAdapter 守则坑12/18
（四次拍板）/22（error 场景清单）/23（FINISHED 同拍直报实案）；readme 两条关键裁决+排障段；
豆包 SITE.md 翻案（「回答容器不需要」→待取证，候选链记录在案）。

## 四、两个豆包实案（证据都在 user_data/service.log）

**job 2683（旧代码，05:44 起）**：FINISHED=true、147 字全文在手（05:44:40 日志实锤），reply 上报住在
1s 轮询里，页面在亚秒窗口被冻 → 报不出去。阶梯 reload/领养全按设计走，但豆包无 DOM 锚点收不了尾
（领养盘点探针实锤「replySel 未配，busySel 未配」）→ 06:34:31 保险丝 ⚠️ 跳过 → 段收口、草稿按纪律
清掉（用户看到的「输出消失」=这个，不是数据丢失）。教训装表：坑23。

**job 2684（新代码，07:09 起，全部机制按设计工作）**：门口查重拦下双来路 ✓ → 唤醒闸 reload ✓ →
第一帧 07:10:04 投到页面上**无响应**（页面已冻），07:10:34 阶梯 reload 命令把页面解冻的瞬间滞留
消息才被处理（冻结而非崩溃的铁证）→ 新页 replay 重发 ✓ → 打字命中后 6 秒内**页面又冻**（发送判定
日志一个都没出）→ 07:11:36 提醒 → 死等，保险丝 ~08:00:36 ⚠️ 跳过。结论：机制全部正常，败因是
**页面冻结速度比发送流程快**——阶梯的一次额度在这种冻结率下注定走不到 FINISHED，根治在浏览器
设置。另：探针当场照出豆包语义锚（见下）。

## 五、下一窗口的待办（按优先级）

**【2026-10-02 下午续窗落账】**：第 1 件已完成（豆包 `domReplySelector =
[data-testid="message_text_content"]` 转正，busy 锚仍缺、退化单条件判定）；第 3 件已完成——
工作区按主题分四笔落库：`737010f` web 核心三锤+静默阶梯+四刀、`cf82af3` chatglm/豆包 DOM
锚点、`bd96ba2` 投影页底部停靠+等待镜像复数化（上一窗口的投影活顺手补的 commit）、本交接文档。
web 单测（runtime 33 + keeper 5 + site-boundary 6 + canvas/chatgpt/seats-core 16）与冒烟复核全绿，
hub selftest 复核绿。**第 2 件等用户**：五家在役站（kimi/chatgpt/aistudio/grok/千问）刷新各自的
会话页 → 服务日志搜「锚点取证盘点」→ 挑语义锚（id/data-testid 优先，哈希类名勿锚）→ 各转正
一行（锚点配在 sites/<域名>/content.js 的 createSeatAgent 参数里，不是 site.mjs——以源码为准）。
服务日志至今只有豆包两家出过盘点行，其余五家的页还没被刷新过（探针装好即自动打，无需别的事）。

1. **豆包锚点转正**（✅ 已完成，见上）
2. **其余五家锚点取证**（✅ 2026-10-02 傍晚「收集轮」全部完成——用户拍板「我们一起收集得了」，全程与用户协作：临时取证探针四代迭代装进各站 content.js（不碰骨架/runtime，并行窗口在写），用户重载扩展+刷新会话页喂证据）：
   - grok `[data-testid="assistant-message"]` + busy `[aria-label="停止模型响应"]`（testid 分侧实证，五家里语义最硬）
   - 千问 `.answer-common-card .qk-markdown`（两轮同链；`qk-markdown-complete` 状态类不可依赖——首轮有次轮无）
   - chatgpt `[data-testid^="conversation-turn-"] .markdown.prose` + busy `[data-testid="stop-button"]`（生成中发送钮变身，零假阳性；八家唯一 reply+busy 双件齐）
   - kimi `.segment-assistant`（思考在 thinking-container/toolcall-flow 体系、segment 体系之外，锚整段不混思考；二代探针把祖先链加深到 10 层才照出消息级容器）
   - aistudio `ms-chat-turn:not(.thought-activity-host) .chat-turn-container.model .text-chunk`（四代探针+解剖拍定谳：页上 testid 全无；三重语义=回合级+模型侧+非思考宿主；**innerText 判可见**是四代的关键——cdk 无障碍浮层的标记在父容器上、类名过滤失效，clip 隐藏元素 innerText 为空串，渲染事实一锤定音）
   - 忙锚缺额：千问/aistudio/kimi 未配（无证据宁缺勿猜，退化「文本 3 拍不变」单条件）；取证法记各 SITE.md
   - commit 链：808049d（grok/千问/chatgpt 转正+kimi/aistudio 二代探针）→ 4f75f34（kimi 转正+aistudio 三代）→ ccaaa4c（aistudio 转正，八家集齐）
3. **未提交改动一大堆**（✅ 已完成，见上：737010f / cf82af3 / bd96ba2 + 本文档）。
4. **流式断链（✅ 已修 + 探针转常驻）**：用户报「还是有些地方流式没收到」→ 八家流式诊断探针（11791a1，delta 心跳进服务日志，手工聊天即可验证四环哪环断）。第一枪实锤 **aistudio 解析器与上游流形状脱钩**（17s 生成 delta 1 拍 0 字）——diagKeys 逐条转储通道（438a135）拿到 8000 字真帧样本，深度轨迹分析定谳**双层外壳**（上游在响应外壳里加了「块容器数组」层，09-29 成例过期），修法=外壳吃两层（130d626）；真样本实验 25 块全解析、回归件翻新全绿；**用户真生成验证：思考 1623 字 / 正文 726 字 / chunks=29（修复前 0/0/1）**。**探针按用户拍板转常驻**（原话「不要删流式探针，万一又出问题呢」）——纯只读、心跳 5s 至多一条，八家齐装（226e6c9，aistudio 心跳段补回）；其余七家待日常使用中看心跳验证。
5. **设计遗留（等用户拍板再动）**：极端冻结率（页面活不过 10 秒）下「reload 恰一次」额度不够走到
   FINISHED——是否给「已发送未完成」回合追加救援额度？这动「reload 恰一次防风控」的原拍板，
   不许自作主张。~~浏览器白名单是根治，先让用户改设置。~~
   **【2026-10-02 用户翻案，原话逐字】**：「我不打算把各家AI站点加入从不睡眠，应该是插件端
   能解决的事儿，就别劳动用户改设置」——根治一律归插件端（锚点齐了，reload→领养→DOM 全文
   本来就是插件端的活路；救援额度机制等这场锚点收集完再议）。
5. 顺手项：job 2684 的豆包 _5 回合若还在死等，用户切到豆包页解冻会让被打断的发送自动续跑收卷
   （活跃页网络闸全程活着），或等保险丝 ⚠️ 跳过。

## 六、验证怎么跑

```bash
cd hostAdapter/webAdapter
node --test tests/runtime.test.mjs      # 33 项：阶梯/去重/领养/park 全覆盖
node --test tests/keeper.test.mjs       # 唤醒闸 5 项
node --test tests/site-boundary.test.mjs
node tests/smoke-service.mjs            # 服务冒烟（沙盒）
```
金标准照旧：真演出目检「冻页 30s 自动 reload 接回收话、不循环 reload、全程零挂起」。

## 七、关键文件指路

- server/runtime.mjs——阶梯（armStallWatch/stallCheck）、保险丝（armExecFuse/skipTurn）、顺次闸
  （enterTurnGate 门口查重）、park 漂账（parkWakeFailedTurn）、hello 领养三态、onSeatReport。
- extension/seat-agent-core.js——reportReplyNow（FINISHED 同拍直报）、offerDeliver/runDeliver、
  scanReplyDom 常态取证探针、adoptWait。
- extension/background.js——reload-tab 帧、巡检零 reload、autoDiscardable 保活 B 案。
- server/keeper.mjs——唤醒闸（reload 预算 2/FIFO/75s）。
- sites/*/site.mjs——各家锚点（domReplySelector/domBusySelector 就配在这）。
