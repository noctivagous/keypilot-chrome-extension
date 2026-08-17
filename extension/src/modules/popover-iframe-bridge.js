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
 *
 * Scroll keys come from INIT (`scrollKeys`) so custom layouts are honored.
 * Once full KeyPilot is running in this frame, the bridge does not handle
 * scroll keys — otherwise C/V would still fire the old Page Down mapping.
 */
import { SCROLL } from '../config/constants.js';
import { MSG } from '../messaging/types.js';
import { isTypingContext, hasModifierKeys } from '../utils/dom-context.js';
import { scrollAtPoint, scrollToEdgeAtPoint, findScrollTargetAtPoint, scrollElementBy } from '../utils/scroll-at-point.js';
import { ScrollHoldController } from '../utils/scroll-hold.js';
import { deepElementFromPoint as pierceElementFromPoint } from '../utils/element-from-point.js';
import {
  DEFAULT_POPOVER_SCROLL_KEYS,
  normalizePopoverScrollKeys,
  popoverScrollKeyMatches
} from './popover-bridge-init.js';

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
    let lastPointerPostedX = NaN;
    let lastPointerPostedY = NaN;
    let pointerSyncRaf = 0;
    // Close keys from parent INIT (defaults cover open-popover P + link-preview E).
    /** @type {Set<string>} */
    let closeKeySet = new Set(['Escape', 'e', 'E', 'p', 'P']);
    // Scroll keys from parent INIT (layout / custom slots). Defaults match
    // right-handed built-in until the first INIT arrives.
    let scrollKeys = DEFAULT_POPOVER_SCROLL_KEYS;
    /** @type {{ el: Element, axis: 'x'|'y' }|null} */
    let scrollHoldLock = null;
    const scrollHold = new ScrollHoldController({
      apply: ({ deltaPx, target }) => {
        const t = target || scrollHoldLock;
        if (!t?.el) return;
        const axis = t.axis === 'x' ? 'x' : 'y';
        scrollElementBy(t.el, axis === 'x' ? deltaPx : 0, axis === 'y' ? deltaPx : 0, 'auto');
      }
    });

    const fullKeyPilotPresent = () => {
      try {
        return !!(window.keyPilot || window.__KeyPilotInstance || window.__KeyPilotToggleHandler);
      } catch {
        return false;
      }
    };

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

    const deepElementFromPoint = (x, y) => pierceElementFromPoint(x, y);

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
      const next = !!v;
      if (mouseInsideFrame && !next) postPointerToParent(false);
      mouseInsideFrame = next;
    };

    /**
     * Keep top-frame lastMouse fresh. Extension pages have no frame-agent /
     * content-script KeyPilot, so parent mousemove is silent over this iframe.
     * @param {boolean} inside
     * @param {number} [clientX]
     * @param {number} [clientY]
     */
    const postPointerToParent = (inside, clientX, clientY) => {
      if (fullKeyPilotPresent()) return;
      try {
        if (inside) {
          const x = Number(clientX);
          const y = Number(clientY);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          if (
            Math.abs(x - lastPointerPostedX) < 0.5 &&
            Math.abs(y - lastPointerPostedY) < 0.5
          ) {
            return;
          }
          lastPointerPostedX = x;
          lastPointerPostedY = y;
          window.parent.postMessage({
            type: MSG.FRAME_POINTER,
            inside: true,
            clientX: x,
            clientY: y
          }, '*');
        } else {
          lastPointerPostedX = NaN;
          lastPointerPostedY = NaN;
          window.parent.postMessage({
            type: MSG.FRAME_POINTER,
            inside: false
          }, '*');
        }
      } catch {
        // ignore
      }
    };

    const schedulePointerSync = () => {
      if (pointerSyncRaf) return;
      pointerSyncRaf = requestAnimationFrame(() => {
        pointerSyncRaf = 0;
        try {
          if (!mouseInsideFrame || fullKeyPilotPresent()) return;
          const x = lastMouse.x;
          const y = lastMouse.y;
          if (typeof x !== 'number' || typeof y !== 'number') return;
          postPointerToParent(true, x, y);
        } catch {
          // ignore
        }
      });
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
          const nextScroll = normalizePopoverScrollKeys(data.scrollKeys);
          if (nextScroll) scrollKeys = nextScroll;
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

      // F: parent KeyPilot activates (titlebar ×, or same-origin iframe chrome
      // such as Settings/Docs tabs). Skip when full in-frame KeyPilot owns F.
      if (!typing && (key === 'f' || key === 'F')) {
        const forwardToParent = !mouseInsideFrame || !fullKeyPilotPresent();
        if (forwardToParent) {
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
      }

      // Close keys from parent (Esc + open/preview toggle keys). Capture-phase so
      // in-frame KeyPilot does not steal E/P for nested actions before we close.
      if (!typing && closeKeySet.has(key)) return requestClose();
      if (!typing && key === 'Escape') return requestClose();
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

      // Full in-frame KeyPilot owns layout-aware scroll + Scroll Line. Handling
      // keys here as well double-fires the old C/V Page Down mapping.
      if (fullKeyPilotPresent()) return;

      const { pagePx, halfPx, behavior } = resolveScrollParams();

      const cursorPoint = () => {
        let mx = lastMouse.x;
        let my = lastMouse.y;
        if (typeof mx !== 'number' || typeof my !== 'number') {
          mx = Math.floor(window.innerWidth / 2);
          my = Math.floor(window.innerHeight / 2);
        }
        return { mx, my };
      };

      const applyHeldScroll = (sign, stepPx) => {
        const s = sign < 0 ? -1 : 1;
        if (e.repeat) {
          scrollHold.noteRepeat(key, s);
          return;
        }
        const { mx, my } = cursorPoint();
        const found = findScrollTargetAtPoint(mx, my, s);
        const el = found?.el || document.scrollingElement || document.documentElement || document.body;
        const axis = found?.axis || 'y';
        scrollAtPoint(mx, my, s, stepPx, behavior);
        scrollHoldLock = el ? { el, axis } : null;
        const base = Number(SCROLL.HOLD_PX_PER_SEC);
        const speed = Math.max(600, Math.min(2400, stepPx * 2.8));
        scrollHold.begin({
          key,
          sign: s,
          target: scrollHoldLock,
          speedPxPerSec: Number.isFinite(speed) ? speed : (base || 1400)
        });
      };

      if (popoverScrollKeyMatches(scrollKeys, 'pageUp', key)) {
        e.preventDefault();
        applyHeldScroll(-1, pagePx);
      } else if (popoverScrollKeyMatches(scrollKeys, 'pageDown', key)) {
        e.preventDefault();
        applyHeldScroll(1, pagePx);
      } else if (popoverScrollKeyMatches(scrollKeys, 'pageUpInstant', key)) {
        e.preventDefault();
        applyHeldScroll(-1, halfPx);
      } else if (popoverScrollKeyMatches(scrollKeys, 'pageDownInstant', key)) {
        e.preventDefault();
        applyHeldScroll(1, halfPx);
      } else if (popoverScrollKeyMatches(scrollKeys, 'pageTop', key)) {
        e.preventDefault();
        const { mx, my } = cursorPoint();
        scrollToEdgeAtPoint(mx, my, -1, behavior);
      } else if (popoverScrollKeyMatches(scrollKeys, 'pageBottom', key)) {
        e.preventDefault();
        const { mx, my } = cursorPoint();
        scrollToEdgeAtPoint(mx, my, 1, behavior);
      }
    };

    const onMouseMove = (e) => {
      updateMouse(e);
      schedulePointerSync();
    };

    const onKeyUp = (e) => {
      try {
        scrollHold.end(e?.key);
        if (!scrollHold.active) scrollHoldLock = null;
      } catch { /* ignore */ }
    };

    // Mouse tracking (needed for F-click before KP and inside/outside detection).
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('pointermove', onMouseMove, true);
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
    document.addEventListener('keyup', onKeyUp, true);

    return {
      dispose() {
        try {
          window.removeEventListener('message', onMessage, true);
          document.removeEventListener('keydown', onKeyDown, true);
          document.removeEventListener('keyup', onKeyUp, true);
          document.removeEventListener('mousemove', onMouseMove, true);
          document.removeEventListener('pointermove', onMouseMove, true);
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
