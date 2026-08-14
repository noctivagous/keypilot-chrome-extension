/**
 * Keyboard layout architecture for KeyPilot.
 *
 * Goals:
 * - Separate "what an action does" from "which physical keys trigger it".
 * - Allow multiple built-in layout families (Navigation, Basic Navigation, Click + History),
 *   each with right/left-handed variants.
 * - Provide a single source of truth consumed by:
 *   - runtime keydown mapping (KeyPilot)
 *   - keyboard visualization (popup + floating keyboard reference)
 * - Future-proof for user-defined layouts (store user layouts separately; keep IDs stable).
 */

/**
 * @typedef {'browsing-right'|'browsing-left'|'basic-navigation-right'|'basic-navigation-left'|'click-history-right'|'click-history-left'} BuiltinKeyboardLayoutId
 * @typedef {BuiltinKeyboardLayoutId|string} KeyboardLayoutId
 */

/**
 * Logical (handedness-agnostic) layout selection.
 * A "family" can have variants per handedness (e.g. Browsing → left/right implementation).
 *
 * Shown built-ins: `browsing` ("Built-in: Browsing") and `click-history` ("Built-in: Navigation").
 * Legacy family id `basic-navigation` still resolves for stored settings.
 *
 * @typedef {'browsing'|'basic-navigation'|'click-history'} BuiltinKeyboardLayoutFamilyId
 * @typedef {BuiltinKeyboardLayoutFamilyId|string} KeyboardLayoutFamilyId
 * @typedef {'right'|'left'} KeyboardHandedness
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
 *   row?: number|null,
 *   category?: string,
 *   // When set, this Function owns `state.mode` while active (toggle / modal).
 *   mode?: string,
 *   // Dismiss the owned mode on pointerdown (any mouse button) via cancelModes.
 *   cancelOnPointerDown?: boolean,
 *   // Optional mouse-button assignment for this same Function (see pointer-function-bindings.js).
 *   pointerBinding?: {
 *     button: 'left'|'middle'|'right',
 *     yieldToClickables?: boolean,
 *     yieldToTextEntry?: boolean,
 *     yieldToModes?: string[],
 *     enabledSetting?: string
 *   }
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

export const DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID = /** @type {const} */ ('browsing');
export const DEFAULT_KEYBOARD_HANDEDNESS = /** @type {const} */ ('right');

export const BUILTIN_KEYBOARD_LAYOUT_META = Object.freeze([
  Object.freeze({
    id: /** @type {const} */ ('browsing-right'),
    label: 'Browsing: right-handed',
    description: 'Full browsing layout. Mouse: right hand. Shortcuts primarily on the left.'
  }),
  Object.freeze({
    id: /** @type {const} */ ('browsing-left'),
    label: 'Browsing: left-handed',
    description: 'Full browsing layout. Mouse: left hand. Shortcuts primarily on the right.'
  }),
  Object.freeze({
    id: /** @type {const} */ ('basic-navigation-right'),
    label: 'Basic Navigation: right-handed',
    description: 'Page scroll, click, tab switch, back/forward only.'
  }),
  Object.freeze({
    id: /** @type {const} */ ('basic-navigation-left'),
    label: 'Basic Navigation: left-handed',
    description: 'Page scroll, click, tab switch, back/forward only.'
  }),
  Object.freeze({
    id: /** @type {const} */ ('click-history-right'),
    label: 'Navigation: right-handed',
    description: 'Click element, go back, and go forward only.'
  }),
  Object.freeze({
    id: /** @type {const} */ ('click-history-left'),
    label: 'Navigation: left-handed',
    description: 'Click element, go back, and go forward only.'
  })
]);

/**
 * Built-in layout families shown to users (Keyboard Reference + Config pickers).
 * IMPORTANT: Alt+[ / Alt+] cycles through these family IDs (not through handedness variants).
 * Note: family id `browsing` is the stable storage id for the full layout (back-compat).
 * Family id `click-history` is labeled "Navigation" (Click Element / Back / Forward).
 */
export const BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META = Object.freeze([
  Object.freeze({
    id: /** @type {const} */ ('browsing'),
    label: 'Browsing',
    builtIn: true,
    description: 'Full browsing controls (scroll, tabs, click, history, tools).',
    variants: Object.freeze({
      right: /** @type {const} */ ('browsing-right'),
      left: /** @type {const} */ ('browsing-left')
    })
  }),
  Object.freeze({
    id: /** @type {const} */ ('click-history'),
    label: 'Navigation',
    builtIn: true,
    description: 'Click element, go back, and go forward.',
    variants: Object.freeze({
      right: /** @type {const} */ ('click-history-right'),
      left: /** @type {const} */ ('click-history-left')
    })
  })
]);

