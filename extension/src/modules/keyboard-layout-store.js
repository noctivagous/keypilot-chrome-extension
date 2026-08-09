/**
 * KeyboardLayoutStore
 * Persistent store for user-created keyboard layouts, macros, and macro keys.
 *
 * Notes:
 * - Built-in layouts remain defined in `src/config/keyboard-layouts.js`.
 * - Built-in macro-key *kinds* are defined in `src/config/macro-keys.js`;
 *   user-configured instances live here under `macroKeys`.
 * - User layouts are stored separately and can be edited (built-ins must be duplicated first).
 * - This module is content-script safe (uses chrome.storage.sync).
 */

import { buildKeybindingsForLayout, getKeyboardUiLayoutForLayout } from '../config/keyboard-layouts.js';
import {
  defaultMacroKeyConfig,
  defaultMacroKeyLabel,
  normalizeMacroKeyConfig,
  normalizeMacroKeyKind
} from '../config/macro-keys.js';
import {
  defaultFunctionParameters,
  getFunctionDef,
  normalizeFunctionParameters
} from '../config/function-library.js';

export const KEYBOARD_LAYOUT_STORE_KEY = 'kp_keyboard_layout_store_v1';

/**
 * @typedef {'action'|'macro'|'macroKey'|'function'} SlotItemType
 *
 * @typedef {{ type: SlotItemType, id: string }} SlotItem
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   // Base built-in layoutId this was duplicated from (for future diffing/migrations)
 *   baseBuiltinLayoutId?: string,
 *   // Mapping from "slot label" (e.g. "Q", ";", "[") to assigned item (action/macro/macroKey/function)
 *   slots: Record<string, SlotItem|null>,
 *   createdAt: number,
 *   updatedAt: number
 * }} UserKeyboardLayout
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   icon?: string,
 *   actions: any[],
 *   createdAt: number,
 *   updatedAt: number
 * }} UserMacro
 *
 * @typedef {import('../config/macro-keys.js').UserMacroKey} UserMacroKey
 *
 * @typedef {{
 *   id: string,
 *   functionId: string,
 *   label?: string,
 *   parameters: Record<string, any>,
 *   createdAt: number,
 *   updatedAt: number
 * }} UserAction
 *
 * @typedef {{
 *   version: 1,
 *   layouts: Record<string, UserKeyboardLayout>,
 *   macros: Record<string, UserMacro>,
 *   macroKeys: Record<string, UserMacroKey>,
 *   actions: Record<string, UserAction>
 * }} KeyboardLayoutStoreState
 */

/**
 * @returns {KeyboardLayoutStoreState}
 */
export function getEmptyKeyboardLayoutStore() {
  return {
    version: 1,
    layouts: {},
    macros: {},
    macroKeys: {},
    actions: {}
  };
}

function nowMs() {
  return Date.now();
}

function genId(prefix) {
  try {
    const id = (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `${nowMs()}_${Math.random().toString(16).slice(2)}`;
    return `${prefix}${id}`;
  } catch {
    return `${prefix}${nowMs()}_${Math.random().toString(16).slice(2)}`;
  }
}

function normalizeSlotLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Prefer stable, simple slot keys.
  return s.length === 1 ? s.toUpperCase() : s;
}

/**
 * Extract "slot label" from a keybinding entry.
 * Works best when displayKey/keyLabel is a single printable character (e.g. Q, ;, [, ]).
 *
 * @param {any} binding
 * @returns {string}
 */
function slotLabelFromBinding(binding) {
  const s = String(binding?.displayKey || binding?.keyLabel || '').trim();
  if (!s) return '';
  if (s.length === 1) return normalizeSlotLabel(s);
  // Handle a few common composite labels we emit today (e.g. "a/`").
  if (s.includes('/')) {
    const first = s.split('/')[0];
    if (first && first.trim().length === 1) return normalizeSlotLabel(first.trim());
  }
  return '';
}

/**
 * @returns {Promise<KeyboardLayoutStoreState>}
 */
export async function getKeyboardLayoutStore() {
  try {
    const result = await chrome.storage.sync.get(KEYBOARD_LAYOUT_STORE_KEY);
    const stored = result && result[KEYBOARD_LAYOUT_STORE_KEY] ? result[KEYBOARD_LAYOUT_STORE_KEY] : null;
    if (stored && typeof stored === 'object' && stored.version === 1) {
      return {
        version: 1,
        layouts: stored.layouts && typeof stored.layouts === 'object' ? stored.layouts : {},
        macros: stored.macros && typeof stored.macros === 'object' ? stored.macros : {},
        macroKeys: stored.macroKeys && typeof stored.macroKeys === 'object' ? stored.macroKeys : {},
        actions: stored.actions && typeof stored.actions === 'object' ? stored.actions : {}
      };
    }
  } catch {
    // ignore
  }
  return getEmptyKeyboardLayoutStore();
}

