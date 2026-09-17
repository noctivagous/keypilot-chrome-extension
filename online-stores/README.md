# Online-store listing assets

Source layout for store-listing screenshots and promo tiles. Each store
gets a sibling directory under `online-stores/`. Chrome is defined first;
`firefox/` is reserved for a later AMO listing pipeline.

Stores do **not** read these files from the extension package. A release
manager generates PNGs here, then uploads them by hand in each store
dashboard after the matching `_locales/<locale>` catalog is available.

```text
online-stores/
├── README.md
├── chrome/
│   ├── slots.json              # Chrome screenshot slots and global promo sizes
│   ├── copy/<locale>.json      # Headline and callout copy per screenshot slot
│   ├── templates/              # SVG sources only (no generated bitmaps)
│   │   ├── screenshots/        # 1280×800 annotated screenshot templates
│   │   └── promo/              # Global English small + marquee tiles
│   └── captures/<locale>/      # Deterministic GUI captures of KeyPilot in that locale
├── firefox/                    # Reserved for AMO listing sources
└── generated/                  # Pipeline output only; do not treat as source
    └── chrome/
        ├── <locale>/           # Localized screenshot PNGs for dashboard upload
        └── promo/              # One global small PNG and one global marquee PNG
```

## What belongs where

| Path | Role |
|---|---|
| `chrome/slots.json` | Manifest of listing slots: order, size, capture file, SVG template, copy key, output filename. |
| `chrome/copy/<locale>.json` | Product-owned annotation strings for that locale. Required before generating that locale. |
| `chrome/templates/` | Editable SVG templates. Embed the matching locale capture; substitute only headline, caption, and callouts. |
| `chrome/captures/<locale>/` | Real KeyPilot UI captures for that locale. Never reuse an English capture under translated annotations. |
| `generated/` | Composited PNGs at store dimensions. Keep this tree out of `chrome/templates/`. |

Do not put generated PNGs, JPEG exports, or capture bitmaps inside
`chrome/templates/`. Templates stay vector/source; bitmaps live in `captures/`
(inputs) or `generated/` (outputs).

## Chrome screenshot slots

Preferred listing size is `1280×800`, square-cornered and full-bleed. Chrome
allows up to five screenshots per locale. The initial brief uses three slots
defined in `chrome/slots.json`:

1. `key-click-browsing` — first screenshot when the listing opens
2. `keyboard-map` — Keyboard Reference with a selected action
3. `customize-workflow` — Keyboard Layout Editor or Function Library

Global promo tiles (`440×280` small, `1400×560` marquee) are English-only.
Chrome does not accept localized promo variants; emit them once under
`generated/chrome/promo/`.

## Locales

Generate store screenshots only for shipped catalogs under
`extension/_locales/`. English (`en`) is the first locale. Skip marked
test catalogs such as `en_GB`. A shipped locale must have complete copy in
`chrome/copy/<locale>.json` before its screenshots are generated.

## Capture vs annotation locale

Each localized screenshot must show the same locale in the captured UI and
in the SVG annotations. The later capture and generator tasks fill viewport,
fixture, and selector details on each slot; this layout only names the
files and directories those tasks write into.
