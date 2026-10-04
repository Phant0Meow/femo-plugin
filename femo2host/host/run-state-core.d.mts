export type MirrorState = 'running' | 'suspended' | 'finished' | 'failed'
export interface WaitingHumanLike {
  waitKey: string
  nodeName?: string
  context?: string
  memory?: string
  showprompt?: string
  prompt?: string
  outVars?: string[]
  waitScope?: string[]
}
export interface JobMirrorLike {
  jobId: number
  ownerSid: string
  state: MirrorState
  waitingHuman?: WaitingHumanLike
  nodeActors: Map<string, string>
  nodeScopes: Map<string, string[]>
  nodeShowprompts: Map<string, string>
}
/** 结构最小面：宿主自己的 RunState 带 extras（sessionActors/errors 等），
 *  结构子类型天然兼容本层全部函数。 */
export interface RunStateLike {
  jobs: Map<number, JobMirrorLike>
  sidIndex: Map<string, number>
  activeJobId?: number
}
export interface ProjectionRunStateLike {
  running: boolean
  waiting: boolean
  waitScope: string[]
  outVars: string[]
  prompt?: string
}
export declare function jobMirrorPrearm(state: RunStateLike, jobId: number, ownerSid: string): void
export declare function jobMirrorCorrect(state: RunStateLike, jobId: number, ownerSid: string): void
export declare function jobMirrorSetState(state: RunStateLike, jobId: number, newState: MirrorState): 'changed' | 'unchanged'
export declare function jobMirrorClear(state: RunStateLike, jobId: number): 'changed' | 'unchanged'
export declare function clearActiveIfActive(state: RunStateLike, jobId: number): boolean
export declare function isSessionRunning(state: RunStateLike, sessionId: string): boolean
export declare function activeJobOf(state: RunStateLike, sessionId: string): JobMirrorLike | undefined
export declare function projectionStateOf(state: RunStateLike, mainSid: string): ProjectionRunStateLike
export declare function noteNodeScope(mirror: JobMirrorLike, nodeName: string | undefined, scope: string[] | undefined): void
export declare function noteNodeActor(mirror: JobMirrorLike, nodeName: string | undefined, actorName: string | undefined): void
export declare function noteNodeShowprompt(mirror: JobMirrorLike, nodeName: string | undefined, showprompt: string | undefined): void
export interface WaitingHumanSnapshot {
  waitKey: string
  nodeName?: string
  context: string
  memory: string
  showprompt?: string
  prompt: string
  outVars: string[]
  waitScope?: string[]
}
export declare function waitingHumanFromEvent(d: Record<string, unknown> | undefined | null): WaitingHumanSnapshot
export declare function setMirrorWaitingHuman(mirror: JobMirrorLike, snapshot: WaitingHumanSnapshot): 'changed' | 'unchanged'
export declare function clearMirrorWaitingHuman(mirror: JobMirrorLike): 'changed' | 'unchanged'
export declare function assertRunAllowed(state: RunStateLike, sessionId: string): void
