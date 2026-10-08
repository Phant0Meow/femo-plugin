# compiler 多 Job 同跑改造 — 施工清单

> 状态：待施工。方向已拍板（femoCompiler/AGENTS.md §十五，2026-10-04 留档：「多场并行是既定方向，尚未落地」）。
> 本清单是那次拍板的施工化：把「引擎同一时刻至多一场戏」改成「场次互斥 + 可配额度的多场并行」。
>
> 本文档只管引擎侧（femoCompiler / db_utils / save_dialog / job_manager / femo_bridge 装配段）。
> 宿主面的单场假设（web 常量席位、dsh「末位=当前场次」账本、source:main 规矩）是后续单独立项的账，见 §八。

## 〇、一句话总设计

**不新建任何 Python 文件、不新建任何「多场协调器」。** 多场并行的全部协调点已经存在——JobManager 就是排他裁决的唯一权威，这次改造是把它的裁决单位从「引擎」换成「场次」、把额度从写死的 1 变成旋钮、再修掉两处进程级串扰源。改完的世界：同一个剧场、同一本角色库、同一块投影墙，同时上演 N 场互不干扰的戏；每个场次仍然同时至多一场（台词顺序完整性的底线）。

### 为什么不建新文件（归属三问过一遍）

- **场次占用账**（谁在演哪个场次）：它就是排他裁决的一部分，与 `_bound`（job→runner 挂靠）同锁同家。放进 job_manager.py，拆出去反而要跨文件协调两把锁——两层状态机必漂移。
- **场次号原子分配**：这是数据库操作，家乡在 db_utils.py。
- **落库管道常驻化**：管道本体在 save_dialog.py，改它的生命周期，不换地方。
- 有没有「需要一个 MultiplexManager / Scheduler」的冲动？不需要。spawn_job_worker 的 per-job worker 线程、per-job Runner、per-job 事件信封全部现成；真正缺的只是裁决口径，而裁决只有一个家。

## 一、改造前的三个事实（每刀的依据，先立住）

1. **单跑闸只有一把**：全链路唯一的全局排他在 `JobManager.create_job`（femoCompiler/job_manager.py）——`_bound` 非空即抛 `JobBusyError`。这是桥时代「一桥一宿主一戏」的遗产；worker 字典、runners 字典、事件信封、`bound_job_ids()`、`settle_jobs` 收场清单**全部**本来就是复数形状。
2. **`save_queue` 是模块级单例，且生命周期按「一场 run」设计**（femoCompiler/save_dialog.py 末行 `save_queue = SaveQueue()`）：`run_async` 开场 `restart()`、收尾 `wait_empty(10)` 会置 `_running=False`、投毒丸、join 掉写库线程。两场并发时甲场收尾把泵停了，乙场后续台词全部堆进无人消费的队列——不报错、不落库、静默蒸发（乙场自己收尾时 `wait_empty(10)` 只会白等超时，照发 flow_done，表面一切正常）。**这是多开第一阻断项。**
3. **场次号取号有竞态**：新场次号是「`get_max_session_id() + 1` 再 INSERT」（db_utils.py），daemon 单进程内两个 worker 线程同时开户会拿到同一个号，`INSERT OR IGNORE` 让第二家**静默挤进**第一家的场次——两场戏写进同一本台账、上下文互串。今天被单跑闸挡着永不触发；闸一拆就是必然撞车。

另有一个**今天就存在的洞**（与本改造无关、但顺手修）：两个并发 `job_resume` 对同一个 Job，六关都在锁内先后通过（六关不置 running，置 running 的 `mark_running` 是 worker 线程稍后才调的），双双起 worker、`_bound` 同格互相覆盖——同一 Job 双重续跑。刀 3 的「六关与置位一拍」正修此处。create 侧还有个同族窗口：闸门的依据是 `_bound`，而挂靠要等 worker 把 Runner 构造完（数百 ms）才发生——create→attach 之间第二个 job_start 照样过闸（今天低概率；开闸后宿主程序化连发可达）。三个表现（create→attach 窗口 / resume 不查额度 / 同 Job 双续跑）同根：**排他裁决没有单一权威点**。刀 3 的预约制一并收口。

