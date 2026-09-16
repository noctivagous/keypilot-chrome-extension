/**
 * In-memory chrome.storage + runtime stubs for node:test.
 * Call installChromeMock() before importing modules that touch chrome / navigator.
 */

const EXTENSION_ORIGIN = 'chrome-extension://keypilot-test';

/**
 * @param {Map<string, any>} store
 * @param {{ throws?: boolean }} flags
 */
function createArea(store, flags) {
  return {
    async get(keys) {
      if (flags.throws) throw new Error('storage get failed');
      /** @type {Record<string, any>} */
      const out = {};
      if (keys == null) {
        for (const [k, v] of store) out[k] = v;
        return out;
      }
      const list = Array.isArray(keys)
        ? keys
        : typeof keys === 'string'
          ? [keys]
          : Object.keys(keys || {});
      for (const key of list) {
        if (store.has(key)) out[key] = store.get(key);
      }
      return out;
    },
    async set(obj) {
      if (flags.throws) throw new Error('storage set failed');
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        store.set(k, v);
      }
    },
    async remove(keys) {
      if (flags.throws) throw new Error('storage remove failed');
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) store.delete(key);
    },
    async clear() {
      if (flags.throws) throw new Error('storage clear failed');
      store.clear();
    }
  };
}

/**
 * @typedef {{
 *   syncThrows?: boolean,
 *   localThrows?: boolean,
 *   isMac?: boolean,
 *   sync?: Record<string, any>,
 *   local?: Record<string, any>,
 *   messages?: Record<string, string|{ message?: string, placeholders?: Record<string, { content?: string }> }>
 * }} ChromeMockOptions
 */

/**
 * @param {ChromeMockOptions} [options]
 */
export function installChromeMock(options = {}) {
  const syncStore = new Map(Object.entries(options.sync || {}));
  const localStore = new Map(Object.entries(options.local || {}));
  const i18nMessages = new Map(Object.entries(options.messages || {}));
  const syncFlags = { throws: !!options.syncThrows };
  const localFlags = { throws: !!options.localThrows };
  /** @type {Set<(changes: any, areaName: string) => void>} */
  const changeListeners = new Set();

  const sync = createArea(syncStore, syncFlags);
  const local = createArea(localStore, localFlags);

  const chrome = {
    storage: {
      sync,
      local,
      onChanged: {
        addListener(fn) {
          if (typeof fn === 'function') changeListeners.add(fn);
        },
        removeListener(fn) {
          changeListeners.delete(fn);
        }
      }
    },
    runtime: {
      getURL(path) {
        const p = String(path || '').replace(/^\//, '');
        return `${EXTENSION_ORIGIN}/${p}`;
      }
    },
    i18n: {
      getMessage(messageName, substitutions) {
        const entry = i18nMessages.get(String(messageName || ''));
        const message = typeof entry === 'string'
          ? entry
          : (typeof entry?.message === 'string' ? entry.message : '');
        if (!message) return '';

        const values = Array.isArray(substitutions)
          ? substitutions
          : substitutions == null
            ? []
            : [substitutions];
        const placeholders = typeof entry === 'object' && entry?.placeholders
          ? entry.placeholders
          : {};
        return message
          .replace(/\$([1-9])\$/g, (_match, index) => String(values[Number(index) - 1] ?? ''))
          .replace(/\$([a-z0-9_@]+)\$/gi, (match, name) => {
            const content = placeholders[name.toLowerCase()]?.content;
            const index = /^\$([1-9])$/.exec(String(content || ''))?.[1];
            return index ? String(values[Number(index) - 1] ?? '') : match;
          });
      }
    }
  };

  globalThis.chrome = chrome;

  // Default non-Mac unless explicitly requested — keeps scroll defaults stable.
  // Node's globalThis.navigator is often a getter-only property.
  const mac = options.isMac === true;
  const navigatorStub = {
    platform: mac ? 'MacIntel' : 'Win32',
    userAgent: mac
      ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    userAgentData: mac ? { platform: 'macOS' } : { platform: 'Windows' }
  };
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: navigatorStub,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch {
    try {
      // Fallback when defineProperty is rejected.
      // @ts-ignore
      globalThis.navigator = navigatorStub;
    } catch {
      // Leave existing navigator; isMacPlatform() will treat non-Mac as false.
    }
  }

  return {
    chrome,
    syncStore,
    localStore,
    i18nMessages,
    syncFlags,
    localFlags,
    /**
     * @param {Record<string, any>} changes
     * @param {string} areaName
     */
    emitChange(changes, areaName = 'sync') {
      for (const fn of changeListeners) fn(changes, areaName);
    },
    /**
     * @param {string} key
     * @param {any} value
     * @param {'sync'|'local'} area
     */
    seed(key, value, area = 'sync') {
      (area === 'local' ? localStore : syncStore).set(key, value);
    },
    clearStores() {
      syncStore.clear();
      localStore.clear();
    },
    /**
     * @param {Record<string, string|{ message?: string, placeholders?: Record<string, { content?: string }> }>} messages
     */
    setI18nMessages(messages) {
      i18nMessages.clear();
      for (const [key, value] of Object.entries(messages || {})) {
        i18nMessages.set(key, value);
      }
    },
    setSyncThrows(v) {
      syncFlags.throws = !!v;
    },
    setLocalThrows(v) {
      localFlags.throws = !!v;
    }
  };
}

/**
 * Clear mock state between tests without tearing down chrome.
 * @param {ReturnType<typeof installChromeMock>} mock
 */
export function resetChromeMock(mock) {
  if (!mock) return;
  mock.clearStores();
  mock.setI18nMessages({});
  mock.setSyncThrows(false);
  mock.setLocalThrows(false);
}

export { EXTENSION_ORIGIN };
