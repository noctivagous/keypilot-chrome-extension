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
import { isChordSlotKey } from '../utils/key-chord.js';
import { ACTION_RESULT_DESTINATIONS, buildResultDestinationParameter } from '../modules/action-result-delivery.js';

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
 *   // Set when this FunctionDef was generalized from a legacy MacroKeyKind (macro-keys.js),
 *   // so `defaultFunctionParameters`/`normalizeFunctionParameters` below can delegate to that
 *   // kind's `{ config }` shape instead of the generic per-field FunctionParameterDef schema.
 *   legacyMacroKeyKind?: import('./macro-keys.js').MacroKeyKind,
 *   // True iff this Function must be able to fire while a text-entry element is focused
 *   // (e.g. it types into, or reads/writes the clipboard of, that very field). Functions with
 *   // this flag may ONLY be bound to a modifier-chord slot (see ../utils/key-chord.js), never
 *   // a bare key — see KEY_ACTION_ARCHITECTURE.md "Text-active Functions & modifier-chord
 *   // assignment" for why a bare key would either never fire (typing-safety gate) or hijack
 *   // normal typing.
 *   worksWhileTyping?: boolean,
 *   // What page data this Function reads and when it's captured, and where its result may be
 *   // routed. See KEY_ACTION_ARCHITECTURE.md "Data Acquisition & Result Destinations". Omitted
 *   // for Functions that don't read/produce page data (e.g. NEW_TAB) or haven't been classified
 *   // yet — absence is not meaningful, just "not yet tagged."
 *   dataSource?: 'underCursor'|'textRange'|'none',
 *   dataKind?: 'text'|'media',
 *   destinations?: import('../modules/action-result-delivery.js').ActionResultDestination[]
 * }} FunctionDef
 */

/**
 * Built-in Function ids that must be able to run while a text field is focused, because that is
 * the entire point of the Function (type into it / clipboard in-and-out of it). Kept as an
 * explicit allowlist rather than inferred, since "works while typing" is a safety-relevant
 * property, not a default.
 * @type {ReadonlySet<string>}
 */
const TEXT_ACTIVE_BUILTIN_FUNCTION_IDS = new Set([
  'CLIPBOARD_COPY',
  'CLIPBOARD_CUT',
  'CLIPBOARD_PASTE',
  'CLIPBOARD_SELECT_ALL'
]);

/**
 * Data acquisition classification for existing built-in Functions that read/produce page data.
 * Functions not listed here simply omit `dataSource`/`dataKind` ("not yet tagged"), rather than
 * defaulting to `'none'` — most of `KEYBINDING_ACTION_DEFS` (navigation, tab management, clicks)
 * genuinely reads no page *data* in the sense this taxonomy cares about.
 *
 * `destinations` is left unset here even for `COPY_HOVERED_IMAGE`: the classification is accurate
 * today, but there is only one working sink (the clipboard) — no `destination` parameter or
 * Media Library sink exists yet, so listing it would advertise a control that doesn't work.
 * See KEY_ACTION_ARCHITECTURE.md, "Data Acquisition & Result Destinations".
 * @type {Readonly<Record<string, Partial<Pick<FunctionDef, 'dataSource'|'dataKind'>>>>}
 */
const BUILTIN_FUNCTION_DATA_TAGS = Object.freeze({
  COPY_HOVERED_IMAGE: Object.freeze({ dataSource: 'underCursor', dataKind: 'media' }),
  SEND_TEXT_TO_AI: Object.freeze({
    dataSource: 'textRange',
    dataKind: 'text',
    destinations: Object.freeze([
      ACTION_RESULT_DESTINATIONS.CLIPBOARD,
      ACTION_RESULT_DESTINATIONS.POPOVER,
      ACTION_RESULT_DESTINATIONS.BOTH
    ])
  }),
  CLIPBOARD_COPY: Object.freeze({ dataSource: 'none' }),
  CLIPBOARD_CUT: Object.freeze({ dataSource: 'none' }),
  CLIPBOARD_PASTE: Object.freeze({ dataSource: 'none' }),
  CLIPBOARD_SELECT_ALL: Object.freeze({ dataSource: 'none' })
});

