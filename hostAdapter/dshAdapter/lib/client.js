window.__ModuleLoader__.load({
  id: "femo-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);

// client/lineage-fork.jsx
var import_jsx_runtime = require("react/jsx-runtime");
var import_react = require("react");
var import_react_dom = require("react-dom");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
function indexSubagentDescendants(summaries) {
  const indexed = /* @__PURE__ */ new Map();
  for (const descendant of Object.values(summaries)) {
    if (descendant.origin !== "subagent") continue;
    const seen = /* @__PURE__ */ new Set();
    let current = descendant;
    while (current?.origin === "subagent" && current.parentId !== void 0 && !seen.has(current.id)) {
      seen.add(current.id);
      const aggregate = indexed.get(current.parentId);
      if (aggregate === void 0) {
        indexed.set(current.parentId, { count: 1, runningCount: descendant.running ? 1 : 0 });
      } else {
        aggregate.count += 1;
        if (descendant.running) aggregate.runningCount += 1;
      }
      current = summaries[current.parentId];
    }
  }
  return indexed;
}
var css = {
  activitySlot: "A-xaeG_activitySlot",
  ancestorSwitcherTrigger: "A-xaeG_ancestorSwitcherTrigger",
  children: "A-xaeG_children",
  clickarea: "A-xaeG_clickarea",
  content: "A-xaeG_content",
  currentLabel: "A-xaeG_currentLabel",
  disabled: "A-xaeG_disabled",
  disclosure: "A-xaeG_disclosure",
  disclosureOpen: "A-xaeG_disclosureOpen",
  disclosureSpace: "A-xaeG_disclosureSpace",
  error: "A-xaeG_error",
  label: "A-xaeG_label",
  loadingRow: "A-xaeG_loadingRow",
  menu: "A-xaeG_menu",
  metricDuration: "A-xaeG_metricDuration",
  metricToken: "A-xaeG_metricToken",
  metrics: "A-xaeG_metrics",
  node: "A-xaeG_node",
  notice: "A-xaeG_notice",
  refresh: "A-xaeG_refresh",
  root: "A-xaeG_root",
  row: "A-xaeG_row",
  separator: "A-xaeG_separator",
  summary: "A-xaeG_summary",
  switcherRoot: "A-xaeG_switcherRoot",
  switcherTitle: "A-xaeG_switcherTitle",
  switcherTrigger: "A-xaeG_switcherTrigger",
  trigger: "A-xaeG_trigger",
  triggerOpen: "A-xaeG_triggerOpen"
};
function femoHiddenId(id) {
  return typeof id === "string" && id.startsWith("femo-proj-");
}
function femoNativeCatalog() {
  return window.__femoNative === true;
}
function femoHiddenLabel(label) {
  if (femoNativeCatalog()) return false;
  return typeof label === "string" && label.startsWith("femo-node-");
}
function femoStripEntries(entries) {
  if (femoNativeCatalog()) {
    return entries.map((entry) => typeof entry.label === "string" && entry.label.startsWith("femo-node-") ? { ...entry, label: entry.label.slice("femo-node-".length) } : entry);
  }
  return entries.filter((entry) => !femoHiddenId(entry.id) && !femoHiddenLabel(entry.label));
}
function femoStripSummaries(byId) {
  const native = femoNativeCatalog();
  const out = {};
  for (const [id, summary] of Object.entries(byId ?? {})) {
    if (femoHiddenId(id)) continue;
    if (!native && femoHiddenLabel(summary?.displayTitle)) continue;
    out[id] = summary;
  }
  return out;
}
function diagnosticReason(entry, t) {
  switch (entry.reason) {
    case "corrupt":
      return t("diagnostic.corrupt");
    case "unsupported":
      return t("diagnostic.unsupported");
    case "unavailable":
      return t("diagnostic.unavailable");
  }
}
function treeItems(root) {
  return root === null ? [] : Array.from(root.querySelectorAll('[role="treeitem"]:not([aria-disabled="true"])'));
}
function formatTokens(value) {
  const scaled = (next) => next >= 100 ? String(Math.round(next)) : String(Math.round(next * 10) / 10);
  if (value < 1e3)
    return String(value);
  if (value < 1e6)
    return `${scaled(value / 1e3)}K`;
  return `${scaled(value / 1e6)}M`;
}
function tokenTotal(usage) {
  return usage === void 0 ? void 0 : usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
function activityDuration(summary, activity, now) {
  if (summary === void 0)
    return void 0;
  const timing = summary.projectionValues?.subagentTiming;
  if (timing === void 0)
    return void 0;
  if (timing.active === void 0)
    return timing.settledMs;
  const end = activity === "running" ? now : timing.active.through;
  return timing.settledMs + Math.max(0, end - timing.active.since);
}
function splitDuration(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1e3);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  return {
    seconds: totalSeconds % 60,
    minutes: totalMinutes % 60,
    hours: totalHours % 24,
    days: Math.floor(totalHours / 24),
    totalMinutes,
    totalHours
  };
}
function formatDuration(ms, t) {
  const { seconds, minutes, hours, days, totalMinutes, totalHours } = splitDuration(ms);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor(days % 365 / 30);
    return months === 0 ? t("duration.years", { years }) : t("duration.yearsMonths", { years, months });
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return remainingDays === 0 ? t("duration.months", { months }) : t("duration.monthsDays", { months, days: remainingDays });
  }
  if (days > 0) {
    return hours === 0 ? t("duration.days", { days }) : t("duration.daysHours", { days, hours });
  }
  if (totalHours > 0) {
    return t("duration.hours", {
      hours: totalHours,
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0")
    });
  }
  if (totalMinutes > 0) {
    return t("duration.minutes", {
      minutes: totalMinutes,
      seconds: String(seconds).padStart(2, "0")
    });
  }
  return t("duration.seconds", { seconds });
}
function formatExactDuration(ms, t) {
  const { seconds, minutes, hours, days } = splitDuration(ms);
  return days === 0 ? formatDuration(ms, t) : t("duration.exactDays", {
    days,
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0")
  });
}
var NO_DESCENDANTS = { count: 0, runningCount: 0 };
function SubagentSwitcherIcon() {
  return (0, import_jsx_runtime.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", children: [(0, import_jsx_runtime.jsx)("path", { d: "M5.99951 12.7L8.95546 14.9478C9.40011 15.2859 9.62244 15.455 9.87526 15.488C9.95774 15.4988 10.0413 15.4988 10.1238 15.488C10.3766 15.455 10.5989 15.2859 11.0436 14.9478L13.9995 12.7", stroke: "currentColor", strokeWidth: "1.5" }), (0, import_jsx_runtime.jsx)("path", { d: "M13.9995 7.7417L11.0436 5.49387C10.5989 5.15574 10.3766 4.98668 10.1238 4.95362C10.0413 4.94283 9.95775 4.94283 9.87527 4.95362C9.62245 4.98668 9.40012 5.15574 8.95547 5.49387L5.99952 7.7417", stroke: "currentColor", strokeWidth: "1.5" })] });
}
function CatalogLoadingRows({ parentSessionId, summaries, level, t }) {
  const children = Object.values(summaries).filter((summary) => summary.origin === "subagent" && summary.parentId === parentSessionId).filter((summary) => !femoHiddenId(summary.id) && !femoHiddenLabel(summary.displayTitle));
  if (children.length === 0)
    return (0, import_jsx_runtime.jsx)("div", { className: css.notice, children: t("loading.label") });
  return children.map((summary) => (0, import_jsx_runtime.jsx)("div", { className: css.node, children: (0, import_jsx_runtime.jsxs)("div", { role: "treeitem", "aria-disabled": "true", "aria-level": level, "aria-label": t("loading.aria"), className: `${css.row} ${css.disabled} ${css.loadingRow}`, children: [(0, import_jsx_runtime.jsx)("span", { className: css.disclosureSpace }), (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: summary.running ? "ongoing" : "done" }), (0, import_jsx_runtime.jsx)("span", { className: css.content, children: (0, import_jsx_runtime.jsx)("span", { className: css.label, children: t("loading.label") }) })] }) }, summary.id));
}
function CatalogRows({ parentSessionId, currentSessionId, catalog, catalogs, summaries, expanded, level, now, openChild, refresh, toggleBranch, closeCatalog, t }) {
  const emptyLoading = catalog.state === "loading" && catalog.entries.length === 0;
  const reserveDisclosure = catalog.entries.some((entry) => entry.kind === "child" && entry.hasChildren);
  return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [emptyLoading && (0, import_jsx_runtime.jsx)(CatalogLoadingRows, { parentSessionId, summaries, level, t }), catalog.state === "error" && (0, import_jsx_runtime.jsxs)("div", { className: css.error, children: [(0, import_jsx_runtime.jsx)("span", { children: catalog.error?.message ?? t("load.error") }), (0, import_jsx_runtime.jsxs)("button", { type: "button", className: css.refresh, onClick: () => {
    refresh(parentSessionId);
  }, children: [(0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconRefreshOutline14, {}), t("retry")] })] }), femoStripEntries(catalog.entries).map((entry) => {
    if (entry.kind === "diagnostic") {
      const reason = diagnosticReason(entry, t);
      return (0, import_jsx_runtime.jsx)("div", { className: css.node, children: (0, import_jsx_runtime.jsxs)("div", { role: "treeitem", "aria-disabled": "true", "aria-level": level, "aria-label": `${entry.id} ${reason}`, className: `${css.row} ${css.disabled}`, title: reason, children: [reserveDisclosure && (0, import_jsx_runtime.jsx)("span", { className: css.disclosureSpace }), (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "error" }), (0, import_jsx_runtime.jsxs)("span", { className: css.content, children: [(0, import_jsx_runtime.jsx)("span", { className: css.label, children: entry.id }), (0, import_jsx_runtime.jsx)("span", { className: css.summary, children: reason })] })] }) }, entry.id);
    }
    const childCatalog = catalogs[entry.id];
    const isCurrent = entry.id === currentSessionId;
    const isExpanded = expanded.has(entry.id);
    const knownLeaf = !entry.hasChildren;
    const childLoading = childCatalog === void 0 || childCatalog.state === "loading" && childCatalog.entries.length === 0;
    const summary = summaries[entry.id];
    const label = entry.label ?? entry.id;
    const mode = entry.mode === "one-shot" ? t("mode.oneShot") : t("mode.continuable");
    const activity = entry.activity === "running" ? t("activity.running") : t("activity.inactive");
    const secondary = [summary?.title, mode, activity].filter((value) => value !== void 0).join(" \u8DEF ");
    const totalTokens = tokenTotal(summary?.projectionValues?.tokenUsage);
    const durationMs = activityDuration(summary, entry.activity, now);
    const tokenMetric = totalTokens === void 0 ? void 0 : `${formatTokens(totalTokens)} tok`;
    const durationMetric = durationMs === void 0 ? void 0 : {
      compact: formatDuration(durationMs, t),
      exact: formatExactDuration(durationMs, t)
    };
    const metrics = [tokenMetric, durationMetric?.exact].filter((value) => value !== void 0).join(" \u8DEF ");
    const open = () => {
      openChild({ parentSessionId, childSessionId: entry.id, mode: entry.mode });
      closeCatalog();
    };
    const handleKey = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        open();
      } else if (event.key === "ArrowRight" && !knownLeaf && !isExpanded || event.key === "ArrowLeft" && isExpanded) {
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
    return (0, import_jsx_runtime.jsxs)("div", { className: css.node, children: [(0, import_jsx_runtime.jsxs)("div", { role: "treeitem", tabIndex: 0, "aria-level": level, "aria-current": isCurrent || void 0, "aria-label": [label, secondary, metrics].filter((value) => value !== "").join(" "), ...knownLeaf ? {} : { "aria-expanded": isExpanded }, className: css.row, onClick: open, onKeyDown: handleKey, children: [knownLeaf ? reserveDisclosure && (0, import_jsx_runtime.jsx)("span", { className: css.disclosureSpace }) : (0, import_jsx_runtime.jsx)("button", { type: "button", tabIndex: -1, className: `${css.disclosure} ${isExpanded ? css.disclosureOpen : ""}`, "aria-label": t(isExpanded ? "branch.collapse" : "branch.expand", { label }), onClick: toggle, children: (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronRightOutline14, {}) }), (0, import_jsx_runtime.jsxs)("div", { className: css.clickarea, children: [(0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: entry.activity === "running" ? "ongoing" : "done" }), (0, import_jsx_runtime.jsxs)("span", { className: css.content, children: [(0, import_jsx_runtime.jsx)("span", { className: `${css.label} ${isCurrent ? css.currentLabel : ""}`, children: label }), (0, import_jsx_runtime.jsx)("span", { className: css.summary, children: secondary })] }), metrics !== "" && (0, import_jsx_runtime.jsxs)("span", { className: css.metrics, children: [tokenMetric !== void 0 && (0, import_jsx_runtime.jsx)("span", { className: css.metricToken, children: tokenMetric }), durationMetric !== void 0 && (0, import_jsx_runtime.jsx)("span", { className: css.metricDuration, title: t("duration.exactTitle", { duration: durationMetric.exact }), children: durationMetric.compact })] })] })] }), isExpanded && !knownLeaf && (0, import_jsx_runtime.jsx)("div", { role: "group", className: css.children, "aria-busy": childLoading || void 0, children: childCatalog === void 0 ? (0, import_jsx_runtime.jsx)(CatalogLoadingRows, { parentSessionId: entry.id, summaries, level: level + 1, t }) : (0, import_jsx_runtime.jsx)(CatalogRows, { parentSessionId: entry.id, currentSessionId, catalog: childCatalog, catalogs, summaries, expanded, level: level + 1, now, openChild, refresh, toggleBranch, closeCatalog, t }) })] }, entry.id);
  })] });
}
var MENU_VIEWPORT_MARGIN = 16;
function catalogMenuPosition(trigger) {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(336, window.innerWidth - MENU_VIEWPORT_MARGIN * 2);
  return {
    top: rect.bottom + 5,
    left: Math.min(Math.max(MENU_VIEWPORT_MARGIN, rect.left), window.innerWidth - width - MENU_VIEWPORT_MARGIN)
  };
}
function CatalogDropdown({ rootSessionId, currentSessionId, displayTitle, openTitle, variant, separator = false, showRunning = false, hideWhenZero = false, useSessions, openChild, refresh, setCatalogOpen, t }) {
  const ancestorSwitcher = variant === "switcher" && openTitle !== void 0;
  const catalogs = useSessions((state) => state.subagentsByParent);
  const summaries = useSessions((state) => state.byId);
  const catalog = catalogs[rootSessionId];
  const [open, setOpen] = (0, import_react.useState)(false);
  const [menuPosition, setMenuPosition] = (0, import_react.useState)();
  const [now, setNow] = (0, import_react.useState)(() => Date.now());
  const [expanded, setExpanded] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const rootRef = (0, import_react.useRef)(null);
  const triggerRef = (0, import_react.useRef)(null);
  const menuRef = (0, import_react.useRef)(null);
  const hoverOpenTimer = (0, import_react.useRef)(void 0);
  const hoverCloseTimer = (0, import_react.useRef)(void 0);
  const observedCatalogs = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  const requestedInitialCatalog = (0, import_react.useRef)();
  const setCatalogOpenRef = (0, import_react.useRef)(setCatalogOpen);
  setCatalogOpenRef.current = setCatalogOpen;
  const currentEntry = currentSessionId === void 0 ? void 0 : catalog?.entries.find((entry) => entry.kind === "child" && entry.id === currentSessionId);
  const switcherDisplayTitle = currentEntry?.kind === "child" ? currentEntry.label ?? currentEntry.id : displayTitle;
  const healthy = femoStripEntries(catalog?.entries.filter((entry) => entry.kind === "child") ?? []);
  const descendants = (0, import_react.useMemo)(() => indexSubagentDescendants(femoStripSummaries(summaries)).get(rootSessionId) ?? NO_DESCENDANTS, [rootSessionId, summaries]);
  const descendantCount = Math.max(healthy.length, descendants.count);
  const totalCountKey = descendantCount === 1 ? "count.total.one" : "count.total.other";
  const runningCountKey = descendants.runningCount === 1 ? "count.running.one" : "count.running.other";
  const summaryBackedLoading = (descendants.count > 0 || variant === "switcher") && (catalog === void 0 || catalog.state === "ready" && catalog.entries.length === 0);
  const presentedCatalog = summaryBackedLoading ? {
    entries: [],
    parentAvailable: catalog?.parentAvailable ?? false,
    state: "loading",
    error: null
  } : catalog;
  (0, import_react.useEffect)(() => {
    if (variant !== "switcher" || catalog !== void 0 || requestedInitialCatalog.current === rootSessionId)
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
    setExpanded(/* @__PURE__ */ new Set());
  };
  const cancelHoverClose = () => {
    if (hoverCloseTimer.current === void 0)
      return;
    clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = void 0;
  };
  const cancelHoverOpen = () => {
    if (hoverOpenTimer.current === void 0)
      return;
    clearTimeout(hoverOpenTimer.current);
    hoverOpenTimer.current = void 0;
  };
  const changeOpen = (next, restoreFocus = false) => {
    cancelHoverOpen();
    cancelHoverClose();
    if (next) {
      const trigger = triggerRef.current;
      if (trigger === null)
        return;
      setOpen(true);
      setMenuPosition(catalogMenuPosition(trigger));
      setNow(Date.now());
      observeCatalog(rootSessionId, true);
    } else {
      setOpen(false);
      setMenuPosition(void 0);
      closeAllCatalogs();
    }
    if (restoreFocus)
      queueMicrotask(() => {
        triggerRef.current?.focus();
      });
  };
  const scheduleHoverOpen = () => {
    cancelHoverOpen();
    cancelHoverClose();
    if (open)
      return;
    hoverOpenTimer.current = setTimeout(() => {
      hoverOpenTimer.current = void 0;
      changeOpen(true);
    }, 150);
  };
  const scheduleHoverClose = () => {
    cancelHoverOpen();
    cancelHoverClose();
    hoverCloseTimer.current = setTimeout(() => {
      hoverCloseTimer.current = void 0;
      changeOpen(false);
    }, 120);
  };
  const closeBranch = (root) => {
    const closing = /* @__PURE__ */ new Set();
    const visit = (parentSessionId) => {
      if (closing.has(parentSessionId) || !expanded.has(parentSessionId))
        return;
      closing.add(parentSessionId);
      const branch = catalogs[parentSessionId];
      for (const entry of branch?.entries ?? []) {
        if (entry.kind === "child")
          visit(entry.id);
      }
    };
    visit(root);
    for (const parentSessionId of closing)
      observeCatalog(parentSessionId, false);
    setExpanded((current) => new Set([...current].filter((id) => !closing.has(id))));
  };
  const toggleBranch = (childSessionId) => {
    if (expanded.has(childSessionId)) {
      closeBranch(childSessionId);
      return;
    }
    setExpanded((current) => new Set(current).add(childSessionId));
    observeCatalog(childSessionId, true);
  };
  (0, import_react.useEffect)(() => {
    if (!open)
      return;
    const closeOutside = (event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        changeOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);
  (0, import_react.useEffect)(() => {
    if (!open)
      return;
    const placeMenu = () => {
      const trigger = triggerRef.current;
      if (trigger === null)
        return;
      setMenuPosition(catalogMenuPosition(trigger));
    };
    window.addEventListener("resize", placeMenu);
    document.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      document.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);
  (0, import_react.useEffect)(() => {
    if (!open || descendants.runningCount === 0)
      return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1e3);
    return () => {
      clearInterval(timer);
    };
  }, [open, descendants.runningCount]);
  (0, import_react.useEffect)(() => () => {
    cancelHoverOpen();
    cancelHoverClose();
    for (const parentSessionId of observedCatalogs.current) {
      setCatalogOpenRef.current(parentSessionId, false);
    }
    observedCatalogs.current.clear();
  }, []);
  const visible = presentedCatalog !== void 0 && (variant === "switcher" || presentedCatalog.state === "error" || !hideWhenZero && presentedCatalog.entries.length > 0 || descendantCount > 0);
  (0, import_react.useEffect)(() => {
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
    if (event.key === "Escape") {
      event.preventDefault();
      changeOpen(false, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAt(items.length - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(index < 0 ? items.length - 1 : index - 1);
    }
  };
  return (0, import_jsx_runtime.jsxs)("div", { className: `${css.root} ${variant === "switcher" ? css.switcherRoot : ""}`, ref: rootRef, onKeyDown: navigate, onMouseEnter: scheduleHoverOpen, onMouseLeave: scheduleHoverClose, children: [separator && (0, import_jsx_runtime.jsx)("span", { className: css.separator, children: "/" }), (0, import_jsx_runtime.jsxs)("button", { ref: triggerRef, type: "button", className: variant === "switcher" ? `${css.switcherTrigger} ${ancestorSwitcher ? css.ancestorSwitcherTrigger : ""}` : css.trigger, "aria-haspopup": "tree", "aria-expanded": open, "aria-label": variant === "switcher" ? t("switcher.aria", { title: switcherDisplayTitle }) : t(descendants.runningCount > 0 ? runningCountKey : totalCountKey, { count: descendants.runningCount > 0 ? descendants.runningCount : descendantCount }), onClick: openTitle === void 0 ? void 0 : () => {
    cancelHoverOpen();
    if (open)
      changeOpen(false);
    openTitle();
  }, onKeyDown: (event) => {
    if (event.key !== "ArrowDown")
      return;
    event.preventDefault();
    if (!open)
      changeOpen(true);
    queueMicrotask(() => {
      focusAt(0);
    });
  }, children: [variant === "switcher" ? (0, import_jsx_runtime.jsx)("span", { className: css.switcherTitle, children: switcherDisplayTitle }) : (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [descendants.runningCount > 0 && (0, import_jsx_runtime.jsx)("span", { className: css.activitySlot, children: (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) }), (0, import_jsx_runtime.jsx)("span", { className: css.count, children: t(totalCountKey, { count: descendantCount }) }), showRunning && descendants.runningCount > 0 && (0, import_jsx_runtime.jsx)("span", { className: css.count, children: ` ${descendants.runningCount} \u4E2A\u5728\u8DD1` })] }), variant === "switcher" ? (0, import_jsx_runtime.jsx)(SubagentSwitcherIcon, {}) : (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutline14, { className: open ? css.triggerOpen : void 0 })] }), open && (0, import_react_dom.createPortal)((0, import_jsx_runtime.jsx)("div", { ref: menuRef, className: css.menu, style: menuPosition, role: "tree", "aria-label": t("tree.aria"), onMouseEnter: cancelHoverClose, onMouseLeave: scheduleHoverClose, children: (0, import_jsx_runtime.jsx)(CatalogRows, { parentSessionId: rootSessionId, currentSessionId, catalog: presentedCatalog, catalogs, summaries, expanded, level: 1, now, openChild, refresh, toggleBranch, closeCatalog: () => {
    changeOpen(false);
  }, t }) }), document.body)] });
}
function SubagentHeaderLineage({ lineageSessionId, displayTitle, openTitle, useSessions, openChild, refresh, setCatalogOpen, t }) {
  const summary = useSessions((state) => state.byId[lineageSessionId]);
  const parentId = summary?.origin === "subagent" ? summary.parentId : void 0;
  const isFemoProj = femoHiddenId(lineageSessionId);
  const isFemoMain = !isFemoProj && summary?.agentPreset === "femo-plugin" && parentId === void 0;
  if (isFemoProj)
    return null;
  if (isFemoMain)
    return (0, import_jsx_runtime.jsx)("span", { className: css.separator, children: "/" });
  const shared = { useSessions, openChild, refresh, setCatalogOpen, t };
  if (parentId === void 0) {
    return (0, import_jsx_runtime.jsx)(CatalogDropdown, { rootSessionId: lineageSessionId, variant: "count", separator: true, ...shared }, lineageSessionId);
  }
  return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)(CatalogDropdown, { rootSessionId: parentId, currentSessionId: lineageSessionId, variant: "switcher", displayTitle, ...openTitle === void 0 ? {} : { openTitle }, ...shared }, lineageSessionId), openTitle === void 0 && (0, import_jsx_runtime.jsx)(CatalogDropdown, { rootSessionId: lineageSessionId, variant: "count", ...shared }, lineageSessionId)] });
}

// client/lineage-fork-native.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var import_react2 = require("react");
var import_react_dom2 = require("react-dom");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
function indexSubagentDescendants2(summaries) {
  const indexed = /* @__PURE__ */ new Map();
  for (const descendant of Object.values(summaries)) {
    if (descendant.origin !== "subagent") continue;
    const seen = /* @__PURE__ */ new Set();
    let current = descendant;
    while (current?.origin === "subagent" && current.parentId !== void 0 && !seen.has(current.id)) {
      seen.add(current.id);
      const aggregate = indexed.get(current.parentId);
      if (aggregate === void 0) {
        indexed.set(current.parentId, { count: 1, runningCount: descendant.running ? 1 : 0 });
      } else {
        aggregate.count += 1;
        if (descendant.running) aggregate.runningCount += 1;
      }
      current = summaries[current.parentId];
    }
  }
  return indexed;
}
var LINEAGE_CSS_TAG_ID = "@deepseek-ai/dsh-client-ui-subagent/SubagentHeaderLineage.module.css";
var css2 = new Proxy({}, {
  get(_target, prop) {
    if (typeof prop !== "string") return void 0;
    if (lineageCssResolved !== void 0) return lineageCssResolved[prop] ?? "";
    const parsed = parseLineageCss();
    if (parsed !== void 0) {
      lineageCssResolved = parsed;
      return lineageCssResolved[prop] ?? "";
    }
    return LINEAGE_CSS_FALLBACK[prop] ?? "";
  }
});
var lineageCssResolved;
var LINEAGE_CSS_FALLBACK = {
  activitySlot: "Hrbyxa_activitySlot",
  ancestorSwitcherTrigger: "Hrbyxa_ancestorSwitcherTrigger",
  children: "Hrbyxa_children",
  clickarea: "Hrbyxa_clickarea",
  content: "Hrbyxa_content",
  currentLabel: "Hrbyxa_currentLabel",
  disabled: "Hrbyxa_disabled",
  disclosure: "Hrbyxa_disclosure",
  disclosureOpen: "Hrbyxa_disclosureOpen",
  disclosureSpace: "Hrbyxa_disclosureSpace",
  error: "Hrbyxa_error",
  label: "Hrbyxa_label",
  loadingRow: "Hrbyxa_loadingRow",
  menu: "Hrbyxa_menu",
  metricDuration: "Hrbyxa_metricDuration",
  metricToken: "Hrbyxa_metricToken",
  metrics: "Hrbyxa_metrics",
  node: "Hrbyxa_node",
  notice: "Hrbyxa_notice",
  refresh: "Hrbyxa_refresh",
  root: "Hrbyxa_root",
  row: "Hrbyxa_row",
  separator: "Hrbyxa_separator",
  summary: "Hrbyxa_summary",
  switcherRoot: "Hrbyxa_switcherRoot",
  switcherTitle: "Hrbyxa_switcherTitle",
  switcherTrigger: "Hrbyxa_switcherTrigger",
  trigger: "Hrbyxa_trigger",
  triggerOpen: "Hrbyxa_triggerOpen"
};
function parseLineageCss() {
  try {
    const tag = document.querySelector(`style[data-plugin-css="${LINEAGE_CSS_TAG_ID}"]`);
    const text = tag?.textContent ?? "";
    if (text.length === 0) return void 0;
    const map = {};
    const re = /\.([A-Za-z0-9]+)_([A-Za-z0-9]+)(?=[{.:,[\s)])/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = m[2];
      if (!(name in map)) map[name] = `${m[1]}_${m[2]}`;
    }
    if (map.root === void 0 || map.menu === void 0 || map.row === void 0) return void 0;
    return map;
  } catch {
    return void 0;
  }
}
function femoNativeHiddenId(id) {
  if (typeof id !== "string") return false;
  return id.startsWith("femo-proj-") || id.startsWith("femo-actor-");
}
function femoNativeHiddenLabel(label) {
  return typeof label === "string" && label.startsWith("femo-node-");
}
function femoStripEntries2(entries) {
  return entries.filter((entry) => !(entry.kind === "child" && (femoNativeHiddenId(entry.id) || femoNativeHiddenLabel(entry.label))));
}
function femoStripSummaries2(byId) {
  const out = {};
  for (const [id, summary] of Object.entries(byId ?? {})) {
    if (summary?.origin !== "subagent") {
      out[id] = summary;
      continue;
    }
    if (femoNativeHiddenId(id)) continue;
    if (femoNativeHiddenLabel(summary?.projectionValues?.subagent?.label)) continue;
    out[id] = summary;
  }
  return out;
}
function diagnosticReason2(entry, t) {
  switch (entry.reason) {
    case "corrupt":
      return t("diagnostic.corrupt");
    case "unsupported":
      return t("diagnostic.unsupported");
    case "unavailable":
      return t("diagnostic.unavailable");
  }
}
function treeItems2(root) {
  return root === null ? [] : Array.from(root.querySelectorAll('[role="treeitem"]:not([aria-disabled="true"])'));
}
function formatTokens2(value) {
  const scaled = (next) => next >= 100 ? String(Math.round(next)) : String(Math.round(next * 10) / 10);
  if (value < 1e3)
    return String(value);
  if (value < 1e6)
    return `${scaled(value / 1e3)}K`;
  return `${scaled(value / 1e6)}M`;
}
function tokenTotal2(usage) {
  return usage === void 0 ? void 0 : usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
function activityDuration2(summary, activity, now) {
  if (summary === void 0)
    return void 0;
  const timing = summary.projectionValues?.subagentTiming;
  if (timing === void 0)
    return void 0;
  if (timing.active === void 0)
    return timing.settledMs;
  const end = activity === "running" ? now : timing.active.through;
  return timing.settledMs + Math.max(0, end - timing.active.since);
}
function splitDuration2(ms) {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1e3);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  return {
    seconds: totalSeconds % 60,
    minutes: totalMinutes % 60,
    hours: totalHours % 24,
    days: Math.floor(totalHours / 24),
    totalMinutes,
    totalHours
  };
}
function formatDuration2(ms, t) {
  const { seconds, minutes, hours, days, totalMinutes, totalHours } = splitDuration2(ms);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor(days % 365 / 30);
    return months === 0 ? t("duration.years", { years }) : t("duration.yearsMonths", { years, months });
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return remainingDays === 0 ? t("duration.months", { months }) : t("duration.monthsDays", { months, days: remainingDays });
  }
  if (days > 0) {
    return hours === 0 ? t("duration.days", { days }) : t("duration.daysHours", { days, hours });
  }
  if (totalHours > 0) {
    return t("duration.hours", {
      hours,
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0")
    });
  }
  if (totalMinutes > 0) {
    return t("duration.minutes", {
      minutes,
      seconds: String(seconds).padStart(2, "0")
    });
  }
  return t("duration.seconds", { seconds });
}
function formatExactDuration2(ms, t) {
  const { seconds, minutes, hours, days } = splitDuration2(ms);
  return days === 0 ? formatDuration2(ms, t) : t("duration.exactDays", {
    days,
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0")
  });
}
var NO_DESCENDANTS2 = { count: 0, runningCount: 0 };
function SubagentSwitcherIcon2() {
  return (0, import_jsx_runtime2.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true", children: [(0, import_jsx_runtime2.jsx)("path", { d: "M5.99951 12.7L8.95546 14.9478C9.40011 15.2859 9.62244 15.455 9.87526 15.488C9.95774 15.4988 10.0413 15.4988 10.1238 15.488C10.3766 15.455 10.5989 15.2859 11.0436 14.9478L13.9995 12.7", stroke: "currentColor", strokeWidth: "1.5" }), (0, import_jsx_runtime2.jsx)("path", { d: "M13.9995 7.7417L11.0436 5.49387C10.5989 5.15574 10.3766 4.98668 10.1238 4.95362C10.0413 4.94283 9.95775 4.94283 9.87527 4.95362C9.62245 4.98668 9.40012 5.15574 8.95547 5.49387L5.99952 7.7417", stroke: "currentColor", strokeWidth: "1.5" })] });
}
function CatalogLoadingRows2({ parentSessionId, summaries, level, t }) {
  const children = Object.values(summaries).filter((summary) => summary.origin === "subagent" && summary.parentId === parentSessionId).filter((summary) => !femoNativeHiddenId(summary.id));
  if (children.length === 0)
    return (0, import_jsx_runtime2.jsx)("div", { className: css2.notice, children: t("loading.label") });
  return children.map((summary) => (0, import_jsx_runtime2.jsx)("div", { className: css2.node, children: (0, import_jsx_runtime2.jsxs)("div", { role: "treeitem", "aria-disabled": "true", "aria-level": level, "aria-label": t("loading.aria"), className: `${css2.row} ${css2.disabled} ${css2.loadingRow}`, children: [(0, import_jsx_runtime2.jsx)("span", { className: css2.disclosureSpace }), (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: summary.running ? "ongoing" : "done" }), (0, import_jsx_runtime2.jsx)("span", { className: css2.content, children: (0, import_jsx_runtime2.jsx)("span", { className: css2.label, children: t("loading.label") }) })] }) }, summary.id));
}
function CatalogRows2({ parentSessionId, currentSessionId, catalog, catalogs, summaries, expanded, level, now, openChild, refresh, toggleBranch, closeCatalog, t }) {
  const emptyLoading = catalog.state === "loading" && catalog.entries.length === 0;
  const reserveDisclosure = catalog.entries.some((entry) => entry.kind === "child" && entry.hasChildren);
  return (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [emptyLoading && (0, import_jsx_runtime2.jsx)(CatalogLoadingRows2, { parentSessionId, summaries, level, t }), catalog.state === "error" && (0, import_jsx_runtime2.jsxs)("div", { className: css2.error, children: [(0, import_jsx_runtime2.jsx)("span", { children: catalog.error?.message ?? t("load.error") }), (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: css2.refresh, onClick: () => {
    refresh(parentSessionId);
  }, children: [(0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconRefreshOutline14, {}), t("retry")] })] }), femoStripEntries2(catalog.entries).map((entry) => {
    if (entry.kind === "diagnostic") {
      const reason = diagnosticReason2(entry, t);
      return (0, import_jsx_runtime2.jsx)("div", { className: css2.node, children: (0, import_jsx_runtime2.jsxs)("div", { role: "treeitem", "aria-disabled": "true", "aria-level": level, "aria-label": `${entry.id} ${reason}`, className: `${css2.row} ${css2.disabled}`, title: reason, children: [reserveDisclosure && (0, import_jsx_runtime2.jsx)("span", { className: css2.disclosureSpace }), (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: "error" }), (0, import_jsx_runtime2.jsxs)("span", { className: css2.content, children: [(0, import_jsx_runtime2.jsx)("span", { className: css2.label, children: entry.id }), (0, import_jsx_runtime2.jsx)("span", { className: css2.summary, children: reason })] })] }) }, entry.id);
    }
    const childCatalog = catalogs[entry.id];
    const isCurrent = entry.id === currentSessionId;
    const isExpanded = expanded.has(entry.id);
    const knownLeaf = !entry.hasChildren;
    const childLoading = childCatalog === void 0 || childCatalog.state === "loading" && childCatalog.entries.length === 0;
    const summary = summaries[entry.id];
    const label = entry.label ?? entry.id;
    const mode = entry.mode === "one-shot" ? t("mode.oneShot") : t("mode.continuable");
    const activity = entry.activity === "running" ? t("activity.running") : t("activity.inactive");
    const secondary = [summary?.title, mode, activity].filter((value) => value !== void 0).join(" \xB7 ");
    const totalTokens = tokenTotal2(summary?.projectionValues?.tokenUsage);
    const durationMs = activityDuration2(summary, entry.activity, now);
    const tokenMetric = totalTokens === void 0 ? void 0 : `${formatTokens2(totalTokens)} tok`;
    const durationMetric = durationMs === void 0 ? void 0 : {
      compact: formatDuration2(durationMs, t),
      exact: formatExactDuration2(durationMs, t)
    };
    const metrics = [tokenMetric, durationMetric?.exact].filter((value) => value !== void 0).join(" \xB7 ");
    const open = () => {
      openChild({ parentSessionId, childSessionId: entry.id, mode: entry.mode });
      closeCatalog();
    };
    const handleKey = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        open();
      } else if (event.key === "ArrowRight" && !knownLeaf && !isExpanded || event.key === "ArrowLeft" && isExpanded) {
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
    return (0, import_jsx_runtime2.jsxs)("div", { className: css2.node, children: [(0, import_jsx_runtime2.jsxs)("div", { role: "treeitem", tabIndex: 0, "aria-level": level, "aria-current": isCurrent || void 0, "aria-label": [label, secondary, metrics].filter((value) => value !== "").join(" "), ...knownLeaf ? {} : { "aria-expanded": isExpanded }, className: css2.row, onClick: open, onKeyDown: handleKey, children: [knownLeaf ? reserveDisclosure && (0, import_jsx_runtime2.jsx)("span", { className: css2.disclosureSpace }) : (0, import_jsx_runtime2.jsx)("button", { type: "button", tabIndex: -1, className: `${css2.disclosure} ${isExpanded ? css2.disclosureOpen : ""}`, "aria-label": t(isExpanded ? "branch.collapse" : "branch.expand", { label }), onClick: toggle, children: (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconChevronRightOutline14, {}) }), (0, import_jsx_runtime2.jsxs)("div", { className: css2.clickarea, children: [(0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: entry.activity === "running" ? "ongoing" : "done" }), (0, import_jsx_runtime2.jsxs)("span", { className: css2.content, children: [(0, import_jsx_runtime2.jsx)("span", { className: `${css2.label} ${isCurrent ? css2.currentLabel : ""}`, children: label }), (0, import_jsx_runtime2.jsx)("span", { className: css2.summary, children: secondary })] }), metrics !== "" && (0, import_jsx_runtime2.jsxs)("span", { className: css2.metrics, children: [tokenMetric !== void 0 && (0, import_jsx_runtime2.jsx)("span", { className: css2.metricToken, children: tokenMetric }), durationMetric !== void 0 && (0, import_jsx_runtime2.jsx)("span", { className: css2.metricDuration, title: t("duration.exactTitle", { duration: durationMetric.exact }), children: durationMetric.compact })] })] })] }), isExpanded && !knownLeaf && (0, import_jsx_runtime2.jsx)("div", { role: "group", className: css2.children, "aria-busy": childLoading || void 0, children: childCatalog === void 0 ? (0, import_jsx_runtime2.jsx)(CatalogLoadingRows2, { parentSessionId: entry.id, summaries, level: level + 1, t }) : (0, import_jsx_runtime2.jsx)(CatalogRows2, { parentSessionId: entry.id, currentSessionId, catalog: childCatalog, catalogs, summaries, expanded, level: level + 1, now, openChild, refresh, toggleBranch, closeCatalog, t }) })] }, entry.id);
  })] });
}
var MENU_VIEWPORT_MARGIN2 = 16;
function catalogMenuPosition2(trigger) {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(336, window.innerWidth - MENU_VIEWPORT_MARGIN2 * 2);
  return {
    top: rect.bottom + 5,
    left: Math.min(Math.max(MENU_VIEWPORT_MARGIN2, rect.left), window.innerWidth - width - MENU_VIEWPORT_MARGIN2)
  };
}
function CatalogDropdown2({ rootSessionId, currentSessionId, displayTitle, openTitle, variant, separator = false, hideWhenZero = true, useSessions, openChild, refresh, setCatalogOpen, t }) {
  const ancestorSwitcher = variant === "switcher" && openTitle !== void 0;
  const catalogs = useSessions((state) => state.subagentsByParent);
  const summaries = useSessions((state) => state.byId);
  const catalog = catalogs[rootSessionId];
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [menuPosition, setMenuPosition] = (0, import_react2.useState)();
  const [now, setNow] = (0, import_react2.useState)(() => Date.now());
  const [expanded, setExpanded] = (0, import_react2.useState)(() => /* @__PURE__ */ new Set());
  const rootRef = (0, import_react2.useRef)(null);
  const triggerRef = (0, import_react2.useRef)(null);
  const menuRef = (0, import_react2.useRef)(null);
  const hoverOpenTimer = (0, import_react2.useRef)(void 0);
  const hoverCloseTimer = (0, import_react2.useRef)(void 0);
  const observedCatalogs = (0, import_react2.useRef)(/* @__PURE__ */ new Set());
  const requestedInitialCatalog = (0, import_react2.useRef)();
  const setCatalogOpenRef = (0, import_react2.useRef)(setCatalogOpen);
  setCatalogOpenRef.current = setCatalogOpen;
  const currentEntry = currentSessionId === void 0 ? void 0 : catalog?.entries.find((entry) => entry.kind === "child" && entry.id === currentSessionId);
  const switcherDisplayTitle = currentEntry?.kind === "child" ? currentEntry.label ?? currentEntry.id : displayTitle;
  const healthy = femoStripEntries2(catalog?.entries.filter((entry) => entry.kind === "child") ?? []);
  const descendants = (0, import_react2.useMemo)(() => indexSubagentDescendants2(femoStripSummaries2(summaries)).get(rootSessionId) ?? NO_DESCENDANTS2, [rootSessionId, summaries]);
  const descendantCount = Math.max(healthy.length, descendants.count);
  const totalCountKey = descendantCount === 1 ? "count.total.one" : "count.total.other";
  const runningCountKey = descendants.runningCount === 1 ? "count.running.one" : "count.running.other";
  const summaryBackedLoading = (descendants.count > 0 || variant === "switcher") && (catalog === void 0 || catalog.state === "ready" && catalog.entries.length === 0);
  const presentedCatalog = summaryBackedLoading ? {
    entries: [],
    parentAvailable: catalog?.parentAvailable ?? false,
    state: "loading",
    error: null
  } : catalog;
  (0, import_react2.useEffect)(() => {
    if (variant !== "switcher" || catalog !== void 0 || requestedInitialCatalog.current === rootSessionId)
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
    setExpanded(/* @__PURE__ */ new Set());
  };
  const cancelHoverClose = () => {
    if (hoverCloseTimer.current === void 0)
      return;
    clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = void 0;
  };
  const cancelHoverOpen = () => {
    if (hoverOpenTimer.current === void 0)
      return;
    clearTimeout(hoverOpenTimer.current);
    hoverOpenTimer.current = void 0;
  };
  const changeOpen = (next, restoreFocus = false) => {
    cancelHoverOpen();
    cancelHoverClose();
    if (next) {
      const trigger = triggerRef.current;
      if (trigger === null)
        return;
      setOpen(true);
      setMenuPosition(catalogMenuPosition2(trigger));
      setNow(Date.now());
      observeCatalog(rootSessionId, true);
    } else {
      setOpen(false);
      setMenuPosition(void 0);
      closeAllCatalogs();
    }
    if (restoreFocus)
      queueMicrotask(() => {
        triggerRef.current?.focus();
      });
  };
  const scheduleHoverOpen = () => {
    cancelHoverOpen();
    cancelHoverClose();
    if (open)
      return;
    hoverOpenTimer.current = setTimeout(() => {
      hoverOpenTimer.current = void 0;
      changeOpen(true);
    }, 150);
  };
  const scheduleHoverClose = () => {
    cancelHoverOpen();
    cancelHoverClose();
    hoverCloseTimer.current = setTimeout(() => {
      hoverCloseTimer.current = void 0;
      changeOpen(false);
    }, 120);
  };
  const closeBranch = (root) => {
    const closing = /* @__PURE__ */ new Set();
    const visit = (parentSessionId) => {
      if (closing.has(parentSessionId) || !expanded.has(parentSessionId))
        return;
      closing.add(parentSessionId);
      const branch = catalogs[parentSessionId];
      for (const entry of branch?.entries ?? []) {
        if (entry.kind === "child")
          visit(entry.id);
      }
    };
    visit(root);
    for (const parentSessionId of closing)
      observeCatalog(parentSessionId, false);
    setExpanded((current) => new Set([...current].filter((id) => !closing.has(id))));
  };
  const toggleBranch = (childSessionId) => {
    if (expanded.has(childSessionId)) {
      closeBranch(childSessionId);
      return;
    }
    setExpanded((current) => new Set(current).add(childSessionId));
    observeCatalog(childSessionId, true);
  };
  (0, import_react2.useEffect)(() => {
    if (!open)
      return;
    const closeOutside = (event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        changeOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);
  (0, import_react2.useEffect)(() => {
    if (!open)
      return;
    const placeMenu = () => {
      const trigger = triggerRef.current;
      if (trigger === null)
        return;
      setMenuPosition(catalogMenuPosition2(trigger));
    };
    window.addEventListener("resize", placeMenu);
    document.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      document.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);
  (0, import_react2.useEffect)(() => {
    if (!open || descendants.runningCount === 0)
      return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1e3);
    return () => {
      clearInterval(timer);
    };
  }, [open, descendants.runningCount]);
  (0, import_react2.useEffect)(() => () => {
    cancelHoverOpen();
    cancelHoverClose();
    for (const parentSessionId of observedCatalogs.current) {
      setCatalogOpenRef.current(parentSessionId, false);
    }
    observedCatalogs.current.clear();
  }, []);
  const visible = presentedCatalog !== void 0 && (variant === "switcher" || presentedCatalog.state === "error" || !hideWhenZero && presentedCatalog.entries.length > 0 || descendantCount > 0);
  (0, import_react2.useEffect)(() => {
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
    const items = treeItems2(menuRef.current);
    if (items.length === 0)
      return;
    items[(index + items.length) % items.length]?.focus();
  };
  const navigate = (event) => {
    const items = treeItems2(menuRef.current);
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      changeOpen(false, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAt(items.length - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(index < 0 ? items.length - 1 : index - 1);
    }
  };
  return (0, import_jsx_runtime2.jsxs)("div", { className: `${css2.root} ${variant === "switcher" ? css2.switcherRoot : ""}`, ref: rootRef, onKeyDown: navigate, onMouseEnter: scheduleHoverOpen, onMouseLeave: scheduleHoverClose, children: [separator && (0, import_jsx_runtime2.jsx)("span", { className: css2.separator, children: "/" }), (0, import_jsx_runtime2.jsxs)("button", { ref: triggerRef, type: "button", className: variant === "switcher" ? `${css2.switcherTrigger} ${ancestorSwitcher ? css2.ancestorSwitcherTrigger : ""}` : css2.trigger, "aria-haspopup": "tree", "aria-expanded": open, "aria-label": variant === "switcher" ? t("switcher.aria", { title: switcherDisplayTitle }) : t(descendants.runningCount > 0 ? runningCountKey : totalCountKey, { count: descendants.runningCount > 0 ? descendants.runningCount : descendantCount }), onClick: openTitle === void 0 ? void 0 : () => {
    cancelHoverOpen();
    if (open)
      changeOpen(false);
    openTitle();
  }, onKeyDown: (event) => {
    if (event.key !== "ArrowDown")
      return;
    event.preventDefault();
    if (!open)
      changeOpen(true);
    queueMicrotask(() => {
      focusAt(0);
    });
  }, children: [variant === "switcher" ? (0, import_jsx_runtime2.jsx)("span", { className: css2.switcherTitle, children: switcherDisplayTitle }) : (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [descendants.runningCount > 0 && (0, import_jsx_runtime2.jsx)("span", { className: css2.activitySlot, children: (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: "ongoing" }) }), (0, import_jsx_runtime2.jsx)("span", { className: css2.count, children: t(totalCountKey, { count: descendantCount }) })] }), variant === "switcher" ? (0, import_jsx_runtime2.jsx)(SubagentSwitcherIcon2, {}) : (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconChevronDownOutline14, { className: open ? css2.triggerOpen : void 0 })] }), open && (0, import_react_dom2.createPortal)((0, import_jsx_runtime2.jsx)("div", { ref: menuRef, className: css2.menu, style: menuPosition, role: "tree", "aria-label": t("tree.aria"), onMouseEnter: cancelHoverClose, onMouseLeave: scheduleHoverClose, children: (0, import_jsx_runtime2.jsx)(CatalogRows2, { parentSessionId: rootSessionId, currentSessionId, catalog: presentedCatalog, catalogs, summaries, expanded, level: 1, now, openChild, refresh, toggleBranch, closeCatalog: () => {
    changeOpen(false);
  }, t }) }), document.body)] });
}
function SubagentHeaderLineage2({ lineageSessionId, displayTitle, openTitle, useSessions, openChild, refresh, setCatalogOpen, t }) {
  const summary = useSessions((state) => state.byId[lineageSessionId]);
  const parentId = summary?.origin === "subagent" ? summary.parentId : void 0;
  if (typeof lineageSessionId === "string" && lineageSessionId.startsWith("femo-proj-")) {
    return null;
  }
  const shared = { useSessions, openChild, refresh, setCatalogOpen, t };
  if (parentId === void 0) {
    return (0, import_jsx_runtime2.jsx)(CatalogDropdown2, { rootSessionId: lineageSessionId, variant: "count", separator: true, ...shared }, lineageSessionId);
  }
  return (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [(0, import_jsx_runtime2.jsx)(CatalogDropdown2, { rootSessionId: parentId, currentSessionId: lineageSessionId, variant: "switcher", displayTitle, ...openTitle === void 0 ? {} : { openTitle }, ...shared }, lineageSessionId), openTitle === void 0 && (0, import_jsx_runtime2.jsx)(CatalogDropdown2, { rootSessionId: lineageSessionId, variant: "count", ...shared }, lineageSessionId)] });
}

// client/client-ui/styles.ts
var FEMO_STREAM_CSS = `
.femo-stream-root{display:flex;flex-direction:column;margin:2px 0 10px}
.femo-stream-toolline{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 0}
/* \u2500\u2500 \u5B98\u65B9\u5DE5\u5177\u884C\uFF082026-08-30 V6.1\uFF09\uFF1Aui-tool ToolRow.module.css \u9010\u5C5E\u6027\u8F6C\u5199
   \uFF08femo-toolrow-* \u524D\u7F00\uFF09\u3002\u9AA8\u67B6\u4EF6 DisclosureRow/StateDot/\u56FE\u6807\u662F primitives
   \u771F\u4EF6\uFF08external\u2192shell \u540C\u5B9E\u4F8B\uFF0C\u81EA\u5E26\u6837\u5F0F\uFF09\uFF0C\u6B64\u5904\u53EA\u8865\u884C\u7EA7\u51E0\u4F55\u4E0E\u72B6\u6001\u6837\u5F0F\u3002
   \u5168 --dsw token \u96F6\u5199\u6B7B\u8272\u503C \u2192 \u6DF1\u6D45\u8272/\u7B2C\u4E09\u65B9\u4E3B\u9898\u81EA\u52A8\u8DDF\u968F\u3002 */
.femo-toolrow{display:flex;flex-direction:column}
.femo-toolrow-row{position:relative;overflow:hidden}
.femo-toolrow[data-state='running'] .femo-toolrow-row::after{content:'';position:absolute;top:0;bottom:0;left:0;width:300px;background:linear-gradient(90deg,transparent 0%,color-mix(in srgb,var(--dsw-alias-bg-base) 60%,transparent) 55%,transparent 100%);animation:femo-tool-row-sweep 2.6s ease-out infinite;pointer-events:none}
@keyframes femo-tool-row-sweep{0%{left:-300px}90%,100%{left:100%}}
.femo-toolrow-leading{flex-shrink:0}
.femo-toolrow-chevron{color:var(--dsw-alias-label-secondary)}
.femo-toolrow-title{font-weight:400}
.femo-toolrow-sep{flex:none;width:2px;height:2px;border-radius:1px;margin:0 8px;background:var(--dsw-alias-label-caption)}
.femo-toolrow-summary{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:24px;color:var(--dsw-alias-label-tertiary)}
.femo-toolrow-bodywrap{display:flex;flex-direction:column}
.femo-toolrow-iocard{display:flex;flex-direction:column;margin:4px 0 4px 4px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small)}
.femo-toolrow-iosection{display:grid;grid-template-columns:max-content 1fr;column-gap:14px;align-items:baseline;padding:12px 16px;max-height:150px;overflow-y:auto}
.femo-toolrow-iosection::-webkit-scrollbar-thumb{border:2px solid transparent;background-clip:padding-box;border-radius:6px}
.femo-toolrow-iosection::-webkit-scrollbar-track{margin:6px 0}
.femo-toolrow-iolabel{position:sticky;top:0;align-self:start;color:var(--dsw-alias-label-caption)}
.femo-toolrow-iodivider{flex:none;height:1px;background:var(--dsw-alias-border-l2)}
.femo-toolrow-iotext{min-width:0;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary)}
.femo-toolrow-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* 2026-08-26 \u62C6\u9664\u81EA\u7ED8\u95EA\u70C1\u5149\u6807\uFF08.femo-stream-caret/femo-caret-blink\uFF09\uFF1A\u5B98\u65B9\u6D41\u5F0F
   \u8F93\u51FA\u65E0 caret \u88C5\u9970\uFF0CDeep diving \u72B6\u6001\u884C\u5DF2\u627F\u62C5"\u8FDB\u884C\u4E2D"\u4FE1\u53F7\uFF08\u732B\u732B\u88C1\u5B9A\uFF09\u3002 */
/* \u5B98\u65B9 ChatView TurnStatus \u540C\u6B3E\u8F6C\u5199\uFF082026-08-26\uFF09\uFF1A\u54C1\u724C\u84DD\u6D41\u5149 "Deep diving..."
   \uFF08rc.2 ChatView.module.css .turnStatus/.turnStatusClock \u9010\u5C5E\u6027\u91CD\u653E\uFF0C\u7C7B\u540D\u6362
   femo- \u524D\u7F00\u2014\u2014\u6784\u5EFA\u94FE\u4E0D\u6CE8\u5165\u63D2\u4EF6\u4FA7 css module\uFF0C\u6CBF\u7528 style \u5143\u7D20\u8DEF\u7EBF\uFF09\u3002 */
.femo-turn-status{align-self:flex-start;flex:none;display:inline-flex;align-items:center;height:26px;font:var(--dsw-font-s-strong-14);white-space:nowrap;background:linear-gradient(90deg,var(--dsw-static-deepseek-500) 0%,var(--dsw-static-deepseek-500) 40%,var(--dsw-static-deepseek-200) 50%,var(--dsw-static-deepseek-500) 60%,var(--dsw-static-deepseek-500) 100%);background-position:100% 0;background-size:250% 100%;background-clip:text;color:transparent;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:femo-turn-status-shimmer 1.8s linear infinite}
.femo-turn-status-clock{margin-left:8px;font:var(--dsw-font-xs-13);font-weight:400;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-caption);-webkit-text-fill-color:var(--dsw-alias-label-caption)}
@keyframes femo-turn-status-shimmer{to{background-position:0 0}}
@media (prefers-reduced-motion:reduce){.femo-turn-status{background-position:0 0;background-size:100% 100%;animation:none}}
.femo-rr-root{display:flex;flex-direction:column}
.femo-rr-row{position:relative;overflow:hidden}
.femo-rr-root[data-state='running'] .femo-rr-row::after{content:'';position:absolute;inset-block:0;left:0;width:300px;background:linear-gradient(90deg,transparent 0%,color-mix(in srgb,var(--dsw-alias-bg-base,#fff) 60%,transparent) 55%,transparent 100%);animation:femo-rr-sweep 2.6s ease-out infinite;pointer-events:none}
@keyframes femo-rr-sweep{0%{left:-300px}90%,100%{left:100%}}
.femo-rr-leading{flex-shrink:0}
.femo-rr-chevron{color:var(--dsw-alias-label-secondary)}
.femo-rr-title{font-weight:400}
.femo-rr-separator{flex:none;width:2px;height:2px;margin:0 8px;border-radius:1px;background:var(--dsw-alias-label-caption)}
.femo-rr-summary{min-width:0;overflow:hidden;flex:1 1 auto;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:24px;text-overflow:ellipsis;white-space:nowrap}
.femo-rr-summary[data-follow-end]{text-overflow:clip}
.femo-rr-think-body{padding:4px 0 4px 22px;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:24px;white-space:pre-wrap;word-break:break-word}
.femo-a11y-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.femo-rr-root[data-state='running'] .femo-rr-row::after{animation:none}}
`;
var FEMO_COMPOSER_CSS = `
.femo-comp-root{display:flex;flex-direction:column;align-items:center;padding:0 var(--dsh-composer-side-clearance,16px) 8px}
.femo-comp-notice{width:100%;max-width:var(--dsh-composer-card-max-width,780px);margin-bottom:6px;padding:4px 8px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.femo-comp-card{box-sizing:border-box;position:relative;display:flex;flex-direction:column;gap:12px;width:100%;max-width:var(--dsh-composer-card-max-width,780px);padding-top:10px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:22px;background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);font-family:var(--dsw-font-family);font-size:16px;line-height:24px;color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.femo-comp-scroll{max-height:var(--dsh-composer-text-max-height,336px);overflow-y:auto}
.femo-comp-grow{position:relative}
/* \u5B98\u65B9 mirror \u81EA\u589E\u9AD8\u6280\u672F\uFF08\u65E0 backdrop \u5C42\uFF09\uFF1Amirror \u6D41\u5185\u5B9A\u9AD8\u3001textarea \u7EDD\u5BF9
   \u8986\u76D6\uFF1B\u4E24\u5C42\u5171\u4EAB\u540C\u4E00\u5957\u5EA6\u91CF\u4E0E\u6362\u884C\u89C4\u5219\uFF0C\u9AD8\u5EA6\u624D\u4E0D\u4F1A\u5206\u53C9\u3002 */
.femo-comp-mirror,.femo-comp-input{box-sizing:border-box;padding:4px 12px 0 16px;font-family:inherit;font-size:inherit;line-height:inherit;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.femo-comp-mirror{visibility:hidden;pointer-events:none}
.femo-comp-input{position:absolute;inset:0;width:100%;height:100%;display:block;border:none;outline:none;resize:none;overflow:hidden;background:transparent;color:var(--dsw-alias-label-primary);caret-color:var(--dsw-alias-state-business-primary)}
.femo-comp-input[readonly]{color:var(--dsw-alias-label-tertiary)}
.femo-comp-input::placeholder{color:var(--dsw-alias-label-caption);-webkit-text-fill-color:var(--dsw-alias-label-caption);user-select:none}
/* \u5DE5\u5177\u884C\uFF1A\u5B98\u65B9 .row \u540C\u6B3E\uFF08\u5DE6\u7EC4\u9884\u7559\u7A7A\u3001\u53F3\u7EC4\u53D1\u9001\u94AE\uFF09\uFF1B2px \u9876\u79FB\u8865\u507F\u540C\u5B98\u65B9\u3002 */
.femo-comp-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:2px 8px 6px;min-width:0}
.femo-comp-trailing{display:flex;align-items:center;min-width:0;margin-left:auto;gap:12px}
.femo-comp-primary{display:grid;place-items:center;flex:none;width:34px;height:34px;border:none;border-radius:999px;background:var(--dsw-alias-button-info-fill,#3964FE);color:#fff;cursor:pointer;transition:background-color 100ms ease;transform:translateY(-2px)}
.femo-comp-primary:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}
.femo-comp-primary:disabled{opacity:.4;cursor:default}
/* \u7A7A\u5EA7\u4F4D\u5E7D\u7075 gap \u53CD\u5236\uFF082026-08-26\uFF09\uFF1A\u5B98\u65B9 ChatView \u7528 .flowItem:empty \u515C\u5E95
   "decline \u7684\u5EA7\u4F4D\u4E0D\u5403\u5217 gap"\uFF0C\u4F46 SlotOutlet \u6052\u8F93\u51FA <div data-slot
   style="display:contents"> \u5305\u88C5\uFF08ui-renderer \u951A\u70B9\u5951\u7EA6\uFF09\u2014\u2014decline \u7EC4\u4EF6\u7684
   \u5EA7\u4F4D\u6C38\u8FDC\u6709\u5B50\u8282\u70B9\uFF08data-slot div\uFF09\uFF0C:empty \u4E0E :has(*) \u90FD\u4E0D\u547D\u4E2D\uFF0C\u96F6\u9AD8\u5EA7\u4F4D
   \u7167\u5403 column \u7684 16px gap\u3002femo \u951A\u70B9\u5BC6\u5EA6\u9AD8\uFF08user/message+step/start \u6BCF\u6B65
   \u53CC\u951A\u70B9\uFF09\uFF0C\u5DE5\u5177\u5E8F\u5217\u4E2D\u95F4\u53E0\u51FA N\xD716px \u5E7D\u7075\u95F4\u8DDD\u3002\u6B63\u786E\u9009\u62E9\u5668=\u68C0\u67E5 data-slot
   wrapper \u5185\u90E8\u662F\u5426\u771F\u7A7A\uFF08:not(:has([data-slot] *))\uFF09\uFF1B\u5B98\u65B9 turn-tail \u540C\u75C5
   \u987A\u624B\u4E00\u5E76\u53CD\u5236\uFF08\u4E0D\u52A8\u672C\u4F53\u6587\u4EF6\uFF09\u3002 */
[data-chat-flow-kind='femo-director']:not(:has([data-slot] *)){display:none}
[data-chat-flow-kind='femo-role']:not(:has([data-slot] *)){display:none}
[data-chat-flow-kind='turn-tail']:not(:has([data-slot] *)){display:none}
/* \u6743\u9650\u83DC\u5355 trigger\uFF1A\u5B98\u65B9 PermissionSelect.module.css .trigger \u5BB6\u65CF\u9010\u5C5E\u6027\u8F6C\u5199
   \uFF08femo-comp-perm-*\uFF09\uFF1B\u83DC\u5355\u4F53\u4E0E\u98CE\u9669\u786E\u8BA4\u5F39\u7A97\u7528 ui-primitives \u7684 Menu /
   RiskConfirmation \u5B98\u65B9\u7EC4\u4EF6\uFF0C\u65E0\u9700\u81EA\u7ED8\u3002 */
.femo-comp-perm-trigger{display:inline-flex;align-items:center;gap:4px;min-width:0;max-width:220px;height:28px;padding:0 4px 0 8px;border:none;border-radius:24px;outline:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;font-weight:500;font-family:inherit;cursor:pointer}
.femo-comp-perm-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.femo-comp-perm-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.femo-comp-perm-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.femo-comp-perm-icon{display:inline-flex;flex:0 0 auto}
.femo-comp-perm-icon svg{width:14px;height:14px}
.femo-comp-perm-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.femo-comp-perm-chevron{display:inline-flex;flex:0 0 auto;color:var(--dsw-alias-label-caption);transition:transform 120ms ease}
.femo-comp-perm-chevron[data-open='true']{transform:rotate(180deg)}
/* \u7EDF\u8BA1\u884C\uFF1A\u5B98\u65B9 StatsLine.module.css \u9010\u5C5E\u6027\u8F6C\u5199\uFF08femo-comp-stats-*\uFF09\uFF0C
   \u5BF9\u9F50\u5171\u4EAB\u6D88\u606F\u5217\u8F74\uFF08--dsh-chat-content-width\uFF09\u3002 */
.femo-comp-stats{display:block;text-align:center;max-width:var(--dsh-chat-content-width,748px);width:100%;margin:0 auto;box-sizing:border-box;padding:4px calc(var(--dsh-composer-side-clearance,16px) + 16px) 0;font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.femo-comp-stats-sep{color:var(--dsw-alias-separator-primary);margin:0 10px}
/* \u4E0A\u4E0B\u6587\u5360\u7528\u5706\u73AF\uFF1A\u5B98\u65B9 ContextMeter.module.css \u9010\u5C5E\u6027\u8F6C\u5199\uFF08femo-comp-meter-*\uFF0C
 * tint \u53D8\u91CF\u6362 femo \u524D\u7F00\u9632\u649E\u540D\uFF09\u3002\u4E0A\u5E1D\u7A97=\u4E3B\u4F1A\u8BDD contextPressure \u6570\u636E\uFF1B\u89D2\u8272\u7A97
 * \u590D\u7528\u540C\u6B3E\u89C6\u89C9\u6362 actor-usage \u6570\u636E\u6E90\u3002\u9762\u677F=menu surface\uFF08r12/\u53CD\u8272\u7EC6\u8FB9/lv3 \u9634\u5F71\uFF09\u3002 */
.femo-comp-meter{position:relative;display:inline-flex}
.femo-comp-meter-trigger{display:grid;place-items:center;flex:none;width:28px;height:28px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.femo-comp-meter-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.femo-comp-meter-track{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:2}
.femo-comp-meter-fill{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:2;stroke-linecap:round}
.femo-comp-meter-panel{position:absolute;bottom:calc(100% + 8px);right:0;z-index:100;box-sizing:border-box;width:264px;padding:12px;border:1px solid var(--dsw-alias-border-inverted);border-radius:12px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:default}
.femo-comp-meter-header{display:flex;align-items:center;gap:6px}
.femo-comp-meter-figures{margin-left:auto;font-weight:500;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.femo-comp-meter-percent{font-weight:500;color:var(--dsw-alias-label-primary)}
.femo-comp-meter-headline{color:var(--dsw-alias-label-tertiary)}
.femo-comp-meter-bar{display:flex;gap:1px;margin:10px 0 12px;height:4px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}
.femo-comp-meter-segment{flex:none;min-width:2px;height:100%;border-radius:1px;background:var(--femo-meter-tint,var(--dsw-alias-label-tertiary))}
.femo-comp-meter-swatch{display:inline-block;margin-right:6px;width:8px;height:8px;border-radius:2px;background:var(--femo-meter-tint);vertical-align:baseline}
.femo-comp-meter-tint-system{--femo-meter-tint:var(--dsw-static-neutral-bluish-400)}
.femo-comp-meter-tint-tools{--femo-meter-tint:rgb(167,139,250)}
.femo-comp-meter-tint-messages{--femo-meter-tint:var(--dsw-static-blue-450)}
.femo-comp-meter-rows{margin:6px 0 0}
.femo-comp-meter-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 0}
.femo-comp-meter-row dt{color:var(--dsw-alias-label-secondary)}
.femo-comp-meter-row dd{margin:0;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
`;
function ensureFemoStreamStyles() {
  if (document.getElementById("femo-stream-style") !== null) return;
  const el = document.createElement("style");
  el.id = "femo-stream-style";
  el.textContent = FEMO_STREAM_CSS + FEMO_COMPOSER_CSS;
  document.head.appendChild(el);
}

// client/client-ui/view-state.ts
var import_react3 = require("react");
var viewBySession = /* @__PURE__ */ new Map();
var viewListeners = /* @__PURE__ */ new Map();
function currentView(sessionId) {
  if (sessionId === void 0) return "god";
  const stored = viewBySession.get(sessionId);
  if (stored !== void 0) return stored;
  return sessionId.startsWith("femo-proj-") ? "god" : "offstage";
}
function getView(sessionId) {
  return viewBySession.get(sessionId);
}
function setView(sessionId, view) {
  viewBySession.set(sessionId, view);
  const listeners3 = viewListeners.get(sessionId);
  if (listeners3 === void 0) return;
  for (const listener of listeners3) listener();
}
function subscribeView(sessionId, listener) {
  if (sessionId === void 0) return () => {
  };
  let listeners3 = viewListeners.get(sessionId);
  if (listeners3 === void 0) {
    listeners3 = /* @__PURE__ */ new Set();
    viewListeners.set(sessionId, listeners3);
  }
  listeners3.add(listener);
  return () => {
    listeners3.delete(listener);
    if (listeners3.size === 0) viewListeners.delete(sessionId);
  };
}
function useView(sessionId) {
  const [view, setLocal] = (0, import_react3.useState)(currentView(sessionId));
  (0, import_react3.useEffect)(() => {
    if (sessionId === void 0) return;
    setLocal(currentView(sessionId));
    return subscribeView(sessionId, () => setLocal(currentView(sessionId)));
  }, [sessionId]);
  return view;
}

// client/fa-icons.tsx
var import_react4 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function FemoLogo({ size = 14, className, style }) {
  const rawId = (0, import_react4.useId)().replace(/[^a-zA-Z0-9_-]/g, "");
  const maskId = `femo-cut-${rawId}`;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "27.169998168945312 30 345.6600341796875 364",
      width: size,
      height: size,
      className,
      style,
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("mask", { id: maskId, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("rect", { x: "0", y: "0", width: "400", height: "480", fill: "#ffffff" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M 187.5 200 L 212.5 200 L 262.5 359 L 200 384 L 137.5 359 Z", fill: "none", stroke: "#000000", strokeWidth: "16", strokeLinejoin: "round", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "200", cy: "200", r: "15", fill: "#000000" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "35", y1: "100", x2: "200", y2: "75", stroke: "#000000", strokeWidth: "16", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "200", y1: "75", x2: "365", y2: "100", stroke: "#000000", strokeWidth: "16", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "30.92", y1: "107.11", x2: "91.75", y2: "262.5", stroke: "#000000", strokeWidth: "16", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "369.08", y1: "107.11", x2: "308.25", y2: "262.5", stroke: "#000000", strokeWidth: "16", strokeLinecap: "round" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("g", { mask: `url(#${maskId})`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("polygon", { points: "200,40 338.56,120 338.56,280 200,360 61.44,280 61.44,120", fill: "none", stroke: "#6FBF3A", strokeWidth: "32", strokeLinejoin: "round", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "200", y1: "200", x2: "61.44", y2: "120", stroke: "#6FBF3A", strokeWidth: "32", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "200", y1: "200", x2: "338.56", y2: "120", stroke: "#6FBF3A", strokeWidth: "32", strokeLinecap: "round" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M 187.5 200 L 212.5 200 L 262.5 359 L 200 384 L 137.5 359 Z", fill: "#6FBF3A" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M 75.78 197.79 L 37.17 105.58 L 135.99 93.53 L 68.63 132.43 L 75.78 120 Z", fill: "#6FBF3A" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M 324.22 197.79 L 362.83 105.58 L 264.01 93.53 L 331.37 132.43 L 324.22 120 Z", fill: "#6FBF3A" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "200", cy: "200", r: "30", fill: "none", stroke: "#6FBF3A", strokeWidth: "32" })
      ]
    }
  );
}
function make(viewBox, d) {
  return function FaIcon({ size = 14, className, style }) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox,
        width: size,
        height: size,
        className,
        style,
        "aria-hidden": "true",
        fill: "currentColor",
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d })
      }
    );
  };
}
var FaEye = make("0 0 576 512", "M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z");
var FaRobot = make("0 0 640 512", "M320 0c17.7 0 32 14.3 32 32V96H472c39.8 0 72 32.2 72 72V440c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V168c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224H64V416H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H576V224h16z");
var FaUserSecret = make("0 0 448 512", "M224 16c-6.7 0-10.8-2.8-15.5-6.1C201.9 5.4 194 0 176 0c-30.5 0-52 43.7-66 89.4C62.7 98.1 32 112.2 32 128c0 14.3 25 27.1 64.6 35.9c-.4 4-.6 8-.6 12.1c0 17 3.3 33.2 9.3 48H45.4C38 224 32 230 32 237.4c0 1.7 .3 3.4 1 5l38.8 96.9C28.2 371.8 0 423.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7c0-58.5-28.2-110.4-71.7-143L415 242.4c.6-1.6 1-3.3 1-5c0-7.4-6-13.4-13.4-13.4H342.7c6-14.8 9.3-31 9.3-48c0-4.1-.2-8.1-.6-12.1C391 155.1 416 142.3 416 128c0-15.8-30.7-29.9-78-38.6C324 43.7 302.5 0 272 0c-18 0-25.9 5.4-32.5 9.9c-4.8 3.3-8.8 6.1-15.5 6.1zm56 208H267.6c-16.5 0-31.1-10.6-36.3-26.2c-2.3-7-12.2-7-14.5 0c-5.2 15.6-19.9 26.2-36.3 26.2H168c-22.1 0-40-17.9-40-40V169.6c28.2 4.1 61 6.4 96 6.4s67.8-2.3 96-6.4V184c0 22.1-17.9 40-40 40zm-88 96l16 32L176 480 128 288l64 32zm128-32L272 480 240 352l16-32 64-32z");
var FaPodcast = make("0 0 448 512", "M319.4 372c48.5-31.3 80.6-85.9 80.6-148c0-97.2-78.8-176-176-176S48 126.8 48 224c0 62.1 32.1 116.6 80.6 148c1.2 17.3 4 38 7.2 57.1l.2 1C56 395.8 0 316.5 0 224C0 100.3 100.3 0 224 0S448 100.3 448 224c0 92.5-56 171.9-136 206.1l.2-1.1c3.1-19.2 6-39.8 7.2-57zm-2.3-38.1c-1.6-5.7-3.9-11.1-7-16.2c-5.8-9.7-13.5-17-21.9-22.4c19.5-17.6 31.8-43 31.8-71.3c0-53-43-96-96-96s-96 43-96 96c0 28.3 12.3 53.8 31.8 71.3c-8.4 5.4-16.1 12.7-21.9 22.4c-3.1 5.1-5.4 10.5-7 16.2C99.8 307.5 80 268 80 224c0-79.5 64.5-144 144-144s144 64.5 144 144c0 44-19.8 83.5-50.9 109.9zM224 312c32.9 0 64 8.6 64 43.8c0 33-12.9 104.1-20.6 132.9c-5.1 19-24.5 23.4-43.4 23.4s-38.2-4.4-43.4-23.4c-7.8-28.5-20.6-99.7-20.6-132.8c0-35.1 31.1-43.8 64-43.8zm0-144a56 56 0 1 1 0 112 56 56 0 1 1 0-112z");
var FaClapperboard = make("0 0 512 512", "M448 32l-86.1 0-1 1-127 127 92.1 0 1-1L453.8 32.3c-1.9-.2-3.8-.3-5.8-.3zm64 128l0-64c0-15.1-5.3-29.1-14-40l-104 104L512 160zM294.1 32l-92.1 0-1 1L73.9 160l92.1 0 1-1 127-127zM64 32C28.7 32 0 60.7 0 96l0 64 6.1 0 1-1 127-127L64 32zM512 192L0 192 0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-224z");
var FaCircleCheck = make("0 0 512 512", "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z");
var FaCircleStop = make("0 0 512 512", "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM192 160H320c17.7 0 32 14.3 32 32V320c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V192c0-17.7 14.3-32 32-32z");
var FaCircleXmark = make("0 0 512 512", "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z");
var FaCirclePlay = make("0 0 512 512", "M0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zM188.3 147.1c-7.6 4.2-12.3 12.3-12.3 20.9V344c0 8.7 4.7 16.7 12.3 20.9s16.8 4.1 24.3-.5l144-88c7.1-4.4 11.5-12.1 11.5-20.5s-4.4-16.1-11.5-20.5l-144-88c-7.4-4.5-16.7-4.7-24.3-.5z");
var FaTriangleExclamation = make("0 0 512 512", "M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z");
var FaMasksTheater = make("0 0 640 512", "M74.6 373.2c41.7 36.1 108 82.5 166.1 73.7c6.1-.9 12.1-2.5 18-4.5c-9.2-12.3-17.3-24.4-24.2-35.4c-21.9-35-28.8-75.2-25.9-113.6c-20.6 4.1-39.2 13-54.7 25.4c-6.5 5.2-16.3 1.3-14.8-7c6.4-33.5 33-60.9 68.2-66.3c2.6-.4 5.3-.7 7.9-.8l19.4-131.3c2-13.8 8-32.7 25-45.9C278.2 53.2 310.5 37 363.2 32.2c-.8-.7-1.6-1.4-2.4-2.1C340.6 14.5 288.4-11.5 175.7 5.6S20.5 63 5.7 83.9C0 91.9-.8 102 .6 111.8L24.8 276.1c5.5 37.3 21.5 72.6 49.8 97.2zm87.7-219.6c4.4-3.1 10.8-2 11.8 3.3c.1 .5 .2 1.1 .3 1.6c3.2 21.8-11.6 42-33.1 45.3s-41.5-11.8-44.7-33.5c-.1-.5-.1-1.1-.2-1.6c-.6-5.4 5.2-8.4 10.3-6.7c9 3 18.8 3.9 28.7 2.4s19.1-5.3 26.8-10.8zM261.6 390c29.4 46.9 79.5 110.9 137.6 119.7s124.5-37.5 166.1-73.7c28.3-24.5 44.3-59.8 49.8-97.2l24.2-164.3c1.4-9.8 .6-19.9-5.1-27.9c-14.8-20.9-57.3-61.2-170-78.3S299.4 77.2 279.2 92.8c-7.8 6-11.5 15.4-12.9 25.2L242.1 282.3c-5.5 37.3-.4 75.8 19.6 107.7zM404.5 235.3c-7.7-5.5-16.8-9.3-26.8-10.8s-19.8-.6-28.7 2.4c-5.1 1.7-10.9-1.3-10.3-6.7c.1-.5 .1-1.1 .2-1.6c3.2-21.8 23.2-36.8 44.7-33.5s36.3 23.5 33.1 45.3c-.1 .5-.2 1.1-.3 1.6c-1 5.3-7.4 6.4-11.8 3.3zm136.2 15.5c-1 5.3-7.4 6.4-11.8 3.3c-7.7-5.5-16.8-9.3-26.8-10.8s-19.8-.6-28.7 2.4c-5.1 1.7-10.9-1.3-10.3-6.7c.1-.5 .1-1.1 .2-1.6c3.2-21.8 23.2-36.8 44.7-33.5s36.3 23.5 33.1 45.3c-.1 .5-.2 1.1-.3 1.6zM530 350.2c-19.6 44.7-66.8 72.5-116.8 64.9s-87.1-48.2-93-96.7c-1-8.3 8.9-12.1 15.2-6.7c23.9 20.8 53.6 35.3 87 40.3s66.1 .1 94.9-12.8c7.6-3.4 16 3.2 12.6 10.9z");
var FaBullhorn = make("0 0 512 512", "M480 32c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9L381.7 53c-48 48-113.1 75-181 75H192 160 64c-35.3 0-64 28.7-64 64v96c0 35.3 28.7 64 64 64l0 128c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32V352l8.7 0c67.9 0 133 27 181 75l43.6 43.6c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6V300.4c18.6-8.8 32-32.5 32-60.4s-13.4-51.6-32-60.4V32zm-64 76.7V240 371.3C357.2 317.8 280.5 288 200.7 288H192V192h8.7c79.8 0 156.5-29.8 215.3-83.3z");
var FaWrench = make("0 0 512 512", "M352 320c88.4 0 160-71.6 160-160c0-15.3-2.2-30.1-6.2-44.2c-3.1-10.8-16.4-13.2-24.3-5.3l-76.8 76.8c-3 3-7.1 4.7-11.3 4.7H336c-8.8 0-16-7.2-16-16V118.6c0-4.2 1.7-8.3 4.7-11.3l76.8-76.8c7.9-7.9 5.4-21.2-5.3-24.3C382.1 2.2 367.3 0 352 0C263.6 0 192 71.6 192 160c0 19.1 3.4 37.5 9.5 54.5L19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9L297.5 310.5c17 6.2 35.4 9.5 54.5 9.5zM80 408a24 24 0 1 1 0 48 24 24 0 1 1 0-48z");

// client/client-ui/chat-node.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function actorColor(actor) {
  let hash = 0;
  for (let i = 0; i < actor.length; i++) {
    hash = hash * 31 + actor.charCodeAt(i) >>> 0;
  }
  return `hsl(${hash % 360} 65% 45%)`;
}
var HUMAN_ROLE_ACTOR = "\u4EBA\u7C7B";
var LEADING_ICON_MAP = {
  "\u{1F3AD}": FemoLogo,
  "\u2705": FaCircleCheck,
  "\u23F9": FaCircleStop,
  "\u23F9\uFE0F": FaCircleStop,
  "\u274C": FaCircleXmark,
  "\u{1F3AC}": FaClapperboard,
  "\u25B6": FaCirclePlay,
  "\u25B6\uFE0F": FaCirclePlay,
  "\u26A0": FaTriangleExclamation,
  "\u26A0\uFE0F": FaTriangleExclamation,
  "\u{1F4E2}": FaBullhorn,
  "\u{1F527}": FaWrench
};
function matchLeadingIcon(text) {
  if (text.length === 0) return null;
  const first = String.fromCodePoint(text.codePointAt(0));
  let head = first;
  if (text.charCodeAt(first.length) === 65039) head += "\uFE0F";
  const Icon = LEADING_ICON_MAP[head];
  if (Icon === void 0) return null;
  return { Icon, rest: text.slice(head.length).replace(/^ /, "") };
}
function LeadingIconText({ text, iconSize = 12 }) {
  const leading = matchLeadingIcon(text);
  if (leading === null) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: text });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(leading.Icon, { size: iconSize, style: { marginRight: 5, verticalAlign: "-1px" } }),
    leading.rest
  ] });
}
var femoChatDefinition = {
  kind: "femo-role",
  target: "chat",
  match: (event) => {
    if (event.type === "femo-plugin/chat" || event.type === "femo-plugin/chat") {
      const d = event.data;
      if (d.kind === "speaker" && typeof event.data.turn === "number") return null;
      if (d.kind === "prompt" && typeof event.data.turn === "number") return null;
      if (d.kind === "error" && typeof event.data.turn === "number") return null;
      if (d.kind === "live") return null;
      return { id: String(event.seq), role: "start" };
    }
    return null;
  },
  start: (_context, match) => {
    if (match.event.type !== "femo-plugin/chat") {
      throw new Error("femo-role start requires femo-plugin/chat");
    }
    const d = match.event.data;
    const turnOf3 = typeof d.turn === "number" ? d.turn : void 0;
    return {
      ...d.actor === void 0 ? {} : { actor: d.actor },
      text: d.text,
      kind: d.kind,
      ...d.visible === void 0 ? {} : { visible: d.visible },
      ...turnOf3 !== void 0 ? { turn: turnOf3 } : {},
      seq: match.event.seq
    };
  },
  update: (context) => context.state,
  buildViewNode: (context) => {
    if (context.state === void 0) return null;
    return {
      key: context.key,
      kind: "femo-role",
      id: context.id,
      target: "chat",
      anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0,
      location: { kind: "unresolved" },
      visibility: "visible",
      data: context.state
    };
  }
};
function FemoChatNodeView({ node, useSession, t }) {
  const { actor, text, kind, visible } = node.data;
  const sessionId = useSession((snapshot) => snapshot.sessionId);
  const view = useView(sessionId);
  if (kind === "stream-host") return null;
  if (view === "offstage") {
    if (kind !== "sys") return null;
  } else if (view !== "god") {
    if (kind === "notice" || kind === "error" || kind === "thinking" || kind === "tool_call") return null;
    if (kind !== "speaker" && visible !== void 0 && !visible.includes(view)) return null;
  }
  if (kind === "speaker") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      margin: "8px 0 2px",
      fontWeight: 700,
      fontSize: "12.5px",
      color: actorColor(actor ?? "AI")
    }, children: actor ?? "AI" }) });
  }
  if (kind === "tool_call") {
    let tool = null;
    try {
      tool = JSON.parse(text);
    } catch {
      tool = null;
    }
    const name = tool?.name ?? "\u5DE5\u5177\u8C03\u7528";
    const body = tool?.kind === "result" ? tool?.result ?? "" : tool?.args ?? "";
    const MAX_BODY = 400;
    const clipped = body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}
\u2026\uFF08\u622A\u65AD\uFF0C\u5171 ${body.length} \u5B57\u7B26\uFF09` : body;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      margin: "2px 0",
      fontSize: "11px",
      fontFamily: "JetBrains Mono, monospace",
      color: "var(--dsw-alias-label-tertiary, #999)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      lineHeight: 1.5
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LeadingIconText, { iconSize: 11, text: tool?.kind === "result" ? `\u{1F527} ${name} \u7ED3\u679C\uFF1A${clipped}` : `\u{1F527} ${name} \u8C03\u7528\uFF1A${clipped}` }) });
  }
  if (kind === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      textAlign: "left",
      color: "var(--dsw-alias-state-error-primary, #e5484d)",
      fontSize: "12px",
      padding: "4px 0",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LeadingIconText, { text }) });
  }
  if (kind === "notice" || kind === "sys") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      textAlign: "center",
      color: "var(--dsw-alias-label-tertiary, #999)",
      fontSize: "12px",
      padding: "6px 0"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LeadingIconText, { text }) });
  }
  if (kind === "prompt") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      margin: "6px 0",
      padding: "6px 12px",
      borderRadius: "6px",
      borderLeft: "3px solid var(--dsw-alias-button-info-fill, #4a9eff)",
      background: "color-mix(in srgb, var(--dsw-alias-button-info-fill, #4a9eff) 6%, transparent)",
      color: "var(--dsw-alias-label-secondary, #666)",
      fontSize: "12px",
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LeadingIconText, { text }) });
  }
  if (kind === "human_wait") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      margin: "6px 0",
      padding: "8px 12px",
      borderRadius: "8px",
      background: "color-mix(in srgb, var(--dsw-alias-button-info-fill, #4a9eff) 12%, transparent)",
      border: "1px solid color-mix(in srgb, var(--dsw-alias-button-info-fill, #4a9eff) 40%, transparent)",
      color: "var(--dsw-alias-label-primary, #222)",
      fontSize: "13px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LeadingIconText, { text }) });
  }
  if (actor === HUMAN_ROLE_ACTOR) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      margin: "6px 0"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
      maxWidth: "min(525px, 82%)",
      background: "var(--dsw-specific-bubble, var(--dsw-alias-bg-layer-2, #f0f0f0))",
      borderRadius: "22px",
      padding: "10px 16px",
      color: "var(--dsw-alias-label-primary, #222)",
      fontSize: "13px",
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LeadingIconText, { text }) }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: {
    margin: "6px 0",
    padding: "8px 12px",
    borderRadius: "8px",
    background: "var(--dsw-alias-bg-layer-2, #f5f5f5)",
    color: "var(--dsw-alias-label-primary, #222)",
    fontSize: "13px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  }, children: text });
}

// client/client-ui/proj2/turn-view.tsx
var import_react9 = require("react");

// client/client-ui/proj2/ledger.ts
var BODY_EVENT_TYPES = /* @__PURE__ */ new Set([
  "turn/start",
  "step/start",
  "step/end",
  "assistant/message",
  "assistant/chunk",
  "tool/call",
  "tool/result"
]);
var ANSWER_EVENT_TYPES = /* @__PURE__ */ new Set([
  "assistant/message",
  "assistant/chunk"
]);
function asRecord(value) {
  return value ?? {};
}
function turnOf(value) {
  return typeof value === "number" ? value : void 0;
}
function strOf(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function visibleOf(value) {
  if (!Array.isArray(value)) return void 0;
  const list = value.filter((item) => typeof item === "string");
  return list.length === 0 ? void 0 : list;
}
function femo2TurnEventOf(event) {
  const type = event.type;
  if (type === "femo-plugin/chat") {
    const d = asRecord(event.data);
    const turn = turnOf(d.turn);
    if (turn === void 0) return null;
    const visible = visibleOf(d.visible);
    if (d.kind === "live") {
      return {
        turn,
        role: "start",
        ...strOf(d.actor) !== void 0 ? { actor: strOf(d.actor) } : {},
        ...strOf(d.showprompt) !== void 0 ? { showprompt: strOf(d.showprompt) } : {},
        ...d.main === true ? { main: true } : {},
        ...d.scene === true ? { scene: true } : {},
        ...visible !== void 0 ? { visible } : {}
      };
    }
    if (d.kind === "speaker") {
      return {
        turn,
        role: "update",
        ...strOf(d.actor) !== void 0 ? { actor: strOf(d.actor) } : {},
        ...visible !== void 0 ? { visible } : {}
      };
    }
    if (d.kind === "prompt") {
      return {
        turn,
        role: "update",
        ...strOf(d.text) !== void 0 ? { showprompt: strOf(d.text) } : {}
      };
    }
    if (d.kind === "error") {
      return {
        turn,
        role: "update",
        ...strOf(d.text) !== void 0 ? { error: strOf(d.text) } : {}
      };
    }
    return null;
  }
  if (type === "turn/end") {
    const turn = turnOf(asRecord(event.data).turn);
    return turn === void 0 ? null : { turn, role: "update", end: true };
  }
  if (BODY_EVENT_TYPES.has(type)) {
    const turn = turnOf(asRecord(event.data).turn);
    if (turn === void 0) return null;
    return {
      turn,
      role: "update",
      bodySeq: event.seq,
      ...type !== "turn/start" ? { content: true } : {},
      ...ANSWER_EVENT_TYPES.has(type) ? { answer: true } : {}
    };
  }
  return null;
}
function femo2TurnMatch(event) {
  const shape = femo2TurnEventOf(event);
  if (shape === null) return null;
  return { id: String(shape.turn), role: shape.role };
}
function femo2TurnStart(match) {
  const shape = femo2TurnEventOf(match.event);
  return {
    turn: shape?.turn ?? 0,
    actor: shape?.actor ?? "",
    // 开轮锚点带 main 标记 ⇒ 主 Agent 轮（god 窗的主会话轮）；否则 AI 演员轮。
    kind: shape?.main === true ? "main" : "ai",
    orderSeq: match.event.seq,
    landed: false,
    ...shape?.showprompt !== void 0 ? { showprompt: shape.showprompt } : {},
    ...shape?.scene === true ? { scene: true } : {},
    ...shape?.visible !== void 0 ? { visible: shape.visible } : {}
  };
}
function femo2TurnUpdate(context, match) {
  const prev = context.state;
  if (prev === void 0) return femo2TurnStart(match);
  const shape = femo2TurnEventOf(match.event);
  if (shape === null) return prev;
  let next = prev;
  if (shape.actor !== void 0 && shape.actor !== prev.actor) next = { ...next, actor: shape.actor };
  if (shape.showprompt !== void 0 && shape.showprompt !== prev.showprompt) next = { ...next, showprompt: shape.showprompt };
  if (shape.error !== void 0 && shape.error !== prev.error) next = { ...next, error: shape.error };
  if (shape.visible !== void 0 && prev.visible === void 0) next = { ...next, visible: shape.visible };
  if (shape.bodySeq !== void 0) {
    const first = prev.firstBodySeq === void 0 ? shape.bodySeq : Math.min(prev.firstBodySeq, shape.bodySeq);
    const last = prev.lastBodySeq === void 0 ? shape.bodySeq : Math.max(prev.lastBodySeq, shape.bodySeq);
    if (first !== prev.firstBodySeq || last !== prev.lastBodySeq) {
      next = { ...next, firstBodySeq: first, lastBodySeq: last };
    }
  }
  if (shape.content === true) {
    const fc = prev.firstContentSeq === void 0 ? match.event.seq : Math.min(prev.firstContentSeq, match.event.seq);
    if (fc !== prev.firstContentSeq) next = { ...next, firstContentSeq: fc };
  }
  if (shape.answer === true) {
    const ans = prev.firstAnswerSeq === void 0 ? match.event.seq : Math.min(prev.firstAnswerSeq, match.event.seq);
    if (ans !== prev.firstAnswerSeq) next = { ...next, firstAnswerSeq: ans };
  }
  if (shape.end === true && !prev.landed) {
    next = { ...next, landed: true };
  }
  return next;
}
function femo2TurnHeadAnchor(context) {
  const state = context.state;
  if (state === void 0) return 0;
  if (state.kind === "main" && state.scene === true) {
    if (state.firstBodySeq !== void 0) return state.firstBodySeq - 0.5;
    return state.orderSeq + 0.5;
  }
  if (state.kind === "main" && state.firstAnswerSeq !== void 0) return state.firstAnswerSeq - 0.5;
  if (state.firstBodySeq !== void 0) return state.firstBodySeq - 0.5;
  return state.orderSeq + 0.5;
}
function femo2TurnLiveAnchor(context) {
  const state = context.state;
  if (state === void 0) return 1e12;
  return 1e12 + state.orderSeq;
}
function femo2TurnHeadVisible(state) {
  if (state === void 0) return false;
  if (state.kind === "main") {
    return state.firstAnswerSeq !== void 0 || state.landed && state.firstContentSeq !== void 0;
  }
  return state.firstBodySeq !== void 0 || state.landed;
}
function femo2TurnLiveVisible(state) {
  if (state === void 0) return false;
  if (state.landed) return false;
  return state.firstBodySeq === void 0;
}
function femo2TurnVisibleTo(view, visible) {
  if (view === "god") return true;
  if (visible === void 0) return true;
  return visible.includes(view);
}

// client/client-ui/proj2/frame-router.ts
var import_react6 = require("react");

// client/client-ui/stream-store.ts
var import_react5 = require("react");
var EMPTY_FEMO_BLOCKS = [];
function msgIndex(msg) {
  return typeof msg.index === "number" ? msg.index : void 0;
}
function msgStep(msg) {
  return typeof msg.step === "number" ? msg.step : void 0;
}
function sameStep(blockStep, frameStep) {
  return blockStep === frameStep;
}
function findBlockAt(blocks, idx, step, kind) {
  if (idx !== void 0) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b?.index === idx && sameStep(b.step, step) && b.kind === kind) return i;
    }
    return -1;
  }
  return findLastFemoBlock(blocks, kind);
}
var IDLE_FEMO_ENTRY = { blocks: EMPTY_FEMO_BLOCKS, running: false, since: null };
var femoStreams = /* @__PURE__ */ new Map();
var femoStreamListeners = /* @__PURE__ */ new Set();
var femoStreamRaf = 0;
function femoBucketKey(actorKey, turn) {
  return typeof turn === "number" ? `t${turn}` : `a${actorKey}`;
}
function turnOf2(turn) {
  return typeof turn === "number" ? turn : void 0;
}
function femoStreamNotify() {
  if (femoStreamRaf !== 0) return;
  femoStreamRaf = requestAnimationFrame(() => {
    femoStreamRaf = 0;
    for (const listener of [...femoStreamListeners]) listener();
  });
}
function femoStreamEntry(sid, key) {
  return femoStreams.get(sid)?.get(key) ?? IDLE_FEMO_ENTRY;
}
function femoStreamPatch(sid, key, actorKey, turn, patch2) {
  let byKey = femoStreams.get(sid);
  if (byKey === void 0) {
    byKey = /* @__PURE__ */ new Map();
    femoStreams.set(sid, byKey);
  }
  if (turn !== void 0) {
    for (const existing of [...byKey.keys()]) {
      if (existing !== key && existing.startsWith("t") && femoActorOfBucket.get(existing) === actorKey) byKey.delete(existing);
    }
    femoActorOfBucket.set(key, actorKey);
  }
  byKey.set(key, { ...femoStreamEntry(sid, key), ...patch2 });
  femoStreamNotify();
}
var femoActorOfBucket = /* @__PURE__ */ new Map();
var femoMaxTurnSeen = /* @__PURE__ */ new Map();
function findLastFemoBlock(blocks, kind) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]?.kind === kind) return i;
  }
  return -1;
}
function femoProjectionActorKey(actor) {
  return Array.from(actor).map((ch) => /[A-Za-z0-9_-]/.test(ch) ? ch : `_${(ch.codePointAt(0) ?? 0).toString(16)}`).join("");
}
function femoStreamApply(msg) {
  const sid = typeof msg.sid === "string" ? msg.sid : "";
  const actor = typeof msg.actor === "string" ? msg.actor : "";
  if (sid.length === 0 || actor.length === 0) return;
  const blockKind = msg.blockKind === "reasoning" ? "reasoning" : msg.blockKind === "toolcall" ? "toolcall" : "text";
  const actorKey = femoProjectionActorKey(actor);
  const turn = turnOf2(msg.turn);
  const bucket = femoBucketKey(actorKey, msg.turn);
  const seenKey = `${sid}\0${actorKey}`;
  if (msg.kind === "start") {
    femoMaxTurnSeen.delete(seenKey);
  }
  if (turn !== void 0) {
    const max = femoMaxTurnSeen.get(seenKey);
    if (max !== void 0 && turn < max && max - turn < 500) {
      return;
    }
    if (max === void 0 || turn > max || max - turn >= 500) femoMaxTurnSeen.set(seenKey, turn);
  }
  if (msg.kind === "end") {
    if (femoStreamEntry(sid, bucket).blocks.length > 0) {
      femoStreamPatch(sid, bucket, actorKey, turn, { blocks: EMPTY_FEMO_BLOCKS });
    }
    return;
  }
  if (msg.kind === "turn_status") {
    const running = msg.running === true;
    const prevRunning = femoStreamEntry(sid, bucket).running;
    if (running === prevRunning) return;
    femoStreamPatch(sid, bucket, actorKey, turn, {
      running,
      // 计时起点=本回合首次请求（回合中途的后续 step 不重置，与官方 turn 计时一致）。
      since: running ? prevRunning ? femoStreamEntry(sid, bucket).since : Date.now() : null
    });
    return;
  }
  const prev = femoStreamEntry(sid, bucket).blocks;
  const idx = msgIndex(msg);
  const step = msgStep(msg);
  if (msg.kind === "start") {
    if (idx !== void 0 && prev.some((b) => b.index === idx && sameStep(b.step, step))) return;
    femoStreamPatch(sid, bucket, actorKey, turn, {
      blocks: [...prev, {
        kind: blockKind,
        text: "",
        ...idx !== void 0 ? { index: idx } : {},
        ...step !== void 0 ? { step } : {}
      }]
    });
    return;
  }
  if (msg.kind === "delta") {
    const text = typeof msg.text === "string" ? msg.text : "";
    const name = typeof msg.name === "string" && msg.name.length > 0 ? msg.name : void 0;
    let at = findBlockAt(prev, idx, step, blockKind);
    if (at < 0) {
      if (blockKind === "toolcall" || text.length > 0) {
        femoStreamPatch(sid, bucket, actorKey, turn, {
          blocks: [...prev, {
            kind: blockKind,
            text,
            ...name !== void 0 ? { name } : {},
            ...idx !== void 0 ? { index: idx } : {},
            ...step !== void 0 ? { step } : {}
          }]
        });
      }
      return;
    }
    const target = prev[at];
    const next = prev.slice();
    next[at] = {
      ...target,
      text: target.text + text,
      ...name !== void 0 && !target.name ? { name } : {}
    };
    femoStreamPatch(sid, bucket, actorKey, turn, { blocks: next });
    return;
  }
  if (msg.kind === "tool_result") {
    const name = typeof msg.name === "string" && msg.name.length > 0 ? msg.name : void 0;
    const text = typeof msg.text === "string" ? msg.text : "";
    if (name === void 0 && text.length === 0) return;
    let at = -1;
    for (let i = prev.length - 1; i >= 0; i--) {
      const b = prev[i];
      if (b?.kind !== "toolcall" || b.result !== void 0) continue;
      if (name !== void 0 && b.name !== name) continue;
      if (step !== void 0 && b.step !== void 0 && b.step !== step) continue;
      at = i;
      break;
    }
    if (at >= 0) {
      const next = prev.slice();
      next[at] = { ...prev[at], result: text };
      femoStreamPatch(sid, bucket, actorKey, turn, { blocks: next });
    } else {
      femoStreamPatch(sid, bucket, actorKey, turn, {
        blocks: [...prev, {
          kind: "toolcall",
          text: "",
          ...name !== void 0 ? { name } : {},
          ...step !== void 0 ? { step } : {},
          result: text
        }]
      });
    }
    return;
  }
  if (msg.kind === "block_end") {
    if (msg.retain === true) return;
    let at = findBlockAt(prev, idx, step, blockKind);
    if (at < 0) return;
    const next = prev.slice();
    next.splice(at, 1);
    femoStreamPatch(sid, bucket, actorKey, turn, { blocks: next });
  }
}
var femoStreamEs;
var foregroundRefs = 0;
var backgroundRefs = 0;
var pageVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
var visibilityBound = false;
function femoStreamWanted() {
  return backgroundRefs > 0 || foregroundRefs > 0 && pageVisible;
}
function syncFemoStreamConnection() {
  if (femoStreamWanted() && femoStreamEs === void 0) {
    femoStreamEs = new EventSource("/femo-plugin/events");
    femoStreamEs.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "femo_stream") femoStreamApply(msg.data ?? {});
        if (msg.type === "run_state") {
          const d = msg.data ?? {};
          if (d.state === "running") {
            femoMaxTurnSeen.clear();
          }
        }
        if (msg.type === "femo_actor_usage") actorUsageApply(msg.data ?? {});
        if (controlHandlers.size > 0) {
          for (const h of [...controlHandlers]) {
            try {
              h(msg);
            } catch {
            }
          }
        }
      } catch {
      }
    };
    return;
  }
  if (!femoStreamWanted() && femoStreamEs !== void 0) {
    femoStreamEs.close();
    femoStreamEs = void 0;
  }
}
function ensureVisibilityGate() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    pageVisible = document.visibilityState !== "hidden";
    syncFemoStreamConnection();
  });
}
var controlHandlers = /* @__PURE__ */ new Set();
function subscribeControlEvents(h) {
  controlHandlers.add(h);
  return () => {
    controlHandlers.delete(h);
  };
}
function femoStreamAcquire(opts) {
  ensureVisibilityGate();
  if (opts?.background === true) backgroundRefs += 1;
  else foregroundRefs += 1;
  syncFemoStreamConnection();
  return () => {
    if (opts?.background === true) backgroundRefs -= 1;
    else foregroundRefs -= 1;
    syncFemoStreamConnection();
  };
}
var actorUsages = /* @__PURE__ */ new Map();
var actorUsageListeners = /* @__PURE__ */ new Set();
function actorUsageApply(d) {
  const sid = typeof d.sid === "string" ? d.sid : void 0;
  const actorKey = typeof d.actorKey === "string" ? d.actorKey : void 0;
  if (sid === void 0 || actorKey === void 0) return;
  let byActor = actorUsages.get(sid);
  if (byActor === void 0) {
    byActor = /* @__PURE__ */ new Map();
    actorUsages.set(sid, byActor);
  }
  byActor.set(actorKey, {
    provider: typeof d.provider === "string" ? d.provider : "",
    model: typeof d.model === "string" ? d.model : "",
    contextWindow: typeof d.contextWindow === "number" && d.contextWindow > 0 ? d.contextWindow : 1e6,
    usedTokens: typeof d.usedTokens === "number" ? d.usedTokens : 0,
    updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : Date.now()
  });
  for (const l of [...actorUsageListeners]) {
    try {
      l();
    } catch {
    }
  }
}
function useActorUsage(mainSid, actorKey) {
  const [value, setValue] = (0, import_react5.useState)(void 0);
  (0, import_react5.useEffect)(() => {
    if (mainSid === void 0 || actorKey === void 0) {
      setValue(void 0);
      return;
    }
    let alive = true;
    const read = () => {
      setValue(actorUsages.get(mainSid)?.get(actorKey));
    };
    read();
    void fetch(`/femo-plugin/actor-usage?sessionId=${encodeURIComponent(mainSid)}`).then((response) => response.json()).then((data) => {
      if (!alive || data?.ok !== true || data.actors === void 0 || typeof data.actors !== "object") return;
      let byActor = actorUsages.get(mainSid);
      if (byActor === void 0) {
        byActor = /* @__PURE__ */ new Map();
        actorUsages.set(mainSid, byActor);
      }
      for (const [key, rec] of Object.entries(data.actors)) {
        if (rec !== null && typeof rec === "object") byActor.set(key, rec);
      }
      read();
    }).catch(() => {
    });
    const release = femoStreamAcquire();
    actorUsageListeners.add(read);
    return () => {
      alive = false;
      actorUsageListeners.delete(read);
      release();
    };
  }, [mainSid, actorKey]);
  return value;
}

// client/client-ui/proj2/frame-router.ts
var IDLE = { blocks: [], running: false, since: null };
var EMPTY_BLOCKS = [];
var buckets = /* @__PURE__ */ new Map();
var listeners = /* @__PURE__ */ new Set();
var notifyRaf = 0;
function notify() {
  if (notifyRaf !== 0) return;
  notifyRaf = requestAnimationFrame(() => {
    notifyRaf = 0;
    for (const listener of [...listeners]) listener();
  });
}
function bucketOf(sid) {
  let byTurn = buckets.get(sid);
  if (byTurn === void 0) {
    byTurn = /* @__PURE__ */ new Map();
    buckets.set(sid, byTurn);
  }
  return byTurn;
}
function entryOf(sid, turn) {
  return buckets.get(sid)?.get(turn) ?? IDLE;
}
function patch(sid, turn, next) {
  const byTurn = bucketOf(sid);
  byTurn.set(turn, { ...entryOf(sid, turn), ...next });
  notify();
}
function femo2ResetAll(sid) {
  if (sid === void 0) {
    buckets.clear();
  } else {
    buckets.delete(sid);
  }
  notify();
}
function blockKindOf(value) {
  if (value === "reasoning") return "reasoning";
  if (value === "toolcall") return "toolcall";
  return "text";
}
function sameStep2(a, b) {
  return a === b;
}
function findBlockAt2(blocks, index, step, kind) {
  if (index >= 0) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block?.index === index && sameStep2(block.step, step) && block.kind === kind) return i;
    }
    return -1;
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]?.kind === kind) return i;
  }
  return -1;
}
function femo2FeedFrame(raw) {
  const sid = typeof raw.sid === "string" ? raw.sid : "";
  const turn = typeof raw.turn === "number" ? raw.turn : void 0;
  if (sid === "" || turn === void 0) return;
  const kind = typeof raw.kind === "string" ? raw.kind : "";
  const step = typeof raw.step === "number" ? raw.step : void 0;
  const index = typeof raw.index === "number" ? raw.index : -1;
  const prev = entryOf(sid, turn);
  if (kind === "end") {
    if (prev.blocks.length > 0) patch(sid, turn, { blocks: EMPTY_BLOCKS });
    return;
  }
  if (kind === "turn_status") {
    const running = raw.running === true;
    if (running === prev.running) return;
    patch(sid, turn, { running, since: running ? prev.running ? prev.since : Date.now() : null });
    return;
  }
  const blockKind = blockKindOf(raw.blockKind);
  if (kind === "start") {
    if (index >= 0 && prev.blocks.some((b) => b.index === index && sameStep2(b.step, step))) return;
    patch(sid, turn, {
      blocks: [...prev.blocks, {
        kind: blockKind,
        text: "",
        ...index >= 0 ? { index } : {},
        ...step !== void 0 ? { step } : {}
      }]
    });
    return;
  }
  if (kind === "delta") {
    const text = typeof raw.text === "string" ? raw.text : "";
    const name = typeof raw.name === "string" && raw.name.length > 0 ? raw.name : void 0;
    const at = findBlockAt2(prev.blocks, index, step, blockKind);
    if (at < 0) {
      if (blockKind === "toolcall" || text.length > 0) {
        patch(sid, turn, {
          blocks: [...prev.blocks, {
            kind: blockKind,
            text,
            ...name !== void 0 ? { name } : {},
            ...index >= 0 ? { index } : {},
            ...step !== void 0 ? { step } : {}
          }]
        });
      }
      return;
    }
    const target = prev.blocks[at];
    const next = prev.blocks.slice();
    next[at] = {
      ...target,
      text: target.text + text,
      ...name !== void 0 && target.name === void 0 ? { name } : {}
    };
    patch(sid, turn, { blocks: next });
    return;
  }
  if (kind === "tool_result") {
    const name = typeof raw.name === "string" && raw.name.length > 0 ? raw.name : void 0;
    const text = typeof raw.text === "string" ? raw.text : "";
    if (name === void 0 && text.length === 0) return;
    let at = -1;
    for (let i = prev.blocks.length - 1; i >= 0; i--) {
      const block = prev.blocks[i];
      if (block?.kind !== "toolcall" || block.result !== void 0) continue;
      if (name !== void 0 && block.name !== name) continue;
      if (step !== void 0 && block.step !== void 0 && block.step !== step) continue;
      at = i;
      break;
    }
    if (at >= 0) {
      const next = prev.blocks.slice();
      next[at] = { ...prev.blocks[at], result: text };
      patch(sid, turn, { blocks: next });
    } else {
      patch(sid, turn, {
        blocks: [...prev.blocks, {
          kind: "toolcall",
          text: "",
          ...name !== void 0 ? { name } : {},
          ...step !== void 0 ? { step } : {},
          result: text
        }]
      });
    }
    return;
  }
  if (kind === "block_end") {
    if (raw.retain === true) return;
    const at = findBlockAt2(prev.blocks, index, step, blockKind);
    if (at < 0) return;
    const next = prev.blocks.slice();
    next.splice(at, 1);
    patch(sid, turn, { blocks: next });
  }
}
var wired = false;
function ensureWired() {
  if (wired) return;
  wired = true;
  subscribeControlEvents((msg) => {
    if (msg.type === "femo_stream") {
      femo2FeedFrame(msg.data ?? {});
      return;
    }
    if (msg.type === "run_state") {
      const data = msg.data ?? {};
      if (data.state === "running") {
        const sid = typeof data.sid === "string" ? data.sid : void 0;
        femo2ResetAll(sid);
      }
    }
  });
}
function useFemo2Live(mainSid, turn) {
  const [state, setState] = (0, import_react6.useState)(IDLE);
  (0, import_react6.useEffect)(() => {
    ensureWired();
    if (mainSid === void 0 || turn === void 0) {
      setState(IDLE);
      return;
    }
    const read = () => {
      setState(entryOf(mainSid, turn));
    };
    read();
    const release = femoStreamAcquire();
    listeners.add(read);
    return () => {
      listeners.delete(read);
      release();
    };
  }, [mainSid, turn]);
  return state;
}
function femo2DumpBuckets(sid) {
  const byTurn = buckets.get(sid);
  if (byTurn === void 0) return [];
  return [...byTurn.entries()].map(([turn, entry]) => ({
    turn,
    blocks: entry.blocks.length,
    running: entry.running,
    text: entry.blocks.map((b) => `${b.kind === "toolcall" ? `\u2699${b.name ?? ""}:` : ""}${b.text}`).join("|").slice(0, 60)
  }));
}
ensureWired();

// client/client-ui/proj2/window-id.ts
function projectionWindowOf(sessionId) {
  if (sessionId === void 0 || !sessionId.startsWith("femo-proj-")) return {};
  const suffix = sessionId.slice("femo-proj-".length);
  const cut = suffix.lastIndexOf("-");
  if (cut <= 0) return {};
  return { mainSid: suffix.slice(0, cut), winActorKey: suffix.slice(cut + 1) };
}
function windowShowsActor(winActorKey, actorKey) {
  if (winActorKey === void 0) return false;
  return winActorKey === "god" || winActorKey === "stage" || winActorKey === actorKey;
}

// client/client-ui/femo-stream-live.tsx
var import_react8 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");

// client/femo-reasoning-row.tsx
var import_react7 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime5 = require("react/jsx-runtime");
function useThrottledVisualUpdate(update, intervalFrames = 3) {
  const updateRef = (0, import_react7.useRef)(update);
  updateRef.current = update;
  const pendingFrameRef = (0, import_react7.useRef)(null);
  (0, import_react7.useLayoutEffect)(() => () => {
    if (pendingFrameRef.current === null) return;
    cancelAnimationFrame(pendingFrameRef.current);
    pendingFrameRef.current = null;
  }, []);
  return (0, import_react7.useCallback)(() => {
    if (pendingFrameRef.current !== null) return;
    let remainingFrames = intervalFrames;
    const advance = () => {
      remainingFrames -= 1;
      if (remainingFrames > 0) {
        pendingFrameRef.current = requestAnimationFrame(advance);
        return;
      }
      pendingFrameRef.current = null;
      updateRef.current();
    };
    pendingFrameRef.current = requestAnimationFrame(advance);
  }, [intervalFrames]);
}
function firstLine(text) {
  const newline = text.indexOf("\n");
  return newline === -1 ? text : text.slice(0, newline);
}
function latestLine(text) {
  const visible = text.trimEnd();
  const newline = visible.lastIndexOf("\n");
  return newline === -1 ? visible : visible.slice(newline + 1);
}
function FemoReasoningRow({ text, running, runningLabel }) {
  const [expanded, setExpanded] = (0, import_react7.useState)(false);
  const summaryRef = (0, import_react7.useRef)(null);
  const summary = running ? latestLine(text) : firstLine(text);
  const scheduleSummaryScroll = useThrottledVisualUpdate(() => {
    const element = summaryRef.current;
    if (element === null) return;
    element.scrollLeft = running ? element.scrollWidth - element.clientWidth : 0;
  });
  (0, import_react7.useEffect)(() => {
    scheduleSummaryScroll();
  }, [running, scheduleSummaryScroll, summary]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "femo-rr-root", "data-variant": "think", "data-state": running ? "running" : "ok", children: [
    running && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "femo-a11y-hidden", children: runningLabel }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      import_dsh_client_ui_primitives3.DisclosureRow,
      {
        rowClassName: "femo-rr-row",
        leadingClassName: "femo-rr-leading",
        titleClassName: "femo-rr-title",
        chevronClassName: "femo-rr-chevron",
        icon: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives3.IconThinkOutline14, { size: 14 }),
        title: "Think",
        open: expanded,
        expandable: true,
        expandOnRowClick: true,
        onToggle: () => {
          setExpanded((value) => !value);
        },
        collapsedContent: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "femo-rr-separator", "aria-hidden": true }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { ref: summaryRef, className: "femo-rr-summary", "data-follow-end": running || void 0, children: summary })
        ] }),
        children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "femo-rr-think-body", children: text })
      }
    )
  ] });
}

// client/client-ui/femo-stream-live.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function FemoTurnStatus({ startTime }) {
  const [mountedAt] = (0, import_react8.useState)(() => Date.now());
  const anchor = startTime ?? mountedAt;
  const [elapsedMs, setElapsedMs] = (0, import_react8.useState)(() => Math.max(0, Date.now() - anchor));
  (0, import_react8.useEffect)(() => {
    const tick = () => {
      setElapsedMs(Math.max(0, Date.now() - anchor));
    };
    tick();
    const id = setInterval(tick, 1e3);
    return () => {
      clearInterval(id);
    };
  }, [anchor]);
  const showClock = elapsedMs >= 15e3;
  const total = Math.max(0, Math.floor(elapsedMs / 1e3));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "femo-turn-status", role: "status", "aria-live": "polite", children: [
    "Deep diving...",
    showClock && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-turn-status-clock", "aria-hidden": true, children: minutes > 0 ? `${minutes}\u5206${String(seconds).padStart(2, "0")}\u79D2` : `${seconds}\u79D2` })
  ] });
}
var FEMO_TOOL_VARIANT_TITLES = {
  search: "Search",
  read: "Read",
  bash: "Bash",
  write: "Write",
  edit: "Edit",
  code: "Code",
  others: "Tool call"
};
var FEMO_TOOL_VARIANTS = {
  bash: "bash",
  pwsh: "bash",
  read: "read",
  web_fetch: "read",
  web_search: "search",
  grep: "search",
  glob: "search",
  write: "write",
  edit: "edit",
  run_code: "code"
};
var FEMO_TOOL_SUMMARY_KEYS = {
  bash: ["description", "command"],
  read: ["path", "file_path", "url"],
  search: ["query", "pattern", "url"],
  write: ["path", "file_path"],
  edit: ["path", "file_path"],
  code: ["description"],
  others: []
};
var FEMO_TOOL_VARIANT_ICONS = {
  search: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.IconSearchOutline16, { size: 14 }),
  read: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.IconBrowseOutline16, { size: 14 }),
  bash: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.IconApiOutline14, { size: 14 }),
  write: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.IconEditOutline16, { size: 14 }),
  edit: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.IconEditOutline16, { size: 14 }),
  code: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.IconCodeOutline16, { size: 14 }),
  others: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.IconSparkle16, { size: 14 })
};
function femoToolFirstLine(text) {
  const nl = text.indexOf("\n");
  return nl === -1 ? text : text.slice(0, nl);
}
function femoToolPick(args, keys) {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v !== "") return v;
  }
  return void 0;
}
function femoToolDeriveSummary(variant, argsRaw) {
  let parsed;
  try {
    parsed = JSON.parse(argsRaw);
  } catch {
    return femoToolFirstLine(argsRaw);
  }
  if (typeof parsed !== "object" || parsed === null) return femoToolFirstLine(argsRaw);
  const args = parsed;
  const picked = femoToolPick(args, FEMO_TOOL_SUMMARY_KEYS[variant]);
  if (picked !== void 0) return femoToolFirstLine(picked);
  for (const v of Object.values(args)) {
    if (typeof v === "string" && v !== "") return femoToolFirstLine(v);
  }
  return femoToolFirstLine(argsRaw);
}
function femoToolDeriveBody(variant, argsRaw) {
  if (argsRaw === "") return null;
  let parsed;
  try {
    parsed = JSON.parse(argsRaw);
  } catch {
    return argsRaw;
  }
  if (variant === "code" && typeof parsed === "object" && parsed !== null) {
    const code = parsed.code;
    if (typeof code === "string" && code !== "") return code;
  }
  return JSON.stringify(parsed, null, 2);
}
function FemoToolRow({ name, args, result, t }) {
  const [open, setOpen] = (0, import_react8.useState)(false);
  const toolName = name ?? "";
  const variant = FEMO_TOOL_VARIANTS[toolName] ?? "others";
  const running = result === void 0;
  const base = femoToolDeriveSummary(variant, args);
  const summary = variant === "others" && toolName !== "" ? base === "" ? toolName : `${toolName} \xB7 ${base}` : base;
  const body = femoToolDeriveBody(variant, args);
  const output = result !== void 0 && result !== "" ? result : null;
  const expandable = body !== null || output !== null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "femo-toolrow", "data-variant": variant, "data-tool": toolName, "data-state": running ? "running" : "ok", children: [
    running && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-toolrow-sr", children: t("row.running") }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      import_dsh_client_ui_primitives4.DisclosureRow,
      {
        rowClassName: "femo-toolrow-row",
        leadingClassName: "femo-toolrow-leading",
        titleClassName: "femo-toolrow-title",
        chevronClassName: "femo-toolrow-chevron",
        icon: FEMO_TOOL_VARIANT_ICONS[variant],
        title: FEMO_TOOL_VARIANT_TITLES[variant],
        open: open && expandable,
        expandable,
        expandOnRowClick: true,
        keepContentWhenOpen: true,
        onToggle: () => {
          setOpen((v) => !v);
        },
        collapsedContent: summary !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-toolrow-sep", "aria-hidden": true }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-toolrow-summary", children: summary })
        ] }),
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "femo-toolrow-bodywrap", children: (body !== null || output !== null) && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "femo-toolrow-iocard", children: [
          body !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "femo-toolrow-iosection", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-toolrow-iolabel", children: "IN" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-toolrow-iotext", children: body })
          ] }),
          body !== null && output !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-toolrow-iodivider", "aria-hidden": true }),
          output !== null && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "femo-toolrow-iosection", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-toolrow-iolabel", children: "OUT" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "femo-toolrow-iotext", children: output })
          ] })
        ] }) })
      }
    )
  ] });
}
function FemoStreamLive({ blocks, t }) {
  const safeT = typeof t === "function" ? t : (key) => key;
  const codeLabels = (0, import_react8.useMemo)(() => ({ copyLabel: safeT("copy"), copiedLabel: safeT("copied") }), [safeT]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "femo-stream-root", children: blocks.map((block, i) => block.kind === "reasoning" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    FemoReasoningRow,
    {
      text: block.text,
      running: i === blocks.length - 1,
      runningLabel: safeT("row.running")
    },
    i
  ) : block.kind === "toolcall" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    FemoToolRow,
    {
      name: block.name,
      args: block.text,
      result: block.result,
      t: safeT
    },
    i
  ) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.MarkdownText, { text: block.text, streaming: true, codeLabels }, i)) });
}

// client/client-ui/proj2/turn-view.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var femo2TurnDefinition = {
  kind: "femo2-turn",
  target: "chat",
  match: femo2TurnMatch,
  start: (_context, match) => femo2TurnStart(match),
  update: femo2TurnUpdate,
  publication: () => "immediate",
  buildViewNode: (context) => {
    const state = context.state;
    if (state === void 0) return null;
    const shown = state.actor !== "" && femo2TurnHeadVisible(state);
    return {
      key: context.key,
      kind: "femo2-turn",
      id: context.id,
      target: "chat",
      anchorSeq: femo2TurnHeadAnchor(context),
      location: { kind: "unresolved" },
      visibility: shown ? "visible" : "hidden",
      data: {
        turn: state.turn,
        actor: state.actor,
        ...state.showprompt !== void 0 ? { showprompt: state.showprompt } : {},
        ...state.error !== void 0 ? { error: state.error } : {},
        ...state.visible !== void 0 ? { visible: state.visible } : {}
      }
    };
  }
};
function ShowpromptBar({ text }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
    margin: "6px 0",
    padding: "6px 12px",
    borderRadius: "6px",
    borderLeft: "3px solid var(--dsw-alias-button-info-fill, #4a9eff)",
    background: "color-mix(in srgb, var(--dsw-alias-button-info-fill, #4a9eff) 6%, transparent)",
    color: "var(--dsw-alias-label-secondary, #666)",
    fontSize: "12px",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
  }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(LeadingIconText, { iconSize: 11, text: text.startsWith("\u{1F4E2}") ? text : `\u{1F4E2} ${text}` }) });
}
function ActorLine({ actor }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { fontWeight: 700, fontSize: "12.5px", color: actorColor(actor) }, children: actor });
}
function Femo2TurnNodeView({ node, useSession, t: _t }) {
  const sessionId = useSession((snapshot) => snapshot.sessionId);
  const view = useView(sessionId);
  const { actor, showprompt, error, visible } = node.data;
  if (view === "offstage") return null;
  if (!femo2TurnVisibleTo(view, visible)) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { margin: "8px 0 2px" }, children: [
    showprompt !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ShowpromptBar, { text: showprompt }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ActorLine, { actor }),
    error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: {
      margin: "2px 0 4px",
      color: "var(--dsw-alias-state-error-primary, #e5484d)",
      fontSize: "12px",
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(LeadingIconText, { iconSize: 11, text: error }) })
  ] });
}
var femo2TurnLiveDefinition = {
  kind: "femo2-turn-live",
  target: "chat",
  match: femo2TurnMatch,
  start: (_context, match) => femo2TurnStart(match),
  update: femo2TurnUpdate,
  publication: () => "immediate",
  buildViewNode: (context) => {
    const state = context.state;
    if (state === void 0) return null;
    const shown = state.actor !== "" && femo2TurnLiveVisible(state);
    return {
      key: context.key,
      kind: "femo2-turn-live",
      id: context.id,
      target: "chat",
      anchorSeq: femo2TurnLiveAnchor(context),
      location: { kind: "unresolved" },
      visibility: shown ? "visible" : "hidden",
      data: {
        turn: state.turn,
        actor: state.actor,
        actorKey: femoProjectionActorKey(state.actor),
        ...state.showprompt !== void 0 ? { showprompt: state.showprompt } : {},
        ...state.visible !== void 0 ? { visible: state.visible } : {}
      }
    };
  }
};
function Femo2TurnLiveNodeView({ node, useSession, t }) {
  const sessionId = useSession((snapshot) => snapshot.sessionId);
  const view = useView(sessionId);
  const win = (0, import_react9.useMemo)(() => projectionWindowOf(sessionId), [sessionId]);
  const { turn, actor, actorKey, showprompt, visible } = node.data;
  const inWindow = windowShowsActor(win.winActorKey, actorKey);
  const eligible = view !== "offstage" && inWindow && femo2TurnVisibleTo(view, visible) && win.mainSid !== void 0;
  const live = useFemo2Live(eligible ? win.mainSid : void 0, eligible ? turn : void 0);
  const showLive = live.blocks.length > 0 || live.running;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { margin: "10px 0 4px" }, children: [
    showprompt !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ShowpromptBar, { text: showprompt }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ActorLine, { actor }),
    live.blocks.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(FemoStreamLive, { blocks: live.blocks, t }),
    live.running && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(FemoTurnStatus, { startTime: live.since })
  ] });
}

// client/client-ui/proj2/index.ts
function switchOff(value) {
  return value === "0" || value === "off" || value === "false";
}
function proj2Enabled() {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get("proj2");
    if (fromUrl !== null) return !switchOff(fromUrl);
    const stored = window.localStorage?.getItem("femo.proj2");
    if (stored !== null && stored !== void 0) return !switchOff(stored);
  } catch {
  }
  return true;
}
function registerProj2Nodes(register) {
  register(femo2TurnDefinition);
  register(femo2TurnLiveDefinition);
  console.log("[femo-plugin] proj2 (v9.4) conversation nodes registered (2: femo2-turn, femo2-turn-live)");
  window.__femo2Buckets = (sid) => femo2DumpBuckets(sid);
  window.__femo2Feed = (frame) => femo2FeedFrame(frame);
}

// client/client-ui/editor-view.tsx
var import_react23 = require("react");

// client/client-ui/editor-page.tsx
var import_react22 = require("react");
var import_react_dom3 = require("react-dom");
var import_client = require("react-dom/client");

// ../../femoGen/src/FemoWorAuto.jsx
var import_react21 = __toESM(require("react"), 1);

// ../../femoGen/src/common.jsx
var import_react10 = __toESM(require("react"), 1);

// ../../femoGen/src/themes.js
var FEMO_THEMES = [
  { id: "auto", name: "\u8DDF\u968F DSH", desc: "\u81EA\u52A8\u8DDF\u968F dsh \u672C\u4F53\u4E3B\u9898\uFF08\u767D\u5929\u2192DSH \u6D45\u8272 / \u9ED1\u591C\u2192DSH \u6DF1\u8272\uFF09" },
  { id: "dsh", name: "DSH \u6D45\u8272", desc: "dsh \u672C\u4F53\u767D\u5929\u8BBE\u8BA1\u8BED\u8A00\uFF08deepseek \u84DD + bluish \u8272\u9636 + \u7CFB\u7EDF\u5B57\u4F53\uFF09" },
  { id: "dsh-dark", name: "DSH \u6DF1\u8272", desc: "dsh \u672C\u4F53\u9ED1\u591C\u8BBE\u8BA1\u8BED\u8A00\uFF08\u6DF1\u8272 bluish \u5C42\u7EA7 + \u4EAE\u8272\u72B6\u6001\uFF09" }
];
var THEME_CSS = `
/* \u2550\u2550 \u6D45\u8272\u4E3B\u9898\uFF08\u9ED8\u8BA4\uFF09\uFF1A\u5168\u90E8 token \u2550\u2550 */
:root, [data-femo-theme] {
  /* \u2500\u2500 \u5E94\u7528\u80CC\u666F \u2500\u2500 */
  --femo-app-bg: #ffffff;            /* \u7F16\u8F91\u5668\u6839\u80CC\u666F\uFF08round27\uFF1A\u5BF9\u9F50\u5B98\u65B9\u6D45\u8272\u804A\u5929\u5E95 bg-base=\u7EAF\u767D\uFF09 */

  /* \u2500\u2500 \u4E3B\u8272\uFF08\u84DD\uFF09\u2500\u2500 */
  --femo-primary: #4176e6;           /* \u4E3B\u8272\uFF1A\u6FC0\u6D3B tab / \u9009\u4E2D / \u4E3B\u6309\u94AE / \u8FDE\u7EBF\u9009\u4E2D / \u7126\u70B9 */
  --femo-primary-strong: #5686fe;    /* \u4E3B\u8272\u5F3A\u8C03\uFF1Ahover\u3001@ai \u89D2\u8272\u3001\u5E38\u6001\u8FDE\u7EBF\u3001\u6D41\u5F0F\u5149\u6807 */
  --femo-primary-soft: #edf3fe;      /* \u4E3B\u8272\u6DE1\u80CC\u666F\uFF1A\u9009\u4E2D\u9879\u80CC\u666F */
  --femo-primary-soft-2: #e4edfd;    /* \u4E3B\u8272\u6781\u6DE1\u80CC\u666F\uFF08#eff2ff \u5F52\u5E76\uFF09 */
  --femo-primary-soft-faint: rgba(65,118,230,0.08); /* \u4E3B\u8272 8% \u900F\u660E\u5E95 */
  --femo-primary-glow-weak: rgba(65,118,230,0.12);   /* \u4E3B\u8272\u5149\u6655\u5F31\uFF080.06/0.12 \u5F52\u5E76\uFF09 */
  --femo-primary-glow: rgba(65,118,230,0.25);         /* \u4E3B\u8272\u5149\u6655\u4E2D\uFF080.25 \u5F52\u5E76\uFF09 */
  --femo-primary-glow-strong: rgba(65,118,230,0.4);  /* \u4E3B\u8272\u5149\u6655\u5F3A\uFF080.4 \u5F52\u5E76\uFF09 */
  --femo-primary-glow-x: rgba(65,118,230,0.6);       /* \u4E3B\u8272\u5149\u6655\u6781\u5F3A\uFF1A\u9009\u4E2D\u63CF\u8FB9 */
  --femo-primary-overlay: rgba(65,118,230,0.92);     /* \u534A\u900F\u660E\u4E3B\u8272\u6309\u94AE\u5E95 */

  /* \u2500\u2500 \u5371\u9669\uFF08\u7EA2\uFF09\u2500\u2500 */
  --femo-danger: #ef4444;            /* \u5371\u9669\u4E3B\u8272\uFF1A\u9519\u8BEF\u6587\u5B57 / \u5220\u9664 */
  --femo-danger-weak: #f25a5a;       /* \u5371\u9669\u5F31\uFF1Ahover \u5220\u9664\u6309\u94AE */
  --femo-danger-strong: #ec1313;     /* \u5371\u9669\u6DF1\uFF08#991b1b \u5F52\u5E76\uFF09 */
  --femo-danger-soft: #fef2f2;       /* \u5371\u9669\u6DE1\u80CC\u666F\uFF08#fff0f0/#fff5f5 \u5F52\u5E76\uFF09 */
  --femo-danger-soft-2: rgba(236,19,19,0.08);  /* \u5371\u9669\u6DE1\u80CC\u666F\uFF08\u534A\u900F\u660E\uFF09 */
  --femo-danger-border: #fee2e2;     /* \u5371\u9669\u8FB9\u6846 */
  --femo-danger-glow-weak: rgba(236,19,19,0.15);  /* \u5371\u9669\u5149\u6655\u5F31 */
  --femo-danger-glow: rgba(236,19,19,0.3);        /* \u5371\u9669\u5149\u6655\u4E2D */
  --femo-danger-glow-strong: rgba(236,19,19,0.5); /* \u5371\u9669\u5149\u6655\u5F3A */

  /* \u2500\u2500 \u8B66\u544A\uFF08\u6A59\uFF09\u2500\u2500 */
  --femo-warning: #f59e0b;           /* \u8B66\u544A\u4E3B\u8272 */
  --femo-warning-strong: #dd8629;    /* \u8B66\u544A\u6DF1\u6587\u5B57 */
  --femo-warning-soft: #fef5e7;      /* \u8B66\u544A\u6DE1\u80CC\u666F\uFF08#fef3c7 \u5F52\u5E76\uFF09 */
  --femo-warning-border: #f7ad31;    /* \u8B66\u544A\u8FB9\u6846 */

  /* \u2500\u2500 \u6210\u529F\uFF08\u7EFF\uFF09\u2500\u2500 */
  --femo-success: #22c55e;           /* \u6210\u529F\u4E3B\u8272 */
  --femo-success-strong: #4ed17e;    /* \u6210\u529F\u6DF1\uFF08START/IN \u8282\u70B9\u8272\uFF09 */
  --femo-success-text: #16a34a;      /* \u6210\u529F\u6587\u5B57 */
  --femo-success-soft: #e6faed;      /* \u6210\u529F\u6DE1\u80CC\u666F\uFF08#f0fdf4/#edfaf4 \u5F52\u5E76\uFF09 */

  /* \u2500\u2500 \u6587\u672C\u4E09\u7EA7 \u2500\u2500 */
  --femo-text-1: #0f1115;            /* \u4E3B\u6587\u672C */
  --femo-text-2: #61666b;            /* \u6B21\u7EA7\u6587\u672C */
  --femo-text-2-alt: #81858c;        /* \u6B21\u7EA7\u6587\u672C\uFF08\u504F\u7070\uFF09 */
  --femo-text-3: #81858c;            /* \u5F31\u6587\u672C */
  --femo-text-4: #adb2b8;            /* \u5360\u4F4D\u6587\u672C\uFF08#a0aec0 \u5F52\u5E76\uFF09 */
  --femo-text-4-weak: #cfd3d6;       /* \u5360\u4F4D\u6587\u672C\u66F4\u5F31 */
  --femo-neutral: #979da6;           /* \u4E2D\u6027\u7070\uFF1A\u5F31\u6587\u672C/\u7981\u7528\u5E95/\u4E2D\u6027\u8FB9\uFF08#9aaccb \u5F52\u5E76\uFF09 */
  --femo-neutral-faint: rgba(151,157,166,0.09);   /* \u4E2D\u6027\u7070 9% \u5E95 */
  --femo-neutral-border: rgba(151,157,166,0.27);  /* \u4E2D\u6027\u7070 27% \u8FB9 */

  /* \u2500\u2500 \u80CC\u666F / \u8868\u9762 \u2500\u2500 */
  --femo-bg: #f9fafb;                /* \u9762\u677F\u80CC\u666F */
  --femo-bg-2: #f1f3f5;              /* \u6B21\u7EA7\u80CC\u666F\uFF08\u8F93\u5165\u6846\u5E95\u7B49\uFF09 */
  --femo-bg-hover: #e1e5ee;          /* \u5217\u8868\u9879 hover \u80CC\u666F */
  --femo-surface: #ffffff;           /* \u5361\u7247/\u8F93\u5165\u6846\u8868\u9762 */
  --femo-on-accent: #ffffff;         /* \u5F69\u8272\u6309\u94AE\uFF08\u4E3B/\u6210\u529F/\u8B66\u544A/\u6807\u7B7E\uFF09\u4E0A\u7684\u6587\u5B57 */

  /* \u2500\u2500 \u8FB9\u6846 \u2500\u2500 */
  --femo-border: rgba(0,0,0,0.08);            /* \u5E38\u89C4\u8FB9\u6846\uFF08#edf0f8 \u5F52\u5E76\uFF09 */
  --femo-border-strong: rgba(0,0,0,0.12);     /* \u6DF1\u8FB9\u6846 */
  --femo-tag-bg: #61666b;            /* \u6807\u7B7E/\u5F3A\u8C03\u5E95\uFF08\u6DF1\u84DD\u7070\uFF09 */
  --femo-tag-bg-faint: rgba(97,102,107,0.09);    /* \u6807\u7B7E\u5F3A\u8C03 9% \u8FB9 */
  --femo-scrollbar: #d4d4d4;         /* \u6EDA\u52A8\u6761 */

  /* \u2500\u2500 \u906E\u7F69 / \u9634\u5F71 \u2500\u2500 */
  --femo-mask-soft: rgba(0,0,0,0.24);  /* \u6D45\u906E\u7F69\uFF080.3 \u5F52\u5E76\uFF09 */
  --femo-mask: rgba(0,0,0,0.48);        /* \u5E38\u89C4\u906E\u7F69\uFF080.45 \u5F52\u5E76\uFF09 */
  --femo-mask-heavy: rgba(0,0,0,0.48); /* \u6DF1\u906E\u7F69 */
  --femo-mask-blue: rgba(0,0,0,0.48); /* \u84DD\u9ED1\u906E\u7F69\uFF08\u5F39\u7A97\uFF09 */
  --femo-shadow-sm: rgba(0,0,0,0.06);   /* \u5C0F\u9634\u5F71\uFF080.08/0.12 \u5F52\u5E76\uFF09 */
  --femo-shadow-md: rgba(0,0,0,0.1);  /* \u4E2D\u9634\u5F71\uFF080.15 \u5F52\u5E76\uFF09 */
  --femo-shadow-lg: rgba(0,0,0,0.16);   /* \u5927\u9634\u5F71\uFF080.25/0.35 \u5F52\u5E76\uFF09 */
  --femo-shadow-xl: rgba(0,0,0,0.24);  /* \u7279\u5927\u9634\u5F71\uFF080.4/0.5 \u5F52\u5E76\uFF09 */
  --femo-shadow-blue: rgba(0,0,0,0.05); /* \u8282\u70B9\u84DD\u9634\u5F71 */

  /* \u2500\u2500 \u753B\u5E03 \u2500\u2500 */
  --femo-canvas-dot: #cfd3d6;        /* \u753B\u5E03\u70B9\u9635\uFF08\u684C\u9762\uFF09 */

  /* \u2500\u2500 \u89D2\u8272\u8272\uFF08\u8282\u70B9\u7C7B\u578B\uFF09\u2014\u2014round27 \u6D45\u8272\u540C\u6B65\uFF1A\u83AB\u5170\u8FEA\u6D45\u8272\u7248\uFF08\u7C89\u5F69\u5E95+\u6DF1\u5B57\u6210\u5BF9\uFF09\u2500\u2500 */
  --femo-type-ai: #4A6FA5;           /* @ai */
  --femo-type-ai-bg: #DFE9F5;
  --femo-type-human: #4A7A5C;        /* @human */
  --femo-type-human-bg: #DFEDE3;
  --femo-type-mind: #A56A6A;         /* @mind */
  --femo-type-mind-bg: #F3E3E3;
  --femo-type-func: #997B3D;         /* @func */
  --femo-type-func-bg: #F2EAD8;
  --femo-type-assign: #7A6FAE;       /* @assign */
  --femo-type-assign-bg: #E9E5F5;
  --femo-type-notice: #5C8A75;       /* @notice \u516C\u544A\uFF08\u7070\u7EFF=\u65C1\u767D\u611F\uFF09 */
  --femo-type-notice-bg: #E3EFE8;
  --femo-special-par: #7A6FAE;       /* PAR \u7279\u6B8A\u8282\u70B9 */
  --femo-special-par-bg: #E9E5F5;

  /* \u2500\u2500 \u7279\u6B8A\u8282\u70B9\u5E95\u8272\uFF08round39 \u6D45\u8272 v2\uFF1A\u4E0E\u5176\u5B83\u8282\u70B9\u540C\u767D\u5E95\uFF0C\u7C7B\u578B\u8EAB\u4EFD\u8D70\u5F69\u8FB9\u5F69\u5B57\u2014\u2014\u6DF1\u8272\u5F69\u5E95\u767D\u5B57\u8BED\u8A00\u5728\u6D45\u8272\u7684\u5BF9\u5E94\u5F62\u6001\uFF09\u2500\u2500 */
  --femo-sp-start-bg: var(--femo-node-bg);
  --femo-sp-end-bg: var(--femo-node-bg);
  --femo-sp-break-bg: var(--femo-node-bg);
  --femo-sp-for-bg: var(--femo-node-bg);
  --femo-sp-par-bg: var(--femo-node-bg);

  /* \u2500\u2500 \u7279\u6B8A\u8282\u70B9\u5F69\u8FB9\u538B\u6697\u6DF7\u5408\u57FA\u8272\uFF08round41\uFF1A\u6D45\u8272\u57FA\u8272\u4ECE\u7EAF\u9ED1\u63D0\u4EAE\u5230\u4E2D\u7070\u2014\u201450% \u6DF7\u5408\u540E\u8272\u76F8\u6D6E\u51FA\uFF0C\u4E0D\u518D"\u5168\u9ED1"\uFF09\u2500\u2500 */
  --femo-node-border-mix-base: #8F8F8F;

  /* \u2500\u2500 \u79FB\u52A8\u7AEF\u58F3\uFF08round37 \u6309\u4E3B\u9898\u62C6\u5206\uFF1A\u9ED8\u8BA4\u5757=DSH \u6D45\u8272\u58F3\uFF0Cdsh-dark \u5757\u8986\u76D6\u6DF1\u8272\u58F3\uFF09\u2500\u2500 */
  --femo-mobile-bg: #ffffff;             /* \u58F3\u80CC\u666F\uFF08=\u6D45\u8272\u804A\u5929\u5E95 bg-base\uFF09 */
  --femo-mobile-bg-2: #F9FAFB;           /* \u58F3\u80CC\u666F 2\uFF08\u4FA7\u680F/\u9519\u8BEF\u58F3\uFF0Csidebar-fill\uFF09 */
  --femo-mobile-bg-3: #F1F3F5;           /* \u58F3\u80CC\u666F 3\uFF08\u9519\u8BEF\u5361\uFF0C\u5185\u5D4C\u7070\u5E95\uFF09 */
  --femo-mobile-surface: #F9FAFB;        /* \u58F3\u9762\u677F\uFF08sidebar-fill\uFF09 */
  --femo-mobile-surface-hover: #ECEEF1;  /* \u58F3\u9762\u677F hover */
  --femo-mobile-border: rgba(0,0,0,0.12);        /* \u58F3\u8FB9\u6846 */
  --femo-mobile-border-light: rgba(0,0,0,0.22);  /* \u58F3\u6D45\u8FB9\u6846\uFF08\u517C\u4F5C\u7A7A\u6001\u63D0\u793A\u6587\u5B57\u8272\uFF09 */
  --femo-mobile-border-strong: #ECEEF1;  /* \u58F3\u6DF1\u8FB9\u6846/\u6309\u94AE\u5E95 */
  --femo-mobile-text-1: #17191D;         /* \u58F3\u4E3B\u6587\u672C */
  --femo-mobile-text-2: #6A7077;         /* \u58F3\u6B21\u7EA7\u6587\u672C */
  --femo-mobile-text-2-alt: #45494F;     /* \u58F3\u6B21\u7EA7\u6587\u672C\u504F\u6DF1 */
  --femo-mobile-text-3: #9AA0A6;         /* \u58F3\u5F31\u6587\u672C */
  --femo-mobile-danger-soft: #FDECEC;    /* \u58F3\u5371\u9669\u5E95 */
  --femo-mobile-danger-border: #F5C6C6;  /* \u58F3\u5371\u9669\u8FB9\u6846 */
  --femo-mobile-mask: rgba(15,17,21,0.24);/* \u58F3\u5185\u906E\u7F69 */

  /* \u2500\u2500 FEMO \u9884\u89C8\u6761\uFF08round38 \u6309\u4E3B\u9898\u62C6\u5206\uFF1A\u9ED8\u8BA4\u5757=\u6D45\u8272\uFF0Cdsh-dark \u8986\u76D6\u6DF1\u8272\uFF09\u2500\u2500 */
  --femo-preview-bg: #ffffff;        /* \u9884\u89C8\u6761\u80CC\u666F */
  --femo-preview-bg-2: #F6F8FA;      /* \u884C\u53F7\u69FD\u80CC\u666F\uFF08\u6D45\u8272\u4EE3\u7801\u5E95\uFF09 */
  --femo-preview-text: #444C56;      /* \u9884\u89C8\u6587\u672C */
  --femo-preview-text-2: #8B949E;    /* \u9884\u89C8\u5F31\u6587\u672C */
  --femo-preview-border: rgba(0,0,0,0.12); /* \u5206\u9694\u8FB9 */

  /* \u2500\u2500 \u5F62\u72B6\uFF1A\u5706\u89D2\uFF08\u4E3B\u9898\u53EF\u6574\u4F53\u6362\u98CE\u683C\uFF1A\u5706\u6DA6/\u65B9\u6B63\uFF09\u2500\u2500 */
  --femo-radius-xs: 2px;                        /* \u5FAE\u578B\u5706\u89D2\uFF08\u624B\u673A\u7AEF\u5C0F\u6807\u7B7E\uFF09 */
  --femo-radius-sm: 6px;                        /* \u5C0F\u5706\u89D2\uFF084/5/6 \u5F52\u5E76\uFF09 */
  --femo-radius-md: 8px;                        /* \u4E2D\u5706\u89D2\uFF087/8 \u5F52\u5E76\uFF1A\u8F93\u5165\u6846/\u6309\u94AE/\u5361\u7247\uFF09 */
  --femo-radius-lg: 10px;                       /* \u5927\u5706\u89D2\uFF08\u8282\u70B9/\u5927\u9762\u677F\uFF09 */
  --femo-radius-xl: 16px;                       /* \u7279\u5927\u5706\u89D2\uFF0814/16/18 \u5F52\u5E76\uFF1A\u5F39\u7A97\uFF09 */
  --femo-radius-pill: 50%;                      /* \u5706\u5F62\uFF08\u7AEF\u53E3/\u72B6\u6001\u70B9/\u5F00\u5173\uFF09 */
  --femo-radius-top: 8px 8px 0 0;               /* \u5F39\u7A97\u9876\u90E8\u5706\u89D2\uFF08\u5E95\u90E8\u76F4\u89D2\uFF09 */
  --femo-radius-bubble: 10px 10px 10px 2px;     /* \u8282\u70B9\u72B6\u6001\u6C14\u6CE1 */

  /* \u2500\u2500 \u8FB9\u6846\u5BBD\u5EA6\uFF08\u4E3B\u9898\u53EF\u6574\u4F53\u6362\u7C97\u7EC6\uFF09\u2500\u2500 */
  --femo-border-w: 1px;              /* \u5E38\u89C4\u8FB9\u6846 */
  --femo-border-w-strong: 1.5px;     /* \u8F93\u5165\u6846/\u6309\u94AE\u8FB9\u6846 */
  --femo-border-w-selected: 2px;     /* \u9009\u4E2D/\u6FC0\u6D3B\u63CF\u8FB9\uFF082/2.5 \u5F52\u5E76\uFF09 */
  --femo-border-w-accent: 3px;       /* \u5DE6\u4FA7\u5F3A\u8C03\u8FB9\uFF08\u5217\u8868\u9009\u4E2D/\u9519\u8BEF\u6761\uFF09 */
  --femo-border-w-node: 4px;         /* \u8282\u70B9\u5DE6\u4FA7\u7C97\u8272\u6761 */

  /* \u2500\u2500 \u5B57\u4F53\u65CF\uFF08\u4E3B\u9898\u53EF\u6574\u4F53\u6362\u5B57\u4F53\uFF09\u2500\u2500 */
  --femo-font-sans: 'DM Sans', 'MiSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --femo-font-mono: 'JetBrains Mono', monospace;
  --femo-font-body: 'DM Sans', 'MiSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; /* \u72EC\u7ACB\u6A21\u5F0F body \u56DE\u9000\u5B57\u4F53 */

  /* \u2500\u2500 \u753B\u5E03\u80CC\u666F\uFF08\u4E3B\u9898\u53EF\u6362\u70B9\u9635/\u7F51\u683C/\u7EAF\u8272\uFF09\u2500\u2500 */
  --femo-canvas-dots: radial-gradient(circle, var(--femo-canvas-dot) 1.2px, transparent 1.2px);   /* \u684C\u9762\u753B\u5E03\u70B9\u9635\uFF08\u989C\u8272\u5D4C\u5957\u8054\u52A8\uFF09 */
  --femo-mobile-canvas-dots: none; /* \u624B\u673A\u58F3\u753B\u5E03\u70B9\u9635\uFF08round12\uFF1A\u7528\u6237\u62CD\u677F\u53BB\u6389\u2014\u2014\u684C\u9762\u6DF1\u8272\u4E0B\u70B9\u5DF2\u4E0D\u53EF\u89C1\uFF0C\u7EDF\u4E00\u65E0\u70B9\uFF09 */

  /* \u2500\u2500 \u9762\u677F\u5E95\u8272\uFF08\u8FB9\u680F/\u6807\u9898\u680F\u7B49 chrome\uFF1Bround27 \u5BF9\u9F50 dsh \u6D45\u8272 sidebar-fill bluish-50\uFF09\u2500\u2500 */
  --femo-panel-bg: #F9FAFB;                       /* \u6D45\u8272=\u5B98\u65B9 sidebar-fill */
  --femo-btn-primary: var(--femo-primary);         /* \u529F\u80FD\u6309\u94AE\u5E95\uFF08\u6D45\u8272=\u4E3B\u84DD\u5386\u53F2\u503C\uFF09 */

  /* \u2500\u2500 \u6EDA\u52A8\u6761 \u2500\u2500 */
  --femo-scrollbar-w: 8px;           /* \u6EDA\u52A8\u6761\u7C97\u7EC6 */

  /* \u2500\u2500 \u8282\u70B9\u9634\u5F71\uFF08round27 \u6D45\u8272\u540C\u6B65\uFF1A\u53CC\u5C42\u6D45\u7070\u5F71+\u767D\u5185\u9AD8\u5149\uFF0C\u4E0E\u6DF1\u8272\u53CC\u5C42\u5DE5\u827A\u5BF9\u5E94\uFF09\u2500\u2500 */
  --femo-node-shadow-rest: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.05), 0 6px 16px rgba(0,0,0,0.08);      /* action \u8282\u70B9\u5E38\u6001 */
  --femo-node-shadow-sel: inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 10px rgba(0,0,0,0.08), 0 14px 30px rgba(0,0,0,0.12);     /* action \u8282\u70B9\u9009\u4E2D */
  --femo-node-shadow-rest-sm: inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 4px rgba(0,0,0,0.06), 0 3px 10px rgba(0,0,0,0.07);   /* \u5C0F\u8282\u70B9\u5E38\u6001 */
  --femo-node-shadow-sel-sm: inset 0 1px 0 rgba(255,255,255,0.9), 0 3px 8px rgba(0,0,0,0.08), 0 10px 22px rgba(0,0,0,0.10);   /* \u5C0F\u8282\u70B9\u9009\u4E2D */

  /* \u2500\u2500 \u8282\u70B9\u8FB9\u6846\uFF08round29 \u6D45\u8272\u9ED1\u767D\u7248\uFF1A\u7EAF\u9ED1\u8FB9\u6846\uFF0C\u767D\u5E95\u4E0A\u5229\u843D\u9192\u76EE\uFF09\u2500\u2500 */
  --femo-node-border: rgba(10,10,10,0.85);
  --femo-node-border-w: 1.5px;
  --femo-node-bg: var(--femo-surface);             /* \u8282\u70B9\u8868\u9762\uFF08\u6D45\u8272=\u7EAF\u767D\uFF09 */

  /* \u2500\u2500 \u8FDE\u7EBF\uFF08round29 \u6D45\u8272\u9ED1\u767D\u7248 + round30 \u540C\u6B65\u7EC6\u5316\uFF09\u2500\u2500 */
  --femo-edge: #1c1c1c;                         /* \u5F3A\u8C03\u8FDE\u7EBF\u5E38\u6001\uFF08\u5FAA\u73AF/for/\u81EA\u73AF\uFF09\uFF1A\u8FD1\u7EAF\u9ED1 */
  --femo-edge-sel: #000000;                     /* \u8FDE\u7EBF\u9009\u4E2D\uFF1A\u7EAF\u9ED1 */
  --femo-edge-flow: #4a4a4a;                    /* \u666E\u901A\u987A\u5E8F\u8FB9\uFF1A\u6DF1\u7070\u9ED1 */
  --femo-edge-w: 1px;                           /* \u4E3B\u89C6\u56FE\u51E0\u4F55\u8FB9\u5BBD\uFF08round32\uFF1A\u6DF1\u6D45\u7EDF\u4E00\u7EC6\u7EBF\uFF09 */
  --femo-edge-w-thin: 0.85px;                   /* \u6A21\u5757\u89C6\u56FE/\u81EA\u73AF\u8FB9\u5BBD\uFF08\u7EDF\u4E00\u7EC6\u7EBF\uFF09 */
  --femo-edge-w-sel: 1.5px;                     /* \u9009\u4E2D\u8FB9\u5BBD\uFF08\u7EDF\u4E00\u7EC6\u7EBF\uFF09 */
  --femo-edge-sheen: #ffffff;                   /* \u6D41\u5149\u5149\u73E0\uFF1A\u7EAF\u767D\uFF08radialGradient \u7EAF\u767D\u2192\u900F\u660E\uFF0C\u6DF1\u6D45\u901A\u7528\uFF09 */

  /* \u2500\u2500 \u8282\u70B9\u7C7B\u578B\u5FBD\u7AE0\uFF08round27 \u6D45\u8272\u540C\u6B65\uFF1A\u7C89\u5F69\u83AB\u5170\u8FEA\u5E95+\u6DF1\u5B57\uFF0C\u4E0E\u6DF1\u8272\u5F69\u5E95\u767D\u5B57\u540C\u4E00\u8BED\u8A00\u4E0D\u540C\u660E\u5EA6\uFF09\u2500\u2500 */
  --femo-badge-bg-ai: var(--femo-type-ai-bg);
  --femo-badge-fg-ai: #3E5C94;
  --femo-badge-bg-human: var(--femo-type-human-bg);
  --femo-badge-fg-human: #3D664C;
  --femo-badge-bg-mind: var(--femo-type-mind-bg);
  --femo-badge-fg-mind: #8A5050;
  --femo-badge-bg-func: var(--femo-type-func-bg);
  --femo-badge-fg-func: #7A6535;
  --femo-badge-bg-assign: var(--femo-type-assign-bg);
  --femo-badge-fg-assign: #63598F;
  --femo-badge-bg-notice: var(--femo-type-notice-bg);
  --femo-badge-fg-notice: #47705D;
  --femo-badge-bg-module: var(--femo-tag-bg);
  --femo-badge-fg-module: var(--femo-on-accent);
}

/* \u2550\u2550 DSH \u7CFB\u4E3B\u9898\u5171\u4EAB\uFF1A\u5F62\u72B6/\u8FB9\u6846\u7C97\u7EC6/\u5B57\u4F53/\u6EDA\u52A8\u6761\uFF08\u6D45\u8272\u4E0E\u6DF1\u8272\u4E00\u81F4\uFF09\u2550\u2550 */
:root, [data-femo-theme] {
  /* \u2500\u2500 \u5F62\u72B6\uFF1A\u66F4\u6536\u655B\uFF08dsh \u7EC4\u4EF6\u4E3B\u5706\u89D2 8px\uFF09\u2500\u2500 */
  --femo-radius-lg: 8px;                  /* \u5927\u5706\u89D2\u6536\u5230 8px */
  --femo-radius-xl: 12px;                 /* \u5F39\u7A97 12px */
  --femo-radius-top: 12px 12px 0 0;
  --femo-radius-bubble: 8px 8px 8px 2px;
  /* xs 2 / sm 6 / md 8 / pill 50% \u4FDD\u6301\uFF08md \u6B63\u597D\u662F dsh \u4E3B\u5706\u89D2\uFF09 */

  /* \u2500\u2500 \u8FB9\u6846\u5BBD\u5EA6\uFF1A\u66F4\u7EC6\uFF08dsh \u5168\u90E8 1px\uFF09\u2500\u2500 */
  --femo-border-w-strong: 1px;
  --femo-border-w-selected: 1.5px;
  --femo-border-w-accent: 2px;
  --femo-border-w-node: 3px;

  /* \u2500\u2500 \u5B57\u4F53\uFF1ADM Sans\uFF08\u62C9\u4E01\uFF09+ MiSans\uFF08\u4E2D\u6587\uFF0Cround11 \u6362\u6389\u7CFB\u7EDF\u96C5\u9ED1\uFF09\u2500\u2500 */
  --femo-font-sans: 'DM Sans', 'MiSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --femo-font-mono: 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, Courier, 'PingFang SC', 'Microsoft YaHei';
  --femo-font-body: 'DM Sans', 'MiSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;

  /* \u2500\u2500 \u6EDA\u52A8\u6761 8px\uFF08dsh \u89C4\u8303\uFF09\u2500\u2500 */
  --femo-scrollbar-w: 8px;
}

/* \u2550\u2550 DSH \u6DF1\u8272\u4E3B\u9898\uFF1Adsh \u672C\u4F53\u9ED1\u591C\u8BBE\u8BA1\u8BED\u8A00 \u2550\u2550
   \u53D6\u503C\u6765\u6E90\uFF1Adesign-platform.css body[data-ds-dark-theme] alias \u8BED\u4E49\u6620\u5C04\u3002
   \u8BBE\u8BA1\u539F\u5219\uFF1A\u80CC\u666F\u7528 bluish \u6DF1\u8272\u5C42\u7EA7\uFF1B\u9009\u4E2D/\u60AC\u505C\u7528\u767D\u57FA\u8272\u9636\uFF08dsh dark interactive\uFF09\uFF1B
   \u8BED\u4E49 tertiary \u7528 dsh dark \u7684\u6697 hue-mixed \u5E95\uFF08deepseek-800/green-900/amber-900\uFF09\u3002 */
[data-femo-theme="dsh-dark"] {
  /* \u2500\u2500 \u80CC\u666F\uFF1Adsh dark bluish \u5C42\u7EA7\uFF08\u753B\u5E03\u6700\u6DF1 \u2192 \u9762\u677F\u9010\u7EA7\u63D0\u4EAE\uFF09\u2500\u2500 */
  --femo-app-bg: #151517;                 /* bluish-950 bg-base */
  --femo-surface: #232324;                /* bluish-875 layer-1 */
  --femo-bg: #2c2c2e;                     /* bluish-850 layer-2 */
  --femo-bg-2: #353638;                   /* bluish-800 layer-3 */
  --femo-bg-hover: #43454a;               /* bluish-750 */

  /* \u2500\u2500 \u4E3B\u8272\uFF1Adeepseek-400\uFF08dsh dark \u4E1A\u52A1\u4E3B\u8272\uFF09\u2500\u2500 */
  --femo-primary: #679efe;                /* deepseek-400 */
  --femo-primary-strong: #5686fe;         /* deepseek-450 */
  --femo-primary-soft: #34415b;           /* deepseek-800\uFF08dsh business-tertiary\uFF1A\u6697\u84DD\u9009\u4E2D\u5E95\uFF09*/
  --femo-primary-soft-2: #243b5e;  /* \u5B9E\u8272\u6697\u84DD\uFF1A\u6D41\u5F0F\u6C14\u6CE1\u5E95 / \u5DE5\u5177\u680F\u6FC0\u6D3B\u6309\u94AE\u5E95\uFF08\u4E0D\u900F\u660E\uFF0C\u6DF1\u5E95\u6E05\u6670\uFF09*/
  --femo-primary-soft-faint: rgba(255,255,255,0.05);
  --femo-primary-glow-weak: rgba(103,158,254,0.15);
  --femo-primary-glow: rgba(103,158,254,0.3);
  --femo-primary-glow-strong: rgba(103,158,254,0.45);
  --femo-primary-glow-x: rgba(103,158,254,0.65);
  --femo-primary-overlay: rgba(103,158,254,0.9);

  /* \u2500\u2500 \u5371\u9669\uFF1Ared-400 \u4EAE\u7EA2 \u2500\u2500 */
  --femo-danger: #f25a5a;                 /* red-400 error-primary */
  --femo-danger-weak: rgba(242,90,90,0.85);
  --femo-danger-strong: #f87171;
  --femo-danger-soft: #3d2024;            /* \u5B9E\u8272\u6697\u7EA2\uFF1A\u9519\u8BEF\u5E95\uFF08\u539F alpha 0.14 \u592A\u900F\uFF09*/
  --femo-danger-soft-2: #4a2328;          /* \u5B9E\u8272\u6697\u7EA2 2 */
  --femo-danger-border: rgba(242,90,90,0.35);
  --femo-danger-glow-weak: rgba(242,90,90,0.15);
  --femo-danger-glow: rgba(242,90,90,0.3);
  --femo-danger-glow-strong: rgba(242,90,90,0.5);

  /* \u2500\u2500 \u8B66\u544A\uFF1Aamber\uFF08tertiary \u7528 amber-900 \u6697\u5E95\uFF09\u2500\u2500 */
  --femo-warning: #f59e0b;                /* amber-500 */
  --femo-warning-strong: #f7ad31;         /* amber-400 */
  --femo-warning-soft: #75603A;           /* \u83AB\u5170\u8FEA\u63D0\u4EAE\u7248\u7070\u9A7C\uFF08round15\uFF0C\u4E0E func \u5E95\u540C\u65CF\uFF09*/
  --femo-warning-border: rgba(245,158,11,0.35);

  /* \u2500\u2500 \u6210\u529F\uFF1Agreen\uFF08tertiary \u7528 green-900 \u6697\u5E95\uFF09\u2500\u2500 */
  --femo-success: #22c55e;                /* green-500 */
  --femo-success-strong: #4ed17e;         /* green-400 */
  --femo-success-text: #4ed17e;
  --femo-success-soft: #3E6B4E;           /* \u83AB\u5170\u8FEA\u63D0\u4EAE\u7248\u7070\u7EFF\uFF08round15\uFF0C\u4E0E human \u5E95\u540C\u65CF\uFF09*/

  /* \u2500\u2500 \u6587\u672C\uFF1A\u6DF1\u5E95\u4EAE\u5B57 \u2500\u2500 */
  --femo-text-1: #f9fafb;                 /* bluish-50 primary */
  --femo-text-2: #cfd3d6;                 /* bluish-300 secondary */
  --femo-text-2-alt: #979da6;             /* bluish-500\uFF08\u504F\u7070\u6B21\u7EA7\uFF09*/
  --femo-text-3: #adb2b8;                 /* bluish-400 */
  --femo-text-4: #81858c;                 /* bluish-600 caption */
  --femo-text-4-weak: #61666b;            /* bluish-700 */
  --femo-neutral: #979da6;                /* bluish-500 */
  --femo-neutral-faint: rgba(255,255,255,0.06);
  --femo-neutral-border: rgba(255,255,255,0.2);

  /* \u2500\u2500 \u8FB9\u6846\uFF1Adsh dark \u767D rgba \u5C42\u7EA7 \u2500\u2500 */
  --femo-border: rgba(255,255,255,0.12);  /* l2 */
  --femo-border-strong: rgba(255,255,255,0.16);  /* l3 */
  --femo-tag-bg: #43454a;                 /* bluish-750 */
  --femo-tag-bg-faint: rgba(67,69,74,0.4);
  --femo-scrollbar: #3c3c3d;              /* neutral-700 */
  /* \u7EC6\u8FB9\u7EBF\u8986\u76D6\uFF1A\u4ED3\u5E93\u5361\u7247/\u8282\u70B9\u5DE6\u4FA7\u5F3A\u8C03\u8FB9\u6536\u7A84\u5230 1px\uFF08\u7C97\u8272\u6761\u5728\u6697\u5E95\u523A\u773C\uFF09*/
  --femo-border-w-accent: 1px;
  --femo-border-w-node: 1px;

  /* \u2500\u2500 \u906E\u7F69 / \u9634\u5F71 \u2500\u2500 */
  --femo-mask-soft: rgba(0,0,0,0.5);      /* mask-1 */
  --femo-mask: rgba(0,0,0,0.6);
  --femo-mask-heavy: rgba(0,0,0,0.7);
  --femo-mask-blue: rgba(0,0,0,0.6);
  --femo-shadow-sm: rgba(0,0,0,0.2);
  --femo-shadow-md: rgba(0,0,0,0.3);
  --femo-shadow-lg: rgba(0,0,0,0.45);
  --femo-shadow-xl: rgba(0,0,0,0.6);
  --femo-shadow-blue: rgba(0,0,0,0.2);

  /* \u2500\u2500 \u753B\u5E03\u70B9\u9635\uFF1A\u767D\u8272\u534A\u900F\u660E\uFF08round50 \u63D0\u4EAE\u56DE\u53EF\u89C1\u6863\uFF1A0.07 \u65F6\u5728 #151517 \u4E0A\u8089\u773C\u4E0D\u53EF\u89C1\uFF09\u2500\u2500 */
  --femo-canvas-dot: rgba(255,255,255,0.18);

  /* \u2500\u2500 \u89D2\u8272\u8272\uFF1A\u83AB\u5170\u8FEA\u63D0\u4EAE\u7248\uFF08round15\uFF1A\u7528\u6237\u53CD\u9988\u8FC7\u7070\uFF0C\u6574\u4F53\u62C9\u8D77\u9971\u548C/\u660E\u5EA6\uFF1B\u4ECD\u6210\u5BF9\u540C\u65CF\uFF09\u2500\u2500 */
  --femo-type-ai: #8FB8F0;
  --femo-type-ai-bg: #3E5C94;             /* \u84DD\uFF08\u62C9\u8D77\uFF09 */
  --femo-type-human: #85D6A8;
  --femo-type-human-bg: #3E6B4E;          /* \u7EFF\uFF08\u62C9\u8D77\uFF09 */
  --femo-type-mind: #EDA3A3;
  --femo-type-mind-bg: #744949;           /* \u73AB\u7470\uFF08\u62C9\u8D77\uFF09 */
  --femo-type-func: #EDBE72;
  --femo-type-func-bg: #75603A;           /* \u9A7C\u91D1\uFF08\u62C9\u8D77\uFF09 */
  --femo-type-assign: #B4A5EC;
  --femo-type-assign-bg: #5C5190;         /* \u7D2B\uFF08\u62C9\u8D77\uFF09 */
  --femo-type-notice: #A8D8BC;
  --femo-type-notice-bg: #4A6B58;         /* \u7070\u7EFF\uFF08\u62C9\u8D77\uFF09 */
  --femo-special-par: #B4A5EC;
  --femo-special-par-bg: #5C5190;

  /* \u2500\u2500 \u7279\u6B8A\u8282\u70B9\u5E95\u8272\uFF08round20\uFF1A\u56DE\u5F52\u4E0E\u5176\u5B83\u8282\u70B9\u540C\u5E95\u8272\uFF08node-bg\uFF09\uFF0C\u7C7B\u578B\u8EAB\u4EFD\u6539\u7531\u5F69\u8272\u8FB9\u6846\u627F\u8F7D\uFF09\u2500\u2500 */
  --femo-sp-start-bg: var(--femo-node-bg);
  --femo-sp-end-bg: var(--femo-node-bg);
  --femo-sp-break-bg: var(--femo-node-bg);
  --femo-sp-for-bg: var(--femo-node-bg);
  --femo-sp-par-bg: var(--femo-node-bg);

  /* \u2500\u2500 \u7279\u6B8A\u8282\u70B9\u5F69\u8FB9\u538B\u6697\u6DF7\u5408\u57FA\u8272\uFF08round39\uFF1A\u6DF1\u8272=\u8868\u9762\u5E95\uFF0C\u7EF4\u6301\u65E2\u5B9A\u538B\u6697\u6863\uFF09\u2500\u2500 */
  --femo-node-border-mix-base: var(--femo-node-bg);

  /* \u2500\u2500 \u79FB\u52A8\u7AEF\u58F3\uFF08round37\uFF1A\u6DF1\u8272\u58F3\u8986\u76D6\u2014\u2014\u4FDD\u6301\u4E2D\u6027\u9ED1\u89C2\u611F\u4E0D\u53D8\uFF09\u2500\u2500 */
  --femo-mobile-bg: #151517;
  --femo-mobile-bg-2: #1b1b1c;
  --femo-mobile-bg-3: #232324;
  --femo-mobile-surface: #1b1b1c;
  --femo-mobile-surface-hover: #232324;
  --femo-mobile-border: rgba(255,255,255,0.12);
  --femo-mobile-border-light: rgba(255,255,255,0.16);
  --femo-mobile-border-strong: #2c2c2e;
  --femo-mobile-text-1: #f9fafb;
  --femo-mobile-text-2: #979da6;
  --femo-mobile-text-2-alt: #cfd3d6;
  --femo-mobile-text-3: #61666b;
  --femo-mobile-mask: rgba(21,21,23,0.8);

  /* \u2500\u2500 FEMO \u9884\u89C8\u6761\uFF08round38\uFF1A\u6DF1\u8272\u8986\u76D6\u2014\u2014\u4FDD\u6301\u539F\u6DF1\u8272\u4EE3\u7801\u6761\u89C2\u611F\uFF09\u2500\u2500 */
  --femo-preview-bg: #151517;
  --femo-preview-bg-2: #1b1b1c;
  --femo-preview-text: #adb2b8;
  --femo-preview-text-2: #61666b;
  --femo-preview-border: rgba(255,255,255,0.12);

  /* \u2500\u2500 \u753B\u5E03\u70B9\u9635\uFF1A\u4E0E\u6D45\u8272\u540C\u6784\uFF08\u5D4C\u5957\u8054\u52A8 + \u540C 1.2px \u534A\u5F84\uFF1Bround50 \u4ECE 0.6px \u6062\u590D\u2014\u2014round2 \u6536\u5C0F\u540E\u6DF1\u8272\u70B9\u4E0D\u53EF\u89C1\uFF09\u2500\u2500 */
  --femo-canvas-dots: radial-gradient(circle, var(--femo-canvas-dot) 1.2px, transparent 1.2px);

  /* \u2500\u2500 \u8282\u70B9\u8FB9\u6846\uFF08round10\uFF1A\u91D1\u8272\u8C03\u663E\u8457\u8FB9\u6846\uFF0C\u4E0E\u9ED1\u91D1\u8FDE\u7EBF\u547C\u5E94\uFF1B\u9009\u4E2D\u4ECD\u53D8\u7C7B\u578B\u8272\uFF09\u2500\u2500 */
  --femo-node-border: rgba(240,210,120,0.35);
  --femo-node-border-w: 1px;
  --femo-node-bg: #252528;                        /* \u8868\u9762\u63D0\u534A\u6863\uFF1A\u5728 #151517 \u753B\u5E03\u4E0A figure-ground \u5206\u79BB\u66F4\u6E05\u695A */

  /* \u2500\u2500 \u9762\u677F\u5E95\u8272\uFF08round12\uFF1A\u8FB9\u680F/\u6807\u9898\u680F/\u53F3\u680F\u5BF9\u9F50 dsh sidebar-fill bluish-900\uFF1B\u753B\u5E03 app-bg \u5DF2\u662F bg-base=\u804A\u5929\u5E95\u8272\uFF09\u2500\u2500 */
  --femo-panel-bg: #1b1b1c;

  /* \u2500\u2500 \u529F\u80FD\u6309\u94AE\u5E95\u8272\uFF08round20\uFF1Adsh \u5B98\u65B9\u6DF1\u8272\u529F\u80FD\u94AE\u5B9E\u4E3A deepseek-500 #4176e6 \u54C1\u724C\u6DF1\u84DD\u2014\u2014
      \u89C1 ui-conversation InputBar\u300C#3964FE light / #679EFE dark\u300D\u6CE8\u91CA\u4E0E ChatView \u72B6\u6001\u6E10\u53D8\u7528 500\uFF1B
      \u7528\u6237\u786E\u8BA4 400 \u592A\u4EAE\uFF0C\u7EDF\u4E00\u843D 500\u3002\u9009\u4E2D\u6001/\u7126\u70B9\u4ECD\u7528 --femo-primary(400) \u4E0D\u53D7\u5F71\u54CD\uFF09\u2500\u2500 */
  --femo-btn-primary: #4176e6;

  /* \u2500\u2500 \u8282\u70B9\u9634\u5F71\uFF08round9\uFF1A\u53CC\u5C42\u6295\u5F71\u2014\u2014\u8FD1\u63A5\u89E6\u5F71+\u8FDC\u73AF\u5883\u5F71\uFF0C\u5361\u7247"\u5750"\u5728\u753B\u5E03\u4E0A\uFF09\u2500\u2500 */
  --femo-node-shadow-rest: inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.03), 0 2px 6px rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.38);
  --femo-node-shadow-sel: inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04), 0 4px 10px rgba(0,0,0,0.35), 0 16px 36px rgba(0,0,0,0.45);
  --femo-node-shadow-rest-sm: inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(255,255,255,0.03), 0 2px 10px rgba(0,0,0,0.35);
  --femo-node-shadow-sel-sm: inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.45);

  /* \u2500\u2500 \u8FDE\u7EBF\uFF1A\u9ED1\u91D1\u4E09\u6863\u5B9E\u8272\uFF08round30\uFF1A\u518D\u7EC6\u4E00\u6863+\u91D1\u518D\u4EAE\u4E00\u70B9\uFF0C\u8865\u507F\u7535\u8111\u7AEF zoom \u7F29\u653E\u7684\u6297\u952F\u9F7F\u53D8\u6697\uFF09\u2500\u2500 */
  --femo-edge: #ffd76b;                         /* \u5F3A\u8C03\u8FB9\uFF08\u5FAA\u73AF/for/\u81EA\u73AF\uFF09\uFF1A\u4EAE\u91D1 */
  --femo-edge-sel: #ffec9c;                     /* \u9009\u4E2D\uFF1A\u66F4\u4EAE\u91D1 */
  --femo-edge-flow: #e3c05e;                    /* \u666E\u901A\u987A\u5E8F\u8FB9\uFF1A\u91D1 */
  --femo-edge-w: 1px;
  --femo-edge-w-thin: 0.85px;
  --femo-edge-w-sel: 1.5px;
  --femo-edge-sheen: #ffffff;                   /* \u6D41\u5149\u5149\u73E0\uFF1A\u7EAF\u767D\uFF08radialGradient \u7EAF\u767D\u2192\u900F\u660E\uFF0C\u6DF1\u6D45\u901A\u7528\uFF09 */

  /* \u2500\u2500 \u7C7B\u578B\u5FBD\u7AE0\uFF1A\u5B98\u65B9 tertiary \u8BED\u8A00\u2014\u2014\u6697\u5E95 + \u4EAE\u5B57\uFF08\u53D6\u503C\u8054\u52A8\u4E0A\u65B9 type-* token\uFF09\u2500\u2500 */
  /* \u2500\u2500 \u8282\u70B9\u7C7B\u578B\u5FBD\u7AE0\uFF08round14 fg \u63D0\u767D\uFF1Bround15 \u968F\u8272\u677F\u62C9\u8D77\u5FAE\u8C03\u8272\u76F8\uFF09\u2500\u2500 */
  --femo-badge-bg-ai: var(--femo-type-ai-bg);          /* \u84DD\uFF08\u62C9\u8D77\uFF09 */
  --femo-badge-fg-ai: #CFE2FA;
  --femo-badge-bg-human: var(--femo-type-human-bg);    /* \u7EFF\uFF08\u62C9\u8D77\uFF09 */
  --femo-badge-fg-human: #D4F0E0;
  --femo-badge-bg-mind: var(--femo-type-mind-bg);
  --femo-badge-fg-mind: #FAD4D4;
  --femo-badge-bg-func: var(--femo-type-func-bg);
  --femo-badge-fg-func: #FAE8C2;
  --femo-badge-bg-assign: var(--femo-type-assign-bg);  /* \u7D2B\uFF08\u62C9\u8D77\uFF09 */
  --femo-badge-fg-assign: #DED7FA;
  --femo-badge-bg-notice: var(--femo-type-notice-bg);  /* \u7070\u7EFF\uFF08\u62C9\u8D77\uFF09 */
  --femo-badge-fg-notice: #D8F0E2;
  --femo-badge-bg-module: #43454a;                    /* bluish-750 */
  --femo-badge-fg-module: #cfd3d6;                    /* bluish-300 */

  /* \u6309\u94AE\u6587\u5B57\u4FDD\u6301\u767D\u5B57\uFF08\u4E3B\u8272\u4E3A\u4EAE\u84DD\uFF0C\u767D\u5B57\u5BF9\u6BD4\u53EF\u8BFB\uFF09\uFF1B\u79FB\u52A8\u58F3/\u9884\u89C8\u58F3\u4E3A\u56FA\u6709\u6DF1\u8272\u533A\uFF0C\u4FDD\u6301\u4E00\u81F4\u4E0D\u8986\u76D6 */
}


/* \u2550\u2550 \u6DF1\u8272\u4E3B\u9898\uFF08\u5360\u4F4D\uFF0C\u914D\u8272\u5F85\u540E\u7EED\u8BBE\u8BA1\uFF09\u2550\u2550
[data-femo-theme="dark"] {
  --femo-app-bg: ...;
  ...
}
*/

/* \u2550\u2550 \u91D1\u7EBF\u6D41\u5149\uFF08round30\uFF09\uFF1A\u771F\u6E10\u53D8\u5149\u73E0\u6CBF\u7BAD\u5934\u65B9\u5411\u6ED1\u884C\uFF0C\u6DF1\u6D45\u4E24\u6863\u91D1\u7EBF\u4E3B\u9898\u542F\u7528 \u2550\u2550
   \u5149\u73E0=radialGradient(\u7EAF\u767D\u2192\u900F\u660E) \u5706\u73E0 + SMIL animateMotion\uFF08\u7EC4\u4EF6\u4FA7\uFF09\uFF0C
   \u8FD9\u91CC\u53EA\u505A\u4E3B\u9898\u95E8\u63A7\uFF1A\u9ED8\u8BA4 opacity 0\uFF08\u672A\u70B9\u4EAE\u7684\u4E3B\u9898\u96F6\u5F71\u54CD\uFF09\u3002 */
.femo-edge-comet { opacity: 0; pointer-events: none; }
/* round29 \u8D77\u6DF1\u6D45\u4E24\u6863\u90FD\u542F\u7528\u6D41\u5149\u2014\u2014\u6DF1\u8272\u6696\u767D\u91D1\u5149\u3001\u6D45\u8272\u7EAF\u767D\u5149\u626B\u9ED1\u7EBF */
[data-femo-theme="dsh-dark"] .femo-edge-comet,
[data-femo-theme="dsh"] .femo-edge-comet { opacity: 1; }

/* \u2550\u2550 \u6D41\u5149\u63A8\u8FDB\uFF08round36 \u8865\u6302\uFF09\uFF1A\u516D\u5C42 dash \u5149\u5E26\u7684 dashoffset \u52A8\u753B \u2550\u2550
   288\u21920 \u9012\u51CF = \u6CBF\u8DEF\u5F84\u6B63\u5411\uFF08\u7BAD\u5934\u65B9\u5411\uFF09\u524D\u8FDB\uFF1B\u5404\u5C42 cycle \u5747 288\uFF0C
   \u5C42\u95F4 animationDelay\uFF08inline\uFF09\u505A\u5F57\u661F\u76F8\u4F4D\u5BF9\u9F50\u2014\u2014v9 \u8D77\u957F\u5C42\u6EDE\u540E\u3001\u524D\u7AEF\u5BF9\u9F50\uFF1A
   \u5F3A\u5149\u5728\u524D\u5982\u5F57\u5934\u3001\u5C3E\u5DF4\u5411\u540E\u6E10\u6DE1\uFF08\u8BE6\u89C1 FemoWorAuto.jsx SHIMMER_LAYERS \u6CE8\u91CA\uFF09\u3002 */
.femo-edge-comet-layer { animation: femoEdgeSweep 3.2s linear infinite; }
@keyframes femoEdgeSweep {
  from { stroke-dashoffset: 288; }
  to   { stroke-dashoffset: 0; }
}

/* \u2550\u2550 \u7279\u6B8A\u8282\u70B9\u6587\u5B57\uFF08round39 \u6309\u4E3B\u9898\u5206\u6D41\uFF09\uFF1A\u6DF1\u8272\u5F69\u5E95\u7528\u767D\u5B57\uFF1B\u6D45\u8272\u5F69\u8FB9\u7070\u5E95\u7528\u7C7B\u578B\u8272\u5B57\uFF08inline sc.c \u751F\u6548\uFF09\u2550\u2550 */
[data-femo-theme="dsh-dark"] .femo-special-label { color: var(--femo-on-accent) !important; }
`;

// ../../femoGen/src/common.jsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var ErrorBoundary = class extends import_react10.default.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          style: {
            padding: 30,
            fontFamily: "var(--femo-font-sans)",
            color: "var(--femo-danger)",
            background: "var(--femo-danger-soft)",
            minHeight: "100vh"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h2", { children: "\u53D1\u751F\u9519\u8BEF" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("pre", { style: { whiteSpace: "pre-wrap", fontSize: 13 }, children: this.state.error?.toString() }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { style: { marginTop: 16 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("summary", { children: "\u7EC4\u4EF6\u5806\u6808" }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("pre", { style: { fontSize: 11 }, children: this.state.errorInfo?.componentStack })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              "button",
              {
                onClick: () => this.setState({ error: null, errorInfo: null }),
                style: { marginTop: 16, padding: "8px 16px" },
                children: "\u91CD\u8BD5"
              }
            )
          ]
        }
      );
    }
    return this.props.children;
  }
};
var FontStyle = ({ scoped = false }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("style", { children: `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    /* MiSans\uFF08\u5C0F\u7C73\uFF0C\u514D\u8D39\u5546\u7528\uFF09\uFF1A\u4E2D\u6587\u4E3B\u5B57\u4F53\uFF0Cunicode-range \u5B50\u96C6\u6309\u9700\u52A0\u8F7D\uFF1B\u5B57\u91CD\u4E3A\u5B98\u65B9\u65B0\u523B\u5EA6 330-700\u3002
       round12\uFF1A\u53BB\u6389 Heavy\u2014\u2014\u7528\u6237\u53CD\u9988\u52A0\u7C97\u4E2D\u6587\u592A\u7C97\uFF0C800/900 \u5C31\u8FD1\u843D\u5230 Bold(630)\u3002 */
    @import url('https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Regular.min.css');
    @import url('https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Medium.min.css');
    @import url('https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Demibold.min.css');
    @import url('https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Semibold.min.css');
    @import url('https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/MiSans-Bold.min.css');
    ${THEME_CSS}
    ${scoped ? "" : "* { box-sizing: border-box; }\n    body { margin: 0; }"}
    ::-webkit-scrollbar { width: var(--femo-scrollbar-w); height: var(--femo-scrollbar-w); }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--femo-scrollbar); border-radius: 3px; }
    input:focus, textarea:focus, select:focus { border-color: var(--femo-primary) !important; box-shadow: 0 0 0 3px var(--femo-primary-glow-weak) !important; }
    /* \u7A84\u89C6\u53E3\uFF08\u624B\u673A\uFF09\uFF1AiOS Safari \u5BF9 <16px \u8F93\u5165\u63A7\u4EF6\u805A\u7126\u4F1A\u6574\u9875\u81EA\u52A8\u653E\u5927\uFF1B
       \u805A\u7126\u65F6\u4E34\u65F6\u63D0\u5230 16px \u6291\u5236\u7F29\u653E\uFF08meta user-scalable \u81EA iOS 10 \u8D77\u88AB\u5FFD\u7565\uFF0C
       \u8FD9\u662F\u552F\u4E00\u53EF\u9760\u8DEF\u5F84\uFF09\uFF0C\u5931\u7126\u81EA\u52A8\u6062\u590D\u3002\u4EC5\u9650 femoGen \u5BB9\u5668\uFF08data-femo-theme\uFF09\u3002 */
    @media (max-width: 767px) {
      [data-femo-theme] input:focus, [data-femo-theme] textarea:focus, [data-femo-theme] select:focus { font-size: 16px !important; }
    }
    .node-drag { cursor: grabbing !important; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    @keyframes nodeGlow {
      0%, 100% { box-shadow: 0 0 8px 2px var(--femo-primary-glow), 0 0 16px 4px var(--femo-primary-glow-weak); }
      50% { box-shadow: 0 0 16px 6px var(--femo-primary-glow-strong), 0 0 32px 10px var(--femo-primary-glow); }
    }
    @keyframes nodeGlowError {
      0%, 100% { box-shadow: 0 0 8px 2px var(--femo-danger-glow), 0 0 16px 4px var(--femo-danger-glow-weak); }
      50% { box-shadow: 0 0 16px 6px var(--femo-danger-glow-strong), 0 0 32px 10px var(--femo-danger-glow); }
    }
    .streaming-cursor { animation: blink 0.8s infinite; font-weight: bold; color: var(--femo-primary-strong); }
    /* \u684C\u9762\u7AEF\u5E95\u90E8\u4E09\u952E\uFF082026-09-08\uFF09\uFF1A\u4E0E\u624B\u673A\u7AEF\u8BBE\u7F6E\u4E09\u952E\u540C\u65CF\u7684\u53CD\u9988\u8BED\u8A00\u2014\u2014hover \u63D0\u4EAE
       \uFF08accent \u5FAE\u5E95 + \u8FB9\u6846\u70B9\u4EAE\uFF09\uFF0C\u6309\u538B\u56DE\u7F29\u3002transition \u7531\u6309\u94AE\u5185\u8054 all 0.12s \u627F\u62C5\u3002 */
    .femo-setting-btn:hover {
      background: color-mix(in srgb, var(--femo-primary) 8%, var(--femo-bg));
      border-color: color-mix(in srgb, var(--femo-primary) 35%, var(--femo-border-strong));
      color: var(--femo-text-1);
    }
    .femo-setting-btn:active {
      transform: scale(0.98);
      filter: brightness(1.12);
    }
  ` });
var NW = 100;
var NH = 56;
var MW = 110;
var MH = 66;
var SPW = 90;
var SPH = 36;
var PSW = 90;
var PSH = 36;
var TYPES = [
  { t: "ai", lbl: "@ai", c: "var(--femo-primary-strong)", bg: "var(--femo-type-ai-bg)" },
  { t: "human", lbl: "@human", c: "var(--femo-type-human)", bg: "var(--femo-success-soft)" },
  { t: "mind", lbl: "@mind", c: "var(--femo-type-mind)", bg: "var(--femo-type-mind-bg)" },
  { t: "func", lbl: "@func", c: "var(--femo-type-func)", bg: "var(--femo-warning-soft)" },
  { t: "assign", lbl: "@assign", c: "var(--femo-type-assign)", bg: "var(--femo-type-assign-bg)" },
  { t: "notice", lbl: "@notice", c: "var(--femo-type-notice)", bg: "var(--femo-type-notice-bg)" }
];
var ti = (t) => TYPES.find((x) => x.t === t) || TYPES[0];
var SPECIAL_COLORS = {
  START: { c: "var(--femo-success-strong)", bg: "var(--femo-sp-start-bg)" },
  END: { c: "var(--femo-danger)", bg: "var(--femo-sp-end-bg)" },
  IN: { c: "var(--femo-success-strong)", bg: "var(--femo-sp-start-bg)" },
  OUT: { c: "var(--femo-danger)", bg: "var(--femo-sp-end-bg)" },
  BREAK: { c: "var(--femo-warning)", bg: "var(--femo-sp-break-bg)" },
  FOR: { c: "var(--femo-primary-strong)", bg: "var(--femo-sp-for-bg)" },
  PAR: { c: "var(--femo-special-par)", bg: "var(--femo-sp-par-bg)" }
};
var SINK_ONLY = /* @__PURE__ */ new Set(["END", "OUT", "BREAK"]);
var _n = 0;
var _e = 0;
var _a = 0;
var _m = 0;
var nid = () => `n${++_n}`;
var eid = () => `e${++_e}`;
var aid = () => `a${++_a}`;
var mid = () => `m${++_m}`;
var actionId = (path, name) => `a:${path.join("/")}:${name}`;
function getNodeSize(node) {
  if (node.type === "special") return { w: SPW, h: SPH };
  if (node.type === "for_out") return { w: 22, h: 22 };
  if (node.type === "par_out") return { w: SPW, h: SPH };
  if (node.type === "module") return { w: MW, h: MH };
  if (node.type === "position") return { w: PSW, h: PSH };
  return { w: NW, h: NH };
}
function getSmartPorts(srcNode, tgtNode, preferDifferent = false, occupiedSrcDirs = /* @__PURE__ */ new Set(), occupiedTgtDirs = /* @__PURE__ */ new Set()) {
  const ss = getNodeSize(srcNode);
  const ts = getNodeSize(tgtNode);
  const srcCx = srcNode.x + ss.w / 2;
  const srcCy = srcNode.y + ss.h / 2;
  const tgtCx = tgtNode.x + ts.w / 2;
  const tgtCy = tgtNode.y + ts.h / 2;
  const srcPorts = [
    { dir: "top", x: srcCx, y: srcNode.y },
    { dir: "bottom", x: srcCx, y: srcNode.y + ss.h },
    { dir: "left", x: srcNode.x, y: srcCy },
    { dir: "right", x: srcNode.x + ss.w, y: srcCy }
  ];
  const tgtPorts = [
    { dir: "top", x: tgtCx, y: tgtNode.y },
    { dir: "bottom", x: tgtCx, y: tgtNode.y + ts.h },
    { dir: "left", x: tgtNode.x, y: tgtCy },
    { dir: "right", x: tgtNode.x + ts.w, y: tgtCy }
  ];
  const allSrcFull = occupiedSrcDirs.size >= 4;
  const allTgtFull = occupiedTgtDirs.size >= 4;
  const pairs = [];
  for (const sp of srcPorts) {
    for (const tp of tgtPorts) {
      const dx = sp.x - tp.x;
      const dy = sp.y - tp.y;
      pairs.push({
        sp,
        tp,
        dist: dx * dx + dy * dy,
        srcDir: sp.dir,
        tgtDir: tp.dir
      });
    }
  }
  pairs.forEach((p) => {
    const srcPenalty = allSrcFull || !occupiedSrcDirs.has(p.srcDir) ? 0 : 1;
    const tgtPenalty = allTgtFull || !occupiedTgtDirs.has(p.tgtDir) ? 0 : 1;
    p.score = srcPenalty + tgtPenalty;
  });
  pairs.sort((a, b) => a.score - b.score || a.dist - b.dist);
  const best = pairs[0];
  if (preferDifferent && pairs.length > 1) {
    for (const p of pairs) {
      if (p.srcDir !== best.srcDir || p.tgtDir !== best.tgtDir) {
        return {
          srcPort: { x: p.sp.x, y: p.sp.y },
          tgtPort: { x: p.tp.x, y: p.tp.y },
          srcDir: p.srcDir,
          tgtDir: p.tgtDir
        };
      }
    }
  }
  return {
    srcPort: { x: best.sp.x, y: best.sp.y },
    tgtPort: { x: best.tp.x, y: best.tp.y },
    srcDir: best.srcDir,
    tgtDir: best.tgtDir
  };
}
function getControlPoints(x1, y1, dir1, x2, y2, dir2) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const offset = Math.max(40, Math.min(dist * 0.4, 120));
  let cx1 = x1, cy1 = y1, cx2 = x2, cy2 = y2;
  switch (dir1) {
    case "right":
      cx1 = x1 + offset;
      break;
    case "left":
      cx1 = x1 - offset;
      break;
    case "bottom":
      cy1 = y1 + offset;
      break;
    case "top":
      cy1 = y1 - offset;
      break;
  }
  switch (dir2) {
    case "left":
      cx2 = x2 - offset;
      break;
    case "right":
      cx2 = x2 + offset;
      break;
    case "top":
      cy2 = y2 - offset;
      break;
    case "bottom":
      cy2 = y2 + offset;
      break;
  }
  return { p0: { x: x1, y: y1 }, p1: { x: cx1, y: cy1 }, p2: { x: cx2, y: cy2 }, p3: { x: x2, y: y2 } };
}
function smartBezier(x1, y1, dir1, x2, y2, dir2) {
  const { p0, p1, p2, p3 } = getControlPoints(x1, y1, dir1, x2, y2, dir2);
  return `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
}
function bezierMidpoint(x1, y1, dir1, x2, y2, dir2) {
  const { p0, p1, p2, p3 } = getControlPoints(x1, y1, dir1, x2, y2, dir2);
  return {
    x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
    y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8
  };
}
function applyPortOffset(port, dir, nodeObj, edgeId, portEdgeGroupMap) {
  if (!port) return port;
  if (nodeObj && nodeObj.type === "for_out") return port;
  const key = `${nodeObj.id}:${dir}`;
  const group = portEdgeGroupMap[key];
  if (!group || group.count <= 1) return port;
  const idx = group.indices[edgeId] ?? 0;
  const total = group.count;
  const gap = 6;
  const offsetAmount = (idx - (total - 1) / 2) * gap;
  if (dir === "top" || dir === "bottom") {
    return { x: port.x + offsetAmount, y: port.y };
  }
  return { x: port.x, y: port.y + offsetAmount };
}
function generateParallelPorts(port, dir, count, gap) {
  if (!port || port.x == null || port.y == null) return [];
  if (count <= 1) return [port];
  const result = [];
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * gap;
    if (dir === "top" || dir === "bottom") {
      result.push({ x: port.x + off, y: port.y });
    } else {
      result.push({ x: port.x, y: port.y + off });
    }
  }
  return result;
}
function computeEdgeGeometry(edge, srcNode, tgtNode, options) {
  const {
    isCycleEdge = false,
    isParEdge = false,
    parLineCount = 5,
    parGap = 6,
    portEdgeGroupMap = {}
  } = options;
  let { srcPort, tgtPort, srcDir, tgtDir } = getSmartPorts(srcNode, tgtNode, isCycleEdge);
  if (srcNode.type === "for_out") {
    srcPort = { x: srcNode.x + 11, y: srcNode.y + 11 };
    srcDir = "center";
  }
  if (tgtNode.type === "for_out") {
    tgtPort = { x: tgtNode.x + 11, y: tgtNode.y + 11 };
    tgtDir = "center";
  }
  const adjustedSrcPort = applyPortOffset(srcPort, srcDir, srcNode, edge.id, portEdgeGroupMap);
  const adjustedTgtPort = applyPortOffset(tgtPort, tgtDir, tgtNode, edge.id, portEdgeGroupMap);
  const srcPorts = isParEdge ? generateParallelPorts(adjustedSrcPort, srcDir, parLineCount, parGap) : [adjustedSrcPort].filter((p) => p && p.x != null && p.y != null);
  const tgtPorts = isParEdge ? generateParallelPorts(adjustedTgtPort, tgtDir, parLineCount, parGap) : [adjustedTgtPort].filter((p) => p && p.x != null && p.y != null);
  if (srcPorts.length === 0 || tgtPorts.length === 0) {
    return null;
  }
  const pathDs = srcPorts.map((sp, i) => {
    const tp = tgtPorts[i];
    return smartBezier(sp.x, sp.y, srcDir, tp.x, tp.y, tgtDir);
  });
  const midIdx = isParEdge ? Math.floor(parLineCount / 2) : 0;
  const midSrc = srcPorts[midIdx];
  const midTgt = tgtPorts[midIdx];
  const labelPos = bezierMidpoint(midSrc.x, midSrc.y, srcDir, midTgt.x, midTgt.y, tgtDir);
  return {
    pathDs,
    labelPos,
    srcPorts,
    tgtPorts,
    midIdx,
    srcDir,
    tgtDir
  };
}
function findBackEdges(nodes, edges) {
  const adj = /* @__PURE__ */ new Map();
  edges.forEach((e) => {
    if (!adj.has(e.src)) adj.set(e.src, []);
    adj.get(e.src).push(e);
  });
  const vis = /* @__PURE__ */ new Set(), stk = /* @__PURE__ */ new Set(), back = /* @__PURE__ */ new Set();
  function dfs(id) {
    vis.add(id);
    stk.add(id);
    for (const e of adj.get(id) || []) {
      if (!vis.has(e.tgt)) dfs(e.tgt);
      else if (stk.has(e.tgt)) back.add(e.id);
    }
    stk.delete(id);
  }
  const entryNodes = nodes.filter(
    (n) => n.type === "special" && (n.specialType === "START" || n.specialType === "IN")
  );
  if (entryNodes.length === 0) {
    console.warn("[findBackEdges] \u672A\u627E\u5230\u5165\u53E3\u8282\u70B9 (START/IN), \u8FD4\u56DE\u7A7A back \u96C6\u5408\u3002nodes:", nodes.map((n) => `${n.id}:${n.type}:${n.specialType || ""}`));
  } else {
    entryNodes.forEach((n) => {
      if (!vis.has(n.id)) dfs(n.id);
    });
  }
  return back;
}
function findAllCycleEdges(nodes, edges) {
  const adj = /* @__PURE__ */ new Map();
  edges.forEach((e) => {
    if (!adj.has(e.src)) adj.set(e.src, []);
    adj.get(e.src).push(e);
  });
  const forNodeIds = new Set(
    nodes.filter((n) => n.specialType === "FOR" || n.specialType === "PAR").map((n) => n.id)
  );
  const parOutTargetMap = /* @__PURE__ */ new Map();
  nodes.forEach((n) => {
    if (n.specialType === "PAR" && n.forOutNodeId) {
      parOutTargetMap.set(n.id, n.forOutNodeId);
    }
  });
  const cycleMap = /* @__PURE__ */ new Map();
  for (const startId of forNodeIds) {
    let dfs = function(currentId) {
      if (recStack.has(currentId)) {
        return;
      }
      recStack.add(currentId);
      for (const e of adj.get(currentId) || []) {
        if (visitedEdges.has(e.id)) continue;
        visitedEdges.add(e.id);
        pathEdges.push(e.id);
        const isCycle = e.tgt === startId || parOutTargetMap.has(startId) && parOutTargetMap.get(startId) != null && e.tgt === parOutTargetMap.get(startId);
        if (isCycle) {
          pathEdges.forEach((id) => collected.add(id));
        } else if (recStack.has(e.tgt)) {
          const beforeSize = collected.size;
          pathEdges.forEach((id) => collected.add(id));
        } else {
          dfs(e.tgt);
        }
        pathEdges.pop();
        visitedEdges.delete(e.id);
      }
      recStack.delete(currentId);
    };
    const visitedEdges = /* @__PURE__ */ new Set();
    const pathEdges = [];
    const collected = /* @__PURE__ */ new Set();
    const recStack = /* @__PURE__ */ new Set();
    dfs(startId);
    if (collected.size > 0) {
      cycleMap.set(startId, collected);
    }
  }
  return cycleMap;
}
var inp = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 10px",
  borderRadius: "var(--femo-radius-md)",
  border: "var(--femo-border-w-strong) solid var(--femo-border-strong)",
  fontSize: 12.5,
  color: "var(--femo-text-1)",
  background: "var(--femo-bg)",
  outline: "none",
  fontFamily: "var(--femo-font-sans)",
  transition: "border-color 0.15s, box-shadow 0.15s"
};
var btnP = {
  padding: "8px 16px",
  borderRadius: "var(--femo-radius-md)",
  background: "var(--femo-btn-primary)",
  color: "var(--femo-on-accent)",
  border: "none",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: "var(--femo-font-sans)",
  transition: "opacity 0.12s"
};
var btnS = {
  padding: "8px 16px",
  borderRadius: "var(--femo-radius-md)",
  background: "var(--femo-surface)",
  color: "var(--femo-text-2)",
  border: "var(--femo-border-w-strong) solid var(--femo-border-strong)",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: "var(--femo-font-sans)"
};
function F({ label, hint, children }) {
  return (
    // flex: 1 + minWidth: 0：并排字段（如 Version/Owner）在 flex 行里自动
    // 平分宽度；block 父级下 flex 属性不生效，单列布局不受影响。
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { marginBottom: 13, flex: 1, minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
        "div",
        {
          style: {
            fontSize: 11,
            fontWeight: 700,
            color: "var(--femo-text-3)",
            marginBottom: 5,
            display: "flex",
            alignItems: "center",
            gap: 5
          },
          children: [
            label,
            hint && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { fontWeight: 400, color: "var(--femo-text-4)", fontSize: 10.5 }, children: hint })
          ]
        }
      ),
      children
    ] })
  );
}
function PortCircle({ x, y, color, onMouseDown, onMouseUp, nodeId, portDir, portX, portY }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      "data-port-node": nodeId,
      "data-port-dir": portDir,
      "data-port-x": portX,
      "data-port-y": portY,
      onMouseDown: onMouseDown ? (e) => {
        e.stopPropagation();
        onMouseDown(e);
      } : void 0,
      onMouseUp: onMouseUp ? (e) => {
        e.stopPropagation();
        onMouseUp(e);
      } : void 0,
      style: {
        position: "absolute",
        left: x - 12,
        top: y - 12,
        width: 24,
        height: 24,
        borderRadius: "var(--femo-radius-pill)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "crosshair",
        zIndex: 30
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: {
        width: 14,
        height: 14,
        borderRadius: "var(--femo-radius-pill)",
        background: "var(--femo-surface)",
        border: `var(--femo-border-w-selected) solid ${color}`,
        pointerEvents: "none"
      } })
    }
  );
}
function PR({ k, v }) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { style: { display: "flex", gap: 8, fontSize: 11.5, marginBottom: 5 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: { color: "var(--femo-neutral)", minWidth: 48, flexShrink: 0 }, children: k }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "span",
      {
        style: {
          color: "var(--femo-text-1)",
          fontFamily: "var(--femo-font-mono)",
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        },
        children: v
      }
    )
  ] });
}
function makeDefaultNodes(mode) {
  if (mode === "mainflow") {
    return [
      {
        id: nid(),
        type: "special",
        specialType: "START",
        x: 80,
        y: 200,
        label: "[START]"
      },
      {
        id: nid(),
        type: "special",
        specialType: "END",
        x: 600,
        y: 200,
        label: "[END]"
      }
    ];
  }
  return [
    {
      id: nid(),
      type: "special",
      specialType: "IN",
      x: 80,
      y: 200,
      label: "[IN]"
    },
    {
      id: nid(),
      type: "special",
      specialType: "OUT",
      x: 600,
      y: 200,
      label: "[OUT]"
    }
  ];
}
function applyForLinkage(nodes, draggedNode, newX, newY) {
  return nodes.map((n) => {
    if (n.id === draggedNode.id) {
      return { ...n, x: newX, y: newY };
    }
    if (draggedNode.specialType === "FOR" && n.type === "for_out" && n.id === draggedNode.forOutNodeId) {
      return { ...n, x: newX + SPW - 22, y: newY + (SPH - 22) / 2 };
    }
    if (draggedNode.type === "for_out" && n.id === draggedNode.forNodeId) {
      return { ...n, x: newX - SPW + 22, y: newY - (SPH - 22) / 2 };
    }
    return n;
  });
}

// ../../femoGen/src/femoDiagnostics.js
var SEVERITY_ERROR = "error";
var SEVERITY_WARNING = "warning";
var LINE_TEXT_MAX = 120;
function clipLineText(text) {
  const s = String(text ?? "").replace(/\t/g, "    ").trim();
  if (s.length <= LINE_TEXT_MAX) return s;
  return s.slice(0, LINE_TEXT_MAX) + "\u2026";
}
function makeDiagnostic(severity, { line = null, lineText = "", message, where = "" } = {}) {
  return {
    severity,
    line: Number.isFinite(line) ? line : null,
    lineText: clipLineText(lineText),
    message: String(message || ""),
    where: String(where || "")
  };
}
function formatDiagnostic(d) {
  const where = d.where ? `${d.where} \u2192 ` : "";
  if (d.line != null) {
    const lineText = d.lineText ? ` "${d.lineText}"` : "";
    return `\u7B2C ${d.line} \u884C:${lineText} ${where}${d.message}`;
  }
  return `${where}${d.message}`;
}
var FEMOSyntaxError = class extends Error {
  constructor(diagnostics, header = "") {
    const body = diagnostics.map(
      (d, i) => diagnostics.length > 1 ? `  ${i + 1}. ${formatDiagnostic(d)}` : formatDiagnostic(d)
    ).join("\n");
    super(header ? `${header}
${body}` : body);
    this.name = "FEMOSyntaxError";
    this.diagnostics = diagnostics;
  }
};
function warningsFromThrowable(e) {
  const diags = e && e.diagnostics;
  if (!Array.isArray(diags)) return [];
  return diags.filter((d) => d && d.severity === SEVERITY_WARNING);
}
function createReporter() {
  const items = [];
  const push = (severity, message, opts) => {
    const d = makeDiagnostic(severity, { ...opts || {}, message });
    items.push(d);
    return d;
  };
  return {
    items,
    get warnings() {
      return items.filter((d) => d.severity === SEVERITY_WARNING);
    },
    get errors() {
      return items.filter((d) => d.severity === SEVERITY_ERROR);
    },
    hasErrors() {
      return items.some((d) => d.severity === SEVERITY_ERROR);
    },
    warning(message, opts) {
      return push(SEVERITY_WARNING, message, opts);
    },
    // 记录 error 但不抛（配合 throwIfErrors 做聚合计数报错）
    error(message, opts) {
      return push(SEVERITY_ERROR, message, opts);
    },
    // 记录 error 并立即中断解析（替代原 throw new Error）
    fail(message, opts) {
      push(SEVERITY_ERROR, message, opts);
      throw new FEMOSyntaxError([items[items.length - 1]]);
    },
    // 有 error 则聚合抛出（多条时 header 带计数；header 缺省给通用文案）
    throwIfErrors(header = "") {
      const errs = items.filter((d) => d.severity === SEVERITY_ERROR);
      if (errs.length === 0) return;
      const head = header ? errs.length > 1 ? `${header}\uFF08\u5171 ${errs.length} \u5904\uFF09\uFF1A` : `${header}\uFF1A` : errs.length > 1 ? `\u5267\u672C\u8BED\u6CD5\u68C0\u67E5\u672A\u901A\u8FC7\uFF08\u5171 ${errs.length} \u5904\uFF09\uFF1A` : "";
      throw new FEMOSyntaxError(errs, head);
    }
  };
}

// ../../femoGen/src/femoParser.jsx
var THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
function normalizeSymbols(str, context = "global") {
  let s = str;
  if (context !== "prompt") {
    s = s.replace(/：/g, ":").replace(/，/g, ",").replace(/“/g, '"').replace(/”/g, '"').replace(/（/g, "(").replace(/）/g, ")").replace(/【/g, "[").replace(/】/g, "]").replace(/｜/g, "|");
  }
  if (context === "flow") {
    s = s.replace(/--/g, "->");
  }
  return s;
}
function stripLineComments(line) {
  let out = "";
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      out += c;
      if (c === "\\" && i + 1 < line.length) {
        out += line[i + 1];
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      continue;
    }
    if (c === "#") {
      break;
    }
    if (c === "/" && line[i + 1] === "/") break;
    out += c;
  }
  return out;
}
function findPromptRanges(lines) {
  const ranges = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    const isMultiStart = /^(?:prompt|showprompt):\s*[|｜]\s*(?:#.*)?$/.test(trimmed) || /^(?:@|\$@|\$)?[\w\u4e00-\u9fff]+\s*=\s*[|｜]\s*(?:#.*)?$/.test(trimmed);
    if (isMultiStart) {
      const fieldIndent = lines[i].length - lines[i].trimStart().length;
      let j = i + 1;
      while (j < lines.length) {
        const t2 = lines[j].trim();
        if (!t2) {
          j++;
          continue;
        }
        const ind2 = lines[j].length - lines[j].trimStart().length;
        if (ind2 <= fieldIndent) break;
        j++;
      }
      ranges.push([i + 1, j]);
      i = j;
      continue;
    }
    i++;
  }
  return ranges;
}
function extractHashSketch(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    if (/^#\s*sketch\s*:/.test(raw)) {
      out.push(raw.replace(/^#/, ""));
      i++;
      while (i < lines.length && /^#/.test(lines[i])) {
        out.push(lines[i].replace(/^#/, ""));
        i++;
      }
    } else {
      out.push(raw);
      i++;
    }
  }
  return out;
}
function stripComments(lines) {
  const ranges = findPromptRanges(lines);
  return lines.map((raw, i) => {
    for (const [s, e] of ranges) {
      if (i >= s && i < e) return raw;
    }
    return stripLineComments(raw);
  });
}
function parseFEMO(text, rep = null) {
  rep = rep || createReporter();
  const rawLines = text.split("\n");
  const metaLineIdx = rawLines.findIndex((l) => /^meta:\s*$/.test(l));
  const preamble = metaLineIdx > 0 ? rawLines.slice(0, metaLineIdx).join("\n").replace(/\s+$/, "") : "";
  const lines = stripComments(extractHashSketch(rawLines));
  const blocks = splitTopBlocks(lines);
  const result = {
    meta: {
      name: "",
      version: "1.0",
      owner: "",
      database: "",
      session: "",
      system_safety: "",
      output_style: ""
    },
    code: [],
    context: [],
    memory: [],
    preamble,
    // meta: 之前的文件头原文（注释等），buildFEMO 原样回写
    vars: [],
    actors: [],
    warnings: [],
    // 非阻断提示（rep.warnings 诊断：行号/出错行/信息/区域）——与引擎 script.warnings 对齐
    actions: [],
    modules: [],
    mainflow: { nodeDecls: [], edges: [] }
  };
  let mainflowSketch = null;
  for (const block of blocks) {
    const h = block.header;
    if (h === "meta:") {
      result.meta = parseMetaBlock(block.contentLines, rep);
    } else if (h === "code:") {
      result.code = parseCodeBlock(block.contentLines, rep);
    } else if (h === "vars:") {
      result.vars = parseVarsBlock(block.contentLines, rep);
    } else if (h === "actors:") {
      result.actors = parseActorsBlock(block.contentLines, rep);
    } else if (h.startsWith("memory ")) {
      result.memory.push(
        parseMemoryOrContextBlock(h, block.contentLines, "memory", rep, block.headerLineNum)
      );
    } else if (h.startsWith("context ")) {
      result.context.push(
        parseMemoryOrContextBlock(h, block.contentLines, "context", rep, block.headerLineNum)
      );
    } else if (h.startsWith("action ")) {
      result.actions.push(parseActionBlock(h, block.contentLines, rep, block.headerLineNum));
    } else if (h.startsWith("module ")) {
      result.modules.push(parseModuleBlock(h, block.contentLines, rep, block.headerLineNum));
    } else if (h === "sketch:") {
      mainflowSketch = parseLayoutBlock(block.contentLines);
    } else if (h === "mainflow:" || h === "flow:") {
      result.mainflow = parseMainflowBlock(block.contentLines, rep);
      if (mainflowSketch) {
        result.mainflow.layout = { ...result.mainflow.layout, ...mainflowSketch };
        mainflowSketch = null;
      }
    } else {
      rep.fail(
        `\u672A\u8BC6\u522B\u7684\u9876\u5C42\u5757: "${h}"\u3002\u671F\u671B: meta:, code:, vars:, actors:, context:, memory:, action ..., module ..., mainflow:`,
        { line: (block.headerLineNum ?? -1) + 1, lineText: h, where: "\u9876\u5C42" }
      );
    }
  }
  if (mainflowSketch && result.mainflow) {
    result.mainflow.layout = { ...result.mainflow.layout, ...mainflowSketch };
  }
  const topModules = result.modules;
  result.modules = [];
  function flattenModules(mods, parentPath) {
    for (const m of mods) {
      const path = [...parentPath, m.name];
      m.path = path;
      result.modules.push(m);
      if (m.subModules) {
        flattenModules(m.subModules, path);
        delete m.subModules;
      }
    }
  }
  flattenModules(topModules, ["mainflow"]);
  validateDeclarations(result, rep);
  validateActionSyntax(result, rep);
  validateJoinOnCycle(result, text, rep);
  result.warnings = rep.warnings;
  rep.throwIfErrors();
  return result;
}
function validateJoinOnCycle(result, text, rep = null) {
  rep = rep || createReporter();
  const flows = [];
  if (result.mainflow) flows.push({ edges: result.mainflow.edges, where: "mainflow" });
  for (const m2 of result.modules || []) {
    flows.push({ edges: m2.edges, where: `module ${m2.name}` });
  }
  function onCycle(targetLabel, edges) {
    const frontier = (edges || []).filter((e) => e.srcLabel === targetLabel).map((e) => e.tgtLabel);
    const visited = new Set(frontier);
    while (frontier.length) {
      const nid2 = frontier.pop();
      if (nid2 === targetLabel) return true;
      for (const e of edges || []) {
        if (e.srcLabel === nid2 && !visited.has(e.tgtLabel)) {
          visited.add(e.tgtLabel);
          frontier.push(e.tgtLabel);
        }
      }
    }
    return false;
  }
  const joinBlock = /join\s*\(([^)]*)\)\s*:\s*([\s\S]*?)to\s*\[([^\]]+)\]/g;
  let m;
  while ((m = joinBlock.exec(String(text || ""))) !== null) {
    const target = m[3].trim();
    for (const f of flows) {
      const known = new Set((f.edges || []).flatMap((e) => [e.srcLabel, e.tgtLabel]));
      if (known.has(target) && onCycle(target, f.edges)) {
        const before = String(text || "").slice(0, m.index);
        const line = before.split("\n").length;
        const lineText = (text.slice(m.index).split("\n")[0] || "").trim();
        rep.warning(
          `join(...) \u7684\u76EE\u6807 [${target}] \u4F4D\u4E8E\u6D41\u7A0B\u73AF\u8DEF\u4E0A\uFF08\u4ECE\u5B83\u51FA\u53D1\u80FD\u7ED5\u56DE\u5B83\u81EA\u5DF1\uFF09\u3002\u5F53\u524D\u5F15\u64CE\u7684 join \u4F1A\u7B49\u5F85\u4E0A\u6E38\u5230\u9F50\uFF0C\u800C\u73AF\u8DEF\u91CC\u7684\u4E00\u90E8\u5206\u4E0A\u6E38\u53EA\u6709 join \u653E\u884C\u4E4B\u540E\u624D\u4F1A\u53D1\u751F\uFF0C\u8FD9\u4F1A\u8BA9\u5267\u672C\u6C38\u8FDC\u7B49\u5F85\u4E0B\u53BB\u3002\u8BF7\u628A\u5FAA\u73AF\u91CC\u7684\u5408\u6D41\u6539\u6210\u666E\u901A\u591A\u7EBF\u6C47\u5165\uFF08\u9010\u6761 [A] -> [next]\uFF0C\u5230\u5373\u8D70\uFF09\uFF0C\u4E0D\u8981\u7528 join(...):\u3002`,
          { line, lineText, where: f.where }
        );
        break;
      }
    }
  }
}
var _RESERVED_WORDS = /* @__PURE__ */ new Set([
  "and",
  "or",
  "not",
  "in",
  "is",
  "True",
  "False",
  "None",
  "true",
  "false",
  "TRUE",
  "FALSE"
]);
function _extractCondIdentifiers(cond) {
  const noStr = cond.replace(/"[^"]*"|'[^']*'/g, '""');
  return noStr.match(/@?[\w\u4e00-\u9fff]+(?:\.[\w\u4e00-\u9fff]+)*/g) || [];
}
function _mainIdent(ident) {
  const dot = ident.indexOf(".");
  return dot >= 0 ? ident.slice(0, dot) : ident;
}
function _declName(raw) {
  return raw.startsWith("$") ? raw.slice(1) : raw;
}
function validateDeclarations(result, rep = null) {
  rep = rep || createReporter();
  const topVars = new Set((result.vars || []).map((v) => _declName(v.name)));
  const actors = new Set((result.actors || []).map((a) => a.name));
  const moduleVars = /* @__PURE__ */ new Map();
  for (const m of result.modules || []) {
    moduleVars.set(m.name, new Set((m.vars || []).map((v) => _declName(v.name))));
  }
  function validateFlow(nodeDecls, edges, ctxName, moduleName) {
    const scopeVars = new Set(topVars);
    if (moduleName && moduleVars.has(moduleName)) {
      for (const n of moduleVars.get(moduleName)) scopeVars.add(n);
    }
    const loopVars = /* @__PURE__ */ new Set();
    for (const d of nodeDecls || []) {
      if (d.specialType === "FOR" && d.forCondition) {
        const m = d.forCondition.match(/^(@?[\w\u4e00-\u9fff]+)\s+in\s+(.+)$/);
        if (!m) {
          rep.fail(
            `for \u6761\u4EF6\u683C\u5F0F\u9519\u8BEF: "${d.forCondition}"\u3002\u671F\u671B: for @var in list`,
            { where: ctxName }
          );
        }
        const loopVar = m[1];
        if (!scopeVars.has(loopVar)) {
          rep.fail(
            `for \u5FAA\u73AF\u53D8\u91CF "${loopVar}" \u672A\u5728 vars: \u4E2D\u58F0\u660E\uFF08for \u6761\u4EF6: "${d.forCondition}"\uFF09\u3002\u6240\u6709\u5FAA\u73AF\u53D8\u91CF\u5FC5\u987B\u5728 vars: \u4E2D\u9884\u5148\u58F0\u660E\uFF0C\u4F8B\u5982: ${loopVar} = ""`,
            { where: ctxName }
          );
        }
        loopVars.add(loopVar);
        const iterable = m[2].trim();
        if (/^@?[\w\u4e00-\u9fff]+$/.test(iterable) && !scopeVars.has(iterable)) {
          rep.fail(
            `for \u8FED\u4EE3\u5668 "${iterable}" \u672A\u5728 vars: \u4E2D\u58F0\u660E\uFF08for \u6761\u4EF6: "${d.forCondition}"\uFF09`,
            { where: ctxName }
          );
        }
      }
    }
    const known = /* @__PURE__ */ new Set([...scopeVars, ...actors, ...loopVars]);
    for (const e of edges || []) {
      if (!e.cond) continue;
      for (const ident of _extractCondIdentifiers(e.cond)) {
        if (_RESERVED_WORDS.has(ident)) continue;
        const main = _mainIdent(ident);
        if (/^\d+(\.\d+)?$/.test(main)) continue;
        if (main.startsWith("@")) {
          if (!actors.has(main) && !scopeVars.has(main) && !loopVars.has(main)) {
            rep.fail(
              `\u6761\u4EF6 "${e.cond}" \u5F15\u7528\u4E86\u672A\u58F0\u660E\u7684 actor/\u53D8\u91CF "${main}"\uFF08\u8FB9 ${e.srcLabel} -> ${e.tgtLabel}\uFF09`,
              { where: ctxName }
            );
          }
        } else if (!known.has(main)) {
          rep.fail(
            `\u6761\u4EF6 "${e.cond}" \u5F15\u7528\u4E86\u672A\u58F0\u660E\u7684\u53D8\u91CF "${main}"\uFF08\u8FB9 ${e.srcLabel} -> ${e.tgtLabel}\uFF09\u3002\u5B57\u7B26\u4E32\u5B57\u9762\u91CF\u8BF7\u52A0\u5F15\u53F7\uFF0C\u5982 == "ai"\uFF1B\u6240\u6709\u53D8\u91CF\u987B\u5728 vars: \u4E2D\u58F0\u660E`,
            { where: ctxName }
          );
        }
      }
    }
    const seenEdges = /* @__PURE__ */ new Set();
    const uniqEdges = (edges || []).filter((e) => {
      const key = `${e.srcLabel}\0${e.tgtLabel}\0${e.cond || ""}`;
      if (seenEdges.has(key)) return false;
      seenEdges.add(key);
      return true;
    });
    const entrySrc = (s) => String(s ?? "").replace(/^\[|\]$/g, "");
    const hasIn = new Set(
      uniqEdges.filter((e) => entrySrc(e.srcLabel) !== "START" && entrySrc(e.srcLabel) !== "IN").map((e) => e.tgtLabel)
    );
    const gatewayNames = new Set(
      (nodeDecls || []).filter((d) => d.specialType === "FOR" || d.specialType === "PAR" || d.specialType === "FORK" || d.specialType === "JOIN").map((d) => d.label)
    );
    const unconditionalOuts = /* @__PURE__ */ new Map();
    for (const e of uniqEdges) {
      if (!e.cond) {
        const list = unconditionalOuts.get(e.srcLabel) || [];
        list.push(e.tgtLabel);
        unconditionalOuts.set(e.srcLabel, list);
      }
    }
    for (const [src, tgts] of unconditionalOuts) {
      if (gatewayNames.has(src)) continue;
      if (tgts.length >= 2 && hasIn.has(src)) {
      }
    }
  }
  validateFlow(result.mainflow.nodeDecls, result.mainflow.edges, "mainflow", null);
  for (const m of result.modules || []) {
    validateFlow(m.nodeDecls, m.edges, `module ${m.name}`, m.name);
  }
}
var _PY_KEYWORDS = /* @__PURE__ */ new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield"
]);
function _stripSpecName(name) {
  return String(name || "").replace(/^[$@]+/, "").trim();
}
function _outTargetRoot(raw) {
  let t = String(raw || "").trim().replace(/,+$/, "").trim();
  t = t.replace(/\([^)]*\)\s*$/, "").trim();
  t = t.split(/\+=|-=|=(?!=)/)[0].trim();
  return _stripSpecName(t);
}
function _splitInItems(inMappings) {
  const items = [];
  for (const line of String(inMappings || "").split("\n")) {
    for (const piece of line.split(",")) {
      const t = piece.trim().replace(/,+$/, "").trim();
      if (t) items.push(t);
    }
  }
  return items;
}
function validateActionSyntax(result, rep = null) {
  rep = rep || createReporter();
  const actors = new Set((result.actors || []).map((a) => a.name));
  const topScopeVars = new Set((result.vars || []).map((v) => _stripSpecName(v.name)));
  function checkScope(rawScope, scopeVars, ctx) {
    const s = String(rawScope || "").trim();
    if (!s || s.toLowerCase() === "all" || s.toLowerCase() === "self") return;
    if (/\bself\b/i.test(s)) {
      rep.error(
        `${ctx}: scope: ${s} \u2192 "self" \u53EA\u80FD\u5355\u72EC\u4F7F\u7528\uFF08scope: self = \u4EC5\u53D1\u8A00\u8005\u53EF\u89C1\uFF09\uFF1B\u591A\u76EE\u6807\u8BF7\u5199\u6210\u65B9\u62EC\u53F7\u5217\u8868\uFF0C\u5982 scope: [@\u4E0A\u5E1D, @player]`,
        { where: "action \u6821\u9A8C" }
      );
      return;
    }
    for (const part of s.split("+")) {
      const p = part.trim();
      if (!p) continue;
      if (p.startsWith("[")) {
        if (!p.endsWith("]")) {
          rep.error(`${ctx}: scope: ${s} \u2192 \u65B9\u62EC\u53F7\u4E0D\u95ED\u5408\uFF0C\u8BF7\u68C0\u67E5\u5217\u8868\u683C\u5F0F`, { where: "action \u6821\u9A8C" });
          continue;
        }
        for (const item of p.slice(1, -1).split(/[,，]/)) {
          const it = item.trim();
          if (!it) continue;
          if (it.startsWith("{") && it.endsWith("}")) continue;
          if (it.startsWith("@")) {
            if (!actors.has(it) && !scopeVars.has(_stripSpecName(it))) {
              rep.error(
                `${ctx}: scope: ${s} \u2192 "${it}" \u4E0D\u662F\u5DF2\u58F0\u660E\u7684\u89D2\u8272\uFF0C\u4E5F\u4E0D\u662F\u5DF2\u58F0\u660E\u7684\u53D8\u91CF\u3002\u53EF\u7528\u89D2\u8272\uFF1A${[...actors].sort().join(" / ") || "(\u65E0)"}`,
                { where: "action \u6821\u9A8C" }
              );
            }
          } else if (!scopeVars.has(it)) {
            rep.error(
              `${ctx}: scope: ${s} \u2192 "${it}" \u672A\u5728 vars: \u4E2D\u58F0\u660E\uFF08scope \u5217\u8868\u91CC\u7684\u540D\u5B57\u5FC5\u987B\u662F\u89D2\u8272 @\u540D \u6216\u5DF2\u58F0\u660E\u53D8\u91CF\uFF09`,
              { where: "action \u6821\u9A8C" }
            );
          }
        }
      } else if (/[,，]/.test(p)) {
        const suggestion = "[" + p.split(/[,，]/).map((x) => x.trim()).join(", ") + "]";
        rep.error(
          `${ctx}: scope: ${s} \u2192 \u591A\u4E2A\u76EE\u6807\u5FC5\u987B\u7528\u65B9\u62EC\u53F7\u5217\u8868\u5305\u88F9\uFF0C\u8BF7\u5199\u6210 scope: ${suggestion}`,
          { where: "action \u6821\u9A8C" }
        );
      } else if (!scopeVars.has(p) && !scopeVars.has(_stripSpecName(p))) {
        rep.error(
          `${ctx}: scope: ${s} \u2192 "${p}" \u672A\u5728 vars: \u4E2D\u58F0\u660E\uFF08\u88F8\u540D\u6309\u53D8\u91CF\u89E3\u6790\uFF0C\u5FC5\u987B\u5148\u5728 vars: \u58F0\u660E\uFF1B\u89D2\u8272\u8BF7\u5E26 @\uFF09`,
          { where: "action \u6821\u9A8C" }
        );
      }
    }
  }
  function checkAction(action, scopeVars, ctx) {
    if (action.executorType === "func") {
      const param = String(action.executorActor || "").trim();
      if (!/^[\w\u4e00-\u9fff]+\.[\w\u4e00-\u9fff]+$/.test(param)) {
        rep.error(
          `action "${action.name}"\uFF08${ctx}\uFF09\u2192 @func \u7F3A\u5C11"\u6A21\u5757\u522B\u540D.\u51FD\u6570\u540D"\u3002\u5FC5\u987B\u5199\u6210 @func(\u6A21\u5757\u522B\u540D.\u51FD\u6570\u540D)\uFF0C\u522B\u540D\u5728 code: \u533A\u58F0\u660E\u3002\u793A\u4F8B\uFF1A@func(werewolf_utils.get_order)`,
          { where: "action \u6821\u9A8C" }
        );
      }
    }
    if (action.executorType === "notice") {
      if (!String(action.prompt || "").trim()) {
        rep.error(
          `action "${action.name}"\uFF08${ctx}\uFF09\u2192 @notice \u7684 prompt \u4E3A\u7A7A\u3002\u516C\u544A\u8282\u70B9\u5FC5\u987B\u8981\u6709 prompt\uFF08\u5B83\u5C31\u662F\u6CE8\u5165\u4E0A\u4E0B\u6587\u7684\u516C\u544A\u672C\u4F53\uFF09`,
          { where: "action \u6821\u9A8C" }
        );
      }
      if (String(action.outVars || "").trim()) {
        rep.error(
          `action "${action.name}"\uFF08${ctx}\uFF09\u2192 @notice \u4E0D\u652F\u6301 out:\u3002\u516C\u544A\u8282\u70B9\u6CA1\u6709\u56DE\u7B54\u8005\uFF0Cout \u58F0\u660E\u7684\u53D8\u91CF\u6C38\u8FDC\u4E0D\u4F1A\u88AB\u8D4B\u503C\uFF0C\u8D4B\u503C\u8BF7\u7528 @assign \u6216\u8BA9 AI/human \u8F93\u51FA`,
          { where: "action \u6821\u9A8C" }
        );
      }
      if (String(action.resolve || "").trim()) {
        rep.error(
          `action "${action.name}"\uFF08${ctx}\uFF09\u2192 @notice \u4E0D\u652F\u6301 resolve:\u3002\u516C\u544A\u8282\u70B9\u6CA1\u6709\u56DE\u7B54\u8005\uFF0C\u6821\u9A8C\u51FD\u6570\u6C38\u8FDC\u4E0D\u4F1A\u88AB\u8C03\u7528`,
          { where: "action \u6821\u9A8C" }
        );
      }
      const inert = [];
      if (String(action.memory || "").trim()) inert.push("memory:");
      if (String(action.context || "").trim()) inert.push("context:");
      if (String(action.showprompt || "").trim()) inert.push("showprompt:");
      if (action.max_retries) inert.push("max_retries:");
      if (String(action.fallback || "").trim()) inert.push("fallback:");
      if (inert.length) {
        rep.warning(
          `action "${action.name}"\uFF08${ctx}\uFF09\u2192 @notice \u7684 ${inert.join(" / ")} \u4E0D\u751F\u6548\uFF1A\u516C\u544A\u8282\u70B9\u65E0\u56DE\u7B54\u8005\uFF08\u60F0\u6027\u6B7B\u914D\u7F6E\uFF0C\u77E5\u60C5\u5373\u53EF\uFF09`,
          { where: "action \u6821\u9A8C" }
        );
      }
      if (String(action.scope || "").trim().toLowerCase() === "self") {
        rep.warning(
          `action "${action.name}"\uFF08${ctx}\uFF09\u2192 @notice \u7684 scope: self = \u4EC5 meta.owner \u53EF\u89C1\uFF08\u516C\u544A\u65E0\u53D1\u8A00\u8005\uFF09`,
          { where: "action \u6821\u9A8C" }
        );
      }
      if (String(action.executorActor || "").trim()) {
        rep.warning(
          `action "${action.name}"\uFF08${ctx}\uFF09\u2192 @notice \u7684\u6267\u884C\u8005\u53C2\u6570\u88AB\u6574\u4F53\u5FFD\u7565\uFF08\u516C\u544A\u6CA1\u6709\u53D1\u8A00\u8005\uFF09\uFF0C\u5BFC\u51FA\u65F6\u4F1A\u5265\u6389`,
          { where: "action \u6821\u9A8C" }
        );
      }
    }
    const items = _splitInItems(action.inMappings);
    const bare = items.filter((it) => !it.includes("="));
    if (bare.length > 0) {
      rep.error(
        `action "${action.name}"\uFF08${ctx}\uFF09\u2192 in: \u9879\u7F3A\u5C11 "= \u53D8\u91CF\u8868\u8FBE\u5F0F" \u6620\u5C04\uFF1A${bare.join(", ")}\u3002in: \u7684\u6BCF\u4E00\u9879\u5FC5\u987B\u662F "\u53C2\u6570\u540D = \u53D8\u91CF\u8868\u8FBE\u5F0F"\uFF0C\u4F8B\u5982 in: from_ = speak_from`,
        { where: "action \u6821\u9A8C" }
      );
    }
    for (const it of items) {
      const left = it.split("=")[0].trim();
      if (_PY_KEYWORDS.has(_stripSpecName(left))) {
        rep.error(
          `action "${action.name}"\uFF08${ctx}\uFF09\u2192 in: \u53C2\u6570\u540D "${_stripSpecName(left)}" \u662F Python \u4FDD\u7559\u5B57\uFF0C\u4E0D\u80FD\u7528\u4F5C\u53C2\u6570\u540D\uFF0C\u8BF7\u6539\u540D`,
          { where: "action \u6821\u9A8C" }
        );
      }
    }
    for (const line of String(action.outVars || "").split("\n")) {
      for (const item of line.split(",")) {
        const target = _outTargetRoot(item);
        if (_PY_KEYWORDS.has(target)) {
          rep.error(
            `action "${action.name}"\uFF08${ctx}\uFF09\u2192 out: \u76EE\u6807 "${target}" \u662F Python \u4FDD\u7559\u5B57\uFF0C\u4E0D\u80FD\u7528\u4F5C\u53D8\u91CF\u540D\uFF0C\u8BF7\u6539\u540D`,
            { where: "action \u6821\u9A8C" }
          );
        }
      }
    }
    checkScope(action.scope, scopeVars, `action "${action.name}"\uFF08${ctx}\uFF09`);
  }
  for (const action of result.actions || []) {
    checkAction(action, topScopeVars, "\u9876\u5C42");
  }
  for (const m of result.modules || []) {
    const scopeVars = /* @__PURE__ */ new Set([...topScopeVars, ...(m.vars || []).map((v) => _stripSpecName(v.name))]);
    const ctx = `module ${m.name}`;
    for (const action of m.actions || []) {
      checkAction(action, scopeVars, ctx);
    }
    for (const d of m.nodeDecls || []) {
      if ((d.specialType === "FOR" || d.specialType === "PAR") && d.forCondition) {
        const match = d.forCondition.match(/^(@?[\w\u4e00-\u9fff]+)\s+in\s+/);
        if (match && _PY_KEYWORDS.has(_stripSpecName(match[1]))) {
          rep.error(
            `${ctx} \u5FAA\u73AF\u53D8\u91CF "${_stripSpecName(match[1])}" \u662F Python \u4FDD\u7559\u5B57\uFF0C\u4E0D\u80FD\u7528\u4F5C\u5FAA\u73AF\u53D8\u91CF\u540D\uFF0C\u8BF7\u6539\u540D`,
            { where: "action \u6821\u9A8C" }
          );
        }
      }
    }
  }
  for (const d of result.mainflow && result.mainflow.nodeDecls || []) {
    if ((d.specialType === "FOR" || d.specialType === "PAR") && d.forCondition) {
      const match = d.forCondition.match(/^(@?[\w\u4e00-\u9fff]+)\s+in\s+/);
      if (match && _PY_KEYWORDS.has(_stripSpecName(match[1]))) {
        rep.error(
          `mainflow \u5FAA\u73AF\u53D8\u91CF "${_stripSpecName(match[1])}" \u662F Python \u4FDD\u7559\u5B57\uFF0C\u4E0D\u80FD\u7528\u4F5C\u5FAA\u73AF\u53D8\u91CF\u540D\uFF0C\u8BF7\u6539\u540D`,
          { where: "action \u6821\u9A8C" }
        );
      }
    }
  }
  const varDecls = [...result.vars || []];
  for (const m of result.modules || []) {
    for (const v of m.vars || []) varDecls.push(v);
  }
  for (const v of varDecls) {
    if (_PY_KEYWORDS.has(_stripSpecName(v.name))) {
      rep.error(
        `vars: \u53D8\u91CF\u540D "${_stripSpecName(v.name)}" \u662F Python \u4FDD\u7559\u5B57\uFF0C\u4E0D\u80FD\u7528\u4F5C\u53D8\u91CF\u540D\uFF0C\u8BF7\u6362\u4E00\u4E2A\u4E0D\u51B2\u7A81\u7684\u540D\u5B57`,
        { where: "action \u6821\u9A8C" }
      );
    }
  }
  rep.throwIfErrors("\u7F16\u8BD1\u9519\u8BEF\uFF1A\u5267\u672C\u8BED\u6CD5\u68C0\u67E5\u672A\u901A\u8FC7");
}
function splitTopBlocks(lines) {
  const blocks = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    if (!trimmed) {
      if (current) {
        current.contentLines.push({
          indent,
          text: "",
          lineNum: i,
          raw: line
        });
      }
      continue;
    }
    if (indent === 0) {
      if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
        continue;
      }
      if (current) blocks.push(current);
      current = {
        header: normalizeSymbols(trimmed),
        headerLineNum: i,
        contentLines: []
      };
    } else if (current) {
      current.contentLines.push({
        indent,
        text: trimmed,
        lineNum: i,
        raw: line
      });
    }
  }
  if (current) blocks.push(current);
  return blocks;
}
function parseMetaBlock(cls, rep = null) {
  rep = rep || createReporter();
  const meta = {};
  let i = 0;
  while (i < cls.length) {
    const cl = cls[i];
    const _t = cl.text.trim();
    if (!_t || _t.startsWith("#")) {
      i++;
      continue;
    }
    const line = normalizeSymbols(cl.text);
    const multiMatch = line.match(/^([\w\u4e00-\u9fff]+)\s*=\s*\|$/);
    if (multiMatch) {
      const key2 = multiMatch[1];
      i++;
      const valueLines = [];
      while (i < cls.length && cls[i].indent > cl.indent) {
        valueLines.push(cls[i].text);
        i++;
      }
      const value = valueLines.join("\n");
      meta[key2] = value;
      continue;
    }
    const m = line.match(/^([\w\u4e00-\u9fff]+)\s*=\s*(.+)$/);
    if (!m)
      rep.fail(
        `meta \u5B57\u6BB5\u683C\u5F0F\u9519\u8BEF: "${cl.text}"\u3002\u671F\u671B: key = value \u6216 key = |`,
        { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "meta:" }
      );
    const [, key, val] = m;
    let v = val.trim();
    if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) {
      v = v.slice(1, -1);
    }
    switch (key) {
      case "id":
        meta.id = v;
        break;
      case "name":
        meta.name = v;
        break;
      case "version":
        meta.version = v;
        break;
      case "owner":
        meta.owner = String(v).replace(/^\[|\]$/g, "");
        break;
      case "database":
        meta.database = v;
        break;
      case "session":
        meta.session = v;
        break;
      case "system_safety":
        meta.system_safety = typeof v === "string" ? v.replace(/^"|"$/g, "") : v;
        break;
      case "output_style":
        meta.output_style = typeof v === "string" ? v.replace(/^"|"$/g, "") : v;
        break;
      case "max_steps":
        meta.max_steps = Number(v);
        break;
      case "delay":
        meta.delay = Number(v);
        break;
      default:
        meta[key] = v;
        break;
    }
    i++;
  }
  return meta;
}
function parseLayoutBlock(cls) {
  const layout = {};
  for (const cl of cls) {
    const line = normalizeSymbols(cl.text);
    const m = line.match(/^(\[.+?\])\s*=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (m) {
      layout[m[1]] = { dx: Math.round(parseFloat(m[2])), dy: Math.round(parseFloat(m[3])) };
    }
  }
  return layout;
}
function parseVarsBlock(cls, rep = null) {
  rep = rep || createReporter();
  const vars = [];
  let i = 0;
  while (i < cls.length) {
    const cl = cls[i];
    const _t = cl.text.trim();
    if (!_t || _t.startsWith("#")) {
      i++;
      continue;
    }
    const line = normalizeSymbols(cl.text);
    const multiMatch = line.match(/^((?:@|\$@|\$)?[\w\u4e00-\u9fff]+)\s*=\s*\|$/);
    if (multiMatch) {
      const key = multiMatch[1];
      i++;
      const valueLines = [];
      while (i < cls.length && cls[i].indent > cl.indent) {
        valueLines.push(cls[i].text);
        i++;
      }
      vars.push({ name: key, defaultValue: valueLines.join("\n") });
      continue;
    }
    const m = line.match(/^((?:@|\$@|\$)?[\w\u4e00-\u9fff]+)\s*=\s*(.*)$/);
    if (!m)
      rep.fail(
        `vars \u5B57\u6BB5\u683C\u5F0F\u9519\u8BEF: "${cl.text}"\u3002\u671F\u671B: varname = "value"`,
        { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "vars:" }
      );
    vars.push({ name: m[1], defaultValue: m[2].trim() });
    i++;
  }
  return vars;
}
function parseCodeBlock(cls, rep = null) {
  rep = rep || createReporter();
  const code = [];
  for (const cl of cls) {
    const _t = cl.text.trim();
    if (!_t || _t.startsWith("#")) continue;
    const line = normalizeSymbols(cl.text);
    const m = line.match(/^(@?[\w\u4e00-\u9fff]+)\s*=\s*(.*)$/);
    if (!m)
      rep.fail(
        `code \u5B57\u6BB5\u683C\u5F0F\u9519\u8BEF: "${cl.text}"\u3002\u671F\u671B: name = value`,
        { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "code:" }
      );
    let val = m[2].trim();
    const fm = val.match(/^file:"(.*)"$/);
    if (fm) val = fm[1];
    code.push({ name: m[1], value: val });
  }
  return code;
}
function parseActorsBlock(cls, rep = null) {
  rep = rep || createReporter();
  const actors = [];
  let i = 0;
  while (i < cls.length) {
    const cl = cls[i];
    const _t = cl.text.trim();
    if (!_t || _t.startsWith("#")) {
      i++;
      continue;
    }
    const line = normalizeSymbols(cl.text);
    const bpMatch = line.match(/^blueprint\s+(@?[\w\u4e00-\u9fff]+)\s*:\s*$/);
    if (bpMatch) {
      const bpName = bpMatch[1];
      let source2 = null;
      let tools2 = null;
      let thinking2 = null;
      i++;
      while (i < cls.length && cls[i].indent > cl.indent) {
        const al = normalizeSymbols(cls[i].text).trim();
        if (al.startsWith("source:")) {
          source2 = al.slice(7).trim();
        } else if (al.startsWith("thinking")) {
          const thStr = al.replace(/^thinking\s*[:=]\s*/, "").trim().toLowerCase();
          if (thStr !== "default" && !THINKING_LEVELS.includes(thStr)) {
            rep.fail(
              `thinking \u6863\u4F4D\u4E0D\u5408\u6CD5: "${thStr}"\uFF08\u5141\u8BB8: default/${THINKING_LEVELS.join("/")}\uFF09`,
              { line: cls[i].lineNum + 1, lineText: cls[i].raw || cls[i].text, where: `blueprint ${bpName}` }
            );
          }
          thinking2 = thStr === "default" ? "" : thStr;
        } else if (al.startsWith("tools")) {
          const toolsStr = al.replace(/^tools\s*[:=]\s*/, "").trim();
          if (toolsStr.startsWith("[") && toolsStr.endsWith("]")) {
            tools2 = toolsStr.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
            if (!tools2.length) tools2 = false;
          } else if (toolsStr === "true" || toolsStr === "false") {
            tools2 = toolsStr === "true";
          } else {
            rep.fail(
              `tools \u683C\u5F0F\u9519\u8BEF\uFF0C\u5E94\u4E3A tools = [tool1, tool2] \u6216 tools: true/false`,
              { line: cls[i].lineNum + 1, lineText: cls[i].raw || cls[i].text, where: `blueprint ${bpName}` }
            );
          }
        }
        i++;
      }
      actors.push({ type: "blueprint", name: bpName, soul: "", source: source2 ?? "", tools: tools2, thinking: thinking2 ?? "" });
      continue;
    }
    const prefixMatch = line.match(
      /^(ai|human)\s+(@?[\w\u4e00-\u9fff]+)\s*=\s*(.*)$/
    );
    const bareMatch = !prefixMatch ? line.match(/^(ai|human)\s+(@?[\w\u4e00-\u9fff]+)\s*$/) : null;
    if (bareMatch) {
      actors.push({ type: bareMatch[1], name: bareMatch[2], soul: "", source: "", tools: [] });
      i++;
      continue;
    }
    if (!prefixMatch)
      rep.fail(
        `actors \u683C\u5F0F\u9519\u8BEF: "${cl.text}"\u3002\u671F\u671B: ai|human @name = soul:X, source:Y, tools:[...]\uFF0C\u6216\u88F8\u5199\u6CD5 ai|human @name`,
        { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "actors:" }
      );
    const type = prefixMatch[1];
    const name = prefixMatch[2];
    const rest = prefixMatch[3];
    let soul = null;
    let source = null;
    let tools = null;
    let thinking = null;
    const parts = rest.split(",").map((p) => p.trim()).filter(Boolean);
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      if (part.startsWith("soul:")) {
        const val = part.slice(5).trim();
        if (!val) rep.fail(`soul \u5B57\u6BB5\u7F3A\u5C11\u503C\uFF0C\u4F8B\u5982 soul:1`, { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "actors:" });
        soul = val;
      } else if (part.startsWith("source:")) {
        const val = part.slice(7).trim();
        if (!val) rep.fail(`source \u5B57\u6BB5\u7F3A\u5C11\u503C\uFF0C\u4F8B\u5982 source:01A`, { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "actors:" });
        source = val;
      } else if (part.startsWith("thinking")) {
        const thStr = part.replace(/^thinking\s*[:=]\s*/, "").trim().toLowerCase();
        if (thStr !== "default" && !THINKING_LEVELS.includes(thStr)) {
          rep.fail(
            `thinking \u6863\u4F4D\u4E0D\u5408\u6CD5: "${thStr}"\uFF08\u5141\u8BB8: default/${THINKING_LEVELS.join("/")}\uFF09`,
            { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: `actor ${name}` }
          );
        }
        thinking = thStr === "default" ? "" : thStr;
      } else if (part.startsWith("tools")) {
        let toolsStr = part.replace(/^tools\s*[:=]\s*/, "").trim();
        if (toolsStr.startsWith("[")) {
          while (!toolsStr.endsWith("]") && pi + 1 < parts.length) {
            pi += 1;
            toolsStr += "," + parts[pi];
          }
        }
        if (toolsStr.startsWith("[") && toolsStr.endsWith("]")) {
          toolsStr = toolsStr.slice(1, -1);
          tools = toolsStr.split(",").map((s) => s.trim()).filter(Boolean);
          if (!tools.length) tools = false;
        } else if (toolsStr === "true" || toolsStr === "false") {
          tools = toolsStr === "true";
        } else {
          rep.fail(
            `tools \u683C\u5F0F\u9519\u8BEF\uFF0C\u5E94\u4E3A tools = [tool1, tool2] \u6216 tools: true/false`,
            { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: `actor ${name}` }
          );
        }
      } else {
        rep.fail(
          `\u4E0D\u652F\u6301\u7684\u5B57\u6BB5 "${part}"\u3002\u5408\u6CD5\u5B57\u6BB5: soul, source, thinking, tools`,
          { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "actors:" }
        );
      }
    }
    if (soul === null) soul = "";
    if (source === null) source = "";
    if (thinking === null) thinking = "";
    actors.push({ type, name, soul, source, tools, thinking });
    i++;
  }
  return actors;
}
function parseMemoryOrContextBlock(header, cls, blockType, rep = null, headerLineNum = null) {
  rep = rep || createReporter();
  const hm = header.match(
    new RegExp(`^${blockType}\\s+([\\w\\u4e00-\\u9fff]+)\\((.+?)\\):$`)
  );
  if (!hm)
    rep.fail(
      `${blockType} \u58F0\u660E\u683C\u5F0F\u9519\u8BEF: "${header}"\u3002\u671F\u671B: ${blockType} name(fileRef):`,
      { line: (headerLineNum ?? -1) + 1, lineText: header, where: `${blockType} \u533A` }
    );
  const block = {
    name: hm[1],
    fileRef: hm[2],
    in: "",
    out: ""
  };
  for (const cl of cls) {
    const _t = cl.text.trim();
    if (!_t || _t.startsWith("#")) continue;
    const line = normalizeSymbols(cl.text);
    if (line.startsWith("in:")) {
      const after = line.slice(3).trim();
      block.in = after || cls.filter((l) => l.indent > cl.indent).map((l) => normalizeSymbols(l.text)).join("\n");
    } else if (line.startsWith("out:")) {
      const after = line.slice(4).trim();
      block.out = after || cls.filter((l) => l.indent > cl.indent).map((l) => normalizeSymbols(l.text)).join(", ");
    }
  }
  return block;
}
function parseActionBlock(header, cls, rep = null, headerLineNum = null) {
  rep = rep || createReporter();
  const normalizedHeader = normalizeSymbols(header);
  const hm = normalizedHeader.match(
    /^action\s+([\w\u4e00-\u9fff]+)\s+(@[\w\u4e00-\u9fff]+)(?:\((@?[\w\u4e00-\u9fff.]+)\))?(?:\s+as\s*\((@?[\w\u4e00-\u9fff.]+)\))?\s*:\s*$/
  );
  if (!hm)
    rep.fail(
      `Action \u58F0\u660E\u683C\u5F0F\u9519\u8BEF: "${header}"\u3002\u671F\u671B: action name @type(@actor):`,
      { line: (headerLineNum ?? -1) + 1, lineText: header, where: "action \u533A" }
    );
  const action = {
    name: hm[1],
    executorType: hm[2].replace("@", ""),
    executorActor: hm[3] || "",
    asActor: hm[4] || "",
    prompt: "",
    resolve: "",
    scope: "",
    outVars: "",
    inMappings: "",
    memory: "",
    context: "",
    max_retries: 0,
    fallback: "",
    interrupt: ""
  };
  let i = 0;
  while (i < cls.length) {
    const cl = cls[i];
    const isPromptContext = cl.text.startsWith("prompt:") || cl.text.startsWith("showprompt:") || i > 0 && (cls[i - 1].text === "prompt: |" || cls[i - 1].text === "showprompt: |") && cl.indent > cls[i - 1].indent;
    if (!isPromptContext && (!cl.text.trim() || cl.text.trim().startsWith("#"))) {
      i++;
      continue;
    }
    const line = isPromptContext ? cl.text : normalizeSymbols(cl.text);
    if (line === "prompt: |") {
      i++;
      const pl = [];
      while (i < cls.length && cls[i].indent > cl.indent) {
        pl.push(cls[i].text);
        i++;
      }
      action.prompt = pl.join("\n");
      continue;
    }
    if (line.startsWith("prompt:") && !line.endsWith("|")) {
      const after = line.slice(7).trim();
      action.prompt = after;
      i++;
      continue;
    }
    if (line === "showprompt: |") {
      i++;
      const spl = [];
      while (i < cls.length && cls[i].indent > cl.indent) {
        spl.push(cls[i].text);
        i++;
      }
      action.showprompt = spl.join("\n");
      continue;
    }
    if (line.startsWith("showprompt:")) {
      const after = line.slice(11).trim();
      action.showprompt = after;
      i++;
      continue;
    }
    if (line.startsWith("in:")) {
      const after = line.slice(3).trim();
      if (after) {
        action.inMappings = after;
        i++;
      } else {
        i++;
        const il = [];
        let guard = 0;
        while (i < cls.length && cls[i].indent > cl.indent) {
          if (++guard > 500)
            rep.fail(`in \u5B57\u6BB5\u89E3\u6790\u9677\u5165\u6B7B\u5FAA\u73AF`, { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: `action ${action.name}` });
          il.push(normalizeSymbols(cls[i].text));
          i++;
        }
        action.inMappings = il.join("\n");
      }
      continue;
    }
    if (line.startsWith("out:")) {
      const after = line.slice(4).trim();
      if (after) {
        action.outVars = after;
        i++;
        const ol = [];
        while (i < cls.length && cls[i].indent > cl.indent) {
          const t2 = normalizeSymbols(cls[i].text).trim();
          if (t2 && !t2.startsWith("#")) ol.push(t2);
          i++;
        }
        if (ol.length > 0) action.outVars = after + "\n" + ol.join("\n");
      } else {
        i++;
        const ol = [];
        while (i < cls.length && cls[i].indent > cl.indent) {
          ol.push(normalizeSymbols(cls[i].text));
          i++;
        }
        action.outVars = ol.join("\n");
      }
      continue;
    }
    if (line.startsWith("scope:")) {
      action.scope = line.slice(6).trim();
      i++;
      continue;
    }
    if (line.startsWith("memory:")) {
      action.memory = line.slice(7).trim();
      i++;
      continue;
    }
    if (line.startsWith("context:")) {
      action.context = line.slice(8).trim();
      i++;
      continue;
    }
    if (line.startsWith("resolve:")) {
      action.resolve = line.slice(8).trim();
      i++;
      continue;
    }
    if (line.startsWith("max_retries:")) {
      action.max_retries = Number(line.slice(12).trim());
      i++;
      continue;
    }
    if (line.startsWith("fallback:")) {
      action.fallback = line.slice(9).trim();
      i++;
      continue;
    }
    if (line.startsWith("interrupt:")) {
      action.interrupt = line.slice(10).trim();
      i++;
      continue;
    }
    rep.fail(
      `\u672A\u8BC6\u522B\u7684 action \u5B50\u5B57\u6BB5: "${cl.text}"\u3002\u5408\u6CD5: prompt:, in:, out:, scope:, memory:, context:, resolve:, max_retries:, fallback:, interrupt:`,
      { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: `action ${action.name}` }
    );
  }
  return action;
}
function parseModuleBlock(header, cls, rep = null, headerLineNum = null) {
  rep = rep || createReporter();
  const hm = header.match(/^module\s+([\w\u4e00-\u9fff]+)(?:\s*\(([^)]*)\))?\s*:?\s*$/);
  if (!hm)
    rep.fail(
      `Module \u58F0\u660E\u683C\u5F0F\u9519\u8BEF: "${header}"\u3002\u671F\u671B: module Name:`,
      { line: (headerLineNum ?? -1) + 1, lineText: header, where: "module \u533A" }
    );
  const mod = {
    name: hm[1],
    params: hm[2] ? hm[2].split(",").map((s) => s.trim()).filter(Boolean) : [],
    meta: {},
    code: [],
    vars: [],
    actions: [],
    nodeDecls: [],
    edges: []
  };
  const subBlocks = [];
  let cur = null;
  const nonEmpty = cls.filter((cl) => cl.text.trim());
  const baseIndent = nonEmpty.length > 0 ? Math.min(...nonEmpty.map((cl) => cl.indent)) : 0;
  for (const cl of cls) {
    if (!cl.text.trim()) continue;
    if (cl.indent === baseIndent) {
      if (cur) subBlocks.push(cur);
      const headerText = cl.text.trim();
      if (headerText.startsWith("//") || headerText.startsWith("#")) {
        cur = null;
      } else {
        cur = { header: cl.text, headerLineNum: cl.lineNum, contentLines: [] };
      }
    } else if (cur && cl.indent > baseIndent) {
      cur.contentLines.push({ ...cl, indent: cl.indent - baseIndent });
    }
  }
  if (cur) subBlocks.push(cur);
  for (const sb of subBlocks) {
    const hdr = normalizeSymbols(sb.header);
    if (hdr === "vars:") {
      mod.vars = parseVarsBlock(sb.contentLines, rep);
    } else if (hdr === "meta:") {
      mod.meta = parseMetaBlock(sb.contentLines, rep);
    } else if (hdr === "code:") {
      mod.code = parseCodeBlock(sb.contentLines, rep);
    } else if (hdr.startsWith("action ")) {
      mod.actions.push(
        parseActionBlock(normalizeSymbols(sb.header), sb.contentLines, rep, sb.headerLineNum)
      );
    } else if (hdr === "flow:") {
      const { nodeDecls, edges } = parseFlowSection(sb.contentLines, [], rep);
      mod.nodeDecls = nodeDecls;
      mod.edges = edges;
    } else if (hdr === "sketch:") {
      mod.layout = parseLayoutBlock(sb.contentLines);
    } else if (hdr.startsWith("module ")) {
      const subMod = parseModuleBlock(hdr, sb.contentLines, rep, sb.headerLineNum);
      if (!mod.subModules) mod.subModules = [];
      mod.subModules.push(subMod);
    } else {
      rep.fail(
        `Module \u5185\u672A\u8BC6\u522B\u7684\u5B50\u5757: "${sb.header}"\u3002\u5408\u6CD5: vars:, meta:, code:, action ..., module ..., flow:`,
        { line: (sb.headerLineNum ?? -1) + 1, lineText: sb.header, where: `module ${mod.name}` }
      );
    }
  }
  return mod;
}
function parseMainflowBlock(cls, rep = null) {
  rep = rep || createReporter();
  const nonCommentLines = cls.filter((l) => {
    const t = normalizeSymbols(l.text).trim();
    return t && !t.startsWith("//") && !t.startsWith("#");
  });
  if (nonCommentLines.length === 0) {
    return { nodeDecls: [], edges: [], layout: {} };
  }
  const baseIndent = Math.min(...nonCommentLines.map((l) => l.indent));
  const groups = [];
  let currentGroup = null;
  for (const cl of cls) {
    if (cl.indent === baseIndent) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = { header: cl, lines: [] };
    } else if (currentGroup && cl.indent > baseIndent) {
      currentGroup.lines.push(cl);
    }
  }
  if (currentGroup) groups.push(currentGroup);
  let flowLines = [];
  let layout = {};
  for (const group of groups) {
    const headerText = normalizeSymbols(group.header.text);
    if (headerText === "sketch:") {
      layout = parseLayoutBlock(group.lines);
    } else {
      flowLines.push(group.header);
      flowLines.push(...group.lines);
    }
  }
  if (groups.length === 0) {
    flowLines = cls;
  }
  const result = parseFlowSection(flowLines, [], rep);
  result.layout = layout;
  return result;
}
function parseFlowSection(flowLines, existingLabels, rep = null) {
  rep = rep || createReporter();
  console.log("parseFlowSection \u88AB\u8C03\u7528\uFF0CflowLines:");
  const nodeDecls = [];
  const edges = [];
  let currentNode = null;
  const usedLabels = new Set(existingLabels || []);
  const addEdge = (edge) => {
    const newCond = (edge.cond || "").trim();
    console.log(`[DEBUG] addEdge: src="${edge.srcLabel}" -> tgt="${edge.tgtLabel}", cond="${newCond}", isBack=${edge.isBack}`);
    const existing = edges.filter(
      (e) => e.srcLabel === edge.srcLabel && e.tgtLabel === edge.tgtLabel
    );
    console.log(`[DEBUG] \u5DF2\u6709\u540Csrc\u2192tgt\u8FB9\u6570: ${existing.length}, \u73B0\u6709cond\u5217\u8868: [${existing.map((e) => JSON.stringify((e.cond || "").trim())).join(", ")}]`);
    if (existing.length === 0) {
      console.log(`[addEdge] \u65E0\u51B2\u7A81, \u76F4\u63A5\u52A0\u5165`);
      edges.push(edge);
      return;
    }
    const exactMatch = existing.find((e) => (e.cond || "").trim() === newCond);
    if (exactMatch) {
      console.log(`[addEdge] \u5B8C\u5168\u76F8\u540C cond "${newCond}" \u5DF2\u5B58\u5728, \u8DF3\u8FC7\u65B0\u8FB9`);
      return;
    }
    const newIsConditional = newCond !== "";
    const hasAnyConditional = existing.some((e) => (e.cond || "").trim() !== "");
    const allUnconditional = existing.every((e) => (e.cond || "").trim() === "");
    console.log(`[DEBUG] newIsConditional=${newIsConditional}, hasAnyConditional=${hasAnyConditional}, allUnconditional=${allUnconditional}`);
    if (!newIsConditional && hasAnyConditional) {
      const keptCond = existing.find((e) => (e.cond || "").trim() !== "").cond;
      console.log(`[addEdge] \u89C4\u52192: \u65B0\u8FB9\u65E0\u6761\u4EF6\uFF0C\u5DF2\u6709\u6761\u4EF6\u8FB9 "${(keptCond || "").trim()}" \u2192 \u4E22\u5F03\u65B0\u8FB9`);
      return;
    }
    if (newIsConditional && allUnconditional) {
      console.log(`[addEdge] \u89C4\u52192: \u65B0\u8FB9\u6709\u6761\u4EF6 "${newCond}"\uFF0C\u5DF2\u6709\u5168\u65E0\u6761\u4EF6 \u2192 \u5220\u9664\u5DF2\u6709\u65E0\u6761\u4EF6\u8FB9\uFF0C\u52A0\u5165\u65B0\u6761\u4EF6\u8FB9`);
      const indicesToRemove = existing.map((e) => edges.indexOf(e)).filter((i2) => i2 !== -1).sort((a, b) => b - a);
      for (const idx of indicesToRemove) {
        edges.splice(idx, 1);
      }
      edges.push(edge);
      return;
    }
    if (newIsConditional && hasAnyConditional) {
      const existingConds = existing.map((e) => (e.cond || "").trim());
      rep.fail(
        `\u8FB9\u51B2\u7A81: "${edge.srcLabel}" \u2192 "${edge.tgtLabel}" \u5DF2\u5B58\u5728\u6761\u4EF6\u8FB9 (\u6761\u4EF6: "${existingConds.join('", "')}"), \u65B0\u8FB9\u6761\u4EF6\u4E3A "${newCond}"\u3002\u540C\u4E00 src\u2192tgt \u4E0D\u5141\u8BB8\u540C\u65F6\u5B58\u5728\u4E24\u6761\u4E0D\u540C\u6761\u4EF6\u7684\u8FB9\uFF0C\u8BF7\u68C0\u67E5\u6D41\u7A0B\u7ED3\u6784`,
        { where: "flow" }
      );
    }
    console.log(`[addEdge] \u515C\u5E95: \u90FD\u65E0\u6761\u4EF6 (${existing.length}\u6761\u5DF2\u6709), \u52A0\u5165`);
    edges.push(edge);
  };
  function ensureNodeForRef(ref) {
    console.log("ensureNodeForRef \u88AB\u8C03\u7528:", ref);
    if (ref.includes("->")) {
      console.trace("\u5F02\u5E38\u8282\u70B9\u5F15\u7528\uFF08\u542B ->\uFF09:", ref);
      rep.fail(`ensureNodeForRef \u6536\u5230\u975E\u6CD5\u5F15\u7528: "${ref}"`, { where: "flow" });
    }
    const trimmed = ref.trim();
    const bracketMatch = trimmed.match(/^\[(.+)\]$/);
    if (bracketMatch) {
      const label2 = bracketMatch[1];
      if (!usedLabels.has(label2) && !nodeDecls.some((d) => d.label === label2)) {
        nodeDecls.push({ label: label2, ref: "" });
        usedLabels.add(label2);
      }
      return label2;
    }
    const inlineMatch = trimmed.match(/^\[(.+?)\]:\s*(.*)$/);
    if (inlineMatch) {
      const label2 = inlineMatch[1];
      const refVal = inlineMatch[2].trim();
      if (!usedLabels.has(label2) && !nodeDecls.some((d) => d.label === label2)) {
        nodeDecls.push({ label: label2, ref: refVal });
        usedLabels.add(label2);
      }
      return label2;
    }
    let baseName = trimmed.startsWith("&") ? trimmed.substring(1) : trimmed;
    baseName = baseName.replace(/\(.*$/, "").trim();
    let label = baseName;
    let counter = 2;
    while (usedLabels.has(label) || nodeDecls.some((d) => d.label === label)) {
      label = `${baseName}_${counter}`;
      counter++;
    }
    nodeDecls.push({ label, ref: trimmed });
    usedLabels.add(label);
    return label;
  }
  function resolveTarget(srcLabel, targetRaw, cond) {
    console.log("resolveTarget:", srcLabel, "->", targetRaw, "cond:", cond);
    console.log(`[DEBUG] resolveTarget: src="${srcLabel}", target="${targetRaw}", cond="${cond}"`);
    if (targetRaw == null) {
      console.trace("resolveTarget \u6536\u5230\u7A7A targetRaw\uFF0CsrcLabel:", srcLabel);
      rep.fail(`resolveTarget \u6536\u5230\u7A7A targetRaw\uFF0CsrcLabel: ${srcLabel}`, { where: "flow" });
    }
    const trimmed = targetRaw.trim().replace(/：/g, ":");
    const inlineMatch = trimmed.match(/^\[(.+?)\]:\s*(.*)$/);
    if (inlineMatch) {
      const label2 = inlineMatch[1];
      const ref = inlineMatch[2].trim();
      if (!usedLabels.has(label2) && !nodeDecls.some((d) => d.label === label2)) {
        nodeDecls.push({ label: label2, ref });
        usedLabels.add(label2);
      }
      addEdge({ srcLabel, tgtLabel: label2, cond, isBack: false });
      return label2;
    }
    const bracketMatch = trimmed.match(/^\[(.+)\]$/);
    if (bracketMatch) {
      const label2 = bracketMatch[1];
      if (!usedLabels.has(label2) && !nodeDecls.some((d) => d.label === label2)) {
        nodeDecls.push({ label: label2, ref: "" });
        usedLabels.add(label2);
      }
      addEdge({ srcLabel, tgtLabel: label2, cond, isBack: false });
      return label2;
    }
    let nodeLabel = trimmed.startsWith("&") ? trimmed.substring(1) : trimmed;
    const baseName = nodeLabel.replace(/\(.*$/, "").trim();
    let label = baseName;
    let counter = 2;
    while (usedLabels.has(label) || nodeDecls.some((d) => d.label === label)) {
      label = `${baseName}_${counter}`;
      counter++;
    }
    nodeDecls.push({ label, ref: trimmed.trim() });
    usedLabels.add(label);
    addEdge({ srcLabel, tgtLabel: label, cond, isBack: false });
    return label;
  }
  function resolveChainEntry(raw) {
    const parts = raw.split("->").map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return ensureNodeForRef(parts[0] || raw.trim());
    let prev = ensureNodeForRef(parts[0]);
    for (let k = 1; k < parts.length; k++) {
      prev = resolveTarget(prev, parts[k], "");
    }
    return prev;
  }
  function resolveExitChain(raw, srcLabel) {
    const parts = raw.split("->").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return srcLabel;
    let cur = srcLabel;
    for (const part of parts) {
      const ifMatch = part.match(/^if\s*\((.+)\)$/);
      if (ifMatch) {
        const rest = part.slice(part.indexOf(")") + 1).trim();
        cur = resolveTarget(cur, rest, ifMatch[1].trim());
      } else {
        cur = resolveTarget(cur, part, "");
      }
    }
    return cur;
  }
  for (const line of flowLines) {
    let t = normalizeSymbols(line.text, "flow");
    console.log("\u89C4\u8303\u5316\u524D:", line.text);
    const parts = t.split("->").map((p) => {
      let s = p.trim();
      if (!s) return "";
      if (s.startsWith("[")) return s;
      if (/^[^:]+\s*:\s*.+/.test(s)) return s;
      if (/\b(if|for|while|fork|par|join|in|to|all)\b/.test(s) || /[()]/.test(s)) {
        return s;
      }
      if (s.startsWith("&")) {
        const label = ensureNodeForRef(s);
        return `[${label}]`;
      }
      if (/^[\p{L}_][\p{L}\p{N}_]*$/u.test(s)) {
        const label = ensureNodeForRef(s);
        return `[${label}]`;
      }
      return s;
    });
    line.text = parts.join(" -> ");
    console.log("\u89C4\u8303\u5316\u540E:", line.text);
  }
  let i = 0;
  let loopGuard = 0;
  while (i < flowLines.length) {
    if (++loopGuard > flowLines.length * 20) {
      rep.fail(`\u6D41\u7A0B\u89E3\u6790\u9677\u5165\u6B7B\u5FAA\u73AF`, { line: (flowLines[i]?.lineNum ?? i) + 1, lineText: flowLines[i]?.raw || "", where: "flow" });
    }
    const cl = flowLines[i];
    if (!cl) break;
    let text = normalizeSymbols(cl.text, "flow").trim();
    console.log(">>> LINE", cl.lineNum + 1, JSON.stringify(text));
    if (!text || text.startsWith("//")) {
      i++;
      continue;
    }
    if (text.startsWith("//")) {
      i++;
      continue;
    }
    if (text.startsWith("#")) {
      i++;
      continue;
    }
    const forkMatch = text.match(/^(.+)\s*->\s*fork:$/);
    if (forkMatch) {
      const srcLabel = resolveChainEntry(forkMatch[1].trim());
      i++;
      let forkGuard = 0;
      while (i < flowLines.length && flowLines[i].indent > cl.indent) {
        if (++forkGuard > 500) rep.fail(`fork \u5206\u652F\u89E3\u6790\u6B7B\u5FAA\u73AF`, { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "flow" });
        const rawLine = flowLines[i].text;
        const bl = normalizeSymbols(rawLine, "flow").trim();
        const bm = bl.match(/^->\s*(?:if\s*\((.+?)\)\s*->\s*)?(.+)$/);
        if (bm) {
          const cond = bm[1] || "";
          const rest = bm[2].trim();
          const parts = rest.split("->").map((p) => p.trim()).filter((p) => p !== "");
          if (parts.length === 0) rep.fail(`fork \u5206\u652F\u7F3A\u5C11\u76EE\u6807`, { line: flowLines[i].lineNum + 1, lineText: flowLines[i].raw || rawLine, where: "flow" });
          let curSrc = srcLabel;
          let first = true;
          for (const part of parts) {
            curSrc = resolveTarget(curSrc, part, first ? cond : "");
            first = false;
          }
        } else {
          rep.fail(`fork \u5206\u652F\u683C\u5F0F\u9519\u8BEF: "${rawLine}"`, { line: flowLines[i].lineNum + 1, lineText: flowLines[i].raw || rawLine, where: "flow" });
        }
        i++;
      }
      continue;
    }
    const parMatch = text.match(/^(.+)\s*->\s*par\s+(.+):$/);
    if (parMatch) {
      const entryRaw = parMatch[1].trim();
      const condition = parMatch[2].trim();
      const entryLabel = resolveChainEntry(entryRaw);
      let parLabel = "PAR";
      let counter = 2;
      while (nodeDecls.some((d) => d.label === parLabel)) {
        parLabel = `PAR_${counter}`;
        counter++;
      }
      const parNodeLabel = parLabel;
      const parOutLabel = parLabel + "_out";
      nodeDecls.push({
        label: parNodeLabel,
        ref: "",
        specialType: "PAR",
        forCondition: condition
      });
      if (!nodeDecls.some((d) => d.label === parOutLabel)) {
        nodeDecls.push({
          label: parOutLabel,
          ref: "",
          specialType: "PAR_OUT",
          forNodeId: parNodeLabel
        });
      }
      addEdge({ srcLabel: entryLabel, tgtLabel: parNodeLabel, cond: "", isBack: false });
      i++;
      const rawBodyLines = [];
      while (i < flowLines.length && flowLines[i].indent > cl.indent) {
        rawBodyLines.push(flowLines[i]);
        i++;
      }
      if (rawBodyLines.length === 0) {
        rep.fail(`par \u5757\u4E0D\u80FD\u4E3A\u7A7A`, { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "flow" });
      }
      const pendingBackNodes = [];
      const cleanBodyLines = [];
      for (const bl of rawBodyLines) {
        let textBody = normalizeSymbols(bl.text, "flow").trim();
        let lastNodeInLine = null;
        if (textBody.startsWith("->")) {
          const restAfterStart = textBody.substring(2).trim();
          const ifMatch = restAfterStart.match(/^if\s*\((.+?)\)\s*->\s*(.*)$/);
          let startCond = "";
          if (ifMatch) {
            startCond = ifMatch[1].trim();
            textBody = ifMatch[2].trim();
          } else {
            textBody = restAfterStart;
          }
          const parts = textBody.split("->").map((x) => x.trim()).filter(Boolean);
          if (!parts.length) {
            rep.fail(`par \u5185\u90E8\u884C\u9996 -> \u540E\u9762\u7F3A\u5C11\u76EE\u6807`, { line: bl.lineNum + 1, lineText: bl.raw || bl.text, where: "flow" });
          }
          const firstPart = parts[0];
          const tgtLabel = resolveTarget(parNodeLabel, firstPart, startCond);
          lastNodeInLine = tgtLabel;
        }
        let endsWithArrow = false;
        if (textBody.endsWith("->")) {
          textBody = textBody.slice(0, -2).trim();
          endsWithArrow = true;
        }
        if (textBody) {
          const parts = textBody.split("->").map((p) => p.trim()).filter((p) => p !== "");
          if (parts.length > 0) {
            const lastPart = parts[parts.length - 1];
            const labelMatch = lastPart.match(/^\[(.+?)\]/);
            if (labelMatch) {
              lastNodeInLine = labelMatch[1];
            } else {
              lastNodeInLine = ensureNodeForRef(lastPart);
            }
          }
        } else if (!lastNodeInLine) {
          rep.fail(`par \u5185\u90E8\u884C\u7F3A\u5C11\u8282\u70B9`, { line: bl.lineNum + 1, lineText: bl.raw || bl.text, where: "flow" });
        }
        if (endsWithArrow && lastNodeInLine) {
          pendingBackNodes.push(lastNodeInLine);
        }
        if (textBody) {
          cleanBodyLines.push({
            ...bl,
            text: textBody
          });
        }
      }
      if (cleanBodyLines.length > 0) {
        const minIndent = Math.min(...cleanBodyLines.map((l) => l.indent));
        const normalizedLines = cleanBodyLines.map((l) => ({
          ...l,
          indent: l.indent - minIndent + 2
        }));
        const { nodeDecls: bodyDecls, edges: bodyEdges } = parseFlowSection(
          normalizedLines,
          [...usedLabels],
          rep
        );
        bodyDecls.forEach((d) => {
          if (!nodeDecls.some((existing) => existing.label === d.label)) {
            nodeDecls.push(d);
          }
        });
        bodyEdges.forEach((be) => addEdge(be));
      }
      pendingBackNodes.forEach((pbLabel) => {
        addEdge({ srcLabel: pbLabel, tgtLabel: parOutLabel, cond: "", isBack: false });
      });
      if (i < flowLines.length && flowLines[i].indent === cl.indent) {
        const afterLine = normalizeSymbols(flowLines[i].text, "flow").trim();
        const am = afterLine.match(/^->\s*(.+)$/);
        if (am) {
          const exitTargetRaw = am[1].trim();
          const ctrlMatch = exitTargetRaw.match(/\s*->\s*(for|par|fork|join)\b/);
          if (ctrlMatch) {
            const chainPart = exitTargetRaw.slice(0, ctrlMatch.index).trim();
            if (chainPart) {
              resolveExitChain(chainPart, parOutLabel);
            }
          } else {
            resolveExitChain(exitTargetRaw, parOutLabel);
            i++;
          }
        }
      }
      currentNode = parOutLabel;
      continue;
    }
    const jm = text.match(/^join\((\w+)\):$/);
    if (jm) {
      const joinParam = jm[1];
      i++;
      const sources = [];
      while (i < flowLines.length && !flowLines[i].text.trim().startsWith("to ")) {
        const rawLine = flowLines[i].text;
        const srcLine = rawLine.trim();
        if (!srcLine.endsWith("->")) {
          rep.fail(`join \u5185\u90E8\u6BCF\u884C\u5FC5\u987B\u4EE5 -> \u7ED3\u5C3E\u3002\u5F53\u524D\u884C: "${rawLine}"`, { line: flowLines[i].lineNum + 1, lineText: flowLines[i].raw || rawLine, where: "flow" });
        }
        const sm = srcLine.match(/^\[([^\[\]]+?)\]\s*->$/);
        if (sm) {
          sources.push(sm[1]);
        } else {
          rep.fail(`join \u6E90\u8282\u70B9\u683C\u5F0F\u9519\u8BEF\uFF0C\u671F\u671B [\u8282\u70B9\u540D] ->\uFF0C\u5B9E\u9645: "${rawLine}"`, { line: flowLines[i].lineNum + 1, lineText: flowLines[i].raw || rawLine, where: "flow" });
        }
        i++;
      }
      if (i < flowLines.length && flowLines[i].text.trim().startsWith("to ")) {
        let targetRaw = flowLines[i].text.trim().slice(3).trim();
        if (!targetRaw) rep.fail(`join \u76EE\u6807\u4E3A\u7A7A`, { line: flowLines[i].lineNum + 1, lineText: flowLines[i].raw || "", where: "flow" });
        if (targetRaw.endsWith("->")) {
          targetRaw = targetRaw.slice(0, -2).trim();
        }
        const parts = targetRaw.split("->").map((p) => p.trim()).filter(Boolean);
        if (parts.length === 0) rep.fail(`join \u76EE\u6807\u4E3A\u7A7A`, { line: flowLines[i].lineNum + 1, lineText: flowLines[i].raw || "", where: "flow" });
        const tgtLabel = ensureNodeForRef(parts[0]);
        let tail = tgtLabel;
        for (let k = 1; k < parts.length; k++) {
          tail = resolveTarget(tail, parts[k], "");
        }
        sources.forEach((s) => addEdge({ srcLabel: s, tgtLabel, cond: "", isBack: false }));
        const tgtDecl = nodeDecls.find((d) => d.label === tgtLabel);
        if (tgtDecl) {
          if (!tgtDecl.joinEntries) tgtDecl.joinEntries = [];
          tgtDecl.joinEntries.push({ sources: sources.slice(), param: joinParam });
        } else {
          const newDecl = { label: tgtLabel, ref: "", joinEntries: [{ sources: sources.slice(), param: joinParam }] };
          nodeDecls.push(newDecl);
          usedLabels.add(tgtLabel);
        }
        currentNode = tail;
        i++;
      } else {
        rep.fail(`join \u7F3A\u5C11 to \u76EE\u6807`, { line: (flowLines[i]?.lineNum ?? flowLines.length) + 1, lineText: flowLines[i]?.raw || "", where: "flow" });
      }
      continue;
    }
    const forEntryMatch = text.match(/^(.+)\s*->\s*for\s+(.+):$/);
    if (forEntryMatch) {
      const entryRaw = forEntryMatch[1].trim();
      const condition = forEntryMatch[2].trim();
      const entryLabel = resolveChainEntry(entryRaw);
      let forLabel = "FOR";
      let counter = 2;
      while (nodeDecls.some((d) => d.label === forLabel)) {
        forLabel = `FOR_${counter}`;
        counter++;
      }
      const forNodeLabel = forLabel;
      const forOutLabel = forLabel + "_out";
      nodeDecls.push({
        label: forNodeLabel,
        ref: "",
        specialType: "FOR",
        forCondition: condition
      });
      addEdge({ srcLabel: entryLabel, tgtLabel: forNodeLabel, cond: "", isBack: false });
      i++;
      const rawBodyLines = [];
      while (i < flowLines.length && flowLines[i].indent > cl.indent) {
        rawBodyLines.push(flowLines[i]);
        i++;
      }
      if (rawBodyLines.length === 0) {
        rep.fail(`for \u5757\u4E0D\u80FD\u4E3A\u7A7A`, { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "flow" });
      }
      const pendingBackNodes = [];
      const cleanBodyLines = [];
      for (const bl of rawBodyLines) {
        let textBody = normalizeSymbols(bl.text, "flow").trim();
        let lastNodeInLine = null;
        if (textBody.startsWith("->")) {
          const restAfterStart = textBody.substring(2).trim();
          const ifMatch = restAfterStart.match(/^if\s*\((.+?)\)\s*->\s*(.*)$/);
          let startCond = "";
          if (ifMatch) {
            startCond = ifMatch[1].trim();
            textBody = ifMatch[2].trim();
          } else {
            textBody = restAfterStart;
          }
          const parts = textBody.split("->").map((x) => x.trim()).filter(Boolean);
          if (!parts.length) {
            rep.fail(`for \u5185\u90E8\u884C\u9996 -> \u540E\u9762\u7F3A\u5C11\u76EE\u6807`, { line: bl.lineNum + 1, lineText: bl.raw || bl.text, where: "flow" });
          }
          const firstPart = parts[0];
          const tgtLabel = resolveTarget(
            forNodeLabel,
            firstPart,
            startCond
          );
          lastNodeInLine = tgtLabel;
        }
        let endsWithArrow = false;
        if (textBody.endsWith("->")) {
          textBody = textBody.slice(0, -2).trim();
          endsWithArrow = true;
        }
        if (textBody) {
          const parts = textBody.split("->").map((p) => p.trim()).filter((p) => p !== "");
          if (parts.length > 0) {
            const lastPart = parts[parts.length - 1];
            const labelMatch = lastPart.match(/^\[(.+?)\]/);
            if (labelMatch) {
              lastNodeInLine = labelMatch[1];
            } else {
              const lbl = ensureNodeForRef(lastPart);
              lastNodeInLine = lbl;
            }
          }
        } else if (!lastNodeInLine) {
          rep.fail(`for \u5185\u90E8\u884C\u7F3A\u5C11\u8282\u70B9`, { line: bl.lineNum + 1, lineText: bl.raw || bl.text, where: "flow" });
        }
        if (endsWithArrow && lastNodeInLine) {
          pendingBackNodes.push(lastNodeInLine);
        }
        if (textBody) {
          cleanBodyLines.push({
            ...bl,
            text: textBody
          });
        }
      }
      if (cleanBodyLines.length > 0) {
        const minIndent = Math.min(...cleanBodyLines.map((l) => l.indent));
        const normalizedLines = cleanBodyLines.map((l) => ({
          ...l,
          indent: l.indent - minIndent + 2
        }));
        const { nodeDecls: bodyDecls, edges: bodyEdges } = parseFlowSection(
          normalizedLines,
          [...usedLabels],
          rep
        );
        bodyDecls.forEach((d) => {
          if (!nodeDecls.some((existing) => existing.label === d.label)) {
            nodeDecls.push(d);
          }
        });
        bodyEdges.forEach((be) => addEdge(be));
      }
      pendingBackNodes.forEach((pbLabel) => {
        addEdge({ srcLabel: pbLabel, tgtLabel: forNodeLabel, cond: "", isBack: true });
      });
      console.log("FOR\u51FA\u53E3\u8BCA\u65AD:", {
        i,
        lineText: flowLines[i]?.text,
        lineIndent: flowLines[i]?.indent,
        forIndent: cl.indent,
        isMatch: flowLines[i]?.indent === cl.indent
      });
      if (i < flowLines.length && flowLines[i].indent === cl.indent) {
        const afterLine = normalizeSymbols(flowLines[i].text, "flow").trim();
        const am = afterLine.match(/^->\s*(.+)$/);
        if (am) {
          if (!nodeDecls.some((d) => d.label === forOutLabel)) {
            nodeDecls.push({
              label: forOutLabel,
              ref: "",
              specialType: "FOR_OUT",
              forNodeId: forNodeLabel
            });
          }
          const exitTargetRaw = am[1].trim();
          const ctrlMatch = exitTargetRaw.match(/\s*->\s*(for|par|fork|join)\b/);
          if (ctrlMatch) {
            const chainPart = exitTargetRaw.slice(0, ctrlMatch.index).trim();
            if (chainPart) {
              resolveExitChain(chainPart, forOutLabel);
            }
          } else {
            resolveExitChain(exitTargetRaw, forOutLabel);
            i++;
          }
        }
      }
      currentNode = forOutLabel;
      continue;
    }
    const dmChain = text.match(/^\[([^\[\]]+?)\]:\s*(\S+)\s*->\s*(.+)$/);
    if (dmChain) {
      const label = dmChain[1];
      const ref = dmChain[2].trim();
      const existing = nodeDecls.find((d) => d.label === label);
      if (existing) existing.ref = ref || existing.ref;
      else nodeDecls.push({ label, ref });
      i++;
      const rest = dmChain[3].trim();
      const rawParts = rest.split("->").map((p) => p.trim()).filter((p) => p !== "");
      const parts = [];
      let pendingCond = null;
      for (const part of rawParts) {
        const ifMatch = part.match(/^if\s*\((.+)\)$/);
        if (ifMatch) {
          pendingCond = ifMatch[1].trim();
        } else {
          parts.push({ target: part, cond: pendingCond || "" });
          pendingCond = null;
        }
      }
      if (pendingCond) {
        rep.fail(
          `\u6761\u4EF6 "if (${pendingCond})" \u540E\u9762\u7F3A\u5C11\u76EE\u6807\u8282\u70B9`,
          { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "flow" }
        );
      }
      let currentSrc = label;
      for (const { target, cond } of parts) {
        currentSrc = resolveTarget(currentSrc, target, cond);
      }
      currentNode = currentSrc;
      continue;
    }
    const chainMatch = text.match(/^\[(.+?)\]\s*->\s*(.*)$/);
    if (chainMatch) {
      const srcLabel = chainMatch[1];
      let rest = chainMatch[2];
      i++;
      if (!nodeDecls.some((d) => d.label === srcLabel)) {
        nodeDecls.push({ label: srcLabel, ref: "" });
      }
      const rawParts = rest.split("->").map((p) => p.trim()).filter((p) => p !== "");
      const parts = [];
      let pendingCond = null;
      for (const part of rawParts) {
        const ifMatch = part.match(/^if\s*\((.+)\)$/);
        if (ifMatch) {
          pendingCond = ifMatch[1].trim();
        } else {
          parts.push({ target: part, cond: pendingCond || "" });
          pendingCond = null;
        }
      }
      if (pendingCond) {
        rep.fail(
          `\u6761\u4EF6 "if (${pendingCond})" \u540E\u9762\u7F3A\u5C11\u76EE\u6807\u8282\u70B9`,
          { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "flow" }
        );
      }
      let currentSrc = srcLabel;
      for (const { target, cond } of parts) {
        currentSrc = resolveTarget(currentSrc, target, cond);
      }
      currentNode = currentSrc;
      continue;
    }
    const soloNodeMatch = text.match(/^\[(.+?)\]\s*$/);
    if (soloNodeMatch && !text.includes("->") && !text.includes(":")) {
      ensureNodeForRef(`[${soloNodeMatch[1]}]`);
      i++;
      continue;
    }
    const dm = text.match(/^\[(.+?)\]:\s*(.*)$/);
    if (dm) {
      const label = dm[1];
      const ref = dm[2].trim();
      const existing = nodeDecls.find((d) => d.label === label);
      if (existing) existing.ref = ref || existing.ref;
      else nodeDecls.push({ label, ref });
      currentNode = label;
      i++;
      continue;
    }
    rep.fail(
      `\u672A\u8BC6\u522B\u7684\u6D41\u7A0B\u8BED\u6CD5: "${text}"`,
      { line: cl.lineNum + 1, lineText: cl.raw || cl.text, where: "flow" }
    );
  }
  return { nodeDecls, edges };
}

// ../../femoGen/src/femoGenerator.jsx
var AUTOVAR_SKIP = /* @__PURE__ */ new Set([
  "and",
  "or",
  "not",
  "in",
  "is",
  "True",
  "False",
  "None",
  "true",
  "false",
  "TRUE",
  "FALSE",
  "string",
  "int",
  "float",
  "bool",
  "boolean",
  "enum",
  "dropdown",
  "object",
  "array",
  "dict",
  "list",
  "str",
  "num",
  "choices",
  "label",
  "add",
  "remove",
  "len",
  "SET_VARIABLE",
  "prompt",
  "llm_output"
]);
function _varIdentity(raw) {
  return raw.startsWith("$") ? raw.slice(1) : raw;
}
function _identRefs(expr) {
  const noStr = String(expr).replace(/"[^"]*"|'[^']*'|“[^”]*”/g, "");
  const out = [];
  (noStr.match(/@?[\w\u4e00-\u9fff]+(?:\.[\w\u4e00-\u9fff]+)*/g) || []).forEach((ident) => {
    const dot = ident.indexOf(".");
    const main = dot >= 0 ? ident.slice(0, dot) : ident;
    if (AUTOVAR_SKIP.has(main)) return;
    if (/^\d+(\.\d+)?$/.test(main)) return;
    out.push(main);
  });
  return out;
}
function _splitTopLevel(s, sep) {
  const items = [];
  let depth = 0;
  let cur = "";
  let q = null;
  for (const ch of String(s)) {
    if (q) {
      cur += ch;
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === sep && depth <= 0) {
      items.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) items.push(cur);
  return items;
}
function collectActionVarUses(a) {
  const uses = [];
  const push = (raw, dv = "") => {
    if (raw) uses.push({ raw, dv });
  };
  String(a.outVars || "").split("\n").forEach((line) => {
    _splitTopLevel(line, ",").forEach((item) => {
      const t = item.trim().replace(/^,+|,+$/g, "");
      if (!t) return;
      const root = (t.match(/^([$@]?[\w\u4e00-\u9fff]+)/) || [])[1];
      if (!root) return;
      const am = t.match(/^([$@]?[\w\u4e00-\u9fff]+)\s*([+\-]?=)\s*(.+)$/);
      if (am) {
        let dv = "";
        if (am[2] === "+=" || am[2] === "-=") dv = "0";
        else if (/^\s*(add|remove)\s*\(/.test(am[3])) dv = "[]";
        else {
          const lit = am[3].trim();
          if (/^("[^"]*"|'[^']*'|“[^”]*”)$/.test(lit) || /^\d+(\.\d+)?$/.test(lit) || /^(true|false)$/.test(lit)) dv = lit;
        }
        push(root, dv);
        _identRefs(am[3]).forEach((r) => push(r));
      } else {
        push(root);
        const cm = t.match(/choices\s*=\s*{([^}]*)}/);
        if (cm) _identRefs(cm[1]).forEach((r) => push(r));
      }
    });
  });
  String(a.inMappings || "").split("\n").forEach((line) => {
    _splitTopLevel(line, ",").forEach((seg) => {
      const s = seg.trim().replace(/^,+|,+$/g, "");
      if (!s) return;
      const eq = s.indexOf("=");
      _identRefs(eq >= 0 ? s.slice(eq + 1) : s).forEach((r) => push(r));
    });
  });
  String(a.resolveArgs || "").split(",").forEach((s) => {
    const t = s.trim();
    if (t && !AUTOVAR_SKIP.has(t)) push(t);
  });
  if (["ai", "human", "mind"].includes(a.executorType) && a.executorActor && a.executorActor.startsWith("@")) {
    push(a.executorActor);
  }
  return uses;
}
function planAutoVars(proj, libActions, libModules) {
  const actions = libActions || [];
  const modules = libModules || [];
  if (!actions.length) return { globalExtra: [], moduleVarsById: /* @__PURE__ */ new Map() };
  const actorNames = /* @__PURE__ */ new Set();
  (proj.actors || []).forEach((x) => {
    if (!x.name) return;
    actorNames.add(x.name.startsWith("@") ? x.name : `@${x.name}`);
  });
  const moduleByScope = /* @__PURE__ */ new Map();
  modules.forEach((m) => moduleByScope.set((m.path || []).join("/"), m));
  const varScopes = /* @__PURE__ */ new Map();
  actions.forEach((a) => {
    const p = a.path || ["mainflow"];
    const scope = p.length === 1 && p[0] === "mainflow" ? "mainflow" : p.join("/");
    collectActionVarUses(a).forEach(({ raw, dv }) => {
      if (raw.startsWith("@") && actorNames.has(raw)) return;
      const id = _varIdentity(raw);
      if (!varScopes.has(id)) varScopes.set(id, /* @__PURE__ */ new Map());
      const m = varScopes.get(id);
      const prev = m.get(scope);
      if (!prev) m.set(scope, { raw, dv });
      else if (!prev.dv && dv) m.set(scope, { raw, dv });
    });
  });
  if (!varScopes.size) return { globalExtra: [], moduleVarsById: /* @__PURE__ */ new Map() };
  const declaredGlobal = new Set((proj.vars || []).map((v) => _varIdentity(v.name)));
  const declaredInMod = /* @__PURE__ */ new Map();
  modules.forEach((m) => declaredInMod.set(m.id, new Set((m.vars || []).map((v) => _varIdentity(v.name)))));
  const globalExtra = [];
  const globalAdded = /* @__PURE__ */ new Set();
  const moduleAdd = /* @__PURE__ */ new Map();
  const moduleRemove = /* @__PURE__ */ new Map();
  const removeModuleDecl = (modId, id) => {
    if (!declaredInMod.get(modId)?.has(id)) return;
    if (!moduleRemove.has(modId)) moduleRemove.set(modId, /* @__PURE__ */ new Set());
    moduleRemove.get(modId).add(id);
  };
  const addGlobal = (decl, id) => {
    if (declaredGlobal.has(id) || globalAdded.has(id)) return;
    globalAdded.add(id);
    globalExtra.push(decl);
  };
  varScopes.forEach((scopeMap, id) => {
    const isMain = scopeMap.has("mainflow");
    const modScopes = [...scopeMap.keys()].filter((k) => k !== "mainflow");
    const crossScope = isMain || scopeMap.size >= 2;
    if (!crossScope) {
      const mod = moduleByScope.get(modScopes[0]);
      if (!mod) return;
      if (declaredGlobal.has(id)) return;
      if (declaredInMod.get(mod.id)?.has(id)) return;
      const owner = modules.find((m) => m.id !== mod.id && declaredInMod.get(m.id)?.has(id));
      if (owner) {
        const hit = (owner.vars || []).find((v) => _varIdentity(v.name) === id);
        addGlobal({ name: hit.name, defaultValue: hit.defaultValue ?? '""' }, id);
        removeModuleDecl(owner.id, id);
        return;
      }
      if (!moduleAdd.has(mod.id)) moduleAdd.set(mod.id, /* @__PURE__ */ new Map());
      const info = scopeMap.get(modScopes[0]);
      moduleAdd.get(mod.id).set(id, { name: info.raw, defaultValue: info.dv || '""' });
      return;
    }
    if (!declaredGlobal.has(id)) {
      let decl = null;
      for (const m of modules) {
        const hit = (m.vars || []).find((v) => _varIdentity(v.name) === id);
        if (hit) {
          decl = { name: hit.name, defaultValue: hit.defaultValue ?? '""' };
          break;
        }
      }
      if (!decl) {
        let dv = "";
        let raw = "";
        scopeMap.forEach((v) => {
          if (!dv && v.dv) {
            dv = v.dv;
            raw = v.raw;
          }
          if (!raw) raw = v.raw;
        });
        decl = { name: raw, defaultValue: dv || '""' };
      }
      addGlobal(decl, id);
    }
    modules.forEach((m) => removeModuleDecl(m.id, id));
  });
  const moduleVarsById = /* @__PURE__ */ new Map();
  modules.forEach((m) => {
    const rm = moduleRemove.get(m.id);
    const add = moduleAdd.get(m.id);
    if (!rm && !add) return;
    const kept = (m.vars || []).filter((v) => !(rm && rm.has(_varIdentity(v.name))));
    const keptIds = new Set(kept.map((v) => _varIdentity(v.name)));
    if (add) add.forEach((decl, id2) => {
      if (!keptIds.has(id2)) kept.push(decl);
    });
    moduleVarsById.set(m.id, kept);
  });
  return { globalExtra, moduleVarsById };
}
function buildFEMO(nodes, edges, proj, mode, modName, libModules, libActions) {
  const preamble = (typeof proj?.preamble === "string" ? proj.preamble : "").replace(/\s+$/, "");
  if (!nodes.length) {
    return preamble ? `${preamble}

# \u7A7A\u753B\u5E03\uFF0C\u8BF7\u6DFB\u52A0\u8282\u70B9` : "# \u7A7A\u753B\u5E03\uFF0C\u8BF7\u6DFB\u52A0\u8282\u70B9";
  }
  const cycleEdgesMap = findAllCycleEdges(nodes, edges);
  const back = findBackEdges(nodes, edges);
  const nm = new Map(nodes.map((n) => [n.id, n]));
  const actionMap = /* @__PURE__ */ new Map();
  (libActions || []).forEach((a) => actionMap.set(a.id, a.name));
  const varPlan = planAutoVars(proj, libActions, libModules);
  const lines = [];
  function emitAction(a, indent) {
    const pfx = "  ".repeat(indent);
    let actorStr;
    if (a.executorType === "func") {
      actorStr = a.executorActor ? `@func(${a.executorActor})` : `@func`;
    } else if (a.executorType === "assign") {
      actorStr = "@assign";
    } else if (a.executorType === "notice") {
      actorStr = "@notice";
    } else {
      actorStr = a.executorActor ? `@${a.executorType}(${a.executorActor})` : `@${a.executorType}`;
    }
    lines.push(`${pfx}action ${a.name} ${actorStr}:`);
    if (a.inMappings) {
      lines.push(`${pfx}  in:`);
      a.inMappings.split("\n").filter(Boolean).forEach((l) => lines.push(`${pfx}    ${l.trim()}`));
    }
    if (a.prompt) {
      lines.push(`${pfx}  prompt: |`);
      a.prompt.split("\n").forEach((l) => lines.push(`${pfx}    ${l}`));
    }
    if (a.showprompt) {
      lines.push(`${pfx}  showprompt: |`);
      a.showprompt.split("\n").forEach((l) => lines.push(`${pfx}    ${l}`));
    }
    if (a.scope) lines.push(`${pfx}  scope: ${a.scope}`);
    if (a.outVars) {
      lines.push(`${pfx}  out:`);
      a.outVars.split("\n").forEach((v) => {
        const vt = v.trim();
        if (vt) lines.push(`${pfx}    ${vt}`);
      });
    }
    if (a.resolve) {
      const args = a.resolveArgs ? `(${a.resolveArgs})` : "";
      lines.push(`${pfx}  resolve: ${a.resolve}${args}`);
    }
    if (a.interrupt) lines.push(`${pfx}  interrupt: ${a.interrupt}`);
    if (a.fallback) lines.push(`${pfx}  fallback: ${a.fallback}`);
    if (a.maxRetries) lines.push(`${pfx}  max_retries: ${a.maxRetries}`);
    if (a.memory) lines.push(`${pfx}  memory: ${a.memory}`);
    if (a.context) lines.push(`${pfx}  context: ${a.context}`);
    lines.push("");
  }
  if (preamble) {
    preamble.split("\n").forEach((l) => lines.push(l));
    lines.push("");
  }
  lines.push("meta:");
  if (proj.id) lines.push(`  id = ${proj.id}`);
  if (proj.name) lines.push(`  name = ${proj.name}`);
  if (proj.version) lines.push(`  version = ${proj.version}`);
  if (proj.owner) lines.push(`  owner = ${proj.owner}`);
  if (proj.database) lines.push(`  database = ${proj.database}`);
  if (proj.session) lines.push(`  session = ${proj.session}`);
  if (proj.delay != null) lines.push(`  delay = ${proj.delay}`);
  if (proj.system_safety) {
    if (typeof proj.system_safety === "string" && proj.system_safety.includes("\n")) {
      lines.push(`  system_safety = |`);
      proj.system_safety.split("\n").forEach((l) => lines.push(`    ${l}`));
    } else {
      lines.push(`  system_safety = ${JSON.stringify(proj.system_safety)}`);
    }
  }
  if (proj.output_style) {
    if (typeof proj.output_style === "string" && proj.output_style.includes("\n")) {
      lines.push(`  output_style = |`);
      proj.output_style.split("\n").forEach((l) => lines.push(`    ${l}`));
    } else {
      lines.push(`  output_style = ${JSON.stringify(proj.output_style)}`);
    }
  }
  const knownKeys = /* @__PURE__ */ new Set(["id", "name", "version", "owner", "database", "session", "delay", "system_safety", "output_style", "vars", "code", "actors"]);
  for (const [key, value] of Object.entries(proj)) {
    if (knownKeys.has(key)) continue;
    if (value === void 0 || value === null || value === "") continue;
    if (typeof value === "string" && value.includes("\n")) {
      lines.push(`  ${key} = |`);
      value.split("\n").forEach((l) => lines.push(`    ${l}`));
    } else {
      lines.push(`  ${key} = ${JSON.stringify(value)}`);
    }
  }
  lines.push("");
  if (proj.actors?.length) {
    lines.push("actors:");
    proj.actors.forEach((a) => {
      const name = a.name?.startsWith("@") ? a.name : `@${a.name}`;
      const parts = [];
      if (a.soul) parts.push(`soul:${a.soul}`);
      if (a.source) parts.push(`source:${a.source}`);
      if (a.type === "ai" && a.thinking) parts.push(`thinking:${a.thinking}`);
      if (a.type === "ai" && a.tools === false) {
        parts.push("tools: false");
      } else if (a.type === "ai" && a.tools === true) {
        parts.push("tools: true");
      } else if (a.type === "ai" && Array.isArray(a.tools) && a.tools.length) {
        parts.push(`tools = [${a.tools.join(", ")}]`);
      } else if (a.type === "ai" && Array.isArray(a.tools)) {
        parts.push("tools: false");
      }
      lines.push(parts.length > 0 ? `  ${a.type} ${name} = ${parts.join(", ")}` : `  ${a.type} ${name}`);
    });
    lines.push("");
  }
  if (proj.code && proj.code.length) {
    lines.push("code:");
    proj.code.forEach((c) => {
      const val = c.value ? `file:"${c.value}"` : '""';
      lines.push(`  ${c.name} = ${val}`);
    });
    lines.push("");
  }
  const allGlobalVars = [...proj.vars || [], ...varPlan.globalExtra];
  if (allGlobalVars.length) {
    lines.push("vars:");
    allGlobalVars.forEach((v) => {
      if (v.name) lines.push(`  ${v.name} = ${v.defaultValue}`);
    });
    lines.push("");
  }
  (libActions || []).filter((a) => a.path && a.path.length === 1 && a.path[0] === "mainflow").forEach((a) => emitAction(a, 0));
  const _emitVisited = /* @__PURE__ */ new Set();
  function emitModule(mod, indentLevel) {
    if (_emitVisited.has(mod.id)) return;
    _emitVisited.add(mod.id);
    const pfx = "  ".repeat(indentLevel);
    lines.push(`${pfx}module ${mod.name}:`);
    if (mod.meta && Object.keys(mod.meta).length) {
      lines.push(`${pfx}  meta:`);
      for (const [k, v] of Object.entries(mod.meta)) {
        if (v === void 0 || v === null || v === "") continue;
        if (typeof v === "string" && v.includes("\n")) {
          lines.push(`${pfx}    ${k} = |`);
          v.split("\n").forEach((l) => lines.push(`${pfx}      ${l}`));
        } else {
          lines.push(`${pfx}    ${k} = ${JSON.stringify(v)}`);
        }
      }
      lines.push("");
    }
    if (mod.code && mod.code.length) {
      lines.push(`${pfx}  code:`);
      mod.code.forEach((c) => lines.push(`${pfx}    ${c.name} = ${c.value}`));
      lines.push("");
    }
    const internalActions = (libActions || []).filter(
      (a) => a.path && a.path.length === mod.path.length && a.path.every((seg, i) => seg === mod.path[i])
    );
    const modVars = varPlan.moduleVarsById.get(mod.id) ?? mod.vars;
    if (modVars?.length) {
      lines.push(`${pfx}  vars:`);
      modVars.forEach((v) => {
        if (v.name) lines.push(`${pfx}    ${v.name} = ${v.defaultValue}`);
      });
      lines.push("");
    }
    internalActions.forEach((a) => emitAction(a, indentLevel + 1));
    const daughterModules = (libModules || []).filter(
      (m) => m.path && m.path.length === mod.path.length + 1 && mod.path.every((seg, i) => seg === m.path[i])
    );
    daughterModules.forEach((m) => emitModule(m, indentLevel + 1));
    lines.push(`${pfx}  flow:`);
    (mod.nodes || []).filter((n) => n.type !== "special" && n.type !== "for_out" && n.type !== "par_out").forEach((n) => {
      const ref = n.type === "module" ? `&${n.modRef || "Module"}` : n.type === "position" ? "" : actionMap.get(n.actionId) || "unnamed";
      lines.push(`${pfx}    ${n.label}: ${ref}`);
    });
    lines.push("");
    const modCycleMap = findAllCycleEdges(mod.nodes || [], mod.edges || []);
    const modBack = findBackEdges(mod.nodes || [], mod.edges || []);
    console.log("[emitModule] \u6A21\u5757:", mod.name, "cycleEdges:", modCycleMap.size, "back:", modBack.size);
    emitFlowLines(mod.nodes || [], mod.edges || [], indentLevel + 2, lines, modCycleMap, modBack);
    lines.push("");
    const modAnchor = (mod.nodes || []).find(
      (n) => n.type === "special" && (n.specialType === "IN" || n.specialType === "START")
    );
    const modSketchNodes = (mod.nodes || []).filter(
      (n) => n.id !== modAnchor?.id && n.type !== "for_out"
    );
    if (modAnchor && modSketchNodes.length > 0) {
      lines.push(`#${pfx}  sketch:`);
      modSketchNodes.forEach((n) => {
        lines.push(`#${pfx}    ${n.label} = ${Math.round(n.x - modAnchor.x)}, ${Math.round(n.y - modAnchor.y)}`);
      });
      lines.push("");
    }
  }
  const topModules = (libModules || []).filter(
    (m) => m.path && m.path.length === 2 && m.path[0] === "mainflow"
  );
  topModules.forEach((m) => emitModule(m, 0));
  lines.push("mainflow:");
  const mainNodes = nodes.filter((n) => n.type !== "special" && n.type !== "for_out" && n.type !== "par_out");
  mainNodes.forEach((n) => {
    const ref = n.type === "module" ? `&${n.modRef || "Module"}` : n.type === "position" ? "" : actionMap.get(n.actionId) || "unnamed";
    lines.push(`  ${n.label}: ${ref}`);
  });
  lines.push("");
  emitFlowLines(nodes, edges, 1, lines, cycleEdgesMap, back);
  const mainAnchor = nodes.find((n) => n.type === "special" && n.specialType === "START");
  const mainSketchNodes = nodes.filter((n) => n.id !== mainAnchor?.id && n.type !== "for_out");
  if (mainAnchor && mainSketchNodes.length > 0) {
    lines.push("\n#sketch:");
    mainSketchNodes.forEach((n) => {
      lines.push(`#  ${n.label} = ${Math.round(n.x - mainAnchor.x)}, ${Math.round(n.y - mainAnchor.y)}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}
function emitFlowLines(nodes, edges, baseIndent, lines, cycleEdgesMap, back) {
  if (!back) {
    console.log("[emitFlowLines] back \u672A\u4F20\u5165, \u91CD\u65B0\u8BA1\u7B97, nodes:", nodes.length, "edges:", edges.length);
    back = findBackEdges(nodes, edges);
  } else {
  }
  const nm = new Map(nodes.map((n) => [n.id, n]));
  const pfx = "  ".repeat(baseIndent);
  const adj = /* @__PURE__ */ new Map();
  const inAdj = /* @__PURE__ */ new Map();
  edges.forEach((e) => {
    if (!adj.has(e.src)) adj.set(e.src, []);
    adj.get(e.src).push(e);
    if (!inAdj.has(e.tgt)) inAdj.set(e.tgt, []);
    inAdj.get(e.tgt).push(e);
  });
  const specialEntryEdgesMap = /* @__PURE__ */ new Map();
  for (const [src, edgeList] of adj.entries()) {
    const specialEdges = edgeList.filter((e) => {
      const tgtNode = nm.get(e.tgt);
      return tgtNode && tgtNode.type === "special" && (tgtNode.specialType === "FOR" || tgtNode.specialType === "PAR");
    });
    if (specialEdges.length > 0) {
      specialEntryEdgesMap.set(src, specialEdges);
      adj.set(src, edgeList.filter((e) => !specialEdges.includes(e)));
    }
  }
  nodes.forEach((node) => {
    if (node.joinEntries && node.joinEntries.length > 0) {
      const allIncoming = (inAdj.get(node.id) || []).filter((e) => !back.has(e.id)).map((e) => {
        const lbl = nm.get(e.src)?.label || "";
        return lbl.replace(/^\[|\]$/g, "");
      }).filter(Boolean);
      const coveredSources = /* @__PURE__ */ new Set();
      node.joinEntries.forEach((entry) => entry.sources.forEach((s) => coveredSources.add(s)));
      const newSources = allIncoming.filter((s) => !coveredSources.has(s));
      if (newSources.length > 0) {
        let allEntry = node.joinEntries.find((e) => e.param === "all");
        if (!allEntry) {
          allEntry = { param: "all", sources: [] };
          node.joinEntries.push(allEntry);
        }
        allEntry.sources.push(...newSources);
      }
    }
  });
  const emittedFors = /* @__PURE__ */ new Set();
  function flowConnector(cond) {
    return cond ? `-> if (${cond}) ->` : "->";
  }
  function emitForBlock(forNodeId, indentLevel) {
    const forNode = nm.get(forNodeId);
    const isPar = forNode.specialType === "PAR";
    const condition = forNode.forCondition || "@item in collection";
    const ipfx = "  ".repeat(indentLevel);
    const incomingEdges = inAdj.get(forNodeId) || [];
    const upstreamEdge = incomingEdges.find((e) => !back.has(e.id));
    const upstreamLabel = upstreamEdge ? nm.get(upstreamEdge.src)?.label : "?";
    const keyword = isPar ? "par" : "for";
    lines.push(`${ipfx}${upstreamLabel} -> ${keyword} ${condition}:`);
    const cycleEdgeSet = cycleEdgesMap.get(forNodeId) || /* @__PURE__ */ new Set();
    const exitType = isPar ? "par_out" : "for_out";
    const forOutNode = nodes.find((n) => n.type === exitType && n.forNodeId === forNodeId);
    const forOutNodeId = forOutNode?.id;
    const entryEdges = [];
    const backEdges = [];
    const internalEdges = [];
    const stack = [forNodeId];
    const visitedForBody = /* @__PURE__ */ new Set();
    while (stack.length > 0) {
      const cur = stack.pop();
      for (const e of adj.get(cur) || []) {
        if (!cycleEdgeSet.has(e.id)) continue;
        if (visitedForBody.has(e.id)) continue;
        visitedForBody.add(e.id);
        if (cur === forNodeId) {
          entryEdges.push(e);
        } else if (e.tgt === forNodeId || forOutNodeId && e.tgt === forOutNodeId) {
          backEdges.push(e);
        } else {
          internalEdges.push({ src: cur, tgt: e.tgt, cond: e.cond || "" });
        }
        if (e.tgt !== forNodeId && e.tgt !== forOutNodeId) {
          stack.push(e.tgt);
        }
      }
    }
    const bodyIndent = indentLevel + 1;
    const bp = "  ".repeat(bodyIndent);
    const entryVisited = /* @__PURE__ */ new Set();
    for (const ee of entryEdges) {
      const startTgt = nm.get(ee.tgt);
      if (!startTgt || entryVisited.has(ee.tgt)) continue;
      entryVisited.add(ee.tgt);
      const chainParts = [];
      if (ee.cond) {
        chainParts.push(`if (${ee.cond}) -> ${startTgt.label}`);
      } else {
        chainParts.push(startTgt.label);
      }
      let current = ee.tgt;
      const localVisited = /* @__PURE__ */ new Set([ee.id, ee.tgt]);
      while (true) {
        const outs = internalEdges.filter((e) => e.src === current);
        if (outs.length === 1) {
          const nextEdge = outs[0];
          if (forOutNode && nextEdge.tgt === forOutNode.id) break;
          if (localVisited.has(nextEdge.tgt)) break;
          const tgtNode = nm.get(nextEdge.tgt);
          if (!tgtNode) break;
          if (nextEdge.cond) {
            chainParts.push(`if (${nextEdge.cond}) -> ${tgtNode.label}`);
          } else {
            chainParts.push(tgtNode.label);
          }
          localVisited.add(nextEdge.tgt);
          current = nextEdge.tgt;
        } else {
          break;
        }
      }
      const endsAtExit = forOutNode && (adj.get(current) || []).some((e) => e.tgt === forOutNode.id);
      const endsAtFor = edges.some((e) => e.src === current && e.tgt === forNodeId);
      const chainStr = chainParts.join(" -> ");
      const loopBackEdges = internalEdges.filter(
        (e) => e.src === current && localVisited.has(e.tgt) && nm.has(e.tgt)
      );
      const extraEdges = internalEdges.filter(
        (e) => e.src === current && !localVisited.has(e.tgt) && e.tgt !== current && !(forOutNode && e.tgt === forOutNode.id)
      );
      if (loopBackEdges.length > 0 || extraEdges.length > 0) {
        const arrowSuffix = endsAtExit || endsAtFor ? " ->" : "";
        lines.push(`${bp}-> ${chainStr}${arrowSuffix}`);
        console.log("[emitForBlock] \u56DE\u6307\u8FB9\u8F93\u51FA, current:", nm.get(current)?.label, "loopBack:", loopBackEdges.map((e) => `${nm.get(e.src)?.label}->${nm.get(e.tgt)?.label}`), "extra:", extraEdges.map((e) => `${nm.get(e.src)?.label}->${nm.get(e.tgt)?.label}`));
        const seenTgt = /* @__PURE__ */ new Set();
        for (const lb of loopBackEdges) {
          const tgtLabel = nm.get(lb.tgt)?.label;
          if (!tgtLabel || seenTgt.has(lb.tgt)) continue;
          seenTgt.add(lb.tgt);
          const srcLabel = nm.get(lb.src)?.label || "?";
          lines.push(`${bp}${srcLabel} ${flowConnector(lb.cond)} ${tgtLabel}`);
        }
        for (const ef of extraEdges) {
          const tgtLabel = nm.get(ef.tgt)?.label;
          if (!tgtLabel || seenTgt.has(ef.tgt)) continue;
          seenTgt.add(ef.tgt);
          const srcLabel = nm.get(ef.src)?.label || "?";
          lines.push(`${bp}${srcLabel} ${flowConnector(ef.cond)} ${tgtLabel}`);
        }
      } else {
        const arrowSuffix = endsAtExit || endsAtFor ? " ->" : "";
        lines.push(`${bp}-> ${chainStr}${arrowSuffix}`);
      }
    }
    if (forOutNode) {
      const exitEdges = adj.get(forOutNode.id) || [];
      if (exitEdges.length > 0) {
        const exitTarget = nm.get(exitEdges[0].tgt);
        if (exitTarget) {
          lines.push(`${ipfx}-> ${exitTarget.label}`);
        }
      }
    }
    emittedFors.add(forNodeId);
  }
  function emitParBlock(parNodeId, indentLevel) {
    const parNode = nm.get(parNodeId);
    const condition = parNode.forCondition || "@item in collection";
    const ipfx = "  ".repeat(indentLevel);
    const incomingEdges = inAdj.get(parNodeId) || [];
    const upstreamEdge = incomingEdges.find((e) => !back.has(e.id));
    const upstreamLabel = upstreamEdge ? nm.get(upstreamEdge.src)?.label : "?";
    lines.push(`${ipfx}${upstreamLabel} -> par ${condition}:`);
    const bp = "  ".repeat(indentLevel + 1);
    const parOutNode = nodes.find((n) => n.type === "par_out" && n.forNodeId === parNodeId);
    const parOutId = parOutNode?.id;
    const branchEdges = adj.get(parNodeId) || [];
    for (const be of branchEdges) {
      const startNode2 = nm.get(be.tgt);
      if (!startNode2) continue;
      const chainParts = be.cond ? [`if (${be.cond}) -> ${startNode2.label}`] : [startNode2.label];
      let current = be.tgt;
      const localVisited = /* @__PURE__ */ new Set([parNodeId, be.tgt]);
      const collectedLoopBacks = [];
      const collectedExtras = [];
      while (true) {
        const curLoopBacks = (adj.get(current) || []).filter(
          (e) => localVisited.has(e.tgt) && nm.has(e.tgt) && e.tgt !== parNodeId
        );
        if (curLoopBacks.length > 0) {
        }
        for (const e of curLoopBacks) collectedLoopBacks.push(e);
        const nexts = (adj.get(current) || []).filter(
          (e) => e.tgt !== parOutId && e.tgt !== parNodeId && !localVisited.has(e.tgt) && !back.has(e.id)
        );
        if (curLoopBacks.length > 0 || nexts.length !== 1) {
          for (const e of nexts) collectedExtras.push(e);
          if (curLoopBacks.length > 0) {
          } else {
            console.log("[emitParBlock] \u975E\u56DE\u8FB9 fork/dead-end, nexts.length:", nexts.length);
          }
          break;
        }
        const nextEdge = nexts[0];
        const tgtNode = nm.get(nextEdge.tgt);
        if (!tgtNode) {
          console.log("[emitParBlock] tgtNode \u4E3A\u7A7A, break");
          break;
        }
        chainParts.push(nextEdge.cond ? `if (${nextEdge.cond}) -> ${tgtNode.label}` : tgtNode.label);
        localVisited.add(nextEdge.tgt);
        current = nextEdge.tgt;
      }
      const toParOut = parOutId && (adj.get(current) || []).some((e) => e.tgt === parOutId);
      const chainStr = chainParts.join(" -> ");
      const arrowSuffix = toParOut ? " ->" : "";
      const mainLine = `${bp}-> ${chainStr}${arrowSuffix}`;
      lines.push(mainLine);
      const seenBackTgt = /* @__PURE__ */ new Set();
      for (const lb of collectedLoopBacks) {
        const tgtLabel = nm.get(lb.tgt)?.label;
        if (!tgtLabel || seenBackTgt.has(lb.tgt)) continue;
        seenBackTgt.add(lb.tgt);
        const srcLabel = nm.get(lb.src)?.label || "?";
        const line = `${bp}${srcLabel} ${flowConnector(lb.cond)} ${tgtLabel}`;
        lines.push(line);
      }
      const seenExtraTgt = /* @__PURE__ */ new Set();
      for (const ef of collectedExtras) {
        const tgtLabel = nm.get(ef.tgt)?.label;
        if (!tgtLabel || seenExtraTgt.has(ef.tgt)) continue;
        seenExtraTgt.add(ef.tgt);
        const tgtHasParOut = parOutId && (adj.get(ef.tgt) || []).some((e2) => e2.tgt === parOutId);
        const srcLabel = nm.get(ef.src)?.label || "?";
        const extraArrow = tgtHasParOut ? " ->" : "";
        const line = `${bp}${srcLabel} ${flowConnector(ef.cond)} ${tgtLabel}${extraArrow}`;
        lines.push(line);
      }
    }
    if (parOutNode) {
      const exitEdges = adj.get(parOutNode.id) || [];
      if (exitEdges.length > 0) {
        const exitTarget = nm.get(exitEdges[0].tgt);
        if (exitTarget) lines.push(`${ipfx}-> ${exitTarget.label}`);
      }
    }
    emittedFors.add(parNodeId);
  }
  const joinNodes = /* @__PURE__ */ new Map();
  inAdj.forEach((eds, nodeId) => {
    const node = nm.get(nodeId);
    if (node && node.type === "position") return;
    if (node && node.type === "par_out") return;
    if (node && Array.isArray(node.joinEntries) && node.joinEntries.length > 0) {
      const normal = eds.filter((e) => !back.has(e.id));
      if (normal.length > 1) joinNodes.set(nodeId, normal.length);
    }
  });
  const startNode = nodes.find(
    (n) => n.type === "special" && (n.specialType === "START" || n.specialType === "IN")
  );
  if (startNode) {
    let walk = function(id) {
      const node = nm.get(id);
      if (!node) return;
      if ((node.specialType === "FOR" || node.specialType === "PAR") && (!cycleEdgesMap || !cycleEdgesMap.has(id))) {
        return;
      }
      const specialEntries = specialEntryEdgesMap.get(id) || [];
      for (const se of specialEntries) {
        const tgtNode = nm.get(se.tgt);
        if (!tgtNode || emittedFors.has(se.tgt)) continue;
        if (tgtNode.specialType === "PAR") {
          emitParBlock(se.tgt, baseIndent);
        } else {
          emitForBlock(se.tgt, baseIndent);
        }
        const exitType = tgtNode.specialType === "PAR" ? "par_out" : "for_out";
        const forOutNode = nodes.find((n) => n.type === exitType && n.forNodeId === se.tgt);
        if (forOutNode) {
          const exitEdges = adj.get(forOutNode.id) || [];
          if (exitEdges.length > 0) walk(exitEdges[0].tgt);
        }
      }
      if (joinNodes.has(id) || node.joinEntries && node.joinEntries.length > 0) {
        if (node.joinEntries && node.joinEntries.length > 0) {
          if (joinNodes.has(id)) {
            const cnt = (joinReached.get(id) || 0) + 1;
            joinReached.set(id, cnt);
            if (cnt < joinNodes.get(id)) return;
          }
          for (const entry of node.joinEntries) {
            lines.push(`${pfx}join(${entry.param}):`);
            for (const srcLabel of entry.sources) {
              const clean = String(srcLabel).replace(/^\[|\]$/g, "");
              lines.push(`${pfx}  [${clean}] ->`);
            }
            lines.push(`${pfx}to ${node.label}`);
          }
        } else if (joinNodes.has(id)) {
          const cnt = (joinReached.get(id) || 0) + 1;
          joinReached.set(id, cnt);
          if (cnt < joinNodes.get(id)) return;
          const sources = inAdj.get(id).filter((e) => !back.has(e.id));
          if (!node.joinEntries) node.joinEntries = [];
          node.joinEntries.push({ sources: sources.map((e) => nm.get(e.src)?.label).filter(Boolean), param: "all" });
          lines.push(`${pfx}join(all):`);
          sources.forEach(
            (e) => lines.push(`${pfx}  ${nm.get(e.src)?.label} ->`)
          );
          lines.push(`${pfx}to ${node.label}`);
        }
      }
      if (node.specialType === "PAR") {
        if (!emittedFors.has(id)) {
          emitParBlock(id, baseIndent);
          const parOutNode = nodes.find((n) => n.type === "par_out" && n.forNodeId === id);
          if (parOutNode) {
            const exitEdges = adj.get(parOutNode.id) || [];
            if (exitEdges.length > 0) walk(exitEdges[0].tgt);
          }
        }
        if (!visited.has(id)) visited.add(id);
        return;
      }
      if (node.specialType === "FOR" && cycleEdgesMap && cycleEdgesMap.has(id)) {
        if (!emittedFors.has(id)) {
          emitForBlock(id, baseIndent);
          const forOutNode = nodes.find((n) => n.type === "for_out" && n.forNodeId === id);
          if (forOutNode) {
            const exitEdges = adj.get(forOutNode.id) || [];
            if (exitEdges.length > 0) walk(exitEdges[0].tgt);
          }
        }
        if (!visited.has(id)) visited.add(id);
        return;
      }
      if (visited.has(id)) return;
      visited.add(id);
      const outs = (adj.get(id) || []).filter((e) => {
        if (back.has(e.id)) return false;
        const tgtNode = nm.get(e.tgt);
        if (tgtNode && tgtNode.specialType === "FOR" && !cycleEdgesMap?.has(e.tgt)) return false;
        return true;
      });
      const backOuts = (adj.get(id) || []).filter((e) => back.has(e.id));
      if (backOuts.length) {
        if (outs.length > 0 || backOuts.some((e) => e.cond)) {
          const allEdges = [...backOuts, ...outs];
          lines.push(`${pfx}${node.label} -> fork:`);
          const seenForkTgt = /* @__PURE__ */ new Set();
          allEdges.forEach((e) => {
            const tgt = nm.get(e.tgt);
            if (!tgt || seenForkTgt.has(tgt.id)) return;
            seenForkTgt.add(tgt.id);
            const cond = e.cond ? ` if (${e.cond}) ->` : "";
            lines.push(`${pfx}  ->${cond} ${tgt.label}`);
          });
          outs.forEach((e) => walk(e.tgt));
          return;
        }
        backOuts.forEach((e) => {
          lines.push(`${pfx}${node.label} -> ${nm.get(e.tgt)?.label}`);
        });
      }
      const outsWithoutPar = outs.filter((e) => {
        const tgtNode = nm.get(e.tgt);
        return !(tgtNode && tgtNode.specialType === "PAR");
      });
      if (outsWithoutPar.length === 0) {
        outs.forEach((e) => {
          const tgtNode = nm.get(e.tgt);
          if (tgtNode && tgtNode.specialType === "PAR" && !emittedFors.has(e.tgt)) {
            emitParBlock(e.tgt, baseIndent);
            const parOutNode = nodes.find((n) => n.type === "par_out" && n.forNodeId === e.tgt);
            if (parOutNode) {
              const exitEdges = adj.get(parOutNode.id) || [];
              if (exitEdges.length > 0) walk(exitEdges[0].tgt);
            }
          }
        });
        return;
      }
      if (outsWithoutPar.length === 1) {
        const e = outsWithoutPar[0];
        const tgt = nm.get(e.tgt);
        if (tgt && tgt.specialType === "FOR" && cycleEdgesMap?.has(e.tgt)) {
          walk(e.tgt);
        } else if (tgt && tgt.specialType === "PAR" && !emittedFors.has(e.tgt)) {
          emitParBlock(e.tgt, baseIndent);
          const parOutNode = nodes.find((n) => n.type === "par_out" && n.forNodeId === e.tgt);
          if (parOutNode) {
            const exitEdges = adj.get(parOutNode.id) || [];
            if (exitEdges.length > 0) walk(exitEdges[0].tgt);
          }
        } else if (tgt && !joinNodes.has(e.tgt)) {
          const cond = e.cond ? ` if (${e.cond}) ->` : "";
          lines.push(`${pfx}${node.label} ->${cond} ${tgt.label}`);
          walk(e.tgt);
        } else {
          walk(e.tgt);
        }
      } else {
        const parOuts = [];
        const normalOuts = [];
        outs.forEach((e) => {
          const tgtNode = nm.get(e.tgt);
          if (tgtNode && tgtNode.specialType === "PAR") {
            parOuts.push(e);
          } else {
            normalOuts.push(e);
          }
        });
        parOuts.forEach((e) => {
          if (!emittedFors.has(e.tgt)) {
            emitParBlock(e.tgt, baseIndent);
            const parOutNode = nodes.find((n) => n.type === "par_out" && n.forNodeId === e.tgt);
            if (parOutNode) {
              const exitEdges = adj.get(parOutNode.id) || [];
              if (exitEdges.length > 0) walk(exitEdges[0].tgt);
            }
          }
        });
        if (normalOuts.length > 0) {
          lines.push(`${pfx}${node.label} -> fork:`);
          const seenTgt = /* @__PURE__ */ new Set();
          normalOuts.forEach((e) => {
            const tgt = nm.get(e.tgt);
            if (!tgt || seenTgt.has(tgt.id)) return;
            seenTgt.add(tgt.id);
            const cond = e.cond ? ` if (${e.cond}) ->` : "";
            lines.push(`${pfx}  ->${cond} ${tgt.label}`);
          });
          normalOuts.forEach((e) => walk(e.tgt));
        }
      }
    };
    const visited = /* @__PURE__ */ new Set();
    const joinReached = /* @__PURE__ */ new Map();
    const startSpecialEntries = specialEntryEdgesMap.get(startNode.id) || [];
    for (const se of startSpecialEntries) {
      const tgtNode = nm.get(se.tgt);
      if (!tgtNode || emittedFors.has(se.tgt)) continue;
      if (tgtNode.specialType === "PAR") {
        emitParBlock(se.tgt, baseIndent);
      } else {
        emitForBlock(se.tgt, baseIndent);
      }
      const exitType = tgtNode.specialType === "PAR" ? "par_out" : "for_out";
      const forOutNode = nodes.find((n) => n.type === exitType && n.forNodeId === se.tgt);
      if (forOutNode) {
        const exitEdges = adj.get(forOutNode.id) || [];
        if (exitEdges.length > 0) walk(exitEdges[0].tgt);
      }
    }
    const startOuts = (adj.get(startNode.id) || []).filter((e) => {
      if (back.has(e.id)) return false;
      const tgtNode = nm.get(e.tgt);
      if (tgtNode && tgtNode.specialType === "FOR" && !cycleEdgesMap?.has(e.tgt)) return false;
      return true;
    });
    if (startOuts.length === 1) {
      const tgt = nm.get(startOuts[0].tgt);
      if (tgt) {
        if (tgt.specialType === "FOR" && cycleEdgesMap?.has(tgt.id)) {
          walk(startOuts[0].tgt);
        } else {
          lines.push(`${pfx}${startNode.label} -> ${tgt.label}`);
          walk(startOuts[0].tgt);
        }
      }
    } else if (startOuts.length > 1) {
      lines.push(`${pfx}${startNode.label} -> fork:`);
      const seenStartTgt = /* @__PURE__ */ new Set();
      startOuts.forEach((e) => {
        const tgt = nm.get(e.tgt);
        if (!tgt || seenStartTgt.has(tgt.id)) return;
        seenStartTgt.add(tgt.id);
        const cond = e.cond ? ` if (${e.cond}) ->` : "";
        lines.push(`${pfx}  ->${cond} ${tgt.label}`);
      });
      startOuts.forEach((e) => walk(e.tgt));
    }
  } else {
    const hasIncoming = new Set(edges.map((e) => e.tgt));
    const starts = nodes.filter((n) => !hasIncoming.has(n.id));
    lines.push(
      `${pfx}[START] -> ${starts.map((n) => n.label).join(", ") || "[END]"}`
    );
  }
}

// ../../femoGen/src/graphBuilder.jsx
function parsedToGraph(parsed, currentMode, currentModName) {
  const proj = {
    id: parsed.meta.id || "",
    name: parsed.meta.name || "\u672A\u547D\u540D\u9879\u76EE",
    version: parsed.meta.version || "1.0",
    owner: parsed.meta.owner || "",
    database: parsed.meta.database || "",
    session: parsed.meta.session || "",
    system_safety: parsed.meta.system_safety || "",
    output_style: parsed.meta.output_style || "",
    // 文件头原文（meta: 之前的注释）透传给生成端回写，见 femoParser.parseFEMO
    preamble: parsed.preamble || "",
    code: parsed.code || [],
    vars: (parsed.vars || []).map((v) => ({ name: v.name, defaultValue: v.defaultValue })),
    actors: parsed.actors.map((a) => ({
      name: a.name.startsWith("@") ? a.name : "@" + a.name,
      type: a.type,
      soul: a.soul,
      source: a.source,
      // ⚠️ tools 五态直通，不许归一：null=未声明（宿主默认全开）/ false=禁用 /
      // true=显式全开 / []=显式空白名单（≡禁用）/ [..]=白名单。
      // 历史教训：a.tools || [] 曾把 false 吞成 []（禁用标记静默丢失）；
      // ?? [] 也曾把「未声明」和「显式空列表」搅混（2026-09-12）。
      tools: a.tools,
      thinking: a.thinking || ""
    }))
  };
  let libActions = parsed.actions.map((a) => ({
    id: actionId(["mainflow"], a.name),
    path: ["mainflow"],
    ...a
  }));
  const moduleInternalActions = [];
  parsed.modules.forEach((m) => {
    const modPath = m.path || ["mainflow", m.name];
    (m.actions || []).forEach((a) => {
      moduleInternalActions.push({
        id: actionId(modPath, a.name),
        path: modPath,
        ...a
      });
    });
  });
  libActions = libActions.concat(moduleInternalActions);
  const libModules = parsed.modules.map((m) => {
    const modPath = m.path || ["mainflow", m.name];
    const { nodes: mNodes, edges: mEdges } = flowDeclsToGraph(
      m.nodeDecls,
      m.edges,
      "module",
      libActions,
      // 现在已经包含该模块的 action
      parsed.modules,
      m.layout || {}
    );
    const internalActions = moduleInternalActions.filter(
      (a) => a.path.length === modPath.length && a.path.every((seg, i) => seg === modPath[i])
    );
    return {
      id: mid(),
      name: m.name,
      path: modPath,
      meta: m.meta || {},
      code: m.code || [],
      vars: m.vars || [],
      nodes: mNodes,
      edges: mEdges,
      internalActions
    };
  });
  let flowDecls, flowMode;
  if (currentMode === "module" && currentModName) {
    const targetMod = parsed.modules.find((m) => m.name === currentModName);
    if (targetMod) {
      flowDecls = { nodeDecls: targetMod.nodeDecls, edges: targetMod.edges, layout: targetMod.layout || {} };
      flowMode = "module";
    } else {
      throw new Error(
        `FEMO \u811A\u672C\u4E2D\u672A\u627E\u5230\u540D\u4E3A "${currentModName}" \u7684 module \u5B9A\u4E49\u3002\u8BF7\u786E\u8BA4 module \u540D\u79F0\u62FC\u5199\u6B63\u786E`
      );
    }
  } else {
    flowDecls = parsed.mainflow;
    flowMode = "mainflow";
  }
  const { nodes, edges } = flowDeclsToGraph(
    flowDecls.nodeDecls,
    flowDecls.edges,
    flowMode,
    libActions,
    parsed.modules,
    flowDecls.layout || {}
  );
  let mainflowNodes, mainflowEdges;
  if (flowMode === "mainflow") {
    mainflowNodes = nodes;
    mainflowEdges = edges;
  } else {
    const mainResult = flowDeclsToGraph(
      parsed.mainflow.nodeDecls,
      parsed.mainflow.edges,
      "mainflow",
      libActions,
      parsed.modules,
      parsed.mainflow.layout || {}
    );
    mainflowNodes = mainResult.nodes;
    mainflowEdges = mainResult.edges;
  }
  return { proj, libActions, libModules, nodes, edges, mainflowNodes, mainflowEdges };
}
var SPECIAL_LABELS = /* @__PURE__ */ new Set(["START", "END", "IN", "OUT", "BREAK"]);
function flowDeclsToGraph(nodeDecls, flowEdges, mode, libActions, parsedModules, layoutMap = {}) {
  const ANCHOR_X = 80;
  const ANCHOR_Y = 200;
  const lp = (label, defaultX, defaultY) => {
    const e = layoutMap[label] || layoutMap[`[${label}]`];
    if (e) {
      return { x: e.dx !== void 0 ? e.dx : 0, y: e.dy !== void 0 ? e.dy : 0 };
    }
    return { x: defaultX, y: defaultY };
  };
  const nodes = [];
  const edges = [];
  const labelToId = /* @__PURE__ */ new Map();
  const allLabels = /* @__PURE__ */ new Set();
  for (const fe of flowEdges) {
    allLabels.add(fe.srcLabel);
    allLabels.add(fe.tgtLabel);
  }
  let specialY = 200;
  const forNodeMap = /* @__PURE__ */ new Map();
  for (const decl of nodeDecls) {
    if (decl.specialType === "FOR" || decl.specialType === "PAR") {
      const isPar = decl.specialType === "PAR";
      const spType = isPar ? "PAR" : "FOR";
      const outType = isPar ? "par_out" : "for_out";
      const outSpType = isPar ? "PAR_OUT" : "FOR_OUT";
      const forId = nid();
      const outId = nid();
      const pos = lp(`[${decl.label}]`, 200, specialY);
      const xPos = pos.x;
      const yPos = pos.y;
      nodes.push({
        id: forId,
        type: "special",
        specialType: spType,
        x: xPos,
        y: yPos,
        label: `[${decl.label}]`,
        forOutNodeId: outId,
        forCondition: decl.forCondition || ""
      });
      const outKey1 = `${decl.label}_\u51FA`;
      const outKey2 = `${decl.label}_out`;
      const outLayout = layoutMap[outKey1] || layoutMap[`[${outKey1}]`] || layoutMap[outKey2] || layoutMap[`[${outKey2}]`];
      const outX = outLayout ? outLayout.dx : xPos + SPW - 22;
      const outY = outLayout ? outLayout.dy : yPos + (SPH - 22) / 2;
      nodes.push({
        id: outId,
        type: outType,
        specialType: outSpType,
        x: outX,
        y: outY,
        label: `[${decl.label}_\u51FA]`,
        forNodeId: forId
      });
      labelToId.set(decl.label, forId);
      labelToId.set(`[${decl.label}]`, forId);
      labelToId.set(`${decl.label}_out`, outId);
      labelToId.set(`[${decl.label}_out]`, outId);
      labelToId.set(outKey1, outId);
      labelToId.set(`[${outKey1}]`, outId);
      forNodeMap.set(decl.label, { forId, outId });
      specialY += 100;
    }
  }
  for (const lbl of allLabels) {
    if (!SPECIAL_LABELS.has(lbl) && !lbl.match(/^(END|OUT|BREAK)_\d+$/))
      continue;
    if (labelToId.has(lbl) || labelToId.has(`[${lbl}]`)) continue;
    const baseType = lbl.replace(/_\d+$/, "");
    const id = nid();
    const defX = baseType === "START" || baseType === "IN" ? 0 : 600;
    const pos = lp(`[${lbl}]`, defX, specialY);
    nodes.push({
      id,
      type: "special",
      specialType: baseType,
      x: pos.x,
      y: pos.y,
      label: `[${lbl}]`
    });
    labelToId.set(lbl, id);
    labelToId.set(`[${lbl}]`, id);
    specialY += 80;
  }
  const entryType = mode === "mainflow" ? "START" : "IN";
  const exitType = mode === "mainflow" ? "END" : "OUT";
  if (!labelToId.has(entryType)) {
    const id = nid();
    nodes.push({
      id,
      type: "special",
      specialType: entryType,
      x: 80,
      y: 200,
      label: `[${entryType}]`
    });
    labelToId.set(entryType, id);
    labelToId.set(`[${entryType}]`, id);
  }
  if (!labelToId.has(exitType)) {
    const id = nid();
    nodes.push({
      id,
      type: "special",
      specialType: exitType,
      x: 600,
      y: 200,
      label: `[${exitType}]`
    });
    labelToId.set(exitType, id);
    labelToId.set(`[${exitType}]`, id);
  }
  let col = 0, row = 0;
  for (const decl of nodeDecls) {
    if (labelToId.has(decl.label) || labelToId.has(`[${decl.label}]`)) continue;
    const id = nid();
    const label = `[${decl.label}]`;
    labelToId.set(decl.label, id);
    labelToId.set(label, id);
    const joinEntries = decl.joinEntries || [];
    if (decl.ref === "") {
      const pos = lp(label, 180 + col * 240, 120 + row * 140);
      nodes.push({ id, type: "position", x: pos.x, y: pos.y, label, joinEntries });
    } else if (decl.ref.startsWith("&")) {
      const modName = decl.ref.substring(1);
      const modDef = parsedModules?.find((m) => m.name === modName);
      const pos = lp(label, 180 + col * 260, 120 + row * 150);
      nodes.push({ id, type: "module", modRef: modName, modDef, x: pos.x, y: pos.y, label, joinEntries });
    } else {
      const actionDef = libActions.find((a) => a.name === decl.ref);
      if (!actionDef) {
        throw new Error(
          `\u8282\u70B9 "${decl.label}" \u5F15\u7528\u4E86\u672A\u5B9A\u4E49\u7684 action "${decl.ref}"`
        );
      }
      const pos = lp(label, 180 + col * 240, 120 + row * 140);
      nodes.push({
        id,
        type: "action",
        actionId: actionDef.id,
        x: pos.x,
        y: pos.y,
        label,
        joinEntries
      });
    }
    col++;
    if (col >= 3) {
      col = 0;
      row++;
    }
  }
  for (const fe of flowEdges) {
    const srcId = labelToId.get(fe.srcLabel) || labelToId.get(`[${fe.srcLabel}]`);
    const tgtId = labelToId.get(fe.tgtLabel) || labelToId.get(`[${fe.tgtLabel}]`);
    if (!srcId)
      throw new Error(
        `\u6D41\u7A0B\u5F15\u7528\u4E86\u672A\u58F0\u660E\u7684\u8282\u70B9: "[${fe.srcLabel}]"\u3002\u8BF7\u786E\u8BA4\u8BE5\u8282\u70B9\u5DF2\u5728\u8282\u70B9\u58F0\u660E\u533A\u5B9A\u4E49\uFF0C\u6216\u5B83\u662F\u5408\u6CD5\u7684\u7279\u6B8A\u8282\u70B9`
      );
    if (!tgtId)
      throw new Error(
        `\u6D41\u7A0B\u5F15\u7528\u4E86\u672A\u58F0\u660E\u7684\u8282\u70B9: "[${fe.tgtLabel}]"\u3002\u8BF7\u786E\u8BA4\u8BE5\u8282\u70B9\u5DF2\u5728\u8282\u70B9\u58F0\u660E\u533A\u5B9A\u4E49\uFF0C\u6216\u5B83\u662F\u5408\u6CD5\u7684\u7279\u6B8A\u8282\u70B9`
      );
    edges.push({ id: eid(), src: srcId, tgt: tgtId, cond: fe.cond || "" });
  }
  const entryNode = nodes.find((n) => n.type === "special" && (n.specialType === "START" || n.specialType === "IN"));
  if (entryNode) {
    entryNode.x = 0;
    entryNode.y = 0;
  }
  return { nodes, edges };
}

// ../../femoGen/src/canvasNodes.jsx
var import_react11 = __toESM(require("react"), 1);
var import_jsx_runtime9 = require("react/jsx-runtime");
function ActionNodeView({
  node,
  sel,
  onBody,
  onPortDown,
  onPortUp,
  onBodyMouseUp,
  onDbl,
  onBubbleClick,
  nodeState,
  isActive,
  errorNodeIds
}) {
  const isMod = node.type === "module";
  const w = isMod ? MW : NW, h = isMod ? MH : NH;
  const { c } = isMod ? { c: "var(--femo-tag-bg)", bg: "var(--femo-bg-2)" } : ti(node.action?.executorType);
  const badgeKey = isMod ? "module" : TYPES.some((t) => t.t === node.action?.executorType) ? node.action.executorType : "ai";
  const hasState = !!nodeState?.status;
  const isStreaming = nodeState?.status === "ai_streaming";
  const isHumanWait = nodeState?.status === "human_wait";
  const isDone = ["ai_done", "human_done", "done"].includes(nodeState?.status);
  const ports = {
    top: { x: w / 2, y: 0 },
    bottom: { x: w / 2, y: h },
    left: { x: 0, y: h / 2 },
    right: { x: w, y: h / 2 }
  };
  const isErrorExplicit = errorNodeIds?.has(node.id) ?? false;
  const isError = nodeState?.status === "error" || isErrorExplicit;
  const glowStyle = isActive || isError ? {
    animation: isError ? "nodeGlowError 1.5s ease-in-out infinite" : "nodeGlow 1.5s ease-in-out infinite"
  } : {};
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      "data-node-id": node.id,
      onMouseDown: onBody,
      onMouseUp: onBodyMouseUp,
      onDoubleClick: onDbl,
      style: {
        position: "absolute",
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        background: "var(--femo-node-bg)",
        borderRadius: "var(--femo-radius-lg)",
        border: `var(--femo-node-border-w) solid ${sel ? c : "var(--femo-node-border)"}`,
        boxShadow: sel ? `0 0 0 3px color-mix(in srgb, ${c} 13%, transparent), var(--femo-node-shadow-sel)` : "var(--femo-node-shadow-rest)",
        cursor: "grab",
        userSelect: "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        zIndex: sel ? 20 : 2,
        fontFamily: "var(--femo-font-sans)",
        ...glowStyle
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { padding: "10px 12px 9px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 3, minWidth: 0, minHeight: 15 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "span",
              {
                style: {
                  background: `var(--femo-badge-bg-${badgeKey})`,
                  color: `var(--femo-badge-fg-${badgeKey})`,
                  borderRadius: "var(--femo-radius-xs)",
                  padding: "1px 5px",
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  fontFamily: "var(--femo-font-mono)",
                  lineHeight: 1.4,
                  flexShrink: 0
                },
                children: isMod ? "module" : node.action?.executorType || "ai"
              }
            ),
            !isMod && node.action?.executorActor ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "span",
              {
                style: {
                  fontSize: 10,
                  color: "var(--femo-neutral)",
                  fontFamily: "var(--femo-font-mono)",
                  marginLeft: "auto",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                },
                children: node.action.executorActor
              }
            ) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "div",
            {
              style: {
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--femo-text-1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              },
              children: isMod ? `&${node.modRef || "Module"}` : node.action?.name || "\u672A\u547D\u540D"
            }
          )
        ] }),
        hasState && node.type === "action" && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "div",
          {
            "data-bubble-node": node.id,
            onClick: (e) => {
              e.stopPropagation();
              onBubbleClick && onBubbleClick(node.id);
            },
            style: {
              position: "absolute",
              top: -28,
              right: -8,
              maxWidth: 180,
              minWidth: 32,
              background: isStreaming ? "var(--femo-primary-soft-2)" : isHumanWait ? "var(--femo-warning-soft)" : "var(--femo-success-soft)",
              borderRadius: "var(--femo-radius-bubble)",
              border: `var(--femo-border-w-strong) solid ${isStreaming ? c : isHumanWait ? "var(--femo-warning)" : "var(--femo-success)"}`,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              zIndex: 5,
              boxShadow: "0 2px 8px var(--femo-shadow-sm)",
              padding: "3px 8px",
              overflow: "hidden",
              transition: "all 0.2s ease"
            },
            children: isStreaming ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
              "span",
              {
                style: {
                  fontSize: 10,
                  color: "var(--femo-text-1)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 160,
                  lineHeight: "14px"
                },
                children: [
                  nodeState.streamingText?.slice(-30) || "...",
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { animation: "blink 0.7s infinite" }, children: "|" })
                ]
              }
            ) : isHumanWait ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: 10, color: "var(--femo-warning)", fontWeight: 600, whiteSpace: "nowrap" }, children: "\u23F3 \u7B49\u5F85\u8F93\u5165" }) : isDone ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "span",
              {
                style: {
                  fontSize: 10,
                  color: "var(--femo-success-text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 160
                },
                children: typeof nodeState.output === "string" ? nodeState.output.length > 20 ? nodeState.output.slice(0, 20) + "..." : nodeState.output : "\u2713 \u5B8C\u6210"
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { style: { fontSize: 10, color: c, fontWeight: 600 }, children: "\u8FD0\u884C\u4E2D..." })
          }
        ),
        sel && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.top.x,
              y: ports.top.y,
              color: c,
              nodeId: node.id,
              portDir: "top",
              portX: node.x + w / 2,
              portY: node.y,
              onMouseDown: (e) => onPortDown(e, "top", node.x + w / 2, node.y),
              onMouseUp: (e) => onPortUp(e, "top", node.x + w / 2, node.y)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.bottom.x,
              y: ports.bottom.y,
              color: c,
              nodeId: node.id,
              portDir: "bottom",
              onMouseDown: (e) => onPortDown(e, "bottom"),
              onMouseUp: (e) => onPortUp(e, "bottom")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.left.x,
              y: ports.left.y,
              color: c,
              nodeId: node.id,
              portDir: "left",
              onMouseDown: (e) => onPortDown(e, "left"),
              onMouseUp: (e) => onPortUp(e, "left")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.right.x,
              y: ports.right.y,
              color: c,
              nodeId: node.id,
              portDir: "right",
              onMouseDown: (e) => onPortDown(e, "right"),
              onMouseUp: (e) => onPortUp(e, "right")
            }
          )
        ] })
      ]
    }
  );
}
function PositionNodeView({
  node,
  sel,
  onBody,
  onPortDown,
  onPortUp,
  onBodyMouseUp
}) {
  const w = PSW, h = PSH;
  const c = "var(--femo-text-2)", bg = "var(--femo-bg)";
  const border = sel ? c : "var(--femo-tag-bg)";
  const ports = {
    top: { x: w / 2, y: 0 },
    bottom: { x: w / 2, y: h },
    left: { x: 0, y: h / 2 },
    right: { x: w, y: h / 2 }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      onMouseDown: onBody,
      onMouseUp: onBodyMouseUp,
      style: {
        position: "absolute",
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        background: bg,
        borderRadius: "var(--femo-radius-xl)",
        border: `var(--femo-border-w-selected) solid ${border}`,
        boxShadow: sel ? `0 0 0 3px color-mix(in srgb, ${c} 13%, transparent), var(--femo-node-shadow-sel-sm)` : "var(--femo-node-shadow-rest-sm)",
        cursor: "grab",
        userSelect: "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        zIndex: sel ? 20 : 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--femo-font-mono)"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "span",
          {
            style: {
              fontSize: 10,
              fontWeight: 800,
              color: c,
              letterSpacing: "0.06em"
            },
            children: node.label.replace(/[\[\]]/g, "")
          }
        ),
        sel && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.top.x,
              y: ports.top.y,
              color: c,
              onMouseDown: (e) => onPortDown(e, "top"),
              onMouseUp: (e) => onPortUp(e, "top")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.bottom.x,
              y: ports.bottom.y,
              color: c,
              onMouseDown: (e) => onPortDown(e, "bottom"),
              onMouseUp: (e) => onPortUp(e, "bottom")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.left.x,
              y: ports.left.y,
              color: c,
              onMouseDown: (e) => onPortDown(e, "left"),
              onMouseUp: (e) => onPortUp(e, "left")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.right.x,
              y: ports.right.y,
              color: c,
              onMouseDown: (e) => onPortDown(e, "right"),
              onMouseUp: (e) => onPortUp(e, "right")
            }
          )
        ] })
      ]
    }
  );
}
function SpecialNodeView({
  node,
  sel,
  onBody,
  onPortDown,
  onPortUp,
  onBodyMouseUp,
  isActive = false
}) {
  const sc = SPECIAL_COLORS[node.specialType] || SPECIAL_COLORS.START;
  const size = getNodeSize(node);
  const w = size.w, h = size.h;
  const border = sc.c;
  const borderDim = `color-mix(in srgb, ${sc.c} 50%, var(--femo-node-border-mix-base))`;
  const isSink = SINK_ONLY.has(node.specialType);
  const ports = {
    top: { x: w / 2, y: 0 },
    bottom: { x: w / 2, y: h },
    left: { x: 0, y: h / 2 },
    right: { x: w, y: h / 2 }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      "data-node-id": node.id,
      onMouseDown: onBody,
      onMouseUp: onBodyMouseUp,
      style: {
        position: "absolute",
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        background: sc.bg,
        borderRadius: "var(--femo-radius-xl)",
        border: sel ? `var(--femo-border-w-selected) solid ${border}` : `var(--femo-border-w) solid ${borderDim}`,
        boxShadow: isActive ? `0 0 12px 4px ${sc.c}66, 0 0 24px 8px ${sc.c}33` : sel ? `0 0 0 3px color-mix(in srgb, ${sc.c} 13%, transparent), var(--femo-node-shadow-sel-sm)` : "var(--femo-node-shadow-rest-sm)",
        animation: isActive ? "nodeGlow 1.5s ease-in-out infinite" : "none",
        cursor: "grab",
        userSelect: "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        zIndex: sel ? 20 : 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--femo-font-mono)"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "span",
          {
            className: "femo-special-label",
            style: {
              fontSize: 11,
              fontWeight: 800,
              color: sc.c,
              letterSpacing: "0.06em"
            },
            children: node.specialType
          }
        ),
        sel && !isSink && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.top.x,
              y: ports.top.y,
              color: sc.c,
              nodeId: node.id,
              portDir: "top",
              onMouseDown: (e) => onPortDown(e, "top"),
              onMouseUp: (e) => onPortUp(e, "top")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.bottom.x,
              y: ports.bottom.y,
              color: sc.c,
              nodeId: node.id,
              portDir: "bottom",
              onMouseDown: (e) => onPortDown(e, "bottom"),
              onMouseUp: (e) => onPortUp(e, "bottom")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.left.x,
              y: ports.left.y,
              color: sc.c,
              nodeId: node.id,
              portDir: "left",
              onMouseDown: (e) => onPortDown(e, "left"),
              onMouseUp: (e) => onPortUp(e, "left")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: ports.right.x,
              y: ports.right.y,
              color: sc.c,
              nodeId: node.id,
              portDir: "right",
              onMouseDown: (e) => onPortDown(e, "right"),
              onMouseUp: (e) => onPortUp(e, "right")
            }
          )
        ] })
      ]
    }
  );
}
function ForOutNodeView({ node, sel, onBodyMouseUp, onBubbleClick, onPortDown, onPortUp, forSpecialType = "FOR" }) {
  const sc = SPECIAL_COLORS[forSpecialType] || SPECIAL_COLORS.FOR;
  const w = 22, h = 22;
  const centerX = node.x + w / 2;
  const centerY = node.y + h / 2;
  const handleMouseDown = (e) => {
    if (onPortDown) {
      onPortDown(e, "center", centerX, centerY);
    }
  };
  const handleMouseUp = (e) => {
    if (onPortUp) {
      onPortUp(e, "center", centerX, centerY);
    }
  };
  const handleClick = (e) => {
    e.stopPropagation();
    onBubbleClick && onBubbleClick(node.id);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onClick: handleClick,
      style: {
        position: "absolute",
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        borderRadius: "var(--femo-radius-pill)",
        background: sc.bg,
        border: `${sel ? 2.5 : 1.5}px solid ${sc.c}`,
        // 👈 只有选中才变粗
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 9,
        fontWeight: 800,
        color: sc.c,
        fontFamily: "var(--femo-font-mono)",
        cursor: sel ? "grabbing" : "crosshair",
        userSelect: "none",
        zIndex: 23,
        boxShadow: sel ? `0 0 0 3px ${sc.c}44, 0 0 12px ${sc.c}55` : "none",
        transition: "border-width 0.12s, box-shadow 0.12s"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: "\u51FA" })
    }
  );
}
function ParOutNodeView({
  node,
  sel,
  onBody,
  onPortDown,
  onPortUp,
  onBodyMouseUp
}) {
  const sc = SPECIAL_COLORS["PAR"] || SPECIAL_COLORS.FOR;
  const size = getNodeSize(node);
  const w = size.w, h = size.h;
  const border = sc.c;
  const rightPort = { x: w, y: h / 2 };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "div",
    {
      onMouseDown: onBody,
      onMouseUp: onBodyMouseUp,
      style: {
        position: "absolute",
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        background: sc.bg,
        borderRadius: "var(--femo-radius-xl)",
        border: `var(--femo-border-w) solid ${border}`,
        boxShadow: sel ? `0 0 0 3px color-mix(in srgb, ${sc.c} 13%, transparent), var(--femo-node-shadow-sel-sm)` : "var(--femo-node-shadow-rest-sm)",
        cursor: "grab",
        userSelect: "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        zIndex: sel ? 20 : 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--femo-font-mono)"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "span",
          {
            className: "femo-special-label",
            style: {
              fontSize: 11,
              fontWeight: 800,
              color: sc.c,
              letterSpacing: "0.06em"
            },
            children: "PAR_OUT"
          }
        ),
        sel && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: w / 2,
              y: 0,
              color: sc.c,
              onMouseDown: (e) => onPortDown(e, "top"),
              onMouseUp: (e) => onPortUp(e, "top")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: w / 2,
              y: h,
              color: sc.c,
              onMouseDown: (e) => onPortDown(e, "bottom"),
              onMouseUp: (e) => onPortUp(e, "bottom")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: 0,
              y: h / 2,
              color: sc.c,
              onMouseDown: (e) => onPortDown(e, "left"),
              onMouseUp: (e) => onPortUp(e, "left")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            PortCircle,
            {
              x: w,
              y: h / 2,
              color: sc.c,
              onMouseDown: (e) => onPortDown(e, "right"),
              onMouseUp: (e) => onPortUp(e, "right")
            }
          )
        ] })
      ]
    }
  );
}

// ../../femoGen/src/libPanel.jsx
var import_react12 = __toESM(require("react"), 1);
var import_jsx_runtime10 = require("react/jsx-runtime");
function LibPanel({
  lib,
  mode,
  locationPath,
  allNames,
  onNew,
  onAdd,
  onAddModule,
  onAddSpecial,
  onAddPosition,
  onEdit,
  onEditModule,
  onDragStart,
  onSelectLib,
  onNewModule,
  // round49：手机端触摸改为面板级统一监听（mobileView.jsx），卡片只挂 data-femo-lib-drag 标记
  // 供面板 touchstart 用 closest() 找"拖哪个"——落点不再参与手势裁决，卡片自身零触摸监听。
  armedKey = null,
  // round27：手机端长按激活抓起态（"type:id"）；桌面端不传=null 永不命中
  htmlDraggable = true,
  // round45：手机端传 false——draggable 卡片在触摸设备上会阻止原生滚动
  cardLayout = "list"
  // round51：'list'=全宽单列（桌面默认）；'grid3'=Actions/特殊节点一行三卡（仅手机传）
}) {
  const grabTransition = "transform 0.15s cubic-bezier(0.34,1.56,0.64,1), border-color 0.15s, background-color 0.15s, box-shadow 0.15s";
  const isGrabbed = (type, item) => armedKey === `${type}:${typeof item === "string" ? item : item?.id}`;
  const grabStyle = (grabbed) => grabbed ? {
    border: "var(--femo-node-border-w) solid var(--femo-primary)",
    background: "var(--femo-primary-soft-faint)",
    transform: "scale(1.04)",
    boxShadow: "0 6px 18px var(--femo-primary-glow-strong)"
  } : {};
  const GRID_ROW = { display: "flex", flexWrap: "wrap", gap: 7 };
  const SPECIAL_GRID_ROW = { ...GRID_ROW, marginBottom: 7 };
  const gridItemStyle = cardLayout === "grid3" ? { flex: "0 0 calc((100% - 14px) / 3)", marginBottom: 0, boxSizing: "border-box", minWidth: 0 } : null;
  const displayActions = (lib.actions || []).filter((a) => {
    if (!a.path) return false;
    if (a.path.length === 1 && a.path[0] === "mainflow") return true;
    return locationPath.every((seg, i) => a.path[i] === seg);
  });
  const displayModules = (lib.modules || []).filter(
    (m) => m.path && locationPath.every((seg, i) => m.path[i] === seg) && m.path.length === locationPath.length + 1
  );
  const specialNodes = mode === "mainflow" ? [
    { t: "FOR", lbl: "FOR", c: "var(--femo-primary-strong)", bg: "var(--femo-primary-soft)" },
    { t: "PAR", lbl: "PAR", c: "var(--femo-special-par)", bg: "var(--femo-special-par-bg)" },
    { t: "END", lbl: "END", c: "var(--femo-danger)", bg: "var(--femo-danger-soft)" }
  ] : [
    { t: "FOR", lbl: "FOR", c: "var(--femo-primary-strong)", bg: "var(--femo-primary-soft)" },
    { t: "PAR", lbl: "PAR", c: "var(--femo-special-par)", bg: "var(--femo-special-par-bg)" },
    { t: "BREAK", lbl: "BREAK", c: "var(--femo-warning)", bg: "var(--femo-warning-soft)" },
    { t: "OUT", lbl: "OUT", c: "var(--femo-danger)", bg: "var(--femo-danger-soft)" }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 11
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "span",
            {
              style: {
                fontSize: 10,
                fontWeight: 800,
                color: "var(--femo-neutral)",
                textTransform: "uppercase",
                letterSpacing: "0.09em"
              },
              children: "Actions"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "button",
            {
              onClick: onNew,
              style: {
                padding: "4px 11px",
                fontSize: 11,
                background: "var(--femo-btn-primary)",
                color: "var(--femo-on-accent)",
                border: "none",
                borderRadius: "var(--femo-radius-md)",
                cursor: "pointer",
                fontWeight: 700
              },
              children: "+ \u65B0\u5EFA"
            }
          )
        ]
      }
    ),
    displayActions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      "div",
      {
        style: { textAlign: "center", padding: "18px 0", color: "var(--femo-text-4-weak)" },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 22, marginBottom: 6, opacity: 0.5 }, children: "*" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 11.5 }, children: mode === "module" ? "\u65E0\u53EF\u7528 Actions" : "\u8FD8\u6CA1\u6709 Action" })
        ]
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: cardLayout === "grid3" ? GRID_ROW : void 0, children: displayActions.map((a) => {
      const { c } = ti(a.executorType);
      const bk = ["ai", "human", "mind", "func", "assign", "notice"].includes(a.executorType) ? a.executorType : "ai";
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
        "div",
        {
          draggable: htmlDraggable,
          onDragStart: (e) => onDragStart(e, "action", a.id),
          onClick: () => onSelectLib && onSelectLib("action", a.id),
          onDoubleClick: () => onEdit && onEdit(a),
          "data-femo-lib-drag": `action:${a.id}`,
          style: {
            background: "var(--femo-node-bg)",
            borderRadius: "var(--femo-radius-md)",
            border: `var(--femo-node-border-w) solid var(--femo-node-border)`,
            padding: "8px 10px",
            marginBottom: 7,
            cursor: "grab",
            ...gridItemStyle || {},
            ...grabStyle(isGrabbed("action", a)),
            transition: grabTransition
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                  minWidth: 0
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "span",
                    {
                      style: {
                        background: `var(--femo-badge-bg-${bk})`,
                        color: `var(--femo-badge-fg-${bk})`,
                        borderRadius: "var(--femo-radius-xs)",
                        padding: "1px 5px",
                        fontSize: 8.5,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        fontFamily: "var(--femo-font-mono)",
                        lineHeight: 1.4,
                        flexShrink: 0
                      },
                      children: a.executorType || "ai"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--femo-text-1)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        minWidth: 0
                      },
                      children: a.name
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        onEdit(a);
                      },
                      style: {
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "var(--femo-neutral)",
                        padding: "1px 3px",
                        flexShrink: 0
                      },
                      children: "E"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "span",
                {
                  style: {
                    fontSize: 10,
                    color: "var(--femo-neutral)",
                    fontFamily: "var(--femo-font-mono)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0
                  },
                  children: a.executorActor || ""
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onAdd(a);
                  },
                  style: {
                    padding: "2px 9px",
                    fontSize: 10,
                    background: "var(--femo-btn-primary)",
                    color: "var(--femo-on-accent)",
                    border: "none",
                    borderRadius: "var(--femo-radius-md)",
                    cursor: "pointer",
                    fontWeight: 700,
                    flexShrink: 0,
                    fontFamily: "var(--femo-font-sans)"
                  },
                  children: "+ \u753B\u5E03"
                }
              )
            ] })
          ]
        },
        a.id
      );
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { marginTop: 14, marginBottom: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "div",
        {
          style: {
            fontSize: 10,
            fontWeight: 800,
            color: "var(--femo-neutral)",
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            marginBottom: 6
          },
          children: "\u65B0\u5EFA\u6A21\u5757"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", gap: 5 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "input",
          {
            placeholder: "\u6A21\u5757\u540D",
            style: {
              width: "100%",
              padding: "5px 8px",
              borderRadius: "var(--femo-radius-md)",
              border: "var(--femo-border-w-strong) solid var(--femo-border-strong)",
              fontSize: 11.5,
              color: "var(--femo-text-1)",
              background: "var(--femo-bg)",
              outline: "none",
              fontFamily: "var(--femo-font-sans)",
              transition: "border-color 0.15s, box-shadow 0.15s",
              flex: 1
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "button",
          {
            onClick: (e) => {
              const input = e.target.parentNode.querySelector("input");
              const name = input.value.trim();
              if (name && (!allNames || !allNames.has || !allNames.has(name))) {
                onNewModule(name);
                input.value = "";
              }
            },
            style: {
              padding: "4px 10px",
              fontSize: 11,
              background: "var(--femo-btn-primary)",
              color: "var(--femo-on-accent)",
              border: "none",
              borderRadius: "var(--femo-radius-md)",
              cursor: "pointer",
              fontWeight: 700
            },
            children: "\u521B\u5EFA"
          }
        )
      ] })
    ] }),
    displayModules.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "div",
        {
          style: {
            marginTop: 16,
            marginBottom: 11,
            fontSize: 10,
            fontWeight: 800,
            color: "var(--femo-neutral)",
            textTransform: "uppercase",
            letterSpacing: "0.09em"
          },
          children: "Modules"
        }
      ),
      displayModules.map((m) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "div",
        {
          draggable: htmlDraggable,
          onDragStart: (e) => onDragStart(e, "module", m.id),
          onClick: () => onSelectLib && onSelectLib("module", m.id),
          onDoubleClick: () => onEditModule && onEditModule(m),
          "data-femo-lib-drag": `module:${m.id}`,
          style: {
            background: "var(--femo-node-bg)",
            borderRadius: "var(--femo-radius-md)",
            border: `var(--femo-node-border-w) solid var(--femo-node-border)`,
            padding: "9px 11px",
            marginBottom: 7,
            cursor: "grab",
            ...grabStyle(isGrabbed("module", m)),
            transition: grabTransition
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                  "span",
                  {
                    style: { fontSize: 12.5, fontWeight: 700, color: "var(--femo-text-1)" },
                    children: [
                      "&",
                      m.name
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { style: { display: "flex", gap: 4, flexShrink: 0 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        onEditModule(m);
                      },
                      style: {
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--femo-neutral)",
                        padding: "2px 6px"
                      },
                      children: "\u7F16\u8F91"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        onAddModule(m);
                      },
                      style: {
                        padding: "2px 9px",
                        fontSize: 10,
                        background: "var(--femo-btn-primary)",
                        color: "var(--femo-on-accent)",
                        border: "none",
                        borderRadius: "var(--femo-radius-md)",
                        cursor: "pointer",
                        fontWeight: 700
                      },
                      children: "+ \u753B\u5E03"
                    }
                  )
                ] })
              ]
            }
          )
        },
        m.id
      ))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        style: {
          marginTop: 16,
          marginBottom: 11,
          fontSize: 10,
          fontWeight: 800,
          color: "var(--femo-neutral)",
          textTransform: "uppercase",
          letterSpacing: "0.09em"
        },
        children: "\u7279\u6B8A\u8282\u70B9"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: cardLayout === "grid3" ? SPECIAL_GRID_ROW : void 0, children: specialNodes.map((s) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        draggable: htmlDraggable,
        onDragStart: (e) => onDragStart(e, "special", s.t),
        "data-femo-lib-drag": `special:${s.t}`,
        style: {
          background: "var(--femo-node-bg)",
          borderRadius: "var(--femo-radius-md)",
          border: `var(--femo-node-border-w) solid color-mix(in srgb, ${s.c} 50%, var(--femo-node-bg))`,
          padding: cardLayout === "grid3" ? "7px 8px" : "9px 11px",
          marginBottom: 7,
          cursor: "grab",
          ...gridItemStyle || {},
          ...grabStyle(isGrabbed("special", s.t)),
          transition: grabTransition
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
                "span",
                {
                  style: {
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--femo-text-1)",
                    fontFamily: "var(--femo-font-mono)"
                  },
                  children: [
                    "[",
                    s.lbl,
                    "]"
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "button",
                {
                  onClick: () => onAddSpecial(s.t),
                  style: {
                    padding: "2px 9px",
                    fontSize: 10,
                    background: "var(--femo-btn-primary)",
                    color: "var(--femo-on-accent)",
                    border: "none",
                    borderRadius: "var(--femo-radius-md)",
                    cursor: "pointer",
                    fontWeight: 700
                  },
                  children: "+ \u753B\u5E03"
                }
              )
            ]
          }
        )
      },
      s.t
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      "div",
      {
        draggable: htmlDraggable,
        onDragStart: (e) => onDragStart(e, "position", "POSITION"),
        "data-femo-lib-drag": "position:POSITION",
        style: {
          background: "var(--femo-bg)",
          borderRadius: "var(--femo-radius-md)",
          border: "var(--femo-node-border-w) solid var(--femo-border)",
          padding: "9px 11px",
          marginBottom: 7,
          cursor: "grab",
          ...grabStyle(isGrabbed("position", "POSITION")),
          transition: grabTransition
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--femo-text-1)",
                      fontFamily: "var(--femo-font-mono)"
                    },
                    children: "POSITION"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                  "button",
                  {
                    onClick: onAddPosition,
                    style: {
                      padding: "2px 9px",
                      fontSize: 10,
                      background: "var(--femo-btn-primary)",
                      color: "var(--femo-on-accent)",
                      border: "none",
                      borderRadius: "var(--femo-radius-md)",
                      cursor: "pointer",
                      fontWeight: 700
                    },
                    children: "+ \u753B\u5E03"
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { style: { fontSize: 10, color: "var(--femo-neutral)", marginTop: 3 }, children: "\u7A7A\u8282\u70B9\uFF0C\u4EC5\u5360\u4F4D" })
        ]
      }
    )
  ] });
}

// ../../femoGen/src/projectPanel.jsx
var import_react13 = __toESM(require("react"), 1);
var import_jsx_runtime11 = require("react/jsx-runtime");
function useModelList() {
  const [models, setModels] = (0, import_react13.useState)(null);
  const [err, setErr] = (0, import_react13.useState)("");
  (0, import_react13.useEffect)(() => {
    let alive = true;
    fetch("/femo-plugin/models").then((r) => r.json()).then((d) => {
      if (!alive) return;
      if (d.ok) setModels(d);
      else setErr(d.error || "\u65E0\u6CD5\u83B7\u53D6\u6A21\u578B\u5217\u8868");
    }).catch(() => {
      if (alive) setErr("\u65E0\u6CD5\u83B7\u53D6\u6A21\u578B\u5217\u8868");
    });
    return () => {
      alive = false;
    };
  }, []);
  return [models, err];
}
function sourceOptions(models, current) {
  const opts = [{ value: "", label: "\u8DDF\u968F\u4E3B\u6A21\u578B\uFF08\u9ED8\u8BA4\uFF09" }];
  if (models) {
    for (const p of models.providers || []) {
      for (const m of p.models || []) {
        const v = `${p.id}/${m.id}`;
        opts.push({ value: v, label: v });
      }
    }
  }
  const cur = (current || "").trim();
  if (cur && !opts.some((o) => o.value === cur)) {
    opts.push({ value: cur, label: `${cur}\uFF08\u81EA\u5B9A\u4E49\uFF09` });
  }
  return opts;
}
function ProjPanel({ proj, actorNames, onChange }) {
  const u = (x) => onChange({ ...proj, ...x });
  const [customSel, setCustomSel] = (0, import_react13.useState)({});
  const [models, modelErr] = useModelList();
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(F, { label: "\u9879\u76EE\u540D\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "input",
      {
        value: proj.name,
        onChange: (e) => u({ name: e.target.value }),
        style: inp
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(F, { label: "Version", hint: "", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "input",
        {
          value: proj.version,
          onChange: (e) => u({ version: e.target.value }),
          placeholder: "1.0",
          style: { ...inp }
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(F, { label: "Owner", hint: "user_id", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "input",
        {
          value: proj.owner,
          onChange: (e) => u({ owner: e.target.value }),
          placeholder: "1",
          style: { ...inp }
        }
      ) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(F, { label: "Database", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "input",
        {
          value: proj.database,
          onChange: (e) => u({ database: e.target.value }),
          placeholder: "memory/Chronica.wor",
          style: { ...inp }
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(F, { label: "Session", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "input",
        {
          value: proj.session,
          onChange: (e) => u({ session: e.target.value }),
          placeholder: "new",
          style: { ...inp }
        }
      ) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(F, { label: "\u8282\u70B9\u5EF6\u8FDF(s)", hint: "\u6BCF\u4E2A\u8282\u70B9\u6267\u884C\u524D\u7684\u7B49\u5F85\u79D2\u6570", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "input",
      {
        type: "number",
        value: proj.delay ?? "",
        onChange: (e) => {
          const v = e.target.value;
          u({ delay: v === "" ? void 0 : Number(v) });
        },
        style: { ...inp, width: "100%" },
        step: "0.1",
        min: "0",
        placeholder: "\u4F8B\u5982 10"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(F, { label: "System Safety", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "textarea",
      {
        value: proj.system_safety,
        onChange: (e) => u({ system_safety: e.target.value }),
        rows: 2,
        placeholder: "\u5B89\u5168\u987B\u77E5...",
        style: { ...inp, resize: "vertical", lineHeight: 1.55 }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(F, { label: "Output Style", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      "textarea",
      {
        value: proj.output_style,
        onChange: (e) => u({ output_style: e.target.value }),
        rows: 2,
        placeholder: "\u8F93\u51FA\u98CE\u683C\u8981\u6C42...",
        style: { ...inp, resize: "vertical", lineHeight: 1.55 }
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { marginTop: 2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 9
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "span",
              {
                style: {
                  fontSize: 10,
                  fontWeight: 800,
                  color: "var(--femo-neutral)",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em"
                },
                children: "Actors"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "button",
              {
                onClick: () => u({
                  actors: [
                    ...proj.actors || [],
                    {
                      name: "",
                      type: "ai",
                      soul: "",
                      source: "",
                      tools: null,
                      // 未声明 = 宿主默认全开（[] 是显式空白名单 ≡ 禁用，别混）
                      thinking: ""
                    }
                  ]
                }),
                style: { ...btnP, padding: "4px 11px", fontSize: 11 },
                children: "+"
              }
            )
          ]
        }
      ),
      (proj.actors || []).map((a, i) => {
        const upd = (x) => u({
          actors: proj.actors.map((p, j) => j === i ? { ...p, ...x } : p)
        });
        const actorName = a.name.replace("@", "");
        const nameConflict = actorName && actorNames.includes(actorName) && proj.actors.findIndex(
          (p, j) => j !== i && p.name.replace("@", "") === actorName
        ) !== -1;
        return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
          "div",
          {
            style: {
              background: "var(--femo-bg)",
              border: `var(--femo-border-w) solid ${nameConflict ? "var(--femo-danger)" : "var(--femo-border)"}`,
              borderRadius: "var(--femo-radius-md)",
              padding: "9px 10px",
              marginBottom: 6
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    gap: 5,
                    marginBottom: 5,
                    alignItems: "center"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
                      "select",
                      {
                        value: a.type,
                        onChange: (e) => upd({ type: e.target.value }),
                        style: {
                          ...inp,
                          // 宽度自适应内容（ai/human），不随栏宽收缩
                          width: "auto",
                          flex: "0 0 auto",
                          padding: "5px 6px",
                          fontSize: 11
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("option", { value: "ai", children: "ai" }),
                          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("option", { value: "human", children: "human" })
                        ]
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                      "input",
                      {
                        value: a.name,
                        onChange: (e) => {
                          let v = e.target.value.trim();
                          if (v && !v.startsWith("@")) v = "@" + v;
                          upd({ name: v });
                        },
                        placeholder: "@Alice",
                        style: {
                          ...inp,
                          flex: 1,
                          padding: "5px 8px",
                          fontSize: 11.5,
                          borderColor: nameConflict ? "var(--femo-danger)" : void 0
                        }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                      "button",
                      {
                        onClick: () => u({ actors: proj.actors.filter((_, j) => j !== i) }),
                        style: {
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--femo-danger-weak)",
                          fontSize: 17,
                          lineHeight: 1
                        },
                        children: "x"
                      }
                    )
                  ]
                }
              ),
              nameConflict && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
                "div",
                {
                  style: { fontSize: 10, color: "var(--femo-danger)", marginBottom: 4 },
                  children: [
                    '\u540D\u79F0 "',
                    actorName,
                    '" \u4E0E action/module \u91CD\u540D'
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", gap: 5 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                  "input",
                  {
                    value: a.soul,
                    onChange: (e) => upd({ soul: e.target.value }),
                    placeholder: "soul:1",
                    style: { ...inp, flex: 1, padding: "4px 7px", fontSize: 11 }
                  }
                ),
                a.type === "ai" && models ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                  "select",
                  {
                    value: a.source || "",
                    onChange: (e) => upd({ source: e.target.value }),
                    title: "\u6765\u6E90\u6A21\u578B\uFF08dsh \u53EF\u7528\u5217\u8868\uFF1B\u7A7A=\u63D2\u4EF6\u914D\u7F6E\u9ED8\u8BA4\uFF09",
                    style: { ...inp, flex: 1, padding: "4px 7px", fontSize: 11 },
                    children: sourceOptions(models, a.source).map((o) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("option", { value: o.value, children: o.label }, o.value))
                  }
                ) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                  "input",
                  {
                    value: a.source,
                    onChange: (e) => upd({ source: e.target.value }),
                    placeholder: a.type === "ai" ? modelErr || "deepseek" : "\u6570\u5B57ID",
                    style: { ...inp, flex: 1, padding: "4px 7px", fontSize: 11 }
                  }
                )
              ] }),
              a.type === "ai" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { marginTop: 5 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--femo-text-3)",
                      marginBottom: 4
                    },
                    children: "Tools"
                  }
                ),
                (() => {
                  const toolsMode = customSel[a.name] ? "custom" : a.tools === true ? "all" : a.tools === false ? "off" : Array.isArray(a.tools) && a.tools.length > 0 ? "custom" : null;
                  const customText = Array.isArray(a.tools) ? a.tools.join(", ") : "";
                  const clearCustom = () => {
                    const next = { ...customSel };
                    delete next[a.name];
                    setCustomSel(next);
                  };
                  const modes = [
                    { id: "all", label: "\u6240\u6709\u5DE5\u5177" },
                    { id: "off", label: "\u5173\u95ED\u5DE5\u5177" },
                    { id: "custom", label: "\u8F93\u5165\u5DE5\u5177" }
                  ];
                  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: modes.map((m) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
                      "label",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10.5,
                          cursor: "pointer"
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                            "input",
                            {
                              type: "radio",
                              checked: toolsMode === m.id,
                              onChange: () => {
                                if (m.id === "all") {
                                  clearCustom();
                                  upd({ tools: true });
                                } else if (m.id === "off") {
                                  clearCustom();
                                  upd({ tools: false });
                                } else {
                                  setCustomSel({ ...customSel, [a.name]: true });
                                  upd({ tools: [] });
                                }
                              }
                            }
                          ),
                          m.label
                        ]
                      },
                      m.id
                    )) }),
                    toolsMode === "custom" && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                      "input",
                      {
                        value: customText,
                        onChange: (e) => {
                          const list = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                          upd({ tools: list });
                        },
                        placeholder: "deep_think, web_search, shell",
                        style: { ...inp, marginTop: 6, padding: "4px 7px", fontSize: 11 }
                      }
                    )
                  ] });
                })()
              ] }),
              a.type === "ai" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { marginTop: 5 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                  "div",
                  {
                    style: {
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--femo-text-3)",
                      marginBottom: 4
                    },
                    children: "Thinking"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
                  "select",
                  {
                    value: a.thinking || "",
                    onChange: (e) => upd({ thinking: e.target.value }),
                    style: { ...inp, width: "100%", padding: "4px 7px", fontSize: 11 },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("option", { value: "", children: "Default" }),
                      ["off", "minimal", "low", "medium", "high", "xhigh", "max"].map((lv) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("option", { value: lv, children: lv }, lv))
                    ]
                  }
                )
              ] })
            ]
          },
          i
        );
      })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { marginTop: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: { fontSize: 10, fontWeight: 800, color: "var(--femo-neutral)", textTransform: "uppercase", letterSpacing: "0.09em" }, children: "Vars" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "button",
          {
            onClick: () => u({ vars: [...proj.vars || [], { name: "", defaultValue: "" }] }),
            style: { ...btnP, padding: "4px 11px", fontSize: 11 },
            children: "+"
          }
        )
      ] }),
      (proj.vars || []).map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", gap: 5, marginBottom: 5, alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "input",
          {
            value: v.name,
            onChange: (e) => {
              const upd = [...proj.vars];
              upd[i] = { ...upd[i], name: e.target.value };
              u({ vars: upd });
            },
            placeholder: "\u53D8\u91CF\u540D",
            style: { ...inp, flex: 1, padding: "5px 8px", fontSize: 11.5 }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "input",
          {
            value: v.defaultValue,
            onChange: (e) => {
              const upd = [...proj.vars];
              upd[i] = { ...upd[i], defaultValue: e.target.value };
              u({ vars: upd });
            },
            placeholder: "\u9ED8\u8BA4\u503C",
            style: { ...inp, flex: 2, padding: "5px 8px", fontSize: 11.5 }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "button",
          {
            onClick: () => u({ vars: proj.vars.filter((_, j) => j !== i) }),
            style: { background: "none", border: "none", cursor: "pointer", color: "var(--femo-danger-weak)", fontSize: 17, lineHeight: 1 },
            children: "x"
          }
        )
      ] }, i))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { marginTop: 16 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 9
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "span",
              {
                style: {
                  fontSize: 10,
                  fontWeight: 800,
                  color: "var(--femo-neutral)",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em"
                },
                children: "Code"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "button",
              {
                onClick: () => u({ code: [...proj.code || [], { name: "", value: "" }] }),
                style: { ...btnP, padding: "4px 11px", fontSize: 11 },
                children: "+"
              }
            )
          ]
        }
      ),
      (proj.code || []).map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        "div",
        {
          style: {
            display: "flex",
            gap: 5,
            marginBottom: 5,
            alignItems: "center"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "input",
              {
                value: c.name,
                onChange: (e) => {
                  const upd = [...proj.code];
                  upd[i] = { ...upd[i], name: e.target.value };
                  u({ code: upd });
                },
                placeholder: "\u540D\u79F0",
                style: { ...inp, flex: 1, padding: "5px 8px", fontSize: 11.5 }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "input",
              {
                value: c.value,
                onChange: (e) => {
                  const upd = [...proj.code];
                  upd[i] = { ...upd[i], value: e.target.value };
                  u({ code: upd });
                },
                placeholder: "\u6587\u4EF6\u8DEF\u5F84\uFF08\u5982 utils.py\uFF09",
                style: { ...inp, flex: 2, padding: "5px 8px", fontSize: 11.5 }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "button",
              {
                onClick: () => u({ code: proj.code.filter((_, j) => j !== i) }),
                style: {
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--femo-danger-weak)",
                  fontSize: 17,
                  lineHeight: 1
                },
                children: "x"
              }
            )
          ]
        },
        i
      ))
    ] })
  ] });
}

// ../../femoGen/src/actionModal.jsx
var import_react14 = __toESM(require("react"), 1);
var import_jsx_runtime12 = require("react/jsx-runtime");
var TYPE_DISPLAY_ORDER = ["mind", "ai", "human", "func", "assign", "notice"];
var orderedTypes = (types) => TYPE_DISPLAY_ORDER.map((t) => types.find((x) => x.t === t)).filter(Boolean);
function ActionModal({
  init,
  existingNames,
  onSave,
  onClose,
  isModuleInternal
}) {
  const blank = {
    name: "",
    executorType: "ai",
    executorActor: "",
    prompt: "",
    showprompt: "",
    scope: "",
    outVars: "",
    inMappings: "",
    resolve: "",
    resolveArgs: "",
    maxRetries: 0,
    fallback: "",
    interrupt: "",
    memory: "",
    context: ""
  };
  const [f, setF] = (0, import_react14.useState)(init || blank);
  const [nameErr, setNameErr] = (0, import_react14.useState)("");
  const u = (x) => setF((p) => ({ ...p, ...x }));
  const type = ti(f.executorType);
  function handleNameChange(val) {
    u({ name: val });
    if (val.trim() && existingNames?.includes(val.trim()) && val.trim() !== init?.name) {
      setNameErr(
        `\u540D\u79F0 "${val.trim()}" \u5DF2\u88AB action/module/actor \u4F7F\u7528\uFF0C\u8BF7\u6362\u4E00\u4E2A`
      );
    } else {
      setNameErr("");
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        background: "var(--femo-mask-blue)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(2px)"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
        "div",
        {
          style: {
            background: "var(--femo-surface)",
            borderRadius: "var(--femo-radius-xl)",
            width: 510,
            maxHeight: "88vh",
            overflow: "auto",
            boxShadow: "0 32px 80px var(--femo-shadow-lg)",
            fontFamily: "var(--femo-font-sans)"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
              "div",
              {
                style: {
                  padding: "18px 22px 14px",
                  borderBottom: "var(--femo-border-w) solid var(--femo-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  position: "sticky",
                  top: 0,
                  background: "var(--femo-surface)",
                  zIndex: 1
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { style: { fontWeight: 800, fontSize: 15.5, color: "var(--femo-text-1)" }, children: init ? "\u7F16\u8F91 Action" : "\u65B0\u5EFA Action" }),
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { style: { fontSize: 10.5, color: "var(--femo-text-4)", marginTop: 1 }, children: "\u5B9A\u4E49\u540E\u5C06\u51FA\u73B0\u5728\u7EC4\u4EF6\u5E93\u4E2D\uFF0C\u53EF\u62D6\u81F3\u753B\u5E03" })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                    "button",
                    {
                      onClick: onClose,
                      style: {
                        background: "none",
                        border: "none",
                        fontSize: 22,
                        cursor: "pointer",
                        color: "var(--femo-text-4)",
                        lineHeight: 1,
                        padding: 4
                      },
                      children: "x"
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { padding: "18px 22px 22px" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(F, { label: "Action \u540D\u79F0 *", children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  "input",
                  {
                    value: f.name,
                    onChange: (e) => handleNameChange(e.target.value),
                    placeholder: "wolf_kill \xB7 speak \xB7 vote \xB7 resolve_night",
                    style: { ...inp, borderColor: nameErr ? "var(--femo-danger)" : void 0 },
                    autoFocus: true
                  }
                ),
                nameErr && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { style: { fontSize: 10.5, color: "var(--femo-danger)", marginTop: 4 }, children: nameErr })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "\u6267\u884C\u8005\u7C7B\u578B *", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { style: { display: "flex", gap: 7 }, children: orderedTypes(TYPES).map((tp) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "button",
                {
                  onClick: () => u({ executorType: tp.t }),
                  style: {
                    flex: 1,
                    padding: "8px 2px",
                    borderRadius: "var(--femo-radius-md)",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: "var(--femo-font-mono)",
                    border: `var(--femo-border-w-selected) solid ${f.executorType === tp.t ? tp.c : "var(--femo-border-strong)"}`,
                    background: f.executorType === tp.t ? tp.bg : "var(--femo-surface)",
                    color: f.executorType === tp.t ? tp.c : "var(--femo-text-4)",
                    transition: "all 0.12s"
                  },
                  children: tp.lbl
                },
                tp.t
              )) }) }),
              f.executorType !== "notice" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "input",
                {
                  value: f.executorActor,
                  onChange: (e) => {
                    let v = e.target.value.trim();
                    if (v && !v.startsWith("@") && f.executorType !== "func" && f.executorType !== "assign")
                      v = "@" + v;
                    u({ executorActor: v });
                  },
                  placeholder: f.executorType === "func" ? "werewolf_utils.resolve_night" : "@wolf",
                  style: {
                    ...inp,
                    fontFamily: f.executorType === "func" ? "JetBrains Mono, monospace" : "DM Sans, sans-serif",
                    fontSize: f.executorType === "func" ? 12 : 12.5
                  }
                }
              ) }),
              (f.executorType === "ai" || f.executorType === "human" || f.executorType === "mind" || f.executorType === "notice") && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "Prompt", hint: f.executorType === "notice" ? "\u6CE8\u5165\u7684\u516C\u544A\u6587\u672C\uFF0C\u652F\u6301 {\u53D8\u91CF} \u63D2\u503C\uFF0Cscope \u5185\u89D2\u8272\u5C06\u8BFB\u5230" : "\u652F\u6301 {\u53D8\u91CF} \u63D2\u503C\uFF0CAI \u9700\u8F93\u51FA <<KEY: value>>", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "textarea",
                {
                  value: f.prompt,
                  onChange: (e) => u({ prompt: e.target.value }),
                  rows: 4,
                  placeholder: f.executorType === "notice" ? "\u3010\u5E7F\u64AD\u3011\u4ECA\u591C\u66B4\u96E8\uFF0C\u516C\u56ED\u5185\u7684\u73A9\u5BB6\u8BF7\u5168\u90E8\u56DE\u5BB6\u3002\n\u5F53\u524D\u5B58\u6D3B\u73A9\u5BB6\uFF1A{alive}" : "\u591C\u665A\u964D\u4E34\u3002\u4F60\u662F\u72FC\u4EBA\uFF0C\u4F60\u7684\u961F\u53CB\u662F {wolves}\u3002\n\u5B58\u6D3B\u73A9\u5BB6\uFF1A{alive}\n\u8BF7\u548C\u961F\u53CB\u8BA8\u8BBA\u4ECA\u665A\u6740\u8C01\u3002\n\u6700\u540E\u8F93\u51FA\uFF1A<<KILL: @\u76EE\u6807\u540D\u5B57>>",
                  style: { ...inp, resize: "vertical", lineHeight: 1.65 }
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "Show Prompt", hint: "\u5728\u4E0A\u4E0B\u6587\u4E2D\u4F1A\u663E\u793A\u7684\u63D0\u793A\uFF0C\u5B83\u7EC4\u6210\u4E0A\u4E0B\u6587\u53D9\u4E8B\u7684\u4E00\u90E8\u5206", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "textarea",
                {
                  value: f.showprompt || "",
                  onChange: (e) => u({ showprompt: e.target.value }),
                  rows: 3,
                  placeholder: "\u4F8B\u5982\uFF1A\u8BF7\u7B49\u5F85\u5176\u4ED6\u73A9\u5BB6\u64CD\u4F5C...",
                  style: { ...inp, resize: "vertical", lineHeight: 1.65 }
                }
              ) }),
              f.executorType === "func" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "in \u53C2\u6570\u6620\u5C04", hint: "\u6BCF\u884C\uFF1Aparam = var", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "textarea",
                {
                  value: f.inMappings,
                  onChange: (e) => u({ inMappings: e.target.value }),
                  rows: 3,
                  placeholder: "target_name = seer_check_target\nsous_dict = souls\nalive_players = alive",
                  style: {
                    ...inp,
                    resize: "vertical",
                    fontFamily: "var(--femo-font-mono)",
                    fontSize: 11.5,
                    lineHeight: 1.7
                  }
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "Scope", hint: "\u9017\u53F7\u5206\u9694\uFF0C\u8C01\u80FD\u770B\u5230\u8FD9\u6B21\u5BF9\u8BDD", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "input",
                {
                  value: f.scope,
                  onChange: (e) => u({ scope: e.target.value }),
                  placeholder: "@hostgod, @wolf, @seer",
                  style: inp
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "in \u53C2\u6570\u6620\u5C04", hint: "\u6BCF\u884C\uFF1Aparam = var", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "textarea",
                {
                  value: f.inMappings,
                  onChange: (e) => u({ inMappings: e.target.value }),
                  rows: 3,
                  placeholder: "target_name = seer_check_target\nsous_dict = souls\nalive_players = alive",
                  style: {
                    ...inp,
                    resize: "vertical",
                    fontFamily: "var(--femo-font-mono)",
                    fontSize: 11.5,
                    lineHeight: 1.7
                  }
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "resolve \u51FD\u6570", hint: "\u6A21\u5757.\u51FD\u6570\uFF0C\u5982 werewolf.resolve_action", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "input",
                {
                  value: f.resolve || "",
                  onChange: (e) => u({ resolve: e.target.value.trim() }),
                  placeholder: "q.answer",
                  style: { ...inp, fontFamily: "var(--femo-font-mono)" }
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "resolve \u53C2\u6570", hint: "\u9017\u53F7\u5206\u9694\uFF0C\u5982 prompt, llm_output, count", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "input",
                {
                  value: f.resolveArgs || "",
                  onChange: (e) => u({ resolveArgs: e.target.value.trim() }),
                  placeholder: "prompt, llm_output, count",
                  style: { ...inp, fontFamily: "var(--femo-font-mono)" }
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "\u6700\u5927\u91CD\u8BD5\u6B21\u6570", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  "input",
                  {
                    type: "number",
                    value: f.maxRetries || 0,
                    onChange: (e) => u({ maxRetries: parseInt(e.target.value) || 0 }),
                    style: { ...inp, width: "100%" }
                  }
                ) }),
                /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "fallback", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                  "input",
                  {
                    value: f.fallback || "",
                    onChange: (e) => u({ fallback: e.target.value.trim() }),
                    placeholder: "retry / abort",
                    style: { ...inp }
                  }
                ) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "interrupt", hint: "HUMAN \u53EF\u6682\u505C\u7B49\u5F85\u8F93\u5165", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "input",
                {
                  value: f.interrupt || "",
                  onChange: (e) => u({ interrupt: e.target.value.trim() }),
                  placeholder: "HUMAN",
                  style: inp
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "Memory \u914D\u7F6E", hint: "\u5982 memory: default", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "input",
                {
                  value: f.memory || "",
                  onChange: (e) => u({ memory: e.target.value.trim() }),
                  placeholder: "default",
                  style: inp
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "Context \u914D\u7F6E", hint: "\u5982 context: default", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "input",
                {
                  value: f.context || "",
                  onChange: (e) => u({ context: e.target.value.trim() }),
                  placeholder: "default",
                  style: inp
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(F, { label: "out \u53D8\u91CF", hint: "\u53D8\u91CF\u540D(\u7C7B\u578B, '\u8BF4\u660E'), \u9017\u53F7\u5206\u9694", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                "input",
                {
                  value: f.outVars,
                  onChange: (e) => u({ outVars: e.target.value }),
                  placeholder: "kill_target(string, '\u51FB\u6740\u76EE\u6807')",
                  style: inp
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: "var(--femo-border-w) solid var(--femo-border)"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { onClick: onClose, style: btnS, children: "\u53D6\u6D88" }),
                    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
                      "button",
                      {
                        onClick: () => {
                          if (!f.name.trim()) return;
                          if (nameErr) return;
                          onSave({ ...f, id: init?.id || aid() });
                        },
                        style: {
                          ...btnP,
                          background: type.c,
                          opacity: f.name.trim() && !nameErr ? 1 : 0.5
                        },
                        children: "\u4FDD\u5B58 Action"
                      }
                    )
                  ]
                }
              )
            ] })
          ]
        }
      )
    }
  );
}

// ../../femoGen/src/soulModal.jsx
var import_react15 = __toESM(require("react"), 1);
var import_jsx_runtime13 = require("react/jsx-runtime");
function SoulModal({ open, onClose, onCreated, createUrl = "/api/souls/create" }) {
  const [soulForm, setSoulForm] = (0, import_react15.useState)({
    soul_id: "",
    soul_name: "",
    description: ""
  });
  const [soulFormError, setSoulFormError] = (0, import_react15.useState)("");
  const [soulFormSubmitting, setSoulFormSubmitting] = (0, import_react15.useState)(false);
  if (!open) return null;
  const handleCreateSoul = async () => {
    if (!soulForm.soul_id.trim()) {
      setSoulFormError("Soul ID \u4E0D\u80FD\u4E3A\u7A7A");
      return;
    }
    setSoulFormSubmitting(true);
    setSoulFormError("");
    try {
      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(soulForm)
      });
      const data = await res.json();
      if (data.error) {
        setSoulFormError(data.error);
      } else {
        onCreated && onCreated(data);
        onClose();
      }
    } catch (e) {
      setSoulFormError(e.message);
    } finally {
      setSoulFormSubmitting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    "div",
    {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 3e3,
        background: "var(--femo-mask-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
        "div",
        {
          style: {
            background: "var(--femo-surface)",
            borderRadius: "var(--femo-radius-xl)",
            padding: "28px 32px",
            width: 420,
            maxWidth: "92vw",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 8px 32px var(--femo-shadow-md)"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { fontSize: 17, fontWeight: 700, color: "var(--femo-text-1)", marginBottom: 18 }, children: "\u{1F194} \u65B0\u5EFA SOUL ID" }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { marginBottom: 13 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--femo-primary)", marginBottom: 4 }, children: [
                "Soul ID ",
                /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { style: { color: "var(--femo-danger)" }, children: "*" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                "input",
                {
                  value: soulForm.soul_id,
                  onChange: (e) => setSoulForm({ ...soulForm, soul_id: e.target.value.replace(/[^a-zA-Z0-9]/g, "") }),
                  placeholder: "\u82F1\u6587+\u6570\u5B57\uFF0C\u4E0D\u53EF\u91CD\u590D",
                  style: { ...inp, width: "100%" },
                  autoFocus: true
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { marginBottom: 13 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--femo-primary)", marginBottom: 4 }, children: "Soul Name" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                "input",
                {
                  value: soulForm.soul_name,
                  onChange: (e) => setSoulForm({ ...soulForm, soul_name: e.target.value }),
                  placeholder: "\u89D2\u8272\u540D\u79F0\uFF0C\u53EF\u91CD\u590D",
                  style: { ...inp, width: "100%" }
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { marginBottom: 13 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { fontSize: 12, fontWeight: 600, color: "var(--femo-primary)", marginBottom: 4 }, children: "Description" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                "textarea",
                {
                  value: soulForm.description,
                  onChange: (e) => setSoulForm({ ...soulForm, description: e.target.value }),
                  placeholder: "\u89D2\u8272\u7684 System Prompt\uFF0C\u5B9A\u4E49\u89D2\u8272\u7684\u884C\u4E3A\u548C\u4EBA\u683C...",
                  style: { ...inp, width: "100%", minHeight: 80, resize: "vertical", fontFamily: "inherit" }
                }
              )
            ] }),
            soulFormError && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
              "div",
              {
                style: {
                  background: "var(--femo-danger-soft)",
                  color: "var(--femo-danger-strong)",
                  padding: "8px 12px",
                  borderRadius: "var(--femo-radius-md)",
                  fontSize: 12,
                  marginBottom: 12,
                  border: "var(--femo-border-w) solid var(--femo-danger-border)"
                },
                children: soulFormError
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                "button",
                {
                  onClick: () => {
                    onClose();
                    setSoulFormError("");
                  },
                  style: btnS,
                  children: "\u53D6\u6D88"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                "button",
                {
                  onClick: handleCreateSoul,
                  disabled: soulFormSubmitting,
                  style: {
                    ...btnP,
                    background: "var(--femo-primary)",
                    opacity: soulFormSubmitting ? 0.6 : 1,
                    cursor: soulFormSubmitting ? "not-allowed" : "pointer"
                  },
                  children: soulFormSubmitting ? "\u521B\u5EFA\u4E2D..." : "\u521B\u5EFA"
                }
              )
            ] })
          ]
        }
      )
    }
  );
}

// ../../femoGen/src/femoFileList.jsx
var import_react16 = __toESM(require("react"), 1);

// ../../femoGen/src/faIcons.jsx
var import_jsx_runtime14 = require("react/jsx-runtime");
function make2(viewBox, d, fillRule) {
  return function FaIcon({ size = 14, style }) {
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox,
        width: size,
        height: size,
        style,
        "aria-hidden": "true",
        fill: "currentColor",
        children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("path", { d, fillRule, clipRule: fillRule })
      }
    );
  };
}
var FaPlay = make2("0 0 384 512", "M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80L0 432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z");
var FaPause = make2("0 0 320 512", "M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z");
var FaArrowRotateRight = make2("0 0 512 512", "M386.3 160L336 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-128c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 51.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0s-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3s163.8-62.5 226.3 0L386.3 160z");
var FaForward = make2("0 0 512 512", "M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416L0 96C0 83.6 7.2 72.3 18.4 67s24.5-3.6 34.1 4.4L224 214.3l0 41.7 0 41.7L52.5 440.6zM256 352l0-96 0-128 0-32c0-12.4 7.2-23.7 18.4-29s24.5-3.6 34.1 4.4l192 160c7.3 6.1 11.5 15.1 11.5 24.6s-4.2 18.5-11.5 24.6l-192 160c-9.5 7.9-22.8 9.7-34.1 4.4s-18.4-16.6-18.4-29l0-64z");
var FaSpinner = make2("0 0 512 512", "M304 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zm0 416a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM48 304a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm464-48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zM142.9 437A48 48 0 1 0 75 369.1 48 48 0 1 0 142.9 437zm0-294.2A48 48 0 1 0 75 75a48 48 0 1 0 67.9 67.9zM369.1 437A48 48 0 1 0 437 369.1 48 48 0 1 0 369.1 437z");
var FaFolderOpen = make2("0 0 576 512", "M88.7 223.8L0 375.8 0 96C0 60.7 28.7 32 64 32l117.5 0c17 0 33.3 6.7 45.3 18.7l26.5 26.5c12 12 28.3 18.7 45.3 18.7L416 96c35.3 0 64 28.7 64 64l0 32-336 0c-22.8 0-43.8 12.1-55.3 31.8zm27.6 16.1C122.1 230 132.6 224 144 224l400 0c11.5 0 22 6.1 27.7 16.1s5.7 22.2-.1 32.1l-112 192C453.9 474 443.4 480 432 480L32 480c-11.5 0-22-6.1-27.7-16.1s-5.7-22.2 .1-32.1l112-192z");
var FaFloppyDisk = make2("0 0 448 512", "M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-242.7c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32L64 32zm0 96c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-64zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z");
var FaPalette = make2("0 0 512 512", "M512 256c0 .9 0 1.8 0 2.7c-.4 36.5-33.6 61.3-70.1 61.3H344c-26.5 0-48 21.5-48 48c0 3.4 .4 6.7 1 9.9c2.1 10.2 6.5 20 10.8 29.9c6.1 13.8 12.1 27.5 12.1 42c0 31.8-21.6 60.7-53.4 62c-3.5 .1-7 .2-10.6 .2C114.6 512 0 397.4 0 256S114.6 0 256 0S512 114.6 512 256zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm0-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 96a32 32 0 1 0 0-64 32 32 0 1 0 0 64z");
var FaUserPlus = make2("0 0 640 512", "M96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3zM504 312V248H440c-13.3 0-24-10.7-24-24s10.7-24 24-24h64V136c0-13.3 10.7-24 24-24s24 10.7 24 24v64h64c13.3 0 24 10.7 24 24s-10.7 24-24 24H552v64c0 13.3-10.7 24-24 24s-24-10.7-24-24z");
var FaTerminal = make2("0 0 576 512", "M9.4 86.6C-3.1 74.1-3.1 53.9 9.4 41.4s32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L178.7 256 9.4 86.6zM256 416H544c17.7 0 32 14.3 32 32s-14.3 32-32 32H256c-17.7 0-32-14.3-32-32s14.3-32 32-32z");
var FaBug = make2("0 0 512 512", "M256 0c53 0 96 43 96 96v3.6c0 15.7-12.7 28.4-28.4 28.4H188.4c-15.7 0-28.4-12.7-28.4-28.4V96c0-53 43-96 96-96zM41.4 105.4c12.5-12.5 32.8-12.5 45.3 0l64 64c.7 .7 1.3 1.4 1.9 2.1c14.2-7.3 30.4-11.4 47.5-11.4H312c17.1 0 33.2 4.1 47.5 11.4c.6-.7 1.2-1.4 1.9-2.1l64-64c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3l-64 64c-.7 .7-1.4 1.3-2.1 1.9c6.2 12 10.1 25.3 11.1 39.5H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H416c0 24.6-5.5 47.8-15.4 68.6c2.2 1.3 4.2 2.9 6 4.8l64 64c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0l-63.1-63.1c-24.5 21.8-55.8 36.2-90.3 39.6V240c0-8.8-7.2-16-16-16s-16 7.2-16 16V479.2c-34.5-3.4-65.8-17.8-90.3-39.6L86.6 502.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l64-64c1.9-1.9 3.9-3.4 6-4.8C101.5 367.8 96 344.6 96 320H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H96.3c1.1-14.1 5-27.5 11.1-39.5c-.7-.6-1.4-1.2-2.1-1.9l-64-64c-12.5-12.5-12.5-32.8 0-45.3z");
var IconPanelLeftOutline = make2("0 0 16 16", "M9.67272 0.522841C10.8339 0.522841 11.76 0.522714 12.4963 0.602493C13.2453 0.683657 13.8789 0.854248 14.4264 1.25197C14.7504 1.48739 15.0355 1.77247 15.2709 2.0965C15.6686 2.64394 15.8392 3.27758 15.9204 4.02655C16.0002 4.7629 16 5.68895 16 6.85014V9.14986C16 10.3111 16.0002 11.2371 15.9204 11.9735C15.8392 12.7224 15.6686 13.3561 15.2709 13.9035C15.0355 14.2275 14.7504 14.5126 14.4264 14.748C13.8789 15.1458 13.2453 15.3163 12.4963 15.3975C11.76 15.4773 10.8339 15.4772 9.67272 15.4772H6.3273C5.16611 15.4772 4.24006 15.4773 3.50371 15.3975C2.75474 15.3163 2.1211 15.1458 1.57366 14.748C1.24963 14.5126 0.964549 14.2275 0.729131 13.9035C0.331407 13.3561 0.160817 12.7224 0.0796529 11.9735C-0.000126137 11.2371 1.25338e-09 10.3111 1.25338e-09 9.14986V6.85014C1.25329e-09 5.68895 -0.000126137 4.7629 0.0796529 4.02655C0.160817 3.27758 0.331407 2.64394 0.729131 2.0965C0.964549 1.77247 1.24963 1.48739 1.57366 1.25197C2.1211 0.854248 2.75474 0.683657 3.50371 0.602493C4.24006 0.522714 5.16611 0.522841 6.3273 0.522841H9.67272ZM5.54303 1.88715V14.1118C5.78636 14.1128 6.04709 14.1169 6.3273 14.1169H9.67272C10.8639 14.1169 11.7032 14.1164 12.3493 14.0465C12.9824 13.9779 13.3497 13.8494 13.6268 13.6482C13.8354 13.4966 14.0195 13.3125 14.1711 13.1039C14.3723 12.8268 14.5007 12.4595 14.5693 11.8264C14.6393 11.1803 14.6398 10.341 14.6398 9.14986V6.85014C14.6398 5.65896 14.6393 4.81967 14.5693 4.1736C14.5007 3.54048 14.3723 3.17318 14.1711 2.89609C14.0195 2.68747 13.8354 2.50337 13.6268 2.35179C13.3497 2.1506 12.9824 2.02212 12.3493 1.95353C11.7032 1.88358 10.8639 1.88307 9.67272 1.88307H6.3273C6.04709 1.88307 5.78636 1.8862 5.54303 1.88715ZM4.1828 1.91166C3.99125 1.9216 3.8148 1.93577 3.65076 1.95353C3.01764 2.02212 2.65034 2.1506 2.37325 2.35179C2.16463 2.50337 1.98052 2.68747 1.82895 2.89609C1.62776 3.17318 1.49928 3.54048 1.43069 4.1736C1.36074 4.81967 1.36023 5.65896 1.36023 6.85014V9.14986C1.36023 10.341 1.36074 11.1803 1.43069 11.8264C1.49928 12.4595 1.62776 12.8268 1.82895 13.1039C1.98052 13.3125 2.16463 13.4966 2.37325 13.6482C2.65034 13.8494 3.01764 13.9779 3.65076 14.0465C3.81478 14.0642 3.99127 14.0774 4.1828 14.0873V1.91166Z", "evenodd");
var FaSquareOutline = make2("0 0 448 512", "M384 80c8.8 0 16 7.2 16 16l0 320c0 8.8-7.2 16-16 16L64 432c-8.8 0-16-7.2-16-16L48 96c0-8.8 7.2-16 16-16l320 0zM64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32z");
var FaCircleMinus = make2("0 0 512 512", "M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM184 232l144 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-144 0c-13.3 0-24-10.7-24-24s10.7-24 24-24z");

// ../../femoGen/src/femoFileList.jsx
var import_jsx_runtime15 = require("react/jsx-runtime");
function relTime(ts) {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "";
  const diff = Date.now() - ts;
  if (diff < 6e4) return "\u521A\u521A";
  if (diff < 36e5) return `${Math.floor(diff / 6e4)} \u5206\u949F\u524D`;
  if (diff < 864e5) return `${Math.floor(diff / 36e5)} \u5C0F\u65F6\u524D`;
  if (diff < 30 * 864e5) return `${Math.floor(diff / 864e5)} \u5929\u524D`;
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtSize(n) {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
var ROW_CSS = `
.femo-file-row { transition: background 0.12s ease; }
.femo-file-row:not(:disabled):hover { background: color-mix(in srgb, var(--femo-primary) 6%, transparent); }
.femo-file-row:not(:disabled):active { background: color-mix(in srgb, var(--femo-primary) 12%, transparent); }
.femo-file-row:disabled { cursor: not-allowed; }
.femo-forget-btn { transition: background 0.12s ease, color 0.12s ease; color: var(--femo-text-4); }
.femo-forget-btn:not(:disabled):hover { background: color-mix(in srgb, var(--femo-text-4) 14%, transparent); color: var(--femo-text-2); }
.femo-forget-btn:not(:disabled):active { background: color-mix(in srgb, var(--femo-text-4) 22%, transparent); }
.femo-forget-btn:disabled { cursor: not-allowed; opacity: 0.4; }
`;
var colStyle = {
  flexShrink: 0,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  fontSize: 10.5,
  color: "var(--femo-text-4)"
};
function FemoFileList({
  open = false,
  files = [],
  loading = false,
  error = "",
  /** 正在打开的那条路径（行内转圈 + 全表禁用防连点）。 */
  busyPath = null,
  onPick,
  /** 电脑端专属：给了才渲染右上角「浏览…」（走系统文件对话框的旧路径）。 */
  onBrowse,
  /** 从清单移除一条（2026-09-13）：给了才渲染每行右侧的 ⊖ 键。
   *  语义红线：只从清单划掉，**绝不动源文件**——文案与图标都按这个写。 */
  onForget,
  onClose
}) {
  (0, import_react16.useEffect)(() => {
    if (!open) return void 0;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const busy = busyPath !== null;
  const canBrowse = typeof onBrowse === "function";
  const canForget = typeof onForget === "function";
  const missingCount = files.filter((f) => f.exists === false).length;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "div",
    {
      onClick: onClose,
      style: {
        position: "fixed",
        inset: 0,
        background: "var(--femo-mask-blue)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        // 与 ActionModal 同级：盖住移动端布局（900）和运行守卫（1000）
        backdropFilter: "blur(2px)",
        padding: 16
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("style", { children: ROW_CSS }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
          "div",
          {
            onClick: (e) => e.stopPropagation(),
            style: {
              background: "var(--femo-surface)",
              borderRadius: "var(--femo-radius-xl)",
              width: 540,
              maxWidth: "100%",
              maxHeight: "86vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 32px 80px var(--femo-shadow-lg)",
              fontFamily: "var(--femo-font-sans)",
              overflow: "hidden"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "13px 16px",
                    borderBottom: "var(--femo-border-w) solid var(--femo-border)",
                    flexShrink: 0
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: { fontSize: 14, fontWeight: 800, color: "var(--femo-text-1)", letterSpacing: "0.01em" }, children: "\u6253\u5F00 FEMO \u5267\u672C" }),
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: { fontSize: 11, color: "var(--femo-text-4)", marginTop: 2 }, children: "\u4ECE\u5BFC\u5165\u8FC7 / \u5BFC\u51FA\u8FC7\u7684\u6587\u4EF6\u91CC\u6311\u4E00\u4E2A" })
                    ] }),
                    canBrowse && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                      "button",
                      {
                        onClick: onBrowse,
                        disabled: busy,
                        title: "\u6253\u5F00\u7CFB\u7EDF\u6587\u4EF6\u9009\u62E9\u5668\uFF08\u5728\u7535\u8111\u4E0A\u9009\u6587\u4EF6\uFF09",
                        style: {
                          padding: "6px 14px",
                          borderRadius: "var(--femo-radius-md)",
                          background: "var(--femo-surface)",
                          color: "var(--femo-text-2)",
                          border: "var(--femo-border-w-strong) solid var(--femo-border-strong)",
                          cursor: busy ? "wait" : "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "var(--femo-font-sans)",
                          opacity: busy ? 0.55 : 1,
                          flexShrink: 0
                        },
                        children: "\u6D4F\u89C8\u2026"
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                      "button",
                      {
                        onClick: onClose,
                        "aria-label": "\u5173\u95ED",
                        style: {
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--femo-text-4)",
                          fontSize: 20,
                          lineHeight: 1,
                          padding: "2px 4px",
                          flexShrink: 0
                        },
                        children: "\xD7"
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: { overflow: "auto", flex: 1, minHeight: 0 }, children: [
                loading && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: { padding: "28px 16px", textAlign: "center", fontSize: 12.5, color: "var(--femo-text-4)" }, children: "\u8BFB\u53D6\u6E05\u5355\u2026" }),
                !loading && error !== "" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                  "div",
                  {
                    style: {
                      padding: "10px 16px",
                      fontSize: 12,
                      color: "var(--femo-danger)",
                      lineHeight: 1.6,
                      background: "color-mix(in srgb, var(--femo-danger) 8%, transparent)",
                      borderBottom: "var(--femo-border-w) solid var(--femo-border)",
                      wordBreak: "break-all"
                    },
                    children: error
                  }
                ),
                !loading && error === "" && files.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: { padding: "30px 20px", textAlign: "center", fontSize: 12.5, color: "var(--femo-text-4)", lineHeight: 1.8 }, children: [
                  "\u8FD8\u6CA1\u6709\u8BB0\u5F55\u3002",
                  canBrowse ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
                    "\u70B9\u53F3\u4E0A\u89D2",
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("b", { style: { color: "var(--femo-text-2)" }, children: "\u300C\u6D4F\u89C8\u2026\u300D" }),
                    "\u9009\u4E00\u4E2A .femo \u6587\u4EF6\uFF0C\u4E4B\u540E\u5B83\u5C31\u4F1A\u7559\u5728\u8FD9\u4EFD\u6E05\u5355\u91CC\u3002"
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_jsx_runtime15.Fragment, { children: "\u5148\u5728\u7535\u8111\u7AEF\u5BFC\u5165\u6216\u5BFC\u51FA\u4E00\u6B21 .femo\uFF0C\u4E4B\u540E\u8FD9\u91CC\u5C31\u80FD\u76F4\u63A5\u9009\u4E86\u3002" })
                ] }),
                !loading && files.map((f, i) => {
                  const missing = f.exists === false;
                  const isBusy = busyPath === f.path;
                  const size = fmtSize(f.size);
                  return (
                    // 行本体现在只是布局层：可点的拆成两枚真按钮——「打开」（占满）
                    // 和「移出清单」（右侧定宽）。此前整行一枚 button，HTML 不允许
                    // 按钮嵌按钮，加移除键就必须拆。
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                      "div",
                      {
                        className: "femo-file-row",
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "9px 10px 9px 16px",
                          minHeight: 50,
                          // 触摸尺寸：手机上这一行要按得准
                          // 最后一行不画分隔线：贴着底栏那条会形成双线
                          borderBottom: i === files.length - 1 ? "none" : "var(--femo-border-w) solid var(--femo-border)"
                        },
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                            "button",
                            {
                              onClick: () => {
                                if (!missing && !busy) onPick?.(f.path);
                              },
                              disabled: missing || busy,
                              title: missing ? `${f.path}
\uFF08\u6587\u4EF6\u5DF2\u4E0D\u5728\u539F\u4F4D\u7F6E\uFF09` : f.path,
                              style: {
                                display: "block",
                                flex: 1,
                                minWidth: 0,
                                textAlign: "left",
                                padding: 0,
                                background: "none",
                                border: "none",
                                cursor: missing ? "not-allowed" : busy ? "wait" : "pointer",
                                opacity: missing ? 0.5 : 1,
                                fontFamily: "var(--femo-font-sans)"
                              },
                              children: [
                                /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 10 }, children: [
                                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                                    "span",
                                    {
                                      style: {
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "var(--femo-text-1)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        flex: 1,
                                        minWidth: 0
                                      },
                                      children: f.name
                                    }
                                  ),
                                  missing && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: { ...colStyle, color: "var(--femo-danger)", fontWeight: 700 }, children: "\u6587\u4EF6\u4E0D\u5728\u539F\u4F4D\u7F6E" }),
                                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: { ...colStyle, minWidth: 52 }, children: missing ? "\u2014" : size }),
                                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: { ...colStyle, minWidth: 62, color: "var(--femo-text-3)" }, children: isBusy ? "\u6253\u5F00\u4E2D\u2026" : relTime(f.lastUsedAt) })
                                ] }),
                                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                                  "div",
                                  {
                                    style: {
                                      fontSize: 10.5,
                                      color: "var(--femo-text-4)",
                                      marginTop: 3,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    },
                                    children: f.path
                                  }
                                )
                              ]
                            }
                          ),
                          canForget && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                            "button",
                            {
                              className: "femo-forget-btn",
                              onClick: () => {
                                if (!busy) onForget?.(f.path);
                              },
                              disabled: busy,
                              title: "\u4ECE\u6E05\u5355\u79FB\u9664\uFF08\u53EA\u5212\u6389\u8FD9\u6761\u8BB0\u5F55\uFF0C\u6587\u4EF6\u4FDD\u7559\u5728\u539F\u4F4D\u7F6E\uFF09",
                              "aria-label": `\u4ECE\u6E05\u5355\u79FB\u9664 ${f.name}`,
                              style: {
                                flexShrink: 0,
                                width: 30,
                                height: 30,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 0,
                                background: "none",
                                border: "none",
                                borderRadius: "var(--femo-radius-md)",
                                cursor: busy ? "wait" : "pointer"
                              },
                              children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(FaCircleMinus, { size: 15 })
                            }
                          )
                        ]
                      },
                      f.path
                    )
                  );
                })
              ] }),
              !loading && files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "div",
                {
                  style: {
                    padding: "7px 16px",
                    borderTop: "var(--femo-border-w) solid var(--femo-border)",
                    fontSize: 10.5,
                    color: "var(--femo-text-4)",
                    flexShrink: 0
                  },
                  children: [
                    "\u5171 ",
                    files.length,
                    " \u4E2A",
                    missingCount > 0 ? `\uFF08${missingCount} \u4E2A\u5DF2\u4E0D\u5728\u539F\u4F4D\u7F6E\uFF09` : ""
                  ]
                }
              )
            ]
          }
        )
      ]
    }
  );
}

// ../../femoGen/src/bubbleOverlay.jsx
var import_react17 = __toESM(require("react"), 1);
var import_jsx_runtime16 = require("react/jsx-runtime");
function parseDeclaredNames(raw) {
  if (!raw || typeof raw !== "string") return [];
  const names = [];
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const items = /[=(]/.test(line) ? [line] : line.split(",").map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const m = item.match(/^[\w$\u4e00-\u9fff.@]+/);
      if (m) names.push(m[0]);
    }
  }
  return names;
}
var VAR_VALUE_MAX = 1500;
function formatVarValue(v) {
  let s;
  if (v === null) s = "null";
  else if (v === void 0) s = "\u2014";
  else if (typeof v === "string") s = v;
  else {
    try {
      s = JSON.stringify(v, null, 2) ?? String(v);
    } catch {
      s = String(v);
    }
  }
  if (s === "") s = '""';
  return s.length > VAR_VALUE_MAX ? s.slice(0, VAR_VALUE_MAX) + " \u2026" : s;
}
function VarRows({ entries, names }) {
  const hasEntries = !!entries?.length;
  const hasNames = !!names?.length;
  if (!hasEntries && !hasNames) {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { fontSize: 11.5, color: "var(--femo-text-3)" }, children: "\uFF08\u65E0\uFF09" });
  }
  const rows = hasEntries ? entries.map(([k, v]) => ({ name: k, value: formatVarValue(v) })) : names.map((n) => ({ name: n, value: "\u2014" }));
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { children: rows.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
      "span",
      {
        style: {
          minWidth: 90,
          maxWidth: "40%",
          fontFamily: "var(--femo-font-mono)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--femo-text-2)",
          flexShrink: 0,
          wordBreak: "break-all"
        },
        children: [
          r.name,
          ":"
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      "span",
      {
        style: {
          fontFamily: "var(--femo-font-mono)",
          fontSize: 12,
          color: "var(--femo-text-1)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          flex: 1
        },
        children: r.value
      }
    )
  ] }, i)) });
}
function FuncAssignSection({ ns, action, accent }) {
  const insEntries = ns.ins ? Object.entries(ns.ins) : null;
  const outsEntries = ns.outs ? Object.entries(ns.outs) : null;
  const declaredIn = insEntries?.length ? null : parseDeclaredNames(action?.inMappings);
  const declaredOut = outsEntries?.length ? null : parseDeclaredNames(action?.outVars);
  const showReturnValue = !outsEntries?.length && typeof ns.output === "string" && ns.output.length > 0;
  const isRunning = ns.status === "running";
  const nothing = !insEntries?.length && !outsEntries?.length && !declaredIn.length && !declaredOut.length && !showReturnValue && !isRunning;
  if (nothing) return null;
  const labelChip = {
    display: "inline-block",
    background: accent + "18",
    color: accent,
    borderRadius: "var(--femo-radius-sm)",
    padding: "1px 10px",
    fontSize: 11,
    fontWeight: 800,
    fontFamily: "var(--femo-font-mono)",
    marginBottom: 6
  };
  const fallbackHintStyle = /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: { fontWeight: 400, fontSize: 10, marginLeft: 6, color: "var(--femo-text-3)" }, children: "\uFF08\u672A\u8FD0\u884C\uFF0C\u4EC5\u663E\u793A\u58F0\u660E\u540D\uFF09" });
  const inFallback = !insEntries?.length && declaredIn.length > 0;
  const outFallback = !outsEntries?.length && declaredOut.length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { marginBottom: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: labelChip, children: "in" }),
      inFallback && fallbackHintStyle,
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(VarRows, { entries: insEntries, names: declaredIn })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      "div",
      {
        style: {
          height: 1,
          background: "var(--femo-border)",
          margin: "10px 0 12px"
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: labelChip, children: "out" }),
      outFallback && fallbackHintStyle,
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(VarRows, { entries: outsEntries, names: declaredOut }),
      showReturnValue && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "div",
        {
          style: {
            fontFamily: "var(--femo-font-mono)",
            fontSize: 12,
            color: "var(--femo-text-1)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          },
          children: formatVarValue(ns.output)
        }
      )
    ] }),
    isRunning && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { marginTop: 8, fontSize: 11.5, color: "var(--femo-text-3)", fontWeight: 700 }, children: "\u23F3 \u8FD0\u884C\u4E2D\u2026" })
  ] });
}
function HumanInputSection({ nodeId, onSubmit, outVars, inputError }) {
  const [chatText, setChatText] = (0, import_react17.useState)("");
  const [dragOver, setDragOver] = (0, import_react17.useState)(false);
  const [varValues, setVarValues] = (0, import_react17.useState)({});
  const handleVarChange = (varName, value) => {
    setVarValues((prev) => ({ ...prev, [varName]: value }));
  };
  const handleSend = async () => {
    const hasChat = chatText.trim();
    const hasVars2 = Object.values(varValues).some((v) => v && v.trim());
    if (!hasChat && !hasVars2) return;
    const assignments = {};
    for (const [k, v] of Object.entries(varValues)) {
      if (v && v.trim()) {
        assignments[k] = v.trim();
      }
    }
    console.log("[HumanInputSection] handleSend:", { nodeId, chatText: chatText.trim(), assignments });
    const ok = await onSubmit(nodeId, chatText.trim(), assignments);
    if (ok !== false) {
      setChatText("");
      setVarValues({});
    }
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    let combined = chatText;
    let readCount = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target.result;
        if (combined.length > 0 && !combined.endsWith("\n")) combined += "\n";
        combined += `
====== ${file.name} ======
${content}
`;
        readCount++;
        if (readCount === files.length) {
          setChatText(combined);
        }
      };
      reader.onerror = () => {
        readCount++;
        if (readCount === files.length) {
          setChatText(combined);
        }
      };
      reader.readAsText(file);
    });
  };
  const vars = Array.isArray(outVars) ? outVars : [];
  const hasVars = vars.length > 0;
  const VAR_INPUT_WIDTH = 120;
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { marginTop: 8, flexShrink: 0 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      "div",
      {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: "var(--femo-warning)",
          marginBottom: 4
        },
        children: "\u23F3 \u7B49\u5F85\u4EBA\u7C7B\u8F93\u5165"
      }
    ),
    inputError && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
      "div",
      {
        style: {
          fontSize: 11,
          color: "var(--femo-danger-strong)",
          background: "var(--femo-danger-soft)",
          border: "var(--femo-border-w) solid var(--femo-danger-border)",
          borderRadius: "var(--femo-radius-sm)",
          padding: "6px 8px",
          marginBottom: 6,
          whiteSpace: "pre-wrap"
        },
        children: [
          "\u274C \u8F93\u5165\u88AB\u62D2\u7EDD\uFF1A",
          inputError
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      "div",
      {
        onDragOver: (e) => {
          e.preventDefault();
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: handleDrop,
        style: {
          border: dragOver ? "var(--femo-border-w-selected) dashed var(--femo-warning)" : "var(--femo-border-w-selected) solid transparent",
          borderRadius: "var(--femo-radius-md)",
          transition: "border 0.15s"
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
          "textarea",
          {
            "data-field": "chatText",
            value: chatText,
            onChange: (e) => setChatText(e.target.value),
            placeholder: "\u8F93\u5165\u56DE\u590D\uFF0C\u6216\u62D6\u62FD\u6587\u4EF6\u5230\u6B64\u5904...",
            rows: 4,
            style: {
              ...inp,
              resize: "vertical",
              width: "100%",
              boxSizing: "border-box"
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSend();
              }
            }
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          flexWrap: "wrap"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("button", { style: { ...btnP }, onClick: handleSend, children: "\u53D1\u9001" }),
          hasVars && vars.map((varName) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 4
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
                  "span",
                  {
                    style: {
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--femo-text-3)",
                      fontFamily: "var(--femo-font-mono)",
                      whiteSpace: "nowrap"
                    },
                    children: [
                      varName,
                      ":"
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                  "input",
                  {
                    "data-var": varName,
                    value: varValues[varName] || "",
                    onChange: (e) => handleVarChange(varName, e.target.value),
                    placeholder: "\u503C/+=1/add(@x)",
                    style: {
                      ...inp,
                      width: `${VAR_INPUT_WIDTH}px`,
                      fontSize: 12,
                      padding: "3px 6px",
                      flexShrink: 0
                    },
                    onKeyDown: (e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSend();
                      }
                    }
                  }
                )
              ]
            },
            varName
          ))
        ]
      }
    )
  ] });
}
function BubbleOverlay({ bubbleOverlay, nodes, nodeStates, humanWaits, actionStore, onClose, submitHumanInput }) {
  if (!bubbleOverlay) return null;
  const node = nodes.find((n) => n.id === bubbleOverlay.nodeId);
  if (!node || node.type !== "action") return null;
  const action = actionStore?.find((a) => a.id === node.actionId);
  const ns = nodeStates[node.id] || {};
  const hw = humanWaits?.[node.id] || null;
  const runType = ns.type || action?.executorType;
  const isAI = runType === "ai";
  const isHuman = runType === "human";
  const isFuncAssign = runType === "func" || runType === "assign";
  const isStreaming = ns.status === "ai_streaming";
  const c = ti(action?.executorType)?.c || "var(--femo-neutral)";
  const aiLive = ns.status === "ai_streaming" || ns.status === "ai_done";
  const showAI = hw ? aiLive : isAI;
  const scrollRef = (0, import_react17.useRef)(null);
  const userScrolledUpRef = (0, import_react17.useRef)(false);
  const handleScroll = (0, import_react17.useCallback)(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    userScrolledUpRef.current = !atBottom;
  }, []);
  (0, import_react17.useEffect)(() => {
    const el = scrollRef.current;
    if (!el || userScrolledUpRef.current || hw) return;
    el.scrollTop = el.scrollHeight;
  }, [ns.streamingText, ns.output, ns.context, hw]);
  (0, import_react17.useLayoutEffect)(() => {
    userScrolledUpRef.current = false;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [bubbleOverlay?.nodeId, hw]);
  const hwPromptLabel = hw?.showprompt ? "\u8865\u5145\u8BF4\u660E" : "\u63D0\u793A";
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      "div",
      {
        onClick: onClose,
        style: {
          position: "fixed",
          inset: 0,
          background: "var(--femo-mask-soft)",
          zIndex: 2999
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
      "div",
      {
        style: {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: Math.min(window.innerWidth * 0.6, 640),
          maxHeight: "80vh",
          background: "var(--femo-surface)",
          borderRadius: "var(--femo-radius-xl)",
          boxShadow: "0 24px 64px var(--femo-shadow-lg)",
          border: `var(--femo-border-w-selected) solid ${c}`,
          fontFamily: "var(--femo-font-sans)",
          zIndex: 3e3,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "var(--femo-border-w) solid var(--femo-border)",
                flexShrink: 0
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
                    "span",
                    {
                      style: {
                        background: c + "18",
                        color: c,
                        borderRadius: "var(--femo-radius-sm)",
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "var(--femo-font-mono)"
                      },
                      children: [
                        "@",
                        action?.executorType || "?"
                      ]
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: { fontWeight: 800, color: "var(--femo-text-1)", fontSize: 16 }, children: action?.name || "Node" }),
                  hw && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                    "span",
                    {
                      style: {
                        background: "var(--femo-warning-soft)",
                        color: "var(--femo-warning)",
                        borderRadius: "var(--femo-radius-sm)",
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700
                      },
                      children: "\u{1F4CC} \u7B49\u5F85\u4EBA\u7C7B\u8F93\u5165"
                    }
                  )
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      onClose();
                    },
                    style: {
                      background: "var(--femo-bg-2)",
                      border: "none",
                      fontSize: 16,
                      cursor: "pointer",
                      color: "var(--femo-text-2-alt)",
                      borderRadius: "var(--femo-radius-md)",
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.15s"
                    },
                    onMouseEnter: (e) => e.target.style.background = "var(--femo-bg-hover)",
                    onMouseLeave: (e) => e.target.style.background = "var(--femo-bg-2)",
                    children: "\u2715"
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
            "div",
            {
              ref: scrollRef,
              onScroll: handleScroll,
              style: {
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                lineHeight: 1.6,
                fontSize: 13,
                color: "var(--femo-text-1)"
              },
              children: hw ? /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
                hw.context && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap", marginBottom: 12 }, children: hw.context }),
                /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
                  "div",
                  {
                    style: {
                      marginBottom: 12,
                      background: "var(--femo-warning-soft)",
                      border: "var(--femo-border-w) solid var(--femo-warning)",
                      borderRadius: "var(--femo-radius-md)",
                      padding: "10px 12px"
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { fontWeight: 700, color: "var(--femo-warning)", marginBottom: 6, fontSize: 12 }, children: [
                        "\u23F3 \u7B49\u5F85\u4EBA\u7C7B\u8F93\u5165",
                        aiLive ? "\uFF08AI \u5E76\u884C\u8F93\u51FA\u5728\u4E0B\u65B9\uFF0C\u6B64\u5361\u5E38\u9A7B\uFF09" : ""
                      ] }),
                      hw.showprompt && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { marginBottom: hw.prompt ? 10 : 0 }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { fontWeight: 700, color: "var(--femo-warning-strong)", marginBottom: 4 }, children: "[\u8282\u70B9\u63D0\u793A]" }),
                        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: hw.showprompt })
                      ] }),
                      hw.prompt && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
                        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { fontWeight: 700, color: "var(--femo-warning-strong)", marginBottom: 4 }, children: [
                          "[",
                          hwPromptLabel,
                          "]"
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: hw.prompt })
                      ] })
                    ]
                  }
                ),
                showAI && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { fontWeight: 700, marginBottom: 4 }, children: [
                    "[",
                    ns.ai_name || "AI",
                    "]:"
                  ] }),
                  ns.status === "ai_streaming" ? /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { whiteSpace: "pre-wrap" }, children: [
                    ns.streamingText || "",
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "streaming-cursor", children: "|" })
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: ns.output || "\uFF08\u7B49\u5F85\u8F93\u51FA\uFF09" })
                ] })
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
                ns.context && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap", marginBottom: 12 }, children: ns.context }),
                ns.showprompt && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { marginBottom: 12, background: "var(--femo-bg)", padding: "8px 12px", borderRadius: "var(--femo-radius-md)" }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { fontWeight: 700, color: "var(--femo-text-3)", marginBottom: 4 }, children: "[\u8282\u70B9\u63D0\u793A]" }),
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: ns.showprompt })
                ] }),
                isHuman && ns.prompt && !ns.showprompt && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { marginBottom: 12, background: "var(--femo-bg)", padding: "8px 12px", borderRadius: "var(--femo-radius-md)" }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { fontWeight: 700, color: "var(--femo-text-3)", marginBottom: 4 }, children: "[\u63D0\u793A]" }),
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: ns.prompt })
                ] }),
                isHuman && ns.prompt && ns.showprompt && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { marginBottom: 12, background: "var(--femo-bg)", padding: "8px 12px", borderRadius: "var(--femo-radius-md)" }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { fontWeight: 700, color: "var(--femo-text-3)", marginBottom: 4 }, children: "[\u8865\u5145\u8BF4\u660E]" }),
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: ns.prompt })
                ] }),
                runType === "notice" && (ns.output || ns.prompt) && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { marginBottom: 12, background: "var(--femo-bg)", padding: "8px 12px", borderRadius: "var(--femo-radius-md)" }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { fontWeight: 700, color: "var(--femo-text-3)", marginBottom: 4 }, children: "[\u516C\u544A]" }),
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: ns.output || ns.prompt })
                ] }),
                isFuncAssign && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(FuncAssignSection, { ns, action, accent: c }),
                showAI && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { fontWeight: 700, marginBottom: 4 }, children: [
                    "[",
                    ns.ai_name || "AI",
                    "]:"
                  ] }),
                  isStreaming ? /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { whiteSpace: "pre-wrap" }, children: [
                    ns.streamingText || "",
                    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "streaming-cursor", children: "|" })
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: { whiteSpace: "pre-wrap" }, children: ns.output || "\uFF08\u7B49\u5F85\u8F93\u51FA\uFF09" })
                ] })
              ] })
            }
          ),
          (hw || isHuman && ns.status === "human_wait") && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
            "div",
            {
              style: {
                flexShrink: 0,
                padding: "12px 20px 20px",
                borderTop: "var(--femo-border-w) solid var(--femo-border)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
                HumanInputSection,
                {
                  nodeId: node.id,
                  onSubmit: submitHumanInput,
                  outVars: (hw || ns).outVars || [],
                  inputError: (hw || ns).inputError
                }
              )
            }
          )
        ]
      }
    )
  ] });
}

// ../../femoGen/src/debugPanel.jsx
var import_react18 = require("react");
var import_jsx_runtime17 = require("react/jsx-runtime");
var LEVEL_STYLE = {
  error: {
    dot: "var(--femo-danger)",
    soft: "var(--femo-danger-soft)",
    rowBg: "color-mix(in srgb, var(--femo-danger) 22%, transparent)"
  },
  warn: {
    dot: "var(--femo-warning-strong)",
    soft: "var(--femo-warning-soft)",
    rowBg: "color-mix(in srgb, var(--femo-warning-strong) 22%, transparent)"
  },
  info: { dot: "var(--femo-neutral)", soft: "transparent", rowBg: "transparent" }
};
var fmtTime = (ts) => {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
var HOST_LEVEL_RE = /^\[(log|info|warn|error)\]\s*/;
function DebugPanel({
  entries,
  onClose,
  onClear,
  onCompile,
  compiling = false,
  // 编译器页：引擎（编译器/运行时）打印的原始日志（stdout + [stderr] 前缀的 stderr）。
  compilerEntries = [],
  onClearCompiler,
  // FEMOGen 页：femoGen 页面自身产生的日志（femoLog.js 采集）。
  femogenEntries = [],
  onClearFemogen,
  // Host 页：投影窗、会话等宿主侧功能打印的日志（host-log.ts 采集，只收本插件）。
  hostEntries = [],
  onClearHost
}) {
  const [tab, setTab] = (0, import_react18.useState)("script");
  const errorCount = (0, import_react18.useMemo)(
    () => entries.filter((e) => e.level === "error").length,
    [entries]
  );
  const femogenErrorCount = (0, import_react18.useMemo)(
    () => femogenEntries.filter((e) => e.level === "error").length,
    [femogenEntries]
  );
  const hostErrorCount = (0, import_react18.useMemo)(
    () => hostEntries.filter((e) => /^\[error\]/.test(e.text || "")).length,
    [hostEntries]
  );
  const TABS = [
    {
      id: "script",
      label: "\u5267\u672C",
      list: entries,
      clear: onClear,
      errors: errorCount,
      title: "\u5267\u672C\u9875\uFF1A\u8FD0\u884C\u4E8B\u4EF6\u4E0E\u5E72\u8DD1\u6D41\u6C34",
      clearTitle: "\u6E05\u7A7A\u5267\u672C\u9875\u7684\u65E5\u5FD7"
    },
    {
      id: "compiler",
      label: "\u7F16\u8BD1\u5668",
      list: compilerEntries,
      clear: onClearCompiler,
      errors: 0,
      title: "\u7F16\u8BD1\u5668\u9875\uFF1A\u5F15\u64CE\uFF08\u7F16\u8BD1\u5668/\u8FD0\u884C\u65F6\uFF09\u6253\u5370\u7684\u539F\u59CB\u65E5\u5FD7\uFF0C\u542B\u6807\u51C6\u8F93\u51FA\u4E0E\u9519\u8BEF\u4FE1\u606F",
      clearTitle: "\u6E05\u7A7A\u7F16\u8BD1\u5668\u9875\u7684\u8F93\u51FA"
    },
    {
      id: "femogen",
      label: "FEMOGen",
      list: femogenEntries,
      clear: onClearFemogen,
      errors: femogenErrorCount,
      title: "FEMOGen \u9875\uFF1AfemoGen \u9875\u9762\u81EA\u8EAB\u4EA7\u751F\u7684\u65E5\u5FD7\uFF08log / warn / error\uFF09",
      clearTitle: "\u6E05\u7A7A FEMOGen \u9875\u7684\u524D\u7AEF\u65E5\u5FD7"
    },
    {
      id: "host",
      label: "Host",
      list: hostEntries,
      clear: onClearHost,
      errors: hostErrorCount,
      title: "Host \u9875\uFF1A\u6295\u5F71\u7A97\u3001\u4F1A\u8BDD\u7B49\u5BBF\u4E3B\u4FA7\u529F\u80FD\u6253\u5370\u7684\u65E5\u5FD7",
      clearTitle: "\u6E05\u7A7A Host \u9875\u7684\u5BBF\u4E3B\u65E5\u5FD7"
    }
  ];
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const isCompiler = active.id === "compiler";
  const isFemogen = active.id === "femogen";
  const isHost = active.id === "host";
  const activeList = active.list;
  const clearActive = active.clear;
  const canClear = typeof clearActive === "function";
  const [copied, setCopied] = (0, import_react18.useState)(false);
  const copyAll = (0, import_react18.useCallback)(() => {
    if (activeList.length === 0) return;
    const text = activeList.map(
      (e) => isCompiler || isHost ? `[${fmtTime(e.ts)}] ${e.text}` : isFemogen ? `[${fmtTime(e.ts)}] [${e.level}] ${e.text}` : `[${fmtTime(e.ts)}] [${e.level}] ${e.kind}: ${e.text}`
    ).join("\n");
    const flash = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    };
    const fallbackCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand("copy")) flash();
      } catch {
      }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }, [activeList, isCompiler]);
  const rowSt = {
    padding: "3px 6px",
    marginBottom: 4,
    borderRadius: "var(--femo-radius-sm)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontSize: 10,
    lineHeight: 1.6
  };
  const timeSt = {
    fontFamily: "var(--femo-font-mono)",
    fontSize: 9.5,
    color: "var(--femo-text-4-weak)",
    lineHeight: 1.6
  };
  const monoText = {
    fontSize: 10,
    lineHeight: 1.6,
    fontFamily: "var(--femo-font-mono)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere"
  };
  const compilerTextSt = { ...monoText, color: "var(--femo-text-2)" };
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "var(--femo-panel-bg)",
        borderRight: "var(--femo-border-w) solid var(--femo-border-strong)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
          "div",
          {
            style: {
              padding: "10px 12px",
              borderBottom: "var(--femo-border-w) solid var(--femo-border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                "span",
                {
                  style: {
                    fontSize: 11.5,
                    fontWeight: 800,
                    color: "var(--femo-text-1)",
                    letterSpacing: "0.02em"
                  },
                  children: "\u8C03\u8BD5"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { flex: 1 } }),
              typeof onCompile === "function" && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                "button",
                {
                  onClick: onCompile,
                  disabled: compiling,
                  title: compiling ? "\u7F16\u8BD1\u5E72\u8DD1\u8FDB\u884C\u4E2D\u2026" : "\u96F6 token \u7F16\u8BD1\u5E72\u8DD1\uFF1AAI/\u4EBA\u7C7B\u8282\u70B9\u7531\u8C03\u8BD5\u5668\u66FF\u7B54\uFF0C\u65E5\u5FD7\u5B9E\u65F6\u663E\u793A\u5728\u4E0B\u65B9",
                  style: {
                    padding: "3px 10px",
                    borderRadius: "var(--femo-radius-md)",
                    border: "var(--femo-border-w) solid var(--femo-btn-primary)",
                    background: "var(--femo-btn-primary)",
                    color: "var(--femo-on-accent)",
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "var(--femo-font-sans)",
                    cursor: compiling ? "wait" : "pointer",
                    opacity: compiling ? 0.6 : 1
                  },
                  children: compiling ? "\u7F16\u8BD1\u4E2D" : "\u7F16\u8BD1"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                "button",
                {
                  onClick: copyAll,
                  disabled: activeList.length === 0,
                  title: activeList.length === 0 ? "\u5F53\u524D\u9875\u6682\u65E0\u53EF\u590D\u5236\u7684\u65E5\u5FD7" : isCompiler ? "\u590D\u5236\u5F53\u524D\u9875\uFF08\u7F16\u8BD1\u5668\uFF09\u5168\u90E8\u8F93\u51FA" : "\u590D\u5236\u5F53\u524D\u9875\uFF08\u5267\u672C\uFF09\u5168\u90E8\u65E5\u5FD7\uFF08\u65F6\u95F4 / \u7EA7\u522B / \u6765\u6E90 / \u5168\u6587\uFF09",
                  style: {
                    padding: "3px 8px",
                    borderRadius: "var(--femo-radius-md)",
                    border: "var(--femo-border-w) solid var(--femo-border-strong)",
                    background: "var(--femo-bg)",
                    color: copied ? "var(--femo-success-strong)" : "var(--femo-text-2)",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: activeList.length === 0 ? "default" : "pointer",
                    fontFamily: "var(--femo-font-sans)",
                    opacity: activeList.length === 0 ? 0.5 : 1
                  },
                  children: copied ? "\u5DF2\u590D\u5236" : "\u590D\u5236"
                }
              ),
              canClear && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                "button",
                {
                  onClick: clearActive,
                  disabled: activeList.length === 0,
                  title: activeList.length === 0 ? "\u5F53\u524D\u9875\u6682\u65E0\u65E5\u5FD7\u53EF\u6E05\u7A7A" : active.clearTitle,
                  style: {
                    padding: "3px 8px",
                    borderRadius: "var(--femo-radius-md)",
                    border: "var(--femo-border-w) solid var(--femo-border-strong)",
                    background: "var(--femo-bg)",
                    color: "var(--femo-text-2)",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: activeList.length === 0 ? "default" : "pointer",
                    fontFamily: "var(--femo-font-sans)",
                    opacity: activeList.length === 0 ? 0.5 : 1
                  },
                  children: "\u6E05\u7A7A"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                "button",
                {
                  onClick: onClose,
                  title: "\u5173\u95ED\u8C03\u8BD5\u7A97\u53E3",
                  style: {
                    width: 22,
                    height: 22,
                    borderRadius: "var(--femo-radius-md)",
                    border: "var(--femo-border-w) solid var(--femo-border-strong)",
                    background: "var(--femo-bg)",
                    color: "var(--femo-text-2)",
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  },
                  children: "\u2715"
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              borderBottom: "var(--femo-border-w) solid var(--femo-border)",
              flexShrink: 0,
              overflowX: "auto",
              WebkitOverflowScrolling: "touch"
            },
            children: TABS.map((t) => {
              const on = tab === t.id;
              return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
                "button",
                {
                  onClick: () => setTab(t.id),
                  title: t.title,
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 9px",
                    borderRadius: "var(--femo-radius-md)",
                    border: `var(--femo-border-w) solid ${on ? "var(--femo-border-strong)" : "transparent"}`,
                    background: on ? "var(--femo-bg)" : "transparent",
                    color: on ? "var(--femo-text-1)" : "var(--femo-text-3)",
                    fontSize: 10.5,
                    fontWeight: on ? 800 : 600,
                    fontFamily: "var(--femo-font-sans)",
                    cursor: "pointer"
                  },
                  children: [
                    t.label,
                    t.errors > 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { title: `${t.errors} \u6761\u9519\u8BEF`, style: { fontSize: 9, fontWeight: 800, color: "var(--femo-danger)" }, children: [
                      t.errors,
                      " \u9519"
                    ] }) : t.list.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { fontSize: 9, fontWeight: 800, color: "var(--femo-text-4-weak)" }, children: t.list.length }) : null
                  ]
                },
                t.id
              );
            })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
          "div",
          {
            style: {
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
              padding: "8px 10px",
              userSelect: "text",
              WebkitUserSelect: "text"
            },
            children: isCompiler ? compilerEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
              "div",
              {
                style: {
                  fontSize: 10.5,
                  color: "var(--femo-text-4-weak)",
                  lineHeight: 1.8,
                  padding: "8px 2px"
                },
                children: [
                  "\u6682\u65E0\u7F16\u8BD1\u5668\u8F93\u51FA\u3002",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u8FD9\u91CC\u663E\u793A\u5F15\u64CE\uFF08\u7F16\u8BD1\u5668/\u8FD0\u884C\u65F6\uFF09\u6253\u5370\u7684\u539F\u59CB\u65E5\u5FD7\uFF1A",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u8FD0\u884C\u6216\u5E72\u8DD1\u5267\u672C\u65F6\uFF0C\u6807\u51C6\u8F93\u51FA\u548C\u9519\u8BEF\u4FE1\u606F\uFF08\u5E26 [stderr] \u524D\u7F00\uFF09\u90FD\u4F1A\u5B9E\u65F6\u51FA\u73B0\u5728\u8FD9\u91CC\u3002"
                ]
              }
            ) : compilerEntries.map((e) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: rowSt, children: [
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: timeSt, children: fmtTime(e.ts) }),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { style: compilerTextSt, children: [
                " ",
                e.text
              ] })
            ] }, e.id)) : isFemogen ? femogenEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
              "div",
              {
                style: {
                  fontSize: 10.5,
                  color: "var(--femo-text-4-weak)",
                  lineHeight: 1.8,
                  padding: "8px 2px"
                },
                children: [
                  "\u6682\u65E0\u524D\u7AEF\u65E5\u5FD7\u3002",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u8FD9\u91CC\u663E\u793A femoGen \u9875\u9762\u81EA\u8EAB\u4EA7\u751F\u7684\u65E5\u5FD7\uFF08log / warn / error\uFF09\uFF0C",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u9875\u9762\u8FD0\u884C\u4E2D\u968F\u65F6\u4EA7\u751F\u3001\u968F\u65F6\u51FA\u73B0\u5728\u8FD9\u91CC\u3002"
                ]
              }
            ) : femogenEntries.map((e) => {
              const st = LEVEL_STYLE[e.level] || LEVEL_STYLE.info;
              const kindSt = { ...timeSt, fontWeight: 700, color: st.dot };
              return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { ...rowSt, background: st.rowBg }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: timeSt, children: fmtTime(e.ts) }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { style: kindSt, children: [
                  " [",
                  e.level,
                  "]"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { style: compilerTextSt, children: [
                  " ",
                  e.text
                ] })
              ] }, e.id);
            }) : isHost ? hostEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
              "div",
              {
                style: {
                  fontSize: 10.5,
                  color: "var(--femo-text-4-weak)",
                  lineHeight: 1.8,
                  padding: "8px 2px"
                },
                children: [
                  "\u6682\u65E0\u5BBF\u4E3B\u65E5\u5FD7\u3002",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u8FD9\u91CC\u663E\u793A\u6295\u5F71\u7A97\u3001\u4F1A\u8BDD\u7B49\u5BBF\u4E3B\u4FA7\u529F\u80FD\u6253\u5370\u7684\u65E5\u5FD7\u3002",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u5F15\u64CE\u6253\u5370\u7684\u65E5\u5FD7\u4E0D\u5728\u8FD9\u9875\uFF0C\u8BF7\u770B\u300C\u7F16\u8BD1\u5668\u300D\u9875\u3002"
                ]
              }
            ) : hostEntries.map((e) => {
              const m = HOST_LEVEL_RE.exec(e.text || "");
              const lv = m ? m[1] : "log";
              const body = m ? e.text.slice(m[0].length) : e.text;
              const st = LEVEL_STYLE[lv] || LEVEL_STYLE.info;
              const kindSt = { ...timeSt, fontWeight: 700, color: st.dot };
              return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { ...rowSt, background: st.rowBg }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: timeSt, children: fmtTime(e.ts) }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { style: kindSt, children: [
                  " [",
                  lv,
                  "]"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { style: compilerTextSt, children: [
                  " ",
                  body
                ] })
              ] }, e.id);
            }) : entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
              "div",
              {
                style: {
                  fontSize: 10.5,
                  color: "var(--femo-text-4-weak)",
                  lineHeight: 1.8,
                  padding: "8px 2px"
                },
                children: [
                  "\u6682\u65E0\u8FD0\u884C\u8BB0\u5F55\u3002",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u70B9\u4E0A\u65B9\u300C\u7F16\u8BD1\u300D\u53EF\u96F6 token \u5E72\u8DD1\u5267\u672C\uFF08AI/\u4EBA\u7C7B\u7531\u8C03\u8BD5\u5668\u66FF\u7B54\uFF09\uFF1B",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u6B63\u5F0F\u8FD0\u884C\u540E\uFF0C\u540E\u7AEF\u7684\u5B9E\u65F6\u4E8B\u4EF6\u4E0E\u62A5\u9519\u4E5F\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u5267\u672C / \u7F16\u8BD1\u5668 / FEMOGen / Host \u56DB\u4E2A\u6807\u7B7E\u9875\u5404\u6709\u72EC\u7ACB\u7684\u65E5\u5FD7\uFF0C",
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                  "\u590D\u5236\u548C\u6E05\u7A7A\u6309\u94AE\u53EA\u4F5C\u7528\u4E8E\u5F53\u524D\u6240\u5728\u7684\u6807\u7B7E\u9875\u3002"
                ]
              }
            ) : entries.map((e) => {
              const st = LEVEL_STYLE[e.level] || LEVEL_STYLE.info;
              const text = e.text || "";
              const kindSt = { ...timeSt, fontWeight: 700, color: st.dot };
              const textStyle = {
                ...monoText,
                color: e.level === "error" ? "var(--femo-text-1)" : "var(--femo-text-2)"
              };
              return (
                // 行底色（2026-09-11）：warn 黄 / error 红（见 LEVEL_STYLE.rowBg）；
                // info 无底色。内边距统一给到所有行，保证时间/正文左缘齐平。
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { ...rowSt, background: st.rowBg }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: timeSt, children: fmtTime(e.ts) }),
                  /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { style: kindSt, children: [
                    " [",
                    e.kind,
                    "]"
                  ] }),
                  text ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("span", { style: textStyle, children: [
                    " ",
                    text
                  ] }) : null
                ] }, e.id)
              );
            })
          }
        )
      ]
    }
  );
}

// ../../femoGen/src/femoLog.js
var CAP = 400;
var TEXT_MAX = 500;
var ring = [];
var listeners2 = /* @__PURE__ */ new Set();
var seq = 0;
var installed = false;
var pending = [];
var flushScheduled = false;
function fmtArg(a) {
  if (typeof a === "string") return a;
  if (a instanceof Error) {
    const at = (a.stack || "").split("\n")[1];
    return at ? `${a.message} @ ${at.trim()}` : a.message;
  }
  if (typeof a === "undefined") return "undefined";
  if (a === null) return "null";
  try {
    const s = JSON.stringify(a);
    return s === void 0 ? String(a) : s;
  } catch {
    return String(a);
  }
}
function pushFemoLog(level, args) {
  const entry = {
    id: ++seq,
    ts: Date.now(),
    level,
    text: args.map(fmtArg).join(" ").slice(0, TEXT_MAX)
  };
  ring.push(entry);
  if (ring.length > CAP) ring.shift();
  pending.push(entry);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      const batch = pending;
      pending = [];
      for (const fn of listeners2) {
        try {
          fn(batch);
        } catch {
        }
      }
    });
  }
  return entry;
}
function subscribeFemoLog(fn) {
  listeners2.add(fn);
  return () => {
    listeners2.delete(fn);
  };
}
function femoLogTail(n = CAP) {
  const count = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), CAP) : CAP;
  return ring.slice(-count);
}
function clearFemoLog() {
  ring.length = 0;
}
function installFemoLogCapture() {
  if (installed) return;
  installed = true;
  const LEVELS = { log: "log", info: "info", warn: "warn", error: "error" };
  for (const name of Object.keys(LEVELS)) {
    const orig = console[name];
    if (typeof orig !== "function") continue;
    console[name] = (...args) => {
      try {
        pushFemoLog(LEVELS[name], args);
      } catch {
      }
      orig.apply(console, args);
    };
  }
}

// ../../femoGen/src/femoPreview.jsx
var import_react19 = __toESM(require("react"), 1);
var import_jsx_runtime18 = require("react/jsx-runtime");
var PRIMARY = "var(--femo-primary)";
var chip = (color, active = false) => ({
  padding: "3px 10px",
  borderRadius: "var(--femo-radius-md)",
  background: `color-mix(in srgb, ${color} ${active ? 16 : 10}%, transparent)`,
  border: `1px solid color-mix(in srgb, ${color} ${active ? 45 : 35}%, transparent)`,
  color,
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "var(--femo-font-sans)",
  transition: "background 0.15s, color 0.15s, border-color 0.15s"
});
function FemoPreview({ value, onChange, error, warnings = [], dirty, onApply, onRestore, onGraphToFemo }) {
  const lineNumbersRef = (0, import_react19.useRef)(null);
  const textareaRef = (0, import_react19.useRef)(null);
  const highlightRef = (0, import_react19.useRef)(null);
  const [lineCount, setLineCount] = (0, import_react19.useState)(1);
  const [copied, setCopied] = (0, import_react19.useState)(false);
  const copyTimerRef = (0, import_react19.useRef)(null);
  const [g2tFlash, setG2tFlash] = (0, import_react19.useState)(false);
  const g2tTimerRef = (0, import_react19.useRef)(null);
  const [applyFlash, setApplyFlash] = (0, import_react19.useState)(false);
  const applyTimerRef = (0, import_react19.useRef)(null);
  (0, import_react19.useEffect)(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    if (g2tTimerRef.current) clearTimeout(g2tTimerRef.current);
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
  }, []);
  const flash = (setter, timerRef, ms = 1600) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setter(true);
    timerRef.current = setTimeout(() => setter(false), ms);
  };
  const handleCopy = (0, import_react19.useCallback)(async () => {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value || "");
        ok = true;
      } else {
        const ta = document.createElement("textarea");
        ta.value = value || "";
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch {
      ok = false;
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopied(ok);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1600);
  }, [value]);
  const errorLine = (0, import_react19.useMemo)(() => {
    if (!error) return null;
    const diag = (Array.isArray(error?.diagnostics) ? error.diagnostics : []).find((d) => d?.severity === "error" && d.line != null);
    if (diag) return diag.line;
    const match = error.match(/第\s*(\d+)\s*行/);
    return match ? parseInt(match[1], 10) : null;
  }, [error]);
  (0, import_react19.useEffect)(() => {
    setLineCount(value.split("\n").length);
  }, [value]);
  const handleScroll = (0, import_react19.useCallback)(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
    if (highlightRef.current && textareaRef.current && errorLine != null) {
      const scrollTop = textareaRef.current.scrollTop;
      const lineHeight = 18.9;
      highlightRef.current.style.top = 11 + (errorLine - 1) * lineHeight - scrollTop + "px";
    }
  }, [errorLine]);
  (0, import_react19.useEffect)(() => {
    if (textareaRef.current && highlightRef.current && errorLine != null) {
      const scrollTop = textareaRef.current.scrollTop;
      const lineHeight = 18.9;
      highlightRef.current.style.top = 11 + (errorLine - 1) * lineHeight - scrollTop + "px";
    }
  }, [errorLine, value]);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
    "div",
    {
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: "14px 14px 14px"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 9
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                "span",
                {
                  style: {
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: "var(--femo-neutral)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em"
                  },
                  children: "FEMO \u9884\u89C8"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
                error && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("button", { onClick: onRestore, style: chip("var(--femo-warning)", true), children: "\u6062\u590D" }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                  "button",
                  {
                    onClick: handleCopy,
                    title: "\u590D\u5236\u5168\u6587\u5230\u526A\u8D34\u677F",
                    style: chip(copied ? "var(--femo-success)" : PRIMARY, copied),
                    children: copied ? "\u2713 \u5DF2\u590D\u5236" : "\u590D\u5236"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                  "button",
                  {
                    onClick: () => {
                      onGraphToFemo?.();
                      flash(setG2tFlash, g2tTimerRef);
                    },
                    style: chip(g2tFlash ? "var(--femo-success)" : PRIMARY, g2tFlash),
                    children: g2tFlash ? "\u2713 \u5DF2\u751F\u6210" : "\u56FE\u5230\u6587\u672C"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                  "button",
                  {
                    onClick: () => {
                      onApply?.();
                      flash(setApplyFlash, applyTimerRef);
                    },
                    style: chip(
                      applyFlash ? error ? "var(--femo-danger)" : "var(--femo-success)" : PRIMARY,
                      applyFlash || dirty
                    ),
                    children: applyFlash ? error ? "\u2715 \u5931\u8D25" : "\u2713 \u5DF2\u5E94\u7528" : "\u6587\u672C\u5230\u56FE"
                  }
                )
              ] })
            ]
          }
        ),
        error && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          "div",
          {
            style: {
              marginBottom: 8,
              padding: "6px 9px",
              background: "var(--femo-danger-soft)",
              border: "var(--femo-border-w) solid var(--femo-danger-border)",
              borderRadius: "var(--femo-radius-sm)",
              fontSize: 10,
              color: "var(--femo-danger)",
              lineHeight: 1.5,
              maxHeight: 60,
              overflow: "auto"
            },
            children: error
          }
        ),
        Array.isArray(warnings) && warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          "div",
          {
            style: {
              marginBottom: 8,
              padding: "6px 9px",
              background: "var(--femo-warning-soft)",
              border: "var(--femo-border-w) solid var(--femo-warning-border)",
              borderRadius: "var(--femo-radius-sm)",
              fontSize: 10,
              color: "var(--femo-warning-strong)",
              lineHeight: 1.5,
              maxHeight: 60,
              overflow: "auto",
              whiteSpace: "pre-wrap"
            },
            children: warnings.map((w, i) => {
              const loc = w?.line != null ? `\u7B2C ${w.line} \u884C: ` : "";
              return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
                "\u26A0 ",
                loc,
                w?.message || ""
              ] }, i);
            })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { style: { display: "flex", flex: 1, minHeight: 0, borderRadius: "var(--femo-radius-lg)", overflow: "hidden" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
            "div",
            {
              ref: lineNumbersRef,
              style: {
                // 行号区整体缩为原 75%（30 → 22.5），左侧空间同步收紧
                width: 22.5,
                background: "var(--femo-preview-bg-2)",
                color: "var(--femo-mobile-text-3)",
                fontFamily: "var(--femo-font-mono)",
                fontSize: 10.5,
                lineHeight: 1.8,
                padding: "11px 3px 11px 6px",
                textAlign: "right",
                userSelect: "none",
                overflow: "hidden",
                whiteSpace: "pre",
                borderRight: "var(--femo-border-w) solid var(--femo-preview-border)"
              },
              children: Array.from({ length: lineCount }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { children: i + 1 }, i + 1))
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { style: { position: "relative", flex: 1 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
              "textarea",
              {
                ref: textareaRef,
                value,
                onChange: (e) => {
                  onChange(e.target.value);
                },
                onScroll: handleScroll,
                spellCheck: false,
                style: {
                  width: "100%",
                  height: "100%",
                  background: "var(--femo-mobile-bg-2)",
                  // 左 padding 归零：顶格代码紧贴行号区边缘
                  padding: "11px 0",
                  overflow: "auto",
                  resize: "none",
                  fontFamily: "var(--femo-font-mono)",
                  fontSize: 10.5,
                  lineHeight: 1.8,
                  color: "var(--femo-mobile-text-2-alt)",
                  border: "none",
                  outline: "none",
                  whiteSpace: "pre",
                  display: "block"
                  // 确保覆盖层可以正确定位
                }
              }
            ),
            errorLine != null && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
              "div",
              {
                ref: highlightRef,
                style: {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 18.9,
                  background: "var(--femo-danger-soft-2)",
                  borderLeft: "var(--femo-border-w-accent) solid var(--femo-danger)",
                  pointerEvents: "none",
                  zIndex: 1
                }
              }
            )
          ] })
        ] })
      ]
    }
  );
}

// ../../femoGen/src/mobileView.jsx
var import_react20 = __toESM(require("react"), 1);
var import_jsx_runtime19 = require("react/jsx-runtime");
var T = {
  bg: "var(--femo-mobile-bg)",
  surface: "var(--femo-mobile-surface)",
  surfaceHover: "var(--femo-mobile-surface-hover)",
  border: "var(--femo-mobile-border)",
  borderLight: "var(--femo-mobile-border-light)",
  accent: "var(--femo-primary)",
  accentGlow: "var(--femo-primary-glow)",
  textPrimary: "var(--femo-mobile-text-1)",
  textSecondary: "var(--femo-text-3)",
  textMuted: "var(--femo-mobile-text-3)",
  tabActive: "var(--femo-primary)",
  tabInactive: "var(--femo-mobile-border)",
  danger: "var(--femo-danger)",
  success: "var(--femo-success)",
  warning: "var(--femo-warning)"
};
var MobileGlobalStyle = () => /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("style", { children: `
    /* round44\uFF1A\u5168\u5C40 touch-action:none \u662F\u4ED3\u5E93\u5361\u7247\u65E0\u6CD5\u6EDA\u52A8\u7684\u5143\u51F6\u2014\u2014
       Chrome \u4ECE\u89E6\u70B9\u5411\u4E0A\u7D2F\u79EF touch-action\uFF0Cbody \u7684 none \u6C61\u67D3\u6574\u6761\u94FE\u3002
       \u753B\u5E03\u533A\u81EA\u6709\u72EC\u7ACB\u89C4\u5219\uFF08.femo-canvas-zone\uFF09\uFF0C\u6B64\u5904\u4E0D\u518D\u5168\u5C40\u7981\u89E6\u3002 */
    html, body {
      overscroll-behavior: none;
    }
    /* round50\uFF1A\u9632\u62D6\u62FD\u8BEF\u9009\u53EA\u4F5C\u7528\u4E8E femo \u81EA\u5DF1\u7684\u5BB9\u5668\uFF0C\u4E0D\u518D\u6302 html/body\u2014\u2014
       user-select \u6CBF\u6811\u7EE7\u627F\uFF0C\u5168\u5C40 none \u4F1A\u628A dsh \u804A\u5929\u6B63\u6587\u7684\u9009\u62E9\u4E00\u8D77\u6740\u6389
       \uFF082026-08-28 \u732B\u732B\u62A5 3081 \u624B\u673A\u7AEF\u65E0\u6CD5\u9009\u4E2D AI/\u7528\u6237\u6D88\u606F\u6587\u5B57\u7684\u6839\u56E0\uFF09\u3002
       \u753B\u5E03\u533A\u62D6\u8282\u70B9/\u8FDE\u7EBF\u7684\u624B\u52BF\u4FDD\u62A4\u4FDD\u7559\u5728\u81EA\u8EAB\u5BB9\u5668\u4E0A\u3002 */
    .femo-canvas-zone,
    .femo-bottom-scroll {
      user-select: none;
      -webkit-user-select: none;
    }
    /* \u753B\u5E03\u533A\u7981\u6B62\u6D4F\u89C8\u5668\u9ED8\u8BA4\u89E6\u6478\u884C\u4E3A\uFF08\u62D6\u8282\u70B9/\u8FDE\u7EBF/\u5E73\u79FB\u5168\u8D70\u81EA\u5B9A\u4E49\u624B\u52BF\uFF09\u3002
       round55\uFF1A-webkit-touch-callout \u6390\u6389 iOS \u957F\u6309\u547C\u51FA\u7684\u653E\u5927\u955C/\u83DC\u5355\u3002
       Android \u957F\u6309\u9009\u5B57\u7531 useMobileCanvasGesture \u91CC\u7684 non-passive
       preventDefault \u5728\u624B\u52BF\u5C42\u6839\u6CBB\u2014\u2014React 17+ \u7684\u5408\u6210 touchstart/touchmove
       \u4E00\u5F8B passive \u6302\u8F7D\uFF0C\u7EC4\u4EF6\u91CC e.preventDefault() \u662F\u65E0\u6548\u8C03\u7528\uFF1B
       CSS user-select:none\uFF08round50\uFF09\u53EA\u80FD\u5B9A\u4E49"\u8C01\u4E0D\u53EF\u9009"\uFF0C\u62E6\u4E0D\u4F4F
       \u6D4F\u89C8\u5668\u539F\u751F\u957F\u6309\u9009\u62E9\u6D41\u7A0B\u672C\u8EAB\uFF0C\u53EA\u6709\u53D6\u6D88 touchstart \u9ED8\u8BA4\u884C\u4E3A\u8FD9\u4E00\u6761\u8DEF\u3002 */
    .femo-canvas-zone {
      touch-action: none;
      -webkit-touch-callout: none;
    }
    /* \u5E95\u90E8\u9762\u677F\u5141\u8BB8\u5782\u76F4\u6EDA\u52A8 */
    .femo-bottom-scroll {
      touch-action: pan-y;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    /* \u8F93\u5165\u6846\u6062\u590D touch */
    .femo-bottom-scroll input,
    .femo-bottom-scroll textarea,
    .femo-bottom-scroll select {
      touch-action: auto;
      user-select: text;
      -webkit-user-select: text;
    }
    /* \u4FA7\u8FB9\u83DC\u5355\u906E\u7F69\u6DE1\u5165 */
    @keyframes fadeInOverlay {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    /* \u4FA7\u8FB9\u83DC\u5355\u6ED1\u5165 */
    @keyframes slideInMenu {
      from { transform: translateX(-100%); }
      to   { transform: translateX(0); }
    }
    /* FEMO \u9762\u677F\u6ED1\u5165 */
    @keyframes slideInFemo {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }
    /* \u5E95\u90E8\u9762\u677F\u5207\u6362\u6DE1\u5165 */
    @keyframes fadePanel {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    /* \u6C14\u6CE1\u5F39\u51FA */
    @keyframes popIn {
      from { opacity: 0; transform: translate(-50%, -46%) scale(0.92); }
      to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    /* \u6807\u9898\u680F\u95EA\u5149\u626B\u63CF */
    @keyframes scanLine {
      0%   { left: -60%; }
      100% { left: 110%; }
    }
    /* \u72B6\u6001\u6307\u793A\u706F\u8109\u51B2 */
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.6; transform: scale(0.85); }
    }
    /* round27\uFF1A\u4ED3\u5E93\u62D6\u62FD ghost \u5F39\u51FA\uFF08\u5F39\u6027\u653E\u5927+\u6DE1\u5165\uFF0C\u53EA\u52A8 opacity/transform\uFF09 */
    @keyframes ghostPopIn {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1.05); }
    }
    /* round27\uFF1Aghost \u5149\u6655\u547C\u5438\uFF08\u53EA\u52A8 box-shadow\uFF0C\u4E0E popIn \u5C5E\u6027\u4E0D\u76F8\u4EA4\u53EF\u540C\u5217\uFF09 */
    @keyframes ghostBreath {
      from { box-shadow: 0 4px 16px var(--femo-primary-glow); }
      to   { box-shadow: 0 6px 26px var(--femo-primary-glow-x); }
    }
    /* round27\uFF1A\u753B\u5E03"\u53EF\u653E\u7F6E"\u63D0\u793A\u6D6E\u73B0 */
    @keyframes dropHintIn {
      from { opacity: 0; transform: scale(0.985); }
      to   { opacity: 1; transform: scale(1); }
    }
    /* \u6D41\u5F0F\u5149\u6807 */
    .mob-cursor { animation: blink 0.75s step-end infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    /* \u8FD0\u884C\u63A7\u5236\u56FE\u6807\u6309\u94AE\uFF082026-09-06 \u7EDF\u4E00\u91CD\u9020\uFF09\uFF1A\u624B\u673A\u65E0 hover\uFF0C\u53CD\u9988\u8D70\u6309\u538B
       \u56DE\u7F29 + \u63D0\u4EAE\uFF1B\u987A\u624B\u6390\u6389\u79FB\u52A8\u7AEF\u70B9\u6309\u7070\u95EA\uFF08tap-highlight\uFF09\u3002 */
    .femo-mob-icon-btn {
      transition: transform 0.12s ease, filter 0.12s ease;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .femo-mob-icon-btn:active {
      transform: scale(0.88);
      filter: brightness(1.3);
    }
    /* \u8BBE\u7F6E\u9762\u677F\u4E09\u952E\uFF082026-09-08\uFF09\uFF1A\u540C\u6B3E\u6309\u538B\u53CD\u9988\u8BED\u8A00\uFF08\u56DE\u7F29+\u63D0\u4EAE\uFF09\uFF0C\u5BBD\u5E45\u6587\u5B57\u6309\u94AE
       \u5E45\u5EA6\u6BD4 32px \u56FE\u6807\u82AF\u7247\u6E29\u548C\uFF1B\u540C\u6837\u6390\u79FB\u52A8\u7AEF\u70B9\u6309\u7070\u95EA\u3002 */
    .femo-mob-setting-btn {
      transition: transform 0.12s ease, filter 0.12s ease;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .femo-mob-setting-btn:active {
      transform: scale(0.97);
      filter: brightness(1.15);
    }
  ` });
function MobileTitleBar({
  projName,
  flowStatus,
  femoVisible,
  onBack,
  onExpand,
  onToggleFemo,
  onRun,
  onPause,
  onResume,
  hasActiveRunningNodes,
  // 文件读写（2026-09-11 手机端补齐）：与桌面工具栏「导入 .femo / 导出 .femo」
  // 同源回调（插件=host 系统对话框 / 独立=浏览器 file input + 下载）。
  onImport,
  onExport,
  exportBusy,
  // Module 子画布层级（2026-09-06）：非主流程时显示「‹ 模块名」返回键。
  locationPath,
  onNavigatePath
}) {
  const statusDot = {
    idle: { c: T.textMuted, label: "" },
    running: { c: T.success, label: "\u8FD0\u884C\u4E2D" },
    paused: { c: T.warning, label: "\u5DF2\u6302\u8D77\uFF0C\u53EF\u7EED\u8DD1" }
  }[flowStatus] || { c: T.textMuted, label: "" };
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
    "div",
    {
      style: {
        position: "relative",
        height: "5vh",
        minHeight: 40,
        maxHeight: 56,
        background: T.surface,
        borderBottom: `var(--femo-border-w) solid ${T.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        flexShrink: 0,
        zIndex: 100,
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: 0,
              width: "60%",
              height: "100%",
              background: "linear-gradient(90deg,transparent,var(--femo-primary-glow-weak),transparent)",
              pointerEvents: "none",
              animation: "scanLine 4s linear infinite"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }, children: onExpand ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "button",
          {
            onClick: onExpand,
            "aria-label": "\u5168\u5C4F\u6C89\u6D78",
            style: {
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 10px 6px 2px",
              display: "flex",
              alignItems: "center",
              color: T.textSecondary,
              lineHeight: 1,
              flexShrink: 0
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(FaSquareOutline, { size: 19 })
          }
        ) : onBack ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "button",
          {
            onClick: onBack,
            "aria-label": "\u9000\u51FA\u5168\u5C4F\uFF0C\u6253\u5F00 dsh \u8FB9\u680F",
            style: {
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 10px 6px 2px",
              display: "flex",
              alignItems: "center",
              color: T.textSecondary,
              lineHeight: 1,
              flexShrink: 0
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(IconPanelLeftOutline, { size: 19 })
          }
        ) : null }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
          "div",
          {
            style: {
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              overflow: "hidden",
              padding: "0 8px"
            },
            children: [
              (() => {
                const inModule = locationPath !== void 0 && locationPath.length > 1;
                const crumbChip = (isCurrent) => ({
                  background: `color-mix(in srgb, ${T.textSecondary} ${isCurrent ? 14 : 8}%, transparent)`,
                  border: `var(--femo-border-w) solid color-mix(in srgb, ${T.textSecondary} ${isCurrent ? 40 : 28}%, transparent)`,
                  borderRadius: "var(--femo-radius-sm)",
                  height: 24,
                  padding: "0 8px",
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  color: T.textSecondary,
                  lineHeight: 1,
                  fontSize: 10.5,
                  fontWeight: 800,
                  fontFamily: "var(--femo-font-sans)",
                  maxWidth: 108,
                  overflow: "hidden",
                  flexShrink: 0
                });
                const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
                return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
                  inModule && onNavigatePath ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                    "button",
                    {
                      onClick: () => onNavigatePath(["mainflow"]),
                      title: "\u56DE\u5230\u4E3B\u753B\u5E03",
                      style: crumbChip(false),
                      children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: ellipsis, children: projName || "FEMO Flow" })
                    }
                  ) : /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                    "span",
                    {
                      style: {
                        fontSize: 13,
                        fontWeight: 800,
                        color: T.textPrimary,
                        fontFamily: "var(--femo-font-sans)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.01em",
                        flexShrink: 0
                      },
                      children: projName || "FEMO Flow"
                    }
                  ),
                  inModule && onNavigatePath && locationPath.slice(1).map((seg, idx) => {
                    const depth = idx + 1;
                    const isCurrent = depth === locationPath.length - 1;
                    return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_react20.default.Fragment, { children: [
                      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: { color: T.textMuted, fontSize: 12, flexShrink: 0 }, children: "\u203A" }),
                      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                        "button",
                        {
                          onClick: () => onNavigatePath(locationPath.slice(0, depth + 1)),
                          title: isCurrent ? `\u5F53\u524D\u6240\u5728\u6A21\u5757 ${seg}` : `\u5B9A\u4F4D\u5230\u6A21\u5757 ${seg}`,
                          style: crumbChip(isCurrent),
                          children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: ellipsis, children: seg })
                        }
                      )
                    ] }, depth);
                  })
                ] });
              })(),
              flowStatus !== "idle" && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                  "span",
                  {
                    style: {
                      width: 6,
                      height: 6,
                      borderRadius: "var(--femo-radius-pill)",
                      background: statusDot.c,
                      display: "block",
                      animation: flowStatus === "running" ? "pulse 1.2s ease-in-out infinite" : "none",
                      flexShrink: 0
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: { fontSize: 10, color: statusDot.c, fontWeight: 700, fontFamily: "var(--femo-font-mono)" }, children: statusDot.label })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }, children: [
          (flowStatus === "idle" || flowStatus === "paused") && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            MobileIconBtn,
            {
              onClick: onRun,
              icon: FaPlay,
              color: T.success,
              title: "\u8FD0\u884C\uFF08\u4ECE\u5934\u5F00\u6F14\uFF09"
            }
          ),
          flowStatus === "running" && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            MobileIconBtn,
            {
              onClick: onPause,
              icon: FaPause,
              color: T.danger,
              title: "\u6682\u505C\uFF08\u53EF\u7EED\u8DD1\uFF09"
            }
          ),
          flowStatus === "paused" && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            MobileIconBtn,
            {
              onClick: onResume,
              icon: FaForward,
              color: T.warning,
              title: "\u7EE7\u7EED\uFF08\u4ECE\u65AD\u70B9\u7EED\u8DD1\uFF09"
            }
          ),
          typeof onImport === "function" && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            MobileIconBtn,
            {
              onClick: onImport,
              icon: FaFolderOpen,
              color: T.textSecondary,
              title: "\u5BFC\u5165 .femo"
            }
          ),
          typeof onExport === "function" && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            MobileIconBtn,
            {
              onClick: onExport,
              icon: FaFloppyDisk,
              color: T.textSecondary,
              title: exportBusy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u5BFC\u51FA .femo",
              disabled: exportBusy
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            "button",
            {
              onClick: onToggleFemo,
              title: "FEMO \u9884\u89C8",
              "aria-label": "FEMO \u9884\u89C8",
              className: "femo-mob-icon-btn",
              style: {
                background: femoVisible ? `color-mix(in srgb, ${T.accent} 16%, transparent)` : `color-mix(in srgb, ${T.textSecondary} 10%, transparent)`,
                border: `var(--femo-border-w) solid ${femoVisible ? `color-mix(in srgb, ${T.accent} 45%, transparent)` : `color-mix(in srgb, ${T.textSecondary} 32%, transparent)`}`,
                borderRadius: "var(--femo-radius-sm)",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                lineHeight: 0,
                fontSize: 9,
                fontWeight: 800,
                color: femoVisible ? T.accent : T.textSecondary,
                fontFamily: "var(--femo-font-mono)",
                letterSpacing: "0.02em",
                boxShadow: femoVisible ? "0 0 9px var(--femo-primary-glow-weak, transparent)" : "none",
                // 内联 transition 会整体覆盖 .femo-mob-icon-btn 的类级 transition，
                // 故按压回缩/提亮（transform/filter）必须在此一并声明。
                transition: "transform 0.12s ease, filter 0.12s ease, background 0.15s, color 0.15s, box-shadow 0.15s"
              },
              children: "FEMO"
            }
          )
        ] })
      ]
    }
  );
}
function MobileIconBtn({ onClick, icon: Icon, color, title, disabled = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
    "button",
    {
      onClick: disabled ? void 0 : onClick,
      disabled,
      title,
      "aria-label": title,
      className: "femo-mob-icon-btn",
      style: {
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
        border: `var(--femo-border-w) solid color-mix(in srgb, ${color} 38%, transparent)`,
        borderRadius: "var(--femo-radius-sm)",
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // 禁用（导出保存中）：与桌面导出键同款——降透明度 + wait 光标，
        // 防重复提交（onClick 已摘掉，双保险）。
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.55 : 1,
        color,
        flexShrink: 0,
        padding: 0,
        lineHeight: 0
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Icon, { size: 12 })
    }
  );
}
var BOTTOM_TABS = [
  { id: "library", label: "\u4ED3\u5E93" },
  { id: "project", label: "\u9879\u76EE" },
  { id: "props", label: "\u5C5E\u6027" },
  { id: "settings", label: "\u8BBE\u7F6E" }
];
function MobileBottomPanel({
  activeTab,
  onTabChange,
  // Library props
  lib,
  mode,
  locationPath,
  allNames,
  onNew,
  onAdd,
  onAddModule,
  onAddSpecial,
  onAddPosition,
  onEdit,
  onEditModule,
  onDragStart,
  // round49：四个触摸处理器全部面板级（挂在滚动容器上），落点无关——
  // touchstart 用 closest('[data-femo-lib-drag]') 找拖拽目标；move/end 负责仲裁与拖拽。
  onPanelTouchStart,
  onLibTouchMove,
  onLibTouchEnd,
  onLibTouchCancel = null,
  libArmedKey,
  // round27：长按激活拖拽的条目 key（点亮被按卡片）
  htmlDraggable = false,
  // 手机端恒 false——draggable 卡片阻止触摸滚动
  onSelectLib,
  onNewModule,
  // Project props
  proj,
  actorNames,
  onProjChange,
  // Props
  sel,
  selNode,
  selEdge,
  selAction,
  nodes,
  edges,
  backEdges,
  nodeStates,
  actionStore,
  onDeleteNode,
  onDeleteEdge,
  onCondChange,
  onEditAction,
  onEnterModuleNode,
  libSel,
  // Settings（设置 tab：主题切换 + 新建 SOUL + 调试窗口）
  themeName,
  onCycleTheme,
  onOpenSoul,
  // Debug（调试窗口：与桌面端共用 debugLog 数据面）
  debugLog = [],
  onClearDebug,
  compilerLog = [],
  onClearCompiler,
  femogenLog = [],
  onClearFemogen,
  hostLog = [],
  onClearHost,
  onCompileDebug,
  compilingDebug = false
}) {
  const scrollRef = (0, import_react20.useRef)(null);
  const [debugOpen, setDebugOpen] = (0, import_react20.useState)(false);
  const WIN_H = typeof window !== "undefined" ? window.innerHeight : 700;
  const MIN_H = 100;
  const MAX_H = Math.round(WIN_H * 0.72);
  const DEFAULT_H = Math.round(WIN_H * 0.28);
  const [panelH, setPanelH] = (0, import_react20.useState)(DEFAULT_H);
  const dragHandleRef = (0, import_react20.useRef)(null);
  const dragStartRef = (0, import_react20.useRef)(null);
  (0, import_react20.useEffect)(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);
  (0, import_react20.useEffect)(() => {
    const el = scrollRef.current;
    if (!el || !onLibTouchMove || !onLibTouchEnd) return;
    if (onPanelTouchStart) el.addEventListener("touchstart", onPanelTouchStart, { passive: true });
    el.addEventListener("touchmove", onLibTouchMove, { passive: false });
    el.addEventListener("touchend", onLibTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onLibTouchCancel || (() => {
    }), { passive: true });
    return () => {
      if (onPanelTouchStart) el.removeEventListener("touchstart", onPanelTouchStart);
      el.removeEventListener("touchmove", onLibTouchMove);
      el.removeEventListener("touchend", onLibTouchEnd);
      el.removeEventListener("touchcancel", onLibTouchCancel || (() => {
      }));
    };
  }, [onPanelTouchStart, onLibTouchMove, onLibTouchEnd, onLibTouchCancel]);
  const onHandleMouseDown = (0, import_react20.useCallback)((e) => {
    e.preventDefault();
    dragStartRef.current = { y: e.clientY, h: panelH };
    const onMove = (mv) => {
      const delta = dragStartRef.current.y - mv.clientY;
      setPanelH(Math.max(MIN_H, Math.min(MAX_H, dragStartRef.current.h + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [panelH]);
  const onHandleTouchStart = (0, import_react20.useCallback)((e) => {
    e.stopPropagation();
    const t = e.touches[0];
    dragStartRef.current = { y: t.clientY, h: panelH };
  }, [panelH]);
  const onHandleTouchMove = (0, import_react20.useCallback)((e) => {
    e.stopPropagation();
    e.preventDefault();
    const t = e.touches[0];
    const delta = dragStartRef.current.y - t.clientY;
    setPanelH(Math.max(MIN_H, Math.min(MAX_H, dragStartRef.current.h + delta)));
  }, []);
  const onHandleTouchEnd = (0, import_react20.useCallback)((e) => {
    e.stopPropagation();
    dragStartRef.current = null;
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
    "div",
    {
      style: {
        height: panelH,
        background: T.surface,
        borderTop: `var(--femo-border-w) solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "relative",
        zIndex: 50,
        transition: dragStartRef.current ? "none" : "height 0.12s ease"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "div",
          {
            ref: dragHandleRef,
            onMouseDown: onHandleMouseDown,
            onTouchStart: onHandleTouchStart,
            onTouchMove: onHandleTouchMove,
            onTouchEnd: onHandleTouchEnd,
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "ns-resize",
              zIndex: 10,
              touchAction: "none",
              userSelect: "none"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
              "div",
              {
                style: {
                  width: 36,
                  height: 4,
                  borderRadius: "var(--femo-radius-xs)",
                  background: T.borderLight,
                  opacity: 0.7,
                  marginTop: 6
                }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "div",
          {
            style: {
              display: "flex",
              borderBottom: `var(--femo-border-w) solid ${T.border}`,
              flexShrink: 0,
              background: T.bg,
              marginTop: 18
            },
            children: BOTTOM_TABS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
              "button",
              {
                onClick: () => onTabChange(t.id),
                style: {
                  flex: 1,
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === t.id ? `var(--femo-border-w-selected) solid ${T.accent}` : "var(--femo-border-w-selected) solid transparent",
                  padding: "7px 0",
                  fontSize: 11.5,
                  fontWeight: activeTab === t.id ? 800 : 500,
                  color: activeTab === t.id ? T.accent : T.textMuted,
                  cursor: "pointer",
                  fontFamily: "var(--femo-font-sans)",
                  letterSpacing: "0.02em",
                  transition: "color 0.15s, border-color 0.15s"
                },
                children: [
                  t.label,
                  t.id === "props" && (sel || libSel) && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: { display: "inline-block", width: 5, height: 5, borderRadius: "var(--femo-radius-pill)", background: T.accent, marginLeft: 4, verticalAlign: "middle" } })
                ]
              },
              t.id
            ))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
          "div",
          {
            ref: scrollRef,
            className: "femo-bottom-scroll",
            style: {
              flex: 1,
              overflowY: "auto",
              padding: "10px 14px 12px",
              animation: "fadePanel 0.15s ease",
              minHeight: 0,
              // 让桌面端组件在深色背景下可读
              "--text-primary": T.textPrimary,
              color: "var(--femo-text-1)",
              background: "transparent"
              /* round12/15：去掉圆角卡片底，融入壳背景 */
            },
            children: [
              activeTab === "library" && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                LibPanel,
                {
                  cardLayout: "grid3",
                  lib,
                  mode,
                  locationPath,
                  allNames,
                  onNew,
                  onAdd,
                  onAddModule,
                  onAddSpecial,
                  onAddPosition,
                  onEdit,
                  onEditModule,
                  onDragStart,
                  armedKey: libArmedKey,
                  htmlDraggable,
                  onSelectLib,
                  onNewModule
                }
              ),
              activeTab === "project" && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                ProjPanel,
                {
                  proj,
                  actorNames,
                  onChange: onProjChange
                }
              ),
              activeTab === "props" && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                MobilePropsPanel,
                {
                  sel,
                  selNode,
                  selEdge,
                  selAction,
                  nodes,
                  edges,
                  backEdges,
                  nodeStates,
                  actionStore,
                  onDeleteNode,
                  onDeleteEdge,
                  onCondChange,
                  onEditAction,
                  onEnterModuleNode,
                  libSel,
                  lib
                }
              ),
              activeTab === "settings" && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: sectionLabel, children: "\u8BBE\u7F6E" }),
                /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { display: "flex", alignItems: "stretch", gap: 8, marginTop: 8 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
                    "button",
                    {
                      onClick: onCycleTheme,
                      title: `\u4E3B\u9898\uFF1A\u70B9\u51FB\u5207\u6362\uFF08\u5F53\u524D ${themeName}\uFF09`,
                      style: mobSettingBtn,
                      className: "femo-mob-setting-btn",
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(FaPalette, { size: 12, style: { flexShrink: 0 } }),
                        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: mobSettingBtnText, children: themeName })
                      ]
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
                    "button",
                    {
                      onClick: onOpenSoul,
                      title: "\u65B0\u5EFA SOUL",
                      style: mobSettingBtn,
                      className: "femo-mob-setting-btn",
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(FaUserPlus, { size: 12, style: { flexShrink: 0 } }),
                        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: mobSettingBtnText, children: "\u65B0\u5EFA SOUL" })
                      ]
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
                    "button",
                    {
                      onClick: () => setDebugOpen(true),
                      title: "\u8C03\u8BD5\u7A97\u53E3\uFF1A\u540E\u7AEF\u8FD0\u884C\u4FE1\u606F\u4E0E\u62A5\u9519\u7684\u5E38\u9A7B\u65E5\u5FD7\u6D41",
                      style: mobSettingBtn,
                      className: "femo-mob-setting-btn",
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(FaTerminal, { size: 12, style: { flexShrink: 0 } }),
                        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: mobSettingBtnText, children: "\u8C03\u8BD5" }),
                        debugLog.some((e) => e.level === "error") && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                          "span",
                          {
                            style: {
                              position: "absolute",
                              top: 3,
                              right: 3,
                              width: 8,
                              height: 8,
                              borderRadius: "var(--femo-radius-pill)",
                              background: "var(--femo-danger)",
                              border: "1.5px solid var(--femo-bg)"
                            }
                          }
                        )
                      ]
                    }
                  )
                ] })
              ] })
            ]
          }
        ),
        debugOpen && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: { position: "absolute", inset: "20px 0 0 0", zIndex: 60 }, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          DebugPanel,
          {
            entries: debugLog,
            onClose: () => setDebugOpen(false),
            onClear: onClearDebug,
            compilerEntries: compilerLog,
            onClearCompiler,
            femogenEntries: femogenLog,
            onClearFemogen,
            hostEntries: hostLog,
            onClearHost,
            onCompile: onCompileDebug,
            compiling: compilingDebug
          }
        ) })
      ]
    }
  );
}
function MobilePropsPanel({ sel, selNode, selEdge, selAction, nodes, edges, backEdges, nodeStates, actionStore, onDeleteNode, onDeleteEdge, onCondChange, onEditAction, onEnterModuleNode, libSel, lib }) {
  if (sel?.type === "node" && selNode) {
    const ns = nodeStates?.[selNode.id] || {};
    const action = selAction;
    const isModuleNode = selNode.type === "module" && !!selNode.modDef;
    const { c } = action ? ti(action.executorType) : { c: "var(--femo-neutral)" };
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }, children: [
        action && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("span", { style: { background: `var(--femo-badge-bg-${["ai", "human", "mind", "func", "assign", "notice"].includes(action.executorType) ? action.executorType : "ai"})`, color: `var(--femo-badge-fg-${["ai", "human", "mind", "func", "assign", "notice"].includes(action.executorType) ? action.executorType : "ai"})`, borderRadius: "var(--femo-radius-sm)", padding: "2px 7px", fontSize: 10, fontWeight: 800, fontFamily: "var(--femo-font-mono)" }, children: [
          "@",
          action.executorType
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: { fontSize: 13.5, fontWeight: 800, color: T.textPrimary }, children: action?.name || selNode.specialType || selNode.label || "\u8282\u70B9" })
      ] }),
      selNode.label && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MobPropRow, { k: "\u8282\u70B9\u540D", v: String(selNode.label).replace(/[\[\]]/g, "") }),
      action && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
        action.executorActor && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MobPropRow, { k: "\u6267\u884C\u8005", v: action.executorActor }),
        action.scope && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MobPropRow, { k: "Scope", v: action.scope }),
        action.outVars && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MobPropRow, { k: "\u51FA\u53C2", v: String(action.outVars) })
      ] }),
      ns.status && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MobPropRow, { k: "\u72B6\u6001", v: ns.status }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { display: "flex", gap: 7, marginTop: 10 }, children: [
        action && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("button", { onClick: onEditAction, style: { ...mobBtnP, flex: 1, fontSize: 11, padding: "6px 0" }, children: "\u7F16\u8F91 Action" }),
        isModuleNode && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "button",
          {
            onClick: () => onEnterModuleNode?.(selNode.id),
            style: { ...mobBtnP, flex: 1, fontSize: 11, padding: "6px 0", background: "var(--femo-primary)" },
            children: "\u8FDB\u5165\u5B50\u753B\u5E03"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("button", { onClick: onDeleteNode, style: { ...mobBtnDanger, flex: 1, fontSize: 11, padding: "6px 0" }, children: "\u5220\u9664\u8282\u70B9" })
      ] })
    ] });
  }
  if (sel?.type === "edge" && selEdge) {
    const isBack = backEdges?.has(selEdge.id);
    const inEdges = edges.filter((e) => e.tgt === selEdge.tgt && !backEdges?.has(e.id));
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: { fontSize: 12, fontWeight: 700, color: T.textPrimary, marginBottom: 8 }, children: "\u8FDE\u7EBF\u5C5E\u6027" }),
      isBack && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: { fontSize: 10, color: "var(--femo-primary-strong)", fontWeight: 700, background: "var(--femo-primary-soft-faint)", borderRadius: "var(--femo-radius-sm)", padding: "3px 7px", marginBottom: 6 }, children: "\u56DE\u73AF\u68C0\u6D4B" }),
      inEdges.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { fontSize: 10, color: T.warning, fontWeight: 700, marginBottom: 6 }, children: [
        "Join \u8282\u70B9 (",
        inEdges.length,
        " \u5165\u53E3)"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: fieldLabel, children: "if \u6761\u4EF6" }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
        "input",
        {
          value: selEdge.cond || "",
          onChange: (e) => onCondChange(e.target.value),
          placeholder: "\u7559\u7A7A = \u65E0\u6761\u4EF6",
          style: { ...mobInp, marginBottom: 10 }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("button", { onClick: onDeleteEdge, style: { ...mobBtnDanger, width: "100%", fontSize: 11, padding: "6px 0" }, children: "\u5220\u9664\u8FDE\u7EBF" })
    ] });
  }
  if (libSel) {
    let item = null;
    if (libSel.type === "action") item = lib?.actions?.find((a) => a.id === libSel.id);
    else if (libSel.type === "module") item = lib?.modules?.find((m) => m.id === libSel.id);
    if (item) {
      return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: { fontSize: 13, fontWeight: 700, color: T.textPrimary, marginBottom: 8 }, children: libSel.type === "module" ? `&${item.name}` : item.name }),
        libSel.type === "action" && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MobPropRow, { k: "\u7C7B\u578B", v: `@${item.executorType}` }),
          item.executorActor && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MobPropRow, { k: "\u6267\u884C\u8005", v: item.executorActor })
        ] })
      ] });
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { color: T.textMuted, fontSize: 12, lineHeight: 1.8, paddingTop: 4 }, children: [
    "\u70B9\u51FB\u8282\u70B9\u6216\u8FDE\u7EBF\u67E5\u770B\u5C5E\u6027",
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("br", {}),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: { fontSize: 10.5, color: T.textMuted }, children: "\u53CC\u51FB\u8282\u70B9\u53EF\u7F16\u8F91\uFF1B\u53CC\u51FB\u6A21\u5757\u8282\u70B9\u8FDB\u5165\u5176\u5B50\u753B\u5E03" })
  ] });
}
function MobPropRow({ k, v }) {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { style: { display: "flex", gap: 8, fontSize: 11.5, marginBottom: 5 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: { color: T.textMuted, minWidth: 44, flexShrink: 0 }, children: k }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { style: { color: T.textPrimary, fontFamily: "var(--femo-font-mono)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: v })
  ] });
}
var LONG_PRESS_MS = 200;
var LIB_LONG_PRESS_MS = 300;
var LIB_SCROLL_COMMIT_PX = 8;
var LIB_DRAG_SLOP_PX = 4;
var LIB_STILL_MS = 120;
var LIB_ARM_RECHECK_MS = 150;
var LIB_ARM_MAX_WAIT_MS = 900;
var MOVE_THRESHOLD = 5;
var NODE_TOUCH_PAD = 12;
function useMobileCanvasGesture({
  cvRef,
  tfRef,
  pan,
  setPan,
  scale,
  setScale,
  handlePortDown,
  handlePortUp,
  setConn,
  nodes,
  setNodes,
  setDrag,
  setSel,
  onBubbleClick,
  onNodeDoubleTap
}) {
  const stateRef = (0, import_react20.useRef)({ phase: "idle" });
  const pinchRef = (0, import_react20.useRef)({ dist: 0, x: 0, y: 0 });
  const startRef = (0, import_react20.useRef)({ x: 0, y: 0 });
  const timerRef = (0, import_react20.useRef)(null);
  const lastTapRef = (0, import_react20.useRef)(null);
  const [dragReady, setDragReady] = (0, import_react20.useState)(null);
  const canvasTouchesRef = (0, import_react20.useRef)(/* @__PURE__ */ new Set());
  const panRef = (0, import_react20.useRef)(pan);
  const scaleRef = (0, import_react20.useRef)(scale);
  const nodesRef = (0, import_react20.useRef)(nodes);
  (0, import_react20.useEffect)(() => {
    if (stateRef.current.phase === "idle") panRef.current = pan;
  }, [pan]);
  (0, import_react20.useEffect)(() => {
    if (stateRef.current.phase === "idle") scaleRef.current = scale;
  }, [scale]);
  (0, import_react20.useEffect)(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const apiRef = (0, import_react20.useRef)({});
  (0, import_react20.useEffect)(() => {
    apiRef.current = { setPan, setScale, setSel, setNodes, setConn, setDrag, handlePortDown, handlePortUp, onBubbleClick, onNodeDoubleTap };
  });
  const dist2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const mid2 = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
  const findTouch = (list, id) => {
    for (let i = 0; i < list.length; i += 1) if (list[i].identifier === id) return list[i];
    return null;
  };
  const clearTimer = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  const applyTransform = (x, y, s) => {
    panRef.current = { x, y };
    scaleRef.current = s;
    if (tfRef?.current) tfRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  };
  const flushTransform = () => {
    apiRef.current.setPan(panRef.current);
    apiRef.current.setScale(scaleRef.current);
  };
  const hitTest = (cx, cy) => {
    const el = document.elementFromPoint(cx, cy);
    if (el) {
      const portEl = el.closest("[data-port-node]");
      if (portEl) return {
        type: "port",
        nodeId: portEl.dataset.portNode,
        portDir: portEl.dataset.portDir || "right",
        portX: portEl.dataset.portX ? parseFloat(portEl.dataset.portX) : void 0,
        portY: portEl.dataset.portY ? parseFloat(portEl.dataset.portY) : void 0
      };
      const bubbleEl = el.closest("[data-bubble-node]");
      if (bubbleEl) return { type: "bubble", nodeId: bubbleEl.dataset.bubbleNode };
      const nodeEl = el.closest("[data-node-id]");
      if (nodeEl) return { type: "node", nodeId: nodeEl.dataset.nodeId };
      const edgeEl = el.closest("[data-edge-id]");
      if (edgeEl) return { type: "edge", id: edgeEl.dataset.edgeId };
    }
    const rect = cvRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const s = scaleRef.current || 1;
    const p = panRef.current;
    const wx = (cx - rect.left - p.x) / s;
    const wy = (cy - rect.top - p.y) / s;
    const pad = NODE_TOUCH_PAD / s;
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      const { w, h } = getNodeSize(n);
      if (wx >= n.x - pad && wx <= n.x + w + pad && wy >= n.y - pad && wy <= n.y + h + pad) {
        return { type: "node", nodeId: n.id };
      }
    }
    return null;
  };
  const fakeEv = (cx, cy) => ({
    clientX: cx,
    clientY: cy,
    button: 0,
    stopPropagation: () => {
    },
    preventDefault: () => {
    },
    target: null
  });
  const enterPinch = (e) => {
    const ids = [...canvasTouchesRef.current].filter((id) => findTouch(e.touches, id));
    if (ids.length < 2) return false;
    const [idA, idB] = ids.slice(-2);
    const ta = findTouch(e.touches, idA);
    const tb = findTouch(e.touches, idB);
    if (!ta || !tb) return false;
    stateRef.current = { phase: "pinch", idA, idB };
    pinchRef.current = { dist: dist2(ta, tb), ...mid2(ta, tb) };
    setDragReady(null);
    return true;
  };
  (0, import_react20.useEffect)(() => {
    const el = cvRef.current;
    if (!el) return void 0;
    const onTouchStart = (e) => {
      let canvasChanged = null;
      for (let i = 0; i < e.changedTouches.length; i += 1) {
        if (el.contains(e.changedTouches[i].target)) {
          canvasChanged = e.changedTouches[i];
          break;
        }
      }
      if (!canvasChanged) return;
      const ae = document.activeElement;
      if (ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT" || ae.tagName === "SELECT")) ae.blur();
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i += 1) {
        const t2 = e.changedTouches[i];
        if (el.contains(t2.target)) canvasTouchesRef.current.add(t2.identifier);
      }
      const st = stateRef.current;
      if (canvasTouchesRef.current.size >= 2) {
        clearTimer();
        if (st.phase === "conn") apiRef.current.setConn(null);
        enterPinch(e);
        return;
      }
      if (st.phase !== "idle") return;
      const t = canvasChanged;
      startRef.current = { x: t.clientX, y: t.clientY };
      stateRef.current = { phase: "pending", id: t.identifier, cx: t.clientX, cy: t.clientY };
      setDragReady(null);
      timerRef.current = setTimeout(() => {
        const s0 = stateRef.current;
        if (s0.phase !== "pending") return;
        const { cx, cy } = s0;
        const hit = hitTest(cx, cy);
        if (hit?.type === "port") {
          stateRef.current = { phase: "conn", id: s0.id, srcNodeId: hit.nodeId };
          navigator.vibrate?.(12);
          apiRef.current.handlePortDown(fakeEv(cx, cy), hit.nodeId, hit.portDir, hit.portX, hit.portY);
        } else if (hit?.type === "node" || hit?.type === "bubble") {
          const node = nodesRef.current.find((n) => n.id === hit.nodeId);
          if (!node) return;
          navigator.vibrate?.(18);
          setDragReady(hit.nodeId);
          apiRef.current.setSel({ type: "node", id: hit.nodeId });
          stateRef.current = {
            phase: "nodeDrag",
            id: s0.id,
            nodeId: hit.nodeId,
            startCx: cx,
            startCy: cy,
            startNx: node.x,
            startNy: node.y
          };
        } else {
          stateRef.current = { phase: "canvasPan", id: s0.id, cx, cy };
        }
      }, LONG_PRESS_MS);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      const st = stateRef.current;
      if (st.phase === "pinch") {
        const ta = findTouch(e.touches, st.idA);
        const tb = findTouch(e.touches, st.idB);
        if (!ta || !tb) return;
        const d = dist2(ta, tb);
        const m = mid2(ta, tb);
        const ratio = d / (pinchRef.current.dist || d);
        const rect = el.getBoundingClientRect();
        const p = panRef.current, s = scaleRef.current;
        const mxr = m.x - rect.left, myr = m.y - rect.top;
        const wx = (mxr - p.x) / s, wy = (myr - p.y) / s;
        const ns = Math.min(3, Math.max(0.2, s * ratio));
        applyTransform(
          mxr - wx * ns + (m.x - pinchRef.current.x),
          myr - wy * ns + (m.y - pinchRef.current.y),
          ns
        );
        pinchRef.current = { dist: d, x: m.x, y: m.y };
        return;
      }
      const t = st.id !== void 0 ? findTouch(e.touches, st.id) : null;
      if (!t) return;
      if (st.phase === "pending") {
        const dx = t.clientX - startRef.current.x;
        const dy = t.clientY - startRef.current.y;
        if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
          clearTimer();
          stateRef.current = { phase: "canvasPan", id: st.id, cx: t.clientX, cy: t.clientY };
        }
        return;
      }
      if (st.phase === "nodeDrag") {
        setDragReady(null);
        const sc = scaleRef.current;
        const newX = st.startNx + (t.clientX - st.startCx) / sc;
        const newY = st.startNy + (t.clientY - st.startCy) / sc;
        apiRef.current.setNodes((prev) => {
          const draggedNode = prev.find((n) => n.id === st.nodeId);
          if (!draggedNode) return prev;
          return applyForLinkage(prev, draggedNode, newX, newY);
        });
        return;
      }
      if (st.phase === "conn") {
        const p = panRef.current;
        const sc = scaleRef.current;
        const rect = el.getBoundingClientRect();
        const mx = (t.clientX - rect.left - p.x) / sc;
        const my = (t.clientY - rect.top - p.y) / sc;
        apiRef.current.setConn((prev) => prev ? { ...prev, mx, my } : prev);
        return;
      }
      if (st.phase === "canvasPan") {
        applyTransform(
          panRef.current.x + (t.clientX - st.cx),
          panRef.current.y + (t.clientY - st.cy),
          scaleRef.current
        );
        st.cx = t.clientX;
        st.cy = t.clientY;
        return;
      }
    };
    const finishGesture = (e) => {
      const cancelled = e.type === "touchcancel";
      clearTimer();
      setDragReady(null);
      for (let i = 0; i < e.changedTouches.length; i += 1) {
        canvasTouchesRef.current.delete(e.changedTouches[i].identifier);
      }
      const alive = [];
      for (let i = 0; i < e.touches.length; i += 1) {
        if (canvasTouchesRef.current.has(e.touches[i].identifier)) alive.push(e.touches[i]);
      }
      const removedIds = /* @__PURE__ */ new Set();
      for (let i = 0; i < e.changedTouches.length; i += 1) removedIds.add(e.changedTouches[i].identifier);
      const st = stateRef.current;
      if (st.phase === "pinch") {
        if (removedIds.has(st.idA) || removedIds.has(st.idB)) {
          if (cancelled) {
            flushTransform();
            stateRef.current = { phase: "idle" };
          } else if (alive.length >= 2) {
            enterPinch(e);
          } else if (alive.length === 1) {
            flushTransform();
            stateRef.current = { phase: "canvasPan", id: alive[0].identifier, cx: alive[0].clientX, cy: alive[0].clientY };
          } else {
            flushTransform();
            stateRef.current = { phase: "idle" };
          }
        }
        return;
      }
      const mine = cancelled ? null : Array.from(e.changedTouches).find((t) => t.identifier === st.id);
      if (st.phase === "conn") {
        if (cancelled) {
          apiRef.current.setConn(null);
        } else if (mine) {
          const hit = hitTest(mine.clientX, mine.clientY);
          if (hit?.nodeId && hit.nodeId !== st.srcNodeId) {
            apiRef.current.handlePortUp(fakeEv(mine.clientX, mine.clientY), hit.nodeId, hit.portDir || "left");
          } else {
            apiRef.current.setConn(null);
          }
        }
        if (cancelled || mine) stateRef.current = { phase: "idle" };
        return;
      }
      if (st.phase === "nodeDrag") {
        apiRef.current.setDrag(null);
        stateRef.current = { phase: "idle" };
        return;
      }
      if (st.phase === "pending") {
        if (cancelled) {
          stateRef.current = { phase: "idle" };
          return;
        }
        if (!mine) return;
        const hit = hitTest(mine.clientX, mine.clientY);
        if (hit?.type === "bubble") {
          apiRef.current.onBubbleClick?.(hit.nodeId);
        } else if (hit?.type === "node") {
          const now = performance.now();
          const lt = lastTapRef.current;
          if (lt && lt.nodeId === hit.nodeId && now - lt.t < 300) {
            lastTapRef.current = null;
            apiRef.current.onNodeDoubleTap?.(hit.nodeId);
          } else {
            lastTapRef.current = { nodeId: hit.nodeId, t: now };
            apiRef.current.setSel({ type: "node", id: hit.nodeId });
          }
        } else if (hit?.type === "edge") {
          apiRef.current.setSel({ type: "edge", id: hit.id });
        } else {
          apiRef.current.setSel(null);
        }
        stateRef.current = { phase: "idle" };
        return;
      }
      if (st.phase === "canvasPan") {
        flushTransform();
        if (!cancelled && mine && alive.length >= 1) {
          const t0 = alive[0];
          stateRef.current = { phase: "canvasPan", id: t0.identifier, cx: t0.clientX, cy: t0.clientY };
        } else {
          stateRef.current = { phase: "idle" };
        }
      }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", finishGesture, { passive: false });
    el.addEventListener("touchcancel", finishGesture, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", finishGesture);
      el.removeEventListener("touchcancel", finishGesture);
      canvasTouchesRef.current.clear();
      stateRef.current = { phase: "idle" };
    };
  }, [cvRef]);
  return { dragReady };
}
function MobileLayout({
  // Theme
  theme = "dsh",
  // 全屏层（插件模式手机端全屏沉浸用）：fixedMode=false 时降级为容器内 absolute
  zIndex,
  fixedMode = true,
  // 返回键（插件模式：打开 dsh 边栏；独立模式不传）
  onBack,
  // 全屏键（插件模式容器内态：回全屏沉浸；独立模式不传）
  onExpand,
  // Project
  proj,
  actorNames,
  onProjChange,
  // Canvas core
  cvRef,
  pan,
  setPan,
  scale,
  setScale,
  nodes,
  edges,
  sel,
  setSel,
  drag,
  setDrag,
  conn,
  setConn,
  isPanning,
  setNodes,
  onMM,
  onMU,
  onCanvasDown,
  handleWheel,
  handlePortDown,
  handlePortUp,
  handleBodyMouseUp,
  handleCanvasDragOver,
  handleCanvasDrop,
  canvasContent,
  canvasOpacity,
  // Library
  lib,
  mode,
  locationPath,
  allNames,
  onNew,
  onAdd,
  onAddModule,
  onAddSpecial,
  onAddPosition,
  onEdit,
  onEditModule,
  onDragStart,
  onSelectLib,
  onNewModule,
  libSel,
  // Runtime
  flowStatus,
  hasActiveRunningNodes,
  onRun,
  onPause,
  onResume,
  nodeStates,
  actionStore,
  activeNodeIds,
  errorNodeIds,
  // Bubble
  bubbleOverlay,
  onBubbleClose,
  submitHumanInput,
  humanWaits,
  onBubbleClick,
  // FEMO
  femoText,
  onFemoChange,
  femoError,
  FEMOrnings,
  femoDirty,
  onApplyFemo,
  onRestoreFemo,
  onGraphToFemo,
  // 文件读写（2026-09-11 手机端补齐）：导入/导出回调 + 导出进行中/成功回执。
  // 与桌面工具栏同源（FemoWorAuto 的 handleToolbarImport / handleToolbarExport），
  // 手机端只换呈现（图标芯片 + 标题栏下方 toast），行为完全一致。
  onImport,
  onExport,
  exportBusy,
  exportToast,
  // Modals
  onOpenSoul,
  // 设置（设置 tab：主题切换 + 新建 SOUL）
  themeName,
  onCycleTheme,
  // 调试窗口（设置 tab 打开；数据面与桌面端同源）
  debugLog,
  onClearDebug,
  compilerLog,
  onClearCompiler,
  femogenLog,
  onClearFemogen,
  hostLog,
  onClearHost,
  onCompileDebug,
  compilingDebug,
  // Selection helpers
  backEdges,
  onDeleteNode,
  onDeleteEdge,
  onCondChange,
  onEditAction,
  // Module 子画布导航（2026-09-06 手机端补齐）：双击节点分发 / 返回上级 /
  // 属性面板「进入子画布」。
  onNodeDoubleTap,
  onNavigatePath,
  onEnterModuleNode
}) {
  const [femoVisible, setFemoVisible] = (0, import_react20.useState)(false);
  const [bottomTab, setBottomTab] = (0, import_react20.useState)("library");
  const tfRef = (0, import_react20.useRef)(null);
  (0, import_react20.useEffect)(() => {
    if (sel) setBottomTab("props");
  }, [sel]);
  const { dragReady } = useMobileCanvasGesture({
    cvRef,
    tfRef,
    pan,
    setPan,
    scale,
    setScale,
    handlePortDown,
    handlePortUp,
    setConn,
    nodes,
    setNodes,
    setDrag,
    setSel,
    onBubbleClick,
    onNodeDoubleTap
  });
  const libDragRef = (0, import_react20.useRef)(null);
  const libTimerRef = (0, import_react20.useRef)(null);
  const [libDragActive, setLibDragActive] = (0, import_react20.useState)(false);
  const ghostRef = (0, import_react20.useRef)(null);
  const ghostLabelRef = (0, import_react20.useRef)(null);
  const [libArmedKey, setLibArmedKey] = (0, import_react20.useState)(null);
  const libRef = (0, import_react20.useRef)(lib);
  (0, import_react20.useEffect)(() => {
    libRef.current = lib;
  }, [lib]);
  const handlePanelTouchStart = (0, import_react20.useCallback)((e) => {
    if (libDragRef.current) return;
    const t = e.touches[0];
    if (!t || !t.target) return;
    if (t.target.closest && t.target.closest("input, textarea, select, button")) return;
    const card = t.target.closest ? t.target.closest("[data-femo-lib-drag]") : null;
    if (!card) return;
    const raw = card.getAttribute("data-femo-lib-drag") || "";
    const sep = raw.indexOf(":");
    if (sep <= 0) return;
    const type = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    let item = null;
    if (type === "action") item = (libRef.current?.actions || []).find((x) => x.id === id);
    else if (type === "module") item = (libRef.current?.modules || []).find((x) => x.id === id);
    else if (type === "special" || type === "position") item = id;
    if (!item) return;
    clearTimeout(libTimerRef.current);
    libDragRef.current = {
      phase: "pending",
      type,
      item,
      startX: t.clientX,
      startY: t.clientY,
      lastX: t.clientX,
      lastY: t.clientY,
      lastMoveAt: performance.now(),
      bornAt: performance.now()
    };
    const tryArm = () => {
      const st = libDragRef.current;
      if (!st || st.phase !== "pending") return;
      const now = performance.now();
      const driftX = Math.abs(st.lastX - st.startX);
      const driftY = Math.abs(st.lastY - st.startY);
      const stillLongEnough = now - st.lastMoveAt >= LIB_STILL_MS;
      if (driftX > LIB_DRAG_SLOP_PX || driftY > LIB_DRAG_SLOP_PX || !stillLongEnough) {
        if (now - st.bornAt < LIB_ARM_MAX_WAIT_MS) {
          libTimerRef.current = setTimeout(tryArm, LIB_ARM_RECHECK_MS);
        } else {
          libDragRef.current = null;
        }
        return;
      }
      st.phase = "drag";
      navigator.vibrate?.(15);
      const label = typeof st.item === "string" ? st.item : st.item?.name || st.type;
      setLibArmedKey(`${st.type}:${typeof st.item === "string" ? st.item : st.item?.id}`);
      setLibDragActive(true);
      if (ghostRef.current && ghostLabelRef.current) {
        ghostLabelRef.current.textContent = label;
        ghostRef.current.style.display = "block";
        ghostRef.current.style.left = `${st.startX - 50}px`;
        ghostRef.current.style.top = `${st.startY - 20}px`;
      }
    };
    libTimerRef.current = setTimeout(tryArm, LIB_LONG_PRESS_MS);
  }, []);
  const handleLibTouchMove = (0, import_react20.useCallback)((e) => {
    const st = libDragRef.current;
    if (!st) return;
    const t = e.touches[0];
    if (st.phase === "drag") {
      e.preventDefault();
      e.stopPropagation();
      if (ghostRef.current) {
        ghostRef.current.style.left = `${t.clientX - 50}px`;
        ghostRef.current.style.top = `${t.clientY - 20}px`;
      }
      return;
    }
    st.lastX = t.clientX;
    st.lastY = t.clientY;
    st.lastMoveAt = performance.now();
    const dx = Math.abs(t.clientX - st.startX);
    const dy = Math.abs(t.clientY - st.startY);
    if (dx >= LIB_SCROLL_COMMIT_PX || dy >= LIB_SCROLL_COMMIT_PX) {
      clearTimeout(libTimerRef.current);
      libDragRef.current = null;
    }
  }, []);
  const handleLibTouchCancel = (0, import_react20.useCallback)((e) => {
    clearTimeout(libTimerRef.current);
    if (ghostRef.current) ghostRef.current.style.display = "none";
    setLibArmedKey(null);
    setLibDragActive(false);
    libDragRef.current = null;
  }, []);
  const handleLibTouchEnd = (0, import_react20.useCallback)((e) => {
    clearTimeout(libTimerRef.current);
    setLibArmedKey(null);
    setLibDragActive(false);
    if (ghostRef.current) ghostRef.current.style.display = "none";
    const st = libDragRef.current;
    libDragRef.current = null;
    if (!st || st.phase !== "drag") return;
    const t = e.changedTouches[0];
    const cvRect = cvRef.current?.getBoundingClientRect();
    if (!cvRect) return;
    if (t.clientX < cvRect.left || t.clientX > cvRect.right || t.clientY < cvRect.top || t.clientY > cvRect.bottom) {
      return;
    }
    const worldX = (t.clientX - cvRect.left - pan.x) / scale - 50;
    const worldY = (t.clientY - cvRect.top - pan.y) / scale - 20;
    const { type, item } = st;
    if (type === "action") onAdd(item, worldX, worldY);
    else if (type === "module") onAddModule(item, worldX, worldY);
    else if (type === "special") onAddSpecial(item, worldX, worldY);
    else if (type === "position") onAddPosition(worldX, worldY);
  }, [pan, scale, cvRef, onAdd, onAddModule, onAddSpecial, onAddPosition]);
  const selNode = sel?.type === "node" ? nodes.find((n) => n.id === sel.id) : null;
  const selEdge = sel?.type === "edge" ? edges.find((e) => e.id === sel.id) : null;
  const selAction = selNode?.type === "action" ? actionStore?.find((a) => a.id === selNode.actionId) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
    "div",
    {
      "data-femo-theme": theme,
      style: {
        position: fixedMode ? "fixed" : "absolute",
        inset: 0,
        zIndex,
        display: "flex",
        flexDirection: "column",
        background: T.bg,
        fontFamily: "var(--femo-font-sans)",
        overflow: "hidden"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MobileGlobalStyle, {}),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          MobileTitleBar,
          {
            projName: proj?.name,
            flowStatus,
            femoVisible,
            onBack: fixedMode ? onBack : void 0,
            onExpand: fixedMode ? void 0 : onExpand,
            onToggleFemo: () => setFemoVisible((v) => !v),
            onRun,
            onPause,
            onResume,
            hasActiveRunningNodes,
            onImport,
            onExport,
            exportBusy,
            locationPath,
            onNavigatePath
          }
        ),
        exportToast !== null && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "div",
          {
            style: {
              position: "absolute",
              top: "clamp(40px, 5vh, 56px)",
              right: 12,
              marginTop: 6,
              zIndex: 150,
              maxWidth: "min(560px, calc(100% - 24px))",
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
              fontWeight: 600,
              wordBreak: "break-all",
              boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
              background: "var(--femo-panel-bg)",
              border: "1px solid var(--femo-success, #3ca050)",
              color: "var(--femo-success, #3ca050)",
              animation: "dropHintIn 0.2s ease"
            },
            children: exportToast.text
          },
          exportToast.id
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
          "div",
          {
            ref: cvRef,
            className: "femo-canvas-zone",
            style: {
              flex: 1,
              position: "relative",
              overflow: "hidden",
              backgroundImage: "var(--femo-mobile-canvas-dots)",
              backgroundSize: "22px 22px",
              cursor: isPanning ? "grabbing" : conn ? "crosshair" : "default",
              minHeight: 0
            },
            onMouseMove: onMM,
            onMouseUp: onMU,
            onMouseDown: onCanvasDown,
            onWheel: handleWheel,
            onMouseLeave: onMU,
            onDragOver: handleCanvasDragOver,
            onDrop: handleCanvasDrop,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                "div",
                {
                  "data-canvas-bg": "true",
                  style: {
                    opacity: canvasOpacity,
                    transition: "opacity 0.2s ease",
                    position: "absolute",
                    inset: 0
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
                    "div",
                    {
                      ref: tfRef,
                      "data-canvas-bg": "true",
                      style: {
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: "0 0",
                        position: "absolute",
                        inset: 0
                      },
                      children: canvasContent
                    }
                  )
                }
              ),
              nodes.filter((n) => n.type !== "special").length === 0 && !conn && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
                "div",
                {
                  style: {
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    zIndex: 0
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: { fontSize: 13, color: "var(--femo-mobile-border-light)", fontWeight: 600 }, children: "\u4ECE\u4ED3\u5E93\u6DFB\u52A0 Action" }),
                    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: { fontSize: 11, color: "var(--femo-mobile-border)", marginTop: 5 }, children: "\u957F\u6309\u8282\u70B9\u62D6\u52A8 \xB7 \u957F\u6309\u7AEF\u53E3\u8FDE\u7EBF \xB7 \u53CC\u6307\u7F29\u653E" })
                  ]
                }
              ),
              libDragActive && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: {
                  position: "absolute",
                  inset: 8,
                  borderRadius: "var(--femo-radius-lg)",
                  border: "var(--femo-border-w-selected) dashed var(--femo-primary-glow-x)",
                  background: "var(--femo-primary-soft-faint)",
                  pointerEvents: "none",
                  zIndex: 150,
                  animation: "dropHintIn 0.22s ease-out"
                } }),
                /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: {
                  position: "absolute",
                  top: 18,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--femo-primary-overlay)",
                  color: "var(--femo-on-accent)",
                  padding: "3px 11px",
                  borderRadius: "var(--femo-radius-md)",
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  pointerEvents: "none",
                  zIndex: 151,
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 14px var(--femo-primary-glow-strong)",
                  animation: "dropHintIn 0.25s ease-out"
                }, children: "\u677E\u624B\u653E\u7F6E\u5230\u753B\u5E03" })
              ] }),
              dragReady && (() => {
                const n = nodes.find((nd) => nd.id === dragReady);
                if (!n) return null;
                const { w, h } = { w: 200, h: 80 };
                const cx = (n.x + w / 2) * scale + pan.x;
                const cy = (n.y + h / 2) * scale + pan.y;
                return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: {
                  position: "absolute",
                  left: cx - 28,
                  top: cy - 28,
                  width: 56,
                  height: 56,
                  borderRadius: "var(--femo-radius-pill)",
                  border: "var(--femo-border-w-selected) solid var(--femo-primary-glow-x)",
                  boxShadow: "0 0 12px 4px var(--femo-primary-glow)",
                  pointerEvents: "none",
                  zIndex: 200,
                  animation: "pulse 0.6s ease-out"
                } });
              })()
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          "div",
          {
            ref: ghostRef,
            style: {
              display: "none",
              position: "fixed",
              background: "var(--femo-primary-overlay)",
              color: "var(--femo-on-accent)",
              borderRadius: "var(--femo-radius-md)",
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              pointerEvents: "none",
              zIndex: 999,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 16px var(--femo-primary-glow-strong)"
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { ref: ghostLabelRef })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          MobileBottomPanel,
          {
            activeTab: bottomTab,
            onTabChange: setBottomTab,
            lib,
            mode,
            locationPath,
            allNames,
            onNew,
            onAdd,
            onAddModule,
            onAddSpecial,
            onAddPosition,
            onEdit,
            onEditModule,
            onDragStart,
            onPanelTouchStart: handlePanelTouchStart,
            onLibTouchMove: handleLibTouchMove,
            onLibTouchEnd: handleLibTouchEnd,
            onLibTouchCancel: handleLibTouchCancel,
            libArmedKey,
            onSelectLib: (type, id) => {
              onSelectLib?.(type, id);
              setBottomTab("props");
            },
            onNewModule,
            proj,
            actorNames,
            onProjChange,
            sel,
            selNode,
            selEdge,
            selAction,
            nodes,
            edges,
            backEdges,
            nodeStates,
            actionStore,
            onDeleteNode,
            onDeleteEdge,
            onCondChange,
            onEditAction,
            onEnterModuleNode,
            libSel,
            themeName,
            onCycleTheme,
            onOpenSoul,
            debugLog,
            onClearDebug,
            compilerLog,
            onClearCompiler,
            femogenLog,
            onClearFemogen,
            hostLog,
            onClearHost,
            onCompileDebug,
            compilingDebug,
            htmlDraggable: false
          }
        ),
        femoVisible && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            "div",
            {
              onClick: () => setFemoVisible(false),
              style: { position: "fixed", inset: 0, background: "var(--femo-mask)", zIndex: 300 }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { style: {
            position: "fixed",
            right: 0,
            top: 0,
            bottom: 0,
            width: "88vw",
            maxWidth: 460,
            background: "var(--femo-mobile-bg-2)",
            borderLeft: `var(--femo-border-w) solid ${T.border}`,
            zIndex: 301,
            display: "flex",
            flexDirection: "column",
            animation: "slideInFemo 0.22s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: "-8px 0 32px var(--femo-mask)"
          }, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
            FemoPreview,
            {
              value: femoText,
              onChange: onFemoChange,
              error: femoError,
              warnings: FEMOrnings,
              dirty: femoDirty,
              onApply: onApplyFemo,
              onRestore: onRestoreFemo,
              onGraphToFemo
            }
          ) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          BubbleOverlay,
          {
            bubbleOverlay,
            nodes,
            nodeStates,
            humanWaits,
            actionStore,
            onClose: onBubbleClose,
            submitHumanInput
          }
        )
      ]
    }
  );
}
var sectionLabel = {
  fontSize: 9.5,
  fontWeight: 800,
  color: T.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontFamily: "var(--femo-font-sans)"
};
var mobSettingBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 6px",
  minHeight: 32,
  boxSizing: "border-box",
  borderRadius: "var(--femo-radius-md)",
  fontSize: 11.5,
  fontWeight: 600,
  fontFamily: "var(--femo-font-sans)",
  cursor: "pointer",
  border: "var(--femo-border-w) solid var(--femo-border-strong)",
  background: "var(--femo-bg)",
  color: "var(--femo-text-2)",
  flex: 1,
  minWidth: 0,
  position: "relative",
  whiteSpace: "nowrap",
  overflow: "hidden"
};
var mobSettingBtnText = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0
};
var fieldLabel = {
  fontSize: 10,
  fontWeight: 700,
  color: T.textSecondary,
  marginBottom: 4
};
var mobInp = {
  width: "100%",
  padding: "6px 9px",
  borderRadius: "var(--femo-radius-sm)",
  border: `var(--femo-border-w-strong) solid ${T.border}`,
  fontSize: 11.5,
  color: T.textPrimary,
  background: "var(--femo-mobile-bg)",
  outline: "none",
  fontFamily: "var(--femo-font-sans)",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
  touchAction: "auto",
  userSelect: "text",
  WebkitUserSelect: "text"
};
var mobBtnP = {
  padding: "6px 14px",
  borderRadius: "var(--femo-radius-sm)",
  background: "var(--femo-btn-primary)",
  color: "var(--femo-on-accent)",
  border: "none",
  cursor: "pointer",
  fontSize: 11.5,
  fontWeight: 700,
  fontFamily: "var(--femo-font-sans)"
};
var mobBtnS = {
  padding: "5px 12px",
  borderRadius: "var(--femo-radius-sm)",
  background: "transparent",
  color: T.textSecondary,
  border: `var(--femo-border-w-strong) solid ${T.border}`,
  cursor: "pointer",
  fontSize: 11.5,
  fontWeight: 600,
  fontFamily: "var(--femo-font-sans)"
};
var mobBtnDanger = {
  padding: "6px 14px",
  borderRadius: "var(--femo-radius-sm)",
  background: "transparent",
  color: T.danger,
  border: `var(--femo-border-w-strong) solid ${T.danger}44`,
  cursor: "pointer",
  fontSize: 11.5,
  fontWeight: 700,
  fontFamily: "var(--femo-font-sans)"
};
function useMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = (0, import_react20.useState)(() => window.innerWidth < breakpoint);
  (0, import_react20.useEffect)(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

// ../../femoGen/src/FemoWorAuto.jsx
var import_jsx_runtime20 = require("react/jsx-runtime");
installFemoLogCapture();
var TOOL_CHIP_TONES = {
  success: { bg: "var(--femo-success)", fg: "var(--femo-on-accent)", border: "var(--femo-success)" },
  danger: { bg: "var(--femo-danger, #d24b4b)", fg: "var(--femo-on-accent)", border: "var(--femo-danger, #d24b4b)" },
  warning: { bg: "var(--femo-surface)", fg: "var(--femo-warning-strong, #dd8629)", border: "var(--femo-warning-border, #f7ad31)" },
  neutral: { bg: "var(--femo-surface)", fg: "var(--femo-text-2)", border: "var(--femo-border-strong)" }
};
function ToolChip({ icon: Icon, children, onClick, tone = "neutral", title, disabled = false }) {
  const t = TOOL_CHIP_TONES[tone] || TOOL_CHIP_TONES.neutral;
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
    "button",
    {
      onClick: disabled ? void 0 : onClick,
      disabled,
      title,
      className: "femo-setting-btn",
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 30,
        boxSizing: "border-box",
        padding: "0 12px",
        borderRadius: "var(--femo-radius-md)",
        border: `var(--femo-border-w-strong) solid ${t.border}`,
        background: t.bg,
        color: t.fg,
        fontSize: 11.5,
        fontWeight: 600,
        fontFamily: "var(--femo-font-sans)",
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        transition: "filter 0.12s, opacity 0.12s"
      },
      children: [
        Icon ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Icon, { size: 12, style: { flexShrink: 0 } }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { children })
      ]
    }
  );
}
var SHIMMER_LAYERS = [
  { len: 16, op: 1, delay: 0 },
  { len: 28, op: 0.5, delay: -3.0667 },
  { len: 40, op: 0.28, delay: -2.9333 },
  { len: 52, op: 0.16, delay: -2.8 },
  { len: 64, op: 0.08, delay: -2.6667 },
  { len: 76, op: 0.04, delay: -2.5333 }
];
function EdgeShimmer({ d, w }) {
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("g", { className: "femo-edge-comet", style: { pointerEvents: "none" }, children: SHIMMER_LAYERS.map((L, i) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
    "path",
    {
      d,
      fill: "none",
      stroke: "var(--femo-edge-sheen)",
      strokeLinecap: "round",
      strokeOpacity: L.op,
      strokeWidth: w || 1,
      className: "femo-edge-comet-layer",
      style: { strokeDasharray: `${L.len} ${288 - L.len}`, animationDelay: `${L.delay}s` }
    },
    i
  )) });
}
function getBackendHost() {
  try {
    return sessionStorage.getItem("femo_backend_host") || localStorage.getItem("femo_backend_host") || "http://localhost";
  } catch {
    return "http://localhost";
  }
}
function getBackendPort() {
  try {
    return sessionStorage.getItem("femo_backend_port") || "8000";
  } catch {
    return "8000";
  }
}
function getBackendBaseUrl() {
  const host = getBackendHost().replace(/\/+$/, "");
  const port = getBackendPort();
  return `${host}:${port}`;
}
function debugRecToLine(rec) {
  switch (rec.kind) {
    case "run_start":
      return { level: "info", kind: "\u8C03\u8BD5", text: `\u25B6 \u7B2C ${rec.run ?? "-"} \u8F6E\u5E72\u8DD1\u5F00\u59CB\uFF1A${rec.script || "\uFF08\u672A\u547D\u540D\uFF09"}${rec.module ? `\uFF08module ${rec.module}\uFF09` : ""}\uFF08seed=${rec.seed ?? "-"}\uFF09` };
    case "node_start":
      return { level: "info", kind: "\u8C03\u8BD5", text: `\u2192 ${rec.node}${rec.node_type ? `\uFF08${rec.node_type}\uFF09` : ""}` };
    case "action_outs": {
      const exprs = (rec.exprs || []).join("\uFF0C");
      if (!exprs) return null;
      return rec.node_type === "func" ? { level: "info", kind: "\u8C03\u8BD5", text: `\u{1F527} ${rec.node} \u5199\u56DE\uFF1A${exprs}` } : { level: "info", kind: "\u8C03\u8BD5", text: `\u{1F4DD} ${rec.node} \u8D4B\u503C\uFF1A${exprs}` };
    }
    case "func_result": {
      const out = rec.output === null || rec.output === void 0 ? "" : typeof rec.output === "object" ? JSON.stringify(rec.output) : String(rec.output);
      if (!out) return null;
      let ins = "";
      try {
        const keys = Object.keys(rec.func_input || {});
        if (keys.length > 0) ins = `\uFF08\u5165\u53C2 ${keys.map((k) => `${k}=${JSON.stringify(rec.func_input[k])}`).join("\uFF0C")}\uFF09`;
      } catch {
      }
      return { level: "info", kind: "\u8C03\u8BD5", text: `\u{1F527} ${rec.node} \u51FD\u6570\u8FD4\u56DE\uFF1A${out.slice(0, 300)}${ins}` };
    }
    case "assign":
      return { level: "info", kind: "\u8C03\u8BD5", text: `${rec.node}  ${rec.var}: ${rec.old} \u2192 ${rec.new}` };
    case "ai_reply": {
      const entries = Object.entries(rec.values || {});
      if (entries.length === 0) return null;
      return { level: "info", kind: "\u8C03\u8BD5", text: `\u{1F916} ${rec.node} \u5408\u6210\u8D4B\u503C\uFF1A${entries.map(([k, v]) => `${k}=${v?.value}\uFF08${v?.source}\uFF09`).join("\uFF0C")}` };
    }
    case "human_input": {
      const parts = Object.entries(rec.variables || {}).map(([k, v]) => `${k}=${v}`);
      if (parts.length === 0) return null;
      return { level: "info", kind: "\u8C03\u8BD5", text: `\u{1F464} ${rec.node} \u5408\u6210\u8F93\u5165\uFF1A${parts.join("\uFF0C")}` };
    }
    case "retry":
      return { level: "warn", kind: "\u8C03\u8BD5", text: `\u{1F501} ${rec.node} \u91CD\u8BD5\u6362\u503C\uFF1A${String(rec.feedback || "").slice(0, 160)}` };
    case "silence":
      return { level: "warn", kind: "\u8C03\u8BD5", text: `\u{1F3B2} ${rec.node} \u6982\u7387\u6C89\u9ED8\uFF08\u4E0D\u8D4B\u503C ${rec.var}\uFF09` };
    case "flaky":
      return { level: "warn", kind: "\u8C03\u8BD5", text: `\u{1F4A5} ${rec.node} \u6CE8\u5165\u65E0\u6548\u8D4B\u503C\uFF08\u6D4B\u91CD\u8BD5\u94FE\u8DEF\uFF09` };
    case "warning":
      return { level: "warn", kind: "\u8C03\u8BD5", text: `\u26A0 ${rec.msg || ""}` };
    case "flow_outcome":
      return null;
    // run_end 已带结局，不重复
    case "run_end":
      return {
        // max_steps=跑满步数预算未停——可能是无限循环/持续循环型，非错误
        // （2026-09-12 口径）：warn 级不上红，模块单测里这是常见预期结局。
        level: rec.outcome === "completed" ? "info" : rec.outcome === "max_steps" ? "warn" : "error",
        kind: "\u8C03\u8BD5",
        text: `\u25A0 \u7B2C ${rec.run ?? "-"} \u8F6E\u7ED3\u675F\uFF1A${rec.outcome}${rec.outcome === "max_steps" ? "\uFF08\u53EF\u80FD\u662F\u65E0\u9650\u5FAA\u73AF\uFF0C\u975E\u9519\u8BEF\uFF09" : ""}${rec.error ? ` \u2014 ${String(rec.error).slice(0, 200)}` : ""}\uFF08${rec.elapsed ?? "?"}s\uFF09`
      };
    case "debug_done":
      return null;
    // 退出码语义=「是否全部轮 completed」，run_end 已如实呈现；
    // 真崩溃（无任何 run_end）由 handleDebugRun 流内补报
    case "debug_error":
      return { level: "error", kind: "\u8C03\u8BD5", text: String(rec.error || "") };
    default:
      return null;
  }
}
function structuralSignature(nodes, edges) {
  const ns = (nodes || []).map((n) => {
    const c = { ...n };
    delete c.x;
    delete c.y;
    delete c.selected;
    delete c.dragging;
    delete c.width;
    delete c.height;
    return JSON.stringify(c);
  }).sort();
  const es = (edges || []).map((e) => {
    const c = { ...e };
    delete c.selected;
    delete c.dragging;
    return JSON.stringify(c);
  }).sort();
  return JSON.stringify({ ns, es });
}
function summarizeDebugEvent(type, data) {
  const d = data || {};
  const node = d.node_name ? `[${d.node_name}] ` : "";
  switch (type) {
    case "flow_start":
      return { level: "info", text: `${node}\u5267\u672C\u5F00\u59CB\u8FD0\u884C` };
    case "flow_done":
      return { level: "info", text: "\u5267\u672C\u8FD0\u884C\u5B8C\u6210" };
    case "flow_paused":
      return { level: "info", text: "\u5267\u672C\u5DF2\u6682\u505C" };
    case "flow_error":
      return { level: "error", text: `${node}${d.error || "\u672A\u77E5\u9519\u8BEF"}` };
    case "notify_author": {
      const sev = d.severity || d.level;
      const lv = sev === "fatal" || sev === "agent_error" || sev === "agent_giveup" ? "error" : sev === "warning" || sev === "warn" ? "warn" : "info";
      return { level: lv, text: `${node}${d.message || "\uFF08\u4F5C\u8005\u901A\u77E5\uFF09"}` };
    }
    case "compile_warnings": {
      const ws = Array.isArray(d.warnings) ? d.warnings : [];
      if (ws.length === 0) return null;
      return ws.map((w) => ({
        level: "warn",
        text: `\u7F16\u8BD1\u8B66\u544A${w?.where ? `\uFF08${w.where}\uFF09` : ""}\uFF1A${w?.message ?? ""}`
      }));
    }
    case "ai_retry":
      return {
        level: "warn",
        text: `${node}AI \u8F93\u51FA\u672A\u8FC7\u6821\u9A8C\uFF0C\u7B2C ${d.attempt ?? "?"} \u6B21\u91CD\u8BD5\uFF1A${Array.isArray(d.errors) ? d.errors.join("; ") : d.errors || ""}`
      };
    case "bridge_run_ended":
      return d?.ok === false ? { level: "error", text: "\u6574\u573A\u8FD0\u884C\u5F02\u5E38\u7EC8\u6B62\uFF08ok=false\uFF09" } : { level: "info", text: "\u6574\u573A\u8FD0\u884C\u7EC8\u6B62" };
    case "node_start":
      return { level: "info", text: `${node}\u8282\u70B9\u5F00\u59CB` };
    case "ai_done":
      return { level: "info", text: `${node}AI \u56DE\u7B54\u5B8C\u6210` };
    case "human_wait":
      return { level: "info", text: `${node}\u7B49\u5F85\u4EBA\u7C7B\u8F93\u5165` };
    case "human_done":
      return { level: "info", text: `${node}\u4EBA\u7C7B\u8F93\u5165\u5DF2\u63D0\u4EA4` };
    case "node_retry":
      return { level: "warn", text: `${node}${d.message || d.error || "\u8282\u70B9\u91CD\u8BD5"}` };
    case "context_ready":
      return { level: "info", text: `${node}\u4E0A\u4E0B\u6587\u5C31\u7EEA` };
    case "func_result":
      return { level: "info", text: `${node}@func \u8FD4\u56DE` };
    case "assign_result": {
      const outs = d.output && typeof d.output === "object" && !Array.isArray(d.output) ? Object.entries(d.output) : [];
      const fmtVal = (v) => typeof v === "string" ? v : JSON.stringify(v);
      const tail = outs.length > 0 ? `\uFF1A${outs.map(([k, v]) => `${k} = ${String(fmtVal(v)).slice(0, 120)}`).join("\uFF1B")}` : "";
      return { level: "info", text: `${node}\u8D4B\u503C\u5B8C\u6210${tail}` };
    }
    case "notice_done":
      return { level: "info", text: `${node}\u516C\u544A\u5DF2\u6CE8\u5165` };
    case "module_enter":
      return { level: "info", text: `\u8FDB\u5165\u6A21\u5757 ${d.module_name || "?"}` };
    case "module_exit":
      return { level: "info", text: `\u9000\u51FA\u6A21\u5757 ${d.module_name || "?"}` };
    case "run_state":
      return { level: d.state === "failed" ? "warn" : "info", text: `\u8FD0\u884C\u72B6\u6001 \u2192 ${d.state || "?"}` };
    case "done":
      return { level: "info", text: "SSE \u6D41\u7ED3\u675F" };
    // 引擎内部信号/状态同步帧：高频且无叙事价值，喂进日志只会刷屏淹没报错
    // （checkpoint 每节点一帧全量变量世界、projection_state 每次状态变化、
    // node_settled 停靠经纪人信号、script_changed 存稿同步）——不喂。
    case "checkpoint":
    case "node_settled":
    case "projection_state":
    case "script_changed":
      return null;
    default:
      return {
        level: "info",
        text: node + (d.error || d.message || JSON.stringify(d).slice(0, 200))
      };
  }
}
var isCatchUpFrame = (evt) => evt?._replayed === true || evt?.replay === true;
var mainCheckpointLabel = (checkpoint) => {
  if (!checkpoint || typeof checkpoint !== "object") return null;
  const main = checkpoint["__main__"];
  if (typeof main === "string" && main.length > 0) return main;
  const first = Object.values(checkpoint)[0];
  return typeof first === "string" && first.length > 0 ? first : null;
};
var FEMOEditor = (0, import_react21.forwardRef)(function FEMOEditor2({ plugin = false, onRun, onPause, initialScript, initialCheckpoint, initialRunning = false, onExport, onImport, onListFemoFiles, onPickFemoFile, onForgetFemoFile, savedPath, onBackToShell, onRestoreError, onPersistScript, getRecordScript, sessionId = "", enginePending = false, initialJobId, jobIds, initialWaitingHuman, initialLastError } = {}, ref) {
  const [themeSel, setThemeSel] = (0, import_react21.useState)(() => {
    try {
      const saved = localStorage.getItem("femo_theme");
      return FEMO_THEMES.some((t) => t.id === saved) ? saved : "auto";
    } catch {
      return "auto";
    }
  });
  const [dsDark, setDsDark] = (0, import_react21.useState)(
    () => document.body?.hasAttribute("data-ds-dark-theme") ?? false
  );
  (0, import_react21.useEffect)(() => {
    const obs = new MutationObserver(() => {
      setDsDark(document.body?.hasAttribute("data-ds-dark-theme") ?? false);
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    return () => obs.disconnect();
  }, []);
  const theme = themeSel === "auto" ? dsDark ? "dsh-dark" : "dsh" : themeSel;
  const cycleTheme = () => {
    const idx = FEMO_THEMES.findIndex((t) => t.id === themeSel);
    const next = FEMO_THEMES[(idx + 1) % FEMO_THEMES.length].id;
    setThemeSel(next);
    try {
      localStorage.setItem("femo_theme", next);
    } catch {
    }
  };
  const [locationPath, setLocationPath] = (0, import_react21.useState)(["mainflow"]);
  const mode = locationPath.length === 1 && locationPath[0] === "mainflow" ? "mainflow" : "module";
  const currentModuleName = locationPath.length > 1 ? locationPath[locationPath.length - 1] : null;
  const [nodes, setNodes] = (0, import_react21.useState)(makeDefaultNodes("mainflow"));
  const nodesRef = (0, import_react21.useRef)(nodes);
  nodesRef.current = nodes;
  const [edges, setEdges] = (0, import_react21.useState)([]);
  const edgesRef = (0, import_react21.useRef)(edges);
  edgesRef.current = edges;
  const [actionStore, setActionStore] = (0, import_react21.useState)([]);
  const [moduleStore, setModuleStore] = (0, import_react21.useState)([]);
  const [flowStore, setFlowStore] = (0, import_react21.useState)([]);
  const [sel, setSel] = (0, import_react21.useState)(null);
  const [drag, setDrag] = (0, import_react21.useState)(null);
  const [conn, setConn] = (0, import_react21.useState)(null);
  const [modal, setModal] = (0, import_react21.useState)(null);
  const [tab, setTab] = (0, import_react21.useState)("library");
  const [proj, setProj] = (0, import_react21.useState)({
    name: "\u65B0\u7BC7\u7AE0-Neon",
    version: "1.0",
    owner: "1",
    database: "chronica.wor",
    session: "new",
    system_safety: "",
    output_style: "",
    code: [],
    actors: []
  });
  const [pan, setPan] = (0, import_react21.useState)({ x: 0, y: 0 });
  const [scale, setScale] = (0, import_react21.useState)(1);
  const [rightPanelWidth, setRightPanelWidth] = (0, import_react21.useState)(274);
  const [isResizingRight, setIsResizingRight] = (0, import_react21.useState)(false);
  const [spaceHeld, setSpaceHeld] = (0, import_react21.useState)(false);
  const [isPanning, setIsPanning] = (0, import_react21.useState)(false);
  const mouseDownPos = (0, import_react21.useRef)({ x: 0, y: 0 });
  const mouseDownPosRef = (0, import_react21.useRef)({ x: 0, y: 0 });
  const isMouseDownRef = (0, import_react21.useRef)(false);
  const isDraggingRef = (0, import_react21.useRef)(false);
  const [panStart, setPanStart] = (0, import_react21.useState)({ x: 0, y: 0, px: 0, py: 0 });
  const dragRef = (0, import_react21.useRef)(drag);
  const connRef = (0, import_react21.useRef)(conn);
  const isPanningRef = (0, import_react21.useRef)(isPanning);
  (0, import_react21.useEffect)(() => {
    dragRef.current = drag;
  }, [drag]);
  (0, import_react21.useEffect)(() => {
    connRef.current = conn;
  }, [conn]);
  (0, import_react21.useEffect)(() => {
    isPanningRef.current = isPanning;
  }, [isPanning]);
  (0, import_react21.useEffect)(() => {
    const handler = (e) => {
      if (dragRef.current || connRef.current || isPanningRef.current) {
        setDrag(null);
        setConn(null);
        setIsPanning(false);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("mousedown", handler, true);
    return () => window.removeEventListener("mousedown", handler, true);
  }, []);
  const [femoText, setFemoText] = (0, import_react21.useState)("");
  const [femoDirty, setFemoDirty] = (0, import_react21.useState)(false);
  const [graphDirty, setGraphDirty] = (0, import_react21.useState)(false);
  const lastSyncedGraphRef = (0, import_react21.useRef)("");
  const [runGuard, setRunGuard] = (0, import_react21.useState)(null);
  const skipRunGuardRef = (0, import_react21.useRef)(false);
  const [lastValidFemo, setLastValidFemo] = (0, import_react21.useState)("");
  const [femoError, setFemoError] = (0, import_react21.useState)(null);
  const [FEMOrnings, setFEMOrnings] = (0, import_react21.useState)([]);
  const [debugOpen, setDebugOpen] = (0, import_react21.useState)(false);
  const [debugLog, setDebugLog] = (0, import_react21.useState)([]);
  const debugSeqRef = (0, import_react21.useRef)(0);
  const pushDebug = (0, import_react21.useCallback)((level, kind, text) => {
    setDebugLog((prev) => {
      const entry = {
        id: ++debugSeqRef.current,
        ts: Date.now(),
        level,
        kind,
        text: String(text ?? "").slice(0, 600)
      };
      const next = [entry, ...prev];
      return next.length > 200 ? next.slice(0, 200) : next;
    });
  }, []);
  const [compilerLog, setCompilerLog] = (0, import_react21.useState)([]);
  const compilerSeqRef = (0, import_react21.useRef)(0);
  const [hostLog, setHostLog] = (0, import_react21.useState)([]);
  const hostSeqRef = (0, import_react21.useRef)(0);
  const appendDiagLine = (0, import_react21.useCallback)((setList, seqRef, msg, ts) => {
    setList((prev) => {
      const entry = {
        id: ++seqRef.current,
        ts: Number.isFinite(ts) ? ts : Date.now(),
        text: String(msg ?? "").slice(0, 400)
        // 与宿主侧截断口径一致
      };
      const next = [entry, ...prev];
      return next.length > 300 ? next.slice(0, 300) : next;
    });
  }, []);
  const pushCompilerLine = (0, import_react21.useCallback)(
    (msg, ts) => appendDiagLine(setCompilerLog, compilerSeqRef, msg, ts),
    [appendDiagLine]
  );
  const pushHostLine = (0, import_react21.useCallback)(
    (msg, ts) => appendDiagLine(setHostLog, hostSeqRef, msg, ts),
    [appendDiagLine]
  );
  const handleDiagFeed = (0, import_react21.useCallback)((d) => {
    if (!d) return;
    const ts = Date.parse(d.ts);
    if (d.tag === "engine") pushCompilerLine(d.msg, ts);
    else if (d.tag === "host") pushHostLine(d.msg, ts);
  }, [pushCompilerLine, pushHostLine]);
  (0, import_react21.useEffect)(() => {
    if (!debugOpen || !plugin) return void 0;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/femo-plugin/diag-tail?n=400");
        const data = await resp.json().catch(() => null);
        if (cancelled || !data || data.ok !== true || !Array.isArray(data.lines)) return;
        const seed = (setList, seqRef, tag) => {
          const rows = data.lines.filter((l) => l && l.tag === tag);
          if (rows.length === 0) return;
          setList((prev) => {
            const seen = new Set(prev.map((e) => `${e.ts}|${e.text}`));
            const hist = rows.map((l) => ({
              ts: Date.parse(l.ts) || Date.now(),
              text: String(l.msg ?? "").slice(0, 400)
            })).filter((h) => !seen.has(`${h.ts}|${h.text}`));
            if (hist.length === 0) return prev;
            hist.reverse();
            const next = [...hist.map((h) => ({ id: ++seqRef.current, ...h })), ...prev];
            return next.length > 300 ? next.slice(0, 300) : next;
          });
        };
        seed(setCompilerLog, compilerSeqRef, "engine");
        seed(setHostLog, hostSeqRef, "host");
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debugOpen, plugin]);
  const [femogenLog, setFemogenLog] = (0, import_react21.useState)(() => femoLogTail(200).slice().reverse());
  (0, import_react21.useEffect)(() => subscribeFemoLog((batch) => {
    setFemogenLog((prev) => {
      const next = [...batch.slice().reverse(), ...prev];
      return next.length > 400 ? next.slice(0, 400) : next;
    });
  }), []);
  const clearFemogenLog = (0, import_react21.useCallback)(() => {
    clearFemoLog();
    setFemogenLog([]);
  }, []);
  const [bubbleOverlay, setBubbleOverlay] = (0, import_react21.useState)(null);
  const bubbleOverlayRef = (0, import_react21.useRef)(bubbleOverlay);
  bubbleOverlayRef.current = bubbleOverlay;
  const [humanWaits, setHumanWaits] = (0, import_react21.useState)({});
  const humanWaitsRef = (0, import_react21.useRef)({});
  const setHumanWaitsBoth = (0, import_react21.useCallback)((updater) => {
    setHumanWaits((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      humanWaitsRef.current = next;
      return next;
    });
  }, []);
  const [libSel, setLibSel] = (0, import_react21.useState)(null);
  const [exportBusy, setExportBusy] = (0, import_react21.useState)(false);
  const [exportToast, setExportToast] = (0, import_react21.useState)(null);
  const exportToastTimerRef = (0, import_react21.useRef)(null);
  const showExportToast = (0, import_react21.useCallback)((text) => {
    if (exportToastTimerRef.current) clearTimeout(exportToastTimerRef.current);
    setExportToast({ text, id: Date.now() });
    pushDebug("info", "\u5BFC\u51FA", text);
    exportToastTimerRef.current = setTimeout(() => {
      setExportToast(null);
      exportToastTimerRef.current = null;
    }, 4e3);
  }, [pushDebug]);
  const [pauseNotice, setStopNotice] = (0, import_react21.useState)(null);
  const pauseNoticeTimerRef = (0, import_react21.useRef)(null);
  const pauseConfirmTimerRef = (0, import_react21.useRef)(null);
  const showPauseNotice = (0, import_react21.useCallback)((level, text) => {
    if (pauseNoticeTimerRef.current) clearTimeout(pauseNoticeTimerRef.current);
    setStopNotice({ level, text, id: Date.now() });
    pushDebug(level === "error" ? "error" : "warn", "\u6682\u505C", text);
    pauseNoticeTimerRef.current = setTimeout(() => {
      setStopNotice(null);
      pauseNoticeTimerRef.current = null;
    }, 8e3);
  }, [pushDebug]);
  const clearPauseConfirmTimer = (0, import_react21.useCallback)(() => {
    if (pauseConfirmTimerRef.current) {
      clearTimeout(pauseConfirmTimerRef.current);
      pauseConfirmTimerRef.current = null;
    }
  }, []);
  (0, import_react21.useEffect)(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRight) return;
      const rootR = editorRootRef.current?.getBoundingClientRect();
      const rz = effectiveZoom(editorRootRef.current, rootR || void 0);
      const newWidth = ((rootR ? rootR.right : window.innerWidth) - e.clientX) / rz;
      if (newWidth >= 200 && newWidth <= 500) {
        setRightPanelWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizingRight(false);
    if (isResizingRight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingRight]);
  const [flowStatus, setFlowStatus] = (0, import_react21.useState)("idle");
  const flowStatusRef = (0, import_react21.useRef)(flowStatus);
  flowStatusRef.current = flowStatus;
  const [activeNodeIds, setActiveNodeIds] = (0, import_react21.useState)(/* @__PURE__ */ new Set());
  const [errorNodeIds, setErrorNodeIds] = (0, import_react21.useState)(/* @__PURE__ */ new Set());
  const [userApiKey, setUserApiKey] = (0, import_react21.useState)(() => {
    try {
      return localStorage.getItem("femo_user_api_key") || "";
    } catch {
      return "";
    }
  });
  const [userApiProvider, setUserApiProvider] = (0, import_react21.useState)(() => {
    try {
      return localStorage.getItem("femo_user_api_provider") || "mimo";
    } catch {
      return "mimo";
    }
  });
  const [userApiUrl, setUserApiUrl] = (0, import_react21.useState)(() => {
    try {
      return localStorage.getItem("femo_user_api_url") || "";
    } catch {
      return "";
    }
  });
  const [userApiModel, setUserApiModel] = (0, import_react21.useState)(() => {
    try {
      return localStorage.getItem("femo_user_api_model") || "";
    } catch {
      return "";
    }
  });
  const [apiModelInput, setApiModelInput] = (0, import_react21.useState)(userApiModel);
  const [runId, setRunId] = (0, import_react21.useState)(null);
  const [pluginJobId, setPluginJobId] = (0, import_react21.useState)(initialJobId ?? null);
  (0, import_react21.useEffect)(() => {
    if (initialJobId !== void 0 && initialJobId !== null) setPluginJobId(initialJobId);
  }, [initialJobId]);
  const [nodeStates, setNodeStates] = (0, import_react21.useState)({});
  const eventSourceRef = (0, import_react21.useRef)(null);
  const humanInputResolveRef = (0, import_react21.useRef)(null);
  const lastActionAtRef = (0, import_react21.useRef)(0);
  const [soulModalOpen, setSoulModalOpen] = (0, import_react21.useState)(false);
  const [soulForm, setSoulForm] = (0, import_react21.useState)({ soul_id: "", soul_name: "", description: "" });
  const [soulFormError, setSoulFormError] = (0, import_react21.useState)("");
  const [soulFormSubmitting, setSoulFormSubmitting] = (0, import_react21.useState)(false);
  const fileInputRef = (0, import_react21.useRef)(null);
  const [femoFileOpen, setFemoFileOpen] = (0, import_react21.useState)(false);
  const [femoFileList, setFemoFileList] = (0, import_react21.useState)([]);
  const [femoFileLoading, setFemoFileLoading] = (0, import_react21.useState)(false);
  const [femoFileError, setFemoFileError] = (0, import_react21.useState)("");
  const [femoFileBusyPath, setFemoFileBusyPath] = (0, import_react21.useState)(null);
  const [femoFileForgetBusy, setFemoFileForgetBusy] = (0, import_react21.useState)(false);
  const cvRef = (0, import_react21.useRef)(null);
  const editorRootRef = (0, import_react21.useRef)(null);
  const moduleStackRef = (0, import_react21.useRef)([]);
  const moduleStoreRef = (0, import_react21.useRef)(moduleStore);
  const locationPathRef = (0, import_react21.useRef)(locationPath);
  const restoreDoneRef = (0, import_react21.useRef)(false);
  const pendingReplayRef = (0, import_react21.useRef)([]);
  const [canvasOpacity, setCanvasOpacity] = (0, import_react21.useState)(1);
  (0, import_react21.useEffect)(() => {
    moduleStoreRef.current = moduleStore;
  }, [moduleStore]);
  (0, import_react21.useEffect)(() => {
    locationPathRef.current = locationPath;
  }, [locationPath]);
  const findModuleByPath = (0, import_react21.useCallback)(
    (path) => {
      if (path.length <= 1) return null;
      return moduleStore.find(
        (m) => m.path && m.path.length === path.length && m.path.every((seg, i) => seg === path[i])
      );
    },
    [moduleStore]
  );
  const visibleActions = (0, import_react21.useMemo)(() => {
    return actionStore.filter((a) => {
      const ap = a.path || [];
      if (ap.length > locationPath.length) return false;
      return ap.every((seg, i) => seg === locationPath[i]);
    });
  }, [actionStore, locationPath]);
  const visibleModules = (0, import_react21.useMemo)(() => {
    const anc = moduleStore.filter((m) => {
      const mp = m.path || [];
      return mp.length < locationPath.length && locationPath.every((seg, i) => seg === mp[i]);
    });
    const daughters = moduleStore.filter((m) => {
      const mp = m.path || [];
      return mp.length === locationPath.length + 1 && locationPath.every((seg, i) => seg === mp[i]);
    });
    const sisters = moduleStore.filter((m) => {
      const mp = m.path || [];
      if (mp.length !== locationPath.length) return false;
      if (mp.length === 0) return false;
      const motherSame = mp.slice(0, -1).every((seg, i) => locationPath[i] === seg);
      const notSelf = !(mp.length === locationPath.length && mp.every((seg, i) => seg === locationPath[i]));
      return motherSame && notSelf;
    });
    return [.../* @__PURE__ */ new Set([...anc, ...daughters, ...sisters])];
  }, [moduleStore, locationPath]);
  const lib = (0, import_react21.useMemo)(
    () => ({
      actions: visibleActions,
      modules: visibleModules
    }),
    [visibleActions, visibleModules]
  );
  const currentFlow = (0, import_react21.useMemo)(() => {
    return flowStore.find((f) => {
      const fp = f.path || [];
      return fp.length === locationPath.length && fp.every((seg, i) => seg === locationPath[i]);
    });
  }, [flowStore, locationPath]);
  const flowStoreRef = (0, import_react21.useRef)(flowStore);
  (0, import_react21.useEffect)(() => {
    flowStoreRef.current = flowStore;
  }, [flowStore]);
  const saveAndNavigateRef = (0, import_react21.useRef)(null);
  saveAndNavigateRef.current = (targetPath) => {
    const currentPath = locationPathRef.current;
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    setFlowStore((prev) => {
      const idx = prev.findIndex(
        (f) => f.path?.length === currentPath.length && f.path?.every((s, i) => s === currentPath[i])
      );
      const entry = { path: [...currentPath], nodes: currentNodes, edges: currentEdges };
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = entry;
        return updated;
      }
      return [...prev, entry];
    });
    setLocationPath(
      (prev) => prev.length === targetPath.length && prev.every((s, i) => s === targetPath[i]) ? prev : targetPath
    );
    setCanvasOpacity(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCanvasOpacity(1);
      });
    });
  };
  const nm = (0, import_react21.useMemo)(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const backEdges = (0, import_react21.useMemo)(() => {
    return findBackEdges(nodes, edges);
  }, [nodes, edges]);
  const actionMap = (0, import_react21.useMemo)(() => {
    const map = /* @__PURE__ */ new Map();
    actionStore.forEach((a) => map.set(a.id, a));
    return map;
  }, [actionStore]);
  const sortedEdges = (0, import_react21.useMemo)(() => {
    const forOutNodeIds = new Set(
      nodes.filter((n) => n.type === "for_out" || n.type === "par_out").map((n) => n.id)
    );
    const hasForOut = (edge) => forOutNodeIds.has(edge.src) || forOutNodeIds.has(edge.tgt);
    const normal = [];
    const forOutEdges = [];
    for (const e of edges) {
      if (hasForOut(e)) {
        forOutEdges.push(e);
      } else {
        normal.push(e);
      }
    }
    return [...normal, ...forOutEdges];
  }, [edges, nodes]);
  const diagMissingEdgeCount = (0, import_react21.useMemo)(
    () => sortedEdges.reduce((acc, e) => nm.get(e.src) && nm.get(e.tgt) ? acc : acc + 1, 0),
    [sortedEdges, nm]
  );
  (0, import_react21.useEffect)(() => {
    if (diagMissingEdgeCount > 0) {
      console.log("[femo-diag] RENDER-DROP edges-with-missing-endpoints=" + diagMissingEdgeCount + " / total=" + sortedEdges.length + " nodes=" + nodes.length);
    }
  }, [diagMissingEdgeCount, sortedEdges.length, nodes.length]);
  const cycleEdgesMap = (0, import_react21.useMemo)(() => findAllCycleEdges(nodes, edges), [nodes, edges]);
  const allCycleEdges = (0, import_react21.useMemo)(() => {
    const all = /* @__PURE__ */ new Set();
    for (const edgeSet of cycleEdgesMap.values()) {
      for (const eid2 of edgeSet) all.add(eid2);
    }
    return all;
  }, [cycleEdgesMap]);
  const forBrokenEdges = (0, import_react21.useMemo)(() => {
    const broken = /* @__PURE__ */ new Set();
    const adj = /* @__PURE__ */ new Map();
    edges.forEach((e) => {
      if (!adj.has(e.src)) adj.set(e.src, []);
      adj.get(e.src).push(e);
    });
    const forNodeIds = new Set(
      nodes.filter((n) => n.specialType === "FOR").map((n) => n.id)
    );
    const outNodeIds = new Set(
      nodes.filter((n) => n.type === "for_out" || n.type === "par_out").map((n) => n.id)
    );
    for (const startId of forNodeIds) {
      const stack = [startId];
      const localVisited = /* @__PURE__ */ new Set();
      while (stack.length) {
        const cur = stack.pop();
        for (const e of adj.get(cur) || []) {
          if (localVisited.has(e.id)) continue;
          localVisited.add(e.id);
          if (outNodeIds.has(e.src) || outNodeIds.has(e.tgt)) continue;
          if (allCycleEdges.has(e.id)) continue;
          if (forNodeIds.has(e.tgt)) continue;
          broken.add(e.id);
          stack.push(e.tgt);
        }
      }
    }
    return broken;
  }, [nodes, edges, allCycleEdges]);
  const parNodeIds = (0, import_react21.useMemo)(
    () => new Set(nodes.filter((n) => n.specialType === "PAR").map((n) => n.id)),
    [nodes]
  );
  const parOutNodeMap = (0, import_react21.useMemo)(() => {
    const map = /* @__PURE__ */ new Map();
    nodes.forEach((n) => {
      if (n.type === "par_out" && n.forNodeId) {
        map.set(n.forNodeId, n.id);
      }
    });
    return map;
  }, [nodes]);
  const parCycleEdges = (0, import_react21.useMemo)(() => {
    const valid = /* @__PURE__ */ new Set();
    const adj = /* @__PURE__ */ new Map();
    edges.forEach((e) => {
      if (!adj.has(e.src)) adj.set(e.src, []);
      adj.get(e.src).push(e);
    });
    const nmLocal = new Map(nodes.map((n) => [n.id, n]));
    for (const parId of parNodeIds) {
      let dfs = function(curId) {
        if (recStack.has(curId)) {
          return;
        }
        recStack.add(curId);
        if (curId === targetOutId) {
          path.forEach((eid2) => valid.add(eid2));
          recStack.delete(curId);
          return;
        }
        if (nmLocal.get(curId)?.type === "par_out") {
          recStack.delete(curId);
          return;
        }
        for (const e of adj.get(curId) || []) {
          if (visitedEdges.has(e.id)) continue;
          visitedEdges.add(e.id);
          path.push(e.id);
          if (e.tgt === targetOutId) {
            path.forEach((eid2) => valid.add(eid2));
          } else if (recStack.has(e.tgt)) {
            path.forEach((eid2) => valid.add(eid2));
          } else {
            dfs(e.tgt);
          }
          path.pop();
          visitedEdges.delete(e.id);
        }
        recStack.delete(curId);
      };
      const targetOutId = parOutNodeMap.get(parId);
      if (!targetOutId) {
        console.warn("[parCycleEdges] PAR\u8282\u70B9", parId, "\u65E0\u5BF9\u5E94 par_out, \u8DF3\u8FC7");
        continue;
      }
      const visitedEdges = /* @__PURE__ */ new Set();
      const path = [];
      const recStack = /* @__PURE__ */ new Set();
      dfs(parId);
    }
    return valid;
  }, [nodes, edges, parNodeIds, parOutNodeMap]);
  const parBrokenEdges = (0, import_react21.useMemo)(() => {
    const broken = /* @__PURE__ */ new Set();
    const adj = /* @__PURE__ */ new Map();
    edges.forEach((e) => {
      if (!adj.has(e.src)) adj.set(e.src, []);
      adj.get(e.src).push(e);
    });
    for (const parId of parNodeIds) {
      const targetOutId = parOutNodeMap.get(parId);
      if (!targetOutId) continue;
      const visited = /* @__PURE__ */ new Set();
      const stack = [parId];
      while (stack.length) {
        const cur = stack.pop();
        if (nodes.find((n) => n.id === cur)?.type === "par_out") continue;
        for (const e of adj.get(cur) || []) {
          if (visited.has(e.id)) continue;
          visited.add(e.id);
          if (!parCycleEdges.has(e.id)) {
            broken.add(e.id);
          }
          stack.push(e.tgt);
        }
      }
    }
    return broken;
  }, [nodes, edges, parCycleEdges, parNodeIds, parOutNodeMap]);
  const portEdgeGroupMap = (0, import_react21.useMemo)(() => {
    const groups = {};
    edges.forEach((e) => {
      const s = nm.get(e.src), t = nm.get(e.tgt);
      if (!s || !t) return;
      if (e.src === e.tgt) return;
      const isCycle = allCycleEdges.has(e.id);
      const { srcDir, tgtDir } = getSmartPorts(s, t, isCycle);
      const srcKey = s.type === "for_out" || s.type === "par_out" ? null : `${e.src}:${srcDir}`;
      const tgtKey = t.type === "for_out" || t.type === "par_out" ? null : `${e.tgt}:${tgtDir}`;
      if (srcKey) {
        if (!groups[srcKey]) groups[srcKey] = [];
        groups[srcKey].push(e.id);
      }
      if (tgtKey) {
        if (!groups[tgtKey]) groups[tgtKey] = [];
        groups[tgtKey].push(e.id);
      }
    });
    const result = {};
    for (const key in groups) {
      const edgeIds = groups[key].sort();
      const indices = {};
      edgeIds.forEach((id, idx) => {
        indices[id] = idx;
      });
      result[key] = { edgeIds, indices, count: edgeIds.length };
    }
    return result;
  }, [edges, nodes, allCycleEdges, nm]);
  const hasActiveRunningNodes = (0, import_react21.useMemo)(() => {
    if (flowStatus !== "running") return false;
    for (const id of activeNodeIds) {
      const status = nodeStates[id]?.status;
      if (status && !["ai_done", "human_done", "done", "error"].includes(status)) {
        return true;
      }
    }
    return false;
  }, [flowStatus, activeNodeIds, nodeStates]);
  const allNames = (0, import_react21.useMemo)(() => {
    const names = /* @__PURE__ */ new Set();
    actionStore.forEach((a) => names.add(a.name));
    moduleStore.forEach((m) => names.add(m.name));
    (proj.actors || []).forEach((a) => {
      const n = a.name?.replace("@", "");
      if (n) names.add(n);
    });
    return names;
  }, [actionStore, moduleStore, proj]);
  function effectiveZoom(el, rect) {
    if (!el) return 1;
    const z = el.currentCSSZoom;
    if (typeof z === "number" && isFinite(z) && z > 0) return z;
    const r = rect || el.getBoundingClientRect();
    return r.width && el.offsetWidth ? r.width / el.offsetWidth : 1;
  }
  const xy = (0, import_react21.useCallback)(
    (e) => {
      const r = cvRef.current?.getBoundingClientRect();
      if (!r) return [0, 0];
      const z = effectiveZoom(cvRef.current, r);
      return [
        ((e.clientX - r.left) / z - pan.x) / scale,
        ((e.clientY - r.top) / z - pan.y) / scale
      ];
    },
    [pan, scale]
  );
  const saveToLocalStorage = (0, import_react21.useCallback)(() => {
    try {
      const updatedFlowStore = [...flowStore];
      const idx = updatedFlowStore.findIndex(
        (f) => f.path?.length === locationPath.length && f.path?.every((s, i) => s === locationPath[i])
      );
      const entry = {
        path: [...locationPath],
        nodes: nodesRef.current,
        edges: edgesRef.current
      };
      if (idx >= 0) {
        updatedFlowStore[idx] = entry;
      } else {
        updatedFlowStore.push(entry);
      }
      const state = {
        nodes: nodesRef.current,
        edges: edgesRef.current,
        flowStore: updatedFlowStore,
        locationPath,
        actionStore,
        moduleStore,
        proj
      };
      localStorage.setItem("femo_editor_state", JSON.stringify(state));
      const currentFlow2 = updatedFlowStore.find((f) => f.path.join("/") === locationPath.join("/"));
      const entryNode = currentFlow2?.nodes?.find((n) => n.specialType === "START" || n.specialType === "IN");
    } catch (e) {
      console.warn("\u4FDD\u5B58\u753B\u5E03\u72B6\u6001\u5931\u8D25:", e);
    }
  }, [locationPath, actionStore, moduleStore, proj, flowStore]);
  (0, import_react21.useEffect)(() => {
    const timer = setTimeout(() => {
      saveToLocalStorage();
    }, 10);
    return () => clearTimeout(timer);
  }, [saveToLocalStorage]);
  (0, import_react21.useEffect)(() => {
    if (!plugin) return;
    if (!lastSyncedGraphRef.current) return;
    setGraphDirty(structuralSignature(nodes, edges) !== lastSyncedGraphRef.current);
  }, [plugin, nodes, edges]);
  (0, import_react21.useEffect)(() => {
    if (plugin) return;
    try {
      const saved = localStorage.getItem("femo_editor_state");
      if (saved) {
        const parsed = JSON.parse(saved);
        const flow = parsed.flowStore?.find((f) => f.path?.join?.("/") === parsed.locationPath?.join?.("/"));
        const entryNode = flow?.nodes?.find((n) => n.specialType === "START" || n.specialType === "IN");
        if (parsed.nodes) setNodes(parsed.nodes);
        if (parsed.edges) setEdges(parsed.edges);
        if (parsed.flowStore) setFlowStore(parsed.flowStore);
        if (parsed.locationPath) setLocationPath(parsed.locationPath);
        if (parsed.actionStore) setActionStore(parsed.actionStore);
        if (parsed.moduleStore) setModuleStore(parsed.moduleStore);
        if (parsed.proj) setProj(parsed.proj);
      }
    } catch (e) {
      console.warn("\u52A0\u8F7D\u753B\u5E03\u72B6\u6001\u5931\u8D25:", e);
    }
  }, []);
  (0, import_react21.useEffect)(() => {
    if (!plugin) return;
    try {
      console.log("[femo-diag] restore-effect script=" + (initialScript === void 0 ? "undefined" : String(initialScript.length)) + "ch running=" + String(initialRunning) + " ckpt=" + String(initialCheckpoint ?? "none"));
    } catch {
    }
    if (initialScript && initialScript.trim().length > 0) {
      try {
        applyFEMOText(initialScript);
        setFemoText(initialScript);
        console.log("[FEMOEditor] \u5DF2\u4ECE\u4F1A\u8BDD\u5FEB\u7167\u6062\u590D\u753B\u5E03, \u957F\u5EA6:", initialScript.length);
      } catch (e) {
        console.warn("[FEMOEditor] \u4F1A\u8BDD\u5FEB\u7167\u6062\u590D\u5931\u8D25:", e);
        const msg = e instanceof Error ? e.message : String(e);
        setFemoText(initialScript);
        setFemoError(`\u4F1A\u8BDD\u5FEB\u7167\u6062\u590D\u5931\u8D25\uFF1A${msg}`);
        setFEMOrnings(warningsFromThrowable(e));
        pushDebug("error", "\u6062\u590D", `\u4F1A\u8BDD\u5FEB\u7167\u6062\u590D\u5931\u8D25\uFF1A${msg}`);
        if (typeof onRestoreError === "function") onRestoreError(msg);
      } finally {
        restoreDoneRef.current = true;
      }
    } else {
      restoreDoneRef.current = true;
    }
    if (initialCheckpoint) {
      setFlowStatus("paused");
    }
    if (initialRunning) {
      setFlowStatus("running");
      connectSse();
    }
  }, [plugin, initialScript, initialCheckpoint, initialRunning]);
  const lastErrorSeenRef = (0, import_react21.useRef)(null);
  (0, import_react21.useEffect)(() => {
    if (!plugin || !initialLastError) return;
    if (lastErrorSeenRef.current === initialLastError) return;
    lastErrorSeenRef.current = initialLastError;
    pushDebug("error", "\u6062\u590D", `\u4E0A\u6B21\u8FD0\u884C\u62A5\u9519\uFF08Job ${initialJobId ?? "-"}\uFF09\uFF1A${initialLastError}`);
  }, [plugin, initialLastError]);
  (0, import_react21.useEffect)(() => {
    if (!plugin || !initialCheckpoint) return;
    const target = (nodes || []).find((n) => n.label === initialCheckpoint || "[" + n.label + "]" === initialCheckpoint);
    if (target) setActiveNodeIds(/* @__PURE__ */ new Set([target.id]));
  }, [plugin, initialCheckpoint, nodes]);
  (0, import_react21.useEffect)(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
  (0, import_react21.useEffect)(() => {
    const handleGlobalWheel = (e) => {
      if (cvRef.current?.contains(e.target)) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    document.addEventListener("wheel", handleGlobalWheel, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", handleGlobalWheel, { capture: true });
  }, []);
  (0, import_react21.useEffect)(() => {
    const handleGesture = (e) => {
      if (!cvRef.current?.contains(e.target)) {
        e.preventDefault();
      }
    };
    document.addEventListener("gesturestart", handleGesture);
    document.addEventListener("gesturechange", handleGesture);
    document.addEventListener("gestureend", handleGesture);
    return () => {
      document.removeEventListener("gesturestart", handleGesture);
      document.removeEventListener("gesturechange", handleGesture);
      document.removeEventListener("gestureend", handleGesture);
    };
  }, []);
  (0, import_react21.useEffect)(() => {
    const handleKeyZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key;
        if (key === "-" || key === "+" || key === "=" || key === "0") {
          const tag = e.target.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !e.target.isContentEditable) {
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyZoom, { passive: false, capture: true });
    return () => window.removeEventListener("keydown", handleKeyZoom, { capture: true });
  }, []);
  (0, import_react21.useEffect)(() => {
    const h = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && sel && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        if (sel.type === "node") {
          const node = nm.get(sel.id);
          if (node?.type === "special") {
            const isMandatory = node.specialType === "START" || node.specialType === "IN";
            const sameTypeNodes = nodes.filter((n) => n.type === "special" && n.specialType === node.specialType);
            const isOnlyExit = (node.specialType === "END" || node.specialType === "OUT") && sameTypeNodes.length <= 1;
            if (isMandatory || isOnlyExit) return;
          }
          deleteNode(sel.id);
        } else {
          setEdges((p) => p.filter((e2) => e2.id !== sel.id));
          setSel(null);
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sel, nodes]);
  (0, import_react21.useEffect)(() => {
    const currentFlowStore = flowStoreRef.current;
    const flow = currentFlowStore.find(
      (f) => f.path?.length === locationPath.length && f.path?.every((s, i) => s === locationPath[i])
    );
    if (flow) {
      try {
        console.log("[femo-diag] locpath-load path=" + locationPath.join("/") + " nodes=" + (flow.nodes || []).length + " edges=" + (flow.edges || []).length);
      } catch {
      }
      setNodes(flow.nodes || []);
      setEdges(flow.edges || []);
    } else {
      if (locationPath.length === 1 && locationPath[0] === "mainflow") {
        setNodes(makeDefaultNodes("mainflow"));
        setEdges([]);
      } else {
        setNodes(makeDefaultNodes("module"));
        setEdges([]);
      }
    }
  }, [locationPath]);
  function addNode(action, x, y) {
    const n = nodes.length;
    const id = nid();
    const base = action.name;
    const existingLabels = new Set(nodes.map((node) => node.label));
    let label = `[${base}]`;
    if (existingLabels.has(label)) {
      let cnt = 2;
      while (existingLabels.has(`[${base}_${cnt}]`)) cnt++;
      label = `[${base}_${cnt}]`;
    }
    setNodes((p) => [
      ...p,
      {
        id,
        type: "action",
        actionId: action.id,
        x: x ?? 180 + n % 3 * 240,
        y: y ?? 120 + Math.floor(n / 3) * 140,
        label
      }
    ]);
  }
  function addModuleNode(mod, x, y) {
    const n = nodes.length;
    const id = nid();
    const base = mod.name;
    const existingLabels = new Set(nodes.map((node) => node.label));
    let label = `[${base}]`;
    if (existingLabels.has(label)) {
      let cnt = 2;
      while (existingLabels.has(`[${base}_${cnt}]`)) cnt++;
      label = `[${base}_${cnt}]`;
    }
    setNodes((p) => [
      ...p,
      {
        id,
        type: "module",
        modRef: mod.name,
        modDef: mod,
        x: x ?? 180 + n % 3 * 260,
        y: y ?? 120 + Math.floor(n / 3) * 150,
        label
      }
    ]);
  }
  function addSpecialNode(specialType, x, y) {
    if (specialType === "START" || specialType === "IN") {
      if (nodes.some((n2) => n2.type === "special" && n2.specialType === specialType)) return;
    }
    const n = nodes.filter((nd) => nd.type === "special" && nd.specialType === specialType).length;
    const id = nid();
    const label = n > 0 ? `[${specialType}_${n + 1}]` : `[${specialType}]`;
    const nodeX = x ?? 600;
    const nodeY = y ?? 200 + n * 80;
    if (specialType === "FOR") {
      const outId = nid();
      const outLabel = `${label}_\u51FA`;
      const outX = nodeX + SPW - 22;
      const outY = nodeY + (SPH - 22) / 2;
      setNodes((p) => [
        ...p,
        {
          id,
          type: "special",
          specialType,
          x: nodeX,
          y: nodeY,
          label,
          forOutNodeId: outId,
          forCondition: ""
        },
        {
          id: outId,
          type: "for_out",
          specialType: "FOR_OUT",
          x: outX,
          y: outY,
          label: outLabel,
          forNodeId: id
        }
      ]);
    } else if (specialType === "PAR") {
      const existingLabels = new Set(nodes.map((n2) => n2.label));
      let baseLabel = `[PAR]`;
      let candidateLabel = baseLabel;
      let counter = 2;
      while (existingLabels.has(candidateLabel)) {
        candidateLabel = `[PAR_${counter}]`;
        counter++;
      }
      const finalLabel = candidateLabel;
      const baseName = finalLabel.slice(1, -1);
      const outId = nid();
      const outLabel = `[${baseName}_\u51FA]`;
      const outX = nodeX + 220;
      const outY = nodeY;
      setNodes((p) => [
        ...p,
        {
          id,
          type: "special",
          specialType: "PAR",
          x: nodeX,
          y: nodeY,
          label: finalLabel,
          forOutNodeId: outId,
          forCondition: ""
        },
        {
          id: outId,
          type: "par_out",
          specialType: "PAR_OUT",
          x: outX,
          y: outY,
          label: outLabel,
          forNodeId: id
        }
      ]);
    } else {
      setNodes((p) => [
        ...p,
        {
          id,
          type: "special",
          specialType,
          x: nodeX,
          y: nodeY,
          label
        }
      ]);
    }
  }
  function addPositionNode(x, y) {
    const existingLabels = new Set(nodes.map((n) => n.label));
    let base = "pos";
    let counter = 1;
    let label = `[${base}_${counter}]`;
    while (existingLabels.has(label)) {
      counter++;
      label = `[${base}_${counter}]`;
    }
    const id = nid();
    setNodes((p) => [
      ...p,
      {
        id,
        type: "position",
        x: x ?? 300,
        y: y ?? 150,
        label
      }
    ]);
  }
  const deleteNode = (0, import_react21.useCallback)((nodeId) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    const idsToDelete = /* @__PURE__ */ new Set([nodeId]);
    if ((node.specialType === "FOR" || node.specialType === "PAR") && node.forOutNodeId) {
      idsToDelete.add(node.forOutNodeId);
    } else if (node.type === "for_out" && node.forNodeId) {
      idsToDelete.add(node.forNodeId);
    } else if (node.type === "par_out") {
      return;
    }
    setNodes((p) => p.filter((n) => !idsToDelete.has(n.id)));
    setEdges((p) => p.filter((e) => !idsToDelete.has(e.src) && !idsToDelete.has(e.tgt)));
    setSel(null);
  }, [nodesRef]);
  function handleSelectLib(type, id) {
    setLibSel({ type, id });
    setSel(null);
  }
  const handleBubbleClick = (0, import_react21.useCallback)((nodeId) => {
    setBubbleOverlay({ nodeId });
  }, []);
  const handleBubbleClose = (0, import_react21.useCallback)(() => {
    setBubbleOverlay(null);
  }, []);
  const handleCreateSoul = (0, import_react21.useCallback)(async () => {
    setSoulFormError("");
    const { soul_id, soul_name, description } = soulForm;
    if (!soul_id.trim()) {
      setSoulFormError("soul_id \u4E0D\u80FD\u4E3A\u7A7A");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(soul_id.trim())) {
      setSoulFormError("soul_id \u53EA\u5141\u8BB8\u82F1\u6587\u5B57\u6BCD\u548C\u6570\u5B57");
      return;
    }
    setSoulFormSubmitting(true);
    try {
      const resp = await fetch(getBackendBaseUrl() + "/api/souls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soul_id: soul_id.trim(),
          soul_name: soul_name.trim(),
          description: description.trim()
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSoulFormError(data.error || "\u521B\u5EFA\u5931\u8D25");
        return;
      }
      setSoulModalOpen(false);
      setSoulForm({ soul_id: "", soul_name: "", description: "" });
      setSoulFormError("");
      alert(`SOUL ID "${data.soul_id}" \u521B\u5EFA\u6210\u529F\uFF01`);
    } catch (e) {
      setSoulFormError("\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u540E\u7AEF\u662F\u5426\u542F\u52A8");
    } finally {
      setSoulFormSubmitting(false);
    }
  }, [soulForm]);
  const handleRunWorkflow = (0, import_react21.useCallback)(async (femOverride, source = "human", opts = {}) => {
    console.log("[handleRunWorkflow] ====== \u51C6\u5907\u542F\u52A8 ======");
    console.log("[handleRunWorkflow] flowStatus:", flowStatus);
    if (flowStatus === "running" && plugin && sessionId) {
      try {
        const qs = new URLSearchParams({ sessionId });
        if (pluginJobId !== null && pluginJobId !== void 0) qs.set("jobId", String(pluginJobId));
        const resp = await fetch(`/femo-plugin/session-state?${qs.toString()}`);
        const st = await resp.json().catch(() => ({}));
        if (st?.state === "running" || st?.running === true) {
          pushDebug("warn", "\u8FD0\u884C", "\u5F15\u64CE\u4FA7\u8BE5 Job \u4ECD\u5728\u8FD0\u884C\u2014\u2014\u5148\u6682\u505C\u6216\u7B49\u5B83\u6302\u8D77\u518D\u8DD1");
          return;
        }
        setFlowStatus("idle");
      } catch {
      }
    } else if (flowStatus === "running") {
      return;
    }
    if (plugin && !skipRunGuardRef.current && (femoDirty || graphDirty)) {
      setRunGuard({ textDirty: femoDirty, graphDirty });
      return;
    }
    skipRunGuardRef.current = false;
    const femo = typeof femOverride === "string" && femOverride.trim() ? femOverride : femoText;
    if (!femo || !femo.trim()) {
      alert("\u8BF7\u5148\u7F16\u5199\u6216\u5BFC\u5165 FEMO \u811A\u672C");
      return;
    }
    try {
      const parsed = parseFEMO(femo);
      setFEMOrnings(parsed?.warnings || []);
      if (parsed?.warnings?.length > 0) {
        pushDebug("warn", "\u8BED\u6CD5", `\u8BED\u6CD5\u68C0\u67E5\u901A\u8FC7\uFF0C\u5E26 ${parsed.warnings.length} \u6761\u8B66\u544A`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFemoError(msg);
      setFEMOrnings(warningsFromThrowable(e));
      pushDebug("error", "\u8BED\u6CD5", `\u8FD0\u884C\u88AB\u963B\u6B62\u2014\u2014${msg}`);
      return;
    }
    pushDebug("info", "\u8FD0\u884C", "\u8BED\u6CD5\u68C0\u67E5\u901A\u8FC7\uFF0C\u542F\u52A8\u8FD0\u884C");
    console.log("[handleRunWorkflow] \u53D1\u9001\u5230\u540E\u7AEF...");
    moduleStackRef.current = [];
    {
      const cp = locationPathRef.current;
      const cn = nodesRef.current;
      const ce = edgesRef.current;
      setFlowStore((prev) => {
        const idx = prev.findIndex(
          (f) => f.path?.length === cp.length && f.path?.every((s, i) => s === cp[i])
        );
        const entry = { path: [...cp], nodes: cn, edges: ce };
        if (idx >= 0) {
          const u = [...prev];
          u[idx] = entry;
          return u;
        }
        return [...prev, entry];
      });
    }
    setFlowStatus("running");
    lastActionAtRef.current = Date.now();
    setNodeStates({});
    setActiveNodeIds(/* @__PURE__ */ new Set());
    setHumanWaitsBoth({});
    try {
      if (plugin) {
        if (typeof onRun === "function") {
          const runOpts = {
            reset: opts.reset !== void 0 ? opts.reset === true : opts.forceReset === true ? true : flowStatus !== "paused"
          };
          if (opts.resumeJobId !== void 0 && opts.resumeJobId !== null) runOpts.jobId = opts.resumeJobId;
          await onRun(femo, runOpts);
        }
        setRunId(null);
        connectSse();
        return;
      }
      const resp = await fetch(getBackendBaseUrl() + "/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": userApiKey,
          "X-API-Provider": userApiProvider,
          "X-API-Model": apiModelInput,
          "X-API-Url": userApiUrl
        },
        body: JSON.stringify({ femo })
      });
      const data = await resp.json();
      const newRunId = data.run_id;
      setRunId(newRunId);
      const es = new EventSource(
        getBackendBaseUrl() + `/api/run/${newRunId}/stream`
      );
      eventSourceRef.current = es;
      es.onmessage = (event) => {
        let evt;
        try {
          evt = JSON.parse(event.data);
        } catch (e) {
          console.error("SSE parse error:", e);
          return;
        }
        if (evt.type === "heartbeat") return;
        console.log("[SSE onmessage]", event.data);
        handleWorkflowEvent(evt);
      };
      es.onerror = (event) => {
        console.error("[SSE] \u8FDE\u63A5\u51FA\u9519\u6216\u5173\u95ED", event);
        console.log("[SSE] readyState:", es.readyState, "(0=CONNECTING, 1=OPEN, 2=CLOSED)");
        es.close();
        eventSourceRef.current = null;
        setFlowStatus("idle");
        setActiveNodeIds(/* @__PURE__ */ new Set());
      };
    } catch (err) {
      console.error("Failed to start workflow:", err);
      setFlowStatus("idle");
      setActiveNodeIds(/* @__PURE__ */ new Set());
      pushDebug("error", "\u8FD0\u884C", `\u542F\u52A8\u5DE5\u4F5C\u6D41\u5931\u8D25\uFF1A${err?.message ?? err}`);
      alert("\u542F\u52A8\u5DE5\u4F5C\u6D41\u5931\u8D25: " + err.message);
    }
  }, [flowStatus, userApiKey, userApiProvider, userApiUrl, plugin, femoText, femoDirty, graphDirty, onRun, pushDebug, sessionId, pluginJobId]);
  async function discardChangesAndRun() {
    setRunGuard(null);
    let record = null;
    if (typeof getRecordScript === "function") {
      try {
        record = await getRecordScript();
      } catch (e) {
        record = null;
      }
    }
    if (!record || !record.trim()) {
      alert("\u65E0\u6CD5\u4ECE\u4F1A\u8BDD\u8BFB\u53D6 record \u539F\u6587\uFF0C\u5DF2\u53D6\u6D88\u8FD0\u884C");
      return;
    }
    setFemoText(record);
    applyFEMOText(record);
    skipRunGuardRef.current = true;
    await handleRunWorkflow(record);
  }
  const handlePauseWorkflow = (0, import_react21.useCallback)(async () => {
    if (!runId && !plugin) return;
    lastActionAtRef.current = Date.now();
    clearPauseConfirmTimer();
    try {
      let data;
      if (plugin) {
        if (typeof onPause === "function") {
          data = await onPause(pluginJobId ?? void 0);
        } else {
          const qs = new URLSearchParams({ sessionId });
          if (pluginJobId !== null && pluginJobId !== void 0) qs.set("jobId", String(pluginJobId));
          const resp = await fetch(`/femo-plugin/pause?${qs.toString()}`, { method: "POST" });
          data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data?.error ?? `pause HTTP ${resp.status}`);
        }
      } else {
        const resp = await fetch(getBackendBaseUrl() + `/api/run/${runId}/pause`, { method: "POST" });
        data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.error ?? `pause HTTP ${resp.status}`);
      }
      if (data && data.paused === false) {
        setFlowStatus("idle");
        return;
      }
      const st = data && data.state;
      if (st && st !== "running") {
        if (data.confirmed) {
          setFlowStatus(st === "suspended" ? "paused" : "idle");
          showPauseNotice("info", "\u5DF2\u6682\u505C\uFF08\u65AD\u70B9\u4FDD\u7559\uFF0C\u53EF\u7EE7\u7EED\uFF09");
          return;
        }
        setFlowStatus(st === "suspended" ? "paused" : "idle");
        showPauseNotice(
          "warning",
          `\u6682\u505C\u5DF2\u53D7\u7406\uFF0C\u4F46\u5F15\u64CE\u4FA7\u8BE5 Job \u72B6\u6001\u4E3A ${st}\u2014\u2014\u6CA1\u6709\u6D3B\u8DC3\u6267\u884C\u4F53\u88AB\u6682\u505C\uFF08\u53EF\u80FD\u6B64\u524D\u5DF2\u88AB\u6302\u8D77/\u5BF9\u8D26\uFF09`
        );
        return;
      }
      if (pauseConfirmTimerRef.current) clearTimeout(pauseConfirmTimerRef.current);
      pauseConfirmTimerRef.current = setTimeout(() => {
        pauseConfirmTimerRef.current = null;
        showPauseNotice(
          "warning",
          "\u6682\u505C\u8BF7\u6C42\u5DF2\u53D1\u51FA 8 \u79D2\u4ECD\u672A\u6536\u5230\u5F15\u64CE\u786E\u8BA4\u2014\u2014\u5F15\u64CE\u53EF\u80FD\u5DF2\u50F5\u6B7B\uFF08\u53D6\u6D88\u4EE4\u724C\u672A\u9001\u8FBE\uFF09\uFF0C\u8BF7\u91CD\u542F\u5BBF\u4E3B/\u5F15\u64CE\u540E\u5BF9\u8D26\u6062\u590D"
        );
      }, 8e3);
    } catch (err) {
      console.error("\u6682\u505C\u5931\u8D25:", err);
      showPauseNotice("error", `\u6682\u505C\u5931\u8D25\uFF1A${err?.message ?? err}`);
    }
  }, [runId, plugin, onPause, sessionId, pluginJobId, showPauseNotice, clearPauseConfirmTimer]);
  const handleResumeWorkflow = (0, import_react21.useCallback)(async () => {
    lastActionAtRef.current = Date.now();
    if (plugin) {
      await handleRunWorkflow(void 0, "human", { resumeJobId: pluginJobId ?? void 0, reset: false });
      return;
    }
    if (!runId) return;
    try {
      await fetch(getBackendBaseUrl() + `/api/run/${runId}/resume`, { method: "POST" });
      setFlowStatus("running");
    } catch (err) {
      console.error("\u7EE7\u7EED\u5931\u8D25:", err);
    }
  }, [runId, plugin, handleRunWorkflow, pluginJobId]);
  const debugRunAbortRef = (0, import_react21.useRef)(null);
  const [debugRunning, setDebugRunning] = (0, import_react21.useState)(false);
  const handleDebugRun = (0, import_react21.useCallback)(async () => {
    if (debugRunAbortRef.current) {
      pushDebug("warn", "\u8C03\u8BD5", "\u4E0A\u4E00\u8F6E\u8C03\u8BD5\u5E72\u8DD1\u4ECD\u5728\u8FDB\u884C\u4E2D");
      return;
    }
    if (!plugin) {
      alert("\u8C03\u8BD5\u5E72\u8DD1\u76EE\u524D\u4EC5\u5728 dsh \u63D2\u4EF6\u6A21\u5F0F\u53EF\u7528");
      return;
    }
    const femo = femoText;
    if (!femo || !femo.trim()) {
      alert("\u8BF7\u5148\u7F16\u5199\u6216\u5BFC\u5165 FEMO \u811A\u672C");
      return;
    }
    const lp = locationPathRef.current || ["mainflow"];
    const debugModule = lp.length > 1 ? lp.slice(1).join(".") : void 0;
    setDebugRunning(true);
    setDebugOpen(true);
    pushDebug("info", "\u8C03\u8BD5", debugModule ? `\u96F6 token \u5E72\u8DD1\u542F\u52A8\u2014\u2014\u53EA\u8DD1\u6A21\u5757 ${debugModule}\uFF08\u5F53\u524D\u5728\u5B83\u7684\u5B50\u753B\u5E03\uFF1BAI/\u4EBA\u7C7B\u8282\u70B9\u7531\u8C03\u8BD5\u5668\u66FF\u7B54\uFF09\u2026` : "\u96F6 token \u5E72\u8DD1\u542F\u52A8\u2014\u2014\u6574\u5267\u672C\uFF08\u5F53\u524D\u5728\u4E3B\u753B\u5E03\uFF1BAI/\u4EBA\u7C7B\u8282\u70B9\u7531\u8C03\u8BD5\u5668\u66FF\u7B54\uFF09\u2026");
    const controller = new AbortController();
    debugRunAbortRef.current = controller;
    try {
      const resp = await fetch("/femo-plugin/debug-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // scriptPath=savedPath：code: file:"xxx.py" 相对引用按原剧本目录解析
        // （与正式运行同语义；未保存过的剧本回退沙盒目录）。
        // module：主画布=整剧本；模块子画布=只跑该模块（嵌套点路径）。
        body: JSON.stringify({
          femo,
          scriptPath: savedPath || void 0,
          module: debugModule
        }),
        signal: controller.signal
      });
      if (!resp.ok || !resp.body) {
        const detail = await resp.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawRunOutcome = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          let rec;
          try {
            rec = JSON.parse(line);
          } catch {
            continue;
          }
          if (rec.kind === "run_end") sawRunOutcome = true;
          if (rec.kind === "debug_done") {
            if (rec.exitCode !== 0 && !sawRunOutcome) {
              pushDebug("error", "\u8C03\u8BD5", `\u8C03\u8BD5\u8FDB\u7A0B\u5F02\u5E38\u9000\u51FA\uFF08code=${rec.exitCode}\uFF09\uFF0C\u8BE6\u89C1\u5BBF\u4E3B\u63A7\u5236\u53F0 [femo-debug:stderr]`);
            }
            continue;
          }
          const entry = debugRecToLine(rec);
          if (entry) pushDebug(entry.level, entry.kind, entry.text);
        }
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        pushDebug("error", "\u8C03\u8BD5", `\u8C03\u8BD5\u5E72\u8DD1\u5931\u8D25\uFF1A${err?.message ?? err}`);
      }
    } finally {
      debugRunAbortRef.current = null;
      setDebugRunning(false);
    }
  }, [plugin, femoText, pushDebug]);
  const closeRunScopedSse = (0, import_react21.useCallback)(() => {
    const es = eventSourceRef.current;
    if (es && !String(es.url ?? "").includes("/femo-plugin/events")) {
      es.close();
      eventSourceRef.current = null;
    }
  }, []);
  const waitingRestoreRef = (0, import_react21.useRef)(null);
  const currentNodePopRef = (0, import_react21.useRef)(null);
  const canPopOverlay = (0, import_react21.useCallback)(
    () => !plugin || flowStatusRef.current === "running",
    [plugin]
  );
  const findNodeByLabel = (0, import_react21.useCallback)((label) => {
    if (!label) return null;
    const hit = (n) => n.label === label || "[" + label + "]" === n.label;
    let node = nodesRef.current.find(hit);
    if (!node) {
      const ownerFlow = flowStoreRef.current.find((f) => f.nodes?.some(hit));
      if (ownerFlow) {
        node = ownerFlow.nodes.find(hit);
        if (Array.isArray(ownerFlow.path) && ownerFlow.path.join("/") !== locationPathRef.current.join("/")) {
          console.log("[FEMO] \u63A5\u901A\u6062\u590D\uFF1A\u8282\u70B9\u5728\u5176\u5B83\u753B\u5E03\uFF0C\u81EA\u52A8\u5207\u6362:", label, "\u2192", ownerFlow.path.join("/"));
          saveAndNavigateRef.current(ownerFlow.path);
        }
      }
    }
    return node || null;
  }, []);
  const restoreHumanWait = (0, import_react21.useCallback)((wh) => {
    if (!wh || !wh.nodeName || !wh.waitKey) return;
    if (waitingRestoreRef.current === wh.waitKey) return;
    const node = findNodeByLabel(wh.nodeName);
    if (!node) return;
    waitingRestoreRef.current = wh.waitKey;
    const nid2 = node.id;
    setNodeStates((prev) => ({
      ...prev,
      [nid2]: {
        ...prev[nid2],
        status: "human_wait",
        type: "human",
        wait_key: wh.waitKey || "",
        context: wh.context || "",
        memory: wh.memory || "",
        showprompt: wh.showprompt || null,
        prompt: wh.prompt || "",
        outVars: Array.isArray(wh.outVars) ? wh.outVars : [],
        inputError: null
      }
    }));
    setHumanWaitsBoth((prev) => ({
      ...prev,
      [nid2]: {
        wait_key: wh.waitKey || "",
        context: wh.context || "",
        memory: wh.memory || "",
        showprompt: wh.showprompt || null,
        prompt: wh.prompt || "",
        outVars: Array.isArray(wh.outVars) ? wh.outVars : [],
        inputError: null
      }
    }));
    setActiveNodeIds((prev) => /* @__PURE__ */ new Set([...prev, nid2]));
    setBubbleOverlay({ nodeId: nid2 });
    console.log("[FEMOEditor] waitingHuman \u5FEB\u7167\u6062\u590D:", wh.nodeName, wh.waitKey);
  }, [findNodeByLabel, setHumanWaitsBoth]);
  const popCurrentNode = (0, import_react21.useCallback)((label) => {
    if (!label || currentNodePopRef.current === label) return;
    const node = findNodeByLabel(label);
    if (!node) return;
    currentNodePopRef.current = label;
    if (node.type !== "action") return;
    setBubbleOverlay({ nodeId: node.id });
    console.log("[FEMOEditor] \u63A5\u901A\u6062\u590D\uFF1A\u5F39\u51FA\u5F53\u524D\u8FD0\u884C\u8282\u70B9\u6D6E\u5C42:", label);
    pushDebug("info", "\u6062\u590D", `\u63A5\u901A\uFF1A\u5F39\u51FA\u5F53\u524D\u8FD0\u884C\u8282\u70B9\u300C${label}\u300D`);
  }, [findNodeByLabel, pushDebug]);
  const followRunningNode = (0, import_react21.useCallback)((label, nodeId) => {
    if (nodeId === void 0 || nodeId === null) return;
    if (!canPopOverlay()) return;
    if (bubbleOverlayRef.current === null) return;
    if (Object.keys(humanWaitsRef.current).length > 0) return;
    if (bubbleOverlayRef.current.nodeId === nodeId) return;
    currentNodePopRef.current = label ?? currentNodePopRef.current;
    setBubbleOverlay({ nodeId });
    console.log("[FEMOEditor] \u6D6E\u5C42\u8DDF\u968F\u8FD0\u884C:", label);
  }, [canPopOverlay]);
  const handleWorkflowEvent = (0, import_react21.useCallback)((evt) => {
    if (evt.type !== "heartbeat") {
      console.log("[SSE event]", evt);
      console.log("[handleWorkflowEvent] \u6536\u5230\u4E8B\u4EF6", evt);
    }
    const { type, data } = evt;
    console.log("[SSE event]", evt);
    if (type === "heartbeat" || type === "step") return;
    if (type === "femo_stream") return;
    if (plugin && data && data.sid !== void 0 && data.sid !== sessionId) return;
    if (plugin && data && data.job_id !== void 0) {
      const jid = Number(data.job_id);
      if (Number.isFinite(jid) && jid > 0) setPluginJobId(jid);
    }
    {
      const sum = summarizeDebugEvent(type, data);
      if (Array.isArray(sum)) sum.forEach((s) => pushDebug(s.level, type, s.text));
      else if (sum) pushDebug(sum.level, type, sum.text);
    }
    if (type === "run_state") {
      const s = data?.state;
      if (s !== "running") clearPauseConfirmTimer();
      if (s === "running") setFlowStatus("running");
      else if (s === "suspended") setFlowStatus("paused");
      else if (s === "finished" || s === "failed") setFlowStatus("idle");
      return;
    }
    if (plugin && !restoreDoneRef.current) {
      const nodeScoped = !["flow_start", "flow_done", "flow_paused", "done", "module_enter", "module_exit", "flow_error", "notify_author"].includes(type);
      if (nodeScoped) {
        pendingReplayRef.current.push({ ...evt, _replayed: true });
        return;
      }
    }
    const needsNodeMatch = !["flow_start", "flow_done", "flow_paused", "done", "module_enter", "module_exit", "flow_error", "notify_author"].includes(type);
    let matchedNode = null;
    let nodeId = void 0;
    if (needsNodeMatch) {
      const actionName = data?.node_name;
      if (!actionName) {
        console.warn("[FEMO] \u4E8B\u4EF6\u7F3A\u5C11 node_name:", type, data);
        return;
      }
      const currentNodes = nodesRef.current;
      matchedNode = currentNodes.find((n) => n.label === actionName);
      if (!matchedNode) {
        const ownerFlow = flowStoreRef.current.find(
          (f) => f.nodes?.some((n) => n.label === actionName)
        );
        if (ownerFlow) {
          const ownerNode = ownerFlow.nodes.find((n) => n.label === actionName);
          nodeId = ownerNode.id;
          matchedNode = ownerNode;
          if (Array.isArray(ownerFlow.path) && ownerFlow.path.join("/") !== locationPathRef.current.join("/")) {
            console.log("[FEMO] \u8282\u70B9\u5728\u5176\u5B83\u753B\u5E03\uFF0C\u81EA\u52A8\u5207\u6362:", actionName, "\u2192", ownerFlow.path.join("/"));
            saveAndNavigateRef.current(ownerFlow.path);
          }
        } else {
          console.error(
            `[FEMO Editor] \u65E0\u6CD5\u5339\u914D\u8282\u70B9 "${actionName}"
\u753B\u5E03\u4E0A\u7684\u6240\u6709 action \u8282\u70B9\u5982\u4E0B\uFF1A
` + currentNodes.filter((n) => n.type === "action").map((n) => `  name="${actionStore.find((a) => a.id === n.actionId)?.name || "?"}", label="${n.label}", id="${n.id}"`).join("\n")
          );
          return;
        }
      }
      nodeId = matchedNode.id;
    }
    console.log("[handleWorkflowEvent] type:", type, "nodeId:", nodeId, "matchedNode:", matchedNode?.label);
    switch (type) {
      case "module_enter": {
        const enterName = data.module_name;
        try {
          console.log("[femo-diag] evt module_enter module=" + enterName + " dataSid=" + (data?.sessionId ?? "none"));
        } catch {
        }
        console.log("[module_enter] module_name:", enterName, "moduleStack:", [...moduleStackRef.current]);
        moduleStackRef.current.push(enterName);
        const targetModule = moduleStoreRef.current.find((m) => m.name === enterName);
        if (targetModule) {
          console.log("[module_enter] \u5207\u6362\u5230\u753B\u5E03:", targetModule.path);
          saveAndNavigateRef.current(targetModule.path);
        } else {
          console.warn("[module_enter] \u6A21\u5757\u672A\u627E\u5230:", enterName, "moduleStore:", moduleStoreRef.current.map((m) => m.name));
        }
        break;
      }
      case "module_exit": {
        const exitName = data.module_name;
        console.log("[module_exit] module_name:", exitName, "moduleStack:", [...moduleStackRef.current]);
        moduleStackRef.current.pop();
        const stackTop = moduleStackRef.current[moduleStackRef.current.length - 1];
        if (stackTop) {
          const parentMod = moduleStoreRef.current.find((m) => m.name === stackTop);
          if (parentMod) {
            console.log("[module_exit] \u56DE\u5230\u6808\u9876\u6A21\u5757:", parentMod.path);
            saveAndNavigateRef.current(parentMod.path);
          } else {
            console.warn("[module_exit] \u6808\u9876\u6A21\u5757\u672A\u627E\u5230:", stackTop, "\uFF0C\u56DE\u4E3B\u6D41\u7A0B");
            saveAndNavigateRef.current(["mainflow"]);
          }
        } else {
          console.log("[module_exit] \u6808\u7A7A\uFF0C\u56DE\u4E3B\u6D41\u7A0B");
          saveAndNavigateRef.current(["mainflow"]);
        }
        break;
      }
      case "node_start":
        setActiveNodeIds((prev) => /* @__PURE__ */ new Set([...prev, nodeId]));
        setNodeStates((prev) => ({
          ...prev,
          [nodeId]: {
            ...prev[nodeId],
            status: data.node_type === "ai" ? "ai_streaming" : data.node_type === "human" ? "human_wait" : "running",
            type: data.node_type,
            prompt: data.prompt || prev[nodeId]?.prompt || "",
            streamingText: "",
            output: "",
            history: data.history || prev[nodeId]?.history || []
          }
        }));
        if (!isCatchUpFrame(evt)) followRunningNode(matchedNode?.label ?? data?.node_name, nodeId);
        break;
      case "ai_token":
        setNodeStates((prev) => {
          const existing = prev[nodeId] || {};
          return {
            ...prev,
            [nodeId]: {
              ...existing,
              status: "ai_streaming",
              streamingText: (existing.streamingText || "") + data.token
            }
          };
        });
        break;
      case "ai_done":
        setActiveNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setErrorNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setNodeStates((prev) => {
          const existing = prev[nodeId] || {};
          return {
            ...prev,
            [nodeId]: {
              ...existing,
              status: "ai_done",
              output: data.output || existing.streamingText,
              streamingText: ""
            }
          };
        });
        break;
      case "human_wait":
        console.log("[human_wait] \u6536\u5230\u7684 data:", data);
        console.log("[human_wait] out_vars:", data.out_vars);
        setActiveNodeIds((prev) => /* @__PURE__ */ new Set([...prev, nodeId]));
        setNodeStates((prev) => ({
          ...prev,
          [nodeId]: {
            ...prev[nodeId],
            status: "human_wait",
            type: "human",
            wait_key: data.wait_key || "",
            // ← 这行必须有
            context: data.context || "",
            memory: data.memory || "",
            showprompt: data.showprompt || null,
            prompt: data.prompt || prev[nodeId]?.prompt || "",
            outVars: data.out_vars || [],
            inputError: null
            // 新一轮等待：清掉上一轮的拒绝/失败红条
          }
        }));
        if (!isCatchUpFrame(evt) && canPopOverlay()) setBubbleOverlay({ nodeId });
        setHumanWaitsBoth((prev) => ({
          ...prev,
          [nodeId]: {
            wait_key: data.wait_key || "",
            context: data.context || "",
            memory: data.memory || "",
            showprompt: data.showprompt || null,
            prompt: data.prompt || prev[nodeId]?.prompt || "",
            outVars: data.out_vars || [],
            inputError: null
          }
        }));
        break;
      case "node_retry": {
        if (data.target !== "human") break;
        console.log("[node_retry] \u6536\u5230\u7684 data:", data);
        const retryError = Array.isArray(data.error) ? data.error[0] || "" : data.error || "";
        setActiveNodeIds((prev) => /* @__PURE__ */ new Set([...prev, nodeId]));
        setNodeStates((prev) => ({
          ...prev,
          [nodeId]: {
            ...prev[nodeId],
            status: "human_wait",
            type: "human",
            wait_key: data.wait_key || prev[nodeId]?.wait_key || "",
            inputError: retryError || data.feedback || "\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u8F93\u5165",
            outVars: prev[nodeId]?.outVars || []
          }
        }));
        if (!isCatchUpFrame(evt) && canPopOverlay()) setBubbleOverlay({ nodeId });
        setHumanWaitsBoth((prev) => ({
          ...prev,
          [nodeId]: {
            ...prev[nodeId] || {},
            wait_key: data.wait_key || prev[nodeId]?.wait_key || "",
            inputError: retryError || data.feedback || "\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u8F93\u5165"
          }
        }));
        break;
      }
      case "context_ready":
        setNodeStates((prev) => {
          const existing = prev[nodeId] || {};
          return {
            ...prev,
            [nodeId]: {
              ...existing,
              context: data.context || "",
              showprompt: data.showprompt || null,
              ai_name: data.ai_name || "AI"
            }
          };
        });
        break;
      case "human_done":
        setActiveNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setErrorNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setNodeStates((prev) => {
          const existing = prev[nodeId] || {};
          return {
            ...prev,
            [nodeId]: {
              ...existing,
              status: "human_done",
              output: data.input || ""
            }
          };
        });
        setHumanWaitsBoth((prev) => {
          if (!(nodeId in prev)) return prev;
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
        break;
      case "func_result":
        setActiveNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setErrorNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setNodeStates((prev) => {
          const ins = data.input && typeof data.input === "object" && !Array.isArray(data.input) ? data.input : null;
          const outs = data.output && typeof data.output === "object" && !Array.isArray(data.output) ? data.output : null;
          return {
            ...prev,
            [nodeId]: {
              ...prev[nodeId],
              status: "done",
              type: "func",
              output: typeof data.output === "string" ? data.output : data.output == null ? "" : JSON.stringify(data.output, null, 2),
              ins,
              outs
            }
          };
        });
        break;
      case "assign_result":
        setActiveNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setErrorNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setNodeStates((prev) => {
          const ins = data.input && typeof data.input === "object" && !Array.isArray(data.input) ? data.input : null;
          const outs = data.output && typeof data.output === "object" && !Array.isArray(data.output) ? data.output : null;
          return {
            ...prev,
            [nodeId]: {
              ...prev[nodeId],
              status: "done",
              type: "assign",
              output: typeof data.output === "string" ? data.output : JSON.stringify(data.output, null, 2),
              ins,
              outs
            }
          };
        });
        break;
      case "notice_done":
        setActiveNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setErrorNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        setNodeStates((prev) => ({
          ...prev,
          [nodeId]: {
            ...prev[nodeId],
            status: "done",
            type: "notice",
            output: data.text || ""
          }
        }));
        break;
      case "flow_start": {
        if (!isCatchUpFrame(evt)) setFlowStatus("running");
        setNodeStates({});
        setActiveNodeIds(/* @__PURE__ */ new Set());
        setHumanWaitsBoth({});
        break;
      }
      case "flow_paused":
        clearPauseConfirmTimer();
        setFlowStatus("paused");
        setActiveNodeIds(/* @__PURE__ */ new Set());
        closeRunScopedSse();
        moduleStackRef.current = [];
        saveAndNavigateRef.current(["mainflow"]);
        setHumanWaitsBoth({});
        break;
      case "flow_done":
        setFlowStatus("idle");
        const endNode = nodesRef.current.find(
          (n) => n.type === "special" && n.specialType === "END"
        );
        setActiveNodeIds(new Set(endNode ? [endNode.id] : []));
        closeRunScopedSse();
        moduleStackRef.current = [];
        saveAndNavigateRef.current(["mainflow"]);
        setHumanWaitsBoth({});
        break;
        break;
      case "flow_error":
        if (nodeId) {
          setErrorNodeIds((prev) => /* @__PURE__ */ new Set([...prev, nodeId]));
          setNodeStates((prev) => ({
            ...prev,
            [nodeId]: { ...prev[nodeId], status: "error" }
          }));
          setActiveNodeIds((prev) => /* @__PURE__ */ new Set([...prev, nodeId]));
        }
        alert("\u274C \u5267\u672C\u8FD0\u884C\u51FA\u9519: " + (data.error || "\u672A\u77E5\u9519\u8BEF"));
        moduleStackRef.current = [];
        break;
      case "notify_author":
        console.log("[notify_author]", data?.level ?? "", data?.message ?? data);
        break;
      case "bridge_run_ended":
        if (data?.ok === false) {
          setFlowStatus("idle");
          setActiveNodeIds(/* @__PURE__ */ new Set());
          moduleStackRef.current = [];
        }
        setHumanWaitsBoth({});
        break;
      case "done":
        setFlowStatus("idle");
        setActiveNodeIds(/* @__PURE__ */ new Set());
        setHumanWaitsBoth({});
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        moduleStackRef.current = [];
        saveAndNavigateRef.current(["mainflow"]);
        break;
      default:
        console.warn("[FEMO] \u6536\u5230\u672A\u77E5\u4E8B\u4EF6\u7C7B\u578B:", type, data);
        break;
    }
  }, [closeRunScopedSse, clearPauseConfirmTimer, pushDebug]);
  const connectSse = (0, import_react21.useCallback)(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const es = new EventSource("/femo-plugin/events");
    eventSourceRef.current = es;
    es.onopen = () => {
      if (Date.now() - lastActionAtRef.current < 8e3) return;
      void (async () => {
        try {
          const resp = await fetch(`/femo-plugin/session-state?sessionId=${encodeURIComponent(sessionId)}`);
          const data = await resp.json().catch(() => null);
          if (!data || data.ok !== true) return;
          const hasCkpt = data.checkpoint && Object.keys(data.checkpoint).length > 0;
          setFlowStatus(data.running === true ? "running" : hasCkpt ? "paused" : "idle");
          setAttachSnapshot({
            running: data.running === true,
            checkpoint: mainCheckpointLabel(data.checkpoint),
            waitingHuman: data.waitingHuman ?? null,
            seq: ++attachSeqRef.current
          });
        } catch {
        }
      })();
    };
    es.onmessage = (event) => {
      let evt;
      try {
        evt = JSON.parse(event.data);
      } catch (e) {
        console.error("SSE parse error:", e);
        return;
      }
      if (evt.type === "heartbeat" || evt.type === "connected") return;
      if (evt.type === "femo_diag") {
        handleDiagFeed(evt.data);
        return;
      }
      handleWorkflowEvent(evt);
    };
    es.onerror = (event) => {
      console.error("[SSE] \u8FDE\u63A5\u51FA\u9519\uFF0C\u7B49\u5F85\u6D4F\u89C8\u5668\u81EA\u52A8\u91CD\u8FDE", event);
      pushDebug("warn", "SSE", "\u8FDE\u63A5\u51FA\u9519\uFF0C\u7B49\u5F85\u6D4F\u89C8\u5668\u81EA\u52A8\u91CD\u8FDE");
    };
  }, [handleWorkflowEvent, sessionId, pushDebug, handleDiagFeed]);
  (0, import_react21.useEffect)(() => () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);
  (0, import_react21.useEffect)(() => {
    if (!plugin) return;
    connectSse();
  }, [plugin, connectSse]);
  (0, import_react21.useEffect)(() => {
    if (!plugin || !restoreDoneRef.current) return;
    if (pendingReplayRef.current.length === 0) return;
    const queued = pendingReplayRef.current;
    pendingReplayRef.current = [];
    console.log("[FEMOEditor] \u6062\u590D\u5B8C\u6210\uFF0C\u8865\u653E\u7F13\u51B2\u4E8B\u4EF6:", queued.length);
    for (const evt of queued) handleWorkflowEvent(evt);
  }, [plugin, nodes, flowStore, handleWorkflowEvent]);
  const attachSeqRef = (0, import_react21.useRef)(0);
  const [attachSnapshot, setAttachSnapshot] = (0, import_react21.useState)(null);
  const sameAttach = (a, b) => a !== null && b !== null && a.running === b.running && a.checkpoint === b.checkpoint && (a.waitingHuman?.waitKey ?? "") === (b.waitingHuman?.waitKey ?? "");
  (0, import_react21.useEffect)(() => {
    if (!plugin) return;
    const next = {
      running: initialRunning === true,
      checkpoint: initialCheckpoint ?? null,
      waitingHuman: initialWaitingHuman ?? null
    };
    setAttachSnapshot((prev) => sameAttach(prev, next) ? prev : { ...next, seq: ++attachSeqRef.current });
  }, [plugin, initialRunning, initialCheckpoint, initialWaitingHuman]);
  (0, import_react21.useEffect)(() => {
    if (!plugin || attachSnapshot === null) return;
    if (!restoreDoneRef.current) return;
    if (attachSnapshot.running !== true) return;
    const wh = attachSnapshot.waitingHuman;
    if (wh && wh.nodeName && wh.waitKey) {
      restoreHumanWait(wh);
      return;
    }
    popCurrentNode(attachSnapshot.checkpoint);
  }, [plugin, attachSnapshot, nodes, flowStore, restoreHumanWait, popCurrentNode]);
  const submitHumanInput = (0, import_react21.useCallback)(
    async (nodeId, chatText, assignments) => {
      const setWaitError = (msg) => {
        setHumanWaitsBoth((prev) => prev[nodeId] ? { ...prev, [nodeId]: { ...prev[nodeId], inputError: msg } } : prev);
        setNodeStates((prev) => ({
          ...prev,
          [nodeId]: { ...prev[nodeId], inputError: msg }
        }));
      };
      const fail = (msg) => {
        console.error("[submitHumanInput]", nodeId, msg);
        setWaitError(msg);
        return false;
      };
      const hasChat = chatText && chatText.trim();
      const hasVars = assignments && Object.keys(assignments).length > 0;
      if (!plugin && !runId) return fail("\u63D0\u4EA4\u5931\u8D25\uFF1A\u8FD0\u884C\u672A\u542F\u52A8\uFF08\u72EC\u7ACB\u6A21\u5F0F\u7F3A runId\uFF09\u3002");
      if (!hasChat && !hasVars) return false;
      const waitKey = humanWaitsRef.current[nodeId]?.wait_key || nodeStates[nodeId]?.wait_key;
      console.log("[submitHumanInput] nodeId:", nodeId, "waitKey:", waitKey, "chatText:", chatText);
      if (!waitKey) {
        return fail("\u63D0\u4EA4\u5931\u8D25\uFF1A\u5F15\u64CE\u7B49\u5F85\u72B6\u6001\u672A\u540C\u6B65\uFF08\u7F3A wait_key\uFF09\u3002\u8BF7\u56DE\u5230\u5BF9\u8BDD\u7A97\u53E3\u8F93\u5165\uFF0C\u6216\u91CD\u65B0\u8FD0\u884C\u3002");
      }
      const payload = {
        sessionId,
        wait_key: waitKey,
        chat_text: chatText || "",
        variables: assignments || {}
      };
      console.log("[submitHumanInput] payload:", JSON.stringify(payload));
      try {
        const resp = await fetch(plugin ? "/femo-plugin/human-input" : getBackendBaseUrl() + `/api/run/${runId}/human-input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok) {
          return fail(`\u63D0\u4EA4\u5931\u8D25\uFF1AHTTP ${resp.status}${data?.error ? ` ${data.error}` : ""}`);
        }
        if (data && data.delivered === false) {
          return fail(`\u63D0\u4EA4\u672A\u9001\u8FBE\u5F15\u64CE\uFF08${data.note || "no active job"}\uFF09\u3002\u53EF\u56DE\u5BF9\u8BDD\u7A97\u53E3\u8F93\u5165\uFF0C\u6216\u91CD\u8BD5\u3002`);
        }
      } catch (err) {
        return fail(`\u63D0\u4EA4\u5931\u8D25\uFF1A${String(err?.message ?? err)}`);
      }
      setNodeStates((prev) => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          status: "human_done",
          output: chatText || ""
        }
      }));
      setHumanWaitsBoth((prev) => {
        if (!(nodeId in prev)) return prev;
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
      return true;
    },
    [runId, nodeStates, plugin, sessionId]
    // nodeStates/sessionId 加入依赖
  );
  const saveCurrentFlow = (0, import_react21.useCallback)(() => {
    setFlowStore((prev) => {
      const exists = prev.findIndex(
        (f) => f.path?.length === locationPath.length && f.path?.every((s, i) => s === locationPath[i])
      );
      const entry = {
        path: [...locationPath],
        nodes: [...nodes],
        edges: [...edges]
      };
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = entry;
        return updated;
      } else {
        return [...prev, entry];
      }
    });
  }, [locationPath, nodes, edges]);
  function editModule(mod) {
    saveCurrentFlow();
    setLocationPath(mod.path);
  }
  const onMM = (0, import_react21.useCallback)(
    (e) => {
      if (drag) {
        const z = effectiveZoom(cvRef.current);
        setNodes((p) => {
          const draggedNode = p.find((n) => n.id === drag.id);
          if (!draggedNode) return p;
          const newX = drag.ox + (e.clientX - drag.sx) / (scale * z);
          const newY = drag.oy + (e.clientY - drag.sy) / (scale * z);
          return applyForLinkage(p, draggedNode, newX, newY);
        });
        return;
      }
      if (conn) {
        const [cx, cy] = xy(e);
        setConn((p) => ({ ...p, mx: cx, my: cy }));
        return;
      }
      if (!isMouseDownRef.current) return;
      if (!isPanning) {
        const dx = e.clientX - mouseDownPosRef.current.x;
        const dy = e.clientY - mouseDownPosRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          setIsPanning(true);
          isDraggingRef.current = true;
        }
        return;
      }
      const pz = effectiveZoom(cvRef.current);
      setPan({
        x: panStart.px + (e.clientX - panStart.x) / pz,
        y: panStart.py + (e.clientY - panStart.y) / pz
      });
    },
    [drag, conn, xy, isPanning, panStart, scale]
  );
  const handleWheel = (0, import_react21.useCallback)(
    (e) => {
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      if (e.ctrlKey || e.metaKey) {
        const rect = cvRef.current?.getBoundingClientRect();
        if (!rect) return;
        const wz = effectiveZoom(cvRef.current, rect);
        const mouseX = (e.clientX - rect.left) / wz;
        const mouseY = (e.clientY - rect.top) / wz;
        const worldX = (mouseX - pan.x) / scale;
        const worldY = (mouseY - pan.y) / scale;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(3, Math.max(0.2, scale * delta));
        const newPanX = mouseX - worldX * newScale;
        const newPanY = mouseY - worldY * newScale;
        setScale(newScale);
        setPan({ x: newPanX, y: newPanY });
      } else {
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }));
      }
    },
    [scale, pan]
  );
  const onMU = (0, import_react21.useCallback)(() => {
    if (drag) {
      const draggedNode = nodesRef.current.find((n) => n.id === drag.id);
      if (draggedNode && (draggedNode.specialType === "START" || draggedNode.specialType === "IN")) {
        const dx = draggedNode.x;
        const dy = draggedNode.y;
        setNodes((prev) => {
          const updated = prev.map((n) => ({
            ...n,
            x: n.id === draggedNode.id ? 0 : n.x - dx,
            y: n.id === draggedNode.id ? 0 : n.y - dy
          }));
          const entry = updated.find((n) => n.id === draggedNode.id);
          return updated;
        });
        setFlowStore((prev) => {
          const idx = prev.findIndex((f) => f.path?.length === locationPath.length && f.path?.every((s, i) => s === locationPath[i]));
          const entry = { path: [...locationPath], nodes: nodesRef.current.map((n) => ({ ...n })) };
          const updated = idx >= 0 ? [...prev] : [...prev, { path: [...locationPath], nodes: [], edges: [] }];
          if (idx >= 0) updated[idx] = { ...updated[idx], nodes: nodesRef.current.map((n) => ({ ...n })) };
          else updated.push({ path: [...locationPath], nodes: nodesRef.current.map((n) => ({ ...n })), edges: [] });
          return updated;
        });
      }
    }
    if (isMouseDownRef.current && !isDraggingRef.current) {
      setSel(null);
    }
    setDrag(null);
    setConn(null);
    setIsPanning(false);
    isDraggingRef.current = false;
    isMouseDownRef.current = false;
  }, [drag, nodesRef]);
  const onCanvasDown = (0, import_react21.useCallback)(
    (e) => {
      if (!e.target?.dataset?.canvasBg && e.target !== cvRef.current) return;
      if (drag || isPanning || conn) {
        setDrag(null);
        setIsPanning(false);
        setConn(null);
        isDraggingRef.current = false;
        isMouseDownRef.current = false;
        return;
      }
      if (e.button === 0 || e.button === 1) {
        isMouseDownRef.current = true;
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        setPanStart({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
        e.preventDefault();
      }
    },
    [pan, drag, isPanning, conn]
  );
  function handlePortDown(e, nodeId, portDir, portX, portY) {
    const node = nm.get(nodeId);
    if (node?.type === "special" && SINK_ONLY.has(node.specialType) && portDir !== "for_out") return;
    const [cx, cy] = xy(e);
    let srcX = portX, srcY = portY;
    if (srcX === void 0 || srcY === void 0) {
      const size = getNodeSize(node);
      srcX = node.x + size.w / 2;
      srcY = node.y + size.h / 2;
    }
    setConn({ srcId: nodeId, srcDir: portDir, mx: cx, my: cy, srcX, srcY });
  }
  function handlePortUp(e, nodeId, portDir) {
    if (!conn) return;
    const targetNode = nm.get(nodeId);
    if ((targetNode?.type === "for_out" || targetNode?.type === "par_out") && conn.srcId === nodeId) {
      setConn(null);
      return;
    }
    if (conn.srcId === nodeId) {
      if (!edges.some((ed) => ed.src === nodeId && ed.tgt === nodeId)) {
        setEdges((p) => [
          ...p,
          { id: eid(), src: nodeId, tgt: nodeId, cond: "", isSelfLoop: true }
        ]);
      }
      setConn(null);
    } else {
      if (!edges.some((ed) => ed.src === conn.srcId && ed.tgt === nodeId)) {
        setEdges((p) => [
          ...p,
          { id: eid(), src: conn.srcId, tgt: nodeId, cond: "" }
        ]);
      }
      setConn(null);
    }
  }
  function handleBodyMouseUp(e, nodeId) {
    if (conn && conn.srcId !== nodeId) {
      if (!edges.some((ed) => ed.src === conn.srcId && ed.tgt === nodeId)) {
        setEdges((p) => [
          ...p,
          { id: eid(), src: conn.srcId, tgt: nodeId, cond: "" }
        ]);
      }
      setConn(null);
    }
  }
  function handleLibDragStart(e, type, idOrType) {
    e.dataTransfer.setData(
      "application/femo-item",
      JSON.stringify({ type, id: idOrType })
    );
    e.dataTransfer.effectAllowed = "copy";
  }
  function handleCanvasDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function handleCanvasDrop(e) {
    e.preventDefault();
    let data;
    try {
      data = JSON.parse(e.dataTransfer.getData("application/femo-item"));
    } catch {
      return;
    }
    if (!data) return;
    const [cx, cy] = xy(e);
    const dropX = cx - 50;
    const dropY = cy - 20;
    if (data.type === "action") {
      let action = lib.actions.find((a) => a.id === data.id);
      if (action && isFinite(dropX) && isFinite(dropY))
        addNode(action, dropX, dropY);
    } else if (data.type === "module") {
      const mod = lib.modules.find((m) => m.id === data.id);
      if (mod) addModuleNode(mod, dropX, dropY);
    } else if (data.type === "special") {
      addSpecialNode(data.id, dropX, dropY);
    } else if (data.type === "position") {
      addPositionNode(dropX, dropY);
    }
  }
  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        applyFEMOText(event.target.result);
      } catch (err) {
        setFemoError(err.message);
        setFEMOrnings(warningsFromThrowable(err));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function handleToolbarImport() {
    if (plugin && typeof onListFemoFiles === "function") {
      setFemoFileOpen(true);
      setFemoFileError("");
      loadFemoFileList();
      return;
    }
    handleBrowseImport();
  }
  function loadFemoFileList() {
    setFemoFileLoading(true);
    return Promise.resolve().then(() => onListFemoFiles()).then(
      (list) => {
        setFemoFileList(Array.isArray(list) ? list : []);
      },
      (err) => {
        console.warn("[\u5BFC\u5165\u6E05\u5355] \u8BFB\u53D6\u5931\u8D25:", err);
        setFemoFileList([]);
        setFemoFileError(String(err?.message ?? err));
      }
    ).finally(() => {
      setFemoFileLoading(false);
    });
  }
  function handleBrowseImport() {
    if (plugin && typeof onImport === "function") {
      onImport().then((picked) => {
        if (picked === null) return;
        setFemoFileOpen(false);
        applyFEMOText(picked.content);
      }).catch((err) => {
        console.warn("[\u5BFC\u5165 .femo] \u5931\u8D25:", err);
        alert(String(err?.message ?? err));
      });
      return;
    }
    fileInputRef.current?.click();
  }
  function handlePickFromList(path) {
    if (typeof onPickFemoFile !== "function") return;
    setFemoFileBusyPath(path);
    onPickFemoFile(path).then((picked) => {
      setFemoFileOpen(false);
      setFemoFileError("");
      applyFEMOText(picked.content);
    }).catch((err) => {
      console.warn("[\u5BFC\u5165\u6E05\u5355] \u6253\u5F00\u5931\u8D25:", err);
      setFemoFileError(String(err?.message ?? err));
      loadFemoFileList();
    }).finally(() => {
      setFemoFileBusyPath(null);
    });
  }
  function handleForgetFromList(path) {
    if (typeof onForgetFemoFile !== "function" || femoFileForgetBusy) return;
    setFemoFileForgetBusy(true);
    Promise.resolve().then(() => onForgetFemoFile(path)).then(() => {
      setFemoFileError("");
      setFemoFileList((list) => list.filter((f) => f.path !== path));
    }).catch((err) => {
      console.warn("[\u5BFC\u5165\u6E05\u5355] \u79FB\u9664\u5931\u8D25:", err);
      setFemoFileError(String(err?.message ?? err));
      loadFemoFileList();
    }).finally(() => {
      setFemoFileForgetBusy(false);
    });
  }
  async function handleToolbarExport() {
    if (exportBusy) return;
    console.log("[\u5BFC\u51FA .femo] \u5F00\u59CB\u5373\u65F6\u751F\u6210");
    const exportText = handleGraphToFemo();
    console.log("[\u5BFC\u51FA .femo] \u751F\u6210\u5B8C\u6210, \u957F\u5EA6:", exportText.length);
    if (plugin && typeof onExport === "function") {
      setExportBusy(true);
      try {
        const path = await onExport(exportText, proj.name || "flow");
        if (path !== void 0) {
          console.log("[\u5BFC\u51FA .femo] \u5DF2\u4FDD\u5B58\u5230:", path);
          showExportToast(`\u2713 \u5DF2\u4FDD\u5B58\u5230 ${path}`);
        }
      } catch (err) {
        console.warn("[\u5BFC\u51FA .femo] \u4FDD\u5B58\u5931\u8D25:", err);
        alert(String(err?.message ?? err));
      } finally {
        setExportBusy(false);
      }
      return;
    }
    const blob = new Blob([exportText], {
      type: "text/plain"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${proj.name || "flow"}.femo`;
    a.click();
    console.log("[\u5BFC\u51FA .femo] \u4E0B\u8F7D\u5DF2\u89E6\u53D1");
    showExportToast(`\u2713 \u5DF2\u5F00\u59CB\u4E0B\u8F7D ${proj.name || "flow"}.femo`);
  }
  function applyFEMOText(text) {
    console.log("1. \u5F00\u59CB\u89E3\u6790");
    const parsed = parseFEMO(text);
    setFEMOrnings(parsed?.warnings || []);
    console.log("2. \u89E3\u6790\u5B8C\u6210", parsed);
    console.log("3. \u5F00\u59CB\u8F6C\u6362\u4E3A\u56FE");
    const {
      proj: _proj,
      libActions,
      libModules,
      nodes: newNodes,
      edges: newEdges,
      mainflowNodes,
      mainflowEdges
    } = parsedToGraph(parsed, mode, currentModuleName);
    let newProj = _proj;
    console.log("4. \u56FE\u8F6C\u6362\u5B8C\u6210", {
      libActions,
      libModules,
      nodes: newNodes,
      edges: newEdges
    });
    console.log("5. \u51C6\u5907 setState");
    if (parsed.meta.delay != null) {
      newProj = { ...newProj, delay: parsed.meta.delay };
    }
    setProj((prev) => ({ ...prev, ...newProj }));
    setActionStore(libActions);
    setModuleStore(libModules);
    const newFlowStore = (libModules || []).map((mod) => ({
      path: mod.path,
      nodes: mod.nodes || [],
      edges: mod.edges || []
    }));
    const targetPath = locationPath;
    const existingIdx = newFlowStore.findIndex(
      (f) => f.path.length === targetPath.length && f.path.every((s, i) => s === targetPath[i])
    );
    if (existingIdx >= 0) {
      newFlowStore[existingIdx] = {
        path: targetPath,
        nodes: newNodes,
        edges: newEdges
      };
    } else {
      newFlowStore.push({ path: targetPath, nodes: newNodes, edges: newEdges });
    }
    if (targetPath.length !== 1 || targetPath[0] !== "mainflow") {
      const mainflowIdx = newFlowStore.findIndex(
        (f) => f.path.length === 1 && f.path[0] === "mainflow"
      );
      if (mainflowIdx >= 0) {
        newFlowStore[mainflowIdx] = { path: ["mainflow"], nodes: mainflowNodes, edges: mainflowEdges };
      } else {
        newFlowStore.push({ path: ["mainflow"], nodes: mainflowNodes, edges: mainflowEdges });
      }
    }
    setFlowStore(newFlowStore);
    setNodes(newNodes);
    setEdges(newEdges);
    try {
      console.log("[femo-diag] applyFEMOText path=" + targetPath.join("/") + " nodes=" + newNodes.length + " edges=" + newEdges.length);
    } catch {
    }
    console.log("6. setState \u5B8C\u6210");
    setFemoDirty(false);
    setGraphDirty(false);
    setFemoError(null);
    setLastValidFemo(text);
    setSel(null);
    lastSyncedGraphRef.current = structuralSignature(newNodes, newEdges);
    console.log("7. \u5168\u90E8\u5B8C\u6210");
  }
  function handleGraphToFemo() {
    const flowMap = /* @__PURE__ */ new Map();
    flowStore.forEach((f) => flowMap.set(f.path.join("/"), f));
    flowMap.set(locationPath.join("/"), { path: locationPath, nodes, edges });
    const mainFlow = flowMap.get("mainflow");
    const mainNodes = mainFlow ? mainFlow.nodes : makeDefaultNodes("mainflow");
    const mainEdges = mainFlow ? mainFlow.edges : [];
    const mergedModules = moduleStore.map((mod) => {
      const key = mod.path.join("/");
      const flow = flowMap.get(key);
      return flow ? { ...mod, nodes: flow.nodes, edges: flow.edges } : mod;
    });
    const newFemo = buildFEMO(
      mainNodes,
      mainEdges,
      proj,
      mode,
      currentModuleName,
      mergedModules,
      actionStore
    );
    return newFemo;
  }
  function handleGraphToTextCommit() {
    const out = handleGraphToFemo();
    if (!out || !out.trim()) return;
    setFemoText(out);
    setLastValidFemo(out);
    setFemoError(null);
    setFEMOrnings([]);
    setFemoDirty(false);
    setGraphDirty(false);
    lastSyncedGraphRef.current = structuralSignature(nodes, edges);
    if (typeof onPersistScript === "function") onPersistScript(out);
  }
  const handleGraphToFemoRef = (0, import_react21.useRef)(handleGraphToFemo);
  handleGraphToFemoRef.current = handleGraphToFemo;
  function handleApplyFemo() {
    console.log("[handleApplyFemo] \u5F00\u59CB, femoText \u957F\u5EA6:", femoText?.length);
    try {
      applyFEMOText(femoText);
      if (typeof onPersistScript === "function") onPersistScript(femoText);
    } catch (err) {
      console.error("[handleApplyFemo] \u5F02\u5E38:", err.message);
      setFemoError(err.message);
      setFEMOrnings(warningsFromThrowable(err));
    }
  }
  function handleRestoreFemo() {
    setFemoText(lastValidFemo);
    setFemoDirty(false);
    setFemoError(null);
    setFEMOrnings([]);
  }
  const selNode = sel?.type === "node" ? nm.get(sel.id) : null;
  const selEdge = sel?.type === "edge" ? edges.find((e) => e.id === sel.id) : null;
  const selAction = selNode?.type === "action" ? actionStore.find((a) => a.id === selNode.actionId) : null;
  const isMobile = useMobile(768);
  const [mobileFs, setMobileFs] = (0, import_react21.useState)(false);
  const themeName = FEMO_THEMES.find((t) => t.id === themeSel)?.name || themeSel;
  const actorNames = (proj.actors || []).map((a) => a.name.replace("@", ""));
  function getTempConnLine() {
    if (!conn) return null;
    const srcNode = nm.get(conn.srcId);
    if (!srcNode) return null;
    const ss = getNodeSize(srcNode);
    let srcPort;
    switch (conn.srcDir) {
      case "top":
        srcPort = { x: srcNode.x + ss.w / 2, y: srcNode.y };
        break;
      case "bottom":
        srcPort = { x: srcNode.x + ss.w / 2, y: srcNode.y + ss.h };
        break;
      case "left":
        srcPort = { x: srcNode.x, y: srcNode.y + ss.h / 2 };
        break;
      case "right":
        srcPort = { x: srcNode.x + ss.w, y: srcNode.y + ss.h / 2 };
        break;
      case "center":
        srcPort = { x: conn.srcX || srcNode.x + ss.w / 2, y: conn.srcY || srcNode.y + ss.h / 2 };
        break;
      default:
        srcPort = { x: srcNode.x + ss.w, y: srcNode.y + ss.h / 2 };
    }
    const dx = (conn.mx || 0) - srcPort.x;
    const dy = (conn.my || 0) - srcPort.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const srcDir = horizontal ? dx >= 0 ? "right" : "left" : dy >= 0 ? "bottom" : "top";
    const endDir = horizontal ? dx >= 0 ? "left" : "right" : dy >= 0 ? "top" : "bottom";
    return smartBezier(
      srcPort.x,
      srcPort.y,
      srcDir,
      conn.mx || srcPort.x,
      conn.my || srcPort.y,
      endDir
    );
  }
  const handleDeleteSelNode = () => {
    if (!sel || sel.type !== "node") return;
    const node = nm.get(sel.id);
    if (node?.type === "special") {
      const isMandatory = node.specialType === "START" || node.specialType === "IN";
      const sameTypeNodes = nodes.filter((n) => n.type === "special" && n.specialType === node.specialType);
      const isOnlyExit = (node.specialType === "END" || node.specialType === "OUT") && sameTypeNodes.length <= 1;
      if (isMandatory || isOnlyExit) return;
    }
    deleteNode(sel.id);
  };
  const handleDeleteSelEdge = () => {
    if (!sel || sel.type !== "edge") return;
    setEdges((p) => p.filter((e) => e.id !== sel.id));
    setSel(null);
  };
  const handleCondChange = (cond) => {
    if (!sel || sel.type !== "edge") return;
    setEdges((p) => p.map((ed) => ed.id === sel.id ? { ...ed, cond } : ed));
  };
  const handleEditSelAction = () => {
    if (!selNode || !selAction) return;
    setModal({ type: "editNode", action: selAction, nodeId: selNode.id });
  };
  if (isMobile) {
    return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(ErrorBoundary, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FontStyle, { scoped: plugin }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        "input",
        {
          ref: fileInputRef,
          type: "file",
          accept: ".femo",
          style: { display: "none" },
          onChange: handleImportFile
        }
      ),
      runGuard !== null && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { position: "fixed", inset: 0, zIndex: 1e3, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: {
        maxWidth: 430,
        width: "calc(100% - 48px)",
        padding: "18px 20px",
        borderRadius: 12,
        background: "var(--femo-surface, #fff)",
        border: "1px solid var(--femo-border, #e0e0e0)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
        fontSize: 13,
        lineHeight: 1.6
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "\u26A0\uFE0F \u6709\u672A\u843D\u76D8\u4FEE\u6539" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { color: "var(--femo-text-secondary, #666)", marginBottom: 14 }, children: [
          runGuard.textDirty && runGuard.graphDirty ? "\u6587\u672C\u548C\u753B\u5E03\u56FE\u90FD\u88AB\u4FEE\u6539\u8FC7\uFF0C\u4E14\u4E92\u76F8\u4E0D\u7EDF\u4E00\u3002" : runGuard.textDirty ? "\u6587\u672C\u88AB\u4FEE\u6539\u8FC7\uFF0C\u5C1A\u672A\u5E94\u7528\u5230\u753B\u5E03\u548C record\u3002" : "\u753B\u5E03\u56FE\u88AB\u4FEE\u6539\u8FC7\uFF0C\u5C1A\u672A\u5E94\u7528\u5230\u6587\u672C\u548C record\u3002",
          "\u5EFA\u8BAE\u56DE\u53BB\u6309\u5BF9\u5E94\u7684\u7EDF\u4E00\u6309\u94AE\uFF08\u6587\u672C\u751F\u56FE / \u56FE\u751F\u6587\u672C\uFF09\u5E94\u7528\u4F60\u8981\u7684\u7248\u672C\uFF1B \u4E5F\u53EF\u4EE5\u653E\u5F03\u8FD9\u4E9B\u4FEE\u6539\uFF0C\u4EE5\u6700\u540E\u4FDD\u5B58\u7684 record \u4E3A\u51C6\u76F4\u63A5\u8FD0\u884C\u3002"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            "button",
            {
              onClick: () => setRunGuard(null),
              style: { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--femo-border, #ccc)", background: "transparent", cursor: "pointer" },
              children: "\u56DE\u53BB\u6838\u67E5"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            "button",
            {
              onClick: discardChangesAndRun,
              style: { padding: "6px 12px", borderRadius: 8, border: "1px solid #d96b2b", background: "#d96b2b", color: "#fff", cursor: "pointer" },
              children: "\u653E\u5F03\u4FEE\u6539\uFF0C\u76F4\u63A5\u8DD1"
            }
          )
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        MobileLayout,
        {
          theme,
          zIndex: plugin && mobileFs ? 900 : void 0,
          fixedMode: plugin ? mobileFs : true,
          onBack: plugin ? () => {
            setMobileFs(false);
            onBackToShell?.();
          } : void 0,
          onExpand: plugin ? () => setMobileFs(true) : void 0,
          themeName,
          onCycleTheme: cycleTheme,
          proj,
          actorNames,
          onProjChange: setProj,
          cvRef,
          pan,
          setPan,
          scale,
          setScale,
          nodes,
          setNodes,
          edges,
          sel,
          setSel,
          drag,
          setDrag,
          conn,
          setConn,
          isPanning,
          onMM,
          onMU,
          onCanvasDown,
          handleWheel,
          handlePortDown,
          handlePortUp,
          handleCanvasDragOver,
          handleCanvasDrop,
          canvasOpacity,
          canvasContent: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
              "svg",
              {
                style: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 24 },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("defs", { children: [["a", "var(--femo-edge-flow)"], ["as", "var(--femo-edge-sel)"], ["a_for", "var(--femo-edge)"], ["al", "var(--femo-danger)"], ["aj", "var(--femo-warning)"]].map(([id, col]) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("marker", { id, markerWidth: "8", markerHeight: "6", refX: "7", refY: "3", orient: "auto", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("polygon", { points: "0 0, 8 3, 0 6", fill: col }) }, id)) }),
                  sortedEdges.map((e) => {
                    const s = nm.get(e.src), t = nm.get(e.tgt);
                    if (!s || !t) return null;
                    const isCycleEdge = allCycleEdges.has(e.id);
                    const isParCycle = parCycleEdges.has(e.id);
                    const isParBroken = parBrokenEdges.has(e.id);
                    const isForBroken = forBrokenEdges.has(e.id) && !isCycleEdge;
                    const isSel = sel?.type === "edge" && sel.id === e.id;
                    if (e.src === e.tgt) {
                      const ss = getNodeSize(s);
                      const cx = s.x + ss.w / 2, cy = s.y + ss.h / 2;
                      const pathD = `M${s.x + ss.w},${cy} C${cx + ss.w * 0.8},${s.y - ss.h * 0.4} ${cx + ss.w * 0.8},${s.y - ss.h * 0.4} ${cx},${s.y}`;
                      return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("g", { children: [
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("path", { d: pathD, fill: "none", stroke: "transparent", "data-edge-id": e.id, strokeWidth: 18, style: { cursor: "pointer", pointerEvents: "stroke" }, onClick: (ev) => {
                          ev.stopPropagation();
                          setSel({ type: "edge", id: e.id });
                        } }),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("path", { d: pathD, fill: "none", stroke: isSel ? "var(--femo-edge-sel)" : "var(--femo-edge)", strokeDasharray: "5,3", markerEnd: `url(#${isSel ? "as" : "a_for"})`, style: { pointerEvents: "none", strokeWidth: isSel ? "var(--femo-edge-w-sel)" : "var(--femo-edge-w-thin)" } }),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(EdgeShimmer, { d: pathD, w: 0.85 })
                      ] }, e.id);
                    }
                    const geo = computeEdgeGeometry(e, s, t, {
                      isCycleEdge,
                      isParEdge: isParCycle || isParBroken,
                      parLineCount: 5,
                      parGap: 6,
                      portEdgeGroupMap
                    });
                    if (!geo) return null;
                    const { pathDs, labelPos, srcDir, tgtDir } = geo;
                    const stroke = isSel ? "var(--femo-edge-sel)" : isParBroken || isForBroken ? "var(--femo-danger)" : isCycleEdge || isParCycle ? "var(--femo-edge)" : "var(--femo-edge-flow)";
                    const dashed = isParBroken || isForBroken ? "5,3" : null;
                    const markerId = isSel ? "as" : isParBroken || isForBroken ? "al" : isCycleEdge || isParCycle ? "a_for" : "a";
                    return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("g", { children: [
                      pathDs.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("path", { d, fill: "none", stroke: "transparent", "data-edge-id": e.id, strokeWidth: 18, style: { cursor: "pointer", pointerEvents: "stroke" }, onClick: (ev) => {
                        ev.stopPropagation();
                        setSel({ type: "edge", id: e.id });
                      } }, i)),
                      pathDs.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("g", { children: [
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("path", { d, fill: "none", stroke, strokeDasharray: dashed, markerEnd: `url(#${markerId})`, style: { pointerEvents: "none", strokeWidth: isSel ? "var(--femo-edge-w-sel)" : "var(--femo-edge-w-thin)" } }),
                        !(isParBroken || isForBroken) && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(EdgeShimmer, { d, w: 0.85 })
                      ] }, `v${i}`)),
                      e.cond && labelPos && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        "text",
                        {
                          x: labelPos.x,
                          y: labelPos.y + 4.5,
                          textAnchor: "middle",
                          fontSize: 9.5,
                          fontWeight: 700,
                          fill: stroke,
                          fontFamily: "var(--femo-font-mono)",
                          style: { pointerEvents: "none" },
                          children: e.cond
                        }
                      )
                    ] }, e.id);
                  }),
                  conn && (() => {
                    const d = getTempConnLine();
                    return d ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("path", { d, fill: "none", stroke: "var(--femo-primary)", strokeWidth: 2, strokeDasharray: "6,3", style: { pointerEvents: "none" } }) : null;
                  })()
                ]
              }
            ),
            nodes.map((n) => {
              const enrichedNode = n.type === "action" ? { ...n, action: actionMap.get(n.actionId) } : n;
              const commonProps = {
                sel: sel?.type === "node" && sel.id === enrichedNode.id,
                onBody: (e) => {
                  e.stopPropagation();
                  if (drag || isPanning || conn) {
                    setDrag(null);
                    setIsPanning(false);
                    setConn(null);
                    return;
                  }
                  setSel({ type: "node", id: enrichedNode.id });
                  setDrag({ id: enrichedNode.id, sx: e.clientX, sy: e.clientY, ox: enrichedNode.x, oy: enrichedNode.y });
                },
                onPortDown: (e, dir) => handlePortDown(e, enrichedNode.id, dir),
                onPortUp: (e, dir) => handlePortUp(e, enrichedNode.id, dir),
                onBodyMouseUp: (e) => handleBodyMouseUp(e, enrichedNode.id)
              };
              if (enrichedNode.type === "special") return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(SpecialNodeView, { node: enrichedNode, ...commonProps, isActive: activeNodeIds.has(enrichedNode.id) }, enrichedNode.id);
              if (enrichedNode.type === "for_out") {
                const motherNode = enrichedNode.forNodeId ? nm.get(enrichedNode.forNodeId) : null;
                return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(ForOutNodeView, { node: enrichedNode, sel: sel?.type === "node" && sel.id === enrichedNode.id, forSpecialType: motherNode?.specialType || "FOR", onBodyMouseUp: (e) => handleBodyMouseUp(e, enrichedNode.id), onBubbleClick: (nid2) => {
                  setDrag(null);
                  setConn(null);
                  setIsPanning(false);
                  setSel({ type: "node", id: nid2 });
                }, onPortDown: (e, dir, x, y) => handlePortDown(e, enrichedNode.id, dir, x, y), onPortUp: (e, dir) => handlePortUp(e, enrichedNode.id, dir) }, enrichedNode.id);
              }
              if (enrichedNode.type === "par_out") return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(ParOutNodeView, { node: enrichedNode, sel: sel?.type === "node" && sel.id === enrichedNode.id, onBody: (e) => {
                e.stopPropagation();
                if (drag || isPanning || conn) {
                  setDrag(null);
                  setIsPanning(false);
                  setConn(null);
                  return;
                }
                setSel({ type: "node", id: enrichedNode.id });
                setDrag({ id: enrichedNode.id, sx: e.clientX, sy: e.clientY, ox: enrichedNode.x, oy: enrichedNode.y });
              }, onPortDown: (e, dir) => handlePortDown(e, enrichedNode.id, dir), onPortUp: (e, dir) => handlePortUp(e, enrichedNode.id, dir), onBodyMouseUp: (e) => handleBodyMouseUp(e, enrichedNode.id) }, enrichedNode.id);
              if (enrichedNode.type === "position") return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PositionNodeView, { node: enrichedNode, ...commonProps }, enrichedNode.id);
              return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(ActionNodeView, { node: enrichedNode, ...commonProps, onBubbleClick: handleBubbleClick, nodeState: nodeStates[enrichedNode.id], isActive: activeNodeIds.has(enrichedNode.id), errorNodeIds, onDbl: () => {
                if (enrichedNode.type === "action" && enrichedNode.action) setModal({ type: "editNode", action: enrichedNode.action, nodeId: enrichedNode.id });
                else if (enrichedNode.type === "module") {
                  const mod = enrichedNode.modDef;
                  if (mod) editModule(mod);
                }
              } }, enrichedNode.id);
            })
          ] }),
          lib,
          mode,
          locationPath,
          allNames,
          onNew: () => setModal({ type: "new" }),
          onAdd: addNode,
          onAddModule: addModuleNode,
          onAddSpecial: addSpecialNode,
          onAddPosition: addPositionNode,
          onEdit: (a) => setModal({ type: "edit", action: a }),
          onEditModule: editModule,
          onNodeDoubleTap: (nodeId) => {
            const node = nm.get(nodeId);
            if (!node) return;
            if (node.type === "module") {
              const mod = node.modDef;
              if (mod) editModule(mod);
            } else if (node.type === "action") {
              const action = actionMap.get(node.actionId);
              if (action) setModal({ type: "editNode", action, nodeId });
            }
          },
          onNavigatePath: (path) => {
            saveCurrentFlow();
            setLocationPath(path);
          },
          onEnterModuleNode: (nodeId) => {
            const mod = nm.get(nodeId)?.modDef;
            if (mod) editModule(mod);
          },
          onDragStart: handleLibDragStart,
          onSelectLib: handleSelectLib,
          onNewModule: (name) => {
            const newPath = [...locationPath, name];
            const newModule = { id: mid(), name, path: newPath, meta: {}, code: [], vars: [], nodes: makeDefaultNodes("module"), edges: [] };
            saveCurrentFlow();
            setModuleStore((prev) => [...prev, newModule]);
            setFlowStore((prev) => [...prev, { path: newPath, nodes: newModule.nodes, edges: newModule.edges }]);
            setLocationPath(newPath);
            setNodes(newModule.nodes);
            setEdges(newModule.edges);
            setFemoDirty(false);
          },
          libSel,
          flowStatus,
          hasActiveRunningNodes,
          onRun: () => handleRunWorkflow(void 0, "human", { reset: true }),
          onPause: handlePauseWorkflow,
          onResume: handleResumeWorkflow,
          nodeStates,
          actionStore,
          activeNodeIds,
          errorNodeIds,
          bubbleOverlay,
          onBubbleClose: handleBubbleClose,
          submitHumanInput,
          humanWaits,
          onBubbleClick: handleBubbleClick,
          femoText,
          onFemoChange: (v) => {
            setFemoText(v);
            setFemoDirty(true);
          },
          femoError,
          FEMOrnings,
          femoDirty,
          debugLog,
          onClearDebug: () => setDebugLog([]),
          compilerLog,
          onClearCompiler: () => setCompilerLog([]),
          femogenLog,
          onClearFemogen: clearFemogenLog,
          hostLog,
          onClearHost: () => setHostLog([]),
          onCompileDebug: handleDebugRun,
          compilingDebug: debugRunning,
          onApplyFemo: handleApplyFemo,
          onRestoreFemo: handleRestoreFemo,
          onGraphToFemo: handleGraphToTextCommit,
          onImport: handleToolbarImport,
          onExport: handleToolbarExport,
          exportBusy,
          exportToast,
          onOpenSoul: () => {
            setSoulForm({ soul_id: "", soul_name: "", description: "" });
            setSoulFormError("");
            setSoulModalOpen(true);
          },
          backEdges,
          onDeleteNode: handleDeleteSelNode,
          onDeleteEdge: handleDeleteSelEdge,
          onCondChange: handleCondChange,
          onEditAction: handleEditSelAction
        }
      ),
      modal && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        ActionModal,
        {
          init: modal.type !== "new" ? modal.action : null,
          existingNames: [...allNames],
          isModuleInternal: mode === "module",
          onSave: (action) => {
            const actionWithPath = { ...action, path: action.path || [...locationPath] };
            if (modal.type === "editNode") {
              setNodes((p) => p.map((n) => n.id === modal.nodeId ? { ...n, label: `[${actionWithPath.name}]` } : n));
            } else if (modal.type === "edit") {
              setNodes((p) => p.map((n) => n.actionId === actionWithPath.id ? { ...n, label: `[${actionWithPath.name}]` } : n));
            } else {
              addNode(actionWithPath);
            }
            setActionStore((prev) => {
              const idx = prev.findIndex((a) => a.id === actionWithPath.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = actionWithPath;
                return updated;
              }
              return [...prev, actionWithPath];
            });
            setModal(null);
          },
          onClose: () => setModal(null)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        SoulModal,
        {
          open: soulModalOpen,
          onClose: () => setSoulModalOpen(false),
          onCreated: () => setSoulModalOpen(false),
          createUrl: plugin ? "/femo-plugin/souls" : getBackendBaseUrl() + "/api/souls/create"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        FemoFileList,
        {
          open: femoFileOpen,
          files: femoFileList,
          loading: femoFileLoading,
          error: femoFileError,
          busyPath: femoFileBusyPath,
          onPick: handlePickFromList,
          onForget: typeof onForgetFemoFile === "function" ? handleForgetFromList : void 0,
          onClose: () => setFemoFileOpen(false)
        }
      )
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(ErrorBoundary, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FontStyle, { scoped: plugin }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
      "div",
      {
        ref: editorRootRef,
        "data-femo-theme": theme,
        style: {
          display: "flex",
          // 插件模式整体缩放锁定 75%（zoom 连布局尺寸一起缩；
          // 弹窗 fixed 相对本容器定位，inset:0 跟随缩放）。
          width: "100%",
          height: plugin ? "100%" : "100vh",
          zoom: plugin ? 0.75 : 1,
          background: "var(--femo-app-bg)",
          fontFamily: "var(--femo-font-sans)",
          overflow: "hidden"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
            "div",
            {
              style: {
                width: 232,
                background: "var(--femo-panel-bg)",
                borderRight: "var(--femo-border-w) solid var(--femo-border)",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
                zIndex: 10,
                position: "relative"
                // 调试窗口浮层的定位锚（absolute inset:0 盖住边栏）
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                  "div",
                  {
                    style: {
                      height: 50,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      padding: "0 16px",
                      borderBottom: "var(--femo-border-w) solid var(--femo-border)",
                      flexShrink: 0
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                        "div",
                        {
                          style: {
                            fontWeight: 900,
                            fontSize: 18,
                            color: "var(--femo-text-1)",
                            letterSpacing: "-0.03em"
                          },
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { style: { color: "var(--femo-primary)" }, children: "FEMO" }),
                            " Studio"
                          ]
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        "div",
                        {
                          style: {
                            fontSize: 10.5,
                            color: "var(--femo-neutral)",
                            marginTop: 2,
                            letterSpacing: "0.01em"
                          },
                          children: "Flow EMerges Opus."
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { display: "flex", borderBottom: "var(--femo-border-w) solid var(--femo-border)" }, children: [
                  ["library", "\u7EC4\u4EF6\u5E93"],
                  ["project", "\u9879\u76EE\u8BBE\u7F6E"]
                ].map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                  "button",
                  {
                    onClick: () => setTab(k),
                    style: {
                      flex: 1,
                      padding: "9px 0",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: tab === k ? "var(--femo-primary)" : "var(--femo-neutral)",
                      borderBottom: `var(--femo-border-w-selected) solid ${tab === k ? "var(--femo-primary)" : "transparent"}`,
                      fontFamily: "var(--femo-font-sans)",
                      transition: "all 0.12s"
                    },
                    children: v
                  },
                  k
                )) }),
                /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { flex: 1, overflow: "auto", padding: "13px 13px" }, children: tab === "library" ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                  LibPanel,
                  {
                    lib,
                    mode,
                    locationPath,
                    allNames,
                    onNew: () => setModal({ type: "new" }),
                    onNewModule: (name) => {
                      const newPath = [...locationPath, name];
                      const newModule = {
                        id: mid(),
                        name,
                        path: newPath,
                        meta: {},
                        code: [],
                        vars: [],
                        nodes: makeDefaultNodes("module"),
                        edges: []
                      };
                      saveCurrentFlow();
                      setModuleStore((prev) => [...prev, newModule]);
                      setFlowStore((prev) => [
                        ...prev,
                        {
                          path: newPath,
                          nodes: newModule.nodes,
                          edges: newModule.edges
                        }
                      ]);
                      setLocationPath(newPath);
                      setNodes(newModule.nodes);
                      setEdges(newModule.edges);
                      setFemoDirty(false);
                    },
                    onSelectLib: handleSelectLib,
                    onAdd: addNode,
                    onAddModule: addModuleNode,
                    onAddSpecial: addSpecialNode,
                    onAddPosition: addPositionNode,
                    onEdit: (a) => setModal({ type: "edit", action: a }),
                    onEditModule: editModule,
                    onDragStart: handleLibDragStart
                  }
                ) : mode === "module" ? (() => {
                  const currentMod = moduleStore.find(
                    (m) => m.path.length === locationPath.length && m.path.every((s, i) => s === locationPath[i])
                  );
                  if (!currentMod) return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { color: "var(--femo-text-4-weak)", fontSize: 12 }, children: "\u672A\u627E\u5230\u6A21\u5757" });
                  const modAsProj = {
                    ...currentMod.meta,
                    name: currentMod.name,
                    vars: currentMod.vars || [],
                    code: currentMod.code || [],
                    actors: []
                  };
                  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                    ProjPanel,
                    {
                      proj: modAsProj,
                      actorNames: [],
                      onChange: (newData) => {
                        const { name, vars, code, actors, ...meta } = newData;
                        setModuleStore(
                          (prev) => prev.map(
                            (m) => m.path.length === locationPath.length && m.path.every((s, i) => s === locationPath[i]) ? { ...m, name: name || m.name, meta, vars: vars || [], code: code || [] } : m
                          )
                        );
                      }
                    }
                  );
                })() : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                  ProjPanel,
                  {
                    proj,
                    actorNames: (proj.actors || []).map(
                      (a) => a.name.replace("@", "")
                    ),
                    onChange: setProj
                  }
                ) }),
                /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: {
                  borderTop: "var(--femo-border-w) solid var(--femo-border)",
                  padding: "10px 13px",
                  display: "flex",
                  gap: 8,
                  flexShrink: 0
                }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                    "button",
                    {
                      onClick: cycleTheme,
                      title: `\u4E3B\u9898\uFF1A${FEMO_THEMES.find((t) => t.id === themeSel)?.desc || themeSel}\uFF08\u70B9\u51FB\u5207\u6362\uFF09`,
                      className: "femo-setting-btn",
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        minHeight: 30,
                        boxSizing: "border-box",
                        padding: "6px 8px",
                        borderRadius: "var(--femo-radius-md)",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--femo-font-sans)",
                        cursor: "pointer",
                        transition: "all 0.12s",
                        border: "var(--femo-border-w) solid var(--femo-border-strong)",
                        background: "var(--femo-bg)",
                        color: "var(--femo-text-2)",
                        flex: "1 1 0",
                        minWidth: 0,
                        overflow: "hidden"
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FaPalette, { size: 12, style: { flexShrink: 0 } }),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: FEMO_THEMES.find((t) => t.id === themeSel)?.name || themeSel })
                      ]
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                    "button",
                    {
                      onClick: () => {
                        setSoulForm({ soul_id: "", soul_name: "", description: "" });
                        setSoulFormError("");
                        setSoulModalOpen(true);
                      },
                      title: "\u65B0\u5EFA SOUL",
                      className: "femo-setting-btn",
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        minHeight: 30,
                        boxSizing: "border-box",
                        padding: "6px 8px",
                        borderRadius: "var(--femo-radius-md)",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--femo-font-sans)",
                        cursor: "pointer",
                        transition: "all 0.12s",
                        border: "var(--femo-border-w) solid var(--femo-border-strong)",
                        background: "var(--femo-bg)",
                        color: "var(--femo-text-2)",
                        flex: "1 1 0",
                        minWidth: 0,
                        overflow: "hidden"
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FaUserPlus, { size: 12, style: { flexShrink: 0 } }),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: "\u65B0\u5EFA SOUL" })
                      ]
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                    "button",
                    {
                      onClick: () => setDebugOpen(true),
                      title: "\u8C03\u8BD5\u7A97\u53E3\uFF1A\u540E\u7AEF\u8FD0\u884C\u4FE1\u606F\u4E0E\u62A5\u9519\u7684\u5E38\u9A7B\u65E5\u5FD7\u6D41\uFF08\u65B0\u72B6\u6001\u628A\u65E7\u8BB0\u5F55\u5237\u4E0B\u53BB\uFF09",
                      className: "femo-setting-btn",
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        minHeight: 30,
                        boxSizing: "border-box",
                        padding: "6px 8px",
                        borderRadius: "var(--femo-radius-md)",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--femo-font-sans)",
                        cursor: "pointer",
                        transition: "all 0.12s",
                        border: "var(--femo-border-w) solid var(--femo-border-strong)",
                        background: "var(--femo-bg)",
                        color: "var(--femo-text-2)",
                        flex: "1 1 0",
                        minWidth: 0,
                        overflow: "hidden",
                        position: "relative"
                      },
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FaTerminal, { size: 12, style: { flexShrink: 0 } }),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }, children: "\u8C03\u8BD5" }),
                        debugLog.some((e) => e.level === "error") && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                          "span",
                          {
                            style: {
                              position: "absolute",
                              top: 3,
                              right: 3,
                              width: 8,
                              height: 8,
                              borderRadius: "var(--femo-radius-pill)",
                              background: "var(--femo-danger)",
                              border: "1.5px solid var(--femo-bg)"
                            }
                          }
                        )
                      ]
                    }
                  )
                ] }),
                debugOpen && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                  DebugPanel,
                  {
                    entries: debugLog,
                    onClose: () => setDebugOpen(false),
                    onClear: () => setDebugLog([]),
                    compilerEntries: compilerLog,
                    onClearCompiler: () => setCompilerLog([]),
                    femogenEntries: femogenLog,
                    onClearFemogen: clearFemogenLog,
                    hostEntries: hostLog,
                    onClearHost: () => setHostLog([]),
                    onCompile: handleDebugRun,
                    compiling: debugRunning
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
            "div",
            {
              style: {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                  "div",
                  {
                    style: {
                      height: 50,
                      position: "relative",
                      // 导出保存回执 toast 的定位锚点
                      background: "var(--femo-panel-bg)",
                      borderBottom: "var(--femo-border-w) solid var(--femo-border)",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 16px",
                      gap: 10,
                      flexShrink: 0
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { style: { fontSize: 11.5, color: "var(--femo-text-3)", fontWeight: 600 }, children: "\u4F4D\u7F6E" }),
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        "button",
                        {
                          onClick: () => {
                            if (locationPath.length !== 1 || locationPath[0] !== "mainflow") {
                              saveCurrentFlow();
                              setLocationPath(["mainflow"]);
                            }
                          },
                          disabled: locationPath.length === 1 && locationPath[0] === "mainflow",
                          style: {
                            padding: "4px 13px",
                            borderRadius: "var(--femo-radius-sm)",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: "var(--femo-font-sans)",
                            border: `var(--femo-border-w-strong) solid ${mode === "mainflow" ? "var(--femo-primary)" : "var(--femo-border-strong)"}`,
                            background: mode === "mainflow" ? "var(--femo-primary-soft-2)" : "var(--femo-surface)",
                            color: mode === "mainflow" ? "var(--femo-primary)" : "var(--femo-text-3)",
                            opacity: mode === "mainflow" ? 0.7 : 1
                          },
                          children: "\u4E3B\u6D41\u7A0B"
                        }
                      ),
                      locationPath.map((seg, idx) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react21.default.Fragment, { children: [
                        idx > 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                          "span",
                          {
                            style: { color: "var(--femo-text-4)", fontSize: 12, fontWeight: 600 },
                            children: ">"
                          }
                        ),
                        idx === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                          "button",
                          {
                            onClick: () => {
                              saveCurrentFlow();
                              const newPath = locationPath.slice(0, idx + 1);
                              setLocationPath(newPath);
                            },
                            style: {
                              padding: "4px 10px",
                              borderRadius: "var(--femo-radius-sm)",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                              border: `var(--femo-border-w-strong) solid var(--femo-border-strong)`,
                              background: "var(--femo-surface)",
                              color: "var(--femo-text-3)"
                            },
                            children: seg
                          }
                        )
                      ] }, idx)),
                      mode === "module" && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        "button",
                        {
                          onClick: () => {
                            saveCurrentFlow();
                            const newPath = locationPath.slice(0, -1);
                            setLocationPath(newPath);
                          },
                          style: {
                            padding: "4px 12px",
                            fontSize: 11,
                            background: "var(--femo-border-strong)",
                            border: "none",
                            borderRadius: "var(--femo-radius-md)",
                            cursor: "pointer"
                          },
                          children: "\u8FD4\u56DE\u4E0A\u7EA7"
                        }
                      ),
                      " ",
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { flex: 1 } }),
                      exportToast !== null && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        "div",
                        {
                          style: {
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            right: 12,
                            zIndex: 90,
                            maxWidth: "min(560px, 100%)",
                            padding: "7px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            lineHeight: 1.5,
                            fontWeight: 600,
                            wordBreak: "break-all",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                            background: "var(--femo-panel-bg)",
                            border: "1px solid var(--femo-success, #3ca050)",
                            color: "var(--femo-success, #3ca050)"
                          },
                          children: exportToast.text
                        },
                        exportToast.id
                      ),
                      pauseNotice !== null && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                        "div",
                        {
                          style: {
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            right: 12,
                            transform: "translateY(-44px)",
                            zIndex: 91,
                            maxWidth: "min(560px, 100%)",
                            padding: "7px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            lineHeight: 1.5,
                            fontWeight: 600,
                            wordBreak: "break-all",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                            background: "var(--femo-panel-bg)",
                            border: `1px solid ${pauseNotice.level === "error" ? "var(--femo-danger, #d24b4b)" : pauseNotice.level === "info" ? "var(--femo-ok, #4b9ad2)" : "var(--femo-warn, #d29a4b)"}`,
                            color: pauseNotice.level === "error" ? "var(--femo-danger, #d24b4b)" : pauseNotice.level === "info" ? "var(--femo-ok, #4b9ad2)" : "var(--femo-warn, #d29a4b)"
                          },
                          children: [
                            pauseNotice.level === "error" ? "\u26D4 " : pauseNotice.level === "info" ? "\u2705 " : "\u26A0\uFE0F ",
                            pauseNotice.text
                          ]
                        },
                        pauseNotice.id
                      ),
                      (flowStatus === "idle" || flowStatus === "paused") && (enginePending ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(ToolChip, { icon: FaSpinner, tone: "neutral", disabled: true, title: "\u5F15\u64CE\u51B7\u542F\u52A8\u4E2D\uFF08bridge \u672A\u5C31\u7EEA\uFF09\u2014\u2014\u5C31\u7EEA\u540E\u5373\u53EF\u5F00\u6F14", children: "\u5F15\u64CE\u542F\u52A8\u4E2D\u2026" }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        ToolChip,
                        {
                          icon: FaPlay,
                          tone: "success",
                          onClick: () => handleRunWorkflow(void 0, "human", { reset: true }),
                          title: "\u4ECE\u5934\u5F00\u6F14\u6574\u4E2A\u5267\u672C\uFF08fresh start\uFF1B\u6302\u8D77\u7684\u4E00\u573A\u4F1A\u81EA\u52A8\u5B58\u6863\uFF09",
                          children: "\u8FD0\u884C"
                        }
                      )),
                      flowStatus === "running" && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        ToolChip,
                        {
                          icon: FaPause,
                          tone: "danger",
                          onClick: handlePauseWorkflow,
                          title: "\u6682\u505C\uFF08\u53EF\u7EED\u8DD1\uFF1A\u65AD\u70B9\u4FDD\u7559\uFF0C\u4E4B\u540E\u53EF\u70B9\u300C\u7EE7\u7EED\u300D\u63A5\u7740\u8DD1\uFF09",
                          children: "\u6682\u505C"
                        }
                      ),
                      flowStatus === "paused" && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        ToolChip,
                        {
                          icon: FaForward,
                          tone: "warning",
                          onClick: handleResumeWorkflow,
                          title: "\u7EE7\u7EED\uFF08\u4ECE\u65AD\u70B9\u7EED\u8DD1\uFF09",
                          children: "\u7EE7\u7EED"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        "input",
                        {
                          ref: fileInputRef,
                          type: "file",
                          accept: ".femo",
                          style: { display: "none" },
                          onChange: handleImportFile
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        ToolChip,
                        {
                          icon: FaFolderOpen,
                          tone: "neutral",
                          onClick: handleToolbarImport,
                          title: "\u5BFC\u5165 .femo\uFF08\u6253\u5F00\u672C\u5730\u5267\u672C\u6587\u4EF6\uFF09",
                          children: "\u5BFC\u5165"
                        }
                      ),
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        ToolChip,
                        {
                          icon: FaFloppyDisk,
                          tone: "neutral",
                          onClick: handleToolbarExport,
                          disabled: exportBusy,
                          title: exportBusy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u5BFC\u51FA .femo\uFF08\u628A\u5F53\u524D\u5267\u672C\u4FDD\u5B58\u5230\u672C\u5730\uFF09",
                          children: exportBusy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u5BFC\u51FA"
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                  "div",
                  {
                    ref: cvRef,
                    style: {
                      flex: 1,
                      position: "relative",
                      overflow: "hidden",
                      overscrollBehaviorX: "contain",
                      overscrollBehaviorY: "contain",
                      /*禁止浏览器返回手势的冲突*/
                      backgroundImage: "var(--femo-canvas-dots)",
                      backgroundSize: "22px 22px",
                      cursor: isPanning ? "grabbing" : conn ? "crosshair" : "default"
                    },
                    onMouseMove: onMM,
                    onMouseUp: onMU,
                    onMouseDown: onCanvasDown,
                    onWheel: handleWheel,
                    onMouseLeave: () => {
                      setDrag(null);
                      setConn(null);
                      setIsPanning(false);
                      isDraggingRef.current = false;
                      isMouseDownRef.current = false;
                    },
                    onDragOver: handleCanvasDragOver,
                    onDrop: handleCanvasDrop,
                    children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                      "div",
                      {
                        "data-canvas-bg": "true",
                        style: {
                          opacity: canvasOpacity,
                          transition: "opacity 0.2s ease",
                          position: "absolute",
                          inset: 0
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                          "div",
                          {
                            "data-canvas-bg": "true",
                            style: {
                              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                              transformOrigin: "0 0",
                              position: "absolute",
                              inset: 0
                            },
                            children: [
                              /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                                "svg",
                                {
                                  style: {
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    pointerEvents: "none",
                                    overflow: "visible",
                                    zIndex: 24
                                  },
                                  children: [
                                    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("defs", { children: [
                                      ["a", "var(--femo-edge-flow)"],
                                      ["as", "var(--femo-edge-sel)"],
                                      ["a_for", "var(--femo-edge)"],
                                      ["al", "var(--femo-danger)"],
                                      ["aj", "var(--femo-warning)"]
                                    ].map(([id, col]) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                      "marker",
                                      {
                                        id,
                                        markerWidth: "8",
                                        markerHeight: "6",
                                        refX: "7",
                                        refY: "3",
                                        orient: "auto",
                                        children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("polygon", { points: "0 0, 8 3, 0 6", fill: col })
                                      },
                                      id
                                    )) }),
                                    sortedEdges.map((e) => {
                                      const s = nm.get(e.src), t = nm.get(e.tgt);
                                      if (!s || !t) return null;
                                      const isBack = backEdges.has(e.id);
                                      const isCycleEdge = allCycleEdges.has(e.id);
                                      if (e.src === e.tgt) {
                                        const ss = getNodeSize(s);
                                        const cx = s.x + ss.w / 2;
                                        const cy = s.y + ss.h / 2;
                                        const startX = s.x + ss.w;
                                        const startY = cy;
                                        const endX = cx;
                                        const endY = s.y;
                                        const midX = cx + ss.w * 0.8;
                                        const midY = s.y - ss.h * 0.4;
                                        const pathD = `M${startX},${startY} C${midX},${midY} ${midX},${midY} ${endX},${endY}`;
                                        const isSel2 = sel?.type === "edge" && sel.id === e.id;
                                        console.log("[SVG self-loop] edge.id=", e.id, "pathD=", pathD);
                                        return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("g", { children: [
                                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                            "path",
                                            {
                                              d: pathD,
                                              fill: "none",
                                              stroke: "transparent",
                                              "data-edge-id": e.id,
                                              strokeWidth: 18,
                                              style: { cursor: "pointer", pointerEvents: "stroke" },
                                              onMouseDown: (ev) => ev.stopPropagation(),
                                              onClick: (ev) => {
                                                ev.stopPropagation();
                                                setSel({ type: "edge", id: e.id });
                                              }
                                            }
                                          ),
                                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                            "path",
                                            {
                                              d: pathD,
                                              fill: "none",
                                              stroke: isSel2 ? "var(--femo-edge-sel)" : "var(--femo-edge)",
                                              markerEnd: "url(#a)",
                                              style: { strokeWidth: isSel2 ? "var(--femo-edge-w-sel)" : "var(--femo-edge-w)" }
                                            }
                                          ),
                                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(EdgeShimmer, { d: pathD, w: 1 })
                                        ] }, e.id);
                                      }
                                      const isParCycle = parCycleEdges.has(e.id);
                                      const isParBroken = parBrokenEdges.has(e.id);
                                      const isParEdge = isParCycle || isParBroken;
                                      const geo = computeEdgeGeometry(e, s, t, {
                                        isCycleEdge,
                                        isParEdge,
                                        parLineCount: 5,
                                        parGap: 6,
                                        portEdgeGroupMap
                                      });
                                      if (!geo) return null;
                                      const isSel = sel?.type === "edge" && sel.id === e.id;
                                      const isForBroken = forBrokenEdges.has(e.id) && !isCycleEdge;
                                      const isForOutEdge = nodes.some((n) => (n.type === "for_out" || n.type === "par_out") && (n.id === e.src || n.id === e.tgt));
                                      const isForBrokenFinal = isForBroken && !isForOutEdge;
                                      const col = isParBroken ? "var(--femo-danger)" : isParCycle ? "var(--femo-edge)" : isForOutEdge ? "var(--femo-edge)" : isCycleEdge ? "var(--femo-edge)" : isForBrokenFinal ? "var(--femo-danger)" : isSel ? "var(--femo-edge-sel)" : "var(--femo-edge-flow)";
                                      const mkr = isParBroken ? "al" : isParCycle ? "a_for" : isForBrokenFinal ? "al" : isSel ? "as" : isForOutEdge || isCycleEdge ? "a_for" : "a";
                                      const dashArray = isParBroken || isForBrokenFinal ? "5,3" : "none";
                                      return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("g", { children: [
                                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                          "path",
                                          {
                                            d: geo.pathDs[geo.midIdx],
                                            fill: "none",
                                            stroke: "transparent",
                                            "data-edge-id": e.id,
                                            strokeWidth: isParEdge ? 24 : 18,
                                            style: { cursor: "pointer", pointerEvents: "stroke" },
                                            onClick: (ev) => {
                                              ev.stopPropagation();
                                              setSel({ type: "edge", id: e.id });
                                            }
                                          }
                                        ),
                                        geo.pathDs.map((pathD, i) => /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("g", { children: [
                                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                            "path",
                                            {
                                              d: pathD,
                                              fill: "none",
                                              stroke: col,
                                              strokeDasharray: dashArray,
                                              markerEnd: `url(#${mkr})`,
                                              style: { pointerEvents: "none", strokeWidth: isSel ? "var(--femo-edge-w-sel)" : "var(--femo-edge-w)" }
                                            }
                                          ),
                                          !isParBroken && !isForBrokenFinal && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(EdgeShimmer, { d: pathD, w: 1 })
                                        ] }, i)),
                                        e.cond && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                          "text",
                                          {
                                            x: geo.labelPos.x,
                                            y: geo.labelPos.y + 4.5,
                                            textAnchor: "middle",
                                            fontSize: 9.5,
                                            fontWeight: 700,
                                            fill: col,
                                            fontFamily: "var(--femo-font-mono)",
                                            style: { pointerEvents: "none" },
                                            children: e.cond
                                          }
                                        ),
                                        !isBack && edges.filter((x) => x.src === e.src).length > 1 && (() => {
                                          const sp = geo.srcPorts[geo.midIdx];
                                          return sp ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                            "circle",
                                            {
                                              cx: sp.x,
                                              cy: sp.y,
                                              r: 4,
                                              fill: "var(--femo-primary)",
                                              style: { pointerEvents: "none" }
                                            }
                                          ) : null;
                                        })()
                                      ] }, e.id);
                                    }),
                                    conn && (() => {
                                      const pathD = getTempConnLine();
                                      return pathD ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                        "path",
                                        {
                                          d: pathD,
                                          fill: "none",
                                          stroke: "var(--femo-primary)",
                                          strokeWidth: 2,
                                          strokeDasharray: "6,3",
                                          style: { pointerEvents: "none" }
                                        }
                                      ) : null;
                                    })()
                                  ]
                                }
                              ),
                              nodes.map((n) => {
                                const enrichedNode = n.type === "action" ? { ...n, action: actionMap.get(n.actionId) } : n;
                                const commonProps = {
                                  sel: sel?.type === "node" && sel.id === enrichedNode.id,
                                  onBody: (e) => {
                                    e.stopPropagation();
                                    if (drag || isPanning || conn) {
                                      setDrag(null);
                                      setIsPanning(false);
                                      setConn(null);
                                      return;
                                    }
                                    setSel({ type: "node", id: enrichedNode.id });
                                    setDrag({
                                      id: enrichedNode.id,
                                      sx: e.clientX,
                                      sy: e.clientY,
                                      ox: enrichedNode.x,
                                      oy: enrichedNode.y
                                    });
                                  },
                                  onPortDown: (e, dir) => handlePortDown(e, enrichedNode.id, dir),
                                  onPortUp: (e, dir) => handlePortUp(e, enrichedNode.id, dir),
                                  onBodyMouseUp: (e) => handleBodyMouseUp(e, enrichedNode.id)
                                };
                                if (enrichedNode.type === "special") {
                                  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                    SpecialNodeView,
                                    {
                                      node: enrichedNode,
                                      ...commonProps,
                                      isActive: activeNodeIds.has(enrichedNode.id)
                                    },
                                    enrichedNode.id
                                  );
                                }
                                if (enrichedNode.type === "for_out") {
                                  const isSel = sel?.type === "node" && sel.id === enrichedNode.id;
                                  const motherNode = enrichedNode.forNodeId ? nm.get(enrichedNode.forNodeId) : null;
                                  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                    ForOutNodeView,
                                    {
                                      node: enrichedNode,
                                      sel: isSel,
                                      forSpecialType: motherNode?.specialType || "FOR",
                                      onBodyMouseUp: (e) => handleBodyMouseUp(e, enrichedNode.id),
                                      onBubbleClick: (nodeId) => {
                                        setDrag(null);
                                        setConn(null);
                                        setIsPanning(false);
                                        setSel({ type: "node", id: nodeId });
                                      },
                                      onPortDown: (e, dir, x, y) => handlePortDown(e, enrichedNode.id, dir, x, y),
                                      onPortUp: (e, dir, x, y) => handlePortUp(e, enrichedNode.id, dir)
                                    },
                                    enrichedNode.id
                                  );
                                }
                                if (enrichedNode.type === "par_out") {
                                  const isSel = sel?.type === "node" && sel.id === enrichedNode.id;
                                  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                    ParOutNodeView,
                                    {
                                      node: enrichedNode,
                                      sel: isSel,
                                      onBody: (e) => {
                                        e.stopPropagation();
                                        if (drag || isPanning || conn) {
                                          setDrag(null);
                                          setIsPanning(false);
                                          setConn(null);
                                          return;
                                        }
                                        setSel({ type: "node", id: enrichedNode.id });
                                        setDrag({ id: enrichedNode.id, sx: e.clientX, sy: e.clientY, ox: enrichedNode.x, oy: enrichedNode.y });
                                      },
                                      onPortDown: (e, dir) => handlePortDown(e, enrichedNode.id, dir),
                                      onPortUp: (e, dir) => handlePortUp(e, enrichedNode.id, dir),
                                      onBodyMouseUp: (e) => handleBodyMouseUp(e, enrichedNode.id)
                                    },
                                    enrichedNode.id
                                  );
                                }
                                if (enrichedNode.type === "position") {
                                  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PositionNodeView, { node: enrichedNode, ...commonProps }, enrichedNode.id);
                                }
                                return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                  ActionNodeView,
                                  {
                                    node: enrichedNode,
                                    ...commonProps,
                                    onBubbleClick: handleBubbleClick,
                                    nodeState: nodeStates[enrichedNode.id],
                                    isActive: activeNodeIds.has(enrichedNode.id),
                                    errorNodeIds,
                                    onDbl: () => {
                                      if (enrichedNode.type === "action" && enrichedNode.action) {
                                        setModal({
                                          type: "editNode",
                                          action: enrichedNode.action,
                                          nodeId: enrichedNode.id
                                        });
                                      } else if (enrichedNode.type === "module") {
                                        const mod = enrichedNode.modDef;
                                        if (mod) editModule(mod);
                                      }
                                    }
                                  },
                                  enrichedNode.id
                                );
                              }),
                              nodes.filter((n) => n.type !== "special").length === 0 && !conn && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                                "div",
                                {
                                  style: {
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    pointerEvents: "none"
                                  },
                                  children: [
                                    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                      "div",
                                      {
                                        style: {
                                          fontSize: 14,
                                          color: "var(--femo-neutral)",
                                          fontWeight: 600
                                        },
                                        children: "\u4ECE\u7EC4\u4EF6\u5E93\u6DFB\u52A0 Action \u5230\u753B\u5E03"
                                      }
                                    ),
                                    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                                      "div",
                                      {
                                        style: { fontSize: 11.5, color: "var(--femo-text-4-weak)", marginTop: 6 },
                                        children: "\u70B9\u51FB\u8282\u70B9\u7AEF\u53E3\u8FDE\u7EBF \xB7 \u53CC\u51FB\u7F16\u8F91 \xB7 Space+\u62D6\u52A8\u5E73\u79FB\u753B\u5E03 \xB7 Del \u5220\u9664 \xB7 \u62D6\u62FD\u7EC4\u4EF6\u5230\u753B\u5E03"
                                      }
                                    )
                                  ]
                                }
                              )
                            ]
                          }
                        )
                      }
                    )
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
            "div",
            {
              style: {
                width: rightPanelWidth,
                background: "var(--femo-panel-bg)",
                borderLeft: "var(--femo-border-w) solid var(--femo-border)",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
                position: "relative"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                  "div",
                  {
                    onMouseDown: () => setIsResizingRight(true),
                    style: {
                      position: "absolute",
                      left: -4,
                      top: 0,
                      bottom: 0,
                      width: 8,
                      cursor: "col-resize",
                      zIndex: 20
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                  "div",
                  {
                    style: {
                      padding: "14px 16px",
                      borderBottom: "var(--femo-border-w) solid var(--femo-border)",
                      minHeight: 160
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                        "div",
                        {
                          style: {
                            fontSize: 9.5,
                            fontWeight: 800,
                            color: "var(--femo-neutral)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            marginBottom: 13
                          },
                          children: selNode ? "\u8282\u70B9\u5C5E\u6027" : selEdge ? "\u8FDE\u7EBF\u5C5E\u6027" : "\u5C5E\u6027\u9762\u677F"
                        }
                      ),
                      selNode ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                          "div",
                          {
                            style: {
                              fontWeight: 700,
                              fontSize: 13,
                              color: "var(--femo-text-1)",
                              marginBottom: 10
                            },
                            children: selNode.label
                          }
                        ),
                        selNode.type === "special" ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u7C7B\u578B", v: selNode.specialType }),
                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u7C7B\u522B", v: "\u7279\u6B8A\u8282\u70B9" }),
                          (selNode.specialType === "FOR" || selNode.specialType === "PAR") && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(F, { label: "\u53D8\u5316\u5143\u7D20", hint: selNode.specialType === "PAR" ? "\u5E76\u884C\u904D\u5386\u5217\u8868" : "\u5217\u8868\u5168\u90E8\u5FAA\u73AF\u4E00\u904D\u540E\u8D70\u51FA\u53E3", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { style: { fontSize: 12.5, color: "var(--femo-text-2)", fontWeight: 600 }, children: selNode.specialType === "PAR" ? "par" : "for" }),
                            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                              "input",
                              {
                                value: selNode.forCondition || "",
                                onChange: (e) => setNodes(
                                  (p) => p.map(
                                    (n) => n.id === selNode.id ? { ...n, forCondition: e.target.value } : n
                                  )
                                ),
                                placeholder: selNode.specialType === "PAR" ? "@coder in coders" : "@wolf in allWolves",
                                style: { ...inp, flex: 1 }
                              }
                            )
                          ] }) }),
                          (selNode.specialType === "START" || selNode.specialType === "IN") && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                            "div",
                            {
                              style: {
                                margin: "8px 0",
                                padding: "5px 8px",
                                background: "var(--femo-success-soft)",
                                borderRadius: "var(--femo-radius-sm)",
                                fontSize: 11,
                                color: "var(--femo-success-strong)",
                                fontWeight: 700
                              },
                              children: "\u5165\u53E3\u8282\u70B9\uFF08\u552F\u4E00\uFF09"
                            }
                          ),
                          SINK_ONLY.has(selNode.specialType) && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                            "div",
                            {
                              style: {
                                margin: "8px 0",
                                padding: "5px 8px",
                                background: "var(--femo-danger-soft)",
                                borderRadius: "var(--femo-radius-sm)",
                                fontSize: 11,
                                color: "var(--femo-danger)",
                                fontWeight: 700
                              },
                              children: "\u7EC8\u7AEF\u8282\u70B9\uFF08\u4EC5\u5165\uFF09"
                            }
                          )
                        ] }) : selNode.type === "position" ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u7C7B\u522B", v: "\u7A7A\u8282\u70B9 (POSITION)" }),
                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                            "div",
                            {
                              style: {
                                margin: "8px 0",
                                padding: "5px 8px",
                                background: "var(--femo-bg)",
                                borderRadius: "var(--femo-radius-sm)",
                                fontSize: 11,
                                color: "var(--femo-neutral)",
                                fontWeight: 700
                              },
                              children: "\u4EC5\u5360\u4F4D\uFF0C\u65E0\u5185\u5BB9"
                            }
                          )
                        ] }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
                          selNode.action ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
                            selNode.label && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u8282\u70B9\u540D", v: selNode.label.replace(/[\[\]]/g, "") }),
                            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "Action \u540D", v: selNode.action.name || "?" }),
                            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                              PR,
                              {
                                k: "\u7C7B\u578B",
                                v: `@${selNode.action.executorType || "ai"}`
                              }
                            ),
                            selNode.action.executorActor && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u6267\u884C\u8005", v: selNode.action.executorActor }),
                            selNode.action.scope && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "Scope", v: selNode.action.scope }),
                            selNode.action.outVars && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "out", v: selNode.action.outVars })
                          ] }) : null,
                          selNode.type === "module" && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u5F15\u7528", v: `&${selNode.modRef}` })
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { display: "flex", gap: 6, marginTop: 12 }, children: [
                          selNode.type === "action" && selNode.action && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                            "button",
                            {
                              onClick: () => setModal({
                                type: "editNode",
                                action: selNode.action,
                                nodeId: selNode.id
                              }),
                              style: {
                                ...btnS,
                                flex: 1,
                                padding: "5px 0",
                                fontSize: 11.5
                              },
                              children: "\u7F16\u8F91"
                            }
                          ),
                          !(selNode.type === "special" && (selNode.specialType === "START" || selNode.specialType === "IN")) && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                            "button",
                            {
                              onClick: () => {
                                if (selNode.type === "special" && (selNode.specialType === "END" || selNode.specialType === "OUT")) {
                                  const sameType = nodes.filter(
                                    (n) => n.type === "special" && n.specialType === selNode.specialType
                                  );
                                  if (sameType.length <= 1) return;
                                }
                                deleteNode(selNode.id);
                              },
                              style: {
                                ...btnS,
                                flex: 1,
                                padding: "5px 0",
                                fontSize: 11.5,
                                color: selNode.type === "special" && (selNode.specialType === "START" || selNode.specialType === "IN") ? "var(--femo-text-4-weak)" : "var(--femo-danger)",
                                borderColor: selNode.type === "special" && (selNode.specialType === "START" || selNode.specialType === "IN") ? "var(--femo-border)" : "var(--femo-danger-border)"
                              },
                              children: "\u5220\u9664"
                            }
                          )
                        ] })
                      ] }) : selEdge ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u6765\u6E90", v: nm.get(selEdge.src)?.label || "?" }),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u76EE\u6807", v: nm.get(selEdge.tgt)?.label || "?" }),
                        backEdges.has(selEdge.id) && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                          "div",
                          {
                            style: {
                              margin: "8px 0",
                              padding: "5px 8px",
                              background: "var(--femo-danger-soft)",
                              borderRadius: "var(--femo-radius-sm)",
                              fontSize: 11,
                              color: "var(--femo-danger)",
                              fontWeight: 700
                            },
                            children: "\u56DE\u73AF\u68C0\u6D4B -- while \u5FAA\u73AF"
                          }
                        ),
                        (() => {
                          const inEdges = edges.filter(
                            (e) => e.tgt === selEdge.tgt && !backEdges.has(e.id)
                          );
                          if (inEdges.length > 1) {
                            return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                              "div",
                              {
                                style: {
                                  margin: "8px 0",
                                  padding: "5px 8px",
                                  background: "var(--femo-warning-soft)",
                                  borderRadius: "var(--femo-radius-sm)",
                                  fontSize: 11,
                                  color: "var(--femo-warning)",
                                  fontWeight: 700
                                },
                                children: [
                                  "Join \u8282\u70B9 (",
                                  inEdges.length,
                                  " \u5165\u53E3)"
                                ]
                              }
                            );
                          }
                          return null;
                        })(),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(F, { label: "if \u6761\u4EF6", hint: "\u5982 game_over == false", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                          "input",
                          {
                            value: selEdge.cond || "",
                            onChange: (e) => setEdges(
                              (p) => p.map(
                                (ed) => ed.id === selEdge.id ? { ...ed, cond: e.target.value } : ed
                              )
                            ),
                            placeholder: "\u7559\u7A7A = \u65E0\u6761\u4EF6",
                            style: inp
                          }
                        ) }),
                        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                          "button",
                          {
                            onClick: () => {
                              setEdges((p) => p.filter((e) => e.id !== selEdge.id));
                              setSel(null);
                            },
                            style: {
                              ...btnS,
                              width: "100%",
                              color: "var(--femo-danger)",
                              borderColor: "var(--femo-danger-border)",
                              fontSize: 11.5,
                              padding: "5px 0"
                            },
                            children: "\u5220\u9664\u8FDE\u7EBF"
                          }
                        )
                      ] }) : libSel ? (() => {
                        let item = null;
                        if (libSel.type === "action") {
                          item = lib.actions.find((a) => a.id === libSel.id) || lib.modules.flatMap((m) => m.internalActions || []).find((a) => a.id === libSel.id);
                        } else if (libSel.type === "module") {
                          item = lib.modules.find((m) => m.id === libSel.id);
                        }
                        if (!item)
                          return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { color: "var(--femo-text-4-weak)" }, children: "\u672A\u627E\u5230\u9879" });
                        return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                            "div",
                            {
                              style: {
                                fontWeight: 700,
                                fontSize: 13,
                                marginBottom: 10,
                                color: "var(--femo-text-1)"
                              },
                              children: libSel.type === "module" ? `&${item.name}` : item.name
                            }
                          ),
                          libSel.type === "action" ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
                            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u7C7B\u578B", v: `@${item.executorType}` }),
                            item.executorActor && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u6267\u884C\u8005", v: item.executorActor }),
                            item.scope && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "Scope", v: item.scope }),
                            item.outVars && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "out", v: item.outVars })
                          ] }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(PR, { k: "\u6A21\u5757", v: item.name }),
                          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                            "button",
                            {
                              onClick: () => {
                                if (libSel.type === "action")
                                  setModal({ type: "edit", action: item });
                                else editModule(item);
                              },
                              style: { ...btnS, marginTop: 8, width: "100%" },
                              children: "\u7F16\u8F91"
                            }
                          )
                        ] });
                      })() : /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
                        "div",
                        {
                          style: { color: "var(--femo-text-4-weak)", fontSize: 11.5, lineHeight: 1.7 },
                          children: [
                            "\u70B9\u51FB\u8282\u70B9\u6216\u8FDE\u7EBF\u67E5\u770B\u5C5E\u6027",
                            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("br", {}),
                            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { style: { fontSize: 10.5 }, children: "\u53CC\u51FB\u8282\u70B9\u53EF\u7F16\u8F91 Action" })
                          ]
                        }
                      )
                    ]
                  }
                ),
                plugin && savedPath === void 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: {
                  fontSize: 11,
                  color: "var(--femo-warning-strong)",
                  background: "var(--femo-warning-soft)",
                  border: "var(--femo-border-w) solid var(--femo-warning-border)",
                  borderRadius: "var(--femo-radius-sm)",
                  padding: "4px 8px",
                  marginBottom: 4,
                  lineHeight: 1.4
                }, children: "\u26A0 \u5267\u672C\u672A\u4FDD\u5B58\u3002\u5916\u63A5\u4F9D\u8D56\u6587\u4EF6\u53EA\u652F\u6301\u7EDD\u5BF9\u5730\u5740\u3002" }),
                /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                  FemoPreview,
                  {
                    value: femoText,
                    onChange: (v) => {
                      setFemoText(v);
                      setFemoDirty(true);
                    },
                    error: femoError,
                    warnings: FEMOrnings,
                    dirty: femoDirty,
                    onApply: handleApplyFemo,
                    onRestore: handleRestoreFemo,
                    onGraphToFemo: handleGraphToTextCommit
                  }
                )
              ]
            }
          ),
          " ",
          modal && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            ActionModal,
            {
              init: modal.type !== "new" ? modal.action : null,
              existingNames: [...allNames],
              isModuleInternal: mode === "module",
              onSave: (action) => {
                const actionWithPath = {
                  ...action,
                  path: action.path || [...locationPath]
                };
                if (modal.type === "editNode") {
                  setNodes(
                    (p) => p.map(
                      (n) => n.id === modal.nodeId ? { ...n, label: `[${actionWithPath.name}]` } : n
                    )
                  );
                } else if (modal.type === "edit") {
                  setNodes(
                    (p) => p.map(
                      (n) => n.actionId === actionWithPath.id ? { ...n, label: `[${actionWithPath.name}]` } : n
                    )
                  );
                } else {
                  addNode(actionWithPath);
                }
                setActionStore((prev) => {
                  const idx = prev.findIndex((a) => a.id === actionWithPath.id);
                  if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = actionWithPath;
                    return updated;
                  } else {
                    return [...prev, actionWithPath];
                  }
                });
                console.log("[ActionModal onSave] action \u5DF2\u66F4\u65B0, name:", actionWithPath.name);
                setModal(null);
              },
              onClose: () => setModal(null)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            BubbleOverlay,
            {
              bubbleOverlay,
              nodes,
              nodeStates,
              humanWaits,
              actionStore,
              onClose: handleBubbleClose,
              submitHumanInput
            }
          ),
          runGuard !== null && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: {
            maxWidth: 430,
            width: "calc(100% - 48px)",
            padding: "18px 20px",
            borderRadius: 12,
            background: "var(--femo-surface, #fff)",
            border: "1px solid var(--femo-border, #e0e0e0)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
            fontSize: 13,
            lineHeight: 1.6
          }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "\u26A0\uFE0F \u6709\u672A\u843D\u76D8\u4FEE\u6539" }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { color: "var(--femo-text-secondary, #666)", marginBottom: 14 }, children: [
              runGuard.textDirty && runGuard.graphDirty ? "\u6587\u672C\u548C\u753B\u5E03\u56FE\u90FD\u88AB\u4FEE\u6539\u8FC7\uFF0C\u4E14\u4E92\u76F8\u4E0D\u7EDF\u4E00\u3002" : runGuard.textDirty ? "\u6587\u672C\u88AB\u4FEE\u6539\u8FC7\uFF0C\u5C1A\u672A\u5E94\u7528\u5230\u753B\u5E03\u548C record\u3002" : "\u753B\u5E03\u56FE\u88AB\u4FEE\u6539\u8FC7\uFF0C\u5C1A\u672A\u5E94\u7528\u5230\u6587\u672C\u548C record\u3002",
              "\u5EFA\u8BAE\u56DE\u53BB\u6309\u5BF9\u5E94\u7684\u7EDF\u4E00\u6309\u94AE\uFF08\u6587\u672C\u751F\u56FE / \u56FE\u751F\u6587\u672C\uFF09\u5E94\u7528\u4F60\u8981\u7684\u7248\u672C\uFF1B \u4E5F\u53EF\u4EE5\u653E\u5F03\u8FD9\u4E9B\u4FEE\u6539\uFF0C\u4EE5\u6700\u540E\u4FDD\u5B58\u7684 record \u4E3A\u51C6\u76F4\u63A5\u8FD0\u884C\u3002"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                "button",
                {
                  onClick: () => setRunGuard(null),
                  style: { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--femo-border, #ccc)", background: "transparent", cursor: "pointer" },
                  children: "\u56DE\u53BB\u6838\u67E5"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
                "button",
                {
                  onClick: discardChangesAndRun,
                  style: { padding: "6px 12px", borderRadius: 8, border: "1px solid #d96b2b", background: "#d96b2b", color: "#fff", cursor: "pointer" },
                  children: "\u653E\u5F03\u4FEE\u6539\uFF0C\u76F4\u63A5\u8DD1"
                }
              )
            ] })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            SoulModal,
            {
              open: soulModalOpen,
              onClose: () => setSoulModalOpen(false),
              onCreated: (data) => {
                setSoulModalOpen(false);
              },
              createUrl: plugin ? "/femo-plugin/souls" : getBackendBaseUrl() + "/api/souls/create"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
            FemoFileList,
            {
              open: femoFileOpen,
              files: femoFileList,
              loading: femoFileLoading,
              error: femoFileError,
              busyPath: femoFileBusyPath,
              onPick: handlePickFromList,
              onForget: typeof onForgetFemoFile === "function" ? handleForgetFromList : void 0,
              onBrowse: handleBrowseImport,
              onClose: () => setFemoFileOpen(false)
            }
          )
        ]
      }
    ),
    " "
  ] });
});
var FemoWorAuto_default = FEMOEditor;

// client/client-ui/editor-page.tsx
var import_jsx_runtime21 = require("react/jsx-runtime");
async function readJsonOrThrow(resp, what) {
  const text = await resp.text();
  if (text.trim().length === 0) {
    throw new Error(resp.status === 405 ? `${what}\u5931\u8D25\uFF1AHTTP 405\uFF08\u8BE5\u63A5\u53E3\u672A\u6CE8\u518C\uFF09\u2014\u2014\u5BBF\u4E3B\u4FA7\u6539\u52A8\u9700\u8981\u91CD\u542F dsh \u8FDB\u7A0B\u624D\u751F\u6548` : `${what}\u5931\u8D25\uFF1AHTTP ${resp.status}\uFF0C\u54CD\u5E94\u4F53\u4E3A\u7A7A`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${what}\u5931\u8D25\uFF1AHTTP ${resp.status}\uFF0C\u54CD\u5E94\u4E0D\u662F JSON\uFF1A${text.slice(0, 200)}`);
  }
}
var pageState = { target: null, anchor: null };
var pageListeners = /* @__PURE__ */ new Set();
var sessionRefs = /* @__PURE__ */ new Map();
function pageNotify() {
  for (const listener of [...pageListeners]) listener();
}
function pageSetTarget(sid) {
  if (pageState.target === sid) return;
  pageState.target = sid;
  pageNotify();
}
function editorPageOpenSession(sid) {
  sessionRefs.set(sid, (sessionRefs.get(sid) ?? 0) + 1);
  pageSetTarget(sid);
}
function editorPageCloseSession(sid) {
  const n = (sessionRefs.get(sid) ?? 0) - 1;
  if (n > 0) {
    sessionRefs.set(sid, n);
    return;
  }
  sessionRefs.delete(sid);
  if (pageState.target === sid && pageState.anchor === null) pageSetTarget(null);
}
function editorPageRegisterAnchor(sid, el) {
  pageState.anchor = { sid, el };
  pageSetTarget(sid);
  pageNotify();
}
function editorPageUnregisterAnchor(sid, el) {
  if (pageState.anchor?.sid !== sid || pageState.anchor.el !== el) return;
  pageState.anchor = null;
  pageNotify();
}
var pageReloadRef = null;
function handleControlEvent(msg) {
  const sid = typeof msg.data?.sessionId === "string" ? msg.data.sessionId : "";
  if (sid.length === 0) return;
  if (msg.type === "script_changed") {
    console.log(`[femo-page] sse script_changed sid=${sid} target=${pageState.target} anchor=${pageState.anchor?.sid ?? "none"}`);
    if (pageState.target === null) pageSetTarget(sid);
    if (pageState.target === sid) {
      console.log(`[femo-page] -> reload page (target match)`);
      pageReloadRef?.();
    }
    return;
  }
}
var pageRootEl = null;
function applyPagePlacement() {
  const rootEl = pageRootEl;
  if (rootEl === null) return;
  const anchor = pageState.anchor;
  if (anchor !== null && anchor.el.isConnected) {
    if (rootEl.parentNode !== anchor.el) anchor.el.appendChild(rootEl);
    rootEl.style.visibility = "visible";
    rootEl.style.pointerEvents = "auto";
    rootEl.style.position = "absolute";
    rootEl.style.inset = "0";
    rootEl.style.width = "100%";
    rootEl.style.height = "100%";
    console.log(`[femo-page] placement -> anchor (sid=${anchor.sid})`);
  } else {
    if (rootEl.parentNode !== document.body) document.body.appendChild(rootEl);
    rootEl.style.visibility = "hidden";
    rootEl.style.pointerEvents = "none";
    rootEl.style.position = "fixed";
    rootEl.style.inset = "0";
    rootEl.style.width = "100vw";
    rootEl.style.height = "100vh";
    console.log("[femo-page] placement -> hidden");
  }
}
function mountFemoEditorPage(createInjected) {
  if (pageRootEl !== null) return;
  const el = document.createElement("div");
  el.setAttribute("data-femo-editor-page", "");
  el.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;visibility:hidden;pointer-events:none;z-index:0";
  document.body.appendChild(el);
  pageRootEl = el;
  (0, import_client.createRoot)(el).render(/* @__PURE__ */ (0, import_jsx_runtime21.jsx)(EditorPageRoot, { injectedFactory: createInjected }));
  console.log("[femo-page] editor page root mounted (single-instance keep-alive)");
}
function EditorPageRoot({ injectedFactory }) {
  const [, force] = (0, import_react22.useState)(0);
  const target = pageState.target;
  (0, import_react22.useEffect)(() => {
    const listener = () => {
      applyPagePlacement();
      force((x) => x + 1);
    };
    pageListeners.add(listener);
    applyPagePlacement();
    return () => {
      pageListeners.delete(listener);
    };
  }, []);
  (0, import_react22.useEffect)(() => {
    if (target === null) return;
    const release = femoStreamAcquire({ background: true });
    const unsubscribe = subscribeControlEvents(handleControlEvent);
    return () => {
      unsubscribe();
      release();
    };
  }, [target]);
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: { width: "100%", height: "100%", background: "transparent" }, children: target !== null && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
    FemoEditorPage,
    {
      sessionId: target,
      injected: injectedFactory()
    },
    target
  ) });
}
var conflictBtnStyle = {
  padding: "6px 14px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
  background: "var(--dsw-alias-bg-layer-3, #fff)",
  border: "1px solid var(--dsw-alias-border-l2, #ddd)"
};
function FemoEditorPage({ sessionId, injected }) {
  const [state, setState] = (0, import_react22.useState)(null);
  const [conflict, setConflict] = (0, import_react22.useState)(null);
  const [editorNotice, setEditorNotice] = (0, import_react22.useState)(null);
  const lastRestoreErrorRef = (0, import_react22.useRef)(null);
  const onRestoreError = (0, import_react22.useCallback)((message) => {
    if (lastRestoreErrorRef.current === message) return;
    lastRestoreErrorRef.current = message;
    setEditorNotice(message);
    void fetch("/femo-plugin/editor-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, message, source: "restore" })
    }).catch((error) => {
      console.warn("[femo-plugin] editor-error \u4E0A\u62A5\u5931\u8D25:", error);
    });
  }, [sessionId]);
  const getRecordScript = (0, import_react22.useCallback)(async () => {
    try {
      const response = await fetch(`/femo-plugin/session-state?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await response.json();
      return data.ok === true ? data.script : void 0;
    } catch {
      return void 0;
    }
  }, [sessionId]);
  const loadSessionState = (0, import_react22.useCallback)(async () => {
    console.log(`[femo-page] loadSessionState start sid=${sessionId}`);
    const response = await fetch(`/femo-plugin/session-state?sessionId=${encodeURIComponent(sessionId)}`);
    const data = await response.json();
    if (data.ok === true) {
      setEditorNotice(null);
      lastRestoreErrorRef.current = null;
      setState((prev) => {
        const sameScript = prev !== null && data.script !== void 0 && prev.script === data.script;
        const sameCheckpoint = prev !== null && prev.checkpoint !== void 0 && JSON.stringify(prev.checkpoint) === JSON.stringify(data.checkpoint ?? {});
        return {
          hasScript: data.script !== void 0,
          script: sameScript ? prev.script : data.script,
          scriptPath: data.scriptPath,
          rev: data.rev ?? 0,
          checkpoint: sameCheckpoint ? prev.checkpoint : data.checkpoint ?? {},
          running: data.running === true,
          jobId: data.jobId,
          ...data.jobIds !== void 0 ? { jobIds: data.jobIds } : {},
          // 引擎冷启动（§八.15）：pending=true → FEMOEditor enginePending
          // → 运行按钮禁用+「引擎启动中」，不显示"断点丢失"。
          pending: data.pending === true,
          ...data.waitingHuman !== void 0 ? { waitingHuman: data.waitingHuman } : {},
          ...data.lastError !== void 0 ? { lastError: data.lastError } : {}
        };
      });
      console.log(`[femo-page] state loaded sid=${sessionId} script=${data.script === void 0 ? "undefined" : String(data.script.length) + "ch"} rev=${String(data.rev ?? 0)} jobId=${String(data.jobId ?? "-")} pending=${data.pending === true}`);
    }
  }, [sessionId]);
  (0, import_react22.useEffect)(() => {
    setState(null);
    setConflict(null);
    setEditorNotice(null);
    void loadSessionState().catch(() => {
    });
    pageReloadRef = loadSessionState;
    return () => {
      pageReloadRef = null;
    };
  }, [sessionId, loadSessionState]);
  const checkpointNode = state === null ? void 0 : state.checkpoint["__main__"] ?? Object.values(state.checkpoint)[0];
  const persistScript = (femo) => {
    void fetch("/femo-plugin/session-script", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, femo, ...state?.rev === void 0 ? {} : { baseRev: state.rev } })
    }).then(async (response) => {
      if (response.status !== 409) return;
      const data = await response.json().catch(() => null);
      setConflict({ localFemo: femo, remoteRev: data?.record?.rev ?? 0 });
    }).catch((error) => {
      console.warn("[femo-plugin] persist write failed:", error);
    });
  };
  const resolveConflictByReload = () => {
    setConflict(null);
    void loadSessionState().catch((error) => {
      console.warn("[femo-plugin] conflict reload failed:", error);
    });
  };
  const resolveConflictByOverride = () => {
    if (conflict === null) return;
    const femo = conflict.localFemo;
    void fetch("/femo-plugin/session-script", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, femo, baseRev: conflict.remoteRev })
    }).then(async (response) => {
      if (response.ok) {
        const data = await response.json().catch(() => null);
        setState((prev) => prev === null ? prev : { ...prev, rev: data?.rev ?? prev.rev });
        setConflict(null);
        return;
      }
      if (response.status === 409) {
        const data = await response.json().catch(() => null);
        setConflict({ localFemo: femo, remoteRev: data?.record?.rev ?? conflict.remoteRev });
      }
    }).catch((error) => {
      console.warn("[femo-plugin] conflict override failed:", error);
    });
  };
  const preflightCheck = (femo) => {
    if (state?.scriptPath !== void 0 && state.scriptPath.length > 0) return null;
    const refs = [];
    const re = /(?:file|文件)[:：]\s*["'“”]([^"'“”]+)["'“”]/g;
    let m;
    while ((m = re.exec(femo)) !== null) refs.push(m[1]);
    const isAbs = (p) => /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("/") || p.startsWith("\\\\");
    const relative = refs.filter((p) => !isAbs(p));
    if (relative.length === 0) return null;
    return `\u5267\u672C\u672A\u4FDD\u5B58\uFF1A\u4F9D\u8D56\u6587\u4EF6\u53EA\u652F\u6301\u7EDD\u5BF9\u5730\u5740\u3002\u4EE5\u4E0B\u5F15\u7528\u662F\u76F8\u5BF9\u8DEF\u5F84\uFF1A${relative.join("\u3001")}\u3002\u8BF7\u5148\u300C\u5BFC\u51FA .FEMO\u300D\u4FDD\u5B58\u5267\u672C\uFF08\u76F8\u5BF9\u8DEF\u5F84\u5C06\u57FA\u4E8E\u5267\u672C\u6587\u4EF6\u4F4D\u7F6E\u89E3\u6790\uFF09\uFF0C\u6216\u6539\u7528\u7EDD\u5BF9\u8DEF\u5F84\u3002`;
  };
  const onRun = async (femo, opts) => {
    const problem = preflightCheck(femo);
    if (problem !== null) throw new Error(problem);
    const response = await fetch("/femo-plugin/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        femo,
        ...opts?.reset === true ? { reset: true } : {},
        // 显式续跑目标 Job 号（femoGen「继续」按钮——续跑旧 Job 时不依赖
        // 宿主 currentJobId 指针；fresh 会忽略它）。
        ...typeof opts?.jobId === "number" && Number.isFinite(opts.jobId) ? { jobId: Math.trunc(opts.jobId) } : {}
      })
    });
    let message = `run HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data.ok === true) return;
      message = data.error ?? message;
    } catch {
    }
    throw new Error(message);
  };
  const onPause = async (jobId) => {
    return await injected.pauseScript(sessionId, jobId);
  };
  const [saveReminder, setSaveReminder] = (0, import_react22.useState)(null);
  const onExport = async (femo, name) => {
    const norm = (s) => s.replace(/\r\n/g, "\n");
    const currentPath = state?.scriptPath;
    if (currentPath !== void 0 && currentPath.length > 0) {
      let fileText;
      try {
        fileText = await injected.readScript(currentPath);
      } catch {
        fileText = void 0;
      }
      if (fileText !== void 0 && norm(fileText) === norm(femo)) {
        const choice = await new Promise((resolve) => {
          setSaveReminder({ path: currentPath, resolve });
        });
        if (choice === "back") return void 0;
        if (choice === "save") {
          const saved2 = await injected.saveScript(currentPath, femo, sessionId);
          setState((prev) => prev === null ? prev : { ...prev, scriptPath: saved2, script: femo });
          return saved2;
        }
      } else {
        const saved2 = await injected.saveScript(currentPath, femo, sessionId);
        setState((prev) => prev === null ? prev : { ...prev, scriptPath: saved2, script: femo });
        return saved2;
      }
    }
    const safe = name.replace(/[\\/:*?"<>|]/g, "_").replace(/\.femo$/i, "");
    const pickResp = await fetch("/femo-plugin/pick-save-path", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: safe })
    });
    const pickData = await readJsonOrThrow(pickResp, "\u4FDD\u5B58\u5BF9\u8BDD\u6846");
    if (pickData.ok !== true) {
      throw new Error(pickData.error ?? "\u4FDD\u5B58\u5BF9\u8BDD\u6846\u5931\u8D25");
    }
    if (typeof pickData.path !== "string" || pickData.path.length === 0) {
      return void 0;
    }
    const saved = await injected.saveScript(pickData.path, femo, sessionId);
    setState((prev) => prev === null ? prev : { ...prev, scriptPath: saved, script: femo });
    return saved;
  };
  const recordAndLoad = async (path, content) => {
    await fetch("/femo-plugin/session-script", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, scriptPath: path, femo: content })
    });
    setState((prev) => prev === null ? prev : { ...prev, scriptPath: path, script: content });
    return { path, content };
  };
  const onImport = async () => {
    const resp = await fetch("/femo-plugin/pick-script", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const data = await readJsonOrThrow(resp, "\u5BFC\u5165\uFF08\u7CFB\u7EDF\u6587\u4EF6\u9009\u62E9\u5668\uFF09");
    if (data.ok !== true) throw new Error(data.error ?? "pick-script failed");
    const pickedPath = data.path;
    const pickedContent = data.content;
    if (typeof pickedPath !== "string" || pickedPath.length === 0 || pickedContent === void 0) return null;
    return await recordAndLoad(pickedPath, pickedContent);
  };
  const onListFemoFiles = async () => {
    const resp = await fetch("/femo-plugin/femo-files", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const data = await readJsonOrThrow(resp, "\u8BFB\u53D6\u5BFC\u5165\u6E05\u5355");
    if (data.ok !== true) throw new Error(data.error ?? "\u8BFB\u53D6\u5BFC\u5165\u6E05\u5355\u5931\u8D25");
    return data.files ?? [];
  };
  const onPickFemoFile = async (path) => {
    const resp = await fetch("/femo-plugin/open-femo-file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path })
    });
    const data = await readJsonOrThrow(resp, "\u6253\u5F00\u6587\u4EF6");
    if (data.ok !== true) throw new Error(data.error ?? "\u6253\u5F00\u5931\u8D25");
    const pickedPath = data.path;
    const pickedContent = data.content;
    if (typeof pickedPath !== "string" || pickedPath.length === 0 || pickedContent === void 0) {
      throw new Error("\u6253\u5F00\u5931\u8D25\uFF1Ahost \u8FD4\u56DE\u7684\u6587\u4EF6\u6570\u636E\u4E0D\u5B8C\u6574");
    }
    return await recordAndLoad(pickedPath, pickedContent);
  };
  const onForgetFemoFile = async (path) => {
    const resp = await fetch("/femo-plugin/forget-femo-file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path })
    });
    const data = await readJsonOrThrow(resp, "\u4ECE\u6E05\u5355\u79FB\u9664");
    if (data.ok !== true) throw new Error(data.error ?? "\u4ECE\u6E05\u5355\u79FB\u9664\u5931\u8D25");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: { width: "100%", height: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      FemoWorAuto_default,
      {
        plugin: true,
        sessionId,
        enginePending: state?.pending === true,
        onRun,
        onPause,
        onPersistScript: persistScript,
        getRecordScript,
        onExport,
        onImport,
        onListFemoFiles,
        onPickFemoFile,
        onForgetFemoFile,
        onBackToShell: injected.toggleSidebar,
        savedPath: state?.scriptPath,
        initialScript: state?.script,
        initialCheckpoint: checkpointNode,
        initialRunning: state?.running === true,
        initialJobId: state?.jobId,
        jobIds: state?.jobIds,
        initialWaitingHuman: state?.waitingHuman,
        initialLastError: state?.lastError,
        onRestoreError
      }
    ),
    conflict !== null && (0, import_react_dom3.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: {
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: {
        maxWidth: 420,
        width: "calc(100% - 48px)",
        padding: "18px 20px",
        borderRadius: 12,
        background: "color-mix(in srgb, var(--dsw-alias-bg-layer-2, #f5f5f5) 96%, transparent)",
        border: "1px solid var(--dsw-alias-border-l2, #e0e0e0)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
        fontSize: 13,
        lineHeight: 1.6
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "\u2694\uFE0F \u5267\u672C\u51B2\u7A81" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: { color: "var(--dsw-alias-label-secondary, #666)", marginBottom: 14 }, children: "\u672C\u7A97\u53E3\u7684\u7F16\u8F91\u548C\u5176\u4ED6\u7A97\u53E3/\u8BBE\u5907\u7684\u4FDD\u5B58\u51B2\u7A81\u4E86\uFF08\u5BF9\u65B9\u5148\u5199\u5165\uFF09\u3002\u4EE5\u54EA\u4E2A\u4E3A\u51C6\uFF1F" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("button", { onClick: resolveConflictByReload, style: conflictBtnStyle, children: "\u52A0\u8F7D\u6700\u65B0\u7248\u672C" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
            "button",
            {
              onClick: resolveConflictByOverride,
              style: { ...conflictBtnStyle, color: "#fff", background: "#d96b2b", borderColor: "#d96b2b" },
              children: "\u4FDD\u7559\u6211\u7684\u7F16\u8F91"
            }
          )
        ] })
      ] }) }),
      document.body
    ),
    saveReminder !== null && (0, import_react_dom3.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: {
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: {
        maxWidth: 420,
        width: "calc(100% - 48px)",
        padding: "18px 20px",
        borderRadius: 12,
        background: "color-mix(in srgb, var(--dsw-alias-bg-layer-2, #f5f5f5) 96%, transparent)",
        border: "1px solid var(--dsw-alias-border-l2, #e0e0e0)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
        fontSize: 13,
        lineHeight: 1.6
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "\u{1F4E4} \u4F60\u5E76\u672A\u6539\u52A8\u6587\u672C" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: { color: "var(--dsw-alias-label-secondary, #666)", marginBottom: 14, wordBreak: "break-all" }, children: [
          "\u5F53\u524D\u7F16\u8F91\u5668\u6587\u672C\u548C ",
          saveReminder.path,
          " \u91CC\u4FDD\u5B58\u7684\u7248\u672C\u4E00\u6837\u3002\u53EF\u4EE5\u4F9D\u7136\u4FDD\u5B58\uFF08\u8986\u76D6\u5199\u56DE\u539F\u6587\u4EF6\uFF09\u3001\u53E6\u5B58\u4E3A\u65B0\u6587\u4EF6\uFF0C\u6216\u8FD4\u56DE\u753B\u5E03\uFF08\u82E5\u4F60\u662F\u5FD8\u4E86\u5148\u300C\u56FE\u5230\u6587\u672C\u300D\u628A\u753B\u5E03\u6539\u52A8\u5E94\u7528\u8FC7\u6765\uFF09\u3002"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
            "button",
            {
              onClick: () => {
                const r = saveReminder;
                setSaveReminder(null);
                r.resolve("back");
              },
              style: conflictBtnStyle,
              children: "\u8FD4\u56DE\u7F16\u8F91\u753B\u5E03"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
            "button",
            {
              onClick: () => {
                const r = saveReminder;
                setSaveReminder(null);
                r.resolve("saveas");
              },
              style: conflictBtnStyle,
              children: "\u53E6\u5B58\u4E3A"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
            "button",
            {
              onClick: () => {
                const r = saveReminder;
                setSaveReminder(null);
                r.resolve("save");
              },
              style: { ...conflictBtnStyle, color: "#fff", background: "#d96b2b", borderColor: "#d96b2b" },
              children: "\u4F9D\u7136\u4FDD\u5B58"
            }
          )
        ] })
      ] }) }),
      document.body
    ),
    editorNotice !== null && (0, import_react_dom3.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: {
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 300,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "10px 14px",
        borderRadius: 10,
        margin: "0 auto",
        maxWidth: 560,
        background: "color-mix(in srgb, #fdecea 92%, transparent)",
        border: "1px solid #e5b3ad",
        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        fontSize: 12.5,
        lineHeight: 1.55
      }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: { fontWeight: 700, marginBottom: 2 }, children: "\u26A0\uFE0F \u5267\u672C\u6062\u590D\u5931\u8D25\uFF08\u5DF2\u4E0A\u62A5\u4E3B\u6A21\u578B\uFF09" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { style: { color: "var(--dsw-alias-label-secondary, #666)", whiteSpace: "pre-wrap" }, children: editorNotice })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
          "button",
          {
            onClick: () => setEditorNotice(null),
            style: { border: "none", background: "transparent", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 2 },
            title: "\u5173\u95ED",
            children: "\u2715"
          }
        )
      ] }),
      document.body
    )
  ] });
}

// client/client-ui/editor-view.tsx
var import_jsx_runtime22 = (
  // data-conversation-composer-overlay：dsh 本体 CSS 据此给 viewArea
  // 确定高度（flex: 1 1 0 + min-height: 0 + overflow: hidden），宿主编辑
  // 器 DOM 以 absolute inset:0 落在本容器内。
  require("react/jsx-runtime")
);
function FemoEditorView(props) {
  const rawSessionId = props.sessionId;
  const motherId = props.useSessions?.((s) => {
    const summary = s.byId[rawSessionId];
    return typeof summary?.parentId === "string" ? summary.parentId : void 0;
  });
  const sessionId = typeof rawSessionId === "string" && rawSessionId.startsWith("femo-proj-") && typeof motherId === "string" ? motherId : rawSessionId;
  const anchorRef = (0, import_react23.useRef)(null);
  (0, import_react23.useLayoutEffect)(() => {
    const el = anchorRef.current;
    if (el === null) return;
    editorPageRegisterAnchor(sessionId, el);
    return () => {
      editorPageUnregisterAnchor(sessionId, el);
    };
  }, [sessionId]);
  (0, import_react23.useEffect)(() => {
    const scrollBody = document.querySelector("[data-conversation-scroll]");
    const seat = scrollBody?.querySelector("[data-composer-seat]") ?? null;
    if (seat === null) return;
    seat.style.display = "none";
    return () => {
      seat.style.display = "";
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { ref: anchorRef, "data-conversation-composer-overlay": "", style: { position: "relative", height: "100%" } });
}

// client/client-ui/view-button.tsx
var import_react24 = require("react");
var import_dsh_client_ui_primitives5 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime23 = require("react/jsx-runtime");
var FEMO_EDITOR_TAB_LABEL = "Femo \u5267\u672C";
var CHAT_TAB_LABELS = ["\u5BF9\u8BDD", "Chat"];
var pendingTabTransfer = null;
function readActiveTabKind() {
  const selected = document.querySelector('[role="tab"][aria-selected="true"]');
  return selected !== null && selected.textContent === FEMO_EDITOR_TAB_LABEL ? "editor" : "chat";
}
function FemoViewButton({ useSession, useSessions, openSession, warmCatalog, listProjectionWindows }) {
  const sessionId = useSession((snapshot2) => snapshot2.sessionId);
  const view = useView(sessionId);
  const [open, setOpen] = (0, import_react24.useState)(false);
  const [proj, setProj] = (0, import_react24.useState)({ actors: {} });
  const [hint, setHint] = (0, import_react24.useState)(null);
  const hintSeq = (0, import_react24.useRef)(0);
  const showHint = (0, import_react24.useCallback)((text) => {
    hintSeq.current += 1;
    const seq2 = hintSeq.current;
    setHint({ text, seq: seq2 });
    window.setTimeout(() => {
      if (hintSeq.current === seq2) setHint(null);
    }, 8e3);
  }, []);
  const refreshWindows = (0, import_react24.useCallback)(async (sid) => {
    try {
      const windows = await listProjectionWindows(sid);
      setProj(windows);
      return windows;
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      return void 0;
    }
  }, [listProjectionWindows]);
  const mainSid = useSessions((state) => {
    if (typeof sessionId !== "string") return void 0;
    const summary = state.byId[sessionId];
    const preset = summary?.projectionValues?.agentPreset ?? summary?.agentPreset;
    if (preset === "femo-plugin" && summary?.parentId === void 0) return sessionId;
    if (sessionId.startsWith("femo-proj-")) {
      const pid = summary?.parentId;
      return typeof pid === "string" ? pid : void 0;
    }
    return void 0;
  });
  (0, import_react24.useEffect)(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find((el) => el.textContent === FEMO_EDITOR_TAB_LABEL);
    if (tab === void 0) return;
    tab.style.display = mainSid !== void 0 ? "" : "none";
    return () => {
      tab.style.display = "";
    };
  }, [mainSid]);
  (0, import_react24.useEffect)(() => {
    if (mainSid === void 0) return;
    editorPageOpenSession(mainSid);
    return () => {
      editorPageCloseSession(mainSid);
    };
  }, [mainSid]);
  const [scriptActors, setScriptActors] = (0, import_react24.useState)([]);
  const actorsFetchSeq = (0, import_react24.useRef)(0);
  const refreshActors = (0, import_react24.useCallback)((sid) => {
    const seq2 = ++actorsFetchSeq.current;
    console.log(`[femo-diag] GET /actors?sessionId=${sid} (seq=${seq2})`);
    void fetch(`/femo-plugin/actors?sessionId=${encodeURIComponent(sid)}`).then((response) => response.json()).then((data) => {
      console.log(`[femo-diag] /actors response (seq=${seq2}): ok=${String(data.ok)} actors=${JSON.stringify(data.actors)}`);
      if (seq2 !== actorsFetchSeq.current) {
        console.log(`[femo-diag] response STALE (seq=${seq2} != current ${actorsFetchSeq.current}), dropped`);
        return;
      }
      if (data.ok === true && data.actors !== void 0 && data.actors.length > 0) {
        setScriptActors(data.actors);
      } else {
        console.log("[femo-diag] response guarded out (ok=false or empty actors) \u2014 scriptActors unchanged");
      }
    }).catch((error) => {
      console.log(`[femo-diag] /actors fetch failed: ${String(error)}`);
    });
  }, []);
  (0, import_react24.useEffect)(() => {
    if (mainSid === void 0) return;
    refreshActors(mainSid);
    return () => {
      actorsFetchSeq.current += 1;
    };
  }, [mainSid, refreshActors]);
  (0, import_react24.useEffect)(() => {
    if (!open || mainSid === void 0) return;
    refreshActors(mainSid);
    warmCatalog?.(mainSid);
    void refreshWindows(mainSid);
  }, [open, mainSid, refreshActors, warmCatalog, refreshWindows]);
  (0, import_react24.useEffect)(() => {
    if (mainSid === void 0) return;
    void refreshWindows(mainSid);
  }, [mainSid, refreshWindows, scriptActors.length]);
  const pickView = (id) => {
    setOpen(false);
    const windowsOf = (w) => id === "god" ? w.god : id === "stage" ? w.stage : w.actors[id];
    void (async () => {
      if (id === "offstage") {
        setView(mainSid, "offstage");
        if (mainSid !== sessionId) {
          pendingTabTransfer = { kind: readActiveTabKind(), expiresAt: Date.now() + 5e3 };
          openSession(mainSid);
        }
        return;
      }
      let target = windowsOf(proj);
      if (target === void 0 && mainSid !== void 0) {
        const fresh = await refreshWindows(mainSid);
        if (fresh !== void 0) target = windowsOf(fresh);
      }
      if (target === void 0) {
        setView(mainSid, id);
        showHint(`\u300C${id}\u300D\u6682\u65F6\u6CA1\u6709\u53EF\u8DF3\u8F6C\u7684\u6295\u5F71\u7A97\uFF08\u5BBF\u4E3B\u672A\u88C5\u8F7D\u6216\u5267\u672C\u672A\u8FD0\u884C\uFF09\uFF1A\u5148\u6253\u5F00\u4E00\u6B21\u300C\u620F\u5916 \xB7 \u4E3B\u6A21\u578B\u300D\u518D\u70B9\u89C6\u89D2\u8BD5\u8BD5\u3002`);
        return;
      }
      if (id !== "stage") setView(mainSid, id);
      pendingTabTransfer = { kind: readActiveTabKind(), expiresAt: Date.now() + 5e3 };
      openSession(target, mainSid);
    })();
  };
  const snapshot = useSession((s) => s);
  const [turnScopes, setTurnScopes] = (0, import_react24.useState)({});
  const turnCount = snapshot.turnTimings?.size ?? 0;
  (0, import_react24.useEffect)(() => {
    if (mainSid === void 0) return;
    let cancelled = false;
    void fetch(`/femo-plugin/turn-scopes?sessionId=${encodeURIComponent(mainSid)}`).then((response) => response.json()).then((data) => {
      if (!cancelled && data.ok === true && data.scopes !== void 0) setTurnScopes(data.scopes);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [mainSid, turnCount]);
  (0, import_react24.useEffect)(() => {
    const STYLE_ID = "femo-plugin-view-filter";
    let style = document.getElementById(STYLE_ID);
    if (style === null) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (view === "god") {
      style.textContent = "";
      return;
    }
    if (view === "offstage") {
      const hiddenSelectors2 = [];
      for (const turn of Object.keys(turnScopes)) {
        hiddenSelectors2.push(`[data-chat-flow-key^="13:assistant-step${turn}:"]`);
      }
      style.textContent = hiddenSelectors2.length > 0 ? `${hiddenSelectors2.join(",\n")} { display: none !important }` : "";
      return;
    }
    const hiddenSelectors = [];
    for (const [turn, scope] of Object.entries(turnScopes)) {
      if (scope.length > 0 && !scope.includes(view)) {
        hiddenSelectors.push(`[data-chat-flow-key^="13:assistant-step${turn}:"]`);
      }
    }
    style.textContent = hiddenSelectors.length > 0 ? `${hiddenSelectors.join(",\n")} { display: none !important }` : "";
    return () => {
      style.textContent = "";
    };
  }, [view, turnScopes]);
  const rootRef = (0, import_react24.useRef)(null);
  (0, import_react24.useEffect)(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);
  (0, import_react24.useEffect)(() => {
    const STYLE_ID = "femo-plugin-proj-mother-name";
    let style = document.getElementById(STYLE_ID);
    if (style === null) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = typeof sessionId === "string" && sessionId.startsWith("femo-proj-") ? ".c-Z2Na_crumbs .c-Z2Na_crumbSeg:first-child .c-Z2Na_crumb { color: var(--dsw-alias-label-primary); pointer-events: none; }" : "";
    return () => {
      style.textContent = "";
    };
  }, [sessionId]);
  (0, import_react24.useEffect)(() => {
    if (pendingTabTransfer === null || mainSid === void 0) return;
    const { kind, expiresAt } = pendingTabTransfer;
    if (Date.now() > expiresAt) {
      pendingTabTransfer = null;
      return;
    }
    const wanted = kind === "editor" ? [FEMO_EDITOR_TAB_LABEL] : CHAT_TAB_LABELS;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const tabs = [...document.querySelectorAll('[role="tab"]')].filter((el) => el.offsetParent !== null);
      const selected = tabs.find((el) => el.getAttribute("aria-selected") === "true");
      if (selected !== void 0 && wanted.includes(selected.textContent ?? "")) {
        window.clearInterval(timer);
        pendingTabTransfer = null;
        return;
      }
      const target = tabs.find((el) => wanted.includes(el.textContent ?? ""));
      if (target !== void 0) {
        target.click();
        window.clearInterval(timer);
        pendingTabTransfer = null;
        return;
      }
      if (tries >= 20) {
        window.clearInterval(timer);
        pendingTabTransfer = null;
      }
    }, 100);
    return () => {
      window.clearInterval(timer);
    };
  }, [sessionId]);
  const { chatActors, hidden } = (0, import_react24.useMemo)(() => {
    const actors2 = /* @__PURE__ */ new Set();
    let hiddenCount = 0;
    for (const node of snapshot.chat?.nodes?.values() ?? []) {
      if (node.kind !== "femo-role") continue;
      const data = node.data;
      if (data === void 0) continue;
      if (data.actor !== void 0 && data.actor.length > 0) actors2.add(data.actor);
      if (view === "god") continue;
      if (data.kind === "sys") continue;
      if (view === "offstage" || data.kind === "notice" || data.kind === "error" || data.kind === "thinking") {
        hiddenCount += 1;
        continue;
      }
      if (data.visible !== void 0 && !data.visible.includes(view)) hiddenCount += 1;
    }
    return { chatActors: [...actors2], hidden: hiddenCount };
  }, [snapshot, view]);
  const actors = scriptActors.length > 0 ? scriptActors : chatActors;
  if (mainSid === void 0) return null;
  const activeViewId = (() => {
    if (mainSid === sessionId) {
      const stored = sessionId === void 0 ? void 0 : getView(sessionId);
      return stored ?? "offstage";
    }
    if (sessionId === proj.god) return "god";
    if (sessionId === proj.stage) return "stage";
    for (const [name, winId] of Object.entries(proj.actors)) {
      if (winId === sessionId) return name;
    }
    return typeof sessionId === "string" && sessionId.startsWith("femo-proj-") ? "god" : void 0;
  })();
  const label = activeViewId === "god" ? "\u4E0A\u5E1D\u89C6\u89D2" : activeViewId === "stage" ? "\u620F\u5185\u89C6\u89D2" : activeViewId === "offstage" ? "\u620F\u5916 \xB7 \u4E3B\u6A21\u578B" : activeViewId ?? "\u4E0A\u5E1D\u89C6\u89D2";
  const menu = open ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { style: {
    position: "absolute",
    top: "100%",
    left: "0",
    minWidth: "160px",
    maxHeight: "300px",
    overflowY: "auto",
    background: "var(--dsw-alias-bg-layer-1, #fff)",
    border: "1px solid var(--dsw-alias-border-l2, #ddd)",
    borderRadius: "8px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    padding: "4px",
    zIndex: 100,
    fontSize: "13px"
  }, children: [
    { id: "offstage", label: "\u620F\u5916 \xB7 \u4E3B\u6A21\u578B", Icon: FaRobot },
    { id: "god", label: "\u4E0A\u5E1D\u89C6\u89D2", Icon: FaPodcast },
    // 戏内项与角色项同门槛（2026-08-28 用户拍板"和角色视角一个道理"）：
    // 有剧本记录（角色表非空）才显示——没跑过的剧本其 stage 窗会被宿主
    // 判 blank（Hero 态隐藏整个 header，点进去连视角菜单都消失换不回来）。
    ...actors.length > 0 ? [{ id: "stage", label: "\u620F\u5185\u89C6\u89D2", Icon: FaClapperboard }] : [],
    ...actors.map((actor) => ({ id: actor, label: actor, Icon: FaUserSecret }))
  ].map((item) => /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
    "button",
    {
      type: "button",
      onClick: () => {
        pickView(item.id);
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: "7px",
        width: "100%",
        padding: "6px 10px",
        border: "none",
        borderRadius: "6px",
        background: item.id === activeViewId ? "var(--dsw-alias-button-info-fill, #4a9eff)" : "transparent",
        color: item.id === activeViewId ? "#fff" : "var(--dsw-alias-label-primary, #222)",
        cursor: "pointer",
        textAlign: "left",
        whiteSpace: "nowrap"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(item.Icon, { size: 14 }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { children: item.label })
      ]
    },
    item.id
  )) }) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { ref: rootRef, style: { position: "relative" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
      "button",
      {
        type: "button",
        "aria-haspopup": "menu",
        "aria-expanded": open,
        title: activeViewId === "god" ? "\u4E0A\u5E1D\u89C6\u89D2\uFF1A\u663E\u793A\u5168\u90E8\u6D88\u606F" : activeViewId === "stage" ? "\u620F\u5185\u89C6\u89D2\uFF1A\u5267\u672C\u5185\u5168\u90E8\u5185\u5BB9\uFF08\u4E0D\u542B\u620F\u5916\u5BF9\u8BDD\uFF09" : activeViewId === "offstage" ? "\u620F\u5916 \xB7 \u4E3B\u6A21\u578B" : `\u89D2\u8272\u89C6\u89D2\uFF1A\u4EC5\u663E\u793A ${activeViewId} \u53EF\u89C1\u7684\u6D88\u606F`,
        onClick: () => {
          setOpen((value) => !value);
        },
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          border: "none",
          background: "transparent",
          padding: 0,
          color: "var(--dsw-alias-label-primary, #222)",
          cursor: "pointer",
          fontSize: "12px",
          whiteSpace: "nowrap"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(FaEye, { size: 12 }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { children: label }),
          view !== "god" && hidden > 0 && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { style: { opacity: 0.75 }, children: [
            "\xB7 \u9690\u85CF",
            hidden
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { style: { display: "inline-flex", alignItems: "center", transform: open ? "rotate(180deg)" : void 0, transition: "transform 150ms ease" }, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_dsh_client_ui_primitives5.IconChevronDownOutline14, {}) })
        ]
      }
    ),
    menu,
    hint !== null && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
      "div",
      {
        style: {
          position: "absolute",
          top: "100%",
          left: 0,
          marginTop: 4,
          maxWidth: 260,
          padding: "6px 8px",
          borderRadius: 8,
          background: "var(--dsw-alias-bg-layer-1, #fff)",
          border: "1px solid var(--dsw-alias-border-l2, #ddd)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          fontSize: 11.5,
          lineHeight: 1.5,
          color: "var(--dsw-alias-label-primary, #222)",
          whiteSpace: "normal",
          zIndex: 101
        },
        children: [
          "\u26A0 ",
          hint.text
        ]
      }
    )
  ] });
}
function FemoSubagentCount({ useSession, useSessions, openChild, refresh, setCatalogOpen, t }) {
  const sessionId = useSession((s) => s.sessionId);
  const mainSid = useSessions((state) => {
    if (typeof sessionId !== "string") return void 0;
    const summary = state.byId[sessionId];
    if (summary?.agentPreset === "femo-plugin" && summary?.parentId === void 0) return sessionId;
    return void 0;
  });
  if (mainSid === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
    CatalogDropdown,
    {
      rootSessionId: mainSid,
      variant: "count",
      showRunning: true,
      hideWhenZero: true,
      useSessions,
      openChild,
      refresh,
      setCatalogOpen,
      t
    }
  );
}

// client/client-ui/composer.tsx
var import_react25 = require("react");
var import_dsh_client_ui_primitives6 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime24 = require("react/jsx-runtime");
var DRAFT_STORE_KEY = "femo-plugin.composer.drafts";
function readDrafts() {
  try {
    const raw = localStorage.getItem(DRAFT_STORE_KEY);
    if (raw === null) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
function writeDraft(sid, text) {
  try {
    const drafts = readDrafts();
    if (text === "") delete drafts[sid];
    else drafts[sid] = text;
    localStorage.setItem(DRAFT_STORE_KEY, JSON.stringify(drafts));
  } catch {
  }
}
function useProjectionValue(face, key) {
  const subscribe = (0, import_react25.useCallback)((onChanged) => {
    return face?.projections?.faceOf(key).subscribe(onChanged) ?? (() => {
    });
  }, [face, key]);
  const getSnapshot = (0, import_react25.useCallback)(() => {
    return face?.projections?.faceOf(key).getSnapshot() ?? void 0;
  }, [face, key]);
  return (0, import_react25.useSyncExternalStore)(subscribe, getSnapshot);
}
function useMainSnapshot(face) {
  const subscribe = (0, import_react25.useCallback)((onChanged) => {
    return face?.subscribe?.(onChanged) ?? (() => {
    });
  }, [face]);
  const getSnapshot = (0, import_react25.useCallback)(() => {
    return face?.getSnapshot?.();
  }, [face]);
  return (0, import_react25.useSyncExternalStore)(subscribe, getSnapshot);
}
function formatTokens3(n) {
  const scaled = (v) => v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  if (n < 1e3) return String(n);
  if (n < 1e6) return `${scaled(n / 1e3)}K`;
  return `${scaled(n / 1e6)}M`;
}
function formatDuration3(ms) {
  const s = ms / 1e3;
  if (s < 60) return `${Math.round(s * 10) / 10}s`;
  const whole = Math.round(s);
  return `${Math.floor(whole / 60)}m${whole % 60}s`;
}
function formatTokensPerSecond(tps) {
  const clamped = Math.max(0, tps);
  return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10);
}
function billedInputTokens(usage) {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
function roundedIntegerPercent(cacheReadTokens, denominator) {
  const denominatorQuotient = Math.floor(denominator / 200);
  const denominatorRemainder = denominator % 200;
  let lower = 0;
  let upper = 100;
  while (lower < upper) {
    const candidate = Math.floor((lower + upper + 1) / 2);
    const factor = candidate * 2 - 1;
    const threshold = factor * denominatorQuotient + Math.ceil(factor * denominatorRemainder / 200);
    if (cacheReadTokens >= threshold) {
      lower = candidate;
      continue;
    }
    upper = candidate - 1;
  }
  return lower;
}
function cacheHitPercent(usage) {
  const denominator = billedInputTokens(usage);
  if (denominator === 0) return null;
  const missedInputTokens = usage.uncachedInputTokens + usage.cacheWriteTokens;
  if (missedInputTokens === 0) return "100";
  const integerPercent = roundedIntegerPercent(usage.cacheReadTokens, denominator);
  if (integerPercent < 100) return String(integerPercent);
  let decimalPlaces = 1;
  let scaledDoubleGap = missedInputTokens * 200;
  const denominatorTens = Math.floor(denominator / 10);
  while (scaledDoubleGap <= denominatorTens) {
    scaledDoubleGap *= 10;
    decimalPlaces += 1;
  }
  const denominatorOnes = denominator % 10;
  let roundedLoss = 5;
  for (let loss = 1; loss < 5; loss++) {
    const factor = loss * 2 + 1;
    const threshold = factor * denominatorTens + Math.floor(factor * denominatorOnes / 10);
    if (scaledDoubleGap <= threshold) {
      roundedLoss = loss;
      break;
    }
  }
  return `99.${"9".repeat(decimalPlaces - 1)}${10 - roundedLoss}`;
}
var STATS_COUNTS = "{turns} \u8F6E \xB7 {steps} \u6B65";
var STATS_LLM = "LLM {duration}";
var STATS_TOOL = "\u5DE5\u5177\u8C03\u7528 {duration}";
var STATS_TTFT = "\u9996 token \u5E73\u5747 {duration}";
var STATS_TPS = "{throughput} tok/s";
var STATS_CACHE_HIT = "\u7F13\u5B58\u547D\u4E2D {percent}%";
var STATS_TOKENS = "\u8F93\u5165 {input} tok \xB7 \u8F93\u51FA {output} tok";
function fill(template, params) {
  return template.replace(/\{(\w+)\}/gu, (_, name) => params[name] ?? "");
}
function StatsRow({ face }) {
  const stats = useProjectionValue(face, "sessionStats");
  const usage = useProjectionValue(face, "tokenUsage");
  const groups = [];
  if (stats !== void 0 && typeof stats === "object" && stats.steps > 0) {
    groups.push(fill(STATS_COUNTS, { turns: String(stats.turns), steps: String(stats.steps) }));
    const durations = [];
    if (stats.llmMs > 0) durations.push(fill(STATS_LLM, { duration: formatDuration3(stats.llmMs) }));
    if (stats.toolMs > 0) durations.push(fill(STATS_TOOL, { duration: formatDuration3(stats.toolMs) }));
    if (durations.length > 0) groups.push(durations.join(" \xB7 "));
    const speeds = [];
    if (stats.ttftSteps > 0) speeds.push(fill(STATS_TTFT, { duration: formatDuration3(stats.ttftMs / stats.ttftSteps) }));
    if (stats.decodeMs > 0) {
      speeds.push(fill(STATS_TPS, { throughput: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3)) }));
    }
    if (speeds.length > 0) groups.push(speeds.join(" \xB7 "));
  }
  if (usage !== void 0 && typeof usage === "object" && (billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
    const cacheHit = cacheHitPercent(usage);
    if (cacheHit !== null) groups.push(fill(STATS_CACHE_HIT, { percent: cacheHit }));
    groups.push(fill(STATS_TOKENS, {
      input: formatTokens3(billedInputTokens(usage)),
      output: formatTokens3(usage.outputTokens)
    }));
  }
  if (groups.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "femo-comp-stats", children: groups.map((group, i) => /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("span", { children: [
    i > 0 && /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_jsx_runtime24.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: "femo-comp-stats-sep", "aria-hidden": true, children: "|" }),
      " "
    ] }),
    group
  ] }, group)) });
}
function contextOccupancy(pressure) {
  const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens;
  if (usedTokens === void 0 || pressure?.contextWindow === void 0) return null;
  return {
    percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
    usedTokens,
    contextWindow: pressure.contextWindow
  };
}
var METER_RADIUS = 5.5;
var METER_CIRCUMFERENCE = 2 * Math.PI * METER_RADIUS;
var METER_ROWS = [
  { key: "systemTokens", label: "\u7CFB\u7EDF\u63D0\u793A\u8BCD", tintClass: "femo-comp-meter-tint-system" },
  { key: "toolsTokens", label: "\u5DE5\u5177", tintClass: "femo-comp-meter-tint-tools" },
  { key: "messageTokens", label: "\u5BF9\u8BDD\u6D88\u606F", tintClass: "femo-comp-meter-tint-messages" }
];
var METER_ARIA = "\u4E0A\u4E0B\u6587\u5DF2\u7528 {percent}";
function ContextRing({ data }) {
  const [open, setOpen] = (0, import_react25.useState)(false);
  const rootRef = (0, import_react25.useRef)(null);
  const percent = data.percent;
  const reading = `${percent}%`;
  const aria = fill(METER_ARIA, { percent: reading });
  (0, import_react25.useEffect)(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target) === true) return;
      setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const breakdown = data.breakdown;
  const breakdownTotal = breakdown === void 0 ? 0 : breakdown.systemTokens + breakdown.toolsTokens + breakdown.messageTokens;
  const parts = breakdown === void 0 || breakdownTotal === 0 ? [{ key: "total", tintClass: void 0, width: percent }] : METER_ROWS.map((row) => ({ key: row.key, tintClass: row.tintClass, width: percent * breakdown[row.key] / breakdownTotal }));
  const segments = parts.filter((part) => part.width > 0);
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("span", { ref: rootRef, className: "femo-comp-meter", children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_dsh_client_ui_primitives6.Tooltip, { label: aria, side: "top", delayMs: 200, disabled: open, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      "button",
      {
        type: "button",
        className: "femo-comp-meter-trigger",
        "aria-label": aria,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        onClick: () => {
          setOpen(!open);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("svg", { viewBox: "0 0 14 14", width: "14", height: "14", "aria-hidden": true, children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("circle", { className: "femo-comp-meter-track", cx: "7", cy: "7", r: METER_RADIUS }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
            "circle",
            {
              className: "femo-comp-meter-fill",
              cx: "7",
              cy: "7",
              r: METER_RADIUS,
              strokeDasharray: `${METER_CIRCUMFERENCE * percent / 100} ${METER_CIRCUMFERENCE}`,
              transform: "rotate(-90 7 7)"
            }
          )
        ] })
      }
    ) }),
    open && /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "femo-comp-meter-panel", role: "dialog", "aria-label": fill(METER_ARIA, { percent: "" }).trim(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "femo-comp-meter-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: "femo-comp-meter-headline", children: "\u4E0A\u4E0B\u6587\u5DF2\u7528" }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: "femo-comp-meter-percent", children: reading }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: "femo-comp-meter-figures", children: `~${formatTokens3(data.usedTokens)} / ${formatTokens3(data.contextWindow)}` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "femo-comp-meter-bar", children: segments.map((segment) => /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
        "div",
        {
          className: segment.tintClass === void 0 ? "femo-comp-meter-segment" : `femo-comp-meter-segment ${segment.tintClass}`,
          style: { width: `${segment.width}%` }
        },
        segment.key
      )) }),
      data.note !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "femo-comp-meter-headline", children: data.note }),
      breakdown !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("dl", { className: "femo-comp-meter-rows", children: METER_ROWS.map((row) => /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "femo-comp-meter-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("dt", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: `femo-comp-meter-swatch ${row.tintClass}`, "aria-hidden": true }),
          row.label
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("dd", { children: `~${formatTokens3(breakdown[row.key])}` })
      ] }, row.key)) })
    ] })
  ] });
}
function GodContextRing({ face }) {
  const pressure = useProjectionValue(face, "contextPressure");
  const breakdown = useProjectionValue(face, "contextBreakdown");
  const data = contextOccupancy(pressure);
  if (data === null) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(ContextRing, { data: breakdown === void 0 ? data : { ...data, breakdown } });
}
function ActorContextRing({ mainSid, actorKey }) {
  const usage = useActorUsage(mainSid, actorKey);
  if (usage === void 0 || usage.contextWindow <= 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(ContextRing, { data: {
    percent: Math.min(100, Math.round(usage.usedTokens / usage.contextWindow * 100)),
    usedTokens: usage.usedTokens,
    contextWindow: usage.contextWindow,
    note: usage.model.length > 0 ? `\u6A21\u578B ${usage.model}` : void 0
  } });
}
var FULL_ACCESS = "danger-full-access";
var SHIELD_OUTLINE = "M8.20554 0.899994L14.7901 3.36857V7.01026C14.7901 12 11.0466 14.2103 8.20554 15.3C5.36446 14.2103 1.62012 12 1.62012 7.01026V3.36857L8.20554 0.899994Z";
var permissionGlyphs = {
  "read-only": /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: SHIELD_OUTLINE, stroke: "currentColor", strokeWidth: "1.31831", strokeLinejoin: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M12.1654 5.7552L8.9447 9.41475C8.73044 9.65816 8.53628 9.8804 8.35774 10.0423C8.1713 10.2114 7.94235 10.3717 7.64016 10.4254C7.48207 10.4535 7.32 10.4552 7.16151 10.4294C6.85843 10.3801 6.62728 10.2223 6.43836 10.0559C6.25752 9.89653 6.06037 9.67732 5.84264 9.43705L4.72925 8.20897L5.63557 7.38707L6.74897 8.61594C6.98603 8.87755 7.12974 9.03533 7.24673 9.13839C7.31033 9.19443 7.34485 9.21476 7.35823 9.22122C7.38068 9.22484 7.40352 9.22515 7.42593 9.22122C7.40522 9.22502 7.42893 9.23294 7.53583 9.136C7.65132 9.03126 7.79316 8.87139 8.02643 8.60638L11.2479 4.94763L12.1654 5.7552Z", fill: "currentColor" })
  ] }),
  "workspace-write": /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M8.08887 0.251709C8.20479 0.23085 8.32486 0.241168 8.43652 0.282959L15.0215 2.75171C15.2787 2.84819 15.4492 3.09414 15.4492 3.3689V7.0105C15.4492 7.10986 15.4441 7.2081 15.4414 7.30542C15.0285 7.07175 14.5905 6.87695 14.1309 6.73022V3.82495L8.20508 1.60327L2.2793 3.82495V7.0105C2.27936 9.7171 3.4745 11.5379 5.02734 12.7947C5.01025 12.9942 5 13.1962 5 13.4001C5.00001 13.7617 5.02722 14.1169 5.08008 14.4636C2.91555 13.0393 0.961014 10.752 0.960938 7.0105V3.3689C0.960938 3.09417 1.13146 2.84821 1.38867 2.75171L7.97461 0.282959L8.08887 0.251709Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M11.3525 5.64688V6.85688H5V5.64688H11.3525Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M9.5824 8.29376V9.50376H5V8.29376H9.5824Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M14.6647 15.6852H10.0338C10.3878 15.3751 10.7567 15.0517 11.0772 14.7706C11.2531 14.6164 11.4144 14.4746 11.5511 14.3547H14.6647V15.6852Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M8.14852 14.1308L7.33925 15.4976C7.22458 15.6912 7.42245 15.9194 7.63037 15.8333L9.09785 15.2254L15.0399 10.0719L14.0905 8.97733L8.14852 14.1308Z", fill: "currentColor" })
  ] }),
  [FULL_ACCESS]: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: SHIELD_OUTLINE, stroke: "currentColor", strokeWidth: "1.31831", strokeLinejoin: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M9.10094 4.5V8.75939H7.59888V4.5H9.10094Z", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M9.10094 9.8114V11.5H7.59888V9.8114H9.10094Z", fill: "currentColor" })
  ] })
};
function displayName(name) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/u.test(name)) return name;
  return name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function optionLabel(option) {
  return option.value === FULL_ACCESS ? "Full access" : displayName(option.name);
}
var ACCESS_CONFIRM_TITLE = "\u786E\u8BA4\u542F\u7528 Full access\uFF1F";
var ACCESS_CONFIRM_DESCRIPTION = "\u542F\u7528 Full access \u540E\uFF0Cagent \u5C06\u51CF\u5C11\u786E\u8BA4\u6B65\u9AA4\uFF0C\u5E76\u4E14\u53EF\u4EE5\u76F4\u63A5\u6267\u884C\u66F4\u591A\u64CD\u4F5C\uFF0C\u5305\u62EC\u654F\u611F\u64CD\u4F5C\u3001\u6587\u4EF6\u4FEE\u6539\u6216\u5916\u90E8\u547D\u4EE4\u3002\u4EC5\u5EFA\u8BAE\u5728\u4F60\u4FE1\u4EFB\u5F53\u524D\u4EFB\u52A1\u65F6\u4F7F\u7528\u3002";
var ACCESS_CONFIRM_ACKNOWLEDGE = "\u6211\u5DF2\u4E86\u89E3\u98CE\u9669\uFF0C\u5E76\u613F\u610F\u7EE7\u7EED";
var ACCESS_CONFIRM_CANCEL = "\u53D6\u6D88";
var ACCESS_CONFIRM_ENABLE = "\u542F\u7528 Full access";
function PermissionMenu({ face, disabled }) {
  const value = useProjectionValue(face, "permissions");
  const [open, setOpen] = (0, import_react25.useState)(false);
  const [pick, setPick] = (0, import_react25.useState)(null);
  const [confirmation, setConfirmation] = (0, import_react25.useState)(null);
  const [acknowledged, setAcknowledged] = (0, import_react25.useState)(false);
  (0, import_react25.useEffect)(() => {
    if (!disabled && value !== void 0) return;
    setOpen(false);
    setAcknowledged(false);
    setConfirmation(null);
  }, [disabled, value]);
  if (value === void 0 || typeof value !== "object" || face?.command === void 0) return null;
  const currentValue = pick ?? value.currentValue;
  const current = value.options.find((option) => option.value === currentValue);
  const busy = pick !== null || confirmation !== null;
  const items = value.options.filter((option) => option.value !== "custom").map((option) => {
    const icon = permissionGlyphs[option.value];
    return { id: option.value, label: optionLabel(option), ...icon === void 0 ? {} : { icon } };
  });
  const submit = (id) => {
    setPick(id);
    void face.command?.(`/permission ${id}`).catch(() => false).then(() => {
      setPick(null);
    });
  };
  const choose = (id) => {
    setOpen(false);
    if (id === value.currentValue) return;
    if (id === FULL_ACCESS) {
      setAcknowledged(false);
      setConfirmation(id);
      return;
    }
    submit(id);
  };
  const closeConfirmation = () => {
    setAcknowledged(false);
    setConfirmation(null);
  };
  const confirmFullAccess = () => {
    if (disabled || !acknowledged || confirmation === null) return;
    const id = confirmation;
    closeConfirmation();
    submit(id);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_jsx_runtime24.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      import_dsh_client_ui_primitives6.Menu,
      {
        open,
        items,
        selectedId: currentValue,
        onSelect: choose,
        onClose: () => {
          setOpen(false);
        },
        side: "top",
        anchor: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(
          "button",
          {
            type: "button",
            className: "femo-comp-perm-trigger",
            "aria-label": fill("\u8BBF\u95EE\u6A21\u5F0F\uFF0C\u5F53\u524D\uFF1A{name}", { name: current === void 0 ? displayName(currentValue) : optionLabel(current) }),
            title: current?.description,
            disabled: disabled || busy,
            onClick: () => {
              setOpen(!open);
            },
            children: [
              permissionGlyphs[currentValue] !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: "femo-comp-perm-icon", "aria-hidden": true, children: permissionGlyphs[currentValue] }),
              /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: "femo-comp-perm-label", children: current === void 0 ? displayName(currentValue) : optionLabel(current) }),
              /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: "femo-comp-perm-chevron", "data-open": open, "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_dsh_client_ui_primitives6.IconChevronDownOutline14, {}) })
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      import_dsh_client_ui_primitives6.RiskConfirmation,
      {
        open: confirmation !== null,
        title: ACCESS_CONFIRM_TITLE,
        description: ACCESS_CONFIRM_DESCRIPTION,
        acknowledgeLabel: ACCESS_CONFIRM_ACKNOWLEDGE,
        cancelLabel: ACCESS_CONFIRM_CANCEL,
        confirmLabel: ACCESS_CONFIRM_ENABLE,
        acknowledged,
        disabled,
        onAcknowledgedChange: setAcknowledged,
        onCancel: closeConfirmation,
        onConfirm: confirmFullAccess
      }
    )
  ] });
}
var IDLE_RUN_STATE = { running: false, waiting: false, waitScope: [] };
function composerButtonState(args) {
  const { winKind, actor, run, mainRunning } = args;
  if (winKind === "god") {
    if (run.running) return run.waiting ? "send" : "disabled";
    return mainRunning ? "stop" : "send";
  }
  if (winKind === "stage") {
    return run.running && run.waiting ? "send" : "disabled";
  }
  if (winKind === "actor") {
    const humanTarget = actor !== void 0 && run.waitScope.includes(actor);
    return run.running && run.waiting && humanTarget ? "send" : "disabled";
  }
  return "disabled";
}
function ProjectionComposer({ useSession, useSessions, getSessionFace }) {
  const sessionId = useSession((s) => s.sessionId);
  const [text, setText] = (0, import_react25.useState)("");
  const [busy, setBusy] = (0, import_react25.useState)(false);
  const [error, setError] = (0, import_react25.useState)(null);
  const composingRef = (0, import_react25.useRef)(false);
  const inputRef = (0, import_react25.useRef)(null);
  const errorSeqRef = (0, import_react25.useRef)(0);
  (0, import_react25.useEffect)(() => {
    if (sessionId === void 0) return;
    setText(readDrafts()[sessionId] ?? "");
  }, [sessionId]);
  const changeText = (next) => {
    setText(next);
    if (sessionId !== void 0) writeDraft(sessionId, next);
  };
  const mainSid = useSessions((state) => {
    if (typeof sessionId !== "string") return void 0;
    const pid = state?.byId?.[sessionId]?.parentId;
    return typeof pid === "string" && pid.length > 0 ? pid : void 0;
  });
  const mainListed = useSessions((state) => typeof mainSid === "string" && Array.isArray(state?.ids) && state.ids.includes(mainSid));
  const mainFace = (0, import_react25.useMemo)(
    () => mainSid === void 0 || !mainListed ? void 0 : getSessionFace?.(mainSid),
    [mainSid, mainListed, getSessionFace]
  );
  const mainSnapshot = useMainSnapshot(mainFace);
  const mainRunning = mainSnapshot?.running === true;
  const [run, setRun] = (0, import_react25.useState)(IDLE_RUN_STATE);
  const [winInfo, setWinInfo] = (0, import_react25.useState)({ winKind: "none" });
  const applyState = (0, import_react25.useCallback)((data) => {
    setWinInfo({ winKind: data.winKind ?? "none", actor: data.actor });
    if (data.ok === true) {
      setRun({
        running: data.running === true,
        waiting: data.waiting === true,
        waitScope: Array.isArray(data.waitScope) ? data.waitScope : [],
        prompt: typeof data.prompt === "string" ? data.prompt : void 0
      });
    }
  }, []);
  const refreshRunState = (0, import_react25.useCallback)((sessionIdValue) => {
    void fetch(`/femo-plugin/projection-state?sessionId=${encodeURIComponent(sessionIdValue)}`).then((r) => r.json()).then((data) => {
      applyState(data);
    }).catch(() => {
    });
  }, [applyState]);
  (0, import_react25.useEffect)(() => {
    if (sessionId === void 0 || !sessionId.startsWith("femo-proj-")) {
      setWinInfo({ winKind: "none" });
      return;
    }
    refreshRunState(sessionId);
    const timer = window.setInterval(() => {
      refreshRunState(sessionId);
    }, 8e3);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshRunState(sessionId);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [sessionId, refreshRunState]);
  (0, import_react25.useEffect)(() => {
    if (mainSid === void 0) return;
    return femoStreamAcquire({ background: true });
  }, [sessionId, mainSid]);
  (0, import_react25.useEffect)(() => {
    if (mainSid === void 0) return;
    return subscribeControlEvents((msg) => {
      if (msg.type !== "projection_state") return;
      const data = msg.data;
      if (data === void 0 || data.sid !== mainSid) return;
      setRun({
        running: data.running === true,
        waiting: data.waiting === true,
        waitScope: Array.isArray(data.waitScope) ? data.waitScope : [],
        prompt: typeof data.prompt === "string" ? data.prompt : void 0
      });
    });
  }, [mainSid]);
  const buttonState = composerButtonState({ winKind: winInfo.winKind, actor: winInfo.actor, run, mainRunning });
  const submit = () => {
    const value = text.trim();
    if (value.length === 0 || busy || sessionId === void 0) return;
    setBusy(true);
    const post = async () => fetch("/femo-plugin/projection-input", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, text: value })
    });
    void (async () => {
      try {
        let response = await post();
        let data = await response.json().catch(() => ({}));
        if (data.ok !== true && response.status === 404 && sessionId.startsWith("femo-proj-")) {
          const mainSid0 = sessionId.slice("femo-proj-".length).replace(/-[^-]*$/, "");
          const woken = mainSid0.length > 0 ? await fetch(`/femo-plugin/projection-windows?sessionId=${encodeURIComponent(mainSid0)}`).then((r) => r.ok).catch(() => false) : false;
          if (woken) {
            response = await post();
            data = await response.json().catch(() => ({}));
          }
        }
        if (data.ok === true) {
          changeText("");
          return;
        }
        errorSeqRef.current += 1;
        setError({ seq: errorSeqRef.current, text: data.error ?? `\u53D1\u9001\u5931\u8D25\uFF08HTTP ${response.status}\uFF09\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559` });
      } catch {
        errorSeqRef.current += 1;
        setError({ seq: errorSeqRef.current, text: "\u53D1\u9001\u5931\u8D25\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559" });
      } finally {
        setBusy(false);
      }
    })();
  };
  (0, import_react25.useEffect)(() => {
    if (error === null) return;
    const timer = setTimeout(() => {
      setError(null);
    }, 4e3);
    return () => {
      clearTimeout(timer);
    };
  }, [error]);
  (0, import_react25.useEffect)(() => {
    if (busy) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [sessionId]);
  const onKeyDown = (e) => {
    if (e.key === "Enter" && e.shiftKey) return;
    if (e.key !== "Enter") return;
    const composing = composingRef.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
    if (composing) return;
    e.preventDefault();
    if (e.repeat) return;
    submit();
  };
  const keepFocus = (e) => {
    e.preventDefault();
    inputRef.current?.focus({ preventScroll: true });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "femo-comp-root", children: [
    run.waiting && run.prompt !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { role: "status", style: {
      margin: "0 0 6px",
      padding: "8px 12px",
      borderRadius: "8px",
      background: "color-mix(in srgb, var(--dsw-alias-button-info-fill, #4a9eff) 12%, transparent)",
      border: "1px solid color-mix(in srgb, var(--dsw-alias-button-info-fill, #4a9eff) 40%, transparent)",
      color: "var(--dsw-alias-label-primary, #222)",
      fontSize: "13px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 5 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(FemoLogo, { size: 12, style: { flexShrink: 0 } }),
      run.prompt
    ] }) }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "femo-comp-notice", role: "status", children: error.text }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "femo-comp-card", "data-composer-card": "", children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "femo-comp-scroll", "data-input-scroll": "", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "femo-comp-grow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { "aria-hidden": true, className: "femo-comp-mirror", "data-input-mirror": "", children: `${text}
` }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
          "textarea",
          {
            ref: inputRef,
            className: "femo-comp-input",
            value: text,
            readOnly: busy,
            placeholder: "\u8F93\u5165\u6D88\u606F\u2026",
            rows: 2,
            spellCheck: false,
            "data-phase": busy ? "submitting" : "idle",
            onChange: (e) => {
              changeText(e.currentTarget.value);
            },
            onKeyDown,
            onCompositionStart: () => {
              composingRef.current = true;
            },
            onCompositionEnd: () => {
              setTimeout(() => {
                composingRef.current = false;
              }, 10);
            }
          }
        )
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "femo-comp-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(PermissionMenu, { face: mainFace, disabled: busy }),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "femo-comp-trailing", children: [
          sessionId !== void 0 && mainSid !== void 0 && sessionId.startsWith(`femo-proj-${mainSid}-`) && (() => {
            const actorKey = sessionId.slice(`femo-proj-${mainSid}-`.length);
            if (actorKey === "god") return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(GodContextRing, { face: mainFace });
            if (actorKey !== "stage") return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(ActorContextRing, { mainSid, actorKey });
            return null;
          })(),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
            "button",
            {
              type: "button",
              className: "femo-comp-primary",
              "aria-label": buttonState === "stop" ? "\u505C\u6B62" : buttonState === "send" ? busy ? "\u53D1\u9001\u4E2D" : "\u53D1\u9001" : "\u5F53\u524D\u4E0D\u53EF\u53D1\u9001",
              disabled: buttonState === "stop" ? mainFace?.cancel === void 0 : buttonState !== "send" || busy || text.trim().length === 0,
              onMouseDown: keepFocus,
              onClick: buttonState === "stop" ? () => {
                void mainFace?.cancel?.()?.catch(() => {
                });
              } : submit,
              children: buttonState === "stop" ? /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("svg", { viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("rect", { x: "3", y: "3", width: "10", height: "10", rx: "3", fill: "currentColor" }) }) : /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("svg", { viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("path", { d: "M8.3125 0.980183C8.66767 1.0531 8.97902 1.20418 9.2627 1.43233C9.48724 1.61297 9.73029 1.85793 9.97949 2.10714L14.707 6.83468L13.293 8.24874L9 3.95577V15.0417H7V3.95577L2.70703 8.24874L1.29297 6.83468L6.02051 2.10714C6.26971 1.85793 6.51277 1.61297 6.7373 1.43233C6.97662 1.23986 7.28445 1.04402 7.6875 0.980183C7.8973 0.947006 8.1031 0.95516 8.3125 0.980183Z", fill: "currentColor" }) })
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(StatsRow, { face: mainFace })
  ] });
}

// client/client.tsx
var inject = ["slots", "sessions", "layout"];
function apply(ctx) {
  ensureFemoStreamStyles();
  const slots = ctx?.get?.("slots") ?? ctx?.slots;
  if (slots === void 0 || typeof slots.inject !== "function") {
    console.warn("[femo-plugin] slots service unavailable; UI not registered");
    return;
  }
  const sessions = ctx?.get?.("sessions");
  window.__femoSessions = sessions;
  window.__femoNative = false;
  void fetch("/femo-plugin/native-flag").then((r) => r.json()).then((data) => {
    const native = data.ok === true && data.native === true;
    window.__femoNative = native;
    if (native) {
      registerNativeCatalogFilter();
      return;
    }
    registerLegacyCatalogUi();
  }).catch(() => {
    registerLegacyCatalogUi();
  });
  const proj2 = proj2Enabled();
  const registerFemoNodes = (register) => {
    register(femoChatDefinition);
    if (proj2) {
      registerProj2Nodes(register);
      return;
    }
    console.log("[femo-plugin] femo conversation nodes registered (degraded: role only)");
  };
  const resolveNodeRegistry = () => {
    const ui = ctx?.get?.("uiConversation");
    if (ui?.events?.register !== void 0) {
      return (def) => {
        ui.events.register(def);
      };
    }
    const legacy = ctx?.get?.("conversationEvents");
    if (legacy?.register !== void 0) return (def) => {
      legacy.register(def);
    };
    return void 0;
  };
  const nodeRegistry = resolveNodeRegistry();
  if (nodeRegistry !== void 0) {
    registerFemoNodes(nodeRegistry);
  } else {
    let tries = 0;
    const nodeRegistryTimer = setInterval(() => {
      tries += 1;
      const found = resolveNodeRegistry();
      if (found !== void 0) {
        clearInterval(nodeRegistryTimer);
        registerFemoNodes(found);
      } else if (tries >= 20) {
        clearInterval(nodeRegistryTimer);
        console.warn("[femo-plugin] conversation node registry unavailable after 20s; femo-role node not registered");
      }
    }, 1e3);
  }
  const injected = () => ({
    listScripts: async () => {
      const response = await fetch("/femo-plugin/scripts");
      if (!response.ok) throw new Error(`scripts HTTP ${response.status}`);
      const data = await response.json();
      if (data.ok !== true || data.scripts === void 0) {
        throw new Error(data.error ?? "list scripts failed");
      }
      return data.scripts;
    },
    saveScript: async (name, content, sessionId) => {
      const isPath = /^[a-zA-Z]:[\\/]/.test(name) || name.startsWith("/") || name.startsWith("\\\\");
      const response = await fetch("/femo-plugin/save-script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...isPath ? { path: name } : { name },
          content,
          ...sessionId !== void 0 ? { sessionId } : {}
        })
      });
      if (!response.ok) {
        let detail = "";
        try {
          const errData = await response.json();
          if (typeof errData.error === "string" && errData.error.length > 0) detail = `: ${errData.error}`;
        } catch {
        }
        throw new Error(`save-script HTTP ${response.status}${detail}`);
      }
      const data = await response.json();
      if (data.ok !== true || data.path === void 0) {
        throw new Error(data.error ?? "save-script failed");
      }
      return data.path;
    }
  });
  const viewInjected = () => ({
    // 预热父会话子代理目录（0.1.3 目录冷加载较慢，菜单打开时提前拉）。
    warmCatalog: (sid) => {
      try {
        sessions?.refreshSubagents?.(sid);
      } catch {
      }
    },
    openSession: (id, parentSessionId) => {
      const native = window.__femoNative === true;
      if (native && parentSessionId !== void 0 && id.startsWith("femo-proj-") && sessions?.openSubagent !== void 0) {
        void (async () => {
          let wakeOk = false;
          try {
            const r = await fetch(`/femo-plugin/projection-windows?sessionId=${encodeURIComponent(parentSessionId)}`);
            wakeOk = r.ok;
          } catch {
          }
          try {
            sessions.refreshSubagents?.(parentSessionId);
          } catch {
          }
          for (let attempt = 0; attempt < 40; attempt += 1) {
            try {
              sessions.openSubagent({ parentSessionId, childSessionId: id, mode: "one-shot" });
              return;
            } catch {
              await new Promise((resolve) => setTimeout(resolve, 500));
              if (attempt % 5 === 4) {
                try {
                  sessions.refreshSubagents?.(parentSessionId);
                } catch {
                }
              }
            }
          }
          console.error("[femo-plugin] projection window open timed out (catalog never listed the child):", id);
        })();
        return;
      }
      sessions?.open?.(id);
    },
    listProjectionWindows: async (sid) => {
      const response = await fetch(`/femo-plugin/projection-windows?sessionId=${encodeURIComponent(sid)}`);
      if (!response.ok) throw new Error(`projection-windows HTTP ${response.status}`);
      const data = await response.json();
      if (data.ok !== true) throw new Error(data.error ?? "projection-windows failed");
      return { god: data.god, stage: data.stage, actors: data.actors ?? {} };
    }
  });
  slots.inject("conversation.chat.node", () => slots.register(
    {
      name: "conversation.chat.node",
      key: "femo-role",
      // locale 席位（2026-08-25 崩溃修复）：不声明则 t 不注入，组件内
      // t('copy') 直接 TypeError → SlotErrorBoundary 吞掉全部 femo 节点
      // （流式锚点也随之消失=「说完才上屏」的真凶）。
      locale: "conversation"
    },
    FemoChatNodeView
  ));
  if (proj2) {
    slots.inject("conversation.chat.node", () => slots.register(
      {
        name: "conversation.chat.node",
        key: "femo2-turn",
        locale: "conversation"
      },
      Femo2TurnNodeView
    ));
    slots.inject("conversation.chat.node", () => slots.register(
      {
        name: "conversation.chat.node",
        key: "femo2-turn-live",
        locale: "conversation"
      },
      Femo2TurnLiveNodeView
    ));
  }
  slots.inject("conversation.session.header.actions", () => slots.register(
    {
      name: "conversation.session.header.actions",
      id: "femo-plugin-view",
      order: -20,
      inject: viewInjected
    },
    FemoViewButton
  ));
  const registerCountSeat = () => {
    slots.inject("conversation.session.header.actions", () => slots.register(
      {
        name: "conversation.session.header.actions",
        id: "femo-plugin-count",
        order: 10,
        locale: "subagent",
        inject: () => ({
          openChild: (address) => {
            sessions?.openSubagent?.(address);
          },
          refresh: (parentSessionId) => {
            sessions?.refreshSubagents?.(parentSessionId);
          },
          setCatalogOpen: (parentSessionId, open) => {
            sessions?.setSubagentCatalogOpen?.(parentSessionId, open);
          }
        })
      },
      FemoSubagentCount
    ));
  };
  const registerLineageFork = () => {
    slots.inject("conversation.session.header.lineage", () => slots.register(
      {
        name: "conversation.session.header.lineage",
        priority: -10,
        locale: "subagent",
        inject: () => ({
          openChild: (address) => {
            sessions?.openSubagent?.(address);
          },
          refresh: (parentSessionId) => {
            sessions?.refreshSubagents?.(parentSessionId);
          },
          setCatalogOpen: (parentSessionId, open) => {
            sessions?.setSubagentCatalogOpen?.(parentSessionId, open);
          }
        })
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      SubagentHeaderLineage
    ));
  };
  function registerLegacyCatalogUi() {
    registerCountSeat();
    registerLineageFork();
    console.log("[femo-plugin] client legacy mode: femo subagent catalog UI registered (count seat + lineage fork)");
  }
  const registerNativeCatalogFilter = () => {
    slots.inject("conversation.session.header.lineage", () => slots.register(
      {
        name: "conversation.session.header.lineage",
        priority: -10,
        locale: "subagent",
        inject: () => ({
          openChild: (address) => {
            sessions?.openSubagent?.(address);
          },
          refresh: (parentSessionId) => {
            sessions?.refreshSubagents?.(parentSessionId);
          },
          setCatalogOpen: (parentSessionId, open) => {
            sessions?.setSubagentCatalogOpen?.(parentSessionId, open);
          }
        })
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      SubagentHeaderLineage2
    ));
    console.log("[femo-plugin] client native mode: job-scoped subagent catalog filter registered (lineage slot shadow)");
  };
  const scriptViewInjected = () => ({
    listScripts: injected().listScripts,
    readScript: async (path) => {
      const response = await fetch(`/femo-plugin/script?path=${encodeURIComponent(path)}`);
      if (!response.ok) throw new Error(`script HTTP ${response.status}`);
      const data = await response.json();
      if (data.ok !== true || data.content === void 0) {
        throw new Error(data.error ?? "read script failed");
      }
      return data.content;
    },
    saveScript: injected().saveScript,
    // The script panel plays on the CURRENT session (it is a per-session view).
    runScript: async (sid, scriptPath) => {
      const body = { sessionId: sid };
      if (scriptPath !== void 0) body.scriptPath = scriptPath;
      const response = await fetch("/femo-plugin/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      let message = `run HTTP ${response.status}`;
      try {
        const data = await response.json();
        if (data.ok === true) return;
        message = data.error ?? message;
      } catch {
      }
      throw new Error(message);
    },
    pauseScript: async (sid, jobId) => {
      const qs = new URLSearchParams({ sessionId: sid });
      if (jobId !== void 0) qs.set("jobId", String(jobId));
      const response = await fetch(`/femo-plugin/pause?${qs.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      });
      let message = `pause HTTP ${response.status}`;
      try {
        const data = await response.json();
        if (data.ok === true) return { paused: data.paused, state: data.state };
        message = data.error ?? message;
      } catch {
      }
      throw new Error(message);
    },
    fetchErrors: async (sid) => {
      const response = await fetch(`/femo-plugin/errors?sessionId=${encodeURIComponent(sid)}`);
      if (!response.ok) throw new Error(`errors HTTP ${response.status}`);
      const data = await response.json();
      if (data.ok !== true || data.errors === void 0) {
        throw new Error(data.error ?? "fetch errors failed");
      }
      return data.errors;
    },
    toggleSidebar: () => ctx.layout.toggleSidebar()
  });
  slots.inject("conversation.view", () => slots.register(
    {
      name: "conversation.view",
      id: "femo",
      order: 20,
      label: () => "FEMO",
      inject: scriptViewInjected
    },
    FemoEditorView
  ));
  mountFemoEditorPage(scriptViewInjected);
  const composerInjected = () => ({
    getSessionFace: (sid) => {
      try {
        const binding = sessions?.binding?.(sid);
        return binding?.session;
      } catch {
        return void 0;
      }
    }
  });
  slots.inject("conversation.composer", () => slots.register(
    {
      name: "conversation.composer",
      priority: -20,
      select: (owner) => {
        const sid = owner.session?.sessionId;
        if (typeof sid === "string" && sid.startsWith("femo-proj-")) return { isProjection: true };
        return null;
      },
      inject: composerInjected
    },
    ProjectionComposer
  ));
}
    return module.exports;
  }
});
//# sourceMappingURL=client.js.map
