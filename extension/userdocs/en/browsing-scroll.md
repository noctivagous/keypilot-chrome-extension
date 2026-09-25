# Scrolling

Scroll the page or nested scrollers under the cursor with fixed steps, jumps, or continuous Scroll Line control.

## Use it

1. Point at the page (or inside a scrollable region).
2. Use **Page Up** and **Page Down** to scroll by the configured distance.
3. Use **Scroll To Top** to jump to the top of the scroll target; **Scroll To Bottom** for the bottom.
4. For continuous control, use **Scroll Line**:
   - An origin mark appears under the cursor.
   - Move the mouse away from the origin — farther means faster scroll.
   - Use **Scroll Line** again, click, or press <kbd>Esc</kbd> to exit.
5. Optionally enable **middle-click on empty page area** in Settings → Scrolling to start Scroll Line without the Scroll Line key.
6. Use **Zoom Out** (<kbd>[</kbd>) and **Zoom In** (<kbd>]</kbd>) to change the tab zoom by one browser step. The point under the cursor stays fixed, as with a pinch gesture.

Tune step size and animation under **Settings → Scrolling**.

## Reference

### Functions

| Function | What it does |
| --- | --- |
| **Page Up** | Scroll up by the configured instant distance |
| **Page Down** | Scroll down by the configured instant distance |
| **Scroll To Top** | Jump to the top of the scroll target |
| **Scroll To Bottom** | Jump to the bottom of the scroll target |
| **Scroll Line** | Toggle origin-based continuous scroll |
| **Zoom Out** | Zoom the tab out one step at the cursor |
| **Zoom In** | Zoom the tab in one step at the cursor |

Default keys for these Functions depend on the active keyboard layout.

### Settings that matter

- **Scroll distance** for Page Up / Page Down
- **Smooth vs instant** animation for jumps
- **Skip wide carousel-like scrollers** in Scroll Line
- **Middle-click** to start Scroll Line on empty page area

### Scroll target

KeyPilot scrolls the page or the nested scroller under the cursor. If Scroll Line locks onto the wrong region, exit and reposition the pointer, then use **Scroll Line** again.
