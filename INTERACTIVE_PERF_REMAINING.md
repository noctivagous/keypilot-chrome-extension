# Interactive performance — remaining work

Follow-up to the DOM-hover / element-styling audit (2026-08).  
**Already shipped:** perpetual cursor rAF removed, no canvas on enable, interactive discovery gated off, mouse listeners collapsed, hover reheal only when markers stripped, text-mode rAF removed, early-inject handoff always, debug timers/logs gated, scroll path no longer revives legacy orange text frames.

---

## Done in this pass (2026-08)

- [x] **Clip-context WeakMap cache** (`_findFocusClipContext`) — TTL + geometry fingerprint; invalidate on resize / `keypilot:scroll-end`
- [x] **`ENABLE_CLICK_LISTENER_TRACKING`** feature flag (default `true`) around `addEventListener` monkey-patch
- [x] **Legacy text-field frame APIs removed** (`updateFocusedTextOverlay` / `updateActiveTextInputFrame` + CSS/constants)
- [x] **Hover sticky short-circuit** — skip full `findClickable` for non-primary descendants of previous host
- [x] **Frame agent split** — top frame: `content-bundled.js` (~1.6MB); child frames: `frame-agent-bundled.js` (~131KB); popover INIT injects full KP via SW `scripting.executeScript`

---

## P1 / P2 still remaining

### 1. Further thin frame-agent hover work
- **Problem:** Frame agent still does rAF hover outline + dual pointermove while pointer is in the frame.
- **Fix:** Outline only when parent posts activate intent, or throttle harder / pointerover-only.
- **Risk:** Cross-origin F UX feedback.

### 2. Dynamic-import / deferred rectangle intersection module
- **Problem:** `rectangle-intersection-observer.js` (~5.7k lines) still in main top-frame bundle; edge-only flags off.
- **Fix:** Separate build chunk loaded on first rectangle-highlight session (concat build has no native dynamic import today).
- **Risk:** First H-session latency; build pipeline change.

### 3. Unify enable/disable pipeline
- **Problem:** `KeyPilot.enable`/`disable` vs `KeyPilotToggleHandler.enableKeyPilot`/`disableKeyPilot` overlap.
- **Fix:** Single enable path; the other delegates.
- **Risk:** Toggle/disable on restricted pages.

### 4. Stronger hover resolve caching
- **Problem:** Full resolve still walks on primary nested targets.
- **Fix:** Cache last under→host mapping briefly; skip parent promotion when leaf stable.
- **Risk:** Sticky host UX on nested chrome.

---

## P3 — Cleanup / tree-shake

### 5. RBush residual code in `intersection-observer-manager.js`
- No-op at runtime. Remove dead index methods, metrics, debug overlays when convenient.

### 6. Explicit `focusChromeMode: 'element' | 'canvas' | 'dom-fixed'`
- Today element styling is tied to `_useDomHoverFocusColors`.

### 7. Mouse coordinate inactive monitoring
- Extra capture mousemove for rare `document.hidden` storage. Drop or bind only on `visibilitychange`.

### 8. Optional: default `ENABLE_CLICK_LISTENER_TRACKING: false` after product QA
- Confirms whether JS-only clickables still need the prototype wrap.

---

## Earlier ship (pre this pass)

- [x] Kill perpetual `setupContinuousCursorSync` rAF  
- [x] Stop full-viewport canvas init on enable  
- [x] Gate interactive discovery (`ENABLE_INTERACTIVE_DISCOVERY: false`)  
- [x] Collapse EventManager mouse listeners; drop no-op scroll  
- [x] Prefer PointerEvents for DOM-hover; reheal only when marker missing  
- [x] Text-mode position rAF removed  
- [x] Early-inject handoff always from main init  
- [x] Debug metrics interval / hot-path logs gated  
- [x] OptimizedScrollManager: no legacy orange text frames on scroll  

---

## Verification checklist

- [ ] Busy SPA / AI chat: scroll under sticky composer — no orange glow, no stuck ring  
- [ ] Hover links/cards — ring tracks; no jank on dense lists  
- [ ] Type in text field — labels (if enabled) still update on resize/scroll  
- [ ] F-activate in cross-origin iframe still works after frame split  
- [ ] Popover iframe (preview/settings) still gets full KP after bridge INIT  
- [ ] Rectangle select (H) still works  
- [ ] Alt+K toggle enable/disable restores hover without canvas  
- [ ] DevTools Performance: no perpetual rAF from KeyPilot when idle  
- [ ] Child frames only load ~131KB frame-agent (not full 1.6MB)
