/**
 * femo-tool-row.tsx — 官方 GenericToolCard/ToolRow 的投影窗 fork（2026-09-20）。
 *
 * 对照基准：dsh 0.1.6-alpha.2 @deepseek-ai/dsh-client-ui-tool 的
 * ToolRow + GenericToolCard + tool-call-model（源文件 packages/client/ui-tool）。
 * 官方是「调用行 + 结果织进调用行内部」的单行披露形态，hub 给的 tool /
 * tool_result 是两个相邻槽——本组件负责把 tool_result 并回前面的调用行
 * （见 hub-window.tsx 的 items 聚合），这里只渲染聚合后的一个调用块。
 *
 * 与官方的差异（都是投影窗数据面决定的，观感不变）：
 *  · 数据来自 hub 槽（name/arguments/output 已是文本），没有 cwd/home/
 *    inspectCall/openFile 的宿主接线——相应能力（路径缩略、Inspect 按钮、
 *    文件链接）不做；
 *  · locale 简化为硬编码 zh 文案（0.1.6 zh 字典原词）——投影窗当前全中文；
 *  · 样式不走 css module（构建链不注入），用 .femo-tr-* 规则表（ensureToolStyles
 *    注入，styles.ts / femo-reasoning-row 同款模式），值抄官方
 *    ToolRow.module.css / ToolCallTree.module.css / DisclosureRow.module.css /
 *    StateDot.module.css。
 */

import { useMemo, useState, type ReactElement } from 'react'
import {
  StateDot,
  IconSearchOutline16,
  IconBrowseOutline16,
  IconApiOutline14,
  IconEditOutline16,
  IconCodeOutline16,
  IconSparkle16,
} from '@deepseek-ai/dsh-client-ui-primitives'

// ── 官方 tool-call-model 的变体表（原样照抄）────────────────────────────────

const TOOL_VARIANTS: Record<string, string> = {
  bash: 'bash',
  pwsh: 'bash',
  read: 'read',
  read_image: 'read',
  web_fetch: 'read',
  web_search: 'search',
  grep: 'search',
  glob: 'search',
  write: 'write',
  edit: 'edit',
  run_code: 'code',
  cordis_package_inspect: 'read',
  cordis_runtime_inspect: 'read',
  cordis_run: 'others',
  cordis_stop: 'others',
  cordis_undefine: 'others',
}

/** zh 字典原词（0.1.6 conversation locale）。 */
const VARIANT_TITLE: Record<string, string> = {
  search: '搜索',
  read: '读取',
  bash: 'Bash',
  write: '写入',
  edit: '编辑',
  code: '代码',
  others: '工具调用',
}

const SUMMARY_KEYS: Record<string, string[]> = {
  bash: ['description', 'command'],
  read: ['path', 'file_path', 'url'],
  search: ['query', 'pattern', 'url'],
  write: ['path', 'file_path'],
  edit: ['path', 'file_path'],
  code: ['description'],
  others: [],
}

// ── 样式注入（.femo-tr-*；值抄官方 ToolRow/ToolCallTree/StateDot module.css）─

