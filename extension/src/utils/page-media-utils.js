/**
 * Page-wide media discovery for the Page Media overlay (O key).
 *
 * Collects images (richer than bare <img>), video files / <video> sources,
 * and document links — classified by URL extension into Image / Video / Text.
 */

import { extractFirstBackgroundImageUrl } from './image-utils.js';

/** @typedef {'image'|'video'|'text'|'url'|'pageText'} PageMediaCategory */

/**
 * @typedef {{
 *   category: PageMediaCategory,
 *   kind: string,
 *   url: string,
 *   element: Element|null,
 *   label: string,
 *   ext: string,
 *   width?: number|null,
 *   height?: number|null,
 *   fileSizeBytes?: number|null,
 *   dpi?: number|null,
 *   mimeType?: string|null,
   *   posterUrl?: string|null,
   *   thumbUrl?: string|null,
   *   text?: string|null,
   *   urlGroup?: 'page'|'document'|'image'|'video'|'other'
   * }} PageMediaItem
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   sortOrder: number,
 *   minEdge: number,
 *   maxEdge: number|null
 * }} ImageSizeGroupDef
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   sortOrder: number,
 *   items: PageMediaItem[]
 * }} ImageSizeGroup
 */

const IMAGE_EXTS = Object.freeze([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'ico', 'bmp', 'tif', 'tiff'
]);
const VIDEO_EXTS = Object.freeze([
  'mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', 'mpg', 'mpeg'
]);
const TEXT_EXTS = Object.freeze([
  'pdf', 'md', 'markdown', 'rtf', 'txt', 'doc', 'docx', 'odt', 'csv'
]);

const IMAGE_EXT_SET = new Set(IMAGE_EXTS);
const VIDEO_EXT_SET = new Set(VIDEO_EXTS);
const TEXT_EXT_SET = new Set(TEXT_EXTS);

/** Asset / internal page resources excluded from the URLs tab. */
const URL_TAB_EXCLUDE_EXTS = Object.freeze([
  'css', 'scss', 'sass', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'map',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'wasm', 'json'
]);
const URL_TAB_EXCLUDE_EXT_SET = new Set(URL_TAB_EXCLUDE_EXTS);

/** HTML-like / path-with-no-file-ext → "web page" group. */
const PAGE_URL_EXTS = Object.freeze([
  'html', 'htm', 'php', 'asp', 'aspx', 'jsp', 'cgi', 'xhtml', 'shtml'
]);
const PAGE_URL_EXT_SET = new Set(PAGE_URL_EXTS);

const MAX_SHADOW_DEPTH = 5;
const MAX_ELEMENTS = 8000;

/**
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
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
function isUsableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u || u === 'about:blank') return false;
  if (/^javascript:/i.test(u)) return false;
  return true;
}

/**
 * @param {string} url
 * @param {Element|null} [element]
 * @returns {string}
 */
function resolveUrl(url, element) {
  if (!url) return '';
  if (/^(data:|blob:|https?:|chrome-extension:|file:)/i.test(url)) return url;
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
 * Extension from a URL path (ignores query/hash). Empty for data:/blob: without path.
 * @param {string} url
 * @returns {string}
 */
export function extensionFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || /^(data:|blob:)/i.test(trimmed)) return '';
  try {
    const u = new URL(trimmed, typeof document !== 'undefined' ? document.baseURI : undefined);
    const path = u.pathname || '';
    const last = path.split('/').pop() || '';
    const dot = last.lastIndexOf('.');
    if (dot < 0 || dot === last.length - 1) return '';
    return last.slice(dot + 1).toLowerCase();
  } catch {
    const clean = trimmed.split(/[?#]/)[0] || '';
    const last = clean.split('/').pop() || '';
    const dot = last.lastIndexOf('.');
    if (dot < 0 || dot === last.length - 1) return '';
    return last.slice(dot + 1).toLowerCase();
  }
}

/**
 * @param {string} ext
 * @returns {PageMediaCategory|null}
 */
export function categoryFromExtension(ext) {
  const e = String(ext || '').toLowerCase();
  if (IMAGE_EXT_SET.has(e)) return 'image';
  if (VIDEO_EXT_SET.has(e)) return 'video';
  if (TEXT_EXT_SET.has(e)) return 'text';
  return null;
}

/**
 * URL-tab grouping: pages → documents → images → video → other.
 * @param {string} url
 * @param {string} [ext]
 * @returns {'page'|'document'|'image'|'video'|'other'}
 */
export function urlTabGroupForUrl(url, ext) {
  const e = String(ext || extensionFromUrl(url) || '').toLowerCase();
  if (!e || PAGE_URL_EXT_SET.has(e)) return 'page';
  if (TEXT_EXT_SET.has(e)) return 'document';
  if (IMAGE_EXT_SET.has(e)) return 'image';
  if (VIDEO_EXT_SET.has(e)) return 'video';
  // Paths like /about/ or /foo with query — treat as pages.
  try {
    const u = new URL(url, typeof document !== 'undefined' ? document.baseURI : undefined);
    const last = (u.pathname || '').split('/').pop() || '';
    if (!last || !last.includes('.')) return 'page';
  } catch { /* ignore */ }
  return 'other';
}

/**
 * Hostname for URL-tab domain grouping.
 * @param {string} url
 * @returns {string}
 */
export function domainFromUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '(unknown)';
  if (/^data:/i.test(s)) return 'data:';
  if (/^blob:/i.test(s)) return 'blob:';
  if (/^mailto:/i.test(s)) return 'mailto:';
  if (/^tel:/i.test(s)) return 'tel:';
  if (/^javascript:/i.test(s)) return 'javascript:';
  try {
    const u = new URL(s, typeof document !== 'undefined' ? document.baseURI : undefined);
    return u.hostname || u.protocol.replace(/:$/, '') || '(unknown)';
  } catch {
    return '(unknown)';
  }
}

/**
 * Path (+ query/hash) for display under a domain heading.
 * @param {string} url
 * @returns {string}
 */
export function urlPathDisplay(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^(data|blob|mailto|tel|javascript):/i.test(s)) return s;
  try {
    const u = new URL(s, typeof document !== 'undefined' ? document.baseURI : undefined);
    const path = `${u.pathname || '/'}${u.search || ''}${u.hash || ''}`;
    return path || '/';
  } catch {
    return s;
  }
}