## 二、刀 1：落库管道常驻化（排水不停泵）

**文件**：femoCompiler/save_dialog.py（改 `SaveQueue`），femoCompiler/FEMO_runtime.py（改两个调用点）。

**改什么**：

1. `SaveQueue.wait_empty`（save_dialog.py，现签名 `wait_empty(self, timeout=None)`）：语义从「等清空 + **停泵**」改为「等清空 + **不停泵**」。现有实现里这三行是停泵动作——`self._running = False`、`self._queue.put(None)`（毒丸）、`self._worker.join(timeout=timeout)`——全部删除；保留前面的「轮询 `unfinished_tasks` 至清零或超时」循环不动（D2 修复的排水逻辑原样）。docstring 改写为「排水：等队列清零即返回，泵不停车」。
2. `SaveQueue.restart`（紧随其后）：失去存在意义（永不停泵就无需重启），退役注释观察（按仓库「已退役·观察期」格式），无报错数日后随观察期批次删除。
3. 新增 `SaveQueue.shutdown(self, timeout=None)`：真正停泵（把原 `wait_empty` 的停泵三行动过来：置 `_running=False` + 毒丸 + join）。**唯一调用方是进程退出路径**——femo2host/python/femo_daemon.py 的散场/退场点（`os._exit` 前不必调，daemon 线程随进程死；真正要调它的是将来任何「引擎进程内优雅收尾」的场合，如 CLI 连跑完主动退出）。首期可以先只定义不接线，避免为不存在的需求铺线；工单里写明这个取舍。
4. FEMO_runtime.py 两个调用点：
   - `run_async` 开场（约 3429 行）的 `save_queue.restart()`：删除（管道常驻，无需重启）。
   - 收尾（约 3580-3583 行）的 `save_queue.wait_empty(10)`：**保留不动**——排水语义正是它要的（取消路径台词落库不丢，批次 1 实锤的回归锁定），改的只是它不再有停泵副作用。

**为什么这么改**：多场并发时任何一场收尾都无权动全局唯一的落库管道；但「本场台词全部落库再宣布收工」的排水等待是**每场自己**的正当需求，所以等待保留、停车删除。

**谁接他**：run_async 的收尾链（现有）；test_job_lifecycle.py 的 `test_cancel_path_flushes_dialog`（取消路径落库回归）与 test_pause_contract.py 的 worker 秒退断言——语义全部不变（排水照旧、更快了），跑一遍应全绿，无需改测试。

**验收**：单场跑完→再跑一场（CLI 连跑）台词不丢；沙盒里两场交错启停，先收尾的场不影响后收尾场的落库。

## 三、刀 2：场次号原子分配

**文件**：femoCompiler/db_utils.py（新增一个函数），femoCompiler/FEMO_runtime.py（改三个取号点）。

**改什么**：

1. db_utils.py 新增 `allocate_session_id(title: str = '') -> int`：
   - 模块级一把 `threading.Lock`（`_session_alloc_lock`）；
   - 锁内：`SELECT MAX(session_id) FROM sessions` → `max + 1` → `INSERT INTO sessions (...)`，返回新号；
   - 现有 `get_or_create_session` 不动（「拿到显式号去开户」的语义仍被声明场次、恰好匹配分支使用）；`get_max_session_id` 保留为只读快照，docstring 标注「只读快照，禁止用于分配——分配唯一入口是 allocate_session_id」。
