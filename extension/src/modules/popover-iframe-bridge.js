/**
 * Shared popover iframe bridge (parent ↔ iframe postMessage).
 *
 * Used by:
 * - content-script.js (page iframes inside KeyPilot popovers; may start full KeyPilot)
 * - pages/popover-bridge.js (chrome-extension:// pages; no content-script injection)
 *
 * Handshake: POPOVER_BRIDGE_INIT → POPOVER_BRIDGE_READY
 * Parent commands: POPOVER_SCROLL
 * Child → parent: POPOVER_REQUEST_CLOSE, POPOVER_BRIDGE_KEYDOWN
 */
import { SCROLL } from '../config/constants.js';
import { MSG } from '../messaging/types.js';
import { isTypingContext, hasModifierKeys } from '../utils/dom-context.js';
import { scrollAtPoint } from '../utils/scroll-at-point.js';

/**
 * @typedef {object} PopoverIframeBridgeOptions
 * @property {boolean} [treatSelectAsTyping=false] - extension pages with <select> controls
 * @property {boolean} [closeOnQuote=false] - also treat `'` as close (extension pages)
 * @property {boolean} [enableFClickBeforeKeyPilot=false] - F-activate link before full KP starts
 * @property {() => void} [onBridgeInit] - called once when parent sends INIT (e.g. start KeyPilot)
 * @property {(err: unknown) => void} [onError]
 */

/**
 * Install the popover iframe bridge if this window is an iframe (or always when
 * `force` is implied by caller for extension pages that always run as iframe content).
 *
 * @param {PopoverIframeBridgeOptions} [options]
 * @returns {{ dispose: () => void }|null}
 */
