/**
 * Frame-agent keybindings taken from a custom layout.
 *
 * Custom layouts are applied on the top frame. A focused cross-origin iframe
 * (Google account menu) never delivers keydown there, so the thin frame agent
 * must still know the keys for the actions it can run itself.
 *
 * Chord slots stay on the top frame. Macros and every other Function stay there too.
 */

/** Must match KEYBOARD_LAYOUT_STORE_KEY in keyboard-layout-store.js. */
export const FRAME_LAYOUT_STORE_KEY = 'kp_keyboard_layout_store_v1';

/** Actions installFrameClickAgent handles while the iframe document is focused. */
export const FRAME_AGENT_LOCAL_ACTION_IDS = Object.freeze([
  'ACTIVATE',
  'ACTIVATE_NEW_TAB',
  'ACTIVATE_NEW_TAB_BACKGROUND',
  'PAGE_UP_INSTANT',
  'PAGE_DOWN_INSTANT',
  'PAGE_TOP',
  'PAGE_BOTTOM'
]);

const LOCAL_ACTION_IDS = new Set(FRAME_AGENT_LOCAL_ACTION_IDS);

/**
 * @param {{ type?: string, id?: string }|null|undefined} assigned
 * @param {Record<string, { functionId?: string }>|null|undefined} actions
 * @returns {string}
 */
function functionIdForSlot(assigned, actions) {
  if (!assigned || assigned.type !== 'function') return '';
  const id = String(assigned.id || '');
  if (!id || id.startsWith('stock:')) return '';
  if (id.startsWith('action:')) {
    const instance = actions && actions[id];
    return instance && typeof instance.functionId === 'string' ? instance.functionId : '';
  }
  return id;
}

/**
 * @param {Record<string, { type?: string, id?: string }|null>|null|undefined} slots
 * @param {Record<string, { functionId?: string }>|null|undefined} [actions]
 * @returns {Record<string, { bindingType: 'physical'|'character', keys: string[], matchOn: string[] }>}
 */
export function buildFrameLocalKeybindingsFromUserLayout(slots, actions) {
  /** @type {Record<string, string[]>} */
  const codes = {};
  /** @type {Record<string, string[]>} */
  const chars = {};

  for (const [slotKey, assigned] of Object.entries(slots || {})) {
    const functionId = functionIdForSlot(assigned, actions);
    if (!LOCAL_ACTION_IDS.has(functionId)) continue;
    if (slotKey.startsWith('code:')) {
      const code = slotKey.slice('code:'.length);
      if (!code) continue;
      (codes[functionId] || (codes[functionId] = [])).push(code);
    } else if (slotKey.startsWith('key:')) {
      const character = slotKey.slice('key:'.length);
      if (!character) continue;
      (chars[functionId] || (chars[functionId] = [])).push(character);
    }
  }

  /** @type {Record<string, { bindingType: 'physical'|'character', keys: string[], matchOn: string[] }>} */
  const out = {};
  for (const id of FRAME_AGENT_LOCAL_ACTION_IDS) {
    const physical = codes[id] || [];
    const character = chars[id] || [];
    if (!physical.length && !character.length) continue;
    if (physical.length && !character.length) {
      out[id] = { bindingType: 'physical', keys: physical, matchOn: ['code'] };
    } else if (character.length && !physical.length) {
      out[id] = { bindingType: 'character', keys: character, matchOn: ['key'] };
    } else {
      out[id] = {
        bindingType: 'physical',
        keys: [...physical, ...character],
        matchOn: ['code', 'key']
      };
    }
  }
  return out;
}

/**
 * @param {string} layoutId Layout id without the `user:` prefix.
 * @returns {Promise<ReturnType<typeof buildFrameLocalKeybindingsFromUserLayout>>}
 */
export async function loadFrameLocalKeybindingsForUserLayout(layoutId) {
  const id = String(layoutId || '');
  if (!id) return {};
  let stored = null;
  try {
    const result = await chrome.storage.sync.get(FRAME_LAYOUT_STORE_KEY);
    stored = result && result[FRAME_LAYOUT_STORE_KEY];
  } catch {
    return {};
  }
  if (!stored || stored.version !== 1 || !stored.layouts) return {};
  const layout = stored.layouts[id];
  if (!layout || typeof layout !== 'object') return {};
  return buildFrameLocalKeybindingsFromUserLayout(layout.slots, stored.actions);
}
