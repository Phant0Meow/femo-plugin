/**
 * hub-window.tsx — 投影窗内容接缝·前端锚行节点（链路B 薄壳实验 2026-09-19）。
 *
 * 渲染规则（用户拍板「内容从 hub 来，无脑渲染」）：
 *   · 宿主在每扇投影窗写一条一次性锚行 femo-plugin/chat{kind:'hub'}
 *     （projection.ts ensureProjectionWindow 内 ensureHubAnchor，幂等、随窗
 *     持久化）——它是接缝挂载点；
 *   · 锚行之前：存量历史由官方渲染器原样呈现（兼容期，不隐藏不重排）；
 *   · 锚行位置：本节点渲染 hub 数据清单——历史行 + 正在写的草稿，按行号 n
 *     升序无脑排列，zone/kind/actor/可见性全部由 hub 定，前端零判断；
 *   · 锚行之后：宿主已关闸（projectionAppend / god-mirror 镜像半边短路），
 *     官方内容不再新增；composer 留痕（user/message）仍走原生渲染。
 *
 * 数据面：GET /femo-plugin/hub-view（宿主代理 hub GET /view，只读）。
 * 每窗 1.5s 轮询：窗内有开着的段（open/drafts）时全量刷（原位改写的行要
 * 拿到新版），否则 after=next 增量；页面隐藏时暂停，切回立拉。hub 不在线 →
 * 顶部一条细提示（老数据仍可见），绝不 5xx 炸 UI。
 */

import { useEffect, useState } from 'react'
import type { ConversationNodeDefinition, ConversationMatch, ConversationNodeContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { useView } from './view-state'
import { actorColor, LeadingIconText } from './chat-node'
import { FaTriangleExclamation } from '../fa-icons'
import { FemoReasoningRow } from '../femo-reasoning-row'
import { FemoToolRow, ensureToolStyles } from '../femo-tool-row'
import { DisclosureRow } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconContextInjection } from './primitives-compat'
import { HUB_ANCHOR_KIND } from './hub-constants'
// 端上共享规范件（2026-09-24）：行解释层的同语义部分唯一活在公共层
// （场次 meta 词表/横幅类/工具槽配对）——呈现（组件/样式）留在本端。
import { metaRowOf, isBannerKind, pairToolSlots } from '../../../../femo2host/host/hub-render-core.mjs'

// ── hub 行类型（消费子集；唯一 schema 见 femo2host/projection_hub.py 文件头）──

interface HubItem {
  kind?: string
  text?: string
  toolCall?: { name?: string; arguments?: string }
  toolResult?: { node?: string; output?: string }
}

/** 渲染槽（HubLine 内聚合产出）：tool 槽携带其相邻 tool_result（官方单行披露形态）。 */
interface RenderSlot {
  type: 'tool'
  name: string
  args: string
  output?: string
  error?: boolean
  /** 配对被跳过的孤儿结果：输出直接可 render。 */
  orphanOutput?: string
}

interface HubDraft {
  kind?: string
  text?: string
  name?: string
}

interface HubRow {
  n: number
  zone?: string
  kind?: string
  actor?: string
  text?: string
  host?: string
  open?: boolean
  /** 段角色标（hub _SECTION_ROLES：main/ai/human；显示层据此选人类观感）。 */
  role?: string
  items?: HubItem[]
  drafts?: HubDraft[]
}

interface HubWindowState {
  /** 锚行事件 seq（唯一状态；本节点恒可见）。 */
  seq: number
}

// ── 节点定义 ─────────────────────────────────────────────────────────────

function isHubAnchorEvent(event: ConversationMatch['event']): boolean {
  if (event.type !== 'femo-plugin/chat') return false
  return (event.data as { kind?: unknown } | undefined)?.kind === HUB_ANCHOR_KIND
}

export function femoHubAnchorMatch(event: ConversationMatch['event']): { id: string; role: 'start' } | null {
  if (!isHubAnchorEvent(event)) return null
  return { id: 'hub-anchor', role: 'start' }
}

