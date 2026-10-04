/**
 * client-ui/composer.tsx — 投影窗 composer 主组件（角色/上帝视角的可输入输入框）。
 *
 * dsh 对 origin=subagent 会话默认挂 SubagentReadOnlyComposer（只读）；
 * 投影窗（femo-proj-*）需要可输入。输入 → POST /femo-plugin/projection-input，
 * 由 host 按运行状态路由（2026-08-24 定稿）：FEMO脚本未跑→steer 直达主模型；
 * 人类节点等待→喂引擎 wait_key；跑本中其他时候→本窗留痕（插话待实现）。
 *
 * 2026-08-26 视觉重做：官方 InputBar 同款胶囊卡片（styles.ts FEMO_COMPOSER_CSS
 * 逐属性转写，全 --dsw/--dsh token → 深浅色与第三方主题自动跟随主窗口）。
 * 不能直接复用官方 InputBar 组件的原因（调研结论）：①跨包 import 被客户端
 * 导出纪律禁止；②投影窗 descriptor 是 mode:'one-shot'，client-runtime 对
 * one-shot 会话的 prompt 在浏览器本地直接拒绝（subagent-not-resumable），
 * 官方提交链路到不了 host；③官方语义=给本会话 agent 发消息，与三路路由冲突。
 *
 * 【刀⑧ 五拆】按状态域分家，本件只留输入框本体（草稿层、提交链路、变量
 * 赋值浮层、主会话 face 解析）：
 *  - composer-common.tsx   face 鸭子类型 + projection 订阅钩子 + 模板填空；
 *  - composer-stats.tsx    卡片下统计行（rc.2 StatsLine 转写）；
 *  - composer-ring.tsx     上下文占用圆环（上帝窗/角色窗两数据源）；
 *  - composer-permission.tsx 左下权限菜单（官方 PermissionSelect 转写）；
 *  - composer-run-state.tsx FEMO 运行状态三通道获取 + 按钮状态机。
 *
 * 官方行为对齐清单：mirror 双层自增高（14 行封顶滚动）、IME composition
 * guard、Enter 发送/Shift+Enter 原生换行、e.repeat 防连发、按钮 mousedown
 * 保焦点、autofocus(preventScroll)、失败 toast 条（4s 自愈）、busy 只读态、
 * primaryStops——主会话 running 时发送钮变方块 Stop，点击中断主模型当前
 * 回合（mainFace.cancel()，官方 ISession 公开动词；FEMO 运行控制不在本框）、
 * 草稿持久化——官方 chat store persist 同构复刻：单 key JSON 进 localStorage，
 * 切窗保留、刷新恢复、提交成功清除（mount-seed + 实时 mirror 同官方两段式）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { FemoLogo, FaCode, FaCircleCheck } from '../fa-icons'
import { type MainSessionFace, type ComposerError, useMainSnapshot } from './composer-common'
import { StatsRow } from './composer-stats'
import { GodContextRing, ActorContextRing } from './composer-ring'
import { PermissionMenu } from './composer-permission'
import { composeHumanSubmission } from '../../../../femo2host/host/hub-render-core.mjs'
import { composerButtonState, useFemoRunState } from './composer-run-state'

// ── 主会话 face（鸭子类型：官方 ISession 公开面中我们用到的成员）──────────

/** client.tsx 注入 face：按会话 id 解析主会话 outward face（sessions.binding）。 */
export interface ProjectionComposerInjected {
  getSessionFace?: (sid: string) => MainSessionFace | undefined
}

// ── 草稿持久层 ──
// 官方 chat store persist（'dsh.conversation.chat' 整值 JSON 进 localStorage）
// 的轻量同构复刻：单 key 按 sessionId 存对象。切窗回来草稿还在、页面刷新也
// 在；提交成功即清除（官方 submit 后 machine adopt('') 镜像写空的同语义）。
const DRAFT_STORE_KEY = 'femo-plugin.composer.drafts'

function readDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFT_STORE_KEY)
    if (raw === null) return {}
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, string> : {}
  } catch {
    return {} // 损坏数据当无草稿；localStorage 缺席（隐私模式）同样降级
  }
}

