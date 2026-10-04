// ═══════════════════════════════════════════════════════════
// ═══ femoSaveReminder.jsx ─── 「未改动」提醒（导出三态中拍） ═══
// ═══════════════════════════════════════════════════════════
//
// 2026-09-30：独立模式导出三态（与 dsh editor-page 2026-08-30 三态同语义）——
// 有 path 且盘上内容与画布一致时，不闷头写盘，先问一句：依然保存 / 另存为 /
// 返回画布。dsh 的同款住在 editor-page.tsx 的 saveReminder（宿主侧），本件是
// 画布独立模式的对应物；resolve 回 handleToolbarExport 继续。
//
// 桌面 / 手机共用（导出在两端都会走到这一拍），骨架照 FemoFileList 一家人。

import React from 'react';
import { btnP, btnS } from './common';

export function FemoSaveReminder({ reminder, onChoice }) {
  if (!reminder) return null;
  return (
    <div
      onClick={(e) => e.stopPropagation()} // 点遮罩不关：这是一道必答的裁决，别让人误点丢掉保存
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--femo-mask-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999, // 与 ActionModal/FemoFileList/FemoDirBrowse 同级
        backdropFilter: 'blur(2px)',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--femo-modal-bg)',
          borderRadius: 'var(--femo-radius-xl)',
          width: 420,
          maxWidth: '100%',
          padding: '18px 20px',
          boxShadow: '0 32px 80px var(--femo-shadow-lg)',
          fontFamily: 'var(--femo-font-sans)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--femo-text-1)' }}>
          ✓ 内容未改动
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--femo-text-2)',
            lineHeight: 1.7,
            marginTop: 8,
            wordBreak: 'break-all',
          }}
        >
          画布内容与这个文件里的一致：
          <div style={{ color: 'var(--femo-text-3)', fontSize: 11.5, marginTop: 2 }}>{reminder.path}</div>
          还要保存吗？
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={() => onChoice?.('back')} style={btnS}>
            返回画布
          </button>
          <button onClick={() => onChoice?.('saveas')} style={btnS}>
            另存为…
          </button>
          <button onClick={() => onChoice?.('save')} style={btnP}>
            依然保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default FemoSaveReminder;
