/**
 * Lightweight runtime checks for KeyPilot message envelopes.
 * Full payload schemas live in refs/MESSAGING_CONTRACT.md.
 */

import { MSG, TAB_UI_FORWARD_TYPES } from './types.js';

/** @type {ReadonlySet<string>} */
export const KNOWN_MESSAGE_TYPES = Object.freeze(new Set(Object.values(MSG)));

/**
 * Messages the service worker accepts on chrome.runtime.onMessage.
 * Frame/postMessage-only types are excluded.
 */
export const SW_RUNTIME_REQUEST_TYPES = Object.freeze([
  MSG.TRANSIENT_ACTION,
  MSG.GET_RECENT_BOOKMARKS,
  MSG.GET_MOST_VISITED,
  MSG.GET_BOOKMARKS,
  MSG.OMNIBOX_SUGGEST,
  MSG.BROWSER_HISTORY_GET,
  MSG.GET_TOP_SITES,
  MSG.GET_HISTORY_FOR_DOMAINS,
  MSG.GET_RECENT_HISTORY,
  MSG.GET_VIDEO_THUMB,
  MSG.DICTIONARY_LOOKUP,
  MSG.MEDIA_LIBRARY_ADD,
  MSG.MEDIA_LIBRARY_LIST,
  MSG.MEDIA_LIBRARY_GET,
  MSG.MEDIA_LIBRARY_DELETE,
  MSG.MEDIA_LIBRARY_ZIP,
  MSG.NAVGRAPH_GET,
  MSG.NAVGRAPH_JUMP,
  MSG.NAVGRAPH_CLEAR,
  MSG.OPEN_SETTINGS_POPOVER,
  MSG.OPEN_GUIDE_POPOVER,
  MSG.OPEN_DOCS_POPOVER,
  MSG.OPEN_ONBOARDING,
  MSG.LAUNCH_WALKTHROUGH,
  MSG.OPEN_POPOVER_WINDOW,
  MSG.CLOSE_POPOVER_WINDOW,
  MSG.AM_I_POPOVER_WINDOW,
  MSG.INJECT_FULL_KEYPILOT_IN_FRAME,
  MSG.ENSURE_MAP_PAN_BRIDGE,
  MSG.GET_STATE,
  MSG.SET_STATE,
  MSG.TOGGLE_STATE,
  MSG.CLOSE_TAB,
  MSG.GO_BACK,
  MSG.GO_FORWARD,
  MSG.TAB_LEFT,
  MSG.TAB_RIGHT,
  MSG.NEW_TAB,
  MSG.OPEN_URL_BACKGROUND,
  MSG.OPEN_URL_FOREGROUND,
  MSG.NAVIGATE_SAME_TAB,
  MSG.STATUS
]);

/** @type {ReadonlySet<string>} */
const SW_REQUEST_SET = new Set(SW_RUNTIME_REQUEST_TYPES);

/**
 * @param {unknown} type
 * @returns {type is import('./types.js').MessageType}
 */
export function isKnownMessageType(type) {
  return typeof type === 'string' && KNOWN_MESSAGE_TYPES.has(type);
}

/**
 * @param {unknown} type
 * @returns {boolean}
 */
export function isServiceWorkerRequestType(type) {
  return typeof type === 'string' && SW_REQUEST_SET.has(type);
}

/**
 * @param {unknown} type
 * @returns {boolean}
 */
export function isTabUiForwardType(type) {
  return typeof type === 'string' && TAB_UI_FORWARD_TYPES.includes(/** @type {any} */ (type));
}

/**
 * Validate a chrome.runtime message envelope at a context boundary.
 * Returns null when valid; otherwise a short error string.
 *
 * @param {any} message
 * @param {{ requireSwRequest?: boolean }} [opts]
 * @returns {string|null}
 */
export function validateRuntimeMessage(message, opts = {}) {
  if (message == null || typeof message !== 'object' || Array.isArray(message)) {
    return 'Message must be a non-null object';
  }
  if (typeof message.type !== 'string' || !message.type) {
    return 'Message.type must be a non-empty string';
  }
  if (!isKnownMessageType(message.type)) {
    return `Unknown message type: ${message.type}`;
  }
  if (opts.requireSwRequest && !isServiceWorkerRequestType(message.type)) {
    return `Type not accepted by service worker: ${message.type}`;
  }

  // High-value payload checks (keep light; full shapes in MESSAGING_CONTRACT.md).
  switch (message.type) {
    case MSG.TRANSIENT_ACTION:
      if (typeof message.action !== 'string' || !message.action.trim()) {
        return 'TRANSIENT_ACTION requires action: string';
      }
      break;
    case MSG.SET_STATE:
      if (typeof message.enabled !== 'boolean') {
        return 'SET_STATE requires enabled: boolean';
      }
      break;
    case MSG.OPEN_URL_BACKGROUND:
    case MSG.OPEN_URL_FOREGROUND:
    case MSG.NAVIGATE_SAME_TAB:
    case MSG.NAVGRAPH_JUMP:
      if (typeof message.url !== 'string' || !message.url.trim()) {
        return `${message.type} requires url: string`;
      }
      break;
    case MSG.OPEN_POPOVER_WINDOW:
      if (typeof message.url !== 'string' || !message.url.trim()) {
        return 'OPEN_POPOVER_WINDOW requires url: string';
      }
      break;
    case MSG.DICTIONARY_LOOKUP:
      if (typeof message.word !== 'string' || !message.word.trim()) {
        return 'DICTIONARY_LOOKUP requires word: string';
      }
      break;
    default:
      break;
  }

  return null;
}

/**
 * Build a standard error response envelope.
 * @param {string} error
 * @returns {{ type: typeof MSG.ERROR, error: string }}
 */
export function errorResponse(error) {
  return { type: MSG.ERROR, error: String(error || 'Unknown error') };
}
