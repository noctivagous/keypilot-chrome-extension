/**
 * PracticePopoverPanel
 * Floating "practice" panel used by onboarding to let users practice text box mode
 * without navigating away from the current page.
 *
 * IMPORTANT: This panel intentionally renders real <input>/<textarea> elements in its
 * open shadow root. KeyPilot's shadow-aware focus detector resolves the deep active
 * element, so focusing them still triggers real text focus mode (and onboarding can
 * detect enter/exit through KeyPilot state).
 */
import { Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import { ONBOARDING_METAL } from './onboarding-shared.js';

const PRACTICE_PANEL_STYLE_ATTR = 'data-kp-practice-popover-style';

function ensurePracticePanelStyles(root) {
  injectChromeStyles(root, { attr: PRACTICE_PANEL_STYLE_ATTR, css: `
:host {
  position: fixed;
  left: 392px;
  top: 16px;
  width: 420px;
  max-width: calc(100vw - 24px);
  height: auto;
  max-height: calc(100vh - 24px);
  overflow: auto;
  z-index: ${String((Z_INDEX.ONBOARDING_PANEL || 2147483045) - 1)};
  background: ${ONBOARDING_METAL.panelBg};
  color: ${ONBOARDING_METAL.fg};
  border: ${ONBOARDING_METAL.panelBorder};
  border-radius: 3px;
  box-shadow: ${ONBOARDING_METAL.panelShadow};
  font-family: Helvetica, Arial, sans-serif;
  pointer-events: auto;
}
:host([hidden]) { display: none !important; }
.kp-practice-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: ${ONBOARDING_METAL.titlebarBg};
  border-bottom: ${ONBOARDING_METAL.titlebarBorder};
  box-shadow: ${ONBOARDING_METAL.titlebarShadow};
}
.kp-practice-popover__title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.2px;
  color: ${ONBOARDING_METAL.fg};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kp-practice-popover__close {
  width: 28px;
  height: 28px;
  border-radius: 2px;
  border: ${ONBOARDING_METAL.btnBorder};
  background: ${ONBOARDING_METAL.btnBg};
  box-shadow: ${ONBOARDING_METAL.btnShadow};
  color: ${ONBOARDING_METAL.fg};
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  line-height: 26px;
  padding: 0;
  flex: 0 0 auto;
}
.kp-practice-popover__body { padding: 12px; }
` });
}

function clearPracticePanelElement(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

function clampPracticePanelValue(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export class PracticePopoverPanel {
  /**
   * @param {Object} params
   * @param {() => void} [params.onRequestClose]
   */
  constructor({ onRequestClose } = {}) {
    this.root = null;
    this.shadowRoot = null;
    this.body = null;
    this._onRequestClose = typeof onRequestClose === 'function' ? onRequestClose : null;
    this._onCloseClick = this._onCloseClick.bind(this);
  }

  isVisible() {
    return !!(this.root && this.root.isConnected && this.root.hidden === false);
  }

  show() {
    if (window !== window.top) return;
    this._ensure();
    this.root.hidden = false;
  }

  hide() {
    if (this.root) this.root.hidden = true;
  }

  /**
   * Position the practice panel directly to the right of the onboarding panel when possible.
   * Falls back to "below" when the viewport is too narrow.
   * @param {HTMLElement|null} onboardingRoot
   */
  positionNextToOnboarding(onboardingRoot) {
    try {
      if (!this.root || !this.root.isConnected) return;
      if (!onboardingRoot || !onboardingRoot.getBoundingClientRect) return;

      const gap = 12;
      const margin = 12;
      const ob = onboardingRoot.getBoundingClientRect();
      const w = window.innerWidth || document.documentElement?.clientWidth || 0;
      const h = window.innerHeight || document.documentElement?.clientHeight || 0;

      const desiredLeft = Math.round(ob.right + gap);
      const desiredTop = Math.round(ob.top);

      // Default size is set in CSS below; read computed width/height for clamping.
      const rect = this.root.getBoundingClientRect();
      const panelW = rect.width || 420;
      const panelH = rect.height || 280;

      const canFitRight = desiredLeft + panelW <= w - margin;

      let left = desiredLeft;
      let top = desiredTop;

      if (!canFitRight) {
        // Place below onboarding instead.
        left = Math.round(ob.left);
        top = Math.round(ob.bottom + gap);
      }

      left = clampPracticePanelValue(left, margin, Math.max(margin, w - panelW - margin));
      top = clampPracticePanelValue(top, margin, Math.max(margin, h - panelH - margin));

      this.root.style.left = `${left}px`;
      this.root.style.top = `${top}px`;
    } catch {
      // ignore
    }
  }

  render() {
    if (!this.root || this.root.hidden) return;
    if (!this.body) return;

    // IMPORTANT: Do NOT clear/rebuild the DOM on every onboarding render.
    // Onboarding re-renders when KeyPilot enters text focus mode; if we rebuilt here we'd
    // remove the currently focused input, causing an immediate blur → exit text mode,
    // which incorrectly completes the "Press Escape to exit text mode" task.
    try {
      const existing = this.body.querySelector('[data-kp-practice-built="true"]');
      if (existing) return;
    } catch {
      // ignore
    }

    clearPracticePanelElement(this.body);

    const wrap = document.createElement('div');
    wrap.dataset.kpPracticeBuilt = 'true';
    Object.assign(wrap.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    });

    const card = (titleText) => {
      const c = document.createElement('div');
      Object.assign(c.style, {
        padding: '12px',
        borderRadius: '3px',
        border: ONBOARDING_METAL.rowBorder,
        background: ONBOARDING_METAL.rowBg,
        boxShadow: '0 1px 0 rgba(255,255,255,0.28) inset'
      });
      if (titleText) {
        const t = document.createElement('div');
        t.textContent = titleText;
        Object.assign(t.style, {
          fontSize: '13px',
          fontWeight: '800',
          marginBottom: '8px',
          color: ONBOARDING_METAL.fg
        });
        c.appendChild(t);
      }
      return c;
    };

    const p = (text) => {
      const el = document.createElement('div');
      el.textContent = text;
      Object.assign(el.style, {
        fontSize: '13px',
        lineHeight: '1.5',
        color: ONBOARDING_METAL.fgDim
      });
      return el;
    };

    const kbd = (text) => {
      const el = document.createElement('span');
      el.textContent = text;
      Object.assign(el.style, {
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '11px',
        fontWeight: '700',
        padding: '2px 7px',
        border: ONBOARDING_METAL.kbdBorder,
        borderRadius: '4px',
        background: ONBOARDING_METAL.kbdBg,
        color: ONBOARDING_METAL.kbdColor,
        boxShadow: ONBOARDING_METAL.kbdShadow
      });
      return el;
    };

    const intro = card('Text Boxes'); // card('What you’re practicing');
    intro.appendChild(
      p('Click a text box with F to enter text box mode (typing works normally). Press `Esc` to exit text box mode and return to normal browsing.')
    );
    const tip = document.createElement('div');
    Object.assign(tip.style, {
      marginTop: '8px',
      fontSize: '12px',
      color: ONBOARDING_METAL.fgMute,
      lineHeight: '1.45'
    });
    tip.appendChild(document.createTextNode('Tip: while in text mode, you can still hover something and press '));
    tip.appendChild(kbd('F'));
    tip.appendChild(document.createTextNode(' during a short countdown window.'));
    intro.appendChild(tip);
//    wrap.appendChild(intro);

    const fields = card('Text Boxes');
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px'
    });

    const mkLabel = (forId, text) => {
      const l = document.createElement('label');
      l.setAttribute('for', forId);
      l.textContent = text;
      Object.assign(l.style, {
        display: 'block',
        fontWeight: '800',
        fontSize: '12px',
        margin: '0 0 6px 0',
        color: ONBOARDING_METAL.fg
      });
      return l;
    };

    const fieldBorder = '1px solid rgba(0,0,0,0.35)';
    const fieldFocusBorder = '1px solid rgba(255, 140, 0, 0.75)';
    const mkInput = (id, placeholder) => {
      const i = document.createElement('input');
      i.id = id;
      i.type = 'text';
      i.placeholder = placeholder;
      Object.assign(i.style, {
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: '2px',
        border: fieldBorder,
        background: 'rgba(255,255,255,0.55)',
        color: ONBOARDING_METAL.fg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
        padding: '8px 10px',
        fontSize: '13px',
        fontFamily: 'Helvetica, Arial, sans-serif',
        outline: 'none'
      });
      i.addEventListener('focus', () => {
        try {
          i.style.border = fieldFocusBorder;
          i.style.boxShadow = '0 0 0 2px rgba(255, 140, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.55)';
        } catch {}
      });
      i.addEventListener('blur', () => {
        try {
          i.style.border = fieldBorder;
          i.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.55)';
        } catch {}
      });
      return i;
    };

    const mkTextarea = (id, placeholder) => {
      const t = document.createElement('textarea');
      t.id = id;
      t.placeholder = placeholder;
      Object.assign(t.style, {
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: '2px',
        border: fieldBorder,
        background: 'rgba(255,255,255,0.55)',
        color: ONBOARDING_METAL.fg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
        padding: '8px 10px',
        fontSize: '13px',
        fontFamily: 'Helvetica, Arial, sans-serif',
        outline: 'none',
        minHeight: '120px',
        resize: 'vertical'
      });
      t.addEventListener('focus', () => {
        try {
          t.style.border = fieldFocusBorder;
          t.style.boxShadow = '0 0 0 2px rgba(255, 140, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.55)';
        } catch {}
      });
      t.addEventListener('blur', () => {
        try {
          t.style.border = fieldBorder;
          t.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.55)';
        } catch {}
      });
      return t;
    };

    const col1 = document.createElement('div');
    col1.appendChild(mkLabel('kp-practice-input-1', 'Practice input'));
    col1.appendChild(mkInput('kp-practice-input-1', 'Click here with F, then type…'));
    const col2 = document.createElement('div');
    col2.appendChild(mkLabel('kp-practice-input-2', 'Second input (optional)'));
    col2.appendChild(mkInput('kp-practice-input-2', 'Try switching between fields…'));
    grid.appendChild(col1);
    grid.appendChild(col2);
    fields.appendChild(grid);

    const taWrap = document.createElement('div');
    Object.assign(taWrap.style, { marginTop: '10px' });
    taWrap.appendChild(mkLabel('kp-practice-textarea', 'Practice textarea'));
    taWrap.appendChild(mkTextarea('kp-practice-textarea', 'Type a few lines here…'));
    fields.appendChild(taWrap);

    const note = document.createElement('div');
    Object.assign(note.style, {
      marginTop: '10px',
      fontSize: '12px',
      color: ONBOARDING_METAL.fgMute,
      lineHeight: '1.45'
    });
    note.appendChild(document.createTextNode('When you’re done typing, press '));
    note.appendChild(kbd('Esc'));
    note.appendChild(document.createTextNode(' to exit text box mode.'));
    fields.appendChild(note);

    wrap.appendChild(fields);

    const clickWin = card('Step 2: Practice the “hover + F click” window');
    const descr = document.createElement('div');
    Object.assign(descr.style, {
      fontSize: '13px',
      lineHeight: '1.5',
      color: ONBOARDING_METAL.fgDim
    });
    descr.appendChild(document.createTextNode('While still in text mode, hover this link or button and press '));
    descr.appendChild(kbd('F'));
    descr.appendChild(document.createTextNode(' during the short countdown window:'));
    clickWin.appendChild(descr);

    const link = document.createElement('a');
    link.href = '#kp-practice-anchor';
    link.textContent = 'Practice link (jumps in this panel)';
    link.id = 'kp-practice-link';
    Object.assign(link.style, {
      color: '#0b5f8a',
      textDecoration: 'underline',
      display: 'inline-block',
      marginTop: '10px',
      fontWeight: '700'
    });
    clickWin.appendChild(link);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Practice button (no navigation)';
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px 12px',
      borderRadius: '2px',
      border: ONBOARDING_METAL.btnBorder,
      background: ONBOARDING_METAL.btnBg,
      boxShadow: ONBOARDING_METAL.btnShadow,
      color: ONBOARDING_METAL.fg,
      cursor: 'pointer',
      fontWeight: '700',
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: '12px',
      marginTop: '10px'
    });
    btn.addEventListener('click', () => {
      try {
        btn.textContent = 'Clicked!';
        setTimeout(() => {
          btn.textContent = 'Practice button (no navigation)';
        }, 900);
      } catch { /* ignore */ }
    });
    clickWin.appendChild(btn);

    const anchor = document.createElement('div');
    anchor.id = 'kp-practice-anchor';
    anchor.textContent = 'Anchor reached. Press Esc to exit text mode if needed.';
    Object.assign(anchor.style, {
      marginTop: '10px',
      fontSize: '12px',
      color: ONBOARDING_METAL.fgMute,
      lineHeight: '1.45'
    });
    clickWin.appendChild(anchor);

    //wrap.appendChild(clickWin);

    this.body.appendChild(wrap);
  }

  _ensure() {
    if (this.root && this.root.isConnected) return;

    const root = document.createElement('div');
    root.className = 'kp-practice-popover';
    root.dataset.kpPracticePopover = 'true';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'KeyPilot practice popover');
    applyPopupThemeVars(root);
    const shadowRoot = ensureOpenChromeShadow(root, { id: 'practice-popover' });
    const panelRoot = shadowRoot || root;
    ensurePracticePanelStyles(panelRoot);

    const header = document.createElement('div');
    header.className = 'kp-practice-popover__header';

    const title = document.createElement('div');
    title.textContent = 'Entering Text';
    title.className = 'kp-practice-popover__title';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Hide practice popover');
    closeBtn.className = 'kp-practice-popover__close';
    closeBtn.addEventListener('click', this._onCloseClick);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'kp-practice-popover__body';

    panelRoot.appendChild(header);
    panelRoot.appendChild(body);

    (document.body || document.documentElement).appendChild(root);

    this.root = root;
    this.shadowRoot = shadowRoot;
    this.body = body;
  }

  _onCloseClick(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    try {
      this.hide();
      if (this._onRequestClose) this._onRequestClose();
    } catch { /* ignore */ }
  }
}


