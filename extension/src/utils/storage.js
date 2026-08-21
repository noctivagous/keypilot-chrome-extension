/**
 * Shared chrome.storage helpers.
 *
 * Canonical ownership, areas, and conflict rules:
 *   refs/STORAGE_POLICY.md
 *
 * Read policy (storageGetValue / storageGetKeys):
 * - Prefer sync, fall back to local, else caller default
 * - When both areas have a value and both are objects with `_updatedAt`,
 *   the newer timestamp wins (local wins ties)
 * - When both areas have a value without usable `_updatedAt`, prefer sync
 *
 * Write policy (storageSetValue):
 * - Try sync first; on failure write local
 * - `dualWrite: true` also mirrors to local after a successful sync so a
 *   later sync miss cannot resurrect a stale local copy
 * - `includeTimestamp: true` writes a sibling top-level `timestamp` key
 *   (legacy; does not participate in `_updatedAt` conflict resolution)
 */

function pickNewerStoredValue(syncVal, localVal) {
  const syncAt = syncVal && typeof syncVal === 'object' ? Number(syncVal._updatedAt) : 0;
  const localAt = localVal && typeof localVal === 'object' ? Number(localVal._updatedAt) : 0;
  const syncTs = Number.isFinite(syncAt) ? syncAt : 0;
  const localTs = Number.isFinite(localAt) ? localAt : 0;
  if (syncTs && localTs) return localTs >= syncTs ? localVal : syncVal;
  if (localTs && !syncTs) return localVal;
  if (syncTs && !localTs) return syncVal;
  return syncVal;
}

/**
 * @param {any} syncVal
 * @param {boolean} syncHas
 * @param {any} localVal
 * @param {boolean} localHas
 * @param {any} defaultValue
 */
function resolveStoredAreas(syncVal, syncHas, localVal, localHas, defaultValue) {
  if (syncHas && localHas) return pickNewerStoredValue(syncVal, localVal);
  if (syncHas) return syncVal;
  if (localHas) return localVal;
  return defaultValue;
}

/**
 * Read a single key: sync → local → defaultValue.
 * When both areas have an object with `_updatedAt`, the newer copy wins.
 * @template T
 * @param {string} key
 * @param {T} [defaultValue]
 * @returns {Promise<T>}
 */
export async function storageGetValue(key, defaultValue = undefined) {
  if (!key || typeof key !== 'string') return defaultValue;

  let syncVal = undefined;
  let syncHas = false;
  try {
    if (chrome?.storage?.sync?.get) {
      const syncResult = await chrome.storage.sync.get([key]);
      if (syncResult && Object.prototype.hasOwnProperty.call(syncResult, key) &&
          syncResult[key] !== undefined) {
        syncHas = true;
        syncVal = /** @type {T} */ (syncResult[key]);
      }
    }
  } catch {
    // ignore, fall back to local
  }

  let localVal = undefined;
  let localHas = false;
  try {
    if (chrome?.storage?.local?.get) {
      const localResult = await chrome.storage.local.get([key]);
      if (localResult && Object.prototype.hasOwnProperty.call(localResult, key) &&
          localResult[key] !== undefined) {
        localHas = true;
        localVal = /** @type {T} */ (localResult[key]);
      }
    }
  } catch {
    // ignore
  }

  return /** @type {T} */ (resolveStoredAreas(syncVal, syncHas, localVal, localHas, defaultValue));
}

/**
 * Read multiple keys with the same merge rules as `storageGetValue`
 * (including `_updatedAt` newer-wins when both areas have a key).
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
    const syncHas = Object.prototype.hasOwnProperty.call(sync, key) && sync[key] !== undefined;
    const localHas = Object.prototype.hasOwnProperty.call(local, key) && local[key] !== undefined;
    if (!syncHas && !localHas) continue;
    const resolved = resolveStoredAreas(
      syncHas ? sync[key] : undefined,
      syncHas,
      localHas ? local[key] : undefined,
      localHas,
      undefined
    );
    if (resolved !== undefined) out[key] = resolved;
  }
  return out;
}

/**
 * Write a single key: try sync, then local.
 * When `dualWrite` is true, also write local after a successful sync so a later
 * sync miss cannot resurrect a stale value.
 * @param {string} key
 * @param {any} value
 * @param {{ includeTimestamp?: boolean, dualWrite?: boolean }} [opts]
 * @returns {Promise<boolean>} true if either area accepted the write
 */
export async function storageSetValue(key, value, opts = {}) {
  if (!key || typeof key !== 'string') return false;

  /** @type {Record<string, any>} */
  const payload = { [key]: value };
  if (opts.includeTimestamp) {
    payload.timestamp = Date.now();
  }

  let wroteSync = false;
  try {
    if (chrome?.storage?.sync?.set) {
      await chrome.storage.sync.set(payload);
      wroteSync = true;
      if (!opts.dualWrite) return true;
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

  return wroteSync;
}

/**
 * Write an object of keys: try sync, then local.
 * Not dual-write: successful sync does not mirror to local.
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
