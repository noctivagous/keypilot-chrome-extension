# KeyPilot UI Testing Checklist

Manual pass over every shipped popover, panel, overlay, and key action. Use this on a loaded unpacked `extension/` build (currently **0.3.5**).

Keys below are **Built-in: Browsing, right-handed** unless a row says otherwise. Open Keyboard Reference (`K`) first and confirm that map before blaming a “dead” key.

Mark each item:

- `[ ]` not done
- `[x]` pass
- `[~]` pass with note
- `[F]` fail (write the note next to the item)

---

## How to run

1. Reset to defaults if you are not sure of layout/theme: Settings → Overview → **Reset all settings to defaults**.
2. Use a normal `https://` page (Wikipedia, a long article, Google Maps, a page with images/video, a page with a text field).
3. Keep Keyboard Reference open while testing actions; collapse it only when you need screen space.
4. After each modal, confirm `Esc` returns you to normal browsing (focus rectangle on hover works again).
5. When a setting changes appearance, check **the page, Keyboard Reference, Control Strip, and Settings itself** — they share theme chrome.

Suggested pages:

| Purpose | Example |
| --- | --- |
| Links, headings, long scroll | Any Wikipedia article |
| Nested scroller | A site with a sidebar list or chat pane |
| Text fields | Google, a comment box, Settings search is *not* a page field |
| Images / video | A news article, YouTube, Wikipedia infobox |
| Maps / POI | Google Maps place pin |
| Iframes | A page that embeds another origin |
| Hostile CSS | Zapier, Slashdot classic (titlebar / `[hidden]` / `button` restyle) |
| Restricted | `chrome://extensions`, Chrome Web Store, `chrome://settings` |

---

## 0. Load, enable, restricted pages

- [ ] Load unpacked from `extension/`. Toolbar icon appears; popup opens.
- [ ] On a normal page, hover a link: focus rectangle appears. `Alt+K` turns KeyPilot **off** (no hover rect, no layout keys). `Alt+K` turns it **on** again.
- [ ] Popup master toggle matches `Alt+K` and Control Strip On/Off (all three stay in sync).
- [ ] `chrome://` pages and the Chrome Web Store: popup shows **UNAVAILABLE ON THIS TAB**; layout keys do nothing. `Alt+K` / `Alt+J` should still be captured where early-inject runs, but page UI will not appear on those URLs.
- [ ] Reload a normal tab after toggling: KeyPilot comes back in the last enabled state.

---

## 1. Extension popup (toolbar)

Open the toolbar popup on a normal tab.

- [ ] Header: KeyPilot title, ON/OFF switch + pill, `Alt+K` hint, version `0.3.5`.
- [ ] **Keyboard Reference** card: switch toggles the floating keyboard; status text and `aria-checked` update; shortcut `K`.
- [ ] **Help / Docs** card: opens the in-page Docs popover (`Alt+H`).
- [ ] **Onboarding Tutorial** card: opens the walkthrough (`Alt+T`); status reflects in-progress vs complete.
- [ ] **Settings** card: opens Settings popover (`'`).
- [ ] **Control Strip** card: switch shows/hides the strip (`Alt+J`).
- [ ] Popup theme matches Settings appearance (Dark Pro / Gray Metal Pro / GX-er).
- [ ] Closing the popup does not dismiss in-page windows you just opened.

---

## 2. Control Strip

Restore with `Alt+J` if missing.

- [ ] Strip is visible, themed, and **draggable** by the move handle. Position survives reload.
- [ ] **On/Off** segment matches popup / `Alt+K`. Tooltip mentions `Alt+K`.
- [ ] **Keyboard Reference** button toggles the floating keyboard.
- [ ] **Settings** button opens Settings.
- [ ] Collapse / expand: collapsed strip shows a compact On/Off (or status) segment; expand restores full controls.
- [ ] Close (×): strip gone. `Alt+J` restores it even when KeyPilot is **disabled**.
- [ ] Settings → Control Strip → **Show control strip** off hides it; `Alt+J` brings it back and the setting updates.
- [ ] **Collapsed by default** persists across new pages.
- [ ] **Text Mode** tints the strip (orange) so you can see why browsing keys are suspended. Leaving Text Mode (`Esc`) restores the normal tint.

---

## 3. Keyboard Reference (`K`)

