/**
 * Resolve a map place-of-interest website URL from the page DOM
 * (Google / Bing / Brave / OSM / Leaflet popups).
 */

export { isOnMapWebsite } from './map-surface-drag.js';

const MAPS_HOST_RE = /(?:^|\.)(?:google|gstatic|googleapis|googleusercontent|ggpht|gvt1|youtube|blogger|bing|microsoft|live|msn|brave|search\.brave|openstreetmap|osm)\./i;

/**
 * @param {string} href
 * @returns {string}
 */
export function unwrapMapsRedirect(href) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw, location.href);
    if (/google\./i.test(u.hostname) && (u.pathname === '/url' || u.pathname === '/url/')) {
      const q = u.searchParams.get('q') || u.searchParams.get('url');
      if (q) return unwrapMapsRedirect(q);
    }
    if (/bing\./i.test(u.hostname) && /\/ck\/a/i.test(u.pathname)) {
      const u2 = u.searchParams.get('u') || u.searchParams.get('url');
      if (u2) return unwrapMapsRedirect(u2);
    }
    return u.href;
  } catch {
    return raw;
  }
}

/**
 * @param {string} href
 * @returns {boolean}
 */
export function isExternalPoiWebsite(href) {
  const unwrapped = unwrapMapsRedirect(href);
  if (!unwrapped) return false;
  let u = null;
  try { u = new URL(unwrapped, location.href); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = String(u.hostname || '').toLowerCase();
  if (!host) return false;
  if (MAPS_HOST_RE.test(host + '.')) {
    // google.com/maps, bing maps, osm.org browse — not a POI site
    return false;
  }
  try {
    if (host === String(location.hostname || '').toLowerCase()) return false;
  } catch { /* ignore */ }
  return true;
}

/**
 * @param {Element|Document|null|undefined} root
 * @returns {string|null}
 */
export function findPoiWebsiteInRoot(root) {
  if (!root) return null;
  /** @type {ParentNode} */
  const scope = /** @type {any} */ (root);

  const prefer = [];
  try {
    prefer.push(
      ...scope.querySelectorAll(
        'a[data-item-id="authority"], a[aria-label^="Website" i], a[aria-label="Open website" i], a[data-tooltip="Open website" i]'
      )
    );
  } catch { /* ignore */ }

  for (let i = 0; i < prefer.length; i++) {
    const a = prefer[i];
    const href = unwrapMapsRedirect(a && a.href);
    if (isExternalPoiWebsite(href)) return href;
  }

  let links = [];
  try { links = Array.from(scope.querySelectorAll('a[href]')); } catch { links = []; }
  for (let i = 0; i < links.length; i++) {
    const a = links[i];
    const href = unwrapMapsRedirect(a && a.href);
    if (!isExternalPoiWebsite(href)) continue;
    let aria = '';
    let tip = '';
    let text = '';
    try { aria = String(a.getAttribute('aria-label') || ''); } catch { /* ignore */ }
    try { tip = String(a.getAttribute('data-tooltip') || a.getAttribute('title') || ''); } catch { /* ignore */ }
    try { text = String(a.textContent || '').replace(/\s+/g, ' ').trim(); } catch { /* ignore */ }
    const blob = `${aria} ${tip} ${text}`.toLowerCase();
    if (/\bwebsite\b|\bofficial site\b|\bopen website\b/.test(blob)) return href;
    if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(text)) return href;
  }

  return null;
}

/**
 * @returns {string|null}
 */
export function findPoiWebsiteInDocument() {
  const roots = [];
  try {
    const main = document.querySelector('[role="main"]');
    if (main) roots.push(main);
  } catch { /* ignore */ }
  try {
    const popup = document.querySelector(
      '.leaflet-popup-content, .leaflet-popup, .maplibregl-popup-content, .mapboxgl-popup-content'
    );
    if (popup) roots.push(popup);
  } catch { /* ignore */ }
  try {
    const side = document.querySelector('#sidebar_content, #sidebar, .sidebar');
    if (side) roots.push(side);
  } catch { /* ignore */ }
  for (let i = 0; i < roots.length; i++) {
    const url = findPoiWebsiteInRoot(roots[i]);
    if (url) return url;
  }
  try {
    return findPoiWebsiteInRoot(document);
  } catch {
    return null;
  }
}

/**
 * Website on the card / popup / details pane under a viewport point.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {string|null}
 */
export function findPoiWebsiteAtPoint(clientX, clientY) {
  const x = Number(clientX);
  const y = Number(clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let el = null;
  try { el = document.elementFromPoint(x, y); } catch { el = null; }
  if (el && el.nodeType !== 1) {
    try { el = el.parentElement; } catch { el = null; }
  }
  if (!el) return null;

  let n = el;
  let depth = 0;
  while (n && n.nodeType === 1 && depth++ < 16) {
    let role = '';
    try { role = String(n.getAttribute('role') || '').toLowerCase(); } catch { role = ''; }
    let cls = '';
    try { cls = String(n.className || ''); } catch { cls = ''; }
    const tag = String(n.tagName || '').toUpperCase();
    const isCard =
      role === 'main' ||
      role === 'article' ||
      role === 'dialog' ||
      /leaflet-popup|maplibregl-popup|mapboxgl-popup|section-layout|widget-pane/.test(cls) ||
      (tag === 'A' && /\/maps\/place\//i.test(String(n.href || '')));
    if (isCard) {
      const url = findPoiWebsiteInRoot(n);
      if (url) return url;
    }
    try { n = n.parentElement; } catch { n = null; }
  }

  return null;
}

/**
 * Search-box Close (Google Maps `omnibox.clear`) — dismisses the place pane.
 * @param {Document} [doc]
 * @returns {Element|null}
 */
export function findMapsPlacePanelCloseButton(doc = document) {
  let nodes = [];
  try {
    nodes = Array.from(doc.querySelectorAll('button, [role="button"]'));
  } catch {
    return null;
  }
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (!el || el.nodeType !== 1) continue;
    let jsaction = '';
    try { jsaction = String(el.getAttribute('jsaction') || ''); } catch { jsaction = ''; }
    if (/omnibox\.clear/i.test(jsaction)) {
      let r = null;
      try { r = el.getBoundingClientRect(); } catch { r = null; }
      if (r && r.width > 4 && r.height > 4) return el;
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (!el || el.nodeType !== 1) continue;
    let aria = '';
    try { aria = String(el.getAttribute('aria-label') || '').trim(); } catch { aria = ''; }
    if (!/^close$/i.test(aria)) continue;
    let inSearch = false;
    try {
      inSearch = !!(el.closest && el.closest('form, [role="search"]'));
    } catch { inSearch = false; }
    if (!inSearch) continue;
    let r = null;
    try { r = el.getBoundingClientRect(); } catch { r = null; }
    if (r && r.width > 4 && r.height > 4) return el;
  }
  return null;
}

/**
 * @param {{ timeoutMs?: number, intervalMs?: number, ignoreUrl?: string|null }} [opts]
 * @returns {Promise<string|null>}
 */
export function waitForPoiWebsite(opts = {}) {
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 2800;
  const intervalMs = Number(opts.intervalMs) > 0 ? Number(opts.intervalMs) : 120;
  const ignore = String(opts.ignoreUrl || '').trim();
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const url = findPoiWebsiteInDocument() || findPoiWebsiteInRoot(document);
      if (url && url !== ignore) {
        resolve(url);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(url && url !== ignore ? url : null);
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}
