/**
 * mailbox-push-core.mjs — 驿站上门信的分拣裁决（femo2host 公共层，2026-09-24 A3 收编）。
 *
 * 「投递员敲门送来一包信，宿主该办哪件事」的判断唯一活在本文——原 dsh
 * mailbox-push.ts 的分拣骨架（审计 A3 基准份；autoclaw mailbox-push.mjs 是
 * 其十连裁前夜旧代际翻版，随它自便，迁移=先做单通道对齐再换本件）。宿主
 * 只剩插座：按决策对象执行本宿主动词（dsh=steer/dispatch/applyHumanWait/
 * broker.deliverRetry…；查镜像/会话 store 等宿主态也留宿主——决策只认信包）。
 *
 * 协议（mail_courier.deliver / 面单入库后重投同形）：body = {'letters': [...],
 * **extra}——面单顶层摊开。分拣优先级（先到先认，一包一件事）：
 *   ① outcome（finished/failed/paused）         → 终局整包
 *   ② notice 信 subkind=play_start              → 启动运行/续跑信
 *   ③ retry 面单 + notice 信 subkind=node_retry → 重试牌信
 *   ④ interjection 面单 + subkind=user_interjection → 人类插话信
 *   ⑤ brief 面单 + context 信 → 按 brief.source 三路分流：
 *      'main'=主Agent拍 / 其他值=角色拍 / 无 source=人类等待拍
 *   ⑥ 其余 → letters-only（无 actionable 面单，宿主登记即可）
 * 校验失败自成一类（stop-invalid/brief-invalid/retry-invalid/interjection-
 * invalid）——丢弃与否是宿主的呈现决定，本层只判不明断。
 */

/** 信件的最小消费面（与驿站 mailbox.post 产出的信封同形）。 */

/**
 * 解析一包上门信 → 决策对象。纯函数零 IO 零宿主态。
 * @param {Record<string, unknown>} body POST body（{'letters', **extra}）
 * @returns {{kind:'stop', jobId:number, outcome:'finished'|'failed'|'paused', detail?:string, letters:unknown[]}
 *   |{kind:'stop-invalid', outcome:string|undefined, jobId:number|undefined}
 *   |{kind:'play-start', jobId:number|undefined, text:string}
 *   |{kind:'node-retry', waitKey:string, feedback:string, attempt:number, actorName:string, jobId?:number}
 *   |{kind:'retry-invalid'}
 *   |{kind:'interjection', mainSid:string, text:string}
 *   |{kind:'interjection-invalid'}
 *   |{kind:'brief-main', ref:string, jobId:number, brief:Record<string,unknown>}
 *   |{kind:'brief-actor', ref:string, jobId:number, brief:Record<string,unknown>}
 *   |{kind:'brief-human', ref:string, jobId:number, brief:Record<string,unknown>}
 *   |{kind:'brief-invalid'}
 *   |{kind:'letters-only', count:number}}
 */
export function decidePush(body) {
  const letters = Array.isArray(body?.letters) ? body.letters : [];
  const isObj = x => x !== null && typeof x === 'object';
  const isNotice = x => isObj(x) && x.kind === 'notice';
  const isContext = x => isObj(x) && x.kind === 'context';

  // ① 终局整包：outcome 在面单上，信里是给 main 的 notice（error/warning 分桶）。
  const outcome = typeof body?.outcome === 'string' ? body.outcome : undefined;
  if (outcome !== undefined) {
    const first = isObj(letters[0]) ? letters[0] : undefined;
    const jobId = typeof body?.job_id === 'number' ? body.job_id
      : typeof first?.job_id === 'number' ? first.job_id
      : undefined;
    if (jobId === undefined || (outcome !== 'finished' && outcome !== 'failed' && outcome !== 'paused')) {
      return { kind: 'stop-invalid', outcome, jobId };
    }
    const detail = typeof body?.detail === 'string' ? body.detail : undefined;
    return { kind: 'stop', jobId, outcome, ...(detail !== undefined ? { detail } : {}), letters };
  }

  // ② 启动运行/续跑信（十连裁④）：一次启动运行恰一封，无兜底双路故宿主无需去重。
  const playLetter = letters.find(x => isNotice(x) && x.subkind === 'play_start');
  if (playLetter !== undefined) {
    return {
      kind: 'play-start',
      jobId: typeof playLetter.job_id === 'number' ? playLetter.job_id : undefined,
      text: String(playLetter.payload ?? ''),
    };
  }

  // ③ 重试牌信（十连裁③）：feedback 点对点内容，宿主按 wait_key 交停靠经纪人。
  //    jobId=信上场次（web 的角色重试要查 Job 选角账解析座位——2026-09-29 补）。
  const retry = isObj(body?.retry) ? body.retry : undefined;
  const retryLetter = letters.find(x => isNotice(x) && x.subkind === 'node_retry');
  if (retry !== undefined && retryLetter !== undefined) {
    const waitKey = String(retry.wait_key ?? '');
    if (waitKey.length === 0) return { kind: 'retry-invalid' };
    const retryJobId = typeof retryLetter.job_id === 'number' ? retryLetter.job_id
      : typeof body?.job_id === 'number' ? body.job_id : undefined;
    return {
      kind: 'node-retry',
      waitKey,
      feedback: String(retry.feedback ?? ''),
      attempt: Number(retry.attempt ?? 1) || 1,
      actorName: String(retry.actor_name ?? ''),
      ...(retryJobId !== undefined ? { jobId: retryJobId } : {}),
    };
  }

  // ④ 人类插话信（十连裁⑨）：source=user 的真人标记由宿主 followup 保住。
  const interjection = isObj(body?.interjection) ? body.interjection : undefined;
  const interLetter = letters.find(x => isNotice(x) && x.subkind === 'user_interjection');
  if (interjection !== undefined && interLetter !== undefined) {
    const mainSid = typeof interjection.mainSid === 'string' ? interjection.mainSid : '';
    if (mainSid.length === 0) return { kind: 'interjection-invalid' };
    return { kind: 'interjection', mainSid, text: String(interLetter.payload ?? '') };
  }

  // ⑤ 料包信（面单 brief + context 信；一份解析三路分流）：信到驿站时人类拍
  // 与 AI 拍同构（compiler 索回信，ref=wait_key）；分流只看面单 source——
  // 收信后的差别是宿主的事，驿站只管投递。
  const brief = isObj(body?.brief) ? body.brief : undefined;
  const letter = letters.find(x => isContext(x));
  if (brief === undefined || letter === undefined) {
    return { kind: 'letters-only', count: letters.length };
  }
  const ref = String(brief.wait_key ?? letter.ref ?? '');
  if (ref.length === 0) return { kind: 'brief-invalid' };
  const jobId = typeof letter.job_id === 'number' ? letter.job_id : -1;
  if (String(brief.source ?? '') === 'main') return { kind: 'brief-main', ref, jobId, brief };
  if (brief.source !== undefined) return { kind: 'brief-actor', ref, jobId, brief };
  return { kind: 'brief-human', ref, jobId, brief };
}
