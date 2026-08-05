/**
 * KeyPilot Chrome Extension - Frame Agent Bundle (child frames)
 * Generated on 2026-08-05T16:24:19.989Z
 */

(() => {
  // Global scope for bundled modules


  // Module: src/config/keyboard-layouts.js
/**
 * Keyboard layout architecture for KeyPilot.
 *
 * Goals:
 * - Separate "what an action does" from "which physical keys trigger it".
 * - Allow multiple built-in layouts today (right/left-handed browsing).
 * - Provide a single source of truth consumed by:
 *   - runtime keydown mapping (KeyPilot)
 *   - keyboard visualization (popup + floating keyboard reference)
 * - Future-proof for user-defined layouts (store user layouts separately; keep IDs stable).
 */

/**
 * @typedef {'browsing-right'|'browsing-left'} BuiltinKeyboardLayoutId
 * @typedef {BuiltinKeyboardLayoutId|string} KeyboardLayoutId
 */

/**
 * @typedef {{
 *   keys: string[],
 *   matchOn?: Array<'key'|'code'>,
 *   displayKey?: string,
 *   keyLabel?: string
 * }} KeyAssignment
 */

/**
 * @typedef {{
 *   handler: string,
 *   label: string,
 *   description: string,
 *   keyboardClass?: string|null,
 *   row?: number|null
 * }} ActionDef
 */

/**
 * @typedef {{
 *   id: BuiltinKeyboardLayoutId,
 *   label: string,
 *   description?: string,
 *   assignments: Record<string, KeyAssignment>,
 *   keyboardLayout: any[]
 * }} BuiltinKeyboardLayout
 */

const DEFAULT_KEYBOARD_LAYOUT_ID = /** @type {const} */ ('browsing-right');

const BUILTIN_KEYBOARD_LAYOUT_META = Object.freeze([
  Object.freeze({
    id: /** @type {const} */ ('browsing-right'),
    label: 'Browsing: right-handed',
    description: 'Mouse: right hand. Keyboard shortcuts primarily on the left side.'
  }),
  Object.freeze({
    id: /** @type {const} */ ('browsing-left'),
    label: 'Browsing: left-handed',
    description: 'Mouse: left hand. Keyboard shortcuts primarily on the right side.'
  })
]);

/**
 * @param {any} raw
 * @returns {BuiltinKeyboardLayoutId}
 */
function normalizeKeyboardLayoutId(raw) {
  const v = String(raw || '').trim();
  if (v === 'browsing-right' || v === 'browsing-left') return /** @type {BuiltinKeyboardLayoutId} */ (v);
  return DEFAULT_KEYBOARD_LAYOUT_ID;
}

/**
 * Canonical action definitions (no key assignments).
 * Keep this stable; it’s the contract between key mappings + handlers + UI.
 *
 * NOTE: This intentionally mirrors the old `KEYBINDINGS` metadata fields so we can
 * generate the legacy object shape used by existing code + build tooling.
 *
 * @type {Record<string, ActionDef>}
 */
const KEYBINDING_ACTION_DEFS = Object.freeze({
  ACTIVATE: Object.freeze({
    handler: 'handleActivateKey',
    label: 'Click Element',
    description: 'Click Element',
    keyboardClass: 'key-activate',
    row: 2
  }),
  // Foreground new tab (switch to the new tab).
  ACTIVATE_NEW_TAB: Object.freeze({
    handler: 'handleActivateNewTabKey',
    label: 'Click New Tab',
    description: 'Open Link in New Tab (Foreground)',
    keyboardClass: 'key-activate-new',
    row: 2
  }),
  // Background new tab (middle-click style; do not switch focus).
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({
    handler: 'handleActivateNewTabBackgroundKey',
    label: 'Click New Tab Background',
    description: 'Open Link in New Tab (Background, like middle click)',
    keyboardClass: 'key-activate-new-over',
    row: 2
  }),
  BACK: Object.freeze({
    handler: 'handleBackKey',
    label: 'Go Back',
    description: 'Go Back (History)',
    keyboardClass: 'key-back',
    row: 2
  }),
  BACK2: Object.freeze({
    handler: 'handleBackKey',
    label: 'Go Back',
    description: 'Go Back (History)',
    keyboardClass: 'key-back',
    row: 2
  }),
  FORWARD: Object.freeze({
    handler: 'handleForwardKey',
    label: 'Go Forward',
    description: 'Go Forward (History)',
    keyboardClass: 'key-forward',
    row: 1
  }),
  DELETE: Object.freeze({
    handler: 'handleDeleteKey',
    label: 'Delete Mode',
    description: 'Delete Mode',
    keyboardClass: 'key-delete',
    row: 2
  }),
  COLS_TOGGLE: Object.freeze({
    handler: 'handleColsToggleKey',
    label: 'Cols Toggle',
    description: 'Columnize element under cursor (multi-column layout)',
    keyboardClass: 'key-cols',
    row: 3
  }),
  TAB_LEFT: Object.freeze({
    handler: 'handleTabLeftKey',
    label: 'Tab Left',
    description: 'Move To Previous Tab',
    keyboardClass: 'key-gray',
    row: 1
  }),
  TAB_RIGHT: Object.freeze({
    handler: 'handleTabRightKey',
    label: 'Tab Right',
    description: 'Move To Next Tab',
    keyboardClass: 'key-gray',
    row: 1
  }),
  ROOT: Object.freeze({
    handler: 'handleRootKey',
    label: 'Go to Site Root',
    description: 'Go to Site Root',
    keyboardClass: null,
    row: null
  }),
  LAUNCHER: Object.freeze({
    handler: 'handleLauncherKey',
    label: 'Launcher',
    description: 'Open Launcher (Quick Access to Sites)',
    keyboardClass: 'key-launcher-orange',
    row: 2
  }),
  CLOSE_TAB: Object.freeze({
    handler: 'handleCloseTabKey',
    label: 'Close Tab',
    description: 'Close Tab',
    keyboardClass: 'key-close-tab',
    row: 3
  }),
  CANCEL: Object.freeze({
    handler: 'cancelModes',
    label: 'Exit Focus',
    description: 'Exit Focus',
    keyboardClass: null,
    row: null
  }),
  PAGE_UP_INSTANT: Object.freeze({
    handler: 'handleInstantPageUp',
    label: 'Page Up Fast',
    description: 'Page Up (Instant)',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  PAGE_DOWN_INSTANT: Object.freeze({
    handler: 'handleInstantPageDown',
    label: 'Page Down Fast',
    description: 'Page Down (Instant)',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  PAGE_TOP: Object.freeze({
    handler: 'handlePageTop',
    label: 'Scroll To Top',
    description: 'Scroll to Top',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  PAGE_BOTTOM: Object.freeze({
    handler: 'handlePageBottom',
    label: 'Scroll To Bottom',
    description: 'Scroll to Bottom',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  NEW_TAB: Object.freeze({
    handler: 'handleNewTabKey',
    label: 'New Tab',
    description: 'Open New Tab',
    keyboardClass: 'key-gray',
    row: 1
  }),
  OPEN_POPOVER: Object.freeze({
    handler: 'handleOpenPopover',
    label: 'Open Popover',
    description: 'Open Link in Popover',
    keyboardClass: 'key-open-popover',
    row: 2
  }),
  PREVIEW_LINK_POPOVER: Object.freeze({
    handler: 'handlePreviewLinkPopover',
    label: 'Preview Link',
    description: 'Open Link Preview in Popover',
    keyboardClass: 'key-preview-popover',
    row: 2
  }),
  OPEN_SETTINGS_POPOVER: Object.freeze({
    handler: 'handleToggleSettingsPopover',
    label: 'Settings',
    description: 'Open KeyPilot Settings',
    keyboardClass: 'key-settings-dark',
    row: null
  }),
  OMNIBOX: Object.freeze({
    handler: 'handleOpenOmnibox',
    label: 'Omnibox',
    description: 'Open Omnibox (Address Bar Overlay)',
    keyboardClass: 'key-orange',
    row: 2
  }),
  TAB_HISTORY: Object.freeze({
    handler: 'handleToggleTabHistoryPopover',
    label: 'Tab History',
    description: 'Open Tab History (Branch-Retaining)',
    keyboardClass: 'key-gray',
    row: 2
  }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({
    handler: 'handleToggleKeyboardHelp',
    label: 'KB Reference',
    description: 'Show/Hide the floating KeyPilot keyboard reference',
    keyboardClass: 'key-purple',
    row: 2
  }),
  // Text select: default character-level (H on right-handed layout).
  HIGHLIGHT: Object.freeze({
    handler: 'handleHighlightKey',
    label: 'Text Select',
    description: 'Select text (character level)',
    keyboardClass: 'key-highlight',
    row: 2
  }),
  // Rectangle region select (Y on right-handed; R free on left-handed).
  RECTANGLE_HIGHLIGHT: Object.freeze({
    handler: 'handleRectangleHighlightKey',
    label: 'Rectangle Select',
    description: 'Select text in a rectangle',
    keyboardClass: 'key-rect-highlight',
    row: 1
  }),
  // Copy image under cursor (I on right-handed; E on left-handed — I is OPEN_POPOVER there).
  COPY_HOVERED_IMAGE: Object.freeze({
    handler: 'handleCopyHoveredImageKey',
    label: 'Copy Image',
    description: 'Copy image under cursor to clipboard',
    // Default key face (no tinted key-gray / family fill).
    keyboardClass: null,
    row: 1
  })
});

function upperLetter(s) {
  const ch = String(s || '');
  if (!ch) return '';
  return ch.length === 1 ? ch.toUpperCase() : ch;
}

/**
 * @param {KeyAssignment} a
 * @returns {{ keyLabel: string, displayKey: string }}
 */
function normalizeAssignmentLabels(a) {
  const keys = Array.isArray(a?.keys) ? a.keys : [];
  const first = keys[0] || '';

  // If explicit labels were provided, trust them.
  const explicitDisplay = typeof a?.displayKey === 'string' ? a.displayKey : '';
  const explicitKeyLabel = typeof a?.keyLabel === 'string' ? a.keyLabel : '';
  if (explicitDisplay || explicitKeyLabel) {
    const dk = explicitDisplay || explicitKeyLabel;
    const kl = explicitKeyLabel || explicitDisplay;
    return { keyLabel: kl || dk || '', displayKey: dk || kl || '' };
  }

  // Default: single letter keys show as uppercase.
  if (typeof first === 'string' && first.length === 1 && /[a-zA-Z]/.test(first)) {
    const up = upperLetter(first);
    return { keyLabel: up, displayKey: up };
  }

  // Default fallback: use the first key token.
  return { keyLabel: String(first || ''), displayKey: String(first || '') };
}

/**
 * Build the legacy `KEYBINDINGS` object shape used throughout the codebase.
 *
 * @param {BuiltinKeyboardLayoutId} layoutId
 * @returns {Record<string, any>}
 */
function buildKeybindingsForLayout(layoutId) {
  const id = normalizeKeyboardLayoutId(layoutId);
  const layout = BUILTIN_KEYBOARD_LAYOUTS[id];
  const out = {};

  for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    const assign = layout?.assignments?.[actionId];
    if (!assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);

    out[actionId] = {
      keys: assign.keys.slice(),
      ...(Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {}),
      handler: def.handler,
      label: def.label,
      description: def.description,
      keyLabel: labels.keyLabel,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: labels.displayKey
    };
  }

  return out;
}

/**
 * @param {Record<string, KeyAssignment>} base
 * @returns {Record<string, KeyAssignment>}
 */
function cloneAssignments(base) {
  const out = {};
  for (const [k, v] of Object.entries(base || {})) {
    out[k] = {
      keys: Array.isArray(v?.keys) ? v.keys.slice() : [],
      ...(Array.isArray(v?.matchOn) ? { matchOn: v.matchOn.slice() } : {}),
      ...(typeof v?.displayKey === 'string' ? { displayKey: v.displayKey } : {}),
      ...(typeof v?.keyLabel === 'string' ? { keyLabel: v.keyLabel } : {})
    };
  }
  return out;
}

/**
 * Right-handed browsing (existing behavior).
 * @type {Record<string, KeyAssignment>}
 */
const ASSIGNMENTS_BROWSING_RIGHT = Object.freeze({
  TAB_LEFT: Object.freeze({ keys: ['q', 'Q'] }),
  TAB_RIGHT: Object.freeze({ keys: ['w', 'W'] }),
  OPEN_POPOVER: Object.freeze({ keys: ['p', 'P'] }),
  PREVIEW_LINK_POPOVER: Object.freeze({ keys: ['e', 'E'] }),
  FORWARD: Object.freeze({ keys: ['r', 'R'] }),
  NEW_TAB: Object.freeze({ keys: ['t', 'T'] }),

  CLOSE_TAB: Object.freeze({ keys: ['a', 'A'] }),
  BACK2: Object.freeze({ keys: ['s', 'S'] }),
  BACK: Object.freeze({ keys: ['d', 'D'] }),
  ACTIVATE: Object.freeze({ keys: ['f', 'F'] }),
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({ keys: ['g', 'G'] }),
  HIGHLIGHT: Object.freeze({ keys: ['h', 'H'] }),

  TAB_HISTORY: Object.freeze({ keys: ['j', 'J'] }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ['k', 'K'] }),
  OMNIBOX: Object.freeze({ keys: ['l', 'L'] }),
  LAUNCHER: Object.freeze({ keys: [';', ':', 'Semicolon', '`', '~', 'Backquote'], matchOn: ['key', 'code'], displayKey: ';', keyLabel: ';' }),

  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", 'Quote'], matchOn: ['key', 'code'], displayKey: "'" }),

  PAGE_TOP: Object.freeze({ keys: ['z', 'Z'] }),
  PAGE_BOTTOM: Object.freeze({ keys: ['x', 'X'] }),
  PAGE_UP_INSTANT: Object.freeze({ keys: ['c', 'C'] }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ['v', 'V'] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ['b', 'B'] }),
  RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ['y', 'Y'] }),
  COPY_HOVERED_IMAGE: Object.freeze({ keys: ['i', 'I'] }),

  ROOT: Object.freeze({ keys: ['1', '!'], displayKey: '1', keyLabel: '1' }),
  DELETE: Object.freeze({ keys: ['Backspace'], displayKey: 'Backspace', keyLabel: 'Backspace' }),
  COLS_TOGGLE: Object.freeze({ keys: ['.', '>'], displayKey: '.', keyLabel: '.' }),
  CANCEL: Object.freeze({ keys: ['Escape'], displayKey: 'Esc', keyLabel: 'Esc' })
});

/**
 * Left-handed browsing:
 * Move the main left-cluster to the right side to be comfortable for the right hand.
 *
 * Note: A few "UI utility" actions remain on the left side to avoid collisions with
 * primary actions on the right home cluster.
 *
 * @type {Record<string, KeyAssignment>}
 */
const ASSIGNMENTS_BROWSING_LEFT = Object.freeze({
  // Top row cluster: Q W E R T  ->  P O I U Y (mirrored)
  TAB_LEFT: Object.freeze({ keys: ['p', 'P'] }),
  TAB_RIGHT: Object.freeze({ keys: ['o', 'O'] }),
  OPEN_POPOVER: Object.freeze({ keys: ['i', 'I'] }),
  PREVIEW_LINK_POPOVER: Object.freeze({ keys: ['w', 'W'] }),
  FORWARD: Object.freeze({ keys: ['u', 'U'] }),
  NEW_TAB: Object.freeze({ keys: ['y', 'Y'] }),

  // Home row cluster: A S D F G  ->  ; L K J H (mirrored-ish around center)
  CLOSE_TAB: Object.freeze({ keys: [';', ':'], displayKey: ';', keyLabel: ';' }),
  BACK2: Object.freeze({ keys: ['l', 'L'] }),
  BACK: Object.freeze({ keys: ['k', 'K'] }),
  ACTIVATE: Object.freeze({ keys: ['j', 'J'] }),
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({ keys: ['h', 'H'] }),
  // H is background-tab open on left; G/R free for selection.
  HIGHLIGHT: Object.freeze({ keys: ['g', 'G'] }),
  RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ['r', 'R'] }),

  // Utility actions: keep on the left to avoid colliding with J/K/L cluster.
  TAB_HISTORY: Object.freeze({ keys: ['f', 'F'] }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ['d', 'D'] }),
  OMNIBOX: Object.freeze({ keys: ['s', 'S'] }),
  LAUNCHER: Object.freeze({ keys: ['a', 'A', '`', '~', 'Backquote'], matchOn: ['key', 'code'], displayKey: 'a/`', keyLabel: 'a/`' }),

  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", 'Quote'], matchOn: ['key', 'code'], displayKey: "'" }),

  // Bottom row cluster: Z X C V B  ->  / . , M N (mirrored)
  // Period reserved for COLS_TOGGLE (same muscle memory as right-handed).
  PAGE_TOP: Object.freeze({ keys: ['/', '?'], displayKey: '/', keyLabel: '/' }),
  PAGE_BOTTOM: Object.freeze({ keys: ['b', 'B'] }),
  PAGE_UP_INSTANT: Object.freeze({ keys: [',', '<'], displayKey: ',', keyLabel: ',' }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ['m', 'M'] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ['n', 'N'] }),
  COLS_TOGGLE: Object.freeze({ keys: ['.', '>'], displayKey: '.', keyLabel: '.' }),
  // I is OPEN_POPOVER on left-handed; E is free.
  COPY_HOVERED_IMAGE: Object.freeze({ keys: ['e', 'E'] }),

  ROOT: Object.freeze({ keys: ['1', '!'], displayKey: '1', keyLabel: '1' }),
  DELETE: Object.freeze({ keys: ['Backspace'], displayKey: 'Backspace', keyLabel: 'Backspace' }),
  CANCEL: Object.freeze({ keys: ['Escape'], displayKey: 'Esc', keyLabel: 'Esc' })
});

/**
 * Keyboard visualization layouts for the keybindings UI.
 * This is the same schema used by `src/ui/keybindings-ui-shared.js`.
 */
const KEYBOARD_UI_LAYOUT_RIGHT = Object.freeze([
  [
    { type: 'special', text: 'Tab', className: 'key key-tab' },
    { type: 'action', id: 'TAB_LEFT', fallbackText: 'Tab Left' },
    { type: 'action', id: 'TAB_RIGHT', fallbackText: 'Tab Right' },
    { type: 'action', id: 'PREVIEW_LINK_POPOVER', fallbackText: 'Preview Link' },
    { type: 'action', id: 'FORWARD', fallbackText: 'Go Forward' },
    { type: 'action', id: 'NEW_TAB', fallbackText: 'New Tab' },
    { type: 'action', id: 'RECTANGLE_HIGHLIGHT', fallbackText: 'Rectangle Select' },
    { type: 'key', text: 'U' },
    { type: 'action', id: 'COPY_HOVERED_IMAGE', fallbackText: 'Copy Image' },
    { type: 'key', text: 'O' },
    { type: 'action', id: 'OPEN_POPOVER', fallbackText: 'Open Popover' },
    { type: 'key', text: '[' },
    { type: 'key', text: ']' },
    { type: 'action', id: 'DELETE', fallbackText: 'Delete Mode', className: 'key key-backspace' }
  ],
  [
    { type: 'special', text: 'Caps', className: 'key key-caps' },
    { type: 'action', id: 'CLOSE_TAB', fallbackText: 'Close Tab' },
    { type: 'action', id: 'BACK2', fallbackText: 'Go Back' },
    { type: 'action', id: 'BACK', fallbackText: 'Go Back' },
    { type: 'action', id: 'ACTIVATE', fallbackText: 'Click Element' },
    { type: 'action', id: 'ACTIVATE_NEW_TAB_BACKGROUND', fallbackText: 'Click New Tab Background' },
    { type: 'action', id: 'HIGHLIGHT', fallbackText: 'Text Select' },
    { type: 'action', id: 'TAB_HISTORY', fallbackText: 'History' },
    { type: 'action', id: 'TOGGLE_KEYBOARD_HELP', fallbackText: 'KB Reference' },
    { type: 'action', id: 'OMNIBOX', fallbackText: 'Omnibox' },
    { type: 'action', id: 'LAUNCHER', fallbackText: 'Launcher' },
    { type: 'action', id: 'OPEN_SETTINGS_POPOVER', fallbackText: 'Settings' },
    { type: 'special', text: 'Enter', className: 'key key-enter' }
  ],
  [
    { type: 'special', text: 'Shift', className: 'key key-shift' },
    { type: 'action', id: 'PAGE_TOP', fallbackText: 'Scroll To Top' },
    { type: 'action', id: 'PAGE_BOTTOM', fallbackText: 'Scroll To Bottom' },
    { type: 'action', id: 'PAGE_UP_INSTANT', fallbackText: 'Page Up Fast' },
    { type: 'action', id: 'PAGE_DOWN_INSTANT', fallbackText: 'Page Down Fast' },
    { type: 'action', id: 'ACTIVATE_NEW_TAB', fallbackText: 'Click New Tab' },
    { type: 'key', text: 'N' },
    { type: 'key', text: 'M' },
    { type: 'key', text: ',' },
    { type: 'action', id: 'COLS_TOGGLE', fallbackText: 'Cols Toggle' },
    { type: 'key', text: '/' },
    { type: 'special', text: 'Shift', className: 'key key-shift' }
  ]
]);

// Left-handed UI layout: move the action clusters to the right-hand physical keys.
const KEYBOARD_UI_LAYOUT_LEFT = Object.freeze([
  [
    { type: 'special', text: 'Tab', className: 'key key-tab' },
    { type: 'key', text: 'Q' },
    { type: 'action', id: 'PREVIEW_LINK_POPOVER', fallbackText: 'Preview Link' }, // W
    { type: 'action', id: 'COPY_HOVERED_IMAGE', fallbackText: 'Copy Image' }, // E
    { type: 'action', id: 'RECTANGLE_HIGHLIGHT', fallbackText: 'Rectangle Select' }, // R
    { type: 'key', text: 'T' },
    { type: 'action', id: 'NEW_TAB', fallbackText: 'New Tab' }, // Y
    { type: 'action', id: 'FORWARD', fallbackText: 'Go Forward' }, // U
    { type: 'action', id: 'OPEN_POPOVER', fallbackText: 'Open Popover' }, // I
    { type: 'action', id: 'TAB_RIGHT', fallbackText: 'Tab Right' }, // O
    { type: 'action', id: 'TAB_LEFT', fallbackText: 'Tab Left' }, // P
    { type: 'key', text: '[' },
    { type: 'key', text: ']' },
    { type: 'action', id: 'DELETE', fallbackText: 'Delete Mode', className: 'key key-backspace' }
  ],
  [
    { type: 'special', text: 'Caps', className: 'key key-caps' },
    { type: 'action', id: 'LAUNCHER', fallbackText: 'Launcher' },
    // Utility keys on the left (to avoid colliding with right-hand cluster)
    { type: 'action', id: 'OMNIBOX', fallbackText: 'Omnibox' }, // S
    { type: 'action', id: 'TOGGLE_KEYBOARD_HELP', fallbackText: 'KB Reference' }, // D
    { type: 'action', id: 'TAB_HISTORY', fallbackText: 'History' }, // F
    { type: 'action', id: 'HIGHLIGHT', fallbackText: 'Text Select' }, // G
    { type: 'action', id: 'ACTIVATE_NEW_TAB_BACKGROUND', fallbackText: 'Click New Tab Background' }, // H
    { type: 'action', id: 'ACTIVATE', fallbackText: 'Click Element' }, // J
    { type: 'action', id: 'BACK', fallbackText: 'Go Back' }, // K
    { type: 'action', id: 'BACK2', fallbackText: 'Go Back' }, // L
    { type: 'action', id: 'CLOSE_TAB', fallbackText: 'Close Tab' }, // ;
    { type: 'action', id: 'OPEN_SETTINGS_POPOVER', fallbackText: 'Settings' }, // '
    { type: 'special', text: 'Enter', className: 'key key-enter' }
  ],
  [
    { type: 'special', text: 'Shift', className: 'key key-shift' },
    { type: 'key', text: 'Z' },
    { type: 'key', text: 'X' },
    { type: 'key', text: 'C' },
    { type: 'key', text: 'V' },
    { type: 'action', id: 'PAGE_BOTTOM', fallbackText: 'Scroll To Bottom' }, // B
    { type: 'action', id: 'ACTIVATE_NEW_TAB', fallbackText: 'Click New Tab' }, // N
    { type: 'action', id: 'PAGE_DOWN_INSTANT', fallbackText: 'Page Down Fast' }, // M
    { type: 'action', id: 'PAGE_UP_INSTANT', fallbackText: 'Page Up Fast' }, // ,
    { type: 'action', id: 'COLS_TOGGLE', fallbackText: 'Cols Toggle' }, // .
    { type: 'action', id: 'PAGE_TOP', fallbackText: 'Scroll To Top' }, // /
    { type: 'special', text: 'Shift', className: 'key key-shift' }
  ]
]);

/** @type {Record<BuiltinKeyboardLayoutId, BuiltinKeyboardLayout>} */
const BUILTIN_KEYBOARD_LAYOUTS = Object.freeze({
  'browsing-right': Object.freeze({
    id: 'browsing-right',
    label: 'Browsing: right-handed',
    description: 'Mouse: right hand. Keyboard shortcuts primarily on the left side.',
    assignments: ASSIGNMENTS_BROWSING_RIGHT,
    keyboardLayout: KEYBOARD_UI_LAYOUT_RIGHT
  }),
  'browsing-left': Object.freeze({
    id: 'browsing-left',
    label: 'Browsing: left-handed',
    description: 'Mouse: left hand. Keyboard shortcuts primarily on the right side.',
    assignments: ASSIGNMENTS_BROWSING_LEFT,
    keyboardLayout: KEYBOARD_UI_LAYOUT_LEFT
  })
});

/**
 * @param {BuiltinKeyboardLayoutId} layoutId
 * @returns {any[]}
 */
function getKeyboardUiLayoutForLayout(layoutId) {
  const id = normalizeKeyboardLayoutId(layoutId);
  return BUILTIN_KEYBOARD_LAYOUTS[id]?.keyboardLayout || BUILTIN_KEYBOARD_LAYOUTS[DEFAULT_KEYBOARD_LAYOUT_ID].keyboardLayout;
}
















  // Module: src/config/constants.js
/**
 * Application constants and configuration
 */

// Legacy export used across the codebase and by `extension/build.js`.
// This represents the *default* layout. Runtime code should prefer computing
// keybindings from the active settings/layout when available.
const KEYBINDINGS = buildKeybindingsForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);

const SELECTORS = {
  CLICKABLE: 'a[href], button, input, select, textarea',
  // Prefer IDL-backed checks via isTypingContext() when possible. These selectors
  // are best-effort for matches()/querySelector (note: bare <input> has no type attr).
  TEXT_INPUTS: 'input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], textarea',
  FOCUSABLE_TEXT: 'input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'
};

const ARIA_ROLES = {
  CLICKABLE: ['link', 'button']
};

/**
 * Semantic categories for interactive hover/activation targets.
 * Hover UI, F-key feedback, and activation should branch on category — not treat
 * every clickable the same as a hyperlink.
 *
 * Priority when classifying (most specific first):
 *   text > slider > button > link > media > control > generic
 */
const CLICKABLE_CATEGORY = {
  /** Nothing interactive under the pointer */
  NONE: 'none',
  /** Navigation: <a href>, role=link, data-kp-url rows */
  LINK: 'link',
  /** Discrete actions: <button>, role=button */
  BUTTON: 'button',
  /** Typing surfaces: text inputs, textarea, contenteditable */
  TEXT: 'text',
  /** Video/audio surface (thumbnail or player body) */
  MEDIA: 'media',
  /** Continuous value: range, role=slider, media scrub tracks */
  SLIDER: 'slider',
  /** Other form/ARIA controls: checkbox, radio, select, tab, switch, … */
  CONTROL: 'control',
  /** Non-semantic interactive (cursor:pointer, onclick, tracked click listener) */
  GENERIC: 'generic'
};

const CSS_CLASSES = {
  CURSOR_HIDDEN: 'kpv2-cursor-hidden',
  FOCUS: 'kpv2-focus',
  DELETE: 'kpv2-delete',
  HIGHLIGHT: 'kpv2-highlight',
  HIDDEN: 'kpv2-hidden',
  RIPPLE: 'kpv2-ripple',
  FOCUS_OVERLAY: 'kpv2-focus-overlay',
  /** Temporary outline that scales up on F-click activation */
  FOCUS_PULSE: 'kpv2-focus-pulse',
  /** Temporary outline with a marquee/chaser light traveling the perimeter on F-click */
  FOCUS_MARQUEE: 'kpv2-focus-marquee',
  /** Temporary hard flash (strobe) on F-click activation */
  FOCUS_FLASH: 'kpv2-focus-flash',
  /** Temporary dashed border whose dashes chase around the perimeter on F-click */
  FOCUS_DASH: 'kpv2-focus-dash',
  /** Temporary frame that scales (pop then shrink) when copying an image under cursor */
  IMAGE_COPY_PULSE: 'kpv2-image-copy-pulse',
  DELETE_OVERLAY: 'kpv2-delete-overlay',
  /**
   * Shared inspector-mode hover chrome (Delete, Cols, future pick tools).
   * Kind-specific colors applied via CSS vars / inline styles.
   */
  INSPECTOR: 'kpv2-inspector',
  INSPECTOR_OVERLAY: 'kpv2-inspector-overlay',
  /** Top-right companion instruction while inspector pick is active (like highlight mode) */
  INSPECTOR_MODE_INDICATOR: 'kpv2-inspector-mode-indicator',
  /** @deprecated prefer INSPECTOR + kind; kept for style/compat during transition */
  COLS: 'kpv2-cols',
  COLS_OVERLAY: 'kpv2-cols-overlay',
  /** Applied multicol layout on the chosen target */
  COLS_ACTIVE: 'kpv2-cols-active',
  /** Page-mode markers on html/body while whole-page columns are active */
  COLS_PAGE: 'kpv2-cols-page',
  /** Widget shell wrapping a columnized target (outline + slip chrome) */
  COLS_SHELL: 'kpv2-cols-shell',
  /** Content region inside the shell that holds the target */
  COLS_BODY: 'kpv2-cols-body',
  /** Placeholder left in flow when shell is promoted to a popover */
  COLS_PLACEHOLDER: 'kpv2-cols-placeholder',
  /** Slip-edit chrome (NLE-style content window scrubber) */
  COLS_SLIP_BAR: 'kpv2-cols-slip-bar',
  COLS_SLIP_TRACK: 'kpv2-cols-slip-track',
  COLS_SLIP_KNOB: 'kpv2-cols-slip-knob',
  COLS_SLIP_LABEL: 'kpv2-cols-slip-label',
  /** Slip-bar action: promote columns widget to floating popover */
  COLS_EXPAND_BTN: 'kpv2-cols-expand-btn',
  /** Slip-bar action: clear columns / restore element */
  COLS_CLOSE_BTN: 'kpv2-cols-close-btn',
  HIGHLIGHT_OVERLAY: 'kpv2-highlight-overlay',
  HIGHLIGHT_SELECTION: 'kpv2-highlight-selection',
  TEXT_FIELD_GLOW: 'kpv2-text-field-glow',
  VIEWPORT_MODAL_FRAME: 'kpv2-viewport-modal-frame',
  ESC_EXIT_LABEL: 'kpv2-esc-exit-label',
  TEXT_FOCUS_INPUT: 'kpv2-text-focus-input',
  TEXT_FOCUS_INPUT_PARENT: 'kpv2-text-focus-input-parent',
  /** Modifier: focused text field uses left-edge 10px pulsating bar (default style). */
  TEXT_FOCUS_LEFT_EDGE: 'kpv2-text-focus-left-edge',
  TEXT_HOVER_INPUT: 'kpv2-text-hover-input',
  TEXT_HOVER_INPUT_PARENT: 'kpv2-text-hover-input-parent',

  /** Canvas-based focus/delete overlay host (OverlayManager) */
  CANVAS_OVERLAY: 'kpv2-canvas-overlay',
  /** CSS custom-properties focus/delete overlay host (OverlayManager) */
  CSS_PROPS_OVERLAY: 'kpv2-css-props-overlay',

  // Omnibox overlay UI
  OMNIBOX_BACKDROP: 'kpv2-omnibox-backdrop',
  OMNIBOX_PANEL: 'kpv2-omnibox-panel',
  OMNIBOX_INPUT: 'kpv2-omnibox-input',
  OMNIBOX_SUGGESTIONS: 'kpv2-omnibox-suggestions',
  OMNIBOX_SUGGESTION: 'kpv2-omnibox-suggestion',
  OMNIBOX_EMPTY: 'kpv2-omnibox-empty',

  // PopupManager (shared backdrop for modals/popups that should blur the page)
  POPUP_BACKDROP: 'kpv2-popup-backdrop'
};

const ELEMENT_IDS = {
  CURSOR: 'kpv2-cursor',
  STYLE: 'kpv2-style'
};

const Z_INDEX = {
  // Utility layers (occasionally used for measurement elements)
  PAGE_BEHIND: -1,
  DEFAULT: 1,

  // Keep all KeyPilot UI comfortably above typical site z-index values.
  // Note: Many browsers effectively clamp very large z-index values; using a
  // high-but-safe base avoids accidental collisions and keeps ordering clear.
  _BASE: 2147483000,

  // Low-ish KeyPilot overlays
  VIEWPORT_MODAL_FRAME: 2147483010,
  HIGHLIGHT_SELECTION: 2147483015,

  // PopupManager layers (kept BELOW click overlays so the green click rectangle can sit above popups)
  POPUP_BACKDROP: 2147483009,
  POPUP_PANEL_BASE: 2147483012,
  POPUP_PANEL_MAX: 2147483017,

  // Focus/delete/highlight overlays
  OVERLAYS_BELOW_2: 2147483018,
  OVERLAYS_BELOW: 2147483019,
  OVERLAYS: 2147483020,
  OVERLAYS_ABOVE: 2147483021,

  // macOS-style control strip (upper-left; stays at top; below walkthrough in z-order)
  CONTROL_STRIP: 2147483025,

  // Onboarding walkthrough (top-left, stacked below the control strip on screen).
  // z-index above the strip so if they ever overlap the panel wins; still below
  // green hover/click overlays and floating keyboard help.
  ONBOARDING_PANEL: 2147483026,

  // Cols Toggle slip-edit bar (bottom of viewport; below keyboard help / cursor)
  COLS_SLIP_BAR: 2147483030,

  // Iframe-based popover modal (Open Popover)
  POPOVER_IFRAME_MODAL: 2147483035,

  // Notifications / message overlays
  MESSAGE_BOX: 2147483040,
  DEBUG_HUD: 2147483041,
  NOTIFICATION: 2147483040,

  // Omnibox overlay (should sit above most UI, but below keyboard help + cursor)
  OMNIBOX: 2147483042,

  // Floating keyboard reference + key-click tooltip (above page UI, below cursor)
  FLOATING_KEYBOARD_HELP: 2147483045,
  KEYBINDINGS_POPOVER: 2147483046,

  // Cursor should remain above everything else.
  CURSOR: 2147483050
};

/**
 * Scroll distances / behavior for page / popover keyboard scrolling (defaults).
 * Runtime values can be overridden via Settings (`kp_settings_v1.scroll`).
 * Used by key handlers and popover iframe bridges.
 *
 * C / V (half-page) use cursor-aware scrolling (`scroll-at-point.js`):
 * nested overflow under the pointer first (vertical, or horizontal when that
 * container scrolls on X), then the document. Iframes are forwarded via the
 * light frame-click-agent (KP_FRAME_SCROLL).
 */
const SCROLL = Object.freeze({
  /** Z / X (and popover equivalents): large page step */
  PAGE_PX: 800,
  /** C / V: smaller step (default = prior 400px × 1.25) */
  HALF_PAGE_PX: 500,
  /** Default CSS scroll-behavior for keyboard scrolling */
  BEHAVIOR: 'smooth'
});

const MODES = {
  NONE: 'none',
  /**
   * Shared element-pick inspector (DOM inspector style).
   * Concrete tool is state.inspectorKind (see INSPECTOR_KIND).
   * Used by Delete Mode, Cols Toggle, and future pick tools.
   */
  INSPECTOR: 'inspector',
  /**
   * @deprecated Use MODES.INSPECTOR + INSPECTOR_KIND.DELETE.
   * Kept so older status strings / comparisons still resolve if needed.
   */
  DELETE: 'delete',
  /**
   * @deprecated Use MODES.INSPECTOR + INSPECTOR_KIND.COLS.
   */
  COLS: 'cols',
  TEXT_FOCUS: 'text_focus',
  HIGHLIGHT: 'highlight',
  POPOVER: 'popover',
  OMNIBOX: 'omnibox'
};

/**
 * Inspector tool kinds while mode === MODES.INSPECTOR.
 * Register visuals/behavior in modules/inspector-mode.js.
 */
const INSPECTOR_KIND = Object.freeze({
  DELETE: 'delete',
  COLS: 'cols'
});

// Cursor behavior mode:
// - NO_CUSTOM_CURSORS: KeyPilot does not override the page cursor at all.
// - CUSTOM_CURSORS: KeyPilot applies its cursor styling/overrides (current legacy behavior).
const CURSOR_MODE = Object.freeze({
  NO_CUSTOM_CURSORS: 'NO-CUSTOM-CURSORS',
  CUSTOM_CURSORS: 'CUSTOM-CURSORS'
});

/**
 * System UI font for KeyPilot chrome injected into host pages.
 * Pin this on popovers/titlebars so site body fonts (e.g. freight-text-pro) cannot leak in.
 * Single declaration — the content bundle is one IIFE scope (no per-module consts of the same name).
 */
const KP_UI_FONT =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const COLORS = {
  // Primary cursor colors
  FOCUS_GREEN: 'rgba(0,180,0,0.95)',
  FOCUS_GREEN_BRIGHT: 'rgba(0,128,0,0.95)',
  DELETE_RED: 'rgba(220,0,0,0.95)',
  /** Cols Toggle accent (purple, distinct from delete red / highlight blue) */
  COLS_PURPLE: 'rgba(156,39,176,0.95)',
  COLS_PURPLE_BRIGHT: 'rgba(186,104,200,0.95)',
  HIGHLIGHT_BLUE: 'rgba(0,120,255,0.95)',
  ORANGE: '#ff8c00',
  // Focus overlay (alternate) colors (used to visually distinguish DOM-hover targeting mode)
  FOCUS_BLUE: 'rgba(33,150,243,0.95)',

  // Text and background colors
  TEXT_WHITE_PRIMARY: 'rgba(255,255,255,0.95)',
  TEXT_WHITE_SECONDARY: 'rgba(255,255,255,0.8)',
  TEXT_GREEN_BRIGHT: '#6ced2b',

  // Background colors
  MESSAGE_BG_BROWN: '#ad6007',
  MESSAGE_BG_GREEN: '#10911b',

  // Border and shadow colors
  ORANGE_BORDER: 'rgba(255,140,0,0.4)',
  ORANGE_SHADOW: 'rgba(255,140,0,0.45)',
  ORANGE_SHADOW_DARK: 'rgba(255,140,0,0.8)',
  ORANGE_SHADOW_LIGHT: 'rgba(255,140,0,0.3)',
  GREEN_SHADOW: 'rgba(0,180,0,0.45)',
  GREEN_SHADOW_BRIGHT: 'rgba(0,180,0,0.5)',
  BLUE_SHADOW: 'rgba(33,150,243,0.35)',
  BLUE_SHADOW_BRIGHT: 'rgba(33,150,243,0.45)',
  DELETE_SHADOW: 'rgba(220,0,0,0.35)',
  DELETE_SHADOW_BRIGHT: 'rgba(220,0,0,0.45)',
  COLS_SHADOW: 'rgba(156,39,176,0.35)',
  COLS_SHADOW_BRIGHT: 'rgba(156,39,176,0.5)',
  HIGHLIGHT_SHADOW: 'rgba(0,120,255,0.35)',
  HIGHLIGHT_SHADOW_BRIGHT: 'rgba(0,120,255,0.45)',
  BLACK_SHADOW: 'rgba(40, 40, 40, 0.7)',

  // Ripple effect colors
  RIPPLE_GREEN: 'rgba(0,200,0,0.35)',
  RIPPLE_GREEN_MID: 'rgba(0,200,0,0.22)',
  RIPPLE_GREEN_TRANSPARENT: 'rgba(0,200,0,0)',

  // Flash animation colors
  FLASH_GREEN: 'rgba(0,255,0,1)',
  FLASH_GREEN_SHADOW: 'rgba(0,255,0,0.8)',
  FLASH_GREEN_GLOW: 'rgba(0,255,0,0.9)',

  // Image-copy pulse (distinct from green F-click pulse)
  IMAGE_COPY_FRAME: 'rgba(33,150,243,0.95)',
  IMAGE_COPY_FRAME_SHADOW: 'rgba(33,150,243,0.55)',
  IMAGE_COPY_FRAME_GLOW: 'rgba(100,180,255,0.75)',
  IMAGE_COPY_FILL: 'rgba(33,150,243,0.14)',
  IMAGE_COPY_FLASH: 'rgba(255,255,255,0.45)',

  // Notification colors
  NOTIFICATION_SUCCESS: '#4CAF50',
  NOTIFICATION_ERROR: '#f44336',
  NOTIFICATION_WARNING: '#ff9800',
  NOTIFICATION_INFO: '#2196F3',
  NOTIFICATION_SHADOW: 'rgba(0, 0, 0, 0.15)',

  // Text field glow
  TEXT_FIELD_GLOW: 'rgba(255,165,0,0.8)',

  // Highlight selection colors
  HIGHLIGHT_SELECTION_BG: 'rgba(0,120,255,0.3)',
  HIGHLIGHT_SELECTION_BORDER: 'rgba(0,120,255,0.6)',

  // New colors for ESC exit labels
  ORANGE_BG: 'rgba(255, 165, 0, 0.9)',
  ORANGE_TEXT: '#fff',
  ORANGE_BORDER: '#d35400',
  FOCUS_GREEN_BG: 'rgba(46, 204, 113, 0.9)',
  FOCUS_GREEN_BG_T2: 'rgba(46, 204, 113, 0.4)',
  FOCUS_GREEN_TEXT: '#fff',
  FOCUS_GREEN: '#27ae60',
  FOCUS_BLUE_BG_T2: 'rgba(33,150,243,0.25)'
};

// Legacy scale-based cursor storage (keypilot_cursor_size / keypilot_cursor_visible)
// was removed. Cursor appearance lives in kp_settings_v1 via settings-manager
// (clickMode.cursor + cursorMode).

const RECTANGLE_SELECTION = {
  // Visual rectangle settings
  MIN_WIDTH: 3,           // Minimum rectangle width to show (pixels)
  MIN_HEIGHT: 3,          // Minimum rectangle height to show (pixels)
  MIN_DRAG_DISTANCE: 5,   // Minimum drag distance to start selection (pixels)

  // Visual feedback settings
  SHOW_IMMEDIATE_FEEDBACK: true,        // Show rectangle for any movement
  HIDE_ZERO_SIZE: false,                // Don't hide zero-size rectangles

  // Performance limits (should match browser capabilities)
  MAX_AREA_PIXELS: 50000000,           // 50M pixels (e.g., 10000x5000) - very generous limit
  MAX_TEXT_NODES: 10000,               // Maximum text nodes to process - matches browser selection limits
  ENABLE_AREA_LIMIT: false,            // Disable area limiting by default - browsers handle large selections fine
  ENABLE_NODE_LIMIT: true,             // Keep node limit as safety measure for DOM traversal performance

  // Performance notes:
  // - Area limits are disabled by default because browsers can handle enormous text selections
  // - Node limits remain enabled to prevent DOM traversal performance issues on complex pages
  // - These limits only apply to rectangle selection, not manual browser selection
  // - The clipboard is typically the real limiting factor, not the selection itself
};

const EDGE_ONLY_SELECTION = {
  // Smart Targeting Options
  SMART_TARGETING: {
    ENABLED: true,                     // Enable smart element targeting
    TEXT_ELEMENT_TAGS: [               // HTML tags that commonly contain text
      'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'li', 'td', 'th', 'a', 'strong', 'em', 'b', 'i', 'u',
      'blockquote', 'pre', 'code', 'label', 'legend', 'article',
      'section', 'header', 'footer', 'main', 'aside', 'nav'
    ],
    SKIP_ELEMENT_TAGS: [               // HTML tags to skip (non-text elements)
      'img', 'video', 'audio', 'canvas', 'svg', 'iframe',
      'script', 'style', 'noscript', 'object', 'embed'
    ],
    MIN_TEXT_LENGTH: 1,                // Minimum text content length to consider
    CHECK_COMPUTED_STYLE: true,        // Check if element is visible via computed style
    INCLUDE_ARIA_LABELS: true,         // Include elements with aria-label/aria-labelledby
    MAX_ELEMENTS_TO_OBSERVE: 5000,     // Maximum elements to observe simultaneously
  },

  // Character Detection Settings
  CHARACTER_DETECTION: {
    ENABLED: true,                     // Enable edge-level character detection
    USE_RANGE_API: true,               // Use Range API for precise character positioning
    CACHE_CHARACTER_POSITIONS: true,   // Cache character positions using WeakMap
    CHARACTER_CACHE_SIZE: 1000,        // Maximum characters to cache per element
    BOUNDARY_DETECTION_PRECISION: 1,   // Pixel precision for boundary detection
    BATCH_CHARACTER_PROCESSING: true,  // Process characters in batches
    CHARACTER_BATCH_SIZE: 50,          // Number of characters to process per batch
    MAX_CHARACTERS_PER_ELEMENT: 10000, // Maximum characters to process per element
  },

  // Cache Configuration
  CACHE_CONFIGURATION: {
    ELEMENT_CACHE_SIZE: 1000,          // Maximum number of elements to cache
    CHARACTER_CACHE_SIZE: 5000,        // Maximum number of character positions to cache
    CACHE_CLEANUP_THRESHOLD: 800,      // Start cleanup when cache reaches this size
    CACHE_CLEANUP_BATCH_SIZE: 200,     // Number of entries to remove during cleanup
    ENABLE_PREDICTIVE_CACHING: true,   // Pre-cache elements likely to intersect
    PREDICTIVE_CACHE_DISTANCE: 100,    // Distance in pixels to pre-cache elements
    CACHE_TTL_MS: 30000,               // Time-to-live for cached entries (30 seconds)
    ENABLE_CACHE_COMPRESSION: false,   // Enable cache compression (experimental)
  },

  // Performance Monitoring Configuration
  PERFORMANCE_MONITORING: {
    ENABLED: false,                     // Enable performance monitoring
    MONITORING_INTERVAL: 1000,         // How often to check performance (ms)
    COLLECT_DETAILED_METRICS: true,    // Collect detailed performance metrics
    TRACK_CACHE_EFFICIENCY: true,      // Track cache hit/miss ratios
    TRACK_PROCESSING_TIME: true,       // Track processing time per operation
    TRACK_MEMORY_USAGE: true,          // Track memory usage
    PERFORMANCE_LOG_INTERVAL: 5000,    // How often to log performance stats (ms)
    ENABLE_PERFORMANCE_ALERTS: true,   // Enable performance degradation alerts
  },

  // Fallback Configuration
  FALLBACK_CONFIGURATION: {
    ENABLED: true,                     // Enable automatic fallback
    FALLBACK_THRESHOLD_MS: 15,         // Fall back to spatial if processing exceeds this
    MAX_CONSECUTIVE_FAILURES: 3,       // Max failures before fallback
    FALLBACK_RECOVERY_ATTEMPTS: 5,     // Attempts to recover from fallback
    FALLBACK_RECOVERY_DELAY: 2000,     // Delay between recovery attempts (ms)
    ENABLE_GRACEFUL_DEGRADATION: true, // Enable graceful performance degradation
    FALLBACK_TO_SPATIAL_METHOD: true,  // Fallback to spatial intersection method
  },

  // Performance Thresholds
  MAX_PROCESSING_TIME_MS: 10,          // Maximum time for edge processing (ms)
  MAX_ELEMENTS_PER_UPDATE: 50,         // Maximum elements to process per update
  FALLBACK_THRESHOLD_MS: 15,           // Fall back to spatial if processing exceeds this
  CACHE_HIT_RATIO_THRESHOLD: 0.7,     // Minimum acceptable cache hit ratio

  // Memory Management
  MAX_MEMORY_USAGE_MB: 50,             // Maximum memory usage for edge-only processing
  MEMORY_CHECK_INTERVAL: 5000,        // How often to check memory usage (ms)
  ENABLE_MEMORY_MONITORING: true,     // Monitor memory usage and cleanup
  GARBAGE_COLLECTION_THRESHOLD: 0.8,  // Trigger cleanup at 80% of memory limit

  // Processing Options
  INTERSECTION_OBSERVER_THRESHOLDS: [0, 0.1, 0.5, 1.0], // Multiple thresholds for granular updates
  BATCH_PROCESSING_SIZE: 10,           // Process elements in batches of this size
  ENABLE_ADAPTIVE_PROCESSING: true,    // Adjust processing based on page complexity
  FRAME_RATE_TARGET: 60,               // Target frame rate during drag operations

  // Adaptive Processing Settings (Task 2.1)
  PAGE_COMPLEXITY_ANALYSIS: {
    ENABLE_COMPLEXITY_ANALYSIS: false,   // Enable page complexity analysis
    ELEMENT_COUNT_THRESHOLD_LOW: 500,   // Low complexity threshold
    ELEMENT_COUNT_THRESHOLD_HIGH: 2000, // High complexity threshold
    DOM_DEPTH_THRESHOLD_LOW: 10,        // Low DOM depth threshold
    DOM_DEPTH_THRESHOLD_HIGH: 20,       // High DOM depth threshold
    TEXT_NODE_DENSITY_THRESHOLD: 0.3,   // Text node density threshold
    COMPLEXITY_CHECK_INTERVAL: 10000,   // How often to analyze page complexity (ms)
  },

  FRAME_RATE_PROCESSING: {
    TARGET_FPS: 60,                     // Target frame rate during drag operations
    FRAME_TIME_BUDGET_MS: 16.67,        // Time budget per frame (1000ms / 60fps)
    PROCESSING_TIME_BUDGET_MS: 8,       // Max processing time per frame
    FRAME_RATE_MONITORING_WINDOW: 10,   // Number of frames to monitor for rate calculation
    MIN_ACCEPTABLE_FPS: 30,             // Minimum acceptable frame rate
    FRAME_RATE_ADJUSTMENT_FACTOR: 0.8,  // Reduce processing when frame rate drops
  },

  BATCH_PROCESSING: {
    ENABLE_BATCH_PROCESSING: true,      // Enable batch processing optimization
    DEFAULT_BATCH_SIZE: 5,              // Default batch size for processing
    MAX_BATCH_SIZE: 20,                 // Maximum batch size
    MIN_BATCH_SIZE: 1,                  // Minimum batch size
    BATCH_TIMEOUT_MS: 4,                // Maximum time to wait for batch completion
    ADAPTIVE_BATCH_SIZING: true,        // Adjust batch size based on performance
  },

  QUALITY_ADJUSTMENTS: {
    ENABLE_QUALITY_ADJUSTMENTS: true,   // Enable quality adjustments based on available time
    HIGH_QUALITY_TIME_THRESHOLD: 5,     // Time threshold for high quality processing (ms)
    MEDIUM_QUALITY_TIME_THRESHOLD: 10,  // Time threshold for medium quality processing (ms)
    LOW_QUALITY_PROCESSING_LIMIT: 20,   // Maximum elements to process in low quality mode
    QUALITY_ADJUSTMENT_HYSTERESIS: 2,   // Frames to wait before quality adjustment
  },

  // Predictive Caching Settings (Task 2.2)
  PREDICTIVE_CACHING: {
    ENABLE_PREDICTIVE_CACHING: true,    // Enable predictive caching strategies
    ENABLE_USER_BEHAVIOR_ANALYSIS: true, // Analyze user behavior patterns
    ENABLE_VIEWPORT_BASED_CACHING: true, // Cache based on viewport position
    ENABLE_SCROLL_PREDICTION: true,     // Predict scroll direction and cache ahead

    // User behavior analysis
    BEHAVIOR_PATTERN_WINDOW: 20,        // Number of recent interactions to analyze
    INTERACTION_TIMEOUT_MS: 2000,       // Time between interactions to consider separate
    MIN_PATTERN_CONFIDENCE: 0.6,        // Minimum confidence to act on patterns
    PATTERN_ANALYSIS_INTERVAL: 5000,    // How often to analyze patterns (ms)

    // Viewport-based caching
    VIEWPORT_CACHE_MARGIN: 200,         // Pixels beyond viewport to cache
    VIEWPORT_CACHE_SECTORS: 9,          // Divide viewport into sectors for caching
    CACHE_WARMING_DISTANCE: 300,        // Distance ahead to warm cache (pixels)
    VIEWPORT_UPDATE_THROTTLE: 100,      // Throttle viewport updates (ms)

    // Scroll prediction
    SCROLL_VELOCITY_SAMPLES: 5,         // Number of scroll samples for velocity calculation
    SCROLL_PREDICTION_DISTANCE: 500,    // Distance to predict ahead (pixels)
    MIN_SCROLL_VELOCITY: 50,            // Minimum velocity to trigger prediction (px/s)
    SCROLL_DIRECTION_THRESHOLD: 10,     // Pixels to determine scroll direction

    // Cache preloading
    PRELOAD_BATCH_SIZE: 10,             // Elements to preload per batch
    PRELOAD_THROTTLE_MS: 50,            // Throttle between preload batches
    MAX_PRELOAD_ELEMENTS: 100,          // Maximum elements to preload
    PRELOAD_PRIORITY_THRESHOLD: 0.7,    // Confidence threshold for high priority preload
  },

  // Debug and Monitoring
  ENABLE_PERFORMANCE_LOGGING: false,    // Log detailed performance metrics
  ENABLE_CACHE_METRICS: false,          // Track cache hit/miss ratios
  ENABLE_MEMORY_LOGGING: false,        // Log memory usage (can be verbose)
  PERFORMANCE_LOG_INTERVAL: 5000,     // How often to log performance stats (ms)
};

// Performance monitoring removed

const FEATURE_FLAGS = {
  // Rectangle Selection Method
  // Prefer caretRangeFromPoint (browser-native drag semantics). Edge-only IntersectionObserver
  // is off by default: a non-ancestor fixed root never reports intersections, so selection
  // stayed empty and completeSelection would not exit highlight mode.
  USE_INTELLIGENT_RECTANGLE_SELECTION: true, // Use browser-native caret selection instead of spatial intersection
  USE_NATIVE_SELECTION_API: true, // Use document.caretRangeFromPoint for efficient selection

  // Edge-Only Processing Control (experimental / heavy; off by default — see USE_EDGE_ONLY_SELECTION)
  ENABLE_EDGE_ONLY_PROCESSING: false,  // Use edge-only intersection processing
  EDGE_ONLY_FALLBACK_ENABLED: true,    // Allow fallback to spatial method if edge-only fails
  FORCE_EDGE_ONLY_MODE: false,         // Force edge-only processing even if performance degrades
  ENABLE_EDGE_ONLY_CACHE: true,        // Enable text node caching for edge-only processing

  // Enhanced RectangleIntersectionObserver Integration (Task 2)
  ENABLE_ENHANCED_RECTANGLE_OBSERVER: false, // Master flag for enhanced integration (Task 2.1, 2.2, 2.3)

  // Edge-Only Processing Feature Flags (Task 1.1)
  USE_EDGE_ONLY_SELECTION: false,        // Off: broken root/target relationship; use caret/spatial instead
  ENABLE_SMART_TARGETING: true,          // Enable smart element targeting
  ENABLE_CHARACTER_DETECTION: true,      // Enable edge-level character detection
  ENABLE_SELECTION_CACHING: true,        // Enable text node caching
  ENABLE_AUTOMATIC_FALLBACK: true,       // Auto-fallback on performance issues
  ENABLE_EDGE_BATCH_PROCESSING: true,    // Batch intersection updates
  ENABLE_PREDICTIVE_CACHING: false,      // Predictive caching off with edge-only stack
  DETAILED_EDGE_LOGGING: false,          // Detailed debug logging for edge processing (off for ship)
  EDGE_CACHE_SIZE_MANAGEMENT: true,      // Enable cache size management
  EDGE_ADAPTIVE_PROCESSING: true,        // Enable adaptive processing
  ENABLE_TEXT_ELEMENT_FILTER: true,      // Enable TextElementFilter class
  ENABLE_EDGE_CHARACTER_DETECTOR: true,  // Enable EdgeCharacterDetector class

  // Selection behavior options
  RECTANGLE_SELECTION_FALLBACK_TO_SPATIAL: true, // Fall back to spatial method if intelligent method fails
  RECTANGLE_SELECTION_SCAN_STEP: 8, // Pixel step size for boundary scanning (performance vs accuracy)
  RECTANGLE_SELECTION_MAX_SCAN_TIME: 50, // Maximum time in ms to spend scanning for boundaries

  // Clipboard options
  ENABLE_RICH_TEXT_CLIPBOARD: true, // Copy both plain text and HTML formatting to clipboard
  RICH_TEXT_FALLBACK_TO_PLAIN: true, // Fall back to plain text if rich text copying fails

  // UI feature flags
  SHOW_WINDOW_OUTLINE: false, // Show window outline during text mode

  // Hover/click targeting strategy (product decision: DOM-hover only)
  // Permanent primary path: attach DOM hover listeners and drive `state.focusEl` from
  // browser-native hover targeting. RBush spatial indexing is retired (vendor removed;
  // residual index code is no-op / isolated). Activation (F) still falls back to
  // elementFromPoint if nothing is hovered.
  ENABLE_DOM_HOVER_LISTENERS: true,

  // Interactive element discovery (TreeWalker + MutationObserver + IntersectionObserver +
  // spatial culling) was built to feed RBush hit-testing. With DOM-hover as the primary
  // path it is unnecessary idle/main-thread work on every page. Keep false unless
  // re-enabling a spatial index / fixed-overlay hit-test backend.
  ENABLE_INTERACTIVE_DISCOVERY: false,

  // Wrap EventTarget.prototype.addEventListener to track click handlers for
  // non-semantic "JS-only" clickables. Costs a small tax on every listener
  // registration in the content-script world. Default on to preserve hover of
  // onclick-less delegated widgets; set false if profiling shows it matters.
  ENABLE_CLICK_LISTENER_TRACKING: true,

  // ---- Focus-ring paint experiments (DOM-hover element styling) ----
  //
  // Tentative purpose of ENABLE_FOCUS_CLIP_INSET:
  //   When an ancestor overflow/content-visibility/contain box is tight enough to
  //   clip a positive outline-offset ring, switch to inset outline (negative
  //   offset) so the ring paints inside the target. Does NOT mutate page overflow
  //   (that broke IMDb carousels). Keep as a flag so we can A/B or disable if
  //   inset misbehaves on some skins.
  //
  // Tentative purpose of ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION:
  //   When a clip ancestor is nearly the same size as the hover target, paint the
  //   ring on that ancestor instead of the target (e.g. some content-visibility
  //   row wrappers). Default OFF: on IMDb, this promotes off <a.ipc-lockup-overlay>
  //   onto parent .ipc-poster, so the real clickable never shows data-kp-focus and
  //   the ring can look "missing" on the overlay link the user is inspecting.
  ENABLE_FOCUS_CLIP_INSET: true,
  ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION: false,

  // Debug and development flags
  DEBUG_RECTANGLE_SELECTION: false, // Enable detailed logging for rectangle selection
  DEBUG_EDGE_ONLY_PROCESSING: false, // Enable detailed logging for edge-only processing
  SHOW_SELECTION_METHOD_IN_UI: false, // Show which selection method was used in notifications
  DEBUG_RECTANGLE_HUD: false, // Show live rectangle debugging HUD with coordinates and calls
  ENABLE_DEBUG_PANEL: false // Enable upper-right debug panel showing performance metrics
};


  // Module: src/config/search-engines.js
/**
 * Search engine catalog (single source of truth).
 * - SEARCH_ENGINE_META: engines selectable as KeyPilot default (settings / omnibox / newtab)
 * - LAUNCHER_SEARCH_SITES: full list shown in Launcher → Searches favorites
 */

/** @typedef {'brave'|'google'|'duckduckgo'} SearchEngineId */

/**
 * @typedef {{
 *   id: SearchEngineId,
 *   label: string,
 *   homeUrl: string,
 *   searchUrlPrefix: string
 * }} SearchEngineMeta
 */

/** @type {Readonly<Record<SearchEngineId, SearchEngineMeta>>} */
const SEARCH_ENGINE_META = Object.freeze({
  brave: Object.freeze({
    id: 'brave',
    label: 'Brave',
    homeUrl: 'https://search.brave.com/',
    searchUrlPrefix: 'https://search.brave.com/search?q='
  }),
  google: Object.freeze({
    id: 'google',
    label: 'Google',
    homeUrl: 'https://www.google.com/',
    searchUrlPrefix: 'https://www.google.com/search?q='
  }),
  duckduckgo: Object.freeze({
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    homeUrl: 'https://duckduckgo.com/',
    searchUrlPrefix: 'https://duckduckgo.com/?q='
  })
});

const DEFAULT_SEARCH_ENGINE_ID = /** @type {SearchEngineId} */ ('brave');

/**
 * Launcher favorites for the Searches category.
 * Includes settings engines plus additional common search homes.
 * @type {ReadonlyArray<{ title: string, url: string, isDefault: true }>}
 */
const LAUNCHER_SEARCH_SITES = Object.freeze([
  Object.freeze({ title: 'Google', url: 'https://google.com', isDefault: true }),
  Object.freeze({ title: 'Bing', url: 'https://bing.com', isDefault: true }),
  Object.freeze({ title: 'DuckDuckGo', url: 'https://duckduckgo.com', isDefault: true }),
  Object.freeze({ title: 'Yahoo', url: 'https://yahoo.com', isDefault: true }),
  Object.freeze({ title: 'Brave Search', url: 'https://search.brave.com', isDefault: true }),
  Object.freeze({ title: 'Ecosia', url: 'https://ecosia.org', isDefault: true }),
  Object.freeze({ title: 'Startpage', url: 'https://startpage.com', isDefault: true }),
  Object.freeze({ title: 'Yandex', url: 'https://yandex.com', isDefault: true })
]);

/**
 * @param {any} raw
 * @returns {SearchEngineId}
 */
function normalizeSearchEngineId(raw) {
  if (raw === 'google' || raw === 'duckduckgo' || raw === 'brave') return raw;
  return DEFAULT_SEARCH_ENGINE_ID;
}

/**
 * @param {any} engine
 * @returns {SearchEngineMeta}
 */
function getSearchEngineMeta(engine) {
  const id = normalizeSearchEngineId(engine);
  return SEARCH_ENGINE_META[id] || SEARCH_ENGINE_META[DEFAULT_SEARCH_ENGINE_ID];
}



  // Module: src/messaging/types.js
/**
 * KeyPilot runtime message types (single source of truth).
 *
 * Routing notes:
 * - Content script ↔ service worker: chrome.runtime.sendMessage / onMessage
 * - Extension page → tab UI: prefer SW forward, or chrome.tabs.sendMessage
 * - Parent ↔ popover iframe: window.postMessage (KP_POPOVER_* family)
 */

/** @typedef {typeof MSG[keyof typeof MSG]} MessageType */

const MSG = Object.freeze({
  // --- Extension enable / status ---
  GET_STATE: 'KP_GET_STATE',
  SET_STATE: 'KP_SET_STATE',
  TOGGLE_STATE: 'KP_TOGGLE_STATE',
  STATE_RESPONSE: 'KP_STATE_RESPONSE',
  STATE_CHANGED: 'KP_STATE_CHANGED',
  UPDATE_STATE: 'KP_UPDATE_STATE',
  GET_STATUS: 'KP_GET_STATUS',
  STATUS: 'KP_STATUS',

  // --- Transient onboarding actions ---
  TRANSIENT_ACTION: 'KP_TRANSIENT_ACTION',

  // --- Tab / history navigation ---
  TAB_LEFT: 'KP_TAB_LEFT',
  TAB_RIGHT: 'KP_TAB_RIGHT',
  NEW_TAB: 'KP_NEW_TAB',
  CLOSE_TAB: 'KP_CLOSE_TAB',
  GO_BACK: 'KP_GO_BACK',
  GO_FORWARD: 'KP_GO_FORWARD',
  OPEN_URL_BACKGROUND: 'KP_OPEN_URL_BACKGROUND',
  OPEN_URL_FOREGROUND: 'KP_OPEN_URL_FOREGROUND',

  // --- UI open (content-script handlers; SW may forward) ---
  OPEN_SETTINGS_POPOVER: 'KP_OPEN_SETTINGS_POPOVER',
  OPEN_GUIDE_POPOVER: 'KP_OPEN_GUIDE_POPOVER',
  OPEN_ONBOARDING: 'KP_OPEN_ONBOARDING',
  /** Reset walkthrough progress and open it (e.g. Guide "Launch Walkthrough"). */
  LAUNCH_WALKTHROUGH: 'KP_LAUNCH_WALKTHROUGH',

  // --- History / bookmarks / favicon (SW APIs for content scripts) ---
  OMNIBOX_SUGGEST: 'KP_OMNIBOX_SUGGEST',
  GET_BOOKMARKS: 'KP_GET_BOOKMARKS',
  BROWSER_HISTORY_GET: 'KP_BROWSER_HISTORY_GET',
  GET_TOP_SITES: 'KP_GET_TOP_SITES',
  GET_HISTORY_FOR_DOMAINS: 'KP_GET_HISTORY_FOR_DOMAINS',
  GET_FAVICON: 'KP_GET_FAVICON',

  // --- Page preview screenshots for card backgrounds ---
  GET_PAGE_THUMB: 'KP_GET_PAGE_THUMB',
  PAGE_THUMB_RESPONSE: 'KP_PAGE_THUMB_RESPONSE',
  PAGE_THUMB_UPDATED: 'KP_PAGE_THUMB_UPDATED',

  // --- Per-tab navigation graph ---
  NAVGRAPH_GET: 'KP_NAVGRAPH_GET',
  NAVGRAPH_JUMP: 'KP_NAVGRAPH_JUMP',
  NAVGRAPH_CLEAR: 'KP_NAVGRAPH_CLEAR',

  // --- Generic ---
  SUCCESS: 'KP_SUCCESS',
  ERROR: 'KP_ERROR',

  // --- Link Preview mobile User-Agent (SW declarativeNetRequest session rules) ---
  SET_PREVIEW_MOBILE_UA: 'KP_SET_PREVIEW_MOBILE_UA',

  // --- Parent ↔ popover iframe (window.postMessage) ---
  POPOVER_BRIDGE_INIT: 'KP_POPOVER_BRIDGE_INIT',
  POPOVER_BRIDGE_READY: 'KP_POPOVER_BRIDGE_READY',
  POPOVER_REQUEST_CLOSE: 'KP_POPOVER_REQUEST_CLOSE',
  POPOVER_BRIDGE_KEYDOWN: 'KP_POPOVER_BRIDGE_KEYDOWN',
  POPOVER_SCROLL: 'KP_POPOVER_SCROLL',
  /** Guide iframe → parent: close guide and open walkthrough from a reset state. */
  POPOVER_LAUNCH_WALKTHROUGH: 'KP_POPOVER_LAUNCH_WALKTHROUGH',

  // --- Parent → child frame activate (window.postMessage; third-party iframes) ---
  // Top-frame KeyPilot posts this when F/B/G lands on a cross-origin <iframe>.
  // Child frame-click-agent performs elementFromPoint + click in its own document.
  FRAME_ACTIVATE: 'KP_FRAME_ACTIVATE',

  // --- Parent → child frame scroll (window.postMessage; C/V under an iframe) ---
  // Top-frame KeyPilot posts this when C/V lands on an <iframe> shell. Child
  // frame-click-agent runs scroll-at-point at local coordinates (nested overflow
  // first, then the frame document).
  FRAME_SCROLL: 'KP_FRAME_SCROLL',

  // --- Child frame-agent → SW: inject full content-bundled.js into this frame ---
  // Used when a KeyPilot popover iframe needs full KeyPilot (cursor/overlays).
  // Thin frame-agent-bundled.js does not include the full app.
  INJECT_FULL_KEYPILOT_IN_FRAME: 'KP_INJECT_FULL_KEYPILOT_IN_FRAME'
});

/**
 * Message types that open tab-local UI and must be forwarded by the SW
 * when sent via chrome.runtime.sendMessage from extension pages.
 */
const TAB_UI_FORWARD_TYPES = Object.freeze([
  MSG.OPEN_SETTINGS_POPOVER,
  MSG.OPEN_GUIDE_POPOVER,
  MSG.OPEN_ONBOARDING,
  MSG.LAUNCH_WALKTHROUGH
]);



  // Module: src/utils/dom-context.js
/**
 * Shared DOM/keyboard context helpers (single source of truth).
 * Used by EventManager and the shared popover iframe bridge.
 */

/** Input types where letter keys should type, not run KeyPilot shortcuts. */
const TEXT_ENTRY_INPUT_TYPES = Object.freeze([
  'text',
  'search',
  'url',
  'email',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'week',
  'time'
]);

const TEXT_ENTRY_TYPE_SET = new Set(TEXT_ENTRY_INPUT_TYPES);

/**
 * Walk open shadow roots to find the true focused element.
 * document.activeElement stops at shadow hosts.
 *
 * @param {Document|ShadowRoot|null|undefined} [root]
 * @returns {Element|null}
 */
function getDeepActiveElement(root = document) {
  let active = null;
  try {
    active = root?.activeElement || null;
  } catch {
    active = null;
  }

  while (active) {
    let next = null;
    try {
      next = active.shadowRoot?.activeElement || null;
    } catch {
      next = null;
    }
    if (!next) break;
    active = next;
  }

  return active;
}

/**
 * Best-effort real event target across open shadow boundaries.
 * Prefer composedPath()[0]; fall back to event.target.
 *
 * @param {Event|null|undefined} e
 * @returns {EventTarget|null}
 */
function getComposedEventTarget(e) {
  if (!e) return null;
  try {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
    if (path && path.length) {
      for (const node of path) {
        if (node && /** @type {any} */ (node).nodeType === 1) return node;
      }
    }
  } catch { /* ignore */ }
  return e.target || null;
}

/**
 * True only when the user is in a real text-entry field where letter keys should type.
 * Non-text inputs (checkbox, radio, button, range, etc.) must NOT block KeyPilot shortcuts.
 *
 * @param {EventTarget|null|undefined} target
 * @param {{ treatSelectAsTyping?: boolean }} [opts]
 * @returns {boolean}
 */
function isTypingContext(target, opts = {}) {
  if (!target) return false;

  // Text nodes can be the original event target inside contenteditable.
  let el = /** @type {any} */ (target);
  try {
    if (el.nodeType === 3) el = el.parentElement;
  } catch { /* ignore */ }
  if (!el || el.nodeType !== 1) return false;

  const node = /** @type {HTMLElement} */ (el);

  try {
    if (node.isContentEditable) return true;
  } catch { /* ignore */ }

  // Walk up a few ancestors for nested contenteditable hosts / custom wrappers.
  try {
    let p = node.parentElement;
    let depth = 0;
    while (p && depth++ < 4) {
      if (p.isContentEditable) return true;
      p = p.parentElement;
    }
  } catch { /* ignore */ }

  const tag = node.tagName?.toLowerCase?.() || '';
  if (tag === 'textarea') {
    return !(/** @type {HTMLTextAreaElement} */ (node)).disabled;
  }
  if (opts.treatSelectAsTyping && tag === 'select') {
    return !(/** @type {HTMLSelectElement} */ (node)).disabled;
  }
  if (tag !== 'input') return false;

  const input = /** @type {HTMLInputElement} */ (node);
  if (input.disabled || input.readOnly) return false;

  const type = String(input.type || 'text').toLowerCase();
  return TEXT_ENTRY_TYPE_SET.has(type);
}

/**
 * Resolve the element that should suppress KeyPilot letter shortcuts right now.
 * Checks composed event target first, then deep activeElement (shadow-aware).
 *
 * @param {Event|null|undefined} e
 * @param {{ treatSelectAsTyping?: boolean }} [opts]
 * @returns {Element|null}
 */
function resolveTypingTarget(e, opts = {}) {
  const composed = getComposedEventTarget(e);
  if (isTypingContext(composed, opts)) return /** @type {Element} */ (composed);

  const deep = getDeepActiveElement();
  if (deep && isTypingContext(deep, opts)) return deep;

  // Last resort: light-DOM activeElement (may be a shadow host — still try).
  try {
    if (typeof document !== 'undefined' && isTypingContext(document.activeElement, opts)) {
      return /** @type {Element} */ (document.activeElement);
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * @param {KeyboardEvent|null|undefined} e
 * @returns {boolean}
 */
function hasModifierKeys(e) {
  if (!e) return false;
  return !!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey);
}

/**
 * Bundle-safe aliases for class methods.
 * After import-stripping, methods like `isTypingContext(){ return isTypingContext() }`
 * can be ambiguous; always call through these distinct names from EventManager.
 */
const kpIsTypingContext = isTypingContext;
const kpResolveTypingTarget = resolveTypingTarget;
const kpGetDeepActiveElement = getDeepActiveElement;
const kpGetComposedEventTarget = getComposedEventTarget;
const kpHasModifierKeys = hasModifierKeys;



  // Module: src/utils/storage.js
/**
 * Shared chrome.storage helpers.
 *
 * Policy used across KeyPilot:
 * - Prefer `chrome.storage.sync` (profile-wide)
 * - Fall back to `chrome.storage.local` when sync fails or is empty
 * - Return caller default when neither has a value
 */

/**
 * Read a single key: sync → local → defaultValue.
 * @template T
 * @param {string} key
 * @param {T} [defaultValue]
 * @returns {Promise<T>}
 */
async function storageGetValue(key, defaultValue = undefined) {
  if (!key || typeof key !== 'string') return defaultValue;

  try {
    if (chrome?.storage?.sync?.get) {
      const syncResult = await chrome.storage.sync.get([key]);
      if (syncResult && Object.prototype.hasOwnProperty.call(syncResult, key) &&
          syncResult[key] !== undefined) {
        return /** @type {T} */ (syncResult[key]);
      }
    }
  } catch {
    // ignore, fall back to local
  }

  try {
    if (chrome?.storage?.local?.get) {
      const localResult = await chrome.storage.local.get([key]);
      if (localResult && Object.prototype.hasOwnProperty.call(localResult, key) &&
          localResult[key] !== undefined) {
        return /** @type {T} */ (localResult[key]);
      }
    }
  } catch {
    // ignore
  }

  return defaultValue;
}

/**
 * Read multiple keys. For each key, prefer sync value when present, else local.
 * @param {string[]} keys
 * @returns {Promise<Record<string, any>>}
 */
async function storageGetKeys(keys) {
  const list = Array.isArray(keys) ? keys.filter((k) => typeof k === 'string' && k) : [];
  if (!list.length) return {};

  /** @type {Record<string, any>} */
  let sync = {};
  /** @type {Record<string, any>} */
  let local = {};

  try {
    if (chrome?.storage?.sync?.get) {
      sync = (await chrome.storage.sync.get(list)) || {};
    }
  } catch {
    sync = {};
  }

  try {
    if (chrome?.storage?.local?.get) {
      local = (await chrome.storage.local.get(list)) || {};
    }
  } catch {
    local = {};
  }

  /** @type {Record<string, any>} */
  const out = {};
  for (const key of list) {
    if (Object.prototype.hasOwnProperty.call(sync, key) && sync[key] !== undefined) {
      out[key] = sync[key];
    } else if (Object.prototype.hasOwnProperty.call(local, key) && local[key] !== undefined) {
      out[key] = local[key];
    }
  }
  return out;
}

/**
 * Write a single key: try sync, then local.
 * @param {string} key
 * @param {any} value
 * @param {{ includeTimestamp?: boolean }} [opts]
 * @returns {Promise<boolean>} true if either area accepted the write
 */
async function storageSetValue(key, value, opts = {}) {
  if (!key || typeof key !== 'string') return false;

  /** @type {Record<string, any>} */
  const payload = { [key]: value };
  if (opts.includeTimestamp) {
    payload.timestamp = Date.now();
  }

  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set(payload);
      return true;
    }
  } catch {
    // fall back to local
  }

  try {
    if (chrome?.storage?.local?.set) {
      await chrome.storage.local.set(payload);
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Write an object of keys: try sync, then local.
 * @param {Record<string, any>} obj
 * @returns {Promise<boolean>}
 */
async function storageSetObject(obj) {
  if (!obj || typeof obj !== 'object') return false;

  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set(obj);
      return true;
    }
  } catch {
    // fall back
  }

  try {
    if (chrome?.storage?.local?.set) {
      await chrome.storage.local.set(obj);
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}



  // Module: src/utils/scroll-at-point.js
/**
 * Cursor-aware keyboard scrolling.
 *
 * C / V (and callers that reuse this helper) should scroll the nearest overflow
 * container under the pointer first; only if nothing nested can scroll do we
 * fall back to the document / window. Horizontal-only overflow maps C→left and
 * V→right; mixed or vertical-only overflow uses up/down.
 */

/** Pixels of slack when testing whether an edge still has room to scroll. */
const EDGE_EPS = 1;

/**
 * Composed parent: light DOM parent, or open shadow host when crossing a root.
 * @param {Node|null|undefined} node
 * @returns {Element|null}
 */
function composedParent(node) {
  if (!node || node.nodeType !== 1) return null;
  const el = /** @type {Element} */ (node);
  if (el.parentElement) return el.parentElement;
  try {
    const root = typeof el.getRootNode === 'function' ? el.getRootNode() : null;
    if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
      return root.host || null;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Shadow-piercing elementFromPoint (does not enter iframes).
 * @param {number} x
 * @param {number} y
 * @param {Document} [doc]
 * @returns {Element|null}
 */
function elementFromPointDeep(x, y, doc = document) {
  try {
    let el = doc.elementFromPoint(x, y);
    let guard = 0;
    while (el && el.shadowRoot && guard++ < 10) {
      const nested = el.shadowRoot.elementFromPoint(x, y);
      if (!nested || nested === el) break;
      el = nested;
    }
    return el || null;
  } catch {
    return null;
  }
}

/**
 * @param {string|null|undefined} overflow
 * @returns {boolean}
 */
function overflowAllowsScroll(overflow) {
  const o = String(overflow || '').toLowerCase();
  return o === 'auto' || o === 'scroll' || o === 'overlay';
}

/**
 * True when `el` is the document scrolling root (html / body / scrollingElement).
 * These often report overflow:visible yet still scroll the viewport.
 * @param {Element} el
 * @param {Document} doc
 * @returns {boolean}
 */
function isDocumentScrollRoot(el, doc) {
  try {
    const se = doc.scrollingElement;
    if (se && el === se) return true;
    if (el === doc.documentElement || el === doc.body) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * @typedef {{ canY: boolean, canX: boolean, maxTop: number, maxLeft: number }} ScrollCapacity
 */

/**
 * @param {Element} el
 * @param {Document} doc
 * @returns {ScrollCapacity}
 */
function getScrollCapacity(el, doc = document) {
  if (!el || el.nodeType !== 1) {
    return { canY: false, canX: false, maxTop: 0, maxLeft: 0 };
  }

  let maxTop = 0;
  let maxLeft = 0;
  try {
    maxTop = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
    maxLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
  } catch {
    return { canY: false, canX: false, maxTop: 0, maxLeft: 0 };
  }

  // Document roots: treat as scrollable when content overflows even if CSS
  // overflow is visible (browser default viewport scrolling).
  if (isDocumentScrollRoot(el, doc)) {
    return {
      canY: maxTop > EDGE_EPS,
      canX: maxLeft > EDGE_EPS,
      maxTop,
      maxLeft
    };
  }

  let oy = '';
  let ox = '';
  try {
    const cs = (el.ownerDocument?.defaultView || window).getComputedStyle(el);
    oy = cs?.overflowY || '';
    ox = cs?.overflowX || '';
  } catch {
    return { canY: false, canX: false, maxTop: 0, maxLeft: 0 };
  }

  return {
    canY: overflowAllowsScroll(oy) && maxTop > EDGE_EPS,
    canX: overflowAllowsScroll(ox) && maxLeft > EDGE_EPS,
    maxTop,
    maxLeft
  };
}

/**
 * @param {Element} el
 * @param {'y'|'x'} axis
 * @param {number} sign  -1 = up/left, +1 = down/right
 * @returns {boolean}
 */
function canScrollInDirection(el, axis, sign) {
  if (!el) return false;
  try {
    if (axis === 'y') {
      const top = el.scrollTop || 0;
      if (sign < 0) return top > EDGE_EPS;
      const max = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
      return top < max - EDGE_EPS;
    }
    const left = el.scrollLeft || 0;
    if (sign < 0) return left > EDGE_EPS;
    const max = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
    return left < max - EDGE_EPS;
  } catch {
    return false;
  }
}

/**
 * Apply a delta to an element (or window for document roots).
 * @param {Element} el
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {ScrollBehavior} [behavior]
 * @param {Document} [doc]
 * @param {Window} [win]
 * @returns {boolean}
 */
function scrollElementBy(el, deltaX, deltaY, behavior = 'smooth', doc = document, win = window) {
  if (!el) return false;
  const dx = Number(deltaX) || 0;
  const dy = Number(deltaY) || 0;
  if (!dx && !dy) return false;

  const opts = { left: dx, top: dy, behavior };

  // Prefer element.scrollBy; fall back to mutating scrollTop/scrollLeft.
  try {
    if (typeof el.scrollBy === 'function') {
      el.scrollBy(opts);
      return true;
    }
  } catch { /* fall through */ }

  try {
    if (behavior === 'smooth' && typeof el.scrollTo === 'function') {
      el.scrollTo({
        left: (el.scrollLeft || 0) + dx,
        top: (el.scrollTop || 0) + dy,
        behavior
      });
      return true;
    }
  } catch { /* fall through */ }

  try {
    if (dx) el.scrollLeft = (el.scrollLeft || 0) + dx;
    if (dy) el.scrollTop = (el.scrollTop || 0) + dy;
    return true;
  } catch { /* ignore */ }

  // Last resort for document roots.
  if (isDocumentScrollRoot(el, doc) && win && typeof win.scrollBy === 'function') {
    try {
      win.scrollBy(opts);
      return true;
    } catch {
      try {
        win.scrollBy(dx, dy);
        return true;
      } catch { /* ignore */ }
    }
  }

  return false;
}

/**
 * Resolve which axis to use for a capacity snapshot.
 * Prefer vertical when it can move in `sign`; else horizontal when it can.
 * @param {ScrollCapacity} cap
 * @param {Element} el
 * @param {number} sign
 * @returns {'y'|'x'|null}
 */
function pickAxis(cap, el, sign) {
  if (cap.canY && canScrollInDirection(el, 'y', sign)) return 'y';
  if (cap.canX && canScrollInDirection(el, 'x', sign)) return 'x';
  return null;
}

/**
 * Find the best scroll target under a viewport point.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} sign  -1 = up/left (C), +1 = down/right (V)
 * @param {{ doc?: Document, win?: Window }} [ctx]
 * @returns {{ el: Element, axis: 'y'|'x' }|null}
 */
function findScrollTargetAtPoint(clientX, clientY, sign, ctx = {}) {
  const doc = ctx.doc || document;
  const x = Number(clientX);
  const y = Number(clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let start = elementFromPointDeep(x, y, doc);
  // If hit-testing failed (e.g. over nothing), still allow document scroll.
  if (!start) {
    const se = doc.scrollingElement || doc.documentElement || doc.body;
    if (se) {
      const cap = getScrollCapacity(se, doc);
      const axis = pickAxis(cap, se, sign);
      if (axis) return { el: se, axis };
    }
    return null;
  }

  // Skip non-element / text nodes.
  if (start.nodeType !== 1) {
    start = start.parentElement || /** @type {Element|null} */ (composedParent(start));
  }

  /** @type {Element|null} */
  let n = /** @type {Element|null} */ (start);
  let depth = 0;
  /** @type {Element|null} */
  let seenDocRoot = null;

  while (n && n.nodeType === 1 && depth++ < 64) {
    if (n.tagName === 'IFRAME' || n.tagName === 'FRAME') {
      // Caller handles iframe forwarding; do not treat the shell as a scroller.
      return null;
    }

    // Skip KeyPilot chrome (ids/classes) so we don't scroll our own overlays.
    try {
      const id = n.id || '';
      if (id === 'kpv2-cursor' || id === 'kpv2-frame-hover' || (typeof id === 'string' && id.startsWith('kpv2-'))) {
        n = composedParent(n);
        continue;
      }
      if (n.classList) {
        let skip = false;
        n.classList.forEach((c) => {
          if (typeof c === 'string' && c.startsWith('kpv2-')) skip = true;
        });
        if (skip) {
          n = composedParent(n);
          continue;
        }
      }
    } catch { /* ignore */ }

    const cap = getScrollCapacity(n, doc);
    if (cap.canY || cap.canX) {
      if (isDocumentScrollRoot(n, doc)) {
        seenDocRoot = n;
        // Keep walking? Document roots are usually outermost — try them last
        // only after nested candidates fail. Continue so nested is preferred
        // when we somehow start above them; normally we hit nested first.
        n = composedParent(n);
        continue;
      }
      const axis = pickAxis(cap, n, sign);
      if (axis) return { el: n, axis };
    }

    n = composedParent(n);
  }

  // Fallback: document scrolling element / html / body / window.
  const candidates = [];
  try {
    if (doc.scrollingElement) candidates.push(doc.scrollingElement);
  } catch { /* ignore */ }
  try {
    if (doc.documentElement) candidates.push(doc.documentElement);
  } catch { /* ignore */ }
  try {
    if (doc.body) candidates.push(doc.body);
  } catch { /* ignore */ }
  if (seenDocRoot) candidates.push(seenDocRoot);

  const tried = new Set();
  for (const el of candidates) {
    if (!el || tried.has(el)) continue;
    tried.add(el);
    const cap = getScrollCapacity(el, doc);
    const axis = pickAxis(cap, el, sign);
    if (axis) return { el, axis };
  }

  return null;
}

/**
 * Scroll under the cursor: nested overflow first, then the page.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} sign  -1 = C (up/left), +1 = V (down/right)
 * @param {number} deltaPx  positive distance in the chosen direction
 * @param {ScrollBehavior} [behavior]
 * @param {{ doc?: Document, win?: Window }} [ctx]
 * @returns {{ scrolled: boolean, axis: 'y'|'x'|null, el: Element|null }}
 */
function scrollAtPoint(clientX, clientY, sign, deltaPx, behavior = 'smooth', ctx = {}) {
  const doc = ctx.doc || document;
  const win = ctx.win || (doc.defaultView || window);
  const amount = Math.abs(Number(deltaPx)) || 0;
  const s = sign < 0 ? -1 : 1;

  if (!amount) {
    return { scrolled: false, axis: null, el: null };
  }

  const target = findScrollTargetAtPoint(clientX, clientY, s, { doc, win });
  if (!target) {
    // Absolute last resort: window scroll on Y (preserves old C/V behavior).
    try {
      if (win && typeof win.scrollBy === 'function') {
        win.scrollBy({ top: s * amount, left: 0, behavior });
        return { scrolled: true, axis: 'y', el: doc.scrollingElement || doc.documentElement || null };
      }
    } catch { /* ignore */ }
    return { scrolled: false, axis: null, el: null };
  }

  const { el, axis } = target;
  const dx = axis === 'x' ? s * amount : 0;
  const dy = axis === 'y' ? s * amount : 0;
  const ok = scrollElementBy(el, dx, dy, behavior, doc, win);
  return { scrolled: ok, axis, el };
}



  // Module: src/modules/settings-manager.js
/**
 * Settings storage + helpers.
 *
 * Stored in chrome.storage.sync so values sync across Chrome profiles and across tabs.
 */




const SETTINGS_STORAGE_KEY = 'kp_settings_v1';

// Re-export search engine catalog so consumers can keep importing from settings-manager.

/** @typedef {import('../config/search-engines.js').SearchEngineId} SearchEngine */

/** @typedef {'crosshair'|'native_arrow'|'native_pointer'} ClickCursorType */
/** @typedef {'t_square'|'crosshair'} TextCursorType */
/** @typedef {'left_edge'|'background_tint'} TextFocusStyle */
/** @typedef {typeof CURSOR_MODE[keyof typeof CURSOR_MODE]} CursorMode */
/** @typedef {'smooth'|'instant'} ScrollSpeed */
/** @typedef {'flash'|'dash'|'marquee'|'scale'|'none'} ClickEffect */

/** Valid text-mode focus field styles (order is settings UI preference). */
const TEXT_FOCUS_STYLE_IDS = Object.freeze(/** @type {const} */ ([
  'left_edge',
  'background_tint'
]));

/** Valid F-key click activation effects (order is settings UI preference). */
const CLICK_EFFECT_IDS = Object.freeze(/** @type {const} */ ([
  'flash',
  'dash',
  'marquee',
  'scale',
  'none'
]));

/**
 * @typedef {{
 *   type: ClickCursorType,
 *   lineWidth: number,
 *   sizePixels: number,
 *   gap: number
 * }} ClickCursorSettings
 */

/** @typedef {'blue'|'green'} FocusColor */

/**
 * @typedef {{
 *   cursor: ClickCursorSettings,
 *   focusColor: FocusColor,
 *   overlayFillEnabled: boolean,
 *   overlayShadowEnabled: boolean,
 *   rectangleThickness: number,
 *   clickEffect: ClickEffect,
 *   keyboardLinkHoverHints: boolean
 * }} ClickModeSettings
 */

/**
 * @typedef {{
 *   cursorType: TextCursorType,
 *   labelsEnabled: boolean,
 *   strokeThickness: number,
 *   focusStyle: TextFocusStyle,
 *   leftEdgeWidth: number
 * }} TextModeSettings
 */

/**
 * @typedef {{
 *   halfPagePx: number,
 *   speed: ScrollSpeed
 * }} ScrollSettings
 */

/**
 * @typedef {{
 *   visible: boolean,
 *   collapsed: boolean
 * }} ControlStripSettings
 */

/**
 * Saved fixed-panel dock / free position (see utils/panel-position.js).
 * Prefer `anchor` when set so layout adapts across viewport sizes.
 * @typedef {{
 *   left?: number,
 *   top?: number,
 *   anchor?: string|null
 * }} PanelPositionSettings
 */

/**
 * Named panel slots that share the generalized positioning system.
 * @typedef {{
 *   keyboardReference: PanelPositionSettings,
 *   controlStrip: PanelPositionSettings
 * }} PanelPositionsSettings
 */

/**
 * @typedef {{
 *   searchEngine: SearchEngine,
 *   cursorMode: CursorMode,
 *   keyboardLayoutId: string,
 *   keyboardReferenceKeyFeedback: boolean,
 *   controlStrip: ControlStripSettings,
 *   panelPositions: PanelPositionsSettings,
 *   clickMode: ClickModeSettings,
 *   textMode: TextModeSettings,
 *   scroll: ScrollSettings
 * }} KeyPilotSettings
 */

/** @type {KeyPilotSettings} */
const DEFAULT_SETTINGS = Object.freeze({
  searchEngine: DEFAULT_SEARCH_ENGINE_ID,
  cursorMode: CURSOR_MODE.NO_CUSTOM_CURSORS,
  keyboardLayoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
  // When true, the floating keyboard reference panel highlights keys on keydown/keyup.
  keyboardReferenceKeyFeedback: true,
  // Floating Control Strip (upper-left): visibility + collapsed (On/Off-only) state.
  controlStrip: Object.freeze({
    visible: true,
    collapsed: true
  }),
  // Dock / free positions for movable chrome (keyboard reference, control strip, …).
  // Anchors re-resolve on resize; free left/top reclamps inside the viewport margin.
  panelPositions: Object.freeze({
    keyboardReference: Object.freeze({ anchor: 'bottom-left' }),
    controlStrip: Object.freeze({ anchor: 'top-left' })
  }),
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: 'crosshair',
      // Cursor SVG stroke width. Slider range: 1–12.
      lineWidth: 4,
      // Cursor size in pixels. Default is half of previous (was ~30px, now 15px).
      sizePixels: 10,
      // Gap between center and crosshair bars in pixels. 0 = intersecting lines, >0 = separate bars.
      gap: 6
    }),
    // Hover focus ring color (DOM-hover mode default is blue).
    focusColor: 'blue',
    // When true, the focus rectangle can include a translucent fill (where applicable).
    overlayFillEnabled: false,
    // When true, draw a soft outer glow/shadow on the focus rectangle.
    overlayShadowEnabled: false,
    // Focus rectangle border thickness in px.
    rectangleThickness: 3,
    // F-key activation feedback on link-style targets (flash is the default).
    clickEffect: 'flash',
    // When true, hovering a link glows matching green keys on the Keyboard Reference.
    // Off by default (opt-in via Settings → Click Mode).
    keyboardLinkHoverHints: false
  }),
  textMode: Object.freeze({
    cursorType: 't_square',
    // When true, show both labels: "Active text field" + "Press ESC to close".
    labelsEnabled: false,
    // Stroke thickness in px for orange text-mode rectangles.
    strokeThickness: 3,
    // How the focused text field is styled while in text mode.
    // left_edge: pulsating orange bar on the left inset edge (default).
    // background_tint: full-field orange wash (legacy).
    focusStyle: 'left_edge',
    // Width of the left-edge pulse bar in px (when focusStyle is left_edge).
    leftEdgeWidth: 5
  }),
  scroll: Object.freeze({
    // C / V scroll distance in pixels (default = prior 400 × 1.25).
    halfPagePx: SCROLL.HALF_PAGE_PX,
    // Animation speed for keyboard scrolling: smooth (animated) or instant (jump).
    speed: SCROLL.BEHAVIOR === 'smooth' ? 'smooth' : 'instant'
  })
});

/**
 * @param {any} raw
 * @returns {SearchEngine}
 */
function normalizeSearchEngine(raw) {
  return normalizeSearchEngineId(raw);
}

/**
 * @param {any} raw
 * @returns {CursorMode}
 */
function normalizeCursorMode(raw) {
  if (raw === CURSOR_MODE.NO_CUSTOM_CURSORS || raw === CURSOR_MODE.CUSTOM_CURSORS) return raw;
  return DEFAULT_SETTINGS.cursorMode;
}

/**
 * @param {any} raw
 * @param {boolean} fallback
 */
function normalizeBoolean(raw, fallback) {
  if (raw === true || raw === false) return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return !!fallback;
}

/**
 * @param {any} raw
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function normalizeNumber(raw, fallback, min, max) {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Number(raw) : NaN);
  const v = Number.isFinite(n) ? n : fallback;
  const clamped = Math.min(Math.max(v, min), max);
  return clamped;
}

/**
 * @param {any} raw
 * @returns {ClickCursorType}
 */
function normalizeClickCursorType(raw) {
  if (raw === 'crosshair' || raw === 'native_arrow' || raw === 'native_pointer') return raw;
  return DEFAULT_SETTINGS.clickMode.cursor.type;
}

/**
 * @param {any} raw
 * @returns {ClickEffect}
 */
function normalizeClickEffect(raw) {
  if (raw === 'flash' || raw === 'dash' || raw === 'marquee' || raw === 'scale' || raw === 'none') {
    return raw;
  }
  return DEFAULT_SETTINGS.clickMode.clickEffect;
}

/**
 * @param {any} raw
 * @returns {TextCursorType}
 */
function normalizeTextCursorType(raw) {
  if (raw === 't_square' || raw === 'crosshair') return raw;
  return DEFAULT_SETTINGS.textMode.cursorType;
}

/**
 * @param {any} raw
 * @returns {TextFocusStyle}
 */
function normalizeTextFocusStyle(raw) {
  if (raw === 'left_edge' || raw === 'background_tint') return raw;
  return DEFAULT_SETTINGS.textMode.focusStyle;
}

/**
 * @param {any} raw
 * @returns {FocusColor}
 */
function normalizeFocusColor(raw) {
  if (raw === 'blue' || raw === 'green') return raw;
  return DEFAULT_SETTINGS.clickMode.focusColor;
}

/**
 * @param {any} raw
 * @returns {ClickModeSettings}
 */
function normalizeClickMode(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  const storedCursor = stored.cursor && typeof stored.cursor === 'object' ? stored.cursor : {};
  return {
    cursor: {
      type: normalizeClickCursorType(storedCursor.type),
      lineWidth: normalizeNumber(
        storedCursor.lineWidth,
        DEFAULT_SETTINGS.clickMode.cursor.lineWidth,
        1,
        12
      ),
      sizePixels: normalizeNumber(
        storedCursor.sizePixels,
        DEFAULT_SETTINGS.clickMode.cursor.sizePixels,
        5,
        60
      ),
      gap: normalizeNumber(
        storedCursor.gap,
        DEFAULT_SETTINGS.clickMode.cursor.gap,
        0,
        20
      )
    },
    focusColor: normalizeFocusColor(stored.focusColor),
    overlayFillEnabled: normalizeBoolean(
      stored.overlayFillEnabled,
      DEFAULT_SETTINGS.clickMode.overlayFillEnabled
    ),
    overlayShadowEnabled: normalizeBoolean(
      stored.overlayShadowEnabled,
      DEFAULT_SETTINGS.clickMode.overlayShadowEnabled
    ),
    rectangleThickness: normalizeNumber(
      stored.rectangleThickness,
      DEFAULT_SETTINGS.clickMode.rectangleThickness,
      1,
      16
    ),
    clickEffect: normalizeClickEffect(stored.clickEffect),
    keyboardLinkHoverHints: normalizeBoolean(
      stored.keyboardLinkHoverHints,
      DEFAULT_SETTINGS.clickMode.keyboardLinkHoverHints
    )
  };
}

/**
 * @param {any} raw
 * @returns {TextModeSettings}
 */
function normalizeTextMode(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  return {
    cursorType: normalizeTextCursorType(stored.cursorType),
    labelsEnabled: normalizeBoolean(stored.labelsEnabled, DEFAULT_SETTINGS.textMode.labelsEnabled),
    strokeThickness: normalizeNumber(
      stored.strokeThickness,
      DEFAULT_SETTINGS.textMode.strokeThickness,
      1,
      16
    ),
    focusStyle: normalizeTextFocusStyle(stored.focusStyle),
    leftEdgeWidth: normalizeNumber(
      stored.leftEdgeWidth,
      DEFAULT_SETTINGS.textMode.leftEdgeWidth,
      1,
      24
    )
  };
}

/**
 * @param {any} raw
 * @returns {ScrollSpeed}
 */
function normalizeScrollSpeed(raw) {
  if (raw === 'smooth' || raw === 'instant') return raw;
  // Accept CSS scroll-behavior aliases from older/local experiments.
  if (raw === 'auto') return 'instant';
  return DEFAULT_SETTINGS.scroll.speed;
}

/**
 * @param {any} raw
 * @returns {ScrollSettings}
 */
function normalizeScroll(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  return {
    halfPagePx: normalizeNumber(
      stored.halfPagePx,
      DEFAULT_SETTINGS.scroll.halfPagePx,
      50,
      2000
    ),
    speed: normalizeScrollSpeed(stored.speed)
  };
}

/**
 * @param {any} raw
 * @returns {ControlStripSettings}
 */
function normalizeControlStrip(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  return {
    visible: normalizeBoolean(stored.visible, DEFAULT_SETTINGS.controlStrip.visible),
    collapsed: normalizeBoolean(stored.collapsed, DEFAULT_SETTINGS.controlStrip.collapsed)
  };
}

const PANEL_ANCHOR_IDS = new Set([
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
 * @param {any} raw
 * @param {PanelPositionSettings} fallback
 * @returns {PanelPositionSettings}
 */
function normalizePanelPositionEntry(raw, fallback) {
  const fb = fallback && typeof fallback === 'object' ? fallback : {};
  if (!raw || typeof raw !== 'object') {
    return {
      left: Number.isFinite(fb.left) ? fb.left : undefined,
      top: Number.isFinite(fb.top) ? fb.top : undefined,
      anchor: typeof fb.anchor === 'string' ? fb.anchor : (fb.anchor === null ? null : undefined)
    };
  }
  /** @type {PanelPositionSettings} */
  const out = {};
  const left = typeof raw.left === 'number' ? raw.left : (typeof raw.left === 'string' ? Number(raw.left) : NaN);
  const top = typeof raw.top === 'number' ? raw.top : (typeof raw.top === 'string' ? Number(raw.top) : NaN);
  if (Number.isFinite(left)) out.left = left;
  if (Number.isFinite(top)) out.top = top;
  if (raw.anchor === null) {
    out.anchor = null;
  } else if (typeof raw.anchor === 'string' && PANEL_ANCHOR_IDS.has(raw.anchor.trim())) {
    out.anchor = raw.anchor.trim();
  } else if (typeof fb.anchor === 'string' && !Number.isFinite(left) && !Number.isFinite(top)) {
    out.anchor = fb.anchor;
  }
  // If nothing useful, fall back to default entry.
  if (out.left === undefined && out.top === undefined && out.anchor === undefined) {
    return {
      left: Number.isFinite(fb.left) ? fb.left : undefined,
      top: Number.isFinite(fb.top) ? fb.top : undefined,
      anchor: typeof fb.anchor === 'string' ? fb.anchor : (fb.anchor === null ? null : undefined)
    };
  }
  return out;
}

/**
 * @param {any} raw
 * @returns {PanelPositionsSettings}
 */
function normalizePanelPositions(raw) {
  const stored = raw && typeof raw === 'object' ? raw : {};
  return {
    keyboardReference: normalizePanelPositionEntry(
      stored.keyboardReference,
      DEFAULT_SETTINGS.panelPositions.keyboardReference
    ),
    controlStrip: normalizePanelPositionEntry(
      stored.controlStrip,
      DEFAULT_SETTINGS.panelPositions.controlStrip
    )
  };
}

/**
 * Map Settings scroll speed to ScrollOptions.behavior.
 * @param {ScrollSpeed|string|undefined|null} speed
 * @returns {'smooth'|'auto'}
 */
function scrollBehaviorFromSpeed(speed) {
  return normalizeScrollSpeed(speed) === 'instant' ? 'auto' : 'smooth';
}

/**
 * @returns {Promise<KeyPilotSettings>}
 */
async function getSettings() {
  try {
    let stored = await storageGetValue(SETTINGS_STORAGE_KEY, null);
    if (!stored || typeof stored !== 'object') stored = {};
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      searchEngine: normalizeSearchEngine(stored?.searchEngine),
      cursorMode: normalizeCursorMode(stored?.cursorMode),
      keyboardLayoutId: normalizeKeyboardLayoutId(stored?.keyboardLayoutId),
      keyboardReferenceKeyFeedback: normalizeBoolean(
        stored?.keyboardReferenceKeyFeedback,
        DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
      ),
      controlStrip: normalizeControlStrip(stored?.controlStrip),
      panelPositions: normalizePanelPositions(stored?.panelPositions),
      clickMode: normalizeClickMode(stored?.clickMode),
      textMode: normalizeTextMode(stored?.textMode),
      scroll: normalizeScroll(stored?.scroll)
    };
  } catch (_e) {
    return {
      ...DEFAULT_SETTINGS,
      controlStrip: { ...DEFAULT_SETTINGS.controlStrip },
      panelPositions: {
        keyboardReference: { ...DEFAULT_SETTINGS.panelPositions.keyboardReference },
        controlStrip: { ...DEFAULT_SETTINGS.panelPositions.controlStrip }
      },
      clickMode: { ...DEFAULT_SETTINGS.clickMode, cursor: { ...DEFAULT_SETTINGS.clickMode.cursor } },
      textMode: { ...DEFAULT_SETTINGS.textMode },
      scroll: { ...DEFAULT_SETTINGS.scroll }
    };
  }
}

/**
 * @param {Partial<KeyPilotSettings>} partial
 * @returns {Promise<KeyPilotSettings>}
 */
async function setSettings(partial) {
  const current = await getSettings();
  const p = partial && typeof partial === 'object' ? partial : {};

  // Shallow merge for top-level, plus deep merge for known nested settings.
  const pPositions = p.panelPositions && typeof p.panelPositions === 'object' ? p.panelPositions : null;

  /** @type {KeyPilotSettings} */
  const next = {
    ...current,
    ...p,
    controlStrip: {
      ...current.controlStrip,
      ...(p.controlStrip && typeof p.controlStrip === 'object' ? p.controlStrip : {})
    },
    panelPositions: {
      keyboardReference: {
        ...current.panelPositions.keyboardReference,
        ...(pPositions?.keyboardReference && typeof pPositions.keyboardReference === 'object'
          ? pPositions.keyboardReference
          : {})
      },
      controlStrip: {
        ...current.panelPositions.controlStrip,
        ...(pPositions?.controlStrip && typeof pPositions.controlStrip === 'object'
          ? pPositions.controlStrip
          : {})
      }
    },
    clickMode: {
      ...current.clickMode,
      ...(p.clickMode && typeof p.clickMode === 'object' ? p.clickMode : {}),
      cursor: {
        ...current.clickMode.cursor,
        ...(p.clickMode && typeof p.clickMode === 'object' && p.clickMode.cursor && typeof p.clickMode.cursor === 'object'
          ? p.clickMode.cursor
          : {})
      }
    },
    textMode: {
      ...current.textMode,
      ...(p.textMode && typeof p.textMode === 'object' ? p.textMode : {})
    },
    scroll: {
      ...current.scroll,
      ...(p.scroll && typeof p.scroll === 'object' ? p.scroll : {})
    }
  };
  next.searchEngine = normalizeSearchEngine(next.searchEngine);
  next.cursorMode = normalizeCursorMode(next.cursorMode);
  next.keyboardLayoutId = normalizeKeyboardLayoutId(next.keyboardLayoutId);
  next.keyboardReferenceKeyFeedback = normalizeBoolean(
    next.keyboardReferenceKeyFeedback,
    DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
  );
  next.controlStrip = normalizeControlStrip(next.controlStrip);
  next.panelPositions = normalizePanelPositions(next.panelPositions);
  next.clickMode = normalizeClickMode(next.clickMode);
  next.textMode = normalizeTextMode(next.textMode);
  next.scroll = normalizeScroll(next.scroll);
  await storageSetValue(SETTINGS_STORAGE_KEY, next);
  return next;
}

/**
 * @param {SearchEngine} engine
 * @param {string} query
 */
function buildSearchUrl(engine, query) {
  const meta = getSearchEngineMeta(engine);
  const q = typeof query === 'string' ? query : '';
  return `${meta.searchUrlPrefix}${encodeURIComponent(q)}`;
}

/**
 * @param {SearchEngine} engine
 */
function getEngineHomeUrl(engine) {
  return getSearchEngineMeta(engine).homeUrl;
}





  // Module: src/modules/frame-click-agent.js
/**
 * Thin cross-origin iframe click + hover agent.
 *
 * Runs only in non-top frames. Stays light (no full KeyPilot):
 *  1. postMessage / runtime KP_FRAME_ACTIVATE from the parent (top-frame F/B/G)
 *  2. Activate keybinds when this frame has focus
 *  3. Blue hover outline on clickable targets under the pointer (rAF-throttled;
 *     matches top-frame DOM-hover focus palette)
 *  4. postMessage / runtime KP_FRAME_SCROLL from parent (C/V under this iframe)
 *     plus local C/V when this frame has focus — nested overflow first
 *
 * Full KeyPilot still initializes only in the top frame. When full KP is also
 * running in this frame (KeyPilot popover), local key + hover handling is skipped.
 */






/**
 * @typedef {{ openInNewTab?: boolean, background?: boolean }} FrameActivateOptions
 */

const CLICKABLE_SEL =
  'a[href], button, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], summary, [onclick], input, select, textarea, label';

/**
 * Shadow-DOM–aware elementFromPoint (no iframe piercing — that is recursive via postMessage).
 * @param {number} x
 * @param {number} y
 * @returns {Element|null}
 */
function deepElementFromPoint(x, y) {
  try {
    let el = document.elementFromPoint(x, y);
    let guard = 0;
    while (el && el.shadowRoot && guard++ < 10) {
      const nested = el.shadowRoot.elementFromPoint(x, y);
      if (!nested || nested === el) break;
      el = nested;
    }
    return el || null;
  } catch {
    return null;
  }
}

/**
 * Read computed styles with KeyPilot custom-cursor override suspended so
 * cursor:pointer on the page is still visible when CUSTOM_CURSORS is on.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function withNativePageCursors(fn) {
  let html = null;
  try { html = document.documentElement; } catch { /* ignore */ }
  if (!html || !html.classList) return fn();
  const hadHidden = html.classList.contains(CSS_CLASSES.CURSOR_HIDDEN);
  if (hadHidden) {
    try { html.classList.remove(CSS_CLASSES.CURSOR_HIDDEN); } catch { /* ignore */ }
  }
  try {
    return fn();
  } finally {
    if (hadHidden) {
      try { html.classList.add(CSS_CLASSES.CURSOR_HIDDEN); } catch { /* ignore */ }
    }
  }
}

/**
 * @param {Element|null} el
 * @returns {Element|null}
 */
function resolveClickable(el) {
  if (!el || el.nodeType !== 1) return null;
  try {
    if (el.tagName === 'IFRAME') return el;
    if (el.id === 'kpv2-frame-hover' || el.closest?.('#kpv2-frame-hover')) return null;
    const specific = typeof el.closest === 'function' ? el.closest(CLICKABLE_SEL) : null;
    if (specific) return specific;
    // cursor:pointer on this node only (not inherited from body).
    // Suspend custom-cursor override — otherwise getComputedStyle always reports
    // the KeyPilot crosshair and pointer-only targets never outline.
    try {
      if (el !== document.body && el !== document.documentElement) {
        return withNativePageCursors(() => {
          const cs = window.getComputedStyle(el);
          if (cs.cursor === 'pointer' && cs.pointerEvents !== 'none') {
            const parent = el.parentElement;
            if (!parent || window.getComputedStyle(parent).cursor !== 'pointer') {
              return el;
            }
          }
          return null;
        });
      }
    } catch { /* ignore */ }
    return null;
  } catch {
    return null;
  }
}

/**
 * Coordinate-carrying click sequence (mirrors ActivationHandler.dispatchClickSequence).
 * @param {EventTarget} target
 * @param {number} clientX
 * @param {number} clientY
 */
function dispatchClickSequence(target, clientX, clientY) {
  if (!target) return;

  const common = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1
  };

  const hasPointer = typeof window.PointerEvent === 'function';
  if (hasPointer) {
    const pCommon = { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { target.dispatchEvent(new PointerEvent('pointerover', pCommon)); } catch { /* ignore */ }
    try { target.dispatchEvent(new PointerEvent('pointerenter', pCommon)); } catch { /* ignore */ }
    try { target.dispatchEvent(new PointerEvent('pointerdown', pCommon)); } catch { /* ignore */ }
  } else {
    try { target.dispatchEvent(new MouseEvent('pointerover', common)); } catch { /* ignore */ }
    try { target.dispatchEvent(new MouseEvent('pointerenter', common)); } catch { /* ignore */ }
    try { target.dispatchEvent(new MouseEvent('pointerdown', common)); } catch { /* ignore */ }
  }

  try { target.dispatchEvent(new MouseEvent('mouseover', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mouseenter', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mousemove', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mousedown', common)); } catch { /* ignore */ }

  const commonUp = { ...common, buttons: 0 };
  if (hasPointer) {
    const pUp = { ...commonUp, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { target.dispatchEvent(new PointerEvent('pointerup', pUp)); } catch { /* ignore */ }
  } else {
    try { target.dispatchEvent(new MouseEvent('pointerup', commonUp)); } catch { /* ignore */ }
  }
  try { target.dispatchEvent(new MouseEvent('mouseup', commonUp)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('click', commonUp)); } catch { /* ignore */ }
}

/**
 * @param {Element|null} el
 * @returns {HTMLAnchorElement|null}
 */
function closestLink(el) {
  try {
    if (!el || el.nodeType !== 1) return null;
    if (el.tagName === 'A' && /** @type {HTMLAnchorElement} */ (el).href) {
      return /** @type {HTMLAnchorElement} */ (el);
    }
    const a = typeof el.closest === 'function' ? el.closest('a[href]') : null;
    return a && a.tagName === 'A' ? /** @type {HTMLAnchorElement} */ (a) : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @param {{ background?: boolean }} opts
 * @returns {boolean}
 */
function openUrlViaRuntime(url, opts = {}) {
  if (!url) return false;
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return false;
    const type = opts.background ? MSG.OPEN_URL_BACKGROUND : MSG.OPEN_URL_FOREGROUND;
    chrome.runtime.sendMessage({ type, url }).catch(() => { /* ignore */ });
    return true;
  } catch {
    return false;
  }
}

/**
 * True when full KeyPilot is running in this frame (e.g. KP popover iframe).
 * @returns {boolean}
 */
function hasFullKeyPilot() {
  try {
    return !!(window.keyPilot || window.__KeyPilotInstance || window.__KeyPilotToggleHandler);
  } catch {
    return false;
  }
}

/**
 * Install the frame click agent in a child frame.
 * @returns {{ dispose: () => void }|null}
 */
function installFrameClickAgent() {
  try {
    if (window === window.top) return null;

    /** @type {boolean} */
    let enabled = true;
    /** @type {{ x: number|null, y: number|null }} */
    let lastMouse = { x: null, y: null };
    /** @type {ReturnType<typeof buildKeybindingsForLayout>} */
    let keybindings = buildKeybindingsForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);
    /** @type {number} */
    let halfPagePx = SCROLL.HALF_PAGE_PX;
    /** @type {'smooth'|'auto'} */
    let scrollBehavior = SCROLL.BEHAVIOR === 'smooth' ? 'smooth' : 'auto';

    /** @type {HTMLElement|null} */
    let hoverEl = null;
    /** @type {Element|null} */
    let hoverTarget = null;
    /** @type {number} */
    let hoverRaf = 0;
    /** @type {boolean} */
    let pointerInside = false;
    /** @type {{ focusColor: string, overlayFillEnabled: boolean, overlayShadowEnabled: boolean, rectangleThickness: number }} */
    let focusChrome = {
      focusColor: 'blue',
      overlayFillEnabled: false,
      overlayShadowEnabled: false,
      rectangleThickness: 3
    };

    const paletteFor = (color) => {
      if (color === 'green') {
        return {
          border: COLORS.FOCUS_GREEN || 'rgba(0,180,0,0.95)',
          shadow: COLORS.GREEN_SHADOW || 'rgba(0,180,0,0.45)',
          shadowBright: COLORS.GREEN_SHADOW_BRIGHT || 'rgba(0,180,0,0.5)',
          fill: COLORS.FOCUS_GREEN_BG_T2 || 'rgba(46, 204, 113, 0.4)'
        };
      }
      return {
        border: COLORS.FOCUS_BLUE || 'rgba(33,150,243,0.95)',
        shadow: COLORS.BLUE_SHADOW || 'rgba(33,150,243,0.35)',
        shadowBright: COLORS.BLUE_SHADOW_BRIGHT || 'rgba(33,150,243,0.45)',
        fill: COLORS.FOCUS_BLUE_BG_T2 || 'rgba(33,150,243,0.25)'
      };
    };

    const applyFocusChromeToHoverEl = () => {
      if (!hoverEl) return;
      const p = paletteFor(focusChrome.focusColor);
      const thickness = Math.min(Math.max(Number(focusChrome.rectangleThickness) || 3, 1), 16);
      try {
        hoverEl.style.border = `${thickness}px solid ${p.border}`;
        hoverEl.style.background =
          focusChrome.overlayFillEnabled === false ? 'transparent' : p.fill;
        hoverEl.style.boxShadow = focusChrome.overlayShadowEnabled === false
          ? 'none'
          : `0 0 0 1px ${p.shadow}, 0 0 8px ${p.shadowBright}`;
      } catch { /* ignore */ }
    };

    const keyIn = (assignment, key) => {
      try {
        const keys = assignment?.keys;
        return Array.isArray(keys) && keys.includes(key);
      } catch {
        return false;
      }
    };

    const refreshKeybindings = async () => {
      try {
        const settings = await getSettings();
        const layoutId = normalizeKeyboardLayoutId(settings?.keyboardLayoutId);
        keybindings = buildKeybindingsForLayout(layoutId);
        const cm = settings?.clickMode || {};
        focusChrome = {
          focusColor: cm.focusColor === 'green' ? 'green' : 'blue',
          overlayFillEnabled: cm.overlayFillEnabled === true,
          overlayShadowEnabled: cm.overlayShadowEnabled === true,
          rectangleThickness: Number(cm.rectangleThickness) || 3
        };
        const half = Number(settings?.scroll?.halfPagePx);
        if (Number.isFinite(half) && half > 0) halfPagePx = half;
        else halfPagePx = SCROLL.HALF_PAGE_PX;
        try {
          scrollBehavior = scrollBehaviorFromSpeed(
            settings?.scroll?.speed ?? DEFAULT_SETTINGS.scroll.speed
          );
        } catch {
          scrollBehavior = SCROLL.BEHAVIOR === 'smooth' ? 'smooth' : 'auto';
        }
        applyFocusChromeToHoverEl();
        if (pointerInside && enabled) scheduleHoverUpdate();
      } catch {
        // keep previous / default
      }
    };

    /**
     * C / V scroll under the pointer (or given coords): nested overflow first.
     * @param {number} clientX
     * @param {number} clientY
     * @param {number} sign  -1 up/left, +1 down/right
     * @param {number} [deltaPx]
     * @param {ScrollBehavior} [behavior]
     * @returns {boolean}
     */
    const scrollAt = (clientX, clientY, sign, deltaPx, behavior) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
      const amount = Math.abs(Number(deltaPx));
      const delta = Number.isFinite(amount) && amount > 0 ? amount : halfPagePx;
      const s = sign < 0 ? -1 : 1;
      const beh = behavior === 'auto' || behavior === 'instant' ? 'auto' : (behavior || scrollBehavior);

      // Nested iframe under point: re-forward into child agent.
      try {
        const under = deepElementFromPoint(clientX, clientY);
        if (under && under.tagName === 'IFRAME') {
          const iframe = /** @type {HTMLIFrameElement} */ (under);
          const rect = iframe.getBoundingClientRect();
          const localX = clientX - rect.left;
          const localY = clientY - rect.top;
          if (
            localX >= 0 && localY >= 0 &&
            localX <= rect.width && localY <= rect.height &&
            iframe.contentWindow
          ) {
            iframe.contentWindow.postMessage({
              type: MSG.FRAME_SCROLL,
              clientX: localX,
              clientY: localY,
              sign: s,
              deltaPx: delta,
              behavior: beh,
              frameName: typeof iframe.name === 'string' ? iframe.name : ''
            }, '*');
            return true;
          }
        }
      } catch { /* fall through */ }

      const result = scrollAtPoint(clientX, clientY, s, delta, beh);
      return !!result?.scrolled;
    };

    const setEnabled = (next) => {
      enabled = !!next;
      if (!enabled) hideHover();
    };

    const syncEnabledFromRuntime = async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
        const response = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
        if (response && typeof response.enabled === 'boolean') {
          setEnabled(response.enabled);
        }
      } catch {
        // Default enabled on communication failure (matches toggle handler).
        setEnabled(true);
      }
    };

    const ensureHoverEl = () => {
      if (hoverEl && hoverEl.isConnected) return hoverEl;
      try {
        const el = document.createElement('div');
        el.id = 'kpv2-frame-hover';
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = [
          'position:fixed',
          'left:0',
          'top:0',
          'width:0',
          'height:0',
          'margin:0',
          'padding:0',
          'box-sizing:border-box',
          'pointer-events:none',
          `z-index:${typeof Z_INDEX?.OVERLAYS === 'number' ? Z_INDEX.OVERLAYS : 2147483020}`,
          'border-radius:2px',
          'display:none',
          'opacity:1'
        ].join(';');
        (document.documentElement || document.body)?.appendChild(el);
        hoverEl = el;
        applyFocusChromeToHoverEl();
        return el;
      } catch {
        return null;
      }
    };

    const hideHover = () => {
      hoverTarget = null;
      if (hoverRaf) {
        try { cancelAnimationFrame(hoverRaf); } catch { /* ignore */ }
        hoverRaf = 0;
      }
      if (hoverEl) {
        try {
          hoverEl.style.display = 'none';
          hoverEl.style.width = '0px';
          hoverEl.style.height = '0px';
        } catch { /* ignore */ }
      }
    };

    /**
     * @param {Element|null} target
     */
    const paintHover = (target) => {
      if (!target || !(target instanceof Element)) {
        hideHover();
        return;
      }
      // Don't outline nested iframes (child agent / shell only).
      if (target.tagName === 'IFRAME') {
        hideHover();
        return;
      }
      let rect;
      try {
        rect = target.getBoundingClientRect();
      } catch {
        hideHover();
        return;
      }
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        hideHover();
        return;
      }
      // Skip absurd full-viewport fills (often body/html mistaken for clickable).
      try {
        if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95) {
          hideHover();
          return;
        }
      } catch { /* ignore */ }

      const el = ensureHoverEl();
      if (!el) return;
      hoverTarget = target;
      try {
        el.style.display = 'block';
        el.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
        el.style.width = `${Math.round(rect.width)}px`;
        el.style.height = `${Math.round(rect.height)}px`;
      } catch { /* ignore */ }
    };

    const scheduleHoverUpdate = () => {
      if (hoverRaf) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        try {
          if (!enabled || !pointerInside || hasFullKeyPilot()) {
            hideHover();
            return;
          }
          const x = lastMouse.x;
          const y = lastMouse.y;
          if (typeof x !== 'number' || typeof y !== 'number') {
            hideHover();
            return;
          }
          const under = deepElementFromPoint(x, y);
          const clickable = resolveClickable(under);
          if (clickable === hoverTarget && hoverEl && hoverEl.style.display === 'block') {
            // Same target — refresh rect in case of scroll/layout shift.
            paintHover(clickable);
            return;
          }
          paintHover(clickable);
        } catch {
          hideHover();
        }
      });
    };

    /** Prevent double-activate when parent uses both postMessage and SW fan-out. */
    let lastActivateAt = 0;

    /**
     * @param {number} clientX
     * @param {number} clientY
     * @param {FrameActivateOptions} [opts]
     * @returns {boolean}
     */
    const activateAt = (clientX, clientY, opts = {}) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

      const now = Date.now();
      if (now - lastActivateAt < 100) return false;
      lastActivateAt = now;

      const el = deepElementFromPoint(clientX, clientY);
      if (!el) return false;

      // Nested iframe: re-forward with coordinates local to the nested frame.
      if (el.tagName === 'IFRAME') {
        try {
          const iframe = /** @type {HTMLIFrameElement} */ (el);
          const rect = iframe.getBoundingClientRect();
          const localX = clientX - rect.left;
          const localY = clientY - rect.top;
          if (
            localX >= 0 && localY >= 0 &&
            localX <= rect.width && localY <= rect.height &&
            iframe.contentWindow
          ) {
            iframe.contentWindow.postMessage({
              type: MSG.FRAME_ACTIVATE,
              clientX: localX,
              clientY: localY,
              openInNewTab: !!opts.openInNewTab,
              background: !!opts.background
            }, '*');
            return true;
          }
        } catch {
          // Fall through to click the iframe element itself.
        }
      }

      const openInNewTab = !!opts.openInNewTab;
      const background = !!opts.background;
      const link = closestLink(el);

      if (link && (openInNewTab || background)) {
        const url = link.href;
        if (openUrlViaRuntime(url, { background })) return true;
        try {
          if (background) {
            window.open(url, '_blank', 'noopener,noreferrer');
          } else {
            const originalTarget = link.target;
            link.target = '_blank';
            try { link.click(); } catch { window.open(url, '_blank', 'noopener,noreferrer'); }
            if (originalTarget !== undefined && originalTarget !== null && originalTarget !== '') {
              link.target = originalTarget;
            } else {
              link.removeAttribute('target');
            }
          }
          return true;
        } catch {
          return false;
        }
      }

      const activator = resolveClickable(el) || el;

      // Same-window link: programmatic click preserves site handlers better than location assign.
      if (activator.tagName === 'A' && /** @type {HTMLAnchorElement} */ (activator).href && !openInNewTab && !background) {
        try {
          /** @type {HTMLAnchorElement} */ (activator).click();
          return true;
        } catch { /* fall through to event sequence */ }
      }

      // <summary> toggles <details> only via activation behavior (HTMLElement.click() /
      // trusted click). Synthetic events alone do not open/close the accordion.
      try {
        let summary = null;
        if (activator && activator.tagName === 'SUMMARY') summary = activator;
        else if (el && typeof el.closest === 'function') {
          const s = el.closest('summary');
          if (s && s.tagName === 'SUMMARY') summary = s;
        } else if (activator && activator.tagName === 'DETAILS') {
          summary = activator.querySelector(':scope > summary');
        }
        if (summary && typeof summary.click === 'function') {
          summary.click();
          return true;
        }
      } catch { /* fall through */ }

      dispatchClickSequence(el, clientX, clientY);
      try {
        if (
          activator &&
          activator !== el &&
          !(typeof activator.contains === 'function' && activator.contains(el))
        ) {
          dispatchClickSequence(activator, clientX, clientY);
        }
      } catch { /* ignore */ }

      return true;
    };

    /**
     * Shared gate for parent → child frame messages (activate + scroll).
     * postMessage source checks are unreliable across content-script isolated
     * worlds (`event.source === window.parent` often fails). Accept only when
     * framed and payload is well-formed; optional frameName targets a specific
     * iframe (e.g. Google name="account").
     * @param {MessageEvent|null} event
     * @param {any} data
     * @param {string} type
     * @returns {boolean}
     */
    const acceptFramePayload = (event, data, type) => {
      if (!data || data.type !== type) return false;
      if (!enabled) return false;
      // Must be embedded (not top-level).
      try {
        if (window === window.top) return false;
      } catch {
        // Access to top can throw in rare sandboxes — treat as framed.
      }
      // Reject self-posted messages when we can tell.
      try {
        if (event && event.source === window) return false;
      } catch { /* ignore */ }
      // Optional name targeting (parent includes iframe.name when set).
      try {
        const want = typeof data.frameName === 'string' ? data.frameName : '';
        if (want && window.name && want !== window.name) return false;
      } catch { /* ignore */ }
      return Number.isFinite(Number(data.clientX)) && Number.isFinite(Number(data.clientY));
    };

    /**
     * @param {MessageEvent|null} event
     * @param {any} data
     * @returns {boolean}
     */
    const acceptActivatePayload = (event, data) =>
      acceptFramePayload(event, data, MSG.FRAME_ACTIVATE);

    /**
     * @param {MessageEvent|null} event
     * @param {any} data
     * @returns {boolean}
     */
    const acceptScrollPayload = (event, data) =>
      acceptFramePayload(event, data, MSG.FRAME_SCROLL);

    /** @param {MessageEvent} event */
    const onMessage = (event) => {
      try {
        const data = event?.data;
        if (acceptActivatePayload(event, data)) {
          const x = Number(data.clientX);
          const y = Number(data.clientY);
          activateAt(x, y, {
            openInNewTab: !!data.openInNewTab,
            background: !!data.background
          });
          return;
        }
        if (acceptScrollPayload(event, data)) {
          const x = Number(data.clientX);
          const y = Number(data.clientY);
          const sign = Number(data.sign) < 0 ? -1 : 1;
          const delta = Number(data.deltaPx);
          const beh = data.behavior === 'auto' || data.behavior === 'instant'
            ? 'auto'
            : (data.behavior || scrollBehavior);
          scrollAt(x, y, sign, delta, beh);
        }
      } catch {
        // ignore
      }
    };

    /** @param {MouseEvent|PointerEvent} e */
    const onPointer = (e) => {
      try {
        if (typeof e.clientX === 'number') lastMouse.x = e.clientX;
        if (typeof e.clientY === 'number') lastMouse.y = e.clientY;
        pointerInside = true;
        if (enabled && !hasFullKeyPilot()) scheduleHoverUpdate();
      } catch {
        // ignore
      }
    };

    const onPointerLeave = () => {
      pointerInside = false;
      hideHover();
    };

    const onScroll = () => {
      if (pointerInside && enabled) scheduleHoverUpdate();
    };

    /** @param {KeyboardEvent} e */
    const onKeyDown = (e) => {
      try {
        if (!enabled) return;
        // Full KeyPilot in this frame owns activate / scroll keys.
        if (hasFullKeyPilot()) return;
        if (hasModifierKeys(e)) return;
        if (isTypingContext(e.target)) return;

        const key = e.key;
        const kb = keybindings || {};
        let mode = null;
        /** @type {number|null} */
        let scrollSign = null;
        if (keyIn(kb.ACTIVATE, key)) mode = 'activate';
        else if (keyIn(kb.ACTIVATE_NEW_TAB, key)) mode = 'newTab';
        else if (keyIn(kb.ACTIVATE_NEW_TAB_BACKGROUND, key)) mode = 'background';
        else if (keyIn(kb.PAGE_UP_INSTANT, key)) scrollSign = -1;
        else if (keyIn(kb.PAGE_DOWN_INSTANT, key)) scrollSign = 1;
        else return;

        let x = lastMouse.x;
        let y = lastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
          x = Math.floor(window.innerWidth / 2);
          y = Math.floor(window.innerHeight / 2);
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (scrollSign !== null) {
          scrollAt(x, y, scrollSign, halfPagePx, scrollBehavior);
          return;
        }

        activateAt(x, y, {
          openInNewTab: mode === 'newTab',
          background: mode === 'background'
        });
      } catch {
        // ignore
      }
    };

    /**
     * @param {any} message
     * @param {chrome.runtime.MessageSender} _sender
     * @param {(response?: any) => void} sendResponse
     */
    const onRuntimeMessage = (message, _sender, sendResponse) => {
      try {
        if (message?.type === MSG.TOGGLE_STATE || message?.type === MSG.UPDATE_STATE) {
          if (typeof message.enabled === 'boolean') {
            setEnabled(message.enabled);
          }
          return false;
        }

        // Backup path: SW can fan-out FRAME_ACTIVATE / FRAME_SCROLL to subframes
        // (postMessage is primary).
        if (message?.type === MSG.FRAME_ACTIVATE) {
          if (!acceptActivatePayload(null, message)) {
            try { sendResponse({ ok: false }); } catch { /* ignore */ }
            return true;
          }
          const ok = activateAt(Number(message.clientX), Number(message.clientY), {
            openInNewTab: !!message.openInNewTab,
            background: !!message.background
          });
          try { sendResponse({ ok: !!ok, href: String(location.href || '').slice(0, 120) }); } catch { /* ignore */ }
          return true;
        }

        if (message?.type === MSG.FRAME_SCROLL) {
          if (!acceptScrollPayload(null, message)) {
            try { sendResponse({ ok: false }); } catch { /* ignore */ }
            return true;
          }
          const sign = Number(message.sign) < 0 ? -1 : 1;
          const ok = scrollAt(
            Number(message.clientX),
            Number(message.clientY),
            sign,
            Number(message.deltaPx),
            message.behavior
          );
          try { sendResponse({ ok: !!ok, href: String(location.href || '').slice(0, 120) }); } catch { /* ignore */ }
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    };

    /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
    const onStorageChanged = (changes, area) => {
      try {
        if (area !== 'sync' && area !== 'local') return;
        if (changes?.keypilot_enabled && typeof changes.keypilot_enabled.newValue === 'boolean') {
          setEnabled(changes.keypilot_enabled.newValue);
        }
        if (changes && Object.prototype.hasOwnProperty.call(changes, SETTINGS_STORAGE_KEY)) {
          void refreshKeybindings();
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('message', onMessage, true);
    document.addEventListener('mousemove', onPointer, { capture: true, passive: true });
    document.addEventListener('pointermove', onPointer, { capture: true, passive: true });
    document.addEventListener('mouseleave', onPointerLeave, true);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown, true);

    try {
      chrome.runtime?.onMessage?.addListener(onRuntimeMessage);
    } catch { /* ignore */ }
    try {
      chrome.storage?.onChanged?.addListener(onStorageChanged);
    } catch { /* ignore */ }

    // Visible to page-world diagnostics (isolated world cannot expose JS globals to the page).
    try {
      document.documentElement?.setAttribute('data-kp-frame-agent', '1');
    } catch { /* ignore */ }

    void syncEnabledFromRuntime();
    void refreshKeybindings();

    return {
      dispose() {
        hideHover();
        try {
          if (hoverEl) hoverEl.remove();
        } catch { /* ignore */ }
        hoverEl = null;
        try {
          window.removeEventListener('message', onMessage, true);
          document.removeEventListener('mousemove', onPointer, true);
          document.removeEventListener('pointermove', onPointer, true);
          document.removeEventListener('mouseleave', onPointerLeave, true);
          document.removeEventListener('scroll', onScroll, true);
          window.removeEventListener('scroll', onScroll, true);
          document.removeEventListener('keydown', onKeyDown, true);
        } catch { /* ignore */ }
        try {
          chrome.runtime?.onMessage?.removeListener(onRuntimeMessage);
        } catch { /* ignore */ }
        try {
          chrome.storage?.onChanged?.removeListener(onStorageChanged);
        } catch { /* ignore */ }
        try {
          document.documentElement?.removeAttribute('data-kp-frame-agent');
        } catch { /* ignore */ }
      }
    };
  } catch (error) {
    console.warn('[KeyPilot] Failed to install frame click agent:', error);
    return null;
  }
}



  // Module: src/modules/popover-iframe-bridge.js
/**
 * Shared popover iframe bridge (parent ↔ iframe postMessage).
 *
 * Used by:
 * - content-script.js (page iframes inside KeyPilot popovers; may start full KeyPilot)
 * - pages/popover-bridge.js (chrome-extension:// pages; no content-script injection)
 *
 * Handshake: POPOVER_BRIDGE_INIT → POPOVER_BRIDGE_READY
 * Parent commands: POPOVER_SCROLL
 * Child → parent: POPOVER_REQUEST_CLOSE, POPOVER_BRIDGE_KEYDOWN
 */




/**
 * @typedef {object} PopoverIframeBridgeOptions
 * @property {boolean} [treatSelectAsTyping=false] - extension pages with <select> controls
 * @property {boolean} [closeOnQuote=false] - also treat `'` as close (extension pages)
 * @property {boolean} [enableFClickBeforeKeyPilot=false] - F-activate link before full KP starts
 * @property {() => void} [onBridgeInit] - called once when parent sends INIT (e.g. start KeyPilot)
 * @property {(err: unknown) => void} [onError]
 */

/**
 * Install the popover iframe bridge if this window is an iframe (or always when
 * `force` is implied by caller for extension pages that always run as iframe content).
 *
 * @param {PopoverIframeBridgeOptions} [options]
 * @returns {{ dispose: () => void }|null}
 */
function installPopoverIframeBridge(options = {}) {
  const {
    treatSelectAsTyping = false,
    closeOnQuote = false,
    enableFClickBeforeKeyPilot = false,
    onBridgeInit = null,
    onError = null
  } = options;

  try {
    let bridgeActive = false;
    let keyPilotStarted = false;
    let mouseInsideFrame = true;
    let lastMouse = { x: null, y: null };
    // Close keys from parent INIT (defaults cover open-popover P + link-preview E).
    /** @type {Set<string>} */
    let closeKeySet = new Set(['Escape', 'e', 'E', 'p', 'P']);

    const scrollByY = (deltaY, behavior = 'smooth') => {
      try {
        const el = document.scrollingElement || document.documentElement || document.body;
        if (el && typeof el.scrollBy === 'function') {
          el.scrollBy({ top: deltaY, behavior });
        } else {
          window.scrollBy({ top: deltaY, behavior });
        }
      } catch {
        // ignore
      }
    };

    const scrollToY = (top, behavior = 'smooth') => {
      try {
        window.scrollTo({ top, behavior });
      } catch {
        // ignore
      }
    };

    const deepElementFromPoint = (x, y) => {
      try {
        let el = document.elementFromPoint(x, y);
        while (el && el.shadowRoot && typeof el.shadowRoot.elementFromPoint === 'function') {
          const inner = el.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === el) break;
          el = inner;
        }
        return el;
      } catch {
        return null;
      }
    };

    const updateMouse = (e) => {
      try {
        if (!e) return;
        if (typeof e.clientX === 'number') lastMouse.x = e.clientX;
        if (typeof e.clientY === 'number') lastMouse.y = e.clientY;
      } catch {
        // ignore
      }
    };

    const setInside = (v) => {
      mouseInsideFrame = !!v;
    };

    const typingAt = (target) =>
      isTypingContext(target, treatSelectAsTyping ? { treatSelectAsTyping: true } : undefined);

    const resolveScrollParams = () => {
      const kp = window.__KeyPilotInstance;
      const pagePx = (typeof kp?._getPageScrollPx === 'function')
        ? kp._getPageScrollPx()
        : SCROLL.PAGE_PX;
      const halfPx = (typeof kp?._getHalfPageScrollPx === 'function')
        ? kp._getHalfPageScrollPx()
        : SCROLL.HALF_PAGE_PX;
      const behavior = (typeof kp?._getScrollBehavior === 'function')
        ? kp._getScrollBehavior()
        : (SCROLL.BEHAVIOR || 'smooth');
      return { pagePx, halfPx, behavior };
    };

    const onMessage = (event) => {
      const data = event?.data;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === MSG.POPOVER_BRIDGE_INIT) {
        bridgeActive = true;
        // Parent can pass layout-aware close keys (e.g. E for preview, P for open-popover).
        try {
          if (Array.isArray(data.closeKeys) && data.closeKeys.length) {
            closeKeySet = new Set(data.closeKeys.map(String));
            // Always allow Escape even if omitted.
            closeKeySet.add('Escape');
          }
        } catch { /* ignore */ }
        // Expose for in-frame KeyPilot (may register keydown after us and win capture order).
        try {
          window.__KP_POPOVER_IFRAME = true;
          window.__KP_POPOVER_CLOSE_KEYS = Array.from(closeKeySet);
        } catch { /* ignore */ }
        try {
          window.parent.postMessage({ type: MSG.POPOVER_BRIDGE_READY }, '*');
        } catch {
          // ignore
        }

        if (typeof onBridgeInit === 'function' && !keyPilotStarted) {
          keyPilotStarted = true;
          try {
            onBridgeInit();
          } catch {
            // ignore
          }
        }
        return;
      }

      if (!bridgeActive) return;

      if (data.type === MSG.POPOVER_SCROLL) {
        const behavior = data.behavior === 'auto' ? 'auto' : 'smooth';
        if (data.command === 'scrollBy') {
          const delta = Number(data.delta) || 0;
          scrollByY(delta, behavior);
        } else if (data.command === 'scrollToTop') {
          scrollToY(0, behavior);
        } else if (data.command === 'scrollToBottom') {
          const height = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
          scrollToY(height, behavior);
        }
      }
    };

    const onKeyDown = (e) => {
      if (!bridgeActive) return;
      if (hasModifierKeys(e)) return;

      const key = e.key;
      const typing = typingAt(e.target);

      const requestClose = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          window.parent.postMessage({ type: MSG.POPOVER_REQUEST_CLOSE, key }, '*');
        } catch {
          // ignore
        }
      };

      // F outside iframe → parent (e.g. close button on chrome).
      if (!typing && !mouseInsideFrame && (key === 'f' || key === 'F')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          window.parent.postMessage({ type: MSG.POPOVER_BRIDGE_KEYDOWN, key }, '*');
        } catch {
          // ignore
        }
        return;
      }

      // Close keys from parent (Esc + open/preview toggle keys). Capture-phase so
      // in-frame KeyPilot does not steal E/P for nested actions before we close.
      if (!typing && closeKeySet.has(key)) return requestClose();
      if (key === 'Escape') return requestClose();
      if (closeOnQuote && !typing && key === "'") return requestClose();

      // Pre-KeyPilot F: click link under cursor inside the iframe.
      if (
        enableFClickBeforeKeyPilot &&
        !keyPilotStarted &&
        !typing &&
        (key === 'f' || key === 'F')
      ) {
        let x = lastMouse.x;
        let y = lastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
          x = Math.floor(window.innerWidth / 2);
          y = Math.floor(window.innerHeight / 2);
        }

        const target = deepElementFromPoint(x, y);
        const link = target?.closest?.('a[href]') || null;
        if (link) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          try {
            link.click();
          } catch {
            // ignore
          }
        }
        return;
      }

      if (typing) return;

      const { pagePx, halfPx, behavior } = resolveScrollParams();

      // Historical bridge mapping (Z/X page, C/V half, B/N top/bottom).
      if (key === 'z' || key === 'Z') {
        e.preventDefault();
        scrollByY(-pagePx, behavior);
      } else if (key === 'x' || key === 'X') {
        e.preventDefault();
        scrollByY(pagePx, behavior);
      } else if (key === 'c' || key === 'C' || key === 'v' || key === 'V') {
        // Nested overflow under the cursor first; page fallback (same as top-frame C/V).
        e.preventDefault();
        let mx = lastMouse.x;
        let my = lastMouse.y;
        if (typeof mx !== 'number' || typeof my !== 'number') {
          mx = Math.floor(window.innerWidth / 2);
          my = Math.floor(window.innerHeight / 2);
        }
        const sign = (key === 'c' || key === 'C') ? -1 : 1;
        scrollAtPoint(mx, my, sign, halfPx, behavior);
      } else if (key === 'b' || key === 'B') {
        e.preventDefault();
        scrollToY(0, behavior);
      } else if (key === 'n' || key === 'N') {
        e.preventDefault();
        const height = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
        scrollToY(height, behavior);
      }
    };

    // Mouse tracking (needed for F-click before KP and inside/outside detection).
    document.addEventListener('mousemove', updateMouse, true);
    document.addEventListener('pointermove', updateMouse, true);
    document.addEventListener('mouseenter', () => setInside(true), true);
    document.addEventListener('mouseleave', () => setInside(false), true);
    try {
      if (document.documentElement) {
        document.documentElement.addEventListener('mouseenter', () => setInside(true), true);
        document.documentElement.addEventListener('mouseleave', () => setInside(false), true);
      }
    } catch {
      // ignore
    }

    window.addEventListener('message', onMessage, true);
    document.addEventListener('keydown', onKeyDown, true);

    return {
      dispose() {
        try {
          window.removeEventListener('message', onMessage, true);
          document.removeEventListener('keydown', onKeyDown, true);
          document.removeEventListener('mousemove', updateMouse, true);
          document.removeEventListener('pointermove', updateMouse, true);
        } catch {
          // ignore
        }
      }
    };
  } catch (error) {
    if (typeof onError === 'function') {
      try {
        onError(error);
      } catch {
        // ignore
      }
    } else {
      console.warn('[KeyPilot] Failed to install popover iframe bridge:', error);
    }
    return null;
  }
}



  // Module: src/frame-agent-entry.js
