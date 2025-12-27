/**
 * Floating "Welcome to KeyPilot" onboarding panel (content-script friendly).
 * Implemented in light DOM with mostly inline styles so it survives hostile page CSS.
 */
import { Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';

function clearElement(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Convert backtick-wrapped text to <kbd> tags for keyboard key styling
 * @param {string} text
 * @returns {string}
 */
function formatKeyboardKeys(text) {
  return String(text || '').replace(/`([^`]+)`/g, '<kbd>$1</kbd>');
}

export class OnboardingPanel {
  /**
   * @param {Object} params
   * @param {() => void} params.onRequestClose
   * @param {() => void} [params.onRequestPrev]
   * @param {() => void} [params.onRequestNext]
   * @param {() => void} [params.onRequestReset]
   */
  constructor({ onRequestClose, onRequestPrev, onRequestNext, onRequestReset } = {}) {
    this.root = null;
    this.body = null;
    this.slideSurface = null;
    this.titleEl = null;
    this.stepEl = null;
    this.closeBtn = null;
    this.prevBtn = null;
    this.nextBtn = null;
    this.resetBtn = null;
    this._overlayEl = null;
    this._overlayTitleEl = null;
    this._overlayMsgEl = null;
    this._overlayPrimaryBtn = null;
    this._overlaySecondaryBtn = null;
    this._overlayOnPrimary = null;
    this._overlayOnSecondary = null;
    this._lastRenderedSlideId = null;
    this._lastRenderedSlideIndex = null;
    this._onRequestClose = typeof onRequestClose === 'function' ? onRequestClose : null;
    this._onRequestPrev = typeof onRequestPrev === 'function' ? onRequestPrev : null;
    this._onRequestNext = typeof onRequestNext === 'function' ? onRequestNext : null;
    this._onRequestReset = typeof onRequestReset === 'function' ? onRequestReset : null;
    this._onCloseClick = this._onCloseClick.bind(this);
    this._onPrevClick = this._onPrevClick.bind(this);
    this._onNextClick = this._onNextClick.bind(this);
    this._onResetClick = this._onResetClick.bind(this);
    this._onOverlayPrimary = this._onOverlayPrimary.bind(this);
    this._onOverlaySecondary = this._onOverlaySecondary.bind(this);
  }

  isVisible() {
    return !!(this.root && this.root.isConnected && this.root.hidden === false);
  }

  show() {
    if (window !== window.top) return;
    this._ensure();
    this.root.hidden = false;
    // Do not rely on [hidden] alone; some pages override it.
    this.root.style.display = 'flex';
    this.root.style.pointerEvents = 'auto';
  }

  hide() {
    console.log('[KeyPilot Onboarding] hide() called, root:', this.root);
    if (this.root) {
      console.log('[KeyPilot Onboarding] Setting root.hidden = true and display = none');
      this.root.hidden = true;
      // Do not rely on [hidden] alone; some pages override it.
      this.root.style.display = 'none';
      this.root.style.pointerEvents = 'none';
    }
  }

  /**
   * Render the onboarding slide.
   * If `transition.type === 'slide'`, uses a horizontal slide animation.
   *
   * @param {Object} params
   * @param {string} params.title
   * @param {string} params.slideId
   * @param {number} params.slideIndex
   * @param {number} params.slideCount
   * @param {Array} params.tasks
   * @param {Set<string>} params.completedTaskIds
   * @param {{type:'slide', dir:1|-1}|null} [params.transition]
   * @returns {Promise<void>}
   */
  async render({ title, slideId, slideIndex, slideCount, tasks, completedTaskIds, transition = null }) {
    if (!this.root || this.root.hidden) return;

    try {
      const targetSurface = this.slideSurface || this.body;

      const updateDom = () => {
        if (this.titleEl) this.titleEl.textContent = String(title || 'Welcome to KeyPilot');
        const idx = Number(slideIndex) || 0;
        const total = Number(slideCount) || 1;
        if (this.stepEl) this.stepEl.textContent = `${idx + 1} / ${total}`;
        if (this.root) this.root.dataset.kpOnboardingSlideId = String(slideId || '');
        if (this.prevBtn) this.prevBtn.disabled = idx <= 0;
        if (this.nextBtn) this.nextBtn.disabled = idx >= total - 1;

        const completedSet = completedTaskIds instanceof Set ? completedTaskIds : new Set();
        const normalizedTasks = (tasks || []).filter((t) => t && t.id);
        const existingRows = targetSurface.querySelectorAll('[data-kp-onboarding-task-id]');

        // If we adopted an early-inject shell that already rendered rows, update in-place to avoid a visible blink.
        const canUpdateInPlace =
          existingRows.length === normalizedTasks.length &&
          normalizedTasks.every((t, i) => existingRows[i]?.getAttribute('data-kp-onboarding-task-id') === t.id);

        const applyRow = (row, task, done) => {
          if (!row) return;
          try {
            Object.assign(row.style, {
              background: done ? 'rgba(46, 204, 113, 0.10)' : 'rgba(255,255,255,0.04)'
            });
          } catch { /* ignore */ }

          const box =
            row.querySelector(':scope > div[aria-hidden="true"]') ||
            row.firstElementChild;
          const textEl =
            (box && box.nextElementSibling) ||
            row.querySelector(':scope > div:last-child');

          if (box) {
            try {
              Object.assign(box.style, {
                border: done ? '1px solid rgba(46, 204, 113, 0.9)' : '1px solid rgba(255,255,255,0.22)',
                background: done ? 'rgba(46, 204, 113, 0.85)' : 'transparent',
                boxShadow: done ? '0 0 0 2px rgba(46, 204, 113, 0.18)' : 'none'
              });
            } catch { /* ignore */ }

            try {
              // Toggle checkmark child.
              const existingCheck = box.querySelector(':scope > div');
              if (done) {
                if (!existingCheck) {
                  const check = document.createElement('div');
                  check.textContent = '✓';
                  Object.assign(check.style, {
                    position: 'absolute',
                    inset: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: '800',
                    color: '#0b1410'
                  });
                  box.appendChild(check);
                }
              } else if (existingCheck) {
                box.removeChild(existingCheck);
              }
            } catch { /* ignore */ }
          }

          if (textEl) {
            try {
              textEl.innerHTML = formatKeyboardKeys(task.label || task.id);
              Object.assign(textEl.style, {
                color: done ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.88)',
                opacity: done ? '0.95' : '1'
              });
            } catch { /* ignore */ }
          }
        };

        if (canUpdateInPlace) {
          normalizedTasks.forEach((task, i) => {
            const done = completedSet.has(task.id);
            applyRow(existingRows[i], task, done);
          });
          return;
        }

        clearElement(targetSurface);

        const list = document.createElement('div');
        Object.assign(list.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        });

        for (const task of normalizedTasks) {
          if (!task || !task.id) continue;
          const done = completedSet.has(task.id);

          const row = document.createElement('div');
          row.setAttribute('data-kp-onboarding-task-id', task.id);
          Object.assign(row.style, {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.10)',
            background: done ? 'rgba(46, 204, 113, 0.10)' : 'rgba(255,255,255,0.04)'
          });

          const box = document.createElement('div');
          box.setAttribute('aria-hidden', 'true');
          Object.assign(box.style, {
            width: '18px',
            height: '18px',
            borderRadius: '6px',
            border: done ? '1px solid rgba(46, 204, 113, 0.9)' : '1px solid rgba(255,255,255,0.22)',
            background: done ? 'rgba(46, 204, 113, 0.85)' : 'transparent',
            boxShadow: done ? '0 0 0 2px rgba(46, 204, 113, 0.18)' : 'none',
            flex: '0 0 auto',
            marginTop: '1px',
            position: 'relative'
          });

          if (done) {
            const check = document.createElement('div');
            check.textContent = '✓';
            Object.assign(check.style, {
              position: 'absolute',
              inset: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '800',
              color: '#0b1410'
            });
            box.appendChild(check);
          }

          const text = document.createElement('div');
          text.innerHTML = formatKeyboardKeys(task.label || task.id);
          Object.assign(text.style, {
            fontSize: '13px',
            lineHeight: '1.35',
            color: done ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.88)',
            opacity: done ? '0.95' : '1'
          });

          row.appendChild(box);
          row.appendChild(text);
          list.appendChild(row);
        }

        const footer = document.createElement('div');
        Object.assign(footer.style, {
          marginTop: '10px',
          fontSize: '12px',
          opacity: '0.78',
          lineHeight: '1.35',
          color: 'rgba(255,255,255,0.85)'
        });
        footer.textContent = 'Tip: Press Alt + / to re-open this walkthrough later.';

        targetSurface.appendChild(list);
        targetSurface.appendChild(footer);
      };

      const doSlide = !!(transition && transition.type === 'slide');
      const dir = doSlide && transition?.dir === -1 ? -1 : 1;

      // No special animation needed if this is not a slide change.
      if (!doSlide) {
        updateDom();
        this._lastRenderedSlideId = String(slideId || '');
        this._lastRenderedSlideIndex = Number(slideIndex) || 0;
        return;
      }

      // Prefer View Transitions API for smooth, native cross-document animation.
      try {
        if (document && typeof document.startViewTransition === 'function' && targetSurface) {
          try { this.root?.style?.setProperty?.('--kp-onboarding-slide-dir', String(dir)); } catch { /* ignore */ }
          try { targetSurface.style.viewTransitionName = 'kp-onboarding-slide-surface'; } catch { /* ignore */ }

          const vt = document.startViewTransition(() => {
            updateDom();
          });

          // Ensure we always resolve even if the transition fails.
          await Promise.resolve(vt?.finished).catch(() => {});

          try { targetSurface.style.viewTransitionName = ''; } catch { /* ignore */ }
          this._lastRenderedSlideId = String(slideId || '');
          this._lastRenderedSlideIndex = Number(slideIndex) || 0;
          return;
        }
      } catch {
        // fall back
      }

      // Fallback: simple horizontal slide-in of the new content.
      try {
        const start = `translateX(${dir > 0 ? '100%' : '-100%'})`;
        targetSurface.style.transform = start;
        targetSurface.style.opacity = '0.7';
      } catch { /* ignore */ }

      updateDom();

      try {
        const anim = targetSurface.animate([
          { transform: `translateX(${dir > 0 ? '100%' : '-100%'})`, opacity: 0.7 },
          { transform: 'translateX(0%)', opacity: 1 }
        ], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' });
        await Promise.resolve(anim?.finished).catch(() => {});
      } catch { /* ignore */ }

      try {
        targetSurface.style.transform = '';
        targetSurface.style.opacity = '';
      } catch { /* ignore */ }

      this._lastRenderedSlideId = String(slideId || '');
      this._lastRenderedSlideIndex = Number(slideIndex) || 0;
    } catch (e) {
      // Fail gracefully if a page CSP / DOM edge case breaks rendering.
      try {
        clearElement(this.slideSurface || this.body);
        const msg = document.createElement('div');
        msg.textContent = 'Unable to render onboarding panel on this page.';
        (this.slideSurface || this.body).appendChild(msg);
      } catch {
        // ignore
      }
      console.warn('[KeyPilot] Failed to render onboarding panel:', e);
    }
  }

  showOverlay({ title, message, primaryText = 'Got it', secondaryText = '', onPrimary = null, onSecondary = null } = {}) {
    this._ensure();
    if (!this.root) return;
    if (!this._overlayEl) return;

    this._overlayOnPrimary = typeof onPrimary === 'function' ? onPrimary : null;
    this._overlayOnSecondary = typeof onSecondary === 'function' ? onSecondary : null;

    try { this._overlayTitleEl.textContent = String(title || 'Nice!'); } catch { /* ignore */ }
    try { this._overlayMsgEl.textContent = String(message || ''); } catch { /* ignore */ }

    try {
      this._overlayPrimaryBtn.textContent = String(primaryText || 'Got it');
      this._overlayPrimaryBtn.hidden = false;
    } catch { /* ignore */ }

    try {
      const showSecondary = !!(secondaryText && String(secondaryText).trim());
      this._overlaySecondaryBtn.textContent = String(secondaryText || '');
      this._overlaySecondaryBtn.hidden = !showSecondary;
    } catch { /* ignore */ }

    try {
      this._overlayEl.hidden = false;
      // Do not rely on [hidden] alone; some pages override it.
      this._overlayEl.style.display = 'flex';
      this._overlayEl.style.pointerEvents = 'auto';
      this.root.dataset.kpOnboardingOverlayOpen = 'true';
    } catch { /* ignore */ }
  }

  hideOverlay() {
    if (!this._overlayEl) return;
    try {
      this._overlayEl.hidden = true;
      // Do not rely on [hidden] alone; some pages override it.
      this._overlayEl.style.display = 'none';
      this._overlayEl.style.pointerEvents = 'none';
      if (this.root) delete this.root.dataset.kpOnboardingOverlayOpen;
    } catch { /* ignore */ }
    this._overlayOnPrimary = null;
    this._overlayOnSecondary = null;
  }

  _ensure() {
    if (this.root && this.root.isConnected) return;

    // If early-inject created the shell at document_start, adopt it to avoid flicker.
    try {
      const existing = document.querySelector('.kp-onboarding-panel[data-kp-early-onboarding="true"]');
      if (existing && existing.isConnected) {
        const body = existing.querySelector('[data-kp-onboarding-body="true"]') || existing.querySelector(':scope > div[data-kp-onboarding-body]');
        const title = existing.querySelector('[data-kp-onboarding-title="true"]');
        const step = existing.querySelector('[data-kp-onboarding-step="true"]');
        let closeBtn = existing.querySelector('button[data-kp-onboarding-close="true"]');
        let prevBtn = existing.querySelector('button[data-kp-onboarding-prev="true"]');
        let nextBtn = existing.querySelector('button[data-kp-onboarding-next="true"]');
        let resetBtn = existing.querySelector('button[data-kp-onboarding-reset="true"]');

        // Ensure the current z-index matches centralized constants.
        try {
          existing.style.zIndex = String(Z_INDEX.ONBOARDING_PANEL || 2147483045);
        } catch { /* ignore */ }

        applyPopupThemeVars(existing);

        // IMPORTANT: Strip any pre-existing listeners by cloning these buttons.
        // This avoids "double next" if onboarding is initialized twice or early-inject attached handlers.
        const stripListeners = (btn) => {
          try {
            if (!btn || !btn.parentNode) return btn;
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            return clone;
          } catch {
            return btn;
          }
        };

        closeBtn = stripListeners(closeBtn);
        prevBtn = stripListeners(prevBtn);
        nextBtn = stripListeners(nextBtn);
        resetBtn = stripListeners(resetBtn);

        if (closeBtn) closeBtn.addEventListener('click', this._onCloseClick);
        if (prevBtn) prevBtn.addEventListener('click', this._onPrevClick);
        if (nextBtn) nextBtn.addEventListener('click', this._onNextClick);
        if (resetBtn) resetBtn.addEventListener('click', this._onResetClick);

        if (body) {
          // Ensure a stable surface for slide transitions (body may be scrollable).
          let surface = body.querySelector('[data-kp-onboarding-slide-surface="true"]');
          if (!surface) {
            surface = document.createElement('div');
            surface.setAttribute('data-kp-onboarding-slide-surface', 'true');
            Object.assign(surface.style, { padding: '12px' });
            try { body.appendChild(surface); } catch { /* ignore */ }
          }

          // Ensure overlay exists.
          this._ensureOverlay(existing);

          this.root = existing;
          this.body = body;
          this.slideSurface = surface;
          this.titleEl = title || null;
          this.stepEl = step || null;
          this.closeBtn = closeBtn || null;
          this.prevBtn = prevBtn || null;
          this.nextBtn = nextBtn || null;
          this.resetBtn = resetBtn || null;
          return;
        }
      }
    } catch { /* ignore */ }

    const root = document.createElement('div');
    root.className = 'kp-onboarding-panel';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'KeyPilot onboarding walkthrough');

    Object.assign(root.style, {
      position: 'fixed',
      left: '16px',
      top: '16px',
      width: '360px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100vh - 24px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: String(Z_INDEX.ONBOARDING_PANEL || 2147483045),
      background: 'rgba(18, 18, 18, 0.94)',
      color: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '14px',
      boxShadow: '0 12px 34px rgba(0,0,0,0.45)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      pointerEvents: 'auto'
    });

    applyPopupThemeVars(root);

    // Add kbd styling for keyboard keys + View Transitions animation for slide changes
    const style = document.createElement('style');
    style.textContent = `
      .kp-onboarding-panel kbd {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        padding: 1px 6px;
        border: 1px solid #3a3a3a;
        border-bottom-color: #2a2a2a;
        border-radius: 4px;
        background: linear-gradient(180deg, #2b2b2b 0%, #1a1a1a 100%);
        color: #f1f1f1;
      }

      @keyframes kpOnboardingSlideOut {
        to { transform: translateX(calc(var(--kp-onboarding-slide-dir, 1) * -100%)); opacity: 0.0; }
      }
      @keyframes kpOnboardingSlideIn {
        from { transform: translateX(calc(var(--kp-onboarding-slide-dir, 1) * 100%)); opacity: 0.0; }
        to { transform: translateX(0%); opacity: 1.0; }
      }

      ::view-transition-old(kp-onboarding-slide-surface) {
        animation: kpOnboardingSlideOut 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }
      ::view-transition-new(kp-onboarding-slide-surface) {
        animation: kpOnboardingSlideIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }
    `;
    root.appendChild(style);

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      padding: '10px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.10)'
    });

    const titleWrap = document.createElement('div');
    Object.assign(titleWrap.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: '0'
    });

    const title = document.createElement('div');
    title.textContent = 'Welcome to KeyPilot';
    title.setAttribute('data-kp-onboarding-title', 'true');
    Object.assign(title.style, {
      fontSize: '13px',
      fontWeight: '800',
      letterSpacing: '0.2px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    });

    const step = document.createElement('div');
    step.textContent = '1 / 1';
    step.setAttribute('data-kp-onboarding-step', 'true');
    Object.assign(step.style, {
      fontSize: '12px',
      fontWeight: '600',
      opacity: '0.75'
    });

    titleWrap.appendChild(title);
    titleWrap.appendChild(step);

    const navWrap = document.createElement('div');
    Object.assign(navWrap.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      flex: '0 0 auto'
    });

    const stepWrap = document.createElement('div');
    Object.assign(stepWrap.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    });

    const mkIconBtn = (label, dataAttr) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute(dataAttr, 'true');
      Object.assign(b.style, {
        width: '28px',
        height: '28px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.18)',
        background: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.95)',
        cursor: 'pointer',
        fontSize: '14px',
        lineHeight: '26px',
        padding: '0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      });
      return b;
    };

    const prevBtn = mkIconBtn('←', 'data-kp-onboarding-prev');
    prevBtn.setAttribute('aria-label', 'Previous slide');
    prevBtn.addEventListener('click', this._onPrevClick);

    const nextBtn = mkIconBtn('→', 'data-kp-onboarding-next');
    nextBtn.setAttribute('aria-label', 'Next slide');
    nextBtn.addEventListener('click', this._onNextClick);

    stepWrap.appendChild(prevBtn);
    stepWrap.appendChild(step);
    stepWrap.appendChild(nextBtn);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset';
    resetBtn.setAttribute('data-kp-onboarding-reset', 'true');
    Object.assign(resetBtn.style, {
      height: '28px',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.18)',
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.92)',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '700',
      padding: '0 10px',
      lineHeight: '26px'
    });
    resetBtn.addEventListener('click', this._onResetClick);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close onboarding walkthrough');
    closeBtn.setAttribute('data-kp-onboarding-close', 'true');
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

    navWrap.appendChild(closeBtn);

    header.appendChild(titleWrap);
    header.appendChild(navWrap);

    const body = document.createElement('div');
    body.setAttribute('data-kp-onboarding-body', 'true');
    Object.assign(body.style, {
      flex: '1',
      overflowY: 'auto',
      minHeight: '0',
      position: 'relative'
    });

    const slideSurface = document.createElement('div');
    slideSurface.setAttribute('data-kp-onboarding-slide-surface', 'true');
    Object.assign(slideSurface.style, {
      padding: '12px'
    });
    body.appendChild(slideSurface);

    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      padding: '10px 12px',
      borderTop: '1px solid rgba(255,255,255,0.10)'
    });

    footer.appendChild(stepWrap);
    footer.appendChild(resetBtn);

    root.appendChild(header);
    root.appendChild(body);
    root.appendChild(footer);

    (document.body || document.documentElement).appendChild(root);

    this.root = root;
    this.body = body;
    this.slideSurface = slideSurface;
    this.titleEl = title;
    this.stepEl = step;
    this.closeBtn = closeBtn;
    this.prevBtn = prevBtn;
    this.nextBtn = nextBtn;
    this.resetBtn = resetBtn;

    this._ensureOverlay(root);
  }

  _ensureOverlay(rootEl) {
    try {
      if (this._overlayEl && this._overlayEl.isConnected) return;

      // If existing overlay is present, adopt it.
      const existing = rootEl.querySelector('[data-kp-onboarding-overlay="true"]');
      if (existing) {
        this._overlayEl = existing;
        this._overlayTitleEl = existing.querySelector('[data-kp-onboarding-overlay-title="true"]');
        this._overlayMsgEl = existing.querySelector('[data-kp-onboarding-overlay-message="true"]');
        this._overlayPrimaryBtn = existing.querySelector('button[data-kp-onboarding-overlay-primary="true"]');
        this._overlaySecondaryBtn = existing.querySelector('button[data-kp-onboarding-overlay-secondary="true"]');
        try { this._overlayPrimaryBtn?.removeEventListener?.('click', this._onOverlayPrimary); } catch { /* ignore */ }
        try { this._overlaySecondaryBtn?.removeEventListener?.('click', this._onOverlaySecondary); } catch { /* ignore */ }
        try { this._overlayPrimaryBtn?.addEventListener?.('click', this._onOverlayPrimary); } catch { /* ignore */ }
        try { this._overlaySecondaryBtn?.addEventListener?.('click', this._onOverlaySecondary); } catch { /* ignore */ }
        // Normalize visibility in case hostile page CSS breaks [hidden].
        try {
          const isHidden = existing.hidden === true || existing.hasAttribute('hidden');
          existing.style.display = isHidden ? 'none' : 'flex';
          existing.style.pointerEvents = isHidden ? 'none' : 'auto';
        } catch { /* ignore */ }
        return;
      }

      const overlay = document.createElement('div');
      overlay.setAttribute('data-kp-onboarding-overlay', 'true');
      overlay.hidden = true;
      Object.assign(overlay.style, {
        position: 'absolute',
        inset: '0',
        padding: '14px',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: '5',
        pointerEvents: 'none'
      });

      const card = document.createElement('div');
      Object.assign(card.style, {
        width: '100%',
        maxWidth: '320px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(18, 18, 18, 0.78)',
        boxShadow: '0 16px 44px rgba(0,0,0,0.55)',
        padding: '14px 14px 12px 14px'
      });

      const title = document.createElement('div');
      title.setAttribute('data-kp-onboarding-overlay-title', 'true');
      title.textContent = 'Nice!';
      Object.assign(title.style, {
        fontSize: '14px',
        fontWeight: '900',
        letterSpacing: '0.2px',
        marginBottom: '8px'
      });

      const msg = document.createElement('div');
      msg.setAttribute('data-kp-onboarding-overlay-message', 'true');
      msg.textContent = '';
      Object.assign(msg.style, {
        fontSize: '13px',
        lineHeight: '1.35',
        color: 'rgba(255,255,255,0.90)',
        whiteSpace: 'pre-wrap'
      });

      const btnRow = document.createElement('div');
      Object.assign(btnRow.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '12px'
      });

      const mkBtn = (variant) => {
        const b = document.createElement('button');
        b.type = 'button';
        Object.assign(b.style, {
          height: '30px',
          borderRadius: '999px',
          border: variant === 'primary' ? '1px solid rgba(46, 204, 113, 0.55)' : '1px solid rgba(255,255,255,0.20)',
          background: variant === 'primary' ? 'rgba(46, 204, 113, 0.18)' : 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.92)',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '800',
          padding: '0 12px',
          lineHeight: '28px'
        });
        return b;
      };

      const secondary = mkBtn('secondary');
      secondary.hidden = true;
      secondary.textContent = '';
      secondary.setAttribute('data-kp-onboarding-overlay-secondary', 'true');
      secondary.addEventListener('click', this._onOverlaySecondary);

      const primary = mkBtn('primary');
      primary.textContent = 'Got it';
      primary.setAttribute('data-kp-onboarding-overlay-primary', 'true');
      primary.addEventListener('click', this._onOverlayPrimary);

      btnRow.appendChild(secondary);
      btnRow.appendChild(primary);

      card.appendChild(title);
      card.appendChild(msg);
      card.appendChild(btnRow);
      overlay.appendChild(card);

      rootEl.appendChild(overlay);

      this._overlayEl = overlay;
      this._overlayTitleEl = title;
      this._overlayMsgEl = msg;
      this._overlayPrimaryBtn = primary;
      this._overlaySecondaryBtn = secondary;
    } catch {
      // ignore
    }
  }

  _onOverlayPrimary(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    const cb = this._overlayOnPrimary;
    this.hideOverlay();
    try { cb?.(); } catch { /* ignore */ }
  }

  _onOverlaySecondary(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    const cb = this._overlayOnSecondary;
    this.hideOverlay();
    try { cb?.(); } catch { /* ignore */ }
  }

  _onCloseClick(e) {
    console.log('[KeyPilot Onboarding] Close button clicked');
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {
      // ignore
    }
    try {
      console.log('[KeyPilot Onboarding] Calling onRequestClose callback');
      if (this._onRequestClose) this._onRequestClose();
    } catch (err) {
      console.error('[KeyPilot Onboarding] Error in onRequestClose:', err);
    }
  }

  _onPrevClick(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    try {
      if (this._onRequestPrev) this._onRequestPrev();
    } catch { /* ignore */ }
  }

  _onNextClick(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    try {
      if (this._onRequestNext) this._onRequestNext();
    } catch { /* ignore */ }
  }

  _onResetClick(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    try {
      if (this._onRequestReset) this._onRequestReset();
    } catch { /* ignore */ }
  }
}


