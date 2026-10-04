<!-- ============================================================
SKILL.common.md — FEMO 通用教条正文（唯一份，femoGenConnector 管）
------------------------------------------------------------
宿主 SKILL/preset 用 INCLUDE 指令（见各加载器）展开本文件；正文里的
宿主占位符由加载器统一替换为宿主名。本文件不写指令字样本身，防止
展开后再被误认为待展开指令。
修改教条只改这里，宿主附录（开场白/视角窗口/宿主特有操作）留在各宿主。
逐行来源：dsh preset/agent.cordis.yml 与 zcode skills/femo/SKILL.md
逐段对比（2026-09-22），两宿主 SAME 的部分原样收口。
============================================================ -->

## FEMO是什么

FEMO = Flow Emerges Mag Opus.
这是一个多智能体编排模式：把"多个 AI 、多步骤"编排成自动化脚本(.femo)，后由femo引擎运行脚本来实现你设计的任何多智能体流程。

FEMO 模式非常强大，可能性非常多。
它编排的是 AI 工作的流程，所以只要你想用固化的流程限制 AI 的动作、以换取稳定性或可复现性，就可以写 femo：

- 你列的 to do list
- 你踩过的坑不想再踩
- 狼人杀等游戏
- 用户提出的工作流
- 你和用户想找更多 AI 聊天
- 斯坦福小镇类的 AI 交流

femo 可以是能跑的游戏源代码，可以是 skill，可以是 harness，可以是故事，可以是 AI 的生活，还可以是涌现的种子。

## FEMO模式指导

### 1. 写脚本之前

先想清楚：你的目的是什么？这个目的要如何达成才更好？你需要哪些角色（actors）？每个角色一步一步的做什么（action）？

- 比如，如果你想写个专门找复杂bug的femo，你可以思考你自己找bug的工作流、经验和教训，先看什么，再看什么，把它固化为femo脚本的prompt和流程，下次遇到这种场合就可以直接调用该femo。
- 比如，如果你有个复杂问题，可以使用femo，设置多个性格迥异、各当一面的子代理AI，让他们分头调研，进行讨论。
- 比如，如果用户想玩游戏，你可以给他写个角色出演游戏，由用户饰演一个角色，脚本中再设定其他各种AI角色，你甚至不需要设计剧情，因为AI们聊起来会自然发生涌现。
- 比如，如果用户想跟你一起玩，你可以给自己也在脚本中认领一个角色。

### 2. FEMO脚本怎么写

一个 FEMO脚本由五部分组成：meta（元信息）、actors（角色）、vars（变量）、若干 action（动作）、mainflow（主流程），需要引入 Python 文件时再加一个 code: 区。先给一个最小可运行模板看看整体长相，然后逐个字段讲怎么写。

可运行实例（复制结构照着改）：

```
meta:
  name = Goal模式
actors:
  ai @执行者
vars:
  done = false
action 执行 @ai(@执行者):
  prompt: |
    你的目标：为社区咖啡馆设计一份周末活动方案。
    继续推进目标，直到你认为完成。
    如果还没完成，继续。
    如果已经完成，单独一行输出：SET VARIABLE: <<done = true>>（赋值语句必须独占一行才被识别）
  out: done
mainflow:
  [START] -> [work]:执行
  [work] -> if (done == false) -> [work]   # 未完成就循环回[work]节点。
  [work] -> if (done == true) -> [END]
```

#### meta:

元信息区：name 脚本名 / session 可以用new或者指定Chronica中的session号 / system_safety 和 output_style 本femo脚本的统一前置提示词。

#### actors（角色）:

角色区。执行者可以有 AI 角色、人类角色（用户）、主Agent（你）。
可以定义ai角色和human角色。
关于 soul：soul是角色卡，建议写上，但非必须——无角色设定的简单FEMO脚本不写 soul，角色就是裸执行者（无 soul 角色看到本 session 全部上下文，不隔离）。
soul角色卡存在chronica数据库，写脚本前先用 femo-soul list 查库挑角色；库里没有的角色可用 femo-soul create 新建。
定义方式：
ai @子代理A = soul:角色id   # 普通AI角色。
ai @玩家甲 = source:main   # 这是你（主agent）把自己写进FEMO脚本的写法，使用source:main。soul角色卡可以带也可以不带。你的视角听从femo脚本规定。
human @用户                          # 这是用户的标准定义方法，他的femo角色视角=上帝视角。
human @用户玩家 = soul: human, source:0  # 如果规定人类source 0,他将失去上帝视角，只有作为@用户玩家的角色视角，视角跟着femo脚本规定的走。适合狼人杀等场合。

#### vars（变量）:

vars 是流程控制参数，驱动条件判断和角色视野。
femo脚本中所有出现的变量必须先声明再引用。
@开头的变量是femo独有的变量类型@actor类型变量。@actor的键和值都必须全程带着@前缀，不可省略。例如：@狼人 = @7号玩家。
更多复杂用法如全局、module局部变量、并发分支context变量与shared变量等，参见语法文档。

#### code（引入外部Python模块）:

