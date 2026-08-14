/**
 * Image / media utilities for KeyPilot.
 *
 * Designed as reusable helpers (not clipboard-tied). First consumer is the
 * I-key (COPY_HOVERED_IMAGE) which copies the result to the clipboard.
 *
 * Sources supported:
 * - <img> (including src pointing at .svg)
 * - CSS background-image url(...)
 * - Inline <svg> (hit on svg or any descendant path/g/etc.)
 * - <video> poster (when never played) or current/paused frame
 */

/** Max ancestor walk when searching for img / svg / background-image. */
const MAX_ANCESTOR_DEPTH = 12;

/** Fetch / decode timeout for materializing remote images. */
const MATERIALIZE_TIMEOUT_MS = 8000;

/** Max canvas edge when rasterizing SVG (avoids huge allocations). */
const MAX_SVG_RASTER_EDGE = 4096;

/**
 * @typedef {'img'|'background'|'svg'|'video'} HoveredImageKind
 *
 * @typedef {{
 *   kind: HoveredImageKind,
 *   element: Element,
 *   url: string|null
 * }} HoveredImageSource
 *
 * @typedef {{
 *   kind: HoveredImageKind,
 *   element: Element,
 *   url: string|null,
 *   blob: Blob,
 *   mimeType: string
 * }} HoveredImageResult
 */

/**
 * Shadow-DOM–aware elementFromPoint (mirrors ElementDetector.deepElementFromPoint).
 * @param {number} x
 * @param {number} y
 * @returns {Element|null}
 */
export function deepElementFromPoint(x, y) {
  let el = null;
  try {
    el = document.elementFromPoint(x, y);
  } catch {
    return null;
  }
  let guard = 0;
  while (el && el.shadowRoot && guard++ < 10) {
    let nested = null;
    try {
      nested = el.shadowRoot.elementFromPoint(x, y);
    } catch {
      break;
    }
    if (!nested || nested === el) break;
    el = nested;
  }
  return el;
}

/**
 * True when a node looks like KeyPilot-injected UI (should not count as page media).
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
function isKeyPilotChrome(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    const id = typeof el.id === 'string' ? el.id : '';
    if (id && (id === 'kpv2-cursor' || id.startsWith('kpv2-'))) return true;
  } catch { /* ignore */ }
  try {
    const cls = typeof el.className === 'string'
      ? el.className
      : (el.className && typeof el.className.baseVal === 'string' ? el.className.baseVal : '');
    if (cls && (/\bkpv2-/.test(cls) || /\bkp-/.test(cls))) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * @param {Element|null|undefined} el
 * @returns {el is HTMLImageElement}
 */
function isHtmlImage(el) {
  return !!(el && el.nodeType === 1 && el.tagName === 'IMG');
}

/**
 * @param {Element|null|undefined} el
 * @returns {el is HTMLVideoElement}
 */
export function isHtmlVideo(el) {
  return !!(el && el.nodeType === 1 && String(el.tagName || '').toUpperCase() === 'VIDEO');
}

/**
 * Resolved poster URL for a <video>, or ''.
 * @param {HTMLVideoElement} video
 * @returns {string}
 */
export function getVideoPosterUrl(video) {
  if (!video) return '';
  try {
    const poster = (typeof video.poster === 'string' && video.poster) ? video.poster.trim() : '';
    if (isUsableImageUrl(poster)) return resolveUrl(poster, video);
  } catch { /* ignore */ }
  try {
    const attr = (video.getAttribute && video.getAttribute('poster')) || '';
    const trimmed = String(attr || '').trim();
    if (isUsableImageUrl(trimmed)) return resolveUrl(trimmed, video);
  } catch { /* ignore */ }
  return '';
}

/**
 * True when the video has a decoded frame we can draw to canvas.
 * @param {HTMLVideoElement} video
 * @returns {boolean}
 */
export function videoHasDrawableFrame(video) {
  if (!video) return false;
  try {
    // HAVE_CURRENT_DATA === 2
    const ready = typeof video.readyState === 'number' ? video.readyState : 0;
    const w = Number(video.videoWidth) || 0;
    const h = Number(video.videoHeight) || 0;
    return ready >= 2 && w > 0 && h > 0;
  } catch {
    return false;
  }
}

/**
 * Prefer poster when the element still shows the pre-playback thumbnail.
 * @param {HTMLVideoElement} video
 * @returns {boolean}
 */
function videoLikelyShowingPoster(video) {
  if (!video || !getVideoPosterUrl(video)) return false;
  try {
    // Never started playback → browser typically paints poster, not a frame.
    const played = video.played;
    const neverPlayed = !played || played.length === 0;
    if (neverPlayed && video.paused && !video.ended) return true;
  } catch { /* ignore */ }
  return !videoHasDrawableFrame(video);
}

/**
 * True when el is an <svg> root (SVGSVGElement).
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
function isSvgRoot(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    if (typeof SVGSVGElement !== 'undefined' && el instanceof SVGSVGElement) return true;
  } catch { /* ignore */ }
  return String(el.tagName || '').toLowerCase() === 'svg';
}

