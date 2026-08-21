# KeyPilot Storage Policy

Assessed: 2026-08-20  
Companion to Phase 2 in [EXTENSION_TECHNOLOGY_TRANSITION.md](./EXTENSION_TECHNOLOGY_TRANSITION.md).

This document is the ownership source of truth for persisted KeyPilot data.
Helper implementation: [`extension/src/utils/storage.js`](../extension/src/utils/storage.js).

## Shared helper rules

| Operation | Behavior |
|---|---|
| `storageGetValue` / `storageGetKeys` | Sync + local. If both present and both objects have `_updatedAt`, newer wins (local on tie). Else if both present without usable `_updatedAt`, prefer sync. Else sync → local → default. |
| `storageSetValue` | Sync first; on failure, local. `dualWrite: true` mirrors local after successful sync. |
| `storageSetObject` | Sync first; on failure, local. **Not** dual-write. |
| `includeTimestamp: true` | Writes a **sibling** top-level key named `timestamp`. Legacy; does **not** feed `_updatedAt` merge. Prefer embedding `_updatedAt` on object values (as `kp_settings_v1` does). |

Do **not** add a dedicated storage service unless the same ownership/conflict rules are reimplemented in multiple call sites. Prefer the shared helper or an explicit documented exception (sync-only, local-only, session).

## Early-chrome bootstrap snapshot

| Field | Value |
|---|---|
| Key | `kp_chrome_layout_v1` |
| Area | `localStorage` (page origin) |
| Version | Implicit in key name (`_v1`). Bump the key suffix on breaking shape changes. |
| Owner | `early-inject.js` (write/read at `document_start`); `src/utils/chrome-layout-cache.js` (runtime mirror) |
| Read timing | Synchronous peek before `chrome.storage` resolves |
| Authoritative source after reconcile | `kp_settings_v1` (panel/control-strip fields) + `keypilot_keyboard_help_visible` |
| Fallback | If missing/invalid JSON → safe defaults (Control Strip visible+collapsed, no free position). Never block page startup. |

Snapshot shape (compact; not the full settings object):

```text
{
  panelPositions?: {
    controlStrip?: { left?, top?, anchor? },
    keyboardReference?: { left?, top?, anchor? }
  },
  controlStrip?: { visible?, collapsed? },
  keyboardHelpVisible?: boolean,
  keyboardReferenceCollapsed?: boolean
}
```

Persistent in-page windows that must restore via bootstrap → reconcile → adopt:

- Keyboard Reference (`keypilot_keyboard_help_visible` + settings panel/collapse fields)
- Control Strip (`kp_settings_v1.controlStrip` + panel position)
- Theme FOUC caches (`kp_theme_id_v1`, `kp_theme_overrides_v1`) support appearance only; they are not layout hosts

## Primary settings blob

| Key | Area | Owner | Conflict / write | Notes |
|---|---|---|---|---|
| `kp_settings_v1` | dual (sync+local) | `settings-manager.js` | `_updatedAt` on value; `storageSetValue(..., { dualWrite: true })` | Single owner for normalize/migrate/merge. Early-inject may patch collapse/strip fields with dual set for live UI; runtime still reconciles through settings-manager. |

### `kp_settings_v1` field ownership

All fields are owned by `settings-manager` (read/normalize/write). Consumers must use `getSettings` / `setSettings` (or a future SettingsController), not raw storage patches, except early-inject’s documented bootstrap patches.

| Field group | Purpose |
|---|---|
| `themeId`, `themeOverrides`, `clickModeThemeId` | Theme selection / overrides |
| `searchEngine`, `cursorMode` | Search + cursor mode |
| `keyboardLayoutFamilyId`, `keyboardHandedness`, `keyboardLayoutId`, `currentKeyboardLayoutId` | Built-in / user layout selection |
| `keyboardReferenceKeyFeedback`, `keyboardReferenceShowNumberRow`, `keyboardReferenceCollapsed` | Keyboard Reference chrome |
| `topSitesPersistent`, `debugLogging`, `actionsLibraryTableExpanded` | Feature flags / UI chrome |
| `controlStrip` | Control Strip visibility + collapsed |
| `panelPositions` | Dock/free positions for persistent chrome |
| `actionSettings` | Per-action mode/parameters |
| `clickMode`, `textMode`, `scroll` | Mode settings |
| `_updatedAt` | Conflict timestamp (manager-owned) |

