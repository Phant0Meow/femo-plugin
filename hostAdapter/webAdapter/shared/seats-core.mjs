/**
 * shared/seats-core.mjs — 席位判断（唯一一份，画法留各页：侧栏画卡片、操作台画表格）。
 */

/** 席位运行状态：忙 > 在线 > 休眠 > 网页未打开。返回 {key, label}，各页拿 key 上色、
 *  label 上字。2026-09-30 用户拍板：离线改叫「网页未打开」——原名不如这句对人话。
 *  2026-10-01 按需唤醒拍板：把「开着」与「应答」拆成两态——「休眠中」=标签页
 *  开着但被浏览器冻结（轮到它发言会自动唤醒重载，不用管），「网页未打开」=
 *  标签页真没了。 */
export function seatState(seat) {
  if (seat?.busy) return { key: 'run', label: '运行中' };
  if (seat?.online) return { key: 'on', label: '在线' };
  if (seat?.present) return { key: 'dormant', label: '休眠中' };
  return { key: 'off', label: '网页未打开' };
}

/** 绑定前拦截：灵魂 id 为空不许绑（空值发出去会被服务端当解绑——操作台旧版
 *  就这么误伤过一回；共用后两页同一句话拦下）。返回 null = 放行。 */
export function bindRefusal(soul) {
  return String(soul ?? '').trim() ? null : '先填灵魂 id（soul）';
}

/** 运行前点名的判据（唯一一份，侧栏/操作台共吃，2026-09-30 用户定案；
 *  2026-10-01 按需唤醒翻新）：**页开着（哪怕休眠）=到场，不拦不叫醒**——轮到它
 *  发言时派工侧会自动 reload 唤醒（现在叫醒了等开演的几分钟里又冻回去，白醒）；
 *  只有标签页真没开的才拦。needed 由服务端 /seats/attendance 解析捎回，每项
 *  {actor, soul, bound, host?, online?, present?, askedOpen?, ledgerEmpty?}——
 *   · bound=''：角色账里从来没有这个灵魂 → 教他怎么绑；
 *   · bound='other' 且不在线：绑在别家宿主、那家没心跳 → 说明绑在谁家、
 *     两条路（开那边 / 改绑本宿主）；那家在线=到场，放行（信寄驿站对方格
 *     对方自取，设计内）；
 *   · bound='web' 且页开着（present，含休眠）：到场，放行；
 *   · bound='web' 且页没开：不拦不住——服务端已请后台开页，行里说真话
 *     （递出请台帧=等几秒再点；扩展没连=先开浏览器）。
 *  主Agent席页没开同样一行指导（收不了下发）。返回行数组（空=放行）。 */
export function offlineRollCall(seats, needed) {
  const list = Array.isArray(seats) ? seats : [];
  const absent = [];
  for (const s of list) {
    // present !== true 兼容旧视图（没带 present 字段）：不在线就照旧出指导行。
    if (s?.isMain && s.online === false && s.present !== true) {
      absent.push(`主Agent席（${s.siteLabel ?? s.site ?? '未知站点'}·${s.sidShort ?? ''}${s.title ? `·${s.title}` : ''}）网页没打开——主Agent任务的落点收不了下发：点开那张标签页，或在座席面板把主Agent席换到开着的会话`);
    }
  }
  for (const n of Array.isArray(needed) ? needed : []) {
    if (!n?.soul) continue;
    if (!n.bound) {
      absent.push(`缺少灵魂 ${n.soul}（@${n.actor}）：这个灵魂从未绑定任何会话——在浏览器开一张会话网页（哪家站点的都行），到座席面板那张席位卡上把他绑定上去`
        + `${n.ledgerEmpty ? '（角色账整个是空的：若他其实绑过，多半是投影中心没连上）' : ''}`);
    } else if (n.bound === 'other' && n.online === false) {
      absent.push(`灵魂 ${n.soul}（@${n.actor}）绑在 ${n.host} 宿主的会话上，那个宿主现在没打开——把 ${n.host} 打开，他就会来取信开演；如果不想用 ${n.host}，就在网页端，打开任意历史会话，在 web 座席面板操作，把 ${n.soul} 改绑到这里的会话上`);
    } else if (n.bound === 'web' && n.online === false && n.present !== true) {
      // 旧格式绑定（不知道哪家网站）与页没开两态各说各话；休眠页根本到不了这
      // （present=true 在上面就放行了）——到这的都是「标签页真没开」。
      if (n.siteKnown === false) {
        absent.push(`灵魂 ${n.soul}（@${n.actor}）绑定的会话没记是哪家网站（旧格式绑定），自动开页无从开起——先亲手打开那个会话所在网站的会话页（它一上线就自动认领），或在座席面板把 ${n.soul} 改绑到现在的会话（改绑即升级成新格式，往后就能自动开页）`);
      } else {
        absent.push(n.askedOpen
          ? `灵魂 ${n.soul}（@${n.actor}）绑定的会话网页没打开——已自动打开对应页面，但等了一会儿还没开出来：亲手开一下那个会话页看看（可能没登录或加载卡住），开后直接再点运行（休眠的页不用管，轮到它发言会自动唤醒）`
          : `灵魂 ${n.soul}（@${n.actor}）绑定的会话网页没打开，而且浏览器扩展没连上本地服务——先打开 Chrome（扩展连上服务后会自动去开对应页面），再点一次`);
      }
    }
  }
  return absent;
}

/** 点名缺席的总文案（唯一一份，侧栏/操作台共吃；行动词「运行/继续」由
 *  调用方给）。缺席行每灵魂一行带序号、行间空行（offlineRollCall 的行自带
 *  指导；侧栏 .mount-out 与操作台 <pre> 都是 pre-wrap，直接撑得起多行）。 */
export function attendanceRefusal(absent, action) {
  return `点名发现缺员，先照下面一行行把灵魂凑齐再${action}：\n\n`
    + absent.map((line, i) => `${i + 1}. ${line}`).join('\n\n');
}
