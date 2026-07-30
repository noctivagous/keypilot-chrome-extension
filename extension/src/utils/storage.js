/**
 * Shared chrome.storage helpers.
 *
 * Policy used across KeyPilot:
 * - Prefer `chrome.storage.sync` (profile-wide)
 * - Fall back to `chrome.storage.local` when sync fails or is empty
 * - Return caller default when neither has a value
 */

/**
 * Read a single key: sync → local → defaultValue.
 * @template T
 * @param {string} key
 * @param {T} [defaultValue]
 * @returns {Promise<T>}
 */
export async function storageGetValue(key, defaultValue = undefined) {
  if (!key || typeof key !== 'string') return defaultValue;

  try {
    if (chrome?.storage?.sync?.get) {
      const syncResult = await chrome.storage.sync.get([key]);
      if (syncResult && Object.prototype.hasOwnProperty.call(syncResult, key) &&
          syncResult[key] !== undefined) {
        return /** @type {T} */ (syncResult[key]);
      }
    }
  } catch {
    // ignore, fall back to local
  }

  try {
    if (chrome?.storage?.local?.get) {
      const localResult = await chrome.storage.local.get([key]);
      if (localResult && Object.prototype.hasOwnProperty.call(localResult, key) &&
          localResult[key] !== undefined) {
        return /** @type {T} */ (localResult[key]);
      }
    }
  } catch {
    // ignore
  }

  return defaultValue;
}

/**
 * Read multiple keys. For each key, prefer sync value when present, else local.
 * @param {string[]} keys
 * @returns {Promise<Record<string, any>>}
 */
export async function storageGetKeys(keys) {
  const list = Array.isArray(keys) ? keys.filter((k) => typeof k === 'string' && k) : [];
  if (!list.length) return {};

  /** @type {Record<string, any>} */
  let sync = {};
  /** @type {Record<string, any>} */
  let local = {};

  try {
    if (chrome?.storage?.sync?.get) {
      sync = (await chrome.storage.sync.get(list)) || {};
    }
  } catch {
    sync = {};
  }

  try {
    if (chrome?.storage?.local?.get) {
      local = (await chrome.storage.local.get(list)) || {};
    }
  } catch {
    local = {};
  }

  /** @type {Record<string, any>} */
  const out = {};
  for (const key of list) {
    if (Object.prototype.hasOwnProperty.call(sync, key) && sync[key] !== undefined) {
      out[key] = sync[key];
    } else if (Object.prototype.hasOwnProperty.call(local, key) && local[key] !== undefined) {
      out[key] = local[key];
    }
  }
  return out;
}

/**
 * Write a single key: try sync, then local.
 * @param {string} key
 * @param {any} value
 * @param {{ includeTimestamp?: boolean }} [opts]
 * @returns {Promise<boolean>} true if either area accepted the write
 */
export async function storageSetValue(key, value, opts = {}) {
  if (!key || typeof key !== 'string') return false;

  /** @type {Record<string, any>} */
  const payload = { [key]: value };
  if (opts.includeTimestamp) {
    payload.timestamp = Date.now();
  }

  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set(payload);
      return true;
    }
  } catch {
    // fall back to local
  }

  try {
    if (chrome?.storage?.local?.set) {
      await chrome.storage.local.set(payload);
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Write an object of keys: try sync, then local.
 * @param {Record<string, any>} obj
 * @returns {Promise<boolean>}
 */
export async function storageSetObject(obj) {
  if (!obj || typeof obj !== 'object') return false;

  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set(obj);
      return true;
    }
  } catch {
    // fall back
  }

  try {
    if (chrome?.storage?.local?.set) {
      await chrome.storage.local.set(obj);
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}
