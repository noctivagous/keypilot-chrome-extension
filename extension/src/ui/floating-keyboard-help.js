/**
 * Floating keyboard reference panel (content-script friendly).
 *
 * Shows KeyPilot's keyboard visualization in a small, fixed-position panel.
 *
 * Note: This is intentionally implemented in light DOM (no shadow root) because
 * `renderKeybindingsKeyboard()` injects its CSS into `document.head`.
 */
import { renderKeybindingsKeyboard } from './keybindings-ui.js';
import { setKeyPressedState } from './keybindings-ui-shared.js';
import { Z_INDEX } from '../config/constants.js';
import { applyPopupThemeVars } from './popup-theme-vars.js';
import { getSettings, SETTINGS_STORAGE_KEY } from '../modules/settings-manager.js';

export class FloatingKeyboardHelp {
  /**
   * @param {Object} params
   * @param {Record<string, any>} params.keybindings
   * @param {any[]} [params.keyboardLayout]
   * @param {string} [params.layoutId]
   */
  constructor({ keybindings, keyboardLayout, layoutId } = {}) {
    this.keybindings = keybindings || {};
    this.keyboardLayout = keyboardLayout || null;
    this.layoutId = typeof layoutId === 'string' ? layoutId : '';
    this.root = null;
    this.keyboardContainer = null;
    this.closeBtn = null;
    this.hintEl = null;
    this._onCloseClick = this._onCloseClick.bind(this);

    // Keydown/keyup visual feedback
    this._pressedLabels = new Set();
    this._keyElsByLabel = new Map();
    /** @type {Map<string, HTMLElement[]>} */
    this._keyElsByActionId = new Map();
    this._keydownBound = false;
    this._onDocKeyDown = this._onDocKeyDown.bind(this);
    this._onDocKeyUp = this._onDocKeyUp.bind(this);
    this._onWinBlur = this._onWinBlur.bind(this);

    // When hovering a page link, highlight action keys that can activate it.
    this._linkHoverHintActive = false;
    /** @type {Set<string>} */
    this._linkHoverHintActionIds = new Set();

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

  setKeyboardLayout({ keyboardLayout, layoutId } = {}) {
    this.keyboardLayout = keyboardLayout || null;
    this.layoutId = typeof layoutId === 'string' ? layoutId : '';
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
    this.setLinkHoverHints(false);
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

  /**
   * Panel shell chrome shared by create + early-inject adopt paths.
   * @param {HTMLElement} root
   */
  _applyProPanelChrome(root) {
    if (!root || !root.style) return;
    Object.assign(root.style, {
      position: 'fixed',
      left: '16px',
      bottom: '16px',
      width: '760px',
      maxWidth: 'calc(100vw - 24px)',
      maxHeight: 'calc(100vh - 24px)',
      overflow: 'auto',
      zIndex: String(Z_INDEX.FLOATING_KEYBOARD_HELP),
      background: 'rgba(10, 11, 14, 0.98)',
      color: 'rgba(248, 250, 252, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      pointerEvents: 'auto'
    });
    applyPopupThemeVars(root);
  }

  /**
   * Compact, dark window-style titlebar.
   * @param {HTMLElement|null} header
   * @param {{ titleEl?: HTMLElement|null, hintEl?: HTMLElement|null, closeBtn?: HTMLElement|null }} [parts]
   */
  _applyCompactTitlebar(header, parts = {}) {
    if (!header || !header.style) return;
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      height: '28px',
      minHeight: '28px',
      maxHeight: '28px',
      boxSizing: 'border-box',
      padding: '0 6px 0 10px',
      margin: '0',
      borderBottom: '1px solid rgba(0,0,0,0.55)',
      background: 'linear-gradient(180deg, #1a1b1f 0%, #121316 100%)',
      flex: '0 0 auto'
    });

    const titleEl = parts.titleEl || header.querySelector('[data-kp-floating-keyboard-title="true"]') || header.firstElementChild;
    if (titleEl && titleEl.style) {
      Object.assign(titleEl.style, {
        fontSize: '11px',
        fontWeight: '600',
        letterSpacing: '0.01em',
        textTransform: 'none',
        color: 'rgba(220, 220, 225, 0.9)',
        lineHeight: '28px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        margin: '0',
        padding: '0'
      });
    }

    const hintEl = parts.hintEl || header.querySelector('[data-kp-floating-keyboard-hint="true"]');
    if (hintEl && hintEl.style) {
      Object.assign(hintEl.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        marginLeft: 'auto',
        fontSize: '10px',
        fontWeight: '500',
        letterSpacing: '0',
        color: 'rgba(140, 145, 155, 0.95)',
        padding: '0 4px',
        borderRadius: '0',
        border: 'none',
        background: 'transparent',
        lineHeight: '28px',
        whiteSpace: 'nowrap'
      });
    }

