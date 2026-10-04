/** femoRoot.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。 */

/** 从 startDir 向上（最多 6 级）找第一个含 femo2host/ 的目录；找不到回落 startDir。 */
export declare function resolveFemoRoot(startDir: string): string

/** 数据根 = FEMO_DATA_DIR env，缺省 <引擎根>/user_data（租户边界，2026-09-29 单源）。 */
export declare function dataRootOf(femoRoot: string): string
