/**
 * client-ui/composer-ring.tsx — composer 上下文占用圆环拆件（2026-09-26 刀⑧）。
 *
 * 官方 ContextMeter 视觉/交互 1:1 转写：上帝窗圆环读主会话 projection（与主
 * 窗口圆环同源同算法）；角色窗圆环读 actor-usage 快照（host 从子代理会话事件
 * 采样）。两组件共用 ContextRing 渲染。
 */

import { useEffect, useRef, useState } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { useActorUsage } from './stream-store'
import { MainSessionFace, useProjectionValue, fill } from './composer-common'

/** dsh-token-meter 的 contextPressure projection 消费子集（rc.2 原样）。 */
interface ContextPressureProjection {
  pressureTokens?: number
  projectedTokens?: number
  contextWindow?: number
}

/** dsh-token-meter 的 contextBreakdown projection 消费子集（rc.2 原样）。 */
interface ContextBreakdownProjection {
  systemTokens: number
  toolsTokens: number
  messageTokens: number
}

/** 圆环数据源的抽象：上帝窗传主会话 face（projection 读取），角色窗传
 * actor-usage 快照。两组件共用 ContextRing 渲染。 */
interface ContextRingData {
  percent: number
  usedTokens: number
  contextWindow: number
  /** 面板三色分段（system/tools/messages）；undefined=单色整条（官方 fallback）。 */
  breakdown?: ContextBreakdownProjection
  /** 面板附加说明行（角色窗显示模型名）；undefined=不显示。 */
  note?: string
}

/** 近似上下文占用（rc.2 StatsLine contextOccupancy 原样转写）：分子=projectedTokens
 * （provider 样本+其后表面增量的启发式重估，压缩立即可见），缺该字段回退
 * pressureTokens；分母与分子任一缺失 → null（官方同款不渲染）。 */
function contextOccupancy(pressure: ContextPressureProjection | undefined): ContextRingData | null {
  const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens
  if (usedTokens === undefined || pressure?.contextWindow === undefined) return null
  return {
    percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
    usedTokens,
    contextWindow: pressure.contextWindow,
  }
}

/** 圆环几何（官方同款）：14px viewBox，2px 描边。 */
const METER_RADIUS = 5.5
const METER_CIRCUMFERENCE = 2 * Math.PI * METER_RADIUS

/** 面板图例行（官方 ROWS 转写；tint class 对应 femo-comp-meter-tint-*）。 */
const METER_ROWS = [
  { key: 'systemTokens', label: '系统提示词', tintClass: 'femo-comp-meter-tint-system' },
  { key: 'toolsTokens', label: '工具', tintClass: 'femo-comp-meter-tint-tools' },
  { key: 'messageTokens', label: '对话消息', tintClass: 'femo-comp-meter-tint-messages' },
] as const

/** 官方 conversation 词典中文原文（locales.ts L53）。 */
const METER_ARIA = '上下文已用 {percent}'

/**
 * 圆环渲染体（官方 ContextMeter 同款 SVG 与面板结构）。
 * 交互全对齐官方：hover tooltip（面板开时停用）、点击开合、外部点击/Escape
 * 关闭、数据失效自动收面板。
 */
