/**
 * Floating KeyPilot onboarding walkthrough panel (content-script friendly).
 * Shell + checklist DOM live in onboarding-shared.js (shared with early-inject).
 */
import { Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import {
  ONBOARDING_DEFAULT_TITLE,
  ONBOARDING_PANEL_CLASS,
  ONBOARDING_PANEL_Z_FALLBACK,
  createOnboardingShell,
  ensureOnboardingOverlay,
  queryOnboardingShellRefs,
  renderOnboardingSlideSurface,
  setOnboardingOverlayOpen,
  setOnboardingPanelVisible,
  updateOnboardingChrome
} from './onboarding-shared.js';

function stripListeners(btn) {
  try {
    if (!btn || !btn.parentNode) return btn;
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    return clone;
  } catch {
    return btn;
  }
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
    setOnboardingPanelVisible(this.root, true);
  }

  hide() {
    setOnboardingPanelVisible(this.root, false);
  }

  /**
   * @param {Object} params
   * @param {string} params.title
   * @param {string} [params.bodyText]
   * @param {string} params.slideId
   * @param {number} params.slideIndex
   * @param {number} params.slideCount
   * @param {Array} params.tasks
   * @param {Set<string>} params.completedTaskIds
   * @param {{type:'slide', dir:1|-1}|null} [params.transition]
   * @param {boolean} [params.forceRebuild]
   * @returns {Promise<void>}
   */
  async render({
    title,
    bodyText = '',
    slideId,
    slideIndex,
    slideCount,
    tasks,
    completedTaskIds,
    transition = null,
    forceRebuild = false
  }) {
    if (!this.root || this.root.hidden) return;

    try {
      const targetSurface = this.slideSurface || this.body;
      const refs = {
        root: this.root,
        titleEl: this.titleEl,
        stepEl: this.stepEl,
        prevBtn: this.prevBtn,
        nextBtn: this.nextBtn
      };

      const updateDom = () => {
        updateOnboardingChrome(refs, {
          title: title || ONBOARDING_DEFAULT_TITLE,
          slideId,
          slideIndex,
          slideCount
        });
        renderOnboardingSlideSurface(targetSurface, {
          tasks,
          completedTaskIds,
          bodyText,
          forceRebuild,
          showTip: true
        });
      };

      const doSlide = !!(transition && transition.type === 'slide');
      const dir = doSlide && transition?.dir === -1 ? -1 : 1;

      if (!doSlide) {
        updateDom();
        this._lastRenderedSlideId = String(slideId || '');
        this._lastRenderedSlideIndex = Number(slideIndex) || 0;
        return;
      }

      // Prefer View Transitions API.
      try {
        if (document && typeof document.startViewTransition === 'function' && targetSurface) {
          try { this.root?.style?.setProperty?.('--kp-onboarding-slide-dir', String(dir)); } catch { /* ignore */ }
          try { targetSurface.style.viewTransitionName = 'kp-onboarding-slide-surface'; } catch { /* ignore */ }

          const vt = document.startViewTransition(() => {
            updateDom();
          });
          await Promise.resolve(vt?.finished).catch(() => {});

          try { targetSurface.style.viewTransitionName = ''; } catch { /* ignore */ }
          this._lastRenderedSlideId = String(slideId || '');
          this._lastRenderedSlideIndex = Number(slideIndex) || 0;
          return;
        }
      } catch {
        // fall back
      }

      try {
        targetSurface.style.transform = `translateX(${dir > 0 ? '100%' : '-100%'})`;
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
      try {
        const surface = this.slideSurface || this.body;
        while (surface && surface.firstChild) surface.removeChild(surface.firstChild);
        const msg = document.createElement('div');
        msg.textContent = 'Unable to render onboarding panel on this page.';
        surface?.appendChild(msg);
      } catch {
        // ignore
      }
      console.warn('[KeyPilot] Failed to render onboarding panel:', e);
    }
  }

  showOverlay({ title, message, primaryText = 'OK', secondaryText = '', onPrimary = null, onSecondary = null } = {}) {
    this._ensure();
    if (!this.root || !this._overlayEl) return;

    this._overlayOnPrimary = typeof onPrimary === 'function' ? onPrimary : null;
    this._overlayOnSecondary = typeof onSecondary === 'function' ? onSecondary : null;

    try { this._overlayTitleEl.textContent = String(title || 'Nice!'); } catch { /* ignore */ }
    try { this._overlayMsgEl.textContent = String(message || ''); } catch { /* ignore */ }
    try {
      this._overlayPrimaryBtn.textContent = String(primaryText || 'OK');
      this._overlayPrimaryBtn.hidden = false;
    } catch { /* ignore */ }
    try {
      const showSecondary = !!(secondaryText && String(secondaryText).trim());
      this._overlaySecondaryBtn.textContent = String(secondaryText || '');
      this._overlaySecondaryBtn.hidden = !showSecondary;
    } catch { /* ignore */ }

    setOnboardingOverlayOpen(this._overlayEl, true, this.root);
  }

  hideOverlay() {
    if (!this._overlayEl) return;
    setOnboardingOverlayOpen(this._overlayEl, false, this.root);
    this._overlayOnPrimary = null;
    this._overlayOnSecondary = null;
  }

  _ensure() {
    if (this.root && this.root.isConnected) return;

    // Adopt early-inject shell when present (avoids flicker).
    try {
      const existing = document.querySelector(`.${ONBOARDING_PANEL_CLASS}[data-kp-early-onboarding="true"]`);
      if (existing && existing.isConnected) {
        const refs = queryOnboardingShellRefs(existing);
        if (refs) {
          try {
            existing.style.zIndex = String(Z_INDEX.ONBOARDING_PANEL || ONBOARDING_PANEL_Z_FALLBACK);
          } catch { /* ignore */ }
          applyPopupThemeVars(existing);

          let { closeBtn, prevBtn, nextBtn, resetBtn } = refs;
          closeBtn = stripListeners(closeBtn);
          prevBtn = stripListeners(prevBtn);
          nextBtn = stripListeners(nextBtn);
          resetBtn = stripListeners(resetBtn);

          if (closeBtn) closeBtn.addEventListener('click', this._onCloseClick);
          if (prevBtn) prevBtn.addEventListener('click', this._onPrevClick);
          if (nextBtn) nextBtn.addEventListener('click', this._onNextClick);
          if (resetBtn) resetBtn.addEventListener('click', this._onResetClick);

          this._bindShell({
            root: existing,
            body: refs.body,
            slideSurface: refs.slideSurface,
            titleEl: refs.titleEl,
            stepEl: refs.stepEl,
            closeBtn,
            prevBtn,
            nextBtn,
            resetBtn
          });
          this._ensureOverlay(existing);
          return;
        }
      }
    } catch { /* ignore */ }

    const shell = createOnboardingShell(document, {
      zIndex: Z_INDEX.ONBOARDING_PANEL || ONBOARDING_PANEL_Z_FALLBACK,
      early: false,
      initiallyHidden: true,
      includeViewTransitions: true,
      applyTheme: applyPopupThemeVars,
      navDisabled: false
    });

    shell.prevBtn.addEventListener('click', this._onPrevClick);
    shell.nextBtn.addEventListener('click', this._onNextClick);
    shell.resetBtn.addEventListener('click', this._onResetClick);
    shell.closeBtn.addEventListener('click', this._onCloseClick);

    (document.body || document.documentElement).appendChild(shell.root);
    this._bindShell(shell);
    this._ensureOverlay(shell.root);
  }

  _bindShell(shell) {
    this.root = shell.root;
    this.body = shell.body;
    this.slideSurface = shell.slideSurface;
    this.titleEl = shell.titleEl || null;
    this.stepEl = shell.stepEl || null;
    this.closeBtn = shell.closeBtn || null;
    this.prevBtn = shell.prevBtn || null;
    this.nextBtn = shell.nextBtn || null;
    this.resetBtn = shell.resetBtn || null;
  }

  _ensureOverlay(rootEl) {
    try {
      if (this._overlayEl && this._overlayEl.isConnected) return;

      const bodyHost =
        rootEl?.querySelector?.('[data-kp-onboarding-body="true"]') ||
        rootEl?.querySelector?.(':scope > div[data-kp-onboarding-body]') ||
        null;
      const host = bodyHost || rootEl;
      const overlayRefs = ensureOnboardingOverlay(host);
      if (!overlayRefs) return;

      this._overlayEl = overlayRefs.overlayEl;
      this._overlayTitleEl = overlayRefs.titleEl;
      this._overlayMsgEl = overlayRefs.msgEl;
      this._overlayPrimaryBtn = overlayRefs.primaryBtn;
      this._overlaySecondaryBtn = overlayRefs.secondaryBtn;

      try { this._overlayPrimaryBtn?.removeEventListener?.('click', this._onOverlayPrimary); } catch { /* ignore */ }
      try { this._overlaySecondaryBtn?.removeEventListener?.('click', this._onOverlaySecondary); } catch { /* ignore */ }
      try { this._overlayPrimaryBtn?.addEventListener?.('click', this._onOverlayPrimary); } catch { /* ignore */ }
      try { this._overlaySecondaryBtn?.addEventListener?.('click', this._onOverlaySecondary); } catch { /* ignore */ }

      // Normalize visibility if overlay already existed (hostile pages may override [hidden]).
      try {
        const isHidden = this._overlayEl.hidden === true || this._overlayEl.hasAttribute('hidden');
        setOnboardingOverlayOpen(this._overlayEl, !isHidden, this.root);
      } catch { /* ignore */ }
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
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {
      // ignore
    }
    try {
      if (this._onRequestClose) this._onRequestClose();
    } catch (err) {
      console.warn('[KeyPilot Onboarding] Error in onRequestClose:', err);
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
      const result = this._onRequestReset ? this._onRequestReset() : null;
      if (result && typeof result.then === 'function') {
        result.catch((err) => {
          console.warn('[KeyPilot Onboarding] reset failed:', err);
        });
      }
    } catch (err) {
      console.warn('[KeyPilot Onboarding] reset handler error:', err);
    }
  }
}
