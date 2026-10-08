/**
 * mailbox-push.mjs — 驿站上门收件口（网页版宿主绑定层）。
 *
 * 桥的投递员（mail_courier）在产信现场 POST 本口：
 *   POST /femo-plugin/mailbox-push   { letters: [...], extra?: {...} }
 * 路径固定（bridge.mjs PUSH_PATH 单源），端口经 spawn env FEMO_PUSH_PORT 注入
 * （= 本适配器本地服务的 HTTP 端口）。不设本口也能活（自取模式：collect_notices
 * 兜底），但主Agent任务/角色任务/终局通知就不再实时。
 *
 * 时序契约（先投后发，桥侧保证）：push 回 200 前宿主必须已登记「已办」，
 * 随后同一帧才从引擎事件通道到达 → 消费方按 wait_key/job 去重跳过；
 * push 失败信留柜，事件现场兜底。本口只做登记与分流，不回执业务结果。
 *
 * 分拣（2026-09-29 换芯）：「该办哪件事」的裁决唯一活在公共层
 * mailbox-push-core.decidePush（dsh/autoclaw 同吃），本文件只剩宿主动词层——
 * 已办簿（终局/主Agent回合去重）、主演/角色重试分流、人类席交卷闭包、
 * 终局措辞。与 dsh mailbox-push.ts 同一姿势：decidePush 拿决策对象，按 kind
 * 执行本宿主动词。此前手抄 autoclaw 旧代际翻版的三处漂移（非法结局静默归
 * finished、人类插话信整类缺失、人类拍判据不同）随换芯一并归正。
 */

import { decidePush } from '../../../femo2host/host/mailbox-push-core.mjs';
import { formatStopNotice } from '../../../femo2host/host/notice-core.mjs';

const TAG = '[femo]';

/**
 * @param {object} opts
 * @param {(jobId:number, waitKey:string, output:string, steps?:unknown, soul?:string) => Promise<unknown>} opts.submitOutput
 * @param {(jobId:number, waitKey:string, text:string, soul:string, variables?:object) => Promise<unknown>} opts.submitHumanOutput
 * @param {(msg:string)=>void} [opts.log]
 */
