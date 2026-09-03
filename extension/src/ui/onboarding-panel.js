/**
 * Floating KeyPilot onboarding walkthrough panel (content-script friendly).
 * Shell + checklist DOM live in onboarding-shared.js (shared with early-inject).
 */
import { COLORS, CSS_CLASSES, Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import {
  ONBOARDING_DEFAULT_TITLE,
  ONBOARDING_METAL,
  ONBOARDING_PANEL_CLASS,
  ONBOARDING_PANEL_Z_FALLBACK,
  createOnboardingShell,
  ensureOnboardingOverlay,
  queryOnboardingShellRefs,
  renderKeyboardKeysInto,
  renderOnboardingSlideSurface,
  setOnboardingOverlayOpen,
  setOnboardingPanelVisible,
  updateOnboardingChrome
} from './onboarding-shared.js';

/** Mid metal fill for the tip arrow so it matches the onboarding panel bevel. */
const REENABLE_TIP_ARROW_TOP = '#9a9a9a';
const REENABLE_TIP_ARROW_BOTTOM = '#707070';

const TOGGLE_OFF_ARROW_STYLE_ID = 'kp-onboarding-toggle-off-arrow-style-v3';
const TOGGLE_OFF_ARROW_SCALE = 1.5;
/** Extra left nudge from the default “just past segment edge” placement (px). */
const TOGGLE_OFF_ARROW_LEFT_NUDGE_PX = 5;

/**
 * The Control Strip is shadowed, but onboarding callouts must target the
 * ON/OFF segment rather than the light host's full width.
 * @returns {HTMLElement|null}
 */
function getControlStripStatusAnchor() {
  try {
    const strip = document.querySelector('.kp-control-strip, [data-kp-control-strip="true"]');
    const status = strip?.shadowRoot?.querySelector?.('[data-kp-control-strip-status="true"]');
    return status || strip || null;
  } catch {
    return null;
  }
}

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

/**
 * Resolve the non-text click-focus accent used for hover chrome.
 * @returns {string}
 */
function resolveClickFocusColor() {
  try {
    const kp = window.__KeyPilotInstance;
    const focusColor = kp?._settings?.clickMode?.focusColor;
    // Match non-text focus overlay accents (overlay-manager palette).
    if (focusColor === 'green') {
      return 'rgba(0,180,0,0.95)';
    }
  } catch { /* ignore */ }
  return COLORS.FOCUS_BLUE || 'rgba(33,150,243,0.95)';
}

/**
 * Soft outer glow tint derived from the solid focus accent.
 * @param {string} accent
 * @returns {string}
 */
function resolveClickFocusGlow(accent) {
  const c = String(accent || '');
  if (c.includes('0,180,0') || c.includes('0, 180, 0') || /green/i.test(c)) {
    return 'rgba(80,255,120,0.95)';
  }
  // Default / blue focus
  return 'rgba(120,210,255,0.95)';
}

function ensureToggleOffArrowStyles(root) {
  try {
    if (!root) return;
    injectChromeStyles(root, {
      attr: TOGGLE_OFF_ARROW_STYLE_ID,
      css: `
@keyframes kp-onboarding-toggle-off-arrow-osc {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(6px); }
}
@keyframes kp-onboarding-toggle-off-arrow-glow {
  0%, 100% {
    filter:
      drop-shadow(0 0 2px #fff)
      drop-shadow(0 0 6px var(--kp-arrow-accent, currentColor))
      drop-shadow(0 0 14px var(--kp-arrow-glow, currentColor))
      drop-shadow(0 0 22px var(--kp-arrow-glow, currentColor))
      drop-shadow(0 1px 2px rgba(0,0,0,0.45));
  }
  50% {
    filter:
      drop-shadow(0 0 3px #fff)
      drop-shadow(0 0 10px var(--kp-arrow-accent, currentColor))
      drop-shadow(0 0 20px var(--kp-arrow-glow, currentColor))
      drop-shadow(0 0 32px var(--kp-arrow-glow, currentColor))
      drop-shadow(0 1px 2px rgba(0,0,0,0.45));
  }
}
:host {
  animation:
    kp-onboarding-toggle-off-arrow-osc 1.15s ease-in-out infinite,
    kp-onboarding-toggle-off-arrow-glow 1.5s ease-in-out infinite;
  will-change: transform, filter;
}
:host svg {
  display: block;
  overflow: visible;
}
`
    });
  } catch { /* ignore */ }
}

/**
 * Apply accent + glow CSS vars on the arrow host.
 * @param {HTMLElement} el
 * @param {string} accent
 */
function applyToggleOffArrowColor(el, accent) {
  if (!el) return;
  const color = String(accent || resolveClickFocusColor());
  const glow = resolveClickFocusGlow(color);
  try {
    el.style.color = color;
    el.style.fill = color;
    el.style.setProperty('--kp-arrow-accent', color);
    el.style.setProperty('--kp-arrow-glow', glow);
  } catch { /* ignore */ }
}

/**
 * First incomplete task in checklist order.
 * @param {Array<{id?: string}>|null|undefined} tasks
 * @param {Set<string>|string[]|null|undefined} completedTaskIds
 * @returns {string}
 */
function nextIncompleteTaskId(tasks, completedTaskIds) {
  const done = completedTaskIds instanceof Set
    ? completedTaskIds
    : new Set(Array.isArray(completedTaskIds) ? completedTaskIds.map(String) : []);
  for (const task of tasks || []) {
    const id = String(task?.id || '');
    if (id && !done.has(id)) return id;
  }
  return '';
}

/**
 * The Keyboard Reference hover step needs the window visible with keycaps shown.
 * Retries once after layout so a reopen is not lost to Keyboard Reference's
 * async position/collapse hydrate.
 */
function ensureKeyboardReferenceOpenAndExpanded() {
  const apply = () => {
    try {
      const kp = window.__KeyPilotInstance;
      if (!kp) return false;
      if (typeof kp.applyKeyboardHelpVisibility === 'function') {
        kp.applyKeyboardHelpVisibility(true, { persist: true });
      }
      try {
        kp.floatingKeyboardHelp?.setCollapsed?.(false, { persist: true });
      } catch { /* ignore */ }
      return true;
    } catch {
      return false;
    }
  };
  apply();
  try {
    requestAnimationFrame(() => {
      apply();
      try { window.setTimeout(apply, 0); } catch { /* ignore */ }
    });
  } catch {
    try { window.setTimeout(apply, 0); } catch { /* ignore */ }
  }
}

export class OnboardingPanel {
  /**
   * @param {Object} params
   * @param {() => void} params.onRequestClose
   * @param {() => void} [params.onRequestPrev]
   * @param {() => void} [params.onRequestNext]
   * @param {() => void} [params.onRequestReset]
   * @param {(taskId: string) => void} [params.onRequestUncheckTask]
   */
  constructor({ onRequestClose, onRequestPrev, onRequestNext, onRequestReset, onRequestUncheckTask } = {}) {
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
    /** True while the modal overlay (e.g. welcome) is open and not yet accepted. */
    this._overlayOpen = false;
    this._lastRenderedSlideId = null;
    this._lastRenderedSlideIndex = null;
    /** True while the next incomplete task is hovering a Keyboard Reference key. */
    this._keyboardKeyInfoStepActive = false;
    this._onRequestClose = typeof onRequestClose === 'function' ? onRequestClose : null;
    this._onRequestPrev = typeof onRequestPrev === 'function' ? onRequestPrev : null;
    this._onRequestNext = typeof onRequestNext === 'function' ? onRequestNext : null;
    this._onRequestReset = typeof onRequestReset === 'function' ? onRequestReset : null;
    this._onRequestUncheckTask = typeof onRequestUncheckTask === 'function' ? onRequestUncheckTask : null;
    this._onCloseClick = this._onCloseClick.bind(this);
    this._onPrevClick = this._onPrevClick.bind(this);
    this._onNextClick = this._onNextClick.bind(this);
    this._onResetClick = this._onResetClick.bind(this);
    this._onOverlayPrimary = this._onOverlayPrimary.bind(this);
    this._onOverlaySecondary = this._onOverlaySecondary.bind(this);
    this._onTaskRowClick = this._onTaskRowClick.bind(this);

    // Tip bubble under the control-strip On/Off segment (shown while KP is off
    // after the walkthrough "turn off" step).
    this._reEnableTipEl = null;
    this._reEnableTipArrow = null;
    this._reEnableTipMsg = null;
    this._onReEnableTipOutside = this._onReEnableTipOutside.bind(this);
    this._onReEnableTipResize = this._onReEnableTipResize.bind(this);
    this._reEnableTipAnchor = null;

    // Large focus-colored arrow pointing at the control strip while the
    // "turn KeyPilot completely off" task is the next incomplete step.
    this._toggleOffArrowEl = null;
    this._toggleOffArrowAnchor = null;
    this._toggleOffArrowRaf = 0;
    this._onToggleOffArrowReposition = this._onToggleOffArrowReposition.bind(this);
  }

  /**
   * Open + expand Keyboard Reference for the hover-key onboarding task.
   */
  ensureKeyboardReferenceOpenAndExpanded() {
    this._keyboardKeyInfoStepActive = true;
    ensureKeyboardReferenceOpenAndExpanded();
  }

  isVisible() {
    return !!(this.root && this.root.isConnected && this.root.hidden === false);
  }

  /**
   * Whether the modal slide overlay is currently open (user has not accepted it yet).
   * While true, checklist tasks must not be checked off.
   * @returns {boolean}
   */
  isOverlayOpen() {
    if (this._overlayOpen) return true;
    try {
      if (this.root?.dataset?.kpOnboardingOverlayOpen === 'true') return true;
      if (this._overlayEl && this._overlayEl.hidden === false && this._overlayEl.style?.display !== 'none') {
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  show() {
    if (window !== window.top) return;
    this._ensure();
    setOnboardingPanelVisible(this.root, true);
    // Close + reopen (Alt+I / ✕) calls show() even when render bails as still-hidden.
    if (this._keyboardKeyInfoStepActive) {
      ensureKeyboardReferenceOpenAndExpanded();
    }
  }

  hide() {
    this.hideToggleOffArrow();
    setOnboardingPanelVisible(this.root, false);
  }

  /**
   * Small speech-bubble under the control strip status control.
   * Click outside dismisses it (interrupted); status click is ignored as outside.
   *
   * @param {Object} [opts]
   * @param {Element|null} [opts.anchorEl]
   * @param {string} [opts.message]
   */
  showReEnableTip({
    anchorEl = null,
    message = 'Click the control strip again to turn KeyPilot back on.'
  } = {}) {
    if (window !== window.top) return;
    this.hideReEnableTip();

    const anchor =
      anchorEl ||
      getControlStripStatusAnchor();
    if (!anchor || !anchor.isConnected) return;

    const tip = document.createElement('div');
    tip.setAttribute('data-kp-onboarding-reenable-tip', 'true');
    tip.setAttribute('role', 'status');
    const tipMount = ensureOpenChromeShadow(tip, { id: 'onboarding-reenable-tip' }) || tip;
    Object.assign(tip.style, {
      position: 'fixed',
      zIndex: String((Z_INDEX.ONBOARDING_PANEL || ONBOARDING_PANEL_Z_FALLBACK) + 2),
      maxWidth: '260px',
      padding: '10px 12px',
      borderRadius: '3px',
      border: ONBOARDING_METAL.panelBorder,
      background: ONBOARDING_METAL.panelBg,
      color: ONBOARDING_METAL.fg,
      boxShadow: ONBOARDING_METAL.panelShadow,
      fontFamily: 'Helvetica, Arial, sans-serif',
      fontSize: '13px',
      fontWeight: '600',
      lineHeight: '1.35',
      pointerEvents: 'auto'
    });

    const arrow = document.createElement('div');
    arrow.setAttribute('data-kp-onboarding-reenable-tip-arrow', 'true');
    Object.assign(arrow.style, {
      position: 'absolute',
      width: '0',
      height: '0',
      borderLeft: '8px solid transparent',
      borderRight: '8px solid transparent',
      borderBottom: `8px solid ${REENABLE_TIP_ARROW_TOP}`,
      top: '-8px',
      left: '20px',
      filter: 'drop-shadow(0 -1px 0 rgba(42,52,62,0.92))'
    });

    const msg = document.createElement('div');
    msg.textContent = String(message || '');
    tipMount.appendChild(arrow);
    tipMount.appendChild(msg);

    try { applyPopupThemeVars(tip); } catch { /* ignore */ }

    (document.body || document.documentElement).appendChild(tip);
    this._reEnableTipEl = tip;
    this._reEnableTipArrow = arrow;
    this._reEnableTipMsg = msg;
    this._reEnableTipAnchor = anchor;

    this._positionReEnableTip();

    // Outside click: capture phase so we see it before other handlers; skip tip + status btn.
    try {
      document.addEventListener('pointerdown', this._onReEnableTipOutside, true);
      window.addEventListener('resize', this._onReEnableTipResize, true);
      window.addEventListener('scroll', this._onReEnableTipResize, true);
    } catch { /* ignore */ }
  }

  hideReEnableTip() {
    try {
      document.removeEventListener('pointerdown', this._onReEnableTipOutside, true);
      window.removeEventListener('resize', this._onReEnableTipResize, true);
      window.removeEventListener('scroll', this._onReEnableTipResize, true);
    } catch { /* ignore */ }
    try {
      if (this._reEnableTipEl && this._reEnableTipEl.parentNode) {
        this._reEnableTipEl.parentNode.removeChild(this._reEnableTipEl);
      }
    } catch { /* ignore */ }
    this._reEnableTipEl = null;
    this._reEnableTipArrow = null;
    this._reEnableTipMsg = null;
    this._reEnableTipAnchor = null;
  }

  isReEnableTipVisible() {
    return !!(this._reEnableTipEl && this._reEnableTipEl.isConnected);
  }

  _positionReEnableTip() {
    const tip = this._reEnableTipEl;
    const anchor = this._reEnableTipAnchor;
    if (!tip || !anchor || !anchor.isConnected) return;
    try {
      const rect = anchor.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const gap = 10;
      let left = Math.round(rect.left + rect.width / 2 - Math.min(tipRect.width, 260) / 2);
      left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
      let top = Math.round(rect.bottom + gap);
      // Prefer below the strip; if off-screen, flip above.
      if (top + tipRect.height > window.innerHeight - 8) {
        top = Math.max(8, Math.round(rect.top - tipRect.height - gap));
        if (this._reEnableTipArrow) {
          Object.assign(this._reEnableTipArrow.style, {
            top: 'auto',
            bottom: '-8px',
            borderBottom: 'none',
            borderTop: `8px solid ${REENABLE_TIP_ARROW_BOTTOM}`,
            filter: 'drop-shadow(0 1px 0 rgba(42,52,62,0.92))'
          });
        }
      } else if (this._reEnableTipArrow) {
        Object.assign(this._reEnableTipArrow.style, {
          top: '-8px',
          bottom: 'auto',
          borderTop: 'none',
          borderBottom: `8px solid ${REENABLE_TIP_ARROW_TOP}`,
          filter: 'drop-shadow(0 -1px 0 rgba(42,52,62,0.92))'
        });
      }
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;

      // Point the arrow toward the anchor center.
      if (this._reEnableTipArrow) {
        const arrowLeft = Math.round(rect.left + rect.width / 2 - left - 8);
        this._reEnableTipArrow.style.left = `${Math.max(12, Math.min(arrowLeft, tipRect.width - 24))}px`;
      }
    } catch { /* ignore */ }
  }

  _onReEnableTipOutside(e) {
    try {
      const t = e?.target;
      if (!t || !this._reEnableTipEl) return;
      if (this._reEnableTipEl.contains(t)) return;
      // Clicks on the status control are intentional (toggle back on) — keep tip until ON.
      if (typeof t.closest === 'function') {
        if (t.closest('[data-kp-control-strip-status="true"]')) return;
        if (t.closest('[data-kp-onboarding-reenable-tip="true"]')) return;
      }
      this.hideReEnableTip();
    } catch { /* ignore */ }
  }

  _onReEnableTipResize() {
    this._positionReEnableTip();
  }

  /**
   * Large arrow to the right of the control strip (points left at the strip’s
   * right edge). Only for the toggle-off onboarding step; call hide when the
   * step completes or changes.
   *
   * @param {Object} [opts]
   * @param {Element|null} [opts.anchorEl] ON/OFF segment (preferred) or strip root
   * @param {string} [opts.color] CSS color; defaults to click-focus accent
   */
  showToggleOffArrow({ anchorEl = null, color = '' } = {}) {
    if (window !== window.top) return;

    const anchor =
      anchorEl ||
      getControlStripStatusAnchor();
    if (!anchor || !anchor.isConnected) {
      this.hideToggleOffArrow();
      return;
    }

    // Already showing for the same anchor — refresh color/position only.
    if (this._toggleOffArrowEl && this._toggleOffArrowEl.isConnected && this._toggleOffArrowAnchor === anchor) {
      applyToggleOffArrowColor(this._toggleOffArrowEl, color || resolveClickFocusColor());
      this._positionToggleOffArrow();
      return;
    }

    this.hideToggleOffArrow();
    const accent = String(color || resolveClickFocusColor());
    const el = document.createElement('div');
    el.setAttribute('data-kp-onboarding-toggle-off-arrow', 'true');
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: String((Z_INDEX.ONBOARDING_PANEL || ONBOARDING_PANEL_Z_FALLBACK) + 3),
      width: '28px',
      height: '28px',
      margin: '0',
      padding: '0',
      pointerEvents: 'none',
      lineHeight: '0'
    });
    applyToggleOffArrowColor(el, accent);
    const arrowMount = ensureOpenChromeShadow(el, { id: 'onboarding-toggle-off-arrow' }) || el;
    ensureToggleOffArrowStyles(arrowMount);

    // Left-pointing solid arrow (currentColor = click-focus accent). Glow via CSS filter.
    arrowMount.innerHTML =
      '<svg viewBox="0 0 32 28" width="100%" height="100%" focusable="false" aria-hidden="true">' +
      '<path d="M14 2 L2 14 L14 26 L14 19 L30 19 L30 9 L14 9 Z" fill="currentColor"/>' +
      '</svg>';

    (document.body || document.documentElement).appendChild(el);
    this._toggleOffArrowEl = el;
    this._toggleOffArrowAnchor = anchor;
    this._positionToggleOffArrow();
    this._bindToggleOffArrowWatch();
  }

  hideToggleOffArrow() {
    this._unbindToggleOffArrowWatch();
    try {
      if (this._toggleOffArrowEl && this._toggleOffArrowEl.parentNode) {
        this._toggleOffArrowEl.parentNode.removeChild(this._toggleOffArrowEl);
      }
    } catch { /* ignore */ }
    this._toggleOffArrowEl = null;
    this._toggleOffArrowAnchor = null;
  }

  isToggleOffArrowVisible() {
    return !!(this._toggleOffArrowEl && this._toggleOffArrowEl.isConnected);
  }

  _bindToggleOffArrowWatch() {
    this._unbindToggleOffArrowWatch();
    try {
      window.addEventListener('resize', this._onToggleOffArrowReposition, true);
      window.addEventListener('scroll', this._onToggleOffArrowReposition, true);
    } catch { /* ignore */ }
    // Strip can be dragged/collapsed without firing window resize — keep aligned.
    const tick = () => {
      this._positionToggleOffArrow();
      if (this._toggleOffArrowEl && this._toggleOffArrowEl.isConnected) {
        this._toggleOffArrowRaf = window.requestAnimationFrame(tick);
      } else {
        this._toggleOffArrowRaf = 0;
      }
    };
    try {
      this._toggleOffArrowRaf = window.requestAnimationFrame(tick);
    } catch {
      this._toggleOffArrowRaf = 0;
    }
  }

  _unbindToggleOffArrowWatch() {
    try {
      window.removeEventListener('resize', this._onToggleOffArrowReposition, true);
      window.removeEventListener('scroll', this._onToggleOffArrowReposition, true);
    } catch { /* ignore */ }
    if (this._toggleOffArrowRaf) {
      try { window.cancelAnimationFrame(this._toggleOffArrowRaf); } catch { /* ignore */ }
      this._toggleOffArrowRaf = 0;
    }
  }

  _onToggleOffArrowReposition() {
    this._positionToggleOffArrow();
  }

  _positionToggleOffArrow() {
    const el = this._toggleOffArrowEl;
    const anchor = this._toggleOffArrowAnchor;
    if (!el || !anchor || !anchor.isConnected) {
      if (el && (!anchor || !anchor.isConnected)) this.hideToggleOffArrow();
      return;
    }
    try {
      if (anchor.hidden || (anchor.style && anchor.style.display === 'none')) {
        el.style.visibility = 'hidden';
        return;
      }
      const rect = anchor.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) {
        el.style.visibility = 'hidden';
        return;
      }
      el.style.visibility = 'visible';
      // Base size matches segment height, then scale up for visibility.
      const baseH = Math.max(24, Math.round(rect.height || 28));
      const h = Math.round(baseH * TOGGLE_OFF_ARROW_SCALE);
      const w = Math.round(baseH * 1.15 * TOGGLE_OFF_ARROW_SCALE);
      const gap = 4;
      el.style.height = `${h}px`;
      el.style.width = `${w}px`;
      el.style.top = `${Math.round(rect.top + rect.height / 2 - h / 2)}px`;
      // Sit just past the ON/OFF segment’s right edge; nudge left 5px.
      el.style.left = `${Math.round(rect.right + gap - TOGGLE_OFF_ARROW_LEFT_NUDGE_PX)}px`;
    } catch { /* ignore */ }
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
    lastCompletedTaskId = null,
    showTip = false,
    showCloseButton = false,
    transition = null,
    forceRebuild = false
  }) {
    const keyInfoStep = nextIncompleteTaskId(tasks, completedTaskIds) === 'keyboard_key_info';
    this._keyboardKeyInfoStepActive = keyInfoStep;
    if (keyInfoStep) ensureKeyboardReferenceOpenAndExpanded();

    // Paint while hidden so refresh can restore slide N before the first reveal.
    // (Previously this bailed on `hidden`, so the manager had to show() first —
    // which flashed the early-inject placeholder / slide 1 title.)
    this._ensure();
    if (!this.root || !this.root.isConnected) return;
    let panelHidden = false;
    try {
      panelHidden = this.root.hidden === true || String(this.root.style?.display || '') === 'none';
    } catch { /* ignore */ }

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
          lastCompletedTaskId,
          bodyText,
          forceRebuild,
          showTip: showTip === true,
          showCloseButton: showCloseButton === true,
          onCloseClick: this._onCloseClick,
          onTaskRowClick: this._onTaskRowClick
        });
      };

      const doSlide = !panelHidden && !!(transition && transition.type === 'slide');
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

    try { renderKeyboardKeysInto(this._overlayTitleEl, String(title || 'Nice!')); } catch { /* ignore */ }
    try { renderKeyboardKeysInto(this._overlayMsgEl, String(message || '')); } catch { /* ignore */ }
    try {
      this._overlayPrimaryBtn.textContent = String(primaryText || 'OK');
      this._overlayPrimaryBtn.hidden = false;
    } catch { /* ignore */ }
    try {
      const showSecondary = !!(secondaryText && String(secondaryText).trim());
      this._overlaySecondaryBtn.textContent = String(secondaryText || '');
      this._overlaySecondaryBtn.hidden = !showSecondary;
    } catch { /* ignore */ }

    this._overlayOpen = true;
    setOnboardingOverlayOpen(this._overlayEl, true, this.root);
  }

  hideOverlay() {
    this._overlayOpen = false;
    if (!this._overlayEl) return;
    setOnboardingOverlayOpen(this._overlayEl, false, this.root);
    this._overlayOnPrimary = null;
    this._overlayOnSecondary = null;
  }

  _ensure() {
    // Root already adopted — still ensure the modal overlay exists.
    // (Earlier show() paths can bind the shell before overlay creation; Chrome
    // first-paint races made showOverlay() exit early when _overlayEl was null.)
    if (this.root && this.root.isConnected) {
      this._ensureOverlay(this.root);
      return;
    }

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

      const overlayRefs = ensureOnboardingOverlay(rootEl || this.root);
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
        const displayNone = String(this._overlayEl.style?.display || '') === 'none';
        const open = !isHidden && !displayNone;
        this._overlayOpen = open;
        setOnboardingOverlayOpen(this._overlayEl, open, this.root);
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

  _onTaskRowClick(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    try {
      // Block checklist interaction until the modal overlay has been accepted.
      if (this.isOverlayOpen()) return;
      const row = e?.currentTarget || e?.target?.closest?.('[data-kp-onboarding-task-id]');
      if (!row) return;
      if (row.getAttribute('data-kp-onboarding-uncheckable') !== 'true') return;
      const taskId = row.getAttribute('data-kp-onboarding-task-id');
      if (!taskId || !this._onRequestUncheckTask) return;
      this._onRequestUncheckTask(String(taskId));
    } catch { /* ignore */ }
  }

  /**
   * Play the F-key click border effect around the walkthrough panel (marquee/flash/etc).
   * Uses the same CSS classes as OverlayManager so it matches user settings visuals.
   * @param {'marquee'|'flash'|'dash'|'scale'} [effect]
   */
  playBorderEffect(effect = 'marquee') {
    try {
      this._ensure();
      const host = this.root;
      if (!host || !host.isConnected) return;
      const rect = host.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) return;

      const map = {
        marquee: { className: CSS_CLASSES.FOCUS_MARQUEE || 'kpv2-focus-marquee', ms: 1200 },
        flash: { className: CSS_CLASSES.FOCUS_FLASH || 'kpv2-focus-flash', ms: 500 },
        scale: { className: CSS_CLASSES.FOCUS_PULSE || 'kpv2-focus-pulse', ms: 800 },
        dash: { className: CSS_CLASSES.FOCUS_DASH || 'kpv2-focus-dash', ms: 1100 }
      };
      const kind = map[String(effect || 'marquee')] || map.marquee;

      const pulse = document.createElement('div');
      pulse.className = kind.className;
      pulse.setAttribute('aria-hidden', 'true');
      pulse.setAttribute('data-kp-onboarding-border-effect', String(effect || 'marquee'));
      Object.assign(pulse.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: '3px',
        zIndex: String((Z_INDEX.ONBOARDING_PANEL || ONBOARDING_PANEL_Z_FALLBACK) + 5),
        pointerEvents: 'none'
      });
      (document.body || document.documentElement).appendChild(pulse);
      window.setTimeout(() => {
        try {
          if (pulse.parentNode) pulse.parentNode.removeChild(pulse);
        } catch { /* ignore */ }
      }, kind.ms + 80);
    } catch {
      // ignore
    }
  }
}
