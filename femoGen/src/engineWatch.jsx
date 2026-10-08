// ════════════════════════════════════════
// ═══  engineWatch.jsx — 「引擎此刻」观演视图  ═══
// ════════════════════════════════════════
// 【画布直连引擎·刀2（2026-10-05）】引擎在跑的场与画布编辑稿不是同一份时，
// 画布盖上这层只读观演面：用引擎档案里的剧本原文建图、直播点亮。编辑现场
// （文本/图/脏标记/record）原封不动——观演绝不回写（「不自动回写」红线在
// 观看面的延伸）；观演态内无编辑控件，人类席只显「等待中」与提示、不亮
// 输入框（画布是编辑器不是输入席）。
//
 // 视图登记制（多 job 下拉的铺垫）：一张观演=一条 {id:'job:<N>', graph, meta,
 // mirror}，挂进 FemoWorAuto 的登记表；切换机制只有一套（当前视图 id）。
 // 图与状态分离：graph 只在建视图时解析一次（buildWatchGraph），mirror 随事件
 // 涨（watchMirror.js 纯件）。多 job 时代一场一条自动长出来，下拉菜单=登记表
 // 本身——本刀不画菜单，地基已在。
//
 // 渲染取巧：节点芯片复用画布既有组件（ActionNodeView 系，nodeStates 同形零
 // 翻译）；连线用公共层 computeEdgeGeometry 同一条几何（无选中/流光/平行线，
 // 观演面不需要交互皮）。挂起后亮点留在原地=断点（纪律照旧）。

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { parseFEMO } from './femoParser';
import { parsedToGraph } from './graphBuilder';
import { ActionNodeView, PositionNodeView, SpecialNodeView, ForOutNodeView, ParOutNodeView } from './canvasNodes';
import { getNodeSize, getSmartPorts, computeEdgeGeometry } from './common';

/** 剧本原文 → 观演图（主流程 + 全部模块子图，按 path 键）；解析失败带 error。 */
export function buildWatchGraph(scriptText) {
  try {
    const parsed = parseFEMO(String(scriptText || ''));
    const g = parsedToGraph(parsed, 'mainflow', null);
    const actionMap = new Map((g.libActions || []).map((a) => [a.id, a]));
    const graphs = new Map();
    graphs.set('mainflow', { nodes: g.mainflowNodes || [], edges: g.mainflowEdges || [] });
    for (const mod of g.libModules || []) {
      graphs.set((mod.path || []).join('/'), { nodes: mod.nodes || [], edges: mod.edges || [] });
    }
    return { graphs, actionMap, name: parsed?.meta?.name || '', error: null };
  } catch (e) {
    return { graphs: new Map(), actionMap: new Map(), name: '', error: String(e?.message ?? e) };
  }
}

export const STATUS_TEXT = {
  idle: '空闲', running: '运行中', suspended: '已挂起', finished: '已完成', failed: '失败',
};
export const STATUS_COLOR = {
  idle: 'var(--femo-neutral, #888)', running: 'var(--femo-success, #2e9e5b)',
  suspended: 'var(--femo-warning, #d99a2b)', finished: 'var(--femo-neutral, #888)',
  failed: 'var(--femo-danger, #c44)',
};

/**
 * 视图切换下拉（2026-10-05 用户拍板提前落地——原刀6 菜单）：
 * 「正在编辑（未跑的稿）」+ 各场观演条目，点选切换、显示互斥。
 * views: [{id:'edit'|'job:<N>', label, status?}]；currentId 当前视图。
 */
