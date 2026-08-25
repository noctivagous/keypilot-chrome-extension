/**
 * KeyPilot Chrome Extension — esbuild bundle
 * Generated on 2026-08-25T22:35:15.299Z
 */


// src/config/keyboard-layouts.js
var DEFAULT_KEYBOARD_LAYOUT_ID = (
  /** @type {const} */
  "browsing-right"
);
var DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID = (
  /** @type {const} */
  "browsing"
);
var DEFAULT_KEYBOARD_HANDEDNESS = (
  /** @type {const} */
  "right"
);
var SOURCE_BUILD_ENABLE_MACRO_BUILDER = false;
var BUILD_ENABLE_MACRO_BUILDER = typeof __KP_BUILD_ENABLE_MACRO_BUILDER__ !== "undefined" ? !!__KP_BUILD_ENABLE_MACRO_BUILDER__ : SOURCE_BUILD_ENABLE_MACRO_BUILDER;
var BUILD_EXCLUDED_KEY_ACTIONS = Object.freeze([
  "COLS_TOGGLE"
]);
var BUILD_EXCLUDED_KEY_ACTION_SET = new Set(BUILD_EXCLUDED_KEY_ACTIONS);
function isBuildExcludedKeyAction(actionId) {
  const id = String(actionId || "");
  return !!id && BUILD_EXCLUDED_KEY_ACTION_SET.has(id);
}
var BUILTIN_KEYBOARD_LAYOUT_META = Object.freeze([
  Object.freeze({
    id: (
      /** @type {const} */
      "browsing-right"
    ),
    label: "Browsing: right-handed",
    description: "Full browsing layout. Mouse: right hand. Shortcuts primarily on the left."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "browsing-left"
    ),
    label: "Browsing: left-handed",
    description: "Full browsing layout. Mouse: left hand. Shortcuts primarily on the right."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "basic-navigation-right"
    ),
    label: "Basic Navigation: right-handed",
    description: "Page scroll, click, tab switch, back/forward only."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "basic-navigation-left"
    ),
    label: "Basic Navigation: left-handed",
    description: "Page scroll, click, tab switch, back/forward only."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "click-history-right"
    ),
    label: "Navigation: right-handed",
    description: "Click element, go back, and go forward only."
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "click-history-left"
    ),
    label: "Navigation: left-handed",
    description: "Click element, go back, and go forward only."
  })
]);
var BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META = Object.freeze([
  Object.freeze({
    id: (
      /** @type {const} */
      "browsing"
    ),
    label: "Browsing",
    builtIn: true,
    description: "Full browsing controls (scroll, tabs, click, history, tools).",
    variants: Object.freeze({
      right: (
        /** @type {const} */
        "browsing-right"
      ),
      left: (
        /** @type {const} */
        "browsing-left"
      )
    })
  }),
  Object.freeze({
    id: (
      /** @type {const} */
      "click-history"
    ),
    label: "Navigation",
    builtIn: true,
    description: "Click element, go back, and go forward.",
    variants: Object.freeze({
      right: (
        /** @type {const} */
        "click-history-right"
      ),
      left: (
        /** @type {const} */
        "click-history-left"
      )
    })
  })
]);
var LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS = Object.freeze({
  "basic-navigation": Object.freeze({
    right: (
      /** @type {const} */
      "basic-navigation-right"
    ),
    left: (
      /** @type {const} */
      "basic-navigation-left"
    )
  })
});
var KNOWN_BUILTIN_LAYOUT_IDS = new Set(
  BUILTIN_KEYBOARD_LAYOUT_META.map((m) => m && m.id).filter(Boolean)
);
function normalizeKeyboardLayoutId(raw) {
  const v = String(raw || "").trim();
  if (KNOWN_BUILTIN_LAYOUT_IDS.has(v)) return (
    /** @type {BuiltinKeyboardLayoutId} */
    v
  );
  return DEFAULT_KEYBOARD_LAYOUT_ID;
}
function normalizeKeyboardLayoutFamilyId(raw) {
  const v = String(raw || "").trim();
  if (v === "navigation") return "browsing";
  if (!v) return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
  const known = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.some((m) => m && m.id === v);
  if (known) return v;
  if (Object.prototype.hasOwnProperty.call(LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS, v)) {
    return (
      /** @type {KeyboardLayoutFamilyId} */
      v
    );
  }
  return DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID;
}
function normalizeKeyboardHandedness(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "left" || v === "right") return (
    /** @type {KeyboardHandedness} */
    v
  );
  return DEFAULT_KEYBOARD_HANDEDNESS;
}
function resolveKeyboardLayoutId({ familyId, handedness } = {}) {
  const fam = normalizeKeyboardLayoutFamilyId(familyId);
  const hand = normalizeKeyboardHandedness(handedness);
  const meta = BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META.find((m) => m && m.id === fam);
  const legacy = LEGACY_KEYBOARD_LAYOUT_FAMILY_VARIANTS[fam];
  const resolved = meta?.variants?.[hand] || legacy?.[hand];
  return normalizeKeyboardLayoutId(resolved);
}
function inferFamilyAndHandednessFromLayoutId(rawLayoutId) {
  const id = normalizeKeyboardLayoutId(rawLayoutId);
  if (id.endsWith("-left")) {
    const familyId = id.slice(0, -"-left".length);
    return {
      familyId: normalizeKeyboardLayoutFamilyId(familyId),
      handedness: "left"
    };
  }
  if (id.endsWith("-right")) {
    const familyId = id.slice(0, -"-right".length);
    return {
      familyId: normalizeKeyboardLayoutFamilyId(familyId),
      handedness: "right"
    };
  }
  return { familyId: DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID, handedness: DEFAULT_KEYBOARD_HANDEDNESS };
}
var KEYBINDING_ACTION_DEFS = Object.freeze({
  ACTIVATE: Object.freeze({
    handler: "handleActivateKey",
    label: "Click Element",
    description: "Click the hovered element",
    details: "Activates the clickable under the cursor \u2014 the same as a left mouse click on that element. Works with links, buttons, and other interactive targets KeyPilot highlights.",
    keyboardClass: "key-activate",
    row: 2
  }),
  // Foreground new tab (switch to the new tab).
  ACTIVATE_NEW_TAB: Object.freeze({
    handler: "handleActivateNewTabKey",
    label: "Click New Tab",
    description: "Open link in a new foreground tab",
    details: "Opens the hovered link in a new tab and switches to it immediately. Use when you want to follow a link without leaving your place permanently, but still jump to the new page right away.",
    keyboardClass: "key-activate-new",
    row: 2
  }),
  // Background new tab (middle-click style; do not switch focus).
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({
    handler: "handleActivateNewTabBackgroundKey",
    label: "Click New Tab Background",
    description: "Open link in a new background tab",
    details: "Opens the hovered link in a new tab without switching focus \u2014 like a middle-click. Useful for queueing several links while you keep reading the current page.",
    keyboardClass: "key-activate-new-over",
    row: 2
  }),
  BACK: Object.freeze({
    handler: "handleBackKey",
    label: "Go Back",
    description: "Browser history back",
    details: "Navigates one step back in the current tab\u2019s history, equivalent to the browser Back button.",
    keyboardClass: "key-back",
    row: 2
  }),
  BACK2: Object.freeze({
    handler: "handleBackKey",
    label: "Go Back",
    description: "Browser history back",
    details: "Navigates one step back in the current tab\u2019s history, equivalent to the browser Back button. Duplicate id for layouts that expose a second Back binding.",
    keyboardClass: "key-back",
    row: 2
  }),
  FORWARD: Object.freeze({
    handler: "handleForwardKey",
    label: "Go Forward",
    description: "Browser history forward",
    details: "Navigates one step forward in the current tab\u2019s history, equivalent to the browser Forward button.",
    keyboardClass: "key-forward",
    row: 1
  }),
  DELETE: Object.freeze({
    handler: "handleDeleteKey",
    label: "Delete Mode",
    description: "Hide elements under the cursor",
    details: "Toggles Delete Mode: hover elements and remove (hide) them from the page so you can declutter layouts. Exit with Exit Focus or by toggling again.",
    keyboardClass: "key-delete",
    row: 2
  }),
  COLS_TOGGLE: Object.freeze({
    handler: "handleColsToggleKey",
    label: "Cols Toggle",
    description: "Multi-column layout under cursor",
    details: "Columnizes the element under the cursor into a multi-column layout so dense text or lists are easier to scan. Toggle again to restore the original layout.",
    keyboardClass: "key-cols",
    row: 3
  }),
  TAB_LEFT: Object.freeze({
    handler: "handleTabLeftKey",
    label: "Tab Left",
    description: "Switch to the previous tab",
    details: "Activates the tab to the left of the current one in the window\u2019s tab strip.",
    keyboardClass: "key-gray",
    row: 1
  }),
  TAB_RIGHT: Object.freeze({
    handler: "handleTabRightKey",
    label: "Tab Right",
    description: "Switch to the next tab",
    details: "Activates the tab to the right of the current one in the window\u2019s tab strip.",
    keyboardClass: "key-gray",
    row: 1
  }),
  ROOT: Object.freeze({
    handler: "handleRootKey",
    label: "Go to Site Root",
    description: "Navigate to the site origin",
    details: "Jumps to the site root (scheme + host) of the current page \u2014 useful for escaping deep paths without typing a URL.",
    keyboardClass: null,
    row: 2
  }),
  LAUNCHER: Object.freeze({
    handler: "handleLauncherKey",
    label: "Launcher",
    description: "Quick-access site launcher",
    details: "Opens the Launcher popover for jumping to favorite or configured sites without using the omnibox.",
    keyboardClass: "key-launcher-orange",
    row: 2
  }),
  TOP_SITES: Object.freeze({
    handler: "handleTopSitesKey",
    label: "Top Sites",
    description: "Toolbar, visits, and bookmarks",
    details: "Opens Top Sites: a quick list drawn from the toolbar, most-visited pages, and recent bookmarks so you can open a frequent destination in one step.",
    keyboardClass: "key-launcher-orange",
    row: 2
  }),
  CLOSE_TAB: Object.freeze({
    handler: "handleCloseTabKey",
    label: "Close Tab",
    description: "Close the current tab",
    details: "Closes the active tab. Behavior matches the browser\u2019s close-tab action for the current window.",
    keyboardClass: "key-close-tab",
    row: 3
  }),
  CANCEL: Object.freeze({
    handler: "cancelModes",
    label: "Exit Focus",
    description: "Leave modes and overlays",
    details: "Cancels the current KeyPilot mode or overlay (Delete Mode, Scroll Line, text focus helpers, and similar) and returns to normal browsing.",
    keyboardClass: null,
    row: null
  }),
  PAGE_UP_INSTANT: Object.freeze({
    handler: "handleInstantPageUp",
    label: "Page Up",
    description: "Jump one page up instantly",
    details: "Scrolls the current scroll target up by roughly one viewport without animation \u2014 faster than a smooth page-up when you need to move quickly.",
    keyboardClass: "key-scroll",
    row: 3
  }),
  PAGE_DOWN_INSTANT: Object.freeze({
    handler: "handleInstantPageDown",
    label: "Page Down",
    description: "Jump one page down instantly",
    details: "Scrolls the current scroll target down by roughly one viewport without animation \u2014 faster than a smooth page-down when you need to move quickly.",
    keyboardClass: "key-scroll",
    row: 3
  }),
  PAGE_TOP: Object.freeze({
    handler: "handlePageTop",
    label: "Scroll To Top",
    description: "Jump to top of scroll target",
    details: "Moves to the top of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings \u2192 Scrolling.",
    keyboardClass: "key-scroll",
    row: 3
  }),
  PAGE_BOTTOM: Object.freeze({
    handler: "handlePageBottom",
    label: "Scroll To Bottom",
    description: "Jump to bottom of scroll target",
    details: "Moves to the bottom of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings \u2192 Scrolling.",
    keyboardClass: "key-scroll",
    row: 3
  }),
  SCROLL_LINE: Object.freeze({
    handler: "handleScrollLineKey",
    label: "Scroll Line",
    description: "Origin-based continuous scroll",
    details: "Scrolls from a fixed origin: move the mouse away from the on-screen dot to scroll faster in that direction. Optionally enable middle-click on empty page area under Settings \u2192 Scrolling.",
    keyboardClass: "key-scroll",
    row: 3,
    mode: "scroll_line",
    cancelOnPointerDown: true,
    pointerBinding: Object.freeze({
      button: "middle",
      yieldToClickables: true,
      yieldToTextEntry: true,
      yieldToModes: Object.freeze(["text_focus", "popover", "omnibox"]),
      enabledSetting: "scroll.middleClickScrollLine"
    })
  }),
  NEW_TAB: Object.freeze({
    handler: "handleNewTabKey",
    label: "New Tab",
    description: "Open a blank new tab",
    details: "Opens a new empty tab in the current window, same as the browser\u2019s New Tab command.",
    keyboardClass: "key-gray",
    row: 1
  }),
  OPEN_POPOVER: Object.freeze({
    handler: "handleOpenPopover",
    label: "Open Popover",
    description: "Open link in a popup window",
    details: "Opens the hovered link in a KeyPilot popup window so you can peek or work in a separate chrome without a full new tab.",
    keyboardClass: "key-open-popover",
    row: 2
  }),
  PREVIEW_LINK_POPOVER: Object.freeze({
    handler: "handlePreviewLinkPopover",
    label: "Preview Link",
    description: "Preview link in a popup",
    details: "Opens Link Preview for the hovered URL in a popup window \u2014 skim the destination without committing a full navigation in the main tab.",
    keyboardClass: "key-preview-popover",
    row: 2
  }),
  POI_WEBSITE: Object.freeze({
    handler: "handlePoiWebsiteKey",
    label: "POI Website",
    description: "Open map place website",
    details: "When a map place (POI) is under the cursor, opens that place\u2019s website in Link Preview so you can visit the business or location page without leaving the map.",
    keyboardClass: "key-preview-popover",
    row: null
  }),
  POI_ADDRESS: Object.freeze({
    handler: "handlePoiAddressKey",
    label: "POI Address",
    description: "Copy map place address",
    details: "When a map place (POI) is under the cursor, copies its street address to the clipboard for pasting into directions, notes, or forms.",
    keyboardClass: null,
    row: null
  }),
  OPEN_SETTINGS_POPOVER: Object.freeze({
    handler: "handleToggleSettingsPopover",
    label: "Settings",
    description: "Open KeyPilot Settings",
    details: "Opens or closes the KeyPilot Settings popover for themes, scrolling, click mode, layouts, and other preferences.",
    keyboardClass: "key-settings-dark",
    row: null
  }),
  OMNIBOX: Object.freeze({
    handler: "handleOpenOmnibox",
    label: "Omnibox",
    description: "Address bar overlay",
    details: "Opens KeyPilot\u2019s omnibox overlay so you can type a URL or search without clicking the browser address bar.",
    keyboardClass: "key-orange",
    row: 2
  }),
  TAB_HISTORY: Object.freeze({
    handler: "handleToggleTabHistoryPopover",
    label: "Tab History",
    description: "Browse this tab\u2019s history",
    details: "Opens Tab History for the current tab so you can jump to a previously visited page in this tab\u2019s session without using the browser\u2019s native history UI.",
    keyboardClass: "key-gray",
    row: 2
  }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({
    handler: "handleToggleKeyboardHelp",
    label: "KB Reference",
    description: "Show or hide the keyboard map",
    details: "Toggles the floating Keyboard Reference window that shows your current layout\u2019s keycaps and bindings.",
    keyboardClass: "key-purple",
    row: 2
  }),
  // Text select: default character-level (H on right-handed layout).
  HIGHLIGHT: Object.freeze({
    handler: "handleHighlightKey",
    label: "Text Select",
    description: "Select text and copy rich text",
    details: "Enters character-level text selection under the cursor. By default, the selection is copied as rich text so formatting is preserved when you paste.",
    keyboardClass: "key-highlight",
    row: 2
  }),
  // Rectangle region select (Y on right-handed; R free on left-handed).
  RECTANGLE_HIGHLIGHT: Object.freeze({
    handler: "handleRectangleHighlightKey",
    label: "Element Select",
    description: "Rectangle or cumulative element pick",
    details: "Selects HTML elements that intersect a dragged rectangle, or pick elements cumulatively. Useful for grabbing structure (not just plain text) from a page region.",
    keyboardClass: "key-rect-highlight",
    row: 1
  }),
  // Copy image under cursor (I on right-handed; E on left-handed — I is OPEN_POPOVER there).
  COPY_HOVERED_IMAGE: Object.freeze({
    handler: "handleCopyHoveredImageKey",
    label: "Copy Image",
    description: "Copy hovered image",
    details: "Copies the image under the cursor to the clipboard, Media Library, or both \u2014 configure the destination on the action. Prefer this when you want the image bytes or a saved library entry, not just a URL.",
    // Default key face (no tinted key-gray / family fill).
    keyboardClass: null,
    row: 1
  }),
  // Copy hyperlink under cursor (U on right-handed; no default on left — U is FORWARD there).
  COPY_HOVERED_URL: Object.freeze({
    handler: "handleCopyHoveredUrlKey",
    label: "Copy URL",
    description: "Copy hovered link URL",
    details: "Copies the URL under the cursor to the clipboard, Media Library, or both. Use this when you need the href itself rather than fetching or opening the resource.",
    keyboardClass: null,
    row: 1
  }),
  // Copy video under cursor — Actions Library only (no built-in layout key).
  COPY_HOVERED_VIDEO: Object.freeze({
    handler: "handleCopyHoveredVideoKey",
    label: "Copy Video",
    description: "Copy hovered video",
    details: "Copies the video under the cursor (file bytes to Media Library when fetchable, or the video URL to the clipboard). No default layout key \u2014 bind it in Layout Editor if you need it.",
    keyboardClass: null,
    row: null
  }),
  // Font under cursor — Actions Library only (no built-in layout key).
  FONT_INFO: Object.freeze({
    handler: "handleFontInfoKey",
    label: "Font Info",
    description: "Inspect font under the cursor",
    details: "Shows a popover with the font name, size, family, file type, and resource URL for the styled text under the cursor, and outlines that text run. No default layout key \u2014 bind it in Layout Editor if you need it.",
    keyboardClass: null,
    row: null
  }),
  // Page-wide Image / Video / Text gallery (O on right-handed; O is TAB_RIGHT on left-handed).
  PAGE_MEDIA: Object.freeze({
    handler: "handlePageMediaKey",
    label: "Page Media",
    description: "Browse media found on this page",
    details: "Opens a gallery of images, videos, documents, fonts, and URLs discovered on the current page so you can review or collect them without hunting through the DOM.",
    keyboardClass: null,
    row: 1
  }),
  // Media Library entry point (M on right-handed only — M is PAGE_DOWN_INSTANT on left-handed,
  // so this doesn't get a default binding there yet).
  OPEN_MEDIA_LIBRARY: Object.freeze({
    handler: "handleOpenMediaLibraryKey",
    label: "Media Library",
    description: "Open saved Media Library",
    details: "Opens the Media Library where items you previously copied or saved (images, videos, URLs, and related assets) are kept for reuse.",
    keyboardClass: null,
    row: 1
  }),
  // Clipboard commands (Functions palette — Clipboard category).
  CLIPBOARD_COPY: Object.freeze({
    handler: "handleClipboardCopyKey",
    label: "Copy",
    description: "Copy selection to clipboard",
    details: "Copies the current text selection to the system clipboard. Prefer this over OS shortcuts when you want Copy available as a KeyPilot layout binding.",
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_CUT: Object.freeze({
    handler: "handleClipboardCutKey",
    label: "Cut",
    description: "Cut selection to clipboard",
    details: "Cuts the current text selection to the system clipboard from the focused field or editable region.",
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_PASTE: Object.freeze({
    handler: "handleClipboardPasteKey",
    label: "Paste",
    description: "Paste into the focused field",
    details: "Pastes clipboard text into the focused text field or editable element. Bind with a modifier chord if you need it while typing.",
    keyboardClass: null,
    row: null
  }),
  CLIPBOARD_SELECT_ALL: Object.freeze({
    handler: "handleClipboardSelectAllKey",
    label: "Select All",
    description: "Select all in field or page",
    details: "Selects all text in the focused field, or the page content when nothing editable is focused \u2014 same idea as the usual Select All shortcut.",
    keyboardClass: null,
    row: null
  }),
  SELECT_WORD: Object.freeze({
    handler: "handleSelectWordKey",
    label: "Select Word",
    description: "Select the word under the cursor",
    details: "Selects the word under the KeyPilot cursor. Press again over the same word to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy reads this selection.",
    keyboardClass: null,
    row: null
  }),
  SELECT_SENTENCE: Object.freeze({
    handler: "handleSelectSentenceKey",
    label: "Select Sentence",
    description: "Select the sentence under the cursor",
    details: "Selects the sentence under the KeyPilot cursor. Press again over the same sentence to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).",
    keyboardClass: null,
    row: null
  }),
  SELECT_PARAGRAPH: Object.freeze({
    handler: "handleSelectParagraphKey",
    label: "Select Paragraph",
    description: "Select the paragraph under the cursor",
    details: "Selects the paragraph (or nearest block) under the KeyPilot cursor. Press again over the same block to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).",
    keyboardClass: null,
    row: null
  }),
  SELECT_IMAGE: Object.freeze({
    handler: "handleSelectImageKey",
    label: "Select Image",
    description: "Select the image under the cursor",
    details: "Selects the image under the KeyPilot cursor. Press again over the same image to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy can copy selected images.",
    keyboardClass: null,
    row: null
  }),
  // AI (Functions palette — AI category).
  SEND_TEXT_TO_AI: Object.freeze({
    handler: "handleSendTextToAiKey",
    label: "Send Text To AI",
    description: "Run AI on selected text",
    details: "Sends the selected text to AI with a configurable instruction, then routes the result to the clipboard and/or a popover. Configure the prompt and destination on the action instance.",
    keyboardClass: "key-purple",
    row: null
  })
});
var KEYBINDING_ACTION_CATEGORY_BY_ID = Object.freeze({
  // Navigation — click / link preview / history
  ACTIVATE: "Navigation",
  ACTIVATE_NEW_TAB: "Navigation",
  ACTIVATE_NEW_TAB_BACKGROUND: "Navigation",
  PREVIEW_LINK_POPOVER: "Navigation",
  POI_WEBSITE: "Maps",
  POI_ADDRESS: "Maps",
  OPEN_POPOVER: "Navigation",
  FORWARD: "Navigation",
  BACK: "Navigation",
  BACK2: "Navigation",
  ROOT: "Navigation",
  // Tab Control
  CLOSE_TAB: "Tab Control",
  TAB_LEFT: "Tab Control",
  TAB_RIGHT: "Tab Control",
  NEW_TAB: "Tab Control",
  TAB_HISTORY: "Tab Control",
  PAGE_UP_INSTANT: "Scroll",
  PAGE_DOWN_INSTANT: "Scroll",
  PAGE_TOP: "Scroll",
  PAGE_BOTTOM: "Scroll",
  SCROLL_LINE: "Scroll",
  HIGHLIGHT: "Get Page Data",
  RECTANGLE_HIGHLIGHT: "Get Page Data",
  COPY_HOVERED_IMAGE: "Get Page Data",
  COPY_HOVERED_URL: "Get Page Data",
  COPY_HOVERED_VIDEO: "Get Page Data",
  FONT_INFO: "Get Page Data",
  PAGE_MEDIA: "Get Page Data",
  DELETE: "Select",
  COLS_TOGGLE: "Select",
  OPEN_MEDIA_LIBRARY: "Media Library",
  CLIPBOARD_COPY: "Clipboard",
  CLIPBOARD_CUT: "Clipboard",
  CLIPBOARD_PASTE: "Clipboard",
  CLIPBOARD_SELECT_ALL: "Clipboard",
  SELECT_WORD: "Clipboard",
  SELECT_SENTENCE: "Clipboard",
  SELECT_PARAGRAPH: "Clipboard",
  SELECT_IMAGE: "Clipboard",
  SEND_TEXT_TO_AI: "AI",
  LAUNCHER: "Begin URL",
  TOP_SITES: "Begin URL",
  OMNIBOX: "Begin URL",
  TOGGLE_KEYBOARD_HELP: "KeyPilot",
  OPEN_SETTINGS_POPOVER: "KeyPilot",
  CANCEL: "System"
});
var KEYBINDING_ACTION_CATEGORY_ORDER = Object.freeze([
  "Navigation",
  "Tab Control",
  "Begin URL",
  "Get Page Data",
  "Maps",
  "Scroll",
  "Select",
  "Media Library",
  "Clipboard",
  "AI",
  "KeyPilot",
  "Tools",
  "System",
  "Other"
]);
function upperLetter(s) {
  const ch = String(s || "");
  if (!ch) return "";
  return ch.length === 1 ? ch.toUpperCase() : ch;
}
function normalizeAssignmentLabels(a) {
  const keys = Array.isArray(a?.keys) ? a.keys : [];
  const first = keys[0] || "";
  const explicitDisplay = typeof a?.displayKey === "string" ? a.displayKey : "";
  const explicitKeyLabel = typeof a?.keyLabel === "string" ? a.keyLabel : "";
  if (explicitDisplay || explicitKeyLabel) {
    const dk = explicitDisplay || explicitKeyLabel;
    const kl = explicitKeyLabel || explicitDisplay;
    return { keyLabel: kl || dk || "", displayKey: dk || kl || "" };
  }
  if (typeof first === "string" && first.length === 1 && /[a-zA-Z]/.test(first)) {
    const up = upperLetter(first);
    return { keyLabel: up, displayKey: up };
  }
  return { keyLabel: String(first || ""), displayKey: String(first || "") };
}
function buildKeybindingsForLayout(layoutId) {
  const id = normalizeKeyboardLayoutId(layoutId);
  const layout = BUILTIN_KEYBOARD_LAYOUTS[id];
  const out = {};
  for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    if (isBuildExcludedKeyAction(actionId)) continue;
    const assign = layout?.assignments?.[actionId];
    if (!assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    out[actionId] = {
      keys: assign.keys.slice(),
      ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
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
var CATALOG_KEYBINDINGS = (() => {
  const out = {};
  for (const [actionId, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    if (isBuildExcludedKeyAction(actionId)) continue;
    out[actionId] = Object.freeze({
      keys: Object.freeze([]),
      handler: def.handler,
      label: def.label,
      description: def.description,
      keyboardClass: def.keyboardClass ?? null,
      row: def.row ?? null,
      displayKey: "",
      keyLabel: ""
    });
  }
  return Object.freeze(out);
})();
var ASSIGNMENTS_BROWSING_RIGHT = Object.freeze({
  TAB_LEFT: Object.freeze({ keys: ["q", "Q"] }),
  TAB_RIGHT: Object.freeze({ keys: ["w", "W"] }),
  OPEN_POPOVER: Object.freeze({ keys: ["p", "P"] }),
  PREVIEW_LINK_POPOVER: Object.freeze({ keys: ["e", "E"] }),
  FORWARD: Object.freeze({ keys: ["r", "R"] }),
  NEW_TAB: Object.freeze({ keys: ["t", "T"] }),
  CLOSE_TAB: Object.freeze({ keys: ["a", "A"] }),
  ROOT: Object.freeze({ keys: ["s", "S", "1", "!"], displayKey: "S", keyLabel: "S" }),
  BACK: Object.freeze({ keys: ["d", "D"] }),
  ACTIVATE: Object.freeze({ keys: ["f", "F"] }),
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({ keys: ["g", "G"] }),
  HIGHLIGHT: Object.freeze({ keys: ["h", "H"] }),
  TAB_HISTORY: Object.freeze({ keys: ["j", "J"] }),
  OMNIBOX: Object.freeze({ keys: ["l", "L"] }),
  TOP_SITES: Object.freeze({ keys: [";", ":", "Semicolon", "`", "~", "Backquote"], matchOn: ["key", "code"], displayKey: ";", keyLabel: ";" }),
  PAGE_TOP: Object.freeze({ keys: ["z", "Z"] }),
  PAGE_BOTTOM: Object.freeze({ keys: ["x", "X"] }),
  PAGE_UP_INSTANT: Object.freeze({ keys: ["c", "C"] }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ["v", "V"] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ["b", "B"] }),
  SCROLL_LINE: Object.freeze({ keys: ["n", "N"] }),
  RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ["y", "Y"] }),
  COPY_HOVERED_IMAGE: Object.freeze({ keys: ["i", "I"] }),
  COPY_HOVERED_URL: Object.freeze({ keys: ["u", "U"] }),
  PAGE_MEDIA: Object.freeze({ keys: ["o", "O"] }),
  // M is otherwise unused on the right-handed layout (it's PAGE_DOWN_INSTANT on left-handed).
  OPEN_MEDIA_LIBRARY: Object.freeze({ keys: ["m", "M"] }),
  DELETE: Object.freeze({ keys: ["Backspace"], displayKey: "Backspace", keyLabel: "Backspace" })
  // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
});
var ASSIGNMENTS_BROWSING_LEFT = Object.freeze({
  // Top row cluster: Q W E R T  ->  P O I U Y (mirrored)
  TAB_LEFT: Object.freeze({ keys: ["p", "P"] }),
  TAB_RIGHT: Object.freeze({ keys: ["o", "O"] }),
  OPEN_POPOVER: Object.freeze({ keys: ["i", "I"] }),
  PREVIEW_LINK_POPOVER: Object.freeze({ keys: ["w", "W"] }),
  FORWARD: Object.freeze({ keys: ["u", "U"] }),
  NEW_TAB: Object.freeze({ keys: ["y", "Y"] }),
  SCROLL_LINE: Object.freeze({ keys: ["t", "T"] }),
  // Home row cluster: A S D F G  ->  ; L K J H (mirrored-ish around center)
  CLOSE_TAB: Object.freeze({ keys: [";", ":"], displayKey: ";", keyLabel: ";" }),
  ROOT: Object.freeze({ keys: ["l", "L", "1", "!"], displayKey: "L", keyLabel: "L" }),
  BACK: Object.freeze({ keys: ["k", "K"] }),
  ACTIVATE: Object.freeze({ keys: ["j", "J"] }),
  ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({ keys: ["h", "H"] }),
  // H is background-tab open on left; G/R free for selection.
  HIGHLIGHT: Object.freeze({ keys: ["g", "G"] }),
  RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ["r", "R"] }),
  // Utility actions on the left avoid colliding with J/K/L cluster.
  // (KB Reference / Settings / Esc live in the system layer, not layout assignments.)
  TAB_HISTORY: Object.freeze({ keys: ["f", "F"] }),
  OMNIBOX: Object.freeze({ keys: ["s", "S"] }),
  TOP_SITES: Object.freeze({ keys: ["a", "A", "`", "~", "Backquote"], matchOn: ["key", "code"], displayKey: "A", keyLabel: "A" }),
  // Bottom row cluster: Z X C V B  ->  / . , M N (mirrored)
  PAGE_TOP: Object.freeze({ keys: ["/", "?"], displayKey: "/", keyLabel: "/" }),
  PAGE_BOTTOM: Object.freeze({ keys: ["b", "B"] }),
  PAGE_UP_INSTANT: Object.freeze({ keys: [",", "<"], displayKey: ",", keyLabel: "," }),
  PAGE_DOWN_INSTANT: Object.freeze({ keys: ["m", "M"] }),
  ACTIVATE_NEW_TAB: Object.freeze({ keys: ["n", "N"] }),
  // I is OPEN_POPOVER on left-handed; E is free.
  COPY_HOVERED_IMAGE: Object.freeze({ keys: ["e", "E"] }),
  // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
  DELETE: Object.freeze({ keys: ["Backspace"], displayKey: "Backspace", keyLabel: "Backspace" })
});
var SYSTEM_LAYER_ACTION_IDS = Object.freeze([
  "CANCEL",
  "TOGGLE_KEYBOARD_HELP",
  "OPEN_SETTINGS_POPOVER"
]);
var SYSTEM_LAYER_ASSIGNMENTS_RIGHT = Object.freeze({
  CANCEL: Object.freeze({ keys: ["Escape"], displayKey: "Esc", keyLabel: "Esc" }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ["k", "K"] }),
  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", "Quote"], matchOn: ["key", "code"], displayKey: "'" })
});
var SYSTEM_LAYER_ASSIGNMENTS_LEFT = Object.freeze({
  CANCEL: Object.freeze({ keys: ["Escape"], displayKey: "Esc", keyLabel: "Esc" }),
  TOGGLE_KEYBOARD_HELP: Object.freeze({ keys: ["d", "D"] }),
  OPEN_SETTINGS_POPOVER: Object.freeze({ keys: ["'", "Quote"], matchOn: ["key", "code"], displayKey: "'" })
});
function buildSystemKeybindings(handedness = DEFAULT_KEYBOARD_HANDEDNESS) {
  const hand = normalizeKeyboardHandedness(handedness);
  const assignments = hand === "left" ? SYSTEM_LAYER_ASSIGNMENTS_LEFT : SYSTEM_LAYER_ASSIGNMENTS_RIGHT;
  const out = {};
  for (const actionId of SYSTEM_LAYER_ACTION_IDS) {
    const def = KEYBINDING_ACTION_DEFS[actionId];
    const assign = assignments[actionId];
    if (!def || !assign || !Array.isArray(assign.keys)) continue;
    const labels = normalizeAssignmentLabels(assign);
    out[actionId] = {
      keys: assign.keys.slice(),
      ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
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
function buildEffectiveKeybindings(layoutId, handedness = DEFAULT_KEYBOARD_HANDEDNESS) {
  return {
    ...buildKeybindingsForLayout(layoutId),
    ...buildSystemKeybindings(handedness)
  };
}
var BASIC_NAVIGATION_ACTION_IDS = Object.freeze([
  "ACTIVATE",
  "TAB_LEFT",
  "TAB_RIGHT",
  "FORWARD",
  "BACK",
  "ROOT",
  "PAGE_TOP",
  "PAGE_BOTTOM",
  "PAGE_UP_INSTANT",
  "PAGE_DOWN_INSTANT"
]);
var CLICK_HISTORY_ACTION_IDS = Object.freeze([
  "ACTIVATE",
  "BACK",
  "ROOT",
  "FORWARD"
]);
var BASIC_NAVIGATION_UI_ACTION_IDS = Object.freeze([
  ...BASIC_NAVIGATION_ACTION_IDS,
  ...SYSTEM_LAYER_ACTION_IDS
]);
var CLICK_HISTORY_UI_ACTION_IDS = Object.freeze([
  ...CLICK_HISTORY_ACTION_IDS,
  ...SYSTEM_LAYER_ACTION_IDS
]);
function pickAssignments(source, allowedIds) {
  const allowed = new Set(allowedIds);
  const out = {};
  for (const id of allowedIds) {
    if (isBuildExcludedKeyAction(id)) continue;
    if (source[id]) out[id] = source[id];
  }
  for (const [id, assignment] of Object.entries(source || {})) {
    if (isBuildExcludedKeyAction(id)) continue;
    if (allowed.has(id) && !out[id]) out[id] = assignment;
  }
  return Object.freeze(out);
}
function physicalSlotLabelFromBinding(binding) {
  const namedSlot = (raw) => {
    const token = String(raw || "").trim();
    if (!token) return "";
    if (token.length === 1) return /[a-z]/i.test(token) ? token.toUpperCase() : token;
    if (/^(Backspace|Escape)$/i.test(token)) {
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }
    return "";
  };
  const s = String(binding?.displayKey || binding?.keyLabel || "").trim();
  const fromLabel = namedSlot(s);
  if (fromLabel) return fromLabel;
  if (s.includes("/")) {
    const first = s.split("/")[0];
    const fromComposite = namedSlot(first);
    if (fromComposite) return fromComposite;
  }
  const keys = Array.isArray(binding?.keys) ? binding.keys : [];
  for (const k of keys) {
    const fromKey = namedSlot(k);
    if (fromKey) return fromKey;
  }
  return "";
}
function letterFromAssignment(assignment) {
  if (!assignment) return "";
  const slot = physicalSlotLabelFromBinding(assignment);
  if (slot) return slot;
  if (typeof assignment.displayKey === "string" && assignment.displayKey) return assignment.displayKey;
  if (typeof assignment.keyLabel === "string" && assignment.keyLabel) return assignment.keyLabel;
  const keys = Array.isArray(assignment.keys) ? assignment.keys : [];
  for (const k of keys) {
    const s = String(k || "");
    if (!s || s === "Semicolon" || s === "Quote" || s === "Backquote") continue;
    if (s.length === 1) return s.toUpperCase();
    if (s === "Backspace" || s === "Escape") return s;
  }
  return "";
}
function projectKeyboardUiLayout(baseLayout, fullAssignments, allowedIds) {
  const allowed = new Set(allowedIds);
  return Object.freeze(
    (Array.isArray(baseLayout) ? baseLayout : []).map(
      (row) => Object.freeze(
        (Array.isArray(row) ? row : []).map((cell) => {
          if (!cell || cell.type !== "action" || !cell.id) return cell;
          if (isBuildExcludedKeyAction(cell.id) || !allowed.has(cell.id)) {
            if (cell.id === "DELETE" || cell.className && String(cell.className).includes("key-backspace")) {
              return Object.freeze({ type: "special", text: "Backspace", className: "key key-backspace" });
            }
            const text = letterFromAssignment(fullAssignments[cell.id]);
            if (!text) return Object.freeze({ type: "key", text: "" });
            if (text === "Backspace") {
              return Object.freeze({ type: "special", text: "Backspace", className: "key key-backspace" });
            }
            const glyph = text.length <= 3 ? text : text.slice(0, 1).toUpperCase();
            return Object.freeze({ type: "key", text: glyph.length === 1 ? glyph.toUpperCase() : glyph });
          }
          return cell;
        })
      )
    )
  );
}
var ASSIGNMENTS_BASIC_NAVIGATION_RIGHT = pickAssignments(ASSIGNMENTS_BROWSING_RIGHT, BASIC_NAVIGATION_ACTION_IDS);
var ASSIGNMENTS_BASIC_NAVIGATION_LEFT = pickAssignments(ASSIGNMENTS_BROWSING_LEFT, BASIC_NAVIGATION_ACTION_IDS);
var ASSIGNMENTS_CLICK_HISTORY_RIGHT = pickAssignments(ASSIGNMENTS_BROWSING_RIGHT, CLICK_HISTORY_ACTION_IDS);
var ASSIGNMENTS_CLICK_HISTORY_LEFT = pickAssignments(ASSIGNMENTS_BROWSING_LEFT, CLICK_HISTORY_ACTION_IDS);
var KEYBOARD_UI_LAYOUT_RIGHT = Object.freeze([
  [
    { type: "special", text: "Tab", className: "key key-tab" },
    { type: "action", id: "TAB_LEFT", fallbackText: "Tab Left" },
    { type: "action", id: "TAB_RIGHT", fallbackText: "Tab Right" },
    { type: "action", id: "PREVIEW_LINK_POPOVER", fallbackText: "Preview Link" },
    { type: "action", id: "FORWARD", fallbackText: "Go Forward" },
    { type: "action", id: "NEW_TAB", fallbackText: "New Tab" },
    { type: "action", id: "RECTANGLE_HIGHLIGHT", fallbackText: "Rectangle Select" },
    { type: "action", id: "COPY_HOVERED_URL", fallbackText: "Copy URL" },
    { type: "action", id: "COPY_HOVERED_IMAGE", fallbackText: "Copy Image" },
    { type: "action", id: "PAGE_MEDIA", fallbackText: "Page Media" },
    { type: "action", id: "OPEN_POPOVER", fallbackText: "Open Popover" },
    { type: "key", text: "[" },
    { type: "key", text: "]" },
    { type: "action", id: "DELETE", fallbackText: "Delete Mode", className: "key key-backspace" }
  ],
  [
    { type: "special", text: "Caps", className: "key key-caps" },
    { type: "action", id: "CLOSE_TAB", fallbackText: "Close Tab" },
    { type: "action", id: "ROOT", fallbackText: "Go to Site Root" },
    { type: "action", id: "BACK", fallbackText: "Go Back" },
    { type: "action", id: "ACTIVATE", fallbackText: "Click Element" },
    { type: "action", id: "ACTIVATE_NEW_TAB_BACKGROUND", fallbackText: "Click New Tab Background" },
    { type: "action", id: "HIGHLIGHT", fallbackText: "Text Select" },
    { type: "action", id: "TAB_HISTORY", fallbackText: "History" },
    { type: "action", id: "TOGGLE_KEYBOARD_HELP", fallbackText: "KB Reference" },
    { type: "action", id: "OMNIBOX", fallbackText: "Omnibox" },
    { type: "action", id: "TOP_SITES", fallbackText: "Top Sites" },
    { type: "action", id: "OPEN_SETTINGS_POPOVER", fallbackText: "Settings" },
    { type: "special", text: "Enter", className: "key key-enter" }
  ],
  [
    { type: "special", text: "Shift", className: "key key-shift" },
    { type: "action", id: "PAGE_TOP", fallbackText: "Scroll To Top" },
    { type: "action", id: "PAGE_BOTTOM", fallbackText: "Scroll To Bottom" },
    { type: "action", id: "PAGE_UP_INSTANT", fallbackText: "Page Up" },
    { type: "action", id: "PAGE_DOWN_INSTANT", fallbackText: "Page Down" },
    { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
    { type: "action", id: "SCROLL_LINE", fallbackText: "Scroll Line" },
    { type: "action", id: "OPEN_MEDIA_LIBRARY", fallbackText: "Media Library" },
    { type: "key", text: "," },
    { type: "key", text: "." },
    { type: "key", text: "/" },
    { type: "special", text: "Shift", className: "key key-shift" }
  ]
]);
var KEYBOARD_UI_LAYOUT_LEFT = Object.freeze([
  [
    { type: "special", text: "Tab", className: "key key-tab" },
    { type: "key", text: "Q" },
    { type: "action", id: "PREVIEW_LINK_POPOVER", fallbackText: "Preview Link" },
    // W
    { type: "action", id: "COPY_HOVERED_IMAGE", fallbackText: "Copy Image" },
    // E
    { type: "action", id: "RECTANGLE_HIGHLIGHT", fallbackText: "Rectangle Select" },
    // R
    { type: "action", id: "SCROLL_LINE", fallbackText: "Scroll Line" },
    // T
    { type: "action", id: "NEW_TAB", fallbackText: "New Tab" },
    // Y
    { type: "action", id: "FORWARD", fallbackText: "Go Forward" },
    // U
    { type: "action", id: "OPEN_POPOVER", fallbackText: "Open Popover" },
    // I
    { type: "action", id: "TAB_RIGHT", fallbackText: "Tab Right" },
    // O
    { type: "action", id: "TAB_LEFT", fallbackText: "Tab Left" },
    // P
    { type: "key", text: "[" },
    { type: "key", text: "]" },
    { type: "action", id: "DELETE", fallbackText: "Delete Mode", className: "key key-backspace" }
  ],
  [
    { type: "special", text: "Caps", className: "key key-caps" },
    { type: "action", id: "TOP_SITES", fallbackText: "Top Sites" },
    // Utility keys on the left (to avoid colliding with right-hand cluster)
    { type: "action", id: "OMNIBOX", fallbackText: "Omnibox" },
    // S
    { type: "action", id: "TOGGLE_KEYBOARD_HELP", fallbackText: "KB Reference" },
    // D
    { type: "action", id: "TAB_HISTORY", fallbackText: "History" },
    // F
    { type: "action", id: "HIGHLIGHT", fallbackText: "Text Select" },
    // G
    { type: "action", id: "ACTIVATE_NEW_TAB_BACKGROUND", fallbackText: "Click New Tab Background" },
    // H
    { type: "action", id: "ACTIVATE", fallbackText: "Click Element" },
    // J
    { type: "action", id: "BACK", fallbackText: "Go Back" },
    // K
    { type: "action", id: "ROOT", fallbackText: "Go to Site Root" },
    // L
    { type: "action", id: "CLOSE_TAB", fallbackText: "Close Tab" },
    // ;
    { type: "action", id: "OPEN_SETTINGS_POPOVER", fallbackText: "Settings" },
    // '
    { type: "special", text: "Enter", className: "key key-enter" }
  ],
  [
    { type: "special", text: "Shift", className: "key key-shift" },
    { type: "key", text: "Z" },
    { type: "key", text: "X" },
    { type: "key", text: "C" },
    { type: "key", text: "V" },
    { type: "action", id: "PAGE_BOTTOM", fallbackText: "Scroll To Bottom" },
    // B
    { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
    // N
    { type: "action", id: "PAGE_DOWN_INSTANT", fallbackText: "Page Down" },
    // M
    { type: "action", id: "PAGE_UP_INSTANT", fallbackText: "Page Up" },
    // ,
    { type: "key", text: "." },
    { type: "action", id: "PAGE_TOP", fallbackText: "Scroll To Top" },
    // /
    { type: "special", text: "Shift", className: "key key-shift" }
  ]
]);
var BUILTIN_KEYBOARD_LAYOUTS = Object.freeze({
  "browsing-right": Object.freeze({
    id: "browsing-right",
    label: "Browsing: right-handed",
    description: "Full browsing layout. Mouse: right hand. Shortcuts primarily on the left.",
    assignments: ASSIGNMENTS_BROWSING_RIGHT,
    keyboardLayout: KEYBOARD_UI_LAYOUT_RIGHT
  }),
  "browsing-left": Object.freeze({
    id: "browsing-left",
    label: "Browsing: left-handed",
    description: "Full browsing layout. Mouse: left hand. Shortcuts primarily on the right.",
    assignments: ASSIGNMENTS_BROWSING_LEFT,
    keyboardLayout: KEYBOARD_UI_LAYOUT_LEFT
  }),
  "basic-navigation-right": Object.freeze({
    id: "basic-navigation-right",
    label: "Basic Navigation: right-handed",
    description: "Page scroll, click, tab switch, back/forward only.",
    assignments: ASSIGNMENTS_BASIC_NAVIGATION_RIGHT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_RIGHT,
      { ...ASSIGNMENTS_BROWSING_RIGHT, ...SYSTEM_LAYER_ASSIGNMENTS_RIGHT },
      BASIC_NAVIGATION_UI_ACTION_IDS
    )
  }),
  "basic-navigation-left": Object.freeze({
    id: "basic-navigation-left",
    label: "Basic Navigation: left-handed",
    description: "Page scroll, click, tab switch, back/forward only.",
    assignments: ASSIGNMENTS_BASIC_NAVIGATION_LEFT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_LEFT,
      { ...ASSIGNMENTS_BROWSING_LEFT, ...SYSTEM_LAYER_ASSIGNMENTS_LEFT },
      BASIC_NAVIGATION_UI_ACTION_IDS
    )
  }),
  "click-history-right": Object.freeze({
    id: "click-history-right",
    label: "Navigation: right-handed",
    description: "Click element, go back, and go forward only.",
    assignments: ASSIGNMENTS_CLICK_HISTORY_RIGHT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_RIGHT,
      { ...ASSIGNMENTS_BROWSING_RIGHT, ...SYSTEM_LAYER_ASSIGNMENTS_RIGHT },
      CLICK_HISTORY_UI_ACTION_IDS
    )
  }),
  "click-history-left": Object.freeze({
    id: "click-history-left",
    label: "Navigation: left-handed",
    description: "Click element, go back, and go forward only.",
    assignments: ASSIGNMENTS_CLICK_HISTORY_LEFT,
    keyboardLayout: projectKeyboardUiLayout(
      KEYBOARD_UI_LAYOUT_LEFT,
      { ...ASSIGNMENTS_BROWSING_LEFT, ...SYSTEM_LAYER_ASSIGNMENTS_LEFT },
      CLICK_HISTORY_UI_ACTION_IDS
    )
  })
});

// src/config/constants.js
var KEYBINDINGS = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID, DEFAULT_KEYBOARD_HANDEDNESS);
var SCROLL = Object.freeze({
  /** Legacy large page step (popover parent→iframe PAGE_UP/DOWN path) */
  PAGE_PX: 800,
  /** C / V: smaller step (default = prior 400px × 1.25) */
  HALF_PAGE_PX: 500,
  /**
   * Hold C / V: continuous rAF scroll speed (px/s). Instant per-frame deltas —
   * not CSS smooth — so overlapping animations cannot jitter.
   */
  HOLD_PX_PER_SEC: 1400,
  /**
   * Delay before continuous rAF starts after the first keydown. Keeps a quick
   * tap as a single configured step; holding past this (or first OS repeat)
   * engages continuous motion.
   */
  HOLD_RAF_START_MS: 120,
  /** Default CSS scroll-behavior for keyboard scrolling */
  BEHAVIOR: "smooth",
  /** Blur-in duration for Scroll To Top / Bottom "Fade" jump style */
  EDGE_JUMP_BLUR_MS: 140,
  /** Opaque cover transition before the instant jump */
  EDGE_JUMP_COVER_MS: 90,
  /** Soft destination reveal duration after the jump */
  EDGE_JUMP_REVEAL_MS: 160,
  /** Clear the veil after the destination reveal */
  EDGE_JUMP_CLEAR_MS: 140,
  /**
   * After the instant jump, keep the veil opaque until scroll position is
   * stable (or this timeout). Covers CSS `scroll-behavior: smooth` and
   * Lenis-style hijacks that keep interpolating after scrollTo returns.
   */
  EDGE_JUMP_SETTLE_MS: 480,
  /** Scroll Line: no scroll inside this radius from the origin dot */
  LINE_DEADZONE_PX: 12,
  /**
   * Scroll Line: ease-in power. 1 = linear, 2 = quadratic (gentle near the
   * dot, ramps harder toward the edge of the range).
   */
  LINE_CURVE_EXPONENT: 1.75,
  /** Scroll Line: offset beyond the dead zone that maps to max speed */
  LINE_CURVE_RANGE_PX: 360,
  /** Scroll Line: cap on each axis */
  LINE_MAX_PX_PER_SEC: 2400
});
var INSPECTOR_KIND = Object.freeze({
  DELETE: "delete",
  COLS: "cols",
  /** Cumulative element pick for Rectangle Select (Y) alternate mode */
  RECTANGLE_PICK: "rectangle_pick"
});
var ELEMENT_SELECT_AGGREGATES = Object.freeze([
  "table",
  "figure",
  "picture",
  "ul",
  "ol",
  "dl"
]);
var ELEMENT_SELECT_LANDMARKS = Object.freeze([
  "article",
  "section",
  "aside",
  "header",
  "footer",
  "main",
  "nav"
]);
var ELEMENT_SELECT_ATOMS = Object.freeze([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "blockquote",
  "pre",
  "li",
  "img",
  "video",
  "audio",
  "svg"
]);
var ELEMENT_SELECT_FRAGMENTS = Object.freeze([
  "a",
  "code",
  "label",
  "td",
  "th",
  "caption",
  "figcaption",
  "dt",
  "dd",
  "summary"
]);
var ELEMENT_SELECT_TAGS = Object.freeze([
  ...ELEMENT_SELECT_AGGREGATES,
  ...ELEMENT_SELECT_LANDMARKS,
  ...ELEMENT_SELECT_ATOMS,
  ...ELEMENT_SELECT_FRAGMENTS
]);
var CURSOR_MODE = Object.freeze({
  NO_CUSTOM_CURSORS: "NO-CUSTOM-CURSORS",
  CUSTOM_CURSORS: "CUSTOM-CURSORS"
});
var COLORS = {
  // Primary cursor colors
  FOCUS_GREEN: "rgba(0,180,0,0.95)",
  FOCUS_GREEN_BRIGHT: "rgba(0,128,0,0.95)",
  DELETE_RED: "rgba(220,0,0,0.95)",
  /** Cols Toggle accent (purple, distinct from delete red / highlight blue) */
  COLS_PURPLE: "rgba(156,39,176,0.95)",
  COLS_PURPLE_BRIGHT: "rgba(186,104,200,0.95)",
  HIGHLIGHT_BLUE: "rgba(0,120,255,0.95)",
  ORANGE: "#ff8c00",
  // Focus overlay (alternate) colors (used to visually distinguish DOM-hover targeting mode)
  FOCUS_BLUE: "rgba(33,150,243,0.95)",
  // Text and background colors
  TEXT_WHITE_PRIMARY: "rgba(255,255,255,0.95)",
  TEXT_WHITE_SECONDARY: "rgba(255,255,255,0.8)",
  TEXT_GREEN_BRIGHT: "#6ced2b",
  // Background colors
  MESSAGE_BG_BROWN: "#ad6007",
  MESSAGE_BG_GREEN: "#10911b",
  // Border and shadow colors
  ORANGE_BORDER: "rgba(255,140,0,0.4)",
  ORANGE_SHADOW: "rgba(255,140,0,0.45)",
  ORANGE_SHADOW_DARK: "rgba(255,140,0,0.8)",
  ORANGE_SHADOW_LIGHT: "rgba(255,140,0,0.3)",
  GREEN_SHADOW: "rgba(0,180,0,0.45)",
  GREEN_SHADOW_BRIGHT: "rgba(0,180,0,0.5)",
  BLUE_SHADOW: "rgba(33,150,243,0.35)",
  BLUE_SHADOW_BRIGHT: "rgba(33,150,243,0.45)",
  DELETE_SHADOW: "rgba(220,0,0,0.35)",
  DELETE_SHADOW_BRIGHT: "rgba(220,0,0,0.45)",
  COLS_SHADOW: "rgba(156,39,176,0.35)",
  COLS_SHADOW_BRIGHT: "rgba(156,39,176,0.5)",
  HIGHLIGHT_SHADOW: "rgba(0,120,255,0.35)",
  HIGHLIGHT_SHADOW_BRIGHT: "rgba(0,120,255,0.45)",
  BLACK_SHADOW: "rgba(40, 40, 40, 0.7)",
  // Ripple effect colors
  RIPPLE_GREEN: "rgba(0,200,0,0.35)",
  RIPPLE_GREEN_MID: "rgba(0,200,0,0.22)",
  RIPPLE_GREEN_TRANSPARENT: "rgba(0,200,0,0)",
  // Flash animation colors
  FLASH_GREEN: "rgba(0,255,0,1)",
  FLASH_GREEN_SHADOW: "rgba(0,255,0,0.8)",
  FLASH_GREEN_GLOW: "rgba(0,255,0,0.9)",
  /** URL actions (new tab, preview, popover) when the hover target has no URL */
  FLASH_DENIED: "rgba(255,140,0,1)",
  FLASH_DENIED_SHADOW: "rgba(255,140,0,0.85)",
  FLASH_DENIED_GLOW: "rgba(255,140,0,0.7)",
  // Image-copy pulse (distinct from green F-click pulse)
  IMAGE_COPY_FRAME: "rgba(33,150,243,0.95)",
  IMAGE_COPY_FRAME_SHADOW: "rgba(33,150,243,0.55)",
  IMAGE_COPY_FRAME_GLOW: "rgba(100,180,255,0.75)",
  IMAGE_COPY_FILL: "rgba(33,150,243,0.14)",
  IMAGE_COPY_FLASH: "rgba(255,255,255,0.45)",
  // Notification colors
  NOTIFICATION_SUCCESS: "#4CAF50",
  NOTIFICATION_ERROR: "#f44336",
  NOTIFICATION_WARNING: "#ff9800",
  NOTIFICATION_INFO: "#2196F3",
  NOTIFICATION_SHADOW: "rgba(0, 0, 0, 0.15)",
  // Text field glow
  TEXT_FIELD_GLOW: "rgba(255,165,0,0.8)",
  // Highlight selection colors
  HIGHLIGHT_SELECTION_BG: "rgba(0,120,255,0.3)",
  HIGHLIGHT_SELECTION_BORDER: "rgba(0,120,255,0.6)",
  // Font Info inspected-run outline (stroke, not Text Select fill)
  FONT_INFO_OUTLINE: "rgba(255, 193, 7, 0.95)",
  FONT_INFO_OUTLINE_SHADOW: "rgba(255, 193, 7, 0.45)",
  FONT_INFO_OUTLINE_FILL: "rgba(255, 193, 7, 0.08)",
  // Solid accents for ESC exit labels (distinct from translucent overlay borders)
  ORANGE_BG: "rgba(255, 165, 0, 0.9)",
  ORANGE_TEXT: "#fff",
  ORANGE_BORDER_SOLID: "#d35400",
  FOCUS_GREEN_BG: "rgba(46, 204, 113, 0.9)",
  FOCUS_GREEN_BG_T2: "rgba(46, 204, 113, 0.4)",
  FOCUS_GREEN_TEXT: "#fff",
  FOCUS_GREEN_SOLID: "#27ae60",
  FOCUS_BLUE_BG_T2: "rgba(33,150,243,0.25)"
};

// src/config/search-engines.js
var SEARCH_ENGINE_META = Object.freeze({
  brave: Object.freeze({
    id: "brave",
    label: "Brave",
    homeUrl: "https://search.brave.com/",
    searchUrlPrefix: "https://search.brave.com/search?q="
  }),
  google: Object.freeze({
    id: "google",
    label: "Google",
    homeUrl: "https://www.google.com/",
    searchUrlPrefix: "https://www.google.com/search?q="
  }),
  duckduckgo: Object.freeze({
    id: "duckduckgo",
    label: "DuckDuckGo",
    homeUrl: "https://duckduckgo.com/",
    searchUrlPrefix: "https://duckduckgo.com/?q="
  })
});
var DEFAULT_SEARCH_ENGINE_ID = (
  /** @type {SearchEngineId} */
  "brave"
);
var LAUNCHER_SEARCH_SITES = Object.freeze([
  Object.freeze({ title: "Google", url: "https://google.com", isDefault: true }),
  Object.freeze({ title: "Bing", url: "https://bing.com", isDefault: true }),
  Object.freeze({ title: "DuckDuckGo", url: "https://duckduckgo.com", isDefault: true }),
  Object.freeze({ title: "Yahoo", url: "https://yahoo.com", isDefault: true }),
  Object.freeze({ title: "Brave Search", url: "https://search.brave.com", isDefault: true }),
  Object.freeze({ title: "Ecosia", url: "https://ecosia.org", isDefault: true }),
  Object.freeze({ title: "Startpage", url: "https://startpage.com", isDefault: true }),
  Object.freeze({ title: "Yandex", url: "https://yandex.com", isDefault: true })
]);
function normalizeSearchEngineId(raw) {
  if (raw === "google" || raw === "duckduckgo" || raw === "brave") return raw;
  return DEFAULT_SEARCH_ENGINE_ID;
}

// themes/schema.js
var DEFAULT_THEME_ID = "dark-pro";
var THEME_IDS = Object.freeze([
  "dark-pro",
  "gray-metal-pro",
  "gx-er"
]);
var THEME_META = Object.freeze({
  "dark-pro": { name: "Dark Pro" },
  "gray-metal-pro": { name: "Gray Metal Pro" },
  "gx-er": { name: "GX-er" }
});
var PRO_SANS = "Helvetica, Arial, sans-serif";
var PRO_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
var TYPE_ROLES = Object.freeze([
  "display",
  "heading",
  "subhead",
  "body",
  "ui",
  "kbd",
  "mono",
  "caption"
]);
function createProTypeTokens(stacks = {}) {
  return {
    stacks: {
      display: stacks.display || PRO_SANS,
      heading: stacks.heading || PRO_SANS,
      subhead: stacks.subhead || PRO_SANS,
      body: stacks.body || PRO_SANS,
      ui: stacks.ui || PRO_SANS,
      kbd: stacks.kbd || PRO_MONO,
      mono: stacks.mono || PRO_MONO,
      caption: stacks.caption || PRO_SANS
    },
    size: {
      display: "22px",
      h1: "22px",
      h2: "16px",
      h3: "14px",
      body: "13px",
      ui: "12px",
      kbd: "10px",
      caption: "11px",
      code: "12px"
    },
    scale: "1.25",
    weight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700"
    },
    letterSpacing: {
      display: "0.02em",
      titlebar: "0.02em",
      ui: "normal"
    },
    textTransform: {
      display: "none",
      titlebar: "none"
    },
    lineHeight: {
      tight: "1.2",
      body: "1.35",
      prose: "1.55"
    }
  };
}
function createTitlebarChromeTokens(overrides = {}) {
  return {
    titleWeight: "600",
    iconDisplay: "none",
    iconSize: "12px",
    kbdTransform: "none",
    kbdTracking: "0.02em",
    ...overrides
  };
}
function createProRadiusTokens(overrides = {}) {
  return {
    none: "0px",
    xs: "2px",
    sm: "3px",
    md: "6px",
    lg: "10px",
    pill: "999px",
    panel: "3px",
    btn: "2px",
    field: "2px",
    key: "7px",
    plate: "14px",
    ...overrides
  };
}
var KEY_CLIP_NONE = "none";
var KEY_SHADE_BEVEL = "linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 18%, transparent 42%)";
function createKeyChromeTokens(overrides = {}) {
  return {
    shading: "bevel",
    border: "1px solid rgba(0, 0, 0, 0.4)",
    cornerMode: "radius",
    cutSize: "4px",
    ...overrides
  };
}
function keyClipPath(cutSize) {
  const s = cutSize || "4px";
  return `polygon(${s} 0, calc(100% - ${s}) 0, 100% ${s}, 100% calc(100% - ${s}), calc(100% - ${s}) 100%, ${s} 100%, 0 calc(100% - ${s}), 0 ${s})`;
}
function themeToCssVars(theme) {
  const t = theme && typeof theme === "object" ? theme : {};
  const type2 = t.type || createProTypeTokens();
  const stacks = type2.stacks || {};
  const size = type2.size || {};
  const weight = type2.weight || {};
  const ls = type2.letterSpacing || {};
  const tf = type2.textTransform || {};
  const lh = type2.lineHeight || {};
  const radius = t.radius || createProRadiusTokens();
  const color4 = t.color || {};
  const effect = t.effect || {};
  const shape = t.shape || { cornerMode: "radius", cutSize: "0px" };
  const keys = t.keys || createKeyChromeTokens();
  const keyCornerCut = (keys.cornerMode || "radius") === "cut";
  const icons = t.icons || {};
  const iconColor = icons.color || {};
  const vars = {
    "--kp-theme-id": String(t.id || DEFAULT_THEME_ID),
    "--kp-font-display": stacks.display || PRO_SANS,
    "--kp-font-heading": stacks.heading || PRO_SANS,
    "--kp-font-subhead": stacks.subhead || PRO_SANS,
    "--kp-font-body": stacks.body || PRO_SANS,
    "--kp-font-ui": stacks.ui || PRO_SANS,
    "--kp-font-kbd": stacks.kbd || PRO_MONO,
    "--kp-font-mono": stacks.mono || PRO_MONO,
    "--kp-font-caption": stacks.caption || PRO_SANS,
    "--kp-type-scale": String(type2.scale || "1"),
    "--kp-type-display-size": size.display || "22px",
    "--kp-type-h1-size": size.h1 || "22px",
    "--kp-type-h2-size": size.h2 || "16px",
    "--kp-type-h3-size": size.h3 || "14px",
    "--kp-type-body-size": size.body || "13px",
    "--kp-type-ui-size": size.ui || "12px",
    "--kp-type-kbd-size": size.kbd || "10px",
    "--kp-type-caption-size": size.caption || "11px",
    "--kp-type-code-size": size.code || "12px",
    "--kp-type-weight-regular": weight.regular || "400",
    "--kp-type-weight-medium": weight.medium || "500",
    "--kp-type-weight-semibold": weight.semibold || "600",
    "--kp-type-weight-bold": weight.bold || "700",
    "--kp-type-tracking-display": ls.display || "0.02em",
    "--kp-type-tracking-titlebar": ls.titlebar || "0.02em",
    "--kp-type-tracking-ui": ls.ui || "normal",
    "--kp-type-transform-display": tf.display || "none",
    "--kp-type-transform-titlebar": tf.titlebar || "none",
    "--kp-titlebar-title-weight": t.titlebar && t.titlebar.titleWeight || "600",
    "--kp-titlebar-icon-display": t.titlebar && t.titlebar.iconDisplay || "none",
    "--kp-titlebar-icon-size": t.titlebar && t.titlebar.iconSize || "12px",
    "--kp-kbd-transform": t.titlebar && t.titlebar.kbdTransform || "none",
    "--kp-kbd-tracking": t.titlebar && t.titlebar.kbdTracking || "0.02em",
    "--kp-type-leading-tight": lh.tight || "1.2",
    "--kp-type-leading-body": lh.body || "1.35",
    "--kp-type-leading-prose": lh.prose || "1.55",
    "--kp-radius-none": radius.none || "0px",
    "--kp-radius-xs": radius.xs || "2px",
    "--kp-radius-sm": radius.sm || "3px",
    "--kp-radius-md": radius.md || "6px",
    "--kp-radius-lg": radius.lg || "10px",
    "--kp-radius-pill": radius.pill || "999px",
    "--kp-radius-panel": radius.panel || "3px",
    "--kp-radius-btn": radius.btn || "2px",
    "--kp-radius-field": radius.field || "2px",
    "--kp-radius-key": radius.key || "7px",
    "--kp-radius-plate": radius.plate || "14px",
    "--kp-color-bg": color4.bg || "#0f0f10",
    "--kp-color-panel": color4.panel || "#232323",
    "--kp-color-panel-edge": color4.panelEdge || "#3a3a3a",
    "--kp-color-panel-edge-dark": color4.panelEdgeDark || "#111",
    "--kp-color-title-top": color4.titleTop || "#4c4c4c",
    "--kp-color-title-mid": color4.titleMid || "#353535",
    "--kp-color-title-bot": color4.titleBot || "#252525",
    "--kp-color-btn-top": color4.btnTop || "#4a4a4a",
    "--kp-color-btn-mid": color4.btnMid || "#343434",
    "--kp-color-btn-bot": color4.btnBot || "#2a2a2a",
    "--kp-color-lit-top": color4.litTop || "#5a7a9a",
    "--kp-color-lit-bot": color4.litBot || "#3a5570",
    "--kp-color-lit-edge": color4.litEdge || "#2a4a66",
    "--kp-color-accent": color4.accent || "#4a90c8",
    "--kp-color-accent-2": color4.accent2 || color4.accent || "#4a90c8",
    "--kp-color-fg": color4.fg || "#ddd",
    "--kp-color-fg-dim": color4.fgDim || "#aaa",
    "--kp-color-fg-mute": color4.fgMute || "#777",
    "--kp-color-field-bg": color4.fieldBg || "#141414",
    "--kp-color-field-edge": color4.fieldEdge || "#0a0a0a",
    "--kp-color-field-inset": color4.fieldInsetTop || "#333",
    "--kp-color-hover": color4.hover || "rgba(255,255,255,0.06)",
    "--kp-color-selected": color4.selected || "rgba(74,144,200,0.22)",
    "--kp-color-selected-text": color4.selectedText || "#e8f0f8",
    "--kp-color-focus-ring": color4.focusRing || "inset 0 0 0 1px rgba(74,144,200,0.55)",
    "--kp-color-kbd-fg": color4.kbdColor || color4.fg || "#ddd",
    "--kp-titlebar-bg": (() => {
      const titleGrad = `linear-gradient(180deg, ${color4.titleTop || "#4c4c4c"} 0%, ${color4.titleMid || "#353535"} 45%, ${color4.titleBot || "#252525"} 100%)`;
      const baked = String(effect.titlebarBg || "");
      const idx = baked.lastIndexOf("linear-gradient(180deg");
      return idx > 0 ? `${baked.slice(0, idx)}${titleGrad}` : titleGrad;
    })(),
    "--kp-titlebar-border": effect.titlebarBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-titlebar-shadow": effect.titlebarShadow || `0 1px 0 ${color4.panelEdge || "#3a3a3a"}`,
    "--kp-panel-bg": color4.panel || effect.panelBg || "#232323",
    "--kp-panel-border": effect.panelBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-panel-shadow": effect.panelShadow || `0 0 0 1px ${color4.panelEdge || "#3a3a3a"} inset, 0 0 0 1px rgba(190, 190, 190, 0.52), 0 0 10px rgba(255, 255, 255, 0.14), 0 16px 40px rgba(0,0,0,0.55)`,
    "--kp-btn-bg": effect.btnBg || `linear-gradient(180deg, ${color4.btnTop || "#4a4a4a"} 0%, ${color4.btnMid || "#343434"} 50%, ${color4.btnBot || "#2a2a2a"} 100%)`,
    "--kp-btn-border": effect.btnBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-btn-lit-bg": effect.btnLitBg || `linear-gradient(180deg, ${color4.litTop || "#5a7a9a"} 0%, ${color4.litBot || "#3a5570"} 100%)`,
    "--kp-btn-lit-border": effect.btnLitBorder || `1px solid ${color4.litEdge || "#2a4a66"}`,
    "--kp-field-bg": effect.fieldBg || (color4.fieldBg || "#141414"),
    "--kp-field-border": effect.fieldBorder || `1px solid ${color4.fieldEdge || "#0a0a0a"}`,
    "--kp-field-shadow": effect.fieldShadow || `inset 0 1px 0 ${color4.fieldInsetTop || "#333"}`,
    "--kp-kbd-bg": effect.kbdBg || (color4.fieldBg || "#141414"),
    "--kp-kbd-border": effect.kbdBorder || `1px solid ${color4.panelEdgeDark || "#111"}`,
    "--kp-kbd-shadow": effect.kbdShadow || "none",
    "--kp-backdrop-bg": effect.backdropBg || "rgba(0,0,0,0.35)",
    "--kp-backdrop-blur": effect.backdropBlur || "blur(6px)",
    "--kp-hatch-edit": effect.hatchEdit || "repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)",
    "--kp-hatch-edit-titlebar-bg": effect.hatchEditTitlebarBg || "linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)",
    "--kp-hatch-edit-body-bg": effect.hatchEditBodyBg || "#1a1c20",
    "--kp-scrollbar-thumb": color4.scrollbarThumb || "#4a4a4a",
    "--kp-scrollbar-thumb-hover": color4.scrollbarThumbHover || "#5c5c5c",
    "--kp-scrollbar-track": color4.scrollbarTrack || (color4.fieldBg || "#141414"),
    "--kp-corner-mode": shape.cornerMode || "radius",
    "--kp-cut-size": shape.cutSize || "0px",
    "--kp-key-shading": keys.shading || "bevel",
    "--kp-key-border": keys.border || "1px solid rgba(0, 0, 0, 0.4)",
    "--kp-key-corner-mode": keys.cornerMode || "radius",
    "--kp-key-cut-size": keys.cutSize || "4px",
    "--kp-key-clip": keyCornerCut ? keyClipPath(keys.cutSize || "4px") : KEY_CLIP_NONE,
    "--kp-key-effective-radius": keyCornerCut ? "0px" : radius.key || "7px",
    // Used by @supports (corner-shape: bevel) upgrade (clip-path baseline otherwise).
    "--kp-key-shape-radius": keyCornerCut ? keys.cutSize || "4px" : radius.key || "7px",
    "--kp-key-corner-shape": keyCornerCut ? "bevel" : "round",
    "--kp-key-sheen-opacity": (keys.shading || "bevel") === "flat" ? "0" : "1",
    "--kp-key-shade-layer": (keys.shading || "bevel") === "flat" ? "transparent" : KEY_SHADE_BEVEL,
    "--kp-icon-chrome": iconColor.chrome || (color4.fg || "#ddd"),
    "--kp-icon-keycap": iconColor.keycap || (color4.fg || "#0c1018"),
    "--kp-icon-accent": iconColor.accent || (color4.accent || "#4a90c8"),
    "--kp-key-icon": iconColor.keycap || "#0c1018"
  };
  return vars;
}
function cssVarsToBlock(vars, selector = ":host, :root, [data-kp-theme]") {
  const lines = Object.entries(vars || {}).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {
${lines.join("\n")}
}`;
}
function getTitlebarChromeCss() {
  return `
.kp-titlebar-icon {
  display: var(--kp-titlebar-icon-display, none);
  width: var(--kp-titlebar-icon-size, 12px);
  height: var(--kp-titlebar-icon-size, 12px);
  flex: 0 0 auto;
  background-color: var(--kp-icon-chrome, currentColor);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
[data-kp-titlebar-shortcut],
.kp-titlebar-kbd {
  font-family: var(--kp-font-kbd, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: var(--kp-type-kbd-size, 10px);
  font-weight: var(--kp-type-weight-regular, 400);
  line-height: 1.2;
  text-transform: var(--kp-kbd-transform, none);
  letter-spacing: var(--kp-kbd-tracking, 0.02em);
  padding: 1px 6px;
  border: var(--kp-kbd-border, 1px solid #111);
  border-radius: var(--kp-radius-btn, 2px);
  background: var(--kp-kbd-bg, #141414);
  color: var(--kp-color-kbd-fg, #ddd);
  box-shadow: var(--kp-kbd-shadow, none);
  box-sizing: border-box;
}
.kpv2-popover-titlebar,
[data-kp-popover-titlebar],
[data-kp-floating-keyboard-titlebar],
.kp-cfg-titlebar,
.kp-action-config-panel__titlebar,
.kp-procedure-result__titlebar,
.kp-practice-popover__header {
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
}
.kpv2-popover-titlebar-title,
[data-kp-floating-keyboard-title],
.kp-cfg-title,
.kp-action-config-panel__title,
.kp-procedure-result__title,
.kp-practice-popover__title {
  font-weight: var(--kp-titlebar-title-weight, 600);
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
  color: var(--kp-color-fg, inherit);
}
`.trim();
}
function getSelectMenuCss() {
  return `
.kp-select {
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  min-width: 0;
  box-sizing: border-box;
  font-family: var(--kp-font-ui, Helvetica, Arial, sans-serif);
}
.kp-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 2px 6px;
  border: var(--kp-field-border, 1px solid #0a0a0a);
  border-radius: var(--kp-radius-field, 2px);
  background: var(--kp-field-bg, #141414);
  color: var(--kp-color-fg, #ddd);
  box-shadow: var(--kp-field-shadow, none);
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
}
.kp-select--titlebar .kp-select-trigger {
  width: 190px;
  height: 22px;
  margin-left: 6px;
}
.kp-select-trigger:hover {
  background: color-mix(in srgb, var(--kp-color-hover, rgba(255,255,255,0.08)) 70%, var(--kp-field-bg, #141414));
}
.kp-select-trigger:focus-visible {
  outline: 1px solid var(--kp-color-focus-ring, var(--kp-color-accent, #4a90c8));
  outline-offset: 1px;
}
.kp-select.is-open .kp-select-trigger,
.kp-select-trigger[aria-expanded="true"] {
  border-color: var(--kp-color-accent, #4a90c8);
}
.kp-select-trigger-icon,
.kp-select-item-icon {
  display: none;
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  background-color: var(--kp-icon-chrome, currentColor);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
.kp-select-trigger-icon:not([hidden]),
.kp-select-item-icon:not([hidden]) {
  display: block;
}
.kp-select-trigger-label,
.kp-select-item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: normal;
}
.kp-select-chevron {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-left: 3.5px solid transparent;
  border-right: 3.5px solid transparent;
  border-top: 4px solid currentColor;
  opacity: 0.65;
  flex: 0 0 auto;
}
.kp-select-menu {
  position: fixed;
  /* Kill UA popover centering (inset 0 / margin auto) without locking longhands. */
  margin: 0;
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  width: max-content;
  height: fit-content;
  z-index: 2147483049;
  padding: 4px 0;
  min-width: 190px;
  max-width: min(360px, calc(100vw - 16px));
  max-height: min(320px, calc(100vh - 16px));
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
  border: var(--kp-panel-border, 1px solid #111);
  border-radius: var(--kp-radius-panel, 3px);
  background: var(--kp-panel-bg, #232323);
  box-shadow: var(--kp-panel-shadow, 0 8px 24px rgba(0,0,0,0.45));
  color: var(--kp-color-fg, #ddd);
  font-family: var(--kp-font-ui, Helvetica, Arial, sans-serif);
  font-size: 12px;
  line-height: 1.3;
  text-transform: none;
  letter-spacing: normal;
}
.kp-select-menu[data-kp-select-fallback="true"][hidden] {
  display: none !important;
}
.kp-select-group {
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--kp-color-fg-mute, #777);
  pointer-events: none;
  user-select: none;
}
.kp-select-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--kp-color-field-edge, #0a0a0a);
  border: 0;
  pointer-events: none;
}
.kp-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 5px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 400;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  box-sizing: border-box;
  outline: none;
}
.kp-select-item:hover,
.kp-select-item.is-active {
  background: var(--kp-color-hover, rgba(255,255,255,0.08));
  outline: 1px solid var(--kp-color-focus-ring, var(--kp-color-accent, #4a90c8));
  outline-offset: -1px;
}
.kp-select-item[aria-selected="true"] {
  background: var(--kp-color-selected, rgba(74, 144, 200, 0.28));
  color: var(--kp-color-selected-text, var(--kp-color-fg, #ddd));
}
.kp-select-item .kp-titlebar-kbd {
  margin-left: auto;
  flex-shrink: 0;
}
`.trim();
}
function getCutCornerCss() {
  return `
.kp-chrome-window {
  overflow: hidden;
}
.kp-chrome-window:not([data-kp-corner="cut"]) {
  border-radius: var(--kp-radius-panel, 3px);
}
/* Baseline (presentation): proven clip-path chamfer */
[data-kp-corner="cut"],
:host([data-kp-corner="cut"]),
.kp-chrome-window[data-kp-corner="cut"] {
  clip-path: polygon(
    var(--kp-cut-size, 8px) 0,
    calc(100% - var(--kp-cut-size, 8px)) 0,
    100% var(--kp-cut-size, 8px),
    100% calc(100% - var(--kp-cut-size, 8px)),
    calc(100% - var(--kp-cut-size, 8px)) 100%,
    var(--kp-cut-size, 8px) 100%,
    0 calc(100% - var(--kp-cut-size, 8px)),
    0 var(--kp-cut-size, 8px)
  );
  border-radius: 0;
}
/* Upgrade: native chamfer keeps stroke + shadow on the cut edge */
@supports (corner-shape: bevel) {
  [data-kp-corner="cut"],
  :host([data-kp-corner="cut"]),
  .kp-chrome-window[data-kp-corner="cut"] {
    clip-path: none !important;
    border-radius: var(--kp-cut-size, 8px) !important;
    corner-shape: bevel;
  }
}
`.trim();
}
function mergeTheme(base, overrides) {
  if (!overrides || typeof overrides !== "object") return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = mergeTheme(base[k], v);
    } else if (v !== void 0) {
      out[k] = v;
    }
  }
  return out;
}
function normalizeThemeId(raw) {
  const id = typeof raw === "string" ? raw.trim() : "";
  return THEME_IDS.includes(id) ? id : DEFAULT_THEME_ID;
}
function hasThemeOverrides(raw) {
  return !!(raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length > 0);
}

// src/utils/storage.js
function pickNewerStoredValue(syncVal, localVal) {
  const syncAt = syncVal && typeof syncVal === "object" ? Number(syncVal._updatedAt) : 0;
  const localAt = localVal && typeof localVal === "object" ? Number(localVal._updatedAt) : 0;
  const syncTs = Number.isFinite(syncAt) ? syncAt : 0;
  const localTs = Number.isFinite(localAt) ? localAt : 0;
  if (syncTs && localTs) return localTs >= syncTs ? localVal : syncVal;
  if (localTs && !syncTs) return localVal;
  if (syncTs && !localTs) return syncVal;
  return syncVal;
}
function resolveStoredAreas(syncVal, syncHas, localVal, localHas, defaultValue) {
  if (syncHas && localHas) return pickNewerStoredValue(syncVal, localVal);
  if (syncHas) return syncVal;
  if (localHas) return localVal;
  return defaultValue;
}
async function storageGetValue(key, defaultValue = void 0) {
  if (!key || typeof key !== "string") return defaultValue;
  let syncVal = void 0;
  let syncHas = false;
  try {
    if (chrome?.storage?.sync?.get) {
      const syncResult = await chrome.storage.sync.get([key]);
      if (syncResult && Object.prototype.hasOwnProperty.call(syncResult, key) && syncResult[key] !== void 0) {
        syncHas = true;
        syncVal = /** @type {T} */
        syncResult[key];
      }
    }
  } catch {
  }
  let localVal = void 0;
  let localHas = false;
  try {
    if (chrome?.storage?.local?.get) {
      const localResult = await chrome.storage.local.get([key]);
      if (localResult && Object.prototype.hasOwnProperty.call(localResult, key) && localResult[key] !== void 0) {
        localHas = true;
        localVal = /** @type {T} */
        localResult[key];
      }
    }
  } catch {
  }
  return (
    /** @type {T} */
    resolveStoredAreas(syncVal, syncHas, localVal, localHas, defaultValue)
  );
}
async function storageSetValue(key, value, opts = {}) {
  if (!key || typeof key !== "string") return false;
  const payload = { [key]: value };
  if (opts.includeTimestamp) {
    payload.timestamp = Date.now();
  }
  let wroteSync = false;
  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set(payload);
      wroteSync = true;
      if (!opts.dualWrite) return true;
    }
  } catch {
  }
  try {
    if (chrome?.storage?.local?.set) {
      await chrome.storage.local.set(payload);
      return true;
    }
  } catch {
  }
  return wroteSync;
}

// src/utils/platform.js
function isMacPlatform() {
  try {
    const uaPlatform = navigator.userAgentData?.platform;
    if (typeof uaPlatform === "string" && uaPlatform) {
      return uaPlatform === "macOS";
    }
  } catch {
  }
  try {
    const plat = String(navigator.platform || "");
    const ua = String(navigator.userAgent || "");
    return /^Mac/i.test(plat) || /Mac OS X/i.test(ua);
  } catch {
  }
  return false;
}

// src/modules/settings-manager.js
var SETTINGS_STORAGE_KEY = "kp_settings_v1";
var TEXT_FOCUS_STYLE_IDS = Object.freeze(
  /** @type {const} */
  [
    "left_edge",
    "background_tint"
  ]
);
var CLICK_EFFECT_IDS = Object.freeze(
  /** @type {const} */
  [
    "flash",
    "dash",
    "marquee",
    "scale",
    "none"
  ]
);
var DEFAULT_SETTINGS = Object.freeze({
  themeId: DEFAULT_THEME_ID,
  themeOverrides: Object.freeze({}),
  // Last theme whose clickDefaults were written into clickMode/cursorMode.
  // Empty means never synced (adopt the active theme's click defaults once).
  clickModeThemeId: "",
  searchEngine: DEFAULT_SEARCH_ENGINE_ID,
  cursorMode: CURSOR_MODE.NO_CUSTOM_CURSORS,
  // New model:
  // - keyboardLayoutFamilyId + keyboardHandedness are the user-facing selection.
  // - keyboardLayoutId is the resolved concrete implementation (kept for back-compat + early-inject).
  keyboardLayoutFamilyId: DEFAULT_KEYBOARD_LAYOUT_FAMILY_ID,
  keyboardHandedness: DEFAULT_KEYBOARD_HANDEDNESS,
  keyboardLayoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
  // Active layout selection for runtime + keyboard reference:
  // - 'builtin' uses the current built-in family + handedness selection.
  // - 'user:<layoutId>' uses a stored user layout (created/duplicated in Alt+C).
  currentKeyboardLayoutId: "builtin",
  // When true, the floating keyboard reference panel highlights keys on keydown/keyup.
  keyboardReferenceKeyFeedback: true,
  // When true, the floating keyboard reference panel includes the number row (1–0).
  // Default is off to keep the panel compact.
  keyboardReferenceShowNumberRow: false,
  // When true, the floating keyboard reference panel is titlebar-only (body hidden).
  keyboardReferenceCollapsed: false,
  // When true, Top Sites remounts on each page while left open (Keyboard Reference-style).
  topSitesPersistent: false,
  // Verbose console.log / debug / info in extension isolated worlds. Off in store builds.
  debugLogging: false,
  // Actions Library hierarchical table: expanded group keys (top-level open by default;
  // nested categories / parents start collapsed until the user opens them).
  actionsLibraryTableExpanded: Object.freeze(["functions", "macros", "macroKeys"]),
  // Actions Library placement instructions section (between titlebar and cards).
  actionsLibraryInstructionsExpanded: true,
  // Floating Control Strip (upper-left): visibility + collapsed (On/Off-only) state.
  controlStrip: Object.freeze({
    visible: true,
    collapsed: true
  }),
  // Dock / free positions for movable chrome (keyboard reference, control strip, …).
  // Anchors re-resolve on resize; free left/top reclamps inside the viewport margin.
  panelPositions: Object.freeze({
    keyboardReference: Object.freeze({ anchor: "bottom-left" }),
    controlStrip: Object.freeze({ anchor: "top-left" }),
    keyboardLayoutConfig: Object.freeze({ anchor: "middle-right" }),
    // Empty: first open stays viewport-centered until the user moves/resizes.
    topSites: Object.freeze({})
  }),
  // Per-key action settings (Keyboard Reference mode switches / config params).
  actionSettings: Object.freeze({
    RECTANGLE_HIGHLIGHT: Object.freeze({
      mode: "element",
      parameters: Object.freeze({})
    })
  }),
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      // Cursor SVG stroke width. Slider range: 1–12.
      lineWidth: 4,
      // Cursor size in pixels. Default is half of previous (was ~30px, now 15px).
      sizePixels: 10,
      // Gap between center and crosshair bars in pixels. 0 = intersecting lines, >0 = separate bars.
      gap: 6
    }),
    // Hover focus ring color (DOM-hover mode default is blue).
    focusColor: "blue",
    // When true, the focus rectangle can include a translucent fill (where applicable).
    overlayFillEnabled: false,
    // When true, draw a soft outer glow/shadow on the focus rectangle.
    overlayShadowEnabled: false,
    // Focus rectangle border thickness in px.
    rectangleThickness: 3,
    // F-key activation feedback on link-style targets (flash is the default).
    clickEffect: "flash",
    // When true, hovering a link glows matching green keys on the Keyboard Reference.
    // Off by default (opt-in via Settings → Click Mode).
    keyboardLinkHoverHints: false,
    // Default skip DOM outline (A); use in-target (B) then body-fixed (C).
    // Matches Shadow Root Debug “Auto B→C”.
    paintStrategy: "BC",
    // When true, dash A/B/C hover rings differently for paint-backend recognition.
    // Off by default (opt-in via Settings → Click Mode → Advanced).
    paintBackendDebugDashes: false,
    // Outward ring padding (px). Strategy A uses this as preferred outline-offset;
    // B/C expand their boxes by the same amount (A historically ~2px; B→C was 0).
    focusPadding: 2,
    // When a nested control shares the parent's destination (same URL), hover
    // the parent card instead. Different-destination children keep their own ring.
    skipForParent: true
  }),
  textMode: Object.freeze({
    cursorType: "t_square",
    // When true, show both labels: "Active text field" + "Press ESC to close".
    labelsEnabled: false,
    // Stroke thickness in px for orange text-mode rectangles.
    strokeThickness: 3,
    // How the focused text field is styled while in text mode.
    // left_edge: pulsating orange bar on the left inset edge (default).
    // background_tint: full-field orange wash (legacy).
    focusStyle: "left_edge",
    // Width of the left-edge pulse bar in px (when focusStyle is left_edge).
    leftEdgeWidth: 5
  }),
  scroll: Object.freeze({
    // C / V scroll distance in pixels (default = prior 400 × 1.25).
    halfPagePx: SCROLL.HALF_PAGE_PX,
    // Animation speed for keyboard scrolling: smooth (animated) or instant (jump).
    speed: SCROLL.BEHAVIOR === "smooth" ? "smooth" : "instant",
    // Middle mouse button → Scroll Line Function (empty page only). On by default on Mac.
    middleClickScrollLine: isMacPlatform(),
    // Scroll Line: skip horizontal-only landscape overflow (carousels).
    linePreferPortraitTargets: true
  })
});
function normalizeSearchEngine(raw) {
  return normalizeSearchEngineId(raw);
}
function normalizeCursorMode(raw) {
  if (raw === CURSOR_MODE.NO_CUSTOM_CURSORS || raw === CURSOR_MODE.CUSTOM_CURSORS) return raw;
  return DEFAULT_SETTINGS.cursorMode;
}
function normalizeThemeOverrides(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}
function normalizeBoolean(raw, fallback) {
  if (raw === true || raw === false) return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return !!fallback;
}
function normalizeCurrentKeyboardLayoutId(raw) {
  const v = String(raw || "").trim();
  if (!v) return DEFAULT_SETTINGS.currentKeyboardLayoutId;
  if (v === "builtin") return "builtin";
  if (v.startsWith("user:") && v.length > "user:".length) return v;
  return DEFAULT_SETTINGS.currentKeyboardLayoutId;
}
function normalizeNumber(raw, fallback, min, max) {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  const v = Number.isFinite(n) ? n : fallback;
  const clamped = Math.min(Math.max(v, min), max);
  return clamped;
}
function normalizeClickCursorType(raw) {
  if (raw === "crosshair" || raw === "native_arrow" || raw === "native_pointer") return raw;
  return DEFAULT_SETTINGS.clickMode.cursor.type;
}
function normalizeClickEffect(raw) {
  if (raw === "flash" || raw === "dash" || raw === "marquee" || raw === "scale" || raw === "none") {
    return raw;
  }
  return DEFAULT_SETTINGS.clickMode.clickEffect;
}
function normalizeTextCursorType(raw) {
  if (raw === "t_square" || raw === "crosshair") return raw;
  return DEFAULT_SETTINGS.textMode.cursorType;
}
function normalizeTextFocusStyle(raw) {
  if (raw === "left_edge" || raw === "background_tint") return raw;
  return DEFAULT_SETTINGS.textMode.focusStyle;
}
function normalizeFocusColor(raw) {
  if (raw === "blue" || raw === "green") return raw;
  return DEFAULT_SETTINGS.clickMode.focusColor;
}
function normalizePaintStrategy(raw) {
  if (raw === "auto" || raw === "BC") return raw;
  const upper = raw == null ? "" : String(raw).trim().toUpperCase();
  if (upper === "B->C" || upper === "B\u2192C" || upper === "AUTO_BC" || upper === "AUTO-BC" || upper === "AUTO B->C" || upper === "AUTO B\u2192C") {
    return "BC";
  }
  if (upper === "AUTO" || upper === "A->B->C" || upper === "A\u2192B\u2192C") {
    return "auto";
  }
  return DEFAULT_SETTINGS.clickMode.paintStrategy;
}
function normalizeClickMode(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  const storedCursor = stored.cursor && typeof stored.cursor === "object" ? stored.cursor : {};
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
    ),
    paintStrategy: normalizePaintStrategy(stored.paintStrategy),
    paintBackendDebugDashes: normalizeBoolean(
      stored.paintBackendDebugDashes,
      DEFAULT_SETTINGS.clickMode.paintBackendDebugDashes
    ),
    focusPadding: normalizeNumber(
      stored.focusPadding,
      DEFAULT_SETTINGS.clickMode.focusPadding,
      0,
      16
    ),
    skipForParent: normalizeBoolean(
      stored.skipForParent,
      DEFAULT_SETTINGS.clickMode.skipForParent
    )
  };
}
function normalizeTextMode(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
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
function normalizeScrollSpeed(raw) {
  if (raw === "smooth" || raw === "instant") return raw;
  if (raw === "auto") return "instant";
  return DEFAULT_SETTINGS.scroll.speed;
}
function normalizeScroll(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  const middleClickDefault = DEFAULT_SETTINGS.scroll.middleClickScrollLine;
  return {
    halfPagePx: normalizeNumber(
      stored.halfPagePx,
      DEFAULT_SETTINGS.scroll.halfPagePx,
      50,
      2e3
    ),
    speed: normalizeScrollSpeed(stored.speed),
    // Missing key → platform default (Mac on, others off). Explicit boolean is honored on any OS.
    middleClickScrollLine: normalizeBoolean(stored.middleClickScrollLine, middleClickDefault),
    linePreferPortraitTargets: normalizeBoolean(
      stored.linePreferPortraitTargets,
      DEFAULT_SETTINGS.scroll.linePreferPortraitTargets
    )
  };
}
function normalizeControlStrip(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  return {
    visible: normalizeBoolean(stored.visible, DEFAULT_SETTINGS.controlStrip.visible),
    collapsed: normalizeBoolean(stored.collapsed, DEFAULT_SETTINGS.controlStrip.collapsed)
  };
}
var PANEL_ANCHOR_IDS = /* @__PURE__ */ new Set([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);
function normalizePanelPositionEntry(raw, fallback) {
  const fb = fallback && typeof fallback === "object" ? fallback : {};
  if (!raw || typeof raw !== "object") {
    return {
      left: Number.isFinite(fb.left) ? fb.left : void 0,
      top: Number.isFinite(fb.top) ? fb.top : void 0,
      anchor: typeof fb.anchor === "string" ? fb.anchor : fb.anchor === null ? null : void 0
    };
  }
  const out = {};
  const left = typeof raw.left === "number" ? raw.left : typeof raw.left === "string" ? Number(raw.left) : NaN;
  const top = typeof raw.top === "number" ? raw.top : typeof raw.top === "string" ? Number(raw.top) : NaN;
  const width = typeof raw.width === "number" ? raw.width : typeof raw.width === "string" ? Number(raw.width) : NaN;
  const height = typeof raw.height === "number" ? raw.height : typeof raw.height === "string" ? Number(raw.height) : NaN;
  if (Number.isFinite(left)) out.left = left;
  if (Number.isFinite(top)) out.top = top;
  if (Number.isFinite(width) && width > 0) out.width = width;
  if (Number.isFinite(height) && height > 0) out.height = height;
  if (raw.anchor === null) {
    out.anchor = null;
  } else if (typeof raw.anchor === "string" && PANEL_ANCHOR_IDS.has(raw.anchor.trim())) {
    out.anchor = raw.anchor.trim();
  } else if (typeof fb.anchor === "string" && !Number.isFinite(left) && !Number.isFinite(top)) {
    out.anchor = fb.anchor;
  }
  if (out.left === void 0 && out.top === void 0 && out.anchor === void 0) {
    return {
      left: Number.isFinite(fb.left) ? fb.left : void 0,
      top: Number.isFinite(fb.top) ? fb.top : void 0,
      anchor: typeof fb.anchor === "string" ? fb.anchor : fb.anchor === null ? null : void 0
    };
  }
  return out;
}
function normalizePanelPositions(raw) {
  const stored = raw && typeof raw === "object" ? raw : {};
  return {
    keyboardReference: normalizePanelPositionEntry(
      stored.keyboardReference,
      DEFAULT_SETTINGS.panelPositions.keyboardReference
    ),
    controlStrip: normalizePanelPositionEntry(
      stored.controlStrip,
      DEFAULT_SETTINGS.panelPositions.controlStrip
    ),
    keyboardLayoutConfig: normalizePanelPositionEntry(
      stored.keyboardLayoutConfig,
      DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig
    ),
    topSites: normalizePanelPositionEntry(
      stored.topSites,
      DEFAULT_SETTINGS.panelPositions.topSites
    )
  };
}
function normalizeStringIdList(raw, fallback) {
  const fb = Array.isArray(fallback) ? [...fallback] : [];
  if (!Array.isArray(raw)) return fb;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
function normalizeActionsLibraryTableExpanded(raw) {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_SETTINGS.actionsLibraryTableExpanded];
  }
  return normalizeStringIdList(raw, DEFAULT_SETTINGS.actionsLibraryTableExpanded);
}
function normalizeActionSettings(raw) {
  const defaults = DEFAULT_SETTINGS.actionSettings || {};
  const stored = raw && typeof raw === "object" ? raw : {};
  const out = {};
  const keys = /* @__PURE__ */ new Set([...Object.keys(defaults), ...Object.keys(stored)]);
  for (const actionId of keys) {
    const fb = defaults[actionId] && typeof defaults[actionId] === "object" ? defaults[actionId] : {};
    const entry = stored[actionId] && typeof stored[actionId] === "object" ? stored[actionId] : {};
    const mode = typeof entry.mode === "string" && entry.mode ? entry.mode : typeof fb.mode === "string" ? fb.mode : void 0;
    const parameters = {
      ...fb.parameters && typeof fb.parameters === "object" ? fb.parameters : {},
      ...entry.parameters && typeof entry.parameters === "object" ? entry.parameters : {}
    };
    out[actionId] = { mode, parameters };
  }
  return out;
}
async function getSettings() {
  try {
    let stored = await storageGetValue(SETTINGS_STORAGE_KEY, null);
    if (!stored || typeof stored !== "object") stored = {};
    let familyId = normalizeKeyboardLayoutFamilyId(stored?.keyboardLayoutFamilyId);
    let handedness = normalizeKeyboardHandedness(stored?.keyboardHandedness);
    const hasNewFields = Object.prototype.hasOwnProperty.call(stored || {}, "keyboardLayoutFamilyId") || Object.prototype.hasOwnProperty.call(stored || {}, "keyboardHandedness");
    if (!hasNewFields) {
      const inferred = inferFamilyAndHandednessFromLayoutId(stored?.keyboardLayoutId);
      familyId = normalizeKeyboardLayoutFamilyId(inferred.familyId);
      handedness = normalizeKeyboardHandedness(inferred.handedness);
    }
    const resolvedLayoutId = resolveKeyboardLayoutId({ familyId, handedness });
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      themeId: normalizeThemeId(stored?.themeId),
      themeOverrides: normalizeThemeOverrides(stored?.themeOverrides),
      clickModeThemeId: typeof stored?.clickModeThemeId === "string" && stored.clickModeThemeId.trim() ? normalizeThemeId(stored.clickModeThemeId) : "",
      searchEngine: normalizeSearchEngine(stored?.searchEngine),
      cursorMode: normalizeCursorMode(stored?.cursorMode),
      keyboardLayoutFamilyId: familyId,
      keyboardHandedness: handedness,
      keyboardLayoutId: resolvedLayoutId,
      currentKeyboardLayoutId: normalizeCurrentKeyboardLayoutId(stored?.currentKeyboardLayoutId),
      keyboardReferenceKeyFeedback: normalizeBoolean(
        stored?.keyboardReferenceKeyFeedback,
        DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
      ),
      keyboardReferenceShowNumberRow: normalizeBoolean(
        stored?.keyboardReferenceShowNumberRow,
        DEFAULT_SETTINGS.keyboardReferenceShowNumberRow
      ),
      keyboardReferenceCollapsed: normalizeBoolean(
        stored?.keyboardReferenceCollapsed,
        DEFAULT_SETTINGS.keyboardReferenceCollapsed
      ),
      topSitesPersistent: normalizeBoolean(
        stored?.topSitesPersistent,
        DEFAULT_SETTINGS.topSitesPersistent
      ),
      debugLogging: normalizeBoolean(
        stored?.debugLogging,
        DEFAULT_SETTINGS.debugLogging
      ),
      actionsLibraryTableExpanded: normalizeActionsLibraryTableExpanded(
        stored?.actionsLibraryTableExpanded
      ),
      actionsLibraryInstructionsExpanded: normalizeBoolean(
        stored?.actionsLibraryInstructionsExpanded,
        DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded
      ),
      controlStrip: normalizeControlStrip(stored?.controlStrip),
      panelPositions: normalizePanelPositions(stored?.panelPositions),
      actionSettings: normalizeActionSettings(stored?.actionSettings),
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
        controlStrip: { ...DEFAULT_SETTINGS.panelPositions.controlStrip },
        keyboardLayoutConfig: { ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig },
        topSites: { ...DEFAULT_SETTINGS.panelPositions.topSites }
      },
      actionSettings: normalizeActionSettings(null),
      clickMode: { ...DEFAULT_SETTINGS.clickMode, cursor: { ...DEFAULT_SETTINGS.clickMode.cursor } },
      textMode: { ...DEFAULT_SETTINGS.textMode },
      scroll: { ...DEFAULT_SETTINGS.scroll },
      actionsLibraryTableExpanded: [...DEFAULT_SETTINGS.actionsLibraryTableExpanded],
      actionsLibraryInstructionsExpanded: DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded,
      themeId: DEFAULT_THEME_ID,
      themeOverrides: {},
      clickModeThemeId: ""
    };
  }
}
async function setSettings(partial) {
  const current = await getSettings();
  const p = partial && typeof partial === "object" ? partial : {};
  const pPositions = p.panelPositions && typeof p.panelPositions === "object" ? p.panelPositions : null;
  const next = {
    ...current,
    ...p,
    controlStrip: {
      ...current.controlStrip,
      ...p.controlStrip && typeof p.controlStrip === "object" ? p.controlStrip : {}
    },
    panelPositions: {
      keyboardReference: {
        ...current.panelPositions.keyboardReference,
        ...pPositions?.keyboardReference && typeof pPositions.keyboardReference === "object" ? pPositions.keyboardReference : {}
      },
      controlStrip: {
        ...current.panelPositions.controlStrip,
        ...pPositions?.controlStrip && typeof pPositions.controlStrip === "object" ? pPositions.controlStrip : {}
      },
      keyboardLayoutConfig: {
        ...current.panelPositions.keyboardLayoutConfig || DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig,
        ...pPositions?.keyboardLayoutConfig && typeof pPositions.keyboardLayoutConfig === "object" ? pPositions.keyboardLayoutConfig : {}
      },
      topSites: {
        ...current.panelPositions.topSites || DEFAULT_SETTINGS.panelPositions.topSites,
        ...pPositions?.topSites && typeof pPositions.topSites === "object" ? pPositions.topSites : {}
      }
    },
    clickMode: {
      ...current.clickMode,
      ...p.clickMode && typeof p.clickMode === "object" ? p.clickMode : {},
      cursor: {
        ...current.clickMode.cursor,
        ...p.clickMode && typeof p.clickMode === "object" && p.clickMode.cursor && typeof p.clickMode.cursor === "object" ? p.clickMode.cursor : {}
      }
    },
    textMode: {
      ...current.textMode,
      ...p.textMode && typeof p.textMode === "object" ? p.textMode : {}
    },
    scroll: {
      ...current.scroll,
      ...p.scroll && typeof p.scroll === "object" ? p.scroll : {}
    },
    actionSettings: (() => {
      const merged = { ...current.actionSettings || {} };
      const patch = p.actionSettings && typeof p.actionSettings === "object" ? p.actionSettings : {};
      for (const [id, entry] of Object.entries(patch)) {
        const prev = merged[id] && typeof merged[id] === "object" ? merged[id] : {};
        const next2 = entry && typeof entry === "object" ? entry : {};
        merged[id] = {
          ...prev,
          ...next2,
          parameters: {
            ...prev.parameters && typeof prev.parameters === "object" ? prev.parameters : {},
            ...next2.parameters && typeof next2.parameters === "object" ? next2.parameters : {}
          }
        };
      }
      return normalizeActionSettings(merged);
    })()
  };
  next.searchEngine = normalizeSearchEngine(next.searchEngine);
  next.cursorMode = normalizeCursorMode(next.cursorMode);
  next.themeId = normalizeThemeId(next.themeId);
  next.themeOverrides = normalizeThemeOverrides(next.themeOverrides);
  next.clickModeThemeId = typeof next.clickModeThemeId === "string" && next.clickModeThemeId.trim() ? normalizeThemeId(next.clickModeThemeId) : "";
  const callerSetLayoutId = Object.prototype.hasOwnProperty.call(p, "keyboardLayoutId");
  if (callerSetLayoutId) {
    const inferred = inferFamilyAndHandednessFromLayoutId(p?.keyboardLayoutId);
    next.keyboardLayoutFamilyId = normalizeKeyboardLayoutFamilyId(inferred.familyId);
    next.keyboardHandedness = normalizeKeyboardHandedness(inferred.handedness);
    next.keyboardLayoutId = normalizeKeyboardLayoutId(p?.keyboardLayoutId);
  } else {
    next.keyboardLayoutFamilyId = normalizeKeyboardLayoutFamilyId(next.keyboardLayoutFamilyId);
    next.keyboardHandedness = normalizeKeyboardHandedness(next.keyboardHandedness);
    next.keyboardLayoutId = resolveKeyboardLayoutId({
      familyId: next.keyboardLayoutFamilyId,
      handedness: next.keyboardHandedness
    });
  }
  next.currentKeyboardLayoutId = normalizeCurrentKeyboardLayoutId(next.currentKeyboardLayoutId);
  next.keyboardReferenceKeyFeedback = normalizeBoolean(
    next.keyboardReferenceKeyFeedback,
    DEFAULT_SETTINGS.keyboardReferenceKeyFeedback
  );
  next.keyboardReferenceShowNumberRow = normalizeBoolean(
    next.keyboardReferenceShowNumberRow,
    DEFAULT_SETTINGS.keyboardReferenceShowNumberRow
  );
  next.keyboardReferenceCollapsed = normalizeBoolean(
    next.keyboardReferenceCollapsed,
    DEFAULT_SETTINGS.keyboardReferenceCollapsed
  );
  next.topSitesPersistent = normalizeBoolean(
    next.topSitesPersistent,
    DEFAULT_SETTINGS.topSitesPersistent
  );
  next.debugLogging = normalizeBoolean(
    next.debugLogging,
    DEFAULT_SETTINGS.debugLogging
  );
  next.actionsLibraryTableExpanded = normalizeActionsLibraryTableExpanded(
    next.actionsLibraryTableExpanded
  );
  next.actionsLibraryInstructionsExpanded = normalizeBoolean(
    next.actionsLibraryInstructionsExpanded,
    DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded
  );
  next.controlStrip = normalizeControlStrip(next.controlStrip);
  next.panelPositions = normalizePanelPositions(next.panelPositions);
  next.actionSettings = normalizeActionSettings(next.actionSettings);
  next.clickMode = normalizeClickMode(next.clickMode);
  next.textMode = normalizeTextMode(next.textMode);
  next.scroll = normalizeScroll(next.scroll);
  next._updatedAt = Date.now();
  await storageSetValue(SETTINGS_STORAGE_KEY, next, { dualWrite: true });
  return next;
}
async function resetAllSettings() {
  const next = {
    ...DEFAULT_SETTINGS,
    themeOverrides: {},
    controlStrip: { ...DEFAULT_SETTINGS.controlStrip },
    panelPositions: {
      keyboardReference: { ...DEFAULT_SETTINGS.panelPositions.keyboardReference },
      controlStrip: { ...DEFAULT_SETTINGS.panelPositions.controlStrip },
      keyboardLayoutConfig: { ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig },
      topSites: { ...DEFAULT_SETTINGS.panelPositions.topSites }
    },
    actionSettings: normalizeActionSettings(null),
    clickMode: {
      ...DEFAULT_SETTINGS.clickMode,
      cursor: { ...DEFAULT_SETTINGS.clickMode.cursor }
    },
    textMode: { ...DEFAULT_SETTINGS.textMode },
    scroll: { ...DEFAULT_SETTINGS.scroll },
    actionsLibraryTableExpanded: [...DEFAULT_SETTINGS.actionsLibraryTableExpanded],
    actionsLibraryInstructionsExpanded: DEFAULT_SETTINGS.actionsLibraryInstructionsExpanded,
    _updatedAt: Date.now()
  };
  await storageSetValue(SETTINGS_STORAGE_KEY, next, { dualWrite: true });
  return getSettings();
}

// themes/chrome-recipes.js
var METAL_SPECULAR = "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 28%, transparent 55%)";
function createDarkProColor() {
  return {
    bg: "#0f0f10",
    panel: "#232323",
    panelEdge: "#3a3a3a",
    panelEdgeDark: "#111",
    titleTop: "#4c4c4c",
    titleMid: "#353535",
    titleBot: "#252525",
    btnTop: "#4a4a4a",
    btnMid: "#343434",
    btnBot: "#2a2a2a",
    litTop: "#5a7a9a",
    litBot: "#3a5570",
    litEdge: "#2a4a66",
    accent: "#4a90c8",
    accent2: "#4a90c8",
    fg: "#ddd",
    fgDim: "#aaa",
    fgMute: "#777",
    fieldBg: "#141414",
    fieldEdge: "#0a0a0a",
    fieldInsetTop: "#333",
    hover: "rgba(255,255,255,0.06)",
    selected: "rgba(74,144,200,0.22)",
    selectedText: "#e8f0f8",
    focusRing: "inset 0 0 0 1px rgba(74,144,200,0.55)",
    kbdColor: "#ddd",
    scrollbarThumb: "#4a4a4a",
    scrollbarThumbHover: "#5c5c5c",
    scrollbarTrack: "#141414"
  };
}
function createDarkProEffect(c) {
  return {
    titlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: `1px solid ${c.panelEdgeDark}`,
    titlebarShadow: `0 1px 0 ${c.panelEdge}`,
    panelBg: c.panel,
    panelBorder: `1px solid ${c.panelEdgeDark}`,
    panelShadow: `0 0 0 1px ${c.panelEdge} inset, 0 0 0 1px rgba(190, 190, 190, 0.52), 0 0 10px rgba(255, 255, 255, 0.14), 0 16px 40px rgba(0,0,0,0.55)`,
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: `1px solid ${c.panelEdgeDark}`,
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: `1px solid ${c.fieldEdge}`,
    fieldShadow: `inset 0 1px 0 ${c.fieldInsetTop}`,
    kbdBg: c.fieldBg,
    kbdBorder: `1px solid ${c.panelEdgeDark}`,
    kbdShadow: "none",
    backdropBg: "rgba(0,0,0,0.35)",
    backdropBlur: "blur(6px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: "linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)",
    hatchEditBodyBg: "#1a1c20"
  };
}
function createMetalColor() {
  return {
    bg: "#6e6e6e",
    panel: "#838383",
    panelEdge: "rgba(190,190,190,0.48)",
    panelEdgeDark: "rgba(42,52,62,0.92)",
    titleTop: "#b0b0b0",
    titleMid: "#929292",
    titleBot: "#787878",
    btnTop: "#c2c2c2",
    btnMid: "#9e9e9e",
    btnBot: "#868686",
    litTop: "#7aa0c0",
    litBot: "#4a7090",
    litEdge: "#3a5a78",
    accent: "#3a6a94",
    accent2: "#3a6a94",
    fg: "#1c1c1c",
    fgDim: "rgba(28,28,28,0.72)",
    fgMute: "rgba(28,28,28,0.55)",
    fieldBg: "#9a9a9a",
    fieldEdge: "#4a4a4a",
    fieldInsetTop: "rgba(255,255,255,0.35)",
    hover: "rgba(255,255,255,0.22)",
    selected: "rgba(58,106,148,0.28)",
    selectedText: "#0e1a24",
    focusRing: "inset 0 0 0 1px rgba(58,106,148,0.55)",
    kbdColor: "#141414",
    scrollbarThumb: "#a8a8a8",
    scrollbarThumbHover: "#b5b5b5",
    scrollbarTrack: "#747474"
  };
}
function createMetalEffect(c) {
  return {
    titlebarBg: `${METAL_SPECULAR}, linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: "1px solid #4a4a4a",
    titlebarShadow: "0 1px 0 rgba(255,255,255,0.35)",
    panelBg: `${METAL_SPECULAR}, linear-gradient(180deg, #9a9a9a 0%, #838383 48%, #707070 100%)`,
    panelBorder: "1px solid rgba(42,52,62,0.92)",
    panelShadow: "0 0 0 1px rgba(255,255,255,0.28) inset, 0 0 0 1px rgba(190,190,190,0.48), 0 0 10px rgba(255,255,255,0.12), 0 16px 40px rgba(0,0,0,0.45)",
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: "1px solid #4a4a4a",
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: "1px solid #4a4a4a",
    fieldShadow: "inset 0 1px 0 rgba(255,255,255,0.40)",
    kbdBg: "linear-gradient(180deg, #e4e4e4 0%, #c8c8c8 45%, #b0b0b0 55%, #9a9a9a 100%)",
    kbdBorder: "1px solid #3d3d3d",
    kbdShadow: "0 1px 0 rgba(255,255,255,0.72) inset, 0 -1px 0 rgba(0,0,0,0.28) inset, 0 1px 2px rgba(0,0,0,0.32)",
    backdropBg: "rgba(40,40,40,0.35)",
    backdropBlur: "blur(6px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(24, 24, 24, 0.28) 0px, rgba(24, 24, 24, 0.28) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: `${METAL_SPECULAR}, linear-gradient(180deg, #b8b8b8 0%, #9a9a9a 45%, #808080 100%)`,
    hatchEditBodyBg: "#8a8a8a"
  };
}
function createGxColor() {
  return {
    bg: "#0a0a0c",
    panel: "#16161a",
    panelEdge: "#2a2a32",
    panelEdgeDark: "#050506",
    titleTop: "#2c2c34",
    titleMid: "#1c1c22",
    titleBot: "#121216",
    btnTop: "#3a3a44",
    btnMid: "#26262e",
    btnBot: "#1a1a20",
    litTop: "#00e5ff",
    litBot: "#0088aa",
    litEdge: "#006688",
    accent: "#00e5ff",
    accent2: "#ff2d95",
    fg: "#e8e8ef",
    fgDim: "#9aa0b0",
    fgMute: "#6a7080",
    fieldBg: "#0c0c10",
    fieldEdge: "#000",
    fieldInsetTop: "#333344",
    hover: "rgba(0,229,255,0.08)",
    selected: "rgba(0,229,255,0.18)",
    selectedText: "#f0ffff",
    focusRing: "inset 0 0 0 1px rgba(0,229,255,0.55)",
    kbdColor: "#00e5ff",
    scrollbarThumb: "#3a3a44",
    scrollbarThumbHover: "#00e5ff",
    scrollbarTrack: "#0c0c10"
  };
}
function createGxEffect(c) {
  return {
    titlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    titlebarBorder: `1px solid ${c.panelEdgeDark}`,
    titlebarShadow: `0 1px 0 ${c.accent}33`,
    panelBg: `linear-gradient(180deg, #1c1c22 0%, ${c.panel} 48%, #101014 100%)`,
    panelBorder: `1px solid ${c.panelEdgeDark}`,
    panelShadow: `0 0 0 1px ${c.panelEdge} inset, 0 0 0 1px rgba(0, 229, 255, 0.22), 0 0 14px rgba(0, 229, 255, 0.12), 0 16px 40px rgba(0,0,0,0.65)`,
    btnBg: `linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 50%, ${c.btnBot} 100%)`,
    btnBorder: `1px solid ${c.panelEdgeDark}`,
    btnLitBg: `linear-gradient(180deg, ${c.litTop} 0%, ${c.litBot} 100%)`,
    btnLitBorder: `1px solid ${c.litEdge}`,
    fieldBg: c.fieldBg,
    fieldBorder: `1px solid ${c.fieldEdge}`,
    fieldShadow: `inset 0 1px 0 ${c.fieldInsetTop}`,
    kbdBg: "rgba(0, 229, 255, 0.08)",
    kbdBorder: `1px solid ${c.accent}`,
    kbdShadow: `0 0 0 1px ${c.accent}55, 0 0 8px ${c.accent}44`,
    backdropBg: "rgba(0,0,0,0.5)",
    backdropBlur: "blur(8px)",
    hatchEdit: "repeating-linear-gradient(-45deg, rgba(0, 229, 255, 0.16) 0px, rgba(0, 229, 255, 0.16) 1px, transparent 1px, transparent 7px)",
    hatchEditTitlebarBg: `linear-gradient(180deg, ${c.titleTop} 0%, ${c.titleMid} 45%, ${c.titleBot} 100%)`,
    hatchEditBodyBg: "#101014"
  };
}

// themes/click-defaults.js
var NO_CUSTOM = "NO-CUSTOM-CURSORS";
var DARK_PRO_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 4,
      sizePixels: 10,
      gap: 6
    }),
    focusColor: "blue",
    overlayFillEnabled: false,
    overlayShadowEnabled: false,
    rectangleThickness: 3,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2,
    skipForParent: true
  })
});
var GRAY_METAL_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 5,
      sizePixels: 12,
      gap: 6
    }),
    focusColor: "blue",
    overlayFillEnabled: false,
    overlayShadowEnabled: false,
    rectangleThickness: 4,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2,
    skipForParent: true
  })
});
var GX_ER_CLICK_DEFAULTS = Object.freeze({
  cursorMode: NO_CUSTOM,
  clickMode: Object.freeze({
    cursor: Object.freeze({
      type: "crosshair",
      lineWidth: 3,
      sizePixels: 14,
      gap: 8
    }),
    focusColor: "green",
    overlayFillEnabled: false,
    overlayShadowEnabled: true,
    rectangleThickness: 3,
    clickEffect: "flash",
    keyboardLinkHoverHints: false,
    paintStrategy: "BC",
    focusPadding: 2,
    skipForParent: true
  })
});

// themes/dark-pro/theme.js
var color = createDarkProColor();
var metalColor = createMetalColor();
var DARK_PRO_THEME = Object.freeze({
  id: "dark-pro",
  meta: Object.freeze({ name: "Dark Pro" }),
  type: createProTypeTokens(),
  titlebar: createTitlebarChromeTokens(),
  keys: createKeyChromeTokens(),
  radius: createProRadiusTokens(),
  color,
  effect: createDarkProEffect(color),
  shape: Object.freeze({ cornerMode: "radius", cutSize: "0px" }),
  icons: Object.freeze({
    pack: "dark-pro",
    fallbackPack: "shared",
    overrides: Object.freeze({}),
    color: Object.freeze({
      chrome: color.fg,
      keycap: "#0c1018",
      accent: color.accent
    })
  }),
  clickDefaults: DARK_PRO_CLICK_DEFAULTS,
  surfaces: Object.freeze({
    onboarding: Object.freeze({
      color: metalColor,
      effect: createMetalEffect(metalColor),
      icons: Object.freeze({
        color: Object.freeze({
          chrome: metalColor.fg,
          keycap: "#1c1c1c",
          accent: metalColor.accent
        })
      })
    })
  })
});

// themes/gray-metal-pro/theme.js
var color2 = createMetalColor();
var GRAY_METAL_PRO_THEME = Object.freeze({
  id: "gray-metal-pro",
  meta: Object.freeze({ name: "Gray Metal Pro" }),
  type: createProTypeTokens({
    ui: "Helvetica, Arial, sans-serif"
  }),
  titlebar: createTitlebarChromeTokens(),
  keys: createKeyChromeTokens(),
  radius: createProRadiusTokens({ panel: "3px", btn: "2px" }),
  color: color2,
  effect: createMetalEffect(color2),
  shape: Object.freeze({ cornerMode: "radius", cutSize: "0px" }),
  icons: Object.freeze({
    pack: "gray-metal-pro",
    fallbackPack: "shared",
    overrides: Object.freeze({}),
    color: Object.freeze({
      chrome: color2.fg,
      keycap: "#1c1c1c",
      accent: color2.accent
    })
  }),
  clickDefaults: GRAY_METAL_CLICK_DEFAULTS
});

// themes/gx-er/theme.js
var color3 = createGxColor();
var type = createProTypeTokens({
  display: "'ROBOTECHGPRegular', 'TitilliumText', Helvetica, Arial, sans-serif",
  heading: "'Cubellan', 'TitilliumText', Helvetica, Arial, sans-serif",
  subhead: "'TitilliumText', Helvetica, Arial, sans-serif",
  body: "'Ezarion', 'Dosis', Helvetica, Arial, sans-serif",
  ui: "'TitilliumText', Helvetica, Arial, sans-serif",
  kbd: "'Dosis', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  mono: "'Dosis', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  caption: "'Ezarion', Helvetica, Arial, sans-serif"
});
type.letterSpacing = {
  display: "0.08em",
  titlebar: "0.06em",
  ui: "0.02em"
};
type.textTransform = {
  display: "uppercase",
  titlebar: "uppercase"
};
var GX_ER_THEME = Object.freeze({
  id: "gx-er",
  meta: Object.freeze({ name: "GX-er" }),
  type,
  titlebar: createTitlebarChromeTokens({
    titleWeight: "700",
    iconDisplay: "inline-flex",
    iconSize: "12px",
    kbdTransform: "uppercase",
    kbdTracking: "0.06em"
  }),
  keys: createKeyChromeTokens({
    shading: "bevel",
    border: "1px solid rgba(0, 229, 255, 0.35)",
    cornerMode: "cut",
    cutSize: "4px"
  }),
  radius: createProRadiusTokens({
    panel: "0px",
    btn: "0px",
    field: "0px",
    xs: "0px",
    sm: "0px"
  }),
  color: color3,
  effect: createGxEffect(color3),
  shape: Object.freeze({ cornerMode: "cut", cutSize: "8px" }),
  icons: Object.freeze({
    pack: "gx-er",
    fallbackPack: "shared",
    overrides: Object.freeze({
      close: "chrome/close.svg",
      collapse: "chrome/collapse.svg"
    }),
    color: Object.freeze({
      chrome: color3.accent,
      keycap: "#001018",
      accent: color3.accent
    })
  }),
  clickDefaults: GX_ER_CLICK_DEFAULTS
});

// themes/icons.js
var THEME_ICON_FILES = Object.freeze({
  close: "chrome/close.svg",
  collapse: "chrome/collapse.svg",
  gear: "chrome/gear.svg",
  keyboard: "chrome/keyboard.svg",
  window: "chrome/window.svg"
});
var THEME_ICON_IDS = Object.freeze(Object.keys(THEME_ICON_FILES));
function getThemeIconUrl(semanticId, theme) {
  const id = typeof semanticId === "string" ? semanticId : "";
  const baseFile = THEME_ICON_FILES[id];
  if (!baseFile || !id) return "";
  const pack = theme?.icons?.pack || "shared";
  const fallback = theme?.icons?.fallbackPack || "shared";
  const override = theme?.icons?.overrides && theme.icons.overrides[id];
  const file = typeof override === "string" && override.trim() ? override.trim() : baseFile;
  const folder = override ? pack : fallback;
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(`themes/${folder}/icons/${file}`);
    }
  } catch {
  }
  return `themes/${folder}/icons/${file}`;
}

// themes/index.js
var PACKAGES = Object.freeze({
  "dark-pro": DARK_PRO_THEME,
  "gray-metal-pro": GRAY_METAL_PRO_THEME,
  "gx-er": GX_ER_THEME
});
function listThemes() {
  return THEME_IDS.map((id) => ({ id, name: THEME_META[id]?.name || id }));
}
function getTheme(id, overrides) {
  const key = normalizeThemeId(id);
  const base = PACKAGES[key] || PACKAGES[DEFAULT_THEME_ID];
  return mergeTheme(base, overrides && typeof overrides === "object" ? overrides : {});
}
function getAllThemesCss() {
  const blocks = THEME_IDS.map((id) => {
    const vars = themeToCssVars(getTheme(id));
    return cssVarsToBlock(
      vars,
      `:host([data-kp-theme="${id}"]), [data-kp-theme="${id}"]`
    );
  });
  const onboarding = themeToCssVars(
    mergeTheme(DARK_PRO_THEME, DARK_PRO_THEME.surfaces?.onboarding || {})
  );
  blocks.push(cssVarsToBlock(
    onboarding,
    `[data-kp-theme="dark-pro"][data-kp-surface="onboarding"], [data-kp-theme="dark-pro"] [data-kp-surface="onboarding"]`
  ));
  return `${blocks.join("\n")}
${getCutCornerCss()}
${getTitlebarChromeCss()}
${getSelectMenuCss()}`;
}
function getThemeCss(theme) {
  const vars = themeToCssVars(theme);
  const id = theme?.id || DEFAULT_THEME_ID;
  return `${cssVarsToBlock(vars, `:host, :root, [data-kp-theme="${id}"]`)}
${getCutCornerCss()}
${getTitlebarChromeCss()}
${getSelectMenuCss()}`;
}

// themes/font-faces.js
function fontUrl(file) {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(`fonts/${file}`);
    }
  } catch {
  }
  return `../fonts/${file}`;
}
function getThemeFontFaceCss() {
  const robotech = fontUrl("ROBOTECHGPRegular.ttf");
  const titillium = fontUrl("TitilliumTextRegular.otf");
  const titilliumBold = fontUrl("TitilliumTextBold.ttf");
  const cubellan = fontUrl("CubellanRegular.ttf");
  const ezarion = fontUrl("EzarionRegular.ttf");
  const dosis = fontUrl("DosisBook.ttf");
  return `
@font-face {
  font-family: 'ROBOTECHGPRegular';
  src: url('${robotech}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'TitilliumText';
  src: url('${titillium}') format('opentype');
  font-weight: 100 500;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'TitilliumText';
  src: url('${titilliumBold}') format('truetype');
  font-weight: 600 900;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Cubellan';
  src: url('${cubellan}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Ezarion';
  src: url('${ezarion}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'Dosis';
  src: url('${dosis}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
`.trim();
}

// src/modules/theme-manager.js
var STYLE_ATTR = "data-kp-theme-vars";
var FONT_ATTR = "data-kp-theme-fonts";
var ALL_THEMES_ATTR = "data-kp-all-themes";
var _activeTheme = getTheme(DEFAULT_THEME_ID);
var _listeners = /* @__PURE__ */ new Set();
function notify() {
  for (const fn of _listeners) {
    try {
      fn(_activeTheme);
    } catch {
    }
  }
}
function injectStyle(root, css, attr) {
  if (!root) return;
  const doc = root.nodeType === 9 ? root : root.ownerDocument || document;
  const mount = root.nodeType === 9 ? root.head || root.documentElement : root.host ? root : root;
  if (!doc || !mount?.appendChild) return;
  let style = null;
  try {
    style = mount.querySelector?.(`style[${attr}]`);
  } catch {
  }
  if (!style) {
    try {
      style = doc.createElement("style");
      style.setAttribute(attr, "true");
      style.textContent = css;
      mount.appendChild(style);
    } catch {
    }
    return;
  }
  if (style.textContent !== css) {
    try {
      style.textContent = css;
    } catch {
    }
  }
}
function applyThemeDataset(el, theme) {
  if (!el?.setAttribute) return;
  const id = theme?.id || DEFAULT_THEME_ID;
  try {
    el.setAttribute("data-kp-theme", id);
  } catch {
  }
  const cut = theme?.shape?.cornerMode === "cut";
  try {
    if (cut) el.setAttribute("data-kp-corner", "cut");
    else el.removeAttribute("data-kp-corner");
  } catch {
  }
}
function applyThemeCssVars(el, theme) {
  if (!el?.style?.setProperty) return;
  const vars = themeToCssVars(theme);
  for (const [k, v] of Object.entries(vars)) {
    try {
      el.style.setProperty(k, v);
    } catch {
    }
  }
}
function injectAllThemeMaps(root = document) {
  injectStyle(root, getThemeFontFaceCss(), FONT_ATTR);
  injectStyle(root, `${getAllThemesCss()}
${getCutCornerCss()}`, ALL_THEMES_ATTR);
}
var CHROME_THEME_HOST_SEL = [
  ".kp-chrome-window",
  "[data-kp-ui-shadow]",
  "[data-kp-select]",
  ".kp-select-menu-host",
  ".kp-select-menu",
  ".kpv2-settings-host",
  ".kpv2-docs-host"
].join(", ");
function collectChromeThemeHosts(root, out = [], seen = /* @__PURE__ */ new Set()) {
  if (!root) return out;
  const addHost = (el) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    out.push(el);
    try {
      if (el.shadowRoot) collectChromeThemeHosts(el.shadowRoot, out, seen);
    } catch {
    }
  };
  try {
    if (root.querySelectorAll) {
      root.querySelectorAll(CHROME_THEME_HOST_SEL).forEach(addHost);
    }
  } catch {
  }
  return out;
}
function paintShadowTheme(shadow, theme) {
  if (!shadow) return;
  injectAllThemeMaps(shadow);
  injectStyle(shadow, getThemeCss(theme), STYLE_ATTR);
}
function syncThemedIconMasks(root, theme) {
  if (!root?.querySelectorAll) return;
  try {
    root.querySelectorAll("[data-kp-theme-icon]").forEach((el) => {
      const id = el.getAttribute("data-kp-theme-icon");
      const url = getThemeIconUrl(id, theme);
      if (!url || !el.style) return;
      const img = `url("${String(url).replace(/"/g, '\\"')}")`;
      try {
        el.style.webkitMaskImage = img;
      } catch {
      }
      try {
        el.style.maskImage = img;
      } catch {
      }
    });
  } catch {
  }
}
function applyThemeToRoots(theme, opts = {}) {
  _activeTheme = theme || getTheme(DEFAULT_THEME_ID);
  const roots = opts.roots && opts.roots.length ? opts.roots : [document];
  const hostSet = /* @__PURE__ */ new Set();
  for (const host of opts.hosts || []) {
    if (host) hostSet.add(host);
  }
  try {
    collectChromeThemeHosts(document).forEach((el) => hostSet.add(el));
  } catch {
  }
  for (const root of roots) {
    collectChromeThemeHosts(root).forEach((el) => hostSet.add(el));
  }
  for (const root of roots) {
    if (!root) continue;
    injectAllThemeMaps(root);
    injectStyle(root, getThemeCss(_activeTheme), STYLE_ATTR);
    const el = root.nodeType === 9 ? root.documentElement : root.host || null;
    applyThemeDataset(el, _activeTheme);
    if (el) applyThemeCssVars(el, _activeTheme);
  }
  for (const host of hostSet) {
    applyThemeDataset(host, _activeTheme);
    applyThemeCssVars(host, _activeTheme);
    if (host?.shadowRoot) {
      paintShadowTheme(host.shadowRoot, _activeTheme);
      applyThemeDataset(host.shadowRoot.host, _activeTheme);
      syncThemedIconMasks(host.shadowRoot, _activeTheme);
    }
    syncThemedIconMasks(host, _activeTheme);
  }
  for (const root of roots) {
    syncThemedIconMasks(root, _activeTheme);
  }
  try {
    applyThemeDataset(document.documentElement, _activeTheme);
    applyThemeCssVars(document.documentElement, _activeTheme);
    injectAllThemeMaps(document);
    injectStyle(document, getThemeCss(_activeTheme), STYLE_ATTR);
    syncThemedIconMasks(document, _activeTheme);
  } catch {
  }
  notify();
  try {
    const id = _activeTheme?.id;
    if (id) localStorage.setItem("kp_theme_id_v1", id);
  } catch {
  }
  try {
    const keys = _activeTheme?.keys || {};
    localStorage.setItem("kp_theme_overrides_v1", JSON.stringify({
      keys: {
        shading: keys.shading === "flat" ? "flat" : "bevel",
        cornerMode: keys.cornerMode === "cut" ? "cut" : "radius",
        cutSize: keys.cutSize || "4px",
        border: keys.border || "1px solid rgba(0, 0, 0, 0.4)"
      },
      titlebar: {
        iconDisplay: _activeTheme?.titlebar?.iconDisplay === "inline-flex" ? "inline-flex" : "none"
      }
    }));
  } catch {
  }
  return _activeTheme;
}
function resolveThemeFromSettings(settings) {
  const id = normalizeThemeId(settings?.themeId);
  const overrides = settings?.themeOverrides && typeof settings.themeOverrides === "object" ? settings.themeOverrides : {};
  return getTheme(id, overrides);
}
function getThemeClickDefaults(theme = _activeTheme) {
  const d = theme?.clickDefaults || getTheme(DEFAULT_THEME_ID).clickDefaults;
  return {
    cursorMode: d.cursorMode,
    clickMode: {
      ...d.clickMode || {},
      cursor: { ...d.clickMode?.cursor || {} }
    }
  };
}

// src/modules/settings-path.js
function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}
function clampNumber(n, min, max) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
function pathToPartial(path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return {};
  let out = value;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    out = { [parts[i]]: out };
  }
  return (
    /** @type {Record<string, any>} */
    out
  );
}
function setOverridePath(overrides, path, value) {
  const next = cloneJson(overrides && typeof overrides === "object" ? overrides : {}, {});
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return next;
  let cur = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const child = cur[key];
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      cur[key] = {};
    }
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}

