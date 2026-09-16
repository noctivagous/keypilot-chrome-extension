# Modes

KeyPilot uses modal states for operations that need continuous input. Most browsing keys are suspended while a mode is active; <kbd>Esc</kbd> almost always cancels.

## Use it

1. **Normal browsing** — shortcuts active; focus rectangles show clickable targets.
2. **Text Mode** — press <kbd>F</kbd> on a text field. Type normally. Press <kbd>Esc</kbd> (or the Exit control on Keyboard Reference) when done.
3. **Scroll Line** — press <kbd>N</kbd>; move away from the origin to scroll; <kbd>N</kbd>, click, or <kbd>Esc</kbd> exits.
4. **Selection** — <kbd>H</kbd> or <kbd>Y</kbd>; <kbd>Esc</kbd> cancels.
5. **Delete Mode** — press <kbd>Backspace</kbd>, aim at an element, confirm to remove it from the page; <kbd>Esc</kbd> cancels.
6. **Popovers / Omnibox / Layout Editor** — their own open states; <kbd>Esc</kbd> or the tool’s close key dismisses them.

If keys seem “dead,” you are probably in Text Mode or another modal — press <kbd>Esc</kbd> once and try again.

## Reference

### Text Mode details

- Most layout browsing keys are suspended so typing is safe.
- A short hover-and-<kbd>F</kbd> window can still activate another clickable target without fully leaving text focus (countdown-aware Activate).
- Appearance (T-square vs crosshair, orange edge, labels) is under **Settings → Text Mode**.

### Delete Mode

- Entered with <kbd>Backspace</kbd> on the default layout.
- You pick an element visually; confirmation deletes that DOM node from the live page (page-local — not a browser history undo).

### Other modal surfaces

| Surface | Typical open | Exit |
| --- | --- | --- |
| Link Preview | <kbd>E</kbd> | <kbd>Esc</kbd>, titlebar close, or action again |
| Popover | <kbd>P</kbd> | <kbd>Esc</kbd> / toggle <kbd>P</kbd> |
| Omnibox | <kbd>L</kbd> / <kbd>Alt</kbd>+<kbd>L</kbd> | <kbd>Esc</kbd> |
| Keyboard Layout Editor | <kbd>Alt</kbd>+<kbd>C</kbd> | <kbd>Alt</kbd>+<kbd>C</kbd> / close |
| Settings / Docs / Guide | <kbd>'</kbd> / <kbd>Alt</kbd>+<kbd>H</kbd> / Guide entry | <kbd>Esc</kbd> |

### Always available

<kbd>Alt</kbd>+<kbd>K</kbd> still toggles KeyPilot even when browsing keys are suspended by Text Mode or when the extension was turned off.
