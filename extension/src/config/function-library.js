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
  KEYBINDING_ACTION_CATEGORY_BY_ID,
  isBuildExcludedKeyAction
} from './keyboard-layouts.js';
import {
  MACRO_KEY_KIND_DEFS,
  defaultMacroKeyConfig,
  normalizeMacroKeyConfig,
  summarizeMacroKey
} from './macro-keys.js';
import { isChordSlotKey } from '../utils/key-chord.js';
import { ACTION_RESULT_DESTINATIONS, buildResultDestinationParameter } from '../modules/action-result-delivery.js';
import { isWordLookupAiAvailable } from '../modules/ai-text-service.js';
import { buildKpDeepLink } from '../utils/kp-deep-link.js';

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
 *   placeholder?: string,
 *   // Optional inspector heading (e.g. "Callbacks") grouping consecutive parameters.
 *   group?: string,
 *   // Textarea row count when `multiline` is true.
 *   rows?: number
 * }} FunctionParameterDef
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   // Short "About" blurb for Actions Library key-action cards (keep concise).
 *   description: string,
 *   // Longer inspector Description; shown in the Actions Library dock, not on cards.
 *   details?: string,
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
   *   // Optional mouse-button mapping onto this Function (layouts still own keyboard assignment).
   *   // Gated by `enabledSetting` (a dotted path on KeyPilot settings, e.g. scroll.middleClickScrollLine).
   *   pointerBinding?: {
   *     button: 'left'|'middle'|'right',
   *     yieldToClickables?: boolean,
   *     yieldToTextEntry?: boolean,
   *     yieldToModes?: string[],
   *     enabledSetting?: string
   *   },
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
 *   destinations?: import('../modules/action-result-delivery.js').ActionResultDestination[],
 *   // False when this Function is a Macro Step / result-routing primitive, not a key action.
 *   // Omitted or true: browsable and placeable in the Actions Library. Runtime still accepts
 *   // leftover key bindings so existing layouts keep working.
 *   assignableToKey?: boolean,
 *   // In-extension docs deep link (kp://docs/<topic>[#hash]) for the Inspector docs icon.
 *   docsUrl?: string
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
 * `COPY_HOVERED_IMAGE` / `COPY_HOVERED_URL` advertise clipboard (default), Media Library,
 * and Both. `COPY_HOVERED_VIDEO` defaults to Media Library (save bytes when fetchable);
 * clipboard destinations copy the video URL.
 */
const CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS = Object.freeze([
  ACTION_RESULT_DESTINATIONS.CLIPBOARD,
  ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY,
  ACTION_RESULT_DESTINATIONS.CLIPBOARD_AND_MEDIA_LIBRARY
]);

/** Copy Video: Media Library first (file bytes when fetchable), then Both, then clipboard URL. */
const VIDEO_COPY_DESTINATIONS = Object.freeze([
  ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY,
  ACTION_RESULT_DESTINATIONS.CLIPBOARD_AND_MEDIA_LIBRARY,
  ACTION_RESULT_DESTINATIONS.CLIPBOARD
]);

/** @type {Readonly<Record<string, Partial<Pick<FunctionDef, 'dataSource'|'dataKind'|'destinations'>>>>} */

const BUILTIN_FUNCTION_DATA_TAGS = Object.freeze({
  COPY_HOVERED_IMAGE: Object.freeze({
    dataSource: 'underCursor',
    dataKind: 'media',
    destinations: CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS
  }),
  COPY_HOVERED_URL: Object.freeze({
    dataSource: 'underCursor',
    dataKind: 'text',
    destinations: CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS
  }),
  POI_WEBSITE: Object.freeze({
    dataSource: 'underCursor',
    dataKind: 'text'
  }),
  POI_ADDRESS: Object.freeze({
    dataSource: 'underCursor',
    dataKind: 'text',
    destinations: Object.freeze([
      ACTION_RESULT_DESTINATIONS.CLIPBOARD,
      ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY
    ])
  }),
  COPY_HOVERED_VIDEO: Object.freeze({
    dataSource: 'underCursor',
    dataKind: 'media',
    destinations: VIDEO_COPY_DESTINATIONS
  }),
  FONT_INFO: Object.freeze({
    dataSource: 'underCursor',
    dataKind: 'text',
    destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.POPOVER])
  }),
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
  CLIPBOARD_SELECT_ALL: Object.freeze({ dataSource: 'none' }),
  SELECT_WORD: Object.freeze({ dataSource: 'underCursor', dataKind: 'text' }),
  SELECT_SENTENCE: Object.freeze({ dataSource: 'underCursor', dataKind: 'text' }),
  SELECT_PARAGRAPH: Object.freeze({ dataSource: 'underCursor', dataKind: 'text' }),
  SELECT_IMAGE: Object.freeze({ dataSource: 'underCursor', dataKind: 'media' })
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
export const FIXED_KEY_FUNCTION_IDS = Object.freeze([
  'SEND_TEXT_TO_AI',
  'RECTANGLE_HIGHLIGHT',
  'HIGHLIGHT',
  'COPY_HOVERED_IMAGE',
  'COPY_HOVERED_URL',
  'COPY_HOVERED_VIDEO',
  'POI_ADDRESS',
  'PAGE_TOP',
  'PAGE_BOTTOM',
  'PREVIEW_LINK_POPOVER',
  'OPEN_POPOVER'
]);

