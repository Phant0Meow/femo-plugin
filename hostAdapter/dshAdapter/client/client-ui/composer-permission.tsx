/**
 * client-ui/composer-permission.tsx — composer 权限菜单拆件（2026-09-26 刀⑧）。
 *
 * 左下角访问模式菜单：显示并切换**主会话**的权限模式。视觉与交互照抄官方
 * PermissionSelect（菜单体与风险弹窗直接用 ui-primitives 的 Menu /
 * RiskConfirmation 官方组件）；permissions projection 缺失（宿主无该能力）
 * 时渲染 null——与官方一致。
 */

import { useEffect, useState } from 'react'
import { Menu, RiskConfirmation } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconChevronDown } from './primitives-compat'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import { MainSessionFace, useProjectionValue, fill } from './composer-common'

interface PermissionOption {
  name: string
  value: string
  description?: string
}

/** ui-permission-presets 推送的 permissions projection 值形状（消费子集）。 */
interface PermissionValue {
  currentValue: string
  /** 0.1.6-alpha.1 起选项列表迁往独立 permission catalog store，投影值可能不再携带。 */
  options?: PermissionOption[]
}

const FULL_ACCESS = 'danger-full-access'

/* Shield glyphs（照抄 rc.2 PermissionSelect.tsx design set 1556）。 */
const SHIELD_OUTLINE = 'M8.20554 0.899994L14.7901 3.36857V7.01026C14.7901 12 11.0466 14.2103 8.20554 15.3C5.36446 14.2103 1.62012 12 1.62012 7.01026V3.36857L8.20554 0.899994Z'

const permissionGlyphs: Record<string, JSX.Element> = {
  'read-only': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d={SHIELD_OUTLINE} stroke="currentColor" strokeWidth="1.31831" strokeLinejoin="round" />
      <path d="M12.1654 5.7552L8.9447 9.41475C8.73044 9.65816 8.53628 9.8804 8.35774 10.0423C8.1713 10.2114 7.94235 10.3717 7.64016 10.4254C7.48207 10.4535 7.32 10.4552 7.16151 10.4294C6.85843 10.3801 6.62728 10.2223 6.43836 10.0559C6.25752 9.89653 6.06037 9.67732 5.84264 9.43705L4.72925 8.20897L5.63557 7.38707L6.74897 8.61594C6.98603 8.87755 7.12974 9.03533 7.24673 9.13839C7.31033 9.19443 7.34485 9.21476 7.35823 9.22122C7.38068 9.22484 7.40352 9.22515 7.42593 9.22122C7.40522 9.22502 7.42893 9.23294 7.53583 9.136C7.65132 9.03126 7.79316 8.87139 8.02643 8.60638L11.2479 4.94763L12.1654 5.7552Z" fill="currentColor" />
    </svg>
  ),
  'workspace-write': (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8.08887 0.251709C8.20479 0.23085 8.32486 0.241168 8.43652 0.282959L15.0215 2.75171C15.2787 2.84819 15.4492 3.09414 15.4492 3.3689V7.0105C15.4492 7.10986 15.4441 7.2081 15.4414 7.30542C15.0285 7.07175 14.5905 6.87695 14.1309 6.73022V3.82495L8.20508 1.60327L2.2793 3.82495V7.0105C2.27936 9.7171 3.4745 11.5379 5.02734 12.7947C5.01025 12.9942 5 13.1962 5 13.4001C5.00001 13.7617 5.02722 14.1169 5.08008 14.4636C2.91555 13.0393 0.961014 10.752 0.960938 7.0105V3.3689C0.960938 3.09417 1.13146 2.84821 1.38867 2.75171L7.97461 0.282959L8.08887 0.251709Z" fill="currentColor" />
      <path d="M11.3525 5.64688V6.85688H5V5.64688H11.3525Z" fill="currentColor" />
      <path d="M9.5824 8.29376V9.50376H5V8.29376H9.5824Z" fill="currentColor" />
      <path d="M14.6647 15.6852H10.0338C10.3878 15.3751 10.7567 15.0517 11.0772 14.7706C11.2531 14.6164 11.4144 14.4746 11.5511 14.3547H14.6647V15.6852Z" fill="currentColor" />
      <path d="M8.14852 14.1308L7.33925 15.4976C7.22458 15.6912 7.42245 15.9194 7.63037 15.8333L9.09785 15.2254L15.0399 10.0719L14.0905 8.97733L8.14852 14.1308Z" fill="currentColor" />
    </svg>
  ),
  [FULL_ACCESS]: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d={SHIELD_OUTLINE} stroke="currentColor" strokeWidth="1.31831" strokeLinejoin="round" />
      <path d="M9.10094 4.5V8.75939H7.59888V4.5H9.10094Z" fill="currentColor" />
      <path d="M9.10094 9.8114V11.5H7.59888V9.8114H9.10094Z" fill="currentColor" />
    </svg>
  ),
}

