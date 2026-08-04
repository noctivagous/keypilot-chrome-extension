import { CURSOR_MODE } from '../src/config/constants.js';
import { normalizeKeyboardLayoutId } from '../src/config/keyboard-layouts.js';
import { SEARCH_ENGINE_META } from '../src/config/search-engines.js';
import { CLICK_EFFECT_IDS, DEFAULT_SETTINGS, getSettings, normalizeCursorMode, normalizeFocusColor, normalizeSearchEngine, normalizeTextFocusStyle, setSettings, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { GENERIC_FAVICON_DATA_URL, getExtensionFaviconUrl } from '../src/ui/url-listing.js';
import { startKeyPilotOnPage } from './keypilot-page-init.js';
import { CursorManager } from '../src/modules/cursor.js';

/**
 * Use Chrome's extension favicon endpoint (img-src 'self') instead of
 * google.com/s2/favicons, which redirects to t2.gstatic.com and is CSP-blocked.
 */
function applySearchEngineIcons() {
  const icons = document.querySelectorAll('img.radio-icon[data-favicon-for]');
  icons.forEach((img) => {
    const id = img.getAttribute('data-favicon-for');
    const meta = id && SEARCH_ENGINE_META[id] ? SEARCH_ENGINE_META[id] : null;
    const pageUrl = meta?.homeUrl || '';
    if (!pageUrl) {
      img.src = GENERIC_FAVICON_DATA_URL;
      return;
    }
    img.src = getExtensionFaviconUrl(pageUrl, 32);
    img.addEventListener('error', () => {
      img.src = GENERIC_FAVICON_DATA_URL;
    }, { once: true });
  });
}

function postCloseRequest() {
  try {
    window.parent.postMessage({ type: 'KP_POPOVER_REQUEST_CLOSE', key: 'Escape' }, '*');
  } catch {
    // ignore
  }
}

/**
 * When Settings is embedded in the KeyPilot iframe popover, the outer chrome
 * already provides a standard titlebar + × close. Hide the in-page header so
 * we don't stack two header bars.
 */
function adaptHeaderForPopoverEmbed() {
  try {
    const embedded = window.parent && window.parent !== window;
    if (!embedded) return;
    document.documentElement.classList.add('kp-popover-embed');
    document.body?.classList?.add('kp-popover-embed');
    const header = document.querySelector('.settings-app > .header');
    if (header) {
      header.hidden = true;
      header.setAttribute('aria-hidden', 'true');
    }
  } catch {
    // ignore
  }
}

const SETTINGS_TAB_STORAGE_KEY = 'kp_settings_active_tab';
const SETTINGS_PANEL_IDS = Object.freeze([
  'search',
  'keyboard',
  'cursor',
  'scrolling',
  'click-mode',
  'text-mode',
  'control-strip',
  'about'
]);

/**
 * Master–detail left tabs: show one panel, update ARIA + optional persistence.
 * @param {string} panelId
 * @param {{ focusTab?: boolean, persist?: boolean }} [opts]
 */
function activateSettingsPanel(panelId, opts = {}) {
  const id = SETTINGS_PANEL_IDS.includes(panelId) ? panelId : 'search';
  const tabs = Array.from(document.querySelectorAll('.settings-tab[data-panel]'));
  const panels = Array.from(document.querySelectorAll('.settings-panel[data-panel]'));

  tabs.forEach((tab) => {
    const selected = tab.getAttribute('data-panel') === id;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
    if (selected && opts.focusTab) {
      try { tab.focus(); } catch { /* ignore */ }
    }
  });

  panels.forEach((panel) => {
    const selected = panel.getAttribute('data-panel') === id;
    panel.classList.toggle('is-active', selected);
    if (selected) {
      panel.hidden = false;
      panel.removeAttribute('hidden');
    } else {
      panel.hidden = true;
    }
  });

  if (opts.persist !== false) {
    try {
      sessionStorage.setItem(SETTINGS_TAB_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  // Scroll detail pane to top when switching sections.
  try {
    const detail = document.querySelector('.settings-detail');
    if (detail) detail.scrollTop = 0;
  } catch {
    // ignore
  }
}

function installSettingsMasterDetailNav() {
  const nav = document.querySelector('.settings-nav');
  const tabs = Array.from(document.querySelectorAll('.settings-tab[data-panel]'));
  if (!nav || tabs.length === 0) return;

  let initial = 'search';
  try {
    const hash = (location.hash || '').replace(/^#/, '');
    if (SETTINGS_PANEL_IDS.includes(hash)) {
      initial = hash;
    } else {
      const stored = sessionStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
      if (stored && SETTINGS_PANEL_IDS.includes(stored)) initial = stored;
    }
  } catch {
    // ignore
  }

  activateSettingsPanel(initial, { persist: false });

  // Bind clicks on each tab, not the nav container.
  // A delegated click listener on `.settings-nav` is tracked by KeyPilot as a
  // click handler on the whole master column, so empty padding/gaps become one
  // giant green focus rectangle instead of only the list items.
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const panelId = tab.getAttribute('data-panel');
      withOptionalViewTransition(() => activateSettingsPanel(panelId));
    });
  });

  // Arrow-key navigation within the vertical tablist (ARIA tabs pattern).
  nav.addEventListener('keydown', (e) => {
    if (!e) return;
    const key = e.key;
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
    const currentIndex = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (key === 'ArrowDown') nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
    if (key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
    if (key === 'Home') nextIndex = 0;
    if (key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex) return;

    e.preventDefault();
    const panelId = tabs[nextIndex].getAttribute('data-panel');
    withOptionalViewTransition(() => activateSettingsPanel(panelId, { focusTab: true }));
  });
}

function clampNumber(n, min, max) {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(Math.max(v, min), max);
}

function setInputValue(el, value) {
  if (!el) return;
  el.value = String(value);
}

function renderCursorPreview({ container, kind, uri }) {
  if (!container) return;
  container.style.cursor = '';
  container.innerHTML = '';
  if (kind === 'native_arrow') {
    container.style.cursor = 'default';
    container.textContent = 'Uses native cursor (arrow)';
    return;
  }
  if (kind === 'native_pointer') {
    container.style.cursor = 'pointer';
    container.textContent = 'Uses native cursor (pointer)';
    return;
  }
  if (!uri) {
    container.textContent = 'Preview unavailable';
    return;
  }
  const img = document.createElement('img');
  img.alt = 'Cursor preview';
  img.src = uri;
  container.appendChild(img);
}

function applyVisibility(el, visible) {
  if (!el) return;
  el.hidden = !visible;
  // Some pages override [hidden]{display:none}; guard with inline display too.
  el.style.display = visible ? '' : 'none';
}

function withOptionalViewTransition(fn) {
  try {
    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => {
        try { fn(); } catch { /* ignore */ }
      });
      return;
    }
  } catch {
    // ignore
  }
  fn();
}

