import { CURSOR_MODE } from '../src/config/constants.js';
import { normalizeKeyboardLayoutId } from '../src/config/keyboard-layouts.js';
import { DEFAULT_SETTINGS, getSettings, normalizeCursorMode, normalizeSearchEngine, setSettings, SETTINGS_STORAGE_KEY } from '../src/modules/settings-manager.js';
import { startKeyPilotOnPage } from './keypilot-page-init.js';
import { CursorManager } from '../src/modules/cursor.js';

function postCloseRequest() {
  try {
    window.parent.postMessage({ type: 'KP_POPOVER_REQUEST_CLOSE', key: 'Escape' }, '*');
  } catch {
    // ignore
  }
}

function installAccordionViewTransitions() {
  // NOTE:
  // We intentionally rely on native <details>/<summary> toggling for stability.
  // Some Chromium builds still perform the native toggle even when the click is
  // prevented, causing an open->close "double toggle" if we also toggle manually.
  // The caret rotation is handled purely in CSS via details[open].
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
  // Start KeyPilot inside the Settings page (this page is often loaded in an iframe popover).
  await startKeyPilotOnPage({ allowInIframe: true });

  installAccordionViewTransitions();

  const radios = Array.from(document.querySelectorAll('input[type="radio"][name="engine"]'));
  const keyFeedbackToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('keyboard-reference-key-feedback'));
  const keyboardLayoutSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('keyboard-layout'));
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
  const clickOverlayFill = /** @type {HTMLInputElement|null} */ (document.getElementById('click-overlay-fill'));
  const clickRectThicknessRange = /** @type {HTMLInputElement|null} */ (document.getElementById('click-rect-thickness-range'));
  const clickRectThicknessNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('click-rect-thickness-number'));
  const clickCursorResetBtn = document.getElementById('click-cursor-reset');
  const clickModeResetBtn = document.getElementById('click-mode-reset');

  const textCursorType = /** @type {HTMLSelectElement|null} */ (document.getElementById('text-cursor-type'));
  const textCursorPreview = document.getElementById('text-cursor-preview');
  const textCursorResetBtn = document.getElementById('text-cursor-reset');
  const textLabelsEnabled = /** @type {HTMLInputElement|null} */ (document.getElementById('text-labels-enabled'));
  const textStrokeThicknessRange = /** @type {HTMLInputElement|null} */ (document.getElementById('text-stroke-thickness-range'));
  const textStrokeThicknessNumber = /** @type {HTMLInputElement|null} */ (document.getElementById('text-stroke-thickness-number'));
  const textModeResetBtn = document.getElementById('text-mode-reset');

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
    if (clickOverlayFill) clickOverlayFill.checked = !!cm?.overlayFillEnabled;
    setInputValue(clickRectThicknessRange, cm?.rectangleThickness ?? DEFAULT_SETTINGS.clickMode.rectangleThickness);
    setInputValue(clickRectThicknessNumber, cm?.rectangleThickness ?? DEFAULT_SETTINGS.clickMode.rectangleThickness);

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

    const type = tm?.cursorType ?? DEFAULT_SETTINGS.textMode.cursorType;
    if (type === 'crosshair') {
      const uri = previewCursor.getCursorDataUri('text_focus', { hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: 'crosshair', uri });
    } else {
      const uri = previewCursor.getCursorDataUri('text_focus', { cursorType: 't_square', hasClickableElement: false });
      renderCursorPreview({ container: textCursorPreview, kind: 't_square', uri });
    }
  };

  // Initial state
  try {
    const settings = await getSettings();
    applyEngine(settings.searchEngine);
    applyCursorMode(settings.cursorMode);
    applyKeyboardLayout(settings.keyboardLayoutId);
    applyKeyFeedbackToggle(settings.keyboardReferenceKeyFeedback);
    applyClickMode(settings.clickMode);
    applyTextMode(settings.textMode);
  } catch {
    applyEngine('brave');
    applyCursorMode(DEFAULT_SETTINGS.cursorMode);
    applyKeyboardLayout(DEFAULT_SETTINGS.keyboardLayoutId);
    applyKeyFeedbackToggle(true);
    applyClickMode(DEFAULT_SETTINGS.clickMode);
    applyTextMode(DEFAULT_SETTINGS.textMode);
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

  clickOverlayFill?.addEventListener('change', async () => {
    await setSettings({ clickMode: { overlayFillEnabled: !!clickOverlayFill.checked } });
  }, true);

  const commitClickRectThickness = async (v) => {
    const n = clampNumber(v, 1, 16);
    setInputValue(clickRectThicknessRange, n);
    setInputValue(clickRectThicknessNumber, n);
    await setSettings({ clickMode: { rectangleThickness: n } });
  };

  clickRectThicknessRange?.addEventListener('input', async () => commitClickRectThickness(clickRectThicknessRange.value), true);
  clickRectThicknessNumber?.addEventListener('input', async () => commitClickRectThickness(clickRectThicknessNumber.value), true);

  clickCursorResetBtn?.addEventListener('click', async () => {
    await setSettings({ clickMode: { cursor: { ...DEFAULT_SETTINGS.clickMode.cursor } } });
    const s = await getSettings();
    applyClickMode(s.clickMode);
  }, true);

  clickModeResetBtn?.addEventListener('click', async () => {
    await setSettings({ clickMode: { ...DEFAULT_SETTINGS.clickMode } });
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

  // Sync when other tabs update.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const entry = changes && changes[SETTINGS_STORAGE_KEY];
      if (!entry || !entry.newValue) return;
      applyEngine(entry.newValue.searchEngine);
      applyKeyFeedbackToggle(entry.newValue.keyboardReferenceKeyFeedback);
      applyClickMode(entry.newValue.clickMode);
      applyTextMode(entry.newValue.textMode);
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


