// ═══════════════════════════════════════════════════════════
// ═══ femoDirBrowse.jsx ─── 工程目录浮层（projects/ 浏览）  ═══
// ═══════════════════════════════════════════════════════════
//
// 2026-09-30：独立模式补齐「选路径」的手机端一腿（用户点名要的浮层——手机经
// tailscale 连过来，系统文件对话框开在电脑屏幕上够不着；桌面端走服务端系统
// 对话框，见 webAdapter/server/canvas.mjs 的 pick-* 路由，两端汇同一套服务端
// 核心：账本、当前 path 槽、落盘路由）。
//
// 只看 user_data/projects/ 以下（服务端有围栏，越界路径一律拒绝）——projects/
// 本来就是剧本文件的建议存放处（femoGen/AGENTS.md §六），浮层不装成资源管理器。
//
// 两种模式：
//   save — 导出·首存/另存为：浏览目录 + 行内新建文件夹 + 底排起名保存；
//          点文件行把名字填进输入框（覆盖前服务端有「未改动」三态与系统框
//          OverwritePrompt 同款语义，浮层只管把「存到哪、叫什么」收集齐）。
//   open — 导入·浏览：点文件行直接打开（读盘 → 入账本 → 记当前 path 槽）。
//
// 版面与交互骨架照 femoFileList.jsx 抄（fixed 遮罩 + modal-bg 卡片 + ROW_CSS
// 注入 + open-null 模式 + Esc 关闭 + 触摸行高 50）：同一家人要长一张脸。

import React, { useEffect, useState } from 'react';
import { FaFolderOpen, FaFloppyDisk } from './faIcons.jsx';
import { inp, btnP } from './common';

