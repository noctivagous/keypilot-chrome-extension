/**
 * Helpers for Chrome extension context validity.
 *
 * After an extension reload/update, content scripts on already-open pages keep
 * running but chrome.* APIs throw "Extension context invalidated". Detect that
 * early, fail closed, and avoid spamming console/errors.
 */

let _contextInvalidated = false;

/**
 * @returns {boolean} True when chrome.runtime is usable from this realm.
 */
export function isExtensionContextValid() {
  if (_contextInvalidated) return false;
  try {
    // chrome.runtime.id is undefined after the extension context is invalidated.
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      _contextInvalidated = true;
      return false;
    }
    return true;
  } catch {
    _contextInvalidated = true;
    return false;
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isExtensionContextInvalidatedError(error) {
  if (!error) return false;
  const msg = typeof error === 'string'
    ? error
    : (error && typeof error === 'object' && 'message' in error
      ? String(/** @type {{ message?: unknown }} */ (error).message || '')
      : String(error));
  return /Extension context invalidated/i.test(msg);
}

/**
 * Mark the context as dead for this content-script lifetime.
 */
export function markExtensionContextInvalidated() {
  _contextInvalidated = true;
}

/**
 * @param {unknown} error
 * @returns {boolean} True if the error was an invalidated-context failure.
 */
export function noteExtensionContextError(error) {
  if (isExtensionContextInvalidatedError(error)) {
    markExtensionContextInvalidated();
    return true;
  }
  // Some paths only surface a missing runtime id without that exact message.
  if (!isExtensionContextValid()) {
    return true;
  }
  return false;
}

/**
 * Fire-and-forget runtime message with invalidated-context handling.
 * @param {object} message
 * @param {{
 *   onInvalidated?: () => void,
 *   onError?: (error: unknown) => void,
 *   onResponse?: (response: unknown) => void
 * }} [opts]
 * @returns {boolean} False if the message could not be sent (invalid context or sync throw).
 */
export function safeRuntimeSendMessage(message, opts = {}) {
  if (!isExtensionContextValid()) {
    try { opts.onInvalidated?.(); } catch { /* ignore */ }
    return false;
  }

  try {
    const result = chrome.runtime.sendMessage(message);
    // MV3 returns a Promise; swallow invalidated rejections so they don't surface as unhandled.
    if (result && typeof result.then === 'function') {
      result.then((response) => {
        try { opts.onResponse?.(response); } catch { /* ignore */ }
      }).catch((error) => {
        if (noteExtensionContextError(error)) {
          try { opts.onInvalidated?.(); } catch { /* ignore */ }
          return;
        }
        try { opts.onError?.(error); } catch { /* ignore */ }
      });
    }
    return true;
  } catch (error) {
    if (noteExtensionContextError(error)) {
      try { opts.onInvalidated?.(); } catch { /* ignore */ }
      return false;
    }
    try { opts.onError?.(error); } catch { /* ignore */ }
    return false;
  }
}