/**
 * @param {KeyboardLayoutStoreState} next
 */
export async function setKeyboardLayoutStore(next) {
  try {
    await chrome.storage.sync.set({ [KEYBOARD_LAYOUT_STORE_KEY]: next });
  } catch {
    // ignore
  }
}

/**
 * @returns {Promise<UserKeyboardLayout[]>}
 */
export async function listUserKeyboardLayouts() {
  const st = await getKeyboardLayoutStore();
  return Object.values(st.layouts || {});
}

/**
 * @param {string} id
 * @returns {Promise<UserKeyboardLayout|null>}
 */
export async function getUserKeyboardLayoutById(id) {
  const st = await getKeyboardLayoutStore();
  const key = String(id || '');
  const v = st.layouts && typeof st.layouts === 'object' ? st.layouts[key] : null;
  return v && typeof v === 'object' ? v : null;
}

/**
 * @returns {Promise<UserMacro[]>}
 */
export async function listUserMacros() {
  const st = await getKeyboardLayoutStore();
  return Object.values(st.macros || {});
}

/**
 * Create a new empty user layout from scratch.
 * Uses the chosen built-in layout's *physical key set* to seed slot keys (all empty).
 *
 * @param {{ baseBuiltinLayoutId: string, label?: string, includeNumberRow?: boolean }} params
 * @returns {Promise<UserKeyboardLayout>}
 */
export async function createEmptyUserKeyboardLayout({ baseBuiltinLayoutId, label, includeNumberRow } = {}) {
  const baseId = String(baseBuiltinLayoutId || '');
  const uiLayout = getKeyboardUiLayoutForLayout(baseId, { includeNumberRow: !!includeNumberRow });
  /** @type {Record<string, SlotItem|null>} */
  const slots = {};
  for (const row of uiLayout || []) {
    for (const item of row || []) {
      if (!item) continue;
      if (item.type === 'special') continue;
      if (item.type === 'key') {
        const s = normalizeSlotLabel(item.text);
        if (s) slots[s] = slots[s] ?? null;
      }
    }
  }
  const t = nowMs();
  const layout = {
    id: genId('layout:'),
    label: String(label || 'New Layout'),
    baseBuiltinLayoutId: baseId,
    slots,
    createdAt: t,
    updatedAt: t
  };
  return await upsertUserKeyboardLayout(layout);
}

/**
 * @param {string} id
 */
export async function deleteUserKeyboardLayout(id) {
  const st = await getKeyboardLayoutStore();
  const key = String(id || '');
  if (!key) return;
  try {
    delete st.layouts[key];
  } catch { /* ignore */ }
  await setKeyboardLayoutStore(st);

  // If the deleted layout was the active current selection, fall back to built-in.
  try {
    const { getSettings, setSettings } = await import('./settings-manager.js');
    const settings = await getSettings();
    const cur = String(settings?.currentKeyboardLayoutId || '');
    if (cur === `user:${key}`) {
      await setSettings({ currentKeyboardLayoutId: 'builtin' });
    }
  } catch { /* ignore */ }
}

/**
 * Import a layout JSON blob. Always creates a new layout ID to avoid overwriting.
 *
 * Accepted shapes:
 * - { label, slots, baseBuiltinLayoutId? }
 * - { type: 'kp-layout', version: 1, layout: { ... } }
 *
 * @param {any} raw
 * @returns {Promise<UserKeyboardLayout|null>}
 */
export async function importUserKeyboardLayout(raw) {
  const payload = raw && raw.type === 'kp-layout' && raw.layout ? raw.layout : raw;
  if (!payload || typeof payload !== 'object') return null;
  const slots = payload.slots && typeof payload.slots === 'object' ? payload.slots : null;
  if (!slots) return null;
  const t = nowMs();
  const layout = {
    id: genId('layout:'),
    label: String(payload.label || 'Imported Layout'),
    baseBuiltinLayoutId: payload.baseBuiltinLayoutId ? String(payload.baseBuiltinLayoutId) : undefined,
    slots,
    createdAt: t,
    updatedAt: t
  };
  return await upsertUserKeyboardLayout(layout);
}