function fmtSize(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// 只挂一次的交互样式（内联 style 写不了 :hover/:active）
const ROW_CSS = `
.femo-dir-row { transition: background 0.12s ease; }
.femo-dir-row:not(:disabled):hover { background: color-mix(in srgb, var(--femo-primary) 6%, transparent); }
.femo-dir-row:not(:disabled):active { background: color-mix(in srgb, var(--femo-primary) 12%, transparent); }
.femo-dir-row:disabled { cursor: not-allowed; }
.femo-up-btn { transition: background 0.12s ease, color 0.12s ease; color: var(--femo-text-3); }
.femo-up-btn:not(:disabled):hover { background: color-mix(in srgb, var(--femo-primary) 10%, transparent); color: var(--femo-text-1); }
`;

/** 行内小图标底座（文件夹/软盘都是实心单色）。 */
const rowIcon = { flexShrink: 0, color: 'var(--femo-text-3)' };

export function FemoDirBrowse({
  open = false,
  /** 'save' = 选位置起名保存；'open' = 点文件直接打开。 */
  mode = 'save',
  /** 当前相对目录（服务端回显的正斜杠相对路径，根=''）。 */
  dir = '',
  dirs = [],
  files = [],
  loading = false,
  error = '',
  /** 请求在途：全表禁用防连点（进目录/新建/保存都走它）。 */
  busy = false,
  /** save 模式的缺省文件名（开层时播种进输入框）。 */
  defaultName = 'flow',
  onEnterDir,   // (name) => void：进入子目录
  onUpDir,      // () => void：上一级（根目录时调用方不触发）
  onCreateFolder, // (name) => void：行内新建文件夹
  onOpenFile,   // (name) => void：open 模式点文件
  onSave,       // (name) => void：save 模式按保存（.femo 后缀由服务端补齐）
  onClose,
}) {
  const [fileName, setFileName] = useState(defaultName);
  const [creating, setCreating] = useState(false); // 新建文件夹的行内输入态
  const [folderName, setFolderName] = useState('');

  // 开层播种：缺省文件名跟上、新建输入复位
  useEffect(() => {
    if (open) { setFileName(defaultName); setCreating(false); setFolderName(''); }
  }, [open, defaultName]);

  // Esc 关闭：键盘党顺手（移动端无键盘，不影响）
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isSave = mode === 'save';

  const submitSave = () => {
    const n = fileName.trim();
    if (n.length === 0 || busy) return;
    onSave?.(n);
  };
  const submitFolder = () => {
    const n = folderName.trim();
    if (n.length === 0 || busy) return;
    onCreateFolder?.(n);
    setCreating(false);
    setFolderName('');
  };

  const title = isSave ? '保存到工程目录' : '打开工程目录里的文件';
  const subtitle = `user_data / projects${dir ? ` / ${dir.split('/').join(' / ')}` : ''}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--femo-mask-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999, // 与 ActionModal/FemoFileList 同级：盖住移动端布局（900）与运行守卫（1000）
        backdropFilter: 'blur(2px)',
        padding: 16,
      }}
    >
      <style>{ROW_CSS}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--femo-modal-bg)',
          borderRadius: 'var(--femo-radius-xl)',
          width: 540,
          maxWidth: '100%',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 32px 80px var(--femo-shadow-lg)',
          fontFamily: 'var(--femo-font-sans)',
          overflow: 'hidden',
        }}
      >
        {/* ── 头排：标题 + 上一级 + 新建文件夹 + 关 ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '13px 16px',
            borderBottom: 'var(--femo-border-w) solid var(--femo-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--femo-text-1)', letterSpacing: '0.01em' }}>
              {title}
            </div>
            <div style={{
              fontSize: 11, color: 'var(--femo-text-4)', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {subtitle}
            </div>
          </div>
          {dir !== '' && (
            <button
              className="femo-up-btn"
              onClick={() => { if (!busy) onUpDir?.(); }}
              disabled={busy}
              title="返回上一级"
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--femo-radius-md)',
                background: 'none',
                border: 'none',
                cursor: busy ? 'wait' : 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--femo-font-sans)',
                flexShrink: 0,
              }}
            >
              ↑ 上一级
            </button>
          )}
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              disabled={busy}
              title="在这个目录里新建文件夹"
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--femo-radius-md)',
                background: 'var(--femo-surface)',
                color: 'var(--femo-text-2)',
                border: 'var(--femo-border-w-strong) solid var(--femo-border-strong)',
                cursor: busy ? 'wait' : 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--femo-font-sans)',
                opacity: busy ? 0.55 : 1,
                flexShrink: 0,
              }}
            >
              + 文件夹
            </button>
          ) : (
            <button
              onClick={() => { setCreating(false); setFolderName(''); }}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--femo-radius-md)',
                background: 'var(--femo-surface)',
                color: 'var(--femo-text-2)',
                border: 'var(--femo-border-w-strong) solid var(--femo-border-strong)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--femo-font-sans)',
                flexShrink: 0,
              }}
            >
              取消
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--femo-text-4)',
              fontSize: 20,
              lineHeight: 1,
              padding: '2px 4px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* ── 新建文件夹的行内输入（点「+ 文件夹」展开）── */}
        {creating && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderBottom: 'var(--femo-border-w) solid var(--femo-border)',
              flexShrink: 0,
            }}
          >
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitFolder(); }}
              autoFocus
              placeholder="新文件夹的名称"
              maxLength={80}
              style={{ ...inp, flex: 1, minWidth: 0 }}
            />
            <button onClick={submitFolder} disabled={busy || folderName.trim().length === 0} style={{ ...btnP, flexShrink: 0, opacity: busy || folderName.trim().length === 0 ? 0.55 : 1 }}>
              创建
            </button>
          </div>
        )}

        {/* ── 目录清单 ── */}
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          {loading && (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--femo-text-4)' }}>
              读取目录…
            </div>
          )}

          {!loading && error !== '' && (
            <div
              style={{
                padding: '10px 16px',
                fontSize: 12,
                color: 'var(--femo-danger)',
                lineHeight: 1.6,
                background: 'color-mix(in srgb, var(--femo-danger) 8%, transparent)',
                borderBottom: 'var(--femo-border-w) solid var(--femo-border)',
                wordBreak: 'break-all',
              }}
            >
              {error}
            </div>
          )}

          {!loading && error === '' && dirs.length === 0 && files.length === 0 && (
            <div style={{ padding: '30px 20px', textAlign: 'center', fontSize: 12.5, color: 'var(--femo-text-4)', lineHeight: 1.8 }}>
              这个文件夹还空着。
              {isSave
                ? <>直接在下面起个名字保存，或点右上角<b style={{ color: 'var(--femo-text-2)' }}>「+ 文件夹」</b>先归个类。</>
                : '先在别处保存一个 .femo 进来，或换个文件夹看看。'}
            </div>
          )}

          {!loading && dirs.map((d) => (
            <button
              key={`d/${d}`}
              className="femo-dir-row"
              onClick={() => { if (!busy) onEnterDir?.(d); }}
              disabled={busy}
              title={`进入 ${d}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                minHeight: 50, // 触摸尺寸：手机上这一行要按得准
                background: 'none',
                border: 'none',
                borderBottom: 'var(--femo-border-w) solid var(--femo-border)',
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'var(--femo-font-sans)',
              }}
            >
              <FaFolderOpen size={16} style={rowIcon} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--femo-text-1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--femo-text-4)', flexShrink: 0 }}>文件夹</span>
            </button>
          ))}

          {!loading && files.map((f) => (
            <button
              key={`f/${f.name}`}
              className="femo-dir-row"
              onClick={() => {
                if (busy) return;
                if (isSave) setFileName(f.name); // save 模式：点文件 = 把名字填进输入框
                else onOpenFile?.(f.name);
              }}
              disabled={busy}
              title={isSave ? '点按把文件名填进下面（保存会覆盖它）' : `打开 ${f.name}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                minHeight: 50,
                background: 'none',
                border: 'none',
                borderBottom: 'var(--femo-border-w) solid var(--femo-border)',
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'var(--femo-font-sans)',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--femo-text-1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.name}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--femo-text-4)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {fmtSize(f.size)}
              </span>
            </button>
          ))}
        </div>

        {/* ── 底排：save 模式 = 起名保存；open 模式 = 计数 ── */}
        {isSave ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 16px',
              borderTop: 'var(--femo-border-w) solid var(--femo-border)',
              flexShrink: 0,
            }}
          >
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSave(); }}
              placeholder="文件名"
              maxLength={80}
              style={{ ...inp, flex: 1, minWidth: 0 }}
            />
            <span style={{ fontSize: 10.5, color: 'var(--femo-text-4)', flexShrink: 0 }}>存为 .femo</span>
            <button onClick={submitSave} disabled={busy || fileName.trim().length === 0} title="保存到当前目录" style={{ ...btnP, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: busy || fileName.trim().length === 0 ? 0.55 : 1 }}>
              <FaFloppyDisk size={13} />
              保存
            </button>
          </div>
        ) : (
          (dirs.length > 0 || files.length > 0) && (
            <div
              style={{
                padding: '7px 16px',
                borderTop: 'var(--femo-border-w) solid var(--femo-border)',
                fontSize: 10.5,
                color: 'var(--femo-text-4)',
                flexShrink: 0,
              }}
            >
              {dirs.length} 个文件夹 · {files.length} 个 .femo
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default FemoDirBrowse;
