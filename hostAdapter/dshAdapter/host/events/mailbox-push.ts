/**
 * mailbox-push.ts — 驿站投递员的上门收件口（who_move=system_push 的 dsh 端）。
 *
 * 2026-09-16 上门投递落地：驿站投递员 mail_courier（今随常驻引擎）在产信现场
 * 把信直推进本接收口（先投后发事件——时序契约见 mail_courier.py 文件头）。收件即办、回执即账：
 *  · main 料包信（kind=context + brief 面单）→ 登记节点视野 →
 *    runMainModelTurn 拼词参与（交付队列等机制照旧）；
 *  · 角色料包信（2026-09-17 对齐主模型，soul=该角色）→ dispatchActorTurn
 *    steer 到对应子代理窗口（soul↔子代理的对应由派工函数内的常驻执行体
 *    注册表承担）；
 *  · 人类等待信（2026-09-17，无 source 的 context 信）→ applyHumanWait 显示
 *    给人类看（投影窗等待；与 AI 拍同一封信，呈现不同）；
 *  · 终局整包（notice 信 + outcome）→ 公共拼词（notice-core）→ steerMainAgent
 *    直达主模型对话流。
 *  · 启动运行/续跑信（2026-09-23 十连裁④，notice 信 subkind=play_start）→
 *    steerMainAgent 直达主模型（画布点启动运行/断点续跑时 main 知情）。
 *  · 人类插话信（2026-09-23 十连裁⑨，notice 信 subkind=user_interjection +
 *    extra.interjection.mainSid）→ followupMain 以真人消息直达主模型
 *    （source=user 渲染气泡；桥侧投递失败即死信，宿主已降级直推）。
 *  · 重试牌信（2026-09-23 十连裁③，notice 信 subkind=node_retry +
 *    extra.retry 面单）→ broker.deliverRetry 按 wait_key 交停靠经纪人
 *    （信是唯一传话通道，事件侧已停消费）。
 * 【2026-09-23 十连裁②⑩ 单通道】查簿兜底已废：push 是唯一通道，一次产信恰
 * 一次投递，事件侧纯记账；送失的信由投递员重投（mail_courier.retry_pending，
 * mailbox.pending_urgent 年龄门槛防产信窗口双投）——邮差扑空修邮差。
 *
 * 物理形态：femo-plugin 自管的迷你监听器（127.0.0.1，FEMO_PUSH_PORT 缺省
 * 3895 起顺延扫描——dsh webServer 端口插件侧拿不到，自管监听器端口确定）。
 * 2026-09-26 常驻化换形：不再 spawn 桥、无 FEMO_PUSH_PORT env 注入——端口经
 * bridge.pushUrl 交 daemon-client 门铃心跳上报，常驻引擎产信按门铃地址直投
 * 本口。只服务本机数据根的常驻引擎，与 zcode gateway 同级信任。
 * 2026-09-27 归位 events/（驿站收件口按信分流属调度族——守则 events/ 章节原文）。
 */

import type { Context } from '@deepseek-ai/cordis'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
import type { FemoBridge } from '../bridge'
import { sendActorFailure } from '../bridge'
import type { ResolvedConfig } from '../config'
import { readBody, writeJson } from '../http'
import type { JobMirror, RunState } from './engine-events'
import { followupMain, steerMainAgent, dispatchActorTurn, applyHumanWait, jobMirrorPrearm } from './engine-events'
import { broker } from '../node-retry'
import type { ProjectionRegistry } from '../projection/projection'
import { runMainModelTurn, noteMainActor } from '../main-actor'
import { formatStopNotice, type NoticeLetter } from '../../../../femo2host/host/notice-core.mjs'
import { decidePush } from '../../../../femo2host/host/mailbox-push-core.mjs'
import { putJobCastEntry, readJobCast } from '../../../../femo2host/host/cast-core.mjs'
import { hostAddr } from '../hub/hub-feed'   // 宿主自称（cast 账的宿主分格键）
import { actorNameOf, soulIdentityOf } from '../actor-name'   // 执行者名/灵魂身份的唯一取值口
import { ensureSessionLive } from '../run-control'            // 官方路径拉活（agents.resume 冷装载）

