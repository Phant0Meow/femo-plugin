/**
 * file-dialogs.mjs — 弹系统文件对话框选 .femo 文件（Windows PowerShell + WinForms）。
 *
 * 2026-09-30 自 dshAdapter/host/routes/dialogs.ts 上移公共层：桌面端「选路径」
 * 的引擎归 femoGen 自有（web 宿主本地服务同吃，dsh 原文件改转发壳）——同一份
 * 娇贵逻辑不允许两处活着漂移。dsh 本体 directoryPicker seam 只有目录选择（native
 * 后端写死 FOS_PICKFOLDERS，无文件选择变体），所以用 powershell WinForms 自包含
 * 实现（零新依赖、不碰任何宿主本体）。open（导入选已有）/save（导出取保存路径）
 * 两模式，dsh 侧曾各写一套 ~100 行逐字同构的 spawn，本函数即那次合并的唯一实现：
 *   · 对话框置顶双保险（2026-10-03 翻新）：后台进程弹框拿不到前台激活权，
 *     对话框落正常 Z 带、被正前台窗口（浏览器）盖住。旧法「从不 Show 的
 *     TopMost 隐形 owner」救不了它——owner 不真 Show 就不是一扇真置顶窗，
 *     外部实测对话框扩展样式里根本没有 WS_EX_TOPMOST。两条腿：
 *       ① owner 实弹成窗——1×1 透明、屏幕外(-32000,-32000)、不占任务栏地
 *          真 Show 出来，站进置顶带，owned 对话框压它之上；
 *       ② Timer 每 300ms 对对话框本窗补一发 SetWindowPos(HWND_TOPMOST)
 *          +NOACTIVATE|NOMOVE|NOSIZE——改 Z 序不需要前台权限，对后台进程恒通；
 *          窗口按 owner 归属枚举定位（GW_OWNER），不按标题——dsh 允许叠窗，
 *          同名标题多开时按标题找会让各家的定时器互相钉错窗；对话框还没
 *          弹出来时枚举落空即跳过。
 *   · PS 脚本 ASCII-only（PS5.1 无 BOM 按 ANSI 读的教训）——标题/缺省名/起始
 *     目录一律 base64 进脚本、PS 内 UTF-8 解出（上移时补强：此前缺省名内插，
 *     中文项目名会让脚本破戒变乱码）；所选路径经 UTF-8 OutputEncoding 写
 *     stdout（用户目录可能含中文）；
 *   · 约定：退出码 0=已选（stdout=路径）；2=用户取消；1/其他=出错；
 *   · 10 分钟无裁决杀掉对话框（用户可能中途走开，防请求僵尸悬挂）。
 *
 * 并发闸不在本件：弹窗要不要排队/拒绝是调用方的 UI 裁决（web 单飞 409、dsh
 * 放行叠窗各随其主），引擎只管一次忠实的弹框。
 */

const DIALOG_TIMEOUT_MS = 600_000

/** 字符串进 ASCII-only PS 脚本的唯一通道：base64（UTF-8）后脚本内解出。 */
function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64')
}

/** Win32 助手：C# 全文走 base64 进脚本（ASCII-only 纪律 + 单行 PS 塞不下
 *  here-string）。FindOwned 按「owner 名下可见窗」定位对话框——不按标题找：
 *  dsh 允许叠窗，同名标题的多开对话框会让按标题的定时器互相钉错窗。 */
function dialogPinCs() {
  const cs = [
    'using System; using System.Runtime.InteropServices; using System.Text;',
    'public class FDZ {',
    '  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);',
    '  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint c);',
    '  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);',
    '  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);',
    '  delegate bool EnumProc(IntPtr h, IntPtr l);',
    '  public static IntPtr FindOwned(IntPtr owner, string cls) {',
    '    IntPtr found = IntPtr.Zero;',
    '    EnumWindows(delegate(IntPtr h, IntPtr l) {',
    '      if (GetWindow(h, 4) == owner && IsWindowVisible(h)) {',
    '        StringBuilder sb = new StringBuilder(64); GetClassName(h, sb, 64);',
    '        if (sb.ToString() == cls) { found = h; return false; }',
    '      }',
    '      return true;',
    '    }, IntPtr.Zero);',
    '    return found;',
    '  }',
    '}',
  ].join('\n')
  return Buffer.from(cs, 'utf8').toString('base64')
}

