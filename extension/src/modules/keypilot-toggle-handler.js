/**
 * KeyPilotToggleHandler - Manages global toggle functionality for KeyPilot
 * Wraps the KeyPilot instance and provides enable/disable control
 */
import { EventManager } from './event-manager.js';
import { COLORS, Z_INDEX } from '../config/constants.js';
import { applyFlashNotificationStyle } from '../ui/nct-dark-ui.js';
import { ensureOpenChromeShadow } from '../ui/kp-chrome-shadow.js';
import { MSG } from '../messaging/types.js';
import {
  installContentRuntimeRouter,
  registerContentRuntimeHandler
} from '../messaging/content-runtime-router.js';

export class KeyPilotToggleHandler extends EventManager {
  constructor(keyPilotInstance) {
    super();
    
    this.keyPilot = keyPilotInstance;
    this.enabled = true;
    this.initialized = false;
    this.globalToggleKeyHandler = null;
    this.ENABLED_STORAGE_KEY = 'keypilot_enabled';
    this._onRuntimeMessage = this._onRuntimeMessage.bind(this);
    this._onStorageChanged = this._onStorageChanged.bind(this);
    
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
      const response = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
      
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

    // Broadcast path: service worker → tabs.sendMessage(TOGGLE_STATE / UPDATE_STATE).
    try {
      installContentRuntimeRouter();
      this._runtimeDisposers = [
        registerContentRuntimeHandler(MSG.TOGGLE_STATE, this._onRuntimeMessage),
        registerContentRuntimeHandler(MSG.UPDATE_STATE, this._onRuntimeMessage)
      ];
    } catch {
      // ignore
    }

    // Storage path: keypilot_enabled is the cross-tab source of truth when messages miss
    // (bfcache, sleeping tabs, race with content-script load).
    try {
      if (chrome?.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener(this._onStorageChanged);
      }
    } catch {
      // ignore
    }

    // Always-on hotkeys: when KeyPilot is disabled it won't have key listeners installed,
    // so we keep a separate capture listener for re-enable and control-strip restore.
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
            chrome.runtime.sendMessage({ type: MSG.TOGGLE_STATE }).catch(() => {
              // Ignore errors if background script is not available
            });
          }
          return;
        }

        // Alt+J: toggle control strip (works while KeyPilot is disabled).
        if (e && e.altKey && (e.key === 'j' || e.key === 'J' || e.code === 'KeyJ')) {
          if (e.__kpControlStripHandled) return;
          e.__kpControlStripHandled = true;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          try {
            const kp = this.keyPilot;
            if (typeof kp?.toggleControlStripFromHotkey === 'function') {
              kp.toggleControlStripFromHotkey();
            } else {
              kp?.showControlStripFromHotkey?.();
            }
          } catch {
            // Ignore
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
   * @param {any} message
   * @param {chrome.runtime.MessageSender} _sender
   * @param {(response?: any) => void} sendResponse
   */
  _onRuntimeMessage(message, _sender, sendResponse) {
    try {
      // Broadcast from SW includes `enabled`. Ignore bare toggle *requests* (no enabled)
      // that are only meant for the service worker.
      if (message?.type === MSG.TOGGLE_STATE || message?.type === MSG.UPDATE_STATE) {
        if (typeof message.enabled === 'boolean') {
          // TOGGLE_STATE is the user-facing broadcast (Alt+K, strip, popup).
          // UPDATE_STATE is the same write from ContentScriptManager — no second toast.
          // Storage often applies first, so setEnabled may no-op; still toast on TOGGLE_STATE.
          const showNotification = message.type === MSG.TOGGLE_STATE;
          void this.setEnabled(message.enabled, showNotification);
          try { sendResponse({ success: true }); } catch { /* ignore */ }
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * @param {Record<string, chrome.storage.StorageChange>} changes
   * @param {string} area
   */
  _onStorageChanged(changes, area) {
    try {
      if (area !== 'sync' && area !== 'local') return;
      if (!changes || !Object.prototype.hasOwnProperty.call(changes, this.ENABLED_STORAGE_KEY)) return;
      const entry = changes[this.ENABLED_STORAGE_KEY];
      const next = entry?.newValue;
      if (typeof next !== 'boolean') return;
      // Storage is the durable cross-tab source of truth; no toast (message path may toast).
      void this.setEnabled(next, false);
    } catch {
      // ignore
    }
  }

  /**
   * Keep the control strip On/Off segment aligned with extension state.
   * Safe when the strip is not yet constructed (no-op).
   * @param {boolean} enabled
   */
  _syncControlStripEnabled(enabled) {
    try {
      const on = !!enabled;
      this.keyPilot?.controlStrip?.setEnabledState?.(on);
      if (!on) {
        this.keyPilot?.controlStrip?.setKeyboardHelpActive?.(false);
      } else {
        this.keyPilot?.controlStrip?.setKeyboardHelpActive?.(!!this.keyPilot?._keyboardHelpVisible);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Enable or disable KeyPilot functionality
   * @param {boolean} enabled - Whether KeyPilot should be enabled
   * @param {boolean} showNotification - Whether to show toggle notification (default: true)
   */
  async setEnabled(enabled, showNotification = true) {
    const next = !!enabled;

    // Always refresh the control strip indicator (even if functional state is unchanged)
    // so late-created strips and other-tab storage races stay visually correct.
    this._syncControlStripEnabled(next);

    if (this.enabled === next) {
      // Still keep KeyPilot's flag aligned if strip-only refresh was needed.
      try {
        if (this.keyPilot && this.keyPilot.enabled !== next) {
          if (next) await this.enableKeyPilot();
          else this.disableKeyPilot();
        }
      } catch {
        // ignore
      }
      // Storage / UPDATE_STATE often win the race and apply state first. A later
      // TOGGLE_STATE still needs to toast for the originating user action.
      if (showNotification) {
        this.showToggleNotification(next);
      }
      return;
    }

    // Sync with early injection cursor immediately
    if (window.KEYPILOT_EARLY) {
      window.KEYPILOT_EARLY.setEnabled(next);
    }

    this.enabled = next;

    // Emit a semantic action for onboarding / telemetry consumers.
    try {
      document.dispatchEvent(new CustomEvent('keypilot:action', {
        detail: {
          action: 'toggleExtension',
          enabled: next,
          timestamp: Date.now()
        }
      }));
    } catch {
      // ignore
    }

    if (next) {
      await this.enableKeyPilot();
    } else {
      this.disableKeyPilot();
    }

    // Re-sync after enable/disable in case strip was (re)created during the transition.
    this._syncControlStripEnabled(next);

    // Show notification to user only if requested
    if (showNotification) {
      this.showToggleNotification(next);
    }
  }

  /**
   * Enable KeyPilot functionality
   * Restores event listeners, CSS styles, and visual elements
   */
  async enableKeyPilot() {
    if (!this.keyPilot) return;

    try {
      // Keep KeyPilot's own enabled flag in sync (disableKeyPilot sets it false).
      try { this.keyPilot.enabled = true; } catch { /* ignore */ }

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

      // Restore intersection manager + permanent DOM-hover targeting.
      // cleanup() detaches delegated hover listeners; without re-enabling them,
      // normal-mode focus outlines never return (mousemove hit-testing is skipped
      // while KeyPilot._domHoverListenersEnabled stays true).
      if (this.keyPilot.intersectionManager) {
        try {
          if (typeof this.keyPilot.intersectionManager.setDomHoverListenersEnabled === 'function') {
            this.keyPilot.intersectionManager.setDomHoverListenersEnabled(
              true,
              (el) => this.keyPilot._handleDomHoverChange?.(el)
            );
          }
        } catch (error) {
          console.warn('[KeyPilotToggleHandler] Cannot restore DOM hover listeners:', error.message);
        }
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
          // Element-styled focus (DOM-hover): keep 'dom' backend — do not allocate canvas.
          try { this.keyPilot.overlayManager.setRenderingMode?.('dom'); } catch { /* ignore */ }
          // DOM-hover mode styles elements directly — re-apply after cleanup.
          if (typeof this.keyPilot.overlayManager.setDomHoverFocusColorsEnabled === 'function') {
            this.keyPilot.overlayManager.setDomHoverFocusColorsEnabled(true);
          }
          // Debug panel (if enabled) lives inside overlay manager
          this.keyPilot.overlayManager.initDebugPanel?.();
        } catch (error) {
          console.warn('[KeyPilotToggleHandler] Cannot restore overlays on this page:', error.message);
        }
      }

      // Force an immediate hover refresh so the focus outline reappears without requiring
      // the user to move the mouse past the threshold gate. Prefer DOM-hover's initial
      // under-cursor check (setDomHoverListenersEnabled already runs it); also seed via
      // elementFromPoint for modes / paths that still use updateElementsUnderCursor.
      try {
        const st = this.keyPilot.state?.getState?.();
        const x = Number(st?.lastMouse?.x);
        const y = Number(st?.lastMouse?.y);
        if (Number.isFinite(x) && Number.isFinite(y) && (x !== 0 || y !== 0)) {
          this.keyPilot.updateElementsUnderCursor?.(x, y, false, null);
        }
      } catch { /* ignore */ }

      // Frame pointer sync / focus reclaim — not installed when the page loaded with
      // KeyPilot off (initializeDisabledState). enable() is skipped here because we
      // set keyPilot.enabled = true above, so install the bridge explicitly.
      try {
        this.keyPilot._framePointerInside = false;
        this.keyPilot._framePointerIframe = null;
        this.keyPilot._installFrameBridgeListener?.();
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
      // Close launcher / omnibox / popovers / onboarding before tearing down DOM.
      try {
        if (typeof this.keyPilot.dismissActiveUI === 'function') {
          this.keyPilot.dismissActiveUI();
        } else if (typeof this.keyPilot.disable === 'function' && this.keyPilot.enabled) {
          // Fallback: full disable path also dismisses UI.
          this.keyPilot.disable();
        }
      } catch (e) {
        console.warn('[KeyPilotToggleHandler] dismissActiveUI failed:', e);
      }

      // Keep KeyPilot's own enabled flag in sync even when only this path runs.
      try { this.keyPilot.enabled = false; } catch { /* ignore */ }

      // Drop iframe pointer bridge without reclaiming focus (avoids dismissing
      // Google account menus when toggling KeyPilot off).
      try {
        this.keyPilot._framePointerInside = false;
        this.keyPilot._framePointerIframe = null;
        this.keyPilot._uninstallFrameBridgeListener?.();
      } catch { /* ignore */ }

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

      // Clean up overlays completely (also closes popover stack)
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
   * True when the control strip is on-screen (On/Off is already visible).
   * @returns {boolean}
   */
  _isControlStripVisible() {
    try {
      const strip = this.keyPilot?.controlStrip;
      if (strip && typeof strip.isVisible === 'function') {
        return !!strip.isVisible();
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * Show toggle notification to user
   * @param {boolean} enabled - Whether KeyPilot was enabled or disabled
   */
  showToggleNotification(enabled) {
    try {
      if (window !== window.top) return;
    } catch {
      return;
    }

    // Strip On/Off is the persistent indicator; toast only when that chrome is gone.
    if (this._isControlStripVisible()) return;

    try {
      document.querySelectorAll('.kpv2-toggle-notification').forEach((el) => {
        try { el.remove(); } catch { /* ignore */ }
      });
    } catch {
      // ignore
    }

    if (!document?.body) return;

    // Create notification overlay
    const notification = document.createElement('div');
    notification.className = 'kpv2-toggle-notification';
    const notificationMount = ensureOpenChromeShadow(notification, { id: 'toggle-notification' }) || notification;
    const message = document.createElement('span');
    message.textContent = enabled ? 'KeyPilot turned on' : 'KeyPilot turned off';
    notificationMount.appendChild(message);

    applyFlashNotificationStyle(notification, {
      backgroundColor: enabled ? COLORS.NOTIFICATION_SUCCESS : COLORS.NOTIFICATION_ERROR,
      zIndex: Z_INDEX.NOTIFICATION
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
    try {
      for (const dispose of this._runtimeDisposers || []) {
        try { dispose(); } catch { /* ignore */ }
      }
      this._runtimeDisposers = [];
    } catch {
      // ignore
    }
    try {
      if (chrome?.storage?.onChanged?.removeListener) {
        chrome.storage.onChanged.removeListener(this._onStorageChanged);
      }
    } catch {
      // ignore
    }
    // Legacy no-op path if an old handleMessage field existed
    if (chrome.runtime && chrome.runtime.onMessage && this.handleMessage) {
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