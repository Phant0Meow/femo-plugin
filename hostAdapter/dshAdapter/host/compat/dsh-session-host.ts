/**
 * dsh-session-host.ts — @deepseek-ai/dsh-session 宿主实例桥（双版本兼容）。
 *
 * 背景（2026-09-23，0.1.7-alpha.2 / 3083 首战实锤）：本插件 build 一直把
 * dsh-session external，运行时从自带 node_modules 拉私有 rc.2 副本。0.1.7 的
 * 进程内模块解析会把副本对 @deepseek-ai/dsh-llm 的请求劫持到宿主新副本
 * （rc.2 链接期要的 CallId 等导出已被上游挪走）→ SyntaxError → 整个插件
 * "failed to import"，且 0.1.7 启动审计只报一句 failed to import、真因被吞
 * （真因靠 lib/index.js 诊断壳抓到的）。0.1.6 无此劫持，私有副本凑合能用。
 *
 * 正解 = 彻底不加载私有副本：用 windowing-native.ts 的 registerRuntimeWhitelist
 * 同款姿势 createRequire(宿主入口) 直取宿主进程里的那份实例——这正是 build.mjs
 * 注释要求的「与持久化协调器同一实例」语义，SessionId 品牌与宿主 sessions
 * 服务同源，比私有副本更正确。宿主解析不可得时降级为惰性 stub（可选 API
 * 探测得 undefined，与原生构建降级路径同款），绝不因桥失败再次炸掉入口。
 *
 * 值导入面（host/ 全量盘点 2026-09-23）：SessionId（品牌函数）+
 * registerSessionEventType（可选探测，原生构建无此 API）。其余全是 import
 * type（构建期擦除）。新增值导入时在此补一行 re-export，esbuild 对内部
 * 模块缺名导出会直接构建报错，不会静默。
 */
import { createRequire } from 'node:module'

type SessionNS = typeof import('@deepseek-ai/dsh-session')

function loadSessionNamespace(): SessionNS {
  const candidates: Array<() => SessionNS> = []
  if (process.argv[1] !== undefined && process.argv[1].length > 0) {
    candidates.push(() => createRequire(process.argv[1])('@deepseek-ai/dsh-session') as SessionNS)
  }
  // 非常规装载（argv[1] 缺失）兜底：真身副本。0.1.6 可用；0.1.7 进程内会
  // 链接期炸，但 require 的链接错误同步抛出，被本层 catch 吃掉走 stub。
  candidates.push(() => createRequire(import.meta.url)('@deepseek-ai/dsh-session') as SessionNS)
  for (const load of candidates) {
    try {
      return load()
    } catch { /* 下一候选 */ }
  }
  console.warn('[femo-plugin][dsh-session-bridge] host dsh-session unresolvable; degrading to inert stub')
  return new Proxy({}, { get: () => undefined }) as unknown as SessionNS
}

const sessionNS = loadSessionNamespace()

export const SessionId = sessionNS.SessionId
export const registerSessionEventType = sessionNS.registerSessionEventType
