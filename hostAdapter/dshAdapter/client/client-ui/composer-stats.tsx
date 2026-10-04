/**
 * client-ui/composer-stats.tsx — composer 统计行拆件（2026-09-26 刀⑧）。
 *
 * 卡片下方统计行：主会话 sessionStats + tokenUsage projection。格式化与
 * 拼装逻辑照抄 rc.2 StatsLine.tsx / message-chrome.ts 纯函数；projection
 * 缺失时整行不渲染（不做 nodes fold 回退，待议）。文案沿用官方中文词典原文。
 */

import { MainSessionFace, useProjectionValue, fill } from './composer-common'

/** dsh-token-meter 的 tokenUsage projection 消费子集。 */
interface TokenUsageProjection {
  uncachedInputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
}

/** dsh-session-stats 的 sessionStats projection 形状（rc.2 StatsLine WindowStats）。 */
interface SessionStatsProjection {
  turns: number
  steps: number
  llmMs: number
  toolMs: number
  ttftMs: number
  ttftSteps: number
  decodeMs: number
  decodeTokens: number
}

// ── 统计格式化（照抄 rc.2 StatsLine.tsx / message-chrome.ts 纯函数）────────

/** Compact token count: 517 / 12.2K / 517K / 1.2M（rc.2 StatsLine formatTokens）。 */
function formatTokens(n: number): string {
  const scaled = (v: number): string =>
    v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${scaled(n / 1_000)}K`
  return `${scaled(n / 1_000_000)}M`
}

/** 45.2s under a minute, 2m42s from there on（rc.2 StatsLine formatDuration）。 */
function formatDuration(ms: number): string {
  const s = ms / 1_000
  if (s < 60) return `${Math.round(s * 10) / 10}s`
  const whole = Math.round(s)
  return `${Math.floor(whole / 60)}m${whole % 60}s`
}

/** Whole tokens from ten up, one decimal below（rc.2 message-chrome formatTokensPerSecond）。 */
function formatTokensPerSecond(tps: number): string {
  const clamped = Math.max(0, tps)
  return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10)
}

/** Sum the three disjoint prompt-side billing buckets（rc.2 StatsLine billedInputTokens）。 */
function billedInputTokens(usage: TokenUsageProjection): number {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

/** Round a cache-read ratio to an integer percentage, positive ties up（rc.2 StatsLine）。 */
function roundedIntegerPercent(cacheReadTokens: number, denominator: number): number {
  const denominatorQuotient = Math.floor(denominator / 200)
  const denominatorRemainder = denominator % 200
  let lower = 0
  let upper = 100
  while (lower < upper) {
    const candidate = Math.floor((lower + upper + 1) / 2)
    const factor = candidate * 2 - 1
    const threshold = factor * denominatorQuotient
      + Math.ceil(factor * denominatorRemainder / 200)
    if (cacheReadTokens >= threshold) {
      lower = candidate
      continue
    }
    upper = candidate - 1
  }
  return lower
}

/** Display-ready cache-hit share（rc.2 StatsLine cacheHitPercent）。 */
function cacheHitPercent(usage: TokenUsageProjection): string | null {
  const denominator = billedInputTokens(usage)
  if (denominator === 0) return null
  const missedInputTokens = usage.uncachedInputTokens + usage.cacheWriteTokens
  if (missedInputTokens === 0) return '100'

  const integerPercent = roundedIntegerPercent(usage.cacheReadTokens, denominator)
  if (integerPercent < 100) return String(integerPercent)

  let decimalPlaces = 1
  let scaledDoubleGap = missedInputTokens * 200
  const denominatorTens = Math.floor(denominator / 10)
  while (scaledDoubleGap <= denominatorTens) {
    scaledDoubleGap *= 10
    decimalPlaces += 1
  }
  const denominatorOnes = denominator % 10
  let roundedLoss = 5
  for (let loss = 1; loss < 5; loss++) {
    const factor = loss * 2 + 1
    const threshold = factor * denominatorTens + Math.floor(factor * denominatorOnes / 10)
    if (scaledDoubleGap <= threshold) {
      roundedLoss = loss
      break
    }
  }
  return `99.${'9'.repeat(decimalPlaces - 1)}${10 - roundedLoss}`
}

// 官方 conversation 词典中文原文（locales.ts L58-64），不走 locale seat 直接常量。
const STATS_COUNTS = '{turns} 轮 · {steps} 步'
const STATS_LLM = 'LLM {duration}'
const STATS_TOOL = '工具调用 {duration}'
const STATS_TTFT = '首 token 平均 {duration}'
const STATS_TPS = '{throughput} tok/s'
const STATS_CACHE_HIT = '缓存命中 {percent}%'
const STATS_TOKENS = '输入 {input} tok · 输出 {output} tok'

/**
 * 卡片下方统计行：显示主会话的轮次/步数/耗时/吞吐与计费数据。
 * 数据全缺（两组都拼不出来）时返回 null——与官方 groups.length===0 行为一致。
 */
export function StatsRow({ face }: { face: MainSessionFace | undefined }) {
  const stats = useProjectionValue(face, 'sessionStats') as SessionStatsProjection | undefined
  const usage = useProjectionValue(face, 'tokenUsage') as TokenUsageProjection | undefined

  const groups: string[] = []
  if (stats !== undefined && typeof stats === 'object' && stats.steps > 0) {
    groups.push(fill(STATS_COUNTS, { turns: String(stats.turns), steps: String(stats.steps) }))
    const durations: string[] = []
    if (stats.llmMs > 0) durations.push(fill(STATS_LLM, { duration: formatDuration(stats.llmMs) }))
    if (stats.toolMs > 0) durations.push(fill(STATS_TOOL, { duration: formatDuration(stats.toolMs) }))
    if (durations.length > 0) groups.push(durations.join(' · '))
    const speeds: string[] = []
    if (stats.ttftSteps > 0) speeds.push(fill(STATS_TTFT, { duration: formatDuration(stats.ttftMs / stats.ttftSteps) }))
    if (stats.decodeMs > 0) {
      speeds.push(fill(STATS_TPS, { throughput: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000)) }))
    }
    if (speeds.length > 0) groups.push(speeds.join(' · '))
  }
  if (usage !== undefined && typeof usage === 'object'
    && (billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
    const cacheHit = cacheHitPercent(usage)
    if (cacheHit !== null) groups.push(fill(STATS_CACHE_HIT, { percent: cacheHit }))
    groups.push(fill(STATS_TOKENS, {
      input: formatTokens(billedInputTokens(usage)),
      output: formatTokens(usage.outputTokens),
    }))
  }

  if (groups.length === 0) return null
  return (
    <div className="femo-comp-stats">
      {groups.map((group, i) => (
        <span key={group}>
          {i > 0 && <><span className="femo-comp-stats-sep" aria-hidden>|</span>{' '}</>}
          {group}
        </span>
      ))}
    </div>
  )
}