/**
 * Placeable Clipboard select Functions. Exclusive/Cumulative lives on the key-info popover
 * (canonical `action:builtin:<id>`), not on per-key Action Instances.
 * @type {ReadonlyArray<string>}
 */
export const UNIT_SELECT_FUNCTION_IDS = Object.freeze([
  'SELECT_WORD',
  'SELECT_SENTENCE',
  'SELECT_PARAGRAPH',
  'SELECT_IMAGE'
]);

/**
 * Parameter schema for built-in Functions that used to declare their schema only in
 * `ACTION_SETTINGS_REGISTRY` (`key-action-settings.js`), with values stored globally per action
 * id in `settings.actionSettings[actionId]`. Moved here so `FunctionDef.parameters` is the single
 * schema source; values now live on a canonical `UserAction` per Function id (see
 * `getOrCreateBuiltinFunctionUserAction` in `keyboard-layout-store.js`) instead of global
 * settings — see KEY_ACTION_ARCHITECTURE.md migration table.
 *
 * `RECTANGLE_HIGHLIGHT` / `HIGHLIGHT` "modes" (a button-group switch, not a form field) are
 * represented as a plain `enum` parameter named `mode` — `key-action-settings.js` special-cases a
 * parameter literally named `mode` to keep rendering it as the button-group switch it always was.
 * `PAGE_TOP` / `PAGE_BOTTOM` use the same `mode` switch for Fade vs Scroll.
 */
/** Shared by Scroll To Top / Scroll To Bottom (inlined as the key-info `mode` switch). */
const EDGE_SCROLL_PARAMETERS = Object.freeze([
  Object.freeze({
    id: 'mode',
    label: 'Jump style',
    type: 'enum',
    defaultValue: 'fade',
    options: Object.freeze([
      Object.freeze({ id: 'fade', label: 'Fade' }),
      Object.freeze({ id: 'smooth', label: 'Scroll' })
    ])
  })
]);

/** Shared by Select Word / Sentence / Paragraph / Image (key-info Exclusive | Cumulative switch). */
const UNIT_SELECT_MODE_PARAMETERS = Object.freeze([
  Object.freeze({
    id: 'mode',
    label: 'Selection mode',
    type: 'enum',
    defaultValue: 'exclusive',
    options: Object.freeze([
      Object.freeze({ id: 'exclusive', label: 'Exclusive' }),
      Object.freeze({ id: 'cumulative', label: 'Cumulative' })
    ])
  })
]);

