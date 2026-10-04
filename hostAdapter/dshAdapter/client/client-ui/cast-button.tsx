/**
 * client-ui/cast-button.tsx — 角色绑定按钮（session header actions）。
 *
 * 给会话提名一个 soul：开演定格后被选中的角色由本会话本尊出演（宿主
 * 不再为它拉子代理）；解绑即退票。提名制（2026-09-26，废「唯一占用」）：
 * 所有角色都可点——本会话当选的高亮显示、点击退票；别的会话在提名的显示
 * 「他席提名」徽标，点它=改提本会话（最后一次指派算数，下一场定格生效）。
 * 运行冻结（发起会话有 running Job 时绑/解都拒）由 host 端点裁决，报错
 * 原话经浮条展示（8s 自愈，与视角菜单的 hint 同款）。
 *
 * 【2026-09-28 用户拍板】解除「仅 FEMO 主会话渲染」限制：所有顶层会话都
 * 显示灵魂菜单——提名制本就允许多会话同提一个 soul，host 端点对 sid 没有
 * 预设门槛，普通会话照样可以认领角色。投影窗（femo-proj-*）与子代理不出：
 * 它们是展示窗/执行体，不是「会话认领角色」的本体。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { FaCircleCheck, FaMasksTheater } from '../fa-icons'
import { IconChevronDown } from './primitives-compat'

/** 提名账条目（hub cast-preferences 的当选视图 bindings：soul → {sid, host}）。 */
interface CastEntry { sid?: string; host?: string }

interface CastData {
  bindings: Record<string, CastEntry>
  souls: Array<{ soul_id: string; soul_name: string }>
}

