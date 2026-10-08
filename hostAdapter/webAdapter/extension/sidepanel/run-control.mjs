/**
 * run-control.mjs — FEMO 脚本卡：挂载 + 运行控制 + 运行状态线。
 *
 * 契约：femo_mount（script_path 或 femo_text）→ femo_run（fresh_start/pause/
 * resume，resume 要 job_id）。job_id 从回执（started/resumed）与 /state 的
 * playStart 记下；暂停后沿用这个 job_id 继续。浏览：扩展沙箱拿不到本机路径，
 * 走文件选择器读文件内容、femo_text 直喂挂载（文件名显示在地址框里仅供参考）。
 * 回执措辞（runResultBrief）唯一活在 shared/run-core.mjs。
 */

import { $ } from '../../shared/dom.mjs';
import { runResultBrief, jobIdFromRunResult } from '../../shared/run-core.mjs';
import { offlineRollCall, attendanceRefusal } from '../../shared/seats-core.mjs';
import { getState, api, requestRefresh } from './conn.mjs';

const runOut = $('#mountOut');
const runState = $('#runState');
let scriptJobId = ''; // 本面板最近一次启动/已知的 job id（继续用）
// 绿字=运行状态线：按钮回执（已挂载/已启动/暂停/已继续）和引擎终局共用这一行。
// 终局数据线=/state.lastStop（服务端把引擎三个停下信号 flow_error/flow_paused/
// bridge_run_ended 汇成的一面镜子，报错时 notice 首行带错误原文），随轮询
// 落字——运行自己报错终止不再只活在调试页。两条纪律：
//   statusShownAt=「绿字已显示到何时」的门槛——按钮回执上墙即拨到当下，旧终局
//   盖不掉新回执；面板重开门槛归零，最近一次终局自动恢复显示。
//   stopShownKey=已上墙终局的「job:outcome:at」身份，同一条终局不反复刷；
//   前缀还兼当「这行字是不是一场旧戏的终局」的判据（见 refreshRunState）。
let statusShownAt = 0;
let stopShownKey = '';

async function tool(name, body) {
  const state = await getState();
  if (!state?.ok) { throw new Error('本地服务不通，先启动服务'); }
  return api(state, `/tools/${name}`, { body, timeoutMs: 35_000 });
}

/** 运行前点名：催扩展当场探一轮标签页，按 shared 判据（offlineRollCall）逐魂
 *  对角色账出缺席行——全在线放行；行行自带凑齐指导。续跑带 job_id：按该场
 *  冻结选角账对（与派工 resolveSeat 同款优先级）。返回行数组；点名通道失败
 *  返回 null（不拦运行——服务不通 femo_run 自己会报错，点名不做第二道报错）。 */
async function rollCall(state, jobId) {
  try {
    const r = await api(state, '/seats/attendance', { body: jobId ? { job_id: Number(jobId) } : {}, timeoutMs: 35_000 });   // 含请台后等上线窗（≤12s）
    return offlineRollCall(r?.seats, r?.needed);
  } catch { return null; }
}

function showRun(r) {
  runOut.textContent = runResultBrief(r);
  runOut.className = `mount-out ${r?.error ? 'err' : 'ok'}`;
  const jid = jobIdFromRunResult(r);
  if (jid) scriptJobId = jid;
  statusShownAt = Date.now(); // 回执上墙：比它旧的终局不许再来盖字
  requestRefresh();
}

$('#browse').addEventListener('click', async () => {
  // 系统对话框选路（2026-10-01 换装）：浏览器文件选择器在扩展沙箱里拿不到
  // 本机绝对路径（旧法只能读内容走 femo_text，挂载行显示 unsaved），系统对
  // 话框拿得到——选完真路径回填输入框、按路径挂载，绿字直接显示绝对地址。
  // 对话框等人裁决可能很久，超时给足 5 分钟。
  try {
    const state = await getState();
    if (!state?.ok) { throw new Error('本地服务不通，先启动服务'); }
    const r = await api(state, '/api/pick-mount-path', { body: {}, timeoutMs: 300_000 });
    if (r?.error) throw new Error(r.error);
    const p = String(r?.path ?? '');
    if (!p) return; // 用户在对话框点了取消
    $('#scriptPath').value = p;
    showRun(await tool('femo_mount', { script_path: p }));
  } catch (e) {
    runOut.textContent = String(e);
    runOut.className = 'mount-out err';
  }
});

$('#mount').addEventListener('click', async () => {
  const p = $('#scriptPath').value.trim();
  if (!p) { runOut.textContent = '先填脚本绝对路径，或点「浏览」选文件。'; runOut.className = 'mount-out err'; return; }
  try { showRun(await tool('femo_mount', { script_path: p })); }
  catch (e) { runOut.textContent = String(e); runOut.className = 'mount-out err'; }
});

/** 缺席拦截红字（run/resume 共用）：文案唯一活在 shared/seats-core.attendanceRefusal。 */
function showAbsence(absent, action) {
  runOut.textContent = attendanceRefusal(absent, action);
  runOut.className = 'mount-out err';
}

