/**
 * femo_gen_api.jsx — FemoGen 编辑器对宿主的唯一公开 API（Facade / 门面）。
 *
 * 2026-09-13 API 化改造（与 femo2host/femo_api.py 同一取向）：宿主接口侧
 * （hostAdapter/dshAdapter/client 等）只准 import 本文件，不再深入
 * femoGen/src 内部——编辑器内部重构（拆文件/改实现）只要保住本文件的导出
 * 与 props 契约，宿主零改动。本文件现居 femo2host/（引擎→宿主边界层）。
 *
 * ── 宿主消费面全清单（2026-09-13 盘点，此外别无）────────────────────────
 *  ① 源码级 import（唯一一条代码耦合）：编辑器应用组件（下方 re-export）。
 *     消费者 = hostAdapter/dshAdapter/client/client-ui/editor-page.tsx——
 *     「Femo 编辑器」单页常驻宿主，把本组件打进聊天窗 bundle（esbuild 从
 *     仓库根解析相对路径，不经过 vite）。
 *  ② dist 文件级约定（不是代码 import——Node 进程解析不了 JSX）：构建产物
 *     目录 femoGen/dist。zcode 网关（hostAdapter/zcodeAdapter/mcp/
 *     femo-server.mjs）存在即静态托管；打包清单（scripts/sync-zcode-dist.ps1）
 *     按字面路径拷贝。改目录名 = 三处同步（vite.config 的 outDir + 上述两处）。
 *  ③ 反向 HTTP 契约（femoGen 前端 → 宿主，方向与本文件相反）：/femo-plugin/*
 *     路由族 + SSE 事件流归 dshAdapter 所有（host/routes.ts），不在本文件
 *     契约内——编辑器前端按 route 名直调，那是宿主暴露给前端的 API。
 *
 * ── 两种运行形态 ────────────────────────────────────────────────────────
 *  - standalone（vite，src/main.jsx）：自带旧世界 fetch 直连，不传 plugin 旗标；
 *  - plugin（宿主嵌入）：必须传 plugin + 全套回调 props（见下方 typedef）——
 *    编辑器不自发网络请求，一切引擎/文件动作经宿主回调（subagent.ts 的
 *    「旧世界 femoGen 自己发 API 请求」历史注脚即此分界）。
 *
 * ⚠️ props 语义的权威实现在 femoGen/src/FemoWorAuto.jsx（组件签名 + 内部消费）；
 * 本 typedef 是插件模式词汇表的门面快照，改签名先改这里再动组件。
 */

export { default, default as FemoEditorApp } from '../femoGen/src/FemoWorAuto'

/**
 * @typedef {Object} FemoEditorPluginProps
 * @property {true} plugin 插件模式旗标（必传 true；缺省 false = standalone 直连形态）。
 * @property {string} sessionId 当前打开的 femo 主会话 id——画布数据面全挂它
 *   （剧本记录/断点/运行态/jobIds；投影窗传母会话 id，见 editor-view 的锚点解析）。
 * @property {boolean} [enginePending=false] 引擎有活跃执行体/待命指示（运行按钮态）。
 * @property {() => void} onRun 点「运行」→ 宿主 job_start（B1：前端纯显示者，
 *   run_request 触发链已退役）。
 * @property {(jobId?: number) => Promise<{paused?: boolean, state?: string} | undefined>} onPause
 *   点「暂停」→ 宿主 job_pause（§8.4 B3 归属解析：宿主只认本会话绑定的 Job）。
 *   paused:false = 该会话无活跃剧本（编辑器据此复位按钮）；失败原样 reject（可见报错）。
 * @property {(text: string) => Promise<void>|void} onPersistScript 画布定稿 →
 *   宿主保存会话剧本记录（{path, text, rev} 乐观锁；409 冲突弹窗由宿主侧装配层处理）。
 * @property {() => {text?: string, path?: string, rev?: number} | undefined} getRecordScript
 *   读当前会话剧本记录（刷新/重启后画布恢复的数据源）。
 * @property {(name: string) => Promise<void>|void} onExport 导出 → 宿主落盘 + 记账
 *   （femo_files.json 账本记 'export'）。
 * @property {() => Promise<void>|void} onImport 导入入口 → 宿主两级导入
 *   （历史清单优先；电脑端另有系统对话框）。
 * @property {() => Promise<Array<{path: string, name: string, source: string, firstSeenAt: number, lastUsedAt: number, exists: boolean, size?: number, mtimeMs?: number}>>} onListFemoFiles
 *   导入/导出历史清单（条目形状与 host 侧 femo-files.ts 的 FemoFileEntry 对齐；
 *   exists=false = 文件已不在盘上，前端变灰）。
 * @property {(path: string) => Promise<void>|void} onPickFemoFile 从清单打开一份剧本
 *   （宿主读盘回文本，导入=引用不拷贝）。
 * @property {(path: string) => Promise<void>|void} onForgetFemoFile 从清单移除条目
 *   （不动盘上文件）。
 * @property {() => void} onBackToShell 手机版返回键 → 打开 dsh 侧边栏。
 * @property {string} [savedPath=''] 当前剧本落盘地址（''/缺省 = 未保存；
 *   宿主据此决定 base_dir 语义与 script_name）。
 * @property {string} [initialScript=''] 会话快照文本（画布初始/恢复内容）。
 * @property {string} [initialCheckpoint=''] 断点节点 id（恢复定位/续跑起点标识）。
 * @property {boolean} [initialRunning=false] 打开时引擎是否在跑（按钮初始态）。
 * @property {number} [initialJobId] 当前 Job 号（暂停/继续按钮跟随；场次回放定位）。
 * @property {number[]} [jobIds] 本会话激活过的全部 Job（按激活顺序；场次回放候选清单）。
 * @property {boolean} [initialWaitingHuman=false] 是否有等待人类输入的节点（横幅/按钮态）。
 * @property {string} [initialLastError=''] 上次错误文本（恢复后横幅重建）。
 * @property {(message: string) => void} onRestoreError 会话快照恢复失败 → 宿主响亮上报
 *   （不许静默吞：画布空了但用户得知道为什么）。
 */

/**
 * 存量说明：组件 forwardRef 但 ref 面已拆空（run_request 触发链退役，
 * §11.4 triggerRunRef/useImperativeHandle 拆除）——宿主不要依赖 ref.current。
 */