export const femoHubAnchorDefinition: ConversationNodeDefinition<HubWindowState> = {
  kind: 'femo-hub-anchor',
  target: 'chat',
  match: femoHubAnchorMatch,
  start: (_context, match) => ({ seq: match.event.seq }),
  update: (context) => context.state ?? { seq: 0 },
  publication: () => 'immediate',
  buildViewNode: (context) => {
    if (context.state === undefined) return null
    return {
      key: context.key,
      kind: 'femo-hub-anchor',
      id: context.id,
      target: 'chat',
      anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0,
      location: { kind: 'unresolved' },
      visibility: 'visible',
      data: context.state,
    }
  },
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    'femo-hub-anchor': HubWindowState
  }
}

// ── 数据拉取（每窗一条轮询循环；页面隐藏时暂停）──────────────────────────

function useHubFeed(sessionId: string | undefined): { rows: HubRow[]; error: boolean; live: boolean; job: number | null } {
  const [rows, setRows] = useState<HubRow[]>([])
  const [error, setError] = useState(false)
  const [live, setLive] = useState(false)
  const [job, setJob] = useState<number | null>(null)

  useEffect(() => {
    if (sessionId === undefined || !sessionId.startsWith('femo-proj-')) return
    const win = sessionId.slice(sessionId.lastIndexOf('-') + 1)
    let stopped = false
    let after = 0
    let visible = document.visibilityState === 'visible'
    let seenRows = false   // 诊断：首次拿到行只打一条 log（1.5s 轮询不刷屏）
    let lastSig = ''       // 诊断：(job,view) 解析变化才打 log
    /** 开着的段（open=true）的行号集：非空时全量刷（原位改写/草稿长字/收口
     *  都要拿到新版行），空时走增量。 */
    const openNs = new Set<number>()

    const onVisible = (): void => {
      visible = document.visibilityState === 'visible'
      if (visible) void tick()
    }

    const tick = async (): Promise<void> => {
      if (stopped || !visible) return
      const q = openNs.size > 0 ? 0 : after
      try {
        const resp = await fetch(`/femo-plugin/hub-view?sessionId=${encodeURIComponent(sessionId)}&win=${encodeURIComponent(win)}&after=${q}`)
        const data = await resp.json() as { ok?: boolean; live?: boolean; rows?: HubRow[]; next?: number }
        if (stopped) return
        if (data.ok !== true) {
          setError(true)
          setLive(false)
          return
        }
        setError(false)
        setLive(data.live === true)
        setJob(typeof data.job === 'number' ? data.job : null)
        const incoming = data.rows ?? []
        const sig = `${String(data.job)}|${String(data.view ?? '')}`
        if (sig !== lastSig) {
          lastSig = sig
          console.log(`[femo-hub] feed ${win}: job=${String(data.job)} view=${String(data.view ?? '-')} rows=${incoming.length} next=${String(data.next)}`)
        }
        if (!seenRows && incoming.length > 0) {
          seenRows = true
          console.log(`[femo-hub] feed ${win}: first rows arrived (n=${incoming.map(r => r.n).join(',')})`)
        }
        if (incoming.length > 0 || q === 0) {
          setRows(prev => {
            const merged = q === 0 ? incoming : [...prev, ...incoming]
            const byN = new Map<number, HubRow>()
            for (const r of merged) byN.set(r.n, r)   // 同 n 保留最新（原位改写）
            return [...byN.values()].sort((a, b) => a.n - b.n)
          })
        }
        if (q === 0) {
          openNs.clear()
          for (const r of incoming) if (r.open === true) openNs.add(r.n)
        } else {
          for (const r of incoming) {
            if (r.open === true) openNs.add(r.n)
            else openNs.delete(r.n)
          }
        }
        if (typeof data.next === 'number' && data.next > after) after = data.next
      } catch (err) {
        if (!stopped) {
          console.warn(`[femo-hub] feed ${win}: fetch failed: ${String(err)}`)
          setError(true)
          setLive(false)
        }
      }
    }

    void tick()
    const timer = window.setInterval(() => { void tick() }, 1500)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sessionId])

  return { rows, error, live, job }
}

// ── 渲染件（无脑渲染：hub 给什么画什么）──────────────────────────────────

