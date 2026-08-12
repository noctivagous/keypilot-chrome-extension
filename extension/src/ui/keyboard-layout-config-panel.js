/**
 * Keyboard Layout Config — floating palette + layout CRUD.
 *
 * No keyboard chrome here: editing happens on the Keyboard Reference panel
 * while it is in edit mode. Click a function/macro, then click a Reference slot
 * to place it (SVG arrow follows the cursor). Built-in layouts auto-duplicate
 * on first place (and when entering edit on a built-in) as "{Family} Copy N".
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
  builtinFamilySelectValue,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  formatBuiltinFamilyLabel,
  inferFamilyAndHandednessFromLayoutId,
  KEYBINDING_ACTION_DEFS,
  listLayoutPickerGroups,
  nextUserCopyLayoutLabel,
  normalizeKeyboardLayoutFamilyId,
  parseBuiltinFamilySelectValue,
  resolveKeyboardLayoutId
} from '../config/keyboard-layouts.js';
import { DEFAULT_SETTINGS, getSettings, setSettings } from '../modules/settings-manager.js';
import {
  createUserAction,
  createUserMacro,
  createEmptyUserKeyboardLayout,
  deleteUserAction,
  deleteUserKeyboardLayout,
  deleteUserMacro,
  duplicateBuiltinLayoutToUserLayout,
  duplicateUserKeyboardLayout,
  exportUserKeyboardLayout,
  forkStockMacroToUser,
  importUserKeyboardLayout,
  listUserActions,
  listUserKeyboardLayouts,
  listUserMacros,
  normalizeMacroStep,
  setUserKeyboardLayoutSlot,
  upsertUserAction,
  upsertUserKeyboardLayout,
  upsertUserMacro
} from '../modules/keyboard-layout-store.js';
import { getStockMacroById, isStockMacroId, listStockMacros } from '../config/stock-macros.js';
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
  sortFunctionDefsForLibrary,
  summarizeFunctionParameters,
  validateFunctionSlotKey
} from '../config/function-library.js';
import {
  KEYBINDINGS_UI_ROOT_CLASS,
  KEYBINDINGS_UI_STYLE_ATTR,
  ensureKeyBackgroundIcon,
  getKeybindingsUiCss
} from './keybindings-ui-shared.js';
import { actionHasParameters, getSharedKeyActionConfigPanel } from './key-action-settings.js';
import { createMacroKeyEditor } from './macro-key-editor.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import {
  closestComposed,
  containsComposed,
  ensureOpenChromeShadow,
  getComposedEventElement,
  injectChromeStyles
} from './kp-chrome-shadow.js';
import {
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_LIT_BORDER,
  NCT_DARK_UI_BTN_LIT_GRADIENT,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_ICON_BUTTON_OUTLINE,
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_FIELD_BACKGROUND,
  NCT_DARK_UI_FIELD_BORDER,
  NCT_DARK_UI_FIELD_BOX_SHADOW,
  NCT_DARK_UI_FIELD_FOCUS_BORDER,
  NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW,
  NCT_DARK_UI_FOCUS_RING,
  NCT_DARK_UI_FONT,
  NCT_DARK_UI_HOVER_TINT,
  NCT_DARK_UI_PANEL_BACKGROUND,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_SELECTED_TEXT,
  NCT_DARK_UI_SELECTED_TINT,
  NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM,
  NCT_DARK_UI_TITLEBAR_BOX_SHADOW,
  NCT_DARK_UI_TITLEBAR_GRADIENT
} from './nct-dark-ui.js';
import { buildChordSlotKey, formatChordSlotKeyLabel } from '../utils/key-chord.js';
import {
  PANEL_POSITION_MARGIN_PX,
  applyPanelPosition,
  makePanelDraggable,
  makePanelResizable,
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
/**
 * Library keycap size. Cards pair a compact keycap (abbreviated label) with the full label in
 * the card body, so the keycap no longer has to carry the whole name like the old 3-up grid did.
 */
const CONFIG_KEY_SIZE_PX = 46;
const CONFIG_PANEL_WIDTH_PX = 960;
const CONFIG_INSPECTOR_WIDTH_PX = 280;
const CONFIG_STYLE_ATTR = 'data-kp-layout-config-panel-style';
const CONFIG_STYLE_VERSION = 'v17';
const CONFIG_ICON_SPRITE_ATTR = 'data-kp-layout-config-icons';
const CONFIG_PLACE_ARROW_STYLE_ATTR = 'data-kp-layout-place-arrow-style';
const PLACE_ARROW_CSS = `
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

/** NCT monochrome icon sprite — ids are `kp-cfg-i-*` to avoid page collisions. */
const CONFIG_ICON_SYMBOLS = Object.freeze([
  ['kp-cfg-i-kb', 'M1 4h14v9H1V4zm2 2v2h2V6H3zm3 0v2h2V6H6zm3 0v2h2V6H9zm3 0v2h2V6h-2zM3 9v2h8V9H3z'],
  ['kp-cfg-i-lib', 'M2 2h4v12H2V2zm5 0h2v12H7V2zm3 1h4v11h-4V3z'],
  ['kp-cfg-i-create', 'M8 1l2 4h4l-3 3 1 5-4-2-4 2 1-5-3-3h4L8 1zm0 4l-.7 1.4H5.8l1.1.9-.4 1.5L8 8.2l1.5.6-.4-1.5 1.1-.9H8.7L8 5z'],
  ['kp-cfg-i-eye', 'M8 3c4 0 7 5 7 5s-3 5-7 5-7-5-7-5 3-5 7-5zm0 2a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 110 2 1 1 0 010-2z'],
  ['kp-cfg-i-close', 'M3 2l5 5 5-5 1 1-5 5 5 5-1 1-5-5-5 5-1-1 5-5-5-5 1-1z'],
  ['kp-cfg-i-check', 'M2 8l2-2 3 3 5-5 2 2-7 7L2 8z'],
  ['kp-cfg-i-plus', 'M7 2h2v5h5v2H9v5H7V9H2V7h5V2z'],
  ['kp-cfg-i-copy', 'M5 2h9v9h-2V4H5V2zm-3 3h9v9H2V5zm2 2v5h5V7H4z'],
  ['kp-cfg-i-trash', 'M6 1h4l1 2h4v2H1V3h4l1-2zM3 6h10l-1 9H4L3 6zm3 2v5h1V8H6zm3 0v5h1V8H9z'],
  ['kp-cfg-i-import', 'M8 1l4 4H9v7H7V5H4l4-4zM2 12h12v3H2v-3z'],
  ['kp-cfg-i-export', 'M7 1h2v7h3l-4 4-4-4h3V1zm-5 11h12v3H2v-3z'],
  ['kp-cfg-i-expand', 'M2 2h5v2H4v3H2V2zm7 0h5v5h-2V4H9V2zM2 9h2v3h3v2H2V9zm10 0h2v5H9v-2h3V9z'],
  ['kp-cfg-i-collapse', 'M5 5H2V3h5v5H5V5zm4 0V3h5v2h-3v3H9V5zM5 9v3H2v2h5V9H5zm4 0h2v3h3v2H9V9z'],
  ['kp-cfg-i-expand-up', 'M8 2l5 5H9v7H7V7H3l5-5zm-6 11h12v2H2v-2z'],
  ['kp-cfg-i-place', 'M8 1a5 5 0 015 5c0 3.5-5 9-5 9S3 9.5 3 6a5 5 0 015-5zm0 3a2 2 0 100 4 2 2 0 000-4z'],
  ['kp-cfg-i-search', 'M6.5 2a4.5 4.5 0 013.5 7.3L14 13l-1 1-4.2-4A4.5 4.5 0 116.5 2zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5z'],
  ['kp-cfg-i-chord', 'M4 2h3v3H4V2zm5 0h3v3H9V2zM2 7h3v3H2V7zm4.5 0h3v3h-3V7zM11 7h3v3h-3V7zM4 12h3v2H4v-2zm5 0h3v2H9v-2z'],
  ['kp-cfg-i-chevron', 'M3 6l5 5 5-5H3z'],
  ['kp-cfg-i-more', 'M3 6.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm5 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm5 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z'],
  ['kp-cfg-i-all', 'M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z'],
  ['kp-cfg-i-macro', 'M3 2h10v2H3V2zm0 4h10v2H3V6zm0 4h6v2H3v-2zm8 0h2v4H8v-2h3v-2z'],
  ['kp-cfg-i-keycap', 'M3 3h10v10H3V3zm2 2v6h6V5H5z'],
  ['kp-cfg-i-nav', 'M8 1l5 6H9v8H7V7H3l5-6z'],
  ['kp-cfg-i-click', 'M7 1v7.2L5.2 6.4 4 7.6 8 12l4-4.4-1.2-1.2L9 8.2V1H7zm-4 11h10v2H3v-2z'],
  ['kp-cfg-i-scroll', 'M8 1l3 3H9v3H7V4H5l3-3zm0 14l-3-3h2V9h2v3h2l-3 3zM3 7h10v2H3V7z'],
  ['kp-cfg-i-tabs', 'M1 3h5l1 2h8v9H1V3zm2 4v5h10V7H3z'],
  ['kp-cfg-i-type', 'M2 3h12v2H9v8H7V5H2V3zm1 10h10v2H3v-2z'],
  ['kp-cfg-i-ai', 'M8 1l1.5 4H14l-3.5 2.7L12 13 8 10.2 4 13l1.5-5.3L2 5h4.5L8 1z'],
  ['kp-cfg-i-select', 'M3 3h4v2H5v2H3V3zm6 0h4v4h-2V5H9V3zM3 9h2v2h2v2H3V9zm8 2h2v4H9v-2h2v-2z'],
  ['kp-cfg-i-image', 'M2 3h12v10H2V3zm2 2v6h8V5H4zm1 1h3v2H5V6zm4 3l2 3H5l1.5-2L8 12l1-1z'],
  ['kp-cfg-i-data', 'M2 3c0-1.5 2.7-2.5 6-2.5S14 1.5 14 3v10c0 1.5-2.7 2.5-6 2.5S2 14.5 2 13V3zm2 0c0 .4 1.6 1 4 1s4-.6 4-1-1.6-1-4-1-4 .6-4 1z'],
  ['kp-cfg-i-lookup', 'M7 2a5 5 0 013.9 8.1L14 13l-1 1-3.1-3.1A5 5 0 117 2zm0 2a3 3 0 100 6 3 3 0 000-6z'],
  ['kp-cfg-i-translate', 'M2 3h5v2H5.2A9 9 0 017 8.5L5.7 9.5A8 8 0 014 5H2V3zm7 0h5v2h-1.5l-.8 2H14v2h-2.8l-.7 2H14v2H9l.6-2H8v-2h1.3L10 5H8V3h1z'],
  ['kp-cfg-i-display', 'M2 3h12v8H9v1h3v2H4v-2h3v-1H2V3zm2 2v4h8V5H4z'],
  ['kp-cfg-i-burst', 'M8 1l1 4 4 .5-3 2.8.9 4.2L8 10.5 5.1 12.5 6 8.3 3 5.5 7 5 8 1zm-5 12h10v2H3v-2z'],
  ['kp-cfg-i-cycle', 'M13 3v4h-4V5h1.3A4 4 0 108 12a4 4 0 003.5-2h2.1A6 6 0 114 4.2V2h2v4H2V2h2v1.3A6 6 0 0113 3z'],
  ['kp-cfg-i-hold', 'M7 1h2v7H7V1zm-2 8h6l2 2v4H3v-4l2-2zm2 2v2h2v-2H7z'],
  ['kp-cfg-i-mouse', 'M5 2h6a3 3 0 013 3v6a3 3 0 01-3 3H5a3 3 0 01-3-3V5a3 3 0 013-3zm3 1v4H5.2A2 2 0 015 5V4a1 1 0 011-1h2z'],
  ['kp-cfg-i-hotkey', 'M2 4h5v2H4v2h3v2H2V4zm7 0h5v8H9V4zm2 2v4h1V6h-1z'],
  ['kp-cfg-i-back', 'M8 2l-6 6 6 6 1.4-1.4L5.8 9H14V7H5.8l3.6-3.6L8 2z'],
  ['kp-cfg-i-forward', 'M8 2l6 6-6 6-1.4-1.4L10.2 9H2V7h8.2L6.6 3.4 8 2z']
]);

/** Function-id → keycap icon (library cards). */
const LIBRARY_KEY_ICON_BY_FUNCTION_ID = Object.freeze({
  HIGHLIGHT: 'kp-cfg-i-select',
  RECTANGLE_HIGHLIGHT: 'kp-cfg-i-select',
  CLIPBOARD_COPY: 'kp-cfg-i-copy',
  OPEN_POPOVER: 'kp-cfg-i-display',
  PAGE_DOWN_INSTANT: 'kp-cfg-i-scroll',
  PAGE_UP_INSTANT: 'kp-cfg-i-scroll',
  TAB_RIGHT: 'kp-cfg-i-tabs',
  TAB_LEFT: 'kp-cfg-i-tabs',
  OMNIBOX: 'kp-cfg-i-search',
  SEND_TEXT_TO_AI: 'kp-cfg-i-ai',
  TYPE_CHARACTERS: 'kp-cfg-i-type',
  GET_TEXT_AT_CURSOR: 'kp-cfg-i-data',
  GET_TEXT_RANGE: 'kp-cfg-i-data',
  GET_MEDIA_AT_CURSOR: 'kp-cfg-i-image',
  PAGE_MEDIA: 'kp-cfg-i-image',
  LOOKUP_WORD: 'kp-cfg-i-lookup',
  TRANSLATE: 'kp-cfg-i-translate',
  SHOW_POPOVER: 'kp-cfg-i-display'
});

/** Category → default keycap icon. */
const LIBRARY_KEY_ICON_BY_CATEGORY = Object.freeze({
  Navigation: 'kp-cfg-i-nav',
  'Tab Control': 'kp-cfg-i-tabs',
  'Begin URL': 'kp-cfg-i-search',
  'Get Page Data': 'kp-cfg-i-data',
  KeyPilot: 'kp-cfg-i-kb',
  Click: 'kp-cfg-i-click',
  Tabs: 'kp-cfg-i-tabs',
  Navigate: 'kp-cfg-i-nav',
  Scroll: 'kp-cfg-i-scroll',
  Select: 'kp-cfg-i-select',
  Clipboard: 'kp-cfg-i-copy',
  Text: 'kp-cfg-i-type',
  Tools: 'kp-cfg-i-display',
  Data: 'kp-cfg-i-data',
  Lookup: 'kp-cfg-i-lookup',
  Translate: 'kp-cfg-i-translate',
  Display: 'kp-cfg-i-display',
  Media: 'kp-cfg-i-image'
});

/**
 * @param {{ type?: string, id?: string, label?: string, variant?: string, functionId?: string, kind?: string }} item
 * @returns {string} sprite symbol id
 */
function libraryKeyIconId(item) {
  const variant = String(item?.variant || '');
  const id = String(item?.id || '');
  const label = String(item?.label || '').toLowerCase();
  const functionId = String(item?.functionId || (variant.includes('fn') || item?.type === 'function' ? id : '') || '');
  if (LIBRARY_KEY_ICON_BY_FUNCTION_ID[functionId]) return LIBRARY_KEY_ICON_BY_FUNCTION_ID[functionId];
  if (variant === 'stock-macro' || variant === 'user-macro' || item?.type === 'macro') {
    if (/ai/i.test(label)) return 'kp-cfg-i-ai';
    if (/nav/i.test(label)) return 'kp-cfg-i-nav';
    if (/clip|copy/i.test(label)) return 'kp-cfg-i-copy';
    return 'kp-cfg-i-macro';
  }
  if (variant === 'macro-key' || item?.kind) {
    const kind = String(item?.kind || label);
    if (/burst/i.test(kind)) return 'kp-cfg-i-burst';
    if (/round|cycle/i.test(kind)) return 'kp-cfg-i-cycle';
    if (/hold|cont|chord/i.test(kind)) return 'kp-cfg-i-hold';
    if (/mouse|click/i.test(kind)) return 'kp-cfg-i-mouse';
    if (/hot/i.test(kind)) return 'kp-cfg-i-hotkey';
    return 'kp-cfg-i-keycap';
  }
  const cat = functionId ? (getFunctionCategory(functionId) || '') : '';
  if (LIBRARY_KEY_ICON_BY_CATEGORY[cat]) return LIBRARY_KEY_ICON_BY_CATEGORY[cat];
  return 'kp-cfg-i-keycap';
}

/**
 * Next label when duplicating a user layout ("User Layout 2", or "Name copy" / "Name copy 2").
 * @param {string} sourceLabel
 * @param {{ label?: string }[]} existingLayouts
 * @returns {string}
 */
function nextDuplicateUserLayoutLabel(sourceLabel, existingLayouts = []) {
  const base = String(sourceLabel || 'Layout').trim() || 'Layout';
  const userN = base.match(/^User Layout(?: (\d+))?$/i);
  if (userN) {
    let maxN = 1;
    for (const l of existingLayouts || []) {
      const m = String(l?.label || '').trim().match(/^User Layout(?: (\d+))?$/i);
      if (!m) continue;
      const n = m[1] ? Number(m[1]) : 1;
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
    return `User Layout ${maxN + 1}`;
  }
  const labels = new Set(
    (existingLayouts || []).map((l) => String(l?.label || '').trim()).filter(Boolean)
  );
  const copy1 = `${base} copy`;
  if (!labels.has(copy1)) return copy1;
  let n = 2;
  while (labels.has(`${base} copy ${n}`)) n += 1;
  return `${base} copy ${n}`;
}

/**
 * @param {Document} doc
 * @param {string} symbolId
 * @returns {SVGSVGElement}
 */
function mkCfgIcon(doc, symbolId) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'kp-cfg-ico');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = doc.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${symbolId}`);
  svg.appendChild(use);
  return svg;
}

/**
 * Set a Config button's visible label, optionally prepending a sprite icon.
 * @param {HTMLElement} btn
 * @param {string} label
 * @param {string} [iconId]
 */
function setCfgBtnLabel(btn, label, iconId) {
  if (!btn) return;
  const doc = btn.ownerDocument || document;
  btn.textContent = String(label || '');
  if (iconId) {
    try { btn.prepend(mkCfgIcon(doc, iconId)); } catch { /* ignore */ }
  }
}

/**
 * @param {ShadowRoot} root
 */
function ensureConfigIconSprite(root) {
  const doc = root?.ownerDocument;
  if (!root || !doc) return;
  const existing = root.querySelector(`svg[${CONFIG_ICON_SPRITE_ATTR}]`);
  if (existing?.getAttribute(CONFIG_ICON_SPRITE_ATTR) === CONFIG_STYLE_VERSION) return;
  try { existing?.remove?.(); } catch { /* ignore */ }
  try {
    root.querySelectorAll(`svg[${CONFIG_ICON_SPRITE_ATTR}]`).forEach((el) => el.remove());
  } catch { /* ignore */ }
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute(CONFIG_ICON_SPRITE_ATTR, CONFIG_STYLE_VERSION);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0', overflow: 'hidden' });
  const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
  for (const [id, d] of CONFIG_ICON_SYMBOLS) {
    const symbol = doc.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    symbol.setAttribute('id', id);
    symbol.setAttribute('viewBox', '0 0 16 16');
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    symbol.appendChild(path);
    defs.appendChild(symbol);
  }
  svg.appendChild(defs);
  root.appendChild(svg);
}

/** Logic (non-Function) Macro Step kinds offered by the User Macros builder palette. */
const MACRO_LOGIC_DEFS = Object.freeze([
  Object.freeze({ kind: 'wait', label: 'Wait', description: 'Pause for N ms' }),
  Object.freeze({ kind: 'gate', label: 'Gate', description: 'If condition, else skip' }),
  Object.freeze({ kind: 'stop', label: 'Stop', description: 'End the macro now' }),
  Object.freeze({ kind: 'runMacro', label: 'Run Macro', description: 'Call another macro' })
]);

const MACRO_GATE_OPS = Object.freeze(['truthy', 'falsy', 'eq', 'neq', 'gt', 'lt']);

/**
 * Compact keycap text for a library card — initials for multi-word labels, otherwise a short
 * prefix. The card body still shows the full label, and the keycap keeps it as its `title`.
 * @param {string} label
 * @returns {string}
 */
function abbreviateLabel(label) {
  const text = String(label || '').trim();
  if (!text) return '?';
  const words = text.split(/[\s/_-]+/).filter(Boolean);
  if (words.length > 1) {
    return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
  }
  return text.length <= 4 ? text : text.slice(0, 4);
}

