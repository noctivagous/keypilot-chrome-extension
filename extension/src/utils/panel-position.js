/**
 * Generalized fixed-panel positioning for KeyPilot UI chrome.
 *
 * Shared by the floating keyboard reference, control strip, and future panels:
 * - Viewport clamping with a consistent margin (panel never flush to the edge)
 * - Snap targets: 4 corners + center of each edge
 * - Anchor-based positions that re-resolve on resize / different viewports
 * - Free (left/top) positions that reclamp on apply
 * - Pointer drag with magnetic snap on release
 *
 * Position state is a plain object suitable for chrome.storage:
 *   { left?: number, top?: number, anchor?: PanelAnchor|null }
 */

/** Default inset from the viewport edge (matches existing keyboard drag clamp). */
export const PANEL_POSITION_MARGIN_PX = 8;

/** Distance (px) within which release snaps to a corner / edge center. */
export const PANEL_SNAP_THRESHOLD_PX = 56;

/** Ignore tiny pointer jitter before treating a gesture as a drag. */
export const PANEL_DRAG_MOVE_THRESHOLD_PX = 3;

/**
 * Named snap / dock anchors.
 * @typedef {'top-left'|'top-center'|'top-right'|'middle-left'|'middle-right'|'bottom-left'|'bottom-center'|'bottom-right'} PanelAnchor
 */

/** @type {readonly PanelAnchor[]} */
export const PANEL_ANCHORS = Object.freeze([
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
]);

/**
 * @typedef {{
 *   left?: number,
 *   top?: number,
 *   anchor?: PanelAnchor|string|null
 * }} PanelPositionState
 */

/**
 * @typedef {{
 *   left: number,
 *   top: number,
 *   width: number,
 *   height: number,
 *   anchor?: PanelAnchor|null
 * }} PanelBox
 */

/**
 * @param {any} raw
 * @returns {PanelAnchor|null}
 */
export function normalizePanelAnchor(raw) {
  if (typeof raw !== 'string') return null;
  const a = raw.trim();
  return PANEL_ANCHORS.includes(/** @type {PanelAnchor} */ (a))
    ? /** @type {PanelAnchor} */ (a)
    : null;
}

/**
 * @param {any} raw
 * @param {PanelPositionState|null} [fallback]
 * @returns {PanelPositionState|null}
 */
export function normalizePanelPositionState(raw, fallback = null) {
  const fb = fallback && typeof fallback === 'object' ? fallback : null;
  if (!raw || typeof raw !== 'object') {
    return fb
      ? {
          left: Number.isFinite(fb.left) ? fb.left : undefined,
          top: Number.isFinite(fb.top) ? fb.top : undefined,
          anchor: normalizePanelAnchor(fb.anchor)
        }
      : null;
  }
  const left = Number(raw.left);
  const top = Number(raw.top);
  const anchor = normalizePanelAnchor(raw.anchor);
  const hasLeft = Number.isFinite(left);
  const hasTop = Number.isFinite(top);
  if (!anchor && !hasLeft && !hasTop) {
    return fb
      ? {
          left: Number.isFinite(fb.left) ? fb.left : undefined,
          top: Number.isFinite(fb.top) ? fb.top : undefined,
          anchor: normalizePanelAnchor(fb.anchor)
        }
      : null;
  }
  /** @type {PanelPositionState} */
  const out = {};
  if (hasLeft) out.left = left;
  if (hasTop) out.top = top;
  if (anchor) out.anchor = anchor;
  else if (raw.anchor === null) out.anchor = null;
  return out;
}

/**
 * @param {{ width?: number, height?: number }|null} [opts]
 * @returns {{ width: number, height: number }}
 */