/**
 * Directory prefixes for a pathname, e.g. `/info/team/x` → `['/info/', '/info/team/']`.
 * Leaf file segments (last segment containing `.`) are not treated as directories.
 * @param {string} pathname
 * @returns {string[]}
 */
export function directoryPrefixesFromPathname(pathname) {
  const raw = String(pathname || '/');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return [];
  /** @type {string[]} */
  const dirs = [];
  let acc = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    const looksLikeFile = isLast && part.includes('.');
    if (looksLikeFile) break;
    acc += `/${part}`;
    dirs.push(`${acc}/`);
  }
  return dirs;
}

/**
 * Path/query/hash relative to a directory prefix like `/info/`.
 * @param {string} url
 * @param {string} prefix
 * @returns {string}
 */
export function urlPathRelativeToPrefix(url, prefix) {
  const full = urlPathDisplay(url);
  const p = String(prefix || '');
  if (!p) return full;
  try {
    const u = new URL(String(url || ''), typeof document !== 'undefined' ? document.baseURI : undefined);
    let path = u.pathname || '/';
    const suffix = `${u.search || ''}${u.hash || ''}`;
    const prefixNoSlash = p.endsWith('/') ? p.slice(0, -1) : p;
    if (path === prefixNoSlash) return `/${suffix}` || '/';
    if (path.startsWith(p)) {
      const rest = path.slice(p.length);
      return `/${rest}${suffix}`;
    }
    if (path.startsWith(prefixNoSlash + '/')) {
      const rest = path.slice(prefixNoSlash.length + 1);
      return `/${rest}${suffix}`;
    }
  } catch { /* ignore */ }
  return full;
}

/**
 * Partition URL items into path-prefix subgroups (longest shared directory with ≥ minSize URLs).
 * @param {PageMediaItem[]} items
 * @param {number} [minSize=2]
 * @returns {{ prefix: string, items: PageMediaItem[] }[]}
 */
export function groupUrlItemsByPathPrefix(items, minSize = 2) {
  const list = Array.isArray(items) ? items.slice() : [];
  const min = Math.max(2, Number(minSize) || 2);

  /** @type {Map<string, number>} */
  const prefixCount = new Map();
  /** @type {{ item: PageMediaItem, prefixes: string[] }[]} */
  const prepared = [];

  for (const item of list) {
    let pathname = '/';
    try {
      pathname = new URL(String(item?.url || ''), typeof document !== 'undefined' ? document.baseURI : undefined).pathname || '/';
    } catch { pathname = '/'; }
    const prefixes = directoryPrefixesFromPathname(pathname);
    for (const pref of prefixes) {
      prefixCount.set(pref, (prefixCount.get(pref) || 0) + 1);
    }
    prepared.push({ item, prefixes });
  }

  /** @type {Map<string, PageMediaItem[]>} */
  const buckets = new Map();
  for (const { item, prefixes } of prepared) {
    let best = '';
    for (const pref of prefixes) {
      if ((prefixCount.get(pref) || 0) >= min) best = pref;
    }
    if (!buckets.has(best)) buckets.set(best, []);
    buckets.get(best).push(item);
  }

  /** @type {{ prefix: string, items: PageMediaItem[] }[]} */
  const groups = [];
  for (const [prefix, groupItems] of buckets) {
    groupItems.sort((a, b) => String(a.url || '').localeCompare(String(b.url || '')));
    groups.push({ prefix, items: groupItems });
  }

  groups.sort((a, b) => {
    if (!a.prefix && b.prefix) return 1;
    if (a.prefix && !b.prefix) return -1;
    return a.prefix.localeCompare(b.prefix);
  });

  return groups;
}

/**
 * @param {'page'|'document'|'image'|'video'|'other'} group
 * @returns {number}
 */
function urlTabGroupSortOrder(group) {
  if (group === 'page') return 0;
  if (group === 'document') return 1;
  if (group === 'image') return 2;
  if (group === 'video') return 3;
  return 4;
}

/**
 * True when a URL should be omitted from the URLs tab (CSS/JS/fonts/etc.).
 * @param {string} url
 * @param {string} [ext]
 * @param {Element|null} [el]
 * @returns {boolean}
 */
function shouldExcludeFromUrlTab(url, ext, el = null) {
  if (!url) return true;
  if (/^(chrome-extension|chrome|blob):/i.test(url)) return true;
  const e = String(ext || extensionFromUrl(url) || '').toLowerCase();
  if (e && URL_TAB_EXCLUDE_EXT_SET.has(e)) return true;

  // Skip stylesheet / script element sources even without a clear extension.
  try {
    if (el && el.nodeType === 1) {
      const tag = String(el.tagName || '').toUpperCase();
      if (tag === 'SCRIPT') return true;
      if (tag === 'STYLE') return true;
      if (tag === 'LINK') {
        const rel = String(el.getAttribute('rel') || '').toLowerCase();
        if (/\bstylesheet\b|\bpreload\b|\bmodulepreload\b/.test(rel)) return true;
        const as = String(el.getAttribute('as') || '').toLowerCase();
        if (as === 'script' || as === 'style' || as === 'font') return true;
      }
    }
  } catch { /* ignore */ }

  return false;
}

/**
 * @param {string} url
 * @returns {string}
 */
function filenameFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (/^data:/i.test(url)) return 'data-url';
  if (/^blob:/i.test(url)) return 'blob';
  try {
    const u = new URL(url, typeof document !== 'undefined' ? document.baseURI : undefined);
    const last = (u.pathname || '').split('/').pop() || '';
    return decodeURIComponent(last) || u.hostname || url.slice(0, 40);
  } catch {
    const last = (url.split(/[?#]/)[0] || '').split('/').pop() || '';
    return last || url.slice(0, 40);
  }
}

/**
 * Best URL for an <img> (currentSrc / src / lazy attrs / srcset).
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

  const lazyAttrs = [
    'src', 'data-src', 'data-lazy-src', 'data-original', 'data-lazy',
    'data-url', 'data-image', 'data-bg', 'data-thumb', 'data-thumbnail'
  ];
  for (const attr of lazyAttrs) {
    try {
      const v = (img.getAttribute && img.getAttribute(attr)) || '';
      const trimmed = String(v || '').trim();
      if (isUsableUrl(trimmed) && !/\s/.test(trimmed.split(',')[0])) return trimmed;
    } catch { /* ignore */ }
  }

  try {
    const srcset = (img.getAttribute && img.getAttribute('srcset')) || '';
    if (srcset) {
      const first = String(srcset).split(',')[0]?.trim().split(/\s+/)[0] || '';
      if (isUsableUrl(first)) return first;
    }
  } catch { /* ignore */ }

  return '';
}

