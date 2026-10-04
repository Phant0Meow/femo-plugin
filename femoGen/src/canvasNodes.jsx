// ═══════════════════════════════════════════════════════════════
// ═══ canvasNodes.jsx ═══
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { PortCircle, TYPES, SPECIAL_COLORS, NW, NH, MW, MH, PSW, PSH, ti, SINK_ONLY, getNodeSize } from './common'; // 已注释死导入（观察期 2026-09-26）：SPW, SPH（未使用）


function ActionNodeView({
  node,
  sel,
  onBody,
  onPortDown,
  onPortUp,
  onBodyMouseUp,
  onDbl,
  onBubbleClick,
  onActionPatch,
  nodeState,
  isActive,
  errorNodeIds,
}) {
  const isMod = node.type === 'module';
  const w = isMod ? MW : NW,
    h = isMod ? MH : NH;
  const { c } = isMod
    ? { c: 'var(--femo-tag-bg)', bg: 'var(--femo-bg-2)' }
    : ti(node.action?.executorType);
  // 左上角类型徽章 token key（module 用专组；executorType 不在 TYPES 里时回退 ai，与 ti 回退一致）
  const badgeKey = isMod
    ? 'module'
    : TYPES.some((t) => t.t === node.action?.executorType)
      ? node.action.executorType
      : 'ai';

  // 是否显示气泡：有 nodeState（运行中或已完成）时显示
  //console.log(
  //  `[ActionNodeView] node.id="${node.id}" node.label="${node.label}" node.type="${node.type}" nodeState=`,
  //  nodeState
  //);
  const hasState = !!nodeState?.status;
  const isStreaming = nodeState?.status === 'ai_streaming';
  const isHumanWait = nodeState?.status === 'human_wait';
  const isDone = ['ai_done', 'human_done', 'done'].includes(nodeState?.status);

  const ports = {
    top: { x: w / 2, y: 0 },
    bottom: { x: w / 2, y: h },
    left: { x: 0, y: h / 2 },
    right: { x: w, y: h / 2 },
  };

  // 呼吸灯动画样式
  const isErrorExplicit = errorNodeIds?.has(node.id) ?? false;
  const isError = nodeState?.status === 'error' || isErrorExplicit;
  const glowStyle = (isActive || isError)
    ? {
        animation: isError
          ? 'nodeGlowError 1.5s ease-in-out infinite'
          : 'nodeGlow 1.5s ease-in-out infinite',
      }
    : {};

  // ═══ 节点名说明框（2026-09-30）═══
  // 点节点名 = 名字发光 + 节点上方弹出公告(showprompt)/指令(prompt)。
  // 适用 ai/human/mind/notice（有这两类文本的动作）；func/assign/module 无此交互，
  // 名字照旧可拖拽。弹层住节点 div 内（画布坐标，随缩放平移走），上探出视口
  // 被裁是设计内（用户可自行平移画布）。
  const canInfo = !isMod && ['ai', 'human', 'mind', 'notice'].includes(node.action?.executorType);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'showprompt' | 'prompt'
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  const editingRef = useRef(null);
  const nameRef = useRef(null);
  const popupRef = useRef(null);

  const startEdit = (field) => {
    const v = node.action?.[field] ?? '';
    draftRef.current = v;
    setDraft(v);
    editingRef.current = field;
    setEditing(field);
  };
  const commitEdit = (field) => {
    // 幂等闸：失焦与「点框外关闭」可能先后都到，落一次账就收手
    if (!field || editingRef.current !== field) return;
    editingRef.current = null;
    setEditing(null);
    if ((draftRef.current ?? '') !== (node.action?.[field] ?? '')) {
      onActionPatch?.(node.actionId, { [field]: draftRef.current });
    }
  };
  useEffect(() => {
    if (!infoOpen) return;
    const onDocPointerDown = (e) => {
      const t = e.target;
      if (popupRef.current?.contains(t)) return;              // 框内：不收
      if (nameRef.current?.contains(t)) return;               // 点名字：交给 onClick 反转开关
      if (editingRef.current) commitEdit(editingRef.current); // 编辑中先落账（textarea 来不及走 blur）
      setInfoOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoOpen]);

  // 说明框交互强调色：主题定义了 --femo-info-accent（web 绿）就用主题的；
  // 没定义（DSH 浅/深）回退本节点类型色——主题分流不碰组件代码
  const infoAccent = `var(--femo-info-accent, ${c})`;

  // 说明框内的三件小样式（标签/正文/编辑框）
  const infoLabelStyle = { fontSize: 9.5, fontWeight: 800, color: 'var(--femo-text-3)', letterSpacing: '0.03em', marginBottom: 3 };
  const infoTextStyle = { fontSize: 11, lineHeight: 1.6, color: 'var(--femo-text-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: 'text', minHeight: 14 };
  const infoTextareaStyle = {
    width: '100%', boxSizing: 'border-box', background: 'var(--femo-bg-2)',
    color: 'var(--femo-text-1)', border: `var(--femo-border-w-strong) solid ${infoAccent}`,
    borderRadius: 'var(--femo-radius-sm)', fontSize: 11, lineHeight: 1.6,
    fontFamily: 'var(--femo-font-sans)', padding: '4px 6px', resize: 'vertical', outline: 'none',
  };
  const infoTextareaProps = (field) => ({
    autoFocus: true,
    value: draft,
    onChange: (e) => { draftRef.current = e.target.value; setDraft(e.target.value); },
    onBlur: () => commitEdit(field),
    onKeyDown: (e) => {
      // 键盘事件不出编辑框：画布快捷键（Delete 删节点等）不该吃进正文的按键
      e.stopPropagation();
      if (e.key === 'Escape') e.target.blur();
    },
    rows: 3,
    style: infoTextareaStyle,
  });

  return (
<div
      data-node-id={node.id}
      onMouseDown={onBody}
      onMouseUp={onBodyMouseUp}
      onDoubleClick={onDbl}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        background: 'var(--femo-node-bg)',
        borderRadius: 'var(--femo-radius-lg)',
        border: `var(--femo-node-border-w) solid ${sel ? c : 'var(--femo-node-border)'}`,
        boxShadow: sel
          ? `0 0 0 3px color-mix(in srgb, ${c} 13%, transparent), var(--femo-node-shadow-sel)`
          : 'var(--femo-node-shadow-rest)',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        // 说明框开着时抬到选中(20)之上：弹层探进邻节点区域也不能被盖
        zIndex: infoOpen ? 30 : sel ? 20 : 2,
        fontFamily: 'var(--femo-font-sans)',
        ...glowStyle,
      }}
    >
      <div style={{ padding: '10px 12px 9px' }}>
        {/* 行1：类型芯片 + 执行者（执行者名字一般不长，放得下） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, minWidth: 0, minHeight: 15 }}>
          <span
            style={{
              background: `var(--femo-badge-bg-${badgeKey})`,
              color: `var(--femo-badge-fg-${badgeKey})`,
              borderRadius: 'var(--femo-radius-xs)',
              padding: '1px 5px',
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: '0.04em',
              fontFamily: 'var(--femo-font-mono)',
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            {isMod ? 'module' : node.action?.executorType || 'ai'}
          </span>
          {!isMod && node.action?.executorActor ? (
            <span
              style={{
                fontSize: 10,
                color: 'var(--femo-neutral)',
                fontFamily: 'var(--femo-font-mono)',
                marginLeft: 'auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {node.action.executorActor}
            </span>
          ) : null}
        </div>
        {/* 行2：action 名独占整行（节点 label 与 action 名同步，显示 action 名即节点名）。
            ai/human/mind/notice 的名字可点：发光 + 弹出公告/指令说明框；其余类型照旧（名字可抓拽节点） */}
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--femo-text-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isMod
            ? `&${node.modRef || 'Module'}`
            : canInfo
              ? (
                <span
                  ref={nameRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 编辑中经名字收框：先落账再反转，草稿不走失
                    if (infoOpen && editingRef.current) commitEdit(editingRef.current);
                    setInfoOpen((v) => !v);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  title="点击查看/编辑公告与指令"
                  style={{
                    cursor: 'pointer',
                    color: infoOpen ? infoAccent : 'inherit',
                    // 注意 alpha 层必须走 color-mix——`var()99` 拼后缀是非法 CSS，
                    // 整条 text-shadow 会被浏览器静默丢弃（发光从来没亮过）
                    textShadow: infoOpen
                      ? `0 0 5px ${infoAccent}, 0 0 14px color-mix(in srgb, ${infoAccent} 60%, transparent), 0 0 26px color-mix(in srgb, ${infoAccent} 33%, transparent)`
                      : 'none',
                    transition: 'text-shadow 0.15s ease, color 0.15s ease',
                  }}
                >
                  {node.action?.name || '未命名'}
                </span>
              )
              : (node.action?.name || '未命名')}
        </div>
      </div>







      {/* 节点名说明框（2026-09-30）：公告(showprompt)+分割线+指令(prompt)，点正文原地编辑。
          框住节点 div 内=画布坐标随缩放平移；事件全截在框内——不让画布平移/缩放、不让节点拖拽 */}
      {infoOpen && canInfo && (
        <div
          ref={popupRef}
          data-femo-info-popup="1"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 300,
            maxHeight: 300,
            overflowY: 'auto',
            background: 'var(--femo-modal-bg)',
            border: `var(--femo-border-w-strong) solid ${infoAccent}`,
            borderRadius: 'var(--femo-radius-md)',
            boxShadow: '0 8px 28px var(--femo-shadow-lg)',
            padding: '9px 11px',
            zIndex: 60,
            fontFamily: 'var(--femo-font-sans)',
            textAlign: 'left',
            cursor: 'default',
          }}
        >
          <div style={infoLabelStyle}>公告:</div>
          {editing === 'showprompt' ? (
            <textarea {...infoTextareaProps('showprompt')} />
          ) : (
            <div
              onClick={() => startEdit('showprompt')}
              title="点击编辑公告（showprompt）"
              style={infoTextStyle}
            >
              {node.action?.showprompt?.trim()
                ? node.action.showprompt
                : <span style={{ color: 'var(--femo-text-4)' }}>（空 · 点击填写）</span>}
            </div>
          )}
          <div style={{ borderTop: 'var(--femo-border-w) solid var(--femo-border-strong)', margin: '7px 0' }} />
          <div style={infoLabelStyle}>指令：</div>
          {editing === 'prompt' ? (
            <textarea {...infoTextareaProps('prompt')} />
          ) : (
            <div
              onClick={() => startEdit('prompt')}
              title="点击编辑指令（prompt）"
              style={infoTextStyle}
            >
              {node.action?.prompt?.trim()
                ? node.action.prompt
                : <span style={{ color: 'var(--femo-text-4)' }}>（空 · 点击填写）</span>}
            </div>
          )}
        </div>
      )}

      {/* 小气泡 - 有状态时自动显示，运行完不消失（data-bubble-node：手机端触摸仲裁识别用） */}
      {hasState && node.type === 'action' && (
        <div
          data-bubble-node={node.id}
          onClick={(e) => {
            e.stopPropagation();
            onBubbleClick && onBubbleClick(node.id);
          }}
          style={{
            position: 'absolute',
            top: -28,
            right: -8,
            maxWidth: 180,
            minWidth: 32,
            background: isStreaming ? 'var(--femo-primary-soft-2)' : isHumanWait ? 'var(--femo-warning-soft)' : 'var(--femo-success-soft)',
            borderRadius: 'var(--femo-radius-bubble)',
            border: `var(--femo-border-w-strong) solid ${isStreaming ? c : isHumanWait ? 'var(--femo-warning)' : 'var(--femo-success)'}`,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: 5,
            boxShadow: '0 2px 8px var(--femo-shadow-sm)',
            padding: '3px 8px',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
          }}
        >
          {isStreaming ? (
            <span
              style={{
                fontSize: 10,
                color: 'var(--femo-text-1)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 160,
                lineHeight: '14px',
              }}
            >
              {nodeState.streamingText?.slice(-30) || '...'}
              <span style={{ animation: 'blink 0.7s infinite' }}>|</span>
            </span>
          ) : isHumanWait ? (
            <span style={{ fontSize: 10, color: 'var(--femo-warning)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              ⏳ 等待输入
            </span>
          ) : isDone ? (
            <span
              style={{
                fontSize: 10,
                color: 'var(--femo-success-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 160,
              }}
            >
              {typeof nodeState.output === 'string'
                ? nodeState.output.length > 20
                  ? nodeState.output.slice(0, 20) + '...'
                  : nodeState.output
                : '✓ 完成'}
            </span>
          ) : (
            <span style={{ fontSize: 10, color: c, fontWeight: 600 }}>运行中...</span>
          )}
        </div>
      )}









      {/* 4 Ports */}
      {sel && (
        <>
          <PortCircle
            x={ports.top.x}
            y={ports.top.y}
            color={c}
            nodeId={node.id} portDir="top"
            portX={node.x + w/2} portY={node.y}
            onMouseDown={(e) => onPortDown(e, 'top', node.x + w/2, node.y)}
            onMouseUp={(e) => onPortUp(e, 'top', node.x + w/2, node.y)}
          />
          <PortCircle
            x={ports.bottom.x}
            y={ports.bottom.y}
            color={c}
            nodeId={node.id} portDir="bottom"
            portX={node.x + w/2} portY={node.y + h}
            onMouseDown={(e) => onPortDown(e, 'bottom', node.x + w/2, node.y + h)}
            onMouseUp={(e) => onPortUp(e, 'bottom', node.x + w/2, node.y + h)}
          />
          <PortCircle
            x={ports.left.x}
            y={ports.left.y}
            color={c}
            nodeId={node.id} portDir="left"
            portX={node.x} portY={node.y + h/2}
            onMouseDown={(e) => onPortDown(e, 'left', node.x, node.y + h/2)}
            onMouseUp={(e) => onPortUp(e, 'left', node.x, node.y + h/2)}
          />
          <PortCircle
            x={ports.right.x}
            y={ports.right.y}
            color={c}
            nodeId={node.id} portDir="right"
            portX={node.x + w} portY={node.y + h/2}
            onMouseDown={(e) => onPortDown(e, 'right', node.x + w, node.y + h/2)}
            onMouseUp={(e) => onPortUp(e, 'right', node.x + w, node.y + h/2)}
          />
        </>
      )}
    </div>
  );
}