function ContextRing({ data }: { data: ContextRingData }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const percent = data.percent
  const reading = `${percent}%`
  const aria = fill(METER_ARIA, { percent: reading })

  // 外部点击 / Escape 关闭（官方 Menu 的单监听器模式）。数据失效由调用方
  // 直接卸载本组件（GodContextRing/角色窗守卫），无需组件内收面板逻辑。
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent): void => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target) === true) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // 分段（官方同款）：breakdown 缺失或全零 → 单色整条；有 → 按三色占比。
  const breakdown = data.breakdown
  const breakdownTotal = breakdown === undefined
    ? 0
    : breakdown.systemTokens + breakdown.toolsTokens + breakdown.messageTokens
  const parts = breakdown === undefined || breakdownTotal === 0
    ? [{ key: 'total', tintClass: undefined, width: percent }]
    : METER_ROWS.map(row => ({ key: row.key, tintClass: row.tintClass, width: percent * breakdown[row.key] / breakdownTotal }))
  const segments = parts.filter(part => part.width > 0)

  return (
    <span ref={rootRef} className="femo-comp-meter">
      <Tooltip label={aria} side="top" delayMs={200} disabled={open}>
        <button
          type="button"
          className="femo-comp-meter-trigger"
          aria-label={aria}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => { setOpen(!open) }}
        >
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden>
            <circle className="femo-comp-meter-track" cx="7" cy="7" r={METER_RADIUS} />
            <circle
              className="femo-comp-meter-fill"
              cx="7"
              cy="7"
              r={METER_RADIUS}
              strokeDasharray={`${METER_CIRCUMFERENCE * percent / 100} ${METER_CIRCUMFERENCE}`}
              transform="rotate(-90 7 7)"
            />
          </svg>
        </button>
      </Tooltip>
      {open && (
        <div className="femo-comp-meter-panel" role="dialog" aria-label={fill(METER_ARIA, { percent: '' }).trim()}>
          <div className="femo-comp-meter-header">
            <span className="femo-comp-meter-headline">上下文已用</span>
            <span className="femo-comp-meter-percent">{reading}</span>
            <span className="femo-comp-meter-figures">
              {`~${formatTokens(data.usedTokens)} / ${formatTokens(data.contextWindow)}`}
            </span>
          </div>
          <div className="femo-comp-meter-bar">
            {segments.map(segment => (
              <div
                key={segment.key}
                className={segment.tintClass === undefined ? 'femo-comp-meter-segment' : `femo-comp-meter-segment ${segment.tintClass}`}
                style={{ width: `${segment.width}%` }}
              />
            ))}
          </div>
          {data.note !== undefined && (
            <div className="femo-comp-meter-headline">{data.note}</div>
          )}
          {breakdown !== undefined && (
            <dl className="femo-comp-meter-rows">
              {METER_ROWS.map(row => (
                <div key={row.key} className="femo-comp-meter-row">
                  <dt>
                    <span className={`femo-comp-meter-swatch ${row.tintClass}`} aria-hidden />
                    {row.label}
                  </dt>
                  <dd>{`~${formatTokens(breakdown[row.key])}`}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </span>
  )
}

/** 上帝窗圆环：读主会话 contextPressure/contextBreakdown projection（与主
 * 窗口圆环同源同算法）；数据不全不渲染（官方同款）。 */
export function GodContextRing({ face }: { face: MainSessionFace | undefined }) {
  const pressure = useProjectionValue(face, 'contextPressure') as ContextPressureProjection | undefined
  const breakdown = useProjectionValue(face, 'contextBreakdown') as ContextBreakdownProjection | undefined
  const data = contextOccupancy(pressure)
  if (data === null) return null
  return <ContextRing data={breakdown === undefined ? data : { ...data, breakdown }} />
}

/** 角色窗圆环：actor-usage 数据源（host 从子代理会话事件采样——该角色上次
 * 发言时发给 API 的完整 prompt 的 provider 实报 token 量 / 模型窗口容量，
 * 容量缺失 host 已按 1M 兜底）。面板 note 显示模型名；无数据不渲染。 */
export function ActorContextRing({ mainSid, actorKey }: { mainSid: string; actorKey: string }) {
  const usage = useActorUsage(mainSid, actorKey)
  if (usage === undefined || usage.contextWindow <= 0) return null
  return (
    <ContextRing data={{
      percent: Math.min(100, Math.round(usage.usedTokens / usage.contextWindow * 100)),
      usedTokens: usage.usedTokens,
      contextWindow: usage.contextWindow,
      note: usage.model.length > 0 ? `模型 ${usage.model}` : undefined,
    }} />
  )
}
