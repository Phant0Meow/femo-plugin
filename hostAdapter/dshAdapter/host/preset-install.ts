/**
 * preset-install.ts — 把随插件打包的 FEMO preset 安装到 dsh home。
 *
 * 「FEMO模式」出现在 dsh 的模式菜单里，前提是 <dsh-home>/.agent-presets/
 * femo-plugin/ 存在（dsh 只发现内置 preset + 用户目录 preset）。历史上一份
 * 手拷的 preset 活在开发者自己的 dsh-home 里，普通用户装完插件菜单里没有
 * FEMO模式（GitHub issue #1，2026-09-15）。现在 preset 随插件发布
 * （preset/agent.cordis.yml + preset.yml，dshAdapter 目录内，整仓打包必带），
 * apply() 时镜像到 dsh home：内容一致则跳过，不一致则覆盖——插件是 preset
 * 的唯一权威来源，手改 dsh-home 里的文件会在下次启动被插件版覆盖。
 *
 * dsh home 解析与 @deepseek-ai/dsh-home-paths 同款：$DSH_HOME → ~/.dsh。
 * 本模块不 import 该包（插件 devDependencies 里没有它，运行时以内部实现
 * 保持同语义）。
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PRESET_NAME = 'femo-plugin'
const PRESET_FILES = ['preset.yml', 'agent.cordis.yml'] as const

/** dsh home 根目录（与 dsh-home-paths 的优先级一致：$DSH_HOME → ~/.dsh）。 */
function dshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  return fromEnv || join(homedir(), '.dsh')
}

/**
 * 安装（镜像）FEMO preset 到 dsh home。返回给 apply() 的日志用一句话：
 * 'installed'（首次落盘）/ 'updated'（内容有差异，已覆盖）/ 'up-to-date'。
 * 单文件读写失败只跳过该文件并返回错误摘要，不阻断插件加载。
 */
export function installFemoPreset(): 'installed' | 'updated' | 'up-to-date' | string {
  const bundledDir = fileURLToPath(new URL('../preset/', import.meta.url))
  const targetDir = join(dshHome(), '.agent-presets', PRESET_NAME)
  let result: 'installed' | 'updated' | 'up-to-date' = 'up-to-date'
  const errors: string[] = []

  const existed = existsSync(join(targetDir, 'preset.yml'))
  for (const file of PRESET_FILES) {
    try {
      const source = join(bundledDir, file)
      const target = join(targetDir, file)
      const same = existsSync(target) &&
        readFileSync(target, 'utf8') === readFileSync(source, 'utf8')
      if (same) continue
      mkdirSync(targetDir, { recursive: true })
      copyFileSync(source, target)
      if (result === 'up-to-date') result = existed ? 'updated' : 'installed'
    } catch (error) {
      errors.push(`${file}: ${String(error)}`)
    }
  }
  if (errors.length > 0) return `${result} with errors (${errors.join('; ')})`
  return result
}