/** 样式一次性注入（styles.ts 同款模式；--dsw token 主题自动跟随）。 */
let hubStylesInjected = false
function ensureHubStyles(): void {
  if (hubStylesInjected) return
  ensureToolStyles()   // 官方 ToolRow fork（femo-tool-row.tsx）的 .femo-tr-* 规则表
  hubStylesInjected = true
  const el = document.createElement('style')
  el.setAttribute('data-femo-hub-styles', '')
  // 0.1.6 加载器认领无主 <style> 并在其他插件热替换时连坐删除——必须自报家门。
  el.setAttribute('data-plugin', 'femo-plugin')
  el.textContent = [
    '.femo-hub-root{padding:4px 0 8px}',
    // 【间距体系 v3 2026-09-20 00:11 用户定稿】四档节奏：
    //   · 容器与容器之间 0——.femo-hub-line 兄弟间不加距，容器间距完全由
    //     头部槽顶距承担（首槽 margin 经折叠穿出行边界，天然=容器间距）；
    //   · 头部槽顶距 45（2026-09-20 00:49 用户上调，32→45）：showprompt/
    //     prompt/notice（横幅）与 actor name 行；
    //   · 槽与槽 16——块距=正文行距（官方 0.1.6-alpha.2 和谐律：cot/工具/正文
    //     同住 gap:16px 容器，可见行之间恒 16）；
    //   · tool/tool_result——官方行形态（.femo-tr-root 自带 16 顶距，
    //     2026-09-20 弃两截式后本表不再管工具行）。
    '.femo-hub-status{margin:0 0 16px;padding:5px 12px;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#4a9eff) 8%,transparent);color:var(--dsw-alias-label-tertiary,#999);font-size:12px}',
    '.femo-hub-line{margin:0}',
    '.femo-hub-line + .femo-hub-line{margin-top:0}',
    // 场次 meta 行（play_start/end）是裸 div 不包 .femo-hub-line——场幕分隔
    // 自有节奏，与相邻行保持 16（不属于「容器间 0」规则）。
    '.femo-hub-line + .femo-hub-meta,.femo-hub-meta + .femo-hub-line,.femo-hub-meta + .femo-hub-meta{margin-top:var(--dsh-chat-flow-gap,16px)}',
    // cot 行（FemoReasoningRow→.femo-rr-root）自身零 margin，作为相邻槽时
    // 会塌成 0——行内统一给 16px 顶距（与前面槽的 margin 折叠取大，不双倍）。
    '.femo-hub-line .femo-rr-root{margin-top:16px}',
    '.femo-hub-meta{text-align:center;color:var(--dsw-alias-label-tertiary,#999);font-size:12px;padding:6px 0}',
    // 出错场次行（2026-09-21 场次消息家族）：同款居中小字换警示红（与 retry/fail 同 token）。
    '.femo-hub-meta-err{color:var(--dsw-alias-state-error-primary,#e5484d)}',
    // showprompt / notice / prompt 小字横幅（2026-09-19 用户定稿：去掉标签
    // 行，字号收到原「公告」标签的 10.5px，左对齐、pre-wrap 保留换行）；
    // 金框语义不变，prompt 同构换主题蓝（在等我）。
    '.femo-hub-banner{margin:45px 0 0;padding:5px 10px 4px;border-radius:6px;border:1px solid #c9a44a;background:color-mix(in srgb,#c9a44a 12%,transparent);text-align:left;font-size:10.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word}',
    '.femo-hub-banner.prompt{border-color:var(--dsw-alias-button-info-fill,#4a9eff);background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#4a9eff) 8%,transparent)}',
    // name 行→内容恒 16：间距全由内容槽自带顶距提供，name 底边必须 0——
    // cot 行(.femo-rr-root)与人类气泡行(.femo-hub-userrow)是 flex 容器，
    // flex 的 margin 不与相邻元素折叠，name 留 16px 底边会叠成 32（截图
    // 里 name 下间距忽大忽小的根因：块槽折叠=16、flex 槽不折叠=32）。
    '.femo-hub-actor{font-weight:700;font-size:12.5px;margin:45px 0 0}',
    '.femo-hub-host{color:var(--dsw-alias-label-tertiary,#999);font-weight:500;margin-right:4px;font-size:11.5px}',
    '.femo-hub-open{color:var(--dsw-alias-label-tertiary,#999);font-weight:400;font-size:11.5px;margin-left:4px}',
    // 人类输入块（2026-09-20）：名字右对齐 + 台词用 dsh 原生用户气泡观感
    // （Sixlwa_userRow / Sixlwa_bubble token 原样照搬，主题变量自动跟随）。
    '.femo-hub-actor-human{text-align:right}',
    '.femo-hub-userrow{margin:16px 0 0;display:flex;flex-direction:column;align-items:flex-end}',
    '.femo-hub-userbubble{background:var(--dsw-specific-bubble,#f2f3f5);max-width:min(calc(var(--dsh-chat-content-width,748px) * .702),82%);font-size:var(--dsh-content-font-size,14px);line-height:calc(22px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary,#222);white-space:pre-wrap;word-break:break-word;border-radius:22px;padding:10px 16px}',
    '.femo-hub-whisper{margin:16px 0 0;color:var(--dsw-alias-label-secondary,#666);font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word}',
    // 上下文注入行（2026-09-21 用户拍板：插件 steer 学官方 0.1.6 原生
    // ContextInjectionRow——与工具调用同款披露 chrome；值抄官方
    // ContextInjectionRow.module.css，前缀换 femo-ci）。
    '.femo-ci-root{min-width:0}',
    '.femo-ci-root[data-open]{padding-bottom:4px}',
    '.femo-ci-chevron{color:var(--dsw-alias-label-secondary)}',
    '.femo-ci-sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}',
    '.femo-ci-source{min-width:0;color:var(--dsw-alias-label-tertiary,#999);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}',
    '.femo-ci-summary{min-width:0;color:var(--dsw-alias-label-tertiary,#999);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}',
    '.femo-ci-body{box-sizing:border-box;width:calc(100% - 22px - var(--dsh-content-font-delta,0px));max-height:141px;margin:4px 0 0 calc(22px + var(--dsh-content-font-delta,0px));background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-tertiary,#999);font:400 11px/16px var(--ds-font-family-code,ui-monospace,monospace);border:none;border-radius:8px;padding:10px 16px 12px 12px;overflow:auto;white-space:pre-wrap;word-break:break-word}',
    '.femo-hub-narrate{margin:16px 0 0;padding:6px 12px;border-radius:6px;border-left:3px solid var(--dsw-alias-button-info-fill,#4a9eff);background:color-mix(in srgb,var(--dsw-alias-button-info-fill,#4a9eff) 6%,transparent);color:var(--dsw-alias-label-secondary,#666);font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word}',
    // retry / fail（2026-09-20 用户定稿）：居中一行无边框警示小字，retry 黄
    // fail 红（跟主界面引擎 error 行同色系），行首 FA 警告三角见 HubAlertLine。
    '.femo-hub-retry{margin:16px 0 0;padding:0;text-align:center;color:var(--dsw-alias-button-warning-fill,#d9a441);font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word}',
    '.femo-hub-fail{margin:16px 0 0;padding:0;text-align:center;color:var(--dsw-alias-state-error-primary,#e5484d);font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word}',
    '.femo-hub-say{margin:16px 0 0;font-size:13px;line-height:1.6}',
    // tool / tool_result（2026-09-20 用户拍板：学官方 0.1.6 原生 UI——调用
    // 行 + 结果织进行内 IO 卡，弃旧「灰胶囊 + 左线结果」两截式；样式在
    // femo-tool-row.tsx 的 .femo-tr-*）。这里只留孤儿结果的渲染规则（对齐
    // 官方输出段文案：secondary 字号、tertiary 色、pre-wrap）。
    '.femo-hub-toolresult{margin:16px 0 0;color:var(--dsw-alias-label-tertiary,#999);font-size:var(--dsh-content-font-size-secondary,13px);line-height:1.55;white-space:pre-wrap;word-break:break-word}',
  ].join('\n')
  document.head.appendChild(el)
}