/**
 * Legacy families still resolvable from stored settings, but not listed in pickers / Alt cycle.
 * @type {Readonly<Record<string, { right: BuiltinKeyboardLayoutId, left: BuiltinKeyboardLayoutId }>>}
 */
const LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS = Object.freeze({
  'basic-navigation': Object.freeze({
    right: /** @type {const} */ ('basic-navigation-right'),
    left: /** @type {const} */ ('basic-navigation-left')
  })
});

/** @type {ReadonlySet<string>} */
const KNOWN_BUILTIN_LAYOUT_IDS = new Set(
  BUILTIN_KEYBOARD_LAYOUT_META.map((m) => m && m.id).filter(Boolean)
);

/**
 * @param {any} raw
 * @returns {BuiltinKeyboardLayoutId}
 */
export function normalizeKeyboardLayoutId(raw) {
  const v = String(raw || '').trim();
  if (KNOWN_BUILTIN_LAYOUT_IDS.has(v)) return /** @type {BuiltinKeyboardLayoutId} */ (v);
  return DEFAULT_KEYBOARD_LAYOUT_ID;
}

/**
 * @param {any} raw
 * @returns {KeyboardLayoutFamilyId}
 */
export function normalizeKeyboardLayoutFamilyId(raw) {
  const v = String(raw || '').trim();
  // Older alias: "navigation" meant the full layout (now labeled Browsing).
  if (v === 'navigation') return 'browsing';
  if (!v) return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
  const known = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.some((m) => m && m.id === v);
  if (known) return v;
  // Keep legacy reduced layouts working if still stored.
  if (Object.prototype.hasOwnProperty.call(LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS, v)) {
    return /** @type {KeyboardLayoutFamilyId} */ (v);
  }
  return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
}

/**
 * Select / combo value for a built-in family, e.g. `builtin:browsing`.
 * @param {any} familyId
 * @returns {string}
 */
export function builtinFamilySelectValue(familyId) {
  return `builtin:${normalizeKeyboardLayoutFamilyId(familyId)}`;
}

/**
 * @param {any} value Select value (`builtin`, `builtin:<familyId>`, or other)
 * @returns {KeyboardLayoutFamilyId|null} Family id when this is a built-in select value; else null
 */
export function parseBuiltinFamilySelectValue(value) {
  const v = String(value || '').trim();
  if (!v || v.startsWith('user:')) return null;
  if (v === 'builtin') return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
  if (v.startsWith('builtin:')) {
    return normalizeKeyboardLayoutFamilyId(v.slice('builtin:'.length));
  }
  return null;
}

/**
 * User-facing built-in label, e.g. "Built-in: Browsing".
 * @param {any} familyId
 * @returns {string}
 */
export function formatBuiltinFamilyLabel(familyId) {
  const id = normalizeKeyboardLayoutFamilyId(familyId);
  const meta = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.find((m) => m && m.id === id);
  if (meta?.label) return `Built-in: ${meta.label}`;
  if (id === 'basic-navigation') return 'Built-in: Basic Navigation';
  return 'Built-in: Browsing';
}

/**
 * @param {any} raw
 * @returns {KeyboardHandedness}
 */
export function normalizeKeyboardHandedness(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'left' || v === 'right') return /** @type {KeyboardHandedness} */ (v);
  return DEFAULT_KEYBOARD_HANDEDNESS;
}

/**
 * Resolve a user-facing layout family + handedness into a concrete layout ID.
 *
 * @param {{ familyId?: any, handedness?: any }} params
 * @returns {BuiltinKeyboardLayoutId}
 */
export function resolveKeyboardLayoutId({ familyId, handedness } = {}) {
  const fam = normalizeKeyboardLayoutFamilyId(familyId);
  const hand = normalizeKeyboardHandedness(handedness);
  const meta = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.find((m) => m && m.id === fam);
  const legacy = LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS[fam];
  const resolved = meta?.variants?.[hand] || legacy?.[hand];
  return normalizeKeyboardLayoutId(resolved);
}

