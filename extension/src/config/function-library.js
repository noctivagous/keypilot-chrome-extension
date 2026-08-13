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
 *   // When set, this Function owns `state.mode` while active (toggle / modal).
 *   mode?: string,
 *   // If true, pointerdown dismisses the owned mode through cancelModes (same path as Esc).
 *   cancelOnPointerDown?: boolean,
 *   // What page data this Function reads and when it's captured, and where its result may be
 *   // routed. See KEY_ACTION_ARCHITECTURE.md "Data Acquisition & Result Destinations". Omitted
 *   // for Functions that don't read/produce page data (e.g. NEW_TAB) or haven't been classified
 *   // yet — absence is not meaningful, just "not yet tagged."
 *   // `urlFetch` is a two-stage acquisition (resolve a URL, then network-fetch the resource it
 *   // points to) — see `FETCH_URL_FOR_MEDIA_LIBRARY` and "Fetching vs. linking a URL" in
 *   // KEY_ACTION_ARCHITECTURE.md for why it's its own `dataSource` rather than a flavor of
 *   // `underCursor`.
 *   dataSource?: 'underCursor'|'textRange'|'urlFetch'|'none',
 *   // `file` (arbitrary fetched document — PDF/mp3/mp4/…) is distinct from `media` (an existing
 *   // on-page `<img>`/`<video>` read directly, never fetched over the network).
 *   dataKind?: 'text'|'media'|'file',
 *   destinations?: import('../modules/action-result-delivery.js').ActionResultDestination[]
 * }} FunctionDef
 */

/**
 * Built-in Function ids that must be able to run while a text field is focused, because that is
 * the entire point of the Function (type into it / clipboard in-and-out of it). Kept as an
 * explicit allowlist rather than inferred, since "works while typing" is a safety-relevant
 * property, not a default.
 *
 * `TYPE_CHARACTERS` is a custom catalog entry (not in `KEYBINDING_ACTION_DEFS`) and reads this
 * set on its FunctionDef; built-ins are tagged in `buildBuiltinActionFunctionDefs`.
 * @type {ReadonlySet<string>}
 */
const TEXT_ACTIVE_BUILTIN_FUNCTION_IDS = new Set([
  'TYPE_CHARACTERS'
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
  // Whole-page scan (not under-cursor); opens a tabbed overlay rather than a sink.
  PAGE_MEDIA: Object.freeze({ dataSource: 'none', dataKind: 'media' }),
  OPEN_MEDIA_LIBRARY: Object.freeze({ dataSource: 'none' }),
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
 * Function ids whose canonical Action Instance is a single deterministic
 * `action:builtin:<functionId>` (see `getOrCreateBuiltinFunctionUserAction` in
 * keyboard-layout-store.js), because they're still dispatched via a fixed physical key in
 * `KEYBINDING_ACTION_DEFS`/the built-in layouts rather than a user-assignable
 * `UserKeyboardLayout` slot. Both the KeyPilot hot-key param cache (`BUILTIN_FUNCTION_ACTION_IDS`
 * in keypilot.js) and the Keyboard Layout Config palette (to avoid double-rendering these as
 * freely-placeable Action Instances alongside truly slot-assignable ones like TYPE_CHARACTERS)
 * key off this same list.
 * @type {ReadonlyArray<string>}
 */
export const FIXED_KEY_FUNCTION_IDS = Object.freeze(['SEND_TEXT_TO_AI', 'RECTANGLE_HIGHLIGHT']);

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

/** Category for the low-level data-getter primitives (see "Data Acquisition" below). */
const DATA_FUNCTION_CATEGORY = 'Data';

/** Category for dictionary/definition lookups. */
const LOOKUP_FUNCTION_CATEGORY = 'Lookup';

/** Category for language translation Functions. */
const TRANSLATE_FUNCTION_CATEGORY = 'Translate';

/** Category for Functions whose entire job is rendering something to the user. */
const DISPLAY_FUNCTION_CATEGORY = 'Display';

/** Category for the (design-only until a real sink exists) Media Library Functions. */
const MEDIA_LIBRARY_FUNCTION_CATEGORY = 'Media Library';

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
  dataSource: 'none',
  worksWhileTyping: TEXT_ACTIVE_BUILTIN_FUNCTION_IDS.has('TYPE_CHARACTERS'),
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
      ...(def.mode ? { mode: def.mode } : {}),
      ...(def.cancelOnPointerDown ? { cancelOnPointerDown: true } : {}),
      ...(BUILTIN_FUNCTION_DATA_TAGS[id] || {}),
      ...(BUILTIN_FUNCTION_PARAMETER_OVERRIDES[id] ? { parameters: BUILTIN_FUNCTION_PARAMETER_OVERRIDES[id] } : {})
    });
  }
  return out;
}

