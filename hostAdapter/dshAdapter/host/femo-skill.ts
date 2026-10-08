/**
 * femo-skill.ts — 把 FEMO 教条以 **skill** 的形式供给所有会话（2026-10-07 立）。
 *
 * 【为什么是 skill，不是预设】此前教条活在「FEMO模式」预设的 persona 行里：
 * 选了那个模式才有，其它会话一无所知。作者拍板：去预设、教条改成按需载入的
 * skill——在任一预设、任一普通会话里，模型自己发现并加载它，或者用户直接敲
 * `/femo`，教条正文才进上下文（不载入即零 token 占用）。
 *
 * 【唯一事实源不变】正文仍是 femo2host/femoGenConnector/SKILL.common.md（各宿主
 * 共用的唯一一份），经 expandSkillTemplate 展开 {{INCLUDE}} 与占位符——与旧
 * 预设安装路径同一台展开器、同一套语义（先展开后换占位符），所以模型看到的
 * 教条与 zcode 等宿主逐字同源。
 *
 * 【注册层级=全局】本插件是 profile bundle、拿到的是根上下文，
 * `ctx.skills.register()` 落在全局层 → **所有会话、所有预设都看得见**；用户若
 * 在自己的 skills 目录放一份同名 skill，按 dsh 的层优先级可以顶掉它（可定制）。
 *
 * 【为什么用 inject 而不进静态 inject】静态注入会让没有 ctx.skills 的旧宿主
 * 等一个永远不出现的服务、整个插件跟着挂死（同已清退的「预设双制供给」那件的
 * 教训）；动态
 * inject 是「服务就绪才登记，没有就只打一行日志」。
 *
 * 【同一模块还管两件事，都与「让模型知道有这能力」有关】
 *  1. 全局 femo:root 段（根路径一行）——不载入教条时也知道 femo 系统在哪；
 *  2. 全局 femo:tips 段（一句话：本会话有 femo-* 工具、要写/跑剧本就载入本 skill）。
 * 第 2 条是「所有会话都支持 femo 工具」这句话的**提示面**：工具本身早就在全局
 * 注册（tools.ts），差的就是有人告诉模型它们存在。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { expandSkillTemplate } from '../../../femo2host/host/skill-expand.mjs'
import { hostAddr } from './hub/hub-feed'
import { femoRootPath, installFemoRootSection } from './persona'

/** skill 名（kebab-case：模型目录里显示成这个名字，用户敲 `/femo` 载入它）。 */
export const FEMO_SKILL_NAME = 'femo'

/** 公共正文（唯一一份；相对 femo 根的路径，与旧 persona 的 {{INCLUDE}} 同指）。 */
const COMMON_SKILL = 'femo2host/femoGenConnector/SKILL.common.md'

/**
 * 目录里展示给模型/用户的描述（一句话说清「什么时候该用我」）。这段要克制：
 * 它进每个会话的 skill 目录，是常驻 token；详细的「怎么用」全在正文里，
 * 只在载入后才花 token。
 */
const FEMO_SKILL_DESCRIPTION =
  'FEMO：把「多个 AI 角色多步骤协作」编排成流程图剧本（.femo）并用引擎驱动演出的能力。'
  + '当用户要写/改/跑 FEMO 剧本、要一组 AI 角色分头调研讨论、要玩狼人杀这类多角色游戏，'
  + '或要复用某套固定多步流程时载入本 skill（用户也可直接敲 /femo）。'

/**
 * 提示段（一句话，全局）。落点顺序 55：紧跟 femo:root 段（order 50），
 * 都在人设前缀（order 0）之后、工具使用说明段（order 1000+）之前。
 */
const FEMO_TIPS_ORDER = 55
const FEMO_TIPS_TEXT = [
  '本会话可以直接写、干跑、运行 FEMO 剧本：工具表里有 femo-mount（挂载脚本到本会话）、',
  'femo-debug（零 token 干跑自检）、femo-run（从头跑/暂停/续跑/查 Job）、femo-script（看当前挂载脚本）、',
  'femo-soul（角色库）、femo-chronica（查运行台账）、femo-possess（把自己绑成某角色出演）。',
  '需要写或跑剧本、或用户提到 FEMO/剧本/多角色演出时，先用 skill 工具加载 `femo`（用户也可敲 /femo），',
  '按它的完整教条做事；教条的完整正文不在本段里。',
].join('')

/** `ctx.skills` 的最小消费面（结构声明，不把 dsh-skill 拉进依赖）。 */
interface SkillRegistryLike {
  register(skill: { name: string; description: string; content: string }): () => void
}