export interface MailboxPushDeps {
  resolved: ResolvedConfig
  bridge: FemoBridge
  runState: RunState
  projections: ProjectionRegistry
  sessionsStore?: { get(id: SessionId): Session | undefined }
  /** 角色派工（dispatchActorTurn）要吃的默认模型选择器（index 总装现成）。 */
  defaultModel?: { currentSelection(): unknown }
  recordError(sessionId: SessionId, text: string): void
}

/** 座位窗口确保开着：store 里有就直接用；没有按官方路径拉活（agents.resume
 *  冷装载，projection-input 同款），返回活会话，失败 undefined。跨宿主收编块
 *  与 brief-actor 本尊分支的同构段收拢于此（2026-09-29）。 */
async function ensureSeatLive(
  ctx: Context,
  sessionsStore: MailboxPushDeps['sessionsStore'],
  sid: string,
  logTag: string,
): Promise<Session | undefined> {
  const existing = sessionsStore?.get(SessionId(sid))
  if (existing !== undefined) return existing
  const hydrated = await ensureSessionLive(ctx, SessionId(sid), 'mailbox-push', sessionsStore)
  console.log(`[femo-plugin] mailbox-push: seat 拉活 (${logTag}) sid=…${sid.slice(-12)} => ${hydrated !== undefined ? '成功' : '失败'}`)
  return hydrated
}

/** 本尊出演收口：brief-main 与 brief-actor 绑定分支的公共尾段（2026-09-29
 *  收拢——两段二十行逐字孪生，只差 sid/soul/错误词，改一处漏一处的温床）。
 *  登记节点视野 → 记主演 → 选角账登记（幂等覆盖，账面随时反映真实现状）→
 *  runMainModelTurn（交付队列照旧；单通道无簿，失败响亮上报交引擎）。 */
function runTurnOnSession(
  ctx: Context,
  resolved: ResolvedConfig,
  bridge: FemoBridge,
  projections: ProjectionRegistry,
  recordError: (sessionId: SessionId, text: string) => void,
  opts: {
    session: Session
    brief: Record<string, unknown>
    mirror: JobMirror
    jobId: number
    ref: string
    soul: string
    sid: string
    errorCode: string
    errorPrefix: string
  },
): void {
  const { session, brief, mirror, jobId, ref, soul, sid, errorCode, errorPrefix } = opts
  const nodeName = typeof brief.node_name === 'string' ? brief.node_name : undefined
  const scopeInfo = Array.isArray(brief.scope_info)
    ? brief.scope_info.filter((x): x is string => typeof x === 'string')
    : undefined
  if (nodeName !== undefined && scopeInfo !== undefined) mirror.nodeScopes.set(nodeName, scopeInfo)
  noteMainActor(sid, actorNameOf(brief))
  void putJobCastEntry(resolved.femoRoot, jobId, soul, sid, hostAddr())
    .catch((error: unknown) => { console.log(`[femo-plugin] cast 登记 ${soul} 失败 (job=${jobId}): ${String(error)}`) })
  void runMainModelTurn(ctx, resolved, bridge, session, brief, recordError, projections, mirror.nodeScopes, mirror.nodeShowprompts, jobId)
    .catch((error: unknown) => {
      recordError(session.id, `${errorPrefix}：${String(error)}`)
      void sendActorFailure(bridge, jobId, ref, errorCode, String(error)).catch(() => undefined)
    })
}

/** POST /femo-plugin/mailbox-push 的收件处理（先登记簿后回执——回执即账）。
 *  【2026-09-24 A3】分拣裁决收公共层 mailbox-push-core.decidePush（纯函数：
 *  终局整包/开跑通知/重试牌/人类插话/料包三路分流的判定与校验唯一在那边）；
 *  本文件只剩宿主插座：查镜像/会话 store（宿主态）+ 调本宿主动词。 */
