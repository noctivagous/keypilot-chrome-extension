/**
 * Parent → popover iframe INIT payload helpers.
 *
 * Close keys were already layout-aware. Scroll keys used to be hardcoded C/V/Z/X
 * in the iframe bridge (right-handed built-in), which double-fired Page Down
 * when a custom layout rebound V (e.g. to Scroll Line).
 */
import { MSG } from '../messaging/types.js';

/** @typedef {{
 *   pageUp: string[],
 *   pageDown: string[],
 *   pageUpInstant: string[],
 *   pageDownInstant: string[],
 *   pageTop: string[],
 *   pageBottom: string[]
 * }} PopoverScrollKeys */

const SCROLL_KEY_SLOTS = Object.freeze([
  'pageUp',
  'pageDown',
  'pageUpInstant',
  'pageDownInstant',
  'pageTop',
  'pageBottom'
]);

const BINDING_ID_BY_SLOT = Object.freeze({
  pageUp: 'PAGE_UP',
  pageDown: 'PAGE_DOWN',
  pageUpInstant: 'PAGE_UP_INSTANT',
  pageDownInstant: 'PAGE_DOWN_INSTANT',
  pageTop: 'PAGE_TOP',
  pageBottom: 'PAGE_BOTTOM'
});

const SLOT_BY_FUNCTION_ID = Object.freeze({
  PAGE_UP: 'pageUp',
  PAGE_DOWN: 'pageDown',
  PAGE_UP_INSTANT: 'pageUpInstant',
  PAGE_DOWN_INSTANT: 'pageDownInstant',
  PAGE_TOP: 'pageTop',
  PAGE_BOTTOM: 'pageBottom'
});

/** Fallback when INIT omits scrollKeys (launcher / newtab / older parents). */
export const DEFAULT_POPOVER_SCROLL_KEYS = Object.freeze({
  pageUp: Object.freeze([]),
  pageDown: Object.freeze([]),
  pageUpInstant: Object.freeze(['c', 'C']),
  pageDownInstant: Object.freeze(['v', 'V']),
  pageTop: Object.freeze(['z', 'Z']),
  pageBottom: Object.freeze(['x', 'X'])
});

/**
 * @param {string[]} keys
 * @returns {string[]}
 */
function uniqueKeys(keys) {
  const seen = new Set();
  const out = [];
  for (const raw of keys) {
    const k = String(raw || '');
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * @param {any} binding
 * @returns {string[]}
 */
function keysFromBinding(binding) {
  return uniqueKeys(Array.isArray(binding?.keys) ? binding.keys.map(String) : []);
}

/**
 * @param {string} slotKey
 * @returns {string[]}
 */
function expandSlotKey(slotKey) {
  const s = String(slotKey || '').trim();
  if (!s || s.includes('+')) return [];
  if (s.length === 1) {
    return uniqueKeys([s, s.toLowerCase(), s.toUpperCase()]);
  }
  return [s];
}

/**
 * @param {any} assigned
 * @param {any[]} [userActions]
 * @returns {string}
 */
function resolveSlotFunctionId(assigned, userActions) {
  if (!assigned || assigned.type !== 'function') return '';
  const id = String(assigned.id || '');
  if (!id) return '';
  if (id.startsWith('action:')) {
    const inst = (userActions || []).find((a) => a && a.id === id);
    return inst?.functionId ? String(inst.functionId) : '';
  }
  return id;
}

/**
 * @param {Record<string, any>|null|undefined} slots
 * @param {any[]} [userActions]
 * @returns {PopoverScrollKeys}
 */
export function collectPopoverScrollKeysFromSlots(slots, userActions) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const slot of SCROLL_KEY_SLOTS) out[slot] = [];

  for (const [slotKey, assigned] of Object.entries(slots || {})) {
    const functionId = resolveSlotFunctionId(assigned, userActions);
    const dest = SLOT_BY_FUNCTION_ID[functionId];
    if (!dest) continue;
    out[dest].push(...expandSlotKey(slotKey));
  }

  for (const slot of SCROLL_KEY_SLOTS) out[slot] = uniqueKeys(out[slot]);
  return /** @type {PopoverScrollKeys} */ (out);
}

/**
 * Built-in layout assignments (not custom user slots).
 * @param {Record<string, any>|null|undefined} keybindings
 * @returns {PopoverScrollKeys}
 */
export function collectPopoverScrollKeysFromBindings(keybindings) {
  const KB = keybindings || {};
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const slot of SCROLL_KEY_SLOTS) {
    out[slot] = keysFromBinding(KB[BINDING_ID_BY_SLOT[slot]]);
  }
  return /** @type {PopoverScrollKeys} */ (out);
}

/**
 * Prefer custom-layout slots; otherwise built-in keybindings.
 * @param {any} kp
 * @returns {PopoverScrollKeys}
 */
export function collectPopoverScrollKeysFromKeyPilot(kp) {
  try {
    const sel = String(kp?._currentKeyboardLayoutId || '');
    if (sel.startsWith('user:') && kp._currentKeySlotMap) {
      return collectPopoverScrollKeysFromSlots(kp._currentKeySlotMap, kp._currentUserActions);
    }
  } catch { /* ignore */ }
  return collectPopoverScrollKeysFromBindings(kp?.keybindings);
}

/**
 * @param {any} raw
 * @returns {PopoverScrollKeys|null}
 */
export function normalizePopoverScrollKeys(raw) {
  if (!raw || typeof raw !== 'object') return null;
  /** @type {Record<string, string[]>} */
  const out = {};
  let any = false;
  for (const slot of SCROLL_KEY_SLOTS) {
    if (Array.isArray(raw[slot])) {
      out[slot] = uniqueKeys(raw[slot].map(String));
      any = true;
    } else {
      out[slot] = [];
    }
  }
  return any ? /** @type {PopoverScrollKeys} */ (out) : null;
}

/**
 * @param {PopoverScrollKeys|null|undefined} scrollKeys
 * @param {keyof PopoverScrollKeys} slot
 * @param {string} key
 * @returns {boolean}
 */
export function popoverScrollKeyMatches(scrollKeys, slot, key) {
  const list = scrollKeys?.[slot];
  return Array.isArray(list) && list.includes(key);
}

/**
 * @param {Window} win
 * @param {{ closeKeys?: string[], scrollKeys?: PopoverScrollKeys, keyPilot?: any }} [opts]
 */
export function postPopoverBridgeInit(win, opts = {}) {
  if (!win || typeof win.postMessage !== 'function') return;
  const closeKeys = Array.isArray(opts.closeKeys) && opts.closeKeys.length
    ? opts.closeKeys.map(String)
    : undefined;
  const scrollKeys = opts.scrollKeys
    || collectPopoverScrollKeysFromKeyPilot(
      opts.keyPilot || (typeof window !== 'undefined'
        ? (window.__KeyPilotInstance || window.keyPilot)
        : null)
    );
  /** @type {{ type: string, closeKeys?: string[], scrollKeys?: PopoverScrollKeys }} */
  const payload = { type: MSG.POPOVER_BRIDGE_INIT };
  if (closeKeys) payload.closeKeys = closeKeys;
  if (scrollKeys) payload.scrollKeys = scrollKeys;
  try {
    win.postMessage(payload, '*');
  } catch { /* ignore */ }
}