/**
 * @param {HTMLVideoElement} video
 * @returns {string[]}
 */
function getVideoSourceUrls(video) {
  /** @type {string[]} */
  const out = [];
  try {
    const current = (typeof video.currentSrc === 'string' && video.currentSrc) ? video.currentSrc.trim() : '';
    if (isUsableUrl(current)) out.push(current);
  } catch { /* ignore */ }
  try {
    const src = (typeof video.src === 'string' && video.src) ? video.src.trim() : '';
    if (isUsableUrl(src)) out.push(src);
  } catch { /* ignore */ }
  try {
    const sources = video.querySelectorAll('source');
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const src = (s.getAttribute && s.getAttribute('src')) || '';
      if (isUsableUrl(src)) out.push(String(src).trim());
    }
  } catch { /* ignore */ }
  return out;
}

/**
 * @param {HTMLVideoElement} video
 * @returns {string}
 */
function getVideoPosterUrl(video) {
  try {
    const poster = (typeof video.poster === 'string' && video.poster) ? video.poster.trim() : '';
    if (isUsableUrl(poster)) return poster;
  } catch { /* ignore */ }
  try {
    const attr = (video.getAttribute && video.getAttribute('poster')) || '';
    if (isUsableUrl(attr)) return String(attr).trim();
  } catch { /* ignore */ }
  return '';
}

/**
 * @param {Element} el
 * @returns {string[]}
 */
function harvestAttrUrls(el) {
  /** @type {string[]} */
  const out = [];
  const attrs = ['href', 'src', 'data-src', 'data-href', 'poster', 'action', 'formaction', 'cite', 'data'];
  for (const name of attrs) {
    try {
      const v = (el.getAttribute && el.getAttribute(name)) || '';
      const trimmed = String(v || '').trim();
      if (isUsableUrl(trimmed)) out.push(trimmed);
    } catch { /* ignore */ }
  }
  try {
    const srcset = (el.getAttribute && el.getAttribute('srcset')) || '';
    if (srcset) {
      const parts = String(srcset).split(',');
      for (const part of parts) {
        const first = part.trim().split(/\s+/)[0] || '';
        if (isUsableUrl(first)) out.push(first);
      }
    }
  } catch { /* ignore */ }
  return out;
}

/**
 * Depth-first walk of light + open shadow roots.
 * @param {Document|DocumentFragment|Element|ShadowRoot} root
 * @param {(el: Element) => void} visit
 * @param {number} [shadowDepth]
 */
function walkElements(root, visit, shadowDepth = 0) {
  if (!root) return;
  let count = 0;

  /** @param {Document|DocumentFragment|Element|ShadowRoot} node */
  const walk = (node) => {
    let list = null;
    try {
      if (node.querySelectorAll) list = node.querySelectorAll('*');
    } catch {
      list = null;
    }
    if (!list) return;

    for (let i = 0; i < list.length; i++) {
      if (count >= MAX_ELEMENTS) return;
      const el = list[i];
      if (!el || el.nodeType !== 1) continue;
      if (isKeyPilotChrome(el)) continue;
      count++;
      visit(el);

      if (shadowDepth < MAX_SHADOW_DEPTH) {
        try {
          const sr = /** @type {Element} */ (el).shadowRoot;
          if (sr) walkElements(sr, visit, shadowDepth + 1);
        } catch { /* ignore */ }
      }
    }
  };

  walk(root);
}

/**
 * Collect page media into Image / Video / Text buckets, plus every unique
 * page URL for the URLs tab (no repeats within that tab).
 * @param {Document|Element} [root]
 * @returns {PageMediaItem[]}
 */
