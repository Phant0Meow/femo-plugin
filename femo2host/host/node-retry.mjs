/**
 * node-retry.mjs — 停靠经纪人 + 信号翻译（femo2host 公共层）。
 *
 * 从 dshAdapter/host/node-retry.ts 原样上移（2026-09-15，零宿主依赖——原文件
 * 唯一的 dsh 痕迹 safeSteer 已内联为三行 try/catch 守卫）。引擎对脚本错误发
 * node_retry（执行者重试）与 notify_author（通知作者）两信号；本模块是
 * node_retry 的接收端：把「让执行者再试一次」翻译成一个租约调用——三种执行者
 * （子代理/主模型/人类）一个信号一份租约（kind 翻译表）。
 *
 * 停靠模型：执行体首次交卷后 park（挂起等待裁决）；node_retry 到达时
 * deliverRetry 按 kind 分发；node_settled 到达时 markSettled 放行收尾。裁决
 * 先于 park 到达时暂存 pending（登记永远早于引擎可能发出的第一个信号）。
 *
 * 安全网：park 带 15min 超时（大于 API 五段退避总时长、小于引擎 3600s 等待）；
 * abortAll/abortJob 全场/按 Job 放行；deliverRetry 无 parker 时仅 log——不做
 * 空回传注入（盲目注入可能误喂人类凭据静默跳过一个人类节点，危害大于让引擎
 * 3600s 超时兜底）。
 */

/** 一次停靠裁决。retry=让执行者带着反馈再试一次；done=节点审结（ok/gave_up）
 *  或停靠超时兜底收场；aborted=全场暂停/出错/桥死亡。 */

/** 宿主翻译路由：登记时按事实标注。
 *  - subagent：ai_request 分流拉起的角色执行体，租约=执行体续跑原语；
 *  - main：主模型参与运行在飞注入，租约=主会话注入；
 *  - human：human_wait 等待输入，租约=投影窗提醒（不 park）。
 *  payload.target（'ai'|'human'，引擎认识的执行者类型）是信号语义字段，
 *  与本路由正交共存。 */

/** 停靠超时：大于 API 五段退避总时长（~14.4min 首段起算），小于引擎
 *  wait_for_input 的 3600s——超时按 aborted 收场进既有 finally 清理。 */
const PARK_TIMEOUT_MS = 15 * 60_000;

// ═══ 已退役（观察期起 2026-09-27 femo2host 死代码排查，全仓零引用；观察无误后连块删除）：RETRY_TURN_TIMEOUT_MS（连模块内部都未使用；dsh 侧再导出早已注释） ═══
// /** 重试回合等待上限（停靠循环 whenIdle race 的 5min 段）：steer 后新回合的
//  *  保守收口兜底——正常回合远快于此，超时后按当下事件流片段收场。 */
// export const RETRY_TURN_TIMEOUT_MS = 5 * 60_000;

/** SET VARIABLE 语法教学（单点化）：FEMO脚本语言知识，措辞唯一权威在此。 */
export const SET_VARIABLE_TEACHING = '需要 SET VARIABLE 的节点把赋值另起一行写在台词末尾（必须独占一行才被引擎识别）';

/** 三种执行者共用的重试反馈文案。 */
export function RETRY_STEER_TEXT(attempt, message) {
  return `[femo-plugin·节点重试] 你上一轮的输出未通过FEMO脚本校验（第 ${attempt} 次反馈）：\n${message}\n请基于以上全部过程修正并重新输出本节点台词（${SET_VARIABLE_TEACHING}）。`;
}

/** 租约守卫（原 dsh safeSteer 内联）：租约可能指向会抛错的注入原语，未捕获
 *  会顺着引擎事件回调往上炸——投递失败只记日志，引擎自带 3600s 超时兜底。 */
function guardedSteer(parker, text, tag) {
  try {
    parker.steer(text);
  } catch (error) {
    console.log(`[femo-plugin] steer guard (${tag}): ${String(error)}`);
  }
}

export class NodeRetryBroker {
  constructor() {
    this.parkers = new Map();
  }

  /** 持久登记（幂等：同 waitKey 已存在则跳过——首次登记权威）。 */
  register(spec) {
    if (this.parkers.has(spec.waitKey)) return;
    this.parkers.set(spec.waitKey, { ...spec, state: 'idle' });
  }

