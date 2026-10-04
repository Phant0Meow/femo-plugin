/**
 * sse-core.mjs — femoGen 画布 SSE 通道公共层（重放环 + 心跳 + 帧信封）。
 *
 * 2026-09-22 收口进 femoGenConnector（用户拍板：femoGen 相关公用元素集中这里
 * ——femoGen 不一定在哪打开，画布的数据通道是 femoGen 的东西，不是某个宿主的）。
 *
 * 两份宿主实现的语义并集（dsh engine-events.ts rememberEvent v9 权威版 +
 * routes.ts /events 重放循环 + zcode gateway.mjs replayRing）：
 *
 *   重放环   remember(eventType, data) —— 引擎事件入环备重连补发；
 *            cap 400（dsh v8.1 实测：旧 100 环被一次长 AI 回复的逐 token 帧冲爆，
 *            node_start/human_wait 全被挤出、人类输入快照丢失）
 *   短命帧   femo_stream / ai_token / step 不入环——"此刻在飞的流式状态"，
 *            重放会让旧轮 delta 再长一遍字、旧轮 end 清掉新轮桶（Job784 实锤）
 *   快照帧   checkpoint 环内 replace-in-place 只留最新一条（变量世界快照不回放堆积）
 *   replay 标记  重放帧信封顶层打 replay:true（v9）——追平帧只恢复状态绝不触发
 *            浮层；否则挂起态刷新时整场历史 human_wait 走马灯弹一遍
 *   心跳     15s 注释行，防代理/浏览器判死空闲连接
 *
 * 宿主绑定面（createSseChannel 返回值）：
 *   remember(type, data)          引擎事件入口（宿主在事件现场调）
 *   broadcast(type, data)         环 + 在场客户端同发（含 femo_stream 现场帧：
 *                                 进环会被 remember 过滤，直接 write 在场端）
 *   connect(res)                  新客户端接入：重放（打 replay 标记）+ 心跳托管
 *   clientCount()                 在场客户端数（诊断用）
 *
 * 帧格式差异（留在宿主插座，不进本层）：
 *   dsh   `data: {...}\n\n`（EventSource 默认派发）
 *   zcode `event: <type>\ndata: {...,ts}\n\n`（具名事件）
 * 通过 frameCodec 参数注入；缺省 dsh 形状。
 */

const RING_CAP = 400;

/** 短命帧：不进重放环（现场直推在场客户端）。 */
const EPHEMERAL = new Set(['femo_stream', 'ai_token', 'step']);

/** 缺省帧编解码（dsh 形状）：data: JSON 行。 */
const defaultCodec = {
  encode(type, data, replay) {
    return `data: ${JSON.stringify(replay ? { type, data: data ?? {}, replay: true } : { type, data: data ?? {} })}\n\n`;
  },
};

export function createSseChannel({ cap = RING_CAP, codec = defaultCodec, heartbeatMs = 15_000, log = () => {} } = {}) {
  const ring = [];                 // 重放环：{type, data}（帧形状在 connect/broadcast 时才编码）
  const clients = new Set();

  function remember(eventType, data) {
    if (EPHEMERAL.has(eventType)) return;
    if (eventType === 'checkpoint') {
      const idx = ring.findIndex(e => e.type === 'checkpoint');
      if (idx >= 0) { ring[idx] = { type: eventType, data }; return; }
    }
    ring.push({ type: eventType, data });
    if (ring.length > cap) ring.shift();
  }

  function writeRaw(frame) {
    for (const res of clients) {
      try { res.write(frame); } catch { clients.delete(res); }
    }
  }

  /** 现场广播：入环（短命帧自动跳过）+ 直推在场客户端（不带 replay 标记）。 */
  function broadcast(eventType, data) {
    remember(eventType, data);
    writeRaw(codec.encode(eventType, data, false));
  }

  /** 只直推不入环（宿主自己管环时用——dsh 引擎路径 broadcastSse 与
   *  rememberEvent 是既有两步，bindLive 模式下避免同帧 remember 两次）。 */
  function pushLive(eventType, data) {
    writeRaw(codec.encode(eventType, data, false));
  }

  /** 新客户端接入：环内补帧（打 replay 标记）+ 心跳托管。返回断开清理函数。 */
  function connect(res) {
    for (const ev of ring) {
      try { res.write(codec.encode(ev.type, ev.data, true)); } catch { clients.delete(res); break; }
    }
    clients.add(res);
    const hb = setInterval(() => {
      try { res.write(`: heartbeat\n\n`); } catch { clearInterval(hb); clients.delete(res); }
    }, heartbeatMs);
    const cleanup = () => { clearInterval(hb); clients.delete(res); };
    res.on?.('close', cleanup);
    return cleanup;
  }

  function clientCount() { return clients.size; }
  function ringSize() { return ring.length; }

  return { remember, broadcast, pushLive, connect, clientCount, ringSize };
}
