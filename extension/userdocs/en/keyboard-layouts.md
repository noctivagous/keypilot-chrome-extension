# Layouts & handedness

A **layout** is the map of keys → actions. KeyPilot ships built-in families; you can switch handedness or build custom layouts.

## Use it

1. Open **Settings** (<kbd>'</kbd>) → **Keyboard**, or use the layout dropdown on the **Keyboard Reference** titlebar.
2. Pick a **family**:
   - **Browsing** — full click, scroll, tabs, tools (default).
   - **Navigation** — lean set focused on click / back / forward.
3. Enable **left-handed** if you keep the mouse in your left hand — primary shortcuts move to the right side of the keyboard.
4. Cycle families anytime with <kbd>Alt</kbd>+<kbd>[</kbd> (previous) and <kbd>Alt</kbd>+<kbd>]</kbd> (next) without changing handedness.
5. To deeply customize keys, press <kbd>Alt</kbd>+<kbd>C</kbd> for Keyboard Layout Editor (see that topic).

Open <kbd>K</kbd> (Keyboard Reference) after switching — the drawn keyboard always matches the active layout.

## Reference

### Built-in families

| Family | Intent |
| --- | --- |
| Browsing | Everyday keyboard-first browsing |
| Navigation | Minimal navigation subset |

Handedness is independent of family. Legacy “Basic Navigation” ids may still resolve from older settings but are hidden from normal pickers.

### Custom layouts

- Editing a built-in in Layout Editor creates a user copy (for example “Browsing Copy 1”).
- Custom layouts are **exclusive**: only assigned slots plus the always-on system layer fire.
- Import/export JSON from Layout Editor to back up or share layouts.

### Related settings

- Show number row on the Keyboard Reference / editor
- Pressed-key feedback while typing shortcuts
- Current layout id and family persist in your Chrome profile
