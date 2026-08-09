/**
 * Keyboard Layout Config — floating palette + layout CRUD.
 *
 * No keyboard chrome here: editing happens on the Keyboard Reference panel
 * while it is in edit mode. Click a function/macro, then click a Reference slot
 * to place it (SVG arrow follows the cursor). Built-in layouts auto-duplicate
 * on first place as "{Family} N (user)".
 *
 * This is the single Function Library surface (browsing, per-instance parameter editing,
 * macro step editing, and modifier-chord binding for `worksWhileTyping` Functions all live
 * here) — there used to be a second, additive `function-library-panel.js` floating window for
 * this; it was folded in here so editing a layout only ever involves one panel. See
 * KEY_ACTION_ARCHITECTURE.md "Migration mapping".
 */

import { Z_INDEX } from '../config/constants.js';
import {
  buildKeybindingsForLayout,
  BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  KEYBINDING_ACTION_DEFS,
  nextUserCopyLayoutLabel,
  normalizeKeyboardLayoutFamilyId
} from '../config/keyboard-layouts.js';
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../modules/settings-manager.js';
import {
  addUserMacroStep,
  createUserAction,
  createUserMacro,
  createEmptyUserKeyboardLayout,
  deleteUserAction,
  deleteUserKeyboardLayout,
  deleteUserMacro,
  duplicateBuiltinLayoutToUserLayout,
  exportUserKeyboardLayout,
  importUserKeyboardLayout,
  listUserActions,
  listUserKeyboardLayouts,
  listUserMacros,
  moveUserMacroStep,
  removeUserMacroStep,
  setUserKeyboardLayoutSlot,
  upsertUserAction,
  upsertUserKeyboardLayout
} from '../modules/keyboard-layout-store.js';
import { MACRO_KEY_KIND_DEFS, macroKeyKeyboardClass, summarizeMacroKey } from '../config/macro-keys.js';
import {
  FIXED_KEY_FUNCTION_IDS,
  FUNCTION_CATEGORY_ORDER,
  FUNCTION_ID_BY_MACRO_KEY_KIND,
  getFunctionCategory,
  getFunctionDef,
  isFunctionInstantiable,
  listFunctionDefs,
  macroKeyKindFromFunctionId,
  summarizeFunctionParameters,
  validateFunctionSlotKey
} from '../config/function-library.js';
import { KEYBINDINGS_UI_ROOT_CLASS, KEYBINDINGS_UI_STYLE_ATTR, getKeybindingsUiCss } from './keybindings-ui-shared.js';
import { inspectKeyActionFromAnchor } from './keybindings-ui.js';
import { actionHasParameters, getSharedKeyActionConfigPanel } from './key-action-settings.js';
import { createMacroKeyEditor } from './macro-key-editor.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import { buildChordSlotKey, formatChordSlotKeyLabel } from '../utils/key-chord.js';
import {
  PANEL_POSITION_MARGIN_PX,
  applyPanelPosition,
  makePanelDraggable,
  normalizePanelPositionState
} from '../utils/panel-position.js';

/** Shared drag MIME for layout items (functions/macros/key slots). */
export const KP_LAYOUT_ITEM_MIME = 'application/x-kp-layout-item';

/**
 * Adapt a `UserAction` for one of the legacy keystroke-primitive Functions
 * (`legacyMacroKeyKind` in function-library.js) into the `{ id, kind, label, config }` shape
 * `macro-key-editor.js` and `macro-keys.js`'s summary/class helpers expect — this is purely a UI
 * convenience view; persistence always goes back through `createUserAction`/`upsertUserAction`.
 * @param {import('../modules/keyboard-layout-store.js').UserAction} action
 * @returns {{ id: string, kind: string, label: string, config: Record<string, any> }|null}
 */
function macroKeyLikeFromUserAction(action) {
  const kind = macroKeyKindFromFunctionId(action?.functionId);
  if (!kind) return null;
  return {
    id: action.id,
    kind,
    label: String(action.label || ''),
    config: (action.parameters && action.parameters.config) || {}
  };
}

const CONFIG_POSITION_MARGIN_PX = Math.max(PANEL_POSITION_MARGIN_PX, 16);
/** Reference keycap is 50px; Config palette keys are 1.75× for readable labels. */
const CONFIG_KEY_SIZE_PX = Math.round(50 * 1.75);
const CONFIG_PANEL_WIDTH_PX = 640;
const CONFIG_STYLE_ATTR = 'data-kp-layout-config-panel-style';
const CONFIG_STYLE_VERSION = 'v3';

/**
 * @typedef {{
 *   mode: 'builtin'|'user',
 *   builtinLayoutId: string,
 *   userLayoutId: string|null,
 *   userLayout: any|null,
 *   userLayouts: any[],
 *   macros: any[],
 *   // All UserAction Action Instances (see keyboard-layout-store.js) — passed through to
 *   // `applyLiveUserLayout`/`setEditLayout` so newly bound instances dispatch/render immediately.
 *   actions: any[],
 *   // `actions` filtered + adapted to `{ id, kind, label, config }` for the "Configured Macro
 *   // Keys" section — see `macroKeyLikeFromUserAction()`. Every entry here is also present in
 *   // `actions`.
 *   macroKeys: any[]
 * }} LayoutConfigState
 */

export class KeyboardLayoutConfigPanel {
  /**
   * @param {object} [opts]
   * @param {(info: { state: LayoutConfigState }) => void} [opts.onChange]
   * @param {() => void} [opts.onClose]
   */
  constructor({ onChange, onClose } = {}) {
    /** @type {any} */
    this._kp = null;
    this._onChange = typeof onChange === 'function' ? onChange : null;
    this._onClose = typeof onClose === 'function' ? onClose : null;
    this.root = null;
    this._listEl = null;
    this._layoutSelect = null;
    this._nameInput = null;
    this._searchInput = null;
    this._macrosActionsRow = null;
    this._macroKeysActionsRow = null;
    this._macroKeyEditorHost = null;
    this._showNumRowToggle = null;
    this._dragDispose = null;
    this._positionHydrated = false;
    /** @type {any|null} draft while editing a macro key */
    this._macroKeyDraft = null;
    /** Live keydown capture cleanup for the "Bind chord…" control (worksWhileTyping Functions). */
    this._chordCaptureCleanup = null;
    /** Place mode: click palette → arrow to cursor → click Reference slot */
    this._placeItem = null;
    /** @type {HTMLElement|null} */
    this._placeSourceEl = null;
    /** @type {HTMLElement|null} */
    this._placeArrowEl = null;
    this._placePointerBound = false;
    this._onPlacePointerMove = this._onPlacePointerMove.bind(this);
    this._onPlaceKeyDown = this._onPlaceKeyDown.bind(this);
    this._onPlacePointerDown = this._onPlacePointerDown.bind(this);
    /** @type {import('../modules/settings-manager.js').PanelPositionSettings} */
    this._panelPosition = {
      ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig
    };
    /** @type {LayoutConfigState} */
    this._st = {
      mode: 'builtin',
      builtinLayoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
      userLayoutId: null,
      userLayout: null,
      userLayouts: [],
      macros: [],
      actions: [],
      macroKeys: []
    };
  }

  isOpen() {
    return !!(this.root && this.root.isConnected && !this.root.hidden);
  }

  /** @returns {LayoutConfigState} */
  getState() {
    return this._st;
  }

  /**
   * @param {any} kp KeyPilot instance
   */
  async show(kp) {
    this._kp = kp || null;
    if (window !== window.top) return;
    this._ensure();
    const builtinId = String(kp?._keyboardLayoutId || DEFAULT_KEYBOARD_LAYOUT_ID);
    this._st.builtinLayoutId = builtinId;

    // Prefer currently active user layout when entering edit mode.
    try {
      const sel = String(kp?._currentKeyboardLayoutId || 'builtin');
      if (sel.startsWith('user:')) {
        const id = sel.slice('user:'.length);
        this._st.mode = 'user';
        this._st.userLayoutId = id;
      } else {
        this._st.mode = 'builtin';
        this._st.userLayoutId = null;
        this._st.userLayout = null;
      }
    } catch { /* ignore */ }

    await this._reloadStore();
    this._setVisible(true);
    this._emitChange();
  }

  hide() {
    this._cancelPlaceMode();
    this._stopChordCapture();
    this._setVisible(false);
  }

  cleanup() {
    this._cancelPlaceMode();
    this._stopChordCapture();
    try { this._dragDispose?.(); } catch { /* ignore */ }
    this._dragDispose = null;
    try {
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    } catch { /* ignore */ }
    this.root = null;
    this._listEl = null;
    this._kp = null;
  }

  /**
   * Called by Keyboard Reference after a drop/delete so the palette assignment badges update.
   * @param {any} layout
   */
  syncUserLayout(layout) {
    if (!layout || !layout.id) return;
    this._st.mode = 'user';
    this._st.userLayoutId = layout.id;
    this._st.userLayout = layout;
    try {
      const idx = (this._st.userLayouts || []).findIndex((l) => l && l.id === layout.id);
      if (idx >= 0) this._st.userLayouts[idx] = layout;
      else this._st.userLayouts = [...(this._st.userLayouts || []), layout];
    } catch { /* ignore */ }
    this._renderLayoutSelect();
    this._renderRightList();
  }

  _emitChange() {
    try { this._onChange?.({ state: this._st }); } catch { /* ignore */ }
  }

