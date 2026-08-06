# Focus ring paint: outline-first, overlay only when needed

## How it works

In normal browsing, KeyPilot does not re-hit-test every mousemove.
DOM-hover mode lets the browser resolve occlusion/clipping;
KeyPilot only maps the hit node to a stable clickable
that owns the ring and F-activate.

There are really two layers:

1. **Hover target** — which element is `focusEl` (activation + “what we’re aiming at”)
2. **Paint target** — which node gets outline / in-target ring (can differ slightly)

## Pipeline overview

```text
Browser: “what’s under the pointer?”     → leaf (img, span, header…)
findClickable: “nearest real control”    → <a>, button, …
resolveHoverFocusTarget: “stable card/tab intent + underlay media”
parent promote: “same-box wrapper only”  → rarely, same size
paint resolve: “where outline draws cleanly”
```

Intent: one stable, F-meaningful control per card/row/tab — prefer media/primary host over nested More/labels, don’t thrash on child moves, don’t fatten a tight thumb into a whole content block.

## Outlines

For rendering the actual outline on target elements there is no Chrome API that allows for what we would like, which is: *Draw a focus-like rectangle around this element, always visible above its descendants, without moving focus, without injecting nodes, without fixed overlay, and auto-updating on scroll.*

So we have three strategies, in preference order:

| Strategy | Name | Mechanism |
|----------|------|-----------|
| **A** | DOM outline | CSS `outline` / `data-kp-focus` on the paint target |
| **B** | In-target ring (local max z + 1) | Absolute child inside host; stacks above media siblings |
| **C** | Body fixed overlay | `position: fixed` on `document.body`; high global z-index |

---------

## Performance rule

Hover chrome is optimized to **style the clickable itself** with CSS `outline` / `data-kp-focus` (**A**).

The browser applies that far more cheaply than allocating and repositioning a fixed-position overlay on every hover change. Prefer element styling unless geometry proves the ring would not be visible.

| Path | When | Cost |
|------|------|------|
| **A. DOM outline** (default) | Normal clickables; ring not blocked by full-bleed cover | Fast: CSS on the node; scrolls with the page. **Graded** `outline-offset = clamp(minRoom − stroke, −stroke, +2)` when `ENABLE_FOCUS_CLIP_INSET` — mild clip → mild inset, not a jump to B/C |
| **B. In-target absolute ring** | Outline would sit under full-bleed media; host can accept a child | Cheap: last child of host, local `maxZ+1`; scrolls free; `border-radius` from host |
| **C. Body fixed DOM overlay** | Escape hatch when **B** cannot mount (replaced elements, etc.) | Higher: fixed rect, must track scroll; global z-index |

F-key activation effects (`kpv2-focus-flash`, pulse, marquee) are separate: they are short-lived fixed overlays by design. That path is not a model for steady hover chrome.

## Decision flow (DOM-hover)

Implemented in `OverlayManager.updateFocusOverlay` when `_useDomHoverFocusColors` is on:

1. Resolve paint target (`_resolveElementForFocusStyling`).
2. **`_shouldUseFixedFocusOverlay(element)`** — true when **element outline (A)** cannot show a ring:
   - Target has non-visible `overflow` **and** full-bleed covering content (`img` / absolute fill / full-size `::before`/`::after`).
   - **Or** a full-size **child** would paint over an **inset** parent outline **and** path A would be forced to inset (`_wouldUseInsetFocusOutline` — graded offset negative). Example: newtab `a.top-site-card` → `.top-site-tile` inside `.top-sites-horizontal`. Detected via `_hasObscuringFullBleedChild` **gated by** inset necessity.
   - **Not** merely “has a full-bleed media child” when **outer** outline still has room — outer outline sits outside the border box and is not covered by children (e.g. ganjingworld video thumbnails must stay on path A).
   - Parent-only clip (outer ring tight in a toolbar shell) is **not** enough for escape hatch → keep element outline with graded inset (`ENABLE_FOCUS_CLIP_INSET`).
3. If escape hatch needed:
   - **B** (`ENABLE_IN_TARGET_FOCUS_RING`): `updateFocusOverlayInTarget` — inject `.kpv2-focus-ring-intarget` as last child of host, `z-index: maxLocal+1`, `border-radius` via `_resolveElementBorderRadius` (host, then element / large descendant). Set `_focusPaintUsesInTargetRing`. Still counts as element-associated for scroll (`usesElementFocusStyling()` true).
   - **C** if B fails: `updateFocusOverlayDOM`. Set `_focusPaintUsesFixedOverlay`. Also copies border-radius.
4. Else → **A** `updateFocusOverlayElementStyling`. Hide in-target ring + fixed overlay.
5. Never use B/C “just in case.” If the check throws or is inconclusive, stay on element styling (**A**).

`_outerFocusRingWouldBeClipped` remains a rect helper for inset decisions / diagnostics; it does **not** alone switch paint backends.

`usesElementFocusStyling()` is true when DOM-hover is on **and** we are not on the body-fixed path (**C**). Strategies **A** and **B** co-locate with the element and do not need scroll repositioning of a body overlay.

### Regression to avoid: KP chrome inside high z-index shells

