# Execute JS

Execute JS is a Script Function you bind to a key when a built-in Function is not enough.

## Use it

1. Open **Keyboard Layout Config** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. Create a new **Execute JS** Action Instance in the Actions Library.
3. Paste your script.
4. Optionally enable **Callbacks** (popover, clipboard, notify).
5. Place the instance on a key.
6. Press the key on a page to run.

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
| `kpPriorResult` | Previous result when run as a Macro step (Macro Builder builds) |

### Callbacks (only if enabled)

| Callback | Role |
| --- | --- |
| `showPopover` | Show a result popover |
| `copyToClipboard` | Copy text |
| `notify` | Show a notification |

### Safety notes

- Isolated world ≠ page world: `window` APIs from the site’s scripts are not directly shared.
- Do not paste untrusted scripts.
- Failed or timed-out scripts stop that step; Gates can detect empty results.
