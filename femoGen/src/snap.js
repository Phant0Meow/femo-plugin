// ═══════════════════════════════════════════════════════════════
// ═══ snap.js ═══ 拖拽吸附对齐（桌面端 onMM 与手机端 nodeDrag 共用一份定义）
// ═══════════════════════════════════════════════════════════════
// 纯几何计算，不依赖 React / DOM（可被 node 直接单测）。
//
// 对齐口径：**中心对中心**。画布上节点大小不一（action 100×56 / special 90×36 /
// module 110×66 / for_out 22×22），按左右边缘对齐会在视觉上错位，按中心对齐才整齐。
// 被拖节点的中心与其他每个节点的中心比较，X、Y 各自取最近的一个在阈值内吸附。
//
// 反馈：吸附命中时返回一条「中心连线」draw = { x1,y1,x2,y2 }，由画布从被拖节点
// 中心画虚线连到目标节点中心——一眼看出是跟谁对齐了。
//
// 坐标口径：nodes 的 x/y 是画布坐标；threshold 也按画布坐标算
// （调用方用 屏幕像素 / 当前缩放 换算，保证不同缩放下手感一致）。

/** 吸附阈值（屏幕像素，按缩放折算成画布单位后比较） */
const SNAP_PX = 6;

// ⚠️ 与 common.jsx 的 getNodeSize 同规则（此处是纯计算副本：snap.js 不依赖 JSX，
//    才能被 Node 直接单测）。改节点尺寸规则时两处要一起改。
function getNodeSize(node) {
  if (node.type === 'special') return { w: 90, h: 36 };
  if (node.type === 'for_out') return { w: 22, h: 22 };
  if (node.type === 'par_out') return { w: 90, h: 36 };
  if (node.type === 'module') return { w: 110, h: 66 };
  if (node.type === 'position') return { w: 90, h: 36 };
  return { w: 100, h: 56 };
}

/** 节点中心 */
function centerOf(node) {
  const s = getNodeSize(node);
  return { cx: node.x + s.w / 2, cy: node.y + s.h / 2 };
}

/**
 * @param {{x:number,y:number,id?:string,type?:string}} dragged 被拖节点（含未吸附的新位置）
 * @param {Array} nodes 全量节点
 * @param {number} threshold 画布坐标下的吸附阈值
 * @returns {{x:number,y:number,draw:{x1:number,y1:number,x2:number,y2:number}|null}}
 *          x/y = 吸附后的节点左上角；draw = 命中时的中心连线（画布坐标），未命中为 null
 */
function computeSnap(dragged, nodes, threshold) {
  const th = threshold > 0 ? threshold : 0;
  // 阈值 0 = 关闭吸附（不加这一步的话 <= 0 会把"完全重合"也当吸附）
  if (th === 0) return { x: dragged.x, y: dragged.y, draw: null };

  const mySize = getNodeSize(dragged);
  const myCx = dragged.x + mySize.w / 2;
  const myCy = dragged.y + mySize.h / 2;

  let bestX = null; // { diff, cx, cy }
  let bestY = null; // { diff, cx, cy }
  for (const n of nodes || []) {
    if (!n || n.id === dragged.id) continue;
    const { cx, cy } = centerOf(n);

    const dx = cx - myCx;
    if (Math.abs(dx) <= th && (bestX === null || Math.abs(dx) < Math.abs(bestX.diff))) {
      bestX = { diff: dx, cx, cy };
    }
    const dy = cy - myCy;
    if (Math.abs(dy) <= th && (bestY === null || Math.abs(dy) < Math.abs(bestY.diff))) {
      bestY = { diff: dy, cx, cy };
    }
  }

  const x = dragged.x + (bestX ? bestX.diff : 0);
  const y = dragged.y + (bestY ? bestY.diff : 0);

  // 中心连线：起点=吸附后的我的中心；终点=命中的那个节点中心
  // 注意：两节点中心完全重合时这条线会退化成 0 长度（视觉上就是个点，属正常）
  let draw = null;
  if (bestX || bestY) {
    draw = {
      x1: x + mySize.w / 2,
      y1: y + mySize.h / 2,
      x2: bestX ? bestX.cx : x + mySize.w / 2,
      y2: bestY ? bestY.cy : y + mySize.h / 2,
    };
  }

  return { x, y, draw };
}

/**
 * 拖拽中通用的"先吸附、再联动"收尾：手机端 nodeDrag 与桌面端 onMM 共用。
 * @param {Array} nodes 全量节点
 * @param {object} draggedNode 被拖节点（含未吸附的新位置）
 * @param {number} newX/newY 未吸附的新位置
 * @param {number} threshold 画布坐标下的吸附阈值
 * @param {(nodes:Array, dragged:object, x:number, y:number)=>Array} applyLinkage
 *        联动函数（applyForLinkage：拖 FOR 带 for_out、拖 for_out 带 FOR）
 */
function snapAndLink(nodes, draggedNode, newX, newY, threshold, applyLinkage) {
  const snap = computeSnap({ ...draggedNode, x: newX, y: newY }, nodes, threshold);
  const next = applyLinkage(nodes, draggedNode, snap.x, snap.y);
  return { nodes: next, draw: snap.draw };
}

export { SNAP_PX, getNodeSize, centerOf, computeSnap, snapAndLink };
