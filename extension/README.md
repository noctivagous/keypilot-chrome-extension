# KeyPilot — extension sources

Product overview and the generated default key map live in the repository [`README.md`](../README.md). This file is the development map for code under `extension/`.

Noctivagous: http://noctivagous.com/

KeyPilot changes the interactive experience of
desktop web browsing by making single-key shortcuts
take the place of mouse button clicks.  The user
steers the cursor as before with the mouse but
"clicks" with keyboard keys. Once installed,
KeyPilot is active on ordinary web pages: an
on-screen highlight follows your mouse position (no
clicking required to move it), and pressing a key
acts on whatever element the highlight is currently
over — KeyPilot calls this a “key-click.” For
  example, hover a link and press **F** to click it,
  or press **G** to open it in a new background tab.
  Other everyday actions — switching tabs, going back
  and forward in history, scrolling by page or to the
  top/bottom, previewing a link in a popup, or
  opening the address bar — are each mapped to their
  own key in a layout designed for right-handed use,
  and the full layout can be customized in the
  built-in Layout Config editor (**Alt+C**).
 
  Clicking the toolbar icon opens a short popup with
  an at-a-glance status toggle (enable/disable
  KeyPilot for the current tab) and quick links into
  Settings, the in-product guide, and the keyboard
  map. On the page itself, KeyPilot draws two
  lightweight visual layers on top of your normal
  browsing: a moving highlight/cursor overlay that
  shows exactly which element is targeted, and an
  optional full-screen keyboard-map overlay (toggled
  with **K**) that shows every current key mapping as
  a hint over a picture of the keyboard, so the
  mappings are discoverable without leaving the page.
  These overlays are drawn by KeyPilot and never
  modify the underlying page content.
 
  Additional views reachable entirely by keyboard
  include an address-bar-style overlay for typing a
  URL or search (**L**), a history/launcher popover
  for revisiting recent pages, bookmarks, and Top
  Sites (**;**, **J**, **Alt+L**), and a Settings
  page for reviewing or remapping every shortcut,
  adjusting overlay appearance, and toggling optional
  features. All of these are standard extension
  pages/overlays rendered by KeyPilot; none of them
  replace Opera’s new-tab page or address bar.
  
## Build

From the repository root:

```bash
npm run build
```

Or from this directory: `node build.js`.

That regenerates `content-bundled.js`, `frame-agent-bundled.js`, `pages/docs-bundled.js`, and `pages/settings-bundled.js`. Edit `src/` (and `background.js`); do not edit the bundled outputs. Settings and Docs are loaded from those page bundles when opened, not from the eager content script.

Optional:

- `npm run build:macro-builder` — enable the Macro Builder UI
- `npm run build:minify` — also write minified content (not for Opera/Chrome review packages)
- `npm run package:opera` — staged Opera Add-ons ZIP in `dist/` (does not rewrite the development manifest)
- `npm run package:chrome` — staged Chrome Web Store ZIP in `dist/` (does not rewrite the development manifest)

Reload the unpacked extension after each build.

## Project layout

```
keypilot-chrome-extension/
├── README.md                 # Product docs + generated key mappings
├── package.json              # Build/audit scripts and dependencies
├── refs/                     # Internal architecture and store-checklists
├── scripts/                  # Docs screenshot capture, etc.
└── extension/                # Load this folder as the unpacked extension
    ├── manifest.json
    ├── background.js         # MV3 service worker (ES module)
    ├── early-inject.js       # document_start cursor/shell
    ├── content-bundled.js    # Generated from src/content-script.js
    ├── frame-agent-bundled.js
    ├── build.js
    ├── build-side-effects.js
    ├── popup.html / popup.js
    ├── src/
    │   ├── content-script.js
    │   ├── keypilot.js
    │   ├── config/           # constants, layouts, function library
    │   ├── modules/
    │   ├── ui/
    │   ├── utils/            # includes debug.js (release-gated logging)
    │   └── messaging/
    ├── pages/                # Settings, guide, new tab, docs, popovers
    ├── userdocs/             # In-product markdown topics
    ├── themes/
    ├── icons/
    └── styles/popup.css
```

`extension/src/` is the source of truth for content-script behavior. `docs/`, `tests/`, `test-pages/`, and `src/utils/logger.js` from older trees are gone; in-product help is `userdocs/`, and verbose logging is `src/utils/debug.js` plus Settings → About → Debug logging.

## Debug logging

Store/release builds keep debug **off**. Enable **Settings → About → Debug logging** to restore verbose `console.log` / `console.debug` / `console.info` in the service worker and page consoles. Warnings and errors are never gated. Compile-time `FEATURE_FLAGS` debug HUDs stay false unless you change them in `src/config/constants.js`.

## Release cadence (dependencies)

Before each store package:

1. `npm run audit` (production dependencies; currently `markdown-it`, `query-selector-shadow-dom`, `terser`)
2. `npm outdated` and bump if there is a security fix or a required API change
3. Record the audit date, npm audit summary, and any upgrades in the release record

See `refs/OPERA_GX_PUBLICATION_CHECKLIST.md` Phase 4.

## License

MIT — see the repository README. Add a `LICENSE` file before store submission if one is still missing at the repo root.

## Privacy

See [`PRIVACY_POLICY.md`](../PRIVACY_POLICY.md) for KeyPilot's data practices.