别名 = file:"路径"
备注：
挂载femo文件（有文件保存path）可支持源于femo文件的相对路径。
如无文件保存path，就只支持绝对路径指向外部python文件。

#### action（动作）：

定义动作如'action 名 @mind(@执行者):'。
分为 @mind / @ai / @human / @notice / @assign / @func

1. @mind / @ai / @human 的action节点本质是一次带 prompt 的 LLM 对话回合（或者人类对话回合）：
- prompt：是给角色的私下指导（支持 {f-string变量} 替换）。showprompt类似于旁白，是公开的、节点scope可见。
- scope 上下文信息可见的房间：同一 scope 的角色共享聊天记录，跨 scope 天然隔离。不写 scope 或留空 = 全员可见（默认开放）；scope: self = 只有发言者和用户上帝视角可见（私密碎碎念）。scope 是显式的视野要求：写了才收窄。支持变量（如写scope: aliveplayers，然后其他环节对aliveplayers进行赋值）。
- 变量赋值：
  让 AI/人类 用 SET VARIABLE: <<变量 = 值>> 输出赋值来驱动流程（支持 =、+=、-=、add()、remove()）。带赋值的action节点必须有out声明被赋值的变量。赋值语句必须独占一行（另起一行写在台词后面），夹在句子中间的赋值引擎不认。out: 可用 name(required) 标注必须赋值的变量（缺赋值会带着报错打回节点重试），不注明默认 optional（缺了放行）；AI 赋了 out 未声明的变量会被丢弃并记警告。
   变量赋值只负责控制流程图的支线选择和scope，比如主agent审核子代理的工作，输出Pass = true，然后流程检测到pass true才继续往下个节点走。或者游戏脚本中AI角色想去酒馆，赋值playerInBar = add(@他自己)，这样别的节点如果scope:playerInBar, 他就能听见酒馆里其他人的闲聊了。
  不要滥用变量赋值传递信息。AI共享上下文，femo系统通过上下文传递消息，想告诉别的AI什么事儿，直接自然语言说就行了。
- @mind：运行时按执行者实际类型分发（AI/人类），更简单。

2. @notice 类型的action节点：无人类或AI回答，只把notice节点提供的prompt加入大家的上下文（取决于scope）。

3. @assign 赋值action节点：不调 LLM 的纯赋值动作（如 out: 变量 += 1）。

4. @func 运行外部函数的action节点：调用 code 区 Python 函数，需要写明in: 输入变量由femo交给Python，写明out：输出变量由python return了交给femo。

#### mainflow（主流程）:

主流程，类似于mermaid的语法，是一张节点图 [START] -> 动作 -> [END]；循环必须回节点位置（[A]），不能回 action 名。

支持顺序、循环、并行、条件与合并：fork / if / join 是并行分支 / 条件分支 / 合并；for / par 是串行循环 / 并行遍历（par 并发调 LLM）。

#### module 名(...):

子流程黑盒，flow 里用 &名 调用。

#### 更多：

这里说的极为简略，更多详细内容可参照官方示例，或者去阅读语法文档。

### 3. 先看示例以了解语法

官方示例FEMO脚本在 {FEMO_ROOT}\femoExamples\ ：

- goal-loop.femo — 循环 + 变量退出
- group-chat.femo — par 并行 + @func 随机间隔
- discussion.femo — for + if + par + 人类拍板
- town.femo — 动态 scope + add/remove 移动

写脚本前先读一个最接近需求的示例照着改；写复杂FEMO脚本前建议把 femoExamples\ 整体读一遍，学习 scope/vars/flow 的常见套路。

冷门语法（memory/context/module 等）查完整语法文档：{FEMO_ROOT}\语法文档.md。不要凭印象猜语法。

### 4. femo脚本保存

你和用户写的femo脚本建议存放：{FEMO_ROOT}\user_data\projects\

femo脚本中如果引用外部python函数，file地址规则：脚本里 file:"路径" 支持相对路径与绝对路径。相对路径为「相对脚本文件所在目录」；脚本未保存（纯文本直接运行）时只支持绝对路径。

如果是有外部依赖的复杂项目，建议新建文件夹，把python脚本和其他文件以及femo都存在一个文件夹里。

### 5. 干跑自检（改完FEMO脚本、正式运行前先做）

- femo-debug 把当前挂载的脚本空跑一遍：不调用任何 AI/人类（AI 动作与人类输入由调试器合成替答），引擎按真实管线跑完整流程。
- 返回两部分：①逐条调试流水（节点进出、变量 old→new、AI 合成赋值与来源、人类合成输入、重试、告警）；②终报（每轮结局与报错、节点执行顺序、边覆盖、变量快照 diff、未达节点）。编译失败时把编译器报错原话给你。
- 拿它确认这些事：
  - 流程按预期走；
  - 条件分支走对；
  - 循环能退出（步数预算 200，疑似死循环会中止并说明）；
  - 没有变成死分支的节点（终报的「未达节点」）；
  - 变量赋值如期发生。
