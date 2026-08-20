/**
 * Shared open-Shadow-DOM contract for KeyPilot page chrome.
 *
 * The light host owns visibility, fixed geometry, positioning, and print
 * selectors. Its shadow owns panel internals and panel-local styles.
 */

import {
  applyThemeCssVars,
  applyThemeDataset,
  getActiveTheme,
  injectAllThemeMaps
} from '../modules/theme-manager.js';

/**
 * Preferred mount parent for floating KP chrome.
 *
 * Always prefer `document.body` once it exists. Mounting under `<html>` at
 * document_start (body missing) is fine temporarily, but React/Next App Router
 * owns `<html>` and will remove foreign siblings of `<head>`/`<body>` on later
 * commits — which is exactly how control strip / keyboard help vanish on Suno.
 *
 * @param {Document|null|undefined} [doc]
 * @returns {HTMLElement|null}
 */
export function getChromeMountParent(doc = document) {
  try {
    return doc?.body || doc?.documentElement || null;
  } catch {
    return null;
  }
}

/**
 * Ensure a chrome host is attached under the preferred parent.
 * Relocates html→body when body appears, and reattaches if disconnected.
 *
 * @param {HTMLElement|null|undefined} host
 * @param {Document|null|undefined} [doc]
 * @returns {HTMLElement|null} mount parent used, or null
 */
export function ensureChromeHostMounted(host, doc = document) {
  if (!host) return null;
  const parent = getChromeMountParent(doc);
  if (!parent) return null;
  try {
    const current = host.parentElement;
    // Prefer body over html once body exists (even if already under html).
    if (doc?.body && current === doc.documentElement) {
      doc.body.appendChild(host);
      return doc.body;
    }
    if (current !== parent) {
      parent.appendChild(host);
    }
  } catch { /* ignore */ }
  return parent;
}

/**
 * Mark an outer KP window shell so cut/radius tokens apply to the clip edge.
 * @param {Element|null|undefined} el
 */
export function markChromeWindow(el) {
  if (!el) return el;
  try { el.classList?.add('kp-chrome-window'); } catch { /* ignore */ }
  try {
    const theme = getActiveTheme();
    applyThemeDataset(el, theme);
    applyThemeCssVars(el, theme);
  } catch { /* ignore */ }
  return el;
}

/**
 * @param {HTMLElement|null|undefined} host
 * @param {{ id?: string, chromeWindow?: boolean }} [opts]
 * @returns {ShadowRoot|null}
 */
export function ensureOpenChromeShadow(host, opts = {}) {
  if (!host) return null;
  try {
    host.setAttribute('data-kp-ui-shadow', String(opts.id || 'chrome'));
  } catch { /* ignore */ }
  if (opts.chromeWindow) markChromeWindow(host);
  let shadow = null;
  try {
    shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  } catch {
    shadow = host.shadowRoot || null;
  }
  try {
    const theme = getActiveTheme();
    applyThemeDataset(host, theme);
    applyThemeCssVars(host, theme);
    if (shadow) injectAllThemeMaps(shadow);
  } catch { /* ignore */ }
  return shadow;
}

/**
 * @param {Document|ShadowRoot|null|undefined} root
 * @param {{ attr: string, css: string }} params
 * @returns {HTMLStyleElement|null}
 */
export function injectChromeStyles(root, { attr, css } = {}) {
  if (!root || !attr) return null;
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const mount = root.nodeType === 9 ? root.head : root;
  if (!doc || !mount?.appendChild) return null;

  let style = null;
  try { style = mount.querySelector(`style[${attr}]`); } catch { /* ignore */ }
  if (!style) {
    try {
      style = doc.createElement('style');
      style.setAttribute(attr, 'true');
      style.textContent = String(css || '');
      mount.appendChild(style);
      return style;
    } catch {
      return null;
    }
  }
  if (style.textContent !== String(css || '')) {
    try { style.textContent = String(css || ''); } catch { /* ignore */ }
  }
  return style;
}

/**
 * Return the first element in an event's composed path matching selector.
 * Document listeners see the light host as event.target for shadow content.
 * @param {Event|null|undefined} event
 * @param {string} selector
 * @returns {Element|null}
 */
