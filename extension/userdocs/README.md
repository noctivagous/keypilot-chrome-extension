# Localized documentation

`en/` is the canonical documentation source. Each future locale uses a
parallel directory:

```text
userdocs/
├── images/          # Shared, language-neutral screenshots
├── en/
│   ├── index.json
│   └── *.md
└── <locale>/
    ├── index.json
    └── *.md
```

Keep topic IDs, Markdown filenames, `kp://docs/<topic-id>` links, and heading
anchors stable across locales. Translate the navigation `title` values in the
locale's `index.json` together with the matching Markdown topic. Do not put
long-form documentation in `_locales/*/messages.json`.

Screenshots belong in shared `userdocs/images/` when they contain no
language-dependent UI. If an image includes translated UI text, place it in
the locale directory as `userdocs/<locale>/images/` and update that locale's
Markdown references accordingly.

Review every translated topic for internal topic links, heading fragments,
shortcut wording, image paths, and rendered layout at the target scale.
