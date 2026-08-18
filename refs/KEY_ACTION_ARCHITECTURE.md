# Key Action & Macro Composition Architecture

## Status

**In progress.** The Function Library, Action Instance store, runtime dispatch, and data model
(`SlotAssignment`, `UserAction`, `UserMacro`/`MacroStep`) described below are implemented — the old
`'action'`/`'macroKey'` `SlotItem` types and the standalone `UserMacroKey`/`ACTION_SETTINGS_REGISTRY`
storage have been fully retired, not just wrapped. The main config palette's `functions`/`macros`/
`macroKeys` tabs are also gone, folded into one unified always-visible list, and the separate,
additive `function-library-panel.js` window has been folded into that same palette (per-instance
parameter editing, Macro step editing, and modifier-chord binding for `worksWhileTyping` Functions
now all live in `keyboard-layout-config-panel.js`) — there is now exactly one Function Library
surface. What's left: a real Media Library sink/`urlFetch` handler for
`ADD_URL_TO_MEDIA_LIBRARY`/`FETCH_URL_FOR_MEDIA_LIBRARY` (currently a "coming soon" stub, though
`OPEN_MEDIA_LIBRARY` now has a default `M` binding on the right-handed built-in layout so it's
discoverable ahead of that). Every row in the "Migration mapping" checklist below is otherwise ✅.

## Problem this solves

Today the codebase uses **"function"** and **"key action"** as synonyms, and has grown three
parallel, overlapping mechanisms that each solve part of the real problem:

1. `KEYBINDING_ACTION_DEFS` (`src/config/keyboard-layouts.js`) — built-in, parameterless,
   one-handler-per-id actions (`ACTIVATE`, `SEND_TEXT_TO_AI`, ...).
2. `ACTION_SETTINGS_REGISTRY` (`src/ui/key-action-settings.js`) — lets a *built-in* action
   declare parameters (e.g. `SEND_TEXT_TO_AI`'s `prompt`), but stores the values **globally per
   action id** in `settings.actionSettings[actionId]`. If two keys were ever assigned the same
   parameterized action, they would incorrectly share one value — there is no per-assignment
   instance.
3. `MacroKeyKind` / `UserMacroKey` (`src/config/macro-keys.js`, `keyboard-layout-store.js`) —
   user-created, *instantiable* objects (`kind` + `config`, own `id`), each independently
   assignable to a slot. This is the **correct** pattern for "more than one key can use the same
   underlying behavior with different values" (e.g. two keys each sending a different hotkey
   chord) — but it's siloed into its own "macroKeys" concept/tab, disconnected from the built-in
   action list and from the future macro-script builder.

The goal is one consistent vocabulary that:

- Lets a stock library of reusable, composable operations exist independently of any key.
- Lets **some** of those operations be simple/parameterless (assign directly, no per-key state).
- Lets **others** be customizable (e.g. "Type Characters"), where **multiple key slots can each
  hold an independently-configured instance** with different values, without those values
  colliding.
- Lets a key action be composed from **one or more** of those operations, in order — this is the
  on-ramp to the future macro-script builder (Automator/Shortcuts-style: a library of draggable
  actions, and a canvas where you compose them into a script), without inventing a second,
  incompatible vocabulary when that builder is built.

## Vocabulary

| Term | Meaning | Automator/Shortcuts analogy |
|---|---|---|
| **Function** | An atomic, reusable, catalog-defined operation. Has a stable id, a runtime handler, and an optional **parameter schema**. Has no identity of its own beyond its definition — it is *what can be done*, not *an instance of doing it*. | An "Action" in the Actions Library sidebar |
| **Function Library** | The full catalog of built-in `FunctionDef`s. | The Actions Library sidebar |
| **Action** (**Key Action**) | Whatever occupies one key slot in a layout. Always `{ type: 'function' | 'macro', ... }`. | The finished thing attached to a shortcut/keystroke |
| **Action Instance** (`UserAction`) | A Function reference *bound to specific parameter values*, with its own id, independent of any particular key slot until assigned. This is what makes a parameterized Function reusable with different values per key. | An Action's configured state inside one step of a workflow |
| **Macro** (`UserMacro`) | An ordered list of **Steps**. A composed script, itself assignable to a key slot as `type: 'macro'`. | The whole Shortcut/workflow built by dragging Actions into the canvas |
| **Step** | One entry in a Macro: a Function id + bound parameters (+ optional per-step controls like a delay). | One block in the Shortcuts canvas |

### Why "Function" and "Action" split apart

- A **Function** is a *library entry*: reusable, potentially parameterizable, has no state of its
  own. `TYPE_CHARACTERS` is one Function, forever, regardless of how many keys use it.
- An **Action** is a *slot occupant*: it always resolves to exactly one of two shapes:
  - `{ type: 'function', functionId, parameters? }` — one Function call, optionally with
    instance-specific bound values (empty `parameters` if the Function takes none). Whether the
    action is "simple" or "customizable" is a property of the *Function's parameter schema*, not
    a different Action type. One shape covers both `ACTIVATE` (no parameters) and a
    `TYPE_CHARACTERS` instance (bound `text`).
  - `{ type: 'macro', macroId }` — a reference to a composed Macro (Function calls in sequence).

