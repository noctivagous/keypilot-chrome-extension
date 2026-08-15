/**
 * Page-world (MAIN) bridge: pan Leaflet / MapLibre / Mapbox / Google Maps
 * via their map.panBy APIs.
 *
 * Loaded at document_start (world: MAIN) so it can hook L.Map / mapboxgl.Map
 * constructors before sites like openstreetmap.org hide the instance in a
 * closure. Also injectable on demand via chrome.scripting.executeScript.
 *
 * Isolated content scripts dispatch CustomEvent `__kp_map_pan_v1` on
 * document.documentElement with detail { dx, dy, clientX, clientY }.
 */
(function installKeyPilotMapPanBridge() {
  'use strict';

  try {
    if (window.__kpMapPanBridgeV1) return;
    window.__kpMapPanBridgeV1 = true;
  } catch {
    return;
  }

  const EVENT = '__kp_map_pan_v1';
  const RESULT = '__kp_map_pan_result_v1';

  /** @type {Array<{ map: any, engine: string }>} */
  const registry = [];
  /** @type {{ map: any, engine: string, el: Element }|null} */
  let cached = null;

  /**
   * Cross-origin Window / Location throw on named property reads (e.g. panBy).
   * @param {any} o
   * @returns {boolean}
   */
  function isUnsafeToInspect(o) {
    if (o == null) return true;
    const t = typeof o;
    if (t !== 'object' && t !== 'function') return true;
    try {
      if (o === window) return true;
    } catch {
      return true;
    }
    // WindowProxy (incl. cross-origin iframes): never a map instance.
    try {
      if (typeof Window === 'function' && o instanceof Window) return true;
    } catch {
      return true;
    }
    try {
      if (typeof Location === 'function' && o instanceof Location) return true;
    } catch {
      return true;
    }
    // Fallback probe when instanceof is unavailable / lies.
    try {
      if ('window' in o && o.window === o) return true;
    } catch {
      return true;
    }
    return false;
  }

  /**
   * @param {any} o
   * @param {string} name
   * @returns {boolean}
   */
  function hasFn(o, name) {
    try {
      return typeof o[name] === 'function';
    } catch {
      return false;
    }
  }

  /**
   * @param {any} map
   * @param {string} engine
   */
  function register(map, engine) {
    if (!map || isUnsafeToInspect(map) || !hasFn(map, 'panBy')) return;
    for (let i = 0; i < registry.length; i++) {
      if (registry[i].map === map) return;
    }
    registry.push({ map, engine });
  }

  /**
   * @param {any} o
   * @returns {string|null}
   */
  function detectEngine(o) {
    try {
      if (!o || typeof o !== 'object') return null;
      if (isUnsafeToInspect(o)) return null;
      if (!hasFn(o, 'panBy')) return null;

      if (hasFn(o, 'getDiv') && hasFn(o, 'getCenter')) {
        return 'google';
      }

      if (hasFn(o, 'getCanvas') && hasFn(o, 'project') && hasFn(o, 'getCenter')) {
        return 'mapbox';
      }

      let hasContainer = false;
      try {
        hasContainer = hasFn(o, 'getContainer') || !!(o && o._container);
      } catch {
        hasContainer = hasFn(o, 'getContainer');
      }
      if (
        hasFn(o, 'getCenter') &&
        hasContainer &&
        (o._leaflet_id != null || o._zoom != null || hasFn(o, 'latLngToLayerPoint'))
      ) {
        return 'leaflet';
      }

      if (hasFn(o, 'getCenter')) return 'generic';
      return null;
    } catch {
      return null;
    }
  }

  /**
   * @param {any} map
   * @param {string} engine
   * @returns {Element|null}
   */
  function getContainer(map, engine) {
    try {
      if (engine === 'google' && typeof map.getDiv === 'function') {
        const d = map.getDiv();
        return d && d.nodeType === 1 ? d : null;
      }
    } catch { /* ignore */ }
    try {
      if (typeof map.getContainer === 'function') {
        const c = map.getContainer();
        return c && c.nodeType === 1 ? c : null;
      }
    } catch { /* ignore */ }
    try {
      if (map._container && map._container.nodeType === 1) return map._container;
    } catch { /* ignore */ }
    try {
      if (typeof map.getCanvas === 'function') {
        const canvas = map.getCanvas();
        const host = canvas && canvas.parentElement;
        return host && host.nodeType === 1 ? host : (canvas && canvas.nodeType === 1 ? canvas : null);
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * @param {Element} el
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function containsPoint(el, x, y) {
    let r = null;
    try { r = el.getBoundingClientRect(); } catch { return false; }
    if (!r || r.width < 8 || r.height < 8) return false;
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  /** Hook Leaflet before / as sites construct maps (OSM keeps map in a closure). */
  function hookLeaflet() {
    try {
      const L = window.L;
      if (!L || !L.Map || typeof L.Map.addInitHook !== 'function') return false;
      if (L.Map.__kpPanHooked) return true;
      L.Map.__kpPanHooked = true;
      L.Map.addInitHook(function () {
        register(this, 'leaflet');
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wrap a Map constructor so instances are registered.
   * @param {string} globalName
   * @param {string} engine
   */
  function hookGlMapConstructor(globalName, engine) {
    try {
      const ns = window[globalName];
      if (!ns || typeof ns.Map !== 'function' || ns.Map.__kpPanHooked) {
        return !!(ns && ns.Map && ns.Map.__kpPanHooked);
      }
      const Orig = ns.Map;
      function WrappedMap(...args) {
        const map = new Orig(...args);
        register(map, engine);
        return map;
      }
      WrappedMap.prototype = Orig.prototype;
      try {
        Object.setPrototypeOf(WrappedMap, Orig);
      } catch { /* ignore */ }
      WrappedMap.__kpPanHooked = true;
      // Copy static props commonly read by apps
      try {
        for (const k of Object.getOwnPropertyNames(Orig)) {
          if (k === 'prototype' || k === 'length' || k === 'name') continue;
          try {
            const d = Object.getOwnPropertyDescriptor(Orig, k);
            if (d) Object.defineProperty(WrappedMap, k, d);
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      ns.Map = WrappedMap;
      return true;
    } catch {
      return false;
    }
  }

  function hookGoogleMaps() {
    try {
      const g = window.google && window.google.maps;
      if (!g || typeof g.Map !== 'function' || g.Map.__kpPanHooked) {
        return !!(g && g.Map && g.Map.__kpPanHooked);
      }
      const Orig = g.Map;
      function WrappedMap(...args) {
        const map = new Orig(...args);
        register(map, 'google');
        return map;
      }
      WrappedMap.prototype = Orig.prototype;
      try { Object.setPrototypeOf(WrappedMap, Orig); } catch { /* ignore */ }
      WrappedMap.__kpPanHooked = true;
      g.Map = WrappedMap;
      return true;
    } catch {
      return false;
    }
  }

  function tryHookAll() {
    hookLeaflet();
    hookGlMapConstructor('mapboxgl', 'mapbox');
    hookGlMapConstructor('maplibregl', 'mapbox');
    hookGoogleMaps();
  }

  tryHookAll();

  // Libraries often load after document_start — poll briefly, then occasionally.
  let polls = 0;
  const pollId = setInterval(() => {
    polls += 1;
    tryHookAll();
    if (polls >= 50) clearInterval(pollId); // ~10s at 200ms
  }, 200);

  /**
   * @param {any} map
   * @param {string} engine
   * @param {(m: any, e: string, el: Element) => void} add
   */
  function tryAdd(map, engine, add) {
    if (!map || !engine) return;
    const el = getContainer(map, engine);
    if (!el) return;
    add(map, engine, el);
  }

  /**
   * @returns {Array<{ map: any, engine: string, el: Element }>}
   */
  function collectMaps() {
    /** @type {Array<{ map: any, engine: string, el: Element }>} */
    const out = [];
    const seen = new Set();

    /**
     * @param {any} map
     * @param {string} engine
     * @param {Element} el
     */
    const add = (map, engine, el) => {
      if (!map || seen.has(map)) return;
      seen.add(map);
      out.push({ map, engine, el });
    };

    // Prefer constructor-hook registry (covers OSM and similar).
    for (let i = 0; i < registry.length; i++) {
      const rec = registry[i];
      tryAdd(rec.map, rec.engine, add);
    }

    const named = [
      'map',
      '_map',
      'leafletMap',
      'mapboxMap',
      'maplibreMap',
      'googleMap',
      'theMap',
      'MAP'
    ];
    for (let i = 0; i < named.length; i++) {
      try {
        const v = window[named[i]];
        const eng = detectEngine(v);
        if (eng) tryAdd(v, eng, add);
      } catch { /* ignore */ }
    }

    try {
      const osm = window.OSM;
      if (osm && osm.map) {
        const eng = detectEngine(osm.map) || 'leaflet';
        tryAdd(osm.map, eng, add);
      }
    } catch { /* ignore */ }

    try {
      const app = window.app;
      if (app && app.map) {
        const eng = detectEngine(app.map);
        if (eng) tryAdd(app.map, eng, add);
      }
    } catch { /* ignore */ }

    let keys = [];
    try { keys = Object.getOwnPropertyNames(window); } catch {
      try { keys = Object.keys(window); } catch { keys = []; }
    }
    const limit = Math.min(keys.length, 500);
    for (let i = 0; i < limit; i++) {
      const k = keys[i];
      if (!k || k.length > 64) continue;
      // Frame indexes / chrome internals — skip before property access.
      if (/^\d+$/.test(k)) continue;
      if (k.startsWith('webkit') || k.startsWith('chrome') || k.startsWith('__kp')) continue;
      let v = null;
      try { v = window[k]; } catch { continue; }
      if (!v || typeof v !== 'object') continue;
      try {
        const eng = detectEngine(v);
        if (eng) tryAdd(v, eng, add);
      } catch { /* cross-origin or exotic host object */ }
    }

    const nests = ['OSM', 'app', 'App', 'Maps', 'maps', 'page', 'state', 'store'];
    for (let n = 0; n < nests.length; n++) {
      let root = null;
      try { root = window[nests[n]]; } catch { root = null; }
      if (!root || typeof root !== 'object') continue;
      let nestedKeys = [];
      try { nestedKeys = Object.keys(root); } catch { nestedKeys = []; }
      for (let j = 0; j < Math.min(nestedKeys.length, 80); j++) {
        let v = null;
        try { v = root[nestedKeys[j]]; } catch { continue; }
        const eng = detectEngine(v);
        if (eng) tryAdd(v, eng, add);
      }
    }

    return out;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {{ map: any, engine: string, el: Element }|null}
   */
  function resolveMap(x, y) {
    if (cached && cached.map && cached.el) {
      try {
        if (cached.el.isConnected !== false && containsPoint(cached.el, x, y)) {
          return cached;
        }
      } catch { /* re-resolve */ }
    }

    const all = collectMaps();
    let best = null;
    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      if (containsPoint(c.el, x, y)) {
        best = c;
        break;
      }
    }
    if (!best && all.length === 1) best = all[0];
    if (!best && all.length > 1) {
      let area = 0;
      for (let i = 0; i < all.length; i++) {
        let r = null;
        try { r = all[i].el.getBoundingClientRect(); } catch { r = null; }
        const a = r ? r.width * r.height : 0;
        if (a > area) {
          area = a;
          best = all[i];
        }
      }
    }

    cached = best;
    return best;
  }

  /**
   * @param {any} map
   * @param {string} engine
   * @param {number} dx
   * @param {number} dy
   * @returns {boolean}
   */
  function panMap(map, engine, dx, dy) {
    const x = Number(dx) || 0;
    const y = Number(dy) || 0;
    if (!x && !y) return true;

    try {
      if (engine === 'leaflet') {
        map.panBy([x, y], { animate: false, duration: 0 });
        return true;
      }
      if (engine === 'mapbox') {
        map.panBy([x, y], { animate: false });
        return true;
      }
      if (engine === 'google') {
        map.panBy(x, y);
        return true;
      }
      try {
        map.panBy([x, y], { animate: false });
        return true;
      } catch {
        map.panBy(x, y);
        return true;
      }
    } catch {
      return false;
    }
  }

  // --- Continuous synthetic drag (Google Maps consumer, etc.) ---
  // Same approach as SanJJ1/gMapZoomShortcut: hold one pointerdown, move with
  // buttons:1, ignore setPointerCapture for our pointerId so Maps cannot steal
  // the gesture. Scroll Line still aims with the *real* mouse — those events
  // must not reach Maps or they cancel / override the held drag.
  // SanJJ1/gMapZoomShortcut: Maps accepts this id and ignores others we tried.
  const POINTER_ID = 10088;
  const SESSION_START = '__kp_map_session_start_v1';
  const SESSION_END = '__kp_map_session_end_v1';

  /** @type {'none'|'panby'|'drag'} */
  let sessionMode = 'none';
  /** @type {{ map: any, engine: string, el: Element }|null} */
  let sessionPanTarget = null;
  /** @type {Element|null} */
  let dragTarget = null;
  let dragX = 0;
  let dragY = 0;
  let dragActive = false;
  let sessionArmX = 0;
  let sessionArmY = 0;
  let accX = 0;
  let accY = 0;

  /**
   * maps.google.com / bing / brave do not expose a stable map.panBy instance.
   * Force the gMapZoomShortcut held-drag path instead of a no-op panBy hit.
   * @returns {boolean}
   */
  function preferPointerDrag() {
    try {
      const h = String(location.hostname || '').toLowerCase();
      const p = String(location.pathname || '').toLowerCase();
      if (h === 'maps.google.com' || h.startsWith('maps.google.')) return true;
      if (h.includes('google.') && (p === '/maps' || p.startsWith('/maps/') || p.startsWith('/maps?'))) {
        return true;
      }
      if (h.includes('bing.com') && p.includes('/maps')) return true;
      if (h.includes('brave.com') && p.includes('/maps')) return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * @param {Event} ev
   * @returns {boolean}
   */
  function isOurSyntheticPointer(ev) {
    if (!ev) return false;
    try {
      if (Number(ev.pointerId) === POINTER_ID) return true;
    } catch { /* ignore */ }
    try {
      if (Number(ev.detail) === 88) return true;
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Drop the user's aiming mouse from the page world while we hold a drag.
   * Isolated-world KeyPilot still receives the same events (separate listener
   * list) so lastMouse / Scroll Line aiming keep working.
   * @param {Event} ev
   */
  function swallowForeignPointer(ev) {
    if (!dragActive) return;
    // Only hide the user's aiming mouse. Untrusted events are ours —
    // mousedown/up use detail:1 so they must not be treated as foreign.
    if (!ev || ev.isTrusted !== true) return;
    if (isOurSyntheticPointer(ev)) return;
    try { ev.stopImmediatePropagation(); } catch { /* ignore */ }
    try { ev.preventDefault(); } catch { /* ignore */ }
  }

  try {
    const swallowTypes = [
      'pointermove', 'pointerdown', 'pointerup', 'pointercancel',
      'mousemove', 'mousedown', 'mouseup', 'click', 'dblclick'
    ];
    for (let i = 0; i < swallowTypes.length; i++) {
      window.addEventListener(swallowTypes[i], swallowForeignPointer, true);
    }
  } catch { /* ignore */ }

  try {
    if (!Element.prototype.__kpMapPanCapturePatched) {
      Element.prototype.__kpMapPanCapturePatched = true;
      const origSet = Element.prototype.setPointerCapture;
      Element.prototype.setPointerCapture = function (id) {
        if (id === POINTER_ID) return;
        return origSet.call(this, id);
      };
      const origRelease = Element.prototype.releasePointerCapture;
      Element.prototype.releasePointerCapture = function (id) {
        if (id === POINTER_ID) return;
        return origRelease.call(this, id);
      };
    }
  } catch { /* ignore */ }

  /**
   * @returns {Element|null}
   */
  function findDragCanvas(clientX, clientY) {
    /**
     * @param {Element|null} el
     * @returns {boolean}
     */
    const isLiveCanvas = (el) => {
      if (!el || el.nodeType !== 1) return false;
      if (String(el.tagName || '').toUpperCase() !== 'CANVAS') return false;
      let pe = '';
      try { pe = String(window.getComputedStyle(el).pointerEvents || ''); } catch { pe = ''; }
      if (pe === 'none') return false;
      let r = null;
      try { r = el.getBoundingClientRect(); } catch { r = null; }
      return !!(r && r.width >= 80 && r.height >= 80);
    };

    // gMapZoomShortcut: first canvas in DOM order. Google Maps stacks a
    // same-size overlay canvas on top; elementsFromPoint hits the overlay
    // and the held drag is ignored.
    try {
      const named = document.querySelector(
        'canvas.widget-scene-canvas, canvas.maplibregl-canvas, canvas.mapboxgl-canvas'
      );
      if (isLiveCanvas(named)) return named;
    } catch { /* ignore */ }

    try {
      const list = document.querySelectorAll('canvas');
      for (let i = 0; i < list.length; i++) {
        if (isLiveCanvas(list[i])) return list[i];
      }
    } catch { /* ignore */ }

    try {
      const stack = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(clientX, clientY)
        : [];
      for (let i = 0; i < stack.length; i++) {
        if (isLiveCanvas(stack[i])) return stack[i];
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * @param {Element} target
   * @param {string} mouseType
   * @param {string} pointerType
   * @param {object} opts
   */
  function dispatchPair(target, mouseType, pointerType, opts) {
    if (!target || typeof target.dispatchEvent !== 'function') return;
    // Match SanJJ1/gMapZoomShortcut event shape — extra fields (composed,
    // pointerType, movementX) have made Maps ignore the gesture.
    const isMove = pointerType === 'pointermove';
    const base = {
      bubbles: true,
      cancelable: !isMove,
      view: window,
      detail: isMove ? 88 : 1,
      button: 0,
      buttons: isMove || pointerType === 'pointerdown' ? 1 : 0,
      clientX: Number(opts.clientX) || 0,
      clientY: Number(opts.clientY) || 0
    };
    try {
      target.dispatchEvent(new MouseEvent(mouseType, base));
    } catch { /* ignore */ }
    try {
      target.dispatchEvent(new PointerEvent(pointerType, {
        pointerId: POINTER_ID,
        isPrimary: true,
        ...base
      }));
    } catch { /* ignore */ }
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  function startPointerDrag(clientX, clientY) {
    endPointerDrag();
    const target = findDragCanvas(clientX, clientY);
    if (!target) return false;

    let x = clientX;
    let y = clientY;
    try {
      const r = target.getBoundingClientRect();
      if (r && r.width > 8 && r.height > 8) {
        // Grab near canvas center — away from the real aiming cursor.
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
    } catch { /* ignore */ }

    dragTarget = target;
    dragX = x;
    dragY = y;
    dragActive = true;
    accX = 0;
    accY = 0;

    dispatchPair(target, 'mousedown', 'pointerdown', {
      detail: 1,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1
    });
    return true;
  }

  /**
   * @param {number} dx
   * @param {number} dy
   */
  function movePointerDrag(dx, dy) {
    if (!dragActive || !dragTarget) return false;
    accX += Number(dx) || 0;
    accY += Number(dy) || 0;
    // Maps ignores sub-pixel moves; gMapZoomShortcut steps ≥6px/frame.
    const ax = accX >= 0 ? Math.floor(accX) : Math.ceil(accX);
    const ay = accY >= 0 ? Math.floor(accY) : Math.ceil(accY);
    if (!ax && !ay) return true;
    accX -= ax;
    accY -= ay;

    dragX += ax;
    dragY += ay;

    try {
      const r = dragTarget.getBoundingClientRect();
      if (r && r.width > 32 && r.height > 32) {
        const pad = 24;
        const out =
          dragX < r.left + pad ||
          dragX > r.right - pad ||
          dragY < r.top + pad ||
          dragY > r.bottom - pad;
        if (out) {
          dragX = r.left + r.width / 2;
          dragY = r.top + r.height / 2;
        } else {
          dragX = Math.min(r.right - pad, Math.max(r.left + pad, dragX));
          dragY = Math.min(r.bottom - pad, Math.max(r.top + pad, dragY));
        }
      }
    } catch { /* ignore */ }

    dispatchPair(dragTarget, 'mousemove', 'pointermove', {
      detail: 88,
      clientX: dragX,
      clientY: dragY,
      movementX: ax,
      movementY: ay,
      button: 0,
      buttons: 1
    });
    return true;
  }

  function endPointerDrag() {
    if (!dragActive || !dragTarget) {
      dragActive = false;
      dragTarget = null;
      accX = 0;
      accY = 0;
      return;
    }
    const target = dragTarget;
    const x = dragX;
    const y = dragY;

    dispatchPair(target, 'mousemove', 'pointermove', {
      detail: 88,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1
    });
    dispatchPair(target, 'mouseup', 'pointerup', {
      detail: 1,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 0
    });

    dragActive = false;
    dragTarget = null;
    accX = 0;
    accY = 0;
  }

  /**
   * @param {CustomEvent} ev
   */
  function onSessionStart(ev) {
    const detail = (ev && ev.detail) || {};
    const cx = Number(detail.clientX);
    const cy = Number(detail.clientY);
    const x = Number.isFinite(cx) ? cx : (window.innerWidth || 0) / 2;
    const y = Number.isFinite(cy) ? cy : (window.innerHeight || 0) / 2;

    endPointerDrag();
    sessionMode = 'none';
    sessionPanTarget = null;
    tryHookAll();

    if (!preferPointerDrag()) {
      const hit = resolveMap(x, y);
      if (hit) {
        sessionMode = 'panby';
        sessionPanTarget = hit;
        emitResult(true, hit.engine, 'panby');
        return;
      }
    }

    // Arm pointer-drag mode but do not pointerdown until the first pan delta —
    // avoids dismissing Scroll Line popover chrome on enter.
    sessionMode = 'drag';
    sessionArmX = x;
    sessionArmY = y;
    emitResult(true, 'pointer-drag', 'drag');
  }

  function onSessionEnd() {
    endPointerDrag();
    sessionMode = 'none';
    sessionPanTarget = null;
  }

  /**
   * @param {boolean} ok
   * @param {string} engine
   * @param {string} [mode]
   */
  function emitResult(ok, engine, mode) {
    try {
      document.documentElement.dispatchEvent(new CustomEvent(RESULT, {
        bubbles: true,
        detail: { ok, engine, mode: mode || sessionMode }
      }));
    } catch { /* ignore */ }
  }

  /**
   * @param {CustomEvent} ev
   */
  function onPan(ev) {
    const detail = ev && ev.detail;
    if (!detail) return;
    const dx = Number(detail.dx) || 0;
    const dy = Number(detail.dy) || 0;
    if (!dx && !dy) return;

    tryHookAll();

    const cx = Number(detail.clientX);
    const cy = Number(detail.clientY);
    const x = Number.isFinite(cx) ? cx : (window.innerWidth || 0) / 2;
    const y = Number.isFinite(cy) ? cy : (window.innerHeight || 0) / 2;

    // Lazy session: first pan without start still tries panBy then drag.
    if (sessionMode === 'none') {
      const hit = preferPointerDrag() ? null : resolveMap(x, y);
      if (hit) {
        sessionMode = 'panby';
        sessionPanTarget = hit;
      } else {
        sessionMode = 'drag';
        sessionArmX = x;
        sessionArmY = y;
      }
    }

    let ok = false;
    let engine = '';

    if (sessionMode === 'panby' && sessionPanTarget) {
      ok = panMap(sessionPanTarget.map, sessionPanTarget.engine, dx, dy);
      engine = sessionPanTarget.engine;
      if (!ok) {
        cached = null;
        sessionPanTarget = null;
        sessionMode = 'drag';
        sessionArmX = x;
        sessionArmY = y;
      }
    }

    if (sessionMode === 'drag') {
      if (!dragActive) {
        if (!startPointerDrag(sessionArmX || x, sessionArmY || y)) {
          emitResult(false, '');
          return;
        }
      }
      // Drag follows the pointer: move opposite the look direction
      // (gMapZoomShortcut: h/look-left adds +dx).
      ok = movePointerDrag(-dx, -dy);
      engine = 'pointer-drag';
      if (!ok) {
        sessionMode = 'none';
        endPointerDrag();
      }
    }

    emitResult(ok, engine);
  }

  const root = document.documentElement || document;
  root.addEventListener(EVENT, onPan, true);
  root.addEventListener(SESSION_START, onSessionStart, true);
  root.addEventListener(SESSION_END, onSessionEnd, true);
})();