  /** 停靠点（仅 subagent/main 调用；human 不 park——引擎在自己的人类重等
   *  循环里等输入）。已暂存裁决 → 立即返回；否则置 parked 并武装 15min 超时。 */
  park(waitKey) {
    const p = this.parkers.get(waitKey);
    if (p === undefined) {
      console.log(`[femo-plugin] park without registration: wait_key=${waitKey}`);
      return Promise.resolve({ kind: 'aborted' });
    }
    if (p.pending !== undefined) {
      const verdict = p.pending;
      p.pending = undefined;
      return Promise.resolve(verdict);
    }
    return new Promise((resolve) => {
      p.resolve = resolve;
      p.state = 'parked';
      p.timer = setTimeout(() => {
        console.log(`[femo-plugin] node-retry park timeout (${Math.round(PARK_TIMEOUT_MS / 60_000)}min): wait_key=${waitKey} node=${p.nodeName}`);
        p.resolve = undefined;
        p.state = 'idle';
        p.timer = undefined;
        resolve({ kind: 'aborted' });
      }, PARK_TIMEOUT_MS);
    });
  }

  /** node_retry 信号的入口。按 kind 分发：
   *  - human → 租约即翻译：显示到人类输入的地方，引擎在自己的人类重等循环
   *    里等重输，宿主零额外机制；
   *  - subagent/main → parked 则 resolve(retry)，否则暂存 pending。
   *  ⚠️ 对 subagent/main 只 resolve/pending，不代调租约——steer 的调用时机
   *  =停靠循环收到 verdict 之后（漏调=重试永远空转）。 */
  deliverRetry(waitKey, feedback, attempt, actorName) {
    const p = this.parkers.get(waitKey);
    if (p === undefined) {
      console.log(`[femo-plugin] node_retry without parker (dropped; engine 3600s timeout covers): wait_key=${waitKey} attempt=${attempt}`);
      return;
    }
    if (p.kind === 'human') {
      guardedSteer(p, feedback, `node_retry human ${waitKey}`);
      return;
    }
    const verdict = { kind: 'retry', feedback, attempt, actorName };
    if (p.state === 'parked' && p.resolve !== undefined) {
      this.clearTimer(p);
      const resolve = p.resolve;
      p.resolve = undefined;
      p.state = 'idle';
      resolve(verdict);
    } else {
      p.pending = verdict;
    }
  }

  /** 停靠循环统一经租约 steer 的出口（循环体不直接触碰执行者）。 */
  steerLease(waitKey, text) {
    const p = this.parkers.get(waitKey);
    if (p === undefined) return;
    guardedSteer(p, text, `lease ${waitKey}`);
  }

  /** node_settled 信号（ai/human 同发）→ resolve(done) + 清 timer（幂等）。
   *  human 不暂存 pending（human 不 park，无消费者）。 */
  markSettled(waitKey) {
    const p = this.parkers.get(waitKey);
    if (p === undefined) return;
    this.clearTimer(p);
    if (p.kind === 'human') return;
    if (p.state === 'parked' && p.resolve !== undefined) {
      const resolve = p.resolve;
      p.resolve = undefined;
      p.state = 'idle';
      resolve({ kind: 'done' });
    } else {
      p.pending = { kind: 'done' };
    }
  }

  /** 全场放行（flow_paused/flow_error/bridge_run_ended/桥死亡）：所有 parker
   *  resolve(aborted) 并清空登记（引擎已停，剩余停靠无意义；幂等）。 */
  abortAll(reason) {
    for (const [waitKey, p] of [...this.parkers]) {
      this.clearTimer(p);
      if (p.state === 'parked' && p.resolve !== undefined) {
        const resolve = p.resolve;
        p.resolve = undefined;
        resolve({ kind: 'aborted' });
      }
      this.parkers.delete(waitKey);
    }
    if (reason.length > 0) console.log(`[femo-plugin] node-retry abortAll: ${reason}`);
  }

  /** Job 域放行：只 abort 本 Job 的 parker——flow_paused/flow_error 清场用，
   *  不误杀其他会话在飞角色（abortAll 保留给桥死亡/卸载全场场景）。 */
  abortJob(jobId, reason) {
    for (const [waitKey, p] of [...this.parkers]) {
      if (p.jobId !== jobId) continue;
      this.clearTimer(p);
      if (p.state === 'parked' && p.resolve !== undefined) {
        const resolve = p.resolve;
        p.resolve = undefined;
        resolve({ kind: 'aborted' });
      }
      this.parkers.delete(waitKey);
    }
    if (reason.length > 0) console.log(`[femo-plugin] node-retry abortJob(${jobId}): ${reason}`);
  }

  has(waitKey) {
    return this.parkers.has(waitKey);
  }

  /** 各方 finally 兜底清登记（幂等防泄漏）。 */
  unregister(waitKey) {
    const p = this.parkers.get(waitKey);
    if (p === undefined) return;
    this.clearTimer(p);
    this.parkers.delete(waitKey);
  }

  /** 卸载：清全部状态（在飞 timer 一并清）。 */
  dispose() {
    this.abortAll('broker disposed');
  }

  clearTimer(p) {
    if (p.timer !== undefined) {
      clearTimeout(p.timer);
      p.timer = undefined;
    }
  }
}
