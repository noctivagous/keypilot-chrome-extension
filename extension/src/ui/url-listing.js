/**
 * Shared URL listing helpers.
 *
 * Goal: centralize how we render "lists of URLs" across the extension:
 * - Omnibox suggestions
 * - History popovers
 * - Top sites / bookmarks surfaces
 *
 * Supports:
 * - list + grid views
 * - container creation (scroll wrappers)
 * - per-usage customization via callbacks and class/style overrides
 */

/**
 * @typedef {'list'|'grid'} UrlListingView
 */

/**
 * @typedef {object} UrlListClassNames
 * @property {string} [container]
 * @property {string} [row]
 * @property {string} [rowSelected]
 * @property {string} [content]
 * @property {string} [text]
 * @property {string} [title]
 * @property {string} [meta]
 * @property {string} [url]
 * @property {string} [favicon]
 */

/**
 * @typedef {object} UrlListingItemParts
 * @property {HTMLElement} row
 * @property {HTMLElement} content
 * @property {HTMLElement} text
 * @property {HTMLElement} titleEl
 * @property {HTMLElement} metaEl
 * @property {HTMLElement} urlEl
 * @property {HTMLImageElement|null} faviconEl
 */

const GENERIC_FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#ffffff" fill-opacity="0.78" d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2Zm0 2c-1.5 0-2.93.35-4.2.98.58.5 1.27 1.33 1.9 2.6.82-.28 1.74-.44 2.3-.48V4Zm2 0v3.1c.56.04 1.48.2 2.3.48.63-1.27 1.32-2.1 1.9-2.6A7.95 7.95 0 0 0 14 4Zm-6.72 2.2A7.99 7.99 0 0 0 4.07 11h3.21c.06-1.39.29-2.65.63-3.74-.24-.5-.45-.84-.63-1.06ZM19.93 11A7.99 7.99 0 0 0 16.72 6.2c-.18.22-.39.56-.63 1.06.34 1.09.57 2.35.63 3.74h3.21ZM9.3 8.73c-.24.8-.41 1.74-.46 2.77h3.16V9.15c-.9.05-1.85.22-2.7.58Zm5.4 0c-.85-.36-1.8-.53-2.7-.58v2.35h3.16c-.05-1.03-.22-1.97-.46-2.77ZM4.07 13a7.99 7.99 0 0 0 3.21 4.8c.18-.22.39-.56.63-1.06-.34-1.09-.57-2.35-.63-3.74H4.07Zm4.77 0c.05 1.03.22 1.97.46 2.77.85.36 1.8.53 2.7.58V13H8.84Zm3.16 3.85c-.56-.04-1.48-.2-2.3-.48-.63 1.27-1.32 2.1-1.9 2.6A7.95 7.95 0 0 0 12 20v-3.15Zm2 0V20c1.5 0 2.93-.35 4.2-.98-.58-.5-1.27-1.33-1.9-2.6-.82.28-1.74.44-2.3.48Zm1.16-3.85H12v3.35c.9-.05 1.85-.22 2.7-.58.24-.8.41-1.74.46-2.77Zm1.56 3.74c.24.5.45.84.63 1.06a7.99 7.99 0 0 0 3.21-4.8h-3.21c-.06 1.39-.29 2.65-.63 3.74Z"/>
</svg>
`.trim();

/** @type {string} */
export const GENERIC_FAVICON_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(GENERIC_FAVICON_SVG)}`;

/**
 * @param {string} url
 * @param {number} [size]
 */
export function getChromeFavicon2Url(url, size = 32) {
  const u = String(url || '').trim();
  const s = Number(size) || 32;
  return `chrome://favicon2/?size=${encodeURIComponent(String(s))}&pageUrl=${encodeURIComponent(u)}`;
}

/**
 * Strip a leading "www." from a host (or host+port / host+path fragment) for display.
 * @param {string} hostOrUrlPart
 * @returns {string}
 */
export function stripWwwPrefix(hostOrUrlPart) {
  return String(hostOrUrlPart || '').replace(/^www\./i, '');
}

/**
 * Extracts and formats a URL for display: removes protocol and leading www.
 * @param {string} url
 * @returns {string} cleaned URL string (no protocol / no leading www.)
 */