let toolStylesInjected = false
export function ensureToolStyles(): void {
  if (toolStylesInjected) return
  toolStylesInjected = true
  const el = document.createElement('style')
  el.setAttribute('data-femo-tool-styles', '')
  // 0.1.6 加载器认领无主 <style> 并连坐删除——必须自报家门（hub-window 同款）。
  el.setAttribute('data-plugin', 'femo-plugin')
  el.textContent = [
    // 行：24px 高、图标槽 16px、标题 secondary 字号、分隔点 2x2、灰摘要单行截断
    // （DisclosureRow 结构由本组件自绘，故行内各件合进 .femo-tr-row 一条 flex）。
    '.femo-tr-root{display:flex;flex-direction:column;margin:16px 0 0;border-radius:6px}',
    '.femo-tr-row{position:relative;overflow:hidden;display:flex;align-items:center;height:calc(24px + var(--dsh-content-font-delta,0px));min-width:0;cursor:pointer}',
    '.femo-tr-leading{position:relative;flex:none;width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));display:inline-flex;align-items:center;justify-content:center;margin-right:6px;color:var(--dsw-alias-label-tertiary)}',
    '.femo-tr-leading svg:not([data-state]){width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}',
    '.femo-tr-title{flex:none;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-secondary);font-weight:400}',
    '.femo-tr-sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}',
    '.femo-tr-summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}',
    '.femo-tr-summary[data-error]{color:var(--dsw-alias-state-error-primary)}',
    '.femo-tr-chevron{flex:none;color:var(--dsw-alias-label-secondary);margin-left:4px;transition:transform .15s ease}',
    // 运行中扫光（官方 ToolRow.module.css 原样，动画名换 femo-tr）。
    '.femo-tr-root[data-state=running] .femo-tr-row:after{content:"";background:linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-bg-base) 60%, transparent) 55%, transparent 100%);pointer-events:none;width:300px;animation:2.6s ease-out infinite femo-tr-sweep;position:absolute;top:0;bottom:0;left:0}',
    '@keyframes femo-tr-sweep{0%{left:-300px}90%,to{left:100%}}',
    // 展开 IO 卡（官方 .ioCard/.ioSection/.ioLabel/.ioText/.ioDivider 原值）。
    '.femo-tr-body{display:flex;flex-direction:column}',
    '.femo-tr-io{border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);border-radius:12px;flex-direction:column;margin:4px 0 4px 4px;display:flex}',
    '.femo-tr-io-section{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;max-height:150px;padding:12px 16px;display:grid;overflow-y:auto}',
    '.femo-tr-io-label{color:var(--dsw-alias-label-caption);align-self:start;position:sticky;top:0}',
    '.femo-tr-io-divider{background:var(--dsw-alias-border-l2);flex:none;height:.5px}',
    '.femo-tr-io-text{white-space:pre-wrap;word-break:break-word;min-width:0;color:var(--dsw-alias-label-secondary)}',
    '.femo-tr-io-text[data-error]{color:var(--dsw-alias-state-error-primary)}',
  ].join('\n')
  document.head.appendChild(el)
}

// ── 小工具（官方 tool-call-model 同名逻辑的子集）────────────────────────────

function parseArgs(argsRaw: string): unknown {
  try { return JSON.parse(argsRaw) } catch { return undefined }
}

function firstLine(text: string): string {
  const nl = text.indexOf('\n')
  return nl === -1 ? text : text.slice(0, nl)
}

function pickString(args: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = args[key]
    if (typeof v === 'string' && v !== '') return v
  }
  return undefined
}

/** 官方 deriveSummary：变体偏好键 → 首个字符串值 → argsRaw 首行。 */
function deriveSummary(variant: string, argsRaw: string): string {
  const parsed = parseArgs(argsRaw)
  if (typeof parsed !== 'object' || parsed === null) return firstLine(argsRaw)
  const args = parsed as Record<string, unknown>
  if (variant === 'search' && Array.isArray(args.queries)) {
    const queries = args.queries.filter((q): q is string => typeof q === 'string' && q !== '')
    if (queries.length > 0) return queries.map(firstLine).join(', ')
  }
  const picked = pickString(args, SUMMARY_KEYS[variant] ?? [])
  if (picked !== undefined) return firstLine(picked)
  for (const v of Object.values(args)) if (typeof v === 'string' && v !== '') return firstLine(v)
  return firstLine(argsRaw)
}

/** 官方 formatToolBody：入参展开体——code 变体取 .code，其余 pretty JSON。 */
function formatToolBody(variant: string, argsRaw: string): string | null {
  if (argsRaw === '') return null
  const parsed = parseArgs(argsRaw)
  if (parsed === undefined) return argsRaw
  if (variant === 'code' && typeof parsed === 'object' && parsed !== null) {
    const code = (parsed as Record<string, unknown>).code
    if (typeof code === 'string' && code !== '') return code
  }
  return JSON.stringify(parsed, null, 2)
}

