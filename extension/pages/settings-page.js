/**
 * Standalone Settings page boot (chrome-extension://…/settings.html).
 * Starts KeyPilot in this document, then mounts the settings UI.
 */
import { startKeyPilotOnPage } from './keypilot-page-init.js';
import { mountSettingsApp } from './settings.js';

const embedded = (() => {
  try { return !!(window.parent && window.parent !== window); } catch { return false; }
})();

void (async () => {
  await startKeyPilotOnPage({ allowInIframe: embedded });
  await mountSettingsApp(document, { embedded });
})();
