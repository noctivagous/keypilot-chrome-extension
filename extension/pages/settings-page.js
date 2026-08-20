/**
 * Standalone Settings page boot (chrome-extension://…/settings.html).
 * Starts KeyPilot in this document, then mounts the settings UI.
 */
import { getSettings } from '../src/modules/settings-manager.js';
import { startKeyPilotOnPage } from './keypilot-page-init.js';
import { applyAppearanceControls, mountSettingsApp } from './settings.js';

const embedded = (() => {
  try { return !!(window.parent && window.parent !== window); } catch { return false; }
})();

void (async () => {
  const settingsPromise = getSettings();
  void settingsPromise.then((s) => {
    try { applyAppearanceControls(s); } catch { /* ignore */ }
  });
  await startKeyPilotOnPage({ allowInIframe: embedded });
  await mountSettingsApp(document, { embedded });
})();
