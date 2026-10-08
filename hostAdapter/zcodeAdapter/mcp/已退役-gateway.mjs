/**
 * 【已退役（2026-09-28，作者拍板）】生产零消费：四面动态端点（/events、
 * /api/human-input、/api/session-state、/api/god-outside）唯一调用方是冒烟
 * 测试自己；画布 bundle 请求的是 dsh 路由词汇（/femo-plugin/*），本网关无此
 * 路由，从网关打开的画布实时面结构性 404；钩子的戏外捕获已直喂 hub /feed，
 * 人类输入真通道=投影中心网页输入席。静置观察一轮真演出，无恙移 mytrashbin。
 * 勿 import：本文件不再被任何在役代码引用（femo-server 接线已同批摘除）。
 */
/**
 * gateway.mjs — 本地 HTTP 网关（femo-server 内嵌）
 * =================================================
 * 职责：
 *   1. SSE 事件流 /events —— femoGen 直播（femo_stream / run_state 帧，重放环 + 心跳）
 *   2. REST 数据面 —— human-input（人类玩家输入）/ session-state（运行态）/
 *      god-outside（FEMO外行喂 hub，god-mirror 等价物）
 *   3. 静态托管 femoGen/dist
 *
 * 仅绑 127.0.0.1。端口：FEMO_PORT > 3789 起顺延扫描。
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// femoGenConnector 定位：FEMO_ROOT env 重定向优先——安装态非自包含（缓存副本
// 向上探不到引擎）时的活路；余下三档布局：开发态嵌套（mcp→zcodeAdapter→
// hostAdapter→repo 根）与安装态平铺（<femoRoot>/mcp→<femoRoot>）。失败即抛，
// 不静默——与 importCore 同款纪律。
async function importCoreFile(rel) {
  const hrefs = [];
  if (process.env.FEMO_ROOT) {
    hrefs.push(pathToFileURL(join(process.env.FEMO_ROOT, rel)).href);
  }
  for (const prefix of ['../../../', '../../', '../']) {
    hrefs.push(new URL(`${prefix}${rel}`, import.meta.url).href);
  }
  for (const href of hrefs) {
    if (existsSync(fileURLToPath(href))) return import(href);
  }
  throw new Error(`${rel} not found (FEMO_ROOT & dev & flat layouts all missed)`);
}
const { createSseChannel } = await importCoreFile('femo2host/femoGenConnector/sse-core.mjs');
// hub 地址唯一解析（公共层收编件）：读桥写的 hub.json 自发现，端口被占顺延不喂错邻居。
const { hubBaseUrl } = await importCoreFile('femo2host/host/hub-client.mjs');
// hub 喂送协议机（公共层收编件，2026-09-25）：FEMO外行的 op 形状与 POST 体唯一出处
// ——dsh hub-feed 的微批机同一份；这里走同步面（诚实失败，不静默）。
const { outsideRowOp, postFeedFrames } = await importCoreFile('femo2host/host/hub-feed-core.mjs');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

/**
 * @param {object} opts
 * @param {object} opts.router  事件路由器（运行态镜像 + 人类席交卷；交卷经总装
 *                              接线的引擎命令通道出站）
 * @param {number} [opts.port]  监听端口（缺省 3789，被占向上顺延）
 * @param {string} [opts.staticDir] femoGen/dist（画布静态面；缺省无）
 * @param {(msg: string) => void} [opts.log]
 */
