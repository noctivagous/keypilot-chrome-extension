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
        try {
          const hostToken = selector.match(/^[^\s]+/);
          const rest = hostToken ? selector.slice(hostToken[0].length).trim() : '';
          if (rest && node.matches?.(hostToken[0])) {
            const inner = queryDeep(rest, node.shadowRoot);
            if (inner) return inner;
          }
        } catch { /* ignore */ }
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

  async function dismissOnboarding() {
    const onboarding = window.__KeyPilotOnboarding;
    try { await Promise.resolve(onboarding?.setActive?.(false)); } catch { /* ignore */ }
    try { onboarding?.panel?.hideOverlay?.(); } catch { /* ignore */ }
    const close = queryDeep('[data-kp-onboarding-close="true"]');
    try { close?.click?.(); } catch { /* ignore */ }
    await waitUntil(() => !queryDeep('.kp-onboarding-panel')?.getBoundingClientRect?.().height
      || queryDeep('.kp-onboarding-panel')?.hidden === true, 12);
    return true;
  }

  function placeOnboardingPanel() {
    const root = queryDeep('.kp-onboarding-panel');
    if (!root) return;
    const strip = queryDeep('.kp-control-strip');
    const stripBottom = strip && !strip.hidden ? strip.getBoundingClientRect().bottom : 0;
    const top = Math.max(108, Math.round(stripBottom + 8) || 108);
    root.style.setProperty('top', `${top}px`, 'important');
    root.style.setProperty('left', '16px', 'important');
  }

  function placeWalkthroughKeyboardHelp() {
    const onboarding = queryDeep('.kp-onboarding-panel');
    const root = queryDeep('.kp-floating-keyboard-help');
    if (!onboarding || !root) return false;
    const onboardingRect = onboarding.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const left = Math.max(8, Math.min(24, (window.innerWidth || 1280) - (rootRect.width || root.offsetWidth || 760) - 8));
    const top = Math.round(onboardingRect.bottom + 10);
    const help = kp()?.floatingKeyboardHelp;
    if (help) {
      help._panelPosition = { left, top, anchor: null };
      try { help._applyPanelPositionNow?.(); } catch { /* ignore */ }
    }
    root.style.setProperty('bottom', 'auto', 'important');
    root.style.setProperty('top', `${top}px`, 'important');
    root.style.setProperty('left', `${left}px`, 'important');
    return true;
  }

  async function setupWalkthrough(instance) {
    const ob = window.__KeyPilotOnboarding;
    if (!ob) return { ok: false, error: 'no onboarding' };
    try { instance.controlStrip?.setVisible?.(true); } catch { /* ignore */ }
    placeControlStrip();
    await Promise.resolve(ob.resetTutorial?.());
    await waitUntil(() => Boolean(queryDeep('.kp-onboarding-panel')));
    await waitUntil(() => Boolean(ob.panel?.isOverlayOpen?.())
      || Boolean(queryDeep('button[data-kp-onboarding-overlay-primary="true"]')), 90);
    await waitFrame();
    const primary = queryDeep('button[data-kp-onboarding-overlay-primary="true"]')
      || ob.panel?._overlayPrimaryBtn;
    try { primary?.click(); } catch { /* ignore */ }
    await waitUntil(() => !ob.panel?.isOverlayOpen?.(), 90);
    if (ob.panel?.isOverlayOpen?.()) {
      return { ok: false, error: 'could not dismiss onboarding overlay' };
    }
    instance.applyKeyboardHelpVisibility(true, { persist: false });
    await waitFrame();
    placeOnboardingPanel();
    placeWalkthroughKeyboardHelp();
    await waitFrame();
    placeOnboardingPanel();
    placeWalkthroughKeyboardHelp();
    placeControlStrip();
    placeOnboardingPanel();
    try { instance.handleClosePopover?.(); } catch { /* ignore */ }
    return { ok: true };
  }

  const STORE_BANNER_TOP = 700;
  const STORE_KEYBOARD_GAP = 16;
  const STORE_KEYBOARD_LOWER_PX = 80;
  const STORE_CURSOR_ID = 'kp-store-shot-cursor';

  function placeKeyboardHelp() {
    const root = queryDeep('.kp-floating-keyboard-help');
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const height = Math.max(rect.height || 0, root.offsetHeight || 0, 280);
    const width = Math.max(rect.width || 0, root.offsetWidth || 0, 760);
    const viewportW = window.innerWidth || 1280;
    const bottomLimit = STORE_BANNER_TOP - STORE_KEYBOARD_GAP;
    const top = Math.max(8, bottomLimit - height + STORE_KEYBOARD_LOWER_PX);
    const left = Math.max(8, Math.min(24, viewportW - width - 8));
    const help = kp()?.floatingKeyboardHelp;
    if (help) {
      help._panelPosition = { left, top, anchor: null };
      try { help._applyPanelPositionNow?.(); } catch { /* ignore */ }
    }
    root.style.setProperty('bottom', 'auto', 'important');
    root.style.setProperty('top', `${top}px`, 'important');
    root.style.setProperty('left', `${left}px`, 'important');
  }

  function hideCursor() {
    queryDeep(`#${STORE_CURSOR_ID}`)?.remove();
  }

  function showCursor(selector) {
    hideCursor();
    const el = selector ? queryDeep(selector) : null;
    const box = boxOf(el);
    if (!box?.visible) return false;
    const cursor = document.createElement('div');
    cursor.id = STORE_CURSOR_ID;
    cursor.setAttribute('aria-hidden', 'true');
    const x = box.x + box.width * 0.62;
    const y = box.y + box.height * 0.45;
    cursor.style.cssText = [
      'position:fixed',
      `left:${x}px`,
      `top:${y}px`,
      'width:28px',
      'height:40px',
      'z-index:2147483646',
      'pointer-events:none',
      'filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))'
    ].join(';');
    cursor.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" aria-hidden="true">
      <path fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"
        d="M1.2 1.2 1.2 29.4 8.1 23.6 12.6 36.2 17.4 34.4 13 21.7 22.8 21.7Z"/>
    </svg>`;
    document.documentElement.appendChild(cursor);
    return true;
  }

  const STORE_CONTEXT_MENU_ID = 'kp-store-context-menu';

  function hideContextMenu() {
    document.getElementById(STORE_CONTEXT_MENU_ID)?.remove();
  }

  function i18nMessage(key, substitutions) {
    try {
      const text = chrome?.i18n?.getMessage?.(key, substitutions);
      if (text) return text;
    } catch { /* ignore */ }
    return '';
  }

  function chromePageMenuCopy(locale) {
    const lang = String(locale || '').toLowerCase();
    if (lang.startsWith('es')) {
      return {
        back: 'Atrás',
        forward: 'Adelante',
        reload: 'Volver a cargar',
        saveAs: 'Guardar como…',
        print: 'Imprimir…',
        translate: 'Traducir al español',
        viewSource: 'Ver código fuente de la página',
        inspect: 'Inspeccionar'
      };
    }
    if (lang.startsWith('de')) {
      return {
        back: 'Zurück',
        forward: 'Vorwärts',
        reload: 'Neu laden',
        saveAs: 'Speichern unter…',
        print: 'Drucken…',
        translate: 'Ins Deutsche übersetzen',
        viewSource: 'Seitenquelltext anzeigen',
        inspect: 'Untersuchen'
      };
    }
    if (lang === 'zh_cn' || lang.startsWith('zh-cn')) {
      return {
        back: '后退',
        forward: '前进',
        reload: '重新加载',
        saveAs: '另存为…',
        print: '打印…',
        translate: '翻译成简体中文',
        viewSource: '查看网页源代码',
        inspect: '检查'
      };
    }
    if (lang === 'zh_hk' || lang.startsWith('zh-hk')) {
      return {
        back: '上一頁',
        forward: '下一頁',
        reload: '重新載入',
        saveAs: '另存為…',
        print: '列印…',
        translate: '翻譯成中文（香港）',
        viewSource: '檢視網頁原始碼',
        inspect: '檢查'
      };
    }
    if (lang === 'zh_tw' || lang.startsWith('zh-tw')) {
      return {
        back: '返回',
        forward: '前進',
        reload: '重新載入',
        saveAs: '另存為…',
        print: '列印…',
        translate: '翻譯成繁體中文',
        viewSource: '檢視網頁原始碼',
        inspect: '檢查'
      };
    }
    if (lang.startsWith('ja')) {
      return {
        back: '戻る',
        forward: '進む',
        reload: '再読み込み',
        saveAs: '名前を付けて保存…',
        print: '印刷…',
        translate: '日本語に翻訳',
        viewSource: 'ページのソースを表示',
        inspect: '検証'
      };
    }
    if (lang.startsWith('sk')) {
      return {
        back: 'Späť',
        forward: 'Dopredu',
        reload: 'Znova načítať',
        saveAs: 'Uložiť ako…',
        print: 'Tlačiť…',
        translate: 'Preložiť do slovenčiny',
        viewSource: 'Zobraziť zdrojový kód stránky',
        inspect: 'Skontrolovať'
      };
    }
    return {
      back: 'Back',
      forward: 'Forward',
      reload: 'Reload',
      saveAs: 'Save as…',
      print: 'Print…',
      translate: 'Translate to English',
      viewSource: 'View page source',
      inspect: 'Inspect'
    };
  }

  function contextMenuItem(label, { selected = false, submenu = false, attr = '' } = {}) {
    const fg = selected ? '#fff' : '#202124';
    const bg = selected ? '#1a73e8' : 'transparent';
    const chevron = submenu
      ? `<span style="margin-left:18px;opacity:.9;font-size:11px;line-height:1">▶</span>`
      : '';
    return `<div ${attr} role="menuitem" style="
      display:flex;align-items:center;justify-content:space-between;gap:16px;
      height:28px;padding:0 14px 0 16px;background:${bg};color:${fg};
      font:13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      white-space:nowrap;min-width:220px;">
      <span>${label}</span>${chevron}
    </div>`;
  }

  function contextMenuSeparator() {
    return `<div style="height:9px;display:flex;align-items:center;padding:0 8px">
      <div style="height:1px;width:100%;background:#e8eaed"></div>
    </div>`;
  }

  function contextMenuPanel(html, extra = '') {
    return `<div style="
      background:#fff;border-radius:6px;padding:6px 0;
      box-shadow:0 8px 24px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.08);
      ${extra}">${html}</div>`;
  }

  function setupContextMenu() {
    hideContextMenu();
    const locale = document.body?.getAttribute('data-locale') || 'en';
    const page = chromePageMenuCopy(locale);
    const name = i18nMessage('extension_name') || 'KeyPilot';
    const toggle = i18nMessage('context_menu_toggle_keypilot') || 'Toggle KeyPilot';
    const windows = i18nMessage('context_menu_group_windows') || 'KeyPilot Windows';
    const keyboard = i18nMessage('context_menu_group_keyboard_reference') || 'Keyboard Reference';
    const toggleKb = i18nMessage('context_menu_toggle_keyboard_reference') || 'Toggle Keyboard Reference';
    const tutorial = i18nMessage('context_menu_onboarding_tutorial', ['⌥I']) || 'Onboarding Tutorial (⌥I)';
    const docs = i18nMessage('context_menu_docs_help', ['⌥H']) || 'KeyPilot Documentation (⌥H)';
    const settings = i18nMessage('context_menu_settings', ["'"]) || "KeyPilot Settings (')";

    const root = document.createElement('div');
    root.id = STORE_CONTEXT_MENU_ID;
    root.setAttribute('data-kp-store-context-menu', 'true');
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none';
    root.innerHTML = `
      <div style="position:absolute;left:360px;top:132px;display:flex;align-items:flex-end">
        ${contextMenuPanel(`
          ${contextMenuItem(page.back)}
          ${contextMenuItem(page.forward)}
          ${contextMenuItem(page.reload)}
          ${contextMenuSeparator()}
          ${contextMenuItem(page.saveAs)}
          ${contextMenuItem(page.print)}
          ${contextMenuSeparator()}
          ${contextMenuItem(page.translate)}
          ${contextMenuSeparator()}
          ${contextMenuItem(page.viewSource)}
          ${contextMenuItem(page.inspect)}
          ${contextMenuSeparator()}
          ${contextMenuItem(name, { selected: true, submenu: true, attr: 'data-kp-store-ctx-keypilot="true"' })}
        `)}
        ${contextMenuPanel(`
          ${contextMenuItem(toggle)}
          ${contextMenuItem(windows, { selected: true, submenu: true, attr: 'data-kp-store-ctx-windows-row="true"' })}
          ${contextMenuItem(keyboard, { submenu: true })}
        `, 'margin-left:2px')}
        ${contextMenuPanel(`
          ${contextMenuItem(toggleKb)}
          ${contextMenuItem(tutorial)}
          ${contextMenuItem(docs, { selected: true, attr: 'data-kp-store-ctx-docs="true"' })}
          ${contextMenuItem(settings, { attr: 'data-kp-store-ctx-settings="true"' })}
        `, 'margin-left:2px;margin-bottom:28px')}
      </div>`;
    document.documentElement.appendChild(root);
    const cursor = document.createElement('div');
    cursor.id = STORE_CURSOR_ID;
    cursor.setAttribute('aria-hidden', 'true');
    cursor.style.cssText = [
      'position:fixed',
      'left:344px',
      'top:428px',
      'width:28px',
      'height:40px',
      'z-index:2147483646',
      'pointer-events:none',
      'filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))'
    ].join(';');
    cursor.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" aria-hidden="true">
      <path fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"
        d="M1.2 1.2 1.2 29.4 8.1 23.6 12.6 36.2 17.4 34.4 13 21.7 22.8 21.7Z"/>
    </svg>`;
    document.documentElement.appendChild(cursor);
    return true;
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

  function configPanel() {
    const help = kp()?.floatingKeyboardHelp;
    try {
      const panel = help?._getConfigPanel?.();
      if (panel) return panel;
    } catch { /* ignore */ }
    return null;
  }

  async function waitUntil(test, frames = 45) {
    for (let i = 0; i < frames; i += 1) {
      try {
        if (test()) return true;
      } catch { /* ignore */ }
      await waitFrame();
    }
    return false;
  }

  const CLOSE_TAB_ITEM = { type: 'function', id: 'CLOSE_TAB' };
  const PLACE_SLOT = 'code:KeyE';

  function closeTabSourceEl() {
    return queryDeep(`.kp-layout-config-panel .key[data-kp-item-id="${CLOSE_TAB_ITEM.id}"]`)
      || queryDeep(`.kp-layout-config-panel [data-kp-item-id="${CLOSE_TAB_ITEM.id}"]`);
  }

  function placeSlotEl() {
    return queryDeep(`.kp-floating-keyboard-help [data-kp-slot="${PLACE_SLOT}"]`);
  }

  function syncCustomizePlaceScene() {
    placeKeyboardHelp();
    const panel = configPanel();
    const help = kp()?.floatingKeyboardHelp;
    const source = closeTabSourceEl();
    try { source?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch { /* ignore */ }
    try { help?.setPlaceHoverSlot?.(PLACE_SLOT); } catch { /* ignore */ }
    const dest = placeSlotEl();
    if (panel && typeof panel._updatePlaceArrow === 'function' && source && dest) {
      const from = source.getBoundingClientRect();
      const to = dest.getBoundingClientRect();
      panel._updatePlaceArrow(
        from.left + from.width / 2,
        from.top + from.height / 2,
        to.left + to.width / 2,
        to.top + to.height / 2
      );
    }
    return {
      ok: true,
      placeActive: Boolean(panel?.isPlaceModeActive?.()),
      inspecting: Boolean(panel?._inspectorSelection?.id === CLOSE_TAB_ITEM.id),
      preview: Boolean(placeSlotEl()?.classList?.contains('kp-place-preview')),
      arrow: Boolean(queryDeep('.kp-layout-place-arrow'))
    };
  }

  async function setupCustomizeWorkflow(instance) {
    if (!instance.floatingKeyboardHelp?.isEditMode?.()) {
      instance._toggleKeyboardLayoutConfigurator();
    }
    await waitUntil(() => Boolean(queryDeep('.kp-layout-config-panel')));
    await waitFrame();
    placeKeyboardHelp();
    await waitFrame();
    placeKeyboardHelp();
    selectLibraryTab('functions');
    await waitUntil(() => Boolean(closeTabSourceEl()));
    const panel = configPanel();
    if (!panel) return;
    const source = closeTabSourceEl();
    try { source?.scrollIntoView?.({ block: 'center', inline: 'nearest' }); } catch { /* ignore */ }
    await waitFrame();
    try { panel._inspectItem?.(CLOSE_TAB_ITEM); } catch { /* ignore */ }
    await waitFrame();
    if (!panel.isPlaceModeActive?.()) {
      try {
        const keyEl = closeTabSourceEl();
        if (typeof panel._beginPlaceModeFromLibrary === 'function') {
          panel._beginPlaceModeFromLibrary(CLOSE_TAB_ITEM);
        } else {
          panel._beginPlaceMode?.(CLOSE_TAB_ITEM, keyEl);
        }
      } catch { /* ignore */ }
    }
    await waitFrame();
    syncCustomizePlaceScene();
    showCursor(`.kp-floating-keyboard-help [data-kp-slot="${PLACE_SLOT}"]`);
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
    focusSelector,
    placeKeyboardHelp,
    placeOnboardingPanel,
    placeWalkthroughKeyboardHelp,
    showCursor,
    hideCursor,
    syncCustomizePlaceScene,

    async reset() {
      const instance = kp();
      if (!instance) return { ok: false, error: 'no KeyPilot' };
      try { instance.handleClosePopover?.(); } catch { /* ignore */ }
      try {
        const pop = queryDeep('.kp-keybindings-popover');
        pop?.hidePopover?.();
        pop?.setAttribute('hidden', '');
        pop?.removeAttribute('data-kp-popover-open');
        pop?.removeAttribute('data-kp-popover-pinned');
      } catch { /* ignore */ }
      try { instance.handleCloseOmnibox?.(); } catch { /* ignore */ }
      try { instance.launcherPopover?.hide?.(); } catch { /* ignore */ }
      try {
        if (instance.floatingKeyboardHelp?.isEditMode?.()) {
          instance._toggleKeyboardLayoutConfigurator?.();
        }
      } catch { /* ignore */ }
      try { await dismissOnboarding(); } catch { /* ignore */ }
      try { instance.applyKeyboardHelpVisibility?.(false, { persist: false }); } catch { /* ignore */ }
      try { instance.controlStrip?.setVisible?.(false); } catch { /* ignore */ }
      try { instance.state?.setFocusElement?.(null); } catch { /* ignore */ }
      hideContextMenu();
      hideCursor();
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
        await dismissOnboarding();
        instance.applyKeyboardHelpVisibility(true, { persist: false });
        await waitFrame();
        placeKeyboardHelp();
        await waitFrame();
        placeKeyboardHelp();
        focusSelector('#kp-store-local-nav');
        showCursor('#kp-store-local-nav');
      } else if (k === 'keyboard-map') {
        await dismissOnboarding();
        instance.applyKeyboardHelpVisibility(true, { persist: false });
        await waitFrame();
        placeKeyboardHelp();
        await waitFrame();
        placeKeyboardHelp();
        focusSelector('#kp-store-primary-link');
        pinAction('PREVIEW_LINK_POPOVER');
      } else if (k === 'customize-workflow') {
        await dismissOnboarding();
        await setupCustomizeWorkflow(instance);
      } else if (k === 'walkthrough') {
        const scene = await setupWalkthrough(instance);
        if (scene && scene.ok === false) return scene;
      } else if (k === 'context-menu') {
        await dismissOnboarding();
        setupContextMenu();
      } else {
        return { ok: false, error: `unknown kind: ${k}` };
      }

      return { ok: true, kind: k };
    }
  };

  window.__KP_STORE_SHOTS = api;
})();
