/**
 * Function Library — the unified catalog of reusable operations ("Functions") that back
 * every Key Action and (future) Macro step.
 *
 * See KEY_ACTION_ARCHITECTURE.md for the full vocabulary/data-model writeup. Summary:
 * - A "Function" is a catalog entry: id + handler + optional parameter schema. It has no
 *   identity of its own beyond its definition.
 * - A "Key Action" is whatever occupies a layout slot: either a bare/instantiated Function
 *   reference (`{ type: 'function', functionId, instanceId? }`) or a Macro reference.
 * - An "Action Instance" (`UserAction`, see keyboard-layout-store.js) is a Function bound to
 *   specific parameter values, with its own id, independent of any one key — this is what lets
 *   two different keys use e.g. TYPE_CHARACTERS with different text.
 *
 * This module intentionally *wraps* the pre-existing catalogs (`KEYBINDING_ACTION_DEFS` in
 * keyboard-layouts.js, `MACRO_KEY_KIND_DEFS` in macro-keys.js) rather than replacing them, so
 * existing consumers keep working unchanged while new code can consume one merged catalog.
 */

import {
  KEYBINDING_ACTION_DEFS,
  KEYBINDING_ACTION_CATEGORY_BY_ID
} from './keyboard-layouts.js';
import {
  MACRO_KEY_KIND_DEFS,
  defaultMacroKeyConfig,
  normalizeMacroKeyConfig,
  summarizeMacroKey
} from './macro-keys.js';

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   type: 'boolean'|'number'|'string'|'enum',
 *   defaultValue?: any,
 *   options?: Array<{ id: string, label: string }>,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   multiline?: boolean,
 *   placeholder?: string
 * }} FunctionParameterDef
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   description: string,
 *   handler: string,
 *   category: string,
 *   keyboardClass?: string|null,
 *   // Present (non-empty) iff this Function can/must be bound to per-instance values.
 *   parameters?: FunctionParameterDef[],
 *   // Set when this FunctionDef was generalized from a legacy MacroKeyKind, so the
 *   // Action Store can keep reading/writing old `UserMacroKey` records during migration.
 *   legacyMacroKeyKind?: import('./macro-keys.js').MacroKeyKind
 * }} FunctionDef
 */

/** Category used for Functions generalized from macro-key kinds. */
const KEYSTROKE_FUNCTION_CATEGORY = 'Keystrokes';

/** Category used for new customizable text-entry style Functions. */
const TEXT_FUNCTION_CATEGORY = 'Type';

/**
 * id mapping: legacy MacroKeyKind -> unified Function id.
 * @type {Readonly<Record<import('./macro-keys.js').MacroKeyKind, string>>}
 */
export const FUNCTION_ID_BY_MACRO_KEY_KIND = Object.freeze({
  hotkey: 'SEND_HOTKEY',
  burst: 'SEND_BURST',
  roundRobin: 'CYCLE_ROUND_ROBIN',
  continuous: 'HOLD_CONTINUOUS',
  mouse: 'CLICK_MOUSE_BUTTON',
  key: 'REMAP_KEY'
});

/** Reverse of {@link FUNCTION_ID_BY_MACRO_KEY_KIND}. @type {Readonly<Record<string, import('./macro-keys.js').MacroKeyKind>>} */
const MACRO_KEY_KIND_BY_FUNCTION_ID = Object.freeze(
  Object.fromEntries(Object.entries(FUNCTION_ID_BY_MACRO_KEY_KIND).map(([k, v]) => [v, k]))
);

/**
 * Build the Functions generalized from `MACRO_KEY_KIND_DEFS`. Each keeps its `legacyMacroKeyKind`
 * so config/summary/default logic can keep delegating to `macro-keys.js` until that module's
 * per-kind logic is folded in directly.
 * @returns {Record<string, FunctionDef>}
 */
function buildKeystrokeFunctionDefs() {
  /** @type {Record<string, FunctionDef>} */
  const out = {};
  for (const kindDef of MACRO_KEY_KIND_DEFS) {
    const functionId = FUNCTION_ID_BY_MACRO_KEY_KIND[kindDef.id];
    if (!functionId) continue;
    out[functionId] = Object.freeze({
      id: functionId,
      label: kindDef.label,
      description: kindDef.description,
      handler: 'handleLegacyMacroKeyFunction',
      category: KEYSTROKE_FUNCTION_CATEGORY,
      keyboardClass: kindDef.keyboardClass,
      // Non-empty sentinel so isFunctionInstantiable() is true; the actual per-field schema
      // for these kinds lives in macro-keys.js's kind-specific config shapes (steps[], stroke, …)
      // and isn't representable in the generic FunctionParameterDef shape yet.
      parameters: Object.freeze([
        Object.freeze({ id: 'config', label: 'Configuration', type: 'string' })
      ]),
      legacyMacroKeyKind: kindDef.id
    });
  }
  return out;
}

/** The new customizable "Type Characters" Function — the running example from the design doc. */
const TYPE_CHARACTERS_FUNCTION_DEF = Object.freeze({
  id: 'TYPE_CHARACTERS',
  label: 'Type Characters',
  description: 'Types configured text into the focused field each time the key is pressed. ' +
    'Assign this Function to multiple keys, each with its own text.',
  handler: 'handleTypeCharactersKey',
  category: TEXT_FUNCTION_CATEGORY,
  keyboardClass: 'key-purple',
  parameters: Object.freeze([
    Object.freeze({
      id: 'text',
      label: 'Text to type',
      type: 'string',
      multiline: true,
      defaultValue: '',
      placeholder: 'e.g. your email address, a signature, a snippet…'
    })
  ])
});

