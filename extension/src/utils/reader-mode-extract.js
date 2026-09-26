/**
 * Extract a Reader Mode article from the current page or a text selection.
 * Readability runs on a document clone and never mutates the live page.
 */

import { isContentScriptRestrictedUrl } from '../config/url-policy.js';

/** Shortest explicit text selection worth showing. */
export const MIN_ARTICLE_CHARS = 60;

/** Readability's own default (`charThreshold`). Shorter distillations are discarded. */
export const READABILITY_MIN_CHARS = 500;

/**
 * Side columns that look like a full article to Readability (dense blurbs)
 * while the real river is mostly links — Techmeme “Sponsor Posts”, etc.
 */
export const PROMO_HEADING_RE =
  /^(sponsor(ed)?(\s+posts?)?|advertisements?|paid\s+(posts?|content)|promoted(\s+posts?)?)$/i;

/** Extract must cover at least this fraction of the primary column. */
export const PRIMARY_REGION_COVERAGE = 0.4;

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isPromoHeading(text) {
  return PROMO_HEADING_RE.test(String(text || '').replace(/\s+/g, ' ').trim());
}

/**
 * @param {string} text
 * @returns {string}
 */
function compactText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {number} extractedLen
 * @param {number} primaryLen
 * @returns {boolean}
 */
export function extractIsTooNarrow(extractedLen, primaryLen) {
  const extracted = Number(extractedLen) || 0;
  const primary = Number(primaryLen) || 0;
  if (extracted < MIN_ARTICLE_CHARS) return true;
  if (primary < MIN_ARTICLE_CHARS * 2) return false;
  return extracted < primary * PRIMARY_REGION_COVERAGE;
}

/**
 * @param {string} html
 * @param {string} [title]
 * @returns {boolean}
 */
export function extractLooksLikePromo(html, title) {
  if (isPromoHeading(title)) return true;
  const plain = compactText(String(html || '').replace(/<[^>]+>/g, ' ')).slice(0, 240);
  return isPromoHeading(plain.split(/[.!?|•\n]/)[0] || '') || /^sponsor posts\b/i.test(plain);
}

/** Bare `header` is kept so in-article bylines survive. Site banners use role. */
const READER_CHROME_TAGS = new Set(['NAV', 'FOOTER']);
const READER_CHROME_ROLES = new Set(['navigation', 'banner', 'contentinfo']);
const READER_CHROME_SELECTOR = 'nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"]';

/**
 * Site chrome landmarks, including ARIA equivalents of nav / header / footer.
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
export function isReaderChromeElement(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = String(el.tagName || '').toUpperCase();
  if (READER_CHROME_TAGS.has(tag)) return true;
  const roles = String(el.getAttribute?.('role') || '').trim().toLowerCase().split(/\s+/);
  return roles.some((role) => READER_CHROME_ROLES.has(role));
}

/**
 * Remove nav and footer, plus banner/contentinfo landmarks, from a clone.
 * Never mutates the live document. Article `header` elements stay.
 * @param {Document} doc
 */
export function pruneReaderChrome(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return;
  const nodes = doc.querySelectorAll(READER_CHROME_SELECTOR);
  for (const el of [...nodes]) {
    try { el.remove(); } catch { /* ignore */ }
  }
}

/**
 * Drop small promo/sponsor boxes on a clone. Never mutates the live document.
 * @param {Document} doc
 */
export function prunePromoRegions(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return;
  const bodyLen = compactText(doc.body?.textContent).length;
  const headings = doc.querySelectorAll('h1, h2, h3, h4');
  for (const heading of [...headings]) {
    if (!isPromoHeading(heading.textContent)) continue;
    const box = heading.parentElement;
    if (!box || box === doc.body || box === doc.documentElement) continue;
    const boxLen = compactText(box.textContent).length;
    if (boxLen > 0 && (bodyLen < 1 || boxLen < bodyLen * 0.25)) {
      try { box.remove(); } catch { /* ignore */ }
    }
  }
}

/**
 * Largest layout region that is not essentially the whole page.
 * @param {Document} doc
 * @returns {Element|null}
 */
