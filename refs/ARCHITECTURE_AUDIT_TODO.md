# KeyPilot Architecture Audit — Current Backlog

Refreshed 2026-08-19 against the active extension sources and esbuild pipeline.
Priority: **P1** = protect current behavior / high leverage, **P2** = targeted
cleanup, **P3** = defer until feature work creates a clear seam.

---

## Completed since the original audit

- [x] Delete unused `extension/src/utils/logger.js`
- [x] Forward `KP_OPEN_SETTINGS_POPOVER` / `KP_OPEN_GUIDE_POPOVER` / `KP_OPEN_ONBOARDING` from service worker → tab content script

---

## Confirmed product decisions

- [x] **Text-highlight subsystem:** choose one path  
  - [x] **Option A:** Re-bind `HIGHLIGHT` / `RECTANGLE_HIGHLIGHT` in `keyboard-layouts.js` and ship the feature  
    - Right: **H** = character text select, **Y** = rectangle select  
    - Left: **G** = character, **R** = rectangle  
    - Character default uses caret APIs (`caretRangeFromPoint`); edge-only stack is **lazy** (rectangle only)  
    - Do not re-enable edge analytics/HUD by default  
  - [x] Document decision in architecture notes (this file)
- [x] **Hover targeting:** keep DOM-hover only (product decision)  
  - [x] DOM-hover permanent: primary path for normal browsing; F / special modes fall back to `elementFromPoint`  
  - [x] Dropped `src/vendor/rbush.js`; build no longer ships RBush  
  - [x] Isolated residual RBush code in `intersection-observer-manager` (`_rtreeEnabled()` always false; `setupSpatialIndex` no-op)  
  - [ ] P2 follow-up: delete the unreachable `_rtree*` state, methods, call sites,
    and debug/memory metrics. This is deletion work rather than an esbuild
    tree-shaking task: class methods remain bundled even when disabled.
- [x] **Text Select (H) geometry:** ship **caret-to-caret** (model B), not rectangle
  membership (model A).
  - Live path: `caretRangeFromPoint` / `caretPositionFromPoint` → one document-order
    `Range`. The dashed overlay is a **drag guide**, not a clip. Text that intersects
    the rect edge or sits inside the box but is not between the two carets is
    expected to be omitted; text between the carets but outside the box is expected
    to be included.
  - Do **not** re-enable `USE_EDGE_ONLY_SELECTION` for accuracy (broken non-ancestor
    IntersectionObserver root).
  - [ ] **Deferred — model A:** include a character iff its glyph box intersects the
    dashed rect (edge counts; no document-order holes). Chromium cannot express
    disjoint runs as one `Selection` range, so A needs intersecting runs plus CSS
    Highlight (or overlays) and assembled clipboard. Full-document TreeWalker on
    mousemove is rejected (historical freeze). First A slice is likely hybrid: keep
    B live, refine to intersecting runs on complete. Implementation seam: P2
    selection-session extract and P3 pure geometry predicates
    (`character-box` AABB, not glyph-center).
  - **Y (2026-08-19):** overlap uses `getClientRects()`. Default granularity is an
    article feature unit: `p` / heading; whole `table` (not cells); whole `figure`
    or `picture` (not the inner `img`); whole `ul`/`ol`/`dl`. Hitting a link inside
    a paragraph selects the paragraph immediately. Landmarks (`article`/`section`/…)
    yield to those inner units. Standalone `img`/`a` (no aggregate/atom ancestor)
    stay selected. Tag-list expansion (`div`/`span`/…) remains a later pass.

---

## P1 — Single source of truth

- [x] Shared **`isTypingContext`** in one util; use from `event-manager`, `content-script`, `popover-bridge` (align with `SELECTORS.FOCUSABLE_TEXT`)
  - `src/utils/dom-context.js`
- [x] Shared **skip-URL patterns** for `isSkippableTab` / `isSkippableUrl` in `background.js`
  - `src/config/url-policy.js` (SW imports as ES module)
- [x] Scroll distances (`800` / `500`) → constants used by `keypilot.js` and iframe bridges
  - `SCROLL` in `src/config/constants.js`
- [x] **`KP_*` message types** → `src/messaging/types.js` (or similar) enum + payload notes
  - [ ] Complete adoption: register service-worker response types, replace raw
    `KP_*` switch cases and extension-page literals with `MSG.*`, then consolidate
    the independent content-script `onMessage` listeners behind one router.
- [x] Rename **`ACTIVATE_NEW_TAB` / `ACTIVATE_NEW_TAB_OVER`** so id, label, and handler names match behavior
  - `ACTIVATE_NEW_TAB` → foreground (`handleActivateNewTabKey`, B/N)
  - `ACTIVATE_NEW_TAB_BACKGROUND` → background (`handleActivateNewTabBackgroundKey`, G/H)