/**
 * 弹系统文件对话框。
 * @param {object} opts
 * @param {'open'|'save'} opts.mode              open=打开选已有 / save=保存取路径
 * @param {string} opts.title                    对话框标题
 * @param {string} [opts.defaultName]            save 模式的缺省文件名（.femo 补齐在此统一处理）
 * @param {string} [opts.initialDirectory]       对话框打开时所在的目录（web 侧指向 projects/）
 * @returns {Promise<string|null>} 所选绝对路径；null=用户取消；抛错=对话框故障（原话上浮给前端）
 */
export async function pickFemoFileViaDialog(opts) {
  const { spawn } = await import('node:child_process')
  const dialogType = opts.mode === 'open' ? 'OpenFileDialog' : 'SaveFileDialog'
  const defaultNameLine = opts.defaultName !== undefined
    ? `$d.FileName = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(String(opts.defaultName).replace(/\.femo$/i, ''))}')) + '.femo'`
    : undefined
  const initialDirLine = opts.initialDirectory !== undefined
    ? `$d.InitialDirectory = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(opts.initialDirectory)}'))`
    : undefined
  const ps = [
    "$ErrorActionPreference='Stop'",
    '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)',
    'Add-Type -AssemblyName System.Windows.Forms | Out-Null',
    // 置顶兜底要用的 Win32 口（C# 全文 base64 解入；含按 owner 归属枚举对话框）。
    `Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${dialogPinCs()}'))) | Out-Null`,
    // 置顶腿①：owner 实弹成窗——屏幕外 1×1 透明真 Show，站进置顶带当锚。
    '$o = New-Object System.Windows.Forms.Form',
    '$o.TopMost = $true',
    '$o.ShowInTaskbar = $false',
    '$o.Opacity = 0',
    "$o.StartPosition = 'Manual'",
    '$o.Size = New-Object System.Drawing.Size(1, 1)',
    '$o.Location = New-Object System.Drawing.Point(-32000, -32000)',
    '[void]$o.Show()',
    `$d = New-Object System.Windows.Forms.${dialogType}`,
    `$d.Title = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(opts.title)}'))`,
    "$d.Filter = 'FEMO Script (*.femo)|*.femo|All Files (*.*)|*.*'",
    ...(initialDirLine !== undefined ? [initialDirLine] : []),
    ...(defaultNameLine !== undefined ? [defaultNameLine] : []),
    // 置顶腿②：Timer 兜底再钉——后台进程改 Z 序不需要前台权限（SWP_NOACTIVATE
    // 不抢焦点，NOMOVE|NOSIZE 不扰拖窗；0x13=NOSIZE|NOMOVE|NOACTIVATE）。窗口按
    // owner 归属枚举（FindOwned），只钉自己 owner 名下的对话框，叠窗互不串扰。
    '$t = New-Object System.Windows.Forms.Timer',
    '$t.Interval = 300',
    "$t.Add_Tick({ $h = [FDZ]::FindOwned($o.Handle, '#32770'); if ($h -ne [IntPtr]::Zero) { [void][FDZ]::SetWindowPos($h, [IntPtr](-1), 0, 0, 0, 0, 0x13) } })",
    '$t.Start()',
    '$r = $d.ShowDialog($o)',
    '$t.Stop()',
    "if ($r -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) } else { exit 2 }",
  ].join('; ')
  const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true })
  let out = ''
  let err = ''
  child.stdout.on('data', (c) => { out += c.toString('utf8') })
  child.stderr.on('data', (c) => { err += c.toString('utf8') })
  const timer = setTimeout(() => { try { child.kill() } catch { /* already gone */ } }, DIALOG_TIMEOUT_MS)
  const code = await new Promise((resolve) => {
    child.on('close', (c) => { clearTimeout(timer); resolve(c ?? 1) })
    child.on('error', () => { clearTimeout(timer); resolve(-1) })
  })
  const picked = out.trim()
  if (code === 0 && picked.length > 0) return picked
  if (code === 2) return null
  throw new Error(`${opts.mode === 'open' ? 'pick-script' : 'pick-save-path'} failed (exit ${String(code)})${err.trim().length > 0 ? `: ${err.trim().slice(-400)}` : ''}`)
}
