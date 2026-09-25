# Reader Mode

Open a clutter-free overlay of the current article, or of text you already selected.

## Use it

1. Press <kbd>P</kbd> on the default right-handed Browsing layout (<kbd>I</kbd> on left-handed).
2. KeyPilot extracts the main article. If you have a text selection, that selection is shown instead.
3. Read in the overlay. Links open in a new tab.
4. Close with <kbd>P</kbd> / <kbd>I</kbd> again, <kbd>Esc</kbd>, or the overlay close control.

If the page has no extractable article (maps, login screens, players, empty pages), KeyPilot shows a short notice and leaves the page as-is.

## Reference

### Default keys (Browsing)

| Layout | Key |
| --- | --- |
| Right-handed | <kbd>P</kbd> |
| Left-handed | <kbd>I</kbd> |

Rebind via Layout Editor if needed.

### Behavior notes

- This is KeyPilot’s own overlay, not Chrome’s Reading Mode side panel.
- The live page is not rewritten; extraction uses a document clone.
- Privileged URLs (`chrome://`, Web Store, and similar) are unavailable.

### Related

- **Link Preview** (<kbd>E</kbd>) — peek at a hovered link in a popup window
- **Open Popover** — larger link popup; bind it in Layout Editor (no built-in key)