const VARIANT_ICONS: Record<string, ReactElement> = {
  search: <IconSearchOutline16 size={14} />,
  read: <IconBrowseOutline16 size={14} />,
  bash: <IconApiOutline14 size={14} />,
  write: <IconEditOutline16 size={14} />,
  edit: <IconEditOutline16 size={14} />,
  code: <IconCodeOutline16 size={14} />,
  others: <IconSparkle16 size={14} />,
}

// ── 组件 ────────────────────────────────────────────────────────────────────

export interface FemoToolRowProps {
  name: string
  argsRaw: string
  /** 定稿输出（hub 的 toolResult.output）；undefined=还没结果（running 观感）。 */
  output?: string
  /** 结果错误标：错误时输出文字染红（官方 ioText[data-error]）。 */
  error?: boolean
}

/**
 * 一个工具调用块 = 官方 ToolRow 单行披露形态（摘要行 + 展开 IO 卡）。
 * title 取变体词（搜索/读取/Bash/工具调用…），summary 取参数摘要，
 * output 有值即定稿（done）；无 output 视为 running（扫光）。
 */
export function FemoToolRow({ name, argsRaw, output, error }: FemoToolRowProps) {
  const [expanded, setExpanded] = useState(false)
  ensureToolStyles()

  const variant = TOOL_VARIANTS[name] ?? 'others'
  const done = output !== undefined
  const state = !done ? 'running' : error ? 'error' : 'ok'
  const title = VARIANT_TITLE[variant] ?? '工具调用'
  const summary = useMemo(() => (argsRaw === '' ? name : deriveSummary(variant, argsRaw)), [variant, argsRaw, name])
  const expandable = argsRaw !== '' || (done && (output ?? '') !== '')
  const open = expanded && expandable
  const bodyText = useMemo(
    () => (open && argsRaw !== '' ? formatToolBody(variant, argsRaw) : null),
    [open, variant, argsRaw],
  )
  const outText = done ? (output ?? '') : null
  // 官方：error 摘要行换成输出首行；否则正常参数摘要。
  const summaryText = state === 'error' && outText ? firstLine(outText) : summary

  return (
    <div className="femo-tr-root" data-state={state} data-tool={name}>
      <div
        className="femo-tr-row"
        role={expandable ? 'button' : undefined}
        aria-expanded={expandable ? open : undefined}
        tabIndex={expandable ? 0 : undefined}
        onClick={expandable ? () => setExpanded(v => !v) : undefined}
        onKeyDown={e => {
          if (!expandable) return
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v) }
        }}
      >
        <span className="femo-tr-leading">
          {state === 'error'
            ? <StateDot state="error" />
            : state === 'stopped'
              ? <StateDot state="warning" />
              : VARIANT_ICONS[variant]}
        </span>
        <span className="femo-tr-title">{title}</span>
        {summaryText !== '' && (
          <>
            <span className="femo-tr-sep" aria-hidden />
            <span className="femo-tr-summary" data-error={state === 'error' || undefined}>{summaryText}</span>
          </>
        )}
        {expandable && (
          <span
            className="femo-tr-chevron"
            style={{ transform: open ? 'rotate(180deg)' : undefined }}
            aria-hidden
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      {open && (
        <div className="femo-tr-body">
          {(bodyText !== null || outText !== null) && (
            <div className="femo-tr-io">
              {bodyText !== null && (
                <div className="femo-tr-io-section">
                  <span className="femo-tr-io-label">输入</span>
                  <span className="femo-tr-io-text">{bodyText}</span>
                </div>
              )}
              {bodyText !== null && outText !== null && <span className="femo-tr-io-divider" aria-hidden />}
              {outText !== null && (
                <div className="femo-tr-io-section">
                  <span className="femo-tr-io-label">输出</span>
                  <span className="femo-tr-io-text" data-error={state === 'error' || undefined}>{outText}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
