/**
 * memory-store.mjs — 事件路由测试用的内存投影 store。
 *
 * 2026-09-25 生产三窗 JSONL 自存退役（projection-writer 移 mytrashbin，hub 是
 * 投影唯一数据面）后，路由→幕布的落点语义仍需测试钉住——本助手用公共层
 * projection-core 同一套分派器（createProjectionAppender/WindowLedger/chatRow）
 * 在内存里落行，接口与退役的 JSONL 版逐字同构（readWindow/listWindows/hasWindow）。
 */
import { importCore } from '../paths.mjs';

const { WindowLedger, createProjectionAppender, chatRow, actorKeyOf } = await importCore('projection-core.mjs');

// 观察期（2026-09-27 去导出）：CHAT_TYPE 仅内部 chat() 使用，导出面无消费方——
// 先收掉 export 观察，无恙后连注释删。
const CHAT_TYPE = 'femo/chat';

export function createMemoryStore({ now = () => new Date().toISOString() } = {}) {
  /** sid → { god, stage, actors: Map<actorKey, win> }；win = { rows, ledger } */
  const sessions = new Map();
  const mkWin = () => ({ rows: [], ledger: new WindowLedger() });
  const sessionOf = sid => {
    let s = sessions.get(sid);
    if (s === undefined) {
      s = { god: mkWin(), stage: mkWin(), actors: new Map() };
      sessions.set(sid, s);
    }
    return s;
  };

  const appendCore = createProjectionAppender({
    windowsOf: sid => sessionOf(sid),
    ledgerOf: win => win.ledger,
    keyOf: name => actorKeyOf(name), // actors Map 以消毒键存窗（命名法全等匹配）
    write: (win, type, data) => {
      win.rows.push({ seq: win.ledger.nextSeq(), ts: now(), type, data });
    },
  });

  function ensureWindows(sid, actorKeys = []) {
    const s = sessionOf(sid);
    for (const key of actorKeys) {
      const k = actorKeyOf(key);
      if (!s.actors.has(k)) s.actors.set(k, mkWin());
    }
    return { god: 'god', stage: 'stage', actors: [...s.actors.keys()] };
  }

  const append = (sid, type, data, opts = {}) => appendCore(sid, type, data, opts);

  const chat = (sid, text, fields = {}, opts = {}) => {
    const { type, data } = chatRow(CHAT_TYPE, { text, kind: 'notice', ...fields });
    return append(sid, type, data, opts);
  };

  function readWindow(sid, key, { afterSeq = 0 } = {}) {
    const s = sessions.get(sid);
    const win = key === 'god' ? s?.god : key === 'stage' ? s?.stage : s?.actors.get(actorKeyOf(key));
    return win ? win.rows.filter(r => r.seq > afterSeq) : [];
  }

  // 观察期（2026-09-27 注释退役）：listWindows/append 导出面零消费（append 仅内部
  // chat() 闭包在用），先收掉导出观察，无恙后连注释删。
  // function listWindows(sid) {
  //   const s = sessions.get(sid);
  //   if (s === undefined) return [];
  //   return ['god', 'stage', ...[...s.actors.keys()].map(k => `a:${k}`)];
  // }

  const hasWindow = (sid, actorKey) => sessions.get(sid)?.actors.has(actorKeyOf(actorKey)) ?? false;

  return { ensureWindows, chat, readWindow, hasWindow };
}
