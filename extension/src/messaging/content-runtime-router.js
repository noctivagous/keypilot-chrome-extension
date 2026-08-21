/**
 * Single chrome.runtime.onMessage router for the content-script isolated world.
 *
 * Modules register handlers by type instead of each calling addListener.
 * Multiple handlers may share a type; the first that returns a sync response
 * (or returns true for async) wins sendResponse semantics.
 */

/** @typedef {(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean|void|Promise<void>} RuntimeMessageHandler */

/** @type {Map<string, RuntimeMessageHandler[]>} */
const handlersByType = new Map();

let installed = false;

/**
 * @param {string} type
 * @param {RuntimeMessageHandler} handler
 * @returns {() => void} disposer
 */
export function registerContentRuntimeHandler(type, handler) {
  if (typeof type !== 'string' || !type || typeof handler !== 'function') {
    return () => {};
  }
  const list = handlersByType.get(type) || [];
  list.push(handler);
  handlersByType.set(type, list);
  return () => {
    const cur = handlersByType.get(type);
    if (!cur) return;
    const next = cur.filter((h) => h !== handler);
    if (next.length) handlersByType.set(type, next);
    else handlersByType.delete(type);
  };
}

/**
 * Install the single content-script runtime listener (idempotent).
 */
export function installContentRuntimeRouter() {
  if (installed) return;
  if (typeof chrome === 'undefined' || !chrome?.runtime?.onMessage?.addListener) return;
  installed = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = message && typeof message.type === 'string' ? message.type : '';
    const list = type ? handlersByType.get(type) : null;
    if (!list || !list.length) return;

    let asyncPending = false;
    for (const handler of list) {
      try {
        const result = handler(message, sender, sendResponse);
        if (result === true) asyncPending = true;
      } catch (e) {
        console.warn('[KeyPilot] content runtime handler failed:', type, e);
      }
    }
    return asyncPending;
  });
}

/**
 * @returns {readonly string[]}
 */
export function listContentRuntimeHandlerTypes() {
  return Object.freeze([...handlersByType.keys()].sort());
}
