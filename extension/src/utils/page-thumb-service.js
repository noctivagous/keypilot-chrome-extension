/**
 * Page thumbnail capture service (service worker).
 *
 * Opportunistically screenshots the visible area of active tabs after load,
 * stores low-res WebP in IndexedDB, pins bookmark URLs, and GCs history thumbs.
 */

import { isSkippableUrl, isKeyPilotNewTabUrl } from '../config/url-policy.js';
import {
  PageThumbStore,
  normalizePageThumbKey,
  pageThumbHost,
  pageThumbRootKey
} from './page-thumb-store.js';

export const PAGE_THUMB_MAX_WIDTH = 480;
export const PAGE_THUMB_WEBP_QUALITY = 0.55;
export const PAGE_THUMB_JPEG_QUALITY = 0.55;
export const PAGE_THUMB_CAPTURE_DEBOUNCE_MS = 1500;
export const PAGE_THUMB_RECAPTURE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const PAGE_THUMB_HISTORY_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const PAGE_THUMB_MAX_ENTRIES = 1500;
export const PAGE_THUMB_MAX_BYTES = 50 * 1024 * 1024;
export const PAGE_THUMB_GC_ALARM = 'kp_page_thumb_gc';
/**
 * How long a navigation session (requested URL → final URL) stays open for
 * aliasing. Covers slow SSO redirects; pruned on capture or tab close.
 */
export const PAGE_THUMB_NAV_SESSION_TTL_MS = 60_000;

/**
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isScreenshotableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u) return false;
  if (isSkippableUrl(u) || isKeyPilotNewTabUrl(u)) return false;
  if (/^file:/i.test(u) || /^blob:/i.test(u)) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode a data: URL into a Blob without fetch().
 * Extension CSP connect-src does not allow data: (fetch is blocked).
 *
 * @param {string} dataUrl
 * @returns {Blob|null}
 */
function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null;
  }

  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;

  const header = dataUrl.slice(5, comma); // after "data:"
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(header);
  const mimeMatch = header.match(/^([^;,]*)/);
  const mime = (mimeMatch && mimeMatch[1] ? mimeMatch[1] : '').trim() || 'application/octet-stream';

  try {
    if (isBase64) {
      const binary = atob(payload);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }

    // Percent-encoded (rare for captureVisibleTab, but handle it).
    const decoded = decodeURIComponent(payload);
    return new Blob([decoded], { type: mime });
  } catch (e) {
    console.warn('[PageThumb] dataUrlToBlob failed:', e?.message || e);
    return null;
  }
}

/**
 * Resize + re-encode a capture data URL to a small WebP (JPEG fallback).
 * @param {string} dataUrl
 * @returns {Promise<{ blob: Blob, mime: string, width: number, height: number }|null>}
 */
