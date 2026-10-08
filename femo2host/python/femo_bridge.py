#!/usr/bin/env python3
"""
femo_bridge.py — stdio NDJSON JSON-RPC bridge for the Femo compiler.

Runs the Femo engine as a headless subprocess and speaks newline-delimited
JSON over stdin/stdout. 引擎面唯一入口 = femo2host/femo_api.py（门面）：
本桥不直接 import 引擎内部模块——引擎内部重构保住门面签名即可，宿主与桥
零改动（2026-09-13 API 化改造）:

  host -> bridge:  {"id": 1, "cmd": "job_start", "args": {...}}
  bridge -> host:  {"type": "response", "id": 1, "ok": true, "result": {...}}
                   {"type": "response", "id": 1, "ok": false, "error": "<code>", "detail": "<人话>"}
                   {"type": "event", "event": "<event_type>", "data": {...}}   # 事件信封带 job_id

Commands（Job 模型协议，运行状态链路重构 §7.2——每个命令必须给明确答复，
错误一律 {ok:false, error:<code>, detail:<人话>}，杜绝假成功 B5 死于结构）:
  job_start      Start one Job (active exclusivity in JobManager; compile_error
                 rejects before any Job file is created).
  job_resume     Resume a suspended Job (six gates adjudicated by JobManager;
                 resume_state comes from runs/<job_id>.json, not from host).
  job_pause      Pause a Job (idempotent; suspended persist happens on the
                 Runtime on_state_change callback, not here).
  actor_failed   Host executor ultimately failed (B5) — engine adjudicates:
                 notify author + suspend at node (断点保留，续跑=换新执行体重演).
                 Same mailbox validation as human_input; envelope
                 {'__actor_failed__':True, kind, detail}.
  human_input    Deliver human/AI input for a waiting node (per-Job mailbox,
                 no blind delivery).
  get_job_state  Read one Job's archive verbatim.
  list_jobs      List all Job archives (metadata rows, no vars_state).
  list_scripts   List .femo scripts under the user_data projects dir.
  check          Synchronous compile check (no state, no run).
  get_soul       One soul's record (persona 注入用；B4——宿主零直读 SQLite).
  collect_notices 停下信号现场代取：本 Job 给 main 的通知信包（急件+已放行
                 滞留件），取走即记送达——system_push 宿主（dsh）的收件口。
  list_souls / create_soul / ping / shutdown  (retained)
Retired: run / pause / resume / get_checkpoint (zero live consumers; host
switched in the same commit — no shims §八.6).

Protocol notes:
  - 引擎面唯一入口：femo2host/femo_api.py 门面——本桥的全部引擎消费
    （parse_script / FEMORunner / JobManager / db_utils / host_manifest /
    BLOCK_KEYS）都经它；私有属性注入（_human_input_event/_host_ai_backend/
    _context_mode）已在门面 create_runner 收口为显式参数。
  - One JSON object per line, UTF-8. Every outbound line goes through a lock
    (event callbacks fire from LLM stream threads).
  - ai_request.blocks 料包键词汇契约见 femoCompiler/protocol.py BLOCK_KEYS
    （引擎拥有词汇表；拼装归执行后端——宿主拼装器为宿主模式正身）。
  - TranscriptStep 契约（AI 节点 human_input 回传 body.steps 逐项，生料）：
      {step:int, cot:str, reply:str, tool_calls:[{name,arguments}], tool_results:[str]}
      排版（[TOOL CALL #N] 模板）由引擎落档前套用——契约权威与归一化实现在
      femoCompiler/protocol.py，换 harness 只需照此契约回传。
  - 宿主握手面（harness 无关）：--host-manifest 提供清单（thinking 档位/
    默认用户——词汇事实，femoCompiler/host_manifest.py 消费，缺省回落内置）；
    job_start/job_resume/check 的 models 参数提供模型白名单
    （validate_actor_sources 编译期校验 source 用）；host_ref 是宿主塞的
    不透明标签（透传存档，引擎不懂；旧协议名 owner_tag 兼容读）。
    host_ai_backend（旧名 dsh_ai_backend 兼容）= AI 节点交宿主子代理执行。
  - FEMORunner is driven exactly like main.py's server mode: _human_input_event
    is set so human nodes wait on wait_key channels instead of stdin.
  - parse_script writes debug_normalized_output.femo into the CWD; the host
    should launch the bridge with a workdir it is allowed to pollute.
"""

import sys
import os
import json
import shutil
import threading
import argparse
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request

# ── resolve the Femo project root ────────────────────────────────────────
def resolve_femo_root():
    root = os.environ.get("FEMO_ROOT", "")
    if root and os.path.isdir(root):
        return root
    return None

def ensure_default_data():
    """Insert Femo's default souls/users (idempotent) so actor_name resolution
    (get_soul) finds the built-in characters (Eve, littlecat, ...).
    init_database 先行（幂等建表）：--db 指向全新沙盒库时 souls 等表尚不存在
    （2026-09-15 mcp-smoke 沙盒隔离实测发现；femo_api 为模块全局——此前是
    main() 局部名，本函数必然 NameError，报错被 except 吞成一行 stderr）。"""
    try:
        femo_api.init_database()
        femo_api.seed_default_data()
    except Exception as exc:
        sys.stderr.write(f"femo_bridge: ensure_default_data failed: {exc}\n")


def settle_jobs(jm, workers, job_ids, *, log_tag='停场', host_of=None, host_filter=None):
    """停场收尾正身（2026-09-29 收编：daemon shutdown / daemon 闲时散场 /
    回滚壳 shutdown 三份同构循环合流——收编前散场路等 suspended 落盘、另两路
    只 join 不等账，正是「同样的逻辑写两份必然漂移」的实证）。

    逐场 runner.stop（取消链启动 → 取消路径 on_state_change 落 suspended——
    诚实挂起，断点保留），join 全部 worker（timeout=5），再等 suspended 落盘
    确认（stop→协程取消→on_state_change 是异步链，状态机单一来源=回调——
    回执/退进程之前必须确认账落了）。host_of+host_filter 同给时只停该宿主格
    的场（daemon shutdown 按 _caller_host 限定；散场/回滚壳不筛）。返回停掉的
    场次号列表。"""
    stopped = []
    for job_id in list(job_ids):
        try:
            if host_filter is not None and host_of is not None \
                    and host_of(job_id) != host_filter:
                continue
            runner = jm.runner_of(job_id)
            if runner is not None:
                runner.stop()
                stopped.append(int(job_id))
        except Exception as exc:
            sys.stderr.write('femo_bridge: %s job %s: %s\n' % (log_tag, job_id, exc))
    for t in list(workers.values()):
        t.join(timeout=5)
    if stopped:
        pending = stopped
        deadline = time.time() + 10
        while pending and time.time() < deadline:
            time.sleep(0.2)
            pending = [j for j in stopped
                       if jm.get_job_state(j).get('state') != 'suspended']
        if pending:
            sys.stderr.write('femo_bridge: %s等待落盘超时，仍未挂起：%s\n' % (log_tag, pending))
    return stopped


def dispatch_local_queries(cmd, req_id, args_obj, *, femo_api, femo_root,
                           jm, send_response):
    """七条本地命令的正身（2026-09-29 收编：装配段 dispatch_inner 与回滚壳
    dispatch_local 此前各抄一份逐字同构的处理器，连错误处理注释都一样——
    两份必漂的现行案例）。返回 True=已受理（调用方直接返回），False=不归
    本函数管。语义与收编前逐字节一致（check 的 base_dir 只补 None 不补空串、
    get_soul 未知角色回落、create_soul 的 ValueError 捕获都照旧）。"""
    if cmd == "ping":
        send_response(req_id, True, {"pong": True})
    elif cmd == "list_scripts":
        # 扫引擎自带 projects 目录 + 宿主用户目录（get_user_dir 可解析到
        # 别处）；扫描与去重实现在门面 femo_api.list_scripts。
        send_response(req_id, True, {"scripts": femo_api.list_scripts(femo_root)})
    elif cmd == "check":
        # 同步编译校验（femo-run 工具路径）：编译错误作为工具返回结果，
        # 带细节指导主模型改脚本；不启动运行、不产生状态。base_dir 空串=
        # 未保存的合法语义（引擎对相对路径报错），不能用 femo_root 回退——
        # 回退只补 None（未传）。
        femo_text = args_obj.get("femo", "")
        if not femo_text.strip():
            send_response(req_id, False, error="femo is empty")
            return True
        try:
            res = femo_api.compile_script(
                femo_text,
                base_dir=args_obj.get("base_dir") if args_obj.get("base_dir") is not None else femo_root,
                models=args_obj.get("models"))
            # warnings 随回执上浮（2026-09-07 warning 桶）：编译放行的提示
            # 交宿主转告作者/主模型——编译没被阻断，但应当知情。
            send_response(req_id, True, {"ok": True, "actions": res.action_count,
                                         "warnings": res.warnings})
        except Exception as exc:
            traceback.print_exc(file=sys.stderr)
            send_response(req_id, False, error=str(exc))
    elif cmd == "list_jobs":
        send_response(req_id, True, {"jobs": jm.list_jobs()})
    elif cmd == "get_soul":
        # 宿主查询单个角色（B4）：子代理 persona 注入用——宿主侧不再直读
        # SQLite，路径推导/表结构回归引擎内部。未知 soul → {'found': False,
        # 'description': ''}（宿主按「角色回落标准模式」降级，容错同旧语义）。
        soul_id = str(args_obj.get("soul_id", "") or "")
        if not soul_id:
            send_response(req_id, False, error="soul_id is required")
            return True
        soul = femo_api.get_soul(soul_id)
        if soul:
            send_response(req_id, True, {"found": True, **soul})
        else:
            send_response(req_id, True,
                          {"found": False, "soul_id": soul_id, "description": ""})
    elif cmd == "list_souls":
        # femo-soul list：返回全部角色（精简 id+名字，主模型写脚本挑角色用）。
        send_response(req_id, True, {"souls": femo_api.list_souls()})
    elif cmd == "create_soul":
        # 插件模式 soul 创建：user_id/created_by 固定为默认用户 u001（前端不再输入）。
        soul_id = str(args_obj.get("soul_id", "")).strip()
        soul_name = str(args_obj.get("soul_name", "")).strip()
        description = str(args_obj.get("description", ""))
        user_id = str(args_obj.get("user_id", "")).strip() or "u001"
        if not soul_id:
            send_response(req_id, False, error="soul_id is required")
            return True
        # 重号 ValueError（人话文案）由门面 create_soul 抛出——本地捕获，
        # 错误形态与旧 check-then-create 两段式逐字节一致，stderr 不留 traceback。
        try:
            femo_api.create_soul(soul_id, soul_name, description, user_id)
        except ValueError as exc:
            send_response(req_id, False, error=str(exc))
            return True
        send_response(req_id, True, {"soul_id": soul_id})
    else:
        return False
    return True


class BridgeStage:
    """搭台函数的返回面（第 2 步前置刀新增，纯挂载零行为）：装配段全部闭包
    态的集合——daemon（femo_daemon.py 第 2 步起）与测试据此进程内复用同一
    套装配，不必再起一座 stdio 桥。字段清单见 build_stage 尾部 return。"""

    def __init__(self, **fields):
        self.__dict__.update(fields)