2. FEMO_runtime.py 三个「查最大号 + 1」的取号点，全部改调 `allocate_session_id`：
   - `FEMORunner.__init__` 里 session 无声明/`new` 分支（约 513-514 行）；
   - `数字/new` 恰好匹配分支（约 538-541 行）：这里语义特殊（「新建后的号恰好等于声明号才认」），改法是先在锁外读 `get_max_session_id() + 1` 做**预判**，若恰好匹配则调 `allocate_session_id`——但锁内分配的号可能与预判不同（另一场刚刚插了号）。正确改法：给 `allocate_session_id` 加一个可选参数 `expected: Optional[int] = None`——锁内取号后与 expected 不符则返回实际号（调用方走「不匹配」分支），相符则照常。这样「恰好匹配」的判定整体搬进锁内，竞态窗口关闭。
   - 用户确认新建分支（约 546-555 行）：同款替换（本刀顺带把这里的交互改掉，见刀 5）。

**为什么锁在 db_utils 而不是交给 SQLite 自增**：sessions.session_id 是 INTEGER PRIMARY KEY（= rowid），插 NULL 可以原子分配——但全引擎的场次语义是「显式号」（meta.session 声明、断点续跑回填、`数字/new` 恰好匹配全在传具体号），改成自增要把这些调用点全部翻一遍，diff 大而无收益。daemon 单进程形态下（桥已退役，每数据根唯一座），进程内锁就是全局锁；跨进程双写同一数据目录的场景被「数据目录=租户边界」的部署裁决挡在门外（同一数据目录的两个部署=同一租户=同一座 daemon），无需文件锁。

**谁接他**：FEMORunner 构造（上述三点）是全部消费方；`mark_session`→JobRecord.femo_session_id 的回填链路照旧。

**验收**：新增测试——N 线程并发各开 100 场，无撞号、无空号（号连续性可断言总数=MAX）；现有全部测试不红。

## 四、刀 3：排他换单位（本改造的主刀）

**文件**：femoCompiler/job_manager.py（主战场），femo2host/python/femo_bridge.py（装配与错误映射），femo2host/femo_api.py（门面文档与导出），femo2host/python/femo_daemon.py（旋钮接线）。

### 3.1 JobManager：额度 + 场次占用账

**`__init__`**：加三个成员——
- `self.max_active_jobs: int = 1`（构造参数，缺省 1）；
- `self._active_sessions: Dict[int, int] = {}`（场次占用账：session_id → job_id）；
- `self._reserving: set = set()`（create 预约位：create_job 落盘那拍登记、attach 成功或 detach 清账那拍撤销——额度裁决的权威计数=「挂靠 ∪ 预约」，见下）。

**`create_job`**：全局排他改为额度裁决——
- 额度判据**数「挂靠 ∪ 预约」，不裸数 `_bound`**（2026-10-07 复审补丁，堵 create→attach 窗口）：`if len(self._bound) + len(self._reserving) >= self.max_active_jobs: raise JobBusyError(...)`，判过之后同拍把新 job_id 登记进 `_reserving`（同一把 `self._lock` 内、与落盘同拍）。只数 `_bound` 的话，Runner 构造的数百 ms 窗口里第二个 job_start 照样过闸、额度被突破——排他从裁决到落位必须是一份账。
- 满额时 active 取 `_bound` 里任意一个，沿用现有 `active_job()` 取法；错误码沿用 `another_job_active`，宿主侧零改动——已核实四家宿主无按此 code 的代码分支，只当人话显示（dsh/zcode 源码里的引用均为注释，2026-10-07 复核）。
- 缺省 1 且无并发连发时：判据与旧 `if _bound` 逐值等价，**零回归**（并发连发时新判据更严——那是修洞，不是回归）。

**新增 `claim_session(self, session_id: int, job_id: int) -> None`**（锁内）：
- `_active_sessions` 里该场次已被**其他** job 占用 → raise `SessionBusyError(占用的 job_id, 该 job 的 host_ref)`（新类，继承 JobError，code=`session_busy`，detail 人话：「场次 X 正被 Job Y（宿主 Z）演出中」）；
- 否则登记 `_active_sessions[session_id] = job_id`。幂等：同 job 重复 claim 同场次=过。