/** @type {Readonly<Record<string, FunctionDef['parameters']>>} */
const BUILTIN_FUNCTION_PARAMETER_OVERRIDES = Object.freeze({
  PAGE_TOP: EDGE_SCROLL_PARAMETERS,
  PAGE_BOTTOM: EDGE_SCROLL_PARAMETERS,
  SELECT_WORD: UNIT_SELECT_MODE_PARAMETERS,
  SELECT_SENTENCE: UNIT_SELECT_MODE_PARAMETERS,
  SELECT_PARAGRAPH: UNIT_SELECT_MODE_PARAMETERS,
  SELECT_IMAGE: UNIT_SELECT_MODE_PARAMETERS,
  HIGHLIGHT: Object.freeze([
    Object.freeze({
      id: 'mode',
      label: 'Copy as',
      type: 'enum',
      defaultValue: 'rich',
      options: Object.freeze([
        Object.freeze({ id: 'rich', label: 'Rich text' }),
        Object.freeze({ id: 'plain', label: 'Plain text' })
      ])
    })
  ]),
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
  ]),
  COPY_HOVERED_IMAGE: Object.freeze([
    buildResultDestinationParameter(CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS)
  ]),
  COPY_HOVERED_URL: Object.freeze([
    buildResultDestinationParameter(CLIPBOARD_OR_MEDIA_LIBRARY_DESTINATIONS)
  ]),
  COPY_HOVERED_VIDEO: Object.freeze([
    buildResultDestinationParameter(VIDEO_COPY_DESTINATIONS)
  ]),
  POI_ADDRESS: Object.freeze([
    Object.freeze({
      id: 'action',
      label: 'Action',
      type: 'enum',
      defaultValue: 'copy',
      options: Object.freeze([
        Object.freeze({ id: 'copy', label: 'Copy address' })
      ])
    }),
    Object.freeze({
      id: 'format',
      label: 'Format',
      type: 'enum',
      defaultValue: 'txt',
      options: Object.freeze([
        Object.freeze({ id: 'txt', label: 'Txt' }),
        Object.freeze({ id: 'vcard', label: 'vCard' })
      ])
    }),
    buildResultDestinationParameter([
      ACTION_RESULT_DESTINATIONS.CLIPBOARD,
      ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY
    ])
  ])
});

/**
 * kp:// docs target for a Function. Topic pages when they exist; Functions & Actions
 * headings otherwise. Unknown ids fall back to the Functions overview.
 * @param {string} topicId
 * @param {string} [hash]
 * @returns {string}
 */
function docsUrl(topicId, hash) {
  return buildKpDeepLink({ kind: 'docs', id: topicId, ...(hash ? { hash } : {}) });
}

/** @type {Readonly<Record<string, string>>} */
const FUNCTION_DOCS_URL_BY_ID = Object.freeze({
  ACTIVATE: docsUrl('browsing-click'),
  ACTIVATE_NEW_TAB: docsUrl('browsing-click'),
  ACTIVATE_NEW_TAB_BACKGROUND: docsUrl('browsing-click'),
  PREVIEW_LINK_POPOVER: docsUrl('tools-previews'),
  OPEN_POPOVER: docsUrl('tools-previews'),
  FORWARD: docsUrl('browsing-tabs'),
  BACK: docsUrl('browsing-tabs'),
  BACK2: docsUrl('browsing-tabs'),
  ROOT: docsUrl('browsing-tabs'),
  CLOSE_TAB: docsUrl('browsing-tabs'),
  TAB_LEFT: docsUrl('browsing-tabs'),
  TAB_RIGHT: docsUrl('browsing-tabs'),
  NEW_TAB: docsUrl('browsing-tabs'),
  TAB_HISTORY: docsUrl('tools-tab-history'),
  PAGE_UP_INSTANT: docsUrl('browsing-scroll'),
  PAGE_DOWN_INSTANT: docsUrl('browsing-scroll'),
  PAGE_TOP: docsUrl('browsing-scroll'),
  PAGE_BOTTOM: docsUrl('browsing-scroll'),
  SCROLL_LINE: docsUrl('browsing-scroll'),
  HIGHLIGHT: docsUrl('browsing-select'),
  RECTANGLE_HIGHLIGHT: docsUrl('browsing-select'),
  COPY_HOVERED_IMAGE: docsUrl('media-copy'),
  COPY_HOVERED_URL: docsUrl('media-copy'),
  COPY_HOVERED_VIDEO: docsUrl('media-copy'),
  FONT_INFO: docsUrl('functions', 'font-info'),
  PAGE_MEDIA: docsUrl('media-page'),
  DELETE: docsUrl('browsing-modes'),
  COLS_TOGGLE: docsUrl('browsing-modes'),
  OPEN_MEDIA_LIBRARY: docsUrl('media-library'),
  CLIPBOARD_COPY: docsUrl('browsing-select'),
  CLIPBOARD_CUT: docsUrl('browsing-select'),
  CLIPBOARD_PASTE: docsUrl('browsing-select'),
  CLIPBOARD_SELECT_ALL: docsUrl('browsing-select'),
  SELECT_WORD: docsUrl('browsing-select'),
  SELECT_SENTENCE: docsUrl('browsing-select'),
  SELECT_PARAGRAPH: docsUrl('browsing-select'),
  SELECT_IMAGE: docsUrl('browsing-select'),
  SEND_TEXT_TO_AI: docsUrl('functions', 'send-text-to-ai'),
  LAUNCHER: docsUrl('tools-launcher'),
  TOP_SITES: docsUrl('tools-top-sites'),
  OMNIBOX: docsUrl('tools-omnibox'),
  TOGGLE_KEYBOARD_HELP: docsUrl('keyboard-reference'),
  OPEN_SETTINGS_POPOVER: docsUrl('settings'),
  CANCEL: docsUrl('browsing-modes'),
  POI_WEBSITE: docsUrl('functions', 'poi'),
  POI_ADDRESS: docsUrl('functions', 'poi'),
  TYPE_CHARACTERS: docsUrl('functions', 'type-characters'),
  EXECUTE_JS: docsUrl('execute-js'),
  GET_TEXT_AT_CURSOR: docsUrl('functions', 'get-text-at-cursor'),
  GET_TEXT_RANGE: docsUrl('functions', 'get-text-at-cursor'),
  GET_MEDIA_AT_CURSOR: docsUrl('functions', 'get-text-at-cursor'),
  LOOKUP_WORD: docsUrl('functions', 'lookup-word'),
  TRANSLATE: docsUrl('functions', 'translate'),
  SHOW_POPOVER: docsUrl('functions', 'show-popover'),
  ADD_URL_TO_MEDIA_LIBRARY: docsUrl('functions', 'media-library-functions'),
  FETCH_URL_FOR_MEDIA_LIBRARY: docsUrl('functions', 'media-library-functions'),
  SEND_HOTKEY: docsUrl('functions', 'keystrokes'),
  SEND_BURST: docsUrl('functions', 'keystrokes'),
  CYCLE_ROUND_ROBIN: docsUrl('functions', 'keystrokes'),
  HOLD_CONTINUOUS: docsUrl('functions', 'keystrokes'),
  CLICK_MOUSE_BUTTON: docsUrl('functions', 'keystrokes'),
  REMAP_KEY: docsUrl('functions', 'keystrokes')
});