/**
 * @typedef {{
 *   mode: 'builtin'|'user',
 *   builtinLayoutId: string,
 *   userLayoutId: string|null,
 *   userLayout: any|null,
 *   userLayouts: any[],
 *   macros: any[],
 *   // Read-only built-in macro catalog (config/stock-macros.js) — browsable/placeable, and
 *   // forked into a user macro on first edit.
 *   stockMacros: any[],
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
    /** @type {ShadowRoot|null} */
    this.shadowRoot = null;
    this._listEl = null;
    /** @type {HTMLElement|null} */
    this._layoutCombo = null;
    /** @type {HTMLInputElement|null} */
    this._layoutComboInput = null;
    /** @type {HTMLElement|null} */
    this._layoutComboList = null;
    /** @type {HTMLButtonElement|null} */
    this._layoutComboToggle = null;
    /** @type {HTMLButtonElement|null} */
    this._setCurrentBtn = null;
    /** @type {HTMLElement|null} */
    this._layoutOptsWrap = null;
    /** @type {HTMLButtonElement|null} */
    this._layoutOptsBtn = null;
    /** @type {HTMLElement|null} */
    this._layoutOptsMenu = null;
    this._searchInput = null;
    this._macroKeysActionsRow = null;
    /** Inspector dock body — every Config-side editor renders in here. */
    this._inspectorBody = null;
    /**
     * Legacy alias for {@link _inspectorBody}: the Macro Key / Action parameter / Macro summary
     * editors used to live in a standalone inline host under the palette.
     */
    this._macroKeyEditorHost = null;
    this._inspectorPane = null;
    this._inspectorRail = null;
    this._mainRow = null;
    this._createPane = null;
    this._createBody = null;
    this._createToggleBtn = null;
    this._createExpandUpBtn = null;
    this._createModeSeg = null;
    this._libraryCreateSplitter = null;
    this._workspaceInspectorSplitter = null;
    this._scriptPanel = null;
    this._macroKeyPanel = null;
    this._macroNameInput = null;
    this._scriptStepsHost = null;
    this._scriptStockBanner = null;
    this._scriptMetaEl = null;
    this._placeHintEl = null;
    this._legendEl = null;
    this._libViewSegEl = null;
    this._addStepSelect = null;
    this._addStepDelayInput = null;
    this._libTabsEl = null;
    this._fnCategorySelect = null;
    this._currentBadge = null;
    this._refToggleBtn = null;
    this._showNumRowToggle = null;
    this._dragDispose = null;
    this._resizeDispose = null;
    this._positionHydrated = false;
    /** @type {'all'|'macros'|'macroKeys'|'functions'} */
    this._libPrimaryTab = 'all';
    this._libFunctionCategory = '';
    /** @type {'cards'|'table'} Actions Library presentation mode (session-local). */
    this._libViewMode = 'cards';
    /** Expanded hierarchical table group keys (top-level open by default). */
    this._tableExpanded = new Set(DEFAULT_SETTINGS.actionsLibraryTableExpanded || [
      'functions', 'macros', 'macroKeys'
    ]);
    this._tableExpandedHydrated = false;
    this._inspectorOpen = true;
    this._createOpen = false;
    /** When true, User Macros fills the workspace under the library titlebar. */
    this._createMaximized = false;
    /** @type {number|null} Height in px before maximize (for Restore). */
    this._createPrevHeightPx = null;
    /** Selected Actions Library Function id for toolbar “Add step”. */
    this._selectedLibraryFunctionId = '';
    /** @type {'script'|'macroKey'} */
    this._createMode = 'script';
    /**
     * Working copy for the User Macros builder. Steps are edited in memory and committed on
     * Save (`upsertUserMacro`, or `forkStockMacroToUser` when `stock` is set), so configuring a
     * stock macro never mutates the read-only catalog.
     * @type {{ id: string|null, label: string, steps: any[], stock: boolean,
     *   baseStockMacroId: string|null, dirty: boolean }|null}
     */
    this._macroDraft = null;
    this._selectedStepIndex = -1;
    /** @type {{ type: string, id: string }|null} */
    this._inspectorSelection = null;
    /** @type {any|null} draft while editing a macro key */
    this._macroKeyDraft = null;
    /** Live keydown capture cleanup for the "Bind modifier combo" control (worksWhileTyping Functions). */
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
      stockMacros: [],
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
   * @param {{ duplicateBuiltin?: boolean }} [opts] When true (default), entering edit on a
   *   built-in layout creates "{Family} Copy N" and switches to it.
   */
  async show(kp, { duplicateBuiltin = true } = {}) {
    this._kp = kp || null;
    if (window !== window.top) return;
    this._ensure();
    const builtinId = String(kp?._keyboardLayoutId || DEFAULT_KEYBOARD_LAYOUT_ID);
    this._st.builtinLayoutId = builtinId;

    // Prefer currently active user layout when entering edit mode.
    // Editing a built-in always starts from a copy ("Browsing Copy 1", …).
    let adoptedCopy = null;
    try {
      const sel = String(kp?._currentKeyboardLayoutId || 'builtin');
      if (sel.startsWith('user:')) {
        const id = sel.slice('user:'.length);
        this._st.mode = 'user';
        this._st.userLayoutId = id;
      } else if (duplicateBuiltin) {
        const layouts = await listUserKeyboardLayouts();
        const label = nextUserCopyLayoutLabel(this._familyBaseLabel(), layouts);
        const created = await duplicateBuiltinLayoutToUserLayout({
          builtinLayoutId: this._st.builtinLayoutId,
          label
        });
        if (created?.id) {
          adoptedCopy = created;
          this._st.mode = 'user';
          this._st.userLayoutId = created.id;
          this._st.userLayout = created;
          const nextId = `user:${created.id}`;
          try { await setSettings({ currentKeyboardLayoutId: nextId }); } catch { /* ignore */ }
          try {
            if (kp) {
              kp._currentKeyboardLayoutId = nextId;
              kp._currentUserLayout = created;
              if (kp._settings) kp._settings.currentKeyboardLayoutId = nextId;
            }
          } catch { /* ignore */ }
        } else {
          this._st.mode = 'builtin';
          this._st.userLayoutId = null;
          this._st.userLayout = null;
        }
      } else {
        this._st.mode = 'builtin';
        this._st.userLayoutId = null;
        this._st.userLayout = null;
      }
    } catch { /* ignore */ }

    await this._reloadStore();
    if (adoptedCopy && kp && typeof kp.applyLiveUserLayout === 'function') {
      try {
        void kp.applyLiveUserLayout(this._st.userLayout || adoptedCopy, {
          macros: this._st.macros,
          actions: this._st.actions
        });
      } catch { /* ignore */ }
    }
    this._syncKeyboardReferenceToggle();
    this._setVisible(true);
    this._emitChange();
  }

  hide() {
    this._cancelPlaceMode();
    this._stopChordCapture();
    this._setVisible(false);
  }

  /**
   * Persist the active user layout (if any), then close Config and exit edit mode.
   */
  async _saveAndClose() {
    try {
      await this._persistUserLayout();
    } catch { /* ignore */ }
    this.hide();
    try { this._onClose?.(); } catch { /* ignore */ }
  }

  cleanup() {
    this._cancelPlaceMode();
    this._stopChordCapture();
    try { this._dragDispose?.(); } catch { /* ignore */ }
    this._dragDispose = null;
    try { this._resizeDispose?.(); } catch { /* ignore */ }
    this._resizeDispose = null;
    try {
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    } catch { /* ignore */ }
    this.root = null;
    this.shadowRoot = null;
    this._listEl = null;
    this._kp = null;
  }

  /**
   * Create an empty user layout, select it for editing, and optionally make it current.
   * @param {{ setCurrent?: boolean, label?: string }} [opts]
   * @returns {Promise<any|null>} created layout or null
   */
  async createNewLayout({ setCurrent = true, label = 'New Layout' } = {}) {
    try {
      const created = await createEmptyUserKeyboardLayout({
        baseBuiltinLayoutId: this._st.builtinLayoutId,
        label,
        includeNumberRow: true
      });
      if (!created?.id) {
        this._notify('Failed to create layout.', 'error');
        return null;
      }
      this._st.userLayouts = await listUserKeyboardLayouts();
      this._st.mode = 'user';
      this._st.userLayoutId = created.id;
      this._st.userLayout = created;
      this._renderLayoutSelect();
      this._renderRightList();
      this._emitChange();

      if (setCurrent) {
        const nextId = `user:${created.id}`;
        try {
          await setSettings({ currentKeyboardLayoutId: nextId });
        } catch { /* ignore */ }
        try {
          const kp = this._kp;
          if (kp) {
            kp._currentKeyboardLayoutId = nextId;
            kp._currentUserLayout = created;
            if (kp._settings) kp._settings.currentKeyboardLayoutId = nextId;
            if (typeof kp.applyLiveUserLayout === 'function') {
              void kp.applyLiveUserLayout(created, {
                macros: this._st.macros,
                actions: this._st.actions
              });
            } else if (typeof kp._refreshCurrentKeyboardLayoutFromSettings === 'function') {
              void kp._refreshCurrentKeyboardLayoutFromSettings();
            }
          }
        } catch { /* ignore */ }
      }

      this._notify(`Created "${created.label || 'New Layout'}".`, 'success');
      return created;
    } catch {
      this._notify('Failed to create layout.', 'error');
      return null;
    }
  }

  /**
   * Duplicate the currently selected layout into a new editable user layout,
   * select it for editing, and optionally make it current.
   * Built-in → seeded copy of Built-in. User layout → deep copy of that layout's slots.
   * @param {{ setCurrent?: boolean, label?: string }} [opts]
   * @returns {Promise<any|null>} created layout or null
   */
  async duplicateLayout({ setCurrent = true, label } = {}) {
    try {
      const layouts = await listUserKeyboardLayouts();
      const sourceUser = (this._st.mode === 'user' && this._st.userLayout)
        ? this._st.userLayout
        : null;

      let nextLabel = label ? String(label) : '';
      if (!nextLabel) {
        if (sourceUser) {
          nextLabel = nextDuplicateUserLayoutLabel(
            sourceUser.label || 'Layout',
            layouts
          );
        } else {
          nextLabel = nextUserCopyLayoutLabel(this._familyBaseLabel(), layouts) || 'Custom Layout';
        }
      }

      const created = sourceUser
        ? await duplicateUserKeyboardLayout({ source: sourceUser, label: nextLabel })
        : await duplicateBuiltinLayoutToUserLayout({
          builtinLayoutId: this._st.builtinLayoutId,
          label: nextLabel
        });
      if (!created?.id) {
        this._notify('Failed to duplicate layout.', 'error');
        return null;
      }
      this._st.userLayouts = await listUserKeyboardLayouts();
      this._st.mode = 'user';
      this._st.userLayoutId = created.id;
      this._st.userLayout = created;
      this._renderLayoutSelect();
      this._renderRightList();
      this._emitChange();

      if (setCurrent) {
        const nextId = `user:${created.id}`;
        try {
          await setSettings({ currentKeyboardLayoutId: nextId });
        } catch { /* ignore */ }
        try {
          const kp = this._kp;
          if (kp) {
            kp._currentKeyboardLayoutId = nextId;
            kp._currentUserLayout = created;
            if (kp._settings) kp._settings.currentKeyboardLayoutId = nextId;
            if (typeof kp.applyLiveUserLayout === 'function') {
              void kp.applyLiveUserLayout(created, {
                macros: this._st.macros,
                actions: this._st.actions
              });
            } else if (typeof kp._refreshCurrentKeyboardLayoutFromSettings === 'function') {
              void kp._refreshCurrentKeyboardLayoutFromSettings();
            }
          }
        } catch { /* ignore */ }
      }

      this._notify(`Duplicated "${created.label || nextLabel}".`, 'success');
      return created;
    } catch {
      this._notify('Failed to duplicate layout.', 'error');
      return null;
    }
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

  _ensureStylesInjected(doc, shadowRoot) {
    try {
      if (!doc || !shadowRoot) return;
      try {
        doc.head?.querySelectorAll(`style[${CONFIG_STYLE_ATTR}]`).forEach((el) => el.remove());
        doc.querySelectorAll(`svg[${CONFIG_ICON_SPRITE_ATTR}]`).forEach((el) => el.remove());
      } catch { /* ignore */ }
      ensureConfigIconSprite(shadowRoot);
      const attr = KEYBINDINGS_UI_STYLE_ATTR || 'data-kp-keybindings-ui-style';
      const getURL = (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) ? chrome.runtime.getURL.bind(chrome.runtime) : null;
      const fontUrls = getURL ? {
        robotech: getURL('fonts/ROBOTECHGPRegular.ttf'),
        titillium: getURL('fonts/TitilliumTextRegular.otf'),
        cubellan: getURL('fonts/CubellanRegular.ttf'),
        ezarion: getURL('fonts/EzarionRegular.ttf'),
        dosis: getURL('fonts/DosisBook.ttf')
      } : undefined;
      const css = getKeybindingsUiCss({ zKeybindingsPopover: Z_INDEX.KEYBINDINGS_POPOVER, fontUrls });
      injectChromeStyles(shadowRoot, { attr, css });
      injectChromeStyles(shadowRoot, { attr: CONFIG_STYLE_ATTR, css: this._getPanelCss() });
      injectChromeStyles(doc, { attr: CONFIG_PLACE_ARROW_STYLE_ATTR, css: PLACE_ARROW_CSS });
    } catch { /* ignore */ }
  }

  /**
   * NCT dark UI stylesheet for Layout Config chrome (Layout B mock tokens).
   * @returns {string}
   */
  _getPanelCss() {
    const c = NCT_DARK_UI_COLORS;
    const accentA = (a) => `rgba(74,144,200,${a})`;
    return `
.kp-layout-config-panel {
  font-family: ${NCT_DARK_UI_FONT};
  font-size: 12px;
  line-height: 1.35;
  color: ${c.fg};
  /* Lightened edit-mode panel chrome (Config only opens while editing). */
  background-color: #2e2e2e !important;
}
.kp-layout-config-panel .kp-cfg-ico {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  fill: currentColor;
  display: inline-block;
  vertical-align: -1px;
}
.kp-layout-config-panel .kp-cfg-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  box-sizing: border-box;
  padding: 0 6px 0 10px;
  margin: 0;
  border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
  box-shadow: ${NCT_DARK_UI_TITLEBAR_BOX_SHADOW};
  /* Lightened edit-mode titlebar + same steel hatch as Keyboard Reference. */
  background-image:
    repeating-linear-gradient(
      -45deg,
      rgba(180, 200, 220, 0.08) 0px,
      rgba(180, 200, 220, 0.08) 1px,
      transparent 1px,
      transparent 7px
    ),
    linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%);
  flex: 0 0 auto;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}
.kp-layout-config-panel .kp-cfg-titlebar-start {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}
.kp-layout-config-panel .kp-cfg-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: ${c.fg};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  padding: 0;
  line-height: 28px;
  min-width: 0;
}
.kp-layout-config-panel .kp-cfg-save-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-height: 22px;
  padding: 0 8px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  color: ${NCT_DARK_UI_SELECTED_TEXT};
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  line-height: 20px;
  white-space: nowrap;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(200,220,240,0.18);
}
.kp-layout-config-panel .kp-cfg-save-close:hover {
  filter: brightness(1.08);
}
.kp-layout-config-panel .kp-cfg-close {
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: none;
  background: transparent;
  color: ${c.fgDim};
  cursor: pointer;
  padding: 0;
  margin: 0;
  flex: 0 0 auto;
  box-shadow: ${NCT_DARK_UI_ICON_BUTTON_OUTLINE};
}
.kp-layout-config-panel .kp-cfg-close:hover {
  color: ${c.fg};
  background: ${NCT_DARK_UI_HOVER_TINT};
}
.kp-layout-config-panel .kp-cfg-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  /* Lightened edit-mode body + same steel hatch as Keyboard Reference plate. */
  background-color: #1a1c20;
  background-image:
    repeating-linear-gradient(
      -45deg,
      rgba(180, 200, 220, 0.08) 0px,
      rgba(180, 200, 220, 0.08) 1px,
      transparent 1px,
      transparent 7px
    );
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} {
  gap: 12px;
}
.kp-layout-config-panel .kp-cfg-strip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #1a2430;
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(55, 85, 120, 0.18), rgba(30, 45, 70, 0.08)),
    #1a1e24;
  box-shadow:
    0 0 0 1px ${c.panelEdge} inset,
    inset 0 -1px 0 rgba(90, 130, 170, 0.12);
  flex: 0 0 auto;
  overflow: visible;
}
.kp-layout-config-panel .kp-cfg-strip-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.kp-layout-config-panel .kp-cfg-layout-strip {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 10px;
  min-width: 0;
  overflow: visible;
}
.kp-layout-config-panel .kp-cfg-layout-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 auto;
  min-width: 0;
  height: 22px;
}
.kp-layout-config-panel .kp-cfg-strip-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #7a92a8;
  white-space: nowrap;
  line-height: 22px;
  margin: 0;
}
.kp-layout-config-panel .kp-cfg-layout-combo {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 240px;
  flex: 0 1 240px;
  min-width: 160px;
  height: 22px;
  border: ${NCT_DARK_UI_FIELD_BORDER};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: ${NCT_DARK_UI_FIELD_BACKGROUND};
  box-shadow: ${NCT_DARK_UI_FIELD_BOX_SHADOW};
}
.kp-layout-config-panel .kp-cfg-layout-combo:focus-within {
  border-color: ${NCT_DARK_UI_FIELD_FOCUS_BORDER};
  box-shadow: ${NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW};
}
.kp-layout-config-panel .kp-cfg-layout-combo.is-builtin .kp-cfg-combo-input {
  color: #9aacbe;
}
.kp-layout-config-panel .kp-cfg-combo-input {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  height: 100%;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 8px !important;
  color: ${c.fg};
  font: 11px/22px ${NCT_DARK_UI_FONT};
  outline: none;
}
.kp-layout-config-panel .kp-cfg-combo-current-badge {
  display: none;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  margin-right: 4px;
  padding: 0 5px 0 4px;
  height: 16px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: ${accentA(0.22)};
  color: #9ec8e8;
  font: 8px/1 ${NCT_DARK_UI_FONT};
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
.kp-layout-config-panel .kp-cfg-layout-combo.is-current .kp-cfg-combo-current-badge {
  display: inline-flex;
}
.kp-layout-config-panel .kp-cfg-combo-current-badge .kp-cfg-ico {
  width: 8px;
  height: 8px;
}
.kp-layout-config-panel .kp-cfg-combo-toggle {
  flex: 0 0 22px;
  width: 22px;
  height: 100%;
  padding: 0;
  border: 0;
  border-left: 1px solid ${c.fieldEdge};
  border-radius: 0;
  background: linear-gradient(180deg, #3a4450 0%, #2a323c 55%, #222830 100%);
  color: #b8c4d0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.kp-layout-config-panel .kp-cfg-combo-toggle:hover {
  filter: brightness(1.1);
  color: #e8f0f8;
}
.kp-layout-config-panel .kp-cfg-combo-toggle .kp-cfg-ico {
  width: 9px;
  height: 9px;
}
.kp-layout-config-panel .kp-cfg-combo-list {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 40;
  margin: 0;
  padding: 2px;
  list-style: none;
  max-height: 180px;
  overflow: auto;
  border: 1px solid #1a2430;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: #1a222c;
  box-shadow: 0 10px 24px rgba(0,0,0,0.5);
}
.kp-layout-config-panel .kp-cfg-combo-list[hidden] {
  display: none !important;
}
.kp-layout-config-panel .kp-cfg-combo-group {
  padding: 5px 8px 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(170, 180, 195, 0.72);
  pointer-events: none;
  user-select: none;
}
.kp-layout-config-panel .kp-cfg-combo-group:not(:first-child) {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.kp-layout-config-panel .kp-cfg-combo-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 4px 8px;
  border: 0;
  border-radius: 1px;
  background: transparent;
  color: #c8d4e0;
  cursor: pointer;
  font: 11px/1.3 ${NCT_DARK_UI_FONT};
}
.kp-layout-config-panel .kp-cfg-combo-option:hover,
.kp-layout-config-panel .kp-cfg-combo-option.is-active {
  background: ${NCT_DARK_UI_SELECTED_TINT};
  color: ${NCT_DARK_UI_SELECTED_TEXT};
}
.kp-layout-config-panel .kp-cfg-combo-option-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kp-layout-config-panel .kp-cfg-combo-option-current {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  font-size: 8px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9ec8e8;
}
.kp-layout-config-panel .kp-cfg-combo-option-current .kp-cfg-ico {
  width: 8px;
  height: 8px;
}
.kp-layout-config-panel .kp-cfg-layout-tools {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  height: 22px;
}
.kp-layout-config-panel .kp-cfg-layout-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  margin-left: auto;
  height: 22px;
}
.kp-layout-config-panel .kp-cfg-tool-group {
  display: inline-flex;
  gap: 0;
  align-items: stretch;
  height: 22px;
  border: ${NCT_DARK_UI_BTN_BORDER};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  overflow: hidden;
  background: ${NCT_DARK_UI_BTN_GRADIENT};
}
.kp-layout-config-panel .kp-cfg-tool-group .kp-cfg-btn {
  border: none;
  border-radius: 0;
  border-right: 1px solid ${c.panelEdgeDark};
  background: transparent;
  box-shadow: none;
  height: 100%;
  padding: 0 7px;
}
.kp-layout-config-panel .kp-cfg-tool-group .kp-cfg-btn:last-child {
  border-right: 0;
}
.kp-layout-config-panel .kp-cfg-tool-group .kp-cfg-btn.kp-cfg-btn-icon {
  width: 26px;
  padding: 0;
}
.kp-layout-config-panel .kp-cfg-btn.kp-cfg-btn-icon {
  width: 22px;
  min-width: 22px;
  padding: 0;
}
.kp-layout-config-panel .kp-cfg-tool-sep {
  width: 1px;
  align-self: stretch;
  min-height: 18px;
  background: ${c.panelEdgeDark};
  margin: 0 2px;
}
.kp-layout-config-panel .kp-cfg-spacer {
  flex: 1 1 auto;
}
.kp-layout-config-panel .kp-cfg-opts-wrap {
  position: relative;
  flex: 0 0 auto;
}
.kp-layout-config-panel .kp-cfg-opts-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 40;
  min-width: 160px;
  padding: 6px 8px;
  border: 1px solid #1a2430;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: #1a222c;
  box-shadow: 0 10px 24px rgba(0,0,0,0.5);
}
.kp-layout-config-panel .kp-cfg-opts-menu[hidden] {
  display: none !important;
}
.kp-layout-config-panel .kp-cfg-opts-menu .kp-cfg-opts-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 11px;
  color: #c8d4e0;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.kp-layout-config-panel .kp-cfg-strip-hint {
  padding: 0 10px 6px;
  margin: 0;
}
.kp-layout-config-panel .kp-cfg-main {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
  flex: 1 1 auto;
  min-height: 0;
  margin: 6px 8px 8px;
  --kp-cfg-inspector-width: ${CONFIG_INSPECTOR_WIDTH_PX}px;
  --kp-cfg-create-height: 46%;
}
.kp-layout-config-panel .kp-cfg-workspace {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
.kp-layout-config-panel .kp-cfg-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid ${c.panelEdgeDark};
  border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
  background: #1a1a1a;
  overflow: hidden;
  box-shadow: 0 0 0 1px ${c.panelEdge} inset;
}
.kp-layout-config-panel .kp-cfg-pane-library {
  flex: 1 1 auto;
  background:
    linear-gradient(180deg, rgba(70, 95, 55, 0.14), rgba(40, 55, 35, 0.06)),
    linear-gradient(180deg, #161814, #1a1c18);
  border-color: #3a4a30;
  box-shadow:
    0 0 0 1px rgba(170, 210, 120, 0.28),
    0 0 14px rgba(120, 170, 80, 0.12),
    inset 0 1px 0 rgba(210, 240, 160, 0.18),
    inset 0 0 0 1px rgba(120, 150, 90, 0.16);
}
.kp-layout-config-panel .kp-cfg-pane-library .kp-cfg-pane-hdr {
  background: linear-gradient(180deg, #3a4a34, #2a3426);
  color: #c8d8b0;
  border-bottom-color: #141c12;
  box-shadow: 0 1px 0 rgba(150, 180, 110, 0.12);
}
.kp-layout-config-panel .kp-cfg-pane-library .kp-cfg-pane-title {
  color: #c8d8b0;
}
.kp-layout-config-panel .kp-cfg-pane-hdr {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 8px;
  min-height: 22px;
  border-bottom: 1px solid ${c.panelEdgeDark};
  background: linear-gradient(180deg, #383838, #2a2a2a);
  flex: 0 0 auto;
}
.kp-layout-config-panel .kp-cfg-pane-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${c.fgDim};
  white-space: nowrap;
}
.kp-layout-config-panel .kp-cfg-pane-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}
.kp-layout-config-panel .kp-cfg-pane-library .kp-cfg-pane-scroll::-webkit-scrollbar-thumb {
  background: #4a5a40;
}
.kp-layout-config-panel .kp-cfg-seg {
  display: inline-flex;
  gap: 0;
  padding: 0;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: ${NCT_DARK_UI_BTN_BORDER};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  overflow: hidden;
}
.kp-layout-config-panel .kp-cfg-seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 18px;
  border: none;
  border-right: 1px solid ${c.panelEdgeDark};
  border-radius: 0;
  background: transparent;
  color: ${c.fgDim};
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}
.kp-layout-config-panel .kp-cfg-seg-btn .kp-cfg-ico {
  width: 10px;
  height: 10px;
  opacity: 0.85;
}
.kp-layout-config-panel .kp-cfg-seg-btn:last-child {
  border-right: 0;
}
.kp-layout-config-panel .kp-cfg-seg-btn:hover {
  color: ${c.fg};
  background: ${NCT_DARK_UI_HOVER_TINT};
}
.kp-layout-config-panel .kp-cfg-seg-btn[aria-selected="true"] {
  background: ${NCT_DARK_UI_SELECTED_TINT};
  color: ${NCT_DARK_UI_SELECTED_TEXT};
  box-shadow: ${NCT_DARK_UI_FOCUS_RING};
}
.kp-layout-config-panel .kp-cfg-search-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 1 1 130px;
  min-width: 110px;
  max-width: 240px;
}
.kp-layout-config-panel .kp-cfg-search-wrap .kp-cfg-ico {
  position: absolute;
  left: 6px;
  width: 10px;
  height: 10px;
  opacity: 0.55;
  pointer-events: none;
}
.kp-layout-config-panel .kp-cfg-search {
  width: 100%;
  flex: 1 1 auto;
  min-width: 0;
  max-width: none;
  padding: 2px 7px 2px 22px;
  height: 18px;
  font-size: 10px;
  background: #121410;
  border-color: #0a1008;
  color: #c8d8b0;
  box-shadow: inset 0 1px 0 #2a3024;
}
.kp-layout-config-panel .kp-cfg-fn-cat {
  width: auto;
  min-width: 120px;
  max-width: 180px;
  padding: 0 6px;
  height: 18px;
  font-size: 9px;
}
.kp-layout-config-panel .kp-cfg-lib-viewbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 2px 2px 8px;
  flex: 0 0 auto;
}
.kp-layout-config-panel .kp-cfg-lib-viewbar .kp-cfg-seg {
  flex: 0 0 auto;
}
.kp-layout-config-panel .kp-cfg-legend-mini {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 8px;
  color: #6a7a58;
  opacity: 0.85;
}
.kp-layout-config-panel .kp-cfg-legend-mini span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.kp-layout-config-panel .kp-cfg-legend-mini i {
  display: inline-block;
  width: 10px;
  height: 8px;
  border-radius: 1px;
  border: 1px solid #444;
  box-sizing: border-box;
}
.kp-layout-config-panel .kp-cfg-legend-mini .kp-cfg-sw-stock-fn {
  background: #2a2e32;
  border-color: #3a4550;
}
.kp-layout-config-panel .kp-cfg-legend-mini .kp-cfg-sw-user {
  background: #2a2e32;
  border-color: ${accentA(0.45)};
}
.kp-layout-config-panel .kp-cfg-legend-mini .kp-cfg-sw-stock-macro {
  background: #243430;
  border-left: 3px solid #5a9a8a;
}
.kp-layout-config-panel .kp-cfg-legend-mini .kp-cfg-sw-user-macro {
  background: #2c2434;
  border-left: 3px solid #9a7ab8;
}
.kp-layout-config-panel .kp-cfg-lib-table-wrap {
  width: 100%;
  overflow: auto;
  border: 1px solid rgba(120, 140, 100, 0.12);
  border-radius: 2px;
  background: rgba(8, 10, 8, 0.35);
}
.kp-layout-config-panel .kp-cfg-lib-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  table-layout: fixed;
}
.kp-layout-config-panel .kp-cfg-lib-table th {
  text-align: left;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8a9a78;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(120, 140, 100, 0.18);
  background: #121410;
  position: sticky;
  top: 0;
  z-index: 1;
}
.kp-layout-config-panel .kp-cfg-lib-table td {
  padding: 5px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
  color: #c8d4e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kp-layout-config-panel .kp-cfg-lib-table tr.kp-cfg-lib-row-group {
  background: rgba(255,255,255,0.03);
  cursor: pointer;
}
.kp-layout-config-panel .kp-cfg-lib-table tr.kp-cfg-lib-row-group td {
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9a8aaa;
}
.kp-layout-config-panel .kp-cfg-lib-table tr.kp-cfg-lib-row-leaf:hover {
  background: rgba(74, 144, 200, 0.12);
}
.kp-layout-config-panel .kp-cfg-lib-table tr.kp-cfg-lib-row-inspecting {
  background: rgba(74, 144, 200, 0.18);
  outline: 1px solid rgba(74, 144, 200, 0.35);
}
.kp-layout-config-panel .kp-cfg-lib-table tr.kp-cfg-lib-row-place {
  box-shadow: inset 2px 0 0 ${c.accent};
}
.kp-layout-config-panel .kp-cfg-lib-twisty {
  appearance: none;
  width: 18px;
  height: 18px;
  padding: 0;
  margin: 0 4px 0 0;
  border: 0;
  background: transparent;
  color: #9aacbe;
  cursor: pointer;
  font-size: 10px;
  line-height: 18px;
  flex: 0 0 auto;
}
.kp-layout-config-panel .kp-cfg-lib-label-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.kp-layout-config-panel .kp-cfg-lib-label-cell .kp-cfg-ico {
  width: 12px;
  height: 12px;
  opacity: 0.9;
  flex: 0 0 auto;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .kp-cfg-lib-table .key.kp-cfg-lib-key {
  flex: 0 0 auto !important;
  width: 22px !important;
  min-width: 22px !important;
  max-width: 22px !important;
  height: 22px !important;
  min-height: 22px !important;
  max-height: 22px !important;
  border-radius: 6px !important;
  cursor: grab;
  padding: 0 !important;
  margin: 0;
  display: block;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .kp-cfg-lib-table .key.kp-cfg-lib-key:active {
  cursor: grabbing;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .kp-cfg-lib-table .key.kp-cfg-lib-key > .key-bg-icon {
  inset: 10%;
  -webkit-mask-size: 82% 82%;
  mask-size: 82% 82%;
  opacity: 0.9;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .kp-cfg-lib-table .key.kp-cfg-lib-key > .key-main,
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .kp-cfg-lib-table .key.kp-cfg-lib-key > .key-label {
  display: none !important;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .kp-cfg-lib-table .key.kp-cfg-lib-key.kp-place-source {
  outline: 2px solid ${c.accent};
  outline-offset: 0;
}
.kp-layout-config-panel .kp-cfg-lib-label-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kp-layout-config-panel .kp-cfg-lib-table .kp-cfg-card-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}
.kp-layout-config-panel .kp-cfg-lib-table col.kp-cfg-col-label { width: 34%; }
.kp-layout-config-panel .kp-cfg-lib-table col.kp-cfg-col-kind { width: 14%; }
.kp-layout-config-panel .kp-cfg-lib-table col.kp-cfg-col-summary { width: 22%; }
.kp-layout-config-panel .kp-cfg-lib-table col.kp-cfg-col-slots { width: 12%; }
.kp-layout-config-panel .kp-cfg-lib-table col.kp-cfg-col-actions { width: 18%; }
.kp-layout-config-panel .kp-cfg-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 2px 2px 8px;
  flex: 0 0 auto;
  font-size: 9px;
  color: #6a7a58;
}
.kp-layout-config-panel .kp-cfg-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.kp-layout-config-panel .kp-cfg-legend i {
  display: inline-block;
  width: 12px;
  height: 10px;
  border-radius: 1px;
  border: 1px solid #444;
  box-sizing: border-box;
}
.kp-layout-config-panel .kp-cfg-legend .kp-cfg-sw-stock-fn {
  background: #2a2e32;
  border-color: #3a4550;
}
.kp-layout-config-panel .kp-cfg-legend .kp-cfg-sw-user {
  background: #2a2e32;
  border-color: ${accentA(0.45)};
}
.kp-layout-config-panel .kp-cfg-legend .kp-cfg-sw-stock-macro {
  background: #243430;
  border-left: 3px solid #5a9a8a;
}
.kp-layout-config-panel .kp-cfg-legend .kp-cfg-sw-user-macro {
  background: #2c2434;
  border-left: 3px solid #9a7ab8;
}
.kp-layout-config-panel .kp-cfg-category {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 14px;
  padding: 10px 8px 8px;
  border: 1px solid rgba(120, 140, 100, 0.1);
  border-radius: 2px;
  background: rgba(8, 10, 8, 0.35);
  position: relative;
}
.kp-layout-config-panel .kp-cfg-category-title {
  position: absolute;
  top: -6px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0 5px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a9a78;
  background: #121410;
}
.kp-layout-config-panel .kp-cfg-category[data-kp-section="macros"] {
  border-color: rgba(154, 122, 184, 0.12);
  background: rgba(10, 8, 14, 0.35);
}
.kp-layout-config-panel .kp-cfg-category[data-kp-section="macros"] .kp-cfg-category-title {
  color: #9a8aaa;
}
.kp-layout-config-panel .kp-cfg-category[data-kp-section="macroKeys"] {
  border-color: rgba(90, 140, 180, 0.12);
  background: rgba(8, 10, 14, 0.35);
}
.kp-layout-config-panel .kp-cfg-category[data-kp-section="macroKeys"] .kp-cfg-category-title {
  color: #7a92a8;
}
.kp-layout-config-panel .kp-cfg-macro-subgroups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 2px;
}
.kp-layout-config-panel .kp-cfg-macro-fieldset {
  margin: 0;
  padding: 10px 8px 8px;
  min-width: 0;
  border: 1px solid rgba(154, 122, 184, 0.08);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.12);
}
.kp-layout-config-panel .kp-cfg-macro-fieldset[data-macro-group="stock"] {
  border-color: rgba(120, 180, 150, 0.1);
  background: rgba(8, 14, 12, 0.18);
}
.kp-layout-config-panel .kp-cfg-macro-fieldset[data-macro-group="user"] {
  border-color: rgba(170, 130, 210, 0.1);
  background: rgba(14, 10, 18, 0.18);
}
.kp-layout-config-panel .kp-cfg-macro-fieldset > legend {
  padding: 0 6px;
  margin-left: 2px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #7a6a8a;
}
.kp-layout-config-panel .kp-cfg-macro-fieldset[data-macro-group="stock"] > legend {
  color: #6a9080;
}
.kp-layout-config-panel .kp-cfg-macro-fieldset[data-macro-group="user"] > legend {
  color: #9a88b0;
}
.kp-layout-config-panel .kp-cfg-subgroup-empty {
  margin: 0;
  padding: 4px 2px;
  font-size: 10px;
  color: #6a5a7a;
  font-style: italic;
}
.kp-layout-config-panel .kp-cfg-key-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  justify-content: stretch;
  width: 100%;
  margin: 0;
  padding: 0;
}
.kp-layout-config-panel .kp-cfg-main.kp-cfg-inspector-open .kp-cfg-key-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.kp-layout-config-panel .kp-cfg-key-grid.kp-cfg-grid-macros {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.kp-layout-config-panel .kp-cfg-main.kp-cfg-inspector-open .kp-cfg-key-grid.kp-cfg-grid-macros {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.kp-layout-config-panel .kp-cfg-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 7px;
  min-width: 0;
  padding: 5px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: 1px solid #3a3a3a;
  background: linear-gradient(180deg, #2a2e32, #24282c);
  box-shadow: inset 0 1px 0 rgba(140,170,200,0.08);
  box-sizing: border-box;
  cursor: default;
}
.kp-layout-config-panel .kp-cfg-item.kp-cfg-variant-stock-fn,
.kp-layout-config-panel .kp-cfg-item.kp-cfg-variant-configurable-fn {
  background: linear-gradient(180deg, #2a2e32, #24282c);
  border-color: #3a4550;
}
.kp-layout-config-panel .kp-cfg-item.kp-cfg-variant-stock-macro {
  background: linear-gradient(180deg, #243430, #1c2824);
  border-color: #3a5a50;
  border-left: 3px solid #5a9a8a;
}
.kp-layout-config-panel .kp-cfg-item.kp-cfg-variant-user-macro {
  background: linear-gradient(180deg, #2c2434, #221c28);
  border-color: #4a3a5a;
  border-left: 3px solid #9a7ab8;
  box-shadow: inset 0 1px 0 rgba(154,122,184,0.15);
}
.kp-layout-config-panel .kp-cfg-item.kp-cfg-variant-macro-key {
  background: #282828;
  border-color: #3a3a3a;
}
.kp-layout-config-panel .kp-cfg-item.kp-cfg-variant-stock-macro .key {
  background: linear-gradient(180deg, #3a5a50, #2a4038);
  color: #c8ebe0;
}
.kp-layout-config-panel .kp-cfg-item.kp-cfg-variant-user-macro .key {
  background: linear-gradient(180deg, #5a4a6a, #3a3048);
  color: #e0d0f0;
}
.kp-layout-config-panel .kp-cfg-item.kp-cfg-variant-user-macro .kp-cfg-card-name {
  color: #d8c8e8;
  font-style: italic;
}
.kp-layout-config-panel .kp-cfg-item:hover {
  border-color: #4a5560;
  background: linear-gradient(180deg, #30363c, #282c32);
}
.kp-layout-config-panel .kp-cfg-item.kp-place-source-item {
  border-color: ${c.accent};
  box-shadow: 0 0 0 1px ${accentA(0.4)};
}
.kp-layout-config-panel .kp-cfg-item.kp-cfg-item-inspecting {
  border-color: ${c.accent};
  background: ${NCT_DARK_UI_SELECTED_TINT};
}
.kp-layout-config-panel .kp-cfg-card-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
}
.kp-layout-config-panel .kp-cfg-card-name {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.25;
  color: #d8e4f0;
  word-break: break-word;
}
.kp-layout-config-panel .kp-cfg-card-sub {
  font-size: 10px;
  opacity: 0.65;
  line-height: 1.25;
  word-break: break-word;
}
.kp-layout-config-panel .kp-cfg-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
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
  border-radius: 7px !important;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .key.kp-place-source {
  outline: 2px solid ${c.accent};
  outline-offset: -1px;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .key > .key-bg-icon {
  inset: 10%;
  -webkit-mask-size: 78% 78%;
  mask-size: 78% 78%;
  opacity: 0.88;
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
  font-size: 11px !important;
  line-height: 1.15 !important;
  text-transform: none;
}
.kp-layout-config-panel [data-kp-layout-list].${KEYBINDINGS_UI_ROOT_CLASS} .key .key-main .kp-cfg-label-line {
  display: block;
}
.kp-layout-config-panel .kp-cfg-inspect {
  flex: 0 0 auto;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 6px;
  height: 18px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: ${NCT_DARK_UI_BTN_BORDER};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${c.fg};
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  font-family: inherit;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}
.kp-layout-config-panel .kp-cfg-inspect .kp-cfg-ico {
  width: 10px;
  height: 10px;
}
.kp-layout-config-panel .kp-cfg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 8px;
  height: 22px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: ${NCT_DARK_UI_BTN_BORDER};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${c.fg};
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  font-family: inherit;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}
.kp-layout-config-panel .kp-cfg-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.kp-layout-config-panel .kp-cfg-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, #545454 0%, #3c3c3c 50%, #323232 100%);
}
.kp-layout-config-panel .kp-cfg-btn.kp-cfg-btn-lit,
.kp-layout-config-panel .kp-cfg-btn[aria-pressed="true"] {
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  color: ${NCT_DARK_UI_SELECTED_TEXT};
  box-shadow: inset 0 1px 0 rgba(200,220,240,0.18);
}
.kp-layout-config-panel .kp-cfg-field {
  width: 100%;
  padding: 4px 8px;
  height: 22px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: ${NCT_DARK_UI_FIELD_BORDER};
  background: ${NCT_DARK_UI_FIELD_BACKGROUND};
  color: ${c.fg};
  outline: none;
  font-size: 11px;
  font-family: inherit;
  box-sizing: border-box;
  box-shadow: ${NCT_DARK_UI_FIELD_BOX_SHADOW};
}
.kp-layout-config-panel .kp-cfg-field:focus {
  border-color: ${NCT_DARK_UI_FIELD_FOCUS_BORDER};
  box-shadow: ${NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW};
}
.kp-layout-config-panel select.kp-cfg-field {
  padding-right: 20px;
}
.kp-layout-config-panel .kp-mk-kind-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  margin-bottom: 8px;
}
@media (max-width: 900px) {
  .kp-layout-config-panel .kp-mk-kind-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.kp-layout-config-panel .kp-mk-kind-btn {
  text-align: left;
  padding: 8px 9px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: 1px solid #4a3a5a;
  background: linear-gradient(180deg, #2c2434, #221c28);
  color: #e0d0f0;
  cursor: pointer;
  font-size: 11px;
  line-height: 1.3;
  font-family: inherit;
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
  border-color: #9a7ab8;
  background: linear-gradient(180deg, #342a40, #281e30);
}
.kp-layout-config-panel .kp-mk-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: 1px solid #2a4058;
  background: rgba(25, 40, 55, 0.35);
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
  color: #7a92a8;
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
.kp-cfg-btn[data-capturing="true"] {
  background: #ffb020 !important;
  color: #221a05 !important;
  border-color: #ffb020 !important;
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
  padding: 1px 5px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: 1px solid #8a6040;
  background: #5a4030;
  color: #ffcf9e;
  white-space: nowrap;
  align-self: flex-start;
}
.kp-cfg-badge.kp-cfg-badge-stock {
  border-color: #3a5a50;
  background: #243430;
  color: #5a9a8a;
}
.kp-cfg-badge.kp-cfg-badge-user {
  border-color: #5a4a6a;
  background: #2c2434;
  color: #9a7ab8;
}
.kp-layout-config-panel .kp-cfg-pane-inspector {
  flex: 0 0 auto;
  width: var(--kp-cfg-inspector-width);
  min-width: var(--kp-cfg-inspector-width);
  background:
    linear-gradient(180deg, rgba(50, 80, 110, 0.22), rgba(25, 40, 55, 0.12)),
    #161a20;
  border-color: #2a4058;
  box-shadow:
    0 0 0 1px rgba(140, 190, 230, 0.3),
    0 0 14px rgba(80, 140, 190, 0.14),
    inset 0 1px 0 rgba(190, 220, 255, 0.2),
    inset 0 0 0 1px rgba(90, 140, 180, 0.18);
}
.kp-layout-config-panel .kp-cfg-pane-inspector.kp-cfg-collapsed {
  width: 22px;
  min-width: 22px;
}
.kp-layout-config-panel .kp-cfg-inspector-rail {
  display: none;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  background: linear-gradient(180deg, #3a5068, #2a3c50);
  color: #c0d4e8;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  writing-mode: vertical-rl;
  padding: 8px 0;
  font-family: inherit;
}
.kp-layout-config-panel .kp-cfg-inspector-rail:hover {
  background: linear-gradient(180deg, #4a6080, #364a62);
  color: #e8f4ff;
}
.kp-layout-config-panel .kp-cfg-pane-inspector.kp-cfg-collapsed .kp-cfg-inspector-rail {
  display: flex;
}
.kp-layout-config-panel .kp-cfg-pane-inspector.kp-cfg-collapsed .kp-cfg-inspector-expanded {
  display: none;
}
.kp-layout-config-panel .kp-cfg-inspector-expanded {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}
.kp-layout-config-panel .kp-cfg-pane-inspector .kp-cfg-pane-hdr {
  background: linear-gradient(180deg, #3a5068, #2a3c50);
  color: #c0d4e8;
  border-bottom-color: #152230;
}
.kp-layout-config-panel .kp-cfg-pane-inspector .kp-cfg-pane-title {
  color: #c0d4e8;
}
.kp-layout-config-panel .kp-cfg-dock-empty {
  font-size: 11px;
  opacity: 0.65;
  line-height: 1.4;
  margin: 0;
  color: #8a9aaa;
}
.kp-layout-config-panel .kp-cfg-dock-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 2px;
  word-break: break-word;
  color: #d8e4f0;
}
.kp-layout-config-panel .kp-cfg-dock-subtitle {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #7a92a8;
  margin: 8px 0 4px;
}
.kp-layout-config-panel .kp-cfg-dock-rows {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 8px;
  font-size: 10px;
  margin: 0 0 6px;
}
.kp-layout-config-panel .kp-cfg-dock-rows dt {
  color: #7a92a8;
  white-space: nowrap;
}
.kp-layout-config-panel .kp-cfg-dock-rows dd {
  margin: 0;
  color: #d8e4f0;
  word-break: break-word;
}
.kp-layout-config-panel .kp-cfg-dock-steps {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.kp-layout-config-panel .kp-cfg-dock-steps li {
  display: flex;
  gap: 6px;
  font-size: 10px;
  padding: 3px 5px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: rgba(255,255,255,0.04);
}
.kp-layout-config-panel .kp-cfg-dock-steps .kp-cfg-dock-step-idx {
  opacity: 0.5;
  min-width: 12px;
}
.kp-layout-config-panel .kp-cfg-dock-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.kp-layout-config-panel .kp-cfg-create-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
  padding: 8px;
  gap: 8px;
  overflow: auto;
}
.kp-layout-config-panel .kp-cfg-pane-create {
  flex: 0 0 auto;
  background:
    linear-gradient(180deg, rgba(90, 60, 120, 0.18), rgba(50, 35, 70, 0.08)),
    #1a161e;
  border-color: #4a3a5a;
  box-shadow:
    0 0 0 1px rgba(180, 140, 220, 0.28),
    0 0 14px rgba(120, 80, 160, 0.12),
    inset 0 1px 0 rgba(220, 190, 255, 0.14),
    inset 0 0 0 1px rgba(140, 100, 180, 0.14);
}
.kp-layout-config-panel .kp-cfg-pane-create .kp-cfg-pane-hdr {
  background: linear-gradient(180deg, #4a3a58, #342844);
  color: #d8c8e8;
  border-bottom-color: #1a1220;
}
.kp-layout-config-panel .kp-cfg-pane-create .kp-cfg-pane-title {
  color: #d8c8e8;
}
.kp-layout-config-panel .kp-cfg-pane-create.kp-cfg-open {
  flex: 0 0 var(--kp-cfg-create-height);
  min-height: 210px;
}
.kp-layout-config-panel .kp-cfg-pane-create:not(.kp-cfg-open) .kp-cfg-create-body {
  display: none;
}
.kp-layout-config-panel .kp-cfg-split {
  position: relative;
  z-index: 2;
  flex: 0 0 8px;
  padding: 0;
  border: 0;
  background: #1a1a1a;
}
.kp-layout-config-panel .kp-cfg-split::after {
  content: "";
  position: absolute;
  inset: -3px;
}
.kp-layout-config-panel .kp-cfg-split::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: #6a6a6a;
  border-radius: 1px;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
}
.kp-layout-config-panel .kp-cfg-split:hover,
.kp-layout-config-panel .kp-cfg-split:focus-visible,
.kp-layout-config-panel .kp-cfg-split.kp-cfg-split-dragging {
  outline: none;
  background: #3a5570;
}
.kp-layout-config-panel .kp-cfg-split:hover::before,
.kp-layout-config-panel .kp-cfg-split:focus-visible::before,
.kp-layout-config-panel .kp-cfg-split.kp-cfg-split-dragging::before {
  background: #b0d0e8;
}
.kp-layout-config-panel .kp-cfg-split-v {
  cursor: col-resize;
  border-left: 1px solid #0a0a0a;
  border-right: 1px solid #3a3a3a;
  background: linear-gradient(90deg, #2a2a2a, #1c1c1c);
}
.kp-layout-config-panel .kp-cfg-split-v::before {
  width: 2px;
  height: 36px;
}
.kp-layout-config-panel .kp-cfg-split-h {
  cursor: row-resize;
  border-top: 1px solid #0a0a0a;
  border-bottom: 1px solid #3a3a3a;
  background: linear-gradient(180deg, #2a2a2a, #1c1c1c);
}
.kp-layout-config-panel .kp-cfg-split-h::before {
  width: 36px;
  height: 2px;
}
.kp-layout-config-panel .kp-cfg-script-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.kp-layout-config-panel .kp-cfg-script-toolbar .kp-cfg-macro-name {
  width: auto;
  flex: 1 1 140px;
  min-width: 110px;
  max-width: 220px;
}
.kp-layout-config-panel .kp-cfg-stock-banner {
  font-size: 10px;
  line-height: 1.35;
  padding: 5px 7px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: 1px solid rgba(120,150,255,0.4);
  background: rgba(120,150,255,0.12);
  color: #cdd8ff;
}
.kp-layout-config-panel .kp-cfg-script-canvas {
  display: flex;
  flex-direction: row;
  gap: 0;
  align-items: stretch;
  min-height: 88px;
  overflow: hidden;
  border: 1px solid #3a2a4a;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(20, 14, 28, 0.65), rgba(14, 10, 20, 0.9));
  box-shadow: inset 0 1px 0 rgba(154, 122, 184, 0.08);
}
.kp-layout-config-panel .kp-cfg-logic-palette {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 0 0 132px;
  width: 132px;
  min-width: 120px;
  max-width: 140px;
  margin: 6px 0 6px 6px;
  padding: 10px 6px 6px;
  border: 1px solid rgba(154, 122, 184, 0.12);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.22);
  overflow: auto;
}
.kp-layout-config-panel .kp-cfg-logic-palette > legend {
  padding: 0 5px;
  margin-left: 2px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a88b0;
}
.kp-layout-config-panel .kp-cfg-logic-chip {
  text-align: left;
  padding: 5px 6px;
  border-radius: 2px;
  border: 1px solid #3a3048;
  background: linear-gradient(180deg, #2a2234, #221c2c);
  color: #ddd0e8;
  cursor: pointer;
  line-height: 1.25;
  font-family: inherit;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.kp-layout-config-panel .kp-cfg-logic-chip:hover {
  border-color: #9a7ab8;
  color: #f0e8f8;
}
.kp-layout-config-panel .kp-cfg-logic-chip strong {
  display: block;
  font-size: 9px;
  font-weight: 700;
  color: #e8d8f8;
}
.kp-layout-config-panel .kp-cfg-logic-chip span {
  display: block;
  font-size: 7px;
  color: #8a7a9a;
  opacity: 1;
}
.kp-layout-config-panel .kp-cfg-steps-pane {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow: auto;
  padding: 6px;
}
.kp-layout-config-panel .kp-cfg-script-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1 1 auto;
  min-height: 88px;
  padding: 12px;
  text-align: center;
  color: #7a6a8a;
  font-size: 10px;
  line-height: 1.4;
  box-sizing: border-box;
}
.kp-layout-config-panel .kp-cfg-script-empty strong {
  color: #b8a0d0;
  font-size: 11px;
  font-weight: 700;
}
.kp-layout-config-panel .kp-cfg-cycle-warn {
  margin: 6px 0 0;
  padding: 5px 7px;
  border-radius: 2px;
  border: 1px solid rgba(200, 120, 80, 0.45);
  background: rgba(80, 40, 20, 0.35);
  color: #f0c090;
  font-size: 10px;
  line-height: 1.35;
}
.kp-layout-config-panel .kp-cfg-pane-create.kp-cfg-maximized {
  flex: 1 1 auto !important;
  min-height: 0;
}
.kp-layout-config-panel .kp-cfg-workspace.kp-cfg-create-maximized .kp-cfg-pane-library .kp-cfg-pane-scroll {
  display: none;
}
.kp-layout-config-panel .kp-cfg-workspace.kp-cfg-create-maximized .kp-cfg-pane-library {
  flex: 0 0 auto;
}
.kp-layout-config-panel .kp-cfg-hdr-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  margin-left: auto;
}
.kp-layout-config-panel .kp-cfg-step {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 5px 6px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: 1px solid #3a3a3a;
  background: #222;
}
.kp-layout-config-panel .kp-cfg-step.kp-cfg-step-selected {
  border-color: ${c.accent};
  background: ${NCT_DARK_UI_SELECTED_TINT};
}
.kp-layout-config-panel .kp-cfg-step-idx {
  opacity: 0.5;
  font-size: 10px;
  min-width: 13px;
}
.kp-layout-config-panel .kp-cfg-step-label {
  font-size: 11px;
  font-weight: 600;
  flex: 1 1 110px;
  min-width: 90px;
  word-break: break-word;
}
.kp-layout-config-panel .kp-cfg-step-sub {
  display: block;
  font-size: 9px;
  font-weight: 400;
  opacity: 0.6;
}
.kp-layout-config-panel .kp-cfg-step-fields {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.kp-layout-config-panel .kp-cfg-step-fields label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  opacity: 0.8;
}
.kp-layout-config-panel .kp-cfg-step-fields .kp-cfg-field {
  width: auto;
  padding: 2px 5px;
  height: 18px;
  font-size: 10px;
}
.kp-layout-config-panel .kp-cfg-step-fields input[type="number"].kp-cfg-field {
  width: 62px;
}
.kp-layout-config-panel .kp-cfg-step-fields input[type="text"].kp-cfg-field {
  width: 80px;
}
.kp-layout-config-panel .kp-cfg-step-ops {
  display: inline-flex;
  gap: 3px;
  margin-left: auto;
}
.kp-layout-config-panel .kp-cfg-step-ops .kp-cfg-btn {
  padding: 0 6px;
  height: 18px;
}
.kp-layout-config-panel .kp-cfg-hint {
  font-size: 10px;
  color: ${c.fgMute};
  line-height: 1.35;
}
`.trim().replaceAll('.kp-layout-config-panel', ':host');
  }

  _applyProChrome(root) {
    if (!root || !root.style) return;
    const savedWidth = Number(this._panelPosition?.width);
    const savedHeight = Number(this._panelPosition?.height);
    Object.assign(root.style, {
      position: 'fixed',
      width: `${Number.isFinite(savedWidth) && savedWidth > 0 ? savedWidth : CONFIG_PANEL_WIDTH_PX}px`,
      ...(Number.isFinite(savedHeight) && savedHeight > 0 ? { height: `${savedHeight}px` } : {}),
      maxWidth: `calc(100vw - ${CONFIG_POSITION_MARGIN_PX * 2}px)`,
      maxHeight: `calc(100vh - ${CONFIG_POSITION_MARGIN_PX * 2}px)`,
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
      zIndex: String(Z_INDEX.KEYBOARD_LAYOUT_CONFIG),
      background: NCT_DARK_UI_PANEL_BACKGROUND,
      color: NCT_DARK_UI_COLORS.fg,
      border: NCT_DARK_UI_PANEL_BORDER,
      borderRadius: NCT_DARK_UI_PANEL_RADIUS,
      boxShadow: NCT_DARK_UI_PANEL_BOX_SHADOW,
      fontFamily: NCT_DARK_UI_FONT
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
        this._panelPosition = { ...this._panelPosition, left: resolved.left, top: resolved.top, anchor: null };
      } else if (resolved?.anchor) {
        this._panelPosition = { ...this._panelPosition, left: resolved.left, top: resolved.top, anchor: resolved.anchor };
      }
    } catch { /* ignore */ }
  }

  async _persistPosition(next) {
    const normalized = normalizePanelPositionState(
      next,
      DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig
    ) || { ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig };
    this._panelPosition = {
      ...this._panelPosition,
      left: normalized.left,
      top: normalized.top,
      anchor: normalized.anchor === undefined ? null : normalized.anchor,
      ...(Number.isFinite(Number(next?.width)) && Number(next.width) > 0 ? { width: Number(next.width) } : {}),
      ...(Number.isFinite(Number(next?.height)) && Number(next.height) > 0 ? { height: Number(next.height) } : {})
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
    const root = doc.createElement('div');
    root.className = 'kp-layout-config-panel';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Keyboard layout configuration');
    root.hidden = true;
    this._applyProChrome(root);
    const shadowRoot = ensureOpenChromeShadow(root, { id: 'keyboard-layout-config' });
    if (!shadowRoot) return;
    this._ensureStylesInjected(doc, shadowRoot);

    // Titlebar — NCT bevel chrome (classes; no inline cyan/soft styling)
    const header = doc.createElement('div');
    header.className = 'kp-cfg-titlebar';
    header.title = 'Drag to move';

    const title = doc.createElement('div');
    title.className = 'kp-cfg-title';
    title.appendChild(mkCfgIcon(doc, 'kp-cfg-i-kb'));
    const titleText = doc.createElement('span');
    titleText.textContent = 'Keyboard Layout Config';
    title.appendChild(titleText);

    const saveCloseBtn = doc.createElement('button');
    saveCloseBtn.type = 'button';
    saveCloseBtn.className = 'kp-cfg-save-close';
    saveCloseBtn.setAttribute('data-kp-cfg-save-close', 'true');
    saveCloseBtn.setAttribute('aria-label', 'Save and close layout config');
    saveCloseBtn.title = 'Save layout changes and exit edit mode';
    saveCloseBtn.textContent = 'Save and Close';
    saveCloseBtn.addEventListener('click', (e) => {
      try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch { /* ignore */ }
      void this._saveAndClose();
    }, true);

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kp-cfg-close';
    closeBtn.setAttribute('aria-label', 'Close layout config');
    closeBtn.title = 'Close';
    closeBtn.appendChild(mkCfgIcon(doc, 'kp-cfg-i-close'));
    closeBtn.addEventListener('click', () => {
      this.hide();
      try { this._onClose?.(); } catch { /* ignore */ }
    }, true);

    const titleStart = doc.createElement('div');
    titleStart.className = 'kp-cfg-titlebar-start';
    titleStart.appendChild(title);
    titleStart.appendChild(saveCloseBtn);

    header.appendChild(titleStart);
    header.appendChild(closeBtn);

    const body = doc.createElement('div');
    body.className = 'kp-cfg-body';

    const mkBtn = (text, action) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'kp-cfg-btn';
      b.textContent = text;
      if (action) b.dataset.kpCfgAction = action;
      return b;
    };
    const mkStripLabel = (text) => {
      const el = doc.createElement('span');
      el.className = 'kp-cfg-strip-label';
      el.textContent = text;
      return el;
    };
    const mkToolGroup = (label) => {
      const g = doc.createElement('div');
      g.className = 'kp-cfg-tool-group';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', label);
      return g;
    };
    const mkSep = () => {
      const s = doc.createElement('span');
      s.className = 'kp-cfg-tool-sep';
      s.setAttribute('aria-hidden', 'true');
      return s;
    };
    const mkSpacer = () => {
      const s = doc.createElement('span');
      s.className = 'kp-cfg-spacer';
      return s;
    };

    const mkIconBtn = (action, title, iconId) => {
      const b = mkBtn('', action);
      b.classList.add('kp-cfg-btn-icon');
      b.title = title;
      b.setAttribute('aria-label', title);
      b.appendChild(mkCfgIcon(doc, iconId));
      return b;
    };

    // ---- Layout strip (single-row: combo + icon tools + primary) -------------------------
    const strip = doc.createElement('div');
    strip.className = 'kp-cfg-strip';

    const layoutStrip = doc.createElement('div');
    layoutStrip.className = 'kp-cfg-layout-strip';

    const identity = doc.createElement('div');
    identity.className = 'kp-cfg-layout-identity';

    const layoutLabel = doc.createElement('label');
    layoutLabel.className = 'kp-cfg-strip-label';
    layoutLabel.setAttribute('for', 'kp-cfg-layout-combo-input');
    layoutLabel.textContent = 'Layout';

    const layoutCombo = doc.createElement('div');
    layoutCombo.className = 'kp-cfg-layout-combo';

    const layoutComboInput = doc.createElement('input');
    layoutComboInput.id = 'kp-cfg-layout-combo-input';
    layoutComboInput.className = 'kp-cfg-field kp-cfg-combo-input';
    layoutComboInput.type = 'text';
    layoutComboInput.autocomplete = 'off';
    layoutComboInput.setAttribute('role', 'combobox');
    layoutComboInput.setAttribute('aria-autocomplete', 'list');
    layoutComboInput.setAttribute('aria-expanded', 'false');
    layoutComboInput.setAttribute('aria-controls', 'kp-cfg-layout-combo-list');
    layoutComboInput.setAttribute('aria-label', 'Layout');
    layoutComboInput.title = 'Select or rename layout';

    const currentBadge = doc.createElement('span');
    currentBadge.className = 'kp-cfg-combo-current-badge';
    currentBadge.appendChild(mkCfgIcon(doc, 'kp-cfg-i-check'));
    currentBadge.appendChild(doc.createTextNode('Current'));
    currentBadge.hidden = true;
    currentBadge.setAttribute('aria-hidden', 'true');

    const layoutComboToggle = doc.createElement('button');
    layoutComboToggle.type = 'button';
    layoutComboToggle.className = 'kp-cfg-combo-toggle';
    layoutComboToggle.title = 'Show layouts';
    layoutComboToggle.setAttribute('aria-label', 'Show layouts');
    layoutComboToggle.tabIndex = -1;
    layoutComboToggle.appendChild(mkCfgIcon(doc, 'kp-cfg-i-chevron'));

    const layoutComboList = doc.createElement('ul');
    layoutComboList.id = 'kp-cfg-layout-combo-list';
    layoutComboList.className = 'kp-cfg-combo-list';
    layoutComboList.setAttribute('role', 'listbox');
    layoutComboList.hidden = true;

    layoutCombo.appendChild(layoutComboInput);
    layoutCombo.appendChild(currentBadge);
    layoutCombo.appendChild(layoutComboToggle);
    layoutCombo.appendChild(layoutComboList);

    const setCurrentBtn = mkBtn('Set current', 'set-current');
    setCurrentBtn.title = 'Set as current layout';

    identity.appendChild(layoutLabel);
    identity.appendChild(layoutCombo);
    identity.appendChild(setCurrentBtn);

    const tools = doc.createElement('div');
    tools.className = 'kp-cfg-layout-tools';
    tools.setAttribute('aria-label', 'Layout actions');

    const editGroup = mkToolGroup('Edit');
    const newBtn = mkIconBtn('new', 'New layout', 'kp-cfg-i-plus');
    const duplicateBtn = mkIconBtn('duplicate', 'Duplicate layout', 'kp-cfg-i-copy');
    const deleteBtn = mkIconBtn('delete', 'Delete layout', 'kp-cfg-i-trash');
    editGroup.appendChild(newBtn);
    editGroup.appendChild(duplicateBtn);
    editGroup.appendChild(deleteBtn);

    const transferGroup = mkToolGroup('Transfer');
    const importBtn = mkIconBtn('import', 'Import layout', 'kp-cfg-i-import');
    const exportBtn = mkIconBtn('export', 'Export layout', 'kp-cfg-i-export');
    transferGroup.appendChild(importBtn);
    transferGroup.appendChild(exportBtn);

    tools.appendChild(editGroup);
    tools.appendChild(mkSep());
    tools.appendChild(transferGroup);

    const primary = doc.createElement('div');
    primary.className = 'kp-cfg-layout-primary';

    const refToggleBtn = mkBtn('Keyboard Reference', 'toggle-reference');
    refToggleBtn.title = 'Show/hide the Keyboard Reference window (the place/drop target)';
    refToggleBtn.setAttribute('aria-pressed', 'false');
    refToggleBtn.prepend(mkCfgIcon(doc, 'kp-cfg-i-kb'));

    const optsWrap = doc.createElement('div');
    optsWrap.className = 'kp-cfg-opts-wrap';
    const optsBtn = mkIconBtn('layout-opts', 'Layout options', 'kp-cfg-i-more');
    optsBtn.setAttribute('aria-haspopup', 'true');
    optsBtn.setAttribute('aria-expanded', 'false');
    optsBtn.setAttribute('aria-controls', 'kp-cfg-layout-opts-menu');

    const optsMenu = doc.createElement('div');
    optsMenu.id = 'kp-cfg-layout-opts-menu';
    optsMenu.className = 'kp-cfg-opts-menu';
    optsMenu.setAttribute('role', 'menu');
    optsMenu.hidden = true;

    const numRowLabel = doc.createElement('label');
    numRowLabel.className = 'kp-cfg-opts-check';
    numRowLabel.setAttribute('role', 'menuitemcheckbox');
    const showNumRowToggle = doc.createElement('input');
    showNumRowToggle.type = 'checkbox';
    const numRowText = doc.createElement('span');
    numRowText.textContent = 'Show number row';
    numRowLabel.appendChild(showNumRowToggle);
    numRowLabel.appendChild(numRowText);
    optsMenu.appendChild(numRowLabel);

    optsWrap.appendChild(optsBtn);
    optsWrap.appendChild(optsMenu);

    primary.appendChild(refToggleBtn);
    primary.appendChild(optsWrap);

    const importFile = doc.createElement('input');
    importFile.type = 'file';
    importFile.accept = 'application/json,.json';
    importFile.hidden = true;

    layoutStrip.appendChild(identity);
    layoutStrip.appendChild(tools);
    layoutStrip.appendChild(primary);

    const hint = doc.createElement('div');
    hint.className = 'kp-cfg-hint kp-cfg-strip-hint';
    hint.textContent = 'Click a keycap in the Actions Library, then click a Keyboard Reference key to place it. ' +
      'Functions marked "Needs modifier" must use "Bind modifier combo" instead — they run while a text field is focused.';

    strip.appendChild(layoutStrip);
    strip.appendChild(hint);
    strip.appendChild(importFile);

    // ---- Main row: Actions Library + User Macros | Inspector ----------------------------
    const mainRow = doc.createElement('div');
    mainRow.className = 'kp-cfg-main';

    const workspace = doc.createElement('div');
    workspace.className = 'kp-cfg-workspace';

    const libraryPane = doc.createElement('section');
    libraryPane.className = 'kp-cfg-pane kp-cfg-pane-library';
    libraryPane.setAttribute('aria-label', 'Actions Library');

    const libraryHdr = doc.createElement('div');
    libraryHdr.className = 'kp-cfg-pane-hdr';
    const libraryTitle = doc.createElement('span');
    libraryTitle.className = 'kp-cfg-pane-title';
    libraryTitle.appendChild(mkCfgIcon(doc, 'kp-cfg-i-lib'));
    libraryTitle.appendChild(doc.createTextNode('Actions Library'));

    const searchWrap = doc.createElement('div');
    searchWrap.className = 'kp-cfg-search-wrap';
    searchWrap.appendChild(mkCfgIcon(doc, 'kp-cfg-i-search'));
    const search = doc.createElement('input');
    search.type = 'search';
    search.className = 'kp-cfg-field kp-cfg-search';
    search.placeholder = 'Search…';
    searchWrap.appendChild(search);

    const libTabs = doc.createElement('div');
    libTabs.className = 'kp-cfg-seg';
    libTabs.setAttribute('role', 'tablist');
    libTabs.setAttribute('aria-label', 'Library filter');

    const fnCategorySelect = doc.createElement('select');
    fnCategorySelect.className = 'kp-cfg-field kp-cfg-fn-cat';
    fnCategorySelect.setAttribute('aria-label', 'Function category');
    fnCategorySelect.hidden = true;

    libraryHdr.appendChild(libraryTitle);
    libraryHdr.appendChild(searchWrap);
    libraryHdr.appendChild(libTabs);
    libraryHdr.appendChild(fnCategorySelect);

    const list = doc.createElement('div');
    list.setAttribute('data-kp-layout-list', 'true');
    list.className = `${KEYBINDINGS_UI_ROOT_CLASS} kp-cfg-pane-scroll`;
    Object.assign(list.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      flex: '1 1 auto',
      minHeight: '120px',
      overflow: 'auto'
    });

    const viewBar = doc.createElement('div');
    viewBar.className = 'kp-cfg-lib-viewbar';
    viewBar.setAttribute('aria-label', 'Actions Library view');

    const viewSeg = doc.createElement('div');
    viewSeg.className = 'kp-cfg-seg';
    viewSeg.setAttribute('role', 'tablist');
    viewSeg.setAttribute('aria-label', 'Library layout');
    for (const mode of [
      { id: 'cards', label: 'Cards' },
      { id: 'table', label: 'Table' }
    ]) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'kp-cfg-seg-btn';
      b.setAttribute('role', 'tab');
      b.dataset.kpLibView = mode.id;
      b.textContent = mode.label;
      b.addEventListener('click', () => {
        this._libViewMode = /** @type {'cards'|'table'} */ (mode.id);
        this._syncLibViewSeg();
        this._renderRightList();
      }, true);
      viewSeg.appendChild(b);
    }

    const legendMini = doc.createElement('div');
    legendMini.className = 'kp-cfg-legend-mini';
    legendMini.title = 'Card / row color meaning';
    for (const [swClass, text] of [
      ['kp-cfg-sw-stock-fn', 'Stock function'],
      ['kp-cfg-sw-user', 'Configurable'],
      ['kp-cfg-sw-stock-macro', 'Stock macro'],
      ['kp-cfg-sw-user-macro', 'User macro']
    ]) {
      const span = doc.createElement('span');
      const sw = doc.createElement('i');
      sw.className = swClass;
      span.appendChild(sw);
      span.appendChild(doc.createTextNode(text));
      legendMini.appendChild(span);
    }

    viewBar.appendChild(viewSeg);
    viewBar.appendChild(legendMini);

    libraryPane.appendChild(libraryHdr);
    libraryPane.appendChild(list);
    list.appendChild(viewBar);

    const createPane = doc.createElement('aside');
    createPane.className = 'kp-cfg-pane kp-cfg-pane-create';
    createPane.setAttribute('aria-label', 'User Macros');

    const createHdr = doc.createElement('div');
    createHdr.className = 'kp-cfg-pane-hdr';
    const createTitle = doc.createElement('span');
    createTitle.className = 'kp-cfg-pane-title';
    createTitle.appendChild(mkCfgIcon(doc, 'kp-cfg-i-create'));
    createTitle.appendChild(doc.createTextNode('User Macros'));

    const createModeSeg = doc.createElement('div');
    createModeSeg.className = 'kp-cfg-seg';
    createModeSeg.setAttribute('role', 'tablist');
    createModeSeg.setAttribute('aria-label', 'User Macros mode');
    for (const mode of [{ id: 'script', label: 'Macro Script' }, { id: 'macroKey', label: 'Macro Key' }]) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'kp-cfg-seg-btn';
      b.setAttribute('role', 'tab');
      b.dataset.kpCreateMode = mode.id;
      b.textContent = mode.label;
      b.addEventListener('click', () => this._setCreateMode(mode.id, { open: true }), true);
      createModeSeg.appendChild(b);
    }

    const createToggleBtn = mkBtn('Expand', 'toggle-create');
    createToggleBtn.title = 'Show/hide the User Macros builder';
    createToggleBtn.prepend(mkCfgIcon(doc, 'kp-cfg-i-expand'));

    const expandUpBtn = mkBtn('Expand up', 'expand-create-up');
    expandUpBtn.classList.add('kp-cfg-btn-expand-up');
    expandUpBtn.title = 'Expand upward to the Actions Library titlebar';
    expandUpBtn.hidden = true;
    expandUpBtn.prepend(mkCfgIcon(doc, 'kp-cfg-i-expand-up'));

    const createHdrActions = doc.createElement('span');
    createHdrActions.className = 'kp-cfg-hdr-actions';
    createHdrActions.appendChild(expandUpBtn);
    createHdrActions.appendChild(createToggleBtn);

    createHdr.appendChild(createTitle);
    createHdr.appendChild(createModeSeg);
    createHdr.appendChild(createHdrActions);
    createHdr.setAttribute('role', 'button');
    createHdr.tabIndex = 0;
    createHdr.setAttribute('aria-expanded', 'false');
    createHdr.title = 'Expand User Macros';
    createHdr.addEventListener('click', (e) => {
      if (e.target?.closest?.('button, .kp-cfg-seg, [data-kp-create-mode]')) return;
      this._setCreateOpen(!this._createOpen);
    }, true);
    createHdr.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target !== createHdr) return;
      e.preventDefault();
      this._setCreateOpen(!this._createOpen);
    }, true);

    const createBody = doc.createElement('div');
    createBody.className = 'kp-cfg-create-body';

    // Macro Script builder
    const scriptPanel = doc.createElement('div');
    Object.assign(scriptPanel.style, { display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '0' });

    const scriptToolbar = doc.createElement('div');
    scriptToolbar.className = 'kp-cfg-script-toolbar';
    const macroNameInput = doc.createElement('input');
    macroNameInput.type = 'text';
    macroNameInput.className = 'kp-cfg-field kp-cfg-macro-name';
    macroNameInput.placeholder = 'Macro name';
    const newMacroBtn = mkBtn('New Macro', 'macro-new');
    const saveMacroBtn = mkBtn('Save', 'macro-save');
    saveMacroBtn.classList.add('kp-cfg-btn-lit');
    saveMacroBtn.prepend(mkCfgIcon(doc, 'kp-cfg-i-check'));
    const placeMacroBtn = mkBtn('Place', 'macro-place');
    placeMacroBtn.prepend(mkCfgIcon(doc, 'kp-cfg-i-place'));
    const runMacroBtn = mkBtn('Run', 'macro-run');
    scriptToolbar.appendChild(mkStripLabel('Macro'));
    scriptToolbar.appendChild(macroNameInput);
    scriptToolbar.appendChild(newMacroBtn);
    scriptToolbar.appendChild(saveMacroBtn);
    scriptToolbar.appendChild(placeMacroBtn);
    scriptToolbar.appendChild(runMacroBtn);

    const stockBanner = doc.createElement('div');
    stockBanner.className = 'kp-cfg-stock-banner';
    stockBanner.textContent = 'Stock macro — Save creates your editable copy. The original stays unchanged.';
    stockBanner.hidden = true;

    const scriptCanvas = doc.createElement('div');
    scriptCanvas.className = 'kp-cfg-script-canvas';

    const logicPalette = doc.createElement('fieldset');
    logicPalette.className = 'kp-cfg-logic-palette';
    logicPalette.setAttribute('aria-label', 'Logic steps');
    const logicLegend = doc.createElement('legend');
    logicLegend.textContent = 'Logic';
    logicPalette.appendChild(logicLegend);
    for (const def of MACRO_LOGIC_DEFS) {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'kp-cfg-logic-chip';
      chip.dataset.kpLogicKind = def.kind;
      const strong = doc.createElement('strong');
      strong.textContent = def.label;
      const span = doc.createElement('span');
      span.textContent = def.description;
      chip.appendChild(strong);
      chip.appendChild(span);
      chip.addEventListener('click', () => this._addDraftLogicStep(def.kind), true);
      logicPalette.appendChild(chip);
    }

    const stepsPane = doc.createElement('div');
    stepsPane.className = 'kp-cfg-steps-pane';

    scriptCanvas.appendChild(logicPalette);
    scriptCanvas.appendChild(stepsPane);

    const addStepRow = doc.createElement('div');
    addStepRow.className = 'kp-cfg-strip-row';
    const addStepSelect = doc.createElement('select');
    addStepSelect.className = 'kp-cfg-field';
    Object.assign(addStepSelect.style, { width: 'auto', flex: '1 1 150px', maxWidth: '240px' });
    addStepSelect.setAttribute('aria-label', 'Function to add as a step');
    for (const def of listFunctionDefs()) {
      const opt = doc.createElement('option');
      opt.value = def.id;
      opt.textContent = def.label;
      addStepSelect.appendChild(opt);
    }
    const addStepDelayLabel = doc.createElement('label');
    Object.assign(addStepDelayLabel.style, {
      display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', opacity: '0.8'
    });
    const addStepDelayText = doc.createElement('span');
    addStepDelayText.textContent = 'delay ms';
    const addStepDelayInput = doc.createElement('input');
    addStepDelayInput.type = 'number';
    addStepDelayInput.min = '0';
    addStepDelayInput.step = '10';
    addStepDelayInput.value = '0';
    addStepDelayInput.className = 'kp-cfg-field';
    Object.assign(addStepDelayInput.style, { width: '68px', padding: '4px 5px' });
    addStepDelayLabel.appendChild(addStepDelayText);
    addStepDelayLabel.appendChild(addStepDelayInput);
    const addStepBtn = mkBtn('+ Add step', 'macro-add-step');
    addStepBtn.title = 'Append the selected Actions Library Function (or the dropdown pick)';
    addStepRow.appendChild(addStepSelect);
    addStepRow.appendChild(addStepDelayLabel);
    addStepRow.appendChild(addStepBtn);

    const scriptFooter = doc.createElement('div');
    scriptFooter.className = 'kp-cfg-strip-row';
    const placeHint = doc.createElement('span');
    placeHint.className = 'kp-cfg-hint';
    placeHint.textContent = 'Add Logic steps or Functions. Save commits the macro to Macros.';
    const scriptMeta = doc.createElement('span');
    scriptMeta.className = 'kp-cfg-hint';
    scriptMeta.textContent = '0 steps';
    scriptFooter.appendChild(placeHint);
    scriptFooter.appendChild(mkSpacer());
    scriptFooter.appendChild(scriptMeta);

    scriptPanel.appendChild(scriptToolbar);
    scriptPanel.appendChild(stockBanner);
    scriptPanel.appendChild(scriptCanvas);
    scriptPanel.appendChild(addStepRow);
    scriptPanel.appendChild(scriptFooter);

    // Macro Key quick-create (built-in keystroke primitives)
    const macroKeyPanel = doc.createElement('div');
    macroKeyPanel.hidden = true;
    const macroKeysActionsRow = doc.createElement('div');
    Object.assign(macroKeysActionsRow.style, { display: 'flex', flexDirection: 'column', gap: '6px' });
    macroKeyPanel.appendChild(macroKeysActionsRow);

    createBody.appendChild(scriptPanel);
    createBody.appendChild(macroKeyPanel);
    createPane.appendChild(createHdr);
    createPane.appendChild(createBody);

    const libraryCreateSplitter = doc.createElement('div');
    libraryCreateSplitter.className = 'kp-cfg-split kp-cfg-split-h';
    libraryCreateSplitter.setAttribute('role', 'separator');
    libraryCreateSplitter.setAttribute('aria-orientation', 'horizontal');
    libraryCreateSplitter.setAttribute('aria-label', 'Resize User Macros pane');
    libraryCreateSplitter.tabIndex = 0;

    workspace.appendChild(libraryPane);
    workspace.appendChild(libraryCreateSplitter);
    workspace.appendChild(createPane);

    // ---- Inspector dock -----------------------------------------------------------------
    const inspectorPane = doc.createElement('aside');
    inspectorPane.className = 'kp-cfg-pane kp-cfg-pane-inspector';
    inspectorPane.setAttribute('aria-label', 'Inspector');

    const inspectorRail = doc.createElement('button');
    inspectorRail.type = 'button';
    inspectorRail.className = 'kp-cfg-inspector-rail';
    inspectorRail.appendChild(mkCfgIcon(doc, 'kp-cfg-i-eye'));
    const railLabel = doc.createElement('span');
    railLabel.textContent = 'Inspector';
    inspectorRail.appendChild(railLabel);
    inspectorRail.title = 'Expand Inspector';
    inspectorRail.addEventListener('click', () => this._setInspectorOpen(true), true);

    const inspectorExpanded = doc.createElement('div');
    inspectorExpanded.className = 'kp-cfg-inspector-expanded';
    const inspectorHdr = doc.createElement('div');
    inspectorHdr.className = 'kp-cfg-pane-hdr';
    const inspectorTitle = doc.createElement('span');
    inspectorTitle.className = 'kp-cfg-pane-title';
    inspectorTitle.appendChild(mkCfgIcon(doc, 'kp-cfg-i-eye'));
    inspectorTitle.appendChild(doc.createTextNode('Inspector'));
    const collapseInspectorBtn = mkBtn('Collapse', 'collapse-inspector');
    collapseInspectorBtn.prepend(mkCfgIcon(doc, 'kp-cfg-i-collapse'));
    collapseInspectorBtn.addEventListener('click', () => this._setInspectorOpen(false), true);
    inspectorHdr.appendChild(inspectorTitle);
    inspectorHdr.appendChild(mkSpacer());
    inspectorHdr.appendChild(collapseInspectorBtn);

    const inspectorBody = doc.createElement('div');
    inspectorBody.className = 'kp-cfg-pane-scroll';

    inspectorExpanded.appendChild(inspectorHdr);
    inspectorExpanded.appendChild(inspectorBody);
    inspectorPane.appendChild(inspectorRail);
    inspectorPane.appendChild(inspectorExpanded);

    const workspaceInspectorSplitter = doc.createElement('div');
    workspaceInspectorSplitter.className = 'kp-cfg-split kp-cfg-split-v';
    workspaceInspectorSplitter.setAttribute('role', 'separator');
    workspaceInspectorSplitter.setAttribute('aria-orientation', 'vertical');
    workspaceInspectorSplitter.setAttribute('aria-label', 'Resize Inspector');
    workspaceInspectorSplitter.tabIndex = 0;

    mainRow.appendChild(workspace);
    mainRow.appendChild(workspaceInspectorSplitter);
    mainRow.appendChild(inspectorPane);

    body.appendChild(strip);
    body.appendChild(mainRow);

    shadowRoot.appendChild(header);
    shadowRoot.appendChild(body);
    (doc.body || doc.documentElement).appendChild(root);

    this.root = root;
    this.shadowRoot = shadowRoot;
    this._listEl = list;
    this._layoutCombo = layoutCombo;
    this._layoutComboInput = layoutComboInput;
    this._layoutComboList = layoutComboList;
    this._layoutComboToggle = layoutComboToggle;
    this._setCurrentBtn = setCurrentBtn;
    this._layoutOptsWrap = optsWrap;
    this._layoutOptsBtn = optsBtn;
    this._layoutOptsMenu = optsMenu;
    this._searchInput = search;
    this._currentBadge = currentBadge;
    this._refToggleBtn = refToggleBtn;
    this._showNumRowToggle = showNumRowToggle;
    this._mainRow = mainRow;
    this._libTabsEl = libTabs;
    this._fnCategorySelect = fnCategorySelect;
    this._createPane = createPane;
    this._createBody = createBody;
    this._createToggleBtn = createToggleBtn;
    this._createExpandUpBtn = expandUpBtn;
    this._createModeSeg = createModeSeg;
    this._libraryCreateSplitter = libraryCreateSplitter;
    this._workspaceInspectorSplitter = workspaceInspectorSplitter;
    this._scriptPanel = scriptPanel;
    this._macroKeyPanel = macroKeyPanel;
    this._macroNameInput = macroNameInput;
    this._scriptStepsHost = stepsPane;
    this._scriptStockBanner = stockBanner;
    this._scriptMetaEl = scriptMeta;
    this._placeHintEl = placeHint;
    this._legendEl = viewBar;
    this._libViewSegEl = viewSeg;
    this._addStepSelect = addStepSelect;
    this._addStepDelayInput = addStepDelayInput;
    this._macroKeysActionsRow = macroKeysActionsRow;
    this._inspectorPane = inspectorPane;
    this._inspectorRail = inspectorRail;
    this._inspectorBody = inspectorBody;
    this._macroKeyEditorHost = inspectorBody;

    this._renderLibraryTabs();
    this._syncLibViewSeg();
    this._renderFunctionCategorySelect();
    this._setInspectorOpen(this._inspectorOpen);
    this._setCreateOpen(this._createOpen);
    this._setCreateMode(this._createMode);
    this._resetMacroDraft();
    this._renderInspector();
    this._wireSplitters();

    // Drag
    try {
      const api = makePanelDraggable(root, header, {
        margin: CONFIG_POSITION_MARGIN_PX,
        excludeSelector: 'button[aria-label="Close layout config"], button[data-kp-cfg-save-close="true"], .kp-cfg-save-close',
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

    // Opt in to the shared window-resize foundation. Other persistent panels
    // can reuse this helper when their content supports flexible dimensions.
    try {
      this._resizeDispose = makePanelResizable(root, {
        mount: shadowRoot,
        minWidth: 720,
        minHeight: 460,
        margin: CONFIG_POSITION_MARGIN_PX,
        onResizeEnd: (size) => {
          void this._persistPosition({
            ...this._panelPosition,
            width: size.width,
            height: size.height
          });
        }
      });
    } catch { /* ignore */ }

    // Seed position from settings
    void (async () => {
      try {
        const settings = await getSettings();
        const pos = settings?.panelPositions?.keyboardLayoutConfig;
        if (pos && typeof pos === 'object') {
          const normalized = normalizePanelPositionState(
            pos,
            DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig
          );
          this._panelPosition = {
            ...(normalized || this._panelPosition),
            ...(Number.isFinite(Number(pos.width)) && Number(pos.width) > 0
              ? { width: Number(pos.width) }
              : {}),
            ...(Number.isFinite(Number(pos.height)) && Number(pos.height) > 0
              ? { height: Number(pos.height) }
              : {})
          };
          this._applyProChrome(root);
        }
        try {
          showNumRowToggle.checked = !!settings?.keyboardReferenceShowNumberRow;
        } catch { /* ignore */ }
        this._applyTableExpandedFromSettings(settings?.actionsLibraryTableExpanded);
        this._positionHydrated = true;
        if (this.isOpen()) this._applyPanelPositionNow();
        try { this._renderRightList(); } catch { /* ignore */ }
      } catch { /* ignore */ }
    })();

    // Wire events
    search.addEventListener('input', () => this._renderRightList(), true);

    fnCategorySelect.addEventListener('change', () => {
      this._libFunctionCategory = String(fnCategorySelect.value || '');
      this._renderRightList();
    }, true);

    refToggleBtn.addEventListener('click', () => {
      const next = !this._isKeyboardReferenceVisible();
      try {
        const kp = this._kp;
        if (typeof kp?.applyKeyboardHelpVisibility === 'function') {
          kp.applyKeyboardHelpVisibility(next, { persist: true });
        } else if (next) {
          kp?.floatingKeyboardHelp?.show?.();
        } else {
          kp?.floatingKeyboardHelp?.hide?.();
        }
      } catch { /* ignore */ }
      this._syncKeyboardReferenceToggle();
    }, true);

    createToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._setCreateOpen(!this._createOpen);
    }, true);
    expandUpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleCreateMaximized();
    }, true);

    macroNameInput.addEventListener('input', () => {
      if (!this._macroDraft || this._macroDraft.stock) return;
      this._macroDraft.label = String(macroNameInput.value || '');
      this._macroDraft.dirty = true;
    }, true);

    newMacroBtn.addEventListener('click', () => {
      this._resetMacroDraft(`Macro ${(this._st.macros || []).length + 1}`);
      this._setCreateMode('script', { open: true });
      this._inspectorSelection = null;
      this._setInspectorOpen(true);
      this._renderInspector();
    }, true);

    saveMacroBtn.addEventListener('click', () => { void this._saveMacroDraft(); }, true);
    placeMacroBtn.addEventListener('click', () => { void this._placeMacroDraft(); }, true);
    runMacroBtn.addEventListener('click', () => { void this._runMacroDraft(); }, true);
    addStepBtn.addEventListener('click', () => {
      const fromLib = String(this._selectedLibraryFunctionId || '');
      const fromSelect = String(addStepSelect.value || '');
      const functionId = (fromLib && getFunctionDef(fromLib)) ? fromLib : fromSelect;
      const delay = Math.max(0, Math.floor(Number(addStepDelayInput.value) || 0));
      this._addDraftFunctionStep(functionId, { delayMsBefore: delay });
    }, true);

    layoutComboToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._setLayoutComboOpen(!!layoutComboList.hidden);
    }, true);

    layoutComboList.addEventListener('click', (e) => {
      const opt = e.target?.closest?.('[data-kp-layout-id]');
      if (!opt) return;
      e.preventDefault();
      e.stopPropagation();
      void this._selectLayoutByValue(String(opt.getAttribute('data-kp-layout-id') || ''));
      this._setLayoutComboOpen(false);
    }, true);

    layoutComboInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._setLayoutComboOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this._setLayoutComboOpen(false);
        this._renderLayoutSelect();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        void this._commitLayoutComboRename();
        this._setLayoutComboOpen(false);
      }
    }, true);

    layoutComboInput.addEventListener('change', () => {
      void this._commitLayoutComboRename();
    }, true);

    layoutComboInput.addEventListener('focus', () => {
      // Keep list closed on focus-to-rename; ArrowDown / toggle opens it.
    }, true);

    doc.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (containsComposed(layoutCombo, t)) return;
      this._setLayoutComboOpen(false);
      if (containsComposed(optsWrap, t)) return;
      this._setLayoutOptsOpen(false);
    }, true);

    optsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._setLayoutOptsOpen(!!optsMenu.hidden);
    }, true);

    newBtn.addEventListener('click', async () => {
      await this.createNewLayout();
    }, true);

    duplicateBtn.addEventListener('click', async () => {
      await this.duplicateLayout();
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
        const v = this._selectedLayoutValue();
        if (v.startsWith('user:')) {
          await setSettings({ currentKeyboardLayoutId: v });
          if (this._kp?._settings) this._kp._settings.currentKeyboardLayoutId = v;
          try {
            if (this._st.userLayout && `user:${this._st.userLayout.id}` === v) {
              await this._kp?.applyLiveUserLayout?.(this._st.userLayout, {
                setAsCurrent: true,
                macros: this._st.macros,
                actions: this._st.actions
              });
            } else {
              await this._kp?._refreshCurrentKeyboardLayoutFromSettings?.();
            }
          } catch { /* ignore */ }
        } else {
          const familyId = parseBuiltinFamilySelectValue(v) || 'browsing';
          await setSettings({
            currentKeyboardLayoutId: 'builtin',
            keyboardLayoutFamilyId: familyId
          });
          if (this._kp?._settings) {
            this._kp._settings.currentKeyboardLayoutId = 'builtin';
            this._kp._settings.keyboardLayoutFamilyId = familyId;
          }
          try {
            this._kp?._applyKeyboardLayoutFromSettings?.();
            await this._kp?._refreshCurrentKeyboardLayoutFromSettings?.();
          } catch { /* ignore */ }
        }
        this._notify('Set as current keyboard layout.', 'success');
        this._renderLayoutSelect();
        this._emitChange();
      } catch {
        this._notify('Failed to set current keyboard layout.', 'error');
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
    try { this._st.stockMacros = listStockMacros(); } catch { this._st.stockMacros = []; }
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
   * Clear the Inspector dock — the single Config-side editor surface (Macro Key config,
   * generic Action Instance parameters, Macro summary). Only one can be shown at a time.
   */
  _closeMacroKeyEditor() {
    this._macroKeyDraft = null;
    this._inspectorSelection = null;
    this._renderInspector();
    try { this._renderRightList(); } catch { /* ignore */ }
  }

  /** Small helpers for the Inspector dock's shared chrome. */
  _dockTitle(text, subtitle) {
    const frag = document.createDocumentFragment();
    const title = document.createElement('div');
    title.className = 'kp-cfg-dock-title';
    title.textContent = String(text || '');
    frag.appendChild(title);
    if (subtitle) {
      const sub = document.createElement('div');
      sub.className = 'kp-cfg-dock-subtitle';
      sub.textContent = String(subtitle);
      frag.appendChild(sub);
    }
    return frag;
  }

  /** @param {Array<[string, string]>} pairs */
  _dockRows(pairs) {
    const dl = document.createElement('dl');
    dl.className = 'kp-cfg-dock-rows';
    for (const [key, value] of pairs) {
      if (value == null || value === '') continue;
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = String(value);
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    return dl;
  }

  /** @param {Array<{ label: string, onClick: () => void, title?: string, icon?: string }>} buttons */
  _dockActions(buttons) {
    const row = document.createElement('div');
    row.className = 'kp-cfg-dock-actions';
    for (const spec of buttons) {
      if (!spec) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kp-cfg-btn';
      setCfgBtnLabel(btn, spec.label, spec.icon);
      if (spec.title) btn.title = spec.title;
      btn.addEventListener('click', spec.onClick, true);
      row.appendChild(btn);
    }
    return row;
  }

  /**
   * Render the Inspector dock for the current selection. Every Config-side editor lands here
   * instead of the old inline host + key popover pair, so only one editing surface is ever
   * open. (Keyboard Reference keycaps keep their own popovers.)
   */
  _renderInspector() {
    const host = this._inspectorBody;
    if (!host) return;
    host.replaceChildren();

    // The User Macros canvas owns the Inspector while it is open. A macro selected from the
    // library is copied into `_macroDraft`, and showing the saved source here would make edits
    // appear to be ignored until Save.
    if (this._createOpen && this._createMode === 'script' && this._macroDraft) {
      this._renderMacroDraftInspector(host);
      return;
    }

    const sel = this._inspectorSelection;
    if (!sel || !sel.id) {
      const draft = this._macroDraft;
      if (draft && (draft.id || (draft.steps || []).length)) {
        this._renderMacroDraftInspector(host);
        return;
      }
      const empty = document.createElement('p');
      empty.className = 'kp-cfg-dock-empty';
      empty.textContent = 'Select a card in the Actions Library to inspect it.';
      host.appendChild(empty);
      return;
    }

    if (sel.type === 'macro') {
      this._renderMacroInspector(host, sel.id);
      return;
    }

    const mk = (this._st.macroKeys || []).find((m) => m && m.id === sel.id) || null;
    if (mk) {
      this._renderMacroKeyEditorInto(host, mk);
      return;
    }

    const inst = (this._st.actions || []).find((a) => a && a.id === sel.id) || null;
    const instDef = inst ? getFunctionDef(inst.functionId) : null;
    if (inst && instDef) {
      this._renderActionParamsEditorInto(host, instDef, inst);
      return;
    }

    this._renderFunctionInspector(host, sel.id);
  }

  /**
   * Stock (non-instantiable) Function: identity + Place, plus the two fixed-physical-key
   * Functions' existing "Config" popover and the chord binder for `worksWhileTyping`.
   * @param {HTMLElement} host
   * @param {string} functionId
   */
  _renderFunctionInspector(host, functionId) {
    const def = getFunctionDef(functionId);
    const kb = this._kp?.keybindings || buildKeybindingsForLayout(this._st.builtinLayoutId);
    const actionDef = KEYBINDING_ACTION_DEFS?.[functionId] || null;
    const binding = (kb && kb[functionId]) || null;
    const label = String(def?.label || actionDef?.label || binding?.label || functionId);
    if (!def && !actionDef && !binding) {
      const empty = document.createElement('p');
      empty.className = 'kp-cfg-dock-empty';
      empty.textContent = 'No inspector details for this item.';
      host.appendChild(empty);
      return;
    }

    host.appendChild(this._dockTitle(label, 'Stock function'));
    host.appendChild(this._dockRows([
      ['Id', functionId],
      ['Category', def ? (getFunctionCategory(def.id) || 'Other') : ''],
      ['Key', String(binding?.displayKey || binding?.keyLabel || '')],
      ['About', String(def?.description || actionDef?.description || binding?.description || '')],
      [def?.worksWhileTyping ? 'Note' : '', def?.worksWhileTyping ? 'Requires a modifier combo' : '']
    ]));

    /** @type {Array<{ label: string, onClick: () => void, title?: string, icon?: string }>} */
    const actions = [{
      label: 'Place on keyboard',
      icon: 'kp-cfg-i-place',
      title: 'Then click a Keyboard Reference key',
      onClick: () => this._beginPlaceModeFromLibrary({ type: 'function', id: functionId })
    }];
    if (def && FIXED_KEY_FUNCTION_IDS.includes(def.id) && actionHasParameters(def.id)) {
      actions.push({
        label: 'Config…',
        onClick: async () => {
          try { this._cancelPlaceMode(); } catch { /* ignore */ }
          try {
            const panel = getSharedKeyActionConfigPanel();
            await panel.open(def.id, { title: def.label, anchorRect: host.getBoundingClientRect() });
          } catch { /* ignore */ }
        }
      });
    }
    host.appendChild(this._dockActions(actions));

    if (def?.worksWhileTyping) {
      host.appendChild(this._renderBindChordButton({ type: 'function', id: functionId }, def));
    }
  }

  /**
   * @param {HTMLElement} host
   * @param {string} macroId
   */
  _renderMacroInspector(host, macroId) {
    const macro = this._findMacroById(macroId);
    if (!macro) {
      const empty = document.createElement('p');
      empty.className = 'kp-cfg-dock-empty';
      empty.textContent = 'Macro not found.';
      host.appendChild(empty);
      return;
    }
    const stock = !!macro.stock;
    const steps = Array.isArray(macro.steps) ? macro.steps : [];
    host.appendChild(this._dockTitle(String(macro.label || 'Macro'), stock ? 'Stock macro' : 'User macro'));
    host.appendChild(this._dockRows([
      ['Id', macro.id],
      ['Based on', macro.baseStockMacroId || ''],
      ['Steps', String(steps.length)]
    ]));
    host.appendChild(this._renderStepSummaryList(steps));
    host.appendChild(this._dockActions([
      {
        label: 'Place on keyboard',
        icon: 'kp-cfg-i-place',
        onClick: () => this._beginPlaceModeFromLibrary({ type: 'macro', id: macro.id })
      },
      {
        label: 'Run',
        onClick: () => { void this._kp?._runMacroById?.(macro.id); }
      },
      {
        label: stock ? 'Customize' : 'Edit steps',
        title: stock ? 'Open an editable copy in the User Macros builder' : 'Open in the User Macros builder',
        onClick: () => this._openMacroStepsEditor(macro)
      },
      {
        label: 'Duplicate',
        onClick: () => { void this._duplicateMacro(macro.id); }
      },
      stock ? null : {
        label: 'Delete',
        onClick: () => { void this._deleteMacro(macro.id); }
      }
    ].filter(Boolean)));
  }

  /**
   * Summary card for an unsaved User Macros draft (nothing to select in the library yet).
   * @param {HTMLElement} host
   */
  _renderMacroDraftInspector(host) {
    const draft = this._macroDraft;
    if (!draft) return;
    host.appendChild(this._dockTitle(
      String(draft.label || 'Untitled Macro'),
      draft.stock ? 'Stock macro (unsaved copy)' : 'User macro (unsaved)'
    ));
    host.appendChild(this._dockRows([
      ['Id', draft.id || '(unsaved)'],
      ['Based on', draft.baseStockMacroId || ''],
      ['Steps', String((draft.steps || []).length)]
    ]));
    const warn = this._cycleWarningFor(draft.id, draft.steps || []);
    if (warn) {
      const p = document.createElement('p');
      p.className = 'kp-cfg-cycle-warn';
      p.textContent = warn;
      host.appendChild(p);
    }
    host.appendChild(this._renderStepSummaryList(draft.steps || [], { selectable: true }));
    if (this._selectedStepIndex >= 0 && draft.steps?.[this._selectedStepIndex]) {
      host.appendChild(this._renderDraftStepEditor(this._selectedStepIndex));
    }
    host.appendChild(this._dockActions([
      { label: 'Save', onClick: () => { void this._saveMacroDraft(); } },
      { label: 'Place', icon: 'kp-cfg-i-place', onClick: () => { void this._placeMacroDraft(); } },
      { label: 'Run', onClick: () => { void this._runMacroDraft(); } }
    ]));
  }

  /**
   * @param {any[]} steps
   * @param {{ selectable?: boolean }} [opts]
   * @returns {HTMLElement}
   */
  _renderStepSummaryList(steps, { selectable = false } = {}) {
    if (!Array.isArray(steps) || !steps.length) {
      const empty = document.createElement('p');
      empty.className = 'kp-cfg-dock-empty';
      empty.textContent = 'No steps yet.';
      return empty;
    }
    const ol = document.createElement('ol');
    ol.className = 'kp-cfg-dock-steps';
    steps.forEach((step, index) => {
      const li = document.createElement('li');
      if (selectable) {
        li.tabIndex = 0;
        li.title = 'Edit this step';
        if (this._selectedStepIndex === index) li.classList.add('kp-cfg-step-selected');
        const select = () => {
          this._selectedStepIndex = index;
          this._renderMacroBuilderSteps();
          this._renderInspector();
        };
        li.addEventListener('click', select, true);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select();
          }
        }, true);
      }
      const idx = document.createElement('span');
      idx.className = 'kp-cfg-dock-step-idx';
      idx.textContent = String(index + 1);
      const body = document.createElement('div');
      const label = document.createElement('div');
      label.textContent = this._stepLabel(step);
      body.appendChild(label);
      const summary = this._stepSummary(step);
      if (summary) {
        const sub = document.createElement('div');
        sub.className = 'kp-cfg-step-sub';
        sub.textContent = summary;
        body.appendChild(sub);
      }
      li.appendChild(idx);
      li.appendChild(body);
      ol.appendChild(li);
    });
    return ol;
  }

  /**
   * Edit the selected draft step in the Inspector. The canvas keeps its compact, ordered view;
   * detailed Function parameters and Logic controls belong in this dock.
   * @param {number} index
   * @returns {HTMLElement}
   */
  _renderDraftStepEditor(index) {
    const step = this._macroDraft?.steps?.[index];
    const wrap = document.createElement('section');
    wrap.className = 'kp-mk-editor';
    if (!step) return wrap;

    const title = document.createElement('div');
    title.className = 'kp-mk-editor-title';
    title.textContent = `Edit step ${index + 1}: ${this._stepLabel(step)}`;
    wrap.appendChild(title);

    const patch = (changes) => {
      if (!this._macroDraft?.steps?.[index]) return;
      Object.assign(this._macroDraft.steps[index], changes);
      this._macroDraft.dirty = true;
      this._renderMacroBuilder();
      this._renderInspector();
    };
    const field = (labelText, control) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      const label = document.createElement('span');
      label.className = 'kp-mk-field-label';
      label.textContent = labelText;
      row.appendChild(label);
      row.appendChild(control);
      wrap.appendChild(row);
    };
    const numberInput = (label, value, onChange, { step: increment = 10 } = {}) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = String(increment);
      input.className = 'kp-cfg-field';
      input.value = String(Math.max(0, Math.floor(Number(value) || 0)));
      input.addEventListener('change', () => onChange(Math.max(0, Math.floor(Number(input.value) || 0))), true);
      field(label, input);
    };
    const textInput = (label, value, onChange, placeholder = '') => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'kp-cfg-field';
      input.value = value == null ? '' : String(value);
      input.placeholder = placeholder;
      input.addEventListener('change', () => onChange(input.value), true);
      field(label, input);
    };

    const kind = String(step.kind || (step.functionId ? 'function' : ''));
    if (kind === 'wait') {
      numberInput('Wait (ms)', step.ms, (ms) => patch({ ms }));
    } else if (kind === 'gate') {
      const op = document.createElement('select');
      op.className = 'kp-cfg-field';
      for (const name of MACRO_GATE_OPS) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        option.selected = String(step.op || 'truthy') === name;
        op.appendChild(option);
      }
      op.addEventListener('change', () => patch({ op: op.value }), true);
      field('Operator', op);
      textInput('Prior-result key', step.leftKey, (leftKey) => patch({ leftKey }), 'Optional object property');
      textInput('Compare to', step.right, (right) => patch({ right }), 'Required for eq, neq, gt, lt');
      numberInput('On fail, skip steps', step.thenSkip, (thenSkip) => patch({ thenSkip }), { step: 1 });
    } else if (kind === 'runMacro') {
      const select = document.createElement('select');
      select.className = 'kp-cfg-field';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '— pick macro —';
      select.appendChild(none);
      for (const macro of this._listSelectableMacros(this._macroDraft?.id || '')) {
        const option = document.createElement('option');
        option.value = macro.id;
        option.textContent = macro.stock ? `${macro.label} (stock)` : macro.label;
        option.selected = String(step.macroId || '') === macro.id;
        select.appendChild(option);
      }
      select.addEventListener('change', () => patch({ macroId: select.value }), true);
      field('Macro', select);
    } else if (kind === 'stop') {
      const hint = document.createElement('p');
      hint.className = 'kp-cfg-hint';
      hint.textContent = 'Stop ends the macro immediately when reached.';
      wrap.appendChild(hint);
    } else {
      numberInput('Delay before (ms)', step.delayMsBefore, (delayMsBefore) => patch({ delayMsBefore }));
      const def = getFunctionDef(step.functionId);
      for (const param of def?.parameters || []) {
        const current = step.parameters?.[param.id] ?? param.defaultValue;
        let control;
        if (param.type === 'boolean') {
          control = document.createElement('input');
          control.type = 'checkbox';
          control.checked = !!current;
          control.addEventListener('change', () => patch({
            parameters: { ...(step.parameters || {}), [param.id]: control.checked }
          }), true);
        } else if (param.type === 'enum' && Array.isArray(param.options)) {
          control = document.createElement('select');
          control.className = 'kp-cfg-field';
          for (const optionDef of param.options) {
            const option = document.createElement('option');
            option.value = optionDef.id;
            option.textContent = optionDef.label;
            option.selected = optionDef.id === current;
            control.appendChild(option);
          }
          control.addEventListener('change', () => patch({
            parameters: { ...(step.parameters || {}), [param.id]: control.value }
          }), true);
        } else if (param.multiline) {
          control = document.createElement('textarea');
          control.className = 'kp-cfg-field';
          control.rows = 3;
          control.value = current == null ? '' : String(current);
          control.addEventListener('change', () => patch({
            parameters: { ...(step.parameters || {}), [param.id]: control.value }
          }), true);
        } else {
          control = document.createElement('input');
          control.type = param.type === 'number' ? 'number' : 'text';
          control.className = 'kp-cfg-field';
          if (param.type === 'number') {
            if (param.min != null) control.min = String(param.min);
            if (param.max != null) control.max = String(param.max);
            if (param.step != null) control.step = String(param.step);
          }
          control.value = current == null ? '' : String(current);
          control.addEventListener('change', () => {
            const value = param.type === 'number' ? Number(control.value) : control.value;
            patch({ parameters: { ...(step.parameters || {}), [param.id]: value } });
          }, true);
        }
        if (param.placeholder) control.placeholder = String(param.placeholder);
        field(param.label || param.id, control);
      }
    }
    return wrap;
  }

  /**
   * @param {{ id: string, kind: string, label: string, config: Record<string, any> }} macroKey
   */
  _openMacroKeyEditor(macroKey) {
    if (!macroKey || !macroKey.id) return;
    this._inspectorSelection = { type: 'function', id: String(macroKey.id) };
    this._setInspectorOpen(true);
    this._renderInspector();
    try { this._renderRightList(); } catch { /* ignore */ }
  }

  /**
   * @param {HTMLElement} host
   * @param {{ id: string, kind: string, label: string, config: Record<string, any> }} macroKey
   */
  _renderMacroKeyEditorInto(host, macroKey) {
    this._macroKeyDraft = { ...macroKey, config: { ...(macroKey.config || {}) } };
    host.appendChild(this._dockTitle(String(macroKey.label || macroKey.kind || 'Macro Key'), 'Macro Key'));
    host.appendChild(this._dockActions([{
      label: 'Place on keyboard',
      icon: 'kp-cfg-i-place',
      onClick: () => this._beginPlaceModeFromLibrary({ type: 'function', id: macroKey.id })
    }]));
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
    if (!def || !instance) return;
    this._inspectorSelection = { type: 'function', id: String(instance.id) };
    this._setInspectorOpen(true);
    this._renderInspector();
    try { this._renderRightList(); } catch { /* ignore */ }
  }

  /**
   * @param {HTMLElement} host
   * @param {import('../config/function-library.js').FunctionDef} def
   * @param {import('../modules/keyboard-layout-store.js').UserAction} instance
   */
  _renderActionParamsEditorInto(host, def, instance) {
    const draft = { ...instance, parameters: { ...(instance.parameters || {}) } };

    host.appendChild(this._dockTitle(
      String(instance.label || def.label),
      summarizeFunctionParameters(instance.functionId, instance.parameters) || 'Configured instance'
    ));
    host.appendChild(this._dockActions([{
      label: 'Place on keyboard',
      icon: 'kp-cfg-i-place',
      onClick: () => this._beginPlaceModeFromLibrary({ type: 'function', id: instance.id })
    }]));

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
   * Load a Macro into the User Macros builder and show its summary in the Inspector dock.
   * Stock macros open read-only-by-name with a fork banner — Save writes a user copy carrying
   * `baseStockMacroId`, exactly like duplicating a built-in keyboard layout.
   * @param {{ id: string, label?: string, steps?: any[], baseStockMacroId?: string }} macro
   */
  _openMacroStepsEditor(macro) {
    if (!macro || !macro.id) return;
    const id = String(macro.id);
    const stock = isStockMacroId(id);
    const source = stock ? (getStockMacroById(id) || macro) : macro;
    this._macroDraft = {
      id,
      label: String(source.label || 'Macro'),
      steps: (Array.isArray(source.steps) ? source.steps : []).map((s) => ({ ...s })),
      stock,
      baseStockMacroId: stock ? id : (source.baseStockMacroId || null),
      dirty: false
    };
    this._selectedStepIndex = -1;
    this._setCreateMode('script', { open: true });
    this._renderMacroBuilder();
    this._inspectorSelection = null;
    this._setInspectorOpen(true);
    this._renderInspector();
    try { this._renderRightList(); } catch { /* ignore */ }
  }

  /** @param {string} [label] */
  _resetMacroDraft(label) {
    this._macroDraft = {
      id: null,
      label: String(label || 'Untitled Macro'),
      steps: [],
      stock: false,
      baseStockMacroId: null,
      dirty: false
    };
    this._selectedStepIndex = -1;
    this._renderMacroBuilder();
  }

  /** Sync the builder's name field / banner / meta with the current draft, then redraw steps. */
  _renderMacroBuilder() {
    const draft = this._macroDraft;
    if (this._macroNameInput) {
      this._macroNameInput.value = String(draft?.label || '');
      this._macroNameInput.readOnly = !!draft?.stock;
      this._macroNameInput.title = draft?.stock
        ? 'Stock macro name — Save creates an editable copy'
        : 'Macro name';
    }
    if (this._scriptStockBanner) this._scriptStockBanner.hidden = !draft?.stock;
    const count = (draft?.steps || []).length;
    if (this._scriptMetaEl) this._scriptMetaEl.textContent = `${count} step${count === 1 ? '' : 's'}`;
    this._renderMacroBuilderSteps();
  }

  _renderMacroBuilderSteps() {
    const host = this._scriptStepsHost;
    if (!host) return;
    host.replaceChildren();
    const draft = this._macroDraft;
    const steps = Array.isArray(draft?.steps) ? draft.steps : [];
    if (!steps.length) {
      const empty = document.createElement('div');
      empty.className = 'kp-cfg-script-empty';
      const strong = document.createElement('strong');
      strong.textContent = 'Build a macro script';
      const span = document.createElement('span');
      span.textContent = 'Click a Logic chip on the left, or select an Actions Library card and Add step.';
      empty.appendChild(strong);
      empty.appendChild(span);
      host.appendChild(empty);
      return;
    }
    steps.forEach((step, index) => {
      host.appendChild(this._renderMacroStepRow(step, index, steps.length));
    });
  }

  /**
   * One editable row in the User Macros canvas: index, label, kind-specific fields
   * (delay before for Function steps; Logic fields for the rest) and reorder/remove ops.
   * @param {any} step
   * @param {number} index
   * @param {number} total
   * @returns {HTMLElement}
   */
  _renderMacroStepRow(step, index, total) {
    const row = document.createElement('div');
    row.className = 'kp-cfg-step';
    if (this._selectedStepIndex === index) row.classList.add('kp-cfg-step-selected');
    row.dataset.kpStepIndex = String(index);
    row.addEventListener('click', () => {
      this._selectedStepIndex = index;
      this._renderMacroBuilderSteps();
      this._renderInspector();
    }, false);

    const idx = document.createElement('span');
    idx.className = 'kp-cfg-step-idx';
    idx.textContent = String(index + 1);
    row.appendChild(idx);

    const label = document.createElement('div');
    label.className = 'kp-cfg-step-label';
    label.textContent = this._stepLabel(step);
    const kind = String(step?.kind || (step?.functionId ? 'function' : ''));
    if (kind !== 'function') {
      const sub = document.createElement('span');
      sub.className = 'kp-cfg-step-sub';
      sub.textContent = kind;
      label.appendChild(sub);
    }
    row.appendChild(label);

    const fields = document.createElement('div');
    fields.className = 'kp-cfg-step-fields';

    const patch = (changes) => {
      Object.assign(step, changes);
      if (this._macroDraft) this._macroDraft.dirty = true;
      if (this._scriptMetaEl) {
        const count = (this._macroDraft?.steps || []).length;
        this._scriptMetaEl.textContent = `${count} step${count === 1 ? '' : 's'}`;
      }
      this._renderInspector();
    };

    const mkNumber = (labelText, value, onChange, title) => {
      const wrap = document.createElement('label');
      if (title) wrap.title = title;
      const text = document.createElement('span');
      text.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '10';
      input.className = 'kp-cfg-field';
      input.value = String(Math.max(0, Math.floor(Number(value) || 0)));
      input.addEventListener('change', () => {
        onChange(Math.max(0, Math.floor(Number(input.value) || 0)));
      }, true);
      wrap.appendChild(text);
      wrap.appendChild(input);
      return wrap;
    };

    const mkText = (labelText, value, onChange, placeholder) => {
      const wrap = document.createElement('label');
      const text = document.createElement('span');
      text.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'kp-cfg-field';
      input.value = value == null ? '' : String(value);
      if (placeholder) input.placeholder = placeholder;
      input.addEventListener('change', () => onChange(input.value), true);
      wrap.appendChild(text);
      wrap.appendChild(input);
      return wrap;
    };

    if (kind === 'wait') {
      fields.appendChild(mkNumber('ms', step.ms, (v) => patch({ ms: v }), 'Pause duration'));
    } else if (kind === 'gate') {
      const opWrap = document.createElement('label');
      const opText = document.createElement('span');
      opText.textContent = 'if';
      const opSelect = document.createElement('select');
      opSelect.className = 'kp-cfg-field';
      for (const op of MACRO_GATE_OPS) {
        const o = document.createElement('option');
        o.value = op;
        o.textContent = op;
        if (String(step.op || 'truthy') === op) o.selected = true;
        opSelect.appendChild(o);
      }
      opSelect.addEventListener('change', () => patch({ op: opSelect.value }), true);
      opWrap.appendChild(opText);
      opWrap.appendChild(opSelect);
      fields.appendChild(opWrap);
      fields.appendChild(mkText('key', step.leftKey, (v) => patch({ leftKey: v }), 'prior result key'));
      fields.appendChild(mkText('value', step.right, (v) => patch({ right: v }), 'compare to'));
      fields.appendChild(mkNumber('skip', step.thenSkip, (v) => patch({ thenSkip: v }), 'Steps skipped when the gate fails'));
    } else if (kind === 'runMacro') {
      const wrap = document.createElement('label');
      const text = document.createElement('span');
      text.textContent = 'macro';
      const select = document.createElement('select');
      select.className = 'kp-cfg-field';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '(pick macro)';
      select.appendChild(none);
      for (const m of this._listSelectableMacros(this._macroDraft?.id || '')) {
        const o = document.createElement('option');
        o.value = m.id;
        o.textContent = m.stock ? `${m.label} (stock)` : m.label;
        if (String(step.macroId || '') === m.id) o.selected = true;
        select.appendChild(o);
      }
      select.addEventListener('change', () => patch({ macroId: select.value }), true);
      wrap.appendChild(text);
      wrap.appendChild(select);
      fields.appendChild(wrap);
    } else if (kind === 'function') {
      fields.appendChild(mkNumber(
        'delay ms',
        step.delayMsBefore,
        (v) => patch({ delayMsBefore: v }),
        'Wait this long before running the step'
      ));
    }

    row.appendChild(fields);

    const ops = document.createElement('div');
    ops.className = 'kp-cfg-step-ops';
    const mkOp = (text, title, disabled, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'kp-cfg-btn';
      b.textContent = text;
      b.title = title;
      b.disabled = !!disabled;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }, true);
      return b;
    };
    ops.appendChild(mkOp('\u2191', 'Move up', index === 0, () => this._moveDraftStep(index, index - 1)));
    ops.appendChild(mkOp('\u2193', 'Move down', index === total - 1, () => this._moveDraftStep(index, index + 1)));
    ops.appendChild(mkOp('\u00d7', 'Remove step', false, () => this._removeDraftStep(index)));
    row.appendChild(ops);

    return row;
  }

  /**
   * User macros plus the stock catalog, for the Run Macro step picker.
   * @param {string} excludeId
   * @returns {Array<{ id: string, label: string, stock: boolean }>}
   */
  _listSelectableMacros(excludeId) {
    const out = [];
    for (const m of this._st.macros || []) {
      if (!m || !m.id || m.id === excludeId) continue;
      out.push({ id: m.id, label: String(m.label || 'Macro'), stock: false });
    }
    for (const m of this._st.stockMacros || []) {
      if (!m || !m.id || m.id === excludeId) continue;
      out.push({ id: m.id, label: String(m.label || 'Macro'), stock: true });
    }
    return out;
  }

  /** @param {string} kind */
  _addDraftLogicStep(kind) {
    if (!this._macroDraft) this._resetMacroDraft();
    /** @type {any} */
    let step = null;
    if (kind === 'wait') step = { kind: 'wait', ms: 100 };
    else if (kind === 'gate') step = { kind: 'gate', op: 'truthy', left: 'prior', thenSkip: 1 };
    else if (kind === 'stop') step = { kind: 'stop' };
    else if (kind === 'runMacro') step = { kind: 'runMacro', macroId: '' };
    if (!step) return;
    this._macroDraft.steps.push(step);
    this._macroDraft.dirty = true;
    this._selectedStepIndex = this._macroDraft.steps.length - 1;
    this._setCreateMode('script', { open: true });
    this._renderMacroBuilder();
    this._renderInspector();
  }

  /**
   * @param {string} functionId
   * @param {{ delayMsBefore?: number, parameters?: Record<string, any> }} [opts]
   */
  _addDraftFunctionStep(functionId, { delayMsBefore = 0, parameters } = {}) {
    const def = getFunctionDef(functionId);
    if (!def) {
      this._notify('Unknown function.', 'error');
      return;
    }
    if (!this._macroDraft) this._resetMacroDraft();
    /** @type {any} */
    const step = { kind: 'function', functionId: def.id, parameters: parameters ? { ...parameters } : {} };
    const delay = Math.max(0, Math.floor(Number(delayMsBefore) || 0));
    if (delay > 0) step.delayMsBefore = delay;
    this._macroDraft.steps.push(step);
    this._macroDraft.dirty = true;
    this._selectedStepIndex = this._macroDraft.steps.length - 1;
    this._setCreateMode('script', { open: true });
    this._renderMacroBuilder();
    this._renderInspector();
  }

  /**
   * @param {number} from
   * @param {number} to
   */
  _moveDraftStep(from, to) {
    const steps = this._macroDraft?.steps;
    if (!Array.isArray(steps) || !steps[from]) return;
    const next = Math.max(0, Math.min(to, steps.length - 1));
    const [moved] = steps.splice(from, 1);
    steps.splice(next, 0, moved);
    this._macroDraft.dirty = true;
    this._selectedStepIndex = next;
    this._renderMacroBuilder();
    this._renderInspector();
  }

  /** @param {number} index */
  _removeDraftStep(index) {
    const steps = this._macroDraft?.steps;
    if (!Array.isArray(steps) || !steps[index]) return;
    steps.splice(index, 1);
    this._macroDraft.dirty = true;
    this._selectedStepIndex = -1;
    this._renderMacroBuilder();
    this._renderInspector();
  }

  /**
   * Commit the draft. A stock draft forks into a new user macro (`baseStockMacroId` kept); a
   * draft with no id creates one; otherwise the existing user macro is updated in place.
   * @returns {Promise<any|null>}
   */
  async _saveMacroDraft() {
    const draft = this._macroDraft;
    if (!draft) return null;
    const typed = String(this._macroNameInput?.value || draft.label || '').trim();
    const steps = (draft.steps || []).map(normalizeMacroStep).filter(Boolean);
    if (!steps.length) {
      this._notify('Add at least one step before saving.', 'error');
      return null;
    }

    try {
      /** @type {any} */
      let saved = null;
      if (draft.stock) {
        const stockId = String(draft.baseStockMacroId || draft.id || '');
        const label = /\(custom\)\s*$/.test(typed) ? typed : `${typed || 'Macro'} (custom)`;
        const forked = await forkStockMacroToUser(stockId, { label });
        if (forked) saved = await upsertUserMacro({ ...forked, label, steps });
      } else if (!draft.id) {
        const created = await createUserMacro({ label: typed || 'Untitled Macro' });
        if (created) saved = await upsertUserMacro({ ...created, label: typed || created.label, steps });
      } else {
        saved = await upsertUserMacro({
          id: draft.id,
          label: typed || draft.label || 'Macro',
          steps,
          baseStockMacroId: draft.baseStockMacroId || undefined
        });
      }
      if (!saved) {
        this._notify('Failed to save macro.', 'error');
        return null;
      }

      this._st.macros = await listUserMacros();
      this._macroDraft = {
        id: saved.id,
        label: String(saved.label || ''),
        steps: (saved.steps || []).map((s) => ({ ...s })),
        stock: false,
        baseStockMacroId: saved.baseStockMacroId || null,
        dirty: false
      };
      this._renderMacroBuilder();
      this._inspectorSelection = { type: 'macro', id: saved.id };
      this._renderInspector();
      this._renderRightList();
      try {
        if (this._st.userLayout) {
          await this._kp?.applyLiveUserLayout?.(this._st.userLayout, {
            macros: this._st.macros,
            actions: this._st.actions
          });
        }
      } catch { /* ignore */ }
      this._emitChange();
      this._notify(draft.stock ? `Forked stock macro → "${saved.label}".` : 'Macro saved.', 'success');
      return saved;
    } catch {
      this._notify('Failed to save macro.', 'error');
      return null;
    }
  }

  /** Save first when needed, then enter place mode with the resulting user macro. */
  async _placeMacroDraft() {
    let id = this._macroDraft?.id || null;
    if (!id || this._macroDraft?.dirty || this._macroDraft?.stock) {
      const saved = await this._saveMacroDraft();
      id = saved?.id || null;
    }
    if (!id) return;
    this._beginPlaceModeFromLibrary({ type: 'macro', id });
  }

  async _runMacroDraft() {
    const draft = this._macroDraft;
    if (!draft) return;
    if (!draft.id) {
      this._notify('Save the macro before running it.', 'error');
      return;
    }
    if (draft.dirty) {
      const saved = await this._saveMacroDraft();
      if (!saved) return;
    }
    try { await this._kp?._runMacroById?.(this._macroDraft.id); } catch { /* ignore */ }
  }

  /**
   * Copy any macro — stock or user — into a new *user* macro, then open it in the builder.
   * @param {string} macroId
   */
  async _duplicateMacro(macroId) {
    const source = this._findMacroById(macroId);
    if (!source) return;
    try {
      const baseLabel = String(source.label || 'Macro').replace(/\s*\(custom\)\s*$/, '');
      const label = `${baseLabel} copy`;
      let created = null;
      if (source.stock) {
        created = await forkStockMacroToUser(source.id, { label });
      } else {
        const blank = await createUserMacro({ label });
        created = blank
          ? await upsertUserMacro({
            ...blank,
            label,
            steps: (source.steps || []).map((s) => ({ ...s })),
            baseStockMacroId: source.baseStockMacroId || undefined
          })
          : null;
      }
      if (!created) {
        this._notify('Failed to duplicate macro.', 'error');
        return;
      }
      this._st.macros = await listUserMacros();
      this._renderRightList();
      this._openMacroStepsEditor(created);
      this._emitChange();
      this._notify(`Duplicated → ${created.label}.`, 'success');
    } catch {
      this._notify('Failed to duplicate macro.', 'error');
    }
  }

  /** @param {string} macroId */
  async _deleteMacro(macroId) {
    if (isStockMacroId(macroId)) {
      this._notify('Stock macros cannot be deleted.', 'error');
      return;
    }
    try {
      await deleteUserMacro(macroId);
      this._st.macros = (this._st.macros || []).filter((m) => m && m.id !== macroId);
      if (this._macroDraft?.id === macroId) this._resetMacroDraft();
      this._closeMacroKeyEditor();
      this._renderRightList();
      this._emitChange();
      this._notify('Macro deleted.', 'success');
    } catch {
      this._notify('Failed to delete macro.', 'error');
    }
  }

  /**
   * @param {string} macroId
   * @returns {{ id: string, label: string, steps: any[], stock: boolean, baseStockMacroId?: string }|null}
   */
  _findMacroById(macroId) {
    const id = String(macroId || '');
    if (!id) return null;
    const user = (this._st.macros || []).find((m) => m && m.id === id) || null;
    if (user) {
      return {
        id: user.id,
        label: String(user.label || 'Macro'),
        steps: Array.isArray(user.steps) ? user.steps : [],
        stock: false,
        baseStockMacroId: user.baseStockMacroId
      };
    }
    const stock = (this._st.stockMacros || []).find((m) => m && m.id === id) || getStockMacroById(id);
    if (!stock) return null;
    return {
      id: stock.id,
      label: String(stock.label || 'Macro'),
      steps: Array.isArray(stock.steps) ? stock.steps : [],
      stock: true
    };
  }

  /**
   * @param {any} step
   * @returns {string}
   */
  _stepLabel(step) {
    const kind = String(step?.kind || (step?.functionId ? 'function' : ''));
    if (kind === 'function') return getFunctionDef(step.functionId)?.label || String(step.functionId || 'Function');
    const def = MACRO_LOGIC_DEFS.find((d) => d.kind === kind);
    return def ? def.label : (kind || 'Step');
  }

  /**
   * @param {any} step
   * @returns {string}
   */
  _stepSummary(step) {
    const kind = String(step?.kind || (step?.functionId ? 'function' : ''));
    if (kind === 'wait') return `${Math.max(0, Number(step.ms) || 0)} ms`;
    if (kind === 'stop') return 'end run';
    if (kind === 'gate') {
      const right = step.right === undefined || step.right === '' ? '' : ` "${step.right}"`;
      return `${step.op || 'truthy'}${right} · skip ${Math.max(0, Number(step.thenSkip) || 0)}`;
    }
    if (kind === 'runMacro') {
      const nested = step.macroId ? this._findMacroById(step.macroId) : null;
      return nested ? nested.label : (step.macroId || '(pick macro)');
    }
    const parts = [];
    const summary = summarizeFunctionParameters(step.functionId, step.parameters);
    if (summary) parts.push(summary);
    if (step.delayMsBefore) parts.push(`delay ${step.delayMsBefore} ms`);
    return parts.join(' · ');
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

  /**
   * @returns {string} `user:<id>` or `builtin:<familyId>`
   */
  _selectedLayoutValue() {
    if (this._st.mode === 'user' && this._st.userLayoutId) {
      return `user:${this._st.userLayoutId}`;
    }
    const inferred = inferFamilyAndHandednessFromLayoutId(this._st.builtinLayoutId);
    return builtinFamilySelectValue(inferred.familyId);
  }

  /**
   * @returns {string}
   */
  _builtinLayoutDisplayName() {
    try {
      const inferred = inferFamilyAndHandednessFromLayoutId(this._st.builtinLayoutId);
      const familyId = normalizeKeyboardLayoutFamilyId(
        this._kp?._settings?.keyboardLayoutFamilyId || inferred.familyId
      );
      return formatBuiltinFamilyLabel(familyId);
    } catch { /* ignore */ }
    return 'Built-in: Browsing';
  }

  /** @param {boolean} open */
  _setLayoutComboOpen(open) {
    const list = this._layoutComboList;
    const input = this._layoutComboInput;
    if (!list || !input) return;
    list.hidden = !open;
    try { input.setAttribute('aria-expanded', open ? 'true' : 'false'); } catch { /* ignore */ }
  }

  /** @param {boolean} open */
  _setLayoutOptsOpen(open) {
    const menu = this._layoutOptsMenu;
    const btn = this._layoutOptsBtn;
    if (!menu) return;
    menu.hidden = !open;
    try { btn?.setAttribute('aria-expanded', open ? 'true' : 'false'); } catch { /* ignore */ }
  }

  /**
   * Select a layout for editing — same behavior as the Layout combo.
   * Used by the Keyboard Reference titlebar select during edit mode.
   * @param {string} value
   */
  async selectLayoutByValue(value) {
    await this._selectLayoutByValue(value);
  }

  /**
   * @param {string} value
   */
  async _selectLayoutByValue(value) {
    const v = String(value || '');
    if (v.startsWith('user:')) {
      const id = v.slice('user:'.length);
      const found = this._st.userLayouts.find((l) => l && l.id === id) || null;
      this._st.mode = 'user';
      this._st.userLayoutId = id;
      this._st.userLayout = found;
    } else {
      const familyId = parseBuiltinFamilySelectValue(v) || 'browsing';
      const handedness = inferFamilyAndHandednessFromLayoutId(
        this._kp?._keyboardLayoutId || this._st.builtinLayoutId
      ).handedness;
      this._st.mode = 'builtin';
      this._st.userLayoutId = null;
      this._st.userLayout = null;
      this._st.builtinLayoutId = resolveKeyboardLayoutId({ familyId, handedness });
    }
    this._renderLayoutSelect();
    this._renderRightList();
    this._emitChange();
  }

  async _commitLayoutComboRename() {
    const input = this._layoutComboInput;
    if (!input) return;
    if (this._st.mode !== 'user' || !this._st.userLayout) {
      this._renderLayoutSelect();
      return;
    }
    const next = String(input.value || '').trim() || 'Custom Layout';
    if (next === String(this._st.userLayout.label || '')) return;
    this._st.userLayout.label = next;
    await this._persistUserLayout();
    this._st.userLayouts = await listUserKeyboardLayouts();
    this._renderLayoutSelect();
    this._emitChange();
  }

  _renderLayoutSelect() {
    const combo = this._layoutCombo;
    const input = this._layoutComboInput;
    const list = this._layoutComboList;
    if (!combo || !input || !list) return;

    const selected = this._selectedLayoutValue();
    const current = String(
      this._kp?._currentKeyboardLayoutId || this._kp?._settings?.currentKeyboardLayoutId || 'builtin'
    );
    const currentFamily = normalizeKeyboardLayoutFamilyId(
      this._kp?._settings?.keyboardLayoutFamilyId
    );
    const currentKey = current.startsWith('user:')
      ? current
      : builtinFamilySelectValue(currentFamily);
    const selectedKey = selected;
    const isCurrent = currentKey === selectedKey;
    const readOnly = this._isReadOnly();
    const builtinName = this._builtinLayoutDisplayName();
    const groups = listLayoutPickerGroups(this._st.userLayouts || []);

    list.replaceChildren();
    const appendGroup = (heading, items) => {
      const hdr = document.createElement('li');
      hdr.className = 'kp-cfg-combo-group';
      hdr.setAttribute('role', 'presentation');
      hdr.textContent = heading;
      list.appendChild(hdr);
      for (const opt of items || []) {
        if (!opt?.value) continue;
        const li = document.createElement('li');
        li.setAttribute('role', 'none');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kp-cfg-combo-option'
          + (opt.value === selected ? ' is-active' : '')
          + (opt.value === currentKey ? ' is-current' : '');
        btn.setAttribute('role', 'option');
        btn.setAttribute('data-kp-layout-id', opt.value);
        btn.setAttribute('aria-selected', opt.value === selected ? 'true' : 'false');
        const name = document.createElement('span');
        name.className = 'kp-cfg-combo-option-name';
        name.textContent = opt.label;
        btn.appendChild(name);
        if (opt.value === currentKey) {
          const chip = document.createElement('span');
          chip.className = 'kp-cfg-combo-option-current';
          chip.appendChild(mkCfgIcon(document, 'kp-cfg-i-check'));
          chip.appendChild(document.createTextNode('Current'));
          btn.appendChild(chip);
        }
        li.appendChild(btn);
        list.appendChild(li);
      }
    };
    appendGroup('Built-In', groups.builtin);
    appendGroup('Custom', groups.custom);

    if (this.shadowRoot?.activeElement !== input) {
      input.value = readOnly
        ? builtinName
        : String(this._st.userLayout?.label || 'Custom Layout');
    }
    input.readOnly = readOnly;
    combo.classList.toggle('is-builtin', readOnly);
    combo.classList.toggle('is-current', isCurrent);

    const badge = this._currentBadge;
    if (badge) {
      badge.hidden = !isCurrent;
      badge.setAttribute('aria-hidden', isCurrent ? 'false' : 'true');
    }

    if (this._setCurrentBtn) this._setCurrentBtn.disabled = isCurrent;

    try {
      const root = this.shadowRoot;
      if (!root) return;
      const byAction = (action) => root.querySelector(`.kp-cfg-btn[data-kp-cfg-action="${action}"]`);
      const dup = byAction('duplicate');
      if (dup) dup.style.display = readOnly ? '' : 'none';
      for (const action of ['delete', 'export']) {
        const btn = byAction(action);
        if (btn) btn.disabled = readOnly || !this._st.userLayoutId;
      }
    } catch { /* ignore */ }
  }

  /** @returns {boolean} */
  _isKeyboardReferenceVisible() {
    try {
      const kp = this._kp;
      const help = kp?.floatingKeyboardHelp;
      if (help && typeof help.isVisible === 'function') return !!help.isVisible();
      return !!kp?._keyboardHelpVisible;
    } catch {
      return false;
    }
  }

  _syncKeyboardReferenceToggle() {
    const btn = this._refToggleBtn;
    if (!btn) return;
    const on = this._isKeyboardReferenceVisible();
    try { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); } catch { /* ignore */ }
    btn.title = on ? 'Hide the Keyboard Reference window' : 'Show the Keyboard Reference window';
  }

  /** @param {boolean} open */
  _setInspectorOpen(open) {
    this._inspectorOpen = !!open;
    const pane = this._inspectorPane;
    if (pane) pane.classList.toggle('kp-cfg-collapsed', !this._inspectorOpen);
    try {
      this._mainRow?.classList.toggle('kp-cfg-inspector-open', this._inspectorOpen);
    } catch { /* ignore */ }
  }

  /** @param {boolean} open */
  _setCreateOpen(open) {
    this._createOpen = !!open;
    if (!this._createOpen) this._createMaximized = false;
    const pane = this._createPane;
    if (pane) {
      pane.classList.toggle('kp-cfg-open', this._createOpen);
      pane.classList.toggle('kp-cfg-maximized', this._createOpen && this._createMaximized);
    }
    try {
      this._createPane?.parentElement?.classList.toggle(
        'kp-cfg-create-maximized',
        this._createOpen && this._createMaximized
      );
    } catch { /* ignore */ }
    const hdr = this._createPane?.querySelector?.('.kp-cfg-pane-hdr');
    if (hdr) {
      hdr.setAttribute('aria-expanded', this._createOpen ? 'true' : 'false');
      hdr.title = this._createOpen ? 'Collapse User Macros' : 'Expand User Macros';
    }
    const btn = this._createToggleBtn;
    if (btn) {
      const label = this._createOpen ? 'Collapse' : 'Expand';
      const icoId = this._createOpen ? 'kp-cfg-i-collapse' : 'kp-cfg-i-expand';
      btn.replaceChildren();
      btn.appendChild(mkCfgIcon(document, icoId));
      btn.appendChild(document.createTextNode(label));
      btn.title = this._createOpen ? 'Collapse User Macros' : 'Show/hide the User Macros builder';
    }
    this._syncCreateExpandUpBtn();
  }

  _toggleCreateMaximized() {
    if (!this._createOpen) this._setCreateOpen(true);
    if (this._createMaximized) {
      this._createMaximized = false;
      if (this._createPrevHeightPx != null && this._mainRow) {
        this._mainRow.style.setProperty('--kp-cfg-create-height', `${this._createPrevHeightPx}px`);
      }
    } else {
      const height = this._createPane?.getBoundingClientRect().height;
      this._createPrevHeightPx = Number.isFinite(height) ? Math.round(height) : null;
      this._createMaximized = true;
    }
    this._setCreateOpen(true);
  }

  _syncCreateExpandUpBtn() {
    const btn = this._createExpandUpBtn;
    if (!btn) return;
    const show = this._createOpen;
    btn.hidden = !show;
    if (!show) return;
    const maxed = this._createMaximized;
    btn.replaceChildren();
    btn.appendChild(mkCfgIcon(document, maxed ? 'kp-cfg-i-collapse' : 'kp-cfg-i-expand-up'));
    btn.appendChild(document.createTextNode(maxed ? 'Restore' : 'Expand up'));
    btn.title = maxed
      ? 'Restore User Macros height'
      : 'Expand upward to the Actions Library titlebar';
  }

  /**
   * Add mockup-parity resize controls between Workspace/Inspector and Library/User Macros.
   * Values remain local to this panel session; they are presentation preferences, not layout data.
   */
  _wireSplitters() {
    const vertical = this._workspaceInspectorSplitter;
    const horizontal = this._libraryCreateSplitter;
    const row = this._mainRow;
    const workspace = this._createPane?.parentElement;
    if (!vertical || !horizontal || !row || !workspace) return;

    const setInspectorWidth = (width) => {
      const next = Math.max(200, Math.min(480, Math.round(width)));
      row.style.setProperty('--kp-cfg-inspector-width', `${next}px`);
      if (!this._inspectorOpen) this._setInspectorOpen(true);
    };
    const setCreateHeight = (height) => {
      const bounds = workspace.getBoundingClientRect();
      const next = Math.max(210, Math.min(Math.max(210, bounds.height - 160), Math.round(height)));
      row.style.setProperty('--kp-cfg-create-height', `${next}px`);
      if (!this._createOpen) this._setCreateOpen(true);
    };
    const wireDrag = (el, axis, onMove) => {
      el.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        el.classList.add('kp-cfg-split-dragging');
        try { el.setPointerCapture(event.pointerId); } catch { /* ignore */ }
        const move = (e) => onMove(e);
        const finish = () => {
          el.classList.remove('kp-cfg-split-dragging');
          try { el.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', finish);
          el.removeEventListener('pointercancel', finish);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', finish);
        el.addEventListener('pointercancel', finish);
      }, true);
      el.addEventListener('keydown', (event) => {
        const isDecrease = axis === 'x' ? event.key === 'ArrowLeft' : event.key === 'ArrowDown';
        const isIncrease = axis === 'x' ? event.key === 'ArrowRight' : event.key === 'ArrowUp';
        if (!isDecrease && !isIncrease) return;
        event.preventDefault();
        const amount = event.shiftKey ? 40 : 10;
        if (axis === 'x') {
          const width = this._inspectorPane?.getBoundingClientRect().width || CONFIG_INSPECTOR_WIDTH_PX;
          setInspectorWidth(width + (isIncrease ? amount : -amount));
        } else {
          const height = this._createPane?.getBoundingClientRect().height || 210;
          setCreateHeight(height + (isIncrease ? amount : -amount));
        }
      }, true);
    };

    wireDrag(vertical, 'x', (event) => {
      const bounds = row.getBoundingClientRect();
      const width = bounds.right - event.clientX;
      if (width <= 40) {
        this._setInspectorOpen(false);
        return;
      }
      setInspectorWidth(width);
    });
    wireDrag(horizontal, 'y', (event) => {
      const bounds = workspace.getBoundingClientRect();
      const height = bounds.bottom - event.clientY;
      if (height <= 36) {
        this._setCreateOpen(false);
        return;
      }
      setCreateHeight(height);
    });
  }

  /**
   * @param {'script'|'macroKey'} mode
   * @param {{ open?: boolean }} [opts]
   */
  _setCreateMode(mode, { open = false } = {}) {
    this._createMode = mode === 'macroKey' ? 'macroKey' : 'script';
    if (this._scriptPanel) this._scriptPanel.hidden = this._createMode !== 'script';
    if (this._macroKeyPanel) this._macroKeyPanel.hidden = this._createMode !== 'macroKey';
    try {
      for (const btn of this._createModeSeg?.querySelectorAll('[data-kp-create-mode]') || []) {
        const on = btn.dataset.kpCreateMode === this._createMode;
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    } catch { /* ignore */ }
    if (open) this._setCreateOpen(true);
  }

  _renderLibraryTabs() {
    const host = this._libTabsEl;
    if (!host) return;
    host.replaceChildren();
    const tabs = [
      { id: 'all', label: 'All', icon: 'kp-cfg-i-all' },
      { id: 'functions', label: 'Functions', icon: 'kp-cfg-i-lib' },
      { id: 'macros', label: 'Macros', icon: 'kp-cfg-i-macro' },
      { id: 'macroKeys', label: 'Macro Keys', icon: 'kp-cfg-i-keycap' }
    ];
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kp-cfg-seg-btn';
      btn.setAttribute('role', 'tab');
      btn.dataset.kpLibTab = tab.id;
      btn.appendChild(mkCfgIcon(document, tab.icon));
      btn.appendChild(document.createTextNode(` ${tab.label}`));
      btn.setAttribute('aria-selected', this._libPrimaryTab === tab.id ? 'true' : 'false');
      btn.addEventListener('click', () => {
        this._libPrimaryTab = /** @type {any} */ (tab.id);
        this._renderLibraryTabs();
        this._renderRightList();
      }, true);
      host.appendChild(btn);
    }
    const select = this._fnCategorySelect;
    if (select) select.hidden = this._libPrimaryTab !== 'functions';
  }

  _syncLibViewSeg() {
    const host = this._libViewSegEl;
    if (!host) return;
    for (const btn of host.querySelectorAll('button[data-kp-lib-view]')) {
      const on = btn.dataset.kpLibView === this._libViewMode;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  _isTableGroupExpanded(key) {
    return !!this._tableExpanded?.has(key);
  }

  /**
   * @param {string} key
   */
  _toggleTableGroup(key) {
    if (!this._tableExpanded) {
      this._tableExpanded = new Set(DEFAULT_SETTINGS.actionsLibraryTableExpanded || []);
    }
    if (this._tableExpanded.has(key)) this._tableExpanded.delete(key);
    else this._tableExpanded.add(key);
    this._renderRightList();
    void this._persistTableExpanded();
  }

  async _persistTableExpanded() {
    try {
      const keys = [...(this._tableExpanded || [])];
      await setSettings({ actionsLibraryTableExpanded: keys });
    } catch { /* ignore */ }
  }

  /**
   * @param {string[]|undefined|null} keys
   */
  _applyTableExpandedFromSettings(keys) {
    const list = Array.isArray(keys)
      ? keys.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim())
      : [...(DEFAULT_SETTINGS.actionsLibraryTableExpanded || [])];
    this._tableExpanded = new Set(list);
    this._tableExpandedHydrated = true;
  }

  _renderFunctionCategorySelect() {
    const select = this._fnCategorySelect;
    if (!select) return;
    select.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All categories';
    select.appendChild(all);
    const cats = new Set();
    for (const def of listFunctionDefs()) {
      if (!def || def.legacyMacroKeyKind) continue;
      cats.add(getFunctionCategory(def.id) || 'Other');
    }
    const order = Array.isArray(FUNCTION_CATEGORY_ORDER) ? FUNCTION_CATEGORY_ORDER : [];
    const sorted = [
      ...order.filter((c) => cats.has(c)),
      ...[...cats].filter((c) => !order.includes(c)).sort()
    ];
    for (const cat of sorted) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    }
    select.value = this._libFunctionCategory || '';
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
   * Select a library item into the Inspector dock. Config-side inspection is dock-only now —
   * the Keyboard Reference keycaps keep their own key-info popovers.
   * @param {{ type: string, id: string }} item
   */
  _inspectItem(item) {
    if (!item || !item.id) return;
    try { this._cancelPlaceMode(); } catch { /* ignore */ }
    this._inspectorSelection = { type: String(item.type), id: String(item.id) };
    this._setInspectorOpen(true);
    this._renderInspector();
    this._renderRightList();
  }

  /**
   * Enter place mode for an item selected from the dock, anchoring the arrow on its library
   * keycap when one is rendered.
   * @param {{ type: string, id: string }} item
   */
  _beginPlaceModeFromLibrary(item) {
    if (!item || !item.type || !item.id) return;
    let sourceEl = null;
    try {
      const id = CSS.escape ? CSS.escape(String(item.id)) : String(item.id);
      sourceEl = this._listEl?.querySelector?.(
        `.key[data-kp-item-type="${item.type}"][data-kp-item-id="${id}"], ` +
        `tr[data-kp-item-type="${item.type}"][data-kp-item-id="${id}"]`
      ) || null;
    } catch { /* ignore */ }
    this._beginPlaceMode(item, sourceEl);
  }

  _renderRightList() {
    const list = this._listEl;
    if (!list) return;
    const q = String(this._searchInput?.value || '').trim().toLowerCase();
    const viewBar = this._legendEl;
    list.replaceChildren();
    if (viewBar) list.appendChild(viewBar);
    this._syncLibViewSeg();
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

    const tab = this._libPrimaryTab;
    const showMacros = tab === 'all' || tab === 'macros';
    const showMacroKeys = tab === 'all' || tab === 'macroKeys';
    const showFunctions = tab === 'all' || tab === 'functions';

    if (this._libViewMode === 'table') {
      this._renderLibraryTable({
        list,
        q,
        tab,
        showMacros,
        showMacroKeys,
        showFunctions,
        assignedInfoByItemKey
      });
      return;
    }

    /**
     * One library card: a compact keycap (click to place, drag to a Reference slot) beside the
     * full label, any badges, and the card's action buttons.
     */
    const appendKeyItem = ({
      type, id, label, sublabel, keyboardClass, infoKey, badge, badgeClass, variant, functionId, kind
    }) => {
      const item = document.createElement('div');
      item.className = `kp-cfg-item${variant ? ` kp-cfg-variant-${variant}` : ''}`;
      item.dataset.kpItemType = type;
      item.dataset.kpItemId = id;
      item.draggable = true;
      if (this._inspectorSelection
        && this._inspectorSelection.type === type
        && this._inspectorSelection.id === id) {
        item.classList.add('kp-cfg-item-inspecting');
      }

      const keyEl = document.createElement('button');
      keyEl.type = 'button';
      keyEl.className = `key${keyboardClass ? ' ' + keyboardClass : ''}`;
      keyEl.draggable = true;
      keyEl.title = `${label} — click to place, or drag onto a Keyboard Reference key`;
      keyEl.dataset.kpItemType = type;
      keyEl.dataset.kpItemId = id;
      // FA background icons key off Function id (same as Keyboard Reference), not Action Instance id.
      const iconFunctionId = type === 'function'
        ? String(functionId || id || '')
        : '';
      if (type === 'function' && iconFunctionId) {
        try { keyEl.setAttribute('data-kp-action-id', iconFunctionId); } catch { /* ignore */ }
        ensureKeyBackgroundIcon(document, keyEl);
      } else if (type === 'macro') {
        try { keyEl.setAttribute('data-kp-macro-id', String(id)); } catch { /* ignore */ }
        ensureKeyBackgroundIcon(document, keyEl);
      }
      if (this._placeItem && this._placeItem.type === type && this._placeItem.id === id) {
        keyEl.classList.add('kp-place-source');
        item.classList.add('kp-place-source-item');
      }

      const main = document.createElement('div');
      main.className = 'key-main';
      this._fillKeyLabelLines(main, abbreviateLabel(label));

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

      const setDragData = (e) => {
        try {
          e.dataTransfer?.setData?.(KP_LAYOUT_ITEM_MIME, JSON.stringify({ type, id }));
          e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignore */ }
      };
      keyEl.addEventListener('dragstart', setDragData, true);
      item.addEventListener('dragstart', (e) => {
        if (e.target !== item && !(e.target instanceof Node && keyEl.contains(e.target))) return;
        setDragData(e);
      }, true);

      keyEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._beginPlaceMode({ type, id }, keyEl);
      }, true);

      item.addEventListener('click', (e) => {
        if (e.target?.closest?.('button, a, input, select, textarea')) return;
        this._inspectItem({ type, id });
        if (type === 'function' && getFunctionDef(id)) {
          this._selectedLibraryFunctionId = String(id);
          if (this._addStepSelect) this._addStepSelect.value = String(id);
        }
      }, true);

      const meta = document.createElement('div');
      meta.className = 'kp-cfg-card-meta';

      const name = document.createElement('div');
      name.className = 'kp-cfg-card-name';
      name.textContent = label;
      meta.appendChild(name);

      if (sublabel) {
        const sub = document.createElement('div');
        sub.className = 'kp-cfg-card-sub';
        sub.textContent = sublabel;
        meta.appendChild(sub);
      }

      const actionsRow = document.createElement('div');
      actionsRow.className = 'kp-cfg-card-actions';
      if (badge) {
        const chip = document.createElement('span');
        chip.className = `kp-cfg-badge${badgeClass ? ' ' + badgeClass : ''}`;
        chip.textContent = badge;
        actionsRow.appendChild(chip);
      }

      const inspectBtn = document.createElement('button');
      inspectBtn.type = 'button';
      inspectBtn.className = 'kp-cfg-inspect';
      setCfgBtnLabel(inspectBtn, 'Inspect', 'kp-cfg-i-eye');
      inspectBtn.title = `Inspect ${label}`;
      inspectBtn.setAttribute('aria-label', `Inspect ${label}`);
      inspectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._inspectItem({ type, id });
        if (type === 'function' && getFunctionDef(id)) {
          this._selectedLibraryFunctionId = String(id);
          if (this._addStepSelect) this._addStepSelect.value = String(id);
        }
      }, true);
      inspectBtn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
      actionsRow.appendChild(inspectBtn);

      meta.appendChild(actionsRow);
      item.appendChild(keyEl);
      item.appendChild(meta);
      return item;
    };

    /** @param {HTMLElement} card */
    const cardActions = (card) => card.querySelector('.kp-cfg-card-actions') || card;

    // Functions, Macros, and configured Macro Keys are all placeable Function-Library
    // items now (see KEY_ACTION_ARCHITECTURE.md's "Config panel tabs" row) so they render as
    // sections of one list, filtered by the primary tabs above.

    // Every Function in the unified Function Library (function-library.js) is browsable and
    // placeable here — built-ins, keystroke primitives (surfaced below as "Configured Macro
    // Keys" instead, so they're excluded here), Type Characters, and the Data/Lookup/
    // Translate/Display/Media Library Functions all render as sections of this same list. This
    // is what used to require a second, additive `function-library-panel.js` window.
    const allDefs = showFunctions
      ? listFunctionDefs().filter((d) => {
        if (!d || d.legacyMacroKeyKind) return false;
        if (tab === 'functions' && this._libFunctionCategory) {
          return (getFunctionCategory(d.id) || 'Other') === this._libFunctionCategory;
        }
        return true;
      })
      : [];
    const filteredDefs = sortFunctionDefsForLibrary(
      q
        ? allDefs.filter((d) => (
          `${d.id} ${d.label} ${d.description || ''} ${getFunctionCategory(d.id)}`
        ).toLowerCase().includes(q))
        : allDefs
    );

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
      section.dataset.kpSection = `fn-${String(cat).toLowerCase().replace(/\s+/g, '-')}`;
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
              sublabel: summarizeFunctionParameters(inst.functionId, inst.parameters),
              keyboardClass: def.keyboardClass || '',
              infoKey: `function:${inst.id}`,
              variant: 'configurable-fn',
              functionId: def.id
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
            cardActions(itemEl).appendChild(edit);
            if (def.worksWhileTyping) {
              itemEl.style.flexWrap = 'wrap';
              cardActions(itemEl).appendChild(this._renderBindChordButton({ type: 'function', id: inst.id }, def));
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
          sublabel: def.description || '',
          keyboardClass: def.keyboardClass || '',
          infoKey: `function:${def.id}`,
          variant: isFunctionInstantiable(def.id) ? 'configurable-fn' : 'stock-fn',
          functionId: def.id
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
          cardActions(itemEl).appendChild(conf);
        }

        if (def.worksWhileTyping) {
          itemEl.style.flexWrap = 'wrap';
          cardActions(itemEl).appendChild(this._renderBindChordButton({ type: 'function', id: def.id }, def));
        }

        grid.appendChild(itemEl);
      }
      section.appendChild(grid);
      list.appendChild(section);
    }

    if (showMacros) {
      const matchesQuery = (m) => !q || String(m?.label || '').toLowerCase().includes(q);
      const stockMacros = (this._st.stockMacros || []).filter((m) => m && m.id && matchesQuery(m));
      const userMacros = (this._st.macros || []).filter((m) => m && m.id && matchesQuery(m));

      const macrosSection = document.createElement('div');
      macrosSection.className = 'kp-cfg-category';
      macrosSection.dataset.kpSection = 'macros';
      const macrosTitle = document.createElement('div');
      macrosTitle.className = 'kp-cfg-category-title';
      macrosTitle.textContent = 'Macros';
      const newMacroBtn = document.createElement('button');
      newMacroBtn.type = 'button';
      newMacroBtn.className = 'kp-cfg-inspect';
      newMacroBtn.textContent = '+ New Macro';
      newMacroBtn.title = 'Start an empty macro in the User Macros builder';
      newMacroBtn.addEventListener('click', () => {
        this._resetMacroDraft(`Macro ${(this._st.macros || []).length + 1}`);
        this._setCreateMode('script', { open: true });
        this._inspectorSelection = null;
        this._setInspectorOpen(true);
        this._renderInspector();
      }, true);
      macrosTitle.appendChild(newMacroBtn);
      macrosSection.appendChild(macrosTitle);

      const subgroups = document.createElement('div');
      subgroups.className = 'kp-cfg-macro-subgroups';

      /**
       * @param {'stock'|'user'} groupId
       * @param {string} legendText
       * @param {any[]} macros
       * @param {boolean} stock
       * @param {string} emptyText
       */
      const renderMacroFieldset = (groupId, legendText, macros, stock, emptyText) => {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'kp-cfg-macro-fieldset';
        fieldset.dataset.macroGroup = groupId;
        const legendEl = document.createElement('legend');
        legendEl.textContent = legendText;
        fieldset.appendChild(legendEl);
        if (!macros.length) {
          const empty = document.createElement('p');
          empty.className = 'kp-cfg-subgroup-empty';
          empty.textContent = emptyText;
          fieldset.appendChild(empty);
          subgroups.appendChild(fieldset);
          return;
        }
        const grid = document.createElement('div');
        grid.className = 'kp-cfg-key-grid kp-cfg-grid-macros';
        for (const m of macros) {
          const stepCount = Array.isArray(m.steps) ? m.steps.length : 0;
          const itemEl = appendKeyItem({
            type: 'macro',
            id: m.id,
            label: String(m.label || 'Macro'),
            sublabel: `${stepCount} step${stepCount === 1 ? '' : 's'}`,
            keyboardClass: 'key-purple',
            infoKey: `macro:${m.id}`,
            badge: stock ? 'Stock' : 'User',
            badgeClass: stock ? 'kp-cfg-badge-stock' : 'kp-cfg-badge-user',
            variant: stock ? 'stock-macro' : 'user-macro'
          });
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'kp-cfg-inspect';
          edit.textContent = stock ? 'Customize' : 'Edit steps';
          edit.title = stock
            ? `Open an editable copy of ${m.label || 'Macro'}`
            : `Edit steps for ${m.label || 'Macro'}`;
          edit.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._openMacroStepsEditor(m);
          }, true);
          edit.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
          cardActions(itemEl).appendChild(edit);
          grid.appendChild(itemEl);
        }
        fieldset.appendChild(grid);
        subgroups.appendChild(fieldset);
      };

      renderMacroFieldset(
        'user',
        'User',
        userMacros,
        false,
        'None yet — click "+ New Macro", or Customize a stock macro.'
      );
      if (stockMacros.length || !q) {
        renderMacroFieldset('stock', 'Stock', stockMacros, true, 'None match.');
      }
      macrosSection.appendChild(subgroups);
      list.appendChild(macrosSection);
    }
    const macroKeys = showMacroKeys && Array.isArray(this._st.macroKeys) ? this._st.macroKeys : [];
    const macroKeyItems = q
      ? macroKeys.filter((m) => {
        const hay = `${m?.label || ''} ${m?.kind || ''} ${summarizeMacroKey(m)}`.toLowerCase();
        return hay.includes(q);
      })
      : macroKeys;
    if (showMacroKeys && (macroKeyItems.length || !q)) {
      const section = document.createElement('div');
      section.className = 'kp-cfg-category';
      section.dataset.kpSection = 'macroKeys';
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
            sublabel: summarizeMacroKey(m),
            keyboardClass: macroKeyKeyboardClass(m.kind),
            infoKey: `function:${m.id}`,
            badge: String(m.kind || ''),
            variant: 'macro-key',
            kind: m.kind,
            functionId: FUNCTION_ID_BY_MACRO_KEY_KIND[m.kind] || ''
          });
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
          cardActions(itemEl).appendChild(conf);
          grid.appendChild(itemEl);
        }
        section.appendChild(grid);
      } else {
        const empty = document.createElement('div');
        empty.className = 'kp-cfg-hint';
        empty.textContent = 'Create one from User Macros → Macro Key, configure it, then click its keycap to place it.';
        section.appendChild(empty);
      }
      list.appendChild(section);
    }
  }

  /**
   * Hierarchical Actions Library table (Phase 7). Same filters/data as the cards path.
   * @param {{
   *   list: HTMLElement,
   *   q: string,
   *   tab: string,
   *   showMacros: boolean,
   *   showMacroKeys: boolean,
   *   showFunctions: boolean,
   *   assignedInfoByItemKey: Map<string, { count: number, first: string }>
   * }} ctx
   */
  _renderLibraryTable(ctx) {
    const { list, q, tab, showMacros, showMacroKeys, showFunctions, assignedInfoByItemKey } = ctx;
    const wrap = document.createElement('div');
    wrap.className = 'kp-cfg-lib-table-wrap';
    const table = document.createElement('table');
    table.className = 'kp-cfg-lib-table';
    table.setAttribute('aria-label', 'Actions Library table');

    const colgroup = document.createElement('colgroup');
    for (const cls of [
      'kp-cfg-col-label', 'kp-cfg-col-kind', 'kp-cfg-col-summary',
      'kp-cfg-col-slots', 'kp-cfg-col-actions'
    ]) {
      const col = document.createElement('col');
      col.className = cls;
      colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const h of ['Label', 'Kind', 'Summary', 'Slots', 'Actions']) {
      const th = document.createElement('th');
      th.textContent = h;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    /**
     * @param {{
     *   groupKey: string,
     *   label: string,
     *   depth?: number,
     *   count?: number,
     *   kind?: string,
     *   trailing?: HTMLElement|null
     * }} opts
     */
    const appendGroupRow = ({ groupKey, label, depth = 0, count = 0, kind = '', trailing = null }) => {
      const expanded = this._isTableGroupExpanded(groupKey);
      const tr = document.createElement('tr');
      tr.className = 'kp-cfg-lib-row-group';
      tr.dataset.kpGroupKey = groupKey;

      const tdLabel = document.createElement('td');
      const cell = document.createElement('div');
      cell.className = 'kp-cfg-lib-label-cell';
      cell.style.paddingLeft = `${depth * 14}px`;

      const twisty = document.createElement('button');
      twisty.type = 'button';
      twisty.className = 'kp-cfg-lib-twisty';
      twisty.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      twisty.setAttribute('aria-label', expanded ? `Collapse ${label}` : `Expand ${label}`);
      twisty.textContent = expanded ? '▾' : '▸';
      twisty.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._toggleTableGroup(groupKey);
      }, true);

      const text = document.createElement('span');
      text.className = 'kp-cfg-lib-label-text';
      text.textContent = count > 0 ? `${label} (${count})` : label;
      cell.appendChild(twisty);
      cell.appendChild(text);
      tdLabel.appendChild(cell);

      const tdKind = document.createElement('td');
      tdKind.textContent = kind || '';
      const tdSummary = document.createElement('td');
      tdSummary.textContent = '';
      const tdSlots = document.createElement('td');
      tdSlots.textContent = '';
      const tdActions = document.createElement('td');
      if (trailing) tdActions.appendChild(trailing);

      tr.appendChild(tdLabel);
      tr.appendChild(tdKind);
      tr.appendChild(tdSummary);
      tr.appendChild(tdSlots);
      tr.appendChild(tdActions);
      tr.addEventListener('click', (e) => {
        if (e.target?.closest?.('button, a, input, select, textarea')) return;
        this._toggleTableGroup(groupKey);
      }, true);
      tbody.appendChild(tr);
      return expanded;
    };

    /**
     * @param {{
     *   type: string,
     *   id: string,
     *   label: string,
     *   kind: string,
     *   summary: string,
     *   depth?: number,
     *   variant?: string,
     *   functionId?: string,
     *   iconKind?: string,
     *   keyboardClass?: string,
     *   actions?: Array<{ label: string, title?: string, onClick: (e: Event) => void }>
     * }} opts
     */
    const appendLeafRow = ({
      type, id, label, kind, summary, depth = 1, variant, functionId, iconKind,
      keyboardClass = '', actions = []
    }) => {
      const tr = document.createElement('tr');
      tr.className = 'kp-cfg-lib-row-leaf';
      tr.dataset.kpItemType = type;
      tr.dataset.kpItemId = id;
      if (this._inspectorSelection
        && this._inspectorSelection.type === type
        && this._inspectorSelection.id === id) {
        tr.classList.add('kp-cfg-lib-row-inspecting');
      }
      if (this._placeItem && this._placeItem.type === type && this._placeItem.id === id) {
        tr.classList.add('kp-cfg-lib-row-place');
      }

      const tdLabel = document.createElement('td');
      const cell = document.createElement('div');
      cell.className = 'kp-cfg-lib-label-cell';
      cell.style.paddingLeft = `${depth * 14}px`;

      const keyEl = document.createElement('button');
      keyEl.type = 'button';
      keyEl.className = `key kp-cfg-lib-key${keyboardClass ? ` ${keyboardClass}` : ''}`;
      keyEl.draggable = true;
      keyEl.title = `${label} — drag onto a Keyboard Reference key, or click to place`;
      keyEl.dataset.kpItemType = type;
      keyEl.dataset.kpItemId = id;
      const iconFunctionId = type === 'function'
        ? String(functionId || id || '')
        : '';
      if (type === 'function' && iconFunctionId) {
        try { keyEl.setAttribute('data-kp-action-id', iconFunctionId); } catch { /* ignore */ }
        ensureKeyBackgroundIcon(document, keyEl);
      } else if (type === 'macro') {
        try { keyEl.setAttribute('data-kp-macro-id', String(id)); } catch { /* ignore */ }
        ensureKeyBackgroundIcon(document, keyEl);
      }
      if (this._placeItem && this._placeItem.type === type && this._placeItem.id === id) {
        keyEl.classList.add('kp-place-source');
      }
      const setDragData = (e) => {
        try {
          e.dataTransfer?.setData?.(KP_LAYOUT_ITEM_MIME, JSON.stringify({ type, id }));
          e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignore */ }
      };
      keyEl.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        setDragData(e);
      }, true);
      keyEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._beginPlaceMode({ type, id }, keyEl);
      }, true);
      cell.appendChild(keyEl);

      const text = document.createElement('span');
      text.className = 'kp-cfg-lib-label-text';
      text.textContent = label;
      cell.appendChild(text);
      tdLabel.appendChild(cell);

      const tdKind = document.createElement('td');
      tdKind.textContent = kind || '';
      const tdSummary = document.createElement('td');
      tdSummary.textContent = summary || '';
      tdSummary.title = summary || '';

      const info = assignedInfoByItemKey.get(`${type}:${id}`) || null;
      const tdSlots = document.createElement('td');
      if (info && info.count > 0) {
        tdSlots.textContent = info.count > 1 ? `×${info.count}` : String(info.first || '');
        tdSlots.title = info.count > 1
          ? `Assigned to ${info.count} slots`
          : `Assigned to ${info.first}`;
      } else {
        tdSlots.textContent = '—';
      }

      const tdActions = document.createElement('td');
      const actionsRow = document.createElement('div');
      actionsRow.className = 'kp-cfg-card-actions';

      const inspectBtn = document.createElement('button');
      inspectBtn.type = 'button';
      inspectBtn.className = 'kp-cfg-inspect';
      setCfgBtnLabel(inspectBtn, 'Inspect', 'kp-cfg-i-eye');
      inspectBtn.title = `Inspect ${label}`;
      inspectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._inspectItem({ type, id });
        if (type === 'function' && getFunctionDef(id)) {
          this._selectedLibraryFunctionId = String(id);
          if (this._addStepSelect) this._addStepSelect.value = String(id);
        }
      }, true);
      actionsRow.appendChild(inspectBtn);

      const placeBtn = document.createElement('button');
      placeBtn.type = 'button';
      placeBtn.className = 'kp-cfg-inspect';
      setCfgBtnLabel(placeBtn, 'Place', 'kp-cfg-i-place');
      placeBtn.title = `Place ${label} on a keyboard slot`;
      placeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._beginPlaceMode({ type, id }, keyEl);
      }, true);
      actionsRow.appendChild(placeBtn);

      for (const act of actions) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'kp-cfg-inspect';
        b.textContent = act.label;
        if (act.title) b.title = act.title;
        b.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          act.onClick(e);
        }, true);
        actionsRow.appendChild(b);
      }

      tdActions.appendChild(actionsRow);

      tr.addEventListener('click', (e) => {
        if (e.target?.closest?.('button, a, input, select, textarea')) return;
        this._inspectItem({ type, id });
        if (type === 'function' && getFunctionDef(id)) {
          this._selectedLibraryFunctionId = String(id);
          if (this._addStepSelect) this._addStepSelect.value = String(id);
        }
      }, true);

      tr.appendChild(tdLabel);
      tr.appendChild(tdKind);
      tr.appendChild(tdSummary);
      tr.appendChild(tdSlots);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    };

    /** Empty / hint leaf under a group. */
    const appendHintRow = (text, depth = 1) => {
      const tr = document.createElement('tr');
      tr.className = 'kp-cfg-lib-row-leaf';
      const td = document.createElement('td');
      td.colSpan = 5;
      td.style.paddingLeft = `${8 + depth * 14}px`;
      td.style.color = '#6a7a58';
      td.style.whiteSpace = 'normal';
      td.textContent = text;
      tr.appendChild(td);
      tbody.appendChild(tr);
    };

    const allDefs = showFunctions
      ? listFunctionDefs().filter((d) => {
        if (!d || d.legacyMacroKeyKind) return false;
        if (tab === 'functions' && this._libFunctionCategory) {
          return (getFunctionCategory(d.id) || 'Other') === this._libFunctionCategory;
        }
        return true;
      })
      : [];
    const filteredDefs = sortFunctionDefsForLibrary(
      q
        ? allDefs.filter((d) => (
          `${d.id} ${d.label} ${d.description || ''} ${getFunctionCategory(d.id)}`
        ).toLowerCase().includes(q))
        : allDefs
    );

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

    if (showFunctions && cats.length) {
      if (appendGroupRow({
        groupKey: 'functions',
        label: 'Functions',
        depth: 0,
        count: filteredDefs.length,
        kind: 'Group'
      })) {
        for (const cat of cats) {
          const items = byCat.get(cat) || [];
          if (!items.length) continue;
          const catKey = `functions:${String(cat).toLowerCase().replace(/\s+/g, '-')}`;
          if (!appendGroupRow({
            groupKey: catKey,
            label: cat,
            depth: 1,
            count: items.length,
            kind: 'Category'
          })) continue;

          for (const def of items) {
            const isFixedKey = FIXED_KEY_FUNCTION_IDS.includes(def.id);

            if (!isFixedKey && isFunctionInstantiable(def.id)) {
              const instances = (this._st.actions || []).filter((a) => a && a.functionId === def.id);
              const parentKey = `fn:${def.id}`;

              const addBtn = document.createElement('button');
              addBtn.type = 'button';
              addBtn.className = 'kp-cfg-inspect';
              addBtn.textContent = `+ New`;
              addBtn.title = def.description || `Create a new ${def.label} instance`;
              addBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
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

              if (appendGroupRow({
                groupKey: parentKey,
                label: def.label,
                depth: 2,
                count: instances.length,
                kind: 'Configurable',
                trailing: addBtn
              })) {
                if (!instances.length) {
                  appendHintRow('No instances yet — click + New.', 3);
                }
                instances.forEach((inst, index) => {
                  appendLeafRow({
                    type: 'function',
                    id: inst.id,
                    label: instances.length > 1 ? `${def.label} #${index + 1}` : def.label,
                    kind: 'Instance',
                    summary: summarizeFunctionParameters(inst.functionId, inst.parameters),
                    depth: 3,
                    variant: 'configurable-fn',
                    functionId: def.id,
                    keyboardClass: def.keyboardClass || '',
                    actions: [{
                      label: 'Edit',
                      title: `Configure ${def.label}`,
                      onClick: () => this._openActionParamsEditor(def, inst)
                    }]
                  });
                });
              }
              continue;
            }

            const leafActions = [];
            if (isFixedKey && actionHasParameters(def.id)) {
              leafActions.push({
                label: 'Config',
                title: `Configure ${def.label}`,
                onClick: async () => {
                  try { this._cancelPlaceMode(); } catch { /* ignore */ }
                  try {
                    const panel = getSharedKeyActionConfigPanel();
                    await panel.open(def.id, {
                      title: def.label,
                      anchorRect: list.getBoundingClientRect()
                    });
                  } catch { /* ignore */ }
                }
              });
            }
            appendLeafRow({
              type: 'function',
              id: def.id,
              label: def.label,
              kind: isFunctionInstantiable(def.id) ? 'Configurable' : 'Stock function',
              summary: def.description || '',
              depth: 2,
              variant: isFunctionInstantiable(def.id) ? 'configurable-fn' : 'stock-fn',
              functionId: def.id,
              keyboardClass: def.keyboardClass || '',
              actions: leafActions
            });
          }
        }
      }
    }
    if (showMacros) {
      const matchesQuery = (m) => !q || String(m?.label || '').toLowerCase().includes(q);
      const stockMacros = (this._st.stockMacros || []).filter((m) => m && m.id && matchesQuery(m));
      const userMacros = (this._st.macros || []).filter((m) => m && m.id && matchesQuery(m));
      const macroCount = userMacros.length + stockMacros.length;

      const newMacroBtn = document.createElement('button');
      newMacroBtn.type = 'button';
      newMacroBtn.className = 'kp-cfg-inspect';
      newMacroBtn.textContent = '+ New Macro';
      newMacroBtn.title = 'Start an empty macro in the User Macros builder';
      newMacroBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._resetMacroDraft(`Macro ${(this._st.macros || []).length + 1}`);
        this._setCreateMode('script', { open: true });
        this._inspectorSelection = null;
        this._setInspectorOpen(true);
        this._renderInspector();
      }, true);

      if (appendGroupRow({
        groupKey: 'macros',
        label: 'Macros',
        depth: 0,
        count: macroCount,
        kind: 'Group',
        trailing: newMacroBtn
      })) {
        if (appendGroupRow({
          groupKey: 'macros:user',
          label: 'User',
          depth: 1,
          count: userMacros.length,
          kind: 'User macros'
        })) {
          if (!userMacros.length) {
            appendHintRow('None yet — click "+ New Macro", or Customize a stock macro.', 2);
          }
          for (const m of userMacros) {
            const stepCount = Array.isArray(m.steps) ? m.steps.length : 0;
            appendLeafRow({
              type: 'macro',
              id: m.id,
              label: String(m.label || 'Macro'),
              kind: 'User macro',
              summary: `${stepCount} step${stepCount === 1 ? '' : 's'}`,
              depth: 2,
              variant: 'user-macro',
              keyboardClass: 'key-purple',
              actions: [{
                label: 'Edit steps',
                title: `Edit steps for ${m.label || 'Macro'}`,
                onClick: () => this._openMacroStepsEditor(m)
              }]
            });
          }
        }

        if (stockMacros.length || !q) {
          if (appendGroupRow({
            groupKey: 'macros:stock',
            label: 'Stock',
            depth: 1,
            count: stockMacros.length,
            kind: 'Stock macros'
          })) {
            if (!stockMacros.length) {
              appendHintRow('None match.', 2);
            }
            for (const m of stockMacros) {
              const stepCount = Array.isArray(m.steps) ? m.steps.length : 0;
              appendLeafRow({
                type: 'macro',
                id: m.id,
                label: String(m.label || 'Macro'),
                kind: 'Stock macro',
                summary: `${stepCount} step${stepCount === 1 ? '' : 's'}`,
                depth: 2,
                variant: 'stock-macro',
                keyboardClass: 'key-purple',
                actions: [{
                  label: 'Customize',
                  title: `Open an editable copy of ${m.label || 'Macro'}`,
                  onClick: () => this._openMacroStepsEditor(m)
                }]
              });
            }
          }
        }
      }
    }
    const macroKeys = showMacroKeys && Array.isArray(this._st.macroKeys) ? this._st.macroKeys : [];
    const macroKeyItems = q
      ? macroKeys.filter((m) => {
        const hay = `${m?.label || ''} ${m?.kind || ''} ${summarizeMacroKey(m)}`.toLowerCase();
        return hay.includes(q);
      })
      : macroKeys;
    if (showMacroKeys && (macroKeyItems.length || !q)) {
      if (appendGroupRow({
        groupKey: 'macroKeys',
        label: 'Configured Macro Keys',
        depth: 0,
        count: macroKeyItems.length,
        kind: 'Group'
      })) {
        if (!macroKeyItems.length) {
          appendHintRow(
            'Create one from User Macros → Macro Key, configure it, then Place it.',
            1
          );
        }
        for (const m of macroKeyItems) {
          if (!m || !m.id) continue;
          appendLeafRow({
            type: 'function',
            id: m.id,
            label: String(m.label || m.kind || 'Macro Key'),
            kind: String(m.kind || 'Macro Key'),
            summary: summarizeMacroKey(m),
            depth: 1,
            variant: 'macro-key',
            iconKind: m.kind,
            functionId: FUNCTION_ID_BY_MACRO_KEY_KIND[m.kind] || '',
            keyboardClass: macroKeyKeyboardClass(m.kind),
            actions: [{
              label: 'Edit',
              title: `Configure ${m.label || m.kind}`,
              onClick: () => this._openMacroKeyEditor(m)
            }]
          });
        }
      }
    }

    table.appendChild(tbody);
    wrap.appendChild(table);
    list.appendChild(wrap);
  }

  /**
   * A "Needs modifier" badge + "Bind modifier combo" button, appended to a placeable item for any
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
    setCfgBtnLabel(bindBtn, 'Bind modifier combo', 'kp-cfg-i-chord');
    bindBtn.dataset.kpBindIcon = 'kp-cfg-i-chord';
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
      const inferred = inferFamilyAndHandednessFromLayoutId(this._st.builtinLayoutId);
      const familyId = normalizeKeyboardLayoutFamilyId(
        this._kp?._settings?.keyboardLayoutFamilyId || inferred.familyId || 'browsing'
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
    this._setPlaceHint('Place mode — click a Keyboard Reference key (Esc to cancel).');

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
    this._setPlaceHint('Add Logic steps or Functions. Save commits the macro to Macros.');
  }

  /** @param {string} text */
  _setPlaceHint(text) {
    if (this._placeHintEl) this._placeHintEl.textContent = String(text || '');
  }

  /**
   * Lightweight cycle warning for nested Run Macro steps in the current draft.
   * @param {string|null|undefined} selfId
   * @param {any[]} steps
   * @returns {string}
   */
  _cycleWarningFor(selfId, steps) {
    const self = String(selfId || '');
    const list = Array.isArray(steps) ? steps : [];
    for (const step of list) {
      if ((step?.kind || '') !== 'runMacro') continue;
      const nested = String(step.macroId || '');
      if (!nested) continue;
      if (self && nested === self) return 'This macro calls itself — that will be blocked at runtime.';
      const nestedMacro = this._findMacroById(nested);
      const nestedSteps = nestedMacro?.steps || [];
      if (self && nestedSteps.some((s) => s?.kind === 'runMacro' && String(s.macroId || '') === self)) {
        return `Cycle risk with “${nestedMacro?.label || nested}” — runtime will stop nested loops.`;
      }
    }
    return '';
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
      // Placing onto a Keyboard Reference slot — leave for the slot click handler.
      const slot = getComposedEventElement(e, '[data-kp-slot]');
      if (closestComposed(slot, '.kp-floating-keyboard-help')) return;
      // Switching/toggling from a Config palette key — leave for that click handler.
      const source = getComposedEventElement(e, '[data-kp-item-type][data-kp-item-id]');
      if (source?.getRootNode?.() === this.shadowRoot) return;

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
      <path d="M0,0 L0,6 L9,3 z" fill="rgba(74,144,200,0.95)" />
    </marker>
  </defs>
  <line x1="0" y1="0" x2="0" y2="0" stroke="rgba(74,144,200,0.9)" stroke-width="2.5"
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
      for (const btn of this.shadowRoot?.querySelectorAll?.('[data-capturing="true"]') || []) {
        delete btn.dataset.capturing;
        if (btn.dataset.kpBindLabel) {
          setCfgBtnLabel(btn, btn.dataset.kpBindLabel, btn.dataset.kpBindIcon || '');
        }
      }
    } catch { /* ignore */ }
  }

  /**
   * Listen for the next keydown and, if it has a modifier held, bind `item` to the resulting
   * chord slot key — used for `worksWhileTyping` Functions that must run while a text field is
   * focused. The Keyboard Reference's click-to-place flow only ever targets bare physical keys.
   * See utils/key-chord.js. (No current catalog entries set `worksWhileTyping`; this remains for
   * future Functions.)
   * @param {{ type: string, id: string }} item
   * @param {string} functionId Used only for the `validateFunctionSlotKey` check.
   * @param {HTMLButtonElement} btn
   */
  _captureAndAssignChord(item, functionId, btn) {
    if (!item || !btn) return;
    this._cancelPlaceMode();
    this._stopChordCapture();
    btn.dataset.kpBindLabel = 'Bind modifier combo';
    btn.dataset.kpBindIcon = btn.dataset.kpBindIcon || 'kp-cfg-i-chord';
    btn.dataset.capturing = 'true';
    setCfgBtnLabel(btn, 'Press keys… (Esc)');

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