// src/modules/settings-controller.js
var SettingsController = class {
  constructor() {
    this.state = /** @type {any} */
    { ...DEFAULT_SETTINGS };
    this._listeners = /* @__PURE__ */ new Set();
    this._disposed = false;
    this._storageAttached = false;
    this._onStorageChanged = this._onStorageChanged.bind(this);
  }
  get disposed() {
    return this._disposed;
  }
  /**
   * @param {(state: any) => void} fn
   * @returns {() => void}
   */
  subscribe(fn) {
    if (typeof fn !== "function" || this._disposed) return () => {
    };
    this._listeners.add(fn);
    return () => {
      this._listeners.delete(fn);
    };
  }
  _emit() {
    if (this._disposed) return;
    for (const fn of this._listeners) {
      try {
        fn(this.state);
      } catch {
      }
    }
  }
  /**
   * @param {{ snapshot?: object|null }} [opts]
   */
  async load(opts = {}) {
    if (this._disposed) return this.state;
    const snap = opts.snapshot;
    if (snap && typeof snap === "object") {
      this.state = /** @type {any} */
      snap;
    } else {
      this.state = await getSettings();
    }
    this._attachStorage();
    this._emit();
    return this.state;
  }
  _attachStorage() {
    if (this._storageAttached || this._disposed) return;
    try {
      if (!chrome?.storage?.onChanged?.addListener) return;
      chrome.storage.onChanged.addListener(this._onStorageChanged);
      this._storageAttached = true;
    } catch {
    }
  }
  /**
   * @param {Record<string, chrome.storage.StorageChange>} changes
   * @param {string} area
   */
  async _onStorageChanged(changes, area) {
    if (this._disposed) return;
    if (area !== "sync" && area !== "local") return;
    const entry = changes?.[SETTINGS_STORAGE_KEY];
    if (!entry) return;
    try {
      this.state = await getSettings();
      this._emit();
    } catch {
      if (entry.newValue && typeof entry.newValue === "object") {
        this.state = /** @type {any} */
        entry.newValue;
        this._emit();
      }
    }
  }
  /**
   * @param {string} path
   * @param {any} value
   */
  async update(path, value) {
    if (this._disposed) return this.state;
    return this.updatePartial(pathToPartial(path, value));
  }
  /**
   * @param {Partial<import('./settings-manager.js').KeyPilotSettings>} partial
   */
  async updatePartial(partial) {
    if (this._disposed) return this.state;
    this.state = await setSettings(partial);
    this._emit();
    return this.state;
  }
  /**
   * @param {string} overridePath
   * @param {any} value
   */
  async updateThemeOverride(overridePath, value) {
    if (this._disposed) return this.state;
    const nextOverrides = setOverridePath(this.state?.themeOverrides, overridePath, value);
    return this.updatePartial({ themeOverrides: nextOverrides });
  }
  /**
   * @param {any} rawId
   */
  async applyThemePack(rawId) {
    if (this._disposed) return this.state;
    const themeId = normalizeThemeId(rawId);
    const theme = getTheme(themeId);
    const clickPatch = getThemeClickDefaults(theme);
    return this.updatePartial({
      themeId,
      themeOverrides: {},
      cursorMode: clickPatch.cursorMode,
      clickMode: clickPatch.clickMode,
      clickModeThemeId: themeId
    });
  }
  /**
   * @param {SettingsResetScope} scope
   */
  async reset(scope) {
    if (this._disposed) return this.state;
    switch (scope) {
      case "all":
        this.state = await resetAllSettings();
        this._emit();
        return this.state;
      case "appearance":
        return this.updatePartial({ themeOverrides: {} });
      case "click-cursor": {
        const defaults = getThemeClickDefaults(getTheme(this.state?.themeId));
        return this.updatePartial({
          clickMode: { cursor: { ...defaults.clickMode.cursor } }
        });
      }
      case "click-mode": {
        const defaults = getThemeClickDefaults(getTheme(this.state?.themeId));
        const { cursor: _cursor, ...clickModeDefaults } = defaults.clickMode;
        return this.updatePartial({ clickMode: { ...clickModeDefaults } });
      }
      case "text-cursor":
        return this.updatePartial({
          textMode: { cursorType: DEFAULT_SETTINGS.textMode.cursorType }
        });
      case "text-mode":
        return this.updatePartial({ textMode: { ...DEFAULT_SETTINGS.textMode } });
      case "scroll":
        return this.updatePartial({ scroll: { ...DEFAULT_SETTINGS.scroll } });
      default:
        return this.state;
    }
  }
  dispose() {
    this._disposed = true;
    this._listeners.clear();
    if (this._storageAttached) {
      try {
        chrome.storage.onChanged.removeListener(this._onStorageChanged);
      } catch {
      }
      this._storageAttached = false;
    }
  }
};
function createSettingsController() {
  return new SettingsController();
}

