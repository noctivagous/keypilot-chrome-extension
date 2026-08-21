# Extension Technology Transition Roadmap

Assessed: 2026-08-20

## Introduction

This document turns the extension architecture assessment into an executable
transition plan. The work is ordered from approachable, low-risk gains to
larger structural changes. Each phase should leave the codebase better even if
later phases are deferred.

The objective is not to add formal technology everywhere. It is to formalize
the boundaries where KeyPilot currently has repeated UI/state patterns, weak
verification, or cross-context contracts that are difficult to change safely.
Performance-sensitive runtime systems should remain lightweight and
imperative.

### Persistent browser-chrome invariant

Keyboard Reference, Control Strip, and similar per-tab KeyPilot chrome must
give the impression of persistent browser-window UI across navigations:

> At `document_start`, mount each enabled persistent-chrome host from the last
> known lightweight UI state. The full runtime must adopt and hydrate that same
> host without removing, replacing, or visibly transitioning from a default
> state to the saved state.

This is a **bootstrap → reconcile → adopt** handoff:

1. Persist a lightweight bootstrap snapshot: visibility, collapsed state,
   panel anchor/position, layout id, and minimal theme tokens.
2. `early-inject.js` creates stable hosts and applies static CSS at
   `document_start`.
3. It reconciles the authoritative storage value as soon as available; it does
   not wait for the full application runtime.
4. The document-idle KeyPilot runtime attaches behavior to the existing hosts
   rather than tearing them down and remounting them.

The bootstrap snapshot must be intentionally smaller than the full settings
object. It needs only enough information to avoid a flash, position jump, or
temporary incorrect visibility. If storage is unavailable, retain a safe
fallback rather than blocking page startup.

The main conclusion remains:

- Do **not** adopt a general UI/data-binding framework in the current import
  graph.
- First add tests and explicit storage/message contracts.
- Then separate Settings state from its DOM view and introduce a declarative
  binder.
- Apply the proven controller/schema pattern to the keyboard configuration UI.
- Only then isolate extension-page UI bundles and consider Lit incrementally.

### Ordered transition summary

| Order | Transition | Complexity | Primary gain |
|---:|---|---|---|
| 1 | Testing infrastructure | Low | Safe refactoring and regression protection |
| 2 | Storage policy | Low–medium | Explicit ownership and predictable sync behavior |
| 3 | Messaging contracts | Medium | Validated communication across extension contexts |
| 4 | Settings controller and binder | Medium | Removes DOM/storage coupling and repeated bindings |
| 5 | Keyboard configuration schema | Medium–high | Applies reusable form architecture to the largest editable UI |
| 6 | Lazy UI bundles and optional Lit | High | Isolates UI dependencies from the content-script hot path |

Complete the task checkboxes in this order unless active feature work creates a
clear reason to advance one boundary sooner.

## Current architecture and constraints

The existing division of responsibilities is sound:

| Layer | Responsibility | Location |
|---|---|---|
| Settings domain | Defaults, migration, normalization, deep merging, Chrome storage | `src/modules/settings-manager.js` |
| Static view | Settings markup and controls | `pages/settings.html` |
| Settings controller | DOM lookup, model-to-view application, event handling, storage sync | `pages/settings.js` |
| Specialized keyboard UI | Incremental imperative keyboard renderer and popovers | `src/ui/keybindings-ui.js` |

`settings.js` must support both a standalone extension page and an in-page
Settings popover mounted in an open ShadowRoot. Its `settingsScope`,
`settingsEl`, and `settingsAll` helpers exist for that dual-hosting
requirement.

The settings controller has grown to roughly 1,400 lines. It contains:

- explicit lookup of many controls;
- `apply*` functions that update controls from a settings snapshot;
- about 60 individual event listeners that translate control changes into
  `setSettings` calls;
- storage change synchronization;
- behavior that is not ordinary form binding: theme application, cursor
  previews, master-detail navigation, accessibility keyboard interaction, and
  KeyPilot activation integration.

