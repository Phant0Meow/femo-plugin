---
name: femo
description: "FEMO 多智能体编排系统：把\"多个 AI 、多步骤\"编排成自动化脚本(.femo)，将流程固化，方便当下运行和未来复用。FEMO 引擎将运行你设计的任何 AI 智能体流程。适用场景包括但不限于：你想固化踩坑经验、to do 清单、多步骤工作流；多个AI分头调研、讨论、互评；狼人杀等游戏流程；用户想跟你一起玩游戏；想找更多AI聊天；斯坦福小镇式AI涌现生活。当场景合适时，你可以提议用femo，详细信息你应主动查阅 Skill.md。"
---

# FEMO模式（zcode 版）

zcode 版 femo 插件根在 {FEMO_ROOT}\hostAdapter\zcodeAdapter；{FEMO_ROOT} 即引擎根，正文所有路径在安装态已由 MCP 启动时替换为本机真实值（见文末机制说明）。

{{INCLUDE:femo2host/femoGenConnector/SKILL.common.md}}

## 附：zcode 版宿主补充

- 空闲时：正常聊天，写脚本、调用工具、回答用户问题——和普通 zcode 会话一样。
- 用户可经投影中心网页（hub，手机可开）观看运行实况（上帝视角/角色视角）。
- 主agent参与运行模式：你也可以用 source:main 参与FEMO脚本的运行实况（source:main 写法见通用正文 actors 节）。
- 启动运行、喂拍与投影的 zcode 具体操作见下节，或直接执行 /femo 斜杠命令。

## 附：zcode 版附身（femo-possess 进程——认领角色+后台等信一体）

zcode 的附身入口是**本机进程** `femo-possess`（不是 MCP 工具），参数口径与公共正文的 femo_possess 工具完全一致（--action / --soul_id / --host / --session_id）。附身规则（提名制、human 不可附身、最后指派算数）见公用正文「附身（多主会话参与运行）」节。用法：

- **附身自己（主形态）**：`node {FEMO_ROOT}/hostAdapter/zcodeAdapter/runtime/femo-possess.mjs --action possess --soul_id <角色>`（Bash 工具 `run_in_background: true`）。进程自动自证本窗会话号（输出 CLAIM 暗号→宿主落盘→进程搜回自己的号）并落提名账，然后留在后台等信（信到即退出=宿主唤醒你开演）。**认领结果看进程输出里的「possess 完成」行。**
- **附身/解附身别人**（替别的窗派角）：同上再加 `--session_id <对方会话号>`（跨宿主再加 `--host <宿主名>`）——一次性落账即退出，不等信。
- **解附身自己**：`--action release --soul_id <角色>`——自证后退票退出。
- **查本会话 id**：femo-possess 自证成功后的输出里有（「自证会话号 sess_…」行）；替别的会话派角、开演带 session 参数都用它。终端 env 里没有这个号。
- 任何 zcode 会话都能附身：在你想参与运行的窗口里说一声「附身某角色」即可，不必挤在主Agent一个会话里。附身不动「主会话」指针：谁启动运行谁是主Agent。
- **重复附身无害**：账是「一窗一格、再提顶替」，重复认领同角色不产生重复记录，反而会在窗口重开后把账对齐到新窗口。
- **zcode 侧不拉子代理出演**：actors 区声明的 ai 角色必须全部有提名才开演，缺员时 femo_run 响亮报错点名——各窗口跑 femo-possess 认领后重新开演即可。
- **只被要求「绑定灵魂」（挂哨兵/认领角色）时，运行后台 femo-possess 程序就是全部操作**：不需要干跑，不需要写/挂载/运行脚本，不需要做其他任何事——干跑自检只针对脚本变更（见通用正文「干跑自检」节）。

## 附：zcode 版演出循环（每拍：架 femo-possess → 说话 → 真闭合）

演出中每一拍走同一个循环。**回答就是交卷**：宿主只把本回合最后一条消息交给收卷器——所以每一拍的顺序是「先架 femo-possess，再把台词作为最后一条消息说出」，说完真闭合；不调任何 femo 工具、不敲任何命令、不读任何文件，收卷由插件自动完成。

1. **被唤醒 = 轮到你。**femo-possess 进程退出的唤醒通知就是节点通知：上下文、节点提示、showprompt 都已随信带到，直接开演。
2. **先架 femo-possess**（演出中唯一要跑的命令；Bash 工具 `run_in_background: true`，趁开口前架好；演员窗每拍重跑同一条命令=重复认领无害）：

   `FEMO_ROOT="{FEMO_ROOT}" node "{FEMO_ROOT}/hostAdapter/zcodeAdapter/runtime/femo-possess.mjs" --action possess --soul_id {本窗口soul}`

   不带 `--session_id` = 附身自己（会话号自动自证，无需传）。**一个窗口只架自己的灵魂进程，全程不换**：本魂的拍子信与本窗的场务信（散场/暂停/警告）都由它接——拍子叫你开演，散场信直接叫你验收收工，没有「演完换别的席」这一步。
3. **再把台词作为本回合最后一条消息正常说出**（纯文本）。说完**结束回合，真闭合**（页面真停、用户插话正常对话不排队）。之后只有两种醒：
   - 有下一拍 → femo-possess 退出 → 回到第 1 步；
   - 戏终局 → femo-possess 退出，信是「✅ FEMO 已跑完」→ 验收（job 档案 state=finished、台账收齐台词）→ 收工。

- femo-possess 领拍即取信：见到寄给本席的 pending 信约 1 秒内取走消费并退出，宿主原生唤醒本窗口。
- 纪律：同一时刻只架一个 femo-possess；架进程与收尾在同一拍完成，不存在「忘记架」；不要用 Stop 钩子干等，也不要当轮内 sleep 硬等（占住整轮、页面挂运行标记、插话排队）。

## 附：zcode 版开演/续跑要带会话号

- zcode 是拉取宿主，信按（宿主，会话号）双词对号投递：`femo_run` 的 fresh_start 与 resume 都带 `session` 参数，值=本会话号（femo-possess 自证成功后的输出里有，见「zcode 版附身」节）。不带号的会话领不到带号的信；续跑时它同时是把在柜信过户给新窗口的收养凭证（窗口关了重开、会话号变了，就靠它拿回自己的信）。

## 附：zcode 版视角窗口查看

- 观看实况与回看都走**投影中心网页（hub）**：浏览器打开 hub 地址（缺省 http://127.0.0.1:8790，被占向上顺延）。上帝视角、各角色视角、场次行与实时流都在页内切换，手机可开。
- **人类角色发言**：在投影中心网页的人类输入席直接输入提交（页内带格式提示）。
