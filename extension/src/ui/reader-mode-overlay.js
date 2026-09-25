/**
 * Reader Mode overlay — distilled article in KeyPilot chrome.
 * DOM-only (TrustedHTML-safe). Prefixes: kpv2-reader-*.
 */

import { getMessage, localizeKeycapLabel } from '../utils/i18n.js';
import {
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_FONT,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_BACKDROP_CLASS,
  NCT_DARK_UI_SCROLLBAR_CLASS,
  getNctDarkUiBackdropCss,
  getNctDarkUiScrollbarCss
} from './nct-dark-ui.js';
import { Z_INDEX } from '../config/constants.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import { sanitizeArticleHtml } from '../utils/reader-mode-extract.js';
import { createPopoverTitlebar, createTitlebarCloseHint } from './popover-titlebar.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';

const OVERLAY_ID = 'kpv2-reader-overlay';
/** Reader Mode toolbar: show article images. Default on. */
const SHOW_IMAGES_STORAGE_KEY = 'kp_reader_mode_show_images';

/** @type {HTMLElement|null} */
let _overlay = null;
/** @type {HTMLElement|null} */
let _article = null;
/** @type {(() => void)|null} */
let _onClose = null;
/** @type {((e: KeyboardEvent) => void)|null} */
let _keyHandler = null;
/** @type {string|null} */
let _prevOverflow = null;
/** Bumped on open and close so a late storage read cannot mount a closed overlay. */
let _mountGeneration = 0;
/** @type {boolean} */
let _showImages = true;
/** @type {boolean} */
let _showImagesLoaded = false;

function getOverlayRoot() {
  return _overlay?.shadowRoot || _overlay;
}

/**
 * @returns {boolean}
 */
export function isReaderModeOverlayOpen() {
  return !!_overlay && !!document.getElementById(OVERLAY_ID);
}

/**
 * @returns {boolean}
 */
export function requestCloseReaderModeOverlay() {
  if (!isReaderModeOverlayOpen()) return false;
  closeReaderModeOverlay();
  return true;
}

export function closeReaderModeOverlay() {
  _mountGeneration += 1;
  _article = null;
  if (_keyHandler) {
    try { document.removeEventListener('keydown', _keyHandler, true); } catch { /* ignore */ }
    _keyHandler = null;
  }
  if (_overlay) {
    try { _overlay.remove(); } catch { /* ignore */ }
    _overlay = null;
  }
  if (_prevOverflow != null) {
    try { document.body.style.overflow = _prevOverflow; } catch { /* ignore */ }
    _prevOverflow = null;
  }
  const cb = _onClose;
  _onClose = null;
  if (typeof cb === 'function') {
    try { cb(); } catch { /* ignore */ }
  }
}

/**
 * @param {{
 *   title?: string,
 *   html: string,
 *   byline?: string,
 *   closeKey?: string,
 *   onClose?: () => void
 * }} opts
 */
export function openReaderModeOverlay({ title, html, byline, closeKey, onClose } = /** @type {any} */ ({})) {
  closeReaderModeOverlay();
  const generation = ++_mountGeneration;
  _onClose = typeof onClose === 'function' ? onClose : null;
  void mountReaderModeOverlay(generation, { title, html, byline, closeKey });
}

/**
 * @param {number} generation
 * @param {{ title?: string, html: string, byline?: string, closeKey?: string }} opts
 */