async function handlePush(ctx: Context, deps: MailboxPushDeps, body: Record<string, unknown>): Promise<void> {
  const { resolved, bridge, runState, projections, sessionsStore, defaultModel, recordError } = deps
  const d = decidePush(body)

  switch (d.kind) {
    // ── 终局整包（bridge 侧 extra 带 outcome）→ 公共拼词 → steer 主模型 ──
    case 'stop-invalid': {
      console.log(`[femo-plugin] mailbox-push: bad stop pack (outcome=${d.outcome}, jobId=${String(d.jobId)})`)
      return
    }
    case 'stop': {
      // 回执即账（单通道无簿）：终局信由桥产信+投递员整包直推，此处只开嗓。
      const mirror = runState.jobs.get(d.jobId)
      if (mirror === undefined) {
        console.log(`[femo-plugin] mailbox-push: stop pack for unknown job ${d.jobId} (letters dropped)`)
        return
      }
      steerMainAgent(ctx, mirror.ownerSid, formatStopNotice({
        jobId: d.jobId, outcome: d.outcome, ...(d.detail !== undefined ? { detail: d.detail } : {}), letters: d.letters as NoticeLetter[],
      }))
      return
    }

    // ── 启动运行/续跑信（十连裁④）：收信即 steer 通知全文，一次启动运行恰一封 ──
    case 'play-start': {
      const mirror = d.jobId === undefined ? undefined : runState.jobs.get(d.jobId)
      if (mirror === undefined) {
        console.log(`[femo-plugin] mailbox-push: play_start letter without mirror (job=${String(d.jobId)})`)
        return
      }
      steerMainAgent(ctx, mirror.ownerSid, d.text)
      return
    }

    // ── 重试牌信（十连裁③）：按 wait_key 交停靠经纪人（信是唯一传话通道）──
    case 'retry-invalid': {
      console.log('[femo-plugin] mailbox-push: node_retry without wait_key (dropped)')
      return
    }
    case 'node-retry': {
      broker.deliverRetry(d.waitKey, d.feedback, d.attempt, d.actorName)
      return
    }

    // ── 人类插话信（十连裁⑨）：source=user 真人消息直达主模型 ──────────
    case 'interjection-invalid': {
      console.log('[femo-plugin] mailbox-push: user interjection without mainSid (dropped)')
      return
    }
    case 'interjection': {
      followupMain(ctx, d.mainSid, d.text)
      return
    }

    // ── 料包信三路（【十连裁② 单通道】无簿无兜底：一封信一次投递）──────
    case 'brief-invalid': {
      console.log('[femo-plugin] mailbox-push: brief without wait_key (dropped)')
      return
    }
    case 'brief-main':
    case 'brief-actor':
    case 'brief-human': {
      let mirror = runState.jobs.get(d.jobId)
      if (mirror === undefined && d.kind === 'brief-actor') {
        // 【跨宿主Agent员信收编 2026-09-25】镜子只活在主Agent宿主——跨宿主运行的
        // 角色信到站时本宿主必然无镜（job 2575-2579 实证：信被吞、引擎
        // 3600s 空放散场；2564 能通只因当时 dsh 恰是主Agent）。收编：查本次选
        // 角账拿座位，座位窗口未开就按官方路径拉活（ensureSessionLive，
        // projection-input 同款），然后照常本尊出演（runMainModelTurn）。
        // 绑在别家宿主/查无座位/拉活失败 = 响亮报错交引擎（信已回执清账，
        // 静默=3600s 空放；子代理代打路线 2026-09-25 用户拍板退役——soul
        // 直给主会话/本尊，不派子代理）。
        const adoptSoul = soulIdentityOf(d.brief) || actorNameOf(d.brief)
        const adoptEntry = adoptSoul.length > 0
          ? (await readJobCast(resolved.femoRoot, d.jobId))[adoptSoul]
          : undefined
        const fail = async (reason: string, code: string): Promise<void> => {
          void sendActorFailure(bridge, d.jobId, d.ref, code, reason).catch(() => undefined)
          console.log(`[femo-plugin] mailbox-push: adopt failed job=${d.jobId}: ${reason}`)
        }
        if (adoptEntry === undefined) {
          await fail(`本次绑定账查无 "${adoptSoul}" 的座位`, 'cast_seat_missing')
          return
        }
        if (adoptEntry.host !== hostAddr()) {
          await fail(`角色绑在别的宿主（${adoptEntry.host}），本宿主不该收到这封信`, 'cast_host_foreign')
          return
        }
        if ((await ensureSeatLive(ctx, sessionsStore, adoptEntry.sid, `job=${d.jobId}`)) === undefined) {
          await fail(`绑定的会话 ${adoptEntry.sid} 拉活失败（官方 resume 不可用）`, 'cast_session_hydrate_failed')
          return
        }
        jobMirrorPrearm(runState, d.jobId, SessionId(adoptEntry.sid))
        mirror = runState.jobs.get(d.jobId)
        console.log(`[femo-plugin] mailbox-push: adopted foreign job ${d.jobId} (soul=${adoptSoul}, 本尊 sid=…${adoptEntry.sid.slice(-12)})`)
      }
      if (mirror === undefined) {
        console.log(`[femo-plugin] mailbox-push: brief for unknown job ${d.jobId} (ref=${d.ref.slice(0, 24)})`)
        return
      }
      const session = sessionsStore?.get(SessionId(mirror.ownerSid))
      if (session === undefined) {
        // 【十连裁② 单通道】事件兜底已废：此处漏拍无兜底可救（信已回执清账，
        // 重投看不到它）——大声留痕，引擎 3600s 等待超时是最后的安全网。
        recordError(SessionId(mirror.ownerSid), '驿站信件无法投递：主会话不在 store（宿主重启窄窗口）')
        console.log(`[femo-plugin] mailbox-push: session ${mirror.ownerSid} not in store; no fallback since 单通道 (2026-09-23)`)
        return
      }
      if (d.kind === 'brief-main') {
        // 主模型参与：main 伪 soul → owner 会话；幂等覆盖，断点续跑后首拍即补账。
        runTurnOnSession(ctx, resolved, bridge, projections, recordError, {
          session, brief: d.brief, mirror, jobId: d.jobId, ref: d.ref,
          soul: 'main', sid: mirror.ownerSid,
          errorCode: 'main_executor_error', errorPrefix: '主模型参与运行注入失败',
        })
        return
      }
      if (d.kind === 'brief-actor') {
        // 角色料包（soul=该角色）。【cast 两段式 2026-09-25】先查 Job 绑定账：
        // 该角色由会话本尊出演（预绑定定格进账的条目）→ 走会话执行体
        // （runMainModelTurn 泛化机器：注入通知→捕获整轮→交卷 soul=角色自己，
        // 与 main 同一套防插话排队/停靠重试/流水水位；捕获钩子按 sid 分账，
        // 绑定会话只要是 FEMO 主会话即天然直通）；无绑定 → 常驻子代理（现状）。
        const brief = d.brief
        const castSoul = soulIdentityOf(brief) || actorNameOf(brief)
        const boundEntry = castSoul.length > 0
          ? (await readJobCast(resolved.femoRoot, d.jobId))[castSoul]
          : undefined
        const boundSid = boundEntry?.sid
        if (boundSid !== undefined && !boundSid.startsWith('femo-actor-')) {
          // 【多宿主派工 2026-09-25】绑定指向别的宿主的会话 → 本宿主不派工：
          // 信留驿站（target=发起方格），跨宿主方按自取语义取件（zcode 钩子
          // mail-context / 终端席 receive）。不报错不回落子代理——绑定在谁家
          // 就该谁家演，驿站留柜正是「上门取件」的原语义。
          if (boundEntry.host !== undefined && boundEntry.host !== '' && boundEntry.host !== hostAddr()) {
            console.log(`[femo-plugin] mailbox-push: role "${castSoul}" bound to foreign host ${boundEntry.host} -- letter stays in mailbox for self-pickup`)
            return
          }
          // 座位窗口未开：按官方路径拉活（与收编块同款）；失败=响亮报错
          // （soul 直给本尊/主会话，子代理代打路线 2026-09-25 用户拍板退役）。
          // 【修 2026-09-29】要用拉活回来的会话——旧代码取的是拉活前的 store
          // 快照，拉活成功后仍把 undefined 递给回合机（宿主重启窄窗口下回合
          // 机当场炸、信已回执清账，整轮静默丢失）。
          const liveSession = await ensureSeatLive(ctx, sessionsStore, boundSid, '本尊分支')
          if (liveSession === undefined) {
            void sendActorFailure(bridge, d.jobId, d.ref, 'cast_session_hydrate_failed', `bound session ${boundSid} hydrate failed`).catch(() => undefined)
            return
          }
          // 绑定账登记实际执行体（幂等覆盖定格同值）。换场清场
          // （clearMainPlayState）目前只清 owner，绑定 sid 的流水/角色名残留到
          // 下一次——内存几条，无行为影响，暂不追。
          runTurnOnSession(ctx, resolved, bridge, projections, recordError, {
            session: liveSession, brief, mirror, jobId: d.jobId, ref: d.ref,
            soul: castSoul, sid: boundSid,
            errorCode: 'session_actor_error', errorPrefix: '会话角色注入失败',
          })
          return
        }
        // 无绑定（或账上是子代理条目）→ 常驻子代理（现状路径，唯一派工体）。
        dispatchActorTurn(ctx, resolved, bridge, session, d.brief, recordError, defaultModel, mirror, projections, d.jobId)
        return
      }
      // 人类等待信（无 source=非 AI 轮）→ applyHumanWait（快照+广播+租约）——
      // 与角色同一封信，宿主呈现改成显示给人看。
      applyHumanWait(ctx, runState, session, projections, broker, mirror, d.brief)
      return
    }

    // ── 无 actionable 面单（登记即可；信已回执清账）────────────────────
    case 'letters-only':
      return
  }
}

