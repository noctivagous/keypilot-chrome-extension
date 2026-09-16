# Chrome i18n phased task items

Implementation checklist for localizing KeyPilot's Chrome-extension surfaces.

## Scope and design constraints

- Use Chrome's built-in [`chrome.i18n`](https://developer.chrome.com/docs/extensions/reference/api/i18n) message catalog mechanism. It selects strings from `_locales/<locale>/messages.json` according to the browser UI locale.
- The first implementation must have a complete English (`en`) catalog and set `"default_locale": "en"` in `extension/manifest.json`. Chrome falls back from a region locale (for example, `en_GB`) to its base language and then to `default_locale`.
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

- [ ] Add a source helper (for example, `extension/src/utils/i18n.js`) around `chrome.i18n.getMessage`.
- [ ] Define behavior for missing keys: surface a development warning and return an identifiable fallback, rather than silently rendering a blank string. Production messaging must not expose diagnostic copy to users.
- [ ] Define an API for substitutions and document that messages passed to `innerHTML` require an explicit safety review; prefer `textContent`.
- [ ] Provide a small DOM binding helper only if it reduces repeated page-local code (for `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`, and `data-i18n-title`).
- [ ] Add `chrome.i18n.getMessage` behavior to `test/helpers/chrome-mock.js`, including configurable messages and a predictable missing-key path.
- [ ] Add focused unit tests for message lookup, substitutions, and missing keys.

### Acceptance criteria

- Every runtime surface can retrieve a localized message without directly duplicating fallback logic.
- Unit tests can configure a locale catalog without requiring a browser.
- No translated value is inserted as HTML by default.

### Validation

- [ ] Run the test suite.
- [ ] Exercise a known message and a deliberately missing message in a development build.

## Phase 3 — extension-page chrome

**Outcome:** Static extension pages and the popup localize their own UI chrome.

### Tasks

- [ ] Localize static popup text in `extension/popup.html` and dynamic popup text in its JavaScript.
- [ ] Localize document titles, labels, button text, placeholders, `aria-*` labels, and tooltips in:
  - `extension/pages/settings.html`
  - `extension/pages/docs.html`
  - `extension/pages/guide.html`
  - `extension/pages/newtab.html`
- [ ] Initialize page localization before the visible UI is shown where feasible, avoiding an English-to-localized-text flash.
- [ ] Audit settings and docs page modules for strings generated after initial HTML localization.
- [ ] Keep keyboard key glyphs and shortcut notation stable unless a locale-specific rendering decision is intentionally approved.

### Acceptance criteria

- Popup, Settings, Guide, Docs, and New Tab display translated static chrome in a non-English browser profile.
- Assistive labels and document titles are translated along with visible text.
- No raw `__MSG_*__` tokens appear in HTML.

### Validation

- [ ] Test every extension page in English and one temporary test locale.
- [ ] Keyboard-navigate the popup and settings page to spot-check accessible names.
- [ ] Verify title and placeholder localization.

## Phase 4 — runtime UI and built-in catalogs

**Outcome:** Content-script overlays, service-worker menus, and configuration-defined built-in product copy localize consistently.

### Tasks

- [ ] Replace hardcoded context-menu strings in `extension/background.js` with runtime messages, including menu groups and empty states.
- [ ] Localize popup hub-card definitions and dynamically generated overlay/popover controls.
- [ ] Audit `extension/src/ui/`, `extension/src/modules/`, and `extension/early-inject.js` for visible strings, placeholders, titles, accessibility labels, status/error text, and notifications.
- [ ] Convert built-in layout family labels and descriptions in `extension/src/config/keyboard-layouts.js` to message keys resolved at the presentation boundary.
- [ ] Convert built-in function/macro labels, descriptions, parameter labels, option labels, and catalog category labels in `extension/src/config/function-library.js` and `extension/src/config/macro-keys.js`.
- [ ] Audit remaining built-in catalog sources, including search-engine labels and seeded launcher metadata. Translate only KeyPilot-owned display copy; preserve public product names and user-editable defaults where translation would alter saved data semantics.
- [ ] Ensure context menus refresh when their localized labels are first registered; changing Chrome's UI language itself can require browser restart/reload.

### Acceptance criteria