export function collectPageMedia(root = document) {
  /** @type {Map<string, PageMediaItem>} */
  const byUrl = new Map();
  /** @type {Map<string, PageMediaItem>} */
  const allPageUrls = new Map();

  /**
   * Record any navigable/resource URL for the URLs tab (deduped).
   * @param {string} rawUrl
   * @param {Element|null} [el]
   * @param {string} [kind]
   */
  const notePageUrl = (rawUrl, el = null, kind = 'url') => {
    if (!isUsableUrl(rawUrl)) return;
    const trimmed = String(rawUrl).trim();
    if (/^(javascript|mailto|tel|data):/i.test(trimmed)) return;
    const resolved = resolveUrl(trimmed, el);
    if (!isUsableUrl(resolved)) return;
    if (/^(javascript|mailto|tel|data):/i.test(resolved)) return;
    if (allPageUrls.has(resolved)) return;
    const ext = extensionFromUrl(resolved);
    if (shouldExcludeFromUrlTab(resolved, ext, el)) return;
    allPageUrls.set(resolved, {
      category: 'url',
      kind: kind || 'url',
      url: resolved,
      element: el,
      label: resolved,
      ext,
      urlGroup: urlTabGroupForUrl(resolved, ext)
    });
  };

  /**
   * @param {Partial<PageMediaItem> & { category: PageMediaCategory, url: string }} raw
   */
  const add = (raw) => {
    const resolved = resolveUrl(raw.url, raw.element || null);
    if (!isUsableUrl(resolved)) return;
    notePageUrl(resolved, raw.element || null, raw.kind || raw.category);
    if (raw.category === 'url') return;
    if (byUrl.has(resolved)) return;

    const ext = raw.ext || extensionFromUrl(resolved) || '';
    const label = raw.label || filenameFromUrl(resolved) || resolved.slice(0, 48);
    /** @type {PageMediaItem} */
    const item = {
      category: raw.category,
      kind: raw.kind || raw.category,
      url: resolved,
      element: raw.element || null,
      label,
      ext
    };
    if (typeof raw.width === 'number' && raw.width > 0) item.width = raw.width;
    if (typeof raw.height === 'number' && raw.height > 0) item.height = raw.height;
    if (typeof raw.fileSizeBytes === 'number' && raw.fileSizeBytes > 0) item.fileSizeBytes = raw.fileSizeBytes;
    if (typeof raw.dpi === 'number' && raw.dpi > 0) item.dpi = raw.dpi;
    if (raw.mimeType) item.mimeType = String(raw.mimeType);
    if (raw.posterUrl && isUsableUrl(raw.posterUrl)) {
      item.posterUrl = resolveUrl(String(raw.posterUrl), raw.element || null);
      notePageUrl(item.posterUrl, raw.element || null, 'poster');
    }
    if (raw.thumbUrl && isUsableUrl(raw.thumbUrl)) item.thumbUrl = String(raw.thumbUrl);
    byUrl.set(resolved, item);
  };

  /**
   * @param {string} rawUrl
   * @param {Element} el
   * @param {string} [kind]
   */
  const addByExtension = (rawUrl, el, kind) => {
    notePageUrl(rawUrl, el, kind || 'link');
    const resolved = resolveUrl(rawUrl, el);
    if (!isUsableUrl(resolved)) return;
    const ext = extensionFromUrl(resolved);
    const category = categoryFromExtension(ext);
    if (!category) return;
    add({ category, kind: kind || category, url: resolved, element: el, ext });
  };

  walkElements(root, (el) => {
    const tag = String(el.tagName || '').toUpperCase();

    // Skip harvesting URLs from scripts / stylesheets (also filtered in notePageUrl).
    const skipHarvest =
      tag === 'SCRIPT' ||
      tag === 'STYLE' ||
      (tag === 'LINK' && /\bstylesheet\b|\bpreload\b|\bmodulepreload\b/i.test(String(el.getAttribute('rel') || '')));

    if (!skipHarvest) {
      const harvested = harvestAttrUrls(el);
      for (const u of harvested) notePageUrl(u, el, tag.toLowerCase());
      try {
        const data = el.getAttribute('data') || '';
        if (isUsableUrl(data)) notePageUrl(data, el, 'data');
      } catch { /* ignore */ }
      try {
        const action = el.getAttribute('action') || '';
        if (isUsableUrl(action)) notePageUrl(action, el, 'action');
      } catch { /* ignore */ }
      try {
        const cite = el.getAttribute('cite') || '';
        if (isUsableUrl(cite)) notePageUrl(cite, el, 'cite');
      } catch { /* ignore */ }
    }

    // Images
    if (tag === 'IMG') {
      const img = /** @type {HTMLImageElement} */ (el);
      const url = getImgUrl(img);
      if (isUsableUrl(url)) {
        const resolved = resolveUrl(url, el);
        const ext = extensionFromUrl(resolved);
        const nw = Number(img.naturalWidth) || 0;
        const nh = Number(img.naturalHeight) || 0;
        add({
          category: 'image',
          kind: 'img',
          url: resolved,
          element: el,
          ext: ext || 'img',
          label: (img.alt || filenameFromUrl(resolved)),
          width: nw > 0 ? nw : undefined,
          height: nh > 0 ? nh : undefined
        });
      }
    }

    if (tag === 'INPUT' && String(/** @type {HTMLInputElement} */ (el).type || '').toLowerCase() === 'image') {
      try {
        const src = /** @type {HTMLInputElement} */ (el).src || el.getAttribute('src') || '';
        if (isUsableUrl(src)) {
          add({ category: 'image', kind: 'input-image', url: resolveUrl(src, el), element: el });
        }
      } catch { /* ignore */ }
    }

    // CSS background-image
    try {
      const style = window.getComputedStyle && window.getComputedStyle(el);
      const bg = style ? String(style.backgroundImage || '') : '';
      if (bg && bg !== 'none' && /url\s*\(/i.test(bg)) {
        const extracted = extractFirstBackgroundImageUrl(bg);
        if (extracted && isUsableUrl(extracted)) {
          const resolved = resolveUrl(extracted, el);
          notePageUrl(resolved, el, 'background');
          const ext = extensionFromUrl(resolved);
          if (categoryFromExtension(ext) === 'image' || /^(data:image|blob:)/i.test(resolved) || !ext) {
            if (categoryFromExtension(ext) !== 'video' && categoryFromExtension(ext) !== 'text') {
              add({
                category: 'image',
                kind: 'background',
                url: resolved,
                element: el,
                ext: ext || 'bg'
              });
            }
          }
        }
      }
    } catch { /* ignore */ }

    // Video element sources + poster
    if (tag === 'VIDEO') {
      const video = /** @type {HTMLVideoElement} */ (el);
      const posterRaw = getVideoPosterUrl(video);
      const posterResolved = posterRaw ? resolveUrl(posterRaw, el) : '';
      if (posterResolved) {
        add({
          category: 'image',
          kind: 'video-poster',
          url: posterResolved,
          element: el,
          label: filenameFromUrl(posterResolved)
        });
      }
      const sources = getVideoSourceUrls(video);
      for (const src of sources) {
        const resolved = resolveUrl(src, el);
        const ext = extensionFromUrl(resolved);
        add({
          category: 'video',
          kind: 'video',
          url: resolved,
          element: el,
          ext: ext || 'video',
          label: filenameFromUrl(resolved),
          posterUrl: posterResolved || undefined
        });
      }
    }

    if (tag === 'SOURCE') {
      const urls = harvestAttrUrls(el);
      for (const u of urls) addByExtension(u, el, 'source');
    }

    if (tag === 'A' || tag === 'AREA' || tag === 'LINK' || tag === 'EMBED' || tag === 'OBJECT') {
      const urls = harvestAttrUrls(el);
      for (const u of urls) addByExtension(u, el, tag.toLowerCase());
      if (tag === 'OBJECT' || tag === 'EMBED') {
        try {
          const data = el.getAttribute('data') || '';
          if (isUsableUrl(data)) addByExtension(data, el, tag.toLowerCase());
        } catch { /* ignore */ }
      }
    }

    // Any remaining href/src with a known media extension
    if (tag !== 'IMG' && tag !== 'VIDEO' && tag !== 'SOURCE') {
      const urls = harvestAttrUrls(el);
      for (const u of urls) addByExtension(u, el, 'link');
    }
  });

  // Media items first, then URL-tab entries (may overlap media URLs; URLs tab is deduped),
  // then page-text blocks for the Text tab.
  const pageTextItems = collectPageTextItems(root);
  return [...byUrl.values(), ...allPageUrls.values(), ...pageTextItems];
}

const MAX_PAGE_TEXT_BLOCKS = 40;
const MIN_PAGE_TEXT_CHARS = 40;

/**
 * Whole extractable page-text containers (not paragraphs/headings).
 * Prefer <article> / role=article; fall back to <main> / role=main when no articles exist.
 * @type {ReadonlyArray<{ selector: string, kind: string, label: string }>}
 */
const PAGE_TEXT_WHOLE_CONTAINERS = Object.freeze([
  { selector: 'article', kind: 'article', label: 'Article' },
  { selector: '[role="article"]', kind: 'article', label: 'Article' },
  { selector: 'main', kind: 'main', label: 'Main' },
  { selector: '[role="main"]', kind: 'main', label: 'Main' }
]);

/**
 * Extract visible page text from whole containers only (e.g. &lt;article&gt;, &lt;main&gt;).
 * @param {Document|Element} [root]
 * @returns {PageMediaItem[]}
 */
export function collectPageTextItems(root = document) {
  /** @type {PageMediaItem[]} */
  const items = [];
  /** @type {Set<string>} */
  const seenText = new Set();
  /** @type {Set<Element>} */
  const seenEls = new Set();

  /**
   * @param {string} text
   * @returns {string}
   */
  const normalizeKey = (text) => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();

  /**
   * @param {Element} el
   * @returns {boolean}
   */
  const isVisibleWhole = (el) => {
    if (!el || isKeyPilotChrome(el)) return false;
    try {
      if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle && window.getComputedStyle(el);
      if (style) {
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
      }
    } catch { /* ignore */ }
    return true;
  };

  /**
   * @param {string} kind
   * @param {string} text
   * @param {Element|null} el
   * @param {string} label
   */
  const pushBlock = (kind, text, el, label) => {
    const cleaned = String(text || '')
      .replace(/\s+\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (cleaned.length < MIN_PAGE_TEXT_CHARS) return;
    const key = normalizeKey(cleaned);
    if (!key || seenText.has(key)) return;
    seenText.add(key);
    if (items.length >= MAX_PAGE_TEXT_BLOCKS) return;
    const preview = cleaned.length > 96 ? `${cleaned.slice(0, 95)}…` : cleaned;
    items.push({
      category: 'pageText',
      kind,
      url: '',
      element: el,
      label: label || preview,
      ext: 'txt',
      text: cleaned,
      fileSizeBytes: unescape(encodeURIComponent(cleaned)).length
    });
  };

  const scope =
    (root && /** @type {any} */ (root).body) ||
    (root && root.nodeType === 1 ? root : null) ||
    document;

  /** @type {Element[]} */
  const articles = [];
  /** @type {Element[]} */
  const mains = [];

  for (const { selector, kind } of PAGE_TEXT_WHOLE_CONTAINERS) {
    let nodes = [];
    try {
      nodes = Array.from(/** @type {any} */ (scope).querySelectorAll?.(selector) || []);
    } catch {
      nodes = [];
    }
    for (const el of nodes) {
      if (!(el instanceof Element) || seenEls.has(el) || !isVisibleWhole(el)) continue;
      // Skip nested duplicates of the same kind (keep outermost whole units).
      let nestedInSame = false;
      for (const prev of (kind === 'article' ? articles : mains)) {
        if (prev.contains(el)) {
          nestedInSame = true;
          break;
        }
      }
      if (nestedInSame) continue;
      // Drop previously collected nested children of this new outer element.
      if (kind === 'article') {
        for (let i = articles.length - 1; i >= 0; i--) {
          if (el.contains(articles[i])) articles.splice(i, 1);
        }
        articles.push(el);
      } else {
        for (let i = mains.length - 1; i >= 0; i--) {
          if (el.contains(mains[i])) mains.splice(i, 1);
        }
        mains.push(el);
      }
      seenEls.add(el);
    }
  }

  // Prefer articles; only use main when the page has no article wholes.
  /** @type {{ el: Element, kind: string, label: string }[]} */
  const chosen = [];
  if (articles.length) {
    for (const el of articles) chosen.push({ el, kind: 'article', label: 'Article' });
  } else {
    for (const el of mains) chosen.push({ el, kind: 'main', label: 'Main' });
  }

  for (const { el, kind, label } of chosen) {
    if (items.length >= MAX_PAGE_TEXT_BLOCKS) break;
    let text = '';
    try {
      text = String(/** @type {any} */ (el).innerText || el.textContent || '');
    } catch {
      text = String(el.textContent || '');
    }
    // Prefer a heading-derived label when present.
    let title = label;
    try {
      const h = el.querySelector('h1, h2, h3');
      const ht = h ? String(/** @type {any} */ (h).innerText || h.textContent || '').trim() : '';
      if (ht) title = ht.length > 72 ? `${ht.slice(0, 71)}…` : ht;
    } catch { /* ignore */ }
    pushBlock(kind, text, el, title);
  }

  return items;
}

/**
 * @param {PageMediaItem[]} items
 * @returns {{ image: PageMediaItem[], video: PageMediaItem[], text: PageMediaItem[], url: PageMediaItem[], pageText: PageMediaItem[] }}
 */
export function groupPageMediaByCategory(items) {
  /** @type {{ image: PageMediaItem[], video: PageMediaItem[], text: PageMediaItem[], url: PageMediaItem[], pageText: PageMediaItem[] }} */
  const groups = { image: [], video: [], text: [], url: [], pageText: [] };
  for (const item of items || []) {
    if (item?.category === 'image') groups.image.push(item);
    else if (item?.category === 'video') groups.video.push(item);
    else if (item?.category === 'text') groups.text.push(item);
    else if (item?.category === 'url') groups.url.push(item);
    else if (item?.category === 'pageText') groups.pageText.push(item);
  }
  // Sort URLs: web pages → documents → images → video → other; alpha within group.
  groups.url.sort((a, b) => {
    const ga = urlTabGroupSortOrder(a.urlGroup || urlTabGroupForUrl(a.url, a.ext));
    const gb = urlTabGroupSortOrder(b.urlGroup || urlTabGroupForUrl(b.url, b.ext));
    if (ga !== gb) return ga - gb;
    return String(a.url || '').localeCompare(String(b.url || ''));
  });
  return groups;
}

/** Longest-edge bands for Image tab grouping (largest first). */
export const IMAGE_SIZE_GROUP_DEFS = Object.freeze([
  Object.freeze({ id: 'xl', label: 'Extra Large', sortOrder: 0, minEdge: 2561, maxEdge: null }),
  Object.freeze({ id: 'large', label: 'Large', sortOrder: 1, minEdge: 1281, maxEdge: 2560 }),
  Object.freeze({ id: 'medium', label: 'Medium', sortOrder: 2, minEdge: 641, maxEdge: 1280 }),
  Object.freeze({ id: 'small', label: 'Small', sortOrder: 3, minEdge: 257, maxEdge: 640 }),
  Object.freeze({ id: 'tiny', label: 'Tiny', sortOrder: 4, minEdge: 1, maxEdge: 256 }),
  Object.freeze({ id: 'unknown', label: 'Unknown size', sortOrder: 5, minEdge: 0, maxEdge: 0 })
]);

/**
 * @param {PageMediaItem} item
 * @returns {{ id: string, label: string, sortOrder: number, minEdge: number, maxEdge: number|null }}
 */
export function imageSizeGroupForItem(item) {
  const w = Number(item?.width) || 0;
  const h = Number(item?.height) || 0;
  const edge = Math.max(w, h);
  if (!(edge > 0)) {
    return IMAGE_SIZE_GROUP_DEFS[IMAGE_SIZE_GROUP_DEFS.length - 1];
  }
  for (const def of IMAGE_SIZE_GROUP_DEFS) {
    if (def.id === 'unknown') continue;
    if (edge >= def.minEdge && (def.maxEdge == null || edge <= def.maxEdge)) return def;
  }
  return IMAGE_SIZE_GROUP_DEFS[0];
}

/**
 * @param {PageMediaItem|null|undefined} item
 * @returns {boolean}
 */
export function isVideoPosterItem(item) {
  return !!(item && item.category === 'image' && item.kind === 'video-poster');
}

/**
 * Split Image-tab items into regular photos vs video posters.
 * @param {PageMediaItem[]} items
 * @returns {{ photos: PageMediaItem[], posters: PageMediaItem[] }}
 */
export function partitionImageItems(items) {
  /** @type {PageMediaItem[]} */
  const photos = [];
  /** @type {PageMediaItem[]} */
  const posters = [];
  for (const item of items || []) {
    if (!item || item.category !== 'image') continue;
    if (isVideoPosterItem(item)) posters.push(item);
    else photos.push(item);
  }
  return { photos, posters };
}

/**
 * Group images by dimension size band. Within each band, sort by area desc.
 * Skips video-poster items (those belong in a separate Image-tab section).
 * @param {PageMediaItem[]} items
 * @returns {Array<{ id: string, label: string, sortOrder: number, items: PageMediaItem[] }>}
 */
export function groupImagesByDimensionSize(items) {
  /** @type {Map<string, PageMediaItem[]>} */
  const buckets = new Map();
  for (const def of IMAGE_SIZE_GROUP_DEFS) buckets.set(def.id, []);

  for (const item of items || []) {
    if (!item || item.category !== 'image') continue;
    if (isVideoPosterItem(item)) continue;
    const def = imageSizeGroupForItem(item);
    const list = buckets.get(def.id);
    if (list) list.push(item);
  }

  /** @type {Array<{ id: string, label: string, sortOrder: number, items: PageMediaItem[] }>} */
  const out = [];
  for (const def of IMAGE_SIZE_GROUP_DEFS) {
    const list = buckets.get(def.id) || [];
    if (!list.length) continue;
    list.sort((a, b) => {
      const aa = (Number(a.width) || 0) * (Number(a.height) || 0);
      const bb = (Number(b.width) || 0) * (Number(b.height) || 0);
      if (bb !== aa) return bb - aa;
      return String(a.label || '').localeCompare(String(b.label || ''));
    });
    out.push({
      id: def.id,
      label: def.label,
      sortOrder: def.sortOrder,
      items: list
    });
  }
  return out;
}

/**
 * @param {number|null|undefined} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/**
 * @param {PageMediaItem} item
 * @returns {string}
 */
export function formatImageFileType(item) {
  const ext = String(item?.ext || '').toLowerCase();
  if (ext && ext !== 'img' && ext !== 'bg' && ext !== 'video-poster') {
    return ext.toUpperCase() === 'JPEG' ? 'JPG' : ext.toUpperCase();
  }
  const mime = String(item?.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) {
    const sub = mime.slice(6).split('+')[0].split(';')[0];
    if (sub === 'jpeg') return 'JPG';
    if (sub === 'svg+xml' || sub === 'svg') return 'SVG';
    if (sub) return sub.toUpperCase();
  }
  if (/^data:image\//i.test(item?.url || '')) {
    const m = String(item.url).match(/^data:image\/([a-z0-9.+-]+)/i);
    if (m) {
      const sub = m[1].toLowerCase();
      if (sub === 'jpeg') return 'JPG';
      if (sub === 'svg+xml') return 'SVG';
      return sub.toUpperCase();
    }
  }
  return 'IMG';
}

/**
 * @param {PageMediaItem} item
 * @returns {string}
 */
export function formatImageDimensions(item) {
  const w = Number(item?.width) || 0;
  const h = Number(item?.height) || 0;
  if (w > 0 && h > 0) return `${w}×${h}`;
  return '—';
}

/**
 * @param {PageMediaItem} item
 * @returns {string}
 */
export function formatImageDpi(item) {
  const d = Number(item?.dpi);
  if (!Number.isFinite(d) || d <= 0) return '—';
  return `${Math.round(d)} dpi`;
}

/**
 * @param {PageMediaItem} item
 * @returns {string}
 */
export function formatImageMetaLine(item) {
  return [
    formatImageFileType(item),
    formatImageDimensions(item),
    formatImageDpi(item),
    formatFileSize(item?.fileSizeBytes)
  ].join(' · ');
}

/**
 * @param {string} url
 * @returns {number|null}
 */
function dataUrlByteLength(url) {
  if (!url || !/^data:/i.test(url)) return null;
  try {
    const comma = url.indexOf(',');
    if (comma < 0) return null;
    const meta = url.slice(0, comma);
    const data = url.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      const len = data.length;
      const pads = (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
      return Math.max(0, Math.floor((len * 3) / 4) - pads);
    }
    return unescape(encodeURIComponent(data)).length;
  } catch {
    return null;
  }
}

/**
 * Read X/Y resolution (DPI) from JPEG EXIF or PNG pHYs.
 * @param {ArrayBuffer} buf
 * @returns {number|null}
 */
function parseDpiFromImageBytes(buf) {
  if (!buf || buf.byteLength < 24) return null;
  const view = new DataView(buf);
  if (
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a
  ) {
    let offset = 8;
    while (offset + 12 <= view.byteLength) {
      const len = view.getUint32(offset);
      const type =
        String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );
      const dataStart = offset + 8;
      if (type === 'pHYs' && len >= 9 && dataStart + 9 <= view.byteLength) {
        const ppux = view.getUint32(dataStart);
        const unit = view.getUint8(dataStart + 8);
        if (unit === 1 && ppux > 0) return Math.round(ppux * 0.0254);
        return null;
      }
      offset += 12 + len;
      if (type === 'IEND') break;
    }
    return null;
  }

  if (view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1 && size >= 8) {
      const start = offset + 4;
      const end = offset + 2 + size;
      if (start + 6 > view.byteLength) break;
      const head = String.fromCharCode(
        view.getUint8(start),
        view.getUint8(start + 1),
        view.getUint8(start + 2),
        view.getUint8(start + 3)
      );
      if (head === 'Exif') {
        const tiffStart = start + 6;
        if (tiffStart + 8 > view.byteLength) break;
        const le = view.getUint16(tiffStart) === 0x4949;
        const u16 = (o) => (le ? view.getUint16(o, true) : view.getUint16(o, false));
        const u32 = (o) => (le ? view.getUint32(o, true) : view.getUint32(o, false));
        const ifd0 = tiffStart + u32(tiffStart + 4);
        if (ifd0 + 2 > end) break;
        const entries = u16(ifd0);
        let xRes = null;
        let yRes = null;
        let unit = 2;
        for (let i = 0; i < entries; i++) {
          const e = ifd0 + 2 + i * 12;
          if (e + 12 > end) break;
          const tag = u16(e);
          const type = u16(e + 2);
          const count = u32(e + 4);
          const valOff = e + 8;
          const readRational = (off) => {
            if (off + 8 > view.byteLength) return null;
            const num = u32(off);
            const den = u32(off + 4);
            if (!den) return null;
            return num / den;
          };
          if (tag === 0x011a && type === 5 && count === 1) {
            xRes = readRational(tiffStart + u32(valOff));
          } else if (tag === 0x011b && type === 5 && count === 1) {
            yRes = readRational(tiffStart + u32(valOff));
          } else if (tag === 0x0128 && type === 3 && count === 1) {
            unit = u16(valOff);
          }
        }
        const res = xRes || yRes;
        if (res && res > 0) {
          if (unit === 3) return Math.round(res * 2.54);
          return Math.round(res);
        }
      }
    }
    if (size < 2) break;
    offset += 2 + size;
    if (marker === 0xda) break;
  }
  return null;
}