export function getViewportSize(opts = null) {
  // Prefer clientWidth/Height (layout viewport, excludes classic scrollbars) so
  // right/bottom clamps match the visible page edge — not the scrollbar gutter.
  let fallbackW = 0;
  let fallbackH = 0;
  if (typeof window !== 'undefined') {
    try {
      const de = document.documentElement;
      // Prefer the larger of client/inner — client can be 0 at document_start.
      fallbackW = Math.max(de?.clientWidth || 0, window.innerWidth || 0);
      fallbackH = Math.max(de?.clientHeight || 0, window.innerHeight || 0);
    } catch {
      fallbackW = window.innerWidth || 0;
      fallbackH = window.innerHeight || 0;
    }
  }
  const w = opts && Number.isFinite(opts.width) ? opts.width : fallbackW;
  const h = opts && Number.isFinite(opts.height) ? opts.height : fallbackH;
  return {
    width: Math.max(0, Math.round(w) || 0),
    height: Math.max(0, Math.round(h) || 0)
  };
}

/**
 * Clamp a top-left position so the panel stays fully inside the viewport
 * with `margin` padding on every side (never flush to the edge / off-screen).
 *
 * @param {{
 *   left: number,
 *   top: number,
 *   width: number,
 *   height: number,
 *   margin?: number,
 *   viewportWidth?: number,
 *   viewportHeight?: number
 * }} args
 * @returns {{ left: number, top: number }}
 */
export function clampPanelPosition(args) {
  const margin = Math.max(0, Number(args.margin));
  const m = Number.isFinite(margin) ? margin : PANEL_POSITION_MARGIN_PX;
  const vp = getViewportSize({
    width: args.viewportWidth,
    height: args.viewportHeight
  });
  const w = Math.max(0, Number(args.width) || 0);
  const h = Math.max(0, Number(args.height) || 0);
  const maxLeft = Math.max(m, vp.width - w - m);
  const maxTop = Math.max(m, vp.height - h - m);
  const left = Number(args.left);
  const top = Number(args.top);
  return {
    left: Math.max(m, Math.min(Number.isFinite(left) ? left : m, maxLeft)),
    top: Math.max(m, Math.min(Number.isFinite(top) ? top : m, maxTop))
  };
}

/**
 * Pixel position for a named anchor given panel size + viewport.
 *
 * @param {PanelAnchor|string|null|undefined} anchor
 * @param {{
 *   width: number,
 *   height: number,
 *   margin?: number,
 *   viewportWidth?: number,
 *   viewportHeight?: number
 * }} size
 * @returns {{ left: number, top: number, anchor: PanelAnchor|null }}
 */
export function positionForAnchor(anchor, size) {
  const a = normalizePanelAnchor(anchor);
  const margin = Math.max(0, Number.isFinite(Number(size.margin)) ? Number(size.margin) : PANEL_POSITION_MARGIN_PX);
  const vp = getViewportSize({
    width: size.viewportWidth,
    height: size.viewportHeight
  });
  const w = Math.max(0, Number(size.width) || 0);
  const h = Math.max(0, Number(size.height) || 0);

  const leftMin = margin;
  const topMin = margin;
  const leftMax = Math.max(margin, vp.width - w - margin);
  const topMax = Math.max(margin, vp.height - h - margin);
  const leftCenter = Math.round((vp.width - w) / 2);
  const topCenter = Math.round((vp.height - h) / 2);

  let left = leftMin;
  let top = topMin;

  switch (a) {
    case 'top-left':
      left = leftMin;
      top = topMin;
      break;
    case 'top-center':
      left = leftCenter;
      top = topMin;
      break;
    case 'top-right':
      left = leftMax;
      top = topMin;
      break;
    case 'middle-left':
      left = leftMin;
      top = topCenter;
      break;
    case 'middle-right':
      left = leftMax;
      top = topCenter;
      break;
    case 'bottom-left':
      left = leftMin;
      top = topMax;
      break;
    case 'bottom-center':
      left = leftCenter;
      top = topMax;
      break;
    case 'bottom-right':
      left = leftMax;
      top = topMax;
      break;
    default:
      left = leftMin;
      top = topMin;
      return { left, top, anchor: null };
  }

  const clamped = clampPanelPosition({
    left,
    top,
    width: w,
    height: h,
    margin,
    viewportWidth: vp.width,
    viewportHeight: vp.height
  });
  return { left: clamped.left, top: clamped.top, anchor: a };
}