export function ViewSwitcher({ views, currentId, onSelect, fontSize = 12.5 }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);
  const cur = views.find((v) => v.id === currentId) || views[0];
  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', maxWidth: 420,
          borderRadius: 'var(--femo-radius-sm)', cursor: 'pointer', fontSize, fontWeight: 800,
          fontFamily: 'var(--femo-font-sans)', color: 'var(--femo-text-1)',
          border: `1px solid ${open ? 'var(--femo-primary)' : 'transparent'}`,
          background: open ? 'var(--femo-primary-soft-2, transparent)' : 'transparent',
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}
        title="切换视图：正在编辑的稿 / 引擎在跑的场"
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur ? cur.label : ''}</span>
        <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0 }}>▼</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60, minWidth: 260,
            background: 'var(--femo-modal-bg, #fff)', border: '1px solid var(--femo-border-strong, #ccc)',
            borderRadius: 'var(--femo-radius-md, 8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: 4, maxHeight: 320, overflowY: 'auto',
          }}
        >
          {views.map((v) => {
            const active = v.id === currentId;
            return (
              <button
                key={v.id}
                onClick={() => { setOpen(false); if (!active) onSelect?.(v.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
                  border: 'none', borderRadius: 'var(--femo-radius-sm, 6px)', cursor: 'pointer',
                  background: active ? 'var(--femo-primary-soft-2, rgba(0,0,0,0.04))' : 'transparent',
                  color: 'var(--femo-text-1)', fontSize: 12, fontWeight: active ? 800 : 500,
                  fontFamily: 'var(--femo-font-sans)', textAlign: 'left', whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: v.status ? (STATUS_COLOR[v.status] || STATUS_COLOR.idle) : 'var(--femo-text-3, #888)' }}
                  title={v.status ? (STATUS_TEXT[v.status] || v.status) : '编辑视图'}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{v.label}</span>
                {v.status && (
                  <span style={{ fontSize: 10.5, color: STATUS_COLOR[v.status] || STATUS_COLOR.idle, flexShrink: 0 }}>
                    {STATUS_TEXT[v.status] || v.status}
                  </span>
                )}
                {active && <span style={{ fontSize: 10, color: 'var(--femo-primary)', flexShrink: 0 }}>当前</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 观演视图（只读）。
 * @param {object} props
 * @param {number} props.jobId            观演的场次号
 * @param {object} props.meta             {scriptName, hostRefs}
 * @param {object} props.graph            buildWatchGraph 产物
 * @param {object} props.mirror           watchMirror 状态
 * @param {string} props.transport        '直连'|'转发'|'离线'
 * @param {boolean} props.fixed           true=fixed 全屏（手机端），false=absolute 盖 CENTER（桌面）
 * @param {() => void} props.onExit       回编辑视图
 * @param {() => void} [props.onToggleDebug]
 * @param {Array} [props.views]           视图清单（ViewSwitcher；不传=显示静态标题）
 * @param {string} [props.currentId]      当前视图 id
 * @param {(id: string) => void} [props.onSwitch]  视图切换回调
 * @param {string} [props.theme]          主题名（portal 到 body 时补主题锚——CSS 变量靠它解析）
 * @param {boolean} [props.embedded]      原位模式（2026-10-08 用户拍板「header 别变，
 *                                        只改画布内容」）：不带自己的观演头
 *                                        （场号/状态/切换由宿主的观演切换条交代）、
 *                                        position 改 relative 铺满父容器（父容器
 *                                        已在画布格内占位）——手机端 fixed/portal
 *                                        老路不受影响（不传 embedded 照旧）。 */
export function WatchView({ jobId, meta, graph, mirror, transport, fixed, onExit, onToggleDebug, views, currentId, onSwitch, theme, embedded }) {
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const dragRef = useRef(null);

  const flowKey = (mirror.flowPath || ['mainflow']).join('/');
  const cur = graph.graphs.get(flowKey) || graph.graphs.get('mainflow') || { nodes: [], edges: [] };

  const nm = useMemo(() => new Map(cur.nodes.map((n) => [n.id, n])), [cur]);
  const nodeStates = mirror.nodeStates || {};
  const activeLabels = useMemo(() => new Set(mirror.activeLabels || []), [mirror.activeLabels]);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [pan]);
  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
  }, []);
  const endDrag = useCallback(() => { dragRef.current = null; }, []);

  // 换流回原点（进模块子画布/回主流程时别沿用上一张图的平移）
  useEffect(() => { setPan({ x: 40, y: 30 }); }, [flowKey]);

  const shell = embedded
    ? { position: 'absolute', inset: 0 }   // 原位模式：铺满父容器（画布格，已 relative 定位）
    : fixed
      ? { position: 'fixed', inset: 0, zIndex: 3000 }   // portal 到 body 的顶层（手机端；z 压过一切宿主/embedding 皮）
      : { position: 'absolute', inset: 0, zIndex: 40 };

  return (
    <div
      data-femo-theme={theme}
      style={{ ...shell, background: 'var(--femo-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* ── 观演头：场号/剧本/状态/通路 + 回编辑（embedded 模式整条不带——
          2026-10-08 拍板：header 归宿主，本组件只画画布本体） ── */}
      {!embedded && (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', flexShrink: 0,
          borderBottom: '1px solid var(--femo-border)',
          background: 'var(--femo-panel-bg)',
        }}
      >
        <span
          style={{ width: 9, height: 9, borderRadius: 99, flexShrink: 0, background: STATUS_COLOR[mirror.status] || STATUS_COLOR.idle }}
          title={`观演状态：${STATUS_TEXT[mirror.status] || mirror.status}`}
        />
        {views && views.length > 0 ? (
          <ViewSwitcher views={views} currentId={currentId} onSelect={onSwitch} />
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--femo-text-1)' }}>
            正在观看 Job {jobId}
            {meta?.scriptName ? ` · ${meta.scriptName}` : ''}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[mirror.status] || STATUS_COLOR.idle }}>
          {STATUS_TEXT[mirror.status] || mirror.status}
        </span>
        {meta?.hostRefs && Object.keys(meta.hostRefs).length > 0 && (
          <span style={{ fontSize: 10.5, color: 'var(--femo-text-3)' }}>
            班底：{Object.entries(meta.hostRefs).map(([h, s]) => `${h}:${String(s).slice(0, 10)}`).join(' · ')}
          </span>
        )}
        <span style={{ fontSize: 10.5, color: 'var(--femo-text-3)', opacity: 0.8 }}>
          引擎{transport}
        </span>
        <span style={{ flex: 1 }} />
        {onToggleDebug && (
          <button
            onClick={onToggleDebug}
            style={{ padding: '4px 12px', borderRadius: 'var(--femo-radius-sm)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--femo-border-strong)', background: 'var(--femo-surface)', color: 'var(--femo-text-2)' }}
          >调试窗</button>
        )}
        <button
          onClick={onExit}
          style={{ padding: '4px 12px', borderRadius: 'var(--femo-radius-sm)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--femo-primary)', background: 'var(--femo-primary-soft-2)', color: 'var(--femo-primary)' }}
        >回到编辑</button>
      </div>
      )}

      {/* ── 知情条：等待人类（只显示不输入）/ 最新通知 / 报错 ── */}
      {(mirror.humanWaiting || mirror.lastNotice || mirror.lastError) && (
        <div style={{ padding: '6px 14px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid var(--femo-border)', background: 'var(--femo-bg-2)' }}>
          {mirror.humanWaiting && (
            <div style={{ fontSize: 11.5, color: 'var(--femo-warning-strong, #a2701c)' }}>
              ⏳ 【{mirror.humanWaiting.label}】等待人类输入
              {mirror.humanWaiting.showprompt ? ` · ${mirror.humanWaiting.showprompt}` : ''}
              {mirror.humanWaiting.prompt ? ` · ${mirror.humanWaiting.prompt}` : ''}
              （观看态不提供输入席）
            </div>
          )}
          {mirror.lastError && (
            <div style={{ fontSize: 11.5, color: 'var(--femo-danger)' }}>✕ {mirror.lastError}</div>
          )}
          {mirror.lastNotice && !mirror.lastError && (
            <div style={{ fontSize: 11, color: mirror.lastNotice.level === 'error' ? 'var(--femo-danger)' : 'var(--femo-text-3)' }}>
              {mirror.lastNotice.level === 'error' ? '✕' : 'ℹ️'} {mirror.lastNotice.text}
            </div>
          )}
        </div>
      )}

      {/* ── 画布：只读图 + 直播点亮（拖空白处平移） ── */}
      <div
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: dragRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              <marker id="wv-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--femo-edge-flow)" />
              </marker>
            </defs>
            {cur.edges.map((e) => {
              const s = nm.get(e.src);
              const t = nm.get(e.tgt);
              if (!s || !t) return null;
              if (e.src === e.tgt) {
                const ss = getNodeSize(s);
                const cx = s.x + ss.w / 2, cy = s.y + ss.h / 2;
                const d = `M${s.x + ss.w},${cy} C${cx + ss.w * 0.8},${s.y - ss.h * 0.4} ${cx + ss.w * 0.8},${s.y - ss.h * 0.4} ${cx},${s.y}`;
                return <path key={e.id} d={d} fill="none" stroke="var(--femo-edge)" strokeDasharray="5,3" markerEnd="url(#wv-arrow)" />;
              }
              const geo = computeEdgeGeometry(e, s, t, { isCycleEdge: false, isParEdge: false });
              if (!geo) return null;
              return (
                <g key={e.id}>
                  {geo.pathDs.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="var(--femo-edge-flow)" markerEnd="url(#wv-arrow)" />
                  ))}
                </g>
              );
            })}
          </svg>
          {cur.nodes.map((n) => {
            const enriched = n.type === 'action' ? { ...n, action: graph.actionMap.get(n.actionId) } : n;
            const st = nodeStates[n.label];
            const active = activeLabels.has(n.label);
            if (enriched.type === 'special') return <SpecialNodeView key={enriched.id} node={enriched} isActive={active} />;
            if (enriched.type === 'for_out') return <ForOutNodeView key={enriched.id} node={enriched} forSpecialType="FOR" />;
            if (enriched.type === 'par_out') return <ParOutNodeView key={enriched.id} node={enriched} />;
            if (enriched.type === 'position') return <PositionNodeView key={enriched.id} node={enriched} />;
            return (
              <ActionNodeView
                key={enriched.id}
                node={enriched}
                nodeState={st}
                isActive={active}
                errorNodeIds={new Set()}
              />
            );
          })}
        </div>
        {graph.error && (
          <div style={{ position: 'absolute', left: 14, bottom: 12, fontSize: 11, color: 'var(--femo-danger)' }}>
            观演图解析失败：{graph.error}
          </div>
        )}
      </div>
    </div>
  );
}
