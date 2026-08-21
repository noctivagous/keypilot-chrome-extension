# System keys & Alt chrome

Some keys always belong to KeyPilot chrome. They stay available across built-in and custom layouts.

## Use it

### Always-on system layer

These character keys work even when your custom layout leaves them empty:

1. Press <kbd>Esc</kbd> to cancel the current mode (Text Mode, selection, Scroll Line, many popovers).
2. Press <kbd>K</kbd> (right-handed) or <kbd>D</kbd> (left-handed) to show or hide the **Keyboard Reference**.
3. Press <kbd>'</kbd> (quote) to open **Settings**.

### Alt chrome hotkeys

Hold <kbd>Alt</kbd> and press:

| Chord | Action |
| --- | --- |
| <kbd>Alt</kbd>+<kbd>K</kbd> | Toggle KeyPilot on/off (works even when disabled) |
| <kbd>Alt</kbd>+<kbd>J</kbd> | Show/hide Control Strip (works even when disabled) |
| <kbd>Alt</kbd>+<kbd>L</kbd> | Open Omnibox |
| <kbd>Alt</kbd>+<kbd>;</kbd> or <kbd>Alt</kbd>+<kbd>A</kbd> | Open Launcher with search focused |
| <kbd>Alt</kbd>+<kbd>[</kbd> / <kbd>Alt</kbd>+<kbd>]</kbd> | Previous / next layout family |
| <kbd>Alt</kbd>+<kbd>C</kbd> | Toggle Keyboard Layout Editor |
| <kbd>Alt</kbd>+<kbd>H</kbd> | Open this documentation |
| <kbd>Alt</kbd>+<kbd>T</kbd> | Show/hide the onboarding walkthrough |

Memorize <kbd>Alt</kbd>+<kbd>K</kbd>, <kbd>Esc</kbd>, <kbd>K</kbd>, <kbd>'</kbd>, and <kbd>Alt</kbd>+<kbd>H</kbd> first — they unlock everything else.

## Reference

### System layer vs layout keys

- **System layer** — <kbd>Esc</kbd>, Keyboard Reference, Settings. Defined separately from layout families.
- **Layout keys** — <kbd>F</kbd>, <kbd>D</kbd>, scroll, tools, etc. Come from the active built-in or custom layout.
- **Alt chrome** — handled before normal key routing; not shown as ordinary letter assignments.

### Handedness note

On left-handed layouts, Keyboard Reference moves to <kbd>D</kbd> so it does not collide with the mirrored Activate cluster. Settings remains <kbd>'</kbd>.

### Not for everyday use

<kbd>Alt</kbd>+<kbd>D</kbd> toggles a developer shadow-root debug HUD. Skip it unless you are diagnosing rendering.
