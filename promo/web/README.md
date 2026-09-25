# noctivagous.com

English is the source. A script writes the other languages as static files. Do not swap copy in the live DOM, and do not hand-edit generated locale folders.

This is separate from HyperFrames (`promo/intro-reel/`) and from the extension `_locales` catalogs.

## Source of truth

| Role | Path |
|---|---|
| English page (tagged) | `index.html` |
| English key-click SVGs (tagged) | `assets/keyclick-landscape.svg`, `assets/keyclick-portrait.svg` |
| Flag SVGs (shared, not generated) | `assets/flags/` |
| String catalogs | `locales/en.json`, `de.json`, `es.json`, `es_419.json`, `ja.json`, `sk.json`, `zh_CN.json`, `zh_TW.json` |
| Generator | `locales/generate.mjs` |
| Redirect helper (shared, not generated) | `locale.js` |
| F/D mini-browser demo (shared, not generated) | `try-it-demo.js` |
| Shared CSS | `site.css` |
| Icon + hero video (not in this repo) | `promo-materials/web/assets/` (`icon256.png`, `cyberpilotfloat-optimized.mp4`) |

Generated output:

- `de/index.html` + `de/assets/keyclick-*.svg`
- `es/`, `es_419/`, `ja/`, `sk/`, `zh_CN/`, and `zh_TW/` the same way

Those files start with `<!-- Generated … Do not edit. -->`. Change copy in JSON; change layout in English source; then regenerate.

Keep `assets/` SVG-only in git. At deploy, copy `icon256.png` and `cyberpilotfloat-optimized.mp4` from `promo-materials/web/assets/` into the published `assets/` folder so `assets/icon256.png` and `assets/cyberpilotfloat-optimized.mp4` resolve. Locale pages expect the same files at `../assets/`. The same copy is optional for local preview (`promo/web/assets/*.png` and `*.mp4` are gitignored).

`npm run web:locales` also builds `keyboard-demo.js`, writes slim `messages/<locale>.json` from `extension/_locales`, copies keyboard fonts and titlebar icons into `assets/`, and copies the five Chrome listing PNGs into `assets/screenshots/` (English) and `<locale>/assets/screenshots/` (other languages). Physical keyboard models:

| Locale | Hardware layout |
|---|---|
| `en` | `us-ansi-qwerty` |
| `de` | `de-de-qwertz-iso` |
| `es` | `es-es-qwerty-iso` |
| `sk` | `sk-sk-qwertz-iso` |
| `ja` | `ja-jis-106` |
| `es_419`, `zh_CN`, `zh_TW` | `us-ansi-qwerty` (no separate hardware model) |

Listing PNGs come from `online-stores/generated/chrome/<locale>/`. `--check` fails if any site locale is missing one of the five files. Generate them with `npm run store:screenshots -- --locale=<id>` first. Fonts, theme icons, and those PNGs are gitignored.

## Commands

From `keypilot-chrome-extension/`:

```bash
npm run web:locales
npm run web:locales:check
```

`--check` fails if generated files are stale, if catalogs have missing/extra keys, or if tagged English text no longer matches `en.json`.

## How tagging works

Keep English text in the node. The matching `en.json` value must match that text (after `$F$` → `<kbd>F</kbd>`).

| Attribute | Use |
|---|---|
| `data-i18n="key"` | Element text. Leading empty `<span></span>` and yoke icons are kept. |
| `data-i18n-alt="key"` | `alt` |
| `data-i18n-src="key"` | `src` (Wikimedia thumbs for the Try-it mini-site) |
| `data-i18n-aria-label="key"` | `aria-label` |
| `data-i18n-letter-spacing="key"` | SVG `letter-spacing` (German **ÖFFNEN** / **ZURÜCK** need tighter tracking) |
| `data-hardware-code="KeyQ"` | Physical keycap legend from the locale’s hardware model in `extension/src/config/keyboard-hardware-layouts.js`. English source must match `us-ansi-qwerty`. |
| `data-from-web="href"` or `src` | Path relative to this folder. Locale folders get a `../` prefix. Demo SVGs stay `assets/…` because they are copied into each locale. Flag images stay in `assets/flags/` and are rewritten to `../assets/flags/…`. |
| `data-locale-path="de"` | Language-switcher `href` plus `aria-current` |
| `data-locale-current="current"` | Closed dropdown label: flag + native name from `LOCALE_META` |

Do **not** put HTML in catalog values. For sentences that wrap keycaps, use `$F$`, `$G$`, `$D$` in JSON; the generator emits `<kbd>`.

Leave untagged: KeyPilot, Noctivagous Software, the store URL, the email, `noctivagous.com` in the key-click SVG chrome, and native language names in the switcher. The Try-it omnibox host is `try_it_host` (a fake `.paper` domain for that locale’s paper). Do not put keyboard-key labels in the site JSON; those come from the hardware models.

## Add a locale

1. Copy `locales/en.json` to `locales/<id>.json` and translate.
2. Add `<id>` to `LOCALES`, `HTML_LANG`, and `LOCALE_META` in `locales/generate.mjs`.
3. Add a switcher link on `index.html` with `data-locale-path`, plus a flag SVG in `assets/flags/`.
4. Add `hreflang` / `PATHS` (and detection) in `index.html` and `locale.js` as needed.
5. Run `npm run web:locales`.

Ship `en`, `de`, `es`, `es_419`, `ja`, `sk`, `zh_CN`, `zh_TW` as directory names (underscore). HTML `lang` uses hyphens: `es-419`, `zh-CN`, `zh-TW`.
