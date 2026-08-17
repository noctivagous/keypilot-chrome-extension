// Popover iframe bridge for extension pages (chrome-extension://...).
// Content scripts do not run in these pages, so we install the shared bridge
// subset (handshake, close keys, scroll) plus the frame-click-agent hover /
// F-activate path. Parent cannot read chrome-extension iframe documents, so
// hover outlines must be painted here.

import { installFrameClickAgent } from '../src/modules/frame-click-agent.js';
import { installPopoverIframeBridge } from '../src/modules/popover-iframe-bridge.js';

try {
  if (!window.__KP_FRAME_AGENT_INSTALLED) {
    window.__KP_FRAME_AGENT_INSTALLED = true;
    installFrameClickAgent();
  }
} catch (e) {
  console.warn('[KeyPilot] popover frame-click-agent failed:', e);
}

installPopoverIframeBridge({
  // Settings forms: treat <select> as typing so E/scroll keys don't steal focus.
  treatSelectAsTyping: true,
  // Historical extension-page close key (in addition to Esc / E).
  closeOnQuote: true,
  // Frame-click-agent owns pre-KP activate keys; avoid double-clicking.
  enableFClickBeforeKeyPilot: false,
  onError: (e) => {
    console.warn('[KeyPilot] popover-bridge failed:', e);
  }
});
