# Changelog

### Categories

- **Added** — new features
- **Changed** — changes in existing behavior
- **Deprecated** — soon-to-be removed features
- **Removed** — removed features
- **Fixed** — bug fixes
- **Security** — vulnerability fixes

## [0.1.2] - 2026-09-23

Localization for Slovak, Chinese, and Japanese, and physical keyboard layouts.


### Added

- Localization (i18n) for Slovak, Chinese (Simplified, Traditional Taiwan, and Hong Kong), and Japanese.
- Physical keyboard layouts for the Keyboard Reference. Choose US ANSI, German QWERTZ, Spanish (Spain), Slovak QWERTZ, or Japanese JIS. Actions stay on the physical key; keycap legends follow the selected layout.
- Key Actions:
 - Tabs and Window Overview.
 - Zoom In, Zoom Out, placed on [ and ] keys.
 - Open URLs, Open Random Bookmarks.
- Reader Mode overlay on <kbd>P</kbd> (right-handed Browsing) / <kbd>I</kbd> (left-handed). Open Popover is no longer on a built-in key; bind it in Layout Editor. A toolbar under the title bar toggles article images; the choice is stored in `chrome.storage`. Site `nav` and `footer` landmarks are omitted; article headers stay. Distillations shorter than Readability’s 500-character floor are rejected.


### Store listing snippet

```
Slovak, Chinese, and Japanese localization, plus physical keyboard layouts for the Keyboard Reference.
```

---

## [0.1.1] - 2026-09-21

Localization

### Added

- Localization (i18n) for extension UI.

### Changed

- Updated Settings window.

### Fixed

- YouTube iframe navigation on pages.

### Store listing snippet

```
Localization (i18n), updated Settings window, and YouTube iframe navigation fixes.
```

---

## [0.1.0] - 2026-09-02

First public release.

### Added

- Keyboard-first browsing with key-clicks (hover + key instead of mouse button).
- Default right-handed key layout for click, tabs, history, scrolling, and tools.
- Remappable layouts via Layout Config.
- In-product docs, Settings, and keyboard reference overlay.
- <!-- Add / trim bullets to match what ships in 0.1.0 -->

### Store listing snippet

```
First release of KeyPilot: browse with key-clicks, remappable layouts, and built-in keyboard help.
```

---

[Unreleased]: https://github.com/noctivagous/keypilot-chrome-extension/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/noctivagous/keypilot-chrome-extension/releases/tag/v0.1.1
[0.1.0]: https://github.com/noctivagous/keypilot-chrome-extension/releases/tag/v0.1.0
