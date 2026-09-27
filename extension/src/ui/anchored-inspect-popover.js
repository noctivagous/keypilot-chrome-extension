/**
 * Shared anchored inspect popover (Font Info, Lookup Word, and similar).
 */
import { getMessage } from '../utils/i18n.js';
import { Z_INDEX, KP_UI_FONT } from '../config/constants.js';
import { getViewportSize, makePanelDraggable } from '../utils/panel-position.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import { planAnchoredPopoverLayout } from './anchored-popover-layout.js';
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

const STYLE_ATTR = 'data-kp-inspect-style';
export const ANCHORED_INSPECT_ROOT_CLASS = 'kp-inspect';

/** @type {HTMLElement|null} */
let _root = null;
/** @type {{ dispose: () => void }|null} */
let _dragApi = null;
/** @type {(() => void)|null} */
let _onClose = null;
/** @type {string|null} */
let _kind = null;
/** @type {{ top: number, bottom: number, left: number, width: number }|null} */
let _anchorRect = null;
/** @type {ResizeObserver|null} */
let _sizeObserver = null;
let _positioning = false;
let _layoutSig = '';
/** @type {{ width: number, height: number }|null} */
let _naturalSize = null;

function onViewportChange() {
  if (!_root || _root.hidden) return;
  _naturalSize = null;
  _layoutSig = '';
  positionHost();
}

