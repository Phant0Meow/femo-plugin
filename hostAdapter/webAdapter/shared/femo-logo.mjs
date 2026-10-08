/**
 * shared/femo-logo.mjs — FEMO 品牌 logo SVG（唯一一份，2026-09-29 收编）。
 *
 * viewBox 以 logo 主体中心 (200,200) 取框（y=16 高=368）——旧框 y=30 高=364
 * 中心在 212，画出来主体偏上（悬浮球实测截图校准，2026-09-28；console/侧栏
 * 此前各内嵌一份旧框副本，已随本件归一）。颜色可参（操作台/侧栏品牌绿、
 * 悬浮球亮绿），mask id 加前缀防文档级冲突。
 *
 * ⚠️ 悬浮球（extension/bubble.js，content script 经典脚本进不了 ESM）留同形
 * 镜像并互相指名——改 path/viewBox 两处同改。
 */

export function femoLogoSvg({ color = '#6FBF3A', maskId = 'femo-logo-cut' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="27.169998168945312 16 345.6600341796875 368">
  <defs>
    <mask id="${maskId}">
      <rect x="0" y="0" width="400" height="480" fill="#ffffff"/>
      <path d="M 187.5 200 L 212.5 200 L 262.5 359 L 200 384 L 137.5 359 Z" fill="none" stroke="#000000" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="200" cy="200" r="15" fill="#000000"/>
      <line x1="35" y1="100" x2="200" y2="75" stroke="#000000" stroke-width="16" stroke-linecap="round"/>
      <line x1="200" y1="75" x2="365" y2="100" stroke="#000000" stroke-width="16" stroke-linecap="round"/>
      <line x1="30.92" y1="107.11" x2="91.75" y2="262.5" stroke="#000000" stroke-width="16" stroke-linecap="round"/>
      <line x1="369.08" y1="107.11" x2="308.25" y2="262.5" stroke="#000000" stroke-width="16" stroke-linecap="round"/>
    </mask>
  </defs>
  <g mask="url(#${maskId})">
    <polygon points="200,40 338.56,120 338.56,280 200,360 61.44,280 61.44,120" fill="none" stroke="${color}" stroke-width="32" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="200" y1="200" x2="61.44" y2="120" stroke="${color}" stroke-width="32" stroke-linecap="round"/>
    <line x1="200" y1="200" x2="338.56" y2="120" stroke="${color}" stroke-width="32" stroke-linecap="round"/>
    <path d="M 187.5 200 L 212.5 200 L 262.5 359 L 200 384 L 137.5 359 Z" fill="${color}"/>
    <path d="M 75.78 197.79 L 37.17 105.58 L 135.99 93.53 L 68.63 132.43 L 75.78 120 Z" fill="${color}"/>
    <path d="M 324.22 197.79 L 362.83 105.58 L 264.01 93.53 L 331.37 132.43 L 324.22 120 Z" fill="${color}"/>
  </g>
  <circle cx="200" cy="200" r="30" fill="none" stroke="${color}" stroke-width="32"/>
</svg>`;
}