Open with `K` (left-handed: `D`). Also from popup, Control Strip, New Tab “Keyboard” switch, Settings → Keyboard toggle.

### Window chrome

- [ ] Opens as a floating panel with titlebar, layout dropdown, collapse, close.
- [ ] Drag titlebar; position remembered across pages/tabs.
- [ ] Resize from edges/corners; size remembered.
- [ ] Collapse (`▾` / `▸`) hides keycaps, leaves titlebar; expand restores.
- [ ] Close via ×, toggle key (`K`), or popup/Control Strip switch — all agree on visibility.
- [ ] **Exit** control appears in Text Mode so you can leave the field without `Esc`; it exits Text Mode.
- [ ] Pressed-key overlay lights the matching keycap when **Pressed-key feedback** is on (Settings → Keyboard).
- [ ] Number row appears only when **Show number row** is on.

### Layout dropdown

- [ ] Lists built-in families (**Browsing**, **Navigation**) and any user layouts.
- [ ] Switching family updates keycaps immediately; `Alt+[` / `Alt+]` cycle families without changing handedness.
- [ ] **Edit Keyboard Layout…** opens Layout Editor (`Alt+C`) and puts Reference into edit mode.
- [ ] **New Blank Keyboard Layout** / **New Duplicate Keyboard Layout** create a user layout and enter edit.
- [ ] **Onboarding Tutorial** launches the walkthrough.
- [ ] **KeyPilot Documentation/Help** opens Docs.
- [ ] **KeyPilot Settings** opens Settings.
- [ ] Picking a “launch” item does not leave the dropdown stuck on that sentinel value.

### Key-info popover (hover a keycap)

This is the HTML Popover API tooltip on each key.

- [ ] Hover a bound key: popover shows icon, title, description, and key label.
- [ ] Hover an unbound key: empty / no action (custom layouts).
- [ ] Popover flips above/below the keycap and is not clipped by the panel.
- [ ] Pin (if offered) keeps it open while you move; unpin / leave closes it.
- [ ] Select Word / Sentence / Paragraph / Image (if bound): Exclusive vs Cumulative control in the popover works and is **shared for that Function**, not per-key.
- [ ] Config / settings hint for parameterized actions opens the right editor (or Layout Editor) without breaking hover.

### Link-hover key glow

- [ ] Settings → Click Mode → **Glow keys when hovering a link** on: green click-family keys outline/glow while a link is hovered and Reference is open.
- [ ] Toggle off: no glow.

---

## 4. System layer and Alt chrome

Always-on, independent of custom layouts.

| Chord / key | Expected | Pass |
| --- | --- | --- |
| `Esc` | Cancel current mode / many popovers; browsing keys resume | [ ] |
| `K` / left `D` | Toggle Keyboard Reference | [ ] |
| `'` (quote) | Toggle Settings popover | [ ] |
| `Alt+K` | Toggle KeyPilot on/off **even when disabled** | [ ] |
| `Alt+J` | Toggle Control Strip **even when disabled** | [ ] |
| `Alt+L` | Open Omnibox | [ ] |
| `Alt+;` or `Alt+A` | Open Launcher with search focused | [ ] |
| `Alt+[` / `Alt+]` | Previous / next layout family | [ ] |
| `Alt+C` | Toggle Keyboard Layout Editor | [ ] |
| `Alt+H` | Open Docs | [ ] |
| `Alt+T` | Show/hide onboarding walkthrough (does not reset progress) | [ ] |

- [ ] On a **custom sparse layout**, unused letter keys do nothing, but `Esc`, `K`/`D`, `'` still work.
- [ ] `Alt+D` (Shadow Root Debug HUD) is **dev-only**. Skip for store QA unless diagnosing paint. If you open it: it toggles, does not steal everyday keys, and closes cleanly.

---

## 5. Clicking, Text Mode, Delete Mode

Test on a page with links, buttons, and an `<input>` / `<textarea>`.

### Click Element (`F`)

- [ ] Hover link → rectangle → `F` navigates like a left click.
- [ ] Hover button / checkbox / other clickable → `F` activates it.
- [ ] Hover text field → `F` focuses it and enters **Text Mode** (orange field chrome; browsing keys suspended).
- [ ] Wrong target: nudge pointer; leaf under cursor wins.
- [ ] Click effect (Settings → Click Mode): **Flash**, **Dash chase**, **Marquee**, **Scale**, **None** each match the description when you `F` a link.
- [ ] Focus rectangle: color (blue/green), fill, glow, thickness update live — including inside the Settings iframe.
- [ ] Nested / iframe clickable: `F` still activates (frame agent). Note failures with origin.