/** 一个草稿槽（段内正在写的字）。 */
function HubDraftRow({ draft }: { draft: HubDraft }) {
  const kind = draft.kind ?? 'say'
  const text = draft.text ?? ''
  if (kind === 'cot') return <FemoReasoningRow text={text} running runningLabel="thinking" />
  if (kind === 'tool') {
    // 草稿=调用还没落定：官方行观感的 running 态（扫光），不可展开。
    return <FemoToolRow name={draft.name ?? 'tool'} argsRaw={text} />
  }
  return <div className="femo-hub-say"><MarkdownText text={text} streaming codeLabels={{ copyLabel: 'copy', copiedLabel: 'copied' }} /></div>
}

/** 插件 steer / 上下文注入行（2026-09-21 用户拍板「学官方原生」）：官方
 *  ContextInjectionRow 的投影窗 fork——折叠行 [注入图标] 上下文注入 · 来源
 *  （producer 标签）· 摘要首行；展开=深色代码块体（pre-wrap 等宽小字，141px 内滚）。
 *  hub 槽没有 producer 元数据，来源标签固定用插件名（femo 桥喂的 kind 全部
 *  来自插件注入；官方 source.kind='plugin' 的 label=source.plugin 同位）。
 *  摘要行与正文对齐官方 DisclosureRow 行高（24px，title secondary 字号）。 */
