/**
 * Rate-limited card-thumb resolution + image decode preload.
 *
 * Used by Launcher / New Tab so many cards don't stampede the SW or paint
 * blank CSS backgrounds before the image has decoded.
 */

/** Max concurrent resolve + decode jobs. */
const DEFAULT_CONCURRENCY = 4;

/** @type {Map<string, { url: string, source: string }>} */
const resolvedCache = new Map();

/** @type {Map<string, Promise<{ url: string, source: string }|null>>} */
const inFlight = new Map();

/** @type {Set<string>} */
const decodedUrls = new Set();

/** @type {Map<string, Promise<boolean>>} */
const decodeInFlight = new Map();

let active = 0;
/** @type {Array<{ priority: number, run: () => void }>} */
const waitQueue = [];

/**
 * @param {number} [concurrency]
 */
function pump(concurrency = DEFAULT_CONCURRENCY) {
  while (active < concurrency && waitQueue.length) {
    // Higher priority first; stable enough for UI (visible > buffer > rest).
    waitQueue.sort((a, b) => b.priority - a.priority);
    const next = waitQueue.shift();
    if (!next) break;
    active += 1;
    try {
      next.run();
    } catch {
      active = Math.max(0, active - 1);
    }
  }
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ priority?: number, concurrency?: number }} [opts]
 * @returns {Promise<T>}
 */
export function enqueueThumbJob(fn, opts = {}) {
  const priority = Number(opts.priority) || 0;
  const concurrency = Number(opts.concurrency) || DEFAULT_CONCURRENCY;
  return new Promise((resolve, reject) => {
    const run = () => {
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active = Math.max(0, active - 1);
          pump(concurrency);
        });
    };
    waitQueue.push({ priority, run });
    pump(concurrency);
  });
}

/**
 * @param {string} pageUrl
 * @returns {{ url: string, source: string }|null}
 */
export function getCachedCardThumb(pageUrl) {
  const key = String(pageUrl || '').trim();
  if (!key) return null;
  return resolvedCache.get(key) || null;
}

/**
 * @param {string} pageUrl
 * @param {{ url: string, source: string }} resolved
 */
export function setCachedCardThumb(pageUrl, resolved) {
  const key = String(pageUrl || '').trim();
  if (!key || !resolved?.url) return;
  resolvedCache.set(key, { url: resolved.url, source: resolved.source || 'unknown' });
}

/**
 * Decode an image URL before using it as a CSS background.
 * @param {string} imageUrl
 * @returns {Promise<boolean>}
 */
export function preloadThumbImage(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url) return Promise.resolve(false);
  if (decodedUrls.has(url)) return Promise.resolve(true);
  const existing = decodeInFlight.get(url);
  if (existing) return existing;

  const promise = new Promise((resolve) => {
    try {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        decodedUrls.add(url);
        decodeInFlight.delete(url);
        resolve(true);
      };
      img.onerror = () => {
        decodeInFlight.delete(url);
        resolve(false);
      };
      img.src = url;
    } catch {
      decodeInFlight.delete(url);
      resolve(false);
    }
  });
  decodeInFlight.set(url, promise);
  return promise;
}

/**
 * Resolve a card thumb with session cache + rate limit + image preload.
 *
 * @param {string} pageUrl
 * @param {(pageUrl: string) => Promise<{ url: string, source: string }|null>} resolver
 * @param {{ priority?: number, preload?: boolean }} [opts]
 * @returns {Promise<{ url: string, source: string }|null>}
 */
export async function resolveCardThumbQueued(pageUrl, resolver, opts = {}) {
  const key = String(pageUrl || '').trim();
  if (!key || typeof resolver !== 'function') return null;

  const cached = resolvedCache.get(key);
  if (cached?.url) {
    if (opts.preload !== false) await preloadThumbImage(cached.url);
    return cached;
  }

  const pending = inFlight.get(key);
  if (pending) {
    const result = await pending;
    if (result?.url && opts.preload !== false) await preloadThumbImage(result.url);
    return result;
  }

  const job = enqueueThumbJob(async () => {
    try {
      const resolved = await resolver(key);
      if (resolved?.url) {
        setCachedCardThumb(key, resolved);
        if (opts.preload !== false) await preloadThumbImage(resolved.url);
        return resolvedCache.get(key) || resolved;
      }
      return null;
    } finally {
      inFlight.delete(key);
    }
  }, { priority: opts.priority });

  inFlight.set(key, job);
  return job;
}

/**
 * Observe an element and invoke `onVisible` once it enters the root (+ margin).
 * Default margin ≈ 100% of root size → roughly visible + 2× buffer.
 *
 * @param {HTMLElement} el
 * @param {() => void} onVisible
 * @param {{ root?: Element|null, rootMargin?: string }} [opts]
 * @returns {() => void} dispose
 */
export function observeThumbVisibility(el, onVisible, opts = {}) {
  if (!el || typeof onVisible !== 'function') return () => {};

  if (typeof IntersectionObserver !== 'function') {
    onVisible();
    return () => {};
  }

  let done = false;
  const root = opts.root === undefined ? null : opts.root;
  // 100% margin on each axis ≈ one extra viewport of buffer (visible + ~2× area).
  const rootMargin = opts.rootMargin || '100% 100% 100% 100%';

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || done) continue;
        done = true;
        try { io.disconnect(); } catch { /* ignore */ }
        onVisible();
        break;
      }
    },
    { root, rootMargin, threshold: 0.01 }
  );

  try {
    io.observe(el);
  } catch {
    onVisible();
    return () => {};
  }

  return () => {
    done = true;
    try { io.disconnect(); } catch { /* ignore */ }
  };
}

/** Test / reset helper. */
export function clearThumbLoadCaches() {
  resolvedCache.clear();
  inFlight.clear();
  decodedUrls.clear();
  decodeInFlight.clear();
  waitQueue.length = 0;
  active = 0;
}
