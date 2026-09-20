/**
 * Injected on the store-screenshot fixture page.
 * chrome-dev / CDP: Runtime.evaluate `__KP_STORE_SHOTS.open('key-click-browsing')`
 *
 * KeyPilot chrome lives in open shadow roots and some surfaces (Settings/Docs)
 * live in same-origin iframes. Queries must walk both.
 */
(function kpStoreShotsApi() {
  function kp() {
    return window.__KeyPilotInstance || window.keyPilot || null;
  }

  function waitFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function frameOffset(el) {
    let x = 0;
    let y = 0;
    let win = el?.ownerDocument?.defaultView;
    while (win && win !== window && win.frameElement) {
      const rect = win.frameElement.getBoundingClientRect();
      x += rect.x;
      y += rect.y;
      win = win.parent;
    }
    return { x, y };
  }

  function queryDeep(selector, root = document) {
    if (!selector || !root) return null;
    try {
      const direct = root.querySelector(selector);
      if (direct) return direct;
    } catch { /* invalid selector */ }
    const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const node of nodes) {
      if (node.shadowRoot) {
        const hit = queryDeep(selector, node.shadowRoot);
        if (hit) return hit;
      }
      if (node.tagName === 'IFRAME' || node.tagName === 'FRAME') {
        try {
          const doc = node.contentDocument;
          if (doc) {
            const hit = queryDeep(selector, doc);
            if (hit) return hit;
          }
        } catch { /* cross-origin */ }
      }
    }
    return null;
  }

  function boxOf(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    const rect = el.getBoundingClientRect();
    const offset = frameOffset(el);
    const width = rect.width;
    const height = rect.height;
    return {
      x: rect.x + offset.x,
      y: rect.y + offset.y,
      width,
      height,
      visible: width > 0 && height > 0
    };
  }

  function probe(selectors) {
    return (selectors || []).map((selector) => {
      const el = queryDeep(selector);
      const box = boxOf(el);
      return {
        selector,
        found: Boolean(el),
        visible: Boolean(box?.visible)
      };
    });
  }

  function placeControlStrip() {
    const root = queryDeep('.kp-control-strip');
    if (!root) return;
    root.style.left = '24px';
    root.style.top = '120px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function dismissOnboarding() {
    const close = queryDeep('[data-kp-onboarding-close="true"]');
    if (!close) return false;
    close.click();
    return true;
  }

  function placeKeyboardHelp() {
    const root = queryDeep('.kp-floating-keyboard-help');
    if (!root) return;
    root.style.bottom = '120px';
  }

  function ensureEnabled(instance) {
    try {
      instance.enabled = true;
      instance.toggleHandler?.setEnabled?.(true, false);
      window.__KeyPilotToggleHandler?.setEnabled?.(true, false);
    } catch { /* ignore */ }
  }

  function focusSelector(selector) {
    const instance = kp();
    const el = selector ? queryDeep(selector) : null;
    if (!instance || !el) return false;
    try {
      ensureEnabled(instance);
      if (typeof instance._handleDomHoverChange === 'function') {
        instance._handleDomHoverChange(el);
      } else {
        instance.state?.setFocusElement?.(el);
      }
      instance.updateOverlays?.(el, null, null);
      el.classList.add('kpv2-focus');
      return true;
    } catch {
      return false;
    }
  }

  function pinAction(actionId) {
    const key = queryDeep(`.kp-floating-keyboard-help [data-kp-action-id="${actionId}"]`)
      || queryDeep(`[data-kp-action-id="${actionId}"]`);
    if (!key) return false;
    key.click();
    const pop = queryDeep('.kp-keybindings-popover');
    try {
      pop?.setAttribute?.('data-kp-popover-open', 'true');
      pop?.setAttribute?.('data-kp-popover-pinned', 'true');
      pop?.removeAttribute?.('hidden');
      if (pop && typeof pop.showPopover === 'function' && !pop.matches?.(':popover-open')) {
        pop.showPopover();
      }
    } catch { /* ignore */ }
    return true;
  }

  function selectLibraryTab(tabId) {
    const btn = queryDeep(`.kp-layout-config-panel [data-kp-lib-tab="${tabId}"]`)
      || queryDeep(`[data-kp-lib-tab="${tabId}"]`);
    if (!btn) return false;
    btn.click();
    return true;
  }

  const api = {
    ready() {
      const instance = kp();
      return !!(instance && typeof instance.applyKeyboardHelpVisibility === 'function');
    },

    query: queryDeep,
    probe,
    box(selector) {
      return boxOf(queryDeep(selector));
    },

    reset() {
      const instance = kp();
      if (!instance) return { ok: false, error: 'no KeyPilot' };
      try { instance.handleClosePopover?.(); } catch { /* ignore */ }
      try { instance.handleCloseOmnibox?.(); } catch { /* ignore */ }
      try { instance.launcherPopover?.hide?.(); } catch { /* ignore */ }
      try {
        if (instance.floatingKeyboardHelp?.isEditMode?.()) {
          instance._toggleKeyboardLayoutConfigurator?.();
        }
      } catch { /* ignore */ }
      try { instance.applyKeyboardHelpVisibility?.(false, { persist: false }); } catch { /* ignore */ }
      try { instance.controlStrip?.setVisible?.(false); } catch { /* ignore */ }
      try { instance.state?.setFocusElement?.(null); } catch { /* ignore */ }
      return { ok: true };
    },

    /**
     * @param {string} kind slot id from chrome/slots.json
     */
    async open(kind) {
      const instance = kp();
      if (!instance) return { ok: false, error: 'no KeyPilot' };
      ensureEnabled(instance);
      const k = String(kind || '');

      if (k === 'key-click-browsing') {
        dismissOnboarding();
        instance.setupControlStrip?.();
        instance.controlStrip?.setCollapsed?.(false, { notify: false });
        instance.controlStrip?.setVisible?.(true);
        placeControlStrip();
        instance.applyKeyboardHelpVisibility(true, { persist: false });
        await waitFrame();
        placeKeyboardHelp();
        focusSelector('#kp-store-primary-link');
      } else if (k === 'keyboard-map') {
        dismissOnboarding();
        instance.applyKeyboardHelpVisibility(true, { persist: false });
        await waitFrame();
        placeKeyboardHelp();
        focusSelector('#kp-store-primary-link');
        pinAction('ACTIVATE');
      } else if (k === 'customize-workflow') {
        dismissOnboarding();
        if (!instance.floatingKeyboardHelp?.isEditMode?.()) {
          instance._toggleKeyboardLayoutConfigurator();
        }
        await waitFrame();
        placeKeyboardHelp();
        selectLibraryTab('functions');
      } else {
        return { ok: false, error: `unknown kind: ${k}` };
      }

      return { ok: true, kind: k };
    }
  };

  window.__KP_STORE_SHOTS = api;
})();
