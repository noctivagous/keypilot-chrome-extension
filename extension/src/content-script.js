/**
 * Content script entry point (top frame — full KeyPilot).
 *
 * Child frames load `frame-agent-bundled.js` instead (see manifest).
 * When the service worker injects this bundle into a popover iframe, we still
 * initialize full KeyPilot there.
 */
import { KeyPilot } from './keypilot.js';
import { KeyPilotToggleHandler } from './modules/keypilot-toggle-handler.js';
import { OnboardingManager } from './modules/onboarding-manager.js';

/**
 * Initialize KeyPilot with toggle functionality.
 * Guarded against double-injection (e.g. popover re-INIT).
 */
async function initializeKeyPilot() {
  try {
    if (window.__KeyPilotToggleHandler || window.keyPilot) {
      return;
    }

    const keyPilot = new KeyPilot();

    // Store reference globally for debugging/metrics panels (used by OverlayManager debug panel)
    // Note: this is within the content-script isolated world; it is intended for KeyPilot internals.
    window.keyPilot = keyPilot;

    const toggleHandler = new KeyPilotToggleHandler(keyPilot);
    await toggleHandler.initialize();
    window.__KeyPilotToggleHandler = toggleHandler;
  } catch (error) {
    console.error('[KeyPilot] Failed to initialize with toggle functionality:', error);

    // Fallback: initialize KeyPilot without toggle functionality
    try {
      if (!window.keyPilot) {
        const keyPilot = new KeyPilot();
        window.keyPilot = keyPilot;
        console.warn('[KeyPilot] Initialized without toggle functionality as fallback');
      }
    } catch (fallbackError) {
      console.error('[KeyPilot] Complete initialization failure:', fallbackError);
    }
  }
}

const isTop = (() => {
  try {
    return window === window.top;
  } catch {
    return false;
  }
})();

const forceFullInFrame = (() => {
  try {
    return !!(window.__KP_POPOVER_IFRAME || window.__KP_FORCE_FULL_KEYPILOT);
  } catch {
    return false;
  }
})();

if (isTop) {
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
} else if (forceFullInFrame) {
  // Injected into a popover (or explicit force) child frame.
  void initializeKeyPilot();
}
