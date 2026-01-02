/**
 * KeyPilotToggleHandler - Manages global toggle functionality for KeyPilot
 * Wraps the KeyPilot instance and provides enable/disable control
 */
import { EventManager } from './event-manager.js';
import { COLORS, Z_INDEX } from '../config/constants.js';

export class KeyPilotToggleHandler extends EventManager {
  constructor(keyPilotInstance) {
    super();
    
    this.keyPilot = keyPilotInstance;
    this.enabled = true;
    this.initialized = false;
    this.globalToggleKeyHandler = null;
    
    // Store original methods for restoration
    this.originalMethods = {
      handleKeyDown: null,
      handleMouseMove: null,
      handleScroll: null
    };
  }

  /**
   * Initialize the toggle handler
   * Queries service worker for current state and sets up message listener
   */
  async initialize() {
    try {
      // Query service worker for current extension state
      const response = await chrome.runtime.sendMessage({ type: 'KP_GET_STATE' });
      
      if (response && typeof response.enabled === 'boolean') {
        this.setEnabled(response.enabled, false); // Don't show notification during initialization
      } else {
        // Default to enabled if no response or invalid response
        this.setEnabled(true, false); // Don't show notification during initialization
      }
    } catch (error) {
      console.warn('[KeyPilotToggleHandler] Failed to query service worker state:', error);
      // Default to enabled on communication failure
      this.setEnabled(true, false); // Don't show notification during initialization
    }

    // Set up message listener for toggle state changes from service worker
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'KP_TOGGLE_STATE') {
        this.setEnabled(message.enabled); // Show notification for user-initiated toggles
        sendResponse({ success: true });
      }
    });

    // Always-on toggle hotkey: when KeyPilot is disabled it won't have key listeners installed,
    // so we must keep a separate listener that can re-enable it.
    // Use capture so it works regardless of focused element.
    this.globalToggleKeyHandler = (e) => {
      try {
        // Avoid double-toggling if another handler already processed this event.
        if (e && e.__kpToggleHandled) return;

        // Alt+K (case-insensitive). e.code==='AltRight' is not needed here; we rely on e.altKey.
        if (e && e.altKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
          e.__kpToggleHandled = true;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'KP_TOGGLE_STATE' }).catch(() => {
              // Ignore errors if background script is not available
            });
          }
        }
      } catch {
        // Ignore
      }
    };
    document.addEventListener('keydown', this.globalToggleKeyHandler, { capture: true });

    this.initialized = true;
  }

  /**
   * Enable or disable KeyPilot functionality
   * @param {boolean} enabled - Whether KeyPilot should be enabled
   * @param {boolean} showNotification - Whether to show toggle notification (default: true)
   */
  async setEnabled(enabled, showNotification = true) {
    if (this.enabled === enabled) {
      return; // No change needed
    }

    // Sync with early injection cursor immediately
    if (window.KEYPILOT_EARLY) {
      window.KEYPILOT_EARLY.setEnabled(enabled);
    }

    this.enabled = enabled;

    // Emit a semantic action for onboarding / telemetry consumers.
    try {
      document.dispatchEvent(new CustomEvent('keypilot:action', {
        detail: {
          action: 'toggleExtension',
          enabled: !!enabled,
          timestamp: Date.now()
        }
      }));
    } catch {
      // ignore
    }

    if (enabled) {
      await this.enableKeyPilot();
    } else {
      this.disableKeyPilot();
    }

    // Show notification to user only if requested
    if (showNotification) {
      this.showToggleNotification(enabled);
    }
  }

  /**
   * Enable KeyPilot functionality
   * Restores event listeners, CSS styles, and visual elements
   */
  async enableKeyPilot() {
    if (!this.keyPilot) return;

    try {
      // If we previously disabled via this handler, we may have fully cleaned up the
      // OverlayManager (including tearing down the canvas renderer). Re-enable must
      // explicitly revive the overlay renderer; otherwise hover rectangles won't draw
      // even though key events work.

      // Restore all CSS styles first
      if (this.keyPilot.styleManager) {
        try {
          this.keyPilot.styleManager.restoreAllStyles();
        } catch (error) {
          console.warn('[KeyPilotToggleHandler] Cannot restore styles on this page:', error.message);
        }
      }

      // Restore event listeners
      try {
        this.keyPilot.start();
      } catch (error) {
        console.warn('[KeyPilotToggleHandler] Cannot start event listeners on this page:', error.message);
        // On chrome:// pages, continue with limited functionality
      }

      // Ensure cursor is visible
      if (this.keyPilot.cursor) {
        try {
          this.keyPilot.cursor.ensure();
          // Explicitly show cursor after ensuring it exists
          this.keyPilot.cursor.show();
        } catch (error) {
          console.warn('[KeyPilotToggleHandler] Cannot show cursor on this page:', error.message);
        }
      }

      // Restore focus detector
      if (this.keyPilot.focusDetector) {
        try {
          this.keyPilot.focusDetector.start();
        } catch (error) {
          console.warn('[KeyPilotToggleHandler] Cannot start focus detector on this page:', error.message);
        }
      }

      // Restore intersection manager
      if (this.keyPilot.intersectionManager) {
        try {
          await this.keyPilot.intersectionManager.init();
        } catch (error) {
          console.warn('[KeyPilotToggleHandler] Cannot initialize intersection manager on this page:', error.message);
        }
      }

      // Restore scroll manager
      if (this.keyPilot.scrollManager) {
        try {
          this.keyPilot.scrollManager.init();
        } catch (error) {
          console.warn('[KeyPilotToggleHandler] Cannot initialize scroll manager on this page:', error.message);
        }
      }

      // Restore overlay manager + rendering backend (canvas/DOM/etc.)
      if (this.keyPilot.overlayManager) {
        try {
          // Recreate the overlay observer (it is disconnected + nulled in overlayManager.cleanup()).
          this.keyPilot.overlayManager.setupOverlayObserver();
          // Re-init highlight manager with the new observer.
          if (this.keyPilot.overlayManager.highlightManager) {
            this.keyPilot.overlayManager.highlightManager.initialize(this.keyPilot.overlayManager.overlayObserver);
          }
          // Re-init the active renderer (canvas overlay element, CSS custom props, etc.)
          this.keyPilot.overlayManager.initRenderingMode();
          // Debug panel (if enabled) lives inside overlay manager
          this.keyPilot.overlayManager.initDebugPanel?.();
        } catch (error) {
          console.warn('[KeyPilotToggleHandler] Cannot restore overlays on this page:', error.message);
        }
      }

      // Force an immediate hover refresh so the green rectangle reappears without requiring
      // the user to move the mouse past the threshold gate.
      try {
        const st = this.keyPilot.state?.getState?.();
        const x = Number(st?.lastMouse?.x);
        const y = Number(st?.lastMouse?.y);
        if (Number.isFinite(x) && Number.isFinite(y) && (x !== 0 || y !== 0)) {
          this.keyPilot.updateElementsUnderCursor?.(x, y, false, null);
        }
      } catch { /* ignore */ }

      // Restore floating keyboard reference (state is persisted in storage)
      try {
        this.keyPilot.refreshKeyboardHelpVisibilityFromStorage?.();
      } catch {
        // Ignore
      }

      console.log('[KeyPilotToggleHandler] KeyPilot enabled');
    } catch (error) {
      console.error('[KeyPilotToggleHandler] Error enabling KeyPilot:', error);
      // Continue with partial functionality even if some components fail
    }
  }

  /**
   * Disable KeyPilot functionality
   * Removes event listeners, CSS styles, and all visual elements
   */
  disableKeyPilot() {
    if (!this.keyPilot) return;

    try {
      // Stop event listeners first
      this.keyPilot.stop();

      // Remove the floating keyboard reference widget, if present
      if (this.keyPilot.floatingKeyboardHelp) {
        try {
          this.keyPilot.floatingKeyboardHelp.cleanup();
        } catch {
          // Ignore cleanup errors
        }
        this.keyPilot.floatingKeyboardHelp = null;
      }

      // Clean up cursor completely (remove from DOM)
      if (this.keyPilot.cursor) {
        this.keyPilot.cursor.cleanup();
      }

      // Stop focus detector
      if (this.keyPilot.focusDetector) {
        this.keyPilot.focusDetector.stop();
      }

      // Clean up overlays completely
      if (this.keyPilot.overlayManager) {
        this.keyPilot.overlayManager.cleanup();
      }

      // Clean up intersection manager
      if (this.keyPilot.intersectionManager) {
        this.keyPilot.intersectionManager.cleanup();
      }

      // Clean up scroll manager
      if (this.keyPilot.scrollManager) {
        this.keyPilot.scrollManager.cleanup();
      }

      // Reset state to normal mode
      if (this.keyPilot.state) {
        this.keyPilot.state.reset();
      }

      // Remove ALL CSS styles and classes - this is the critical fix
      if (this.keyPilot.styleManager) {
        this.keyPilot.styleManager.removeAllStyles();
      }

      console.log('[KeyPilotToggleHandler] KeyPilot disabled - all styles and elements removed');
    } catch (error) {
      console.error('[KeyPilotToggleHandler] Error disabling KeyPilot:', error);
      // Continue with cleanup even if some components fail
    }
  }

  /**
   * Show toggle notification to user
   * @param {boolean} enabled - Whether KeyPilot was enabled or disabled
   */
  showToggleNotification(enabled) {
    // Create notification overlay
    const notification = document.createElement('div');
    notification.className = 'kpv2-toggle-notification';
    notification.textContent = enabled ? 'KeyPilot Enabled' : 'KeyPilot Disabled';
    
    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: enabled ? COLORS.NOTIFICATION_SUCCESS : COLORS.NOTIFICATION_ERROR,
      color: 'white',
      padding: '12px 24px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      zIndex: String(Z_INDEX.NOTIFICATION),
      boxShadow: `0 4px 12px ${COLORS.NOTIFICATION_SHADOW}`,
      opacity: '0',
      transition: 'opacity 0.3s ease-in-out',
      pointerEvents: 'none'
    });

    // Add to document
    document.body.appendChild(notification);

    // Animation removed - show immediately
    notification.style.opacity = '1';

    // Remove after 2 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2000);
  }

  /**
   * Get current enabled state
   * @returns {boolean} Whether KeyPilot is currently enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Clean up the toggle handler
   */
  cleanup() {
    // Remove message listeners
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.removeListener(this.handleMessage);
    }

    // Remove global toggle hotkey listener
    if (this.globalToggleKeyHandler) {
      try {
        document.removeEventListener('keydown', this.globalToggleKeyHandler, { capture: true });
      } catch {
        // Ignore
      }
      this.globalToggleKeyHandler = null;
    }

    // Clean up KeyPilot if disabled
    if (!this.enabled && this.keyPilot) {
      this.keyPilot.cleanup();
    }
  }
}