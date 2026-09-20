# Chrome i18n phased task items

Implementation checklist for localizing KeyPilot's Chrome-extension surfaces.
For the durable workflow used for future localization work, see
[`i18n/README.md`](../i18n/README.md).

## Chrome Developer Dashboard: localized listing (descriptions, screenshots, promo video)

Chrome does **not** take listing copy, screenshots, or YouTube promo URLs from
the ZIP. Manifest `name` / `description` come from `_locales/<locale>/messages.json`.
The long description, screenshots, and promo video are entered by hand on the
item’s **Store listing** tab after a package that contains those locales is
uploaded.

Official references:

- [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Supplying images](https://developer.chrome.com/docs/webstore/images)
- [Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing)

### Prerequisite

1. Ship `default_locale` plus at least one `_locales/<locale>/` catalog in the
   uploaded package. Each dropdown language maps to one of those directories
   (`en`, `es`, `es_419`, and so on).
2. Upload the package first. The listing language selector appears only after
   Chrome has seen the internationalized package.
3. Open the item in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   and go to **Store listing**.

### What is global vs per locale

| Asset | Scope | Dashboard control | Notes |
|---|---|---|---|
| Short name and summary | Per locale (from package) | Manifest / `messages.json` | Not pasted on the listing tab. |
| Detailed description | Per locale | Store listing, after choosing a language | Paste the long description for that locale. Repeat for every shipped locale. |
| Screenshots | Global **and** localized | Global screenshots vs **Localized screenshots** | Up to five per locale. Prefer `1280×800` (or `640×400`), square corners, full bleed. Localized screenshots override global ones for that locale; locales with none use global screenshots. |
| Promo / YouTube video | Global **and** optional localized | Global promo video URL vs **Localized promo video** | Required listing field is a YouTube URL. Use **one global video** for all locales unless you have a language-specific YouTube upload. |
| Small promo tile `440×280` | Global only | Promotional images | **Cannot be localized.** Upload once. |
| Marquee promo tile `1400×560` | Global only | Promotional images | **Cannot be localized.** Optional, but needed to be eligible for the homepage marquee. |
| Store icon `128×128` | Global | Listing / package icon | Not locale-specific. |

Listing graphics and video are shown in this order ([listing docs](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)):

1. Localized promo video (if that locale has one)
2. Localized screenshots (if that locale has any)
3. Global (non-localized) promo video
4. Global screenshots

A single global YouTube URL is enough for every locale: leave **Localized promo
video** empty, and users still see the global video (after any localized
screenshots). Fill **Localized promo video** only when you have a distinct
YouTube URL in that language.

### Upload procedure

**Once (global assets)**

1. Set the **global** YouTube promo URL (English KeyPilot video, or whichever
   single video should appear everywhere).
2. Upload global screenshots if you want a fallback for locales that do not yet
   have localized PNGs.
3. Upload the global small promo tile (`440×280`) and marquee (`1400×560`) from
   `online-stores/generated/chrome/promo/`. Do not put these in Localized
   screenshots.

**For each shipped locale** (`en`, then `es`, `es_419`, …)

1. At the **top of Store listing**, choose that language in the dropdown. The
   list is the `_locales` catalogs in the uploaded ZIP.
2. Paste the **detailed description** for that locale. Keep the same feature
   set as English; Chrome may warn on inconsistent metadata, but that warning
   does not by itself block submit.
3. Under **Localized screenshots**, drop only that locale’s PNGs (KeyPilot:
   `online-stores/generated/chrome/<locale>/`, slot order `01-`…`03-`).
4. Leave **Localized promo video** blank so the **global** YouTube URL is used,
   unless this locale has its own dubbed/captioned YouTube video.
5. Repeat for the next language in the dropdown. Save/publish when every
   shipped locale has description + screenshots.

Region availability (which countries can find the item) is separate: that is
the **Distribution** tab, not the listing language dropdown. By default the
item is listed in all Chrome Web Store regions.

Uploading a new package does **not** refresh listing screenshots, descriptions,
or the promo URL. Those stay dashboard-only until you edit them again.

See `online-stores/README.md` and `online-stores/chrome/RELEASE-CHECKLIST.md`
for filenames and the per-locale upload record.

## Scope and design constraints

- Use Chrome's built-in [`chrome.i18n`](https://developer.chrome.com/docs/extensions/reference/api/i18n) message catalog mechanism. It selects strings from `_locales/<locale>/messages.json` according to the browser UI locale.
- The first implementation must have a complete English (`en`) catalog and set `"default_locale": "en"` in `extension/manifest.json`. Chrome falls back from a region locale (for example, `en_GB`) to its base language and then to `default_locale`.
- Do not ship test-only locale prefixes such as `[GB]` or `[ES]` in `extension/_locales/`. Marked catalogs used to prove a second locale is applied belong in `test/fixtures/locales/`, not in the unpacked extension. Shipped locales (`en`, later `es`, and so on) must contain real UI copy.
- `__MSG_messageKey__` substitutions work in the manifest and extension CSS. JavaScript must call `chrome.i18n.getMessage('messageKey')`; extension HTML requires explicit runtime localization.
- Preserve stable action, function, setting, and layout IDs. Localize their displayed labels and descriptions, not their identifiers or stored user data.
- Do not localize user-created layout names, macro names, custom launcher entries, browser/page-derived titles, URLs, or text captured from a page.
- Do not put long-form Markdown documentation into `messages.json`. Chrome messages are a UI-string catalog, not a documentation content system.
- Do not add migration or read-time compatibility behavior for old stored data. The current development-stage model is forward-only.
- Preserve the current lazy loading boundary: the Docs bundle and documentation assets must not become dependencies of the eager content-script bundle.

## Target architecture

```text
extension/
├── _locales/
│   ├── en/messages.json       Complete source catalog
│   └── <locale>/messages.json Translation catalog
├── manifest.json              __MSG_*__ metadata + default_locale
├── src/utils/i18n.js          Runtime message helper
└── userdocs/<locale>/         Localized Markdown and index when docs ship
```

Use `description` on every message to provide translator context. For interpolated messages, name placeholders, include examples, and pass substitutions through `getMessage`. Chrome permits at most nine substitutions per message.

Suggested message-key convention:

| Surface | Pattern | Example |
|---|---|---|
| Manifest/store metadata | `extension_*` | `extension_description` |
| Popup | `popup_*` | `popup_status_on` |
| Settings | `settings_*` | `settings_appearance_heading` |
| Context menus | `context_menu_*` | `context_menu_toggle` |
| Built-in action catalog | `action_<id>_<field>` | `action_click_element_label` |
| Function catalog | `function_<id>_<field>` | `function_translate_description` |
| Overlays/popovers | `<feature>_*` | `omnibox_placeholder` |

## Phase 1 — foundation and store metadata

**Outcome:** Chrome's extension metadata is localizable; English remains unchanged for existing users.

### Tasks

- [x] Create `extension/_locales/en/messages.json`.
- [x] Add complete English messages for the extension name, store description, and toolbar title.
- [x] Set `default_locale` to `en` in `extension/manifest.json`.
- [x] Replace manifest `name`, `description`, and `action.default_title` literals with their `__MSG_*__` references.
- [x] Review `scripts/package-channel.mjs`: it currently replaces the staged manifest's `description`. Change the channel configuration/packaging behavior so packaged manifests retain the message reference and the English release description lives in the English message catalog.
- [x] Confirm all packaging targets that copy `extension/` include `_locales/`, including Chrome, Opera, Edge's shared artifact, and Firefox staging.
- [x] Update store-release instructions as needed to make description changes occur in the English catalog, rather than by overwriting a localized manifest value.

### Acceptance criteria

- Loading `extension/` unpacked has no manifest validation errors.
- The extension name, description, and toolbar tooltip display English in an English Chrome profile.
- `npm run package:chrome` and `npm run package:opera` create archives whose manifests retain `__MSG_*__` values and whose archives include `_locales/en/messages.json`.
- Edge Partner Center can discover the manifest's localized name/description. See the existing note in `refs/EDGE_BUILD_DIRECTORY.md`.

### Validation

- [ ] Load unpacked extension in Chrome.
- [ ] Inspect `chrome://extensions` and the toolbar action tooltip.
- [x] Inspect staged ZIP contents and staged `manifest.json`.
- [x] Run the ordinary build and package commands.

## Phase 2 — shared localization interface

**Outcome:** Runtime code has one small, testable way to retrieve translated strings.

### Tasks

- [x] Add a source helper (for example, `extension/src/utils/i18n.js`) around `chrome.i18n.getMessage`.
- [x] Define behavior for missing keys: surface a development warning and return an identifiable fallback, rather than silently rendering a blank string. Production messaging must not expose diagnostic copy to users.
- [x] Define an API for substitutions and document that messages passed to `innerHTML` require an explicit safety review; prefer `textContent`.
- [x] Provide a small DOM binding helper only if it reduces repeated page-local code (for `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`, and `data-i18n-title`).
- [x] Add `chrome.i18n.getMessage` behavior to `test/helpers/chrome-mock.js`, including configurable messages and a predictable missing-key path.
- [x] Add focused unit tests for message lookup, substitutions, and missing keys.

### Acceptance criteria

- Every runtime surface can retrieve a localized message without directly duplicating fallback logic.
- Unit tests can configure a locale catalog without requiring a browser.
- No translated value is inserted as HTML by default.

### Validation

- [x] Run the test suite.
- [x] Exercise a known message and a deliberately missing message in a development build.

## Phase 3 — extension-page chrome

**Outcome:** Static extension pages and the popup localize their own UI chrome.

### Tasks

- [x] Localize static popup text in `extension/popup.html` and dynamic popup text in its JavaScript.
- [x] Localize document titles, labels, button text, placeholders, `aria-*` labels, and tooltips in:
  - `extension/pages/settings.html`
  - `extension/pages/docs.html`
  - `extension/pages/guide.html`
  - `extension/pages/newtab.html`
- [x] Initialize page localization before the visible UI is shown where feasible, avoiding an English-to-localized-text flash.
- [x] Audit settings and docs page modules for strings generated after initial HTML localization.
- [x] Keep keyboard key glyphs and shortcut notation stable unless a locale-specific rendering decision is intentionally approved.

### Acceptance criteria

- Popup, Settings, Guide, Docs, and New Tab display translated static chrome in a non-English browser profile.
- Assistive labels and document titles are translated along with visible text.
- No raw `__MSG_*__` tokens appear in HTML.

### Validation

- [x] Test every extension page in English and one temporary test locale.
- [x] Keyboard-navigate the popup and settings page to spot-check accessible names.
- [x] Verify title and placeholder localization.

## Phase 4 — runtime UI and built-in catalogs

**Outcome:** Content-script overlays, service-worker menus, and configuration-defined built-in product copy localize consistently.

### Tasks

- [x] Replace hardcoded context-menu strings in `extension/background.js` with runtime messages, including menu groups and empty states.
- [x] Localize popup hub-card definitions and dynamically generated overlay/popover controls.
- [x] Audit `extension/src/ui/`, `extension/src/modules/`, and `extension/early-inject.js` for visible strings, placeholders, titles, accessibility labels, status/error text, and notifications. Remaining product copy is concentrated in the keyboard layout editor, function/macro catalogs, launcher catalog copy, and overlay-manager debug HUD.
- [x] Convert built-in layout family labels and descriptions in `extension/src/config/keyboard-layouts.js` to message keys resolved at the presentation boundary.
- [x] Convert built-in function/macro labels, descriptions, parameter labels, option labels, and catalog category labels in `extension/src/config/function-library.js` and `extension/src/config/macro-keys.js`.
- [x] Audit remaining built-in catalog sources, including search-engine labels and seeded launcher metadata. Translate only KeyPilot-owned display copy; preserve public product names and user-editable defaults where translation would alter saved data semantics.
- [x] Ensure context menus refresh when their localized labels are first registered; changing Chrome's UI language itself can require browser restart/reload.

### Acceptance criteria

- Context menus, keyboard reference, configuration editors, onboarding, overlays, and popovers have no product-owned English literals in the supported-surface inventory.
- Existing stored layout/action IDs and user-generated labels continue to work without data conversion.
- Catalog consumers display localized text while retaining canonical identifiers.

### Validation

- [x] Add unit tests for representative catalog-to-display resolution.
- [x] Exercise each overlay/mode and inspect menus in English plus one translated locale.
- [x] Search source for remaining user-visible literals; triage each as intended user/page data, non-visible text, or an extraction task.

Catalog-to-display coverage: `test/catalog-display-i18n.test.js` plus the Function/Macro, launcher, layout-family, overlay, and context-menu i18n tests.

Remaining-literal triage:

| Bucket | Examples | Action |
|---|---|---|
| Intended public product names | `search-engines.js` labels (Brave, Google); launcher site titles (Instagram, Gmail) | Keep. Do not translate public names. |
| User / page data | Custom layout labels from `listLayoutPickerGroups`; user Launch Deck titles; page-derived titles/URLs | Keep as stored or page data. |
| Keyboard glyphs / shortcut notation | Hub `hint` values (`K`, `Alt+H`); `kbd` glyphs; `Tab`/`Caps`/`Shift` keycap text | Keep unless a locale-specific rendering decision is approved. |
| Non-visible / debug | `overlay-manager.js` debug HUD and console (`KeyPilot Debug Panel`, clickable-reason strings); gated by debug flags | Leave unless the HUD ships to users. |
| Fallback English in early-inject | `fallbackText` on keyboard keycaps (`Click Element`, `KB Reference`) | Used when action metadata is missing; extract with action-catalog localization. |
| Extraction remaining | Keyboard Layout Editor (`keyboard-layout-config-panel.js`, `key-action-settings.js`, `keybindings-ui.js`); `KEYBINDING_ACTION_DEFS` labels/descriptions; `BUILTIN_KEYBOARD_LAYOUT_META` handedness labels; stock macro labels; inspector instruction templates (`Press {key} again to delete`); overlay ESC/`F clicks` labels; `highlight-manager.js` finish-selection banner; `ONBOARDING_DEFAULT_TITLE` / `ONBOARDING_REOPEN_TIP` constants (runtime already prefers `getMessage`) | Follow-up extraction. Not Phase 4 catalog work. |

## Phase 5 — localized documentation and image assets

**Outcome:** In-product help can select translated documentation without treating Markdown as a UI-string catalog.

### Tasks

- [x] Define the docs locale layout, for example `extension/userdocs/en/index.json` and `extension/userdocs/en/*.md`, with parallel locale folders.
- [x] Update the docs loader to resolve the browser UI language, then its base language, then English.
- [x] Move or generate the current English docs into the defined English location as one forward-only change.
- [x] Localize `userdocs/en/index.json` navigation labels together with the matching Markdown topics.
- [x] Establish a screenshot policy: use shared images when language-neutral; create locale-specific assets where embedded UI text must match the translation.
- [x] Document translation-source and review workflow for Markdown, links, frontmatter/index metadata, and image assets.
- [x] Retain the existing loading boundary: `pages/docs-bundled.js` remains dynamically imported only when Docs opens, and documentation files remain outside `content-bundled.js`.
- [x] Measure Docs-open time, transferred/loaded bytes, and rendered-document count with English and Spanish catalogs before changing the current full-text search approach.
- [x] Keep the current eager per-topic fetch/render behavior if measurements remain acceptable for the shipped topic count.
- [x] If measurements identify a Docs-open performance problem, implement a per-locale generated search index containing titles and normalized searchable text; initially fetch and render only the selected article, then cache rendered articles for that Docs session. Not implemented: first-open catalog load was 94 ms (budget ~500 ms) and article switches were ~2 ms, so the eager loader is retained. Revisit this item if the catalog exceeds the budget recorded below.

Docs-open measurement (2026-09-16, Chrome `en-US`, unpacked `extension/`):

| | English `userdocs/en` | Spanish stand-in `userdocs/es` (same-size copy of English; no translated tree yet) |
|---|---|---|
| Index + Markdown on disk | 51,999 bytes (25 `.md` + `index.json`) | 51,999 bytes |
| Files fetched by the eager loader | 23 topics (2 Macro Builder topics omitted in this build) + index; `en-US/index.json` 404 then `en/index.json` | 25 files in a direct catalog fetch (unfiltered clone) |
| Catalog fetch + Markdown render to first article | 94 ms (`kp-docs-catalog` measure) | 21 ms refetch of the same 25 files / 46,735 chars (no markdown-it pass; fetch-bound) |
| Subsequent article selection | 1.9 ms (`Getting started`, pre-rendered HTML swap) | n/a (in-memory `selectDoc`, locale-independent) |
| Docs page bundle | `pages/docs-bundled.js` 355.8 KiB on disk (locale-independent) | same |

Agreed budget: keep eager full-text search while the shipped topic count stays in this range (tens of articles, tens of KB of Markdown). Revisit a generated search index if catalog fetch+render exceeds about 500 ms or Markdown grows by an order of magnitude. Spanish translation (Phase 6) should be re-timed when `userdocs/es` is real copy, not this stand-in.

### Acceptance criteria

- A supported docs locale loads its own index and topic Markdown.
- A missing topic or locale falls back to English predictably.
- Docs navigation labels and the selected content use the same locale.
- Normal KeyPilot page startup does not load the Docs bundle, Markdown renderer, docs index, or topic Markdown.
- The selected docs-loading strategy preserves full-text search without an unacceptable first-open delay.

### Validation

- [x] Test exact-locale, base-language, and English fallback paths.
- [x] Check internal topic links and deep links in every supported docs locale.
- [x] Review localized screenshots at their rendered scale.
- [x] Confirm the content-script build does not import `pages/docs-bundled.js` or Markdown topic content.

Phase 5 validation notes (2026-09-16):

- Fallback: `getDocsLocaleCandidates` tries UI language, hyphen/underscore variant, base language, then `en`. Live Chrome `en-US` requested `userdocs/en-US/index.json` (404), `userdocs/en_US/index.json` (404), then `userdocs/en/index.json` (200). Unit tests cover exact regional hit, base-language hit, and English fallback (`test/docs-locale.test.js`).
- Links: the only shipped docs locale is `en`. Every `kp://docs/…` and `kp://settings/…` href in that tree parses and matches a topic or Settings panel id. Standalone `docs.html#layout-config` opened Keyboard Layout Editor; in-article `kp://docs/layout-config` from Settings did the same.
- Screenshots: no locale-specific `userdocs/<locale>/images/` folders. English Markdown references shared `images/*.png`. CSS uses `max-width: 100%; height: auto` (article ~760px, image slot ~758px). The PNG files themselves are not in the tree yet (`userdocs/images/` is `.gitkeep` only); locale-specific captures still follow the README policy when Spanish ships.
- Content script: `content-bundled.js` does not contain `docsThemeStorageInstalled`, markdown-it, `userdocs/en/`, or topic prose. It only holds the lazy URL string `pages/docs-bundled.js`.
- [x] Profile the first Docs open and a subsequent article selection in English and Spanish; record whether the eager loader remains within the agreed performance budget.

## Phase 6 — localized onboarding architecture

**Outcome:** The onboarding walkthrough selects localized content without translating its stable progress, action, or automation identifiers.

### Tasks

- [x] Move the English walkthrough model from `extension/pages/onboarding.xml` to `extension/onboarding/en.xml`. Add future locale models as `extension/onboarding/<locale>.xml`; do not retain a flat-file compatibility path.
- [x] Keep slide IDs, task IDs, `<when>` action/target/mode/change values, and overlay action IDs locale-neutral and identical across models. Localize only slide titles, body text, task labels, and overlay text attributes.
- [x] Add a shared locale-candidate helper that returns browser UI language, locale spelling variant where applicable, base language, then `en`. Use the same candidate ordering for Docs and onboarding.
- [x] Update `OnboardingManager._loadModel()` to fetch the first available `onboarding/<locale>.xml`; on an unavailable locale or failed fetch, continue through base language and English.
- [x] Change the early-inject onboarding model stamp to source only `onboarding/en.xml`, keeping it as a no-flash initial model. Once the content script loads a supported locale model, replace the in-memory model and re-render the active slide before user interaction.
- [x] Keep early-inject self-contained: it may use the stamped English model and Chrome UI language only. Do not embed every locale's walkthrough content into the eager script or put long-form walkthrough copy in `messages.json`.
- [x] Update the manifest web-accessible-resource declarations and package validation for `onboarding/<locale>.xml`.
- [x] Add model integrity tests: English XML parses; IDs are unique; every task has a stable `when` definition; future locale fixtures preserve the English ID/action structure.
- [x] Add locale-resolution tests for exact-locale, base-language, and English fallback, including the early-model-to-localized-model handoff.
- [x] Document the onboarding translation workflow and review requirements alongside `extension/onboarding/en.xml`.

### Acceptance criteria

- Onboarding renders the browser locale's model when it exists, otherwise its base language, otherwise English.
- Localizing the walkthrough never changes persisted onboarding progress or action matching.
- First paint remains functional with the stamped English model, and a supported localized model replaces it without exposing stale completion state.
- The eager content path does not embed non-English onboarding copy or Markdown-like long-form content.

### Validation

- [x] Test parser and model-structure parity against an `es` fixture.
- [ ] Smoke test onboarding in English and a supported translated locale, including progress restoration, overlay choices, completion, close/reopen, and extension OFF/ON transitions.
- [x] Verify missing exact and base locale files load English cleanly.
- [x] Inspect `early-inject.js` and `content-bundled.js` to confirm only the English early model is stamped.
- [x] Build Chrome, Firefox, and Opera packages and confirm localized onboarding XML files are present.

## Phase 7 — localized store-listing screenshots

Reference: https://developer.chrome.com/docs/webstore/cws-dashboard-listing

**Outcome:** Reproducible, locale-specific store screenshots combine real localized KeyPilot captures with SVG annotation templates, while retaining Chrome's required manual dashboard upload workflow.

### Initial Chrome screenshot brief

Use actual localized KeyPilot UI captures. SVG templates add only the localized
headline and two or three short callouts; do not recreate the extension UI in
SVG or place localized annotations over a capture from another locale.

1. **Key-click browsing** — first screenshot, shown when the listing opens.
   Capture a normal web page with a focused-element outline, Keyboard Reference,
   and Control Strip. Headline: “Browse the web with key-clicks.” Callouts:
   “Steer the cursor with the mouse”; “Hover over a link and press `F` to click.”
2. **Navigate and act from one keyboard map** — capture Keyboard Reference with
   a selected action/popover and the page result visible behind it. Headline:
   “Keep common actions under your fingertips.” Callouts: “Click links”;
   “Navigate tabs and history”; “Search, copy, and inspect.”
3. **Customize KeyPilot for your workflow** — capture Keyboard Layout Editor or
   Function Library with a representative custom layout/action configuration.
   Headline: “Build a keyboard layout that fits your workflow.” Callouts:
   “Choose a layout”; “Assign functions”; “Create macros.”

Keep all annotation wording concise enough for translation and for Chrome's
reduced listing scale. Do not annotate every key or use unsupported performance,
ranking, or endorsement claims.

### Chrome Web Store scope

- Localized asset type: up to five screenshots per locale, each `1280×800` (preferred) or `640×400`, square-cornered and full-bleed.
- Global-only asset types: small promo tile (`440×280`) and marquee promo tile (`1400×560`). Do not generate localized variants because Chrome does not accept them.
- Dashboard behavior: upload the extension first, select each available `_locales/<locale>` catalog in the Store Listing language selector, then manually upload that locale's generated screenshots. Localized screenshots take precedence over global screenshots; locales with none use the global screenshots.

### Tasks

- [x] Define the `online-stores/` source layout: deterministic locale-specific GUI captures, SVG annotation templates, locale copy data, generated PNG output, and a manifest of Chrome screenshot slots. Keep generated bitmaps out of the source-template directory. See `online-stores/README.md` and `online-stores/chrome/slots.json`.
- [x] Define fixed browser viewport, extension state, fixture page, and capture selectors for each Chrome screenshot slot. Capture the real KeyPilot UI in the target locale; do not use an English GUI capture beneath translated annotations.
- [x] Create SVG annotation templates for the selected Chrome listing slots. Each template embeds the matching real GUI capture, is exactly `1280×800`, and substitutes only product-owned headline, caption, and callout copy. Preserve product names, shortcut glyphs, and canonical UI state.
- [x] Define a global English small promo SVG (`440×280`) and marquee SVG (`1400×560`) separately from localized screenshot templates. Render one global bitmap for each; never emit per-locale variants for them.
- [x] Add an automated pipeline that discovers shipped extension locale catalogs, captures each defined UI state in that locale, resolves locale-specific annotation copy, composites captures into SVG templates, and emits deterministic PNGs under `online-stores/generated/chrome/<locale>/`.
- [x] Make English the initial generated locale. When a locale is shipped, require complete store-copy data before its localized screenshots are generated; do not generate marked test-locale (`en_GB`) assets.
- [x] Validate every generated Chrome screenshot's dimensions, file type, full-bleed canvas, slot count, capture locale, and annotation locale. Fail when an SVG placeholder is unresolved, a locale lacks required copy, the capture locale does not match its annotation locale, or text exceeds its defined safe region.
- [x] Document the manual Chrome Developer Dashboard procedure: choose the matching locale, upload only its screenshot PNGs under **Localized screenshots**, and retain global promo tiles separately.
- [x] Add a release checklist that records the generated asset revision, dashboard locale, uploaded screenshot filenames, and reviewer for each shipped locale.

### Acceptance criteria

- Each shipped locale has reproducible `1280×800` Chrome screenshot PNGs generated from real UI captures composited into SVG templates.
- Every localized screenshot shows the same locale in both its captured KeyPilot UI and its SVG annotations.
- English global promo tiles exist once at the required Chrome dimensions and contain no locale-specific variants.
- No store screenshot template, generated asset, or upload instructions imply that Chrome automatically reads assets from the extension package.
- A release manager can follow the documented per-locale dashboard upload process without editing image files by hand.

### Validation

- [x] Run the generator for English and verify every output dimension and filename against the Chrome slot manifest.
- [x] Confirm the generator excludes test-only locales and fails for an incomplete shipped locale.
- [ ] Visually review generated images at full size and Chrome's reduced listing scale.
- [ ] Perform one manual Chrome Dashboard localized-screenshot upload and record the selected locale and uploaded files.

Phase 7 notes (2026-09-16): generator coverage is in `test/store-screenshots.test.js` (English output size/filenames, `en_GB` exclusion, incomplete shipped locale). Live English GUI captures and dashboard upload remain manual.

## Phase 8 — Spanish translation, RTL readiness, and release QA

Reference: https://developer.chrome.com/docs/extensions/reference/api/i18n

**Outcome:** Spanish (`es`) and `es_419` are the first releasable non-English locales and the localization process is repeatable.

### Tasks

- [ ] Create `_locales/es/messages.json` by copying the complete English catalog, then translate and review terminology, placeholders, length, and accelerator/shortcut wording. Do not leave `[ES]` or other test markers in the shipped Spanish catalog; if a marked catalog is needed to prove locale switching, keep it under `test/fixtures/locales/`.
- [x] Use generic Spanish `es` and also `es_419` for the initial release.
- [ ] Translate the Phase 3–7 surfaces committed for Spanish, including the Spanish docs tree, onboarding model, and localized store screenshots.
- [x] Add CI or a release check that compares non-English catalog keys to the English source catalog and reports missing/extra keys. (`npm run check:locales`, included in `npm test`)
- [ ] Test locale fallback (`es_MX` or another regional Spanish locale → `es` → `en`) in a separate Chrome profile or with Chrome's language launch configuration.
- [ ] If shipping an RTL locale, set directionality from Chrome's bidi locale messages, audit logical CSS properties, icon direction, focus order, and overlay placement.
- [ ] Verify Chrome Web Store metadata for every released locale.

Draft note (2026-09-17): `extension/_locales/es/messages.json` and `es_419/messages.json`, plus `extension/userdocs/es/`, contain machine-generated Spanish drafts. `extension/onboarding/es.xml` is now shipped and Spanish store-copy data is present for both locales. A bilingual review of terminology, shortcut wording, UI length, and documentation links remains required before release; locale-specific GUI captures and generated screenshots must be made from a Spanish Chrome profile.

### Acceptance criteria

- Spanish has no unintended blank messages, untranslated product-owned UI, malformed substitutions, or broken documentation paths.
- English remains complete and is the fallback for every missing translation.
- Store metadata resolves correctly for supported listing locales.

### Validation

- [ ] Run automated catalog completeness checks and all unit tests.
- [ ] Complete a manual smoke test in English and Spanish for popup, Settings, common navigation actions, overlays, context menus, onboarding, and Docs.
- [ ] Build each store package and inspect its locale files and manifest.
- [ ] Record translation reviewer, browser version, tested UI locale, and outstanding untranslated content in the release record.

## Future locale readiness — CJK

**Outcome:** Japanese, Korean, Simplified Chinese, and Traditional Chinese can be added without regressions in text entry, typography, documentation, or deep links.

### Completed prerequisite

- [x] Make Docs heading anchors Unicode-safe in `extension/pages/docs.js`, so CJK headings retain IDs and can be linked with in-article fragments.

### Tasks

- [ ] Treat Japanese (`ja`), Korean (`ko`), Simplified Chinese (`zh_CN`), and Traditional Chinese (`zh_TW`) as separate translations and release decisions.
- [ ] Add locale-specific, system-font-first UI stacks for CJK. Do not bundle complete CJK web-font families; their size would be paid by every installation.
- [ ] Set the locale/language attribute on standalone extension-page roots and equivalent shadow-root hosts so locale-specific typography rules can apply.
- [ ] Test font fallback and metrics in popup, Settings, Docs, context menus, overlays, keyboard reference, onboarding, and titlebars.
- [ ] Add IME-composition protection to all KeyPilot shortcut handlers: ignore events while `event.isComposing` is true and handle the browser's composition lifecycle/legacy IME event behavior where necessary.
- [ ] Test typing with Japanese, Korean, and Chinese IMEs in ordinary text fields and KeyPilot text-entry modes; candidate selection and composition must never invoke KeyPilot actions.
- [ ] Preserve canonical shortcut keys/key codes. Translate their explanatory labels, but document any locale-specific direct-input requirement for invoking a shortcut.
- [ ] Extend omnibox host detection to recognize Unicode internationalized domain names (IDNs), so a hostname such as `例子.中国` navigates rather than becoming a search query.
- [ ] Make word-level under-cursor acquisition span adjacent DOM text nodes and construct the corresponding range, so split CJK text in rich editors is captured as one segmented unit.
- [ ] Pass the page language (`document.documentElement.lang`) to `Intl.Segmenter` for under-cursor word and sentence acquisition instead of relying solely on the browser/system locale.
- [ ] Keep basic Docs search as Unicode-safe substring matching; when a generated per-locale search index is introduced, use `Intl.Segmenter` for CJK tokenization and ranking.
- [ ] Decide whether Lookup Word needs a CJK-capable provider or an AI-backed path. The current dictionary endpoint is English-only and must not present a failed lookup as CJK support.

### Acceptance criteria

- CJK glyphs render legibly without increasing the eager runtime bundle with large font assets.
- IME composition never triggers a KeyPilot shortcut or loses typed/candidate text.
- CJK Docs headings retain navigable in-article fragments.
- Unicode IDNs entered in the omnibox navigate directly.
- Under-cursor word, translation, and lookup actions operate across text-node boundaries using page-language-aware segmentation.
- Each CJK locale can be added as an independent catalog and documentation release.

### Validation

- [ ] Exercise all CJK locale UI surfaces on macOS and Windows with their respective system fonts.
- [ ] Run manual IME composition scenarios for Japanese, Korean, Simplified Chinese, and Traditional Chinese.
- [ ] Test CJK Markdown headings and `kp://docs/<topic>#<heading>` deep links.
- [ ] Navigate to Unicode IDNs from the omnibox and confirm CJK search text remains a search query.
- [ ] Test under-cursor word, translation, and lookup behavior on CJK text split across inline DOM nodes and in rich editors.
- [ ] Verify no CJK font files are imported into `content-bundled.js`.

## Ongoing maintenance

- [ ] Require each new user-visible KeyPilot-owned string to add an English message and translator description in the same change.
- [ ] Include a literal-string audit in pre-release review for popup, page HTML, UI modules, background context menus, and config catalogs.
- [ ] Keep stable message keys when English wording changes; rename only when meaning changes.
- [ ] Treat a new locale as a release deliverable: catalog completeness, UI length review, documentation coverage, screenshots, and store listing validation.

## References

- [Chrome: Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) — language dropdown, localized description/screenshots/promo video, global promo tiles, asset display order
- [Chrome: Supplying images](https://developer.chrome.com/docs/webstore/images)
- [Chrome: Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing)
- [Chrome: Internationalize the interface](https://developer.chrome.com/docs/extensions/develop/ui/i18n)
- [Chrome: `chrome.i18n` API and message fallback](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- `refs/MAC_OPT_ALT_LABELS.md` — Mac Opt vs PC Alt in UI labels (host OS, not locale catalogs)
- `refs/EDGE_BUILD_DIRECTORY.md` — localized manifest metadata and Edge Partner Center discovery note
- `online-stores/README.md` — Chrome listing screenshot source layout, dashboard upload, and release checklist
- `scripts/store-screenshots/README.md` — capture playbook and generator
- `extension/manifest.json` — current manifest metadata
- `scripts/package-channel.mjs` — staged manifest description replacement
