/**
 * Coordinate-carrying pointer + mouse click sequence.
 *
 * Synthetic MouseEvent/PointerEvent init includes page/offset so players that
 * map seek position from offsetX (YouTube) still see a horizontal hit, not 0.
 *
 * @param {EventTarget|null|undefined} target
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} [buttons=1]
 * @returns {object}
 */
export function buildMouseEventInit(target, clientX, clientY, buttons = 1) {
  const x = Number.isFinite(clientX) ? clientX : 0;
  const y = Number.isFinite(clientY) ? clientY : 0;
  let offsetX = 0;
  let offsetY = 0;
  try {
    const r = target && typeof /** @type {any} */ (target).getBoundingClientRect === 'function'
      ? /** @type {any} */ (target).getBoundingClientRect()
      : null;
    if (r) {
      offsetX = x - r.left;
      offsetY = y - r.top;
    }
  } catch { /* ignore */ }
  let pageX = x;
  let pageY = y;
  try {
    pageX = x + (window.scrollX || window.pageXOffset || 0);
    pageY = y + (window.scrollY || window.pageYOffset || 0);
  } catch { /* ignore */ }
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: typeof window !== 'undefined' ? window : undefined,
    clientX: x,
    clientY: y,
    pageX,
    pageY,
    offsetX,
    offsetY,
    screenX: x,
    screenY: y,
    button: 0,
    buttons,
    detail: 1
  };
}

/**
 * @param {EventTarget|null|undefined} target
 * @param {number} clientX
 * @param {number} clientY
 */
export function dispatchClickSequence(target, clientX, clientY) {
  if (!target || typeof /** @type {any} */ (target).dispatchEvent !== 'function') return;

  const common = buildMouseEventInit(target, clientX, clientY, 1);
  const hasPointer = typeof window !== 'undefined' && typeof window.PointerEvent === 'function';

  if (hasPointer) {
    const pCommon = { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { target.dispatchEvent(new PointerEvent('pointerover', pCommon)); } catch { /* ignore */ }
    try { target.dispatchEvent(new PointerEvent('pointerenter', pCommon)); } catch { /* ignore */ }
    try { target.dispatchEvent(new PointerEvent('pointerdown', pCommon)); } catch { /* ignore */ }
  } else {
    try { target.dispatchEvent(new MouseEvent('pointerover', common)); } catch { /* ignore */ }
    try { target.dispatchEvent(new MouseEvent('pointerenter', common)); } catch { /* ignore */ }
    try { target.dispatchEvent(new MouseEvent('pointerdown', common)); } catch { /* ignore */ }
  }

  try { target.dispatchEvent(new MouseEvent('mouseover', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mouseenter', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mousemove', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mousedown', common)); } catch { /* ignore */ }

  const commonUp = buildMouseEventInit(target, clientX, clientY, 0);
  if (hasPointer) {
    const pUp = { ...commonUp, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { target.dispatchEvent(new PointerEvent('pointerup', pUp)); } catch { /* ignore */ }
  } else {
    try { target.dispatchEvent(new MouseEvent('pointerup', commonUp)); } catch { /* ignore */ }
  }
  try { target.dispatchEvent(new MouseEvent('mouseup', commonUp)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('click', commonUp)); } catch { /* ignore */ }
}