### New tab clicks

- [ ] `B` — hovered link opens in a **foreground** new tab (switches to it).
- [ ] `G` — hovered link opens in a **background** tab (stay on current page). Queue several `G`s.

### Text Mode

- [ ] In a field, type letters; they go into the field, not KeyPilot actions.
- [ ] `Esc` (or Reference **Exit**) leaves Text Mode; hover rectangle returns.
- [ ] Short hover-and-`F` on another clickable while in Text Mode: countdown-aware activate still works, or document if it does not.
- [ ] Settings → Text Mode: T-square vs crosshair cursor (only when Cursor mode is KeyPilot Cursors).
- [ ] Focus style: **Left edge pulse** vs **Background tint**; bar width; labels on/off; stroke thickness.
- [ ] Hovering an unfocused field still shows orange outline and “F to select” (when labels on).

### Delete Mode (`Backspace`)

- [ ] `Backspace` enters Delete Mode; hover highlights elements to hide.
- [ ] Confirm hides the node on the **live page** (not browser Back).
- [ ] `Esc` or toggle again exits without extra deletes.
- [ ] Reload restores the original page (deletes are not persisted).

---

## 6. Scrolling

Use a long page, then a nested overflow pane.

| Key | Action | Pass |
| --- | --- | --- |
| `C` | Instant jump up by configured distance | [ ] |
| `V` | Instant jump down | [ ] |
| `Z` | Jump to top of **scroll target** (page or nested) | [ ] |
| `X` | Jump to bottom of scroll target | [ ] |
| `N` | Toggle Scroll Line | [ ] |

### Scroll Line (`N`)

- [ ] Origin mark appears under the cursor.
- [ ] Move away from origin: scroll direction + speed follow distance.
- [ ] `N` again, click, or `Esc` exits (`cancelOnPointerDown`).
- [ ] Nested scroller under cursor is the target; if wrong, exit, reposition, `N` again.
- [ ] Settings → Scrolling: distance slider; smooth vs instant for top/bottom jumps; **skip wide carousel-like scrollers**; **middle-click empty area** starts Scroll Line (yields to clickables, text fields, popover, omnibox).
- [ ] Middle-click on a link does **not** steal Scroll Line when yield-to-clickables is on.

---

## 7. Selection

### Text Select (`H`)

- [ ] First `H` starts character-level select (caret-to-caret; dashed rect is a guide only).
- [ ] Move, second `H` finishes and copies (rich vs plain per Action Instance).
- [ ] `Esc` cancels without copying.
- [ ] Paste into a rich editor vs a plain field to confirm format.

### Element Select (`Y`)

- [ ] Rectangle mode: drag over an article; intersecting **feature units** select (paragraph/heading, whole table, whole figure, whole list). A link inside a paragraph selects the paragraph.
- [ ] Overlap uses line boxes, not one bounding box.
- [ ] Cumulative pick mode (Function setting): add elements one by one, finish with `Enter`.
- [ ] `Esc` cancels.

### Unit select (Clipboard Functions — bind in Layout Editor)

Bind Select Word / Sentence / Paragraph / Image, then:

- [ ] Press on a unit selects it; press again on the same unit deselects.
- [ ] Exclusive (default) replaces; Cumulative adds/removes disjoint ranges; KeyPilot paints its own highlight for gaps.
- [ ] Copy / Cut uses that selection. `Esc` clears it.
- [ ] Independent of `H` / `Y`.

---

## 8. Tabs and history

Have at least three tabs open; visit a few URLs in one tab, then branch (back, then a different link).

| Key | Action | Pass |
| --- | --- | --- |
| `Q` / `W` | Previous / next tab | [ ] |
| `T` | Blank new tab | [ ] |
| `A` | Close current tab | [ ] |
| `D` | History back | [ ] |
| `R` | History forward | [ ] |
| `S` or `1` | Site root (scheme + host) | [ ] |
| `J` | Tab History popover | [ ] |

### Tab History (`J`)