This directly answers "a given action might be made from one or more functions": exactly one
Function → `type: 'function'`; more than one, in order → `type: 'macro'`.

### Why values live on the Action Instance, not the Function

Two keys can each be assigned their own `UserAction` (own id, e.g. `action:<uuid>`) that both
point to `functionId: 'TYPE_CHARACTERS'`, with different `parameters.text`. Values never live on
the `FunctionDef` (the shared definition) and never live in global settings keyed by function/action
id — they live with the *instance*, so per-key customization can never collide across keys.

## Data model

```ts
// Where a Function's produced data can be routed. See "Data Acquisition & Result Destinations".
// 'clipboard' | 'popover' implemented today (action-result-delivery.js); the rest are proposed.
type ResultDestination = 'clipboard' | 'popover' | 'modifyPage' | 'mediaLibrary' | 'scrapbook';

// Function Library — the catalog. Stable across all users/installs.
type FunctionParameterDef = {
  id: string;                 // e.g. "text"
  label: string;
  type: 'boolean' | 'number' | 'string' | 'enum' | 'keyStroke' | 'keyStrokeList';
  defaultValue?: any;
  options?: { id: string; label: string }[];   // for 'enum'
  min?: number; max?: number; step?: number;    // for 'number'
  multiline?: boolean; placeholder?: string;    // for 'string'
};

type FunctionDef = {
  id: string;                 // SCREAMING_SNAKE_CASE, e.g. "TYPE_CHARACTERS"
  label: string;
  description: string;        // short "About" for Actions Library cards
  details?: string;           // longer Description for the Actions Library inspector
  handler: string;            // name of the runtime handler function
  parameters?: FunctionParameterDef[];   // omitted/empty => parameterless
  keyboardClass?: string;     // rendering hint for the keycap
  category?: string;          // grouping in the Functions browser
  worksWhileTyping?: boolean; // see "Text-active Functions" below
  // See "Data Acquisition & Result Destinations" below.
  dataSource?: 'underCursor' | 'textRange' | 'urlFetch' | 'none';
  dataKind?: 'text' | 'media' | 'file';
  destinations?: ResultDestination[];   // which destinations this Function's data may be routed to
};

// Action Instance — a configured, independently-assignable reference to a Function.
// Generalizes today's UserMacroKey.
type UserAction = {
  id: string;                 // "action:<uuid>"
  functionId: string;         // FunctionDef.id
  label?: string;              // optional user-facing override, e.g. "Paste as Plain Text"
  parameters: Record<string, any>;
  createdAt: number;
  updatedAt: number;
};

// Macro — an ordered script of Function calls and Logic steps. Itself assignable to a slot.
// Stock macros (`stock:*` ids in `src/config/stock-macros.js`) are read-only; saving edits
// forks a UserMacro with `baseStockMacroId` (same product rule as builtin → user layouts).
type MacroStep =
  | {
      kind: 'function';
      functionId: string;
      parameters: Record<string, any>;
      delayMsBefore?: number;   // pause before this Function step
    }
  | { kind: 'wait'; ms: number }
  | {
      kind: 'gate';
      op: string;              // truthy | falsy | eq | neq | gt | lt
      left: string;            // usually 'prior' (previous Function return)
      leftKey?: string;
      right?: any;
      thenSkip?: number;       // on fail, skip this many following steps
    }
  | { kind: 'stop' }
  | { kind: 'runMacro'; macroId: string };  // nested run; cycle-guarded at runtime

type UserMacro = {
  id: string;                 // "macro:<uuid>" (stock catalog uses "stock:<slug>")
  label: string;
  icon?: string;
  baseStockMacroId?: string;  // set when forked from a stock macro
  steps: MacroStep[];
  createdAt: number;
  updatedAt: number;
};

// What actually occupies a layout slot.
type SlotAssignment =
  | { type: 'function'; functionId: string; instanceId?: string }  // instanceId set iff parameterized
  | { type: 'macro'; macroId: string };
```