/**
 * @param {UserKeyboardLayout} layout
 * @returns {{ type: 'kp-layout', version: 1, layout: UserKeyboardLayout }}
 */
export function exportUserKeyboardLayout(layout) {
  return {
    type: 'kp-layout',
    version: 1,
    layout
  };
}

/**
 * Create a placeholder macro.
 * @param {{ label?: string }} [params]
 * @returns {Promise<UserMacro>}
 */
export async function createUserMacro({ label } = {}) {
  const st = await getKeyboardLayoutStore();
  const id = genId('macro:');
  const t = nowMs();
  const macro = {
    id,
    label: String(label || 'New Macro'),
    icon: 'placeholder',
    actions: [],
    createdAt: t,
    updatedAt: t
  };
  st.macros[id] = macro;
  await setKeyboardLayoutStore(st);
  return macro;
}

/**
 * @returns {Promise<UserMacroKey[]>}
 */
export async function listUserMacroKeys() {
  const st = await getKeyboardLayoutStore();
  return Object.values(st.macroKeys || {}).filter(Boolean);
}

/**
 * @param {string} id
 * @returns {Promise<UserMacroKey|null>}
 */
export async function getUserMacroKeyById(id) {
  const st = await getKeyboardLayoutStore();
  const key = String(id || '');
  const mk = st.macroKeys && st.macroKeys[key] ? st.macroKeys[key] : null;
  return mk || null;
}

/**
 * Create a configured built-in macro key instance.
 * @param {{ kind: string, label?: string, config?: Record<string, any> }} params
 * @returns {Promise<UserMacroKey|null>}
 */
export async function createUserMacroKey({ kind, label, config } = {}) {
  const k = normalizeMacroKeyKind(kind);
  if (!k) return null;
  const st = await getKeyboardLayoutStore();
  const id = genId('macroKey:');
  const t = nowMs();
  /** @type {UserMacroKey} */
  const mk = {
    id,
    kind: k,
    label: String(label || defaultMacroKeyLabel(k)),
    config: normalizeMacroKeyConfig(k, config || defaultMacroKeyConfig(k)),
    createdAt: t,
    updatedAt: t
  };
  if (!st.macroKeys || typeof st.macroKeys !== 'object') st.macroKeys = {};
  st.macroKeys[id] = mk;
  await setKeyboardLayoutStore(st);
  return mk;
}

/**
 * @param {UserMacroKey} macroKey
 * @returns {Promise<UserMacroKey|null>}
 */
export async function upsertUserMacroKey(macroKey) {
  const kind = normalizeMacroKeyKind(macroKey?.kind);
  if (!kind || !macroKey?.id) return null;
  const st = await getKeyboardLayoutStore();
  const t = nowMs();
  const prev = st.macroKeys && st.macroKeys[macroKey.id] ? st.macroKeys[macroKey.id] : null;
  /** @type {UserMacroKey} */
  const mk = {
    id: String(macroKey.id),
    kind,
    label: String(macroKey.label || defaultMacroKeyLabel(kind)),
    config: normalizeMacroKeyConfig(kind, macroKey.config),
    createdAt: Number.isFinite(prev?.createdAt) ? prev.createdAt : (Number.isFinite(macroKey.createdAt) ? macroKey.createdAt : t),
    updatedAt: t
  };
  if (!st.macroKeys || typeof st.macroKeys !== 'object') st.macroKeys = {};
  st.macroKeys[mk.id] = mk;
  await setKeyboardLayoutStore(st);
  return mk;
}

/**
 * @param {string} id
 */
export async function deleteUserMacroKey(id) {
  const st = await getKeyboardLayoutStore();
  const key = String(id || '');
  if (!key || !st.macroKeys) return;
  try {
    delete st.macroKeys[key];
  } catch { /* ignore */ }
  await setKeyboardLayoutStore(st);
}

/**
 * Action Instances — a Function bound to specific parameter values, with its own id,
 * independent of any one key slot. Generalizes `UserMacroKey` to any Function in the
 * Function Library (see function-library.js), not just the legacy macro-key kinds.
 *
 * @returns {Promise<UserAction[]>}
 */
export async function listUserActions() {
  const st = await getKeyboardLayoutStore();
  return Object.values(st.actions || {}).filter(Boolean);
}

/**
 * @param {string} id
 * @returns {Promise<UserAction|null>}
 */
