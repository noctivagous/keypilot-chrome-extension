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
│   ├── listing/<locale>.txt    # Detailed description to paste in the dashboard
│   ├── copy/<locale>.json      # Headline and callout copy per screenshot slot
│   ├── templates/              # SVG sources only (no generated bitmaps)
│   │   ├── screenshots/        # 1280×800 annotated screenshot templates
│   │   └── promo/              # Global English small + marquee tiles
│   ├── captures/<locale>/      # Deterministic GUI captures of KeyPilot in that locale
│   └── RELEASE-CHECKLIST.md    # Per-locale dashboard upload record
├── firefox/                    # Reserved for AMO listing sources
└── generated/                  # Pipeline output only; do not treat as source
    └── chrome/
        ├── <locale>/           # Localized screenshot PNGs for dashboard upload
        └── promo/              # One global small PNG and one global marquee PNG
```

## What belongs where

| Path | Role |
|---|---|
| `chrome/slots.json` | Manifest of listing slots: order, size, capture recipe, SVG template, copy key, output filename. |
| `chrome/listing/<locale>.txt` | Detailed description for the Store listing tab. Paste by hand; Chrome does not read it from the package. Max 16,000 characters. |
| `chrome/copy/<locale>.json` | Product-owned annotation strings for that locale. Required before generating that locale. |
| `chrome/templates/` | Editable SVG templates. Embed the matching locale capture; substitute only headline, caption, and callouts. |
| `chrome/captures/<locale>/` | Real KeyPilot UI captures for that locale. Never reuse an English capture under translated annotations. |
| `generated/` | Composited PNGs at store dimensions. Keep this tree out of `chrome/templates/`. |

Do not put generated PNGs, JPEG exports, or capture bitmaps inside
`chrome/templates/`. Templates stay vector/source; bitmaps live in `captures/`
(inputs) or `generated/` (outputs).

## Chrome screenshot slots

Preferred listing size is `1280×800`, square-cornered and full-bleed. Chrome
allows up to five screenshots per locale. This listing uses all five slots
defined in `chrome/slots.json`:

1. `key-click-browsing` — first screenshot when the listing opens
2. `keyboard-map` — Keyboard Reference with a selected action
3. `customize-workflow` — Keyboard Layout Editor or Function Library
4. `walkthrough` — post-install onboarding walkthrough
5. `context-menu` — right-click KeyPilot controls

Every slot captures a **1280×800** viewport of the store fixture page
(`scripts/store-screenshots/fixture.html`) with KeyPilot enabled. Capture
selectors, hover target, pinned action, and layout-editor tab are on each
slot’s `capture` object. Generate with `npm run store:screenshots`; capture
with `npm run store:screenshots:serve` (see `scripts/store-screenshots/README.md`).

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
in the SVG annotations. `captures/<locale>/meta.json` records the capture
locale; the generator fails if it does not match the copy locale.

## Chrome Developer Dashboard upload

Localized screenshots are a dashboard-only asset. Uploading a new package
does not change listing screenshots.

1. Upload the extension package so Partner/Chrome listing can see each
   `_locales/<locale>` catalog.
2. Open the item’s **Store listing** tab
   ([Chrome listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)).
3. Choose the language in the listing language selector.
4. Paste **Detailed description** from `chrome/listing/<locale>.txt`. The
   short summary is **Summary from package** (`extension_description` in
   `messages.json`); do not paste it here.
5. Under **Localized screenshots**, upload only the PNGs from
   `generated/chrome/<locale>/` for that language. Use the `01-`…`05-`
   filenames in slot order. Do not upload promo tiles in this control.
6. Repeat for every shipped locale. Locales with no localized screenshots
   fall back to the global screenshots.
7. Upload `generated/chrome/promo/small.png` and `marquee.png` as the
   global small and marquee tiles. Never create per-locale promo files.

Record each upload in `chrome/RELEASE-CHECKLIST.md`.
