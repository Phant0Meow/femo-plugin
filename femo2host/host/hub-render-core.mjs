/**
 * hub-render-core.mjs — 投影端上共享规范件（femo2host 公共层，2026-09-24）。
 *
 * 「抽象规范进公共层（成文+代码化），具体画法留各端」（用户拍板）：本件收
 * 两端（投影中心页 / dsh hub-window）**解释层的同语义部分**，呈现（组件/样式/
 * 主题）永远留在端上。规范正文见 docs/Specs/投影中心行协议.md §5.3（输入席）与 §2/§4.5（行
 * 词汇）。零 DOM 零 React 零 node 依赖——ESM 纯函数。
 *
 * 伺服：projection_hub 静态路由 GET /host/hub-render-core.mjs（投影页经
 * <script type="module"> 引用挂 window.HubRenderCore）；dsh client 走 esbuild
 * 打包 import。改本件=两端同时生效（Ctrl+F5）。
 *
 * ── 输入席（§5.3 可见性矩阵的代码形态）────────────────────────────────
 * ── 场次 meta 行 / 横幅类 / 工具槽配对（两端解释层去重）────────────────
 */

/** §5.3 输入席可见性：上帝视角（god / god:<host>）与FEMO内窗（stage）等待期
 *  常亮；人类席位视角按 waiting.views（hub 按 scope 折算好的清单，端不做基形
 *  换算）；其他 AI 角色视角永不亮；无等待全熄。AI 角色永不亮=矩阵的铁律，
 *  views 清单由 hub 保证不含它们。 */
export function composerAllowedFor(view, waiting) {
  if (!waiting) return false;
  const v = String(view ?? '');
  if (v === 'god' || v === 'stage' || v.indexOf('god:') === 0) return true;
  return Array.isArray(waiting.views) && waiting.views.indexOf(v) >= 0;
}

/** 输入席的执行者显示名：等待态 actor 优先，回退 scope 首位，再回退『人类席』。 */
export function seatWho(waiting) {
  const w = waiting || {};
  return (typeof w.actor === 'string' && w.actor) ||
    (Array.isArray(w.scope) && typeof w.scope[0] === 'string' && w.scope[0]) ||
    '人类席';
}

/** 人类席交卷拼装（§5.3 交卷形状，唯一一份，2026-09-29 收编）：台词 trim；
 *  变量只收非空值（trim 后非空才算填了）；发言与赋值一项都没有 → {error}。
 *  text = 台词 + 每个已填变量一行 `SET VARIABLE: <<名 = 值>>`（一行一赋值、
 *  附在发言末尾——引擎按行锚定解析赋值语句，夹在句子中间的只是台词），
 *  variables = 结构化值随信走（双保险：引擎 _try_apply_human_variables 直取
 *  路径不变，台词里的语句是显示与文本解析兜底）。此前投影中心 composer、
 *  dsh 投影窗 composer、web 人类席 shared 三处各写一份，随收编归一——web
 *  扩展页引不到公共层（浏览器安全墙），其 shared 件留同形镜像并互相指名。 */
export function composeHumanSubmission(textRaw, variables) {
  const text = String(textRaw ?? '').trim();
  const cleanVars = {};
  if (variables && typeof variables === 'object') {
    for (const k of Object.keys(variables)) {
      const v = String(variables[k] == null ? '' : variables[k]).trim();
      if (v) cleanVars[k] = v;
    }
  }
  if (!text && Object.keys(cleanVars).length === 0) {
    return { error: '发言与赋值至少有一项。' };
  }
  const lines = [text]
    .concat(Object.keys(cleanVars).map(n => `SET VARIABLE: <<${n} = ${cleanVars[n]}>>`))
    .filter(p => p.length > 0);
  return { text: lines.join('\n'), variables: cleanVars };
}

