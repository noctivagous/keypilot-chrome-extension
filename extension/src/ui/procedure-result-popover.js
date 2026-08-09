/**
 * Generic procedure-result popover for Keyboard Layout Config destinations.
 * Used by AI (and any future Function) that routes output to "popover".
 */
import { Z_INDEX, KP_UI_FONT } from '../config/constants.js';
import { makePanelDraggable } from '../utils/panel-position.js';
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

const STYLE_ATTR = 'data-kp-procedure-result-style';
const ROOT_CLASS = 'kp-procedure-result';

/** @type {HTMLElement|null} */
let _root = null;
/** @type {{ dispose: () => void }|null} */
let _dragApi = null;

function ensureStyles(doc) {
  if (!doc?.head) return;
  let style = doc.head.querySelector(`style[${STYLE_ATTR}]`);
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute(STYLE_ATTR, 'true');
    doc.head.appendChild(style);
  }
  style.textContent = `
.${ROOT_CLASS} {
  position: fixed;
  z-index: ${Z_INDEX.KEY_ACTION_CONFIG || 2147483047};
  width: min(420px, calc(100vw - 24px));
  max-height: min(70vh, 520px);
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
.${ROOT_CLASS}[hidden] { display: none !important; }
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
}
.${ROOT_CLASS}__title {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
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
  white-space: pre-wrap;
  word-break: break-word;
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
`;
}

/**
 * @param {{
 *   title?: string,
 *   text: string,
 *   html?: string|null,
 *   onCopy?: () => Promise<boolean>|boolean
 * }} opts
 */
export function showProcedureResultPopover(opts = {}) {
  const doc = document;
  ensureStyles(doc);

  if (!_root) {
    _root = doc.createElement('div');
    _root.className = ROOT_CLASS;
    _root.setAttribute('role', 'dialog');
    _root.setAttribute('aria-label', 'Procedure result');
    _root.innerHTML = `
      <div class="${ROOT_CLASS}__titlebar" data-kp-result-drag="true">
        <div class="${ROOT_CLASS}__title"></div>
        <button type="button" class="${ROOT_CLASS}__close" aria-label="Close">×</button>
      </div>
      <div class="${ROOT_CLASS}__body"></div>
      <div class="${ROOT_CLASS}__actions">
        <button type="button" class="${ROOT_CLASS}__btn" data-kp-result-copy="true">Copy</button>
        <button type="button" class="${ROOT_CLASS}__btn" data-primary="true" data-kp-result-close="true">Done</button>
      </div>
    `;
    doc.body.appendChild(_root);

    _root.querySelector(`.${ROOT_CLASS}__close`)?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideProcedureResultPopover();
    });
    _root.querySelector('[data-kp-result-close="true"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideProcedureResultPopover();
    });

    const handle = _root.querySelector('[data-kp-result-drag="true"]');
    _dragApi = makePanelDraggable(_root, handle, {
      excludeSelector: `.${ROOT_CLASS}__close`
    });
  }

  const titleEl = _root.querySelector(`.${ROOT_CLASS}__title`);
  if (titleEl) titleEl.textContent = String(opts.title || 'Result');

  const body = _root.querySelector(`.${ROOT_CLASS}__body`);
  if (body) {
    const text = String(opts.text ?? '');
    if (opts.html) {
      body.innerHTML = '';
      // Prefer plain text for safety; html is optional future use.
      body.textContent = text;
    } else {
      body.textContent = text;
    }
  }

  const copyBtn = _root.querySelector('[data-kp-result-copy="true"]');
  if (copyBtn) {
    copyBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      let ok = false;
      try {
        ok = !!(await opts.onCopy?.());
      } catch { ok = false; }
      if (!ok) {
        try {
          await navigator.clipboard.writeText(String(opts.text ?? ''));
          ok = true;
        } catch { /* ignore */ }
      }
      copyBtn.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(() => { try { copyBtn.textContent = 'Copy'; } catch { /* ignore */ } }, 1200);
    };
  }

  _root.hidden = false;
  const margin = 16;
  const vw = window.innerWidth || 800;
  const vh = window.innerHeight || 600;
  const left = Math.max(margin, Math.round(vw * 0.5 - 210));
  const top = Math.max(margin, Math.round(vh * 0.18));
  _root.style.left = `${left}px`;
  _root.style.top = `${top}px`;
  _root.style.right = 'auto';
  _root.style.bottom = 'auto';
}

export function hideProcedureResultPopover() {
  if (_root) _root.hidden = true;
}

export function disposeProcedureResultPopover() {
  try { _dragApi?.dispose?.(); } catch { /* ignore */ }
  _dragApi = null;
  try { _root?.remove?.(); } catch { /* ignore */ }
  _root = null;
}
