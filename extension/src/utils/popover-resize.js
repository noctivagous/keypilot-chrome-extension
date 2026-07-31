/**
 * Generic popover / modal panel resize handles.
 *
 * Attaches edge + corner hit targets (with resize cursors) and a visible
 * bottom-right grip icon. Works with any fixed-position panel, including those
 * initially centered via margin:auto or transform: translate(-50%, -50%).
 *
 * @param {HTMLElement} panel
 * @param {{
 *   minWidth?: number,
 *   minHeight?: number,
 *   margin?: number,
 *   zIndex?: number|string,
 *   aspectRatio?: number|true,
 *     // number = width/height; true = lock to size at resize-start
 *   onResizeStart?: () => void,
 *   onResizeEnd?: () => void,
 *   onResize?: (rect: { left: number, top: number, width: number, height: number }) => void
 * }} [options]
 * @returns {{ dispose: () => void }|null}
 */
export function makePopoverResizable(panel, options = {}) {
  if (!panel || !(panel instanceof Element)) return null;

  // Avoid double-attaching.
  try {
    if (panel.dataset && panel.dataset.kpResizable === '1') {
      return panel.__kpResizeApi || null;
    }
  } catch { /* ignore */ }

  const doc = panel.ownerDocument || document;
  const minWidth = Math.max(160, Number(options.minWidth) || 280);
  const minHeight = Math.max(120, Number(options.minHeight) || 180);
  const margin = Math.max(0, Number(options.margin) || 8);
  const handleZ = options.zIndex != null ? String(options.zIndex) : '20';
  // Fixed ratio (width/height), or true = capture at each resize start.
  const aspectRatioOpt = options.aspectRatio;
  const lockAspect = aspectRatioOpt === true || (typeof aspectRatioOpt === 'number' && aspectRatioOpt > 0);
  const fixedAspect = (typeof aspectRatioOpt === 'number' && aspectRatioOpt > 0)
    ? aspectRatioOpt
    : null;

  const EDGE = 6;
  const CORNER = 12;

  /** @type {Array<{ el: HTMLElement, dir: string }>} */
  const handles = [];
  /** @type {{ dir: string, startX: number, startY: number, origin: { left: number, top: number, width: number, height: number }, pointerId: number, aspect?: number }|null} */
  let drag = null;
  /** @type {HTMLElement[]} */
  let frozenIframes = [];
  let prevBodyCursor = '';
  let prevBodyUserSelect = '';

  const dirs = [
    { dir: 'n', cursor: 'n-resize' },
    { dir: 's', cursor: 's-resize' },
    { dir: 'e', cursor: 'e-resize' },
    { dir: 'w', cursor: 'w-resize' },
    { dir: 'ne', cursor: 'ne-resize' },
    { dir: 'nw', cursor: 'nw-resize' },
    { dir: 'se', cursor: 'se-resize' },
    { dir: 'sw', cursor: 'sw-resize' }
  ];

  // Ensure a positioning context for absolute handles.
  try {
    const cs = doc.defaultView?.getComputedStyle?.(panel);
    if (cs && (cs.position === 'static' || !cs.position)) {
      panel.style.position = 'fixed';
    }
  } catch {
    panel.style.position = panel.style.position || 'fixed';
  }

  const handleStyleBase = `
    position: absolute;
    z-index: ${handleZ};
    background: transparent;
    touch-action: none;
    pointer-events: auto;
  `;

  const placeHandle = (el, dir) => {
    // Reset
    el.style.top = el.style.right = el.style.bottom = el.style.left = '';
    el.style.width = el.style.height = '';

    if (dir === 'n' || dir === 's') {
      el.style.left = `${CORNER}px`;
      el.style.right = `${CORNER}px`;
      el.style.height = `${EDGE}px`;
      el.style.width = 'auto';
      if (dir === 'n') el.style.top = '0';
      else el.style.bottom = '0';
    } else if (dir === 'e' || dir === 'w') {
      el.style.top = `${CORNER}px`;
      el.style.bottom = `${CORNER}px`;
      el.style.width = `${EDGE}px`;
      el.style.height = 'auto';
      if (dir === 'e') el.style.right = '0';
      else el.style.left = '0';
    } else {
      // Corners
      el.style.width = `${CORNER}px`;
      el.style.height = `${CORNER}px`;
      if (dir.includes('n')) el.style.top = '0';
      if (dir.includes('s')) el.style.bottom = '0';
      if (dir.includes('e')) el.style.right = '0';
      if (dir.includes('w')) el.style.left = '0';
    }
  };

  for (const { dir, cursor } of dirs) {
    const el = doc.createElement('div');
    el.className = `kpv2-popover-resize-handle kpv2-popover-resize-${dir}`;
    el.dataset.kpResizeDir = dir;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = handleStyleBase + `cursor: ${cursor};`;
    placeHandle(el, dir);

    // Visible grip icon only on SE corner
    if (dir === 'se') {
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.display = 'flex';
      el.style.alignItems = 'flex-end';
      el.style.justifyContent = 'flex-end';
      el.style.padding = '0 2px 2px 0';
      el.style.color = 'rgba(255,255,255,0.45)';
      el.title = 'Resize';

      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 12 12');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '12');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'display:block; pointer-events:none;';
      // Three diagonal grip lines (outline style)
      const lines = [
        'M4 11 L11 4',
        'M7 11 L11 7',
        'M10 11 L11 10'
      ];
      for (const d of lines) {
        const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
      }
      el.appendChild(svg);

      el.addEventListener('mouseenter', () => {
        el.style.color = 'rgba(255,255,255,0.75)';
      });
      el.addEventListener('mouseleave', () => {
        if (!drag) el.style.color = 'rgba(255,255,255,0.45)';
      });
    }

    handles.push({ el, dir });
    panel.appendChild(el);
  }

  /**
   * Convert centered / inset / transform-based layout into explicit fixed box.
   * Uses visual rect so transforms (e.g. translate(-50%,-50%)) are accounted for.
   */
  const pinGeometry = () => {
    const rect = panel.getBoundingClientRect();
    const s = panel.style;
    s.position = 'fixed';
    s.transform = 'none';
    try { s.webkitTransform = 'none'; } catch { /* ignore */ }
    s.left = `${rect.left}px`;
    s.top = `${rect.top}px`;
    s.width = `${rect.width}px`;
    s.height = `${rect.height}px`;
    s.right = 'auto';
    s.bottom = 'auto';
    s.inset = 'auto';
    s.margin = '0';
    s.maxWidth = 'none';
    s.maxHeight = 'none';
    // Rect sizes include borders; border-box keeps the visual size stable.
    s.boxSizing = 'border-box';
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
  };

  const freezeIframes = () => {
    frozenIframes = [];
    try {
      const list = panel.querySelectorAll('iframe');
      list.forEach((iframe) => {
        frozenIframes.push(iframe);
        try {
          iframe.dataset.kpPrevPe = iframe.style.pointerEvents || '';
          iframe.style.pointerEvents = 'none';
        } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
  };

  const unfreezeIframes = () => {
    for (const iframe of frozenIframes) {
      try {
        iframe.style.pointerEvents = iframe.dataset.kpPrevPe || '';
        delete iframe.dataset.kpPrevPe;
      } catch { /* ignore */ }
    }
    frozenIframes = [];
  };

  /**
   * @param {number} left
   * @param {number} top
   * @param {number} width
   * @param {number} height
   * @param {{ aspect?: number, anchorRight?: boolean, anchorBottom?: boolean }} [opts]
   */
  const clampRect = (left, top, width, height, opts = {}) => {
    const vw = doc.defaultView?.innerWidth ?? window.innerWidth;
    const vh = doc.defaultView?.innerHeight ?? window.innerHeight;
    const maxW = Math.max(minWidth, vw - margin * 2);
    const maxH = Math.max(minHeight, vh - margin * 2);
    const aspect = (typeof opts.aspect === 'number' && opts.aspect > 0) ? opts.aspect : null;

    let w = width;
    let h = height;
    let l = left;
    let t = top;

    if (aspect) {
      // Min box that satisfies both minWidth and minHeight at this ratio.
      const minWAspect = Math.max(minWidth, minHeight * aspect);
      const minHAspect = minWAspect / aspect;

      // Fit inside viewport while keeping ratio.
      let fitW = Math.min(Math.max(w, minWAspect), maxW);
      let fitH = fitW / aspect;
      if (fitH > maxH) {
        fitH = maxH;
        fitW = fitH * aspect;
      }
      if (fitW < minWAspect) {
        fitW = minWAspect;
        fitH = minHAspect;
      }
      // If still too tall after min width, re-fit to height.
      if (fitH > maxH) {
        fitH = Math.min(maxH, Math.max(minHAspect, maxH));
        fitW = fitH * aspect;
      }

      w = fitW;
      h = fitH;

      // Preserve the opposite corner when anchoring from W/N edges.
      if (opts.anchorRight) l = left + (width - w);
      if (opts.anchorBottom) t = top + (height - h);
    } else {
      w = Math.min(Math.max(width, minWidth), maxW);
      h = Math.min(Math.max(height, minHeight), maxH);
    }

    // Keep fully on-screen with margin
    if (l < margin) l = margin;
    if (t < margin) t = margin;
    if (l + w > vw - margin) l = Math.max(margin, vw - margin - w);
    if (t + h > vh - margin) t = Math.max(margin, vh - margin - h);

    // Re-clamp size if viewport is tiny (may break aspect slightly on tiny screens)
    if (!aspect) {
      w = Math.min(w, vw - margin - l);
      h = Math.min(h, vh - margin - t);
      w = Math.max(minWidth, w);
      h = Math.max(minHeight, h);
    } else {
      const availW = vw - margin - l;
      const availH = vh - margin - t;
      if (w > availW || h > availH) {
        const scale = Math.min(availW / w, availH / h, 1);
        w = Math.max(minWidth, w * scale);
        h = w / aspect;
      }
    }

    return { left: l, top: t, width: w, height: h };
  };

  const applyRect = (r) => {
    panel.style.left = `${r.left}px`;
    panel.style.top = `${r.top}px`;
    panel.style.width = `${r.width}px`;
    panel.style.height = `${r.height}px`;
    try {
      options.onResize?.(r);
    } catch { /* ignore */ }
  };

  const onPointerMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const { left: ol, top: ot, width: ow, height: oh } = drag.origin;
    const dir = drag.dir;
    const aspect = drag.aspect || null;

    let left = ol;
    let top = ot;
    let width = ow;
    let height = oh;

    if (aspect) {
      // Maintain width/height = aspect. Drive from the primary moved edge(s).
      const moveE = dir.includes('e');
      const moveW = dir.includes('w');
      const moveS = dir.includes('s');
      const moveN = dir.includes('n');
      const horizontal = moveE || moveW;
      const vertical = moveS || moveN;

      if (horizontal && vertical) {
        // Corner: use the axis with the larger relative change.
        const candidateW = moveE ? (ow + dx) : (ow - dx);
        const candidateH = moveS ? (oh + dy) : (oh - dy);
        const fromW = Math.abs(candidateW / ow);
        const fromH = Math.abs(candidateH / oh);
        if (fromW >= fromH) {
          width = candidateW;
          height = width / aspect;
        } else {
          height = candidateH;
          width = height * aspect;
        }
      } else if (horizontal) {
        width = moveE ? (ow + dx) : (ow - dx);
        height = width / aspect;
      } else {
        height = moveS ? (oh + dy) : (oh - dy);
        width = height * aspect;
      }

      // Anchor opposite edges so the non-dragged corner stays put.
      if (moveW) left = ol + (ow - width);
      if (moveN) top = ot + (oh - height);

      applyRect(clampRect(left, top, width, height, {
        aspect,
        anchorRight: moveW,
        anchorBottom: moveN
      }));
      return;
    }

    if (dir.includes('e')) width = ow + dx;
    if (dir.includes('s')) height = oh + dy;
    if (dir.includes('w')) {
      width = ow - dx;
      left = ol + dx;
      // If width hits min, freeze left edge
      if (width < minWidth) {
        width = minWidth;
        left = ol + ow - minWidth;
      }
    }
    if (dir.includes('n')) {
      height = oh - dy;
      top = ot + dy;
      if (height < minHeight) {
        height = minHeight;
        top = ot + oh - minHeight;
      }
    }

    applyRect(clampRect(left, top, width, height));
  };

  const endDrag = (e) => {
    if (!drag) return;
    const pointerId = drag.pointerId;
    const dir = drag.dir;
    drag = null;

    try {
      if (e && typeof e.pointerId === 'number') {
        // release on the handle if possible
      }
    } catch { /* ignore */ }

    unfreezeIframes();

    try {
      doc.body.style.cursor = prevBodyCursor;
      doc.body.style.userSelect = prevBodyUserSelect;
    } catch { /* ignore */ }

    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('pointerup', endDrag, true);
    doc.removeEventListener('pointercancel', endDrag, true);

    // Restore SE grip idle color
    const se = handles.find((h) => h.dir === 'se');
    if (se) se.el.style.color = 'rgba(255,255,255,0.45)';

    try {
      options.onResizeEnd?.();
    } catch { /* ignore */ }

    void pointerId;
    void dir;
  };

  const onPointerDown = (e, dir) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Pin after caller onResizeStart may adjust geometry (e.g. bottom-dock → top/left).
    try {
      options.onResizeStart?.();
    } catch { /* ignore */ }

    const origin = pinGeometry();
    let aspect = fixedAspect;
    if (lockAspect && !aspect && origin.height > 0) {
      aspect = origin.width / origin.height;
    }
    drag = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      origin,
      pointerId: e.pointerId,
      aspect: aspect || undefined
    };

    freezeIframes();

    try {
      prevBodyCursor = doc.body.style.cursor || '';
      prevBodyUserSelect = doc.body.style.userSelect || '';
      const cursorMap = {
        n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
        ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize'
      };
      doc.body.style.cursor = cursorMap[dir] || 'se-resize';
      doc.body.style.userSelect = 'none';
    } catch { /* ignore */ }

    doc.addEventListener('pointermove', onPointerMove, true);
    doc.addEventListener('pointerup', endDrag, true);
    doc.addEventListener('pointercancel', endDrag, true);

    try {
      e.currentTarget?.setPointerCapture?.(e.pointerId);
    } catch { /* ignore */ }
  };

  for (const { el, dir } of handles) {
    el.addEventListener('pointerdown', (e) => onPointerDown(e, dir));
  }

  const dispose = () => {
    endDrag();
    for (const { el } of handles) {
      try { el.remove(); } catch { /* ignore */ }
    }
    handles.length = 0;
    try {
      if (panel.dataset) delete panel.dataset.kpResizable;
    } catch { /* ignore */ }
    try {
      delete panel.__kpResizeApi;
    } catch { /* ignore */ }
  };

  try {
    panel.dataset.kpResizable = '1';
  } catch { /* ignore */ }

  const api = { dispose };
  try {
    panel.__kpResizeApi = api;
  } catch { /* ignore */ }

  return api;
}