`SlotAssignment.type === 'function'` with no `instanceId` means "the bare stock Function,
unconfigured" (parameterless case, e.g. `ACTIVATE`). If the Function has a parameter schema, an
`instanceId` pointing at a `UserAction` is required, created automatically the first time the
Function is dragged onto a slot (auto-seeded with the Function's `defaultValue`s), and edited
in-place via the same config panel pattern `key-action-settings.js` already implements.

## Runtime resolution

```
slot -> SlotAssignment
  type 'function', no instanceId -> look up FunctionDef -> call handler() with no bound params
  type 'function', instanceId    -> look up UserAction -> look up FunctionDef by functionId
                                     -> call handler(parameters)
  type 'macro'                   -> look up UserMacro or stock catalog -> for each Step, in order:
                                     kind 'function' -> FunctionDef handler(parameters)
                                       (honoring delayMsBefore)
                                     kind 'wait'     -> setTimeout(ms)
                                     kind 'gate'     -> evaluate op vs prior return; on fail skip thenSkip
                                     kind 'stop'     -> break
                                     kind 'runMacro' -> nested _runMacroById (cycle-guarded)
```

This is one resolution path regardless of whether the underlying behavior is "simple" or
"composed," which is what lets the Functions browser and the future Macro builder share a single
drag source (the Function Library) instead of needing separate "functions" vs "macroKeys" tabs.

## Migration mapping (current code → target)

Status legend: ✅ done · 🚧 in progress / partially done · ⬜ not started.

| Status | Current | Target |
|---|---|---|
| ✅ | `KEYBINDING_ACTION_DEFS` (`keyboard-layouts.js`) | Entries become `FunctionDef`s in the unified **Function Library** (`src/config/function-library.js`). `handler` field carries over unchanged. `KEYBINDING_ACTION_DEFS` itself is untouched (wrapped, not replaced) so existing consumers keep working. |
| ✅ | `MACRO_KEY_KIND_DEFS` (`hotkey`, `burst`, `roundRobin`, `continuous`, `mouse`, `key`) | Generalized to `FunctionDef`s (`SEND_HOTKEY`, `SEND_BURST`, `CYCLE_ROUND_ROBIN`, `HOLD_CONTINUOUS`, `CLICK_MOUSE_BUTTON`, `REMAP_KEY`) in the Function Library, tagged `legacyMacroKeyKind` so kind-specific config/summary logic in `macro-keys.js` is reused, not duplicated. Per-field parameter schemas (vs. the current opaque `config` blob) are **not yet** broken out — see open item below. |
| ✅ | `UserMacroKey` (`macroKey:<id>`, `{ kind, config }`) | Fully retired. `UserMacroKey`'s standalone storage/CRUD (`createUserMacroKey`, `upsertUserMacroKey`, `deleteUserMacroKey`, `listUserMacroKeys`, `getUserMacroKeyById`) is deleted from `keyboard-layout-store.js`; a "configured Macro Key" is now just a `UserAction` (`action:<uuid>`) whose `functionId` is the kind's Function id (`FUNCTION_ID_BY_MACRO_KEY_KIND` in `function-library.js`) and whose `parameters` is `{ config }`. `macro-key-editor.js`'s kind-specific editing UI (stroke pickers, burst/round-robin lists, …) is unchanged — it's UI-only and works against a `{ id, kind, label, config }` view adapted from a `UserAction` (`macroKeyLikeFromUserAction()` in `keyboard-layout-config-panel.js`). `runMacroKeyById()` (the `UserMacroKey`-keyed executor) is deleted from `macro-key-runtime.js`; only `runLegacyMacroKeyFunction()` (Function id + parameters) remains, since this extension has no shipped users/persisted data to preserve a compatibility path for. |
| ✅ | Runtime dispatch only knew `'action'` / `'macro'` / `'macroKey'` slot types | `keypilot.js` now also dispatches `type: 'function'` slot assignments (`_dispatchFunctionSlot`), resolving either a bare Function id or an `action:<id>` instance and calling the handler with `(event, parameters, { functionId, instanceId })`. Old types are unchanged. |
| ✅ | No concept of "must run while a text field is focused" | Added `worksWhileTyping` on `FunctionDef` + a **modifier-chord slot** convention (`CHORD:CTRL+ALT+Q`-style keys in the same `slots` map) that bypasses the typing-safety gate. See "Text-active Functions" below — this was called out explicitly because `TYPE_CHARACTERS` (and the pre-existing `CLIPBOARD_*` Functions) are meaningless unless they can fire while typing. |
| ✅ | `ACTION_SETTINGS_REGISTRY` + `settings.actionSettings[actionId]` (global values, e.g. `SEND_TEXT_TO_AI`'s `prompt`) | `ACTION_SETTINGS_REGISTRY` is removed; parameter **schema** for `SEND_TEXT_TO_AI` (`prompt`, `destination`) and `RECTANGLE_HIGHLIGHT` (`mode`, modeled as a plain `enum` parameter) now lives on `FunctionDef.parameters` (`function-library.js`). Parameter **values** live on a per-Function canonical `UserAction` (`action:builtin:<functionId>`, see `getOrCreateBuiltinFunctionUserAction()` in `keyboard-layout-store.js`) instead of `settings.actionSettings` — there is exactly one meaningful instance per Function id today since neither is yet assignable to an arbitrary slot (that's the "Config panel tabs" item below). `key-action-settings.js` is now a thin bridge deriving its legacy `ActionSettingsDef`/mode-switch UI shape from the Function Library rather than duplicating schema. |
| ✅ | `UserMacro.actions: any[]` | `UserMacro.steps: MacroStep[]` — Function steps `{ kind:'function', functionId, parameters, delayMsBefore? }` plus Logic steps `wait` / `gate` / `stop` / `runMacro` (normalized in `keyboard-layout-store.js`). Full CRUD including `forkStockMacroToUser`. `_runMacroById()` in `keypilot.js` runs Function + Logic steps (cycle-guarded nested macros). Alt+C **Keyboard Layout Config** is the Actions Library + Inspector + User Macros builder (draft + Save); stock macros live in `src/config/stock-macros.js`. |
| ✅ | `SlotItem { type: 'action'|'macro'|'macroKey', id }` | Renamed to `SlotAssignment`, and the type union is now just `'function' | 'macro'` — `'action'` and `'macroKey'` are fully retired (this extension has no shipped users/persisted data, so old-shape read support was deleted outright rather than kept for compatibility; see `keyboard-layout-store.js` module doc). Every writer now emits `{ type: 'function', id }`: `duplicateBuiltinLayoutToUserLayout()`, `keyboard-layout-config-panel.js`'s built-in-action palette and Macro Keys tab, `setUserKeyboardLayoutSlot()`. Every reader (`keypilot.js` dispatch, `floating-keyboard-help.js`'s `renderSlot`/`applyDropToSlot`/`resolveFunctionSlot`, `keyboard-layout-config-panel.js`'s badge/inspector logic) only ever branches on `'function'`/`'macro'` now — the old `builtinActionItemKey()` normalizer and `functionOrInstanceLabel`/`functionOrInstanceKeyboardClass` module-level stand-ins were deleted since there's no longer a second type to normalize against, and `floating-keyboard-help.js` now resolves any `action:<uuid>` Action Instance (Macro Key or otherwise) to a real label/`keyboardClass` via a live `UserAction[]` lookup instead of a generic "Configured Function" fallback. |
| ✅ | Config panel tabs: `functions` / `macros` / `macroKeys` | Replaced by Actions Library primary tabs (All / Macros / Macro Keys / Functions) + function category select; Stock vs User macro subgroups; Inspector dock + collapsible User Macros builder. Place/DnD still targets the floating Keyboard Reference (`KP_LAYOUT_ITEM_MIME`). |
| ✅ | UI-surface consolidation: additive `function-library-panel.js` (Alt+C, separate window) | The **Functions** section of `keyboard-layout-config-panel.js` now sources from the full `FUNCTION_LIBRARY` (`listFunctionDefs()`/`getFunctionCategory()`), not just `KEYBINDING_ACTION_DEFS` — every Function (Type Characters, the Data/Lookup/Translate/Display/Media Library Functions, etc.) is browsable and placeable in the one palette. Instantiable Functions (excluding `legacyMacroKeyKind`, handled by "Configured Macro Keys", and `FIXED_KEY_FUNCTION_IDS`, which keep their existing `key-action-settings.js` Config popover) render each existing `UserAction` instance as its own placeable item with an **Edit** button opening a new generic parameter editor (`_openActionParamsEditor()`, reusing the same field-control logic as `KeyActionConfigPanel`) plus a `+ New <Function>` control to create more. Macro items gained an **Edit steps** button (`_openMacroStepsEditor()`, ported from the old panel's step add/reorder/remove/"Run now" UI) into the same shared inline-editor host as the Macro Key editor (`_macroKeyEditorHost` — only one inline editor open at a time). `function-library-panel.js` is deleted; `keyboard-layout-configurator.js` no longer shows a second floating window on Alt+C. |
| ✅ | Chord-capture support in the main palette | Any `worksWhileTyping` Function/instance in the Functions section now gets a "Needs modifier" badge + **Bind chord…** button (`_captureAndAssignChord()`, ported from the old panel's keydown-capture flow) alongside its normal click-to-place keycap. Slot writes were also refactored to go through `setUserKeyboardLayoutSlot()` (`_assignSlotKey()`, shared by both the bare-key place-mode flow and the new chord-bind flow) instead of mutating `layout.slots` directly, so the chord-vs-bare-key rule (`validateFunctionSlotKey()`) is now enforced for **every** slot write, including plain click-to-place — previously, click-to-place could silently create a bare-key binding for a `worksWhileTyping` Function that would simply never fire. |
| ✅ | `RESULT_DESTINATION_PARAMETER` (`action-result-delivery.js`) — one frozen `clipboard`\|`popover`\|`both` enum reused as-is | Generalized to `buildResultDestinationParameter(applicableDestinations)`, a factory each `FunctionDef` calls with only the destinations it actually supports (`SEND_TEXT_TO_AI` still offers `clipboard`/`popover`/`both`; a future `TRANSLATE` would pass `modifyPage`/`popover`). `ACTION_RESULT_DESTINATIONS` gained `MODIFY_PAGE`/`MEDIA_LIBRARY`/`SCRAPBOOK`; `deliverActionResult` has a real `modifyPage` branch (calls a caller-supplied `onModifyPage(text)` hook, since only the caller knows *where* in the page to write back — falls back to `popover` if no hook is wired or it fails, so a result is never silently dropped). `mediaLibrary`/`scrapbook` are reserved ids with `"(coming soon)"` labels and intentionally no delivery branch yet — real future sinks, not implemented. The old frozen `RESULT_DESTINATION_PARAMETER` constant (and its re-export from `key-action-settings.js`) was dead code once every caller switched to the factory, so it was deleted rather than kept alongside it. |
| ✅ | No `dataSource`/`dataKind` concept on `FunctionDef` | `FunctionDef.dataSource` gained `'urlFetch'`; `dataKind` gained `'file'` (`function-library.js`). New `buildDataAcquisitionFunctionDefs()` adds: `GET_TEXT_AT_CURSOR`/`GET_TEXT_RANGE`/`GET_MEDIA_AT_CURSOR` (low-level getters — real, directly key-assignable, always copy to the clipboard, since their real purpose is feeding a future macro-builder destination Step); `LOOKUP_WORD` (word under cursor → Free Dictionary API definition → popover; optional AI source gated until keys exist) and `TRANSLATE` (highlighted text, else word/sentence/paragraph under cursor → on-device AI translation → `modifyPage` or `popover`) — `TRANSLATE` reuses `sendTextToAi`/`ai-text-service.js`; `LOOKUP_WORD` uses `api.dictionaryapi.dev` via the service worker; `SHOW_POPOVER` (static configured `content` → popover). New `src/utils/text-at-point.js` acquires word/sentence/paragraph/hyperlink text at a point via `caretRangeFromPoint` + `Intl.Segmenter`, and returns a precise `Range` for word/sentence so `TRANSLATE`'s `modifyPage` can write back in place (falls back to `popover` when no `Range` is available, e.g. `paragraph` granularity or an `<input>`/`<textarea>` selection). `ADD_URL_TO_MEDIA_LIBRARY`/`FETCH_URL_FOR_MEDIA_LIBRARY` are added as catalog entries (with the `urlFetch`/`file` tagging) but share a stub handler that just says the Media Library isn't built yet — consistent with `mediaLibrary` having no real delivery branch (see the `RESULT_DESTINATION_PARAMETER` row above). See "Data Acquisition & Result Destinations" below. |

## Text-active Functions & modifier-chord assignment

**Why this matters:** KeyPilot's normal single-key dispatch is fail-closed around typing for two
independent reasons found in `keypilot.js`:

1. `handleKeyDown` returns immediately for **any** event with `ctrlKey`/`altKey`/`shiftKey`/`metaKey`
   set (`hasModifierKeys(e)`), *before* layout-slot dispatch ever runs — today, modifier combos are
   never routed to a Key Action at all; they always pass through untouched.
2. Bare-key layout-slot dispatch (`_maybeHandleCurrentLayoutBinding`) and the built-in layout loop
   both fail-closed via `_isUnsafeToRunActionKey`: if a text-entry element is focused, plain letter
   keys are suppressed so normal typing is never hijacked.

A Function like `TYPE_CHARACTERS` is only useful if it fires *while a text field is focused* (it
types into that very field) — the same is true of the pre-existing `CLIPBOARD_COPY` / `CLIPBOARD_CUT`
/ `CLIPBOARD_PASTE` / `CLIPBOARD_SELECT_ALL` Functions, which were previously assignable to a bare
key slot but would have silently never fired while typing, defeating their purpose. Assigning such
a Function to a bare key slot is not just suboptimal, it's a bug.

**Resolution:**

- `FunctionDef` gains an optional `worksWhileTyping: true` flag (see `function-library.js`). Set on
  `TYPE_CHARACTERS`, `CLIPBOARD_COPY`, `CLIPBOARD_CUT`, `CLIPBOARD_PASTE`, `CLIPBOARD_SELECT_ALL`.
- A Function flagged `worksWhileTyping` **must** be bound to a modifier chord (e.g. `Ctrl+Alt+Q`),
  never a bare key — enforced by `validateFunctionSlotKey()` (`function-library.js`), called from
  `setUserKeyboardLayoutSlot()` (`keyboard-layout-store.js`) so every slot-write path shares one
  check, and surfaced in `keyboard-layout-config-panel.js`'s palette as a "Needs modifier" badge +
  "Bind chord…" control that captures a chord instead of a bare keypress for these Functions.
- Chorded slots reuse the *same* `UserKeyboardLayout.slots` map as bare-key slots — no schema/version
  bump needed. The slot key is just a different string shape, built by `src/utils/key-chord.js`:
  `CHORD:CTRL+ALT+Q` instead of `Q`. (`CHORD:` prefix makes the two unambiguous at a glance and in code.)
- `keypilot.js` checks chorded slots in a **new** `_maybeHandleTextActiveFunctionSlot(e)` step, called
  *before* the blanket `hasModifierKeys(e)` bail-out — i.e. before KeyPilot decides "this is a
  modifier combo, ignore it" it first asks "is this exact chord bound to a text-active Function in
  the current user layout?". This path intentionally does **not** call `_isUnsafeToRunActionKey` —
  running while typing is the entire point.
- Everything else about modifier combos is unchanged: any chord not bound to a `worksWhileTyping`
  Function in the current user layout still falls through untouched, exactly as before.

The drag-and-drop palette (`keyboard-layout-config-panel.js`) now has a "Bind chord…" control
alongside the normal click-to-place keycap for every `worksWhileTyping` Function/instance — see the
"Chord-capture support in the main palette" migration row above.

## Data Acquisition & Result Destinations

**Framing:** KeyPilot's core value is *rapidly isolating and retrieving data from the page* through
several different UI workflows (hover-and-press, highlight-then-press, rectangle-select-then-press),
and then *doing something with that data*. Those are two independent, orthogonal concerns, and the
Function Library should model them as two separate dimensions on a `FunctionDef` rather than baking
one destination into each Function's handler:

1. **Data Acquisition** — *what data does this Function operate on, and when is it captured?*
2. **Result Destination** — *where does that data go once captured?*

This split is already half-real in the code (`action-result-delivery.js`'s `clipboard`/`popover`/
`both` destinations, reused by `SEND_TEXT_TO_AI`) — this section generalizes it to cover the new
cases: dictionary lookup, translation, and future Media Library / Scrapbook destinations for
`COPY_HOVERED_IMAGE` and selection-based Functions.

### Data Acquisition: `dataSource` + `dataKind`

| `dataSource` | When it's captured | Existing precedent |
|---|---|---|
| `underCursor` | Immediately at keydown, from the pointer position already tracked in `state.lastMouse` — no setup required. | `COPY_HOVERED_IMAGE` (`getHoveredImage(x, y)`), `ACTIVATE`'s click-under-cursor. |
| `textRange` | From a range the user set up *before* pressing the key — an active `window.getSelection()`, or KeyPilot's own Highlight / Rectangle-Select modes. | `SEND_TEXT_TO_AI` (`getSelectedPlainText()`), `HIGHLIGHT` / `RECTANGLE_HIGHLIGHT` modes. |
| `urlFetch` | Two-stage: first resolve a URL from `underCursor`/`textRange` (typically a hyperlink's `href`), then issue a **network fetch** of that URL to obtain the resource it points to. Async and can fail (404, CORS, timeout) in ways a DOM read never does — treat it as its own `dataSource`, not a flavor of `underCursor`. | None yet — see "Fetching vs. linking a URL" below (`FETCH_URL_FOR_MEDIA_LIBRARY`, design-only). |
| `none` | The Function doesn't read page data at all. | `NEW_TAB`, `CLOSE_TAB`. |

`dataKind` says *what shape* the acquired data is, independent of `dataSource`:

- `text`, with a granularity: `word` | `sentence` | `paragraph` | `hyperlink`. A `textRange`
  Function typically takes whatever range the user already selected; an `underCursor` text
  Function needs a granularity to know how much to grab around the pointer (e.g. "the word under
  the cursor" vs. "the sentence under the cursor").
- `media`, with a kind: `image` | `video` | `audio`. Media is effectively `underCursor`-only for
  now — there is no "select a video as a range" concept in the browser the way there is for text.
- `file` — an arbitrary downloaded document (PDF, `.mp3`, `.mp4`, archive, …), acquired by fetching
  a URL rather than reading something already rendered on the page. See "Fetching vs. linking a
  URL" below — this is *not* the same thing as `media`, which is read directly off an existing page
  element (`<img>`/`<video>`), not fetched over the network.

These two dimensions compose. Reusable, low-level **data-getter Functions** (the actual page-reading
primitives, callable standalone in a future macro script, or internally by a stock Function) fall
out naturally:

- `GET_TEXT_AT_CURSOR` — params: `{ granularity: word|sentence|paragraph|hyperlink }`, `dataSource: 'underCursor'`. Key-assignable.
- `GET_TEXT_RANGE` — no params, `dataSource: 'textRange'` (reads the current selection/highlight). Macro Step only (`assignableToKey: false`); Copy is the key action for the same data.
- `GET_MEDIA_AT_CURSOR` — params: `{ kind: image|video|audio }`, `dataSource: 'underCursor'`. Key-assignable.

A stock Function like `LOOKUP_WORD` or `COPY_HOVERED_IMAGE` is (conceptually) "one of the getters
above, piped into a destination" — expressed today as a single Function with both a `dataSource`/
`dataKind` and a `destinations` list, but decomposable into two Macro `Step`s (a getter + a
destination-writer, see `SHOW_POPOVER` below) once the macro builder exists. This is the same
"one Function now, N Steps later" relationship `TYPE_CHARACTERS` already has to a future macro
script — see "Problem this solves" above.

### Result Destinations: generalizing `RESULT_DESTINATION_PARAMETER`

`action-result-delivery.js` already has the right shape (`ActionResultDestination`: `clipboard` |
`popover` | `both`, delivered via `deliverActionResult`) — it just needs two changes to generalize:

1. **More destination values**, added incrementally as their sinks are built:
   - `clipboard` — existing, and the default for most stock Functions (convenient out of the box).
   - `popover` — existing (`showProcedureResultPopover`); the default for `LOOKUP_WORD`.
   - `modifyPage` — **new**. Writes the result back into the page's DOM in place of the source
     range (e.g. `TRANSLATE` replacing selected text with its translation). Needs a new delivery
     branch in `deliverActionResult` (or a sibling `deliverActionResultToPage`) that mutates the
     original DOM range/node rather than routing to clipboard or a popover.
   - `mediaLibrary` — **future**, not yet built. Sink for `media`- and `file`-kind data (e.g.
     `COPY_HOVERED_IMAGE` configured to save to the Media Library instead of the clipboard). Not
     image-only — per the "Fetching vs. linking a URL" note below, the Media Library is meant to
     store arbitrary document types (PDF, audio, video, …), not just images.
   - `scrapbook` — **future**, not yet built. Sink for `text`-kind data users want to accumulate
     across many keypresses instead of overwriting the clipboard each time (e.g. Rectangle Select
     configured to append to the Scrapbook instead of copying).
2. **Per-Function applicability.** Not every destination makes sense for every Function (e.g.
   `modifyPage` is meaningless for `media`-kind data; `mediaLibrary` is meaningless for `text`-kind
   data). Rather than one universal frozen `RESULT_DESTINATION_PARAMETER` constant, generalize it to
   a small factory, e.g. `buildResultDestinationParameter(applicableDestinations: ResultDestination[])`,
   so each `FunctionDef.parameters` only ever offers destinations that are valid for its `dataKind`.
   `FunctionDef.destinations` (in the data model above) is the declarative list a Function's factory
   call is built from — also usable by the Functions browser UI to show/hide destination-specific
   controls without inspecting the parameter schema.

Stock Functions still ship with one sensible default destination pre-selected (`clipboard` for
`COPY_HOVERED_IMAGE`/`CLIPBOARD_COPY`, `popover` for `LOOKUP_WORD`) so nothing needs configuring to
be useful immediately — swapping the destination (e.g. to the future Media Library) is discovered
by advanced users, not required by casual ones. This is the general design principle this whole
Function/Action Instance split exists to serve: **convenient by default, configurable for advanced
use**, applied consistently to acquisition targets and destinations, not just to things like
`TYPE_CHARACTERS`'s `text` parameter.

### `SHOW_POPOVER` as a composable primitive, not just a destination

`deliverActionResult`'s `popover` branch already calls `showProcedureResultPopover` internally —
that's a **destination behavior** baked into the delivery helper. The same behavior is also an
explicit Macro Step (`SHOW_POPOVER`), not a standalone key action (`assignableToKey: false`):

- `SHOW_POPOVER` — category `Display`; params: `{ content }` (fallback text if the previous step
  produced none). Takes whatever the previous Macro Step produced and renders it in a popover.
  Lives on the User Macros Logic/primitive palette, not in the Actions Library.

This is the concrete instance of the Automator/Shortcuts decomposition promised in "Problem this
solves": a casual user presses one key bound to the stock `LOOKUP_WORD` Function (data source +
destination bundled, zero setup); an advanced user chains
`GET_TEXT_AT_CURSOR { granularity: word }` → `DICTIONARY_LOOKUP` → `SHOW_POPOVER` as three explicit
Steps to build the same behavior with more control (e.g. inserting a translation step in between).

### New example Functions

All implemented in `buildDataAcquisitionFunctionDefs()` (`function-library.js`) + handlers in
`keypilot.js`, except the two Media Library rows, which are catalog entries with a shared
"not built yet" stub handler (no real sink exists — see below).

| Function id | `dataSource` / `dataKind` | `destinations` | Notes |
|---|---|---|---|
| `LOOKUP_WORD` | `underCursor`, `text` (`word`) | `popover` (default) | Dictionary definition popover via Free Dictionary API (`api.dictionaryapi.dev`) through the service worker. Optional `source: 'ai'` parameter is gated until the AI key system is available. Category `Lookup`. |
| `TRANSLATE` | `textRange` if an active selection exists, else `underCursor` (`word`\|`sentence`\|`paragraph`, user-configurable granularity) | `modifyPage`, `popover` | Same on-device AI provider, prompted to translate to a configurable target language. No `clipboard`/`mediaLibrary` — translating "to clipboard" isn't a meaningful default. Category `Translate`. |
| `GET_TEXT_AT_CURSOR` / `GET_MEDIA_AT_CURSOR` | see above | `clipboard` only | Low-level getters, key-assignable so they're useful today; also feed Macro destination Steps. |
| `GET_TEXT_RANGE` | `textRange`, `text` | none (yields prior result) | Macro Step only (`assignableToKey: false`). Same acquisition as Copy; Copy is the key action. |
| `ADD_URL_TO_MEDIA_LIBRARY` | `underCursor`, `text` (`hyperlink`) | `mediaLibrary` | Stores the link itself (`href` text), not its content. Category `Media Library`. Stub handler — see "Fetching vs. linking a URL" below. |
| `FETCH_URL_FOR_MEDIA_LIBRARY` | `urlFetch`, `file` | `mediaLibrary` | Fetches and stores the resource the link points to (e.g. a `.pdf`/`.mp3`/`.mp4`). Category `Media Library`. Stub handler — see "Fetching vs. linking a URL" below. |

`COPY_HOVERED_IMAGE` and `RECTANGLE_HIGHLIGHT` (existing Functions) should eventually gain a
`destinations` list (`clipboard` today; `mediaLibrary`/`scrapbook` once those sinks exist) rather
than being hardcoded to the clipboard — tracked as a follow-up, not done in this pass.

### Fetching vs. linking a URL — `FETCH_URL_FOR_MEDIA_LIBRARY` vs. `ADD_URL_TO_MEDIA_LIBRARY`

Design note surfaced while thinking through the Media Library: "the hyperlink under the cursor" is
not one Function's worth of behavior — it splits into two meaningfully different operations that
must not be conflated into a single Function, because they acquire *and* store fundamentally
different data:

| Function id | What it acquires | `dataSource` / `dataKind` | `destinations` |
|---|---|---|---|
| `ADD_URL_TO_MEDIA_LIBRARY` | The link itself — the `href` string under the cursor (or from a text range), stored as an `href`-tagged text record. Nothing is downloaded. | `underCursor` (or `textRange`), `text` (`hyperlink` granularity) | `mediaLibrary` (bookmark-style entry) |
| `FETCH_URL_FOR_MEDIA_LIBRARY` | The **resource the link points to** — resolves the same `href`, then performs an actual network fetch of it (e.g. the `.pdf`/`.mp3`/`.mp4` file at that URL), storing the fetched bytes. | `urlFetch`, `file` | `mediaLibrary` only — there is no sensible `clipboard`/`popover` behavior for an arbitrary fetched file today |

The distinction matters architecturally, not just semantically: `ADD_URL_TO_MEDIA_LIBRARY` is a
synchronous, always-succeeds DOM read (same shape as every other `underCursor` Function already in
the library) that produces a small text record; `FETCH_URL_FOR_MEDIA_LIBRARY` is an async network
operation with real failure modes (404, CORS, timeout, non-file content-type) and produces
arbitrary-size binary data. This is exactly why `urlFetch` is called out as its own `dataSource`
above rather than folded into `underCursor` — the two Functions look similar ("do something with
the link under the cursor") but have almost nothing in common at the implementation level once you
get past "resolve an `href` string." Both exist as `FunctionDef` catalog entries now (tagged with
the `dataSource`/`dataKind` split above), but share `handleMediaLibraryNotAvailableKey` — a stub
that just tells the user the Media Library isn't built yet — since neither the Media Library sink
nor a real `urlFetch`-capable handler (the actual network fetch + storage) exists in code yet.

## Naming conventions

- **Function ids**: `SCREAMING_SNAKE_CASE`, verb-first — `TYPE_CHARACTERS`, `PASTE_FROM_CLIPBOARD`,
  `SEND_HOTKEY`, `CLICK_ELEMENT`. Matches the existing `KEYBINDING_ACTION_DEFS` style, so no churn
  for already-shipped built-ins.
- **Type/class names**: `FunctionDef`, `FunctionParameterDef`, `UserAction` (Action Instance),
  `UserMacro`, `MacroStep`, `SlotAssignment`.
- **Storage id prefixes** (extends the existing `layout:` / `macro:` pattern): `layout:`,
  `macro:`, `action:` (replaces `macroKey:`).
- **File/module naming**:
  - `src/config/function-library.js` — replaces `KEYBINDING_ACTION_DEFS`'s export role in
    `keyboard-layouts.js` and absorbs all of `macro-keys.js`.
  - `src/modules/action-store.js` — generalizes the macro-key CRUD currently in
    `keyboard-layout-store.js` (`createUserMacroKey` → `createUserAction`, etc.), alongside the
    existing layout/macro CRUD.
  - `src/ui/function-config-panel.js` — generalizes `key-action-settings.js`'s
    `KeyActionConfigPanel` to edit any `UserAction`'s parameters, not just built-in action ids.

## Non-goals / open questions for later

- **Macro-of-macros / nesting**: shipped as `MacroStep.kind === 'runMacro'` with a runtime
  cycle guard in `_runMacroById` (rejects self / A↔B loops). Save-time cycle validation is still
  optional polish.
- **Conditional/branching steps**: shipped as `kind: 'gate'` (simple ops against the prior
  Function return; on fail skip `thenSkip` steps). Full Automator-style freeform branching /
  loops remain out of scope.
- **Versioning/migration of stored data**: existing stores already carry a `version` field
  (`kp_keyboard_layout_store_v1`), still at `1`. The `macroKey:` → `action:`,
  `kind`/`config` → `functionId`/`parameters` rewrite described in earlier drafts of this doc
  turned out not to need a `version` bump or migration logic at all: this extension has no
  shipped users, so the old shape was deleted outright (see the `SlotAssignment`/`UserMacroKey`
  migration rows above) instead of migrated. A real `version: 2` bump is deferred until there is
  actual persisted user data that would otherwise be lost. Logic step kinds are additive on
  read (`normalizeMacroStep`); legacy Function-only steps without `kind` still normalize.
