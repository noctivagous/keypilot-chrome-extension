/**
 * Content script entry point
 */
import { KeyPilot } from './keypilot.js';
import { KeyPilotToggleHandler } from './modules/keypilot-toggle-handler.js';
import { OnboardingManager } from './modules/onboarding-manager.js';

/**
 * When running inside an iframe, we normally avoid initializing full KeyPilot.
 * For KeyPilot popover iframes, we use a bridge handshake from the parent to:
 * - keep Esc/E close working via postMessage
 * - optionally initialize full KeyPilot inside the iframe for the full cursor/overlay experience
 */
function setupPopoverIframeBridge() {
  try {
    // Only install in iframes
    if (window === window.top) return;

    // Only activate bridge behavior after parent explicitly initializes it.
    // This prevents interfering with random iframes on pages where KeyPilot isn't using a popover.
    let bridgeActive = false;
    let keyPilotStarted = false;
    let lastMouse = { x: null, y: null };
    let mouseInsideFrame = true;

    const isTypingContext = (target) => {
      if (!target) return false;
      const tag = target.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || target.isContentEditable;
    };

    const hasModifierKeys = (e) => e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;

    const updateMouse = (e) => {
      try {
        if (!e) return;
        if (typeof e.clientX === 'number') lastMouse.x = e.clientX;
        if (typeof e.clientY === 'number') lastMouse.y = e.clientY;
      } catch {
        // Ignore
      }
    };

    // Track mouse position so we can "F-click" links under the cursor inside the iframe.
    document.addEventListener('mousemove', updateMouse, true);
    document.addEventListener('pointermove', updateMouse, true);

    // Track whether the user's mouse is currently inside this iframe document.
    // If the mouse is outside (e.g. hovering the parent popover header/close button),
    // we can forward certain keys (like F) to the parent so it can act on them.
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

    const deepElementFromPoint = (x, y) => {
      try {
        let el = document.elementFromPoint(x, y);
        // Walk into open shadow roots, if present.
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

    const scrollByY = (deltaY, behavior = 'smooth') => {
      try {
        const el = document.scrollingElement || document.documentElement || document.body;
        if (el && typeof el.scrollBy === 'function') {
          el.scrollBy({ top: deltaY, behavior });
        } else {
          window.scrollBy({ top: deltaY, behavior });
        }
      } catch {
        // Ignore
      }
    };

    const scrollToY = (top, behavior = 'smooth') => {
      try {
        window.scrollTo({ top, behavior });
      } catch {
        // Ignore
      }
    };

    // Parent -> iframe bridge control (handshake + scroll commands)
    window.addEventListener('message', (event) => {
      const data = event?.data;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'KP_POPOVER_BRIDGE_INIT') {
        bridgeActive = true;
        // Ack so the parent can safely focus the iframe knowing close/scroll keys are bridged.
        try {
          window.parent.postMessage({ type: 'KP_POPOVER_BRIDGE_READY' }, '*');
        } catch {
          // Ignore
        }

        // Start full KeyPilot inside the popover iframe (one-time) for the same
        // cursor / overlay behavior as the top-level page.
        if (!keyPilotStarted) {
          keyPilotStarted = true;
          // Marker for debugging / future conditional behavior.
          try { window.__KP_POPOVER_IFRAME = true; } catch { }
          try {
            // Fire-and-forget; toggle handler will sync enabled state.
            initializeKeyPilot();
          } catch {
            // Ignore
          }
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
      const isEscape = key === 'Escape';
      const isE = key === 'e' || key === 'E';
      const isF = key === 'f' || key === 'F';

      // Always allow Escape to close.
      // Only treat "E" as close when not typing to avoid breaking text entry inside the iframe.
      if (isEscape || (isE && !isTypingContext(e.target))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          window.parent.postMessage({ type: 'KP_POPOVER_REQUEST_CLOSE', key }, '*');
        } catch {
          // Ignore
        }
        return;
      }

      // If the user's mouse is not inside the iframe (e.g. it's on the parent popover header/close),
      // forward F to the parent so it can click the close button (or close the popover).
      // We suppress the iframe's handling in this case to avoid accidental "F-click" inside the iframe.
      if (isF && !isTypingContext(e.target) && !mouseInsideFrame) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
          window.parent.postMessage({ type: 'KP_POPOVER_BRIDGE_KEYDOWN', key }, '*');
        } catch {
          // Ignore
        }
        return;
      }

      // F: click a link under the mouse cursor (when not typing).
      // This gives KeyPilot users a keyboard activation path inside popover iframes
      // before full KeyPilot starts inside the iframe.
      if (isF && !keyPilotStarted && !isTypingContext(e.target)) {
        let x = lastMouse.x;
        let y = lastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') {
          // Fallback to center of viewport if we haven't seen a mouse move yet.
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
            // Ignore
          }
        }
        return;
      }

      // Scroll shortcuts (match KeyPilot keybindings) when not typing:
      // Z: up, X: down, C: up (smaller), V: down (smaller), B: top, N: bottom
      if (isTypingContext(e.target)) return;

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
  } catch (error) {
    console.warn('[KeyPilot] Failed to install popover iframe bridge:', error);
  }
}

// Initialize KeyPilot with toggle functionality
async function initializeKeyPilot() {
  try {
    // Create KeyPilot instance
    const keyPilot = new KeyPilot();
    
    // Create toggle handler and wrap KeyPilot instance
    const toggleHandler = new KeyPilotToggleHandler(keyPilot);
    
    // Initialize toggle handler (queries service worker for state)
    await toggleHandler.initialize();
    
    // Store reference globally for debugging
    window.__KeyPilotToggleHandler = toggleHandler;
    
  } catch (error) {
    console.error('[KeyPilot] Failed to initialize with toggle functionality:', error);
    
    // Fallback: initialize KeyPilot without toggle functionality
    try {
      new KeyPilot();
      console.warn('[KeyPilot] Initialized without toggle functionality as fallback');
    } catch (fallbackError) {
      console.error('[KeyPilot] Complete initialization failure:', fallbackError);
    }
  }
}

// If inside an iframe, install the bridge and exit.
setupPopoverIframeBridge();

// Initialize KeyPilot only in the top frame.
if (window === window.top) {
  initializeKeyPilot();

  // Initialize onboarding walkthrough (top-level only).
  try {
    const onboarding = new OnboardingManager();
    onboarding.init(); // async; fire-and-forget
    window.__KeyPilotOnboarding = onboarding;
  } catch (e) {
    console.warn('[KeyPilot] Failed to initialize onboarding:', e);
  }
}