def build_stage(args, femo_root, mailbox, mail_courier, projection_hub,
                push_url, emit, send_response, _trace, hub_connector=None,
                engine_mode=False, doorbell_of=None, doorbell_hosts=None,
                caller_host_of=None):
    """装配段搭台函数（2026-09-26 第 2 步前置刀：自下方 main() 纯搬移）。

    搬运纪律（施工清单 §五第 2 步前置刀）：函数体与原 main() 装配段逐字
    相同——仅整体剪切、原缩进层级不动，语义零变化；全量 pytest+真演出
    护航过后才有资格进下一刀。两处「顺序纪律」事故区（hub 接线段、
    set_owner_resolver 后置）注释原文保留并逐条自证（搬移后顺序关系原样
    不变，自证行已就地追加）。
    main() 只保留 stdio 运输层：fd1 行锁包装、协议出站口（emit/send_response）、
    stdin 循环——三者经参数注入（公共层守则 §五：接缝全部是注入式回调）。
    桥注入 fd 版；daemon 第 2 步注入 SSE 广播版；测试可注入收集器版。
    dispatch_inner/dispatch 随闭包世界整体入台：它们是装配态的最大消费者，
    且 daemon 的 HTTP /cmd/<cmd> 面按施工清单 §五复用同一命令信封（照抄不
    重新发明），命令面词汇=清单 §七三分类，一行不改。

    参数（只读，接缝契约）：
      args         argparse.Namespace（装配段读 args.host/args.host_name）
      femo_root    引擎项目根（run_compile 的 base_dir 兜底）
      mailbox/mail_courier/projection_hub
                   三兄弟件；import 失败时为 None，装配段内既有判空语义
                   原样生效
      push_url     投递员上门地址（''=自取模式）
      emit/send_response/_trace
                   协议出站口与观测（桥=fd 版；daemon=SSE 广播版）
      hub_connector 可选（增量A接缝 2026-09-26）：hub_connector(hub_name) ->
      (client, host_name)。缺省 None=现行行为（HubClient+connect 握手）；
      daemon 传进程内直连（HubClient.attach_local 挂本进程真身，绝不 connect
      ——daemon 探自己的 hub 会 HTTP 自环）。事件广播版 emit 见增量B。
      engine_mode 可选（增量B接缝 2026-09-26）：daemon 信柜管家/产信宿主语义
      开关。True=①出站轮询 all_hosts（常驻引擎一座养全场，回信无论寄到哪个
      宿主格都归它喂，认领纪律仍由 bound_job_ids 站岗）；②产信收件宿主按
      job 档案解析（_job_host）。False（缺省，桥）=两处均为现行行为，零变化。
      doorbell_of/doorbell_hosts 可选（增量C接缝 2026-09-26）：门铃注册表查询
      口——daemon 投递员按注册表上门（壳代登记各宿主的门），没登记=留柜自取；
      桥模式不注入，push_url（自家铃）原样。
      caller_host_of 可选（增量C接缝 2026-09-26）：调用方宿主格解析——壳转发
      信柜/归属命令时自带 _caller_host（壳的 --host）；桥模式不注入，调用方=
      桥自己（args.host），零变化。
    """
    # 增量A接缝（2026-09-26）：门面在此自绑定——daemon 进程内直接消费本函数
    # 时不经 main()，模块级 femo_api 名须自备；桥路径经 main() 的 global 绑定
    # 是同一模块对象，此处幂等，零行为变化。
    global femo_api
    from femo2host import femo_api

    # ── 宿主能力清单（A2.1 解耦）────────────────────────────────────────
    # harness 的词汇与环境（thinking 档位/默认用户）由接口侧清单文件提供，
    # 启动时应用一次；缺失/损坏回落引擎内置缺省（standalone 自圆满），
    # 绝不因清单问题炸启动。
    manifest_path = args.host_manifest or os.environ.get("FEMO_HOST_MANIFEST", "")
    if manifest_path:
        notes, manifest_err = femo_api.apply_host_manifest_file(manifest_path)
        if manifest_err is not None:
            print(f"[bridge] 宿主清单未应用：{manifest_err}（用引擎内置缺省词汇）")
        else:
            print("[bridge] 宿主清单已应用：" + ("；".join(notes) if notes else "（空清单，保持现状）"))
    else:
        print("[bridge] 未提供宿主清单（--host-manifest），引擎用内置缺省词汇")

    # ── Job 状态机（引擎侧唯一权威）────────────────────────────────────────
    jm = femo_api.get_job_manager()
    # 【2026-09-07 214 事故改造】启动扫全目录的 reconcile() 退役——它按
    # "不在我内存里=主人死了"把所有 running 档案判 crash，判定依据是本进程
    # 的 _bound，而 runs/ 目录是多进程共享资源（测试 bridge/第二个宿主都会
    # 踩进来），会把活进程的 Job 误杀（214 实锤）。对账改为懒式：挂在
    # get_job_state(reconcile_if_stale=true)（femoGen 打开 session 的唯一询问点，
    # 宿主只对 session 归属本宿主时才带此参数）与 job_resume 动手前，
    # 单档案、_bound 主人检查先行——见 JobManager.reconcile_stale。

    # job_id → worker 线程（shutdown join 用：取消传播+on_state_change 落盘是
    # 异步的，join 到位再 exit——关机也诚实落 suspended，§7.2 shutdown 修正）
    workers = {}
    runners = {}      # job_id → runner 活引用（mail_context 问引擎取剧情状态；结束即清）

    # ── 投影中心（2026-09-19 接线）：hub 住桥进程，端口 env FEMO_PROJECTION_PORT
    # （缺省 8790）。三个咽喉喂行——引擎事件（make_event_callback）、角色交卷
    # （post_speech）、人类交卷（human_input）——分诊表=projection_hub.
    # EventProjector（gateway_ui.py 预演转正，形态 B 切片）。喂送 best-effort：
    # 幕布任何问题只记 stderr，绝不挡运行（产信同款纪律）。AI 角色的逐字流帧
    # 不过桥（模型调用在宿主进程），打字机效果属宿主喂，第二步另接。
    # 【hub 唯一化 2026-09-25】hub 不再无条件自起：HubClient 先探本数据根
    # hub.json 指向的 hub——活着=复用（不自起、不覆写地址簿，喂送与登记全走
    # HTTP），死/无=自起（现行行为零变化）。HubClient local/remote 两态同名
    # 方法，本段之后的全部 hub.xxx 调用（_hub_feed/_hub_cast/_hub_owner……）
    # 两种模式一字不改。设计稿=docs/ActiveRoadmaps/hub唯一化设计.md。
    hub = None
    host_name = ''
    # 投递事实（2026-09-25 多宿主）：(job_id, soul) -> 实际投递的宿主格。
    # 产信时记录，投影行/段键据此取角色归属宿主（mailbox 事实源，作者裁决）。
    dispatch_facts = {}
    if projection_hub is not None:
        try:
            hub_name = ''
            try:
                # 宿主自称（清单的 host 字段，'dsh'/'zcode'…）——投影中心的来源标签
                hub_name = str(femo_api.host_name() or '')
            except Exception:  # noqa: BLE001 — 老门面没有这个面就当没名字
                hub_name = ''
            # 多实例自称（2026-09-24）：宿主拉桥显式传 dsh-<port>，投影来源标签/
            # 段键/名册随之按实例分家（与信箱 --host 同值不同面）。
            if getattr(args, 'host_name', None):
                hub_name = str(args.host_name)
            # ⚠️ 顺序纪律：本段任何一步炸了都会被 except 一把吞掉 → hub 静默不
            # 启动（2026-09-19 实锤：set_owner_resolver 写在 _hub_owner 定义之前，
            # NameError 被吞，8790 拒绝连接而桥进程活着）。每一步都必须自证成功
            # 才往下走；connect() 内部同守此纪律——复用链路每步失败大声 stderr，
            # 绝不静默回退。
            # 【搭台搬移自证 2026-09-26】本段随装配段整体入 build_stage，段内
            # 顺序未重排：HubClient() → connect() → 旁路/EventProjector/各注入
            # 依次执行，except 兜底与「逐步自证」语义原样——事故不因搬移复活。
            if hub_connector is not None:
                # 【增量A接缝 2026-09-26】daemon 进程内直连：hub 已在本进程肚里，
                # 连接器挂真身（HubClient.attach_local），绝不走 connect() 探活/
                # 代拉——daemon 探自己的 hub 会复用自己=HTTP 自环（皱褶③）。
                # 顺序纪律不变：本分支仍是装配段 hub 链的第一步，后续注入次序原样。
                hub, host_name = hub_connector(hub_name)
            else:
                hub = projection_hub.HubClient()
                host_name = hub.connect(hub_name)
            # print 旁路（2026-09-19「加一路显示」）：桥进程 stdout/stderr
            # 旁观镜像进 hub（环形缓冲 + 投影页右上角调试浮层）。原管道分毫不动
            # ——femogen『编译器』页（宿主读 OS 管道）照旧。
            # 【第1步 常驻化 2026-09-26】hub 已常驻化（桥恒复用模式），旁路改走
            # HTTP 投递（POST /prints）——浮层升级常驻必有：每座桥的 print 都
            # 进浮层，不再只有养桥有。
            projection_hub.install_stdio_print_bypass(hub.print_sink())
            projector = projection_hub.EventProjector()
            # 把同一个宿主自称交给 projector：它内部造的段键（w:<host>:<wait_key>）必须与
            # hub 入口 _seg_ref 的归一结果**逐字一致**，否则同一条引擎轮会开出两个孪生段
            # ——桥这边裸键、宿主喂 draft 那边带 host，逐字流永远挂不上容器（job 1927
            # 实锤：journal 段键无 host、drafts 段键有 host，零匹配、页面整槽才出现）。
            projector.set_host(host_name)
            # 投递事实查询口：段键/标注按「料包实际寄给的宿主格」取归属（mailbox 事实源）。
            projector.set_dispatch_lookup(lambda j, so: dispatch_facts.get((j, so)))
            # 人类等待镜像接线（2026-09-20 投影页人类输入）：human_wait/human_done/
            # flow_* 三拍推 hub——ctrl:waiting 广播 + 快照捎带 + POST /api/human-input
            # 的校验面。驿站模块一并注入（hub 不 import 兄弟件，依赖倒置）；
            # 复用模式下这三笔注入在 HubClient 里是记录在案的无操作（寄信走共享
            # 信柜，远端 hub 用养桥注入的那一半）。
            projector.set_waiting_sink(hub.set_waiting)
            hub.set_mailbox(mailbox)
            # 信箱宿主 id（2026-09-24 多实例并存）：hub 寄人类信的 target_host
            # 必须与本桥 drain_outgoing 的过滤词同源（args.host）——以前 hub 拿
            # 的是投影自称（FEMO_HOST_NAME），两实例并存时同词互抢，台词信会被
            # 对方桥捞走销账（job_not_active 静默卡死根因）。
            # （2026-09-25 hub 唯一化后寄信优先级再反转：等待态自带 host 优先、
            # 这里的注入降为兜底——见 projection_hub.human_input。）
            hub.set_mailbox_host(args.host)
            # 横幅走 stdout（信息非错误）：面板把 stderr 标红，启动横幅顶着
            # 红色像报错（2026-09-21 用户实锤）；此时 stdio 旁路已装好（自起
            # 模式），会以 stdout 名义进镜像环。on=自起、reuse=复用别家的 hub。
            sys.stdout.write(
                f"femo_bridge: projection hub {'on' if hub.local else 'reuse'}"
                f" http://127.0.0.1:{hub.port}/"
                f" (host={host_name or '?'})\n")
            sys.stdout.flush()
        except Exception as exc:
            hub = None
            projector = None
            sys.stderr.write(f"femo_bridge: projection hub unavailable: {exc}\n")

    def _hub_feed(job_id, rows):
        if hub is None or not rows:
            return
        try:
            if not hub.has_owner(job_id):   # 懒登记：有行流入的场次一律补齐主会话
                _hub_owner(job_id)          # （老档案续跑、错过 flow_start 也不漏）
            frames = []
            for r in rows:
                if not isinstance(r, dict):
                    continue
                if isinstance(r.get('op'), str):
                    frames.append(r)                    # 操作帧（seg-open/fill…）：原样透传
                else:
                    frames.append({'op': 'row', **r})   # 普通行
            hub.feed(job_id, frames, source=host_name)   # 来源标签：整批归本宿主
        except Exception as exc:
            sys.stderr.write(f"femo_bridge: hub feed failed: {exc}\n")

    def _hub_cast(job_id, payload):
        """启动运行花名册（FEMO脚本 actors 定义区）进 hub：/views 启动运行即有全部角色。
        随后照抄引擎「演员显示名双名制」（FEMO_runtime.py 拍板定稿逻辑）预登记
        显示名：有 soul → '@角色名（soul_name）'；无 soul 的人类席位 →
        '@角色名（user_name）'（FEMO脚本 owner 的用户名，缺省回落宿主清单默认用户）。
        ——菜单启动运行即全带括号，不用等各角色首次派工（2026-09-19 用户需求）。"""
        if hub is None:
            return
        try:
            hub.set_cast(job_id, payload.get('actors'))
        except Exception as exc:
            sys.stderr.write(f"femo_bridge: hub cast failed: {exc}\n")
        try:
            runner = runners.get(job_id)
            script = getattr(runner, 'script', None) if runner is not None else None
            actors_def = getattr(script, 'actors', None)
            if not isinstance(actors_def, dict) or not actors_def:
                return
            owners = (getattr(script, 'meta', {}) or {}).get('owner', []) or []
            user_name = ''
            for uid in owners:
                user_name = femo_api.get_user_name(str(uid))
                if user_name:
                    break
            if not user_name:
                user_name = femo_api.get_user_name(femo_api.default_user_id())
            for ref, adef in actors_def.items():
                try:
                    nm = str(getattr(adef, 'name', '') or ref)
                    if not nm:
                        continue
                    role = nm if nm.startswith('@') else f'@{nm}'
                    soul = str(getattr(adef, 'soul', '') or '').strip()
                    src = str(getattr(adef, 'source', '') or '').strip()
                    if soul:
                        soul_display = femo_api.get_soul_name(soul)
                        if not soul_display and soul == 'main':
                            soul_display = 'main'   # source:main 裸天使伪 soul（引擎同款）
                        if soul_display:
                            hub.remember_display(job_id, f'{role}（{soul_display}）')
                    elif user_name and src != 'main':
                        # 人类席位（无 soul）→ user name；source:main 伪 soul
                        # 由引擎 actor_name 显示 'main'，此处不得覆盖。
                        hub.remember_display(job_id, f'{role}（{user_name}）')
                except Exception:
                    continue
        except Exception as exc:
            sys.stderr.write(f"femo_bridge: hub display-name failed: {exc}\n")

    def _hub_display(job_id, payload):
        """带括号显示名进 hub（ai_request 现场）：菜单派工瞬间即长出括号。
        执行者名 = 引擎事件里的 actor_name（2026-09-19 由 ai_name 正名而来，旧名已删）。
        角色↔soul 映射同拍登记（2026-10-06）：actor_info.soul 是引擎解析剧本
        actors 区的唯一出口——hub 视角菜单的宿主标签经它换算本场选角账定格
        的宿主（「soul 实际绑在哪个 host 就显示哪个」）；解析权在引擎，桥只
        捎带，不另起第二份剧本解析。"""
        if hub is None:
            return
        try:
            info = payload.get('actor_info') or {}
            soul = str(info.get('soul') or '').strip() or None
            hub.remember_display(job_id, payload.get('actor_name'), soul=soul)
        except Exception as exc:
            sys.stderr.write(f"femo_bridge: hub display failed: {exc}\n")

    def _norm_host_refs(args_obj):
        """归属账参数归一（2026-09-21 账本多宿主化）：新宿主传 host_refs
        字典（{host名: 会话标识}，str→str，空值过滤）；缺省回退旧协议
        host_ref/owner_tag 单值字符串 → 包装 {本桥host名: 字符串}（老宿主/
        内嵌直调零改动）。两边都没有 → {}。"""
        raw = args_obj.get("host_refs")
        if isinstance(raw, dict):
            return {str(k).strip(): str(v) for k, v in raw.items()
                    if str(k).strip() and str(v)}
        legacy = str(args_obj.get("host_ref", args_obj.get("owner_tag", "")) or "")
        # 【2026-09-26 修信使】键用信箱 id（args.host，host_refs 字典键的契约词
        # =桥 --host 标签，见 zcode femo-server「host_refs 字典键=桥 --host 标签」），
        # 不用投影自称 host_name——无清单启动时投影自称是 'standalone'，而
        # post_speech 反推收件人读的正是这本账：回信全寄去 'standalone'，轮询
        # 在 'dsh' 上等空，speech 闭环整个死锁（test_bridge_speech 实锤）。
        # 产线两词同值（dsh-3081/zcode），零变化。
        # 【增量C】包装键=调用方宿主格（壳转发自带 _caller_host；桥=自己）。
        return {str(_caller_host(args_obj)): legacy} if legacy else {}

    def _hub_owner(job_id):
        """本场主会话登记（2026-09-19 用户拍板：只投影当前 Job 所在的那个 Session）。
        host_ref 是宿主塞进来的会话标识（job 档案里存着、引擎不懂）——hub 拿它把
        别的 dsh 会话喂来的FEMO外行（src_seq=main:<sid>:…）挡在账本外：HTML 投什么
        全看 hub 落什么账，所以过滤就该落在 hub 这一端。取不到（老档案/裸跑）
        就不登记，hub 退回不过滤的老行为，绝不误杀本次内容。

        也充当 hub 的「信任来源解析器」（多宿主联机）：别的宿主第一次喂行进来，
        hub 会回调到这里——多宿主共演同一次时各自 host_ref 都要进信任集，缺一台
        就会把那台的FEMO外行当"别人的会话"丢掉。登记按 host 分格（见 hub.set_owner）。

        【全量登记·2026-09-21 账本多宿主化】归属权威已迁 host_refs 字典
        （{host: sid} 一格一宿主）：遍历字典逐格登记——任何一台桥的 resolver
        被触发都登记完整信任集（幂等；联机共演两台各自进自己格）。字典空
        （老档案）回退现行单值路径：host_ref 记到本桥 host 名下。"""
        if hub is None:
            return
        try:
            rec = jm.get_job_state(job_id) or {}
            refs = rec.get('host_refs')
            if isinstance(refs, dict) and refs:
                for h, sid in refs.items():
                    if str(h) and str(sid):
                        hub.set_owner(job_id, str(sid), host=str(h))
                return
            owner = str(rec.get('host_ref') or '')
            if owner:
                hub.set_owner(job_id, owner, host=host_name)
        except Exception as exc:
            sys.stderr.write(f"femo_bridge: hub owner failed: {exc}\n")

    # 注入「信任来源解析器」（多宿主联机）：别的宿主第一次喂行进来，hub 会回调到
    # _hub_owner 去 job 档案取它的 host_ref 登记进信任集——缺这一手，那台的FEMO外行
    # 会在 hub 的 feed 期被当"别人的会话"丢弃（2026-09-19 联机改造）。
    # ⚠️ 必须在 _hub_owner（以及 host_name）定义**之后**注入：写成前置会 NameError，
    # 且会被上面那段的 except 吞掉 → hub 静默不启动、8790 拒绝连接（已实锤一次）。
    # 【搭台搬移自证 2026-09-26】_hub_owner 定义在前、本注入在后的顺序在
    # build_stage 内原样保持——「定义后置注入」约束逐字成立，病根不复发。
    if hub is not None:
        hub.set_owner_resolver(_hub_owner)

    # ── per-job 事件包装与信封（§7.3）──────────────────────────────────────
    # job_id → flow_done 事件 payload 暂存。终局信（跑完）延迟到 bridge_run_ended
    # 才产（2026-09-16 system_push 落地，时机规则升公共）：flow_done 时刻引擎逻辑
    # 刚完、角色 settled 通知还在飞，此刻产信会随过早的喊话被空轮吃掉（Job 761
    # 实证）；run() 返回（bridge_run_ended）才是引擎与角色全部收工点。暂停/取消
    # 路径 flow_done 从未发生（无记录即不产信，暂停信由 flow_paused 事件承担）。
    final_payloads = {}

    def _deliver_url(target):
        """投递上门地址（增量C 门铃接缝）：桥模式恒 push_url（自家铃，现状
        零变化）；daemon 模式查门铃注册表（壳代登记的宿主门），没登记/过期
        =空=留柜自取（清单§五：没门铃的目标留柜自取）。"""
        if push_url:
            return push_url
        if doorbell_of is not None:
            try:
                return str(doorbell_of(target) or '')
            except Exception:
                return ''
        return ''

    def _who_move(target):
        """投递动词（增量C）：能送到（桥自家铃 / daemon 门铃注册表有门）=
        system_push；没门=customer_hook（留柜自取）。桥模式逐点等价现行为
        （push_url 非空恒 system_push；空且无注册表恒 customer_hook）。"""
        return 'system_push' if _deliver_url(target) else 'customer_hook'

    def _caller_host(args_obj):
        """调用方宿主格（增量C）：壳转发命令时在 args 自带 _caller_host（壳的
        --host）——信柜命令记账/归属账包装用调用方的格，不是 daemon 占位自称。
        桥模式（无注入）恒等 args.host：桥即调用方，零变化。"""
        if caller_host_of is not None:
            try:
                h = caller_host_of(args_obj)
            except Exception:
                h = None
            if h:
                return str(h)
        return args.host

    def _job_host(job_id):
        """本场收件宿主（第2步增量B 产信宿主语义，皱褶清单①的落地件）：
        daemon 不是宿主，产信收件人不许拿进程自称顶——收件宿主=job 档案里
        「最新发起方」（host_ref 单值语义不动）在 host_refs 字典中的键（与
        post_speech 跨宿主回信的查法同款）。桥模式（engine_mode=False）恒返
        args.host：桥只跑自家场，档案解析与现行为逐一同值，零变化；解析失败
        （裸跑/旧档案无账）同样回落 args.host。"""
        if not engine_mode:
            return args.host
        try:
            rec = jm.get_job_state(job_id) or {}
            ref = str(rec.get('host_ref') or '')
            refs = rec.get('host_refs') if isinstance(rec.get('host_refs'), dict) else {}
            if ref:
                for _h, _v in refs.items():
                    if str(_h) and str(_v) == ref:
                        return str(_h)
        except Exception:
            pass
        return args.host

    def _director_sid(job_id):
        """导演会话号（刀2 双词寻址的产信数据源）：本场档案 host_refs 里收件
        宿主格的会话标识（host_refs 键=信箱 id，2026-09-26 修信使后恒同源；
        【增量B】「本宿主格」改按 _job_host 解析——daemon 产信贴收件宿主的号，
        桥模式恒等本宿主格零变化）；旧档案无字典时回落单值 host_ref。
        取不到（裸跑）返回 None=信不带号。"""
        try:
            rec = jm.get_job_state(job_id) or {}
            refs = rec.get('host_refs') if isinstance(rec.get('host_refs'), dict) else {}
            sid = str(refs.get(_job_host(job_id)) or '') or str(rec.get('host_ref') or '')
            return sid or None
        except Exception:
            return None

    def _mailbox_post(job_id, event_type, d, resumed=False):
        """信件生产（驿站八维信封 2026-09-15 定稿）：kind 三型 context/speech/notice。
        - 终局 → soul=main, kind=notice, 急件：flow_error/flow_paused 在事件现场产；
          flow_done 暂存、bridge_run_ended 才产（见 final_payloads 注释）；
        - 知情警告（notify_author warning/agent_error）→ soul=main, kind=notice,
          滞留件（结束信进箱才放行）；ai_retry 路由已拔管（2026-09-23 十连裁④：
          其知情由 notify_author 并行信承担，原先审稿失败双信）；
        - ai_request → soul=该角色(source:main 则 main), kind=context, ref=wait_key, 急件。
        投递（2026-09-16 system_push 上门落地，先投后发事件防竞态）：
        - main 的料包信 → 投递员单封直推宿主接收口（面单 brief 附结构化字段：
          node_name/actor_name/wait_key/blocks/scope_info——宿主拼词参与用）；
        - 终局急件 → 投递员 withdraw 整包（急件+同 Job 放行滞留件）直推，
          extra 带 outcome/detail；
        - 角色料包信：无铃铛时留柜 pending（重投/两阶段自取），不记账。
        - 滞留件（警告/编译警告）：不上门——压柜随终局整包走（delivery=held
          的语义就是攒到停下时刻）。
        投递失败零动作（信留柜 pending，宿主事件现场兜底 collect 拉到）。
        subkind 随信说明书：'error'=节点错误/超限、'warning'=知情类。
        产信失败只记 stderr，不挡运行。"""
        if mailbox is None:
            return
        try:
            if event_type == 'flow_done':
                final_payloads[job_id] = d
            elif event_type in ('flow_error', 'flow_paused'):
                error_text = str(d.get('error', 'unknown error'))
                text = {'flow_error': f"FEMO 运行出错：{error_text}",
                        # 2026-10-01 起挂起也常带错误全文（一切 error 挂起可续）
                        'flow_paused': 'FEMO 已暂停（断点保留，可续跑）'
                                       + (f'：{error_text}' if error_text else '')}[event_type]
                mailbox.post(job_id=job_id, soul='main', kind='notice',
                             payload=text, action='receive',
                             delivery='urgent',
                             who_move=_who_move(_job_host(job_id)),
                             who_require='system_require',
                             target_host=_job_host(job_id),
                             target_sid=_director_sid(job_id))
                _url = _deliver_url(_job_host(job_id))
                if _url and mail_courier:
                    mail_courier.deliver_pack(
                        _url, _job_host(job_id), job_id,
                        extra={'outcome': 'failed' if event_type == 'flow_error' else 'paused',
                               'detail': error_text})
            elif event_type == 'human_wait':
                # 人类节点收信（2026-09-17 对齐 AI 节点/主模型）：轮到人类
                # =compiler 索回信，同一封 context 信按 soul 投递员上门；呈现
                # （投影窗显示而非 steer 子代理）是宿主收信后的事。面单=整个
                # 事件 payload（wait_key/prompt/scope/context 全带）。仅「能送到」
                # 才产信（桥=自家铃；daemon=门铃注册表有本宿主的门；都没有
                # =zcode 无人类信收件方，免得无主信压柜）；投递失败信留柜，
                # 事件现场兜底（先投后发互斥）。
                _hw_url = _deliver_url(_job_host(job_id))
                if _hw_url and mail_courier:
                    scope = d.get('scope') if isinstance(d.get('scope'), list) else []
                    soul = str(scope[0]) if scope else 'human'
                    letter = mailbox.post(
                        job_id=job_id, soul=soul, kind='context',
                        payload=str(d.get('prompt', '') or ''),
                        action='receive', delivery='urgent',
                        who_move=_who_move(_job_host(job_id)),
                        who_require='system_require',
                        target_host=_job_host(job_id), target_sid=_director_sid(job_id),
                        node=d.get('node_name'),
                        ref=str(d.get('wait_key') or ''),
                        push_extra={'brief': dict(d)})
                    # 面单随信入库（2026-09-24）：deliver 缺省读信上 push_extra，
                    # 首投与重投同形（旧版裸信重投=宿主丢弃却记送达）。
                    mail_courier.deliver(_hw_url, [letter])
            elif event_type == 'flow_start':
                # 启动运行/续跑信（2026-09-23 十连裁④）：画布点启动运行、断点续跑时 main
                # 未必知情（只有 main 自己调 femo_run 那条路天然知情）——flow_start
                # 现场产信给 main，urgent 单封直推 steer。续跑同样重发 flow_start，
                # resumed 由 make_event_callback 注入，措辞据此分岔；subkind=
                # play_start 供宿主收件口识别。仅「能送到」才产信（桥=自家铃；
                # daemon=门铃注册表有本宿主的门；都没有=无收件口产信=无主信
                # 压柜，human_wait 同款纪律；降级模式 main 靠 femo_run 回执本来
                # 知情）。
                _fs_url = _deliver_url(_job_host(job_id))
                if _fs_url and mail_courier:
                    name = str(d.get('name', '') or '')
                    show = f"《{name}》" if name else 'FEMO脚本'
                    text = (f"{show}继续运行（从断点恢复）。" if resumed
                            else f"{show}启动运行。")
                    letter = mailbox.post(
                        job_id=job_id, soul='main', kind='notice', payload=text,
                        action='receive', delivery='urgent',
                        who_move=_who_move(_job_host(job_id)),
                        who_require='system_require', target_host=_job_host(job_id),
                        target_sid=_director_sid(job_id),
                        subkind='play_start')
                    mail_courier.deliver(_fs_url, [letter])
            elif event_type == 'node_retry':
                # 重试牌信化（2026-09-23 十连裁③）：feedback 是点对点内容，改寄
                # 驿站（urgent 单封直推），宿主收件口按 wait_key 交停靠经纪人——
                # 租约保留超时/中止职能，只换传话通道；事件照发（retry 槽显示归
                # 桥 EventProjector），宿主事件侧不再消费（单通道无兜底双路）。
                # 【2026-09-25 入柜闸拆除】入柜无条件（料包同款——拉取宿主 zcode
                # 没有收件口，靠会话到站取信把牌带给角色，重演才有通路；不入柜=
                # 反馈整条丢失，引擎 3600s 静默跳过）；上门仍仅限挂铃铛宿主。
                retry = {
                    'wait_key': str(d.get('wait_key', '') or ''),
                    'feedback': str(d.get('feedback', '') or ''),
                    'attempt': d.get('attempt'),
                    'actor_name': str(d.get('actor_name', '') or ''),
                }
                to = retry['actor_name'] or 'main'
                letter = mailbox.post(
                    job_id=job_id, soul=to, kind='notice', payload=retry['feedback'],
                    action='receive', delivery='urgent',
                    who_move=_who_move(_job_host(job_id)),
                    who_require='system_require', target_host=_job_host(job_id),
                    target_sid=_director_sid(job_id) if to == 'main' else None,
                    node=d.get('node_name'), ref=retry['wait_key'] or None,
                    subkind='node_retry', push_extra={'retry': retry})
                _url = _deliver_url(letter.get('target_host'))
                if _url and mail_courier:
                    # 面单随信入库（2026-09-24）：重投同形。
                    mail_courier.deliver(_url, [letter])
            elif event_type == 'ai_request':
                blocks = d.get('blocks') if isinstance(d.get('blocks'), dict) else {}
                info = blocks.get('_actor_info') if isinstance(blocks.get('_actor_info'), dict) else {}
                # 【2026-09-25 resume 缺口】resume 重发的 ai_request 的
                # blocks._actor_info.soul_id 可为空（实测），顶层 actor_info.soul
                # 却恒有——收件口（soulIdentityOf）读的就是顶层。两处同源，挑角色
                # 账才查得中。所以顶层优先、料包内层兜底。
                top_info = d.get('actor_info') if isinstance(d.get('actor_info'), dict) else {}
                if str(d.get('source', '')) == 'main':
                    to = 'main'
                else:
                    to = (top_info.get('soul') or info.get('soul_id')
                          or d.get('actor_name') or d.get('actor_name') or 'unknown')
                # 【多宿主派工 2026-09-25】产信前查绑定账：该 soul 绑定在外宿主
                # → 信寄外宿主格、强制留柜（不直推——直推本宿主收件口即回执
                # 消费，跨宿主方将永远取不到信，job 2564 实测信蒸发）。外宿主方
                # 按自取语义取件（zcode 钩子 mail-context / 终端席 receive）。
                # 查账失败按本宿主处理（保守=现状行为）。
                target = _job_host(job_id)
                target_sid = _director_sid(job_id) if to == 'main' else None
                entry = {}
                foreign_pickup = False
                if hub is not None and to != 'main':
                    try:
                        _cast_seen = hub.cast_job(job_id).get('cast') or {}
                        entry = _cast_seen.get(to) or {}
                        sys.stderr.write(f"femo_bridge[trace]: cast probe job={job_id} to={to} seen={sorted(_cast_seen.keys())} entry_host={entry.get('host')}\n")
                        bound_host = str(entry.get('host') or '')
                        # 【刀2 双词】角色信的会话号=选角账座位的 sid（信寄到哪格，
                        # 就贴哪格的会话号——自取户按号对领）
                        target_sid = str(entry.get('sid') or '') or None
                        # 「别家顾客」的基准=本场收件宿主（_job_host，查本场档案），
                        # 不是进程自称：2026-09-26 实锤，常驻引擎进程自称 'daemon'，
                        # 拿它比会把本场自家绑定也判成外宿主——信被强制留柜，投递员
                        # 5s 后照门铃重投，每个 AI 节点料包上门两遍（job 2597~2599）。
                        # 桥模式 _job_host 恒等 args.host，本行为零变化。
                        if bound_host and bound_host != target:
                            target = bound_host
                            foreign_pickup = True
                    except Exception as cast_exc:
                        sys.stderr.write(f"femo_bridge: cast lookup failed: {cast_exc}\n")
                parts = [f"【{label}】{blocks.get(key, '')}".rstrip()
                         for label, key in (('上下文', 'context'), ('记忆', 'memory'), ('提示', 'prompt'))
                         if blocks.get(key)]
                letter = mailbox.post(job_id=job_id, soul=to, kind='context',
                                      payload='\n'.join(parts) or '(空料包)',
                                      action='receive', delivery='urgent',
                                      who_move=('customer_hook' if foreign_pickup
                                                else _who_move(target)),
                                      who_require='system_require',
                                      target_host=target,
                                      target_sid=target_sid,
                                      node=d.get('node_name'),
                                      ref=str(d.get('wait_key') or ''),
                                      # 面单随信入库（2026-09-24）：首投与重投
                                      # 同形，宿主不再收裸信。
                                      push_extra=(
                                          {'brief': {k: d.get(k) for k in
                                                     ('node_name', 'actor_name', 'wait_key', 'blocks',
                                                      'scope_info', 'source')}}
                                          if to == 'main' else {'brief': dict(d)}))
                dispatch_facts[(job_id, to)] = target
                if foreign_pickup:
                    sys.stderr.write(
                        f"femo_bridge: letter for '{to}' stays in mailbox (bound host={target}, self-pickup)\n")
                else:
                    _url = _deliver_url(letter.get('target_host'))
                    if _url and mail_courier:
                        # 单封直推（main/角色同一出口，面单 deliver 自信上读）。
                        mail_courier.deliver(_url, [letter])
            elif event_type == 'notify_author':
                # 非致命知情类（2026-09-16 补产信——原先只进 dsh 私有警告桶，
                # 驿站账本缺这类信，主模型在 zcode 的停下打包里收不到它们）：
                # severity=warning（编译/运行知情）/agent_error（节点报错即通知）/
                # agent_giveup（执行体最终失败挂起）→ 滞留件，随本 Job 终局急件
                # 一起放行打包。fatal 不产信：引擎 dispatch FATAL 后必 raise →
                # flow_error 急件承担投递（防双份，与 dsh 宿主口径一致）。
                severity = str(d.get('severity', ''))
                message = str(d.get('message', ''))
                if severity == 'fatal' or not message.strip():
                    return
                if severity == 'agent_error':
                    payload = f"节点错误：{message}"
                else:
                    payload = message   # agent_giveup 引擎原话自描述；warning 原话知情类
                mailbox.post(
                    job_id=job_id, soul='main', kind='notice',
                    payload=payload, action='receive', delivery='held',
                    who_move=_who_move(_job_host(job_id)), who_require='system_require',
                    target_host=_job_host(job_id), target_sid=_director_sid(job_id),
                    node=d.get('node_name'),
                    subkind='error' if severity == 'agent_error' else 'warning')
        except Exception as exc:
            sys.stderr.write(f"femo_bridge: mailbox post failed: {exc}\n")

    def _post_compile_warnings(job_id, warnings):
        """编译警告产信（2026-09-16 猫猫拍板「停下时刻必带 warning+error」）：
        编译警告原先只是 job_start/job_resume 响应字段——用户按钮启动运行/续跑时
        主模型零感知。现补成滞留件（subkind=warning），随本 Job 的终局急件一起
        放行打包送达（dsh 代取/zcode 到站取，同一条信）。warnings 元素
        {where?, message}（femo_api 编译警告桶）；产信失败只记 stderr，不挡启动运行。
        【事件流同拍产信（2026-10-05 画布直连刀1.5）】同一批警告向事件通道多发
        一条 compile_warnings（{job_id, warnings}，形状照 dsh 宿主原来的合成
        广播帧）——画布改直连引擎后宿主合成够不着它，编译器警告自此单源在
        引擎；dsh run-control 的两处合成广播随刀退役（观察期）。"""
        clean = []
        if isinstance(warnings, list):
            for w in warnings:
                if isinstance(w, dict) and str(w.get('message', '')).strip():
                    entry = {'message': str(w.get('message', '')).strip()}
                    if str(w.get('where', '') or ''):
                        entry['where'] = str(w.get('where'))
                    clean.append(entry)
        if clean:
            try:
                emit({'type': 'event', 'event': 'compile_warnings',
                      'data': {'job_id': job_id, 'warnings': clean}})
            except Exception as exc:
                sys.stderr.write(f"femo_bridge: compile_warnings emit failed: {exc}\n")
        if mailbox is None or not clean:
            return
        # 身份契约（A4）：送货上门与否看门（桥自家铃/daemon 门铃注册表）
        who_move = _who_move(_job_host(job_id))
        for w in clean:
            where = str(w.get('where', '') or '')
            try:
                mailbox.post(
                    job_id=job_id, soul='main', kind='notice',
                    payload=(f"编译警告（{where}）：{w['message']}" if where
                             else f"编译警告：{w['message']}"),
                    action='receive', delivery='held', who_move=who_move,
                    who_require='system_require', target_host=_job_host(job_id),
                    node=where or None, subkind='warning')
            except Exception as exc:
                sys.stderr.write(f"femo_bridge: mailbox post failed: {exc}\n")

    def _post_final_done(job_id, d):
        """跑完急件产信（bridge_run_ended 现场专用——payload 来自 flow_done
        事件的暂存，summary 保留）。时机即规则：此刻引擎与全部角色收工，不再有
        settled 通知开的空轮吃信（Job 761）。产信后投递员整包直推（终局急件+
        同 Job 放行滞留件，outcome=finished）——先投后发事件，宿主收到
        bridge_run_ended 时 push 已办结（成功=已喊，失败=信压柜待兜底拉）。"""
        if mailbox is None:
            return
        text = '✅ FEMO 已跑完'
        if d.get('summary'):
            text += f"：{d['summary']}"
        try:
            mailbox.post(job_id=job_id, soul='main', kind='notice',
                         payload=text, action='receive',
                         delivery='urgent',
                         who_move=_who_move(_job_host(job_id)),
                         who_require='system_require',
                         target_host=_job_host(job_id))
            _url = _deliver_url(_job_host(job_id))
            if _url and mail_courier:
                mail_courier.deliver_pack(_url, _job_host(job_id), job_id,
                                          extra={'outcome': 'finished'})
        except Exception as exc:
            sys.stderr.write(f"femo_bridge: mailbox post failed: {exc}\n")

    def _mailbox_poll_forever():
        """节点发言第二阶段（发信→远端投递）：轮询驿站寄件出站口，把客户的
        speech 信按 ref（凭据号）喂给引擎（deliver_human_input 自带活跃+_bound
        校验，不盲投），台词入台账后清账；喂不进的立死信终态留档并记 stderr
        （引擎侧有自己的重试与超时裁决，坏账不回炉）。
        信的 body 附属（宿主交卷体完整字典 {steps, model_id?}——**末步 reply=
        台词**，或 {chat_text, variables}）原样上桌；引擎交接面要的 output 由本桥
        按 last_step_reply 派生注入（2026-09-27 output 字段退役，引擎零感知）；
        手写信（CLI send 只填 payload）回落合成单步——两宿主与手写信同一出站口。
        【出站认领纪律（2026-09-26 引擎常驻化刀0）】只捞本桥挂靠场次的信
        （femo_api.bound_job_ids）——多宿主并存共用同一信箱，不养这场戏的桥
        在结构上就捞不到别家的回信（job 2585 实锤：野桥捞走销账、引擎空等）。
        【幕布投影收口（2026-09-20 立法，2026-09-26 刀0 兑现）】引擎真吃了才
        投影（on_post_speech 出段收尾行）——本路径是**唯一**投影点：dsh 投影
        窗/投影页人类席/主Agent/角色交卷全走驿站，CLI 手写信从此也上墙；受理
        （post_speech 回执）不投影，喂不进的死信不在墙上留鬼行（job 2585 实锤：
        旧代码投影在喂入结果判断之外，拒收台词上墙冒充真台词）。"""
        import time as _time

        # 【2026-09-24 抢信验尸日志（用户令「先多加点 log」）】纯观测、零行为变更。
        # 写文件不走 stdout 管道——管道会吞行（deliver ✗ 失败行从未在 diag 出现过，
        # 疑似与协议帧并发写时被宿主解析器丢弃）。双桥同 inbox 时（3081/3083 并存、
        # 共用 user_data 信箱），凭 pid 一眼看出信被谁捞走、谁投喂失败。
        def _poll_log(msg):
            try:
                import os as _os
                with open(_os.path.join(_os.environ.get('FEMO_DATA_DIR') or 'user_data', 'debug-mailbox-poll.log'), 'a', encoding='utf-8') as _f:
                    _f.write(f"{_time.strftime('%Y-%m-%d %H:%M:%S')} pid={_os.getpid()} {msg}\n")
            except Exception:
                pass

        _retry_tick = 0
        # 出站投递瞬时错误的重投上限（2026-10-07，j2717 文件锁吞信事故）：
        # OSError 族（文件被占/Permission denied——同步盘/杀毒/索引器扫过
        # user_data 的一瞬）按「下一秒就自愈」对待，退回信柜退避重投；
        # 到顶才记死信。非 OSError（真 bug）维持一步死信响亮留痕。
        _HANDIN_RETRY_MAX = 8
        while True:
            _time.sleep(0.5)
            try:
                # 【2026-09-23 修邮差】每 ~5s 重投一次没送到的 urgent 收件信
                # （mailbox.pending_urgent 年龄门槛 5s 防产信投递毫秒窗口的双投
                # 竞态）——单通道后宿主不再兜底，送失的信由投递员自己重送直到
                # 送达（回执即清账）。挂铃铛才跑腿（自取模式无上门一说）。
                _retry_tick += 1
                if _retry_tick >= 10 and mail_courier:
                    _retry_tick = 0
                    if engine_mode and doorbell_hosts is not None:
                        # daemon：按门铃注册表逐门重投（过期门=留柜自取）
                        for _h, _u in doorbell_hosts():
                            mail_courier.retry_pending(_u, _h)
                    elif push_url:
                        mail_courier.retry_pending(push_url, args.host)
                # 【增量B engine_mode】daemon 信柜管家：常驻引擎一座养全场，
                # 回信无论寄到哪个宿主格都归它喂（all_hosts），认领纪律仍由
                # bound_job_ids 站岗；桥模式原样按本宿主过滤。
                if engine_mode:
                    _drained = mailbox.drain_outgoing(
                        args.host, all_hosts=True,
                        only_job_ids=frozenset(femo_api.bound_job_ids()))
                else:
                    _drained = mailbox.drain_outgoing(
                        args.host, only_job_ids=frozenset(femo_api.bound_job_ids()))
                if _drained:
                    _trace(f"poll drain {len(_drained)} letter(s)")
                for x in _drained:
                    _poll_log(f"drain kind={x.get('kind')} ref={x.get('ref')} "
                              f"job={x.get('job_id')} target={x.get('target_host')}")
                    if x.get('kind') != 'speech' or not x.get('ref'):
                        _trace(f"poll skip kind={x.get('kind')} "
                               f"ref={x.get('ref')} id={x.get('id')}")
                        continue
                    # ── 第一段：备料 + 喂引擎。只有这一段的错才配「退回重投」——
                    # 此时信还没进引擎，重投是纯收益（2026-10-07 j2717 文件锁吞信
                    # 事故的裁决正身）。
                    try:
                        body = x.get('body') if isinstance(x.get('body'), dict) else None
                        if body is None:
                            # 手写信兜底（2026-09-21 立法；2026-09-27 随 output
                            # 退役换形）：按信的 soul 选词（'human'/'@角色'=人类席
                            # →chat_text；其余=AI 席→合成单步，台词在末步 reply）。
                            _soul = str(x.get('soul') or '')
                            body = ({'chat_text': x.get('payload') or ''}
                                    if (_soul == 'human' or _soul.startswith('@'))
                                    else {'steps': [{'step': 0, 'reply': x.get('payload') or ''}]})
                        # 【output 字段退役（2026-09-27 用户拍板，无兼容读）】交卷体
                        # 台词唯一正身=steps 末步 reply，宿主不发 output、桥也不认——
                        # 信上就算带了 output 一律无视；引擎交接面要的它由本桥派生
                        # 注入，引擎零感知。人类席（chat_text）不涉此变。
                        if isinstance(body, dict) and 'chat_text' not in body:
                            body = {**body, 'output': mailbox.last_step_reply(body.get('steps'))}
                        # 【观测】投喂引擎前后各留一痕：这是「桥说 consumed、
                        # 引擎却不动」的唯一分界点（deliver_human_input 返回成功
                        # 只代表塞进了槽，不代表引擎被唤醒）。
                        _trace(f"handin→engine ref={x['ref']} soul={x.get('soul')} "
                               f"job={x.get('job_id')} body_keys={sorted(body.keys())}")
                        _handin_out = jm.deliver_human_input(int(x['job_id']), x['ref'], body)
                    except Exception as exc:
                        # 【瞬时错误退回重投（2026-10-07，j2717 文件锁吞信事故）】
                        # OSError 族按「下一秒就自愈」对待：退回信柜退避重投，
                        # 重试次数随信携带（handin_retries），到顶才记死信；
                        # 其余异常（真 bug）维持一步死信响亮留痕。delivered=False
                        # 的诚实拒收（job_not_active 等）不进此支——刀0 裁决不变。
                        # 【护栏只到喂引擎（2026-10-08，j2719 human_26 实案）】旧法
                        # 一个 try 罩到收尾记账：投喂已成功、其后 mark_consumed 撞
                        # 文件锁（mailbox.json.tmp replace WinError 5）也落进这条
                        # except，把已送达的信退回重投、同一句台词喂了引擎两遍。
                        # 重投判据从此只看喂引擎这一步的错。
                        if isinstance(exc, OSError):
                            _retries = int(x.get('handin_retries') or 0) + 1
                            if _retries <= _HANDIN_RETRY_MAX:
                                _delay = min(5 * _retries, 30)
                                mailbox.requeue(x['id'], reason=str(exc), delay_sec=_delay)
                                _poll_log(f"handin ref={x['ref']} job={x.get('job_id')} "
                                          f"transient_error={exc!r} retry={_retries}/{_HANDIN_RETRY_MAX} in {_delay}s")
                                sys.stderr.write(f"femo_bridge: handin transient error "
                                                 f"(job={x['job_id']} ref={x['ref']}): {exc} "
                                                 f"— 退回信柜，{_delay}s 后第 {_retries}/{_HANDIN_RETRY_MAX} 次重投\n")
                                continue
                        mailbox.mark_dead(x['id'], reason=f'exception: {exc}')
                        sys.stderr.write(f"femo_bridge: speech letter dead "
                                         f"(job={x['job_id']} ref={x['ref']}): {exc}\n")
                        continue
                    _delivered = (isinstance(_handin_out, dict)
                                  and _handin_out.get('delivered') is True)
                    _poll_log(f"handin ref={x['ref']} job={x.get('job_id')} "
                              f"delivered={_delivered} out={str(_handin_out)[:100]}")
                    if not _delivered:
                        # 【刀0 诚实闸 2026-09-26】喂不进：死信终态留档，不销账、
                        # 不投影。旧代码在此无条件 mark_consumed + on_post_speech
                        # ——「引擎压根没收到」在账面上与「收到了」无法区分
                        # （2471 僵死 15min 的静默点），拒收台词还上墙冒充真台词
                        # （job 2585 鬼影段实锤）。死信不回炉：引擎等待超时与
                        # 续跑是既定裁决，被捞出的信别人也不会再来捞。
                        _trace(f"handin FAILED ref={x['ref']} "
                               f"out={str(_handin_out)[:160]} ← 死信留档")
                        mailbox.mark_dead(x['id'], reason=str(_handin_out))
                        sys.stderr.write(f"femo_bridge: speech letter DEAD "
                                         f"(job={x['job_id']} ref={x['ref']}) "
                                         f"out={str(_handin_out)[:160]}\n")
                        continue
                    _trace(f"handin ok ref={x['ref']}")
                    # ── 第二段：收尾记账，各兜各的错，一律不退回重投——信已进
                    # 引擎。清账失败只是死账留柜（出站口只捞 pending，绝不会因此
                    # 再喂第二遍），响亮留痕，等信柜滚动清理收殓。
                    try:
                        mailbox.mark_consumed(x['id'])
                    except Exception as exc:
                        sys.stderr.write(f"femo_bridge: mark_consumed failed "
                                         f"(letter {x['id']} stays delivered, no requeue): {exc}\n")
                    if projector is not None:   # 幕布：引擎真吃了才投影（best-effort）
                        try:
                            rows = projector.on_post_speech({
                                'job_id': x.get('job_id'), 'wait_key': x.get('ref'),
                                'soul': x.get('soul') or 'main', 'node': x.get('node'),
                                'payload': x.get('payload'),
                                'body': body,
                            })
                            if rows:
                                _hub_feed(int(x['job_id']), rows)
                        except Exception as exc:
                            sys.stderr.write(f"femo_bridge: hub project failed: {exc}\n")
                    sys.stderr.write(f"femo_bridge: speech consumed "
                                     f"(job={x['job_id']} ref={x['ref']})\n")
            except Exception as exc:
                sys.stderr.write(f"femo_bridge: mailbox poll failed: {exc}\n")

    def make_event_callback(job_id, resumed=False):
        def cb(event_type, data):
            # 【观测】引擎→桥的每一次事件都留痕：卡死时用它回答
            # 「引擎到底有没有 emit ai_done / node_settled」。
            _trace(f"engine→bridge event={event_type} job={job_id}")
            payload = {**(data if isinstance(data, dict) else {}), 'job_id': job_id}
            jm.observe_event(job_id, event_type, payload)      # 状态机旁挂（§7.5）
            # 先投递后发事件（2026-09-16 上门投递）：_mailbox_post 内含产信+投递员
            # 直推（同步完成：送达回执或失败留柜），事件才发——宿主事件现场查
            # 「已喊/已参与」簿必与 push 结果一致，双侧天然互斥无竞态（时序契约
            # 见 mail_courier.py 文件头）。
            _mailbox_post(job_id, event_type, payload, resumed=resumed)   # 给主Agent/角色的信（驿站八维）
            emit({'type': 'event', 'event': event_type, 'data': payload})   # 信封带 job_id（A4 路由键）
            if projector is not None:                          # 幕布（投影中心，best-effort）
                try:
                    # 续跑标记只注给投影（2026-09-21 场次消息家族）：resume 也发
                    # flow_start，投影据此写「继续」而非第二张「开场」；引擎事件
                    # 信封保持原样，宿主零感知。
                    pd = {**payload, 'resumed': True} \
                        if (event_type == 'flow_start' and resumed) else payload
                    _hub_feed(job_id, projector.on_event(event_type, pd))
                except Exception as exc:
                    sys.stderr.write(f"femo_bridge: hub project failed: {exc}\n")
            if event_type == 'flow_start':                     # 幕布：启动运行花名册（FEMO脚本 actors）
                _hub_cast(job_id, payload)
                _hub_owner(job_id)                             # 幕布：本次主会话（FEMO外行过滤）
            elif event_type == 'ai_request':                   # 幕布：带括号显示名（soulid）
                _hub_display(job_id, payload)
        return cb

    # 节点发言第二阶段（发信）的驿站轮询：daemon 线程，把客户寄出的 speech 信
    # 按 ref 喂给引擎（见 _mailbox_poll_forever）。mailbox 不可用则不启。
    # ⚠️ 此处禁止 import threading——函数内 import 会把 threading 判为 main
    # 局部名，顶部 out_lock = threading.Lock() 直接 UnboundLocalError（模块
    # 顶层已 import，直接用）。
    # 【搭台搬移自证 2026-09-26】本段（原 main）迁为 build_stage，规则不变：
    # threading 的 import 仍只在模块顶层，函数内任何 import 都会遮蔽模块名
    # ——build_stage 内多处 threading.Thread/Timer 引用，照旧禁止函数内 import。
    if mailbox is not None:
        threading.Thread(target=_mailbox_poll_forever, daemon=True,
                         name='mailbox-outgoing').start()

    def spawn_job_worker(job_id, script, base_dir, user_api_key, user_api_provider,
                         user_api_url, user_api_model, host_ai_backend=False,
                         resume_state=None):
        """构造 Runner 并起 worker 线程（§7.4，三面收口）：
        ①构造期异常（resume 裁决过了、FEMORunner.__init__ 里 restore_state 抛）
          → except → finalize('failed')；
        ②节点异常从 run_async 传播 → 同上；
        ③正常结束 → run_async 内 flow_done → observe_event → finalize('finished')，
          worker finally 兜底因 state 已非 running 而 no-op；
        ④取消/暂停 → on_state_change 回调先落 suspended，worker finally 兜底 no-op。
        Job 永不卡 running（除进程暴毙→对账 crash）。
        ⚠️ 实现决定（对清单 §7.4 伪代码的修订回写）：resume 分支的 mark_running
        在【构造前】调用——伪代码放构造后会让构造期异常停在 suspended
        （finalize 仅 running 生效，no-op 停尸）；构造前调用使 except/finally 的
        finalize(failed) 在 running 态生效，同样"不停僵尸 running"且收口统一。"""
        def worker():
            runner = None
            try:
                if resume_state:
                    # resume：裁决已过、构造即将开始——先确认 running（见上注）。
                    jm.mark_running(job_id)
                runner = femo_api.create_runner(
                    script,
                    base_dir=base_dir,
                    verbose=False,
                    event_callback=make_event_callback(job_id, resumed=bool(resume_state)),
                    user_api_key=user_api_key,
                    user_api_provider=user_api_provider,
                    user_api_url=user_api_url,
                    user_api_model=user_api_model,
                    resume_state=resume_state,
                    # Job 旁挂（§4.2 窄回调契约）：Runtime 不认识 Job，
                    # bridge 是翻译层——四个 lambda 全部在 worker 单线程 fire。
                    runtime_callbacks={
                        'on_flow_start':   lambda p: jm.mark_session(job_id, p.get('session_id')),
                        'on_checkpoint':   lambda p: jm.merge_checkpoint(job_id, p),
                        'on_state_change': lambda st, reason: jm.suspend(job_id, reason),
                        'on_run_end':      lambda fs: jm.finalize(job_id, 'finished'),
                    },
                    # wait_key 世代前缀（§5.6）：跨 Job 键永不重合的机制性免疫
                    run_tag=f'j{job_id}:',
                    # host_ai_backend=True 时 wait_key 信箱 + 「首轮全量、之后
                    # 增量」上下文模式由门面装配（_host_ai_backend/
                    # _context_mode 私有面已收口进 create_runner）。
                    host_ai_backend=host_ai_backend,
                )
                if resume_state:
                    print(f"[bridge] resume state keys: {sorted(resume_state.keys())}")
                jm.attach(job_id, runner)
                runners[job_id] = runner   # mail_context（问引擎）取活状态用
                runner.run()
                # 跑完终局信此刻才产（时机规则升公共，Job 761）：run() 返回=引擎
                # 与角色全部收工。暂停/取消路径 run() 也正常返回，但 flow_done
                # 从未发生（final_payloads 无记录）→ 不产信，暂停信已由
                # flow_paused 事件现场承担。先产信后发事件（代取竞态免疫）。
                done_payload = final_payloads.pop(job_id, None)
                if done_payload is not None:
                    _post_final_done(job_id, done_payload)
                emit({'type': 'event', 'event': 'bridge_run_ended',
                      'data': {'ok': True, 'job_id': job_id}})
            except Exception as exc:
                traceback.print_exc(file=sys.stderr)
                # 【2026-10-01 用户拍板：一切 error 挂起可续】walk 起步过（档案有
                # 断点——节点门口检查点含 fork 世界整包）→ suspended(node_pause)
                # 可续跑：flow_paused 事件+急件带错误全文上浮（宿主清场全挂
                # flow_paused 暂停分支，响亮不静默）；仅构造期崩溃（无断点可续
                # ，fresh_start 等价）保持 failed 终态。两个分支都先信后事件
                # （§八.12 同序，防驿站盲区压站）。
                if jm.has_checkpoints(job_id):
                    _mailbox_post(job_id, 'flow_paused',
                                  {'error': str(exc), 'job_id': job_id})
                    emit({'type': 'event', 'event': 'flow_paused',
                          'data': {'reason': 'node_pause', 'error': str(exc), 'job_id': job_id}})
                    emit({'type': 'event', 'event': 'bridge_run_ended',
                          'data': {'ok': True, 'job_id': job_id}})
                    jm.suspend(job_id, 'node_pause', error=str(exc))
                else:
                    final_payloads.pop(job_id, None)
                    _mailbox_post(job_id, 'flow_error',
                                  {'error': str(exc), 'job_id': job_id})
                    emit({'type': 'event', 'event': 'flow_error',
                          'data': {'error': str(exc), 'job_id': job_id}})
                    emit({'type': 'event', 'event': 'bridge_run_ended',
                          'data': {'ok': False, 'job_id': job_id}})
                    jm.finalize(job_id, 'failed', error=str(exc))   # 收口①②
            finally:
                if runner is not None:
                    try:
                        import asyncio
                        asyncio.run(runner.engine.shutdown())
                    except Exception:
                        pass                      # A2 修复后不再假死
                jm.detach(job_id)
                runners.pop(job_id, None)
                jm.finalize(job_id, 'failed')     # 收口③兜底：幂等，仅 running 态生效
        t = threading.Thread(target=worker, daemon=True)
        workers[job_id] = t
        t.start()

    # ── 同步编译（check / job_start / job_resume 共用一份）─────────────────
    def run_compile(femo_text, base_dir, models=None):
        """同步 parse：编译错误在此拒绝——job_start/job_resume 的编译失败连
        Job 文件都不产生（脏 Job 号零残留，§7.2）。base_dir 空串=未保存的
        合法语义（引擎对相对路径报错），不能用 femo_root 回退。
        models = 宿主注入的模型白名单（validate_actor_sources 编译期校验
        source 用；None 跳过校验）。
        编译成功时顺带取出 script.warnings（2026-09-07 warning 桶），随回执
        上浮宿主。实现在门面 femo_api.compile_script（soul 检查器由门面自备），
        这里只剩宿主侧的 base_dir 兜底策略；返回 CompileResult
        （script=不透明句柄，只许传回 create_runner）。"""
        return femo_api.compile_script(
            femo_text,
            base_dir=base_dir if base_dir is not None else femo_root,
            models=models,
        )

    # ── command dispatch ───────────────────────────────────────────────────
    def dispatch_inner(req_id, cmd, args_obj):
        # 七条本地只读命令（2026-09-29 收编）：正身单源 dispatch_local_queries
        # （与回滚壳 dispatch_local 同吃一份），本链只剩改状态的命令与 shutdown。
        if dispatch_local_queries(cmd, req_id, args_obj, femo_api=femo_api,
                                  femo_root=femo_root, jm=jm,
                                  send_response=send_response):
            return
        if cmd == "job_restart":
            # 从档案/挂载路径重开（2026-10-04 投影页「开始」钮——投影中心超然
            # 于各 Host，从 mounts.json 里选哪家挂的剧本都能开跑）。两种入参：
            # ①job_id=从那场档案的 script_path 读**盘上现稿**（fresh_start 只认
            #   盘上当下这一版，语义沿 job_start——不用档案冻结的 script_text，
            #   改过稿的旧文本静默重跑是脚枪）；
            # ②script_path=直接按路径读盘上现稿（挂载账本的地址挂载形态）——
            #   班底 host_ref/host_refs 按 **script_name 同名** 的最近档案沿袭
            #   （同一出戏重开=同一班底，产信照寄原宿主格；没演过的新本=空，
            #   演出中的座位信按 cast 账/角色 scope 走，不受此影响）。
            # host_ai_backend 缺省 True（与 tools-core 同款必传语义）。归一成
            # job_start 参数落回正身——编译/建档/派工只此一份，不造第二套。
            job_id = args_obj.get("job_id")
            sp_arg = str(args_obj.get('script_path') or '')
            if not isinstance(job_id, int) and not sp_arg:
                rows = jm.list_jobs()
                if not rows:
                    send_response(req_id, False, error="job_restart: 没有任何历史场（runs/ 为空），无从重开")
                    return
                job_id = max(int(r.get('job_id') or 0) for r in rows)
            if isinstance(job_id, int):
                rec = jm.get_job_state(job_id)
                if not isinstance(rec, dict) or rec.get('error') or not str(rec.get('script_path') or ''):
                    send_response(req_id, False, error="job_restart: 档案不存在或缺 script_path（job %s）" % job_id)
                    return
                sp = str(rec['script_path'])
            else:
                sp = os.path.abspath(sp_arg)
                if not os.path.isfile(sp):
                    send_response(req_id, False, error="job_restart: 剧本文件不存在：%s" % sp)
                    return
            try:
                with open(sp, 'r', encoding='utf-8-sig') as _f:
                    femo_text = _f.read()
            except OSError as exc:
                send_response(req_id, False, error="job_restart: 剧本文件读不到（可能被移动/删除）：%s（%s）" % (sp, exc))
                return
            if not femo_text.strip():
                send_response(req_id, False, error="job_restart: 盘上剧本是空的：%s" % sp)
                return
            args_obj = dict(args_obj)
            args_obj['femo'] = femo_text
            args_obj['script_path'] = sp
            args_obj.setdefault('script_name', os.path.basename(sp))
            args_obj['base_dir'] = os.path.dirname(sp) or None
            if not (isinstance(args_obj.get('host_refs'), dict) and args_obj['host_refs']):
                inherit = {}
                try:
                    rows = jm.list_jobs()
                    same = [r for r in rows
                            if str(r.get('script_name') or '') == os.path.basename(sp)]
                    if same:
                        same.sort(key=lambda r: int(r.get('job_id') or 0))
                        prev = jm.get_job_state(int(same[-1]['job_id']))
                        inherit = dict(prev.get('host_refs') or {})
                        if not str(args_obj.get('host_ref') or '') and str(prev.get('host_ref') or ''):
                            args_obj['host_ref'] = str(prev.get('host_ref') or '')
                except Exception:
                    inherit = {}   # 沿袭是优化不是依赖：查不到就空着起步
                args_obj['host_refs'] = inherit
            if not str(args_obj.get('host_ref') or ''):
                args_obj['host_ref'] = str(rec.get('host_ref') or '') if isinstance(job_id, int) else ''
            args_obj.setdefault('host_ai_backend', True)
            cmd = "job_start"
        if cmd == "job_start":
            femo_text = args_obj.get("femo", "")
            if not femo_text.strip():
                send_response(req_id, False, error="femo is empty")
                return
            ensure_default_data()
            # 同步编译先行：编译失败的脚本连 Job 文件都不产生（脏 Job 号零残留）
            res = run_compile(femo_text, args_obj.get("base_dir"), args_obj.get("models"))
            rec = jm.create_job(
                femo_api.fingerprint_script(femo_text),
                # host_ref 旧协议名 owner_tag 兼容（旧宿主不断）；host_refs
                # 归一（新宿主传字典 / 老宿主字符串包装，见 _norm_host_refs）
                host_ref=str(args_obj.get("host_ref", args_obj.get("owner_tag", "")) or ""),
                host_refs=_norm_host_refs(args_obj),
                script_name=str(args_obj.get("script_name", "") or ""),
                # FEMO脚本快照（文本+地址）随档案落盘：femoGen 凭 job_id 即可取回
                # 当场跑的是哪一版（渲染/回放/续跑的数据源）。
                script_path=str(args_obj.get("script_path", "") or ""),
                script_text=femo_text,
            )
            # 编译警告产信（滞留件）：随本 Job 终局急件打包送达主模型。
            _post_compile_warnings(rec.job_id, res.warnings)
            _hub_owner(rec.job_id)   # 幕布：本次主会话（FEMO外行的过滤判据，启动运行即登记）
            spawn_job_worker(
                rec.job_id, res.script,
                # base_dir：有FEMO脚本地址=FEMO脚本目录；未保存=空串（引擎对相对路径报错）。
                args_obj.get("base_dir") if args_obj.get("base_dir") is not None else femo_root,
                args_obj.get("user_api_key"),
                args_obj.get("user_api_provider"),
                args_obj.get("user_api_url"),
                args_obj.get("user_api_model"),
                bool(args_obj.get("host_ai_backend", args_obj.get("dsh_ai_backend", False))),
                resume_state=None,
            )
            send_response(req_id, True, {"job_id": rec.job_id, "state": rec.state,
                                         "warnings": res.warnings})
        elif cmd == "job_resume":
            femo_text = args_obj.get("femo", "")
            job_id = args_obj.get("job_id")
            if not femo_text.strip():
                send_response(req_id, False, error="femo is empty")
                return
            if not isinstance(job_id, int):
                send_response(req_id, False, error="job_id is required")
                return
            # 摸到才对账（2026-09-07）：续跑动手前先把目标档案状态裁决诚实
            # ——僵死 running（上一代 bridge 暴毙残留）在此落成 crash，六关
            # 第②关才能放行。_bound 主人检查在 helper 内：自己正跑着的 Job
            # 不会被对账动，会在第②关以 already_running 原话拒绝。
            jm.reconcile_stale(job_id)
            ensure_default_data()
            # 同步编译先行（同 job_start）
            res = run_compile(femo_text, args_obj.get("base_dir"), args_obj.get("models"))
            # 六关裁决（JobManager.resume_job，JobError 带原话上浮宿主——B2/C2）
            rec = jm.resume_job(job_id, femo_api.fingerprint_script(femo_text),
                                host_ref=str(args_obj.get("host_ref", args_obj.get("owner_tag", "")) or ""),
                                new_text=femo_text,
                                host_refs=_norm_host_refs(args_obj))
            # resume_state 由引擎档案提供（build_resume_state），宿主不再传——
            # 断点权威在 runs/<job_id>.json，指纹/场次/断点六关已裁决。
            resume_state = jm.build_resume_state(rec)
            # 编译警告产信（滞留件，同 job_start——续跑改了FEMO脚本同样该知情）。
            _post_compile_warnings(job_id, res.warnings)
            _hub_owner(job_id)   # 幕布：续跑同样登记本次主会话（host_ref 已更新为本次发起方）
            # 【刀2 续跑收养】导演格已随本次登记换成新会话号——在柜待领信重贴号。
            # 收养的唯一合法凭证=续跑登记（清单 §四从严裁决）：平时号不符=不领
            # 不记、信留柜，只有续跑这一刻把旧号整体过户给新窗口。
            # 【增量C】过户的格=调用方宿主格（壳转发自带 _caller_host）。
            _caller = _caller_host(args_obj)
            _new_sid = (_norm_host_refs(args_obj).get(str(_caller))
                        or str(args_obj.get("host_ref", args_obj.get("owner_tag", "")) or ""))
            if _new_sid and mailbox is not None:
                try:
                    _n = mailbox.readdress(_caller, job_id=job_id, session=_new_sid)
                    if _n:
                        sys.stderr.write(f"femo_bridge: resume readdress "
                                         f"{_n} letter(s) → {_new_sid}\n")
                except Exception as _exc:
                    sys.stderr.write(f"femo_bridge: readdress failed: {_exc}\n")
            spawn_job_worker(
                job_id, res.script,
                args_obj.get("base_dir") if args_obj.get("base_dir") is not None else femo_root,
                args_obj.get("user_api_key"),
                args_obj.get("user_api_provider"),
                args_obj.get("user_api_url"),
                args_obj.get("user_api_model"),
                bool(args_obj.get("host_ai_backend", args_obj.get("dsh_ai_backend", False))),
                resume_state=resume_state,
            )
            send_response(req_id, True, {"resumed": True, "job_id": job_id,
                                         "femo_session_id": rec.femo_session_id,
                                         "warnings": res.warnings})
        elif cmd == "attach_host_refs":
            # 中途挂账（联机中途进场，账本多宿主化 §3.3）：running 态 resume
            # 会被六关第②关拦死——第二台宿主中途进场走这里。只合并归属账
            # 不碰状态机；挂完顺手重登记 hub 信任集（幂等）。
            job_id = args_obj.get("job_id")
            if not isinstance(job_id, int):
                send_response(req_id, False, error="job_id is required")
                return
            merged = jm.attach_host_refs(job_id, _norm_host_refs(args_obj))
            _hub_owner(job_id)
            send_response(req_id, True, {"job_id": job_id, "host_refs": merged})
        elif cmd == "job_pause":
            job_id = args_obj.get("job_id")
            if not isinstance(job_id, int):
                send_response(req_id, False, error="job_id is required")
                return
            out = jm.pause_job(job_id)
            # 幂等：suspended/finished/failed 照样 {paused:true, state:<现态>}，
            # 不假成功也不报错（B5 死于结构）
            # 【强停兜底（2026-09-07 214 事故）】stop() 的取消令牌已按
            # call_soon_threadsafe 送达——健康循环（含空转 park）秒级收场；
            # worker join 超时仍不退出=循环线程被同步调用卡死（asyncio 取消
            # 无法注入，Python 杀不了线程）。此时唯一诚实的强停是进程级：
            # 档案仍 running 就先落 suspended(user_pause)（checkpoint 每节点
            # 都写盘，进程死不丢断点），回执带 forced:true，再让 bridge 进程
            # 退出（宿主下次命令自动重拉新 bridge）。回执必须先于退出发出
            # （shutdown 命令同款时序）。join 上限 10s < 宿主 job_pause 发送
            # 超时 15s——慢收场不等价于失败，回执总能赶上。
            if out.get("paused") and out.get("state") == "running":
                t = workers.get(job_id)
                if t is not None:
                    t.join(timeout=10)
                    if t.is_alive():
                        st = jm.get_job_state(job_id)
                        if st.get("state") == "running":
                            jm.suspend(job_id, "user_pause")
                        send_response(req_id, True, {**out, "state": "suspended", "forced": True})
                        threading.Timer(0.2, os._exit, args=(1,)).start()
                        return
                    # 【干净收场回执纠偏（2026-09-10 暂停确认竞态）】out.state 是
                    # cancel 前快照（恒 running），而 join 期间 worker 已落终态、
                    # flow_paused 事件此刻早已广播——回执若仍说 running，前端会
                    # 在确认之后才起"等 8 秒确认"计时器（永远等不到）→ 黄条误报。
                    # 重读档案真实终态，并带 confirmed:true（本次暂停确实停掉了
                    # 运行中的 Job，非幂等无操作），前端据此当场确认不再等。
                    out = {**out, "state": jm.get_job_state(job_id).get("state", out.get("state")),
                           "confirmed": True}
            send_response(req_id, True, out)
        elif cmd == "post_speech":
            # 代寄（2026-09-16 节点发言第二阶段统一）：宿主执行体（main/角色/
            # 人类）交卷不再直发 human_input——台词寄 speech 信进驿站
            # （send+speech+urgent+customer_hook+system_require+ref=wait_key，
            # 八维即「系统要回答，客户发件」），本桥轮询线程出站喂引擎
            # （deliver_human_input 活跃+_bound 校验）后台账清账。body=交卷体
            # 完整字典（steps/model_id/chat_text/variables…）随信原样上桌；
            # payload=台词正文（账本可读）。受理即回执（{posted, letter_id}）：
            # 引擎消费在 ≤0.5s 轮询后，喂不进由出站口记死信（不回炉）。
            job_id = args_obj.get("job_id")
            wait_key = str(args_obj.get("wait_key", "") or "")
            body = args_obj.get("body") if isinstance(args_obj.get("body"), dict) else None
            if not isinstance(job_id, int):
                send_response(req_id, False, error="job_id is required")
                return
            if not wait_key:
                send_response(req_id, False, error="wait_key is required")
                return
            if mailbox is None:
                send_response(req_id, False, error="mailbox unavailable")
                return
            payload = args_obj.get("payload")
            if not isinstance(payload, str) or not payload:
                # 台词正身=steps 末步 reply（2026-09-27 output 退役，不兼容读旧信）；人类席 chat_text 垫底
                payload = (mailbox.last_step_reply((body or {}).get("steps"))
                           or (body or {}).get("chat_text") or "")
            # 【跨宿主回信 2026-09-25】target 不能想当然写自己：角色回信发生在
            # 角色宿主，等回信的引擎在主Agent宿主（job 2583 实证：回信写给自家、
            # 自家引擎 job_not_active 拒收、主Agent引擎空等 3600s）。主Agent宿主=
            # 本次档案 host_refs 里值==host_ref 的键（数据根共享，角色侧读得到
            # 主Agent写的档案）；档案缺失/解析失败回落自己（本地戏=现状零变化）。
            target_host = args.host
            try:
                with open(os.path.join(jm.runs_dir, f'{int(job_id)}.json'), encoding='utf-8') as _af:
                    _rec = json.load(_af)
                _ref = _rec.get('host_ref')
                _refs = _rec.get('host_refs') if isinstance(_rec.get('host_refs'), dict) else {}
                for _h, _r in _refs.items():
                    if _r == _ref:
                        target_host = str(_h)
                        break
            except (OSError, ValueError):
                pass
            letter = mailbox.post(
                job_id=job_id,
                soul=str(args_obj.get("soul", "main") or "main"),
                kind='speech', payload=payload, action='send',
                delivery='urgent', who_move='customer_hook',
                who_require='system_require', target_host=target_host,
                node=str(args_obj.get("node", "") or "") or None,
                ref=wait_key, body=body)
            # 幕布投影已收口到出站轮询路径（2026-09-20）：信被引擎真吃了才上墙
            # （受理≠入账），此处不再预投影——见 _mailbox_poll_forever。
            send_response(req_id, True, {"posted": True, "letter_id": letter['id']})
        elif cmd == "collect_notices":
            # 代取（2026-09-16 system_push 落地）：宿主在停下信号现场（flow_error/
            # flow_paused/bridge_run_ended）取走本 Job 给 main 的通知信包——终局
            # 急件+已放行滞留件，取走即记送达（账本诚实）。收件动词只有一份
            # （mailbox.receive），桥当代办，宿主侧不重复实现柜子；job_id 过滤
            # 防宿主崩溃后旧 Job 压站信在下一次被捞走串场。mailbox 不可用=诚实
            # 报错（宿主回落只 steer 标题行）。
            job_id = args_obj.get("job_id")
            soul = str(args_obj.get("soul", "main") or "main")
            if mailbox is None:
                send_response(req_id, False, error="mailbox unavailable")
                return
            letters = mailbox.receive(
                _caller_host(args_obj), soul=soul, session=args_obj.get("session"),
                job_id=job_id if isinstance(job_id, int) else None)
            send_response(req_id, True, {"letters": letters})
        elif cmd == "mailbox_post":
            # 宿主侧寄信口（2026-09-23 十连裁⑨ 人类插话信化）：单通道纪律下，
            # 宿主进程对人类→main 的插话不再原地直推——经此命令寄信，urgent 信
            # 产信即投递员单封直推回本宿主收件口（push_extra 原样附带，人类插话
            # 用它带回 mainSid 路由）。投递失败即死信（mark_consumed）：宿主侧收
            # 到 delivered=false 会走原地降级直推，柜里不留副本防终局诈尸双份。
            letter_args = args_obj.get("letter") if isinstance(args_obj.get("letter"), dict) else None
            if mailbox is None:
                send_response(req_id, False, error="mailbox unavailable")
                return
            if letter_args is None:
                send_response(req_id, False, error="letter dict is required")
                return
            letter = mailbox.post(
                job_id=letter_args.get("job_id") if isinstance(letter_args.get("job_id"), int) else None,
                soul=str(letter_args.get("soul", "main") or "main"),
                kind=str(letter_args.get("kind", "notice") or "notice"),
                payload=str(letter_args.get("payload", "")),
                action='receive',
                delivery=str(letter_args.get("delivery", "urgent") or "urgent"),
                who_move=_who_move(_caller_host(args_obj)),
                who_require='customer_require',
                target_host=_caller_host(args_obj),
                node=(str(letter_args["node"]) if letter_args.get("node") else None) or None,
                ref=(str(letter_args["ref"]) if letter_args.get("ref") else None) or None,
                subkind=(str(letter_args["subkind"]) if letter_args.get("subkind") else None) or None)
            delivered = False
            _mp_url = _deliver_url(_caller_host(args_obj))
            if letter_args.get("delivery") != "held" and _mp_url and mail_courier:
                extra = args_obj.get("push_extra") if isinstance(args_obj.get("push_extra"), dict) else None
                delivered = bool(mail_courier.deliver(_mp_url, [letter],
                                                      **({"extra": extra} if extra is not None else {})))
            if not delivered:
                try:
                    mailbox.mark_consumed(letter["id"])
                except Exception:
                    pass
            send_response(req_id, True, {"ok": True, "letter_id": letter["id"], "delivered": delivered})
        elif cmd == "mail_context":
            # 问引擎（客户索要）：给本会话的剧情状态速览。v1 运行态要点；
            # 完整 block_collector 拼装待引擎暴露离线拼装面后接入（phase3）。
            # 【关系裁决 2026-09-27】无子代理化后每块窗口都是潜在演员窗，「戏在
            # 跑」不再等于「与你有关」——调用方必须是本场班底才给横幅：导演
            # （job 档案 host_refs 的 (宿主→会话号) 对上）或选角账演员（cast/
            # <job>.json 的 soul→(sid,host) 对上）；无关会话回空串（横幅广播进
            # 无关窗口实测误导案：任何窗口说话都收到「正在运行中」）。
            soul = args_obj.get("soul", "main")
            caller_host = str(args_obj.get("_caller_host") or "")
            caller_sid = str(args_obj.get("session") or "")
            rid = args_obj.get("job_id")
            runner = runners.get(rid) if isinstance(rid, int) else None
            if runner is None and len(runners) > 0:
                runner = next(iter(runners.values()))
            if runner is None:
                send_response(req_id, True, {'text': ''})
                return
            involved = False
            job_id = next((jid for jid, r in runners.items() if r is runner), None)
            if caller_sid and job_id is not None:
                try:
                    rec = jm.get_job_state(job_id) or {}
                    refs = rec.get('host_refs') if isinstance(rec.get('host_refs'), dict) else {}
                    if not refs and rec.get('host_ref'):
                        refs = {host_name: str(rec.get('host_ref'))}
                    if caller_host and refs.get(caller_host) == caller_sid:
                        involved = True
                except Exception as exc:
                    sys.stderr.write(f"femo_bridge: mail_context director check failed: {exc}\n")
                if not involved and hub is not None:
                    try:
                        entry = (hub.cast_job(job_id).get('cast') or {}).get(soul) or {}
                        if entry.get('sid') == caller_sid and (not entry.get('host') or entry.get('host') == caller_host):
                            involved = True
                    except Exception as exc:
                        sys.stderr.write(f"femo_bridge: mail_context cast check failed: {exc}\n")
            if not involved:
                send_response(req_id, True, {'text': ''})
                return
            try:
                name = runner.script.meta.get('name', '未命名脚本')
            except Exception:
                name = '未命名脚本'
            session = getattr(runner, '_current_session_id', 0)
            prompt = (getattr(runner, '_current_prompt', '') or '').strip()[:200]
            text = f"FEMO脚本《{name}》正在运行中（台账场次 {session}）。"
            if prompt:
                text += f"最近节点指令：{prompt}"
            send_response(req_id, True, {'text': text})
        elif cmd == "mail_catchup":
            # 宿主补课（2026-09-17，who_require=customer_require 客户索要）：
            # FEMO running 中用户在主窗口与 main 暗聊，dsh 在回合门口同步索取
            # 「main 上次登台发言→现在」的可见增量（scope∋main，ContextExample
            # 增量口径+交付游标；actor_info 与 main 登台拍同源：soul=main、
            # user=FEMO脚本 owner）。main 不在戏里/无新进展=空串，宿主据此跳过注
            # 入。交付即推游标（引擎统一规则）——同一段错过只补一课，下次从
            # 断点续发。这不是 system_require 的FEMO中喊话，是宿主主动索取。
            job_id = args_obj.get("job_id")
            if not isinstance(job_id, int):
                send_response(req_id, False, error="job_id is required")
                return
            runner = runners.get(job_id)
            if runner is None:
                send_response(req_id, True, {"text": "", "reason": "no_live_runner"})
                return
            try:
                from femoBridges.ContextExample import build_session_context, MODE_INCREMENTAL
                owners = runner.script.meta.get("owner", []) or []
                actor_info = {"soul": "main"}
                if owners:
                    actor_info["user"] = str(owners[0])
                text = build_session_context(
                    getattr(runner, "_current_session_id", 0),
                    actor_info, MODE_INCREMENTAL,
                    actors_def=getattr(runner.script, "actors", None))
                send_response(req_id, True, {"text": text or ""})
            except Exception as exc:
                sys.stderr.write(f"femo_bridge: mail_catchup failed: {exc}\n")
                send_response(req_id, False, error=f"mail_catchup failed: {exc}")
        elif cmd == "human_input":
            wait_key = args_obj.get("wait_key", "")
            body = args_obj.get("body")
            job_id = args_obj.get("job_id")
            if not isinstance(job_id, int):
                send_response(req_id, False, error="job_id is required")
                return
            if not wait_key or body is None:
                send_response(req_id, False, error="wait_key and body are required")
                return
            # 不盲投（B6/孤儿信投递侧防线）：deliver_human_input 校验活跃+_bound
            out = jm.deliver_human_input(job_id, wait_key, body)
            if projector is not None:   # 幕布：[扣住的提问?, 人类台词行] 同拍
                try:
                    rows = projector.on_human_input(args_obj)
                    if rows:
                        _hub_feed(job_id, rows)
                except Exception as exc:
                    sys.stderr.write(f"femo_bridge: hub project failed: {exc}\n")
            send_response(req_id, True, out)
        elif cmd == "actor_failed":
            # 宿主执行体最终失败信号（B5）：子代理死亡/超时/API 预算耗尽——
            # 显式上报，引擎按「沉默收场」裁决（通知作者+节点按失败跳过），
            # 不再伪装空台词。投递校验与 human_input 同款（活跃+_bound，不盲投）；
            # 失败信封走同一 wait_key 信箱（{'__actor_failed__': True, kind, detail}）。
            job_id = args_obj.get("job_id")
            wait_key = str(args_obj.get("wait_key", "") or "")
            if not isinstance(job_id, int):
                send_response(req_id, False, error="job_id is required")
                return
            if not wait_key:
                send_response(req_id, False, error="wait_key is required")
                return
            out = jm.deliver_human_input(job_id, wait_key, {
                '__actor_failed__': True,
                'kind': str(args_obj.get("kind", "") or "executor_error"),
                'detail': str(args_obj.get("detail", "") or ""),
            })
            if projector is not None:   # 幕布：[扣住的 showprompt?, 失败行] 同拍
                try:
                    rows = projector.on_actor_failed(args_obj)
                    if rows:
                        _hub_feed(job_id, rows)
                except Exception as exc:
                    sys.stderr.write(f"femo_bridge: hub project failed: {exc}\n")
            send_response(req_id, True, out)
        elif cmd == "get_job_state":
            job_id = args_obj.get("job_id")
            if not isinstance(job_id, int):
                send_response(req_id, False, error="job_id is required")
                return
            # 摸到才对账（2026-09-07）：仅宿主显式带 reconcile_if_stale 才动手
            # （femoGen 打开 session 的唯一询问点，宿主只在 session 归属本宿主时
            # 才带）——缺省纯读，测试/别的进程零副作用。
            if args_obj.get("reconcile_if_stale"):
                jm.reconcile_stale(job_id)
            state = jm.get_job_state(job_id)
            # 恒 ok（2026-09-10）：档案 error 是查询的答案（failed 场次的档案
            # 数据），不是查询失败——译成协议错误会把宿主 session-state 整条
            # 毒倒（画布恢复全灭）。宿主按字段自判（state 缺失=no_such_job）。
            send_response(req_id, True, state)
        elif cmd == "shutdown":
            # 全场停止（2026-09-29 收编：停场收尾正身 settle_jobs——stop→join→
            # 等 suspended 落盘确认再回执；收编前本路只 join 不等账，回执可能
            # 先于落盘）。回执+exit：旧实现 stop 后 0.2s os._exit，取消传播+
            # 落盘是异步的，可能没写盘就死（§7.2 shutdown 修正）。
            settle_jobs(jm, workers, femo_api.bound_job_ids(), log_tag='shutdown stop')
            send_response(req_id, True, {"bye": True})
            # small delay so the response flushes before exit
            threading.Timer(0.2, os._exit, args=(0,)).start()
        else:
            send_response(req_id, False, error=f"unknown command: {cmd}")

    def dispatch(req_id, cmd, args_obj):
        """命令-结果契约（B5 死于结构）：JobError/JobBusyError 统一捕获映射——
        每个命令必须给明确答复 {ok:false, error:<code>, detail:<人话>}。"""
        _t0 = time.monotonic()
        # 【观测】命令入站留痕：与宿主的 tx/超时日志对表，即可分辨
        # 「命令没到桥」「桥处理慢」「响应写出后被吞」。
        _trace(f"rx cmd={cmd} id={req_id}")
        try:
            dispatch_inner(req_id, cmd, args_obj)
        except femo_api.JobBusyError as exc:
            # active_host_refs：活跃 Job 的归属字典原样上浮（多宿主联机排障）；
            # active_host_ref 单值保留（旧宿主文案兼容）。
            active = jm.active_job() if hasattr(jm, 'active_job') else None
            send_response(req_id, False, error=exc.code, detail=exc.detail,
                          extra={"active_job_id": exc.active_job_id,
                                 "active_host_ref": exc.active_host_ref,
                                 "active_host_refs": dict(getattr(active, 'host_refs', {}) or {})
                                 if active is not None else {}})
        except femo_api.JobError as exc:
            send_response(req_id, False, error=exc.code, detail=exc.detail)
        finally:
            _trace(f"done cmd={cmd} id={req_id} "
                   f"in {(time.monotonic() - _t0) * 1000:.1f}ms")
    # 搭台产物：装配态全量挂载（字段名=原 main() 局部名，只增不改）。
    return BridgeStage(
        dispatch=dispatch, dispatch_inner=dispatch_inner,
        jm=jm, workers=workers, runners=runners,
        hub=hub, host_name=host_name, projector=projector,
        dispatch_facts=dispatch_facts, final_payloads=final_payloads,
        make_event_callback=make_event_callback,
        spawn_job_worker=spawn_job_worker, run_compile=run_compile,
        _mailbox_post=_mailbox_post, _post_compile_warnings=_post_compile_warnings,
        _post_final_done=_post_final_done, _mailbox_poll_forever=_mailbox_poll_forever,
        _hub_feed=_hub_feed, _hub_cast=_hub_cast, _hub_display=_hub_display,
        _norm_host_refs=_norm_host_refs, _hub_owner=_hub_owner,
        _director_sid=_director_sid, _job_host=_job_host,
        _deliver_url=_deliver_url, _caller_host=_caller_host,
        args=args, femo_root=femo_root,
        mailbox=mailbox, mail_courier=mail_courier, projection_hub=projection_hub,
        push_url=push_url, emit=emit, send_response=send_response, _trace=_trace)


