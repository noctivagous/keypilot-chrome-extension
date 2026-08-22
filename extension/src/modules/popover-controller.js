/**
 * In-page iframe / Docs / Settings popovers and OS popup windows (E + P).
 * Owned by OverlayManager; public methods stay on the OverlayManager façade.
 */
import { KP_UI_FONT, MODES } from '../config/constants.js';
import { MSG } from '../messaging/types.js';
import {
  installContentRuntimeRouter,
  registerContentRuntimeHandler
} from '../messaging/content-runtime-router.js';
import {
  createPopoverTitlebar,
  createTitlebarCloseHint
} from '../ui/popover-titlebar.js';
import {
  ensureOpenChromeShadow,
  markChromeWindow
} from '../ui/kp-chrome-shadow.js';
import {
  NCT_DARK_UI_PANEL_BACKGROUND,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW
} from '../ui/nct-dark-ui.js';
import {
  isHttpPopoverUrl,
  preferHttpsForPreview
} from '../utils/preview-url.js';
import { postPopoverBridgeInit } from './popover-bridge-init.js';
import { loadDocsUi, loadSettingsUi } from './lazy-page-ui.js';

export class PopoverController {
  /** @param {import('./overlay-manager.js').OverlayManager} host */
  constructor(host) {
    this.host = host;

    this.popoverContainer = null;
    this.popoverIframeElement = null;
    this.popoverIframeWindow = null;
    this.popoverMessageHandler = null;
    this.popoverInitTimer = null;
    this.popoverBridgeReady = false;
    this.popoverCloseButton = null;
    this.popoverKeyHandler = null;
    this._popoverLastMouse = { x: null, y: null };
    this._popoverMouseTrackerInstalled = false;
    this._popoverHybridFocusCleanup = null;
    /** @type {HTMLElement|null} */
    this._docsHost = null;
    /** @type {(() => void)|null} */
    this._docsUnmount = null;
    /** @type {{ mountDocsApp?: Function, navigateDocsApp?: Function }|null} */
    this._docsUi = null;
    /** @type {{ mountSettingsApp?: Function, setActiveSettingsPanel?: Function }|null} */
    this._settingsUi = null;
    /** @type {'docs'|'settings'|null} */
    this._inPagePopoverKind = null;
    this._docsFontScale = 1.25;
    /** @type {number|null} */
    this._popoverWindowId = null;
    /** @type {number|null} */
    this._popoverWindowTabId = null;
    /** @type {string|null} */
    this._popoverWindowUrl = null;
    /** @type {'preview'|'modal'|null} */
    this._popoverWindowKind = null;
    /** @type {((message: any, sender: any, sendResponse: any) => boolean|void)|null} */
    this._popoverWindowMsgHandler = null;
    this._popoverPopupId = 'kpv2-iframe-popover';
  }

  get popupManager() {
    return this.host.popupManager;
  }

  createElement(tag, props = {}) {
    return this.host.createElement(tag, props);
  }

  clearPopoverWindowTracking() {
    this._popoverWindowId = null;
    this._popoverWindowTabId = null;
    this._popoverWindowUrl = null;
    this._popoverWindowKind = null;
  }

  _focusPopoverIframe(iframe) {
    if (!iframe) return;
    try { iframe.focus(); } catch { /* ignore */ }
    try { iframe.contentWindow?.focus?.(); } catch { /* ignore */ }
  }

  /**
   * Hybrid focus: keys drive the iframe page when the pointer is over content;
   * when the pointer is over chrome (titlebar / actions / close), focus returns
   * to the parent so Esc/E/P and chrome controls stay reliable.
   *
   * @param {{
   *   iframe: HTMLIFrameElement,
   *   chromeEls?: Array<HTMLElement|null|undefined>,
   *   focusChromeEl?: HTMLElement|null
   * }} opts
   */
  _installPopoverHybridFocus({ iframe, chromeEls, focusChromeEl } = {}) {
    try { this._popoverHybridFocusCleanup?.(); } catch { /* ignore */ }
    this._popoverHybridFocusCleanup = null;

    if (!iframe) return;

    const chrome = (Array.isArray(chromeEls) ? chromeEls : []).filter(Boolean);
    /** @type {'iframe'|'chrome'|null} */
    let zone = null;

    const focusChrome = () => {
      const el = focusChromeEl || chrome[0] || this.popoverContainer;
      try { el?.focus?.(); } catch { /* ignore */ }
    };

    const focusIframe = () => this._focusPopoverIframe(iframe);

    const setZone = (next) => {
      if (next === zone) return;
      zone = next;
      if (next === 'iframe') focusIframe();
      else if (next === 'chrome') focusChrome();
    };

    const onChromeEnter = () => setZone('chrome');
    const onIframeEnter = () => setZone('iframe');

    for (const el of chrome) {
      try { el.addEventListener('pointerenter', onChromeEnter, true); } catch { /* ignore */ }
    }
    try { iframe.addEventListener('pointerenter', onIframeEnter, true); } catch { /* ignore */ }

    this._popoverHybridFocusCleanup = () => {
      for (const el of chrome) {
        try { el.removeEventListener('pointerenter', onChromeEnter, true); } catch { /* ignore */ }
      }
      try { iframe.removeEventListener('pointerenter', onIframeEnter, true); } catch { /* ignore */ }
    };
  }