/**
 * All snap targets (corners + edge centers) for the current viewport/size.
 *
 * @param {{
 *   width: number,
 *   height: number,
 *   margin?: number,
 *   viewportWidth?: number,
 *   viewportHeight?: number
 * }} size
 * @returns {Array<{ anchor: PanelAnchor, left: number, top: number }>}
 */
export function getPanelSnapTargets(size) {
  /** @type {Array<{ anchor: PanelAnchor, left: number, top: number }>} */
  const out = [];
  for (const anchor of PANEL_ANCHORS) {
    const p = positionForAnchor(anchor, size);
    if (p.anchor) {
      out.push({ anchor: p.anchor, left: p.left, top: p.top });
    }
  }
  return out;
}

/**
 * Nearest snap target within threshold, or null if none close enough.
 *
 * @param {{
 *   left: number,
 *   top: number,
 *   width: number,
 *   height: number,
 *   margin?: number,
 *   threshold?: number,
 *   viewportWidth?: number,
 *   viewportHeight?: number
 * }} args
 * @returns {{ anchor: PanelAnchor, left: number, top: number, distance: number }|null}
 */
export function findNearestPanelSnap(args) {
  const threshold = Math.max(
    0,
    Number.isFinite(Number(args.threshold)) ? Number(args.threshold) : PANEL_SNAP_THRESHOLD_PX
  );
  const targets = getPanelSnapTargets(args);
  let best = null;
  for (const t of targets) {
    const dx = t.left - args.left;
    const dy = t.top - args.top;
    const d = Math.hypot(dx, dy);
    if (d <= threshold && (!best || d < best.distance)) {
      best = { ...t, distance: d };
    }
  }
  return best;
}

/**
 * Resolve a stored position into concrete left/top (and optional anchor).
 * Prefers anchor when present so layout adapts across viewport sizes.
 *
 * @param {PanelPositionState|null|undefined} stored
 * @param {{
 *   width: number,
 *   height: number,
 *   margin?: number,
 *   defaultAnchor?: PanelAnchor|string|null,
 *   viewportWidth?: number,
 *   viewportHeight?: number
 * }} size
 * @returns {{ left: number, top: number, anchor: PanelAnchor|null }}
 */
export function resolvePanelPosition(stored, size) {
  const margin = Math.max(0, Number.isFinite(Number(size.margin)) ? Number(size.margin) : PANEL_POSITION_MARGIN_PX);
  const w = Math.max(0, Number(size.width) || 0);
  const h = Math.max(0, Number(size.height) || 0);
  const state = normalizePanelPositionState(stored);
  const defaultAnchor = normalizePanelAnchor(size.defaultAnchor);

  if (state?.anchor) {
    return positionForAnchor(state.anchor, {
      width: w,
      height: h,
      margin,
      viewportWidth: size.viewportWidth,
      viewportHeight: size.viewportHeight
    });
  }

  if (state && Number.isFinite(state.left) && Number.isFinite(state.top)) {
    const clamped = clampPanelPosition({
      left: /** @type {number} */ (state.left),
      top: /** @type {number} */ (state.top),
      width: w,
      height: h,
      margin,
      viewportWidth: size.viewportWidth,
      viewportHeight: size.viewportHeight
    });
    return { left: clamped.left, top: clamped.top, anchor: null };
  }

  if (defaultAnchor) {
    return positionForAnchor(defaultAnchor, {
      width: w,
      height: h,
      margin,
      viewportWidth: size.viewportWidth,
      viewportHeight: size.viewportHeight
    });
  }

  const clamped = clampPanelPosition({
    left: margin,
    top: margin,
    width: w,
    height: h,
    margin,
    viewportWidth: size.viewportWidth,
    viewportHeight: size.viewportHeight
  });
  return { left: clamped.left, top: clamped.top, anchor: null };
}