export function installPopoverIframeBridge(options = {}) {
  const {
    treatSelectAsTyping = false,
    closeOnQuote = false,
    enableFClickBeforeKeyPilot = false,
    onBridgeInit = null,
    onError = null
  } = options;

  try {
    let bridgeActive = false;
    let keyPilotStarted = false;
    let mouseInsideFrame = true;
    let lastMouse = { x: null, y: null };
    // Close keys from parent INIT (defaults cover open-popover P + link-preview E).
    /** @type {Set<string>} */
    let closeKeySet = new Set(['Escape', 'e', 'E', 'p', 'P']);

    const scrollByY = (deltaY, behavior = 'smooth') => {
      try {
        const el = document.scrollingElement || document.documentElement || document.body;
        if (el && typeof el.scrollBy === 'function') {
          el.scrollBy({ top: deltaY, behavior });
        } else {
          window.scrollBy({ top: deltaY, behavior });
        }
      } catch {
        // ignore
      }
    };

    const scrollToY = (top, behavior = 'smooth') => {
      try {
        window.scrollTo({ top, behavior });
      } catch {
        // ignore
      }
    };

    const deepElementFromPoint = (x, y) => {
      try {
        let el = document.elementFromPoint(x, y);
        while (el && el.shadowRoot && typeof el.shadowRoot.elementFromPoint === 'function') {
          const inner = el.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === el) break;
          el = inner;
        }
        return el;
      } catch {
        return null;
      }
    };

    const updateMouse = (e) => {
      try {
        if (!e) return;
        if (typeof e.clientX === 'number') lastMouse.x = e.clientX;
        if (typeof e.clientY === 'number') lastMouse.y = e.clientY;
      } catch {
        // ignore
      }
    };

    const setInside = (v) => {
      mouseInsideFrame = !!v;
    };

    const typingAt = (target) =>
      isTypingContext(target, treatSelectAsTyping ? { treatSelectAsTyping: true } : undefined);

    const resolveScrollParams = () => {
      const kp = window.__KeyPilotInstance;
      const pagePx = (typeof kp?._getPageScrollPx === 'function')
        ? kp._getPageScrollPx()
        : SCROLL.PAGE_PX;
      const halfPx = (typeof kp?._getHalfPageScrollPx === 'function')
        ? kp._getHalfPageScrollPx()
        : SCROLL.HALF_PAGE_PX;
      const behavior = (typeof kp?._getScrollBehavior === 'function')
        ? kp._getScrollBehavior()
        : (SCROLL.BEHAVIOR || 'smooth');
      return { pagePx, halfPx, behavior };
    };

    const onMessage = (event) => {
      const data = event?.data;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === MSG.POPOVER_BRIDGE_INIT) {
        bridgeActive = true;
        // Parent can pass layout-aware close keys (e.g. E for preview, P for open-popover).
        try {
          if (Array.isArray(data.closeKeys) && data.closeKeys.length) {
            closeKeySet = new Set(data.closeKeys.map(String));
            // Always allow Escape even if omitted.
            closeKeySet.add('Escape');
          }
        } catch { /* ignore */ }
        // Expose for in-frame KeyPilot (may register keydown after us and win capture order).
        try {
          window.__KP_POPOVER_IFRAME = true;
          window.__KP_POPOVER_CLOSE_KEYS = Array.from(closeKeySet);
        } catch { /* ignore */ }
        try {
          window.parent.postMessage({ type: MSG.POPOVER_BRIDGE_READY }, '*');
        } catch {
          // ignore
        }

        if (typeof onBridgeInit === 'function' && !keyPilotStarted) {
          keyPilotStarted = true;
          try {
            onBridgeInit();
          } catch {
            // ignore
          }
        }
        return;
      }

      if (!bridgeActive) return;

      if (data.type === MSG.POPOVER_SCROLL) {
        const behavior = data.behavior === 'auto' ? 'auto' : 'smooth';
        if (data.command === 'scrollBy') {
          const delta = Number(data.delta) || 0;
          scrollByY(delta, behavior);
        } else if (data.command === 'scrollToTop') {
          scrollToY(0, behavior);
        } else if (data.command === 'scrollToBottom') {
          const height = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
          scrollToY(height, behavior);
        }
      }
    };

    const onKeyDown = (e) => {
      if (!bridgeActive) return;
      if (hasModifierKeys(e)) return;

      const key = e.key;
      const typing = typingAt(e.target);

      const requestClose = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          window.parent.postMessage({ type: MSG.POPOVER_REQUEST_CLOSE, key }, '*');
        } catch {
          // ignore
        }
      };

      // F outside iframe → parent (e.g. close button on chrome).
      if (!typing && !mouseInsideFrame && (key === 'f' || key === 'F')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          window.parent.postMessage({ type: MSG.POPOVER_BRIDGE_KEYDOWN, key }, '*');
        } catch {
          // ignore
        }
        return;
      }

      // Close keys from parent (Esc + open/preview toggle keys). Capture-phase so
      // in-frame KeyPilot does not steal E/P for nested actions before we close.
      if (!typing && closeKeySet.has(key)) return requestClose();
      if (key === 'Escape') return requestClose();
      if (closeOnQuote && !typing && key === "'") return requestClose();

      // Pre-KeyPilot F: click link under cursor inside the iframe.
      if (
        enableFClickBeforeKeyPilot &&
        !keyPilotStarted &&
        !typing &&
        (key === 'f' || key === 'F')
      ) {
        let x = lastMouse.x;
        let y = lastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
          x = Math.floor(window.innerWidth / 2);
          y = Math.floor(window.innerHeight / 2);
        }

        const target = deepElementFromPoint(x, y);
        const link = target?.closest?.('a[href]') || null;
        if (link) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          try {
            link.click();
          } catch {
            // ignore
          }
        }
        return;
      }

      if (typing) return;

      const { pagePx, halfPx, behavior } = resolveScrollParams();

      // Historical bridge mapping (Z/X page, C/V half, B/N top/bottom).
      if (key === 'z' || key === 'Z') {
        e.preventDefault();
        scrollByY(-pagePx, behavior);
      } else if (key === 'x' || key === 'X') {
        e.preventDefault();
        scrollByY(pagePx, behavior);
      } else if (key === 'c' || key === 'C' || key === 'v' || key === 'V') {
        // Nested overflow under the cursor first; page fallback (same as top-frame C/V).
        e.preventDefault();
        let mx = lastMouse.x;
        let my = lastMouse.y;
        if (typeof mx !== 'number' || typeof my !== 'number') {
          mx = Math.floor(window.innerWidth / 2);
          my = Math.floor(window.innerHeight / 2);
        }
        const sign = (key === 'c' || key === 'C') ? -1 : 1;
        scrollAtPoint(mx, my, sign, halfPx, behavior);
      } else if (key === 'b' || key === 'B') {
        e.preventDefault();
        scrollToY(0, behavior);
      } else if (key === 'n' || key === 'N') {
        e.preventDefault();
        const height = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
        scrollToY(height, behavior);
      }
    };

    // Mouse tracking (needed for F-click before KP and inside/outside detection).
    document.addEventListener('mousemove', updateMouse, true);
    document.addEventListener('pointermove', updateMouse, true);
    document.addEventListener('mouseenter', () => setInside(true), true);
    document.addEventListener('mouseleave', () => setInside(false), true);
    try {
      if (document.documentElement) {
        document.documentElement.addEventListener('mouseenter', () => setInside(true), true);
        document.documentElement.addEventListener('mouseleave', () => setInside(false), true);
      }
    } catch {
      // ignore
    }

    window.addEventListener('message', onMessage, true);
    document.addEventListener('keydown', onKeyDown, true);

    return {
      dispose() {
        try {
          window.removeEventListener('message', onMessage, true);
          document.removeEventListener('keydown', onKeyDown, true);
          document.removeEventListener('mousemove', updateMouse, true);
          document.removeEventListener('pointermove', updateMouse, true);
        } catch {
          // ignore
        }
      }
    };
  } catch (error) {
    if (typeof onError === 'function') {
      try {
        onError(error);
      } catch {
        // ignore
      }
    } else {
      console.warn('[KeyPilot] Failed to install popover iframe bridge:', error);
    }
    return null;
  }
}
