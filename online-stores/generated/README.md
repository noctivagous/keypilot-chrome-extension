# Generated store bitmaps

Pipeline output. Do not edit by hand and do not store these files under
`chrome/templates/`.

```text
generated/chrome/
├── <locale>/
│   ├── 01-key-click-browsing.svg
│   ├── 01-key-click-browsing.png
│   ├── 02-keyboard-map.svg
│   ├── 02-keyboard-map.png
│   ├── 03-customize-workflow.svg
│   └── 03-customize-workflow.png
└── promo/
    ├── small.png
    └── marquee.png
```

Upload `generated/chrome/<locale>/` PNGs as that locale's **Localized
screenshots** in the Chrome Developer Dashboard. Upload `promo/` tiles as
global listing assets, not per locale. The sibling SVG files are review
artifacts containing that locale's text overlay and embedded capture before
rasterization. Raw browser captures live in `chrome/captures/<locale>/` and
are ignored by Git.
