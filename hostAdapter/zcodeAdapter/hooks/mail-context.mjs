// mail-context.mjs — 薄 hook：用户插话时向常驻引擎问 main 的FEMO内上下文（/cmd/mail_context，走 lib.mjs）。
// 只在FEMO 运行中返回内容；空闲时引擎返回空对象，不注入任何东西。
import { relay } from './lib.mjs';
relay('mail-context');