- [ ] Opens a horizontal rail for **this tab**.
- [ ] Branch-retaining rail shows alternate descendants after a fork; badges on branches.
- [ ] Browser-history rail shows conventional back-stack.
- [ ] Click a card navigates the **current** tab.
- [ ] `Esc` / × closes without navigating.
- [ ] Left-handed default is `F` — only if you switch handedness.

---

## 9. Tool popovers and overlays

Shared chrome to check on **every** in-page window: themed titlebar, shortcut hint, × close, `Esc` close, drag (if panel), no host-page `button`/font leak (Slashdot is the acid test).

### Settings (`'`)

- [ ] Opens as in-page iframe popover (not a browser popup window).
- [ ] Titlebar close, `Esc`, and `'` toggle all dismiss it.
- [ ] Left nav: Overview, Appearance, Keyboard, Click Mode, Text Mode, Scrolling, Cursor, Control Strip, Search, About.
- [ ] Keyboard: `↑`/`↓` or Tab between categories; Overview hub tiles jump to the same panels.
- [ ] Changes apply immediately and sync to other tabs in this profile.
- [ ] Deep links: `kp://settings/keyboard` (from Docs) lands on Keyboard.

Walk **every control** (see §15). Do not skip reset buttons.

### Docs (`Alt+H`)

- [ ] Opens in-page Docs popover. Search filters topics; empty state when no match.
- [ ] Sidebar groups: Introduction, Getting started, Browsing, Keyboard, Settings, Tools, Media, Customize.
- [ ] Article renders markdown, images, `kbd`, internal `kp://` links (docs + settings).
- [ ] Docs icon in Layout Editor inspector opens the matching topic.
- [ ] Close: ×, `Esc`, `Alt+H` toggle.

### Guide (from New Tab / some chrome entry points)

- [ ] Short core-key list reflects the **active** layout (not a hardcoded right-handed sheet).
- [ ] Popover section lists preview/open keys for this layout.
- [ ] **Launch Walkthrough** starts onboarding.
- [ ] Close works; layout banner updates after switching family/handedness.

### Omnibox (`L` or `Alt+L`)

- [ ] Overlay focuses a URL/search field.
- [ ] Typing shows history + bookmark suggestions; `↑`/`↓` move; pointer also selects.
- [ ] `Enter` navigates the **current** tab (not a new tab).
- [ ] Bare query uses Settings → Search engine (Brave / Google / DuckDuckGo).
- [ ] `Esc` closes without navigating.
- [ ] `Alt+L` still works if you unbind layout `L`.

### Top Sites (`;` or `` ` ``)

- [ ] Panel opens; tall enough for three card rows without clipping.
- [ ] Tabs: **Toolbar**, **Most Visited**, **Recent Bookmarks**, **KeyPilot** (right edge). `1`–`4` jump; `Tab` cycles.
- [ ] Site cards navigate. Favicons load.
- [ ] **KeyPilot** tab: same five tools as the popup (Keyboard, Docs, Tutorial, Settings, Control Strip) — switches work.
- [ ] Drag titlebar; resize edges; position/size remembered.
- [ ] Gear → **Keep open across pages**: remounts on navigation, position stays in sync; toggle off = transient modal (outside click / leave page closes).
- [ ] `Esc`, ×, or `;` again closes.

### Launcher (`Alt+;` / `Alt+A`)

No default bare key on right-handed Browsing.

- [ ] Opens with **search focused**. `/` refocuses search.
- [ ] Filter by typing; categories include Launch Deck, Bookmarks, Recent, Social, News, Productivity, Videos, Entertainment, Shopping, AI, Internet Archive, Searches, etc.
- [ ] Arrow keys move; activate opens the site.
- [ ] Launch Deck **edit mode**: add, reorder, remove; `Esc` exits edit first, then closes.
- [ ] Card preview uses the same popup-window preview as Link Preview (Open / Open in New Tab in titlebar).
- [ ] Deck edits persist after reload.

### Link Preview (`E`) and Open Popover (`P`)

These are **OS popup windows**, not in-page iframes.

- [ ] Hover a link, `E`: sized popup near cursor loads the URL.
- [ ] Titlebar: **Open in this tab**, **Open in New Tab**, close.
- [ ] `Esc`, ×, or `E` again closes.
- [ ] `P`: larger popup; `P` / `Esc` closes.
- [ ] Preview of `chrome:` / blocked URLs fails gracefully (no hung window).
- [ ] Host CSS does not inflate the titlebar (~34px preview chrome).

