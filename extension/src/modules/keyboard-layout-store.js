/**
 * KeyboardLayoutStore
 * Persistent store for user-created keyboard layouts, macros, and Action Instances.
 *
 * Notes:
 * - Built-in layouts remain defined in `src/config/keyboard-layouts.js`.
 * - Built-in macro-key *kinds* are defined in `src/config/macro-keys.js` and generalized into
 *   `FunctionDef`s in `function-library.js` (`legacyMacroKeyKind`); a *configured* macro key is
 *   just a `UserAction` for one of those Function ids — see `createUserAction` below. There is no
 *   separate `UserMacroKey` storage/CRUD; this extension has no shipped users yet, so that legacy
 *   shape was retired outright rather than kept around for compatibility (see
 *   KEY_ACTION_ARCHITECTURE.md, "SlotAssignment" migration row).
 * - User layouts are stored separately and can be edited (built-ins must be duplicated first).
 * - This module is content-script safe (uses chrome.storage.sync).
 */

import {
  buildEffectiveKeybindings,
  getKeyboardUiLayoutForLayout,
  inferFamilyAndHandednessFromLayoutId,
  physicalSlotLabelFromBinding
} from '../config/keyboard-layouts.js';
import {
  defaultFunctionParameters,
  functionWorksWhileTyping,
  getFunctionDef,
  normalizeFunctionParameters,
  validateFunctionSlotKey
} from '../config/function-library.js';
import { getStockMacroById, isStockMacroId } from '../config/stock-macros.js';

export const KEYBOARD_LAYOUT_STORE_KEY = 'kp_keyboard_layout_store_v1';

/**
 * @typedef {'macro'|'function'} SlotAssignmentType
 *
 * @typedef {{ type: SlotAssignmentType, id: string }} SlotAssignment
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   // User layouts are never built-in; built-in families live in keyboard-layouts.js.
 *   builtIn: false,
 *   // Base built-in layoutId this was duplicated from (for future diffing/migrations)
 *   baseBuiltinLayoutId?: string,
 *   // Mapping from "slot label" (e.g. "Q", ";", "[") to assigned item (function/macro)
 *   slots: Record<string, SlotAssignment|null>,
 *   createdAt: number,
 *   updatedAt: number
 * }} UserKeyboardLayout
 *
 * @typedef {{
 *   kind: 'function',
 *   functionId: string,
 *   parameters: Record<string, any>,
 *   delayMsBefore?: number
 * } | {
 *   kind: 'wait',
 *   ms: number
 * } | {
 *   kind: 'gate',
 *   op: string,
 *   left: string,
 *   leftKey?: string,
 *   right?: any,
 *   thenSkip?: number
 * } | {
 *   kind: 'stop'
 * } | {
 *   kind: 'runMacro',
 *   macroId: string
 * }} MacroStep
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   icon?: string,
 *   // When forked from a stock macro, the stock id (same product rule as builtin → user layouts).
 *   baseStockMacroId?: string,
 *   // Ordered list of Function / Logic steps — see KEY_ACTION_ARCHITECTURE.md "Data model".
 *   // Replaces the old, always-empty `actions: any[]` placeholder field.
 *   steps: MacroStep[],
 *   createdAt: number,
 *   updatedAt: number
 * }} UserMacro
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
  return physicalSlotLabelFromBinding(binding);
}

/**
 * @param {any} step
 * @returns {MacroStep|null} null if the step cannot be normalized.
 */
