/**
 * Browser page-zoom steps and cursor anchoring.
 *
 * Presets match Chromium's browser zoom menu (Ctrl+/Ctrl-). `chrome.tabs.setZoom`
 * does not take a focal point, so the caller scrolls after the factor changes
 * to keep the CSS document point under the cursor fixed — the same result as a
 * pinch gesture on in-flow page content.
 *
 * The key handler previews the step with a CSS scale, then commits with setZoom.
 */

/** CSS preview length before the browser zoom commit. */
export const ZOOM_PREVIEW_MS = 180;

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