---

## 10. Media

### Copy under cursor

- [ ] `I` on an image: copies per Action Instance destination (clipboard / Media Library / both). Paste into an image-capable surface to confirm clipboard.
- [ ] `U` on a link: copies the href (same destination options).
- [ ] Copy Video (library-only): bind it, hover a `<video>`, confirm bytes → library when fetchable, else URL → clipboard.
- [ ] Left-handed: copy-image default is `E` (preview moves to `W`).

### Page Media (`O`)

Shipped tabs (Text and URLs are **hidden** in current code):

- [ ] Overlay opens; tabs **Image**, **Video**, **Docs**, **Fonts** (disabled when count is 0).
- [ ] Image: scale slider, square vs original aspect, sort, **Article first** ranking; copy / download / full view / send to Media Library.
- [ ] Video: thumbnails, full view, copy/send.
- [ ] Docs: documents found on the page.
- [ ] Fonts: custom `.woff2` / `.otf` / `.ttf` first, then system fonts.
- [ ] `Esc` / overlay close.

### Media Library (`M`)

- [ ] Overlay opens saved **Images / Videos / Documents / URLs** (plus domain groupings).
- [ ] Open / full view; range select; download category or selection as ZIP; delete.
- [ ] Items appear after Copy-to-library and Page Media send.
- [ ] `Esc` / close.

### Font Info (library-only)

- [ ] Bind Font Info, hover styled text: popover shows family, size, file type, download URL; text run is outlined.
- [ ] Drag / close / `Esc`.

---

## 11. Maps (optional but shipped)

On Google Maps (or similar) with a place pin under the cursor. Bind **POI Website** / **POI Address** if not on the layout.

- [ ] **Place Website**: opens the place page in Link Preview.
- [ ] **Place Address**: copies street address (txt or vCard per instance).
- [ ] No pin under cursor: no crash / clear no-op.

---

## 12. New Tab page

Open the KeyPilot New Tab (if this build overrides NTP; otherwise open `extension/pages/newtab.html` via the extension URL).

- [ ] Topbar: KeyPilot enable switch (`Alt+K`), Control Strip switch (`Alt+J`), Keyboard switch (`K`) — all sync with the page/content-script chrome.
- [ ] **Display** button: popover (light-dismiss) — theme Cyberforward / Earth, font size, UI scale, content width. Choices persist.
- [ ] **Settings** and **Guide** buttons open those surfaces.
- [ ] Search form: suggestions; Go uses Settings search engine; engine label is correct.
- [ ] Top visited sites, toolbar bookmarks, recent history, Recent / All bookmarks tree.
- [ ] Empty states when Chrome has no bookmarks/history.
- [ ] KeyPilot onboarding + Control Strip still inject on this extension page.

---

## 13. Onboarding walkthrough (`Alt+T`)

Progress is profile-wide. Reset from tutorial entry points if you need a clean run.

- [ ] Launch from popup, Guide, Keyboard Reference dropdown, `Alt+T`.
- [ ] Panel chrome: title, step `n / m`, prev/next, close.
- [ ] Slide 1 **Welcome**: overlay OK/Close; tasks auto-check:
  - Hover link + `F`
  - `D` back
  - Hover a Keyboard Reference keycap
  - Click Control Strip ON → off (arrow at the strip; tip bubble to turn back on)
- [ ] Slide 2 **Text box**: practice field; `F` enter Text Mode, `Esc` exit. Overlay “KeyPilot is back on”.
- [ ] Slide 3 **Scrolling**: optional continue vs later (`Alt+T` to return). `V` `C` `X` `Z`.
- [ ] Slide 4 **Tabs**: `G`, `B`, `T`, `Q`, `W`.
- [ ] Slide 5 **Tutorial complete**.
- [ ] `Alt+T` hides without resetting; reopen resumes incomplete tasks.
- [ ] Reset tutorial from the same entry points starts clean.

---

## 14. Keyboard Layout Editor (`Alt+C`)

