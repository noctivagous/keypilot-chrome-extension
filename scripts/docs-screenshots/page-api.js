/**
 * Injected on the docs-screenshot fixture page.
 * chrome-dev / CDP: Runtime.evaluate `__KP_DOCS_SHOTS.open('settings', { panelId: 'keyboard' })`
 */
(function kpDocsShotsApi() {
  const api = {
    ready() {
      const kp = window.__KeyPilotInstance || window.keyPilot;
      return !!(kp && typeof kp.handleOpenSettingsPopover === 'function');
    },

    reset() {
      const kp = window.__KeyPilotInstance || window.keyPilot;
      if (!kp) return { ok: false, error: 'no KeyPilot' };
      try { kp.handleClosePopover?.(); } catch { /* ignore */ }
      try { kp.handleCloseOmnibox?.(); } catch { /* ignore */ }
      try { kp.launcherPopover?.hide?.(); } catch { /* ignore */ }
      try { kp.topSitesPopover?.hide?.(); } catch { /* ignore */ }
      try {
        if (kp.floatingKeyboardHelp?.isEditMode?.()) {
          kp._toggleKeyboardLayoutConfigurator?.();
        }
      } catch { /* ignore */ }
      try { kp.applyKeyboardHelpVisibility?.(false, { persist: false }); } catch { /* ignore */ }
      try { kp.controlStrip?.setVisible?.(false); } catch { /* ignore */ }
      try {
        document.querySelectorAll('.kpv2-cursor, .kpv2-focus, [data-kp-cursor]').forEach((el) => {
          el.style.setProperty('visibility', 'hidden', 'important');
        });
      } catch { /* ignore */ }
      return { ok: true };
    },

    /**
     * @param {string} kind
     * @param {{ panelId?: string, topicId?: string }} [opts]
     */
    open(kind, opts = {}) {
      const kp = window.__KeyPilotInstance || window.keyPilot;
      if (!kp) return { ok: false, error: 'no KeyPilot' };
      const k = String(kind || '');
      if (k === 'settings') {
        kp.handleOpenSettingsPopover({ panelId: opts.panelId || 'overview' });
      } else if (k === 'docs') {
        kp.handleOpenDocsPopover({ topicId: opts.topicId || 'intro' });
      } else if (k === 'keyboardHelp') {
        kp.applyKeyboardHelpVisibility(true, { persist: false });
      } else if (k === 'layoutConfig') {
        if (!kp.floatingKeyboardHelp?.isEditMode?.()) {
          kp._toggleKeyboardLayoutConfigurator();
        }
      } else if (k === 'controlStrip') {
        kp.setupControlStrip?.();
        kp.controlStrip?.setCollapsed?.(false, { notify: false });
        kp.controlStrip?.setVisible?.(true);
        const root = document.querySelector('.kp-control-strip');
        if (root) {
          root.style.left = '24px';
          root.style.top = '24px';
          root.style.right = 'auto';
          root.style.bottom = 'auto';
        }
      } else if (k === 'omnibox') {
        kp.handleOpenOmnibox();
      } else if (k === 'launcher') {
        kp.launcherPopover?.show?.();
      } else {
        return { ok: false, error: `unknown kind: ${k}` };
      }
      return { ok: true, kind: k };
    },

    /**
     * Viewport box for a light-DOM host (KeyPilot chrome roots live in the page).
     * @param {string} selector
     */
    box(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        visible: r.width > 0 && r.height > 0
      };
    }
  };

  window.__KP_DOCS_SHOTS = api;
})();