async function render() {
  adaptHeaderForPopoverEmbed();
  applySearchEngineIcons();

  // Start KeyPilot inside the Settings page (this page is often loaded in an iframe popover).
  await startKeyPilotOnPage({ allowInIframe: true });

  installSettingsMasterDetailNav();

  const radios = Array.from(document.querySelectorAll('input[type="radio"][name="engine"]'));
  const keyFeedbackToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('keyboard-reference-key-feedback'));
  const keyboardLayoutSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('keyboard-layout'));
  const controlStripVisible = /** @type {HTMLInputElement|null} */ (document.getElementById('control-strip-visible'));
  const controlStripCollapsed = /** @type {HTMLInputElement|null} */ (document.getElementById('control-strip-collapsed'));
  const openGuideBtn = document.getElementById('open-guide');
  const closeBtn = document.getElementById('close');

  // Cursor mode controls
  const cursorModeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('cursor-mode'));
  const cursorSettingsClick = document.getElementById('cursor-settings-click');
  const cursorSettingsText = document.getElementById('cursor-settings-text');

  // Mode Settings controls
  const clickCursorType = /** @type {HTMLSelectElement|null} */ (document.getElementById('click-cursor-type'));
  const clickCursorLineWidthRange = /** @type {HTMLInputElement|null} */ (document.getElementById('click-cursor-linewidth-range'));
  const clickCursorLineWidthNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('click-cursor-linewidth-number'));
  const clickCursorSizeRange = /** @type {HTMLInputElement|null} */ (document.getElementById('click-cursor-size-range'));
  const clickCursorSizeNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('click-cursor-size-number'));
  const clickCursorGapRange = /** @type {HTMLInputElement|null} */ (document.getElementById('click-cursor-gap-range'));
  const clickCursorGapNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('click-cursor-gap-number'));
  const clickCursorPreview = document.getElementById('click-cursor-preview');
  const clickFocusColor = /** @type {HTMLSelectElement|null} */ (document.getElementById('click-focus-color'));
  const clickOverlayFill = /** @type {HTMLInputElement|null} */ (document.getElementById('click-overlay-fill'));
  const clickOverlayShadow = /** @type {HTMLInputElement|null} */ (document.getElementById('click-overlay-shadow'));
  const clickRectThicknessRange = /** @type {HTMLInputElement|null} */ (document.getElementById('click-rect-thickness-range'));
  const clickRectThicknessNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('click-rect-thickness-number'));
  const clickEffectRadios = /** @type {HTMLInputElement[]} */ (Array.from(document.querySelectorAll('input[name="click-effect"]')));
  const clickCursorResetBtn = document.getElementById('click-cursor-reset');
  const clickModeResetBtn = document.getElementById('click-mode-reset');

  const textCursorType = /** @type {HTMLSelectElement|null} */ (document.getElementById('text-cursor-type'));
  const textCursorPreview = document.getElementById('text-cursor-preview');
  const textCursorResetBtn = document.getElementById('text-cursor-reset');
  const textFocusStyleRadios = /** @type {HTMLInputElement[]} */ (Array.from(document.querySelectorAll('input[name="text-focus-style"]')));
  const textLabelsEnabled = /** @type {HTMLInputElement|null} */ (document.getElementById('text-labels-enabled'));
  const textStrokeThicknessRange = /** @type {HTMLInputElement|null} */ (document.getElementById('text-stroke-thickness-range'));
  const textStrokeThicknessNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('text-stroke-thickness-number'));
  const textModeResetBtn = document.getElementById('text-mode-reset');

  // Scrolling controls (C / V distance + animation speed)
  const scrollHalfPageRange = /** @type {HTMLInputElement|null} */ (document.getElementById('scroll-half-page-range'));
  const scrollHalfPageNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('scroll-half-page-number'));
  const scrollSpeedSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('scroll-speed'));
  const scrollResetBtn = document.getElementById('scroll-reset');

  const previewCursor = new CursorManager();

  // Ensure F works even when focus is on non-text controls (e.g. radio inputs).
  const isTextEntry = (target) => {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase?.();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = String(target.getAttribute?.('type') || target.type || 'text').toLowerCase();
      return type === 'text' || type === 'search' || type === 'url' || type === 'email' || type === 'tel' || type === 'password' || type === 'number';
    }
    return !!target.isContentEditable;
  };

  // In Settings we want "F" to activate even when focus is on non-text controls.
  // However, KeyPilot itself also binds "F" globally; if both run, checkboxes can toggle twice.
  // Run this handler in bubble phase and bail if KeyPilot already handled/prevented the event.
  document.addEventListener('keydown', (e) => {
    if (!e) return;
    if (e.key !== 'f' && e.key !== 'F') return;
    if (isTextEntry(e.target)) return;
    if (e.defaultPrevented) return;
    // If something already stopped propagation (likely KeyPilot), don't double-activate.
    if (e.cancelBubble) return;
    const kp = window.__KeyPilotInstance;
    if (!kp || typeof kp.handleActivateKey !== 'function') return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    try { kp.handleActivateKey(); } catch { /* ignore */ }
  }, false);

  const applyEngine = (engine) => {
    const normalized = normalizeSearchEngine(engine);
    radios.forEach((r) => {
      r.checked = r.value === normalized;
    });
  };

  const applyKeyFeedbackToggle = (enabled) => {
    if (!keyFeedbackToggle) return;
    keyFeedbackToggle.checked = !!enabled;
  };

  const applyControlStrip = (controlStrip) => {
    const cs = controlStrip || DEFAULT_SETTINGS.controlStrip;
    if (controlStripVisible) controlStripVisible.checked = !!cs?.visible;
    if (controlStripCollapsed) controlStripCollapsed.checked = !!cs?.collapsed;
  };

  const applyKeyboardLayout = (layoutId) => {
    if (!keyboardLayoutSelect) return;
    const v = normalizeKeyboardLayoutId(layoutId);
    setInputValue(keyboardLayoutSelect, v);
  };

  const applyCursorMode = (cursorMode) => {
    const mode = normalizeCursorMode(cursorMode);
    setInputValue(cursorModeSelect, mode);

    const showCursorSettings = mode === CURSOR_MODE.CUSTOM_CURSORS;
    applyVisibility(cursorSettingsClick, showCursorSettings);
    applyVisibility(cursorSettingsText, showCursorSettings);
  };

  const applyClickMode = (clickMode) => {
    const cm = clickMode || DEFAULT_SETTINGS.clickMode;
    setInputValue(clickCursorType, cm?.cursor?.type ?? DEFAULT_SETTINGS.clickMode.cursor.type);
    setInputValue(clickCursorLineWidthRange, cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth);
    setInputValue(clickCursorLineWidthNumber, cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth);
    setInputValue(clickCursorSizeRange, cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels);
    setInputValue(clickCursorSizeNumber, cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels);
    setInputValue(clickCursorGapRange, cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap);
    setInputValue(clickCursorGapNumber, cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap);
    setInputValue(
      clickFocusColor,
      normalizeFocusColor(cm?.focusColor ?? DEFAULT_SETTINGS.clickMode.focusColor)
    );
    if (clickOverlayFill) {
      clickOverlayFill.checked = cm?.overlayFillEnabled === true;
    }
    if (clickOverlayShadow) {
      clickOverlayShadow.checked = cm?.overlayShadowEnabled === true;
    }
    setInputValue(clickRectThicknessRange, cm?.rectangleThickness ?? DEFAULT_SETTINGS.clickMode.rectangleThickness);
    setInputValue(clickRectThicknessNumber, cm?.rectangleThickness ?? DEFAULT_SETTINGS.clickMode.rectangleThickness);

    const effect = cm?.clickEffect ?? DEFAULT_SETTINGS.clickMode.clickEffect ?? 'flash';
    clickEffectRadios.forEach((r) => {
      r.checked = r.value === effect;
    });

    const type = cm?.cursor?.type ?? DEFAULT_SETTINGS.clickMode.cursor.type;
    if (type === 'native_arrow' || type === 'native_pointer') {
      renderCursorPreview({ container: clickCursorPreview, kind: type });
    } else {
      const strokeWidth = cm?.cursor?.lineWidth ?? DEFAULT_SETTINGS.clickMode.cursor.lineWidth;
      const sizePixels = cm?.cursor?.sizePixels ?? DEFAULT_SETTINGS.clickMode.cursor.sizePixels;
      const gap = cm?.cursor?.gap ?? DEFAULT_SETTINGS.clickMode.cursor.gap;
      const uri = previewCursor.getCursorDataUri('none', {
        strokeWidth,
        crossHairQuadrantWidth: sizePixels,
        gap: gap
      });
      renderCursorPreview({ container: clickCursorPreview, kind: 'crosshair', uri });
    }
  };

  const applyTextMode = (textMode) => {
    const tm = textMode || DEFAULT_SETTINGS.textMode;
    setInputValue(textCursorType, tm?.cursorType ?? DEFAULT_SETTINGS.textMode.cursorType);
    if (textLabelsEnabled) textLabelsEnabled.checked = !!tm?.labelsEnabled;
    setInputValue(textStrokeThicknessRange, tm?.strokeThickness ?? DEFAULT_SETTINGS.textMode.strokeThickness);
    setInputValue(textStrokeThicknessNumber, tm?.strokeThickness ?? DEFAULT_SETTINGS.textMode.strokeThickness);

    const focusStyle = normalizeTextFocusStyle(tm?.focusStyle ?? DEFAULT_SETTINGS.textMode.focusStyle);
    textFocusStyleRadios.forEach((r) => {
      r.checked = r.value === focusStyle;
    });

    const type = tm?.cursorType ?? DEFAULT_SETTINGS.textMode.cursorType;
    if (type === 'crosshair') {
      const uri = previewCursor.getCursorDataUri('text_focus', { hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: 'crosshair', uri });
    } else {
      const uri = previewCursor.getCursorDataUri('text_focus', { cursorType: 't_square', hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: 't_square', uri });
    }
  };

  const applyScroll = (scroll) => {
    const sc = scroll || DEFAULT_SETTINGS.scroll;
    const half = sc?.halfPagePx ?? DEFAULT_SETTINGS.scroll.halfPagePx;
    const speed = sc?.speed === 'instant' ? 'instant' : 'smooth';
    setInputValue(scrollHalfPageRange, half);
    setInputValue(scrollHalfPageNumber, half);
    setInputValue(scrollSpeedSelect, speed);
  };

  // Initial state
  try {
    const settings = await getSettings();
    applyEngine(settings.searchEngine);
    applyCursorMode(settings.cursorMode);
    applyKeyboardLayout(settings.keyboardLayoutId);
    applyKeyFeedbackToggle(settings.keyboardReferenceKeyFeedback);
    applyControlStrip(settings.controlStrip);
    applyClickMode(settings.clickMode);
    applyTextMode(settings.textMode);
    applyScroll(settings.scroll);
  } catch {
    applyEngine('brave');
    applyCursorMode(DEFAULT_SETTINGS.cursorMode);
    applyKeyboardLayout(DEFAULT_SETTINGS.keyboardLayoutId);
    applyKeyFeedbackToggle(true);
    applyControlStrip(DEFAULT_SETTINGS.controlStrip);
    applyClickMode(DEFAULT_SETTINGS.clickMode);
    applyTextMode(DEFAULT_SETTINGS.textMode);
    applyScroll(DEFAULT_SETTINGS.scroll);
  }

  // Change handler
  radios.forEach((r) => {
    r.addEventListener('change', async () => {
      if (!r.checked) return;
      await setSettings({ searchEngine: r.value });
    }, true);
  });

  keyFeedbackToggle?.addEventListener('change', async () => {
    await setSettings({ keyboardReferenceKeyFeedback: !!keyFeedbackToggle.checked });
  }, true);

  controlStripVisible?.addEventListener('change', async () => {
    await setSettings({ controlStrip: { visible: !!controlStripVisible.checked } });
  }, true);

  controlStripCollapsed?.addEventListener('change', async () => {
    await setSettings({ controlStrip: { collapsed: !!controlStripCollapsed.checked } });
  }, true);

  keyboardLayoutSelect?.addEventListener('change', async () => {
    await setSettings({ keyboardLayoutId: keyboardLayoutSelect.value });
    const s = await getSettings();
    withOptionalViewTransition(() => applyKeyboardLayout(s.keyboardLayoutId));
  }, true);

  cursorModeSelect?.addEventListener('change', async () => {
    const next = normalizeCursorMode(cursorModeSelect.value);
    await setSettings({ cursorMode: next });
    const s = await getSettings();
    withOptionalViewTransition(() => applyCursorMode(s.cursorMode));
  }, true);

  // Click Mode handlers
  clickCursorType?.addEventListener('change', async () => {
    await setSettings({ clickMode: { cursor: { type: clickCursorType.value } } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  const commitClickLineWidth = async (v) => {
    const n = clampNumber(v, 1, 12);
    setInputValue(clickCursorLineWidthRange, n);
    setInputValue(clickCursorLineWidthNumber, n);
    await setSettings({ clickMode: { cursor: { lineWidth: n } } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  };

  clickCursorLineWidthRange?.addEventListener('input', async () => commitClickLineWidth(clickCursorLineWidthRange.value), true);
  clickCursorLineWidthNumber?.addEventListener('input', async () => commitClickLineWidth(clickCursorLineWidthNumber.value), true);

  const commitClickSize = async (v) => {
    const n = clampNumber(v, 5, 60);
    setInputValue(clickCursorSizeRange, n);
    setInputValue(clickCursorSizeNumber, n);
    await setSettings({ clickMode: { cursor: { sizePixels: n } } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  };

  clickCursorSizeRange?.addEventListener('input', async () => commitClickSize(clickCursorSizeRange.value), true);
  clickCursorSizeNumber?.addEventListener('input', async () => commitClickSize(clickCursorSizeNumber.value), true);

  const commitClickGap = async (v) => {
    const n = clampNumber(v, 0, 20);
    setInputValue(clickCursorGapRange, n);
    setInputValue(clickCursorGapNumber, n);
    await setSettings({ clickMode: { cursor: { gap: n } } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  };

  clickCursorGapRange?.addEventListener('input', async () => commitClickGap(clickCursorGapRange.value), true);
  clickCursorGapNumber?.addEventListener('input', async () => commitClickGap(clickCursorGapNumber.value), true);

  clickFocusColor?.addEventListener('change', async () => {
    const color = normalizeFocusColor(clickFocusColor.value);
    await setSettings({ clickMode: { focusColor: color } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  clickOverlayFill?.addEventListener('change', async () => {
    await setSettings({ clickMode: { overlayFillEnabled: !!clickOverlayFill.checked } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  clickOverlayShadow?.addEventListener('change', async () => {
    await setSettings({ clickMode: { overlayShadowEnabled: !!clickOverlayShadow.checked } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  const commitClickRectThickness = async (v) => {
    const n = clampNumber(v, 1, 16);
    setInputValue(clickRectThicknessRange, n);
    setInputValue(clickRectThicknessNumber, n);
    await setSettings({ clickMode: { rectangleThickness: n } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  };

  clickRectThicknessRange?.addEventListener('input', async () => commitClickRectThickness(clickRectThicknessRange.value), true);
  clickRectThicknessNumber?.addEventListener('input', async () => commitClickRectThickness(clickRectThicknessNumber.value), true);

  clickEffectRadios.forEach((radio) => {
    radio.addEventListener('change', async () => {
      if (!radio.checked) return;
      const value = CLICK_EFFECT_IDS.includes(/** @type {any} */ (radio.value))
        ? radio.value
        : 'flash';
      await setSettings({ clickMode: { clickEffect: value } });
      const s = await getSettings();
      applyClickMode(s.clickMode);
    }, true);
  });

  clickCursorResetBtn?.addEventListener('click', async () => {
    await setSettings({ clickMode: { cursor: { ...DEFAULT_SETTINGS.clickMode.cursor } } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  clickModeResetBtn?.addEventListener('click', async () => {
    await setSettings({
      clickMode: {
        ...DEFAULT_SETTINGS.clickMode,
        cursor: { ...DEFAULT_SETTINGS.clickMode.cursor }
      }
    });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  // Text Mode handlers
  textCursorType?.addEventListener('change', async () => {
    await setSettings({ textMode: { cursorType: textCursorType.value } });
    const s = await getSettings();
    applyTextMode(s.textMode);
  }, true);

  textCursorResetBtn?.addEventListener('click', async () => {
    await setSettings({ textMode: { cursorType: DEFAULT_SETTINGS.textMode.cursorType } });
    const s = await getSettings();
    applyTextMode(s.textMode);
  }, true);

  textLabelsEnabled?.addEventListener('change', async () => {
    await setSettings({ textMode: { labelsEnabled: !!textLabelsEnabled.checked } });
  }, true);

  textFocusStyleRadios.forEach((r) => {
    r.addEventListener('change', async () => {
      if (!r.checked) return;
      const focusStyle = normalizeTextFocusStyle(r.value);
      await setSettings({ textMode: { focusStyle } });
      const s = await getSettings();
      applyTextMode(s.textMode);
    }, true);
  });

  const commitTextStrokeThickness = async (v) => {
    const n = clampNumber(v, 1, 16);
    setInputValue(textStrokeThicknessRange, n);
    setInputValue(textStrokeThicknessNumber, n);
    await setSettings({ textMode: { strokeThickness: n } });
  };

  textStrokeThicknessRange?.addEventListener('input', async () => commitTextStrokeThickness(textStrokeThicknessRange.value), true);
  textStrokeThicknessNumber?.addEventListener('input', async () => commitTextStrokeThickness(textStrokeThicknessNumber.value), true);

  textModeResetBtn?.addEventListener('click', async () => {
    await setSettings({ textMode: { ...DEFAULT_SETTINGS.textMode } });
    const s = await getSettings();
    applyTextMode(s.textMode);
  }, true);

  // Scrolling handlers
  const commitScrollHalfPage = async (v) => {
    const n = clampNumber(v, 50, 2000);
    setInputValue(scrollHalfPageRange, n);
    setInputValue(scrollHalfPageNumber, n);
    await setSettings({ scroll: { halfPagePx: n } });
  };

  scrollHalfPageRange?.addEventListener('input', async () => commitScrollHalfPage(scrollHalfPageRange.value), true);
  scrollHalfPageNumber?.addEventListener('input', async () => commitScrollHalfPage(scrollHalfPageNumber.value), true);

  scrollSpeedSelect?.addEventListener('change', async () => {
    const speed = scrollSpeedSelect.value === 'instant' ? 'instant' : 'smooth';
    await setSettings({ scroll: { speed } });
    const s = await getSettings();
    applyScroll(s.scroll);
  }, true);

  scrollResetBtn?.addEventListener('click', async () => {
    await setSettings({ scroll: { ...DEFAULT_SETTINGS.scroll } });
    const s = await getSettings();
    applyScroll(s.scroll);
  }, true);

  // Sync when other tabs / this page update (sync preferred; local is fallback).
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      const entry = changes && changes[SETTINGS_STORAGE_KEY];
      if (!entry || !entry.newValue) return;
      applyEngine(entry.newValue.searchEngine);
      applyKeyFeedbackToggle(entry.newValue.keyboardReferenceKeyFeedback);
      applyControlStrip(entry.newValue.controlStrip);
      applyClickMode(entry.newValue.clickMode);
      applyTextMode(entry.newValue.textMode);
      applyScroll(entry.newValue.scroll);
    });
  } catch {
    // ignore
  }

  openGuideBtn?.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'KP_OPEN_GUIDE_POPOVER' });
    } catch {
      // ignore
    }
  }, true);

  closeBtn?.addEventListener('click', () => postCloseRequest(), true);
}

render();


