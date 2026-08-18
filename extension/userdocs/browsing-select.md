# Selection

Select text or HTML elements under the cursor, then copy or act on the result.

## Use it

### Text selection

1. Move the cursor to where selection should start.
2. Press <kbd>H</kbd> to begin character-level text selection.
3. Move to the end of the range and press <kbd>H</kbd> again to finish and copy.
4. Press <kbd>Esc</kbd> to cancel without copying.

Copy format (rich or plain text) is configurable on the Text Select Function's Action Instance.

### Element selection

1. Press <kbd>Y</kbd> to start rectangle selection of intersecting HTML elements.
2. Drag/adjust the rectangle over the elements you want.
3. Complete the selection per the on-screen prompts (or use cumulative pick mode if configured).
4. Press <kbd>Esc</kbd> to cancel.

## Reference

### Default keys (Browsing, right-handed)

| Key | Action |
| --- | --- |
| <kbd>H</kbd> | Text select (start / finish + copy) |
| <kbd>Y</kbd> | Rectangle select elements (or cumulative pick mode) |
| <kbd>Esc</kbd> | Cancel selection modes |

### Modes for <kbd>Y</kbd>

- **Rectangle** — select elements intersecting a drawn rectangle.
- **Cumulative pick** — add elements one by one and finish with <kbd>Enter</kbd> (configured on the Function).

### Related tools

- <kbd>I</kbd> / <kbd>U</kbd> copy hovered image / URL (see *Copy under cursor*).
- <kbd>O</kbd> opens Page Media for everything found on the page.
- Clipboard and Media Library destinations appear on many Get / Copy Functions in Layout Config.

## Unit select (Clipboard)

Place **Select Word**, **Select Sentence**, **Select Paragraph**, or **Select Image** from the Actions Library Clipboard section. These select under the KeyPilot cursor without copying.

1. Hover the word, sentence, paragraph, or image.
2. Press the bound key to select it. Press again over the same unit to deselect it.
3. Use **Copy** (or Cut) to send the KeyPilot selection to the clipboard.
4. Press <kbd>Esc</kbd> to clear the selection.

Each Function has a popover setting:

- **Exclusive** (default) — the press replaces the current selection.
- **Cumulative** — add or remove units; disjoint ranges stay highlighted.

KeyPilot paints its own highlight so gapped selections stay visible. This is separate from <kbd>H</kbd> / <kbd>Y</kbd> drag selection.
