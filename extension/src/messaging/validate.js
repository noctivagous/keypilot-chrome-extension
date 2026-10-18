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
  MSG.KEYBOARD_REFERENCE_CONTEXT_ACTION,
  MSG.GET_RECENT_BOOKMARKS,
  MSG.GET_MOST_VISITED,
  MSG.GET_BOOKMARKS,
  MSG.OMNIBOX_SUGGEST,
  MSG.BROWSER_HISTORY_GET,
  MSG.GET_TOP_SITES,
  MSG.GET_HISTORY_FOR_DOMAINS,
  MSG.GET_RECENT_HISTORY,
  MSG.GET_VIDEO_THUMB,
  MSG.WIKTIONARY_LOOKUP,
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
  MSG.FRAME_MEDIA_SEEK,
  MSG.FRAME_MEDIA_VOLUME,
  MSG.GET_STATE,
  MSG.SET_STATE,
  MSG.TOGGLE_STATE,
  MSG.CLOSE_TAB,
  MSG.CLOSE_WINDOW,
  MSG.GO_BACK,
  MSG.GO_FORWARD,
  MSG.TAB_LEFT,
  MSG.TAB_RIGHT,
  MSG.TABS_OVERVIEW_GET,
  MSG.FOCUS_WINDOW,
  MSG.ACTIVATE_TAB,
  MSG.NEW_TAB,
  MSG.OPEN_URL_BACKGROUND,
  MSG.OPEN_URL_FOREGROUND,
  MSG.OPEN_URLS,
  MSG.LIST_BOOKMARK_FOLDERS,
  MSG.OPEN_BOOKMARK_FOLDER,
  MSG.OPEN_RANDOM_BOOKMARK,
  MSG.SCHEDULE_DEFERRED_OPEN,
  MSG.NAVIGATE_SAME_TAB,
  MSG.ZOOM_STEP,
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
 * @param {any} control
 * @returns {string|null}
 */
