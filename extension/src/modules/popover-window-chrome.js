/**
 * Injected KeyPilot chrome for separate-window Link Preview / Open Popover.
 *
 * The OS popup navigates directly to the page URL (no extension shell iframe).
 * This module mounts a fixed titlebar (Mobile/Desktop, Open, close) in an open
 * shadow root and pads the page so content is not fully covered.
 */

import { MSG } from '../messaging/types.js';
import { createUrlPopoverTitlebar } from '../ui/popover-titlebar.js';
import { createSegmentedControl } from '../ui/segmented-control.js';
import { ensureOpenChromeShadow, ensureChromeHostMounted } from '../ui/kp-chrome-shadow.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';
import { preferHttpsForPreview } from '../utils/preview-url.js';

const PREVIEW_VIEWPORT_BY_HOST_KEY = 'kp_link_preview_viewport_by_host';
const CHROME_HOST_ID = 'kpv2-popover-window-chrome-host';
const TITLEBAR_HEIGHT_PX = 44;

/**
 * @param {string} url
 * @returns {string}
 */
function previewHostFromUrl(url) {
  try {
    let host = new URL(String(url || '')).hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch {
    return '';
  }
}

/**
 * @param {string} hostname
 * @returns {Promise<'mobile'|'desktop'>}
 */
async function getPreviewViewportModeForHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return 'desktop';
  try {
    const map = await storageGetValue(PREVIEW_VIEWPORT_BY_HOST_KEY, {});
    if (map && typeof map === 'object' && !Array.isArray(map) && map[host] === 'mobile') {
      return 'mobile';
    }
  } catch { /* ignore */ }
  return 'desktop';
}

/**
 * @param {string} hostname
 * @param {'mobile'|'desktop'} mode
 */
async function setPreviewViewportModeForHost(hostname, mode) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host) return;
  try {
    const prev = await storageGetValue(PREVIEW_VIEWPORT_BY_HOST_KEY, {});
    const map = (prev && typeof prev === 'object' && !Array.isArray(prev))
      ? { ...prev }
      : {};
    if (mode === 'mobile') {
      map[host] = 'mobile';
    } else {
      delete map[host];
    }
    await storageSetValue(PREVIEW_VIEWPORT_BY_HOST_KEY, map);
  } catch { /* ignore */ }
}

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
  const previewHost = previewHostFromUrl(originalUrl);

  /** @type {'mobile'|'desktop'} */
  let viewportMode = meta.viewportMode === 'mobile' ? 'mobile' : 'desktop';
  try {
    const remembered = await getPreviewViewportModeForHost(previewHost);
    if (meta.viewportMode !== 'mobile' && meta.viewportMode !== 'desktop') {
      viewportMode = remembered;
    }
  } catch { /* ignore */ }

  // Close-key parity with iframe popovers (handled in keypilot.js).
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

  const applyMobileUa = async (enabled) => {
    try {
      await chrome.runtime.sendMessage({
        type: MSG.SET_PREVIEW_MOBILE_UA,
        enabled: !!enabled,
        scope: 'main_frame'
      });
    } catch (e) {
      console.warn('[KeyPilot] Popover window mobile UA failed:', e?.message || e);
    }
  };

  const reloadTab = async () => {
    try {
      await chrome.runtime.sendMessage({ type: MSG.RELOAD_POPOVER_WINDOW_TAB });
    } catch {
      try { location.reload(); } catch { /* ignore */ }
    }
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

  const viewportModeControl = createSegmentedControl({
    value: viewportMode,
    ariaLabel: 'Preview viewport mode',
    className: 'kpv2-popover-window-viewport-mode',
    options: [
      {
        value: 'mobile',
        label: 'Mobile',
        title: 'Mobile site (mobile User-Agent). Remembered for this website.',
        ariaLabel: 'Mobile preview'
      },
      {
        value: 'desktop',
        label: 'Desktop',
        title: 'Desktop site (default). Remembered for this website.',
        ariaLabel: 'Desktop preview'
      }
    ],
    onChange: (value) => {
      void (async () => {
        const next = value === 'mobile' ? 'mobile' : 'desktop';
        if (next === viewportMode) return;
        viewportMode = next;
        await applyMobileUa(next === 'mobile');
        try {
          await setPreviewViewportModeForHost(previewHost, next);
        } catch { /* ignore */ }
        await reloadTab();
      })();
    }
  });

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
    extraActions: [viewportModeControl.root],
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

  // If SW opened us already in mobile mode, UA rule is set; ensure toggle matches.
  if (viewportMode === 'mobile') {
    viewportModeControl.setValue?.('mobile', { silent: true });
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
