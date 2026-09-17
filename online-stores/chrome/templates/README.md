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

Each screenshot template will embed the matching locale capture from
`chrome/captures/<locale>/` and substitute only product-owned headline and
callout copy from `chrome/copy/<locale>.json`. Promo templates are
English-only and are not emitted per locale.
