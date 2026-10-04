/**
 * actors/dispatch.ts — 唯一派工体（2026-09-26 刀⑥自 engine-events.ts 迁出，纯搬家）。
 *
 * 「轮到谁参与」的宿主侧动作，两条路各一份、防漂移：
 *  - dispatchActorTurn：轮到 AI 角色 → 派发常驻执行体（同 actor 复用同一子代理）。
 *    驿站投递员上门（mailbox-push 按 soul 收件）与事件侧共用这一个入口。
 *  - applyHumanWait：轮到人类 → 开席（waitingHuman 快照 + 投影状态广播 + human 租约）。
 *    投递员上门（mailbox-push「显示给人类看」分流）与事件兜底两处共用。
 * 随迁两件快照广播小件（projectionStateOf/broadcastProjectionState）：applyHumanWait
 * 的直接依赖，正文只是公共层翻译 + SSE 广播；留在 engine-events 会让本文件反向
 * import 事件调度成环（刀③刚解完环，不许再系上）。
 * 消费方：mailbox-push 经 engine-events 转口零改动；run-control/bridge-supervisor/
 * routes 三处快照广播消费同享转口。JobMirror/RunState 类型仍住 engine-events
 * （type-only import，编译期擦除，无运行时环）。
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, Session } from '@deepseek-ai/dsh-session'
import type { FemoBridge } from '../bridge'
import { sendActorFailure } from '../bridge'
import type { ResolvedConfig } from '../config'
import { broadcastSse } from '../http'
import type { ProjectionRegistry } from '../projection/projection'
import { pushDiag } from '../diag/diag-feed'
import type { NodeRetryBroker } from '../node-retry'
import { runAiSubagentNative } from './native/index'
import * as runStateCore from '../../../../femo2host/host/run-state-core.mjs'
import { waitingHumanFromEvent } from '../../../../femo2host/host/run-state-core.mjs'
import type { JobMirror, RunState } from '../events/engine-events'

/** 投影窗 composer 按钮状态的权威快照（2026-09-06 猫猫拍板：各投影窗发送/
 * 停止钮与主模型发言状态解耦，按「窗型×FEMO脚本态」统一控制）。
 * 语义：running=本会话 Job 是引擎活跃 Job 且 running；waiting=running 且
 * human 节点等输入；waitScope=等待节点 scope 的原始角色名列表（判定哪个
 * 角色窗是人类窗——AI 角色不会出现在 human 节点 scope，天然区分）。 */
export interface ProjectionRunState {
  running: boolean
  waiting: boolean
  waitScope: string[]
  /** 轮到人类节点时的提示全文（composer 内嵌等待横幅的数据源；非等待缺省）。 */
  prompt?: string
  /** 等待人类节点声明的 out 变量名列表（composer 变量赋值浮层的数据源；
   *  dynamic out 为 `变量名.@actor` 完整形式，human_wait 事件自带；非等待为 []）。 */
  outVars: string[]
}

export function projectionStateOf(runState: RunState, mainSid: string): ProjectionRunState {
  return runStateCore.projectionStateOf(runState, mainSid) as ProjectionRunState
}

/** 快照广播（SSE projection_state，信封 sid=主会话）：waitingHuman 变化与
 * Job 终态/清账时调用——前端 composer 打开时拉 projection-state 接口建基线，
 * 此后按本事件增量覆盖（快照语义无竞态）。 */
export function broadcastProjectionState(runState: RunState, mainSid: string): void {
  broadcastSse('projection_state', { sid: mainSid, ...projectionStateOf(runState, mainSid) })
}

/** 角色节点派工（非 main 的 AI 回合，2026-09-17 从 ai_request 事件分支抽出）：
 *  派发到常驻执行体（同 actor 复用同一子代理；本函数即「steer 到该角色子代理
 *  窗口」的入口）。驿站投递员上门（mailbox-push 按 soul 收件）与事件侧共用
 *  ——派工体只有这一份，防漂移。旧 one-shot 分流已随已退役文件删除
 *  （2026-09-25，meow fork 旧版宿主整体下线）。 */
export function dispatchActorTurn(
  ctx: Context,
  resolved: ResolvedConfig,
  bridge: FemoBridge,
  session: Session,
  request: Record<string, unknown>,
  recordError: (sessionId: SessionId, text: string) => void,
  defaultModel: { currentSelection(): unknown } | undefined,
  mirror: JobMirror,
  projections: ProjectionRegistry,
  jobId: number,
): void {
  const reqNode = typeof request.node_name === 'string' ? request.node_name : undefined
  const reqScope = Array.isArray(request.scope_info)
    ? request.scope_info.filter((x): x is string => typeof x === 'string')
    : undefined
  if (reqNode !== undefined && reqScope !== undefined) {
    mirror.nodeScopes.set(reqNode, reqScope)
  }
  // 【2026-09-25 旧版分流退役】同 actor 复用同一常驻子代理
  // （startContinuable/sendMessage），子代理窗口=角色视角投影窗，不隐藏不归档。
  // 旧 one-shot 每节点新子代理路径已随「已退役-subagent」一并退役（改名探针
  // 静置无报错=无未知引用；双端线上均为原生构建）。
  void runAiSubagentNative(ctx, resolved, bridge, session, request, recordError, defaultModel, mirror.nodeActors, projections, mirror.nodeShowprompts, jobId).catch((error: unknown) => {
    recordError(session.id, `子 agent 执行失败：${String(error)}`)
    void sendActorFailure(bridge, jobId, String(request.wait_key ?? ''), 'dispatch_error', String(error)).catch(() => undefined)
  })
}