/** kebab-case 机器名转标题式显示名；非 kebab 的宿主配置名原样透传（照抄官方 displayName）。 */
function displayName(name: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/u.test(name)) return name
  return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function optionLabel(option: PermissionOption): string {
  return option.value === FULL_ACCESS ? 'Full access' : displayName(option.name)
}

// 官方 conversation 词典中文原文（locales.ts L27/L69-73）。
const ACCESS_CONFIRM_TITLE = '确认启用 Full access？'
const ACCESS_CONFIRM_DESCRIPTION = '启用 Full access 后，agent 将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任当前任务时使用。'
const ACCESS_CONFIRM_ACKNOWLEDGE = '我已了解风险，并愿意继续'
const ACCESS_CONFIRM_CANCEL = '取消'
const ACCESS_CONFIRM_ENABLE = '启用 Full access'

/**
 * 左下角访问模式菜单：显示并切换**主会话**的权限模式。
 * permissions projection 缺失（宿主无该能力）时渲染 null——与官方一致。
 */
export function PermissionMenu({ face, disabled }: { face: MainSessionFace | undefined; disabled: boolean }) {
  const value = useProjectionValue(face, 'permissions') as PermissionValue | undefined
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (!disabled && value !== undefined) return
    setOpen(false)
    setAcknowledged(false)
    setConfirmation(null)
  }, [disabled, value])

  // hooks 全部在条件返回之前（React 规则）；value 缺失=官方同款渲染 null。
  // 0.1.6-alpha.1 起 options 迁往独立 catalog store——投影值缺 options 时同样
  // 渲染 null，否则 .find 崩溃会被官方外壳按「slot 崩溃」处理成隐藏整个 composer。
  if (value === undefined || typeof value !== 'object' || !Array.isArray(value.options) || face?.command === undefined) return null

  const currentValue = pick ?? value.currentValue
  const current = value.options.find(option => option.value === currentValue)
  const busy = pick !== null || confirmation !== null

  const items: MenuEntry[] = value.options
    .filter(option => option.value !== 'custom')
    .map(option => {
      const icon = permissionGlyphs[option.value]
      return { id: option.value, label: optionLabel(option), ...(icon === undefined ? {} : { icon }) }
    })

  const submit = (id: string): void => {
    setPick(id)
    void face.command?.(`/permission ${id}`)
      .catch(() => false)
      .then(() => { setPick(null) })
  }

  const choose = (id: string): void => {
    setOpen(false)
    if (id === value.currentValue) return
    if (id === FULL_ACCESS) {
      setAcknowledged(false)
      setConfirmation(id)
      return
    }
    submit(id)
  }

  const closeConfirmation = (): void => {
    setAcknowledged(false)
    setConfirmation(null)
  }

  const confirmFullAccess = (): void => {
    if (disabled || !acknowledged || confirmation === null) return
    const id = confirmation
    closeConfirmation()
    submit(id)
  }

  return (
    <>
      <Menu
        open={open}
        items={items}
        selectedId={currentValue}
        onSelect={choose}
        onClose={() => { setOpen(false) }}
        side="top"
        anchor={
          <button
            type="button"
            className="femo-comp-perm-trigger"
            aria-label={fill('访问模式，当前：{name}', { name: current === undefined ? displayName(currentValue) : optionLabel(current) })}
            title={current?.description}
            disabled={disabled || busy}
            onClick={() => { setOpen(!open) }}
          >
            {permissionGlyphs[currentValue] !== undefined && (
              <span className="femo-comp-perm-icon" aria-hidden>{permissionGlyphs[currentValue]}</span>
            )}
            <span className="femo-comp-perm-label">{current === undefined ? displayName(currentValue) : optionLabel(current)}</span>
            <span className="femo-comp-perm-chevron" data-open={open} aria-hidden>
              <IconChevronDown />
            </span>
          </button>
        }
      />
      <RiskConfirmation
        open={confirmation !== null}
        title={ACCESS_CONFIRM_TITLE}
        description={ACCESS_CONFIRM_DESCRIPTION}
        acknowledgeLabel={ACCESS_CONFIRM_ACKNOWLEDGE}
        cancelLabel={ACCESS_CONFIRM_CANCEL}
        confirmLabel={ACCESS_CONFIRM_ENABLE}
        acknowledged={acknowledged}
        disabled={disabled}
        onAcknowledgedChange={setAcknowledged}
        onCancel={closeConfirmation}
        onConfirm={confirmFullAccess}
      />
    </>
  )
}