/**
 * @param {PageMediaItem} item
 * @returns {Promise<PageMediaItem>}
 */
export async function enrichImageMetadata(item) {
  if (!item || item.category !== 'image' || !item.url) return item;

  try {
    const el = item.element;
    if (el && el.tagName === 'IMG') {
      const img = /** @type {HTMLImageElement} */ (el);
      const nw = Number(img.naturalWidth) || 0;
      const nh = Number(img.naturalHeight) || 0;
      if (nw > 0 && nh > 0) {
        item.width = nw;
        item.height = nh;
      }
    }
  } catch { /* ignore */ }

  const dataBytes = dataUrlByteLength(item.url);
  if (dataBytes != null) item.fileSizeBytes = dataBytes;

  const needDims = !(Number(item.width) > 0 && Number(item.height) > 0);
  const needSize = !(Number(item.fileSizeBytes) > 0);
  const needDpi = !(Number(item.dpi) > 0);

  if (needDims) {
    try {
      const dims = await loadImageDimensions(item.url);
      if (dims) {
        item.width = dims.width;
        item.height = dims.height;
      }
    } catch { /* ignore */ }
  }

  if ((needSize || needDpi) && !/^data:/i.test(item.url)) {
    try {
      const meta = await fetchImageNetworkMeta(item.url, { needSize, needDpi });
      if (meta.fileSizeBytes != null && !(Number(item.fileSizeBytes) > 0)) {
        item.fileSizeBytes = meta.fileSizeBytes;
      }
      if (meta.dpi != null && !(Number(item.dpi) > 0)) item.dpi = meta.dpi;
      if (meta.mimeType && !item.mimeType) item.mimeType = meta.mimeType;
      if (meta.ext && (!item.ext || item.ext === 'img' || item.ext === 'bg')) {
        item.ext = meta.ext;
      }
    } catch { /* ignore */ }
  }

  if (needDpi && /^data:/i.test(item.url) && !(Number(item.dpi) > 0)) {
    try {
      const res = await fetch(item.url);
      const buf = await res.arrayBuffer();
      const dpi = parseDpiFromImageBytes(buf.slice(0, Math.min(buf.byteLength, 65536)));
      if (dpi) item.dpi = dpi;
      if (!item.mimeType) {
        const ct = res.headers.get('content-type');
        if (ct) item.mimeType = ct;
      }
    } catch { /* ignore */ }
  }

  return item;
}