/**
 * Parameter schema for built-in Functions that used to declare their schema only in
 * `ACTION_SETTINGS_REGISTRY` (`key-action-settings.js`), with values stored globally per action
 * id in `settings.actionSettings[actionId]`. Moved here so `FunctionDef.parameters` is the single
 * schema source; values now live on a canonical `UserAction` per Function id (see
 * `getOrCreateBuiltinFunctionUserAction` in `keyboard-layout-store.js`) instead of global
 * settings — see KEY_ACTION_ARCHITECTURE.md migration table.
 *
 * `RECTANGLE_HIGHLIGHT`'s old "modes" concept (a button-group switch, not a form field) is
 * represented as a plain `enum` parameter named `mode` — `key-action-settings.js` special-cases a
 * parameter literally named `mode` to keep rendering it as the button-group switch it always was.
 * @type {Readonly<Record<string, FunctionDef['parameters']>>}
 */
const BUILTIN_FUNCTION_PARAMETER_OVERRIDES = Object.freeze({
  RECTANGLE_HIGHLIGHT: Object.freeze([
    Object.freeze({
      id: 'mode',
      label: 'Selection mode',
      type: 'enum',
      defaultValue: 'element',
      options: Object.freeze([
        Object.freeze({ id: 'element', label: 'Element rectangle' }),
        Object.freeze({ id: 'cumulative', label: 'Pick cumulative' })
      ])
    })
  ]),
  SEND_TEXT_TO_AI: Object.freeze([
    Object.freeze({
      id: 'prompt',
      label: 'Instruction',
      type: 'string',
      multiline: true,
      defaultValue: 'Translate to English',
      placeholder: 'e.g. Translate to English'
    }),
    buildResultDestinationParameter([
      ACTION_RESULT_DESTINATIONS.CLIPBOARD,
      ACTION_RESULT_DESTINATIONS.POPOVER,
      ACTION_RESULT_DESTINATIONS.BOTH
    ])
  ])
});

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
  worksWhileTyping: true,
  dataSource: 'none',
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
      keyboardClass: def.keyboardClass ?? null,
      // No `parameters` by default: most built-ins remain simple/non-instantiable Functions.
      // A few (SEND_TEXT_TO_AI, RECTANGLE_HIGHLIGHT) get their schema below from
      // BUILTIN_FUNCTION_PARAMETER_OVERRIDES — see KEY_ACTION_ARCHITECTURE.md "Migration mapping".
      ...(TEXT_ACTIVE_BUILTIN_FUNCTION_IDS.has(id) ? { worksWhileTyping: true } : {}),
      ...(BUILTIN_FUNCTION_DATA_TAGS[id] || {}),
      ...(BUILTIN_FUNCTION_PARAMETER_OVERRIDES[id] ? { parameters: BUILTIN_FUNCTION_PARAMETER_OVERRIDES[id] } : {})
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

/**
 * True when this Function must be able to fire while a text-entry element is focused, and
 * therefore may only be bound to a modifier-chord slot (never a bare key).
 * @param {string} functionId
 * @returns {boolean}
 */
export function functionWorksWhileTyping(functionId) {
  return !!getFunctionDef(functionId)?.worksWhileTyping;
}

/**
 * @param {string} functionId
 * @returns {'underCursor'|'textRange'|'none'|null} null when not yet classified.
 */
export function getFunctionDataSource(functionId) {
  return getFunctionDef(functionId)?.dataSource ?? null;
}

/**
 * @param {string} functionId
 * @returns {'text'|'media'|null} null when not yet classified.
 */
export function getFunctionDataKind(functionId) {
  return getFunctionDef(functionId)?.dataKind ?? null;
}

/**
 * Validate that a Function is being bound to an appropriate kind of slot key.
 *
 * - `worksWhileTyping` Functions MUST go on a chord slot key (`CHORD:CTRL+ALT+Q`), never a bare
 *   key — a bare key would either be silently swallowed by KeyPilot's typing-safety gate (never
 *   fires while the field it's meant to act on is focused) or, if that gate were bypassed, would
 *   hijack normal typing.
 * - Non-`worksWhileTyping` Functions may go on either (chord slots are optional/allowed, e.g. a
 *   user may still prefer a chord for a normal navigation action; only the reverse is forbidden).
 *
 * @param {string} functionId
 * @param {string} slotKey
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateFunctionSlotKey(functionId, slotKey) {
  const def = getFunctionDef(functionId);
  if (!def) return { ok: false, reason: `Unknown Function: ${functionId}` };
  if (def.worksWhileTyping && !isChordSlotKey(slotKey)) {
    return {
      ok: false,
      reason: `"${def.label}" must run while a text field is focused, so it can only be bound to a modifier-key combination (e.g. Ctrl+Alt+…), not a plain key.`
    };
  }
  return { ok: true };
}
