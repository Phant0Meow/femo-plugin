// stop-intent.mjs — 薄 hook：从 mailbox 取走属于 zcode 的信（终局通知/主Agent轮次），
// 语义见 lib.mjs onStopIntent（注入政策注释在那里）。
import { relay } from './lib.mjs';
relay('stop-intent');
