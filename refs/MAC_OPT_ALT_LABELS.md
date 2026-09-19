# Mac Opt vs PC Alt labels

Implementation checklist so Mac users see **Opt** and Windows/Linux/ChromeOS
users see **Alt** in UI labels and messages for system-key actions (the
Option/Alt modifier KeyPilot already handles as `e.altKey`).

This is a host-OS display problem, not a locale problem. Chrome i18n catalogs
cannot branch on operating system. Do not duplicate `_locales/` or
`userdocs/` trees for Mac vs PC.

Related: [`i18n/README.md`](../i18n/README.md) (catalog workflow),
[`refs/CHROME_I18N_TASK_ITEMS.md`](CHROME_I18N_TASK_ITEMS.md) (locale
architecture). Detection already exists in
`extension/src/utils/platform.js` (`isMacPlatform()`), currently used only
for the middle-click Scroll Line default. Tests stub OS via
`installChromeMock({ isMac: true|false })`.

## Scope and design constraints

- **Mac → `Opt`. Non-Mac (Windows, Linux, ChromeOS) → `Alt`.** Do not add a
  Windows-only detector unless Linux must be labeled differently.
- Change **legends only**. Event handling stays `e.altKey`. Do not rename
  stored slot keys, chord IDs (`CHORD:CTRL+ALT+Q`), action IDs, or layout
  IDs.
- Keep **Alt** as the canonical English source in catalogs. Pass the
  platform-specific shortcut at runtime as a `getMessage()` substitution.
- Do not bake `Opt` into `messages.json` as a Mac-only catalog. `chrome.i18n`
  is locale-only.
- `localizeElements()` cannot pass substitutions. Static HTML shortcut chips
  (`popup.html`, `newtab.html`) must be filled in JS.
- Do not blindly replace the word “Alt” in translated copy (Spanish
  “Alternar”, German “Alte”). Rewrite only keycap / shortcut tokens.
- Product jargon such as **“Alt chrome”** is not a keycap. Leave it, or
  introduce a separate phrase — do not mechanically rewrite it to Opt.
- Store listing screenshots are not OS-specific. One capture set will show
  either Alt or Opt; default to Windows (Alt) unless Mac-only shots are
  deliberately shipped elsewhere.
- **Win vs Cmd** (meta modifier currently labeled `Win` even on Mac) is out
  of scope unless explicitly added. Same helper pattern, different token.
- No migrations or compatibility shims. Forward-only.

## Target architecture

```text
extension/src/utils/platform.js     isMacPlatform() (existing)
extension/src/utils/…               altModifierLabel() + formatAltShortcut()
callers                             getMessage(key, formatAltShortcut('K'))
userdocs + onboarding source        keep <kbd>Alt</kbd> / `Alt`; rewrite at load
CHORD / layout slot strings         stay ALT internally
```

Suggested helpers (names flexible; colocate with `isMacPlatform()` or a
small `shortcut-label.js` imported by background, popup, content UI, settings,
and docs):

| Helper | Mac | Non-Mac |
|---|---|---|
| `altModifierLabel()` | `Opt` | `Alt` |
| `formatAltShortcut('K')` | `Opt+K` | `Alt+K` |
| `formatAltShortcut('H', { joiner: ' + ' })` | `Opt + H` | `Alt + H` |

Optional catalog keys `modifier_alt` / `modifier_opt` if long-form copy needs
a translatable “Option” while chips stay the short **Opt** / **Alt** glyphs.

## Known hardcoded Alt surfaces

Sweep these; new user-visible shortcuts must use the formatter.

| Surface | Examples |
|---|---|
| Popup / hub | `popup.html` `<kbd>Alt</kbd>+<kbd>K</kbd>`; `KEYPILOT_HUB_CARDS` `Alt+H` / `Alt+I` / `Alt+J`; `popup_hotkey_toggle_aria_label` “Hotkey Alt plus K” |
| New Tab | `newtab.html` / `newtab_static_024` `Alt+J`; `hintKeyLabel: 'Alt+H'` |
| Control strip | Callers pass `'Alt+K'` / `'Alt+J'` into existing `$1` messages; some titles still hardcoded |
| Context menus | `background.js` `getMessage(..., 'Alt + I')` / `'Alt + H'` — service worker must use the helper |
| Keyboard Reference / layout editor | `'Alt + C'`, `'Alt + I'`, `'Alt + H'` in `floating-keyboard-help.js`, `keyboard-layout-config-panel.js` |
| Settings | Catalog prose “omnibox (Alt+L)”, “press Alt+J”; mix of `$1` placeholders and baked sentences |
| Chords / macros | `formatChordSlotKeyLabel`, `formatKeyStroke` always push `'Alt'`; inspector `['alt', 'Alt']` |
| Onboarding | XML `` `Alt`+`I` ``; `onboarding_reopen_tip` |
| In-product docs | `<kbd>Alt</kbd>` throughout `userdocs/*/` |
| Store / README | Screenshot annotations and copy that show the shortcut chip |

