/**
 * catalog-dropdown.jsx — 官方子代理目录下拉的完整实现（2026-09-26 刀⑧收尾：自
 * lineage-fork.jsx 抽出为独立件）。
 *
 * 抽出原因：视角菜单（view-button）与 fork 面包屑共用 CatalogDropdown，此前
 * view-button 隔着 fork 文件借件——fork 想退役/重构都被它拖住。本文件持有目录
 * 渲染全家（样式双版参数化/过滤/格式化/键盘导航/ CatalogRows/LoadingRows/
 * CatalogDropdown），fork 只留面包屑组件并反向 import。
 * fork 历史（新旧并刀/缺省翻转/「路」字修正）见 lineage-fork.jsx 头注释。
 */
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState, } from 'react';
import { createPortal } from 'react-dom';
import { StateDot, } from '@deepseek-ai/dsh-client-ui-primitives';
import { IconChevronDown, IconChevronRight, IconRefresh } from './primitives-compat';
// 2026-09-04 rc.1 接入：indexSubagentDescendants 原从 @deepseek-ai/dsh-client-runtime/client
// 导入——rc.1 已删除 client-runtime 包。该函数为自包含纯函数（官方
// subagent-lineage.ts 同款语义：按 parentId/origin/running 聚合后代计数），本地化后
// lineage 组件零外部依赖。
function indexSubagentDescendants(summaries) {
  const indexed = new Map()
  for (const descendant of Object.values(summaries)) {
    if (descendant.origin !== 'subagent') continue
    const seen = new Set()
    let current = descendant
    while (current?.origin === 'subagent' && current.parentId !== undefined && !seen.has(current.id)) {
      seen.add(current.id)
      const aggregate = indexed.get(current.parentId)
      if (aggregate === undefined) {
        indexed.set(current.parentId, { count: 1, runningCount: descendant.running ? 1 : 0 })
      } else {
        aggregate.count += 1
        if (descendant.running) aggregate.runningCount += 1
      }
      current = summaries[current.parentId]
    }
  }
  return indexed
}

// ── 版本分流（唯一判据：window.__femoNative，client.tsx 问宿主后回填）──────
export function femoNativeCatalog() { return window.__femoNative === true }