The Appearance section already proves out a useful partial abstraction:
`bindAppearanceControl`, `bindAppearanceRadios`, and
`bindAppearanceRangePair`. Click Mode, Text Mode, and Scrolling still repeat
the same range/number-pair and commit patterns manually.

## Why not add a framework now

### Dependency would reach the hot path

Settings is imported through the content-script graph:

`keypilot.js` → `overlay-manager.js` → `popover-controller.js` →
`pages/settings.js`

Therefore any static dependency imported by `settings.js` is shipped in
`content-bundled.js` for every matching page, even though Settings is only
opened occasionally. That makes a framework an unfavorable trade for this
specific cleanup.

The current esbuild pipeline intentionally emits IIFE bundles for content and
frame scripts. Settings is also available as a native-ES-module standalone
page. Introducing Lit, Preact, React, Vue, or Svelte without an import-graph
change would either enlarge the main content bundle or require additional
build/output work.

### A framework would not remove the difficult parts

Reactive rendering can remove ordinary input synchronization, but it does not
replace:

- Chrome storage persistence and cross-context synchronization;
- settings normalization and migration;
- ShadowRoot mounting and stylesheet injection;
- cursor previews and theme-token application;
- keyboard/popover behavior;
- content-script lifecycle and listener cleanup.

The most difficult and performance-sensitive extension systems—early
injection, target overlays, highlight geometry, keyboard handling, and the
Manifest V3 service worker—are not good targets for an application UI
framework.

### MV3 constraints

Manifest V3 permits third-party libraries only when they are packaged with the
extension and executed from local extension files. A CDN-loaded library or
other remotely hosted executable code is not permitted. The extension’s
current CSP already restricts executable scripts to `'self'`.

References:

- Chrome: <https://developer.chrome.com/docs/extensions/develop/migrate/improve-security>
- Chrome CSP reference: <https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy>

## Recommended evolution

### Target: framework-neutral controller

Make the current controller a transition layer before introducing Lit. Its
public contract should be independent of the DOM and of any rendering library:

```text
SettingsController
  ├─ load() / subscribe()          → settings-manager + chrome.storage changes
  ├─ state                         → normalized settings snapshot
  ├─ update(path, value)           → validate, merge, persist, update state
  ├─ reset(scope)                  → domain-specific reset actions
  └─ derived state                 → visibility, cursor-preview inputs, theme

Current DOM view
  ├─ render(controller.state)
  └─ bind(controller)

Future Lit view
  ├─ renders controller.state
  └─ calls controller.update(...)
```

The controller must not call `querySelector`, mutate elements, or depend on
whether it is mounted in `document` or a ShadowRoot. Conversely, the view must
not call `getSettings()` or `setSettings()` directly. This moves storage
loading, normalization, persistence, external storage subscriptions, and
reset orchestration out of `render()`.

Theme-token application and cursor previews can remain imperative adapters.
They subscribe to controller state now and can later be invoked from Lit
lifecycle hooks. This split is worthwhile even if the project never adopts
Lit: it removes the current DOM/storage coupling and gives the state behavior
an independently testable boundary.

### Target: internal declarative binder

Build a small internal control registry for routine controls, extending the
existing Appearance helpers. Each entry should describe:

- settings path;
- control type (`toggle`, `select`, `radio`, `rangePair`);
- element id(s) or selector;
- normalization/clamping;
- optional post-commit hook for a preview or dependent-visibility update.

The registry must:

- apply the relevant settings value to a control;
- install its listener(s);
- persist a normalized partial update;
- update paired controls without re-reading storage for every keystroke.

The existing DOM view should call `controller.update(...)` rather than
`setSettings(...)` directly. This means the binder becomes an adapter to the
controller, not a second source of settings behavior.

Use a single delegated handler only where it preserves current behavior.
The master-detail navigation deliberately uses per-tab listeners so KeyPilot
does not treat padding in the entire navigation column as an interactive
target; that behavior should remain explicit.

Keep dedicated imperative code for previews, resets, theme application,
keyboard handling, and other non-form behavior.

### Required regression coverage

The highest-value tests are currently missing:

- `settings-manager` defaults, migrations, normalization, and nested merge;
- storage update behavior;
- selected controller-level tests for a range pair, radio group, theme reset,
  and external `chrome.storage.onChanged` synchronization.

