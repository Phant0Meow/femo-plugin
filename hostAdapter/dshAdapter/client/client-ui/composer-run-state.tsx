/**
 * client-ui/composer-run-state.tsx — composer FEMO 运行状态域拆件（2026-09-26 刀⑧）。
 *
 * 按钮状态机的输入与获取：FEMO 运行状态快照（host projection-state 接口/SSE
 * projection_state 同形）+ 三重保障获取（2026-09-07：实时通道间歇失效的实测
 * ——落盘/广播都正常但浏览器侧偶发收不到，切窗重挂即恢复）：
 * ①基线=挂载时拉 projection-state；②增量=SSE projection_state（快照语义整体
 * 覆盖）；③兜底=周期轮询+页面聚焦即刷（轻量只读接口，保证按钮/横幅最终一致
 * 秒级收敛，不再依赖任何单通道的实时性）。
 */

import { useCallback, useEffect, useState } from 'react'
import { femoStreamAcquire, subscribeControlEvents } from './stream-store'

/** 投影窗 composer 主按钮的三态（2026-09-06 猫猫拍板：与主模型发言状态解耦，
 * 按「窗型×FEMO脚本态」统一控制）。 */
export type ComposerButtonState = 'send' | 'stop' | 'disabled'

/** FEMO 运行状态快照（host projection-state 接口/SSE projection_state 同形）。 */
export interface FemoRunState {
  running: boolean
  waiting: boolean
  waitScope: string[]
  prompt?: string
  /** 等待人类节点声明的 out 变量名（变量赋值浮层的数据源；非等待为 []）。 */
  outVars: string[]
}

export const IDLE_RUN_STATE: FemoRunState = { running: false, waiting: false, waitScope: [], outVars: [] }

/**
 * 按钮状态机（各投影窗唯一的控制逻辑，2026-09-06 猫猫拍板的矩阵）：
 *  - AI 角色窗：永远 disabled（AI 角色收不到人类输入）；
 *  - 人类角色窗/FEMO内窗/上帝窗（FEMO 运行中）：轮到人类节点且（角色窗时）
 *    等待 scope 含本窗角色 → send，否则 disabled——人类发言发给节点，
 *    与主模型是否在说话无关；
 *  - 上帝窗（FEMO脚本未跑）：主模型说话=stop（点击中断主模型回合，dsh 原生
 *    primaryStops 语义），没说话=send；
 *  - 其余（角色/FEMO内窗FEMO脚本未跑）：disabled。
 * busy（提交中）与空文本只在 send 态禁用，不影响状态判定。
 */
export function composerButtonState(args: {
  winKind: 'god' | 'stage' | 'actor' | 'none'
  actor: string | undefined
  run: FemoRunState
  mainRunning: boolean
}): ComposerButtonState {
  const { winKind, actor, run, mainRunning } = args
  if (winKind === 'god') {
    if (run.running) return run.waiting ? 'send' : 'disabled'
    return mainRunning ? 'stop' : 'send'
  }
  if (winKind === 'stage') {
    return run.running && run.waiting ? 'send' : 'disabled'
  }
  if (winKind === 'actor') {
    // AI 角色窗永远不在 human 节点 scope 里 → 天然恒 disabled；
    // 人类角色窗只在轮到自己时 enable。
    const humanTarget = actor !== undefined && run.waitScope.includes(actor)
    return run.running && run.waiting && humanTarget ? 'send' : 'disabled'
  }
  return 'disabled'
}

/**
 * FEMO 运行状态获取（三通道：基线拉取 + SSE 增量 + 轮询兜底）与窗型解析。
 * @param sessionId - 投影窗会话 id（femo-proj- 前缀；非投影窗恒 none 态）。
 * @param mainSid - 主会话 id（SSE 增量按它过滤）。
 */
export function useFemoRunState(
  sessionId: string | undefined,
  mainSid: string | undefined,
): { run: FemoRunState; winInfo: { winKind: 'god' | 'stage' | 'actor' | 'none'; actor?: string } } {
  const [run, setRun] = useState<FemoRunState>(IDLE_RUN_STATE)
  const [winInfo, setWinInfo] = useState<{ winKind: 'god' | 'stage' | 'actor' | 'none'; actor?: string }>({ winKind: 'none' })
  const applyState = useCallback((data: { ok?: boolean; winKind?: 'god' | 'stage' | 'actor' | 'none'; actor?: string; running?: boolean; waiting?: boolean; waitScope?: string[]; prompt?: string; outVars?: string[] }) => {
    setWinInfo({ winKind: data.winKind ?? 'none', actor: data.actor })
    if (data.ok === true) {
      setRun({
        running: data.running === true,
        waiting: data.waiting === true,
        waitScope: Array.isArray(data.waitScope) ? data.waitScope : [],
        outVars: Array.isArray(data.outVars) ? data.outVars : [],
        prompt: typeof data.prompt === 'string' ? data.prompt : undefined,
      })
    }
  }, [])
  const refreshRunState = useCallback((sessionIdValue: string): void => {
    void fetch(`/femo-plugin/projection-state?sessionId=${encodeURIComponent(sessionIdValue)}`)
      .then(r => r.json())
      .then((data: Parameters<typeof applyState>[0]) => { applyState(data) })
      .catch(() => { /* 接口失败降级为 idle 态（按钮灰，提交链路不受影响） */ })
  }, [applyState])
  useEffect(() => {
    if (sessionId === undefined || !sessionId.startsWith('femo-proj-')) {
      setWinInfo({ winKind: 'none' })
      return
    }
    refreshRunState(sessionId)
    // ③兜底：8s 轮询 + 切回本标签页立即刷（SSE 丢帧时最坏 8s 收敛）。
    const timer = window.setInterval(() => { refreshRunState(sessionId) }, 8000)
    const onVisible = (): void => { if (document.visibilityState === 'visible') refreshRunState(sessionId) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [sessionId, refreshRunState])
  useEffect(() => {
    if (mainSid === undefined) return
    // 持后台 SSE 引用（编辑器同款：tab 开着就持有、不随切后台断）——没有
    // 直播/编辑器在开时也要能收 projection_state 增量。SSE 是引用计数单例，
    // 不新增连接数。
    return femoStreamAcquire({ background: true })
  }, [sessionId, mainSid])
  useEffect(() => {
    if (mainSid === undefined) return
    return subscribeControlEvents(msg => {
      if (msg.type !== 'projection_state') return
      const data = msg.data as { sid?: string; running?: boolean; waiting?: boolean; waitScope?: string[]; prompt?: string; outVars?: string[] } | undefined
      if (data === undefined || data.sid !== mainSid) return
      setRun({
        running: data.running === true,
        waiting: data.waiting === true,
        waitScope: Array.isArray(data.waitScope) ? data.waitScope : [],
        outVars: Array.isArray(data.outVars) ? data.outVars : [],
        prompt: typeof data.prompt === 'string' ? data.prompt : undefined,
      })
    })
  }, [mainSid])
  return { run, winInfo }
}