- [x] **Cursor settings:** migrate fully to `kp_settings_v1` / `settings-manager`; remove legacy `keypilot_cursor_size` / `keypilot_cursor_visible` dual path
  - Removed dead SW cursor APIs; early-inject already used `kp_settings_v1`
- [x] **Search engines:** one config shared by settings + launcher “searches” list
  - `src/config/search-engines.js` (`SEARCH_ENGINE_META` + `LAUNCHER_SEARCH_SITES`)
- [x] **Z-index stack:** fix `FLOATING_KEYBOARD_HELP` / `KEYBINDINGS_POPOVER` (1e6) vs overlay base (~2e9); generate CSS vars from one map
  - Now `2147483045` / `2147483046` (below cursor, above omnibox)

---

## P1 — Configuration sources of truth

- [x] Launcher category catalog: `src/config/launcher-sites.js`.
  - The former `launcher-sites.json` proposal is obsolete. JavaScript intentionally
    composes imported search-site data and is bundled by esbuild.
- [x] Search engine metadata and Launcher search sites:
  `src/config/search-engines.js`.
- [x] Scroll constants: `SCROLL` in `src/config/constants.js`; a standalone JSON
  file is unnecessary.
- [x] Onboarding source and its early-inject build stamp remain the source of truth.
- [x] Keep feature flags and selection-performance knobs in JavaScript unless a
  runtime-editable configuration requirement emerges.

### P1 — Add regression coverage before further decomposition

- [ ] Establish a minimal automated check path for settings normalization/migration,
  message routing, URL policy, and early-inject handoff.
  - `package.json` has build, packaging, and audit scripts but no test script.
  - Start with pure modules and service-worker routing seams; add browser-level
    tests only where they cover behavior unit tests cannot.
  - Browser-level handoff coverage must reload/navigate with Keyboard Reference
    and Control Strip visible, hidden, collapsed, and moved; assert that the
    document-start host is adopted rather than replaced by the document-idle
    runtime.
  - Include delayed/unavailable storage cases; a fallback may be used, but
    document-start chrome must not block or flash through an incorrect default
    state before its persisted state is reconciled.

### P1 — Persistent in-page chrome handoff

KeyPilot's Keyboard Reference, Control Strip, and similar windows are intended
to feel like persistent browser chrome across navigation. Treat this as an
architecture invariant:

> `early-inject.js` mounts enabled persistent-chrome hosts at `document_start`
> from a lightweight last-known state; the full runtime reconciles and adopts
> those same hosts without removal, replacement, position jump, or a
> default-to-saved-state flash.

- [ ] Define the compact bootstrap snapshot and its owner: visibility,
  collapsed state, panel position/anchor, selected layout id, and the minimal
  theme tokens required for first paint.
- [ ] Keep the snapshot smaller than the full settings model; it must be
  available without waiting for expensive configuration or UI work.
- [ ] Define sync/local fallback, versioning, and write timing for the
  bootstrap snapshot.
- [ ] Audit `early-inject.js` mounts for Keyboard Reference, Control Strip,
  and other persistent windows to ensure each creates one stable host.
- [ ] Ensure document-idle KeyPilot code adopts the early-created host and
  attaches behavior without disconnecting or recreating it.
- [ ] Reconcile authoritative storage as soon as it is available, retaining a
  safe fallback rather than blocking document start.
- [ ] Test host identity, visibility, collapsed state, and panel position
  across reload/navigation and storage delay/failure.
- [ ] Require future Settings, build, and UI-framework changes to preserve this
  bootstrap → reconcile → adopt contract.

---

## P1 — Deduplicate parallel implementations

- [x] Merge **popover bridge** logic (`content-script.js` vs `pages/popover-bridge.js`)
  - Shared `src/modules/popover-iframe-bridge.js` (`installPopoverIframeBridge`)
  - Thin wrappers: `frame-agent-entry.js` (frame setup) and
    `pages/popover-bridge.js` (extension-page behavior).
- [x] Route live highlight/selection geometry through **`HighlightManager`** only
  - Live path uses caret APIs inside HighlightManager (no KeyPilot TreeWalker binds)
  - Deleted ~1.2k LOC of dead parallel selection construction in `keypilot.js`
  - Remaining KeyPilot highlight methods: session orchestration (start/update/complete/cancel + clipboard)
- [x] Prefer **`url-listing.js`** for launcher domain/path/favicon helpers
  - Added `extractDomain` / `extractPath`; launcher uses them + `createFaviconImg`
  - Card layout still launcher-specific (YouTube thumbs + preview button)
