# Localization inventory

A location map of every place localized content lives in this repo, plus what
"done" means at each location. Use this to scope a translation task (adding a
locale, or extending an existing locale) so nothing is missed.

This is a checklist, not a cage: it reflects the locations known at the time
of writing. If you find product-owned, user-visible English text that isn't
covered by any row below, treat it as a real gap — add it to this file and
localize it — rather than skipping it because it isn't listed here.

For the day-to-day workflow (how to add a message key, how to add a locale,
release checklist), see [`i18n/README.md`](../i18n/README.md). For historical
implementation phases and design constraints, see
[`CHROME_I18N_TASK_ITEMS.md`](CHROME_I18N_TASK_ITEMS.md). This file is the
"where is everything" index that both of those assume.

## Locale coverage snapshot

Regenerate this table (`ls extension/_locales`, etc.) before trusting it — it
is a snapshot, not a live status. As of 2026-09-22:

| Locale | `_locales/<l>/messages.json` | `userdocs/<l>/` | `onboarding/<l>.xml` | `online-stores/chrome/copy/<l>.json` | `online-stores/chrome/listing/<l>.txt` | `online-stores/chrome/captures/<l>/` | `online-stores/generated/chrome/<l>/` | intro reel (`promo/intro-reel`) | site (`promo/web`) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `en` (source/default) | yes | yes | yes | yes | yes | yes | yes | copy + YouTube | yes |
| `de` | yes | yes | yes | yes | yes | yes | yes | copy + YouTube | yes |
| `es` | yes | yes | yes | yes | yes | yes | yes | copy + YouTube | yes |
| `es_419` | yes | no (falls back to `es`/`en`) | no (falls back to `es`/`en`) | yes | yes | yes | yes | copy + YouTube | yes |
| `sk` | yes (2026-09-22, machine-translated, needs bilingual review) | no | no | no | no | no | no | copy; YouTube pending | HTML yes; listing PNGs missing (`web:locales:check` fails) |
| `zh_CN` | yes | yes | yes | yes | yes | capture when generating listing shots | generate from captures | copy; YouTube pending | yes |
| `zh_TW` | yes | yes | yes | yes | yes | capture when generating listing shots | generate from captures | copy; YouTube pending | yes |
| `zh_HK` | yes (from `zh_TW` Traditional, 2026-09-22) | yes | yes | yes | yes | yes (gitignored captures) | yes (gitignored generated PNGs) | copy; YouTube pending | no |
| `ja` | yes (2026-09-22, machine-translated, needs bilingual review) | yes (machine-translated, needs bilingual review) | yes | yes | yes | no | no | copy; YouTube pending | no |