This matches the architecture audit’s P1 recommendation to establish a
minimal automated check path before further decomposition.

### Required lifecycle handling

Mount/unmount behavior deserves a focused review. The module tracks the
currently bound app root, but listeners are not centrally disposed on unmount.
A remount in the same ShadowRoot can risk duplicate bindings. The binder should
return cleanup callbacks (or use an `AbortController` signal) and the mount
API should invoke them.

### Lit migration path and threshold

Reconsider Lit or a similarly small component framework only when all of the
following are true:

1. Settings/keyboard configuration is being substantially redesigned, not
   merely deduplicated.
2. The Settings UI has a separate or lazy-loaded build entry, so the framework
   is not in the ordinary content-script payload.
3. The team wants components with independently tested state and templates
   across multiple extension-page surfaces.

Lit is the best fit if that threshold is reached because it aligns naturally
with Shadow DOM and can be bundled as local static code under MV3. It should
be introduced incrementally in extension-page UI, not imposed on content
scripts, the service worker, or geometry/overlay subsystems.

After the controller exists, migrate one isolated Settings panel at a time.
The concrete migration tasks appear in Phase 6 below.

This changes a full rewrite into a view swap: Lit owns templates and reactive
display, while the controller continues to own state and extension behavior.

## Execution plan

Technology is not the goal by itself. Each phase below addresses a specific
repeated pattern, untested boundary, or packaging constraint. Finish and
verify each phase before using it as a dependency of the next.

### Phase 1 — Add testing infrastructure

This is the highest-return and lowest-risk transition. Focused regression
coverage is P1 work in the architecture audit.

**Runner (locked):** Node built-in `node:test` + `node:assert/strict` (no Vitest).
CI can call the same `npm test` script when a workflow is added.

A minimal first pass is:

1. Add a runner and npm test.
2. Add Chrome API/storage mocks.
3. Test existing pure modules without changing production code:
- settings-manager.js
- URL policy
- message type helpers
- normalization/config modules
- Run tests locally and in CI.
That is mostly additive: test files, a small setup/mocking utility, and package scripts.

It becomes extensive only if you try to retrofit every large DOM and content-script subsystem at once. For those, first extract small pure functions or a controller boundary during normal feature/refactor work, then test that new seam. Don’t rewrite code solely to make all of it testable.

Tasks:

- [x] Select `node:test` (smallest runner that fits this ESM repo).
- [x] Add `test`, `test:settings`, and `test:storage` scripts to `package.json`.
- [x] Create reusable Chrome storage mocks for sync, local, and
  `chrome.storage.onChanged` (`test/helpers/chrome-mock.js`).
- [x] Test `settings-manager` defaults, normalization, migrations, and nested
  merge behavior (`test/settings-manager.test.js`).
- [x] Test the shared URL policy (`test/url-policy.test.js`).
- [x] Test message catalog / `TAB_UI_FORWARD_TYPES` without starting a browser
  (`test/messaging-types.test.js`). Full service-worker routing extraction
  remains Phase 3.
- [x] Document early-chrome handoff cases that require a real extension/browser
  environment (see below).
- [x] Run the test suite locally via `npm test`.
- [x] Document which behaviors still require browser-level coverage.

**What `npm test` covers today**

- `extension/src/utils/storage.js` — sync/local fallback, `_updatedAt` conflict,
  dual-write, total failure → default
- `extension/src/modules/settings-manager.js` — defaults, normalizers, legacy
  keyboard layout migration, nested merge, reset, storage failure → defaults
- `extension/src/config/url-policy.js` — skippable URLs/tabs, KeyPilot newtab allowlist
- `extension/src/messaging/types.js` — frozen `MSG` catalog and UI forward list

**Deferred — requires a real browser / extension load**

Do not automate these in Phase 1 (Playwright or similar can come later):

- Keyboard Reference and Control Strip across reload/navigation for
  visible, hidden, collapsed, and moved positions
- Delayed or unavailable storage at `document_start`: fallback may be used, but
  chrome must not block startup or flash an incorrect default before reconcile
