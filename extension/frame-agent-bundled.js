/**
 * KeyPilot Chrome Extension — esbuild bundle
 * Generated on 2026-08-13T03:07:33.406Z
 */

(() => {
  // src/messaging/types.js
  var MSG = Object.freeze({
    // --- Extension enable / status ---
    GET_STATE: "KP_GET_STATE",
    SET_STATE: "KP_SET_STATE",
    TOGGLE_STATE: "KP_TOGGLE_STATE",
    STATE_RESPONSE: "KP_STATE_RESPONSE",
    STATE_CHANGED: "KP_STATE_CHANGED",
    UPDATE_STATE: "KP_UPDATE_STATE",
    GET_STATUS: "KP_GET_STATUS",
    STATUS: "KP_STATUS",
    // --- Transient onboarding actions ---
    TRANSIENT_ACTION: "KP_TRANSIENT_ACTION",
    // --- Tab / history navigation ---
    TAB_LEFT: "KP_TAB_LEFT",
    TAB_RIGHT: "KP_TAB_RIGHT",
    NEW_TAB: "KP_NEW_TAB",
    CLOSE_TAB: "KP_CLOSE_TAB",
    GO_BACK: "KP_GO_BACK",
    GO_FORWARD: "KP_GO_FORWARD",
    OPEN_URL_BACKGROUND: "KP_OPEN_URL_BACKGROUND",
    OPEN_URL_FOREGROUND: "KP_OPEN_URL_FOREGROUND",
    /** Same-tab navigate (chrome.tabs.update). Used when sandboxed iframes cannot top-navigate without a real user gesture. */
    NAVIGATE_SAME_TAB: "KP_NAVIGATE_SAME_TAB",
    // --- UI open (content-script handlers; SW may forward) ---
    OPEN_SETTINGS_POPOVER: "KP_OPEN_SETTINGS_POPOVER",
    OPEN_GUIDE_POPOVER: "KP_OPEN_GUIDE_POPOVER",
    OPEN_ONBOARDING: "KP_OPEN_ONBOARDING",
    /** Reset walkthrough progress and open it (e.g. Guide "Launch Walkthrough"). */
    LAUNCH_WALKTHROUGH: "KP_LAUNCH_WALKTHROUGH",
    // --- History / bookmarks / favicon (SW APIs for content scripts) ---
    OMNIBOX_SUGGEST: "KP_OMNIBOX_SUGGEST",
    GET_BOOKMARKS: "KP_GET_BOOKMARKS",
    BROWSER_HISTORY_GET: "KP_BROWSER_HISTORY_GET",
    GET_TOP_SITES: "KP_GET_TOP_SITES",
    GET_HISTORY_FOR_DOMAINS: "KP_GET_HISTORY_FOR_DOMAINS",
    GET_RECENT_HISTORY: "KP_GET_RECENT_HISTORY",
    GET_FAVICON: "KP_GET_FAVICON",
    // --- Page preview screenshots for card backgrounds ---
    GET_PAGE_THUMB: "KP_GET_PAGE_THUMB",
    PAGE_THUMB_RESPONSE: "KP_PAGE_THUMB_RESPONSE",
    PAGE_THUMB_UPDATED: "KP_PAGE_THUMB_UPDATED",
    GET_VIDEO_THUMB: "KP_GET_VIDEO_THUMB",
    VIDEO_THUMB_RESPONSE: "KP_VIDEO_THUMB_RESPONSE",
    // --- Per-tab navigation graph ---
    NAVGRAPH_GET: "KP_NAVGRAPH_GET",
    NAVGRAPH_JUMP: "KP_NAVGRAPH_JUMP",
    NAVGRAPH_CLEAR: "KP_NAVGRAPH_CLEAR",
    // --- Generic ---
    SUCCESS: "KP_SUCCESS",
    ERROR: "KP_ERROR",
    // --- Link Preview mobile User-Agent (SW declarativeNetRequest session rules) ---
    SET_PREVIEW_MOBILE_UA: "KP_SET_PREVIEW_MOBILE_UA",
    // --- Parent ↔ popover iframe (window.postMessage) ---
    POPOVER_BRIDGE_INIT: "KP_POPOVER_BRIDGE_INIT",
    POPOVER_BRIDGE_READY: "KP_POPOVER_BRIDGE_READY",
    POPOVER_REQUEST_CLOSE: "KP_POPOVER_REQUEST_CLOSE",
    POPOVER_BRIDGE_KEYDOWN: "KP_POPOVER_BRIDGE_KEYDOWN",
    POPOVER_SCROLL: "KP_POPOVER_SCROLL",
    /** Guide iframe → parent: close guide and open walkthrough from a reset state. */
    POPOVER_LAUNCH_WALKTHROUGH: "KP_POPOVER_LAUNCH_WALKTHROUGH",
    // --- Parent → child frame activate (window.postMessage; third-party iframes) ---
    // Top-frame KeyPilot posts this when F/B/G lands on a cross-origin <iframe>.
    // Child frame-click-agent performs elementFromPoint + click in its own document.
    // Optional topOrigin: parent tab origin for link routing (no hardcoded domains).
    FRAME_ACTIVATE: "KP_FRAME_ACTIVATE",
    // --- Parent → child frame scroll (window.postMessage; C/V/Z/X under an iframe) ---
    // Top-frame KeyPilot posts this when scroll keys land on an <iframe> shell. Child
    // frame-click-agent runs scroll-at-point (delta or edge) at local coordinates
    // (nested overflow first, then the frame document).
    FRAME_SCROLL: "KP_FRAME_SCROLL",
    // --- Child → parent pointer sync (window.postMessage) ---
    // Frame agent reports local client coords so top KeyPilot can keep lastMouse fresh
    // while the pointer is over a cross-origin (or any) iframe — parent documents do
    // not receive mousemove inside iframes. Nested agents re-bubble with translated coords.
    // Payload: { type, inside: boolean, clientX?: number, clientY?: number }
    FRAME_POINTER: "KP_FRAME_POINTER",
    // --- Child → parent: return keyboard focus to the top frame ---
    // Sent on Esc / pointer leave when the iframe had document focus (manual click).
    // Top blurs the focused <iframe> so KeyPilot keybinds work on the parent again.
    FRAME_FOCUS_RECLAIM: "KP_FRAME_FOCUS_RECLAIM",
    // --- Child frame-agent → SW: inject full content-bundled.js into this frame ---
    // Used when a KeyPilot popover iframe needs full KeyPilot (cursor/overlays).
    // Thin frame-agent-bundled.js does not include the full app.
    INJECT_FULL_KEYPILOT_IN_FRAME: "KP_INJECT_FULL_KEYPILOT_IN_FRAME"
  });
  var TAB_UI_FORWARD_TYPES = Object.freeze([
    MSG.OPEN_SETTINGS_POPOVER,
    MSG.OPEN_GUIDE_POPOVER,
    MSG.OPEN_ONBOARDING,
    MSG.LAUNCH_WALKTHROUGH
  ]);

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
      description: "Click Element",
      keyboardClass: "key-activate",
      row: 2
    }),
    // Foreground new tab (switch to the new tab).
    ACTIVATE_NEW_TAB: Object.freeze({
      handler: "handleActivateNewTabKey",
      label: "Click New Tab",
      description: "Open Link in New Tab (Foreground)",
      keyboardClass: "key-activate-new",
      row: 2
    }),
    // Background new tab (middle-click style; do not switch focus).
    ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({
      handler: "handleActivateNewTabBackgroundKey",
      label: "Click New Tab Background",
      description: "Open Link in New Tab (Background, like middle click)",
      keyboardClass: "key-activate-new-over",
      row: 2
    }),
    BACK: Object.freeze({
      handler: "handleBackKey",
      label: "Go Back",
      description: "Go Back (History)",
      keyboardClass: "key-back",
      row: 2
    }),
    BACK2: Object.freeze({
      handler: "handleBackKey",
      label: "Go Back",
      description: "Go Back (History)",
      keyboardClass: "key-back",
      row: 2
    }),
    FORWARD: Object.freeze({
      handler: "handleForwardKey",
      label: "Go Forward",
      description: "Go Forward (History)",
      keyboardClass: "key-forward",
      row: 1
    }),
    DELETE: Object.freeze({
      handler: "handleDeleteKey",
      label: "Delete Mode",
      description: "Delete Mode",
      keyboardClass: "key-delete",
      row: 2
    }),
    COLS_TOGGLE: Object.freeze({
      handler: "handleColsToggleKey",
      label: "Cols Toggle",
      description: "Columnize element under cursor (multi-column layout)",
      keyboardClass: "key-cols",
      row: 3
    }),
    TAB_LEFT: Object.freeze({
      handler: "handleTabLeftKey",
      label: "Tab Left",
      description: "Move To Previous Tab",
      keyboardClass: "key-gray",
      row: 1
    }),
    TAB_RIGHT: Object.freeze({
      handler: "handleTabRightKey",
      label: "Tab Right",
      description: "Move To Next Tab",
      keyboardClass: "key-gray",
      row: 1
    }),
    ROOT: Object.freeze({
      handler: "handleRootKey",
      label: "Go to Site Root",
      description: "Go to Site Root",
      keyboardClass: null,
      row: null
    }),
    LAUNCHER: Object.freeze({
      handler: "handleLauncherKey",
      label: "Launcher",
      description: "Open Launcher (Quick Access to Sites)",
      keyboardClass: "key-launcher-orange",
      row: 2
    }),
    CLOSE_TAB: Object.freeze({
      handler: "handleCloseTabKey",
      label: "Close Tab",
      description: "Close Tab",
      keyboardClass: "key-close-tab",
      row: 3
    }),
    CANCEL: Object.freeze({
      handler: "cancelModes",
      label: "Exit Focus",
      description: "Exit Focus",
      keyboardClass: null,
      row: null
    }),
    PAGE_UP_INSTANT: Object.freeze({
      handler: "handleInstantPageUp",
      label: "Page Up Fast",
      description: "Page Up (Instant)",
      keyboardClass: "key-scroll",
      row: 3
    }),
    PAGE_DOWN_INSTANT: Object.freeze({
      handler: "handleInstantPageDown",
      label: "Page Down Fast",
      description: "Page Down (Instant)",
      keyboardClass: "key-scroll",
      row: 3
    }),
    PAGE_TOP: Object.freeze({
      handler: "handlePageTop",
      label: "Scroll To Top",
      description: "Scroll to Top",
      keyboardClass: "key-scroll",
      row: 3
    }),
    PAGE_BOTTOM: Object.freeze({
      handler: "handlePageBottom",
      label: "Scroll To Bottom",
      description: "Scroll to Bottom",
      keyboardClass: "key-scroll",
      row: 3
    }),
    SCROLL_LINE: Object.freeze({
      handler: "handleScrollLineKey",
      label: "Scroll Line",
      description: "Scroll from a fixed origin: move the mouse away from the dot to scroll faster",
      keyboardClass: "key-scroll",
      row: 3,
      mode: "scroll_line",
      cancelOnPointerDown: true
    }),
    NEW_TAB: Object.freeze({
      handler: "handleNewTabKey",
      label: "New Tab",
      description: "Open New Tab",
      keyboardClass: "key-gray",
      row: 1
    }),
    OPEN_POPOVER: Object.freeze({
      handler: "handleOpenPopover",
      label: "Open Popover",
      description: "Open Link in Popover",
      keyboardClass: "key-open-popover",
      row: 2
    }),
    PREVIEW_LINK_POPOVER: Object.freeze({
      handler: "handlePreviewLinkPopover",
      label: "Preview Link",
      description: "Open Link Preview in Popover",
      keyboardClass: "key-preview-popover",
      row: 2
    }),
    OPEN_SETTINGS_POPOVER: Object.freeze({
      handler: "handleToggleSettingsPopover",
      label: "Settings",
      description: "Open KeyPilot Settings",
      keyboardClass: "key-settings-dark",
      row: null
    }),
    OMNIBOX: Object.freeze({
      handler: "handleOpenOmnibox",
      label: "Omnibox",
      description: "Open Omnibox (Address Bar Overlay)",
      keyboardClass: "key-orange",
      row: 2
    }),
    TAB_HISTORY: Object.freeze({
      handler: "handleToggleTabHistoryPopover",
      label: "Tab History",
      description: "Open Tab History (Branch-Retaining)",
      keyboardClass: "key-gray",
      row: 2
    }),
    TOGGLE_KEYBOARD_HELP: Object.freeze({
      handler: "handleToggleKeyboardHelp",
      label: "KB Reference",
      description: "Show/Hide the floating KeyPilot keyboard reference",
      keyboardClass: "key-purple",
      row: 2
    }),
    // Text select: default character-level (H on right-handed layout).
    HIGHLIGHT: Object.freeze({
      handler: "handleHighlightKey",
      label: "Text Select",
      description: "Select text (character level)",
      keyboardClass: "key-highlight",
      row: 2
    }),
    // Rectangle region select (Y on right-handed; R free on left-handed).
    RECTANGLE_HIGHLIGHT: Object.freeze({
      handler: "handleRectangleHighlightKey",
      label: "Element Select",
      description: "Select intersecting HTML elements in a rectangle (or pick cumulative)",
      keyboardClass: "key-rect-highlight",
      row: 1
    }),
    // Copy image under cursor (I on right-handed; E on left-handed — I is OPEN_POPOVER there).
    COPY_HOVERED_IMAGE: Object.freeze({
      handler: "handleCopyHoveredImageKey",
      label: "Copy Image",
      description: "Copy image under cursor to clipboard",
      // Default key face (no tinted key-gray / family fill).
      keyboardClass: null,
      row: 1
    }),
    // Page-wide Image / Video / Text gallery (O on right-handed; O is TAB_RIGHT on left-handed).
    PAGE_MEDIA: Object.freeze({
      handler: "handlePageMediaKey",
      label: "Page Media",
      description: "Browse images, videos, and documents found on this page",
      keyboardClass: null,
      row: 1
    }),
    // Media Library entry point (M on right-handed only — M is PAGE_DOWN_INSTANT on left-handed,
    // so this doesn't get a default binding there yet). Media Library itself isn't built yet;
    // the handler just shows a "coming soon" notification — see `handleMediaLibraryNotAvailableKey`
    // and the `ADD_URL_TO_MEDIA_LIBRARY`/`FETCH_URL_FOR_MEDIA_LIBRARY` Functions in
    // function-library.js.
    OPEN_MEDIA_LIBRARY: Object.freeze({
      handler: "handleMediaLibraryNotAvailableKey",
      label: "Media Library",
      description: "Open the Media Library (coming soon).",
      keyboardClass: null,
      row: 1
    }),
    // Clipboard commands (Functions palette — Clipboard category).
    CLIPBOARD_COPY: Object.freeze({
      handler: "handleClipboardCopyKey",
      label: "Copy",
      description: "Copy selected text to the clipboard",
      keyboardClass: null,
      row: null
    }),
    CLIPBOARD_CUT: Object.freeze({
      handler: "handleClipboardCutKey",
      label: "Cut",
      description: "Cut selected text to the clipboard",
      keyboardClass: null,
      row: null
    }),
    CLIPBOARD_PASTE: Object.freeze({
      handler: "handleClipboardPasteKey",
      label: "Paste",
      description: "Paste clipboard text into the focused field",
      keyboardClass: null,
      row: null
    }),
    CLIPBOARD_SELECT_ALL: Object.freeze({
      handler: "handleClipboardSelectAllKey",
      label: "Select All",
      description: "Select all text in the focused field or page",
      keyboardClass: null,
      row: null
    }),
    // AI (Functions palette — AI category).
    SEND_TEXT_TO_AI: Object.freeze({
      handler: "handleSendTextToAiKey",
      label: "Send Text To AI",
      description: "Send selected text to AI with a configurable instruction; route the result to clipboard and/or popover",
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
    PAGE_MEDIA: "Get Page Data",
    DELETE: "Select",
    COLS_TOGGLE: "Select",
    OPEN_MEDIA_LIBRARY: "Media Library",
    CLIPBOARD_COPY: "Clipboard",
    CLIPBOARD_CUT: "Clipboard",
    CLIPBOARD_PASTE: "Clipboard",
    CLIPBOARD_SELECT_ALL: "Clipboard",
    SEND_TEXT_TO_AI: "AI",
    LAUNCHER: "Begin URL",
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
  var ASSIGNMENTS_BROWSING_RIGHT = Object.freeze({
    TAB_LEFT: Object.freeze({ keys: ["q", "Q"] }),
    TAB_RIGHT: Object.freeze({ keys: ["w", "W"] }),
    OPEN_POPOVER: Object.freeze({ keys: ["p", "P"] }),
    PREVIEW_LINK_POPOVER: Object.freeze({ keys: ["e", "E"] }),
    FORWARD: Object.freeze({ keys: ["r", "R"] }),
    NEW_TAB: Object.freeze({ keys: ["t", "T"] }),
    CLOSE_TAB: Object.freeze({ keys: ["a", "A"] }),
    BACK2: Object.freeze({ keys: ["s", "S"] }),
    BACK: Object.freeze({ keys: ["d", "D"] }),
    ACTIVATE: Object.freeze({ keys: ["f", "F"] }),
    ACTIVATE_NEW_TAB_BACKGROUND: Object.freeze({ keys: ["g", "G"] }),
    HIGHLIGHT: Object.freeze({ keys: ["h", "H"] }),
    TAB_HISTORY: Object.freeze({ keys: ["j", "J"] }),
    OMNIBOX: Object.freeze({ keys: ["l", "L"] }),
    LAUNCHER: Object.freeze({ keys: [";", ":", "Semicolon", "`", "~", "Backquote"], matchOn: ["key", "code"], displayKey: ";", keyLabel: ";" }),
    PAGE_TOP: Object.freeze({ keys: ["z", "Z"] }),
    PAGE_BOTTOM: Object.freeze({ keys: ["x", "X"] }),
    PAGE_UP_INSTANT: Object.freeze({ keys: ["c", "C"] }),
    PAGE_DOWN_INSTANT: Object.freeze({ keys: ["v", "V"] }),
    ACTIVATE_NEW_TAB: Object.freeze({ keys: ["b", "B"] }),
    SCROLL_LINE: Object.freeze({ keys: ["n", "N"] }),
    RECTANGLE_HIGHLIGHT: Object.freeze({ keys: ["y", "Y"] }),
    COPY_HOVERED_IMAGE: Object.freeze({ keys: ["i", "I"] }),
    PAGE_MEDIA: Object.freeze({ keys: ["o", "O"] }),
    // M is otherwise unused on the right-handed layout (it's PAGE_DOWN_INSTANT on left-handed).
    OPEN_MEDIA_LIBRARY: Object.freeze({ keys: ["m", "M"] }),
    ROOT: Object.freeze({ keys: ["1", "!"], displayKey: "1", keyLabel: "1" }),
    DELETE: Object.freeze({ keys: ["Backspace"], displayKey: "Backspace", keyLabel: "Backspace" }),
    COLS_TOGGLE: Object.freeze({ keys: [".", ">"], displayKey: ".", keyLabel: "." })
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
    BACK2: Object.freeze({ keys: ["l", "L"] }),
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
    LAUNCHER: Object.freeze({ keys: ["a", "A", "`", "~", "Backquote"], matchOn: ["key", "code"], displayKey: "a/`", keyLabel: "a/`" }),
    // Bottom row cluster: Z X C V B  ->  / . , M N (mirrored)
    // Period reserved for COLS_TOGGLE (same muscle memory as right-handed).
    PAGE_TOP: Object.freeze({ keys: ["/", "?"], displayKey: "/", keyLabel: "/" }),
    PAGE_BOTTOM: Object.freeze({ keys: ["b", "B"] }),
    PAGE_UP_INSTANT: Object.freeze({ keys: [",", "<"], displayKey: ",", keyLabel: "," }),
    PAGE_DOWN_INSTANT: Object.freeze({ keys: ["m", "M"] }),
    ACTIVATE_NEW_TAB: Object.freeze({ keys: ["n", "N"] }),
    COLS_TOGGLE: Object.freeze({ keys: [".", ">"], displayKey: ".", keyLabel: "." }),
    // I is OPEN_POPOVER on left-handed; E is free.
    COPY_HOVERED_IMAGE: Object.freeze({ keys: ["e", "E"] }),
    ROOT: Object.freeze({ keys: ["1", "!"], displayKey: "1", keyLabel: "1" }),
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
    "BACK2",
    "PAGE_TOP",
    "PAGE_BOTTOM",
    "PAGE_UP_INSTANT",
    "PAGE_DOWN_INSTANT"
  ]);
  var CLICK_HISTORY_ACTION_IDS = Object.freeze([
    "ACTIVATE",
    "BACK",
    "BACK2",
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
      if (source[id]) out[id] = source[id];
    }
    for (const [id, assignment] of Object.entries(source || {})) {
      if (allowed.has(id) && !out[id]) out[id] = assignment;
    }
    return Object.freeze(out);
  }
  function letterFromAssignment(assignment) {
    if (!assignment) return "";
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
            if (allowed.has(cell.id)) return cell;
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
      { type: "key", text: "U" },
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
      { type: "action", id: "BACK2", fallbackText: "Go Back" },
      { type: "action", id: "BACK", fallbackText: "Go Back" },
      { type: "action", id: "ACTIVATE", fallbackText: "Click Element" },
      { type: "action", id: "ACTIVATE_NEW_TAB_BACKGROUND", fallbackText: "Click New Tab Background" },
      { type: "action", id: "HIGHLIGHT", fallbackText: "Text Select" },
      { type: "action", id: "TAB_HISTORY", fallbackText: "History" },
      { type: "action", id: "TOGGLE_KEYBOARD_HELP", fallbackText: "KB Reference" },
      { type: "action", id: "OMNIBOX", fallbackText: "Omnibox" },
      { type: "action", id: "LAUNCHER", fallbackText: "Launcher" },
      { type: "action", id: "OPEN_SETTINGS_POPOVER", fallbackText: "Settings" },
      { type: "special", text: "Enter", className: "key key-enter" }
    ],
    [
      { type: "special", text: "Shift", className: "key key-shift" },
      { type: "action", id: "PAGE_TOP", fallbackText: "Scroll To Top" },
      { type: "action", id: "PAGE_BOTTOM", fallbackText: "Scroll To Bottom" },
      { type: "action", id: "PAGE_UP_INSTANT", fallbackText: "Page Up Fast" },
      { type: "action", id: "PAGE_DOWN_INSTANT", fallbackText: "Page Down Fast" },
      { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
      { type: "action", id: "SCROLL_LINE", fallbackText: "Scroll Line" },
      { type: "action", id: "OPEN_MEDIA_LIBRARY", fallbackText: "Media Library" },
      { type: "key", text: "," },
      { type: "action", id: "COLS_TOGGLE", fallbackText: "Cols Toggle" },
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
      { type: "action", id: "LAUNCHER", fallbackText: "Launcher" },
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
      { type: "action", id: "BACK2", fallbackText: "Go Back" },
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
      { type: "action", id: "PAGE_DOWN_INSTANT", fallbackText: "Page Down Fast" },
      // M
      { type: "action", id: "PAGE_UP_INSTANT", fallbackText: "Page Up Fast" },
      // ,
      { type: "action", id: "COLS_TOGGLE", fallbackText: "Cols Toggle" },
      // .
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
  var CSS_CLASSES = {
    CURSOR_HIDDEN: "kpv2-cursor-hidden",
    FOCUS: "kpv2-focus",
    DELETE: "kpv2-delete",
    HIGHLIGHT: "kpv2-highlight",
    HIDDEN: "kpv2-hidden",
    RIPPLE: "kpv2-ripple",
    FOCUS_OVERLAY: "kpv2-focus-overlay",
    /** Scroll Line origin-dot + line (popover / top-layer chrome) */
    SCROLL_LINE_OVERLAY: "kpv2-scroll-line",
    /**
     * Strategy B: in-target absolute focus ring — mounted as last child of the
     * clickable/host with local max z-index + 1. Co-located paint; scrolls with
     * the element. Preference order: A DOM outline → B this ring → C body fixed.
     */
    FOCUS_RING_INTARGET: "kpv2-focus-ring-intarget",
    /** Temporary outline that scales up on F-click activation */
    FOCUS_PULSE: "kpv2-focus-pulse",
    /** Temporary outline with a marquee/chaser light traveling the perimeter on F-click */
    FOCUS_MARQUEE: "kpv2-focus-marquee",
    /** Temporary hard flash (strobe) on F-click activation */
    FOCUS_FLASH: "kpv2-focus-flash",
    /** Temporary dashed border whose dashes chase around the perimeter on F-click */
    FOCUS_DASH: "kpv2-focus-dash",
    /** Temporary frame that scales (pop then shrink) when copying an image under cursor */
    IMAGE_COPY_PULSE: "kpv2-image-copy-pulse",
    DELETE_OVERLAY: "kpv2-delete-overlay",
    /**
     * Shared inspector-mode hover chrome (Delete, Cols, future pick tools).
     * Kind-specific colors applied via CSS vars / inline styles.
     */
    INSPECTOR: "kpv2-inspector",
    INSPECTOR_OVERLAY: "kpv2-inspector-overlay",
    /** Top-right companion instruction while inspector pick is active (like highlight mode) */
    INSPECTOR_MODE_INDICATOR: "kpv2-inspector-mode-indicator",
    /** @deprecated prefer INSPECTOR + kind; kept for style/compat during transition */
    COLS: "kpv2-cols",
    COLS_OVERLAY: "kpv2-cols-overlay",
    /** Applied multicol layout on the chosen target */
    COLS_ACTIVE: "kpv2-cols-active",
    /** Page-mode markers on html/body while whole-page columns are active */
    COLS_PAGE: "kpv2-cols-page",
    /** Widget shell wrapping a columnized target (outline + slip chrome) */
    COLS_SHELL: "kpv2-cols-shell",
    /** Content region inside the shell that holds the target */
    COLS_BODY: "kpv2-cols-body",
    /** Placeholder left in flow when shell is promoted to a popover */
    COLS_PLACEHOLDER: "kpv2-cols-placeholder",
    /** Slip-edit chrome (NLE-style content window scrubber) */
    COLS_SLIP_BAR: "kpv2-cols-slip-bar",
    COLS_SLIP_TRACK: "kpv2-cols-slip-track",
    COLS_SLIP_KNOB: "kpv2-cols-slip-knob",
    COLS_SLIP_LABEL: "kpv2-cols-slip-label",
    /** Slip-bar action: promote columns widget to floating popover */
    COLS_EXPAND_BTN: "kpv2-cols-expand-btn",
    /** Slip-bar action: clear columns / restore element */
    COLS_CLOSE_BTN: "kpv2-cols-close-btn",
    HIGHLIGHT_OVERLAY: "kpv2-highlight-overlay",
    HIGHLIGHT_SELECTION: "kpv2-highlight-selection",
    /** Persistent outline for elements added in cumulative inspector pick */
    INSPECTOR_PICKED: "kpv2-inspector-picked",
    INSPECTOR_PICKED_OVERLAY: "kpv2-inspector-picked-overlay",
    INSPECTOR_UNION_OVERLAY: "kpv2-inspector-union-overlay",
    TEXT_FIELD_GLOW: "kpv2-text-field-glow",
    VIEWPORT_MODAL_FRAME: "kpv2-viewport-modal-frame",
    ESC_EXIT_LABEL: "kpv2-esc-exit-label",
    TEXT_FOCUS_INPUT: "kpv2-text-focus-input",
    TEXT_FOCUS_INPUT_PARENT: "kpv2-text-focus-input-parent",
    /** Modifier: focused text field uses left-edge 10px pulsating bar (default style). */
    TEXT_FOCUS_LEFT_EDGE: "kpv2-text-focus-left-edge",
    TEXT_HOVER_INPUT: "kpv2-text-hover-input",
    TEXT_HOVER_INPUT_PARENT: "kpv2-text-hover-input-parent",
    /** Canvas-based focus/delete overlay host (OverlayManager) */
    CANVAS_OVERLAY: "kpv2-canvas-overlay",
    /** CSS custom-properties focus/delete overlay host (OverlayManager) */
    CSS_PROPS_OVERLAY: "kpv2-css-props-overlay",
    // Omnibox overlay UI
    OMNIBOX_BACKDROP: "kpv2-omnibox-backdrop",
    OMNIBOX_PANEL: "kpv2-omnibox-panel",
    OMNIBOX_INPUT: "kpv2-omnibox-input",
    OMNIBOX_SUGGESTIONS: "kpv2-omnibox-suggestions",
    OMNIBOX_SUGGESTION: "kpv2-omnibox-suggestion",
    OMNIBOX_EMPTY: "kpv2-omnibox-empty",
    // PopupManager (shared backdrop for modals/popups that should blur the page)
    POPUP_BACKDROP: "kpv2-popup-backdrop"
  };
  var Z_INDEX = {
    // Utility layers (occasionally used for measurement elements)
    PAGE_BEHIND: -1,
    DEFAULT: 1,
    // Keep all KeyPilot UI comfortably above typical site z-index values.
    // Note: Many browsers effectively clamp very large z-index values; using a
    // high-but-safe base avoids accidental collisions and keeps ordering clear.
    _BASE: 2147483e3,
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
    // Per-key floating config panel (above sticky key popover, below cursor)
    KEY_ACTION_CONFIG: 2147483047,
    // Compact Keyboard Layout Config palette (beside Reference while editing)
    KEYBOARD_LAYOUT_CONFIG: 2147483048,
    // Click-to-place arrow (fallback when Popover API unavailable)
    LAYOUT_PLACE_ARROW: 2147483052,
    // Cursor sits above chrome; click ripple is above even that so the
    // expanding circles always remain visible.
    CURSOR: 2147483050,
    RIPPLE: 2147483051
  };
  var SCROLL = Object.freeze({
    /** Legacy large page step (popover parent→iframe PAGE_UP/DOWN path) */
    PAGE_PX: 800,
    /** C / V: smaller step (default = prior 400px × 1.25) */
    HALF_PAGE_PX: 500,
    /** Default CSS scroll-behavior for keyboard scrolling */
    BEHAVIOR: "smooth",
    /** Scroll Line: no scroll inside this radius from the origin dot */
    LINE_DEADZONE_PX: 12,
    /**
     * Scroll Line: ease-in power. 1 = linear, 2 = quadratic (gentle near the
     * dot, ramps harder toward the edge of the range).
     */
    LINE_CURVE_EXPONENT: 1.7,
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
  var ELEMENT_SELECT_TAGS = Object.freeze([
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "li",
    "blockquote",
    "pre",
    "code",
    "article",
    "section",
    "aside",
    "header",
    "footer",
    "main",
    "nav",
    "a",
    "img",
    "figure",
    "figcaption",
    "picture",
    "video",
    "audio",
    "svg",
    "td",
    "th",
    "dt",
    "dd",
    "caption",
    "summary",
    "label"
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

  // src/utils/dom-context.js
  var TEXT_ENTRY_INPUT_TYPES = Object.freeze([
    "text",
    "search",
    "url",
    "email",
    "tel",
    "password",
    "number",
    "date",
    "datetime-local",
    "month",
    "week",
    "time"
  ]);
  var TEXT_ENTRY_TYPE_SET = new Set(TEXT_ENTRY_INPUT_TYPES);
  function isTypingContext(target, opts = {}) {
    if (!target) return false;
    let el = (
      /** @type {any} */
      target
    );
    try {
      if (el.nodeType === 3) el = el.parentElement;
    } catch {
    }
    if (!el || el.nodeType !== 1) return false;
    const node = (
      /** @type {HTMLElement} */
      el
    );
    try {
      if (node.isConnected === false) return false;
    } catch {
    }
    try {
      if (node.isContentEditable) return true;
    } catch {
    }
    try {
      let p = node.parentElement;
      let depth = 0;
      while (p && depth++ < 4) {
        if (p.isContentEditable) return true;
        p = p.parentElement;
      }
    } catch {
    }
    const tag = node.tagName?.toLowerCase?.() || "";
    if (tag === "textarea") {
      return !/** @type {HTMLTextAreaElement} */
      node.disabled;
    }
    if (opts.treatSelectAsTyping && tag === "select") {
      return !/** @type {HTMLSelectElement} */
      node.disabled;
    }
    if (tag !== "input") return false;
    const input = (
      /** @type {HTMLInputElement} */
      node
    );
    if (input.disabled || input.readOnly) return false;
    const type = String(input.type || "text").toLowerCase();
    return TEXT_ENTRY_TYPE_SET.has(type);
  }
  function hasModifierKeys(e) {
    if (!e) return false;
    return !!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey);
  }

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

  // src/utils/storage.js
  async function storageGetValue(key, defaultValue = void 0) {
    if (!key || typeof key !== "string") return defaultValue;
    try {
      if (chrome?.storage?.sync?.get) {
        const syncResult = await chrome.storage.sync.get([key]);
        if (syncResult && Object.prototype.hasOwnProperty.call(syncResult, key) && syncResult[key] !== void 0) {
          return (
            /** @type {T} */
            syncResult[key]
          );
        }
      }
    } catch {
    }
    try {
      if (chrome?.storage?.local?.get) {
        const localResult = await chrome.storage.local.get([key]);
        if (localResult && Object.prototype.hasOwnProperty.call(localResult, key) && localResult[key] !== void 0) {
          return (
            /** @type {T} */
            localResult[key]
          );
        }
      }
    } catch {
    }
    return defaultValue;
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
    // Actions Library hierarchical table: expanded group keys (top-level open by default;
    // nested categories / parents start collapsed until the user opens them).
    actionsLibraryTableExpanded: Object.freeze(["functions", "macros", "macroKeys"]),
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
      keyboardLayoutConfig: Object.freeze({ anchor: "middle-right" })
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
      keyboardLinkHoverHints: false
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
      speed: SCROLL.BEHAVIOR === "smooth" ? "smooth" : "instant"
    })
  });
  function normalizeSearchEngine(raw) {
    return normalizeSearchEngineId(raw);
  }
  function normalizeCursorMode(raw) {
    if (raw === CURSOR_MODE.NO_CUSTOM_CURSORS || raw === CURSOR_MODE.CUSTOM_CURSORS) return raw;
    return DEFAULT_SETTINGS.cursorMode;
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
    return {
      halfPagePx: normalizeNumber(
        stored.halfPagePx,
        DEFAULT_SETTINGS.scroll.halfPagePx,
        50,
        2e3
      ),
      speed: normalizeScrollSpeed(stored.speed)
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
  function scrollBehaviorFromSpeed(speed) {
    return normalizeScrollSpeed(speed) === "instant" ? "auto" : "smooth";
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
        actionsLibraryTableExpanded: normalizeActionsLibraryTableExpanded(
          stored?.actionsLibraryTableExpanded
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
          keyboardLayoutConfig: { ...DEFAULT_SETTINGS.panelPositions.keyboardLayoutConfig }
        },
        actionSettings: normalizeActionSettings(null),
        clickMode: { ...DEFAULT_SETTINGS.clickMode, cursor: { ...DEFAULT_SETTINGS.clickMode.cursor } },
        textMode: { ...DEFAULT_SETTINGS.textMode },
        scroll: { ...DEFAULT_SETTINGS.scroll },
        actionsLibraryTableExpanded: [...DEFAULT_SETTINGS.actionsLibraryTableExpanded]
      };
    }
  }

  // src/utils/scroll-at-point.js
  var EDGE_EPS = 1;
  function composedParent(node) {
    if (!node || node.nodeType !== 1) return null;
    const el = (
      /** @type {Element} */
      node
    );
    if (el.parentElement) return el.parentElement;
    try {
      const root = typeof el.getRootNode === "function" ? el.getRootNode() : null;
      if (root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
        return root.host || null;
      }
    } catch {
    }
    return null;
  }
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
  function overflowAllowsScroll(overflow) {
    const o = String(overflow || "").toLowerCase();
    return o === "auto" || o === "scroll" || o === "overlay";
  }
  function isDocumentScrollRoot(el, doc) {
    try {
      const se = doc.scrollingElement;
      if (se && el === se) return true;
      if (el === doc.documentElement || el === doc.body) return true;
    } catch {
    }
    return false;
  }
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
    if (isDocumentScrollRoot(el, doc)) {
      return {
        canY: maxTop > EDGE_EPS,
        canX: maxLeft > EDGE_EPS,
        maxTop,
        maxLeft
      };
    }
    let oy = "";
    let ox = "";
    try {
      const cs = (el.ownerDocument?.defaultView || window).getComputedStyle(el);
      oy = cs?.overflowY || "";
      ox = cs?.overflowX || "";
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
  function canScrollInDirection(el, axis, sign) {
    if (!el) return false;
    try {
      if (axis === "y") {
        const top = el.scrollTop || 0;
        if (sign < 0) return top > EDGE_EPS;
        const max2 = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
        return top < max2 - EDGE_EPS;
      }
      const left = el.scrollLeft || 0;
      if (sign < 0) return left > EDGE_EPS;
      const max = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
      return left < max - EDGE_EPS;
    } catch {
      return false;
    }
  }
  function scrollElementBy(el, deltaX, deltaY, behavior = "smooth", doc = document, win = window) {
    if (!el) return false;
    const dx = Number(deltaX) || 0;
    const dy = Number(deltaY) || 0;
    if (!dx && !dy) return false;
    const opts = { left: dx, top: dy, behavior };
    try {
      if (typeof el.scrollBy === "function") {
        el.scrollBy(opts);
        return true;
      }
    } catch {
    }
    try {
      if (behavior === "smooth" && typeof el.scrollTo === "function") {
        el.scrollTo({
          left: (el.scrollLeft || 0) + dx,
          top: (el.scrollTop || 0) + dy,
          behavior
        });
        return true;
      }
    } catch {
    }
    try {
      if (dx) el.scrollLeft = (el.scrollLeft || 0) + dx;
      if (dy) el.scrollTop = (el.scrollTop || 0) + dy;
      return true;
    } catch {
    }
    if (isDocumentScrollRoot(el, doc) && win && typeof win.scrollBy === "function") {
      try {
        win.scrollBy(opts);
        return true;
      } catch {
        try {
          win.scrollBy(dx, dy);
          return true;
        } catch {
        }
      }
    }
    return false;
  }
  function pickAxis(cap, el, sign) {
    if (cap.canY && canScrollInDirection(el, "y", sign)) return "y";
    if (cap.canX && canScrollInDirection(el, "x", sign)) return "x";
    return null;
  }
  function findScrollTargetAtPoint(clientX, clientY, sign, ctx = {}) {
    const doc = ctx.doc || document;
    const x = Number(clientX);
    const y = Number(clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    let start = elementFromPointDeep(x, y, doc);
    if (!start) {
      const se = doc.scrollingElement || doc.documentElement || doc.body;
      if (se) {
        const cap = getScrollCapacity(se, doc);
        const axis = pickAxis(cap, se, sign);
        if (axis) return { el: se, axis };
      }
      return null;
    }
    if (start.nodeType !== 1) {
      start = start.parentElement || /** @type {Element|null} */
      composedParent(start);
    }
    let n = (
      /** @type {Element|null} */
      start
    );
    let depth = 0;
    let seenDocRoot = null;
    while (n && n.nodeType === 1 && depth++ < 64) {
      if (n.tagName === "IFRAME" || n.tagName === "FRAME") {
        return null;
      }
      try {
        const id = n.id || "";
        if (id === "kpv2-cursor" || id === "kpv2-frame-hover" || typeof id === "string" && id.startsWith("kpv2-")) {
          n = composedParent(n);
          continue;
        }
        if (n.classList) {
          let skip = false;
          n.classList.forEach((c) => {
            if (typeof c === "string" && c.startsWith("kpv2-")) skip = true;
          });
          if (skip) {
            n = composedParent(n);
            continue;
          }
        }
      } catch {
      }
      const cap = getScrollCapacity(n, doc);
      if (cap.canY || cap.canX) {
        if (isDocumentScrollRoot(n, doc)) {
          seenDocRoot = n;
          n = composedParent(n);
          continue;
        }
        const axis = pickAxis(cap, n, sign);
        if (axis) return { el: n, axis };
      }
      n = composedParent(n);
    }
    const candidates = [];
    try {
      if (doc.scrollingElement) candidates.push(doc.scrollingElement);
    } catch {
    }
    try {
      if (doc.documentElement) candidates.push(doc.documentElement);
    } catch {
    }
    try {
      if (doc.body) candidates.push(doc.body);
    } catch {
    }
    if (seenDocRoot) candidates.push(seenDocRoot);
    const tried = /* @__PURE__ */ new Set();
    for (const el of candidates) {
      if (!el || tried.has(el)) continue;
      tried.add(el);
      const cap = getScrollCapacity(el, doc);
      const axis = pickAxis(cap, el, sign);
      if (axis) return { el, axis };
    }
    return null;
  }
  function isKeyPilotScrollChrome(n) {
    try {
      const id = n.id || "";
      if (id === "kpv2-cursor" || id === "kpv2-frame-hover" || typeof id === "string" && id.startsWith("kpv2-")) {
        return true;
      }
      if (n.classList) {
        let skip = false;
        n.classList.forEach((c) => {
          if (typeof c === "string" && c.startsWith("kpv2-")) skip = true;
        });
        if (skip) return true;
      }
    } catch {
    }
    return false;
  }
  function findScrollableAtPoint(clientX, clientY, ctx = {}) {
    const doc = ctx.doc || document;
    const x = Number(clientX);
    const y = Number(clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    let start = elementFromPointDeep(x, y, doc);
    if (!start) {
      const se = doc.scrollingElement || doc.documentElement || doc.body;
      if (!se) return null;
      const cap = getScrollCapacity(se, doc);
      if (cap.canX || cap.canY) return { el: se, canX: cap.canX, canY: cap.canY };
      return null;
    }
    if (start.nodeType !== 1) {
      start = start.parentElement || /** @type {Element|null} */
      composedParent(start);
    }
    let n = (
      /** @type {Element|null} */
      start
    );
    let depth = 0;
    let seenDocRoot = null;
    while (n && n.nodeType === 1 && depth++ < 64) {
      if (n.tagName === "IFRAME" || n.tagName === "FRAME") {
        return null;
      }
      if (isKeyPilotScrollChrome(n)) {
        n = composedParent(n);
        continue;
      }
      const cap = getScrollCapacity(n, doc);
      if (cap.canY || cap.canX) {
        if (isDocumentScrollRoot(n, doc)) {
          seenDocRoot = n;
          n = composedParent(n);
          continue;
        }
        return { el: n, canX: cap.canX, canY: cap.canY };
      }
      n = composedParent(n);
    }
    const candidates = [];
    try {
      if (doc.scrollingElement) candidates.push(doc.scrollingElement);
    } catch {
    }
    try {
      if (doc.documentElement) candidates.push(doc.documentElement);
    } catch {
    }
    try {
      if (doc.body) candidates.push(doc.body);
    } catch {
    }
    if (seenDocRoot) candidates.push(seenDocRoot);
    const tried = /* @__PURE__ */ new Set();
    for (const el of candidates) {
      if (!el || tried.has(el)) continue;
      tried.add(el);
      const cap = getScrollCapacity(el, doc);
      if (cap.canX || cap.canY) return { el, canX: cap.canX, canY: cap.canY };
    }
    return null;
  }
  function scrollByAtPoint(clientX, clientY, deltaX, deltaY, behavior = "auto", ctx = {}) {
    const doc = ctx.doc || document;
    const win = ctx.win || (doc.defaultView || window);
    let dx = Number(deltaX) || 0;
    let dy = Number(deltaY) || 0;
    if (!dx && !dy) return { scrolled: false, el: null };
    const target = findScrollableAtPoint(clientX, clientY, { doc, win });
    if (!target) {
      try {
        if (win && typeof win.scrollBy === "function") {
          win.scrollBy({ left: dx, top: dy, behavior });
          return { scrolled: true, el: doc.scrollingElement || doc.documentElement || null };
        }
      } catch {
      }
      return { scrolled: false, el: null };
    }
    if (!target.canX) dx = 0;
    if (!target.canY) dy = 0;
    if (!dx && !dy) return { scrolled: false, el: target.el };
    const ok = scrollElementBy(target.el, dx, dy, behavior, doc, win);
    return { scrolled: ok, el: target.el };
  }
  function scrollAtPoint(clientX, clientY, sign, deltaPx, behavior = "smooth", ctx = {}) {
    const doc = ctx.doc || document;
    const win = ctx.win || (doc.defaultView || window);
    const amount = Math.abs(Number(deltaPx)) || 0;
    const s = sign < 0 ? -1 : 1;
    if (!amount) {
      return { scrolled: false, axis: null, el: null };
    }
    const target = findScrollTargetAtPoint(clientX, clientY, s, { doc, win });
    if (!target) {
      try {
        if (win && typeof win.scrollBy === "function") {
          win.scrollBy({ top: s * amount, left: 0, behavior });
          return { scrolled: true, axis: "y", el: doc.scrollingElement || doc.documentElement || null };
        }
      } catch {
      }
      return { scrolled: false, axis: null, el: null };
    }
    const { el, axis } = target;
    const dx = axis === "x" ? s * amount : 0;
    const dy = axis === "y" ? s * amount : 0;
    const ok = scrollElementBy(el, dx, dy, behavior, doc, win);
    return { scrolled: ok, axis, el };
  }
  function scrollElementToEdge(el, axis, sign, behavior = "smooth", doc = document, win = window) {
    if (!el || axis !== "y" && axis !== "x") return false;
    const s = sign < 0 ? -1 : 1;
    let left = 0;
    let top = 0;
    try {
      if (axis === "y") {
        left = el.scrollLeft || 0;
        top = s < 0 ? 0 : Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
      } else {
        top = el.scrollTop || 0;
        left = s < 0 ? 0 : Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
      }
    } catch {
      return false;
    }
    const opts = { left, top, behavior };
    try {
      if (typeof el.scrollTo === "function") {
        el.scrollTo(opts);
        return true;
      }
    } catch {
    }
    try {
      if (axis === "y") el.scrollTop = top;
      else el.scrollLeft = left;
      return true;
    } catch {
    }
    if (isDocumentScrollRoot(el, doc) && win && typeof win.scrollTo === "function") {
      try {
        win.scrollTo(opts);
        return true;
      } catch {
        try {
          if (axis === "y") win.scrollTo(win.pageXOffset || 0, top);
          else win.scrollTo(left, win.pageYOffset || 0);
          return true;
        } catch {
        }
      }
    }
    return false;
  }
  function scrollToEdgeAtPoint(clientX, clientY, sign, behavior = "smooth", ctx = {}) {
    const doc = ctx.doc || document;
    const win = ctx.win || (doc.defaultView || window);
    const s = sign < 0 ? -1 : 1;
    const target = findScrollTargetAtPoint(clientX, clientY, s, { doc, win });
    if (!target) {
      try {
        if (win && typeof win.scrollTo === "function") {
          const se = doc.scrollingElement || doc.documentElement || doc.body;
          const top = s < 0 ? 0 : Math.max(0, (se?.scrollHeight || doc.body?.scrollHeight || 0) - (win.innerHeight || 0));
          win.scrollTo({ top, left: win.pageXOffset || 0, behavior });
          return { scrolled: true, axis: "y", el: se || null };
        }
      } catch {
      }
      return { scrolled: false, axis: null, el: null };
    }
    const { el, axis } = target;
    const ok = scrollElementToEdge(el, axis, s, behavior, doc, win);
    return { scrolled: ok, axis, el };
  }

  // src/modules/frame-click-agent.js
  var CLICKABLE_SEL = 'a[href], button, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], summary, [onclick], input, select, textarea, label';
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
  function withNativePageCursors(fn) {
    let html = null;
    try {
      html = document.documentElement;
    } catch {
    }
    if (!html || !html.classList) return fn();
    const hadHidden = html.classList.contains(CSS_CLASSES.CURSOR_HIDDEN);
    if (hadHidden) {
      try {
        html.classList.remove(CSS_CLASSES.CURSOR_HIDDEN);
      } catch {
      }
    }
    try {
      return fn();
    } finally {
      if (hadHidden) {
        try {
          html.classList.add(CSS_CLASSES.CURSOR_HIDDEN);
        } catch {
        }
      }
    }
  }
  function resolveClickable(el) {
    if (!el || el.nodeType !== 1) return null;
    try {
      if (el.tagName === "IFRAME") return el;
      if (el.id === "kpv2-frame-hover" || el.closest?.("#kpv2-frame-hover")) return null;
      const specific = typeof el.closest === "function" ? el.closest(CLICKABLE_SEL) : null;
      if (specific) return specific;
      try {
        if (el !== document.body && el !== document.documentElement) {
          return withNativePageCursors(() => {
            const cs = window.getComputedStyle(el);
            if (cs.cursor === "pointer" && cs.pointerEvents !== "none") {
              const parent = el.parentElement;
              if (!parent || window.getComputedStyle(parent).cursor !== "pointer") {
                return el;
              }
            }
            return null;
          });
        }
      } catch {
      }
      return null;
    } catch {
      return null;
    }
  }
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
    const hasPointer = typeof window.PointerEvent === "function";
    if (hasPointer) {
      const pCommon = { ...common, pointerId: 1, pointerType: "mouse", isPrimary: true };
      try {
        target.dispatchEvent(new PointerEvent("pointerover", pCommon));
      } catch {
      }
      try {
        target.dispatchEvent(new PointerEvent("pointerenter", pCommon));
      } catch {
      }
      try {
        target.dispatchEvent(new PointerEvent("pointerdown", pCommon));
      } catch {
      }
    } else {
      try {
        target.dispatchEvent(new MouseEvent("pointerover", common));
      } catch {
      }
      try {
        target.dispatchEvent(new MouseEvent("pointerenter", common));
      } catch {
      }
      try {
        target.dispatchEvent(new MouseEvent("pointerdown", common));
      } catch {
      }
    }
    try {
      target.dispatchEvent(new MouseEvent("mouseover", common));
    } catch {
    }
    try {
      target.dispatchEvent(new MouseEvent("mouseenter", common));
    } catch {
    }
    try {
      target.dispatchEvent(new MouseEvent("mousemove", common));
    } catch {
    }
    try {
      target.dispatchEvent(new MouseEvent("mousedown", common));
    } catch {
    }
    const commonUp = { ...common, buttons: 0 };
    if (hasPointer) {
      const pUp = { ...commonUp, pointerId: 1, pointerType: "mouse", isPrimary: true };
      try {
        target.dispatchEvent(new PointerEvent("pointerup", pUp));
      } catch {
      }
    } else {
      try {
        target.dispatchEvent(new MouseEvent("pointerup", commonUp));
      } catch {
      }
    }
    try {
      target.dispatchEvent(new MouseEvent("mouseup", commonUp));
    } catch {
    }
    try {
      target.dispatchEvent(new MouseEvent("click", commonUp));
    } catch {
    }
  }
  function closestLink(el) {
    try {
      if (!el || el.nodeType !== 1) return null;
      if (el.tagName === "A" && /** @type {HTMLAnchorElement} */
      el.href) {
        return (
          /** @type {HTMLAnchorElement} */
          el
        );
      }
      const a = typeof el.closest === "function" ? el.closest("a[href]") : null;
      return a && a.tagName === "A" ? (
        /** @type {HTMLAnchorElement} */
        a
      ) : null;
    } catch {
      return null;
    }
  }
  function findMediaAtPoint(el, clientX, clientY) {
    const asMedia = (node) => {
      try {
        if (!node || node.nodeType !== 1) return null;
        const tag = node.tagName;
        if (tag === "VIDEO" || tag === "AUDIO") return (
          /** @type {HTMLMediaElement} */
          node
        );
      } catch {
      }
      return null;
    };
    let found = asMedia(el);
    if (found) return found;
    try {
      const close = el && typeof el.closest === "function" ? el.closest("video, audio") : null;
      if (close) return (
        /** @type {HTMLMediaElement} */
        close
      );
    } catch {
    }
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      try {
        const stack = typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(clientX, clientY) : [];
        for (let i = 0; i < stack.length; i++) {
          const m = asMedia(stack[i]);
          if (m) return m;
        }
      } catch {
      }
    }
    return null;
  }
  function isDirectMediaHit(el, media) {
    if (!el || !media) return false;
    try {
      if (el === media) return true;
      if (el.tagName === "VIDEO" || el.tagName === "AUDIO") return true;
      if (typeof media.contains === "function" && media.contains(el)) return true;
    } catch {
    }
    return false;
  }
  function isPlayOverlayControl(el, activator) {
    const nodes = [];
    if (activator && activator.nodeType === 1) nodes.push(activator);
    if (el && el.nodeType === 1) nodes.push(el);
    try {
      const b = el && typeof el.closest === "function" ? el.closest('button, [role="button"]') : null;
      if (b) nodes.push(b);
    } catch {
    }
    for (const c of nodes) {
      if (!c || c.nodeType !== 1) continue;
      try {
        if (c.tagName === "A" && /** @type {HTMLAnchorElement} */
        c.href) continue;
      } catch {
      }
      let label = "";
      try {
        label = `${c.getAttribute?.("aria-label") || ""} ${c.getAttribute?.("title") || ""} ${c.getAttribute?.("data-testid") || ""}`.toLowerCase();
      } catch {
      }
      if (/like|reply|repost|retweet|share|follow|bookmark|menu|more|comment|profile/.test(label)) {
        continue;
      }
      if (/play|pause|replay|watch/.test(label)) return true;
      try {
        const tag = c.tagName;
        const role = (c.getAttribute?.("role") || "").toLowerCase();
        if (tag !== "BUTTON" && role !== "button") continue;
        if (c === el || c === activator || typeof c.contains === "function" && el && c.contains(el)) {
          return true;
        }
      } catch {
      }
    }
    return false;
  }
  function toggleMediaPlayback(media) {
    if (!media) return false;
    try {
      if (media.paused) {
        const p = media.play();
        if (p && typeof p.then === "function") {
          p.catch(() => {
            try {
              media.muted = true;
              const p2 = media.play();
              if (p2 && typeof p2.catch === "function") p2.catch(() => {
              });
            } catch {
            }
          });
        }
      } else {
        media.pause();
      }
      return true;
    } catch {
      return false;
    }
  }
  function openUrlViaRuntime(url, opts = {}) {
    if (!url) return false;
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return false;
      const type = opts.background ? MSG.OPEN_URL_BACKGROUND : MSG.OPEN_URL_FOREGROUND;
      chrome.runtime.sendMessage({ type, url }).catch(() => {
      });
      return true;
    } catch {
      return false;
    }
  }
  function navigateSameTabViaRuntime(url) {
    if (!url) return false;
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return false;
      chrome.runtime.sendMessage({ type: MSG.NAVIGATE_SAME_TAB, url }).catch(() => {
      });
      return true;
    } catch {
      return false;
    }
  }
  function resolveHttpHref(link) {
    if (!link) return null;
    try {
      const href = (
        /** @type {HTMLAnchorElement} */
        link.href
      );
      if (!href) return null;
      const u = new URL(href, location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return u.href;
    } catch {
      return null;
    }
  }
  function getLinkBrowsingContextTarget(link) {
    try {
      return String(link.getAttribute?.("target") || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }
  function runtimeNavigateUrlForFrameLink(link, ctx = {}) {
    try {
      if (window === window.top) return null;
    } catch {
    }
    const url = resolveHttpHref(link);
    if (!url) return null;
    const target = getLinkBrowsingContextTarget(link);
    if (target === "_top" || target === "_parent") {
      return url;
    }
    try {
      if (new URL(url).origin !== location.origin) {
        return url;
      }
    } catch {
      return null;
    }
    void ctx.topOrigin;
    return null;
  }
  function hasFullKeyPilot() {
    try {
      return !!(window.keyPilot || window.__KeyPilotInstance || window.__KeyPilotToggleHandler);
    } catch {
      return false;
    }
  }
  function findIframeByContentWindow(win) {
    if (!win) return null;
    try {
      const nodes = document.querySelectorAll("iframe, frame");
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        try {
          if (el && el.contentWindow === win) {
            return (
              /** @type {HTMLIFrameElement|HTMLFrameElement} */
              el
            );
          }
        } catch {
        }
      }
    } catch {
    }
    return null;
  }
  function frameHasKeyboardFocus() {
    try {
      if (typeof document.hasFocus === "function" && document.hasFocus()) return true;
    } catch {
    }
    return false;
  }
  function installFrameClickAgent() {
    try {
      if (window === window.top) return null;
      let enabled = true;
      let lastMouse = { x: null, y: null };
      let keybindings = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID);
      let halfPagePx = SCROLL.HALF_PAGE_PX;
      let scrollBehavior = SCROLL.BEHAVIOR === "smooth" ? "smooth" : "auto";
      let hoverEl = null;
      let hoverTarget = null;
      let hoverRaf = 0;
      let pointerInside = false;
      let pointerSyncRaf = 0;
      let lastPointerPostedX = NaN;
      let lastPointerPostedY = NaN;
      let focusChrome = {
        focusColor: "blue",
        overlayFillEnabled: false,
        overlayShadowEnabled: false,
        rectangleThickness: 3
      };
      let lastTopOrigin = "";
      const requestFocusReclaim = () => {
        if (!enabled) return;
        try {
          window.parent.postMessage({ type: MSG.FRAME_FOCUS_RECLAIM }, "*");
        } catch {
        }
      };
      const postPointerToParent = (inside, clientX, clientY) => {
        if (!enabled) return;
        if (hasFullKeyPilot()) return;
        try {
          if (inside) {
            const x = Number(clientX);
            const y = Number(clientY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            if (Math.abs(x - lastPointerPostedX) < 0.5 && Math.abs(y - lastPointerPostedY) < 0.5) {
              return;
            }
            lastPointerPostedX = x;
            lastPointerPostedY = y;
            window.parent.postMessage({
              type: MSG.FRAME_POINTER,
              inside: true,
              clientX: x,
              clientY: y
            }, "*");
          } else {
            lastPointerPostedX = NaN;
            lastPointerPostedY = NaN;
            window.parent.postMessage({
              type: MSG.FRAME_POINTER,
              inside: false
            }, "*");
          }
        } catch {
        }
      };
      const schedulePointerSync = () => {
        if (pointerSyncRaf) return;
        pointerSyncRaf = requestAnimationFrame(() => {
          pointerSyncRaf = 0;
          try {
            if (!enabled || !pointerInside || hasFullKeyPilot()) return;
            const x = lastMouse.x;
            const y = lastMouse.y;
            if (typeof x !== "number" || typeof y !== "number") return;
            postPointerToParent(true, x, y);
          } catch {
          }
        });
      };
      const bubbleChildPointer = (event, data) => {
        if (!data || data.type !== MSG.FRAME_POINTER) return false;
        if (!enabled) return true;
        try {
          if (event.source === window) return false;
        } catch {
        }
        if (hasFullKeyPilot()) return true;
        if (data.inside === false) {
          if (pointerInside && typeof lastMouse.x === "number" && typeof lastMouse.y === "number") {
            lastPointerPostedX = NaN;
            lastPointerPostedY = NaN;
            postPointerToParent(true, lastMouse.x, lastMouse.y);
          } else {
            postPointerToParent(false);
          }
          return true;
        }
        const childFrame = findIframeByContentWindow(
          /** @type {Window} */
          event.source
        );
        if (!childFrame) return false;
        let rect;
        try {
          rect = childFrame.getBoundingClientRect();
        } catch {
          return false;
        }
        const x = rect.left + Number(data.clientX);
        const y = rect.top + Number(data.clientY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        postPointerToParent(true, x, y);
        return true;
      };
      const paletteFor = (color) => {
        if (color === "green") {
          return {
            border: COLORS.FOCUS_GREEN || "rgba(0,180,0,0.95)",
            shadow: COLORS.GREEN_SHADOW || "rgba(0,180,0,0.45)",
            shadowBright: COLORS.GREEN_SHADOW_BRIGHT || "rgba(0,180,0,0.5)",
            fill: COLORS.FOCUS_GREEN_BG_T2 || "rgba(46, 204, 113, 0.4)"
          };
        }
        return {
          border: COLORS.FOCUS_BLUE || "rgba(33,150,243,0.95)",
          shadow: COLORS.BLUE_SHADOW || "rgba(33,150,243,0.35)",
          shadowBright: COLORS.BLUE_SHADOW_BRIGHT || "rgba(33,150,243,0.45)",
          fill: COLORS.FOCUS_BLUE_BG_T2 || "rgba(33,150,243,0.25)"
        };
      };
      const applyFocusChromeToHoverEl = () => {
        if (!hoverEl) return;
        const p = paletteFor(focusChrome.focusColor);
        const thickness = Math.min(Math.max(Number(focusChrome.rectangleThickness) || 3, 1), 16);
        try {
          hoverEl.style.border = `${thickness}px solid ${p.border}`;
          hoverEl.style.background = focusChrome.overlayFillEnabled === false ? "transparent" : p.fill;
          hoverEl.style.boxShadow = focusChrome.overlayShadowEnabled === false ? "none" : `0 0 0 1px ${p.shadow}, 0 0 8px ${p.shadowBright}`;
        } catch {
        }
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
          const currentSel = String(settings?.currentKeyboardLayoutId || "builtin");
          if (currentSel.startsWith("user:")) {
            keybindings = buildSystemKeybindings(settings?.keyboardHandedness);
          } else {
            const layoutId = resolveKeyboardLayoutId({
              familyId: settings?.keyboardLayoutFamilyId,
              handedness: settings?.keyboardHandedness
            }) || normalizeKeyboardLayoutId(settings?.keyboardLayoutId);
            keybindings = buildEffectiveKeybindings(layoutId, settings?.keyboardHandedness);
          }
          const cm = settings?.clickMode || {};
          focusChrome = {
            focusColor: cm.focusColor === "green" ? "green" : "blue",
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
            scrollBehavior = SCROLL.BEHAVIOR === "smooth" ? "smooth" : "auto";
          }
          applyFocusChromeToHoverEl();
          if (pointerInside && enabled) scheduleHoverUpdate();
        } catch {
        }
      };
      const scrollAt = (clientX, clientY, sign, deltaPx, behavior, mode = "delta", xy = null) => {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const edge = mode === "edge";
        const xyMode = mode === "xy";
        const amount = Math.abs(Number(deltaPx));
        const delta = Number.isFinite(amount) && amount > 0 ? amount : halfPagePx;
        const s = sign < 0 ? -1 : 1;
        const beh = xyMode || behavior === "auto" || behavior === "instant" ? "auto" : behavior || scrollBehavior;
        const deltaX = Number(xy?.deltaX) || 0;
        const deltaY = Number(xy?.deltaY) || 0;
        try {
          const under = deepElementFromPoint(clientX, clientY);
          if (under && under.tagName === "IFRAME") {
            const iframe = (
              /** @type {HTMLIFrameElement} */
              under
            );
            const rect = iframe.getBoundingClientRect();
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;
            if (localX >= 0 && localY >= 0 && localX <= rect.width && localY <= rect.height && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                type: MSG.FRAME_SCROLL,
                clientX: localX,
                clientY: localY,
                sign: s,
                mode: xyMode ? "xy" : edge ? "edge" : "delta",
                deltaPx: edge || xyMode ? 0 : delta,
                deltaX: xyMode ? deltaX : 0,
                deltaY: xyMode ? deltaY : 0,
                behavior: beh,
                frameName: typeof iframe.name === "string" ? iframe.name : ""
              }, "*");
              return true;
            }
          }
        } catch {
        }
        if (xyMode) {
          const result2 = scrollByAtPoint(clientX, clientY, deltaX, deltaY, beh);
          return !!result2?.scrolled;
        }
        if (edge) {
          const result2 = scrollToEdgeAtPoint(clientX, clientY, s, beh);
          return !!result2?.scrolled;
        }
        const result = scrollAtPoint(clientX, clientY, s, delta, beh);
        return !!result?.scrolled;
      };
      const setEnabled = (next) => {
        enabled = !!next;
        if (!enabled) {
          hideHover();
          pointerInside = false;
          lastPointerPostedX = NaN;
          lastPointerPostedY = NaN;
          if (pointerSyncRaf) {
            try {
              cancelAnimationFrame(pointerSyncRaf);
            } catch {
            }
            pointerSyncRaf = 0;
          }
        }
      };
      const syncEnabledFromRuntime = async () => {
        try {
          if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
          const response = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
          if (response && typeof response.enabled === "boolean") {
            setEnabled(response.enabled);
          }
        } catch {
          setEnabled(true);
        }
      };
      const ensureHoverEl = () => {
        if (hoverEl && hoverEl.isConnected) return hoverEl;
        try {
          const el = document.createElement("div");
          el.id = "kpv2-frame-hover";
          el.setAttribute("aria-hidden", "true");
          el.style.cssText = [
            "position:fixed",
            "left:0",
            "top:0",
            "width:0",
            "height:0",
            "margin:0",
            "padding:0",
            "box-sizing:border-box",
            "pointer-events:none",
            `z-index:${typeof Z_INDEX?.OVERLAYS === "number" ? Z_INDEX.OVERLAYS : 2147483020}`,
            "border-radius:2px",
            "display:none",
            "opacity:1"
          ].join(";");
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
          try {
            cancelAnimationFrame(hoverRaf);
          } catch {
          }
          hoverRaf = 0;
        }
        if (hoverEl) {
          try {
            hoverEl.style.display = "none";
            hoverEl.style.width = "0px";
            hoverEl.style.height = "0px";
          } catch {
          }
        }
      };
      const paintHover = (target) => {
        if (!target || !(target instanceof Element)) {
          hideHover();
          return;
        }
        if (target.tagName === "IFRAME") {
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
        try {
          if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95) {
            hideHover();
            return;
          }
        } catch {
        }
        const el = ensureHoverEl();
        if (!el) return;
        hoverTarget = target;
        try {
          el.style.display = "block";
          el.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(rect.top)}px)`;
          el.style.width = `${Math.round(rect.width)}px`;
          el.style.height = `${Math.round(rect.height)}px`;
        } catch {
        }
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
            if (typeof x !== "number" || typeof y !== "number") {
              hideHover();
              return;
            }
            const under = deepElementFromPoint(x, y);
            const clickable = resolveClickable(under);
            if (clickable === hoverTarget && hoverEl && hoverEl.style.display === "block") {
              paintHover(clickable);
              return;
            }
            paintHover(clickable);
          } catch {
            hideHover();
          }
        });
      };
      let lastActivateAt = 0;
      const activateAt = (clientX, clientY, opts = {}) => {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
        const now = Date.now();
        if (now - lastActivateAt < 100) return false;
        lastActivateAt = now;
        const el = deepElementFromPoint(clientX, clientY);
        if (!el) return false;
        if (el.tagName === "IFRAME") {
          try {
            const iframe = (
              /** @type {HTMLIFrameElement} */
              el
            );
            const rect = iframe.getBoundingClientRect();
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;
            if (localX >= 0 && localY >= 0 && localX <= rect.width && localY <= rect.height && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                type: MSG.FRAME_ACTIVATE,
                clientX: localX,
                clientY: localY,
                openInNewTab: !!opts.openInNewTab,
                background: !!opts.background,
                topOrigin: typeof opts.topOrigin === "string" ? opts.topOrigin : lastTopOrigin
              }, "*");
              return true;
            }
          } catch {
          }
        }
        const openInNewTab = !!opts.openInNewTab;
        const background = !!opts.background;
        const link = closestLink(el);
        const activator = resolveClickable(el) || el;
        const mediaEl = findMediaAtPoint(el, clientX, clientY);
        const directMedia = isDirectMediaHit(el, mediaEl);
        const playOverlay = isPlayOverlayControl(el, activator);
        if (mediaEl && !openInNewTab && !background && (directMedia || playOverlay)) {
          toggleMediaPlayback(mediaEl);
          return true;
        }
        if (link && (openInNewTab || background)) {
          const url = resolveHttpHref(link) || link.href;
          if (openUrlViaRuntime(url, { background })) return true;
          try {
            if (background) {
              window.open(url, "_blank", "noopener,noreferrer");
            } else {
              const originalTarget = link.target;
              link.target = "_blank";
              try {
                link.click();
              } catch {
                window.open(url, "_blank", "noopener,noreferrer");
              }
              if (originalTarget !== void 0 && originalTarget !== null && originalTarget !== "") {
                link.target = originalTarget;
              } else {
                link.removeAttribute("target");
              }
            }
            return true;
          } catch {
            return false;
          }
        }
        {
          const sameLink = activator && activator.tagName === "A" && /** @type {HTMLAnchorElement} */
          activator.href ? (
            /** @type {HTMLAnchorElement} */
            activator
          ) : link;
          if (sameLink && sameLink.href && !openInNewTab && !background) {
            const topOrigin = typeof opts.topOrigin === "string" && opts.topOrigin ? opts.topOrigin : lastTopOrigin;
            const runtimeUrl = runtimeNavigateUrlForFrameLink(
              /** @type {HTMLAnchorElement} */
              sameLink,
              { topOrigin }
            );
            if (runtimeUrl && navigateSameTabViaRuntime(runtimeUrl)) return true;
            try {
              sameLink.click();
              return true;
            } catch {
            }
          }
        }
        try {
          if (activator && (activator.tagName === "BUTTON" || (activator.getAttribute?.("role") || "").toLowerCase() === "button") && typeof /** @type {any} */
          activator.click === "function") {
            activator.click();
            return true;
          }
        } catch {
        }
        try {
          let summary = null;
          if (activator && activator.tagName === "SUMMARY") summary = activator;
          else if (el && typeof el.closest === "function") {
            const s = el.closest("summary");
            if (s && s.tagName === "SUMMARY") summary = s;
          } else if (activator && activator.tagName === "DETAILS") {
            summary = activator.querySelector(":scope > summary");
          }
          if (summary && typeof summary.click === "function") {
            summary.click();
            return true;
          }
        } catch {
        }
        dispatchClickSequence(el, clientX, clientY);
        try {
          if (activator && activator !== el && !(typeof activator.contains === "function" && activator.contains(el))) {
            dispatchClickSequence(activator, clientX, clientY);
          }
        } catch {
        }
        return true;
      };
      const acceptFramePayload = (event, data, type) => {
        if (!data || data.type !== type) return false;
        if (!enabled) return false;
        try {
          if (window === window.top) return false;
        } catch {
        }
        try {
          if (event && event.source === window) return false;
        } catch {
        }
        try {
          const want = typeof data.frameName === "string" ? data.frameName : "";
          if (want && window.name && want !== window.name) return false;
        } catch {
        }
        return Number.isFinite(Number(data.clientX)) && Number.isFinite(Number(data.clientY));
      };
      const acceptActivatePayload = (event, data) => acceptFramePayload(event, data, MSG.FRAME_ACTIVATE);
      const acceptScrollPayload = (event, data) => acceptFramePayload(event, data, MSG.FRAME_SCROLL);
      const onMessage = (event) => {
        try {
          const data = event?.data;
          if (bubbleChildPointer(event, data)) return;
          if (acceptActivatePayload(event, data)) {
            const x = Number(data.clientX);
            const y = Number(data.clientY);
            if (typeof data.topOrigin === "string" && data.topOrigin) {
              lastTopOrigin = data.topOrigin;
            }
            activateAt(x, y, {
              openInNewTab: !!data.openInNewTab,
              background: !!data.background,
              topOrigin: typeof data.topOrigin === "string" ? data.topOrigin : lastTopOrigin
            });
            return;
          }
          if (acceptScrollPayload(event, data)) {
            const x = Number(data.clientX);
            const y = Number(data.clientY);
            const sign = Number(data.sign) < 0 ? -1 : 1;
            const delta = Number(data.deltaPx);
            const beh = data.behavior === "auto" || data.behavior === "instant" ? "auto" : data.behavior || scrollBehavior;
            const mode = data.mode === "edge" ? "edge" : data.mode === "xy" ? "xy" : "delta";
            scrollAt(x, y, sign, delta, beh, mode, {
              deltaX: Number(data.deltaX) || 0,
              deltaY: Number(data.deltaY) || 0
            });
          }
        } catch {
        }
      };
      const onPointer = (e) => {
        try {
          if (!enabled) return;
          if (typeof e.clientX === "number") lastMouse.x = e.clientX;
          if (typeof e.clientY === "number") lastMouse.y = e.clientY;
          pointerInside = true;
          if (!hasFullKeyPilot()) {
            schedulePointerSync();
            scheduleHoverUpdate();
          }
        } catch {
        }
      };
      const onPointerLeave = (e) => {
        if (!enabled) {
          pointerInside = false;
          hideHover();
          return;
        }
        try {
          const rt = e?.relatedTarget;
          if (rt && (rt.tagName === "IFRAME" || rt.tagName === "FRAME")) {
            pointerInside = false;
            hideHover();
            return;
          }
        } catch {
        }
        pointerInside = false;
        hideHover();
        postPointerToParent(false);
      };
      const onScroll = () => {
        if (pointerInside && enabled) {
          schedulePointerSync();
          scheduleHoverUpdate();
        }
      };
      const onKeyDown = (e) => {
        try {
          if (!enabled) return;
          if (hasFullKeyPilot()) return;
          if (hasModifierKeys(e)) return;
          if (isTypingContext(e.target)) return;
          if (!frameHasKeyboardFocus()) return;
          const key = e.key;
          const kb = keybindings || {};
          if (keyIn(kb.CANCEL, key) || key === "Escape" || key === "Esc") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            requestFocusReclaim();
            return;
          }
          let mode = null;
          let scrollSign = null;
          let scrollMode = "delta";
          if (keyIn(kb.ACTIVATE, key)) mode = "activate";
          else if (keyIn(kb.ACTIVATE_NEW_TAB, key)) mode = "newTab";
          else if (keyIn(kb.ACTIVATE_NEW_TAB_BACKGROUND, key)) mode = "background";
          else if (keyIn(kb.PAGE_UP_INSTANT, key)) scrollSign = -1;
          else if (keyIn(kb.PAGE_DOWN_INSTANT, key)) scrollSign = 1;
          else if (keyIn(kb.PAGE_TOP, key)) {
            scrollSign = -1;
            scrollMode = "edge";
          } else if (keyIn(kb.PAGE_BOTTOM, key)) {
            scrollSign = 1;
            scrollMode = "edge";
          } else return;
          if (!pointerInside) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            requestFocusReclaim();
            return;
          }
          let x = lastMouse.x;
          let y = lastMouse.y;
          if (typeof x !== "number" || typeof y !== "number") {
            x = Math.floor(window.innerWidth / 2);
            y = Math.floor(window.innerHeight / 2);
          }
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (scrollSign !== null) {
            scrollAt(x, y, scrollSign, halfPagePx, scrollBehavior, scrollMode);
            return;
          }
          activateAt(x, y, {
            openInNewTab: mode === "newTab",
            background: mode === "background",
            topOrigin: lastTopOrigin
          });
        } catch {
        }
      };
      const onRuntimeMessage = (message, _sender, sendResponse) => {
        try {
          if (message?.type === MSG.TOGGLE_STATE || message?.type === MSG.UPDATE_STATE) {
            if (typeof message.enabled === "boolean") {
              setEnabled(message.enabled);
            }
            return false;
          }
          if (message?.type === MSG.FRAME_ACTIVATE) {
            if (!acceptActivatePayload(null, message)) {
              try {
                sendResponse({ ok: false });
              } catch {
              }
              return true;
            }
            if (typeof message.topOrigin === "string" && message.topOrigin) {
              lastTopOrigin = message.topOrigin;
            }
            const ok = activateAt(Number(message.clientX), Number(message.clientY), {
              openInNewTab: !!message.openInNewTab,
              background: !!message.background,
              topOrigin: typeof message.topOrigin === "string" ? message.topOrigin : lastTopOrigin
            });
            try {
              sendResponse({ ok: !!ok, href: String(location.href || "").slice(0, 120) });
            } catch {
            }
            return true;
          }
          if (message?.type === MSG.FRAME_SCROLL) {
            if (!acceptScrollPayload(null, message)) {
              try {
                sendResponse({ ok: false });
              } catch {
              }
              return true;
            }
            const sign = Number(message.sign) < 0 ? -1 : 1;
            const mode = message.mode === "edge" ? "edge" : message.mode === "xy" ? "xy" : "delta";
            const ok = scrollAt(
              Number(message.clientX),
              Number(message.clientY),
              sign,
              Number(message.deltaPx),
              message.behavior,
              mode,
              {
                deltaX: Number(message.deltaX) || 0,
                deltaY: Number(message.deltaY) || 0
              }
            );
            try {
              sendResponse({ ok: !!ok, href: String(location.href || "").slice(0, 120) });
            } catch {
            }
            return true;
          }
        } catch {
        }
        return false;
      };
      const onStorageChanged = (changes, area) => {
        try {
          if (area !== "sync" && area !== "local") return;
          if (changes?.keypilot_enabled && typeof changes.keypilot_enabled.newValue === "boolean") {
            setEnabled(changes.keypilot_enabled.newValue);
          }
          if (changes && Object.prototype.hasOwnProperty.call(changes, SETTINGS_STORAGE_KEY)) {
            void refreshKeybindings();
          }
        } catch {
        }
      };
      window.addEventListener("message", onMessage, true);
      document.addEventListener("mousemove", onPointer, { capture: true, passive: true });
      document.addEventListener("pointermove", onPointer, { capture: true, passive: true });
      document.addEventListener("mouseleave", onPointerLeave, true);
      document.addEventListener("pointerleave", onPointerLeave, true);
      document.addEventListener("scroll", onScroll, { capture: true, passive: true });
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });
      document.addEventListener("keydown", onKeyDown, true);
      try {
        chrome.runtime?.onMessage?.addListener(onRuntimeMessage);
      } catch {
      }
      try {
        chrome.storage?.onChanged?.addListener(onStorageChanged);
      } catch {
      }
      try {
        document.documentElement?.setAttribute("data-kp-frame-agent", "1");
      } catch {
      }
      void syncEnabledFromRuntime();
      void refreshKeybindings();
      return {
        dispose() {
          hideHover();
          if (pointerSyncRaf) {
            try {
              cancelAnimationFrame(pointerSyncRaf);
            } catch {
            }
            pointerSyncRaf = 0;
          }
          try {
            if (hoverEl) hoverEl.remove();
          } catch {
          }
          hoverEl = null;
          try {
            window.removeEventListener("message", onMessage, true);
            document.removeEventListener("mousemove", onPointer, true);
            document.removeEventListener("pointermove", onPointer, true);
            document.removeEventListener("mouseleave", onPointerLeave, true);
            document.removeEventListener("pointerleave", onPointerLeave, true);
            document.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("scroll", onScroll, true);
            document.removeEventListener("keydown", onKeyDown, true);
          } catch {
          }
          try {
            chrome.runtime?.onMessage?.removeListener(onRuntimeMessage);
          } catch {
          }
          try {
            chrome.storage?.onChanged?.removeListener(onStorageChanged);
          } catch {
          }
          try {
            document.documentElement?.removeAttribute("data-kp-frame-agent");
          } catch {
          }
        }
      };
    } catch (error) {
      console.warn("[KeyPilot] Failed to install frame click agent:", error);
      return null;
    }
  }

  // src/modules/popover-iframe-bridge.js
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
      let closeKeySet = /* @__PURE__ */ new Set(["Escape", "e", "E", "p", "P"]);
      const scrollByY = (deltaY, behavior = "smooth") => {
        try {
          const el = document.scrollingElement || document.documentElement || document.body;
          if (el && typeof el.scrollBy === "function") {
            el.scrollBy({ top: deltaY, behavior });
          } else {
            window.scrollBy({ top: deltaY, behavior });
          }
        } catch {
        }
      };
      const scrollToY = (top, behavior = "smooth") => {
        try {
          window.scrollTo({ top, behavior });
        } catch {
        }
      };
      const deepElementFromPoint2 = (x, y) => {
        try {
          let el = document.elementFromPoint(x, y);
          while (el && el.shadowRoot && typeof el.shadowRoot.elementFromPoint === "function") {
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
          if (typeof e.clientX === "number") lastMouse.x = e.clientX;
          if (typeof e.clientY === "number") lastMouse.y = e.clientY;
        } catch {
        }
      };
      const setInside = (v) => {
        mouseInsideFrame = !!v;
      };
      const typingAt = (target) => isTypingContext(target, treatSelectAsTyping ? { treatSelectAsTyping: true } : void 0);
      const resolveScrollParams = () => {
        const kp = window.__KeyPilotInstance;
        const pagePx = typeof kp?._getPageScrollPx === "function" ? kp._getPageScrollPx() : SCROLL.PAGE_PX;
        const halfPx = typeof kp?._getHalfPageScrollPx === "function" ? kp._getHalfPageScrollPx() : SCROLL.HALF_PAGE_PX;
        const behavior = typeof kp?._getScrollBehavior === "function" ? kp._getScrollBehavior() : SCROLL.BEHAVIOR || "smooth";
        return { pagePx, halfPx, behavior };
      };
      const onMessage = (event) => {
        const data = event?.data;
        if (!data || typeof data.type !== "string") return;
        if (data.type === MSG.POPOVER_BRIDGE_INIT) {
          bridgeActive = true;
          try {
            if (Array.isArray(data.closeKeys) && data.closeKeys.length) {
              closeKeySet = new Set(data.closeKeys.map(String));
              closeKeySet.add("Escape");
            }
          } catch {
          }
          try {
            window.__KP_POPOVER_IFRAME = true;
            window.__KP_POPOVER_CLOSE_KEYS = Array.from(closeKeySet);
          } catch {
          }
          try {
            window.parent.postMessage({ type: MSG.POPOVER_BRIDGE_READY }, "*");
          } catch {
          }
          if (typeof onBridgeInit === "function" && !keyPilotStarted) {
            keyPilotStarted = true;
            try {
              onBridgeInit();
            } catch {
            }
          }
          return;
        }
        if (!bridgeActive) return;
        if (data.type === MSG.POPOVER_SCROLL) {
          const behavior = data.behavior === "auto" ? "auto" : "smooth";
          if (data.command === "scrollBy") {
            const delta = Number(data.delta) || 0;
            scrollByY(delta, behavior);
          } else if (data.command === "scrollToTop") {
            scrollToY(0, behavior);
          } else if (data.command === "scrollToBottom") {
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
            window.parent.postMessage({ type: MSG.POPOVER_REQUEST_CLOSE, key }, "*");
          } catch {
          }
        };
        if (!typing && !mouseInsideFrame && (key === "f" || key === "F")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          try {
            window.parent.postMessage({ type: MSG.POPOVER_BRIDGE_KEYDOWN, key }, "*");
          } catch {
          }
          return;
        }
        if (!typing && closeKeySet.has(key)) return requestClose();
        if (key === "Escape") return requestClose();
        if (closeOnQuote && !typing && key === "'") return requestClose();
        if (enableFClickBeforeKeyPilot && !keyPilotStarted && !typing && (key === "f" || key === "F")) {
          let x = lastMouse.x;
          let y = lastMouse.y;
          if (typeof x !== "number" || typeof y !== "number") {
            x = Math.floor(window.innerWidth / 2);
            y = Math.floor(window.innerHeight / 2);
          }
          const target = deepElementFromPoint2(x, y);
          const link = target?.closest?.("a[href]") || null;
          if (link) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            try {
              link.click();
            } catch {
            }
          }
          return;
        }
        if (typing) return;
        const { halfPx, behavior } = resolveScrollParams();
        if (key === "c" || key === "C" || key === "v" || key === "V") {
          e.preventDefault();
          let mx = lastMouse.x;
          let my = lastMouse.y;
          if (typeof mx !== "number" || typeof my !== "number") {
            mx = Math.floor(window.innerWidth / 2);
            my = Math.floor(window.innerHeight / 2);
          }
          const sign = key === "c" || key === "C" ? -1 : 1;
          scrollAtPoint(mx, my, sign, halfPx, behavior);
        } else if (key === "z" || key === "Z" || key === "x" || key === "X") {
          e.preventDefault();
          let mx = lastMouse.x;
          let my = lastMouse.y;
          if (typeof mx !== "number" || typeof my !== "number") {
            mx = Math.floor(window.innerWidth / 2);
            my = Math.floor(window.innerHeight / 2);
          }
          const sign = key === "z" || key === "Z" ? -1 : 1;
          scrollToEdgeAtPoint(mx, my, sign, behavior);
        } else if (key === "b" || key === "B") {
          e.preventDefault();
          scrollToY(0, behavior);
        } else if (key === "n" || key === "N") {
          e.preventDefault();
          const height = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
          scrollToY(height, behavior);
        }
      };
      document.addEventListener("mousemove", updateMouse, true);
      document.addEventListener("pointermove", updateMouse, true);
      document.addEventListener("mouseenter", () => setInside(true), true);
      document.addEventListener("mouseleave", () => setInside(false), true);
      try {
        if (document.documentElement) {
          document.documentElement.addEventListener("mouseenter", () => setInside(true), true);
          document.documentElement.addEventListener("mouseleave", () => setInside(false), true);
        }
      } catch {
      }
      window.addEventListener("message", onMessage, true);
      document.addEventListener("keydown", onKeyDown, true);
      return {
        dispose() {
          try {
            window.removeEventListener("message", onMessage, true);
            document.removeEventListener("keydown", onKeyDown, true);
            document.removeEventListener("mousemove", updateMouse, true);
            document.removeEventListener("pointermove", updateMouse, true);
          } catch {
          }
        }
      };
    } catch (error) {
      if (typeof onError === "function") {
        try {
          onError(error);
        } catch {
        }
      } else {
        console.warn("[KeyPilot] Failed to install popover iframe bridge:", error);
      }
      return null;
    }
  }

  // src/frame-agent-entry.js
  (function installFrameAgentsIfNeeded() {
    try {
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
          } catch {
          }
          try {
            if (window.keyPilot || window.__KeyPilotToggleHandler) return;
          } catch {
          }
          try {
            chrome.runtime?.sendMessage?.(
              { type: MSG.INJECT_FULL_KEYPILOT_IN_FRAME },
              () => {
                try {
                  void chrome.runtime?.lastError;
                } catch {
                }
              }
            );
          } catch (e) {
            console.warn("[KeyPilot] Failed to request full KeyPilot inject in frame:", e);
          }
        },
        onError: (error) => {
          console.warn("[KeyPilot] Failed to install popover iframe bridge:", error);
        }
      });
    } catch (error) {
      console.warn("[KeyPilot] Failed to install frame agents:", error);
    }
  })();
})();
