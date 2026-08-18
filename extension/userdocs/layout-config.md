# Keyboard Layout Config

Layout Config is the editor for custom keymaps: place Functions on keys, create layouts, and manage Action Instances.

## Use it

![Keyboard Layout Config](images/layout-config.png)

1. Press <kbd>Alt</kbd>+<kbd>C</kbd>, or choose **Edit Keyboard Layout…** from the Keyboard Reference dropdown.
2. The Keyboard Reference becomes the placement surface; the Config panel holds the Actions Library and layout tools.
3. **Create or select a layout** — editing a built-in makes a user copy (built-ins stay read-only).
4. Find an action (search the library), select it, then **click a keycap** on the Keyboard Reference to place it.
5. Replace or clear existing custom slots as needed.
6. Set the layout as current when you want to browse with it.
7. Press <kbd>Alt</kbd>+<kbd>C</kbd> again or close the panel when finished.

Also available from the dropdown: **New Blank Keyboard Layout** and **New Duplicate Keyboard Layout**.

## Reference

### Layout management

- Rename, delete, duplicate user layouts
- Import / export custom layouts as JSON
- Switch which layout is being edited vs which is current

### Placement rules

- Custom layouts are **exclusive**: only assigned keys plus the always-on system layer run.
- Parameterized Functions become **Action Instances** with saved settings (label, destinations, script body, etc.).
- Some Functions (for example Type Characters) may only bind to **modifier chords**, not bare letter keys, so they can run while typing.

### Tips

- Keep Keyboard Reference visible while placing — hover keycaps to confirm.
- Start from Duplicate of Browsing if you only want a few changes.
- See *Functions & Actions* and *Execute JS* for what you can place.