/**
 * Data Acquisition + Result Destination example/primitive Functions — see
 * KEY_ACTION_ARCHITECTURE.md, "Data Acquisition & Result Destinations", for the full design.
 *
 * `GET_TEXT_AT_CURSOR` / `GET_TEXT_RANGE` / `GET_MEDIA_AT_CURSOR` are the low-level getters: real,
 * directly key-assignable (each copies its result to the clipboard so it's independently useful
 * today), but their real purpose is as a future macro-builder Step feeding a destination-writer
 * Step — hence the single fixed `clipboard` destination rather than a full `destinations` list.
 * `LOOKUP_WORD` / `TRANSLATE` / `SHOW_POPOVER` are the composed, stock-ready examples built from
 * those same getters. `ADD_URL_TO_MEDIA_LIBRARY` / `FETCH_URL_FOR_MEDIA_LIBRARY` are catalog
 * entries only — their `mediaLibrary` destination has no real sink yet (see
 * `action-result-delivery.js`), so their handler just says so.
 * @returns {Record<string, FunctionDef>}
 */
function buildDataAcquisitionFunctionDefs() {
  const granularityOptions = (ids) => ({
    id: 'granularity',
    label: 'Granularity',
    type: 'enum',
    defaultValue: ids[0],
    options: ids.map((id) => ({
      id,
      label: id === 'word' ? 'Word' : id === 'sentence' ? 'Sentence' : id === 'paragraph' ? 'Paragraph' : 'Hyperlink'
    }))
  });

  return {
    GET_TEXT_AT_CURSOR: Object.freeze({
      id: 'GET_TEXT_AT_CURSOR',
      label: 'Get Text At Cursor',
      description: 'Reads the word, sentence, paragraph, or hyperlink under the cursor and copies it to the clipboard.',
      handler: 'handleGetTextAtCursorKey',
      category: DATA_FUNCTION_CATEGORY,
      dataSource: 'underCursor',
      dataKind: 'text',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.CLIPBOARD]),
      parameters: Object.freeze([Object.freeze(granularityOptions(['word', 'sentence', 'paragraph', 'hyperlink']))])
    }),
    GET_TEXT_RANGE: Object.freeze({
      id: 'GET_TEXT_RANGE',
      label: 'Get Text Range',
      description: 'Reads the current highlight/selection (set up beforehand) and copies it to the clipboard.',
      handler: 'handleGetTextRangeKey',
      category: DATA_FUNCTION_CATEGORY,
      dataSource: 'textRange',
      dataKind: 'text',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.CLIPBOARD])
    }),
    GET_MEDIA_AT_CURSOR: Object.freeze({
      id: 'GET_MEDIA_AT_CURSOR',
      label: 'Get Media At Cursor',
      description: 'Reads the image, video, or audio under the cursor and copies it (or its URL) to the clipboard.',
      handler: 'handleGetMediaAtCursorKey',
      category: DATA_FUNCTION_CATEGORY,
      dataSource: 'underCursor',
      dataKind: 'media',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.CLIPBOARD]),
      parameters: Object.freeze([Object.freeze({
        id: 'kind',
        label: 'Media kind',
        type: 'enum',
        defaultValue: 'image',
        options: Object.freeze([
          Object.freeze({ id: 'image', label: 'Image' }),
          Object.freeze({ id: 'video', label: 'Video' }),
          Object.freeze({ id: 'audio', label: 'Audio' })
        ])
      })])
    }),
    LOOKUP_WORD: Object.freeze({
      id: 'LOOKUP_WORD',
      label: 'Lookup Word',
      description: 'Shows a definition popover for the word under the cursor. No setup required.',
      handler: 'handleLookupWordKey',
      category: LOOKUP_FUNCTION_CATEGORY,
      dataSource: 'underCursor',
      dataKind: 'text',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.POPOVER])
    }),
    TRANSLATE: Object.freeze({
      id: 'TRANSLATE',
      label: 'Translate',
      description: 'Translates the highlighted text (or the word/sentence/paragraph under the cursor if nothing is highlighted).',
      handler: 'handleTranslateKey',
      category: TRANSLATE_FUNCTION_CATEGORY,
      dataSource: 'underCursor',
      dataKind: 'text',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.MODIFY_PAGE, ACTION_RESULT_DESTINATIONS.POPOVER]),
      parameters: Object.freeze([
        Object.freeze(granularityOptions(['sentence', 'word', 'paragraph'])),
        Object.freeze({
          id: 'targetLanguage',
          label: 'Target language',
          type: 'string',
          defaultValue: 'English',
          placeholder: 'e.g. English, Spanish, Japanese…'
        }),
        buildResultDestinationParameter([
          ACTION_RESULT_DESTINATIONS.MODIFY_PAGE,
          ACTION_RESULT_DESTINATIONS.POPOVER
        ])
      ])
    }),
    SHOW_POPOVER: Object.freeze({
      id: 'SHOW_POPOVER',
      label: 'Show Popover',
      description: 'Shows the configured text in a popover — a display primitive for composing into future macro steps.',
      handler: 'handleShowPopoverKey',
      category: DISPLAY_FUNCTION_CATEGORY,
      dataSource: 'none',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.POPOVER]),
      parameters: Object.freeze([Object.freeze({
        id: 'content',
        label: 'Content',
        type: 'string',
        multiline: true,
        defaultValue: '',
        placeholder: 'Text to show in the popover…'
      })])
    }),
    ADD_URL_TO_MEDIA_LIBRARY: Object.freeze({
      id: 'ADD_URL_TO_MEDIA_LIBRARY',
      label: 'Add URL to Media Library',
      description: 'Stores the hyperlink under the cursor itself (its href) — does not download anything. Media Library is not built yet.',
      handler: 'handleMediaLibraryNotAvailableKey',
      category: MEDIA_LIBRARY_FUNCTION_CATEGORY,
      dataSource: 'underCursor',
      dataKind: 'text',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY])
    }),
    FETCH_URL_FOR_MEDIA_LIBRARY: Object.freeze({
      id: 'FETCH_URL_FOR_MEDIA_LIBRARY',
      label: 'Fetch URL for Media Library',
      description: 'Fetches the resource the hyperlink under the cursor points to (e.g. a .pdf/.mp3/.mp4) to store it. Media Library is not built yet.',
      handler: 'handleMediaLibraryNotAvailableKey',
      category: MEDIA_LIBRARY_FUNCTION_CATEGORY,
      dataSource: 'urlFetch',
      dataKind: 'file',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY])
    })
  };
}