// src/modules/settings-binder.js
var SETTINGS_CONTROLS = Object.freeze([
  { type: "radio", name: "engine", path: "searchEngine" },
  { type: "toggle", id: "keyboard-reference-key-feedback", path: "keyboardReferenceKeyFeedback" },
  { type: "toggle", id: "keyboard-reference-show-number-row", path: "keyboardReferenceShowNumberRow" },
  { type: "toggle", id: "control-strip-visible", path: "controlStrip.visible" },
  { type: "toggle", id: "control-strip-collapsed", path: "controlStrip.collapsed" },
  { type: "select", id: "keyboard-layout-family", path: "keyboardLayoutFamilyId", viewTransition: true },
  {
    type: "toggle",
    id: "keyboard-left-handed",
    path: "keyboardHandedness",
    normalize: (checked) => checked ? "left" : "right",
    viewTransition: true
  },
  { type: "radio", name: "cursor-mode", path: "cursorMode", viewTransition: true },
  { type: "select", id: "click-cursor-type", path: "clickMode.cursor.type" },
  { type: "rangePair", baseId: "click-cursor-linewidth", path: "clickMode.cursor.lineWidth", min: 1, max: 12 },
  { type: "rangePair", baseId: "click-cursor-size", path: "clickMode.cursor.sizePixels", min: 5, max: 60 },
  { type: "rangePair", baseId: "click-cursor-gap", path: "clickMode.cursor.gap", min: 0, max: 20 },
  { type: "select", id: "click-focus-color", path: "clickMode.focusColor" },
  { type: "toggle", id: "click-overlay-fill", path: "clickMode.overlayFillEnabled" },
  { type: "toggle", id: "click-overlay-shadow", path: "clickMode.overlayShadowEnabled" },
  { type: "rangePair", baseId: "click-rect-thickness", path: "clickMode.rectangleThickness", min: 1, max: 16 },
  { type: "toggle", id: "click-keyboard-link-hints", path: "clickMode.keyboardLinkHoverHints" },
  { type: "select", id: "click-paint-strategy", path: "clickMode.paintStrategy" },
  { type: "toggle", id: "click-skip-for-parent", path: "clickMode.skipForParent" },
  { type: "toggle", id: "click-paint-backend-debug", path: "clickMode.paintBackendDebugDashes" },
  { type: "toggle", id: "debug-logging", path: "debugLogging" },
  { type: "rangePair", baseId: "click-focus-padding", path: "clickMode.focusPadding", min: 0, max: 16 },
  {
    type: "radio",
    name: "click-effect",
    path: "clickMode.clickEffect",
    normalize: (v) => CLICK_EFFECT_IDS.includes(
      /** @type {any} */
      v
    ) ? v : "flash"
  },
  { type: "select", id: "text-cursor-type", path: "textMode.cursorType" },
  { type: "toggle", id: "text-labels-enabled", path: "textMode.labelsEnabled" },
  { type: "radio", name: "text-focus-style", path: "textMode.focusStyle" },
  { type: "rangePair", baseId: "text-left-edge-width", path: "textMode.leftEdgeWidth", min: 1, max: 24 },
  { type: "rangePair", baseId: "text-stroke-thickness", path: "textMode.strokeThickness", min: 1, max: 16 },
  { type: "rangePair", baseId: "scroll-half-page", path: "scroll.halfPagePx", min: 50, max: 2e3 },
  {
    type: "select",
    id: "scroll-speed",
    path: "scroll.speed",
    normalize: (v) => v === "instant" ? "instant" : "smooth"
  },
  { type: "toggle", id: "scroll-middle-click-scroll-line", path: "scroll.middleClickScrollLine" },
  { type: "toggle", id: "scroll-line-prefer-portrait", path: "scroll.linePreferPortraitTargets" },
  { type: "appearanceRadio", name: "app-corner-mode", overridePath: "shape.cornerMode", normalize: (v) => v === "cut" ? "cut" : "radius" },
  { type: "appearanceRangePair", baseId: "app-cut-size", overridePath: "shape.cutSize", min: 0, max: 24 },
  { type: "appearanceRangePair", baseId: "app-panel-radius", overridePath: "radius.panel", min: 0, max: 24 },
  { type: "appearanceRadio", name: "app-title-transform", overridePath: "type.textTransform.titlebar", normalize: (v) => v === "uppercase" ? "uppercase" : "none" },
  {
    type: "appearanceControl",
    id: "app-title-tracking",
    event: "change",
    overridePath: "type.letterSpacing.titlebar",
    fromEl: (el) => String(el.value || "0.02em").trim() || "0.02em"
  },
  {
    type: "appearanceRadio",
    name: "app-title-weight",
    overridePath: "titlebar.titleWeight",
    normalize: (v) => v === "400" || v === "700" ? v : "600"
  },
  { type: "appearanceRadio", name: "app-title-icon", overridePath: "titlebar.iconDisplay", normalize: (v) => v === "inline-flex" ? "inline-flex" : "none" },
  { type: "appearanceRadio", name: "app-kbd-transform", overridePath: "titlebar.kbdTransform", normalize: (v) => v === "uppercase" ? "uppercase" : "none" },
  { type: "appearanceRadio", name: "app-key-shading", overridePath: "keys.shading", normalize: (v) => v === "flat" ? "flat" : "bevel" },
  { type: "appearanceRadio", name: "app-key-corner", overridePath: "keys.cornerMode", normalize: (v) => v === "cut" ? "cut" : "radius" },
  { type: "appearanceRangePair", baseId: "app-key-cut", overridePath: "keys.cutSize", min: 0, max: 16 },
  {
    type: "appearanceControl",
    id: "app-key-border",
    event: "change",
    overridePath: "keys.border",
    fromEl: (el) => String(el.value || "").trim() || "1px solid rgba(0, 0, 0, 0.4)"
  },
  { type: "appearanceControl", id: "app-color-accent", event: "input", overridePath: "color.accent", fromEl: (el) => el.value },
  { type: "appearanceControl", id: "app-color-fg", event: "input", overridePath: "color.fg", fromEl: (el) => el.value },
  { type: "appearanceControl", id: "app-color-fg-dim", event: "input", overridePath: "color.fgDim", fromEl: (el) => el.value },
  { type: "appearanceControl", id: "app-color-panel", event: "input", overridePath: "color.panel", fromEl: (el) => el.value },
  { type: "appearanceControl", id: "app-color-panel-edge", event: "input", overridePath: "color.panelEdge", fromEl: (el) => el.value },
  { type: "appearanceControl", id: "app-color-title-top", event: "input", overridePath: "color.titleTop", fromEl: (el) => el.value },
  { type: "appearanceControl", id: "app-color-title-mid", event: "input", overridePath: "color.titleMid", fromEl: (el) => el.value },
  { type: "appearanceControl", id: "app-color-title-bot", event: "input", overridePath: "color.titleBot", fromEl: (el) => el.value },
  { type: "appearanceControl", id: "app-color-kbd", event: "input", overridePath: "color.kbdColor", fromEl: (el) => el.value },
  { type: "appearanceRangePair", baseId: "app-type-ui", overridePath: "type.size.ui", min: 9, max: 18 },
  { type: "appearanceRangePair", baseId: "app-type-kbd", overridePath: "type.size.kbd", min: 8, max: 16 }
]);
function bindSettingsControls(ctx) {
  const { controller, el, all, setInputValue: setInputValue2, signal } = ctx;
  const listenOpts = { signal, capture: true };
  const runUpdate = (spec, work) => {
    void Promise.resolve(work).then((s) => {
      if (spec.viewTransition && typeof ctx.withViewTransition === "function") {
        ctx.withViewTransition(() => ctx.applyState?.(s));
      }
    });
  };
  for (const spec of SETTINGS_CONTROLS) {
    if (spec.type === "toggle") {
      const node = (
        /** @type {HTMLInputElement|null} */
        el(spec.id || "")
      );
      if (!node) continue;
      node.addEventListener("change", () => {
        const raw = spec.normalize ? spec.normalize(!!node.checked) : !!node.checked;
        runUpdate(spec, controller.update(spec.path, raw));
      }, listenOpts);
      continue;
    }
    if (spec.type === "select") {
      const node = (
        /** @type {HTMLSelectElement|null} */
        el(spec.id || "")
      );
      if (!node) continue;
      node.addEventListener("change", () => {
        const raw = spec.normalize ? spec.normalize(node.value) : node.value;
        runUpdate(spec, controller.update(spec.path, raw));
      }, listenOpts);
      continue;
    }
    if (spec.type === "radio") {
      const radios = (
        /** @type {HTMLInputElement[]} */
        Array.from(all(`input[name="${spec.name}"]`))
      );
      radios.forEach((radio) => {
        radio.addEventListener("change", () => {
          if (!radio.checked) return;
          const raw = spec.normalize ? spec.normalize(radio.value) : radio.value;
          runUpdate(spec, controller.update(spec.path, raw));
        }, listenOpts);
      });
      continue;
    }
    if (spec.type === "rangePair") {
      const range = (
        /** @type {HTMLInputElement|null} */
        el(`${spec.baseId}-range`)
      );
      const number = (
        /** @type {HTMLInputElement|null} */
        el(`${spec.baseId}-number`)
      );
      const commit = (raw) => {
        const n = clampNumber(raw, spec.min ?? 0, spec.max ?? 0);
        setInputValue2(range, n);
        setInputValue2(number, n);
        void controller.update(spec.path, n);
      };
      range?.addEventListener("input", () => commit(range.value), listenOpts);
      number?.addEventListener("input", () => commit(number.value), listenOpts);
      continue;
    }
    if (spec.type === "appearanceControl") {
      const node = (
        /** @type {HTMLInputElement|null} */
        el(spec.id || "")
      );
      if (!node) continue;
      const eventName = spec.event || "change";
      node.addEventListener(eventName, () => {
        const fromEl = spec.fromEl || ((e) => e.value);
        void controller.updateThemeOverride(spec.overridePath, fromEl(node));
      }, listenOpts);
      continue;
    }
    if (spec.type === "appearanceRadio") {
      const radios = (
        /** @type {HTMLInputElement[]} */
        Array.from(all(`input[name="${spec.name}"]`))
      );
      radios.forEach((radio) => {
        radio.addEventListener("change", () => {
          if (!radio.checked) return;
          const raw = spec.normalize ? spec.normalize(radio.value) : radio.value;
          void controller.updateThemeOverride(spec.overridePath, raw);
        }, listenOpts);
      });
      continue;
    }
    if (spec.type === "appearanceRangePair") {
      const range = (
        /** @type {HTMLInputElement|null} */
        el(`${spec.baseId}-range`)
      );
      const number = (
        /** @type {HTMLInputElement|null} */
        el(`${spec.baseId}-number`)
      );
      const format = typeof spec.formatValue === "function" ? spec.formatValue : (n) => `${n}px`;
      const commit = (raw) => {
        const n = clampNumber(raw, spec.min ?? 0, spec.max ?? 0);
        setInputValue2(range, n);
        setInputValue2(number, n);
        void controller.updateThemeOverride(spec.overridePath, format(n));
      };
      range?.addEventListener("input", () => commit(range.value), listenOpts);
      number?.addEventListener("input", () => commit(number.value), listenOpts);
    }
  }
}

