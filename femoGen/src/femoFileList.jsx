// ═══════════════════════════════════════════════════════════
// ═══ femoFileList.jsx ─── 导入清单（导入的第一级）         ═══
// ═══════════════════════════════════════════════════════════
//
// 2026-09-11：导入拆成两级后的第一级界面。
//
// 为什么要有这一级：原先「导入」直接弹 host 的系统打开文件对话框，隐含前提
// 是操作者坐在宿主屏幕前。手机通过 tailscale 连 dsh 时，对话框开在电脑上，
// 手机端等于没有导入入口。于是先出这份「导入过 / 导出过」的历史清单，
// 从清单里挑一个就能开。
//
// 浏览按钮只给电脑端：onBrowse 传了才渲染。手机端传 undefined——对话框开在
// 电脑屏幕上，手机上按了也够不着，留着只会让人以为按坏了。
//
// 版面（2026-09-11 二版，猫猫：三行太占地方 + 来源列看不懂）：
//   每项两行 —— 上行「文件名 ···· 大小 时间」右对齐成两列，下行灰色路径；
//   来源徽标整列撤掉，位置改放文件大小（倒数第二列，日期在它右边）。
//   撤掉的理由是用户看不懂「导入/导出」——它确实是落账来源的内部概念，
//   对「挑哪个文件打开」这个决策没有帮助（而且历史补录的条目来源本就是猜的）。
//
// 桌面 / 手机共用本组件（手机端由 FemoWorAuto 的移动分支挂载），行高按触摸
// 尺寸给足，两侧都不会「点不准」。
//
// 移出清单键（2026-09-13）：每行右侧一枚 ⊖，只把这条记录从清单里划掉，
// 源文件零接触（host 侧 forget-femo-file 只划账本）。图标刻意用 circle-minus
// 而不是垃圾桶——⊖ 读作「从集合里拿掉」，与「删文件」拉开距离；悬停提示
// 再把话说死。onForget 传了才渲染（独立模式没有账本，不给这个键）。

import React, { useEffect } from 'react';
import { FaCircleMinus } from './faIcons.jsx';