function PositionNodeView({
  node,
  sel,
  onBody,
  onPortDown,
  onPortUp,
  onBodyMouseUp,
}) {
  const w = PSW,
    h = PSH;
  const c = 'var(--femo-text-2)',
    bg = 'var(--femo-bg)';
  const border = sel ? c : 'var(--femo-tag-bg)';

  const ports = {
    top: { x: w / 2, y: 0 },
    bottom: { x: w / 2, y: h },
    left: { x: 0, y: h / 2 },
    right: { x: w, y: h / 2 },
  };

  return (
    <div
      onMouseDown={onBody}
      onMouseUp={onBodyMouseUp}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        background: bg,
        borderRadius: 'var(--femo-radius-xl)',
        border: `var(--femo-border-w-selected) solid ${border}`,
        boxShadow: sel
          ? `0 0 0 3px color-mix(in srgb, ${c} 13%, transparent), var(--femo-node-shadow-sel-sm)`
          : 'var(--femo-node-shadow-rest-sm)',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        zIndex: sel ? 20 : 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--femo-font-mono)',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: c,
          letterSpacing: '0.06em',
        }}
      >
        {node.label.replace(/[\[\]]/g, '')}
      </span>

      {sel && Object.entries(ports).map(([dir, p]) => (
        <PortCircle
          key={dir}
          x={p.x}
          y={p.y}
          color={c}
          nodeId={node.id} portDir={dir}
          portX={node.x + p.x} portY={node.y + p.y}
          onMouseDown={(e) => onPortDown(e, dir, node.x + p.x, node.y + p.y)}
          onMouseUp={(e) => onPortUp(e, dir, node.x + p.x, node.y + p.y)}
        />
      ))}
    </div>
  );
}