- Context menus, keyboard reference, configuration editors, onboarding, overlays, and popovers have no product-owned English literals in the supported-surface inventory.
- Existing stored layout/action IDs and user-generated labels continue to work without data conversion.
- Catalog consumers display localized text while retaining canonical identifiers.

### Validation

- [ ] Add unit tests for representative catalog-to-display resolution.
- [ ] Exercise each overlay/mode and inspect menus in English plus one translated locale.
- [ ] Search source for remaining user-visible literals; triage each as intended user/page data, non-visible text, or an extraction task.

## Phase 5 — localized documentation and image assets

**Outcome:** In-product help can select translated documentation without treating Markdown as a UI-string catalog.

### Tasks

- [ ] Define the docs locale layout, for example `extension/userdocs/en/index.json` and `extension/userdocs/en/*.md`, with parallel locale folders.
- [ ] Update the docs loader to resolve the browser UI language, then its base language, then English.
- [ ] Move or generate the current English docs into the defined English location as one forward-only change.
- [ ] Localize `userdocs/index.json` navigation labels together with the matching Markdown topics.
- [ ] Establish a screenshot policy: use shared images when language-neutral; create locale-specific assets where embedded UI text must match the translation.
- [ ] Document translation-source and review workflow for Markdown, links, frontmatter/index metadata, and image assets.
- [ ] Retain the existing loading boundary: `pages/docs-bundled.js` remains dynamically imported only when Docs opens, and documentation files remain outside `content-bundled.js`.
- [ ] Measure Docs-open time, transferred/loaded bytes, and rendered-document count with English and Spanish catalogs before changing the current full-text search approach.
- [ ] Keep the current eager per-topic fetch/render behavior if measurements remain acceptable for the shipped topic count.
- [ ] If measurements identify a Docs-open performance problem, implement a per-locale generated search index containing titles and normalized searchable text; initially fetch and render only the selected article, then cache rendered articles for that Docs session.

### Acceptance criteria

- A supported docs locale loads its own index and topic Markdown.
- A missing topic or locale falls back to English predictably.
- Docs navigation labels and the selected content use the same locale.
- Normal KeyPilot page startup does not load the Docs bundle, Markdown renderer, docs index, or topic Markdown.
- The selected docs-loading strategy preserves full-text search without an unacceptable first-open delay.

### Validation

- [ ] Test exact-locale, base-language, and English fallback paths.
- [ ] Check internal topic links and deep links in every supported docs locale.
- [ ] Review localized screenshots at their rendered scale.
- [ ] Confirm the content-script build does not import `pages/docs-bundled.js` or Markdown topic content.
- [ ] Profile the first Docs open and a subsequent article selection in English and Spanish; record whether the eager loader remains within the agreed performance budget.

## Phase 6 — Spanish translation, RTL readiness, and release QA

**Outcome:** Spanish (`es`) is the first releasable non-English locale and the localization process is repeatable.

### Tasks

- [ ] Create `_locales/es/messages.json` by copying the complete English catalog, then translate and review terminology, placeholders, length, and accelerator/shortcut wording.
- [ ] Use generic Spanish (`es`) for the initial release. Add regional catalogs such as `es_419`, `es_ES`, or `es_MX` only when their wording needs to differ.
- [ ] Translate the Phase 3–5 surfaces committed for Spanish, including the Spanish docs tree.
- [ ] Add CI or a release check that compares non-English catalog keys to the English source catalog and reports missing/extra keys.
- [ ] Test locale fallback (`es_MX` or another regional Spanish locale → `es` → `en`) in a separate Chrome profile or with Chrome's language launch configuration.
- [ ] If shipping an RTL locale, set directionality from Chrome's bidi locale messages, audit logical CSS properties, icon direction, focus order, and overlay placement.
- [ ] Verify Chrome Web Store, Edge Add-ons, and Opera listing metadata for every released locale.

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

- [Chrome: Internationalize the interface](https://developer.chrome.com/docs/extensions/develop/ui/i18n)
- [Chrome: `chrome.i18n` API and message fallback](https://developer.chrome.com/docs/extensions/reference/api/i18n)
- `refs/EDGE_BUILD_DIRECTORY.md` — localized manifest metadata and Edge Partner Center discovery note
- `extension/manifest.json` — current manifest metadata
- `scripts/package-channel.mjs` — staged manifest description replacement