/** 相对时间（清单右列）。超过 30 天退回绝对日期。 */
function relTime(ts) {
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtSize(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// 只挂一次的交互样式（内联 style 写不了 :hover/:active）
const ROW_CSS = `
.femo-file-row { transition: background 0.12s ease; }
.femo-file-row:not(:disabled):hover { background: color-mix(in srgb, var(--femo-primary) 6%, transparent); }
.femo-file-row:not(:disabled):active { background: color-mix(in srgb, var(--femo-primary) 12%, transparent); }
.femo-file-row:disabled { cursor: not-allowed; }
.femo-forget-btn { transition: background 0.12s ease, color 0.12s ease; color: var(--femo-text-4); }
.femo-forget-btn:not(:disabled):hover { background: color-mix(in srgb, var(--femo-text-4) 14%, transparent); color: var(--femo-text-2); }
.femo-forget-btn:not(:disabled):active { background: color-mix(in srgb, var(--femo-text-4) 22%, transparent); }
.femo-forget-btn:disabled { cursor: not-allowed; opacity: 0.4; }
`;

/** 右列两格（大小 / 时间）共用的对齐口径：定宽右对齐 + 等宽数字，
 *  让每一行的小数点与时间尾巴纵向成列——这是「不整齐」观感的主要来源。 */
const colStyle = {
  flexShrink: 0,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 10.5,
  color: 'var(--femo-text-4)',
};

export function FemoFileList({
  open = false,
  files = [],
  loading = false,
  error = '',
  /** 正在打开的那条路径（行内转圈 + 全表禁用防连点）。 */
  busyPath = null,
  onPick,
  /** 电脑端专属：给了才渲染右上角「浏览…」（走系统文件对话框的旧路径）。 */
  onBrowse,
  /** 从清单移除一条（2026-09-13）：给了才渲染每行右侧的 ⊖ 键。
   *  语义红线：只从清单划掉，**绝不动源文件**——文案与图标都按这个写。 */
  onForget,
  onClose,
}) {
  // Esc 关闭：键盘党顺手（移动端无键盘，不影响）
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const busy = busyPath !== null;
  const canBrowse = typeof onBrowse === 'function';
  const canForget = typeof onForget === 'function';
  const missingCount = files.filter((f) => f.exists === false).length;

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
        zIndex: 9999, // 与 ActionModal 同级：盖住移动端布局（900）和运行守卫（1000）
        backdropFilter: 'blur(2px)',
        padding: 16,
      }}
    >
      <style>{ROW_CSS}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--femo-surface)',
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
        {/* ── 头排：标题 + 浏览（电脑端）+ 关 ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 16px',
            borderBottom: 'var(--femo-border-w) solid var(--femo-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--femo-text-1)', letterSpacing: '0.01em' }}>
              打开 FEMO 剧本
            </div>
            <div style={{ fontSize: 11, color: 'var(--femo-text-4)', marginTop: 2 }}>
              从导入过 / 导出过的文件里挑一个
            </div>
          </div>
          {canBrowse && (
            <button
              onClick={onBrowse}
              disabled={busy}
              title="打开系统文件选择器（在电脑上选文件）"
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
              浏览…
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

        {/* ── 清单 ── */}
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          {loading && (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: 'var(--femo-text-4)' }}>
              读取清单…
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

          {!loading && error === '' && files.length === 0 && (
            <div style={{ padding: '30px 20px', textAlign: 'center', fontSize: 12.5, color: 'var(--femo-text-4)', lineHeight: 1.8 }}>
              还没有记录。
              {canBrowse
                ? <>点右上角<b style={{ color: 'var(--femo-text-2)' }}>「浏览…」</b>选一个 .femo 文件，之后它就会留在这份清单里。</>
                : <>先在电脑端导入或导出一次 .femo，之后这里就能直接选了。</>}
            </div>
          )}

          {!loading && files.map((f, i) => {
            const missing = f.exists === false;
            const isBusy = busyPath === f.path;
            const size = fmtSize(f.size);
            return (
              // 行本体现在只是布局层：可点的拆成两枚真按钮——「打开」（占满）
              // 和「移出清单」（右侧定宽）。此前整行一枚 button，HTML 不允许
              // 按钮嵌按钮，加移除键就必须拆。
              <div
                key={f.path}
                className="femo-file-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '9px 10px 9px 16px',
                  minHeight: 50, // 触摸尺寸：手机上这一行要按得准
                  // 最后一行不画分隔线：贴着底栏那条会形成双线
                  borderBottom: i === files.length - 1
                    ? 'none'
                    : 'var(--femo-border-w) solid var(--femo-border)',
                }}
              >
                {/* 打开：原整行按钮的代言人，两点内容（上行文件名+大小时间，下行路径） */}
                <button
                  onClick={() => { if (!missing && !busy) onPick?.(f.path); }}
                  disabled={missing || busy}
                  title={missing ? `${f.path}\n（文件已不在原位置）` : f.path}
                  style={{
                    display: 'block',
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: missing ? 'not-allowed' : (busy ? 'wait' : 'pointer'),
                    opacity: missing ? 0.5 : 1,
                    fontFamily: 'var(--femo-font-sans)',
                  }}
                >
                  {/* 上行：文件名 ···· 大小 时间（右侧两列定宽对齐） */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--femo-text-1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {f.name}
                    </span>
                    {missing && (
                      <span style={{ ...colStyle, color: 'var(--femo-danger)', fontWeight: 700 }}>
                        文件不在原位置
                      </span>
                    )}
                    <span style={{ ...colStyle, minWidth: 52 }}>{missing ? '—' : size}</span>
                    <span style={{ ...colStyle, minWidth: 62, color: 'var(--femo-text-3)' }}>
                      {isBusy ? '打开中…' : relTime(f.lastUsedAt)}
                    </span>
                  </div>
                  {/* 下行：完整路径（截尾；文件名已在上行，这里的信息量在目录） */}
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--femo-text-4)',
                      marginTop: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.path}
                  </div>
                </button>
                {/* 移出清单：⊖ 只划记录不删文件；缺失条目也能移（清死记录是主用例） */}
                {canForget && (
                  <button
                    className="femo-forget-btn"
                    onClick={() => { if (!busy) onForget?.(f.path); }}
                    disabled={busy}
                    title="从清单移除（只划掉这条记录，文件保留在原位置）"
                    aria-label={`从清单移除 ${f.name}`}
                    style={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--femo-radius-md)',
                      cursor: busy ? 'wait' : 'pointer',
                    }}
                  >
                    <FaCircleMinus size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── 底排：计数 ── */}
        {!loading && files.length > 0 && (
          <div
            style={{
              padding: '7px 16px',
              borderTop: 'var(--femo-border-w) solid var(--femo-border)',
              fontSize: 10.5,
              color: 'var(--femo-text-4)',
              flexShrink: 0,
            }}
          >
            共 {files.length} 个{missingCount > 0 ? `（${missingCount} 个已不在原位置）` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

export default FemoFileList;
