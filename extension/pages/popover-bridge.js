// Popover iframe bridge for extension pages (chrome-extension://...).
// Content scripts do not run in these pages, so we implement the small subset needed
// for KeyPilot's popover container:
// - handshake (KP_POPOVER_BRIDGE_INIT / READY)
// - close key forwarding (Esc + quote + E)
// - scroll shortcuts and scroll commands (KP_POPOVER_SCROLL)

(function () {
  try {
    let bridgeActive = false;
    let mouseInsideFrame = true;

    const hasModifierKeys = (e) => !!(e && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey));

    const isTypingContext = (target) => {
      if (!target) return false;
      const tag = target.tagName?.toLowerCase?.();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || !!target.isContentEditable;
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

    // Track whether the mouse is currently inside this iframe document.
    // When the user hovers the parent popover header/close button, the mouse leaves this frame.
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

      if (data.type === 'KP_POPOVER_BRIDGE_INIT') {
        bridgeActive = true;
        try {
          window.parent.postMessage({ type: 'KP_POPOVER_BRIDGE_READY' }, '*');
        } catch {
          // ignore
        }
        return;
      }

      if (!bridgeActive) return;

      if (data.type === 'KP_POPOVER_SCROLL') {
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
      const typing = isTypingContext(e.target);

      const requestClose = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          window.parent.postMessage({ type: 'KP_POPOVER_REQUEST_CLOSE', key }, '*');
        } catch {
          // ignore
        }
      };

      // F: when mouse is outside this iframe (e.g. over the parent popover header/close button),
      // forward F to the parent so it can click the close button (or close the popover).
      if (!typing && !mouseInsideFrame && (key === 'f' || key === 'F')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          window.parent.postMessage({ type: 'KP_POPOVER_BRIDGE_KEYDOWN', key }, '*');
        } catch {
          // ignore
        }
        return;
      }

      // Close keys.
      if (key === 'Escape') return requestClose();
      if (!typing && (key === "'" || key === 'e' || key === 'E')) return requestClose();

      // Scroll shortcuts (match KeyPilot): Z/X/C/V/B/N when not typing.
      if (typing) return;
      if (key === 'z' || key === 'Z') {
        e.preventDefault();
        scrollByY(-800, 'smooth');
      } else if (key === 'x' || key === 'X') {
        e.preventDefault();
        scrollByY(800, 'smooth');
      } else if (key === 'c' || key === 'C') {
        e.preventDefault();
        scrollByY(-400, 'smooth');
      } else if (key === 'v' || key === 'V') {
        e.preventDefault();
        scrollByY(400, 'smooth');
      } else if (key === 'b' || key === 'B') {
        e.preventDefault();
        scrollToY(0, 'smooth');
      } else if (key === 'n' || key === 'N') {
        e.preventDefault();
        const height = document.documentElement?.scrollHeight || document.body?.scrollHeight || 0;
        scrollToY(height, 'smooth');
      }
    }, true);
  } catch (e) {
    // ignore
    console.warn('[KeyPilot] popover-bridge failed:', e);
  }
})();


