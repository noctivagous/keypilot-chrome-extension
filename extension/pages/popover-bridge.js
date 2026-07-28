// Popover iframe bridge for extension pages (chrome-extension://...).
// Content scripts do not run in these pages, so we implement the small subset needed
// for KeyPilot's popover container:
// - handshake (KP_POPOVER_BRIDGE_INIT / READY)
// - close key forwarding (Esc + quote + E)
// - scroll shortcuts and scroll commands (KP_POPOVER_SCROLL)

import { SCROLL } from '../src/config/constants.js';
import { MSG } from '../src/messaging/types.js';
import { isTypingContext, hasModifierKeys } from '../src/utils/dom-context.js';

try {
  let bridgeActive = false;
  let mouseInsideFrame = true;

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

  // Track whether the mouse is currently inside this iframe document.
  try {
    const setInside = (v) => { mouseInsideFrame = !!v; };
    document.addEventListener('mouseenter', () => setInside(true), true);
    document.addEventListener('mouseleave', () => setInside(false), true);
    if (document.documentElement) {
      document.documentElement.addEventListener('mouseenter', () => setInside(true), true);
      document.documentElement.addEventListener('mouseleave', () => setInside(false), true);
    }
  } catch {
    // ignore
  }

  window.addEventListener('message', (event) => {
    const data = event?.data;
    if (!data || typeof data.type !== 'string') return;

    if (data.type === MSG.POPOVER_BRIDGE_INIT) {
      bridgeActive = true;
      try {
        window.parent.postMessage({ type: MSG.POPOVER_BRIDGE_READY }, '*');
      } catch {
        // ignore
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
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!bridgeActive) return;
    if (hasModifierKeys(e)) return;

    const key = e.key;
    // Select counts as typing in extension pages (settings forms).
    const typing = isTypingContext(e.target, { treatSelectAsTyping: true });

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

    // F: when mouse is outside this iframe, forward to parent for close-button F-click.
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

    // Close keys.
    if (key === 'Escape') return requestClose();
    if (!typing && (key === "'" || key === 'e' || key === 'E')) return requestClose();

    // Scroll shortcuts (match KeyPilot): Z/X/C/V + B/N top/bottom (bridge historical mapping).
    if (typing) return;

    // Prefer live Settings from the KeyPilot instance when this extension page has one.
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

    if (key === 'z' || key === 'Z') {
      e.preventDefault();
      scrollByY(-pagePx, behavior);
    } else if (key === 'x' || key === 'X') {
      e.preventDefault();
      scrollByY(pagePx, behavior);
    } else if (key === 'c' || key === 'C') {
      e.preventDefault();
      scrollByY(-halfPx, behavior);
    } else if (key === 'v' || key === 'V') {
      e.preventDefault();
      scrollByY(halfPx, behavior);
    } else if (key === 'b' || key === 'B') {
      e.preventDefault();
      scrollToY(0, behavior);
    } else if (key === 'n' || key === 'N') {
      e.preventDefault();
      const height = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
      scrollToY(height, behavior);
    }
  }, true);
} catch (e) {
  console.warn('[KeyPilot] popover-bridge failed:', e);
}
