/**
 * KeyPilot-owned unit selection (Select Word / Sentence / Paragraph / Image).
 *
 * Holds a bag of disjoint text ranges + image elements and paints them with the CSS Custom
 * Highlight API (text) plus overlay rects (images, and text fallback). Does not write the
 * native Selection, so H/Y highlight modes and focused fields stay independent.
 */

import { CSS_CLASSES, COLORS, Z_INDEX } from '../config/constants.js';

export const UNIT_SELECT_HIGHLIGHT_NAME = 'kp-unit-select';

/**
 * @typedef {'word'|'sentence'|'paragraph'|'image'} UnitSelectKind
 * @typedef {{
 *   kind: UnitSelectKind,
 *   key: string,
 *   range?: Range|null,
 *   element?: Element|null,
 *   url?: string|null
 * }} UnitSelectItem
 */

/**
 * @param {Range} range
 * @returns {string}
 */
function rangeKey(range) {
  try {
    const s = range.startContainer;
    const e = range.endContainer;
    return `r:${s === e ? '1' : '2'}:${nodeToken(s)}:${range.startOffset}:${nodeToken(e)}:${range.endOffset}`;
  } catch {
    return `r:${Math.random()}`;
  }
}

/**
 * @param {Node} node
 * @returns {string}
 */
function nodeToken(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    const idx = parent ? Array.prototype.indexOf.call(parent.childNodes, node) : -1;
    return `t:${parent ? parent.tagName : ''}:${idx}:${String(node.textContent || '').length}`;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = /** @type {Element} */ (node);
    return `e:${el.tagName}:${el.id || ''}:${el.className || ''}`;
  }
  return String(node.nodeType);
}

/**
 * @param {Element} el
 * @returns {string}
 */
function elementKey(el) {
  try {
    return `e:${el.tagName}:${el.id || ''}:${el.src || el.currentSrc || ''}`;
  } catch {
    return `e:${Math.random()}`;
  }
}

/**
 * @param {Range|null|undefined} range
 * @returns {boolean}
 */
function rangeIsLive(range) {
  if (!range) return false;
  try {
    const n = range.commonAncestorContainer;
    return !!(n && (n.nodeType === Node.DOCUMENT_NODE || n.isConnected || n.parentNode));
  } catch {
    return false;
  }
}

/**
 * @param {Range} range
 * @returns {string}
 */
function rangePlainText(range) {
  try {
    return String(range.toString() || '').replace(/\s+\n/g, '\n').trim();
  } catch {
    return '';
  }
}

/**
 * @param {Range} range
 * @returns {string}
 */
function rangeHtml(range) {
  try {
    const doc = range.startContainer?.ownerDocument || document;
    const div = doc.createElement('div');
    div.appendChild(range.cloneContents());
    return div.innerHTML || '';
  } catch {
    return '';
  }
}

function highlightsApi(doc) {
  try {
    const win = doc?.defaultView || window;
    return win && typeof win.Highlight === 'function' && win.CSS && win.CSS.highlights ? win : null;
  } catch {
    return null;
  }
}

export class UnitSelectionManager {
  constructor() {
    /** @type {UnitSelectItem[]} */
    this.items = [];
    /** @type {HTMLElement[]} */
    this.overlays = [];
    /** @type {Set<Document>} */
    this._highlightDocs = new Set();
  }

  /** @returns {boolean} */
  hasItems() {
    this._prune();
    return this.items.length > 0;
  }

  /** @returns {UnitSelectItem[]} */
  getItems() {
    this._prune();
    return this.items.slice();
  }

  /**
   * @param {UnitSelectItem} unit
   * @param {'exclusive'|'cumulative'} mode
   * @returns {{ added: boolean, removed: boolean, count: number }}
   */
  toggle(unit, mode) {
    this._prune();
    if (!unit || !unit.key) return { added: false, removed: false, count: this.items.length };
    const idx = this.items.findIndex((it) => it.key === unit.key);
    const exclusive = mode !== 'cumulative';

    if (exclusive) {
      if (idx >= 0 && this.items.length === 1) {
        this.items = [];
        this.paint();
        return { added: false, removed: true, count: 0 };
      }
      this.items = [unit];
      this.paint();
      return { added: true, removed: false, count: 1 };
    }

    if (idx >= 0) {
      this.items.splice(idx, 1);
      this.paint();
      return { added: false, removed: true, count: this.items.length };
    }
    this.items.push(unit);
    this.paint();
    return { added: true, removed: false, count: this.items.length };
  }

  clear() {
    this.items = [];
    this.paint();
  }

  /** Drop detached ranges / elements. */
  _prune() {
    this.items = this.items.filter((it) => {
      if (it.kind === 'image') {
        return !!(it.element && it.element.isConnected);
      }
      return rangeIsLive(it.range);
    });
  }