/**
 * The unified Function Library: built-in stock Functions + keystroke-primitive Functions +
 * new customizable Functions, keyed by Function id.
 * @type {Readonly<Record<string, FunctionDef>>}
 */
export const FUNCTION_LIBRARY = Object.freeze({
  ...buildBuiltinActionFunctionDefs(),
  ...buildKeystrokeFunctionDefs(),
  [TYPE_CHARACTERS_FUNCTION_DEF.id]: TYPE_CHARACTERS_FUNCTION_DEF,
  ...buildDataAcquisitionFunctionDefs()
});

/** Stable category display order for the Functions browser. */
export const FUNCTION_CATEGORY_ORDER = Object.freeze([
  'Navigation',
  'Tab Control',
  'Begin URL',
  'Get Page Data',
  'Scroll',
  'Select',
  'Clipboard',
  TEXT_FUNCTION_CATEGORY,
  KEYSTROKE_FUNCTION_CATEGORY,
  DATA_FUNCTION_CATEGORY,
  LOOKUP_FUNCTION_CATEGORY,
  TRANSLATE_FUNCTION_CATEGORY,
  DISPLAY_FUNCTION_CATEGORY,
  MEDIA_LIBRARY_FUNCTION_CATEGORY,
  'AI',
  'KeyPilot',
  'Tools',
  'System',
  'Other'
]);

/**
 * Preferred within-category order for Actions Library cards/table.
 * Unlisted Function ids sort after these (by label).
 * @type {Readonly<Record<string, number>>}
 */
export const FUNCTION_LIBRARY_ITEM_ORDER = Object.freeze({
  // Navigation
  ACTIVATE: 10,
  ACTIVATE_NEW_TAB: 20,
  ACTIVATE_NEW_TAB_BACKGROUND: 30,
  PREVIEW_LINK_POPOVER: 40,
  OPEN_POPOVER: 50,
  FORWARD: 60,
  BACK: 70,
  BACK2: 80,
  ROOT: 90,
  // Tab Control
  CLOSE_TAB: 110,
  TAB_LEFT: 120,
  TAB_RIGHT: 130,
  NEW_TAB: 140,
  TAB_HISTORY: 150,
  // Begin URL
  LAUNCHER: 160,
  OMNIBOX: 170,
  // Get Page Data
  COPY_HOVERED_IMAGE: 200,
  PAGE_MEDIA: 205,
  RECTANGLE_HIGHLIGHT: 210,
  HIGHLIGHT: 220,
  // KeyPilot
  TOGGLE_KEYBOARD_HELP: 280,
  OPEN_SETTINGS_POPOVER: 290
});

/**
 * @param {FunctionDef[]} defs
 * @returns {FunctionDef[]}
 */
export function sortFunctionDefsForLibrary(defs) {
  return [...(defs || [])].sort((a, b) => {
    const oa = FUNCTION_LIBRARY_ITEM_ORDER[a?.id] ?? 10000;
    const ob = FUNCTION_LIBRARY_ITEM_ORDER[b?.id] ?? 10000;
    if (oa !== ob) return oa - ob;
    return String(a?.label || a?.id || '').localeCompare(String(b?.label || b?.id || ''));
  });
}

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
 * True when some Function owns this `state.mode` and opted into pointerdown dismiss.
 * @param {string|null|undefined} mode
 * @returns {boolean}
 */
export function functionCancelsOnPointerDown(mode) {
  const m = String(mode || '');
  if (!m || m === 'none') return false;
  for (const def of Object.values(FUNCTION_LIBRARY)) {
    if (def?.mode === m && def.cancelOnPointerDown) return true;
  }
  return false;
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