/**
 * Back-compat helper: infer family/handedness for known built-in layout IDs.
 *
 * @param {any} rawLayoutId
 * @returns {{ familyId: KeyboardLayoutFamilyId, handedness: KeyboardHandedness }}
 */
export function inferFamilyAndHandednessFromLayoutId(rawLayoutId) {
  const id = normalizeKeyboardLayoutId(rawLayoutId);
  if (id.endsWith('-left')) {
    const familyId = id.slice(0, -'-left'.length);
    return {
      familyId: normalizeKeyboardLayoutFamilyId(familyId),
      handedness: 'left'
    };
  }
  if (id.endsWith('-right')) {
    const familyId = id.slice(0, -'-right'.length);
    return {
      familyId: normalizeKeyboardLayoutFamilyId(familyId),
      handedness: 'right'
    };
  }
  return { familyId: DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID, handedness: DEFAULT_KEYBOARD_HANDEDNESS };
}

/**
 * @returns {KeyboardLayoutFamilyId[]}
 */
export function getInstalledKeyboardLayoutFamilyIds() {
  return BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.map((m) => m && m.id).filter(Boolean);
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
    description: 'Jump to the top of the scroll target (Fade hides the jump; Scroll animates)',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  PAGE_BOTTOM: Object.freeze({
    handler: 'handlePageBottom',
    label: 'Scroll To Bottom',
    description: 'Jump to the bottom of the scroll target (Fade hides the jump; Scroll animates)',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  SCROLL_LINE: Object.freeze({
    handler: 'handleScrollLineKey',
    label: 'Scroll Line',
    description: 'Scroll from a fixed origin: move the mouse away from the dot to scroll faster. Optional middle-click on empty page area (Settings → Scrolling).',
    keyboardClass: 'key-scroll',
    row: 3,
    mode: 'scroll_line',
    cancelOnPointerDown: true,
    pointerBinding: Object.freeze({
      button: 'middle',
      yieldToClickables: true,
      yieldToTextEntry: true,
      yieldToModes: Object.freeze(['text_focus', 'popover', 'omnibox']),
      enabledSetting: 'scroll.middleClickScrollLine'
    })
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
    description: 'Select text (character level) and copy as rich text by default',
    keyboardClass: 'key-highlight',
    row: 2
  }),
  // Rectangle region select (Y on right-handed; R free on left-handed).
  RECTANGLE_HIGHLIGHT: Object.freeze({
    handler: 'handleRectangleHighlightKey',
    label: 'Element Select',
    description: 'Select intersecting HTML elements in a rectangle (or pick cumulative)',
    keyboardClass: 'key-rect-highlight',
    row: 1
  }),
  // Copy image under cursor (I on right-handed; E on left-handed — I is OPEN_POPOVER there).
  COPY_HOVERED_IMAGE: Object.freeze({
    handler: 'handleCopyHoveredImageKey',
    label: 'Copy Image',
    description: 'Copy image under cursor (clipboard, Media Library, or both)',
    // Default key face (no tinted key-gray / family fill).
    keyboardClass: null,
    row: 1
  }),
  // Copy hyperlink under cursor (U on right-handed; no default on left — U is FORWARD there).
  COPY_HOVERED_URL: Object.freeze({
    handler: 'handleCopyHoveredUrlKey',
    label: 'Copy URL',
    description: 'Copy URL under cursor (clipboard, Media Library, or both)',
    keyboardClass: null,
    row: 1
  }),
  // Copy video under cursor — Actions Library only (no built-in layout key).
  COPY_HOVERED_VIDEO: Object.freeze({
    handler: 'handleCopyHoveredVideoKey',
    label: 'Copy Video',
    description: 'Copy video under cursor (clipboard, Media Library, or both)',
    keyboardClass: null,
    row: null
  }),
  // Page-wide Image / Video / Text gallery (O on right-handed; O is TAB_RIGHT on left-handed).
  PAGE_MEDIA: Object.freeze({
    handler: 'handlePageMediaKey',
    label: 'Page Media',
    description: 'Browse images, videos, and documents found on this page',
    keyboardClass: null,
    row: 1
  }),
  // Media Library entry point (M on right-handed only — M is PAGE_DOWN_INSTANT on left-handed,
  // so this doesn't get a default binding there yet).
  OPEN_MEDIA_LIBRARY: Object.freeze({
    handler: 'handleOpenMediaLibraryKey',
    label: 'Media Library',
    description: 'Open the Media Library.',
    keyboardClass: null,
    row: 1
  }),
  // Clipboard commands (Functions palette — Clipboard category).
  CLIPBOARD_COPY: Object.freeze({
    handler: 'handleClipboardCopyKey',
    label: 'Copy',
    description: 'Copy selected text to the clipboard',
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_CUT: Object.freeze({
    handler: 'handleClipboardCutKey',
    label: 'Cut',
    description: 'Cut selected text to the clipboard',
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_PASTE: Object.freeze({
    handler: 'handleClipboardPasteKey',
    label: 'Paste',
    description: 'Paste clipboard text into the focused field',
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_SELECT_ALL: Object.freeze({
    handler: 'handleClipboardSelectAllKey',
    label: 'Select All',
    description: 'Select all text in the focused field or page',
    keyboardClass: null,
    row: null
  }),
  // AI (Functions palette — AI category).
  SEND_TEXT_TO_AI: Object.freeze({
    handler: 'handleSendTextToAiKey',
    label: 'Send Text To AI',
    description: 'Send selected text to AI with a configurable instruction; route the result to clipboard and/or popover',
    keyboardClass: 'key-purple',
    row: null
  })
});

/**
 * Display category for each action (Keyboard Layout Config grouping).
 * Unknown ids fall back to "Other".
 * @type {Readonly<Record<string, string>>}
 */
export const KEYBINDING_ACTION_CATEGORY_BY_ID = Object.freeze({
  // Navigation — click / link preview / history
  ACTIVATE: 'Navigation',
  ACTIVATE_NEW_TAB: 'Navigation',
  ACTIVATE_NEW_TAB_BACKGROUND: 'Navigation',
  PREVIEW_LINK_POPOVER: 'Navigation',
  OPEN_POPOVER: 'Navigation',
  FORWARD: 'Navigation',
  BACK: 'Navigation',
  BACK2: 'Navigation',
  ROOT: 'Navigation',
  // Tab Control
  CLOSE_TAB: 'Tab Control',
  TAB_LEFT: 'Tab Control',
  TAB_RIGHT: 'Tab Control',
  NEW_TAB: 'Tab Control',
  TAB_HISTORY: 'Tab Control',
  PAGE_UP_INSTANT: 'Scroll',
  PAGE_DOWN_INSTANT: 'Scroll',
  PAGE_TOP: 'Scroll',
  PAGE_BOTTOM: 'Scroll',
  SCROLL_LINE: 'Scroll',
  HIGHLIGHT: 'Get Page Data',
  RECTANGLE_HIGHLIGHT: 'Get Page Data',
  COPY_HOVERED_IMAGE: 'Get Page Data',
  COPY_HOVERED_URL: 'Get Page Data',
  COPY_HOVERED_VIDEO: 'Get Page Data',
  PAGE_MEDIA: 'Get Page Data',
  DELETE: 'Select',
  COLS_TOGGLE: 'Select',
  OPEN_MEDIA_LIBRARY: 'Media Library',
  CLIPBOARD_COPY: 'Clipboard',
  CLIPBOARD_CUT: 'Clipboard',
  CLIPBOARD_PASTE: 'Clipboard',
  CLIPBOARD_SELECT_ALL: 'Clipboard',
  SEND_TEXT_TO_AI: 'AI',
  LAUNCHER: 'Begin URL',
  OMNIBOX: 'Begin URL',
  TOGGLE_KEYBOARD_HELP: 'KeyPilot',
  OPEN_SETTINGS_POPOVER: 'KeyPilot',
  CANCEL: 'System'
});

/** Stable category order for the Config palette. */
export const KEYBINDING_ACTION_CATEGORY_ORDER = Object.freeze([
  'Navigation',
  'Tab Control',
  'Begin URL',
  'Get Page Data',
  'Scroll',
  'Select',
  'Media Library',
  'Clipboard',
  'AI',
  'KeyPilot',
  'Tools',
  'System',
  'Other'
]);

/**
 * @param {string} actionId
 * @returns {string}
 */
export function getKeybindingActionCategory(actionId) {
  const id = String(actionId || '');
  return KEYBINDING_ACTION_CATEGORY_BY_ID[id] || 'Other';
}

/**
 * Next auto-copy label for a built-in family, e.g. "Browsing Copy 1".
 * @param {string} baseLabel Family or layout base name
 * @param {{ label?: string }[]} existingLayouts
 * @returns {string}
 */
export function nextUserCopyLayoutLabel(baseLabel, existingLayouts = []) {
  const base = String(baseLabel || 'Layout').trim() || 'Layout';
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped} Copy (\\d+)$`, 'i');
  let maxN = 0;
  for (const l of existingLayouts || []) {
    const m = String(l?.label || '').trim().match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxN) maxN = n;
  }
  return `${base} Copy ${maxN + 1}`;
}

/**
 * Grouped options for Keyboard Reference + Config layout pickers.
 * Built-in families are marked `builtIn: true`; user layouts are `builtIn: false`.
 *
 * @param {{ id?: string, label?: string }[]} [userLayouts]
 * @returns {{
 *   builtin: { value: string, label: string, builtIn: true }[],
 *   custom: { value: string, label: string, builtIn: false }[]
 * }}
 */
export function listLayoutPickerGroups(userLayouts = []) {
  /** @type {{ value: string, label: string, builtIn: true }[]} */
  const builtin = [];
  for (const fam of BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META || []) {
    if (!fam?.id) continue;
    builtin.push({
      value: builtinFamilySelectValue(fam.id),
      label: String(fam.label || fam.id),
      builtIn: true
    });
  }
  /** @type {{ value: string, label: string, builtIn: false }[]} */
  const custom = [];
  for (const l of userLayouts || []) {
    if (!l?.id) continue;
    custom.push({
      value: `user:${l.id}`,
      label: String(l.label || l.id),
      builtIn: false
    });
  }
  custom.sort((a, b) => a.label.localeCompare(b.label));
  return { builtin, custom };
}

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
 * Right-handed Navigation (full layout; storage id remains browsing-right).
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
  OMNIBOX: Object.freeze({ keys: ['l', 'L'] }),
  LAUNCHER: Object.freeze({ keys: [';', ':', 'Semicolon', '`', '~', 'Backquote'], matchOn: ['key', 'code'], displayKey: ';', keyLabel: ';' }),

  PAGE_TOP: Object.freeze({ keys: ['z', 'Z'] }),
  PAGE_BOTTOM: Object.freeze({ keys: ['x', 'X'] }),
  PAGE_UP_INSTANT: Object.freeze({ keys: ['c', 'C'] }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ['v', 'V'] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ['b', 'B'] }),
  SCROLL_LINE: Object.freeze({ keys: ['n', 'N'] }),
  RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ['y', 'Y'] }),
  COPY_HOVERED_IMAGE: Object.freeze({ keys: ['i', 'I'] }),
  COPY_HOVERED_URL: Object.freeze({ keys: ['u', 'U'] }),
  PAGE_MEDIA: Object.freeze({ keys: ['o', 'O'] }),
  // M is otherwise unused on the right-handed layout (it's PAGE_DOWN_INSTANT on left-handed).
  OPEN_MEDIA_LIBRARY: Object.freeze({ keys: ['m', 'M'] }),

  ROOT: Object.freeze({ keys: ['1', '!'], displayKey: '1', keyLabel: '1' }),
  DELETE: Object.freeze({ keys: ['Backspace'], displayKey: 'Backspace', keyLabel: 'Backspace' }),
  COLS_TOGGLE: Object.freeze({ keys: ['.', '>'], displayKey: '.', keyLabel: '.' })
});

/**
 * Left-handed Navigation (full layout; storage id remains browsing-left).
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
  SCROLL_LINE: Object.freeze({ keys: ['t', 'T'] }),

  // Home row cluster: A S D F G  ->  ; L K J H (mirrored-ish around center)
  CLOSE_TAB: Object.freeze({ keys: [';', ':'], displayKey: ';', keyLabel: ';' }),
  BACK2: Object.freeze({ keys: ['l', 'L'] }),
  BACK: Object.freeze({ keys: ['k', 'K'] }),
  ACTIVATE: Object.freeze({ keys: ['j', 'J'] }),
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({ keys: ['h', 'H'] }),
  // H is background-tab open on left; G/R free for selection.
  HIGHLIGHT: Object.freeze({ keys: ['g', 'G'] }),
  RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ['r', 'R'] }),

  // Utility actions on the left avoid colliding with J/K/L cluster.
  // (KB Reference / Settings / Esc live in the system layer, not layout assignments.)
  TAB_HISTORY: Object.freeze({ keys: ['f', 'F'] }),
  OMNIBOX: Object.freeze({ keys: ['s', 'S'] }),
  LAUNCHER: Object.freeze({ keys: ['a', 'A', '`', '~', 'Backquote'], matchOn: ['key', 'code'], displayKey: 'a/`', keyLabel: 'a/`' }),

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
  DELETE: Object.freeze({ keys: ['Backspace'], displayKey: 'Backspace', keyLabel: 'Backspace' })
});

/**
 * System keybinding layer — separate from layout families.
 *
 * Always active on top of whatever layout (built-in or user) is selected.
 * Alt+ chrome hotkeys (Alt+K toggle KeyPilot, Alt+C layout edit, Alt+[ / ], …)
 * are handled in KeyPilot itself and are also part of this always-on chrome layer.
 *
 * Layout-character system actions live here so families like Basic Navigation
 * do not need to re-declare them.
 */
export const SYSTEM_LAYER_ACTION_IDS = Object.freeze([
  'CANCEL',
  'TOGGLE_KEYBOARD_HELP',
  'OPEN_SETTINGS_POPOVER'
]);

/** @deprecated Use SYSTEM_LAYER_ACTION_IDS */
export const SYSTEM_LAYOUT_ACTION_IDS = SYSTEM_LAYER_ACTION_IDS;

/** Right-handed system-layer physical keys. */
const SYSTEM_LAYER_ASSIGNMENTS_RIGHT = Object.freeze({
  CANCEL: Object.freeze({ keys: ['Escape'], displayKey: 'Esc', keyLabel: 'Esc' }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ['k', 'K'] }),
  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", 'Quote'], matchOn: ['key', 'code'], displayKey: "'" })
});

/** Left-handed system-layer physical keys (KB Reference mirrored off the home cluster). */
const SYSTEM_LAYER_ASSIGNMENTS_LEFT = Object.freeze({
  CANCEL: Object.freeze({ keys: ['Escape'], displayKey: 'Esc', keyLabel: 'Esc' }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ['d', 'D'] }),
  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", 'Quote'], matchOn: ['key', 'code'], displayKey: "'" })
});

