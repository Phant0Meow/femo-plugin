/**
 * check-imports.mjs — 宿主 ts 的「漏 import」体检（build.mjs 每次构建前跑）。
 *
 * 为什么需要它：build.mjs 只做 esbuild 打包、**不做类型检查**（本机没装
 * typescript，npx tsc 不可用）。而 esbuild 对「用了但没 import 的标识符」不报错
 * ——它当全局自由变量原样输出，构建静默通过、**运行期才炸**。
 * 2026-09-19 实锤：subagent-native.ts 用了 actorNameOf 却没 import，产物里那处
 * 引用悬空（esbuild 甚至把同名定义改名成 actorNameOf2 避让），节点一跑就
 * `ReferenceError: actorNameOf is not defined`，整场挂起。
 *
 * 做法：把 host/ 下各文件**互相导出的值名**收集起来，再逐文件检查——凡用到了
 * 兄弟文件导出的名字，本文件必须**自己定义过或 import 过**；否则报错并非 0 退出。
 * 只看值导出（function/const/let/class），跳过 type/interface（构建期擦除、运行期
 * 无影响）；扫描前去掉注释，避免注释里出现名字造成误报。
 *
 * 用法：node check-imports.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const HOST_DIR = fileURLToPath(new URL('./host/', import.meta.url))

/** 去掉行注释与块注释（够用的粗粒度清洗，只为了不把注释里的名字当引用）。 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** 收集一个文件里「导出的值名」「import 进来的名字」「自己定义的名字」。 */
function scan(src) {
  const code = stripComments(src)
  const exported = new Set()
  const imported = new Set()
  const declared = new Set()
  const addAll = (set, re, group = 1) => {
    for (const m of code.matchAll(re)) for (const n of String(m[group]).split(',')) {
      const name = n.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) set.add(name)
    }
  }
  // 导出（只取值导出；type/interface 跳过——构建期就没了，缺 import 不炸运行期）
  addAll(exported, /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)
  addAll(exported, /\bexport\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)
  // import（含别名：`import { a as b }` 取 b；`import X from`；`import * as X`；
  // 以及 type-only：`import type { X }` —— 类型导入也算「认过这个名字」）
  addAll(imported, /\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from/g)
  addAll(imported, /\bimport\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|from)/g)
  addAll(imported, /\bimport\s*\*\s*as\s+([A-Za-z_$][\w$]*)/g)
  // 本文件自己的各种声明（含未导出的）
  addAll(declared, /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)
  addAll(declared, /\b(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)
  addAll(declared, /\b(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)
  return { code, exported, imported, declared }
}

const files = readdirSync(HOST_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
const scanned = new Map()
for (const f of files) scanned.set(f, scan(readFileSync(join(HOST_DIR, f), 'utf8')))

// 兄弟文件导出的值名（同一文件自己的导出不算「需要 import」）
const problems = []
for (const [file, info] of scanned) {
  const siblingExports = new Set()
  for (const [other, o] of scanned) {
    if (other === file) continue
    for (const name of o.exported) siblingExports.add(name)
  }
  for (const name of siblingExports) {
    if (info.imported.has(name) || info.declared.has(name)) continue
    // 只看「被调用」的用法：漏 import 真正会炸的是调用点（ReferenceError）；
    // 类型位置/comments 里的出现无害，这样也天然滤掉 name/path 这类同名局部变量。
    const re = new RegExp(`(^|[^\\w$.])${name}\\s*\\(`, 'm')
    if (re.test(info.code)) {
      problems.push(`${file}: 调用 ${name}()（由兄弟文件导出）却既没 import 也没在本文件定义`)
    }
  }
}

if (problems.length > 0) {
  console.error('[check-imports] ✗ 发现漏 import（esbuild 不会报错，运行期才会炸）：')
  for (const p of problems) console.error('  · ' + p)
  console.error('[check-imports] 修法：在该文件顶部 `import { 名字 } from \'./对应模块\'` 后再构建。')
  process.exit(1)
}
console.log(`[check-imports] ✓ ${files.length} 个宿主 ts 文件，跨文件引用都已 import`)
