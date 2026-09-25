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

import { getMessage } from '../utils/i18n.js';
import { buildKeyboardReferenceUiLayout } from './keyboard-hardware-layouts.js';
import {
  getStockActionById,
  STOCK_ACTIONS,
  STOCK_RANDOM_BOOKMARK_ACTION_ID,
  STOCK_SOCIAL_MEDIA_ACTION_ID
} from './stock-actions.js';

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
 *   bindingType?: 'physical'|'character',
 *   matchOn?: Array<'key'|'code'>,
 *   displayKey?: string,
 *   keyLabel?: string
 * }} KeyAssignment
 */

/**
 * @typedef {{
 *   handler: string,
 *   label: string,
 *   // Short "About" blurb for Actions Library key-action cards (keep concise).
 *   description: string,
 *   // Longer inspector Description; shown in the Actions Library dock, not on cards.
 *   details?: string,
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

/**
 * User Macros / Macro Builder UI (Keyboard Layout Config).
 *
 * Off in v1 — composition is Execute JS on a key. Runtime still runs any Macro already
 * bound to a slot (stock or leftover user macros). Flip `SOURCE_BUILD_ENABLE_MACRO_BUILDER`
 * to `true` for a v1.2 / local-dev build (same idea as removing an id from
 * {@link BUILD_EXCLUDED_KEY_ACTIONS}), or pass `--macro-builder` to `node build.js`.
 * @type {boolean}
 */
const SOURCE_BUILD_ENABLE_MACRO_BUILDER = false;

export const BUILD_ENABLE_MACRO_BUILDER = typeof __KP_BUILD_ENABLE_MACRO_BUILDER__ !== 'undefined'
  ? !!__KP_BUILD_ENABLE_MACRO_BUILDER__
  : SOURCE_BUILD_ENABLE_MACRO_BUILDER;

/**
 * Key action IDs omitted from shipped builds (builtin layouts, catalogs, Function Library).
 * Keep defs/handlers and Function categories in source; remove an id here to re-enable
 * it in the next build (its category assignment is unchanged).
 * @type {readonly string[]}
 */
export const BUILD_EXCLUDED_KEY_ACTIONS = Object.freeze([
  'COLS_TOGGLE',
  // Type — "Type saved text into the focused field."
  'TYPE_CHARACTERS',
  // Data — "Read text or media under the cursor, or from a highlight."
  'GET_TEXT_AT_CURSOR',
  'GET_TEXT_RANGE',
  'GET_MEDIA_AT_CURSOR',
  // Script — "Run a user-authored JavaScript snippet against page state."
  'EXECUTE_JS',
  // Create built-in Macro Key — "Saved Macro Key instances (hotkey, burst, round-robin, and related kinds) ready to place."
  'SEND_HOTKEY',
  'SEND_BURST',
  'CYCLE_ROUND_ROBIN',
  'HOLD_CONTINUOUS',
  'CLICK_MOUSE_BUTTON',
  'REMAP_KEY',
  // Translate — "Translate highlighted or under-cursor text."
  'TRANSLATE',
  // AI — "Send selected text to AI with a prompt and result destination."
  'SEND_TEXT_TO_AI'
]);

/** @type {ReadonlySet<string>} */
const BUILD_EXCLUDED_KEY_ACTION_SET = new Set(BUILD_EXCLUDED_KEY_ACTIONS);

/**
 * @param {string|null|undefined} actionId
 * @returns {boolean}
 */