function HubContextInjectionRow({ text, producerLabel }: { text: string; producerLabel?: string }) {
  const [open, setOpen] = useState(false)
  const summary = firstLineOf(text)
  return (
    <div className="femo-ci-root" data-open={open || undefined} style={{ margin: '16px 0 0' }}>
      <DisclosureRow
        icon={<IconContextInjection size={14} />}
        chevronClassName="femo-ci-chevron"
        title="上下文注入"
        collapsedContent={
          <>
            <span className="femo-ci-sep" aria-hidden />
            <span className="femo-ci-source" data-context-source>{producerLabel ?? 'plugin'}</span>
            <span className="femo-ci-sep" aria-hidden />
            <span className="femo-ci-summary" data-context-summary>{summary}</span>
          </>
        }
        keepContentWhenOpen
        open={open}
        expandable
        expandOnRowClick
        onToggle={() => setOpen(v => !v)}
      >
        <div className="femo-ci-body" data-context-injection-body>{text}</div>
      </DisclosureRow>
    </div>
  )
}

/** 首行摘要（官方 summary 口径：单行截断由 CSS ellipsis 收尾）。 */
function firstLineOf(text: string): string {
  const nl = text.indexOf('\n')
  return nl === -1 ? text : text.slice(0, nl)
}

/** 人类（用户）气泡：FEMO内人类角色段与FEMO外用户发言共用一套（2026-09-20 用户
 *  拍板「戏外用户发言也渲染成 dsh 原生用户气泡，跟戏内人类角色发言共用同
 *  一套代码」）。文本 pre-wrap 直排（官方用户气泡同款 token，主题自动跟随）。 */
function HubUserBubble({ text }: { text: string }) {
  return (
    <div className="femo-hub-userrow">
      <div className="femo-hub-userbubble">{text}</div>
    </div>
  )
}

/** retry / fail 行（2026-09-20 用户定稿）：居中一行无边框警示小字，行首恒挂
 *  FA 警告三角（currentColor 随文字变黄/红）。旧账文本若自带 ⚠️/❌/⛔ 前缀
 *  则剥掉——保证恰好一个图标，不双挂。 */
function HubAlertLine({ kind, text }: { kind: 'retry' | 'fail'; text: string }) {
  return (
    <div className={kind === 'retry' ? 'femo-hub-retry' : 'femo-hub-fail'}>
      <FaTriangleExclamation size={11} style={{ marginRight: 5, verticalAlign: '-1px' }} />
      {text.replace(/^[⚠❌⛔]\uFE0F?\s*/, '')}
    </div>
  )
}

/** showprompt / notice / prompt 的横幅（2026-09-19 用户定稿：无标题行，直接
 *  出内容——字号/对齐/换行规则见 .femo-hub-banner；金/蓝框语义不变。
 *  首缀 emoji → FA 图标同聊天行（LeadingIconText）。 */
function HubNoticeLine({ kind, text }: { kind: 'notice' | 'showprompt' | 'prompt'; text: string }) {
  return (
    <div className={kind === 'prompt' ? 'femo-hub-banner prompt' : 'femo-hub-banner'}>
      <LeadingIconText iconSize={11} text={text} />
    </div>
  )
}

/** 一个定稿槽（items 里的一条）。顺序就是 hub 定好的槽序——这里只按 kind
 *  选样式、按数组序渲染，不排序不重排（2026-09-19 用户拍板：宿主无脑照抄）。
 *  row 只给名字槽捎带行级标注（宿主来源标签、「正在…」）。 */