**新增 `release_session(self, job_id: int) -> None`**：按 job_id 清占用格（detach 的伴生物，幂等）。

**`attach`**：现有 duck 访问纪律（本文件不 import FEMO_runtime、只 duck 摸 runner 的属性——`discard_all` 已是先例）上改三件事：
- 整个 attach 进 `self._lock`（今天单场独占 + GIL 让裸写字典从没出过事；多场多写者时代，`_bound`/`_reserving`/`_active_sessions` 三本账的读写都归这把 RLock 管）；
- 锁内：`sid = getattr(runner, '_current_session_id', None)`，非空 int 则 `claim_session(sid, job_id)`；claim 过了才 `_bound[job_id] = runner` + `_reserving.discard(job_id)`——预约位撤销与挂靠同拍，双计数不可能。
- claim 抛 `SessionBusyError` 会从 attach 传播出去 → worker 的 except 收口（诚实链路，无新收口逻辑）。落点分两种、都诚实：**新开的场**没有断点 → `finalize('failed')` + flow_error 信（fresh_start 重来即可）；**续跑的场**档案断点还在（finalize 只在终态清断点）→ 落 `suspended(node_pause)`、错误文本带「场次忙」人话——保持可续，场次空出来再 resume 即是，语义恰好。

**`detach`**：worker finally 必达，作为三本账的**唯一清账点**——锁内 `self._bound.pop(job_id, None)` + `self._reserving.discard(job_id)` + `release_session(job_id)`（attach 成败、run 成败都汇到这里，幂等；attach 抛 SessionBusyError 时预约位也是从这里撤的）。

**为什么闸门放 attach 而不放 on_flow_start 回调**：`_rc_call` 是吞异常的旁挂（回调炸了只打一行 log，戏照演）——旁挂永远不能当闸门。而 attach 在 worker 线程里、`run()` 之前，raise 能沿「构造期异常」路径诚实收口。代价要写明白：到 attach 为止，Runner 构造里的场次开户行已 INSERT（撞占用时留一个**空场次行**，无对话内容、无害，属「尝试开演被拒」的遗物）——接受，不为此把 claim 提前（提前不可行：new 的场次号到构造那一刻才分配）。

**`resume_job`**：两处——
1. 六关之后、锁内追加**第七关**：档案有 `femo_session_id` 且该场次已被其他 job 占用 → raise `SessionBusyError`。这是续跑侧的**快速拒绝**（档案里有号，不用等 worker 起来才撞）；attach 侧的 claim 是机制性兜底，两道都要（第七关挡 99% 的常见路径，claim 兜住新开撞声明场次与极端窗口）。
2. **六关全过后在锁内置 running**（把 `mark_running` 的职责合进 `resume_job` 尾部：`rec.state = STATE_RUNNING; rec.reason = ''; self._save(rec)`）。同时 femo_bridge.py 的 `spawn_job_worker` resume 分支里现有的 `jm.mark_running(job_id)` 调用删除。这一拍正是「同一 Job 并发双重续跑」竞态的正修：旧时序里「六关通过（仍 suspended）→ worker 起来才置 running」之间有个 suspended 空窗，两个并发 resume 都能挤过去；现在裁决与置位在 `self._lock` 内原子完成，第二个 resume 在第②关就被 `already_running` 拒。构造失败的收口不受影响：六关过了置 running → 构造抛 → worker except `finalize('failed')` 在 running 态生效——与旧「构造前 mark_running」论证同效（spawn_job_worker 里那段「为什么 mark_running 在构造前」的注释随调用一并更新，别留过期论证）。`mark_running` 方法本体保留（femo_api 消费面已列名，别家还有没有直接调用先 grep，无则退役注释）。

**`active_job` / 新增 `active_jobs`**：`active_job()` 写死「取 `_bound` 第一个」的至多一个假设——保留方法（旧宿主文案兼容），内部改读 `active_jobs()` 的第一个；新增 `active_jobs() -> List[JobRecord]`（遍历 `_bound` 全部 `_load`）。