- 代价为零：不花 token、不占 Job、不写生产台账（调试器用独立 DB 沙盒），可以反复跑——改完FEMO脚本再跑一遍，直到干跑干净再去 femo-run。
- 它跑的是「当前挂载的脚本」：挂载之后又改了FEMO脚本，要重新 femo-mount（或在 femoGen 编辑器里写入）再干跑，否则跑的还是旧版。
- 想撞随机分支/概率沉默：runs 多跑几轮（每轮换种子）；想复现某一次：seed 给同一个种子。
- 注意：合成输入是调试器按 out 声明/变量初值猜的，只验证流程与接线，不代表内容质量；台词好不好要正式运行或人工看。

进阶调试 CLI（单测某个 module / 定向注入变量 / 概率沉默 / 注入无效赋值测重试链路）：

```
python {FEMO_ROOT}\femo2host\femoToolcall\femo_debugger.py run <FEMO脚本>
       --module 名 / --set 变量=值 / --assign-prob 0.7 / --flaky 0.3
```

（用法见文件头注释；产出的流水与终报跟 femo-debug 返回同源。）

### 6. 运行

两种工作流，按用户意图选择，拿不准时问用户要哪种：

- **结果导向**：用户只想要结果（如「让一个团队完成某任务」）。
  你自主闭环：写脚本 → femo-mount 挂载 → femo-debug 干跑自检 → 改到干跑干净 → femo-run fresh_start 运行 → 等系统通知（跑完/报错） → 分析结果、迭代FEMO脚本，直到用户满意。
- **过程导向**：用户想参与/观看过程（如狼人杀、互动运行）。
  你写好FEMO脚本挂载后，先 femo-debug 干跑确认流程跑得通，再启动运行；
  启动运行、喂拍与投影的具体操作见文末「{HOST} 版附录」，或直接执行 /femo 斜杠命令。

### 7. 运行出错时

- FEMO 运行时，如果运行正常，你不会收到FEMO 运行消息。
- 如果编译出错、运行中报错、正常跑完，系统会告诉你。如果报错，你会看到报错信息。
- 出错时：先看错误信息，判断是否与脚本语法或依赖 Python 文件有关。
- 如果FEMO脚本和python文件是你自己写的，你可以立即改正，不用问用户。
- 如果FEMO脚本和python文件是用户提供的，你动手改脚本或文件前先跟用户确认。
- 改完FEMO脚本要重新 femo-mount（或在 femoGen 编辑器里写入）才生效，否则跑的还是旧版。

### 8. 查记录

femo运行记录：{FEMO_ROOT}\user_data\memory\Chronica.wor（SQLite/WAL）
用 mode=ro 只读连接即可，不影响运行中的引擎，无需停止运行再查。

现成查询器：

```
python {FEMO_ROOT}\femo2host\femoToolcall\chronica.py
```

- 无参数 — 最新场次的发言流
- 场次号 — 看指定场次
- --list N — 最近 N 场一览
- --scope — 每行附带可见用户/可见角色（排查视野类问题用）


## FEMO工具列表

| 工具 | 作用 |
|---|---|
| femo-mount | 挂载FEMO脚本，立即生效（dsh 下 femoGen 编辑器立即可见） |
| femo-script | 查看当前挂载脚本全文 |
| femo-debug | 零 token 干跑自检 |
| femo-run | 控制运行：fresh_start 从头跑、pause 暂停并挂起、resume 从断点续跑，运行中随时可停止/续跑。list_jobs 查挂起的 Job。 |
| femo-soul | 角色库 list 挑角色 / create 新建 |
| femo-possess | 附身/解附身：把一个会话绑定为某灵魂（soul）的出演者（多主会话参与运行）。action=possess/release；soul_id 必填（先 femo-soul list 查库）；session_id 缺省=本会话、host 缺省=本宿主——写了即跨会话/跨宿主分配角色。仅宿主接入附身能力后可用（工具列表里没有就说明本宿主走其他入口） |
| femo-chronica | 查询femo运行聊天记录。 |

### 附身（多主会话参与运行）

一个会话可以**附身**一个灵魂：附身后，脚本里该 soul 的 AI 角色轮到发言时，料包信直接送到那个会话——由它本尊出演该角色（保留其全部会话上下文），主Agent不再为它拉子代理；轮到发言时正常作答即可，所在宿主自动收卷交回引擎。

- **用法**：`femo-possess`（action=possess, soul_id=…）。替别的会话分配角色：带 session_id（跨宿主再带 host）。解附身：action=release。
- **主Agent须知**：启动运行后只给**没被附身**的 AI 角色拉子代理（zcode 例外：缺员直接拒演，见宿主附录）——附身角色的信由它自己的会话到站自取。哪些角色已被附身，看投影中心绑定账（cast-preferences）。
- **规则**：提名制（2026-09-26）——同一角色允许多个会话各提各的票，最后一次指派算数，自下一次开演定格起生效（演出中改提名不影响在跑的戏）；human 角色不可附身。
- **入口随宿主**：有 femo-possess 工具的宿主由 AI 调用；有等价程序入口的宿主（zcode：本机 femo-possess 程序，参数口径同此工具，见宿主附录）由 AI 运行程序；走界面入口的宿主（如 dsh 的会话挑角色）由用户操作，效果同账。


