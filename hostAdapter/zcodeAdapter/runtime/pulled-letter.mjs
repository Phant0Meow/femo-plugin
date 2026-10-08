/**
 * pulled-letter.mjs — 拉取宿主的信件注入文案。
 *
 * 职责：把驿站的信渲染成给模型的注入文本（纯函数，测试直驱）。注入文案只
 * 陈述「轮到谁、节点是什么、你能看到什么」——交卷不靠模型：模型被唤醒后的
 * 整回合发言（思考/正文/工具调用）由 Stop 钩子自动收集交驿，文案里不得出现
 * 任何交卷命令教学（单测锁死）。zcode 私产不进公共层（私产下推：只有拉取
 * 宿主用它）。
 * - context：节点开口通知——按 pullSoul（会话附身的角色；main 即导演本人）点名；
 * - notice + subkind=node_retry：重演通知——同按 pullSoul 点名，修正后正常作答；
 *   【2026-09-29 收编】带上 SET_VARIABLE_TEACHING（措辞唯一权威=node-retry，
 *   推送宿主的重试文案 RETRY_STEER_TEXT 同源）——此前拉取路漏了赋值格式教学，
 *   重演节点恰是赋值节点时 zcode 演员拿不到格式提示；
 * - 其余按 kind 透传。
 */

import { importCore } from '../paths.mjs';

const { SET_VARIABLE_TEACHING } = await importCore('node-retry.mjs');

export function renderPulledLetter(x, pullSoul) {
  const who = pullSoul && pullSoul !== 'main' ? `你（${pullSoul}）` : '你（main）';
  const node = x.node ? `（节点「${x.node}」）` : '';
  if (x.kind === 'notice') {
    const retry = x.push_extra?.retry;
    if (x.subkind === 'node_retry' && retry) {
      const attempt = retry.attempt === undefined || retry.attempt === null ? '' : `（第 ${retry.attempt} 次反馈）`;
      return `[femo] 轮到${who}重演${attempt}${node}——你上一轮的输出未通过FEMO脚本校验：\n${x.payload}\n[femo] 请修正后正常重新回答（纯文本即可；${SET_VARIABLE_TEACHING}）。先架哨兵，再把修正后的台词作为本回合最后一条消息说出——插件自动收卷最后一条消息交卷，不要调用任何 femo 工具或命令来交卷。`;
    }
    return `[femo] ${x.payload}`;
  }
  if (x.kind === 'context') {
    return `[femo] 轮到${who}发言${node}：\n${x.payload}\n[femo] 本回合就是你的节点发言：先架好哨兵，再把台词作为本回合最后一条消息正常说出（纯文本即可）——插件自动收卷它交卷，不要调用任何 femo 工具或命令来交卷。`;
  }
  return `[femo] ${x.kind}：${x.payload}`;
}
