/**
 * conn.mjs — 侧栏到本地的通道（唯一出口）。
 *
 * 面板不自己管服务地址：消息全走 background 代理（web-get-state 一并带回
 * state + serverUrl）；直连 HTTP 时也用 background 认定的那个地址。
 */

/** 经 background 的信口（页面自己不直连服务，服务器地址归 background 管）。 */
export async function bg(msg) { return chrome.runtime.sendMessage(msg); }

export async function getState() { return bg({ type: 'web-get-state' }); }

/** 用 background 认定的服务地址打本地 HTTP。body 缺省 = GET。 */
export async function api(state, path, { body, timeoutMs = 10_000 } = {}) {
  const res = await fetch(`${state.serverUrl}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res.json();
}

/** 动作完成后喊总装刷新一轮（解耦：卡片模块不回头 import main）。 */
export function requestRefresh() { document.dispatchEvent(new Event('web:refresh')); }
