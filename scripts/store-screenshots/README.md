# Chrome store listing screenshots

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

## Capture (once per locale)

1. `npm run build`
2. Load unpacked `extension/` in a Chrome profile whose **UI language** is the
   capture locale (`chrome://settings/languages`, or `--lang=en-US`).
3. `npm run store:screenshots:serve` and open the printed fixture URL.
4. Set the viewport to **1280×800** at **1×** device scale.
5. Wait until `__KP_STORE_SHOTS.ready()` is true, then for each slot in
   `online-stores/chrome/slots.json`:

```js
await __KP_STORE_SHOTS.reset()
await __KP_STORE_SHOTS.open('key-click-browsing')  // or keyboard-map / customize-workflow
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
