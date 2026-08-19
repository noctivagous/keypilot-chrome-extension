import { CURSOR_MODE } from '../src/config/constants.js';
import {
  BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META,
  normalizeKeyboardHandedness,
  normalizeKeyboardLayoutFamilyId
} from '../src/config/keyboard-layouts.js';
import { SEARCH_ENGINE_META } from '../src/config/search-engines.js';
import { CLICK_EFFECT_IDS, DEFAULT_SETTINGS, getSettings, normalizeCursorMode, normalizeFocusColor, normalizePaintStrategy, normalizeSearchEngine, normalizeTextFocusStyle, resetAllSettings, setSettings, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { applyThemeToRoots, getTheme, getThemeClickDefaults, resolveThemeFromSettings } from '../src/modules/theme-manager.js';
import { hasThemeOverrides, listThemes, normalizeThemeId, THEME_META } from '../themes/index.js';
import { GENERIC_FAVICON_DATA_URL, getExtensionFaviconUrl } from '../src/ui/url-listing.js';
import { CursorManager } from '../src/modules/cursor.js';
import { normalizeSettingsPanelId } from '../src/utils/kp-deep-link.js';

/** Document or open ShadowRoot the settings UI is mounted in. */
let settingsScope = document;
let settingsHandlersInstalled = false;
/** Last settings object applied to the UI (for re-sync when a hidden panel is shown). */
let lastUiSettings = null;
/** `.settings-app` node that currently has DOM listeners. */
let settingsDomBoundApp = null;
/** Preferred panel for the next master–detail install (from mount options). */
let pendingInitialPanel = null;

function getLiveSettingsSnapshot() {
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    const s = kp && kp._settings;
    if (s && typeof s === 'object') return s;
  } catch { /* ignore */ }
  return null;
}

function settingsEl(id) {
  const scope = settingsScope || document;
  if (!scope || !id) return null;
  try {
    if (typeof scope.getElementById === 'function') {
      const hit = scope.getElementById(id);
      if (hit) return hit;
    }
  } catch { /* ignore */ }
  try {
    const escaped = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
      ? CSS.escape(id)
      : id;
    const hit = scope.querySelector?.(`#${escaped}`);
    if (hit) return hit;
  } catch { /* ignore */ }
  try {
    return scope.querySelector?.(`[id="${id}"]`) || null;
  } catch {
    return null;
  }
}

function settingsOne(sel) {
  try {
    return settingsScope?.querySelector?.(sel) || null;
  } catch {
    return null;
  }
}

function settingsAll(sel) {
  try {
    return settingsScope?.querySelectorAll?.(sel) || [];
  } catch {
    return [];
  }
}

/**
 * Use Chrome's extension favicon endpoint (img-src 'self') instead of
 * google.com/s2/favicons, which redirects to t2.gstatic.com and is CSP-blocked.
 */
