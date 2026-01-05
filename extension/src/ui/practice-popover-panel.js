/**
 * PracticePopoverPanel
 * Floating "practice" panel used by onboarding to let users practice text box mode
 * without navigating away from the current page.
 *
 * IMPORTANT: This panel intentionally renders real <input>/<textarea> elements in the
 * top document so focusing them triggers KeyPilot's real text focus mode (so onboarding
 * can detect enter/exit via KeyPilot state).
 */
import { Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';

function clearElement(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export class PracticePopoverPanel {
  /**
   * @param {Object} params
   * @param {() => void} [params.onRequestClose]
   */
  constructor({ onRequestClose } = {}) {
    this.root = null;
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
      const panelW = rect.width || 720;
      const panelH = rect.height || 520;

      const canFitRight = desiredLeft + panelW <= w - margin;

      let left = desiredLeft;
      let top = desiredTop;

      if (!canFitRight) {
        // Place below onboarding instead.
        left = Math.round(ob.left);
        top = Math.round(ob.bottom + gap);
      }

      left = clamp(left, margin, Math.max(margin, w - panelW - margin));
      top = clamp(top, margin, Math.max(margin, h - panelH - margin));

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

    clearElement(this.body);

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
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(10, 12, 18, 0.58)',
        boxShadow: '0 10px 26px rgba(0, 0, 0, 0.35)'
      });
      if (titleText) {
        const t = document.createElement('div');
        t.textContent = titleText;
        Object.assign(t.style, { fontSize: '13px', fontWeight: '800', marginBottom: '8px' });
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
        color: 'rgba(255,255,255,0.88)'
      });
      return el;
    };

    const kbd = (text) => {
      const el = document.createElement('span');
      el.textContent = text;
      Object.assign(el.style, {
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '12px',
        padding: '2px 6px',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderBottomColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '6px',
        background: 'rgba(255, 255, 255, 0.08)',
        color: 'rgba(255, 255, 255, 0.95)'
      });
      return el;
    };

    const intro = card('Text Boxes'); // card('What you’re practicing');
    intro.appendChild(
      p('Click a text box with F to enter text box mode (typing works normally). Press `Esc` to exit text box mode and return to normal browsing.')
    );
    const tip = document.createElement('div');
    Object.assign(tip.style, { marginTop: '8px', fontSize: '12px', opacity: '0.82', lineHeight: '1.45' });
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
      Object.assign(l.style, { display: 'block', fontWeight: '800', fontSize: '12px', margin: '0 0 6px 0' });
      return l;
    };

    const mkInput = (id, placeholder) => {
      const i = document.createElement('input');
      i.id = id;
      i.type = 'text';
      i.placeholder = placeholder;
      Object.assign(i.style, {
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.95)',
        padding: '10px 12px',
        fontSize: '14px',
        outline: 'none'
      });
      i.addEventListener('focus', () => {
        try {
          i.style.borderColor = 'rgba(255, 140, 0, 0.55)';
          i.style.boxShadow = '0 0 0 3px rgba(255, 140, 0, 0.18)';
        } catch {}
      });
      i.addEventListener('blur', () => {
        try {
          i.style.borderColor = 'rgba(255,255,255,0.16)';
          i.style.boxShadow = 'none';
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
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.95)',
        padding: '10px 12px',
        fontSize: '14px',
        outline: 'none',
        minHeight: '120px',
        resize: 'vertical'
      });
      t.addEventListener('focus', () => {
        try {
          t.style.borderColor = 'rgba(255, 140, 0, 0.55)';
          t.style.boxShadow = '0 0 0 3px rgba(255, 140, 0, 0.18)';
        } catch {}
      });
      t.addEventListener('blur', () => {
        try {
          t.style.borderColor = 'rgba(255,255,255,0.16)';
          t.style.boxShadow = 'none';
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
    Object.assign(note.style, { marginTop: '10px', fontSize: '12px', opacity: '0.84', lineHeight: '1.45' });
    note.appendChild(document.createTextNode('When you’re done typing, press '));
    note.appendChild(kbd('Esc'));
    note.appendChild(document.createTextNode(' to exit text box mode.'));
    fields.appendChild(note);

    wrap.appendChild(fields);

    const clickWin = card('Step 2: Practice the “hover + F click” window');
    const descr = document.createElement('div');
    Object.assign(descr.style, { fontSize: '13px', lineHeight: '1.5', color: 'rgba(255,255,255,0.88)' });
    descr.appendChild(document.createTextNode('While still in text mode, hover this link or button and press '));
    descr.appendChild(kbd('F'));
    descr.appendChild(document.createTextNode(' during the short countdown window:'));
    clickWin.appendChild(descr);

    const link = document.createElement('a');
    link.href = '#kp-practice-anchor';
    link.textContent = 'Practice link (jumps in this panel)';
    link.id = 'kp-practice-link';
    Object.assign(link.style, { color: 'rgba(91, 226, 241, 0.95)', textDecoration: 'underline', display: 'inline-block', marginTop: '10px' });
    clickWin.appendChild(link);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Practice button (no navigation)';
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10px 12px',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      background: 'rgba(255, 255, 255, 0.08)',
      color: 'rgba(255, 255, 255, 0.92)',
      cursor: 'pointer',
      fontWeight: '800',
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
    Object.assign(anchor.style, { marginTop: '10px', fontSize: '12px', opacity: '0.84', lineHeight: '1.45' });
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

    Object.assign(root.style, {
      position: 'fixed',
      left: '392px', // will be repositioned next to onboarding
      top: '16px',
      width: '720px', // ~2x onboarding width (360px)
      maxWidth: 'calc(100vw - 24px)',
      height: '520px', // ~2x a typical onboarding panel height
      maxHeight: 'calc(100vh - 24px)',
      overflow: 'auto',
      zIndex: String((Z_INDEX.ONBOARDING_PANEL || 2147483045) - 1),
      background: 'rgba(18, 18, 18, 0.94)',
      color: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '14px',
      boxShadow: '0 12px 34px rgba(0,0,0,0.45)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      pointerEvents: 'auto'
    });

    applyPopupThemeVars(root);

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      padding: '10px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.10)'
    });

    const title = document.createElement('div');
    title.textContent = 'Entering Text';
    Object.assign(title.style, {
      fontSize: '13px',
      fontWeight: '900',
      letterSpacing: '0.2px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Hide practice popover');
    Object.assign(closeBtn.style, {
      width: '30px',
      height: '30px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.18)',
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.95)',
      cursor: 'pointer',
      fontSize: '18px',
      lineHeight: '28px',
      padding: '0',
      flex: '0 0 auto'
    });
    closeBtn.addEventListener('click', this._onCloseClick);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    Object.assign(body.style, { padding: '12px' });

    root.appendChild(header);
    root.appendChild(body);

    (document.body || document.documentElement).appendChild(root);

    this.root = root;
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