/**
 * @param {any} handedness
 * @returns {Record<string, any>}
 */
export function buildSystemKeybindings(handedness = DEFAULT_KEYBOARD_HANDEDNESS) {
  const hand = normalizeKeyboardHandedness(handedness);
  const assignments = hand === 'left' ? SYSTEM_LAYER_ASSIGNMENTS_LEFT : SYSTEM_LAYER_ASSIGNMENTS_RIGHT;
  /** @type {Record<string, any>} */
  const out = {};
  for (const actionId of SYSTEM_LAYER_ACTION_IDS) {
    const def = KEYBINDING_ACTION_DEFS[actionId];
    const assign = assignments[actionId];
    if (!def || !assign || !Array.isArray(assign.keys)) continue;
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
      displayKey: labels.displayKey,
      systemLayer: true
    };
  }
  return out;
}

/**
 * Layout keybindings + system layer (system wins on id collision).
 * @param {any} layoutId
 * @param {any} [handedness]
 * @returns {Record<string, any>}
 */
export function buildEffectiveKeybindings(layoutId, handedness = DEFAULT_KEYBOARD_HANDEDNESS) {
  return {
    ...buildKeybindingsForLayout(layoutId),
    ...buildSystemKeybindings(handedness)
  };
}

/** Actions kept in Basic Navigation (system keys are NOT included — they are a separate layer). */
const BASIC_NAVIGATION_ACTION_IDS = Object.freeze([
  'ACTIVATE',
  'TAB_LEFT',
  'TAB_RIGHT',
  'FORWARD',
  'BACK',
  'BACK2',
  'PAGE_TOP',
  'PAGE_BOTTOM',
  'PAGE_UP_INSTANT',
  'PAGE_DOWN_INSTANT'
]);