**`pause_job` / `deliver_human_input` / `reconcile_stale` / `finalize` / `merge_checkpoint`**：全部按 job_id 键控，多场天然安全，**零改动**（这行要写进工单，防止施工时手痒顺手重构——「能不动就不动」）。

### 3.2 femo_bridge.py：错误映射与旋钮装配

- `dispatch` 的 `JobBusyError` 捕获段（约 1630 行）：`active = jm.active_job()` 改为聚合 `active_jobs()`——`active_host_refs` 从单场归属字典改为全部活跃场归属的合并视图（同 host 多场时该 host 格取最新一场的标签即可，别造新结构）；`active_job_id`/`active_host_ref` 单值字段保留（旧宿主文案兼容，取第一个）。
- `spawn_job_worker`：resume 分支删 `jm.mark_running(job_id)`（职责已并入 resume_job）；其余（attach/detach/收口三件套）零改动。
- `build_stage`：装配 JobManager 处传入 `max_active_jobs`。旋钮来源：femo_daemon.py 的 argparse 加 `--max-active-jobs`（int，缺省取环境变量 `FEMO_MAX_ACTIVE_JOBS`，再缺省 1），沿 `_assemble_engine` → `build_stage` → `femo_api.get_job_manager(max_active_jobs=...)` 传下去。get_job_manager 的既有纪律「参数仅首次调用生效」对新参数同样适用（docstring 补一句）。
- CLI 直跑（femo.py / 干跑）不走 JobManager，零影响。

### 3.3 femo_api.py：门面文档与导出

- 消费面 docstring（get_job_manager 处）方法清单补 `claim_session / release_session / active_jobs`；`__all__` 补 `SessionBusyError`。
- 「同一桥进程同时只跑一个 Job」的旧表述改写为「额度可配（缺省 1）+ 场次级排他」。

### 3.4 为什么错误形态这样设计

- 满额：沿用 `JobBusyError`（code 不变）——宿主把 detail 当人话显示，零改动、零回归。
- 场次撞：新 code `session_busy`——宿主不认识新 code 也无妨（未知 code=普通失败+人话 detail），不假装兼容旧语义（「另一个 job 占着引擎」和「这个场次另有戏在演」是两句话，混用会骗宿主 UI）。

## 五、刀 4：SQLite 忙等显式化（廉价保险）

**文件**：femoCompiler/db_utils.py，`_get_conn()` 一处。

**改什么**：连接串后面加一行 `conn.execute("PRAGMA busy_timeout=10000")`。

**为什么**：台账写全走 SaveQueue 单线程串行（刀 1 之后这反而是优点——单写者天然无竞争，WAL 下读者无碍），但场次开户（worker 线程）、种子数据（幂等 INSERT）与 SaveQueue 的对话行 INSERT 之间存在写写相遇的窗口。Python sqlite3 默认忙等 5 秒，多场高峰（多 AI 节点同时收口落库）可能不够——显式抬到 10 秒，一行换一夜安眠。这不是正确性修复（WAL + 单写管道已保证正确性），是防「偶发 SQLITE_BUSY 炸场」的保险。

## 六、刀 5：两个边角的诚实化

**5.1 无 TTY 时的 input() 询问**（femoCompiler/FEMO_runtime.py，`数字/new` 不匹配分支，约 546 行）：

- 现状：`input("是否新建 session ...")`。daemon 的 worker 线程里 stdin 多半是空管道 → `EOFError` → 已被 except 收住 → `raise ValueError` 拒绝——**不挂死，是诚实拒绝**（这点核实过，比预想的好）。但用户手动在终端跑 daemon 时，worker 线程会抢主线程的终端发问，体验错乱。
- 改法：`input()` 前加判定 `sys.stdin is None or not sys.stdin.isatty()` → 跳过询问，直接走拒绝分支，ValueError 的人话改为「声明的场次 N 不存在；非交互形态无法询问，请改写 session = new 或 N/new」。TTY 在场（CLI 直跑）时保留询问。
- 红线论证：仅影响「声明了不存在场次」的边角路径，主流程零行为变化。

