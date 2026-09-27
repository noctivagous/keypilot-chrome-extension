/**
 * Viewport-aware placement for an anchored floating card (key-info tooltip,
 * Font Info / Lookup Word inspect popover, and similar).
 *
 * Prefer the side that can hold the natural height. If neither side can,
 * keep the arrow/edge against the target and shrink a scrollable region.
 *
 * `placement: 'top'` sits above the target (growth moves `top` up).
 * `placement: 'bottom'` sits below it (growth keeps `top` and extends down).
 */

/**
 * @param {{
 *   targetTop: number,
 *   targetBottom: number,
 *   targetCenterX: number,
 *   popW: number,
 *   popH: number,
 *   overflowH?: number,
 *   vw: number,
 *   vh: number,
 *   margin?: number,
 *   gap?: number,
 *   minOverflow?: number
 * }} metrics
 * @returns {{
 *   placement: 'top'|'bottom',
 *   left: number,
 *   top: number,
 *   usedH: number,
 *   overflowMaxHeight: number|null,
 *   arrowLeft: number
 * }}
 */
export function planAnchoredPopoverLayout(metrics) {
  const margin = metrics.margin ?? 10;
  const gap = metrics.gap ?? 10;
  const minOverflow = metrics.minOverflow ?? 48;
  const targetTop = metrics.targetTop;
  const targetBottom = metrics.targetBottom;
  const targetCenterX = metrics.targetCenterX;
  const popW = Math.max(0, metrics.popW || 0);
  const popH = Math.max(0, metrics.popH || 0);
  const overflowH = Math.max(0, metrics.overflowH || 0);
  const vw = Math.max(0, metrics.vw || 0);
  const vh = Math.max(0, metrics.vh || 0);

  const availableAbove = Math.max(0, targetTop - gap - margin);
  const availableBelow = Math.max(0, vh - targetBottom - gap - margin);
  const fits = (side, height) => height <= (side === 'top' ? availableAbove : availableBelow) + 0.5;

  let placement;
  if (fits('top', popH)) placement = 'top';
  else if (fits('bottom', popH)) placement = 'bottom';
  else placement = availableAbove >= availableBelow ? 'top' : 'bottom';

  const available = placement === 'top' ? availableAbove : availableBelow;
  let overflowMaxHeight = null;
  let usedH = popH;
  if (popH > available + 0.5 && overflowH > 0) {
    const chrome = Math.max(0, popH - overflowH);
    const budget = available - chrome;
    overflowMaxHeight = Math.max(minOverflow, budget);
    usedH = chrome + Math.min(overflowH, overflowMaxHeight);
  }

  const maxLeft = Math.max(margin, vw - margin - popW);
  const left = clamp(targetCenterX - popW / 2, margin, maxLeft);
  const top = placement === 'top'
    ? targetTop - gap - usedH
    : targetBottom + gap;
  const arrowLeft = clamp(targetCenterX - left - 9, 12, Math.max(12, popW - 24));

  return { placement, left, top, usedH, overflowMaxHeight, arrowLeft };
}

/**
 * Key-info tooltip planner (settings block is the shrinkable region).
 * @param {{
 *   targetTop: number,
 *   targetBottom: number,
 *   targetCenterX: number,
 *   popW: number,
 *   popH: number,
 *   settingsH?: number,
 *   vw: number,
 *   vh: number,
 *   margin?: number,
 *   gap?: number,
 *   minSettings?: number
 * }} metrics
 */
export function planKeyInfoPopoverLayout(metrics) {
  const plan = planAnchoredPopoverLayout({
    ...metrics,
    overflowH: metrics.settingsH,
    minOverflow: metrics.minSettings
  });
  return {
    placement: plan.placement,
    left: plan.left,
    top: plan.top,
    usedH: plan.usedH,
    settingsMaxHeight: plan.overflowMaxHeight,
    arrowLeft: plan.arrowLeft
  };
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
