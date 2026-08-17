# Execute JS

Execute JS is a Script Function you can bind to a key or drop into a Macro. Use it when a built-in Function is not enough.

## Use it

1. Open **Keyboard Layout Config** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. Create a new **Execute JS** Action Instance in the Actions Library.
3. Paste your script.
4. Optionally enable **Callbacks** (popover, clipboard, notify).
5. Place the instance on a key — or add it as a Macro step (Logic chips sit beside Execute JS in the builder).
6. Press the key on a page to run. In a Macro, the script’s return value becomes the next Gate’s `kpPriorResult`.

Scripts run in the **content-script isolated world**: they can use the page DOM, but not the page’s own JavaScript globals. There is an **8s** timeout.

## Reference

### Bindings always provided

| Binding | Meaning |
| --- | --- |
| `kpHoveredClickable` | Clickable under the cursor |
| `kpHoverLeaf` | Leaf element under the cursor |
| `kpFocusedTextField` | Focused text field, if any |
| `kpMode` | Current KeyPilot mode |
| `kpPageUrl` | Page URL |
| `kpSelection` | Current selection data |
| `kpPriorResult` | Previous Macro step result |

### Callbacks (only if enabled)

| Callback | Role |
| --- | --- |
| `showPopover` | Show a result popover |
| `copyToClipboard` | Copy text |
| `notify` | Show a notification |

### Macro integration

- Multiple Execute JS steps are allowed in one Macro.
- Return a value intentionally when a following Gate should branch.
- Prefer small scripts; use built-in Functions for clipboard and navigation when they already cover what you need.

### Safety notes

- Isolated world ≠ page world: `window` APIs from the site’s scripts are not directly shared.
- Do not paste untrusted scripts.
- Failed or timed-out scripts stop that step; Gates can detect empty results.
