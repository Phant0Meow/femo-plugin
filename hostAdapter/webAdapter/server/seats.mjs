/**
 * seats.mjs — 角色席路由（网页版宿主特有物理形态）。
 *
 * 本宿主没有子代理：一个网页会话标签页 = 一个席位。扩展的每个标签页经
 * 本地服务登记上线，这里只记**物理事实**两本账：
 *   席位账      sessionId → seat（领域锚 = 会话引用 `<站点域名>:<会话id>`，
 *               形态契约住 sites.mjs；多站在役后跨站不撞号、来源写在 id 脸上。
 *               hub 旧账里的裸 id 无前缀——bySessionLoose 兼容读，不迁移账）
 *   主Agent席账   主Agent席至多一个（主Agent任务的落点；没设 = 任务落到操作台人工席）
 *
 * 【灵魂绑定不住这里（2026-09-25 用户定案：全系统只记一笔账）】soul ↔ 会话的
 * 映射正身住 hub cast 账（cast-preferences 偏好账，开演定格进 cast/<jobId>.json），
 * 席位路由经 runtime 的 resolveSeat 查 hub（dsh 收件口同款 readJobCast 姿势）。
 * 本文件早先自养的 soulOwner 映射账已删——第二本账必然漂移。
 *
 * 在线/offline 由扩展连接（connId）的存在性推导：连接断 = 该连接的全部席位
 * 离线（回来即复活）。pending 队列按席位挂：席位忙（上一轮还在回）时任务排队，
 * 席位空出来再发——排队超时归 runtime 裁决上报。
 *
 * 席位两态分开记（2026-10-01 按需唤醒拍板）：浏览器会冻结后台标签页（内存节省
 * 器），冻结页不应答探活但**标签页还开着**——open 状态下硬等在线只会白等。
 *   present = 标签页开着（扩展按 URL 就能认出它，不依赖页内应答）——派工与
 *             点名只认这个：页开着=席位在，轮到它发言时请台 reload 唤醒；
 *   online  = 此刻应答过探活、能立刻收帧——帧只发 online 的席位（冻结页收不了，
 *             派进去了也是静默丢，实测坑）。
 * 两态都为假的 = 标签页关了。
 */

const PENDING_CAP = 8; // 单席位排队上限：一次运行里同一灵魂两个回合相连是常态，8 个足够

import { parseSessionRef, siteById } from '../sites.mjs';

/**
 * @param {object} [opts]
 * @param {(msg:string)=>void} [opts.log]
 */