function SpecialNodeView({
  node,
  sel,
  onBody,
  onPortDown,
  onPortUp,
  onBodyMouseUp,
  isActive = false,
}) {
  const sc = SPECIAL_COLORS[node.specialType] || SPECIAL_COLORS.START;
  const size = getNodeSize(node);
  const w = size.w,
    h = size.h;
  const border = sc.c; // round21：特殊节点边框常显类型色（未选中细一号，选中加粗+光环）
  // round22：未选中边框与 node-bg 各半混合——灰度对齐金边框档位，色相保留；选中恢复鲜亮原色
  const borderDim = `color-mix(in srgb, ${sc.c} 50%, var(--femo-node-border-mix-base))`;
  const isSink = SINK_ONLY.has(node.specialType);

  const ports = {
    top: { x: w / 2, y: 0 },
    bottom: { x: w / 2, y: h },
    left: { x: 0, y: h / 2 },
    right: { x: w, y: h / 2 },
  };

  return (
    <div
      data-node-id={node.id}
      onMouseDown={onBody}
      onMouseUp={onBodyMouseUp}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        background: sc.bg,
        borderRadius: 'var(--femo-radius-xl)',
        border: sel
          ? `var(--femo-border-w-selected) solid ${border}`
          : `var(--femo-border-w) solid ${borderDim}`,
        boxShadow: isActive
          ? `0 0 12px 4px ${sc.c}66, 0 0 24px 8px ${sc.c}33`
          : sel
            ? `0 0 0 3px color-mix(in srgb, ${sc.c} 13%, transparent), var(--femo-node-shadow-sel-sm)`
            : 'var(--femo-node-shadow-rest-sm)',
        animation: isActive ? 'nodeGlow 1.5s ease-in-out infinite' : 'none',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        zIndex: sel ? 20 : 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--femo-font-mono)',
      }}
    >
      <span
        className="femo-special-label"
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: sc.c,
          letterSpacing: '0.06em',
        }}
      >
        {node.specialType}
      </span>

      {sel && (
        <>
          <PortCircle
            x={ports.top.x} y={ports.top.y} color={sc.c}
            nodeId={node.id} portDir="top"
            portX={node.x + ports.top.x} portY={node.y + ports.top.y}
            onMouseDown={(e) => onPortDown(e, 'top', node.x + ports.top.x, node.y + ports.top.y)}
            onMouseUp={(e) => onPortUp(e, 'top', node.x + ports.top.x, node.y + ports.top.y)}
          />
          <PortCircle
            x={ports.bottom.x} y={ports.bottom.y} color={sc.c}
            nodeId={node.id} portDir="bottom"
            portX={node.x + ports.bottom.x} portY={node.y + ports.bottom.y}
            onMouseDown={(e) => onPortDown(e, 'bottom', node.x + ports.bottom.x, node.y + ports.bottom.y)}
            onMouseUp={(e) => onPortUp(e, 'bottom', node.x + ports.bottom.x, node.y + ports.bottom.y)}
          />
          <PortCircle
            x={ports.left.x} y={ports.left.y} color={sc.c}
            nodeId={node.id} portDir="left"
            portX={node.x + ports.left.x} portY={node.y + ports.left.y}
            onMouseDown={(e) => onPortDown(e, 'left', node.x + ports.left.x, node.y + ports.left.y)}
            onMouseUp={(e) => onPortUp(e, 'left', node.x + ports.left.x, node.y + ports.left.y)}
          />
          <PortCircle
            x={ports.right.x} y={ports.right.y} color={sc.c}
            nodeId={node.id} portDir="right"
            portX={node.x + ports.right.x} portY={node.y + ports.right.y}
            onMouseDown={(e) => onPortDown(e, 'right', node.x + ports.right.x, node.y + ports.right.y)}
            onMouseUp={(e) => onPortUp(e, 'right', node.x + ports.right.x, node.y + ports.right.y)}
          />
        </>
      )}
    </div>
  );
}