export function pickPrimaryReaderRegion(doc) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  const bodyLen = compactText(doc.body?.textContent).length;
  const nodes = doc.querySelectorAll('div, main, article, section');
  let best = null;
  let bestScore = 0;
  for (const el of nodes) {
    if (!el || el === doc.body) continue;
    const idc = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`;
    if (/\b(nav|menu|footer|sidebar|sponsor|cookie|banner)\b/i.test(idc)) continue;
    const len = compactText(el.textContent).length;
    if (len < MIN_ARTICLE_CHARS * 4) continue;
    if (bodyLen > 0 && len > bodyLen * 0.85) continue;
    let score = len;
    if (/\b(main|content|article|topcol|river|feed|posts|news|story)\b/i.test(idc)) score *= 1.35;
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}

/**
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isReaderModeRestrictedUrl(url) {
  return isContentScriptRestrictedUrl(url);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wrap selected plain text as simple paragraphs.
 * @param {string} text
 * @returns {string}
 */
export function htmlFromSelection(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '';
  const blocks = raw.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = escapeHtml(block.trim()).replace(/\n/g, '<br>');
      return `<p>${lines}</p>`;
    })
    .join('');
}

/**
 * @typedef {{
 *   title: string,
 *   html: string,
 *   byline?: string,
 *   siteName?: string,
 *   publishedTime?: string,
 *   source: 'selection'|'readability'|'region'
 * }} ReaderArticle
 */

/**
 * @param {{
 *   document: Document,
 *   selectionText?: string|null,
 *   pageTitle?: string|null,
 *   pageUrl?: string|null,
 *   Readability?: new (document: Document) => { parse: () => any },
 *   isProbablyReaderable?: (document: Document) => boolean
 * }} opts
 * @returns {Promise<ReaderArticle|null>}
 */
export async function extractReaderArticle(opts) {
  const doc = opts?.document;
  const pageUrl = opts?.pageUrl != null ? String(opts.pageUrl) : '';
  if (pageUrl && isReaderModeRestrictedUrl(pageUrl)) return null;

  const pageTitle = String(opts?.pageTitle || '').trim();
  const selection = String(opts?.selectionText || '').trim();
  if (selection) {
    const html = htmlFromSelection(selection);
    if (!html) return null;
    return { title: pageTitle, html, source: 'selection' };
  }

  if (!doc || typeof doc.cloneNode !== 'function') return null;

  let Ctor = opts?.Readability;
  let readerable = opts?.isProbablyReaderable;
  if (typeof Ctor !== 'function' || typeof readerable !== 'function') {
    const readability = await import('@mozilla/readability');
    Ctor ||= readability.Readability;
    readerable ||= readability.isProbablyReaderable;
  }
  if (typeof Ctor !== 'function') return null;

  let clone = null;
  try {
    clone = doc.cloneNode(true);
  } catch {
    return null;
  }
  if (!clone) return null;
  pruneReaderChrome(clone);
  prunePromoRegions(clone);

  let parsed = null;
  if (pageLooksReaderable(clone, readerable)) {
    try {
      const forParse = typeof clone.cloneNode === 'function' ? clone.cloneNode(true) : clone;
      parsed = new Ctor(forParse).parse();
    } catch {
      parsed = null;
    }
  }

  const html = parsed && typeof parsed.content === 'string' ? parsed.content.trim() : '';
  const text = compactText(parsed && typeof parsed.textContent === 'string' ? parsed.textContent : '');
  const parsedTitle = String(parsed?.title || '').trim();
  const parsedOk = !!(html && text.length >= READABILITY_MIN_CHARS);
  const meta = readabilityMeta(parsed);

  const region = pickPrimaryReaderRegion(clone);
  const regionText = compactText(region?.textContent);
  const regionHtml = region && typeof region.innerHTML === 'string' ? region.innerHTML.trim() : '';
  const tooNarrow = parsedOk && extractIsTooNarrow(text.length, regionText.length);
  const promo = parsedOk && extractLooksLikePromo(html, parsedTitle);

  if (parsedOk && !tooNarrow && !promo) {
    return {
      title: parsedTitle || pageTitle,
      html,
      ...meta,
      source: 'readability'
    };
  }

  if (regionHtml && regionText.length >= MIN_ARTICLE_CHARS) {
    return {
      title: pageTitle,
      html: regionHtml,
      source: 'region'
    };
  }

  if (parsedOk) {
    return {
      title: parsedTitle || pageTitle,
      html,
      ...meta,
      source: 'readability'
    };
  }
  return null;
}

/**
 * Link rivers often fail this check. A throw means the document is not a real DOM.
 * @param {Document} doc
 * @param {typeof isProbablyReaderable} readerable
 * @returns {boolean}
 */
function pageLooksReaderable(doc, readerable) {
  try {
    return readerable(doc) !== false;
  } catch {
    return true;
  }
}

/**
 * @param {any} parsed
 * @returns {{ byline: string, siteName: string, publishedTime: string }}
 */
function readabilityMeta(parsed) {
  return {
    byline: String(parsed?.byline || '').trim(),
    siteName: String(parsed?.siteName || '').trim(),
    publishedTime: String(parsed?.publishedTime || '').trim()
  };
}

const ALLOWED_TAGS = new Set([
  'A', 'ABBR', 'ARTICLE', 'ASIDE', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CITE',
  'CODE', 'DD', 'DEL', 'DIV', 'DL', 'DT', 'EM', 'FIGCAPTION', 'FIGURE', 'H1',
  'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'I', 'IMG', 'INS', 'KBD', 'LI',
  'MAIN', 'MARK', 'OL', 'P', 'PRE', 'Q', 'S', 'SAMP', 'SECTION', 'SMALL', 'SPAN',
  'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TIME',
  'TR', 'U', 'UL', 'WBR'
]);

const ALLOWED_ATTRS = {
  A: ['href', 'title'],
  IMG: ['src', 'alt', 'title', 'width', 'height'],
  TIME: ['datetime'],
  TD: ['colspan', 'rowspan'],
  TH: ['colspan', 'rowspan', 'scope']
};

/** Section headings that can form a Reader Mode contents list. */
const TOC_HEADING_TAGS = new Set(['H2', 'H3']);

/** Contents column appears only when the article has at least this many sections. */
export const MIN_READER_TOC_HEADINGS = 3;

/**
 * Same-document fragment link (`#section`), not a new URL.
 * @param {string|null|undefined} href
 * @returns {boolean}
 */
export function isSamePageHashHref(href) {
  const s = String(href || '').trim();
  return s.startsWith('#') && s.length > 1;
}

/**
 * Keep a source id only when it is a single fragment token.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function normalizeElementId(value) {
  let id = String(value ?? '').trim();
  if (!id) return '';
  if (id.includes('%')) {
    try { id = decodeURIComponent(id); } catch { /* keep the raw token */ }
  }
  if (!id || id.length > 240) return '';
  if (/[\s"'<>]/.test(id)) return '';
  return id;
}

/**
 * Reserve `raw` in `used` when it is a free, safe id.
 * @param {string|null|undefined} raw
 * @param {Set<string>} used
 * @returns {string}
 */
export function claimElementId(raw, used) {
  const id = normalizeElementId(raw);
  if (!id || used.has(id)) return '';
  used.add(id);
  return id;
}

/**
 * Fresh heading id that does not collide with ids already kept.
 * @param {Set<string>} used
 * @returns {string}
 */
export function mintHeadingId(used) {
  let n = 1;
  let id = `kp-reader-h-${n}`;
  while (used.has(id)) {
    n += 1;
    id = `kp-reader-h-${n}`;
  }
  used.add(id);
  return id;
}

/**
 * h2/h3 outline for the contents column. Empty when there are fewer than
 * {@link MIN_READER_TOC_HEADINGS} labeled sections.
 * @param {ParentNode|null|undefined} root
 * @returns {Array<{ id: string, text: string, level: 2|3 }>}
 */
export function collectReaderToc(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  /** @type {Array<{ id: string, text: string, level: 2|3 }>} */
  const entries = [];
  let nodes = [];
  try {
    nodes = [...root.querySelectorAll('h2, h3')];
  } catch {
    return [];
  }
  for (const node of nodes) {
    const tag = String(node.tagName || '').toUpperCase();
    if (!TOC_HEADING_TAGS.has(tag)) continue;
    const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    const id = normalizeElementId(node.id || node.getAttribute?.('id'));
    if (!text || !id) continue;
    entries.push({ id, text, level: tag === 'H2' ? 2 : 3 });
  }
  return entries.length >= MIN_READER_TOC_HEADINGS ? entries : [];
}

/**
 * @param {string} value
 * @param {'href'|'src'} kind
 * @returns {boolean}
 */
function isSafeUrl(value, kind) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (s.startsWith('#') && kind === 'href') return true;
  if ((s.startsWith('/') || s.startsWith('?') || s.startsWith('.')) && kind === 'href') return true;
  if (/^mailto:/i.test(s) && kind === 'href') return true;
  if (/^(https?:|data:image\/)/i.test(s)) return true;
  return false;
}