const DEFAULT_FUNCTION_DOCS_URL = docsUrl('functions');

/**
 * @param {string} functionId
 * @returns {string}
 */
export function getFunctionDocsUrl(functionId) {
  const id = String(functionId || '');
  return FUNCTION_DOCS_URL_BY_ID[id] || DEFAULT_FUNCTION_DOCS_URL;
}

/**
 * @param {FunctionDef} def
 * @returns {FunctionDef}
 */
function withDocsUrl(def) {
  if (!def || !def.id) return def;
  const url = getFunctionDocsUrl(def.id);
  return Object.freeze({ ...def, docsUrl: url });
}

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

/** Category for user-authored script Functions. */
const SCRIPT_FUNCTION_CATEGORY = 'Script';

/** Category for Media Library Functions (URL ingest and file fetch). */
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
    if (!functionId || isBuildExcludedKeyAction(functionId)) continue;
    out[functionId] = withDocsUrl(Object.freeze({
      id: functionId,
      label: kindDef.label,
      description: kindDef.description,
      ...(kindDef.details ? { details: kindDef.details } : {}),
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
    }));
  }
  return out;
}

/** The new customizable "Type Characters" Function — the running example from the design doc. */
const TYPE_CHARACTERS_FUNCTION_DEF = Object.freeze({
  id: 'TYPE_CHARACTERS',
  label: 'Type Characters',
  description: 'Type saved text into a field',
  details: 'Types configured text into the focused field each time the key is pressed. ' +
    'Create multiple Action Instances of this Function — each with its own text — and place them on different keys.',
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

const EXECUTE_JS_SCRIPT_PLACEHOLDER =
  '// Bindings: kpHoveredClickable, kpHoverLeaf, kpFocusedTextField,\n' +
  '//   kpMode, kpPageUrl, kpSelection, kpPriorResult\n' +
  '// Callbacks (only if checked below): showPopover, copyToClipboard, notify\n' +
  '// Example:\n' +
  '// return kpHoveredClickable && kpHoveredClickable.textContent;';

/** Instantiable Function: user-pasted JS run in the content-script isolated world. */
const EXECUTE_JS_FUNCTION_DEF = Object.freeze({
  id: 'EXECUTE_JS',
  label: 'Execute JS',
  description: 'Run a pasted JS snippet',
  details: 'Runs a pasted JavaScript snippet in the content-script isolated world with the hovered clickable and other page state. ' +
    'Optional callbacks (popover, clipboard, notify) are injected only when checked on the Action Instance.',
  handler: 'handleExecuteJsKey',
  category: SCRIPT_FUNCTION_CATEGORY,
  keyboardClass: 'key-purple',
  dataSource: 'underCursor',
  parameters: Object.freeze([
    Object.freeze({
      id: 'script',
      label: 'Script',
      type: 'string',
      multiline: true,
      rows: 10,
      defaultValue: '',
      placeholder: EXECUTE_JS_SCRIPT_PLACEHOLDER
    }),
    Object.freeze({
      id: 'cbShowPopover',
      label: 'Show result in popover (showPopover)',
      type: 'boolean',
      defaultValue: false,
      group: 'Callbacks'
    }),
    Object.freeze({
      id: 'cbCopyToClipboard',
      label: 'Copy to clipboard (copyToClipboard)',
      type: 'boolean',
      defaultValue: false,
      group: 'Callbacks'
    }),
    Object.freeze({
      id: 'cbNotify',
      label: 'Flash notification (notify)',
      type: 'boolean',
      defaultValue: false,
      group: 'Callbacks'
    })
  ])
});

/**
 * Consecutive Function parameters sharing a `group` label, for inspector headings.
 * @param {FunctionParameterDef[]|null|undefined} parameters
 * @returns {Array<{ group: string, params: FunctionParameterDef[] }>}
 */
export function groupFunctionParameters(parameters) {
  /** @type {Array<{ group: string, params: FunctionParameterDef[] }>} */
  const groups = [];
  for (const p of parameters || []) {
    if (!p) continue;
    const group = String(p.group || '');
    const last = groups[groups.length - 1];
    if (last && last.group === group) last.params.push(p);
    else groups.push({ group, params: [p] });
  }
  return groups;
}

/**
 * Build the Functions generalized from the built-in, historically-parameterless action defs.
 * @returns {Record<string, FunctionDef>}
 */
function buildBuiltinActionFunctionDefs() {
  /** @type {Record<string, FunctionDef>} */
  const out = {};
  for (const [id, def] of Object.entries(KEYBINDING_ACTION_DEFS)) {
    if (isBuildExcludedKeyAction(id)) continue;
    out[id] = withDocsUrl(Object.freeze({
      id,
      label: def.label,
      description: def.description,
      ...(def.details ? { details: def.details } : {}),
      handler: def.handler,
      category: KEYBINDING_ACTION_CATEGORY_BY_ID[id] || 'Other',
      keyboardClass: def.keyboardClass ?? null,
      // No `parameters` by default: most built-ins remain simple/non-instantiable Functions.
      // A few (SEND_TEXT_TO_AI, RECTANGLE_HIGHLIGHT, HIGHLIGHT, COPY_HOVERED_IMAGE,
      // COPY_HOVERED_URL, COPY_HOVERED_VIDEO, PREVIEW_LINK_POPOVER, OPEN_POPOVER)
      // get their schema below from
      // BUILTIN_FUNCTION_PARAMETER_OVERRIDES — see KEY_ACTION_ARCHITECTURE.md "Migration mapping".
      ...(TEXT_ACTIVE_BUILTIN_FUNCTION_IDS.has(id) ? { worksWhileTyping: true } : {}),
      ...(def.mode ? { mode: def.mode } : {}),
      ...(def.cancelOnPointerDown ? { cancelOnPointerDown: true } : {}),
      ...(def.pointerBinding ? { pointerBinding: def.pointerBinding } : {}),
      ...(BUILTIN_FUNCTION_DATA_TAGS[id] || {}),
      ...(BUILTIN_FUNCTION_PARAMETER_OVERRIDES[id] ? { parameters: BUILTIN_FUNCTION_PARAMETER_OVERRIDES[id] } : {})
    }));
  }
  return out;
}

/**
 * Data Acquisition + Result Destination example/primitive Functions — see
 * KEY_ACTION_ARCHITECTURE.md, "Data Acquisition & Result Destinations", for the full design.
 *
 * `GET_TEXT_AT_CURSOR` / `GET_MEDIA_AT_CURSOR` are key-assignable getters (each copies to the
 * clipboard so they're useful on a key today). `GET_TEXT_RANGE` is the selection/highlight
 * getter as a Macro Step only (`assignableToKey: false`) — Copy is the key action for that
 * data. `LOOKUP_WORD` / `TRANSLATE` are the composed, stock-ready examples. `SHOW_POPOVER` is
 * the Display destination as an explicit Macro Step. `ADD_URL_TO_MEDIA_LIBRARY` stores the
 * hovered href in Media Library.
 * `FETCH_URL_FOR_MEDIA_LIBRARY` fetches the linked file (image / video / document).
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
      description: 'Copy text under the cursor',
      details: 'Reads the word, sentence, paragraph, or hyperlink under the cursor (choose granularity on the Action Instance) and copies it to the clipboard.',
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
      description: 'Pass selection to the next Macro Step',
      details: 'Reads the current highlight/selection into the next Macro Step. A data primitive — add it as a Macro Step, not as a key action (use Copy for that).',
      handler: 'handleGetTextRangeKey',
      category: DATA_FUNCTION_CATEGORY,
      dataSource: 'textRange',
      dataKind: 'text',
      assignableToKey: false
    }),
    GET_MEDIA_AT_CURSOR: Object.freeze({
      id: 'GET_MEDIA_AT_CURSOR',
      label: 'Get Media At Cursor',
      description: 'Copy media under the cursor',
      details: 'Reads the image, video, or audio under the cursor (choose kind on the Action Instance) and copies it — or its URL — to the clipboard.',
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
      description: 'Dictionary definition under cursor',
      details: 'Shows a Free Dictionary API definition popover for the word under the cursor. No AI setup required; optionally switch the source to Ask AI on the Action Instance.',
      handler: 'handleLookupWordKey',
      category: LOOKUP_FUNCTION_CATEGORY,
      dataSource: 'underCursor',
      dataKind: 'text',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.POPOVER]),
      parameters: Object.freeze([
        Object.freeze({
          id: 'source',
          label: 'Source',
          type: 'enum',
          defaultValue: 'dictionary',
          options: Object.freeze([
            Object.freeze({ id: 'dictionary', label: 'Dictionary' }),
            Object.freeze({ id: 'ai', label: 'Ask AI instead' })
          ])
        })
      ])
    }),
    TRANSLATE: Object.freeze({
      id: 'TRANSLATE',
      label: 'Translate',
      description: 'Translate selection or under-cursor text',
      details: 'Translates the highlighted text, or the word/sentence/paragraph under the cursor when nothing is highlighted. Configure target language and whether the result replaces page text or opens in a popover.',
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
      description: 'Show prior Macro Step result',
      details: 'Renders the previous Macro Step’s result (or configured fallback text) in a popover. A display primitive — add it as a Macro Step, not as a key action.',
      handler: 'handleShowPopoverKey',
      category: DISPLAY_FUNCTION_CATEGORY,
      dataSource: 'none',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.POPOVER]),
      assignableToKey: false,
      parameters: Object.freeze([Object.freeze({
        id: 'content',
        label: 'Content',
        type: 'string',
        multiline: true,
        defaultValue: '',
        placeholder: 'Fallback text if the previous step produced none…'
      })])
    }),
    ADD_URL_TO_MEDIA_LIBRARY: Object.freeze({
      id: 'ADD_URL_TO_MEDIA_LIBRARY',
      label: 'Add URL to Media Library',
      description: 'Save hovered href (no download)',
      details: 'Stores the hyperlink under the cursor itself (its href) in Media Library — does not download the resource the link points to.',
      handler: 'handleAddUrlToMediaLibraryKey',
      category: MEDIA_LIBRARY_FUNCTION_CATEGORY,
      dataSource: 'underCursor',
      dataKind: 'text',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY])
    }),
    FETCH_URL_FOR_MEDIA_LIBRARY: Object.freeze({
      id: 'FETCH_URL_FOR_MEDIA_LIBRARY',
      label: 'Fetch URL for Media Library',
      description: 'Download linked file into library',
      details: 'Fetches the resource the hyperlink under the cursor points to (for example a .pdf, .mp3, or .mp4) and stores it in Media Library. Images, videos, and documents are classified from the file type. Web pages are not downloaded — use Add URL to Media Library for those.',
      handler: 'handleFetchUrlForMediaLibraryKey',
      category: MEDIA_LIBRARY_FUNCTION_CATEGORY,
      dataSource: 'urlFetch',
      dataKind: 'file',
      destinations: Object.freeze([ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY])
    })
  };
}

/**
 * Drop {@link isBuildExcludedKeyAction} ids from a FunctionDef map so Type / Data /
 * Macro Key kinds stay in source but leave the shipped catalog.
 * @param {Record<string, FunctionDef>} defs
 * @returns {Record<string, FunctionDef>}
 */
function omitBuildExcludedFunctions(defs) {
  return Object.fromEntries(
    Object.entries(defs).filter(([id]) => !isBuildExcludedKeyAction(id))
  );
}

/**
 * The unified Function Library: built-in stock Functions + keystroke-primitive Functions +
 * new customizable Functions, keyed by Function id.
 * @type {Readonly<Record<string, FunctionDef>>}
 */
export const FUNCTION_LIBRARY = Object.freeze(omitBuildExcludedFunctions({
  ...buildBuiltinActionFunctionDefs(),
  ...buildKeystrokeFunctionDefs(),
  [TYPE_CHARACTERS_FUNCTION_DEF.id]: withDocsUrl(TYPE_CHARACTERS_FUNCTION_DEF),
  [EXECUTE_JS_FUNCTION_DEF.id]: withDocsUrl(EXECUTE_JS_FUNCTION_DEF),
  ...Object.fromEntries(
    Object.entries(buildDataAcquisitionFunctionDefs())
      .map(([id, def]) => [id, withDocsUrl(def)])
  )
}));

/** Stable category display order for the Functions browser. */
export const FUNCTION_CATEGORY_ORDER = Object.freeze([
  'Navigation',
  'Tab Control',
  'Begin URL',
  'Get Page Data',
  'Maps',
  'Scroll',
  'Select',
  'Clipboard',
  TEXT_FUNCTION_CATEGORY,
  KEYSTROKE_FUNCTION_CATEGORY,
  DATA_FUNCTION_CATEGORY,
  LOOKUP_FUNCTION_CATEGORY,
  TRANSLATE_FUNCTION_CATEGORY,
  DISPLAY_FUNCTION_CATEGORY,
  SCRIPT_FUNCTION_CATEGORY,
  MEDIA_LIBRARY_FUNCTION_CATEGORY,
  'AI',
  'KeyPilot',
  'Tools',
  'System',
  'Other'
]);

/**
 * One-line Actions Library blurb shown above the cards in each category section.
 * @type {Readonly<Record<string, string>>}
 */
export const FUNCTION_CATEGORY_DESCRIPTIONS = Object.freeze({
  Navigation: 'Click links, preview, and move through browsing history.',
  'Tab Control': 'Open, close, switch, and review tabs.',
  'Begin URL': 'Jump to a URL via Launcher, Top Sites, or the omnibox.',
  'Get Page Data': 'Capture text, images, video, URLs, fonts, and other page media.',
  Maps: 'Open a place’s website or address from a map pin under the cursor.',
  Scroll: 'Scroll the page by line, page, or to the top/bottom.',
  Select: 'Delete or toggle multi-column selection helpers.',
  Clipboard: 'Copy, cut, paste, select-all, and select word, sentence, paragraph, or image under the cursor.',
  [TEXT_FUNCTION_CATEGORY]: 'Type saved text into the focused field.',
  [KEYSTROKE_FUNCTION_CATEGORY]: 'Send keystrokes, chords, bursts, and mouse remaps.',
  [DATA_FUNCTION_CATEGORY]: 'Read text or media under the cursor, or from a highlight.',
  [LOOKUP_FUNCTION_CATEGORY]: 'Look up a definition for the word under the cursor.',
  [TRANSLATE_FUNCTION_CATEGORY]: 'Translate highlighted or under-cursor text.',
  [DISPLAY_FUNCTION_CATEGORY]: 'Show a previous Macro Step’s result in a popover.',
  [SCRIPT_FUNCTION_CATEGORY]: 'Run a custom JavaScript snippet against page state.',
  [MEDIA_LIBRARY_FUNCTION_CATEGORY]: 'Save links or fetched files into Media Library.',
  AI: 'Send selected text to AI with a prompt and result destination.',
  KeyPilot: 'Open KeyPilot chrome — keyboard reference, settings, and modes.',
  Tools: 'Utility overlays and helpers.',
  System: 'Cancel the current KeyPilot gesture or mode.',
  Other: 'Uncategorized Functions.'
});

/** Section blurbs for non-Function Actions Library groups. */
export const LIBRARY_SECTION_DESCRIPTIONS = Object.freeze({
  macros: 'Multi-step sequences you can place on a key. Customize a stock macro to fork an editable copy.',
  macroKeys: 'Saved Macro Key instances (hotkey, burst, round-robin, and related kinds) ready to place.'
});

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
  POI_WEBSITE: 45,
  POI_ADDRESS: 46,
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
  TOP_SITES: 155,
  LAUNCHER: 160,
  OMNIBOX: 170,
  // Get Page Data
  COPY_HOVERED_IMAGE: 200,
  COPY_HOVERED_VIDEO: 201,
  COPY_HOVERED_URL: 202,
  FONT_INFO: 203,
  PAGE_MEDIA: 205,
  RECTANGLE_HIGHLIGHT: 210,
  HIGHLIGHT: 220,
  // Clipboard
  CLIPBOARD_COPY: 230,
  CLIPBOARD_CUT: 231,
  CLIPBOARD_PASTE: 232,
  CLIPBOARD_SELECT_ALL: 233,
  SELECT_WORD: 234,
  SELECT_SENTENCE: 235,
  SELECT_PARAGRAPH: 236,
  SELECT_IMAGE: 237,
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
 * Functions that can also fire from a mouse button (see `pointerBinding`).
 * @returns {FunctionDef[]}
 */
export function listPointerBoundFunctionDefs() {
  return listFunctionDefs().filter((d) => d && d.pointerBinding);
}

/**
 * @param {string} functionId
 * @returns {string}
 */
export function getFunctionCategory(functionId) {
  return getFunctionDef(functionId)?.category || 'Other';
}

/**
 * Short description for an Actions Library Function category section.
 * @param {string} category
 * @returns {string}
 */
export function getFunctionCategoryDescription(category) {
  const cat = String(category || '');
  return FUNCTION_CATEGORY_DESCRIPTIONS[cat] || '';
}

/**
 * True when this Function's values must live on a per-assignment Action Instance rather than
 * being called bare. (i.e. it has a non-empty parameter schema.)
 * @param {string} functionId
 * @returns {boolean}
 */
export function isFunctionInstantiable(functionId) {
  const def = getFunctionDef(functionId);
  if (!def?.parameters || def.parameters.length === 0) return false;
  // LOOKUP_WORD keeps a gated `source` param for a future AI path; until AI is available
  // there is nothing to configure, so treat it as a stock zero-config Function.
  if (functionId === 'LOOKUP_WORD' && !isWordLookupAiAvailable()) return false;
  // Select Word / Sentence / Paragraph / Image: Exclusive|Cumulative is a shared popover
  // setting, not a reason to mint per-key Action Instances.
  if (UNIT_SELECT_FUNCTION_IDS.includes(functionId)) return false;
  return true;
}

/**
 * True when this Function may occupy a keyboard slot from the Actions Library.
 * Macro-step / routing primitives (`assignableToKey: false`) stay in the catalog for
 * composition and stock Functions, but are not placeable as standalone key actions.
 * @param {string} functionId
 * @returns {boolean}
 */
export function functionAssignableToKey(functionId) {
  const def = getFunctionDef(functionId);
  if (!def) return false;
  return def.assignableToKey !== false;
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
  if (functionId === 'SHOW_POPOVER') {
    const text = String(parameters?.content || '').trim();
    if (!text) return '(previous step)';
    return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  }
  if (functionId === 'EXECUTE_JS') {
    const lines = String(parameters?.script || '').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
      return t.length > 32 ? `${t.slice(0, 32)}…` : t;
    }
    return String(parameters?.script || '').trim() ? '(script)' : '(empty)';
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
  if (def.assignableToKey === false) {
    return {
      ok: false,
      reason: `"${def.label}" is a Macro Step, not a key action.`
    };
  }
  if (def.worksWhileTyping && !isChordSlotKey(slotKey)) {
    return {
      ok: false,
      reason: `"${def.label}" must run while a text field is focused, so it can only be bound to a modifier-key combination (e.g. Ctrl+Alt+…), not a plain key.`
    };
  }
  return { ok: true };
}
