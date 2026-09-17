# Locale-specific GUI captures

Deterministic captures of real KeyPilot UI in the target locale. Filenames
match `captureFile` in `chrome/slots.json`.

```text
captures/
└── <locale>/
    ├── meta.json
    ├── key-click-browsing.png
    ├── keyboard-map.png
    └── customize-workflow.png
```

Shared capture settings live on `captureDefaults` in `chrome/slots.json`:

- Viewport: `1280×800`, device scale `1`
- Fixture: `scripts/store-screenshots/fixture.html`
- Screenshot: full viewport, square corners, no browser-window chrome
- Chrome UI language: same as the capture folder locale

Per-slot setup (`capture.open`) is implemented by
`scripts/store-screenshots/page-api.js`:

| Slot | Extension state | Selectors |
|---|---|---|
| `key-click-browsing` | Control Strip + Keyboard Reference; focus `#kp-store-primary-link` | `.kpv2-focus`, `.kp-floating-keyboard-help`, `.kp-control-strip` |
| `keyboard-map` | Keyboard Reference; pin `ACTIVATE`; page link still in view | `.kp-floating-keyboard-help`, `.kp-keybindings-popover` |
| `customize-workflow` | Keyboard Layout Editor; Functions library tab | `.kp-layout-config-panel`, `[data-kp-lib-tab='functions']` |

Rules:

- Capture the extension in that locale. Do not annotate an English capture
  with another locale's copy.
- These PNGs are compositing inputs, not dashboard uploads. Uploads come
  from `generated/chrome/<locale>/`.
- `meta.json` must set `"locale"` to the folder name before generation.
