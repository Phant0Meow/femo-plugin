/**
 * hub-client.mjs 的类型声明（dsh host typecheck/IDE 用；运行时语义见 .mjs 文件头）。
 */

export declare function hubJsonPath(femoRoot?: string): string

export declare function readHubInfo(femoRoot?: string): { port: number; host?: string } | undefined

export declare function resolveHubPort(femoRoot?: string): number

export declare function hubBaseUrl(femoRoot?: string): string