  _setVisible(visible) {
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
      this._applyPanelPositionNow();
    } else {
      try { this.root.hidden = true; } catch { /* ignore */ }
      try { this.root.classList.add('kpv2-hidden'); } catch { /* ignore */ }
      try {
        this.root.style.setProperty('display', 'none', 'important');
        this.root.style.setProperty('pointer-events', 'none', 'important');
      } catch {
        try { this.root.style.display = 'none'; } catch { /* ignore */ }
      }
    }
  }

  _ensureStylesInjected(doc) {
    try {
      if (!doc || !doc.head) return;
      const attr = KEYBINDINGS_UI_STYLE_ATTR || 'data-kp-keybindings-ui-style';
      let style = doc.head.querySelector(`style[${attr}]`);
      if (!style) {
        style = doc.createElement('style');
        style.setAttribute(attr, 'true');
        doc.head.appendChild(style);
      }
      const getURL = (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) ? chrome.runtime.getURL.bind(chrome.runtime) : null;
      const fontUrls = getURL ? {
        robotech: getURL('fonts/ROBOTECHGPRegular.ttf'),
        titillium: getURL('fonts/TitilliumTextRegular.otf'),
        cubellan: getURL('fonts/CubellanRegular.ttf'),
        ezarion: getURL('fonts/EzarionRegular.ttf'),
        dosis: getURL('fonts/DosisBook.ttf')
      } : undefined;
      const css = getKeybindingsUiCss({ zKeybindingsPopover: Z_INDEX.KEYBINDINGS_POPOVER, fontUrls });
      if (style.textContent !== css) style.textContent = css;

      if (!doc.head.querySelector(`style[${CONFIG_STYLE_ATTR}="${CONFIG_STYLE_VERSION}"]`)) {
        // Remove older style injections so size/layout updates always apply.
        try {
          doc.head.querySelectorAll(`style[${CONFIG_STYLE_ATTR}]`).forEach((el) => el.remove());
        } catch { /* ignore */ }
        const s = doc.createElement('style');
        s.setAttribute(CONFIG_STYLE_ATTR, CONFIG_STYLE_VERSION);
        s.textContent = `
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} {
  gap: 12px;
}
.kp-layout-config-panel .kp-cfg-category {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kp-layout-config-panel .kp-cfg-category-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(160, 170, 185, 0.9);
  padding: 2px 2px 0;
}
.kp-layout-config-panel .kp-cfg-key-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  justify-content: stretch;
  width: 100%;
}
.kp-layout-config-panel .kp-cfg-item {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 6px;
  min-width: 0;
  padding: 5px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.03);
  box-sizing: border-box;
}
.kp-layout-config-panel .kp-cfg-item:hover {
  border-color: rgba(255,255,255,0.22);
  background: rgba(255,255,255,0.05);
}
.kp-layout-config-panel .kp-cfg-item.kp-place-source-item {
  border-color: rgba(91,226,241,0.75);
  box-shadow: 0 0 0 1px rgba(91,226,241,0.25);
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .kp-cfg-item .key {
  flex: 0 0 auto !important;
  width: ${CONFIG_KEY_SIZE_PX}px !important;
  min-width: ${CONFIG_KEY_SIZE_PX}px !important;
  max-width: ${CONFIG_KEY_SIZE_PX}px !important;
  height: ${CONFIG_KEY_SIZE_PX}px !important;
  min-height: ${CONFIG_KEY_SIZE_PX}px !important;
  max-height: ${CONFIG_KEY_SIZE_PX}px !important;
  cursor: pointer;
  position: relative;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .key.kp-place-source {
  outline: 2px solid rgba(91,226,241,0.95);
  outline-offset: -1px;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .key .key-main {
  top: 4px !important;
  left: 3px !important;
  right: 3px !important;
  max-width: 100%;
  max-height: calc(${CONFIG_KEY_SIZE_PX}px - 22px) !important;
  overflow: hidden;
  text-overflow: clip;
  white-space: normal !important;
  word-break: break-word;
  overflow-wrap: anywhere;
  display: block !important;
  -webkit-line-clamp: unset !important;
  line-clamp: unset !important;
  font-size: 12px !important;
  line-height: 1.15 !important;
  text-transform: none;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .key .key-main .kp-cfg-label-line {
  display: block;
}
.kp-layout-config-panel .kp-cfg-inspect {
  flex: 1 1 auto;
  min-width: 0;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.06);
  color: rgba(226, 232, 240, 0.95);
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
  text-align: center;
  white-space: normal;
  word-break: break-word;
}
.kp-layout-config-panel .kp-cfg-inspect:hover {
  background: rgba(255,255,255,0.11);
  border-color: rgba(91,226,241,0.45);
  color: rgba(248,250,252,1);
}
.kp-layout-config-panel .kp-cfg-btn {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(248,250,252,0.95);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.kp-layout-config-panel .kp-cfg-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.kp-layout-config-panel .kp-cfg-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.10);
}
.kp-layout-config-panel .kp-cfg-field {
  width: 100%;
  padding: 7px 9px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  color: rgba(248,250,252,0.95);
  outline: none;
  font-size: 12px;
  box-sizing: border-box;
}
.kp-layout-config-panel .kp-mk-kind-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  margin-bottom: 8px;
}
.kp-layout-config-panel .kp-mk-kind-btn {
  text-align: left;
  padding: 8px 9px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.04);
  color: rgba(248,250,252,0.95);
  cursor: pointer;
  font-size: 11px;
  line-height: 1.3;
}
.kp-layout-config-panel .kp-mk-kind-btn strong {
  display: block;
  font-size: 11px;
  margin-bottom: 2px;
}
.kp-layout-config-panel .kp-mk-kind-btn span {
  display: block;
  opacity: 0.7;
  font-size: 10px;
}
.kp-layout-config-panel .kp-mk-kind-btn:hover {
  border-color: rgba(91,226,241,0.45);
  background: rgba(255,255,255,0.08);
}
.kp-layout-config-panel .kp-mk-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.04);
  margin-bottom: 8px;
}
.kp-layout-config-panel .kp-mk-editor-title {
  font-size: 11px;
  font-weight: 700;
}
.kp-layout-config-panel .kp-mk-field-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.75;
}
.kp-layout-config-panel .kp-mk-stroke,
.kp-layout-config-panel .kp-mk-stroke-row,
.kp-layout-config-panel .kp-mk-mouse-row,
.kp-layout-config-panel .kp-mk-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.kp-layout-config-panel .kp-mk-key-input {
  width: 72px;
  min-width: 56px;
  flex: 0 0 auto;
}
.kp-layout-config-panel .kp-mk-mod {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  opacity: 0.9;
}
.kp-layout-config-panel .kp-mk-stroke-idx {
  width: 16px;
  font-size: 10px;
  opacity: 0.7;
}
.kp-layout-config-panel .kp-mk-preview {
  font-size: 11px;
  opacity: 0.85;
  padding: 4px 0;
}
.kp-layout-config-panel .kp-cfg-btn[aria-pressed="true"] {
  background: rgba(91,226,241,0.18);
  border-color: rgba(91,226,241,0.45);
}
.kp-cfg-btn[data-capturing="true"] {
  background: #ffb020;
  color: #221a05;
  border-color: #ffb020;
}
.kp-cfg-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
}
.kp-cfg-badge {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 5px;
  border-radius: 999px;
  background: rgba(255,166,87,0.22);
  color: #ffcf9e;
  white-space: nowrap;
  align-self: flex-start;
}
.kp-layout-place-arrow {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  border: none;
  overflow: hidden;
  pointer-events: none;
  background: transparent;
  z-index: ${Z_INDEX.LAYOUT_PLACE_ARROW};
}
.kp-layout-place-arrow svg {
  width: 100%;
  height: 100%;
  display: block;
}
        `.trim();
        doc.head.appendChild(s);
      }
    } catch { /* ignore */ }
  }

  _applyProChrome(root) {
    if (!root || !root.style) return;
    Object.assign(root.style, {
      position: 'fixed',
      width: `${CONFIG_PANEL_WIDTH_PX}px`,
      maxWidth: `calc(100vw - ${CONFIG_POSITION_MARGIN_PX * 2}px)`,
      maxHeight: `calc(100vh - ${CONFIG_POSITION_MARGIN_PX * 2}px)`,
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
      zIndex: String(Z_INDEX.KEYBOARD_LAYOUT_CONFIG),
      background: 'rgba(10, 11, 14, 0.98)',
      color: 'rgba(248, 250, 252, 0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '4px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    });
    applyPopupThemeVars(root);
  }

  _applyPanelPositionNow() {
    if (!this.root) return;
    try {
      const resolved = applyPanelPosition(this.root, this._panelPosition, {
        margin: CONFIG_POSITION_MARGIN_PX,
        defaultAnchor: 'middle-right',
        fallbackWidth: CONFIG_PANEL_WIDTH_PX,
        fallbackHeight: 520
      });
      if (resolved && !resolved.anchor) {
        this._panelPosition = { left: resolved.left, top: resolved.top, anchor: null };
      } else if (resolved?.anchor) {
        this._panelPosition = { left: resolved.left, top: resolved.top, anchor: resolved.anchor };
      }
    } catch { /* ignore */ }
  }

  async _persistPosition(next) {
    const normalized = normalizePanelPositionState(
      next,
      DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig
    ) || { ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig };
    this._panelPosition = {
      left: normalized.left,
      top: normalized.top,
      anchor: normalized.anchor === undefined ? null : normalized.anchor
    };
    try {
      await setSettings({ panelPositions: { keyboardLayoutConfig: { ...this._panelPosition } } });
    } catch { /* ignore */ }
  }

  _ensure() {
    if (this.root && this.root.isConnected) {
      this._applyProChrome(this.root);
      return;
    }

    const doc = document;
    this._ensureStylesInjected(doc);

    const root = doc.createElement('div');
    root.className = 'kp-layout-config-panel';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Keyboard layout configuration');
    root.hidden = true;
    this._applyProChrome(root);

    // Titlebar
    const header = doc.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      height: '28px',
      minHeight: '28px',
      boxSizing: 'border-box',
      padding: '0 6px 0 10px',
      borderBottom: '1px solid rgba(0,0,0,0.55)',
      background: 'linear-gradient(180deg, #1a1b1f 0%, #121316 100%)',
      flex: '0 0 auto',
      cursor: 'grab',
      userSelect: 'none'
    });
    header.title = 'Drag to move';

    const title = doc.createElement('div');
    title.textContent = 'Keyboard Layout Config';
    Object.assign(title.style, {
      fontSize: '11px',
      fontWeight: '600',
      color: 'rgba(220, 220, 225, 0.9)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    });

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close layout config');
    Object.assign(closeBtn.style, {
      width: '22px',
      height: '22px',
      borderRadius: '4px',
      border: 'none',
      background: 'transparent',
      color: 'rgba(200, 200, 205, 0.9)',
      cursor: 'pointer',
      fontSize: '15px',
      lineHeight: '20px',
      padding: '0',
      flex: '0 0 auto'
    });
    closeBtn.addEventListener('click', () => {
      this.hide();
      try { this._onClose?.(); } catch { /* ignore */ }
    }, true);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = doc.createElement('div');
    Object.assign(body.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '10px',
      flex: '1 1 auto',
      minHeight: '0',
      overflow: 'hidden'
    });

    // Layout CRUD
    const layoutSelect = doc.createElement('select');
    layoutSelect.className = 'kp-cfg-field';
    layoutSelect.setAttribute('aria-label', 'Layout to edit');

    const nameInput = doc.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'kp-cfg-field';
    nameInput.placeholder = 'Layout name';

    const btnRow = doc.createElement('div');
    Object.assign(btnRow.style, {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px'
    });

    const mkBtn = (text) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'kp-cfg-btn';
      b.textContent = text;
      return b;
    };

    const newBtn = mkBtn('New');
    const duplicateBtn = mkBtn('Duplicate');
    const deleteBtn = mkBtn('Delete');
    const exportBtn = mkBtn('Export');
    const importBtn = mkBtn('Import');
    const setCurrentBtn = mkBtn('Set current');
    const importFile = doc.createElement('input');
    importFile.type = 'file';
    importFile.accept = 'application/json,.json';
    importFile.hidden = true;

    btnRow.appendChild(newBtn);
    btnRow.appendChild(duplicateBtn);
    btnRow.appendChild(deleteBtn);
    btnRow.appendChild(exportBtn);
    btnRow.appendChild(importBtn);
    btnRow.appendChild(setCurrentBtn);
    btnRow.appendChild(importFile);

    const hint = doc.createElement('div');
    hint.textContent = 'Click a function, macro, or macro key below, then click a Keyboard Reference key to place it. ' +
      'Functions marked "Needs modifier" must use "Bind chord…" instead — they run while a text field is focused.';
    Object.assign(hint.style, { fontSize: '11px', opacity: '0.75', lineHeight: '1.35' });

    // Number row
    const numRowLabel = doc.createElement('label');
    Object.assign(numRowLabel.style, { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' });
    const showNumRowToggle = doc.createElement('input');
    showNumRowToggle.type = 'checkbox';
    const numRowText = doc.createElement('span');
    numRowText.textContent = 'Show number row (1–0)';
    numRowLabel.appendChild(showNumRowToggle);
    numRowLabel.appendChild(numRowText);

    const search = doc.createElement('input');
    search.type = 'search';
    search.className = 'kp-cfg-field';
    search.placeholder = 'Search…';

    // Functions, Macros, and Macro Keys are all Function-Library-backed placeable items now
    // (see KEY_ACTION_ARCHITECTURE.md), so they share a single unified, always-visible list
    // below instead of separate tabs — these two rows just hold the "create new" controls for
    // the Macros and Macro Keys sections of that list.
    const macrosActionsRow = doc.createElement('div');
    Object.assign(macrosActionsRow.style, { display: 'flex', gap: '6px' });
    const newMacroBtn = mkBtn('New Macro');
    macrosActionsRow.appendChild(newMacroBtn);

    const macroKeysActionsRow = doc.createElement('div');
    Object.assign(macroKeysActionsRow.style, { display: 'flex', flexDirection: 'column', gap: '6px' });

    const macroKeyEditorHost = doc.createElement('div');
    macroKeyEditorHost.hidden = true;

    const list = doc.createElement('div');
    list.setAttribute('data-kp-layout-list', 'true');
    list.className = KEYBINDINGS_UI_ROOT_CLASS;
    Object.assign(list.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      flex: '1 1 auto',
      minHeight: '120px',
      maxHeight: '52vh',
      overflow: 'auto',
      paddingRight: '2px'
    });

    body.appendChild(layoutSelect);
    body.appendChild(nameInput);
    body.appendChild(btnRow);
    body.appendChild(hint);
    body.appendChild(numRowLabel);
    body.appendChild(search);
    body.appendChild(macrosActionsRow);
    body.appendChild(macroKeysActionsRow);
    body.appendChild(macroKeyEditorHost);
    body.appendChild(list);

    root.appendChild(header);
    root.appendChild(body);
    (doc.body || doc.documentElement).appendChild(root);

    this.root = root;
    this._listEl = list;
    this._layoutSelect = layoutSelect;
    this._nameInput = nameInput;
    this._searchInput = search;
    this._macrosActionsRow = macrosActionsRow;
    this._macroKeysActionsRow = macroKeysActionsRow;
    this._macroKeyEditorHost = macroKeyEditorHost;
    this._showNumRowToggle = showNumRowToggle;

    // Drag
    try {
      const api = makePanelDraggable(root, header, {
        margin: CONFIG_POSITION_MARGIN_PX,
        excludeSelector: 'button[aria-label="Close layout config"]',
        onMoveEnd: (state) => {
          if (!state?.moved) return;
          void this._persistPosition({
            left: state.left,
            top: state.top,
            anchor: state.anchor
          });
        }
      });
      this._dragDispose = api?.dispose || null;
    } catch { /* ignore */ }

    // Seed position from settings
    void (async () => {
      try {
        const settings = await getSettings();
        const pos = settings?.panelPositions?.keyboardLayoutConfig;
        if (pos && typeof pos === 'object') {
          this._panelPosition = normalizePanelPositionState(
            pos,
            DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig
          ) || this._panelPosition;
        }
        try {
          showNumRowToggle.checked = !!settings?.keyboardReferenceShowNumberRow;
        } catch { /* ignore */ }
        this._positionHydrated = true;
        if (this.isOpen()) this._applyPanelPositionNow();
      } catch { /* ignore */ }
    })();

    // Wire events
    search.addEventListener('input', () => this._renderRightList(), true);

    layoutSelect.addEventListener('change', async () => {
      const v = String(layoutSelect.value || '');
      if (v.startsWith('user:')) {
        const id = v.slice('user:'.length);
        const found = this._st.userLayouts.find((l) => l && l.id === id) || null;
        this._st.mode = 'user';
        this._st.userLayoutId = id;
        this._st.userLayout = found;
      } else {
        this._st.mode = 'builtin';
        this._st.userLayoutId = null;
        this._st.userLayout = null;
      }
      this._renderLayoutSelect();
      this._renderRightList();
      this._emitChange();
    }, true);

    nameInput.addEventListener('change', async () => {
      if (this._st.mode !== 'user' || !this._st.userLayout) return;
      this._st.userLayout.label = String(nameInput.value || '').trim() || 'Custom Layout';
      await this._persistUserLayout();
      this._st.userLayouts = await listUserKeyboardLayouts();
      this._renderLayoutSelect();
      this._emitChange();
    }, true);

    newBtn.addEventListener('click', async () => {
      try {
        const created = await createEmptyUserKeyboardLayout({
          baseBuiltinLayoutId: this._st.builtinLayoutId,
          label: 'New Layout',
          includeNumberRow: true
        });
        this._st.userLayouts = await listUserKeyboardLayouts();
        this._st.mode = 'user';
        this._st.userLayoutId = created.id;
        this._st.userLayout = created;
        this._renderLayoutSelect();
        this._renderRightList();
        this._emitChange();
      } catch {
        this._notify('Failed to create layout.', 'error');
      }
    }, true);

    duplicateBtn.addEventListener('click', async () => {
      try {
        const created = await duplicateBuiltinLayoutToUserLayout({
          builtinLayoutId: this._st.builtinLayoutId,
          label: 'Custom Layout'
        });
        this._st.userLayouts = await listUserKeyboardLayouts();
        this._st.mode = 'user';
        this._st.userLayoutId = created.id;
        this._st.userLayout = created;
        this._renderLayoutSelect();
        this._renderRightList();
        this._emitChange();
      } catch {
        this._notify('Failed to duplicate layout.', 'error');
      }
    }, true);

    deleteBtn.addEventListener('click', async () => {
      if (this._st.mode !== 'user' || !this._st.userLayoutId) return;
      const deletedId = String(this._st.userLayoutId);
      try {
        await deleteUserKeyboardLayout(deletedId);
        this._st.userLayouts = await listUserKeyboardLayouts();
        this._st.mode = 'builtin';
        this._st.userLayoutId = null;
        this._st.userLayout = null;
        this._renderLayoutSelect();
        this._renderRightList();
        this._emitChange();

        // Keep KeyPilot + Keyboard Reference current selection in sync.
        try {
          const kp = this._kp;
          const cur = String(kp?._currentKeyboardLayoutId || kp?._settings?.currentKeyboardLayoutId || '');
          if (cur === `user:${deletedId}`) {
            await setSettings({ currentKeyboardLayoutId: 'builtin' });
            if (kp) {
              kp._currentKeyboardLayoutId = 'builtin';
              kp._currentUserLayout = null;
              kp._currentUserMacros = [];
              kp._currentKeySlotMap = null;
              if (kp._settings) kp._settings.currentKeyboardLayoutId = 'builtin';
            }
          }
          if (typeof kp?._refreshCurrentKeyboardLayoutFromSettings === 'function') {
            void kp._refreshCurrentKeyboardLayoutFromSettings();
          } else {
            kp?.floatingKeyboardHelp?.setActiveLayoutSelection?.({
              currentKeyboardLayoutId: String(kp?._currentKeyboardLayoutId || 'builtin'),
              userLayout: kp?._currentUserLayout || null,
              userMacros: kp?._currentUserMacros || []
            });
          }
        } catch { /* ignore */ }
      } catch {
        this._notify('Failed to delete layout.', 'error');
      }
    }, true);

    exportBtn.addEventListener('click', async () => {
      if (this._st.mode !== 'user' || !this._st.userLayout) return;
      try {
        const payload = exportUserKeyboardLayout(this._st.userLayout);
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        const safe = String(this._st.userLayout.label || 'layout').replaceAll(/[^a-zA-Z0-9-_]+/g, '_');
        a.download = `keypilot-layout-${safe}.json`;
        doc.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        this._notify('Failed to export layout.', 'error');
      }
    }, true);

    importBtn.addEventListener('click', () => {
      try { importFile.click(); } catch { /* ignore */ }
    }, true);

    importFile.addEventListener('change', async () => {
      const file = importFile.files && importFile.files[0] ? importFile.files[0] : null;
      if (!file) return;
      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        const created = await importUserKeyboardLayout(raw);
        if (!created) {
          this._notify('Invalid layout file.', 'error');
          return;
        }
        this._st.userLayouts = await listUserKeyboardLayouts();
        this._st.mode = 'user';
        this._st.userLayoutId = created.id;
        this._st.userLayout = created;
        this._renderLayoutSelect();
        this._renderRightList();
        this._emitChange();
      } catch {
        this._notify('Failed to import layout.', 'error');
      } finally {
        try { importFile.value = ''; } catch { /* ignore */ }
      }
    }, true);

    setCurrentBtn.addEventListener('click', async () => {
      try {
        const v = String(layoutSelect.value || '');
        const next = v.startsWith('user:') ? v : 'builtin';
        await setSettings({ currentKeyboardLayoutId: next });
        if (this._kp?._settings) this._kp._settings.currentKeyboardLayoutId = next;
        try {
          if (next.startsWith('user:') && this._st.userLayout && `user:${this._st.userLayout.id}` === next) {
            await this._kp?.applyLiveUserLayout?.(this._st.userLayout, {
              setAsCurrent: true,
              macros: this._st.macros,
              actions: this._st.actions
            });
          } else {
            await this._kp?._refreshCurrentKeyboardLayoutFromSettings?.();
          }
        } catch { /* ignore */ }
        this._notify('Set as current keyboard layout.', 'success');
        this._emitChange();
      } catch {
        this._notify('Failed to set current keyboard layout.', 'error');
      }
    }, true);

    newMacroBtn.addEventListener('click', async () => {
      try {
        const created = await createUserMacro({ label: `Macro ${(this._st.macros || []).length + 1}` });
        this._st.macros = await listUserMacros();
        this._renderRightList();
        if (created) this._openMacroStepsEditor(created);
        this._emitChange();
      } catch {
        this._notify('Failed to create macro.', 'error');
      }
    }, true);

    showNumRowToggle.addEventListener('change', async () => {
      try {
        const on = !!showNumRowToggle.checked;
        await setSettings({ keyboardReferenceShowNumberRow: on });
        if (this._kp?._settings) this._kp._settings.keyboardReferenceShowNumberRow = on;
        try { this._kp?._applyKeyboardLayoutFromSettings?.(); } catch { /* ignore */ }
        this._emitChange();
      } catch { /* ignore */ }
    }, true);
  }

  _notify(message, type) {
    try {
      this._kp?.overlayManager?.showNotification?.(message, type);
    } catch { /* ignore */ }
  }

  /** Refresh `_st.actions` from the store and re-derive the Macro Keys tab's filtered view. */
  async _reloadActions() {
    try { this._st.actions = await listUserActions(); } catch { this._st.actions = []; }
    this._st.macroKeys = this._st.actions
      .map(macroKeyLikeFromUserAction)
      .filter(Boolean);
  }

  async _reloadStore() {
    try { this._st.userLayouts = await listUserKeyboardLayouts(); } catch { this._st.userLayouts = []; }
    try { this._st.macros = await listUserMacros(); } catch { this._st.macros = []; }
    await this._reloadActions();
    if (this._st.mode === 'user' && this._st.userLayoutId) {
      const missingId = String(this._st.userLayoutId);
      const found = this._st.userLayouts.find((l) => l && l.id === missingId) || null;
      this._st.userLayout = found;
      if (!found) {
        this._st.mode = 'builtin';
        this._st.userLayoutId = null;
        try {
          const kp = this._kp;
          const cur = String(kp?._currentKeyboardLayoutId || kp?._settings?.currentKeyboardLayoutId || '');
          if (cur === `user:${missingId}`) {
            await setSettings({ currentKeyboardLayoutId: 'builtin' });
            if (kp) {
              kp._currentKeyboardLayoutId = 'builtin';
              kp._currentUserLayout = null;
              kp._currentKeySlotMap = null;
              if (kp._settings) kp._settings.currentKeyboardLayoutId = 'builtin';
            }
          }
        } catch { /* ignore */ }
      }
    }
    this._renderLayoutSelect();
    this._renderMacroKeyKindButtons();
    this._renderRightList();
  }

  _isReadOnly() {
    return this._st.mode !== 'user';
  }

  async _persistUserLayout() {
    if (this._st.mode !== 'user' || !this._st.userLayout) return;
    try {
      this._st.userLayout = await upsertUserKeyboardLayout(this._st.userLayout);
    } catch { /* ignore */ }
  }

  _renderMacroKeyKindButtons() {
    const host = this._macroKeysActionsRow;
    if (!host) return;
    host.replaceChildren();
    const title = document.createElement('div');
    title.className = 'kp-cfg-category-title';
    title.textContent = 'Create built-in Macro Key';
    host.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'kp-mk-kind-grid';
    for (const def of MACRO_KEY_KIND_DEFS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kp-mk-kind-btn';
      btn.innerHTML = `<strong>${def.label}</strong><span>${def.description}</span>`;
      btn.addEventListener('click', () => {
        void this._createAndEditMacroKey(def.id);
      }, true);
      grid.appendChild(btn);
    }
    host.appendChild(grid);
  }

  async _createAndEditMacroKey(kind) {
    try {
      const functionId = FUNCTION_ID_BY_MACRO_KEY_KIND[kind];
      const createdAction = functionId ? await createUserAction({ functionId }) : null;
      const created = createdAction ? macroKeyLikeFromUserAction(createdAction) : null;
      if (!created) {
        this._notify('Failed to create macro key.', 'error');
        return;
      }
      await this._reloadActions();
      this._openMacroKeyEditor(created);
      this._renderRightList();
    } catch {
      this._notify('Failed to create macro key.', 'error');
    }
  }

  /**
   * Close whichever inline editor is currently open in the shared host — Macro Key config,
   * generic Action Instance parameters, or Macro steps. Only one can be open at a time.
   */
  _closeMacroKeyEditor() {
    this._macroKeyDraft = null;
    const host = this._macroKeyEditorHost;
    if (!host) return;
    host.hidden = true;
    host.replaceChildren();
  }

  _openMacroKeyEditor(macroKey) {
    const host = this._macroKeyEditorHost;
    if (!host || !macroKey) return;
    this._macroKeyDraft = { ...macroKey, config: { ...(macroKey.config || {}) } };
    host.hidden = false;
    host.replaceChildren();
    const editor = createMacroKeyEditor({
      macroKey: this._macroKeyDraft,
      onChange: (draft) => { this._macroKeyDraft = draft; },
      onSave: async () => {
        try {
          const draft = this._macroKeyDraft;
          const functionId = FUNCTION_ID_BY_MACRO_KEY_KIND[draft.kind];
          const saved = functionId
            ? await upsertUserAction({
              id: draft.id,
              functionId,
              label: draft.label,
              parameters: { config: draft.config }
            })
            : null;
          await this._reloadActions();
          this._closeMacroKeyEditor();
          this._renderRightList();
          this._notify(saved ? 'Macro key saved.' : 'Failed to save macro key.', saved ? 'success' : 'error');
        } catch {
          this._notify('Failed to save macro key.', 'error');
        }
      },
      onCancel: () => this._closeMacroKeyEditor(),
      onDelete: async () => {
        try {
          await deleteUserAction(macroKey.id);
          await this._reloadActions();
          this._closeMacroKeyEditor();
          this._renderRightList();
          this._notify('Macro key deleted.', 'success');
        } catch {
          this._notify('Failed to delete macro key.', 'error');
        }
      }
    });
    host.appendChild(editor);
  }

  /**
   * Generic parameter editor for any instantiable Function's Action Instance (e.g. Type
   * Characters) that is *not* a `legacyMacroKeyKind` (those use {@link _openMacroKeyEditor})
   * and not one of the two fixed-physical-key Functions (those keep the `key-action-settings.js`
   * "Config" popover — see `FIXED_KEY_FUNCTION_IDS`). Values apply live per-field, matching
   * `key-action-settings.js`'s `KeyActionConfigPanel`.
   * @param {import('../config/function-library.js').FunctionDef} def
   * @param {import('../modules/keyboard-layout-store.js').UserAction} instance
   */
  _openActionParamsEditor(def, instance) {
    const host = this._macroKeyEditorHost;
    if (!host || !def || !instance) return;
    this._closeMacroKeyEditor();
    host.hidden = false;

    const draft = { ...instance, parameters: { ...(instance.parameters || {}) } };

    const wrap = document.createElement('div');
    wrap.className = 'kp-mk-editor';

    const title = document.createElement('div');
    title.className = 'kp-mk-editor-title';
    title.textContent = `${def.label} settings`;
    wrap.appendChild(title);

    for (const param of def.parameters || []) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

      const label = document.createElement('div');
      label.className = 'kp-mk-field-label';
      label.textContent = param.label || param.id;
      row.appendChild(label);

      const currentVal = draft.parameters[param.id] !== undefined ? draft.parameters[param.id] : param.defaultValue;
      let control;
      if (param.type === 'boolean') {
        control = document.createElement('input');
        control.type = 'checkbox';
        control.checked = !!currentVal;
        control.addEventListener('change', () => { draft.parameters[param.id] = !!control.checked; }, true);
      } else if (param.type === 'enum' && Array.isArray(param.options)) {
        control = document.createElement('select');
        control.className = 'kp-cfg-field';
        for (const opt of param.options) {
          const o = document.createElement('option');
          o.value = opt.id;
          o.textContent = opt.label;
          if (opt.id === currentVal) o.selected = true;
          control.appendChild(o);
        }
        control.addEventListener('change', () => { draft.parameters[param.id] = control.value; }, true);
      } else if (param.type === 'number') {
        control = document.createElement('input');
        control.type = 'number';
        control.className = 'kp-cfg-field';
        if (param.min != null) control.min = String(param.min);
        if (param.max != null) control.max = String(param.max);
        if (param.step != null) control.step = String(param.step);
        control.value = currentVal != null ? String(currentVal) : '';
        control.addEventListener('change', () => {
          const n = Number(control.value);
          draft.parameters[param.id] = Number.isFinite(n) ? n : param.defaultValue;
        }, true);
      } else if (param.multiline) {
        control = document.createElement('textarea');
        control.className = 'kp-cfg-field';
        control.rows = 3;
        if (param.placeholder) control.placeholder = String(param.placeholder);
        control.value = currentVal != null ? String(currentVal) : '';
        control.addEventListener('input', () => { draft.parameters[param.id] = control.value; }, true);
      } else {
        control = document.createElement('input');
        control.type = 'text';
        control.className = 'kp-cfg-field';
        if (param.placeholder) control.placeholder = String(param.placeholder);
        control.value = currentVal != null ? String(currentVal) : '';
        control.addEventListener('input', () => { draft.parameters[param.id] = control.value; }, true);
      }
      row.appendChild(control);
      wrap.appendChild(row);
    }

    const actions = document.createElement('div');
    actions.className = 'kp-mk-editor-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'kp-cfg-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      try {
        const saved = await upsertUserAction(draft);
        await this._reloadActions();
        try {
          if (this._st.userLayout) {
            await this._kp?.applyLiveUserLayout?.(this._st.userLayout, { actions: this._st.actions });
          }
        } catch { /* ignore */ }
        this._closeMacroKeyEditor();
        this._renderRightList();
        this._notify(saved ? 'Saved.' : 'Failed to save.', saved ? 'success' : 'error');
      } catch {
        this._notify('Failed to save.', 'error');
      }
    }, true);
    actions.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'kp-cfg-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._closeMacroKeyEditor(), true);
    actions.appendChild(cancelBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'kp-cfg-btn';
    deleteBtn.textContent = 'Delete instance';
    deleteBtn.addEventListener('click', async () => {
      try {
        await deleteUserAction(instance.id);
        await this._reloadActions();
        this._closeMacroKeyEditor();
        this._renderRightList();
        this._notify('Deleted.', 'success');
      } catch {
        this._notify('Failed to delete.', 'error');
      }
    }, true);
    actions.appendChild(deleteBtn);

    wrap.appendChild(actions);
    host.appendChild(wrap);
  }

  /**
   * Inline steps editor for a Macro — port of `function-library-panel.js`'s macro-step UI into
   * the shared inline-editor host, so Macro authoring lives in the same single palette as
   * everything else.
   * @param {import('../modules/keyboard-layout-store.js').UserMacro} macro
   */
  _openMacroStepsEditor(macro) {
    const host = this._macroKeyEditorHost;
    if (!host || !macro) return;
    this._closeMacroKeyEditor();
    host.hidden = false;
    this._renderMacroStepsEditorInto(host, macro);
  }

  /**
   * @param {HTMLElement} host
   * @param {import('../modules/keyboard-layout-store.js').UserMacro} macro
   */
  _renderMacroStepsEditorInto(host, macro) {
    host.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'kp-mk-editor';

    const title = document.createElement('div');
    title.className = 'kp-mk-editor-title';
    title.textContent = `${macro.label || 'Macro'} — steps`;
    wrap.appendChild(title);

    const steps = Array.isArray(macro.steps) ? macro.steps : [];
    if (!steps.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;opacity:0.7;';
      empty.textContent = 'No steps yet — add one below.';
      wrap.appendChild(empty);
    } else {
      const mkStepBtn = (text, title2, disabled, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'kp-cfg-btn';
        b.style.padding = '3px 6px';
        b.textContent = text;
        b.title = title2;
        b.disabled = !!disabled;
        b.addEventListener('click', onClick, true);
        return b;
      };

      steps.forEach((step, index) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,0.14);' +
          'border-radius:6px;padding:5px 6px;margin-bottom:4px;';

        const idx = document.createElement('div');
        idx.style.cssText = 'opacity:0.5;font-size:10px;min-width:14px;';
        idx.textContent = String(index + 1);
        row.appendChild(idx);

        const def = getFunctionDef(step.functionId);
        const body = document.createElement('div');
        body.style.cssText = 'flex:1;min-width:0;';
        const label = document.createElement('div');
        label.style.cssText = 'font-weight:600;font-size:11px;';
        label.textContent = def?.label || step.functionId;
        body.appendChild(label);
        const summaryText = summarizeFunctionParameters(step.functionId, step.parameters);
        if (summaryText) {
          const summary = document.createElement('div');
          summary.style.cssText = 'opacity:0.7;font-size:10px;';
          summary.textContent = summaryText;
          body.appendChild(summary);
        }
        row.appendChild(body);

        row.appendChild(mkStepBtn('\u2191', 'Move up', index === 0, async () => {
          const updated = await moveUserMacroStep(macro.id, index, index - 1);
          if (updated) { Object.assign(macro, updated); this._renderMacroStepsEditorInto(host, macro); this._syncMacroInState(updated); }
        }));
        row.appendChild(mkStepBtn('\u2193', 'Move down', index === steps.length - 1, async () => {
          const updated = await moveUserMacroStep(macro.id, index, index + 1);
          if (updated) { Object.assign(macro, updated); this._renderMacroStepsEditorInto(host, macro); this._syncMacroInState(updated); }
        }));
        row.appendChild(mkStepBtn('\u00d7', 'Remove step', false, async () => {
          const updated = await removeUserMacroStep(macro.id, index);
          if (updated) { Object.assign(macro, updated); this._renderMacroStepsEditorInto(host, macro); this._syncMacroInState(updated); }
        }));

        wrap.appendChild(row);
      });
    }

    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:4px;';
    const select = document.createElement('select');
    select.className = 'kp-cfg-field';
    for (const def of listFunctionDefs()) {
      const opt = document.createElement('option');
      opt.value = def.id;
      opt.textContent = def.label;
      select.appendChild(opt);
    }
    addRow.appendChild(select);
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'kp-cfg-btn';
    addBtn.textContent = '+ Add step';
    addBtn.addEventListener('click', async () => {
      const updated = await addUserMacroStep(macro.id, { functionId: select.value });
      if (updated) { Object.assign(macro, updated); this._renderMacroStepsEditorInto(host, macro); this._syncMacroInState(updated); }
    }, true);
    addRow.appendChild(addBtn);
    wrap.appendChild(addRow);

    const actions = document.createElement('div');
    actions.className = 'kp-mk-editor-actions';

    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'kp-cfg-btn';
    runBtn.textContent = 'Run now';
    runBtn.title = 'Run this macro\u2019s steps immediately, for testing.';
    runBtn.addEventListener('click', async () => {
      try { await this._kp?._runMacroById?.(macro.id); } catch { /* ignore */ }
    }, true);
    actions.appendChild(runBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'kp-cfg-btn';
    deleteBtn.textContent = 'Delete macro';
    deleteBtn.addEventListener('click', async () => {
      try {
        await deleteUserMacro(macro.id);
        this._st.macros = (this._st.macros || []).filter((m) => m && m.id !== macro.id);
        this._closeMacroKeyEditor();
        this._renderRightList();
        this._notify('Macro deleted.', 'success');
      } catch {
        this._notify('Failed to delete macro.', 'error');
      }
    }, true);
    actions.appendChild(deleteBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kp-cfg-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this._closeMacroKeyEditor(), true);
    actions.appendChild(closeBtn);

    wrap.appendChild(actions);
    host.appendChild(wrap);
  }

  /**
   * @param {import('../modules/keyboard-layout-store.js').UserMacro} updated
   */
  _syncMacroInState(updated) {
    try {
      const idx = (this._st.macros || []).findIndex((m) => m && m.id === updated.id);
      if (idx >= 0) this._st.macros[idx] = updated;
    } catch { /* ignore */ }
    try { this._renderRightList(); } catch { /* ignore */ }
  }

  _renderLayoutSelect() {
    const layoutSelect = this._layoutSelect;
    const nameInput = this._nameInput;
    if (!layoutSelect) return;
    layoutSelect.innerHTML = '';
    const optBuilt = document.createElement('option');
    optBuilt.value = `builtin:${this._st.builtinLayoutId}`;
    optBuilt.textContent = `Built-in (${this._st.builtinLayoutId})`;
    layoutSelect.appendChild(optBuilt);

    for (const l of this._st.userLayouts || []) {
      if (!l || !l.id) continue;
      const opt = document.createElement('option');
      opt.value = `user:${l.id}`;
      opt.textContent = l.label ? String(l.label) : String(l.id);
      layoutSelect.appendChild(opt);
    }

    layoutSelect.value = this._st.mode === 'user' && this._st.userLayoutId
      ? `user:${this._st.userLayoutId}`
      : `builtin:${this._st.builtinLayoutId}`;

    const readOnly = this._isReadOnly();
    if (nameInput) {
      nameInput.disabled = readOnly;
      nameInput.value = this._st.mode === 'user' && this._st.userLayout
        ? String(this._st.userLayout.label || '')
        : 'Built-in layout';
    }

    // Toggle button availability via closest toolbar buttons
    try {
      const root = this.root;
      if (!root) return;
      const buttons = Array.from(root.querySelectorAll('.kp-cfg-btn'));
      for (const b of buttons) {
        const t = String(b.textContent || '');
        if (t === 'Duplicate') b.style.display = readOnly ? '' : 'none';
        if (t === 'Delete' || t === 'Export') b.disabled = readOnly || !this._st.userLayoutId;
        if (t === 'New Macro') { /* always enabled when tab visible */ }
      }
    } catch { /* ignore */ }
  }

  _buildBuiltinSlotMap() {
    const kb = this._kp?.keybindings || buildKeybindingsForLayout(this._st.builtinLayoutId);
    const map = {};
    for (const [actionId, binding] of Object.entries(kb || {})) {
      const label = String(binding?.displayKey || binding?.keyLabel || '').trim();
      if (!label || label.length !== 1) continue;
      map[label.toUpperCase()] = { type: 'function', id: String(actionId) };
    }
    return map;
  }

  _getEditableSlotMap() {
    if (this._st.mode === 'user' && this._st.userLayout && typeof this._st.userLayout.slots === 'object') {
      return this._st.userLayout.slots;
    }
    return this._buildBuiltinSlotMap();
  }

  /**
   * Split a key label into line elements (one word per line when multi-word).
   * @param {HTMLElement} mainEl
   * @param {string} label
   */
  _fillKeyLabelLines(mainEl, label) {
    if (!mainEl) return;
    mainEl.replaceChildren();
    const parts = String(label || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) {
      mainEl.textContent = '';
      return;
    }
    // Single token: keep as one line (CSS can soft-wrap long tokens).
    if (parts.length === 1) {
      const line = document.createElement('span');
      line.className = 'kp-cfg-label-line';
      line.textContent = parts[0];
      mainEl.appendChild(line);
      return;
    }
    for (const part of parts) {
      const line = document.createElement('span');
      line.className = 'kp-cfg-label-line';
      line.textContent = part;
      mainEl.appendChild(line);
    }
  }

  /**
   * Open the key-info inspector popover for a palette item.
   * @param {{ type: string, id: string }} item
   * @param {HTMLElement} anchorEl
   */
  _inspectItem(item, anchorEl) {
    if (!item || !item.id || !anchorEl) return;
    try { this._cancelPlaceMode(); } catch { /* ignore */ }

    if (item.type === 'macro') {
      const macro = (this._st.macros || []).find((m) => m && m.id === item.id) || null;
      if (macro) this._openMacroStepsEditor(macro);
      const stepCount = Array.isArray(macro?.steps) ? macro.steps.length : 0;
      const binding = {
        label: String(macro?.label || 'Macro'),
        description: stepCount > 0
          ? `Runs ${stepCount} step${stepCount === 1 ? '' : 's'} in order. Edit steps below.`
          : 'No steps yet — add some below.',
        displayKey: '',
        keyLabel: ''
      };
      inspectKeyActionFromAnchor(item.id, { anchorEl, binding });
      return;
    }

    if (item.type === 'function' && String(item.id).startsWith('action:')) {
      const mk = (this._st.macroKeys || []).find((m) => m && m.id === item.id) || null;
      if (mk) {
        // A configured Macro Key (hotkey/burst/…) — its `{ id, kind, label, config }` shape.
        this._openMacroKeyEditor(mk);
        const binding = {
          label: String(mk.label || 'Macro Key'),
          description: summarizeMacroKey(mk),
          displayKey: '',
          keyLabel: ''
        };
        inspectKeyActionFromAnchor(item.id, { anchorEl, binding });
        return;
      }
      // Any other Action Instance (e.g. a Type Characters instance) — generic parameter editor.
      const inst = (this._st.actions || []).find((a) => a && a.id === item.id) || null;
      const def = inst ? getFunctionDef(inst.functionId) : null;
      if (inst && def) this._openActionParamsEditor(def, inst);
      const binding = {
        label: String(def?.label || inst?.label || 'Action'),
        description: inst ? (summarizeFunctionParameters(inst.functionId, inst.parameters) || def?.description || '') : 'Configured Action Instance.',
        displayKey: '',
        keyLabel: ''
      };
      inspectKeyActionFromAnchor(item.id, { anchorEl, binding });
      return;
    }

    const kb = this._kp?.keybindings || buildKeybindingsForLayout(this._st.builtinLayoutId);
    const def = KEYBINDING_ACTION_DEFS?.[item.id];
    const binding = (kb && kb[item.id]) || (def ? {
      label: def.label,
      description: def.description || def.label,
      displayKey: '',
      keyLabel: ''
    } : null);
    if (!binding) {
      this._notify('No inspector details for this key.', 'error');
      return;
    }
    const ok = inspectKeyActionFromAnchor(item.id, {
      anchorEl,
      keybindings: kb,
      binding
    });
    if (!ok) this._notify('Failed to open key inspector.', 'error');
  }

  _renderRightList() {
    const list = this._listEl;
    if (!list) return;
    const q = String(this._searchInput?.value || '').trim().toLowerCase();
    list.innerHTML = '';
    const slots = this._getEditableSlotMap();
    const assignedInfoByItemKey = new Map();
    try {
      for (const [slot, v] of Object.entries(slots || {})) {
        if (!v || !v.type || !v.id) continue;
        const k = `${v.type}:${v.id}`;
        const prev = assignedInfoByItemKey.get(k) || { count: 0, first: '' };
        assignedInfoByItemKey.set(k, { count: prev.count + 1, first: prev.first || String(slot) });
      }
    } catch { /* ignore */ }

    const appendKeyItem = ({ type, id, label, keyboardClass, infoKey }) => {
      const item = document.createElement('div');
      item.className = 'kp-cfg-item';
      item.dataset.kpItemType = type;
      item.dataset.kpItemId = id;

      const keyEl = document.createElement('button');
      keyEl.type = 'button';
      keyEl.className = `key${keyboardClass ? ' ' + keyboardClass : ''}`;
      keyEl.draggable = true;
      keyEl.dataset.kpItemType = type;
      keyEl.dataset.kpItemId = id;
      if (type === 'function') {
        try { keyEl.setAttribute('data-kp-action-id', String(id)); } catch { /* ignore */ }
      }
      if (this._placeItem && this._placeItem.type === type && this._placeItem.id === id) {
        keyEl.classList.add('kp-place-source');
        item.classList.add('kp-place-source-item');
      }

      const main = document.createElement('div');
      main.className = 'key-main';
      this._fillKeyLabelLines(main, label);

      const info = assignedInfoByItemKey.get(infoKey) || null;
      if (info && info.count > 0) {
        const lab = document.createElement('div');
        lab.className = 'key-label';
        lab.textContent = info.count > 1 ? `×${info.count}` : String(info.first || '');
        keyEl.appendChild(main);
        keyEl.appendChild(lab);
      } else {
        keyEl.appendChild(main);
      }

      keyEl.addEventListener('dragstart', (e) => {
        try {
          e.dataTransfer?.setData?.(KP_LAYOUT_ITEM_MIME, JSON.stringify({ type, id }));
          e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignore */ }
      }, true);

      keyEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._beginPlaceMode({ type, id }, keyEl);
      }, true);

      const inspectBtn = document.createElement('button');
      inspectBtn.type = 'button';
      inspectBtn.className = 'kp-cfg-inspect';
      inspectBtn.textContent = 'Inspect';
      inspectBtn.title = `Inspect ${label}`;
      inspectBtn.setAttribute('aria-label', `Inspect ${label}`);
      inspectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._inspectItem({ type, id }, keyEl);
      }, true);
      inspectBtn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);

      item.appendChild(keyEl);
      item.appendChild(inspectBtn);
      return item;
    };

    // Macros, configured Macro Keys, and stock Functions are all placeable Function-Library
    // items now (see KEY_ACTION_ARCHITECTURE.md's "Config panel tabs" row) so they render as
    // sections of one unified, always-visible list rather than separate tabs.

    const macros = Array.isArray(this._st.macros) ? this._st.macros : [];
    const macroItems = q ? macros.filter((m) => String(m?.label || '').toLowerCase().includes(q)) : macros;
    if (macroItems.length || !q) {
      const section = document.createElement('div');
      section.className = 'kp-cfg-category';
      const title = document.createElement('div');
      title.className = 'kp-cfg-category-title';
      title.textContent = 'Macros';
      section.appendChild(title);
      if (macroItems.length) {
        const grid = document.createElement('div');
        grid.className = 'kp-cfg-key-grid';
        for (const m of macroItems) {
          if (!m || !m.id) continue;
          const itemEl = appendKeyItem({
            type: 'macro',
            id: m.id,
            label: String(m.label || 'Macro'),
            keyboardClass: 'key-purple',
            infoKey: `macro:${m.id}`
          });
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'kp-cfg-inspect';
          edit.textContent = 'Edit steps';
          edit.title = `Edit steps for ${m.label || 'Macro'}`;
          edit.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._openMacroStepsEditor(m);
          }, true);
          edit.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
          try {
            const oldInspect = itemEl.querySelector('.kp-cfg-inspect');
            if (oldInspect) oldInspect.replaceWith(edit);
            else itemEl.appendChild(edit);
          } catch {
            itemEl.appendChild(edit);
          }
          grid.appendChild(itemEl);
        }
        section.appendChild(grid);
      } else {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:11px;opacity:0.7;padding:4px 2px;';
        empty.textContent = 'Click "New Macro" above to create one.';
        section.appendChild(empty);
      }
      list.appendChild(section);
    }

    const macroKeys = Array.isArray(this._st.macroKeys) ? this._st.macroKeys : [];
    const macroKeyItems = q
      ? macroKeys.filter((m) => {
        const hay = `${m?.label || ''} ${m?.kind || ''} ${summarizeMacroKey(m)}`.toLowerCase();
        return hay.includes(q);
      })
      : macroKeys;
    if (macroKeyItems.length || !q) {
      const section = document.createElement('div');
      section.className = 'kp-cfg-category';
      const title = document.createElement('div');
      title.className = 'kp-cfg-category-title';
      title.textContent = 'Configured Macro Keys';
      section.appendChild(title);
      if (macroKeyItems.length) {
        const grid = document.createElement('div');
        grid.className = 'kp-cfg-key-grid';
        for (const m of macroKeyItems) {
          if (!m || !m.id) continue;
          const itemEl = appendKeyItem({
            // Macro Keys are Action Instances of a `legacyMacroKeyKind` Function (see
            // function-library.js) — placing one on a slot writes the same `type: 'function'`
            // SlotAssignment shape as any other Function/Action Instance.
            type: 'function',
            id: m.id,
            label: String(m.label || m.kind || 'Macro Key'),
            keyboardClass: macroKeyKeyboardClass(m.kind),
            infoKey: `function:${m.id}`
          });
          // Double-duty: Inspect opens editor; also expose Configure via label badge.
          const conf = document.createElement('button');
          conf.type = 'button';
          conf.className = 'kp-cfg-inspect';
          conf.textContent = 'Edit';
          conf.title = `Configure ${m.label || m.kind}`;
          conf.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._openMacroKeyEditor(m);
          }, true);
          conf.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
          // Replace default Inspect with Edit for macro keys (still place via keycap click).
          try {
            const oldInspect = itemEl.querySelector('.kp-cfg-inspect');
            if (oldInspect) oldInspect.replaceWith(conf);
            else itemEl.appendChild(conf);
          } catch {
            itemEl.appendChild(conf);
          }
          grid.appendChild(itemEl);
        }
        section.appendChild(grid);
      } else {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:11px;opacity:0.7;padding:4px 2px;';
        empty.textContent = 'Create a kind above, configure it, then click to place on the Keyboard Reference.';
        section.appendChild(empty);
      }
      list.appendChild(section);
    }

    // Every Function in the unified Function Library (function-library.js) is browsable and
    // placeable here — built-ins, keystroke primitives (surfaced above as "Configured Macro
    // Keys" instead, so they're excluded below), Type Characters, and the Data/Lookup/
    // Translate/Display/Media Library Functions all render as sections of this same list. This
    // is what used to require a second, additive `function-library-panel.js` window.
    const allDefs = listFunctionDefs().filter((d) => d && !d.legacyMacroKeyKind);
    const filteredDefs = q
      ? allDefs.filter((d) => (
        `${d.id} ${d.label} ${d.description || ''} ${getFunctionCategory(d.id)}`
      ).toLowerCase().includes(q))
      : allDefs;

    /** @type {Map<string, typeof filteredDefs>} */
    const byCat = new Map();
    for (const d of filteredDefs) {
      const cat = getFunctionCategory(d.id) || 'Other';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(d);
    }

    const order = Array.isArray(FUNCTION_CATEGORY_ORDER) ? FUNCTION_CATEGORY_ORDER : [];
    const cats = [
      ...order.filter((c) => byCat.has(c)),
      ...[...byCat.keys()].filter((c) => !order.includes(c)).sort()
    ];

    for (const cat of cats) {
      const items = byCat.get(cat) || [];
      if (!items.length) continue;
      const section = document.createElement('div');
      section.className = 'kp-cfg-category';
      const title = document.createElement('div');
      title.className = 'kp-cfg-category-title';
      title.textContent = cat;
      section.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'kp-cfg-key-grid';

      for (const def of items) {
        // The two Functions still bound to a fixed physical key (SEND_TEXT_TO_AI,
        // RECTANGLE_HIGHLIGHT) keep their existing single-item + "Config" popover path rather
        // than the per-instance treatment below — see FIXED_KEY_FUNCTION_IDS.
        const isFixedKey = FIXED_KEY_FUNCTION_IDS.includes(def.id);

        if (!isFixedKey && isFunctionInstantiable(def.id)) {
          const instances = (this._st.actions || []).filter((a) => a && a.functionId === def.id);
          instances.forEach((inst, index) => {
            const itemEl = appendKeyItem({
              type: 'function',
              id: inst.id,
              label: instances.length > 1 ? `${def.label} #${index + 1}` : def.label,
              keyboardClass: def.keyboardClass || '',
              infoKey: `function:${inst.id}`
            });
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'kp-cfg-inspect';
            edit.textContent = 'Edit';
            edit.title = `Configure ${def.label}`;
            edit.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this._openActionParamsEditor(def, inst);
            }, true);
            edit.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
            try {
              const oldInspect = itemEl.querySelector('.kp-cfg-inspect');
              if (oldInspect) oldInspect.replaceWith(edit);
              else itemEl.appendChild(edit);
            } catch {
              itemEl.appendChild(edit);
            }
            if (def.worksWhileTyping) {
              itemEl.style.flexWrap = 'wrap';
              itemEl.appendChild(this._renderBindChordButton({ type: 'function', id: inst.id }, def));
            }
            grid.appendChild(itemEl);
          });

          const addBtn = document.createElement('button');
          addBtn.type = 'button';
          addBtn.className = 'kp-cfg-btn';
          addBtn.style.cssText = 'align-self:flex-start;';
          addBtn.textContent = `+ New ${def.label}`;
          addBtn.title = def.description || '';
          addBtn.addEventListener('click', async () => {
            try {
              const created = await createUserAction({ functionId: def.id });
              if (created) {
                await this._reloadActions();
                this._renderRightList();
                this._openActionParamsEditor(def, created);
              }
            } catch {
              this._notify('Failed to create instance.', 'error');
            }
          }, true);
          grid.appendChild(addBtn);
          continue;
        }

        const itemEl = appendKeyItem({
          type: 'function',
          id: def.id,
          label: def.label,
          keyboardClass: def.keyboardClass || '',
          infoKey: `function:${def.id}`
        });

        if (isFixedKey && actionHasParameters(def.id)) {
          const conf = document.createElement('button');
          conf.type = 'button';
          conf.className = 'kp-cfg-inspect';
          conf.textContent = 'Config';
          conf.title = `Configure ${def.label}`;
          conf.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { this._cancelPlaceMode(); } catch { /* ignore */ }
            try {
              // setActionParameter() (called by the panel's own controls) already notifies live
              // KeyPilot instances via a DOM event — no onSettingsChanged hook needed here.
              const panel = getSharedKeyActionConfigPanel();
              await panel.open(def.id, {
                title: def.label,
                anchorRect: itemEl.getBoundingClientRect()
              });
            } catch { /* ignore */ }
          }, true);
          conf.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
          try {
            const oldInspect = itemEl.querySelector('.kp-cfg-inspect');
            if (oldInspect) oldInspect.insertAdjacentElement('afterend', conf);
            else itemEl.appendChild(conf);
          } catch {
            itemEl.appendChild(conf);
          }
        }

        if (def.worksWhileTyping) {
          itemEl.style.flexWrap = 'wrap';
          itemEl.appendChild(this._renderBindChordButton({ type: 'function', id: def.id }, def));
        }

        grid.appendChild(itemEl);
      }
      section.appendChild(grid);
      list.appendChild(section);
    }
  }

  /**
   * A "Needs modifier" badge + "Bind chord…" button, appended to a placeable item for any
   * `worksWhileTyping` Function/instance — see {@link _captureAndAssignChord}.
   * @param {{ type: string, id: string }} item
   * @param {import('../config/function-library.js').FunctionDef} def
   */
  _renderBindChordButton(item, def) {
    const row = document.createElement('div');
    row.className = 'kp-cfg-btn-row';
    // The `.kp-cfg-item` grid cell is a single-row flexbox (key + Inspect/Edit/Config); wrap
    // this badge+button row onto its own full-width line below that pair instead of squeezing
    // in beside them.
    row.style.flexBasis = '100%';

    const badge = document.createElement('span');
    badge.className = 'kp-cfg-badge';
    badge.textContent = 'Needs modifier';
    badge.title = 'Must be bound to a modifier-key combination so it can run while a text field is focused.';
    row.appendChild(badge);

    const bindBtn = document.createElement('button');
    bindBtn.type = 'button';
    bindBtn.className = 'kp-cfg-btn';
    bindBtn.style.padding = '3px 6px';
    bindBtn.textContent = 'Bind chord…';
    bindBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._captureAndAssignChord(item, def.id, bindBtn);
    }, true);
    bindBtn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    row.appendChild(bindBtn);

    return row;
  }

  _familyBaseLabel() {
    try {
      const familyId = normalizeKeyboardLayoutFamilyId(
        this._kp?._settings?.keyboardLayoutFamilyId || 'browsing'
      );
      const meta = (BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META || []).find((m) => m && m.id === familyId);
      return String(meta?.label || familyId || 'Layout');
    } catch {
      return 'Layout';
    }
  }

  /**
   * @param {{ type: string, id: string }} item
   * @param {HTMLElement} sourceEl
   */
  _beginPlaceMode(item, sourceEl) {
    if (!item || !item.type || !item.id) return;
    // Toggle off if clicking the same item again.
    if (this._placeItem && this._placeItem.type === item.type && this._placeItem.id === item.id) {
      this._cancelPlaceMode();
      return;
    }
    this._cancelPlaceMode();
    this._placeItem = { type: String(item.type), id: String(item.id) };
    this._placeSourceEl = sourceEl || null;
    this._ensurePlaceArrow();
    this._bindPlacePointer();
    this._renderRightList();

    try {
      this._kp?.floatingKeyboardHelp?.setPlaceTargeting?.({
        item: this._placeItem,
        onPlace: (slot) => { void this._placeOnSlot(slot); }
      });
    } catch { /* ignore */ }

    // Seed arrow toward current pointer if available
    try {
      const r = sourceEl?.getBoundingClientRect?.();
      if (r) this._updatePlaceArrow(r.left + r.width / 2, r.top + r.height / 2, r.left + r.width / 2 + 40, r.top + r.height / 2);
    } catch { /* ignore */ }
  }

  isPlaceModeActive() {
    return !!(this._placeItem && this._placeItem.type && this._placeItem.id);
  }

  /** Public alias for Escape / outside-click cancel. */
  cancelPlaceMode() {
    this._cancelPlaceMode();
  }

  _cancelPlaceMode() {
    if (!this._placeItem && !this._placeArrowEl && !this._placePointerBound) return;
    this._placeItem = null;
    this._placeSourceEl = null;
    this._unbindPlacePointer();
    this._teardownPlaceArrow();
    try { this._kp?.floatingKeyboardHelp?.clearPlaceTargeting?.(); } catch { /* ignore */ }
    try { this._renderRightList(); } catch { /* ignore */ }
  }

  _bindPlacePointer() {
    if (this._placePointerBound) return;
    try {
      document.addEventListener('pointermove', this._onPlacePointerMove, true);
      document.addEventListener('pointerdown', this._onPlacePointerDown, true);
      document.addEventListener('keydown', this._onPlaceKeyDown, true);
      this._placePointerBound = true;
    } catch { /* ignore */ }
  }

  _unbindPlacePointer() {
    if (!this._placePointerBound) return;
    try { document.removeEventListener('pointermove', this._onPlacePointerMove, true); } catch { /* ignore */ }
    try { document.removeEventListener('pointerdown', this._onPlacePointerDown, true); } catch { /* ignore */ }
    try { document.removeEventListener('keydown', this._onPlaceKeyDown, true); } catch { /* ignore */ }
    this._placePointerBound = false;
  }

  _onPlacePointerMove(e) {
    if (!this._placeItem) return;
    try {
      let source = this._placeSourceEl;
      if (!source || !source.isConnected) {
        source = this._listEl?.querySelector?.(
          `.key[data-kp-item-type="${this._placeItem.type}"][data-kp-item-id="${CSS.escape?.(this._placeItem.id) || this._placeItem.id}"]`
        ) || null;
        this._placeSourceEl = source;
      }
      if (!source) return;
      const r = source.getBoundingClientRect();
      const x0 = r.left + r.width / 2;
      const y0 = r.top + r.height / 2;
      this._updatePlaceArrow(x0, y0, e.clientX, e.clientY);
    } catch { /* ignore */ }
  }

  /**
   * Cancel place mode on any click that is not a Keyboard Reference slot
   * (or a Config palette key, so users can switch/toggle the source).
   * @param {PointerEvent} e
   */
  _onPlacePointerDown(e) {
    if (!this._placeItem) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    try {
      const el = e.target instanceof Element
        ? e.target
        : (e.target && e.target.parentElement) || null;
      if (!el) {
        this._cancelPlaceMode();
        return;
      }
      // Placing onto a Keyboard Reference slot — leave for the slot click handler.
      const slot = el.closest?.('[data-kp-slot]');
      if (slot && slot.closest?.('.kp-floating-keyboard-help')) return;
      // Switching/toggling from a Config palette key — leave for that click handler.
      if (el.closest?.('.kp-layout-config-panel [data-kp-item-type][data-kp-item-id]')) return;

      e.preventDefault();
      e.stopPropagation();
      try { e.stopImmediatePropagation(); } catch { /* ignore */ }
      this._cancelPlaceMode();
    } catch {
      this._cancelPlaceMode();
    }
  }

  _onPlaceKeyDown(e) {
    if (!this._placeItem) return;
    const isEsc = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape';
    if (!isEsc) return;
    e.preventDefault();
    e.stopPropagation();
    try { e.stopImmediatePropagation(); } catch { /* ignore */ }
    this._cancelPlaceMode();
  }

  _ensurePlaceArrow() {
    const doc = document;
    if (this._placeArrowEl && this._placeArrowEl.isConnected) return;
    const el = doc.createElement('div');
    el.className = 'kp-layout-place-arrow';
    el.setAttribute('data-kp-layout-place-arrow', 'true');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <marker id="kp-place-arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="rgba(91,226,241,0.95)" />
    </marker>
  </defs>
  <line x1="0" y1="0" x2="0" y2="0" stroke="rgba(91,226,241,0.9)" stroke-width="2.5"
    marker-end="url(#kp-place-arrowhead)" stroke-linecap="round" />
</svg>`.trim();

    // Prefer Popover API top layer when available.
    try {
      if (typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype) {
        el.popover = 'manual';
      }
    } catch { /* ignore */ }

    (doc.body || doc.documentElement).appendChild(el);
    this._placeArrowEl = el;
    try {
      if (typeof el.showPopover === 'function') el.showPopover();
    } catch { /* ignore */ }
  }

  _teardownPlaceArrow() {
    const el = this._placeArrowEl;
    this._placeArrowEl = null;
    if (!el) return;
    try {
      if (typeof el.hidePopover === 'function' && el.matches?.(':popover-open')) el.hidePopover();
    } catch { /* ignore */ }
    try { el.remove(); } catch { /* ignore */ }
  }

  _updatePlaceArrow(x0, y0, x1, y1) {
    const el = this._placeArrowEl;
    if (!el) return;
    const line = el.querySelector('line');
    if (!line) return;
    try {
      line.setAttribute('x1', String(x0));
      line.setAttribute('y1', String(y0));
      line.setAttribute('x2', String(x1));
      line.setAttribute('y2', String(y1));
    } catch { /* ignore */ }
  }

  /**
   * Ensure a user layout is active (auto-dup from built-in if needed), then assign.
   * @param {string} slotLabel
   */
  async _placeOnSlot(slotLabel) {
    const slot = String(slotLabel || '').trim().toUpperCase();
    if (this._placeItem && slot) {
      await this._assignSlotKey(slot, this._placeItem);
    }
    this._cancelPlaceMode();
  }

  /**
   * Ensure a user layout is active (auto-dup from built-in if needed), then assign `item` to
   * `slotKey` — a bare key label ("Q") or a modifier-chord slot key ("CHORD:CTRL+ALT+Q", see
   * utils/key-chord.js). Goes through {@link setUserKeyboardLayoutSlot} so the
   * `worksWhileTyping` chord-vs-bare-key rule is enforced here exactly like everywhere else that
   * writes a slot, instead of mutating `layout.slots` directly.
   * @param {string} slotKey
   * @param {{ type: string, id: string }} item
   */
  async _assignSlotKey(slotKey, item) {
    const slot = String(slotKey || '').trim();
    if (!item || !item.type || !item.id || !slot) return;

    try {
      let becameCurrent = false;
      // Auto-duplicate built-in on first place.
      if (this._st.mode !== 'user' || !this._st.userLayout) {
        const base = this._familyBaseLabel();
        const layouts = await listUserKeyboardLayouts();
        const label = nextUserCopyLayoutLabel(base, layouts);
        const created = await duplicateBuiltinLayoutToUserLayout({
          builtinLayoutId: this._st.builtinLayoutId,
          label
        });
        this._st.userLayouts = await listUserKeyboardLayouts();
        this._st.mode = 'user';
        this._st.userLayoutId = created.id;
        this._st.userLayout = created;
        this._renderLayoutSelect();
        becameCurrent = true;
      }

      if (!this._st.userLayout || !this._st.userLayout.id) return;
      const result = await setUserKeyboardLayoutSlot(this._st.userLayout.id, slot, { type: item.type, id: item.id });
      if (!result.ok) {
        this._notify(result.reason || 'Could not bind key.', 'error');
        return;
      }
      this._st.userLayout = result.layout;
      this.syncUserLayout(this._st.userLayout);
      this._emitChange();

      try {
        await this._kp?.applyLiveUserLayout?.(this._st.userLayout, {
          setAsCurrent: becameCurrent || String(this._kp?._currentKeyboardLayoutId || '') === `user:${this._st.userLayout.id}`,
          macros: this._st.macros,
          actions: this._st.actions
        });
      } catch { /* ignore */ }
    } catch {
      this._notify('Failed to bind key.', 'error');
    }
  }

  _stopChordCapture() {
    if (this._chordCaptureCleanup) {
      try { this._chordCaptureCleanup(); } catch { /* ignore */ }
      this._chordCaptureCleanup = null;
    }
    try {
      for (const btn of this.root?.querySelectorAll?.('[data-capturing="true"]') || []) {
        delete btn.dataset.capturing;
        if (btn.dataset.kpBindLabel) btn.textContent = btn.dataset.kpBindLabel;
      }
    } catch { /* ignore */ }
  }

  /**
   * Listen for the next keydown and, if it has a modifier held, bind `item` to the resulting
   * chord slot key — the only way a `worksWhileTyping` Function (e.g. Type Characters,
   * Clipboard Copy/Cut/Paste) can be bound, since the Keyboard Reference's click-to-place flow
   * only ever targets bare physical keys. See utils/key-chord.js.
   * @param {{ type: string, id: string }} item
   * @param {string} functionId Used only for the `validateFunctionSlotKey` check.
   * @param {HTMLButtonElement} btn
   */
  _captureAndAssignChord(item, functionId, btn) {
    if (!item || !btn) return;
    this._cancelPlaceMode();
    this._stopChordCapture();
    btn.dataset.kpBindLabel = btn.textContent;
    btn.dataset.capturing = 'true';
    btn.textContent = 'Press keys… (Esc)';

    const onKeyDown = async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try { ev.stopImmediatePropagation(); } catch { /* ignore */ }
      this._stopChordCapture();

      if (ev.key === 'Escape') return;
      const hasMods = !!(ev.ctrlKey || ev.altKey || ev.shiftKey || ev.metaKey);
      if (!hasMods) {
        this._notify('Hold a modifier key (Ctrl/Alt/Shift) while pressing the key.', 'error');
        return;
      }
      const slotKey = buildChordSlotKey({
        key: ev.key,
        ctrl: ev.ctrlKey,
        alt: ev.altKey,
        shift: ev.shiftKey,
        meta: ev.metaKey
      });
      if (!slotKey) return;
      const check = validateFunctionSlotKey(functionId, slotKey);
      if (!check.ok) {
        this._notify(check.reason, 'error');
        return;
      }
      await this._assignSlotKey(slotKey, item);
      this._notify(`Bound to ${formatChordSlotKeyLabel(slotKey)}.`, 'success');
    };

    document.addEventListener('keydown', onKeyDown, { capture: true, once: true });
    this._chordCaptureCleanup = () => {
      try { document.removeEventListener('keydown', onKeyDown, { capture: true }); } catch { /* ignore */ }
    };
  }
}