/** Actions kept in Click + History (system keys are NOT included — they are a separate layer). */
const CLICK_HISTORY_ACTION_IDS = Object.freeze([
  'ACTIVATE',
  'BACK',
  'BACK2',
  'FORWARD'
]);

/** UI still paints system-layer keys on every family keyboard chrome. */
const BASIC_NAVIGATION_UI_ACTION_IDS = Object.freeze([
  ...BASIC_NAVIGATION_ACTION_IDS,
  ...SYSTEM_LAYER_ACTION_IDS
]);
const CLICK_HISTORY_UI_ACTION_IDS = Object.freeze([
  ...CLICK_HISTORY_ACTION_IDS,
  ...SYSTEM_LAYER_ACTION_IDS
]);

/**
 * @param {Record<string, KeyAssignment>} source
 * @param {readonly string[]} allowedIds
 * @returns {Record<string, KeyAssignment>}
 */
function pickAssignments(source, allowedIds) {
  const allowed = new Set(allowedIds);
  /** @type {Record<string, KeyAssignment>} */
  const out = {};
  for (const id of allowedIds) {
    if (source[id]) out[id] = source[id];
  }
  // Also keep any accidental extras that are in allowed set from source iteration order
  for (const [id, assignment] of Object.entries(source || {})) {
    if (allowed.has(id) && !out[id]) out[id] = assignment;
  }
  return Object.freeze(out);
}

