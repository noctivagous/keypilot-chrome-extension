/**
 * Floating keyboard reference panel (content-script friendly).
 *
 * Shows KeyPilot's keyboard visualization in a small, fixed-position panel.
 *
 * Note: This is intentionally implemented in light DOM (no shadow root) because
 * `renderKeybindingsKeyboard()` injects its CSS into `document.head`.
 */
import { renderKeybindingsKeyboard } from './keybindings-ui.js';
import { Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import { getSettings, SETTINGS_STORAGE_KEY } from '../modules/settings-manager.js';

export class FloatingKeyboardHelp {
  /**
   * @param {Object} params
   * @param {Record<string, any>} params.keybindings
   */
  constructor({ keybindings } = {}) {
    this.keybindings = keybindings || {};
    this.root = null;
    this.keyboardContainer = null;
    this.closeBtn = null;
    this._onCloseClick = this._onCloseClick.bind(this);

    // Keydown/keyup visual feedback
    this._pressedLabels = new Set();
    this._keyElsByLabel = new Map();
    this._keydownBound = false;
    this._onDocKeyDown = this._onDocKeyDown.bind(this);
    this._onDocKeyUp = this._onDocKeyUp.bind(this);
    this._onWinBlur = this._onWinBlur.bind(this);

    this._keyFeedbackEnabled = true;
    this._settingsBound = false;
    this._onStorageChanged = this._onStorageChanged.bind(this);
  }

  setKeybindings(keybindings) {
    this.keybindings = keybindings || {};
    if (this.root && !this.root.hidden) {
      this._render();
    }
  }

  isVisible() {
    return !!(this.root && this.root.isConnected && this.root.hidden === false);
  }

  show() {
    // Never show inside iframes (avoids duplicating the panel in popover iframes).
    if (window !== window.top) return;
    this._ensure();
    this.root.hidden = false;
    this._render();
    this._bindSettingsSync();
    this._refreshKeyFeedbackSetting(); // async; best-effort
    this._bindKeydownFeedback();
  }

  hide() {
    if (this.root) this.root.hidden = true;
    this._unbindKeydownFeedback();
    this._unbindSettingsSync();
  }

  toggle() {
    if (this.isVisible()) this.hide();
    else this.show();
  }

  cleanup() {
    try {
      if (this.closeBtn) this.closeBtn.removeEventListener('click', this._onCloseClick);
    } catch { /* ignore */ }
    this._unbindKeydownFeedback();
    this._unbindSettingsSync();
    try {
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    } catch { /* ignore */ }
    this.root = null;
    this.keyboardContainer = null;
    this.closeBtn = null;
  }

  _ensure() {
    if (this.root && this.root.isConnected) return;

    // If early-inject created the shell at document_start, adopt it to avoid flicker.
    try {
      const existing = document.querySelector('.kp-floating-keyboard-help[data-kp-early-floating-keyboard="true"]');
      if (existing && existing.isConnected) {
        const keyboardContainer = existing.querySelector('.kp-floating-keyboard-help__keyboard');
        const closeBtn =
          existing.querySelector('button[data-kp-floating-keyboard-close="true"]') ||
          existing.querySelector('button[aria-label="Close keyboard reference"]');

        // Ensure the current z-index matches centralized constants (in case early-inject drifts).
        try {
          existing.style.zIndex = String(Z_INDEX.FLOATING_KEYBOARD_HELP);
        } catch { /* ignore */ }
        // Match popup.html theme tokens so the floating keyboard looks identical.
        applyPopupThemeVars(existing);

        if (keyboardContainer) {
          this.root = existing;
          this.keyboardContainer = keyboardContainer;
          this.closeBtn = closeBtn || null;
          if (this.closeBtn) {
            try {
              this.closeBtn.removeEventListener('click', this._onCloseClick);
            } catch { /* ignore */ }
            this.closeBtn.addEventListener('click', this._onCloseClick);
          }
          return;
        }
      }
    } catch { /* ignore */ }

    const root = document.createElement('div');
    root.className = 'kp-floating-keyboard-help';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'KeyPilot keyboard reference');

    // Keep styling mostly inline to avoid depending on any page CSS.
    Object.assign(root.style, {
      position: 'fixed',
      left: '16px',
      bottom: '16px',
      width: '740px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100vh - 24px)',
      overflow: 'auto',
      zIndex: String(Z_INDEX.FLOATING_KEYBOARD_HELP),
      background: 'rgba(20, 20, 20, 0.92)',
      color: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      /* backdrop-filter removed to prevent Chrome z-index stacking context bug */
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      pointerEvents: 'auto'
      /* Note: position: fixed creates a positioning context for absolute children */
    });
    // Match popup.html theme tokens so the floating keyboard looks identical.
    applyPopupThemeVars(root);

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    });

    const title = document.createElement('div');
    title.textContent = 'KeyPilot keyboard reference';
    Object.assign(title.style, {
      fontSize: '13px',
      fontWeight: '600',
      letterSpacing: '0.2px'
    });

    const hint = document.createElement('div');
    hint.textContent = 'Press K to toggle';
    Object.assign(hint.style, {
      marginLeft: 'auto',
      fontSize: '12px',
      fontWeight: '500',
      opacity: '0.8'
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close keyboard reference');
    Object.assign(closeBtn.style, {
      width: '28px',
      height: '28px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.18)',
      background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.95)',
      cursor: 'pointer',
      fontSize: '18px',
      lineHeight: '26px',
      padding: '0',
      flex: '0 0 auto'
    });
    closeBtn.addEventListener('click', this._onCloseClick);

    header.appendChild(title);
    header.appendChild(hint);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '10px 12px'
    });

    const keyboardContainer = document.createElement('div');
    keyboardContainer.className = 'kp-floating-keyboard-help__keyboard';
    body.appendChild(keyboardContainer);

    root.appendChild(header);
    root.appendChild(body);

    // Attach to DOM.
    (document.body || document.documentElement).appendChild(root);

    this.root = root;
    this.keyboardContainer = keyboardContainer;
    this.closeBtn = closeBtn;
  }

  _render() {
    if (!this.keyboardContainer) return;
    try {
      renderKeybindingsKeyboard({ container: this.keyboardContainer, keybindings: this.keybindings });
      this._rebuildKeyIndex();
    } catch (e) {
      // In case a page CSP / DOM edge case breaks rendering, fail gracefully.
      this.keyboardContainer.textContent = 'Unable to render keyboard reference on this page.';
      console.warn('[KeyPilot] Failed to render floating keyboard reference:', e);
    }
  }

  _bindKeydownFeedback() {
    if (this._keydownBound) return;
    try {
      // Use capture so we still see events even if KeyPilot stops propagation in bubble phase.
      document.addEventListener('keydown', this._onDocKeyDown, true);
      document.addEventListener('keyup', this._onDocKeyUp, true);
      window.addEventListener('blur', this._onWinBlur, true);
      this._keydownBound = true;
    } catch { /* ignore */ }
  }

  _unbindKeydownFeedback() {
    if (!this._keydownBound) return;
    try { document.removeEventListener('keydown', this._onDocKeyDown, true); } catch { /* ignore */ }
    try { document.removeEventListener('keyup', this._onDocKeyUp, true); } catch { /* ignore */ }
    try { window.removeEventListener('blur', this._onWinBlur, true); } catch { /* ignore */ }
    this._keydownBound = false;
    this._clearPressed();
  }

  _bindSettingsSync() {
    if (this._settingsBound) return;
    try {
      if (chrome?.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener(this._onStorageChanged);
        this._settingsBound = true;
      }
    } catch { /* ignore */ }
  }

  _unbindSettingsSync() {
    if (!this._settingsBound) return;
    try { chrome?.storage?.onChanged?.removeListener?.(this._onStorageChanged); } catch { /* ignore */ }
    this._settingsBound = false;
  }

  async _refreshKeyFeedbackSetting() {
    try {
      const settings = await getSettings();
      this._setKeyFeedbackEnabled(!!settings.keyboardReferenceKeyFeedback);
    } catch {
      // ignore (keep default)
    }
  }

  _onStorageChanged(changes, area) {
    try {
      if (area !== 'sync') return;
      const entry = changes && changes[SETTINGS_STORAGE_KEY];
      if (!entry || !entry.newValue) return;
      this._setKeyFeedbackEnabled(!!entry.newValue.keyboardReferenceKeyFeedback);
    } catch { /* ignore */ }
  }

  _setKeyFeedbackEnabled(enabled) {
    const next = !!enabled;
    if (this._keyFeedbackEnabled === next) return;
    this._keyFeedbackEnabled = next;
    if (!next) this._clearPressed();
  }

  _onWinBlur() {
    // If the page loses focus while keys are held, keyup may never arrive.
    this._clearPressed();
  }

  _normalizeLabel(s) {
    return String(s || '').trim().toUpperCase();
  }

  _labelsFromKeyboardEvent(e) {
    // Prefer semantic key names so this works across keyboard layouts.
    const key = e && typeof e.key === 'string' ? e.key : '';
    if (!key) return [];
    if (key === ' ') return []; // Space isn't represented on this mini keyboard.

    const upper = this._normalizeLabel(key);
    if (!upper) return [];

    // Match the UI's special key text.
    if (upper === 'CAPSLOCK') return ['CAPS'];
    if (upper === 'ESC' || upper === 'ESCAPE') return []; // not shown
    if (upper === 'CONTROL' || upper === 'ALT' || upper === 'META') return []; // not shown

    // The keyboard shows "Shift" twice; highlight both regardless of left/right.
    if (upper === 'SHIFT') return ['SHIFT'];

    // Default: the visible keys are mostly single characters or well-known names.
    return [upper];
  }

  _rebuildKeyIndex() {
    if (!this.keyboardContainer) return;
    const map = new Map();

    // Index by the visible "key label":
    // - action keys use `.key-label` (e.g. Q/W/E...)
    // - plain keys and specials use their own textContent (e.g. Y, Tab, Caps, Shift)
    const keyEls = this.keyboardContainer.querySelectorAll('.key');
    for (const keyEl of keyEls) {
      const labelEl = keyEl.querySelector?.('.key-label');
      const label = this._normalizeLabel(labelEl ? labelEl.textContent : keyEl.textContent);
      if (!label) continue;
      const arr = map.get(label) || [];
      arr.push(keyEl);
      map.set(label, arr);
    }

    this._keyElsByLabel = map;

    // If we re-rendered while keys were held, re-apply pressed styling.
    for (const label of this._pressedLabels) {
      const els = this._keyElsByLabel.get(label);
      if (!els) continue;
      for (const el of els) el.classList.add('kp-key-pressed');
    }
  }

  _setPressed(label, pressed) {
    const norm = this._normalizeLabel(label);
    if (!norm) return;
    const els = this._keyElsByLabel.get(norm);
    if (!els) return;
    for (const el of els) {
      if (pressed) el.classList.add('kp-key-pressed');
      else el.classList.remove('kp-key-pressed');
    }
  }

  _clearPressed() {
    for (const label of this._pressedLabels) {
      this._setPressed(label, false);
    }
    this._pressedLabels.clear();
  }

  _onDocKeyDown(e) {
    try {
      if (!this.isVisible()) return;
      if (!this._keyFeedbackEnabled) return;
      const labels = this._labelsFromKeyboardEvent(e);
      if (!labels || labels.length === 0) return;
      for (const label of labels) {
        if (this._pressedLabels.has(label)) continue;
        this._pressedLabels.add(label);
        this._setPressed(label, true);
      }
    } catch { /* ignore */ }
  }

  _onDocKeyUp(e) {
    try {
      if (!this.isVisible()) return;
      if (!this._keyFeedbackEnabled) return;
      const labels = this._labelsFromKeyboardEvent(e);
      if (!labels || labels.length === 0) return;
      for (const label of labels) {
        this._pressedLabels.delete(label);
        this._setPressed(label, false);
      }
    } catch { /* ignore */ }
  }

  _onCloseClick(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch { /* ignore */ }
    // Closing the panel should behave like pressing "K":
    // it must update KeyPilot's persisted visibility state, not only hide the DOM.
    try {
      const kp = window?.__KeyPilotInstance;
      if (kp && typeof kp.applyKeyboardHelpVisibility === 'function') {
        kp.applyKeyboardHelpVisibility(false, { persist: true });
        return;
      }
    } catch { /* ignore */ }

    // Fallback: still hide if KeyPilot isn't available for some reason.
    this.hide();
  }
}

// Debug: Make sure class is available globally for bundled version
if (typeof window !== 'undefined') {
  window.FloatingKeyboardHelp = FloatingKeyboardHelp;
}


