/**
 * femo-plugin client half (browser) — 浏览器端总装车间。
 *
 * 本文件是插件 web 侧的入口与总装：把 client-ui/ 子目录的各职责模块注册进
 * dsh web 的 slots/conversationEvents。全部 UI 组件、store、样式都在子模块：
 *
 *   client-ui/stream-store.ts   femo_stream 直播缓冲 + SSE 单例 + useFemoStream
 *   client-ui/view-state.ts     视角状态 store + useView/getView/setView
 *   client-ui/styles.ts         femo-stream 样式表一次性注入
 *   client-ui/femo-stream-live.tsx  直播块渲染件（speaker/主Agent锚点共用）
 *   client-ui/chat-node.tsx     femo-plugin/chat 节点定义 + 行渲染视图
 *   client-ui/director-node.tsx 主Agent直播锚点节点定义 + 视图
 *   client-ui/editor-view.tsx   「Femo 编辑器」标签页（画布宿主壳+冲突弹窗）
 *   client-ui/view-button.tsx   视角菜单按钮 + CSS 过滤 + 计数座位
 *   client-ui/composer.tsx      投影窗可输入 composer
 *
 * All @deepseek-ai imports are type-only or shell singletons (external in the
 * bundle); the only other runtime dependency is react (shell singleton).
 * （2026-08-26 结构整理：原 2070 行单文件按职责拆分为上述模块，本文件只剩
 * 总装，行为零变化。）
 */

import { SubagentHeaderLineage as FemoLineage } from './lineage-fork.jsx'
// client-ui 拆出件。
import { ensureFemoStreamStyles } from './client-ui/styles'
import { FemoChatNodeView, femoChatDefinition } from './client-ui/chat-node'
// 【2026-09-11 步3】director-node（主模型发言的旧锚点注册表）已删除：主 Agent
// 轮并入统一轮台账（宿主侧 engine-events 写开轮锚点 + 主Agent流帧带 turn），
// 打字机由 femo2-turn-live 按轮承担。
// 【显示层 v9（proj2）】轮台账 + 唯一渲染器（头/直播尾）。
// 【2026-09-11 步2】V5/V6/V7 三代旧渲染位（turn-nodes.tsx 的 femo-turn-head /
// femo-turn-stream / femo-live-tail）已删除——它们各自带一套"这块属于谁"的判据，
// 与新链路同抢一份数据。旧文件留在 client-ui/turn-nodes.tsx.bak-proj2-step2-20260911。
import {
  Femo2TurnLiveNodeView, Femo2TurnNodeView, proj2Enabled, registerProj2Nodes,
} from './client-ui/proj2'
import { FemoEditorView, type ScriptViewInjected } from './client-ui/editor-view'
import { mountFemoEditorPage } from './client-ui/editor-page'
import { FemoSubagentCount, FemoViewButton, type FemoViewInjected } from './client-ui/view-button'
import { FemoCastButton } from './client-ui/cast-button'
import { ProjectionComposer, type ProjectionComposerInjected } from './client-ui/composer'
// 【链路B 薄壳】投影窗内容接缝：锚行节点（内容来自投影中心，无脑渲染）。
import { femoHubAnchorDefinition, FemoHubAnchorView } from './client-ui/hub-window'

/** Peer packages this plugin needs injected.
 * （workspaces 原为侧边栏按钮 currentCwd 所需，2026-08-30 随按钮移除。）
 * 2026-09-04：conversationEvents 从 inject 移除——rc.1 改名 uiConversation 且
 * register 挂到 .events 下，静态名单无法双版本声明，改为 apply 内双名探测+重试。
 * 2026-09-17：+ uiWorkspace——alpha.2 移除 sessions.open/openSubagent 后开窗
 * 统一走它（0.1.5/alpha.1/alpha.2 三版都有此服务，动态 ctx 守卫要求先声明
 * 才可读）；不声明时 ctx.get('uiWorkspace') 被 rejectGuard 拦截=恒 undefined，
 * 这是「alpha.2 投影窗打不开」修复的第二块拼图。 */
