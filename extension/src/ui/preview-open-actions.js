/**
 * Shared outline "Open" / "Open in New Tab" action buttons for preview chrome
 * (Link Preview titlebar, Launcher preview bar, etc.).
 */

import { KP_UI_FONT } from '../config/constants.js';
import {
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_HOVER_TINT,
  NCT_DARK_UI_COLORS
} from './nct-dark-ui.js';

/**
 * @param {Document} doc
 * @param {Array<{ tag?: string, attrs: Record<string, string> }>} paths
 * @returns {SVGElement}
 */
export function createOutlineIcon(doc, paths) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'flex-shrink: 0; display: block;';
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.75',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  };
  for (const p of paths || []) {
    const el = doc.createElementNS('http://www.w3.org/2000/svg', p.tag || 'path');
    for (const [k, v] of Object.entries({ ...common, ...(p.attrs || {}) })) {
      el.setAttribute(k, v);
    }
    svg.appendChild(el);
  }
  return svg;
}

// Explicit chrome styles so host-page bare `button` rules cannot restyle layout.
// Slashdot (classic.ssl.css) ships `button { margin: 0 0 40px 0; margin-right: 10%; ... }`
// which otherwise inflates the Link Preview titlebar (~76px instead of ~34px).
const TITLEBAR_BTN_STYLE = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  border: ${NCT_DARK_UI_BTN_BORDER};
  color: ${NCT_DARK_UI_COLORS.fg};
  font-size: 11px;
  font-weight: 500;
  font-family: ${KP_UI_FONT};
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  text-shadow: none;
  box-shadow: none;
  padding: 4px 8px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  min-width: 0;
  min-height: 0;
  height: auto;
  width: auto;
  position: relative;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
`;

/**
 * @param {HTMLElement} btn
 */
function wireTitlebarBtnHover(btn) {
  btn.addEventListener('mouseenter', () => {
    btn.style.background = NCT_DARK_UI_HOVER_TINT;
    btn.style.borderColor = NCT_DARK_UI_COLORS.panelEdge;
    btn.style.color = '#fff';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = NCT_DARK_UI_BTN_GRADIENT;
    btn.style.borderColor = NCT_DARK_UI_COLORS.panelEdgeDark;
    btn.style.color = NCT_DARK_UI_COLORS.fg;
  });
}

/**
 * Compact labeled titlebar action (same chrome as Open / Open in New Tab).
 *
 * @param {object} opts
 * @param {Document} [opts.doc]
 * @param {string} opts.label
 * @param {string} [opts.title]
 * @param {string} [opts.className]
 * @param {Array<{ tag?: string, attrs: Record<string, string> }>} [opts.iconPaths]
 * @param {(e: MouseEvent) => void} [opts.onClick]
 * @returns {HTMLButtonElement}
 */
export function createTitlebarActionButton({
  doc = document,
  label,
  title,
  className,
  iconPaths,
  onClick
} = {}) {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = className || 'kpv2-popover-titlebar-action';
  btn.style.cssText = TITLEBAR_BTN_STYLE;
  const text = String(label || '').trim();
  if (Array.isArray(iconPaths) && iconPaths.length) {
    btn.appendChild(createOutlineIcon(doc, iconPaths));
  }
  if (text) {
    const span = doc.createElement('span');
    span.textContent = text;
    btn.appendChild(span);
  }
  const tip = title || text;
  if (tip) {
    btn.title = tip;
    btn.setAttribute('aria-label', tip);
  }
  if (typeof onClick === 'function') {
    btn.addEventListener('click', (e) => {
      try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
      try { onClick(e); } catch { /* ignore */ }
    });
  }
  wireTitlebarBtnHover(btn);
  return btn;
}

/**
 * Build outline "Open" + "Open in New Tab" buttons.
 *
 * @param {object} opts
 * @param {Document} [opts.doc]
 * @param {() => (string|null|undefined)} opts.getUrl - resolve the URL at click time
 * @param {() => void} [opts.afterOpen] - e.g. close popover / launcher after navigating
 * @param {() => void} [opts.afterOpenNewTab]
 * @returns {{ openButton: HTMLButtonElement, openNewTabButton: HTMLButtonElement, actions: HTMLElement }}
 */
export function createPreviewOpenActionButtons({
  doc = document,
  getUrl,
  afterOpen,
  afterOpenNewTab
} = {}) {
  const resolveUrl = typeof getUrl === 'function' ? getUrl : () => null;

  const actions = doc.createElement('div');
  actions.className = 'kp-preview-open-actions';
  actions.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  `;

  // "Open" — navigate current tab
  const openButton = doc.createElement('button');
  openButton.type = 'button';
  openButton.className = 'kpv2-preview-open-btn';
  openButton.style.cssText = TITLEBAR_BTN_STYLE;
  openButton.appendChild(createOutlineIcon(doc, [
    { attrs: { d: 'M14 3h7v7' } },
    { attrs: { d: 'M10 14L21 3' } },
    { attrs: { d: 'M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5' } }
  ]));
  const openLabel = doc.createElement('span');
  openLabel.textContent = 'Open';
  openButton.appendChild(openLabel);
  openButton.title = 'Open in this tab';
  openButton.setAttribute('aria-label', 'Open in this tab');
  openButton.onclick = (e) => {
    try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
    const url = resolveUrl();
    if (!url) return;
    try {
      window.location.assign(url);
    } catch {
      try { window.location.href = url; } catch { /* ignore */ }
    }
    try { afterOpen?.(); } catch { /* ignore */ }
  };
  wireTitlebarBtnHover(openButton);

  // "Open in New Tab"
  const openNewTabButton = doc.createElement('button');
  openNewTabButton.type = 'button';
  openNewTabButton.className = 'kpv2-preview-open-new-tab-btn';
  openNewTabButton.style.cssText = TITLEBAR_BTN_STYLE;
  openNewTabButton.appendChild(createOutlineIcon(doc, [
    { tag: 'rect', attrs: { x: '8', y: '8', width: '13', height: '13', rx: '2' } },
    { tag: 'path', attrs: { d: 'M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3' } }
  ]));
  const openNewTabLabel = doc.createElement('span');
  openNewTabLabel.textContent = 'Open in New Tab';
  openNewTabButton.appendChild(openNewTabLabel);
  openNewTabButton.title = 'Open in new tab';
  openNewTabButton.setAttribute('aria-label', 'Open in new tab');
  openNewTabButton.onclick = (e) => {
    try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
    const url = resolveUrl();
    if (!url) return;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      try { window.open(url, '_blank'); } catch { /* ignore */ }
    }
    try { afterOpenNewTab?.(); } catch { /* ignore */ }
  };
  wireTitlebarBtnHover(openNewTabButton);

  actions.appendChild(openButton);
  actions.appendChild(openNewTabButton);

  return { openButton, openNewTabButton, actions };
}
