# Scrolling

Scroll the page or nested scrollers under the cursor with fixed steps, jumps, or continuous Scroll Line control.

## Use it

1. Point at the page (or inside a scrollable region).
2. Press <kbd>C</kbd> to scroll up and <kbd>V</kbd> to scroll down by the configured distance.
3. Press <kbd>Z</kbd> to jump to the top of the scroll target; <kbd>X</kbd> for the bottom.
4. For continuous control, press <kbd>N</kbd> to start **Scroll Line**:
   - An origin mark appears under the cursor.
   - Move the mouse away from the origin — farther means faster scroll.
   - Press <kbd>N</kbd> again, click, or press <kbd>Esc</kbd> to exit.
5. Optionally enable **middle-click on empty page area** in Settings → Scrolling to start Scroll Line without <kbd>N</kbd>.

Tune step size and animation under **Settings → Scrolling**.

## Reference

### Default keys (Browsing, right-handed)

| Key | Action |
| --- | --- |
| <kbd>C</kbd> | Scroll up (instant distance) |
| <kbd>V</kbd> | Scroll down (instant distance) |
| <kbd>Z</kbd> | Jump to top of scroll target |
| <kbd>X</kbd> | Jump to bottom of scroll target |
| <kbd>N</kbd> | Toggle Scroll Line mode |

### Settings that matter

- **Scroll distance** for <kbd>C</kbd> / <kbd>V</kbd>
- **Smooth vs instant** animation for jumps
- **Skip wide carousel-like scrollers** in Scroll Line
- **Middle-click** to start Scroll Line on empty page area

### Scroll target

KeyPilot scrolls the page or the nested scroller under the cursor. If Scroll Line locks onto the wrong region, exit and reposition the pointer, then press <kbd>N</kbd> again.
