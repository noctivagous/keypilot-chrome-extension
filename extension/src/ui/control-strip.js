/**
 * macOS 7–style Control Strip (content-script friendly).
 *
 * Compact fixed strip in the upper-left. Dark GUI Pro chrome matches the
 * floating keyboard reference panel. Segments: On/Off, Keyboard, Settings,
 * collapse, and close.
 *
 * Light DOM + inline styles so the strip survives hostile page CSS.
 */
import { Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import { getActionIconDataUri } from './keybindings-ui-shared.js';

const ROOT_CLASS = 'kp-control-strip';
const DEFAULT_TOP_PX = 16;
const DEFAULT_LEFT_PX = 16;
const STRIP_HEIGHT_PX = 28;
const ONBOARDING_GAP_PX = 8;

/**
 * @typedef {{
 *   onToggleEnabled?: () => void,
 *   onToggleKeyboard?: () => void,
 *   onOpenSettings?: () => void,
 *   onCollapseChange?: (collapsed: boolean) => void,
 *   onClose?: () => void
 * }} ControlStripHandlers
 */

export class ControlStrip {
  /**
   * @param {ControlStripHandlers} [handlers]
   */
  constructor(handlers = {}) {
    this.root = null;
    this._modulesEl = null;
    this._statusBtn = null;
    this._statusDot = null;
    this._statusLabel = null;
    this._keyboardBtn = null;
    this._settingsBtn = null;
    this._collapseBtn = null;
    this._closeBtn = null;

    this._enabled = true;
    this._collapsed = false;
    this._keyboardActive = false;
    this._desiredVisible = true;

    /** @type {ControlStripHandlers} */
    this._handlers = {
      onToggleEnabled: typeof handlers.onToggleEnabled === 'function' ? handlers.onToggleEnabled : null,
      onToggleKeyboard: typeof handlers.onToggleKeyboard === 'function' ? handlers.onToggleKeyboard : null,
      onOpenSettings: typeof handlers.onOpenSettings === 'function' ? handlers.onOpenSettings : null,
      onCollapseChange: typeof handlers.onCollapseChange === 'function' ? handlers.onCollapseChange : null,
      onClose: typeof handlers.onClose === 'function' ? handlers.onClose : null
    };

    this._onStatusClick = this._onStatusClick.bind(this);
    this._onKeyboardClick = this._onKeyboardClick.bind(this);
    this._onSettingsClick = this._onSettingsClick.bind(this);
    this._onCollapseClick = this._onCollapseClick.bind(this);
    this._onCloseClick = this._onCloseClick.bind(this);
    this._onDocMutate = this._onDocMutate.bind(this);
    this._onWinResize = this._onWinResize.bind(this);

    this._observer = null;
    this._observeBound = false;
  }

  /**
   * @param {Partial<ControlStripHandlers>} handlers
   */
  setHandlers(handlers = {}) {
    if (typeof handlers.onToggleEnabled === 'function') this._handlers.onToggleEnabled = handlers.onToggleEnabled;
    if (typeof handlers.onToggleKeyboard === 'function') this._handlers.onToggleKeyboard = handlers.onToggleKeyboard;
    if (typeof handlers.onOpenSettings === 'function') this._handlers.onOpenSettings = handlers.onOpenSettings;
    if (typeof handlers.onCollapseChange === 'function') this._handlers.onCollapseChange = handlers.onCollapseChange;
    if (typeof handlers.onClose === 'function') this._handlers.onClose = handlers.onClose;
  }

  isVisible() {
    return !!(this.root && this.root.isConnected && this.root.hidden === false);
  }

  isCollapsed() {
    return !!this._collapsed;
  }

  show() {
    if (window !== window.top) return;
    this._desiredVisible = true;
    this._ensure();
    this.root.hidden = false;
    this.root.style.display = 'flex';
    this.root.style.pointerEvents = 'auto';
    this._applyCollapsedLayout();
    this._syncOnboardingOffset();
    this._bindOnboardingWatch();
  }

  hide() {
    this._desiredVisible = false;
    if (this.root) {
      this.root.hidden = true;
      this.root.style.display = 'none';
      this.root.style.pointerEvents = 'none';
    }
    this._unbindOnboardingWatch();
  }

  /**
   * Apply desired visibility without changing the persisted "desired" flag when already set.
   * @param {boolean} visible
   */
  setVisible(visible) {
    if (visible) this.show();
    else this.hide();
  }

  /**
   * @param {boolean} collapsed
   * @param {{ notify?: boolean }} [opts]
   */
  setCollapsed(collapsed, opts = {}) {
    const next = !!collapsed;
    if (this._collapsed === next) {
      this._applyCollapsedLayout();
      return;
    }
    this._collapsed = next;
    this._applyCollapsedLayout();
    if (opts.notify !== false && this._handlers.onCollapseChange) {
      try { this._handlers.onCollapseChange(this._collapsed); } catch { /* ignore */ }
    }
  }

  /**
   * @param {boolean} enabled
   */
  setEnabledState(enabled) {
    this._enabled = !!enabled;
    this._renderStatus();
  }

  /**
   * @param {boolean} active
   */
  setKeyboardHelpActive(active) {
    this._keyboardActive = !!active;
    this._renderKeyboard();
  }

  cleanup() {
    this._unbindOnboardingWatch();
    try {
      if (this._statusBtn) this._statusBtn.removeEventListener('click', this._onStatusClick);
      if (this._keyboardBtn) this._keyboardBtn.removeEventListener('click', this._onKeyboardClick);
      if (this._settingsBtn) this._settingsBtn.removeEventListener('click', this._onSettingsClick);
      if (this._collapseBtn) this._collapseBtn.removeEventListener('click', this._onCollapseClick);
      if (this._closeBtn) this._closeBtn.removeEventListener('click', this._onCloseClick);
    } catch { /* ignore */ }
    try {
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    } catch { /* ignore */ }
    this.root = null;
    this._modulesEl = null;
    this._statusBtn = null;
    this._statusDot = null;
    this._statusLabel = null;
    this._keyboardBtn = null;
    this._settingsBtn = null;
    this._collapseBtn = null;
    this._closeBtn = null;
  }

  _ensure() {
    if (this.root && this.root.isConnected) return;

    // If early-inject created the shell at document_start, adopt it to avoid flicker.
    try {
      const existing = document.querySelector('.kp-control-strip[data-kp-early-control-strip="true"]');
      if (existing && existing.isConnected) {
        const statusBtn = existing.querySelector('[data-kp-control-strip-status="true"]');
        const statusDot = existing.querySelector('[data-kp-control-strip-status-dot="true"]');
        const statusLabel = existing.querySelector('[data-kp-control-strip-status-label="true"]');
        const modules = existing.querySelector('[data-kp-control-strip-modules="true"]');
        const keyboardBtn = existing.querySelector('[data-kp-control-strip-keyboard="true"]');
        const settingsBtn = existing.querySelector('[data-kp-control-strip-settings="true"]');
        const collapseBtn = existing.querySelector('[data-kp-control-strip-collapse="true"]');
        const closeBtn = existing.querySelector('[data-kp-control-strip-close="true"]');

        if (statusBtn && modules && keyboardBtn && settingsBtn && collapseBtn && closeBtn) {
          // Enrich early shell with icons if it only has text labels.
          try { this._ensureSegmentIcon(keyboardBtn, 'TOGGLE_KEYBOARD_HELP'); } catch { /* ignore */ }
          try { this._ensureSegmentIcon(settingsBtn, 'OPEN_SETTINGS_POPOVER'); } catch { /* ignore */ }

          this.root = existing;
          this._modulesEl = modules;
          this._statusBtn = statusBtn;
          this._statusDot = statusDot;
          this._statusLabel = statusLabel;
          this._keyboardBtn = keyboardBtn;
          this._settingsBtn = settingsBtn;
          this._collapseBtn = collapseBtn;
          this._closeBtn = closeBtn;

          this._bindButtonHandlers();
          this._renderStatus();
          this._renderKeyboard();
          this._applyCollapsedLayout();
          return;
        }
      }
    } catch { /* ignore */ }

    const root = document.createElement('div');
    root.className = ROOT_CLASS;
    root.hidden = true;
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'KeyPilot control strip');
    root.setAttribute('data-kp-control-strip', 'true');

    Object.assign(root.style, {
      position: 'fixed',
      left: `${DEFAULT_LEFT_PX}px`,
      top: `${DEFAULT_TOP_PX}px`,
      height: `${STRIP_HEIGHT_PX}px`,
      minHeight: `${STRIP_HEIGHT_PX}px`,
      maxHeight: `${STRIP_HEIGHT_PX}px`,
      display: 'none',
      flexDirection: 'row',
      alignItems: 'stretch',
      zIndex: String(Z_INDEX.CONTROL_STRIP || 2147483025),
      background: 'rgba(10, 11, 14, 0.98)',
      color: 'rgba(248, 250, 252, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.35)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      pointerEvents: 'auto',
      overflow: 'hidden',
      boxSizing: 'border-box',
      userSelect: 'none',
      WebkitUserSelect: 'none'
    });
    applyPopupThemeVars(root);

    // Status (On/Off) — always visible
    const statusBtn = this._createSegmentButton({
      ariaLabel: 'Toggle KeyPilot on or off',
      title: 'Toggle KeyPilot (Alt+K)',
      primary: true
    });
    statusBtn.setAttribute('data-kp-control-strip-status', 'true');

    const statusInner = document.createElement('span');
    Object.assign(statusInner.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      pointerEvents: 'none'
    });

    const statusDot = document.createElement('span');
    Object.assign(statusDot.style, {
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      flex: '0 0 auto',
      background: 'rgba(16, 185, 129, 0.95)',
      boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)'
    });
    statusDot.setAttribute('aria-hidden', 'true');
    statusDot.setAttribute('data-kp-control-strip-status-dot', 'true');

    const statusLabel = document.createElement('span');
    statusLabel.textContent = 'ON';
    statusLabel.setAttribute('data-kp-control-strip-status-label', 'true');
    Object.assign(statusLabel.style, {
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.06em',
      lineHeight: '1'
    });

    statusInner.appendChild(statusDot);
    statusInner.appendChild(statusLabel);
    statusBtn.appendChild(statusInner);

    // Expandable modules (hidden when collapsed)
    const modules = document.createElement('div');
    modules.setAttribute('data-kp-control-strip-modules', 'true');
    Object.assign(modules.style, {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      flex: '0 0 auto'
    });

    const keyboardBtn = this._createSegmentButton({
      ariaLabel: 'Toggle keyboard reference',
      title: 'Keyboard reference',
      text: 'KB',
      iconActionId: 'TOGGLE_KEYBOARD_HELP'
    });
    keyboardBtn.setAttribute('data-kp-control-strip-keyboard', 'true');

    const settingsBtn = this._createSegmentButton({
      ariaLabel: 'Open KeyPilot settings',
      title: 'Settings',
      text: 'Settings',
      iconActionId: 'OPEN_SETTINGS_POPOVER'
    });
    settingsBtn.setAttribute('data-kp-control-strip-settings', 'true');

    modules.appendChild(keyboardBtn);
    modules.appendChild(settingsBtn);

    // Collapse / expand
    const collapseBtn = this._createSegmentButton({
      ariaLabel: 'Collapse control strip',
      title: 'Collapse',
      text: '◀',
      compact: true
    });
    collapseBtn.setAttribute('data-kp-control-strip-collapse', 'true');

    // Close
    const closeBtn = this._createSegmentButton({
      ariaLabel: 'Close control strip',
      title: 'Close (Alt+J to show again)',
      text: '×',
      compact: true,
      last: true
    });
    closeBtn.setAttribute('data-kp-control-strip-close', 'true');

    root.appendChild(statusBtn);
    root.appendChild(modules);
    root.appendChild(collapseBtn);
    root.appendChild(closeBtn);

    (document.body || document.documentElement).appendChild(root);

    this.root = root;
    this._modulesEl = modules;
    this._statusBtn = statusBtn;
    this._statusDot = statusDot;
    this._statusLabel = statusLabel;
    this._keyboardBtn = keyboardBtn;
    this._settingsBtn = settingsBtn;
    this._collapseBtn = collapseBtn;
    this._closeBtn = closeBtn;

    this._bindButtonHandlers();
    this._renderStatus();
    this._renderKeyboard();
    this._applyCollapsedLayout();
  }

  /**
   * Attach click handlers (safe to call after early-inject adoption).
   */
  _bindButtonHandlers() {
    try {
      if (this._statusBtn) {
        this._statusBtn.removeEventListener('click', this._onStatusClick);
        this._statusBtn.addEventListener('click', this._onStatusClick);
      }
      if (this._keyboardBtn) {
        this._keyboardBtn.removeEventListener('click', this._onKeyboardClick);
        this._keyboardBtn.addEventListener('click', this._onKeyboardClick);
      }
      if (this._settingsBtn) {
        this._settingsBtn.removeEventListener('click', this._onSettingsClick);
        this._settingsBtn.addEventListener('click', this._onSettingsClick);
      }
      if (this._collapseBtn) {
        this._collapseBtn.removeEventListener('click', this._onCollapseClick);
        this._collapseBtn.addEventListener('click', this._onCollapseClick);
      }
      if (this._closeBtn) {
        this._closeBtn.removeEventListener('click', this._onCloseClick);
        this._closeBtn.addEventListener('click', this._onCloseClick);
      }
    } catch { /* ignore */ }
  }

  /**
   * Prepend action icon into a segment button if missing (early shell is text-only).
   * @param {HTMLElement|null} btn
   * @param {string} actionId
   */
  _ensureSegmentIcon(btn, actionId) {
    if (!btn || !actionId) return;
    try {
      if (btn.querySelector('img[data-kp-control-strip-icon="true"]')) return;
      const icon = this._createActionIcon(actionId);
      if (!icon) return;
      icon.setAttribute('data-kp-control-strip-icon', 'true');
      btn.insertBefore(icon, btn.firstChild);
    } catch { /* ignore */ }
  }

  /**
   * Inline monochrome icon for a KeyPilot action (keyboard, gear, etc.).
   * @param {string} actionId
   * @param {string} [color]
   * @returns {HTMLElement|null}
   */
  _createActionIcon(actionId, color = 'rgba(220, 220, 225, 0.92)') {
    try {
      const cssUri = getActionIconDataUri(actionId, { fill: color });
      if (!cssUri) return null;
      // cssUri is CSS url("data:...") — extract the raw data URL for <img src>.
      const match = String(cssUri).match(/^url\("(.+)"\)$/);
      const src = match ? match[1] : null;
      if (!src) return null;
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      Object.assign(img.style, {
        width: '14px',
        height: '14px',
        display: 'block',
        pointerEvents: 'none',
        flex: '0 0 auto',
        opacity: '0.95'
      });
      return img;
    } catch {
      return null;
    }
  }

  /**
   * @param {{
   *   ariaLabel: string,
   *   title?: string,
   *   text?: string,
   *   iconActionId?: string,
   *   primary?: boolean,
   *   compact?: boolean,
   *   last?: boolean
   * }} opts
   */
  _createSegmentButton(opts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', opts.ariaLabel);
    if (opts.title) btn.title = opts.title;

    if (opts.iconActionId) {
      const icon = this._createActionIcon(opts.iconActionId);
      if (icon) {
        try { icon.setAttribute('data-kp-control-strip-icon', 'true'); } catch { /* ignore */ }
        btn.appendChild(icon);
      }
    }
    if (opts.text) {
      const label = document.createElement('span');
      label.textContent = opts.text;
      Object.assign(label.style, {
        pointerEvents: 'none',
        lineHeight: '1'
      });
      btn.appendChild(label);
    }

    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      height: '100%',
      minHeight: `${STRIP_HEIGHT_PX - 2}px`,
      margin: '0',
      padding: opts.compact ? '0 8px' : '0 10px',
      border: 'none',
      borderRight: opts.last ? 'none' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: '0',
      background: opts.primary
        ? 'linear-gradient(180deg, #1a1b1f 0%, #121316 100%)'
        : 'transparent',
      color: 'rgba(220, 220, 225, 0.92)',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.01em',
      lineHeight: '1',
      cursor: 'pointer',
      flex: '0 0 auto',
      boxShadow: 'none',
      outline: 'none',
      whiteSpace: 'nowrap'
    });

    btn.addEventListener('mouseenter', () => {
      try {
        btn.style.background = opts.primary
          ? 'linear-gradient(180deg, #22232a 0%, #18191e 100%)'
          : 'rgba(255,255,255,0.06)';
      } catch { /* ignore */ }
    });
    btn.addEventListener('mouseleave', () => {
      try {
        if (btn === this._keyboardBtn && this._keyboardActive) {
          btn.style.background = 'rgba(59, 130, 246, 0.18)';
        } else {
          btn.style.background = opts.primary
            ? 'linear-gradient(180deg, #1a1b1f 0%, #121316 100%)'
            : 'transparent';
        }
      } catch { /* ignore */ }
    });
    btn.addEventListener('focus', () => {
      try { btn.style.boxShadow = 'inset 0 0 0 1px rgba(59, 130, 246, 0.55)'; } catch { /* ignore */ }
    });
    btn.addEventListener('blur', () => {
      try { btn.style.boxShadow = 'none'; } catch { /* ignore */ }
    });

    return btn;
  }

  _applyCollapsedLayout() {
    if (!this.root) return;
    const collapsed = !!this._collapsed;

    if (this._modulesEl) {
      this._modulesEl.style.display = collapsed ? 'none' : 'flex';
    }
    if (this._closeBtn) {
      this._closeBtn.style.display = collapsed ? 'none' : 'inline-flex';
    }
    if (this._collapseBtn) {
      this._collapseBtn.textContent = collapsed ? '▶' : '◀';
      this._collapseBtn.setAttribute(
        'aria-label',
        collapsed ? 'Expand control strip' : 'Collapse control strip'
      );
      this._collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
      // When collapsed, collapse control is last visible segment.
      this._collapseBtn.style.borderRight = 'none';
      if (!collapsed && this._closeBtn) {
        this._collapseBtn.style.borderRight = '1px solid rgba(255,255,255,0.08)';
      }
    }

    try {
      this.root.setAttribute('data-kp-collapsed', collapsed ? 'true' : 'false');
    } catch { /* ignore */ }
  }

  _renderStatus() {
    if (!this._statusLabel || !this._statusDot) return;
    const on = !!this._enabled;
    this._statusLabel.textContent = on ? 'ON' : 'OFF';
    this._statusDot.style.background = on
      ? 'rgba(16, 185, 129, 0.95)'
      : 'rgba(148, 163, 184, 0.85)';
    this._statusDot.style.boxShadow = on
      ? '0 0 0 2px rgba(16, 185, 129, 0.2)'
      : '0 0 0 2px rgba(148, 163, 184, 0.15)';
    this._statusLabel.style.color = on
      ? 'rgba(167, 243, 208, 0.95)'
      : 'rgba(148, 163, 184, 0.95)';
    if (this._statusBtn) {
      this._statusBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      this._statusBtn.title = on
        ? 'KeyPilot is on — click to turn off (Alt+K)'
        : 'KeyPilot is off — click to turn on (Alt+K)';
    }
  }

  _renderKeyboard() {
    if (!this._keyboardBtn) return;
    const active = !!this._keyboardActive;
    this._keyboardBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    this._keyboardBtn.style.background = active
      ? 'rgba(59, 130, 246, 0.18)'
      : 'transparent';
    this._keyboardBtn.style.color = active
      ? 'rgba(191, 219, 254, 0.98)'
      : 'rgba(220, 220, 225, 0.92)';
    this._keyboardBtn.title = active
      ? 'Hide keyboard reference'
      : 'Show keyboard reference';
  }

  _onStatusClick(e) {
    try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
    if (this._handlers.onToggleEnabled) {
      try { this._handlers.onToggleEnabled(); } catch { /* ignore */ }
    }
  }

  _onKeyboardClick(e) {
    try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
    if (this._handlers.onToggleKeyboard) {
      try { this._handlers.onToggleKeyboard(); } catch { /* ignore */ }
    }
  }

  _onSettingsClick(e) {
    try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
    if (this._handlers.onOpenSettings) {
      try { this._handlers.onOpenSettings(); } catch { /* ignore */ }
    }
  }

  _onCollapseClick(e) {
    try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
    this.setCollapsed(!this._collapsed, { notify: true });
  }

  _onCloseClick(e) {
    try { e.preventDefault(); e.stopPropagation(); } catch { /* ignore */ }
    this.hide();
    if (this._handlers.onClose) {
      try { this._handlers.onClose(); } catch { /* ignore */ }
    }
  }

  /**
   * Push the strip below the onboarding walkthrough when it occupies the top-left.
   */
  _syncOnboardingOffset() {
    if (!this.root) return;
    let top = DEFAULT_TOP_PX;
    try {
      const panel = document.querySelector('.kp-onboarding-panel');
      if (panel && panel.isConnected) {
        const hidden = panel.hidden === true
          || panel.getAttribute('hidden') !== null
          || panel.style.display === 'none'
          || window.getComputedStyle(panel).display === 'none'
          || window.getComputedStyle(panel).visibility === 'hidden';
        if (!hidden) {
          const rect = panel.getBoundingClientRect();
          if (rect && rect.height > 0 && rect.bottom > 0) {
            // Only offset when onboarding is in the top-left region.
            if (rect.left < 400 && rect.top < 120) {
              top = Math.max(DEFAULT_TOP_PX, Math.round(rect.bottom + ONBOARDING_GAP_PX));
            }
          }
        }
      }
    } catch { /* ignore */ }
    try {
      this.root.style.top = `${top}px`;
    } catch { /* ignore */ }
  }

  _bindOnboardingWatch() {
    if (this._observeBound) return;
    try {
      if (typeof MutationObserver !== 'undefined') {
        this._observer = new MutationObserver(() => {
          this._syncOnboardingOffset();
        });
        this._observer.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['hidden', 'style', 'class']
        });
      }
    } catch { /* ignore */ }
    try {
      window.addEventListener('resize', this._onWinResize, true);
    } catch { /* ignore */ }
    this._observeBound = true;
  }

  _unbindOnboardingWatch() {
    if (!this._observeBound) return;
    try {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
    } catch { /* ignore */ }
    try {
      window.removeEventListener('resize', this._onWinResize, true);
    } catch { /* ignore */ }
    this._observeBound = false;
  }

  _onDocMutate() {
    this._syncOnboardingOffset();
  }

  _onWinResize() {
    this._syncOnboardingOffset();
  }
}
