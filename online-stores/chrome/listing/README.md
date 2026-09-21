# Chrome Web Store listing copy

Chrome pulls the **short summary** from the packaged extension: the
`description` field in `manifest.json`, resolved per language from
`extension/_locales/<locale>/messages.json` (`extension_description`).
That text appears in the dashboard as **Summary from package**. Do not
duplicate it here.

The **detailed description** (long description, up to 16,000 characters)
is **not** in the package. Paste it by hand in the Chrome Web Store
developer dashboard for each language.

| File | Dashboard language |
|---|---|
| `en.txt` | English |
| `de.txt` | German |
| `es.txt` | Spanish |
| `es_419.txt` | Spanish (Latin America) |

Procedure:

1. Upload a package that includes the matching `_locales/<locale>` catalog
   so the listing language selector includes that language.
2. Open **Store listing** and choose the language.
3. Copy the full contents of the matching `.txt` file into **Detailed
   description**.
4. Record the paste in `../RELEASE-CHECKLIST.md`.

Keep the same feature set in every locale. Product names (`KeyPilot`) and
the `F` key glyph stay untranslated.