export async function getUserActionById(id) {
  const st = await getKeyboardLayoutStore();
  const key = String(id || '');
  const a = st.actions && st.actions[key] ? st.actions[key] : null;
  return a || null;
}

/**
 * Create a configured Action Instance for any instantiable Function.
 * @param {{ functionId: string, label?: string, parameters?: Record<string, any> }} params
 * @returns {Promise<UserAction|null>}
 */
export async function createUserAction({ functionId, label, parameters } = {}) {
  const def = getFunctionDef(functionId);
  if (!def) return null;
  const st = await getKeyboardLayoutStore();
  const id = genId('action:');
  const t = nowMs();
  /** @type {UserAction} */
  const action = {
    id,
    functionId: def.id,
    label: String(label || def.label),
    parameters: normalizeFunctionParameters(def.id, parameters || defaultFunctionParameters(def.id)),
    createdAt: t,
    updatedAt: t
  };
  if (!st.actions || typeof st.actions !== 'object') st.actions = {};
  st.actions[id] = action;
  await setKeyboardLayoutStore(st);
  return action;
}

/**
 * @param {UserAction} action
 * @returns {Promise<UserAction|null>}
 */
export async function upsertUserAction(action) {
  const def = getFunctionDef(action?.functionId);
  if (!def || !action?.id) return null;
  const st = await getKeyboardLayoutStore();
  const t = nowMs();
  const prev = st.actions && st.actions[action.id] ? st.actions[action.id] : null;
  /** @type {UserAction} */
  const a = {
    id: String(action.id),
    functionId: def.id,
    label: String(action.label || prev?.label || def.label),
    parameters: normalizeFunctionParameters(def.id, action.parameters),
    createdAt: Number.isFinite(prev?.createdAt) ? prev.createdAt : (Number.isFinite(action.createdAt) ? action.createdAt : t),
    updatedAt: t
  };
  if (!st.actions || typeof st.actions !== 'object') st.actions = {};
  st.actions[a.id] = a;
  await setKeyboardLayoutStore(st);
  return a;
}

/**
 * @param {string} id
 */
export async function deleteUserAction(id) {
  const st = await getKeyboardLayoutStore();
  const key = String(id || '');
  if (!key || !st.actions) return;
  try {
    delete st.actions[key];
  } catch { /* ignore */ }
  await setKeyboardLayoutStore(st);
}

/**
 * Save a user layout.
 * @param {UserKeyboardLayout} layout
 * @returns {Promise<UserKeyboardLayout>}
 */
export async function upsertUserKeyboardLayout(layout) {
  const st = await getKeyboardLayoutStore();
  const t = nowMs();
  const l = {
    ...layout,
    id: String(layout?.id || genId('layout:')),
    label: String(layout?.label || 'Custom Layout'),
    slots: layout && typeof layout.slots === 'object' ? layout.slots : {},
    createdAt: Number.isFinite(layout?.createdAt) ? layout.createdAt : t,
    updatedAt: t
  };
  st.layouts[l.id] = l;
  await setKeyboardLayoutStore(st);
  return l;
}

/**
 * Duplicate a built-in layout into an editable user layout.
 *
 * @param {{ builtinLayoutId: string, label?: string }} params
 * @returns {Promise<UserKeyboardLayout>}
 */
export async function duplicateBuiltinLayoutToUserLayout({ builtinLayoutId, label } = {}) {
  const baseId = String(builtinLayoutId || '');
  const kb = buildKeybindingsForLayout(baseId);
  const uiLayout = getKeyboardUiLayoutForLayout(baseId, { includeNumberRow: true });

  // Seed slots from whatever actions currently appear on the keyboard.
  /** @type {Record<string, SlotItem|null>} */
  const slots = {};
  for (const row of uiLayout || []) {
    for (const item of row || []) {
      if (!item) continue;
      if (item.type === 'special') continue;
      if (item.type === 'key') {
        const s = normalizeSlotLabel(item.text);
        if (s) slots[s] = slots[s] ?? null;
        continue;
      }
      if (item.type === 'action') {
        const binding = kb && kb[item.id];
        const slot = slotLabelFromBinding(binding);
        if (!slot) continue;
        slots[slot] = { type: 'action', id: String(item.id) };
      }
    }
  }

  const t = nowMs();
  const layout = {
    id: genId('layout:'),
    label: String(label || 'Custom Layout'),
    baseBuiltinLayoutId: baseId,
    slots,
    createdAt: t,
    updatedAt: t
  };
  return await upsertUserKeyboardLayout(layout);
}
