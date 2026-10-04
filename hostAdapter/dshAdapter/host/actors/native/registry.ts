/**
 * actors/native/registry.ts — 常驻角色执行体的身份件（2026-09-26 刀⑥自
 * subagent-native.ts 迁出，纯搬家）。
 *
 * 三件套：
 *  - actorChildren：同角色子代理复用注册表（内存加速键；持久身份由规则化
 *    childId 承担，进程重启即空——重启后靠规则化 childId + persistence.stat
 *    判定「已存在」，直接走 sendMessage 冷恢复）。
 *  - actorTurnLocks：同角色节点串行锁（par 同角色分支防搅回合）。
 *  - nativeChildId：childId 规则化（job 域化）——持久身份的命名规则。
 */

// ── 同角色子代理复用注册表（内存加速键；持久身份由规则化 childId 承担）──────

interface NativeActorEntry {
  childId: string
  actor: string
  /** 所属 Job（childId 段与注册表键都带；菜单按当前 Job 过滤的依据）。 */
  jobId: number
  /** 推理档位在两次节点调用之间的传递（agent/request 钩子按最新值生效）。 */
  reasoning: { actorThinking?: string }
  /** agent/request 钩子是否已装（进程内一次；冷恢复后的新 Agent 实例需重装）。 */
  hooked?: boolean
}
/** 主会话×Job×角色 → 子代理条目。进程重启即空——重启后靠规则化 childId +
 *  persistence.stat 判定「已存在」，直接走 sendMessage 冷恢复。 */
const actorChildren = new Map<string, NativeActorEntry>()

/** 注册表复合键（\u0000 分隔，杜绝 sid/actorKey 内部字符撞键）。 */
function actorRegistryKey(sid: string, jobId: number, actorKey: string): string {
  return `${sid}\u0000j${jobId}\u0000${actorKey}`
}

// ── 同角色节点串行锁（par 同角色分支防搅回合）────────────────────────────

/** lockKey → 尾节点闸门。后到者 await 前闸门：前节点从投递到回合收口（含
 *  停靠重试环）全程持锁，sendMessage 的 steer 语义绝不会把两个节点的话塞进
 *  同一回合。前节点失败不阻塞后节点（各自独立上报引擎）。 */
const actorTurnLocks = new Map<string, Promise<unknown>>()

/** childId 规则化（job 域化）：femo-actor-j<jobId>-<主sid>-<actorKey>
 *  —— job id 紧跟固定前缀（UUID 主 sid 的连字符不会干扰解析），actorKey 收尾；
 *  前端目录过滤按 femo-actor- 前缀整体 ban（常驻执行体不对用户展示）。
 *  同 Job 内同角色复用；新 Job 开新一轮执行体窗口。 */
function nativeChildId(sid: string, jobId: number, actorKey: string): string {
  return `femo-actor-j${jobId}-${sid}-${actorKey}`
}

export {
  type NativeActorEntry,
  actorChildren,
  actorRegistryKey,
  actorTurnLocks,
  nativeChildId,
}
