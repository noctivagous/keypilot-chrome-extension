/**
 * Floating keyboard reference panel (content-script friendly).
 *
 * Shows KeyPilot's keyboard visualization in a small, fixed-position panel.
 *
 * Visibility must not rely on the `hidden` attribute alone: hostile host CSS
 * (e.g. Zapier) can override UA `[hidden]{display:none}`. Always pair
 * hidden/aria-hidden/kpv2-hidden with `display:none !important`.
 *
 * Still light DOM today so `renderKeybindingsKeyboard()` can inject CSS into
 * `document.head`. For full paint isolation, migrate to an open shadow root and
 * inject styles into that root (see ensureStylesInjected rootNode work); open
 * mode keeps elementFromPoint / composedPath piercing used by KeyPilot.
 */
import { renderKeybindingsKeyboard } from './keybindings-ui.js';
import { setKeyPressedState } from './keybindings-ui-shared.js';
import { Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import { getSettings, setSettings, SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../modules/settings-manager.js';
import { makePopoverResizable } from '../utils/popover-resize.js';
import {
  PANEL_POSITION_MARGIN_PX,
  applyPanelPosition,
  makePanelDraggable,
  normalizePanelPositionState
} from '../utils/panel-position.js';

/** Match legacy keyboard dock inset (left/bottom 16px) while still using shared snap/clamp. */
const KEYBOARD_POSITION_MARGIN_PX = Math.max(PANEL_POSITION_MARGIN_PX, 16);
/** Keep max size in sync with margin on every edge (was 24 → asymmetric right/bottom gaps). */
const KEYBOARD_MAX_VIEWPORT_INSET_PX = KEYBOARD_POSITION_MARGIN_PX * 2;

export class FloatingKeyboardHelp {
  /**
   * @param {Object} params
   * @param {Record<string, any>} params.keybindings
   * @param {any[]} [params.keyboardLayout]
   * @param {string} [params.layoutId]
   * @param {import('../modules/settings-manager.js').PanelPositionSettings|null} [params.panelPosition]
   *   Optional known dock/free position (from KeyPilot settings). When provided,
   *   the first show paints at this location instead of flashing the default corner.
   */
  constructor({ keybindings, keyboardLayout, layoutId, panelPosition } = {}) {
    this.keybindings = keybindings || {};
    this.keyboardLayout = keyboardLayout || null;
    this.layoutId = typeof layoutId === 'string' ? layoutId : '';
    this.root = null;
    this.keyboardContainer = null;
    this.closeBtn = null;
    this.hintEl = null;
    /** @type {HTMLElement|null} */
    this._titlebar = null;
    this._onCloseClick = this._onCloseClick.bind(this);

    // Keydown/keyup visual feedback
    this._pressedLabels = new Set();
    this._keyElsByLabel = new Map();
    /** @type {Map<string, HTMLElement[]>} */
    this._keyElsByActionId = new Map();
    this._keydownBound = false;
    this._onDocKeyDown = this._onDocKeyDown.bind(this);
    this._onDocKeyUp = this._onDocKeyUp.bind(this);
    this._onWinBlur = this._onWinBlur.bind(this);

    // When hovering a page link, highlight action keys that can activate it.
    this._linkHoverHintActive = false;
    /** @type {Set<string>} */
    this._linkHoverHintActionIds = new Set();

    // Text-focus mode: all keys grayed out; ACTIVATE only lights up while the
    // hover-click countdown is armed on a clickable under the cursor.
    this._textModeFilterActive = false;
    this._textModeActivateArmed = false;

    this._keyFeedbackEnabled = true;
    this._settingsBound = false;
    this._onStorageChanged = this._onStorageChanged.bind(this);

    // Titlebar drag + edge/corner resize (via shared panel-position system)
    this._windowChromeBound = false;
    /** @type {(() => void)|null} */
    this._resizeDispose = null;
    /** @type {(() => void)|null} */
    this._dragDispose = null;

    /** @type {import('../modules/settings-manager.js').PanelPositionSettings|null} */
    this._panelPosition = {
      ...DEFAULT_SETTINGS.panelPositions.keyboardReference
    };
    /** True once position has been seeded from settings/DOM or loaded from storage. */
    this._positionHydrated = false;
    /** Monotonic token so delayed first-show reveals don't race with hide/cleanup. */
    this._showGeneration = 0;
    this._positionApplyScheduled = false;
    this._onWinResizePosition = this._onWinResizePosition.bind(this);
    this._suppressPositionPersist = false;

    if (panelPosition && typeof panelPosition === 'object') {
      this._seedPanelPosition(panelPosition, { hydrated: true });
    }
  }

  /**
   * Update in-memory dock/free position (does not paint unless root exists).
   * @param {import('../modules/settings-manager.js').PanelPositionSettings|null|undefined} next
   * @param {{ hydrated?: boolean }} [opts]
   */
  _seedPanelPosition(next, opts = {}) {
    const normalized = normalizePanelPositionState(
      next,
      DEFAULT_SETTINGS.panelPositions.keyboardReference
    ) || { ...DEFAULT_SETTINGS.panelPositions.keyboardReference };
    this._panelPosition = {
      left: normalized.left,
      top: normalized.top,
      anchor: normalized.anchor === undefined ? null : normalized.anchor
    };
    if (opts.hydrated) this._positionHydrated = true;
  }

  /**
   * Public: seed position from already-loaded KeyPilot settings before show().
   * @param {import('../modules/settings-manager.js').PanelPositionSettings|null|undefined} next
   */
  setPanelPositionFromSettings(next) {
    if (!next || typeof next !== 'object') return;
    this._seedPanelPosition(next, { hydrated: true });
    if (this.root) this._applyPanelPositionNow();
  }

  /**
   * Read left/top (and optional anchor attr) already painted on a shell element.
   * @param {HTMLElement|null} el
   * @returns {import('../modules/settings-manager.js').PanelPositionSettings|null}
   */
  _readPositionFromDom(el) {
    if (!el || !el.style) return null;
    try {
      const left = parseFloat(el.style.left);
      const top = parseFloat(el.style.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
      let anchor = null;
      try {
        const attr = el.getAttribute('data-kp-panel-anchor');
        if (attr) anchor = attr;
      } catch { /* ignore */ }
      // Free positions use left/top with no anchor (or explicit null).
      return { left, top, anchor: anchor || null };
    } catch {
      return null;
    }
  }

  setKeybindings(keybindings) {
    this.keybindings = keybindings || {};
    if (this.root && !this.root.hidden) {
      this._render();
    }
  }

  setKeyboardLayout({ keyboardLayout, layoutId } = {}) {
    this.keyboardLayout = keyboardLayout || null;
    this.layoutId = typeof layoutId === 'string' ? layoutId : '';
    if (this.root && !this.root.hidden) {
      this._render();
    }
  }

  isVisible() {
    if (!this.root || !this.root.isConnected) return false;
    if (this.root.hidden) return false;
    try {
      if (this.root.getAttribute('aria-hidden') === 'true') return false;
    } catch { /* ignore */ }
    try {
      if (this.root.classList?.contains('kpv2-hidden')) return false;
    } catch { /* ignore */ }
    // Inline display:flex (panel chrome) can override [hidden] on some host pages;
    // treat explicit none as hidden as well.
    try {
      if (this.root.style && this.root.style.display === 'none') return false;
    } catch { /* ignore */ }
    return true;
  }

  /**
   * Show/hide must set both the `hidden` attribute and inline display.
   * Our panel chrome uses display:flex; without clearing it, hide() can fail on
   * pages that weaken or override [hidden]{display:none} (Zapier author CSS does
   * this). Use !important + kpv2-hidden so host sheets cannot re-show the panel.
   * @param {boolean} visible
   */
  _setRootVisible(visible) {
    if (!this.root) return;
    if (visible) {
      try { this.root.hidden = false; } catch { /* ignore */ }
      try { this.root.classList.remove('kpv2-hidden'); } catch { /* ignore */ }
      try {
        this.root.style.setProperty('display', 'flex', 'important');
        this.root.style.setProperty('pointer-events', 'auto', 'important');
      } catch {
        try { this.root.style.display = 'flex'; } catch { /* ignore */ }
      }
      try { this.root.setAttribute('aria-hidden', 'false'); } catch { /* ignore */ }
    } else {
      try { this.root.hidden = true; } catch { /* ignore */ }
      try { this.root.classList.add('kpv2-hidden'); } catch { /* ignore */ }
      try {
        this.root.style.setProperty('display', 'none', 'important');
        this.root.style.setProperty('pointer-events', 'none', 'important');
      } catch {
        try { this.root.style.display = 'none'; } catch { /* ignore */ }
      }
      try { this.root.setAttribute('aria-hidden', 'true'); } catch { /* ignore */ }
    }
  }

  show() {
    // Never show inside iframes (avoids duplicating the panel in popover iframes).
    if (window !== window.top) return;
    const gen = ++this._showGeneration;
    this._ensure();
    this._bindSettingsSync();
    this._refreshKeyFeedbackSetting(); // async; best-effort

    // Always paint the best-known position before the panel becomes visible so a
    // saved free/dock location never flashes at the default bottom-left corner.
    this._applyPanelPositionNow();

    const reveal = () => {
      if (gen !== this._showGeneration) return;
      if (!this.root || !this.root.isConnected) return;
      this._applyPanelPositionNow();
      this._setRootVisible(true);
      this._render();
      // Reclamp after keyboard rows size (free tops can shift once height is known).
      this._schedulePanelPositionAfterLayout();
      this._bindKeydownFeedback();
      try {
        const mode = window.__KeyPilotInstance?.state?.getState?.()?.mode;
        const inText = String(mode || '') === 'text_focus';
        this.setTextModeFilter(inText || this._textModeFilterActive);
      } catch {
        if (this._textModeFilterActive) this._applyTextModeFilterClasses(true);
      }
    };

    if (this._positionHydrated) {
      reveal();
      // Background refresh keeps multi-tab moves in sync without a default-corner flash.
      void this._refreshPanelPosition();
      return;
    }

    // First show without a seeded position: stay hidden until storage returns.
    // (Root remains hidden from _ensure; do not call _setRootVisible(true) yet.)
    void this._refreshPanelPosition().finally(() => {
      if (gen !== this._showGeneration) return;
      this._positionHydrated = true;
      reveal();
    });
  }

  hide() {
    // Invalidate any in-flight first-show reveal so a late storage resolve cannot re-open.
    this._showGeneration += 1;
    this._setRootVisible(false);
    this.setLinkHoverHints(false);
    this.setTextModeFilter(false);
    this._unbindKeydownFeedback();
    this._unbindSettingsSync();
  }

  toggle() {
    if (this.isVisible()) this.hide();
    else this.show();
  }

  cleanup() {
    this._showGeneration += 1;
    try {
      if (this.closeBtn) this.closeBtn.removeEventListener('click', this._onCloseClick);
    } catch { /* ignore */ }
    this._unbindWindowChrome();
    this._unbindKeydownFeedback();
    this._unbindSettingsSync();
    try { this._posResizeObserver?.disconnect?.(); } catch { /* ignore */ }
    this._posResizeObserver = null;
    try {
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    } catch { /* ignore */ }
    this.root = null;
    this.keyboardContainer = null;
    this.closeBtn = null;
    this._titlebar = null;
  }

  /**
   * Panel shell chrome shared by create + early-inject adopt paths.
   * Position is applied separately via the shared panel-position system
   * (default anchor: bottom-left).
   * @param {HTMLElement} root
   */
  _applyProPanelChrome(root) {
    if (!root || !root.style) return;
    // Preserve intentional hide (display:none / hidden / kpv2-hidden) — chrome
    // must not force flex on a hidden panel (that broke K-toggle / close after
    // we added flex layout). Zapier-class hosts need !important on display.
    let show = true;
    try {
      if (
        root.hidden ||
        root.getAttribute('aria-hidden') === 'true' ||
        root.classList?.contains('kpv2-hidden') ||
        root.style.display === 'none'
      ) {
        show = false;
      }
    } catch { /* ignore */ }
    Object.assign(root.style, {
      position: 'fixed',
      width: '760px',
      // Symmetric inset on all sides (matches KEYBOARD_POSITION_MARGIN_PX).
      maxWidth: `calc(100vw - ${KEYBOARD_MAX_VIEWPORT_INSET_PX}px)`,
      maxHeight: `calc(100vh - ${KEYBOARD_MAX_VIEWPORT_INSET_PX}px)`,
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
      zIndex: String(Z_INDEX.FLOATING_KEYBOARD_HELP),
      background: 'rgba(10, 11, 14, 0.98)',
      color: 'rgba(248, 250, 252, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    });
    try {
      root.style.setProperty('display', show ? 'flex' : 'none', 'important');
      root.style.setProperty('pointer-events', show ? 'auto' : 'none', 'important');
    } catch {
      try {
        root.style.display = show ? 'flex' : 'none';
        root.style.pointerEvents = show ? 'auto' : 'none';
      } catch { /* ignore */ }
    }
    applyPopupThemeVars(root);
  }

  /**
   * Apply current in-memory panel position to the root element.
   * Re-reads live size so free positions cannot stay below the fold after keyboard paint.
   */
  _applyPanelPositionNow() {
    if (!this.root) return;
    try {
      const resolved = applyPanelPosition(this.root, this._panelPosition, {
        margin: KEYBOARD_POSITION_MARGIN_PX,
        defaultAnchor: 'bottom-left',
        // Used when the panel has not laid out yet (height 0) so free tops
        // cannot pin to vh−margin and then grow off the bottom of the screen.
        fallbackWidth: 760,
        fallbackHeight: 200
      });
      // Keep in-memory free coords in sync with what was actually painted (clamped).
      if (resolved && !resolved.anchor) {
        this._panelPosition = {
          left: resolved.left,
          top: resolved.top,
          anchor: null
        };
      } else if (resolved?.anchor) {
        this._panelPosition = {
          left: resolved.left,
          top: resolved.top,
          anchor: resolved.anchor
        };
      }
    } catch { /* ignore */ }
  }

  /**
   * Re-apply after layout (keyboard rows often size one frame after show).
   */
  _schedulePanelPositionAfterLayout() {
    this._applyPanelPositionNow();
    try {
      requestAnimationFrame(() => {
        this._applyPanelPositionNow();
        requestAnimationFrame(() => this._applyPanelPositionNow());
      });
    } catch {
      this._applyPanelPositionNow();
    }
    // One-shot ResizeObserver: reclamp when content height appears / changes.
    try {
      if (typeof ResizeObserver === 'undefined' || !this.root) return;
      try { this._posResizeObserver?.disconnect?.(); } catch { /* ignore */ }
      let fires = 0;
      this._posResizeObserver = new ResizeObserver(() => {
        this._applyPanelPositionNow();
        if (++fires >= 4) {
          try { this._posResizeObserver?.disconnect?.(); } catch { /* ignore */ }
          this._posResizeObserver = null;
        }
      });
      this._posResizeObserver.observe(this.root);
    } catch { /* ignore */ }
  }

  /**
   * @param {import('../modules/settings-manager.js').PanelPositionSettings|null|undefined} next
   * @param {{ persist?: boolean }} [opts]
   */
  _setPanelPosition(next, opts = {}) {
    this._seedPanelPosition(next, { hydrated: true });
    this._applyPanelPositionNow();
    if (opts.persist && !this._suppressPositionPersist) {
      this._persistPanelPosition(this._panelPosition);
    }
  }

  async _refreshPanelPosition() {
    try {
      const settings = await getSettings();
      const stored = settings?.panelPositions?.keyboardReference;
      this._suppressPositionPersist = true;
      this._setPanelPosition(stored, { persist: false });
      this._suppressPositionPersist = false;
      this._positionHydrated = true;
      // Reclamp once size is known (no-op while hidden; safe after reveal).
      if (this.isVisible()) {
        this._schedulePanelPositionAfterLayout();
      } else {
        this._applyPanelPositionNow();
      }
      // If a free position was saved while height was 0, rewrite the clamped coords.
      try {
        const pos = this._panelPosition;
        if (pos && pos.anchor == null && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
          const before = stored && typeof stored === 'object' ? stored : null;
          const moved =
            !before ||
            Math.round(Number(before.top)) !== Math.round(pos.top) ||
            Math.round(Number(before.left)) !== Math.round(pos.left);
          // Only rewrite storage when the panel is actually visible + laid out;
          // otherwise a pre-show clamp with estimated height can corrupt the saved top.
          if (moved && this.isVisible()) {
            void this._persistPanelPosition(pos);
          }
        }
      } catch { /* ignore */ }
    } catch {
      this._suppressPositionPersist = false;
      // Fall back to whatever we already have (default or seeded).
      this._positionHydrated = true;
    }
  }

  /**
   * @param {import('../modules/settings-manager.js').PanelPositionSettings} position
   */
  async _persistPanelPosition(position) {
    try {
      await setSettings({
        panelPositions: {
          keyboardReference: {
            left: position.left,
            top: position.top,
            anchor: position.anchor === undefined ? null : position.anchor
          }
        }
      });
    } catch { /* ignore */ }
  }

  _onWinResizePosition() {
    if (!this.root || !this.isVisible()) return;
    if (this._positionApplyScheduled) return;
    this._positionApplyScheduled = true;
    try {
      requestAnimationFrame(() => {
        this._positionApplyScheduled = false;
        this._applyPanelPositionNow();
      });
    } catch {
      this._positionApplyScheduled = false;
      this._applyPanelPositionNow();
    }
  }

  /**
   * Compact, dark window-style titlebar (drag handle).
   * @param {HTMLElement|null} header
   * @param {{ titleEl?: HTMLElement|null, hintEl?: HTMLElement|null, closeBtn?: HTMLElement|null }} [parts]
   */
  _applyCompactTitlebar(header, parts = {}) {
    if (!header || !header.style) return;
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      height: '28px',
      minHeight: '28px',
      maxHeight: '28px',
      boxSizing: 'border-box',
      padding: '0 6px 0 10px',
      margin: '0',
      borderBottom: '1px solid rgba(0,0,0,0.55)',
      background: 'linear-gradient(180deg, #1a1b1f 0%, #121316 100%)',
      flex: '0 0 auto',
      cursor: 'grab',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'none'
    });
    try {
      header.title = header.title || 'Drag to move';
    } catch { /* ignore */ }

    const titleEl = parts.titleEl || header.querySelector('[data-kp-floating-keyboard-title="true"]') || header.firstElementChild;
    if (titleEl && titleEl.style) {
      Object.assign(titleEl.style, {
        fontSize: '11px',
        fontWeight: '600',
        letterSpacing: '0.01em',
        textTransform: 'none',
        color: 'rgba(220, 220, 225, 0.9)',
        lineHeight: '28px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        margin: '0',
        padding: '0'
      });
    }

    const hintEl = parts.hintEl || header.querySelector('[data-kp-floating-keyboard-hint="true"]');
    if (hintEl && hintEl.style) {
      Object.assign(hintEl.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        marginLeft: 'auto',
        fontSize: '10px',
        fontWeight: '500',
        letterSpacing: '0',
        color: 'rgba(140, 145, 155, 0.95)',
        padding: '0 4px',
        borderRadius: '0',
        border: 'none',
        background: 'transparent',
        lineHeight: '28px',
        whiteSpace: 'nowrap'
      });
    }

    const closeBtn = parts.closeBtn
      || header.querySelector('button[data-kp-floating-keyboard-close="true"]')
      || header.querySelector('button[aria-label="Close keyboard reference"]');
    if (closeBtn && closeBtn.style) {
      Object.assign(closeBtn.style, {
        width: '22px',
        height: '22px',
        minWidth: '22px',
        minHeight: '22px',
        borderRadius: '4px',
        border: 'none',
        background: 'transparent',
        color: 'rgba(200, 200, 205, 0.9)',
        cursor: 'pointer',
        fontSize: '15px',
        lineHeight: '20px',
        padding: '0',
        margin: '0',
        flex: '0 0 auto',
        boxShadow: 'none'
      });
    }
  }

  /**
   * Body that wraps `.kp-floating-keyboard-help__keyboard` — no chrome padding.
   * @param {HTMLElement|null} body
   */
  _applyKeyboardBodyChrome(body) {
    if (!body || !body.style) return;
    Object.assign(body.style, {
      padding: '0',
      margin: '0',
      border: 'none',
      background: 'transparent',
      flex: '1 1 auto',
      minHeight: '0',
      // Fixed key sizes for now (resize/flex-scale temporarily suspended).
      overflow: 'auto'
    });
  }

  /**
   * Keyboard host chrome.
   * TEMP: plain block layout with fixed key sizes (flex-fill suspended with resize).
   * @param {HTMLElement|null} keyboardContainer
   */
  _applyKeyboardHostChrome(keyboardContainer) {
    if (!keyboardContainer || !keyboardContainer.style) return;
    Object.assign(keyboardContainer.style, {
      width: '100%',
      boxSizing: 'border-box'
    });
  }

  /**
   * Titlebar drag (shared panel-position: margin clamp + corner/edge snap)
   * + shared edge/corner resize with SE grip (resize currently suspended).
   */
  _bindWindowChrome() {
    if (this._windowChromeBound || !this.root) return;
    const panel = this.root;
    const header = this._titlebar
      || panel.querySelector('[data-kp-floating-keyboard-titlebar="true"]')
      || panel.firstElementChild;
    if (!header) return;

    this._titlebar = header;
    this._windowChromeBound = true;

    try {
      const api = makePanelDraggable(panel, header, {
        margin: KEYBOARD_POSITION_MARGIN_PX,
        excludeSelector:
          'button[data-kp-floating-keyboard-close="true"], button[aria-label="Close keyboard reference"], .kpv2-popover-resize-handle',
        onMoveEnd: (state) => {
          if (!state?.moved) return;
          this._setPanelPosition(
            {
              left: state.left,
              top: state.top,
              anchor: state.anchor
            },
            { persist: true }
          );
        }
      });
      this._dragDispose = api?.dispose || null;
    } catch (err) {
      console.warn('[KeyPilot] Failed to make keyboard reference draggable:', err?.message || err);
      this._dragDispose = null;
    }

    try {
      window.addEventListener('resize', this._onWinResizePosition, true);
    } catch { /* ignore */ }

    // TEMP suspended: resize + aspect lock (return when key flex-scaling is ready).
    // See keybindings-ui-shared.js floating-keyboard flex rules (also suspended).
    // try {
    //   this._resizeDispose?.();
    // } catch { /* ignore */ }
    // try {
    //   const api = makePopoverResizable(panel, {
    //     minWidth: 360,
    //     minHeight: 160,
    //     margin: PANEL_POSITION_MARGIN_PX,
    //     aspectRatio: true,
    //     onResizeStart: () => {
    //       pinPanelGeometry(panel);
    //     }
    //   });
    //   this._resizeDispose = api?.dispose || null;
    // } catch (err) {
    //   console.warn('[KeyPilot] Failed to make keyboard reference resizable:', err?.message || err);
    //   this._resizeDispose = null;
    // }
    this._resizeDispose = null;

    // Apply saved / default dock once chrome is ready.
    this._applyPanelPositionNow();
  }

  _unbindWindowChrome() {
    try { this._dragDispose?.(); } catch { /* ignore */ }
    this._dragDispose = null;
    try { this._resizeDispose?.(); } catch { /* ignore */ }
    this._resizeDispose = null;
    try { window.removeEventListener('resize', this._onWinResizePosition, true); } catch { /* ignore */ }
    this._windowChromeBound = false;
  }

  _ensure() {
    if (this.root && this.root.isConnected) {
      // Re-bind chrome if the root survived but listeners were torn down.
      this._bindWindowChrome();
      return;
    }

    // If early-inject created the shell at document_start, adopt it to avoid flicker.
    try {
      const existing = document.querySelector('.kp-floating-keyboard-help[data-kp-early-floating-keyboard="true"]');
      if (existing && existing.isConnected) {
        const keyboardContainer = existing.querySelector('.kp-floating-keyboard-help__keyboard');
        const closeBtn =
          existing.querySelector('button[data-kp-floating-keyboard-close="true"]') ||
          existing.querySelector('button[aria-label="Close keyboard reference"]');
        const header =
          existing.querySelector('[data-kp-floating-keyboard-titlebar="true"]') ||
          existing.firstElementChild;
        const body = keyboardContainer?.parentElement || null;
        const hintEl = existing.querySelector('[data-kp-floating-keyboard-hint="true"]');
        const titleEl = existing.querySelector('[data-kp-floating-keyboard-title="true"]')
          || (header ? header.querySelector('div:not([data-kp-floating-keyboard-hint])') : null);

        // Prefer early shell's already-applied position when we were not seeded.
        if (!this._positionHydrated) {
          const fromDom = this._readPositionFromDom(existing);
          if (fromDom) this._seedPanelPosition(fromDom, { hydrated: true });
        }

        try {
          this._applyProPanelChrome(existing);
          this._applyCompactTitlebar(header, { titleEl, hintEl, closeBtn });
          this._applyKeyboardBodyChrome(body);
          this._applyKeyboardHostChrome(keyboardContainer);
        } catch { /* ignore */ }

        if (keyboardContainer) {
          this.root = existing;
          this.keyboardContainer = keyboardContainer;
          this.closeBtn = closeBtn || null;
          this.hintEl = hintEl || null;
          this._titlebar = header || null;
          if (this.closeBtn) {
            try {
              this.closeBtn.removeEventListener('click', this._onCloseClick);
            } catch { /* ignore */ }
            this.closeBtn.addEventListener('click', this._onCloseClick);
          }
          this._bindWindowChrome();
          return;
        }
      }
    } catch { /* ignore */ }

    const root = document.createElement('div');
    root.className = 'kp-floating-keyboard-help';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'KeyPilot keyboard reference');

    this._applyProPanelChrome(root);

    const header = document.createElement('div');
    header.setAttribute('data-kp-floating-keyboard-titlebar', 'true');

    const title = document.createElement('div');
    title.textContent = 'Keyboard Reference';
    title.setAttribute('data-kp-floating-keyboard-title', 'true');

    const hint = document.createElement('div');
    hint.setAttribute('data-kp-floating-keyboard-hint', 'true');
    this._setToggleHint(hint, 'K');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close keyboard reference');
    closeBtn.setAttribute('data-kp-floating-keyboard-close', 'true');
    closeBtn.addEventListener('click', this._onCloseClick);

    header.appendChild(title);
    header.appendChild(hint);
    header.appendChild(closeBtn);
    this._applyCompactTitlebar(header, { titleEl: title, hintEl: hint, closeBtn });

    const body = document.createElement('div');
    body.setAttribute('data-kp-floating-keyboard-body', 'true');
    this._applyKeyboardBodyChrome(body);

    const keyboardContainer = document.createElement('div');
    keyboardContainer.className = 'kp-floating-keyboard-help__keyboard';
    this._applyKeyboardHostChrome(keyboardContainer);
    body.appendChild(keyboardContainer);

    root.appendChild(header);
    root.appendChild(body);

    // Attach to DOM.
    (document.body || document.documentElement).appendChild(root);

    this.root = root;
    this.keyboardContainer = keyboardContainer;
    this.closeBtn = closeBtn;
    this.hintEl = hint;
    this._titlebar = header;
    this._bindWindowChrome();
  }

  /**
   * Titlebar hint: "Press <kbd>K</kbd> to toggle" (key label is layout-aware).
   * @param {HTMLElement|null} hintEl
   * @param {string} keyLabel
   */
  _setToggleHint(hintEl, keyLabel) {
    if (!hintEl) return;
    const key = String(keyLabel || 'K').trim() || 'K';
    // Rebuild so we don't leave stale key labels after layout switches.
    while (hintEl.firstChild) hintEl.removeChild(hintEl.firstChild);

    hintEl.appendChild(document.createTextNode('Press '));

    const kbd = document.createElement('kbd');
    kbd.setAttribute('data-kp-floating-keyboard-hint-key', 'true');
    kbd.textContent = key;
    Object.assign(kbd.style, {
      display: 'inline-block',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: '10px',
      fontWeight: '600',
      lineHeight: '1.2',
      padding: '1px 5px',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      borderBottomColor: 'rgba(0, 0, 0, 0.55)',
      borderRadius: '4px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
      color: 'rgba(230, 232, 238, 0.95)',
      boxShadow: '0 1px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      verticalAlign: 'middle'
    });
    hintEl.appendChild(kbd);

    hintEl.appendChild(document.createTextNode(' to toggle'));
    try {
      hintEl.setAttribute('aria-label', `Press ${key} to toggle`);
    } catch { /* ignore */ }
  }

  _render() {
    if (!this.keyboardContainer) return;
    try {
      const b = this.keybindings && this.keybindings.TOGGLE_KEYBOARD_HELP;
      const key = (b && (b.displayKey || b.keyLabel)) ? String(b.displayKey || b.keyLabel) : 'K';
      this._setToggleHint(this.hintEl, key);
    } catch { /* ignore */ }
    try {
      renderKeybindingsKeyboard({
        container: this.keyboardContainer,
        keybindings: this.keybindings,
        keyboardLayout: this.keyboardLayout || undefined,
        layoutId: this.layoutId || undefined
      });
      this._rebuildKeyIndex();
    } catch (e) {
      // In case a page CSP / DOM edge case breaks rendering, fail gracefully.
      this.keyboardContainer.textContent = 'Unable to render keyboard reference on this page.';
      console.warn('[KeyPilot] Failed to render floating keyboard reference:', e);
    }
  }

  /**
   * Public entry points used by KeyPilot's capture-phase handler.
   * KeyPilot calls stopImmediatePropagation() on claimed shortcuts, which would
   * otherwise prevent document-level listeners registered later from seeing keydown.
   * @param {KeyboardEvent} e
   */
  reflectKeyDown(e) {
    this._onDocKeyDown(e);
  }

  /**
   * @param {KeyboardEvent} e
   */
  reflectKeyUp(e) {
    this._onDocKeyUp(e);
  }

  _bindKeydownFeedback() {
    if (this._keydownBound) return;
    try {
      // Capture listeners cover keys KeyPilot does not claim. Claimed shortcuts are
      // reflected via reflectKeyDown() from KeyPilot before stopImmediatePropagation.
      document.addEventListener('keydown', this._onDocKeyDown, true);
      document.addEventListener('keyup', this._onDocKeyUp, true);
      window.addEventListener('blur', this._onWinBlur, true);
      this._keydownBound = true;
    } catch { /* ignore */ }
  }

  _unbindKeydownFeedback() {
    if (!this._keydownBound) return;
    try { document.removeEventListener('keydown', this._onDocKeyDown, true); } catch { /* ignore */ }
    try { document.removeEventListener('keyup', this._onDocKeyUp, true); } catch { /* ignore */ }
    try { window.removeEventListener('blur', this._onWinBlur, true); } catch { /* ignore */ }
    this._keydownBound = false;
    this._clearPressed();
  }

  _bindSettingsSync() {
    if (this._settingsBound) return;
    try {
      if (chrome?.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener(this._onStorageChanged);
        this._settingsBound = true;
      }
    } catch { /* ignore */ }
  }

  _unbindSettingsSync() {
    if (!this._settingsBound) return;
    try { chrome?.storage?.onChanged?.removeListener?.(this._onStorageChanged); } catch { /* ignore */ }
    this._settingsBound = false;
  }

  async _refreshKeyFeedbackSetting() {
    try {
      const settings = await getSettings();
      this._setKeyFeedbackEnabled(!!settings.keyboardReferenceKeyFeedback);
    } catch {
      // ignore (keep default)
    }
  }

  _onStorageChanged(changes, area) {
    try {
      if (area !== 'sync' && area !== 'local') return;
      const entry = changes && changes[SETTINGS_STORAGE_KEY];
      if (!entry || !entry.newValue) return;
      this._setKeyFeedbackEnabled(!!entry.newValue.keyboardReferenceKeyFeedback);
      // Cross-tab / cross-page position sync (and re-apply after navigation restore).
      const nextPos = entry.newValue.panelPositions?.keyboardReference;
      if (nextPos && typeof nextPos === 'object') {
        this._suppressPositionPersist = true;
        this._setPanelPosition(nextPos, { persist: false });
        this._suppressPositionPersist = false;
      }
    } catch { /* ignore */ }
  }

  _setKeyFeedbackEnabled(enabled) {
    const next = !!enabled;
    if (this._keyFeedbackEnabled === next) return;
    this._keyFeedbackEnabled = next;
    if (!next) this._clearPressed();
  }

  _onWinBlur() {
    // If the page loses focus while keys are held, keyup may never arrive.
    this._clearPressed();
  }

  _normalizeLabel(s) {
    return String(s || '').trim().toUpperCase();
  }

  /**
   * Normalize an event/binding key token into the label(s) used on the keyboard UI.
   * @param {string} token
   * @returns {string[]}
   */
  _labelsFromToken(token) {
    const raw = String(token || '').trim();
    if (!raw || raw === ' ') return [];

    const upper = this._normalizeLabel(raw);
    if (!upper) return [];

    // Match the UI's special key text / common KeyboardEvent.key values.
    if (upper === 'CAPSLOCK' || upper === 'CAPS') return ['CAPS'];
    if (upper === 'ESCAPE' || upper === 'ESC') return ['ESC']; // may be absent from mini layout
    if (upper === 'CONTROL' || upper === 'CTRL' || upper === 'ALT' || upper === 'META' || upper === 'OS') {
      return []; // not shown on the mini keyboard
    }
    if (upper === 'SHIFT') return ['SHIFT'];
    if (upper === 'ENTER' || upper === 'RETURN') return ['ENTER'];
    if (upper === 'TAB') return ['TAB'];
    if (upper === 'BACKSPACE') return ['BACKSPACE'];
    if (upper === 'SEMICOLON') return [';'];
    if (upper === 'QUOTE') return ["'"];
    if (upper === 'BACKQUOTE' || upper === 'BACKTICK') return ['`'];
    if (upper === 'BRACKETLEFT') return ['['];
    if (upper === 'BRACKETRIGHT') return [']'];
    if (upper === 'COMMA') return [','];
    if (upper === 'PERIOD') return ['.'];
    if (upper === 'SLASH') return ['/'];
    if (upper === 'MINUS') return ['-'];
    if (upper === 'EQUAL') return ['='];
    if (upper === 'BACKSLASH') return ['\\'];

    // Punctuation: map shifted glyphs back to the base key label shown on the keyboard UI.
    if (upper === ':') return [';'];
    if (upper === '?') return ['/'];
    if (upper === '>') return ['.'];
    if (upper === '<') return [','];
    if (upper === '"') return ["'"];
    if (upper === '~') return ['`'];
    if (upper === '{') return ['['];
    if (upper === '}') return [']'];
    if (upper === '_') return ['-'];
    if (upper === '+') return ['='];
    if (upper === '|') return ['\\'];
    if (upper === '!') return ['1'];
    if (upper === '@') return ['2'];
    if (upper === '#') return ['3'];
    if (upper === '$') return ['4'];
    if (upper === '%') return ['5'];
    if (upper === '^') return ['6'];
    if (upper === '&') return ['7'];
    if (upper === '*') return ['8'];
    if (upper === '(') return ['9'];
    if (upper === ')') return ['0'];

    return [upper];
  }

  _labelsFromKeyboardEvent(e) {
    // Prefer semantic key names so this works across keyboard layouts; also use
    // KeyboardEvent.code so physical keys still light when key is a shifted glyph.
    const out = [];
    const seen = new Set();
    const pushAll = (tokens) => {
      for (const t of tokens || []) {
        if (!t || seen.has(t)) continue;
        seen.add(t);
        out.push(t);
      }
    };

    const key = e && typeof e.key === 'string' ? e.key : '';
    if (key) pushAll(this._labelsFromToken(key));

    const code = e && typeof e.code === 'string' ? e.code : '';
    if (code) {
      // KeyA → A, Digit1 → 1
      if (/^Key[A-Z]$/i.test(code)) pushAll([code.slice(3).toUpperCase()]);
      else if (/^Digit[0-9]$/.test(code)) pushAll([code.slice(5)]);
      else pushAll(this._labelsFromToken(code));
    }

    return out;
  }

  /**
   * @param {Map<string, HTMLElement[]>} map
   * @param {string} label
   * @param {HTMLElement} keyEl
   */
  _indexLabel(map, label, keyEl) {
    const tokens = [];
    const norm = this._normalizeLabel(label);
    if (norm) tokens.push(norm);

    // Composite display keys (e.g. "A/`", "F / G") → also index each part.
    if (norm && /[/|,]/.test(norm)) {
      for (const part of norm.split(/[/|,]+/)) {
        const p = this._normalizeLabel(part);
        if (p) tokens.push(p);
      }
    }

    // Expand each token through the same alias map used for events.
    const expanded = new Set();
    for (const t of tokens) {
      for (const alias of this._labelsFromToken(t)) {
        if (alias) expanded.add(alias);
      }
      if (t) expanded.add(t);
    }

    for (const token of expanded) {
      const arr = map.get(token) || [];
      if (!arr.includes(keyEl)) arr.push(keyEl);
      map.set(token, arr);
    }
  }

  _rebuildKeyIndex() {
    if (!this.keyboardContainer) return;
    const map = new Map();
    const byAction = new Map();
    const bindings = this.keybindings || {};

    // Index by the visible "key label":
    // - action keys use `.key-label` (e.g. Q/W/E...)
    // - plain keys and specials use `.key-text` (e.g. Y, Tab, Caps, Shift)
    // - also index binding.keys so event.key / event.code always resolve
    const keyEls = this.keyboardContainer.querySelectorAll('.key');
    for (const keyEl of keyEls) {
      const labelEl = keyEl.querySelector?.('.key-label');
      const textEl = keyEl.querySelector?.('.key-text');
      if (labelEl && labelEl.textContent) {
        this._indexLabel(map, labelEl.textContent, keyEl);
      }
      if (textEl && textEl.textContent) {
        this._indexLabel(map, textEl.textContent, keyEl);
      }
      if (!labelEl && !textEl) {
        this._indexLabel(map, keyEl.textContent, keyEl);
      }

      // Also index by action id for link-hover hints (ACTIVATE, OPEN_POPOVER, …).
      const actionId = keyEl.dataset?.kpActionId ? String(keyEl.dataset.kpActionId) : '';
      if (actionId) {
        const arr = byAction.get(actionId) || [];
        if (!arr.includes(keyEl)) arr.push(keyEl);
        byAction.set(actionId, arr);

        const binding = bindings[actionId];
        const keys = binding && Array.isArray(binding.keys) ? binding.keys : [];
        for (const k of keys) {
          this._indexLabel(map, k, keyEl);
        }
        if (binding?.displayKey) this._indexLabel(map, binding.displayKey, keyEl);
        if (binding?.keyLabel) this._indexLabel(map, binding.keyLabel, keyEl);
      }
    }

    this._keyElsByLabel = map;
    this._keyElsByActionId = byAction;

    // If we re-rendered while keys were held, re-apply pressed overlay.
    for (const label of this._pressedLabels) {
      const els = this._keyElsByLabel.get(label);
      if (!els) continue;
      for (const el of els) setKeyPressedState(el, true);
    }

    // Re-apply link-hover hints after re-render.
    if (this._linkHoverHintActive) {
      this._applyLinkHoverHintClasses(true);
    }

    // Re-apply text-mode filter after re-render.
    if (this._textModeFilterActive) {
      this._applyTextModeFilterClasses(true);
    }
  }

  /**
   * While a text field has focus, gray out every key.
   * Click Element (ACTIVATE) is re-enabled only while the hover countdown is armed
   * via setTextModeActivateArmed(true).
   * @param {boolean} active
   */
  setTextModeFilter(active) {
    const next = Boolean(active);
    if (!next) {
      this._textModeActivateArmed = false;
    }
    if (this._textModeFilterActive === next) {
      // Still re-apply if DOM was rebuilt while state was already true.
      if (next && this.isVisible()) this._applyTextModeFilterClasses(true);
      return;
    }

    this._applyTextModeFilterClasses(false);
    this._textModeFilterActive = next;
    if (!next) this._textModeActivateArmed = false;

    try {
      const kbRoot = this.root?.querySelector?.('.kp-keybindings-ui') || this.keyboardContainer;
      if (kbRoot) {
        if (next) kbRoot.classList.add('kp-text-mode-filter');
        else kbRoot.classList.remove('kp-text-mode-filter');
      }
    } catch { /* ignore */ }

    if (next && this.isVisible()) {
      this._applyTextModeFilterClasses(true);
    }
  }

  /**
   * During text mode, light up Click Element only while a clickable is under the
   * cursor and the hover-click countdown is running.
   * @param {boolean} armed
   */
  setTextModeActivateArmed(armed) {
    const next = Boolean(armed);
    if (!this._textModeFilterActive) {
      this._textModeActivateArmed = false;
      return;
    }
    if (this._textModeActivateArmed === next) {
      if (next && this.isVisible()) this._applyTextModeFilterClasses(true);
      return;
    }
    this._textModeActivateArmed = next;
    if (this.isVisible()) this._applyTextModeFilterClasses(true);
  }

  /**
   * @param {boolean} on
   */
  _applyTextModeFilterClasses(on) {
    try {
      const root = this.root;
      if (!root) return;
      const activateArmed = !!(on && this._textModeActivateArmed);
      const keys = root.querySelectorAll('.key');
      for (const el of keys) {
        if (!el) continue;
        el.classList.remove('kp-key-text-mode-disabled');
        el.classList.remove('kp-key-text-mode-active');
        if (!on) continue;
        const actionId = el.getAttribute('data-kp-action-id') || '';
        if (actionId === 'ACTIVATE' && activateArmed) {
          // Hover countdown armed: Click Element is the only live key.
          el.classList.add('kp-key-text-mode-active');
        } else {
          // Default text-mode look: everything grayed out, including ACTIVATE.
          el.classList.add('kp-key-text-mode-disabled');
        }
      }

      const kbRoot = root.querySelector?.('.kp-keybindings-ui') || this.keyboardContainer;
      if (kbRoot) {
        if (on) kbRoot.classList.add('kp-text-mode-filter');
        else kbRoot.classList.remove('kp-text-mode-filter');
      }
    } catch { /* ignore */ }
  }

  /**
   * Highlight keyboard keys that activate/open a hovered page link.
   * @param {boolean} active
   * @param {string[]} [actionIds] defaults to click + popover link actions
   */
  setLinkHoverHints(active, actionIds) {
    const next = Boolean(active);
    const ids = Array.isArray(actionIds) && actionIds.length
      ? actionIds.map(String)
      : ['ACTIVATE', 'OPEN_POPOVER', 'PREVIEW_LINK_POPOVER', 'ACTIVATE_NEW_TAB', 'ACTIVATE_NEW_TAB_BACKGROUND'];

    // Clear previous classes first.
    this._applyLinkHoverHintClasses(false);

    this._linkHoverHintActive = next;
    this._linkHoverHintActionIds = new Set(next ? ids : []);

    if (next && this.isVisible()) {
      this._applyLinkHoverHintClasses(true);
    }
  }

  /**
   * @param {boolean} on
   */
  _applyLinkHoverHintClasses(on) {
    try {
      const ids = this._linkHoverHintActionIds;
      if (!ids || ids.size === 0) return;
      for (const actionId of ids) {
        const els = this._keyElsByActionId.get(actionId);
        if (!els) continue;
        for (const el of els) {
          if (on) el.classList.add('kp-key-link-hint');
          else el.classList.remove('kp-key-link-hint');
        }
      }
    } catch { /* ignore */ }
  }

  _setPressed(label, pressed) {
    const norm = this._normalizeLabel(label);
    if (!norm) return;
    const els = this._keyElsByLabel.get(norm);
    if (!els) return;
    for (const el of els) {
      setKeyPressedState(el, pressed);
    }
  }

  _clearPressed() {
    for (const label of this._pressedLabels) {
      this._setPressed(label, false);
    }
    this._pressedLabels.clear();
  }

  _onDocKeyDown(e) {
    try {
      if (!this.isVisible()) return;
      if (!this._keyFeedbackEnabled) return;
      const labels = this._labelsFromKeyboardEvent(e);
      if (!labels || labels.length === 0) return;
      for (const label of labels) {
        if (this._pressedLabels.has(label)) continue;
        this._pressedLabels.add(label);
        this._setPressed(label, true);
      }
    } catch { /* ignore */ }
  }

  _onDocKeyUp(e) {
    try {
      if (!this.isVisible()) return;
      if (!this._keyFeedbackEnabled) return;
      const labels = this._labelsFromKeyboardEvent(e);
      if (!labels || labels.length === 0) return;
      for (const label of labels) {
        this._pressedLabels.delete(label);
        this._setPressed(label, false);
      }
    } catch { /* ignore */ }
  }

  _onCloseClick(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    // Closing the panel should behave like pressing "K":
    // it must update KeyPilot's persisted visibility state, not only hide the DOM.
    try {
      const kp = window?.__KeyPilotInstance;
      if (kp && typeof kp.applyKeyboardHelpVisibility === 'function') {
        kp.applyKeyboardHelpVisibility(false, { persist: true });
        return;
      }
    } catch { /* ignore */ }

    // Fallback: still hide if KeyPilot isn't available for some reason.
    this.hide();
  }
}

// Debug: Make sure class is available globally for bundled version
if (typeof window !== 'undefined') {
  window.FloatingKeyboardHelp = FloatingKeyboardHelp;
}