- [x] Shared storage helper (sync → local → default)
  - `src/utils/storage.js` (`storageGetValue` / `storageGetKeys` / `storageSetValue` / `storageSetObject`)
  - Wired: settings-manager, keypilot keyboard-help, onboarding, SW enabled flag + navgraph mode, newtab
  - [ ] Define the remaining storage-policy boundaries: direct sync-only keyboard
    layout writes, localStorage new-tab display preferences, overlay visibility
    keys outside `kp_settings_v1`, and the inconsistent timestamp merge behavior
    between `storageGetValue` and `storageGetKeys`.

---

## P2 — Small cleanups

- [ ] Remove `pendingKeyEvents` and its `KEYPILOT_EARLY` accessors from
  `early-inject.js`, or add a real handoff consumer.
  - It is appended to on qualifying keydown events and trimmed every five seconds,
    but no source consumer calls `getPendingKeyEvents` or `clearPendingKeyEvents`.
  - Prefer removal unless a documented startup-loss scenario requires replay.
- [ ] Audit the parallel early-inject toggle path against `KeyPilotToggleHandler`
  for duplicate-toggle races during the document-start → document-idle handoff.
- [ ] Treat `early-inject.js` as generated/stamped output: review its input changes
  and keep its CSS (especially print rules) synchronized with `StyleManager`.
- [x] Remove `babel.config.cjs` after a clean `npm run build` confirms no external
  tooling relies on it.
  - Deleted `extension/babel.config.cjs` (2026-08-19). Build is esbuild-only; no
    Babel dependency or script in `package.json`.
- [x] Gate **`console.log` / debug noise** behind `KEYPILOT_DEBUG` (hot paths especially)
  - `src/utils/debug.js` + Settings → About → Debug logging (`debugLogging`, default off)
  - Verbose `console.log`/`debug`/`info` wrapped in content script, frame agent, and service worker
- [x] Default verbose feature flags off (`DETAILED_EDGE_LOGGING`, etc.)
- [x] Document messaging policy: extension page → SW → `tabs.sendMessage` for tab-local UI
- [x] Update README if it still references deleted `utils/logger.js`

---

## P2 — Split monoliths (medium)

Do not split these solely for a store submission. 2026-08-19: deferred except extracting `src/utils/debug.js`. Revisit when adding tests or removing duplication.

### `keypilot.js` (8,783 LOC)

- [x] Extract `navigation-handlers.js` (back/forward/tabs/root/scroll)
  - Mixin `withNavigationHandlers` in `src/modules/navigation-handlers.js` (~1,087 LOC)
  - Layout dispatch is unchanged: handlers still live on the KeyPilot instance
    prototype chain as `this[handler]()`.
- [x] Extract `activation-handlers.js` (F/G/B, open popover)
  - Mixin `withActivationHandlers` in `src/modules/activation-handlers.js` (~283 LOC)
  - Semantic DOM click remains in `activation-handler.js`; iframe/flash helpers stay
    on KeyPilot. Preview popover (P) stays in `keypilot.js`.
- [ ] Extract selection-session orchestration only when selection work needs a
  separately testable boundary; `HighlightManager` remains the geometry owner.
  - **Hold.** Not next work. Caret bugs (2px complete throttle, element caret
    offset) and Y feature-unit matching (`getClientRects`, aggregate table/figure/list,
    paragraph over inner links, landmarks yield) were fixed **in place**. Extracting
    start/update/complete/cancel/clipboard from `keypilot.js` would not have
    helped those and would only add a file boundary.
  - **Do extract** when shipping **model A** (live caret vs complete intersecting
    runs — that is a real session seam) or when adding tests that cannot reach
    the session without booting KeyPilot. Do not move caret or Y feature-target
    math out of HighlightManager.
- [ ] Keep thin orchestrator: init, `handleKeyDown` dispatch, module wiring

### `overlay-manager.js` (~4,156 LOC façade)

- [x] Extract popover controller (`src/modules/popover-controller.js`, ~1,219 LOC)
  - E-key in-page iframe modal, Docs/Settings hosts, http(s) OS window
  - P-key Link Preview is OS-window-only (`showPreviewPopover`); not a
    separate in-page iframe module
  - OverlayManager keeps public delegates + `popoverContainer` /
    `_popoverWindowUrl` getters for callers
- [x] Extract focus-overlay drawing (`src/modules/focus-overlay.js`, ~5,164 LOC)
  - Backends + A/B/C paint + text-field hints; paint fields stay on the
    OverlayManager façade (IO/scroll read `focusOverlay` / `_inTargetRing`)
- [x] Keep `OverlayManager` as façade (inspector, highlight wrappers, edge-jump,
  debug HUD, `updateOverlays` orchestration)