function HubItemRow({ item, row }: { item: HubItem; row?: HubRow }) {
  const kind = item.kind ?? 'say'
  if (kind === 'name') {
    // 名字槽=段头（hub 注入的头部槽之一）；宿主来源标签与「正在…」一级一次。
    // 人类段名字右对齐（2026-09-20 用户定稿：QQ 式对话方向感）。
    const human = row?.role === 'human'
    return (
      <div className={human ? 'femo-hub-actor femo-hub-actor-human' : 'femo-hub-actor'} style={{ color: actorColor(item.text ?? '') }}>
        {row?.host !== undefined && row.host.length > 0 && <span className="femo-hub-host">[{row.host}]</span>}
        {item.text ?? ''}
        {row?.open === true && <span className="femo-hub-open">·正在…</span>}
      </div>
    )
  }
  if (kind === 'cot') return <FemoReasoningRow text={item.text ?? ''} running={false} runningLabel="thinking" />
  if (isBannerKind(kind)) {
    return <HubNoticeLine kind={kind} text={item.text ?? ''} />
  }
  if (kind === 'retry' || kind === 'fail') {
    return <HubAlertLine kind={kind} text={item.text ?? ''} />
  }
  // tool / tool_result 已在 HubLine 聚合成官方单行披露形态（见下）。
  if (kind === 'tool_result') {
    // 孤儿结果（前面没有调用行可归属）：直接渲染输出文本，不占调用行。
    const res = item.toolResult
    const out = res?.output !== undefined ? res.output : (item.text ?? '')
    return <div className="femo-hub-toolresult">{out}</div>
  }
  if (row?.role === 'human') {
    // 人类段台词 → dsh 原生用户气泡（2026-09-20 用户定稿；与戏外用户发言
    // 共用 HubUserBubble，官方 Sixlwa_userRow/bubble 同款 token）。
    return <HubUserBubble text={item.text ?? ''} />
  }
  return <div className="femo-hub-say"><MarkdownText text={item.text ?? ''} codeLabels={{ copyLabel: 'copy', copiedLabel: 'copied' }} /></div>
}

/** 一行 hub 数据。空段（items 与 drafts 全空）不渲染——hub 契约：占位不显示。 */
function HubLine({ row }: { row: HubRow }) {
  const kind = row.kind ?? 'say'
  // 场次消息家族（2026-09-21 拍板：meta 全视角可见）：词表/分类收共享规范件
  // （2026-09-24，metaRowOf——开场/继续/运行结束=幕布式标签；暂停/出错=完整句子
  // 出原文）；标签字与图标是本端画法。
  const meta = metaRowOf(kind)
  if (meta && !meta.plain) {
    const text = row.text ?? ''
    return <div className="femo-hub-meta"><LeadingIconText text={text.length > 0 ? `${meta.label} · ${text}` : meta.label ?? ''} /></div>
  }
  if (meta?.plain) {
    return <div className={meta.error ? 'femo-hub-meta femo-hub-meta-err' : 'femo-hub-meta'}><LeadingIconText text={row.text ?? ''} /></div>
  }
  // notice 独立行 / 运行结束补投的裸 showprompt、prompt 行：小字横幅，无名字行
  // （横幅类判定收共享规范件 isBannerKind；公告=notice 词汇表——给谁看得见
  // 由 targets 过滤管，文案自带称呼）。
  if (isBannerKind(kind)) {
    return (
      <div className="femo-hub-line">
        <HubNoticeLine kind={kind} text={row.text ?? ''} />
      </div>
    )
  }
  const isSection = kind === 'section'
  const items = row.items ?? []
  const drafts = row.drafts ?? []
  if (isSection && items.length === 0 && drafts.length === 0) return null

  // 官方 0.1.6 形态：结果织进调用行内部。槽聚合（tool_result 并进相邻 tool、
  // 孤儿标记）收共享规范件 pairToolSlots（2026-09-24）——本端把聚合结果翻译
  // 成 RenderSlot（孤儿 tool_result 独立成行渲染）。
  const slots: Array<HubItem | RenderSlot> = []
  for (const s of pairToolSlots(items)) {
    if (s.kind === 'tool') {
      slots.push({
        type: 'tool',
        name: s.toolCall?.name ?? 'tool',
        args: s.toolCall?.arguments ?? '',
        ...(s.pairedOutput !== undefined ? { output: s.pairedOutput } : {}),
      })
      continue
    }
    if (s.kind === 'tool_result') {
      slots.push({
        kind: 'tool_result',
        text: s.toolResult?.output !== undefined ? s.toolResult.output : (s.text ?? ''),
        toolResult: s.toolResult,
      })
      continue
    }
    slots.push(s as HubItem)
  }

  return (
    <div className="femo-hub-line">
      {/* 段落的名字只来自名字槽（HubItemRow 按 tag 原位渲染、现行 UI 风格）——
          不再自己画名字行（2026-09-19 用户拍板：和 HTML 同规，无脑渲染）。
          仅独立行（老格式 say 等）保留行上 actor 的小名字行，同页面气泡。 */}
      {!isSection && row.actor !== undefined && row.actor.length > 0 && !(
        // FEMO外用户发言的气泡行不画名字行（dsh 原生用户气泡无名字；名字恒为
        // 「用户」也不带信息量，2026-09-20）；插件注入行同理——「上下文注入
        // · 来源」行头自带身份（2026-09-21）。
        kind === 'whisper' && (row.role === 'human' || (row.zone === 'outside' && row.actor === '用户') || row.actor === '插件')
      ) && (
        <div className="femo-hub-actor" style={{ color: actorColor(row.actor ?? '') }}>
          {row.host !== undefined && row.host.length > 0 && <span className="femo-hub-host">[{row.host}]</span>}
          {row.actor}
        </div>
      )}
      {kind === 'whisper' && row.text !== undefined && row.text.length > 0 && (
        row.role === 'human' || (row.zone === 'outside' && row.actor === '用户')
          ? <HubUserBubble text={row.text} />
          : row.actor === '插件'
            ? <HubContextInjectionRow text={row.text} producerLabel="femo-plugin" />
            : <div className="femo-hub-whisper"><LeadingIconText text={row.text} /></div>
      )}
      {kind === 'narrate' && row.text !== undefined && row.text.length > 0 && (
        <div className="femo-hub-narrate"><LeadingIconText text={row.text} /></div>
      )}
      {(kind === 'retry' || kind === 'fail') && row.text !== undefined && row.text.length > 0 && (
        <HubAlertLine kind={kind} text={row.text} />
      )}
      {isSection && (
        <>
          {slots.map((slot, i) => {
            if ((slot as RenderSlot).type === 'tool') {
              const tool = slot as RenderSlot
              return <FemoToolRow key={i} name={tool.name} argsRaw={tool.args} output={tool.output} error={tool.error} />
            }
            return <HubItemRow key={i} item={slot as HubItem} row={row} />
          })}
          {drafts.map((draft, i) => <HubDraftRow key={'d' + String(i)} draft={draft} />)}
        </>
      )}
      {kind === 'say' && row.text !== undefined && row.text.length > 0 && (
        <div className="femo-hub-say"><MarkdownText text={row.text} codeLabels={{ copyLabel: 'copy', copiedLabel: 'copied' }} /></div>
      )}
    </div>
  )
}