// src/utils/debug.js
function applyDebugSetting(enabled) {
  try {
    globalThis.KEYPILOT_DEBUG = !!enabled;
  } catch {
  }
}

// src/ui/url-listing.js
var GENERIC_FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#ffffff" fill-opacity="0.78" d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2Zm0 2c-1.5 0-2.93.35-4.2.98.58.5 1.27 1.33 1.9 2.6.82-.28 1.74-.44 2.3-.48V4Zm2 0v3.1c.56.04 1.48.2 2.3.48.63-1.27 1.32-2.1 1.9-2.6A7.95 7.95 0 0 0 14 4Zm-6.72 2.2A7.99 7.99 0 0 0 4.07 11h3.21c.06-1.39.29-2.65.63-3.74-.24-.5-.45-.84-.63-1.06ZM19.93 11A7.99 7.99 0 0 0 16.72 6.2c-.18.22-.39.56-.63 1.06.34 1.09.57 2.35.63 3.74h3.21ZM9.3 8.73c-.24.8-.41 1.74-.46 2.77h3.16V9.15c-.9.05-1.85.22-2.7.58Zm5.4 0c-.85-.36-1.8-.53-2.7-.58v2.35h3.16c-.05-1.03-.22-1.97-.46-2.77ZM4.07 13a7.99 7.99 0 0 0 3.21 4.8c.18-.22.39-.56.63-1.06-.34-1.09-.57-2.35-.63-3.74H4.07Zm4.77 0c.05 1.03.22 1.97.46 2.77.85.36 1.8.53 2.7.58V13H8.84Zm3.16 3.85c-.56-.04-1.48-.2-2.3-.48-.63 1.27-1.32 2.1-1.9 2.6A7.95 7.95 0 0 0 12 20v-3.15Zm2 0V20c1.5 0 2.93-.35 4.2-.98-.58-.5-1.27-1.33-1.9-2.6-.82.28-1.74.44-2.3.48Zm1.16-3.85H12v3.35c.9-.05 1.85-.22 2.7-.58.24-.8.41-1.74.46-2.77Zm1.56 3.74c.24.5.45.84.63 1.06a7.99 7.99 0 0 0 3.21-4.8h-3.21c-.06 1.39-.29 2.65-.63 3.74Z"/>
</svg>
`.trim();
var GENERIC_FAVICON_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(GENERIC_FAVICON_SVG)}`;
function getChromeFavicon2Url(url, size = 32) {
  const u = String(url || "").trim();
  const s = Number(size) || 32;
  return `chrome://favicon2/?size=${encodeURIComponent(String(s))}&pageUrl=${encodeURIComponent(u)}`;
}
function getExtensionFaviconUrl(pageUrl, size = 32) {
  const u = String(pageUrl || "").trim();
  const s = Number(size) || 32;
  try {
    if (typeof chrome !== "undefined" && chrome?.runtime?.getURL) {
      const url = new URL(chrome.runtime.getURL("/_favicon/"));
      url.searchParams.set("pageUrl", u);
      url.searchParams.set("size", String(s));
      return url.toString();
    }
  } catch {
  }
  return getChromeFavicon2Url(u, s);
}