export function formatUrlForDisplay(url) {
  const u = String(url || '').trim();
  if (!u) return '';

  try {
    // Remove protocol (http://, https://, etc.), then leading www.
    let cleanUrl = u.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    cleanUrl = stripWwwPrefix(cleanUrl);
    return cleanUrl;
  } catch {
    return stripWwwPrefix(u.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, ''));
  }
}

/**
 * Extract hostname without leading www. for display/grouping.
 * @param {string} url
 * @returns {string}
 */
export function extractDomain(url) {
  try {
    const hostname = new URL(String(url || '').trim()).hostname || '';
    return stripWwwPrefix(hostname);
  } catch {
    return '';
  }
}

/**
 * Parse a URL into domain + path lines for three-line listings.
 * Domain never includes a leading "www.".
 *
 * @param {string} rawUrl
 * @returns {{ domain: string, path: string }}
 */
export function parseUrlForThreeLineDisplay(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) return { domain: '', path: '' };

  try {
    const u = new URL(input, 'https://example.invalid');
    const scheme = (u.protocol || '').replace(/:$/, '');
    const hostOnly = stripWwwPrefix(u.hostname || '');
    const host = hostOnly + (u.port ? `:${u.port}` : '');

    // Domain line: prefer host if present; otherwise fall back to scheme.
    const domain = host || scheme || stripWwwPrefix(input);

    // Path line: everything after the domain: pathname + search + hash.
    // Keep '/' for empty paths so the third line isn't blank for homepages.
    const pathname = u.pathname || '';
    const rest = `${pathname || ''}${u.search || ''}${u.hash || ''}`;
    const path = rest || (host ? '/' : '');

    return { domain, path };
  } catch {
    // Very defensive fallback: attempt split on first slash after scheme.
    const m = input.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^\/?#]+)([^\s]*)?$/);
    if (m) {
      const domain = stripWwwPrefix(m[1] || input);
      const path = m[2] || '/';
      return { domain, path };
    }
    return { domain: stripWwwPrefix(input), path: '' };
  }
}

/**
 * Extract path + search + hash for display (empty string for bare `/`).
 * @param {string} url
 * @returns {string}
 */
export function extractPath(url) {
  try {
    const urlObj = new URL(String(url || '').trim());
    const path = `${urlObj.pathname || ''}${urlObj.search || ''}${urlObj.hash || ''}`;
    return path === '/' ? '' : path;
  } catch {
    return '';
  }
}

/**
 * Preferred MV3 approach:
 * - Requires "favicon" permission in manifest.
 * - For content scripts injecting DOM into pages, the internal path must be declared
 *   in web_accessible_resources (e.g. "_favicon/*").
 *
 * @param {string} pageUrl
 * @param {number} [size]
 */
export function getExtensionFaviconUrl(pageUrl, size = 32) {
  const u = String(pageUrl || '').trim();
  const s = Number(size) || 32;

  try {
    if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
      const url = new URL(chrome.runtime.getURL('/_favicon/'));
      url.searchParams.set('pageUrl', u);
      url.searchParams.set('size', String(s));
      return url.toString();
    }
  } catch {
    // ignore
  }

  // Fallback (older behavior / environments without runtime.getURL)
  return getChromeFavicon2Url(u, s);
}

/**
 * Paint Chrome `/_favicon/` immediately; on error use a generic SVG.
 * High-res Google s2 / SW probe is parked in unused/page-previews/.
 *
 * @param {HTMLImageElement} img
 * @param {string} pageUrl
 * @param {object} [opts]
 * @param {number} [opts.displaySize] CSS/display box size
 * @param {string} [opts.fallbackUrl]
 * @param {boolean} [opts.highRes] ignored (parked)
 */
export function attachFaviconWithUpgrade(img, pageUrl, opts = {}) {
  if (!img) return;
  const url = String(pageUrl || '').trim();
  const displaySize = Math.max(12, Number(opts.displaySize) || 32);
  const fallback =
    typeof opts.fallbackUrl === 'string' && opts.fallbackUrl
      ? opts.fallbackUrl
      : GENERIC_FAVICON_DATA_URL;

  try {
    img.alt = img.alt || '';
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    img.loading = img.loading || 'lazy';
  } catch {
    // ignore
  }

  const chromeUrl = getExtensionFaviconUrl(url, Math.min(128, Math.max(32, displaySize * 2)));
  try {
    img.src = chromeUrl;
  } catch {
    // ignore
  }

  img.addEventListener('error', () => {
    try {
      img.src = fallback;
      img.dataset.kpFaviconFallback = 'true';
    } catch {
      // ignore
    }
  }, { once: true });
}

