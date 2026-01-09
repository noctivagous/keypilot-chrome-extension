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

export const DEFAULT_KEYBOARD_LAYOUT_ID = /** @type {const} */ ('browsing-right');

export const BUILTIN_KEYBOARD_LAYOUT_META = Object.freeze([
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
export function normalizeKeyboardLayoutId(raw) {
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
export const KEYBINDING_ACTION_DEFS = Object.freeze({
  ACTIVATE: Object.freeze({
    handler: 'handleActivateKey',
    label: 'Click Element',
    description: 'Click Element',
    keyboardClass: 'key-activate',
    row: 2
  }),
  ACTIVATE_NEW_TAB: Object.freeze({
    handler: 'handleActivateNewTabOverKey',
    label: 'Click Tab Over',
    description: 'Open Link in New Tab (Background, like middle click)',
    keyboardClass: 'key-activate-new-over',
    row: 2
  }),
  ACTIVATE_NEW_TAB_OVER: Object.freeze({
    handler: 'handleActivateNewTabKey',
    label: 'Click New Tab',
    description: 'Click New Tab',
    keyboardClass: 'key-activate-new',
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
export function buildKeybindingsForLayout(layoutId) {
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
  OPEN_POPOVER: Object.freeze({ keys: ['e', 'E'] }),
  FORWARD: Object.freeze({ keys: ['r', 'R'] }),
  NEW_TAB: Object.freeze({ keys: ['t', 'T'] }),

  CLOSE_TAB: Object.freeze({ keys: ['a', 'A'] }),
  BACK2: Object.freeze({ keys: ['s', 'S'] }),
  BACK: Object.freeze({ keys: ['d', 'D'] }),
  ACTIVATE: Object.freeze({ keys: ['f', 'F'] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ['g', 'G'] }),

  TAB_HISTORY: Object.freeze({ keys: ['j', 'J'] }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ['k', 'K'] }),
  OMNIBOX: Object.freeze({ keys: ['l', 'L'] }),
  LAUNCHER: Object.freeze({ keys: [';', ':', 'Semicolon', '`', '~', 'Backquote'], matchOn: ['key', 'code'], displayKey: ';', keyLabel: ';' }),

  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", 'Quote'], matchOn: ['key', 'code'], displayKey: "'" }),

  PAGE_TOP: Object.freeze({ keys: ['z', 'Z'] }),
  PAGE_BOTTOM: Object.freeze({ keys: ['x', 'X'] }),
  PAGE_UP_INSTANT: Object.freeze({ keys: ['c', 'C'] }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ['v', 'V'] }),
  ACTIVATE_NEW_TAB_OVER: Object.freeze({ keys: ['b', 'B'] }),

  ROOT: Object.freeze({ keys: ['1', '!'], displayKey: '1', keyLabel: '1' }),
  DELETE: Object.freeze({ keys: ['Backspace'], displayKey: 'Backspace', keyLabel: 'Backspace' }),
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
  FORWARD: Object.freeze({ keys: ['u', 'U'] }),
  NEW_TAB: Object.freeze({ keys: ['y', 'Y'] }),

  // Home row cluster: A S D F G  ->  ; L K J H (mirrored-ish around center)
  CLOSE_TAB: Object.freeze({ keys: [';', ':'], displayKey: ';', keyLabel: ';' }),
  BACK2: Object.freeze({ keys: ['l', 'L'] }),
  BACK: Object.freeze({ keys: ['k', 'K'] }),
  ACTIVATE: Object.freeze({ keys: ['j', 'J'] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ['h', 'H'] }),

  // Utility actions: keep on the left to avoid colliding with J/K/L cluster.
  TAB_HISTORY: Object.freeze({ keys: ['f', 'F'] }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ['d', 'D'] }),
  OMNIBOX: Object.freeze({ keys: ['s', 'S'] }),
  LAUNCHER: Object.freeze({ keys: ['a', 'A', '`', '~', 'Backquote'], matchOn: ['key', 'code'], displayKey: 'a/`', keyLabel: 'a/`' }),

  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", 'Quote'], matchOn: ['key', 'code'], displayKey: "'" }),

  // Bottom row cluster: Z X C V B  ->  / . , M N (mirrored)
  PAGE_TOP: Object.freeze({ keys: ['/', '?'], displayKey: '/', keyLabel: '/' }),
  PAGE_BOTTOM: Object.freeze({ keys: ['.', '>'], displayKey: '.', keyLabel: '.' }),
  PAGE_UP_INSTANT: Object.freeze({ keys: [',', '<'], displayKey: ',', keyLabel: ',' }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ['m', 'M'] }),
  ACTIVATE_NEW_TAB_OVER: Object.freeze({ keys: ['n', 'N'] }),

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
    { type: 'action', id: 'OPEN_POPOVER', fallbackText: 'Open Popover' },
    { type: 'action', id: 'FORWARD', fallbackText: 'Go Forward' },
    { type: 'action', id: 'NEW_TAB', fallbackText: 'New Tab' },
    { type: 'key', text: 'Y' },
    { type: 'key', text: 'U' },
    { type: 'key', text: 'I' },
    { type: 'key', text: 'O' },
    { type: 'key', text: 'P' },
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
    { type: 'action', id: 'ACTIVATE_NEW_TAB', fallbackText: 'Click New Tab' },
    { type: 'key', text: 'H' },
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
    { type: 'action', id: 'ACTIVATE_NEW_TAB_OVER', fallbackText: 'Click New Tab Over' },
    { type: 'key', text: 'N' },
    { type: 'key', text: 'M' },
    { type: 'key', text: ',' },
    { type: 'key', text: '.' },
    { type: 'key', text: '/' },
    { type: 'special', text: 'Shift', className: 'key key-shift' }
  ]
]);

// Left-handed UI layout: move the action clusters to the right-hand physical keys.
const KEYBOARD_UI_LAYOUT_LEFT = Object.freeze([
  [
    { type: 'special', text: 'Tab', className: 'key key-tab' },
    { type: 'key', text: 'Q' },
    { type: 'key', text: 'W' },
    { type: 'key', text: 'E' },
    { type: 'key', text: 'R' },
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
    { type: 'key', text: 'G' },
    { type: 'action', id: 'ACTIVATE_NEW_TAB', fallbackText: 'Click New Tab' }, // H
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
    { type: 'key', text: 'B' },
    { type: 'action', id: 'ACTIVATE_NEW_TAB_OVER', fallbackText: 'Click New Tab Over' }, // N
    { type: 'action', id: 'PAGE_DOWN_INSTANT', fallbackText: 'Page Down Fast' }, // M
    { type: 'action', id: 'PAGE_UP_INSTANT', fallbackText: 'Page Up Fast' }, // ,
    { type: 'action', id: 'PAGE_BOTTOM', fallbackText: 'Scroll To Bottom' }, // .
    { type: 'action', id: 'PAGE_TOP', fallbackText: 'Scroll To Top' }, // /
    { type: 'special', text: 'Shift', className: 'key key-shift' }
  ]
]);

/** @type {Record<BuiltinKeyboardLayoutId, BuiltinKeyboardLayout>} */
export const BUILTIN_KEYBOARD_LAYOUTS = Object.freeze({
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
export function getKeyboardUiLayoutForLayout(layoutId) {
  const id = normalizeKeyboardLayoutId(layoutId);
  return BUILTIN_KEYBOARD_LAYOUTS[id]?.keyboardLayout || BUILTIN_KEYBOARD_LAYOUTS[DEFAULT_KEYBOARD_LAYOUT_ID].keyboardLayout;
}













