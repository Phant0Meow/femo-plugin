/**
 * client-ui/composer-common.tsx — composer 拆件的公共底座（2026-09-26 刀⑧）。
 *
 * 主会话 face 鸭子类型与 projection 订阅钩子：统计行/占用环/权限菜单三个
 * 拆件都读主会话 projection，钩子与类型唯一一份在这里。fill 是官方词典
 * 模板填空（统计/权限/圆环共用）。
 */

import { useCallback } from 'react'
import { useSyncExternalStore } from 'react'

/** 提交失败的提示条状态：seq 保证连续同文错误也会重开计时。 */
export interface ComposerError {
  seq: number
  text: string
}

/** ProjectionValueStore 的单 key observable face（identity-stable，见 contract/session.ts ProjectionsFace）。 */
export interface ProjectionValueFace {
  getSnapshot(): unknown
  subscribe(fn: () => void): () => void
}

/** 我们消费的主会话 outward face 子集（SessionFace = ISession & ObservableSnapshot）。 */
export interface MainSessionFace {
  readonly projections?: { faceOf(key: string): ProjectionValueFace }
  command?(line: string): Promise<{ ok?: boolean; value?: { matched?: boolean } }>
  /** 中断主会话当前回合（官方 primaryStops 的 Stop 语义；one-shot 才会被拒，
   * 主会话是普通会话不受影响）。 */
  cancel?(): Promise<unknown>
  /** ObservableSnapshot 半边：对话快照订阅（running 等会话级事实的来源）。 */
  subscribe?(fn: () => void): () => void
  getSnapshot?(): unknown
}

/**
 * 订阅任意会话 face 的一个 projection key（useSyncExternalStore 适配）。
 * faceOf 是 identity-stable bare observable（官方契约），subscribe/getSnapshot
 * 引用稳定；face 缺失时恒定 undefined 快照。
 * @param face - 主会话 face（undefined = 主会话不在前端 store）。
 * @param key - projection key。
 * @returns 当前快照值（无数据为 undefined）。
 */
export function useProjectionValue(face: MainSessionFace | undefined, key: string): unknown {
  const subscribe = useCallback((onChanged: () => void): (() => void) => {
    return face?.projections?.faceOf(key).subscribe(onChanged) ?? (() => { /* 无 face：空订阅 */ })
  }, [face, key])
  const getSnapshot = useCallback((): unknown => {
    return face?.projections?.faceOf(key).getSnapshot() ?? undefined
  }, [face, key])
  return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * 订阅主会话 conversation 快照（ObservableSnapshot<ConversationSnapshot> 半边，
 * useSession 绑定的同一数据源），读 running 等会话级事实。face 引用按会话
 * identity-stable，deps 稳定不重订阅。
 * @param face - 主会话 face。
 * @returns 快照对象（无 face 为 undefined）。
 */
export function useMainSnapshot(face: MainSessionFace | undefined): { running?: boolean } | undefined {
  const subscribe = useCallback((onChanged: () => void): (() => void) => {
    return face?.subscribe?.(onChanged) ?? (() => { /* 无 face：空订阅 */ })
  }, [face])
  const getSnapshot = useCallback((): { running?: boolean } | undefined => {
    return face?.getSnapshot?.() as { running?: boolean } | undefined
  }, [face])
  return useSyncExternalStore(subscribe, getSnapshot)
}

/** 官方 conversation 词典模板填空（{name} 占位；缺参填空串）。 */
export function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/gu, (_, name: string) => params[name] ?? '')
}
