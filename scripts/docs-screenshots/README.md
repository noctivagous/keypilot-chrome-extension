# Docs chrome screenshots (chrome-dev)

No Playwright. The catalog is [`shots.json`](shots.json). Capture with **Grok Build chrome-dev** (or any CDP tool) against Chrome that already has KeyPilot loaded unpacked.

## One-time

1. `npm run build`
2. In Chrome Dev, load unpacked `extension/` and enable KeyPilot.
3. `npm run docs:screenshots` — prints the fixture URL and leaves a tiny static server running.

## Per shot (in-page chrome)

On the fixture page, wait until `__KP_DOCS_SHOTS.ready()` is true, then:

```js
__KP_DOCS_SHOTS.reset()
__KP_DOCS_SHOTS.open('settings', { panelId: 'keyboard' })  // kind + opts from shots.json
```

Screenshot the `selector` host (light DOM: Settings/Docs popover, Keyboard Reference, Config, Control Strip, Omnibox, Launcher). Save as `extension/userdocs/images/<file>`.

If the tool gives base64/PNG on stdout:

```bash
npm run docs:screenshots -- write settings-keyboard < shot.png
# or base64:
pbpaste | npm run docs:screenshots -- write settings-keyboard
```

## Extension pages (`popup`, `guide`)

Open `chrome-extension://<id>/popup.html` or `…/pages/guide.html` (id from `chrome://extensions`). Screenshot `body`.

## After UI changes

Re-capture the affected ids in `shots.json`, commit the PNGs. Markdown already points at `images/<file>.png`.
