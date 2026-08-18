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

const BLOCK_SELECTOR = 'p, li, blockquote, td, th, dd, dt, figcaption, article, section, h1, h2, h3, h4, h5, h6, pre, div';

/**
 * @param {number} x
 * @param {number} y
 * @param {Document} doc
 * @returns {Range|null}
 */
export function caretRangeAtPoint(x, y, doc) {
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
    const segments = [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text)];
    let found = segments.find((s) => offset >= s.index && offset < s.index + s.segment.length);
    if (!found && segments.length) {
      found = segments[segments.length - 1];
    }
    if (!found) return null;
    return { segment: found.segment, index: found.index };
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
 * @param {Node|null|undefined} node
 * @returns {Element|null}
 */
function elementFromNode(node) {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE) return /** @type {Element} */ (node);
  return node.parentElement || null;
}

/**
 * Nearest block-level ancestor at a client point (for paragraph / sentence mapping).
 * @param {number} x
 * @param {number} y
 * @param {Document} doc
 * @returns {Element|null}
 */
export function closestBlockAtPoint(x, y, doc) {
  try {
    const range = caretRangeAtPoint(x, y, doc);
    const fromCaret = elementFromNode(range?.startContainer);
    let hit = fromCaret;
    if (!hit) {
      try { hit = doc.elementFromPoint(x, y); } catch { hit = null; }
    }
    if (!hit || hit.nodeType !== 1) return null;
    return hit.closest?.(BLOCK_SELECTOR) || hit;
  } catch {
    return null;
  }
}

/**
 * @param {Element} root
 * @returns {{ text: string, pieces: Array<{ node: Text, start: number, end: number }> }}
 */
function textPiecesIn(root) {
  const pieces = [];
  let text = '';
  if (!root) return { text, pieces };
  const doc = root.ownerDocument || document;
  let walker;
  try {
    walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n || !n.textContent) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (p && /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
  } catch {
    return { text, pieces };
  }
  let n = walker.nextNode();
  while (n) {
    const start = text.length;
    const chunk = String(n.textContent || '');
    text += chunk;
    pieces.push({ node: /** @type {Text} */ (n), start, end: text.length });
    n = walker.nextNode();
  }
  return { text, pieces };
}

/**
 * @param {Document} doc
 * @param {Array<{ node: Text, start: number, end: number }>} pieces
 * @param {number} start
 * @param {number} end
 * @returns {Range|null}
 */
function rangeFromTextOffsets(doc, pieces, start, end) {
  if (!pieces.length || end <= start) return null;
  let startNode = null;
  let startOff = 0;
  let endNode = null;
  let endOff = 0;
  for (const p of pieces) {
    if (!startNode && start >= p.start && start < p.end) {
      startNode = p.node;
      startOff = start - p.start;
    }
    if (start === p.end && !startNode) {
      startNode = p.node;
      startOff = p.node.textContent ? p.node.textContent.length : 0;
    }
    if (end > p.start && end <= p.end) {
      endNode = p.node;
      endOff = end - p.start;
    }
  }
  if (!startNode && pieces[0]) {
    startNode = pieces[0].node;
    startOff = 0;
  }
  if (!endNode && pieces.length) {
    const last = pieces[pieces.length - 1];
    endNode = last.node;
    endOff = last.node.textContent ? last.node.textContent.length : 0;
  }
  if (!startNode || !endNode) return null;
  try {
    const range = doc.createRange();
    range.setStart(startNode, Math.max(0, startOff));
    range.setEnd(endNode, Math.max(0, endOff));
    return range;
  } catch {
    return null;
  }
}

/**
 * @param {Range} caretRange
 * @param {Array<{ node: Text, start: number, end: number }>} pieces
 * @returns {number}
 */
function caretOffsetInPieces(caretRange, pieces) {
  const node = caretRange?.startContainer;
  const off = Number(caretRange?.startOffset) || 0;
  if (node && node.nodeType === Node.TEXT_NODE) {
    const p = pieces.find((x) => x.node === node);
    if (p) return p.start + Math.min(Math.max(0, off), p.end - p.start);
  }
  if (pieces.length) return pieces[0].start;
  return 0;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Document} doc
 * @returns {{ text: string, range: Range|null }}
 */
function paragraphAtPoint(x, y, doc) {
  try {
    const block = closestBlockAtPoint(x, y, doc);
    if (!block) return { text: '', range: null };
    const text = String(block.innerText ?? block.textContent ?? '').trim();
    if (!text) return { text: '', range: null };
    let range = null;
    try {
      range = doc.createRange();
      range.selectNodeContents(block);
    } catch {
      range = null;
    }
    return { text, range };
  } catch {
    return { text: '', range: null };
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Document} doc
 * @returns {{ text: string, range: Range|null }}
 */
function sentenceAtPoint(x, y, doc) {
  const block = closestBlockAtPoint(x, y, doc);
  if (!block) return { text: '', range: null };
  const { text, pieces } = textPiecesIn(block);
  if (!text.trim() || !pieces.length) return { text: '', range: null };
  const caret = caretRangeAtPoint(x, y, doc);
  const offset = caret ? caretOffsetInPieces(caret, pieces) : 0;
  const found = sentenceSegmentAt(text, offset);
  if (!found || !String(found.segment || '').trim()) return { text: '', range: null };
  const end = Math.min(found.index + found.segment.length, text.length);
  const range = rangeFromTextOffsets(doc, pieces, found.index, end);
  return { text: found.segment.trim(), range };
}

/**
 * Acquire text at a client point, at the requested granularity.
 *
 * `range` is populated for `word` (single text node), `sentence` (mapped across the nearest
 * block), and `paragraph` (`selectNodeContents` on that block). `hyperlink` never returns a
 * range: replacing a hyperlink's visible text isn't a meaningful `modifyPage` operation.
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
    return paragraphAtPoint(x, y, doc);
  }
  if (granularity === 'sentence') {
    return sentenceAtPoint(x, y, doc);
  }

  const caretRange = caretRangeAtPoint(x, y, doc);
  const node = caretRange?.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return { text: '', range: null };
  const full = String(node.textContent || '');
  const offset = Math.min(Math.max(0, caretRange.startOffset), full.length);

  const found = wordSegmentAt(full, offset);
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