export function normalizeMacroStep(step) {
  if (!step || typeof step !== 'object') return null;
  const rawKind = String(step.kind || (step.functionId ? 'function' : '')).trim();
  const kind = rawKind === 'run_macro' ? 'runMacro' : rawKind;

  if (kind === 'wait') {
    const ms = Math.max(0, Math.floor(Number(step.ms) || 0));
    return { kind: 'wait', ms };
  }
  if (kind === 'stop') {
    return { kind: 'stop' };
  }
  if (kind === 'runMacro') {
    const macroId = String(step.macroId || '').trim();
    if (!macroId) return null;
    return { kind: 'runMacro', macroId };
  }
  if (kind === 'gate') {
    const thenSkip = Math.max(0, Math.floor(Number(step.thenSkip) || 0));
    /** @type {MacroStep} */
    const out = {
      kind: 'gate',
      op: String(step.op || 'truthy'),
      left: String(step.left || 'prior')
    };
    if (step.leftKey != null && String(step.leftKey)) out.leftKey = String(step.leftKey);
    if (step.right !== undefined) out.right = step.right;
    if (thenSkip > 0) out.thenSkip = thenSkip;
    return out;
  }

  // Function step (explicit kind, or legacy `{ functionId, parameters }` without kind).
  if (kind === 'function' || step.functionId) {
    const functionId = String(step.functionId || '');
    const def = getFunctionDef(functionId);
    if (!def) return null;
    /** @type {MacroStep} */
    const out = {
      kind: 'function',
      functionId: def.id,
      parameters: normalizeFunctionParameters(def.id, step?.parameters)
    };
    const delay = Number(step?.delayMsBefore);
    if (Number.isFinite(delay) && delay > 0) out.delayMsBefore = delay;
    return out;
  }
  return null;
}

/**
 * One-time read-time migration: older stored macros used an always-empty `actions: any[]`
 * placeholder field (nothing ever wrote to it) instead of `steps: MacroStep[]`. Backfill `steps`
 * from `actions` if present (best-effort — `actions` entries were never in the `MacroStep` shape
 * since nothing wrote real data there, so anything that doesn't resolve to a known Function is
 * dropped) and drop the legacy field.
 * @param {Record<string, any>} rawMacros
 * @returns {Record<string, UserMacro>}
 */
function normalizeStoredMacros(rawMacros) {
  const src = rawMacros && typeof rawMacros === 'object' ? rawMacros : {};
  /** @type {Record<string, UserMacro>} */
  const out = {};
  for (const [id, m] of Object.entries(src)) {
    if (!m || typeof m !== 'object') continue;
    const rawSteps = Array.isArray(m.steps) ? m.steps : (Array.isArray(m.actions) ? m.actions : []);
    /** @type {UserMacro} */
    const macro = {
      id: String(m.id || id),
      label: String(m.label || 'Macro'),
      icon: m.icon,
      steps: rawSteps.map(normalizeMacroStep).filter(Boolean),
      createdAt: Number.isFinite(m.createdAt) ? m.createdAt : nowMs(),
      updatedAt: Number.isFinite(m.updatedAt) ? m.updatedAt : nowMs()
    };
    if (m.baseStockMacroId) macro.baseStockMacroId = String(m.baseStockMacroId);
    out[id] = macro;
  }
  return out;
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
        macros: normalizeStoredMacros(stored.macros),
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
  /** @type {Record<string, SlotAssignment|null>} */
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
    builtIn: false,
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
    builtIn: false,
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
 * Create a new, empty macro (no steps yet — add some with {@link addUserMacroStep}).
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
    steps: [],
    createdAt: t,
    updatedAt: t
  };
  st.macros[id] = macro;
  await setKeyboardLayoutStore(st);
  return macro;
}

/**
 * @param {string} id
 * @returns {Promise<UserMacro|null>}
 */
export async function getUserMacroById(id) {
  const st = await getKeyboardLayoutStore();
  const key = String(id || '');
  const m = st.macros && st.macros[key] ? st.macros[key] : null;
  return m || null;
}

/**
 * @param {UserMacro} macro
 * @returns {Promise<UserMacro|null>}
 */
export async function upsertUserMacro(macro) {
  if (!macro?.id) return null;
  const st = await getKeyboardLayoutStore();
  const t = nowMs();
  const prev = st.macros && st.macros[macro.id] ? st.macros[macro.id] : null;
  /** @type {UserMacro} */
  const m = {
    id: String(macro.id),
    label: String(macro.label || prev?.label || 'Macro'),
    icon: macro.icon ?? prev?.icon,
    steps: (Array.isArray(macro.steps) ? macro.steps : (prev?.steps || [])).map(normalizeMacroStep).filter(Boolean),
    createdAt: Number.isFinite(prev?.createdAt) ? prev.createdAt : (Number.isFinite(macro.createdAt) ? macro.createdAt : t),
    updatedAt: t
  };
  const baseStock = macro.baseStockMacroId ?? prev?.baseStockMacroId;
  if (baseStock) m.baseStockMacroId = String(baseStock);
  if (!st.macros || typeof st.macros !== 'object') st.macros = {};
  st.macros[m.id] = m;
  await setKeyboardLayoutStore(st);
  return m;
}

