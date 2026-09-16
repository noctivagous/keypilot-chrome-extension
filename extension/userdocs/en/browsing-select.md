# Selection

Select text or HTML elements under the cursor, then copy or act on the result.

## Use it

### Text selection

1. Move the cursor to where selection should start.
2. Press <kbd>H</kbd> to begin character-level text selection.
3. Move to the end of the range and press <kbd>H</kbd> again to finish and copy.
4. Press <kbd>Esc</kbd> to cancel without copying.

Text Select is caret-to-caret (like click-drag), not a clip of the dashed rectangle. The rectangle is a drag guide: the copied range is everything in document order between the start and end carets.

Copy format (rich or plain text) is configurable on the Text Select Function's Action Instance.

### Element selection

1. Press <kbd>Y</kbd> to start rectangle selection of intersecting HTML elements.
2. Drag/adjust the rectangle over the elements you want.
3. Complete the selection per the on-screen prompts (or use cumulative pick mode if configured).
4. Press <kbd>Esc</kbd> to cancel.

Default granularity is an article feature unit: a paragraph or heading, a whole table (not individual cells), a whole figure or picture (not the inner image), a whole list. Hitting a link inside a paragraph selects that paragraph immediately. Overlap uses each element’s line boxes, not one bounding box.

## Reference

### Default keys (Browsing, right-handed)

| Key | Action |
| --- | --- |
| <kbd>H</kbd> | Text select (start / finish + copy) |
| <kbd>Y</kbd> | Rectangle select elements (or cumulative pick mode) |
| <kbd>Esc</kbd> | Cancel selection modes |

### Modes for <kbd>Y</kbd>

- **Rectangle** — select article feature units whose line boxes intersect a drawn rectangle (paragraph, table, figure, list). A link inside a paragraph selects the paragraph.
- **Cumulative pick** — add elements one by one and finish with <kbd>Enter</kbd> (configured on the Function).

### Related tools

- <kbd>I</kbd> / <kbd>U</kbd> copy hovered image / URL (see *Copy under cursor*).
- <kbd>O</kbd> opens Page Media for everything found on the page.
- Clipboard and Media Library destinations appear on many Get / Copy Functions in Layout Editor.

## Unit select (Clipboard)

Place **Select Word**, **Select Sentence**, **Select Paragraph**, or **Select Image** from the Actions Library Clipboard section. These select under the KeyPilot cursor without copying.

1. Hover the word, sentence, paragraph, or image.
2. Press the bound key to select it. Press again over the same unit to deselect it.
3. Use **Copy** (or Cut) to send the KeyPilot selection to the clipboard.
4. Press <kbd>Esc</kbd> to clear the selection.

Each Function shows Exclusive / Cumulative on its Keyboard Reference key-info popover (shared for that Function, not a per-key Action Instance).

- **Exclusive** (default) — the press replaces the current selection.
- **Cumulative** — add or remove units; disjoint ranges stay highlighted.

KeyPilot paints its own highlight so gapped selections stay visible. This is separate from <kbd>H</kbd> / <kbd>Y</kbd> drag selection.
