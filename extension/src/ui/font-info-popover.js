/**
 * Font Info result popover — structured font details for the run under the cursor.
 */
import { Z_INDEX, KP_UI_FONT } from '../config/constants.js';
import { makePanelDraggable } from '../utils/panel-position.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import {
  NCT_DARK_UI_PANEL_BACKGROUND,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_BTN_LIT_GRADIENT,
  NCT_DARK_UI_BTN_LIT_BORDER,
  NCT_DARK_UI_HOVER_TINT,
  NCT_DARK_UI_COLORS
} from './nct-dark-ui.js';

const STYLE_ATTR = 'data-kp-font-info-style';
const ROOT_CLASS = 'kp-font-info';

/** @type {HTMLElement|null} */
let _root = null;
/** @type {{ dispose: () => void }|null} */
let _dragApi = null;
/** @type {(() => void)|null} */
let _onClose = null;

function ensureStyles(root) {
  injectChromeStyles(root, { attr: STYLE_ATTR, css: `
:host {
  position: fixed;
  z-index: ${Z_INDEX.KEY_ACTION_CONFIG || 2147483047};
  width: min(440px, calc(100vw - 24px));
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  color: ${NCT_DARK_UI_COLORS.fg};
  font-family: ${KP_UI_FONT || 'system-ui, sans-serif'};
  font-size: 12px;
  line-height: 1.45;
  border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
  border: ${NCT_DARK_UI_PANEL_BORDER};
  background: ${NCT_DARK_UI_PANEL_BACKGROUND};
  box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
  box-sizing: border-box;
}
:host([hidden]) { display: none !important; }
.${ROOT_CLASS}__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: grab;
  user-select: none;
  background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
  border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
  flex: 0 0 auto;
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
}
.${ROOT_CLASS}__title {
  font-weight: var(--kp-titlebar-title-weight, 600);
  font-size: 12px;
  color: var(--kp-color-fg, inherit);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${ROOT_CLASS}__close {
  appearance: none;
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  border: ${NCT_DARK_UI_BTN_BORDER};
  color: inherit;
  width: 22px;
  height: 22px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.${ROOT_CLASS}__body {
  padding: 10px 12px;
  overflow: auto;
  flex: 1 1 auto;
}
.${ROOT_CLASS}__rows {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 6px 10px;
  align-items: start;
}
.${ROOT_CLASS}__label {
  color: ${NCT_DARK_UI_COLORS.fgMute};
  font-size: 11px;
  padding-top: 1px;
}
.${ROOT_CLASS}__value {
  word-break: break-word;
  min-width: 0;
}
.${ROOT_CLASS}__sample {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: rgba(0,0,0,0.22);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${ROOT_CLASS}__url {
  display: block;
  color: inherit;
  text-decoration: underline;
  word-break: break-all;
}
.${ROOT_CLASS}__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 12px 10px;
  border-top: 1px solid rgba(0,0,0,0.35);
  flex: 0 0 auto;
}
.${ROOT_CLASS}__btn {
  appearance: none;
  border: ${NCT_DARK_UI_BTN_BORDER};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${NCT_DARK_UI_COLORS.fg};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  padding: 5px 10px;
  font: inherit;
  cursor: pointer;
}
.${ROOT_CLASS}__btn:hover {
  background: ${NCT_DARK_UI_HOVER_TINT};
}
.${ROOT_CLASS}__btn[data-primary="true"] {
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  color: #e8f0f8;
}
.${ROOT_CLASS}__btn:disabled {
  opacity: 0.45;
  cursor: default;
}
` });
}

function filenameFromUrl(url, fileType) {
  try {
    const path = new URL(url, location.href).pathname || '';
    const base = path.split('/').filter(Boolean).pop() || '';
    if (base) return decodeURIComponent(base);
  } catch { /* ignore */ }
  const ext = fileType && fileType.startsWith('.') ? fileType : '.woff2';
  return `font${ext}`;
}

function summaryText(info) {
  const lines = [
    `Name: ${info.usedFamily || ''}`,
    `Family: ${info.familyStack || ''}`,
    `Size: ${info.size || ''}`,
    `Weight: ${info.weight || ''}`,
    `Style: ${info.style || ''}`,
    `Stretch: ${info.stretch || ''}`,
    `File type: ${info.fileType || (info.sourceKind === 'local' ? 'local' : '')}`,
    `URL: ${info.resourceUrl || '(local / system font)'}`
  ];
  return lines.join('\n');
}

function closeInternal() {
  if (_root) _root.hidden = true;
  const cb = _onClose;
  _onClose = null;
  try { cb?.(); } catch { /* ignore */ }
}

/**
 * @param {object} info
 * @param {() => void} [info.onClose]
 * @param {{ left?: number, top?: number }|null} [anchor]
 */