def main():
    # Windows consoles default to GBK; Femo's own prints carry emoji and
    # would crash, and our JSON protocol carries UTF-8 Chinese text. Force
    # UTF-8 on all three streams before importing Femo.
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="Femo stdio JSON-RPC bridge")
    parser.add_argument("--fe4m", default=None, help="Femo project root (default: $FEMO_ROOT)")
    parser.add_argument("--db", default=None,
                        help="Ledger DB override; default: user_dir/user_data/memory/Chronica.wor")
    parser.add_argument("--host-manifest", default=None,
                        help="宿主能力清单 JSON（thinking 档位/默认用户等 harness 词汇）；"
                             "缺省回读 $FEMO_HOST_MANIFEST，再缺省用引擎内置缺省")
    parser.add_argument("--host-name", default=None,
                        help="投影自称（多实例 dsh-<port>）；缺省回落清单 host 字段")
    parser.add_argument("--host", default=None,
                        help="宿主标签（驿站 target_host/host_refs 键，=信箱 id）："
                             "dsh-<port>/zcode/autoclaw/…——宿主身份契约必传项")
    args = parser.parse_args()
    if not args.host:
        # 身份契约（2026-09-24 A4）：缺省回落只作旧启动器兼容，必须响亮——
        # 静默借 'dsh' 的名字会蹭到 dsh 的信箱信与归属键（双桥抢信同源病）。
        args.host = 'dsh'
        sys.stderr.write("femo_bridge: --host not passed; falling back to 'dsh' label "
                         "(every host must pass --host explicitly)\n")

    femo_root = args.fe4m or resolve_femo_root()
    if not femo_root:
        sys.stderr.write("femo_bridge: FEMO_ROOT/--fe4m must point at the Femo project\n")
        sys.exit(2)
    sys.path.insert(0, femo_root)

    # ── 增量C 壳的环境接力：常驻引擎（daemon）代拉时经 env 继承账本与根 ──
    # --db/--fe4m 是壳的启动参数，daemon 进程看不到；落成环境变量随 spawn 走
    # （_spawn_daemon 的 Popen 继承本进程 env）。
    if args.db:
        os.environ['FEMO_DB_PATH'] = os.path.abspath(args.db)
    if args.fe4m:
        os.environ['FEMO_ROOT'] = femo_root

    # 引擎门面（本地命令用）：账本指向 + 建表种子（幂等）。引擎本体不住壳——
    # 本地面只读盘面/查库/编译检查，运行态与产信全在常驻引擎。
    global femo_api   # ensure_default_data（模块级）也要用——勿改回局部绑定
    from femo2host import femo_api
    if args.db:
        femo_api.set_db_path(os.path.abspath(args.db))
    os.chdir(femo_root)  # keep parse_script's debug file out of the harness cwd
    ensure_default_data()

    try:
        from femo2host import mail_courier   # 投递员上门地址解析（门铃代登记用）
    except Exception as _exc:
        mail_courier = None
        sys.stderr.write(f"femo_bridge: mail_courier unavailable: {_exc}\n")
    try:
        from femo2host import projection_hub   # HubClient：发现/代拉常驻引擎
    except Exception as _exc:
        projection_hub = None
        sys.stderr.write(f"femo_bridge: projection_hub unavailable: {_exc}\n")

    # 上门地址（门铃）：壳的 FEMO_PUSH_PORT 只有壳知道——代登记给常驻引擎的
    # 投递员（复审缺口③），心跳续期，TTL 过期留柜自取。
    push_url = mail_courier.push_url_from_env() if mail_courier else ''
    sys.stdout.write(f"femo_bridge: courier push_url={push_url or '(pickup mode)'} host={args.host}\n")
    sys.stdout.flush()

    # 撕裂根治（2026-09-24）：fd1 的全部写入者共用一把可重入锁——emit 的
    # os.write、转播线程的 emit、缓冲的 8KB 自动 flush 全部在锁内序化。
    out_lock = threading.RLock()

    class _LineLockedStdout:
        """print 与协议帧共用 fd1 的行级单写包装（撕裂根治，见刀0 前史）。"""

        _SOFT_LIMIT = 8192

        def __init__(self, stream, lock):
            self._stream = stream
            self._lock = lock
            self._parts = []
            self._size = 0

        def write(self, s):
            with self._lock:
                self._parts.append(s)
                self._size += len(s)
                if self._size >= self._SOFT_LIMIT or '\n' in s:
                    blob = ''.join(self._parts)
                    self._parts.clear()
                    self._size = 0
                    self._stream.write(blob)
                    self._stream.flush()
            return len(s)

        def flush(self):
            with self._lock:
                if self._parts:
                    self._stream.write(''.join(self._parts))
                    self._parts.clear()
                    self._size = 0
                self._stream.flush()

        def __getattr__(self, name):
            return getattr(self._stream, name)

    sys.stdout = _LineLockedStdout(sys.stdout, out_lock)

    # 【观测插桩】一律走 stderr——stdout 是 NDJSON 协议通道（TORN_LINE 前科）。
    _trace_on = os.environ.get("FEMO_BRIDGE_TRACE", "1").strip().lower() \
        not in ("0", "false", "off", "no", "")

    def _trace(msg):
        if not _trace_on:
            return
        try:
            sys.stderr.write(f"femo_bridge[trace]: {msg}\n")
            sys.stderr.flush()
        except Exception:
            pass

    def emit(obj):
        payload = json.dumps(obj, ensure_ascii=False)
        with out_lock:
            # 协议行绝不过 sys.stdout 缓冲层（j2477/j2478 断戏根因修复，前史见
            # build_stage 同名注释）；fd 单发一帧一系统调用。
            data = (payload + "\n").encode("utf-8")
            view = memoryview(data)
            while view:
                written = os.write(1, view)
                if written <= 0:
                    raise OSError("bridge stdout short write")
                view = view[written:]
            try:
                sys.stdout.flush()
            except Exception:
                pass
        try:
            _trace(f"tx type={obj.get('type')} id={obj.get('id')} "
                   f"event={obj.get('event') or '-'} len={len(payload)}")
        except Exception:
            pass

    def send_response(req_id, ok, result=None, error=None, detail=None, extra=None):
        payload = {"type": "response", "id": req_id, "ok": ok}
        if ok:
            payload["result"] = result
        else:
            payload["error"] = error
            if detail:
                payload["detail"] = detail
            if extra:
                payload.update(extra)
        emit(payload)

    # ── 宿主能力清单：本地编译检查同词汇（应用一次，转发时随 job_start 带给
    # 常驻引擎按场应用——增量C 起清单词汇跟戏走，不再是壳进程的全局词）。
    manifest_path = args.host_manifest or os.environ.get("FEMO_HOST_MANIFEST", "")
    if manifest_path:
        if os.path.isfile(manifest_path):
            try:
                notes, manifest_err = femo_api.apply_host_manifest_file(manifest_path)
                if manifest_err is not None:
                    print(f"[bridge] 宿主清单未应用：{manifest_err}（用引擎内置缺省词汇）")
                else:
                    print("[bridge] 宿主清单已应用：" + ("；".join(notes) if notes else "（空清单，保持现状）"))
            except Exception as exc:
                sys.stderr.write(f"femo_bridge: manifest apply failed: {exc}\n")
        else:
            sys.stderr.write(f"femo_bridge: host manifest not found: {manifest_path}\n")
            manifest_path = ""

    # ── 发现常驻引擎（hub.json 一本账）：活=复用；死/无=代拉（脱离母进程）────
    # 【增量C 补刀】地址住 _base_holder：常驻引擎中途死亡时，转发失败触发
    # 惰性重发现+代拉（看门纪律「任何客户端惰性探活，死了顺手代拉」的壳侧
    # 落点），转播/门铃循环每轮取当前地址——壳进程活着就能跟着引擎换家。
    hub_name = ''
    try:
        hub_name = str(femo_api.host_name() or '')
    except Exception:
        hub_name = ''
    if getattr(args, 'host_name', None):
        hub_name = str(args.host_name)
    _base_holder = {'base': ''}
    _base_lock = threading.Lock()
    _rediscover_lock = threading.Lock()

    def _wait_engine_ready(base):
        """引擎面就绪等待：轮询 /engine/health 直到引擎装配完（daemon 冷启含
        引擎装配，数秒窗——hub 先活、引擎面后挂，实测踩过赛跑）。装配中=
        engine:false 继续等；404=旧版 v0 daemon（无引擎面）——拒绝裸奔。"""
        _deadline = time.time() + 120
        while time.time() < _deadline:
            try:
                with urllib.request.urlopen(base + '/engine/health', timeout=5) as resp:
                    _h = json.load(resp)
                if _h.get('engine'):
                    return
                _trace(f"engine assembling ({_h.get('stage')}) — wait")
            except urllib.error.HTTPError as exc:
                raise RuntimeError(
                    '常驻引擎缺引擎面（旧版 v0 daemon，HTTP %d）——'
                    '运维：杀旧 femo_daemon，下一座壳代拉新版。' % exc.code)
            except Exception:
                pass                       # 网络抖动：继续等
            time.sleep(0.5)
        raise RuntimeError('常驻引擎 120s 内未就绪')

    def _discover():
        """探 hub.json → 活=复用；死/无=代拉。返回引擎 base（响亮留痕）。"""
        client = projection_hub.HubClient()
        _reg_name = client.connect(hub_name)
        _base = 'http://127.0.0.1:%d' % client.port
        sys.stderr.write('femo_bridge: [hub-unify] 复用模式：常驻引擎（hub+引擎同进程）'
                         ' %s——壳不自起、不喂引擎：命令转发/事件转播/门铃代登记三件事。\n'
                         % _base)
        sys.stdout.write(f"femo_bridge: projection hub reuse {_base}/"
                         f" (host={_reg_name or args.host})\n")
        sys.stdout.flush()
        return _base

    def _rediscover():
        """惰性重发现（引擎死后恢复）：加锁防转发方与转播方并发双拉——
        竞态孪生由 daemon 自裁兜底，锁只是省一次冷启。成功更新共享地址。"""
        with _rediscover_lock:
            with _base_lock:
                _current = _base_holder['base']
            try:
                _base = _discover()
                _wait_engine_ready(_base)
            except Exception as exc:
                sys.stderr.write(f"femo_bridge: rediscover failed: {exc}\n")
                raise
            with _base_lock:
                _base_holder['base'] = _base
            sys.stderr.write('femo_bridge: [hub-unify] 常驻引擎重发现成功 %s'
                             '（旧地址 %s）——转发/转播/门铃已随新家。\n'
                             % (_base, _current or '?'))
            return _base

    daemon_base = ''
    if projection_hub is not None:
        try:
            daemon_base = _discover()
            _wait_engine_ready(daemon_base)
            _base_holder['base'] = daemon_base
        except SystemExit:
            raise
        except Exception as exc:
            sys.stderr.write(f"femo_bridge: daemon discovery failed: {exc}\n"
                             "femo_bridge: 壳拒绝裸奔，退出（exit 2）。\n")
            sys.exit(2)
    if not _base_holder['base']:
        sys.stderr.write('femo_bridge: 常驻引擎不可用（发现失败）——'
                         '壳拒绝裸奔，退出（exit 2）。\n')
        sys.exit(2)

    # ── 壳三件事②：事件转播——订阅常驻引擎 SSE，stdio 原样再播 ─────────────
    # 直播导体（since=极大=不重放）：历史归 hub 冷唤醒，壳重播旧帧会让宿主
    # 记账吃两遍（与旧桥「事件只在壳活着时流动」的形态一致）。断流 1s 重连。
    def _relay_loop():
        while True:
            with _base_lock:
                _base = _base_holder['base']
            _sse = (_base + '/engine/events?host='
                    + urllib.parse.quote(str(args.host)) + '&since=1000000000')
            try:
                with urllib.request.urlopen(_sse, timeout=None) as resp:
                    for raw in resp:
                        line = raw.decode('utf-8', 'replace').strip()
                        if not line.startswith('data: '):
                            continue
                        try:
                            env = json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue
                        if env.get('replay'):
                            continue
                        emit(env)          # stdio 事件信封原样（适配器冻结的前提）
            except Exception as exc:
                _trace(f"sse relay down: {exc} — rediscover & reconnect in 1s")
                try:
                    _rediscover()          # 引擎死了：壳跟着换家（惰性代拉）
                except Exception:
                    pass
            time.sleep(1)
    threading.Thread(target=_relay_loop, daemon=True, name='sse-relay').start()

    # ── 壳三件事③：门铃代登记——登记+10s 心跳续期（TTL 30s，过期留柜自取）──
    if push_url and mail_courier:
        def _doorbell_loop():
            while True:
                with _base_lock:
                    _base = _base_holder['base']
                try:
                    _req = urllib.request.Request(
                        _base + '/engine/doorbell',
                        data=json.dumps({'host': args.host, 'url': push_url}).encode('utf-8'),
                        headers={'Content-Type': 'application/json'}, method='POST')
                    urllib.request.urlopen(_req, timeout=5).read()
                except Exception as exc:
                    _trace(f"doorbell register failed: {exc}")
                time.sleep(10)
        threading.Thread(target=_doorbell_loop, daemon=True, name='doorbell').start()

    # ── 命令路由（清单§七三分类=转发壳路由表，照抄不重新发明）────────────────
    # 转发=碰引擎内存态/只读内存/只碰信柜（运行态与信柜管家都在常驻引擎）；
    # get_job_state/attach_host_refs 一并转发：lazy 对账与归属合并都动档案
    # 现态，权威在常驻引擎的 JobManager（214 事故：跨进程对账会误杀活戏）。
    # 本地=ping/check（纯本地）、list_scripts/list_jobs/get_soul/list_souls
    # （只读盘面）、create_soul（本地有状态不碰引擎）。干跑沙盒/编译检查
    # 结构性留本地：常驻引擎死了，编译检查也得活着（清单§五）。
    _FORWARD = frozenset({'job_start', 'job_resume', 'job_pause', 'job_restart',
                          'human_input',
                          'actor_failed', 'shutdown', 'mail_context', 'mail_catchup',
                          'post_speech', 'collect_notices', 'mailbox_post',
                          'get_job_state', 'attach_host_refs'})

    jm = femo_api.get_job_manager()   # 本地只读面（list_jobs 读档案目录）

    def dispatch_local(req_id, cmd, args_obj):
        # 七条本地命令正身单源 dispatch_local_queries（2026-09-29 收编：与装配
        # 段 dispatch_inner 同吃一份，此前两份逐字同构各抄一遍）；其余命令全走
        # daemon 转发（dispatch 的 _FORWARD 路），到不了这里。
        if not dispatch_local_queries(cmd, req_id, args_obj, femo_api=femo_api,
                                      femo_root=femo_root, jm=jm,
                                      send_response=send_response):
            send_response(req_id, False, error=f"unknown command: {cmd}")

    def dispatch(req_id, cmd, args_obj):
        """命令-结果契约（B5 死于结构）：转发丢回应答信封原样；本地自答。"""
        _t0 = time.monotonic()
        _trace(f"rx cmd={cmd} id={req_id}")
        try:
            if cmd in _FORWARD:
                _fwd_args = dict(args_obj) if isinstance(args_obj, dict) else {}
                # 调用方身份随命令走（daemon 记账用调用方的格，不是占位自称）
                _fwd_args['_caller_host'] = args.host
                if cmd in ('job_start', 'job_resume') and manifest_path:
                    # 清单词汇跟戏走（daemon 开跑前按场应用）
                    _fwd_args['_host_manifest'] = os.path.abspath(manifest_path)
                with _base_lock:
                    _cur_base = _base_holder['base']
                _req = urllib.request.Request(
                    _cur_base + '/cmd/' + cmd,
                    data=json.dumps({'id': req_id, 'cmd': cmd,
                                     'args': _fwd_args}).encode('utf-8'),
                    headers={'Content-Type': 'application/json'}, method='POST')
                def _forward_once():
                    with urllib.request.urlopen(_req, timeout=120) as resp:
                        return json.load(resp)
                try:
                    out = _forward_once()
                except Exception as _exc1:
                    # 连接类失败=常驻引擎可能死了：惰性重发现+代拉（看门纪律）
                    # 后重试一次；再失败才诚实报错。业务错误（HTTP 200 的
                    # ok:false 信封）不会走这里——不会重复 job_start。
                    try:
                        _rediscover()
                        with _base_lock:
                            _new_base = _base_holder['base']
                        _req2 = urllib.request.Request(
                            _new_base + '/cmd/' + cmd,
                            data=json.dumps({'id': req_id, 'cmd': cmd,
                                             'args': _fwd_args}).encode('utf-8'),
                            headers={'Content-Type': 'application/json'}, method='POST')
                        with urllib.request.urlopen(_req2, timeout=120) as resp:
                            out = json.load(resp)
                        _trace(f"forward recovered after rediscover ({_exc1})")
                    except Exception as _exc2:
                        send_response(req_id, False, error='daemon_unreachable',
                                      detail=f'常驻引擎不可达（已尝试代拉）：{_exc2}')
                        return
                emit(out)              # stdio response 信封原样（同一命令契约）
                if cmd == 'shutdown' and out.get('ok'):
                    # 旧语义保留：本壳退场（daemon 已按宿主限定停戏并继续站岗）
                    threading.Timer(0.2, os._exit, args=(0,)).start()
            else:
                dispatch_local(req_id, cmd, args_obj)
        except femo_api.JobBusyError as exc:
            # 本地命令不产 JobBusyError；保底同旧映射（防御外层）
            send_response(req_id, False, error=exc.code, detail=exc.detail,
                          extra={"active_job_id": exc.active_job_id,
                                 "active_host_ref": exc.active_host_ref})
        except femo_api.JobError as exc:
            send_response(req_id, False, error=exc.code, detail=exc.detail)
        finally:
            _trace(f"done cmd={cmd} id={req_id} "
                   f"in {(time.monotonic() - _t0) * 1000:.1f}ms")

    # ── stdin loop ─────────────────────────────────────────────────────────
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            emit({"type": "response", "id": None, "ok": False, "error": "invalid json"})
            continue
        req_id = req.get("id")
        cmd = req.get("cmd", "")
        args_obj = req.get("args") or {}
        try:
            dispatch(req_id, cmd, args_obj)
        except Exception as exc:
            traceback.print_exc(file=sys.stderr)
            send_response(req_id, False, error=str(exc))

if __name__ == "__main__":
    main()