  /**
   * Ensure we listen for SW popover-window closed messages once.
   */
  _ensurePopoverWindowMessageListener() {
    if (this._popoverWindowMsgHandler) return;
    this._popoverWindowMsgHandler = (message) => {
      try {
        if (!message || typeof message.type !== 'string') return;
        if (message.type === MSG.POPOVER_WINDOW_CLOSED) {
          // Clear local window tracking; KeyPilot also clears mode state.
          if (
            typeof message.windowId === 'number' &&
            this._popoverWindowId === message.windowId
          ) {
            this._popoverWindowId = null;
            this._popoverWindowTabId = null;
            this._popoverWindowUrl = null;
            this._popoverWindowKind = null;
          }
        }
      } catch (e) {
        console.warn('[KeyPilot] Popover window message handler failed:', e?.message || e);
      }
    };
    try {
      installContentRuntimeRouter();
      this._popoverWindowMsgDispose = registerContentRuntimeHandler(
        MSG.POPOVER_WINDOW_CLOSED,
        this._popoverWindowMsgHandler
      );
    } catch { /* ignore */ }
  }

  /**
   * @param {'preview'|'modal'} kind
   * @param {string} url
   * @param {{ mouseX?: number }} [opts]
   * @returns {{ width: number, height: number, left: number, top: number }}
   */
  _computePopoverWindowBounds(kind, url, opts = {}) {
    const availW = Math.max(320, Number(window.screen?.availWidth) || window.innerWidth || 1200);
    const availH = Math.max(240, Number(window.screen?.availHeight) || window.innerHeight || 800);
    const screenLeft = Number(window.screen?.availLeft) || 0;
    const screenTop = Number(window.screen?.availTop) || 0;
    const margin = 20;

    let width;
    let height;
    if (kind === 'modal') {
      // Match overlay: viewport minus ~40pt margins.
      const pt = 40 * (96 / 72); // CSS pt → px approximation
      width = Math.max(480, Math.min(availW - margin * 2, (window.innerWidth || availW) - pt));
      height = Math.max(360, Math.min(availH - margin * 2, (window.innerHeight || availH) - pt));
    } else {
      width = 600;
      height = Math.max(200, availH - margin * 2);
    }

    const mouseX = Number.isFinite(opts.mouseX) ? opts.mouseX : (window.innerWidth || availW) / 2;
    let left = screenLeft + Math.round((window.screenX || 0) + mouseX - width / 2);
    left = Math.max(screenLeft + margin, Math.min(left, screenLeft + availW - width - margin));
    const top = screenTop + margin;

    return { width: Math.round(width), height: Math.round(height), left, top };
  }

  /**
   * Open a sized OS popup window for Link Preview / Open Popover.
   * @param {object} opts
   * @param {string} opts.url
   * @param {'preview'|'modal'} [opts.kind='preview']
   * @param {string[]} [opts.closeKeys]
   * @param {number} [opts.mouseX]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   * @param {number} [opts.left]
   * @param {number} [opts.top]
   * @returns {Promise<boolean>}
   */
  async _openPopoverWindow(opts = {}) {
    this._ensurePopoverWindowMessageListener();
    const url = String(opts.url || '').trim();
    if (!url) return false;
    const kind = opts.kind === 'modal' ? 'modal' : 'preview';
    const closeKeys = Array.isArray(opts.closeKeys) && opts.closeKeys.length
      ? opts.closeKeys.map(String)
      : (kind === 'modal' ? ['Escape', 'p', 'P'] : ['Escape', 'e', 'E']);

    const bounds = this._computePopoverWindowBounds(kind, url, { mouseX: opts.mouseX });
    const width = typeof opts.width === 'number' ? opts.width : bounds.width;
    const height = typeof opts.height === 'number' ? opts.height : bounds.height;
    const left = typeof opts.left === 'number' ? opts.left : bounds.left;
    const top = typeof opts.top === 'number' ? opts.top : bounds.top;

    try {
      // Clear local tracking; SW replaces any existing window for this opener.
      this._popoverWindowId = null;
      this._popoverWindowTabId = null;
      this._popoverWindowUrl = null;
      this._popoverWindowKind = null;

      const res = await chrome.runtime.sendMessage({
        type: MSG.OPEN_POPOVER_WINDOW,
        url,
        kind,
        closeKeys,
        width,
        height,
        left,
        top
      });
      if (res?.type === MSG.ERROR || typeof res?.windowId !== 'number') {
        console.warn('[KeyPilot] Failed to open popover window:', res?.error || res);
        try {
          window.__KeyPilotInstance?.state?.setPopoverOpen?.(false, null);
        } catch { /* ignore */ }
        return false;
      }
      this._popoverWindowId = res.windowId;
      this._popoverWindowTabId = typeof res.tabId === 'number' ? res.tabId : null;
      this._popoverWindowUrl = url;
      this._popoverWindowKind = kind;
      return true;
    } catch (e) {
      console.warn('[KeyPilot] OPEN_POPOVER_WINDOW failed:', e?.message || e);
      try {
        window.__KeyPilotInstance?.state?.setPopoverOpen?.(false, null);
      } catch { /* ignore */ }
      return false;
    }
  }

