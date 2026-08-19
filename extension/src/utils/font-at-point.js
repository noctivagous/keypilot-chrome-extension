/**
 * Font inspection at a client point for the FONT_INFO Function.
 * Resolves the character under the cursor, expands a same-computed-font run,
 * and best-effort matches a web-font file URL (no DevTools debugger API).
 */

import { caretRangeAtPoint } from './text-at-point.js';

const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math',
  'fangsong', 'kai', 'inherit', 'initial', 'unset', 'revert', 'revert-layer'
]);

const INLINE_DISPLAY = new Set([
  'inline', 'inline-block', 'inline-flex', 'inline-grid', 'contents', 'ruby',
  'ruby-base', 'ruby-text', 'inline-table'
]);

/**
 * @param {string} value
 * @returns {string}
 */
function unquoteFamily(value) {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '').trim();
}

/**
 * @param {string} fontFamily
 * @returns {string[]}
 */
export function parseFontFamilyStack(fontFamily) {
  const out = [];
  const re = /(?:^|,)\s*("[^"]*"|'[^']*'|[^,]+)/g;
  let m;
  const src = String(fontFamily || '');
  while ((m = re.exec(src))) {
    const name = unquoteFamily(m[1]);
    if (name) out.push(name);
  }
  return out;
}

/**
 * @param {Element|null|undefined} el
 * @returns {string}
 */
function fontRunKey(el) {
  if (!el || el.nodeType !== 1) return '';
  try {
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    return [
      cs.fontFamily,
      cs.fontSize,
      cs.fontWeight,
      cs.fontStyle,
      cs.fontStretch || ''
    ].join('\u0001');
  } catch {
    return '';
  }
}

/**
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
function isInlineLevel(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    const d = el.ownerDocument.defaultView.getComputedStyle(el).display;
    return INLINE_DISPLAY.has(String(d || '').toLowerCase());
  } catch {
    return false;
  }
}

/**
 * @param {Node} node
 * @returns {Element|null}
 */
function nearestBlockAncestor(node) {
  let el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (el) {
    if (!isInlineLevel(el)) return el;
    el = el.parentElement;
  }
  return node?.ownerDocument?.body || null;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Document} doc
 * @returns {{ textNode: Text, offset: number }|null}
 */
function resolveTextCaret(x, y, doc) {
  const caret = caretRangeAtPoint(x, y, doc);
  if (!caret?.startContainer) return null;
  const node = caret.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    return { textNode: node, offset: caret.startOffset };
  }
  if (node.nodeType === Node.ELEMENT_NODE && node.childNodes?.length) {
    const child = node.childNodes[Math.min(caret.startOffset, node.childNodes.length - 1)];
    if (child?.nodeType === Node.TEXT_NODE) {
      return { textNode: child, offset: 0 };
    }
  }
  return null;
}

/**
 * @param {Text} origin
 * @param {string} key
 * @returns {{ startNode: Text, startOffset: number, endNode: Text, endOffset: number }}
 */
function expandSameFontRun(origin, key) {
  const fallback = {
    startNode: origin,
    startOffset: 0,
    endNode: origin,
    endOffset: String(origin.textContent || '').length
  };
  const block = nearestBlockAncestor(origin);
  const doc = origin.ownerDocument;
  const nodes = [];
  try {
    const walker = doc.createTreeWalker(block || doc.body, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      nodes.push(n);
      n = walker.nextNode();
    }
  } catch {
    return fallback;
  }

  const idx = nodes.indexOf(origin);
  if (idx < 0) return fallback;

  let start = idx;
  let end = idx;
  while (start > 0) {
    const prev = nodes[start - 1];
    const el = prev.parentElement;
    if (!el || fontRunKey(el) !== key) break;
    start -= 1;
  }
  while (end < nodes.length - 1) {
    const next = nodes[end + 1];
    const el = next.parentElement;
    if (!el || fontRunKey(el) !== key) break;
    end += 1;
  }

  const startNode = nodes[start];
  const endNode = nodes[end];
  return {
    startNode,
    startOffset: 0,
    endNode,
    endOffset: String(endNode.textContent || '').length
  };
}

