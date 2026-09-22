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

| Locale | `_locales/<l>/messages.json` | `userdocs/<l>/` | `onboarding/<l>.xml` | `online-stores/chrome/copy/<l>.json` | `online-stores/chrome/listing/<l>.txt` | `online-stores/chrome/captures/<l>/` | `online-stores/generated/chrome/<l>/` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `en` (source/default) | yes | yes | yes | yes | yes | yes | yes |
| `de` | yes | yes | yes | yes | yes | yes | yes |
| `es` | yes | yes | yes | yes | yes | yes | yes |
| `es_419` | yes | no (falls back to `es`/`en`) | no (falls back to `es`/`en`) | yes | yes | yes | yes |
| `sk` | yes (2026-09-22, machine-translated, needs bilingual review) | no | no | no | no | no | no |

A locale can ship with only `messages.json` complete — Docs, onboarding, and
store assets fall back to base language then English. But it is not a
*finished* localization until the rest of this table's row is filled in or
explicitly deferred (see [`i18n/README.md`](../i18n/README.md#add-a-locale)).

## Locations and what "done" means

### 1. Extension UI strings — `extension/_locales/<locale>/messages.json`

- Manifest name/description, popup, Settings, Guide, Docs chrome, New Tab
  chrome, context menus, built-in action/function/macro catalogs, keyboard
  layout family labels, search-engine labels, control strip, onboarding
  in-app strings (not the walkthrough script itself).
- Needs: every English key present, non-empty `message`, identical
  `placeholders` names/examples as English, `description` left untouched
  (it's translator metadata, never shown to users). Brand name `KeyPilot`
  stays untranslated. Public product/site names (Google, Brave, Gmail,
  Instagram, …) stay untranslated. `$1`/`$2` tokens preserved in position.
- Verify: `npm run check:locales` (missing/extra keys, empty messages,
  placeholder mismatches — not translation quality or UI fit).
- Do NOT put long-form Markdown or onboarding copy here (see §2, §3).

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

### 8. Manifest metadata — `extension/manifest.json`

- `name`, `description`, `action.default_title` must stay as `__MSG_*__`
  references, never literal strings. `default_locale` stays `"en"`.
- Packaging (`scripts/package-channel.mjs` and all `npm run package:*`
  targets) must retain those `__MSG_*__` references in the staged manifest
  and include `_locales/` in the archive. Check after any packaging-script
  change.

### 9. Test-only / fixture locales — `test/fixtures/locales/`

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

## Verification commands

```bash
npm run check:locales   # catalog key/placeholder parity across all shipped locales
npm test                # includes check:locales, plus catalog-display and locale-fallback unit tests
npm run build           # confirms build succeeds with new/changed catalogs
npm run package:chrome  # inspect staged manifest + archive contents for _locales/
```

`check:locales` only proves structural completeness (keys, placeholders,
non-empty). It proves nothing about translation quality, UI fit, or whether
§2–§7 above were addressed. Treat a new or extended locale as incomplete
until every applicable row in the coverage snapshot is filled in or the gap
is explicitly and consciously deferred (as `es_419` currently defers Docs and
onboarding to its `es` base language).

## Related references

- [`i18n/README.md`](../i18n/README.md) — day-to-day workflow, add-a-locale
  steps, release checklist
- [`CHROME_I18N_TASK_ITEMS.md`](CHROME_I18N_TASK_ITEMS.md) — design
  constraints, phased implementation history, CJK/RTL readiness work
- [`extension/userdocs/README.md`](../extension/userdocs/README.md)
- [`extension/onboarding/README.md`](../extension/onboarding/README.md)
- [`online-stores/README.md`](../online-stores/README.md)
- [`scripts/store-screenshots/README.md`](../scripts/store-screenshots/README.md)
