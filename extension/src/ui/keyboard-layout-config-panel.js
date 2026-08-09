/**
 * Keyboard Layout Config — floating palette + layout CRUD.
 *
 * No keyboard chrome here: editing happens on the Keyboard Reference panel
 * while it is in edit mode. Click a function/macro, then click a Reference slot
 * to place it (SVG arrow follows the cursor). Built-in layouts auto-duplicate
 * on first place as "{Family} N (user)".
 */

import { Z_INDEX } from '../config/constants.js';
import {
  buildKeybindingsForLayout,
  BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  getKeybindingActionCategory,
  KEYBINDING_ACTION_CATEGORY_ORDER,
  KEYBINDING_ACTION_DEFS,
  nextUserCopyLayoutLabel,
  normalizeKeyboardLayoutFamilyId
} from '../config/keyboard-layouts.js';
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../modules/settings-manager.js';
import {
  createUserAction,
  createUserMacro,
  createEmptyUserKeyboardLayout,
  deleteUserAction,
  deleteUserKeyboardLayout,
  duplicateBuiltinLayoutToUserLayout,
  exportUserKeyboardLayout,
  importUserKeyboardLayout,
  listUserActions,
  listUserKeyboardLayouts,
  listUserMacros,
  upsertUserAction,
  upsertUserKeyboardLayout
} from '../modules/keyboard-layout-store.js';
import { MACRO_KEY_KIND_DEFS, macroKeyKeyboardClass, summarizeMacroKey } from '../config/macro-keys.js';
import { FUNCTION_ID_BY_MACRO_KEY_KIND, macroKeyKindFromFunctionId } from '../config/function-library.js';
import { KEYBINDINGS_UI_ROOT_CLASS, KEYBINDINGS_UI_STYLE_ATTR, getKeybindingsUiCss } from './keybindings-ui-shared.js';
import { inspectKeyActionFromAnchor } from './keybindings-ui.js';
import { actionHasParameters, getSharedKeyActionConfigPanel } from './key-action-settings.js';
import { createMacroKeyEditor } from './macro-key-editor.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
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
 *   // `actions` filtered + adapted to `{ id, kind, label, config }` for the "Macro Keys" tab —
 *   // see `macroKeyLikeFromUserAction()`. Every entry here is also present in `actions`.
 *   macroKeys: any[],
 *   tab: 'functions'|'macros'|'macroKeys'
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
    this._functionsTab = null;
    this._macrosTab = null;
    this._macroKeysTab = null;
    this._dragDispose = null;
    this._positionHydrated = false;
    /** @type {any|null} draft while editing a macro key */
    this._macroKeyDraft = null;
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
      macroKeys: [],
      tab: 'functions'
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
    this._setVisible(false);
  }

  cleanup() {
    this._cancelPlaceMode();
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
.kp-layout-config-panel .kp-cfg-tab[aria-selected="true"] {
  background: rgba(255,255,255,0.12);
  opacity: 1;
}
.kp-layout-config-panel .kp-cfg-tab[aria-selected="false"] {
  opacity: 0.65;
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
    hint.textContent = 'Configure Macro Keys, or click a function/macro/macro-key, then click a Keyboard Reference key to place it.';
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

    // Tabs
    const tabs = doc.createElement('div');
    Object.assign(tabs.style, { display: 'flex', gap: '6px' });
    const functionsTab = mkBtn('Functions');
    functionsTab.classList.add('kp-cfg-tab');
    functionsTab.setAttribute('aria-selected', 'true');
    const macrosTab = mkBtn('Macros');
    macrosTab.classList.add('kp-cfg-tab');
    macrosTab.setAttribute('aria-selected', 'false');
    const macroKeysTab = mkBtn('Macro Keys');
    macroKeysTab.classList.add('kp-cfg-tab');
    macroKeysTab.setAttribute('aria-selected', 'false');
    functionsTab.style.flex = '1';
    macrosTab.style.flex = '1';
    macroKeysTab.style.flex = '1';
    tabs.appendChild(functionsTab);
    tabs.appendChild(macrosTab);
    tabs.appendChild(macroKeysTab);

    const search = doc.createElement('input');
    search.type = 'search';
    search.className = 'kp-cfg-field';
    search.placeholder = 'Search…';

    const macrosActionsRow = doc.createElement('div');
    Object.assign(macrosActionsRow.style, { display: 'none', gap: '6px' });
    const newMacroBtn = mkBtn('New Macro');
    macrosActionsRow.appendChild(newMacroBtn);

    const macroKeysActionsRow = doc.createElement('div');
    Object.assign(macroKeysActionsRow.style, { display: 'none', flexDirection: 'column', gap: '6px' });

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
    body.appendChild(tabs);
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
    this._functionsTab = functionsTab;
    this._macrosTab = macrosTab;
    this._macroKeysTab = macroKeysTab;

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
    functionsTab.addEventListener('click', () => this._setActiveTab('functions'), true);
    macrosTab.addEventListener('click', () => this._setActiveTab('macros'), true);
    macroKeysTab.addEventListener('click', () => this._setActiveTab('macroKeys'), true);
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
        await createUserMacro({ label: 'New Macro' });
        this._st.macros = await listUserMacros();
        this._renderRightList();
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
    this._setActiveTab(this._st.tab || 'functions');
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

  _setActiveTab(tab) {
    const next = tab === 'macros' ? 'macros' : (tab === 'macroKeys' ? 'macroKeys' : 'functions');
    this._st.tab = next;
    try {
      this._functionsTab?.setAttribute('aria-selected', next === 'functions' ? 'true' : 'false');
      this._macrosTab?.setAttribute('aria-selected', next === 'macros' ? 'true' : 'false');
      this._macroKeysTab?.setAttribute('aria-selected', next === 'macroKeys' ? 'true' : 'false');
      if (this._macrosActionsRow) {
        this._macrosActionsRow.style.display = next === 'macros' ? 'flex' : 'none';
      }
      if (this._macroKeysActionsRow) {
        this._macroKeysActionsRow.style.display = next === 'macroKeys' ? 'flex' : 'none';
      }
      if (next !== 'macroKeys') this._closeMacroKeyEditor();
      else this._renderMacroKeyKindButtons();
    } catch { /* ignore */ }
    this._renderRightList();
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
      const stepCount = Array.isArray(macro?.steps) ? macro.steps.length : 0;
      const binding = {
        label: String(macro?.label || 'Macro'),
        description: stepCount > 0
          ? `Runs ${stepCount} step${stepCount === 1 ? '' : 's'} in order. Edit steps from the Function Library panel (Alt+C).`
          : 'No steps yet — add some from the Function Library panel (Alt+C).',
        displayKey: '',
        keyLabel: ''
      };
      inspectKeyActionFromAnchor(item.id, { anchorEl, binding });
      return;
    }

    if (item.type === 'function' && String(item.id).startsWith('action:')) {
      // A configured Action Instance — Macro Keys (hotkey/burst/…) are the only kind this
      // palette currently instantiates, so this is a macro-key-shaped inspect/edit.
      const mk = (this._st.macroKeys || []).find((m) => m && m.id === item.id) || null;
      if (mk) {
        this._setActiveTab('macroKeys');
        this._openMacroKeyEditor(mk);
      }
      const binding = {
        label: String(mk?.label || 'Macro Key'),
        description: mk ? summarizeMacroKey(mk) : 'Configured built-in macro key.',
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

    if (this._st.tab === 'macros') {
      const macros = Array.isArray(this._st.macros) ? this._st.macros : [];
      const items = q ? macros.filter((m) => String(m?.label || '').toLowerCase().includes(q)) : macros;
      const section = document.createElement('div');
      section.className = 'kp-cfg-category';
      const title = document.createElement('div');
      title.className = 'kp-cfg-category-title';
      title.textContent = 'Macros';
      section.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'kp-cfg-key-grid';
      for (const m of items) {
        if (!m || !m.id) continue;
        grid.appendChild(appendKeyItem({
          type: 'macro',
          id: m.id,
          label: String(m.label || 'Macro'),
          keyboardClass: 'key-purple',
          infoKey: `macro:${m.id}`
        }));
      }
      section.appendChild(grid);
      list.appendChild(section);
      return;
    }

    if (this._st.tab === 'macroKeys') {
      const keys = Array.isArray(this._st.macroKeys) ? this._st.macroKeys : [];
      const items = q
        ? keys.filter((m) => {
          const hay = `${m?.label || ''} ${m?.kind || ''} ${summarizeMacroKey(m)}`.toLowerCase();
          return hay.includes(q);
        })
        : keys;
      const section = document.createElement('div');
      section.className = 'kp-cfg-category';
      const title = document.createElement('div');
      title.className = 'kp-cfg-category-title';
      title.textContent = 'Configured Macro Keys';
      section.appendChild(title);
      if (!items.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:11px;opacity:0.7;padding:4px 2px;';
        empty.textContent = 'Create a kind above, configure it, then click to place on the Keyboard Reference.';
        section.appendChild(empty);
        list.appendChild(section);
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'kp-cfg-key-grid';
      for (const m of items) {
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
      list.appendChild(section);
      return;
    }

    const all = Object.entries(KEYBINDING_ACTION_DEFS || {}).map(([actionId, def]) => ({
      actionId: String(actionId),
      label: String(def?.label || actionId),
      description: String(def?.description || ''),
      category: getKeybindingActionCategory(actionId),
      keyboardClass: def?.keyboardClass || ''
    }));
    const filtered = q
      ? all.filter((a) => (a.actionId + ' ' + a.label + ' ' + a.description + ' ' + a.category).toLowerCase().includes(q))
      : all;

    /** @type {Map<string, typeof filtered>} */
    const byCat = new Map();
    for (const a of filtered) {
      const cat = a.category || 'Other';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(a);
    }

    const order = Array.isArray(KEYBINDING_ACTION_CATEGORY_ORDER) ? KEYBINDING_ACTION_CATEGORY_ORDER : [];
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
      for (const a of items) {
        const itemEl = appendKeyItem({
          type: 'function',
          id: a.actionId,
          label: a.label,
          keyboardClass: a.keyboardClass,
          infoKey: `function:${a.actionId}`
        });
        if (actionHasParameters(a.actionId)) {
          const conf = document.createElement('button');
          conf.type = 'button';
          conf.className = 'kp-cfg-inspect';
          conf.textContent = 'Config';
          conf.title = `Configure ${a.label}`;
          conf.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { this._cancelPlaceMode(); } catch { /* ignore */ }
            try {
              // setActionParameter() (called by the panel's own controls) already notifies live
              // KeyPilot instances via a DOM event — no onSettingsChanged hook needed here.
              const panel = getSharedKeyActionConfigPanel();
              await panel.open(a.actionId, {
                title: a.label,
                anchorRect: itemEl.getBoundingClientRect()
              });
            } catch { /* ignore */ }
          }, true);
          conf.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
          try {
            const oldInspect = itemEl.querySelector('.kp-cfg-inspect');
            if (oldInspect) {
              // Keep Inspect; add Config beside it.
              oldInspect.insertAdjacentElement('afterend', conf);
            } else {
              itemEl.appendChild(conf);
            }
          } catch {
            itemEl.appendChild(conf);
          }
        }
        grid.appendChild(itemEl);
      }
      section.appendChild(grid);
      list.appendChild(section);
    }
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
    const item = this._placeItem;
    const slot = String(slotLabel || '').trim().toUpperCase();
    if (!item || !slot) return;

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

      if (!this._st.userLayout || typeof this._st.userLayout.slots !== 'object') return;
      this._st.userLayout.slots[slot] = { type: item.type, id: item.id };
      // Persist the slot first, then mark current — avoids racing an empty layout into KeyPilot.
      this._st.userLayout = await upsertUserKeyboardLayout(this._st.userLayout);
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
      this._notify('Failed to place on key.', 'error');
    } finally {
      this._cancelPlaceMode();
    }
  }
}
