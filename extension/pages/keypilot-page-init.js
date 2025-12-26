/**
 * Bootstrap KeyPilot inside extension pages (chrome-extension://.../pages/*).
 *
 * Content scripts do not run on extension pages, so we manually start the KeyPilot
 * runtime and wrap it with KeyPilotToggleHandler to respect the global enabled state.
 */

import { KeyPilot } from '../src/keypilot.js';
import { KeyPilotToggleHandler } from '../src/modules/keypilot-toggle-handler.js';

/**
 * @param {object} [opts]
 * @param {boolean} [opts.allowInIframe] - When false, do nothing in iframes.
 * @returns {Promise<{ keyPilot: any, toggleHandler: any } | null>}
 */
export async function startKeyPilotOnPage({ allowInIframe = false } = {}) {
  try {
    if (!allowInIframe && window !== window.top) return null;

    // Avoid double-start on the same page.
    if (window.__KP_EXTENSION_PAGE_STARTED) {
      return window.__KP_EXTENSION_PAGE_STARTED;
    }

    const keyPilot = new KeyPilot();
    const toggleHandler = new KeyPilotToggleHandler(keyPilot);

    try {
      await toggleHandler.initialize();
    } catch {
      // ignore
    }

    const started = { keyPilot, toggleHandler };
    try { window.__KP_EXTENSION_PAGE_STARTED = started; } catch { /* ignore */ }
    return started;
  } catch (e) {
    console.warn('[KeyPilot] Failed to start on extension page:', e);
    return null;
  }
}


