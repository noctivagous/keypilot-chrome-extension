# Functions & Actions

Functions are the building blocks you bind to keys. An **Action Instance** is a Function plus saved parameter values.

## Use it

1. Open **Keyboard Layout Config** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. Browse or search the **Actions Library** (card or table view).
3. Select a Function. If it has parameters, create or edit an **Action Instance** (name it clearly).
4. Click a Keyboard Reference keycap to place that instance.
5. Press the key on a normal page to run it.

To change behavior later, edit the instance’s parameters in Config — every key that uses that instance picks up the change.

## Reference

### Concepts

| Term | Meaning |
| --- | --- |
| **Function** | Reusable operation definition |
| **Action Instance** | Function + saved parameters |
| **Key Action** | What occupies a slot — Function/instance or Macro |
| **Result destination** | Clipboard, popover, page change, Media Library, etc. |

### Library categories (overview)

Navigation · Tab Control · Begin URL · Get Page Data · Maps · Scroll · Select · Clipboard · Type · Keystrokes · Data · Lookup · Translate · Script · Media Library · AI · KeyPilot · Tools · System

### Notable Functions

<h3 id="type-characters">Type Characters</h3>

Insert saved text into the focused field. Bind with a modifier chord so it can run while typing. Create one Action Instance per snippet.

<h3 id="font-info">Font Info</h3>

Popover with family, size, file type, and download URL for the styled text under the cursor, plus an outline of that text run.

<h3 id="lookup-word">Lookup Word</h3>

Free Dictionary API definition for the word under the cursor. Optional Ask AI source on the Action Instance when that path is available.

<h3 id="translate">Translate</h3>

Translate the highlight, or the word/sentence/paragraph under the cursor. Destination can replace page text or open a popover.

<h3 id="send-text-to-ai">Send selection to AI</h3>

Sends selected text with a configurable instruction. Route the result to the clipboard, a popover, or both.

<h3 id="get-text-at-cursor">Get text / media under cursor</h3>

**Get Text At Cursor** copies word, sentence, paragraph, or hyperlink text. **Get Media At Cursor** copies image, video, or audio under the cursor. **Get Text Range** is a Macro Step that passes the current highlight to the next step.

<h3 id="show-popover">Show Popover</h3>

Macro Step that displays the previous step’s result (or fallback text) in a result popover.

<h3 id="poi">Map place (POI)</h3>

When a map pin is under the cursor: **Place Website** opens the place page in Link Preview; **Place Address** copies the street address (txt or vCard).

<h3 id="media-library-functions">Add / Fetch URL for Media Library</h3>

**Add URL** stores the hovered href without downloading. **Fetch URL** downloads the linked file (PDF, audio, video, image) into Media Library.

<h3 id="execute-js">Execute JS</h3>

Custom script Function. Full bindings, callbacks, and an AI prompt: [Execute JS](kp://docs/execute-js).

<h3 id="keystrokes">Macro Keys (keystrokes)</h3>

Hotkey, burst, round-robin, continuous key, synthetic mouse, and remaps — instantiable keystroke Functions in the Actions Library. See [Keyboard Layout Config](kp://docs/layout-config).

### Stock vs user

Built-in layouts are read-only sources; editing forks a user copy you own.