/**
 * @param {string} src
 * @param {string} baseHref
 * @returns {{ urls: Array<{ url: string, format: string }>, local: boolean }}
 */
function parseFontSrc(src, baseHref) {
  const urls = [];
  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)(?:\s*format\(\s*(['"]?)([^'")]+)\3\s*\))?/gi;
  let m;
  while ((m = urlRe.exec(String(src || '')))) {
    let abs = m[2];
    try { abs = new URL(m[2], baseHref || undefined).href; } catch { /* keep */ }
    urls.push({ url: abs, format: String(m[4] || '').trim().toLowerCase() });
  }
  const local = /local\(/i.test(String(src || ''));
  return { urls, local };
}

/**
 * @param {string} format
 * @param {string} [url]
 * @returns {string}
 */
export function fontFileTypeLabel(format, url) {
  const blob = `${format || ''} ${url || ''}`.toLowerCase();
  if (/\.woff2\b/.test(blob) || blob.includes('woff2')) return '.woff2';
  if (/\.woff\b/.test(blob) || /\bwoff\b/.test(blob)) return '.woff';
  if (/\.otf\b/.test(blob) || blob.includes('opentype')) return '.otf';
  if (/\.ttf\b/.test(blob) || blob.includes('truetype')) return '.ttf';
  if (/\.eot\b/.test(blob) || blob.includes('embedded-opentype')) return '.eot';
  if (/\.svg\b/.test(blob) && blob.includes('font')) return '.svg';
  return '';
}

/**
 * @param {Document} doc
 * @returns {Array<{ family: string, weight: string, style: string, urls: Array<{url:string,format:string}>, local: boolean }>}
 */
function collectFontFaceRules(doc) {
  const out = [];
  const sheets = [];
  try { sheets.push(...doc.styleSheets); } catch { /* ignore */ }
  try {
    if (doc.adoptedStyleSheets?.length) sheets.push(...doc.adoptedStyleSheets);
  } catch { /* ignore */ }

  for (const sheet of sheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    const base = sheet.href || doc.baseURI || undefined;
    for (const rule of rules) {
      try {
        const isFace = (typeof CSSRule !== 'undefined' && rule.type === CSSRule.FONT_FACE_RULE)
          || String(rule.constructor?.name || '') === 'CSSFontFaceRule';
        if (!isFace) continue;
      } catch {
        continue;
      }
      const family = unquoteFamily(rule.style.getPropertyValue('font-family'));
      if (!family) continue;
      const src = rule.style.getPropertyValue('src');
      const parsed = parseFontSrc(src, base);
      out.push({
        family,
        weight: rule.style.getPropertyValue('font-weight') || 'normal',
        style: rule.style.getPropertyValue('font-style') || 'normal',
        ...parsed
      });
    }
  }
  return out;
}

/**
 * @param {string} sample
 * @param {CSSStyleDeclaration} cs
 * @param {string[]} families
 * @returns {string}
 */
function detectUsedFamily(sample, cs, families) {
  const size = cs.fontSize || '16px';
  const weight = cs.fontWeight || '400';
  const style = cs.fontStyle || 'normal';
  const stretch = cs.fontStretch || 'normal';
  const glyph = (sample && sample.trim()) ? sample.slice(0, 8) : 'HmgWil';

  try {
    for (const family of families) {
      if (GENERIC_FAMILIES.has(family.toLowerCase())) continue;
      const spec = `${style} ${weight} ${stretch} ${size} "${family}"`;
      if (typeof document.fonts?.check === 'function' && document.fonts.check(spec, glyph)) {
        return family;
      }
    }
  } catch { /* ignore */ }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return families[0] || '';
    const generics = ['monospace', 'serif', 'sans-serif'];
    const widths = {};
    for (const g of generics) {
      ctx.font = `${style} ${weight} ${size} ${g}`;
      widths[g] = ctx.measureText(glyph).width;
    }
    for (const family of families) {
      if (GENERIC_FAMILIES.has(family.toLowerCase())) continue;
      let distinct = false;
      for (const g of generics) {
        ctx.font = `${style} ${weight} ${size} "${family}", ${g}`;
        if (Math.abs(ctx.measureText(glyph).width - widths[g]) > 0.5) {
          distinct = true;
          break;
        }
      }
      if (distinct) return family;
    }
  } catch { /* ignore */ }

  return families.find((f) => !GENERIC_FAMILIES.has(f.toLowerCase())) || families[0] || '';
}

function normalizeWeight(w) {
  const s = String(w || 'normal').trim().toLowerCase();
  if (s === 'normal') return '400';
  if (s === 'bold') return '700';
  return s;
}

/**
 * @param {string} family
 * @param {CSSStyleDeclaration} cs
 * @param {Document} doc
 * @returns {{ fileType: string, resourceUrl: string, sourceKind: 'webfont'|'local' }}
 */
function resolveFontFile(family, cs, doc) {
  const want = String(family || '').toLowerCase();
  const faces = collectFontFaceRules(doc).filter(
    (f) => unquoteFamily(f.family).toLowerCase() === want
  );
  const fw = normalizeWeight(cs.fontWeight);
  const st = String(cs.fontStyle || 'normal').toLowerCase();
  const ranked = faces.map((f) => {
    let score = 0;
    const ffw = normalizeWeight(f.weight);
    if (ffw === fw || (ffw.includes(' ') && ffw.includes(fw))) score += 2;
    if (String(f.style || 'normal').toLowerCase() === st) score += 2;
    if (f.urls.length) score += 1;
    return { f, score };
  }).sort((a, b) => b.score - a.score);
  const pick = ranked[0]?.f || null;

  if (pick?.urls?.length) {
    const first = pick.urls[0];
    return {
      fileType: fontFileTypeLabel(first.format, first.url) || '.woff2',
      resourceUrl: first.url,
      sourceKind: 'webfont'
    };
  }
  if (pick?.local) {
    return { fileType: 'local', resourceUrl: '', sourceKind: 'local' };
  }

  try {
    const entries = typeof performance?.getEntriesByType === 'function'
      ? performance.getEntriesByType('resource')
      : [];
    const needle = family.replace(/\s+/g, '').toLowerCase();
    for (const e of entries) {
      const name = String(e?.name || '');
      const low = name.toLowerCase();
      if (!/\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(low)) continue;
      if (needle && low.replace(/[^a-z0-9]/g, '').includes(needle.replace(/[^a-z0-9]/g, ''))) {
        return {
          fileType: fontFileTypeLabel('', name),
          resourceUrl: name,
          sourceKind: 'webfont'
        };
      }
    }
  } catch { /* ignore */ }

  return { fileType: 'local', resourceUrl: '', sourceKind: 'local' };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {{ doc?: Document }} [opts]
 * @returns {{
 *   range: Range,
 *   element: Element,
 *   sampleText: string,
 *   familyStack: string,
 *   usedFamily: string,
 *   size: string,
 *   specifiedSize: string,
 *   weight: string,
 *   style: string,
 *   stretch: string,
 *   fileType: string,
 *   resourceUrl: string,
 *   sourceKind: 'webfont'|'local'
 * }|null}
 */
export function inspectFontAtPoint(x, y, opts = {}) {
  const doc = opts.doc || document;
  const caret = resolveTextCaret(x, y, doc);
  if (!caret?.textNode) return null;

  const el = caret.textNode.parentElement;
  if (!el) return null;

  const key = fontRunKey(el);
  const run = expandSameFontRun(caret.textNode, key);

  let range = null;
  try {
    range = doc.createRange();
    range.setStart(run.startNode, run.startOffset);
    range.setEnd(run.endNode, run.endOffset);
  } catch {
    return null;
  }
  if (!range || range.collapsed) return null;

  let cs;
  try {
    cs = el.ownerDocument.defaultView.getComputedStyle(el);
  } catch {
    return null;
  }

  const familyStack = String(cs.fontFamily || '');
  const families = parseFontFamilyStack(familyStack);
  const sample = String(caret.textNode.textContent || '').slice(
    Math.max(0, caret.offset - 1),
    Math.min(String(caret.textNode.textContent || '').length, caret.offset + 8)
  );
  const usedFamily = detectUsedFamily(sample, cs, families);
  const file = resolveFontFile(usedFamily || families[0] || '', cs, doc);

  let specifiedSize = '';
  try { specifiedSize = String(el.style?.fontSize || '').trim(); } catch { /* ignore */ }

  return {
    range,
    element: el,
    sampleText: String(range.toString() || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    familyStack,
    usedFamily: usedFamily || families[0] || '',
    size: String(cs.fontSize || ''),
    specifiedSize,
    weight: String(cs.fontWeight || ''),
    style: String(cs.fontStyle || ''),
    stretch: String(cs.fontStretch || ''),
    fileType: file.fileType,
    resourceUrl: file.resourceUrl,
    sourceKind: file.sourceKind
  };
}

const SKIP_FONT_SCAN_TAGS = new Set([
  'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR', 'HR', 'SOURCE', 'TRACK',
  'PARAM', 'HEAD', 'TITLE', 'TEMPLATE'
]);

function isKpChromeEl(el) {
  if (!el || el.nodeType !== 1) return false;
  try {
    const id = typeof el.id === 'string' ? el.id : '';
    if (id && (id.startsWith('kpv2-') || id.startsWith('kp-'))) return true;
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
 * Browser-internal font files (chrome://resources, chrome-extension://, …).
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
function isBrowserInternalFontUrl(url) {
  return /^(chrome|chrome-extension|chrome-untrusted):/i.test(String(url || '').trim());
}

function customFileRank(ext) {
  const e = String(ext || '').replace(/^\./, '').toLowerCase();
  if (e === 'woff2') return 0;
  if (e === 'otf') return 1;
  if (e === 'ttf') return 2;
  if (e === 'woff') return 3;
  if (e === 'eot') return 4;
  if (e && e !== 'local' && e !== 'font') return 5;
  return 20;
}

/**
 * Fonts used (or declared) on the page for the Page Media Fonts tab.
 * Custom file fonts (.woff2 / .otf / .ttf / …) are listed first.
 *
 * @param {Document|Element} [root]
 * @returns {Array<{
 *   category: 'font',
 *   kind: 'custom'|'local',
 *   url: string,
 *   element: Element|null,
 *   label: string,
 *   ext: string,
 *   fontFamily: string,
 *   fontWeight?: string,
 *   fontStyle?: string,
 *   sourceKind: 'webfont'|'local'
 * }>}
 */
export function collectPageFonts(root = document) {
  const doc = /** @type {Document} */ (
    root && /** @type {any} */ (root).nodeType === 9
      ? root
      : (/** @type {Element} */ (root)?.ownerDocument || document)
  );
  const scanRoot = root && /** @type {any} */ (root).nodeType === 1 ? root : (doc.body || doc.documentElement);

  /** @type {Map<string, { family: string, el: Element|null, weight: string, style: string }>} */
  const used = new Map();
  const MAX = 4000;
  let n = 0;
  try {
    const list = scanRoot?.querySelectorAll?.('*') || [];
    for (let i = 0; i < list.length && n < MAX; i++) {
      const el = list[i];
      if (!el || el.nodeType !== 1) continue;
      const tag = String(el.tagName || '').toUpperCase();
      if (SKIP_FONT_SCAN_TAGS.has(tag)) continue;
      if (isKpChromeEl(el)) continue;
      n += 1;
      let cs;
      try { cs = doc.defaultView.getComputedStyle(el); } catch { continue; }
      if (!cs) continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const families = parseFontFamilyStack(cs.fontFamily);
      if (!families.length) continue;
      const family = detectUsedFamily('Hg', cs, families) || families[0];
      if (!family || GENERIC_FAMILIES.has(family.toLowerCase())) continue;
      const key = family.toLowerCase();
      if (!used.has(key)) {
        used.set(key, {
          family,
          el,
          weight: String(cs.fontWeight || ''),
          style: String(cs.fontStyle || '')
        });
      }
    }
  } catch { /* ignore */ }

  const faces = collectFontFaceRules(doc);
  /** @type {ReturnType<typeof collectPageFonts>} */
  const items = [];
  const seen = new Set();

  const push = (item) => {
    if (isBrowserInternalFontUrl(item?.url)) return;
    const key = [
      String(item.fontFamily || '').toLowerCase(),
      String(item.url || ''),
      String(item.fontWeight || ''),
      String(item.fontStyle || '')
    ].join('\u0001');
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  for (const face of faces) {
    const first = (face.urls || []).find((u) => u?.url && !isBrowserInternalFontUrl(u.url)) || null;
    const url = first?.url || '';
    const fileType = fontFileTypeLabel(first?.format || '', url);
    const ext = (fileType || '').replace(/^\./, '') || (url ? 'font' : 'local');
    const familyKey = unquoteFamily(face.family).toLowerCase();
    const rec = used.get(familyKey);
    const isCustom = !!url;
    if (!isCustom && !rec) continue;
    push({
      category: 'font',
      kind: isCustom ? 'custom' : 'local',
      url,
      element: rec?.el || null,
      label: face.family,
      ext,
      fontFamily: face.family,
      fontWeight: face.weight || rec?.weight || '',
      fontStyle: face.style || rec?.style || '',
      sourceKind: isCustom ? 'webfont' : 'local'
    });
  }

  try {
    const entries = typeof performance?.getEntriesByType === 'function'
      ? performance.getEntriesByType('resource')
      : [];
    for (const rec of used.values()) {
      const already = items.some((it) => String(it.fontFamily || '').toLowerCase() === rec.family.toLowerCase() && it.url);
      if (already) continue;
      const needle = rec.family.replace(/\s+/g, '').toLowerCase();
      for (const e of entries) {
        const name = String(e?.name || '');
        if (isBrowserInternalFontUrl(name)) continue;
        const low = name.toLowerCase();
        if (!/\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(low)) continue;
        if (needle && low.replace(/[^a-z0-9]/g, '').includes(needle.replace(/[^a-z0-9]/g, ''))) {
          const fileType = fontFileTypeLabel('', name);
          push({
            category: 'font',
            kind: 'custom',
            url: name,
            element: rec.el,
            label: rec.family,
            ext: (fileType || '').replace(/^\./, '') || 'font',
            fontFamily: rec.family,
            fontWeight: rec.weight,
            fontStyle: rec.style,
            sourceKind: 'webfont'
          });
          break;
        }
      }
    }
  } catch { /* ignore */ }

  for (const rec of used.values()) {
    const has = items.some((it) => String(it.fontFamily || '').toLowerCase() === rec.family.toLowerCase());
    if (has) continue;
    push({
      category: 'font',
      kind: 'local',
      url: '',
      element: rec.el,
      label: rec.family,
      ext: 'local',
      fontFamily: rec.family,
      fontWeight: rec.weight,
      fontStyle: rec.style,
      sourceKind: 'local'
    });
  }

  items.sort((a, b) => {
    const ca = a.kind === 'custom' ? 0 : 1;
    const cb = b.kind === 'custom' ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const ra = customFileRank(a.ext);
    const rb = customFileRank(b.ext);
    if (ra !== rb) return ra - rb;
    return String(a.label || '').localeCompare(String(b.label || ''));
  });

  return items;
}