/** 变量赋值钮的亮钮条件（§5.3 按钮语义）：waiting.out_vars 非空清单即亮。
 *  判定唯一此处一份：dsw 服务端引用后盖成 hasOutVars 布尔随 /state 等待镜像
 *  下发，端上照显隐、不各自判断（2026-09-28 收编 web 分叉实现销账）；
 *  传进来的清单视为已归一（dsh 镜像构建时已剥非串值）。 */
export function hasOutVars(waiting) {
  return Array.isArray(waiting?.out_vars) && waiting.out_vars.length > 0;
}

/** 场次 meta 行（zone=meta 全视角可见的戏级公告）的呈现语义：
 *  - {label,tone:'gold'} = 标签行（运行开始/继续/运行结束，端上可捎 row.text）；
 *  - {plain:true,error}  = 数据面完整句子行（暂停/出错出原文；error=错误色）；
 *  - undefined           = 非 meta 行。 */
export function metaRowOf(kind) {
  switch (kind) {
    case 'play_start': return { label: '运行开始', tone: 'gold' };
    case 'play_resume': return { label: '继续', tone: 'gold' };
    case 'play_end': return { label: '运行结束', tone: 'end' };
    case 'play_paused': return { plain: true, error: false };
    case 'play_error': return { plain: true, error: true };
    default: return undefined;
  }
}

/** 横幅类槽（无名字行、整行横幅呈现）：公告/运行提示/指令。 */
export function isBannerKind(kind) {
  return kind === 'notice' || kind === 'showprompt' || kind === 'prompt';
}

/**
 * 工具槽聚合（两端解释层去重；呈现各自发挥——页面=折叠块，dsh=官方行内卡）：
 * tool_result 并进**紧邻前一个** tool 槽（hub 槽序保证 tool 后紧跟自己的
 * tool_result，喂方 steps 顺序保证），输出取 toolResult.output、旧账 text 兜底；
 * 找不到归属（孤儿，如前面隔了别的槽）保留原槽并标 orphan:true——显不显示
 * 孤儿是端的裁量（页面不显示，dsh 独立成行）。其余槽原样透传。
 * @param {Array<Record<string, unknown>>} items 段内槽序列（hub 槽序）
 * @returns {Array<Record<string, unknown>>} tool 槽可能带 pairedOutput；
 *          孤儿 tool_result 带 orphan:true。不改动入参。
 */
export function pairToolSlots(items) {
  const out = [];
  for (const raw of (Array.isArray(items) ? items : [])) {
    const it = raw ?? {};
    if (it.kind === 'tool_result') {
      const prev = out.length > 0 ? out[out.length - 1] : undefined;
      if (prev !== undefined && prev.kind === 'tool') {
        prev.pairedOutput = itemOutput(it);
        continue;
      }
      out.push({ ...it, orphan: true });
      continue;
    }
    out.push(it);
  }
  return out;
}

/** 工具结果的输出文本：定稿形状 toolResult{node,output}，旧账 text 兜底。 */
function itemOutput(it) {
  return it.toolResult && it.toolResult.output !== undefined
    ? it.toolResult.output
    : (it.text ?? '');
}

/** 段键 w:<host>:<wait_key> 的宿主段：host 不含冒号，取 w: 后首个冒号前的段。
 * 非 w: 键（speech:/human:/h:<sid>:…）与裸键（w:<wait_key>，无宿主段——老桥
 * 产物）返回 ''。裸键判据：宿主段形如 j<数字>（引擎 wait_key 的世代前缀）。
 * 【刀1 归属单源 2026-09-26】job 行本体不带宿主字段，行头徽标的行级归属
 * 剖段键——Python 侧同款在 projection_hub._seg_host（跨语言一份裁决两份
 * 实现，改动须两边同改）。 */
export function segHostOf(seg) {
  const s = String(seg ?? '');
  if (!s.startsWith('w:')) return '';
  const rest = s.slice(2);
  const i = rest.indexOf(':');
  if (i <= 0) return '';            // w: 后无冒号=必裸键（带 host 的键必有 wait_key 段）
  const cand = rest.slice(0, i);
  if (cand === '' || /^j\d+$/.test(cand)) return '';
  return cand;
}
