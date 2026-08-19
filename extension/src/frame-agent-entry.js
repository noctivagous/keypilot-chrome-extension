/**
 * Thin content-script entry for child frames only.
 *
 * Top frame uses content-bundled.js (full KeyPilot). Child frames load this
 * much smaller bundle so ads/widgets do not pay full parse+init cost.
 *
 * On popover INIT, requests the service worker to inject full KeyPilot into
 * this frame for the complete cursor/overlay experience.
 */
import { MSG } from './messaging/types.js';
import { installFrameClickAgent } from './modules/frame-click-agent.js';
import { installPopoverIframeBridge } from './modules/popover-iframe-bridge.js';
import { startKeyPilotDebugFromSettings } from './utils/debug.js';

void startKeyPilotDebugFromSettings();

(function installFrameAgentsIfNeeded() {
  try {
    // Top frame is owned by content-bundled.js — no-op if this script also lands there.
    if (window === window.top) return;
    if (window.__KP_FRAME_AGENT_INSTALLED) return;
    window.__KP_FRAME_AGENT_INSTALLED = true;

    installFrameClickAgent();

    installPopoverIframeBridge({
      // Frame-click-agent owns pre-KP activate keys; avoid double-clicking links.
      enableFClickBeforeKeyPilot: false,
      onBridgeInit: () => {
        try {
          window.__KP_POPOVER_IFRAME = true;
        } catch { /* ignore */ }

        // Already have full KP in this frame (re-INIT or re-inject).
        try {
          if (window.keyPilot || window.__KeyPilotToggleHandler) return;
        } catch { /* ignore */ }

        // Ask SW to inject content-bundled.js into this frame (isolated world).
        try {
          chrome.runtime?.sendMessage?.(
            { type: MSG.INJECT_FULL_KEYPILOT_IN_FRAME },
            () => {
              try {
                void chrome.runtime?.lastError;
              } catch { /* ignore */ }
            }
          );
        } catch (e) {
          console.warn('[KeyPilot] Failed to request full KeyPilot inject in frame:', e);
        }
      },
      onError: (error) => {
        console.warn('[KeyPilot] Failed to install popover iframe bridge:', error);
      }
    });
  } catch (error) {
    console.warn('[KeyPilot] Failed to install frame agents:', error);
  }
})();
