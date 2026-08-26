/**
 * Navigation key handlers mixed onto KeyPilot.
 * Layout dispatch stays `this[handler]()`; these methods run with KeyPilot as `this`.
 */
import { COLORS, MODES, SCROLL } from '../config/constants.js';
import { MSG } from '../messaging/types.js';
import { DEFAULT_SETTINGS, scrollBehaviorFromSpeed } from './settings-manager.js';
import { getActionMode } from '../ui/key-action-settings.js';
import {
  elementFromPointDeep,
  findScrollableAtPoint,
  findScrollTargetAtPoint,
  getScrollCapacity,
  isDocumentScrollRoot,
  scrollAtPoint,
  scrollByAtPoint,
  scrollElementBy,
  scrollToEdgeAtPoint
} from '../utils/scroll-at-point.js';
import {
  createMapPanSession,
  endMapPanSession,
  ensureMapPanBridge,
  findMapSurfaceAtPoint,
  mapPanBy,
  SCROLL_LINE_MAP_DRAG_ENABLED
} from '../utils/map-surface-drag.js';
import { noteExtensionContextError } from '../utils/extension-context.js';

/** @param {Function} Base */
export function withNavigationHandlers(Base) {
  return class NavigationHandlers extends Base {
  handleScroll(e) {
    // Don't handle scroll events if extension is disabled
    if (!this.enabled) {
      return;
    }

    // Delegate scroll handling to optimized scroll manager
    // The scroll manager handles all the optimization logic
    return; // OptimizedScrollManager handles scroll events directly
  }

  /**
   * C / V scroll distance (px), from Settings with SCROLL fallback.
   * @returns {number}
   */
  _getHalfPageScrollPx() {
    const n = Number(this._settings?.scroll?.halfPagePx);
    if (Number.isFinite(n) && n > 0) return n;
    return SCROLL.HALF_PAGE_PX;
  }

  /**
   * Legacy page-step scroll distance (px). Used by popover parent→iframe
   * PAGE_UP / PAGE_DOWN; Z / X are cursor-aware edge jumps instead.
   * @returns {number}
   */
  _getPageScrollPx() {
    return SCROLL.PAGE_PX;
  }

  /**
   * CSS scroll-behavior derived from Settings scroll.speed.
   * @returns {'smooth'|'auto'}
   */
  _getScrollBehavior() {
    return scrollBehaviorFromSpeed(this._settings?.scroll?.speed ?? DEFAULT_SETTINGS.scroll.speed);
  }

  /**
   * Parent-document popover iframe scroll (C/V while the popover is open).
   * @param {KeyboardEvent} e
   * @param {number} sign
   * @param {number} stepPx
   */
  _scrollPopoverByHeld(e, sign, stepPx) {
    const s = sign < 0 ? -1 : 1;
    if (e?.repeat) {
      this._scrollHold.noteRepeat(e.key, s);
      return;
    }
    const behavior = this._getScrollBehavior();
    this.overlayManager?.scrollPopoverBy?.(s * stepPx, behavior);
    this._scrollHold.begin({
      key: e?.key,
      sign: s,
      target: { kind: 'popover' }
    });
  }

  handlePageUp(e) {
    if (!this._allowActionKey('handlePageUp', e)) return;
    this._scrollWindowByHeld(e, -1, this._getPageScrollPx());
    this.emitAction('scrollUp');
  }

  handlePageDown(e) {
    if (!this._allowActionKey('handlePageDown', e)) return;
    this._scrollWindowByHeld(e, 1, this._getPageScrollPx());
    this.emitAction('scrollDown');
  }

  handleInstantPageUp(e) {
    if (!this._allowActionKey('handleInstantPageUp', e)) return;
    this._scrollHalfPageAtCursor(-1, e);
    this.emitAction('scrollUp');
  }

  handleInstantPageDown(e) {
    if (!this._allowActionKey('handleInstantPageDown', e)) return;
    this._scrollHalfPageAtCursor(1, e);
    this.emitAction('scrollDown');
  }

  /**
   * @returns {Element}
   */
  _getWindowScrollEl() {
    try {
      return document.scrollingElement || document.documentElement || document.body;
    } catch {
      return document.documentElement;
    }
  }

  /**
   * Hold speed for continuous rAF (px/s). Scales lightly with configured step.
   * @param {number} [stepPx]
   * @returns {number}
   */
  _getScrollHoldSpeed(stepPx) {
    const base = Number(SCROLL.HOLD_PX_PER_SEC);
    const fallback = Number.isFinite(base) && base > 0 ? base : 1400;
    const step = Number(stepPx);
    if (!Number.isFinite(step) || step <= 0) return fallback;
    // ~2.8 configured steps per second while holding.
    return Math.max(600, Math.min(2400, step * 2.8));
  }

  /**
   * Per-frame apply for continuous hold (always instant — never CSS smooth).
   * @param {{ deltaPx: number, sign: number, target?: any }} ctx
   */
  _applyScrollHoldFrame(ctx) {
    const target = ctx?.target;
    const delta = Number(ctx?.deltaPx) || 0;
    if (!delta || !target) return;

    if (target.kind === 'popover') {
      this.overlayManager?.scrollPopoverBy?.(delta, 'auto');
      return;
    }

    if (target.kind === 'iframe') {
      const { x, y } = this._getScrollCursorPoint();
      this._tryScrollIframeUnderCursor(x, y, ctx.sign, 'auto', {
        mode: 'delta',
        deltaPx: Math.abs(delta)
      });
      return;
    }

    if (target.kind === 'window' || target.kind === 'element') {
      const el = target.el || this._getWindowScrollEl();
      const axis = target.axis === 'x' ? 'x' : 'y';
      const dx = axis === 'x' ? delta : 0;
      const dy = axis === 'y' ? delta : 0;
      scrollElementBy(el, dx, dy, 'auto');
    }
  }

  /**
   * Legacy window PAGE_UP / PAGE_DOWN: tap step + continuous rAF while held.
   * @param {KeyboardEvent} e
   * @param {number} sign
   * @param {number} stepPx
   */
  _scrollWindowByHeld(e, sign, stepPx) {
    const s = sign < 0 ? -1 : 1;
    if (e?.repeat) {
      this._scrollHold.noteRepeat(e.key, s);
      return;
    }
    const behavior = this._getScrollBehavior();
    const el = this._getWindowScrollEl();
    window.scrollBy({ top: s * stepPx, behavior });
    this._scrollHold.begin({
      key: e?.key,
      sign: s,
      target: { kind: 'window', el, axis: 'y' },
      speedPxPerSec: this._getScrollHoldSpeed(stepPx)
    });
  }

  /**
   * Last known cursor point, or viewport center when unknown.
   * @returns {{ x: number, y: number }}
   */
  _getScrollCursorPoint() {
    const st = this.state.getState();
    let x = Number(st?.lastMouse?.x);
    let y = Number(st?.lastMouse?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
      x = Math.floor(window.innerWidth / 2);
      y = Math.floor(window.innerHeight / 2);
    }
    return { x, y };
  }

  /**
   * C / V: scroll the overflow container under the cursor first (vertical, or
   * horizontal when that container only/can scroll on X). Falls back to the
   * page when nothing nested can move. Forwards into iframes via the light
   * frame-click-agent (FRAME_SCROLL).
   *
   * Tap: one configured step (smooth/instant from Settings).
   * Hold: continuous rAF instant deltas until keyup (ignores OS key-repeat).
   *
   * @param {number} sign  -1 = C (up/left), +1 = V (down/right)
   * @param {KeyboardEvent|null|undefined} [e]
   */
  _scrollHalfPageAtCursor(sign, e = null) {
    const stepPx = this._getHalfPageScrollPx();
    const behavior = this._getScrollBehavior();
    const s = sign < 0 ? -1 : 1;

    if (e?.repeat) {
      this._scrollHold.noteRepeat(e.key, s);
      return;
    }

    const { x, y } = this._getScrollCursorPoint();
    const speed = this._getScrollHoldSpeed(stepPx);

    // Iframe under cursor: top hit-testing only sees the shell.
    if (this._tryScrollIframeUnderCursor(x, y, s, behavior, { mode: 'delta', deltaPx: stepPx })) {
      this._scrollHold.begin({
        key: e?.key,
        sign: s,
        target: { kind: 'iframe' },
        speedPxPerSec: speed
      });
      return;
    }

    const found = findScrollTargetAtPoint(x, y, s);
    const el = found?.el || this._getWindowScrollEl();
    const axis = found?.axis || 'y';
    scrollAtPoint(x, y, s, stepPx, behavior);
    this._scrollHold.begin({
      key: e?.key,
      sign: s,
      target: { kind: 'element', el, axis },
      speedPxPerSec: speed
    });
  }

  /**
   * Jump-style for Scroll To Top / Bottom (`mode`: fade | smooth). Fade is the default.
   * @param {'PAGE_TOP'|'PAGE_BOTTOM'} functionId
   * @param {{ mode?: string }|null|undefined} [parameters]
   * @returns {'fade'|'smooth'}
   */
  _resolveEdgeJumpStyle(functionId, parameters) {
    const raw = parameters?.mode
      ?? getActionMode(this._getBuiltinFunctionActionParams(functionId), functionId);
    return raw === 'smooth' ? 'smooth' : 'fade';
  }

  /**
   * Overflow box under the cursor (iframe shell, nested scroller, or document root).
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} sign
   * @returns {Element|null}
   */
  _resolveEdgeJumpCoverEl(clientX, clientY, sign) {
    try {
      const under = this.detector?.deepElementFromPoint?.(clientX, clientY)
        || elementFromPointDeep(clientX, clientY);
      if (under && (under.tagName === 'IFRAME' || under.tagName === 'FRAME')) {
        if (!this._isKeyPilotUiElement?.(under)) return under;
      }
    } catch { /* ignore */ }
    try {
      const target = findScrollTargetAtPoint(clientX, clientY, sign);
      if (target?.el) return target.el;
    } catch { /* ignore */ }
    try {
      return document.scrollingElement || document.documentElement || document.body;
    } catch {
      return null;
    }
  }

  /**
   * Cover the overflow box, then run `fn` (instant jump).
   * @param {() => void} fn
   * @param {Element|null} coverEl
   * @param {'top'|'bottom'|null} [edge]
   */
  _runEdgeJump(fn, coverEl, edge = null) {
    const run = () => {
      try { fn(); } catch { /* ignore */ }
    };
    if (this.overlayManager?.runEdgeJumpFade) {
      void this.overlayManager.runEdgeJumpFade(run, {
        coverEl: coverEl || null,
        edge: edge === 'bottom' ? 'bottom' : 'top'
      });
      return;
    }
    run();
  }

  /**
   * Z / X: same cursor targeting as C / V, but jump to the start/end edge.
   *
   * @param {number} sign  -1 = Z (top/left), +1 = X (bottom/right)
   * @param {{ jumpStyle?: 'fade'|'smooth' }} [opts]
   */
  _scrollToEdgeAtCursor(sign, opts = {}) {
    const s = sign < 0 ? -1 : 1;
    const { x, y } = this._getScrollCursorPoint();
    const fade = opts.jumpStyle !== 'smooth';
    const behavior = fade ? 'auto' : this._getScrollBehavior();

    const jump = () => {
      if (this._tryScrollIframeUnderCursor(x, y, s, behavior, { mode: 'edge' })) {
        return;
      }
      scrollToEdgeAtPoint(x, y, s, behavior);
    };

    if (!fade) {
      jump();
      return;
    }

    this._runEdgeJump(jump, this._resolveEdgeJumpCoverEl(x, y, s), s < 0 ? 'top' : 'bottom');
  }

  /**
   * Popover iframe edge jump, using the same Fade / Scroll setting as the page keys.
   * @param {number} sign  -1 = top, +1 = bottom
   */
  _scrollPopoverToEdge(sign) {
    const functionId = sign < 0 ? 'PAGE_TOP' : 'PAGE_BOTTOM';
    const fade = this._resolveEdgeJumpStyle(functionId) === 'fade';
    const behavior = fade ? 'instant' : this._getScrollBehavior();
    const jump = () => {
      if (sign < 0) this.overlayManager?.scrollPopoverToTop?.(behavior);
      else this.overlayManager?.scrollPopoverToBottom?.(behavior);
    };
    if (!fade) {
      jump();
      return;
    }
    const coverEl = this.overlayManager?.popoverIframeElement
      || this.overlayManager?.popoverContainer
      || null;
    this._runEdgeJump(jump, coverEl, sign < 0 ? 'top' : 'bottom');
  }

  /**
   * When the pointer is over an iframe, scroll inside that frame at local
   * coordinates (same-origin directly; cross-origin via FRAME_SCROLL agent).
   *
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} sign
   * @param {ScrollBehavior} behavior
   * @param {{ mode?: 'delta'|'edge'|'xy', deltaPx?: number, deltaX?: number, deltaY?: number, iframe?: HTMLIFrameElement, localX?: number, localY?: number }} [opts]
   * @returns {boolean} true if an iframe under the cursor was targeted
   */
  _tryScrollIframeUnderCursor(clientX, clientY, sign, behavior, opts = {}) {
    const lockedIframe = opts.iframe && (opts.iframe.tagName === 'IFRAME' || opts.iframe.tagName === 'FRAME')
      ? /** @type {HTMLIFrameElement} */ (opts.iframe)
      : null;

    /** @type {HTMLIFrameElement|null} */
    let iframe = lockedIframe;
    if (!iframe) {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

      let under = null;
      try {
        under = this.detector?.deepElementFromPoint?.(clientX, clientY)
          || elementFromPointDeep(clientX, clientY);
      } catch {
        under = null;
      }
      if (!under || (under.tagName !== 'IFRAME' && under.tagName !== 'FRAME')) {
        return false;
      }

      try {
        if (this._isKeyPilotUiElement?.(under)) return false;
      } catch { /* ignore */ }

      iframe = /** @type {HTMLIFrameElement} */ (under);
    }

    let rect;
    try {
      rect = iframe.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;

    const localX = lockedIframe && Number.isFinite(opts.localX)
      ? Number(opts.localX)
      : clientX - rect.left;
    const localY = lockedIframe && Number.isFinite(opts.localY)
      ? Number(opts.localY)
      : clientY - rect.top;
    if (!lockedIframe && (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height)) {
      return false;
    }

    const mode = opts.mode === 'edge' ? 'edge' : (opts.mode === 'xy' ? 'xy' : 'delta');
    const payload = {
      type: MSG.FRAME_SCROLL,
      clientX: localX,
      clientY: localY,
      sign: sign < 0 ? -1 : 1,
      mode,
      deltaPx: mode === 'edge' || mode === 'xy' ? 0 : (Math.abs(Number(opts.deltaPx)) || 0),
      deltaX: mode === 'xy' ? (Number(opts.deltaX) || 0) : 0,
      deltaY: mode === 'xy' ? (Number(opts.deltaY) || 0) : 0,
      behavior: mode === 'xy' || behavior === 'auto' || behavior === 'instant' ? 'auto' : 'smooth',
      frameName: typeof iframe.name === 'string' ? iframe.name : ''
    };

    // Same-origin: scroll nested overflow inside the child document directly.
    try {
      const doc = iframe.contentDocument;
      const view = iframe.contentWindow;
      if (doc && view) {
        // Nested iframe: re-forward with coordinates local to the nested frame.
        let el = null;
        try {
          el = elementFromPointDeep(localX, localY, doc);
        } catch { el = null; }
        if (el && (el.tagName === 'IFRAME' || el.tagName === 'FRAME')) {
          try {
            const nested = /** @type {HTMLIFrameElement} */ (el);
            const nr = nested.getBoundingClientRect();
            nested.contentWindow?.postMessage({
              ...payload,
              clientX: localX - nr.left,
              clientY: localY - nr.top,
              frameName: typeof nested.name === 'string' ? nested.name : ''
            }, '*');
            return true;
          } catch { /* fall through to scroll this frame */ }
        }
        if (mode === 'xy') {
          scrollByAtPoint(localX, localY, payload.deltaX, payload.deltaY, payload.behavior, {
            doc,
            win: view
          });
        } else if (mode === 'edge') {
          scrollToEdgeAtPoint(localX, localY, payload.sign, payload.behavior, {
            doc,
            win: view
          });
        } else {
          scrollAtPoint(localX, localY, payload.sign, payload.deltaPx, payload.behavior, {
            doc,
            win: view
          });
        }
        return true;
      }
    } catch {
      // Cross-origin — postMessage / runtime relay.
    }

    let posted = false;
    try {
      const win = iframe.contentWindow;
      if (win) {
        win.postMessage(payload, '*');
        posted = true;
      }
    } catch { /* ignore */ }

    try {
      this._sendRuntimeMessage(payload, { silent: true });
      posted = true;
    } catch { /* ignore */ }

    return posted;
  }

  handlePageTop(e, parameters) {
    if (!this._allowActionKey('handlePageTop', e)) return;
    this._scrollToEdgeAtCursor(-1, { jumpStyle: this._resolveEdgeJumpStyle('PAGE_TOP', parameters) });
    this.emitAction('scrollTop');
  }

  handlePageBottom(e, parameters) {
    if (!this._allowActionKey('handlePageBottom', e)) return;
    this._scrollToEdgeAtCursor(1, { jumpStyle: this._resolveEdgeJumpStyle('PAGE_BOTTOM', parameters) });
    this.emitAction('scrollBottom');
  }

  handleScrollLineKey(e) {
    if (e?.repeat) return;
    const fromPointer = !!e && typeof e.button === 'number';
    if (!fromPointer && !this._allowActionKey('handleScrollLineKey', e)) return;
    const currentState = this.state.getState();
    if (currentState.mode === MODES.TEXT_FOCUS) return;
    if (currentState.mode === MODES.POPOVER || currentState.mode === MODES.OMNIBOX) return;

    if (this.state.isScrollLineMode()) {
      this._exitScrollLineMode();
      return;
    }
    this._enterScrollLineMode();
  }

  /**
   * Detach delegated pointerover hover targeting so Click Mode outlines do not
   * update while a selection/pick mode (Text Select, Element Select, Delete,
   * Cols, Scroll Line) owns the pointer. Restore with
   * {@link _restoreClickableHoverTracking}.
   */
  _suspendClickableHoverTracking() {
    try { this.state.setFocusElement(null); } catch { /* ignore */ }
    try { this.overlayManager?.hideFocusOverlay?.(); } catch { /* ignore */ }
    if (!this._domHoverListenersEnabled) return;
    try {
      this.intersectionManager?.setDomHoverListenersEnabled?.(
        false,
        (el) => this._handleDomHoverChange(el)
      );
    } catch { /* ignore */ }
  }

  /**
   * Re-attach pointerover hover targeting after a selection/pick mode ends.
   */
  _restoreClickableHoverTracking() {
    if (!this.enabled || !this._domHoverListenersEnabled) return;
    try {
      this.intersectionManager?.setDomHoverListenersEnabled?.(
        true,
        (el) => this._handleDomHoverChange(el)
      );
    } catch { /* ignore */ }
    try {
      const { x, y } = this._getScrollCursorPoint();
      this.intersectionManager?.resyncDomHoverAtPoint?.(x, y);
    } catch { /* ignore */ }
  }

  _enterScrollLineMode() {
    try {
      if (this.state.isHighlightMode()) this.cancelHighlightMode();
    } catch { /* ignore */ }
    try {
      if (this.state.isInspectorMode()) this.inspector.exit();
    } catch { /* ignore */ }

    this._suspendClickableHoverTracking();

    const { x, y } = this._getScrollCursorPoint();
    this._scrollLineOrigin = { x, y };
    this._scrollLineTarget = this._resolveScrollLineTarget(x, y);
    // Map pan for Scroll Line is suspended (SCROLL_LINE_MAP_DRAG_ENABLED).
    if (SCROLL_LINE_MAP_DRAG_ENABLED && this._scrollLineTarget?.kind === 'drag') {
      try { ensureMapPanBridge(); } catch { /* ignore */ }
      try {
        this._scrollLineDragSession = createMapPanSession(this._scrollLineTarget.el, x, y);
      } catch {
        this._scrollLineDragSession = null;
      }
    }

    // Show chrome before mode listeners run.
    try {
      this._scrollLineOverlay?.show(x, y);
    } catch { /* ignore */ }
    try { this._syncScrollLineTargetOverlay(); } catch { /* ignore */ }

    this.state.setMode(MODES.SCROLL_LINE);

    this._scrollLineLastTs = 0;
    if (this._scrollLineRaf) {
      try { cancelAnimationFrame(this._scrollLineRaf); } catch { /* ignore */ }
      this._scrollLineRaf = 0;
    }
    const tick = (ts) => {
      this._scrollLineRaf = 0;
      if (!this.state.isScrollLineMode()) return;
      this._tickScrollLine(ts);
      this._scrollLineRaf = window.requestAnimationFrame(tick);
    };
    this._scrollLineRaf = window.requestAnimationFrame(tick);
    this.emitAction('scrollLine');
  }

  _exitScrollLineMode() {
    if (this._scrollLineRaf) {
      try { cancelAnimationFrame(this._scrollLineRaf); } catch { /* ignore */ }
      this._scrollLineRaf = 0;
    }
    this._scrollLineLastTs = 0;
    this._scrollLineTarget = null;
    if (this._scrollLineDragSession) {
      try { endMapPanSession(); } catch { /* ignore */ }
    }
    this._scrollLineDragSession = null;
    try { this._scrollLineOverlay?.hide(); } catch { /* ignore */ }
    try {
      if (this.state.isScrollLineMode()) this.state.setMode(MODES.NONE);
    } catch { /* ignore */ }
    this._restoreClickableHoverTracking();
  }

  /**
   * Lock the scroller (or iframe) under the origin. Same targeting as C/V.
   * @param {number} x
   * @param {number} y
   */
  _resolveScrollLineTarget(x, y) {
    let under = null;
    try {
      under = this.detector?.deepElementFromPoint?.(x, y) || elementFromPointDeep(x, y);
    } catch {
      under = null;
    }
    if (SCROLL_LINE_MAP_DRAG_ENABLED) {
      try {
        const mapEl = findMapSurfaceAtPoint(x, y);
        if (mapEl) return { kind: 'drag', el: mapEl };
      } catch { /* fall through */ }
    }

    const skipWide = this._settings?.scroll?.linePreferPortraitTargets !== false;

    if (under && (under.tagName === 'IFRAME' || under.tagName === 'FRAME')) {
      try {
        if (!this._isKeyPilotUiElement?.(under)) {
          const iframe = /** @type {HTMLIFrameElement} */ (under);
          const rect = iframe.getBoundingClientRect();
          const vw = window.innerWidth || 0;
          const vh = window.innerHeight || 0;
          const fullPane = !!(
            rect &&
            vw > 0 &&
            vh > 0 &&
            rect.width >= vw * 0.94 &&
            rect.height >= vh * 0.94
          );
          // Skip landscape iframe strips (carousel embeds), not a full-viewport pane.
          const wideStrip = skipWide && rect && rect.width > rect.height + 1 && !fullPane;
          if (rect && rect.width > 0 && rect.height > 0 && !wideStrip) {
            return {
              kind: 'iframe',
              iframe,
              localX: x - rect.left,
              localY: y - rect.top
            };
          }
        }
      } catch { /* fall through */ }
    }

    const found = findScrollableAtPoint(x, y, { skipWideTargets: skipWide });
    if (found?.el) {
      return { kind: 'element', el: found.el, canX: !!found.canX, canY: !!found.canY };
    }

    const se = document.scrollingElement || document.documentElement || document.body;
    if (se) {
      try {
        const cap = getScrollCapacity(se);
        if (cap.canX || cap.canY) {
          return { kind: 'element', el: se, canX: !!cap.canX, canY: !!cap.canY };
        }
      } catch { /* ignore */ }
    }
    return null;
  }

  /**
   * Outline the locked nested scroller (or iframe). Hidden for document /
   * near-full-viewport roots so page scroll does not draw a screen-sized box.
   */
  _syncScrollLineTargetOverlay() {
    const overlay = this._scrollLineOverlay;
    if (!overlay || typeof overlay.setTargetBox !== 'function') return;

    const target = this._scrollLineTarget;
    /** @type {Element|null} */
    let el = null;
    if (target?.kind === 'iframe' && target.iframe) {
      el = target.iframe;
    } else if (target?.kind === 'drag' && target.el) {
      el = target.el;
    } else if (target?.kind === 'element' && target.el) {
      el = target.el;
    }
    if (!el || el.nodeType !== 1) {
      overlay.setTargetBox(null);
      return;
    }

    try {
      if (isDocumentScrollRoot(el, document)) {
        overlay.setTargetBox(null);
        return;
      }
    } catch { /* ignore */ }

    let r = null;
    try { r = el.getBoundingClientRect(); } catch { r = null; }
    if (!r || !(r.width > 8) || !(r.height > 8)) {
      overlay.setTargetBox(null);
      return;
    }

    try {
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      if (vw > 0 && vh > 0 && r.width >= vw * 0.94 && r.height >= vh * 0.94) {
        overlay.setTargetBox(null);
        return;
      }
    } catch { /* ignore */ }

    let radius = '0';
    try {
      radius = String(window.getComputedStyle(el).borderRadius || '0');
    } catch { radius = '0'; }

    overlay.setTargetBox({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      radius
    });
  }

  /**
   * Ease-in curve: small moves stay slow; speed ramps toward the cap as the
   * pointer approaches LINE_CURVE_RANGE_PX beyond the dead zone.
   * @param {number} offset
   * @returns {number} px/s
   */
  _scrollLineAxisVelocity(offset) {
    const mag = Math.abs(Number(offset) || 0);
    const dead = Number(SCROLL.LINE_DEADZONE_PX) || 12;
    if (mag <= dead) return 0;
    const range = Math.max(1, Number(SCROLL.LINE_CURVE_RANGE_PX) || 360);
    const exp = Number(SCROLL.LINE_CURVE_EXPONENT);
    const power = Number.isFinite(exp) && exp > 0 ? exp : 2;
    const cap = Number(SCROLL.LINE_MAX_PX_PER_SEC) || 2400;
    const t = Math.min(1, (mag - dead) / range);
    const speed = cap * Math.pow(t, power);
    return (offset < 0 ? -1 : 1) * speed;
  }

  /**
   * @param {number} ts
   */
  _tickScrollLine(ts) {
    const last = this._scrollLineLastTs;
    this._scrollLineLastTs = ts;
    if (!last) return;

    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    if (!dt) return;

    const mouse = this.state.getState()?.lastMouse || this._scrollLineOrigin;
    const ox = this._scrollLineOrigin?.x || 0;
    const oy = this._scrollLineOrigin?.y || 0;
    const mx = Number(mouse?.x);
    const my = Number(mouse?.y);
    const px = Number.isFinite(mx) ? mx : ox;
    const py = Number.isFinite(my) ? my : oy;

    try { this._scrollLineOverlay?.updatePointer(px, py); } catch { /* ignore */ }
    try { this._syncScrollLineTargetOverlay(); } catch { /* ignore */ }

    let vx = this._scrollLineAxisVelocity(px - ox);
    let vy = this._scrollLineAxisVelocity(py - oy);
    const dx = vx * dt;
    const dy = vy * dt;
    if (!dx && !dy) return;

    const target = this._scrollLineTarget;
    if (SCROLL_LINE_MAP_DRAG_ENABLED && target?.kind === 'drag' && target.el) {
      if (!this._scrollLineDragSession || this._scrollLineDragSession.el !== target.el) {
        this._scrollLineDragSession = createMapPanSession(target.el, ox, oy);
      }
      mapPanBy(this._scrollLineDragSession, dx, dy);
      return;
    }

    if (target?.kind === 'iframe' && target.iframe) {
      this._tryScrollIframeUnderCursor(ox, oy, 0, 'auto', {
        mode: 'xy',
        deltaX: dx,
        deltaY: dy,
        iframe: target.iframe,
        localX: target.localX,
        localY: target.localY
      });
      return;
    }

    if (target?.kind === 'element' && target.el) {
      let applyX = target.canX ? dx : 0;
      let applyY = target.canY ? dy : 0;
      if (!applyX && !applyY) return;
      scrollElementBy(target.el, applyX, applyY, 'auto');
      return;
    }

    try {
      window.scrollBy({ left: dx, top: dy, behavior: 'auto' });
    } catch { /* ignore */ }
  }

  /**
   * True when the event matches browser history back/forward keybindings.
   * @param {Record<string, any>} KB
   * @param {KeyboardEvent} e
   */
  _isHistoryNavigationKey(KB, e) {
    if (!KB || !e) return false;
    return !!(
      KB.BACK?.keys?.includes?.(e.key) ||
      KB.BACK2?.keys?.includes?.(e.key) ||
      KB.FORWARD?.keys?.includes?.(e.key)
    );
  }

  /**
   * Run the history handler that matches this key (back vs forward).
   * @param {Record<string, any>} KB
   * @param {KeyboardEvent} e
   */
  _runHistoryNavigationKey(KB, e) {
    if (KB.FORWARD?.keys?.includes?.(e.key)) {
      this.handleForwardKey();
      return;
    }
    // BACK and BACK2 share the same handler.
    this.handleBackKey();
  }

  handleBackKey(e) {
    // Never run history shortcuts while typing (D/S are real letters in text mode).
    if (!this._allowActionKey('handleBackKey', e)) return;
    // Emit BEFORE navigating away so onboarding (and other listeners) can observe/persist it.
    // This is synchronous so listeners run before any navigation is requested.
    this.emitAction('back');
    this._navigateHistory(-1, { recordTransientAction: 'back' });
  }

  handleForwardKey(e) {
    if (!this._allowActionKey('handleForwardKey', e)) return;
    this._navigateHistory(1);
  }

  /**
   * Navigate browser session history (back/forward).
   *
   * Uses `history.back/forward` as the primary action (immediate, same stack as the page).
   * Transient onboarding actions are recorded separately via the service worker.
   *
   * Silent hops (common SPA / in-page patterns that feel like "D did nothing"):
   * - Only cleared a `#hash` fragment
   * - URL is unchanged after a same-document `pushState` entry
   * - Only the query string changed on the same path (e.g. openrouter.ai/activity
   *   pushes `?from=&to=&date_preset=` after load — first back only strips filters)
   * In those cases, take one automatic extra step so one keypress matches user intent.
   *
   * @param {-1|1} direction
   * @param {{ recordTransientAction?: string }} [opts]
   */
  _navigateHistory(direction, opts = {}) {
    const dir = direction < 0 ? -1 : 1;
    const recordAction = typeof opts.recordTransientAction === 'string' ? opts.recordTransientAction : '';

    // Onboarding recovery: record before unload, fire-and-forget (do not gate navigation on it).
    if (recordAction) {
      this._sendRuntimeMessage({
        type: MSG.TRANSIENT_ACTION,
        action: recordAction,
        timestamp: Date.now()
      }, { silent: true });
    }

    const step = () => {
      try {
        if (dir < 0) history.back();
        else history.forward();
      } catch { /* ignore */ }
    };

    // Popover iframe: only this frame's history.
    if (window !== window.top) {
      step();
      return;
    }

    // Only auto-skip "invisible" hops when going back.
    if (dir >= 0) {
      step();
      return;
    }

    const beforeHref = location.href;
    const beforeOrigin = location.origin;
    const beforePathname = location.pathname;
    const beforeSearch = location.search || '';
    const beforePath = `${beforePathname}${beforeSearch}`;
    const beforeHash = location.hash || '';

    // Cancel any previous skip watcher (rapid D presses).
    try {
      if (this._historySkipCleanup) this._historySkipCleanup();
    } catch { /* ignore */ }
    this._historySkipCleanup = null;

    let extraHopsUsed = 0;
    const maxExtraHops = 1;

    const cleanup = () => {
      if (popListener) {
        try { window.removeEventListener('popstate', popListener); } catch { /* ignore */ }
        popListener = null;
      }
      if (timer) {
        try { clearTimeout(timer); } catch { /* ignore */ }
        timer = 0;
      }
      if (this._historySkipCleanup === cleanup) this._historySkipCleanup = null;
    };

    let popListener = () => {
      try {
        if (extraHopsUsed >= maxExtraHops) {
          cleanup();
          return;
        }
        const path = `${location.pathname}${location.search}`;
        const hash = location.hash || '';
        const href = location.href;
        const search = location.search || '';

        // Invisible hop patterns:
        // 1) Full URL unchanged after back (same-document pushState with no URL change)
        // 2) Only a hash fragment was cleared (page#section → page)
        // 3) Same origin+pathname, only query string changed (SPA filters / date presets)
        const urlUnchanged = href === beforeHref;
        const onlyClearedHash = !!beforeHash && !hash && path === beforePath;
        const samePath =
          location.origin === beforeOrigin &&
          location.pathname === beforePathname;
        const onlyQueryChanged = samePath && search !== beforeSearch;

        if (urlUnchanged || onlyClearedHash || onlyQueryChanged) {
          extraHopsUsed += 1;
          step();
          // Keep listening briefly for the extra hop's popstate; timeout cleans up.
          return;
        }
      } catch { /* ignore */ }
      cleanup();
    };

    let timer = 0;
    try {
      window.addEventListener('popstate', popListener);
      // SPA query-param hops can settle a bit after popstate; keep watcher briefly.
      timer = window.setTimeout(cleanup, 700);
      this._historySkipCleanup = cleanup;
    } catch {
      popListener = null;
    }

    step();
  }

  handleTabLeftKey(e) {
    if (!this._allowActionKey('handleTabLeftKey', e)) return;
    // Switch to the tab to the left
    // Emit + record transient action BEFORE switching tabs so onboarding can persist/recover reliably.
    this.emitAction('tabLeft');
    this._sendRuntimeMessage({ type: MSG.TRANSIENT_ACTION, action: 'tabLeft', timestamp: Date.now() }, { silent: true });
    if (!this._sendRuntimeMessage({ type: MSG.TAB_LEFT }, {
      onResponse: (response) => this._notifyTabSwitchFailure(response)
    })) {
      // Context invalidated — user already notified once via _handleExtensionContextInvalidated
    }
  }

  handleTabRightKey(e) {
    if (!this._allowActionKey('handleTabRightKey', e)) return;
    // Switch to the tab to the right
    // Emit + record transient action BEFORE switching tabs so onboarding can persist/recover reliably.
    this.emitAction('tabRight');
    this._sendRuntimeMessage({ type: MSG.TRANSIENT_ACTION, action: 'tabRight', timestamp: Date.now() }, { silent: true });
    if (!this._sendRuntimeMessage({ type: MSG.TAB_RIGHT }, {
      onResponse: (response) => this._notifyTabSwitchFailure(response)
    })) {
      // Context invalidated — user already notified once via _handleExtensionContextInvalidated
    }
  }

  /**
   * Show the top-center flash alert when left/right tab switch has nowhere to go
   * (or otherwise fails in the background).
   * @param {unknown} response
   */
  _notifyTabSwitchFailure(response) {
    if (!response || typeof response !== 'object') return;
    if (/** @type {{ type?: string }} */ (response).type !== MSG.ERROR) return;

    const error = String(/** @type {{ error?: unknown }} */ (response).error || '');
    const message = /no valid tabs to switch to/i.test(error)
      ? 'No other tabs to switch to'
      : (error ? error.replace(/^Failed to switch tab:\s*/i, '') : 'Failed to switch tab');

    this.showFlashNotification(message, COLORS.NOTIFICATION_INFO);
  }

  handleRootKey(e) {
    if (!this._allowActionKey('handleRootKey', e)) return;
    console.log('[KeyPilot] Root key pressed!');
    console.log('[KeyPilot] Current URL:', window.location.href);
    console.log('[KeyPilot] Origin:', window.location.origin);

    // Navigate to the site root (origin)
    const rootUrl = window.location.origin;
    if (rootUrl && rootUrl !== window.location.href) {
      console.log('[KeyPilot] Navigating to root:', rootUrl);
      this.showFlashNotification('Navigating to Site Root...', COLORS.NOTIFICATION_INFO);
      window.location.href = rootUrl;
    } else {
      console.log('[KeyPilot] Already at root, no navigation needed');
    }
  }

  handleCloseTabKey(e) {
    if (!this._allowActionKey('handleCloseTabKey', e)) return;
    console.log('[KeyPilot] Close tab key pressed!');
    
    try {
      // Send message to background script to close the current tab
      if (!this._sendRuntimeMessage({ type: MSG.CLOSE_TAB })) {
        if (!this._extensionContextInvalidatedHandled) {
          this.showFlashNotification('Failed to Close Tab', COLORS.NOTIFICATION_ERROR);
        }
        return;
      }
      this.showFlashNotification('Closing Tab...', COLORS.NOTIFICATION_INFO);
    } catch (error) {
      if (noteExtensionContextError(error)) {
        this._handleExtensionContextInvalidated();
        return;
      }
      console.error('[KeyPilot] Failed to close tab:', error);
      this.showFlashNotification('Failed to Close Tab', COLORS.NOTIFICATION_ERROR);
    }
  }

  handleNewTabKey(e) {
    if (!this._allowActionKey('handleNewTabKey', e)) return;
    console.log('[KeyPilot] New tab key pressed!');
    
    try {
      // Emit + record transient action BEFORE opening the new tab so onboarding can persist/recover reliably.
      this.emitAction('newTab');
      this._sendRuntimeMessage({ type: MSG.TRANSIENT_ACTION, action: 'newTab', timestamp: Date.now() }, { silent: true });

      // Send message to background script to open a new tab
      if (!this._sendRuntimeMessage({ type: MSG.NEW_TAB })) {
        // Invalidated context already shows a reload hint once.
        if (!this._extensionContextInvalidatedHandled) {
          this.showFlashNotification('Failed to Open New Tab', COLORS.NOTIFICATION_ERROR);
        }
        return;
      }
      this.showFlashNotification('Opening New Tab...', COLORS.NOTIFICATION_INFO);
    } catch (error) {
      if (noteExtensionContextError(error)) {
        this._handleExtensionContextInvalidated();
        return;
      }
      console.error('[KeyPilot] Failed to open new tab:', error);
      this.showFlashNotification('Failed to Open New Tab', COLORS.NOTIFICATION_ERROR);
    }
  }

  };
}
