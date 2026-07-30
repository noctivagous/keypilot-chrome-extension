# KeyPilot Architecture Audit — Todo List

Findings from the codebase audit (architecture, SSOT, duplication, dead code, config extraction).  
Priority: **P0** = do first / product-blocking, **P1** = high leverage, **P2** = cleanup, **P3** = long-term.

Check items as you complete them.

---

## Done (this audit pass)

- [x] Delete unused `extension/src/utils/logger.js`
- [x] Forward `KP_OPEN_SETTINGS_POPOVER` / `KP_OPEN_GUIDE_POPOVER` / `KP_OPEN_ONBOARDING` from service worker → tab content script

---

## P0 — Product decisions

- [x] **Text-highlight subsystem:** choose one path  
  - [x] **Option A:** Re-bind `HIGHLIGHT` / `RECTANGLE_HIGHLIGHT` in `keyboard-layouts.js` and ship the feature  
    - Right: **H** = character text select, **Y** = rectangle select  
    - Left: **G** = character, **R** = rectangle  
    - Character default uses caret APIs (`caretRangeFromPoint`); edge-only stack is **lazy** (rectangle only)  
    - Do not re-enable edge analytics/HUD by default  
  - [ ] **Option B:** Remove / freeze dormant selection stack (~8–10k LOC) and stop `initializeEdgeOnlyProcessing()` on enable  
  - [x] Document decision in architecture notes (this file)
- [x] **Hover targeting:** keep DOM-hover only (product decision)  
  - [x] DOM-hover permanent: primary path for normal browsing; F / special modes fall back to `elementFromPoint`  
  - [x] Dropped `src/vendor/rbush.js`; build no longer ships RBush  
  - [x] Isolated residual RBush code in `intersection-observer-manager` (`_rtreeEnabled()` always false; `setupSpatialIndex` no-op)  
  - [ ] P3 follow-up: delete residual `_rtree*` methods / metrics once no callers remain

---

## P1 — Single source of truth

- [x] Shared **`isTypingContext`** in one util; use from `event-manager`, `content-script`, `popover-bridge` (align with `SELECTORS.FOCUSABLE_TEXT`)
  - `src/utils/dom-context.js`
- [x] Shared **skip-URL patterns** for `isSkippableTab` / `isSkippableUrl` in `background.js`
  - `src/config/url-policy.js` (SW imports as ES module)
- [x] Scroll distances (`800` / `400`) → constants used by `keypilot.js` and iframe bridges
  - `SCROLL` in `src/config/constants.js`
- [x] **`KP_*` message types** → `src/messaging/types.js` (or similar) enum + payload notes
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

## P1 — Extract data to config files

- [ ] `config/launcher-sites.json` — default sites per category (from `launcher-popover.js`)
- [ ] `config/search-engines.json` — engines (from `SEARCH_ENGINE_META`)
- [ ] Scroll / URL-policy constants → `config/scroll.json` or entries in `constants.js` (if not JSON)
- [ ] Optional: `config/feature-flags.json` (or keep JS for build-time dead-code elimination)
- [ ] Optional: selection performance knobs → separate config if highlight feature is kept
- [ ] Keep `pages/onboarding.xml` as SSOT for onboarding (already good)

---

## P1 — Deduplicate parallel implementations

- [ ] Merge **popover bridge** logic (`content-script.js` vs `pages/popover-bridge.js`)
- [ ] Route all highlight/selection work through **`HighlightManager`** only (if feature kept); delete parallel selection code in `keypilot.js`
- [ ] Prefer **`url-listing.js`** for launcher rows instead of one-off grid/domain/favicon helpers
- [ ] Shared storage helper (sync → local → default) for settings, keyboard-help visibility, enabled flag, navgraph mode

---

## P2 — Small cleanups

