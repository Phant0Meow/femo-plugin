/**
 * preset-install.ts — 把随插件打包的 FEMO preset 供给两代 dsh 预设机制。
 *
 * 「FEMO模式」出现在 dsh 的模式菜单里，两代宿主各有各的门：
 *
 * - 旧制（文件系统发现，meow fork 在用——0.1.7-rc.1 网页版即它）：扫
 *   <dsh-home>/.agent-presets/ 下每个含 agent.cordis.yml 的目录，每次读名册
 *   都重扫。历史上一份手拷的 preset 只活在开发者自己的 dsh-home 里，普通
 *   用户装完插件菜单里没有 FEMO模式（GitHub issue #1，2026-09-15），自那起
 *   preset 随插件发布（preset/agent.cordis.yml + preset.yml，dshAdapter 目录
 *   内，整仓打包必带），apply() 时镜像到 dsh home：内容一致则跳过，不一致
 *   则覆盖——插件是 preset 的唯一权威来源，手改 dsh-home 里的文件会在下次
 *   启动被插件版覆盖。
 * - 新制（声明行注册，0.1.7-rc.2 官方桌面版起）：预设是随 bundle 补丁声明、
 *   或运行时向 agentPresets 注册表提交的定义行；官方 rc2 不再读
 *   .agent-presets/（rc2 自带文档原话："Nothing reads that directory any
 *   more."），镜像过去也无人读——rc2 桌面版菜单里没有 FEMO模式即此因。
 *   救法是 apply() 时向注册表程序化注册（registry.register(definition)，
 *   官方 @deepseek-ai/dsh-agent-preset 声明行的同一入口），本文件
 *   declareFemoPreset 即做此事。
 *
 * 两制分流是行为探测，不比对版本号：注入 agentPresets 服务后，探测到
 * register() 才走注册（meow fork 的同名服务只有 list() 没有 register()，
 * 自动留在旧制）；注册前先查名册，已有本 preset（旧扫描在册、或上次 HMR
 * 注册尚未摘除）就跳过——registry 对重复 id 直接抛错。preset/*.yml 仍是
 * 单一事实源：两条路径同读一份，作者手改 yml 重启即对两代宿主同时生效。
 *
 * dsh home 解析与 @deepseek-ai/dsh-home-paths 同款：$DSH_HOME → ~/.dsh。
 * 本模块不 import 该包（插件 devDependencies 里没有它，运行时以内部实现
 * 保持同语义）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import type { Context } from '@deepseek-ai/cordis'
import { expandSkillTemplate } from '../../../femo2host/host/skill-expand.mjs'

const PRESET_NAME = 'femo-plugin'
const PRESET_FILES = ['preset.yml', 'agent.cordis.yml'] as const

/** dsh home 根目录（与 dsh-home-paths 的优先级一致：$DSH_HOME → ~/.dsh）。 */
function dshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  return fromEnv || join(homedir(), '.dsh')
}

/**
 * 安装（镜像）FEMO preset 到 dsh home。agent.cordis.yml 的 persona 教路径时
 * 写占位符 {FEMO_ROOT}（引擎根只有运行时知道，静态 yml 写不了绝对路径），
 * 落盘前替换成 femoRoot 真实值——模型看到的系统提示词里就是可直接使用的
 * 路径。femoRoot 变化（仓库挪位/换机）后 desired 随之变化，下次启动自动覆盖。
 * 返回给 apply() 的日志用一句话：
 * 'installed'（首次落盘）/ 'updated'（内容有差异，已覆盖）/ 'up-to-date'。
 * 单文件读写失败只跳过该文件并返回错误摘要，不阻断插件加载。
 */
/** 通用教条展开（2026-09-22 SKILL 拆分，femoGenConnector）：persona 里的
 *  {{INCLUDE:femoGenConnector/SKILL.common.md}} 指令在落盘前展开为公共正文
 *  （唯一份活在 femo2host/femoGenConnector/，宿主只写附录）；展开后每行加
 *  YAML block 缩进。{HOST} 占位符同步替换。公共文件缺失=保守跳过展开
 *  （指令字样原样保留，日志可见），绝不静默清空 persona。
 *  【2026-09-29 收编】展开器唯一份=femo2host/host/skill-expand.mjs——此前
 *  本文件自带一份手写实现，与 zcode/autoclaw 的手写份漂移（CRLF 归一、占位
 *  符次序：旧序先换 {FEMO_ROOT} 再展开，公共正文自带的占位符永远漏换）。
 *  镜像与注册两条路径同吃公共件，展开语义自然一字不差。 */
function expandCommon(text: string, femoRoot: string, hostName: string): string {
  return expandSkillTemplate(text, femoRoot, hostName)
}

export function installFemoPreset(femoRoot: string): 'installed' | 'updated' | 'up-to-date' | string {
  const bundledDir = fileURLToPath(new URL('../preset/', import.meta.url))
  const targetDir = join(dshHome(), '.agent-presets', PRESET_NAME)
  const root = femoRoot.replace(/[\\/]+$/, '')
  let result: 'installed' | 'updated' | 'up-to-date' = 'up-to-date'
  const errors: string[] = []

  const existed = existsSync(join(targetDir, 'preset.yml'))
  for (const file of PRESET_FILES) {
    try {
      const raw = readFileSync(join(bundledDir, file), 'utf8')
      // 展开一次到位（{{INCLUDE}} + {FEMO_ROOT}/{HOST}，公共件内部次序=先展开
      // 后换占位符——公共正文自带的占位符一并换，旧序漏换病根的修法）。
      let desired = root.length > 0 ? expandCommon(raw, root, 'dsh') : raw
      const target = join(targetDir, file)
      const same = existsSync(target) && readFileSync(target, 'utf8') === desired
      if (same) continue
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(target, desired)
      if (result === 'up-to-date') result = existed ? 'updated' : 'installed'
    } catch (error) {
      errors.push(`${file}: ${String(error)}`)
    }
  }
  if (errors.length > 0) return `${result} with errors (${errors.join('; ')})`
  return result
}

