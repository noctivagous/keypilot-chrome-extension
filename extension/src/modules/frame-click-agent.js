/**
 * Thin cross-origin iframe click agent.
 *
 * Runs only in non-top frames. Stays idle (no overlays, no observers): stores
 * last pointer position and handles:
 *  1. postMessage KP_FRAME_ACTIVATE from the parent (primary path — top-frame F)
 *  2. Activate keybinds when this frame has focus (parent never sees those keys)
 *
 * Full KeyPilot still initializes only in the top frame. When full KP is also
 * running in this frame (KeyPilot popover), local key handling is skipped so we
 * do not double-activate.
 */

import { MSG } from '../messaging/types.js';
import { isTypingContext, hasModifierKeys } from '../utils/dom-context.js';
import {
  buildKeybindingsForLayout,
  DEFAULT_KEYBOARD_LAYOUT_ID,
  normalizeKeyboardLayoutId
} from '../config/keyboard-layouts.js';
import { getSettings, SETTINGS_STORAGE_KEY } from './settings-manager.js';

/**
 * @typedef {{ openInNewTab?: boolean, background?: boolean }} FrameActivateOptions
 */

/**
 * Shadow-DOM–aware elementFromPoint (no iframe piercing — that is recursive via postMessage).
 * @param {number} x
 * @param {number} y
 * @returns {Element|null}
 */
function deepElementFromPoint(x, y) {
  try {
    let el = document.elementFromPoint(x, y);
    let guard = 0;
    while (el && el.shadowRoot && guard++ < 10) {
      const nested = el.shadowRoot.elementFromPoint(x, y);
      if (!nested || nested === el) break;
      el = nested;
    }
    return el || null;
  } catch {
    return null;
  }
}

/**
 * Coordinate-carrying click sequence (mirrors ActivationHandler.dispatchClickSequence).
 * @param {EventTarget} target
 * @param {number} clientX
 * @param {number} clientY
 */
