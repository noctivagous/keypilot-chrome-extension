/**
 * Column layout + NLE-style slip edit for Cols Toggle.
 *
 * Wraps the chosen element in a GUI widget shell (outline, padding, slip bar
 * as bottom chrome like a playback slider). Slip offset scrubs which slice of
 * content occupies the fixed column frame. Expand promotes the shell into a
 * floating popover (same resize/chrome utilities as Link Preview). Close
 * restores the original element.
 *
 * Height invariant (core UX):
 *   The widget shell (and the multicol content frame inside it) must never be
 *   taller than the viewport. Vertical document scroll is converted into
 *   multi-column horizontal flow; overflow continues sideways and is scrubbed
 *   with the slip bar — not by growing the shell past 100vh.
 *
 * Progressive / infinite-scroll content (best-effort):
 *   - MutationObserver remeasures slip when the target DOM grows.
 *   - Near the end of the slip range, we nudge scroll/IO so site “load more”
 *     hooks can fire; new nodes reflow into additional columns.
 *   - Virtualized feeds (tiny live DOM) cannot be fully supported.
 *
 * Sites with heavy flex/grid/sticky chrome may reflow poorly — best-effort v1.
 */
import { CSS_CLASSES, COLORS, Z_INDEX, KP_UI_FONT } from '../config/constants.js';
import { makePopoverResizable } from '../utils/popover-resize.js';
import { ensureOpenChromeShadow } from '../ui/kp-chrome-shadow.js';

/** Slip bar height (product: ~20pt rectangular track). */
const SLIP_BAR_HEIGHT = '28px';
const SLIP_BAR_HEIGHT_PX_FALLBACK = 28;
const SHELL_PAD_PX = 10;
const COL_GAP_PX = 24;
/** Readable measure target for auto column-width. */
const COL_WIDTH_MIN_PX = 280;
const COL_WIDTH_MAX_PX = 420;
const COL_WIDTH_IDEAL_PX = 360;

/** Treat slip as “near end” when past this fraction of max (wake loaders). */
const SLIP_END_RATIO = 0.86;
/** Or when within this many px of the slip max. */
const SLIP_END_PX = 160;
/** Min gap between progressive-load wake attempts. */
const WAKE_THROTTLE_MS = 850;
/** Debounce for MutationObserver → remeasure. */
const MUTATION_REMEASURE_MS = 80;

export class ColumnLayoutManager {
  constructor() {
    /** @type {boolean} */
    this._active = false;
    /** @type {Element|null} */
    this._target = null;
    /** @type {boolean} */
    this._pageMode = false;
    /** @type {boolean} shell floated as a popover */
    this._popoverMode = false;
    /** @type {Array<{ el: Element, styleAttr: string|null }>} */
    this._snapshots = [];
    /** @type {number} slip offset in px (horizontal scroll of multicol frame) */
    this._slipOffset = 0;
    /** @type {number} */
    this._maxSlip = 0;
    /** @type {HTMLElement|null} */
    this._shell = null;
    /** @type {HTMLElement|null} */
    this._body = null;
    /** @type {HTMLElement|null} */
    this._placeholder = null;
    /** @type {HTMLElement|null} */
    this._slipBar = null;
    /** @type {HTMLElement|null} */
    this._track = null;
    /** @type {HTMLElement|null} */
    this._knob = null;
    /** @type {HTMLElement|null} */
    this._expandBtn = null;
    /** @type {HTMLElement|null} */
    this._closeBtn = null;
    /** @type {{ dispose: () => void }|null} */
    this._resizeApi = null;
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
    /** @type {MutationObserver|null} */
    this._mutationObserver = null;
    /** @type {number} */
    this._mutationTimer = 0;
    /** @type {number} */
    this._measureRaf = 0;
    /** @type {number} last progressive-load wake (ms) */
    this._lastWakeAt = 0;
    /** @type {boolean} */
    this._wakeInFlight = false;
    /** @type {number} */
    this._wakeRestoreTimer = 0;
    /** @type {ParentNode|null} original parent of target before wrap */
    this._origParent = null;
    /** @type {Node|null} original nextSibling of target before wrap */
    this._origNext = null;
  }

  isActive() {
    return this._active;
  }

  isPageMode() {
    return this._active && this._pageMode;
  }

  isPopoverMode() {
    return this._active && this._popoverMode;
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

    // Element mode requires a parent we can wrap.
    if (!pageMode) {
      try {
        if (!target.parentNode) return false;
      } catch {
        return false;
      }
    }

    this._snapshots = [];
    this._snapshot(target);
    if (pageMode) {
      try { this._snapshot(document.documentElement); } catch { /* ignore */ }
    }

    this._target = target;
    this._pageMode = pageMode;
    this._popoverMode = false;
    this._slipOffset = 0;
    this._maxSlip = 0;

    try {
      if (pageMode) {
        this._buildPageShell();
      } else {
        this._wrapTargetInShell(target);
      }
    } catch (err) {
      console.warn('[KeyPilot] Column shell failed:', err);
      this.clear();
      return false;
    }

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
    this._bindResize();
    this._bindContentObserver();
    this._scheduleRemeasure();
    // After layout: if shell is max-height or clipped by the viewport, pin its
    // top to the top of the viewport so the full widget is in view.
    this._scheduleScrollShellIntoViewport();
    // Short first pages / infinite feeds: one progressive wake so loaders can
    // append more content into the column stream.
    try {
      setTimeout(() => {
        if (this._active) this._maybeWakeInfiniteScrollLoaders({ force: true });
      }, 120);
    } catch { /* ignore */ }
    return true;
  }