**5.2 `ensure_default_data` 的空库窗口——核实后不动**：

- 对方意见建议挪到启动时做。核实结果：femo_daemon.py 装配段（约 683 行）**已经在启动时调用** `femo_bridge.ensure_default_data()`，daemon 形态下空库窗口不存在；job_start/job_resume 里的重复调用是幂等保险（一次 COUNT 查询的代价），保留无害。并发 INSERT 撞主键会响亮 raise——符合「暴露 bug 炸了也是功劳」。**本刀不落任何改动**，在工单里记下这个核实结论，防止后人再提。

## 七、测试与验证门

1. **新增测试**（developer/tests/，跑前必设 FEMO_DATA_DIR，沙盒三通道纪律）：
   - test_job_manager.py 扩展：额度=2 时第三个 create 被拒（JobBusyError）；额度=1 时现有断言原样全绿（零回归锁定）；`claim_session` 撞拒（SessionBusyError 带归属）；`release_session` 幂等；并发 `resume_job` 同一 Job 只许一个过（线程竞态锁定）；**create→attach 窗口锁**——额度=1、模拟「create 过闸后 attach 前的窗口」再来一个 create 必须被拒（预约位站岗），attach 失败后 detach 清账、额度复位（假 runner 驱动，无需真引擎）。
   - 场次分配并发测试（刀 2 验收项）。
   - save_dialog 排水测试：模拟「甲场 wait_empty 返回后乙场仍可 enqueue 并落库」。
2. **全量 pytest**：动了 Python 侧，全量必跑（根 AGENTS.md §八）。
3. **沙盒双场实证**：两份不同剧本、不同宿主格，额度开 2：两场同时 running；投影页两场各自成段不混流；A 暂停不影响 B 推进；各交卷各收终局信；kill 引擎后对账两场各挂各的、各续各的。
4. **金标准**：真演出目检上帝窗/投影页双场并存（单测只护语义，不护时序）。
5. **三份同步**：开发仓、dist、安装缓存——改了引擎与装配段，三处都要刷；发布仍压在「一次带 AI 演员的多场真演出全链验证通过」之后。

## 八、明确不做 / 后续立项

- **宿主面单场假设盘点**（web 常量席位 web-femo、dsh 会话↔场次账本的「末位=当前场次」、source:main「一个宿主会话至多一场」的规矩）——引擎开闸后逐家来，本清单不含。
- **台账表不加 (session, turn, oratio) 唯一约束**：写入侧全是裸 INSERT、表无唯一键，撞键两行都落库；读侧去重（get_session_context）自 2026-08-28 加固起对撞键「全部保留并高声告警」、不吞行——所以同场次并发的真实病象是**两场台词全保留、按撞掉的 turn 号交错拼进彼此上下文 + 警告刷屏**（串台，不是蒸发；2026-10-07 复核现行代码钉死）。若照「加约束配 REPLACE」修，等于把交错串台变成写侧必然吞行——把可诊断治成不可见，方向反了。场次互斥才是正修（刀 3）。
- **跨场通信**（A 场角色看见 B 场发言）：剧本语言无此语法，另一个量级，单独立项。
- **跨场统一 LLM 限流**：每场独立 `llm_delay` 在多场时总速率翻倍——量级问题非正确性问题，等真撞供应商限流再议。

## 九、施工顺序与回滚

按刀序施工：**刀 1 → 刀 2 → 刀 3 → 刀 4 → 刀 5**，每刀独立可验证、独立 commit（中文写清原因与验证）。刀 1、2 不依赖彼此但都先于刀 3（闸门拆掉之前，串扰源必须已修）。刀 3 是主刀，落地时缺省额度=1，等于闸门语义逐值不变——先合入再开额度，出问题把旋钮拧回 1 即是回滚。