export function createMailboxPush({ submitOutput, submitHumanOutput, log = () => {} }) {
  /** 已喊簿（终局去重：push 成功 + bridge_run_ended 事件现场双来路）。 */
  const announced = new Map(); // `${job_id}` → outcome
  /** 主Agent回合已办簿（wait_key → true）：push 成功登记，事件通道到达时跳过。 */
  const consumedMainKeys = new Set();

  function markAnnounced(jobId, outcome) {
    const key = String(jobId);
    const prev = announced.get(key);
    announced.set(key, outcome ?? prev ?? 'unknown');
    if (announced.size > 100) {
      const first = announced.keys().next().value;
      announced.delete(first);
    }
    return prev !== undefined;
  }

  function markConsumedMain(waitKey) {
    if (!waitKey) return;
    consumedMainKeys.add(waitKey);
    if (consumedMainKeys.size > 200) {
      const first = consumedMainKeys.keys().next().value;
      consumedMainKeys.delete(first);
    }
  }

  /** runtime 事件通道查询：这批主Agent任务 push 已办吗？ */
  function consumedMain(data) {
    return consumedMainKeys.has(String(data?.wait_key ?? ''));
  }

  /** runtime 终局双来路查询：这个 Job 是否已喊过。 */
  function isAnnounced(jobId) {
    return announced.has(String(jobId));
  }

  /** 处理一包上门信。返回分流结果（HTTP 200 由路由层回）。 */
  async function handlePush(body) {
    const d = decidePush(body);

    // ① 终局整包：已喊簿去重（事件通道的同一终局随后到达时跳过）。
    if (d.kind === 'stop') {
      const dup = markAnnounced(d.jobId, d.outcome);
      if (dup) return { handled: 'stop-duplicate' };
      const notice = formatStopNotice({ jobId: d.jobId, outcome: d.outcome, detail: d.detail, letters: d.letters, tag: TAG, panelNote: false });
      log(`push: stop pack job=${d.jobId} outcome=${d.outcome} letters=${d.letters.length}`);
      return { handled: 'stop', jobId: d.jobId, outcome: d.outcome, notice };
    }
    // 非法结局响亮丢弃（绝不把没跑完的戏当「已跑完」广播——少兜底红线）。
    if (d.kind === 'stop-invalid') {
      log(`push: stop pack invalid（outcome=${d.outcome} job=${d.jobId}）——响亮丢弃，不当终局广播`);
      return { handled: 'stop-invalid' };
    }

    // ② 启动运行/续跑信：收信即喊主Agent席/操作台。一次启动运行恰一封，无
    //    兜底双路故不去重。
    if (d.kind === 'play-start') {
      log(`push: play_start job=${d.jobId ?? 0}`);
      return { handled: 'play_start', jobId: d.jobId ?? 0, text: d.text };
    }

    // ③ 重试牌信：主模型的重试=操作台人工席（引擎仍在等同一 wait_key，按
    //    feedback 改后重交）；角色的重试=网页会话天然可重演（同一会话记着
    //    上文），runtime 把审稿意见递进会话让它改。
    if (d.kind === 'retry-invalid') {
      log('push: node_retry without wait_key (dropped)');
      return { handled: 'node_retry-dropped' };
    }
    if (d.kind === 'node-retry') {
      if (d.actorName === '' || d.actorName === 'main') {
        log(`push: node_retry-main wait_key=${d.waitKey} attempt=${d.attempt}`);
        return {
          handled: 'node_retry-main',
          waitKey: d.waitKey,
          feedback: d.feedback,
          attempt: d.attempt,
        };
      }
      log(`push: node_retry for actor "${d.actorName}" (wait_key=${d.waitKey})`);
      // 面单上的 brief（完整九字段料包）是角色重演的原文：决策对象不带它
      // （dsh 的重演走信柜自取），web 就地取——wait_key 对得上才认。
      const brief = (body?.brief && typeof body.brief === 'object' && String(body.brief.wait_key ?? '') === d.waitKey)
        ? body.brief : undefined;
      return {
        handled: 'node_retry-actor',
        actorName: d.actorName,
        waitKey: d.waitKey,
        jobId: d.jobId ?? 0,
        feedback: d.feedback,
        attempt: d.attempt,
        brief,
      };
    }

    // ④ 人类插话信（十连裁⑨）：本宿主没有会话型导演 AI 可注入——如实登记
    //    （服务日志响亮留痕 + handled 标记），不静默落 letters-only。
    if (d.kind === 'interjection-invalid') {
      log('push: user interjection without mainSid (dropped)');
      return { handled: 'interjection-dropped' };
    }
    if (d.kind === 'interjection') {
      log(`push: user interjection mainSid=${d.mainSid.slice(0, 16)}…（web 无导演会话，登记不注入）：${String(d.text).slice(0, 80)}`);
      return { handled: 'interjection', mainSid: d.mainSid, text: d.text };
    }

    // ⑤ 料包三路。
    if (d.kind === 'brief-invalid') {
      log('push: brief without wait_key (dropped)');
      return { handled: 'brief-dropped' };
    }
    if (d.kind === 'brief-main') {
      // 主Agent回合：登记已办（事件通道据此跳过），交入口层呈现。
      markConsumedMain(d.ref);
      const b = (d.brief.blocks && typeof d.brief.blocks === 'object') ? d.brief.blocks : {};
      const jobId = Number(d.brief.job_id ?? d.jobId ?? 0);
      log(`push: main brief job=${jobId} wait_key=${d.ref}`);
      return {
        handled: 'main',
        jobId,
        waitKey: d.ref,
        node: String(d.brief.node_name ?? ''),
        actorName: String(d.brief.actor_name ?? 'main'),
        blocks: b,
      };
    }
    if (d.kind === 'brief-human') {
      // 人类等待面单：scope 首位=执行者 soul。
      const soul = Array.isArray(d.brief.scope) ? String(d.brief.scope[0] || 'human') : 'human';
      const jobId = Number(d.brief.job_id ?? d.jobId ?? 0);
      log(`push: human brief job=${jobId} wait_key=${d.ref} soul=${soul}`);
      return {
        handled: 'human',
        jobId,
        waitKey: d.ref,
        soul,
        prompt: String(d.brief.prompt ?? ''),
        // 交回闭包：人类席答完由入口层把回执交引擎（speech 信，ref=wait_key）。
        submit: (text, variables) => submitHumanOutput(jobId, d.ref, text, soul, variables),
      };
    }
    if (d.kind === 'brief-actor') {
      // AI 角色回合：面单=整个事件 payload（九字段全带，挑字段必漏）。
      return { handled: 'actor', brief: d.brief };
    }

    // ⑥ letters-only：无 actionable 面单，登记即可。
    log(`push: ${d.count} letter(s) with no actionable brief — noted only`);
    return { handled: 'letters-only', count: d.count };
  }

  return { handlePush, consumedMain, isAnnounced, markAnnounced };
}