/**
 * Fork a stock macro into an editable user macro (`baseStockMacroId` preserved).
 * @param {string} stockMacroId
 * @param {{ label?: string }} [params]
 * @returns {Promise<UserMacro|null>}
 */
export async function forkStockMacroToUser(stockMacroId, { label } = {}) {
  const stockId = String(stockMacroId || '');
  if (!isStockMacroId(stockId)) return null;
  const stock = getStockMacroById(stockId);
  if (!stock) return null;
  const st = await getKeyboardLayoutStore();
  const id = genId('macro:');
  const t = nowMs();
  /** @type {UserMacro} */
  const macro = {
    id,
    label: String(label || `${stock.label} (user)`),
    icon: stock.icon || 'placeholder',
    baseStockMacroId: stock.id,
    steps: (stock.steps || []).map((s) => normalizeMacroStep({ ...s })).filter(Boolean),
    createdAt: t,
    updatedAt: t
  };
  if (!st.macros || typeof st.macros !== 'object') st.macros = {};
  st.macros[id] = macro;
  await setKeyboardLayoutStore(st);
  return macro;
}

/**
 * @param {string} id
 */
export async function deleteUserMacro(id) {
  const st = await getKeyboardLayoutStore();
  const key = String(id || '');
  if (!key || !st.macros) return;
  try {
    delete st.macros[key];
  } catch { /* ignore */ }
  await setKeyboardLayoutStore(st);
}

/**
 * Append a Step to a Macro (Function or Logic).
 * @param {string} macroId
 * @param {Partial<MacroStep> & { functionId?: string, parameters?: Record<string, any>, delayMsBefore?: number }} step
 * @returns {Promise<UserMacro|null>} null if the macro is unknown or the step is invalid.
 */
export async function addUserMacroStep(macroId, step) {
  const macro = await getUserMacroById(macroId);
  if (!macro) return null;
  const raw = step && typeof step === 'object' ? { ...step } : {};
  if ((!raw.kind || raw.kind === 'function') && raw.functionId && raw.parameters === undefined) {
    raw.parameters = defaultFunctionParameters(raw.functionId);
  }
  const normalized = normalizeMacroStep(raw);
  if (!normalized) return null;
  return await upsertUserMacro({ ...macro, steps: [...(macro.steps || []), normalized] });
}

/**
 * Patch one Step in place (e.g. update its bound parameters or Logic fields).
 * @param {string} macroId
 * @param {number} index
 * @param {Record<string, any>} patch
 * @returns {Promise<UserMacro|null>}
 */
export async function updateUserMacroStep(macroId, index, patch = {}) {
  const macro = await getUserMacroById(macroId);
  if (!macro || !Array.isArray(macro.steps) || !macro.steps[index]) return null;
  const merged = { ...macro.steps[index], ...patch };
  const normalized = normalizeMacroStep(merged);
  if (!normalized) return null;
  const steps = macro.steps.slice();
  steps[index] = normalized;
  return await upsertUserMacro({ ...macro, steps });
}

/**
 * @param {string} macroId
 * @param {number} index
 * @returns {Promise<UserMacro|null>}
 */
export async function removeUserMacroStep(macroId, index) {
  const macro = await getUserMacroById(macroId);
  if (!macro || !Array.isArray(macro.steps)) return null;
  const steps = macro.steps.filter((_, i) => i !== index);
  return await upsertUserMacro({ ...macro, steps });
}

/**
 * Reorder a Step within its Macro.
 * @param {string} macroId
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {Promise<UserMacro|null>}
 */
export async function moveUserMacroStep(macroId, fromIndex, toIndex) {
  const macro = await getUserMacroById(macroId);
  if (!macro || !Array.isArray(macro.steps) || !macro.steps[fromIndex]) return null;
  const steps = macro.steps.slice();
  const [moved] = steps.splice(fromIndex, 1);
  const clampedTo = Math.max(0, Math.min(toIndex, steps.length));
  steps.splice(clampedTo, 0, moved);
  return await upsertUserMacro({ ...macro, steps });
}

