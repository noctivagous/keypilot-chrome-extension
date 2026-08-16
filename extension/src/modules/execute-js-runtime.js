/**
 * Run user-authored Execute JS snippets in the content-script isolated world.
 *
 * Compiled with `AsyncFunction` + named parameters (not `eval`, not page-world inject).
 * Does not pass chrome, the KeyPilot instance, or storage APIs — callers choose the binding
 * object. `document` / `window` remain in lexical global scope of the isolated world.
 */

export const EXECUTE_JS_TIMEOUT_MS = 8000;

/** Stable parameter names passed into every Execute JS snippet. */
export const EXECUTE_JS_BINDING_NAMES = Object.freeze([
  'kpHoveredClickable',
  'kpHoverLeaf',
  'kpFocusedTextField',
  'kpMode',
  'kpPageUrl',
  'kpSelection',
  'kpPriorResult',
  'showPopover',
  'copyToClipboard',
  'notify'
]);

/**
 * @param {string} source
 * @param {Record<string, any>} bindings
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
export async function runUserExecuteJs(source, bindings, timeoutMs = EXECUTE_JS_TIMEOUT_MS) {
  const code = String(source || '');
  const names = EXECUTE_JS_BINDING_NAMES.slice();
  const values = names.map((name) => (bindings && Object.prototype.hasOwnProperty.call(bindings, name)
    ? bindings[name]
    : undefined));

  let fn;
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    fn = new AsyncFunction(...names, code);
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err || 'syntax error');
    throw new Error(`Syntax error: ${msg}`);
  }

  const run = Promise.resolve().then(() => fn(...values));
  const ms = Number(timeoutMs);
  const limit = Number.isFinite(ms) && ms > 0 ? ms : EXECUTE_JS_TIMEOUT_MS;
  let timer = 0;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Execute JS timed out')), limit);
  });
  try {
    return await Promise.race([run, timeout]);
  } finally {
    try { clearTimeout(timer); } catch { /* ignore */ }
  }
}

/**
 * Coerce a script callback argument into popover/clipboard text.
 * @param {any} value
 * @returns {string}
 */
export function stringifyExecuteJsValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try { return String(value); } catch { return ''; }
  }
}
