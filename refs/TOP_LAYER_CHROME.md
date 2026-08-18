# Top-layer chrome (Popover API)

Related code:

- `extension/src/config/constants.js` — `Z_INDEX` ladder (`FLOATING_KEYBOARD_HELP` below ripple)
- `extension/src/ui/select-menu.js` — layout menu is a `position:fixed` sibling on `document.body`
- `extension/src/ui/keybindings-ui.js` — key-info tooltip uses the Popover API
- `extension/src/modules/overlay-manager.js` — hover A / B / C; C is a body overlay at `Z_INDEX.OVERLAYS`
- `extension/src/ui/kp-chrome-shadow.js` — open-shadow chrome hosts

---

## Current split

| Surface | Mechanism |
|---|---|
| Persistent windows (Keyboard Ref, control strip, …) | `position: fixed` + `Z_INDEX` ladder |
| Transient menus / key-info | Popover API when it must escape `overflow: hidden` |
| Key / chrome hover | Strategy A or B on the node — never C |
| Page hover | A → B → C as now |
| Click ripple | Body overlay above window z-index |

Do not convert every window into its own `showPopover()` surface. Persistent chrome cannot use `popover="auto"` (outside clicks would dismiss Keyboard Ref while browsing). Several `manual` popovers stack by **who was shown last**, not by the z-index ladder. Early-inject remounts, theme apply, and a site `<dialog>` / popover all reshuffle that order. The top layer is a shared global: last one wins.

Strategy C does not join a popover’s tree. It is always a `position:fixed` node on `document.body`. Promoting Keyboard Ref to the top layer hides C (and today’s ripple) even more thoroughly. C remains the page-content escape hatch; omit it only for KeyPilot chrome.

---

## Cleaner rewrite (not a flag flip)

What would actually be cleaner if you want top-layer chrome: one `manual` popover host that contains all windows as positioned children. Internal z-index still works, one promotion, ripple can live in that host. That is a real rewrite, not a flag flip.
