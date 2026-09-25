/**
 * KeyPilot Chrome Extension — esbuild bundle
 * Generated on 2026-09-25T05:14:49.610Z
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
    /** Service worker → active tab action selected from the Keyboard Reference context menu. */
    KEYBOARD_REFERENCE_CONTEXT_ACTION: "KP_KEYBOARD_REFERENCE_CONTEXT_ACTION",
    // --- Tab / history navigation ---
    TAB_LEFT: "KP_TAB_LEFT",
    TAB_RIGHT: "KP_TAB_RIGHT",
    /** Content → SW: every normal window and its tabs. */
    TABS_OVERVIEW_GET: "KP_TABS_OVERVIEW_GET",
    /** SW → content: payload for TABS_OVERVIEW_GET. */
    TABS_OVERVIEW_RESULT: "KP_TABS_OVERVIEW_RESULT",
    /** Content → SW: focus a browser window without changing its active tab. */
    FOCUS_WINDOW: "KP_FOCUS_WINDOW",
    /** Content → SW: activate a tab and focus its window. */
    ACTIVATE_TAB: "KP_ACTIVATE_TAB",
    NEW_TAB: "KP_NEW_TAB",
    CLOSE_TAB: "KP_CLOSE_TAB",
    GO_BACK: "KP_GO_BACK",
    GO_FORWARD: "KP_GO_FORWARD",
    OPEN_URL_BACKGROUND: "KP_OPEN_URL_BACKGROUND",
    OPEN_URL_FOREGROUND: "KP_OPEN_URL_FOREGROUND",
    /** Open several http(s) URLs as background tabs, in order, after the sender tab. */
    OPEN_URLS: "KP_OPEN_URLS",
    /** Content → SW: bookmark folders for the Open Bookmarks picker. */
    LIST_BOOKMARK_FOLDERS: "KP_LIST_BOOKMARK_FOLDERS",
    /** SW → content: `{ folders: [{ id, path }] }`. */
    BOOKMARK_FOLDERS: "KP_BOOKMARK_FOLDERS",
    /** Content → SW: open the first website bookmarks in a folder. */
    OPEN_BOOKMARK_FOLDER: "KP_OPEN_BOOKMARK_FOLDER",
    /** Content → SW: open `count` random bookmarks. Empty folderId means every bookmark. */
    OPEN_RANDOM_BOOKMARK: "KP_OPEN_RANDOM_BOOKMARK",
    /** Same-tab navigate (chrome.tabs.update). Used when sandboxed iframes cannot top-navigate without a real user gesture. */
    NAVIGATE_SAME_TAB: "KP_NAVIGATE_SAME_TAB",
    /** Content → SW: step tab zoom in (+1) or out (-1). Response includes oldZoom/newZoom. */
    ZOOM_STEP: "KP_ZOOM_STEP",
    // --- UI open (content-script handlers; SW may forward) ---
    OPEN_SETTINGS_POPOVER: "KP_OPEN_SETTINGS_POPOVER",
    OPEN_GUIDE_POPOVER: "KP_OPEN_GUIDE_POPOVER",
    /** Open Docs popover; optional topicId / hash deep-link. */
    OPEN_DOCS_POPOVER: "KP_OPEN_DOCS_POPOVER",
    OPEN_ONBOARDING: "KP_OPEN_ONBOARDING",
    /** Reset walkthrough progress and open it (e.g. Guide "Launch Walkthrough"). */
    LAUNCH_WALKTHROUGH: "KP_LAUNCH_WALKTHROUGH",
    // --- History / bookmarks / top sites (SW APIs for content scripts) ---
    OMNIBOX_SUGGEST: "KP_OMNIBOX_SUGGEST",
    /** Response to OMNIBOX_SUGGEST */
    OMNIBOX_SUGGESTIONS: "KP_OMNIBOX_SUGGESTIONS",
    GET_BOOKMARKS: "KP_GET_BOOKMARKS",
    BOOKMARKS_RESPONSE: "KP_BOOKMARKS_RESPONSE",
    GET_RECENT_BOOKMARKS: "KP_GET_RECENT_BOOKMARKS",
    RECENT_BOOKMARKS_RESPONSE: "KP_RECENT_BOOKMARKS_RESPONSE",
    BROWSER_HISTORY_GET: "KP_BROWSER_HISTORY_GET",
    BROWSER_HISTORY_RESULT: "KP_BROWSER_HISTORY_RESULT",
    GET_TOP_SITES: "KP_GET_TOP_SITES",
    TOP_SITES_RESPONSE: "KP_TOP_SITES_RESPONSE",
    GET_MOST_VISITED: "KP_GET_MOST_VISITED",
    MOST_VISITED_RESPONSE: "KP_MOST_VISITED_RESPONSE",
    GET_HISTORY_FOR_DOMAINS: "KP_GET_HISTORY_FOR_DOMAINS",
    HISTORY_FOR_DOMAINS_RESPONSE: "KP_HISTORY_FOR_DOMAINS_RESPONSE",
    GET_RECENT_HISTORY: "KP_GET_RECENT_HISTORY",
    RECENT_HISTORY_RESPONSE: "KP_RECENT_HISTORY_RESPONSE",
    // --- Video thumbnails for card backgrounds (official oEmbed / sync URLs) ---
    GET_VIDEO_THUMB: "KP_GET_VIDEO_THUMB",
    VIDEO_THUMB_RESPONSE: "KP_VIDEO_THUMB_RESPONSE",
    // --- Media Library (IndexedDB at extension origin; SW owns Blobs) ---
    MEDIA_LIBRARY_ADD: "KP_MEDIA_LIBRARY_ADD",
    MEDIA_LIBRARY_LIST: "KP_MEDIA_LIBRARY_LIST",
    MEDIA_LIBRARY_GET: "KP_MEDIA_LIBRARY_GET",
    MEDIA_LIBRARY_DELETE: "KP_MEDIA_LIBRARY_DELETE",
    MEDIA_LIBRARY_ZIP: "KP_MEDIA_LIBRARY_ZIP",
    /** SW → tabs: library contents changed (add/delete). Overlay reloads if open. */
    MEDIA_LIBRARY_CHANGED: "KP_MEDIA_LIBRARY_CHANGED",
    // --- Dictionary lookup (Free Dictionary API via SW; LOOKUP_WORD) ---
    DICTIONARY_LOOKUP: "KP_DICTIONARY_LOOKUP",
    // --- Per-tab navigation graph ---
    NAVGRAPH_GET: "KP_NAVGRAPH_GET",
    /** Response payload for NAVGRAPH_GET */
    NAVGRAPH_GRAPH: "KP_NAVGRAPH_GRAPH",
    NAVGRAPH_JUMP: "KP_NAVGRAPH_JUMP",
    NAVGRAPH_CLEAR: "KP_NAVGRAPH_CLEAR",
    // --- Generic ---
    SUCCESS: "KP_SUCCESS",
    ERROR: "KP_ERROR",
    /** Lightweight ack (e.g. STATUS notification received) */
    ACK: "KP_ACK",
    // --- Separate-window Link Preview / Open Popover (chrome.windows popup) ---
    OPEN_POPOVER_WINDOW: "KP_OPEN_POPOVER_WINDOW",
    CLOSE_POPOVER_WINDOW: "KP_CLOSE_POPOVER_WINDOW",
    /** SW → opener: popover window closed (OS ✕ or in-window close). */
    POPOVER_WINDOW_CLOSED: "KP_POPOVER_WINDOW_CLOSED",
    /** Popup tab → SW: am I a KeyPilot popover window? */
    AM_I_POPOVER_WINDOW: "KP_AM_I_POPOVER_WINDOW",
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
    // --- Parent → child frame scroll (window.postMessage; layout scroll keys under an iframe) ---
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
    // --- Child → parent: typing focus inside a page iframe ---
    // Frame agent posts these on focusin/focusout of a text field in its document
    // (Gutenberg editor-canvas, etc.). Top FocusDetector peeks the same-origin
    // activeElement and enters/exits text_focus. No element is sent.
    // Payload: { type }
    FRAME_TYPING_FOCUS: "KP_FRAME_TYPING_FOCUS",
    FRAME_TYPING_BLUR: "KP_FRAME_TYPING_BLUR",
    // --- Parent → child: blur the typing field (Esc from top-frame text mode) ---
    FRAME_BLUR_TYPING: "KP_FRAME_BLUR_TYPING",
    // --- Child frame-agent → SW: inject full content-bundled.js into this frame ---
    // Used when a KeyPilot popover iframe needs full KeyPilot (cursor/overlays).
    // Thin frame-agent-bundled.js does not include the full app.
    INJECT_FULL_KEYPILOT_IN_FRAME: "KP_INJECT_FULL_KEYPILOT_IN_FRAME",
    // --- Content → SW: inject MAIN-world map.panBy bridge into the sender frame ---
    // Scroll Line uses this so isolated content can pan Leaflet/Mapbox/Google via
    // page globals. Idempotent; bridge listens for CustomEvent __kp_map_pan_v1.
    ENSURE_MAP_PAN_BRIDGE: "KP_ENSURE_MAP_PAN_BRIDGE",
    // --- Child frame-agent → SW: seek media in the page world ---
    // YouTube (and similar) ignore untrusted timeline clicks and overwrite
    // isolated-world video.currentTime from player state. MAIN-world seekTo
    // / currentTime in the sender frame commits the playhead.
    // Payload: { type, seconds: number }
    FRAME_MEDIA_SEEK: "KP_FRAME_MEDIA_SEEK",
    // --- Child frame-agent → SW: set media volume in the page world ---
    // YouTube volume popup ignores untrusted pointer on the knob. MAIN-world
    // setVolume(0–100) / unMute in the sender frame commits the level.
    // Payload: { type, volume: number } where volume is 0–1
    FRAME_MEDIA_VOLUME: "KP_FRAME_MEDIA_VOLUME"
  });
  var TAB_UI_FORWARD_TYPES = Object.freeze([
    MSG.OPEN_SETTINGS_POPOVER,
    MSG.OPEN_GUIDE_POPOVER,
    MSG.OPEN_DOCS_POPOVER,
    MSG.OPEN_ONBOARDING,
    MSG.LAUNCH_WALKTHROUGH
  ]);

  // src/utils/i18n.js
  function isDebugBuild() {
    try {
      return !!globalThis.KEYPILOT_DEBUG;
    } catch {
      return false;
    }
  }
  function missingMessage(key2) {
    if (!isDebugBuild()) return "";
    console.warn(`[KeyPilot i18n] Missing message: ${key2}`);
    return `[i18n:${key2}]`;
  }
  var KEYCAP_MESSAGE_KEYS = Object.freeze({
    Tab: "keycap_tab",
    Caps: "keycap_caps",
    Shift: "keycap_shift",
    Enter: "keycap_enter",
    Backspace: "keycap_backspace",
    Esc: "keycap_esc",
    Escape: "keycap_esc"
  });
  function getMessage(key2, substitutions) {
    const messageKey = typeof key2 === "string" ? key2.trim() : "";
    if (!messageKey) return missingMessage(String(key2 || "(empty key)"));
    try {
      const message = chrome?.i18n?.getMessage?.(messageKey, substitutions);
      return typeof message === "string" && message ? message : missingMessage(messageKey);
    } catch {
      return missingMessage(messageKey);
    }
  }
  var ATTRIBUTE_BINDINGS = Object.freeze([
    ["data-i18n", "textContent"],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-aria-label", "aria-label"],
    ["data-i18n-title", "title"]
  ]);

  // src/config/keyboard-hardware-layouts.js
  var DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID = (
    /** @type {const} */
    "us-ansi-qwerty"
  );
  function key(code, hidUsage, base, { shift, altGr, shiftAltGr, width } = {}) {
    return Object.freeze({
      code,
      hidUsage,
      ...typeof width === "number" ? { width } : {},
      legends: Object.freeze({
        base,
        ...typeof shift === "string" ? { shift } : {},
        ...typeof altGr === "string" ? { altGr } : {},
        ...typeof shiftAltGr === "string" ? { shiftAltGr } : {}
      })
    });
  }
  function row(id, keys, { offset } = {}) {
    return Object.freeze({
      id,
      ...typeof offset === "number" ? { offset } : {},
      keys: Object.freeze(keys)
    });
  }
  function referenceRow(id, codes) {
    return Object.freeze({ id, codes: Object.freeze(codes) });
  }
  var US_ANSI_QWERTY_ROWS = Object.freeze([
    row("number", [
      key("Backquote", "0x35", "`", { shift: "~" }),
      key("Digit1", "0x1E", "1", { shift: "!" }),
      key("Digit2", "0x1F", "2", { shift: "@" }),
      key("Digit3", "0x20", "3", { shift: "#" }),
      key("Digit4", "0x21", "4", { shift: "$" }),
      key("Digit5", "0x22", "5", { shift: "%" }),
      key("Digit6", "0x23", "6", { shift: "^" }),
      key("Digit7", "0x24", "7", { shift: "&" }),
      key("Digit8", "0x25", "8", { shift: "*" }),
      key("Digit9", "0x26", "9", { shift: "(" }),
      key("Digit0", "0x27", "0", { shift: ")" }),
      key("Minus", "0x2D", "-", { shift: "_" }),
      key("Equal", "0x2E", "=", { shift: "+" }),
      key("Backspace", "0x2A", "Backspace", { width: 1.55 })
    ]),
    row("top", [
      key("Tab", "0x2B", "Tab", { width: 1.5 }),
      key("KeyQ", "0x14", "Q", { shift: "Q" }),
      key("KeyW", "0x1A", "W", { shift: "W" }),
      key("KeyE", "0x08", "E", { shift: "E" }),
      key("KeyR", "0x15", "R", { shift: "R" }),
      key("KeyT", "0x17", "T", { shift: "T" }),
      key("KeyY", "0x1C", "Y", { shift: "Y" }),
      key("KeyU", "0x18", "U", { shift: "U" }),
      key("KeyI", "0x0C", "I", { shift: "I" }),
      key("KeyO", "0x12", "O", { shift: "O" }),
      key("KeyP", "0x13", "P", { shift: "P" }),
      key("BracketLeft", "0x2F", "[", { shift: "{" }),
      key("BracketRight", "0x30", "]", { shift: "}" }),
      key("Backslash", "0x31", "\\", { shift: "|", width: 1.5 })
    ]),
    row("home", [
      key("CapsLock", "0x39", "Caps", { width: 1.75 }),
      key("KeyA", "0x04", "A", { shift: "A" }),
      key("KeyS", "0x16", "S", { shift: "S" }),
      key("KeyD", "0x07", "D", { shift: "D" }),
      key("KeyF", "0x09", "F", { shift: "F" }),
      key("KeyG", "0x0A", "G", { shift: "G" }),
      key("KeyH", "0x0B", "H", { shift: "H" }),
      key("KeyJ", "0x0D", "J", { shift: "J" }),
      key("KeyK", "0x0E", "K", { shift: "K" }),
      key("KeyL", "0x0F", "L", { shift: "L" }),
      key("Semicolon", "0x33", ";", { shift: ":" }),
      key("Quote", "0x34", "'", { shift: '"' }),
      key("Enter", "0x28", "Enter", { width: 2 })
    ]),
    row("bottom", [
      key("ShiftLeft", "0xE1", "Shift", { width: 2.15 }),
      key("KeyZ", "0x1D", "Z", { shift: "Z" }),
      key("KeyX", "0x1B", "X", { shift: "X" }),
      key("KeyC", "0x06", "C", { shift: "C" }),
      key("KeyV", "0x19", "V", { shift: "V" }),
      key("KeyB", "0x05", "B", { shift: "B" }),
      key("KeyN", "0x11", "N", { shift: "N" }),
      key("KeyM", "0x10", "M", { shift: "M" }),
      key("Comma", "0x36", ",", { shift: "<" }),
      key("Period", "0x37", ".", { shift: ">" }),
      key("Slash", "0x38", "/", { shift: "?" }),
      key("ShiftRight", "0xE5", "Shift", { width: 2.15 })
    ]),
    row("modifier", [
      key("ControlLeft", "0xE0", "Ctrl", { width: 1.25 }),
      key("MetaLeft", "0xE3", "Meta", { width: 1.25 }),
      key("AltLeft", "0xE2", "Alt", { width: 1.25 }),
      key("Space", "0x2C", "Space", { width: 6.25 }),
      key("AltRight", "0xE6", "Alt", { width: 1.25 }),
      key("MetaRight", "0xE7", "Meta", { width: 1.25 }),
      key("ContextMenu", "0x65", "Menu", { width: 1.25 }),
      key("ControlRight", "0xE4", "Ctrl", { width: 1.25 })
    ])
  ]);
  var US_ANSI_QWERTY_KEYBOARD_REFERENCE = Object.freeze({
    rows: Object.freeze([
      referenceRow("top", [
        "Tab",
        "KeyQ",
        "KeyW",
        "KeyE",
        "KeyR",
        "KeyT",
        "KeyY",
        "KeyU",
        "KeyI",
        "KeyO",
        "KeyP",
        "BracketLeft",
        "BracketRight",
        "Backspace"
      ]),
      referenceRow("home", [
        "CapsLock",
        "KeyA",
        "KeyS",
        "KeyD",
        "KeyF",
        "KeyG",
        "KeyH",
        "KeyJ",
        "KeyK",
        "KeyL",
        "Semicolon",
        "Quote",
        "Enter"
      ]),
      referenceRow("bottom", [
        "ShiftLeft",
        "KeyZ",
        "KeyX",
        "KeyC",
        "KeyV",
        "KeyB",
        "KeyN",
        "KeyM",
        "Comma",
        "Period",
        "Slash",
        "ShiftRight"
      ])
    ]),
    numberRowCodes: Object.freeze([
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit4",
      "Digit5",
      "Digit6",
      "Digit7",
      "Digit8",
      "Digit9",
      "Digit0"
    ])
  });
  function cloneRowsWithLegends(baseRows, overrides = {}, extraBottomKey = null) {
    return Object.freeze(baseRows.map((physicalRow) => {
      const keys = physicalRow.keys.flatMap((physicalKey) => {
        const override = overrides[physicalKey.code];
        const next = override ? Object.freeze({ ...physicalKey, legends: Object.freeze({ ...physicalKey.legends, ...override }) }) : physicalKey;
        if (extraBottomKey && physicalRow.id === "bottom" && physicalKey.code === "KeyZ") {
          return [extraBottomKey, next];
        }
        return [next];
      });
      return row(physicalRow.id, keys, { offset: physicalRow.offset });
    }));
  }
  function cloneReferenceGeometry(base, { extraBottomCode = "", extraTopCode = "" } = {}) {
    return Object.freeze({
      rows: Object.freeze(base.rows.map((referenceRowDef) => {
        const codes = referenceRowDef.codes.flatMap((code) => {
          if (extraBottomCode && referenceRowDef.id === "bottom" && code === "KeyZ") return [extraBottomCode, code];
          if (extraTopCode && referenceRowDef.id === "top" && code === "Backspace") return [extraTopCode, code];
          return [code];
        });
        return referenceRow(referenceRowDef.id, codes);
      })),
      numberRowCodes: base.numberRowCodes
    });
  }
  var ISO_INTL_BACKSLASH = key("IntlBackslash", "0x64", "<", { shift: ">" });
  var GERMAN_ISO_QWERTZ_ROWS = cloneRowsWithLegends(US_ANSI_QWERTY_ROWS, {
    KeyY: { base: "Z", shift: "Z" },
    KeyZ: { base: "Y", shift: "Y" },
    BracketLeft: { base: "\xDC", shift: "\xDC" },
    BracketRight: { base: "+", shift: "*", altGr: "~" },
    Semicolon: { base: "\xD6", shift: "\xD6" },
    Quote: { base: "\xC4", shift: "\xC4" }
  }, ISO_INTL_BACKSLASH);
  var SPAIN_ISO_QWERTY_ROWS = cloneRowsWithLegends(US_ANSI_QWERTY_ROWS, {
    Semicolon: { base: "\xD1", shift: "\xD1" },
    Quote: { base: "\xB4", shift: "\xA8", altGr: "{" },
    Backslash: { base: "\xC7", shift: "\xC7", altGr: "}" }
  }, ISO_INTL_BACKSLASH);
  var SLOVAK_ISO_QWERTZ_ROWS = cloneRowsWithLegends(US_ANSI_QWERTY_ROWS, {
    KeyY: { base: "Z", shift: "Z" },
    KeyZ: { base: "Y", shift: "Y" },
    BracketLeft: { base: "\xDA", shift: "/" },
    BracketRight: { base: "\xC4", shift: "(" },
    Semicolon: { base: "\xD4", shift: '"' },
    Quote: { base: "\xA7", shift: "!" }
  }, ISO_INTL_BACKSLASH);
  var JIS_INTL_YEN = key("IntlYen", "0x89", "\xA5", { shift: "|" });
  var JIS_INTL_RO = key("IntlRo", "0x87", "\u308D", { shift: "\u30ED" });
  var JIS_NON_CONVERT = key("NonConvert", "0x8B", "\u7121\u5909\u63DB", { width: 1.25 });
  var JIS_CONVERT = key("Convert", "0x8A", "\u5909\u63DB", { width: 1.25 });
  var JIS_KANA_MODE = key("KanaMode", "0x88", "\u304B\u306A", { width: 1.25 });
  var JAPANESE_JIS_ROWS = Object.freeze([
    ...US_ANSI_QWERTY_ROWS.slice(0, 1).map((physicalRow) => row(
      physicalRow.id,
      physicalRow.keys.flatMap((physicalKey) => physicalKey.code === "Backspace" ? [JIS_INTL_YEN, physicalKey] : [physicalKey]),
      { offset: physicalRow.offset }
    )),
    ...US_ANSI_QWERTY_ROWS.slice(1, 3),
    row("bottom", US_ANSI_QWERTY_ROWS.find((physicalRow) => physicalRow.id === "bottom").keys.flatMap((physicalKey) => physicalKey.code === "ShiftRight" ? [JIS_INTL_RO, physicalKey] : [physicalKey])),
    row("modifier", [
      key("ControlLeft", "0xE0", "Ctrl", { width: 1.25 }),
      key("MetaLeft", "0xE3", "\u82F1\u6570", { width: 1.25 }),
      key("AltLeft", "0xE2", "Alt", { width: 1.25 }),
      JIS_NON_CONVERT,
      key("Space", "0x2C", "Space", { width: 3 }),
      JIS_CONVERT,
      JIS_KANA_MODE,
      key("AltRight", "0xE6", "Alt", { width: 1.25 }),
      key("ControlRight", "0xE4", "Ctrl", { width: 1.25 })
    ])
  ]);
  var JAPANESE_JIS_KEYBOARD_REFERENCE = Object.freeze({
    rows: Object.freeze([
      referenceRow("top", [
        "Tab",
        "KeyQ",
        "KeyW",
        "KeyE",
        "KeyR",
        "KeyT",
        "KeyY",
        "KeyU",
        "KeyI",
        "KeyO",
        "KeyP",
        "BracketLeft",
        "BracketRight",
        "Backspace"
      ]),
      referenceRow("home", [
        "CapsLock",
        "KeyA",
        "KeyS",
        "KeyD",
        "KeyF",
        "KeyG",
        "KeyH",
        "KeyJ",
        "KeyK",
        "KeyL",
        "Semicolon",
        "Quote",
        "Enter"
      ]),
      referenceRow("bottom", [
        "ShiftLeft",
        "KeyZ",
        "KeyX",
        "KeyC",
        "KeyV",
        "KeyB",
        "KeyN",
        "KeyM",
        "Comma",
        "Period",
        "Slash",
        "IntlRo",
        "ShiftRight"
      ])
    ]),
    numberRowCodes: Object.freeze([
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit4",
      "Digit5",
      "Digit6",
      "Digit7",
      "Digit8",
      "Digit9",
      "Digit0"
    ])
  });
  var KEYBOARD_HARDWARE_LAYOUTS = Object.freeze({
    "us-ansi-qwerty": Object.freeze({
      id: "us-ansi-qwerty",
      labelKey: "keyboard_hardware_layout_us_ansi_qwerty",
      formFactor: "ANSI",
      rows: US_ANSI_QWERTY_ROWS,
      keyboardReference: US_ANSI_QWERTY_KEYBOARD_REFERENCE
    }),
    "de-de-qwertz-iso": Object.freeze({
      id: "de-de-qwertz-iso",
      labelKey: "keyboard_hardware_layout_de_de_qwertz_iso",
      formFactor: "ISO",
      rows: GERMAN_ISO_QWERTZ_ROWS,
      keyboardReference: cloneReferenceGeometry(US_ANSI_QWERTY_KEYBOARD_REFERENCE, { extraBottomCode: "IntlBackslash" })
    }),
    "es-es-qwerty-iso": Object.freeze({
      id: "es-es-qwerty-iso",
      labelKey: "keyboard_hardware_layout_es_es_qwerty_iso",
      formFactor: "ISO",
      rows: SPAIN_ISO_QWERTY_ROWS,
      keyboardReference: cloneReferenceGeometry(US_ANSI_QWERTY_KEYBOARD_REFERENCE, { extraBottomCode: "IntlBackslash" })
    }),
    "sk-sk-qwertz-iso": Object.freeze({
      id: "sk-sk-qwertz-iso",
      labelKey: "keyboard_hardware_layout_sk_sk_qwertz_iso",
      formFactor: "ISO",
      rows: SLOVAK_ISO_QWERTZ_ROWS,
      keyboardReference: cloneReferenceGeometry(US_ANSI_QWERTY_KEYBOARD_REFERENCE, { extraBottomCode: "IntlBackslash" })
    }),
    "ja-jis-106": Object.freeze({
      id: "ja-jis-106",
      labelKey: "keyboard_hardware_layout_ja_jis_106",
      formFactor: "JIS",
      rows: JAPANESE_JIS_ROWS,
      keyboardReference: JAPANESE_JIS_KEYBOARD_REFERENCE
    })
  });
  function normalizeKeyboardHardwareLayoutId(rawId) {
    const id = String(rawId || "").trim();
    return KEYBOARD_HARDWARE_LAYOUTS[id] ? id : DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID;
  }
  var KEYBOARD_REFERENCE_SPECIAL_CLASS_BY_CODE = Object.freeze({
    Tab: "key key-tab",
    CapsLock: "key key-caps",
    Enter: "key key-enter",
    ShiftLeft: "key key-shift",
    ShiftRight: "key key-shift",
    Backspace: "key key-backspace"
  });

  // src/utils/open-url-list.js
  var OPEN_URLS_MAX = 20;
  function canonicalizeHttpUrl(value) {
    let raw = String(value ?? "").trim();
    if (!raw || /\s/.test(raw)) return "";
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `https://${raw}`;
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      if (!url.hostname || !url.hostname.includes(".")) return "";
      return url.href;
    } catch {
      return "";
    }
  }
  function normalizeOpenUrlList(raw, max = OPEN_URLS_MAX) {
    const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : OPEN_URLS_MAX;
    const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\r?\n/) : [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of items) {
      const url = canonicalizeHttpUrl(item);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      if (out.length >= limit) break;
    }
    return out;
  }

  // src/config/stock-actions.js
  var STOCK_SOCIAL_MEDIA_ACTION_ID = "stock:social-media";
  var STOCK_RANDOM_BOOKMARK_ACTION_ID = "stock:random-bookmark";
  var STOCK_ACTIONS = Object.freeze([
    Object.freeze({
      id: STOCK_SOCIAL_MEDIA_ACTION_ID,
      functionId: "OPEN_URLS",
      handler: "handleOpenUrlsKey",
      keyboardClass: "key-open-urls",
      labelKey: "fn_stock_social_media_label",
      descriptionKey: "fn_stock_social_media_description",
      label: "Social media",
      description: "Open Facebook, Instagram, YouTube, and X",
      parameters: Object.freeze({
        urls: Object.freeze(normalizeOpenUrlList([
          "facebook.com",
          "instagram.com",
          "youtube.com",
          "x.com"
        ]))
      })
    }),
    Object.freeze({
      id: STOCK_RANDOM_BOOKMARK_ACTION_ID,
      functionId: "RANDOM_BOOKMARK",
      handler: "handleRandomBookmarkKey",
      keyboardClass: "key-open-urls",
      labelKey: "fn_stock_random_bookmark_label",
      descriptionKey: "fn_stock_random_bookmark_description",
      label: "Random Bookmark",
      description: "Open one random bookmark",
      parameters: Object.freeze({
        folderId: "",
        count: 1
      })
    })
  ]);
  function getStockActionById(id) {
    const key2 = String(id || "");
    const found = STOCK_ACTIONS.find((action) => action && action.id === key2);
    if (!found) return null;
    return {
      ...found,
      label: getMessage(found.labelKey) || found.label || found.id,
      description: found.descriptionKey && getMessage(found.descriptionKey) || found.description || ""
    };
  }

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
    "COLS_TOGGLE",
    // Type — "Type saved text into the focused field."
    "TYPE_CHARACTERS",
    // Data — "Read text or media under the cursor, or from a highlight."
    "GET_TEXT_AT_CURSOR",
    "GET_TEXT_RANGE",
    "GET_MEDIA_AT_CURSOR",
    // Script — "Run a user-authored JavaScript snippet against page state."
    "EXECUTE_JS",
    // Create built-in Macro Key — "Saved Macro Key instances (hotkey, burst, round-robin, and related kinds) ready to place."
    "SEND_HOTKEY",
    "SEND_BURST",
    "CYCLE_ROUND_ROBIN",
    "HOLD_CONTINUOUS",
    "CLICK_MOUSE_BUTTON",
    "REMAP_KEY",
    // Translate — "Translate highlighted or under-cursor text."
    "TRANSLATE",
    // AI — "Send selected text to AI with a prompt and result destination."
    "SEND_TEXT_TO_AI"
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
      labelKey: "layout_family_browsing_label",
      builtIn: true,
      descriptionKey: "layout_family_browsing_description",
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
      labelKey: "layout_family_navigation_label",
      builtIn: true,
      descriptionKey: "layout_family_navigation_description",
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
      keyboardClass: "key-highlight",
      row: 3
    }),
    TAB_LEFT: Object.freeze({
      handler: "handleTabLeftKey",
      label: "Tab Left",
      description: "Switch to the previous tab",
      details: "Activates the tab to the left of the current one in the window\u2019s tab strip.",
      keyboardClass: "key-browser-chrome",
      row: 1
    }),
    TAB_RIGHT: Object.freeze({
      handler: "handleTabRightKey",
      label: "Tab Right",
      description: "Switch to the next tab",
      details: "Activates the tab to the right of the current one in the window\u2019s tab strip.",
      keyboardClass: "key-browser-chrome",
      row: 1
    }),
    ROOT: Object.freeze({
      handler: "handleRootKey",
      label: "Go to Site Root",
      description: "Navigate to the site origin",
      details: "Jumps to the site root (scheme + host) of the current page \u2014 useful for escaping deep paths without typing a URL.",
      keyboardClass: "key-open-urls",
      row: 2
    }),
    LAUNCHER: Object.freeze({
      handler: "handleLauncherKey",
      label: "Launcher",
      description: "Quick-access site launcher",
      details: "Opens the Launcher popover for jumping to favorite or configured sites without using the omnibox.",
      keyboardClass: "key-kp-ui",
      row: 2
    }),
    TOP_SITES: Object.freeze({
      handler: "handleTopSitesKey",
      label: "Top Sites",
      description: "Toolbar, visits, and bookmarks",
      details: "Opens Top Sites: a quick list drawn from the toolbar, most-visited pages, and recent bookmarks so you can open a frequent destination in one step.",
      keyboardClass: "key-kp-ui",
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
      keyboardClass: "key-gray",
      row: null
    }),
    PAGE_UP_INSTANT: Object.freeze({
      handler: "handleInstantPageUp",
      label: "Page Up",
      description: "Jump one page up instantly",
      details: "Scrolls the current scroll target up by roughly one viewport without animation \u2014 faster than a smooth page-up when you need to move quickly.",
      keyboardClass: "key-page-scroll",
      row: 3
    }),
    PAGE_DOWN_INSTANT: Object.freeze({
      handler: "handleInstantPageDown",
      label: "Page Down",
      description: "Jump one page down instantly",
      details: "Scrolls the current scroll target down by roughly one viewport without animation \u2014 faster than a smooth page-down when you need to move quickly.",
      keyboardClass: "key-page-scroll",
      row: 3
    }),
    PAGE_TOP: Object.freeze({
      handler: "handlePageTop",
      label: "Scroll To Top",
      description: "Jump to top of scroll target",
      details: "Moves to the top of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings \u2192 Scrolling.",
      keyboardClass: "key-page-scroll",
      row: 3
    }),
    PAGE_BOTTOM: Object.freeze({
      handler: "handlePageBottom",
      label: "Scroll To Bottom",
      description: "Jump to bottom of scroll target",
      details: "Moves to the bottom of the current scroll target. Fade mode hides the jump; Scroll mode animates. Configure the motion style in Settings \u2192 Scrolling.",
      keyboardClass: "key-page-scroll",
      row: 3
    }),
    SCROLL_LINE: Object.freeze({
      handler: "handleScrollLineKey",
      label: "Scroll Line",
      description: "Origin-based continuous scroll",
      details: "Scrolls from a fixed origin: move the mouse away from the on-screen dot to scroll faster in that direction. Optionally enable middle-click on empty page area under Settings \u2192 Scrolling.",
      keyboardClass: "key-page-scroll",
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
    ZOOM_OUT: Object.freeze({
      handler: "handleZoomOutKey",
      label: "Zoom Out",
      description: "Zoom the page out at the cursor",
      details: "Zooms the tab out one browser zoom step and keeps the point under the cursor fixed, the same as a pinch-out gesture.",
      keyboardClass: "key-browser-chrome",
      row: 1
    }),
    ZOOM_IN: Object.freeze({
      handler: "handleZoomInKey",
      label: "Zoom In",
      description: "Zoom the page in at the cursor",
      details: "Zooms the tab in one browser zoom step and keeps the point under the cursor fixed, the same as a pinch-in gesture.",
      keyboardClass: "key-browser-chrome",
      row: 1
    }),
    NEW_TAB: Object.freeze({
      handler: "handleNewTabKey",
      label: "New Tab",
      description: "Open the KeyPilot new tab",
      details: "Opens a KeyPilot new tab with your bookmarks bar, top sites, and search. The browser\u2019s own new tab stays unchanged.",
      keyboardClass: "key-browser-chrome",
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
      keyboardClass: "key-page-media",
      row: null
    }),
    OPEN_SETTINGS_POPOVER: Object.freeze({
      handler: "handleToggleSettingsPopover",
      label: "Settings",
      description: "Open KeyPilot Settings",
      details: "Opens or closes the KeyPilot Settings popover for themes, scrolling, click mode, layouts, and other preferences.",
      keyboardClass: "key-kp-ui",
      row: null
    }),
    OMNIBOX: Object.freeze({
      handler: "handleOpenOmnibox",
      label: "Omnibox",
      description: "Address bar overlay",
      details: "Opens KeyPilot\u2019s omnibox overlay so you can type a URL or search without clicking the browser address bar.",
      keyboardClass: "key-kp-ui",
      row: 2
    }),
    TAB_HISTORY: Object.freeze({
      handler: "handleToggleTabHistoryPopover",
      label: "Tab History",
      description: "Browse this tab\u2019s history",
      details: "Opens Tab History for the current tab so you can jump to a previously visited page in this tab\u2019s session without using the browser\u2019s native history UI.",
      keyboardClass: "key-kp-ui",
      row: 2
    }),
    TABS_OVERVIEW: Object.freeze({
      handler: "handleToggleTabsOverview",
      label: "Tabs Overview",
      description: "Show every window and tab",
      details: "Opens an overlay of every browser window with its tabs listed inside. Key-click a tab to switch to it, or key-click a window header to focus that window and keep its active tab. The current window is listed first, and the current tab is highlighted.",
      keyboardClass: "key-kp-ui",
      row: 3
    }),
    TOGGLE_KEYBOARD_HELP: Object.freeze({
      handler: "handleToggleKeyboardHelp",
      label: "KB Reference",
      description: "Show or hide the keyboard map",
      details: "Toggles the floating Keyboard Reference window that shows your current layout\u2019s keycaps and bindings.",
      keyboardClass: "key-kp-ui",
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
    // Copy image under cursor (I on right-handed; E on left-handed — I is READER_MODE there).
    COPY_HOVERED_IMAGE: Object.freeze({
      handler: "handleCopyHoveredImageKey",
      label: "Copy Image",
      description: "Copy hovered image",
      details: "Copies the image under the cursor to the clipboard, Media Library, or both \u2014 configure the destination on the action. Prefer this when you want the image bytes or a saved library entry, not just a URL.",
      keyboardClass: "key-page-media",
      row: 1
    }),
    // Copy hyperlink under cursor (U on right-handed; no default on left — U is FORWARD there).
    COPY_HOVERED_URL: Object.freeze({
      handler: "handleCopyHoveredUrlKey",
      label: "Copy URL",
      description: "Copy hovered link URL",
      details: "Copies the URL under the cursor to the clipboard, Media Library, or both. Use this when you need the href itself rather than fetching or opening the resource.",
      keyboardClass: "key-page-media",
      row: 1
    }),
    // Copy video under cursor — Actions Library only (no built-in layout key).
    COPY_HOVERED_VIDEO: Object.freeze({
      handler: "handleCopyHoveredVideoKey",
      label: "Copy Video",
      description: "Copy hovered video",
      details: "Copies the video under the cursor (file bytes to Media Library when fetchable, or the video URL to the clipboard). No default layout key \u2014 bind it in Layout Editor if you need it.",
      keyboardClass: "key-page-media",
      row: null
    }),
    // Font under cursor — Actions Library only (no built-in layout key).
    FONT_INFO: Object.freeze({
      handler: "handleFontInfoKey",
      label: "Font Info",
      description: "Inspect font under the cursor",
      details: "Shows a popover with the font name, size, family, file type, and resource URL for the styled text under the cursor, and outlines that text run. No default layout key \u2014 bind it in Layout Editor if you need it.",
      keyboardClass: "key-page-media",
      row: null
    }),
    // Page-wide Image / Video / Text gallery (O on right-handed; O is TAB_RIGHT on left-handed).
    PAGE_MEDIA: Object.freeze({
      handler: "handlePageMediaKey",
      label: "Page Media",
      description: "Browse media found on this page",
      details: "Opens a gallery of images, videos, documents, fonts, and URLs discovered on the current page so you can review or collect them without hunting through the DOM.",
      keyboardClass: "key-page-media",
      row: 1
    }),
    READER_MODE: Object.freeze({
      handler: "handleReaderModeKey",
      label: "Reader Mode",
      description: "Read this page without clutter",
      details: "Opens a KeyPilot overlay with the article text (or your current selection). Press again or Esc to close. Unavailable on pages with no extractable article.",
      keyboardClass: "key-reader-mode",
      row: 1
    }),
    // Media Library entry point (M on right-handed only — M is PAGE_DOWN_INSTANT on left-handed,
    // so this doesn't get a default binding there yet).
    OPEN_MEDIA_LIBRARY: Object.freeze({
      handler: "handleOpenMediaLibraryKey",
      label: "Media Library",
      description: "Open saved Media Library",
      details: "Opens the Media Library where items you previously copied or saved (images, videos, URLs, and related assets) are kept for reuse.",
      keyboardClass: "key-media-library",
      row: 1
    }),
    // Clipboard commands (Functions palette — Clipboard category).
    CLIPBOARD_COPY: Object.freeze({
      handler: "handleClipboardCopyKey",
      label: "Copy",
      description: "Copy selection to clipboard",
      details: "Copies the current text selection to the system clipboard. Prefer this over OS shortcuts when you want Copy available as a KeyPilot layout binding.",
      keyboardClass: "key-clipboard",
      row: null
    }),
    CLIPBOARD_CUT: Object.freeze({
      handler: "handleClipboardCutKey",
      label: "Cut",
      description: "Cut selection to clipboard",
      details: "Cuts the current text selection to the system clipboard from the focused field or editable region.",
      keyboardClass: "key-clipboard",
      row: null
    }),
    CLIPBOARD_PASTE: Object.freeze({
      handler: "handleClipboardPasteKey",
      label: "Paste",
      description: "Paste into the focused field",
      details: "Pastes clipboard text into the focused text field or editable element. Bind with a modifier chord if you need it while typing.",
      keyboardClass: "key-clipboard",
      row: null
    }),
    CLIPBOARD_SELECT_ALL: Object.freeze({
      handler: "handleClipboardSelectAllKey",
      label: "Select All",
      description: "Select all in field or page",
      details: "Selects all text in the focused field, or the page content when nothing editable is focused \u2014 same idea as the usual Select All shortcut.",
      keyboardClass: "key-clipboard",
      row: null
    }),
    SELECT_WORD: Object.freeze({
      handler: "handleSelectWordKey",
      label: "Select Word",
      description: "Select the word under the cursor",
      details: "Selects the word under the KeyPilot cursor. Press again over the same word to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy reads this selection.",
      keyboardClass: "key-highlight",
      row: null
    }),
    SELECT_SENTENCE: Object.freeze({
      handler: "handleSelectSentenceKey",
      label: "Select Sentence",
      description: "Select the sentence under the cursor",
      details: "Selects the sentence under the KeyPilot cursor. Press again over the same sentence to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).",
      keyboardClass: "key-highlight",
      row: null
    }),
    SELECT_PARAGRAPH: Object.freeze({
      handler: "handleSelectParagraphKey",
      label: "Select Paragraph",
      description: "Select the paragraph under the cursor",
      details: "Selects the paragraph (or nearest block) under the KeyPilot cursor. Press again over the same block to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key).",
      keyboardClass: "key-highlight",
      row: null
    }),
    SELECT_IMAGE: Object.freeze({
      handler: "handleSelectImageKey",
      label: "Select Image",
      description: "Select the image under the cursor",
      details: "Selects the image under the KeyPilot cursor. Press again over the same image to deselect it. Exclusive vs cumulative is a popover setting (shared, not per-key). Copy can copy selected images.",
      keyboardClass: "key-highlight",
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
    TABS_OVERVIEW: "Tab Control",
    PAGE_UP_INSTANT: "Scroll",
    PAGE_DOWN_INSTANT: "Scroll",
    PAGE_TOP: "Scroll",
    PAGE_BOTTOM: "Scroll",
    SCROLL_LINE: "Scroll",
    ZOOM_OUT: "Scroll",
    ZOOM_IN: "Scroll",
    HIGHLIGHT: "Get Page Data",
    RECTANGLE_HIGHLIGHT: "Get Page Data",
    COPY_HOVERED_IMAGE: "Get Page Data",
    COPY_HOVERED_URL: "Get Page Data",
    COPY_HOVERED_VIDEO: "Get Page Data",
    FONT_INFO: "Get Page Data",
    PAGE_MEDIA: "Get Page Data",
    READER_MODE: "Get Page Data",
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
  function localizedActionCopy(actionId, def) {
    const id = String(actionId || "");
    return {
      label: getMessage(`fn_${id}_label`) || def?.label || id,
      description: getMessage(`fn_${id}_description`) || def?.description || ""
    };
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
      const copy = localizedActionCopy(actionId, def);
      out[actionId] = {
        keys: assign.keys.slice(),
        ...assign.bindingType ? { bindingType: assign.bindingType } : {},
        ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
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
        ...assign.bindingType ? { bindingType: assign.bindingType } : {},
        ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
        handler: stock.handler,
        functionId: stock.functionId,
        instanceId: stock.id,
        parameters: stock.parameters,
        label: localized?.label || stock.id,
        description: localized?.description || "",
        keyLabel: labels.keyLabel,
        keyboardClass: stock.keyboardClass ?? null,
        row: null,
        displayKey: labels.displayKey
      };
    }
    return out;
  }
  var CATALOG_KEYBINDINGS = (() => {
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
        displayKey: "",
        keyLabel: ""
      });
    }
    return Object.freeze(out);
  })();
  function physicalAssignment(code, displayKey) {
    return Object.freeze({
      bindingType: "physical",
      keys: Object.freeze([code]),
      matchOn: Object.freeze(["code"]),
      displayKey,
      keyLabel: displayKey
    });
  }
  var ASSIGNMENTS_BROWSING_RIGHT = Object.freeze({
    TAB_LEFT: physicalAssignment("KeyQ", "Q"),
    TAB_RIGHT: physicalAssignment("KeyW", "W"),
    READER_MODE: physicalAssignment("KeyP", "P"),
    PREVIEW_LINK_POPOVER: physicalAssignment("KeyE", "E"),
    FORWARD: physicalAssignment("KeyR", "R"),
    NEW_TAB: physicalAssignment("KeyT", "T"),
    CLOSE_TAB: physicalAssignment("KeyA", "A"),
    ROOT: physicalAssignment("KeyS", "S"),
    BACK: physicalAssignment("KeyD", "D"),
    ACTIVATE: physicalAssignment("KeyF", "F"),
    ACTIVATE_NEW_TAB_BACKGROUND: physicalAssignment("KeyG", "G"),
    HIGHLIGHT: physicalAssignment("KeyH", "H"),
    TAB_HISTORY: physicalAssignment("KeyJ", "J"),
    OMNIBOX: physicalAssignment("KeyL", "L"),
    TOP_SITES: physicalAssignment("Semicolon", ";"),
    PAGE_TOP: physicalAssignment("KeyZ", "Z"),
    PAGE_BOTTOM: physicalAssignment("KeyX", "X"),
    PAGE_UP_INSTANT: physicalAssignment("KeyC", "C"),
    PAGE_DOWN_INSTANT: physicalAssignment("KeyV", "V"),
    SCROLL_LINE: physicalAssignment("KeyB", "B"),
    ZOOM_OUT: physicalAssignment("BracketLeft", "["),
    ZOOM_IN: physicalAssignment("BracketRight", "]"),
    ACTIVATE_NEW_TAB: physicalAssignment("KeyN", "N"),
    RECTANGLE_HIGHLIGHT: physicalAssignment("KeyY", "Y"),
    COPY_HOVERED_IMAGE: physicalAssignment("KeyI", "I"),
    COPY_HOVERED_URL: physicalAssignment("KeyU", "U"),
    PAGE_MEDIA: physicalAssignment("KeyO", "O"),
    // M is otherwise unused on the right-handed layout (it's PAGE_DOWN_INSTANT on left-handed).
    OPEN_MEDIA_LIBRARY: physicalAssignment("KeyM", "M"),
    // Period mirrors to KeyX on the left-handed layout.
    [STOCK_SOCIAL_MEDIA_ACTION_ID]: physicalAssignment("Period", "."),
    // Comma is free on the right-handed layout. Left-handed mirror is KeyC.
    [STOCK_RANDOM_BOOKMARK_ACTION_ID]: physicalAssignment("Comma", ","),
    DELETE: physicalAssignment("Backspace", "Backspace"),
    // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
    // Slash mirrors to KeyZ on the left-handed layout.
    TABS_OVERVIEW: physicalAssignment("Slash", "/")
  });
  var ASSIGNMENTS_BROWSING_LEFT = Object.freeze({
    // Top row cluster: Q W E R T  ->  P O I U Y (mirrored)
    TAB_LEFT: physicalAssignment("KeyP", "P"),
    TAB_RIGHT: physicalAssignment("KeyO", "O"),
    PREVIEW_LINK_POPOVER: physicalAssignment("KeyW", "W"),
    FORWARD: physicalAssignment("KeyU", "U"),
    READER_MODE: physicalAssignment("KeyI", "I"),
    NEW_TAB: physicalAssignment("KeyY", "Y"),
    SCROLL_LINE: physicalAssignment("KeyT", "T"),
    ZOOM_OUT: physicalAssignment("BracketLeft", "["),
    ZOOM_IN: physicalAssignment("BracketRight", "]"),
    // Home row cluster: A S D F G  ->  ; L K J H (mirrored-ish around center)
    CLOSE_TAB: physicalAssignment("Semicolon", ";"),
    ROOT: physicalAssignment("KeyL", "L"),
    BACK: physicalAssignment("KeyK", "K"),
    ACTIVATE: physicalAssignment("KeyJ", "J"),
    ACTIVATE_NEW_TAB_BACKGROUND: physicalAssignment("KeyH", "H"),
    // H is background-tab open on left; G/R free for selection.
    HIGHLIGHT: physicalAssignment("KeyG", "G"),
    RECTANGLE_HIGHLIGHT: physicalAssignment("KeyR", "R"),
    // Utility actions on the left avoid colliding with J/K/L cluster.
    // (KB Reference / Settings / Esc live in the system layer, not layout assignments.)
    TAB_HISTORY: physicalAssignment("KeyF", "F"),
    OMNIBOX: physicalAssignment("KeyS", "S"),
    TOP_SITES: physicalAssignment("KeyA", "A"),
    // Bottom row cluster: Z X C V B  ->  / . , M N (mirrored)
    // Mirror of right-handed Period.
    [STOCK_SOCIAL_MEDIA_ACTION_ID]: physicalAssignment("KeyX", "X"),
    PAGE_TOP: physicalAssignment("Slash", "/"),
    ACTIVATE_NEW_TAB: physicalAssignment("KeyB", "B"),
    PAGE_UP_INSTANT: physicalAssignment("Comma", ","),
    // Mirror of right-handed Comma. KeyC is free here (PAGE_UP sits on Comma).
    [STOCK_RANDOM_BOOKMARK_ACTION_ID]: physicalAssignment("KeyC", "C"),
    PAGE_DOWN_INSTANT: physicalAssignment("KeyM", "M"),
    PAGE_BOTTOM: physicalAssignment("KeyN", "N"),
    // I is READER_MODE on left-handed; E is free.
    COPY_HOVERED_IMAGE: physicalAssignment("KeyE", "E"),
    // COLS_TOGGLE omitted — see BUILD_EXCLUDED_KEY_ACTIONS
    DELETE: physicalAssignment("Backspace", "Backspace"),
    // Mirror of right-handed Slash. KeyZ is free here (PAGE_TOP sits on Slash).
    TABS_OVERVIEW: physicalAssignment("KeyZ", "Z")
  });
  var SYSTEM_LAYER_ACTION_IDS = Object.freeze([
    "CANCEL",
    "TOGGLE_KEYBOARD_HELP",
    "OPEN_SETTINGS_POPOVER"
  ]);
  var SYSTEM_LAYER_ASSIGNMENTS_RIGHT = Object.freeze({
    CANCEL: physicalAssignment("Escape", "Esc"),
    TOGGLE_KEYBOARD_HELP: physicalAssignment("KeyK", "K"),
    OPEN_SETTINGS_POPOVER: physicalAssignment("Quote", "'")
  });
  var SYSTEM_LAYER_ASSIGNMENTS_LEFT = Object.freeze({
    CANCEL: physicalAssignment("Escape", "Esc"),
    TOGGLE_KEYBOARD_HELP: physicalAssignment("KeyD", "D"),
    OPEN_SETTINGS_POPOVER: physicalAssignment("Quote", "'")
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
      const copy = localizedActionCopy(actionId, def);
      out[actionId] = {
        keys: assign.keys.slice(),
        ...assign.bindingType ? { bindingType: assign.bindingType } : {},
        ...Array.isArray(assign.matchOn) ? { matchOn: assign.matchOn.slice() } : {},
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
        (row2) => Object.freeze(
          (Array.isArray(row2) ? row2 : []).map((cell) => {
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
      { type: "action", id: "READER_MODE", fallbackText: "Reader Mode" },
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
      { type: "action", id: "SCROLL_LINE", fallbackText: "Scroll Line" },
      { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
      { type: "action", id: "OPEN_MEDIA_LIBRARY", fallbackText: "Media Library" },
      { type: "action", id: STOCK_RANDOM_BOOKMARK_ACTION_ID, fallbackText: "Random Bookmark" },
      { type: "action", id: STOCK_SOCIAL_MEDIA_ACTION_ID, fallbackText: "Social media" },
      { type: "action", id: "TABS_OVERVIEW", fallbackText: "Tabs Overview" },
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
      { type: "action", id: "READER_MODE", fallbackText: "Reader Mode" },
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
      { type: "action", id: "TABS_OVERVIEW", fallbackText: "Tabs Overview" },
      // Z, mirror of /
      { type: "action", id: STOCK_SOCIAL_MEDIA_ACTION_ID, fallbackText: "Social media" },
      // X, mirror of .
      { type: "action", id: STOCK_RANDOM_BOOKMARK_ACTION_ID, fallbackText: "Random Bookmark" },
      // C, mirror of ,
      { type: "key", text: "V" },
      { type: "action", id: "ACTIVATE_NEW_TAB", fallbackText: "Click New Tab" },
      // B
      { type: "action", id: "PAGE_BOTTOM", fallbackText: "Scroll To Bottom" },
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
  var SELECTORS = {
    CLICKABLE: "a[href], button, input, select, textarea",
    // Prefer IDL-backed checks via isTypingContext() when possible. These selectors
    // are best-effort for matches()/querySelector (note: bare <input> has no type attr).
    TEXT_INPUTS: 'input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], textarea',
    FOCUSABLE_TEXT: 'input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'
  };
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
    /** Scroll Line: fixed frame around a nested (in-page) overflow target */
    SCROLL_LINE_TARGET: "kpv2-scroll-line-target",
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
    /** Brief dashed outline when a URL action has no navigable URL under the cursor */
    FOCUS_DASH_DENIED: "kpv2-focus-dash-denied",
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
    /** Overlay boxes for Select Image (and text fallback when CSS Highlight is unavailable) */
    UNIT_SELECT_OVERLAY: "kpv2-unit-select-overlay",
    /** Outline around the Font Info inspected text run */
    FONT_INFO_OUTLINE: "kpv2-font-info-outline",
    /** Persistent outline for elements added in cumulative inspector pick */
    INSPECTOR_PICKED: "kpv2-inspector-picked",
    INSPECTOR_PICKED_OVERLAY: "kpv2-inspector-picked-overlay",
    INSPECTOR_UNION_OVERLAY: "kpv2-inspector-union-overlay",
    TEXT_FIELD_GLOW: "kpv2-text-field-glow",
    /** Full-viewport veil used to hide instant Scroll-to-Top / Bottom jumps */
    EDGE_JUMP_FADE: "kpv2-edge-jump-fade",
    /** Corner glyph on the fade veil (Scroll To Top / Bottom) */
    EDGE_JUMP_FADE_ICON: "kpv2-edge-jump-fade-icon",
    VIEWPORT_MODAL_FRAME: "kpv2-viewport-modal-frame",
    ESC_EXIT_LABEL: "kpv2-esc-exit-label",
    /** Vertical “Esc / to / exit” sidecar left of the text-mode orange bar. */
    TEXT_FOCUS_ESC_HINT: "kpv2-text-focus-esc-hint",
    /** Vertical “F / to / select” sidecar left of a hovered text field. */
    TEXT_HOVER_ACTIVATE_HINT: "kpv2-text-hover-activate-hint",
    TEXT_FOCUS_INPUT: "kpv2-text-focus-input",
    TEXT_FOCUS_INPUT_PARENT: "kpv2-text-focus-input-parent",
    /** Modifier: focused text field uses left-edge 10px pulsating bar (default style). */
    TEXT_FOCUS_LEFT_EDGE: "kpv2-text-focus-left-edge",
    /** Input chrome is painted on a taller visual shell (Gmail/Google search pill). */
    TEXT_FOCUS_DELEGATED: "kpv2-text-focus-delegated",
    /** Focused field is too short for the SVG "press Esc to exit" hint. */
    TEXT_FOCUS_HINT_HIDDEN: "kpv2-text-focus-hint-hidden",
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
    /** Covers page content during fade edge-jumps; below chrome + cursor */
    EDGE_JUMP_FADE: 2147483010,
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
    // Sized OS popup for Open Popover (http(s)); extension Guide still uses iframe overlay
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
    // Custom select lists: above Keyboard Ref / layout chrome, below click ripple
    SELECT_MENU: 2147483049,
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
  var imeCompositionActive = false;
  function isImeComposingKeyboardEvent(e) {
    if (imeCompositionActive) return true;
    if (!e) return false;
    try {
      if (e.isComposing === true) return true;
      if (e.key === "Process") return true;
      return Number(e.keyCode) === 229 || Number(e.which) === 229;
    } catch {
      return false;
    }
  }
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
    const type2 = String(input.type || "text").toLowerCase();
    return TEXT_ENTRY_TYPE_SET.has(type2);
  }
  function hasModifierKeys(e) {
    if (!e) return false;
    return !!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey);
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
  function createKeyChromeTokens(overrides = {}) {
    return {
      shading: "bevel",
      border: "1px solid rgba(0, 0, 0, 0.4)",
      cornerMode: "radius",
      cutSize: "4px",
      ...overrides
    };
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
  async function storageGetValue(key2, defaultValue = void 0) {
    if (!key2 || typeof key2 !== "string") return defaultValue;
    let syncVal = void 0;
    let syncHas = false;
    try {
      if (chrome?.storage?.sync?.get) {
        const syncResult = await chrome.storage.sync.get([key2]);
        if (syncResult && Object.prototype.hasOwnProperty.call(syncResult, key2) && syncResult[key2] !== void 0) {
          syncHas = true;
          syncVal = /** @type {T} */
          syncResult[key2];
        }
      }
    } catch {
    }
    let localVal = void 0;
    let localHas = false;
    try {
      if (chrome?.storage?.local?.get) {
        const localResult = await chrome.storage.local.get([key2]);
        if (localResult && Object.prototype.hasOwnProperty.call(localResult, key2) && localResult[key2] !== void 0) {
          localHas = true;
          localVal = /** @type {T} */
          localResult[key2];
        }
      }
    } catch {
    }
    return (
      /** @type {T} */
      resolveStoredAreas(syncVal, syncHas, localVal, localHas, defaultValue)
    );
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

  // src/config/focus-color.js
  var FOCUS_COLOR_PRESET_IDS = Object.freeze([
    "blue",
    "green",
    "orange",
    "red",
    "purple"
  ]);
  var FOCUS_COLOR_PRESET_HEX = Object.freeze({
    blue: "#2196f3",
    green: "#00b400",
    orange: "#ff8c00",
    red: "#e53935",
    purple: "#9c27b0"
  });
  var DEFAULT_FOCUS_COLOR = "blue";
  function parseFocusColorHex(raw) {
    const s = String(raw || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
    }
    return null;
  }
  function normalizeFocusColor(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (FOCUS_COLOR_PRESET_IDS.includes(s)) return s;
    return parseFocusColorHex(s) || DEFAULT_FOCUS_COLOR;
  }
  function isFocusColorPreset(raw) {
    return FOCUS_COLOR_PRESET_IDS.includes(String(raw || "").trim().toLowerCase());
  }
  function rgbFromHex(hex) {
    const parsed = parseFocusColorHex(hex);
    if (!parsed) return null;
    return {
      r: parseInt(parsed.slice(1, 3), 16),
      g: parseInt(parsed.slice(3, 5), 16),
      b: parseInt(parsed.slice(5, 7), 16)
    };
  }
  function rgba(r, g, b, a) {
    return `rgba(${r},${g},${b},${a})`;
  }
  function paletteFromRgb(rgb) {
    const { r, g, b } = rgb;
    return {
      borderColor: rgba(r, g, b, 0.95),
      shadowColor: rgba(r, g, b, 0.35),
      shadowBrightColor: rgba(r, g, b, 0.45),
      backgroundColor: rgba(r, g, b, 0.25),
      hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
    };
  }
  function getFocusColorPalette(raw) {
    const id = normalizeFocusColor(raw);
    if (isFocusColorPreset(id)) {
      const rgb = rgbFromHex(FOCUS_COLOR_PRESET_HEX[id]);
      if (rgb) return paletteFromRgb(rgb);
    }
    const custom = rgbFromHex(id);
    if (custom) return paletteFromRgb(custom);
    return paletteFromRgb(rgbFromHex(FOCUS_COLOR_PRESET_HEX.blue));
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
    // Physical keycap model for Keyboard Reference. This remains independent
    // from Chrome UI language and OS input-source selection.
    keyboardHardwareLayoutId: DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID,
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
  function normalizeFocusColor2(raw) {
    return normalizeFocusColor(raw);
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
      focusColor: normalizeFocusColor2(stored.focusColor),
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
        themeId: normalizeThemeId(stored?.themeId),
        themeOverrides: normalizeThemeOverrides(stored?.themeOverrides),
        clickModeThemeId: typeof stored?.clickModeThemeId === "string" && stored.clickModeThemeId.trim() ? normalizeThemeId(stored.clickModeThemeId) : "",
        searchEngine: normalizeSearchEngine(stored?.searchEngine),
        cursorMode: normalizeCursorMode(stored?.cursorMode),
        keyboardLayoutFamilyId: familyId,
        keyboardHandedness: handedness,
        keyboardLayoutId: resolvedLayoutId,
        keyboardHardwareLayoutId: normalizeKeyboardHardwareLayoutId(stored?.keyboardHardwareLayoutId),
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

  // src/utils/element-from-point.js
  function deepElementFromPoint(x, y, doc = document) {
    let el = null;
    try {
      el = doc.elementFromPoint(x, y);
    } catch {
      return null;
    }
    let guard = 0;
    while (el && el.shadowRoot && guard++ < 10) {
      let nested = null;
      try {
        nested = el.shadowRoot.elementFromPoint(x, y);
      } catch {
        break;
      }
      if (!nested || nested === el) {
        nested = deepestShadowElementAtPoint(el.shadowRoot, x, y);
      }
      if (!nested || nested === el) break;
      el = nested;
    }
    return el || null;
  }
  function deepestShadowElementAtPoint(root, x, y) {
    if (!root || typeof root.querySelectorAll !== "function") return null;
    let nodes;
    try {
      nodes = root.querySelectorAll("*");
    } catch {
      return null;
    }
    let best = null;
    let bestArea = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || n.nodeType !== 1) continue;
      let r;
      try {
        r = n.getBoundingClientRect();
      } catch {
        continue;
      }
      if (!(r.width > 0) || !(r.height > 0)) continue;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const area = r.width * r.height;
      if (area < bestArea) {
        bestArea = area;
        best = n;
      }
    }
    return best;
  }

  // src/utils/scroll-at-point.js
  var EDGE_EPS = 1;
  function isInstantScrollBehavior(behavior) {
    return behavior === "auto" || behavior === "instant";
  }
  function collectScrollBehaviorNodes(el, doc) {
    const nodes = [];
    const add = (n) => {
      if (n && n.nodeType === 1 && !nodes.includes(n)) nodes.push(n);
    };
    add(el);
    try {
      add(doc?.scrollingElement);
      add(doc?.documentElement);
      add(doc?.body);
    } catch {
    }
    return nodes;
  }
  function forceCssScrollBehaviorAuto(nodes) {
    const saved = [];
    for (const node of nodes) {
      try {
        const style = node.style;
        if (!style) continue;
        saved.push({
          node,
          had: style.getPropertyValue("scroll-behavior") !== "",
          value: style.getPropertyValue("scroll-behavior")
        });
        style.setProperty("scroll-behavior", "auto", "important");
      } catch {
      }
    }
    return () => {
      for (const { node, had, value } of saved) {
        try {
          if (had) node.style.setProperty("scroll-behavior", value);
          else node.style.removeProperty("scroll-behavior");
        } catch {
        }
      }
    };
  }
  function tryHijackInstant(win, left, top) {
    if (!win) return;
    const inst = win.lenis;
    if (inst && typeof inst.scrollTo === "function") {
      try {
        inst.scrollTo(top, { immediate: true, force: true, lock: false });
      } catch {
        try {
          inst.scrollTo(top, { immediate: true });
        } catch {
        }
      }
    }
    const loco = win.locoScroll || win.locomotiveScroll;
    if (loco && typeof loco.scrollTo === "function") {
      try {
        loco.scrollTo(top, { duration: 0, disableLerp: true, immediate: true });
      } catch {
      }
    }
  }
  function applyInstantScrollTo(el, left, top, doc = document, win = window) {
    if (!el) return false;
    const L = Number(left) || 0;
    const T = Number(top) || 0;
    const restore = forceCssScrollBehaviorAuto(collectScrollBehaviorNodes(el, doc));
    try {
      try {
        void el.offsetHeight;
      } catch {
      }
      try {
        if (typeof el.scrollTo === "function") {
          try {
            el.scrollTo({ left: L, top: T, behavior: "instant" });
          } catch {
            el.scrollTo(L, T);
          }
        }
      } catch {
      }
      try {
        el.scrollLeft = L;
        el.scrollTop = T;
      } catch {
      }
      if (isDocumentScrollRoot(el, doc) && win && typeof win.scrollTo === "function") {
        try {
          try {
            win.scrollTo({ left: L, top: T, behavior: "instant" });
          } catch {
            win.scrollTo(L, T);
          }
        } catch {
        }
      }
      tryHijackInstant(win, L, T);
      return true;
    } finally {
      restore();
    }
  }
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
    if (isInstantScrollBehavior(behavior)) {
      const left = (Number(el.scrollLeft) || 0) + dx;
      const top = (Number(el.scrollTop) || 0) + dy;
      return applyInstantScrollTo(el, left, top, doc, win);
    }
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
    let start = deepElementFromPoint(x, y, doc);
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
  function isWideOverflowTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    let r = null;
    try {
      r = el.getBoundingClientRect();
    } catch {
      r = null;
    }
    if (!r || !(r.width > 1) || !(r.height > 1)) return false;
    return r.width > r.height + 1;
  }
  function isCarouselLikeOverflowTarget(el, cap) {
    if (!el || !cap || !cap.canX || cap.canY) return false;
    return isWideOverflowTarget(el);
  }
  function findScrollableAtPoint(clientX, clientY, ctx = {}) {
    const doc = ctx.doc || document;
    const skipWide = !!ctx.skipWideTargets;
    const x = Number(clientX);
    const y = Number(clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    let start = deepElementFromPoint(x, y, doc);
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
        if (skipWide && isCarouselLikeOverflowTarget(n, cap)) {
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
        const se = doc.scrollingElement || doc.documentElement || doc.body;
        if (se && isInstantScrollBehavior(behavior)) {
          const ok2 = applyInstantScrollTo(
            se,
            (Number(se.scrollLeft) || 0) + dx,
            (Number(se.scrollTop) || 0) + dy,
            doc,
            win
          );
          return { scrolled: ok2, el: se };
        }
        if (win && typeof win.scrollBy === "function") {
          win.scrollBy({ left: dx, top: dy, behavior });
          return { scrolled: true, el: se || null };
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
        const se = doc.scrollingElement || doc.documentElement || doc.body;
        if (se && isInstantScrollBehavior(behavior)) {
          const ok2 = applyInstantScrollTo(
            se,
            Number(se.scrollLeft) || 0,
            (Number(se.scrollTop) || 0) + s * amount,
            doc,
            win
          );
          return { scrolled: ok2, axis: "y", el: se };
        }
        if (win && typeof win.scrollBy === "function") {
          win.scrollBy({ top: s * amount, left: 0, behavior });
          return { scrolled: true, axis: "y", el: se || null };
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
    if (isInstantScrollBehavior(behavior)) {
      return applyInstantScrollTo(el, left, top, doc, win);
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
          const left = win.pageXOffset || 0;
          if (se && isInstantScrollBehavior(behavior)) {
            applyInstantScrollTo(se, left, top, doc, win);
          } else {
            win.scrollTo({ top, left, behavior });
          }
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

  // src/utils/scroll-hold.js
  function holdCfg() {
    const speed = Number(SCROLL.HOLD_PX_PER_SEC);
    const delay = Number(SCROLL.HOLD_RAF_START_MS);
    return {
      speedPxPerSec: Number.isFinite(speed) && speed > 0 ? speed : 1400,
      startDelayMs: Number.isFinite(delay) && delay >= 0 ? delay : 120
    };
  }
  var ScrollHoldController = class {
    /**
     * @param {{ apply: (ctx: ScrollHoldApplyContext) => void, speedPxPerSec?: number, startDelayMs?: number }} opts
     */
    constructor(opts) {
      this._apply = typeof opts?.apply === "function" ? opts.apply : () => {
      };
      this._speedOverride = Number(opts?.speedPxPerSec);
      this._delayOverride = Number(opts?.startDelayMs);
      this.key = null;
      this.sign = 0;
      this.target = null;
      this._raf = 0;
      this._lastTs = 0;
      this._armTimer = 0;
    }
    /** @returns {boolean} */
    get active() {
      return !!this.key;
    }
    /**
     * @param {string|null|undefined} key
     * @param {number} [sign]
     * @returns {boolean}
     */
    isHolding(key2, sign) {
      if (!this.key) return false;
      if (key2 != null && this.key !== key2) return false;
      if (sign != null && this.sign !== (sign < 0 ? -1 : 1)) return false;
      return true;
    }
    /**
     * Start (or redirect) a hold. Does not apply the tap step — caller does that.
     * Continuous rAF begins after a short delay so a quick tap stays a single step.
     *
     * @param {{ key?: string|null, sign: number, target?: any, speedPxPerSec?: number }} args
     */
    begin(args) {
      const sign = args.sign < 0 ? -1 : 1;
      const key2 = args.key == null ? null : String(args.key);
      const same = this.key != null && this.key === key2 && this.sign === sign;
      this.key = key2;
      this.sign = sign;
      this.target = args.target ?? this.target;
      if (Number.isFinite(Number(args.speedPxPerSec)) && Number(args.speedPxPerSec) > 0) {
        this._speedOverride = Number(args.speedPxPerSec);
      }
      if (same && (this._raf || this._armTimer)) return;
      this._clearArmTimer();
      if (this._raf) return;
      const cfg = holdCfg();
      const delay = Number.isFinite(this._delayOverride) && this._delayOverride >= 0 ? this._delayOverride : cfg.startDelayMs;
      if (delay <= 0) {
        this._startLoop();
        return;
      }
      this._armTimer = setTimeout(() => {
        this._armTimer = 0;
        if (!this.key) return;
        this._startLoop();
      }, delay);
    }
    /**
     * OS key-repeat: keep the hold alive; do not scroll here (rAF owns motion).
     * @param {string|null|undefined} key
     * @param {number} [sign]
     * @returns {boolean} true if this repeat belongs to the active hold
     */
    noteRepeat(key2, sign) {
      if (!this.isHolding(key2, sign)) return false;
      if (!this._raf && !this._armTimer) {
        this._startLoop();
      } else if (!this._raf && this._armTimer) {
        this._clearArmTimer();
        this._startLoop();
      }
      return true;
    }
    /**
     * @param {string|null|undefined} [key]  if set, only stop when it matches
     */
    end(key2) {
      if (key2 != null && this.key != null && this.key !== key2) return;
      this.reset();
    }
    reset() {
      this._clearArmTimer();
      if (this._raf) {
        try {
          cancelAnimationFrame(this._raf);
        } catch {
        }
        this._raf = 0;
      }
      this._lastTs = 0;
      this.key = null;
      this.sign = 0;
      this.target = null;
    }
    _clearArmTimer() {
      if (this._armTimer) {
        try {
          clearTimeout(this._armTimer);
        } catch {
        }
        this._armTimer = 0;
      }
    }
    _speed() {
      if (Number.isFinite(this._speedOverride) && this._speedOverride > 0) {
        return this._speedOverride;
      }
      return holdCfg().speedPxPerSec;
    }
    _startLoop() {
      if (this._raf) return;
      this._lastTs = 0;
      const tick = (ts) => {
        this._raf = 0;
        if (!this.key) return;
        const last = this._lastTs;
        this._lastTs = ts;
        this._raf = requestAnimationFrame(tick);
        if (!last) return;
        const dt = Math.min(0.05, Math.max(0, (ts - last) / 1e3));
        if (!dt) return;
        const deltaPx = this.sign * this._speed() * dt;
        if (!deltaPx) return;
        try {
          this._apply({
            deltaPx,
            sign: this.sign,
            dtSec: dt,
            target: this.target
          });
        } catch {
        }
      };
      this._raf = requestAnimationFrame(tick);
    }
  };

  // src/utils/resolve-hovered-link.js
  function composedParent2(node) {
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
  function pathOf(href) {
    const raw = String(href || "").trim();
    if (!raw) return "";
    try {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
        return new URL(raw, location.href).pathname || "";
      }
    } catch {
    }
    const cut = raw.split(/[?#]/)[0];
    return cut.startsWith("/") ? cut : `/${cut}`;
  }
  function permalinkScore(a) {
    const raw = (a.getAttribute("href") || "").trim();
    if (!raw || raw === "#" || raw.toLowerCase().startsWith("javascript:")) return 0;
    let abs = "";
    try {
      abs = String(
        /** @type {HTMLAnchorElement} */
        a.href || ""
      );
    } catch {
      abs = raw;
    }
    const path = pathOf(abs || raw).toLowerCase();
    if (!path || path === "/") return 0;
    if (/\/status\/\d+\/(analytics|photo|video|quotes?|likes?|retweets?|media)\b/.test(path) || /\/(analytics|photo|video)\/\d+/.test(path) || /\/i\/(web|flow|premium|bookmarks)\b/.test(path) || path.startsWith("/intent/")) {
      return 0;
    }
    let score = 0;
    try {
      if (typeof a.querySelector === "function" && a.querySelector("time")) score += 50;
    } catch {
    }
    try {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      if (rel.includes("bookmark")) score += 40;
    } catch {
    }
    if (/\/status\/\d+\/?$/.test(path)) score += 40;
    else if (/\/status\/\d+/.test(path)) score += 20;
    if (/\/(posts|post|notes|note|statuses|activity|objects|story|stories|entry|entries|comments)\//.test(path)) {
      score += 30;
    }
    try {
      if (typeof a.querySelector === "function" && a.querySelector("h1, h2, h3")) score += 25;
    } catch {
    }
    const segs = path.replace(/\/+$/, "").split("/").filter(Boolean);
    if (segs.length >= 3) score += 8;
    else if (segs.length === 2) score += 4;
    else if (segs.length === 1) score += 1;
    return score;
  }
  function resolveDescendantPermalink(host) {
    if (!host || host.nodeType !== 1) return null;
    const anchors = [];
    const seen = /* @__PURE__ */ new Set();
    const collect = (root, depth) => {
      if (!root || depth > 4) return;
      try {
        if (typeof root.querySelectorAll === "function") {
          const list = root.querySelectorAll("a[href]");
          for (let i = 0; i < list.length; i++) {
            const a = list[i];
            if (seen.has(a)) continue;
            seen.add(a);
            anchors.push(a);
          }
        }
      } catch {
      }
      try {
        const all = root.querySelectorAll ? root.querySelectorAll("*") : [];
        for (let i = 0; i < all.length; i++) {
          const sr = all[i].shadowRoot;
          if (sr) collect(sr, depth + 1);
        }
      } catch {
      }
    };
    collect(host, 0);
    try {
      if (host.shadowRoot) collect(host.shadowRoot, 1);
    } catch {
    }
    let best = null;
    let bestScore = 0;
    for (const a of anchors) {
      const score = permalinkScore(a);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    if (!best || bestScore < 10) return null;
    let url = "";
    try {
      url = String(
        /** @type {HTMLAnchorElement} */
        best.href || ""
      ).trim();
    } catch {
      url = "";
    }
    if (!url) return null;
    return { url, link: best };
  }
  function findPermalinkCardHost(el) {
    let n = el;
    let depth = 0;
    while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement && depth++ < 16) {
      const role = (n.getAttribute && n.getAttribute("role") || "").trim().toLowerCase();
      if (n.tagName === "ARTICLE" || role === "article") return n;
      n = n.parentElement || composedParent2(n);
    }
    return el;
  }
  function resolveHoveredLink(el) {
    if (!el || el.nodeType !== 1) return null;
    let probe = (
      /** @type {Element} */
      el
    );
    let guard = 0;
    while (probe && probe.nodeType === 1 && guard++ < 12) {
      try {
        if (probe.tagName === "A") {
          const href = String(
            /** @type {HTMLAnchorElement} */
            probe.href || ""
          ).trim();
          if (href && !href.toLowerCase().startsWith("javascript:")) {
            return { url: href, link: probe };
          }
        }
      } catch {
      }
      try {
        const a = typeof probe.closest === "function" ? probe.closest("a[href]") : null;
        if (a && a.tagName === "A") {
          const href = String(
            /** @type {HTMLAnchorElement} */
            a.href || ""
          ).trim();
          if (href && !href.toLowerCase().startsWith("javascript:")) {
            return { url: href, link: a };
          }
        }
      } catch {
      }
      try {
        let roleLink = probe;
        if (roleLink.getAttribute?.("role") !== "link") {
          roleLink = roleLink.closest?.('[role="link"]') || null;
        }
        if (roleLink && roleLink.getAttribute("role") === "link" && roleLink.dataset?.kpUrl) {
          const url = String(roleLink.dataset.kpUrl || "").trim();
          if (url) return { url, link: roleLink };
        }
      } catch {
      }
      const root = typeof probe.getRootNode === "function" ? probe.getRootNode() : null;
      if (!(typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) || !(root.host instanceof Element)) {
        break;
      }
      probe = root.host;
    }
    const unique = uniqueDescendantNavigableLink(el);
    if (unique) return unique;
    const card = findPermalinkCardHost(
      /** @type {Element} */
      el
    );
    return resolveDescendantPermalink(card);
  }
  function uniqueDescendantNavigableLink(host) {
    if (!host || host.nodeType !== 1) return null;
    let found = null;
    let foundDest = "";
    try {
      const list = host.querySelectorAll("a[href]");
      if (!list || !list.length || list.length > 32) return null;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        let href = "";
        try {
          href = String(
            /** @type {HTMLAnchorElement} */
            a.href || ""
          ).trim();
        } catch {
          href = "";
        }
        if (!href || href.toLowerCase().startsWith("javascript:")) continue;
        const dest = activationDestKey(href);
        if (!dest) continue;
        if (!found) {
          found = a;
          foundDest = dest;
        } else if (dest !== foundDest) {
          return null;
        }
      }
    } catch {
      return null;
    }
    if (!found || !foundDest) return null;
    let url = "";
    try {
      url = String(
        /** @type {HTMLAnchorElement} */
        found.href || ""
      ).trim();
    } catch {
      url = "";
    }
    if (!url) return null;
    return { url, link: found };
  }
  function normalizeActivationDest(href) {
    const raw = String(href || "").trim();
    if (!raw || raw === "#" || raw.toLowerCase().startsWith("javascript:")) return "";
    try {
      const u = new URL(raw, typeof location !== "undefined" ? location.href : void 0);
      const path = (u.pathname || "/").replace(/\/+$/, "") || "/";
      return `${u.origin}${path}`.toLowerCase();
    } catch {
      return raw.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase();
    }
  }
  function activationDestKey(href) {
    const dest = normalizeActivationDest(href);
    if (!dest) return "";
    try {
      const u = new URL(String(href || "").trim(), typeof location !== "undefined" ? location.href : void 0);
      const search = String(u.search || "").toLowerCase();
      const hash = String(u.hash || "").toLowerCase();
      return dest + search + hash;
    } catch {
      return dest;
    }
  }
  var JS_NAV_DEST_ATTRS = Object.freeze([
    "data-href",
    "data-url",
    "data-link",
    "data-nav",
    "data-destination",
    "data-kp-url"
  ]);

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
      shading: "flat",
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

  // themes/index.js
  var PACKAGES = Object.freeze({
    "dark-pro": DARK_PRO_THEME,
    "gray-metal-pro": GRAY_METAL_PRO_THEME,
    "gx-er": GX_ER_THEME
  });
  function getTheme(id, overrides) {
    const key2 = normalizeThemeId(id);
    const base = PACKAGES[key2] || PACKAGES[DEFAULT_THEME_ID];
    return mergeTheme(base, overrides && typeof overrides === "object" ? overrides : {});
  }

  // src/modules/theme-manager.js
  var _activeTheme = getTheme(DEFAULT_THEME_ID);
  var CHROME_THEME_HOST_SEL = [
    ".kp-chrome-window",
    "[data-kp-ui-shadow]",
    "[data-kp-select]",
    ".kp-select-menu-host",
    ".kp-select-menu",
    ".kpv2-settings-host",
    ".kpv2-docs-host"
  ].join(", ");

  // src/ui/locale-fonts.js
  function quoteFamily(name) {
    return `"${name}"`;
  }
  function uiStack(families) {
    return ["system-ui", "-apple-system", ...families.map(quoteFamily), "sans-serif"].join(", ");
  }
  var KP_CJK_UI_STACK_SC = uiStack([
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "Noto Sans SC",
    "Noto Sans CJK SC"
  ]);
  var KP_CJK_UI_STACK_TC = uiStack([
    "PingFang TC",
    "Hiragino Sans CNS",
    "Microsoft JhengHei",
    "Noto Sans TC",
    "Noto Sans CJK TC"
  ]);
  var KP_CJK_UI_STACK_HK = uiStack([
    "PingFang HK",
    "PingFang TC",
    "Hiragino Sans CNS",
    "Microsoft JhengHei",
    "Noto Sans HK",
    "Noto Sans CJK HK",
    "Noto Sans TC",
    "Noto Sans CJK TC"
  ]);
  var KP_CJK_UI_STACK_JP = uiStack([
    "Hiragino Sans",
    "Yu Gothic UI",
    "Yu Gothic",
    "Meiryo",
    "Noto Sans JP",
    "Noto Sans CJK JP"
  ]);
  function isZhHk(tag) {
    return tag === "zh-hk" || tag.startsWith("zh-hk-") || tag === "zh-mo" || tag.startsWith("zh-mo-") || tag === "zh-hant-hk" || tag.startsWith("zh-hant-hk-") || tag === "zh-hant-mo" || tag.startsWith("zh-hant-mo-");
  }
  function isZhTw(tag) {
    if (isZhHk(tag)) return false;
    return tag === "zh-tw" || tag.startsWith("zh-tw-") || tag === "zh-hant" || tag.startsWith("zh-hant-");
  }
  function isZhHans(tag) {
    return tag === "zh" || tag === "zh-cn" || tag.startsWith("zh-cn-") || tag === "zh-sg" || tag.startsWith("zh-sg-") || tag === "zh-hans" || tag.startsWith("zh-hans-");
  }
  function isJapanese(tag) {
    return tag === "ja" || tag.startsWith("ja-");
  }
  var CJK_FONT_RULES = [
    {
      id: "jp",
      stack: () => KP_CJK_UI_STACK_JP,
      match: isJapanese,
      shadow: [
        ":host(:lang(ja))"
      ],
      page: [
        "html:lang(ja) body"
      ]
    },
    {
      id: "hk",
      stack: () => KP_CJK_UI_STACK_HK,
      match: isZhHk,
      shadow: [
        ":host(:lang(zh-HK))",
        ":host(:lang(zh-MO))",
        ":host(:lang(zh-Hant-HK))",
        ":host(:lang(zh-Hant-MO))"
      ],
      page: [
        "html:lang(zh-HK) body",
        "html:lang(zh-MO) body",
        "html:lang(zh-Hant-HK) body",
        "html:lang(zh-Hant-MO) body"
      ]
    },
    {
      id: "tc",
      stack: () => KP_CJK_UI_STACK_TC,
      match: isZhTw,
      shadow: [
        ":host(:lang(zh-TW))",
        ":host(:lang(zh-Hant):not(:lang(zh-Hant-HK)):not(:lang(zh-Hant-MO)))"
      ],
      page: [
        "html:lang(zh-TW) body",
        "html:lang(zh-Hant):not(:lang(zh-Hant-HK)):not(:lang(zh-Hant-MO)) body"
      ]
    },
    {
      id: "sc",
      stack: () => KP_CJK_UI_STACK_SC,
      match: isZhHans,
      shadow: [
        ":host(:lang(zh-CN))",
        ":host(:lang(zh-SG))",
        ":host(:lang(zh-Hans))",
        ':host([lang="zh" i])'
      ],
      page: [
        "html:lang(zh-CN) body",
        "html:lang(zh-SG) body",
        "html:lang(zh-Hans) body",
        'html[lang="zh" i] body'
      ]
    }
  ];
  function fontFamilyRule(selectors, stack) {
    return `${selectors.join(",\n")} {
  font-family: ${stack};
}`;
  }
  var KP_CJK_SHADOW_CSS = CJK_FONT_RULES.map((rule) => fontFamilyRule(rule.shadow, rule.stack())).join("\n");

  // src/ui/kp-chrome-shadow.js
  function containsComposed(host, node) {
    if (!host || !node) return false;
    if (host === node) return true;
    try {
      if (host.contains(node)) return true;
    } catch {
    }
    let current = node;
    let depth = 0;
    while (current && depth++ < 32) {
      if (current === host) return true;
      const parent = current.parentElement;
      if (parent) {
        current = parent;
        continue;
      }
      const root = current.getRootNode?.();
      current = root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot ? root.host : null;
    }
    return false;
  }

  // src/utils/synthetic-pointer.js
  function buildMouseEventInit(target, clientX, clientY, buttons = 1) {
    const x = Number.isFinite(clientX) ? clientX : 0;
    const y = Number.isFinite(clientY) ? clientY : 0;
    let offsetX = 0;
    let offsetY = 0;
    try {
      const r = target && typeof /** @type {any} */
      target.getBoundingClientRect === "function" ? (
        /** @type {any} */
        target.getBoundingClientRect()
      ) : null;
      if (r) {
        offsetX = x - r.left;
        offsetY = y - r.top;
      }
    } catch {
    }
    let pageX = x;
    let pageY = y;
    try {
      pageX = x + (window.scrollX || window.pageXOffset || 0);
      pageY = y + (window.scrollY || window.pageYOffset || 0);
    } catch {
    }
    return {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: typeof window !== "undefined" ? window : void 0,
      clientX: x,
      clientY: y,
      pageX,
      pageY,
      offsetX,
      offsetY,
      screenX: x,
      screenY: y,
      button: 0,
      buttons,
      detail: 1
    };
  }
  function dispatchClickSequence(target, clientX, clientY) {
    if (!target || typeof /** @type {any} */
    target.dispatchEvent !== "function") return;
    const common = buildMouseEventInit(target, clientX, clientY, 1);
    const hasPointer = typeof window !== "undefined" && typeof window.PointerEvent === "function";
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
    const commonUp = buildMouseEventInit(target, clientX, clientY, 0);
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

  // src/utils/media-scrubber.js
  function clamp01(n) {
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }
  function mediaTimeFromClientX(clientX, rect, duration) {
    if (!rect || !(rect.width > 0)) return null;
    if (!Number.isFinite(clientX)) return null;
    if (!Number.isFinite(duration) || duration <= 0 || duration === Infinity) return null;
    return clamp01((clientX - rect.left) / rect.width) * duration;
  }
  function sliderAxis(el) {
    try {
      const ori = (el?.getAttribute?.("aria-orientation") || "").trim().toLowerCase();
      if (ori === "vertical") return "y";
      if (ori === "horizontal") return "x";
    } catch {
    }
    try {
      const r = el && typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
      if (r && r.height >= r.width * 1.4 && r.height >= 32) return "y";
    } catch {
    }
    return "x";
  }
  function volumeFromClientPoint(clientX, clientY, rect, axis = "x") {
    if (!rect) return null;
    if (axis === "y") {
      if (!(rect.height > 0) || !Number.isFinite(clientY)) return null;
      return clamp01(1 - (clientY - rect.top) / rect.height);
    }
    if (!(rect.width > 0) || !Number.isFinite(clientX)) return null;
    return clamp01((clientX - rect.left) / rect.width);
  }
  function isVolumeOrNonSeekSlider(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("aria-valuetext") || ""}`.toLowerCase();
      if (/\b(volume|mute|sound|loudness|gain)\b/.test(label)) return true;
      try {
        if (el.hasAttribute("data-media-volume-slider")) return true;
      } catch {
      }
      const cls = String(
        /** @type {any} */
        el.className || ""
      ).toLowerCase();
      if (/\b(volume|mute)[-_]?slider\b|\bvolume-?control\b|\bvds-volume\b/.test(cls)) return true;
      if (typeof el.closest === "function") {
        const host = el.closest(
          '[aria-label*="volume" i], [aria-label*="mute" i], [data-media-volume-slider], .vds-volume-slider, .ytp-volume-panel, .ytp-volume-slider'
        );
        if (host) return true;
      }
      if (sliderAxis(el) === "y") return true;
    } catch {
    }
    return false;
  }
  function isNativeRange(el) {
    try {
      if (!el || el.tagName !== "INPUT") return false;
      return String(el.getAttribute("type") || "").toLowerCase() === "range";
    } catch {
      return false;
    }
  }
  function isNonScrubControl(el) {
    try {
      if (el.tagName === "A" || el.tagName === "BUTTON" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
        return !el.closest?.('[role="slider"], input[type="range"]');
      }
      if (el.tagName === "INPUT") {
        const t = String(el.getAttribute("type") || "text").toLowerCase();
        if (t !== "range") return true;
      }
      const btn = typeof el.closest === "function" ? el.closest('button, [role="button"], a[href], select, textarea') : null;
      if (!btn) return false;
      return !btn.closest?.('[role="slider"], input[type="range"]');
    } catch {
      return false;
    }
  }
  function isShortTrackHost(el) {
    try {
      const r = el.getBoundingClientRect();
      if (!r || r.width < 64 || r.height <= 0 || r.height > 48) return false;
      if (r.width / Math.max(r.height, 1) < 4) return false;
      const slider = el.querySelector?.('[role="slider"], input[type="range"]');
      const btn = el.querySelector?.('button, [role="button"], a[href]');
      if (slider && btn) {
        const btnInSlider = typeof slider.contains === "function" && slider.contains(btn);
        if (!btnInSlider) return false;
      } else if (btn && !slider) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  function resolveScrubberControl(el) {
    if (!el || el.nodeType !== 1) return null;
    if (isNonScrubControl(el)) return null;
    try {
      if (isNativeRange(el) || (el.getAttribute("role") || "").trim().toLowerCase() === "slider") {
        if (isVolumeOrNonSeekSlider(el)) return null;
        return el;
      }
    } catch {
    }
    try {
      if (typeof el.closest === "function") {
        const viaClosest = el.closest('input[type="range"], [role="slider"]');
        if (viaClosest && !isVolumeOrNonSeekSlider(viaClosest)) return viaClosest;
      }
    } catch {
    }
    let n = el;
    let depth = 0;
    while (n && n.nodeType === 1 && depth < 4) {
      try {
        if (isShortTrackHost(n) && typeof n.querySelector === "function") {
          const inner = n.querySelector(':scope > [role="slider"], :scope > input[type="range"], [role="slider"], input[type="range"]');
          if (inner && !isVolumeOrNonSeekSlider(inner)) return inner;
        }
      } catch {
      }
      n = n.parentElement;
      depth++;
    }
    return null;
  }
  function isTallVolumeHost(el) {
    try {
      const r = el.getBoundingClientRect();
      if (!r || r.height < 40 || r.width <= 0) return false;
      if (r.height < r.width * 1.4) return false;
      if (r.width > 80) return false;
      return true;
    } catch {
      return false;
    }
  }
  function resolveVolumeControl(el) {
    if (!el || el.nodeType !== 1) return null;
    if (isNonScrubControl(el)) return null;
    try {
      if (isNativeRange(el) && isVolumeOrNonSeekSlider(el)) return el;
      const role = (el.getAttribute("role") || "").trim().toLowerCase();
      if (role === "slider" && isVolumeOrNonSeekSlider(el)) return el;
    } catch {
    }
    try {
      if (typeof el.closest === "function") {
        const viaClosest = el.closest('input[type="range"], [role="slider"]');
        if (viaClosest && isVolumeOrNonSeekSlider(viaClosest)) return viaClosest;
      }
    } catch {
    }
    let n = el;
    let depth = 0;
    while (n && n.nodeType === 1 && depth < 4) {
      try {
        if (isTallVolumeHost(n) && typeof n.querySelector === "function") {
          const inner = n.querySelector(
            ':scope > [role="slider"], :scope > input[type="range"], [role="slider"], input[type="range"]'
          );
          if (inner && isVolumeOrNonSeekSlider(inner)) return inner;
        }
      } catch {
      }
      n = n.parentElement;
      depth++;
    }
    return null;
  }
  function findAssociatedMedia(fromEl) {
    if (!fromEl || fromEl.nodeType !== 1) return null;
    try {
      let n = fromEl;
      let depth = 0;
      while (n && n.nodeType === 1 && depth < 10) {
        if (n === document.body || n === document.documentElement) break;
        if (n.tagName === "VIDEO" || n.tagName === "AUDIO") {
          return (
            /** @type {HTMLMediaElement} */
            n
          );
        }
        try {
          const main = n.querySelector?.("video.html5-main-video") || n.querySelector?.("video.video-stream") || n.querySelector?.("video, audio");
          if (main && (main.tagName === "VIDEO" || main.tagName === "AUDIO")) {
            return (
              /** @type {HTMLMediaElement} */
              main
            );
          }
        } catch {
        }
        n = n.parentElement;
        depth++;
      }
    } catch {
    }
    try {
      const all = document.querySelectorAll("video.html5-main-video, video.video-stream, video, audio");
      for (let i = 0; i < all.length; i++) {
        const m = all[i];
        if (Number.isFinite(m.duration) && m.duration > 1 && m.duration !== Infinity) {
          return (
            /** @type {HTMLMediaElement} */
            m
          );
        }
      }
      if (all.length) return (
        /** @type {HTMLMediaElement} */
        all[0]
      );
    } catch {
    }
    return null;
  }
  function applyMediaSeek(trackEl, clientX) {
    if (!trackEl || isVolumeOrNonSeekSlider(trackEl)) return null;
    const media = findAssociatedMedia(trackEl);
    if (!media) return null;
    let rect = null;
    try {
      rect = trackEl.getBoundingClientRect();
    } catch {
      rect = null;
    }
    if (!rect || rect.width < 48) return null;
    const next = mediaTimeFromClientX(clientX, rect, media.duration);
    if (next == null) return null;
    try {
      media.currentTime = next;
    } catch {
    }
    return next;
  }
  function tryActivateScrubber(el, clientX, clientY) {
    if (!el || el.nodeType !== 1) return false;
    if (!Number.isFinite(clientX)) return false;
    const control = resolveScrubberControl(el);
    if (!control || isVolumeOrNonSeekSlider(control)) return false;
    const y = Number.isFinite(clientY) ? clientY : (() => {
      try {
        const r = control.getBoundingClientRect();
        return r.top + r.height / 2;
      } catch {
        return 0;
      }
    })();
    try {
      dispatchClickSequence(el, clientX, y);
    } catch {
    }
    const seconds = applyMediaSeek(control, clientX);
    return seconds == null ? true : seconds;
  }
  function applyMediaVolume(trackEl, clientX, clientY) {
    if (!trackEl || !isVolumeOrNonSeekSlider(trackEl)) return null;
    let rect = null;
    try {
      rect = trackEl.getBoundingClientRect();
    } catch {
      rect = null;
    }
    if (!rect) return null;
    const axis = sliderAxis(trackEl);
    if (axis === "y" && !(rect.height >= 24)) return null;
    if (axis === "x" && !(rect.width >= 24)) return null;
    const next = volumeFromClientPoint(clientX, clientY, rect, axis);
    if (next == null) return null;
    const media = findAssociatedMedia(trackEl);
    try {
      if (media) {
        media.volume = next;
        media.muted = next <= 1e-3;
      }
    } catch {
    }
    return next;
  }
  function tryActivateVolumeSlider(el, clientX, clientY) {
    if (!el || el.nodeType !== 1) return false;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
    const control = resolveVolumeControl(el);
    if (!control) return false;
    try {
      dispatchClickSequence(el, clientX, clientY);
    } catch {
    }
    const volume = applyMediaVolume(control, clientX, clientY);
    return volume == null ? true : volume;
  }

  // src/modules/frame-click-agent.js
  var CLICKABLE_SEL = 'a[href], button, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="slider"], summary, [onclick], input, select, textarea, label';
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
          if (document.documentElement?.classList?.contains(CSS_CLASSES.CURSOR_HIDDEN)) {
            return null;
          }
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
  function closestLink(el) {
    try {
      const found = resolveHoveredLink(el);
      if (found?.link && found.link.tagName === "A") {
        return (
          /** @type {HTMLAnchorElement} */
          found.link
        );
      }
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
      if (/\b(mute|unmute|volume|captions?|subtitle|closed caption|\bcc\b|settings|fullscreen|theatre|theater|miniplayer|picture[- ]in[- ]picture|\bpip\b)\b/.test(label)) {
        continue;
      }
      if (/\b(play|pause|replay)\b/.test(label)) return true;
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
      const type2 = opts.background ? MSG.OPEN_URL_BACKGROUND : MSG.OPEN_URL_FOREGROUND;
      chrome.runtime.sendMessage({ type: type2, url }).catch(() => {
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
      let scrollHoldLock = null;
      const scrollHold = new ScrollHoldController({
        apply: ({ deltaPx, target }) => {
          const t = target || scrollHoldLock;
          if (!t?.el) return;
          const axis = t.axis === "x" ? "x" : "y";
          scrollElementBy(t.el, axis === "x" ? deltaPx : 0, axis === "y" ? deltaPx : 0, "auto");
        }
      });
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
      let lastTypingPosted = null;
      const postTypingToParent = (typing) => {
        if (!enabled) return;
        if (hasFullKeyPilot()) return;
        const next = !!typing;
        if (!next && lastTypingPosted === false) return;
        lastTypingPosted = next;
        try {
          window.parent.postMessage({
            type: next ? MSG.FRAME_TYPING_FOCUS : MSG.FRAME_TYPING_BLUR
          }, "*");
        } catch {
        }
      };
      const syncTypingFocusToParent = () => {
        if (!enabled || hasFullKeyPilot()) return;
        try {
          postTypingToParent(isTypingContext(document.activeElement));
        } catch {
          postTypingToParent(false);
        }
      };
      const onFocusIn = (e) => {
        try {
          if (!enabled || hasFullKeyPilot()) return;
          if (isTypingContext(e?.target) || isTypingContext(document.activeElement)) {
            postTypingToParent(true);
          }
        } catch {
        }
      };
      const onFocusOut = () => {
        try {
          if (!enabled || hasFullKeyPilot()) return;
          setTimeout(syncTypingFocusToParent, 0);
        } catch {
        }
      };
      const bubbleChildTyping = (event, data) => {
        if (!data || data.type !== MSG.FRAME_TYPING_FOCUS && data.type !== MSG.FRAME_TYPING_BLUR) {
          return false;
        }
        try {
          if (event.source === window) return false;
        } catch {
        }
        if (!enabled || hasFullKeyPilot()) return true;
        try {
          window.parent.postMessage({ type: data.type }, "*");
        } catch {
        }
        return true;
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
      const paletteFor = (color4) => {
        const p = getFocusColorPalette(color4);
        return {
          border: p.borderColor,
          shadow: p.shadowColor,
          shadowBright: p.shadowBrightColor,
          fill: p.backgroundColor
        };
      };
      const applyFocusChromeToHoverEl = (target = hoverTarget) => {
        if (!hoverEl) return;
        let isText = false;
        try {
          isText = !!(target && target.matches && target.matches(SELECTORS.FOCUSABLE_TEXT));
        } catch {
          isText = false;
        }
        const p = isText ? {
          border: COLORS.ORANGE,
          shadow: COLORS.ORANGE_SHADOW,
          shadowBright: COLORS.ORANGE_SHADOW,
          fill: "transparent"
        } : paletteFor(focusChrome.focusColor);
        const thickness = Math.min(Math.max(Number(focusChrome.rectangleThickness) || 3, 1), 16);
        try {
          hoverEl.style.border = `${thickness}px solid ${p.border}`;
          hoverEl.style.background = isText || focusChrome.overlayFillEnabled === false ? "transparent" : p.fill;
          hoverEl.style.boxShadow = focusChrome.overlayShadowEnabled === false ? "none" : `0 0 0 1px ${p.shadow}, 0 0 8px ${p.shadowBright}`;
        } catch {
        }
      };
      const bindingMatchesEvent = (assignment, event) => {
        try {
          const keys = assignment?.keys;
          if (!Array.isArray(keys) || !event) return false;
          if (assignment.bindingType === "physical") {
            return keys.includes(String(event.code || ""));
          }
          if (assignment.bindingType === "character") {
            return keys.includes(String(event.key || ""));
          }
          return false;
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
            focusColor: normalizeFocusColor(cm.focusColor),
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
        const beh = xyMode || behavior === "auto" || behavior === "instant" ? "instant" : behavior || scrollBehavior;
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
          lastTypingPosted = null;
          try {
            window.parent.postMessage({ type: MSG.FRAME_TYPING_BLUR }, "*");
          } catch {
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
          hoverEl = null;
          return null;
        }
      };
      const flashDeniedDashOutline = (target, clientX, clientY) => {
        try {
          let left;
          let top;
          let width;
          let height;
          const el = target && target.nodeType === 1 && target !== document.body && target !== document.documentElement ? target : null;
          if (el) {
            const r = el.getBoundingClientRect();
            if (r && r.width >= 2 && r.height >= 2) {
              left = r.left;
              top = r.top;
              width = r.width;
              height = r.height;
            }
          }
          if (width == null) {
            const size = 36;
            left = clientX - size / 2;
            top = clientY - size / 2;
            width = size;
            height = size;
          }
          const pulse = document.createElement("div");
          pulse.setAttribute("aria-hidden", "true");
          pulse.style.cssText = [
            "position:fixed",
            `left:${left}px`,
            `top:${top}px`,
            `width:${width}px`,
            `height:${height}px`,
            "box-sizing:border-box",
            "pointer-events:none",
            `z-index:${typeof Z_INDEX?.OVERLAYS_ABOVE === "number" ? Z_INDEX.OVERLAYS_ABOVE : 2147483021}`,
            `border:3px dashed ${COLORS.FLASH_DENIED || "rgba(255,140,0,1)"}`,
            "background:transparent",
            `box-shadow:0 0 0 1px ${COLORS.FLASH_DENIED_SHADOW || "rgba(255,140,0,0.85)"},0 0 10px 1px ${COLORS.FLASH_DENIED_GLOW || "rgba(255,140,0,0.7)"}`
          ].join(";");
          (document.body || document.documentElement)?.appendChild(pulse);
          const anim = pulse.animate(
            [{ opacity: 1 }, { opacity: 0.12 }, { opacity: 1 }, { opacity: 0 }],
            { duration: 480, easing: "ease-out" }
          );
          const cleanup = () => {
            try {
              pulse.remove();
            } catch {
            }
          };
          if (anim && typeof anim.addEventListener === "function") {
            anim.addEventListener("finish", cleanup);
          } else {
            setTimeout(cleanup, 500);
          }
        } catch {
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
        applyFocusChromeToHoverEl(target);
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
        if (!openInNewTab && !background) {
          const scrub = tryActivateScrubber(el, clientX, clientY);
          if (scrub !== false) {
            if (typeof scrub === "number" && Number.isFinite(scrub)) {
              try {
                chrome.runtime?.sendMessage?.({ type: MSG.FRAME_MEDIA_SEEK, seconds: scrub });
              } catch {
              }
            }
            return true;
          }
        }
        if (!openInNewTab && !background) {
          const vol = tryActivateVolumeSlider(el, clientX, clientY);
          if (vol !== false) {
            if (typeof vol === "number" && Number.isFinite(vol)) {
              try {
                chrome.runtime?.sendMessage?.({ type: MSG.FRAME_MEDIA_VOLUME, volume: vol });
              } catch {
              }
            }
            return true;
          }
        }
        if (!openInNewTab && !background) {
          try {
            if (activator && (activator.tagName === "BUTTON" || (activator.getAttribute?.("role") || "").toLowerCase() === "button") && typeof /** @type {any} */
            activator.click === "function") {
              activator.click();
              return true;
            }
          } catch {
          }
        }
        if (mediaEl && !openInNewTab && !background && (directMedia || playOverlay)) {
          toggleMediaPlayback(mediaEl);
          return true;
        }
        if (openInNewTab || background) {
          let url = "";
          let openLink = link;
          try {
            const resolved = resolveHoveredLink(el) || resolveHoveredLink(activator);
            if (resolved?.url) {
              url = resolved.url;
              openLink = resolved.link || link;
            }
          } catch {
          }
          if (!url && link) {
            url = resolveHttpHref(link) || link.href || "";
          }
          if (!url) {
            flashDeniedDashOutline(activator || el, clientX, clientY);
            return true;
          }
          if (openUrlViaRuntime(url, { background })) return true;
          try {
            if (background) {
              window.open(url, "_blank", "noopener,noreferrer");
            } else if (openLink && openLink.tagName === "A") {
              const originalTarget = openLink.target;
              openLink.target = "_blank";
              try {
                openLink.click();
              } catch {
                window.open(url, "_blank", "noopener,noreferrer");
              }
              if (originalTarget !== void 0 && originalTarget !== null && originalTarget !== "") {
                openLink.target = originalTarget;
              } else {
                openLink.removeAttribute("target");
              }
            } else {
              window.open(url, "_blank", "noopener,noreferrer");
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
          const sameControl = !!(activator && el && (containsComposed(activator, el) || containsComposed(el, activator)));
          if (activator && activator !== el && !sameControl) {
            dispatchClickSequence(activator, clientX, clientY);
          }
        } catch {
        }
        return true;
      };
      const acceptFramePayload = (event, data, type2) => {
        if (!data || data.type !== type2) return false;
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
          if (bubbleChildTyping(event, data)) return;
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
            const beh = data.behavior === "auto" || data.behavior === "instant" ? "instant" : data.behavior || scrollBehavior;
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
          if (isImeComposingKeyboardEvent(e)) return;
          if (!enabled) return;
          if (hasFullKeyPilot()) return;
          if (hasModifierKeys(e)) return;
          const key2 = e.key;
          const kb = keybindings || {};
          if ((bindingMatchesEvent(kb.CANCEL, e) || key2 === "Escape" || key2 === "Esc") && isTypingContext(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            try {
              document.activeElement?.blur?.();
            } catch {
            }
            postTypingToParent(false);
            return;
          }
          if (isTypingContext(e.target)) return;
          if (!frameHasKeyboardFocus()) return;
          if (bindingMatchesEvent(kb.CANCEL, e) || key2 === "Escape" || key2 === "Esc") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            requestFocusReclaim();
            return;
          }
          let mode = null;
          let scrollSign = null;
          let scrollMode = "delta";
          if (bindingMatchesEvent(kb.ACTIVATE, e)) mode = "activate";
          else if (bindingMatchesEvent(kb.ACTIVATE_NEW_TAB, e)) mode = "newTab";
          else if (bindingMatchesEvent(kb.ACTIVATE_NEW_TAB_BACKGROUND, e)) mode = "background";
          else if (bindingMatchesEvent(kb.PAGE_UP_INSTANT, e)) scrollSign = -1;
          else if (bindingMatchesEvent(kb.PAGE_DOWN_INSTANT, e)) scrollSign = 1;
          else if (bindingMatchesEvent(kb.PAGE_TOP, e)) {
            scrollSign = -1;
            scrollMode = "edge";
          } else if (bindingMatchesEvent(kb.PAGE_BOTTOM, e)) {
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
            if (scrollMode === "edge") {
              scrollAt(x, y, scrollSign, halfPagePx, scrollBehavior, scrollMode);
              return;
            }
            const s = scrollSign < 0 ? -1 : 1;
            if (e.repeat) {
              scrollHold.noteRepeat(key2, s);
              return;
            }
            const found = findScrollTargetAtPoint(x, y, s);
            const el = found?.el || document.scrollingElement || document.documentElement || document.body;
            const axis = found?.axis || "y";
            scrollAt(x, y, s, halfPagePx, scrollBehavior, "delta");
            scrollHoldLock = el ? { el, axis } : null;
            const speed = Math.max(600, Math.min(2400, halfPagePx * 2.8));
            scrollHold.begin({
              key: key2,
              sign: s,
              target: scrollHoldLock,
              speedPxPerSec: speed
            });
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
      const onKeyUp = (e) => {
        try {
          scrollHold.end(e?.key);
          if (!scrollHold.active) scrollHoldLock = null;
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
      document.addEventListener("keyup", onKeyUp, true);
      document.addEventListener("focusin", onFocusIn, true);
      document.addEventListener("focusout", onFocusOut, true);
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
      try {
        syncTypingFocusToParent();
      } catch {
      }
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
            document.removeEventListener("keyup", onKeyUp, true);
            document.removeEventListener("focusin", onFocusIn, true);
            document.removeEventListener("focusout", onFocusOut, true);
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

  // src/modules/popover-bridge-init.js
  var SCROLL_KEY_SLOTS = Object.freeze([
    "pageUp",
    "pageDown",
    "pageUpInstant",
    "pageDownInstant",
    "pageTop",
    "pageBottom"
  ]);
  var BINDING_ID_BY_SLOT = Object.freeze({
    pageUp: "PAGE_UP",
    pageDown: "PAGE_DOWN",
    pageUpInstant: "PAGE_UP_INSTANT",
    pageDownInstant: "PAGE_DOWN_INSTANT",
    pageTop: "PAGE_TOP",
    pageBottom: "PAGE_BOTTOM"
  });
  var SLOT_BY_FUNCTION_ID = Object.freeze({
    PAGE_UP: "pageUp",
    PAGE_DOWN: "pageDown",
    PAGE_UP_INSTANT: "pageUpInstant",
    PAGE_DOWN_INSTANT: "pageDownInstant",
    PAGE_TOP: "pageTop",
    PAGE_BOTTOM: "pageBottom"
  });
  var DEFAULT_POPOVER_SCROLL_KEYS = Object.freeze({
    pageUp: Object.freeze([]),
    pageDown: Object.freeze([]),
    pageUpInstant: Object.freeze(["c", "C"]),
    pageDownInstant: Object.freeze(["v", "V"]),
    pageTop: Object.freeze(["z", "Z"]),
    pageBottom: Object.freeze(["x", "X"])
  });
  function uniqueKeys(keys) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const raw of keys) {
      const k = String(raw || "");
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }
  function normalizePopoverScrollKeys(raw) {
    if (!raw || typeof raw !== "object") return null;
    const out = {};
    let any = false;
    for (const slot of SCROLL_KEY_SLOTS) {
      if (Array.isArray(raw[slot])) {
        out[slot] = uniqueKeys(raw[slot].map(String));
        any = true;
      } else {
        out[slot] = [];
      }
    }
    return any ? (
      /** @type {PopoverScrollKeys} */
      out
    ) : null;
  }
  function popoverScrollKeyMatches(scrollKeys, slot, key2) {
    const list = scrollKeys?.[slot];
    return Array.isArray(list) && list.includes(key2);
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
      let lastPointerPostedX = NaN;
      let lastPointerPostedY = NaN;
      let pointerSyncRaf = 0;
      let closeKeySet = /* @__PURE__ */ new Set(["Escape", "e", "E", "p", "P"]);
      let scrollKeys = DEFAULT_POPOVER_SCROLL_KEYS;
      let scrollHoldLock = null;
      const scrollHold = new ScrollHoldController({
        apply: ({ deltaPx, target }) => {
          const t = target || scrollHoldLock;
          if (!t?.el) return;
          const axis = t.axis === "x" ? "x" : "y";
          scrollElementBy(t.el, axis === "x" ? deltaPx : 0, axis === "y" ? deltaPx : 0, "auto");
        }
      });
      const fullKeyPilotPresent = () => {
        try {
          return !!(window.keyPilot || window.__KeyPilotInstance || window.__KeyPilotToggleHandler);
        } catch {
          return false;
        }
      };
      const scrollByY = (deltaY, behavior = "smooth") => {
        try {
          const el = document.scrollingElement || document.documentElement || document.body;
          if (el && isInstantScrollBehavior(behavior)) {
            applyInstantScrollTo(
              el,
              Number(el.scrollLeft) || 0,
              (Number(el.scrollTop) || 0) + (Number(deltaY) || 0)
            );
            return;
          }
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
          const el = document.scrollingElement || document.documentElement || document.body;
          if (el && isInstantScrollBehavior(behavior)) {
            applyInstantScrollTo(el, Number(el.scrollLeft) || window.pageXOffset || 0, Number(top) || 0);
            return;
          }
          window.scrollTo({ top, behavior });
        } catch {
        }
      };
      const deepElementFromPoint2 = (x, y) => deepElementFromPoint(x, y);
      const updateMouse = (e) => {
        try {
          if (!e) return;
          if (typeof e.clientX === "number") lastMouse.x = e.clientX;
          if (typeof e.clientY === "number") lastMouse.y = e.clientY;
        } catch {
        }
      };
      const setInside = (v) => {
        const next = !!v;
        if (mouseInsideFrame && !next) postPointerToParent(false);
        mouseInsideFrame = next;
      };
      const postPointerToParent = (inside, clientX, clientY) => {
        if (fullKeyPilotPresent()) return;
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
            if (!mouseInsideFrame || fullKeyPilotPresent()) return;
            const x = lastMouse.x;
            const y = lastMouse.y;
            if (typeof x !== "number" || typeof y !== "number") return;
            postPointerToParent(true, x, y);
          } catch {
          }
        });
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
            const nextScroll = normalizePopoverScrollKeys(data.scrollKeys);
            if (nextScroll) scrollKeys = nextScroll;
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
          const behavior = data.behavior === "auto" || data.behavior === "instant" ? "instant" : "smooth";
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
        if (isImeComposingKeyboardEvent(e)) return;
        if (!bridgeActive) return;
        if (hasModifierKeys(e)) return;
        const key2 = e.key;
        const typing = typingAt(e.target);
        const requestClose = () => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          try {
            window.parent.postMessage({ type: MSG.POPOVER_REQUEST_CLOSE, key: key2 }, "*");
          } catch {
          }
        };
        if (!typing && (key2 === "f" || key2 === "F")) {
          const forwardToParent = !mouseInsideFrame || !fullKeyPilotPresent();
          if (forwardToParent) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            try {
              window.parent.postMessage({ type: MSG.POPOVER_BRIDGE_KEYDOWN, key: key2 }, "*");
            } catch {
            }
            return;
          }
        }
        if (!typing && closeKeySet.has(key2)) return requestClose();
        if (!typing && key2 === "Escape") return requestClose();
        if (closeOnQuote && !typing && key2 === "'") return requestClose();
        if (enableFClickBeforeKeyPilot && !keyPilotStarted && !typing && (key2 === "f" || key2 === "F")) {
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
        if (fullKeyPilotPresent()) return;
        const { pagePx, halfPx, behavior } = resolveScrollParams();
        const cursorPoint = () => {
          let mx = lastMouse.x;
          let my = lastMouse.y;
          if (typeof mx !== "number" || typeof my !== "number") {
            mx = Math.floor(window.innerWidth / 2);
            my = Math.floor(window.innerHeight / 2);
          }
          return { mx, my };
        };
        const applyHeldScroll = (sign, stepPx) => {
          const s = sign < 0 ? -1 : 1;
          if (e.repeat) {
            scrollHold.noteRepeat(key2, s);
            return;
          }
          const { mx, my } = cursorPoint();
          const found = findScrollTargetAtPoint(mx, my, s);
          const el = found?.el || document.scrollingElement || document.documentElement || document.body;
          const axis = found?.axis || "y";
          scrollAtPoint(mx, my, s, stepPx, behavior);
          scrollHoldLock = el ? { el, axis } : null;
          const base = Number(SCROLL.HOLD_PX_PER_SEC);
          const speed = Math.max(600, Math.min(2400, stepPx * 2.8));
          scrollHold.begin({
            key: key2,
            sign: s,
            target: scrollHoldLock,
            speedPxPerSec: Number.isFinite(speed) ? speed : base || 1400
          });
        };
        if (popoverScrollKeyMatches(scrollKeys, "pageUp", key2)) {
          e.preventDefault();
          applyHeldScroll(-1, pagePx);
        } else if (popoverScrollKeyMatches(scrollKeys, "pageDown", key2)) {
          e.preventDefault();
          applyHeldScroll(1, pagePx);
        } else if (popoverScrollKeyMatches(scrollKeys, "pageUpInstant", key2)) {
          e.preventDefault();
          applyHeldScroll(-1, halfPx);
        } else if (popoverScrollKeyMatches(scrollKeys, "pageDownInstant", key2)) {
          e.preventDefault();
          applyHeldScroll(1, halfPx);
        } else if (popoverScrollKeyMatches(scrollKeys, "pageTop", key2)) {
          e.preventDefault();
          const { mx, my } = cursorPoint();
          scrollToEdgeAtPoint(mx, my, -1, behavior);
        } else if (popoverScrollKeyMatches(scrollKeys, "pageBottom", key2)) {
          e.preventDefault();
          const { mx, my } = cursorPoint();
          scrollToEdgeAtPoint(mx, my, 1, behavior);
        }
      };
      const onMouseMove = (e) => {
        updateMouse(e);
        schedulePointerSync();
      };
      const onKeyUp = (e) => {
        try {
          scrollHold.end(e?.key);
          if (!scrollHold.active) scrollHoldLock = null;
        } catch {
        }
      };
      document.addEventListener("mousemove", onMouseMove, true);
      document.addEventListener("pointermove", onMouseMove, true);
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
      document.addEventListener("keyup", onKeyUp, true);
      return {
        dispose() {
          try {
            window.removeEventListener("message", onMessage, true);
            document.removeEventListener("keydown", onKeyDown, true);
            document.removeEventListener("keyup", onKeyUp, true);
            document.removeEventListener("mousemove", onMouseMove, true);
            document.removeEventListener("pointermove", onMouseMove, true);
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

  // src/utils/debug.js
  var SOURCE_BUILD_ENABLE_DEBUG_SETTINGS = true;
  var BUILD_ENABLE_DEBUG_SETTINGS = typeof __KP_BUILD_ENABLE_DEBUG_SETTINGS__ !== "undefined" ? !!__KP_BUILD_ENABLE_DEBUG_SETTINGS__ : SOURCE_BUILD_ENABLE_DEBUG_SETTINGS;
  var consoleWrapped = false;
  var storageListenerInstalled = false;
  function isKeyPilotDebugEnabled() {
    try {
      return !!globalThis.KEYPILOT_DEBUG;
    } catch {
      return false;
    }
  }
  function applyDebugSetting(enabled) {
    try {
      globalThis.KEYPILOT_DEBUG = !!enabled;
    } catch {
    }
  }
  function installKeyPilotDebugConsole() {
    if (consoleWrapped) return;
    consoleWrapped = true;
    applyDebugSetting(!!globalThis.KEYPILOT_DEBUG);
    const origLog = console.log.bind(console);
    const origDebug = console.debug.bind(console);
    const origInfo = console.info.bind(console);
    console.log = (...args) => {
      if (isKeyPilotDebugEnabled()) origLog(...args);
    };
    console.debug = (...args) => {
      if (isKeyPilotDebugEnabled()) origDebug(...args);
    };
    console.info = (...args) => {
      if (isKeyPilotDebugEnabled()) origInfo(...args);
    };
  }
  function applyFromStoredSettings(raw) {
    applyDebugSetting(!!(raw && typeof raw === "object" && raw.debugLogging));
  }
  async function startKeyPilotDebugFromSettings() {
    installKeyPilotDebugConsole();
    try {
      const settings = await getSettings();
      applyDebugSetting(!!settings?.debugLogging);
    } catch {
      applyDebugSetting(false);
    }
    if (storageListenerInstalled) return;
    storageListenerInstalled = true;
    try {
      if (!chrome?.storage?.onChanged?.addListener) return;
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" && area !== "local") return;
        const ch = changes?.[SETTINGS_STORAGE_KEY];
        if (!ch) return;
        applyFromStoredSettings(ch.newValue);
      });
    } catch {
    }
  }

  // src/frame-agent-entry.js
  void startKeyPilotDebugFromSettings();
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