/**
 * @param {string} url
 * @returns {Promise<{ width: number, height: number }|null>}
 */
function loadImageDimensions(url) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      let settled = false;
      const done = (val) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };
      img.onload = () => {
        const w = Number(img.naturalWidth) || 0;
        const h = Number(img.naturalHeight) || 0;
        done(w > 0 && h > 0 ? { width: w, height: h } : null);
      };
      img.onerror = () => done(null);
      try { img.decoding = 'async'; } catch { /* ignore */ }
      img.src = url;
      setTimeout(() => done(null), 8000);
    } catch {
      resolve(null);
    }
  });
}

/**
 * @param {string} url
 * @param {{ needSize?: boolean, needDpi?: boolean }} [opts]
 * @returns {Promise<{ fileSizeBytes?: number, dpi?: number, mimeType?: string, ext?: string }>}
 */
async function fetchImageNetworkMeta(url, opts = {}) {
  /** @type {{ fileSizeBytes?: number, dpi?: number, mimeType?: string, ext?: string }} */
  const out = {};
  const needSize = opts.needSize !== false;
  const needDpi = !!opts.needDpi;

  if (needSize) {
    try {
      const head = await fetch(url, { method: 'HEAD', credentials: 'omit', cache: 'force-cache' });
      if (head.ok) {
        const len = head.headers.get('content-length');
        if (len && /^\d+$/.test(len)) out.fileSizeBytes = Number(len);
        const ct = head.headers.get('content-type');
        if (ct) {
          out.mimeType = ct;
          const m = ct.match(/image\/([a-z0-9.+-]+)/i);
          if (m) {
            let sub = m[1].toLowerCase();
            if (sub === 'jpeg') sub = 'jpg';
            if (sub === 'svg+xml') sub = 'svg';
            out.ext = sub.split('+')[0];
          }
        }
      }
    } catch { /* ignore */ }
  }

  if (needDpi || out.fileSizeBytes == null) {
    try {
      let res = await fetch(url, {
        method: 'GET',
        credentials: 'omit',
        cache: 'force-cache',
        headers: needDpi ? { Range: 'bytes=0-65535' } : undefined
      });
      if (!res.ok && res.status !== 206) {
        res = await fetch(url, { method: 'GET', credentials: 'omit', cache: 'force-cache' });
      }
      if (res.ok || res.status === 206) {
        const ct = res.headers.get('content-type');
        if (ct && !out.mimeType) out.mimeType = ct;
        if (out.fileSizeBytes == null) {
          const cr = res.headers.get('content-range');
          const m = cr && cr.match(/\/(\d+)\s*$/);
          if (m) out.fileSizeBytes = Number(m[1]);
          else {
            const len = res.headers.get('content-length');
            if (len && /^\d+$/.test(len) && res.status !== 206) out.fileSizeBytes = Number(len);
          }
        }
        if (needDpi) {
          const buf = await res.arrayBuffer();
          const dpi = parseDpiFromImageBytes(buf);
          if (dpi) out.dpi = dpi;
          if (out.fileSizeBytes == null && res.status !== 206) {
            out.fileSizeBytes = buf.byteLength;
          }
        }
      }
    } catch { /* ignore */ }
  }

  return out;
}

