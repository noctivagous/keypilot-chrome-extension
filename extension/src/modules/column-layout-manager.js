/**
 * Column layout + NLE-style slip edit for Cols Toggle.
 *
 * Applies CSS multi-column reflow to a chosen element (or body/html for page mode)
 * so vertical content fits a widescreen viewport. Slip offset scrubs which slice
 * of content occupies the fixed column frame without changing frame size.
 *
 * Sites with heavy flex/grid/sticky chrome may reflow poorly — best-effort v1.
 */
import { CSS_CLASSES, COLORS, Z_INDEX, KP_UI_FONT } from '../config/constants.js';

/** Slip bar height (product: ~20pt rectangular track). */
const SLIP_BAR_HEIGHT = '20pt';
const SLIP_BAR_HEIGHT_PX_FALLBACK = 27;
const COL_GAP_PX = 24;
/** Readable measure target for auto column-width. */
const COL_WIDTH_MIN_PX = 280;
const COL_WIDTH_MAX_PX = 420;
const COL_WIDTH_IDEAL_PX = 360;

export class ColumnLayoutManager {
  constructor() {
    /** @type {boolean} */
    this._active = false;
    /** @type {Element|null} */
    this._target = null;
    /** @type {boolean} */
    this._pageMode = false;
    /** @type {Array<{ el: Element, styleAttr: string|null }>} */
    this._snapshots = [];
    /** @type {number} slip offset in px (horizontal scroll of multicol frame) */
    this._slipOffset = 0;
    /** @type {number} */
    this._maxSlip = 0;
    /** @type {HTMLElement|null} */
    this._slipBar = null;
    /** @type {HTMLElement|null} */
    this._track = null;
    /** @type {HTMLElement|null} */
    this._knob = null;
    /** @type {boolean} */
    this._dragging = false;
    /** @type {((e: PointerEvent) => void)|null} */
    this._onPointerMove = null;
    /** @type {((e: PointerEvent) => void)|null} */
    this._onPointerUp = null;
    /** @type {(() => void)|null} */
    this._onResize = null;
    /** @type {ResizeObserver|null} */
    this._resizeObserver = null;
    /** @type {number} */
    this._measureRaf = 0;
  }

  isActive() {
    return this._active;
  }

  isPageMode() {
    return this._active && this._pageMode;
  }

  getTarget() {
    return this._target;
  }

  /**
   * @param {Element|null|undefined} element
   * @returns {boolean} true if columns were applied
   */
  apply(element) {
    if (this._active) {
      this.clear();
    }

    let target = element;
    if (!target || !target.isConnected) return false;

    // Skip KeyPilot chrome.
    if (this._isKeyPilotNode(target)) return false;

    let pageMode = false;
    try {
      if (target === document.documentElement || target === document.body) {
        target = document.body;
        pageMode = true;
      }
    } catch {
      return false;
    }

    if (!target || !target.isConnected) return false;

    this._snapshots = [];
    this._snapshot(target);
    if (pageMode) {
      try { this._snapshot(document.documentElement); } catch { /* ignore */ }
    }

    this._target = target;
    this._pageMode = pageMode;
    this._slipOffset = 0;
    this._maxSlip = 0;

    this._applyMetrics();
    try {
      target.classList.add(CSS_CLASSES.COLS_ACTIVE);
      if (pageMode) {
        document.documentElement.classList.add(CSS_CLASSES.COLS_PAGE);
        document.body.classList.add(CSS_CLASSES.COLS_PAGE);
      }
    } catch {
      this.clear();
      return false;
    }

    this._active = true;
    this._ensureSlipBar();
    this._bindResize();
    this._scheduleRemeasure();
    return true;
  }

  clear() {
    this._unbindResize();
    this._teardownSlipBar();

    if (this._target) {
      try { this._target.classList.remove(CSS_CLASSES.COLS_ACTIVE); } catch { /* ignore */ }
    }
    try {
      document.documentElement.classList.remove(CSS_CLASSES.COLS_PAGE);
      document.body.classList.remove(CSS_CLASSES.COLS_PAGE);
    } catch { /* ignore */ }

    this._restoreSnapshots();

    try {
      document.documentElement.style.removeProperty('--kpv2-cols-width');
      document.documentElement.style.removeProperty('--kpv2-cols-gap');
      document.documentElement.style.removeProperty('--kpv2-cols-height');
      document.documentElement.style.removeProperty('--kpv2-cols-slip-reserve');
    } catch { /* ignore */ }

    this._active = false;
    this._target = null;
    this._pageMode = false;
    this._slipOffset = 0;
    this._maxSlip = 0;
    this._snapshots = [];
  }

