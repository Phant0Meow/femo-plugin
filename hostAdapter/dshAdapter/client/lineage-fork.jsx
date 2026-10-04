import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CatalogDropdown, femoNativeCatalog, lineageCss, femoHiddenId } from './client-ui/catalog-dropdown'

/**
 * lineage-fork.jsx — 官方子代理目录的仿制钥匙（2026-09-26 刀⑧：新旧两把并成一把）。
 *
 * 本文件 fork 自 @deepseek-ai/dsh-client-ui-subagent SubagentHeaderLineage，唯一
 * 改动=按名字约定过滤 FEMO脚本机制产生的条目（femo-proj- 投影窗 / femo-actor-
 * Job×角色常驻执行体 / femo-node- 遗留节点子代理）；本体自发子代理逐字节官方行为。
 * 升级官方时需对照重放此 fork。
 *
 * 【刀⑧ 合并】原 lineage-fork.jsx（旧版=rc.2 快照，meow fork 0.1.6 用）与
 * lineage-fork-native.jsx（原生=0.1.3+ 用）两份 ~600 行逐字同构的 fork 并成一份：
 * 共享核（全部格式化/布局/键盘/目录渲染）只有一份，差异四处按
 * femoNativeCatalog() 参数化——
 *   1. 样式：旧版=rc.2 快照哈希表（A-xaeG_*）；原生=运行时反解官方注入的
 *      style 标签（附 0.1.3-alpha.2 实测回退表）——硬编码哈希在 0.1.3 失效
 *      曾是菜单渲染成"页面最右侧细竖条"的根因。
 *   2. 过滤：旧版=剥 femo-proj 条目与 femo-node 标签；原生=恒 ban
 *      femo-proj/femo-actor/femo-node（目录条目与 summary 两处口径一致）。
 *   3. count 变体 hideWhenZero：旧版缺省 false，原生缺省 true（过滤后无子代理
 *      整个触发器隐藏，与官方"真零子代理"行为一致）。
 *   4. SubagentHeaderLineage 特例：旧版=Femo 主会话只画斜杠（计数菜单让位给
 *      actions 区 count 座位）；原生=投影窗整行不渲染（视角跳转走视角菜单）。
 * 顺手修：旧版两处 join(' 路 ') 分隔符是编码事故，正字为 ' · '（与原生一致）。
 * 缺省翻转（用户拍板 2026-09-25）：window.__femoNative 问不到（fetch 失败或
 * 答非所问）时按新版处理——新宿主网络抖动不再拿到必坏旧件；旧宿主已退役，
 * 残余风险用户接受。翻转逻辑在 client.tsx 的问询分支（置 flag + 注册路径），
 * 本组件只认 flag：true=原生变体，false=旧版变体。
 * 【刀⑧ 收尾】CatalogDropdown 及其依赖全家已抽至 client-ui/catalog-dropdown.jsx，
 * 本文件只剩 SubagentHeaderLineage 面包屑并反向 import——视角菜单不再隔着 fork 借件。
 */

/**
 * Render one breadcrumb title together with its subagent navigation.
 * @param props - Breadcrumb title, session standard props, and catalog actions.
 * @returns An ordinary-title descendant count, or a title-and-chevron sibling switcher.
 */
export function SubagentHeaderLineage({ lineageSessionId, displayTitle, openTitle, useSessions, useSessionStatus, openChild, refresh, setCatalogOpen, t, }) {
    const summary = useSessions((state) => state.byId[lineageSessionId]);
    const parentId = summary?.origin === 'subagent' ? summary.parentId : undefined;
    const shared = { useSessions, useSessionStatus, openChild, refresh, setCatalogOpen, t };
    if (femoNativeCatalog()) {
        // 原生 fork：投影窗（god/stage）头部不渲染子代理导航——目录里它们本就
        // 被过滤，头部留白最干净；视角跳转走 femo 视角菜单。
        if (typeof lineageSessionId === 'string' && lineageSessionId.startsWith('femo-proj-')) {
            return null;
        }
    }
    else {
        // 旧版 fork 让位（2026-08-23 布局重排 v2）：FEMO脚本会话的面包屑区只留
        // 斜杠与名字，子代理导航全部让给 actions 区——
        //   投影窗（femo-proj- 前缀）→ 整个返回 null：骨架的段间 "/" 仍在，显示
        //     为「母名 /」，随后是 actions 区 order -20 的视角按钮（单槽语义）。
        //   Femo 主会话 → 只画一个 "/" 分隔符（主会话的斜杠是 separator 自带的，
        //     让位后需补上），计数菜单移到 client.tsx 的 femo-plugin-count 座位。
        //   其余会话 → 与官方行为逐字一致。
        const isFemoProj = femoHiddenId(lineageSessionId);
        const isFemoMain = !isFemoProj && summary?.agentPreset === 'femo-plugin' && parentId === undefined;
        if (isFemoProj)
            return null;
        if (isFemoMain)
            return _jsx("span", { className: lineageCss().separator, children: "/" });
    }
    if (parentId === undefined) {
        return (_jsx(CatalogDropdown, { rootSessionId: lineageSessionId, variant: "count", separator: true, ...shared }, lineageSessionId));
    }
    return (_jsxs(_Fragment, { children: [_jsx(CatalogDropdown, { rootSessionId: parentId, currentSessionId: lineageSessionId, variant: "switcher", displayTitle: displayTitle, ...openTitle === undefined ? {} : { openTitle }, ...shared }, lineageSessionId), openTitle === undefined && (_jsx(CatalogDropdown, { rootSessionId: lineageSessionId, variant: "count", ...shared }, lineageSessionId))] }));
}
//# sourceMappingURL=SubagentHeaderLineage.js.map