async function mountReaderModeOverlay(generation, { title, html, byline, closeKey }) {
  const showImages = await readShowImages();
  if (generation !== _mountGeneration) return;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'kpv2-reader-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', getMessage('reader_mode_aria'));
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: ${Z_INDEX.POPUP_PANEL_MAX + 20};
  `;
  const shadowRoot = ensureOpenChromeShadow(overlay, { id: 'reader-mode' });
  const mount = shadowRoot || overlay;
  ensureStyles(mount);

  const backdrop = document.createElement('div');
  backdrop.className = NCT_DARK_UI_BACKDROP_CLASS;
  backdrop.setAttribute('aria-hidden', 'true');

  const shell = document.createElement('div');
  shell.className = 'kpv2-reader-shell';

  const hideKey = localizeKeycapLabel(String(closeKey || '').trim() || 'P');
  const titlebarApi = createPopoverTitlebar({
    title: getMessage('reader_mode_title'),
    shortcut: hideKey,
    icon: 'window',
    variant: 'preview',
    showClose: true,
    onClose: closeReaderModeOverlay,
    closeTitle: getMessage('popover_titlebar_close'),
    hint: createTitlebarCloseHint({
      keys: [localizeKeycapLabel('Esc'), hideKey],
      suffix: getMessage('popover_hide_hint_suffix')
    }),
    className: 'kpv2-reader-titlebar'
  });

  const content = document.createElement('div');
  content.className = `kpv2-reader-content ${NCT_DARK_UI_SCROLLBAR_CLASS}`;
  const article = document.createElement('article');
  article.className = 'kpv2-reader-article';
  _article = article;
  applyShowImages(showImages);

  const articleTitle = String(title || '').trim();
  const bylineText = String(byline || '').trim();
  if (articleTitle || bylineText) {
    const head = document.createElement('header');
    head.className = 'kpv2-reader-article-head';
    if (articleTitle) {
      const heading = document.createElement('h1');
      heading.textContent = articleTitle;
      head.appendChild(heading);
    }
    if (bylineText) {
      const by = document.createElement('p');
      by.className = 'kpv2-reader-byline';
      by.textContent = bylineText;
      head.appendChild(by);
    }
    article.appendChild(head);
  }
  article.appendChild(sanitizeArticleHtml(html, document));
  content.appendChild(article);

  shell.appendChild(titlebarApi.titlebar);
  shell.appendChild(createReaderToolbar(showImages));
  shell.appendChild(content);
  mount.appendChild(backdrop);
  mount.appendChild(shell);

  document.body.appendChild(overlay);
  _overlay = overlay;

  try {
    _prevOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  } catch { /* ignore */ }

  _keyHandler = (e) => {
    if (!isReaderModeOverlayOpen()) return;
    const isEsc = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape';
    if (!isEsc) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeReaderModeOverlay();
  };
  document.addEventListener('keydown', _keyHandler, true);

  try { content.focus?.(); } catch { /* ignore */ }
}

/**
 * @returns {Promise<boolean>}
 */
async function readShowImages() {
  if (_showImagesLoaded) return _showImages;
  try {
    const stored = await storageGetValue(SHOW_IMAGES_STORAGE_KEY, true);
    _showImages = stored !== false;
  } catch {
    _showImages = true;
  }
  _showImagesLoaded = true;
  return _showImages;
}

/**
 * @param {boolean} show
 */
function persistShowImages(show) {
  _showImages = !!show;
  _showImagesLoaded = true;
  applyShowImages(_showImages);
  try {
    void storageSetValue(SHOW_IMAGES_STORAGE_KEY, _showImages);
  } catch { /* ignore */ }
}

/**
 * @param {boolean} show
 */
function applyShowImages(show) {
  _article?.classList.toggle('is-hide-images', !show);
}

/**
 * @param {boolean} showImages
 * @returns {HTMLElement}
 */
function createReaderToolbar(showImages) {
  const bar = document.createElement('div');
  bar.className = 'kpv2-reader-toolbar';

  const label = document.createElement('label');
  label.className = 'kpv2-reader-show-images';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!showImages;
  input.setAttribute('aria-label', getMessage('reader_mode_show_images_aria'));
  input.addEventListener('change', () => {
    persistShowImages(!!input.checked);
  });

  const text = document.createElement('span');
  text.textContent = getMessage('reader_mode_show_images');

  label.appendChild(input);
  label.appendChild(text);
  bar.appendChild(label);
  return bar;
}

/**
 * @param {ParentNode} root
 */
function ensureStyles(root) {
  if (!root) return;
  const c = NCT_DARK_UI_COLORS;
  const css = `
.kpv2-reader-shell {
  position: absolute;
  inset: 10pt;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(15, 15, 16, 0.96);
  border: ${NCT_DARK_UI_PANEL_BORDER};
  border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
  box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
  font-family: ${NCT_DARK_UI_FONT};
  color: ${c.fg};
}
${getNctDarkUiBackdropCss()}
${getNctDarkUiScrollbarCss()}
.kpv2-reader-titlebar {
  border-radius: ${NCT_DARK_UI_PANEL_RADIUS} ${NCT_DARK_UI_PANEL_RADIUS} 0 0;
}
.kpv2-reader-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 8px 14px;
  background: ${c.panel};
  border-bottom: 1px solid ${c.panelEdgeDark};
  box-shadow: 0 1px 0 ${c.panelEdge} inset;
}
.kpv2-reader-show-images {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: ${c.fgDim};
  letter-spacing: 0.02em;
  user-select: none;
  white-space: nowrap;
  cursor: pointer;
}
.kpv2-reader-show-images input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: ${c.accent};
  cursor: pointer;
}
.kpv2-reader-article-head {
  margin: 0 0 1.25em;
}
.kpv2-reader-article-head h1 {
  margin: 0;
  font-size: 1.6em;
  font-weight: 700;
  line-height: 1.25;
}
.kpv2-reader-byline {
  margin: 0.4em 0 0;
  font-size: 0.85em;
  color: ${c.fgDim};
}
.kpv2-reader-content {
  flex: 1;
  overflow: auto;
  padding: 24px 16px 40px;
}
.kpv2-reader-article {
  max-width: 42rem;
  margin: 0 auto;
  font-size: 18px;
  line-height: 1.65;
  color: ${c.fg};
  user-select: text;
  -webkit-user-select: text;
}
.kpv2-reader-article h1,
.kpv2-reader-article h2,
.kpv2-reader-article h3,
.kpv2-reader-article h4 {
  line-height: 1.25;
  margin: 1.4em 0 0.5em;
}
.kpv2-reader-article .kpv2-reader-article-head h1 {
  margin: 0;
}
.kpv2-reader-article p,
.kpv2-reader-article ul,
.kpv2-reader-article ol,
.kpv2-reader-article blockquote,
.kpv2-reader-article figure,
.kpv2-reader-article pre {
  margin: 0 0 1em;
}
.kpv2-reader-article img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
  border-radius: 6px;
}
.kpv2-reader-article.is-hide-images img,
.kpv2-reader-article.is-hide-images figure,
.kpv2-reader-article.is-hide-images a:has(> img:only-child) {
  display: none;
}
.kpv2-reader-article a {
  color: ${c.accent};
}
.kpv2-reader-article pre,
.kpv2-reader-article code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}
.kpv2-reader-article pre {
  padding: 12px;
  overflow: auto;
  background: ${c.fieldBg};
  border-radius: 6px;
}
.kpv2-reader-article blockquote {
  padding: 0 0 0 14px;
  border-left: 3px solid ${c.accent};
  color: ${c.fgDim};
}
`;
  injectChromeStyles(root, {
    attr: 'data-kp-reader-mode-styles',
    css
  });
}