export const inject: string[] = ['slots', 'sessions', 'layout', 'uiWorkspace']

// ── plugin body ───────────────────────────────────────────────────────────

/**
 * Browser plugin body: register the chat nodes and all slots.
 * @param ctx - client root context.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apply(ctx: any): void {
  ensureFemoStreamStyles()
  // 【2026-09-05 连接池修复】不再页面级预开 SSE：apply() 时无条件 acquire 会让
  // 每个页面（包括纯聊天页）常驻占一条 HTTP/1.1 长连接——HMR ws + mux ws +
  // femo SSE = 3 条/页，同源两个标签就 6/6 饿死连接池（「第二个窗口打不开/
  // 刷新打不开」真凶）。现改为按需连接：consumer 挂载期间各自 acquire/release
  // （useFemoStream / useActorUsage / editor-page 有 target 时 / view-button 在
  // femo 会话头部），非 femo 页面零 femo 长连接，行为对 femo 页面不变。
  const slots = ctx?.get?.('slots') ?? ctx?.slots
  if (slots === undefined || typeof slots.inject !== 'function') {
    console.warn('[femo-plugin] slots service unavailable; UI not registered')
    return
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = ctx?.get?.('sessions') as {
    open?(id: string): void
    openSubagent?(address: { parentSessionId: string; childSessionId: string; mode: string }): void
    refreshSubagents?(parentSessionId: string): void
    setSubagentCatalogOpen?(parentSessionId: string, open: boolean): void
    /** 官方公开解析面（service.ts binding()）：按 id 取会话 outward face。 */
    binding?(id: string): { session?: unknown } | undefined
  } | undefined
  // 【alpha.2 兼容 2026-09-17】官方把「打开会话」统一进 uiWorkspace 服务
  // （workspaceNavigation：openSession 内部经 resolveTarget/navigationAddress
  // 自动从子代理目录解析 durable parent address）；同版 sessions.open /
  // sessions.openSubagent 均被移除。旧版无此服务 → undefined，走原链路。
  const uiWorkspace = ctx?.get?.('uiWorkspace') as {
    openSession?(id: string): void
    openWorkspace?(workspaceId: string, fallback?: unknown): void
  } | undefined
  /** 【alpha.2 排查】客户端分支上报：POST 给宿主 /client-probe（host-log 钩子
   *  认领进调试窗 Host 页），F12 控制台同步一份。 */
  const probeClient = (payload: Record<string, unknown>): void => {
    const line = `[femo-probe][open] ${JSON.stringify(payload)}`
    console.log(line)
    void fetch('/femo-plugin/client-probe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => { /* 探针失败不影响主流程 */ })
  }
  // 【alpha.2 排查】启动即报注入结果：uiWorkspace 是否被放行、会话面新旧形态。
  probeClient({
    action: 'boot',
    uiWorkspaceOpen: typeof uiWorkspace?.openSession,
    sessionsOpen: typeof sessions?.open,
    sessionsOpenSubagent: typeof sessions?.openSubagent,
  })
  // 【0.1.7 rc.2 诊断面 2026-09-27】客户端全局崩溃上报：宿主调试窗只能看见
  // 宿主侧日志，客户端炸了（如 lineage 槽位 crash）全靠用户手动 F12——把
  // error/unhandledrejection 统一转投 /client-probe，调试窗 Host 页直达。
  // 每来源去重 30s（React 重渲染会连环抛同一条）。
  if (!(window as unknown as Record<string, unknown>).__femoErrorProbe) {
    ;(window as unknown as Record<string, unknown>).__femoErrorProbe = true
    const lastBySource = new Map<string, number>()
    const report = (source: string, detail: string): void => {
      const now = Date.now()
      if (now - (lastBySource.get(source) ?? 0) < 30_000) return
      lastBySource.set(source, now)
      probeClient({ action: 'client-error', source, detail: detail.slice(0, 600) })
    }
    window.addEventListener('error', (event) => {
      report('error', `${event.message} @ ${event.filename?.split('/').pop()}:${event.lineno}`)
    })
    window.addEventListener('unhandledrejection', (event) => {
      const reason = (event as PromiseRejectionEvent).reason
      report('unhandledrejection', String(reason?.stack ?? reason).slice(0, 600))
    })
  }
  // 【调试面 2026-09-09】window.__femoSessions 调试全局已随刀⑧-3 移除（自述
  // 「排障结束后可整体移除」；全仓零消费方，探针走 probeClient 上报面）。
  // 【版本分流信号】问服务端要 native 标志（0.1.3+ 原生路径）。
  // 两版注册的是同一个合并钥匙组件（lineage-fork.jsx，刀⑧：新旧两把并成一把，
  // 组件内部按 __femoNative 自适配样式/过滤/头部特例）；分支只决定两件事：
  //  - 旧版：额外注册 count 座位（actions 尾部计数菜单；原生的计数在 lineage
  //    触发器本体上，不另设座位）。
  //  - flag 回填值：组件与探针读它定变体。
  // 【缺省翻转（用户拍板 2026-09-25）】问不到（fetch 失败/答非所问）一律按
  // 新版处理——新宿主网络抖动不再拿到必坏旧件；旧宿主已退役，残余风险用户
  // 接受。只有宿主显式自认旧版（ok:true 且 native:false）才走旧件。
  ;(window as unknown as Record<string, unknown>).__femoNative = false
  void fetch('/femo-plugin/native-flag').then(r => r.json()).then((data: { ok?: boolean; native?: boolean }) => {
    const native = !(data.ok === true && data.native === false)
    ;(window as unknown as Record<string, unknown>).__femoNative = native
    if (!native) registerCountSeat()
    registerLineageFork()
    console.log(`[femo-plugin] client ${native ? 'native' : 'legacy'} mode: subagent catalog registered (merged lineage fork)`)
  }).catch(() => {
    ;(window as unknown as Record<string, unknown>).__femoNative = true
    registerLineageFork()
    console.log('[femo-plugin] client native mode (native-flag unreachable — default flipped to native per 2026-09-25 ruling)')
  })

  // ── 会话节点注册（2026-09-04 rc.1 双兼容）─────────────────────────────
  // rc.2：服务名 'conversationEvents'（client-runtime），register 直接挂根上；
  // rc.1：服务名 'uiConversation'（ui-conversation），register 挂 .events 下。
  // 两代定义形状一致（{kind, match, start, update}），仅服务名/挂载点不同。
  // 服务可能晚于本插件就绪（apply 早期 ctx.get 常为 undefined，探针实证），
  // 双名探测 + 1s×20 重试（meow-memory 同款上限）。
  const proj2 = proj2Enabled()
  const registerFemoNodes = (register: (def: unknown) => void): void => {
    register(femoChatDefinition)
    register(femoHubAnchorDefinition)
    if (proj2) {
      // 【显示层 v9】只注册两个定义：轮头 + 直播尾，共用一份轮台账。
      registerProj2Nodes(register)
      return
    }
    // 【2026-09-11 步2】V5/V6/V7 三代渲染位已删（见文件顶 import 处注释）。
    // `?proj2=0` 现在＝**降级模式**：只留普通行 + 主Agent锚，投影窗靠官方区块自绘
    // （有内容、有顺序，但没有角色名行与流式打字机）——保留它是为万一新链路
    // 出问题时还有一个"能看"的退路，日常不该用。
    console.log('[femo-plugin] femo conversation nodes registered (degraded: role only)')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveNodeRegistry = (): ((def: unknown) => void) | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ui = ctx?.get?.('uiConversation') as any
    if (ui?.events?.register !== undefined) {
      return (def: unknown): void => { ui.events.register(def) }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = ctx?.get?.('conversationEvents') as any
    if (legacy?.register !== undefined) return (def: unknown): void => { legacy.register(def) }
    return undefined
  }
  const nodeRegistry = resolveNodeRegistry()
  if (nodeRegistry !== undefined) {
    registerFemoNodes(nodeRegistry)
  } else {
    let tries = 0
    const nodeRegistryTimer = setInterval(() => {
      tries += 1
      const found = resolveNodeRegistry()
      if (found !== undefined) {
        clearInterval(nodeRegistryTimer)
        registerFemoNodes(found)
      } else if (tries >= 20) {
        clearInterval(nodeRegistryTimer)
        console.warn('[femo-plugin] conversation node registry unavailable after 20s; femo-role node not registered')
      }
    }, 1000)
  }

  // FEMO脚本列表/保存注入面（编辑器页 ScriptView 复用）。原第三字段
  // createFemoSession 与 currentCwd/workspaces 解析链随侧边栏按钮一同移除
  // （2026-08-30，唯一消费者就是该按钮）。
  const injected = () => ({
    listScripts: async (): Promise<string[]> => {
      const response = await fetch('/femo-plugin/scripts')
      if (!response.ok) throw new Error(`scripts HTTP ${response.status}`)
      const data = await response.json() as { ok?: boolean; scripts?: string[]; error?: string }
      if (data.ok !== true || data.scripts === undefined) {
        throw new Error(data.error ?? 'list scripts failed')
      }
      return data.scripts
    },
    saveScript: async (name: string, content: string, sessionId?: string): Promise<string> => {
      // 绝对路径（导出流程选目录拼出的完整路径）→ path 直写；
      // 否则按 name 存 user_data/projects/。
      // sessionId 带上则 host 顺写会话记录 {path, text}（导出/覆盖保存统一格式）。
      const isPath = /^[a-zA-Z]:[\\/]/.test(name) || name.startsWith('/') || name.startsWith('\\\\')
      const response = await fetch('/femo-plugin/save-script', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(isPath ? { path: name } : { name }),
          content,
          ...(sessionId !== undefined ? { sessionId } : {}),
        }),
      })
      if (!response.ok) {
        // 透出服务端 error 正文（如 400 的具体原因），不再只报状态码。
        let detail = ''
        try {
          const errData = await response.json() as { error?: string }
          if (typeof errData.error === 'string' && errData.error.length > 0) detail = `: ${errData.error}`
        } catch {
          // non-JSON body: keep the status-only message
        }
        throw new Error(`save-script HTTP ${response.status}${detail}`)
      }
      const data = await response.json() as { ok?: boolean; path?: string; error?: string }
      if (data.ok !== true || data.path === undefined) {
        throw new Error(data.error ?? 'save-script failed')
      }
      return data.path
    },
  })

  // FemoViewButton 注入：打开任意会话（视角菜单跳转投影窗用）+ 投影窗 id 查询。
  const viewInjected = (): FemoViewInjected => ({
    // 预热母会话子代理目录（0.1.3 目录冷加载较慢，菜单打开时提前拉）。
    warmCatalog: (sid: string): void => {
      try { sessions?.refreshSubagents?.(sid) } catch { /* 服务不可用忽略 */ }
    },
    openSession: (id: string, parentSessionId?: string): void => {
      probeClient({ action: 'open-session', id, parentSessionId, native: (window as unknown as Record<string, unknown>).__femoNative === true })
      // 【0.1.3 API 变更】subagent 来源会话（femo-proj 投影窗）的历史加载必须
      // 用「durable parent address」打开（官方 sessions.openSubagent），普通
      // session 地址被宿主拒绝（session/agent-busy: subagent Sessions require
      // their durable parent address，history.ts validateAddress）。旧版普通
      // id 打开即合法，保持原路径不动。
      // selectSubagent 还要求子项已在母目录缓存里（懒加载）——先 refresh，
      // 轮询重试；目录一直不可得再退回普通打开（报错可见优于静默）。
      const native = (window as unknown as Record<string, unknown>).__femoNative === true
      // 【诊断 2026-09-11】开窗路径全程留痕：用户报"点上帝视角→菜单变了→窗口没切"，
      // 靠这条分辨卡在哪一步（native 标志 / 唤醒 fetch / openSubagent 重试/超时）。
      if (native && parentSessionId !== undefined && id.startsWith('femo-proj-')
        && sessions?.openSubagent !== undefined) {
        void (async (): Promise<void> => {
          // 【2026-09-09 深夜五轮】先等宿主把本剧全部投影窗唤醒（ensure 幂等；
          // 冷装载窗经镜像并集合并补齐内容、成为 live 会话），再开窗——否则
          // history 首拉与唤醒竞速，命中空持久层 → 官方 blank 语义隐藏
          // header/flow（白屏）。fetch 即唤醒载体：宿主 ensure 完成才返回。
          let wakeOk = false
          try {
            const r = await fetch(`/femo-plugin/projection-windows?sessionId=${encodeURIComponent(parentSessionId)}`)
            wakeOk = r.ok
          } catch { /* 唤醒探测失败不阻塞开窗（回退原重试链） */ }
          try { sessions.refreshSubagents?.(parentSessionId); } catch { /* 目录服务不可用则直接尝试 */ }
          // 目录冷加载可能较慢（实测 15s+）：重试窗口 20s，期间周期性 refresh。
          for (let attempt = 0; attempt < 40; attempt += 1) {
            try {
              sessions.openSubagent({ parentSessionId, childSessionId: id, mode: 'one-shot' });
              return;
            } catch {
              await new Promise(resolve => setTimeout(resolve, 500));
              if (attempt % 5 === 4) { try { sessions.refreshSubagents?.(parentSessionId); } catch { /* 同上 */ } }
            }
          }
          console.error('[femo-plugin] projection window open timed out (catalog never listed the child):', id)
        })()
        return
      }
      // 【alpha.2 兼容 2026-09-17】sessions.openSubagent / sessions.open 均被官方
      // 移除（会话面改制为 retain/using 作用域模型）——「点了没反应」真因：
      // 旧兜底 sessions?.open?.(id) 在 alpha.2 上是静默 no-op。改走官方
      // uiWorkspace 服务（workspaceNavigation 同源）：openSession 内部
      // resolveTarget→navigationAddress 自动从已装载子代理目录解析 durable
      // parent address；目录冷加载未好时周期 refresh 后重试（对应旧重试链）。
      // 分流判据 = 新代会话面（open 与 openSubagent 双缺）；alpha.1/0.1.5
      // 任一存在 → 落到下方旧尾兜底，行为逐字节不变。
      if (typeof sessions?.open !== 'function' && typeof sessions?.openSubagent !== 'function'
        && typeof uiWorkspace?.openSession === 'function') {
        const warmCatalog = (): void => {
          if (parentSessionId !== undefined) {
            try { sessions?.refreshSubagents?.(parentSessionId) } catch { /* 目录服务不可用则直接尝试 */ }
          }
        }
        probeClient({ action: 'alpha2-open', id, parentSessionId })
        void (async (): Promise<void> => {
          warmCatalog()
          for (let attempt = 1; attempt <= 40; attempt += 1) {
            try {
              // 【0.1.7 rc.1/rc.2 2026-09-27】投影窗必须以「durable direct-parent
              // 地址对象」打开：replaceMain 对非 string 的 target 原样进 selection
              // （rc.1/rc.2 同构），绕过目录解析；字符串 id 形态要先在「已加载的
              // 母目录」里解析出地址，解析不到即回退普通 session 地址 → history
              // 拒收「subagent Sessions require their durable parent address」
              // ＝投影窗「历史加载失败」整窗空白实案。非投影窗照旧字符串 id。
              const isProj = parentSessionId !== undefined && id.startsWith('femo-proj-')
              const target = isProj
                ? { parentSessionId, childSessionId: id, mode: 'one-shot' as const }
                : id
              uiWorkspace?.openSession?.(target)
              probeClient({ action: 'alpha2-open-call', id, attempt, addrForm: isProj ? 'address' : 'id' })
              return
            } catch (error) {
              if (attempt === 40) {
                probeClient({ action: 'alpha2-open-fail', id, error: String(error) })
                console.error('[femo-plugin] alpha.2 projection window open failed:', id, error)
                return
              }
            }
            await new Promise(resolve => setTimeout(resolve, 500))
            if (attempt % 5 === 4) warmCatalog()
          }
        })()
        return
      }
      // 尾兜底（alpha.1/0.1.5：sessions.open 存在，行为不变；alpha.2：它被
      // 移除——理论到不了这里，proj 窗已被上面 alpha.2 分支接走，留探针观测）。
      if (typeof sessions?.open === 'function') {
        sessions.open(id)
        return
      }
      probeClient({ action: 'open-noop', id })
      sessions?.open?.(id)
    },
    listProjectionWindows: async (sid: string): Promise<{ god?: string; stage?: string; actors: Record<string, string> }> => {
      const response = await fetch(`/femo-plugin/projection-windows?sessionId=${encodeURIComponent(sid)}`)
      if (!response.ok) throw new Error(`projection-windows HTTP ${response.status}`)
      const data = await response.json() as { ok?: boolean; god?: string; stage?: string; actors?: Record<string, string> }
      if (data.ok !== true) throw new Error(data.error ?? 'projection-windows failed')
      return { god: data.god, stage: data.stage, actors: data.actors ?? {} }
    },
  })

  // （侧边栏「🎭 FEMO脚本」入口按钮已于 2026-08-30 移除——sidebar.footer.action
  // 槽位不再注册；新建 Femo 会话仍可用 host POST /femo-plugin/create-session API。）

  slots.inject('conversation.chat.node', () => slots.register(
    {
      name: 'conversation.chat.node',
      key: 'femo-role',
      // locale 席位（2026-08-25 崩溃修复）：不声明则 t 不注入，组件内
      // t('copy') 直接 TypeError → SlotErrorBoundary 吞掉全部 femo 节点
      // （流式锚点也随之消失=「说完才上屏」的真凶）。
      locale: 'conversation',
    },
    FemoChatNodeView,
  ))
  // 【链路B 薄壳】hub 锚行渲染位：投影窗内容接缝（内容来自投影中心，无脑渲染）。
  slots.inject('conversation.chat.node', () => slots.register(
    {
      name: 'conversation.chat.node',
      key: 'femo-hub-anchor',
      locale: 'conversation',
    },
    FemoHubAnchorView,
  ))

  // 【2026-09-11 步3】femo-director 槽位随 director-node 定义一同删除。
  if (proj2) {
    // 【显示层 v9】两个渲染位：轮头（📢+名字+失败条）+ 直播尾（流式块+Deep diving）。
    slots.inject('conversation.chat.node', () => slots.register(
      {
        name: 'conversation.chat.node',
        key: 'femo2-turn',
        locale: 'conversation',
      },
      Femo2TurnNodeView,
    ))
    slots.inject('conversation.chat.node', () => slots.register(
      {
        name: 'conversation.chat.node',
        key: 'femo2-turn-live',
        locale: 'conversation',
      },
      Femo2TurnLiveNodeView,
    ))
  }
  // 【2026-09-11 步2】femo-turn-head / femo-turn-stream / femo-live-tail 三个槽位
  // 随定义一同删除（定义与槽位必须成对，否则装配器找不到渲染件）。
  // FemoViewButton：order -20 = preset 徽章(-10)之前、紧贴面包屑区——主窗口
  // 「name / 👁视角  FemoFEMO脚本模式 …」；投影窗「母名 / 👁@角色」（fork 让位后
  // 面包屑只剩斜杠，见 lineage-fork.jsx SubagentHeaderLineage）。
  slots.inject('conversation.session.header.actions', () => slots.register(
    {
      name: 'conversation.session.header.actions',
      id: 'femo-plugin-view',
      order: -20,
      inject: viewInjected,
    },
    FemoViewButton,
  ))

  // ── 角色绑定按钮（actions 尾部，紧挨视角按钮）──────────────────────────
  // 会话给本会话提名一个 soul（开演定格后该角色由本会话本尊出演，不拉
  // 子代理）。绑定/解绑/运行冻结的裁决全在 host 端点 /femo-plugin/cast（提名
  // 制：无占用拒绝，最后指派算数），组件只渲染下拉与结果。【2026-09-28 用户
  // 拍板】解除「仅 FEMO 主会话渲染」：所有顶层会话都显示（投影窗/子代理仍不出，
  // 判据见 cast-button.tsx）。
  slots.inject('conversation.session.header.actions', () => slots.register(
    {
      name: 'conversation.session.header.actions',
      id: 'femo-plugin-cast',
      order: -19,
      inject: () => ({}),
    },
    FemoCastButton,
  ))

  // ── 子代理计数座位（actions 尾部）【仅旧版注册，见 registerLegacyCatalogUi】──
  // Femo 主会话的官方"N 个子代理"计数菜单：原在面包屑区（lineage 槽），fork
  // 让位后移到这里。order 10 = preset(-10) 之后、job-list(20) 之前，即用户要的
  // 「FemoFEMO脚本模式 → 几个子代理 → 几个在跑」。locale 复用官方 'subagent'
  // 命名空间拿文案；仅 Femo 主会话本体渲染，投影窗/普通会话返回 null。
  // （0.1.3 原生版不注册：官方 lineage 槽自带计数菜单，样式与本体一致。）
  const registerCountSeat = (): void => {
    slots.inject('conversation.session.header.actions', () => slots.register(
      {
        name: 'conversation.session.header.actions',
        id: 'femo-plugin-count',
        order: 10,
        locale: 'subagent',
        inject: () => ({
          openChild: (address: { parentSessionId: string; childSessionId: string; mode: string }): void => {
            sessions?.openSubagent?.(address)
          },
          refresh: (parentSessionId: string): void => {
            sessions?.refreshSubagents?.(parentSessionId)
          },
          setCatalogOpen: (parentSessionId: string, open: boolean): void => {
            sessions?.setSubagentCatalogOpen?.(parentSessionId, open)
          },
        }),
      },
      FemoSubagentCount,
    ))
  }

  // ── 子代理下拉过滤（shadow 官方 lineage 槽位）──────────────────────────
  // FEMO脚本机制产生的会话——投影窗（id 前缀 femo-proj-）、常驻执行体
  // （femo-actor-）、节点子代理（label 前缀 femo-node-）——不出现在子代理目录
  // 里；主模型主动拉起的子代理不受影响。过滤/样式/头部特例全在合并钥匙
  // lineage-fork.jsx 内部按变体自适配（刀⑧），本文件只管注册与 flag。
  // priority -10 shadow 官方默认 0（single 槽 lowest renders）。
  // （2026-08-23 历史注记：布局重排第一版曾整体回退（当时疑似其引入视角切
  // 换卡死），后确认卡死根因在 god 窗 chunk 重放数据层、与本文件无关；布局
  // 重排 v2 已重新落地——视角按钮 order -20 / count 座位 order 10 / 母名
  // 黑化走自有 style 元素（MutationObserver 路线永久弃用）。）
  const registerLineageFork = (): void => {
    slots.inject('conversation.session.header.lineage', () => slots.register(
      {
        name: 'conversation.session.header.lineage',
        priority: -10,
        locale: 'subagent',
        inject: () => ({
          openChild: (address: { parentSessionId: string; childSessionId: string; mode: string }): void => {
            sessions?.openSubagent?.(address)
          },
          refresh: (parentSessionId: string): void => {
            sessions?.refreshSubagents?.(parentSessionId)
          },
          setCatalogOpen: (parentSessionId: string, open: boolean): void => {
            sessions?.setSubagentCatalogOpen?.(parentSessionId, open)
          },
        }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      FemoLineage as any,
    ))
  }

  const scriptViewInjected = (): ScriptViewInjected => ({
    listScripts: injected().listScripts,
    readScript: async (path: string): Promise<string> => {
      const response = await fetch(`/femo-plugin/script?path=${encodeURIComponent(path)}`)
      if (!response.ok) throw new Error(`script HTTP ${response.status}`)
      const data = await response.json() as { ok?: boolean; content?: string; error?: string }
      if (data.ok !== true || data.content === undefined) {
        throw new Error(data.error ?? 'read script failed')
      }
      return data.content
    },
    saveScript: injected().saveScript,
    // The script panel plays on the CURRENT session (it is a per-session view).
    runScript: async (sid: string, scriptPath?: string): Promise<void> => {
      const body: { sessionId: string; scriptPath?: string } = { sessionId: sid }
      if (scriptPath !== undefined) body.scriptPath = scriptPath
      const response = await fetch('/femo-plugin/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      let message = `run HTTP ${response.status}`
      try {
        const data = await response.json() as { ok?: boolean; error?: string }
        if (data.ok === true) return
        message = data.error ?? message
      } catch {
        // non-JSON body: keep the status message
      }
      throw new Error(message)
    },
    pauseScript: async (sid: string, jobId?: number): Promise<{ paused?: boolean; state?: string } | undefined> => {
      // §8.4 B3：pause 归属解析——sessionId 必填（只认本会话绑定）；jobId 可选
      // 显式指定（femoGen 暂停按钮带当前 Job 号，宿主按引擎档案裁决归属）。
      // resolve 值带回执（paused:false=无活跃FEMO脚本，femoGen 据此复位按钮；
      // state=引擎侧 Job 现态——paused:true 但 state 已非 running=幂等无操作，
      // femoGen 据此给「引擎没有活跃执行体被停」的知情提示，2026-09-07 214 事故）。
      const qs = new URLSearchParams({ sessionId: sid })
      if (jobId !== undefined) qs.set('jobId', String(jobId))
      const response = await fetch(`/femo-plugin/pause?${qs.toString()}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      let message = `pause HTTP ${response.status}`
      try {
        const data = await response.json() as { ok?: boolean; error?: string; paused?: boolean; state?: string }
        if (data.ok === true) return { paused: data.paused, state: data.state }
        message = data.error ?? message
      } catch {
        // non-JSON body: keep the status message
      }
      throw new Error(message)
    },
    fetchErrors: async (sid: string): Promise<Array<{ ts: number; text: string }>> => {
      const response = await fetch(`/femo-plugin/errors?sessionId=${encodeURIComponent(sid)}`)
      if (!response.ok) throw new Error(`errors HTTP ${response.status}`)
      const data = await response.json() as { ok?: boolean; errors?: Array<{ ts: number; text: string }>; error?: string }
      if (data.ok !== true || data.errors === undefined) {
        throw new Error(data.error ?? 'fetch errors failed')
      }
      return data.errors
    },
    toggleSidebar: () => ctx.layout.toggleSidebar(),
  })

  slots.inject('conversation.view', () => slots.register(
    {
      name: 'conversation.view',
      id: 'femo',
      order: 20,
      label: () => 'FEMO',
      inject: scriptViewInjected,
    },
    FemoEditorView,
  ))

  // ── 单页常驻编辑器（2026-08-26 v3）───────────────────────────────────────
  // body 级隐藏容器 + createRoot：页面寿命内只有一份 FEMOEditor 实例，内容
  // 跟随打开的 Session（view-button 上报 / 锚点注册）。
  // conversation.view 的 FemoEditorView 只是锚点（激活时接收宿主的 DOM）。
  mountFemoEditorPage(scriptViewInjected)


  // 投影窗 composer：selector 匹配 femo-proj-* 会话 → 可输入 composer
  // （替代 dsh 默认的 SubagentReadOnlyComposer 只读链）。priority -20
  // < subagent 的 -10：先匹配我们，未命中才落到只读链。inject 提供主会话
  // face 解析（权限菜单/统计行读主会话数据用）。
  const composerInjected = (): ProjectionComposerInjected => ({
    getSessionFace: (sid: string) => {
      try {
        const binding = sessions?.binding?.(sid)
        // SessionFace 鸭子类型由消费端（composer.tsx MainSessionFace）声明。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return binding?.session as any
      } catch {
        return undefined
      }
    },
  })
  slots.inject('conversation.composer', () => slots.register(
    {
      name: 'conversation.composer',
      priority: -20,
      select: (owner: { session?: { sessionId?: string } }): { isProjection: boolean } | null => {
        const sid = owner.session?.sessionId
        if (typeof sid === 'string' && sid.startsWith('femo-proj-')) return { isProjection: true }
        return null
      },
      inject: composerInjected,
    },
    ProjectionComposer,
  ))
}