function applySearchEngineIcons() {
  const icons = settingsAll('img.radio-icon[data-favicon-for]');
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

/**
 * When Settings is embedded in the KeyPilot iframe popover, the outer chrome
 * already provides a standard titlebar + × close. Hide the in-page header so
 * we don't stack two header bars.
 */
function adaptHeaderForPopoverEmbed(embedded = false) {
  try {
    if (!embedded) {
      try { embedded = !!(window.parent && window.parent !== window); } catch { embedded = false; }
    }
    if (!embedded) return;
    const app = settingsOne('.settings-app');
    app?.classList?.add('kp-popover-embed');
    const header = settingsOne('.settings-app > .header');
    if (header) {
      header.hidden = true;
      header.setAttribute('aria-hidden', 'true');
    }
  } catch {
    // ignore
  }
}

const SETTINGS_TAB_STORAGE_KEY = 'kp_settings_active_tab';
const KEYBOARD_HELP_STORAGE_KEY = 'keypilot_keyboard_help_visible';

async function queryKeyboardHelpVisible() {
  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    if (kp && typeof kp.getKeyboardHelpVisibleFromStorage === 'function') {
      return Boolean(await kp.getKeyboardHelpVisibleFromStorage());
    }
  } catch {
    // ignore
  }
  try {
    const syncResult = await chrome.storage.sync.get([KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof syncResult?.[KEYBOARD_HELP_STORAGE_KEY] === 'boolean') {
      return syncResult[KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch {
    // ignore
  }
  try {
    const localResult = await chrome.storage.local.get([KEYBOARD_HELP_STORAGE_KEY]);
    if (typeof localResult?.[KEYBOARD_HELP_STORAGE_KEY] === 'boolean') {
      return localResult[KEYBOARD_HELP_STORAGE_KEY];
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Persist Keyboard Reference visibility and apply on this page when KeyPilot can host it.
 * Always writes storage so other tabs / the opener sync even when Settings is in a popover window.
 */
async function setKeyboardHelpVisible(visible) {
  const desired = Boolean(visible);
  const payload = { [KEYBOARD_HELP_STORAGE_KEY]: desired, timestamp: Date.now() };
  try { await chrome.storage.sync.set(payload); } catch { /* ignore */ }
  try { await chrome.storage.local.set(payload); } catch { /* ignore */ }

  try {
    const kp = window.keyPilot || window.__KeyPilotInstance;
    const inPopover = !!(kp?._isPopoverOsWindow || window.__KP_POPOVER_WINDOW);
    if (!inPopover && kp && typeof kp.applyKeyboardHelpVisibility === 'function') {
      kp.applyKeyboardHelpVisibility(desired, { persist: false });
    }
  } catch {
    // storage listener on content scripts still applies
  }
  return desired;
}
const SETTINGS_DEFAULT_PANEL_ID = 'overview';
const SETTINGS_PANEL_IDS = Object.freeze([
  'overview',
  'appearance',
  'keyboard',
  'click-mode',
  'text-mode',
  'scrolling',
  'cursor',
  'control-strip',
  'search',
  'about'
]);

/**
 * Master–detail left tabs: show one panel, update ARIA + optional persistence.
 * @param {string} panelId
 * @param {{ focusTab?: boolean, persist?: boolean }} [opts]
 */
function activateSettingsPanel(panelId, opts = {}) {
  const id = SETTINGS_PANEL_IDS.includes(panelId) ? panelId : SETTINGS_DEFAULT_PANEL_ID;
  const tabs = Array.from(settingsAll('.settings-tab[data-panel]'));
  const panels = Array.from(settingsAll('.settings-panel[data-panel]'));

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

  // Number/range values set while the panel was `display:none` often fail to
  // paint until the controls are visible — re-apply Appearance when it is shown.
  if (id === 'appearance') {
    try { applyAppearanceControls(lastUiSettings); } catch { /* ignore */ }
  }

  if (opts.persist !== false) {
    try {
      sessionStorage.setItem(SETTINGS_TAB_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  // Scroll detail pane to top when switching sections.
  try {
    const detail = settingsOne('.settings-detail');
    if (detail) detail.scrollTop = 0;
  } catch {
    // ignore
  }
}

function installSettingsMasterDetailNav() {
  const nav = settingsOne('.settings-nav');
  const tabs = Array.from(settingsAll('.settings-tab[data-panel]'));
  if (!nav || tabs.length === 0) return;

  let initial = SETTINGS_DEFAULT_PANEL_ID;
  const fromMount = normalizeSettingsPanelId(pendingInitialPanel);
  pendingInitialPanel = null;
  if (fromMount) {
    initial = fromMount;
  } else {
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

  // Overview hub tiles jump into a category (same as left-nav tabs).
  settingsAll('.settings-hub-tile[data-goto]').forEach((tile) => {
    tile.addEventListener('click', (e) => {
      e.preventDefault();
      const panelId = tile.getAttribute('data-goto');
      if (!panelId || !SETTINGS_PANEL_IDS.includes(panelId)) return;
      withOptionalViewTransition(() => activateSettingsPanel(panelId, { focusTab: true }));
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

function cloneJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

function setOverridePath(overrides, path, value) {
  const next = cloneJson(overrides && typeof overrides === 'object' ? overrides : {}, {});
  const parts = String(path).split('.').filter(Boolean);
  let cur = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) cur[key] = {};
    cur = cur[key];
  }
  if (parts.length) cur[parts[parts.length - 1]] = value;
  return next;
}

function parsePxNumber(raw, fallback = 0) {
  const n = parseFloat(String(raw ?? '').replace(/px$/i, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function toHexColor(raw, fallback = '#888888') {
  const s = String(raw || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  }
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const h = (n) => Number(n).toString(16).padStart(2, '0');
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return fallback;
}

function themeDisplayName(themeId, customized) {
  const name = THEME_META[themeId]?.name || themeId;
  return customized ? `${name} (custom)` : name;
}

function clampNumber(n, min, max) {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(Math.max(v, min), max);
}

/**
 * @param {HTMLInputElement[]} radios
 * @param {string} value
 */
function setRadioGroupValue(radios, value) {
  const v = String(value);
  radios.forEach((r) => {
    r.checked = r.value === v;
  });
}

function setInputValue(el, value) {
  if (!el) return;
  const s = String(value);
  try { el.value = s; } catch { /* ignore */ }
  try { el.defaultValue = s; } catch { /* ignore */ }
}

/**
 * Push resolved theme tokens into Appearance controls.
 * Safe to call while the panel is hidden; call again after it is shown.
 * @param {object|null} [settings]
 */
function applyAppearanceControls(settings) {
  const s = settings || lastUiSettings || getLiveSettingsSnapshot() || DEFAULT_SETTINGS;
  lastUiSettings = s;
  const theme = resolveThemeFromSettings(s);
  const shape = theme.shape || {};
  const radius = theme.radius || {};
  const type = theme.type || {};
  const titlebar = theme.titlebar || {};
  const keys = theme.keys || {};
  const color = theme.color || {};
  const cutSize = parsePxNumber(shape.cutSize, 8);
  const panelRadius = parsePxNumber(radius.panel, 3);
  const keyCut = parsePxNumber(keys.cutSize, 4);
  const typeUi = parsePxNumber(type.size?.ui, 12);
  const typeKbd = parsePxNumber(type.size?.kbd, 10);
  const titleWeight = String(titlebar.titleWeight || '600');
  const normalizedTitleWeight = titleWeight === '400' || titleWeight === '700' ? titleWeight : '600';

  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="app-corner-mode"]'))),
    shape.cornerMode === 'cut' ? 'cut' : 'radius'
  );
  setInputValue(settingsEl('app-cut-size-range'), cutSize);
  setInputValue(settingsEl('app-cut-size-number'), cutSize);
  setInputValue(settingsEl('app-panel-radius-range'), panelRadius);
  setInputValue(settingsEl('app-panel-radius-number'), panelRadius);
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="app-title-transform"]'))),
    type.textTransform?.titlebar === 'uppercase' ? 'uppercase' : 'none'
  );
  setInputValue(settingsEl('app-title-tracking'), type.letterSpacing?.titlebar || '0.02em');
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="app-title-weight"]'))),
    normalizedTitleWeight
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="app-title-icon"]'))),
    titlebar.iconDisplay === 'inline-flex' ? 'inline-flex' : 'none'
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="app-kbd-transform"]'))),
    titlebar.kbdTransform === 'uppercase' ? 'uppercase' : 'none'
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="app-key-shading"]'))),
    keys.shading === 'flat' ? 'flat' : 'bevel'
  );
  setRadioGroupValue(
    /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="app-key-corner"]'))),
    keys.cornerMode === 'cut' ? 'cut' : 'radius'
  );
  setInputValue(settingsEl('app-key-cut-range'), keyCut);
  setInputValue(settingsEl('app-key-cut-number'), keyCut);
  setInputValue(settingsEl('app-key-border'), keys.border || '1px solid rgba(0, 0, 0, 0.4)');
  const colorEl = (id, value, fallback) => {
    const el = /** @type {HTMLInputElement|null} */ (settingsEl(id));
    if (el) el.value = toHexColor(value, fallback);
  };
  colorEl('app-color-accent', color.accent, '#4a90c8');
  colorEl('app-color-fg', color.fg, '#dddddd');
  colorEl('app-color-fg-dim', color.fgDim, '#aaaaaa');
  colorEl('app-color-panel', color.panel, '#232323');
  colorEl('app-color-panel-edge', color.panelEdge, '#3a3a3a');
  colorEl('app-color-title-top', color.titleTop, '#4c4c4c');
  colorEl('app-color-title-mid', color.titleMid, '#353535');
  colorEl('app-color-title-bot', color.titleBot, '#252525');
  colorEl('app-color-kbd', color.kbdColor || color.fg, '#dddddd');
  setInputValue(settingsEl('app-type-ui-range'), typeUi);
  setInputValue(settingsEl('app-type-ui-number'), typeUi);
  setInputValue(settingsEl('app-type-kbd-range'), typeKbd);
  setInputValue(settingsEl('app-type-kbd-number'), typeKbd);
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
  applySearchEngineIcons();

  const appRoot = settingsOne('.settings-app');
  const bindDom = !!(appRoot && appRoot !== settingsDomBoundApp);
  if (bindDom) settingsDomBoundApp = appRoot;
  const bindGlobal = !settingsHandlersInstalled;
  if (bindGlobal) settingsHandlersInstalled = true;

  if (bindDom) {
    installSettingsMasterDetailNav();
  }

  const radios = Array.from(settingsAll('input[type="radio"][name="engine"]'));
  const keyFeedbackToggle = /** @type {HTMLInputElement|null} */ (settingsEl('keyboard-reference-key-feedback'));
  const showNumberRowToggle = /** @type {HTMLInputElement|null} */ (settingsEl('keyboard-reference-show-number-row'));
  const keyboardHelpToggle = /** @type {HTMLInputElement|null} */ (settingsEl('settings-keyboard-help-toggle'));
  const keyboardHelpStateText = settingsEl('settings-keyboard-help-text');
  const keyboardLayoutFamilySelect = /** @type {HTMLSelectElement|null} */ (settingsEl('keyboard-layout-family'));
  const keyboardLeftHandedToggle = /** @type {HTMLInputElement|null} */ (settingsEl('keyboard-left-handed'));
  const controlStripVisible = /** @type {HTMLInputElement|null} */ (settingsEl('control-strip-visible'));
  const controlStripCollapsed = /** @type {HTMLInputElement|null} */ (settingsEl('control-strip-collapsed'));
  // Cursor mode controls (segmented toggle)
  const cursorModeRadios = /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="cursor-mode"]')));
  const cursorSettingsClick = settingsEl('cursor-settings-click');
  const cursorSettingsText = settingsEl('cursor-settings-text');

  // Mode Settings controls
  const clickCursorType = /** @type {HTMLSelectElement|null} */ (settingsEl('click-cursor-type'));
  const clickCursorLineWidthRange = /** @type {HTMLInputElement|null} */ (settingsEl('click-cursor-linewidth-range'));
  const clickCursorLineWidthNumber = /** @type {HTMLInputElement|null} */ (settingsEl('click-cursor-linewidth-number'));
  const clickCursorSizeRange = /** @type {HTMLInputElement|null} */ (settingsEl('click-cursor-size-range'));
  const clickCursorSizeNumber = /** @type {HTMLInputElement|null} */ (settingsEl('click-cursor-size-number'));
  const clickCursorGapRange = /** @type {HTMLInputElement|null} */ (settingsEl('click-cursor-gap-range'));
  const clickCursorGapNumber = /** @type {HTMLInputElement|null} */ (settingsEl('click-cursor-gap-number'));
  const clickCursorPreview = settingsEl('click-cursor-preview');
  const clickFocusColor = /** @type {HTMLSelectElement|null} */ (settingsEl('click-focus-color'));
  const clickOverlayFill = /** @type {HTMLInputElement|null} */ (settingsEl('click-overlay-fill'));
  const clickOverlayShadow = /** @type {HTMLInputElement|null} */ (settingsEl('click-overlay-shadow'));
  const clickRectThicknessRange = /** @type {HTMLInputElement|null} */ (settingsEl('click-rect-thickness-range'));
  const clickRectThicknessNumber = /** @type {HTMLInputElement|null} */ (settingsEl('click-rect-thickness-number'));
  const clickEffectRadios = /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="click-effect"]')));
  const clickKeyboardLinkHints = /** @type {HTMLInputElement|null} */ (settingsEl('click-keyboard-link-hints'));
  const clickPaintStrategy = /** @type {HTMLSelectElement|null} */ (settingsEl('click-paint-strategy'));
  const clickPaintBackendDebug = /** @type {HTMLInputElement|null} */ (settingsEl('click-paint-backend-debug'));
  const clickSkipForParent = /** @type {HTMLInputElement|null} */ (settingsEl('click-skip-for-parent'));
  const clickFocusPaddingRange = /** @type {HTMLInputElement|null} */ (settingsEl('click-focus-padding-range'));
  const clickFocusPaddingNumber = /** @type {HTMLInputElement|null} */ (settingsEl('click-focus-padding-number'));
  const clickCursorResetBtn = settingsEl('click-cursor-reset');
  const clickModeResetBtn = settingsEl('click-mode-reset');
  const uiThemeSelect = /** @type {HTMLSelectElement|null} */ (settingsEl('ui-theme-select'));
  const uiThemeSelectAppearance = /** @type {HTMLSelectElement|null} */ (settingsEl('ui-theme-select-appearance'));
  const settingsResetAllBtn = settingsEl('settings-reset-all');
  const settingsResetAppearanceBtn = settingsEl('settings-reset-appearance');

  const textCursorType = /** @type {HTMLSelectElement|null} */ (settingsEl('text-cursor-type'));
  const textCursorPreview = settingsEl('text-cursor-preview');
  const textCursorResetBtn = settingsEl('text-cursor-reset');
  const textFocusStyleRadios = /** @type {HTMLInputElement[]} */ (Array.from(settingsAll('input[name="text-focus-style"]')));
  const textLeftEdgeWidthField = settingsEl('text-left-edge-width-field');
  const textLeftEdgeWidthRange = /** @type {HTMLInputElement|null} */ (settingsEl('text-left-edge-width-range'));
  const textLeftEdgeWidthNumber = /** @type {HTMLInputElement|null} */ (settingsEl('text-left-edge-width-number'));
  const textLabelsEnabled = /** @type {HTMLInputElement|null} */ (settingsEl('text-labels-enabled'));
  const textStrokeThicknessRange = /** @type {HTMLInputElement|null} */ (settingsEl('text-stroke-thickness-range'));
  const textStrokeThicknessNumber = /** @type {HTMLInputElement|null} */ (settingsEl('text-stroke-thickness-number'));
  const textModeResetBtn = settingsEl('text-mode-reset');

  // Scrolling controls (C / V distance + animation speed)
  const scrollHalfPageRange = /** @type {HTMLInputElement|null} */ (settingsEl('scroll-half-page-range'));
  const scrollHalfPageNumber = /** @type {HTMLInputElement|null} */ (settingsEl('scroll-half-page-number'));
  const scrollSpeedSelect = /** @type {HTMLSelectElement|null} */ (settingsEl('scroll-speed'));
  const scrollMiddleClickScrollLine = /** @type {HTMLInputElement|null} */ (settingsEl('scroll-middle-click-scroll-line'));
  const scrollLinePreferPortrait = /** @type {HTMLInputElement|null} */ (settingsEl('scroll-line-prefer-portrait'));
  const scrollResetBtn = settingsEl('scroll-reset');

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
  if (bindGlobal) {
    document.addEventListener('keydown', (e) => {
      if (!e) return;
      if (e.key !== 'f' && e.key !== 'F') return;
      if (isTextEntry(e.target)) return;
      if (e.defaultPrevented) return;
      if (e.cancelBubble) return;
      const kp = window.__KeyPilotInstance;
      if (!kp || typeof kp.handleActivateKey !== 'function') return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try { kp.handleActivateKey(); } catch { /* ignore */ }
    }, false);
  }

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

  const applyShowNumberRowToggle = (enabled) => {
    if (!showNumberRowToggle) return;
    showNumberRowToggle.checked = !!enabled;
  };

  const applyKeyboardHelpVisible = (visible) => {
    const on = Boolean(visible);
    if (keyboardHelpToggle) keyboardHelpToggle.checked = on;
    if (keyboardHelpStateText) {
      keyboardHelpStateText.textContent = on ? 'ON' : 'OFF';
      keyboardHelpStateText.setAttribute('data-state', on ? 'on' : 'off');
    }
  };

  const ensureLayoutFamilyOptions = () => {
    if (!keyboardLayoutFamilySelect) return;
    keyboardLayoutFamilySelect.innerHTML = '';
    const items = Array.isArray(BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META) ? BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META : [];
    for (const m of items) {
      if (!m || !m.id) continue;
      const opt = document.createElement('option');
      opt.value = String(m.id);
      opt.textContent = String(m.label || m.id);
      keyboardLayoutFamilySelect.appendChild(opt);
    }
  };

  const applyKeyboardLayoutFamily = (familyId) => {
    if (!keyboardLayoutFamilySelect) return;
    const v = normalizeKeyboardLayoutFamilyId(familyId);
    setInputValue(keyboardLayoutFamilySelect, v);
  };

  const applyKeyboardHandedness = (handedness) => {
    if (!keyboardLeftHandedToggle) return;
    const h = normalizeKeyboardHandedness(handedness);
    keyboardLeftHandedToggle.checked = h === 'left';
  };

  const applyControlStrip = (controlStrip) => {
    const cs = controlStrip || DEFAULT_SETTINGS.controlStrip;
    if (controlStripVisible) controlStripVisible.checked = !!cs?.visible;
    if (controlStripCollapsed) controlStripCollapsed.checked = !!cs?.collapsed;
  };

  const applyCursorMode = (cursorMode) => {
    const mode = normalizeCursorMode(cursorMode);
    cursorModeRadios.forEach((r) => {
      r.checked = r.value === mode;
    });

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
    if (clickPaintStrategy) {
      clickPaintStrategy.value = normalizePaintStrategy(
        cm?.paintStrategy ?? DEFAULT_SETTINGS.clickMode.paintStrategy
      );
    }
    if (clickPaintBackendDebug) {
      clickPaintBackendDebug.checked = cm?.paintBackendDebugDashes === true;
    }
    if (clickSkipForParent) {
      clickSkipForParent.checked = cm?.skipForParent !== false;
    }
    setInputValue(clickFocusPaddingRange, cm?.focusPadding ?? DEFAULT_SETTINGS.clickMode.focusPadding);
    setInputValue(clickFocusPaddingNumber, cm?.focusPadding ?? DEFAULT_SETTINGS.clickMode.focusPadding);

    const effect = cm?.clickEffect ?? DEFAULT_SETTINGS.clickMode.clickEffect ?? 'flash';
    clickEffectRadios.forEach((r) => {
      r.checked = r.value === effect;
    });

    if (clickKeyboardLinkHints) {
      clickKeyboardLinkHints.checked = cm?.keyboardLinkHoverHints === true;
    }

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
    setInputValue(textLeftEdgeWidthRange, tm?.leftEdgeWidth ?? DEFAULT_SETTINGS.textMode.leftEdgeWidth);
    setInputValue(textLeftEdgeWidthNumber, tm?.leftEdgeWidth ?? DEFAULT_SETTINGS.textMode.leftEdgeWidth);

    const focusStyle = normalizeTextFocusStyle(tm?.focusStyle ?? DEFAULT_SETTINGS.textMode.focusStyle);
    textFocusStyleRadios.forEach((r) => {
      r.checked = r.value === focusStyle;
    });
    applyVisibility(textLeftEdgeWidthField, focusStyle === 'left_edge');

    const type = tm?.cursorType ?? DEFAULT_SETTINGS.textMode.cursorType;
    if (type === 'crosshair') {
      const uri = previewCursor.getCursorDataUri('text_focus', { hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: 'crosshair', uri });
    } else {
      const uri = previewCursor.getCursorDataUri('text_focus', { cursorType: 't_square', hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: 't_square', uri });
    }
  };

  const applyThemeSelect = (settings) => {
    const themeId = normalizeThemeId(settings?.themeId);
    const customized = hasThemeOverrides(settings?.themeOverrides);
    const labelFor = (id) => themeDisplayName(id, customized && id === themeId);
    const fillSelect = (el) => {
      if (!el) return;
      const items = listThemes();
      if (el.options.length !== items.length) {
        el.innerHTML = '';
        for (const item of items) {
          const opt = document.createElement('option');
          opt.value = item.id;
          opt.textContent = labelFor(item.id);
          el.appendChild(opt);
        }
      } else {
        Array.from(el.options).forEach((opt) => {
          opt.textContent = labelFor(opt.value);
        });
      }
      el.value = themeId;
    };
    fillSelect(uiThemeSelect);
    fillSelect(uiThemeSelectAppearance);
    const badges = [
      settingsEl('ui-theme-custom-badge'),
      settingsEl('ui-theme-custom-badge-appearance')
    ];
    badges.forEach((badge) => {
      if (!badge) return;
      badge.hidden = !customized;
    });
  };

  const paintPageTheme = (settings) => {
    try {
      const theme = resolveThemeFromSettings(settings);
      const roots = [document];
      if (settingsScope && settingsScope !== document) roots.push(settingsScope);
      applyThemeToRoots(theme, {
        roots,
        hosts: [document.documentElement]
      });
    } catch { /* ignore */ }
  };

  const applyScroll = (scroll) => {
    const sc = scroll || DEFAULT_SETTINGS.scroll;
    const half = sc?.halfPagePx ?? DEFAULT_SETTINGS.scroll.halfPagePx;
    const speed = sc?.speed === 'instant' ? 'instant' : 'smooth';
    setInputValue(scrollHalfPageRange, half);
    setInputValue(scrollHalfPageNumber, half);
    setInputValue(scrollSpeedSelect, speed);
    if (scrollMiddleClickScrollLine) {
      scrollMiddleClickScrollLine.checked = !!sc?.middleClickScrollLine;
    }
    if (scrollLinePreferPortrait) {
      scrollLinePreferPortrait.checked = sc?.linePreferPortraitTargets !== false;
    }
  };

  const applyAllSettings = (settings) => {
    const s = settings || DEFAULT_SETTINGS;
    lastUiSettings = s;
    applyThemeSelect(s);
    applyAppearanceControls(s);
    paintPageTheme(s);
    applyEngine(s.searchEngine);
    applyCursorMode(s.cursorMode);
    applyKeyboardLayoutFamily(s.keyboardLayoutFamilyId);
    applyKeyboardHandedness(s.keyboardHandedness);
    applyKeyFeedbackToggle(s.keyboardReferenceKeyFeedback);
    applyShowNumberRowToggle(s.keyboardReferenceShowNumberRow);
    applyControlStrip(s.controlStrip);
    applyClickMode(s.clickMode);
    applyTextMode(s.textMode);
    applyScroll(s.scroll);
  };

  // Initial state: prefer the live KeyPilot snapshot (same tab as hover chrome /
  // Keyboard Reference) so the popover cannot show stale storage defaults.
  try {
    if (uiThemeSelect) {
      uiThemeSelect.replaceChildren();
      for (const t of listThemes()) {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        uiThemeSelect.appendChild(opt);
      }
    }
    ensureLayoutFamilyOptions();
    const live = getLiveSettingsSnapshot();
    const settings = live || await getSettings();
    applyAllSettings(settings);
  } catch {
    ensureLayoutFamilyOptions();
    applyAllSettings(DEFAULT_SETTINGS);
  }

  // Keyboard Reference visibility is stored separately from SETTINGS_STORAGE_KEY.
  queryKeyboardHelpVisible().then(applyKeyboardHelpVisible).catch(() => applyKeyboardHelpVisible(false));

  if (!bindDom && !bindGlobal) return;

  // Change handler
  radios.forEach((r) => {
    r.addEventListener('change', async () => {
      if (!r.checked) return;
      await setSettings({ searchEngine: r.value });
    }, true);
  });

  const commitThemePack = async (rawId) => {
    const themeId = normalizeThemeId(rawId);
    const theme = getTheme(themeId);
    const clickPatch = getThemeClickDefaults(theme);
    await setSettings({
      themeId,
      themeOverrides: {},
      cursorMode: clickPatch.cursorMode,
      clickMode: clickPatch.clickMode,
      clickModeThemeId: themeId
    });
    const s = await getSettings();
    applyAllSettings(s);
  };

  uiThemeSelect?.addEventListener('change', async () => {
    await commitThemePack(uiThemeSelect.value);
  }, true);

  uiThemeSelectAppearance?.addEventListener('change', async () => {
    await commitThemePack(uiThemeSelectAppearance.value);
  }, true);

  settingsResetAppearanceBtn?.addEventListener('click', async () => {
    await setSettings({ themeOverrides: {} });
    const s = await getSettings();
    applyAllSettings(s);
  }, true);

  const commitAppearanceOverride = async (path, value) => {
    const s0 = await getSettings();
    const nextOverrides = setOverridePath(s0.themeOverrides, path, value);
    await setSettings({ themeOverrides: nextOverrides });
    const s = await getSettings();
    lastUiSettings = s;
    applyThemeSelect(s);
    applyAppearanceControls(s);
    paintPageTheme(s);
  };

  const bindAppearanceControl = (id, eventName, readValue) => {
    const el = settingsEl(id);
    if (!el) return;
    el.addEventListener(eventName, async () => {
      await commitAppearanceOverride(readValue.path, readValue.fromEl(el));
    }, true);
  };

  /**
   * @param {string} name
   * @param {string} path
   * @param {(raw: string) => *} normalizeValue
   */
  const bindAppearanceRadios = (name, path, normalizeValue) => {
    const radios = /** @type {HTMLInputElement[]} */ (Array.from(settingsAll(`input[name="${name}"]`)));
    radios.forEach((radio) => {
      radio.addEventListener('change', async () => {
        if (!radio.checked) return;
        await commitAppearanceOverride(path, normalizeValue(radio.value));
      }, true);
    });
  };

  /**
   * Slider + number field pair (same pattern as Click Mode cursor geometry).
   * @param {string} baseId - prefix without -range/-number suffix
   * @param {string} path
   * @param {number} min
   * @param {number} max
   * @param {(n: number) => *} [formatValue]
   */
  const bindAppearanceRangePair = (baseId, path, min, max, formatValue) => {
    const range = /** @type {HTMLInputElement|null} */ (settingsEl(`${baseId}-range`));
    const number = /** @type {HTMLInputElement|null} */ (settingsEl(`${baseId}-number`));
    const format = typeof formatValue === 'function'
      ? formatValue
      : (n) => `${n}px`;
    const commit = async (raw) => {
      const n = clampNumber(raw, min, max);
      setInputValue(range, n);
      setInputValue(number, n);
      await commitAppearanceOverride(path, format(n));
    };
    range?.addEventListener('input', async () => commit(range.value), true);
    number?.addEventListener('input', async () => commit(number.value), true);
  };

  bindAppearanceRadios('app-corner-mode', 'shape.cornerMode', (v) => (v === 'cut' ? 'cut' : 'radius'));
  bindAppearanceRangePair('app-cut-size', 'shape.cutSize', 0, 24);
  bindAppearanceRangePair('app-panel-radius', 'radius.panel', 0, 24);
  bindAppearanceRadios('app-title-transform', 'type.textTransform.titlebar', (v) => (v === 'uppercase' ? 'uppercase' : 'none'));
  bindAppearanceControl('app-title-tracking', 'change', {
    path: 'type.letterSpacing.titlebar',
    fromEl: (el) => String(el.value || '0.02em').trim() || '0.02em'
  });
  bindAppearanceRadios('app-title-weight', 'titlebar.titleWeight', (v) => {
    if (v === '400' || v === '700') return v;
    return '600';
  });
  bindAppearanceRadios('app-title-icon', 'titlebar.iconDisplay', (v) => (v === 'inline-flex' ? 'inline-flex' : 'none'));
  bindAppearanceRadios('app-kbd-transform', 'titlebar.kbdTransform', (v) => (v === 'uppercase' ? 'uppercase' : 'none'));
  bindAppearanceRadios('app-key-shading', 'keys.shading', (v) => (v === 'flat' ? 'flat' : 'bevel'));
  bindAppearanceRadios('app-key-corner', 'keys.cornerMode', (v) => (v === 'cut' ? 'cut' : 'radius'));
  bindAppearanceRangePair('app-key-cut', 'keys.cutSize', 0, 16);
  bindAppearanceControl('app-key-border', 'change', {
    path: 'keys.border',
    fromEl: (el) => String(el.value || '').trim() || '1px solid rgba(0, 0, 0, 0.4)'
  });
  bindAppearanceControl('app-color-accent', 'input', { path: 'color.accent', fromEl: (el) => el.value });
  bindAppearanceControl('app-color-fg', 'input', { path: 'color.fg', fromEl: (el) => el.value });
  bindAppearanceControl('app-color-fg-dim', 'input', { path: 'color.fgDim', fromEl: (el) => el.value });
  bindAppearanceControl('app-color-panel', 'input', { path: 'color.panel', fromEl: (el) => el.value });
  bindAppearanceControl('app-color-panel-edge', 'input', { path: 'color.panelEdge', fromEl: (el) => el.value });
  bindAppearanceControl('app-color-title-top', 'input', { path: 'color.titleTop', fromEl: (el) => el.value });
  bindAppearanceControl('app-color-title-mid', 'input', { path: 'color.titleMid', fromEl: (el) => el.value });
  bindAppearanceControl('app-color-title-bot', 'input', { path: 'color.titleBot', fromEl: (el) => el.value });
  bindAppearanceControl('app-color-kbd', 'input', { path: 'color.kbdColor', fromEl: (el) => el.value });
  bindAppearanceRangePair('app-type-ui', 'type.size.ui', 9, 18);
  bindAppearanceRangePair('app-type-kbd', 'type.size.kbd', 8, 16);

  settingsResetAllBtn?.addEventListener('click', async () => {
    const ok = typeof window.confirm === 'function'
      ? window.confirm('Reset all KeyPilot settings to defaults? This cannot be undone.')
      : true;
    if (!ok) return;
    const s = await resetAllSettings();
    applyAllSettings(s);
  }, true);

  keyFeedbackToggle?.addEventListener('change', async () => {
    await setSettings({ keyboardReferenceKeyFeedback: !!keyFeedbackToggle.checked });
  }, true);

  showNumberRowToggle?.addEventListener('change', async () => {
    await setSettings({ keyboardReferenceShowNumberRow: !!showNumberRowToggle.checked });
  }, true);

  keyboardHelpToggle?.addEventListener('change', async () => {
    const desired = !!keyboardHelpToggle.checked;
    keyboardHelpToggle.disabled = true;
    try {
      const actual = await setKeyboardHelpVisible(desired);
      applyKeyboardHelpVisible(actual);
    } catch {
      applyKeyboardHelpVisible(await queryKeyboardHelpVisible());
    } finally {
      keyboardHelpToggle.disabled = false;
    }
  }, true);

  controlStripVisible?.addEventListener('change', async () => {
    await setSettings({ controlStrip: { visible: !!controlStripVisible.checked } });
  }, true);

  controlStripCollapsed?.addEventListener('change', async () => {
    await setSettings({ controlStrip: { collapsed: !!controlStripCollapsed.checked } });
  }, true);

  keyboardLayoutFamilySelect?.addEventListener('change', async () => {
    await setSettings({ keyboardLayoutFamilyId: keyboardLayoutFamilySelect.value });
    const s = await getSettings();
    withOptionalViewTransition(() => applyKeyboardLayoutFamily(s.keyboardLayoutFamilyId));
  }, true);

  keyboardLeftHandedToggle?.addEventListener('change', async () => {
    await setSettings({ keyboardHandedness: keyboardLeftHandedToggle.checked ? 'left' : 'right' });
    const s = await getSettings();
    withOptionalViewTransition(() => applyKeyboardHandedness(s.keyboardHandedness));
  }, true);

  cursorModeRadios.forEach((radio) => {
    radio.addEventListener('change', async () => {
      if (!radio.checked) return;
      const next = normalizeCursorMode(radio.value);
      await setSettings({ cursorMode: next });
      const s = await getSettings();
      withOptionalViewTransition(() => applyCursorMode(s.cursorMode));
    }, true);
  });

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

  clickKeyboardLinkHints?.addEventListener('change', async () => {
    await setSettings({ clickMode: { keyboardLinkHoverHints: !!clickKeyboardLinkHints.checked } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  });

  clickPaintStrategy?.addEventListener('change', async () => {
    const value = normalizePaintStrategy(clickPaintStrategy.value);
    await setSettings({ clickMode: { paintStrategy: value } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  clickSkipForParent?.addEventListener('change', async () => {
    await setSettings({ clickMode: { skipForParent: !!clickSkipForParent.checked } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  clickPaintBackendDebug?.addEventListener('change', async () => {
    await setSettings({ clickMode: { paintBackendDebugDashes: !!clickPaintBackendDebug.checked } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  });

  const commitClickFocusPadding = async (v) => {
    const n = clampNumber(v, 0, 16);
    setInputValue(clickFocusPaddingRange, n);
    setInputValue(clickFocusPaddingNumber, n);
    await setSettings({ clickMode: { focusPadding: n } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  };

  clickFocusPaddingRange?.addEventListener('input', async () => commitClickFocusPadding(clickFocusPaddingRange.value), true);
  clickFocusPaddingNumber?.addEventListener('input', async () => commitClickFocusPadding(clickFocusPaddingNumber.value), true);

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
    const s0 = await getSettings();
    const defaults = getThemeClickDefaults(getTheme(s0.themeId));
    await setSettings({ clickMode: { cursor: { ...defaults.clickMode.cursor } } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  clickModeResetBtn?.addEventListener('click', async () => {
    const s0 = await getSettings();
    const defaults = getThemeClickDefaults(getTheme(s0.themeId));
    const { cursor: _cursor, ...clickModeDefaults } = defaults.clickMode;
    await setSettings({ clickMode: { ...clickModeDefaults } });
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

  const commitTextLeftEdgeWidth = async (v) => {
    const n = clampNumber(v, 1, 24);
    setInputValue(textLeftEdgeWidthRange, n);
    setInputValue(textLeftEdgeWidthNumber, n);
    await setSettings({ textMode: { leftEdgeWidth: n } });
  };

  textLeftEdgeWidthRange?.addEventListener('input', async () => commitTextLeftEdgeWidth(textLeftEdgeWidthRange.value), true);
  textLeftEdgeWidthNumber?.addEventListener('input', async () => commitTextLeftEdgeWidth(textLeftEdgeWidthNumber.value), true);

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

  scrollMiddleClickScrollLine?.addEventListener('change', async () => {
    await setSettings({ scroll: { middleClickScrollLine: !!scrollMiddleClickScrollLine.checked } });
  }, true);

  scrollLinePreferPortrait?.addEventListener('change', async () => {
    await setSettings({ scroll: { linePreferPortraitTargets: !!scrollLinePreferPortrait.checked } });
  }, true);

  scrollResetBtn?.addEventListener('click', async () => {
    await setSettings({ scroll: { ...DEFAULT_SETTINGS.scroll } });
    const s = await getSettings();
    applyScroll(s.scroll);
  }, true);

  if (bindGlobal) {
    // Sync when other tabs / this page update (sync preferred; local is fallback).
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync' && area !== 'local') return;

        const helpChange = changes?.[KEYBOARD_HELP_STORAGE_KEY];
        if (helpChange && typeof helpChange.newValue === 'boolean') {
          applyKeyboardHelpVisible(helpChange.newValue);
        }

        const entry = changes && changes[SETTINGS_STORAGE_KEY];
        if (!entry || !entry.newValue) return;
        void getSettings().then((s) => applyAllSettings(s)).catch(() => {
          applyAllSettings(entry.newValue);
        });
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Inject standalone settings.html fragments into an open ShadowRoot.
 * CSS is fetched as text and applied via style elements so rules are present
 * before the app DOM paints (avoids FOUC; link onload is unreliable here).
 * @param {ShadowRoot} root
 */
async function injectSettingsDom(root) {
  if (root.querySelector?.('.settings-app')) return;
  const url = chrome.runtime.getURL('pages/settings.html');
  const stylesheetHrefs = ['pages/ui-standards.css', 'pages/settings.css'];
  const [html, ...cssTexts] = await Promise.all([
    fetch(url).then((res) => res.text()),
    ...stylesheetHrefs.map((href) =>
      fetch(chrome.runtime.getURL(href)).then((res) => res.text())
    )
  ]);
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  for (const cssText of cssTexts) {
    const style = document.createElement('style');
    style.textContent = cssText;
    root.appendChild(style);
  }
  const sprite = parsed.querySelector('.settings-icon-sprite');
  const app = parsed.querySelector('.settings-app');
  if (sprite) root.appendChild(document.importNode(sprite, true));
  if (app) root.appendChild(document.importNode(app, true));
}

/**
 * Switch the active Settings panel when the app is already mounted.
 * @param {string} panelId
 * @returns {boolean}
 */
export function setActiveSettingsPanel(panelId) {
  const id = normalizeSettingsPanelId(panelId);
  if (!id || !settingsDomBoundApp) return false;
  activateSettingsPanel(id, { focusTab: true });
  return true;
}

/**
 * Mount Settings UI into a document or open ShadowRoot.
 * Does not start KeyPilot — the host page already has it when embedded.
 * @param {Document|ShadowRoot} root
 * @param {{ embedded?: boolean, initialPanel?: string }} [options]
 */
export async function mountSettingsApp(root, options = {}) {
  const embedded = options.embedded === true;
  pendingInitialPanel = normalizeSettingsPanelId(options.initialPanel) || null;
  if (root && root.nodeType !== 9) {
    await injectSettingsDom(root);
    settingsScope = root;
  } else {
    settingsScope = document;
  }
  adaptHeaderForPopoverEmbed(embedded);
  await render();
  return () => {
    settingsScope = document;
    settingsDomBoundApp = null;
    pendingInitialPanel = null;
  };
}