function ensureShellStyles(root) {
  const cls = ANCHORED_INSPECT_ROOT_CLASS;
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
:host([data-kp-inspect-fill="true"]) {
  height: min(70vh, 640px);
  max-height: min(70vh, 640px);
  width: min(520px, calc(100vw - 24px));
}
.${cls}__titlebar {
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
.${cls}__title {
  font-weight: var(--kp-titlebar-title-weight, 600);
  font-size: 12px;
  color: var(--kp-color-fg, inherit);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${cls}__close {
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
.${cls}__body {
  padding: 10px 12px;
  overflow: auto;
  flex: 1 1 auto;
  min-height: 0;
}
:host([data-kp-inspect-fill="true"]) .${cls}__body {
  padding: 0;
  overflow: hidden;
  display: flex;
}
.${cls}__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 12px 10px;
  border-top: 1px solid rgba(0,0,0,0.35);
  flex: 0 0 auto;
}
.${cls}__actions[hidden] { display: none !important; }
.${cls}__btn {
  appearance: none;
  border: ${NCT_DARK_UI_BTN_BORDER};
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  color: ${NCT_DARK_UI_COLORS.fg};
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  padding: 5px 10px;
  font: inherit;
  cursor: pointer;
}
.${cls}__btn:hover {
  background: ${NCT_DARK_UI_HOVER_TINT};
}
.${cls}__btn[data-primary="true"] {
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  color: #e8f0f8;
}
.${cls}__btn:disabled {
  opacity: 0.45;
  cursor: default;
}
` });
}

function ensureShell() {
  const doc = document;
  if (_root) return _root;
  const cls = ANCHORED_INSPECT_ROOT_CLASS;
  _root = doc.createElement('div');
  _root.className = cls;
  _root.setAttribute('role', 'dialog');
  const shadowRoot = ensureOpenChromeShadow(_root, { id: 'inspect', chromeWindow: true });
  const panelRoot = shadowRoot || _root;
  ensureShellStyles(panelRoot);
  panelRoot.innerHTML = `
    <div class="${cls}__titlebar" data-kp-inspect-drag="true">
      <div class="${cls}__title"></div>
      <button type="button" class="${cls}__close" aria-label="">×</button>
    </div>
    <div class="${cls}__body"></div>
    <div class="${cls}__actions" hidden></div>
  `;
  const closeBtn = panelRoot.querySelector(`.${cls}__close`);
  if (closeBtn) closeBtn.setAttribute('aria-label', getMessage('overlay_close'));
  doc.body.appendChild(_root);

  panelRoot.querySelector(`.${cls}__close`)?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideAnchoredInspectPopover();
  });

  const handle = panelRoot.querySelector('[data-kp-inspect-drag="true"]');
  _dragApi = makePanelDraggable(_root, handle, {
    excludeSelector: `.${cls}__close`
  });
  try {
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
  } catch { /* ignore */ }
  return _root;
}

/**
 * @param {any} raw
 * @returns {{ top: number, bottom: number, left: number, width: number }|null}
 */
function normalizeAnchorRect(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const top = Number(raw.top ?? raw.targetTop);
  const left = Number(raw.left);
  const width = Number(raw.width);
  const bottom = Number(raw.bottom ?? raw.targetBottom);
  if (!Number.isFinite(top) || !Number.isFinite(left)) return null;
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  const b = Number.isFinite(bottom) ? bottom : top;
  return { top, bottom: b, left, width: w };
}

function watchHostSize() {
  if (!_root || typeof ResizeObserver === 'undefined') return;
  if (!_sizeObserver) {
    _sizeObserver = new ResizeObserver(() => {
      if (!_root || _root.hidden) return;
      positionHost();
    });
  }
  try { _sizeObserver.observe(_root); } catch { /* ignore */ }
}

function positionHost(nextAnchor = undefined) {
  if (!_root || _positioning) return;
  if (nextAnchor !== undefined) _anchorRect = normalizeAnchorRect(nextAnchor);
  const target = _anchorRect;
  const margin = 10;
  const gap = 10;
  _positioning = true;
  try {
    const vp = getViewportSize();
    if (!_naturalSize) {
      _root.style.height = '';
      _root.style.maxHeight = '';
      _naturalSize = {
        width: _root.offsetWidth || _root.getBoundingClientRect().width || 440,
        height: _root.offsetHeight || _root.getBoundingClientRect().height || 280
      };
    }
    const popW = _naturalSize.width;
    const popH = _naturalSize.height;
    if (target) {
      const plan = planAnchoredPopoverLayout({
        targetTop: target.top,
        targetBottom: target.bottom,
        targetCenterX: target.left + target.width / 2,
        popW,
        popH,
        overflowH: popH,
        vw: vp.width,
        vh: vp.height,
        margin,
        gap,
        minOverflow: 160
      });
      const sig = `${plan.placement}|${Math.round(plan.left)}|${Math.round(plan.top)}|${Math.round(plan.usedH)}`;
      if (_layoutSig !== sig) {
        if (plan.overflowMaxHeight != null) {
          _root.style.height = `${Math.round(plan.usedH)}px`;
          _root.style.maxHeight = `${Math.round(plan.usedH)}px`;
        } else {
          _root.style.height = '';
          _root.style.maxHeight = '';
        }
        _root.style.left = `${Math.round(plan.left)}px`;
        _root.style.top = `${Math.round(plan.top)}px`;
        _root.style.right = 'auto';
        _root.style.bottom = 'auto';
        _root.setAttribute('data-placement', plan.placement);
        _layoutSig = sig;
      }
      return;
    }

    const left = Math.max(margin, Math.round((vp.width - popW) / 2));
    const top = Math.max(margin, Math.round(vp.height * 0.18));
    _root.style.left = `${left}px`;
    _root.style.top = `${top}px`;
    _root.style.right = 'auto';
    _root.style.bottom = 'auto';
  } finally {
    _positioning = false;
  }
}

/**
 * @param {{
 *   title: string,
 *   ariaLabel?: string,
 *   kind?: string,
 *   anchor?: { left?: number, top?: number, bottom?: number, width?: number }|null,
 *   fill?: boolean,
 *   extraStyleAttr?: string,
 *   extraCss?: string,
 *   onClose?: (() => void)|null,
 *   renderBody: (body: HTMLElement, doc: Document) => void,
 *   renderActions?: (actions: HTMLElement, doc: Document, btnClass: string) => void,
 * }} opts
 */
export function showAnchoredInspectPopover(opts = {}) {
  const prevClose = _onClose;
  _onClose = null;
  // A content refresh for the same panel must not act like a close: Lookup
  // Word replaces its loading state with parsed HTML asynchronously.
  if (_kind && _kind !== opts.kind) {
    try { prevClose?.(); } catch { /* ignore */ }
  }

  ensureShell();
  const cls = ANCHORED_INSPECT_ROOT_CLASS;
  const panelRoot = _root.shadowRoot || _root;
  ensureShellStyles(panelRoot);
  if (opts.extraStyleAttr && opts.extraCss) {
    injectChromeStyles(panelRoot, { attr: opts.extraStyleAttr, css: opts.extraCss });
  }

  _root.setAttribute('aria-label', String(opts.ariaLabel || opts.title || ''));
  if (opts.fill) _root.setAttribute('data-kp-inspect-fill', 'true');
  else _root.removeAttribute('data-kp-inspect-fill');

  const titleEl = panelRoot.querySelector(`.${cls}__title`);
  if (titleEl) titleEl.textContent = String(opts.title || '');

  const body = panelRoot.querySelector(`.${cls}__body`);
  if (body) {
    body.replaceChildren();
    body.removeAttribute('style');
    try { opts.renderBody?.(body, document); } catch { /* ignore */ }
  }

  const actions = panelRoot.querySelector(`.${cls}__actions`);
  if (actions) {
    actions.replaceChildren();
    if (typeof opts.renderActions === 'function') {
      actions.hidden = false;
      try { opts.renderActions(actions, document, `${cls}__btn`); } catch { /* ignore */ }
    } else {
      actions.hidden = true;
    }
  }

  _kind = typeof opts.kind === 'string' && opts.kind.trim() ? opts.kind.trim() : null;
  _layoutSig = '';
  _naturalSize = null;
  _root.style.height = '';
  _root.style.maxHeight = '';
  _onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
  _root.hidden = false;
  positionHost(opts.anchor || null);
  watchHostSize();
}

export function hideAnchoredInspectPopover() {
  if (_root) _root.hidden = true;
  _kind = null;
  _anchorRect = null;
  _layoutSig = '';
  _naturalSize = null;
  try { _sizeObserver?.unobserve?.(_root); } catch { /* ignore */ }
  const cb = _onClose;
  _onClose = null;
  try { cb?.(); } catch { /* ignore */ }
}

export function isAnchoredInspectPopoverOpen() {
  return !!(_root && !_root.hidden);
}

export function getAnchoredInspectPopoverKind() {
  return isAnchoredInspectPopoverOpen() ? _kind : null;
}

export function disposeAnchoredInspectPopover() {
  try { _dragApi?.dispose?.(); } catch { /* ignore */ }
  _dragApi = null;
  _onClose = null;
  _kind = null;
  _anchorRect = null;
  _layoutSig = '';
  _naturalSize = null;
  try { _sizeObserver?.disconnect?.(); } catch { /* ignore */ }
  _sizeObserver = null;
  try {
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange, true);
  } catch { /* ignore */ }
  try { _root?.remove?.(); } catch { /* ignore */ }
  _root = null;
}

export function createInspectActionButton(doc, { label, primary = false, className } = {}) {
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = className || `${ANCHORED_INSPECT_ROOT_CLASS}__btn`;
  if (primary) btn.dataset.primary = 'true';
  btn.textContent = label || '';
  return btn;
}
