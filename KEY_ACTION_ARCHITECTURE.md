# Key Action & Macro Composition Architecture

## Status

**Design proposal — not yet implemented.** This document defines the target vocabulary and data
model for the Keyboard Layout Config system (functions, key actions, action instances, macros).
It is written against the *current* code (see "Current state" below) so the migration path is
concrete, but no refactor has happened yet.

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
  description: string;
  handler: string;            // name of the runtime handler function
  parameters?: FunctionParameterDef[];   // omitted/empty => parameterless
  keyboardClass?: string;     // rendering hint for the keycap
  category?: string;          // grouping in the Functions browser
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

// Macro — an ordered script of Function calls. Itself assignable to a slot.
type MacroStep = {
  functionId: string;
  parameters: Record<string, any>;
  delayMsBefore?: number;     // future: sequencing controls
};

type UserMacro = {
  id: string;                 // "macro:<uuid>"
  label: string;
  icon?: string;
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
  type 'macro'                   -> look up UserMacro -> for each Step, in order:
                                     look up FunctionDef by functionId -> call handler(parameters)
                                     (respecting delayMsBefore once sequencing exists)
```

This is one resolution path regardless of whether the underlying behavior is "simple" or
"composed," which is what lets the Functions browser and the future Macro builder share a single
drag source (the Function Library) instead of needing separate "functions" vs "macroKeys" tabs.

## Migration mapping (current code → target)

| Current | Target |
|---|---|
| `KEYBINDING_ACTION_DEFS` (`keyboard-layouts.js`) | Entries become `FunctionDef`s in the unified **Function Library**. `handler` field carries over unchanged. |
| `MACRO_KEY_KIND_DEFS` (`hotkey`, `burst`, `roundRobin`, `continuous`, `mouse`, `key`) | Become ordinary `FunctionDef`s with real parameter schemas instead of bespoke `config` blobs, e.g. `SEND_HOTKEY { stroke }`, `SEND_BURST { steps[], gapMs }`, `CYCLE_ROUND_ROBIN { items[] }`, `HOLD_CONTINUOUS { stroke, intervalMs }`, `CLICK_MOUSE_BUTTON { button }`, `REMAP_KEY { stroke }`. The standalone "macro key kind" concept goes away — it was already 90% of the way to being Action Instances. |
| `UserMacroKey` (`macroKey:<id>`, `{ kind, config }`) | Generalized to `UserAction` (`action:<id>`, `{ functionId, parameters }`). Same storage module, generalized shape; existing kind-specific `normalize*/default*/summarize*` helpers move to per-`FunctionDef` parameter validators. |
| `ACTION_SETTINGS_REGISTRY` + `settings.actionSettings[actionId]` (global values) | Parameter **schema** (`ActionParameterDef`) moves onto `FunctionDef.parameters`. Parameter **values** move out of global settings and into per-slot `UserAction.parameters`. Global settings are no longer a valid place to store per-key-assignable values. |
| `UserMacro.actions: any[]` | Becomes `UserMacro.steps: MacroStep[]`, composed from the same Function Library — unifies "macro script composition" with single-key Actions under one vocabulary instead of a second ad hoc one. |
| `SlotItem { type: 'action'|'macro', id }` | Renamed `SlotAssignment` for clarity (see data model above); `'action'` splits into bare-Function vs Function+instance as described. |
| Config panel tabs: `functions` / `macros` / `macroKeys` | Collapses to two: **Functions** (browse the library; dragging a parameterized Function onto a slot auto-creates a default `UserAction`) and **Macros** (the script builder). "macroKeys" stops being a separate tab/concept. |

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

- **Macro-of-macros / nesting**: not addressed here. Recommendation when it comes up: a
  `MacroStep` may reference `macroId` instead of `functionId` (sub-macro call), with cycle
  detection at save time — but this is out of scope until the macro builder itself exists.
- **Conditional/branching steps** (`gate` in today's `MACRO_BUILDER_STEP_TYPES`): left as a future
  `MacroStep` variant; no schema decision made yet.
- **Versioning/migration of stored data**: existing stores already carry a `version` field
  (`kp_keyboard_layout_store_v1`); a real migration (rewriting `macroKey:` → `action:`,
  `kind`/`config` → `functionId`/`parameters`) will be a one-time `version: 2` bump when this is
  implemented, not covered here.
