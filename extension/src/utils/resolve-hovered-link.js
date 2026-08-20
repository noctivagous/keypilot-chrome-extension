/**
 * Resolve a navigable URL from a hover / activation target.
 *
 * 1) Ancestor <a href> or [role=link][data-kp-url] (incl. open-shadow host hops)
 * 2) If the pointer is on a card body with no wrapping link (X/Mastodon feeds,
 *    many article rows), pick a descendant permalink — especially <a><time>
 *    and /status|/posts paths — not profile / analytics / media chrome.
 */

/**
 * @param {Node|null|undefined} node
 * @returns {Element|null}
 */
function composedParent(node) {
  if (!node || node.nodeType !== 1) return null;
  const el = /** @type {Element} */ (node);
  if (el.parentElement) return el.parentElement;
  try {
    const root = typeof el.getRootNode === 'function' ? el.getRootNode() : null;
    if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
      return root.host || null;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * @param {string} href
 * @returns {string}
 */
function pathOf(href) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      return new URL(raw, location.href).pathname || '';
    }
  } catch { /* ignore */ }
  const cut = raw.split(/[?#]/)[0];
  return cut.startsWith('/') ? cut : `/${cut}`;
}

/**
 * @param {Element} a
 * @returns {number} 0 = ignore; higher = better permalink
 */
function permalinkScore(a) {
  const raw = (a.getAttribute('href') || '').trim();
  if (!raw || raw === '#' || raw.toLowerCase().startsWith('javascript:')) return 0;

  let abs = '';
  try { abs = String(/** @type {HTMLAnchorElement} */ (a).href || ''); } catch { abs = raw; }
  const path = pathOf(abs || raw).toLowerCase();
  if (!path || path === '/') return 0;

  if (
    /\/status\/\d+\/(analytics|photo|video|quotes?|likes?|retweets?|media)\b/.test(path) ||
    /\/(analytics|photo|video)\/\d+/.test(path) ||
    /\/i\/(web|flow|premium|bookmarks)\b/.test(path) ||
    path.startsWith('/intent/')
  ) {
    return 0;
  }

  let score = 0;
  try {
    if (typeof a.querySelector === 'function' && a.querySelector('time')) score += 50;
  } catch { /* ignore */ }
  try {
    const rel = (a.getAttribute('rel') || '').toLowerCase();
    if (rel.includes('bookmark')) score += 40;
  } catch { /* ignore */ }

  if (/\/status\/\d+\/?$/.test(path)) score += 40;
  else if (/\/status\/\d+/.test(path)) score += 20;
  if (/\/(posts|post|notes|note|statuses|activity|objects|story|stories|entry|entries|comments)\//.test(path)) {
    score += 30;
  }
  try {
    if (typeof a.querySelector === 'function' && a.querySelector('h1, h2, h3')) score += 25;
  } catch { /* ignore */ }

  const segs = path.replace(/\/+$/, '').split('/').filter(Boolean);
  if (segs.length >= 3) score += 8;
  else if (segs.length === 2) score += 4;
  else if (segs.length === 1) score += 1;

  return score;
}

/**
 * @param {Element} host
 * @returns {{ url: string, link: Element }|null}
 */
function resolveDescendantPermalink(host) {
  if (!host || host.nodeType !== 1) return null;

  /** @type {Element[]} */
  const anchors = [];
  const seen = new Set();
  const collect = (root, depth) => {
    if (!root || depth > 4) return;
    try {
      if (typeof root.querySelectorAll === 'function') {
        const list = root.querySelectorAll('a[href]');
        for (let i = 0; i < list.length; i++) {
          const a = list[i];
          if (seen.has(a)) continue;
          seen.add(a);
          anchors.push(a);
        }
      }
    } catch { /* ignore */ }
    try {
      const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (let i = 0; i < all.length; i++) {
        const sr = all[i].shadowRoot;
        if (sr) collect(sr, depth + 1);
      }
    } catch { /* ignore */ }
  };
  collect(host, 0);
  try {
    if (host.shadowRoot) collect(host.shadowRoot, 1);
  } catch { /* ignore */ }

  let best = null;
  let bestScore = 0;
  for (const a of anchors) {
    const score = permalinkScore(a);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  // Require a real permalink signal so we don't pick a lone profile / t.co chip.
  if (!best || bestScore < 10) return null;
  let url = '';
  try { url = String(/** @type {HTMLAnchorElement} */ (best).href || '').trim(); } catch { url = ''; }
  if (!url) return null;
  return { url, link: best };
}

/**
 * @param {Element} el
 * @returns {Element}
 */
function findPermalinkCardHost(el) {
  let n = el;
  let depth = 0;
  while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement && depth++ < 16) {
    const role = ((n.getAttribute && n.getAttribute('role')) || '').trim().toLowerCase();
    if (n.tagName === 'ARTICLE' || role === 'article') return n;
    n = n.parentElement || composedParent(n);
  }
  return el;
}

/**
 * @param {Element|null|undefined} el
 * @returns {{ url: string, link: Element }|null}
 */
export function resolveHoveredLink(el) {
  if (!el || el.nodeType !== 1) return null;

  let probe = /** @type {Element} */ (el);
  let guard = 0;
  while (probe && probe.nodeType === 1 && guard++ < 12) {
    try {
      if (probe.tagName === 'A') {
        const href = String(/** @type {HTMLAnchorElement} */ (probe).href || '').trim();
        if (href && !href.toLowerCase().startsWith('javascript:')) {
          return { url: href, link: probe };
        }
      }
    } catch { /* ignore */ }

    try {
      const a = typeof probe.closest === 'function' ? probe.closest('a[href]') : null;
      if (a && a.tagName === 'A') {
        const href = String(/** @type {HTMLAnchorElement} */ (a).href || '').trim();
        if (href && !href.toLowerCase().startsWith('javascript:')) {
          return { url: href, link: a };
        }
      }
    } catch { /* ignore */ }

    try {
      let roleLink = probe;
      if (roleLink.getAttribute?.('role') !== 'link') {
        roleLink = roleLink.closest?.('[role="link"]') || null;
      }
      if (roleLink && roleLink.getAttribute('role') === 'link' && roleLink.dataset?.kpUrl) {
        const url = String(roleLink.dataset.kpUrl || '').trim();
        if (url) return { url, link: roleLink };
      }
    } catch { /* ignore */ }

    const root = typeof probe.getRootNode === 'function' ? probe.getRootNode() : null;
    if (!(typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) || !(root.host instanceof Element)) {
      break;
    }
    probe = root.host;
  }

  const card = findPermalinkCardHost(/** @type {Element} */ (el));
  return resolveDescendantPermalink(card);
}

/**
 * Normalize a URL to origin + pathname (no query/hash, no trailing slash).
 * @param {string} href
 * @returns {string}
 */
export function normalizeActivationDest(href) {
  const raw = String(href || '').trim();
  if (!raw || raw === '#' || raw.toLowerCase().startsWith('javascript:')) return '';
  try {
    const u = new URL(raw, typeof location !== 'undefined' ? location.href : undefined);
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/';
    return `${u.origin}${path}`.toLowerCase();
  } catch {
    return raw.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Href on `el` itself — not an ancestor card link.
 * @param {Element} el
 * @returns {string}
 */
function ownNavigableHref(el) {
  if (!el || el.nodeType !== 1) return '';
  try {
    if (el.tagName === 'A') {
      const href = String(/** @type {HTMLAnchorElement} */ (el).href || '').trim();
      return normalizeActivationDest(href);
    }
  } catch { /* ignore */ }
  try {
    if ((el.getAttribute('role') || '').trim().toLowerCase() === 'link') {
      const data = String(el.dataset?.kpUrl || el.getAttribute('href') || '').trim();
      if (data) return normalizeActivationDest(data);
    }
  } catch { /* ignore */ }
  return '';
}

const JS_NAV_DEST_ATTRS = Object.freeze([
  'data-href',
  'data-url',
  'data-link',
  'data-nav',
  'data-destination',
  'data-kp-url'
]);

/**
 * JS-driven navigation dest on `el` itself (not an ancestor).
 * @param {Element} el
 * @returns {string}
 */
function ownJsNavigableDest(el) {
  if (!el || el.nodeType !== 1) return '';
  for (let i = 0; i < JS_NAV_DEST_ATTRS.length; i++) {
    let raw = '';
    try { raw = String(el.getAttribute(JS_NAV_DEST_ATTRS[i]) || '').trim(); } catch { raw = ''; }
    const dest = normalizeActivationDest(raw);
    if (dest) return dest;
  }
  return '';
}

/**
 * Normalized inline onclick text. Empty when missing.
 * @param {Element} el
 * @returns {string}
 */
function ownOnclickToken(el) {
  if (!el || el.nodeType !== 1) return '';
  let raw = '';
  try { raw = String(el.getAttribute('onclick') || '').replace(/\s+/g, ' ').trim(); } catch { raw = ''; }
  return raw ? raw.slice(0, 180).toLowerCase() : '';
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
export function isOwnActionControl(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag === 'BUTTON') return true;
  let role = '';
  try { role = (el.getAttribute('role') || '').trim().toLowerCase(); } catch { role = ''; }
  if (role === 'button' || role === 'menuitem' || role === 'tab') return true;
  try {
    if (el.getAttribute('aria-haspopup')) return true;
  } catch { /* ignore */ }
  if (tag === 'INPUT') {
    let t = '';
    try { t = String(/** @type {HTMLInputElement} */ (el).type || '').toLowerCase(); } catch { t = ''; }
    return t === 'button' || t === 'submit' || t === 'reset' || t === 'checkbox' || t === 'radio';
  }
  return false;
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isImpliedPermalinkHost(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    const role = (el.getAttribute('role') || '').trim().toLowerCase();
    if (el.tagName === 'ARTICLE' || role === 'article') return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * Stable id for what F would do on `el`.
 * - `nav:` + normalized URL for links, data-href/data-url cards, implied permalinks
 * - `js:` + inline onclick text for JS-only destinations
 * - `act:` + testid/label for buttons and other actions
 *
 * Does not walk up to an ancestor <a> — that would make Like inherit the tweet URL.
 * Action controls stay `act:` even if they also have data-href (Add to Cart).
 *
 * @param {Element|null|undefined} el
 * @returns {string} empty when unknown
 */
export function resolveActivationIdentity(el) {
  if (!el || el.nodeType !== 1) return '';

  const own = ownNavigableHref(el);
  if (own) return `nav:${own}`;

  if (isOwnActionControl(el)) {
    let testid = '';
    let label = '';
    let role = '';
    try { testid = String(el.getAttribute('data-testid') || '').trim(); } catch { /* ignore */ }
    try { label = String(el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48); } catch { /* ignore */ }
    try { role = String(el.getAttribute('role') || '').trim().toLowerCase(); } catch { /* ignore */ }
    const key = testid || label || role || el.tagName;
    return `act:${String(key).toLowerCase()}`;
  }

  const dataDest = ownJsNavigableDest(el);
  if (dataDest) return `nav:${dataDest}`;

  const onclickTok = ownOnclickToken(el);
  if (onclickTok) return `js:${onclickTok}`;

  if (isImpliedPermalinkHost(el)) {
    const perma = resolveDescendantPermalink(el);
    if (perma?.url) {
      const dest = normalizeActivationDest(perma.url);
      if (dest) return `nav:${dest}`;
    }
  }

  return '';
}

/**
 * True when F on `leaf` would do the same thing as F on `host`.
 * @param {Element|null|undefined} leaf
 * @param {Element|null|undefined} host
 * @returns {boolean}
 */
export function activationIdentitiesMatch(leaf, host) {
  const a = resolveActivationIdentity(leaf);
  const b = resolveActivationIdentity(host);
  return !!(a && b && a === b);
}
