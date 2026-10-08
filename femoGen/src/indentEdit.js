// ═══════════════════════════════════════════════════════════════
// ═══ indentEdit.js ═══
// ═══════════════════════════════════════════════════════════════

// 编辑器 Tab / Shift+Tab 缩进的核心计算（2026-10-05）：
// 给定文本、选区与方向，算出「哪些行增减一级缩进、文本变成什么样、选区落到哪」。
// 纯计算件，不碰 DOM——DOM 应用层在 femoPreview.jsx 的按键处理里，
// 本文件保持可被 Node 单测直接覆盖（developer/tests/femogen-indent.test.mjs）。
//
// 规则：选中若干行按 Tab 逐行加一级缩进；Shift+Tab 整块统一左移——先量出
// 选区内非空行的最浅行首空白，每行减掉同样多的字符（至多 4），层级差原样保留
// （2026-10-05 用户拍板，替代逐行各自砍的旧法）；无选区时 Tab 在光标处插入
// 一级缩进。加缩进顺当前行风格：行首已有 Tab 用一个 Tab，否则 4 空格。

export function editIndent(text, selStart, selEnd, outdent) {
  const noSel = selStart === selEnd;

  // 受影响区间 [from, to)：选区触及的每一行（不含末行自己的换行符）。
  // 选区结尾恰好是行首（把上一行的换行符选了进来）时，这个空行不计入——与主流编辑器一致。
  const from = text.lastIndexOf('\n', selStart - 1) + 1;
  let to = text.indexOf('\n', selEnd);
  if (to === -1) to = text.length;
  if (selEnd > selStart && text[selEnd - 1] === '\n') to = selEnd - 1;
  const segment = text.slice(from, to);
  const lines = segment.split('\n');

  let newLines;
  let firstDelta = 0; // 首行的增减量：光标与单行选区随它平移
  let totalDelta = 0; // 整块的增减量：多行选区末端随它平移
  if (outdent) {
    // 统一左移（2026-10-05 用户拍板翻案）：先量出选区内所有非空行的最浅行首空白，
    // 本次左移量 Δ=min(最浅值, 4)，每行减掉同样多的字符——行与行之间的层级差
    // 原样保留。逐行各自砍到 4 格的做法会压扁浅层级（2 空格层级的剧本一按全顶格），
    // 退役。空行不参与定浅度（否则选区带一个空行就永远减不动）。
    let shallow = Infinity;
    for (const line of lines) {
      if (line.trim() === '') continue;
      let w = 0;
      while (w < line.length && (line[w] === ' ' || line[w] === '\t')) w++;
      if (w < shallow) shallow = w;
    }
    if (shallow === Infinity || shallow === 0) return null; // 选区内没有可减的缩进
    const delta = Math.min(shallow, 4);
    newLines = lines.map((line) => {
      let cut = 0;
      while (cut < delta && cut < line.length && (line[cut] === ' ' || line[cut] === '\t')) cut++;
      return line.slice(cut);
    });
    firstDelta = newLines[0].length - lines[0].length;
    totalDelta = newLines.join('\n').length - segment.length;
  } else if (noSel) {
    // 光标处插入一级缩进，顺当前行已有风格
    const unit = lines[0].slice(0, selStart - from).includes('\t') ? '\t' : '    ';
    newLines = [lines[0].slice(0, selStart - from) + unit + lines[0].slice(selStart - from)];
    firstDelta = unit.length;
    totalDelta = unit.length;
  } else {
    newLines = lines.map((line) => (line.startsWith('\t') ? '\t' : '    ') + line);
    firstDelta = (lines[0].startsWith('\t') ? '\t' : '    ').length;
    totalDelta = newLines.join('\n').length - segment.length;
  }

  const newSegment = newLines.join('\n');
  if (newSegment === segment) return null; // 无可增减（如顶格行上 Shift+Tab）：调用方只拦焦点跳转，不动文本

  const newText = text.slice(0, from) + newSegment + text.slice(to);

  // 新选区：无选区=光标随增减平移；单行选区=原选区随增减平移；多行选区=整块行选中
  let selA; let selB;
  if (lines.length === 1) {
    const hi = from + newSegment.length;
    selA = Math.max(from, Math.min(selStart + firstDelta, hi));
    selB = noSel ? selA : Math.max(from, Math.min(selEnd + firstDelta, hi));
  } else {
    selA = from;
    selB = to + totalDelta;
  }
  // insert=要写进 [from, to) 区间的新段。它在新文本里占据 [from, from+新段长度)，
  // 不能从 newText 上按 [from, to) 切——缩进后文本变长、反推出节会短一截（真页实测踩过）。
  return { text: newText, selStart: selA, selEnd: selB, from, to, insert: newSegment };
}