function dispatchClickSequence(target, clientX, clientY) {
  if (!target) return;

  const common = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX,
    clientY,
    button: 0,
    buttons: 1
  };

  const hasPointer = typeof window.PointerEvent === 'function';
  if (hasPointer) {
    const pCommon = { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { target.dispatchEvent(new PointerEvent('pointerover', pCommon)); } catch { /* ignore */ }
    try { target.dispatchEvent(new PointerEvent('pointerenter', pCommon)); } catch { /* ignore */ }
    try { target.dispatchEvent(new PointerEvent('pointerdown', pCommon)); } catch { /* ignore */ }
  } else {
    try { target.dispatchEvent(new MouseEvent('pointerover', common)); } catch { /* ignore */ }
    try { target.dispatchEvent(new MouseEvent('pointerenter', common)); } catch { /* ignore */ }
    try { target.dispatchEvent(new MouseEvent('pointerdown', common)); } catch { /* ignore */ }
  }

  try { target.dispatchEvent(new MouseEvent('mouseover', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mouseenter', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mousemove', common)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('mousedown', common)); } catch { /* ignore */ }

  const commonUp = { ...common, buttons: 0 };
  if (hasPointer) {
    const pUp = { ...commonUp, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    try { target.dispatchEvent(new PointerEvent('pointerup', pUp)); } catch { /* ignore */ }
  } else {
    try { target.dispatchEvent(new MouseEvent('pointerup', commonUp)); } catch { /* ignore */ }
  }
  try { target.dispatchEvent(new MouseEvent('mouseup', commonUp)); } catch { /* ignore */ }
  try { target.dispatchEvent(new MouseEvent('click', commonUp)); } catch { /* ignore */ }
}

/**
 * @param {Element|null} el
 * @returns {HTMLAnchorElement|null}
 */
function closestLink(el) {
  try {
    if (!el || el.nodeType !== 1) return null;
    if (el.tagName === 'A' && /** @type {HTMLAnchorElement} */ (el).href) {
      return /** @type {HTMLAnchorElement} */ (el);
    }
    const a = typeof el.closest === 'function' ? el.closest('a[href]') : null;
    return a && a.tagName === 'A' ? /** @type {HTMLAnchorElement} */ (a) : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @param {{ background?: boolean }} opts
 * @returns {boolean}
 */
function openUrlViaRuntime(url, opts = {}) {
  if (!url) return false;
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return false;
    const type = opts.background ? MSG.OPEN_URL_BACKGROUND : MSG.OPEN_URL_FOREGROUND;
    chrome.runtime.sendMessage({ type, url }).catch(() => { /* ignore */ });
    return true;
  } catch {
    return false;
  }
}

/**
 * True when full KeyPilot is running in this frame (e.g. KP popover iframe).
 * @returns {boolean}
 */
function hasFullKeyPilot() {
  try {
    return !!(window.keyPilot || window.__KeyPilotInstance || window.__KeyPilotToggleHandler);
  } catch {
    return false;
  }
}

/**
 * Install the frame click agent in a child frame.
 * @returns {{ dispose: () => void }|null}
 */
export function installFrameClickAgent() {
  try {
    if (window === window.top) return null;

    /** @type {boolean} */
    let enabled = true;
    /** @type {{ x: number|null, y: number|null }} */
    let lastMouse = { x: null, y: null };
    /** @type {ReturnType<typeof buildKeybindingsForLayout>} */
    let keybindings = buildKeybindingsForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);

    const keyIn = (assignment, key) => {
      try {
        const keys = assignment?.keys;
        return Array.isArray(keys) && keys.includes(key);
      } catch {
        return false;
      }
    };

    const refreshKeybindings = async () => {
      try {
        const settings = await getSettings();
        const layoutId = normalizeKeyboardLayoutId(settings?.keyboardLayoutId);
        keybindings = buildKeybindingsForLayout(layoutId);
      } catch {
        // keep previous / default
      }
    };

    const syncEnabledFromRuntime = async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
        const response = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
        if (response && typeof response.enabled === 'boolean') {
          enabled = response.enabled;
        }
      } catch {
        // Default enabled on communication failure (matches toggle handler).
        enabled = true;
      }
    };

    /** Prevent double-activate when parent uses both postMessage and SW fan-out. */
    let lastActivateAt = 0;

    /**
     * @param {number} clientX
     * @param {number} clientY
     * @param {FrameActivateOptions} [opts]
     * @returns {boolean}
     */
    const activateAt = (clientX, clientY, opts = {}) => {
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

      const now = Date.now();
      if (now - lastActivateAt < 100) return false;
      lastActivateAt = now;

      const el = deepElementFromPoint(clientX, clientY);
      if (!el) return false;

      // Nested iframe: re-forward with coordinates local to the nested frame.
      if (el.tagName === 'IFRAME') {
        try {
          const iframe = /** @type {HTMLIFrameElement} */ (el);
          const rect = iframe.getBoundingClientRect();
          const localX = clientX - rect.left;
          const localY = clientY - rect.top;
          if (
            localX >= 0 && localY >= 0 &&
            localX <= rect.width && localY <= rect.height &&
            iframe.contentWindow
          ) {
            iframe.contentWindow.postMessage({
              type: MSG.FRAME_ACTIVATE,
              clientX: localX,
              clientY: localY,
              openInNewTab: !!opts.openInNewTab,
              background: !!opts.background
            }, '*');
            return true;
          }
        } catch {
          // Fall through to click the iframe element itself.
        }
      }

      const openInNewTab = !!opts.openInNewTab;
      const background = !!opts.background;
      const link = closestLink(el);

      if (link && (openInNewTab || background)) {
        const url = link.href;
        if (openUrlViaRuntime(url, { background })) return true;
        try {
          if (background) {
            window.open(url, '_blank', 'noopener,noreferrer');
          } else {
            const originalTarget = link.target;
            link.target = '_blank';
            try { link.click(); } catch { window.open(url, '_blank', 'noopener,noreferrer'); }
            if (originalTarget !== undefined && originalTarget !== null && originalTarget !== '') {
              link.target = originalTarget;
            } else {
              link.removeAttribute('target');
            }
          }
          return true;
        } catch {
          return false;
        }
      }

      // Prefer a semantic activator (button / link / role) when the hit target is a child.
      let activator = el;
      try {
        const specific = el.closest?.(
          'a[href], button, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], summary, [onclick]'
        );
        if (specific) activator = specific;
      } catch { /* ignore */ }

      // Same-window link: programmatic click preserves site handlers better than location assign.
      if (activator.tagName === 'A' && /** @type {HTMLAnchorElement} */ (activator).href && !openInNewTab && !background) {
        try {
          /** @type {HTMLAnchorElement} */ (activator).click();
          return true;
        } catch { /* fall through to event sequence */ }
      }

      dispatchClickSequence(el, clientX, clientY);
      try {
        if (
          activator &&
          activator !== el &&
          !(typeof activator.contains === 'function' && activator.contains(el))
        ) {
          dispatchClickSequence(activator, clientX, clientY);
        }
      } catch { /* ignore */ }

      return true;
    };

    /**
     * postMessage source checks are unreliable across content-script isolated worlds
     * (`event.source === window.parent` often fails even for real parent posts).
     * Accept KP_FRAME_ACTIVATE only when we are framed and the payload is well-formed;
     * optional frameName targets a specific iframe (e.g. Google name="account").
     * @param {MessageEvent|null} event
     * @param {any} data
     * @returns {boolean}
     */
    const acceptActivatePayload = (event, data) => {
      if (!data || data.type !== MSG.FRAME_ACTIVATE) return false;
      if (!enabled) return false;
      // Must be embedded (not top-level).
      try {
        if (window === window.top) return false;
      } catch {
        // Access to top can throw in rare sandboxes — treat as framed.
      }
      // Reject self-posted messages when we can tell.
      try {
        if (event && event.source === window) return false;
      } catch { /* ignore */ }
      // Optional name targeting (parent includes iframe.name when set).
      try {
        const want = typeof data.frameName === 'string' ? data.frameName : '';
        if (want && window.name && want !== window.name) return false;
      } catch { /* ignore */ }
      return Number.isFinite(Number(data.clientX)) && Number.isFinite(Number(data.clientY));
    };

    /** @param {MessageEvent} event */
    const onMessage = (event) => {
      try {
        const data = event?.data;
        if (!acceptActivatePayload(event, data)) return;

        const x = Number(data.clientX);
        const y = Number(data.clientY);
        activateAt(x, y, {
          openInNewTab: !!data.openInNewTab,
          background: !!data.background
        });
      } catch {
        // ignore
      }
    };

    /** @param {MouseEvent|PointerEvent} e */
    const onPointer = (e) => {
      try {
        if (typeof e.clientX === 'number') lastMouse.x = e.clientX;
        if (typeof e.clientY === 'number') lastMouse.y = e.clientY;
      } catch {
        // ignore
      }
    };

    /** @param {KeyboardEvent} e */
    const onKeyDown = (e) => {
      try {
        if (!enabled) return;
        // Full KeyPilot in this frame owns activate keys.
        if (hasFullKeyPilot()) return;
        if (hasModifierKeys(e)) return;
        if (isTypingContext(e.target)) return;

        const key = e.key;
        const kb = keybindings || {};
        let mode = null;
        if (keyIn(kb.ACTIVATE, key)) mode = 'activate';
        else if (keyIn(kb.ACTIVATE_NEW_TAB, key)) mode = 'newTab';
        else if (keyIn(kb.ACTIVATE_NEW_TAB_BACKGROUND, key)) mode = 'background';
        else return;

        let x = lastMouse.x;
        let y = lastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
          x = Math.floor(window.innerWidth / 2);
          y = Math.floor(window.innerHeight / 2);
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        activateAt(x, y, {
          openInNewTab: mode === 'newTab',
          background: mode === 'background'
        });
      } catch {
        // ignore
      }
    };

    /**
     * @param {any} message
     * @param {chrome.runtime.MessageSender} _sender
     * @param {(response?: any) => void} sendResponse
     */
    const onRuntimeMessage = (message, _sender, sendResponse) => {
      try {
        if (message?.type === MSG.TOGGLE_STATE || message?.type === MSG.UPDATE_STATE) {
          if (typeof message.enabled === 'boolean') {
            enabled = message.enabled;
          }
          return false;
        }

        // Backup path: SW can fan-out FRAME_ACTIVATE to subframes (postMessage is primary).
        if (message?.type === MSG.FRAME_ACTIVATE) {
          if (!acceptActivatePayload(null, message)) {
            try { sendResponse({ ok: false }); } catch { /* ignore */ }
            return true;
          }
          const ok = activateAt(Number(message.clientX), Number(message.clientY), {
            openInNewTab: !!message.openInNewTab,
            background: !!message.background
          });
          try { sendResponse({ ok: !!ok, href: String(location.href || '').slice(0, 120) }); } catch { /* ignore */ }
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    };

    /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
    const onStorageChanged = (changes, area) => {
      try {
        if (area !== 'sync' && area !== 'local') return;
        if (changes?.keypilot_enabled && typeof changes.keypilot_enabled.newValue === 'boolean') {
          enabled = changes.keypilot_enabled.newValue;
        }
        if (changes && Object.prototype.hasOwnProperty.call(changes, SETTINGS_STORAGE_KEY)) {
          void refreshKeybindings();
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('message', onMessage, true);
    document.addEventListener('mousemove', onPointer, { capture: true, passive: true });
    document.addEventListener('pointermove', onPointer, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown, true);

    try {
      chrome.runtime?.onMessage?.addListener(onRuntimeMessage);
    } catch { /* ignore */ }
    try {
      chrome.storage?.onChanged?.addListener(onStorageChanged);
    } catch { /* ignore */ }

    // Visible to page-world diagnostics (isolated world cannot expose JS globals to the page).
    try {
      document.documentElement?.setAttribute('data-kp-frame-agent', '1');
    } catch { /* ignore */ }

    void syncEnabledFromRuntime();
    void refreshKeybindings();

    return {
      dispose() {
        try {
          window.removeEventListener('message', onMessage, true);
          document.removeEventListener('mousemove', onPointer, true);
          document.removeEventListener('pointermove', onPointer, true);
          document.removeEventListener('keydown', onKeyDown, true);
        } catch { /* ignore */ }
        try {
          chrome.runtime?.onMessage?.removeListener(onRuntimeMessage);
        } catch { /* ignore */ }
        try {
          chrome.storage?.onChanged?.removeListener(onStorageChanged);
        } catch { /* ignore */ }
        try {
          document.documentElement?.removeAttribute('data-kp-frame-agent');
        } catch { /* ignore */ }
      }
    };
  } catch (error) {
    console.warn('[KeyPilot] Failed to install frame click agent:', error);
    return null;
  }
}
