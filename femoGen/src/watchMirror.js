// ════════════════════════════════════════
// ═══  watchMirror.js — 观演视图的事件镜像  ═══
// ════════════════════════════════════════
// 【画布直连引擎·刀2（2026-10-05）】引擎在跑的场与画布编辑稿不是同一份时，
// 事件不进编辑图（那是编辑现场，绝不触碰），改喂本镜像：紧凑记下「演到哪了」，
// 观演视图照它点亮。键=node label（引擎事件的 node_name 就是 label，跨图重建
// 稳定）；nodeStates 与编辑图的同名状态同形（status/streamingText/output/…），
// 复用画布既有节点组件渲染时零翻译。
// 纯计算件：给定 (state, type, data) 算新 state，不碰 React、不碰 DOM——
// Node 单测盖行为（developer/tests/watch-mirror.test.mjs）。
//
// 追平帧纪律照旧（femoGen 守则 §七）：replay 帧只恢复状态——flow_start 的
// replay 不清场（重放序里它后面跟着的历史帧要往同一张状态上叠），活帧才清。

export function createWatchState() {
  return {
    status: 'idle',           // idle|running|suspended|finished|failed
    flowPath: ['mainflow'],   // 观演跟随的流（module_enter/exit 推栈弹栈）
    nodeStates: {},           // {label: {status, streamingText, output, prompt, ...}}
    activeLabels: [],         // 正在演的节点（呼吸灯）
    humanWaiting: null,       // {label, wait_key, showprompt, prompt, out_vars}——观演面只显示不输入
    lastNotice: null,         // {level, text}——最新一条值得知情的事（重试/作者通知）
    lastError: '',            // flow_error 原话
  };
}

export function applyWatchEvent(prev, type, data = {}, { replay = false } = {}) {
  const s = {
    ...prev,
    nodeStates: { ...prev.nodeStates },
    activeLabels: [...prev.activeLabels],
  };
  const label = typeof data.node_name === 'string' ? data.node_name : '';
  const setNode = (lb, patch) => {
    if (lb) s.nodeStates[lb] = { ...(s.nodeStates[lb] || {}), ...patch };
  };
  const clearHuman = () => { s.humanWaiting = null; };
  const retire = () => { s.activeLabels = []; clearHuman(); };

  switch (type) {
    case 'flow_start':
      // 活帧=新一演开锣：整场清账重开；追平帧只校状态（重放历史往现状上叠）
      if (!replay) return { ...createWatchState(), status: 'running' };
      s.status = 'running';
      break;

    case 'node_start':
      setNode(label, {
        status: data.node_type === 'ai' ? 'ai_streaming'
          : data.node_type === 'human' ? 'human_wait' : 'running',
        type: data.node_type,
        prompt: data.prompt || '',
        streamingText: '',
        output: '',
      });
      if (label && !s.activeLabels.includes(label)) s.activeLabels.push(label);
      break;

    case 'ai_token':
      setNode(label, {
        status: 'ai_streaming',
        streamingText: (s.nodeStates[label]?.streamingText || '') + (data.token || ''),
      });
      break;

    case 'ai_done':
      setNode(label, {
        status: 'ai_done',
        output: data.output || s.nodeStates[label]?.streamingText || '',
        streamingText: '',
      });
      s.activeLabels = s.activeLabels.filter((l) => l !== label);
      break;

    case 'human_wait':
      setNode(label, {
        status: 'human_wait', type: 'human',
        wait_key: data.wait_key || '',
        showprompt: data.showprompt || null,
        prompt: data.prompt || '',
        out_vars: data.out_vars || [],
      });
      s.humanWaiting = {
        label,
        wait_key: data.wait_key || '',
        showprompt: data.showprompt || null,
        prompt: data.prompt || '',
        out_vars: data.out_vars || [],
      };
      if (label && !s.activeLabels.includes(label)) s.activeLabels.push(label);
      break;

    case 'human_done':
      setNode(label, { status: 'human_done' });
      s.activeLabels = s.activeLabels.filter((l) => l !== label);
      clearHuman();
      break;

    case 'node_retry':
      s.lastNotice = { level: 'warn', text: `${label ? `【${label}】` : ''}重试：${data.message || data.error || '节点重试'}` };
      break;

    // 料包/变量/公告/未知内部信号：观演面无消费者（调试窗另有摘要喂食）
    case 'context_ready':
    case 'func_result':
    case 'assign_result':
    case 'notice_done':
    case 'compile_warnings':
    case 'step':
    case 'heartbeat':
      break;

    case 'checkpoint': {
      // 断点标签（{task_id: label}）：主流程优先——与画布 mainCheckpointLabel 同口径
      const cps = data.checkpoints || {};
      const main = Object.prototype.hasOwnProperty.call(cps, '__main__') ? cps.__main__ : Object.values(cps)[0];
      if (typeof main === 'string' && main) s.activeLabels = [main];
      break;
    }

    case 'module_enter':
      if (data.module_name && !s.flowPath.includes(data.module_name)) {
        s.flowPath = [...s.flowPath, data.module_name];
      }
      break;

    case 'module_exit':
      s.flowPath = s.flowPath.length > 1 ? s.flowPath.slice(0, -1) : s.flowPath;
      break;

    case 'flow_paused':
      s.status = 'suspended';
      break;

    case 'flow_done':
      s.status = 'finished';
      retire();
      break;

    case 'flow_error':
      s.status = 'failed';
      s.lastError = String(data.error || '未知错误');
      retire();
      break;

    case 'notify_author': {
      const sev = data.severity || data.level;
      s.lastNotice = {
        level: (sev === 'fatal' || sev === 'agent_error' || sev === 'agent_giveup') ? 'error'
          : (sev === 'warning' || sev === 'warn') ? 'warn' : 'info',
        text: `${label ? `【${label}】` : ''}${data.message || '（作者通知）'}`,
      };
      break;
    }

    case 'run_state':
      s.status = data.state || s.status;
      if (data.state === 'finished' || data.state === 'failed') retire();
      break;

    case 'bridge_run_ended':
      s.status = data?.ok === false ? 'failed' : 'finished';
      retire();
      break;

    default:
      break;
  }
  return s;
}