- [ ] Opens Config panel; Keyboard Reference enters **edit mode** (“Editing — Alt+C to exit”).
- [ ] Built-in layouts are read-only sources: first edit forks “Browsing Copy N” (or similar).
- [ ] Actions Library: card view and table view; search; categories (Navigation, Tab Control, Begin URL, Get Page Data, Maps, Scroll, Select, Clipboard, Type, Keystrokes, Data, Lookup, Translate, Script, Media Library, AI, KeyPilot, Tools, System).
- [ ] Select a Function, click a keycap: assignment appears; SVG placement cursor follows.
- [ ] Replace and clear (delete overlay on keycap) work.
- [ ] Parameterized Functions create **Action Instances**; Edit opens the parameter inspector; `+ New <Function>` creates another instance; two keys can hold different instances of the same Function.
- [ ] **Type Characters** and other `worksWhileTyping` Functions: only bindable as a **modifier chord**; bare letter is rejected with an explanation.
- [ ] Keystroke Functions: Combination/Hotkey, Burst, Round Robin, Continuous, Synthetic Mouse, Normal Key — create instance, place, fire on a page.
- [ ] Execute JS: new instance, paste a tiny script (`if (typeof notify === 'function') notify('ok')` with notify callback enabled), place, press key.
- [ ] Inspector docs icon → Docs topic.
- [ ] Layout CRUD: rename, delete, duplicate, set current, import/export JSON.
- [ ] Close via `Alt+C`, Config close, or Reference close-editor control. Edit mode ends; browsing keys work again.

### Macros (builder may be off)

Shipped `BUILD_ENABLE_MACRO_BUILDER` is **false**. Runtime still runs a Macro already bound to a slot.

- [ ] Confirm User Macros builder UI is **hidden** in this build.
- [ ] If you enable `--macro-builder` locally: draft steps, Save, place macro on a key, Wait/Gate/Stop/Run Macro, stock fork-on-edit.

---

## 15. Settings — control-by-control

Open Settings. After each change, confirm live UI. Use each **Reset … to defaults** and confirm only that section resets.

### Overview

- [ ] Theme select: Dark Pro, Gray Metal Pro, GX-er. Switching a pack also applies that pack’s Click Mode / cursor defaults.
- [ ] Customized badge appears after Appearance edits; clears on theme re-pick / appearance reset.
- [ ] Hub tiles navigate to each category.
- [ ] **Reset all settings to defaults**.

### Appearance

- [ ] Theme select (same three packs).
- [ ] Corner style, cut size, panel radius — Keyboard Reference / Settings / strip corners update.
- [ ] Title case, tracking, weight, leading icon.
- [ ] Shortcut (kbd) case.
- [ ] Key shading, key corners, key cut size, key border.
- [ ] Color pickers: accent, fg, dim, panel, panel edge, title top/mid/bot, shortcut text — chrome updates.
- [ ] UI size, key label size.
- [ ] **Reset appearance**.

### Keyboard

- [ ] Keyboard Reference visibility switch.
- [ ] Layout family select (view transition).
- [ ] Left-handed checkbox: Reference and actions mirror; system KB Reference key becomes `D`.
- [ ] Show number row.
- [ ] Pressed-key feedback.

### Click Mode

- [ ] Focus color, transparent overlay, shadow/glow, rectangle thickness.
- [ ] Glow keys when hovering a link.
- [ ] Click effect radios (see §5).
- [ ] Advanced: paint mode Auto B→C vs Auto A→B→C; skip for parent; paint backend debug; focus padding.
- [ ] **Reset Click Mode**.

### Text Mode

- [ ] See §5 Text Mode. **Reset cursor** vs **Reset Text Mode**.

### Scrolling

- [ ] See §6. **Reset scrolling**.

### Cursor

- [ ] **No Custom Cursors**: page cursor unchanged; Click Mode cursor controls hidden.
- [ ] **KeyPilot Cursors**: crosshair (and geometry: type, line width, size, gap) visible; preview box updates.
- [ ] **Reset cursor**.

### Control Strip

- [ ] See §2.

### Search

- [ ] Brave / Google / DuckDuckGo radios; favicons load.
- [ ] Omnibox and New Tab search both use the choice.

### About

- [ ] noctivagous.com branding.
- [ ] Debug logging toggle: off by default; on → verbose console in page and service worker.

---

## 16. Library-only Functions (no default key)

Bind each in Layout Editor, then fire on a suitable page.