/**
 * Resolve the outermost <svg> for a hit target (path, g, use, etc.).
 * @param {Element|null|undefined} el
 * @returns {SVGSVGElement|Element|null}
 */
function getSvgRoot(el) {
  if (!el || el.nodeType !== 1) return null;
  if (isSvgRoot(el)) return el;

  // SVG geometry nodes expose ownerSVGElement → root <svg>.
  try {
    const owner = /** @type {any} */ (el).ownerSVGElement;
    if (owner && isSvgRoot(owner)) return owner;
  } catch { /* ignore */ }

  try {
    if (typeof el.closest === 'function') {
      const svg = el.closest('svg');
      if (svg) return svg;
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Best URL for an <img>. Prefer currentSrc (srcset-aware).
 * @param {HTMLImageElement} img
 * @returns {string}
 */
function getImgUrl(img) {
  try {
    const current = (typeof img.currentSrc === 'string' && img.currentSrc) ? img.currentSrc.trim() : '';
    if (current) return current;
  } catch { /* ignore */ }
  try {
    const src = (typeof img.src === 'string' && img.src) ? img.src.trim() : '';
    if (src) return src;
  } catch { /* ignore */ }
  try {
    const attr = (img.getAttribute && img.getAttribute('src')) || '';
    return String(attr || '').trim();
  } catch {
    return '';
  }
}

/**
 * Reject empty / trivial image URLs.
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
function isUsableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u || u === 'about:blank') return false;
  return true;
}

/**
 * Extract the first url(...) from a CSS background-image value.
 * Skips gradients and other non-url layers.
 * @param {string} cssValue
 * @returns {string|null}
 */
export function extractFirstBackgroundImageUrl(cssValue) {
  if (!cssValue || typeof cssValue !== 'string') return null;
  const value = cssValue.trim();
  if (!value || value === 'none') return null;

  const urlRe = /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let match;
  while ((match = urlRe.exec(value)) !== null) {
    const raw = (match[2] || '').trim();
    if (!raw) continue;
    if (/^(none|inherit|initial|unset|revert)$/i.test(raw)) continue;
    return raw;
  }
  return null;
}

/**
 * Resolve a possibly-relative CSS/image URL against the owner document.
 * @param {string} url
 * @param {Element} element
 * @returns {string}
 */
function resolveUrl(url, element) {
  if (!url) return '';
  if (/^(data:|blob:|https?:|chrome-extension:)/i.test(url)) return url;
  try {
    const base =
      (element && element.ownerDocument && element.ownerDocument.baseURI) ||
      (typeof document !== 'undefined' ? document.baseURI : '') ||
      '';
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/**
 * Next ancestor for walk (parentElement, or shadow host).
 * @param {Element} el
 * @returns {Element|null}
 */
function getParentOrHost(el) {
  let next = null;
  try {
    next = el.parentElement;
  } catch {
    next = null;
  }
  if (!next) {
    try {
      const root = el.getRootNode && el.getRootNode();
      if (root && /** @type {any} */ (root).host) next = /** @type {any} */ (root).host;
    } catch { /* ignore */ }
  }
  return next;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {DOMRect|ClientRect|{left:number,top:number,right:number,bottom:number,width:number,height:number}} rect
 * @returns {boolean}
 */
function pointInRect(x, y, rect) {
  if (!rect) return false;
  const w = Number(rect.width) || 0;
  const h = Number(rect.height) || 0;
  if (w < 1 || h < 1) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * @param {Element} el
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function elementContainsPoint(el, x, y) {
  try {
    return pointInRect(x, y, el.getBoundingClientRect());
  } catch {
    return false;
  }
}

/**
 * Source from a single element if it itself is an image/svg/background.
 * Does not search descendants.
 * @param {Element|null|undefined} el
 * @returns {HoveredImageSource|null}
 */
function sourceFromSelf(el) {
  if (!el || el.nodeType !== 1 || isKeyPilotChrome(el)) return null;

  if (isHtmlImage(el)) {
    const url = getImgUrl(/** @type {HTMLImageElement} */ (el));
    if (isUsableImageUrl(url)) {
      return { kind: 'img', element: el, url: resolveUrl(url, el) };
    }
  }

  if (isHtmlVideo(el)) {
    const video = /** @type {HTMLVideoElement} */ (el);
    const poster = getVideoPosterUrl(video);
    // Accept videos with a poster and/or a drawable frame (paused / loaded).
    if (poster || videoHasDrawableFrame(video)) {
      return {
        kind: 'video',
        element: el,
        url: poster || (typeof video.currentSrc === 'string' ? video.currentSrc : null)
      };
    }
  }

  if (isSvgRoot(el)) {
    return { kind: 'svg', element: el, url: null };
  }

  // Hit on SVG child geometry → root <svg>
  try {
    const svgRoot = getSvgRoot(el);
    if (svgRoot && svgRoot !== el && !isKeyPilotChrome(svgRoot)) {
      return { kind: 'svg', element: svgRoot, url: null };
    }
  } catch { /* ignore */ }

  try {
    const style = window.getComputedStyle && window.getComputedStyle(el);
    const bg = style ? String(style.backgroundImage || '') : '';
    if (bg && bg !== 'none' && /url\s*\(/i.test(bg)) {
      const extracted = extractFirstBackgroundImageUrl(bg);
      if (extracted && isUsableImageUrl(extracted)) {
        return {
          kind: 'background',
          element: el,
          url: resolveUrl(extracted, el)
        };
      }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Tree search under `root` for an image that still covers (x, y).
 * Handles common card markup where hit is the wrapping <a>/<picture>/<div>
 * and the real <img> is a descendant (sometimes with pointer-events: none).
 *
 * @param {Element} root
 * @param {number} x
 * @param {number} y
 * @returns {HoveredImageSource|null}
 */
function findImageInSubtree(root, x, y) {
  if (!root || root.nodeType !== 1) return null;

  // <picture> → prefer its selected <img>
  try {
    if (String(root.tagName || '').toLowerCase() === 'picture') {
      const img = root.querySelector('img');
      if (img) {
        const fromImg = sourceFromSelf(img);
        if (fromImg) return fromImg;
      }
    }
  } catch { /* ignore */ }

  // Prefer <img> descendants whose box still contains the cursor.
  // pointer-events:none imgs never win elementFromPoint but still "paint" under the cursor.
  try {
    const imgs = root.querySelectorAll('img');
    /** @type {HoveredImageSource|null} */
    let fallback = null;
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (isKeyPilotChrome(img)) continue;
      const url = getImgUrl(/** @type {HTMLImageElement} */ (img));
      if (!isUsableImageUrl(url)) continue;
      const src = {
        kind: /** @type {const} */ ('img'),
        element: img,
        url: resolveUrl(url, img)
      };
      if (elementContainsPoint(img, x, y)) return src;
      // Fallback: single usable img inside a small wrapper (e.g. image-holder / link)
      if (!fallback) fallback = src;
    }
    // Only use non-point fallback for tight wrappers (link/picture/figure/holder),
    // not for huge containers like <article> or <body> (would steal unrelated images).
    if (fallback && imgs.length === 1) {
      const tag = String(root.tagName || '').toLowerCase();
      const cls = typeof root.className === 'string' ? root.className : '';
      const tight =
        tag === 'a' || tag === 'picture' || tag === 'figure' || tag === 'button' ||
        /image|thumb|media|photo|cover|figure|poster/i.test(cls);
      if (tight) return fallback;
    }
  } catch { /* ignore */ }

  // Inline SVG descendants under the point
  try {
    const svgs = root.querySelectorAll('svg');
    for (let i = 0; i < svgs.length; i++) {
      const svg = svgs[i];
      if (isKeyPilotChrome(svg)) continue;
      if (!isSvgRoot(svg)) continue;
      if (elementContainsPoint(svg, x, y)) {
        return { kind: 'svg', element: svg, url: null };
      }
    }
  } catch { /* ignore */ }

  // <video> under the point (poster or paused frame)
  try {
    const videos = root.querySelectorAll('video');
    for (let i = 0; i < videos.length; i++) {
      const video = /** @type {HTMLVideoElement} */ (videos[i]);
      if (isKeyPilotChrome(video)) continue;
      if (!elementContainsPoint(video, x, y)) continue;
      const fromVideo = sourceFromSelf(video);
      if (fromVideo) return fromVideo;
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Walk hit node + ancestors: self, then tree under each node for nested media.
 * @param {Element|null} start
 * @param {number} x
 * @param {number} y
 * @returns {HoveredImageSource|null}
 */
function findImageSourceFromElement(start, x, y) {
  if (!start) return null;

  // Fast path: SVG geometry under cursor
  try {
    const svgHit = getSvgRoot(start);
    if (svgHit && !isKeyPilotChrome(svgHit)) {
      return { kind: 'svg', element: svgHit, url: null };
    }
  } catch { /* ignore */ }

  let el = start;
  let depth = 0;
  while (el && el.nodeType === 1 && depth < MAX_ANCESTOR_DEPTH) {
    if (isKeyPilotChrome(el)) {
      el = getParentOrHost(el);
      depth++;
      continue;
    }

    const selfHit = sourceFromSelf(el);
    if (selfHit) return selfHit;

    // Nested media (e.g. <a><picture><img></picture></a> when hit is <a> or <picture>)
    const nested = findImageInSubtree(el, x, y);
    if (nested) return nested;

    el = getParentOrHost(el);
    depth++;
  }

  return null;
}

/**
 * Scan the full element stack under the cursor (top → bottom).
 * Catches cases where the painted <img> is below a transparent overlay.
 * @param {number} x
 * @param {number} y
 * @returns {HoveredImageSource|null}
 */
function findImageFromPointStack(x, y) {
  let stack = null;
  try {
    if (typeof document.elementsFromPoint === 'function') {
      stack = document.elementsFromPoint(x, y);
    }
  } catch {
    stack = null;
  }
  if (!stack || !stack.length) return null;

  const limit = Math.min(stack.length, 24);
  for (let i = 0; i < limit; i++) {
    const el = stack[i];
    if (!el || el.nodeType !== 1) continue;
    if (isKeyPilotChrome(el)) continue;
    const selfHit = sourceFromSelf(el);
    if (selfHit) return selfHit;
  }
  return null;
}

/**
 * Sync discovery: find the image source under the cursor.
 *
 * Strategy (Engadget-style cards and similar):
 * 1. elementsFromPoint stack — painted <img> may sit under a transparent overlay
 * 2. hit node + ancestor walk with **subtree** search — hit is often <a>/<picture>
 *    while the real <img> is nested (or pointer-events: none)
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ elementFromPoint?: (x: number, y: number) => Element|null }} [options]
 * @returns {HoveredImageSource|null}
 */
export function findHoveredImageSource(clientX, clientY, options = {}) {
  if (typeof clientX !== 'number' || typeof clientY !== 'number' ||
      !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }

  // 1) Full stack under the cursor
  const fromStack = findImageFromPointStack(clientX, clientY);
  if (fromStack) return fromStack;

  // 2) Primary hit + ancestor/tree walk
  const hitFn = typeof options.elementFromPoint === 'function'
    ? options.elementFromPoint
    : deepElementFromPoint;

  let hit = null;
  try {
    hit = hitFn(clientX, clientY);
  } catch {
    hit = null;
  }
  if (!hit || hit.nodeType !== 1) return null;

  return findImageSourceFromElement(hit, clientX, clientY);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob|null>}
 */
function canvasToPngBlob(canvas) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b || null), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * Convert an arbitrary image Blob to PNG via bitmap + canvas.
 * @param {Blob} blob
 * @returns {Promise<Blob|null>}
 */
async function blobToPng(blob) {
  if (!blob) return null;

  if (blob.type === 'image/png') return blob;

  // SVG blobs often fail createImageBitmap — go straight to <img> path for those.
  const isSvg = /svg/i.test(blob.type || '') ||
    (typeof blob.type === 'string' && blob.type.includes('svg'));

  if (!isSvg) {
    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(blob);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width || 1;
          canvas.height = bitmap.height || 1;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.drawImage(bitmap, 0, 0);
          return await canvasToPngBlob(canvas);
        } finally {
          try { bitmap.close(); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.warn('[KeyPilot] createImageBitmap PNG convert failed:', err);
    }
  }

  // Fallback: HTMLImageElement + object URL (works for SVG + raster).
  try {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await loadHtmlImage(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, img.naturalWidth || img.width || 1);
      canvas.height = Math.max(1, img.naturalHeight || img.height || 1);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return await canvasToPngBlob(canvas);
    } finally {
      try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn('[KeyPilot] Image element PNG convert failed:', err);
    return null;
  }
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Helps some cross-origin SVG/raster loads when CORS headers allow it.
    try { img.crossOrigin = 'anonymous'; } catch { /* ignore */ }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Image load timed out'));
    }, MATERIALIZE_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('Image failed to load'));
    };
    img.src = src;
  });
}

/**
 * Fetch a URL (or use data/blob directly) and return a Blob.
 * @param {string} url
 * @returns {Promise<Blob|null>}
 */
async function fetchImageBlob(url) {
  if (!url) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => {
    try { controller?.abort(); } catch { /* ignore */ }
  }, MATERIALIZE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller?.signal,
      credentials: 'include',
      mode: 'cors',
      cache: 'force-cache'
    });
    if (!res.ok) {
      console.warn('[KeyPilot] Image fetch failed:', res.status, url.slice(0, 120));
      return null;
    }
    const blob = await res.blob();
    return blob || null;
  } catch (err) {
    try {
      const res = await fetch(url, {
        credentials: 'omit',
        mode: 'cors',
        cache: 'force-cache'
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch (err2) {
      console.warn('[KeyPilot] Image fetch error:', err2?.message || err2);
      return null;
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pixel size to rasterize an SVG (CSS pixels × devicePixelRatio, capped).
 * @param {Element} svg
 * @returns {{ width: number, height: number }}
 */
function getSvgRasterSize(svg) {
  let cssW = 0;
  let cssH = 0;
  try {
    const rect = svg.getBoundingClientRect();
    cssW = rect.width || 0;
    cssH = rect.height || 0;
  } catch { /* ignore */ }

  if (cssW < 1 || cssH < 1) {
    try {
      const vb = /** @type {any} */ (svg).viewBox?.baseVal;
      if (vb && vb.width > 0 && vb.height > 0) {
        cssW = vb.width;
        cssH = vb.height;
      }
    } catch { /* ignore */ }
  }

  if (cssW < 1) cssW = 64;
  if (cssH < 1) cssH = 64;

  const dpr = Math.min(
    (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1,
    2
  );
  let width = Math.round(cssW * dpr);
  let height = Math.round(cssH * dpr);

  const maxEdge = Math.max(width, height);
  if (maxEdge > MAX_SVG_RASTER_EDGE) {
    const scale = MAX_SVG_RASTER_EDGE / maxEdge;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  return { width: Math.max(1, width), height: Math.max(1, height) };
}

/**
 * Serialize an inline <svg> into a standalone SVG document string suitable for
 * loading into an Image / blob URL. Relative resource URLs are absolutized when possible.
 *
 * @param {Element} svg
 * @returns {string|null}
 */
export function serializeInlineSvg(svg) {
  if (!svg || !isSvgRoot(svg)) return null;

  let clone;
  try {
    clone = /** @type {Element} */ (svg.cloneNode(true));
  } catch {
    return null;
  }

  try {
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    // Many icons use xlink:href on <use>/<image>.
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
  } catch { /* ignore */ }

  // Ensure explicit dimensions so browsers rasterize consistently.
  try {
    const rect = svg.getBoundingClientRect();
    if (!clone.getAttribute('width') && rect.width > 0) {
      clone.setAttribute('width', String(rect.width));
    }
    if (!clone.getAttribute('height') && rect.height > 0) {
      clone.setAttribute('height', String(rect.height));
    }
  } catch { /* ignore */ }

  // Preserve or synthesize viewBox so scaling stays correct.
  try {
    if (!clone.getAttribute('viewBox')) {
      const vb = /** @type {any} */ (svg).viewBox?.baseVal;
      if (vb && vb.width > 0 && vb.height > 0) {
        clone.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
      } else {
        const w = parseFloat(clone.getAttribute('width') || '') || 0;
        const h = parseFloat(clone.getAttribute('height') || '') || 0;
        if (w > 0 && h > 0) {
          clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }
      }
    }
  } catch { /* ignore */ }

  // Absolutize href / xlink:href on nested images and uses (best-effort).
  try {
    const refs = clone.querySelectorAll('image, use');
    refs.forEach((node) => {
      for (const attr of ['href', 'xlink:href']) {
        try {
          const val = node.getAttribute(attr);
          if (!val || val.startsWith('#') || /^(data:|blob:)/i.test(val)) continue;
          node.setAttribute(attr, resolveUrl(val, svg));
        } catch { /* ignore */ }
      }
    });
  } catch { /* ignore */ }

  try {
    const serializer = new XMLSerializer();
    let xml = serializer.serializeToString(clone);
    // Ensure XML declaration-free but with SVG namespace (clone attrs should cover this).
    if (!/xmlns=/.test(xml)) {
      xml = xml.replace(
        /<svg\b/,
        '<svg xmlns="http://www.w3.org/2000/svg"'
      );
    }
    return xml;
  } catch (err) {
    console.warn('[KeyPilot] SVG serialize failed:', err);
    return null;
  }
}

/**
 * Rasterize an inline <svg> element to a PNG Blob.
 * @param {Element} svg
 * @returns {Promise<{ blob: Blob, mimeType: string }|null>}
 */
export async function materializeInlineSvg(svg) {
  if (!svg || !isSvgRoot(svg)) return null;

  const xml = serializeInlineSvg(svg);
  if (!xml) return null;

  const { width, height } = getSvgRasterSize(svg);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await loadHtmlImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Transparent background — matches typical icon SVGs.
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const png = await canvasToPngBlob(canvas);
    if (!png || png.size === 0) return null;
    return { blob: png, mimeType: 'image/png' };
  } catch (err) {
    console.warn('[KeyPilot] Inline SVG rasterize failed:', err);
    return null;
  } finally {
    try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
  }
}

/**
 * Capture the current decoded video frame as a PNG Blob.
 * Fails (null) for cross-origin tainted canvases or when no frame is ready.
 *
 * @param {HTMLVideoElement} video
 * @returns {Promise<{ blob: Blob, mimeType: string }|null>}
 */
async function captureVideoFrameBlob(video) {
  if (!videoHasDrawableFrame(video)) return null;

  try {
    const width = Math.max(1, video.videoWidth || 0);
    const height = Math.max(1, video.videoHeight || 0);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    const png = await canvasToPngBlob(canvas);
    if (!png || png.size === 0) return null;
    return { blob: png, mimeType: 'image/png' };
  } catch (err) {
    console.warn('[KeyPilot] Video frame capture failed:', err?.message || err);
    return null;
  }
}

/**
 * Materialize a <video> to a PNG Blob: poster when still the pre-play thumbnail,
 * otherwise the current/paused frame; falls back across both paths.
 *
 * @param {HTMLVideoElement} video
 * @returns {Promise<{ blob: Blob, mimeType: string }|null>}
 */
export async function materializeVideoElement(video) {
  if (!isHtmlVideo(video)) return null;

  const posterUrl = getVideoPosterUrl(video);
  const preferPoster = videoLikelyShowingPoster(video);

  if (preferPoster && posterUrl) {
    const fromPoster = await materializeImageBlob(posterUrl, {});
    if (fromPoster) return fromPoster;
    const frameFallback = await captureVideoFrameBlob(video);
    if (frameFallback) return frameFallback;
    return null;
  }

  const fromFrame = await captureVideoFrameBlob(video);
  if (fromFrame) return fromFrame;

  if (posterUrl) {
    return materializeImageBlob(posterUrl, {});
  }

  return null;
}

/**
 * Materialize a source URL into a clipboard-friendly PNG Blob when possible.
 * Falls back to the original image/* blob type if PNG conversion fails.
 *
 * @param {string} url
 * @param {{ element?: Element|null }} [options]
 * @returns {Promise<{ blob: Blob, mimeType: string }|null>}
 */
export async function materializeImageBlob(url, options = {}) {
  if (!isUsableImageUrl(url)) return null;

  // Fast path: already-loaded <img> can be drawn directly (helps same-origin SVG imgs).
  const el = options.element;
  if (isHtmlImage(el)) {
    try {
      const img = /** @type {HTMLImageElement} */ (el);
      if (img.complete && (img.naturalWidth > 0 || img.naturalHeight > 0)) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, img.naturalWidth || img.width || 1);
        canvas.height = Math.max(1, img.naturalHeight || img.height || 1);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const png = await canvasToPngBlob(canvas);
          // Tainted canvas yields null toBlob in some browsers — fall through to fetch.
          if (png && png.size > 0) {
            return { blob: png, mimeType: 'image/png' };
          }
        }
      }
    } catch {
      // Tainted or security error — fetch path below.
    }
  }

  const raw = await fetchImageBlob(url);
  if (!raw || raw.size === 0) return null;

  // Prefer PNG for ClipboardItem compatibility in Chromium.
  const png = await blobToPng(raw);
  if (png && png.size > 0) {
    return { blob: png, mimeType: 'image/png' };
  }

  const type = (raw.type && raw.type.startsWith('image/')) ? raw.type : 'image/png';
  return { blob: raw, mimeType: type };
}

/**
 * Find the image rendered under the cursor and return a Blob ready for use
 * (clipboard, media library, etc.). Not tied to the clipboard.
 *
 * @param {number} clientX - Viewport X (e.g. state.lastMouse.x)
 * @param {number} clientY - Viewport Y (e.g. state.lastMouse.y)
 * @param {{ elementFromPoint?: (x: number, y: number) => Element|null }} [options]
 * @returns {Promise<HoveredImageResult|null>}
 */
export async function getHoveredImage(clientX, clientY, options = {}) {
  const source = findHoveredImageSource(clientX, clientY, options);
  if (!source) return null;

  let materialized = null;
  if (source.kind === 'svg') {
    materialized = await materializeInlineSvg(source.element);
  } else if (source.kind === 'video') {
    materialized = await materializeVideoElement(/** @type {HTMLVideoElement} */ (source.element));
  } else {
    materialized = await materializeImageBlob(source.url || '', { element: source.element });
  }
  if (!materialized) return null;

  return {
    kind: source.kind,
    element: source.element,
    url: source.url,
    blob: materialized.blob,
    mimeType: materialized.mimeType
  };
}