function writeDraft(sid: string, text: string): void {
  try {
    const drafts = readDrafts()
    if (text === '') delete drafts[sid]
    else drafts[sid] = text
    localStorage.setItem(DRAFT_STORE_KEY, JSON.stringify(drafts))
  } catch {
    // localStorage 不可用：退化为纯内存态（本次挂载内仍有效），不提示
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ProjectionComposer({ useSession, useSessions, getSessionFace }: any) {
  const sessionId = useSession((s: { sessionId?: string }) => s.sessionId) as string | undefined
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ComposerError | null>(null)
  // IME guard（官方同款）：composition 关闭事件在 Safari 晚于 keydown 一拍到达，
  // 延迟一 tick 复位，中文输入法回车选词不会误触发送。
  const composingRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const errorSeqRef = useRef(0)

  // 草稿装载（官方 ConversationSession mount-seed 同款：机器空 && 存储有 →
  // 回填）。切换投影窗时装载该窗自己的草稿；之后每次输入实时镜像落盘。
  useEffect(() => {
    if (sessionId === undefined) return
    setText(readDrafts()[sessionId] ?? '')
  }, [sessionId])

  /** 输入变更：state 与持久层同步写（官方 machine mirror 同语义）。 */
  const changeText = (next: string): void => {
    setText(next)
    if (sessionId !== undefined) writeDraft(sessionId, next)
  }

  // 主会话 id：sessions 列表 summary.parentId（host 建窗元数据，与
  // view-button 同款权威来源）。列表未就绪时返回 undefined——列表就绪后
  // selector 返回值变化（undefined → 'xxx'）触发重渲染，届时 face 解析成功；
  // 不用字符串兜底（会让 selector 恒定、列表就绪的重渲染不触发=刷新后缺
  // 权限按钮/统计行，2026-08-26 实测 bug）。
  const mainSid = useSessions((state: { byId?: Record<string, { parentId?: string } | undefined> } | undefined): string | undefined => {
    if (typeof sessionId !== 'string') return undefined
    const pid = state?.byId?.[sessionId]?.parentId
    return typeof pid === 'string' && pid.length > 0 ? pid : undefined
  })
  // binding 可解析的判据=官方 resolve() 的 eligible：会话在列表 ids 中（或恰为
  // 当前会话——composer 只挂在 femo-proj 窗上，永远走前者）。单独订阅它：
  // 「目录先于列表落地」的启动竞态下，byId[projSid] 由宿主 address walk 在
  // ids 还空着时先造出来，mainSid 首次非空那一刻 binding 返回 undefined 并被
  // 下面的 useMemo 永久缓存（inject face 引用稳定、mainSid 之后不再变化=
  // 永不重算）——刷新后权限按钮/统计行消失、切窗重挂才自愈（2026-08-29 探针
  // 确定性复现：session.list 比目录慢时必现，大会话变多后 list 变慢所致）。
  const mainListed = useSessions((state: { ids?: readonly string[] } | undefined): boolean =>
    typeof mainSid === 'string' && Array.isArray(state?.ids) && state.ids.includes(mainSid))
  // 主会话 face（投影窗是主会话的遥控器：权限菜单/统计行/停止钮都读它）。
  // binding() 官方注释明示 render-safe 纯解析且 per-session identity-stable；
  // useMemo 按 [mainSid, mainListed] 缓存即引用稳定——mainListed 翻真（列表
  // 落地）强制重算一次，清掉竞态窗口里缓存下来的失败解析。
  const mainFace = useMemo(
    () => (mainSid === undefined || !mainListed ? undefined : getSessionFace?.(mainSid)),
    [mainSid, mainListed, getSessionFace],
  )
  const mainSnapshot = useMainSnapshot(mainFace)
  // 官方 primaryStops 同语义：主模型回合进行中 → Stop（仅上帝窗FEMO脚本未跑时用）。
  const mainRunning = mainSnapshot?.running === true

  // FEMO 运行状态（按钮状态机的输入）：三通道获取拆 composer-run-state.tsx。
  const { run, winInfo } = useFemoRunState(sessionId, mainSid)

  const buttonState = composerButtonState({ winKind: winInfo.winKind, actor: winInfo.actor, run, mainRunning })

  // ── 变量赋值浮层（2026-09-14）──────────────────────────────────────────
  // 轮到人类节点且节点声明了 out：输入框上方出现 fa-code 小按钮，点击向上弹
  // 出「变量名 = 输入框」浮层；确认把非空行收成结构化 variables 与文本一起
  // POST（引擎 _try_apply_human_variables 直取，绕过 chat_text 文本解析）。
  const [varsOpen, setVarsOpen] = useState(false)
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const varsPanelRef = useRef<HTMLDivElement | null>(null)
  // 等待回合切换（outVars 变化）即收起浮层并清空旧值，防止上一回合的赋值
  // 残留误提交到下一回合。
  const outVarsKey = run.outVars.join('\u0000')
  useEffect(() => {
    setVarsOpen(false)
    setVarValues({})
  }, [outVarsKey])
  // 浮层开着时：外部点击 / Escape 关闭（ContextRing 同款单监听器模式）。
  useEffect(() => {
    if (!varsOpen) return
    const onPointerDown = (e: PointerEvent): void => {
      if (e.target instanceof Node && varsPanelRef.current?.contains(e.target) === true) return
      setVarsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setVarsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [varsOpen])
  const setVarValue = (name: string, value: string): void => {
    setVarValues(prev => ({ ...prev, [name]: value }))
  }
  // 确认：只提交填了值的变量；全空=收起浮层不发（空输入会喂引擎空回合）。
  const confirmVars = (): void => {
    const filled: Record<string, string> = {}
    for (const name of run.outVars) {
      const value = varValues[name]?.trim()
      if (value !== undefined && value.length > 0) filled[name] = value
    }
    if (Object.keys(filled).length === 0) {
      setVarsOpen(false)
      return
    }
    submit(filled)
  }
  // 显示条件与发送钮同源（buttonState==='send' 已含 waiting + 本窗在 scope）。
  const showVarUi = buttonState === 'send' && run.outVars.length > 0

  const submit = (variables: Record<string, string> = {}): void => {
    if (busy || sessionId === undefined) return
    // 拼装判据唯一活在公共层 hub-render-core.composeHumanSubmission（2026-09-29
    // 收编，投影中心/web 人类席同吃）：台词 trim、变量只收非空、发言与赋值全空
    // 不发；台词末尾按 FEMO 剧本语言原样拼 SET VARIABLE 行（2026-09-20 用户定稿
    // 形状：一行一赋值附在发言最后，名字与值字符串原样拼接——@ 与否不做处理），
    // 结构化 variables 仍随行：引擎直取路径保持不变，台词里的语句是显示与文本
    // 解析双保险。
    const composed = composeHumanSubmission(text, variables)
    if (composed.error !== undefined) return
    const hasVars = Object.keys(composed.variables).length > 0
    setBusy(true)

    const post = async (): Promise<Response> => fetch('/femo-plugin/projection-input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, text: composed.text, ...(hasVars ? { variables: composed.variables } : {}) }),
    })
    void (async (): Promise<void> => {
      try {
        let response = await post()
        let data = await response.json().catch(() => ({}) as { ok?: boolean; error?: string }) as { ok?: boolean; error?: string }
        // 【2026-09-11 修复·「刷新后提示窗口不存在」】宿主重启后本窗可能不在
        // store（只活在持久化里）：POST 落 404 并回 "session … not found"，
        // 旧实现把这句原话弹给用户（观感=「窗口不存在」）。现在 404 先借投影窗
        // 清单路由唤醒宿主（幂等；宿主顺带冷装载主会话与全窗），再发一次。
        if (data.ok !== true && response.status === 404 && sessionId.startsWith('femo-proj-')) {
          const mainSid0 = sessionId.slice('femo-proj-'.length).replace(/-[^-]*$/, '')
          const woken = mainSid0.length > 0
            ? await fetch(`/femo-plugin/projection-windows?sessionId=${encodeURIComponent(mainSid0)}`)
              .then(r => r.ok).catch(() => false)
            : false
          if (woken) {
            response = await post()
            data = await response.json().catch(() => ({}) as { ok?: boolean; error?: string }) as { ok?: boolean; error?: string }
          }
        }
        if (data.ok === true) {
          // 官方同语义：提交成功清空草稿（state + 持久层一起）。
          changeText('')
          // 变量浮层随之收起并清空已填值（下个等待回合重新开始）。
          setVarsOpen(false)
          setVarValues({})
          return
        }
        errorSeqRef.current += 1
        setError({ seq: errorSeqRef.current, text: data.error ?? `发送失败（HTTP ${response.status}），草稿已保留` })
      } catch {
        errorSeqRef.current += 1
        setError({ seq: errorSeqRef.current, text: '发送失败，草稿已保留' })
      } finally {
        setBusy(false)
      }
    })()
  }

  // 错误条自动消失（官方 Toast 的 hold-then-fade 语义的轻量版）。
  useEffect(() => {
    if (error === null) return
    const timer = setTimeout(() => { setError(null) }, 4000)
    return () => { clearTimeout(timer) }
  }, [error])

  // 切换投影窗回焦输入框（官方 unlock effect 同款 preventScroll）。busy 只读态不抢。
  useEffect(() => {
    if (busy) return
    inputRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    // Shift+Enter 无条件原生换行（官方顺序：先于 IME 判定）。
    if (e.key === 'Enter' && e.shiftKey) return
    if (e.key !== 'Enter') return
    // keyCode 229 是引擎无 isComposing 时的 legacy IME 信号（官方注释）。
    const composing = composingRef.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229
    if (composing) return
    e.preventDefault()
    if (e.repeat) return // 按住 Enter 不许连发
    submit()
  }

  // 按钮按下不夺走 textarea 焦点（官方 keepFocus：preventDefault 即可）。
  const keepFocus = (e: ReactMouseEvent<HTMLButtonElement>): void => {
    e.preventDefault()
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="femo-comp-root">
      {/* 等待横幅（2026-09-07）：轮到人类节点的实时提醒与按钮同源（run 状态），
          不依赖 dsh 会话事件流——聊天行的 human_wait 行仍照常落盘归档，但实时
          提醒改由本横幅承担（会话事件流间歇不到时不再漏提醒）。 */}
      {run.waiting && run.prompt !== undefined && (
        <div role="status" style={{
          margin: '0 0 6px',
          padding: '8px 12px',
          borderRadius: '8px',
          background: 'color-mix(in srgb, var(--dsw-alias-button-info-fill, #4a9eff) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--dsw-alias-button-info-fill, #4a9eff) 40%, transparent)',
          color: 'var(--dsw-alias-label-primary, #222)',
          fontSize: '13px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><FemoLogo size={12} style={{ flexShrink: 0 }} />{run.prompt}</span>
        </div>
      )}
      {error !== null && (
        <div className="femo-comp-notice" role="status">{error.text}</div>
      )}
      {/* data 钩子对齐官方 InputBar 的 DOM 契约：meow-smooth 的失焦折叠/
          手机触摸豁免/软键盘避让全部委托 [data-composer-card] 与
          [data-input-scroll] 识别——不挂钩子这些适配层对我们失效。 */}
      <div className="femo-comp-card" data-composer-card="">
        {showVarUi && (
          <div className="femo-comp-var-bar">
            <button
              type="button"
              className="femo-comp-var-trigger"
              aria-label="变量赋值"
              aria-haspopup="dialog"
              aria-expanded={varsOpen}
              data-open={varsOpen}
              onMouseDown={keepFocus}
              onClick={() => { setVarsOpen(!varsOpen) }}
            >
              <FaCode size={12} />
              <span>变量赋值</span>
            </button>
            {varsOpen && (
              <div ref={varsPanelRef} className="femo-comp-var-panel" role="dialog" aria-label="变量赋值">
                <div className="femo-comp-var-head">本节点变量赋值（可只填其中几项）</div>
                {run.outVars.map(name => (
                  <div key={name} className="femo-comp-var-row">
                    <span className="femo-comp-var-name" title={name}>{name}</span>
                    <span className="femo-comp-var-eq" aria-hidden>=</span>
                    <input
                      className="femo-comp-var-input"
                      value={varValues[name] ?? ''}
                      placeholder="留空=不赋值"
                      spellCheck={false}
                      onChange={(e) => { setVarValue(name, e.currentTarget.value) }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="femo-comp-var-confirm"
                  disabled={busy}
                  onMouseDown={keepFocus}
                  onClick={confirmVars}
                >
                  <FaCircleCheck size={13} />
                  <span>{busy ? '发送中' : '确认赋值并发送'}</span>
                </button>
              </div>
            )}
          </div>
        )}
        <div className="femo-comp-scroll" data-input-scroll="">
          <div className="femo-comp-grow">
            <div aria-hidden className="femo-comp-mirror" data-input-mirror="">{`${text}\n`}</div>
            <textarea
              ref={inputRef}
              className="femo-comp-input"
              value={text}
              readOnly={busy}
              placeholder="输入消息…"
              rows={2}
              spellCheck={false}
              data-phase={busy ? 'submitting' : 'idle'}
              onChange={(e) => { changeText(e.currentTarget.value) }}
              onKeyDown={onKeyDown}
              onCompositionStart={() => { composingRef.current = true }}
              onCompositionEnd={() => {
                setTimeout(() => { composingRef.current = false }, 10)
              }}
            />
          </div>
        </div>
        <div className="femo-comp-row">
          {/* 左组：官方此处是 [+命令菜单] 与 [权限/Plan chips]；命令补全面板
              深绑官方草稿机无法正道复用（v1 不放死按钮），权限菜单位置与官方
              tools 区一致。 */}
          <PermissionMenu face={mainFace} disabled={busy} />
          <div className="femo-comp-trailing">
            {/* 圆环（官方 InputBar 同位：发送钮之前）。窗型判定（id 规则化
                femo-proj-<主sid>-<actorKey>）：god=上帝窗（主会话 projection，
                主窗口同源数据）；stage=FEMO内窗（归档窗无角色身份，无圆环）；
                其余=角色窗（actor-usage：该角色上次发言发给 API 的实报占用）。 */}
            {sessionId !== undefined && mainSid !== undefined && sessionId.startsWith(`femo-proj-${mainSid}-`) && (() => {
              const actorKey = sessionId.slice(`femo-proj-${mainSid}-`.length)
              if (actorKey === 'god') return <GodContextRing face={mainFace} />
              if (actorKey !== 'stage') return <ActorContextRing mainSid={mainSid} actorKey={actorKey} />
              return null
            })()}
            <button
              type="button"
              className="femo-comp-primary"
              aria-label={buttonState === 'stop' ? '停止' : buttonState === 'send' ? (busy ? '发送中' : '发送') : '当前不可发送'}
              disabled={buttonState === 'stop'
                ? mainFace?.cancel === undefined
                : buttonState !== 'send' || busy || text.trim().length === 0}
              onMouseDown={keepFocus}
              onClick={buttonState === 'stop'
                ? () => { void mainFace?.cancel?.()?.catch(() => { /* 失败经主会话快照 promptError 呈现（官方 stop 同语义） */ }) }
                : () => { submit() }}
            >
              {/* 官方 InputBar 同款 glyph：stop=方块 Stop（primaryStops），
                  send/disabled=箭头 Send（箭头态由按钮 disabled 样式置灰）。 */}
              {buttonState === 'stop' ? (
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                  <rect x="3" y="3" width="10" height="10" rx="3" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                  <path d="M8.3125 0.980183C8.66767 1.0531 8.97902 1.20418 9.2627 1.43233C9.48724 1.61297 9.73029 1.85793 9.97949 2.10714L14.707 6.83468L13.293 8.24874L9 3.95577V15.0417H7V3.95577L2.70703 8.24874L1.29297 6.83468L6.02051 2.10714C6.26971 1.85793 6.51277 1.61297 6.7373 1.43233C6.97662 1.23986 7.28445 1.04402 7.6875 0.980183C7.8973 0.947006 8.1031 0.95516 8.3125 0.980183Z" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* 卡片下方统计行（官方 StatsLine 挂 composer.dock 的同位语义）。 */}
      <StatsRow face={mainFace} />
    </div>
  )
}