| Function | What to verify |
| --- | --- |
| Click New Tab Background | Already on `G` — skip if §5 passed |
| Launcher | Same as `Alt+;` |
| Copy Video | See §10 |
| Font Info | See §10 |
| Copy / Cut / Paste / Select All | Operate on field or page selection |
| Select Word / Sentence / Paragraph / Image | See §7 |
| Send Text To AI | Select text, fire; result → clipboard and/or result popover; prompt on instance |
| Type Characters | Chord while a field is focused inserts the snippet |
| Execute JS | Script + callbacks: `showPopover`, `copyToClipboard`, `notify` |
| Get Text At Cursor | Granularity word/sentence/paragraph/hyperlink → clipboard |
| Get Media At Cursor | image/video/audio |
| Lookup Word | Dictionary popover; optional Ask AI source |
| Translate | Highlight or under-cursor; popover vs replace page text |
| Add URL to Media Library | Hovered href stored **without** download (or “coming soon” stub — record which) |
| Fetch URL for Media Library | File link (PDF/mp3/mp4) downloads into library (or stub) |

Macro-step-only (not placeable as keys): **Get Text Range**, **Show Popover**. Confirm they do **not** appear as assignable key cards.

**Cols Toggle** is build-excluded — must **not** appear in library or layouts.

---

## 17. Result popovers

- [ ] Procedure / AI / Execute JS / Lookup / Translate **popover** destination: themed panel, title, body, drag, ×, `Esc`.
- [ ] Clipboard destination does not open a popover.
- [ ] Both: copies **and** shows popover.
- [ ] Empty result: fallback text or a quiet no-op, no exception.

---

## 18. Persistence and multi-tab

- [ ] Open two normal tabs. Change theme, layout family, strip visibility, Keyboard Reference position. The other tab picks up storage changes without a full reload (or after focus — note which).
- [ ] Reload / restart Chrome: layout, theme, strip, Reference geometry, Top Sites “keep open”, Launch Deck, onboarding progress, Media Library contents still there.
- [ ] Disable and re-enable the extension: settings survive (Chrome profile storage).

---

## 19. Host-page and edge stress

- [ ] **Slashdot classic**: Settings / Preview titlebars not 76px+ from host `button { margin }`; fonts are KeyPilot UI fonts.
- [ ] **Zapier-like `[hidden]` override**: collapsed Keyboard Reference stays hidden (`display:none !important` path).
- [ ] Very high z-index / `dialog` / site popover: KeyPilot windows still clickable; note stacking bugs.
- [ ] Cross-origin iframe: hover + `F` on a link inside the iframe.
- [ ] Fullscreen video: `Esc` / overlay behavior is sensible.
- [ ] PDF viewer / `file://` (if you grant file access): either works or fails closed — no throw in the extension page console.

---

## 20. Left-handed spot check

Switch Settings → Keyboard → left-handed (or Browsing left). Do **not** retest every key; confirm mirroring:

- [ ] Activate cluster on the right (`J` click, `K` back, `L` root, …).
- [ ] Keyboard Reference toggle is `D`, not `K`.
- [ ] Settings still `'`.
- [ ] Copy image `E`, preview `W`, popover `I`, tabs `O`/`P`, omnibox `S`, top sites `A`.
- [ ] `OPEN_MEDIA_LIBRARY` has **no** default on left — `M` is page-down. Bind or skip.

Then switch back to right-handed.

---

## Not in this build (do not fail QA)

| Item | Status |
| --- | --- |
| Cols Toggle | In `BUILD_EXCLUDED_KEY_ACTIONS` |
| Type / Type Characters | In `BUILD_EXCLUDED_KEY_ACTIONS` |
| Data getters (text/media at cursor, text range) | In `BUILD_EXCLUDED_KEY_ACTIONS` |
| Create built-in Macro Key / Configured Macro Keys | In `BUILD_EXCLUDED_KEY_ACTIONS` |
| Macro Builder UI | `SOURCE_BUILD_ENABLE_MACRO_BUILDER = false` unless `node build.js --macro-builder` |
| Page Media **Text** and **URLs** tabs | Hidden via `HIDDEN_PAGE_MEDIA_TABS` |
| Basic Navigation family | Hidden from pickers; legacy ids may still resolve |
| Shadow debug HUD | `Alt+D` — diagnostic, not product UI |

---

## Sign-off

| Field | Value |
| --- | --- |
| Build / version | |
| Browser | Chrome / Brave / Opera GX / … |
| OS | |
| Layout tested | Browsing right-handed (required) + left-handed spot check |
| Date | |
| Blockers | |
| Notes | |