export function createSeatBoard({ log = () => {} } = {}) {
  /** sessionId → seat */
  const seats = new Map();
  /** 主Agent席 sessionId | undefined */
  let mainSessionId;

  function touch(seat) {
    seat.lastSeenAt = Date.now();
  }

  /**
   * 扩展连接的标签页全量上报（每次上报覆盖该连接旧账：标签页就是物理事实）。
   * tabs: [{tabId, sessionId, site, title, busy, online}]——online=这轮探活应答过
   * （缺省 true 兼容未刷新的旧扩展）；没应答的页扩展也报上来（online:false）：
   * 页开着=席位在，只是休眠（按需唤醒靠这条账知道「该唤醒谁」）。
   * sessionId 可为 ''（新会话未发首条）。
   * site = 站点名（站点包 SITE_ID，扩展按 URL 判定）——open-tab 请台要靠它知道开哪家。
   */
  function upsertTabs(connId, tabs) {
    const now = Date.now();
    const seen = new Set();
    for (const t of Array.isArray(tabs) ? tabs : []) {
      const sessionId = String(t.sessionId ?? '');
      if (!sessionId) continue; // 没有 session id 的页（裸 /）不立席位——没法对号
      seen.add(sessionId);
      const online = t.online === undefined ? true : Boolean(t.online); // 旧扩展不上报 online：照旧全算应答过
      let seat = seats.get(sessionId);
      if (!seat) {
        seat = {
          sessionId,
          site: String(t.site ?? ''),
          connId,
          tabId: Number(t.tabId ?? 0),
          title: String(t.title ?? ''),
          busy: false,
          online,
          present: true,
          lastSeenAt: now,
          pending: [],
        };
        seats.set(sessionId, seat);
        log(`seats: +tab ${sessionId.slice(0, 8)}… (tab=${seat.tabId}${seat.site ? ` @${seat.site}` : ''}${online ? '' : '，未应答探活=休眠'})`);
      } else {
        const wasOnline = seat.online;
        seat.connId = connId;
        seat.site = String(t.site ?? seat.site);
        seat.tabId = Number(t.tabId ?? seat.tabId);
        seat.title = String(t.title ?? seat.title);
        seat.online = online;
        seat.present = true;
        touch(seat);
        if (!wasOnline && online && seat.pending.length > 0) log(`seats: ${sessionId.slice(0, 8)}… back online with ${seat.pending.length} pending`);
      }
      setBusy(sessionId, Boolean(t.busy));
    }
    // 该连接没再报到的席位 = 已关闭 → 出账（主Agent席随椅子消失；灵魂绑定不受
    // 影响——那笔账住 hub，与椅子的物理存亡无关）。
    for (const seat of seats.values()) {
      if (seat.connId === connId && !seen.has(seat.sessionId)) {
        seat.online = false;
        seat.present = false;
        seat.busy = false;
        if (mainSessionId === seat.sessionId) mainSessionId = undefined;
      }
    }
    return list();
  }

  /** 连接断开：该连接全部席位离线。present 保持最后一次上报的物理事实——
   *  连接断=扩展够不着了，不代表标签页关了（页开着的事实要等下一轮上报推翻）。 */
  function markOffline(connId) {
    for (const seat of seats.values()) {
      if (seat.connId === connId && seat.online) {
        seat.online = false;
        seat.busy = false;
        if (mainSessionId === seat.sessionId) mainSessionId = undefined;
      }
    }
  }

  /** 座席上行到达=活气（2026-10-02 GLM 实案立账）：任何 report（上线报到/日志/
   *  delta/reply）都是 content script 此刻活着的铁证——sendMessage 通道通着才
   *  到得了服务端。翻 online=true：唤醒闸「等上线」不必干等 10 秒一轮的探活——
   *  reload 后页面几秒内座席就上线报到，但 Edge 随即又把页冻掉，探活从此不应答
   *  （在线账永假），75s 等窗白白超时拒派——座席报到的瞬间就该放行。下一轮
   *  register（10s 内）会用探活结果覆盖回真实状态；冻结页发不出 report，不会
   *  假真。sessionId 空（新会话未发首条）不翻。 */
  function markAlive(sessionId) {
    const id = String(sessionId ?? '');
    if (!id) return false;
    const seat = seats.get(id) ?? bySessionLoose(id);
    if (!seat) return false;
    touch(seat);
    if (!seat.online) {
      seat.online = true;
      log(`seats: ${seat.sessionId.slice(0, 8)}… 座席上行到达，翻在线（探活之外的第二活气判据）`);
      return true;
    }
    return false;
  }

  function setBusy(sessionId, busy) {
    const seat = seats.get(String(sessionId));
    if (!seat) return;
    seat.busy = Boolean(busy);
  }

  /** 设主Agent席：至多一把；null/'' 清除。 */
  function setMain(sessionId) {
    if (sessionId === null || sessionId === undefined || String(sessionId) === '') {
      mainSessionId = undefined;
      return { ok: true };
    }
    const seat = seats.get(String(sessionId));
    if (!seat) return { ok: false, error: `seat not found: ${sessionId}` };
    mainSessionId = seat.sessionId;
    return { ok: true };
  }

  function mainSeat() {
    return mainSessionId !== undefined ? seats.get(mainSessionId) : undefined;
  }

  function bySession(sessionId) {
    return seats.get(String(sessionId));
  }

  /** 按会话引用找席位：先精确；旧账裸 id（无来源前缀）按后缀匹配带前缀的席位
   *  （引用形态见 sites.mjs——hub 存量绑定还是裸 id，兼容读，不迁移账）。
   *  带前缀却查无 = 真没这席位，不兜底。 */
  function bySessionLoose(sessionId) {
    const id = String(sessionId);
    const exact = seats.get(id);
    if (exact) return exact;
    if (id.includes(':')) return undefined;
    for (const seat of seats.values()) {
      if (seat.sessionId.endsWith(`:${id}`)) return seat;
    }
    return undefined;
  }

  /** 任务挂队：席位忙就排队，返回实际下发与否。 */
  function enqueuePending(sessionId, frame) {
    const seat = seats.get(String(sessionId));
    if (!seat) return { queued: false, reason: 'seat not found' };
    if (seat.pending.length >= PENDING_CAP) return { queued: false, reason: `pending overflow (>${PENDING_CAP})` };
    seat.pending.push(frame);
    return { queued: true, depth: seat.pending.length };
  }

  /** 取走队头（在线且空闲时由 runtime 调）。 */
  function takePending(sessionId) {
    const seat = seats.get(String(sessionId));
    if (!seat || seat.busy || !seat.online) return undefined;
    return seat.pending.shift();
  }

  function pendingCount(sessionId) {
    const seat = seats.get(String(sessionId));
    return seat ? seat.pending.length : 0;
  }

  /** 灵魂展示镜像取值：先按席位引用精确对，再按裸 id 兼容对（hub 旧绑定存的
   *  是无前缀的裸 id）。 */
  function soulOf(seat, map) {
    if (!map) return undefined;
    if (map[seat.sessionId]) return map[seat.sessionId];
    const i = seat.sessionId.indexOf(':');
    return i > 0 ? map[seat.sessionId.slice(i + 1)] : undefined;
  }

  function publicSeat(seat, soulBySession) {
    // 展示派生（账本不记）：来源显示名与短 id 从会话引用拆出（sites.mjs 接缝）；
    // 引用拆不开（旧扩展上报的裸 id）时按席位物理账的 site 格认站补标签——
    // 两样都没有的旧账，标签缺位、短 id 整串截断（一眼可辨=该重载扩展了）。
    const ref = parseSessionRef(seat.sessionId);
    return {
      sessionId: seat.sessionId,
      site: seat.site || ref?.site.SITE_ID || undefined, // 哪家站点（物理事实；open-tab 请台与展示用）
      siteLabel: ref?.site.SITE_LABEL ?? siteById(seat.site)?.SITE_LABEL, // 来源显示名（侧栏来源牌/操作台来源列）
      sidShort: (ref?.sessionId ?? seat.sessionId).slice(0, 8), // 短 id（剥掉来源前缀再截短）
      tabId: seat.tabId,
      title: seat.title,
      online: seat.online,
      present: seat.present, // 标签页开着（哪怕休眠）——派工/点名按需唤醒的判据
      busy: seat.busy,
      soul: soulOf(seat, soulBySession) || undefined, // 展示镜像：调用方从 hub 偏好账视图算好传入
      isMain: mainSessionId === seat.sessionId,
      pending: seat.pending.length,
      lastSeenAt: seat.lastSeenAt,
    };
  }

  function list(soulBySession) {
    return [...seats.values()].map(s => publicSeat(s, soulBySession));
  }

  return {
    upsertTabs, markOffline, markAlive, setBusy, setMain,
    mainSeat, bySession, bySessionLoose, enqueuePending, takePending, pendingCount,
    list,
  };
}