async function encodePageThumb(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  // Do not fetch(data:) — extension CSP connect-src blocks it.
  const sourceBlob = dataUrlToBlob(dataUrl);
  if (!sourceBlob || sourceBlob.size < 32) return null;

  let bitmap;
  try {
    bitmap = await createImageBitmap(sourceBlob);
  } catch (e) {
    console.warn('[PageThumb] createImageBitmap failed:', e?.message || e);
    return null;
  }

  try {
    let width = bitmap.width || 0;
    let height = bitmap.height || 0;
    if (width < 8 || height < 8) return null;

    if (width > PAGE_THUMB_MAX_WIDTH) {
      const scale = PAGE_THUMB_MAX_WIDTH / width;
      width = PAGE_THUMB_MAX_WIDTH;
      height = Math.max(1, Math.round(height * scale));
    }

    if (typeof OffscreenCanvas === 'undefined') {
      // Extremely defensive: store original (should not happen in modern Chromium SW).
      return {
        blob: sourceBlob,
        mime: sourceBlob.type || 'image/jpeg',
        width: bitmap.width,
        height: bitmap.height
      };
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);

    /** @type {Blob|null} */
    let out = null;
    try {
      out = await canvas.convertToBlob({
        type: 'image/webp',
        quality: PAGE_THUMB_WEBP_QUALITY
      });
    } catch {
      out = null;
    }
    if (!out || out.size === 0) {
      try {
        out = await canvas.convertToBlob({
          type: 'image/jpeg',
          quality: PAGE_THUMB_JPEG_QUALITY
        });
      } catch {
        out = null;
      }
    }
    if (!out || out.size === 0) return null;

    return {
      blob: out,
      mime: out.type || 'image/webp',
      width,
      height
    };
  } finally {
    try {
      bitmap.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Collect bookmark URL keys from the full tree.
 * @returns {Promise<Set<string>>}
 */
async function collectBookmarkUrlKeys() {
  /** @type {Set<string>} */
  const keys = new Set();
  if (!chrome?.bookmarks?.getTree) return keys;

  try {
    const tree = await chrome.bookmarks.getTree();
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (n?.url) {
          const k = normalizePageThumbKey(n.url);
          if (k) keys.add(k);
        }
        if (n?.children) walk(n.children);
      }
    };
    walk(tree);
  } catch (e) {
    console.warn('[PageThumb] bookmark tree walk failed:', e?.message || e);
  }
  return keys;
}

export class PageThumbService {
  constructor() {
    this.store = new PageThumbStore();
    /** @type {Map<number, ReturnType<typeof setTimeout>>} */
    this._debounceByTab = new Map();
    /** Serialize captures. */
    this._chain = Promise.resolve();
    this._installed = false;
    /** @type {Set<string>|null} */
    this._bookmarkKeys = null;
    this._bookmarkKeysAt = 0;
    /**
     * host → best PageThumbRecord (most recent lastSeenAt).
     * Same-host only — never share across product subdomains
     * (mail.google.com vs messages.google.com).
     * @type {Map<string, import('./page-thumb-store.js').PageThumbRecord>|null}
     */
    this._hostIndex = null;
    this._hostIndexAt = 0;
    /**
     * Per-tab navigation session: URL we *started* loading vs URL after settle.
     * @type {Map<number, {
     *   originUrl: string,
     *   originKey: string,
     *   chain: Map<string, string>,
     *   startedAt: number
     * }>}
     */
    this._tabNavSession = new Map();
  }

  /** Drop cached host index after writes / GC. */
  _invalidateHostIndex() {
    this._hostIndex = null;
    this._hostIndexAt = 0;
  }

  /**
   * Begin (or reset) a navigation session when the browser starts loading a URL.
   * The origin is what bookmarks/history still reference after redirects.
   * @param {number} tabId
   * @param {string} url
   */
  _beginNavSession(tabId, url) {
    if (typeof tabId !== 'number' || !isScreenshotableUrl(url)) return;
    const key = normalizePageThumbKey(url);
    if (!key) return;
    /** @type {Map<string, string>} */
    const chain = new Map();
    chain.set(key, url);
    this._tabNavSession.set(tabId, {
      originUrl: url,
      originKey: key,
      chain,
      startedAt: Date.now()
    });
  }

  /**
   * Record another URL seen during the current navigation (redirect hop / final).
   * Does not reset origin.
   * @param {number} tabId
   * @param {string} url
   */
  _noteNavUrl(tabId, url) {
    if (typeof tabId !== 'number' || !isScreenshotableUrl(url)) return;
    const key = normalizePageThumbKey(url);
    if (!key) return;
    let session = this._tabNavSession.get(tabId);
    if (!session || Date.now() - session.startedAt > PAGE_THUMB_NAV_SESSION_TTL_MS) {
      this._beginNavSession(tabId, url);
      return;
    }
    if (!session.chain.has(key)) session.chain.set(key, url);
  }

  /**
   * @param {number} tabId
   * @returns {{
   *   originKey: string,
   *   originUrl: string,
   *   keys: string[],
   *   sources: Map<string, string>
   * } | null}
   */
  _getNavSessionSnapshot(tabId) {
    const session = this._tabNavSession.get(tabId);
    if (!session) return null;
    if (Date.now() - session.startedAt > PAGE_THUMB_NAV_SESSION_TTL_MS) {
      this._tabNavSession.delete(tabId);
      return null;
    }
    /** @type {Map<string, string>} */
    const sources = new Map(session.chain);
    return {
      originKey: session.originKey,
      originUrl: session.originUrl,
      keys: [...sources.keys()],
      sources
    };
  }

  /**
   * @param {number} tabId
   */
  _clearNavSession(tabId) {
    this._tabNavSession.delete(tabId);
  }

  /**
   * Install tab/bookmark/alarm listeners (idempotent).
   */
  install() {
    if (this._installed) return;
    this._installed = true;

    try {
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        void this._onTabUpdated(tabId, changeInfo, tab);
      });
    } catch (e) {
      console.warn('[PageThumb] tabs.onUpdated failed:', e?.message || e);
    }

    try {
      chrome.tabs.onActivated.addListener((activeInfo) => {
        void this._onTabActivated(activeInfo);
      });
    } catch (e) {
      console.warn('[PageThumb] tabs.onActivated failed:', e?.message || e);
    }

    try {
      chrome.tabs.onRemoved.addListener((tabId) => {
        this._clearNavSession(tabId);
        const t = this._debounceByTab.get(tabId);
        if (t) {
          try {
            clearTimeout(t);
          } catch {
            // ignore
          }
          this._debounceByTab.delete(tabId);
        }
      });
    } catch (e) {
      console.warn('[PageThumb] tabs.onRemoved failed:', e?.message || e);
    }

    // Navigation session: remember requested URL before load, hops, then compare
    // to the settled tab URL at capture time.
    try {
      if (chrome.webNavigation?.onBeforeNavigate) {
        chrome.webNavigation.onBeforeNavigate.addListener((details) => {
          if (!details || details.frameId !== 0) return;
          if (typeof details.tabId !== 'number') return;
          const tabId = details.tabId;
          const url = details.url || '';
          // Redirect chains fire onBeforeNavigate again for the *target* URL.
          // Only start a new session when none is open; otherwise keep origin and
          // add this hop (so login → mail keeps the login key).
          const existing = this._tabNavSession.get(tabId);
          const expired =
            existing &&
            Date.now() - existing.startedAt > PAGE_THUMB_NAV_SESSION_TTL_MS;
          if (!existing || expired) {
            this._beginNavSession(tabId, url);
          } else {
            this._noteNavUrl(tabId, url);
          }
        });
      }
      if (chrome.webNavigation?.onCommitted) {
        chrome.webNavigation.onCommitted.addListener((details) => {
          if (!details || details.frameId !== 0) return;
          if (typeof details.tabId !== 'number') return;
          this._noteNavUrl(details.tabId, details.url || '');
        });
      }
      if (chrome.webNavigation?.onHistoryStateUpdated) {
        chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
          if (!details || details.frameId !== 0) return;
          if (typeof details.tabId !== 'number') return;
          this._noteNavUrl(details.tabId, details.url || '');
        });
      }
    } catch (e) {
      console.warn('[PageThumb] webNavigation listeners failed:', e?.message || e);
    }

    try {
      if (chrome.bookmarks?.onCreated) {
        chrome.bookmarks.onCreated.addListener(() => {
          void this._onBookmarksChanged();
        });
      }
      if (chrome.bookmarks?.onRemoved) {
        chrome.bookmarks.onRemoved.addListener(() => {
          void this._onBookmarksChanged();
        });
      }
      if (chrome.bookmarks?.onChanged) {
        chrome.bookmarks.onChanged.addListener(() => {
          void this._onBookmarksChanged();
        });
      }
    } catch (e) {
      console.warn('[PageThumb] bookmark listeners failed:', e?.message || e);
    }

    try {
      if (chrome.alarms?.create) {
        chrome.alarms.create(PAGE_THUMB_GC_ALARM, {
          periodInMinutes: 24 * 60
        });
        chrome.alarms.onAlarm.addListener((alarm) => {
          if (alarm?.name === PAGE_THUMB_GC_ALARM) {
            void this.runGc().catch((err) => {
              console.warn('[PageThumb] scheduled GC failed:', err?.message || err);
            });
          }
        });
      }
    } catch (e) {
      console.warn('[PageThumb] alarms setup failed:', e?.message || e);
    }

    // Warm IDB + pins in the background; clean old site-domain mixups.
    void this.store
      .open()
      .then(() => this._pruneSpuriousCrossHostAliases())
      .then(() => this.refreshBookmarkPins())
      .catch(() => {});
  }

  /**
   * Build / refresh host → best thumb index (most recently seen per host).
   * @returns {Promise<Map<string, import('./page-thumb-store.js').PageThumbRecord>>}
   */
  async _getHostIndex() {
    const now = Date.now();
    if (this._hostIndex && now - this._hostIndexAt < 30_000) {
      return this._hostIndex;
    }

    /** @type {Map<string, import('./page-thumb-store.js').PageThumbRecord>} */
    const hostMap = new Map();
    try {
      const all = await this.store.getAll();
      for (const row of all) {
        if (!row?.urlKey || !row.blob) continue;
        const host = pageThumbHost(row.urlKey);
        if (!host) continue;
        const prev = hostMap.get(host);
        if (!prev || (Number(row.lastSeenAt) || 0) > (Number(prev.lastSeenAt) || 0)) {
          hostMap.set(host, row);
        }
      }
    } catch (e) {
      console.warn('[PageThumb] host index build failed:', e?.message || e);
    }

    this._hostIndex = hostMap;
    this._hostIndexAt = now;
    return hostMap;
  }

  /**
   * Resolve a stored thumb for a page URL.
   * Lookup order:
   *  1) exact normalized URL
   *  2) same-host site root (https://host/)
   *  3) durable redirect map (only from real navigations: requested → final)
   *  4) same host (most recent path on that host only)
   *
   * Never share across product subdomains (mail.google.com ≠ messages.google.com).
   * Cross-host reuse only via the redirect map after an observed forward.
   *
   * @param {string} pageUrl
   * @returns {Promise<{
   *   success: boolean,
   *   dataUrl?: string,
   *   mime?: string,
   *   width?: number,
   *   height?: number,
   *   cached?: boolean,
   *   match?: 'exact'|'root'|'redirect'|'host',
   *   error?: string
   * }>}
   */
  async getThumbForUrl(pageUrl) {
    const urlKey = normalizePageThumbKey(pageUrl);
    if (!urlKey) {
      return { success: false, error: 'Invalid URL' };
    }

    try {
      /** @type {import('./page-thumb-store.js').PageThumbRecord|null} */
      let row = null;
      /** @type {'exact'|'root'|'redirect'|'host'|null} */
      let match = null;

      row = await this.store.get(urlKey);
      if (row?.blob) {
        match = 'exact';
      }

      // 2) Same-host root — common for toolbar bookmarks of the homepage.
      if (!row?.blob) {
        const rootKey = pageThumbRootKey(pageUrl);
        if (rootKey && rootKey !== urlKey) {
          const rootRow = await this.store.get(rootKey);
          if (rootRow?.blob) {
            row = rootRow;
            match = 'root';
          }
        }
      }

      // 3) Durable redirect: we visited A, landed on B, stored under B (real nav only).
      if (!row?.blob) {
        try {
          const redir = await this.store.getRedirect(urlKey);
          if (redir?.toKey) {
            const target = await this.store.get(redir.toKey);
            if (target?.blob) {
              row = target;
              match = 'redirect';
            }
          }
        } catch {
          // ignore
        }
      }

      // 4) Same host only (never sibling product hosts under google.com / etc.).
      if (!row?.blob) {
        const host = pageThumbHost(pageUrl);
        if (host) {
          const hostMap = await this._getHostIndex();
          const hostRow = hostMap.get(host) || null;
          if (hostRow?.blob) {
            row = hostRow;
            match = 'host';
          }
        }
      }

      if (!row?.blob) {
        return { success: false, error: 'Not found' };
      }

      // Touch matched row for LRU.
      try {
        await this.store.touchLastSeen(row.urlKey, Date.now());
      } catch {
        // ignore
      }

      // Soft alias for root/host/redirect hits so the next lookup is exact.
      // Do NOT invent redirect-map rows here (that mixed product hosts).
      if (match && match !== 'exact' && urlKey !== row.urlKey) {
        void this._writeAliasRecord(urlKey, pageUrl, row).catch(() => {});
      }

      const dataUrl = await blobToDataUrl(row.blob);
      return {
        success: true,
        dataUrl,
        mime: row.mime || row.blob.type || 'image/webp',
        width: row.width || 0,
        height: row.height || 0,
        cached: true,
        match: match || 'exact'
      };
    } catch (e) {
      return { success: false, error: e?.message || 'Lookup failed' };
    }
  }

  /**
   * True when a URL looks like an auth / account entry point (safe to map
   * cross-host after SSO). Product apps like mail. vs messages. are not.
   * @param {string} urlKey
   */
  _looksLikeAuthEntryUrl(urlKey) {
    const host = pageThumbHost(urlKey);
    if (!host) return false;
    if (/^(account|accounts|login|sso|auth|signin|id|myaccount)\./i.test(host)) {
      return true;
    }
    try {
      const u = new URL(urlKey);
      const path = `${u.pathname || ''}${u.search || ''}`.toLowerCase();
      if (/\/(login|signin|sign-in|auth|sso|accounts?)\b/.test(path)) return true;
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * Remove contamination from the old registrable-domain heuristic:
   * - exact thumbs duplicated across product hosts with the same image fingerprint
   *   and no auth-style redirect to justify it (mail.google.com → messages.google.com)
   * - cross-host redirect rows that are not auth→app shaped
   */
  async _pruneSpuriousCrossHostAliases() {
    try {
      const all = await this.store.getAll();
      /** @type {Map<string, import('./page-thumb-store.js').PageThumbRecord[]>} */
      const byFp = new Map();
      for (const row of all) {
        if (!row?.urlKey || !row.blob) continue;
        const fp = `${row.byteSize}|${row.capturedAt}|${row.width}|${row.height}`;
        if (!byFp.has(fp)) byFp.set(fp, []);
        byFp.get(fp).push(row);
      }

      for (const group of byFp.values()) {
        if (group.length < 2) continue;
        const hosts = new Set(group.map((r) => pageThumbHost(r.urlKey)).filter(Boolean));
        if (hosts.size < 2) continue;

        for (const row of group) {
          const keyHost = pageThumbHost(row.urlKey);
          if (!keyHost) continue;
          // eslint-disable-next-line no-await-in-loop
          const redir = await this.store.getRedirect(row.urlKey);
          const justified =
            redir?.toKey &&
            pageThumbHost(redir.toKey) &&
            pageThumbHost(redir.toKey) !== keyHost &&
            this._looksLikeAuthEntryUrl(row.urlKey);
          if (justified) continue;

          // Another host in this fingerprint group owns a copy — drop this
          // cross-host duplicate unless this row is the only one on its host
          // with a more recent lastSeen... Prefer keeping auth entry + final.
          const siblingOtherHost = group.some(
            (o) => o.urlKey !== row.urlKey && pageThumbHost(o.urlKey) !== keyHost
          );
          if (!siblingOtherHost) continue;
          if (this._looksLikeAuthEntryUrl(row.urlKey)) continue;

          // eslint-disable-next-line no-await-in-loop
          await this.store.delete(row.urlKey);
          // eslint-disable-next-line no-await-in-loop
          await this.store.deleteRedirect(row.urlKey);
        }
      }

      const redirs = await this.store.getAllRedirects();
      for (const r of redirs) {
        if (!r?.fromKey || !r?.toKey) continue;
        const fromHost = pageThumbHost(r.fromKey);
        const toHost = pageThumbHost(r.toKey);
        if (!fromHost || !toHost || fromHost === toHost) continue;
        if (this._looksLikeAuthEntryUrl(r.fromKey)) continue;
        // Non-auth cross-host redirect (likely site-heuristic contamination).
        // eslint-disable-next-line no-await-in-loop
        await this.store.deleteRedirect(r.fromKey);
      }

      this._invalidateHostIndex();
    } catch (e) {
      console.warn('[PageThumb] cross-host alias prune failed:', e?.message || e);
    }
  }

  /**
   * Store a copy of an existing thumb under another urlKey (redirect / site alias).
   * @param {string} urlKey
   * @param {string} sourceUrl
   * @param {import('./page-thumb-store.js').PageThumbRecord} base
   */
  async _writeAliasRecord(urlKey, sourceUrl, base) {
    if (!urlKey || !base?.blob) return;
    try {
      const existing = await this.store.get(urlKey);
      if (existing?.blob && existing.capturedAt) {
        const age = Date.now() - existing.capturedAt;
        if (age >= 0 && age < PAGE_THUMB_RECAPTURE_AFTER_MS) return;
      }
      let pinned = false;
      try {
        pinned = (await this._getBookmarkKeys()).has(urlKey);
      } catch {
        pinned = false;
      }
      const now = Date.now();
      await this.store.put({
        urlKey,
        blob: base.blob,
        mime: base.mime,
        width: base.width,
        height: base.height,
        capturedAt: base.capturedAt || now,
        lastSeenAt: now,
        pinned,
        byteSize: base.byteSize || base.blob.size || 0,
        sourceUrl: sourceUrl || urlKey
      });
      this._invalidateHostIndex();
    } catch (e) {
      console.warn('[PageThumb] alias write failed:', urlKey, e?.message || e);
    }
  }

  /**
   * @param {number} tabId
   * @param {chrome.tabs.TabChangeInfo} changeInfo
   * @param {chrome.tabs.Tab} tab
   */
  async _onTabUpdated(tabId, changeInfo, tab) {
    if (!tab || tab.incognito) return;

    // pendingUrl is often the *requested* URL before chrome rewrites the bar.
    if (changeInfo.status === 'loading' && tab.pendingUrl) {
      // Prefer pending as session origin when no session yet (fallback if
      // onBeforeNavigate was missed after SW wake).
      if (!this._tabNavSession.has(tabId)) {
        this._beginNavSession(tabId, tab.pendingUrl);
      } else {
        this._noteNavUrl(tabId, tab.pendingUrl);
      }
    }

    if (changeInfo.url || changeInfo.status === 'loading' || changeInfo.status === 'complete') {
      const u = tab.url || tab.pendingUrl || changeInfo.url || '';
      this._noteNavUrl(tabId, u);
    }

    if (!changeInfo || changeInfo.status !== 'complete') return;
    if (tab.active !== true) return;
    const url = tab.url || tab.pendingUrl || '';
    if (!isScreenshotableUrl(url)) return;
    this._scheduleCapture(tabId, tab.windowId, url);
  }

  /**
   * @param {chrome.tabs.TabActiveInfo} activeInfo
   */
  async _onTabActivated(activeInfo) {
    if (!activeInfo || typeof activeInfo.tabId !== 'number') return;
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (!tab || tab.incognito) return;
      if (tab.status !== 'complete') return;
      const url = tab.url || '';
      if (!isScreenshotableUrl(url)) return;
      this._noteNavUrl(tab.id, url);
      this._scheduleCapture(tab.id, tab.windowId, url);
    } catch {
      // Tab may have closed.
    }
  }

  /**
   * @param {number} tabId
   * @param {number|undefined} windowId
   * @param {string} url
   */
  _scheduleCapture(tabId, windowId, url) {
    this._noteNavUrl(tabId, url);
    const prev = this._debounceByTab.get(tabId);
    if (prev) {
      try {
        clearTimeout(prev);
      } catch {
        // ignore
      }
    }

    const timer = setTimeout(() => {
      this._debounceByTab.delete(tabId);
      // Capture settled tab; session holds requested URL if it differed.
      this._enqueue(() => this._captureTab(tabId, windowId));
    }, PAGE_THUMB_CAPTURE_DEBOUNCE_MS);

    this._debounceByTab.set(tabId, timer);
  }

  /**
   * @param {() => Promise<void>} fn
   */
  _enqueue(fn) {
    this._chain = this._chain
      .then(() => fn())
      .catch((e) => {
        console.warn('[PageThumb] capture chain error:', e?.message || e);
      });
  }

  /**
   * Capture the active tab's current visible page.
   * Compare navigation-session origin (requested URL) to settled tab URL;
   * store the same screenshot under both when they differ (redirects/forwards).
   *
   * @param {number} tabId
   * @param {number|undefined} windowId
   */
  async _captureTab(tabId, windowId) {
    /** @type {chrome.tabs.Tab|null} */
    let tab = null;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      this._clearNavSession(tabId);
      return;
    }
    if (!tab || tab.incognito) {
      this._clearNavSession(tabId);
      return;
    }
    if (tab.active !== true) return;
    if (tab.status && tab.status !== 'complete') return;

    const liveUrl = tab.url || '';
    if (!isScreenshotableUrl(liveUrl)) return;
    const liveKey = normalizePageThumbKey(liveUrl);
    if (!liveKey) return;

    this._noteNavUrl(tabId, liveUrl);

    const session = this._getNavSessionSnapshot(tabId);
    /** @type {Set<string>} */
    const trail = new Set(session?.keys || []);
    trail.add(liveKey);
    if (session?.originKey) trail.add(session.originKey);
    /** @type {Map<string, string>} */
    const sources = new Map(session?.sources || []);
    sources.set(liveKey, liveUrl);
    if (session?.originKey) {
      sources.set(session.originKey, session.originUrl || session.originKey);
    }

    // Freshness: if final URL is recent, still backfill missing trail aliases
    // from the existing blob (no new captureVisibleTab).
    /** @type {import('./page-thumb-store.js').PageThumbRecord|null} */
    let existingLive = null;
    try {
      existingLive = await this.store.get(liveKey);
    } catch {
      existingLive = null;
    }

    const now = Date.now();
    const liveIsFresh =
      existingLive?.capturedAt &&
      now - existingLive.capturedAt >= 0 &&
      now - existingLive.capturedAt < PAGE_THUMB_RECAPTURE_AFTER_MS;

    /** @type {import('./page-thumb-store.js').PageThumbRecord|null} */
    let baseRecord = null;

    if (liveIsFresh && existingLive?.blob) {
      baseRecord = existingLive;
      try {
        await this.store.touchLastSeen(liveKey, now);
      } catch {
        // ignore
      }
    } else {
      const winId =
        typeof windowId === 'number'
          ? windowId
          : typeof tab.windowId === 'number'
            ? tab.windowId
            : chrome.windows.WINDOW_ID_CURRENT;

      /** @type {string} */
      let dataUrl;
      try {
        dataUrl = await chrome.tabs.captureVisibleTab(winId, {
          format: 'jpeg',
          quality: 50
        });
      } catch (e) {
        // Common when tab is not capturable (policy, discarded, etc.).
        console.debug('[PageThumb] captureVisibleTab failed:', e?.message || e);
        return;
      }
      if (!dataUrl || typeof dataUrl !== 'string') return;

      const encoded = await encodePageThumb(dataUrl);
      if (!encoded) return;

      /** @type {Set<string>} */
      let bookmarkKeys = new Set();
      try {
        bookmarkKeys = await this._getBookmarkKeys();
      } catch {
        bookmarkKeys = new Set();
      }

      baseRecord = {
        urlKey: liveKey,
        blob: encoded.blob,
        mime: encoded.mime,
        width: encoded.width,
        height: encoded.height,
        capturedAt: now,
        lastSeenAt: now,
        pinned: bookmarkKeys.has(liveKey),
        byteSize: encoded.blob.size || 0,
        sourceUrl: liveUrl
      };

      try {
        await this.store.put(baseRecord);
        this._invalidateHostIndex();
      } catch (e) {
        console.warn('[PageThumb] store put failed:', e?.message || e);
        return;
      }
    }

    if (!baseRecord?.blob) return;

    // Write the same pixels under every trail key (redirect sources + final).
    /** @type {Set<string>} */
    let bookmarkKeysForAlias = null;
    const aliasKeys = [...trail];
    for (const key of aliasKeys) {
      if (!key) continue;
      if (key === liveKey && !liveIsFresh) continue; // already wrote primary

      try {
        const existing = await this.store.get(key);
        if (existing?.capturedAt) {
          const age = now - existing.capturedAt;
          if (age >= 0 && age < PAGE_THUMB_RECAPTURE_AFTER_MS && existing.blob) {
            // Fresh alias already present.
            continue;
          }
        }

        if (!bookmarkKeysForAlias) {
          try {
            bookmarkKeysForAlias = await this._getBookmarkKeys();
          } catch {
            bookmarkKeysForAlias = new Set();
          }
        }

        const sourceUrl = sources.get(key) || key;
        /** @type {import('./page-thumb-store.js').PageThumbRecord} */
        const aliasRecord = {
          urlKey: key,
          blob: baseRecord.blob,
          mime: baseRecord.mime,
          width: baseRecord.width,
          height: baseRecord.height,
          capturedAt: baseRecord.capturedAt || now,
          lastSeenAt: now,
          pinned: bookmarkKeysForAlias.has(key),
          byteSize: baseRecord.byteSize || baseRecord.blob.size || 0,
          sourceUrl
        };
        await this.store.put(aliasRecord);

        // Durable map: requested/hop URL → final capture key (survives SW restarts).
        if (key !== liveKey) {
          await this.store.putRedirect({
            fromKey: key,
            toKey: liveKey,
            fromUrl: sourceUrl,
            toUrl: liveUrl,
            at: now
          });
        }
      } catch (e) {
        console.warn('[PageThumb] alias put failed:', key, e?.message || e);
      }
    }

    // Always record origin → final even if origin was already fresh as an alias.
    if (session?.originKey && session.originKey !== liveKey) {
      try {
        await this.store.putRedirect({
          fromKey: session.originKey,
          toKey: liveKey,
          fromUrl: session.originUrl || session.originKey,
          toUrl: liveUrl,
          at: now
        });
      } catch {
        // ignore
      }
    }

    this._invalidateHostIndex();
    // Session consumed for this settle; next top-level navigation starts a new one.
    this._clearNavSession(tabId);

    // Notify open UIs for final + aliases (best-effort).
    try {
      const p = chrome.runtime.sendMessage({
        type: 'KP_PAGE_THUMB_UPDATED',
        urlKey: liveKey,
        pageUrl: liveUrl,
        originKey: session?.originKey || null,
        aliasKeys: aliasKeys.filter((k) => k && k !== liveKey)
      });
      if (p && typeof p.then === 'function') {
        p.catch(() => {});
      }
    } catch {
      // no listeners
    }

    // Opportunistic GC after writes (throttled lightly via chain).
    try {
      await this.runGc();
    } catch (e) {
      console.warn('[PageThumb] post-write GC failed:', e?.message || e);
    }
  }

  async _onBookmarksChanged() {
    this._bookmarkKeys = null;
    this._bookmarkKeysAt = 0;
    try {
      await this.refreshBookmarkPins();
    } catch (e) {
      console.warn('[PageThumb] pin refresh failed:', e?.message || e);
    }
  }

  /**
   * @returns {Promise<Set<string>>}
   */
  async _getBookmarkKeys() {
    const now = Date.now();
    if (this._bookmarkKeys && now - this._bookmarkKeysAt < 60_000) {
      return this._bookmarkKeys;
    }
    const keys = await collectBookmarkUrlKeys();
    this._bookmarkKeys = keys;
    this._bookmarkKeysAt = now;
    return keys;
  }

  /**
   * Recompute pinned flags for all stored thumbs.
   */
  async refreshBookmarkPins() {
    const bookmarkKeys = await this._getBookmarkKeys();
    const all = await this.store.getAll();
    if (!all.length) return;

    /** @type {Map<string, boolean>} */
    const pinMap = new Map();
    for (const row of all) {
      if (!row?.urlKey) continue;
      pinMap.set(row.urlKey, bookmarkKeys.has(row.urlKey));
    }
    await this.store.applyPinMap(pinMap);
  }

  /**
   * Age + count + soft byte budget eviction.
   */
  async runGc() {
    const all = await this.store.getAll();
    if (!all.length) return;
    // Index may go stale if we delete anything below.
    this._invalidateHostIndex();

    const now = Date.now();
    /** @type {string[]} */
    const toDelete = [];

    // 1) Age out unpinned history.
    for (const row of all) {
      if (!row || row.pinned) continue;
      const seen = Number(row.lastSeenAt || row.capturedAt || 0);
      if (seen > 0 && now - seen > PAGE_THUMB_HISTORY_TTL_MS) {
        toDelete.push(row.urlKey);
      }
    }

    if (toDelete.length) {
      await this.store.deleteMany(toDelete);
    }

    // Reload after age deletes.
    let remaining = toDelete.length
      ? await this.store.getAll()
      : all.slice();

    const totalBytes = () =>
      remaining.reduce((sum, r) => sum + (Number(r.byteSize) || 0), 0);

    const dropOldestUnpinned = async (predicateExtra) => {
      const candidates = remaining
        .filter((r) => r && !r.pinned && (!predicateExtra || predicateExtra(r)))
        .sort(
          (a, b) =>
            (Number(a.lastSeenAt) || 0) - (Number(b.lastSeenAt) || 0)
        );
      if (!candidates.length) return false;
      const victim = candidates[0];
      await this.store.delete(victim.urlKey);
      remaining = remaining.filter((r) => r.urlKey !== victim.urlKey);
      return true;
    };

    // 2) Count cap (unpinned only).
    while (remaining.length > PAGE_THUMB_MAX_ENTRIES) {
      // eslint-disable-next-line no-await-in-loop
      const dropped = await dropOldestUnpinned(null);
      if (!dropped) break;
    }

    // 3) Soft byte budget.
    while (totalBytes() > PAGE_THUMB_MAX_BYTES) {
      // eslint-disable-next-line no-await-in-loop
      const dropped = await dropOldestUnpinned(null);
      if (!dropped) break;
    }
  }
}

/** Singleton used by the service worker. */
export const pageThumbService = new PageThumbService();