## Sync-only

| Key | Owner | Fallback | Rationale |
|---|---|---|---|
| `kp_keyboard_layout_store_v1` | `keyboard-layout-store.js` | None on write (sync only). Early-inject reads sync for document_start paint. | User layouts should roam with the profile; local mirror would diverge across devices. If sync is unavailable, treat store as empty rather than inventing a second source of truth. |

## Local-only (plus FOUC mirrors)

New Tab display preferences stay on the New Tab page origin and must not sync across profiles:

| Key | Area | Owner |
|---|---|---|
| `kp_newtab_theme` | local + localStorage mirror | `pages/newtab.js`, `newtab-display-popover.js`, `newtab-display-boot.js` |
| `kp_newtab_font_size_px` | local + localStorage | same |
| `kp_newtab_ui_scale` | local + localStorage | same |
| `kp_newtab_content_width` | local + localStorage | same |
| `kp_newtab_bookmarks_view` | local only | `pages/newtab.js` |
| `kp_newtab_font_scale` | local + localStorage (legacy read) | migrate to `kp_newtab_font_size_px`; do not write |

## Overlay / visibility keys outside settings

| Key | Area | Owner | Write policy |
|---|---|---|---|
| `keypilot_keyboard_help_visible` | dual | `keypilot.js` (authoritative via helper); also read/written by hub/settings/newtab/early-inject | Prefer `storageSetValue(..., { dualWrite: true })`. Manual dual paths should converge on the helper over time. |
| `keypilot_top_sites_visible` | dual | `keypilot.js` | helper + dualWrite |
| `keypilot_enabled` | dual | `background.js` ExtensionStateManager | helper; early-inject also peeks sync/local + localStorage fallback |
| `keypilot_onboarding_active` | dual | onboarding modules | Manual dual today; merge prefers presence |
| `keypilot_onboarding_progress` | dual | onboarding modules | Dual; conflict uses object `.timestamp` (not `_updatedAt`) |
| `keypilot_transient_action` | session + local | SW write; onboarding read | Local for content-script reliability; session best-effort |
| `keypilot_tab_history_mode` | dual via helper | `background.js` | helper |
| `kp_navgraph_v1_tab_<id>` | session preferred, else local | `background.js` | Per-tab; cleared on tab close |
| `keypilot_last_mouse_coordinates` | sync/local + localStorage | `mouse-coordinate-manager.js` | Survive context invalidation via localStorage |

## UI preference keys (helper, no dualWrite today)

| Key | Owner |
|---|---|
| `kpLaunchDeckState_v1` | `launch-deck.js` |
| `kpLauncherHiddenLaunchDeck` | legacy migrate then clear |
| `kpLauncherNavState_v1` | `launcher-popover.js` |
| `kpTopSitesSelectedTab_v1` | `top-sites-popover.js` |
| `kp_page_media_image_scale` / `_aspect` / `_sort` / `_landmark` / `kp_page_media_url_view` | `page-media-overlay.js` |

## FOUC / session caches (not authoritative)

| Key | Area | Owner | Role |
|---|---|---|---|
| `kp_theme_id_v1` | localStorage | theme-manager / early-inject / settings | Theme id before storage |
| `kp_theme_overrides_v1` | localStorage | same | Theme overrides before storage |
| `kp_settings_active_tab` | sessionStorage | `pages/settings.js` | Settings panel tab within session |
| `keypilot_enabled` | localStorage | early-inject only | Fallback if chrome.storage unavailable |

## IndexedDB

| Name | Owner | Notes |
|---|---|---|
| `kp_media_library` | `media-library-store.js` | Blobs/metadata; not chrome.storage |

## Intentional non-migrations (this phase)

- Early-inject keeps direct `chrome.storage` / localStorage access (document_start IIFE; no shared-module import without a build change).
- Keyboard layout store remains sync-only.
- New Tab prefs remain local-only.
- No dedicated storage service yet — shared helper + this policy are enough.
- Converging every manual dual-write (keyboard help, onboarding) onto the helper is follow-up work under this policy, not a blocker for Phase 2 completion.

## Test coverage

Independent of UI: `npm test` → `test/storage.test.js` (fallback, dual-write, partial failure, `_updatedAt` conflict for `storageGetValue` and `storageGetKeys`).