/**
 * @param {KeyAssignment|null|undefined} assignment
 * @returns {string}
 */
function letterFromAssignment(assignment) {
  if (!assignment) return '';
  if (typeof assignment.displayKey === 'string' && assignment.displayKey) return assignment.displayKey;
  if (typeof assignment.keyLabel === 'string' && assignment.keyLabel) return assignment.keyLabel;
  const keys = Array.isArray(assignment.keys) ? assignment.keys : [];
  for (const k of keys) {
    const s = String(k || '');
    if (!s || s === 'Semicolon' || s === 'Quote' || s === 'Backquote') continue;
    if (s.length === 1) return s.toUpperCase();
    if (s === 'Backspace' || s === 'Escape') return s;
  }
  return '';
}

/**
 * Keep Navigation key positions, but blank out actions not in the subset.
 * @param {any[]} baseLayout
 * @param {Record<string, KeyAssignment>} fullAssignments
 * @param {readonly string[]} allowedIds
 * @returns {any[]}
 */
function projectKeyboardUiLayout(baseLayout, fullAssignments, allowedIds) {
  const allowed = new Set(allowedIds);
  return Object.freeze(
    (Array.isArray(baseLayout) ? baseLayout : []).map((row) =>
      Object.freeze(
        (Array.isArray(row) ? row : []).map((cell) => {
          if (!cell || cell.type !== 'action' || !cell.id) return cell;
          if (allowed.has(cell.id)) return cell;
          if (cell.id === 'DELETE' || (cell.className && String(cell.className).includes('key-backspace'))) {
            return Object.freeze({ type: 'special', text: 'Backspace', className: 'key key-backspace' });
          }
          const text = letterFromAssignment(fullAssignments[cell.id]);
          if (!text) return Object.freeze({ type: 'key', text: '' });
          if (text === 'Backspace') {
            return Object.freeze({ type: 'special', text: 'Backspace', className: 'key key-backspace' });
          }
          // Prefer a short keycap glyph (letter or punctuation).
          const glyph = text.length <= 3 ? text : text.slice(0, 1).toUpperCase();
          return Object.freeze({ type: 'key', text: glyph.length === 1 ? glyph.toUpperCase() : glyph });
        })
      )
    )
  );
}

