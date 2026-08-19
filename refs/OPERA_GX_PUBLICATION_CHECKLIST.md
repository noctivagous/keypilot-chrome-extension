# KeyPilot Opera GX Publication Checklist

Release checklist for publishing KeyPilot to **Opera Add-ons** for use in Opera GX.

## Scope and source of truth

- [x] Confirm this checklist’s intended distribution channel is **Opera Add-ons**. The repository supports multiple distribution channels; Opera GX is Chromium-based and uses the Opera extension ecosystem, with no separate GX-only store submission path identified in Opera’s developer documentation.
- [x] Review Opera’s [Publishing Guidelines](https://help.opera.com/en/extensions/publishing-guidelines/#prepare), [Acceptance Criteria](https://help.opera.com/en/extensions/acceptance-criteria/), and [manifest reference](https://help.opera.com/en/extensions/manifest/) (reviewed 2026-08-19).
- [ ] Re-check the Publishing Guidelines and Acceptance Criteria immediately before submitting: store requirements can change after this checklist is written.
- [ ] Treat the Acceptance Criteria as the release gate. It requires one clear purpose; accurate, complete metadata and background-behavior disclosures; high-quality non-interlaced assets; no external JavaScript, unused files, redundant permissions, or unauthorized private-data transmission; reviewable first-party code; and successful Windows, macOS, and Linux testing.
- [ ] Use the manifest reference only for fields that remain applicable after validation in the target Opera GX version. Its examples are legacy Manifest V2 (`manifest_version: 2`, `browser_action`, and `opera://favicon`) and must not override the MV3 Chromium-compatible manifest or tested runtime behavior.
- [ ] Record the final source-review date, target Opera GX version/Chromium version, and any documented requirement changes in the release record.
- [ ] Keep the extension focused on its one stated purpose: keyboard-driven browsing and element activation. Do not add unrelated bundled features for the Opera release.

## Phase 1 — Decide the supported Opera GX release

- [ ] Define the minimum supported Opera GX version and confirm its Chromium version supports every API used by KeyPilot.
- [x] Verify Manifest V3 works end-to-end in the target Opera GX version. The current manifest already uses `manifest_version: 3`.
- [ ] Run the unpacked extension in Opera GX on macOS, Windows, and Linux. Opera tests accepted extensions on all three platforms.
- [ ] Decide and document incognito behavior: explicitly support it, explicitly disable it, or explain its limitations.
- [ ] Update user-facing browser terminology from Chrome-specific terms where needed:
  - [ ] Replace Chrome Web Store references.
  - [ ] Replace `chrome://` instructions with Opera / Opera GX equivalents where appropriate.
  - [ ] Add Opera and Opera GX to the compatibility section in `extension/README.md`.
- [ ] Verify KeyPilot does not replace the default start page. The current manifest does not declare a new-tab override; preserve that constraint.
- [ ] Verify KeyPilot does not duplicate a native Opera GX feature in a misleading way (for example, GX Control resource limiting).

## Phase 2 — Audit compatibility and permissions

### Manifest and API verification

- [ ] Validate the release `manifest.json` as JSON and verify every referenced file is included in the upload archive.
- [ ] Keep the build-stamped description in the development manifest. During `package:opera`, write a stable, grammatically complete product description into the **staged release manifest only**; do not modify the development source manifest.
- [ ] Keep the manifest description within Opera’s documented 132-character limit.
- [ ] Add accurate `developer` and `homepage_url` metadata once the public support/homepage URLs exist. A support page is optional, but it must be relevant if supplied.
- [ ] Use only Opera’s documented 16, 48, and 128 PNG icon sizes in the staged release manifest; remove the current extra 32/256 entries unless target-version testing or current Opera guidance specifically requires them.
- [ ] Add `minimum_opera_version` only after validating the exact required version; do not guess.
- [ ] Test the MV3 service worker lifecycle: startup, suspension/restart, message routing, alarms, and settings persistence.
- [ ] Test all extension pages in Opera GX: popup, settings, guide, keyboard reference, onboarding, and any iframe/popover flows.
- [ ] Test content-script injection at `document_start` and `document_idle`, including same-origin frames, `about:blank`, and cross-origin iframes.
- [ ] Test restricted/internal pages and clearly document where KeyPilot cannot run.
- [ ] Verify Opera GX behavior for APIs with browser-specific risk:
  - [ ] `favicon` / `/_favicon/`
  - [ ] `topSites`
  - [ ] `history`
  - [ ] `bookmarks`
  - [ ] `webNavigation`
  - [ ] `scripting`
- [ ] Confirm all `chrome.*` API calls used at runtime are available in the supported Opera GX version; add safe fallbacks or remove unsupported use.

### Permission minimization and reviewer evidence

#### Development-manifest code audit (2026-08-19)

- [x] Inventory every declared permission, including its feature, primary code path, user-visible reason, and manual verification.
- [x] Confirm `history`, `bookmarks`, and `topSites` have live user-visible paths; they are not dead manifest declarations.
- [x] Draft reviewer justification for broad page access: KeyPilot must inject keyboard handlers and overlays on pages where users invoke it; that access also enables iframe support and page-scoped helpers.
- [x] Map external fetch destinations from code. No telemetry or analytics endpoint was found in this audit.
- [ ] Verify these findings and browser behavior in the supported Opera GX versions; source review alone cannot certify Opera compatibility or data transmitted on the wire.

| Permission | User-visible feature and primary code path | Status | Manual verification |
|---|---|---|---|
| `storage` | Settings, layouts, onboarding, enabled state, and caches; `src/utils/storage.js`, `background.js`, `settings-manager.js` | Necessary | Change a setting and toggle KeyPilot; restart the browser and confirm both persist. |
| `tabs` | Popup/page messaging, tab switching, new tabs, and thumbnails; `background.js`, `popup.js`, `page-thumb-service.js` | Necessary | Use tab-left/right shortcuts, open a link in a new tab, and toggle the extension from the popup. |
| `windows` | Separate-window link-preview fallback; `background.js` `openPopoverWindowForOpener()` | Necessary for this preview path | Open a preview window, close it with Escape, and confirm the opener receives the close event. |
| `scripting` | Inject KeyPilot into popover iframes and inject the Maps pan bridge; `background.js` `INJECT_FULL_KEYPILOT_IN_FRAME` and `ENSURE_MAP_PAN_BRIDGE` | Necessary for iframe support; Maps bridge is optional | Confirm keyboard actions work in a popover iframe; test the Maps shortcut if shipped. |
| `history` | Omnibox suggestions, history popover, launcher decks, and new-tab suggestions; `background.js`, `omnibox-manager.js`, `pages/newtab.js` | Necessary | Use Alt+L to search history and inspect the history/launcher views. |
| `bookmarks` | Omnibox, launcher, Top Sites, new-tab bookmark panels, and pinned thumbnails; `background.js`, `launcher-popover.js`, `pages/newtab.js` | Necessary | Create a bookmark and confirm it appears in the relevant launcher or bookmark view. |
| `topSites` | “Most visited” Top Sites tab and omnibox ranking; `background.js` `KP_GET_MOST_VISITED`, `top-sites-popover.js` | Live, but partially redundant with history aggregation | Open the Most visited tab and test an empty omnibox query. |
| `favicon` | URL-list icons via `/_favicon/`; `url-listing.js`, `background.js` `KP_GET_FAVICON` | Necessary on Chromium/Opera | Check favicon display in omnibox, launcher, and Settings search-engine rows. |
| `webNavigation` | Tab history graph, iframe relay, and thumbnail timing; `TabNavGraphManager`, `page-thumb-service.js` | Necessary | Navigate a SPA and nested iframe; verify history graph updates and in-frame actions work. |
| `alarms` | Daily IndexedDB page-thumbnail cache cleanup; `page-thumb-service.js` | Necessary for scheduled cleanup | Use a short development alarm or inspect cache growth over several days. |
| `unlimitedStorage` | Headroom for data-URL favicon cache entries in `storage.local`; `background.js` `kp_favicon_v2_*` | Possibly preemptive; no direct API call | Stress the favicon cache and inspect service-worker console for quota errors; remove if a bounded cache makes it unnecessary. |
| `<all_urls>` host access and content scripts | Keyboard activation on ordinary pages, iframe injection, and page-scoped helpers; `manifest.json`, `background.js` | Necessary for the “works on pages where invoked” product scope | Test HTTP(S), SPA, cross-origin iframe, and `about:blank` iframe pages; confirm restricted internal pages fail as expected. |

- [ ] Audit `<all_urls>` and all three matching content scripts in target Opera GX versions. The broad scope is intentional for the stated product purpose; narrow it or use optional host permissions only if the supported experience remains coherent.
- [ ] Review `web_accessible_resources` in the release build. `themes/*`, `fonts/*`, `pages/*`, `userdocs/*`, and `/_favicon/*` have identified consumers, but the broad `src/*` exposure exceeds the current proven need.
- [ ] Audit and tighten the permissive extension-page CSP (`connect-src ... http:`, `frame-src *`) without breaking favicon, oEmbed, dictionary, media, or link-preview flows.
- [ ] Capture a network trace for favicon, oEmbed, dictionary, and media requests. Confirm requests send only the required URL/domain or user-requested word/media URL—not browsing-history bulk, page content, identifiers, or other private data.
- [ ] Verify the user-authored “Execute JS” feature has adequate UX consent and safety messaging. It runs in the content-script context with an 8-second timeout and no `chrome.*` APIs; current disclosure is documentation, not a first-run consent gate.

## Phase 3 — Create a reproducible, reviewable release package

- [x] Add a documented `npm run package:opera` command as a channel-specific package target. It must leave the shared development workflow and development manifest unchanged.
- [x] Make the package command:
  - [x] run the normal build;
  - [x] place only required runtime files into a clean temporary or `dist/opera/` directory;
  - [x] replace the development build-stamped description in the staged `manifest.json` with the approved Opera store description;
  - [x] validate the generated manifest and referenced paths;
  - [x] verify all executable JavaScript is packaged locally; do not fetch or execute external JavaScript at runtime;
  - [x] create the upload ZIP from that clean directory;
  - [x] print the archive name, version, size, and file list.
- [x] Ensure `content-bundled.js` is generated before packaging. It is referenced by the manifest but currently ignored by Git.
- [x] Do not ship `content-bundled.min.js` or other minified/obfuscated first-party code. Opera requires reviewable first-party source or reproducible instructions.
- [x] If bundled output remains required, include readable source and exact build instructions sufficient to reproduce it.
- [x] Exclude build-only and development-only files from the upload:
  - [x] `build.js`
  - [x] `build-side-effects.js`
  - [x] unused `babel.config.cjs` if confirmed unused
  - [x] source artwork such as `icons/icon-source.png`
  - [x] `.DS_Store`
  - [x] internal architecture/reference notes
  - [x] unused prototypes and alternate pages
- [x] Exclude or remove unused files before upload; this is an explicit Opera acceptance criterion.
- [ ] Confirm every third-party library in the package is necessary, unmodified, sourced legitimately, and current enough to have no known security issue.
- [ ] Produce and inspect a release archive from a clean clone or clean install.
- [ ] Load that archive’s unpacked contents in Opera GX and run the smoke test before uploading.
- [ ] Record the release version, build commit, SHA-256 of the ZIP, date, and test results. The packager writes `dist/keypilot-opera-v{version}.metadata.json` for version, commit, SHA-256, and timestamp; attach QA results before upload.

## Phase 4 — Codebase hygiene and deduplication audit

This work is not required merely to make a submission, but it directly reduces Opera’s unused-file, redundant-permission, reviewability, and package-size risks.

### Release-blocking audit

- [x] Remove or exclude unreferenced prototypes and pages after confirming they have no runtime route (moved to `unused/`):
  - [x] `keyboard/index.html`
  - [x] `plans/keyboard-layout-config-B-two-pane.html`
  - [x] `pages/text-mode-practice.html`
  - [x] `pages/text-mode-tutorial.html`
- [x] Remove or exclude obsolete artwork and static assets after reference checks (moved to `unused/`):
  - [x] `icons/icon.svg` (marked legacy)
  - [x] unused `img/` keyboard art
  - [x] duplicated GX theme `gear.svg` if the shared asset is sufficient
- [x] Remove or exclude internal package documentation not required at runtime (moved to `unused/`):
  - [x] `reference-info/*`
  - [x] `icons/README.md`
- [ ] Decide whether `extension/src/**` must be in the distributed package. If yes, document why it is web-accessible; if no, remove it from the archive and narrow `web_accessible_resources`.
- [ ] Review generated `early-inject.js` for stale duplicated data and remove dead `pendingKeyEvents` handling if unused.
- [ ] Confirm `babel.config.cjs` is unused before deleting it.
- [ ] Resolve remaining items in `refs/ARCHITECTURE_AUDIT_TODO.md` that affect correctness, excess code, or release-package contents.

### Non-blocking maintainability work

- [x] Split the largest modules only where it improves testability or removes real duplication; do not refactor merely for the store submission. (2026-08-19: reviewed `keypilot.js`, `overlay-manager.js`, `highlight-manager.js`, `rectangle-intersection-observer.js`. No clean test seam without a large rewrite. Extracted shared debug gating into `extension/src/utils/debug.js` instead.)
- [x] Consolidate duplicated README/key-mapping content and remove stale project-tree references. (Root `README.md` is the product + generated key map; `extension/README.md` is the source map. Build updates only the root markers. Removed stale `logger.js`, `docs/`, `tests/`, `test-pages/`, and root `babel.config.cjs` tree.)
- [x] Gate debug `console.log` output and verbose flags behind a release-safe debug setting. (`kp_settings_v1.debugLogging`, default false; Settings → About → Debug logging; wraps verbose console in content script, frame agent, and service worker. `FEATURE_FLAGS` debug HUDs remain off for ship.)
- [x] Add a dependency update/security review to the release cadence. (`npm run audit`; steps in `extension/README.md` and below.)

#### Dependency review (each release)

1. Run `npm run audit` from the repo root (production deps only: `markdown-it`, `query-selector-shadow-dom`, `terser`).
2. Run `npm outdated` and upgrade when there is a known security issue or a required API fix. `esbuild` is a devDependency; include it if the build toolchain is in scope.
3. Record audit date, finding summary, and version pins in the release record. First recorded review: 2026-08-19, `npm run audit` reported 0 vulnerabilities.
4. Confirm third-party libraries in the upload ZIP remain necessary, unmodified, and currently without known issues (also Phase 3).

## Phase 5 — Quality assurance

- [ ] Add automated smoke coverage for build output, manifest file references, and the most important keyboard activation flows; there is currently no `test` script.
- [ ] Until automated coverage exists, create a versioned manual QA script and attach its results to each release.
- [ ] Test the primary behavior on representative sites: simple documents, SPAs, shadow DOM, nested frames, media pages, and pages with dense interactive controls.
- [ ] Test key flows: activate links/elements, open in foreground/background tab, tab switching, scrolling, omnibox/launcher, settings, help, and text mode.
- [ ] In Opera GX on Windows, macOS, and Linux, test every shipped Alt chord, including bare-Alt menu activation and AltGr input behavior.
- [ ] Test enable/disable, browser restart, extension update, and storage migration behavior.
- [ ] Test failure modes: unavailable permissions, restricted pages, malformed page markup, slow pages, offline state, and unavailable external favicon/oEmbed services.
- [ ] Test keyboard focus, screen-reader compatibility where applicable, zoom, light/dark themes, and all supported keyboard layouts.
- [ ] Check popup sizing in Opera GX: no horizontal overflow; vertical scrolling only when necessary.
- [ ] Check performance and memory on long, dynamic pages; the extension should not unnecessarily slow the browser.
- [ ] Resolve all new console errors and release-blocking lint/build errors.

## Phase 6 — Listing, privacy, and support materials

### Store listing

- [ ] Choose the Opera Add-ons category (likely **Productivity**, subject to final product positioning).
- [ ] Write a one-sentence summary that directly answers “What does KeyPilot do?” in complete grammatical prose.
- [ ] Write a description that explains both:
  - [ ] how a user invokes and uses KeyPilot; and
  - [ ] what the popup, overlays, and keyboard hints look like.
- [ ] Describe all background behavior, including page-level content scripts and launcher/history/bookmark behavior.
- [ ] Do not use “Opera” in the extension title or imply that Opera Software created KeyPilot.
- [ ] Verify all claims match actual release behavior and supported browsers.
- [ ] Provide a relevant support URL and contact path.
- [ ] Add a public changelog/release notes template.

### Privacy, licensing, and disclosures

- [ ] Publish a privacy policy before submission.
- [ ] State what stays on-device and what is transmitted externally.
- [ ] Specifically disclose access/use of history, bookmarks, top sites, tab/page URLs, stored settings, and user-authored scripts.
- [ ] Specifically disclose favicon and oEmbed/external network requests and their destinations.
- [ ] State whether KeyPilot collects, sells, shares, or retains personal data. Do not collect private data without user authorization.
- [ ] Add the actual MIT `LICENSE` file, or change the README to the intended license. The README currently claims MIT but no license file is present.
- [ ] Verify all icons, screenshots, libraries, copy, and bundled assets have appropriate rights/licenses.

### Icons and screenshots

- [ ] Verify the 16/48/128 PNG icons are stylistically consistent, anti-aliased, and transparent where appropriate.
- [ ] Do not use text-only icons or Opera branding.
- [ ] Generate the missing in-product documentation images from `scripts/docs-screenshots/`.
- [ ] Create dedicated store screenshots that show:
  - [ ] the toolbar location and popup;
  - [ ] keyboard hints working on a representative webpage;
  - [ ] settings/customization;
  - [ ] the Opera GX-oriented theme, if it is a supported highlighted feature.
- [ ] Follow Opera’s preferred screenshot guidance: use a clean browser profile, white background where appropriate, only relevant UI, and clear focus on the extension.
- [ ] Keep screenshots at the recommended 612×408 pixels where practical; do not exceed 800×600.
- [ ] Verify every PNG is non-interlaced; Opera’s image pipeline does not support interlaced PNGs.

## Phase 7 — Submission and post-submission

- [ ] Create/verify the Opera Add-ons developer account.
- [ ] Upload the clean release ZIP and complete all listing metadata.
- [ ] Review the submission preview against this checklist before final submission.
- [ ] Save the exact submitted archive and metadata outside the working tree.
- [ ] Track the review result in the Opera developer dashboard.
- [ ] If rejected, record each reviewer finding, fix it in a new release package, increment the version, rerun QA, and resubmit through the Upgrade flow.
- [ ] After approval, install from the published Opera Add-ons page in Opera GX and re-run the production smoke test.

## Completion criteria

- [ ] A clean, reproducible ZIP installs in supported Opera GX versions on macOS, Windows, and Linux.
- [ ] The archive contains no unused, minified/obfuscated first-party, or build-only files.
- [ ] Permissions and data flows are minimized, tested, documented, and defensible to reviewers.
- [ ] The listing, privacy policy, support URL, license, icons, and screenshots are complete and accurate.
- [ ] All Opera acceptance criteria and final publishing-guideline tasks have been checked against the current official pages.