// ── 差异一：样式 ──────────────────────────────────────────────────────────
// 旧版变体：rc.2 快照哈希（ retired 宿主保留件，勿改值）。
const cssLegacy = {
  activitySlot: 'A-xaeG_activitySlot',
  ancestorSwitcherTrigger: 'A-xaeG_ancestorSwitcherTrigger',
  children: 'A-xaeG_children',
  clickarea: 'A-xaeG_clickarea',
  content: 'A-xaeG_content',
  currentLabel: 'A-xaeG_currentLabel',
  disabled: 'A-xaeG_disabled',
  disclosure: 'A-xaeG_disclosure',
  disclosureOpen: 'A-xaeG_disclosureOpen',
  disclosureSpace: 'A-xaeG_disclosureSpace',
  error: 'A-xaeG_error',
  label: 'A-xaeG_label',
  loadingRow: 'A-xaeG_loadingRow',
  menu: 'A-xaeG_menu',
  metricDuration: 'A-xaeG_metricDuration',
  metricToken: 'A-xaeG_metricToken',
  metrics: 'A-xaeG_metrics',
  node: 'A-xaeG_node',
  notice: 'A-xaeG_notice',
  refresh: 'A-xaeG_refresh',
  root: 'A-xaeG_root',
  row: 'A-xaeG_row',
  separator: 'A-xaeG_separator',
  summary: 'A-xaeG_summary',
  switcherRoot: 'A-xaeG_switcherRoot',
  switcherTitle: 'A-xaeG_switcherTitle',
  switcherTrigger: 'A-xaeG_switcherTrigger',
  trigger: 'A-xaeG_trigger',
  triggerOpen: 'A-xaeG_triggerOpen',
}
// 原生变体：CSS 哈希类名运行时解析（跨 0.1.3 构建稳定的关键）——官方组件模块
// 加载时把 CSS 注入 <style data-plugin-css="...SubagentHeaderLineage.module.css">，
// 选择器形如 .<hash>_<name>{...}。从注入文本反解「名字 → 哈希全名」映射，官方
// 升级换哈希也不用改本文件；解析失败回退 0.1.3-alpha.2 实测值（仅样式兜底，
// 不影响过滤逻辑）。
const LINEAGE_CSS_TAG_ID = '@deepseek-ai/dsh-client-ui-subagent/SubagentHeaderLineage.module.css'
const cssNative = new Proxy({}, {
  get(_target, prop) {
    if (typeof prop !== 'string') return undefined
    if (lineageCssResolved !== undefined) return lineageCssResolved[prop] ?? ''
    const parsed = parseLineageCss()
    if (parsed !== undefined) {
      lineageCssResolved = parsed
      return lineageCssResolved[prop] ?? ''
    }
    return LINEAGE_CSS_FALLBACK[prop] ?? ''
  },
})
let lineageCssResolved
const LINEAGE_CSS_FALLBACK = {
  activitySlot: 'Hrbyxa_activitySlot',
  ancestorSwitcherTrigger: 'Hrbyxa_ancestorSwitcherTrigger',
  children: 'Hrbyxa_children',
  clickarea: 'Hrbyxa_clickarea',
  content: 'Hrbyxa_content',
  currentLabel: 'Hrbyxa_currentLabel',
  disabled: 'Hrbyxa_disabled',
  disclosure: 'Hrbyxa_disclosure',
  disclosureOpen: 'Hrbyxa_disclosureOpen',
  disclosureSpace: 'Hrbyxa_disclosureSpace',
  error: 'Hrbyxa_error',
  label: 'Hrbyxa_label',
  loadingRow: 'Hrbyxa_loadingRow',
  menu: 'Hrbyxa_menu',
  metricDuration: 'Hrbyxa_metricDuration',
  metricToken: 'Hrbyxa_metricToken',
  metrics: 'Hrbyxa_metrics',
  node: 'Hrbyxa_node',
  notice: 'Hrbyxa_notice',
  refresh: 'Hrbyxa_refresh',
  root: 'Hrbyxa_root',
  row: 'Hrbyxa_row',
  separator: 'Hrbyxa_separator',
  summary: 'Hrbyxa_summary',
  switcherRoot: 'Hrbyxa_switcherRoot',
  switcherTitle: 'Hrbyxa_switcherTitle',
  switcherTrigger: 'Hrbyxa_switcherTrigger',
  trigger: 'Hrbyxa_trigger',
  triggerOpen: 'Hrbyxa_triggerOpen',
}
function parseLineageCss() {
  try {
    const tag = document.querySelector(`style[data-plugin-css="${LINEAGE_CSS_TAG_ID}"]`)
    const text = tag?.textContent ?? ''
    if (text.length === 0) return undefined
    const map = {}
    const re = /\.([A-Za-z0-9]+)_([A-Za-z0-9]+)(?=[{.:,[\s)])/g
    let m
    while ((m = re.exec(text)) !== null) {
      const name = m[2]
      if (!(name in map)) map[name] = `${m[1]}_${m[2]}`
    }
    if (map.root === undefined || map.menu === undefined || map.row === undefined) return undefined
    return map
  } catch {
    return undefined
  }
}
/** 当前变体的样式表（组件内取，勿在模块顶取——flag 回填晚于模块加载）。 */
export function lineageCss() { return femoNativeCatalog() ? cssNative : cssLegacy }

// ── 差异二：目录过滤（显示层，信息零丢失）─────────────────────────────────
// 旧版语义：femo-proj-* 条目与 femo-node-* 标签条目剥掉（旧宿主本体已镜像进
// 投影窗，是杂物）。
export function femoHiddenId(id) { return typeof id === 'string' && id.startsWith('femo-proj-') }
function femoLegacyHiddenLabel(label) {
  return typeof label === 'string' && label.startsWith('femo-node-')
}
function femoLegacyStripEntries(entries) {
  return entries.filter((entry) => !femoHiddenId(entry.id) && !femoLegacyHiddenLabel(entry.label))
}
function femoLegacyStripSummaries(byId) {
  const out = {}
  for (const [id, summary] of Object.entries(byId ?? {})) {
    if (femoHiddenId(id)) continue
    if (femoLegacyHiddenLabel(summary?.displayTitle)) continue
    out[id] = summary
  }
  return out
}
// 原生语义：femo-proj-*（god/stage/角色投影窗）、femo-actor-*（Job×角色常驻
// 执行体）、femo-node-*（遗留节点子代理）一律不进目录。
function femoNativeHiddenId(id) {
  if (typeof id !== 'string') return false
  return id.startsWith('femo-proj-') || id.startsWith('femo-actor-')
}
function femoNativeHiddenLabel(label) {
  return typeof label === 'string' && label.startsWith('femo-node-')
}
function femoNativeStripEntries(entries) {
  return entries.filter((entry) => !(entry.kind === 'child'
    && (femoNativeHiddenId(entry.id) || femoNativeHiddenLabel(entry.label))))
}
function femoNativeStripSummaries(byId) {
  const out = {}
  for (const [id, summary] of Object.entries(byId ?? {})) {
    if (summary?.origin !== 'subagent') {
      out[id] = summary
      continue
    }
    if (femoNativeHiddenId(id)) continue
    if (femoNativeHiddenLabel(summary?.projectionValues?.subagent?.label)) continue
    out[id] = summary
  }
  return out
}
// 统一出入口（全文件只认这两个 + 下方两个 hidden 判据）。
function femoStripEntries(entries) {
  return femoNativeCatalog() ? femoNativeStripEntries(entries) : femoLegacyStripEntries(entries)
}
function femoStripSummaries(byId) {
  return femoNativeCatalog() ? femoNativeStripSummaries(byId) : femoLegacyStripSummaries(byId)
}
function femoHiddenRow(id, label) {
  return femoNativeCatalog()
    ? femoNativeHiddenId(id)
    : femoHiddenId(id) || femoLegacyHiddenLabel(label)
}

// ── 共享核（两版逐字一致）─────────────────────────────────────────────────
function diagnosticReason(entry, t) {
    switch (entry.reason) {
        case 'corrupt': return t('diagnostic.corrupt');
        case 'unsupported': return t('diagnostic.unsupported');
        case 'unavailable': return t('diagnostic.unavailable');
    }
}
function treeItems(root) {
    return root === null
        ? []
        : Array.from(root.querySelectorAll('[role="treeitem"]:not([aria-disabled="true"])'));
}
/** Compact token count shared in shape with the conversation stats strip. */
function formatTokens(value) {
    const scaled = (next) => next >= 100
        ? String(Math.round(next))
        : String(Math.round(next * 10) / 10);
    if (value < 1_000)
        return String(value);
    if (value < 1_000_000)
        return `${scaled(value / 1_000)}K`;
    return `${scaled(value / 1_000_000)}M`;
}
/** Sum the four disjoint durable provider-usage buckets. */
function tokenTotal(usage) {
    return usage === undefined
        ? undefined
        : usage.uncachedInputTokens + usage.outputTokens
            + usage.cacheReadTokens + usage.cacheWriteTokens;
}
/** Exact whole-second active-turn duration for one catalog row. */
function activityDuration(summary, activity, now) {
    if (summary === undefined)
        return undefined;
    const timing = summary.projectionValues?.subagentTiming;
    if (timing === undefined)
        return undefined;
    if (timing.active === undefined)
        return timing.settledMs;
    const end = activity === 'running'
        ? now
        : timing.active.through;
    return timing.settledMs + Math.max(0, end - timing.active.since);
}
function splitDuration(ms) {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1_000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    return {
        seconds: totalSeconds % 60,
        minutes: totalMinutes % 60,
        hours: totalHours % 24,
        days: Math.floor(totalHours / 24),
        totalMinutes,
        totalHours,
    };
}
/** Format a duration with decreasing visual precision at larger scales. */
function formatDuration(ms, t) {
    const { seconds, minutes, hours, days, totalMinutes, totalHours } = splitDuration(ms);
    if (days >= 365) {
        const years = Math.floor(days / 365);
        const months = Math.floor((days % 365) / 30);
        return months === 0
            ? t('duration.years', { years })
            : t('duration.yearsMonths', { years, months });
    }
    if (days >= 30) {
        const months = Math.floor(days / 30);
        const remainingDays = days % 30;
        return remainingDays === 0
            ? t('duration.months', { months })
            : t('duration.monthsDays', { months, days: remainingDays });
    }
    if (days > 0) {
        return hours === 0
            ? t('duration.days', { days })
            : t('duration.daysHours', { days, hours });
    }
    if (totalHours > 0) {
        return t('duration.hours', {
            hours: totalHours,
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0'),
        });
    }
    if (totalMinutes > 0) {
        return t('duration.minutes', {
            minutes: totalMinutes,
            seconds: String(seconds).padStart(2, '0'),
        });
    }
    return t('duration.seconds', { seconds });
}
/** Preserve exact whole seconds for hover and accessible naming. */
function formatExactDuration(ms, t) {
    const { seconds, minutes, hours, days } = splitDuration(ms);
    return days === 0
        ? formatDuration(ms, t)
        : t('duration.exactDays', {
            days,
            hours: String(hours).padStart(2, '0'),
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0'),
        });
}
const NO_DESCENDANTS = { count: 0, runningCount: 0 };
function SubagentSwitcherIcon() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M5.99951 12.7L8.95546 14.9478C9.40011 15.2859 9.62244 15.455 9.87526 15.488C9.95774 15.4988 10.0413 15.4988 10.1238 15.488C10.3766 15.455 10.5989 15.2859 11.0436 14.9478L13.9995 12.7", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("path", { d: "M13.9995 7.7417L11.0436 5.49387C10.5989 5.15574 10.3766 4.98668 10.1238 4.95362C10.0413 4.94283 9.95775 4.94283 9.87527 4.95362C9.62245 4.98668 9.40012 5.15574 8.95547 5.49387L5.99952 7.7417", stroke: "currentColor", strokeWidth: "1.5" })] }));
}
/** Render the known direct-child shape while its authoritative catalog hydrates. */
function CatalogLoadingRows({ parentSessionId, summaries, level, t, }) {
    const css = lineageCss()
    const children = Object.values(summaries).filter(summary => (summary.origin === 'subagent' && summary.parentId === parentSessionId)).filter((summary) => !femoHiddenRow(summary.id, summary.displayTitle));
    if (children.length === 0)
        return _jsx("div", { className: css.notice, children: t('loading.label') });
    return children.map(summary => (_jsx("div", { className: css.node, children: _jsxs("div", { role: "treeitem", "aria-disabled": "true", "aria-level": level, "aria-label": t('loading.aria'), className: `${css.row} ${css.disabled} ${css.loadingRow}`, children: [_jsx("span", { className: css.disclosureSpace }), _jsx(StateDot, { state: summary.running ? 'ongoing' : 'done' }), _jsx("span", { className: css.content, children: _jsx("span", { className: css.label, children: t('loading.label') }) })] }) }, summary.id)));
}
/** Render one catalog level and recurse only through explicitly expanded rows. */
function CatalogRows({ parentSessionId, currentSessionId, catalog, catalogs, summaries, expanded, level, now, openChild, refresh, toggleBranch, closeCatalog, t, }) {
    const css = lineageCss()
    const emptyLoading = catalog.state === 'loading' && catalog.entries.length === 0;
    const reserveDisclosure = catalog.entries.some(entry => entry.kind === 'child' && entry.hasChildren);
    return (_jsxs(_Fragment, { children: [emptyLoading && (_jsx(CatalogLoadingRows, { parentSessionId: parentSessionId, summaries: summaries, level: level, t: t })), catalog.state === 'error' && (_jsxs("div", { className: css.error, children: [_jsx("span", { children: catalog.error?.message ?? t('load.error') }), _jsxs("button", { type: "button", className: css.refresh, onClick: () => { refresh(parentSessionId); }, children: [_jsx(IconRefresh, {}), t('retry')] })] })), femoStripEntries(catalog.entries).map((entry) => {
                if (entry.kind === 'diagnostic') {
                    const reason = diagnosticReason(entry, t);
                    return (_jsx("div", { className: css.node, children: _jsxs("div", { role: "treeitem", "aria-disabled": "true", "aria-level": level, "aria-label": `${entry.id} ${reason}`, className: `${css.row} ${css.disabled}`, title: reason, children: [reserveDisclosure && _jsx("span", { className: css.disclosureSpace }), _jsx(StateDot, { state: "error" }), _jsxs("span", { className: css.content, children: [_jsx("span", { className: css.label, children: entry.id }), _jsx("span", { className: css.summary, children: reason })] })] }) }, entry.id));
                }
                const childCatalog = catalogs[entry.id];
                const isCurrent = entry.id === currentSessionId;
                const isExpanded = expanded.has(entry.id);
                const knownLeaf = !entry.hasChildren;
                const childLoading = childCatalog === undefined
                    || (childCatalog.state === 'loading' && childCatalog.entries.length === 0);
                const summary = summaries[entry.id];
                const label = entry.label ?? entry.id;
                const mode = entry.mode === 'one-shot' ? t('mode.oneShot') : t('mode.continuable');
                const activity = entry.activity === 'running' ? t('activity.running') : t('activity.inactive');
                // 【刀⑧ 顺手修】旧版原为 join(' 路 ')——编码事故，正字 ' · '（与原生一致）。
                const secondary = [summary?.title, mode, activity]
                    .filter(value => value !== undefined)
                    .join(' · ');
                const totalTokens = tokenTotal(summary?.projectionValues?.tokenUsage);
                const durationMs = activityDuration(summary, entry.activity, now);
                const tokenMetric = totalTokens === undefined
                    ? undefined
                    : `${formatTokens(totalTokens)} tok`;
                const durationMetric = durationMs === undefined
                    ? undefined
                    : {
                        compact: formatDuration(durationMs, t),
                        exact: formatExactDuration(durationMs, t),
                    };
                const metrics = [tokenMetric, durationMetric?.exact]
                    .filter(value => value !== undefined)
                    .join(' · ');
                const open = () => {
                    openChild({ parentSessionId, childSessionId: entry.id, mode: entry.mode });
                    closeCatalog();
                };
                const handleKey = (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        open();
                    }
                    else if ((event.key === 'ArrowRight' && !knownLeaf && !isExpanded)
                        || (event.key === 'ArrowLeft' && isExpanded)) {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleBranch(entry.id);
                    }
                };
                const toggle = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleBranch(entry.id);
                };
                return (_jsxs("div", { className: css.node, children: [_jsxs("div", { role: "treeitem", tabIndex: 0, "aria-level": level, "aria-current": isCurrent || undefined, "aria-label": [label, secondary, metrics].filter(value => value !== '').join(' '), ...knownLeaf ? {} : { 'aria-expanded': isExpanded }, className: css.row, onClick: open, onKeyDown: handleKey, children: [knownLeaf
                                    ? reserveDisclosure && _jsx("span", { className: css.disclosureSpace })
                                    : (_jsx("button", { type: "button", tabIndex: -1, className: `${css.disclosure} ${isExpanded ? css.disclosureOpen : ''}`, "aria-label": t(isExpanded ? 'branch.collapse' : 'branch.expand', { label }), onClick: toggle, children: _jsx(IconChevronRight, {}) })), _jsxs("div", { className: css.clickarea, children: [_jsx(StateDot, { state: entry.activity === 'running' ? 'ongoing' : 'done' }), _jsxs("span", { className: css.content, children: [_jsx("span", { className: `${css.label} ${isCurrent ? css.currentLabel : ''}`, children: label }), _jsx("span", { className: css.summary, children: secondary })] }), metrics !== '' && (_jsxs("span", { className: css.metrics, children: [tokenMetric !== undefined && _jsx("span", { className: css.metricToken, children: tokenMetric }), durationMetric !== undefined && (_jsx("span", { className: css.metricDuration, title: t('duration.exactTitle', { duration: durationMetric.exact }), children: durationMetric.compact }))] }))] })] }), isExpanded && !knownLeaf && (_jsx("div", { role: "group", className: css.children, "aria-busy": childLoading || undefined, children: childCatalog === undefined
                                ? (_jsx(CatalogLoadingRows, { parentSessionId: entry.id, summaries: summaries, level: level + 1, t: t }))
                                : (_jsx(CatalogRows, { parentSessionId: entry.id, currentSessionId: currentSessionId, catalog: childCatalog, catalogs: catalogs, summaries: summaries, expanded: expanded, level: level + 1, now: now, openChild: openChild, refresh: refresh, toggleBranch: toggleBranch, closeCatalog: closeCatalog, t: t })) }))] }, entry.id));
            })] }));
}
const MENU_VIEWPORT_MARGIN = 16;
/** Place a portaled catalog below its trigger without crossing the viewport edge. */
function catalogMenuPosition(trigger) {
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(336, window.innerWidth - MENU_VIEWPORT_MARGIN * 2);
    return {
        top: rect.bottom + 5,
        left: Math.min(Math.max(MENU_VIEWPORT_MARGIN, rect.left), window.innerWidth - width - MENU_VIEWPORT_MARGIN),
    };
}
/** One trigger-plus-tree dropdown over the catalog rooted at `rootSessionId`.
 *  hideWhenZero 缺省按变体：旧版 false（官方 visible 看过滤前 entries，Femo 主
 *  会话有 count 座位另管）；原生 true（过滤后无可见子代理即隐藏触发器）。
 *  showRunning：旧版 count 座位的在跑数文本（原生不传，无效果）。 */
