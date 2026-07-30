// Popover iframe bridge for extension pages (chrome-extension://...).
// Content scripts do not run in these pages, so we install the shared bridge subset needed
// for KeyPilot's popover container (handshake, close keys, scroll).

import { installPopoverIframeBridge } from '../src/modules/popover-iframe-bridge.js';

installPopoverIframeBridge({
  // Settings forms: treat <select> as typing so E/scroll keys don't steal focus.
  treatSelectAsTyping: true,
  // Historical extension-page close key (in addition to Esc / E).
  closeOnQuote: true,
  onError: (e) => {
    console.warn('[KeyPilot] popover-bridge failed:', e);
  }
});