// 【链路B 诊断】bundle 版本标记：页面 F12 控制台见到本行 = 新 bundle 已加载。
console.log('[femo-hub] bundle marker v3 (official ToolRow disclosure)')

/** 锚行视图：锚点位置渲染 hub 数据清单。 */
export function FemoHubAnchorView({ useSession }: ChatNodeViewProps<'femo-hub-anchor'>) {
  const sessionId = useSession((snapshot: { sessionId?: string }) => snapshot.sessionId) as string | undefined
  const view = useView(sessionId)
  const { rows, error, live, job } = useHubFeed(sessionId)
  ensureHubStyles()
  // 【链路B 诊断】每个锚节点挂载打一条（窗口打开即见；不随轮询重复）。
  // 【0.1.7 rc.2 诊断面】挂载事实同步上报宿主调试窗——锚行「挂没挂」不再靠猜。
  useEffect(() => {
    console.log(`[femo-hub] anchor view mounted sid=${sessionId ?? 'none'}`)
    void fetch('/femo-plugin/client-probe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'hub-anchor-mounted', sessionId: sessionId ?? null }),
    }).catch(() => { /* 探针失败不影响主流程 */ })
  }, [sessionId])
  if (view === 'offstage') return null
  return (
    <div className="femo-hub-root">
      {error && <div className="femo-hub-status">投影中心不在线，内容暂时停更…</div>}
      {!error && !live && rows.length === 0 && job !== null && <div className="femo-hub-status">连接投影中心…</div>}
      {!error && !live && rows.length === 0 && job === null && <div className="femo-hub-status">本次还没有投影数据（运行FEMO脚本后这里显示实况）</div>}
      {rows.map(row => <HubLine key={row.n} row={row} />)}
    </div>
  )
}