/**
 * @param {Document} doc
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.size]
 * @param {string} [opts.faviconUrl]
 * @param {string} [opts.fallbackUrl]
 * @param {boolean} [opts.highRes] ignored (parked)
 */
export function createFaviconImg(doc, url, { size = 18, faviconUrl, fallbackUrl, highRes: _highRes = true } = {}) {
  const d = doc || document;
  const img = /** @type {HTMLImageElement} */ (d.createElement('img'));
  img.alt = '';
  img.referrerPolicy = 'no-referrer';
  img.decoding = 'async';
  img.loading = 'lazy';
  img.width = size;
  img.height = size;
  const fallback = typeof fallbackUrl === 'string' && fallbackUrl ? fallbackUrl : GENERIC_FAVICON_DATA_URL;

  if (typeof faviconUrl === 'string' && faviconUrl) {
    img.src = faviconUrl;
    img.addEventListener(
      'error',
      () => {
        attachFaviconWithUpgrade(img, url, {
          displaySize: size,
          fallbackUrl: fallback
        });
      },
      { once: true }
    );
    return img;
  }

  attachFaviconWithUpgrade(img, url, {
    displaySize: size,
    fallbackUrl: fallback
  });

  return img;
}

/**
 * Creates a container appropriate for URL listings (optionally scrollable).
 *
 * @param {object} params
 * @param {Document} [params.doc]
 * @param {UrlListingView} [params.view]
 * @param {string} [params.className]
 * @param {Partial<CSSStyleDeclaration>} [params.style]
 * @param {boolean} [params.useInlineStyles]
 * @param {string} [params.maxHeight] e.g. '40vh'
 * @param {boolean} [params.scrollY]
 * @returns {HTMLElement}
 */
export function createUrlListingContainer({
  doc,
  view = 'list',
  className = '',
  style = {},
  useInlineStyles = true,
  maxHeight,
  scrollY = true
} = {}) {
  const d = doc || document;
  const el = d.createElement('div');
  if (className) el.className = className;
  el.dataset.kpUrlListingView = view;

  if (useInlineStyles) {
    Object.assign(el.style, {
      display: view === 'grid' ? 'grid' : 'block',
      ...(scrollY ? { overflowY: 'auto' } : {}),
      ...(maxHeight ? { maxHeight } : {})
    });
  }

  if (style && typeof style === 'object') {
    Object.assign(el.style, style);
  }

  return el;
}

/**
 * Render a URL listing into a container.
 *
 * Callers can customize:
 * - how to read title/url/meta/favicon
 * - selection
 * - per-row DOM additions via `decorateRow`
 *
 * @template T
 * @param {object} params
 * @param {HTMLElement} params.container
 * @param {T[]} params.items
 * @param {UrlListingView} [params.view]
 * @param {UrlListClassNames} [params.classNames]
 * @param {boolean} [params.useInlineStyles]
 * @param {string} [params.emptyText]
 * @param {(item: T, idx: number) => string} [params.getTitle]
 * @param {(item: T, idx: number) => string} [params.getUrl]
 * @param {(item: T, idx: number) => string} [params.getMeta]
 * @param {(item: T, idx: number) => string} [params.getFaviconUrl]
 * @param {boolean} [params.showFavicon]
 * @param {boolean} [params.showUrlLine]
 * @param {boolean} [params.showMetaLine]
 * @param {number} [params.selectedIndex]
 * @param {(item: T, idx: number) => boolean} [params.isSelected]
 * @param {(item: T, idx: number) => Record<string,string>} [params.getRowDataset]
 * @param {string} [params.rowTag] Defaults to 'div'
 * @param {(args: {row: HTMLElement, item: T, idx: number, parts: UrlListingItemParts}) => void} [params.decorateRow]
 * @param {(args: {row: HTMLElement, item: T, idx: number}) => void} [params.onRowMouseEnter]
 * @param {(args: {row: HTMLElement, item: T, idx: number, event: MouseEvent}) => void} [params.onRowMouseDown]
 * @param {(args: {row: HTMLElement, item: T, idx: number, event: MouseEvent}) => void} [params.onRowClick]
 */
