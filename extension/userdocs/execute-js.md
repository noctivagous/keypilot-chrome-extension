# Execute JS

Execute JS is a Script Function you bind to a key when a built-in Function is not enough. You paste a JavaScript snippet; KeyPilot runs it when that key is pressed.

<div class="kp-docs-ai-prompt">
<label for="kp-docs-execute-js-ai-prompt">Prompt for an AI chat — paste this, then finish the first sentence with what you want the script to do.</label>
<textarea id="kp-docs-execute-js-ai-prompt" class="kp-docs-copy-prompt" readonly rows="22">I would like JavaScript code for KeyPilot, a Chrome extension, and I want it to …

Here is how KeyPilot works and what it is.

KeyPilot is a Chrome extension for keyboard-driven browsing: you point with the mouse and fire actions with keys. Functions (reusable operations) are bound to keys in Keyboard Layout Config (Alt+C). Execute JS is a Function whose Action Instance holds a pasted script. When the key is pressed, KeyPilot runs that script.

Write a complete script I can paste into the Execute JS “Script” field. Do not wrap it in a function declaration — the snippet is already the body of an async function.

Runtime rules:
- Isolated world (content script): DOM APIs work (document, querySelector, Element). The page’s own JavaScript globals (React, jQuery, app `window` properties) are not visible.
- No chrome.* APIs, no KeyPilot instance, no storage APIs.
- You may use await. Hard timeout is 8 seconds.
- Return a value if this will be a Macro step (the next step sees it as kpPriorResult).

Bindings always injected (may be null / undefined):
- kpHoveredClickable — Element KeyPilot currently treats as the hovered clickable (link/button), or null
- kpHoverLeaf — deepest Element under the cursor, or null
- kpFocusedTextField — focused text field / contenteditable, or null
- kpMode — string mode: "none" | "inspector" | "text_focus" | "highlight" | "scroll_line" | "popover" | "omnibox"
- kpPageUrl — current page URL string
- kpSelection — window.getSelection() (Selection API), or null
- kpPriorResult — previous Macro step result (only when this script runs as a Macro step)

Callbacks exist only if the matching checkbox is enabled on the Action Instance; otherwise they are undefined. Guard with `if (typeof showPopover === "function")`.
- await showPopover(content, title?) — result popover; content is stringified (objects → JSON)
- await copyToClipboard(content) — copies stringified text; returns boolean
- notify(message) — brief flash notification

Please output only the script body.</textarea>
<p class="muted">Click the box and copy (⌘C / Ctrl+C). Edit only the first sentence in the AI chat after you paste.</p>
</div>

## Use it

1. Open **Keyboard Layout Config** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. Create a new **Execute JS** Action Instance in the Actions Library.
3. Paste your script into **Script**.
4. Enable any **Callbacks** you will call (`showPopover`, `copyToClipboard`, `notify`).
5. Place the instance on a key.
6. Press the key on a page to run.

Scripts run in the **content-script isolated world**. There is an **8 second** timeout.

## Bindings always provided

Every run injects these names as parameters of the async function that wraps your snippet. They are **not** globals you have to declare.

| Binding | Type | Meaning |
| --- | --- | --- |
| `kpHoveredClickable` | `Element \| null` | The clickable KeyPilot is highlighting under the cursor (same target Click Element would activate). `null` if nothing clickable is hovered. |
| `kpHoverLeaf` | `Element \| null` | The deepest DOM node under the cursor (text, image, or nested element), even when it is not a KeyPilot clickable. |
| `kpFocusedTextField` | `Element \| null` | The focused text input, textarea, or `contenteditable` when KeyPilot considers you in text entry. `null` if no field is focused. |
| `kpMode` | `string \| null` | Current KeyPilot mode. Typical values: `none` (normal browse), `inspector` (Delete Mode / Cols Toggle pick), `text_focus`, `highlight` (character select), `scroll_line`, `popover`, `omnibox`. |
| `kpPageUrl` | `string` | `location.href` of the page the content script is on. |
| `kpSelection` | `Selection \| null` | The browser `window.getSelection()` object (anchor/focus, `toString()`, ranges). Not KeyPilot’s custom unit-select highlights. |
| `kpPriorResult` | `any` | The return value of the previous Macro step when this script is used **inside a Macro**. `undefined` when you press the key as a standalone Action. |

Use `kpHoveredClickable` for “the link/button I am pointing at.” Use `kpHoverLeaf` for “whatever pixel is under the cursor.” Use `kpFocusedTextField` to read or write the active field.

## Callbacks (only if enabled)

These names are **functions only when the matching checkbox is on** for that Action Instance. If the box is off, the binding is `undefined` — calling it throws.

| Callback | Signature | Role |
| --- | --- | --- |
| `showPopover` | `async (content, title?) => void` | Opens KeyPilot’s result popover. `content` is coerced to text (strings as-is; objects via `JSON.stringify`). Default title is `Execute JS`. |
| `copyToClipboard` | `async (content) => boolean` | Copies the stringified value to the clipboard. Returns `false` if the text is empty. |
| `notify` | `(message) => void` | Shows a short flash notification. Non-strings are stringified. |

Example:

```js
if (typeof notify === 'function') notify('Ran Execute JS');
const text = (kpHoveredClickable && kpHoveredClickable.textContent) || '';
if (typeof copyToClipboard === 'function') await copyToClipboard(text.trim());
if (typeof showPopover === 'function') await showPopover(text.trim() || '(empty)', 'Hovered text');
return text;
```

## Return value

- The snippet is the **body of an `async` function**. You may `return` any value and use `await`.
- As a **key press**, the return value is unused except that the handler still waits for the promise.
- As a **Macro step**, the return value becomes `kpPriorResult` for the next step. A thrown error or timeout stops the Macro at this step.

```js
return kpHoveredClickable && kpHoveredClickable.getAttribute('href');
```

## Examples

Copy the hovered clickable’s visible text:

```js
const el = kpHoveredClickable;
if (!el) {
  if (typeof notify === 'function') notify('Nothing clickable under the cursor');
  return '';
}
const text = (el.innerText || el.textContent || '').trim();
if (typeof copyToClipboard === 'function') await copyToClipboard(text);
return text;
```

Read the focused field:

```js
const field = kpFocusedTextField;
if (!field) return '';
return 'value' in field ? String(field.value || '') : String(field.innerText || '');
```

## Safety notes

- Isolated world ≠ page world: site-defined `window` APIs are not shared.
- Do not paste untrusted scripts. The snippet can read the DOM of the current page.
- Failed or timed-out scripts stop that step; Gates can detect empty results.
- Prefer enabling only the callbacks you call so unused names stay `undefined`.
