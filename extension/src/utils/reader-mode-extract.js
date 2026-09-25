/**
 * Extract a Reader Mode article from the current page or a text selection.
 * Readability runs on a document clone and never mutates the live page.
 */

import { Readability } from '@mozilla/readability';
import { isContentScriptRestrictedUrl } from '../config/url-policy.js';

/** Reject distilled pages that are shorter than a short news lede. */
export const MIN_ARTICLE_CHARS = 60;

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
 *   source: 'selection'|'readability'
 * }} ReaderArticle
 */

/**
 * @param {{
 *   document: Document,
 *   selectionText?: string|null,
 *   pageTitle?: string|null,
 *   pageUrl?: string|null,
 *   Readability?: typeof Readability
 * }} opts
 * @returns {ReaderArticle|null}
 */
export function extractReaderArticle(opts) {
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

  const Ctor = opts?.Readability || Readability;
  if (typeof Ctor !== 'function') return null;

  let clone = null;
  try {
    clone = doc.cloneNode(true);
  } catch {
    return null;
  }
  if (!clone) return null;
  prunePromoRegions(clone);

  let parsed = null;
  try {
    const forParse = typeof clone.cloneNode === 'function' ? clone.cloneNode(true) : clone;
    parsed = new Ctor(forParse).parse();
  } catch {
    parsed = null;
  }

  const html = parsed && typeof parsed.content === 'string' ? parsed.content.trim() : '';
  const text = compactText(parsed && typeof parsed.textContent === 'string' ? parsed.textContent : '');
  const parsedTitle = String(parsed?.title || '').trim();
  const parsedOk = !!(html && text.length >= MIN_ARTICLE_CHARS);

  const region = pickPrimaryReaderRegion(clone);
  const regionText = compactText(region?.textContent);
  const regionHtml = region && typeof region.innerHTML === 'string' ? region.innerHTML.trim() : '';
  const tooNarrow = parsedOk && extractIsTooNarrow(text.length, regionText.length);
  const promo = parsedOk && extractLooksLikePromo(html, parsedTitle);

  if (parsedOk && !tooNarrow && !promo) {
    return {
      title: parsedTitle || pageTitle,
      html,
      byline: String(parsed.byline || '').trim(),
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
      byline: String(parsed.byline || '').trim(),
      source: 'readability'
    };
  }
  return null;
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

  const clean = sanitizeNode(root, ownerDocument);
  if (!clean) return frag;
  while (clean.firstChild) frag.appendChild(clean.firstChild);
  return frag;
}

/**
 * @param {Node} node
 * @param {Document} ownerDocument
 * @returns {Node|null}
 */
function sanitizeNode(node, ownerDocument) {
  if (node.nodeType === Node.TEXT_NODE) {
    return ownerDocument.createTextNode(node.nodeValue || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = /** @type {Element} */ (node);
  const tag = el.tagName.toUpperCase();
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT'
    || tag === 'EMBED' || tag === 'LINK' || tag === 'META' || tag === 'NOSCRIPT'
    || tag === 'FORM' || tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA'
    || tag === 'SELECT' || tag === 'SVG' || tag === 'VIDEO' || tag === 'AUDIO') {
    return null;
  }

  if (tag === 'DIV' && el.id === 'kp-reader-root') {
    const wrap = ownerDocument.createElement('div');
    for (const child of Array.from(el.childNodes)) {
      const cleaned = sanitizeNode(child, ownerDocument);
      if (cleaned) wrap.appendChild(cleaned);
    }
    return wrap;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const wrap = ownerDocument.createDocumentFragment();
    for (const child of Array.from(el.childNodes)) {
      const cleaned = sanitizeNode(child, ownerDocument);
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
  if (tag === 'A') out.setAttribute('target', '_blank');
  if (tag === 'A') out.setAttribute('rel', 'noopener noreferrer');

  for (const child of Array.from(el.childNodes)) {
    const cleaned = sanitizeNode(child, ownerDocument);
    if (cleaned) out.appendChild(cleaned);
  }
  return out;
}