const ASSIGNMENTS_BASIC_NAVIGATION_RIGHT = pickAssignments(ASSIGNMENTS_BROWSING_RIGHT, BASIC_NAVIGATION_ACTION_IDS);
const ASSIGNMENTS_BASIC_NAVIGATION_LEFT = pickAssignments(ASSIGNMENTS_BROWSING_LEFT, BASIC_NAVIGATION_ACTION_IDS);
const ASSIGNMENTS_CLICK_HISTORY_RIGHT = pickAssignments(ASSIGNMENTS_BROWSING_RIGHT, CLICK_HISTORY_ACTION_IDS);
const ASSIGNMENTS_CLICK_HISTORY_LEFT = pickAssignments(ASSIGNMENTS_BROWSING_LEFT, CLICK_HISTORY_ACTION_IDS);

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
    { type: 'action', id: 'COPY_HOVERED_URL', fallbackText: 'Copy URL' },
    { type: 'action', id: 'COPY_HOVERED_IMAGE', fallbackText: 'Copy Image' },
    { type: 'action', id: 'PAGE_MEDIA', fallbackText: 'Page Media' },
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
    { type: 'action', id: 'SCROLL_LINE', fallbackText: 'Scroll Line' },
    { type: 'action', id: 'OPEN_MEDIA_LIBRARY', fallbackText: 'Media Library' },
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
    { type: 'action', id: 'SCROLL_LINE', fallbackText: 'Scroll Line' }, // T
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
export const BUILTIN_KEYBOARD_LAYOUTS = Object.freeze({
  'browsing-right': Object.freeze({
    id: 'browsing-right',
    label: 'Browsing: right-handed',
    description: 'Full browsing layout. Mouse: right hand. Shortcuts primarily on the left.',
    assignments: ASSIGNMENTS_BROWSING_RIGHT,
    keyboardLayout: KEYBOARD_UI_LAYOUT_RIGHT
  }),
  'browsing-left': Object.freeze({
    id: 'browsing-left',
    label: 'Browsing: left-handed',
    description: 'Full browsing layout. Mouse: left hand. Shortcuts primarily on the right.',
    assignments: ASSIGNMENTS_BROWSING_LEFT,
    keyboardLayout: KEYBOARD_UI_LAYOUT_LEFT
  }),
  'basic-navigation-right': Object.freeze({
    id: 'basic-navigation-right',
    label: 'Basic Navigation: right-handed',
    description: 'Page scroll, click, tab switch, back/forward only.',
    assignments: ASSIGNMENTS_BASIC_NAVIGATION_RIGHT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_RIGHT,
      { ...ASSIGNMENTS_BROWSING_RIGHT, ...SYSTEM_LAYER_ASSIGNMENTS_RIGHT },
      BASIC_NAVIGATION_UI_ACTION_IDS
    )
  }),
  'basic-navigation-left': Object.freeze({
    id: 'basic-navigation-left',
    label: 'Basic Navigation: left-handed',
    description: 'Page scroll, click, tab switch, back/forward only.',
    assignments: ASSIGNMENTS_BASIC_NAVIGATION_LEFT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_LEFT,
      { ...ASSIGNMENTS_BROWSING_LEFT, ...SYSTEM_LAYER_ASSIGNMENTS_LEFT },
      BASIC_NAVIGATION_UI_ACTION_IDS
    )
  }),
  'click-history-right': Object.freeze({
    id: 'click-history-right',
    label: 'Navigation: right-handed',
    description: 'Click element, go back, and go forward only.',
    assignments: ASSIGNMENTS_CLICK_HISTORY_RIGHT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_RIGHT,
      { ...ASSIGNMENTS_BROWSING_RIGHT, ...SYSTEM_LAYER_ASSIGNMENTS_RIGHT },
      CLICK_HISTORY_UI_ACTION_IDS
    )
  }),
  'click-history-left': Object.freeze({
    id: 'click-history-left',
    label: 'Navigation: left-handed',
    description: 'Click element, go back, and go forward only.',
    assignments: ASSIGNMENTS_CLICK_HISTORY_LEFT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_LEFT,
      { ...ASSIGNMENTS_BROWSING_LEFT, ...SYSTEM_LAYER_ASSIGNMENTS_LEFT },
      CLICK_HISTORY_UI_ACTION_IDS
    )
  })
});