    const closeBtn = parts.closeBtn
      || header.querySelector('button[data-kp-floating-keyboard-close="true"]')
      || header.querySelector('button[aria-label="Close keyboard reference"]');
    if (closeBtn && closeBtn.style) {
      Object.assign(closeBtn.style, {
        width: '22px',
        height: '22px',
        minWidth: '22px',
        minHeight: '22px',
        borderRadius: '4px',
        border: 'none',
        background: 'transparent',
        color: 'rgba(200, 200, 205, 0.9)',
        cursor: 'pointer',
        fontSize: '15px',
        lineHeight: '20px',
        padding: '0',
        margin: '0',
        flex: '0 0 auto',
        boxShadow: 'none'
      });
    }
  }

  /**
   * Body that wraps `.kp-floating-keyboard-help__keyboard` — no chrome padding.
   * @param {HTMLElement|null} body
   */
  _applyKeyboardBodyChrome(body) {
    if (!body || !body.style) return;
    Object.assign(body.style, {
      padding: '0',
      margin: '0',
      border: 'none',
      background: 'transparent'
    });
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
        const header = existing.firstElementChild;
        const body = keyboardContainer?.parentElement || null;
        const hintEl = existing.querySelector('[data-kp-floating-keyboard-hint="true"]');
        const titleEl = existing.querySelector('[data-kp-floating-keyboard-title="true"]')
          || (header ? header.querySelector('div:not([data-kp-floating-keyboard-hint])') : null);

        try {
          this._applyProPanelChrome(existing);
          this._applyCompactTitlebar(header, { titleEl, hintEl, closeBtn });
          this._applyKeyboardBodyChrome(body);
        } catch { /* ignore */ }

        if (keyboardContainer) {
          this.root = existing;
          this.keyboardContainer = keyboardContainer;
          this.closeBtn = closeBtn || null;
          this.hintEl = hintEl || null;
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

    this._applyProPanelChrome(root);

    const header = document.createElement('div');
    header.setAttribute('data-kp-floating-keyboard-titlebar', 'true');

    const title = document.createElement('div');
    title.textContent = 'Keyboard Reference';
    title.setAttribute('data-kp-floating-keyboard-title', 'true');

    const hint = document.createElement('div');
    hint.setAttribute('data-kp-floating-keyboard-hint', 'true');
    this._setToggleHint(hint, 'K');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close keyboard reference');
    closeBtn.setAttribute('data-kp-floating-keyboard-close', 'true');
    closeBtn.addEventListener('click', this._onCloseClick);

    header.appendChild(title);
    header.appendChild(hint);
    header.appendChild(closeBtn);
    this._applyCompactTitlebar(header, { titleEl: title, hintEl: hint, closeBtn });

    const body = document.createElement('div');
    body.setAttribute('data-kp-floating-keyboard-body', 'true');
    this._applyKeyboardBodyChrome(body);

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
    this.hintEl = hint;
  }

  /**
   * Titlebar hint: "Press <kbd>K</kbd> to toggle" (key label is layout-aware).
   * @param {HTMLElement|null} hintEl
   * @param {string} keyLabel
   */
  _setToggleHint(hintEl, keyLabel) {
    if (!hintEl) return;
    const key = String(keyLabel || 'K').trim() || 'K';
    // Rebuild so we don't leave stale key labels after layout switches.
    while (hintEl.firstChild) hintEl.removeChild(hintEl.firstChild);

    hintEl.appendChild(document.createTextNode('Press '));

    const kbd = document.createElement('kbd');
    kbd.setAttribute('data-kp-floating-keyboard-hint-key', 'true');
    kbd.textContent = key;
    Object.assign(kbd.style, {
      display: 'inline-block',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: '10px',
      fontWeight: '600',
      lineHeight: '1.2',
      padding: '1px 5px',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      borderBottomColor: 'rgba(0, 0, 0, 0.55)',
      borderRadius: '4px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
      color: 'rgba(230, 232, 238, 0.95)',
      boxShadow: '0 1px 0 rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      verticalAlign: 'middle'
    });
    hintEl.appendChild(kbd);

    hintEl.appendChild(document.createTextNode(' to toggle'));
    try {
      hintEl.setAttribute('aria-label', `Press ${key} to toggle`);
    } catch { /* ignore */ }
  }

  _render() {
    if (!this.keyboardContainer) return;
    try {
      const b = this.keybindings && this.keybindings.TOGGLE_KEYBOARD_HELP;
      const key = (b && (b.displayKey || b.keyLabel)) ? String(b.displayKey || b.keyLabel) : 'K';
      this._setToggleHint(this.hintEl, key);
    } catch { /* ignore */ }
    try {
      renderKeybindingsKeyboard({
        container: this.keyboardContainer,
        keybindings: this.keybindings,
        keyboardLayout: this.keyboardLayout || undefined,
        layoutId: this.layoutId || undefined
      });
      this._rebuildKeyIndex();
    } catch (e) {
      // In case a page CSP / DOM edge case breaks rendering, fail gracefully.
      this.keyboardContainer.textContent = 'Unable to render keyboard reference on this page.';
      console.warn('[KeyPilot] Failed to render floating keyboard reference:', e);
    }
  }

  /**
   * Public entry points used by KeyPilot's capture-phase handler.
   * KeyPilot calls stopImmediatePropagation() on claimed shortcuts, which would
   * otherwise prevent document-level listeners registered later from seeing keydown.
   * @param {KeyboardEvent} e
   */
  reflectKeyDown(e) {
    this._onDocKeyDown(e);
  }

  /**
   * @param {KeyboardEvent} e
   */
  reflectKeyUp(e) {
    this._onDocKeyUp(e);
  }

  _bindKeydownFeedback() {
    if (this._keydownBound) return;
    try {
      // Capture listeners cover keys KeyPilot does not claim. Claimed shortcuts are
      // reflected via reflectKeyDown() from KeyPilot before stopImmediatePropagation.
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

  /**
   * Normalize an event/binding key token into the label(s) used on the keyboard UI.
   * @param {string} token
   * @returns {string[]}
   */
  _labelsFromToken(token) {
    const raw = String(token || '').trim();
    if (!raw || raw === ' ') return [];

    const upper = this._normalizeLabel(raw);
    if (!upper) return [];

    // Match the UI's special key text / common KeyboardEvent.key values.
    if (upper === 'CAPSLOCK' || upper === 'CAPS') return ['CAPS'];
    if (upper === 'ESCAPE' || upper === 'ESC') return ['ESC']; // may be absent from mini layout
    if (upper === 'CONTROL' || upper === 'CTRL' || upper === 'ALT' || upper === 'META' || upper === 'OS') {
      return []; // not shown on the mini keyboard
    }
    if (upper === 'SHIFT') return ['SHIFT'];
    if (upper === 'ENTER' || upper === 'RETURN') return ['ENTER'];
    if (upper === 'TAB') return ['TAB'];
    if (upper === 'BACKSPACE') return ['BACKSPACE'];
    if (upper === 'SEMICOLON') return [';'];
    if (upper === 'QUOTE') return ["'"];
    if (upper === 'BACKQUOTE' || upper === 'BACKTICK') return ['`'];
    if (upper === 'BRACKETLEFT') return ['['];
    if (upper === 'BRACKETRIGHT') return [']'];
    if (upper === 'COMMA') return [','];
    if (upper === 'PERIOD') return ['.'];
    if (upper === 'SLASH') return ['/'];
    if (upper === 'MINUS') return ['-'];
    if (upper === 'EQUAL') return ['='];
    if (upper === 'BACKSLASH') return ['\\'];

    // Punctuation: map shifted glyphs back to the base key label shown on the keyboard UI.
    if (upper === ':') return [';'];
    if (upper === '?') return ['/'];
    if (upper === '>') return ['.'];
    if (upper === '<') return [','];
    if (upper === '"') return ["'"];
    if (upper === '~') return ['`'];
    if (upper === '{') return ['['];
    if (upper === '}') return [']'];
    if (upper === '_') return ['-'];
    if (upper === '+') return ['='];
    if (upper === '|') return ['\\'];
    if (upper === '!') return ['1'];
    if (upper === '@') return ['2'];
    if (upper === '#') return ['3'];
    if (upper === '$') return ['4'];
    if (upper === '%') return ['5'];
    if (upper === '^') return ['6'];
    if (upper === '&') return ['7'];
    if (upper === '*') return ['8'];
    if (upper === '(') return ['9'];
    if (upper === ')') return ['0'];

    return [upper];
  }

  _labelsFromKeyboardEvent(e) {
    // Prefer semantic key names so this works across keyboard layouts; also use
    // KeyboardEvent.code so physical keys still light when key is a shifted glyph.
    const out = [];
    const seen = new Set();
    const pushAll = (tokens) => {
      for (const t of tokens || []) {
        if (!t || seen.has(t)) continue;
        seen.add(t);
        out.push(t);
      }
    };

    const key = e && typeof e.key === 'string' ? e.key : '';
    if (key) pushAll(this._labelsFromToken(key));

    const code = e && typeof e.code === 'string' ? e.code : '';
    if (code) {
      // KeyA → A, Digit1 → 1
      if (/^Key[A-Z]$/i.test(code)) pushAll([code.slice(3).toUpperCase()]);
      else if (/^Digit[0-9]$/.test(code)) pushAll([code.slice(5)]);
      else pushAll(this._labelsFromToken(code));
    }

    return out;
  }

  /**
   * @param {Map<string, HTMLElement[]>} map
   * @param {string} label
   * @param {HTMLElement} keyEl
   */
  _indexLabel(map, label, keyEl) {
    const tokens = [];
    const norm = this._normalizeLabel(label);
    if (norm) tokens.push(norm);

    // Composite display keys (e.g. "A/`", "F / G") → also index each part.
    if (norm && /[/|,]/.test(norm)) {
      for (const part of norm.split(/[/|,]+/)) {
        const p = this._normalizeLabel(part);
        if (p) tokens.push(p);
      }
    }

    // Expand each token through the same alias map used for events.
    const expanded = new Set();
    for (const t of tokens) {
      for (const alias of this._labelsFromToken(t)) {
        if (alias) expanded.add(alias);
      }
      if (t) expanded.add(t);
    }

    for (const token of expanded) {
      const arr = map.get(token) || [];
      if (!arr.includes(keyEl)) arr.push(keyEl);
      map.set(token, arr);
    }
  }

  _rebuildKeyIndex() {
    if (!this.keyboardContainer) return;
    const map = new Map();
    const byAction = new Map();
    const bindings = this.keybindings || {};

    // Index by the visible "key label":
    // - action keys use `.key-label` (e.g. Q/W/E...)
    // - plain keys and specials use `.key-text` (e.g. Y, Tab, Caps, Shift)
    // - also index binding.keys so event.key / event.code always resolve
    const keyEls = this.keyboardContainer.querySelectorAll('.key');
    for (const keyEl of keyEls) {
      const labelEl = keyEl.querySelector?.('.key-label');
      const textEl = keyEl.querySelector?.('.key-text');
      if (labelEl && labelEl.textContent) {
        this._indexLabel(map, labelEl.textContent, keyEl);
      }
      if (textEl && textEl.textContent) {
        this._indexLabel(map, textEl.textContent, keyEl);
      }
      if (!labelEl && !textEl) {
        this._indexLabel(map, keyEl.textContent, keyEl);
      }

      // Also index by action id for link-hover hints (ACTIVATE, OPEN_POPOVER, …).
      const actionId = keyEl.dataset?.kpActionId ? String(keyEl.dataset.kpActionId) : '';
      if (actionId) {
        const arr = byAction.get(actionId) || [];
        if (!arr.includes(keyEl)) arr.push(keyEl);
        byAction.set(actionId, arr);

        const binding = bindings[actionId];
        const keys = binding && Array.isArray(binding.keys) ? binding.keys : [];
        for (const k of keys) {
          this._indexLabel(map, k, keyEl);
        }
        if (binding?.displayKey) this._indexLabel(map, binding.displayKey, keyEl);
        if (binding?.keyLabel) this._indexLabel(map, binding.keyLabel, keyEl);
      }
    }

    this._keyElsByLabel = map;
    this._keyElsByActionId = byAction;

    // If we re-rendered while keys were held, re-apply pressed overlay.
    for (const label of this._pressedLabels) {
      const els = this._keyElsByLabel.get(label);
      if (!els) continue;
      for (const el of els) setKeyPressedState(el, true);
    }

    // Re-apply link-hover hints after re-render.
    if (this._linkHoverHintActive) {
      this._applyLinkHoverHintClasses(true);
    }
  }

  /**
   * Highlight keyboard keys that activate/open a hovered page link.
   * @param {boolean} active
   * @param {string[]} [actionIds] defaults to click + popover link actions
   */
  setLinkHoverHints(active, actionIds) {
    const next = Boolean(active);
    const ids = Array.isArray(actionIds) && actionIds.length
      ? actionIds.map(String)
      : ['ACTIVATE', 'OPEN_POPOVER', 'PREVIEW_LINK_POPOVER', 'ACTIVATE_NEW_TAB', 'ACTIVATE_NEW_TAB_BACKGROUND'];

    // Clear previous classes first.
    this._applyLinkHoverHintClasses(false);

    this._linkHoverHintActive = next;
    this._linkHoverHintActionIds = new Set(next ? ids : []);

    if (next && this.isVisible()) {
      this._applyLinkHoverHintClasses(true);
    }
  }

  /**
   * @param {boolean} on
   */
  _applyLinkHoverHintClasses(on) {
    try {
      const ids = this._linkHoverHintActionIds;
      if (!ids || ids.size === 0) return;
      for (const actionId of ids) {
        const els = this._keyElsByActionId.get(actionId);
        if (!els) continue;
        for (const el of els) {
          if (on) el.classList.add('kp-key-link-hint');
          else el.classList.remove('kp-key-link-hint');
        }
      }
    } catch { /* ignore */ }
  }

  _setPressed(label, pressed) {
    const norm = this._normalizeLabel(label);
    if (!norm) return;
    const els = this._keyElsByLabel.get(norm);
    if (!els) return;
    for (const el of els) {
      setKeyPressedState(el, pressed);
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


