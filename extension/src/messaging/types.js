/**
 * KeyPilot runtime message types (single source of truth).
 *
 * Routing notes:
 * - Content script ↔ service worker: chrome.runtime.sendMessage / onMessage
 * - Extension page → tab UI: prefer SW forward, or chrome.tabs.sendMessage
 * - Parent ↔ popover iframe: window.postMessage (KP_POPOVER_* family)
 */

/** @typedef {typeof MSG[keyof typeof MSG]} MessageType */

export const MSG = Object.freeze({
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
  /** Same-tab navigate (chrome.tabs.update). Used when sandboxed iframes cannot top-navigate without a real user gesture. */
  NAVIGATE_SAME_TAB: 'KP_NAVIGATE_SAME_TAB',

  // --- UI open (content-script handlers; SW may forward) ---
  OPEN_SETTINGS_POPOVER: 'KP_OPEN_SETTINGS_POPOVER',
  OPEN_GUIDE_POPOVER: 'KP_OPEN_GUIDE_POPOVER',
  /** Open Docs popover; optional topicId / hash deep-link. */
  OPEN_DOCS_POPOVER: 'KP_OPEN_DOCS_POPOVER',
  OPEN_ONBOARDING: 'KP_OPEN_ONBOARDING',
  /** Reset walkthrough progress and open it (e.g. Guide "Launch Walkthrough"). */
  LAUNCH_WALKTHROUGH: 'KP_LAUNCH_WALKTHROUGH',

  // --- History / bookmarks / favicon (SW APIs for content scripts) ---
  OMNIBOX_SUGGEST: 'KP_OMNIBOX_SUGGEST',
  GET_BOOKMARKS: 'KP_GET_BOOKMARKS',
  GET_RECENT_BOOKMARKS: 'KP_GET_RECENT_BOOKMARKS',
  BROWSER_HISTORY_GET: 'KP_BROWSER_HISTORY_GET',
  GET_TOP_SITES: 'KP_GET_TOP_SITES',
  GET_MOST_VISITED: 'KP_GET_MOST_VISITED',
  GET_HISTORY_FOR_DOMAINS: 'KP_GET_HISTORY_FOR_DOMAINS',
  GET_RECENT_HISTORY: 'KP_GET_RECENT_HISTORY',
  GET_FAVICON: 'KP_GET_FAVICON',

  // --- Page preview screenshots for card backgrounds ---
  GET_PAGE_THUMB: 'KP_GET_PAGE_THUMB',
  PAGE_THUMB_RESPONSE: 'KP_PAGE_THUMB_RESPONSE',
  PAGE_THUMB_UPDATED: 'KP_PAGE_THUMB_UPDATED',
  GET_VIDEO_THUMB: 'KP_GET_VIDEO_THUMB',
  VIDEO_THUMB_RESPONSE: 'KP_VIDEO_THUMB_RESPONSE',

  // --- Media Library (IndexedDB at extension origin; SW owns Blobs) ---
  MEDIA_LIBRARY_ADD: 'KP_MEDIA_LIBRARY_ADD',
  MEDIA_LIBRARY_LIST: 'KP_MEDIA_LIBRARY_LIST',
  MEDIA_LIBRARY_GET: 'KP_MEDIA_LIBRARY_GET',
  MEDIA_LIBRARY_DELETE: 'KP_MEDIA_LIBRARY_DELETE',
  MEDIA_LIBRARY_ZIP: 'KP_MEDIA_LIBRARY_ZIP',
  /** SW → tabs: library contents changed (add/delete). Overlay reloads if open. */
  MEDIA_LIBRARY_CHANGED: 'KP_MEDIA_LIBRARY_CHANGED',

  // --- Dictionary lookup (Free Dictionary API via SW; LOOKUP_WORD) ---
  DICTIONARY_LOOKUP: 'KP_DICTIONARY_LOOKUP',

  // --- Per-tab navigation graph ---
  NAVGRAPH_GET: 'KP_NAVGRAPH_GET',
  NAVGRAPH_JUMP: 'KP_NAVGRAPH_JUMP',
  NAVGRAPH_CLEAR: 'KP_NAVGRAPH_CLEAR',

  // --- Generic ---
  SUCCESS: 'KP_SUCCESS',
  ERROR: 'KP_ERROR',

  // --- Separate-window Link Preview / Open Popover (chrome.windows popup) ---
  OPEN_POPOVER_WINDOW: 'KP_OPEN_POPOVER_WINDOW',
  CLOSE_POPOVER_WINDOW: 'KP_CLOSE_POPOVER_WINDOW',
  /** SW → opener: popover window closed (OS ✕ or in-window close). */
  POPOVER_WINDOW_CLOSED: 'KP_POPOVER_WINDOW_CLOSED',
  /** Popup tab → SW: am I a KeyPilot popover window? */
  AM_I_POPOVER_WINDOW: 'KP_AM_I_POPOVER_WINDOW',

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
  // Optional topOrigin: parent tab origin for link routing (no hardcoded domains).
  FRAME_ACTIVATE: 'KP_FRAME_ACTIVATE',

  // --- Parent → child frame scroll (window.postMessage; layout scroll keys under an iframe) ---
  // Top-frame KeyPilot posts this when scroll keys land on an <iframe> shell. Child
  // frame-click-agent runs scroll-at-point (delta or edge) at local coordinates
  // (nested overflow first, then the frame document).
  FRAME_SCROLL: 'KP_FRAME_SCROLL',

  // --- Child → parent pointer sync (window.postMessage) ---
  // Frame agent reports local client coords so top KeyPilot can keep lastMouse fresh
  // while the pointer is over a cross-origin (or any) iframe — parent documents do
  // not receive mousemove inside iframes. Nested agents re-bubble with translated coords.
  // Payload: { type, inside: boolean, clientX?: number, clientY?: number }
  FRAME_POINTER: 'KP_FRAME_POINTER',

  // --- Child → parent: return keyboard focus to the top frame ---
  // Sent on Esc / pointer leave when the iframe had document focus (manual click).
  // Top blurs the focused <iframe> so KeyPilot keybinds work on the parent again.
  FRAME_FOCUS_RECLAIM: 'KP_FRAME_FOCUS_RECLAIM',

  // --- Child → parent: typing focus inside a page iframe ---
  // Frame agent posts these on focusin/focusout of a text field in its document
  // (Gutenberg editor-canvas, etc.). Top FocusDetector peeks the same-origin
  // activeElement and enters/exits text_focus. No element is sent.
  // Payload: { type }
  FRAME_TYPING_FOCUS: 'KP_FRAME_TYPING_FOCUS',
  FRAME_TYPING_BLUR: 'KP_FRAME_TYPING_BLUR',

  // --- Parent → child: blur the typing field (Esc from top-frame text mode) ---
  FRAME_BLUR_TYPING: 'KP_FRAME_BLUR_TYPING',

  // --- Child frame-agent → SW: inject full content-bundled.js into this frame ---
  // Used when a KeyPilot popover iframe needs full KeyPilot (cursor/overlays).
  // Thin frame-agent-bundled.js does not include the full app.
  INJECT_FULL_KEYPILOT_IN_FRAME: 'KP_INJECT_FULL_KEYPILOT_IN_FRAME',

  // --- Content → SW: inject MAIN-world map.panBy bridge into the sender frame ---
  // Scroll Line uses this so isolated content can pan Leaflet/Mapbox/Google via
  // page globals. Idempotent; bridge listens for CustomEvent __kp_map_pan_v1.
  ENSURE_MAP_PAN_BRIDGE: 'KP_ENSURE_MAP_PAN_BRIDGE'
});

/**
 * Message types that open tab-local UI and must be forwarded by the SW
 * when sent via chrome.runtime.sendMessage from extension pages.
 */
export const TAB_UI_FORWARD_TYPES = Object.freeze([
  MSG.OPEN_SETTINGS_POPOVER,
  MSG.OPEN_GUIDE_POPOVER,
  MSG.OPEN_DOCS_POPOVER,
  MSG.OPEN_ONBOARDING,
  MSG.LAUNCH_WALKTHROUGH
]);