/**
 * @param {BuiltinKeyboardLayoutId} layoutId
 * @param {{ includeNumberRow?: boolean }} [opts]
 * @returns {any[]}
 */
export function getKeyboardUiLayoutForLayout(layoutId, opts = {}) {
  const id = normalizeKeyboardLayoutId(layoutId);
  const base = BUILTIN_KEYBOARD_LAYOUTS[id]?.keyboardLayout || BUILTIN_KEYBOARD_LAYOUTS[DEFAULT_KEYBOARD_LAYOUT_ID].keyboardLayout;
  const include = !!(opts && opts.includeNumberRow);
  return include ? addNumberRowToKeyboardUiLayout(base) : base;
}

/**
 * @param {any[]} layout
 * @returns {any[]}
 */
export function addNumberRowToKeyboardUiLayout(layout) {
  const base = Array.isArray(layout) ? layout : [];
  // Avoid double-prepending if caller already did.
  try {
    const first = base[0];
    if (Array.isArray(first) && first.some((i) => i && i.type === 'key' && String(i.text || '').trim() === '1')) {
      return base;
    }
  } catch { /* ignore */ }
  const numberRow = Object.freeze([
    { type: 'key', text: '1' },
    { type: 'key', text: '2' },
    { type: 'key', text: '3' },
    { type: 'key', text: '4' },
    { type: 'key', text: '5' },
    { type: 'key', text: '6' },
    { type: 'key', text: '7' },
    { type: 'key', text: '8' },
    { type: 'key', text: '9' },
    { type: 'key', text: '0' }
  ]);
  return [numberRow, ...base];
}













