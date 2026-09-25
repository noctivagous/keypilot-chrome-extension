# Localization guide

This is the operational guide for adding or changing localized KeyPilot
content. Use it for new user-visible product copy and for adding a locale.
[`refs/CHROME_I18N_TASK_ITEMS.md`](../refs/CHROME_I18N_TASK_ITEMS.md) records
the implementation plan and outstanding release work; it is not the day-to-day
workflow.

## Regenerate store assets

Two different texts appear on the listing. Chrome imports the one-line
summary from the uploaded package: `extension_description` in
`extension/_locales/<locale>/messages.json`, shown in the dashboard as
**Summary from package**. The description paragraphs are not in the package.
They live in `online-stores/chrome/listing/<locale>.txt` and are pasted by
hand into **Detailed description**.

Screenshots and the promo video are also dashboard uploads. Pick the path
that matches what changed. Commands that take `<locale>` also accept a
comma-separated list.

Edit the English source, then instruct the AI to translate that change into
the other shipped locale files. Leave keys, placeholders, and untranslated
names (`KeyPilot`, `Chrome Web Store`, the `F` key) as they are. Review the
translation before generating or pasting.

### Screenshots only

Run this when listing images changed and the promo video did not.

1. If a headline or callout changed, edit `online-stores/chrome/copy/en.json`,
   then have the AI translate that change into each
   `online-stores/chrome/copy/<locale>.json`. Every slot must stay filled.
2. If the product UI inside the picture changed, edit
   `extension/_locales/en/messages.json` first and have the AI translate
   those keys. Then rebuild and recapture. Skip this step when the existing
   captures are still the right UI and only the annotation text changed.

   ```bash
   npm run build
   npm run store:screenshots:auto -- --locales=<locale>
   ```

3. Composite the PNGs:

   ```bash
   npm run store:screenshots -- --locale=<locale>
   ```

   Use `--all` instead of `--locale` to regenerate every shipped locale that
   is not excluded. Overlay banners for `ja` / `zh_*` need CJK faces in the
   compositor (`scripts/store-screenshots/fonts/` or macOS Hiragino), not in
   the extension package. Global small and marquee tiles are English-only; regenerate
   them with `npm run store:screenshots -- --promo-only` only when that art
   changed.
4. If noctivagous.com should show the new images, copy them into the site:

   ```bash
   npm run web:locales
   npm run web:locales:check
   ```

5. Upload `online-stores/generated/chrome/<locale>/01-` through `05-` in the
   dashboard language selector. Record it in
   `online-stores/chrome/RELEASE-CHECKLIST.md`.

### Videos only

Run this when the intro reel changed and the listing screenshots did not.
Chrome accepts a YouTube URL, not the MP4.

1. Edit on-screen copy in
   `promo/intro-reel/locales/key-click-intro/en.json`, then have the AI
   translate that change into each `locales/key-click-intro/<locale>.json`.
   Keep the same keys as English. If the YouTube title or description
   changed, edit `promo/intro-reel/youtube-description-en.txt` (first line is
   the title) and have the AI translate the other
   `youtube-description-<locale>.txt` files.
2. From `promo/intro-reel/`, render one locale or the batch:

   ```bash
   npx hyperframes render \
     --composition key-click-intro.html \
     --variables-file locales/key-click-intro/<locale>.json \
     --output renders/key-click-intro-<locale>.mp4
   ```

   ```bash
   npx hyperframes render \
     --composition key-click-intro.html \
     --batch locales/key-click-intro/batch.json \
     --output "renders/key-click-intro-{locale}.mp4"
   ```

3. Upload `renders/key-click-intro-<locale>.mp4` to YouTube. Paste the
   description file. Record `youtube_url` and `youtube_id` in
   `promo/intro-reel/youtube.json`.
4. Paste that URL into **Localized promo video** for the same dashboard
   language.

### Descriptions only

Run this when the listing paragraphs changed and the screenshots and promo
video did not.

1. Edit `online-stores/chrome/listing/en.txt`, then have the AI translate
   that change into each `online-stores/chrome/listing/<locale>.txt`. Keep
   the same feature set. Leave the one-line summary in
   `extension_description`; do not paste that sentence into the detailed
   description.
2. If the summary line itself changed, edit `extension_description` in
   `extension/_locales/en/messages.json` and have the AI translate that key.
   Upload a package that contains the catalogs. The dashboard fills
   **Summary from package** from that upload. The language only appears in
   the listing selector after the package includes `_locales/<locale>`.
3. Open **Store listing**, choose the language, and paste the full `.txt`
   file into **Detailed description**. Record the paste in
   `online-stores/chrome/RELEASE-CHECKLIST.md`.

### Everything

Run this when the listing should be rebuilt from current product UI, copy,
and video. Do the steps in order.

