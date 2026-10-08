/**
 * integration-human.mjs — 全链路集成检测（真桥 + 真引擎 + 路由器 + 投影窗）
 * 用纯 human FEMO脚本（无 AI 节点 → 不需要 API key）跑一次完整运行：
 *   job_start → flow_start → node_start → human_wait → 交卷 → human_done → flow_done
 * 手动运行：node zcodeAdapter/tests/integration-human.mjs
 */
import { createMemoryStore as createProjectionStore } from './memory-store.mjs';
import { createEventRouter } from '../mcp/event-router.mjs';
import { ZcodeDaemonClient } from '../mcp/engine-bind.mjs';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { killSandboxDaemon } from './harness.mjs';

// 沙盒隔离（必须在 ZcodeDaemonClient 构造前设）：产信/引擎 DB 随 FEMO_DATA_DIR
// 进沙盒——否则测试的终局信会漏进生产信箱被 Stop 钩子当真通知（2026-09-15 实锤）。
const TMP = process.env.FEMO_DATA_DIR ?? mkdtempSync(join(tmpdir(), 'femo-integration-'));
process.env.FEMO_DATA_DIR = TMP;

// 纯 human 最小脚本（soul 用库内现成的 'human'；无 AI 节点 → 不需要 API key）
const femoText = `meta:
  name = 集成测试
  session = new

actors:
  human @我 = soul:human

action ask @human(@我):
  prompt: 请说点什么，然后流程继续

mainflow:
  [START] -> ask -> [END]
`;
const store = createProjectionStore();

const router = createEventRouter({
  store,
  sid: 'femo-main',
  send: (cmd, args, timeoutMs) => bridge.send(cmd, args, timeoutMs),
  log: m => console.log('[router]', m),
});

let humanDoneInput;       // human_done 事件带回的落库 input（引擎侧消费结果）
const bridge = new ZcodeDaemonClient({
  onEvent: (type, data) => {
    console.log('[event]', type, JSON.stringify(data).slice(0, 150));
    if (type === 'human_done') humanDoneInput = data?.input;
    router.handleEvent(type, data);
  },
  log: m => console.log('[bridge]', m),
});
bridge.start();
await new Promise(r => setTimeout(r, 2500));

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(cond, label, timeoutMs = 30000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting: ${label}`);
    await sleep(200);
  }
}

let fail = 0;
const check = (label, ok) => { console.log(`${ok ? '✅' : '❌'} ${label}`); if (!ok) fail = 1; };

try {
  const started = await bridge.send('job_start', {
    femo: femoText,
    script_name: 'integration-human',
    host_ref: 'zcodeAdapter-integration',
  });
  console.log('job_start =>', JSON.stringify(started).slice(0, 160));
  const jobId = started.job_id;

  // 1. flow_start：启动运行行 + 建窗
  await waitFor(() => store.readWindow('femo-main', 'god').length > 0, 'flow_start');
  const st1 = router.state();
  check('flow_start 运行态', st1.running === true);
  console.log('   cast =', JSON.stringify(st1.actors), ' main =', JSON.stringify(st1.mainActors));

  // 2. human_wait：等待登记 + 🎭 行
  await waitFor(() => router.state().waitingHuman, 'human_wait');
  const wh = router.state().waitingHuman;
  check('human_wait 登记', wh.job_id === jobId && wh.wait_key.length > 0);
  console.log('   wait_scope =', JSON.stringify(wh.scope));
  check('🎭 行已落窗', store.readWindow('femo-main', 'god').some(r => String(r.data.text ?? '').includes('等待你的回应')));

  // 3. 交卷（人类玩家的台词）——角色窗投影 + 引擎回传
  const actorName = (wh.scope ?? ['@我'])[0].replace(/^@/, '');
  router.projectUserLine(actorName, '大家好，我是测试玩家。');
  // 人类席交卷走人类信封（2026-09-21 收口）：与 dsh 投影页同一份词汇。
  await router.submitHumanOutput(jobId, wh.wait_key, '大家好，我是测试玩家。', (wh.scope ?? ['@我'])[0]);
  check('交卷已回传', true);

  // 4. flow_done：终局行 + 终态标记
  await waitFor(() => router.state().running === false, 'flow_done', 45000);
  const godRows = store.readWindow('femo-main', 'god');
  check('终局行落窗', godRows.some(r => String(r.data.text ?? '').includes('✅ FEMO 已跑完')));
  // 【2026-09-25】takeDirective 终态标记随拉取队列退役（十连裁：事件侧零派工，
  // off 模式队列恒空）——终态已由 running===false + 终局行双重断言。

  // 5. 玩家台词的 scope 投影（角色窗可见性）
  console.log('--- god 窗全量 ---');
  for (const r of godRows) console.log(`   [${String(r.data.kind ?? r.type)}] ${String(r.data.text ?? '').slice(0, 60)}`);

  // 存档一份投影镜像供人工检查
  console.log(fail === 0 ? 'INTEGRATION OK' : 'INTEGRATION FAIL');
  process.exitCode = fail;
} catch (e) {
  console.log('INTEGRATION ERROR:', String(e).slice(0, 300));
  process.exitCode = 1;
} finally {
  await bridge.stop();
  // 引擎侧台词到位（人类信封词汇回归证明，两条独立证据）：
  //  ①引擎人类节点读 chat_text/variables（FEMO_runtime 结构化输入分支），收到
  //    dict 必打「结构化输入: chat_text='…'」——旧 {output} 形态这里 chat_text=''
  //    （空台词 bug）。ASCII 锚点断言非空，中文正文是否被控制台转码不影响。
  //  ②human_done 事件 input 字段=format_human_dialog 拼接结果，空台词 bug 下为 ''。
  // 【2026-09-26 常驻化第 3 步】引擎 print 不再流经客户端（引擎 stderr 归 daemon
  // 日志文件）——证据改从 daemon 日志取证。
  let daemonLog = '';
  try { daemonLog = readFileSync(join(TMP, 'femo', 'projection', 'logs', 'femo_daemon.log'), 'utf8'); } catch { /* 无日志 */ }
  const gotText = /chat_text='.+'/.test(daemonLog);
  check('引擎读到 chat_text（人类信封词汇）', gotText);
  check('human_done 落库 input 非空', typeof humanDoneInput === 'string' && humanDoneInput.length > 0);
  killSandboxDaemon(TMP);   // 直连后客户端代拉的是脱离母进程的常驻引擎，必须收尸
}
