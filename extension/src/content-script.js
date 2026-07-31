/**
 * Content script entry point
 */
import { KeyPilot } from './keypilot.js';
import { KeyPilotToggleHandler } from './modules/keypilot-toggle-handler.js';
import { OnboardingManager } from './modules/onboarding-manager.js';
import { installPopoverIframeBridge } from './modules/popover-iframe-bridge.js';

/**
 * When running inside an iframe, we normally avoid initializing full KeyPilot.
 * For KeyPilot popover iframes, we use a bridge handshake from the parent to:
 * - keep Esc/P close working via postMessage
 * - optionally initialize full KeyPilot inside the iframe for the full cursor/overlay experience
 */
function setupPopoverIframeBridge() {
  try {
    // Only install in iframes
    if (window === window.top) return;

    installPopoverIframeBridge({
      enableFClickBeforeKeyPilot: true,
      onBridgeInit: () => {
        // Marker for debugging / future conditional behavior.
        try { window.__KP_POPOVER_IFRAME = true; } catch { /* ignore */ }
        try {
          // Fire-and-forget; toggle handler will sync enabled state.
          initializeKeyPilot();
        } catch {
          // ignore
        }
      },
      onError: (error) => {
        console.warn('[KeyPilot] Failed to install popover iframe bridge:', error);
      }
    });
  } catch (error) {
    console.warn('[KeyPilot] Failed to install popover iframe bridge:', error);
  }
}

// Initialize KeyPilot with toggle functionality
async function initializeKeyPilot() {
  try {
    // Create KeyPilot instance
    const keyPilot = new KeyPilot();

    // Store reference globally for debugging/metrics panels (used by OverlayManager debug panel)
    // Note: this is within the content-script isolated world; it is intended for KeyPilot internals.
    window.keyPilot = keyPilot;
    
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
      const keyPilot = new KeyPilot();
      window.keyPilot = keyPilot;
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
  (async () => {
    // Ensure we query the service worker toggle state before onboarding decides whether it can show.
    // This prevents the onboarding walkthrough from briefly appearing on new tabs when KeyPilot is OFF.
    await initializeKeyPilot();

    // Initialize onboarding walkthrough (top-level only).
    try {
      const onboarding = new OnboardingManager();
      await onboarding.init();
      window.__KeyPilotOnboarding = onboarding;
    } catch (e) {
      console.warn('[KeyPilot] Failed to initialize onboarding:', e);
    }
  })();
}