/** 人类节点等待登记（2026-09-17 从 human_wait 事件分支抽出）：写 waitingHuman
 *  快照 + 广播投影状态 + 🎭 等待行 + human 租约。投递员上门（mailbox-push 收
 *  信后「显示给人类看」的分流就在这里，非 steer 子代理）与事件兜底两处共用
 *  ——与 AI 拍同一封信同一驿站，只是宿主收信后的呈现不同。 */
export function applyHumanWait(
  ctx: Context,
  runState: RunState,
  session: Session,
  projections: ProjectionRegistry,
  broker: NodeRetryBroker | undefined,
  mirror: JobMirror,
  d: Record<string, unknown>,
): void {
  const sessionId = String(session.id)
  const jobId = mirror.jobId ?? -1
  // 【诊断 2026-09-06】上帝窗人类发言 kept local（waiting=false）排查：
  // 此前本 case 零日志——信号是否到达宿主、登记是否发生完全不可观测。
  // 到达日志（引擎发信号→宿主 case 执行的实证）+登记后快照。
  console.log(`[femo-plugin] human_wait received: job=${jobId} node=${String(d.node_name ?? '-')} wait_key=${String(d.wait_key ?? '-')} -> waitingHuman SET`)
  pushDiag('human_wait', `SET job=${jobId} node=${String(d.node_name ?? '-')} wait_key=${String(d.wait_key ?? '-')}`)
  // 写本 mirror 的 waitingHuman（B6：suspended 转移强制清——
  // jobMirrorSetState 不清 waitingHuman，此处终态 case 统一清）。
  // 2026-09-06 起带全量字段：/session-state 据此给刷新后的画布恢复
  // 人类输入气泡（不依赖 SSE 重放环是否还被覆盖）。
  // 【2026-09-08 修复】scope 现场冻结：human_wait 事件自带本分支现场算
  // 出的 scope（引擎 _exec_human 发事件前刚求值，且保证含执行者本人），
  // 存入等待快照作按钮/等待行的权威源——不再事后查 nodeScopes（par 并发
  // 下同名节点互相覆盖，人类分支的 scope 会被 AI 分支冲掉）。
  // 【2026-09-24 B1】事件→快照翻译收公共层 run-state-core（与 event-core
  // 同一函数出料，翻译逻辑单份）。
  const waitScope: string[] | undefined = Array.isArray(d.scope)
    ? d.scope.filter((x): x is string => typeof x === 'string')
    : undefined
  mirror.waitingHuman = waitingHumanFromEvent(d)
  // 快照广播必须在 SET 之后——先广播会把 waiting=false 发给前端
  // （composer 按钮不亮，切窗重挂 fetch 才纠正，2026-09-06 实测）。
  broadcastProjectionState(runState, sessionId)
  // prompt 全文显示（2026-09-06 猫猫拍板：提示信息有多长放多长，
  // 不截断；引擎侧 human_wait 事件本就带全文）。
  const prompt = typeof d.prompt === 'string' ? d.prompt : ''
  const nodeName = typeof d.node_name === 'string' ? d.node_name : undefined
  // 等待行可见性与按钮同源（冻结快照优先；缺快照回退查表）。
  // 【2026-09-20 大扫除】等待行/重试行的投影窗写入已删（内容由 hub 侧
  // prompt 槽/retry 槽承担）；waitLineScope 仍喂人类租约。
  const waitLineScope = waitScope ?? (nodeName === undefined ? undefined : mirror.nodeScopes.get(nodeName))
  // human 租约登记（v4 §8.1/§5.3）：node_retry(target='human') 的提醒
  // 经此租约显示到投影窗——人类输入的地方就在那里，显示即翻译（引擎在
  // 自己的人类重等循环里等重输，宿主零额外机制）。scope 取 node_start
  // 已存的 nodeScopes（v4 §8.5）。引擎重等输入不重发 human_wait，本
  // register 恰好一次（幂等再保险）。登记带 job_id（§9.3 ParkerSpec）。
  broker?.register({
    waitKey: String(d.wait_key ?? ''),
    nodeName: nodeName ?? '',
    kind: 'human',
    jobId,
    mainSessionId: sessionId,
    // 重试提醒显示归 hub retry 槽（桥 node_retry 事件落账）；租约仍要
    // 登记（broker 裁决面），steer 显示体只剩空操作。
    steer: (_text) => { /* 旧链路投影窗 ⚠️ 行已退役（2026-09-20 大扫除） */ },
  })
}