/**
 * Action Instances — a Function bound to specific parameter values, with its own id,
 * independent of any one key slot. This is also how a configured "Macro Key" (built-in
 * keystroke primitives like hotkey/burst/round-robin — see `legacyMacroKeyKind` in
 * function-library.js) is represented: `functionId` is the kind's Function id
 * (`FUNCTION_ID_BY_MACRO_KEY_KIND`) and `parameters` is `{ config }`. There is no separate
 * "macro key" storage — it's just a `UserAction` like any other instantiable Function.
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

/** Deterministic-id prefix for {@link getOrCreateBuiltinFunctionUserAction}. */
const BUILTIN_FUNCTION_ACTION_ID_PREFIX = 'action:builtin:';

/**
 * @param {string} functionId
 * @returns {string}
 */
export function builtinFunctionUserActionId(functionId) {
  return `${BUILTIN_FUNCTION_ACTION_ID_PREFIX}${String(functionId || '')}`;
}

/**
 * Get (creating if needed) the single canonical Action Instance for a built-in Function that is
 * still dispatched via a fixed physical key in `KEYBINDING_ACTION_DEFS`/the built-in layouts
 * (e.g. `SEND_TEXT_TO_AI`, `RECTANGLE_HIGHLIGHT`) rather than a user-assignable
 * `UserKeyboardLayout` slot. There is exactly one meaningful "instance" per such Function id —
 * the fixed key itself is the only slot it can ever occupy today — so its id is deterministic
 * rather than a random uuid, and this is the replacement for the old
 * `settings.actionSettings[actionId]` global-values path (see KEY_ACTION_ARCHITECTURE.md
 * migration table). If/when one of these Functions becomes properly slot-assignable, this same
 * instance is the one a slot would reference.
 *
 * @param {string} functionId
 * @returns {Promise<UserAction|null>}
 */
export async function getOrCreateBuiltinFunctionUserAction(functionId) {
  const def = getFunctionDef(functionId);
  if (!def) return null;
  const id = builtinFunctionUserActionId(def.id);
  const st = await getKeyboardLayoutStore();
  const existing = st.actions && st.actions[id] ? st.actions[id] : null;
  if (existing) return existing;

  const t = nowMs();
  /** @type {UserAction} */
  const action = {
    id,
    functionId: def.id,
    label: def.label,
    parameters: defaultFunctionParameters(def.id),
    createdAt: t,
    updatedAt: t
  };
  if (!st.actions || typeof st.actions !== 'object') st.actions = {};
  st.actions[id] = action;
  await setKeyboardLayoutStore(st);
  return action;
}

/**
 * Persist a single parameter value on a built-in Function's canonical Action Instance (see
 * {@link getOrCreateBuiltinFunctionUserAction}).
 *
 * @param {string} functionId
 * @param {string} paramId
 * @param {any} value
 * @returns {Promise<UserAction|null>}
 */
export async function setBuiltinFunctionUserActionParameter(functionId, paramId, value) {
  const current = await getOrCreateBuiltinFunctionUserAction(functionId);
  if (!current) return null;
  return await upsertUserAction({
    ...current,
    parameters: { ...current.parameters, [paramId]: value }
  });
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
    builtIn: false,
    slots: layout && typeof layout.slots === 'object' ? layout.slots : {},
    createdAt: Number.isFinite(layout?.createdAt) ? layout.createdAt : t,
    updatedAt: t
  };
  st.layouts[l.id] = l;
  await setKeyboardLayoutStore(st);
  return l;
}

/**
 * Assign (or clear) a single slot on a user layout, with Function/slot-key validation.
 * Prefer this over mutating `layout.slots` directly + `upsertUserKeyboardLayout` so the
 * chord-vs-bare-key rule for `worksWhileTyping` Functions (see function-library.js) is always
 * enforced in one place.
 *
 * @param {string} layoutId
 * @param {string} slotKey Bare key label (e.g. "Q") or chord slot key (e.g. "CHORD:CTRL+ALT+Q").
 * @param {SlotAssignment|null} item `null` clears the slot.
 * @returns {Promise<{ ok: boolean, reason?: string, layout?: UserKeyboardLayout }>}
 */