  async _closeTrackedPopoverWindow() {
    const windowId = this._popoverWindowId;
    this._popoverWindowId = null;
    this._popoverWindowTabId = null;
    this._popoverWindowUrl = null;
    this._popoverWindowKind = null;
    if (typeof windowId !== 'number') return;
    try {
      await chrome.runtime.sendMessage({
        type: MSG.CLOSE_POPOVER_WINDOW,
        windowId,
        // Opener-initiated close: SW still notifies, but we already cleared local ids.
        notifyOpener: false,
        reason: 'opener_hide'
      });
    } catch { /* ignore */ }
  }

  /**
   * Apply the Docs titlebar text-size slider to the in-page Docs host.
   * @param {number} scale
   */
  setDocsFontScale(scale) {
    const n = Number(scale);
    if (!Number.isFinite(n) || n < 0.8 || n > 1.75) return;
    this._docsFontScale = n;
    try {
      this._docsHost?.style?.setProperty('--docs-font-scale', String(n));
      const app = this._docsHost?.shadowRoot?.querySelector?.('.docs-app');
      app?.style?.setProperty('--docs-font-scale', String(n));
    } catch { /* ignore */ }
  }

  /**
   * Docs popover without an iframe: same modal chrome as Settings/Guide, but the
   * article/nav live in an open shadow tree so KeyPilot hover, F-click, and
   * Text Mode work like Tab History / Launcher.
   * @param {object} opts
   * @param {string} [opts.title]
   * @param {string} [opts.hintKeyLabel]
   * @param {string} [opts.width]
   * @param {string} [opts.height]
   * @param {HTMLElement|HTMLElement[]|null} [opts.actions]
   * @param {string} [opts.topicId]
   * @param {string} [opts.hash]
   * @param {(target: object) => void} [opts.onNavigateDeepLink]
   */
  async showInPageDocsPopover(opts = {}) {
    let docsUi;
    try {
      docsUi = await loadDocsUi();
    } catch (err) {
      console.warn('[KeyPilot] Failed to load Docs UI bundle:', err);
      return;
    }
    this._docsUi = docsUi;
    this.hidePopover();

    const requestClosePopover = () => {
      try {
        if (window.__KeyPilotInstance && typeof window.__KeyPilotInstance.handleClosePopover === 'function') {
          window.__KeyPilotInstance.handleClosePopover();
          return;
        }
      } catch { /* ignore */ }
      this.hidePopover();
    };

    this.popoverContainer = this.createElement('div', {
      className: 'kpv2-popover-container kpv2-docs-popover kp-chrome-window',
      tabindex: '-1',
      role: 'dialog',
      'aria-modal': 'true',
      style: `
        position: fixed;
        inset: 0;
        width: ${opts.width || 'calc(100vw - 40pt)'};
        height: ${opts.height || 'calc(100vh - 40pt)'};
        max-width: calc(100vw - 40pt);
        max-height: calc(100vh - 40pt);
        margin: auto;
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: ${NCT_DARK_UI_PANEL_BORDER};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: ${KP_UI_FONT};
        font-size: 14px;
        line-height: 1.3;
        letter-spacing: normal;
      `
    });
    markChromeWindow(this.popoverContainer);

    const chromeHost = this.createElement('div', {
      className: 'kpv2-popover-chrome-host',
      style: `
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        min-height: 0;
      `
    });
    const chromeShadow = ensureOpenChromeShadow(chromeHost, { id: 'docs-popover' });
    const chromeMount = chromeShadow || chromeHost;

    const titlebarApi = createPopoverTitlebar({
      title: (opts.title && String(opts.title).trim()) || 'KeyPilot Docs',
      shortcut: opts.hintKeyLabel || 'Alt + H',
      icon: 'window',
      variant: 'modal',
      showClose: true,
      onClose: requestClosePopover,
      closeTitle: 'Close (Esc)',
      hint: createTitlebarCloseHint({
        keys: [opts.hintKeyLabel || 'Alt+H', 'Esc'],
        suffix: 'Use the same keyboard navigation controls.'
      }),
      className: 'kpv2-popover-titlebar',
      actions: opts.actions || null
    });
    const header = titlebarApi.titlebar;
    this.popoverCloseButton = titlebarApi.closeButton;

    chromeMount.appendChild(header);
    this.popoverContainer.appendChild(chromeHost);

    const bodyHost = this.createElement('div', {
      className: 'kpv2-docs-host',
      style: `
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: var(--kp-color-bg, #0f0f10);
      `
    });
    const shadow = ensureOpenChromeShadow(bodyHost, { id: 'docs-app' }) || bodyHost.shadowRoot;
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('pages/docs.css');
      shadow.appendChild(link);
    } catch { /* ignore */ }

    this._docsHost = bodyHost;
    this._inPagePopoverKind = 'docs';
    this._docsUnmount = docsUi.mountDocsApp(shadow, {
      embedded: true,
      onClose: requestClosePopover,
      fontScale: this._docsFontScale,
      initialTopic: opts.topicId || null,
      initialHash: opts.hash || null,
      onNavigateDeepLink: typeof opts.onNavigateDeepLink === 'function'
        ? opts.onNavigateDeepLink
        : null
    });
    this.setDocsFontScale(this._docsFontScale);
    this.popoverContainer.appendChild(bodyHost);