/**
 * Drop scripts, frames, and event handlers; keep a reading-safe fragment.
 * @param {string} html
 * @param {Document} ownerDocument
 * @returns {DocumentFragment}
 */
export function sanitizeArticleHtml(html, ownerDocument) {
  const frag = ownerDocument.createDocumentFragment();
  const raw = String(html || '');
  if (!raw.trim()) return frag;

  let parsed;
  try {
    parsed = new DOMParser().parseFromString(`<div id="kp-reader-root">${raw}</div>`, 'text/html');
  } catch {
    return frag;
  }

  const root = parsed.getElementById('kp-reader-root') || parsed.body;
  if (!root) return frag;

  const clean = sanitizeNode(root, ownerDocument, { usedIds: new Set() });
  if (!clean) return frag;
  while (clean.firstChild) frag.appendChild(clean.firstChild);
  return frag;
}

/**
 * @param {Node} node
 * @param {Document} ownerDocument
 * @param {{ usedIds: Set<string> }} ctx
 * @returns {Node|null}
 */
function sanitizeNode(node, ownerDocument, ctx) {
  if (node.nodeType === Node.TEXT_NODE) {
    return ownerDocument.createTextNode(node.nodeValue || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = /** @type {Element} */ (node);
  const tag = el.tagName.toUpperCase();
  if (isReaderChromeElement(el)) return null;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT'
    || tag === 'EMBED' || tag === 'LINK' || tag === 'META' || tag === 'NOSCRIPT'
    || tag === 'FORM' || tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA'
    || tag === 'SELECT' || tag === 'SVG' || tag === 'VIDEO' || tag === 'AUDIO') {
    return null;
  }

  if (tag === 'DIV' && el.id === 'kp-reader-root') {
    const wrap = ownerDocument.createElement('div');
    for (const child of Array.from(el.childNodes)) {
      const cleaned = sanitizeNode(child, ownerDocument, ctx);
      if (cleaned) wrap.appendChild(cleaned);
    }
    return wrap;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const wrap = ownerDocument.createDocumentFragment();
    for (const child of Array.from(el.childNodes)) {
      const cleaned = sanitizeNode(child, ownerDocument, ctx);
      if (cleaned) wrap.appendChild(cleaned);
    }
    return wrap;
  }

  const out = ownerDocument.createElement(tag.toLowerCase());
  const allowed = ALLOWED_ATTRS[tag];
  if (allowed) {
    for (const name of allowed) {
      if (!el.hasAttribute(name)) continue;
      const value = el.getAttribute(name);
      if (name === 'href' && !isSafeUrl(value, 'href')) continue;
      if (name === 'src' && !isSafeUrl(value, 'src')) continue;
      if (value != null) out.setAttribute(name, value);
    }
  }
  applySanitizedId(out, el, tag, ctx);
  if (tag === 'A' && !isSamePageHashHref(out.getAttribute('href'))) {
    out.setAttribute('target', '_blank');
    out.setAttribute('rel', 'noopener noreferrer');
  }

  for (const child of Array.from(el.childNodes)) {
    const cleaned = sanitizeNode(child, ownerDocument, ctx);
    if (cleaned) out.appendChild(cleaned);
  }
  return out;
}

/**
 * Keep a safe source id. h2/h3 without one get a generated id for the contents list.
 * @param {Element} out
 * @param {Element} source
 * @param {string} tag
 * @param {{ usedIds: Set<string> }} ctx
 */
function applySanitizedId(out, source, tag, ctx) {
  const kept = claimElementId(source.getAttribute('id'), ctx.usedIds);
  if (kept) {
    out.setAttribute('id', kept);
    return;
  }
  if (TOC_HEADING_TAGS.has(tag)) {
    out.setAttribute('id', mintHeadingId(ctx.usedIds));
  }
}
