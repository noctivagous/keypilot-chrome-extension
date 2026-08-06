# Focus ring paint: outline-first, overlay only when needed

## Performance rule

Hover chrome is optimized to **style the clickable itself** with CSS `outline` / `data-kp-focus`.

The browser applies that far more cheaply than allocating and repositioning a fixed-position overlay on every hover change. Prefer element styling unless geometry proves the ring would not be visible.

| Path | When | Cost |
|------|------|------|
| **A. Element outline** (default) | Normal clickables; ring not blocked by full-bleed cover | Fast: CSS on the node; scrolls with the page |
| **C. In-target absolute ring** | Outline would sit under full-bleed media; host can accept a child | Cheap: last child of host, local `maxZ+1`; scrolls free; `border-radius` from host |
| **B. Body fixed DOM overlay** | Escape hatch when C cannot mount (replaced elements, etc.) | Higher: fixed rect, must track scroll; global z-index |

F-key activation effects (`kpv2-focus-flash`, pulse, marquee) are separate: they are short-lived fixed overlays by design. That path is not a model for steady hover chrome.

## Decision flow (DOM-hover)

Implemented in `OverlayManager.updateFocusOverlay` when `_useDomHoverFocusColors` is on:

1. Resolve paint target (`_resolveElementForFocusStyling`).
2. **`_shouldUseFixedFocusOverlay(element)`** — true when **element outline** cannot show a ring:
   - Target has non-visible `overflow` **and** full-bleed covering content (`img` / absolute fill / full-size `::before`/`::after`).
   - **Or** a full-size **child** is the visual media surface that would paint over an inset parent outline (e.g. `a.top-site-card` → `.top-site-tile` with `isolation: isolate` + `overflow: hidden` + page-thumb `::before`). Detected via `_hasObscuringFullBleedChild`.
   - Parent-only clip (outer ring tight in a toolbar shell) is **not** enough → keep element outline with inset (`ENABLE_FOCUS_CLIP_INSET`).
3. If escape hatch needed:
   - **C** (`ENABLE_IN_TARGET_FOCUS_RING`): `updateFocusOverlayInTarget` — inject `.kpv2-focus-ring-intarget` as last child of host, `z-index: maxLocal+1`, `border-radius` via `_resolveElementBorderRadius` (host, then element / large descendant). Set `_focusPaintUsesInTargetRing`. Still counts as element-associated for scroll (`usesElementFocusStyling()` true).
   - **B** if C fails: `updateFocusOverlayDOM`. Set `_focusPaintUsesFixedOverlay`. Also copies border-radius.
4. Else → **A** `updateFocusOverlayElementStyling`. Hide in-target ring + fixed overlay.
5. Never use B/C “just in case.” If the check throws or is inconclusive, stay on element styling.

`_outerFocusRingWouldBeClipped` remains a rect helper for inset decisions / diagnostics; it does **not** alone switch paint backends.

`usesElementFocusStyling()` is true only when DOM-hover is on **and** we are not on the fixed-overlay escape hatch, so `OptimizedScrollManager` repositions the ring only when needed.

### Regression to avoid: KP chrome inside high z-index shells

Control strip (`.kp-control-strip`, `overflow: hidden`, z-index above `Z_INDEX.OVERLAYS`) and Keyboard Reference titlebar controls are real clickables flush inside a clipping shell. Outer outline has no room, but **inset element outline on the button works**. Routing them to fixed overlay made rings paint **under** the strip (overlay z-index &lt; strip) → “no outline.”

## Rect-based clip check

`_outerFocusRingWouldBeClipped` compares `getBoundingClientRect()` of the paint target to overflow / contain / content-visibility ancestors (via `_findFocusClipContext`).

Rough idea:

- Outer hover ring needs a few pixels **outside** the target box (`outline-offset` + thickness; code uses ~8px pad).
- If a clipping ancestor’s box leaves **less than that room** on any side (target flush or inset inside the clipper), a positive outer outline is cut off.
- Full-bleed self-clip case is handled separately in `_shouldUseFixedFocusOverlay` (not only via outer-clip).

