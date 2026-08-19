/**
 * Release-safe debug logging.
 *
 * Verbose `console.log` / `console.debug` / `console.info` in KeyPilot's
 * isolated worlds (content script, service worker, extension pages) stay
 * silent unless Settings → About → Debug logging is on. `console.warn` and
 * `console.error` are never gated.
 *
 * `window.KEYPILOT_DEBUG` remains the in-process flag used by existing
 * `if (window.KEYPILOT_DEBUG)` call sites.
 */

import { getSettings, SETTINGS_STORAGE_KEY } from '../modules/settings-manager.js';

let consoleWrapped = false;
let storageListenerInstalled = false;

/**
 * @returns {boolean}
 */
export function isKeyPilotDebugEnabled() {
  try {
    return !!globalThis.KEYPILOT_DEBUG;
  } catch {
    return false;
  }
}

/**
 * @param {boolean} enabled
 */
export function applyDebugSetting(enabled) {
  try {
    globalThis.KEYPILOT_DEBUG = !!enabled;
  } catch {
    // ignore (sandboxed / missing global)
  }
}

/**
 * Wrap verbose console methods once in this JS realm.
 * Safe to call from content scripts, the service worker, and extension pages.
 */
export function installKeyPilotDebugConsole() {
  if (consoleWrapped) return;
  consoleWrapped = true;

  applyDebugSetting(!!globalThis.KEYPILOT_DEBUG);

  const origLog = console.log.bind(console);
  const origDebug = console.debug.bind(console);
  const origInfo = console.info.bind(console);

  console.log = (...args) => {
    if (isKeyPilotDebugEnabled()) origLog(...args);
  };
  console.debug = (...args) => {
    if (isKeyPilotDebugEnabled()) origDebug(...args);
  };
  console.info = (...args) => {
    if (isKeyPilotDebugEnabled()) origInfo(...args);
  };
}

function applyFromStoredSettings(raw) {
  applyDebugSetting(!!(raw && typeof raw === 'object' && raw.debugLogging));
}

/**
 * Install console gating, load `debugLogging` from settings, and keep the
 * flag in sync when settings change.
 * @returns {Promise<void>}
 */
export async function startKeyPilotDebugFromSettings() {
  installKeyPilotDebugConsole();
  try {
    const settings = await getSettings();
    applyDebugSetting(!!settings?.debugLogging);
  } catch {
    applyDebugSetting(false);
  }

  if (storageListenerInstalled) return;
  storageListenerInstalled = true;
  try {
    if (!chrome?.storage?.onChanged?.addListener) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      const ch = changes?.[SETTINGS_STORAGE_KEY];
      if (!ch) return;
      applyFromStoredSettings(ch.newValue);
    });
  } catch {
    // ignore
  }
}