// ── 新制：声明行注册（0.1.7-rc.2 官方桌面版起）────────────────────────────

/**
 * 声明行定义，即官方 @deepseek-ai/dsh-agent-preset 的 Config schema：
 * id/plugins 必填，name/description/order 是名册展示位。
 */
export interface FemoPresetDefinition {
  id: string
  name?: string
  description?: string
  order?: number
  plugins: unknown[]
}

/**
 * agentPresets 注册表只取用到的结构面（@deepseek-ai/dsh-agent-preset-registry
 * 的 AgentPresetRegistry）。类型不进 devDependencies，结构声明与 persona.ts
 * 的 systemPrompt 同款手法。register 返回反注册函数；对重复 id 直接抛错，
 * 所以调用方必须先查名册。
 */
interface PresetRegistryLike {
  list(): Promise<Array<{ id: string }>>
  register(definition: FemoPresetDefinition): Promise<() => Promise<void>>
}

/**
 * 定义里每个字符串过一遍占位符展开：{FEMO_ROOT} 换真实根目录，
 * {{INCLUDE}} 展开公共教条正文（expandCommon，与目录镜像完全同法）——
 * 两条路径的展开语义必须一字不差，模型看到的系统提示词才一致。
 */
function expandDeep(value: unknown, root: string): unknown {
  if (typeof value === 'string') {
    return root.length > 0 ? expandCommon(value, root, 'dsh') : value
  }
  if (Array.isArray(value)) return value.map((item) => expandDeep(item, root))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandDeep(item, root)]))
  }
  return value
}

/**
 * 读随插件打包的 preset/*.yml，组装成新制注册要的定义。preset.yml 给展示
 * 位（name/description/order），agent.cordis.yml 给插件挂载行；解析失败或
 * 形状不对时返回人话错误摘要（apply 日志可见），不抛——旧制镜像的容错
 * 口径相同，preset 有病不该炸掉整个插件加载。bundledDir 仅测试注入，
 * 产线恒为插件自带的 preset/ 目录。
 */
export function readFemoPresetDefinition(femoRoot: string, bundledDir: string = fileURLToPath(new URL('../preset/', import.meta.url))): FemoPresetDefinition | string {
  const root = femoRoot.replace(/[\\/]+$/, '')
  let meta: { name?: string; description?: string; order?: number }
  let plugins: unknown
  try {
    meta = parse(readFileSync(join(bundledDir, 'preset.yml'), 'utf8')) as typeof meta
  } catch (error) {
    return `preset.yml unparsable: ${String(error)}`
  }
  try {
    plugins = parse(readFileSync(join(bundledDir, 'agent.cordis.yml'), 'utf8'))
  } catch (error) {
    return `agent.cordis.yml unparsable: ${String(error)}`
  }
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return 'agent.cordis.yml is not a non-empty plugin entry list'
  }
  return {
    id: PRESET_NAME,
    ...(meta?.name === undefined ? {} : { name: meta.name }),
    ...(meta?.description === undefined ? {} : { description: meta.description }),
    ...(meta?.order === undefined ? {} : { order: meta.order }),
    plugins: expandDeep(plugins, root) as unknown[],
  }
}

/**
 * 向新制 agentPresets 注册表程序化注册 FEMO preset（旧制镜像的并行件，
 * 两代宿主各自取用）。动态 inject['agentPresets']：服务就绪才回调；本宿主
 * 没有该服务（或没有 register()，如 meow fork）则按兵不动，旧制镜像继续
 * 供预设——绝不把它加进插件的静态 inject，旧宿主会等一个永远不会出现的
 * 服务，整个插件跟着挂死。注册失败（含名册已有同 id 的重复保护）只打
 * 日志留痕，不中断插件加载。
 */
export function declareFemoPreset(ctx: Context, femoRoot: string): void {
  type InjectFn = (services: readonly string[], callback: (child: Context) => void) => void
  const inject = (ctx as unknown as { inject?: InjectFn }).inject
  if (typeof inject !== 'function') {
    console.log('[femo-plugin] preset declare: ctx.inject unavailable; legacy mirror only')
    return
  }
  inject(['agentPresets'], (child) => {
    const registry = (child as unknown as { agentPresets?: PresetRegistryLike }).agentPresets
    if (registry === undefined || typeof registry.list !== 'function' || typeof registry.register !== 'function') {
      console.log('[femo-plugin] preset declare: agentPresets registry has no register(); legacy mirror serves this host')
      return
    }
    // 反注册句柄同步挂 effect（插件卸载/HMR 时从名册摘除，防下次 apply
    // 撞重复 id）；注册本身异步完成，句柄先占位后回填。
    let unregister: (() => Promise<void>) | undefined
    child.effect(() => () => { void unregister?.() }, 'femo-plugin: agent preset declaration')
    void (async () => {
      try {
        const definition = readFemoPresetDefinition(femoRoot)
        if (typeof definition === 'string') {
          console.log(`[femo-plugin] preset declare skipped: ${definition}`)
          return
        }
        const roster = await registry.list()
        if (roster.some((row) => row.id === definition.id)) {
          console.log(`[femo-plugin] preset ${definition.id} already on roster; declaration not needed`)
          return
        }
        unregister = await registry.register(definition)
        console.log(`[femo-plugin] preset declared to agentPresets registry: ${definition.id}`)
      } catch (error) {
        console.log(`[femo-plugin] preset declare failed: ${String(error)}`)
      }
    })()
  })
}