function ForOutNodeView({ node, sel, onBodyMouseUp, onBubbleClick, onPortDown, onPortUp, forSpecialType = 'FOR' }) {
  const sc = SPECIAL_COLORS[forSpecialType] || SPECIAL_COLORS.FOR;
  const w = 22, h = 22;
  const centerX = node.x + w / 2;
  const centerY = node.y + h / 2;

  const handleMouseDown = (e) => {
    if (onPortDown) {
      onPortDown(e, 'center', centerX, centerY);
    }
  };

  const handleMouseUp = (e) => {
    if (onPortUp) {
      onPortUp(e, 'center', centerX, centerY);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onBubbleClick && onBubbleClick(node.id);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        borderRadius: 'var(--femo-radius-pill)',
        background: sc.bg,
        border: `${sel ? 2.5 : 1.5}px solid ${sc.c}`,  // 👈 只有选中才变粗
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 800,
        color: sc.c,
        fontFamily: 'var(--femo-font-mono)',
        cursor: sel ? 'grabbing' : 'crosshair',
        userSelect: 'none',
        zIndex: 23,
        boxShadow: sel ? `0 0 0 3px ${sc.c}44, 0 0 12px ${sc.c}55` : 'none',
        transition: 'border-width 0.12s, box-shadow 0.12s',
      }}
    >
      <span>出</span>
    </div>
  );
}