A locale can ship in the extension with only `messages.json` complete — Docs,
onboarding, and store assets fall back to base language then English. The
marketing site does not fall back: `npm run web:locales` emits a folder only
for ids registered in `promo/web/locales/generate.mjs`, and
`npm run web:locales:check` fails if that locale is missing any of the five
listing PNGs. It is not a *finished* localization until the rest of this
table's row is filled in or explicitly deferred (see
[`i18n/README.md`](../i18n/README.md#add-a-locale) and
[Add a locale](#add-a-locale-extension-and-website) below).

## Locations and what "done" means

### 1. Extension UI strings — `extension/_locales/<locale>/messages.json`

- Manifest name/description, popup, Settings, Guide, Docs chrome, New Tab
  chrome, context menus, built-in action/function/macro catalogs, keyboard
  layout family labels, search-engine labels, control strip, onboarding
  in-app strings (not the walkthrough script itself).
- Needs: every English key present in a language catalog, non-empty
  `message`, identical `placeholders` names/examples as English,
  `description` left untouched (it's translator metadata, never shown to
  users). A regional catalog may omit keys that its shipped parent language
  catalog already defines (`es_419` omits a key only when `es` has it).
  Brand name `KeyPilot` stays untranslated. Public product/site names
  (Google, Brave, Gmail, Instagram, …) stay untranslated. `$1`/`$2` tokens
  preserved in position.
- Verify: `npm run check:locales` (extra keys, empty messages, placeholder
  mismatches, and gaps that are not covered by a shipped parent language
  catalog — not translation quality or UI fit).
- Do NOT put long-form Markdown, onboarding copy, intro-reel copy, or
  marketing-site section copy here (see §2, §3, §8, §9). Keyboard-window
  labels (`fn_*`, `keycap_*`, `keyboard_help_*`, `key_info_*`) do live here;
  the site generator copies a slim subset into `promo/web/messages/`.

### 2. In-product help — `extension/userdocs/<locale>/`

- `index.json` (navigation labels) plus per-topic Markdown files.
- Needs: mirror English topic IDs and filenames exactly; translate
  `index.json` titles together with the matching topic body; preserve
  `kp://docs/<topic-id>` links and heading anchors (anchors must stay
  linkable — see the Unicode-safe-anchor prerequisite in
  [`CHROME_I18N_TASK_ITEMS.md`](CHROME_I18N_TASK_ITEMS.md#future-locale-readiness--cjk)
  for non-Latin scripts).
- Images: shared/language-neutral screenshots live in
  `extension/userdocs/images/`; only create a locale-specific image when the
  screenshot itself contains translated UI text.
- Fallback: exact locale → base language → `en`, resolved by the Docs loader.
- Details: [`extension/userdocs/README.md`](../extension/userdocs/README.md).

### 3. Onboarding walkthrough — `extension/onboarding/<locale>.xml`

- Needs: identical slide IDs, task IDs, `<when>` action/target/mode/change
  values, and overlay action IDs as `en.xml`. Translate only slide titles,
  body text, task labels, and overlay text attributes.
- The early-inject script only ever stamps the English model for first paint;
  the content script swaps in the best-available localized model afterward.
  Never embed non-English walkthrough copy into the eager/early-inject path.
- Fallback: exact locale → base language → `en`.
- Details: [`extension/onboarding/README.md`](../extension/onboarding/README.md).

### 4. Chrome Web Store screenshot annotations — `online-stores/chrome/copy/<locale>.json`

- Headline/callout copy overlaid on real, locale-captured UI screenshots via
  SVG templates.
- Needs: complete copy for every defined screenshot slot; must match the
  locale of the underlying GUI capture (never mix a capture from one locale
  with annotation copy from another).

### 5. Chrome Web Store detailed description — `online-stores/chrome/listing/<locale>.txt`

- Needs: same feature set/claims as the English listing description. This is
  **not shipped in the extension package** — it's pasted by hand into the
  Chrome Developer Dashboard's Store Listing tab per locale, after selecting
  that language in the dropdown (the dropdown only lists locales present in
  the uploaded package's `_locales/`).
- See the full manual upload procedure in
  [`CHROME_I18N_TASK_ITEMS.md`](CHROME_I18N_TASK_ITEMS.md#chrome-developer-dashboard-localized-listing-descriptions-screenshots-promo-video).

### 6. Store GUI captures — `online-stores/chrome/captures/<locale>/`

- Real KeyPilot screenshots taken from an actual Chrome profile running that
  UI locale. Never reuse another locale's capture underneath translated
  annotations (SVG templates only overlay text, they do not redraw the UI).
- `scripts/store-screenshots/fixture.html` is the localized news-page fixture
  behind screenshot slot 1. Add a matching locale object and any necessary
  system-font stack when adding a capture locale; its `?lang=<locale>` view
  must show real locale copy for the GUI capture.
- Generate via `npm run store:screenshots:serve` +
  `npm run store:screenshots -- --locale=<locale>`.

### 7. Generated store screenshot PNGs — `online-stores/generated/chrome/<locale>/`

- Build output composited from §4 + §6 through the SVG templates in
  `online-stores/chrome/templates/`. Deterministic; do not hand-edit.
- Global-only assets (never per-locale): small promo tile `440×280` and
  marquee promo tile `1400×560` under
  `online-stores/generated/chrome/promo/`. Chrome does not accept localized
  variants of these — generate once in English.
- Upload localized screenshots manually per locale in the Dashboard's
  **Localized screenshots** section; record the upload in
  `online-stores/chrome/RELEASE-CHECKLIST.md`.

### 8. Intro reel — `promo/intro-reel/`

- Shared composition: `key-click-intro.html` (one timeline for every locale).
  Per-locale copy lives in `locales/key-click-intro/<locale>.json`. Keep the
  same variable keys as English; translate values only. Brand name `KeyPilot`
  and `Chrome Web Store` stay untranslated. Register the locale in
  `locales/key-click-intro/apply.js` (`LOCALES` + `HTML_LANG`) and add a
  matching object to `locales/key-click-intro/batch.json`.
- CJK locales must set `html` `lang` (`ja` / `zh-CN` / `zh-TW` / `zh-HK`) so
  the composition’s Noto Sans JP/SC/TC/HK stacks apply. Preview with
  `key-click-intro.html?lang=<locale>`.
- Render is local and gitignored: `npx hyperframes render --composition
  key-click-intro.html --variables-file locales/key-click-intro/<locale>.json
  --output renders/key-click-intro-<locale>.mp4`. Batch: `--batch
  locales/key-click-intro/batch.json --output
  "renders/key-click-intro-{locale}.mp4"`.
- Chrome does not take the MP4. Paste `promo/intro-reel/youtube-description-<locale>.txt`
  into YouTube (title is the first line), then record `youtube_url` /
  `youtube_id` in `promo/intro-reel/youtube.json` and paste the URL as
  **Localized promo video** in the Developer Dashboard for that language.
- Details: [`promo/intro-reel/README.md`](../promo/intro-reel/README.md).

### 9. Marketing site — `promo/web/`

English `index.html` and `assets/keyclick-*.svg` are the tagged source.
Per-locale marketing copy lives in `promo/web/locales/<locale>.json` (same
keys as `en.json`, including screenshot captions). Do not hand-edit `de/`,
`es/`, and the other generated locale directories. Do not put keyboard-key
labels in the site JSON; those come from §1.

`npm run web:locales` (and `npm run web:locales:check`) does all of the following:

1. Writes `<locale>/index.html` and `<locale>/assets/keyclick-*.svg` from the
   English source plus `locales/<locale>.json`. Keycaps tagged
   `data-hardware-code` take their legends from the locale’s physical model.
2. Stamps `data-hardware` from `HARDWARE_BY_LOCALE` in
   `promo/web/locales/generate.mjs`. Shipped models are `us-ansi-qwerty`,
   `de-de-qwertz-iso`, `es-es-qwerty-iso`, and `sk-sk-qwertz-iso`. A locale
   with no matching model uses `us-ansi-qwerty`. Do not invent legends.
3. Writes `promo/web/messages/<locale>.json`, a slim extract of
   `extension/_locales/<locale>/messages.json` (`fn_*_label`,
   `fn_*_description`, `keycap_*`, `keyboard_help_*`, `key_info_*`, hardware
   layout labels, the Browsing family label). The keyboard window on the page
   reads this file. §1 must exist before this step or the window falls back
   to English action names.
4. Copies the five listing PNGs from
   `online-stores/generated/chrome/<locale>/` (§7) into
   `promo/web/assets/screenshots/` (English) or
   `promo/web/<locale>/assets/screenshots/`. `--check` fails if any of
   `01-key-click-browsing.png` through `05-context-menu.png` is missing.
   Generate §7 first; this script does not launch Chrome.
5. Rebuilds `promo/web/keyboard-demo.js` and refreshes shared fonts and
   titlebar icons under `promo/web/assets/` (gitignored).

Register the locale before generating, or the script will not emit a folder:

- `LOCALES`, `HTML_LANG`, `LOCALE_META`, and `HARDWARE_BY_LOCALE` in
  `promo/web/locales/generate.mjs`
- A `data-locale-path` switcher link on `promo/web/index.html`, plus
  `hreflang` alternates
- `PATHS` (and detection, if the locale is not the language base) in
  `promo/web/locale.js`
- A flag SVG in `promo/web/assets/flags/`

Directory names use underscores (`es_419`, `zh_CN`). HTML `lang` uses hyphens
(`es-419`, `zh-CN`).

Icon and hero video are not in this repo: copy
`promo-materials/web/assets/icon256.png` and
`cyberpilotfloat-optimized.mp4` into the published `assets/` folder.

Details: [`promo/web/README.md`](../promo/web/README.md).

### 10. Manifest metadata — `extension/manifest.json`

- `name`, `description`, `action.default_title` must stay as `__MSG_*__`
  references, never literal strings. `default_locale` stays `"en"`.
- Packaging (`scripts/package-channel.mjs` and all `npm run package:*`
  targets) must retain those `__MSG_*__` references in the staged manifest
  and include `_locales/` in the archive. Check after any packaging-script
  change.

### 11. Test-only / fixture locales — `test/fixtures/locales/`

- Marked catalogs used to prove locale-switching logic (e.g. `en_GB`) belong
  only here, never under `extension/_locales/`. Do not ship a locale prefixed
  or suffixed with a test marker.

## Things that must NOT be translated anywhere

- The `KeyPilot` brand name.
- Public third-party product/site names used as display labels (Google,
  Brave, DuckDuckGo, Gmail, Instagram, etc. in `search-engines.js` / launcher
  seed data).
- Stable identifiers: action IDs, function IDs, setting IDs, layout IDs,
  topic IDs, onboarding slide/task IDs, `<when>` action/target/mode/change
  values, message keys themselves, and persisted stored values.
- User-created content: custom layout names, macro names, launcher entries,
  Launch Deck titles, page-derived titles/URLs, or any text captured from a
  page the user is browsing.
- Keyboard glyphs and shortcut notation (`Alt+K`, `K`, `Tab`, `Caps`, `Shift`
  keycap text) unless a locale-specific rendering decision is explicitly
  approved.
- The `description` field inside any `messages.json` entry — that's
  translator-facing metadata, not shown to end users, and stays in English.

## Add a locale (extension and website)

Do these in order. Extension catalogs and store PNGs have to exist before the
site generator can fill the keyboard window and the screenshot section.
Underscore ids (`es_419`, `zh_CN`) are the directory names everywhere below.
HTML `lang` uses hyphens.

1. **Extension strings (§1).** Copy
   `extension/_locales/en/messages.json` to
   `extension/_locales/<locale>/messages.json` and translate it. Keep every
   key, placeholder name, and English `description`. Run
   `npm run check:locales`.
2. **In-product help and onboarding (§2, §3),** when that locale should not
   fall back. Mirror English topic ids / slide ids. These are not produced by
   `web:locales`.
3. **Store copy (§4, §5).** Add `online-stores/chrome/copy/<locale>.json`
   (every screenshot slot) and `online-stores/chrome/listing/<locale>.txt`.
   If the news-page fixture has no `?lang=<locale>` object yet, add one in
   `scripts/store-screenshots/fixture.html` before capturing.
4. **Generate listing screenshots (§6, §7).** This is the extension-side
   image generation the website consumes:

   ```bash
   npm run build
   npm run store:screenshots:auto -- --locales=<locale>
   npm run store:screenshots -- --locale=<locale>
   ```

   Confirm `online-stores/generated/chrome/<locale>/01-key-click-browsing.png`
   through `05-context-menu.png` exist. Do not hand-edit them.
5. **Intro reel (§8),** when that locale gets a video: locale JSON, `apply.js`,
   `batch.json`, description file, then the HyperFrames render. Independent of
   the site generator.
6. **Marketing-site source (§9).** Copy `promo/web/locales/en.json` to
   `promo/web/locales/<locale>.json` and translate it (page copy and the five
   screenshot captions). Register `<locale>` in `LOCALES`, `HTML_LANG`,
   `LOCALE_META`, and `HARDWARE_BY_LOCALE` in
   `promo/web/locales/generate.mjs`. Add the language-switcher link, flag,
   `hreflang` links, and `promo/web/locale.js` `PATHS` entry. Map hardware to
   an existing model, or `us-ansi-qwerty` when none exists.
7. **Generate the website.**

   ```bash
   npm run web:locales
   npm run web:locales:check
   ```

   That writes `<locale>/index.html`, localized key-click SVGs, the slim
   `promo/web/messages/<locale>.json` keyboard catalog, and
   `<locale>/assets/screenshots/01-…png` through `05-…png`. It fails while
   step 4 is missing. Do not edit the generated HTML or SVGs.
8. **Ship checks.**

   ```bash
   npm test
   npm run build
   npm run package:chrome
   ```

   Reload the unpacked extension and open `promo/web/<locale>/index.html`:
   keyboard legends match the hardware id, hover shows the localized tooltip,
   and all five screenshots load.

Locales that exist only under `extension/_locales/` (`ja`, `zh_HK` today) do
not appear on noctivagous.com until steps 6–7. A site folder without §7 PNGs
(`sk` today) fails `web:locales:check`.

## Verification commands

```bash
npm run check:locales      # extension catalog key/placeholder parity
npm run store:screenshots -- --locale=<locale>   # listing PNGs the site copies
npm run web:locales        # site HTML, keyboard messages, screenshot copies
npm run web:locales:check  # stale HTML, catalog drift, missing listing PNGs
npm test                   # includes check:locales, plus catalog-display and locale-fallback unit tests
npm run build              # confirms build succeeds with new/changed catalogs
npm run package:chrome     # inspect staged manifest + archive contents for _locales/
```

`check:locales` proves structural completeness of `extension/_locales`
(keys, placeholders, non-empty), allowing a regional catalog to omit keys
its shipped parent language catalog defines. It does not generate the website and it
proves nothing about translation quality, UI fit, or whether §2–§9 were
addressed. `web:locales:check` covers the marketing site only. Treat a new
or extended locale as incomplete until every applicable row in the coverage
snapshot is filled in or the gap is explicitly and consciously deferred (as
`es_419` currently defers Docs and onboarding to its `es` base language).
`zh_MO` is not a shipped catalog and does not share `zh_HK`; Chrome will not
fall `zh-MO` to `zh_HK`.

## Related references

- [`i18n/README.md`](../i18n/README.md) — day-to-day message workflow and release checklist. The ordered generate-both procedure is [Add a locale (extension and website)](#add-a-locale-extension-and-website) in this file.
- [`CHROME_I18N_TASK_ITEMS.md`](CHROME_I18N_TASK_ITEMS.md) — design
  constraints, phased implementation history, CJK/RTL readiness work
- [`extension/userdocs/README.md`](../extension/userdocs/README.md)
- [`extension/onboarding/README.md`](../extension/onboarding/README.md)
- [`online-stores/README.md`](../online-stores/README.md)
- [`scripts/store-screenshots/README.md`](../scripts/store-screenshots/README.md)
- [`promo/intro-reel/README.md`](../promo/intro-reel/README.md) — key-click intro composition, locale JSON, HyperFrames render, YouTube URLs
- [`promo/web/README.md`](../promo/web/README.md) — noctivagous.com tagged HTML, JSON catalogs, locale generator