/** Session-header action: 给本会话绑定/解绑一个 soul（所有顶层会话渲染）。 */
export function FemoCastButton({ useSession, useSessions }: PropsRuntime<'conversation.session.header.actions'>) {
  const sessionId = useSession(snapshot => snapshot.sessionId)
  // 顶层会话即渲染（2026-09-28 解除限制，判定依据见文件头）：无母=FEMO 主
  // 会话或普通会话本体；投影窗（femo-proj-*）与子代理（有母）一律不渲染。
  const mainSid = useSessions((state): string | undefined => {
    if (typeof sessionId !== 'string') return undefined
    if (sessionId.startsWith('femo-proj-')) return undefined
    const summary = state.byId[sessionId] as
      | { agentPreset?: unknown; projectionValues?: { agentPreset?: unknown }; parentId?: unknown }
      | undefined
    return summary?.parentId === undefined ? sessionId : undefined
  })

  const [open, setOpen] = useState(false)
  const [data, setData] = useState<CastData>({ bindings: {}, souls: [] })
  const [busy, setBusy] = useState(false)
  // 可见提示（按钮下方浮条）：端点 409/404 的人话原话，8s 自愈。
  const [hint, setHint] = useState<{ text: string; seq: number } | null>(null)
  const hintSeq = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const showHint = useCallback((text: string): void => {
    hintSeq.current += 1
    const seq = hintSeq.current
    setHint({ text, seq })
    window.setTimeout(() => { if (hintSeq.current === seq) setHint(null) }, 8000)
  }, [])

  const reload = useCallback(async (): Promise<void> => {
    const response = await fetch('/femo-plugin/cast')
    const json = await response.json() as { ok?: boolean; bindings?: Record<string, CastEntry>; souls?: Array<{ soul_id: string; soul_name: string }> }
    if (json.ok !== true) throw new Error(json.error ?? 'cast fetch failed')
    setData({ bindings: json.bindings ?? {}, souls: json.souls ?? [] })
  }, [])

  // 挂载即拉一次：按钮上要显示已绑的角色名（不依赖用户先开菜单）。
  useEffect(() => {
    if (mainSid === undefined) return
    void reload().catch(() => undefined)
  }, [mainSid, reload])

  // 点外部收起（与视角菜单同款：pointerdown 即响应，鼠标/触摸通用）。
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

  const act = useCallback(async (action: 'bind' | 'unbind', soulId: string): Promise<void> => {
    if (busy || mainSid === undefined) return
    setBusy(true)
    try {
      const response = await fetch('/femo-plugin/cast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, soul_id: soulId, sid: mainSid }),
      })
      const json = await response.json() as { ok?: boolean; error?: string }
      if (json.ok !== true) {
        showHint(json.error ?? '操作失败')
        return
      }
      await reload()
    } catch (error: unknown) {
      showHint(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }, [busy, mainSid, reload, showHint])

  if (mainSid === undefined) return null

  const currentSoul = Object.entries(data.bindings).find(([, entry]) => entry.sid === mainSid)?.[0]
  // human 条目不进菜单（id 约定过滤；真正的 AI/human 正身裁决在FEMO脚本 actors
  // 声明与端点双侧——UI 先挡一道让菜单干净）。
  const souls = data.souls.filter(soul => soul.soul_id !== 'human')

  const menu = open
    ? (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          minWidth: '200px',
          maxHeight: '320px',
          overflowY: 'auto',
          background: 'var(--dsw-alias-bg-layer-1, #fff)',
          border: '1px solid var(--dsw-alias-border-l2, #ddd)',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          padding: '4px',
          zIndex: 100,
          fontSize: '13px',
        }}>
          <div style={{ padding: '5px 10px 3px', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #999)', whiteSpace: 'nowrap' }}>
            提名后本会话出演该角色（不拉子代理）；同角多票时最后一次指派算数
          </div>
          {souls.length === 0 && (
            <div style={{ padding: '6px 10px', color: 'var(--dsw-alias-label-tertiary, #999)' }}>角色库为空</div>
          )}
          {souls.map(soul => {
            const holder = data.bindings[soul.soul_id]
            const isMine = holder !== undefined && holder.sid === mainSid
            const isTaken = holder !== undefined && !isMine
            return (
              <button
                key={soul.soul_id}
                type="button"
                disabled={busy}
                onClick={() => { void act(isMine ? 'unbind' : 'bind', soul.soul_id) }}
                title={isMine ? '点击解绑（退掉本会话的提名）'
                  : isTaken ? '已由其他会话提名——点击改提本会话（最后一次指派算数，下一场定格生效）'
                  : '提名为本会话角色'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: '6px',
                  background: isMine ? 'var(--dsw-alias-button-info-fill, #4a9eff)' : 'transparent',
                  color: isMine ? '#fff' : 'var(--dsw-alias-label-primary, #222)',
                  cursor: busy ? 'default' : 'pointer',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}
              >
                {isMine ? <FaCircleCheck size={13} /> : <FaMasksTheater size={13} />}
                <span>{soul.soul_name || soul.soul_id}</span>
                {isTaken && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #999)' }}>他席提名</span>}
              </button>
            )
          })}
        </div>
      )
    : null

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={currentSoul !== undefined ? `本会话出演：${currentSoul}（点击管理绑定）` : '绑定角色：让本会话亲自出演某个角色'}
        onClick={() => {
          setOpen(value => !value)
          void reload().catch(() => showHint('绑定表拉取失败'))
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: 'none',
          background: 'transparent',
          padding: 0,
          color: currentSoul !== undefined
            ? 'var(--dsw-alias-button-info-fill, #4a9eff)'
            : 'var(--dsw-alias-label-primary, #222)',
          cursor: 'pointer',
          fontSize: '12px',
          whiteSpace: 'nowrap',
        }}
      >
        <FaMasksTheater size={12} />
        {currentSoul !== undefined && <span>{currentSoul}</span>}
        <span style={{ display: 'inline-flex', alignItems: 'center', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }}>
          <IconChevronDown />
        </span>
      </button>
      {menu}
      {/* 操作被拒/拉取失败的说明条（按钮下方，8s 自愈）：与视角菜单 hint 同款。 */}
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
            color: 'var(--dsw-alias-label-primary, #222)',
            whiteSpace: 'normal',
            zIndex: 100,
          }}
        >
          {hint.text}
        </div>
      )}
    </div>
  )
}
