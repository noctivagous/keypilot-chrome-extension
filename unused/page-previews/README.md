# Parked: high-res favicons and page screenshots

These modules were removed from the live extension for a later version.

**Still live:** Chrome `/_favicon/` plus a generic SVG fallback; official video-site
card backgrounds (YouTube / Dailymotion / oEmbed via `KP_GET_VIDEO_THUMB`).

**Parked here:** opportunistic `captureVisibleTab` + IndexedDB thumbs, and the
service-worker multi-source high-res favicon probe (Google s2, DuckDuckGo,
origin `apple-touch-icon` paths).

## Restore page screenshots

1. Move `page-thumb-service.js` and `page-thumb-store.js` back to
   `extension/src/utils/` (so `../config/url-policy.js` and sibling imports resolve).
2. In `extension/background.js`:
   - `import { pageThumbService } from './src/utils/page-thumb-service.js';`
   - Call `pageThumbService.install()` at SW startup.
   - Restore the `KP_GET_PAGE_THUMB` handler (see git history).
3. Restore message types in `extension/src/messaging/types.js`:
   - `GET_PAGE_THUMB`, `PAGE_THUMB_RESPONSE`, `PAGE_THUMB_UPDATED`
4. Re-add `"alarms"` to `extension/manifest.json` permissions (GC uses
   `chrome.alarms`).
5. Wire `requestPageThumb` from `request-page-thumb.js` back into
   `extension/src/ui/page-thumb-ui.js` (`resolveCardBackgroundImage` capture
   fallback) and the New Tab history-group root-URL fallback.

Existing user IndexedDB `kp_page_thumbs` is left in place if this was used
before; it is unused while parked. Optional: delete that database in DevTools.

## Restore high-res favicons

1. Copy the handler from `favicon-sw-handler.js` back into `background.js`
   (message `KP_GET_FAVICON`).
2. Restore `GET_FAVICON` in `extension/src/messaging/types.js`.
3. Merge `url-listing-hires.js` into `extension/src/ui/url-listing.js`
   (`getGoogleS2FaviconUrl`, `requestFaviconFromServiceWorker`, high-res
   upgrade in `attachFaviconWithUpgrade` / `createFaviconImg`).

Keep the `favicon` permission and `_favicon/*` web-accessible resource; those
are still required for Chrome’s favicon API.
