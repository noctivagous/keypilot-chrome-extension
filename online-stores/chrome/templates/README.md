# SVG templates

Vector sources for Chrome listing art. Keep generated bitmaps out of this
directory.

```text
templates/
├── screenshots/     # One 1280×800 SVG per chrome/slots.json screenshot slot
└── promo/           # Global English small (440×280) and marquee (1400×560)
```

Screenshot templates named in `slots.json`:

- `screenshots/key-click-browsing.svg`
- `screenshots/keyboard-map.svg`
- `screenshots/customize-workflow.svg`

Each screenshot template embeds `{{captureHref}}` (the matching locale
capture) and substitutes `{{headline}}` plus `{{callout.0}}`…
from `chrome/copy/<locale>.json`. Product names and shortcut glyphs in the
underlying capture stay as captured.

Promo templates are English-only, contain no `{{placeholders}}`, and are
not emitted per locale.