// src/modules/cursor.js
var CursorManager = class {
  constructor() {
    this.cursorEl = null;
    this.lastPosition = { x: 0, y: 0 };
    this.isStuck = false;
    this.stuckCheckInterval = null;
    this.forceUpdateCount = 0;
    this.currentMode = null;
    this.currentModeKey = null;
    this.lastOptions = {};
    this.uriCache = /* @__PURE__ */ new Map();
  }
  ensure() {
    if (this.cursorEl) return;
    try {
      const earlyApi = window.KEYPILOT_EARLY;
      if (earlyApi && !window.__KP_EARLY_HANDOFF_DONE) {
        window.__KP_EARLY_HANDOFF_DONE = true;
        try {
          const earlyPosition = typeof earlyApi.getPosition === "function" ? earlyApi.getPosition() : null;
          if (earlyPosition && typeof earlyPosition.x === "number" && typeof earlyPosition.y === "number") {
            this.lastPosition = earlyPosition;
          }
        } catch {
        }
        try {
          window.dispatchEvent(new CustomEvent("keypilot-main-loaded"));
        } catch {
        }
        if (window.KEYPILOT_DEBUG) {
          console.log("[KeyPilot] Took over from early injection, using CSS cursor");
        }
      }
    } catch {
    }
    this.cursorEl = { style: {} };
  }
  setMode(mode, options = {}) {
    if (!this.cursorEl) return;
    const {
      cursorType = null,
      crossHairQuadrantWidth = 15,
      gap = 0,
      strokeLineCap = "round",
      strokeWidth = 4,
      crossHairScalingFactor = 1,
      hasClickableElement = false
    } = options || {};
    const nextModeKey = `${mode}|${cursorType || ""}|${crossHairQuadrantWidth}|${gap}|${strokeLineCap}|${strokeWidth}|${crossHairScalingFactor}|${hasClickableElement ? 1 : 0}`;
    if (this.currentModeKey === nextModeKey) {
      return;
    }
    this.currentMode = mode;
    this.currentModeKey = nextModeKey;
    this.lastOptions = options && typeof options === "object" ? { ...options } : {};
    if (cursorType === "native_arrow") {
      document.documentElement.style.setProperty("--kpv2-cursor", "default");
      if (document.documentElement.style.cursor) document.documentElement.style.cursor = "";
      if (document.body.style.cursor) document.body.style.cursor = "";
      return;
    }
    if (cursorType === "native_pointer") {
      document.documentElement.style.setProperty("--kpv2-cursor", "pointer");
      if (document.documentElement.style.cursor) document.documentElement.style.cursor = "";
      if (document.body.style.cursor) document.body.style.cursor = "";
      return;
    }
    const cursorUri = this.getCursorDataUri(mode, options);
    const cursorValue = `url("${cursorUri}") 30 30, auto`;
    document.documentElement.style.setProperty("--kpv2-cursor", cursorValue);
    if (document.documentElement.style.cursor) document.documentElement.style.cursor = "";
    if (document.body.style.cursor) document.body.style.cursor = "";
  }
  updatePosition(x, y) {
    if (!this.cursorEl) return;
    this.lastPosition = { x, y };
  }
  getCurrentMode() {
    return this.currentMode || "none";
  }
  /**
   * Generate SVG data URI for cursor mode
   */
  getCursorDataUri(mode, options = {}) {
    const {
      cursorType = null,
      crossHairQuadrantWidth = 15,
      gap = 0,
      strokeLineCap = "round",
      strokeWidth = 4,
      crossHairScalingFactor = 1,
      hasClickableElement = false
    } = options;
    const scaledGap = gap * crossHairScalingFactor;
    const scaledWidth = crossHairQuadrantWidth * crossHairScalingFactor;
    const centerX = 30;
    const centerY = 30;
    let segmentStart, segmentEnd, segmentStart2, segmentEnd2;
    if (scaledGap === 0) {
      segmentStart = centerY - scaledWidth;
      segmentEnd = centerY;
      segmentStart2 = centerY;
      segmentEnd2 = centerY + scaledWidth;
    } else {
      segmentStart = centerY - scaledGap - scaledWidth;
      segmentEnd = centerY - scaledGap;
      segmentStart2 = centerY + scaledGap;
      segmentEnd2 = centerY + scaledGap + scaledWidth;
    }
    const cacheKey = `${mode}-${cursorType || ""}-${crossHairQuadrantWidth}-${gap}-${strokeLineCap}-${strokeWidth}-${crossHairScalingFactor}-${hasClickableElement ? 1 : 0}`;
    if (this.uriCache.has(cacheKey)) {
      return this.uriCache.get(cacheKey);
    }
    let svgContent = "";
    if (mode === "text_focus" && cursorType === "t_square") {
      const color4 = hasClickableElement ? COLORS.FOCUS_GREEN_BRIGHT : COLORS.ORANGE;
      const scale = crossHairScalingFactor || 1;
      const half = 14 * scale;
      const x = 30 - half;
      const y = 30 - half;
      const w = 2 * half;
      const h = 2 * half;
      const tHalf = half * 0.6;
      const tTopY = 30 - half * 0.45;
      const tBottomY = 30 + half * 0.7;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color4}" stroke-width="${strokeWidth}" />
        <line x1="${30 - tHalf}" y1="${tTopY}" x2="${30 + tHalf}" y2="${tTopY}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${tTopY}" x2="30" y2="${tBottomY}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else if (mode === "text_focus") {
      const color4 = hasClickableElement ? COLORS.FOCUS_GREEN_BRIGHT : COLORS.ORANGE;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else if (mode === "delete") {
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="12" y1="12" x2="48" y2="48" stroke="${COLORS.DELETE_RED}" stroke-width="5" stroke-linecap="round"/>
        <line x1="48" y1="12" x2="12" y2="48" stroke="${COLORS.DELETE_RED}" stroke-width="5" stroke-linecap="round"/>
      </svg>`;
    } else if (mode === "cols") {
      const color4 = COLORS.COLS_PURPLE || "rgba(156,39,176,0.95)";
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <rect x="10" y="12" width="16" height="36" rx="1" fill="none" stroke="${color4}" stroke-width="3"/>
        <rect x="34" y="12" width="16" height="36" rx="1" fill="none" stroke="${color4}" stroke-width="3"/>
        <line x1="13" y1="20" x2="23" y2="20" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="13" y1="28" x2="23" y2="28" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="13" y1="36" x2="23" y2="36" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="37" y1="20" x2="47" y2="20" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="37" y1="28" x2="47" y2="28" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
        <line x1="37" y1="36" x2="47" y2="36" stroke="${color4}" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    } else if (mode === "highlight") {
      const color4 = COLORS.HIGHLIGHT_BLUE;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else {
      const color4 = COLORS.FOCUS_GREEN_BRIGHT;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color4}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    }
    const encoded = encodeURIComponent(svgContent);
    const uri = `data:image/svg+xml,${encoded}`;
    this.uriCache.set(cacheKey, uri);
    return uri;
  }
  hide() {
    if (this.cursorEl) {
      document.documentElement.style.setProperty("--kpv2-cursor", "default");
    }
  }
  show() {
    if (this.cursorEl) {
      const currentMode = this.getCurrentMode();
      this.currentMode = null;
      this.currentModeKey = null;
      this.setMode(currentMode, this.lastOptions || {});
    }
  }
  cleanup() {
    if (this.stuckCheckInterval) {
      clearInterval(this.stuckCheckInterval);
      this.stuckCheckInterval = null;
    }
    document.documentElement.style.cursor = "";
    document.body.style.cursor = "";
    document.documentElement.style.removeProperty("--kpv2-cursor");
    this.cursorEl = null;
    this.currentMode = null;
    this.currentModeKey = null;
  }
  createElement(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === "className") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }
};

// src/utils/kp-deep-link.js
var KP_SETTINGS_PANEL_IDS = Object.freeze([
  "overview",
  "appearance",
  "keyboard",
  "click-mode",
  "text-mode",
  "scrolling",
  "cursor",
  "control-strip",
  "search",
  "about"
]);
function normalizeSettingsPanelId(panelId) {
  const id = String(panelId || "").trim();
  return KP_SETTINGS_PANEL_IDS.includes(id) ? id : null;
}

// pages/settings.js
var settingsScope = document;
var settingsHandlersInstalled = false;
var lastUiSettings = null;
var settingsDomBoundApp = null;
var pendingInitialPanel = null;
var settingsController = null;
var settingsUiAbort = null;
var settingsControllerUnsub = null;
function getLiveSettingsSnapshot() {
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    const s = kp && kp._settings;
    if (s && typeof s === "object") return s;
  } catch {
  }
  return null;
}
function settingsEl(id) {
  const scope = settingsScope || document;
  if (!scope || !id) return null;
  try {
    if (typeof scope.getElementById === "function") {
      const hit = scope.getElementById(id);
      if (hit) return hit;
    }
  } catch {
  }
  try {
    const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id;
    const hit = scope.querySelector?.(`#${escaped}`);
    if (hit) return hit;
  } catch {
  }
  try {
    return scope.querySelector?.(`[id="${id}"]`) || null;
  } catch {
    return null;
  }
}
function settingsOne(sel) {
  try {
    return settingsScope?.querySelector?.(sel) || null;
  } catch {
    return null;
  }
}
function settingsAll(sel) {
  try {
    return settingsScope?.querySelectorAll?.(sel) || [];
  } catch {
    return [];
  }
}
function applySearchEngineIcons() {
  const icons = settingsAll("img.radio-icon[data-favicon-for]");
  icons.forEach((img) => {
    const id = img.getAttribute("data-favicon-for");
    const meta = id && SEARCH_ENGINE_META[id] ? SEARCH_ENGINE_META[id] : null;
    const pageUrl = meta?.homeUrl || "";
    if (!pageUrl) {
      img.src = GENERIC_FAVICON_DATA_URL;
      return;
    }
    img.src = getExtensionFaviconUrl(pageUrl, 32);
    img.addEventListener("error", () => {
      img.src = GENERIC_FAVICON_DATA_URL;
    }, { once: true });
  });
}
function adaptHeaderForPopoverEmbed(embedded = false) {
  try {
    if (!embedded) {
      try {
        embedded = !!(window.parent && window.parent !== window);
      } catch {
        embedded = false;
      }
    }
    if (!embedded) return;
    const app = settingsOne(".settings-app");
    app?.classList?.add("kp-popover-embed");
    const header = settingsOne(".settings-app > .header");
    if (header) {
      header.hidden = true;
      header.setAttribute("aria-hidden", "true");
    }
  } catch {
  }
}
var SETTINGS_TAB_STORAGE_KEY = "kp_settings_active_tab";
var KEYBOARD_HELP_STORAGE_KEY = "keypilot_keyboard_help_visible";
async function queryKeyboardHelpVisible() {
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    if (kp && typeof kp.getKeyboardHelpVisibleFromStorage === "function") {
      return Boolean(await kp.getKeyboardHelpVisibleFromStorage());
    }
  } catch {
  }
  try {
    const syncResult = await chrome.storage.sync.get([KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof syncResult?.[KEYBOARD_HELP_STORAGE_KEY] === "boolean") {
      return syncResult[KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch {
  }
  try {
    const localResult = await chrome.storage.local.get([KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof localResult?.[KEYBOARD_HELP_STORAGE_KEY] === "boolean") {
      return localResult[KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch {
  }
  return false;
}
async function setKeyboardHelpVisible(visible) {
  const desired = Boolean(visible);
  const payload = { [KEYBOARD_HELP_STORAGE_KEY]: desired, timestamp: Date.now() };
  try {
    await chrome.storage.sync.set(payload);
  } catch {
  }
  try {
    await chrome.storage.local.set(payload);
  } catch {
  }
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    const inPopover = !!(kp?._isPopoverOsWindow || window.__KP_POPOVER_WINDOW);
    if (!inPopover && kp && typeof kp.applyKeyboardHelpVisibility === "function") {
      kp.applyKeyboardHelpVisibility(desired, { persist: false });
    }
  } catch {
  }
  return desired;
}
var SETTINGS_DEFAULT_PANEL_ID = "overview";
var SETTINGS_PANEL_IDS = Object.freeze([
  "overview",
  "appearance",
  "keyboard",
  "click-mode",
  "text-mode",
  "scrolling",
  "cursor",
  "control-strip",
  "search",
  "about"
]);
function activateSettingsPanel(panelId, opts = {}) {
  const id = SETTINGS_PANEL_IDS.includes(panelId) ? panelId : SETTINGS_DEFAULT_PANEL_ID;
  const tabs = Array.from(settingsAll(".settings-tab[data-panel]"));
  const panels = Array.from(settingsAll(".settings-panel[data-panel]"));
  tabs.forEach((tab) => {
    const selected = tab.getAttribute("data-panel") === id;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
    if (selected && opts.focusTab) {
      try {
        tab.focus();
      } catch {
      }
    }
  });
  panels.forEach((panel) => {
    const selected = panel.getAttribute("data-panel") === id;
    panel.classList.toggle("is-active", selected);
    if (selected) {
      panel.hidden = false;
      panel.removeAttribute("hidden");
    } else {
      panel.hidden = true;
    }
  });
  if (id === "appearance") {
    try {
      applyAppearanceControls(lastUiSettings);
    } catch {
    }
  }
  if (opts.persist !== false) {
    try {
      sessionStorage.setItem(SETTINGS_TAB_STORAGE_KEY, id);
    } catch {
    }
  }
  try {
    const detail = settingsOne(".settings-detail");
    if (detail) detail.scrollTop = 0;
  } catch {
  }
}
function installSettingsMasterDetailNav() {
  const nav = settingsOne(".settings-nav");
  const tabs = Array.from(settingsAll(".settings-tab[data-panel]"));
  if (!nav || tabs.length === 0) return;
  let initial = SETTINGS_DEFAULT_PANEL_ID;
  const fromMount = normalizeSettingsPanelId(pendingInitialPanel);
  pendingInitialPanel = null;
  if (fromMount) {
    initial = fromMount;
  } else {
    try {
      const hash = (location.hash || "").replace(/^#/, "");
      if (SETTINGS_PANEL_IDS.includes(hash)) {
        initial = hash;
      } else {
        const stored = sessionStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
        if (stored && SETTINGS_PANEL_IDS.includes(stored)) initial = stored;
      }
    } catch {
    }
  }
  activateSettingsPanel(initial, { persist: false });
  const signal = settingsUiAbort?.signal;
  const listenOpts = signal ? { signal } : {};
  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const panelId = tab.getAttribute("data-panel");
      withOptionalViewTransition(() => activateSettingsPanel(panelId));
    }, listenOpts);
  });
  settingsAll(".settings-hub-tile[data-goto]").forEach((tile) => {
    tile.addEventListener("click", (e) => {
      e.preventDefault();
      const panelId = tile.getAttribute("data-goto");
      if (!panelId || !SETTINGS_PANEL_IDS.includes(panelId)) return;
      withOptionalViewTransition(() => activateSettingsPanel(panelId, { focusTab: true }));
    }, listenOpts);
  });
  nav.addEventListener("keydown", (e) => {
    if (!e) return;
    const key = e.key;
    if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Home" && key !== "End") return;
    const currentIndex = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    if (currentIndex < 0) return;
    let nextIndex = currentIndex;
    if (key === "ArrowDown") nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
    if (key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex) return;
    e.preventDefault();
    const panelId = tabs[nextIndex].getAttribute("data-panel");
    withOptionalViewTransition(() => activateSettingsPanel(panelId, { focusTab: true }));
  }, listenOpts);
}
function parsePxNumber(raw, fallback = 0) {
  const n = parseFloat(String(raw ?? "").replace(/px$/i, "").trim());
  return Number.isFinite(n) ? n : fallback;
}
function toHexColor(raw, fallback = "#888888") {
  const s = String(raw || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const h = (n) => Number(n).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return fallback;
}
function themeDisplayName(themeId, customized) {
  const name = THEME_META[themeId]?.name || themeId;
  return customized ? `${name} (custom)` : name;
}
function setRadioGroupValue(radios, value) {
  const v = String(value);
  radios.forEach((r) => {
    r.checked = r.value === v;
  });
}
function setInputValue(el, value) {
  if (!el) return;
  const s = String(value);
  try {
    el.value = s;
  } catch {
  }
  try {
    el.defaultValue = s;
  } catch {
  }
}
function applyAppearanceControls(settings) {
  const s = settings || lastUiSettings || getLiveSettingsSnapshot() || DEFAULT_SETTINGS;
  lastUiSettings = s;
  const theme = resolveThemeFromSettings(s);
  const shape = theme.shape || {};
  const radius = theme.radius || {};
  const type2 = theme.type || {};
  const titlebar = theme.titlebar || {};
  const keys = theme.keys || {};
  const color4 = theme.color || {};
  const cutSize = parsePxNumber(shape.cutSize, 8);
  const panelRadius = parsePxNumber(radius.panel, 3);
  const keyCut = parsePxNumber(keys.cutSize, 4);
  const typeUi = parsePxNumber(type2.size?.ui, 12);
  const typeKbd = parsePxNumber(type2.size?.kbd, 10);
  const titleWeight = String(titlebar.titleWeight || "600");
  const normalizedTitleWeight = titleWeight === "400" || titleWeight === "700" ? titleWeight : "600";
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-corner-mode"]')),
    shape.cornerMode === "cut" ? "cut" : "radius"
  );
  setInputValue(settingsEl("app-cut-size-range"), cutSize);
  setInputValue(settingsEl("app-cut-size-number"), cutSize);
  setInputValue(settingsEl("app-panel-radius-range"), panelRadius);
  setInputValue(settingsEl("app-panel-radius-number"), panelRadius);
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-title-transform"]')),
    type2.textTransform?.titlebar === "uppercase" ? "uppercase" : "none"
  );
  setInputValue(settingsEl("app-title-tracking"), type2.letterSpacing?.titlebar || "0.02em");
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-title-weight"]')),
    normalizedTitleWeight
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-title-icon"]')),
    titlebar.iconDisplay === "inline-flex" ? "inline-flex" : "none"
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-kbd-transform"]')),
    titlebar.kbdTransform === "uppercase" ? "uppercase" : "none"
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-key-shading"]')),
    keys.shading === "flat" ? "flat" : "bevel"
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="app-key-corner"]')),
    keys.cornerMode === "cut" ? "cut" : "radius"
  );
  setInputValue(settingsEl("app-key-cut-range"), keyCut);
  setInputValue(settingsEl("app-key-cut-number"), keyCut);
  setInputValue(settingsEl("app-key-border"), keys.border || "1px solid rgba(0, 0, 0, 0.4)");
  const colorEl = (id, value, fallback) => {
    const el = (
      /** @type {HTMLInputElement|null} */
      settingsEl(id)
    );
    if (el) el.value = toHexColor(value, fallback);
  };
  colorEl("app-color-accent", color4.accent, "#4a90c8");
  colorEl("app-color-fg", color4.fg, "#dddddd");
  colorEl("app-color-fg-dim", color4.fgDim, "#aaaaaa");
  colorEl("app-color-panel", color4.panel, "#232323");
  colorEl("app-color-panel-edge", color4.panelEdge, "#3a3a3a");
  colorEl("app-color-title-top", color4.titleTop, "#4c4c4c");
  colorEl("app-color-title-mid", color4.titleMid, "#353535");
  colorEl("app-color-title-bot", color4.titleBot, "#252525");
  colorEl("app-color-kbd", color4.kbdColor || color4.fg, "#dddddd");
  setInputValue(settingsEl("app-type-ui-range"), typeUi);
  setInputValue(settingsEl("app-type-ui-number"), typeUi);
  setInputValue(settingsEl("app-type-kbd-range"), typeKbd);
  setInputValue(settingsEl("app-type-kbd-number"), typeKbd);
}
function applyAppearanceFromCache() {
  let overrides = {};
  try {
    const raw = localStorage.getItem("kp_theme_overrides_v1");
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) overrides = parsed;
  } catch {
    overrides = {};
  }
  let themeId = "dark-pro";
  try {
    const cached = localStorage.getItem("kp_theme_id_v1");
    if (cached) themeId = cached;
  } catch {
  }
  applyAppearanceControls({ themeId, themeOverrides: overrides });
}
function renderCursorPreview({ container, kind, uri }) {
  if (!container) return;
  container.style.cursor = "";
  container.innerHTML = "";
  if (kind === "native_arrow") {
    container.style.cursor = "default";
    container.textContent = "Uses native cursor (arrow)";
    return;
  }
  if (kind === "native_pointer") {
    container.style.cursor = "pointer";
    container.textContent = "Uses native cursor (pointer)";
    return;
  }
  if (!uri) {
    container.textContent = "Preview unavailable";
    return;
  }
  const img = document.createElement("img");
  img.alt = "Cursor preview";
  img.src = uri;
  container.appendChild(img);
}
function applyVisibility(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  el.style.display = visible ? "" : "none";
}
function withOptionalViewTransition(fn) {
  try {
    if (typeof document.startViewTransition === "function") {
      document.startViewTransition(() => {
        try {
          fn();
        } catch {
        }
      });
      return;
    }
  } catch {
  }
  fn();
}
async function render() {
  applySearchEngineIcons();
  const appRoot = settingsOne(".settings-app");
  const bindDom = !!(appRoot && appRoot !== settingsDomBoundApp);
  if (bindDom) settingsDomBoundApp = appRoot;
  const bindGlobal = !settingsHandlersInstalled;
  if (bindGlobal) settingsHandlersInstalled = true;
  if (bindDom || bindGlobal) {
    settingsUiAbort?.abort();
    settingsUiAbort = new AbortController();
  }
  const uiSignal = settingsUiAbort?.signal;
  if (bindDom) {
    installSettingsMasterDetailNav();
  }
  const radios = Array.from(settingsAll('input[type="radio"][name="engine"]'));
  const keyFeedbackToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("keyboard-reference-key-feedback")
  );
  const showNumberRowToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("keyboard-reference-show-number-row")
  );
  const keyboardHelpToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("settings-keyboard-help-toggle")
  );
  const keyboardHelpStateText = settingsEl("settings-keyboard-help-text");
  const keyboardLayoutFamilySelect = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("keyboard-layout-family")
  );
  const keyboardLeftHandedToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("keyboard-left-handed")
  );
  const controlStripVisible = (
    /** @type {HTMLInputElement|null} */
    settingsEl("control-strip-visible")
  );
  const controlStripCollapsed = (
    /** @type {HTMLInputElement|null} */
    settingsEl("control-strip-collapsed")
  );
  const cursorModeRadios = (
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="cursor-mode"]'))
  );
  const cursorSettingsClick = settingsEl("cursor-settings-click");
  const cursorSettingsText = settingsEl("cursor-settings-text");
  const clickCursorType = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("click-cursor-type")
  );
  const clickCursorLineWidthRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-linewidth-range")
  );
  const clickCursorLineWidthNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-linewidth-number")
  );
  const clickCursorSizeRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-size-range")
  );
  const clickCursorSizeNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-size-number")
  );
  const clickCursorGapRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-gap-range")
  );
  const clickCursorGapNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-cursor-gap-number")
  );
  const clickCursorPreview = settingsEl("click-cursor-preview");
  const clickFocusColor = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("click-focus-color")
  );
  const clickOverlayFill = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-overlay-fill")
  );
  const clickOverlayShadow = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-overlay-shadow")
  );
  const clickRectThicknessRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-rect-thickness-range")
  );
  const clickRectThicknessNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-rect-thickness-number")
  );
  const clickEffectRadios = (
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="click-effect"]'))
  );
  const clickKeyboardLinkHints = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-keyboard-link-hints")
  );
  const clickPaintStrategy = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("click-paint-strategy")
  );
  const clickPaintBackendDebug = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-paint-backend-debug")
  );
  const clickSkipForParent = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-skip-for-parent")
  );
  const clickFocusPaddingRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-focus-padding-range")
  );
  const clickFocusPaddingNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("click-focus-padding-number")
  );
  const clickCursorResetBtn = settingsEl("click-cursor-reset");
  const clickModeResetBtn = settingsEl("click-mode-reset");
  const uiThemeSelect = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("ui-theme-select")
  );
  const uiThemeSelectAppearance = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("ui-theme-select-appearance")
  );
  const settingsResetAllBtn = settingsEl("settings-reset-all");
  const settingsResetAppearanceBtn = settingsEl("settings-reset-appearance");
  const debugLoggingToggle = (
    /** @type {HTMLInputElement|null} */
    settingsEl("debug-logging")
  );
  const textCursorType = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("text-cursor-type")
  );
  const textCursorPreview = settingsEl("text-cursor-preview");
  const textCursorResetBtn = settingsEl("text-cursor-reset");
  const textFocusStyleRadios = (
    /** @type {HTMLInputElement[]} */
    Array.from(settingsAll('input[name="text-focus-style"]'))
  );
  const textLeftEdgeWidthField = settingsEl("text-left-edge-width-field");
  const textLeftEdgeWidthRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-left-edge-width-range")
  );
  const textLeftEdgeWidthNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-left-edge-width-number")
  );
  const textLabelsEnabled = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-labels-enabled")
  );
  const textStrokeThicknessRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-stroke-thickness-range")
  );
  const textStrokeThicknessNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("text-stroke-thickness-number")
  );
  const textModeResetBtn = settingsEl("text-mode-reset");
  const scrollHalfPageRange = (
    /** @type {HTMLInputElement|null} */
    settingsEl("scroll-half-page-range")
  );
  const scrollHalfPageNumber = (
    /** @type {HTMLInputElement|null} */
    settingsEl("scroll-half-page-number")
  );
  const scrollSpeedSelect = (
    /** @type {HTMLSelectElement|null} */
    settingsEl("scroll-speed")
  );
  const scrollMiddleClickScrollLine = (
    /** @type {HTMLInputElement|null} */
    settingsEl("scroll-middle-click-scroll-line")
  );
  const scrollLinePreferPortrait = (
    /** @type {HTMLInputElement|null} */
    settingsEl("scroll-line-prefer-portrait")
  );
  const scrollResetBtn = settingsEl("scroll-reset");
  const previewCursor = new CursorManager();
  const isTextEntry = (target) => {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase?.();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type2 = String(target.getAttribute?.("type") || target.type || "text").toLowerCase();
      return type2 === "text" || type2 === "search" || type2 === "url" || type2 === "email" || type2 === "tel" || type2 === "password" || type2 === "number";
    }
    return !!target.isContentEditable;
  };
  if (bindGlobal) {
    document.addEventListener("keydown", (e) => {
      if (!e) return;
      if (e.key !== "f" && e.key !== "F") return;
      if (isTextEntry(e.target)) return;
      if (e.defaultPrevented) return;
      if (e.cancelBubble) return;
      const kp = window.__KeyPilotInstance;
      if (!kp || typeof kp.handleActivateKey !== "function") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        kp.handleActivateKey();
      } catch {
      }
    }, { capture: false, signal: uiSignal });
  }
  const applyEngine = (engine) => {
    const normalized = normalizeSearchEngine(engine);
    radios.forEach((r) => {
      r.checked = r.value === normalized;
    });
  };
  const applyKeyFeedbackToggle = (enabled) => {
    if (!keyFeedbackToggle) return;
    keyFeedbackToggle.checked = !!enabled;
  };
  const applyShowNumberRowToggle = (enabled) => {
    if (!showNumberRowToggle) return;
    showNumberRowToggle.checked = !!enabled;
  };
  const applyKeyboardHelpVisible = (visible) => {
    const on = Boolean(visible);
    if (keyboardHelpToggle) keyboardHelpToggle.checked = on;
    if (keyboardHelpStateText) {
      keyboardHelpStateText.textContent = on ? "ON" : "OFF";
      keyboardHelpStateText.setAttribute("data-state", on ? "on" : "off");
    }
  };
  const ensureLayoutFamilyOptions = () => {
    if (!keyboardLayoutFamilySelect) return;
    keyboardLayoutFamilySelect.innerHTML = "";
    const items = Array.isArray(BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META) ? BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META : [];
    for (const m of items) {
      if (!m || !m.id) continue;
      const opt = document.createElement("option");
      opt.value = String(m.id);
      opt.textContent = String(m.label || m.id);
      keyboardLayoutFamilySelect.appendChild(opt);
    }
  };
  const applyKeyboardLayoutFamily = (familyId) => {
    if (!keyboardLayoutFamilySelect) return;
    const v = normalizeKeyboardLayoutFamilyId(familyId);
    setInputValue(keyboardLayoutFamilySelect, v);
  };
  const applyKeyboardHandedness = (handedness) => {
    if (!keyboardLeftHandedToggle) return;
    const h = normalizeKeyboardHandedness(handedness);
    keyboardLeftHandedToggle.checked = h === "left";
  };
  const applyControlStrip = (controlStrip) => {
    const cs = controlStrip || DEFAULT_SETTINGS.controlStrip;
    if (controlStripVisible) controlStripVisible.checked = !!cs?.visible;
    if (controlStripCollapsed) controlStripCollapsed.checked = !!cs?.collapsed;
  };
  const applyCursorMode = (cursorMode) => {
    const mode = normalizeCursorMode(cursorMode);
    cursorModeRadios.forEach((r) => {
      r.checked = r.value === mode;
    });
    const showCursorSettings = mode === CURSOR_MODE.CUSTOM_CURSORS;
    applyVisibility(cursorSettingsClick, showCursorSettings);
    applyVisibility(cursorSettingsText, showCursorSettings);
  };
  const applyClickMode = (clickMode) => {
    const cm = clickMode || DEFAULT_SETTINGS.clickMode;
    setInputValue(clickCursorType, cm?.cursor?.type ?? DEFAULT_SETTINGS.clickMode.cursor.type);
    setInputValue(clickCursorLineWidthRange, cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth);
    setInputValue(clickCursorLineWidthNumber, cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth);
    setInputValue(clickCursorSizeRange, cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels);
    setInputValue(clickCursorSizeNumber, cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels);
    setInputValue(clickCursorGapRange, cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap);
    setInputValue(clickCursorGapNumber, cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap);
    setInputValue(
      clickFocusColor,
      normalizeFocusColor(cm?.focusColor ?? DEFAULT_SETTINGS.clickMode.focusColor)
    );
    if (clickOverlayFill) {
      clickOverlayFill.checked = cm?.overlayFillEnabled === true;
    }
    if (clickOverlayShadow) {
      clickOverlayShadow.checked = cm?.overlayShadowEnabled === true;
    }
    setInputValue(clickRectThicknessRange, cm?.rectangleThickness ?? DEFAULT_SETTINGS.clickMode.rectangleThickness);
    setInputValue(clickRectThicknessNumber, cm?.rectangleThickness ?? DEFAULT_SETTINGS.clickMode.rectangleThickness);
    if (clickPaintStrategy) {
      clickPaintStrategy.value = normalizePaintStrategy(
        cm?.paintStrategy ?? DEFAULT_SETTINGS.clickMode.paintStrategy
      );
    }
    if (clickPaintBackendDebug) {
      clickPaintBackendDebug.checked = cm?.paintBackendDebugDashes === true;
    }
    if (clickSkipForParent) {
      clickSkipForParent.checked = cm?.skipForParent !== false;
    }
    setInputValue(clickFocusPaddingRange, cm?.focusPadding ?? DEFAULT_SETTINGS.clickMode.focusPadding);
    setInputValue(clickFocusPaddingNumber, cm?.focusPadding ?? DEFAULT_SETTINGS.clickMode.focusPadding);
    const effect = cm?.clickEffect ?? DEFAULT_SETTINGS.clickMode.clickEffect ?? "flash";
    clickEffectRadios.forEach((r) => {
      r.checked = r.value === effect;
    });
    if (clickKeyboardLinkHints) {
      clickKeyboardLinkHints.checked = cm?.keyboardLinkHoverHints === true;
    }
    const type2 = cm?.cursor?.type ?? DEFAULT_SETTINGS.clickMode.cursor.type;
    if (type2 === "native_arrow" || type2 === "native_pointer") {
      renderCursorPreview({ container: clickCursorPreview, kind: type2 });
    } else {
      const strokeWidth = cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth;
      const sizePixels = cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels;
      const gap = cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap;
      const uri = previewCursor.getCursorDataUri("none", {
        strokeWidth,
        crossHairQuadrantWidth: sizePixels,
        gap
      });
      renderCursorPreview({ container: clickCursorPreview, kind: "crosshair", uri });
    }
  };
  const applyTextMode = (textMode) => {
    const tm = textMode || DEFAULT_SETTINGS.textMode;
    setInputValue(textCursorType, tm?.cursorType ?? DEFAULT_SETTINGS.textMode.cursorType);
    if (textLabelsEnabled) textLabelsEnabled.checked = !!tm?.labelsEnabled;
    setInputValue(textStrokeThicknessRange, tm?.strokeThickness ?? DEFAULT_SETTINGS.textMode.strokeThickness);
    setInputValue(textStrokeThicknessNumber, tm?.strokeThickness ?? DEFAULT_SETTINGS.textMode.strokeThickness);
    setInputValue(textLeftEdgeWidthRange, tm?.leftEdgeWidth ?? DEFAULT_SETTINGS.textMode.leftEdgeWidth);
    setInputValue(textLeftEdgeWidthNumber, tm?.leftEdgeWidth ?? DEFAULT_SETTINGS.textMode.leftEdgeWidth);
    const focusStyle = normalizeTextFocusStyle(tm?.focusStyle ?? DEFAULT_SETTINGS.textMode.focusStyle);
    textFocusStyleRadios.forEach((r) => {
      r.checked = r.value === focusStyle;
    });
    applyVisibility(textLeftEdgeWidthField, focusStyle === "left_edge");
    const type2 = tm?.cursorType ?? DEFAULT_SETTINGS.textMode.cursorType;
    if (type2 === "crosshair") {
      const uri = previewCursor.getCursorDataUri("text_focus", { hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: "crosshair", uri });
    } else {
      const uri = previewCursor.getCursorDataUri("text_focus", { cursorType: "t_square", hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: "t_square", uri });
    }
  };
  const applyThemeSelect = (settings) => {
    const themeId = normalizeThemeId(settings?.themeId);
    const customized = hasThemeOverrides(settings?.themeOverrides);
    const labelFor = (id) => themeDisplayName(id, customized && id === themeId);
    const fillSelect = (el) => {
      if (!el) return;
      const items = listThemes();
      if (el.options.length !== items.length) {
        el.innerHTML = "";
        for (const item of items) {
          const opt = document.createElement("option");
          opt.value = item.id;
          opt.textContent = labelFor(item.id);
          el.appendChild(opt);
        }
      } else {
        Array.from(el.options).forEach((opt) => {
          opt.textContent = labelFor(opt.value);
        });
      }
      el.value = themeId;
    };
    fillSelect(uiThemeSelect);
    fillSelect(uiThemeSelectAppearance);
    const badges = [
      settingsEl("ui-theme-custom-badge"),
      settingsEl("ui-theme-custom-badge-appearance")
    ];
    badges.forEach((badge) => {
      if (!badge) return;
      badge.hidden = !customized;
    });
  };
  const paintPageTheme = (settings) => {
    try {
      const theme = resolveThemeFromSettings(settings);
      const roots = [document];
      if (settingsScope && settingsScope !== document) roots.push(settingsScope);
      applyThemeToRoots(theme, {
        roots,
        hosts: [document.documentElement, settingsScope?.host].filter(Boolean)
      });
    } catch {
    }
  };
  const applyScroll = (scroll) => {
    const sc = scroll || DEFAULT_SETTINGS.scroll;
    const half = sc?.halfPagePx ?? DEFAULT_SETTINGS.scroll.halfPagePx;
    const speed = sc?.speed === "instant" ? "instant" : "smooth";
    setInputValue(scrollHalfPageRange, half);
    setInputValue(scrollHalfPageNumber, half);
    setInputValue(scrollSpeedSelect, speed);
    if (scrollMiddleClickScrollLine) {
      scrollMiddleClickScrollLine.checked = !!sc?.middleClickScrollLine;
    }
    if (scrollLinePreferPortrait) {
      scrollLinePreferPortrait.checked = sc?.linePreferPortraitTargets !== false;
    }
  };
  const applyDebugLogging = (enabled) => {
    const on = !!enabled;
    if (debugLoggingToggle) debugLoggingToggle.checked = on;
    applyDebugSetting(on);
  };
  const applyAllSettings = (settings) => {
    const s = settings || DEFAULT_SETTINGS;
    lastUiSettings = s;
    applyThemeSelect(s);
    applyAppearanceControls(s);
    paintPageTheme(s);
    applyEngine(s.searchEngine);
    applyCursorMode(s.cursorMode);
    applyKeyboardLayoutFamily(s.keyboardLayoutFamilyId);
    applyKeyboardHandedness(s.keyboardHandedness);
    applyKeyFeedbackToggle(s.keyboardReferenceKeyFeedback);
    applyShowNumberRowToggle(s.keyboardReferenceShowNumberRow);
    applyControlStrip(s.controlStrip);
    applyClickMode(s.clickMode);
    applyTextMode(s.textMode);
    applyScroll(s.scroll);
    applyDebugLogging(s.debugLogging);
  };
  try {
    if (uiThemeSelect) {
      uiThemeSelect.replaceChildren();
      for (const t of listThemes()) {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        uiThemeSelect.appendChild(opt);
      }
    }
    ensureLayoutFamilyOptions();
    if (!settingsController || settingsController.disposed) {
      settingsController = createSettingsController();
    }
    if (settingsControllerUnsub) {
      try {
        settingsControllerUnsub();
      } catch {
      }
      settingsControllerUnsub = null;
    }
    settingsControllerUnsub = settingsController.subscribe((s) => applyAllSettings(s));
    const live = getLiveSettingsSnapshot();
    await settingsController.load({ snapshot: live });
  } catch {
    ensureLayoutFamilyOptions();
    applyAllSettings(DEFAULT_SETTINGS);
  }
  queryKeyboardHelpVisible().then(applyKeyboardHelpVisible).catch(() => applyKeyboardHelpVisible(false));
  if (!bindDom && !bindGlobal) return;
  if (!settingsController) return;
  const signal = settingsUiAbort?.signal;
  if (!signal) return;
  const listenOpts = { signal, capture: true };
  bindSettingsControls({
    controller: settingsController,
    el: settingsEl,
    all: settingsAll,
    setInputValue,
    signal,
    withViewTransition: withOptionalViewTransition,
    applyState: applyAllSettings
  });
  uiThemeSelect?.addEventListener("change", () => {
    void settingsController.applyThemePack(uiThemeSelect.value);
  }, listenOpts);
  uiThemeSelectAppearance?.addEventListener("change", () => {
    void settingsController.applyThemePack(uiThemeSelectAppearance.value);
  }, listenOpts);
  settingsResetAppearanceBtn?.addEventListener("click", () => {
    void settingsController.reset("appearance");
  }, listenOpts);
  settingsResetAllBtn?.addEventListener("click", async () => {
    const ok = typeof window.confirm === "function" ? window.confirm("Reset all KeyPilot settings to defaults? This cannot be undone.") : true;
    if (!ok) return;
    await settingsController.reset("all");
  }, listenOpts);
  keyboardHelpToggle?.addEventListener("change", async () => {
    const desired = !!keyboardHelpToggle.checked;
    keyboardHelpToggle.disabled = true;
    try {
      const actual = await setKeyboardHelpVisible(desired);
      applyKeyboardHelpVisible(actual);
    } catch {
      applyKeyboardHelpVisible(await queryKeyboardHelpVisible());
    } finally {
      keyboardHelpToggle.disabled = false;
    }
  }, listenOpts);
  clickCursorResetBtn?.addEventListener("click", () => {
    void settingsController.reset("click-cursor");
  }, listenOpts);
  clickModeResetBtn?.addEventListener("click", () => {
    void settingsController.reset("click-mode");
  }, listenOpts);
  textCursorResetBtn?.addEventListener("click", () => {
    void settingsController.reset("text-cursor");
  }, listenOpts);
  textModeResetBtn?.addEventListener("click", () => {
    void settingsController.reset("text-mode");
  }, listenOpts);
  scrollResetBtn?.addEventListener("click", () => {
    void settingsController.reset("scroll");
  }, listenOpts);
  try {
    const onHelpStorage = (changes, area) => {
      if (signal.aborted) return;
      if (area !== "sync" && area !== "local") return;
      const helpChange = changes?.[KEYBOARD_HELP_STORAGE_KEY];
      if (helpChange && typeof helpChange.newValue === "boolean") {
        applyKeyboardHelpVisible(helpChange.newValue);
      }
    };
    chrome.storage.onChanged.addListener(onHelpStorage);
    signal.addEventListener("abort", () => {
      try {
        chrome.storage.onChanged.removeListener(onHelpStorage);
      } catch {
      }
    }, { once: true });
  } catch {
  }
}
async function injectSettingsDom(root) {
  if (root.querySelector?.(".settings-app")) return;
  const url = chrome.runtime.getURL("pages/settings.html");
  const stylesheetHrefs = ["pages/ui-standards.css", "pages/settings.css"];
  const [html, ...cssTexts] = await Promise.all([
    fetch(url).then((res) => res.text()),
    ...stylesheetHrefs.map(
      (href) => fetch(chrome.runtime.getURL(href)).then((res) => res.text())
    )
  ]);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  for (const cssText of cssTexts) {
    const style = document.createElement("style");
    style.textContent = cssText;
    root.appendChild(style);
  }
  const sprite = parsed.querySelector(".settings-icon-sprite");
  const app = parsed.querySelector(".settings-app");
  if (sprite) root.appendChild(document.importNode(sprite, true));
  if (app) root.appendChild(document.importNode(app, true));
}
function setActiveSettingsPanel(panelId) {
  const id = normalizeSettingsPanelId(panelId);
  if (!id || !settingsDomBoundApp) return false;
  activateSettingsPanel(id, { focusTab: true });
  return true;
}
async function mountSettingsApp(root, options = {}) {
  const embedded = options.embedded === true;
  pendingInitialPanel = normalizeSettingsPanelId(options.initialPanel) || null;
  if (root && root.nodeType !== 9) {
    await injectSettingsDom(root);
    settingsScope = root;
  } else {
    settingsScope = document;
  }
  adaptHeaderForPopoverEmbed(embedded);
  try {
    applyAppearanceFromCache();
  } catch {
  }
  await render();
  return () => {
    try {
      settingsUiAbort?.abort();
    } catch {
    }
    settingsUiAbort = null;
    if (settingsControllerUnsub) {
      try {
        settingsControllerUnsub();
      } catch {
      }
      settingsControllerUnsub = null;
    }
    try {
      settingsController?.dispose();
    } catch {
    }
    settingsController = null;
    settingsHandlersInstalled = false;
    settingsScope = document;
    settingsDomBoundApp = null;
    pendingInitialPanel = null;
  };
}
export {
  applyAppearanceControls,
  mountSettingsApp,
  setActiveSettingsPanel
};
