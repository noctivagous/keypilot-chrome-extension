# Localized onboarding models

`en.xml` is the canonical walkthrough. Each future locale is a sibling file:

```text
onboarding/
├── en.xml
└── <locale>.xml
```

Keep slide IDs, task IDs, `<when>` type/action/target/mode/change values, and overlay `secondaryAction` values identical across locales. Translate only:

- slide `title`
- overlay `title`, `message`, `primaryText`, `secondaryText`, `laterTitle`, `laterPrimaryText`
- task `label`
- slide `<body>` text

Do not put walkthrough copy in `_locales/*/messages.json`. Early-inject stamps English only so first paint cannot flash missing locale files. The content script then loads `onboarding/<ui-language>.xml`, the base language, or `en.xml`, and rebuilds the active slide using persisted slide/task IDs.

Review a translated model for matching ID/action structure, backtick key glyphs, overlay action attributes, and completion-slide body text.
