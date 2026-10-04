/**
 * skill-expand.mjs 的类型声明（dsh host typecheck 用；运行时语义见 .mjs）。
 */

/** 宿主附录 {{INCLUDE}} 展开器：四家宿主唯一一份（收编前各手写一份、已漂移）。 */
export declare function expandSkillTemplate(
  text: string,
  femoRoot: string,
  host: string,
  opts?: { onMissing?: (path: string) => void },
): string