export function startGateway({ router, port = 3789, staticDir, log = () => {} }) {
  // 【2026-09-22 收口】重放环/短命帧过滤（femo_stream 不入环——dsh Job784 同款
  // 教训，此前 zcode 裸环会中招）/checkpoint 原地替换/replay 标记（防 human_wait
  // 走马灯——此前 zcode 重放不打标记）/心跳托管，唯一活在 femoGenConnector/
  // sse-core.mjs。本文件只剩 zcode 帧格式插座（具名事件 + ts 字段）。
  const channel = createSseChannel({
    codec: {
      encode(type, data, replay) {
        return `event: ${type}\ndata: ${JSON.stringify({ ...data, ts: Date.now(), ...(replay ? { replay: true } : {}) })}\n\n`;
      },
    },
  });

  /** SSE 广播（环 + 在场端同发；语义与 dsh broadcastSse+rememberEvent 合一）。 */
  function broadcast(frameType, payload) {
    channel.broadcast(frameType, payload);
  }

  const json = (res, code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(obj));
  };
  const readBody = req => new Promise(resolve => {
    let b = '';
    req.on('data', c => { b += c; });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });

  const HOST_ID = String(process.env.FEMO_HOST_NAME || 'zcode');
  /** 会话寻址地址（'host:sid'）：绑定账/FEMO外直投同一个词（hub-feed-core 注入口）。 */
  const sessionAddr = sid => (sid.includes(':') ? sid : `${HOST_ID}:${sid}`);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const path = url.pathname;
    try {
      // ── SSE ──
      if (path === '/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
        channel.connect(res); // 补帧（打 replay 标记）+ 心跳 + 断开清理，全交通道
        return;
      }

      // ── 人类玩家输入（§6 通道 1：不经模型直进引擎）──
      if (path === '/api/human-input' && req.method === 'POST') {
        const body = await readBody(req);
        const wh = router.state().waitingHuman;
        if (!wh) { json(res, 409, { error: '引擎当前不在等待人类输入' }); return; }
        const actorName = body.actor ?? (wh.scope ?? ['@人类'])[0] ?? '@人类';
        router.projectUserLine(actorName, String(body.text ?? ''), wh.scope);
        broadcast('femo_stream', { kind: 'user_line', actor: actorName, text: String(body.text ?? '') });
        // 人类席交卷走人类信封（body={chat_text, variables}）——引擎人类节点
        // 只读 chat_text/variables，旧 {output} 形态会被读成空台词（2026-09-21 修正）。
        const vars = (body.variables && typeof body.variables === 'object' && !Array.isArray(body.variables))
          ? body.variables : {};
        const r = await router.submitHumanOutput(wh.job_id, wh.wait_key, String(body.text ?? ''), actorName, vars);
        json(res, 200, { ok: true, result: r });
        return;
      }

      // ── 运行态（femoGen 画布恢复 / hooks 状态播报共用）──
      // 【2026-09-25】windows 字段随三窗柜退役移除——窗清单走 hub GET /views。
      if (path === '/api/session-state') {
        json(res, 200, { ...router.state() });
        return;
      }

      // ── FEMO外行喂 hub（god-mirror 等价物，2026-09-25）────────────────────
      // dsh 有 god-mirror FEMO外旁挂；zcode 的等价通道：调用方（工具面）把主会话
      // FEMO外发言交到这里，网关按 §5.5 会话寻址喂 hub（session=zcode:<sid>、
      // zone=outside 行、src_seq 幂等）。hub 不在线=503 诚实失败——录制是旁挂，
      // 不兜底暂存（少兜底纪律；重放靠调用方重发）。
      if (path === '/api/god-outside' && req.method === 'POST') {
        const body = await readBody(req);
        const sid = String(body.session ?? body.sid ?? '').trim();
        const lines = Array.isArray(body.lines) ? body.lines : [];
        if (sid.length === 0 || lines.length === 0) { json(res, 400, { error: 'session(sid) 与 lines 必填' }); return; }
        const session = sessionAddr(sid);
        const source = HOST_ID;
        // op 形状与 POST 体唯一出处=公共层 hub-feed-core（2026-09-25 换轨；
        // kind 缺省按 role 猜：user→whisper、其余→say，同款逻辑在 core）。
        const frames = lines.map(outsideRowOp);
        try {
          const r = await postFeedFrames(`${hubBaseUrl()}/feed`, { session, source, frames });
          const out = await r.json();
          json(res, r.ok ? 200 : 502, { ok: r.ok, session, ...out });
        } catch (error) {
          json(res, 503, { ok: false, error: `hub 不可达：${String(error).slice(0, 120)}` });
        }
        return;
      }

      // ── 静态 femoGen/dist ──
      if (staticDir && path !== '/') {
        const file = join(staticDir, path.slice(1));
        if (existsSync(file)) {
          res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
          res.end(readFileSync(file));
          return;
        }
      }
      if (staticDir && path === '/') {
        const index = join(staticDir, 'index.html');
        if (existsSync(index)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(readFileSync(index));
          return;
        }
      }
      json(res, 404, { error: 'not found', hint: 'GET /events | /api/session-state | POST /api/human-input | POST /api/god-outside' });
    } catch (error) {
      log(`gateway error: ${String(error)}`);
      json(res, 500, { error: String(error).slice(0, 300) });
    }
  });

  return new Promise(resolve => {
    // 端口顺延扫描（最多 20 个）
    const tryListen = attempt => {
      const p = port + attempt;
      const once = () => {
        server.removeListener('error', onError);
        log(`gateway listening on http://127.0.0.1:${p}`);
        resolve({ server, port: p, broadcast });
      };
      const onError = err => {
        server.removeListener('listening', once);
        if (attempt < 20) tryListen(attempt + 1);
        else { log(`gateway: no free port from ${port}`); resolve(undefined); }
      };
      server.once('error', onError);
      server.once('listening', once);
      server.listen(p, '127.0.0.1');
    };
    tryListen(0);
  });
}
