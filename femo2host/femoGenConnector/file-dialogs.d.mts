/**
 * file-dialogs.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

export interface PickFemoFileViaDialogOpts {
  /** open=打开选已有 / save=保存取路径。 */
  mode: 'open' | 'save'
  title: string
  /** save 模式的缺省文件名（.femo 补齐在引擎内统一处理）。 */
  defaultName?: string
  /** 对话框打开时所在的目录。 */
  initialDirectory?: string
}

export declare function pickFemoFileViaDialog(opts: PickFemoFileViaDialogOpts): Promise<string | null>
