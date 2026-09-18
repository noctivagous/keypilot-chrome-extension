/**
 * Media timeline scrubbers (YouTube/Vimeo embeds, custom players).
 *
 * Synthetic clicks often fail to seek: players map offsetX or require a trusted
 * pointer drag. Setting HTMLMediaElement.currentTime from the click X still
 * moves the playhead, including inside cross-origin embeds from the frame agent.
 */

import { dispatchClickSequence } from './synthetic-pointer.js';

/**
 * @param {number} n
 * @returns {number}
 */
export function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Map a horizontal click on a track rect onto media.currentTime.
 * @param {number} clientX
 * @param {{ left: number, width: number }|null|undefined} rect
 * @param {number} duration
 * @returns {number|null}
 */
export function mediaTimeFromClientX(clientX, rect, duration) {
  if (!rect || !(rect.width > 0)) return null;
  if (!Number.isFinite(clientX)) return null;
  if (!Number.isFinite(duration) || duration <= 0 || duration === Infinity) return null;
  return clamp01((clientX - rect.left) / rect.width) * duration;
}

/**
 * Horizontal vs vertical slider. YouTube's post-mute volume bar is vertical.
 * @param {Element|null|undefined} el
 * @returns {'x'|'y'}
 */
export function sliderAxis(el) {
  try {
    const ori = (el?.getAttribute?.('aria-orientation') || '').trim().toLowerCase();
    if (ori === 'vertical') return 'y';
    if (ori === 'horizontal') return 'x';
  } catch { /* ignore */ }
  try {
    const r = el && typeof el.getBoundingClientRect === 'function'
      ? el.getBoundingClientRect()
      : null;
    if (r && r.height >= r.width * 1.4 && r.height >= 32) return 'y';
  } catch { /* ignore */ }
  return 'x';
}

/**
 * Map a click onto a 0–1 volume. Vertical: bottom = 0, top = 1 (YouTube).
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ left: number, top: number, width: number, height: number }|null|undefined} rect
 * @param {'x'|'y'} [axis='x']
 * @returns {number|null}
 */
export function volumeFromClientPoint(clientX, clientY, rect, axis = 'x') {
  if (!rect) return null;
  if (axis === 'y') {
    if (!(rect.height > 0) || !Number.isFinite(clientY)) return null;
    return clamp01(1 - (clientY - rect.top) / rect.height);
  }
  if (!(rect.width > 0) || !Number.isFinite(clientX)) return null;
  return clamp01((clientX - rect.left) / rect.width);
}

/**
 * Volume / non-timeline sliders must not drive media.currentTime.
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
export function isVolumeOrNonSeekSlider(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('aria-valuetext') || ''}`.toLowerCase();
    if (/\b(volume|mute|sound|loudness|gain)\b/.test(label)) return true;
    try {
      if (el.hasAttribute('data-media-volume-slider')) return true;
    } catch { /* ignore */ }
    const cls = String(/** @type {any} */ (el).className || '').toLowerCase();
    if (/\b(volume|mute)[-_]?slider\b|\bvolume-?control\b|\bvds-volume\b/.test(cls)) return true;
    if (typeof el.closest === 'function') {
      const host = el.closest(
        '[aria-label*="volume" i], [aria-label*="mute" i], [data-media-volume-slider], .vds-volume-slider, .ytp-volume-panel, .ytp-volume-slider'
      );
      if (host) return true;
    }
    // Unlabeled YouTube volume popup is a tall thin slider, not a seek bar.
    if (sliderAxis(el) === 'y') return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
function isNativeRange(el) {
  try {
    if (!el || el.tagName !== 'INPUT') return false;
    return String(el.getAttribute('type') || '').toLowerCase() === 'range';
  } catch {
    return false;
  }
}

/**
 * Play/volume/link chrome must not be treated as the timeline.
 * Exception: a control nested *inside* the slider (chapter markers).
 * @param {Element} el
 * @returns {boolean}
 */
function isNonScrubControl(el) {
  try {
    if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      return !el.closest?.('[role="slider"], input[type="range"]');
    }
    if (el.tagName === 'INPUT') {
      const t = String(el.getAttribute('type') || 'text').toLowerCase();
      if (t !== 'range') return true;
    }
    const btn = typeof el.closest === 'function'
      ? el.closest('button, [role="button"], a[href], select, textarea')
      : null;
    if (!btn) return false;
    return !btn.closest?.('[role="slider"], input[type="range"]');
  } catch {
    return false;
  }
}