export function CatalogDropdown({ rootSessionId, currentSessionId, displayTitle, openTitle, variant, separator = false, showRunning = false, hideWhenZero, useSessions, useSessionStatus, openChild, refresh, setCatalogOpen, t, }) {
    const css = lineageCss()
    const hideWhenZeroEffective = hideWhenZero ?? femoNativeCatalog();
    const ancestorSwitcher = variant === 'switcher' && openTitle !== undefined;
    // 【0.1.7 rc.2 双版本兼容 2026-09-27】旧 store 直接给 subagentsByParent；
    // rc.2 起该字段退役（读 undefined 本身再下标即崩=「lineage 槽位 crash」实案），
    // 官方改由 projectionsBySession（会话投影快照 values.subagentCatalog）+
    // useSessionStatus（在跑状态）现算派生——照官方 useMemo 逐字重放，旧宿主
    // projectionsBySession 缺席时给空表，两代只走自己存在的那条路。
    const legacyCatalogs = useSessions(state => state.subagentsByParent);
    const projections = useSessions(state => state.projectionsBySession);
    const summaries = useSessions(state => state.byId);
    const statuses = useSessionStatus !== undefined ? useSessionStatus(value => value) : new Map();
    // useMemo 无条件调用（hook 纪律）；旧宿主上 projections 缺席→派生空表弃用。
    const derivedCatalogs = useMemo(() => Object.fromEntries(Object.entries(projections ?? {}).map(([id, snapshot]) => [id, {
        state: snapshot.state === 'idle' ? (snapshot.values.subagentCatalog === undefined ? 'loading' : 'ready') : snapshot.state,
        error: snapshot.error,
        entries: (snapshot.values.subagentCatalog ?? []).map((entry) => ({
            ...entry,
            activity: (statuses.get(entry.id)?.running ?? summaries[entry.id]?.running) === true ? 'running' : 'inactive',
        })),
    }])), [projections, summaries, statuses]);
    const catalogs = legacyCatalogs !== undefined ? legacyCatalogs : derivedCatalogs;
    const catalog = catalogs[rootSessionId];
    const [open, setOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState();
    const [now, setNow] = useState(() => Date.now());
    const [expanded, setExpanded] = useState(() => new Set());
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const hoverOpenTimer = useRef(undefined);
    const hoverCloseTimer = useRef(undefined);
    const observedCatalogs = useRef(new Set());
    const requestedInitialCatalog = useRef();
    const setCatalogOpenRef = useRef(setCatalogOpen);
    setCatalogOpenRef.current = setCatalogOpen;
    const currentEntry = currentSessionId === undefined
        ? undefined
        : catalog?.entries.find(entry => entry.kind === 'child' && entry.id === currentSessionId);
    const switcherDisplayTitle = currentEntry?.kind === 'child'
        ? currentEntry.label ?? currentEntry.id
        : displayTitle;
    const healthy = femoStripEntries(catalog?.entries.filter(entry => entry.kind === 'child') ?? []);
    const descendants = useMemo(() => indexSubagentDescendants(femoStripSummaries(summaries)).get(rootSessionId) ?? NO_DESCENDANTS, [rootSessionId, summaries]);
    // The catalog can arrive before the session-list baseline; never undercount
    // the already-visible direct rows during that short bootstrap window.
    const descendantCount = Math.max(healthy.length, descendants.count);
    const totalCountKey = descendantCount === 1 ? 'count.total.one' : 'count.total.other';
    const runningCountKey = descendants.runningCount === 1 ? 'count.running.one' : 'count.running.other';
    // Session summaries can announce membership before the descriptor-backed catalog catches up.
    // Keep that entry point visible through disabled loading rows; only catalog rows are navigable.
    const summaryBackedLoading = (descendants.count > 0 || variant === 'switcher')
        && (catalog === undefined || (catalog.state === 'ready' && catalog.entries.length === 0));
    const presentedCatalog = summaryBackedLoading
        ? {
            entries: [],
            parentAvailable: catalog?.parentAvailable ?? false,
            state: 'loading',
            error: null,
        }
        : catalog;
    useEffect(() => {
        if (variant !== 'switcher'
            || catalog !== undefined
            || requestedInitialCatalog.current === rootSessionId)
            return;
        requestedInitialCatalog.current = rootSessionId;
        refresh(rootSessionId);
    }, [catalog, refresh, rootSessionId, variant]);
    const observeCatalog = (parentSessionId, next) => {
        if (next)
            observedCatalogs.current.add(parentSessionId);
        else
            observedCatalogs.current.delete(parentSessionId);
        setCatalogOpen(parentSessionId, next);
    };
    const closeAllCatalogs = () => {
        for (const parentSessionId of observedCatalogs.current) {
            setCatalogOpen(parentSessionId, false);
        }
        observedCatalogs.current.clear();
        setExpanded(new Set());
    };
    const cancelHoverClose = () => {
        if (hoverCloseTimer.current === undefined)
            return;
        clearTimeout(hoverCloseTimer.current);
        hoverCloseTimer.current = undefined;
    };
    const cancelHoverOpen = () => {
        if (hoverOpenTimer.current === undefined)
            return;
        clearTimeout(hoverOpenTimer.current);
        hoverOpenTimer.current = undefined;
    };
    const changeOpen = (next, restoreFocus = false) => {
        cancelHoverOpen();
        cancelHoverClose();
        if (next) {
            const trigger = triggerRef.current;
            /* v8 ignore next -- a queued callback can outlive the trigger */
            if (trigger === null)
                return;
            setOpen(true);
            setMenuPosition(catalogMenuPosition(trigger));
            setNow(Date.now());
            observeCatalog(rootSessionId, true);
        }
        else {
            setOpen(false);
            setMenuPosition(undefined);
            closeAllCatalogs();
        }
        if (restoreFocus)
            queueMicrotask(() => { triggerRef.current?.focus(); });
    };
    const scheduleHoverOpen = () => {
        cancelHoverOpen();
        cancelHoverClose();
        if (open)
            return;
        hoverOpenTimer.current = setTimeout(() => {
            hoverOpenTimer.current = undefined;
            changeOpen(true);
        }, 150);
    };
    const scheduleHoverClose = () => {
        cancelHoverOpen();
        cancelHoverClose();
        hoverCloseTimer.current = setTimeout(() => {
            hoverCloseTimer.current = undefined;
            changeOpen(false);
        }, 120);
    };
    const closeBranch = (root) => {
        const closing = new Set();
        const visit = (parentSessionId) => {
            if (closing.has(parentSessionId) || !expanded.has(parentSessionId))
                return;
            closing.add(parentSessionId);
            const branch = catalogs[parentSessionId];
            for (const entry of branch?.entries ?? []) {
                if (entry.kind === 'child')
                    visit(entry.id);
            }
        };
        visit(root);
        for (const parentSessionId of closing)
            observeCatalog(parentSessionId, false);
        setExpanded(current => new Set([...current].filter(id => !closing.has(id))));
    };
    const toggleBranch = (childSessionId) => {
        if (expanded.has(childSessionId)) {
            closeBranch(childSessionId);
            return;
        }
        setExpanded(current => new Set(current).add(childSessionId));
        observeCatalog(childSessionId, true);
    };
    useEffect(() => {
        if (!open)
            return;
        const closeOutside = (event) => {
            if (event.target instanceof Node
                && !rootRef.current?.contains(event.target)
                && !menuRef.current?.contains(event.target)) {
                changeOpen(false);
            }
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => { document.removeEventListener('pointerdown', closeOutside); };
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const placeMenu = () => {
            const trigger = triggerRef.current;
            /* v8 ignore next -- native resize or scroll can outlive the trigger */
            if (trigger === null)
                return;
            setMenuPosition(catalogMenuPosition(trigger));
        };
        window.addEventListener('resize', placeMenu);
        document.addEventListener('scroll', placeMenu, true);
        return () => {
            window.removeEventListener('resize', placeMenu);
            document.removeEventListener('scroll', placeMenu, true);
        };
    }, [open]);
    useEffect(() => {
        if (!open || descendants.runningCount === 0)
            return;
        const timer = setInterval(() => { setNow(Date.now()); }, 1_000);
        return () => { clearInterval(timer); };
    }, [open, descendants.runningCount]);
    useEffect(() => () => {
        cancelHoverOpen();
        cancelHoverClose();
        for (const parentSessionId of observedCatalogs.current) {
            setCatalogOpenRef.current(parentSessionId, false);
        }
        observedCatalogs.current.clear();
    }, []);
    // Visibility needs evidence of children (entries, summary-known descendants,
    // or a failed load worth retrying). A bare loading catalog is not evidence:
    // selecting any session schedules a refresh whose loading snapshot would
    // otherwise flash the action in and out on childless sessions.
    // hideWhenZero（femo-plugin count 座位专用，2026-08-23）：官方 visible 看
    // 过滤前的 catalog.entries.length——Femo 主会话的目录里躺着被 fork 剥掉的
    // 投影窗/节点子代理条目，于是显示"0 个子代理"仍挂着。开启本开关后改看
    // 过滤后的 descendantCount（= 屏显数字），0 则整个触发器（文字+箭头）隐藏，
    // 与 dsh 真零子代理时的行为一致。缺省按变体：旧版 false，原生 true（刀⑧）。
    const visible = presentedCatalog !== undefined
        && (variant === 'switcher'
            || presentedCatalog.state === 'error'
            || (!hideWhenZeroEffective && presentedCatalog.entries.length > 0)
            || descendantCount > 0);
    useEffect(() => {
        if (visible)
            return;
        cancelHoverOpen();
        cancelHoverClose();
        if (!open)
            return;
        setOpen(false);
        closeAllCatalogs();
    }, [visible, open]);
    if (!visible)
        return null;
    const focusAt = (index) => {
        const items = treeItems(menuRef.current);
        if (items.length === 0)
            return;
        items[(index + items.length) % items.length]?.focus();
    };
    const navigate = (event) => {
        const items = treeItems(menuRef.current);
        const index = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
            event.preventDefault();
            changeOpen(false, true);
        }
        else if (event.key === 'Home') {
            event.preventDefault();
            focusAt(0);
        }
        else if (event.key === 'End') {
            event.preventDefault();
            focusAt(items.length - 1);
        }
        else if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusAt(index + 1);
        }
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusAt(index < 0 ? items.length - 1 : index - 1);
        }
    };
    return (_jsxs("div", { className: `${css.root} ${variant === 'switcher' ? css.switcherRoot : ''}`, ref: rootRef, onKeyDown: navigate, onMouseEnter: scheduleHoverOpen, onMouseLeave: scheduleHoverClose, children: [separator && _jsx("span", { className: css.separator, children: "/" }), _jsxs("button", { ref: triggerRef, type: "button", className: variant === 'switcher'
                    ? `${css.switcherTrigger} ${ancestorSwitcher ? css.ancestorSwitcherTrigger : ''}`
                    : css.trigger, "aria-haspopup": "tree", "aria-expanded": open, "aria-label": variant === 'switcher'
                    ? t('switcher.aria', { title: switcherDisplayTitle })
                    : t(descendants.runningCount > 0 ? runningCountKey : totalCountKey, { count: descendants.runningCount > 0 ? descendants.runningCount : descendantCount }), onClick: openTitle === undefined
                    ? undefined
                    : () => {
                        cancelHoverOpen();
                        if (open)
                            changeOpen(false);
                        openTitle();
                    }, onKeyDown: (event) => {
                    if (event.key !== 'ArrowDown')
                        return;
                    event.preventDefault();
                    if (!open)
                        changeOpen(true);
                    queueMicrotask(() => { focusAt(0); });
                }, children: [variant === 'switcher'
                        ? _jsx("span", { className: css.switcherTitle, children: switcherDisplayTitle })
                        : (_jsxs(_Fragment, { children: [descendants.runningCount > 0 && (_jsx("span", { className: css.activitySlot, children: _jsx(StateDot, { state: "ongoing" }) })), _jsx("span", { className: css.count, children: t(totalCountKey, { count: descendantCount }) }), showRunning && descendants.runningCount > 0 && (_jsx("span", { className: css.count, children: ` ${descendants.runningCount} 个在跑` }))] })), variant === 'switcher'
                        ? _jsx(SubagentSwitcherIcon, {})
                        : _jsx(IconChevronDown, { className: open ? css.triggerOpen : undefined })] }), open && createPortal((_jsx("div", { ref: menuRef, className: css.menu, style: menuPosition, role: "tree", "aria-label": t('tree.aria'), onMouseEnter: cancelHoverClose, onMouseLeave: scheduleHoverClose, children: _jsx(CatalogRows, { parentSessionId: rootSessionId, currentSessionId: currentSessionId, catalog: presentedCatalog, catalogs: catalogs, summaries: summaries, expanded: expanded, level: 1, now: now, openChild: openChild, refresh: refresh, toggleBranch: toggleBranch, closeCatalog: () => { changeOpen(false); }, t: t }) })), document.body)] }));
}
