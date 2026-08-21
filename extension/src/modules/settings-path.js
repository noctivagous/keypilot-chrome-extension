/**
 * Nested settings path helpers (DOM-free).
 */

/**
 * @param {any} value
 * @param {any} fallback
 */
export function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

/**
 * @param {any} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampNumber(n, min, max) {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/**
 * @param {any} obj
 * @param {string} path
 * @returns {any}
 */
export function getPath(obj, path) {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Build a nested partial object from a dotted path.
 * @param {string} path
 * @param {any} value
 * @returns {Record<string, any>}
 */
export function pathToPartial(path, value) {
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return {};
  let out = value;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    out = { [parts[i]]: out };
  }
  return /** @type {Record<string, any>} */ (out);
}

/**
 * @param {Record<string, any>|null|undefined} overrides
 * @param {string} path
 * @param {any} value
 * @returns {Record<string, any>}
 */
export function setOverridePath(overrides, path, value) {
  const next = cloneJson(overrides && typeof overrides === 'object' ? overrides : {}, {});
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return next;
  let cur = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const child = cur[key];
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      cur[key] = {};
    }
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}