export function renderUrlListing({
  container,
  items,
  view = 'list',
  classNames = {},
  useInlineStyles = true,
  emptyText,
  getTitle,
  getUrl,
  getMeta,
  getFaviconUrl,
  showFavicon = false,
  showUrlLine = true,
  showMetaLine = false,
  selectedIndex = -1,
  isSelected,
  getRowDataset,
  rowTag = 'div',
  decorateRow,
  onRowMouseEnter,
  onRowMouseDown,
  onRowClick
}) {
  if (!container) return;
  const doc = container.ownerDocument || document;

  container.dataset.kpUrlListingView = view;
  if (classNames.container) container.classList.add(classNames.container);
  container.textContent = '';

  if (!Array.isArray(items) || !items.length) {
    if (typeof emptyText === 'string' && emptyText) {
      const empty = doc.createElement('div');
      empty.textContent = emptyText;
      if (useInlineStyles) {
        Object.assign(empty.style, {
          padding: '10px 16px',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.55)',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
        });
      }
      container.appendChild(empty);
    }
    return;
  }

  // Layout hints for grid/list.
  if (useInlineStyles) {
    if (view === 'grid') {
      Object.assign(container.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '10px'
      });
    } else {
      // let caller control container scroll/padding; we only ensure block.
      if (container.style.display === '') container.style.display = 'block';
    }
  }

  for (let idx = 0; idx < items.length; idx += 1) {
    const item = items[idx];
    const row = /** @type {HTMLElement} */ (doc.createElement(rowTag));

    const selected = typeof isSelected === 'function' ? Boolean(isSelected(item, idx)) : idx === selectedIndex;
    if (classNames.row) row.className = classNames.row;
    if (selected && classNames.rowSelected) row.classList.add(classNames.rowSelected);
    row.dataset.kpUrlListingIndex = String(idx);

    if (typeof getRowDataset === 'function') {
      const data = getRowDataset(item, idx) || {};
      for (const [k, v] of Object.entries(data)) {
        if (!k) continue;
        row.dataset[k] = String(v);
      }
    }

    // If using <a> tag, set href attribute for native link behavior
    const rawUrlText = typeof getUrl === 'function' ? String(getUrl(item, idx) || '') : '';
    if (rowTag === 'a' && rawUrlText && row instanceof HTMLAnchorElement) {
      row.href = rawUrlText;
    }

    // Structure:
    // row
    //  - content (flex)
    //    - [favicon?]
    //    - text (title + meta/url)
    const content = doc.createElement('div');
    const text = doc.createElement('div');
    const titleEl = doc.createElement('div');
    const metaEl = doc.createElement('div');
    const urlEl = doc.createElement('div');

    let faviconEl = null;
    const titleText = typeof getTitle === 'function' ? String(getTitle(item, idx) || '') : (rawUrlText || '');
    const metaText = typeof getMeta === 'function' ? String(getMeta(item, idx) || '') : '';

    titleEl.textContent = titleText;
    metaEl.textContent = metaText;

    // Format URL for display: remove protocol and make domain bold
    if (rawUrlText) {
      const cleanUrl = formatUrlForDisplay(rawUrlText);
      // Extract domain (everything before the first /)
      const domainMatch = cleanUrl.match(/^([^\/]+)/);
      if (domainMatch) {
        const domain = domainMatch[1];
        const rest = cleanUrl.slice(domain.length);
        urlEl.innerHTML = `<strong>${domain}</strong>${rest}`;
      } else {
        urlEl.textContent = cleanUrl;
      }
    } else {
      urlEl.textContent = '';
    }

    if (classNames.content) content.className = classNames.content;
    if (classNames.text) text.className = classNames.text;
    if (classNames.title) titleEl.className = classNames.title;
    if (classNames.meta) metaEl.className = classNames.meta;
    if (classNames.url) urlEl.className = classNames.url;

    if (useInlineStyles) {
      Object.assign(row.style, {
        userSelect: 'none',
        textDecoration: 'none',
        color: 'inherit'
      });
      Object.assign(content.style, {
        display: 'flex',
        alignItems: view === 'grid' ? 'flex-start' : 'center',
        gap: '10px'
      });
      Object.assign(text.style, {
        minWidth: '0',
        flex: '1 1 auto'
      });
      Object.assign(titleEl.style, {
        fontSize: '13px',
        fontWeight: view === 'grid' ? '700' : '700',
        color: 'rgba(255,255,255,0.92)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      });
      Object.assign(urlEl.style, {
        marginTop: '2px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.62)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      });
      Object.assign(metaEl.style, {
        marginTop: '2px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.62)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      });

      if (view === 'grid') {
        Object.assign(row.style, {
          padding: '10px 10px',
          borderRadius: '12px',
          cursor: 'pointer',
          background: selected ? 'rgba(255,140,0,0.16)' : 'rgba(0,0,0,0.10)',
          border: selected ? '1px solid rgba(255,140,0,0.35)' : '1px solid rgba(255,255,255,0.10)'
        });
      } else {
        Object.assign(row.style, {
          display: 'block',
          padding: '8px 10px',
          borderRadius: '10px',
          cursor: 'pointer',
          background: selected ? 'rgba(255,140,0,0.18)' : 'rgba(0,0,0,0)',
          border: selected ? '1px solid rgba(255,140,0,0.35)' : '1px solid rgba(255,255,255,0.06)',
          margin: '6px 6px 6px 6px'
        });
      }
    }

    if (showFavicon) {
      const faviconUrl = typeof getFaviconUrl === 'function' ? String(getFaviconUrl(item, idx) || '') : '';
      faviconEl = createFaviconImg(doc, rawUrlText, { size: 18, faviconUrl });
      if (classNames.favicon) faviconEl.className = classNames.favicon;
      if (useInlineStyles) {
        Object.assign(faviconEl.style, {
          width: '18px',
          height: '18px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.08)',
          flex: '0 0 auto'
        });
      }
      content.appendChild(faviconEl);
    }

    text.appendChild(titleEl);
    if (showMetaLine) text.appendChild(metaEl);
    if (showUrlLine) text.appendChild(urlEl);

    content.appendChild(text);
    row.appendChild(content);

    // If the caller provided a row click handler, make the row explicitly interactive.
    // This helps KeyPilot's IntersectionObserverManager discover/index these rows (via `[role="link"]`)
    // and improves accessibility (keyboard focus + Enter/Space activation).
    if (typeof onRowClick === 'function') {
      try {
        // Only set these when the row itself is the click target.
        row.setAttribute('role', 'link');
        // Make keyboard focusable unless it's already focusable (e.g. <a>, <button>).
        if (typeof row.tabIndex !== 'number' || row.tabIndex < 0) row.tabIndex = 0;
        if (rawUrlText) row.dataset.kpUrl = rawUrlText;
        if (titleText) row.setAttribute('aria-label', titleText);
      } catch {
        // ignore
      }
    }

    if (typeof onRowMouseEnter === 'function') {
      row.addEventListener('mouseenter', () => onRowMouseEnter({ row, item, idx }), { passive: true });
    }
    if (typeof onRowMouseDown === 'function') {
      row.addEventListener('mousedown', (event) => onRowMouseDown({ row, item, idx, event }), true);
    }
    if (typeof onRowClick === 'function') {
      row.addEventListener('click', (event) => onRowClick({ row, item, idx, event }), true);
      // Keyboard activation for accessibility + consistency with "clickable row" semantics.
      row.addEventListener('keydown', (event) => {
        try {
          const k = event && typeof event.key === 'string' ? event.key : '';
          if (k !== 'Enter' && k !== ' ') return;
          event.preventDefault();
          onRowClick({ row, item, idx, event: /** @type {any} */ (event) });
        } catch {
          // ignore
        }
      }, true);
    }

    const parts = {
      row,
      content,
      text,
      titleEl,
      metaEl,
      urlEl,
      faviconEl
    };

    if (typeof decorateRow === 'function') {
      decorateRow({ row, item, idx, parts });
    }

    container.appendChild(row);
  }
}