### `background.js` (3,089 LOC)

- [ ] Split: toggle, omnibox/history APIs, navgraph, tab navigation, message router
- [ ] Shared `url-filters` module

### `launcher-popover.js` (4,007 LOC)

- [ ] Data load vs UI build vs preview as separate modules
- [x] Load sites from `src/config/launcher-sites.js`; do not reintroduce a
  JSON-only requirement.

### `keyboard-layout-config-panel.js` (8,758 LOC)

- [ ] Add an extraction plan when keyboard-layout configuration work resumes; it is
  a larger editable UI monolith than the original audit captured.

---

## P3 — Large / long-term

- [x] Replace custom concat build with **esbuild** (tree-shaking, real graph); old concat path removed
- [x] Single hover/targeting architecture with one primary path (DOM-hover; elementFromPoint fallback for activation/special modes)
- [ ] Extract a small **storage service** only after repeated direct
  `chrome.storage` patterns create a concrete inconsistency; the existing shared
  helper already covers sync → local → default reads and writes.
- [ ] Turn `DEFAULT_SETTINGS` into a declarative schema only if settings controls,
  validation, and migration logic continue to diverge. It is currently the runtime
  defaults source of truth in `settings-manager.js`.
- [ ] Optional keyboard layout editor from same keybinding SSOT
- [ ] Decompose `rectangle-intersection-observer.js` (5,625 LOC) only when
  selection work needs independently testable geometry or performance components.
  - **Trigger (2026-08-19 accuracy audit):** Do **not** re-enable
    `USE_EDGE_ONLY_SELECTION` to fix H/Y accuracy (broken non-ancestor IO root;
    empty intersections). Extract pure predicates instead: rect AABB, client-rect
    overlap, character-box intersection (AABB, not glyph-center), deepest-wins,
    tag filter. Leave caching/analytics in the monolith until a live incremental
    observer is actually required.
- [ ] Consider feature folders (`selection/`, `popover/`, `launcher/`,
  `navigation/`) as units are extracted; do not move files merely to create folders.
- [ ] Document the unbundled build graph (service worker, early inject, and
  extension pages) and add import-graph or build-output validation so it cannot
  silently drift from the three esbuild entry points.
- [ ] Review whether `web_accessible_resources` can be narrowed from broad `src/*`
  exposure to the modules actually fetched by web pages.
- [ ] Refresh `refs/KEYPILOT_ARCHITECTURE.md`; it still presents removed files as
  active parts of the tree.

---

## Keep (already solid)

- [x] Layout-driven keybindings (`keyboard-layouts.js`)
- [x] `settings-manager` + defaults
- [x] `onboarding.xml` + build stamp into early-inject
- [x] Shared `url-listing.js` (extend usage)
- [x] `PopupManager` modal stack
- [x] Early inject for perceived performance

---

## Suggested execution order

1. [ ] Remove the unconsumed early key buffer or document and test its handoff.
2. [ ] Add focused regression coverage for the current pure and service-worker seams.
3. [ ] Delete the inert RBush implementation and obsolete Babel configuration.
4. [x] Extract navigation/activation from `keypilot.js` (mixin classes; dispatch unchanged).
   [x] Overlay split: `popover-controller.js` + `focus-overlay.js`; OverlayManager façade.
   Next background splits only as feature work or tests need their boundaries.

---

## File size reference

Measured 2026-08-19; sizes are source lines, not bundle size.

| File | LOC | Notes |
|------|----:|-------|
| `src/modules/rectangle-intersection-observer.js` | 5,625 | Rectangle-selection geometry |
| `src/modules/intersection-observer-manager.js` | 2,879 | DOM-hover primary; includes inert RBush remnants |
| `background.js` | 3,089 | MV3 service-worker hub |
| `src/modules/launcher-popover.js` | 4,007 | Catalog-backed Launcher UI and preview behavior |
| `src/keypilot.js` | 8,783 | Composition root; navigation/activation handlers mixed in |
| `src/modules/navigation-handlers.js` | 1,087 | Back/forward/tabs/root/scroll handlers |
| `src/modules/activation-handlers.js` | 283 | F/G/B activate + Open Popover handlers |
| `early-inject.js` | 10,219 | Generated/stamped early-runtime surface |
| `src/modules/overlay-manager.js` | 4,156 | Overlay façade (inspector, highlight, HUD) |
| `src/modules/focus-overlay.js` | 5,164 | Focus ring backends + A/B/C paint |
| `src/modules/popover-controller.js` | 1,219 | E/P popovers (iframe modal + OS window) |

---

*Refresh this checklist when a listed seam changes; retain only decisions and
open work that are still evidence-backed.*
