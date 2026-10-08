/**
 * mailbox-cli.mjs — 驿站 CLI 的 spawnSync 包装（zcodeAdapter runtime 内唯一
 * 一份，2026-09-29 收编：femo-possess 取信与 speech-collect 交卷此前各手写
 * 一份 spawnSync——python 解析、UTF-8 env、2500ms 超时、JSON 解析逐字同构）。
 *
 * 返回解析后的 JSON（空输出/解析失败=null，stderr 响亮留痕；本函数不抛——
 * 调用方各自有「旁挂不挡主路」的处置纪律）。2500ms 上限：mailbox 本是毫秒级
 * 磁盘写，顶满也够不着钩子 4s 寿命（宿主第 4 秒杀进程）。
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export function mailboxCli(femoRoot, args, { timeoutMs = 2500 } = {}) {
  const r = spawnSync(process.env.FEMO_PYTHON || 'python',
    [join(femoRoot, 'femo2host', 'mailbox.py'), ...args],
    {
      timeout: timeoutMs, encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });
  try {
    return JSON.parse(r.stdout || 'null');
  } catch {
    // 留痕不静默（2026-09-29）：spawn 本身失败（ENOENT/EINVAL/超时强杀）时
    // stdout/stderr 双双 undefined，旧版连一个字都不留——交卷链断在哪查无可查
    // （32K 命令行超限事故即此藏了两天）。错误码必上 stderr。
    if (r.error) {
      try { process.stderr.write(`[mailbox-cli] spawn failed: ${r.error.code ?? r.error.message}\n`); } catch { /* */ }
    } else if (r.stderr) {
      try { process.stderr.write(`[mailbox-cli] ${String(r.stderr).slice(0, 200)}\n`); } catch { /* */ }
    }
    return null;
  }
}