- Document-idle runtime must **adopt** early-inject hosts rather than removing
  and remounting them (no position jump / default-to-saved flash)

Completion criteria:

- [x] Pure settings, URL-policy, and message-catalog regressions fail locally
  before a bundle is produced (`npm test`).
- [x] Later phases can add tests without inventing new harnesses
  (`test/*.test.js` + `test/helpers/chrome-mock.js`).
- [x] The test plan covers a delayed or unavailable storage read without
  blocking document-start chrome (documented above as browser-level).

### Phase 2 — Formalize storage policy

`settings-manager` and the shared storage helper are solid foundations. Phase 2
defines ownership and conflict rules rather than adding another abstraction
layer.

**Policy document:** [STORAGE_POLICY.md](./STORAGE_POLICY.md)

Tasks:

- [x] Inventory every direct `chrome.storage`, shared storage helper, and
  `localStorage` access (recorded in STORAGE_POLICY.md).
- [x] Assign ownership for values in `kp_settings_v1`.
- [x] Define the policy for sync-only keyboard-layout data
  (`kp_keyboard_layout_store_v1`).
- [x] Define the policy for local-only new-tab preferences (`kp_newtab_*`).
- [x] Define ownership for keyboard-reference and overlay-visibility keys
  outside the primary settings object.
- [x] Specify sync/local fallback behavior and timestamp conflict resolution.
- [x] Define a compact early-chrome bootstrap snapshot (`kp_chrome_layout_v1`)
  and its versioning, ownership, read/write timing, and fallback rules.
- [x] Include Keyboard Reference, Control Strip, and other persistent
  in-page windows that need document-start restoration.
- [x] Align `storageGetValue` and `storageGetKeys` timestamp/merge semantics
  (shared `resolveStoredAreas` / `_updatedAt` newer-wins).
- [x] Add tests for fallback, dual-write, partial failure, and conflict cases
  (`test/storage.test.js`).
- [x] Replace direct accesses only where the new policy establishes a shared
  owner — deferred mass migration of early-inject / onboarding / help dual
  paths; policy documents the intended owner and helper. No dedicated storage
  service introduced.
- [x] Introduce a dedicated storage service only if the implemented policy is
  otherwise repeated across multiple consumers — **not needed**; helper +
  STORAGE_POLICY.md suffice.

Completion criteria:

- [x] Every persisted value has a documented owner, storage area, fallback
  rule, and conflict rule ([STORAGE_POLICY.md](./STORAGE_POLICY.md)).
- [x] Storage behavior is tested independently of the UI (`npm test`).
- [x] The bootstrap snapshot can be read at document start without requiring
  the full settings model or expensive UI configuration (`kp_chrome_layout_v1`
  via localStorage; see policy).

### Phase 3 — Formalize messaging contracts

The extension communicates across a service worker, top-frame content script,
child frames, extension pages, and popovers. Complete the existing `MSG.*`
adoption before considering a larger language or framework transition.

**Contract document:** [MESSAGING_CONTRACT.md](./MESSAGING_CONTRACT.md)

Tasks:

- [x] Inventory remaining raw `KP_*` message literals and independent
  `onMessage` listeners (recorded in MESSAGING_CONTRACT.md).
- [x] Define one discriminated message catalog with documented payload and
  response shapes (`types.js` + MESSAGING_CONTRACT.md).
- [x] Register service-worker response types in the shared contract
  (`OMNIBOX_SUGGESTIONS`, `*_RESPONSE`, `NAVGRAPH_GRAPH`, `ACK`, …).
- [x] Replace extension-page and switch-case literals with shared message
  identifiers (SW, popup, pages, modules). **Exception:** `early-inject.js`
  keeps wire-compatible string literals (no ESM at document_start).
- [x] Add lightweight runtime validation at the SW boundary
  (`messaging/validate.js`).
- [x] Consolidate independent content-script listeners behind one router
  (`content-runtime-router.js`; KeyPilot, toggle, popover, media-library).
- [x] Keep one explicit router per receiving context (documented in
  MESSAGING_CONTRACT.md).
