# Chrome store listing screenshots

npm run store:screenshots:auto -- --locales=en,es,es_419,de && npm run store:screenshots -- --all



No Playwright. Capture real KeyPilot UI with **chrome-dev / CDP**, then rasterize
annotated listing PNGs.

```text
npm run store:screenshots:serve     # fixture + capture playbook
npm run store:screenshots           # English screenshots + global promo tiles
npm run store:screenshots -- --promo-only
npm run store:screenshots -- --locale=en
```

Chrome does **not** read these files from the packed extension. Upload generated
PNGs by hand in the Developer Dashboard.

Listing overlay type is Titillium plus CJK fallbacks. Rasterization loads
`extension/fonts/` (Latin) and, if needed, Noto CJK subset files under
`scripts/store-screenshots/fonts/` or macOS Hiragino/STHeiti. Do not copy those
CJK faces into the extension bundle.

## Automated Chrome capture

For unattended capture, use the Chrome launcher and CDP runner. It sets
Chrome's macOS `AppleLanguages` preference, starts a disposable profile with
the unpacked extension loaded, captures every slot in `slots.json`, and writes
locale metadata:

```bash
npm run build
npm run store:screenshots:auto -- --locales=en,es,es_419,de
npm run store:screenshots -- --all
```

Each locale opens the fixture with `?lang=` so page copy, layout, and Wikimedia
photos match the capture folder (`en`, `es`, `es_419`, `de`).

The runner uses **Google Chrome for Testing** at
`/Applications/Google Chrome for Testing.app`, a disposable profile under
`tmp-captures/chrome-profiles/`, and a free CDP port. It does not use or
modify the normal Chrome or Brave profiles. Use `--port=9222` when another
tool needs a fixed port, or `--keep-browser` to leave the last instance open.
Use `--locales=en` to run one locale. Override the binary with
`--browser-binary=` or `CHROME_BINARY` if needed.

KeyPilot chrome is queried through **open shadow roots** and **same-origin
iframes** (Settings/Docs popovers). Mouse clicks use top-level viewport
coordinates, including iframe offsets.

The runner fails early when the loaded service worker is not KeyPilot instead
of waiting for the page API indefinitely.

The current runner captures the slots defined in `online-stores/chrome/slots.json`;
adding slots and their `page-api.js` states automatically adds them to the
capture loop. The launch step is deterministic, but Chrome's macOS UI language
is process-level, so each locale is launched in sequence rather than inside a
single browser process.

Slot 5 is not a live Chrome context menu. `page-api.js` draws a mock page menu
(`chromePageMenuCopy`) and then KeyPilot items from `chrome.i18n`. Add the
locale to that map when capturing a new language; otherwise Back/Forward/Reload
stay English.

## Capture (once per locale)

1. `npm run build`
2. Load unpacked `extension/` in a Chrome profile whose **UI language** is the
   capture locale (`chrome://settings/languages`, or `--lang=en-US`).
3. `npm run store:screenshots:serve` and open the printed fixture URL with `?lang=` matching the capture locale.
4. Set the viewport to **1280×800** at **1×** device scale.
5. Wait until `__KP_STORE_SHOTS.ready()` is true, then for each slot in
   `online-stores/chrome/slots.json`:

```js
await __KP_STORE_SHOTS.reset()
await __KP_STORE_SHOTS.open('key-click-browsing')  // or keyboard-map / customize-workflow / walkthrough / context-menu
```

6. Screenshot the **viewport** (full page chrome, not a cropped overlay).
7. Save through the helper:

```bash
npm run store:screenshots:serve -- write en key-click-browsing < shot.png
```

That writes `online-stores/chrome/captures/<locale>/<captureFile>` and updates
`meta.json` so the generator can prove capture locale matches annotation locale.

Do not place an English capture under `captures/es/` or annotate another
locale’s screenshot with English copy.

## Generate

Requires `@resvg/resvg-js` (devDependency) to rasterize SVG templates.

- English is the first generated locale (`initialLocales` in `slots.json`).
- `--all` generates every shipped `_locales` catalog that is not excluded.
- Marked test catalogs (`en_GB`) and `excludeLocales` never emit assets.
- A shipped locale without complete `chrome/copy/<locale>.json` fails.

Outputs:

- `online-stores/generated/chrome/<locale>/01-*.png` … listing screenshots
- `online-stores/generated/chrome/promo/small.png` and `marquee.png` (English only)

## Upload

See `online-stores/README.md` and `online-stores/chrome/RELEASE-CHECKLIST.md`.
