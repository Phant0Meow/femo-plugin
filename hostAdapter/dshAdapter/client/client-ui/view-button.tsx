/**
 * client-ui/view-button.tsx — 视角菜单按钮（session header actions）。
 *
 * FEMO外=主会话本体 / 上帝=上帝投影窗 / FEMO内=FEMO脚本归档投影窗（2026-08-27）/
 * 角色=角色投影窗；含视角过滤 CSS 注入、proj 窗母名黑化样式切换、视角跳转的
 * 标签页跟手、子代理计数座位。「FEMO」标签页 2026-09-28 起全员显示无筛选。
 * （2026-08-26 结构整理自 client.tsx 原样迁出，行为零变化。）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDown } from './primitives-compat'
import { FaClapperboard, FaEye, FaPodcast, FaRobot, FaUserSecret } from '../fa-icons'
// 官方下箭头（dsh 子代理计数下拉同款）：视角按钮右侧的展开指示。
import { CatalogDropdown } from './catalog-dropdown'
import { type FemoChatData } from './chat-node'
import { getView, setView, useView } from './view-state'
import { editorPageOpenSession, editorPageCloseSession } from './editor-page'

// ── 视角跳转的标签页跟手（2026-08-24）─────────────────────────────────────
// 需求：切视角后落在哪个标签页（对话/Femo 编辑器）跟随「切换前」所在的标签
// 页，而不是恢复目标窗口自己上次停留的位置。实现：跳转前读当前激活 tab，
// 记入下面的一次性内存标记；目标窗口的 FemoViewButton 挂载后消费标记，把激
// 活 tab 对齐过去（走官方 tab 点击链路 actions.setView，持久化行为与手点一
// 致）。不新增任何持久化存储。

/** 「FEMO」标签页固定文案（本插件 conversation.view 注册的 label）。 */
const FEMO_EDITOR_TAB_LABEL = 'FEMO'
/** 对话标签页文案（ui-conversation locales view.chat：中文产品文案为主，英文兜底）。 */
const CHAT_TAB_LABELS = ['对话', 'Chat']

/** 一次性转移标记：kind=切换前所在的一侧；expiresAt 防 openSession 失败后
 *  残留污染下一次任意会话切换。 */
let pendingTabTransfer: { kind: 'editor' | 'chat'; expiresAt: number } | null = null

/** 读当前激活标签页属于哪一侧：编辑器 tab 文本唯一，其余（对话）一律归 chat。 */
function readActiveTabKind(): 'editor' | 'chat' {
  const selected = document.querySelector('[role="tab"][aria-selected="true"]')
  return selected !== null && selected.textContent === FEMO_EDITOR_TAB_LABEL ? 'editor' : 'chat'
}

// ── view-perspective button (session header) ──────────────────────────────

/** FemoViewButton 注入能力。 */
export interface FemoViewInjected {
  /** 打开任意会话（视角菜单跳转投影窗/主会话）。parentSessionId 可选：
   *  0.1.3 上 subagent 来源会话（femo-proj 窗）须经母地址打开，调用点把
   *  mainSid 带上；旧版忽略该参数、走普通 id 打开。 */
  openSession(id: string, parentSessionId?: string): void
  /** 预热母会话的子代理目录（0.1.3 冷加载较慢，菜单打开时提前拉取）。 */
  warmCatalog?(sid: string): void
  /** 查询主会话的投影窗 id 列表（上帝窗 + FEMO内窗 + 角色窗）。 */
  listProjectionWindows(sid: string): Promise<{ god?: string; stage?: string; actors: Record<string, string> }>
}

/** Session-header action: switch between god view and per-actor views.
 *  视角菜单：FEMO外=主会话本体 / 上帝=上帝投影窗 / 角色=角色投影窗。
 *  dsh 原生切换显示（主会话与子代理窗同一 UI 位置）。
 *  2026-08-23：order -10→-20（排到 preset 徽章之前，紧贴 session name）；
 *  菜单支持点外部收起。 */
