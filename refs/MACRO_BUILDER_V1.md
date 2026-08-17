# Macro Builder v1.0 — grouping, conditionals, loops, variables

Product recommendation for a complete-but-friendly Macro Builder. Not an implementation spec.

**`extension/src/ui/macro-key-editor.js` is not the Macro Builder.** It only configures Macro Keys (hotkey, burst, round-robin, continuous, mouse, remap). The step list lives in `keyboard-layout-config-panel.js` and runs as a **flat sequence** in `_runMacroById` (`extension/src/keypilot.js`).

Today: Function steps plus Wait, Gate (`thenSkip` N steps), Stop, and Run Macro. Gates only inspect the previous Function result. That is enough for “copy then maybe search”; it is not enough for real branching, loops, or named state.

For a **keyboard overlay**, the right model is Keyboard Maestro’s nested action list (indent + containers), not Make/n8n’s node canvas. Canvas tools win at routers and iterators; they feel like work and fight a compact Layout Config UI.

---

## The one structural change v1 needs

Treat **Group** as the primitive. If, Switch, Repeat, While, and For-each are Groups with a rule.

Replace “skip the next N steps” as the user-facing branch. `thenSkip` breaks as soon as someone inserts a step. Nesting makes the scope visible:

```
1. Set $query ← prior result
2. If (has a value)
     2.1 Open Omnibox
     2.2 …else (optional)
          2.2.1 Stop
3. Switch ($mode)
     case highlight → …
     case browse → …
     default → …
4. Repeat 3 times
     4.1 Page down
     4.2 Wait 80ms
5. For each tab in open tabs
     5.1 …
6. While (true) — max 20
     6.1 …
     6.2 Break when …
```

Cap nesting (about **3 levels**). Offer **Wrap selection in Group / If / Switch / Repeat / While / For-each** so people do not have to build the tree first.

---

## v1.0 must-have

### 1. Group / subgroup (always)

- Named, collapsible container
- Indent + colored bar so nesting is obvious
- Move whole group; **drag steps in/out and reorder** (HTML5 reorder on the script list — not only ↑/↓)
- Optional: disable a group without deleting it

This is organization *and* the body of If / Switch / Repeat / While / For-each.

### 2. If / Else (not skip-N)

- **If** wraps a then-group; **Else** is optional
- Else-if = another If inside Else, *or* use Switch when there are many discrete arms
- Condition picker stays chip-like: Has value / Empty / Equals / ≠ / > / <
- **Left side** (small set, not a language):
  - Previous step result (keep `leftKey` for object fields)
  - Named variable (see §5)
  - Page URL contains
  - Mode (e.g. highlight vs browse)
  - Selection / hover present
- **Stop** still valid inside a branch

Migrate existing Gates: `thenSkip: N` → If whose then-group is the next N steps.

### 3. Switch / case

- **Switch** on one left-side value (prior result, variable, mode, URL host, …)
- Ordered **case** arms + optional **default**
- Each arm is a nested group (same container model as If)
- Prefer Switch when branching on 3+ discrete values; keep If for binary / inequality tests

### 4. Loops (four kinds)

| Kind | User wording | Safety |
| --- | --- | --- |
| **Repeat N** | “Do this 3 times” | N capped (e.g. 50) |
| **Repeat until** | “Until condition, at most N” | Hard max iterations always |
| **While (true)** | “Keep going” / “Loop forever” | **Always** requires max iterations (and/or max duration); no uncapped infinite loop |
| **For each** | “For each item in …” | Bound by list length + global max; empty list = no-op |

**For-each sources (v1, small set):**

- Open tabs (current window / all windows)
- Search / find hits when a prior step produced a list
- Query-selector matches from Execute JS / a list-producing Function (when the result is an array)
- Explicit list variable (see §5)

Inside a loop, ship **Break** (leave the loop) and **Continue** (next iteration).

**While(true)** is a first-class container (not start/end tokens). The inspector always shows the hard max; running past max = Stop with a clear status.

### 5. Variables & assignment

Named slots so macros are not stuck on `kpPriorResult` alone:

- **Set** / **Assign**: `$name ←` prior result | literal | expression chip (same ops as conditions: equals field, URL, mode, …)
- **Append** / **clear** for list variables (feeds For-each)
- Read variables in conditions, Switch, Wait summaries, and as Function parameter overrides where the inspector already accepts text
- Scope: **macro-local** in v1 (cleared when the macro ends). Nested **Run Macro** does not inherit parent vars unless we add an explicit “pass variables” toggle later