`localizeKeycapLabel()` covers Tab/Shift/Esc only; Alt is not a keycap
message today.

## Phase 1 — formatter and tests

**Outcome:** One testable way to produce Opt vs Alt shortcut strings.

### Tasks

- [x] Add `altModifierLabel()` and `formatAltShortcut()` on top of
      `isMacPlatform()`.
- [x] Keep chord/slot canonical tokens as `ALT` (and `CTRL` / `META`);
      formatting is presentation-only.
- [x] Unit-test Mac vs non-Mac with `installChromeMock({ isMac: true|false })`.
- [x] Document the helper in a short comment: Mac Opt, all other hosts Alt.

### Acceptance criteria

- Mac stub yields `Opt+K` / `Opt + H`.
- Win32 stub yields `Alt+K` / `Alt + H`.
- Linux/ChromeOS (non-Mac) yields Alt.
- `buildChordSlotKey` / stored layouts are unchanged.

### Validation

- [x] `npm test` covers both `isMac` branches for the formatter.

## Phase 2 — runtime chrome call sites

**Outcome:** Popup, hub, new tab, control strip, context menus, keyboard
reference, layout editor titlebars, and settings JS pass formatted shortcuts
into `getMessage()`.

### Tasks

- [x] Replace every JS `'Alt+…'` / `'Alt + …'` substitution with
      `formatAltShortcut(...)`.
- [x] `background.js` context-menu titles (`context_menu_onboarding_tutorial`,
      `context_menu_docs_help`).
- [x] `KEYPILOT_HUB_CARDS` hints (or resolve hints at render time, not in the
      frozen English literals).
- [x] Control-strip tooltips and remaining hardcoded titles.
- [x] Floating keyboard help layout-picker shortcuts and editor close labels.
- [x] Layout editor titlebar `Alt + C`.
- [x] Settings page `getMessage(..., 'Alt+D')` / `'Alt+J'` callers.
- [x] Popover / docs / newtab `hintKeyLabel` defaults (`Alt + H`).
- [x] Onboarding reopen tip substitution.

### Acceptance criteria

- On a Mac profile, those chips and tooltips show Opt; on Windows, Alt.
- Context menus created in the service worker match the host OS.

### Validation

- [x] Reload unpacked extension on macOS and Windows (or mock both in tests).
- [ ] Inspect popup hub, control strip, Keyboard Reference dropdown, layout
      editor titlebar, settings control-strip copy, and the page context menu.

## Phase 3 — catalogs and static HTML

**Outcome:** No user-visible sentence still hardcodes `Alt+` when the modifier
name must follow the OS.

### Tasks

- [x] Convert baked English (and translated) strings that embed `Alt+…` in
      the sentence to `$1` placeholders. Keep placeholder names stable across
      locales. Examples: `popup_hotkey_toggle_aria_label`,
      `settings_static_038` (omnibox Alt+L), control-strip visibility copy,
      `newtab_static_024`.
- [x] Fill popup and newtab shortcut nodes in JS after `localizeElements()`.
      Do not expect `data-i18n` to inject Opt.
- [x] Run `npm run check:locales` after placeholder changes.
- [x] Update translator `description` / `example` fields (examples may stay
      `Alt+K` as the canonical illustration).

### Acceptance criteria

- `check:locales` passes.
- Popup `Alt+K` / `Alt+H` / `Alt+I` / `Alt+J` chips follow the host OS,
  including accessible names.

### Validation

- [x] `npm run check:locales`
- [x] English, Spanish, and German catalogs keep matching placeholder names.
- [ ] Popup and New Tab on Mac show Opt in visible chips and aria-labels.

## Phase 4 — docs and onboarding