Example: [thenextweb.com](https://thenextweb.com/) visual cards — `a.c-card__image` and parent `.c-card` are both `overflow: hidden` and same size; full-bleed `<img>` + gradient `::after`. Element outline is applied but not seen; F-click fixed green ring is. Hover should use the fixed overlay only for that geometry.

Headline links on the same card are not flush-clipped the same way; they keep **element** outlines.

## Related flags (`src/config/constants.js`)

- `ENABLE_FOCUS_CLIP_INSET` — when still painting on the element, may use negative `outline-offset` if an ancestor would clip an outer ring. Does **not** replace the fixed-overlay escape hatch for full-bleed media.
- `ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION` — default **off** (can steal `data-kp-focus` from the real clickable, e.g. IMDb).

Do **not** re-enable “always fixed overlay for hover” for convenience. The product constraint is: **outline first, overlay only when the outline would be wrong or invisible.**

## Related modules

| Module | Role |
|--------|------|
| `src/modules/overlay-manager.js` | Paint backend choice; clip rect helpers; element vs fixed overlay |
| `src/modules/style-manager.js` | `.keypilot-focus-element` / inset CSS; open-shadow inject for other chrome |
| `src/modules/optimized-scroll-manager.js` | Repositions fixed focus overlay when `usesElementFocusStyling()` is false |
| `src/modules/element-detector.js` | Which node is `focusEl` (targeting only — does not choose paint backend) |

## Sibling underlay targeting (separate topic)

`ElementDetector._findSiblingUnderlayClickable` can promote hover from non-interactive card chrome (e.g. absolute header over a media link) to a large sibling clickable. That only chooses **`focusEl`**. Paint still follows outline-first rules above once the target is set.

## Reheal vs fixed overlay

`IntersectionObserverManager._rehealDomHoverFocusStyling` runs on every
`pointerover` while the hover target is unchanged (child thrash inside a card).
It was written for SPA wipes of `data-kp-focus` on **element-styled** targets.

When paint uses the fixed overlay, `data-kp-focus` is intentionally **not** set.
Reheal must not treat that as a wipe and call `updateFocusOverlayElementStyling`
only — that reintroduces inset outlines under full-bleed media and can fight the
fixed ring. Reheal should either no-op while the fixed overlay is healthy, or
call full `updateFocusOverlay` so the clip decision is preserved.

### Case study: full-bleed media cards

Pattern (common on marketing/news grids and KeyPilot newtab top sites):

```
a.card-media-link          /* overflow:hidden  OR  overflow:visible wrapper */
  .tile / img              /* full-bleed; often isolation:isolate + overflow:hidden */
  .hover-scrim / overlay
```

When the **clickable** is an `overflow:visible` wrapper and the **child** is the clipped media surface, inset outline on the wrapper paints under the child stacking context. Fixed overlay must win for that geometry (not just when the clickable itself clips).

Site CSS often uses `transition: all` on the card and a hover scrim that darkens the media.

Erratic “outline flashes then disappears” came from:

1. First hover correctly choosing fixed overlay (full-bleed self-clip).
2. Later `pointerover`s on the same card triggering reheal → forced **inset element** outline because `data-kp-focus` was missing.
3. `transition: all` animating that outline on/off; the site’s hover scrim covering the inset ring so it looks like a quick fade.

## Checklist when changing this

- [ ] Default hover path still uses element outline on unclipped links/buttons.
- [ ] Control strip / Keyboard Reference close: element inset outline (not fixed under the strip).
- [ ] Clipped full-bleed media cards: fixed overlay; stable across child pointerovers.
- [ ] Scroll while fixed overlay is active keeps the ring aligned.
- [ ] Headline / small links next to media cards still use element outline when not full-bleed self-clip.
- [ ] F-activation flash still works (independent ephemeral overlays).