  /**
   * @param {number} offsetPx
   */
  setSlipOffset(offsetPx) {
    if (!this._active || !this._target) return;
    const max = this._maxSlip > 0 ? this._maxSlip : 0;
    const next = Math.max(0, Math.min(max, Number(offsetPx) || 0));
    this._slipOffset = next;
    this._applySlipToTarget();
    this._updateKnobPosition();
  }

  /**
   * Normalized 0..1 slip position.
   * @param {number} t
   */
  setSlipNormalized(t) {
    const max = this._maxSlip > 0 ? this._maxSlip : 0;
    const n = Math.max(0, Math.min(1, Number(t) || 0));
    this.setSlipOffset(n * max);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * @param {Element} el
   * @returns {boolean}
   */
  _isKeyPilotNode(el) {
    try {
      if (!el || el.nodeType !== 1) return true;
      if (el.closest?.('[data-kp-control-strip], [data-kp-early-control-strip], [data-kp-early-floating-keyboard]')) {
        return true;
      }
      const cls = typeof el.className === 'string' ? el.className : '';
      if (cls.includes('kpv2-') || cls.includes('kp-')) return true;
      // Walk up a few levels for class markers on ancestors.
      let cur = el.parentElement;
      let depth = 0;
      while (cur && depth < 6) {
        const c = typeof cur.className === 'string' ? cur.className : '';
        if (
          c.includes('kpv2-cols-slip') ||
          c.includes('kp-control-strip') ||
          c.includes('kp-floating-keyboard') ||
          c.includes('kpv2-omnibox') ||
          c.includes('kpv2-popup')
        ) {
          return true;
        }
        cur = cur.parentElement;
        depth += 1;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * @param {Element} el
   */
  _snapshot(el) {
    if (!el) return;
    let styleAttr = null;
    try {
      styleAttr = el.getAttribute('style');
    } catch {
      styleAttr = null;
    }
    this._snapshots.push({ el, styleAttr });
  }

  _restoreSnapshots() {
    for (const snap of this._snapshots) {
      try {
        if (!snap?.el) continue;
        if (snap.styleAttr == null || snap.styleAttr === '') {
          snap.el.removeAttribute('style');
        } else {
          snap.el.setAttribute('style', snap.styleAttr);
        }
      } catch { /* ignore */ }
    }
    this._snapshots = [];
  }

  _applyMetrics() {
    const slipReserve = this._slipBarHeightPx();
    const vv = window.visualViewport;
    const vw = Math.max(320, Math.floor((vv && vv.width) || window.innerWidth || 1024));
    const vh = Math.max(200, Math.floor((vv && vv.height) || window.innerHeight || 768));

    // Available height inside the column frame (viewport minus slip bar).
    const frameH = Math.max(120, vh - slipReserve - 8);
    // Auto column-width: fit as many readable columns as width allows.
    const availableW = Math.max(200, vw - 16);
    let colW = COL_WIDTH_IDEAL_PX;
    // Prefer ideal; if only one column would fit, still use min readable.
    const nAtIdeal = Math.max(1, Math.floor((availableW + COL_GAP_PX) / (COL_WIDTH_IDEAL_PX + COL_GAP_PX)));
    if (nAtIdeal <= 1) {
      colW = Math.min(COL_WIDTH_MAX_PX, Math.max(COL_WIDTH_MIN_PX, availableW));
    } else {
      // Distribute leftover so columns fill width without huge empty margin.
      const totalGaps = (nAtIdeal - 1) * COL_GAP_PX;
      colW = Math.min(
        COL_WIDTH_MAX_PX,
        Math.max(COL_WIDTH_MIN_PX, Math.floor((availableW - totalGaps) / nAtIdeal))
      );
    }

    try {
      const root = document.documentElement;
      root.style.setProperty('--kpv2-cols-width', `${colW}px`);
      root.style.setProperty('--kpv2-cols-gap', `${COL_GAP_PX}px`);
      root.style.setProperty('--kpv2-cols-height', `${frameH}px`);
      root.style.setProperty('--kpv2-cols-slip-reserve', `${slipReserve}px`);
    } catch { /* ignore */ }

    // Inline critical layout so we win over aggressive site CSS without fighting forever.
    const t = this._target;
    if (!t) return;
    try {
      const s = /** @type {HTMLElement} */ (t).style;
      s.setProperty('column-width', `${colW}px`, 'important');
      s.setProperty('column-gap', `${COL_GAP_PX}px`, 'important');
      s.setProperty('column-fill', 'auto', 'important');
      s.setProperty('height', `${frameH}px`, 'important');
      s.setProperty('max-height', `${frameH}px`, 'important');
      s.setProperty('overflow-x', 'auto', 'important');
      s.setProperty('overflow-y', 'hidden', 'important');
      s.setProperty('box-sizing', 'border-box', 'important');
      s.setProperty('width', '100%', 'important');
      // Avoid double scrollbars on body while still allowing horizontal slip.
      if (this._pageMode) {
        s.setProperty('margin', '0', 'important');
        s.setProperty('padding-bottom', '0', 'important');
        try {
          const hs = document.documentElement.style;
          hs.setProperty('overflow', 'hidden', 'important');
          hs.setProperty('height', `${vh}px`, 'important');
          hs.setProperty('max-height', `${vh}px`, 'important');
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  _slipBarHeightPx() {
    try {
      // 20pt ≈ 26.67px at 96dpi; measure if bar exists.
      if (this._slipBar) {
        const h = this._slipBar.getBoundingClientRect().height;
        if (h > 0) return Math.ceil(h);
      }
    } catch { /* ignore */ }
    return SLIP_BAR_HEIGHT_PX_FALLBACK;
  }

  _applySlipToTarget() {
    if (!this._target) return;
    try {
      // Multicol overflow extends horizontally — slip = scrollLeft (NLE content window).
      /** @type {HTMLElement} */ (this._target).scrollLeft = this._slipOffset;
    } catch { /* ignore */ }
  }

  _scheduleRemeasure() {
    if (this._measureRaf) {
      try { cancelAnimationFrame(this._measureRaf); } catch { /* ignore */ }
    }
    this._measureRaf = requestAnimationFrame(() => {
      this._measureRaf = 0;
      this._remeasureSlip();
    });
  }

  _remeasureSlip() {
    if (!this._active || !this._target) return;
    try {
      const el = /** @type {HTMLElement} */ (this._target);
      // After layout, extra columns increase scrollWidth.
      const max = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
      this._maxSlip = max;
      if (this._slipOffset > max) {
        this._slipOffset = max;
        this._applySlipToTarget();
      } else {
        this._applySlipToTarget();
      }
      this._updateKnobPosition();
      // Enable/disable affordance when nothing to slip.
      if (this._slipBar) {
        this._slipBar.setAttribute('data-kp-slip-empty', max <= 0 ? '1' : '0');
      }
    } catch { /* ignore */ }
  }

  _bindResize() {
    this._unbindResize();
    this._onResize = () => {
      if (!this._active) return;
      this._applyMetrics();
      this._scheduleRemeasure();
    };
    try {
      window.addEventListener('resize', this._onResize, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', this._onResize, { passive: true });
      }
    } catch { /* ignore */ }

    try {
      if (typeof ResizeObserver !== 'undefined' && this._target) {
        this._resizeObserver = new ResizeObserver(() => this._scheduleRemeasure());
        this._resizeObserver.observe(this._target);
      }
    } catch {
      this._resizeObserver = null;
    }
  }

  _unbindResize() {
    if (this._onResize) {
      try { window.removeEventListener('resize', this._onResize); } catch { /* ignore */ }
      try {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', this._onResize);
        }
      } catch { /* ignore */ }
      this._onResize = null;
    }
    if (this._resizeObserver) {
      try { this._resizeObserver.disconnect(); } catch { /* ignore */ }
      this._resizeObserver = null;
    }
    if (this._measureRaf) {
      try { cancelAnimationFrame(this._measureRaf); } catch { /* ignore */ }
      this._measureRaf = 0;
    }
  }

  _ensureSlipBar() {
    if (this._slipBar && this._slipBar.isConnected) {
      this._updateKnobPosition();
      return;
    }
    this._teardownSlipBar();

    const bar = document.createElement('div');
    bar.className = CSS_CLASSES.COLS_SLIP_BAR;
    bar.setAttribute('data-kp-cols-slip', 'true');
    bar.setAttribute('role', 'slider');
    bar.setAttribute('aria-label', 'Slip edit — shift column content');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');
    Object.assign(bar.style, {
      position: 'fixed',
      left: '12px',
      right: '12px',
      bottom: '10px',
      height: SLIP_BAR_HEIGHT,
      zIndex: String(Z_INDEX.COLS_SLIP_BAR),
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '0 10px',
      boxSizing: 'border-box',
      borderRadius: '6px',
      background: 'rgba(28, 20, 36, 0.88)',
      border: `1px solid ${COLORS.COLS_SHADOW_BRIGHT}`,
      boxShadow: `0 2px 12px ${COLORS.COLS_SHADOW}`,
      fontFamily: KP_UI_FONT,
      color: 'rgba(255,255,255,0.9)',
      userSelect: 'none',
      pointerEvents: 'auto',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)'
    });

    const label = document.createElement('span');
    label.className = CSS_CLASSES.COLS_SLIP_LABEL;
    label.textContent = 'Slip';
    Object.assign(label.style, {
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      opacity: '0.85',
      flex: '0 0 auto',
      color: COLORS.COLS_PURPLE_BRIGHT
    });

    const track = document.createElement('div');
    track.className = CSS_CLASSES.COLS_SLIP_TRACK;
    Object.assign(track.style, {
      position: 'relative',
      flex: '1 1 auto',
      height: '10px',
      borderRadius: '2px',
      background: 'rgba(255,255,255,0.12)',
      border: '1px solid rgba(255,255,255,0.14)',
      cursor: 'pointer'
    });

    // Rectangular knob (not circular) — product requirement.
    const knob = document.createElement('div');
    knob.className = CSS_CLASSES.COLS_SLIP_KNOB;
    Object.assign(knob.style, {
      position: 'absolute',
      top: '50%',
      left: '0%',
      width: '28px',
      height: '16px',
      marginTop: '-8px',
      marginLeft: '-14px',
      borderRadius: '2px',
      background: COLORS.COLS_PURPLE_BRIGHT,
      border: '1px solid rgba(255,255,255,0.35)',
      boxShadow: `0 1px 4px ${COLORS.COLS_SHADOW_BRIGHT}`,
      cursor: 'grab',
      boxSizing: 'border-box',
      touchAction: 'none'
    });

    track.appendChild(knob);
    bar.appendChild(label);
    bar.appendChild(track);

    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this._dragging = true;
      try { knob.style.cursor = 'grabbing'; } catch { /* ignore */ }
      try { track.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      this._slipFromClientX(e.clientX);
    };

    this._onPointerMove = (e) => {
      if (!this._dragging) return;
      e.preventDefault();
      this._slipFromClientX(e.clientX);
    };
    this._onPointerUp = (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      try { knob.style.cursor = 'grab'; } catch { /* ignore */ }
      try { track.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    };

    track.addEventListener('pointerdown', onPointerDown);
    knob.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove, { passive: false });
    window.addEventListener('pointerup', this._onPointerUp, { passive: true });
    window.addEventListener('pointercancel', this._onPointerUp, { passive: true });

    // Store for teardown.
    bar._kpOnPointerDown = onPointerDown;

    try {
      document.documentElement.appendChild(bar);
    } catch {
      try { document.body.appendChild(bar); } catch { /* ignore */ }
    }

    this._slipBar = bar;
    this._track = track;
    this._knob = knob;
    this._updateKnobPosition();
  }

  /**
   * @param {number} clientX
   */
  _slipFromClientX(clientX) {
    if (!this._track) return;
    try {
      const rect = this._track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const t = (clientX - rect.left) / rect.width;
      this.setSlipNormalized(t);
    } catch { /* ignore */ }
  }

  _updateKnobPosition() {
    if (!this._knob || !this._slipBar) return;
    const max = this._maxSlip > 0 ? this._maxSlip : 0;
    const t = max > 0 ? this._slipOffset / max : 0;
    const pct = Math.max(0, Math.min(1, t)) * 100;
    try {
      this._knob.style.left = `${pct}%`;
      this._slipBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    } catch { /* ignore */ }
  }

  _teardownSlipBar() {
    this._dragging = false;
    if (this._onPointerMove) {
      try { window.removeEventListener('pointermove', this._onPointerMove); } catch { /* ignore */ }
      this._onPointerMove = null;
    }
    if (this._onPointerUp) {
      try { window.removeEventListener('pointerup', this._onPointerUp); } catch { /* ignore */ }
      try { window.removeEventListener('pointercancel', this._onPointerUp); } catch { /* ignore */ }
      this._onPointerUp = null;
    }
    if (this._slipBar) {
      try {
        const down = this._slipBar._kpOnPointerDown;
        if (down && this._track) {
          this._track.removeEventListener('pointerdown', down);
          this._knob?.removeEventListener('pointerdown', down);
        }
      } catch { /* ignore */ }
      try { this._slipBar.remove(); } catch { /* ignore */ }
    }
    this._slipBar = null;
    this._track = null;
    this._knob = null;
  }
}