  /**
   * @returns {{ plainText: string, htmlContent: string, hasRichContent: boolean }}
   */
  getClipboardContent() {
    this._prune();
    const plainParts = [];
    const htmlParts = [];
    const ordered = this.items.slice().sort((a, b) => {
      try {
        if (a.range && b.range) {
          const pos = a.range.compareBoundaryPoints(Range.START_TO_START, b.range);
          return pos;
        }
      } catch { /* ignore */ }
      return 0;
    });

    for (const it of ordered) {
      if (it.kind === 'image' && it.element) {
        const el = it.element;
        const tag = String(el.tagName || '').toUpperCase();
        const alt = (el.getAttribute?.('alt') || '').trim();
        const src = it.url || el.currentSrc || el.src || el.getAttribute?.('src') || '';
        plainParts.push(alt || src || tag);
        try {
          htmlParts.push(el.outerHTML || (src ? `<img src="${escapeAttr(src)}">` : ''));
        } catch {
          if (src) htmlParts.push(`<img src="${escapeAttr(src)}">`);
        }
        continue;
      }
      if (it.range) {
        const t = rangePlainText(it.range);
        if (t) plainParts.push(t);
        const h = rangeHtml(it.range);
        if (h) htmlParts.push(h);
      }
    }

    const plainText = plainParts.filter(Boolean).join('\n\n');
    const htmlContent = htmlParts.filter(Boolean).join('');
    return {
      plainText,
      htmlContent,
      hasRichContent: !!htmlContent && htmlContent !== plainText
    };
  }

  /** @returns {string} */
  getPlainText() {
    return this.getClipboardContent().plainText;
  }

  /**
   * True when every live item is an image (Copy should use the image clipboard path).
   * @returns {boolean}
   */
  isImagesOnly() {
    this._prune();
    return this.items.length > 0 && this.items.every((it) => it.kind === 'image');
  }

  /** @returns {UnitSelectItem[]} */
  getImageItems() {
    this._prune();
    return this.items.filter((it) => it.kind === 'image' && it.element);
  }

  paint() {
    this._prune();
    this._clearOverlays();
    this._clearHighlights();

    const textRanges = [];
    const overlayTargets = [];

    for (const it of this.items) {
      if (it.kind === 'image' && it.element) {
        overlayTargets.push(it.element);
        continue;
      }
      if (it.range) textRanges.push(it.range);
    }

    const byDoc = new Map();
    for (const range of textRanges) {
      const doc = range.startContainer?.ownerDocument || document;
      if (!byDoc.has(doc)) byDoc.set(doc, []);
      byDoc.get(doc).push(range);
    }

    for (const [doc, ranges] of byDoc) {
      const win = highlightsApi(doc);
      if (win) {
        try {
          win.CSS.highlights.set(UNIT_SELECT_HIGHLIGHT_NAME, new win.Highlight(...ranges));
          this._highlightDocs.add(doc);
          continue;
        } catch { /* fall through to overlays */ }
      }
      for (const range of ranges) overlayTargets.push(range);
    }

    this._paintOverlayTargets(overlayTargets);
  }

  /** Reposition overlay boxes after scroll (CSS highlights follow layout automatically). */
  refreshOverlays() {
    if (!this.items.length) return;
    this._prune();
    if (!this.overlays.length && !this.items.some((it) => it.kind === 'image')) return;
    this.paint();
  }

  _clearHighlights() {
    for (const doc of this._highlightDocs) {
      try {
        const win = highlightsApi(doc);
        win?.CSS?.highlights?.delete?.(UNIT_SELECT_HIGHLIGHT_NAME);
      } catch { /* ignore */ }
    }
    this._highlightDocs.clear();
  }

  _clearOverlays() {
    for (const el of this.overlays) {
      try { el.remove(); } catch { /* ignore */ }
    }
    this.overlays = [];
  }

  /**
   * @param {Array<Element|Range>} targets
   */
  _paintOverlayTargets(targets) {
    const seen = new Set();
    for (const target of targets) {
      let rects;
      try {
        if (target && target.nodeType === 1) {
          rects = [/** @type {Element} */ (target).getBoundingClientRect()];
        } else if (target && typeof target.getClientRects === 'function') {
          rects = Array.from(target.getClientRects());
        } else {
          continue;
        }
      } catch {
        continue;
      }
      for (const rect of rects) {
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        const sig = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        const overlay = document.createElement('div');
        overlay.className = CSS_CLASSES.UNIT_SELECT_OVERLAY;
        overlay.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background: ${COLORS.HIGHLIGHT_SELECTION_BG};
          border: 1px solid ${COLORS.HIGHLIGHT_SELECTION_BORDER};
          pointer-events: none;
          z-index: ${Z_INDEX.HIGHLIGHT_SELECTION};
          box-sizing: border-box;
        `;
        try {
          document.body.appendChild(overlay);
          this.overlays.push(overlay);
        } catch { /* ignore */ }
      }
    }
  }
}

/**
 * @param {string} kind
 * @param {Range|null} range
 * @param {string} [text]
 * @returns {UnitSelectItem|null}
 */
export function unitFromTextRange(kind, range, text) {
  if (!range || !rangeIsLive(range)) return null;
  const t = (text != null ? String(text) : rangePlainText(range)).trim();
  if (!t) return null;
  return {
    kind: /** @type {UnitSelectKind} */ (kind),
    key: `${kind}:${rangeKey(range)}`,
    range
  };
}

/**
 * @param {Element} element
 * @param {string|null} [url]
 * @returns {UnitSelectItem|null}
 */
export function unitFromImageElement(element, url) {
  if (!element || !element.isConnected) return null;
  return {
    kind: 'image',
    key: `image:${elementKey(element)}`,
    element,
    url: url || null
  };
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
