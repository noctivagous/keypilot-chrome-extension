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

  // --- UI open (content-script handlers; SW may forward) ---
  OPEN_SETTINGS_POPOVER: 'KP_OPEN_SETTINGS_POPOVER',
  OPEN_GUIDE_POPOVER: 'KP_OPEN_GUIDE_POPOVER',
  OPEN_ONBOARDING: 'KP_OPEN_ONBOARDING',

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

  // --- Parent → child frame activate (window.postMessage; third-party iframes) ---
  // Top-frame KeyPilot posts this when F/B/G lands on a cross-origin <iframe>.
  // Child frame-click-agent performs elementFromPoint + click in its own document.
  FRAME_ACTIVATE: 'KP_FRAME_ACTIVATE',

  // --- Parent → child frame scroll (window.postMessage; C/V under an iframe) ---
  // Top-frame KeyPilot posts this when C/V lands on an <iframe> shell. Child
  // frame-click-agent runs scroll-at-point at local coordinates (nested overflow
  // first, then the frame document).
  FRAME_SCROLL: 'KP_FRAME_SCROLL'
});

/**
 * Message types that open tab-local UI and must be forwarded by the SW
 * when sent via chrome.runtime.sendMessage from extension pages.
 */
export const TAB_UI_FORWARD_TYPES = Object.freeze([
  MSG.OPEN_SETTINGS_POPOVER,
  MSG.OPEN_GUIDE_POPOVER,
  MSG.OPEN_ONBOARDING
]);