export function isBuildExcludedKeyAction(actionId) {
  const id = String(actionId || '');
  return !!id && BUILD_EXCLUDED_KEY_ACTION_SET.has(id);
}

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
    labelKey: 'layout_family_browsing_label',
    builtIn: true,
    descriptionKey: 'layout_family_browsing_description',
    variants: Object.freeze({
      right: /** @type {const} */ ('browsing-right'),
      left: /** @type {const} */ ('browsing-left')
    })
  }),
  Object.freeze({
    id: /** @type {const} */ ('click-history'),
    labelKey: 'layout_family_navigation_label',
    builtIn: true,
    descriptionKey: 'layout_family_navigation_description',
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
    description: 'Click the hovered element',
    details: 'Activates the clickable under the cursor — the same as a left mouse click on that element. Works with links, buttons, and other interactive targets KeyPilot highlights.',
    keyboardClass: 'key-activate',
    row: 2
  }),
  // Foreground new tab (switch to the new tab).
  ACTIVATE_NEW_TAB: Object.freeze({
    handler: 'handleActivateNewTabKey',
    label: 'Click New Tab',
    description: 'Open link in a new foreground tab',
    details: 'Opens the hovered link in a new tab and switches to it immediately. Use when you want to follow a link without leaving your place permanently, but still jump to the new page right away.',
    keyboardClass: 'key-activate-new',
    row: 2
  }),
  // Background new tab (middle-click style; do not switch focus).
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({
    handler: 'handleActivateNewTabBackgroundKey',
    label: 'Click New Tab Background',
    description: 'Open link in a new background tab',
    details: 'Opens the hovered link in a new tab without switching focus — like a middle-click. Useful for queueing several links while you keep reading the current page.',
    keyboardClass: 'key-activate-new-over',
    row: 2
  }),
  BACK: Object.freeze({
    handler: 'handleBackKey',
    label: 'Go Back',
    description: 'Browser history back',
    details: 'Navigates one step back in the current tab’s history, equivalent to the browser Back button.',
    keyboardClass: 'key-back',
    row: 2
  }),
  BACK2: Object.freeze({
    handler: 'handleBackKey',
    label: 'Go Back',
    description: 'Browser history back',
    details: 'Navigates one step back in the current tab’s history, equivalent to the browser Back button. Duplicate id for layouts that expose a second Back binding.',
    keyboardClass: 'key-back',
    row: 2
  }),
  FORWARD: Object.freeze({
    handler: 'handleForwardKey',
    label: 'Go Forward',
    description: 'Browser history forward',
    details: 'Navigates one step forward in the current tab’s history, equivalent to the browser Forward button.',
    keyboardClass: 'key-forward',
    row: 1
  }),
  DELETE: Object.freeze({
    handler: 'handleDeleteKey',
    label: 'Delete Mode',
    description: 'Hide elements under the cursor',
    details: 'Toggles Delete Mode: hover elements and remove (hide) them from the page so you can declutter layouts. Exit with Exit Focus or by toggling again.',
    keyboardClass: 'key-delete',
    row: 2
  }),
  COLS_TOGGLE: Object.freeze({
    handler: 'handleColsToggleKey',
    label: 'Cols Toggle',
    description: 'Multi-column layout under cursor',
    details: 'Columnizes the element under the cursor into a multi-column layout so dense text or lists are easier to scan. Toggle again to restore the original layout.',
    keyboardClass: 'key-cols',
    row: 3
  }),
  TAB_LEFT: Object.freeze({
    handler: 'handleTabLeftKey',
    label: 'Tab Left',
    description: 'Switch to the previous tab',
    details: 'Activates the tab to the left of the current one in the window’s tab strip.',
    keyboardClass: 'key-gray',
    row: 1
  }),
  TAB_RIGHT: Object.freeze({
    handler: 'handleTabRightKey',
    label: 'Tab Right',
    description: 'Switch to the next tab',
    details: 'Activates the tab to the right of the current one in the window’s tab strip.',
    keyboardClass: 'key-gray',
    row: 1
  }),
  ROOT: Object.freeze({
    handler: 'handleRootKey',
    label: 'Go to Site Root',
    description: 'Navigate to the site origin',
    details: 'Jumps to the site root (scheme + host) of the current page — useful for escaping deep paths without typing a URL.',
    keyboardClass: null,
    row: 2
  }),
  LAUNCHER: Object.freeze({
    handler: 'handleLauncherKey',
    label: 'Launcher',
    description: 'Quick-access site launcher',
    details: 'Opens the Launcher popover for jumping to favorite or configured sites without using the omnibox.',
    keyboardClass: 'key-launcher-orange',
    row: 2
  }),
  TOP_SITES: Object.freeze({
    handler: 'handleTopSitesKey',
    label: 'Top Sites',
    description: 'Toolbar, visits, and bookmarks',
    details: 'Opens Top Sites: a quick list drawn from the toolbar, most-visited pages, and recent bookmarks so you can open a frequent destination in one step.',
    keyboardClass: 'key-launcher-orange',
    row: 2
  }),
  CLOSE_TAB: Object.freeze({
    handler: 'handleCloseTabKey',
    label: 'Close Tab',
    description: 'Close the current tab',
    details: 'Closes the active tab. Behavior matches the browser’s close-tab action for the current window.',
    keyboardClass: 'key-close-tab',
    row: 3
  }),
  CANCEL: Object.freeze({
    handler: 'cancelModes',
    label: 'Exit Focus',
    description: 'Leave modes and overlays',
    details: 'Cancels the current KeyPilot mode or overlay (Delete Mode, Scroll Line, text focus helpers, and similar) and returns to normal browsing.',
    keyboardClass: null,
    row: null
  }),
  PAGE_UP_INSTANT: Object.freeze({
    handler: 'handleInstantPageUp',
    label: 'Page Up',
    description: 'Jump one page up instantly',
    details: 'Scrolls the current scroll target up by roughly one viewport without animation — faster than a smooth page-up when you need to move quickly.',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  PAGE_DOWN_INSTANT: Object.freeze({
    handler: 'handleInstantPageDown',
    label: 'Page Down',
    description: 'Jump one page down instantly',
    details: 'Scrolls the current scroll target down by roughly one viewport without animation — faster than a smooth page-down when you need to move quickly.',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  PAGE_TOP: Object.freeze({
    handler: 'handlePageTop',
    label: 'Scroll To Top',
    description: 'Jump to top of scroll target',
    details: 'Moves to the top of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings → Scrolling.',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  PAGE_BOTTOM: Object.freeze({
    handler: 'handlePageBottom',
    label: 'Scroll To Bottom',
    description: 'Jump to bottom of scroll target',
    details: 'Moves to the bottom of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings → Scrolling.',
    keyboardClass: 'key-scroll',
    row: 3
  }),
  SCROLL_LINE: Object.freeze({
    handler: 'handleScrollLineKey',
    label: 'Scroll Line',
    description: 'Origin-based continuous scroll',
    details: 'Scrolls from a fixed origin: move the mouse away from the on-screen dot to scroll faster in that direction. Optionally enable middle-click on empty page area under Settings → Scrolling.',
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
  ZOOM_OUT: Object.freeze({
    handler: 'handleZoomOutKey',
    label: 'Zoom Out',
    description: 'Zoom the page out at the cursor',
    details: 'Zooms the tab out one browser zoom step and keeps the point under the cursor fixed, the same as a pinch-out gesture.',
    keyboardClass: 'key-scroll',
    row: 1
  }),
  ZOOM_IN: Object.freeze({
    handler: 'handleZoomInKey',
    label: 'Zoom In',
    description: 'Zoom the page in at the cursor',
    details: 'Zooms the tab in one browser zoom step and keeps the point under the cursor fixed, the same as a pinch-in gesture.',
    keyboardClass: 'key-scroll',
    row: 1
  }),
  NEW_TAB: Object.freeze({
    handler: 'handleNewTabKey',
    label: 'New Tab',
    description: 'Open the KeyPilot new tab',
    details: 'Opens a KeyPilot new tab with your bookmarks bar, top sites, and search. The browser’s own new tab stays unchanged.',
    keyboardClass: 'key-gray',
    row: 1
  }),
  OPEN_POPOVER: Object.freeze({
    handler: 'handleOpenPopover',
    label: 'Open Popover',
    description: 'Open link in a popup window',
    details: 'Opens the hovered link in a KeyPilot popup window so you can peek or work in a separate chrome without a full new tab.',
    keyboardClass: 'key-open-popover',
    row: 2
  }),
  PREVIEW_LINK_POPOVER: Object.freeze({
    handler: 'handlePreviewLinkPopover',
    label: 'Preview Link',
    description: 'Preview link in a popup',
    details: 'Opens Link Preview for the hovered URL in a popup window — skim the destination without committing a full navigation in the main tab.',
    keyboardClass: 'key-preview-popover',
    row: 2
  }),
  POI_WEBSITE: Object.freeze({
    handler: 'handlePoiWebsiteKey',
    label: 'POI Website',
    description: 'Open map place website',
    details: 'When a map place (POI) is under the cursor, opens that place’s website in Link Preview so you can visit the business or location page without leaving the map.',
    keyboardClass: 'key-preview-popover',
    row: null
  }),
  POI_ADDRESS: Object.freeze({
    handler: 'handlePoiAddressKey',
    label: 'POI Address',
    description: 'Copy map place address',
    details: 'When a map place (POI) is under the cursor, copies its street address to the clipboard for pasting into directions, notes, or forms.',
    keyboardClass: null,
    row: null
  }),
  OPEN_SETTINGS_POPOVER: Object.freeze({
    handler: 'handleToggleSettingsPopover',
    label: 'Settings',
    description: 'Open KeyPilot Settings',
    details: 'Opens or closes the KeyPilot Settings popover for themes, scrolling, click mode, layouts, and other preferences.',
    keyboardClass: 'key-settings-dark',
    row: null
  }),
  OMNIBOX: Object.freeze({
    handler: 'handleOpenOmnibox',
    label: 'Omnibox',
    description: 'Address bar overlay',
    details: 'Opens KeyPilot’s omnibox overlay so you can type a URL or search without clicking the browser address bar.',
    keyboardClass: 'key-orange',
    row: 2
  }),
  TAB_HISTORY: Object.freeze({
    handler: 'handleToggleTabHistoryPopover',
    label: 'Tab History',
    description: 'Browse this tab’s history',
    details: 'Opens Tab History for the current tab so you can jump to a previously visited page in this tab’s session without using the browser’s native history UI.',
    keyboardClass: 'key-gray',
    row: 2
  }),
  TABS_OVERVIEW: Object.freeze({
    handler: 'handleToggleTabsOverview',
    label: 'Tabs Overview',
    description: 'Show every window and tab',
    details: 'Opens an overlay of every browser window with its tabs listed inside. Key-click a tab to switch to it, or key-click a window header to focus that window and keep its active tab. The current window is listed first, and the current tab is highlighted.',
    keyboardClass: 'key-gray',
    row: 3
  }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({
    handler: 'handleToggleKeyboardHelp',
    label: 'KB Reference',
    description: 'Show or hide the keyboard map',
    details: 'Toggles the floating Keyboard Reference window that shows your current layout’s keycaps and bindings.',
    keyboardClass: 'key-purple',
    row: 2
  }),
  // Text select: default character-level (H on right-handed layout).
  HIGHLIGHT: Object.freeze({
    handler: 'handleHighlightKey',
    label: 'Text Select',
    description: 'Select text and copy rich text',
    details: 'Enters character-level text selection under the cursor. By default, the selection is copied as rich text so formatting is preserved when you paste.',
    keyboardClass: 'key-highlight',
    row: 2
  }),
  // Rectangle region select (Y on right-handed; R free on left-handed).
  RECTANGLE_HIGHLIGHT: Object.freeze({
    handler: 'handleRectangleHighlightKey',
    label: 'Element Select',
    description: 'Rectangle or cumulative element pick',
    details: 'Selects HTML elements that intersect a dragged rectangle, or pick elements cumulatively. Useful for grabbing structure (not just plain text) from a page region.',
    keyboardClass: 'key-rect-highlight',
    row: 1
  }),
  // Copy image under cursor (I on right-handed; E on left-handed — I is OPEN_POPOVER there).
  COPY_HOVERED_IMAGE: Object.freeze({
    handler: 'handleCopyHoveredImageKey',
    label: 'Copy Image',
    description: 'Copy hovered image',
    details: 'Copies the image under the cursor to the clipboard, Media Library, or both — configure the destination on the action. Prefer this when you want the image bytes or a saved library entry, not just a URL.',
    // Default key face (no tinted key-gray / family fill).
    keyboardClass: null,
    row: 1
  }),
  // Copy hyperlink under cursor (U on right-handed; no default on left — U is FORWARD there).
  COPY_HOVERED_URL: Object.freeze({
    handler: 'handleCopyHoveredUrlKey',
    label: 'Copy URL',
    description: 'Copy hovered link URL',
    details: 'Copies the URL under the cursor to the clipboard, Media Library, or both. Use this when you need the href itself rather than fetching or opening the resource.',
    keyboardClass: null,
    row: 1
  }),
  // Copy video under cursor — Actions Library only (no built-in layout key).
  COPY_HOVERED_VIDEO: Object.freeze({
    handler: 'handleCopyHoveredVideoKey',
    label: 'Copy Video',
    description: 'Copy hovered video',
    details: 'Copies the video under the cursor (file bytes to Media Library when fetchable, or the video URL to the clipboard). No default layout key — bind it in Layout Editor if you need it.',
    keyboardClass: null,
    row: null
  }),
  // Font under cursor — Actions Library only (no built-in layout key).
  FONT_INFO: Object.freeze({
    handler: 'handleFontInfoKey',
    label: 'Font Info',
    description: 'Inspect font under the cursor',
    details: 'Shows a popover with the font name, size, family, file type, and resource URL for the styled text under the cursor, and outlines that text run. No default layout key — bind it in Layout Editor if you need it.',
    keyboardClass: null,
    row: null
  }),
  // Page-wide Image / Video / Text gallery (O on right-handed; O is TAB_RIGHT on left-handed).
  PAGE_MEDIA: Object.freeze({
    handler: 'handlePageMediaKey',
    label: 'Page Media',
    description: 'Browse media found on this page',
    details: 'Opens a gallery of images, videos, documents, fonts, and URLs discovered on the current page so you can review or collect them without hunting through the DOM.',
    keyboardClass: null,
    row: 1
  }),
  // Media Library entry point (M on right-handed only — M is PAGE_DOWN_INSTANT on left-handed,
  // so this doesn't get a default binding there yet).
  OPEN_MEDIA_LIBRARY: Object.freeze({
    handler: 'handleOpenMediaLibraryKey',
    label: 'Media Library',
    description: 'Open saved Media Library',
    details: 'Opens the Media Library where items you previously copied or saved (images, videos, URLs, and related assets) are kept for reuse.',
    keyboardClass: null,
    row: 1
  }),
  // Clipboard commands (Functions palette — Clipboard category).
  CLIPBOARD_COPY: Object.freeze({
    handler: 'handleClipboardCopyKey',
    label: 'Copy',
    description: 'Copy selection to clipboard',
    details: 'Copies the current text selection to the system clipboard. Prefer this over OS shortcuts when you want Copy available as a KeyPilot layout binding.',
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_CUT: Object.freeze({
    handler: 'handleClipboardCutKey',
    label: 'Cut',
    description: 'Cut selection to clipboard',
    details: 'Cuts the current text selection to the system clipboard from the focused field or editable region.',
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_PASTE: Object.freeze({
    handler: 'handleClipboardPasteKey',
    label: 'Paste',
    description: 'Paste into the focused field',
    details: 'Pastes clipboard text into the focused text field or editable element. Bind with a modifier chord if you need it while typing.',
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_SELECT_ALL: Object.freeze({
    handler: 'handleClipboardSelectAllKey',
    label: 'Select All',
    description: 'Select all in field or page',
    details: 'Selects all text in the focused field, or the page content when nothing editable is focused — same idea as the usual Select All shortcut.',
    keyboardClass: null,
    row: null
  }),
  SELECT_WORD: Object.freeze({
    handler: 'handleSelectWordKey',
    label: 'Select Word',
    description: 'Select the word under the cursor',
    details: 'Selects the word under the KeyPilot cursor. Press again over the same word to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy reads this selection.',
    keyboardClass: null,
    row: null
  }),
  SELECT_SENTENCE: Object.freeze({
    handler: 'handleSelectSentenceKey',
    label: 'Select Sentence',
    description: 'Select the sentence under the cursor',
    details: 'Selects the sentence under the KeyPilot cursor. Press again over the same sentence to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).',
    keyboardClass: null,
    row: null
  }),
  SELECT_PARAGRAPH: Object.freeze({
    handler: 'handleSelectParagraphKey',
    label: 'Select Paragraph',
    description: 'Select the paragraph under the cursor',
    details: 'Selects the paragraph (or nearest block) under the KeyPilot cursor. Press again over the same block to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).',
    keyboardClass: null,
    row: null
  }),
  SELECT_IMAGE: Object.freeze({
    handler: 'handleSelectImageKey',
    label: 'Select Image',
    description: 'Select the image under the cursor',
    details: 'Selects the image under the KeyPilot cursor. Press again over the same image to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy can copy selected images.',
    keyboardClass: null,
    row: null
  }),
  // AI (Functions palette — AI category).
  SEND_TEXT_TO_AI: Object.freeze({
    handler: 'handleSendTextToAiKey',
    label: 'Send Text To AI',
    description: 'Run AI on selected text',
    details: 'Sends the selected text to AI with a configurable instruction, then routes the result to the clipboard and/or a popover. Configure the prompt and destination on the action instance.',
    keyboardClass: 'key-purple',
    row: null
  })
});

export const KEYBINDING_ACTION_CATEGORY_BY_ID = Object.freeze({
  // Navigation — click / link preview / history
  ACTIVATE: 'Navigation',
  ACTIVATE_NEW_TAB: 'Navigation',
  ACTIVATE_NEW_TAB_BACKGROUND: 'Navigation',
  PREVIEW_LINK_POPOVER: 'Navigation',
  POI_WEBSITE: 'Maps',
  POI_ADDRESS: 'Maps',
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
  TABS_OVERVIEW: 'Tab Control',
  PAGE_UP_INSTANT: 'Scroll',
  PAGE_DOWN_INSTANT: 'Scroll',
  PAGE_TOP: 'Scroll',
  PAGE_BOTTOM: 'Scroll',
  SCROLL_LINE: 'Scroll',
  ZOOM_OUT: 'Scroll',
  ZOOM_IN: 'Scroll',
  HIGHLIGHT: 'Get Page Data',
  RECTANGLE_HIGHLIGHT: 'Get Page Data',
  COPY_HOVERED_IMAGE: 'Get Page Data',
  COPY_HOVERED_URL: 'Get Page Data',
  COPY_HOVERED_VIDEO: 'Get Page Data',
  FONT_INFO: 'Get Page Data',
  PAGE_MEDIA: 'Get Page Data',
  DELETE: 'Select',
  COLS_TOGGLE: 'Select',
  OPEN_MEDIA_LIBRARY: 'Media Library',
  CLIPBOARD_COPY: 'Clipboard',
  CLIPBOARD_CUT: 'Clipboard',
  CLIPBOARD_PASTE: 'Clipboard',
  CLIPBOARD_SELECT_ALL: 'Clipboard',
  SELECT_WORD: 'Clipboard',
  SELECT_SENTENCE: 'Clipboard',
  SELECT_PARAGRAPH: 'Clipboard',
  SELECT_IMAGE: 'Clipboard',
  SEND_TEXT_TO_AI: 'AI',
  LAUNCHER: 'Begin URL',
  TOP_SITES: 'Begin URL',
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
  'Maps',
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
  const fallbackBase = getMessage('layout_editor_layout_noun') || 'Layout';
  const copyWord = getMessage('layout_editor_copy_suffix') || 'Copy';
  const base = String(baseLabel || fallbackBase).trim() || fallbackBase;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const copyAlts = [...new Set(['Copy', copyWord])]
    .map((word) => String(word || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean)
    .join('|');
  const re = new RegExp(`^${escaped} (?:${copyAlts || 'Copy'}) (\\d+)$`, 'i');
  let maxN = 0;
  for (const l of existingLayouts || []) {
    const m = String(l?.label || '').trim().match(re);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxN) maxN = n;
  }
  return `${base} ${copyWord} ${maxN + 1}`;
}

/**
 * Grouped options for Keyboard Reference + Config layout pickers.
 * Built-in families are marked `builtIn: true`; user layouts are `builtIn: false`.
 *
 * @param {{ id?: string, label?: string }[]} [userLayouts]
 * @returns {{
 *   builtin: { value: string, labelKey: string, descriptionKey?: string, builtIn: true }[],
 *   custom: { value: string, label: string, builtIn: false }[]
 * }}
 */
export function listLayoutPickerGroups(userLayouts = []) {
  /** @type {{ value: string, labelKey: string, descriptionKey?: string, builtIn: true }[]} */
  const builtin = [];
  for (const fam of BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META || []) {
    if (!fam?.id || !fam.labelKey) continue;
    builtin.push({
      value: builtinFamilySelectValue(fam.id),
      labelKey: fam.labelKey,
      descriptionKey: fam.descriptionKey,
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
 * Resolve Function-catalog display copy for a built-in action.
 * English `def.label` / `def.description` remain the fallback when a message is missing.
 * @param {string} actionId
 * @param {ActionDef|null|undefined} def
 * @returns {{ label: string, description: string }}
 */
function localizedActionCopy(actionId, def) {
  const id = String(actionId || '');
  return {
    label: getMessage(`fn_${id}_label`) || def?.label || id,
    description: getMessage(`fn_${id}_description`) || def?.description || ''
  };
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
    if (isBuildExcludedKeyAction(actionId)) continue;
    const assign = layout?.assignments?.[actionId];
    if (!assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    const copy = localizedActionCopy(actionId, def);

    out[actionId] = {
      keys: assign.keys.slice(),
      ...(assign.bindingType ? { bindingType: assign.bindingType } : {}),
      ...(Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {}),
      handler: def.handler,
      label: copy.label,
      description: copy.description,
      keyLabel: labels.keyLabel,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: labels.displayKey
    };
  }

  for (const stock of STOCK_ACTIONS) {
    const assign = layout?.assignments?.[stock.id];
    if (!assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    const localized = getStockActionById(stock.id);
    out[stock.id] = {
      keys: assign.keys.slice(),
      ...(assign.bindingType ? { bindingType: assign.bindingType } : {}),
      ...(Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {}),
      handler: stock.handler,
      functionId: stock.functionId,
      instanceId: stock.id,
      parameters: stock.parameters,
      label: localized?.label || stock.id,
      description: localized?.description || '',
      keyLabel: labels.keyLabel,
      keyboardClass: stock.keyboardClass ?? null,
      row: null,
      displayKey: labels.displayKey
    };
  }

  return out;
}

/**
 * Catalog metadata for every built-in action, including Actions Library-only ids
 * that have no layout assignment (e.g. Copy Video). Overlay layout bindings on top
 * when a key is actually assigned.
 * @type {Readonly<Record<string, {
 *   keys: string[],
 *   handler: string,
 *   label: string,
 *   description: string,
 *   keyboardClass: string|null,
 *   row: number|null,
 *   displayKey: string,
 *   keyLabel: string
 * }>>}
 */
export const CATALOG_KEYBINDINGS = (() => {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    if (isBuildExcludedKeyAction(actionId)) continue;
    const copy = localizedActionCopy(actionId, def);
    out[actionId] = Object.freeze({
      keys: Object.freeze([]),
      handler: def.handler,
      label: copy.label,
      description: copy.description,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: '',
      keyLabel: ''
    });
  }
  return Object.freeze(out);
})();

/**
 * @param {string} actionId
 * @param {Record<string, any>|null|undefined} [keybindings]
 * @returns {any|null}
 */
export function resolveKeybinding(actionId, keybindings) {
  const id = String(actionId || '');
  if (!id) return null;
  if (keybindings && keybindings[id]) return keybindings[id];
  const catalog = CATALOG_KEYBINDINGS[id];
  if (!catalog) return null;
  return { ...catalog, ...localizedActionCopy(id, KEYBINDING_ACTION_DEFS[id]) };
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
      ...(v?.bindingType === 'physical' || v?.bindingType === 'character'
        ? { bindingType: v.bindingType }
        : {}),
      ...(Array.isArray(v?.matchOn) ? { matchOn: v.matchOn.slice() } : {}),
      ...(typeof v?.displayKey === 'string' ? { displayKey: v.displayKey } : {}),
      ...(typeof v?.keyLabel === 'string' ? { keyLabel: v.keyLabel } : {})
    };
  }
  return out;
}

/**
 * Built-in actions bind to a physical DOM code. `displayKey` is the current
 * US-ANSI presentation fallback; a selected hardware model will replace it at
 * the Keyboard Reference presentation boundary.
 *
 * @param {string} code
 * @param {string} displayKey
 * @returns {KeyAssignment}
 */
function physicalAssignment(code, displayKey) {
  return Object.freeze({
    bindingType: 'physical',
    keys: Object.freeze([code]),
    matchOn: Object.freeze(['code']),
    displayKey,
    keyLabel: displayKey
  });
}

/**
 * Explicit character-semantic assignment for user-defined layouts where the
 * produced character, rather than its physical position, is the intended
 * trigger. Built-in layouts must use {@link physicalAssignment}.
 *
 * @param {string[]} keys
 * @param {{ displayKey?: string, keyLabel?: string }} [labels]
 * @returns {KeyAssignment}
 */
export function createCharacterKeyAssignment(keys, labels = {}) {
  const values = Array.isArray(keys) ? keys.map(String).filter(Boolean) : [];
  return Object.freeze({
    bindingType: 'character',
    keys: Object.freeze(values),
    matchOn: Object.freeze(['key']),
    ...(typeof labels.displayKey === 'string' ? { displayKey: labels.displayKey } : {}),
    ...(typeof labels.keyLabel === 'string' ? { keyLabel: labels.keyLabel } : {})
  });
}

/**
 * Right-handed Navigation (full layout; storage id remains browsing-right).
 * @type {Record<string, KeyAssignment>}
 */
const ASSIGNMENTS_BROWSING_RIGHT = Object.freeze({
  TAB_LEFT: physicalAssignment('KeyQ', 'Q'),
  TAB_RIGHT: physicalAssignment('KeyW', 'W'),
  OPEN_POPOVER: physicalAssignment('KeyP', 'P'),
  PREVIEW_LINK_POPOVER: physicalAssignment('KeyE', 'E'),
  FORWARD: physicalAssignment('KeyR', 'R'),
  NEW_TAB: physicalAssignment('KeyT', 'T'),

  CLOSE_TAB: physicalAssignment('KeyA', 'A'),
  ROOT: physicalAssignment('KeyS', 'S'),
  BACK: physicalAssignment('KeyD', 'D'),
  ACTIVATE: physicalAssignment('KeyF', 'F'),
  ACTIVATE_NEW_TAB_BACKGROUND: physicalAssignment('KeyG', 'G'),
  HIGHLIGHT: physicalAssignment('KeyH', 'H'),

  TAB_HISTORY: physicalAssignment('KeyJ', 'J'),
  OMNIBOX: physicalAssignment('KeyL', 'L'),
  TOP_SITES: physicalAssignment('Semicolon', ';'),

  PAGE_TOP: physicalAssignment('KeyZ', 'Z'),
  PAGE_BOTTOM: physicalAssignment('KeyX', 'X'),
  PAGE_UP_INSTANT: physicalAssignment('KeyC', 'C'),
  PAGE_DOWN_INSTANT: physicalAssignment('KeyV', 'V'),
  SCROLL_LINE: physicalAssignment('KeyB', 'B'),
  ZOOM_OUT: physicalAssignment('BracketLeft', '['),
  ZOOM_IN: physicalAssignment('BracketRight', ']'),
  ACTIVATE_NEW_TAB: physicalAssignment('KeyN', 'N'),
  RECTANGLE_HIGHLIGHT: physicalAssignment('KeyY', 'Y'),
  COPY_HOVERED_IMAGE: physicalAssignment('KeyI', 'I'),
  COPY_HOVERED_URL: physicalAssignment('KeyU', 'U'),
  PAGE_MEDIA: physicalAssignment('KeyO', 'O'),
  // M is otherwise unused on the right-handed layout (it's PAGE_DOWN_INSTANT on left-handed).
  OPEN_MEDIA_LIBRARY: physicalAssignment('KeyM', 'M'),
  TABS_OVERVIEW: physicalAssignment('Period', '.'),
  // Comma is free on the right-handed layout. Left-handed mirror is KeyC.
  [STOCK_RANDOM_BOOKMARK_ACTION_ID]: physicalAssignment('Comma', ','),

  DELETE: physicalAssignment('Backspace', 'Backspace'),
  // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
  // Slash is free on the right-handed layout. Left-handed mirror is KeyZ.
  [STOCK_SOCIAL_MEDIA_ACTION_ID]: physicalAssignment('Slash', '/')
});

/**
 * Left-handed Navigation (full layout; storage id remains browsing-left).
 * @type {Record<string, KeyAssignment>}
 */
const ASSIGNMENTS_BROWSING_LEFT = Object.freeze({
  // Top row cluster: Q W E R T  ->  P O I U Y (mirrored)
  TAB_LEFT: physicalAssignment('KeyP', 'P'),
  TAB_RIGHT: physicalAssignment('KeyO', 'O'),
  OPEN_POPOVER: physicalAssignment('KeyI', 'I'),
  PREVIEW_LINK_POPOVER: physicalAssignment('KeyW', 'W'),
  FORWARD: physicalAssignment('KeyU', 'U'),
  NEW_TAB: physicalAssignment('KeyY', 'Y'),
  SCROLL_LINE: physicalAssignment('KeyT', 'T'),
  ZOOM_OUT: physicalAssignment('BracketLeft', '['),
  ZOOM_IN: physicalAssignment('BracketRight', ']'),

  // Home row cluster: A S D F G  ->  ; L K J H (mirrored-ish around center)
  CLOSE_TAB: physicalAssignment('Semicolon', ';'),
  ROOT: physicalAssignment('KeyL', 'L'),
  BACK: physicalAssignment('KeyK', 'K'),
  ACTIVATE: physicalAssignment('KeyJ', 'J'),
  ACTIVATE_NEW_TAB_BACKGROUND: physicalAssignment('KeyH', 'H'),
  // H is background-tab open on left; G/R free for selection.
  HIGHLIGHT: physicalAssignment('KeyG', 'G'),
  RECTANGLE_HIGHLIGHT: physicalAssignment('KeyR', 'R'),

  // Utility actions on the left avoid colliding with J/K/L cluster.
  // (KB Reference / Settings / Esc live in the system layer, not layout assignments.)
  TAB_HISTORY: physicalAssignment('KeyF', 'F'),
  OMNIBOX: physicalAssignment('KeyS', 'S'),
  TOP_SITES: physicalAssignment('KeyA', 'A'),

  // Bottom row cluster: Z X C V B  ->  / . , M N (mirrored)
  // Period (.) on the right-handed layout mirrors to X.
  TABS_OVERVIEW: physicalAssignment('KeyX', 'X'),
  PAGE_TOP: physicalAssignment('Slash', '/'),
  ACTIVATE_NEW_TAB: physicalAssignment('KeyB', 'B'),
  PAGE_UP_INSTANT: physicalAssignment('Comma', ','),
  // Mirror of right-handed Comma. KeyC is free here (PAGE_UP sits on Comma).
  [STOCK_RANDOM_BOOKMARK_ACTION_ID]: physicalAssignment('KeyC', 'C'),
  PAGE_DOWN_INSTANT: physicalAssignment('KeyM', 'M'),
  PAGE_BOTTOM: physicalAssignment('KeyN', 'N'),
  // I is OPEN_POPOVER on left-handed; E is free.
  COPY_HOVERED_IMAGE: physicalAssignment('KeyE', 'E'),
  // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS

  DELETE: physicalAssignment('Backspace', 'Backspace'),
  // Mirror of right-handed Slash. KeyZ is free here (PAGE_TOP sits on Slash).
  [STOCK_SOCIAL_MEDIA_ACTION_ID]: physicalAssignment('KeyZ', 'Z')
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
  CANCEL: physicalAssignment('Escape', 'Esc'),
  TOGGLE_KEYBOARD_HELP: physicalAssignment('KeyK', 'K'),
  OPEN_SETTINGS_POPOVER: physicalAssignment('Quote', "'")
});

/** Left-handed system-layer physical keys (KB Reference mirrored off the home cluster). */
const SYSTEM_LAYER_ASSIGNMENTS_LEFT = Object.freeze({
  CANCEL: physicalAssignment('Escape', 'Esc'),
  TOGGLE_KEYBOARD_HELP: physicalAssignment('KeyD', 'D'),
  OPEN_SETTINGS_POPOVER: physicalAssignment('Quote', "'")
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
    const copy = localizedActionCopy(actionId, def);
    out[actionId] = {
      keys: assign.keys.slice(),
      ...(assign.bindingType ? { bindingType: assign.bindingType } : {}),
      ...(Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {}),
      handler: def.handler,
      label: copy.label,
      description: copy.description,
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
  'ROOT',
  'PAGE_TOP',
  'PAGE_BOTTOM',
  'PAGE_UP_INSTANT',
  'PAGE_DOWN_INSTANT'
]);

/** Actions kept in Click + History (system keys are NOT included — they are a separate layer). */
const CLICK_HISTORY_ACTION_IDS = Object.freeze([
  'ACTIVATE',
  'BACK',
  'ROOT',
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
    if (isBuildExcludedKeyAction(id)) continue;
    if (source[id]) out[id] = source[id];
  }
  // Also keep any accidental extras that are in allowed set from source iteration order
  for (const [id, assignment] of Object.entries(source || {})) {
    if (isBuildExcludedKeyAction(id)) continue;
    if (allowed.has(id) && !out[id]) out[id] = assignment;
  }
  return Object.freeze(out);
}

/**
 * Physical slot letter for a binding (Q, A, ;, …).
 * Composite labels like "a/`" resolve to the first single-character part.
 * @param {any} binding
 * @returns {string}
 */
export function physicalSlotLabelFromBinding(binding) {
  const namedSlot = (raw) => {
    const token = String(raw || '').trim();
    if (!token) return '';
    if (token.length === 1) return /[a-z]/i.test(token) ? token.toUpperCase() : token;
    if (/^(Backspace|Escape)$/i.test(token)) {
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }
    return '';
  };

  const s = String(binding?.displayKey || binding?.keyLabel || '').trim();
  const fromLabel = namedSlot(s);
  if (fromLabel) return fromLabel;
  if (s.includes('/')) {
    const first = s.split('/')[0];
    const fromComposite = namedSlot(first);
    if (fromComposite) return fromComposite;
  }
  const keys = Array.isArray(binding?.keys) ? binding.keys : [];
  for (const k of keys) {
    const fromKey = namedSlot(k);
    if (fromKey) return fromKey;
  }
  return '';
}

/**
 * Physical DOM-code slot for a typed physical binding.
 * @param {any} binding
 * @returns {string}
 */
export function physicalSlotCodeFromBinding(binding) {
  if (binding?.bindingType !== 'physical' || !Array.isArray(binding.keys)) return '';
  const code = String(binding.keys[0] || '').trim();
  return code || '';
}

function letterFromAssignment(assignment) {
  if (!assignment) return '';
  const slot = physicalSlotLabelFromBinding(assignment);
  if (slot) return slot;
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
          if (isBuildExcludedKeyAction(cell.id) || !allowed.has(cell.id)) {
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
          }
          return cell;
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
    { type: 'action', id: 'ROOT', fallbackText: 'Go to Site Root' },
    { type: 'action', id: 'BACK', fallbackText: 'Go Back' },
    { type: 'action', id: 'ACTIVATE', fallbackText: 'Click Element' },
    { type: 'action', id: 'ACTIVATE_NEW_TAB_BACKGROUND', fallbackText: 'Click New Tab Background' },
    { type: 'action', id: 'HIGHLIGHT', fallbackText: 'Text Select' },
    { type: 'action', id: 'TAB_HISTORY', fallbackText: 'History' },
    { type: 'action', id: 'TOGGLE_KEYBOARD_HELP', fallbackText: 'KB Reference' },
    { type: 'action', id: 'OMNIBOX', fallbackText: 'Omnibox' },
    { type: 'action', id: 'TOP_SITES', fallbackText: 'Top Sites' },
    { type: 'action', id: 'OPEN_SETTINGS_POPOVER', fallbackText: 'Settings' },
    { type: 'special', text: 'Enter', className: 'key key-enter' }
  ],
  [
    { type: 'special', text: 'Shift', className: 'key key-shift' },
    { type: 'action', id: 'PAGE_TOP', fallbackText: 'Scroll To Top' },
    { type: 'action', id: 'PAGE_BOTTOM', fallbackText: 'Scroll To Bottom' },
    { type: 'action', id: 'PAGE_UP_INSTANT', fallbackText: 'Page Up' },
    { type: 'action', id: 'PAGE_DOWN_INSTANT', fallbackText: 'Page Down' },
    { type: 'action', id: 'SCROLL_LINE', fallbackText: 'Scroll Line' },
    { type: 'action', id: 'ACTIVATE_NEW_TAB', fallbackText: 'Click New Tab' },
    { type: 'action', id: 'OPEN_MEDIA_LIBRARY', fallbackText: 'Media Library' },
    { type: 'action', id: STOCK_RANDOM_BOOKMARK_ACTION_ID, fallbackText: 'Random Bookmark' },
    { type: 'action', id: 'TABS_OVERVIEW', fallbackText: 'Tabs Overview' },
    { type: 'action', id: STOCK_SOCIAL_MEDIA_ACTION_ID, fallbackText: 'Social media' },
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
    { type: 'action', id: 'TOP_SITES', fallbackText: 'Top Sites' },
    // Utility keys on the left (to avoid colliding with right-hand cluster)
    { type: 'action', id: 'OMNIBOX', fallbackText: 'Omnibox' }, // S
    { type: 'action', id: 'TOGGLE_KEYBOARD_HELP', fallbackText: 'KB Reference' }, // D
    { type: 'action', id: 'TAB_HISTORY', fallbackText: 'History' }, // F
    { type: 'action', id: 'HIGHLIGHT', fallbackText: 'Text Select' }, // G
    { type: 'action', id: 'ACTIVATE_NEW_TAB_BACKGROUND', fallbackText: 'Click New Tab Background' }, // H
    { type: 'action', id: 'ACTIVATE', fallbackText: 'Click Element' }, // J
    { type: 'action', id: 'BACK', fallbackText: 'Go Back' }, // K
    { type: 'action', id: 'ROOT', fallbackText: 'Go to Site Root' }, // L
    { type: 'action', id: 'CLOSE_TAB', fallbackText: 'Close Tab' }, // ;
    { type: 'action', id: 'OPEN_SETTINGS_POPOVER', fallbackText: 'Settings' }, // '
    { type: 'special', text: 'Enter', className: 'key key-enter' }
  ],
  [
    { type: 'special', text: 'Shift', className: 'key key-shift' },
    { type: 'action', id: STOCK_SOCIAL_MEDIA_ACTION_ID, fallbackText: 'Social media' }, // Z, mirror of /
    { type: 'action', id: 'TABS_OVERVIEW', fallbackText: 'Tabs Overview' }, // X
    { type: 'action', id: STOCK_RANDOM_BOOKMARK_ACTION_ID, fallbackText: 'Random Bookmark' }, // C, mirror of ,
    { type: 'key', text: 'V' },
    { type: 'action', id: 'ACTIVATE_NEW_TAB', fallbackText: 'Click New Tab' }, // B
    { type: 'action', id: 'PAGE_BOTTOM', fallbackText: 'Scroll To Bottom' }, // N
    { type: 'action', id: 'PAGE_DOWN_INSTANT', fallbackText: 'Page Down' }, // M
    { type: 'action', id: 'PAGE_UP_INSTANT', fallbackText: 'Page Up' }, // ,
    { type: 'key', text: '.' },
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
 * @param {{ includeNumberRow?: boolean, hardwareLayoutId?: unknown }} [opts]
 * @returns {any[]}
 */
export function getKeyboardUiLayoutForLayout(layoutId, opts = {}) {
  const id = normalizeKeyboardLayoutId(layoutId);
  const inferred = inferFamilyAndHandednessFromLayoutId(id);
  return buildKeyboardReferenceUiLayout({
    hardwareLayoutId: opts?.hardwareLayoutId,
    keybindings: buildEffectiveKeybindings(id, inferred.handedness),
    includeNumberRow: !!opts?.includeNumberRow
  });
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













