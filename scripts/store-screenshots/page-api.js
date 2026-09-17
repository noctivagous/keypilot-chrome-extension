/**
 * Injected on the store-screenshot fixture page.
 * chrome-dev / CDP: Runtime.evaluate `__KP_STORE_SHOTS.open('key-click-browsing')`
 */
(function kpStoreShotsApi() {
  function kp() {
    return window.__KeyPilotInstance || window.keyPilot || null;
  }

  function waitFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function placeControlStrip() {
    const root = document.querySelector('.kp-control-strip');
    if (!root) return;
    root.style.left = '24px';
    root.style.top = '120px';
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function focusSelector(selector) {
    const instance = kp();
    const el = selector ? document.querySelector(selector) : null;
    if (!instance || !el) return false;
    try {
      instance.state?.setFocusElement?.(el);
      return true;
    } catch {
      return false;
    }
  }

  function pinAction(actionId) {
    const key = document.querySelector(`.kp-floating-keyboard-help [data-kp-action-id="${actionId}"]`);
    if (!key) return false;
    key.click();
    return true;
  }

  function selectLibraryTab(tabId) {
    const btn = document.querySelector(`.kp-layout-config-panel [data-kp-lib-tab="${tabId}"]`);
    if (!btn) return false;
    btn.click();
    return true;
  }

  const api = {
    ready() {
      const instance = kp();
      return !!(instance && typeof instance.applyKeyboardHelpVisibility === 'function');
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
      const k = String(kind || '');

      if (k === 'key-click-browsing') {
        instance.setupControlStrip?.();
        instance.controlStrip?.setCollapsed?.(false, { notify: false });
        instance.controlStrip?.setVisible?.(true);
        placeControlStrip();
        instance.applyKeyboardHelpVisibility(true, { persist: false });
        await waitFrame();
        focusSelector('#kp-store-primary-link');
      } else if (k === 'keyboard-map') {
        instance.applyKeyboardHelpVisibility(true, { persist: false });
        await waitFrame();
        focusSelector('#kp-store-primary-link');
        pinAction('ACTIVATE');
      } else if (k === 'customize-workflow') {
        if (!instance.floatingKeyboardHelp?.isEditMode?.()) {
          instance._toggleKeyboardLayoutConfigurator();
        }
        await waitFrame();
        selectLibraryTab('functions');
      } else {
        return { ok: false, error: `unknown kind: ${k}` };
      }

      return { ok: true, kind: k };
    },

    box(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 };
    }
  };

  window.__KP_STORE_SHOTS = api;
})();
