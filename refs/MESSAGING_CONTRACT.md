# KeyPilot Messaging Contract

Assessed: 2026-08-20  
Companion to Phase 3 in [EXTENSION_TECHNOLOGY_TRANSITION.md](./EXTENSION_TECHNOLOGY_TRANSITION.md).

Catalog source: [`extension/src/messaging/types.js`](../extension/src/messaging/types.js) (`MSG`, `TAB_UI_FORWARD_TYPES`).  
Boundary validation: [`extension/src/messaging/validate.js`](../extension/src/messaging/validate.js).

Wire values remain the `KP_*` strings; production code must send/receive via `MSG.*` except where noted.

## Context entry points

| Context | Channel | Router / entry |
|---|---|---|
| Service worker | `chrome.runtime.onMessage` | Single listener in `background.js` (validates then switches) |
| Content script (top / full KeyPilot) | `chrome.runtime.onMessage` | `installContentRuntimeRouter()` + `registerContentRuntimeHandler` (`content-runtime-router.js`) |
| Frame agent | `chrome.runtime.onMessage` + `window` `message` | `frame-click-agent.js` |
| Popup | `chrome.runtime.onMessage` | `popup.js` (state/status UI) |
| Extension pages (guide/docs/settings) | `sendMessage` / `postMessage` | No runtime listener; parents handle |
| Early inject | `chrome.runtime.onMessage` | `early-inject.js` IIFE — **documented exception**: uses string literals equal to `MSG` values (no ESM import at document_start) |

## Notifications vs request/response

**Notifications** (fire-and-forget / broadcast; ack optional):

| Type | Direction | Notes |
|---|---|---|
| `UPDATE_STATE` | SW → tabs | `{ enabled: boolean }` |
| `TOGGLE_STATE` with `enabled` | SW → tabs | Broadcast after toggle |
| `MEDIA_LIBRARY_CHANGED` | SW → tabs | Overlay reload |
| `POPOVER_WINDOW_CLOSED` | SW → opener tab | Clear popover mode |
| `STATUS` | content → SW | SW replies `ACK` |
| `FRAME_*` / `POPOVER_*` | `window.postMessage` | No `sendResponse` |

**Request/response** (await `sendResponse` / Promise):

- State: `GET_STATE` → `STATE_RESPONSE`; `SET_STATE` → `STATE_CHANGED` / `ERROR`; `TOGGLE_STATE` (no enabled) → `STATE_CHANGED`
- Navigation / tabs: `TAB_*`, `NEW_TAB`, `CLOSE_TAB`, `GO_*`, `OPEN_URL_*`, `NAVIGATE_SAME_TAB` → `SUCCESS` / `ERROR`
- Data APIs: omnibox, bookmarks, history, top sites, video thumb, dictionary, media library, navgraph → typed `*_RESPONSE` / `*_RESULT` / `NAVGRAPH_GRAPH` or echo type
- UI forward: `OPEN_*` / `LAUNCH_WALKTHROUGH` → SW forwards to tab → `SUCCESS` / `ERROR`
- Popover window: `OPEN_POPOVER_WINDOW`, `CLOSE_POPOVER_WINDOW`, `AM_I_POPOVER_WINDOW`

## High-value payload shapes

| Request | Required fields | Typical response `type` |
|---|---|---|
| `TRANSIENT_ACTION` | `action: string` | `SUCCESS` / `ERROR` |
| `SET_STATE` | `enabled: boolean` | `STATE_CHANGED` / `ERROR` |
| `OPEN_URL_*` / `NAVIGATE_SAME_TAB` / `NAVGRAPH_JUMP` | `url: string` | `SUCCESS` / `ERROR` |
| `OPEN_POPOVER_WINDOW` | `url: string` | `SUCCESS` (+ window ids) / `ERROR` |
| `DICTIONARY_LOOKUP` | `word: string` | `DICTIONARY_LOOKUP` echo |
| `OPEN_SETTINGS_POPOVER` | optional `panelId` | `SUCCESS` after forward |
| `OPEN_DOCS_POPOVER` | optional `topicId`, `hash` | `SUCCESS` after forward |
| `OMNIBOX_SUGGEST` | query fields as today | `OMNIBOX_SUGGESTIONS` |
| `GET_BOOKMARKS` | — | `BOOKMARKS_RESPONSE` |
| `GET_RECENT_BOOKMARKS` | optional `maxResults` | `RECENT_BOOKMARKS_RESPONSE` |
| `GET_MOST_VISITED` | — | `MOST_VISITED_RESPONSE` |
| `GET_TOP_SITES` | — | `TOP_SITES_RESPONSE` |
| `GET_HISTORY_FOR_DOMAINS` | domains list | `HISTORY_FOR_DOMAINS_RESPONSE` |
| `GET_RECENT_HISTORY` | — | `RECENT_HISTORY_RESPONSE` |
| `BROWSER_HISTORY_GET` | — | `BROWSER_HISTORY_RESULT` |
| `NAVGRAPH_GET` | sender tab | `NAVGRAPH_GRAPH` |
| `GET_VIDEO_THUMB` | url | `VIDEO_THUMB_RESPONSE` |

Invalid envelopes at the SW boundary return `{ type: MSG.ERROR, error: string }` via `validateRuntimeMessage`.

## Intentional exceptions

- **`early-inject.js`**: keeps `KP_*` string literals (wire-compatible with `MSG` values) until a build stamp injects constants.
- **`popup-v1.js`**: legacy popup; migrated to `MSG.*` for consistency but not the active UI.
- **Bundled outputs** (`*-bundled.js`): regenerate with `npm run build`; not edited by hand.

## Tests

`test/messaging-types.test.js` — catalog freeze, forward list, response types present, validate helper.