function ParOutNodeView({
  node,
  sel,
  onBody,
  onPortDown,
  onPortUp,
  onBodyMouseUp,
}) {
  const sc = SPECIAL_COLORS['PAR'] || SPECIAL_COLORS.FOR;
  const size = getNodeSize(node);
  const w = size.w, h = size.h;
  const border = sc.c; // round41：补齐 PAR_OUT 彩边（与 START/FOR/PAR 同款常显类型色）

  const rightPort = { x: w, y: h / 2 };

  return (
    <div
      onMouseDown={onBody}
      onMouseUp={onBodyMouseUp}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        background: sc.bg,
        borderRadius: 'var(--femo-radius-xl)',
        border: `var(--femo-border-w) solid ${border}`,
        boxShadow: sel
          ? `0 0 0 3px color-mix(in srgb, ${sc.c} 13%, transparent), var(--femo-node-shadow-sel-sm)`
          : 'var(--femo-node-shadow-rest-sm)',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        zIndex: sel ? 20 : 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--femo-font-mono)',
      }}
    >
      <span
        className="femo-special-label"
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: sc.c,
          letterSpacing: '0.06em',
        }}
      >
        PAR_OUT
      </span>

      {sel && (
        <>
          <PortCircle
            x={w / 2}
            y={0}
            color={sc.c}
            nodeId={node.id} portDir="top"
            portX={node.x + w / 2} portY={node.y}
            onMouseDown={(e) => onPortDown(e, 'top', node.x + w / 2, node.y)}
            onMouseUp={(e) => onPortUp(e, 'top', node.x + w / 2, node.y)}
          />
          <PortCircle
            x={w / 2}
            y={h}
            color={sc.c}
            nodeId={node.id} portDir="bottom"
            portX={node.x + w / 2} portY={node.y + h}
            onMouseDown={(e) => onPortDown(e, 'bottom', node.x + w / 2, node.y + h)}
            onMouseUp={(e) => onPortUp(e, 'bottom', node.x + w / 2, node.y + h)}
          />
          <PortCircle
            x={0}
            y={h / 2}
            color={sc.c}
            nodeId={node.id} portDir="left"
            portX={node.x} portY={node.y + h / 2}
            onMouseDown={(e) => onPortDown(e, 'left', node.x, node.y + h / 2)}
            onMouseUp={(e) => onPortUp(e, 'left', node.x, node.y + h / 2)}
          />
          <PortCircle
            x={w}
            y={h / 2}
            color={sc.c}
            nodeId={node.id} portDir="right"
            portX={node.x + w} portY={node.y + h / 2}
            onMouseDown={(e) => onPortDown(e, 'right', node.x + w, node.y + h / 2)}
            onMouseUp={(e) => onPortUp(e, 'right', node.x + w, node.y + h / 2)}
          />
        </>
      )}
    </div>
  );
}
// ═══ 拖拽吸附对齐线 ═══
// draw = { x1,y1,x2,y2 }：被拖节点中心 → 吸附目标节点中心 的连线（画布坐标）。
// 为什么用 SVG + 反向补偿线宽：画布整体带 scale()，HTML 边框宽会跟着一起缩——
// 手机端 zoom 常在 0.5 上下，1px 边框实际只剩半个像素，屏幕上等于看不见。
// 这里乘 1/zoom 保证屏幕上恒为 ~1.5px；虚线也用 strokeDasharray 按 zoom 折算。
// 不接收指针事件，不干扰拖拽。
function SnapGuides({ guides, scale = 1 }) {
  if (!guides) return null;
  const z = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const w = Math.max(0.8, 1.5 / z);
  const dash = `${4 / z},${3 / z}`;
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 30,
      }}
    >
      <line
        x1={guides.x1}
        y1={guides.y1}
        x2={guides.x2}
        y2={guides.y2}
        stroke="var(--femo-primary)"
        strokeWidth={w}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
      {/* 两端各点一个圆心，明确"这两个中心对齐了" */}
      <circle cx={guides.x1} cy={guides.y1} r={2.5 / z} fill="var(--femo-primary)" />
      <circle cx={guides.x2} cy={guides.y2} r={2.5 / z} fill="var(--femo-primary)" />
    </svg>
  );
}

export { ActionNodeView, PositionNodeView, SpecialNodeView, ForOutNodeView, ParOutNodeView, SnapGuides };