export async function setUserKeyboardLayoutSlot(layoutId, slotKey, item) {
  const key = String(slotKey || '');
  if (!key) return { ok: false, reason: 'Missing slot key.' };

  if (item && item.type === 'function') {
    let functionId = String(item.id || '');
    if (functionId.startsWith('action:')) {
      const instance = await getUserActionById(functionId);
      if (!instance) return { ok: false, reason: 'Action instance not found.' };
      functionId = instance.functionId;
    }
    const check = validateFunctionSlotKey(functionId, key);
    if (!check.ok) return { ok: false, reason: check.reason };
  }

  const layout = await getUserKeyboardLayoutById(layoutId);
  if (!layout) return { ok: false, reason: 'Layout not found.' };

  const slots = { ...(layout.slots && typeof layout.slots === 'object' ? layout.slots : {}) };
  if (item) {
    slots[key] = { type: item.type, id: String(item.id) };
  } else {
    delete slots[key];
  }
  const next = await upsertUserKeyboardLayout({ ...layout, slots });
  return { ok: true, layout: next };
}

/**
 * Duplicate a built-in layout into an editable user layout.
 *
 * @param {{ builtinLayoutId: string, label?: string }} params
 * @returns {Promise<UserKeyboardLayout>}
 */
export async function duplicateBuiltinLayoutToUserLayout({ builtinLayoutId, label } = {}) {
  const baseId = String(builtinLayoutId || '');
  // Include the always-on system layer (KB Reference / Settings) so keycaps that
  // appear on the built-in Keyboard Reference are seeded into the editable copy.
  // `buildKeybindingsForLayout` alone omits those and leaves K / ' empty.
  const { handedness } = inferFamilyAndHandednessFromLayoutId(baseId);
  const kb = buildEffectiveKeybindings(baseId, handedness);
  const uiLayout = getKeyboardUiLayoutForLayout(baseId, { includeNumberRow: true });

  // Seed slots from whatever actions currently appear on the keyboard.
  /** @type {Record<string, SlotAssignment|null>} */
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
        // `item.type === 'action'` here is the built-in KEYBOARD_UI_LAYOUT cell-type enum
        // (keyboard-layouts.js) — an unrelated concept from the `SlotAssignment` type this seeds.
        // Skip (leave the slot empty) for any Function that must run while typing — those may
        // only ever be bound to a modifier chord, never a bare key like these built-in layout
        // seeds always are. None of today's built-in layouts contain one, so this never fires;
        // it's here so a future one fails safe instead of producing an invalid assignment.
        const functionId = String(item.id);
        if (functionWorksWhileTyping(functionId)) continue;
        slots[slot] = { type: 'function', id: functionId };
      }
    }
  }

  const t = nowMs();
  const layout = {
    id: genId('layout:'),
    label: String(label || 'Custom Layout'),
    builtIn: false,
    baseBuiltinLayoutId: baseId,
    slots,
    createdAt: t,
    updatedAt: t
  };
  return await upsertUserKeyboardLayout(layout);
}

/**
 * Duplicate an existing user layout (new id, copied slots/label base).
 *
 * @param {{ source: UserKeyboardLayout, label?: string }} params
 * @returns {Promise<UserKeyboardLayout>}
 */
export async function duplicateUserKeyboardLayout({ source, label } = {}) {
  if (!source || typeof source !== 'object') {
    throw new Error('duplicateUserKeyboardLayout requires a source layout');
  }
  /** @type {Record<string, SlotAssignment|null>} */
  const slots = {};
  try {
    for (const [key, val] of Object.entries(source.slots || {})) {
      if (!key) continue;
      if (val && typeof val === 'object' && val.type && val.id) {
        slots[key] = { type: String(val.type), id: String(val.id) };
      } else {
        slots[key] = null;
      }
    }
  } catch { /* ignore */ }

  const t = nowMs();
  const layout = {
    id: genId('layout:'),
    label: String(label || `${String(source.label || 'Layout').trim() || 'Layout'} copy`),
    builtIn: false,
    baseBuiltinLayoutId: source.baseBuiltinLayoutId
      ? String(source.baseBuiltinLayoutId)
      : undefined,
    slots,
    createdAt: t,
    updatedAt: t
  };
  return await upsertUserKeyboardLayout(layout);
}
