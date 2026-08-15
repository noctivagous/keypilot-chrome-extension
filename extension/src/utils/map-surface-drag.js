/**
 * Map surfaces (Leaflet / MapLibre / Mapbox / Google) do not scroll with
 * overflow — they pan via map.panBy in the page's JS world.
 *
 * Detection runs in the isolated content script. Panning is done by a
 * MAIN-world bridge (map-pan-bridge.js) injected once per frame via the
 * service worker, then driven with CustomEvent `__kp_map_pan_v1`.
 */

import { MSG } from '../messaging/types.js';

const MAP_SURFACE_SEL = [
  '.leaflet-container',
  '.leaflet-grab',
  '.maplibregl-map',
  '.maplibregl-canvas',
  '.mapboxgl-map',
  '.mapboxgl-canvas',
  '.gm-style',
  'canvas.maplibregl-canvas',
  'canvas.mapboxgl-canvas',
  'canvas[aria-label="Map" i]',
  'canvas[aria-label*="Map" i]'
].join(',');

const PAN_EVENT = '__kp_map_pan_v1';
const SESSION_START = '__kp_map_session_start_v1';
const SESSION_END = '__kp_map_session_end_v1';

/** Must match POINTER_ID in map-pan-bridge.js (gMapZoomShortcut uses 10088). */
export const MAP_PAN_POINTER_ID = 10088;

/** Scroll Line map-drag is suspended — Google / canvas maps do not pan reliably. */
export const SCROLL_LINE_MAP_DRAG_ENABLED = false;

/** @type {Promise<boolean>|null} */
let _bridgePromise = null;

/**
 * @param {string} [hostname]
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function hostLooksLikeMapsSite(hostname = '', pathname = '') {
  const h = String(hostname || '').toLowerCase();
  const p = String(pathname || '').toLowerCase();
  if (h.includes('openstreetmap.org')) return true;
  if (h.includes('openstreetmap.de')) return true;
  if (h.includes('bing.com') && p.includes('/maps')) return true;
  if (h === 'maps.google.com' || h.startsWith('maps.google.')) return true;
  if (h.includes('google.') && (p === '/maps' || p.startsWith('/maps/') || p.startsWith('/maps?'))) {
    return true;
  }
  if (h.includes('brave.com') && p.includes('/maps')) return true;
  if (h.includes('mapbox.com')) return true;
  return false;
}

/**
 * True on Google / Bing / Brave / OSM / Mapbox map pages.
 * Also available as `window.isOnMapWebsite` once KeyPilot loads.
 * @param {string} [hostname]
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function isOnMapWebsite(hostname, pathname) {
  let h = hostname;
  let p = pathname;
  if (h == null || p == null) {
    try {
      h = h ?? location.hostname;
      p = p ?? location.pathname;
    } catch {
      return false;
    }
  }
  return hostLooksLikeMapsSite(h, p);
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
export function elementLooksLikeMapSurface(el) {
  if (!el || el.nodeType !== 1) return false;
  let cls = '';
  try { cls = String(el.className || ''); } catch { cls = ''; }
  const tag = String(el.tagName || '').toUpperCase();
  if (/\bleaflet-container\b|\bleaflet-grab\b/.test(cls)) return true;
  if (/\bmaplibregl-(?:map|canvas)\b/.test(cls)) return true;
  if (/\bmapboxgl-(?:map|canvas)\b/.test(cls)) return true;
  if (/\bgm-style\b/.test(cls)) return true;

  if (tag === 'CANVAS') {
    let pcls = '';
    try { pcls = String(el.parentElement?.className || ''); } catch { pcls = ''; }
    if (/maplibregl|mapboxgl|gm-style|leaflet|widget-scene/.test(`${cls} ${pcls}`)) return true;
    let label = '';
    try { label = String(el.getAttribute('aria-label') || '').toLowerCase(); } catch { label = ''; }
    if (label === 'map' || /\bmap\b/.test(label)) return true;
  }

  let role = '';
  let id = '';
  try { role = String(el.getAttribute('role') || '').toLowerCase(); } catch { role = ''; }
  try { id = String(el.id || ''); } catch { id = ''; }
  if (role === 'application' && /map/i.test(`${cls} ${id}`)) return true;
  return false;
}

/**
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
function isMapUiChrome(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    if (typeof el.closest === 'function') {
      const chrome = el.closest(
        'button, a[href], input, select, textarea, [role="button"], [role="search"], [role="dialog"]'
      );
      if (chrome) return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * Deepest map surface under a viewport point, or a host-known map box
 * that contains the point.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {Element|null}
 */
