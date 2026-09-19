# Store release builds

How to produce reviewable KeyPilot packages from this repo. Run all commands
from the repository root.

Day-to-day unpacked Chrome development uses `npm run build` and loads
`extension/`. Store ZIPs go through `npm run package:<channel>`, which first
runs a `--release` build.

`--release` (`node extension/build.js --release`) omits the Settings **Debug**
section from packaged builds. `npm run package:<channel>` compiles that in
`extension/`, copies the store tree into `dist/`, then restores the development
files it rewrote (tracked bundles, README stamp, popup version, early-inject).
The unpacked `extension/` folder stays a debug build. Running
`npm run build:release` by itself still leaves a release compile until you run
`npm run build` again.

## Before packaging

```bash
npm test
npm run audit
```

`npm test` includes `npm run check:locales`. Record the audit in the release
notes (see `extension/README.md`, Release cadence).

Do **not** ship `npm run build:minify` / `content-bundled.min.js` in store
ZIPs. Channel configs reject that file.

## Chrome Web Store

```bash
npm run package:chrome
```

1. Runs `npm run build:release`
2. Stages `dist/chrome/` from `extension/` (excludes listed in
   `scripts/chrome/release-config.json`)
3. Restores the development working tree
4. Writes `dist/keypilot-chrome-v{version}.zip`

`{version}` comes from `extension/manifest.json`. Packaging copies a staged
tree; it does **not** rewrite the development `extension/manifest.json`.
Manifest name/description stay `__MSG_*__` references, with copy in
`extension/_locales/`.

Already built? `node scripts/package-chrome.mjs --skip-build`

## Opera Add-ons

```bash
npm run package:opera
```

Same `--release` Chrome-family build. ZIP: `dist/keypilot-opera-v{version}.zip`.
Staging: `dist/opera/`. Config: `scripts/opera/release-config.json`.

## Microsoft Edge Add-ons

No separate Edge build. Upload the Chrome Web Store ZIP (see
[`EDGE_BUILD_DIRECTORY.md`](./EDGE_BUILD_DIRECTORY.md)).

## Firefox (AMO)

```bash
npm run package:firefox
```

1. Runs `npm run build:firefox:release` (`node extension/build.js --firefox --release`)
2. Emits a Firefox tree in `extension-firefox/` (gitignored)
3. Stages `dist/firefox/`
4. Writes `dist/keypilot-firefox-v{version}.zip`

Config: `scripts/firefox/release-config.json`. Firefox is opt-in; default
`npm run build` does not produce it. See
[`FIREFOX_BUILD_DIRECTORY.md`](./FIREFOX_BUILD_DIRECTORY.md).

Reviewer source archive (pre-esbuild sources so AMO can reproduce the package):

```bash
npm run package:firefox-source
```

Writes a ZIP under `dist/` of the sources needed to run `npm run package:firefox`
after `npm ci`. Bundled outputs and `node_modules` are omitted.

## Shared packaging

`scripts/package-channel.mjs` is the implementation behind
`package:chrome`, `package:opera`, and `package:firefox`. It validates
generated bundles, required runtime files, locale catalogs, and that the
staged manifest keeps `__MSG_*__` metadata.

Localization and listing-screenshot checks for a release are in
[`i18n/README.md`](../i18n/README.md) (release checklist) and
[`online-stores/README.md`](../online-stores/README.md).
