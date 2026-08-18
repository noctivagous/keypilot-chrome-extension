/**
 * Injected KeyPilot chrome for separate-window Link Preview / Open Popover.
 *
 * The OS popup navigates directly to the page URL (no extension shell iframe).
 * This module mounts a fixed titlebar (Open, close) in an open shadow root and
 * pads the page so content is not fully covered.
 */

import { MSG } from '../messaging/types.js';
import { createUrlPopoverTitlebar } from '../ui/popover-titlebar.js';
import { ensureOpenChromeShadow, ensureChromeHostMounted } from '../ui/kp-chrome-shadow.js';
import { preferHttpsForPreview } from '../utils/preview-url.js';

const CHROME_HOST_ID = 'kpv2-popover-window-chrome-host';
const TITLEBAR_HEIGHT_PX = 44;

/**
 * Ask the SW whether this top-level tab is a KeyPilot popover window.
 * @returns {Promise<object|null>}
 */
export async function queryPopoverWindowInfo() {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null;
    const res = await chrome.runtime.sendMessage({ type: MSG.AM_I_POPOVER_WINDOW });
    if (res?.isPopoverWindow) return res;
  } catch { /* ignore */ }
  return null;
}

/**
 * Install fixed titlebar chrome when running inside a KP popover OS window.
 * @param {object} [info] - result of {@link queryPopoverWindowInfo}
 * @returns {Promise<{ dispose: () => void }|null>}
 */
export async function installPopoverWindowChrome(info) {
  if (window !== window.top) return null;
  if (window.__KP_POPOVER_WINDOW_CHROME) return window.__KP_POPOVER_WINDOW_CHROME;

  const meta = info || await queryPopoverWindowInfo();
  if (!meta?.isPopoverWindow) return null;

  const originalUrl = preferHttpsForPreview(meta.originalUrl || location.href);
  const kind = meta.kind === 'modal' ? 'modal' : 'preview';
  const closeKeys = Array.isArray(meta.closeKeys) && meta.closeKeys.length
    ? meta.closeKeys.map(String)
    : (kind === 'modal' ? ['Escape', 'p', 'P'] : ['Escape', 'e', 'E']);

  // Close-key parity with former iframe popovers (handled in keypilot.js).
  try {
    window.__KP_POPOVER_WINDOW = true;
    window.__KP_POPOVER_CLOSE_KEYS = closeKeys;
  } catch { /* ignore */ }

  const requestClose = () => {
    try {
      void chrome.runtime.sendMessage({
        type: MSG.CLOSE_POPOVER_WINDOW,
        reason: 'chrome_close'
      });
    } catch { /* ignore */ }
  };

  // Host + shadow
  let host = document.getElementById(CHROME_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = CHROME_HOST_ID;
  }
  host.setAttribute('data-kp-popover-window-chrome', '1');
  host.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: ${TITLEBAR_HEIGHT_PX}px;
    z-index: 2147483646;
    pointer-events: none;
  `;
  ensureChromeHostMounted(host);
  const shadow = ensureOpenChromeShadow(host, { id: 'popover-window-chrome' });
  const mount = shadow || host;

  // Clear previous mounts (e.g. SPA navigation re-init).
  try { mount.textContent = ''; } catch { /* ignore */ }

  const shell = document.createElement('div');
  shell.style.cssText = `
    pointer-events: auto;
    height: ${TITLEBAR_HEIGHT_PX}px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background: #121212;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  `;

  const titleText = kind === 'modal' ? 'Open Popover' : 'Link Preview';
  const hint = kind === 'modal' ? 'Press Esc / P to hide' : 'Press Esc / E to hide';

  const titlebarApi = createUrlPopoverTitlebar({
    title: titleText,
    shortcut: kind === 'modal' ? 'P' : 'E',
    variant: 'preview',
    showClose: true,
    onClose: requestClose,
    closeTitle: 'Close (Esc)',
    hint,
    className: 'kpv2-popover-window-titlebar',
    getUrl: () => originalUrl || location.href,
    afterOpen: requestClose,
    afterOpenNewTab: requestClose
  });

  shell.appendChild(titlebarApi.titlebar);
  mount.appendChild(shell);

  // Pad the document so the fixed bar does not cover the first content row.
  const spacerId = 'kpv2-popover-window-chrome-spacer';
  let spacer = document.getElementById(spacerId);
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.id = spacerId;
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.cssText = `
      display: block;
      width: 100%;
      height: ${TITLEBAR_HEIGHT_PX}px;
      flex-shrink: 0;
      pointer-events: none;
    `;
    try {
      const parent = document.body || document.documentElement;
      parent.insertBefore(spacer, parent.firstChild);
    } catch { /* ignore */ }
  }

  const dispose = () => {
    try {
      window.__KP_POPOVER_WINDOW = false;
      window.__KP_POPOVER_CLOSE_KEYS = null;
    } catch { /* ignore */ }
    try { host.remove(); } catch { /* ignore */ }
    try { spacer?.remove(); } catch { /* ignore */ }
    try { delete window.__KP_POPOVER_WINDOW_CHROME; } catch { /* ignore */ }
  };

  const api = { dispose, host, titlebarApi };
  window.__KP_POPOVER_WINDOW_CHROME = api;
  return api;
}
