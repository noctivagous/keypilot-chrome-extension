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
