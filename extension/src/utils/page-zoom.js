/**
 * Browser page-zoom steps and cursor anchoring.
 *
 * Presets match Chromium's browser zoom menu (Ctrl+/Ctrl-). `chrome.tabs.setZoom`
 * does not take a focal point, so the caller scrolls after the factor changes
 * to keep the CSS document point under the cursor fixed — the same result as a
 * pinch gesture on in-flow page content.
 *
 * The CSS scale preview is kept behind `ZOOM_CSS_PREVIEW`. Easing through
 * intermediate `chrome.tabs.setZoom` factors is kept behind `ZOOM_NATIVE_ANIM`.
 * The default is one preset step.
 *
 * Cursor anchoring (scroll so the point under the pointer stays fixed) is kept
 * behind `ZOOM_AT_POINT`. The default zooms the page and leaves scroll alone.
 */

/**
 * When true, [ / ] animate a CSS scale at the cursor and then commit with setZoom.
 * Default eases the browser zoom factor instead.
 */
export const ZOOM_CSS_PREVIEW = false;

/**
 * When true, zoom shifts scroll so the point under the cursor stays fixed.
 * Default leaves the page scroll where the browser puts it.
 */
export const ZOOM_AT_POINT = false;

/**
 * When true, a zoom step eases through intermediate browser zoom factors.
 * Default applies the next preset in one `setZoom` call. CSS preview can
 * still animate when `ZOOM_CSS_PREVIEW` is on.
 */
export const ZOOM_NATIVE_ANIM = false;

/** CSS preview length before the browser zoom commit. */
export const ZOOM_PREVIEW_MS = 180;

/** Native setZoom ease length for one preset step. */
export const ZOOM_ANIM_MS = 180;

/** Chromium preset browser zoom factors (`page_zoom.cc`). */
export const PAGE_ZOOM_PRESETS = Object.freeze([
  0.25,
  1 / 3,
  0.5,
  2 / 3,
  0.75,
  0.8,
  0.9,
  1,
  1.1,
  1.25,
  1.5,
  1.75,
  2,
  2.5,
  3,
  4,
  5
]);

/**
 * Next or previous preset strictly beyond `current`.
 * @param {number} current
 * @param {number} direction Positive zooms in.
 * @returns {number}
 */
export function stepZoomFactor(current, direction) {
  const z = Number(current);
  const base = Number.isFinite(z) && z > 0 ? z : 1;
  const last = PAGE_ZOOM_PRESETS.length - 1;
  const zoomIn = direction > 0;

  for (let i = 0; i < PAGE_ZOOM_PRESETS.length; i++) {
    const preset = PAGE_ZOOM_PRESETS[i];
    if (Math.abs(preset - base) / base <= 0.02) {
      if (zoomIn) return PAGE_ZOOM_PRESETS[Math.min(last, i + 1)];
      return PAGE_ZOOM_PRESETS[Math.max(0, i - 1)];
    }
  }

  if (zoomIn) {
    for (const preset of PAGE_ZOOM_PRESETS) {
      if (preset > base) return preset;
    }
    return PAGE_ZOOM_PRESETS[last];
  }
  for (let i = last; i >= 0; i--) {
    if (PAGE_ZOOM_PRESETS[i] < base) return PAGE_ZOOM_PRESETS[i];
  }
  return PAGE_ZOOM_PRESETS[0];
}

/**
 * Transform-origin on the preview element (the body border box, not the root).
 * The root's used origin box is the layout viewport, so a document-sized
 * `getBoundingClientRect()` offset scales around the wrong point once the page
 * is scrolled. Body's border box top-left tracks the document, and subtracting
 * it converts the viewport cursor into that box.
 * @param {{ x: number, y: number }} client
 * @param {{ left: number, top: number }} borderBox
 * @returns {{ x: number, y: number }}
 */
export function previewOrigin(client, borderBox) {
  const x = Number(client?.x);
  const y = Number(client?.y);
  const left = Number(borderBox?.left);
  const top = Number(borderBox?.top);
  return {
    x: (Number.isFinite(x) ? x : 0) - (Number.isFinite(left) ? left : 0),
    y: (Number.isFinite(y) ? y : 0) - (Number.isFinite(top) ? top : 0)
  };
}

/**
 * Ease-out cubic. t is 0..1.
 * @param {number} t
 * @returns {number}
 */
export function easeOutCubic(t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0));
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Geometric blend between two browser zoom factors. Linear blend looks slow
 * at the low end and fast at the high end; zoom is perceived as a ratio.
 * @param {number} from
 * @param {number} to
 * @param {number} t 0..1, eased internally
 * @returns {number}
 */
export function interpolateZoom(from, to, t) {
  const a = Number(from);
  const b = Number(to);
  if (!(a > 0) || !(b > 0)) return b > 0 ? b : 1;
  const u = easeOutCubic(t);
  return a * Math.pow(b / a, u);
}

/**
 * CSS scale that previews a browser-zoom step while the tab zoom is unchanged.
 * @param {number} browserZoom Last committed tab zoom
 * @param {number} targetZoom
 * @returns {number}
 */
export function zoomPreviewScale(browserZoom, targetZoom) {
  const from = Number(browserZoom);
  const to = Number(targetZoom);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) return 1;
  return to / from;
}

/**
 * Scroll offset that keeps a viewport point on the same document point after
 * a browser zoom change. CSS document coordinates do not scale; the viewport
 * shows fewer CSS pixels when zoom increases, so the scroll origin must move.
 *
 * @param {{ x: number, y: number }} scroll Pre-zoom `scrollX` / `scrollY`
 * @param {{ x: number, y: number }} client Pre-zoom viewport point
 * @param {number} oldZoom
 * @param {number} newZoom
 * @returns {{ x: number, y: number }}
 */
export function scrollToKeepPoint(scroll, client, oldZoom, newZoom) {
  const from = Number(oldZoom);
  const to = Number(newZoom);
  const scale = to > 0 ? from / to : 1;
  const sx = Number(scroll?.x) || 0;
  const sy = Number(scroll?.y) || 0;
  const cx = Number(client?.x) || 0;
  const cy = Number(client?.y) || 0;
  if (!Number.isFinite(scale) || scale <= 0) return { x: sx, y: sy };
  return {
    x: sx + cx * (1 - scale),
    y: sy + cy * (1 - scale)
  };
}