**Outcome:** Long-form help matches the host OS without forked Markdown/XML
trees.

### Tasks

- [x] Keep `<kbd>Alt</kbd>` in `userdocs/` source. Rewrite that kbd token at
      render time in `pages/docs.js` (markdown-it kbd rule or a post-pass on
      kbd text only).
- [x] Substitute `` `Alt` `` in onboarding XML when the model is loaded
      (same token discipline; do not rewrite surrounding words).
- [x] Decide separately whether titles/prose **“Alt chrome”** stay as product
      jargon or get a dedicated phrase. Not part of the kbd rewrite.
- [x] Smoke-test `keyboard-system-keys`, `getting-started`, `browsing-modes`,
      `layout-config` in en / es / de.

### Acceptance criteria

- Mac Docs show `<kbd>Opt</kbd>` for system shortcuts; Windows shows Alt.
- Spanish/German verbs that contain “Alt…” are unchanged.
- Onboarding later-slide copy shows Opt on Mac.

### Validation

- [x] Unit tests rewrite `<kbd>Alt</kbd>` / `` `Alt` `` on Mac and leave
      Spanish/German verbs and **Alt chrome**.
- [ ] Open Docs on Mac and Win; search a topic that uses `<kbd>Alt</kbd>`.
- [ ] Complete or reopen onboarding (`Alt+I` / `Opt+I`) and read the later
      overlay title.

## Phase 5 — chord and macro labels (optional same change)

**Outcome:** User-bound modifier chords that include Option also say Opt on
Mac. Internal slot keys remain `ALT`.

### Tasks

- [ ] `formatChordSlotKeyLabel` (`extension/src/utils/key-chord.js`).
- [ ] `formatKeyStroke` (`extension/src/config/macro-keys.js`).
- [ ] Layout-editor inspector modifier toggle `['alt', 'Alt']` and related
      notify strings (“Ctrl/Alt/Shift”).
- [ ] Macro-key editor modifier checkboxes.

### Acceptance criteria

- A chord bound with Option displays `Opt` (or `Ctrl+Opt+…`) on Mac and
  `Alt` on PC. Stored `CHORD:…+ALT+…` strings are unchanged.

### Validation

- [ ] Bind a works-while-typing Function with Option held; inspector and
      assignment kbd match the host OS.

## Phase 6 — store, README, and capture policy

**Outcome:** Listing assets and contributor docs do not imply a single OS
label by accident.

### Tasks

- [ ] Decide store screenshot policy: Windows/Alt as the default listing, or
      document Mac Opt as an intentional variant (Chrome dashboard is not
      OS-specific).
- [ ] README / contributor shortcut mentions stay Alt unless a Mac-specific
      note is added.
- [ ] Do not generate a second locale tree for Opt.

### Acceptance criteria

- Release checklist records which OS the uploaded GUI captures were taken on
  if shortcuts are visible.

## Out of scope unless requested

- [ ] Meta modifier: `Win` vs `Cmd` / `⌘` on Mac (same formatter pattern).
- [ ] Replacing `Opt` with `Option` or the `⌥` glyph in chips.
- [ ] iPad / Magic Keyboard (userAgentData may not be `macOS`; Option still
      sets `altKey`). Decide only if a real device shows the wrong label.
- [ ] Changing which physical key system actions use.

## Ongoing maintenance

- [ ] New system-key copy uses `formatAltShortcut`, never a literal `Alt+`.
- [ ] New docs shortcuts use `<kbd>Alt</kbd>` in source so the renderer can
      retarget.
- [ ] Pre-release literal-string audit includes `Alt+` in JS, HTML, XML, and
      catalog messages.

## References

- `extension/src/utils/platform.js` — `isMacPlatform()`
- `test/helpers/chrome-mock.js` — `isMac` navigator stub
- `extension/src/utils/i18n.js` — `getMessage` / `localizeElements`
- `extension/src/utils/key-chord.js` — `formatChordSlotKeyLabel`
- `extension/src/config/macro-keys.js` — `formatKeyStroke`
- `extension/background.js` — context-menu shortcut substitutions
- `extension/src/ui/keypilot-hub.js` — hub card hint literals
- `extension/userdocs/` — Markdown `<kbd>Alt</kbd>`
- `extension/onboarding/*.xml` — backtick `Alt`
- `i18n/README.md` — catalog conventions (placeholders, no HTML in messages)