- [x] Test valid requests, invalid payloads, catalog completeness, and
  `TAB_UI_FORWARD` (`test/messaging-types.test.js`). Frame postMessage
  routing remains covered by existing frame-agent behavior + contract notes.
- [x] Document which messages are notifications and which require responses.

TypeScript is optional. JSDoc discriminated unions plus a small runtime
validator are sufficient if they provide one validated contract. A wholesale
language migration is not required.

Completion criteria:

- [x] No active message path depends on an undocumented raw string
  (catalog + contract; early-inject literals are wire values of `MSG.*`).
- [x] Invalid payloads fail predictably at a receiving boundary (SW
  `validateRuntimeMessage` → `MSG.ERROR`).
- [x] Each context has one discoverable routing entry point
  (MESSAGING_CONTRACT.md table).

### Phase 4 — Extract the Settings controller and declarative binder

Transition `pages/settings.js` to the framework-neutral architecture described
in [Recommended evolution](#recommended-evolution). This phase should preserve
the existing HTML and visual behavior.

Controller tasks:

- [x] Extract a `SettingsController` that owns normalized state, initial load,
  persistence, subscriptions, resets, and derived state.
- [x] Define `load()`, `subscribe()`, `update(path, value)`, `reset(scope)`,
  and disposal behavior.
- [x] Ensure the controller contains no DOM queries or element mutation.
- [x] Ensure the view no longer calls `getSettings()` or `setSettings()`
  directly.
- [x] Move `chrome.storage.onChanged` coordination into the controller.
- [x] Test update normalization, external storage changes, reset scopes, and
  disposal.

Binder and view tasks:

- [x] Define control metadata for `toggle`, `select`, `radio`, and
  `rangePair` controls.
- [x] Extend the existing Appearance binding pattern to Click Mode, Text Mode,
  Scrolling, and ordinary settings controls.
- [x] Route all routine control changes through `controller.update(...)`.
- [x] Remove unnecessary write/read/render storage round-trips.
- [x] Keep imperative adapters for theme application, cursor previews,
  visibility dependencies, resets, and keyboard behavior.
- [x] Preserve per-tab master-detail listeners so KeyPilot does not treat
  empty navigation padding as one interactive target.
- [x] Track listener cleanup with returned disposers or an `AbortController`.
- [x] Verify standalone document and embedded ShadowRoot mounts, unmounts, and
  remounts without duplicate listeners.
- [x] Keep Settings changes compatible with the early-chrome bootstrap
  snapshot; a settings save must not create a default-state flash on the next
  navigation.

Completion criteria:

- [x] Settings state can be tested without constructing a DOM.
- [x] The current DOM UI is an adapter over controller state.
- [x] Routine controls are described declaratively instead of each owning
  bespoke apply/commit wiring.
- [x] Standalone and popover Settings behave identically to the current UI.

### Phase 5 — Apply schema-driven controls to keyboard configuration

`src/ui/keyboard-layout-config-panel.js` is a larger editable UI monolith than
Settings (about 8,758 lines in the architecture audit). Apply the proven
Settings pattern when keyboard configuration work resumes; do not begin by
rewriting the entire panel.

Tasks:

- [ ] Identify one self-contained configuration section as the pilot.
- [ ] Separate that section’s state/actions from DOM rendering.
- [ ] Reuse the controller contract and control metadata concepts from
  Settings where they fit.
- [ ] Define declarative field schemas for range, select, radio, toggle, enum,
  and action-parameter controls.
- [ ] Preserve the existing key-action settings source of truth.
- [ ] Add tests for action-configuration state and schema normalization.
- [ ] Migrate additional sections only after the pilot reduces code and keeps
  behavior understandable.
- [ ] Keep keyboard geometry rendering outside the form-controller layer.

This is a better candidate for formal UI composition than
`keybindings-ui.js`, which is an incremental keyboard-geometry renderer rather
than a conventional form.

Completion criteria:

- [ ] At least one real keyboard-configuration section uses the shared
  controller/schema approach.
- [ ] The approach demonstrably reduces duplicated binding code before wider
  adoption.

### Phase 6 — Create lazy UI boundaries and evaluate Lit

Settings is statically reachable through:

`keypilot.js` → `overlay-manager.js` → `popover-controller.js` →
`pages/settings.js`

An external UI runtime imported today would therefore increase
`content-bundled.js` on every matching page. Isolate occasional UI before
adding Lit or another component framework.

Build-boundary tasks:

- [ ] Record current content bundle size and startup/performance baselines.
- [ ] Design a separate or lazy Settings entry that works for both the
  standalone page and embedded popover.
- [ ] Remove the static Settings implementation from the ordinary
  content-script dependency graph.
- [ ] Load Settings, Docs, and future configuration UI only when opened where
  practical.
- [ ] Give extension-page UI its own bundle-size budget and dependency
  boundary.
- [ ] Preserve MV3 local-package, CSP, web-accessible-resource, and ShadowRoot
  requirements.
- [ ] Verify packaged builds do not depend on remote code or development-only
  dynamic paths.
- [ ] Verify a framework or lazy bundle cannot delay the document-start
  persistent-chrome bootstrap.

Lit evaluation and pilot tasks:

- [ ] Confirm there is a real redesign/component reuse need beyond binding
  deduplication.
- [ ] Compare the isolated bundle and maintenance cost of Lit against the
  existing DOM adapter.
- [ ] If justified, render one isolated Settings panel with Lit while keeping
  `SettingsController` unchanged.
- [ ] Verify storage synchronization, resets, accessibility, theme behavior,
  and embedded ShadowRoot mounting for the pilot.
- [ ] Verify a Lit panel adopts an existing early-created host when applicable;
  it must not replace it with a late-mounted root.
- [ ] Retire the corresponding imperative renderer only after equivalent
  regression coverage exists.
- [ ] Decide whether to continue panel-by-panel or retain the hybrid design.

The existing esbuild setup can implement this boundary. Vite, WXT, or another
build system should be adopted only for a concrete development, cross-browser,
or packaging requirement—not as a prerequisite for Lit.

Completion criteria:

- [ ] Occasional extension-page UI dependencies are absent from the eager
  content-script hot path.
- [ ] Any Lit adoption is incremental, measured, reversible, and backed by the
  framework-neutral controller.
- [ ] Navigation restores enabled Keyboard Reference, Control Strip, and other
  persistent chrome without host replacement, position jump, or
  default-to-saved-state flash.

## Avoid framework migrations for:

- **Early injection:** it runs at document start and is optimized for perceived
  startup performance.
- **Content-script key handling:** it is hot-path interaction code, not
  component UI.
- **Overlay and focus painting:** it has DOM-geometry and rendering-performance
  constraints better served by small pure modules and performance tests.
- **Selection/highlight geometry:** its correctness depends on browser ranges,
  rectangles, and event timing rather than declarative UI rendering.
- **The MV3 service worker:** it needs explicit lifecycle, Chrome API, and
  message-routing boundaries—not a visual component framework.
- **`keybindings-ui.js`:** its incremental DOM reuse and keyboard-layout
  geometry are already a suitable imperative renderer.

Those systems should evolve through pure-function extraction, targeted tests,
profiling, lifecycle discipline, and clearer contracts. A UI framework would
not simplify their core work and may compromise bundle size or startup
behavior.

## Transition status

Use this as the high-level progress index; the detailed checkboxes above define
completion.

| Done | Phase | Deliverable |
|---|---:|---|
| [x] | 1 | Test runner, Chrome API mocks, and initial pure-module coverage |
| [x] | 2 | Documented and tested storage ownership/conflict policy |
| [x] | 3 | Shared validated message catalog and one router per context |
| [x] | 4 | Framework-neutral Settings controller and declarative DOM binder |
| [ ] | 5 | Proven schema-driven keyboard-configuration pilot |
| [ ] | 6 | Lazy UI bundle boundary and evidence-based Lit decision |

The architectural issue is not that KeyPilot lacks a framework. Its most
valuable transitions are verification, explicit contracts, state/controller
boundaries, and UI packaging. Improve those boundaries first; make a framework
decision only after the UI import and bundle boundaries support it.