export function findMapSurfaceAtPoint(clientX, clientY) {
  const x = Number(clientX);
  const y = Number(clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  let start = null;
  try { start = document.elementFromPoint(x, y); } catch { start = null; }
  if (start && start.nodeType !== 1) {
    try { start = start.parentElement; } catch { start = null; }
  }

  let n = start;
  let depth = 0;
  while (n && n.nodeType === 1 && depth++ < 18) {
    if (elementLooksLikeMapSurface(n) && !isMapUiChrome(n)) return n;
    if (elementLooksLikeMapSurface(n)) {
      // Clicked a control stacked on the map — still treat the surface as the target.
      return n;
    }
    try { n = n.parentElement; } catch { n = null; }
  }

  if (!hostLooksLikeMapsSite(location.hostname, location.pathname)) return null;

  try {
    const stack = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(x, y)
      : [];
    for (let i = 0; i < stack.length; i++) {
      const el = stack[i];
      if (!el || el.nodeType !== 1) continue;
      if (String(el.tagName || '').toUpperCase() !== 'CANVAS') continue;
      let pe = '';
      try { pe = String(window.getComputedStyle(el).pointerEvents || ''); } catch { pe = ''; }
      if (pe === 'none') continue;
      let r = null;
      try { r = el.getBoundingClientRect(); } catch { r = null; }
      if (r && r.width > 200 && r.height > 200) return el;
    }
  } catch { /* ignore */ }

  let nodes = [];
  try { nodes = Array.from(document.querySelectorAll(MAP_SURFACE_SEL)); } catch { nodes = []; }
  if (!nodes.length) {
    try {
      const named = document.getElementById('map');
      if (named) nodes = [named];
    } catch { /* ignore */ }
  }

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (!el || el.nodeType !== 1) continue;
    let r = null;
    try { r = el.getBoundingClientRect(); } catch { r = null; }
    if (!r || r.width < 120 || r.height < 120) continue;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    return el;
  }
  return null;
}

/**
 * Ensure the MAIN-world pan bridge is installed in this frame.
 * Safe to call repeatedly; only one inject runs.
 * @returns {Promise<boolean>}
 */
export function ensureMapPanBridge() {
  if (_bridgePromise) return _bridgePromise;

  _bridgePromise = new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        resolve(false);
        return;
      }
      chrome.runtime.sendMessage(
        { type: MSG.ENSURE_MAP_PAN_BRIDGE },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            _bridgePromise = null;
            resolve(false);
            return;
          }
          resolve(!!(response && response.ok));
        }
      );
    } catch {
      _bridgePromise = null;
      resolve(false);
    }
  });

  return _bridgePromise;
}

/**
 * @param {string} type
 * @param {Record<string, any>} [detail]
 */
function dispatchBridgeEvent(type, detail = {}) {
  try {
    document.documentElement.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      detail
    }));
  } catch { /* ignore */ }
}

/**
 * @param {Element} el
 * @param {number} originX
 * @param {number} originY
 * @returns {{ el: Element, x: number, y: number }}
 */
export function createMapPanSession(el, originX, originY) {
  ensureMapPanBridge();
  const x = Number(originX) || 0;
  const y = Number(originY) || 0;
  dispatchBridgeEvent(SESSION_START, { clientX: x, clientY: y });
  return { el, x, y };
}

/**
 * End a map pan/drag session (release held pointer drag on Google Maps).
 */
export function endMapPanSession() {
  dispatchBridgeEvent(SESSION_END);
}

/**
 * Pan the page-world map under the session origin by (dx, dy) pixels.
 * Uses map.panBy when available; otherwise continues a held pointer drag
 * (needed for maps.google.com).
 * @param {{ el: Element, x: number, y: number }} session
 * @param {number} dx
 * @param {number} dy
 */
export function mapPanBy(session, dx, dy) {
  if (!session) return;
  const ax = Number(dx) || 0;
  const ay = Number(dy) || 0;
  if (!ax && !ay) return;

  ensureMapPanBridge();

  dispatchBridgeEvent(PAN_EVENT, {
    dx: ax,
    dy: ay,
    clientX: session.x,
    clientY: session.y
  });
}

// Back-compat aliases used during the synthetic-drag experiment.
export const createMapDragSession = createMapPanSession;
export const mapDragPulse = mapPanBy;