export function getComposedEventElement(event, selector) {
  if (!event || !selector) return null;
  try {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path || []) {
      if (node?.nodeType === 1 && node.matches?.(selector)) return node;
    }
  } catch { /* ignore */ }
  try {
    const target = event.target;
    return target?.nodeType === 1 && target.matches?.(selector) ? target : null;
  } catch {
    return null;
  }
}

/**
 * @param {Element|null|undefined} element
 * @param {string} selector
 * @returns {Element|null}
 */
export function closestComposed(element, selector) {
  let node = element;
  let depth = 0;
  while (node && depth++ < 32) {
    try {
      if (node.matches?.(selector)) return node;
      if (node.parentElement) {
        node = node.parentElement;
        continue;
      }
      const root = node.getRootNode?.();
      node = root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot
        ? root.host
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** @param {Node|null|undefined} host @param {Node|null|undefined} node */
export function containsComposed(host, node) {
  if (!host || !node) return false;
  if (host === node) return true;
  try { if (host.contains(node)) return true; } catch { /* ignore */ }
  let current = node;
  let depth = 0;
  while (current && depth++ < 32) {
    if (current === host) return true;
    const parent = current.parentElement;
    if (parent) {
      current = parent;
      continue;
    }
    const root = current.getRootNode?.();
    current = root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot
      ? root.host
      : null;
  }
  return false;
}

/** @param {Element|null|undefined} element */
export function isInteractiveKeyPilotOverlayElement(element) {
  return !!closestComposed(
    element,
    [
      '#kpv2-media-lib-overlay',
      '.kpv2-media-lib-overlay',
      '#kpv2-page-media-overlay',
      '.kpv2-page-media-overlay'
    ].join(', ')
  );
}

/** Gallery chrome classes that Click Element / hover must treat as page controls. */
export function isInteractiveKeyPilotOverlayClass(className) {
  const c = String(className || '');
  return c.startsWith('kpv2-media-lib-') || c.startsWith('kpv2-page-media-');
}

/**
 * KeyPilot chrome that Click Element must activate like a real mouse click
 * (Keyboard Reference keys / titlebar select, key-info settings, Config, control strip).
 * These stay "chrome" for overlay skipping and pointer-binding yield, but activation
 * must not discard the element under the cursor.
 * @param {Element|null|undefined} element
 */
export function isClickableKeyPilotChromeElement(element) {
  if (isInteractiveKeyPilotOverlayElement(element)) return true;
  return !!closestComposed(
    element,
    [
      '.kp-floating-keyboard-help',
      '.kp-keybindings-popover',
      '.kp-select',
      '.kp-select-menu',
      '.kp-action-config-panel',
      '.kp-control-strip',
      '.kp-onboarding-panel',
      '.kp-layout-config-panel',
      '.kpv2-top-sites-panel',
      '.kpv2-tab-history-panel',
      '.kpv2-settings-host',
      '.kpv2-docs-host',
      '.kpv2-popover-container',
      '.kp-launcher-container',
      // OS popup Link Preview / Open Popover: injected titlebar (Open, New Tab, ×)
      '#kpv2-popover-window-chrome-host',
      '[data-kp-popover-window-chrome]',
      '.kpv2-popover-window-titlebar'
    ].join(', ')
  );
}

/** @param {Element|null|undefined} element */
export function isKeyPilotChromeElement(element) {
  if (isInteractiveKeyPilotOverlayElement(element)) return false;
  return !!closestComposed(
    element,
    [
      '[data-kp-ui-shadow]',
      '.kp-floating-keyboard-help',
      '.kp-select',
      '.kp-select-menu',
      '.kp-control-strip',
      '.kp-onboarding-panel',
      '.kp-layout-config-panel',
      '.kpv2-top-sites-panel',
      '.kp-action-config-panel',
      '.kp-practice-popover',
      '.kp-procedure-result',
      '.kpv2-tab-history-panel',
      '.kp-launcher-container',
      '.kpv2-popover-container',
      '.kpv2-omnibox-backdrop',
      '.kpv2-page-media-overlay',
      '[id^="kpv2-"]'
    ].join(', ')
  );
}
