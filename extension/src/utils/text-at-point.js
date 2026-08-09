/**
 * Text-at-point acquisition for `dataSource: 'underCursor'`, `dataKind: 'text'` Functions
 * (`GET_TEXT_AT_CURSOR`, `LOOKUP_WORD`, `TRANSLATE`'s under-cursor fallback — see
 * KEY_ACTION_ARCHITECTURE.md, "Data Acquisition & Result Destinations").
 *
 * Uses `caretRangeFromPoint`/`caretPositionFromPoint` (already used elsewhere for KeyPilot's own
 * selection modes — see `highlight-manager.js`) plus `Intl.Segmenter` for word/sentence boundaries
 * rather than hand-rolled regexes — both are supported in every Chrome version this extension
 * targets, so no polyfill/fallback path is needed.
 */

/**
 * @param {number} x
 * @param {number} y
 * @param {Document} doc
 * @returns {Range|null}
 */
function caretRangeAtPoint(x, y, doc) {
  try {
    if (typeof doc.caretRangeFromPoint === 'function') {
      return doc.caretRangeFromPoint(x, y);
    }
  } catch { /* ignore */ }
  try {
    if (typeof doc.caretPositionFromPoint === 'function') {
      const pos = doc.caretPositionFromPoint(x, y);
      if (pos && pos.offsetNode) {
        const r = doc.createRange();
        r.setStart(pos.offsetNode, pos.offset);
        r.collapse(true);
        return r;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Find the word-like `Intl.Segmenter` segment at `offset`, preferring the nearest word-like
 * neighbor when `offset` lands on whitespace/punctuation between words.
 * @param {string} text
 * @param {number} offset
 * @returns {{ segment: string, index: number }|null}
 */
function wordSegmentAt(text, offset) {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
    const segments = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)];
    let idx = segments.findIndex((s) => offset >= s.index && offset < s.index + s.segment.length);
    if (idx === -1) idx = segments.length - 1;
    if (idx < 0) return null;
    if (!segments[idx].isWordLike) {
      const before = [...segments.slice(0, idx)].reverse().find((s) => s.isWordLike);
      const after = segments.slice(idx + 1).find((s) => s.isWordLike);
      const chosen = after || before;
      return chosen ? { segment: chosen.segment, index: chosen.index } : null;
    }
    return { segment: segments[idx].segment, index: segments[idx].index };
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @param {number} offset
 * @returns {{ segment: string, index: number }|null}
 */
function sentenceSegmentAt(text, offset) {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
    for (const s of new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)) {
      if (offset >= s.index && offset < s.index + s.segment.length) {
        return { segment: s.segment, index: s.index };
      }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Document} doc
 * @returns {string} `href` of the nearest ancestor link at point, or `''`.
 */
function hyperlinkAtPoint(x, y, doc) {
  try {
    const el = doc.elementFromPoint(x, y);
    const a = el?.closest?.('a[href]');
    return a ? String(a.href || '') : '';
  } catch {
    return '';
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Document} doc
 * @returns {string} best-effort visible text of the nearest block-level ancestor at point.
 */
function paragraphAtPoint(x, y, doc) {
  try {
    const range = caretRangeAtPoint(x, y, doc);
    const node = range?.startContainer;
    const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const block = el?.closest?.('p, li, blockquote, td, th, dd, dt, figcaption, article, section, div') || el;
    return String(block?.innerText ?? block?.textContent ?? '').trim();
  } catch {
    return '';
  }
}

/**
 * Acquire text at a client point, at the requested granularity.
 *
 * `range` is only populated for `word`/`sentence` (a precise sub-range of the single text node
 * the point landed in) — it's what a `modifyPage` result destination needs to know *where* to
 * write the replacement back to (see `TRANSLATE`'s handler in `keypilot.js`). `paragraph` and
 * `hyperlink` never return a `range`: a paragraph can span several text nodes, and replacing a
 * hyperlink's visible text isn't a meaningful `modifyPage` operation.
 *
 * @param {number} x
 * @param {number} y
 * @param {{ granularity?: 'word'|'sentence'|'paragraph'|'hyperlink', doc?: Document }} [opts]
 * @returns {{ text: string, range: Range|null }}
 */
export function getTextAtPoint(x, y, opts = {}) {
  const granularity = opts.granularity || 'word';
  const doc = opts.doc || document;

  if (granularity === 'hyperlink') {
    return { text: hyperlinkAtPoint(x, y, doc), range: null };
  }
  if (granularity === 'paragraph') {
    return { text: paragraphAtPoint(x, y, doc), range: null };
  }

  const caretRange = caretRangeAtPoint(x, y, doc);
  const node = caretRange?.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return { text: '', range: null };
  const full = String(node.textContent || '');
  const offset = Math.min(Math.max(0, caretRange.startOffset), full.length);

  const found = granularity === 'sentence' ? sentenceSegmentAt(full, offset) : wordSegmentAt(full, offset);
  if (!found || !found.segment.trim()) return { text: '', range: null };

  let range = null;
  try {
    range = doc.createRange();
    range.setStart(node, found.index);
    range.setEnd(node, Math.min(found.index + found.segment.length, full.length));
  } catch {
    range = null;
  }
  return { text: found.segment.trim(), range };
}