/**
 * 起投递员上门收件口。返回实际监听端口（桥经 spawn env 拿到）；端口全部被占
 * 或 HTTP 不可用 → undefined（桥收不到 FEMO_PUSH_PORT → 自动留柜自取模式，
 * 既有 collect/事件兜底链路完整兜住——降级不断戏）。
 */
export async function startMailboxPushListener(ctx: Context, deps: MailboxPushDeps): Promise<{ port: number } | undefined> {
  const basePort = Number(process.env.FEMO_PUSH_PORT ?? '3895')
  for (let attempt = 0; attempt < 20; attempt++) {
    const port = basePort + attempt
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/femo-plugin/mailbox-push' || req.method !== 'POST') {
        writeJson(res, 404, { ok: false, error: 'not found' })
        return
      }
      void readBody(req).then(body => {
        return handlePush(ctx, deps, (body ?? {}) as Record<string, unknown>)
      }).then(() => {
        writeJson(res, 200, { ok: true })
      }).catch((error: unknown) => {
        console.log(`[femo-plugin] mailbox-push handler failed: ${String(error instanceof Error ? error.message : error)}`)
        writeJson(res, 200, { ok: true })  // 处理失败也回执：信已消费，账记 push 已送达
      })
    })
    const ok = await new Promise<boolean>(resolve => {
      server.once('error', () => resolve(false))
      server.listen(port, '127.0.0.1', () => resolve(true))
    })
    if (!ok) continue
    console.log(`[femo-plugin] mailbox push listener: http://127.0.0.1:${port}/femo-plugin/mailbox-push`)
    ctx.effect(() => () => { server.close() }, 'femo-plugin: mailbox push listener')
    return { port }
  }
  console.log(`[femo-plugin] mailbox push listener: no free port from ${basePort}; courier falls back to pickup mode`)
  return undefined
}