function deferredClickControlError(control) {
  if (!control || typeof control !== 'object') {
    return 'SCHEDULE_DEFERRED_OPEN CLICK_CONTROL requires a control';
  }
  if (control.tag !== 'button' && control.tag !== 'input') {
    return 'SCHEDULE_DEFERRED_OPEN CLICK_CONTROL requires a button or input';
  }
  if (typeof control.type !== 'string' || control.type.length > 20) {
    return 'SCHEDULE_DEFERRED_OPEN CLICK_CONTROL requires a type';
  }
  for (const key of ['name', 'value', 'id', 'text', 'selector']) {
    if (control[key] != null && (typeof control[key] !== 'string' || control[key].length > 500)) {
      return 'SCHEDULE_DEFERRED_OPEN CLICK_CONTROL has an invalid field';
    }
  }
  if (control.controlIndex != null
    && (!Number.isInteger(control.controlIndex) || control.controlIndex < -1 || control.controlIndex > 5000)) {
    return 'SCHEDULE_DEFERRED_OPEN CLICK_CONTROL has an invalid index';
  }
  if (control.formIndex != null
    && (!Number.isInteger(control.formIndex) || control.formIndex < 0 || control.formIndex > 500)) {
    return 'SCHEDULE_DEFERRED_OPEN CLICK_CONTROL has an invalid form';
  }
  return null;
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
    case MSG.KEYBOARD_REFERENCE_CONTEXT_ACTION:
      if (typeof message.value !== 'string' || !message.value.trim()) {
        return 'KEYBOARD_REFERENCE_CONTEXT_ACTION requires value: string';
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
    case MSG.OPEN_URLS:
      if (!Array.isArray(message.urls)
        || message.urls.length < 1
        || message.urls.length > 20
        || message.urls.some((url) => typeof url !== 'string' || !url.trim())) {
        return 'OPEN_URLS requires urls: non-empty string array (max 20)';
      }
      break;
    case MSG.LIST_BOOKMARK_FOLDERS:
      break;
    case MSG.OPEN_BOOKMARK_FOLDER:
      if (typeof message.folderId !== 'string' || !message.folderId.trim() || message.folderId.length > 64) {
        return 'OPEN_BOOKMARK_FOLDER requires folderId: non-empty string';
      }
      break;
    case MSG.OPEN_RANDOM_BOOKMARK: {
      if (message.folderId != null && (typeof message.folderId !== 'string' || message.folderId.length > 64)) {
        return 'OPEN_RANDOM_BOOKMARK requires folderId: string';
      }
      const count = Number(message.count);
      if (!Number.isInteger(count) || count < 1 || count > 30) {
        return 'OPEN_RANDOM_BOOKMARK requires count: integer 1-30';
      }
      break;
    }
    case MSG.SCHEDULE_DEFERRED_OPEN: {
      if (message.action !== 'OPEN_URLS' && message.action !== 'RANDOM_BOOKMARK'
        && message.action !== 'CLOSE_TAB' && message.action !== 'CLOSE_WINDOW'
        && message.action !== 'CLICK_CONTROL') {
        return 'SCHEDULE_DEFERRED_OPEN requires a supported action';
      }
      // Exactly one schedule form: an exact future `fireAt` (Ctrl+Alt+Shift dialog)
      // or a random delay range (Alt+Shift).
      if (message.fireAt !== undefined) {
        if (message.minMinutes !== undefined || message.maxMinutes !== undefined) {
          return 'SCHEDULE_DEFERRED_OPEN accepts either fireAt or a delay range';
        }
        if (!Number.isFinite(message.fireAt) || message.fireAt <= Date.now()) {
          return 'SCHEDULE_DEFERRED_OPEN requires fireAt: a future timestamp';
        }
      } else {
        const minMinutes = Number(message.minMinutes);
        const maxMinutes = Number(message.maxMinutes);
        if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)
          || minMinutes < 1 || maxMinutes > 2880 || minMinutes > maxMinutes) {
          return 'SCHEDULE_DEFERRED_OPEN requires a delay range from 1 to 2880 minutes';
        }
      }
      if (message.target !== 'activeWindow' && message.target !== 'originalWindow') {
        return 'SCHEDULE_DEFERRED_OPEN requires a valid target';
      }
      if (message.action === 'OPEN_URLS') {
        if (!Array.isArray(message.payload?.urls)
          || message.payload.urls.length < 1
          || message.payload.urls.length > 20
          || message.payload.urls.some((url) => typeof url !== 'string' || !url.trim())) {
          return 'SCHEDULE_DEFERRED_OPEN OPEN_URLS requires urls';
        }
      } else if (message.action === 'RANDOM_BOOKMARK') {
        const count = Number(message.payload?.count);
        if (!Number.isInteger(count) || count < 1 || count > 30) {
          return 'SCHEDULE_DEFERRED_OPEN RANDOM_BOOKMARK requires count 1-30';
        }
        if (message.payload?.folderId != null
          && (typeof message.payload.folderId !== 'string' || message.payload.folderId.length > 64)) {
          return 'SCHEDULE_DEFERRED_OPEN RANDOM_BOOKMARK requires folderId: string';
        }
      } else if (message.action === 'CLICK_CONTROL') {
        const controlError = deferredClickControlError(message.payload?.control);
        if (controlError) return controlError;
      }
      break;
    }
    case MSG.OPEN_POPOVER_WINDOW:
      if (typeof message.url !== 'string' || !message.url.trim()) {
        return 'OPEN_POPOVER_WINDOW requires url: string';
      }
      break;
    case MSG.ZOOM_STEP: {
      const factor = Number(message.zoomFactor);
      const hasFactor = Number.isFinite(factor) && factor > 0;
      const hasDir = message.direction === 1 || message.direction === -1;
      if (!hasFactor && !hasDir) {
        return 'ZOOM_STEP requires direction: 1 or -1, or zoomFactor';
      }
      break;
    }
    case MSG.WIKTIONARY_LOOKUP:
      if (typeof message.word !== 'string' || !message.word.trim()) {
        return 'WIKTIONARY_LOOKUP requires word: string';
      }
      break;
    case MSG.FRAME_MEDIA_SEEK:
      if (!Number.isFinite(Number(message.seconds)) || Number(message.seconds) < 0) {
        return 'FRAME_MEDIA_SEEK requires seconds: number >= 0';
      }
      break;
    case MSG.FRAME_MEDIA_VOLUME: {
      const vol = Number(message.volume);
      if (!Number.isFinite(vol) || vol < 0 || vol > 1) {
        return 'FRAME_MEDIA_VOLUME requires volume: number in 0–1';
      }
      break;
    }
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
