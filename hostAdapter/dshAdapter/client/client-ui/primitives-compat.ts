/**
 * client-ui/primitives-compat.ts — 官方 primitives 图标跨版本取用面。
 *
 * 0.1.7-rc.2 把图标重排成「家族 + Regular/Medium/Artwork 变体」：旧名
 * IconXxxOutline14 / IconXxxOutline16 整批消失。按旧名具名导入在 rc2 上得到
 * undefined，一渲染 <undefined/> 就被插槽错误边界吞掉——组件静默消失
 * （视角/选角两下拉、子代理目录、投影窗权限菜单、思考行、hub 窗全中招，
 * 2026-09-26 桌面版实案）。本模块统一从命名空间运行时挑拣：旧宿主走旧名，
 * 新宿主走新家族；两代都缺则回 undefined（由调用方决定是否降级，不炸边界）。
 *
 * 调用签名兼容性：新家族收 {size?, className?, strokeWidth?}，旧名同款——
 * 既有渲染参数无需改动。新家族缺省 size=14，与旧 14 家族观感一致。
 */

import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'

type IconComponent = (props: { size?: number; className?: string; strokeWidth?: number }) => unknown

const face = primitives as unknown as Record<string, unknown>

/** 按候选名顺序取第一个函数导出；全缺回 undefined。 */
function pick(...candidates: string[]): IconComponent | undefined {
  for (const name of candidates) {
    const hit = face[name]
    if (typeof hit === 'function') return hit as IconComponent
  }
  return undefined
}

/** 一族图标：旧名优先（老宿主逐字节不变），退新家族基础名，再退笔画变体。 */
function family(legacy: string, stem: string): IconComponent | undefined {
  return pick(legacy, stem, `${stem}Regular`, `${stem}Medium`, `${stem}Artwork`)
}

export const IconChevronDown = family('IconChevronDownOutline14', 'IconChevronDownOutline')
export const IconChevronRight = family('IconChevronRightOutline14', 'IconChevronRightOutline')
export const IconRefresh = family('IconRefreshOutline14', 'IconRefreshOutline')
export const IconThink = family('IconThinkOutline14', 'IconThinkOutline')
export const IconContextInjection = family('IconContextInjectionOutline16', 'IconContextInjectionOutline')