  clear() {
    this._unbindContentObserver();
    this._unbindResize();
    this._disposeResizeApi();
    this._cancelWakeLoaders();
    this._teardownSlipBar();

    if (this._target) {
      try { this._target.classList.remove(CSS_CLASSES.COLS_ACTIVE); } catch { /* ignore */ }
    }
    try {
      document.documentElement.classList.remove(CSS_CLASSES.COLS_PAGE);
      document.body.classList.remove(CSS_CLASSES.COLS_PAGE);
    } catch { /* ignore */ }

    this._unwrapShell();
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
    this._popoverMode = false;
    this._slipOffset = 0;
    this._maxSlip = 0;
    this._snapshots = [];
    this._origParent = null;
    this._origNext = null;
    this._lastWakeAt = 0;
    this._wakeInFlight = false;
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
    this._maybeWakeInfiniteScrollLoaders();
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
      const root = el.getRootNode?.();
      if (
        typeof ShadowRoot !== 'undefined' &&
        root instanceof ShadowRoot &&
        root.host?.hasAttribute?.('data-kp-ui-shadow')
      ) {
        return true;
      }
      if (el.closest?.('[data-kp-control-strip], [data-kp-early-control-strip], [data-kp-early-floating-keyboard]')) {
        return true;
      }
      if (el.closest?.(`.${CSS_CLASSES.COLS_SHELL}, .${CSS_CLASSES.COLS_SLIP_BAR}`)) {
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
          c.includes('kpv2-cols-shell') ||
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

  /**
   * Wrap a non-body target in the widget shell (content + slip chrome).
   * @param {Element} target
   */
  _wrapTargetInShell(target) {
    const parent = target.parentNode;
    if (!parent) throw new Error('no parent');

    this._origParent = parent;
    this._origNext = target.nextSibling;

    const shell = document.createElement('div');
    shell.className = CSS_CLASSES.COLS_SHELL;
    shell.setAttribute('data-kp-cols-shell', 'true');
    shell.setAttribute('role', 'region');
    shell.setAttribute('aria-label', 'Column layout');

    const body = document.createElement('div');
    body.className = CSS_CLASSES.COLS_BODY;
    body.setAttribute('data-kp-cols-body', 'true');

    let contentHeight = 0;
    try {
      contentHeight = target.getBoundingClientRect().height || 0;
    } catch {
      contentHeight = 0;
    }

    this._applyShellChrome(shell, body, { pageMode: false, contentHeight });

    parent.insertBefore(shell, target);
    body.appendChild(target);
    shell.appendChild(body);

    this._shell = shell;
    this._body = body;

    this._buildSlipBar(shell);
    this._attachResize(shell);
  }

  /**
   * Page mode: body is the column target; shell is a fixed viewport frame that
   * holds the slip bar as bottom chrome (content is not reparented).
   */
  _buildPageShell() {
    const shell = document.createElement('div');
    shell.className = `${CSS_CLASSES.COLS_SHELL} ${CSS_CLASSES.COLS_SHELL}--page`;
    shell.setAttribute('data-kp-cols-shell', 'true');
    shell.setAttribute('data-kp-cols-page-frame', 'true');
    shell.setAttribute('role', 'region');
    shell.setAttribute('aria-label', 'Page column layout');

    // Page frame is only chrome (slip + buttons); content stays on body.
    // Positioned as a bottom dock that is the full width of the slip bar / widget.
    Object.assign(shell.style, {
      position: 'fixed',
      left: '12px',
      right: '12px',
      bottom: '10px',
      top: 'auto',
      height: 'auto',
      zIndex: String(Z_INDEX.COLS_SLIP_BAR),
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      padding: '0',
      borderRadius: '8px',
      border: `2px solid ${COLORS.COLS_PURPLE}`,
      background: 'linear-gradient(180deg, rgba(28, 18, 36, 0.92) 0%, rgba(18, 12, 24, 0.94) 100%)',
      boxShadow: `0 8px 28px ${COLORS.COLS_SHADOW}, 0 0 0 1px ${COLORS.COLS_SHADOW_BRIGHT}`,
      fontFamily: KP_UI_FONT,
      overflow: 'hidden',
      pointerEvents: 'auto',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)'
    });

    // Outline the page content area; reserve bottom space so the docked slip
    // chrome is part of the frame rather than overlaying content.
    try {
      const slipH = this._slipBarHeightPx();
      const bs = document.body.style;
      bs.setProperty('outline', `2px solid ${COLORS.COLS_PURPLE}`, 'important');
      bs.setProperty('outline-offset', '-2px', 'important');
      bs.setProperty('border-radius', '6px', 'important');
      bs.setProperty('box-shadow', `inset 0 0 0 1px ${COLORS.COLS_SHADOW_BRIGHT}`, 'important');
      bs.setProperty('padding-bottom', `${slipH + 20}px`, 'important');
      bs.setProperty('box-sizing', 'border-box', 'important');
    } catch { /* ignore */ }

    this._shell = shell;
    this._body = null;

    this._buildSlipBar(shell);

    try {
      document.documentElement.appendChild(shell);
    } catch {
      try { document.body.appendChild(shell); } catch { /* ignore */ }
    }

    // Page frame is not content-resized the same way; still allow grip for height of bar strip only if needed.
    // Expand promotes a note — page is already full-bleed; expand becomes popover chrome maximize.
  }

  /**
   * Max shell height in CSS px — never taller than the visual viewport.
   * Leaves a small margin so the widget doesn't kiss browser chrome.
   * @returns {number}
   */
  _maxShellHeightPx() {
    const vv = window.visualViewport;
    const vh = Math.max(200, Math.floor((vv && vv.height) || window.innerHeight || 768));
    return Math.max(180, vh - 24);
  }

  /**
   * @param {HTMLElement} shell
   * @param {HTMLElement} body
   * @param {{ pageMode?: boolean, contentHeight?: number }} [opts]
   */
  _applyShellChrome(shell, body, opts = {}) {
    const vv = window.visualViewport;
    const vh = Math.max(200, Math.floor((vv && vv.height) || window.innerHeight || 768));
    const slipH = this._slipBarHeightPx();
    const maxShellH = this._maxShellHeightPx();
    // Original element height is only a *starting* size. Tall content is capped
    // to the viewport — overflow becomes extra columns + horizontal slip, not a
    // taller shell.
    const contentH = Math.max(120, Math.floor(Number(opts.contentHeight) || vh * 0.45));
    const shellH = Math.min(maxShellH, contentH + SHELL_PAD_PX + slipH + 8);

    Object.assign(shell.style, {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: '100%',
      maxHeight: `${maxShellH}px`,
      height: `${shellH}px`,
      boxSizing: 'border-box',
      padding: `${SHELL_PAD_PX}px`,
      paddingBottom: '0',
      margin: '8px 0',
      borderRadius: '8px',
      border: `2px solid ${COLORS.COLS_PURPLE}`,
      background: 'linear-gradient(180deg, rgba(28, 18, 36, 0.14) 0%, rgba(18, 12, 24, 0.10) 100%)',
      boxShadow: `0 8px 28px ${COLORS.COLS_SHADOW}, 0 0 0 1px ${COLORS.COLS_SHADOW_BRIGHT}`,
      fontFamily: KP_UI_FONT,
      overflow: 'hidden',
      zIndex: 'auto',
      pointerEvents: 'auto'
    });

    Object.assign(body.style, {
      flex: '1 1 auto',
      minHeight: '0',
      minWidth: '0',
      width: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
      position: 'relative',
      // Inner pad so content doesn't hug the outline
      padding: '4px',
      borderRadius: '4px'
    });
  }

  /**
   * Re-assert shell height ≤ viewport after window resize / user drag.
   */
  _clampShellToViewport() {
    if (!this._shell || this._pageMode) return;
    const maxShellH = this._maxShellHeightPx();
    try {
      const s = this._shell.style;
      s.maxHeight = `${maxShellH}px`;
      const rect = this._shell.getBoundingClientRect();
      if (rect.height > maxShellH + 1) {
        s.height = `${maxShellH}px`;
      }
    } catch { /* ignore */ }
  }

  /**
   * After Cols Toggle: if the shell is at maxHeight (fills the viewport band)
   * or its vertical extent is clipped by the viewport, scroll the document so
   * the top of the widget sits at the top of the viewport.
   *
   * Skipped for page mode / floating popover (those are fixed to the viewport).
   */
  _scrollShellIntoViewportIfNeeded() {
    if (!this._active || !this._shell || this._pageMode || this._popoverMode) return;
    try {
      if (!this._shell.isConnected) return;

      const rect = this._shell.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return;

      const vv = window.visualViewport;
      const vh = Math.max(1, Math.floor((vv && vv.height) || window.innerHeight || 0));
      const maxShellH = this._maxShellHeightPx();

      // At (or effectively at) the max shell height.
      const atMaxHeight = rect.height >= maxShellH - 2;

      // Any vertical overflow relative to the visual viewport.
      const outOfViewport =
        rect.top < -1 ||
        rect.bottom > vh + 1 ||
        rect.bottom < 0 ||
        rect.top > vh;

      if (!atMaxHeight && !outOfViewport) return;

      // Document Y of the shell's top edge.
      const pageY =
        (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);
      // visualViewport.offsetTop accounts for mobile URL-bar / pinch-zoom offset.
      const vvOffsetTop = (vv && typeof vv.offsetTop === 'number') ? vv.offsetTop : 0;
      const targetTop = Math.max(0, Math.round(pageY + rect.top - vvOffsetTop));

      // Instant scroll so the user lands on the widget immediately after toggle.
      try {
        window.scrollTo({ top: targetTop, left: window.pageXOffset || 0, behavior: 'auto' });
      } catch {
        window.scrollTo(window.pageXOffset || 0, targetTop);
      }
    } catch { /* ignore */ }
  }

  /**
   * Wait one or two frames so shell metrics/layout settle before scrolling.
   */
  _scheduleScrollShellIntoViewport() {
    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._scrollShellIntoViewportIfNeeded();
        });
      });
    } catch {
      this._scrollShellIntoViewportIfNeeded();
    }
  }

  _applyMetrics() {
    const slipReserve = this._slipBarHeightPx();
    const vv = window.visualViewport;
    const vw = Math.max(320, Math.floor((vv && vv.width) || window.innerWidth || 1024));
    const vh = Math.max(200, Math.floor((vv && vv.height) || window.innerHeight || 768));
    // Absolute ceiling for multicol frame: never taller than the viewport.
    const maxFrameH = Math.max(80, vh - 8);

    this._clampShellToViewport();

    // Prefer measuring the content body inside the shell (element mode).
    let availableW = Math.max(200, vw - 16);
    let frameH = Math.max(120, Math.min(maxFrameH, vh - slipReserve - 24));

    if (this._shell && !this._pageMode) {
      try {
        const shellRect = this._shell.getBoundingClientRect();
        if (shellRect.width > 40) {
          availableW = Math.max(160, Math.floor(shellRect.width - SHELL_PAD_PX * 2 - 8));
        }
        if (this._body) {
          const bodyRect = this._body.getBoundingClientRect();
          if (bodyRect.height > 40) {
            frameH = Math.max(80, Math.floor(bodyRect.height));
          } else if (shellRect.height > 40) {
            frameH = Math.max(80, Math.floor(shellRect.height - slipReserve - SHELL_PAD_PX));
          }
        }
      } catch { /* ignore */ }
    } else if (this._pageMode) {
      // Viewport minus the docked slip chrome — page columns fill the screen,
      // never taller than vh.
      frameH = Math.max(120, Math.min(maxFrameH, vh - slipReserve - 24));
      availableW = Math.max(200, vw - 32);
    }

    // Final clamp: multicol frame height ≤ viewport (horizontal overflow only).
    frameH = Math.min(frameH, maxFrameH);

    // Auto column-width: fit as many readable columns as width allows.
    let colW = COL_WIDTH_IDEAL_PX;
    const nAtIdeal = Math.max(1, Math.floor((availableW + COL_GAP_PX) / (COL_WIDTH_IDEAL_PX + COL_GAP_PX)));
    if (nAtIdeal <= 1) {
      colW = Math.min(COL_WIDTH_MAX_PX, Math.max(COL_WIDTH_MIN_PX, availableW));
    } else {
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
      s.setProperty('max-width', '100%', 'important');
      // Hide native horizontal scrollbar — slip bar is the scrubber.
      s.setProperty('scrollbar-width', 'none', 'important');
      try { s.setProperty('msOverflowStyle', 'none', 'important'); } catch { /* ignore */ }

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
      const prevMax = this._maxSlip;
      const max = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
      this._maxSlip = max;
      if (this._slipOffset > max) {
        this._slipOffset = max;
        this._applySlipToTarget();
      } else {
        this._applySlipToTarget();
      }
      this._updateKnobPosition();
      if (this._slipBar) {
        this._slipBar.setAttribute('data-kp-slip-empty', max <= 0 ? '1' : '0');
        // Hint UI when more content may still stream in
        try {
          this._slipBar.setAttribute(
            'data-kp-slip-growing',
            max > prevMax + 8 ? '1' : '0'
          );
        } catch { /* ignore */ }
      }
      // Content grew while user was already near the end — try another load cycle.
      if (max > prevMax + 8 && this._isNearSlipEnd()) {
        this._maybeWakeInfiniteScrollLoaders({ force: false });
      }
    } catch { /* ignore */ }
  }

  /**
   * Watch target DOM growth (infinite-scroll appends, lazy sections).
   * ResizeObserver only sees border-box changes; scrollWidth growth needs this.
   */
  _bindContentObserver() {
    this._unbindContentObserver();
    if (!this._target || typeof MutationObserver === 'undefined') return;

    try {
      this._mutationObserver = new MutationObserver((records) => {
        if (!this._active) return;
        // Ignore pure attribute noise on our own chrome if it ever nests.
        let meaningful = false;
        for (const rec of records) {
          if (rec.type === 'childList' &&
              ((rec.addedNodes && rec.addedNodes.length) ||
               (rec.removedNodes && rec.removedNodes.length))) {
            meaningful = true;
            break;
          }
          if (rec.type === 'characterData') {
            meaningful = true;
            break;
          }
        }
        if (!meaningful) return;

        if (this._mutationTimer) {
          try { clearTimeout(this._mutationTimer); } catch { /* ignore */ }
        }
        this._mutationTimer = setTimeout(() => {
          this._mutationTimer = 0;
          if (!this._active) return;
          // New nodes may change column count / width metrics slightly.
          this._applyMetrics();
          this._scheduleRemeasure();
        }, MUTATION_REMEASURE_MS);
      });

      this._mutationObserver.observe(this._target, {
        childList: true,
        subtree: true,
        characterData: true
      });
    } catch {
      this._mutationObserver = null;
    }
  }

  _unbindContentObserver() {
    if (this._mutationTimer) {
      try { clearTimeout(this._mutationTimer); } catch { /* ignore */ }
      this._mutationTimer = 0;
    }
    if (this._mutationObserver) {
      try { this._mutationObserver.disconnect(); } catch { /* ignore */ }
      this._mutationObserver = null;
    }
  }

  /**
   * @returns {boolean}
   */
  _isNearSlipEnd() {
    const max = this._maxSlip;
    // No horizontal overflow yet: treat as "at end" so short first pages can
    // still request more content (caller still throttles wakes).
    if (!(max > 0)) return true;
    const offset = this._slipOffset;
    if (offset >= Math.max(0, max - SLIP_END_PX)) return true;
    if (offset / max >= SLIP_END_RATIO) return true;
    return false;
  }

  /**
   * When the user slips near the end of columnized content, nudge the page so
   * infinite-scroll / IntersectionObserver loaders can fetch more. New nodes
   * are picked up by MutationObserver and extend the slip range.
   *
   * @param {{ force?: boolean }} [opts]
   */
  _maybeWakeInfiniteScrollLoaders(opts = {}) {
    if (!this._active || !this._target) return;
    if (!opts.force && !this._isNearSlipEnd()) return;

    const now = Date.now();
    if (!opts.force && now - this._lastWakeAt < WAKE_THROTTLE_MS) return;
    if (this._wakeInFlight) return;

    this._lastWakeAt = now;
    this._wakeInFlight = true;

    try {
      this._wakeInfiniteScrollLoaders();
    } catch (err) {
      if (window.KEYPILOT_DEBUG) {
        console.warn('[KeyPilot] Cols progressive wake failed:', err);
      }
    } finally {
      // Allow another wake after throttle even if restore is still finishing.
      try {
        if (this._wakeRestoreTimer) clearTimeout(this._wakeRestoreTimer);
      } catch { /* ignore */ }
      this._wakeRestoreTimer = setTimeout(() => {
        this._wakeRestoreTimer = 0;
        this._wakeInFlight = false;
        if (this._active) this._scheduleRemeasure();
      }, 320);
    }
  }

  /**
   * Best-effort: fire scroll listeners + bring tail content toward the
   * viewport so IntersectionObserver sentinels can activate.
   */
  _wakeInfiniteScrollLoaders() {
    const target = /** @type {HTMLElement|null} */ (this._target);
    if (!target) return;

    const savedSlip = this._slipOffset;
    const savedPageX = window.pageXOffset || 0;
    const savedPageY =
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    // 1) Ensure multicol is scrolled to the current slip (usually near end).
    try {
      target.scrollLeft = savedSlip;
    } catch { /* ignore */ }

    // 2) Dispatch scroll events many feeds listen for.
    try {
      window.dispatchEvent(new Event('scroll', { bubbles: false }));
      document.dispatchEvent(new Event('scroll', { bubbles: true }));
      target.dispatchEvent(new Event('scroll', { bubbles: false }));
    } catch { /* ignore */ }

    // 3) Nudge document scroll slightly (or to near bottom) then restore.
    //    Skipped when we fully freeze the page (page mode) — use temp unlock.
    const html = document.documentElement;
    let unlockedPage = false;
    let prevHtmlOverflow = null;
    let prevHtmlHeight = null;
    try {
      if (this._pageMode) {
        prevHtmlOverflow = html.style.getPropertyValue('overflow') || null;
        prevHtmlHeight = html.style.getPropertyValue('height') || null;
        html.style.setProperty('overflow', 'auto', 'important');
        html.style.removeProperty('height');
        html.style.removeProperty('max-height');
        unlockedPage = true;
      }

      const maxY = Math.max(
        0,
        Math.max(
          document.documentElement.scrollHeight || 0,
          document.body?.scrollHeight || 0
        ) - (window.innerHeight || 0)
      );

      // Prefer a small nudge from current position; if already at bottom, micro-jitter.
      let nudgeY = savedPageY + 48;
      if (nudgeY > maxY) nudgeY = Math.max(0, maxY);
      if (Math.abs(nudgeY - savedPageY) < 1 && maxY > 0) {
        nudgeY = Math.max(0, savedPageY - 1);
      }

      try {
        window.scrollTo({ top: nudgeY, left: savedPageX, behavior: 'auto' });
      } catch {
        window.scrollTo(savedPageX, nudgeY);
      }
      try {
        window.dispatchEvent(new Event('scroll', { bubbles: false }));
      } catch { /* ignore */ }
    } catch { /* ignore */ }

    // 4) Scroll a tail sentinel into view (IO-based infinite scroll).
    const tail = this._findTailSentinel(target);
    if (tail) {
      try {
        // nearest keeps page jump smaller; still often enough for IO.
        tail.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      } catch {
        try { /** @type {any} */ (tail).scrollIntoView(false); } catch { /* ignore */ }
      }
    }

    // 5) Restore our horizontal slip + document scroll position.
    const restore = () => {
      try {
        if (unlockedPage) {
          if (prevHtmlOverflow) {
            html.style.setProperty('overflow', prevHtmlOverflow, 'important');
          } else {
            html.style.setProperty('overflow', 'hidden', 'important');
          }
          if (prevHtmlHeight) {
            html.style.setProperty('height', prevHtmlHeight, 'important');
            html.style.setProperty('max-height', prevHtmlHeight, 'important');
          } else {
            // Re-apply page metrics
            this._applyMetrics();
          }
        }
        try {
          window.scrollTo({ top: savedPageY, left: savedPageX, behavior: 'auto' });
        } catch {
          window.scrollTo(savedPageX, savedPageY);
        }
        this._slipOffset = savedSlip;
        this._applySlipToTarget();
        this._scheduleRemeasure();
      } catch { /* ignore */ }
    };

    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(restore);
      });
    } catch {
      setTimeout(restore, 32);
    }

    // Late remeasure after network/DOM appends settle.
    try {
      setTimeout(() => { if (this._active) this._scheduleRemeasure(); }, 200);
      setTimeout(() => { if (this._active) this._scheduleRemeasure(); }, 600);
    } catch { /* ignore */ }
  }

  _cancelWakeLoaders() {
    this._wakeInFlight = false;
    if (this._wakeRestoreTimer) {
      try { clearTimeout(this._wakeRestoreTimer); } catch { /* ignore */ }
      this._wakeRestoreTimer = 0;
    }
  }

  /**
   * Prefer a substantial element near the end of the columnized tree
   * (infinite-scroll sentinels often sit after the last card).
   * @param {Element} root
   * @returns {Element|null}
   */
  _findTailSentinel(root) {
    if (!root) return null;
    try {
      const nodes = root.querySelectorAll('*');
      const start = Math.max(0, nodes.length - 60);
      for (let i = nodes.length - 1; i >= start; i--) {
        const n = nodes[i];
        if (!n || n.nodeType !== 1) continue;
        if (this._isKeyPilotNode(n)) continue;
        try {
          const r = n.getBoundingClientRect();
          // Accept zero-size sentinels (1×1 or 0-height IO markers) near the end.
          if (r.width >= 0 && r.height >= 0) {
            // Prefer something with a bit of box if available.
            if (r.width > 1 || r.height > 1 || i > nodes.length - 8) {
              return n;
            }
          }
        } catch { /* continue */ }
      }
      return root.lastElementChild || root;
    } catch {
      return root.lastElementChild || root;
    }
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
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => {
          this._applyMetrics();
          this._scheduleRemeasure();
        });
        if (this._shell) this._resizeObserver.observe(this._shell);
        if (this._body) this._resizeObserver.observe(this._body);
        if (this._target) this._resizeObserver.observe(this._target);
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

  /**
   * @param {HTMLElement} shell
   */
  _attachResize(shell) {
    this._disposeResizeApi();
    try {
      // Resize is allowed, but popover-resize already clamps to viewport − margin.
      // We re-assert maxHeight on every metrics pass as a belt-and-suspenders guard.
      this._resizeApi = makePopoverResizable(shell, {
        minWidth: 280,
        minHeight: 180,
        margin: 8,
        zIndex: 30,
        onResize: () => {
          this._clampShellToViewport();
          this._applyMetrics();
          this._scheduleRemeasure();
        },
        onResizeEnd: () => {
          this._clampShellToViewport();
          this._applyMetrics();
          this._scheduleRemeasure();
        }
      });
      // Explicit CSS cap so even non-handle size changes stay in-viewport.
      try {
        shell.style.maxHeight = `${this._maxShellHeightPx()}px`;
      } catch { /* ignore */ }
    } catch {
      this._resizeApi = null;
    }
  }

  _disposeResizeApi() {
    if (this._resizeApi) {
      try { this._resizeApi.dispose(); } catch { /* ignore */ }
      this._resizeApi = null;
    }
    if (this._shell) {
      try {
        if (this._shell.dataset) delete this._shell.dataset.kpResizable;
      } catch { /* ignore */ }
    }
  }

  /**
   * @param {HTMLElement} parent
   */
  _buildSlipBar(parent) {
    this._teardownSlipBar();

    const bar = document.createElement('div');
    bar.className = CSS_CLASSES.COLS_SLIP_BAR;
    bar.setAttribute('data-kp-cols-slip', 'true');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Column slip controls');
    const barMount = ensureOpenChromeShadow(bar, { id: 'columns-slip-controls' }) || bar;
    Object.assign(bar.style, {
      position: 'relative',
      left: 'auto',
      right: 'auto',
      bottom: 'auto',
      // Bleed to shell edges (cancel shell horizontal padding when present)
      marginLeft: this._pageMode ? '0' : `-${SHELL_PAD_PX}px`,
      marginRight: this._pageMode ? '0' : `-${SHELL_PAD_PX}px`,
      width: this._pageMode ? '100%' : `calc(100% + ${SHELL_PAD_PX * 2}px)`,
      maxWidth: 'none',
      flex: '0 0 auto',
      height: SLIP_BAR_HEIGHT,
      minHeight: SLIP_BAR_HEIGHT,
      zIndex: '2',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '0 10px',
      boxSizing: 'border-box',
      borderRadius: '0 0 6px 6px',
      borderTop: `1px solid ${COLORS.COLS_SHADOW_BRIGHT}`,
      background: 'linear-gradient(180deg, rgba(40, 24, 52, 0.96) 0%, rgba(24, 14, 34, 0.98) 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      fontFamily: KP_UI_FONT,
      color: 'rgba(255,255,255,0.9)',
      userSelect: 'none',
      pointerEvents: 'auto',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none'
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
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', 'Slip edit — shift column content');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', '0');
    track.tabIndex = 0;
    Object.assign(track.style, {
      position: 'relative',
      flex: '1 1 auto',
      minWidth: '48px',
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

    const expandBtn = this._createChromeButton({
      className: CSS_CLASSES.COLS_EXPAND_BTN,
      title: 'Open columns in popover',
      ariaLabel: 'Open columns in full-size popover',
      onClick: () => this._promoteToPopover()
    });
    expandBtn.appendChild(this._createViewportIcon());

    const closeBtn = this._createChromeButton({
      className: CSS_CLASSES.COLS_CLOSE_BTN,
      title: 'Close columns (restore element)',
      ariaLabel: 'Close columns and restore element',
      onClick: () => this.clear(),
      label: '×',
      semiTransparent: true
    });

    barMount.appendChild(label);
    barMount.appendChild(track);
    barMount.appendChild(expandBtn);
    barMount.appendChild(closeBtn);

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

    parent.appendChild(bar);

    this._slipBar = bar;
    this._track = track;
    this._knob = knob;
    this._expandBtn = expandBtn;
    this._closeBtn = closeBtn;
    this._updateKnobPosition();
  }

  /**
   * @param {{
   *   className: string,
   *   title: string,
   *   ariaLabel: string,
   *   onClick: () => void,
   *   label?: string,
   *   semiTransparent?: boolean
   * }} opts
   * @returns {HTMLButtonElement}
   */
  _createChromeButton(opts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = opts.className;
    btn.title = opts.title;
    btn.setAttribute('aria-label', opts.ariaLabel);
    Object.assign(btn.style, {
      margin: '0',
      appearance: 'none',
      WebkitAppearance: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      flex: '0 0 auto',
      width: '26px',
      height: '22px',
      padding: '0',
      borderRadius: '4px',
      border: `1px solid ${COLORS.COLS_PURPLE_BRIGHT}`,
      background: opts.semiTransparent
        ? 'rgba(156, 39, 176, 0.28)'
        : 'rgba(156, 39, 176, 0.45)',
      color: 'rgba(255,255,255,0.92)',
      fontFamily: KP_UI_FONT,
      fontSize: opts.label ? '16px' : '12px',
      fontWeight: '500',
      lineHeight: '1',
      cursor: 'pointer',
      opacity: opts.semiTransparent ? '0.72' : '0.92',
      boxShadow: `0 1px 3px ${COLORS.COLS_SHADOW}`,
      transition: 'opacity 120ms ease, background 120ms ease'
    });
    if (opts.label) btn.textContent = opts.label;
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '1';
      btn.style.background = 'rgba(156, 39, 176, 0.55)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = opts.semiTransparent ? '0.72' : '0.92';
      btn.style.background = opts.semiTransparent
        ? 'rgba(156, 39, 176, 0.28)'
        : 'rgba(156, 39, 176, 0.45)';
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { opts.onClick(); } catch (err) {
        console.warn('[KeyPilot] Cols chrome action failed:', err);
      }
    });
    return btn;
  }

  /**
   * Full-size / expand-to-viewport icon (corner brackets).
   * @returns {SVGSVGElement}
   */
  _createViewportIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'display:block; pointer-events:none;';

    // Outer frame + expand corners (full-size viewport metaphor).
    const paths = [
      // frame
      'M3 5 V3 H5',
      'M11 3 H13 V5',
      'M13 11 V13 H11',
      'M5 13 H3 V11',
      // inner diamond-ish rectangle
      'M5 5 H11 V11 H5 Z'
    ];
    for (const d of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.4');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    }
    return svg;
  }

  /**
   * Promote the column widget into a floating popover (Link Preview–style shell).
   */
  _promoteToPopover() {
    if (!this._active || !this._shell) return;

    // Page mode: already viewport-docked; promote body content isn't practical —
    // grow the dock into a larger centered panel that still only holds the slip chrome,
    // and re-apply body metrics for a larger column frame.
    if (this._pageMode) {
      this._popoverMode = true;
      try {
        Object.assign(this._shell.style, {
          left: '10vw',
          right: '10vw',
          bottom: '8vh',
          width: 'auto',
          maxWidth: 'none',
          zIndex: String(Z_INDEX.POPOVER_IFRAME_MODAL)
        });
      } catch { /* ignore */ }
      this._applyMetrics();
      this._scheduleRemeasure();
      return;
    }

    if (this._popoverMode) {
      // Already a popover — bump to near-full viewport.
      this._sizeShellAsPopover({ large: true });
      this._applyMetrics();
      this._scheduleRemeasure();
      return;
    }

    const shell = this._shell;
    let rect;
    try {
      rect = shell.getBoundingClientRect();
    } catch {
      rect = { width: 480, height: 360, left: 40, top: 40 };
    }

    // Leave a placeholder so the page layout doesn't collapse.
    try {
      if (!this._placeholder && shell.parentNode) {
        const ph = document.createElement('div');
        ph.className = CSS_CLASSES.COLS_PLACEHOLDER;
        ph.setAttribute('data-kp-cols-placeholder', 'true');
        ph.setAttribute('aria-hidden', 'true');
        Object.assign(ph.style, {
          width: `${Math.max(1, Math.floor(rect.width))}px`,
          height: `${Math.max(1, Math.floor(rect.height))}px`,
          margin: shell.style.margin || '8px 0',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          visibility: 'hidden'
        });
        shell.parentNode.insertBefore(ph, shell);
        this._placeholder = ph;
      }
    } catch { /* ignore */ }

    // Mount shell at document root so it isn't clipped by ancestors.
    try {
      document.documentElement.appendChild(shell);
    } catch {
      try { document.body.appendChild(shell); } catch { /* ignore */ }
    }

    this._popoverMode = true;
    this._sizeShellAsPopover({ large: false, fromRect: rect });

    // Popover look: solid chrome matching modal / Link Preview panels.
    try {
      Object.assign(shell.style, {
        background: 'linear-gradient(180deg, rgb(22, 16, 28) 0%, rgb(14, 10, 18) 100%)',
        border: `1px solid ${COLORS.COLS_PURPLE}`,
        boxShadow: `0 12px 40px rgba(0,0,0,0.65), 0 0 0 1px ${COLORS.COLS_SHADOW_BRIGHT}`,
        zIndex: String(Z_INDEX.POPOVER_IFRAME_MODAL)
      });
    } catch { /* ignore */ }

    // Re-attach resize (shell moved; ensure handles still work).
    this._attachResize(shell);
    this._applyMetrics();
    this._scheduleRemeasure();
  }

  /**
   * @param {{ large?: boolean, fromRect?: { width: number, height: number, left?: number, top?: number } }} [opts]
   */
  _sizeShellAsPopover(opts = {}) {
    const shell = this._shell;
    if (!shell) return;
    const margin = 16;
    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const large = !!opts.large;
    const w = large
      ? Math.max(320, vw - margin * 2)
      : Math.min(Math.max(420, opts.fromRect?.width || 640), Math.floor(vw * 0.8));
    const h = large
      ? Math.max(240, vh - margin * 2)
      : Math.min(Math.max(280, opts.fromRect?.height || 480), Math.floor(vh * 0.8));
    const left = Math.max(margin, Math.floor((vw - w) / 2));
    const top = Math.max(margin, Math.floor((vh - h) / 2));

    // Keep maxHeight tied to the viewport so expanded popovers still cannot
    // grow past 100vh (horizontal slip remains the overflow strategy).
    const maxShellH = this._maxShellHeightPx();
    Object.assign(shell.style, {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      right: 'auto',
      bottom: 'auto',
      width: `${w}px`,
      height: `${Math.min(h, maxShellH)}px`,
      maxWidth: `${Math.max(280, vw - margin * 2)}px`,
      maxHeight: `${maxShellH}px`,
      margin: '0',
      transform: 'none',
      inset: 'auto'
    });
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
      this._track?.setAttribute('aria-valuenow', String(Math.round(pct)));
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
    this._expandBtn = null;
    this._closeBtn = null;
  }

  /**
   * Restore target to original parent and remove shell / placeholder.
   */
  _unwrapShell() {
    const target = this._target;
    const shell = this._shell;
    const placeholder = this._placeholder;

    // Element mode: move target back out of shell.
    if (target && shell && !this._pageMode) {
      try {
        const body = this._body;
        // Prefer original parent; fall back to placeholder parent / shell parent.
        let parent = this._origParent;
        let next = this._origNext;
        if (!parent || !parent.isConnected) {
          if (placeholder && placeholder.parentNode) {
            parent = placeholder.parentNode;
            next = placeholder;
          } else if (shell.parentNode) {
            parent = shell.parentNode;
            next = shell.nextSibling;
          }
        }
        if (parent) {
          if (next && next.parentNode === parent) {
            parent.insertBefore(target, next);
          } else {
            parent.appendChild(target);
          }
        } else if (body && body.contains(target)) {
          // last resort: leave target where shell is
          try {
            if (shell.parentNode) shell.parentNode.insertBefore(target, shell);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    if (placeholder) {
      try { placeholder.remove(); } catch { /* ignore */ }
    }
    if (shell) {
      try { shell.remove(); } catch { /* ignore */ }
    }

    this._shell = null;
    this._body = null;
    this._placeholder = null;
  }
}
