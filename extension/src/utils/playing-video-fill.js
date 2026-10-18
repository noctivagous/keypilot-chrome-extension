/**
 * Playing <video> coverage for the translucent focus fill.
 * The wash is skipped when a playing video occupies a large share of the
 * focus target. Paused posters and small autoplay chips keep the wash.
 */

/** Share of the focus box a playing video must cover before the fill is dropped. */
const PLAYING_VIDEO_FILL_RATIO = 0.35;
const MAX_VIDEOS = 16;
const MAX_SHADOW_NODES = 250;
const MAX_SHADOW_DEPTH = 5;
const MAX_FRAMES = 8;

/**
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
function isPlayingVideo(el) {
  try {
    if (!el || el.nodeType !== 1 || el.tagName !== 'VIDEO') return false;
    if (el.paused || el.ended) return false;
    return el.readyState >= 2;
  } catch {
    return false;
  }
}

/**
 * @param {DOMRect} host
 * @param {DOMRect} inner
 * @returns {number}
 */
function intersectionRatio(host, inner) {
  const hostArea = host.width * host.height;
  if (!(hostArea > 0)) return 0;
  const w = Math.min(host.right, inner.right) - Math.max(host.left, inner.left);
  const h = Math.min(host.bottom, inner.bottom) - Math.max(host.top, inner.top);
  if (!(w > 0) || !(h > 0)) return 0;
  return (w * h) / hostArea;
}

/**
 * @param {Element|Document|ShadowRoot|null|undefined} root
 * @param {Element[]} bucket
 */
function addVideos(root, bucket) {
  if (!root || bucket.length >= MAX_VIDEOS) return;
  try {
    if (/** @type {Element} */ (root).tagName === 'VIDEO') {
      bucket.push(/** @type {Element} */ (root));
    }
  } catch { /* ignore */ }
  try {
    const list = root.querySelectorAll?.('video');
    if (!list) return;
    for (let i = 0; i < list.length && bucket.length < MAX_VIDEOS; i++) {
      bucket.push(list[i]);
    }
  } catch { /* ignore */ }
}

/**
 * @param {ParentNode|null|undefined} root
 * @param {Element[]} bucket
 * @param {number} depth
 * @param {{ left: number }} budget
 */
function addShadowVideos(root, bucket, depth, budget) {
  if (!root || depth > MAX_SHADOW_DEPTH || bucket.length >= MAX_VIDEOS || budget.left <= 0) return;
  let nodes = null;
  try { nodes = root.querySelectorAll?.('*'); } catch { nodes = null; }
  if (!nodes) return;
  const limit = Math.min(nodes.length, budget.left);
  for (let i = 0; i < limit; i++) {
    budget.left--;
    let shadow = null;
    try { shadow = nodes[i].shadowRoot; } catch { shadow = null; }
    if (!shadow) continue;
    addVideos(shadow, bucket);
    addShadowVideos(shadow, bucket, depth + 1, budget);
    if (bucket.length >= MAX_VIDEOS) return;
  }
}

/**
 * Same-origin frames only. Cross-origin players are handled in the frame agent.
 * @param {Element} root
 * @param {Element[]} bucket
 */
function addSameOriginFrameVideos(root, bucket) {
  if (bucket.length >= MAX_VIDEOS) return;
  /** @type {Element[]} */
  const frames = [];
  try {
    if (root.tagName === 'IFRAME' || root.tagName === 'FRAME') frames.push(root);
  } catch { /* ignore */ }
  try {
    const list = root.querySelectorAll?.('iframe, frame');
    if (list) {
      for (let i = 0; i < list.length && frames.length < MAX_FRAMES; i++) frames.push(list[i]);
    }
  } catch { /* ignore */ }
  for (const frame of frames) {
    if (bucket.length >= MAX_VIDEOS) return;
    try {
      const doc = /** @type {HTMLIFrameElement} */ (frame).contentDocument;
      if (doc) addVideos(doc, bucket);
    } catch { /* cross-origin */ }
  }
}

/**
 * @param {DOMRect} host
 * @param {Element[]} videos
 * @param {Set<Element>} seen
 * @returns {boolean}
 */
function anyPlayingVideoCovers(host, videos, seen) {
  for (const video of videos) {
    if (seen.has(video)) continue;
    seen.add(video);
    if (!isPlayingVideo(video)) continue;
    let rect;
    try { rect = video.getBoundingClientRect(); } catch { continue; }
    if (intersectionRatio(host, rect) >= PLAYING_VIDEO_FILL_RATIO) return true;
  }
  return false;
}

/**
 * True when a playing video occupies at least ~35% of `el`'s box.
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
export function playingVideoCoversElement(el) {
  if (!el || el.nodeType !== 1) return false;
  let host;
  try { host = el.getBoundingClientRect(); } catch { return false; }
  if (!(host.width > 0) || !(host.height > 0)) return false;

  /** @type {Element[]} */
  const videos = [];
  const seen = new Set();
  try {
    const ancestor = typeof el.closest === 'function' ? el.closest('video') : null;
    if (ancestor) videos.push(ancestor);
  } catch { /* ignore */ }
  addVideos(el, videos);
  addSameOriginFrameVideos(el, videos);
  if (anyPlayingVideoCovers(host, videos, seen)) return true;

  const beforeShadow = videos.length;
  let ownShadow = null;
  try { ownShadow = el.shadowRoot; } catch { ownShadow = null; }
  if (ownShadow) addVideos(ownShadow, videos);
  addShadowVideos(el, videos, 0, { left: MAX_SHADOW_NODES });
  if (videos.length === beforeShadow && !ownShadow) return false;
  return anyPlayingVideoCovers(host, videos, seen);
}