/** 展开后的教条正文（模块级缓存：只在装配期展开一次，之后复用）。 */
let skillContentCache: string | undefined

/**
 * 读公共正文并展开成最终教条（{{INCLUDE}} 展开 + {FEMO_ROOT}/{HOST} 替换）。
 * 展开器与旧预设安装路径同一台；公共文件缺失时它保守保留指令字样（不静默清空），
 * 这里如实把结果交给模型并留一行日志。
 */
export function femoSkillContent(femoRoot: string): string {
  if (skillContentCache !== undefined) return skillContentCache
  const root = String(femoRoot || femoRootPath()).replace(/[\\/]+$/, '')
  let body = ''
  try {
    body = readFileSync(join(root, COMMON_SKILL), 'utf8')
  } catch (error: unknown) {
    console.log(`[femo-plugin] femo skill: cannot read ${COMMON_SKILL}: ${String(error)}`)
    return ''
  }
  const expanded = expandSkillTemplate(body, root, hostAddr(), {
    onMissing: (path: string) => { console.log(`[femo-plugin] femo skill: include missing: ${path}`) },
  }).replace(/\r\n/g, '\n')
  // 剥掉公共文件开头那段 HTML 注释（"本文件怎么被宿主加载"的装配说明）：
  // 它是**给装配者看的**，不该出现在模型读到 /femo 时的第一屏。只动注册进去的
  // 这份内容，磁盘上的公共文件一字不改（zcode 等其它消费者照旧）。
  const stripped = expanded.replace(/^\s*<!--[\s\S]*?-->\s*/, '')
  skillContentCache = stripped.trim().length > 0 ? stripped.trim() : ''
  return skillContentCache
}

/**
 * 装配：全局 femo:root 段 + femo:tips 段 + 注册 `femo` skill。
 * 幂等（装配期调用一次）；服务缺席只留日志，不影响插件其余部分。
 */
export function installFemoSkill(ctx: Context, femoRoot: string): void {
  // 两段系统提示（全局；无 systemPrompt 服务时各自内部留痕返回 undefined）。
  ctx.effect(() => installFemoRootSection(ctx) ?? (() => undefined), 'femo-plugin: femo:root section')
  installTipsSection(ctx)

  type InjectFn = (services: readonly string[], callback: (child: Context) => void) => void
  const inject = (ctx as unknown as { inject?: InjectFn }).inject
  if (typeof inject !== 'function') {
    console.log('[femo-plugin] femo skill: ctx.inject unavailable; /femo skill not registered')
    return
  }
  // 装配可观测性（本插件有过「inject 的服务名写错 → 回调永不触发 → 静默空转」的
  // 先例）：等待行先打，注册成功/失败再各打一行——三行齐全才说明这一环真的接上了。
  console.log('[femo-plugin] femo skill: waiting for ctx.skills …')
  inject(['skills'], (child) => {
    const skills = (child as unknown as { skills?: SkillRegistryLike }).skills
    if (skills === undefined || typeof skills.register !== 'function') {
      console.log('[femo-plugin] femo skill: skills service has no register(); /femo unavailable on this host')
      return
    }
    const content = femoSkillContent(femoRoot)
    if (content === '') {
      console.log(`[femo-plugin] femo skill: EMPTY content — 公共教条读不到（看上面那行 read 失败日志），/${FEMO_SKILL_NAME} 未注册`)
      return
    }
    try {
      const dispose = skills.register({
        name: FEMO_SKILL_NAME,
        description: FEMO_SKILL_DESCRIPTION,
        content,
      })
      ctx.effect(() => dispose, 'femo-plugin: femo skill registration')
      console.log(`[femo-plugin] femo skill registered: /${FEMO_SKILL_NAME}（${content.length} 字符，含描述 ${FEMO_SKILL_DESCRIPTION.length} 字）——所有会话可用`)
    } catch (error: unknown) {
      console.log(`[femo-plugin] femo skill register FAILED: ${String(error)}`)
    }
  })
}

/** 挂「本会话有 femo 工具」那一句（全局；服务缺席留痕不抛）。 */
function installTipsSection(ctx: Context): void {
  const systemPrompt = (ctx as unknown as { systemPrompt?: { section(s: { name: string; order: number; text: string }): () => void } }).systemPrompt
  if (systemPrompt === undefined) return
  try {
    const dispose = systemPrompt.section({ name: 'femo:tips', order: FEMO_TIPS_ORDER, text: FEMO_TIPS_TEXT })
    ctx.effect(() => dispose, 'femo-plugin: femo:tips section')
  } catch (error: unknown) {
    console.log(`[femo-plugin] femo:tips section install failed: ${String(error)}`)
  }
}
