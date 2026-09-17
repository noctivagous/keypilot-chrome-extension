# Locale-specific GUI captures

Deterministic captures of real KeyPilot UI in the target locale. Filenames
match `captureFile` in `chrome/slots.json`.

```text
captures/
└── <locale>/
    ├── key-click-browsing.png
    ├── keyboard-map.png
    └── customize-workflow.png
```

Rules:

- Capture the extension in that locale. Do not annotate an English capture
  with another locale's copy.
- These PNGs are compositing inputs, not dashboard uploads. Uploads come
  from `generated/chrome/<locale>/`.
- Viewport, fixture page, extension state, and selectors are defined on
  each slot in a later Phase 7 task; this directory is the landing place
  those captures write to.
