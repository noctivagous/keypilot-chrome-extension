# Localization guide

This is the operational guide for adding or changing localized KeyPilot
content. Use it for new user-visible product copy and for adding a locale.
[`refs/CHROME_I18N_TASK_ITEMS.md`](../refs/CHROME_I18N_TASK_ITEMS.md) records
the implementation plan and outstanding release work; it is not the day-to-day
workflow.

## Quick workflow

1. Identify the content type in [Where content belongs](#where-content-belongs).
2. For product UI, add or update the English source entry in
   `extension/_locales/en/messages.json`. Keep its key stable when only its
   wording changes, and add a useful `description` for translators.
3. Apply the same semantic change to every translation catalog under
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

`npm run check:locales` checks all non-English catalogs for missing/extra
keys, empty messages, and placeholder-name mismatches. It does not assess
translation quality or layout fit.

## Where content belongs

| Content | Location | Requirements |
| --- | --- | --- |
| Extension UI, manifest metadata, context menus, labels, tooltips, errors | `extension/_locales/<locale>/messages.json` | Use Chrome i18n and translator descriptions. |
| Long-form in-product help | `extension/userdocs/<locale>/` | Translate `index.json` navigation titles with the matching Markdown topic. |
| Walkthrough copy | `extension/onboarding/<locale>.xml` | Preserve all progress/action structure; translate copy only. |
| Store screenshot annotations | `online-stores/chrome/copy/<locale>.json` | Match the locale of the real UI capture. |
| Store GUI captures | `online-stores/chrome/captures/<locale>/` | Capture KeyPilot in that locale; never reuse a different locale's capture. |
| Language-neutral documentation screenshots | `extension/userdocs/images/` | Use a locale directory only when the image includes translated UI text. |

Do not put Markdown or onboarding copy in `messages.json`.

## Add a locale

1. Confirm that the locale is intended to ship. Test-only marked catalogs
   belong in `test/fixtures/locales/`, never in `extension/_locales/`.
2. Copy the complete English catalog to
   `extension/_locales/<locale>/messages.json`, translate it, and run
   `npm run check:locales`.
3. Add `extension/userdocs/<locale>/` only when that locale's documentation is
   ready. It must mirror English topic IDs and filenames.
4. Add `extension/onboarding/<locale>.xml` when localizing onboarding. It must
   retain English slide IDs, task IDs, `<when>` values, and overlay action
   attributes.
5. Add complete `online-stores/chrome/copy/<locale>.json`, localized captures,
   and generated screenshots before the Chrome listing is localized.
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
- [ ] Each changed catalog has the English key set, non-empty messages, correct
      placeholders, and reviewed terminology.
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
