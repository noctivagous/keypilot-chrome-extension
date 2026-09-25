/**
 * Reader Mode overlay — distilled article in KeyPilot chrome.
 * DOM-only (TrustedHTML-safe). Prefixes: kpv2-reader-*.
 */

import { getMessage } from '../utils/i18n.js';
import {
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_FONT,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_BACKDROP_CLASS,
  NCT_DARK_UI_SCROLLBAR_CLASS,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM,
  getNctDarkUiBackdropCss,
  getNctDarkUiScrollbarCss
} from './nct-dark-ui.js';
import { Z_INDEX } from '../config/constants.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import { sanitizeArticleHtml } from '../utils/reader-mode-extract.js';

const OVERLAY_ID = 'kpv2-reader-overlay';

/** @type {HTMLElement|null} */
let _overlay = null;
/** @type {(() => void)|null} */
let _onClose = null;
/** @type {((e: KeyboardEvent) => void)|null} */
let _keyHandler = null;
/** @type {string|null} */
let _prevOverflow = null;

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
 *   onClose?: () => void
 * }} opts
 */
export function openReaderModeOverlay({ title, html, byline, onClose } = /** @type {any} */ ({})) {
  closeReaderModeOverlay();

  _onClose = typeof onClose === 'function' ? onClose : null;

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

  const header = document.createElement('div');
  header.className = 'kpv2-reader-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'kpv2-reader-title-wrap';
  const heading = document.createElement('h2');
  heading.className = 'kpv2-reader-title';
  heading.textContent = String(title || '').trim() || getMessage('reader_mode_title');
  titleWrap.appendChild(heading);
  const bylineText = String(byline || '').trim();
  if (bylineText) {
    const by = document.createElement('p');
    by.className = 'kpv2-reader-byline';
    by.textContent = bylineText;
    titleWrap.appendChild(by);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kpv2-reader-close';
  closeBtn.textContent = getMessage('overlay_close');
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeReaderModeOverlay();
  }, true);

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = `kpv2-reader-content ${NCT_DARK_UI_SCROLLBAR_CLASS}`;
  const article = document.createElement('article');
  article.className = 'kpv2-reader-article';
  article.appendChild(sanitizeArticleHtml(html, document));
  content.appendChild(article);

  shell.appendChild(header);
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
.kpv2-reader-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 10px 14px;
  background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
  border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
  flex-shrink: 0;
}
.kpv2-reader-title-wrap {
  flex: 1;
  min-width: 0;
}
.kpv2-reader-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.3;
  color: ${c.fg};
}
.kpv2-reader-byline {
  margin: 4px 0 0;
  font-size: 12px;
  color: ${c.fgDim};
}
.kpv2-reader-close {
  flex-shrink: 0;
  padding: 5px 12px;
  border: ${NCT_DARK_UI_BTN_BORDER};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${c.fg};
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.kpv2-reader-close:hover {
  color: #fff;
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