Control strip (`.kp-control-strip`, `overflow: hidden`, z-index above `Z_INDEX.OVERLAYS`) and Keyboard Reference titlebar controls are real clickables flush inside a clipping shell. Outer outline has no room, but **inset element outline on the button works** (**A** graded inset). Routing them to body fixed (**C**) made rings paint **under** the strip (overlay z-index &lt; strip) → “no outline.”

## Rect-based clip check

`_outerFocusRingWouldBeClipped` compares `getBoundingClientRect()` of the paint target to overflow / contain / content-visibility ancestors (via `_findFocusClipContext`).

Rough idea:

- Outer hover ring needs a few pixels **outside** the target box (`outline-offset` + thickness).
- Graded path A uses min free room across clippers: `offset = clamp(minRoom − stroke, −stroke, +2)`.
- Full-bleed self-clip case is handled separately in `_shouldUseFixedFocusOverlay` (not only via outer-clip).

Example: [thenextweb.com](https://thenextweb.com/) visual cards — `a.c-card__image` and parent `.c-card` are both `overflow: hidden` and same size; full-bleed `<img>` + gradient `::after`. Element outline is applied but not seen; F-click fixed green ring is. Hover should use **B** (or **C** if B cannot mount) only for that geometry.

Headline links on the same card are not flush-clipped the same way; they keep **A** (element outlines).

## Related flags (`src/config/constants.js`)

- `ENABLE_FOCUS_CLIP_INSET` — graded `outline-offset` from clip-ancestor free room while still on path **A**. Does **not** replace escape hatches for full-bleed media.
- `ENABLE_FOCUS_TIGHT_WRAPPER_PROMOTION` — default **off** (can steal `data-kp-focus` from the real clickable, e.g. IMDb).
- `ENABLE_IN_TARGET_FOCUS_RING` — allow path **B** (in-target absolute ring) when A cannot show a ring; falls back to **C** if host cannot accept children.

Do **not** re-enable “always fixed overlay for hover” for convenience. The product constraint is: **outline first (A), in-target ring (B) only when needed, body fixed (C) last.**

## Related modules

| Module | Role |
|--------|------|
| `src/modules/overlay-manager.js` | Paint backend choice A/B/C; clip rect helpers; graded offset |
| `src/modules/style-manager.js` | `.keypilot-focus-element` / outline-offset CSS var; open-shadow inject |
| `src/modules/optimized-scroll-manager.js` | Repositions body-fixed focus overlay (**C**) when `usesElementFocusStyling()` is false |
| `src/modules/element-detector.js` | Which node is `focusEl` (targeting only — does not choose paint backend) |

## Sibling underlay targeting (separate topic)

`ElementDetector._findSiblingUnderlayClickable` can promote hover from non-interactive card chrome (e.g. absolute header over a media link) to a large sibling clickable. That only chooses **`focusEl`**. Paint still follows outline-first rules above once the target is set.

## Reheal vs body fixed / in-target ring

`IntersectionObserverManager._rehealDomHoverFocusStyling` runs on every
`pointerover` while the hover target is unchanged (child thrash inside a card).
It was written for SPA wipes of `data-kp-focus` on **element-styled** targets (**A**).

When paint uses **B** (in-target) or **C** (body fixed), `data-kp-focus` is intentionally **not** set.
Reheal must not treat that as a wipe and call `updateFocusOverlayElementStyling`
only — that reintroduces inset outlines under full-bleed media and can fight the
ring. Reheal should either no-op while B/C paint is healthy, or
call full `updateFocusOverlay` so the clip decision is preserved.

### Case study: full-bleed media cards

Pattern (common on marketing/news grids and KeyPilot newtab top sites):

```
a.card-media-link          /* overflow:hidden  OR  overflow:visible wrapper */
  .tile / img              /* full-bleed; often isolation:isolate + overflow:hidden */
  .hover-scrim / overlay
```

When the **clickable** is an `overflow:visible` wrapper and the **child** is the clipped media surface, inset outline on the wrapper paints under the child stacking context. Path **B** (in-target ring as last sibling above the tile) or **C** (body fixed) must win for that geometry (not just when the clickable itself clips).

Site CSS often uses `transition: all` on the card and a hover scrim that darkens the media.

Erratic “outline flashes then disappears” came from:

1. First hover correctly choosing B/C (full-bleed self-clip).
2. Later `pointerover`s on the same card triggering reheal → forced **inset element** outline because `data-kp-focus` was missing.
3. `transition: all` animating that outline on/off; the site’s hover scrim covering the inset ring so it looks like a quick fade.

## Checklist when changing this

- [ ] Default hover path still uses element outline (**A**) on unclipped links/buttons.
- [ ] Control strip / Keyboard Reference close: element graded inset outline (**A**), not body fixed under the strip (**C**).
- [ ] Clipped full-bleed media cards: **B** (or **C** if B cannot mount); stable across child pointerovers.
- [ ] Scroll while body fixed (**C**) is active keeps the ring aligned.
- [ ] Headline / small links next to media cards still use element outline (**A**) when not full-bleed self-clip.
- [ ] F-activation flash still works (independent ephemeral overlays).