- [ ] Remove or wire **`pendingKeyEvents`** in `early-inject.js` (never consumed by main bundle)
- [ ] Confirm **`babel.config.cjs`** unused → delete if unused
- [ ] Gate **`console.log` / debug noise** behind `KEYPILOT_DEBUG` (hot paths especially)
- [ ] Default verbose feature flags off (`DETAILED_EDGE_LOGGING`, etc.)
- [ ] Document messaging policy: extension page → SW → `tabs.sendMessage` for tab-local UI
- [ ] Update README if it still references deleted `utils/logger.js`

---

## P2 — Split monoliths (medium)

### `keypilot.js` (~5.5k)

- [ ] Extract `navigation-handlers.js` (back/forward/tabs/root/scroll)
- [ ] Extract `activation-handlers.js` (F/G/B, open popover)
- [ ] Extract or delete `text-selection/` block from KeyPilot
- [ ] Keep thin orchestrator: init, `handleKeyDown` dispatch, module wiring

### `overlay-manager.js` (~3.7k)

- [ ] Extract `popover-iframe.js` (E-key modal)
- [ ] Extract `preview-popover.js` (P-key)
- [ ] Extract focus-overlay drawing
- [ ] Keep `OverlayManager` as façade

### `background.js` (~2.1k)

- [ ] Split: toggle, omnibox/history APIs, navgraph, tab navigation, message router
- [ ] Shared `url-filters` module

### `launcher-popover.js` (~1.7k)

- [ ] Data load vs UI build vs preview as separate modules
- [ ] Load sites from JSON config

---

## P3 — Large / long-term

- [ ] Replace custom concat build with **esbuild or Rollup** (tree-shaking, real graph)
- [ ] Tree-shake unused highlight residual code + residual `_rtree*` RBush stubs after DOM-hover decision
- [x] Single hover/targeting architecture with one primary path (DOM-hover; elementFromPoint fallback for activation/special modes)
- [ ] Small **storage service** wrapping chrome.storage patterns
- [ ] Settings UI driven from schema / single defaults object
- [ ] Optional keyboard layout editor from same keybinding SSOT
- [ ] Full decomposition of `rectangle-intersection-observer.js` (~5.7k) if selection feature is kept

---

## Architecture add / change / remove

### Add

- [ ] `src/messaging/types.js` — message constants
- [ ] Background UI-open forwarding (partially done) + tests/docs
- [ ] `src/utils/` for pure shared helpers (typing, URL policy, scroll)
- [ ] Feature folders: `selection/`, `popover/`, `launcher/`, `navigation/` as modules grow

### Change

- [ ] KeyPilot = composition root, not god-object
- [ ] One settings schema for popup/settings page/content script
- [ ] Consistent message routing for all tab-local UI

### Remove (after decisions)

- [ ] Dormant highlight pipeline (if Option B)
- [ ] Dead early pending-key buffer
- [ ] Legacy cursor storage keys after migration
- [x] Unused RBush vendor path if DOM-hover-only (`src/vendor/rbush.js` deleted)

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

1. [x] P0: Highlight keep vs delete (Option A shipped: H character / Y rectangle); hover = DOM-hover only (RBush retired)  
2. [ ] P1: Shared typing/scroll/URL/message SSOT helpers  
3. [ ] P1: Launcher sites JSON + message registry  
4. [ ] P2: Split navigation/activation out of `keypilot.js`  
5. [ ] P2: Split background + overlay popovers  
6. [ ] P3: Bundler + tree-shake + deeper module folders  

---

## File size reference (approx.)

| File | ~LOC | Notes |
|------|------|--------|
| `rectangle-intersection-observer.js` | 5765 | Selection only; largely dormant without keys |
| `keypilot.js` | 5501 | God-object; ~3k selection-related |
| `overlay-manager.js` | 3719 | Popovers + overlays + debug |
| `early-inject.js` | 3430 | Partly generated by build |
| `intersection-observer-manager.js` | ~2.5k | DOM-hover primary; residual RBush stubs inert |
| `background.js` | 2108 | SW message hub |
| `launcher-popover.js` | 1736 | Hardcoded site catalogs |

---

*Generated from architecture audit. Update checkboxes as work lands.*