/** 运行/继续共用的「按输入框 path 先挂载」（2026-10-01 用户拍板）：填了 path
 *  就先挂载——挂载=读盘上现稿+编译检查，改过的剧本跑的是改后版；上次挂载
 *  失败/没挂过也直接运行即可，不必先点「挂载」。挂载失败红字停住，不往下走。
 *  输入框空着 = 尊重服务端现有挂载（操作台/画布挂的不动）。 */
async function mountIfPath() {
  const p = $('#scriptPath').value.trim();
  if (!p) return true;
  const mr = await tool('femo_mount', { script_path: p });
  if (mr?.error) { showRun(mr); return false; }
  return true;
}

$('#runBtn').addEventListener('click', async () => {
  try {
    const state = await getState();
    if (!state?.ok) { throw new Error('本地服务不通，先启动服务'); }
    if (!(await mountIfPath())) return;
    // 开跑前真点名一遍：卡片上的「在线」是 10 秒一轮的旧账，这里催当场新探。
    const absent = await rollCall(state);
    if (absent?.length) { showAbsence(absent, '运行'); return; }
    showRun(await tool('femo_run', { action: 'fresh_start' }));
  }
  catch (e) { runOut.textContent = String(e); runOut.className = 'mount-out err'; }
});

$('#pauseBtn').addEventListener('click', async () => {
  try {
    const body = { action: 'pause' };
    if (scriptJobId) body.job_id = Number(scriptJobId);
    showRun(await tool('femo_run', body));
  } catch (e) { runOut.textContent = String(e); runOut.className = 'mount-out err'; }
});

$('#resumeBtn').addEventListener('click', async () => {
  if (!scriptJobId) {
    // 本面板不知道 job id：从 /state 的 playStart 兑底取（服务重启会丢，这种情况只能去操作台）。
    try {
      const state = await getState();
      const jid = state?.ok ? (await api(state, '/state', { timeoutMs: 4000 }))?.playStart?.jobId : undefined;
      if (jid) scriptJobId = String(jid);
    } catch { /* 兜底失败就走报错 */ }
    if (!scriptJobId) { runOut.textContent = '没有可继续的 job id——先「运行」，或去操作台查。'; runOut.className = 'mount-out err'; return; }
  }
  // 续跑同样认输入框里的 path（同运行按钮）+ 点名：挂起档的下一站多半还是
  // 网页席位，缺席就先拦下（带 job_id——按该场冻结选角账对账）。
  if (!(await mountIfPath())) return;
  const state = await getState();
  if (state?.ok) {
    const absent = await rollCall(state, scriptJobId);
    if (absent?.length) { showAbsence(absent, '继续'); return; }
  }
  try { showRun(await tool('femo_run', { action: 'resume', job_id: Number(scriptJobId) })); }
  catch (e) { runOut.textContent = String(e); runOut.className = 'mount-out err'; }
});

// 运行态徽标（/state 的 running + playName）+ 终局落绿字，随总装轮询更新。
export async function refreshRunState() {
  try {
    const state = await getState();
    if (!state?.ok) { runState.textContent = ''; return; }
    const st = await api(state, '/state', { timeoutMs: 4000 });
    runState.textContent = st.running ? `● 运行中 ${st.playName ?? ''}${st.playStart?.jobId ? ` · job ${st.playStart.jobId}` : ''}` : '';
    if (st.playStart?.jobId && !scriptJobId) scriptJobId = String(st.playStart.jobId);
    const stop = st.lastStop;
    if (st.running && st.playStart?.jobId) {
      // 跑着时绿字跟实时走：面板刚开（绿字还空着）、或停着的是上一场的旧终局
      // （key 前缀 stop: 且场次号小于在跑的这场）→ 统一改写「进行中」。
      const staleStop = stopShownKey.startsWith('stop:')
        && Number(stopShownKey.split(':')[1]) < Number(st.playStart.jobId);
      if (!runOut.textContent || staleStop) {
        runOut.textContent = `进行中：job ${st.playStart.jobId}`;
        runOut.className = 'mount-out ok';
        stopShownKey = `run:${st.playStart.jobId}`;
      }
    } else if (stop?.outcome && Number(stop.at ?? 0) > statusShownAt) {
      const key = `stop:${stop.jobId}:${stop.outcome}:${stop.at}`;
      if (key !== stopShownKey) {
        stopShownKey = key;
        statusShownAt = Number(stop.at ?? 0);
        // notice 首行带「[femo] FEMO 运行结果：」台头，绿字上剥掉只留正文；
        // 失败红、其余绿。notice 意外缺席时按结局给一句人话（显示层兜底，不吞错）。
        const text = String(stop.notice ?? '').replace(/^\[[^\]]*\]\s*FEMO 运行结果：/, '')
          || `job ${stop.jobId} ${stop.outcome === 'failed' ? '运行出错' : stop.outcome === 'paused' ? '已暂停' : '已跑完'}`;
        runOut.textContent = text;
        runOut.className = `mount-out ${stop.outcome === 'failed' ? 'err' : 'ok'}`;
      }
    }
  } catch { runState.textContent = ''; }
}

/** 总装调用：起本卡的轮询节奏。 */
export function start() {
  refreshRunState();
  setInterval(refreshRunState, 2500);
}