/**
 * Build the Functions generalized from the built-in, historically-parameterless action defs.
 * @returns {Record<string, FunctionDef>}
 */
function buildBuiltinActionFunctionDefs() {
  /** @type {Record<string, FunctionDef>} */
  const out = {};
  for (const [id, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    out[id] = Object.freeze({
      id,
      label: def.label,
      description: def.description,
      handler: def.handler,
      category: KEYBINDING_ACTION_CATEGORY_BY_ID[id] || 'Other',
      keyboardClass: def.keyboardClass ?? null
      // No `parameters`: these remain simple/non-instantiable Functions. (SEND_TEXT_TO_AI's
      // prompt/destination stay on the legacy global ACTION_SETTINGS_REGISTRY path for now —
      // see KEY_ACTION_ARCHITECTURE.md "Migration mapping" for the follow-up to move it here.)
    });
  }
  return out;
}

/**
 * The unified Function Library: built-in stock Functions + keystroke-primitive Functions +
 * new customizable Functions, keyed by Function id.
 * @type {Readonly<Record<string, FunctionDef>>}
 */
export const FUNCTION_LIBRARY = Object.freeze({
  ...buildBuiltinActionFunctionDefs(),
  ...buildKeystrokeFunctionDefs(),
  [TYPE_CHARACTERS_FUNCTION_DEF.id]: TYPE_CHARACTERS_FUNCTION_DEF
});

/** Stable category display order for the Functions browser. */
export const FUNCTION_CATEGORY_ORDER = Object.freeze([
  'Click',
  'Tabs',
  'Navigate',
  'Scroll',
  'Select',
  'Clipboard',
  TEXT_FUNCTION_CATEGORY,
  KEYSTROKE_FUNCTION_CATEGORY,
  'AI',
  'Tools',
  'System',
  'Other'
]);

/**
 * @param {string} functionId
 * @returns {FunctionDef|null}
 */
export function getFunctionDef(functionId) {
  const id = String(functionId || '');
  return (id && FUNCTION_LIBRARY[id]) || null;
}

/** @returns {FunctionDef[]} */
export function listFunctionDefs() {
  return Object.values(FUNCTION_LIBRARY);
}

/**
 * @param {string} functionId
 * @returns {string}
 */
export function getFunctionCategory(functionId) {
  return getFunctionDef(functionId)?.category || 'Other';
}

/**
 * True when this Function's values must live on a per-assignment Action Instance rather than
 * being called bare. (i.e. it has a non-empty parameter schema.)
 * @param {string} functionId
 * @returns {boolean}
 */
export function isFunctionInstantiable(functionId) {
  const def = getFunctionDef(functionId);
  return !!(def?.parameters && def.parameters.length > 0);
}

/**
 * @param {string} functionId
 * @returns {Record<string, any>}
 */
export function defaultFunctionParameters(functionId) {
  const def = getFunctionDef(functionId);
  if (!def) return {};
  if (def.legacyMacroKeyKind) return { config: defaultMacroKeyConfig(def.legacyMacroKeyKind) };
  /** @type {Record<string, any>} */
  const out = {};
  for (const p of def.parameters || []) {
    out[p.id] = p.defaultValue;
  }
  return out;
}

/**
 * Normalize/clamp a parameters object against a Function's schema.
 * @param {string} functionId
 * @param {any} raw
 * @returns {Record<string, any>}
 */
export function normalizeFunctionParameters(functionId, raw) {
  const def = getFunctionDef(functionId);
  if (!def) return {};
  const src = raw && typeof raw === 'object' ? raw : {};

  if (def.legacyMacroKeyKind) {
    return { config: normalizeMacroKeyConfig(def.legacyMacroKeyKind, src.config) };
  }

  const defaults = defaultFunctionParameters(functionId);
  /** @type {Record<string, any>} */
  const out = {};
  for (const p of def.parameters || []) {
    const v = src[p.id];
    switch (p.type) {
      case 'boolean':
        out[p.id] = typeof v === 'boolean' ? v : !!defaults[p.id];
        break;
      case 'number': {
        const n = Number(v);
        out[p.id] = Number.isFinite(n) ? n : defaults[p.id];
        break;
      }
      case 'enum':
        out[p.id] = (p.options || []).some((o) => o.id === v) ? v : defaults[p.id];
        break;
      default:
        out[p.id] = v !== undefined ? String(v) : (defaults[p.id] ?? '');
    }
  }
  return out;
}

/**
 * Short human-readable summary of a bound parameters object, for palette badges.
 * @param {string} functionId
 * @param {Record<string, any>} parameters
 * @returns {string}
 */
export function summarizeFunctionParameters(functionId, parameters) {
  const def = getFunctionDef(functionId);
  if (!def) return '';
  if (def.legacyMacroKeyKind) {
    return summarizeMacroKey({ kind: def.legacyMacroKeyKind, config: parameters?.config });
  }
  if (functionId === 'TYPE_CHARACTERS') {
    const text = String(parameters?.text || '');
    if (!text) return '(empty)';
    return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  }
  return '';
}

/**
 * @param {string} functionId
 * @returns {import('./macro-keys.js').MacroKeyKind|null}
 */
export function macroKeyKindFromFunctionId(functionId) {
  return MACRO_KEY_KIND_BY_FUNCTION_ID[String(functionId || '')] || null;
}