export function showFontInfoPopover(info = {}, anchor = null) {
  const doc = document;

  if (!_root) {
    _root = doc.createElement('div');
    _root.className = ROOT_CLASS;
    _root.setAttribute('role', 'dialog');
    _root.setAttribute('aria-label', 'Font Info');
    const shadowRoot = ensureOpenChromeShadow(_root, { id: 'font-info', chromeWindow: true });
    const panelRoot = shadowRoot || _root;
    ensureStyles(panelRoot);
    panelRoot.innerHTML = `
      <div class="${ROOT_CLASS}__titlebar" data-kp-font-info-drag="true">
        <div class="${ROOT_CLASS}__title">Font Info</div>
        <button type="button" class="${ROOT_CLASS}__close" aria-label="Close">×</button>
      </div>
      <div class="${ROOT_CLASS}__body"></div>
      <div class="${ROOT_CLASS}__actions">
        <button type="button" class="${ROOT_CLASS}__btn" data-kp-font-download="true">Download</button>
        <button type="button" class="${ROOT_CLASS}__btn" data-kp-font-copy="true">Copy</button>
        <button type="button" class="${ROOT_CLASS}__btn" data-primary="true" data-kp-font-close="true">Done</button>
      </div>
    `;
    doc.body.appendChild(_root);

    panelRoot.querySelector(`.${ROOT_CLASS}__close`)?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideFontInfoPopover();
    });
    panelRoot.querySelector('[data-kp-font-close="true"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideFontInfoPopover();
    });

    const handle = panelRoot.querySelector('[data-kp-font-info-drag="true"]');
    _dragApi = makePanelDraggable(_root, handle, {
      excludeSelector: `.${ROOT_CLASS}__close`
    });
  }

  _onClose = typeof info.onClose === 'function' ? info.onClose : null;

  const panelRoot = _root.shadowRoot || _root;
  ensureStyles(panelRoot);

  const body = panelRoot.querySelector(`.${ROOT_CLASS}__body`);
  if (body) {
    body.replaceChildren();
    if (info.sampleText) {
      const sample = doc.createElement('div');
      sample.className = `${ROOT_CLASS}__sample`;
      sample.textContent = info.sampleText;
      try {
        sample.style.fontFamily = info.familyStack || 'inherit';
        sample.style.fontSize = '16px';
        sample.style.fontWeight = info.weight || 'inherit';
        sample.style.fontStyle = info.style || 'inherit';
      } catch { /* ignore */ }
      body.appendChild(sample);
    }

    const rows = doc.createElement('div');
    rows.className = `${ROOT_CLASS}__rows`;
    const sizeValue = info.size && info.specifiedSize && info.specifiedSize !== info.size
      ? `${info.size} (${info.specifiedSize})`
      : (info.size || '');
    const fileType = info.fileType || (info.sourceKind === 'local' ? 'local' : '');
    const pairs = [
      ['Name', info.usedFamily || ''],
      ['Family', info.familyStack || ''],
      ['Size', sizeValue],
      ['Weight', info.weight || ''],
      ['Style', info.style || ''],
      ['Stretch', info.stretch || ''],
      ['File type', fileType]
    ];
    for (const [label, value] of pairs) {
      const l = doc.createElement('div');
      l.className = `${ROOT_CLASS}__label`;
      l.textContent = label;
      const v = doc.createElement('div');
      v.className = `${ROOT_CLASS}__value`;
      v.textContent = value;
      rows.appendChild(l);
      rows.appendChild(v);
    }

    const urlLabel = doc.createElement('div');
    urlLabel.className = `${ROOT_CLASS}__label`;
    urlLabel.textContent = 'URL';
    const urlVal = doc.createElement('div');
    urlVal.className = `${ROOT_CLASS}__value`;
    if (info.resourceUrl) {
      const a = doc.createElement('a');
      a.className = `${ROOT_CLASS}__url`;
      a.href = info.resourceUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = info.resourceUrl;
      urlVal.appendChild(a);
    } else {
      urlVal.textContent = 'Local / system font';
    }
    rows.appendChild(urlLabel);
    rows.appendChild(urlVal);
    body.appendChild(rows);
  }

  const copyBtn = panelRoot.querySelector('[data-kp-font-copy="true"]');
  if (copyBtn) {
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      let ok = false;
      try {
        await navigator.clipboard.writeText(summaryText(info));
        ok = true;
      } catch { /* ignore */ }
      copyBtn.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(() => { try { copyBtn.textContent = 'Copy'; } catch { /* ignore */ } }, 1200);
    };
  }

  const dlBtn = panelRoot.querySelector('[data-kp-font-download="true"]');
  if (dlBtn) {
    const canDownload = !!info.resourceUrl && info.sourceKind !== 'local';
    dlBtn.disabled = !canDownload;
    dlBtn.textContent = 'Download';
    dlBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canDownload) return;
      dlBtn.disabled = true;
      dlBtn.textContent = 'Downloading…';
      let ok = false;
      try {
        const res = await fetch(info.resourceUrl);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = href;
        a.download = filenameFromUrl(info.resourceUrl, info.fileType);
        a.rel = 'noopener';
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(href); } catch { /* ignore */ } }, 4000);
        ok = true;
      } catch {
        ok = false;
      }
      dlBtn.textContent = ok ? 'Downloaded' : 'Download failed';
      dlBtn.disabled = !ok && canDownload ? false : !canDownload;
      if (ok) {
        setTimeout(() => {
          try {
            dlBtn.textContent = 'Download';
            dlBtn.disabled = !canDownload;
          } catch { /* ignore */ }
        }, 1400);
      }
    };
  }

  _root.hidden = false;
  const margin = 16;
  const vw = window.innerWidth || 800;
  const vh = window.innerHeight || 600;
  let left = Number.isFinite(anchor?.left) ? Math.round(anchor.left) : Math.max(margin, Math.round(vw * 0.5 - 220));
  let top = Number.isFinite(anchor?.top) ? Math.round(anchor.top) : Math.max(margin, Math.round(vh * 0.18));
  left = Math.max(margin, Math.min(left, vw - 280));
  top = Math.max(margin, Math.min(top, vh - 160));
  _root.style.left = `${left}px`;
  _root.style.top = `${top}px`;
  _root.style.right = 'auto';
  _root.style.bottom = 'auto';
}

export function hideFontInfoPopover() {
  closeInternal();
}

export function isFontInfoPopoverOpen() {
  return !!(_root && !_root.hidden);
}

export function disposeFontInfoPopover() {
  try { _dragApi?.dispose?.(); } catch { /* ignore */ }
  _dragApi = null;
  _onClose = null;
  try { _root?.remove?.(); } catch { /* ignore */ }
  _root = null;
}
