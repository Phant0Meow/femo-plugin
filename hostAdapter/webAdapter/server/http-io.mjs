/**
 * http-io.mjs — 本地服务的请求体收集（唯一一份）：service 总装与 canvas 代理
 * 共吃。上限由调用方自报（此前 service 10MB / canvas 4MB 两套手写——收编单份）；
 * JSON 解析策略留在调用方（service 坏 JSON 抛 400，canvas 坏 JSON 回 {} 落
 * 「脚本文本为空」，两路语义本就不同）。
 */

export function readBody(req, cap = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > cap) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
