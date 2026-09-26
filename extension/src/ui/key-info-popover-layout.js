/**
 * Place the key-info tooltip so the arrow stays on the key when the card
 * changes height.
 *
 * `placement: 'top'` draws the arrow on the bottom edge (tooltip above the key).
 * Growth moves `top` up. `placement: 'bottom'` draws the arrow on the top edge
 * (tooltip below the key — what happens when Keyboard Reference sits on the
 * viewport's top edge). Growth leaves `top` alone and extends downward.
 * If the natural card does not fit on the arrow's side, flip when the other
 * side can hold it; otherwise scroll the settings block and keep the arrow edge
 * against the key.
 */

/**
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
 * @returns {{
 *   placement: 'top'|'bottom',
 *   left: number,
 *   top: number,
 *   usedH: number,
 *   settingsMaxHeight: number|null,
 *   arrowLeft: number
 * }}
 */
export function planKeyInfoPopoverLayout(metrics) {
  const margin = metrics.margin ?? 10;
  const gap = metrics.gap ?? 10;
  const minSettings = metrics.minSettings ?? 48;
  const targetTop = metrics.targetTop;
  const targetBottom = metrics.targetBottom;
  const targetCenterX = metrics.targetCenterX;
  const popW = Math.max(0, metrics.popW || 0);
  const popH = Math.max(0, metrics.popH || 0);
  const settingsH = Math.max(0, metrics.settingsH || 0);
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
  let settingsMaxHeight = null;
  let usedH = popH;
  if (popH > available + 0.5 && settingsH > 0) {
    const chrome = Math.max(0, popH - settingsH);
    const budget = available - chrome;
    settingsMaxHeight = Math.max(minSettings, budget);
    usedH = chrome + Math.min(settingsH, settingsMaxHeight);
  }

  const maxLeft = Math.max(margin, vw - margin - popW);
  const left = clamp(targetCenterX - popW / 2, margin, maxLeft);
  const top = placement === 'top'
    ? targetTop - gap - usedH
    : targetBottom + gap;
  const arrowLeft = clamp(targetCenterX - left - 9, 12, Math.max(12, popW - 24));

  return { placement, left, top, usedH, settingsMaxHeight, arrowLeft };
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