    this.popupManager?.showModal?.({
      id: this._popoverPopupId,
      panel: this.popoverContainer,
      onRequestClose: requestClosePopover
    });

    document.body.style.overflow = 'hidden';

    const handlePopoverKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      try {
        const kp = window.__KeyPilotInstance;
        const st = kp?.state?.getState?.();
        if (st?.mode === MODES.TEXT_FOCUS || st?.focusedTextElement) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          kp.handleEscapeFromTextFocus(st);
          return;
        }
      } catch { /* ignore */ }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      requestClosePopover();
    };
    document.addEventListener('keydown', handlePopoverKeyDown, true);
    this.popoverContainer.addEventListener('keydown', handlePopoverKeyDown, true);
    this.popoverKeyHandler = handlePopoverKeyDown;

    try { this.popoverContainer.focus(); } catch { /* ignore */ }
  }

  /**
   * Navigate the open in-page Docs popover to a topic.
   * @param {string} topicId
   * @param {string} [hash]
   * @returns {boolean}
   */
  setDocsTopic(topicId, hash) {
    if (this._inPagePopoverKind !== 'docs') return false;
    return this._docsUi?.navigateDocsApp?.(topicId, hash) || false;
  }

  /**
   * Settings popover without an iframe — same chrome as Docs.
   * @param {object} opts
   * @param {string} [opts.panelId]
   */
  async showInPageSettingsPopover(opts = {}) {
    let settingsUi;
    try {
      settingsUi = await loadSettingsUi();
    } catch (err) {
      console.warn('[KeyPilot] Failed to load Settings UI bundle:', err);
      return;
    }
    this._settingsUi = settingsUi;
    this.hidePopover();

    const requestClosePopover = () => {
      try {
        if (window.__KeyPilotInstance && typeof window.__KeyPilotInstance.handleClosePopover === 'function') {
          window.__KeyPilotInstance.handleClosePopover();
          return;
        }
      } catch { /* ignore */ }
      this.hidePopover();
    };

    this.popoverContainer = this.createElement('div', {
      className: 'kpv2-popover-container kpv2-settings-popover kp-chrome-window',
      tabindex: '-1',
      role: 'dialog',
      'aria-modal': 'true',
      style: `
        position: fixed;
        inset: 0;
        width: ${opts.width || 'calc(100vw - 40pt)'};
        height: ${opts.height || 'calc(100vh - 40pt)'};
        max-width: calc(100vw - 40pt);
        max-height: calc(100vh - 40pt);
        margin: auto;
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: ${NCT_DARK_UI_PANEL_BORDER};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: ${KP_UI_FONT};
        font-size: 14px;
        line-height: 1.3;
        letter-spacing: normal;
      `
    });
    markChromeWindow(this.popoverContainer);

    const chromeHost = this.createElement('div', {
      className: 'kpv2-popover-chrome-host',
      style: `
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        min-height: 0;
      `
    });
    const chromeShadow = ensureOpenChromeShadow(chromeHost, { id: 'settings-popover' });
    const chromeMount = chromeShadow || chromeHost;

    const titlebarApi = createPopoverTitlebar({
      title: (opts.title && String(opts.title).trim()) || 'KeyPilot Settings',
      shortcut: opts.hintKeyLabel || "'",
      icon: 'gear',
      variant: 'modal',
      showClose: true,
      onClose: requestClosePopover,
      closeTitle: 'Close (Esc)',
      hint: createTitlebarCloseHint({
        keys: [opts.hintKeyLabel || "'", 'Esc'],
        suffix: 'Use the same keyboard navigation controls.'
      }),
      className: 'kpv2-popover-titlebar',
      actions: opts.actions || null
    });
    this.popoverCloseButton = titlebarApi.closeButton;
    chromeMount.appendChild(titlebarApi.titlebar);
    this.popoverContainer.appendChild(chromeHost);

    const bodyHost = this.createElement('div', {
      className: 'kpv2-settings-host',
      style: `
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: var(--kp-color-bg, #0f0f10);
      `
    });
    const shadow = ensureOpenChromeShadow(bodyHost, { id: 'settings-app' }) || bodyHost.shadowRoot;
    this._docsHost = null;
    this._inPagePopoverKind = 'settings';
    this._docsUnmount = await settingsUi.mountSettingsApp(shadow, {
      embedded: true,
      onClose: requestClosePopover,
      initialPanel: opts.panelId || null
    });
    this.popoverContainer.appendChild(bodyHost);

    this.popupManager?.showModal?.({
      id: this._popoverPopupId,
      panel: this.popoverContainer,
      onRequestClose: requestClosePopover
    });

    document.body.style.overflow = 'hidden';

    const handlePopoverKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      try {
        const kp = window.__KeyPilotInstance;
        const st = kp?.state?.getState?.();
        if (st?.mode === MODES.TEXT_FOCUS || st?.focusedTextElement) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          kp.handleEscapeFromTextFocus(st);
          return;
        }
      } catch { /* ignore */ }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      requestClosePopover();
    };
    document.addEventListener('keydown', handlePopoverKeyDown, true);
    this.popoverContainer.addEventListener('keydown', handlePopoverKeyDown, true);
    this.popoverKeyHandler = handlePopoverKeyDown;

    try { this.popoverContainer.focus(); } catch { /* ignore */ }
  }

  /**
   * Switch the active panel on the open in-page Settings popover.
   * @param {string} panelId
   * @returns {boolean}
   */
  setSettingsPanel(panelId) {
    if (this._inPagePopoverKind !== 'settings') return false;
    return this._settingsUi?.setActiveSettingsPanel?.(panelId) || false;
  }

  /**
   * Show popover with iframe (extension Guide/settings pages) or OS window (http(s)).
   * http(s) Open Popover always opens a sized OS popup. Settings/Guide keep the
   * in-page iframe overlay with {@link createPopoverTitlebar}.
   *
   * @param {string} url - The URL to load in the popover
   * @param {object} [opts]
   * @param {string} [opts.title] - Optional title for the titlebar (defaults to url)
   * @param {string} [opts.hintKeyLabel] - Optional key label in the titlebar hint (defaults to 'P')
   * @param {boolean} [opts.showClose=true] - Whether to show the titlebar close button
   * @param {string|Node|null} [opts.titlebarHint] - Override titlebar hint (string or Node)
   * @param {HTMLElement|HTMLElement[]|null} [opts.actions] - Controls placed before the close button
   * @param {string[]} [opts.closeKeys] - Keys forwarded from iframe that should request close (defaults to ['Escape','p','P'])
   * @param {string} [opts.width] - Optional fixed width (e.g., '920px', overrides viewport-minus-20pt)
   * @param {string} [opts.height] - Optional fixed height (e.g., '600px', overrides viewport-minus-20pt)
   */
  showPopover(url, opts = {}) {
    // Remove existing popover if any
    this.hidePopover();

    const closeKeys = Array.isArray(opts?.closeKeys) && opts.closeKeys.length
      ? opts.closeKeys.map(String)
      : ['Escape', 'p', 'P'];

    // http(s) always opens in a sized OS popup window.
    if (isHttpPopoverUrl(url)) {
      void this._openPopoverWindow({
        url: preferHttpsForPreview(url),
        kind: 'modal',
        closeKeys
      });
      return;
    }

    const titleText = (opts && typeof opts.title === 'string' && opts.title.trim())
      ? opts.title.trim()
      : String(url || '');
    const hintKeyLabel = (opts && typeof opts.hintKeyLabel === 'string' && opts.hintKeyLabel.trim()) ? opts.hintKeyLabel.trim() : 'P';

    // Centralized close request:
    // Always prefer going through KeyPilot so state (mode/popoverOpen) is updated.
    // Fall back to direct DOM cleanup if KeyPilot isn't available for some reason.
    const requestClosePopover = () => {
      try {
        if (window.__KeyPilotInstance && typeof window.__KeyPilotInstance.handleClosePopover === 'function') {
          window.__KeyPilotInstance.handleClosePopover();
          return;
        }
      } catch (_e) {
        // Ignore and fall back to direct hide
      }
      this.hidePopover();
    };

    const ensureTopMouseTracking = () => {
      if (this._popoverMouseTrackerInstalled) return;
      this._popoverMouseTrackerInstalled = true;
      const update = (e) => {
        try {
          if (!e) return;
          if (typeof e.clientX === 'number') this._popoverLastMouse.x = e.clientX;
          if (typeof e.clientY === 'number') this._popoverLastMouse.y = e.clientY;
        } catch {
          // ignore
        }
      };
      try { document.addEventListener('mousemove', update, true); } catch { /* ignore */ }
      try { document.addEventListener('pointermove', update, true); } catch { /* ignore */ }
    };

    const clickCloseIfHovered = () => {
      try {
        const btn = this.popoverCloseButton;
        if (!btn) return false;
        const x = this._popoverLastMouse.x;
        const y = this._popoverLastMouse.y;
        if (typeof x !== 'number' || typeof y !== 'number') return false;
        const el = document.elementFromPoint(x, y);
        const shadowEl = btn.getRootNode?.()?.elementFromPoint?.(x, y);
        if (el === btn || btn.contains(el) || shadowEl === btn || btn.contains(shadowEl)) {
          try { btn.click(); } catch { /* ignore */ }
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    // Create popover container (NOT using the native Popover API).
    // The Popover API uses the browser "top layer", which can sit above our cursor /
    // green click rectangle regardless of z-index, breaking F-to-click on popover UI.
    this.popoverContainer = this.createElement('div', {
      className: 'kpv2-popover-container kp-chrome-window',
      tabindex: '-1',
      role: 'dialog',
      'aria-modal': 'true',
      style: `
        position: fixed;
        inset: 0;                  /* top: 0; left: 0; bottom: 0; right: 0; */
        width: ${opts.width || 'calc(100vw - 40pt)'};
        height: ${opts.height || 'calc(100vh - 40pt)'};
        max-width: calc(100vw - 40pt);
        max-height: calc(100vh - 40pt);
        margin: auto;              /* this is what centers it perfectly */
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: ${NCT_DARK_UI_PANEL_BORDER};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: ${KP_UI_FONT};
        font-size: 14px;
        line-height: 1.3;
        letter-spacing: normal;
      `
    });
    markChromeWindow(this.popoverContainer);

    // Keep the PopupManager panel and iframe in the light DOM: its focus and
    // resize paths operate on these host-owned nodes. Only KeyPilot-owned
    // titlebar/error chrome is isolated from page CSS in an open shadow root.
    const chromeHost = this.createElement('div', {
      className: 'kpv2-popover-chrome-host',
      style: `
        display: flex;
        flex: 0 0 auto;
        flex-direction: column;
        min-height: 0;
      `
    });
    const chromeShadow = ensureOpenChromeShadow(chromeHost, { id: 'iframe-popover' });
    const chromeMount = chromeShadow || chromeHost;


    // Store iframe reference for focus management
    let iframeRef = null;
    this.popoverBridgeReady = false;

    // Single standard titlebar: title + close hint + uniform × close (no second header bar).
    const showClose = opts?.showClose !== false;
    const titlebarHint = opts?.titlebarHint !== undefined
      ? opts.titlebarHint
      : createTitlebarCloseHint({
        keys: [hintKeyLabel, 'Esc'],
        suffix: 'Use the same keyboard navigation controls.'
      });
    const titlebarApi = createPopoverTitlebar({
      title: titleText,
      shortcut: hintKeyLabel || null,
      icon: 'window',
      variant: 'modal',
      showClose,
      onClose: requestClosePopover,
      closeTitle: 'Close (Esc)',
      hint: titlebarHint,
      className: 'kpv2-popover-titlebar',
      actions: opts?.actions || null
    });
    const header = titlebarApi.titlebar;
    const closeButton = titlebarApi.closeButton;
    this.popoverCloseButton = closeButton;
    ensureTopMouseTracking();

    // Create error message container (initially hidden)
    const errorContainer = this.createElement('div', {
      className: 'kpv2-popover-error',
      style: `
        flex: 1;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        text-align: center;
        background: #f9f9f9;
      `
    });

    const errorIcon = this.createElement('div', {
      style: `
        font-size: 48px;
        margin-bottom: 16px;
        color: #999;
      `
    });
    errorIcon.textContent = '🚫';
    errorContainer.appendChild(errorIcon);

    const errorTitle = this.createElement('div', {
      style: `
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;
      `
    });
    errorTitle.textContent = 'Cannot Display Page';
    errorContainer.appendChild(errorTitle);

    const errorMessage = this.createElement('div', {
      style: `
        font-size: 14px;
        color: #666;
        margin-bottom: 24px;
        max-width: 400px;
      `
    });
    errorMessage.textContent = 'This website prevents embedding in iframes for security reasons.';
    errorContainer.appendChild(errorMessage);

    const openInTabButton = this.createElement('button', {
      style: `
        background: #4CAF50;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      `
    });
    openInTabButton.textContent = 'Open in New Tab';
    openInTabButton.onclick = () => {
      window.open(url, '_blank');
      requestClosePopover();
    };
    errorContainer.appendChild(openInTabButton);

    const iframeStyle = `
        flex: 1;
        border: none;
        width: 100%;
        height: 100%;
      `;
    // Extension Guide/settings pages load immediately via iframe overlay.
    const iframe = this.createElement('iframe', {
      src: url,
      tabindex: '0',
      style: iframeStyle
    });
    iframeRef = iframe;
    this.popoverIframeElement = iframe;
    this.popoverIframeWindow = iframe.contentWindow || null;

    // Initialize the iframe bridge (content script running inside the iframe).
    // We retry a few times because content scripts in the frame may not be ready immediately,
    // and some pages navigate/redirect after initial load.
    // Pass closeKeys so Esc/P work inside the focused iframe without a host click.
    const sendBridgeInit = () => {
      postPopoverBridgeInit(iframe.contentWindow, { closeKeys });
    };

    // Detect iframe load errors
    // Note: We can't reliably detect X-Frame-Options blocking for cross-origin iframes
    // due to same-origin policy. Only show error on actual load failure (onerror event).
    const showLoadError = () => {
      iframe.style.display = 'none';
      chromeHost.style.flex = '1 1 auto';
      errorContainer.style.display = 'flex';
    };

    iframe.onerror = () => {
      console.log('[KeyPilot] Iframe load error detected');
      showLoadError();
    };

    /** @type {ReturnType<typeof setTimeout>|null} */
    let loadTimeout = null;
    const armLoadTimeout = () => {
      if (loadTimeout) {
        try { clearTimeout(loadTimeout); } catch { /* ignore */ }
      }
      loadTimeout = setTimeout(() => {
        console.log('[KeyPilot] Iframe load timeout - showing error as fallback');
        showLoadError();
      }, 30000);
    };

    iframe.onload = () => {
      try {
        const srcAttr = iframe.getAttribute('src') || '';
        if (srcAttr === 'about:blank' || iframe.src === 'about:blank') {
          return;
        }
      } catch { /* ignore */ }
      try { clearTimeout(loadTimeout); } catch { /* ignore */ }
      loadTimeout = null;
      console.log('[KeyPilot] Iframe loaded successfully');
      sendBridgeInit();
      try {
        const childDoc = iframe.contentDocument;
        if (childDoc) {
          window.__KeyPilotInstance?.styleManager?.injectIntoForeignDocument?.(childDoc);
        }
      } catch { /* cross-origin */ }
    };

    chromeMount.appendChild(header);
    chromeMount.appendChild(errorContainer);
    this.popoverContainer.appendChild(chromeHost);
    this.popoverContainer.appendChild(iframe);
    // Mount via PopupManager so the backdrop + stacking are consistent across popups.
    // This also keeps the popup in the normal DOM stacking context (no Popover API top-layer),
    // so KeyPilot overlays (green click rectangle) can sit above it by z-index.
    this.popupManager?.showModal?.({
      id: this._popoverPopupId,
      panel: this.popoverContainer,
      onRequestClose: requestClosePopover
    });

    armLoadTimeout();
    sendBridgeInit();

    // Short retry window to cover slow frames / initial about:blank then navigation
    try {
      let attemptsLeft = 6; // ~1.5s total
      this.popoverInitTimer = setInterval(() => {
        if (!this.popoverContainer || attemptsLeft <= 0) {
          clearInterval(this.popoverInitTimer);
          this.popoverInitTimer = null;
          return;
        }
        attemptsLeft -= 1;
        sendBridgeInit();
      }, 250);
    } catch {
      // Ignore
    }

    // Prevent body scroll when popover is open
    document.body.style.overflow = 'hidden';

    // Add keyboard event listeners directly to catch Escape and F key
    // This ensures they work even when iframe has focus
    const handlePopoverKeyDown = (e) => {
      console.log('[KeyPilot] Popover key event:', e.key, 'Target:', e.target, 'Active element:', document.activeElement);
      
      // Escape key - close popover (always, regardless of where it's pressed)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        requestClosePopover();
        return;
      }
      
      // NOTE: We intentionally do NOT repurpose "F" to close popovers.
      // "F" is KeyPilot's click key, and users expect it to click popover UI (e.g. ×)
      // once the green rectangle can sit above popovers via z-index stacking.
    };

    // Add listeners to document and popover container with capture phase
    // This ensures we catch events even when iframe or other elements have focus
    document.addEventListener('keydown', handlePopoverKeyDown, true);
    this.popoverContainer.addEventListener('keydown', handlePopoverKeyDown, true);
    
    // Store cleanup function and backdrop reference
    this.popoverKeyHandler = handlePopoverKeyDown;

    // Listen for key events forwarded from the iframe (content script bridge).
    // This enables closing the popover even after the user clicks into the iframe,
    // where the parent document can no longer observe keydown events directly.
    this.popoverMessageHandler = (event) => {
      const data = event?.data;
      if (!data || typeof data.type !== 'string') return;
      if (this.popoverIframeWindow && event.source !== this.popoverIframeWindow) return;

      if (data.type === MSG.POPOVER_BRIDGE_READY) {
        this.popoverBridgeReady = true;
        // Auto-focus iframe so full KeyPilot works inside without a user click.
        // Close keys (Esc/P) are handled by the iframe bridge → parent.
        this._focusPopoverIframe(iframeRef);
        this._installPopoverHybridFocus({
          iframe: iframeRef,
          chromeEls: [header, ...titlebarApi.getInteractiveElements()].filter(Boolean),
          focusChromeEl: closeButton || header
        });
        return;
      }

      if (data.type === MSG.POPOVER_REQUEST_CLOSE) {
        // Close on configured keys forwarded by the iframe bridge.
        if (closeKeys.includes(String(data.key))) requestClosePopover();
      }

      if (data.type === MSG.POPOVER_LAUNCH_WALKTHROUGH) {
        // Guide "Launch Walkthrough": close this popover, then open tutorial from reset.
        requestClosePopover();
        try {
          const ob = window.__KeyPilotOnboarding;
          if (ob && typeof ob.resetTutorial === 'function') {
            void ob.resetTutorial();
          }
        } catch {
          // ignore
        }
        return;
      }

      if (data.type === MSG.POPOVER_BRIDGE_KEYDOWN) {
        const k = String(data.key || '');
        if (k === 'f' || k === 'F') {
          // Prefer "click close button if hovered" so users can use F on the × affordance
          // even when focus is inside the iframe (keydown doesn't propagate to parent).
          if (clickCloseIfHovered()) return;
          try {
            window.__KeyPilotInstance?.handleActivateKey?.();
          } catch { /* ignore */ }
        }
      }
    };
    window.addEventListener('message', this.popoverMessageHandler, true);

    // Until the bridge is ready, keep focus on chrome (then hybrid focus takes over).
    try {
      (closeButton || header)?.focus?.();
    } catch (_e) {
      try {
        this.popoverContainer.focus();
      } catch (_e2) {
        // Ignore
      }
    }
  }

  /**
   * Move focus out of the popover (esp. its iframe) before the node is removed.
   * Otherwise Chrome often hands focus to the browser omnibox, which steals keys
   * from the page (notably on New Tab after a second E closes Link Preview).
   */
  _restoreFocusFromPopover() {
    const iframe = this.popoverIframeElement;
    const container = this.popoverContainer;
    if (!iframe && !container) return;

    let active = null;
    try { active = document.activeElement; } catch { /* ignore */ }

    const focusInPopover =
      !!(iframe && active === iframe) ||
      !!(container && active instanceof Node && container.contains(active));

    // Always try to leave the iframe before removal; focus-in-iframe is the
    // main omnibox-steal case even when activeElement reporting is odd.
    try { iframe?.blur?.(); } catch { /* ignore */ }
    if (focusInPopover) {
      try { active?.blur?.(); } catch { /* ignore */ }
    }

    try { window.focus(); } catch { /* ignore */ }

    // Park focus on a surviving element. Prefer body (make it programmatically
    // focusable) so the page keeps keyboard ownership after teardown.
    try {
      const body = document.body;
      if (body) {
        if (!body.hasAttribute('tabindex')) {
          body.setAttribute('tabindex', '-1');
        }
        body.focus({ preventScroll: true });
      }
    } catch { /* ignore */ }
  }

  hidePopover(opts = {}) {
    const closeWindow = opts.closeWindow !== false;

    if (closeWindow) {
      void this._closeTrackedPopoverWindow();
    }

    // Capture focus back onto the page *before* removing a focused iframe.
    try { this._restoreFocusFromPopover(); } catch { /* ignore */ }

    // Stop bridge init retries
    if (this.popoverInitTimer) {
      try {
        clearInterval(this.popoverInitTimer);
      } catch {
        // Ignore
      }
      this.popoverInitTimer = null;
    }

    // Remove iframe bridge message listener
    if (this.popoverMessageHandler) {
      try {
        window.removeEventListener('message', this.popoverMessageHandler, true);
      } catch {
        // Ignore
      }
      this.popoverMessageHandler = null;
    }
    this.popoverIframeWindow = null;
    this.popoverIframeElement = null;
    this.popoverBridgeReady = false;
    this.popoverCloseButton = null;

    if (this._docsUnmount) {
      try { this._docsUnmount(); } catch { /* ignore */ }
      this._docsUnmount = null;
    }
    this._docsHost = null;
    this._inPagePopoverKind = null;

    // Remove keyboard event listeners
    if (this.popoverKeyHandler) {
      document.removeEventListener('keydown', this.popoverKeyHandler, true);

      if (this.popoverContainer) {
        this.popoverContainer.removeEventListener('keydown', this.popoverKeyHandler, true);
      }

      this.popoverKeyHandler = null;
    }

    // Tear down hybrid chrome/iframe focus routing
    if (this._popoverHybridFocusCleanup) {
      try {
        this._popoverHybridFocusCleanup();
      } catch { /* ignore */ }
      this._popoverHybridFocusCleanup = null;
    }

    if (this.popoverContainer) {
      try {
        this.popupManager?.hideModal?.(this._popoverPopupId);
      } catch {
        try { this.popoverContainer.remove(); } catch { /* ignore */ }
      }
      this.popoverContainer = null;
    }

    // After DOM teardown, re-assert page focus (container may have held it).
    try {
      window.focus();
      if (document.body && document.activeElement !== document.body) {
        document.body.focus({ preventScroll: true });
      }
    } catch { /* ignore */ }

    // Restore body scroll (only needed for regular popover, but doesn't hurt)
    document.body.style.overflow = '';
  }

  /**
   * Post a message to the popover iframe bridge (if present).
   * @param {any} message
   * @returns {boolean} Whether a postMessage was attempted successfully
   */
  postMessageToPopoverIframe(message) {
    const win = this.popoverIframeWindow;
    if (!win) return false;
    try {
      win.postMessage(message, '*');
      return true;
    } catch {
      return false;
    }
  }

  scrollPopoverBy(deltaY, behavior = 'smooth') {
    return this.postMessageToPopoverIframe({
      type: MSG.POPOVER_SCROLL,
      command: 'scrollBy',
      delta: deltaY,
      behavior
    });
  }

  scrollPopoverToTop(behavior = 'smooth') {
    return this.postMessageToPopoverIframe({
      type: MSG.POPOVER_SCROLL,
      command: 'scrollToTop',
      behavior
    });
  }

  scrollPopoverToBottom(behavior = 'smooth') {
    return this.postMessageToPopoverIframe({
      type: MSG.POPOVER_SCROLL,
      command: 'scrollToBottom',
      behavior
    });
  }

  /**
   * Check if popover is currently open (overlay iframe or OS popup window).
   * @returns {boolean}
   */
  isPopoverOpen() {
    return this.popoverContainer !== null || this._popoverWindowId != null;
  }

  /**
   * Show Link Preview in a sized OS popup window (windows-only; no in-page iframe).
   * @param {string} url - URL to preview
   * @param {Object} opts - Options including mouseX for window placement
   * @param {string[]} [opts.closeKeys]
   * @param {number} [opts.mouseX]
   */
  async showPreviewPopover(url, opts = {}) {
    this.hidePopover();
    url = preferHttpsForPreview(url);
    await this._openPopoverWindow({
      url,
      kind: 'preview',
      closeKeys: Array.isArray(opts?.closeKeys) && opts.closeKeys.length
        ? opts.closeKeys.map(String)
        : ['Escape', 'e', 'E'],
      mouseX: opts.mouseX
    });
  }
}