1. Edit the English sources that changed:
   `extension/_locales/en/messages.json` (UI strings and
   `extension_description`), `online-stores/chrome/copy/en.json`,
   `online-stores/chrome/listing/en.txt`, and
   `promo/intro-reel/locales/key-click-intro/en.json` plus
   `youtube-description-en.txt` when the video changed. Have the AI translate
   each change into the matching locale files, then `npm run check:locales`.
   Upload a package before expecting **Summary from package** to change.
2. Recapture and composite screenshots (steps 2–3 under
   [Screenshots only](#screenshots-only)).
3. Render and publish the intro reel (the [videos](#videos-only) steps).
4. Regenerate the site so its screenshots match the new PNGs:

   ```bash
   npm run web:locales
   npm run web:locales:check
   ```

5. In the dashboard, for each locale: paste
   `online-stores/chrome/listing/<locale>.txt` into **Detailed description**,
   upload the five screenshots, and set the localized promo video URL.
   Confirm **Summary from package** shows `extension_description`. Upload the
   global promo tiles only when those files were regenerated.

## Quick workflow

1. Identify the content type in [Where content belongs](#where-content-belongs).
2. For product UI, add or update the English source entry in
   `extension/_locales/en/messages.json`. Keep its key stable when only its
   wording changes, and add a useful `description` for translators.
3. Instruct the AI to translate that English change into every catalog under
   `extension/_locales/`. Preserve all message keys and placeholder names.
4. Update the matching locale-specific docs, onboarding model, or store assets
   if the UI change affects them.
5. Run `npm run check:locales`, `npm test`, and `npm run build`. Reload the
   unpacked extension after a build, then test the affected UI in English and
   each changed locale.
6. Before release, complete the [release checklist](#release-checklist).

## Core rules

- Chrome chooses strings from `_locales/<locale>/messages.json`. The manifest
  declares `default_locale: "en"` and its localizable fields must remain
  `__MSG_<key>__` references.
- Use `getMessage()` from `extension/src/utils/i18n.js` for runtime UI strings;
  do not duplicate browser-locale fallback logic in callers. It supplies a
  development-only marker for missing keys.
- Use `localizeElements()` for static extension-page markup with
  `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label`, or
  `data-i18n-title`.
- Assign translated values with `textContent`, never `innerHTML`, unless a
  separate security review establishes that HTML is necessary and safe.
- Keep action IDs, function IDs, setting IDs, layout IDs, topic IDs, persisted
  values, URLs, product names, keyboard glyphs, and shortcut notation stable.
  Translate their displayed labels and descriptions only.
- Do not translate user-created names, custom launcher entries, page-derived
  titles, URLs, or other captured page data.
- Do not add migrations, read-time repair, or compatibility fallbacks when
  localizing stored data. This project uses the current forward-only model.

### Catalog conventions

The English catalog is the source of truth. Every message needs a translator
description. For messages with substitutions, retain the exact placeholder
names in every catalog, document their meaning with an example, and pass
substitutions to `getMessage()`. Chrome supports at most nine substitutions.

Use semantic, surface-prefixed keys: `extension_*`, `popup_*`, `settings_*`,
`context_menu_*`, `action_<id>_<field>`, `function_<id>_<field>`, or a
feature-specific prefix such as `omnibox_*`. Do not rename a key merely
because its English wording changes.

`npm run check:locales` checks non-English catalogs for extra keys, empty
messages, and placeholder-name mismatches. A regional catalog such as
`es_419` may omit keys that its shipped parent language catalog (`es`)
already defines. A language catalog (`es`, `de`, `zh_CN`) must still
contain every English key. The same parent fill is applied when the site
build copies keyboard strings out of `messages.json`. The check does not
assess translation quality or layout fit.

## Where content belongs

| Content | Location | Requirements |
| --- | --- | --- |
| Extension UI, manifest metadata, context menus, labels, tooltips, errors | `extension/_locales/<locale>/messages.json` | Use Chrome i18n and translator descriptions. |
| Long-form in-product help | `extension/userdocs/<locale>/` | Translate `index.json` navigation titles with the matching Markdown topic. |
| Walkthrough copy | `extension/onboarding/<locale>.xml` | Preserve all progress/action structure; translate copy only. |
| Store screenshot annotations | `online-stores/chrome/copy/<locale>.json` | Match the locale of the real UI capture. |
| Chrome listing detailed description | `online-stores/chrome/listing/<locale>.txt` | Paste in the dashboard; not shipped in the package. |
| Store GUI captures | `online-stores/chrome/captures/<locale>/` | Capture KeyPilot in that locale; never reuse a different locale's capture. |
| Language-neutral documentation screenshots | `extension/userdocs/images/` | Use a locale directory only when the image includes translated UI text. |
| Marketing site (noctivagous.com) | `promo/web/` | Tagged English HTML/SVGs plus `promo/web/locales/*.json`. Do not put this copy in `messages.json`. |

Do not put Markdown, onboarding copy, or marketing-site strings in `messages.json`.

## Add a locale

1. Confirm that the locale is intended to ship. Test-only marked catalogs
   belong in `test/fixtures/locales/`, never in `extension/_locales/`.
2. Copy the complete English catalog to
   `extension/_locales/<locale>/messages.json`, translate it, and run
   `npm run check:locales`. A regional catalog may instead contain only
   the messages that differ from its shipped parent language catalog,
   including `locale_tag`.
3. Add `extension/userdocs/<locale>/` only when that locale's documentation is
   ready. It must mirror English topic IDs and filenames.
4. Add `extension/onboarding/<locale>.xml` when localizing onboarding. It must
   retain English slide IDs, task IDs, `<when>` values, and overlay action
   attributes.
5. Add complete `online-stores/chrome/copy/<locale>.json`,
   `online-stores/chrome/listing/<locale>.txt`, localized captures, and
   generated screenshots before the Chrome listing is localized.
6. Test exact-locale, base-language, and English fallback behavior. Locale
   resolution tries the browser UI locale, its hyphen/underscore variant, its
   base language, then English.

For RTL languages, also set directionality from Chrome's bidi locale messages
and review logical CSS properties, icon direction, focus order, and overlay
placement. For CJK languages, follow the readiness work in
[`refs/CHROME_I18N_TASK_ITEMS.md`](../refs/CHROME_I18N_TASK_ITEMS.md#future-locale-readiness--cjk),
including IME composition and system-font testing.

## Docs and onboarding review

Documentation must preserve topic IDs, Markdown filenames,
`kp://docs/<topic-id>` links, and heading anchors. Check internal links,
fragments, shortcut wording, image paths, and rendered layout.

For onboarding, translate only slide titles, bodies, task labels, and overlay
text. The early script intentionally stamps English for first paint; the
content script then loads the best available localized XML model. Review
translated models for structural parity, key glyphs, overlay attributes, and
completion-slide copy.

The detailed subsystem rules are in
[`extension/userdocs/README.md`](../extension/userdocs/README.md) and
[`extension/onboarding/README.md`](../extension/onboarding/README.md).

## Store screenshots

The regenerate order is [Regenerate store assets](#regenerate-store-assets).
Store dashboards do not read assets from an extension package. Capture real
localized UI at the required viewport, then generate PNGs:

```bash
npm run store:screenshots:serve
npm run store:screenshots -- --locale=<locale>
```

The generator rejects incomplete store copy and mismatched capture/annotation
locales. Chrome's global small and marquee promo tiles are English-only; do
not create locale-specific variants. Upload generated localized screenshots
manually in the matching Chrome Developer Dashboard language selection and
record the upload in `online-stores/chrome/RELEASE-CHECKLIST.md`.

Read [`online-stores/README.md`](../online-stores/README.md) and
[`scripts/store-screenshots/README.md`](../scripts/store-screenshots/README.md)
before capturing or uploading assets.

## Release checklist

- [ ] `npm run check:locales`, `npm test`, and `npm run build` pass.
- [ ] Each changed language catalog has the English key set. A regional
      catalog may omit keys its parent language catalog defines. Messages
      are non-empty, placeholders match, and terminology is reviewed.
- [ ] English and each changed locale are smoke-tested across the affected
      popup, extension pages, overlays, context menus, Docs, and onboarding.
- [ ] UI fit, accessible names, document titles, placeholders, and tooltips
      are checked at normal display scale.
- [ ] Documentation links, anchors, images, and deep links work in each
      changed docs locale.
- [ ] Locale-specific store captures, annotations, and generated screenshots
      match; Chrome uploads are recorded where applicable.
- [ ] Store packages include `_locales/` and preserve manifest `__MSG_*__`
      references: run the required `npm run package:<target>` commands and
      inspect the staged artifacts.

## Related references

- [`extension/README.md`](../extension/README.md) — build and extension
  structure
- [`refs/CHROME_I18N_TASK_ITEMS.md`](../refs/CHROME_I18N_TASK_ITEMS.md) —
  architecture decisions, implementation status, and future work
- [`refs/MAC_OPT_ALT_LABELS.md`](../refs/MAC_OPT_ALT_LABELS.md) — Mac Opt vs
  PC Alt shortcut labels (host OS, not locale)
- [`refs/EDGE_BUILD_DIRECTORY.md`](../refs/EDGE_BUILD_DIRECTORY.md) — Edge
  localized-manifest notes
- [Chrome i18n API](https://developer.chrome.com/docs/extensions/reference/api/i18n)