Keep `kpPriorResult` as the default left side; variables are opt-in when you need a second value or a loop accumulator.

### 6. Keep, and tighten

- **Wait** (and delay-before on Functions)
- **Run Macro** (sub-workflow; cycle guard already exists)
- **Stop** (end whole macro)
- Function library + Macro Keys as steps
- Name, duplicate, place, **Run from builder**

### 7. Builder UX that keeps it friendly

Without these, groups feel like a mini IDE:

- Wrap / unwrap selected steps
- Collapse groups; numbered outline (`2.1.3`)
- Insert between steps (not only append)
- Duplicate step or group
- **Drag-reorder steps** (and drag into / out of groups)
- Plain-language row summary: `If copy has a value` / `Repeat 3×` / `Set $q` / `For each tab`
- **While running: highlight current step** (and a way to cancel — Esc / existing cancel)
- Max-iteration and cycle warnings in the inspector (nested Run Macro already warns)

### 8. Runtime safety (non-optional with loops)

- Global max iterations / max duration
- Yield between iterations so the page stays responsive
- Escape / cancel aborts the running macro
- Failed Function still does not kill the rest (current behavior), but If / Switch / While conditions should see “failed” as empty/falsy so branches work
- While(true) and Repeat-until always enforce a hard cap

---

## v1.0 if time (not blockers)

- Step notes / custom labels
- Compound condition: **And / Or of two tests** only (no boolean trees)
- **Contains** / **URL matches** as extra ops
- Per-step “stop macro on error” toggle
- Stock macros that *use* If + Repeat + Set so the pattern is copy-pasteable
- Pass-selected-variables into nested Run Macro

---

## Explicitly out of v1.0

| Skip | Why |
| --- | --- |
| Node canvas / routers | Wrong density for Layout Config |
| Try/catch, parallel, recording | Power-user; later |
| Loop start–end tokens | Easy to mismatch; containers cannot |
| Full expression language | Chip pickers + assignment only |
| Cross-macro persistent variables | Macro-local scope first |

Loop start/end chips (as on some “macro builder” sites) look simple and then produce broken macros. **Containers only** — including While(true) and For-each.

---

## How this maps onto what we have

| Now | v1 |
| --- | --- |
| Flat `steps[]` | Tree: steps may have `children[]` |
| `gate` + `thenSkip` | `if` with `then` / `else` groups |
| No multi-way branch | `switch` with `cases[]` + `default` |
| No loops | `repeat` `{ times }` / `{ until, max }` · `while` `{ max }` · `forEach` `{ source }` |
| `kpPriorResult` only | + `set` / variables (`$name`) |
| Logic chips: Wait, Gate, Stop, Run Macro | Wait, **If**, **Switch**, **Repeat**, **While**, **For each**, **Group**, **Set**, Stop, Break, Continue, Run Macro |
| `macro-key-editor.js` | Unchanged: keystroke primitives, not control flow |

`MACRO_BUILDER_STEP_TYPES` in `macro-keys.js` would grow; the inspector already isolates Logic editing from the compact canvas — keep that split.

Current schema (`MacroStep` in `keyboard-layout-store.js`): `function` \| `wait` \| `gate` \| `stop` \| `runMacro`. Gate ops: truthy / falsy / eq / neq / gt / lt, optional `leftKey`. Nested macros are cycle-guarded. Failures are swallowed.

---

## Suggested chip palette (v1)

**Actions:** Function / Macro Key  
**Timing:** Wait  
**Structure:** Group  
**Decide:** If (Else is a slot on If), Switch  
**Repeat:** Repeat N, Repeat until, While (true), For each  
**State:** Set (assign / clear)  
**Flow:** Stop, Break, Continue, Run Macro  

That is a complete, still-friendly v1: grouping is the product; If, Switch, Repeat, While, and For-each are groups with rules; variables are named slots beside `kpPriorResult`; and we avoid a second programming language or a node canvas.

---

## Industry notes (research)

- **Keyboard Maestro** (best analog): indented nested actions; If/Then/Else, Switch/Case, Repeat/While as containers; variables; Pause; Cancel. Not a node canvas.
- **Make / n8n / Zapier**: visual canvas, routers, iterators — overkill for this UI; borrow the *ideas* (iterator, router), not the layout.
- **Macro-builder-style tools**: Repeat Until Found, Loop Start/End, conditional blocks — start/end tokens are the failure mode to avoid.
- **Flowmattic-style modules**: Router/Branch ≈ Switch/If; Iterator ≈ For-each; Filter ≈ If; Sub-Workflow ≈ existing Run Macro.
