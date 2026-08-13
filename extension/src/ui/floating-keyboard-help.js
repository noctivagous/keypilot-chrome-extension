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
import {
  renderKeybindingsKeyboard,
  detachKeyPopoverBehavior,
  attachKeyPopoverBehavior,
  ensureStylesInjected,
  unpinKeyPopover
} from './keybindings-ui.js';
import {
  setKeyPressedState,
  KEYBINDINGS_UI_ROOT_CLASS,
  ensureKeyBackgroundIcon,
  ensureKeyPressOverlay
} from './keybindings-ui-shared.js';
import { MODES, Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import { getSettings, setSettings, SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../modules/settings-manager.js';
import {
  builtinFamilySelectValue,
  getKeyboardUiLayoutForLayout,
  inferFamilyAndHandednessFromLayoutId,
  listLayoutPickerGroups,
  normalizeKeyboardLayoutFamilyId,
  parseBuiltinFamilySelectValue
} from '../config/keyboard-layouts.js';
import { getFunctionDef } from '../config/function-library.js';
import {
  listUserKeyboardLayouts,
  getUserKeyboardLayoutById,
  listUserMacros,
  listUserActions,
  upsertUserKeyboardLayout
} from '../modules/keyboard-layout-store.js';
import { KP_LAYOUT_ITEM_MIME } from './keyboard-layout-config-panel.js';
import {
  exitKeyboardLayoutEditMode,
  openKeyboardLayoutConfigurator
} from './keyboard-layout-configurator.js';
import { makePopoverResizable } from '../utils/popover-resize.js';
import { createTitlebarKbd } from './popover-titlebar.js';
import { ensureOpenChromeShadow, injectChromeStyles, ensureChromeHostMounted } from './kp-chrome-shadow.js';
import {
  PANEL_POSITION_MARGIN_PX,
  applyPanelPosition,
  makePanelDraggable,
  normalizePanelPositionState
} from '../utils/panel-position.js';
import {
  NCT_DARK_UI_FONT,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM,
  NCT_DARK_UI_TITLEBAR_TEXT_MODE_BACKGROUND,
  NCT_DARK_UI_TITLEBAR_TEXT_MODE_BORDER_BOTTOM,
  NCT_DARK_UI_TITLEBAR_TEXT_MODE_TITLE_COLOR,
  NCT_DARK_UI_TITLEBAR_TEXT_MODE_HINT_COLOR,
  NCT_DARK_UI_FIELD_BACKGROUND,
  NCT_DARK_UI_FIELD_BORDER,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_LIT_GRADIENT,
  NCT_DARK_UI_BTN_LIT_BORDER,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_ICON_BUTTON_OUTLINE,
  NCT_DARK_UI_SELECTED_TEXT,
  NCT_DARK_UI_COLORS
} from './nct-dark-ui.js';

/** Match legacy keyboard dock inset (left/bottom 16px) while still using shared snap/clamp. */
const KEYBOARD_POSITION_MARGIN_PX = Math.max(PANEL_POSITION_MARGIN_PX, 16);
/** Keep max size in sync with margin on every edge (was 24 → asymmetric right/bottom gaps). */
const KEYBOARD_MAX_VIEWPORT_INSET_PX = KEYBOARD_POSITION_MARGIN_PX * 2;

/** Sentinel value for the layout <select> action that opens Keyboard Layout Config. */
const LAYOUT_SELECT_EDIT_VALUE = '__edit_layouts__';
/** Sentinel value for creating a blank layout and opening Keyboard Layout Config. */
const LAYOUT_SELECT_NEW_VALUE = '__new_layout__';
/** Sentinel value for duplicating the current layout and opening Keyboard Layout Config. */
const LAYOUT_SELECT_DUP_VALUE = '__duplicate_layout__';

/**
 * Function / action ids that stay fully styled and interactive on the Keyboard
 * Reference while Text Mode's hover-click countdown is armed.
 * Add more ids here as additional countdown-aware Functions ship.
 * @type {ReadonlySet<string>}
 */
export const TEXT_MODE_COUNTDOWN_ACTION_IDS = new Set(['ACTIVATE']);

export class FloatingKeyboardHelp {
  /**
   * @param {Object} params
   * @param {Record<string, any>} params.keybindings
   * @param {any[]} [params.keyboardLayout]
   * @param {string} [params.layoutId]
   * @param {import('../modules/settings-manager.js').PanelPositionSettings|null} [params.panelPosition]
   *   Optional known dock/free position (from KeyPilot settings). When provided,
   *   the first show paints at this location instead of flashing the default corner.
   * @param {() => any} [params.getKeyPilot] Accessor for the owning KeyPilot instance
   *   (used by "Edit Keyboard Layout…" in the layout dropdown).
   */
  constructor({ keybindings, keyboardLayout, layoutId, panelPosition, getKeyPilot } = {}) {
    this.keybindings = keybindings || {};
    this.keyboardLayout = keyboardLayout || null;
    this.layoutId = typeof layoutId === 'string' ? layoutId : '';
    this.root = null;
    this.shadowRoot = null;
    this.keyboardContainer = null;
    this._keyboardBody = null;
    this.closeBtn = null;
    this.hintEl = null;
    /** @type {HTMLElement|null} */
    this._titlebar = null;
    /** @type {HTMLButtonElement|null} */
    this._saveFinishBtn = null;
    /** @type {HTMLButtonElement|null} */
    this._exitTextModeBtn = null;
    /** @type {HTMLButtonElement|null} */
    this._collapseBtn = null;
    this._collapsed = false;
    this._onCloseClick = this._onCloseClick.bind(this);
    this._onCollapseClick = this._onCollapseClick.bind(this);
    this._onSaveAndFinishClick = this._onSaveAndFinishClick.bind(this);
    this._onExitTextModeClick = this._onExitTextModeClick.bind(this);
    this._onLayoutSelectChange = this._onLayoutSelectChange.bind(this);
    /** @type {(() => any)|null} */
    this._getKeyPilot = typeof getKeyPilot === 'function' ? getKeyPilot : null;

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

    // Text / typing mode: plain orange-ring keys; countdown-armed actions from
    // TEXT_MODE_COUNTDOWN_ACTION_IDS light up with full function chrome.
    this._textModeFilterActive = false;
    this._textModeCountdownArmed = false;
    /** @type {Set<string>} */
    this._textModeCountdownActionIds = new Set(TEXT_MODE_COUNTDOWN_ACTION_IDS);

    this._keyFeedbackEnabled = true;
    this._settingsBound = false;
    this._onStorageChanged = this._onStorageChanged.bind(this);

    // Titlebar drag + edge/corner resize (via shared panel-position system)
    this._windowChromeBound = false;
    /** @type {(() => void)|null} */
    this._resizeDispose = null;
    /** @type {(() => void)|null} */
    this._dragDispose = null;
    /** @type {AbortController|null} */
    this._slotDnDAbort = null;
    /** @type {MutationObserver|null} */
    this._hostGuard = null;

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

    // Active layout selection (builtin vs user) for rendering + dropdown.
    /** @type {HTMLSelectElement|null} */
    this._layoutSelectEl = null;
    /** @type {HTMLElement|null} */
    this._layoutTitleEl = null;
    this._currentKeyboardLayoutId = 'builtin';
    this._currentUserLayout = null;
    this._currentUserMacros = [];
    /** @type {any[]} */
    this._currentUserActions = [];
    this._renderToken = 0;

    // Layout edit mode (Alt+C): DnD + delete buttons; popovers suppressed.
    this._editMode = false;
    /** @type {(() => any)|null} */
    this._getConfigPanel = null;
    /** @type {((layout: any) => void)|null} */
    this._onLayoutPersisted = null;
    /** @type {any|null} editing layout snapshot from Config panel */
    this._editLayoutState = null;
    /** Place-mode hover preview from Config click-to-place */
    this._placeHoverSlot = null;
    /** @type {{ type: string, id: string }|null} */
    this._placeItem = null;
    /** @type {((slotLabel: string) => void)|null} */
    this._onPlaceSlot = null;

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

  /**
   * @param {object} params
   * @param {string} params.currentKeyboardLayoutId
   * @param {any|null} [params.userLayout]
   * @param {any[]} [params.userMacros]
   */
  setActiveLayoutSelection({ currentKeyboardLayoutId, userLayout, userMacros, userActions } = {}) {
    this._currentKeyboardLayoutId = typeof currentKeyboardLayoutId === 'string' ? currentKeyboardLayoutId : 'builtin';
    this._currentUserLayout = userLayout || null;
    this._currentUserMacros = Array.isArray(userMacros) ? userMacros : [];
    this._currentUserActions = Array.isArray(userActions) ? userActions : [];
    if (this.root && !this.root.hidden) {
      this._render();
    }
  }

  isEditMode() {
    return !!this._editMode;
  }

  /**
   * @param {boolean} on
   * @param {{ getConfigPanel?: () => any, onLayoutPersisted?: (layout: any) => void }} [opts]
   */
  setEditMode(on, opts = {}) {
    const next = !!on;
    this._editMode = next;
    this._getConfigPanel = next && typeof opts.getConfigPanel === 'function' ? opts.getConfigPanel : null;
    this._onLayoutPersisted = next && typeof opts.onLayoutPersisted === 'function' ? opts.onLayoutPersisted : null;
    if (!next) {
      this._editLayoutState = null;
      this._placeItem = null;
      this._placeHoverSlot = null;
      this._onPlaceSlot = null;
    }

    try {
      if (this.root) {
        if (next) this.root.setAttribute('data-kp-edit-mode', 'true');
        else this.root.removeAttribute('data-kp-edit-mode');
      }
    } catch { /* ignore */ }

    this._ensureEditModeStyles();

    if (next) {
      try { unpinKeyPopover(); } catch { /* ignore */ }
      try {
        if (this.keyboardContainer) detachKeyPopoverBehavior(this.keyboardContainer);
      } catch { /* ignore */ }
    }

    // Update titlebar hint
    try {
      if (this.hintEl) {
        if (next) {
          while (this.hintEl.firstChild) this.hintEl.removeChild(this.hintEl.firstChild);
          this.hintEl.appendChild(document.createTextNode('Editing — Alt+C to exit'));
          this.hintEl.setAttribute('aria-label', 'Editing layout — Alt+C to exit');
        } else {
          const b = this.keybindings && this.keybindings.TOGGLE_KEYBOARD_HELP;
          const key = (b && (b.displayKey || b.keyLabel)) ? String(b.displayKey || b.keyLabel) : 'K';
          this._setToggleHint(this.hintEl, key);
        }
      }
    } catch { /* ignore */ }

    try {
      if (this._layoutSelectEl) this._layoutSelectEl.disabled = false;
    } catch { /* ignore */ }

    this._applyEditModeHatch(next);
    this._syncSaveAndFinishButton(next);
    this._syncEscExitButton();

    if (this.root && !this.root.hidden) this._render();
  }

  /**
   * Titlebar CTA shown only while layout edit mode is active.
   * Placed immediately to the right of the layout dropdown.
   * @param {boolean} visible
   */
  _syncSaveAndFinishButton(visible) {
    try {
      if (visible) {
        this._ensureSaveAndFinishButton();
        if (this._saveFinishBtn) this._saveFinishBtn.hidden = false;
      } else if (this._saveFinishBtn) {
        this._saveFinishBtn.hidden = true;
      }
    } catch { /* ignore */ }
  }

  _ensureSaveAndFinishButton() {
    if (this._saveFinishBtn && this._saveFinishBtn.isConnected) return;
    const header = this._titlebar
      || this.shadowRoot?.querySelector?.('[data-kp-floating-keyboard-titlebar="true"]')
      || null;
    if (!header) return;

    let btn = header.querySelector('button[data-kp-floating-keyboard-save-finish="true"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Save and Finish';
      btn.setAttribute('data-kp-floating-keyboard-save-finish', 'true');
      btn.setAttribute('aria-label', 'Save and finish editing keyboard layout');
      btn.title = 'Save layout changes and exit edit mode';
      Object.assign(btn.style, {
        marginLeft: '6px',
        padding: '0 8px',
        height: '22px',
        minHeight: '22px',
        borderRadius: NCT_DARK_UI_BTN_RADIUS,
        border: NCT_DARK_UI_BTN_LIT_BORDER,
        background: NCT_DARK_UI_BTN_LIT_GRADIENT,
        color: NCT_DARK_UI_SELECTED_TEXT,
        outline: 'none',
        fontSize: '11px',
        fontWeight: '600',
        fontFamily: NCT_DARK_UI_FONT,
        lineHeight: '20px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        flex: '0 0 auto',
        boxShadow: 'inset 0 1px 0 rgba(200,220,240,0.18)'
      });

      const layoutSelect = this._layoutSelectEl
        || header.querySelector('[data-kp-floating-keyboard-layout-select="true"]');
      const hintEl = this.hintEl
        || header.querySelector('[data-kp-floating-keyboard-hint="true"]');
      try {
        if (layoutSelect && layoutSelect.nextSibling) {
          header.insertBefore(btn, layoutSelect.nextSibling);
        } else if (hintEl) {
          header.insertBefore(btn, hintEl);
        } else {
          header.appendChild(btn);
        }
      } catch {
        try { header.appendChild(btn); } catch { /* ignore */ }
      }
    }

    try {
      btn.removeEventListener('click', this._onSaveAndFinishClick);
    } catch { /* ignore */ }
    btn.addEventListener('click', this._onSaveAndFinishClick);
    // Prevent titlebar drag when clicking the button.
    try {
      btn.addEventListener('pointerdown', (e) => {
        try { e.stopPropagation(); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }

    this._saveFinishBtn = btn;
  }

  _onSaveAndFinishClick(e) {
    try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch { /* ignore */ }
    try {
      const kp = typeof this._getKeyPilot === 'function' ? this._getKeyPilot() : null;
      if (kp) {
        exitKeyboardLayoutEditMode(kp);
        return;
      }
    } catch { /* ignore */ }
    // Fallback if KeyPilot accessor is unavailable.
    try {
      const panel = typeof this._getConfigPanel === 'function' ? this._getConfigPanel() : null;
      panel?.hide?.();
    } catch { /* ignore */ }
    try { this.setEditMode(false); } catch { /* ignore */ }
  }

  /**
   * Modes where Esc leaves the mode (not normal browsing). The titlebar
   * "Exit [Esc]" button is shown only for these.
   */
  _isEscExitMode(mode) {
    return mode === MODES.TEXT_FOCUS
      || mode === MODES.HIGHLIGHT
      || mode === MODES.INSPECTOR
      || mode === MODES.DELETE
      || mode === MODES.COLS
      || mode === MODES.SCROLL_LINE;
  }

  _shouldShowEscExitButton() {
    if (this._editMode) return false;
    try {
      const kp = typeof this._getKeyPilot === 'function' ? this._getKeyPilot() : null;
      const mode = kp?.state?.getState?.()?.mode;
      if (this._isEscExitMode(mode)) return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Titlebar CTA shown only while a mode that Esc can exit is active
   * (text / typing mode, Text Select, inspector pick, …).
   */
  _syncEscExitButton() {
    try {
      const visible = this._shouldShowEscExitButton();
      if (visible) this._ensureExitTextModeButton();
      this._setExitBtnShown(this._exitTextModeBtn, visible);
    } catch { /* ignore */ }
  }

  /** @param {HTMLElement|null} btn @param {boolean} shown */
  _setExitBtnShown(btn, shown) {
    if (!btn) return;
    btn.hidden = !shown;
    try { btn.setAttribute('aria-hidden', shown ? 'false' : 'true'); } catch { /* ignore */ }
    // Do not rely on [hidden] alone — host CSS and our own inline display fight it.
    btn.style.setProperty('display', shown ? 'inline-flex' : 'none', 'important');
  }

  /** Public: KeyPilot calls this on mode changes. */
  syncEscExitButton() {
    this._syncEscExitButton();
  }

  _ensureExitTextModeButton() {
    if (this._exitTextModeBtn && this._exitTextModeBtn.isConnected) return;
    const header = this._titlebar
      || this.shadowRoot?.querySelector?.('[data-kp-floating-keyboard-titlebar="true"]')
      || null;
    if (!header) return;

    let btn = header.querySelector('button[data-kp-floating-keyboard-exit-text="true"]');
    if (!btn) {
      const doc = header.ownerDocument || document;
      btn = doc.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-kp-floating-keyboard-exit-text', 'true');
      btn.setAttribute('aria-label', 'Exit text mode (Esc)');
      btn.title = 'Exit text mode (Esc)';
      Object.assign(btn.style, {
        marginLeft: '6px',
        padding: '0 7px',
        height: '22px',
        minHeight: '22px',
        borderRadius: NCT_DARK_UI_BTN_RADIUS,
        border: NCT_DARK_UI_BTN_BORDER,
        background: NCT_DARK_UI_BTN_GRADIENT,
        color: NCT_DARK_UI_COLORS.fg,
        outline: 'none',
        fontSize: '11px',
        fontWeight: '600',
        fontFamily: NCT_DARK_UI_FONT,
        lineHeight: '20px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        flex: '0 0 auto',
        display: 'none',
        alignItems: 'center',
        gap: '5px'
      });
      btn.hidden = true;
      btn.setAttribute('aria-hidden', 'true');
      btn.style.setProperty('display', 'none', 'important');
      btn.appendChild(doc.createTextNode('Exit'));
      const kbd = createTitlebarKbd(doc, 'Esc');
      try { kbd.style.fontSize = '10px'; } catch { /* ignore */ }
      btn.appendChild(kbd);

      const titleEl = this._layoutTitleEl
        || header.querySelector('[data-kp-floating-keyboard-title="true"]');
      const layoutSelect = this._layoutSelectEl
        || header.querySelector('[data-kp-floating-keyboard-layout-select="true"]');
      try {
        if (titleEl && titleEl.nextSibling) {
          header.insertBefore(btn, titleEl.nextSibling);
        } else if (layoutSelect) {
          header.insertBefore(btn, layoutSelect);
        } else {
          header.appendChild(btn);
        }
      } catch {
        try { header.appendChild(btn); } catch { /* ignore */ }
      }
    }

    try {
      btn.removeEventListener('click', this._onExitTextModeClick);
    } catch { /* ignore */ }
    btn.addEventListener('click', this._onExitTextModeClick);
    try {
      btn.addEventListener('pointerdown', (e) => {
        try { e.stopPropagation(); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }

    this._exitTextModeBtn = btn;
    this._setExitBtnShown(btn, this._shouldShowEscExitButton());
  }

  _onExitTextModeClick(e) {
    try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch { /* ignore */ }
    try {
      const kp = typeof this._getKeyPilot === 'function' ? this._getKeyPilot() : null;
      if (!kp) return;
      const st = typeof kp.state?.getState === 'function' ? kp.state.getState() : null;
      if (st?.mode === MODES.TEXT_FOCUS && typeof kp.handleEscapeFromTextFocus === 'function') {
        kp.handleEscapeFromTextFocus(st);
        return;
      }
      if (typeof kp.cancelModes === 'function') {
        kp.cancelModes();
        return;
      }
      kp.focusDetector?.clearTextFocus?.();
    } catch { /* ignore */ }
  }

  /**
   * Sync editing layout from the Config panel.
   * @param {any} state LayoutConfigState-like
   */
  setEditLayout(state) {
    this._editLayoutState = state || null;
    if (this._editMode && this.root && !this.root.hidden) {
      this._render();
    }
  }

  /**
   * Begin/end click-to-place targeting on Reference slots.
   * @param {{ item?: { type: string, id: string }|null, onPlace?: ((slot: string) => void)|null }} [opts]
   */
  setPlaceTargeting({ item = null, onPlace = null } = {}) {
    this._placeItem = item && item.type && item.id ? { type: String(item.type), id: String(item.id) } : null;
    this._onPlaceSlot = this._placeItem && typeof onPlace === 'function' ? onPlace : null;
    this._placeHoverSlot = null;
    if (this._editMode && this.root && !this.root.hidden) this._render();
  }

  /**
   * @param {string|null} slotLabel
   */
  setPlaceHoverSlot(slotLabel) {
    const next = slotLabel ? String(slotLabel) : null;
    if (this._placeHoverSlot === next) return;
    this._placeHoverSlot = next;
    if (this._editMode && this.root && !this.root.hidden) this._render();
  }

  clearPlaceTargeting() {
    this.setPlaceTargeting({ item: null, onPlace: null });
  }

  isPlaceTargetingActive() {
    return !!(this._placeItem && this._placeItem.type && this._placeItem.id);
  }

  /**
   * Cancel click-to-place (Escape / outside click). Prefers the Config panel
   * so the SVG arrow and palette highlight clear together.
   * @returns {boolean} true if place mode was active and canceled
   */
  cancelPlaceTargeting() {
    if (!this.isPlaceTargetingActive()) return false;
    try {
      const panel = typeof this._getConfigPanel === 'function' ? this._getConfigPanel() : null;
      if (panel && typeof panel.cancelPlaceMode === 'function') {
        panel.cancelPlaceMode();
        return true;
      }
    } catch { /* ignore */ }
    this.clearPlaceTargeting();
    return true;
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
      try { ensureChromeHostMounted(this.root); } catch { /* ignore */ }
      try { this.root.hidden = false; } catch { /* ignore */ }
      try { this.root.classList.remove('kpv2-hidden'); } catch { /* ignore */ }
      try {
        this.root.style.setProperty('display', 'flex', 'important');
        this.root.style.setProperty('pointer-events', 'auto', 'important');
      } catch {
        try { this.root.style.display = 'flex'; } catch { /* ignore */ }
      }
      try { this.root.setAttribute('aria-hidden', 'false'); } catch { /* ignore */ }
      this._bindHostGuard();
    } else {
      this._unbindHostGuard();
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
    this._hydrateCollapsedFromSettings(); // async; best-effort

    // Always paint the best-known position before the panel becomes visible so a
    // saved free/dock location never flashes at the default bottom-left corner.
    this._applyPanelPositionNow();

    const reveal = ({ render = true } = {}) => {
      if (gen !== this._showGeneration) return;
      if (!this.root || !this.root.isConnected) return;
      this._applyPanelPositionNow();
      this._setRootVisible(true);
      // Never inherit a stuck press overlay from early-inject / prior paint.
      this._clearPressed();
      this._scrubPressOverlays();
      if (render) this._render();
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

    const revealAfterLayoutReady = () => {
      // User layouts are read asynchronously. Keep the adopted early shell hidden
      // until that read replaces its built-in placeholder, preventing a visible
      // built-in-layout flash after a navigation.
      if (String(this._currentKeyboardLayoutId || '').startsWith('user:')) {
        void this._renderAsync().finally(() => reveal({ render: false }));
        return;
      }
      reveal();
    };

    if (this._positionHydrated) {
      revealAfterLayoutReady();
      // Background refresh keeps multi-tab moves in sync without a default-corner flash.
      void this._refreshPanelPosition();
      return;
    }

    // First show without a seeded position: stay hidden until storage returns.
    // (Root remains hidden from _ensure; do not call _setRootVisible(true) yet.)
    void this._refreshPanelPosition().finally(() => {
      if (gen !== this._showGeneration) return;
      this._positionHydrated = true;
      revealAfterLayoutReady();
    });
  }

  hide() {
    // Invalidate any in-flight first-show reveal so a late storage resolve cannot re-open.
    this._showGeneration += 1;
    // Closing the Reference also ends layout edit mode.
    if (this._editMode) {
      try {
        const panel = this._getConfigPanel?.();
        panel?.hide?.();
      } catch { /* ignore */ }
      this.setEditMode(false);
    }
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
    this._unbindHostGuard();
    try { this._slotDnDAbort?.abort?.(); } catch { /* ignore */ }
    this._slotDnDAbort = null;
    try {
      if (this.closeBtn) this.closeBtn.removeEventListener('click', this._onCloseClick);
    } catch { /* ignore */ }
    try {
      if (this._collapseBtn) this._collapseBtn.removeEventListener('click', this._onCollapseClick);
    } catch { /* ignore */ }
    try {
      if (this._saveFinishBtn) {
        this._saveFinishBtn.removeEventListener('click', this._onSaveAndFinishClick);
      }
    } catch { /* ignore */ }
    try {
      if (this._exitTextModeBtn) {
        this._exitTextModeBtn.removeEventListener('click', this._onExitTextModeClick);
      }
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
    this.shadowRoot = null;
    this.keyboardContainer = null;
    this._keyboardBody = null;
    this.closeBtn = null;
    this._titlebar = null;
    this._saveFinishBtn = null;
    this._exitTextModeBtn = null;
    this._collapseBtn = null;
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
      background: NCT_DARK_UI_COLORS.panel,
      color: NCT_DARK_UI_COLORS.fg,
      // NCT dark UI panel rim (dual-edge inset rim).
      border: NCT_DARK_UI_PANEL_BORDER,
      borderRadius: NCT_DARK_UI_PANEL_RADIUS,
      boxShadow: NCT_DARK_UI_PANEL_BOX_SHADOW,
      fontFamily: NCT_DARK_UI_FONT
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
      borderBottom: NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM,
      background: NCT_DARK_UI_TITLEBAR_GRADIENT,
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
        color: NCT_DARK_UI_COLORS.fg,
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
        boxShadow: NCT_DARK_UI_ICON_BUTTON_OUTLINE
      });
    }
    if (this._editMode) this._applyEditModeHatch(true, header);
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
    if (this._editMode) this._applyEditModeHatch(true, null, body);
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
      || this.shadowRoot?.querySelector?.('[data-kp-floating-keyboard-titlebar="true"]')
      || panel.firstElementChild;
    if (!header) return;

    this._titlebar = header;
    this._windowChromeBound = true;

    try {
      const api = makePanelDraggable(panel, header, {
        margin: KEYBOARD_POSITION_MARGIN_PX,
        excludeSelector:
          'button[data-kp-floating-keyboard-close="true"], button[aria-label="Close keyboard reference"], button[data-kp-floating-keyboard-save-finish="true"], .kpv2-popover-resize-handle',
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

  /**
   * React/Next can remove foreign chrome hosts from <html>/<body>.
   * Reattach while the keyboard reference is still supposed to be visible.
   */
  _bindHostGuard() {
    if (this._hostGuard || typeof MutationObserver === 'undefined') return;
    const root = this.root;
    if (!root) return;
    try {
      this._hostGuard = new MutationObserver(() => {
        if (!this.root || this.root.isConnected || this.root.hidden) return;
        try {
          ensureChromeHostMounted(this.root);
          this.root.style.setProperty('display', 'flex', 'important');
          this.root.style.setProperty('pointer-events', 'auto', 'important');
        } catch { /* ignore */ }
      });
      this._hostGuard.observe(document.documentElement, { childList: true, subtree: true });
    } catch {
      this._hostGuard = null;
    }
  }

  _unbindHostGuard() {
    try { this._hostGuard?.disconnect?.(); } catch { /* ignore */ }
    this._hostGuard = null;
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
        const shadowRoot = ensureOpenChromeShadow(existing, { id: 'keyboard-help' });
        const shell = shadowRoot || existing;
        const keyboardContainer = shell.querySelector('.kp-floating-keyboard-help__keyboard');
        const closeBtn =
          shell.querySelector('button[data-kp-floating-keyboard-close="true"]') ||
          shell.querySelector('button[aria-label="Close keyboard reference"]');
        const header =
          shell.querySelector('[data-kp-floating-keyboard-titlebar="true"]') ||
          shell.firstElementChild;
        const body = keyboardContainer?.parentElement || null;
        const collapseBtn = shell.querySelector('button[data-kp-floating-keyboard-collapse="true"]');
        const hintEl = shell.querySelector('[data-kp-floating-keyboard-hint="true"]');
        const titleEl = shell.querySelector('[data-kp-floating-keyboard-title="true"]')
          || (header ? header.querySelector('div:not([data-kp-floating-keyboard-hint])') : null);
        let layoutSelect = shell.querySelector('[data-kp-floating-keyboard-layout-select="true"]');
        if (!layoutSelect && header) {
          layoutSelect = document.createElement('select');
          layoutSelect.setAttribute('aria-label', 'Current keyboard layout');
          layoutSelect.setAttribute('data-kp-floating-keyboard-layout-select', 'true');
          Object.assign(layoutSelect.style, {
            marginLeft: '6px',
            padding: '2px 6px',
            borderRadius: '2px',
            border: NCT_DARK_UI_FIELD_BORDER,
            background: NCT_DARK_UI_FIELD_BACKGROUND,
            color: NCT_DARK_UI_COLORS.fg,
            outline: 'none',
            fontSize: '11px',
            width: '190px',
            height: '22px',
            cursor: 'pointer'
          });
          this._wireLayoutSelect(layoutSelect);
          try {
            const hintNode = hintEl || header.querySelector('[data-kp-floating-keyboard-hint="true"]');
            if (hintNode) header.insertBefore(layoutSelect, hintNode);
            else header.appendChild(layoutSelect);
          } catch {
            try { header.appendChild(layoutSelect); } catch { /* ignore */ }
          }
        } else if (layoutSelect) {
          this._wireLayoutSelect(layoutSelect);
        }

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
          this.shadowRoot = shadowRoot;
          this.keyboardContainer = keyboardContainer;
          this._keyboardBody = body;
          this.closeBtn = closeBtn || null;
          this.hintEl = hintEl || null;
          this._titlebar = header || null;
          this._layoutSelectEl = layoutSelect || null;
          this._layoutTitleEl = titleEl || null;
          this._collapseBtn = collapseBtn || null;
          // Prefer early shell collapsed attribute so we don't expand a titlebar-only paint.
          try {
            if (existing.getAttribute('data-kp-collapsed') === 'true') this._collapsed = true;
          } catch { /* ignore */ }
          if (this.closeBtn) {
            try {
              this.closeBtn.removeEventListener('click', this._onCloseClick);
            } catch { /* ignore */ }
            this.closeBtn.addEventListener('click', this._onCloseClick);
          }
          this._ensureCollapseButton();
          this._applyCollapsedLayout();
          this._bindWindowChrome();
          try { ensureStylesInjected(shadowRoot || existing); } catch { /* ignore */ }
          return;
        }
      }
    } catch { /* ignore */ }

    const root = document.createElement('div');
    root.className = 'kp-floating-keyboard-help';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'KeyPilot keyboard reference');
    const shadowRoot = ensureOpenChromeShadow(root, { id: 'keyboard-help' });
    const shell = shadowRoot || root;

    this._applyProPanelChrome(root);

    const header = document.createElement('div');
    header.setAttribute('data-kp-floating-keyboard-titlebar', 'true');

    const title = document.createElement('div');
    title.textContent = 'Keyboard Reference';
    title.setAttribute('data-kp-floating-keyboard-title', 'true');

    const layoutSelect = document.createElement('select');
    layoutSelect.setAttribute('aria-label', 'Current keyboard layout');
    layoutSelect.setAttribute('data-kp-floating-keyboard-layout-select', 'true');
    Object.assign(layoutSelect.style, {
      marginLeft: '6px',
      padding: '2px 6px',
      borderRadius: '2px',
      border: NCT_DARK_UI_FIELD_BORDER,
      background: NCT_DARK_UI_FIELD_BACKGROUND,
      color: NCT_DARK_UI_COLORS.fg,
      outline: 'none',
      fontSize: '11px',
      width: '190px',
      height: '22px',
      cursor: 'pointer'
    });
    this._wireLayoutSelect(layoutSelect);

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
    header.appendChild(layoutSelect);
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

    shell.appendChild(header);
    shell.appendChild(body);

    // Attach to DOM.
    (document.body || document.documentElement).appendChild(root);
    try { ensureChromeHostMounted(root); } catch { /* ignore */ }

    this.root = root;
    this.shadowRoot = shadowRoot;
    this.keyboardContainer = keyboardContainer;
    this._keyboardBody = body;
    this.closeBtn = closeBtn;
    this.hintEl = hint;
    this._titlebar = header;
    this._layoutSelectEl = layoutSelect;
    this._layoutTitleEl = title;
    this._ensureCollapseButton();
    this._applyCollapsedLayout();
    this._bindWindowChrome();
    try { ensureStylesInjected(shadowRoot || root); } catch { /* ignore */ }
  }

  _ensureCollapseButton() {
    const header = this._titlebar
      || this.shadowRoot?.querySelector?.('[data-kp-floating-keyboard-titlebar="true"]')
      || null;
    if (!header) return;
    let btn = this._collapseBtn
      || header.querySelector('button[data-kp-floating-keyboard-collapse="true"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-kp-floating-keyboard-collapse', 'true');
      header.insertBefore(btn, this.closeBtn || null);
    }
    Object.assign(btn.style, {
      width: '22px',
      height: '22px',
      minWidth: '22px',
      minHeight: '22px',
      borderRadius: '4px',
      border: 'none',
      background: 'transparent',
      color: 'rgba(200, 200, 205, 0.9)',
      cursor: 'pointer',
      fontSize: '14px',
      lineHeight: '20px',
      padding: '0',
      margin: '0',
      flex: '0 0 auto',
      boxShadow: NCT_DARK_UI_ICON_BUTTON_OUTLINE
    });
    try { btn.removeEventListener('click', this._onCollapseClick); } catch { /* ignore */ }
    btn.addEventListener('click', this._onCollapseClick);
    btn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    this._collapseBtn = btn;
  }

  _applyCollapsedLayout() {
    const collapsed = !!this._collapsed;
    try {
      if (this._keyboardBody) this._keyboardBody.style.display = collapsed ? 'none' : 'block';
      if (this.root) this.root.setAttribute('data-kp-collapsed', collapsed ? 'true' : 'false');
      if (this._collapseBtn) {
        this._collapseBtn.textContent = collapsed ? '▸' : '▾';
        this._collapseBtn.setAttribute('aria-label', collapsed ? 'Expand keyboard reference' : 'Collapse keyboard reference');
        this._collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
      }
    } catch { /* ignore */ }
  }

  /**
   * Collapse / expand the keyboard body (titlebar stays).
   * @param {boolean} collapsed
   * @param {{ persist?: boolean }} [opts]
   */
  setCollapsed(collapsed, { persist = false } = {}) {
    const next = !!collapsed;
    if (this._collapsed === next) {
      this._applyCollapsedLayout();
      // Collapse changes the panel's measured height. Resolve its anchor in
      // this same task so a bottom/middle-docked panel cannot paint once at
      // its expanded location before the post-layout position pass runs.
      this._applyPanelPositionNow();
      return;
    }
    this._collapsed = next;
    this._applyCollapsedLayout();
    // See the same-state path above: re-anchor immediately after changing the
    // body display, rather than waiting for a later animation-frame pass.
    this._applyPanelPositionNow();
    if (persist) {
      try {
        void setSettings({ keyboardReferenceCollapsed: next });
      } catch { /* ignore */ }
    }
  }

  _onCollapseClick(e) {
    try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch { /* ignore */ }
    this.setCollapsed(!this._collapsed, { persist: true });
  }

  async _hydrateCollapsedFromSettings() {
    try {
      const settings = await getSettings();
      this.setCollapsed(!!settings?.keyboardReferenceCollapsed, { persist: false });
    } catch { /* ignore */ }
  }

  /**
   * Titlebar hint: "Press <kbd>K</kbd> to toggle" (key label is layout-aware).
   * @param {HTMLElement|null} hintEl
   * @param {string} keyLabel
   */
  _setToggleHint(hintEl, keyLabel) {
    if (!hintEl) return;
    const key = String(keyLabel || 'K').trim() || 'K';
    // Skip rebuild when the chip is already correct — avoids K flashing on every
    // show/render (and on post-navigation adopt after early-inject painted the hint).
    try {
      const existing = hintEl.querySelector('[data-kp-floating-keyboard-hint-key="true"]');
      if (
        existing
        && existing.textContent === key
        && hintEl.getAttribute('aria-label') === `Press ${key} to toggle`
        && !this._editMode
      ) {
        return;
      }
    } catch { /* ignore */ }

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
      if (!this._editMode) {
        const b = this.keybindings && this.keybindings.TOGGLE_KEYBOARD_HELP;
        const key = (b && (b.displayKey || b.keyLabel)) ? String(b.displayKey || b.keyLabel) : 'K';
        this._setToggleHint(this.hintEl, key);
      }
    } catch { /* ignore */ }
    this._syncEscExitButton();
    void this._renderAsync();
  }

  /**
   * Restore the normal layout title after leaving typing / text mode.
   */
  _restoreLayoutTitle() {
    try {
      if (!this._layoutTitleEl || this._editMode) return;
      this._layoutTitleEl.textContent = 'Keyboard Reference';
    } catch { /* ignore */ }
  }

  /**
   * Steel hatch on titlebar + body while editing (matches Keyboard Layout Config).
   * Applied as a class plus inline background so it wins over compact-titlebar inline chrome.
   * @param {boolean} on
   * @param {HTMLElement|null} [header]
   * @param {HTMLElement|null} [body]
   */
  _applyEditModeHatch(on, header = null, body = null) {
    const hatch = 'repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)';
    const titlebar = header || this._titlebar;
    const keyboardBody = body || this._keyboardBody;
    try {
      titlebar?.classList.toggle('kp-kb-edit-hatch', !!on);
      keyboardBody?.classList.toggle('kp-kb-edit-hatch', !!on);
    } catch { /* ignore */ }
    try {
      if (titlebar?.style) {
        if (on) {
          titlebar.style.backgroundImage =
            `${hatch}, linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)`;
        } else {
          titlebar.style.background = NCT_DARK_UI_TITLEBAR_GRADIENT;
        }
      }
    } catch { /* ignore */ }
    try {
      if (keyboardBody?.style) {
        if (on) {
          keyboardBody.style.backgroundColor = '#1a1c20';
          keyboardBody.style.backgroundImage = hatch;
        } else {
          keyboardBody.style.background = 'transparent';
          keyboardBody.style.backgroundImage = '';
          keyboardBody.style.backgroundColor = '';
        }
      }
    } catch { /* ignore */ }
  }

  /**
   * Orange-cast titlebar + warm title color while typing (text mode).
   * Edit-mode hatch styles win when both attributes are present.
   */
  _ensureTextModeStyles() {
    try {
      const root = this.shadowRoot || this.root?.ownerDocument || document;
      const css = `
/* Typing / text mode: orange cast over the NCT titlebar bevel (COLORS.ORANGE #ff8c00). */
:host([data-kp-text-mode="true"]:not([data-kp-edit-mode="true"])) [data-kp-floating-keyboard-titlebar="true"] {
  background: ${NCT_DARK_UI_TITLEBAR_TEXT_MODE_BACKGROUND} !important;
  border-bottom: ${NCT_DARK_UI_TITLEBAR_TEXT_MODE_BORDER_BOTTOM} !important;
}
:host([data-kp-text-mode="true"]:not([data-kp-edit-mode="true"])) [data-kp-floating-keyboard-title="true"] {
  color: ${NCT_DARK_UI_TITLEBAR_TEXT_MODE_TITLE_COLOR} !important;
}
:host([data-kp-text-mode="true"]:not([data-kp-edit-mode="true"])) [data-kp-floating-keyboard-hint="true"] {
  color: ${NCT_DARK_UI_TITLEBAR_TEXT_MODE_HINT_COLOR} !important;
}
      `.trim();
      injectChromeStyles(root, { attr: 'data-kp-keyboard-text-mode-style', css });
    } catch { /* ignore */ }
  }

  /**
   * Sync root attribute, title, and hint for typing / text mode.
   * @param {boolean} active
   */
  _applyTextModeChrome(active) {
    const on = Boolean(active);
    try {
      if (this.root) {
        if (on) this.root.setAttribute('data-kp-text-mode', 'true');
        else this.root.removeAttribute('data-kp-text-mode');
      }
    } catch { /* ignore */ }

    this._ensureTextModeStyles();
    this._syncEscExitButton();

    if (this._editMode) return;

    try {
      if (this._layoutTitleEl) {
        if (on) {
          this._layoutTitleEl.textContent = 'Keyboard Reference — Typing';
        } else {
          this._restoreLayoutTitle();
        }
      }
    } catch { /* ignore */ }

    try {
      if (this.hintEl && !on) {
        const b = this.keybindings && this.keybindings.TOGGLE_KEYBOARD_HELP;
        const key = (b && (b.displayKey || b.keyLabel)) ? String(b.displayKey || b.keyLabel) : 'K';
        this._setToggleHint(this.hintEl, key);
      }
    } catch { /* ignore */ }
  }

  _ensureEditModeStyles() {
    try {
      const root = this.shadowRoot || this.root?.ownerDocument || document;
      const css = `
/* Edit-mode plate hatch is on .keyboard-visual.kp-kb-edit-hatch (keybindings-ui-shared). */
/* Same hatch over a lightened titlebar bevel (overrides inline background shorthand). */
:host([data-kp-edit-mode="true"]) [data-kp-floating-keyboard-titlebar="true"],
:host [data-kp-floating-keyboard-titlebar="true"].kp-kb-edit-hatch {
  background-image:
    repeating-linear-gradient(
      -45deg,
      rgba(180, 200, 220, 0.08) 0px,
      rgba(180, 200, 220, 0.08) 1px,
      transparent 1px,
      transparent 7px
    ),
    linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%) !important;
}
:host([data-kp-edit-mode="true"]) [data-kp-floating-keyboard-body="true"],
:host [data-kp-floating-keyboard-body="true"].kp-kb-edit-hatch {
  background-color: #1a1c20 !important;
  background-image:
    repeating-linear-gradient(
      -45deg,
      rgba(180, 200, 220, 0.08) 0px,
      rgba(180, 200, 220, 0.08) 1px,
      transparent 1px,
      transparent 7px
    ) !important;
}
/* Lighten the panel chrome fill while editing. */
:host([data-kp-edit-mode="true"]) {
  background-color: #2e2e2e !important;
}
:host([data-kp-edit-mode="true"]) .keyboard-visual.${KEYBINDINGS_UI_ROOT_CLASS} .key {
  position: relative;
  cursor: grab;
}
:host([data-kp-edit-mode="true"]) .keyboard-visual.${KEYBINDINGS_UI_ROOT_CLASS} .key[data-kp-edit-readonly="true"] {
  cursor: default;
  opacity: 0.9;
}
:host([data-kp-edit-mode="true"]) .keyboard-visual.${KEYBINDINGS_UI_ROOT_CLASS} .key .key-main {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 16px;
}
/* Drop / place hover: use border + box-shadow — base .key sets outline:none !important. */
:host([data-kp-edit-mode="true"]) .key.kp-drop-target,
:host([data-kp-edit-mode="true"]) .key.kp-place-preview {
  z-index: 2;
  border-color: rgba(91, 226, 241, 0.95) !important;
  border-top-color: rgba(180, 245, 255, 1) !important;
  border-bottom-color: rgba(40, 180, 200, 0.95) !important;
  filter: brightness(1.1) saturate(1.1);
  box-shadow:
    0 0 0 2px rgba(91, 226, 241, 0.75),
    0 0 14px 3px rgba(91, 226, 241, 0.45),
    inset 0 0 0 2px rgba(91, 226, 241, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.22) !important;
}
      `.trim();
      injectChromeStyles(root, { attr: 'data-kp-keyboard-edit-mode-style', css });
    } catch { /* ignore */ }
  }

  /**
   * @param {() => any} getKeyPilot
   */
  setKeyPilotAccessor(getKeyPilot) {
    this._getKeyPilot = typeof getKeyPilot === 'function' ? getKeyPilot : null;
  }

  /**
   * Shared change handler for the titlebar layout <select>.
   * In edit mode this switches the layout being edited (same as Config's Layout combo).
   * Outside edit mode it sets the current/active layout.
   * @param {Event} e
   */
  async _onLayoutSelectChange(e) {
    const sel = (e?.currentTarget instanceof HTMLSelectElement)
      ? e.currentTarget
      : this._layoutSelectEl;
    if (!sel) return;
    const v = String(sel.value || 'builtin');
    if (
      v === LAYOUT_SELECT_EDIT_VALUE
      || v === LAYOUT_SELECT_NEW_VALUE
      || v === LAYOUT_SELECT_DUP_VALUE
    ) {
      // Action item — restore prior layout selection, then open Config.
      const prev = this._layoutSelectValueForCurrent();
      const known = [...sel.options].some((o) => o && o.value === prev);
      sel.value = known ? prev : builtinFamilySelectValue('browsing');
      try {
        const kp = this._getKeyPilot?.();
        if (v === LAYOUT_SELECT_EDIT_VALUE) {
          openKeyboardLayoutConfigurator(kp || null, {});
        } else {
          openKeyboardLayoutConfigurator(kp || null, {
            createNew: v === LAYOUT_SELECT_NEW_VALUE,
            createDuplicate: v === LAYOUT_SELECT_DUP_VALUE
          });
        }
      } catch { /* ignore */ }
      return;
    }
    if (this._editMode) {
      try {
        const panel = typeof this._getConfigPanel === 'function' ? this._getConfigPanel() : null;
        if (panel && typeof panel.selectLayoutByValue === 'function') {
          await panel.selectLayoutByValue(v);
          try { sel.value = this._layoutSelectValueForCurrent(); } catch { /* ignore */ }
          return;
        }
      } catch { /* ignore */ }
    }
    try {
      const familyId = parseBuiltinFamilySelectValue(v);
      if (familyId) {
        await setSettings({
          currentKeyboardLayoutId: 'builtin',
          keyboardLayoutFamilyId: familyId
        });
      } else {
        await setSettings({ currentKeyboardLayoutId: v });
      }
    } catch { /* ignore */ }
  }

  /**
   * Current <select> value for the active layout (builtin family or user id).
   * While editing, follows the Config panel's selection rather than the live current layout.
   * @returns {string}
   */
  _layoutSelectValueForCurrent() {
    if (this._editMode && this._editLayoutState) {
      const st = this._editLayoutState;
      if (st.mode === 'user' && st.userLayoutId) return `user:${st.userLayoutId}`;
      try {
        const inferred = inferFamilyAndHandednessFromLayoutId(
          st.builtinLayoutId || this.layoutId
        );
        return builtinFamilySelectValue(inferred.familyId);
      } catch { /* ignore */ }
    }
    const sel = String(this._currentKeyboardLayoutId || 'builtin');
    if (sel.startsWith('user:')) return sel;
    const familyId = normalizeKeyboardLayoutFamilyId(
      this._getKeyPilot?.()?._settings?.keyboardLayoutFamilyId
    );
    return builtinFamilySelectValue(familyId);
  }

  /**
   * Wire (or re-wire) the layout select change listener once.
   * @param {HTMLSelectElement|null} layoutSelect
   */
  _wireLayoutSelect(layoutSelect) {
    if (!layoutSelect) return;
    try { layoutSelect.removeEventListener('change', this._onLayoutSelectChange, true); } catch { /* ignore */ }
    layoutSelect.addEventListener('change', this._onLayoutSelectChange, true);
    if (layoutSelect.dataset.kpLayoutSelectWired === 'true') return;
    layoutSelect.dataset.kpLayoutSelectWired = 'true';
    // Prevent titlebar drag when interacting with the select.
    layoutSelect.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    layoutSelect.addEventListener('mousedown', (e) => e.stopPropagation(), true);
  }

  async _refreshLayoutSelectOptions() {
    const selEl = this._layoutSelectEl;
    if (!selEl) return;
    try {
      const layouts = await listUserKeyboardLayouts();
      const groups = listLayoutPickerGroups(layouts);
      selEl.innerHTML = '';

      const known = new Set();
      const appendGroup = (heading, items) => {
        const hdr = document.createElement('option');
        hdr.disabled = true;
        hdr.textContent = heading;
        selEl.appendChild(hdr);
        for (const item of items || []) {
          if (!item?.value) continue;
          const opt = document.createElement('option');
          opt.value = item.value;
          opt.textContent = item.label;
          selEl.appendChild(opt);
          known.add(opt.value);
        }
      };
      appendGroup('Built-In', groups.builtin);
      // Legacy single "Built-in" value still resolves via parseBuiltinFamilySelectValue.
      known.add('builtin');
      try {
        selEl.appendChild(document.createElement('hr'));
      } catch { /* ignore */ }
      appendGroup('Custom', groups.custom);

      // Action items only outside edit mode — while editing, this select matches Config's Layout combo.
      if (!this._editMode) {
        try {
          selEl.appendChild(document.createElement('hr'));
        } catch { /* ignore */ }
        const optEdit = document.createElement('option');
        optEdit.value = LAYOUT_SELECT_EDIT_VALUE;
        optEdit.textContent = 'Edit Keyboard Layout…';
        selEl.appendChild(optEdit);
        try {
          selEl.appendChild(document.createElement('hr'));
        } catch { /* ignore */ }
        const optNew = document.createElement('option');
        optNew.value = LAYOUT_SELECT_NEW_VALUE;
        optNew.textContent = 'New Blank Keyboard Layout';
        selEl.appendChild(optNew);
        const optDup = document.createElement('option');
        optDup.value = LAYOUT_SELECT_DUP_VALUE;
        optDup.textContent = 'New Duplicate Keyboard Layout';
        selEl.appendChild(optDup);
      }

      let v = this._layoutSelectValueForCurrent();
      if (!known.has(v) && !String(v).startsWith('user:')) {
        v = builtinFamilySelectValue('browsing');
        if (!this._editMode) {
          this._currentKeyboardLayoutId = 'builtin';
          this._currentUserLayout = null;
        }
      } else if (String(v).startsWith('user:') && !known.has(v)) {
        v = builtinFamilySelectValue('browsing');
        if (!this._editMode) {
          this._currentKeyboardLayoutId = 'builtin';
          this._currentUserLayout = null;
        }
      }
      selEl.value = v;
    } catch { /* ignore */ }
  }

  async _renderAsync() {
    const token = ++this._renderToken;
    if (!this.keyboardContainer) return;

    // Refresh selector options (best-effort).
    await this._refreshLayoutSelectOptions();

    let settings = null;
    try { settings = await getSettings(); } catch { /* ignore */ }
    if (token !== this._renderToken) return;

    // Edit mode: always render a slot keyboard driven by the Config panel's selection.
    if (this._editMode) {
      await this._renderEditModeKeyboard({ token, settings });
      return;
    }

    const selRaw = String((settings && settings.currentKeyboardLayoutId) || this._currentKeyboardLayoutId || 'builtin');
    let sel = selRaw;
    this._currentKeyboardLayoutId = sel;

    // Title stays "Keyboard Reference" — the layout name lives in the titlebar select.
    // While typing / text mode is active, keep the "Typing" title instead.
    try {
      if (this._layoutTitleEl) {
        const nextTitle = (this._textModeFilterActive && !this._editMode)
          ? 'Keyboard Reference — Typing'
          : 'Keyboard Reference';
        if (this._layoutTitleEl.textContent !== nextTitle) {
          this._layoutTitleEl.textContent = nextTitle;
        }
      }
    } catch { /* ignore */ }

    if (!sel.startsWith('user:')) {
      // Built-in render — always honor number-row setting (don't rely on a possibly-stale
      // this.keyboardLayout from before settings hydrated).
      try {
        const showNumberRow = !!(settings && settings.keyboardReferenceShowNumberRow);
        const uiLayout = getKeyboardUiLayoutForLayout(this.layoutId || 'browsing-right', {
          includeNumberRow: showNumberRow
        });
        this.keyboardLayout = uiLayout;
        renderKeybindingsKeyboard({
          container: this.keyboardContainer,
          keybindings: this.keybindings,
          keyboardLayout: uiLayout,
          layoutId: this.layoutId || undefined,
          attachPopovers: true
        });
        this._rebuildKeyIndex();
      } catch (e) {
        this.keyboardContainer.textContent = 'Unable to render keyboard reference on this page.';
        console.warn('[KeyPilot] Failed to render floating keyboard reference:', e);
      }
      return;
    }

    // User layout render: slot-based keyboard view.
    try {
      const id = sel.slice('user:'.length);
      const userLayout = this._currentUserLayout && this._currentUserLayout.id === id
        ? this._currentUserLayout
        : await getUserKeyboardLayoutById(id);
      const macros = (Array.isArray(this._currentUserMacros) && this._currentUserMacros.length)
        ? this._currentUserMacros
        : await listUserMacros();
      const actions = (Array.isArray(this._currentUserActions) && this._currentUserActions.length)
        ? this._currentUserActions
        : await listUserActions();
      if (token !== this._renderToken) return;
      if (!userLayout) {
        // Orphaned current selection — fall back to built-in instead of a dead-end message.
        this._currentKeyboardLayoutId = 'builtin';
        this._currentUserLayout = null;
        try {
          await setSettings({ currentKeyboardLayoutId: 'builtin' });
        } catch { /* ignore */ }
        try {
          if (this._layoutTitleEl) {
            this._layoutTitleEl.textContent = (this._textModeFilterActive && !this._editMode)
              ? 'Keyboard Reference — Typing'
              : 'Keyboard Reference';
          }
        } catch { /* ignore */ }
        try {
          const showNumberRow = !!(settings && settings.keyboardReferenceShowNumberRow);
          const uiLayout = getKeyboardUiLayoutForLayout(this.layoutId || 'browsing-right', {
            includeNumberRow: showNumberRow
          });
          this.keyboardLayout = uiLayout;
          renderKeybindingsKeyboard({
            container: this.keyboardContainer,
            keybindings: this.keybindings,
            keyboardLayout: uiLayout,
            layoutId: this.layoutId || undefined,
            attachPopovers: true
          });
          this._rebuildKeyIndex();
          await this._refreshLayoutSelectOptions();
        } catch (e) {
          this.keyboardContainer.textContent = 'Unable to render keyboard reference on this page.';
          console.warn('[KeyPilot] Failed to render floating keyboard reference after layout fallback:', e);
        }
        return;
      }
      const baseId = String(userLayout.baseBuiltinLayoutId || this.layoutId || 'browsing-right');
      const showNumberRow = !!(settings && settings.keyboardReferenceShowNumberRow);
      const uiLayout = getKeyboardUiLayoutForLayout(baseId, { includeNumberRow: showNumberRow });
      this._renderSlotKeyboard({
        container: this.keyboardContainer,
        uiLayout,
        slots: userLayout.slots || {},
        macros,
        actions,
        keybindings: this.keybindings,
        editMode: false
      });
      this._rebuildKeyIndex();
    } catch (e) {
      this.keyboardContainer.textContent = 'Unable to render custom keyboard layout.';
      console.warn('[KeyPilot] Failed to render custom keyboard reference:', e);
    }
  }

  /**
   * @param {{ token: number, settings: any }} params
   */
  async _renderEditModeKeyboard({ token, settings }) {
    const st = this._editLayoutState;
    const mode = st?.mode === 'user' ? 'user' : 'builtin';
    const readOnly = mode !== 'user';

    try {
      if (this._layoutTitleEl) {
        this._layoutTitleEl.textContent = 'Keyboard Reference';
      }
    } catch { /* ignore */ }

    let slots = {};
    let macros = Array.isArray(st?.macros) ? st.macros : (this._currentUserMacros || []);
    let actions = Array.isArray(st?.actions) ? st.actions : (this._currentUserActions || []);
    let baseId = this.layoutId || 'browsing-right';
    let userLayout = null;

    if (mode === 'user' && st?.userLayout) {
      userLayout = st.userLayout;
      slots = userLayout.slots && typeof userLayout.slots === 'object' ? userLayout.slots : {};
      baseId = String(userLayout.baseBuiltinLayoutId || baseId);
    } else {
      // Built-in preview slots from current keybindings — transient/derived, never persisted, so
      // using `type: 'function'` here (rather than the legacy `type: 'action'`) is purely cosmetic
      // consistency with what a real duplicated layout would contain (see
      // `duplicateBuiltinLayoutToUserLayout()` in keyboard-layout-store.js).
      for (const [actionId, binding] of Object.entries(this.keybindings || {})) {
        const label = String(binding?.displayKey || binding?.keyLabel || '').trim();
        if (!label || label.length !== 1) continue;
        slots[label.toUpperCase()] = { type: 'function', id: String(actionId) };
      }
      baseId = String(st?.builtinLayoutId || this.layoutId || 'browsing-right');
    }

    if (!macros.length) {
      try { macros = await listUserMacros(); } catch { macros = []; }
    }
    if (!actions.length) {
      try { actions = await listUserActions(); } catch { actions = []; }
    }
    if (token !== this._renderToken) return;

    const showNumberRow = !!(settings && settings.keyboardReferenceShowNumberRow);
    const uiLayout = getKeyboardUiLayoutForLayout(baseId, { includeNumberRow: showNumberRow });
    this._renderSlotKeyboard({
      container: this.keyboardContainer,
      uiLayout,
      slots,
      macros,
      actions,
      keybindings: this.keybindings,
      editMode: true,
      readOnly,
      userLayout
    });
    this._rebuildKeyIndex();
  }

  /**
   * Render a user layout from physical key slots (Functions/Action Instances/macros assigned to
   * keys).
   * @param {{
   *   container: HTMLElement,
   *   uiLayout: any[],
   *   slots: Record<string, any>,
   *   macros?: any[],
   *   actions?: any[],
   *   keybindings?: Record<string, any>,
   *   editMode?: boolean,
   *   readOnly?: boolean,
   *   userLayout?: any|null
   * }} params
   */
  _renderSlotKeyboard({
    container,
    uiLayout,
    slots,
    macros,
    actions,
    keybindings,
    editMode = false,
    readOnly = true,
    userLayout = null
  } = {}) {
    if (!container) return;
    const doc = container.ownerDocument || document;
    try { this._slotDnDAbort?.abort?.(); } catch { /* ignore */ }
    this._slotDnDAbort = null;
    try { ensureStylesInjected(container.getRootNode?.() || doc); } catch { /* ignore */ }
    try { detachKeyPopoverBehavior(container); } catch { /* ignore */ }
    container.innerHTML = '';
    const visual = doc.createElement('div');
    visual.className = `keyboard-visual ${KEYBINDINGS_UI_ROOT_CLASS}${editMode ? ' kp-kb-edit-hatch' : ''}`;
    container.appendChild(visual);

    const macroLabelById = new Map();
    try {
      for (const m of macros || []) {
        if (m && m.id) macroLabelById.set(String(m.id), String(m.label || 'Macro'));
      }
    } catch { /* ignore */ }

    /** Action Instance ("action:<uuid>") -> UserAction, for resolving a `type: 'function'` slot's
     * label/keyboardClass through its bound Function (see function-library.js), whether it's a
     * configured Macro Key (`legacyMacroKeyKind`), TYPE_CHARACTERS, or any other instantiable
     * Function. Replaces the old macro-key-specific `macroKeyLabelById`/`macroKeyKindById` maps. */
    const actionById = new Map();
    try {
      for (const a of actions || []) {
        if (a && a.id) actionById.set(String(a.id), a);
      }
    } catch { /* ignore */ }

    /**
     * @param {string} id Bare Function id or Action Instance id ("action:<uuid>").
     * @returns {{ label: string, keyboardClass: string, functionId: string }}
     */
    const resolveFunctionSlot = (id) => {
      const key = String(id || '');
      if (key.startsWith('action:')) {
        const instance = actionById.get(key);
        const functionId = String(instance?.functionId || '');
        const def = functionId ? getFunctionDef(functionId) : null;
        return {
          label: String(instance?.label || def?.label || 'Configured Function'),
          keyboardClass: String(def?.keyboardClass || ''),
          // Prefer the bound Function id so icon CSS / popovers / link hints match built-in keys.
          functionId: functionId || key
        };
      }
      const def = getFunctionDef(key);
      return {
        label: String(def?.label || key),
        keyboardClass: String(def?.keyboardClass || ''),
        functionId: key
      };
    };

    const kb = keybindings || this.keybindings || {};
    const actionSlotLabelFromItem = (item) => {
      const binding = kb && kb[item.id];
      const label = String(binding?.displayKey || binding?.keyLabel || '').trim();
      return label && label.length === 1 ? label.toUpperCase() : '';
    };

    const editable = !!(editMode && !readOnly && userLayout && typeof userLayout.slots === 'object');
    // View mode must match built-in keys (clickable, not disabled). Readonly only applies
    // while editing a built-in preview that cannot be mutated in place.
    const markReadonly = !!(editMode && readOnly);
    const placeActive = !!(editMode && this._placeItem && typeof this._onPlaceSlot === 'function');
    const placeItem = placeActive ? this._placeItem : null;
    const placeHoverSlot = placeActive ? this._placeHoverSlot : null;

    const persistSlots = async () => {
      if (!editable || !userLayout) return;
      try {
        const saved = await upsertUserKeyboardLayout(userLayout);
        // Keep edit-state in sync
        if (this._editLayoutState) {
          this._editLayoutState.userLayout = saved;
          this._editLayoutState.mode = 'user';
          this._editLayoutState.userLayoutId = saved.id;
        }
        try { this._onLayoutPersisted?.(saved); } catch { /* ignore */ }
      } catch { /* ignore */ }
    };

    const applyDropToSlot = async (slotLabel, data) => {
      // DnD onto user layouts only; built-in placement goes through Config place mode (auto-dup).
      if (!editable || !userLayout) return;
      const slotMap = userLayout.slots;
      const fromSlot = data.fromSlot ? String(data.fromSlot) : '';
      const nextItem = { type: String(data.type), id: String(data.id) };
      if (nextItem.type !== 'function' && nextItem.type !== 'macro') return;
      if (!nextItem.id) return;

      const targetPrev = slotMap[slotLabel] || null;
      if (fromSlot && fromSlot !== slotLabel) {
        // Dragging from another key: swap/move.
        slotMap[slotLabel] = nextItem;
        slotMap[fromSlot] = targetPrev;
      } else {
        // From palette: replace.
        slotMap[slotLabel] = nextItem;
      }
      await persistSlots();
      this._render();
    };

    const clearSlot = async (slotLabel) => {
      if (!editable || !userLayout) return;
      userLayout.slots[slotLabel] = null;
      await persistSlots();
      this._render();
    };

    const renderSlot = (slotLabel, assigned) => {
      const previewing = !!(placeItem && placeHoverSlot === slotLabel);
      const displayAssigned = previewing ? placeItem : assigned;

      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.tabIndex = -1;
      let keyboardClass = '';
      let resolvedFn = null;
      if (displayAssigned && displayAssigned.type === 'function') {
        resolvedFn = resolveFunctionSlot(displayAssigned.id);
        keyboardClass = resolvedFn.keyboardClass;
      } else if (displayAssigned && displayAssigned.type === 'macro') {
        keyboardClass = 'key-purple';
      }
      btn.className = `key${keyboardClass ? ' ' + keyboardClass : ''}${previewing ? ' kp-place-preview' : ''}`;
      btn.dataset.kpBaseClass = 'key';
      btn.dataset.kpSlot = slotLabel;
      if (markReadonly && !placeActive) {
        btn.disabled = true;
        btn.setAttribute('data-kp-edit-readonly', 'true');
      } else if (placeActive) {
        btn.disabled = false;
        btn.draggable = false;
      } else {
        btn.disabled = false;
        // Only make keys draggable while actively editing a user layout.
        btn.draggable = !!(editMode && editable && assigned);
      }
      if (displayAssigned && displayAssigned.type === 'function' && resolvedFn) {
        // Use Function id (not Action Instance id) so FA bg-icon CSS selectors match built-in.
        try { btn.setAttribute('data-kp-action-id', String(resolvedFn.functionId)); } catch { /* ignore */ }
        const binding = kb[resolvedFn.functionId];
        const aria = (binding && (binding.description || binding.label)) || resolvedFn.label;
        try { btn.removeAttribute('title'); } catch { /* ignore */ }
        btn.setAttribute('aria-label', aria);
      }
      if (displayAssigned && displayAssigned.type === 'macro') {
        try { btn.setAttribute('data-kp-macro-id', String(displayAssigned.id)); } catch { /* ignore */ }
        const macroLabel = macroLabelById.get(String(displayAssigned.id)) || 'Macro';
        try { btn.removeAttribute('title'); } catch { /* ignore */ }
        btn.setAttribute('aria-label', macroLabel);
      }

      // Function/macro keys get the same FA background-icon layer as built-in render.
      if (displayAssigned && (displayAssigned.type === 'function' || displayAssigned.type === 'macro')) {
        ensureKeyBackgroundIcon(doc, btn);
      }

      const main = doc.createElement('div');
      main.className = 'key-main';
      if (displayAssigned && displayAssigned.type === 'macro') {
        main.textContent = macroLabelById.get(String(displayAssigned.id)) || 'Macro';
      } else if (displayAssigned && displayAssigned.type === 'function' && resolvedFn) {
        main.textContent = resolvedFn.label;
      } else {
        main.textContent = '';
      }

      const label = doc.createElement('div');
      label.className = 'key-label';
      label.textContent = slotLabel;

      btn.appendChild(main);
      btn.appendChild(label);
      ensureKeyPressOverlay(doc, btn);

      if (editMode && editable && assigned && !placeActive) {
        const del = doc.createElement('button');
        del.type = 'button';
        del.className = 'kp-key-delete';
        del.textContent = '×';
        del.setAttribute('aria-label', `Remove action from ${slotLabel}`);
        del.title = 'Remove';
        Object.assign(del.style, {
          position: 'absolute',
          top: '1px',
          right: '1px',
          left: 'auto',
          bottom: 'auto',
          width: '14px',
          height: '14px',
          zIndex: '8'
        });
        del.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          void clearSlot(slotLabel);
        }, true);
        del.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
        del.addEventListener('mousedown', (e) => e.stopPropagation(), true);
        btn.appendChild(del);
      }

      if (placeActive) {
        btn.addEventListener('pointerenter', () => {
          this.setPlaceHoverSlot(slotLabel);
        }, true);
        btn.addEventListener('pointerleave', () => {
          if (this._placeHoverSlot === slotLabel) this.setPlaceHoverSlot(null);
        }, true);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          try { this._onPlaceSlot?.(slotLabel); } catch { /* ignore */ }
        }, true);
      } else if (editMode && editable) {
        const clearOtherDropTargets = () => {
          try {
            visual.querySelectorAll('.key.kp-drop-target').forEach((el) => {
              if (el !== btn) el.classList.remove('kp-drop-target');
            });
          } catch { /* ignore */ }
        };
        const markDropTarget = (e) => {
          e.preventDefault();
          try {
            const allowed = String(e.dataTransfer?.effectAllowed || '');
            e.dataTransfer.dropEffect = allowed === 'move' ? 'move' : 'copy';
          } catch { /* ignore */ }
          clearOtherDropTargets();
          btn.classList.add('kp-drop-target');
        };
        btn.addEventListener('dragenter', markDropTarget, true);
        btn.addEventListener('dragover', markDropTarget, true);
        btn.addEventListener('dragleave', (e) => {
          // Ignore leave events that only move into a child (.key-main / .key-label).
          const related = e.relatedTarget;
          if (related instanceof Node && btn.contains(related)) return;
          btn.classList.remove('kp-drop-target');
        }, true);
        btn.addEventListener('drop', (e) => {
          e.preventDefault();
          btn.classList.remove('kp-drop-target');
          try {
            visual.querySelectorAll('.key.kp-drop-target').forEach((el) => {
              el.classList.remove('kp-drop-target');
            });
          } catch { /* ignore */ }
          try {
            const raw = e.dataTransfer?.getData?.(KP_LAYOUT_ITEM_MIME) || '';
            const data = raw ? JSON.parse(raw) : null;
            if (!data || !data.type || !data.id) return;
            void applyDropToSlot(slotLabel, data);
          } catch { /* ignore */ }
        }, true);
        btn.addEventListener('dragstart', (e) => {
          if (!assigned) return;
          try {
            const payload = JSON.stringify({ type: assigned.type, id: assigned.id, fromSlot: slotLabel });
            e.dataTransfer?.setData?.(KP_LAYOUT_ITEM_MIME, payload);
            e.dataTransfer.effectAllowed = 'move';
          } catch { /* ignore */ }
        }, true);
      }

      return btn;
    };

    for (const row of uiLayout || []) {
      const rowEl = doc.createElement('div');
      rowEl.className = 'keyboard-row';
      visual.appendChild(rowEl);
      for (const item of row || []) {
        if (!item) continue;
        if (item.type === 'special') {
          const sp = doc.createElement('div');
          sp.className = String(item.className || 'key');
          const text = doc.createElement('span');
          text.className = 'key-text';
          text.textContent = String(item.text || '');
          sp.appendChild(text);
          ensureKeyPressOverlay(doc, sp);
          rowEl.appendChild(sp);
          continue;
        }
        // Backspace is a fixed keyboard-chrome key, not an assignable one-character
        // slot. It arrives as DELETE in the full built-in layout, so preserve it
        // when switching the reference to the slot-based edit renderer.
        if (item.type === 'action' && (item.id === 'DELETE' || String(item.className || '').includes('key-backspace'))) {
          const sp = doc.createElement('div');
          sp.className = String(item.className || 'key key-backspace');
          const text = doc.createElement('span');
          text.className = 'key-text';
          text.textContent = 'Backspace';
          sp.appendChild(text);
          ensureKeyPressOverlay(doc, sp);
          rowEl.appendChild(sp);
          continue;
        }

        let slotLabel = '';
        if (item.type === 'key') slotLabel = String(item.text || '').trim().toUpperCase();
        else if (item.type === 'action') slotLabel = actionSlotLabelFromItem(item);
        if (!slotLabel) {
          const empty = doc.createElement('div');
          empty.className = 'key';
          empty.style.visibility = 'hidden';
          rowEl.appendChild(empty);
          continue;
        }
        const assigned = slots && typeof slots === 'object' ? (slots[slotLabel] || null) : null;
        rowEl.appendChild(renderSlot(slotLabel, assigned));
      }
    }

    // Clear drop-target highlight when a drag ends anywhere (cancel / drop outside).
    if (editMode && editable) {
      try {
        const ac = new AbortController();
        this._slotDnDAbort = ac;
        const clearDropTargets = () => {
          try {
            visual.querySelectorAll('.key.kp-drop-target').forEach((el) => {
              el.classList.remove('kp-drop-target');
            });
          } catch { /* ignore */ }
        };
        doc.addEventListener('dragend', clearDropTargets, { capture: true, signal: ac.signal });
        visual.addEventListener('dragleave', (e) => {
          const related = e.relatedTarget;
          if (related instanceof Node && visual.contains(related)) return;
          clearDropTargets();
        }, { capture: true, signal: ac.signal });
      } catch { /* ignore */ }
    }

    // View mode: same key-info popovers as the built-in keyboard reference.
    if (!editMode) {
      try {
        attachKeyPopoverBehavior({ root: container, keybindings: kb });
      } catch { /* ignore */ }
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
      // Cross-tab collapse sync (titlebar-only vs full keyboard).
      if (Object.prototype.hasOwnProperty.call(entry.newValue, 'keyboardReferenceCollapsed')) {
        this.setCollapsed(!!entry.newValue.keyboardReferenceCollapsed, { persist: false });
      }
      // Cross-tab / cross-page position sync (and re-apply after navigation restore).
      const nextPos = entry.newValue.panelPositions?.keyboardReference;
      if (nextPos && typeof nextPos === 'object') {
        this._suppressPositionPersist = true;
        this._setPanelPosition(nextPos, { persist: false });
        this._suppressPositionPersist = false;
      }
      // Layout selection / number-row changes should refresh the keyboard chrome.
      try {
        if (typeof entry.newValue.currentKeyboardLayoutId === 'string') {
          this._currentKeyboardLayoutId = entry.newValue.currentKeyboardLayoutId;
        }
        if (this.root && !this.root.hidden) this._render();
      } catch { /* ignore */ }
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

    // A render can adopt an early-inject keyboard shell whose press-overlay
    // classes survived the stylesheet handoff. Clear those before restoring
    // feedback for keys that are genuinely still held.
    this._scrubPressOverlays();

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
   * While a text field has focus, switch the Keyboard Reference into typing mode:
   * plain keycaps (no function chrome) with an orange glow ring, and an orange-cast titlebar.
   * Countdown-aware actions ({@link TEXT_MODE_COUNTDOWN_ACTION_IDS}) light up with full
   * function chrome only while the hover countdown is armed via setTextModeActivateArmed(true).
   * @param {boolean} active
   */
  setTextModeFilter(active) {
    const next = Boolean(active);
    if (!next) {
      this._textModeCountdownArmed = false;
    }
    if (this._textModeFilterActive === next) {
      // Still re-apply if DOM was rebuilt while state was already true.
      if (next && this.isVisible()) {
        this._applyTextModeChrome(true);
        this._applyTextModeFilterClasses(true);
      }
      return;
    }

    this._applyTextModeFilterClasses(false);
    this._textModeFilterActive = next;
    if (!next) this._textModeCountdownArmed = false;

    try {
      const kbRoot = this.shadowRoot?.querySelector?.('.kp-keybindings-ui') || this.keyboardContainer;
      if (kbRoot) {
        if (next) kbRoot.classList.add('kp-text-mode-filter');
        else kbRoot.classList.remove('kp-text-mode-filter');
      }
    } catch { /* ignore */ }

    this._applyTextModeChrome(next);

    if (next && this.isVisible()) {
      this._applyTextModeFilterClasses(true);
    }
  }

  /**
   * During text mode, light up countdown-aware actions
   * ({@link TEXT_MODE_COUNTDOWN_ACTION_IDS}, currently Click Element) only while a
   * clickable is under the cursor and the hover-click countdown is running.
   * @param {boolean} armed
   */
  setTextModeActivateArmed(armed) {
    const next = Boolean(armed);
    if (!this._textModeFilterActive) {
      this._textModeCountdownArmed = false;
      return;
    }
    if (this._textModeCountdownArmed === next) {
      if (next && this.isVisible()) this._applyTextModeFilterClasses(true);
      return;
    }
    this._textModeCountdownArmed = next;
    if (this.isVisible()) this._applyTextModeFilterClasses(true);
  }

  /**
   * Replace the set of action ids that light up when the text-mode countdown is armed.
   * @param {Iterable<string>} actionIds
   */
  setTextModeCountdownActionIds(actionIds) {
    const next = new Set();
    try {
      for (const id of actionIds || []) {
        const s = String(id || '').trim();
        if (s) next.add(s);
      }
    } catch { /* ignore */ }
    this._textModeCountdownActionIds = next.size ? next : new Set(TEXT_MODE_COUNTDOWN_ACTION_IDS);
    if (this._textModeFilterActive && this.isVisible()) {
      this._applyTextModeFilterClasses(true);
    }
  }

  /**
   * @param {boolean} on
   */
  _applyTextModeFilterClasses(on) {
    try {
      const root = this.shadowRoot || this.keyboardContainer || this.root;
      if (!root) return;
      const countdownArmed = !!(on && this._textModeCountdownArmed);
      const liveIds = this._textModeCountdownActionIds instanceof Set
        ? this._textModeCountdownActionIds
        : TEXT_MODE_COUNTDOWN_ACTION_IDS;
      const keys = root.querySelectorAll('.key');
      for (const el of keys) {
        if (!el) continue;
        el.classList.remove('kp-key-text-mode-disabled');
        el.classList.remove('kp-key-text-mode-active');
        if (!on) continue;
        const actionId = el.getAttribute('data-kp-action-id') || '';
        if (countdownArmed && actionId && liveIds.has(actionId)) {
          // Countdown armed: restore full function chrome for live actions.
          el.classList.add('kp-key-text-mode-active');
        } else {
          // Typing mode: plain keys + orange ring (CSS); gate interaction.
          el.classList.add('kp-key-text-mode-disabled');
        }
      }

      const kbRoot = this.shadowRoot?.querySelector?.('.kp-keybindings-ui') || this.keyboardContainer;
      if (kbRoot) {
        if (on) kbRoot.classList.add('kp-text-mode-filter');
        else kbRoot.classList.remove('kp-text-mode-filter');
      }

      if (on) this._applyTextModeChrome(true);
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

  /**
   * Strip any leftover press-feedback classes/overlays on the current keyboard DOM
   * (e.g. early-inject shell before content re-render).
   */
  _scrubPressOverlays() {
    try {
      const root = this.keyboardContainer || this.root;
      if (!root?.querySelectorAll) return;
      root.querySelectorAll('.key.kp-key-pressed').forEach((el) => {
        try { setKeyPressedState(el, false); } catch { /* ignore */ }
      });
      root.querySelectorAll('.key-press-overlay.is-on').forEach((el) => {
        try { el.classList.remove('is-on'); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
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


