# Link Preview & Popover

Peek at a link without committing a full navigation — either a compact preview by the cursor or a larger modal popover.

## Use it

### Link Preview (<kbd>E</kbd>)

1. Hover a link until it highlights.
2. Press <kbd>E</kbd>.
3. Use **Open in this tab** or **Open in New Tab** from the preview chrome.
4. Close with <kbd>Esc</kbd>, click outside, or the action key again.

### Popover (<kbd>P</kbd>)

1. Hover a link.
2. Press <kbd>P</kbd> to open it in the larger iframe-style popover.
3. Press <kbd>P</kbd> again or <kbd>Esc</kbd> to close.

If a site refuses to embed in an iframe, KeyPilot falls back to a sized OS popup window. Function parameters can force “always make new window” for stubborn hosts.

## Reference

### Default keys (Browsing, right-handed)

| Key | Action |
| --- | --- |
| <kbd>E</kbd> | Link Preview near cursor |
| <kbd>P</kbd> | Modal Open Popover |

### Behavior notes

- Desktop vs mobile viewport preference can be remembered per host for previews.
- Settings / Guide / Docs also use the shared popover chrome (titlebar, <kbd>Esc</kbd> to close).
- Customize or rebind these Functions in Layout Config; both support an “Always make new window” style parameter where exposed.
