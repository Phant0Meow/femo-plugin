/**
 * main-actor.ts — 壳（2026-09-26 刀⑥收束）：主Agent参与运行执行体已四拆至
 * actors/main/{index,capture,delivery,notice}.ts。
 *
 * 本文件保留的原因：developer/tests/main-delivery-queue.test.mjs 用 esbuild
 * 打包本路径取 captureVerdict 等六件（不许改测试），三家消费方
 * （engine-events / index 总装 / mailbox-push）的 import 路径也经此零改动。
 * 新代码请直接消费 actors/main/*。
 */

export {
  captureVerdict, debugLogMainActor, isMainActorNotice, isMainAnswerPending,
  mainActorSceneActor, pendingNodeName,
} from './actors/main/capture'
export type { CaptureVerdict, PendingAnswer } from './actors/main/capture'
export { abandonMainAnswer, disposeMainDeliveries } from './actors/main/delivery'
export {
  clearGuestActors, clearMainPlayState, flushMainFinalDelta,
  noteFlowLine, noteFlowLineAll, noteMainActor,
} from './actors/main/notice'
export type { FlowLine } from './actors/main/notice'
export {
  installMainActorStreamBridge, mainSessionEventHook, runMainModelTurn,
} from './actors/main/index'