/**
 * Short, wide host that wraps a slider (YouTube `.ytp-progress-bar-container`).
 * Must not match the whole player chrome (play + volume + timeline).
 * @param {Element} el
 * @returns {boolean}
 */
function isShortTrackHost(el) {
  try {
    const r = el.getBoundingClientRect();
    if (!r || r.width < 64 || r.height <= 0 || r.height > 48) return false;
    if (r.width / Math.max(r.height, 1) < 4) return false;
    // Playbar chrome (YouTube `.ytp-chrome-bottom`) is also a short wide bar
    // but contains mute/play/fullscreen. Those must not resolve as the seek track.
    const slider = el.querySelector?.('[role="slider"], input[type="range"]');
    const btn = el.querySelector?.('button, [role="button"], a[href]');
    if (slider && btn) {
      const btnInSlider = typeof slider.contains === 'function' && slider.contains(btn);
      if (!btnInSlider) return false;
    } else if (btn && !slider) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Element|null|undefined} el
 * @returns {Element|null}
 */
export function resolveScrubberControl(el) {
  if (!el || el.nodeType !== 1) return null;
  if (isNonScrubControl(el)) return null;

  try {
    if (isNativeRange(el) || (el.getAttribute('role') || '').trim().toLowerCase() === 'slider') {
      if (isVolumeOrNonSeekSlider(el)) return null;
      return el;
    }
  } catch { /* ignore */ }

  try {
    if (typeof el.closest === 'function') {
      const viaClosest = el.closest('input[type="range"], [role="slider"]');
      if (viaClosest && !isVolumeOrNonSeekSlider(viaClosest)) return viaClosest;
    }
  } catch { /* ignore */ }

  // Hit on a padding/container *around* the slider, not an ancestor of it.
  let n = el;
  let depth = 0;
  while (n && n.nodeType === 1 && depth < 4) {
    try {
      if (isShortTrackHost(n) && typeof n.querySelector === 'function') {
        const inner = n.querySelector(':scope > [role="slider"], :scope > input[type="range"], [role="slider"], input[type="range"]');
        if (inner && !isVolumeOrNonSeekSlider(inner)) return inner;
      }
    } catch { /* ignore */ }
    n = n.parentElement;
    depth++;
  }

  return null;
}

/**
 * Skinny tall host around a volume slider (YouTube `.ytp-volume-panel`).
 * @param {Element} el
 * @returns {boolean}
 */
function isTallVolumeHost(el) {
  try {
    const r = el.getBoundingClientRect();
    if (!r || r.height < 40 || r.width <= 0) return false;
    if (r.height < r.width * 1.4) return false;
    if (r.width > 80) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Volume slider under the cursor (not the timeline).
 * @param {Element|null|undefined} el
 * @returns {Element|null}
 */
export function resolveVolumeControl(el) {
  if (!el || el.nodeType !== 1) return null;
  if (isNonScrubControl(el)) return null;

  try {
    if (isNativeRange(el) && isVolumeOrNonSeekSlider(el)) return el;
    const role = (el.getAttribute('role') || '').trim().toLowerCase();
    if (role === 'slider' && isVolumeOrNonSeekSlider(el)) return el;
  } catch { /* ignore */ }

  try {
    if (typeof el.closest === 'function') {
      const viaClosest = el.closest('input[type="range"], [role="slider"]');
      if (viaClosest && isVolumeOrNonSeekSlider(viaClosest)) return viaClosest;
    }
  } catch { /* ignore */ }

  let n = el;
  let depth = 0;
  while (n && n.nodeType === 1 && depth < 4) {
    try {
      if (isTallVolumeHost(n) && typeof n.querySelector === 'function') {
        const inner = n.querySelector(
          ':scope > [role="slider"], :scope > input[type="range"], [role="slider"], input[type="range"]'
        );
        if (inner && isVolumeOrNonSeekSlider(inner)) return inner;
      }
    } catch { /* ignore */ }
    n = n.parentElement;
    depth++;
  }

  return null;
}

/**
 * Walk up from a scrubber to the player shell and find <video>/<audio>.
 * @param {Element|null|undefined} fromEl
 * @returns {HTMLMediaElement|null}
 */
export function findAssociatedMedia(fromEl) {
  if (!fromEl || fromEl.nodeType !== 1) return null;
  try {
    let n = fromEl;
    let depth = 0;
    while (n && n.nodeType === 1 && depth < 10) {
      if (n === document.body || n === document.documentElement) break;
      if (n.tagName === 'VIDEO' || n.tagName === 'AUDIO') {
        return /** @type {HTMLMediaElement} */ (n);
      }
      try {
        const main =
          n.querySelector?.('video.html5-main-video') ||
          n.querySelector?.('video.video-stream') ||
          n.querySelector?.('video, audio');
        if (main && (main.tagName === 'VIDEO' || main.tagName === 'AUDIO')) {
          return /** @type {HTMLMediaElement} */ (main);
        }
      } catch { /* ignore */ }
      n = n.parentElement;
      depth++;
    }
  } catch { /* ignore */ }

  try {
    const all = document.querySelectorAll('video.html5-main-video, video.video-stream, video, audio');
    for (let i = 0; i < all.length; i++) {
      const m = all[i];
      if (Number.isFinite(m.duration) && m.duration > 1 && m.duration !== Infinity) {
        return /** @type {HTMLMediaElement} */ (m);
      }
    }
    if (all.length) return /** @type {HTMLMediaElement} */ (all[0]);
  } catch { /* ignore */ }

  return null;
}

/**
 * Set media.currentTime from click X along the full-width track.
 * @param {Element} trackEl
 * @param {number} clientX
 * @returns {number|null} target time in seconds, or null if not a timeline
 */
export function applyMediaSeek(trackEl, clientX) {
  if (!trackEl || isVolumeOrNonSeekSlider(trackEl)) return null;
  const media = findAssociatedMedia(trackEl);
  if (!media) return null;
  let rect = null;
  try { rect = trackEl.getBoundingClientRect(); } catch { rect = null; }
  if (!rect || rect.width < 48) return null;
  const next = mediaTimeFromClientX(clientX, rect, media.duration);
  if (next == null) return null;
  try {
    media.currentTime = next;
  } catch { /* isolated-world write; MAIN-world seek follows */ }
  return next;
}

/**
 * Activate a timeline scrubber under the cursor.
 * Pointer sequence first (custom players), then currentTime fallback (YouTube).
 * @param {Element|null|undefined} el
 * @param {number} clientX
 * @param {number} clientY
 * @returns {number|true|false} seconds to seek, `true` if a scrubber was handled
 *   without a mapped time, `false` if this hit is not a scrubber
 */
export function tryActivateScrubber(el, clientX, clientY) {
  if (!el || el.nodeType !== 1) return false;
  if (!Number.isFinite(clientX)) return false;

  const control = resolveScrubberControl(el);
  if (!control || isVolumeOrNonSeekSlider(control)) return false;

  const y = Number.isFinite(clientY)
    ? clientY
    : (() => {
      try {
        const r = control.getBoundingClientRect();
        return r.top + r.height / 2;
      } catch {
        return 0;
      }
    })();

  try {
    // One sequence on the hit node. Double-dispatch (fill + track) offsets some players.
    dispatchClickSequence(el, clientX, y);
  } catch { /* ignore */ }

  const seconds = applyMediaSeek(control, clientX);
  return seconds == null ? true : seconds;
}

/**
 * Set media.volume from a click on a volume slider.
 * @param {Element} trackEl
 * @param {number} clientX
 * @param {number} clientY
 * @returns {number|null} 0–1 volume, or null
 */
export function applyMediaVolume(trackEl, clientX, clientY) {
  if (!trackEl || !isVolumeOrNonSeekSlider(trackEl)) return null;
  let rect = null;
  try { rect = trackEl.getBoundingClientRect(); } catch { rect = null; }
  if (!rect) return null;
  const axis = sliderAxis(trackEl);
  if (axis === 'y' && !(rect.height >= 24)) return null;
  if (axis === 'x' && !(rect.width >= 24)) return null;
  const next = volumeFromClientPoint(clientX, clientY, rect, axis);
  if (next == null) return null;
  const media = findAssociatedMedia(trackEl);
  try {
    if (media) {
      media.volume = next;
      media.muted = next <= 0.001;
    }
  } catch { /* isolated-world write; MAIN-world setVolume follows */ }
  return next;
}

/**
 * Activate a volume slider under the cursor.
 * @param {Element|null|undefined} el
 * @param {number} clientX
 * @param {number} clientY
 * @returns {number|true|false} 0–1 volume, `true` if handled without a mapped
 *   value, `false` if this hit is not a volume slider
 */
export function tryActivateVolumeSlider(el, clientX, clientY) {
  if (!el || el.nodeType !== 1) return false;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

  const control = resolveVolumeControl(el);
  if (!control) return false;

  try {
    dispatchClickSequence(el, clientX, clientY);
  } catch { /* ignore */ }

  const volume = applyMediaVolume(control, clientX, clientY);
  return volume == null ? true : volume;
}