/**
 * Convert bottom/right/centered layout into an explicit fixed top/left box
 * so free drag can pin the panel anywhere.
 *
 * @param {HTMLElement} panel
 * @param {{ pinWidth?: boolean, pinHeight?: boolean }} [opts]
 * @returns {PanelBox}
 */
export function pinPanelGeometry(panel, opts = {}) {
  const pinWidth = opts.pinWidth !== false;
  const pinHeight = opts.pinHeight === true;
  const rect = panel.getBoundingClientRect();
  const s = panel.style;
  s.position = 'fixed';
  s.transform = 'none';
  try { s.webkitTransform = 'none'; } catch { /* ignore */ }
  // Never set the `inset` shorthand after left/top — it resets all four sides to auto.
  s.right = 'auto';
  s.bottom = 'auto';
  s.left = `${rect.left}px`;
  s.top = `${rect.top}px`;
  if (pinWidth) {
    s.width = `${rect.width}px`;
  }
  // Only force height when requested (most strips/panels size height via CSS).
  if (pinHeight) {
    s.height = `${rect.height}px`;
  }
  s.margin = '0';
  s.boxSizing = 'border-box';
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

/**
 * Measure a panel's layout box. Prefer offset* (layout) over getBoundingClientRect
 * so a display:none / not-yet-laid-out pass can still fall back to scroll size.
 * @param {HTMLElement} panel
 * @returns {{ width: number, height: number }}
 */
function measurePanelSize(panel) {
  let width = 0;
  let height = 0;
  try {
    width = panel.offsetWidth || 0;
    height = panel.offsetHeight || 0;
  } catch { /* ignore */ }
  if (width <= 0 || height <= 0) {
    try {
      const rect = panel.getBoundingClientRect();
      if (width <= 0) width = rect.width || 0;
      if (height <= 0) height = rect.height || 0;
    } catch { /* ignore */ }
  }
  // Content-sized fallback when the box is still collapsing (common before keyboard paint).
  if (width <= 0) {
    try { width = panel.scrollWidth || 0; } catch { /* ignore */ }
  }
  if (height <= 0) {
    try { height = panel.scrollHeight || 0; } catch { /* ignore */ }
  }
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * Write fixed left/top onto the panel (never use the `inset` shorthand afterward).
 * @param {HTMLElement} panel
 * @param {{ left: number, top: number, anchor?: PanelAnchor|null }} resolved
 * @param {{ pinSize?: boolean, width?: number, height?: number }} [opts]
 */
function writePanelPosition(panel, resolved, opts = {}) {
  const s = panel.style;
  s.position = 'fixed';
  s.transform = 'none';
  try { s.webkitTransform = 'none'; } catch { /* ignore */ }
  s.right = 'auto';
  s.bottom = 'auto';
  s.left = `${Math.round(resolved.left)}px`;
  s.top = `${Math.round(resolved.top)}px`;
  s.margin = '0';
  if (opts.pinSize) {
    if (opts.width > 0) s.width = `${Math.round(opts.width)}px`;
    if (opts.height > 0) s.height = `${Math.round(opts.height)}px`;
    s.maxWidth = 'none';
    s.maxHeight = 'none';
  }
  try {
    if (resolved.anchor) panel.setAttribute('data-kp-panel-anchor', resolved.anchor);
    else panel.removeAttribute('data-kp-panel-anchor');
  } catch { /* ignore */ }
}

/**
 * Apply a resolved (or stored) position to a fixed panel element.
 *
 * Always remeasures after writing and reclamps so a first pass with height=0
 * (pre-layout) cannot leave the panel hanging below the viewport once content paints.
 *
 * @param {HTMLElement} panel
 * @param {PanelPositionState|{ left: number, top: number, anchor?: PanelAnchor|null }|null|undefined} position
 * @param {{
 *   margin?: number,
 *   defaultAnchor?: PanelAnchor|string|null,
 *   pinSize?: boolean,
 *   width?: number,
 *   height?: number,
 *   fallbackWidth?: number,
 *   fallbackHeight?: number
 * }} [options]
 * @returns {{ left: number, top: number, anchor: PanelAnchor|null }}
 */
export function applyPanelPosition(panel, position, options = {}) {
  if (!panel || !panel.style) {
    return { left: 0, top: 0, anchor: null };
  }

  const measured = measurePanelSize(panel);
  let width = Number.isFinite(options.width) ? /** @type {number} */ (options.width) : measured.width;
  let height = Number.isFinite(options.height) ? /** @type {number} */ (options.height) : measured.height;
  const margin = Math.max(0, Number.isFinite(Number(options.margin)) ? Number(options.margin) : PANEL_POSITION_MARGIN_PX);

  // Unlaid-out panels report 0×0. Using height 0 makes maxTop ≈ vh − margin, so a free
  // top (or bottom-* anchor) lands at the bottom edge and then grows off-screen.
  // Prefer explicit fallbacks / conservative estimates for the first clamp pass.
  const fallbackW = Number.isFinite(options.fallbackWidth) ? options.fallbackWidth : 0;
  const fallbackH = Number.isFinite(options.fallbackHeight) ? options.fallbackHeight : 0;
  if (width < 32) width = fallbackW > 0 ? fallbackW : 320;
  if (height < 32) height = fallbackH > 0 ? fallbackH : 160;

  let resolved = resolvePanelPosition(position, {
    width,
    height,
    margin,
    defaultAnchor: options.defaultAnchor
  });

  writePanelPosition(panel, resolved, {
    pinSize: options.pinSize,
    width,
    height
  });

  // Second pass: live geometry after styles apply. Fixes free positions that were
  // saved/applied while the panel still had height 0 (top ≈ vh − margin → offscreen).
  try {
    const live = measurePanelSize(panel);
    const liveW = live.width || width;
    const liveH = live.height || height;
    if (liveW > 0 && liveH > 0) {
      const state = normalizePanelPositionState(position);
      const anchor = normalizePanelAnchor(state?.anchor) || normalizePanelAnchor(resolved.anchor);
      if (anchor) {
        resolved = positionForAnchor(anchor, {
          width: liveW,
          height: liveH,
          margin
        });
      } else {
        const left = Number.isFinite(resolved.left) ? resolved.left : margin;
        const top = Number.isFinite(resolved.top) ? resolved.top : margin;
        const clamped = clampPanelPosition({
          left,
          top,
          width: liveW,
          height: liveH,
          margin
        });
        resolved = { left: clamped.left, top: clamped.top, anchor: null };
      }
      writePanelPosition(panel, resolved, {
        pinSize: options.pinSize,
        width: liveW,
        height: liveH
      });

      // Final safety: if the painted rect still spills past the viewport, pin it.
      const painted = panel.getBoundingClientRect();
      const vp = getViewportSize();
      const spills =
        painted.bottom > vp.height - margin + 1 ||
        painted.right > vp.width - margin + 1 ||
        painted.top < margin - 1 ||
        painted.left < margin - 1;
      if (spills && painted.width > 0 && painted.height > 0) {
        const fixed = clampPanelPosition({
          left: painted.left,
          top: painted.top,
          width: painted.width,
          height: painted.height,
          margin
        });
        resolved = {
          left: fixed.left,
          top: fixed.top,
          anchor: anchor || null
        };
        // If we had to shove a free position, drop the stale anchor so next apply uses left/top.
        if (!anchor) resolved.anchor = null;
        writePanelPosition(panel, resolved);
      }
    }
  } catch { /* ignore */ }

  return resolved;
}

/**
 * Build a storable position after a drag ends (optional magnetic snap).
 *
 * @param {{
 *   left: number,
 *   top: number,
 *   width: number,
 *   height: number,
 *   margin?: number,
 *   snapThreshold?: number,
 *   snap?: boolean
 * }} args
 * @returns {PanelPositionState & { left: number, top: number }}
 */
export function finalizePanelDragPosition(args) {
  const margin = Math.max(0, Number.isFinite(Number(args.margin)) ? Number(args.margin) : PANEL_POSITION_MARGIN_PX);
  const snapEnabled = args.snap !== false;
  const clamped = clampPanelPosition({
    left: args.left,
    top: args.top,
    width: args.width,
    height: args.height,
    margin
  });

  if (snapEnabled) {
    const snap = findNearestPanelSnap({
      left: clamped.left,
      top: clamped.top,
      width: args.width,
      height: args.height,
      margin,
      threshold: args.snapThreshold
    });
    if (snap) {
      return {
        left: Math.round(snap.left),
        top: Math.round(snap.top),
        anchor: snap.anchor
      };
    }
  }

  return {
    left: Math.round(clamped.left),
    top: Math.round(clamped.top),
    anchor: null
  };
}

/**
 * Make `handle` drag `panel` with viewport margin clamp + optional snap on release.
 *
 * @param {HTMLElement} panel
 * @param {HTMLElement} handle
 * @param {{
 *   margin?: number,
 *   snapThreshold?: number,
 *   snap?: boolean,
 *   moveThresholdPx?: number,
 *   excludeSelector?: string,
 *   pinWidth?: boolean,
 *   pinHeight?: boolean,
 *   cursorGrab?: string,
 *   cursorGrabbing?: string,
 *   onMoveStart?: () => void,
 *   onMove?: (box: { left: number, top: number }) => void,
 *   onMoveEnd?: (state: PanelPositionState & { left: number, top: number, moved: boolean }) => void
 * }} [options]
 * @returns {{ dispose: () => void }|null}
 */
export function makePanelDraggable(panel, handle, options = {}) {
  if (!panel || !(panel instanceof Element) || !handle || !(handle instanceof Element)) {
    return null;
  }

  // Avoid double-attaching on the same handle.
  try {
    if (handle.dataset && handle.dataset.kpPanelDraggable === '1') {
      return handle.__kpPanelDragApi || null;
    }
  } catch { /* ignore */ }

  const margin = Math.max(0, Number.isFinite(Number(options.margin)) ? Number(options.margin) : PANEL_POSITION_MARGIN_PX);
  const snapThreshold = Math.max(
    0,
    Number.isFinite(Number(options.snapThreshold)) ? Number(options.snapThreshold) : PANEL_SNAP_THRESHOLD_PX
  );
  const moveThreshold = Math.max(
    0,
    Number.isFinite(Number(options.moveThresholdPx)) ? Number(options.moveThresholdPx) : PANEL_DRAG_MOVE_THRESHOLD_PX
  );
  const snapEnabled = options.snap !== false;
  const pinWidth = options.pinWidth !== false;
  const pinHeight = options.pinHeight === true;
  const excludeSelector = typeof options.excludeSelector === 'string' && options.excludeSelector
    ? options.excludeSelector
    : '';
  const cursorGrab = options.cursorGrab || 'grab';
  const cursorGrabbing = options.cursorGrabbing || 'grabbing';

  /** @type {{ startX: number, startY: number, originLeft: number, originTop: number, pointerId: number, moved: boolean }|null} */
  let dragState = null;

  const measure = () => {
    const rect = panel.getBoundingClientRect();
    return {
      width: panel.offsetWidth || rect.width || 0,
      height: panel.offsetHeight || rect.height || 0
    };
  };

  const onPointerMove = (e) => {
    if (!dragState || !panel.isConnected) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (!dragState.moved) {
      if (Math.abs(dx) < moveThreshold && Math.abs(dy) < moveThreshold) return;
      dragState.moved = true;
      try { handle.style.cursor = cursorGrabbing; } catch { /* ignore */ }
      try { options.onMoveStart?.(); } catch { /* ignore */ }
    }
    const size = measure();
    const next = clampPanelPosition({
      left: dragState.originLeft + dx,
      top: dragState.originTop + dy,
      width: size.width,
      height: size.height,
      margin
    });
    panel.style.left = `${next.left}px`;
    panel.style.top = `${next.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    try { panel.removeAttribute('data-kp-panel-anchor'); } catch { /* ignore */ }
    try { options.onMove?.(next); } catch { /* ignore */ }
  };

  const endDrag = (e) => {
    if (!dragState) return;
    const state = dragState;
    const pointerId = state.pointerId;
    dragState = null;

    try { handle.style.cursor = cursorGrab; } catch { /* ignore */ }
    try {
      if (e && typeof e.pointerId === 'number') handle.releasePointerCapture(e.pointerId);
      else if (typeof pointerId === 'number') handle.releasePointerCapture(pointerId);
    } catch { /* ignore */ }

    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', endDrag, true);
    document.removeEventListener('pointercancel', endDrag, true);

    if (!panel.isConnected) {
      try {
        options.onMoveEnd?.({ left: state.originLeft, top: state.originTop, anchor: null, moved: false });
      } catch { /* ignore */ }
      return;
    }

    const size = measure();
    const rect = panel.getBoundingClientRect();
    const finalPos = state.moved
      ? finalizePanelDragPosition({
          left: rect.left,
          top: rect.top,
          width: size.width,
          height: size.height,
          margin,
          snapThreshold,
          snap: snapEnabled
        })
      : {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          anchor: normalizePanelAnchor(panel.getAttribute?.('data-kp-panel-anchor'))
        };

    if (state.moved) {
      applyPanelPosition(panel, finalPos, { margin, pinSize: false });
    }

    try {
      options.onMoveEnd?.({
        left: finalPos.left,
        top: finalPos.top,
        anchor: finalPos.anchor ?? null,
        moved: !!state.moved
      });
    } catch { /* ignore */ }
  };

  const onPointerDown = (e) => {
    if (!panel.isConnected) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (excludeSelector) {
      try {
        const t = /** @type {Element|null} */ (e.target instanceof Element ? e.target : e.target?.parentElement);
        if (t?.closest?.(excludeSelector)) return;
      } catch { /* ignore */ }
    }

    e.preventDefault();
    e.stopPropagation();

    const origin = pinPanelGeometry(panel, { pinWidth, pinHeight });
    dragState = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: origin.left,
      originTop: origin.top,
      pointerId: e.pointerId,
      moved: false
    };

    try { handle.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', endDrag, true);
    document.addEventListener('pointercancel', endDrag, true);
  };

  try {
    handle.style.cursor = handle.style.cursor || cursorGrab;
    handle.style.touchAction = handle.style.touchAction || 'none';
    handle.style.userSelect = handle.style.userSelect || 'none';
  } catch { /* ignore */ }

  handle.addEventListener('pointerdown', onPointerDown);

  const api = {
    dispose: () => {
      endDrag();
      try { handle.removeEventListener('pointerdown', onPointerDown); } catch { /* ignore */ }
      try {
        if (handle.dataset) delete handle.dataset.kpPanelDraggable;
      } catch { /* ignore */ }
      try { delete handle.__kpPanelDragApi; } catch { /* ignore */ }
    }
  };

  try {
    handle.dataset.kpPanelDraggable = '1';
    handle.__kpPanelDragApi = api;
  } catch { /* ignore */ }

  return api;
}