/**
 * Thin content-script entry for child frames only.
 *
 * Top frame uses content-bundled.js (full KeyPilot). Child frames load this
 * much smaller bundle so ads/widgets do not pay full parse+init cost.
 *
 * On popover INIT, requests the service worker to inject full KeyPilot into
 * this frame for the complete cursor/overlay experience.
 */



(function installFrameAgentsIfNeeded() {
  try {
    // Top frame is owned by content-bundled.js — no-op if this script also lands there.
    if (window === window.top) return;
    if (window.__KP_FRAME_AGENT_INSTALLED) return;
    window.__KP_FRAME_AGENT_INSTALLED = true;

    installFrameClickAgent();

    installPopoverIframeBridge({
      // Frame-click-agent owns pre-KP activate keys; avoid double-clicking links.
      enableFClickBeforeKeyPilot: false,
      onBridgeInit: () => {
        try {
          window.__KP_POPOVER_IFRAME = true;
        } catch { /* ignore */ }

        // Already have full KP in this frame (re-INIT or re-inject).
        try {
          if (window.keyPilot || window.__KeyPilotToggleHandler) return;
        } catch { /* ignore */ }

        // Ask SW to inject content-bundled.js into this frame (isolated world).
        try {
          chrome.runtime?.sendMessage?.(
            { type: MSG.INJECT_FULL_KEYPILOT_IN_FRAME },
            () => {
              try {
                void chrome.runtime?.lastError;
              } catch { /* ignore */ }
            }
          );
        } catch (e) {
          console.warn('[KeyPilot] Failed to request full KeyPilot inject in frame:', e);
        }
      },
      onError: (error) => {
        console.warn('[KeyPilot] Failed to install popover iframe bridge:', error);
      }
    });
  } catch (error) {
    console.warn('[KeyPilot] Failed to install frame agents:', error);
  }
})();



})();