export function FemoViewButton({ useSession, useSessions, openSession, warmCatalog, listProjectionWindows }: PropsRuntime<'conversation.session.header.actions'> & FemoViewInjected) {
  const sessionId = useSession(snapshot => snapshot.sessionId)
  const view = useView(sessionId)
  const [open, setOpen] = useState(false)
  // 投影窗 id 缓存：{ god?, stage?, actors: {name: id} }（host 侧幂等创建）。
  const [proj, setProj] = useState<{ god?: string; stage?: string; actors: Record<string, string> }>({ actors: {} })
  // 可见提示（按钮下方浮条）：切窗失败/宿主未装载时给一句人话，8s 自愈。
  // 【2026-09-11】旧实现只有「点了没反应」——用户只能靠猜（实测：「内容完全
  // 不变，我认为我并没有成功切换」）。
  const [hint, setHint] = useState<{ text: string; seq: number } | null>(null)
  const hintSeq = useRef(0)
  const showHint = useCallback((text: string): void => {
    hintSeq.current += 1
    const seq = hintSeq.current
    setHint({ text, seq })
    window.setTimeout(() => { if (hintSeq.current === seq) setHint(null) }, 8000)
  }, [])
  // 投影窗清单：权威重拉（挂载 / 开菜单 / 点击未命中三处共用）。
  // 【2026-09-11 修复·用户实测「刷新后菜单点了不切窗」】宿主重启后本路由可能
  // 一阵子答不上（主会话不在 store → 503），旧实现 catch 静默吞掉 ⇒ proj 永远
  // 空转；菜单项照样渲染（数据源是 /actors，有 turn_scopes 文件回退），点下去
  // proj.actors[id] undefined → 落进「CSS 过滤降级」分支：只改视角状态、不
  // openSession，用户看到的就是「下面的窗口内容完全不变」。现在：失败留痕
  // （诊断流可见）+ 点击时重拉重试 + 实在没有才降级并给可见提示。
  const refreshWindows = useCallback(async (
    sid: string,
  ): Promise<{ god?: string; stage?: string; actors: Record<string, string> } | undefined> => {
    try {
      const windows = await listProjectionWindows(sid)
      setProj(windows)
      return windows
    } catch (error: unknown) {
      const message = String(error instanceof Error ? error.message : error)
      return undefined
    }
  }, [listProjectionWindows])
  // 归属主会话（2026-08-23 扩展；2026-09-28 放宽视角状态归属）：
  // 视角菜单服务三类窗口——
  //   Femo 主会话（agentPreset=femo-plugin 且无母）→ mainSid=自身；
  //   Femo 投影窗（id 前缀 femo-proj-，parentSession 指向主会话）→ mainSid=母会话；
  //   普通会话（2026-09-28 新增）→ mainSid=自身。视角状态记在自己名下。
  //   注意显示与否归 viewEligible（戏缘门卫，见下）管，本选择器只管键挂谁。
  // 视角状态（viewBySession）与 actors/turn-scopes/projection-windows 三张
  // 查询一律挂在 mainSid 名下——视角是「剧」的属性，不是「窗」的属性。
  const mainSid = useSessions((state): string | undefined => {
    if (typeof sessionId !== 'string') return undefined
    // 【0.1.3 API 变更兼容】preset 从 summary 扁平字段（旧版）挪进了会话投影
    // projectionValues.agentPreset（新版官方徽章即读此形）——两形都读，谁在
    // 用谁生效；旧版无投影值照走扁平字段，行为逐字节不变。
    const summary = state.byId[sessionId] as
      | { agentPreset?: unknown; projectionValues?: { agentPreset?: unknown }; parentId?: unknown }
      | undefined
    const preset = summary?.projectionValues?.agentPreset ?? summary?.agentPreset
    if (preset === 'femo-plugin' && summary?.parentId === undefined) return sessionId
    if (sessionId.startsWith('femo-proj-')) {
      const pid = summary?.parentId
      return typeof pid === 'string' ? pid : undefined
    }
    return sessionId
  })
  // femo 家族判据（旧 mainSid 语义拆出，2026-09-28）：跳转标记消费仍只属于
  // femo 家族窗（主会话/投影窗）——跳转目标永远是它们；编辑器标签页已全员
  // 显示、内容跟随已全会话上报，不再吃这个判据。
  const femoFamily = useSessions((state): boolean => {
    if (typeof sessionId !== 'string') return false
    const summary = state.byId[sessionId] as
      | { agentPreset?: unknown; projectionValues?: { agentPreset?: unknown }; parentId?: unknown }
      | undefined
    const preset = summary?.projectionValues?.agentPreset ?? summary?.agentPreset
    if (preset === 'femo-plugin' && summary?.parentId === undefined) return true
    return sessionId.startsWith('femo-proj-') && typeof summary?.parentId === 'string'
  })
  // 戏缘门卫（2026-09-28 二次拍板，收紧同日的「全员可见」）：视角菜单只对
  // 「与 FEMO 有戏缘」的会话显示——由本会话开启过戏（发起账），或当前在线
  // 宿主最新当选的灵魂绑定里有本会话（戏里有它）。与 FEMO 彻底无关的普通
  // 聊天不显示：没跑过戏时上帝视角与主会话视角必然相同，按钮是冗余信息。
  // 裁决数据源=宿主 /femo-relation；未建立戏缘时慢轮询自愈（开演/当选后按钮
  // 自动现身），命中即停（戏缘不会无声消失——就算失去也宁可按钮残留，点击
  // 自有据实提示）。投影窗自身恒显：它就是戏的一部分，母会话必是发起方。
  const isProjWindow = typeof sessionId === 'string' && sessionId.startsWith('femo-proj-')
  const [related, setRelated] = useState(false)
  useEffect(() => {
    if (isProjWindow || typeof sessionId !== 'string') return
    let stopped = false
    let timer = 0
    const check = (): void => {
      void fetch(`/femo-plugin/femo-relation?sessionId=${encodeURIComponent(sessionId)}`)
        .then(response => response.json())
        .then((data: { ok?: boolean; related?: boolean }) => {
          if (stopped) return
          const hit = data.ok === true && data.related === true
          setRelated(prev => prev || hit)
          if (!hit) timer = window.setTimeout(check, 8000)
        })
        .catch(() => { if (!stopped) timer = window.setTimeout(check, 8000) })
    }
    check()
    return () => { stopped = true; window.clearTimeout(timer) }
  }, [sessionId, isProjWindow])
  // 预拉/现查建窗与显示同门（显示着的按钮才有资格查窗）。普通会话一经有戏缘
  // 也可查——它能发起运行（2026-09-19 起），发起者查自己的窗天经地义。
  const viewEligible = (isProjWindow && mainSid !== undefined) || related

  // 「FEMO」标签页全员显示（2026-09-28 拍板，无筛选）：tab 列表 =
  // conversation.view 的全部注册条目，宿主不做任何 DOM 隐藏。旧的隐藏逻辑
  // 找「FEMO脚本」而注册 label 早改成了「FEMO」——匹配从不命中，隐藏从未
  // 生效（用户实测「疑似 bug 已全员显示」的真身），连逻辑带过期常量一并修整。
  // 单页编辑器「内容跟随」上报（2026-08-26 v3；2026-09-28 随标签页全员显示
  // 放宽为全会话上报）：本会话窗口打开/关闭时通知 editor-page 宿主——打开的
  // 哪个会话，单页编辑器就加载哪个（切 Session 内容重载；投影窗记母会话）。
  // header.actions 随会话切换重挂载，天然给出「当前打开的会话」信号。
  useEffect(() => {
    if (mainSid === undefined) return
    editorPageOpenSession(mainSid)
    return () => { editorPageCloseSession(mainSid) }
  }, [mainSid])
  // Script actors from the host (complete after a run) — the menu's source of
  // truth; chat-line actors below only backfill before the first run.
  const [scriptActors, setScriptActors] = useState<string[]>([])
  // 拉取本会话角色列表（host 内存 sessionActors 优先，miss 时 turn_scopes 文件
  // 回退）。seq 序号防竞态：旧响应晚到不得覆盖新值；切会话时 effect cleanup
  // 递增 seq 作废全部在途请求（原实现 cancelled 标志同语义）。
  const actorsFetchSeq = useRef(0)
  const refreshActors = useCallback((sid: string): void => {
    const seq = ++actorsFetchSeq.current
    console.log(`[femo-diag] GET /actors?sessionId=${sid} (seq=${seq})`)
    void fetch(`/femo-plugin/actors?sessionId=${encodeURIComponent(sid)}`)
      .then(response => response.json())
      .then((data: { ok?: boolean; actors?: string[] }) => {
        console.log(`[femo-diag] /actors response (seq=${seq}): ok=${String(data.ok)} actors=${JSON.stringify(data.actors)}`)
        if (seq !== actorsFetchSeq.current) {
          console.log(`[femo-diag] response STALE (seq=${seq} != current ${actorsFetchSeq.current}), dropped`)
          return
        }
        if (data.ok === true && data.actors !== undefined && data.actors.length > 0) {
          setScriptActors(data.actors)
        } else {
          console.log('[femo-diag] response guarded out (ok=false or empty actors) — scriptActors unchanged')
        }
      })
      .catch((error: unknown) => { console.log(`[femo-diag] /actors fetch failed: ${String(error)}`) })
  }, [])
  useEffect(() => {
    if (!viewEligible || mainSid === undefined) return
    refreshActors(mainSid)
    return () => { actorsFetchSeq.current += 1 }
  }, [viewEligible, mainSid, refreshActors])
  // 菜单打开即刷新角色（【2026-09-05 晚·Stage2】：替代原「flow_start SSE 推送
  // 刷新」——2026-08-26 用户拍板「每次 run 工具被调用的时候，同时更新视角选择
  // 菜单」，其信息价值在「用户看菜单时数据要新」，菜单打开时 fetch 一次即达
  // （host 按 sessionId 权威裁决，广播前已把新角色写入 sessionActors）。
  // Stage2 起 femo 主会话页（FEMO外视角）不再持有任何 SSE：直播锚点/圆环都在
  // 投影窗，主会话页零 femo 长连接（connection pool 修复的延续）。
  // scriptActors 更新后，下方投影窗列表 effect（deps 含 scriptActors.length）
  // 自动重拉，菜单项与跳转目标同步。）
  useEffect(() => {
    if (!open || !viewEligible || mainSid === undefined) return
    refreshActors(mainSid)
    warmCatalog?.(mainSid)
    // 开菜单即重拉投影窗清单：重启后曾失败/过期（503）的缓存在这里自愈——
    // 用户「回到主窗口再点视角」就应该能切了，不必刷新整页。
    void refreshWindows(mainSid)
  }, [open, viewEligible, mainSid, refreshActors, warmCatalog, refreshWindows])

  // 投影窗 id 列表（host 幂等创建；视角菜单跳转目标）。
  // 挂载即拉（投影窗身份进本页时也拉——等于顺手唤醒宿主侧未装载的窗）；
  // scriptActors 变化（跑过新脚本）也重拉，菜单项与跳转目标同步。
  // 【2026-09-28】与显示同门（viewEligible 闸）：没有戏缘的普通会话既不显示
  // 按钮也不查窗（查窗会让宿主真建窗 + 挂 FEMO 预设）；有戏缘即照常预拉。
  useEffect(() => {
    if (!viewEligible || mainSid === undefined) return
    void refreshWindows(mainSid)
  }, [viewEligible, mainSid, refreshWindows, scriptActors.length])

  // 点击视角项：打开对应窗（FEMO外=主会话 / 上帝=上帝窗 / 角色=角色窗）。
  // 投影窗不可用时（未运行FEMO脚本）降级为旧 CSS 过滤视图。视角状态记在
  // mainSid 名下（投影窗上操作也归属到主会话，保证跨窗状态一致）。
  // 标签页跟手（2026-08-24）：每个真正 openSession 的分支在跳转「前」读当
  // 前激活 tab 记入一次性标记，目标窗口挂载后对齐（见文件头说明）。
  // 【2026-09-11 修复】缓存未命中不再等同于「没有窗」：先重拉一次清单再裁决
  // （宿主重启后清单曾 503），仍没有才降级 + 给可见提示（见 refreshWindows 注释）。
  const pickView = (id: string): void => {
    setOpen(false)
    const windowsOf = (w: { god?: string; stage?: string; actors: Record<string, string> }): string | undefined =>
      id === 'god' ? w.god : id === 'stage' ? w.stage : w.actors[id]
    void (async (): Promise<void> => {
      if (id === 'offstage') {
        // FEMO外 = 主会话本体；view 状态标记 offstage，CSS 过滤隐藏角色内容
        // （待主模型恢复后主会话表面回归干净）。投影窗上点FEMO外 = 跳回主会话。
        setView(mainSid, 'offstage')
        if (mainSid !== sessionId) {
          pendingTabTransfer = { kind: readActiveTabKind(), expiresAt: Date.now() + 5000 }
          openSession(mainSid)
        }
        return
      }
      let target = windowsOf(proj)
      // 未命中重拉仅限有戏缘的会话（与显示同门，2026-09-28）。
      if (target === undefined && viewEligible && mainSid !== undefined) {
        const fresh = await refreshWindows(mainSid)
        if (fresh !== undefined) target = windowsOf(fresh)
      }
      if (target === undefined) {
        // 真的没有这个投影窗（FEMO脚本还没跑过 / 宿主答不上来）：保留旧的 CSS 过滤
        // 降级，但把原因说出来——不再让用户对着「点了没反应」猜。
        setView(mainSid, id)
        showHint(`「${id}」暂时没有可跳转的投影窗（宿主未装载或FEMO脚本未运行）：先打开一次「FEMO外 · 主模型」再点视角试试。`)
        return
      }
      // FEMO内窗（2026-08-27）：纯FEMO脚本归档窗。不写 view 状态——FEMO内窗自身默认
      // 视图由 femo-proj- 前缀推导为 god 视角（全显），没有 scope 过滤语义。
      if (id !== 'stage') setView(mainSid, id)
      pendingTabTransfer = { kind: readActiveTabKind(), expiresAt: Date.now() + 5000 }
      openSession(target, mainSid)
    })()
  }

  const snapshot = useSession(s => s)

  // 【2026-09-20 旧直播链退役】视角 CSS 过滤拆除：它按镜像时代的 turn→scope
  // 映射隐藏主会话原生行——镜像写入已断电（新戏无原生角色行）、投影窗内容
  // 已由 hub 供给。视角菜单保留（切窗/开角色窗）；旧戏主窗口此后全量显示。
  // 点外部收起：菜单打开期间监听 document 的 pointerdown，点容器外任意空白处
  // 自动收起（与 lineage-fork 官方子代理目录同款交互：pointerdown 即响应，
  // 鼠标/触摸通用）。点击容器内不经此路径：按钮=toggle 关闭、菜单项=pickView
  // 关闭，行为不变。注意：必须在 mainSid 早退 return 之前注册（hooks 不能
  // 条件执行）。
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => { document.removeEventListener('pointerdown', closeOutside) }
  }, [open])

  // femo-proj 母名颜色（2026-08-23 需求1）：投影窗的母 session 名由骨架直接渲染
  // （非末段非 subagent 的段不经过任何插件槽位），官方样式是 .crumb 的三级灰
  // （--dsw-alias-label-tertiary）；主会话名的黑来自 .crumbCurrent 的
  // --dsw-alias-label-primary。用户要求两者一致——把 femo-proj 下第一段面包屑
  // 覆盖成同一 token（自动跟随深浅主题）。插件侧安全注入点=按当前会话切换全局
  // 样式文本：本组件在每个打开的会话头都挂载，sessionId 带 femo-proj- 前缀时
  // 启用规则，切走/卸载即清空。零 DOM 结构改动（MutationObserver 路线弃用，
  // 上次事故根源）。哈希类名取自 rc.2 构建产物 ui-conversation/lib/client.js
  // （升级快照时需对照重放）。
  useEffect(() => {
    const STYLE_ID = 'femo-plugin-proj-mother-name'
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (style === null) {
      style = document.createElement('style')
      style.id = STYLE_ID
      // 0.1.6 加载器认领无主 <style> 并在其他插件热替换时连坐删除——必须自报家门。
      style.setAttribute('data-plugin', 'femo-plugin')
      document.head.appendChild(style)
    }
    style.textContent = typeof sessionId === 'string' && sessionId.startsWith('femo-proj-')
      ? '.c-Z2Na_crumbs .c-Z2Na_crumbSeg:first-child .c-Z2Na_crumb { color: var(--dsw-alias-label-primary); pointer-events: none; }'
      : ''
    return () => { style.textContent = '' }
  }, [sessionId])

  // 标签页跟手·消费端（2026-08-24）：本组件挂在每个 femo 家族窗口的头部，
  // 视角跳转的目标窗口挂载时从这里消费一次性标记——把激活 tab 对齐到「切
  // 换前」所在的一侧。轮询至多 ~2s 等 tab 环渲染；已一致则不点击（不多写
  // 一次持久化 view）。过期/超时一律清标记自愈。
  useEffect(() => {
    // 非 femo 家族窗口不消费（2026-09-28 起 femoFamily 判据，原 mainSid 判据）：
    // 防止 openSession 失败后 5s 内手动切到普通会话时误触发转移。
    if (pendingTabTransfer === null || !femoFamily) return
    const { kind, expiresAt } = pendingTabTransfer
    if (Date.now() > expiresAt) {
      pendingTabTransfer = null
      return
    }
    const wanted = kind === 'editor' ? [FEMO_EDITOR_TAB_LABEL] : CHAT_TAB_LABELS
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      // 只认可见 tab（offsetParent null = display:none，如被宿主隐藏的
      // tab——不可见就不算候选，避免点中不可点的按钮）。
      const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
        .filter(el => el.offsetParent !== null)
      const selected = tabs.find(el => el.getAttribute('aria-selected') === 'true')
      if (selected !== undefined && wanted.includes(selected.textContent ?? '')) {
        window.clearInterval(timer)
        pendingTabTransfer = null
        return
      }
      const target = tabs.find(el => wanted.includes(el.textContent ?? ''))
      if (target !== undefined) {
        target.click()
        window.clearInterval(timer)
        pendingTabTransfer = null
        return
      }
      if (tries >= 20) {
        window.clearInterval(timer)
        pendingTabTransfer = null
      }
    }, 100)
    return () => { window.clearInterval(timer) }
  }, [sessionId, femoFamily])

  // chatActors：主会话 femo-role 行里出现过的角色（scriptActors 拉不到时的
  // 菜单兜底）。【2026-09-20 旧直播链退役】原 hidden 隐藏数（配 CSS 过滤）
  // 一并拆除。
  const { chatActors } = useMemo(() => {
    const actors = new Set<string>()
    for (const node of (snapshot.chat?.nodes?.values() ?? [])) {
      if (node.kind !== 'femo-role') continue
      const data = node.data as FemoChatData | undefined
      if (data === undefined) continue
      if (data.actor !== undefined && data.actor.length > 0) actors.add(data.actor)
    }
    return { chatActors: [...actors] }
  }, [snapshot])

  const actors = scriptActors.length > 0 ? scriptActors : chatActors
  // 显示门卫（2026-09-28 二次拍板收紧）：投影窗自身恒显；其余会话须有戏缘
  // （宿主 /femo-relation 裁决：发起过戏，或在线灵魂绑定里有本会话）。与
  // FEMO 无缘的普通聊天不显示——没跑过戏时上帝视角=主会话视角，按钮是
  // 冗余信息。mainSid 为空仅剩「会话 id 不是字符串 / 投影窗母会话未解析」
  // 两种边角 → 不渲染。
  if (mainSid === undefined) return null
  if (!viewEligible) return null
  // 视角栏显示「当前所处视角」：从当前窗口直接推导，而非查 viewBySession
  // 记录——投影窗自身没有记录（pickView 写在 mainSid 名下），查记录会永远
  // 落到默认值（2026-08-23 bug：诗人窗上仍显示"上帝视角"）。
  //   主会话 → 已存储的视角（无记录=offstage，与 currentView 默认一致）；
  //   god 投影窗 → 'god'；角色投影窗 → 反查 proj.actors 得角色名；
  //   映射未就绪的 femo-proj-* 窗 → 兜底 'god'。
  const activeViewId = ((): string | undefined => {
    if (mainSid === sessionId) {
      const stored = sessionId === undefined ? undefined : getView(sessionId)
      return stored ?? 'offstage'
    }
    if (sessionId === proj.god) return 'god'
    if (sessionId === proj.stage) return 'stage'
    for (const [name, winId] of Object.entries(proj.actors)) {
      if (winId === sessionId) return name
    }
    return typeof sessionId === 'string' && sessionId.startsWith('femo-proj-') ? 'god' : undefined
  })()
  const label = activeViewId === 'god' ? '上帝视角'
    : activeViewId === 'stage' ? 'FEMO内视角'
    : activeViewId === 'offstage' ? 'FEMO外 · 主模型'
    : activeViewId ?? '上帝视角'
  const menu = open
    ? (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          minWidth: '160px',
          maxHeight: '300px',
          overflowY: 'auto',
          background: 'var(--dsw-alias-bg-layer-1, #fff)',
          border: '1px solid var(--dsw-alias-border-l2, #ddd)',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          padding: '4px',
          zIndex: 100,
          fontSize: '13px',
        }}>
          {[
            { id: 'offstage', label: 'FEMO外 · 主模型', Icon: FaRobot },
            { id: 'god', label: '上帝视角', Icon: FaPodcast },
            // 戏内项与角色项同门槛（2026-08-28 用户拍板"和角色视角一个道理"）：
            // 有FEMO脚本记录（角色表非空）才显示——没跑过的脚本其 stage 窗会被宿主
            // 判 blank（Hero 态隐藏整个 header，点进去连视角菜单都消失换不回来）。
            ...actors.length > 0 ? [{ id: 'stage', label: 'FEMO内视角', Icon: FaClapperboard }] : [],
            ...actors.map(actor => ({ id: actor, label: actor, Icon: FaUserSecret })),
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => { pickView(item.id) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                width: '100%',
                padding: '6px 10px',
                border: 'none',
                borderRadius: '6px',
                background: item.id === activeViewId ? 'var(--dsw-alias-button-info-fill, #4a9eff)' : 'transparent',
                color: item.id === activeViewId ? '#fff' : 'var(--dsw-alias-label-primary, #222)',
                cursor: 'pointer',
                textAlign: 'left',
                whiteSpace: 'nowrap',
              }}
            >
              <item.Icon size={14} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )
    : null
  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={activeViewId === 'god' ? '上帝视角：显示全部消息'
          : activeViewId === 'stage' ? 'FEMO内视角：脚本内全部内容（不含FEMO外对话）'
          : activeViewId === 'offstage' ? 'FEMO外 · 主模型'
          : `角色视角：仅显示 ${activeViewId} 可见的消息`}
        onClick={() => { setOpen(value => !value) }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: 'none',
          background: 'transparent',
          padding: 0,
          color: 'var(--dsw-alias-label-primary, #222)',
          cursor: 'pointer',
          fontSize: '12px',
          whiteSpace: 'nowrap',
        }}
      >
        <FaEye size={12} />
        <span>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }}>
          <IconChevronDown />
        </span>
      </button>
      {menu}
      {/* 切窗失败说明条（按钮下方，8s 自愈）：「点了没反应」的可见化。 */}
      {hint !== null && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            maxWidth: 260,
            padding: '6px 8px',
            borderRadius: 8,
            background: 'var(--dsw-alias-bg-layer-1, #fff)',
            border: '1px solid var(--dsw-alias-border-l2, #ddd)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            fontSize: 11.5,
            lineHeight: 1.5,
            color: 'var(--dsw-alias-label-primary, #222)',
            whiteSpace: 'normal',
            zIndex: 101,
          }}
        >
          ⚠ {hint.text}
        </div>
      )}
    </div>
  )
}

/** Femo 主会话的子代理计数菜单（actions 尾部座位）：复用 fork 的 CatalogDropdown
 *  count 变体 + showRunning 运行数文本。归属判定与 FemoViewButton 的 mainSid
 *  同源——只有站在 Femo 主会话本体时渲染；投影窗（子会话的 count 属于其母窗口）
 *  与普通会话返回 null，不受影响。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FemoSubagentCount({ useSession, useSessions, useSessionStatus, openChild, refresh, setCatalogOpen, t }: any) {
  const sessionId = useSession((s: { sessionId?: string }) => s.sessionId) as string | undefined
  const mainSid = useSessions((state): string | undefined => {
    if (typeof sessionId !== 'string') return undefined
    const summary = state.byId[sessionId]
    if (summary?.agentPreset === 'femo-plugin' && summary?.parentId === undefined) return sessionId
    return undefined
  })
  if (mainSid === undefined) return null
  return (
    <CatalogDropdown
      rootSessionId={mainSid}
      variant="count"
      showRunning
      hideWhenZero
      useSessions={useSessions}
      useSessionStatus={useSessionStatus}
      openChild={openChild}
      refresh={refresh}
      setCatalogOpen={setCatalogOpen}
      t={t}
    />
  )
}