/**
 * Enrich all image items; calls onProgress after each item (for live UI updates).
 * @param {PageMediaItem[]} items
 * @param {{ concurrency?: number, onProgress?: (item: PageMediaItem, index: number) => void }} [opts]
 * @returns {Promise<PageMediaItem[]>}
 */
export async function enrichImageItems(items, opts = {}) {
  const list = (items || []).filter((i) => i && i.category === 'image');
  const concurrency = Math.max(1, Math.min(8, Number(opts.concurrency) || 4));
  let cursor = 0;

  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor++;
      const item = list[index];
      try {
        await enrichImageMetadata(item);
      } catch { /* ignore */ }
      if (typeof opts.onProgress === 'function') {
        try { opts.onProgress(item, index); } catch { /* ignore */ }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()));
  return list;
}

/**
 * Best still for a Video-tab card: cached thumb → poster URL → live <video> frame
 * → decoded frame from the media URL. Returns a displayable image URL or null.
 * Caches on `item.thumbUrl`.
 * @param {PageMediaItem} item
 * @returns {Promise<string|null>}
 */
export async function resolveVideoThumbnail(item) {
  if (!item || item.category !== 'video') return null;
  if (item.thumbUrl && isUsableUrl(item.thumbUrl)) return item.thumbUrl;
  if (item.posterUrl && isUsableUrl(item.posterUrl)) {
    item.thumbUrl = item.posterUrl;
    return item.posterUrl;
  }

  // Capture from the page's <video> if it already has a decoded frame.
  try {
    const el = item.element;
    if (el && String(el.tagName || '').toUpperCase() === 'VIDEO') {
      const fromEl = await captureFrameFromVideoElement(/** @type {HTMLVideoElement} */ (el));
      if (fromEl) {
        item.thumbUrl = fromEl;
        return fromEl;
      }
    }
  } catch { /* ignore */ }

  // Load the media URL off-DOM and grab an early frame (CORS permitting).
  try {
    const fromUrl = await captureFrameFromVideoUrl(item.url);
    if (fromUrl) {
      item.thumbUrl = fromUrl;
      return fromUrl;
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * @param {HTMLVideoElement} video
 * @returns {Promise<string|null>} object URL or null
 */
async function captureFrameFromVideoElement(video) {
  if (!video) return null;
  try {
    const ready = typeof video.readyState === 'number' ? video.readyState : 0;
    const w = Number(video.videoWidth) || 0;
    const h = Number(video.videoHeight) || 0;
    if (ready < 2 || w < 1 || h < 1) return null;
    return canvasFrameToObjectUrl(video, w, h);
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @returns {Promise<string|null>}
 */
function captureFrameFromVideoUrl(url) {
  if (!isUsableUrl(url) || /^data:/i.test(url)) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      try { video.removeAttribute('src'); video.load(); } catch { /* ignore */ }
      try { video.remove(); } catch { /* ignore */ }
      resolve(val);
    };

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    try { video.crossOrigin = 'anonymous'; } catch { /* ignore */ }

    const timer = setTimeout(() => done(null), 10000);

    const seekAndCapture = async () => {
      try {
        const dur = Number(video.duration);
        const t = Number.isFinite(dur) && dur > 0
          ? Math.min(0.5, Math.max(0.05, dur * 0.05))
          : 0.1;
        if (Math.abs((Number(video.currentTime) || 0) - t) > 0.01) {
          await new Promise((res, rej) => {
            const onSeeked = () => { cleanup(); res(undefined); };
            const onErr = () => { cleanup(); rej(new Error('seek')); };
            const cleanup = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onErr);
            };
            video.addEventListener('seeked', onSeeked, { once: true });
            video.addEventListener('error', onErr, { once: true });
            try { video.currentTime = t; } catch (e) { cleanup(); rej(e); }
          });
        }
        const w = Number(video.videoWidth) || 0;
        const h = Number(video.videoHeight) || 0;
        if (w < 1 || h < 1) {
          clearTimeout(timer);
          done(null);
          return;
        }
        const urlOut = await canvasFrameToObjectUrl(video, w, h);
        clearTimeout(timer);
        done(urlOut);
      } catch {
        clearTimeout(timer);
        done(null);
      }
    };

    video.addEventListener('loadeddata', () => { seekAndCapture(); }, { once: true });
    video.addEventListener('error', () => {
      clearTimeout(timer);
      done(null);
    }, { once: true });

    try {
      video.src = url;
    } catch {
      clearTimeout(timer);
      done(null);
    }
  });
}

/**
 * @param {HTMLVideoElement} video
 * @param {number} width
 * @param {number} height
 * @returns {Promise<string|null>}
 */
async function canvasFrameToObjectUrl(video, width, height) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => {
      try {
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      } catch {
        resolve(null);
      }
    });
    if (!blob || blob.size < 1) return null;
    return URL.createObjectURL(blob);
  } catch {
    // Typically canvas tainted by CORS
    return null;
  }
}

export const PAGE_MEDIA_EXTENSIONS = Object.freeze({
  image: IMAGE_EXTS,
  video: VIDEO_EXTS,
  text: TEXT_EXTS
});
