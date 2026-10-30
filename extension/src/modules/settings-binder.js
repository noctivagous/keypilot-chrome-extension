/**
 * Declarative Settings control binder.
 * Adapts DOM controls to SettingsController.update / updateThemeOverride.
 */

import { CLICK_EFFECT_IDS, OVERLAY_FILL_MAX_SIZE_MAX, OVERLAY_FILL_MAX_SIZE_MIN } from './settings-manager.js';
import { clampNumber } from './settings-path.js';

/**
 * @typedef {{
 *   type: 'toggle'|'select'|'radio'|'rangePair'|'appearanceControl'|'appearanceRadio'|'appearanceRangePair',
 *   path?: string,
 *   overridePath?: string,
 *   id?: string,
 *   name?: string,
 *   baseId?: string,
 *   event?: string,
 *   min?: number,
 *   max?: number,
 *   formatValue?: (n: number) => any,
 *   normalize?: (raw: any) => any,
 *   fromEl?: (el: HTMLInputElement) => any,
 *   viewTransition?: boolean
 * }} SettingsControlSpec
 */

/** @type {readonly SettingsControlSpec[]} */
export const SETTINGS_CONTROLS = Object.freeze([
  { type: 'radio', name: 'engine', path: 'searchEngine' },
  { type: 'toggle', id: 'keyboard-reference-key-feedback', path: 'keyboardReferenceKeyFeedback' },
  { type: 'toggle', id: 'keyboard-reference-show-number-row', path: 'keyboardReferenceShowNumberRow' },
  { type: 'toggle', id: 'deferred-silent-random', path: 'deferredOpen.silentRandomScheduling' },
  { type: 'toggle', id: 'deferred-open-urls-enabled', path: 'deferredOpen.openUrls.enabled' },
  { type: 'rangePair', baseId: 'deferred-open-urls-min', path: 'deferredOpen.openUrls.minMinutes', min: 1, max: 2880 },
  { type: 'rangePair', baseId: 'deferred-open-urls-max', path: 'deferredOpen.openUrls.maxMinutes', min: 1, max: 2880 },
  { type: 'toggle', id: 'deferred-random-bookmarks-enabled', path: 'deferredOpen.randomBookmarks.enabled' },
  { type: 'rangePair', baseId: 'deferred-random-bookmarks-min', path: 'deferredOpen.randomBookmarks.minMinutes', min: 1, max: 2880 },
  { type: 'rangePair', baseId: 'deferred-random-bookmarks-max', path: 'deferredOpen.randomBookmarks.maxMinutes', min: 1, max: 2880 },
  { type: 'toggle', id: 'deferred-click-element-enabled', path: 'deferredOpen.clickElement.enabled' },
  { type: 'rangePair', baseId: 'deferred-click-element-min', path: 'deferredOpen.clickElement.minMinutes', min: 1, max: 2880 },
  { type: 'rangePair', baseId: 'deferred-click-element-max', path: 'deferredOpen.clickElement.maxMinutes', min: 1, max: 2880 },
  { type: 'toggle', id: 'deferred-close-tab-enabled', path: 'deferredOpen.closeTab.enabled' },
  { type: 'rangePair', baseId: 'deferred-close-tab-min', path: 'deferredOpen.closeTab.minMinutes', min: 1, max: 2880 },
  { type: 'rangePair', baseId: 'deferred-close-tab-max', path: 'deferredOpen.closeTab.maxMinutes', min: 1, max: 2880 },
  { type: 'toggle', id: 'deferred-close-window-enabled', path: 'deferredOpen.closeWindow.enabled' },
  { type: 'rangePair', baseId: 'deferred-close-window-min', path: 'deferredOpen.closeWindow.minMinutes', min: 1, max: 2880 },
  { type: 'rangePair', baseId: 'deferred-close-window-max', path: 'deferredOpen.closeWindow.maxMinutes', min: 1, max: 2880 },
  {
    type: 'select',
    id: 'deferred-open-target',
    path: 'deferredOpen.target',
    normalize: (v) => (v === 'originalWindow' ? 'originalWindow' : 'activeWindow')
  },
  { type: 'toggle', id: 'control-strip-visible', path: 'controlStrip.visible' },
  { type: 'toggle', id: 'control-strip-collapsed', path: 'controlStrip.collapsed' },
  { type: 'select', id: 'keyboard-layout-family', path: 'keyboardLayoutFamilyId', viewTransition: true },
  {
    type: 'toggle',
    id: 'keyboard-left-handed',
    path: 'keyboardHandedness',
    normalize: (checked) => (checked ? 'left' : 'right'),
    viewTransition: true
  },
  { type: 'radio', name: 'cursor-mode', path: 'cursorMode', viewTransition: true },
  { type: 'select', id: 'click-cursor-type', path: 'clickMode.cursor.type' },
  { type: 'rangePair', baseId: 'click-cursor-linewidth', path: 'clickMode.cursor.lineWidth', min: 1, max: 12 },
  { type: 'rangePair', baseId: 'click-cursor-size', path: 'clickMode.cursor.sizePixels', min: 5, max: 60 },
  { type: 'rangePair', baseId: 'click-cursor-gap', path: 'clickMode.cursor.gap', min: 0, max: 20 },
  { type: 'toggle', id: 'click-overlay-fill', path: 'clickMode.overlayFillEnabled' },
  {
    type: 'rangePair',
    baseId: 'click-overlay-fill-max-width',
    path: 'clickMode.overlayFillMaxWidth',
    min: OVERLAY_FILL_MAX_SIZE_MIN,
    max: OVERLAY_FILL_MAX_SIZE_MAX
  },
  {
    type: 'rangePair',
    baseId: 'click-overlay-fill-max-height',
    path: 'clickMode.overlayFillMaxHeight',
    min: OVERLAY_FILL_MAX_SIZE_MIN,
    max: OVERLAY_FILL_MAX_SIZE_MAX
  },
  { type: 'toggle', id: 'click-overlay-shadow', path: 'clickMode.overlayShadowEnabled' },
  { type: 'rangePair', baseId: 'click-rect-thickness', path: 'clickMode.rectangleThickness', min: 1, max: 16 },
  { type: 'toggle', id: 'click-keyboard-link-hints', path: 'clickMode.keyboardLinkHoverHints' },
  { type: 'select', id: 'click-paint-strategy', path: 'clickMode.paintStrategy' },
  { type: 'toggle', id: 'click-skip-for-parent', path: 'clickMode.skipForParent' },
  { type: 'toggle', id: 'click-paint-backend-debug', path: 'clickMode.paintBackendDebugDashes' },
  { type: 'toggle', id: 'debug-logging', path: 'debugLogging' },
  { type: 'rangePair', baseId: 'click-focus-padding', path: 'clickMode.focusPadding', min: 0, max: 16 },
  {
    type: 'radio',
    name: 'click-effect',
    path: 'clickMode.clickEffect',
    normalize: (v) => (CLICK_EFFECT_IDS.includes(/** @type {any} */ (v)) ? v : 'flash')
  },
  { type: 'select', id: 'text-cursor-type', path: 'textMode.cursorType' },
  { type: 'toggle', id: 'text-labels-enabled', path: 'textMode.labelsEnabled' },
  { type: 'radio', name: 'text-focus-style', path: 'textMode.focusStyle' },
  { type: 'rangePair', baseId: 'text-left-edge-width', path: 'textMode.leftEdgeWidth', min: 1, max: 24 },
  { type: 'rangePair', baseId: 'text-stroke-thickness', path: 'textMode.strokeThickness', min: 1, max: 16 },
  { type: 'rangePair', baseId: 'scroll-half-page', path: 'scroll.halfPagePx', min: 50, max: 2000 },
  {
    type: 'select',
    id: 'scroll-speed',
    path: 'scroll.speed',
    normalize: (v) => (v === 'instant' ? 'instant' : 'smooth')
  },
  { type: 'toggle', id: 'scroll-middle-click-scroll-line', path: 'scroll.middleClickScrollLine' },
  { type: 'toggle', id: 'scroll-line-prefer-portrait', path: 'scroll.linePreferPortraitTargets' },

  { type: 'appearanceRadio', name: 'app-corner-mode', overridePath: 'shape.cornerMode', normalize: (v) => (v === 'cut' ? 'cut' : 'radius') },
  { type: 'appearanceRangePair', baseId: 'app-cut-size', overridePath: 'shape.cutSize', min: 0, max: 24 },
  { type: 'appearanceRangePair', baseId: 'app-panel-radius', overridePath: 'radius.panel', min: 0, max: 24 },
  { type: 'appearanceRadio', name: 'app-title-transform', overridePath: 'type.textTransform.titlebar', normalize: (v) => (v === 'uppercase' ? 'uppercase' : 'none') },
  {
    type: 'appearanceControl',
    id: 'app-title-tracking',
    event: 'change',
    overridePath: 'type.letterSpacing.titlebar',
    fromEl: (el) => String(el.value || '0.02em').trim() || '0.02em'
  },
  {
    type: 'appearanceRadio',
    name: 'app-title-weight',
    overridePath: 'titlebar.titleWeight',
    normalize: (v) => (v === '400' || v === '700' ? v : '600')
  },
  { type: 'appearanceRadio', name: 'app-title-icon', overridePath: 'titlebar.iconDisplay', normalize: (v) => (v === 'inline-flex' ? 'inline-flex' : 'none') },
  { type: 'appearanceRadio', name: 'app-kbd-transform', overridePath: 'titlebar.kbdTransform', normalize: (v) => (v === 'uppercase' ? 'uppercase' : 'none') },
  { type: 'appearanceRadio', name: 'app-key-shading', overridePath: 'keys.shading', normalize: (v) => (v === 'flat' ? 'flat' : 'bevel') },
  { type: 'appearanceRadio', name: 'app-key-corner', overridePath: 'keys.cornerMode', normalize: (v) => (v === 'cut' ? 'cut' : 'radius') },
  { type: 'appearanceRangePair', baseId: 'app-key-cut', overridePath: 'keys.cutSize', min: 0, max: 16 },
  {
    type: 'appearanceControl',
    id: 'app-key-border',
    event: 'change',
    overridePath: 'keys.border',
    fromEl: (el) => String(el.value || '').trim() || '1px solid rgba(0, 0, 0, 0.4)'
  },
  { type: 'appearanceControl', id: 'app-color-accent', event: 'input', overridePath: 'color.accent', fromEl: (el) => el.value },
  { type: 'appearanceControl', id: 'app-color-fg', event: 'input', overridePath: 'color.fg', fromEl: (el) => el.value },
  { type: 'appearanceControl', id: 'app-color-fg-dim', event: 'input', overridePath: 'color.fgDim', fromEl: (el) => el.value },
  { type: 'appearanceControl', id: 'app-color-panel', event: 'input', overridePath: 'color.panel', fromEl: (el) => el.value },
  { type: 'appearanceControl', id: 'app-color-panel-edge', event: 'input', overridePath: 'color.panelEdge', fromEl: (el) => el.value },
  { type: 'appearanceControl', id: 'app-color-title-top', event: 'input', overridePath: 'color.titleTop', fromEl: (el) => el.value },
  { type: 'appearanceControl', id: 'app-color-title-mid', event: 'input', overridePath: 'color.titleMid', fromEl: (el) => el.value },
  { type: 'appearanceControl', id: 'app-color-title-bot', event: 'input', overridePath: 'color.titleBot', fromEl: (el) => el.value },
  { type: 'appearanceControl', id: 'app-color-kbd', event: 'input', overridePath: 'color.kbdColor', fromEl: (el) => el.value },
  { type: 'appearanceRangePair', baseId: 'app-type-ui', overridePath: 'type.size.ui', min: 9, max: 18 },
  { type: 'appearanceRangePair', baseId: 'app-type-kbd', overridePath: 'type.size.kbd', min: 8, max: 16 }
]);

/** @type {Set<HTMLInputElement>} */
const draggingSettingsRanges = new Set();

/**
 * Mark a settings range as having pointer capture so later storage `_emit`
 * cannot write `.value` mid-drag (Chromium then re-applies the next
 * pointermove as a fresh delta and the thumb runs away).
 * @param {HTMLInputElement|null|undefined} range
 * @param {boolean} dragging
 */
export function setSettingsRangeDragging(range, dragging) {
  if (!range) return;
  if (dragging) draggingSettingsRanges.add(range);
  else draggingSettingsRanges.delete(range);
}

/**
 * @param {Element|null|undefined} node
 * @returns {boolean}
 */
export function isSettingsRangeDragging(node) {
  if (!node) return false;
  if (draggingSettingsRanges.has(/** @type {HTMLInputElement} */ (node))) return true;
  try {
    if (typeof node.matches === 'function' && node.matches('input[type=range]:active')) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * @param {Element|null|undefined} node
 * @returns {HTMLInputElement|null}
 */
function pairedRangeForNumber(node) {
  const id = node && 'id' in node ? String(node.id || '') : '';
  if (!id.endsWith('-number')) return null;
  try {
    const root = typeof node.getRootNode === 'function' ? node.getRootNode() : node.ownerDocument;
    const range = root && typeof root.getElementById === 'function'
      ? root.getElementById(id.slice(0, -'-number'.length) + '-range')
      : null;
    return range || null;
  } catch {
    return null;
  }
}

/**
 * True when a control currently has focus (range drag or number typing).
 * Writing `.value` in that state retriggers `input` and makes native range
 * drags accumulate.
 * @param {Element|null|undefined} node
 */
export function isLiveSettingsControl(node) {
  if (!node) return false;
  if (isSettingsRangeDragging(node)) return true;
  try {
    const root = typeof node.getRootNode === 'function' ? node.getRootNode() : node.ownerDocument;
    return !!(root && 'activeElement' in root && root.activeElement === node);
  } catch {
    return false;
  }
}

/**
 * Assign an input/select value without clobbering an in-progress edit, and
 * without rewriting the same string (which can emit extra `input` events).
 * @param {HTMLInputElement|HTMLSelectElement|HTMLElement|null} node
 * @param {any} value
 */
export function writeSettingsInputValue(node, value) {
  if (!node) return;
  const s = String(value);
  try {
    if ('value' in node && node.value === s) return;
  } catch { /* ignore */ }
  if (isSettingsRangeDragging(node)) return;
  const paired = pairedRangeForNumber(node);
  if (paired && isSettingsRangeDragging(paired)) {
    try {
      if ('value' in paired && String(paired.value) !== s) return;
    } catch { /* ignore */ }
  }
  if (isLiveSettingsControl(node)) return;
  try { node.value = s; } catch { /* ignore */ }
}

/**
 * @param {HTMLInputElement|null|undefined} range
 * @param {HTMLInputElement|null|undefined} number
 * @param {number} n
 * @param {HTMLInputElement|null|undefined} source
 * @param {(el: HTMLElement|null, value: any) => void} setInputValue
 */
function syncRangePair(range, number, n, source, setInputValue) {
  if (range && range !== source) setInputValue(range, n);
  if (number && number !== source) setInputValue(number, n);
}

/**
 * @param {HTMLInputElement|null|undefined} range
 * @param {AbortSignal|undefined} signal
 */
function trackRangeDrag(range, signal) {
  if (!range) return;
  const doc = range.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const onDown = (event) => {
    if (event && 'button' in event && event.button !== 0) return;
    setSettingsRangeDragging(range, true);
  };
  const onUp = () => setSettingsRangeDragging(range, false);
  const opts = { signal, capture: true };
  range.addEventListener('pointerdown', onDown, opts);
  range.addEventListener('lostpointercapture', onUp, opts);
  doc?.addEventListener('pointerup', onUp, opts);
  doc?.addEventListener('pointercancel', onUp, opts);
  if (signal) {
    signal.addEventListener('abort', () => setSettingsRangeDragging(range, false), { once: true });
  }
}

/**
 * Coalesce async controller writes so an older `setSettings` cannot finish
 * after a newer tick and `_emit` a stale value onto the thumb.
 * @param {(n: number) => Promise<any>|any} persist
 * @returns {(n: number) => void}
 */
function coalesceNumericPersist(persist) {
  let inflight = false;
  let pending = /** @type {number|null} */ (null);
  const flush = (n) => {
    pending = n;
    if (inflight) return;
    inflight = true;
    const send = pending;
    pending = null;
    void Promise.resolve(persist(send)).finally(() => {
      inflight = false;
      if (pending != null) flush(pending);
    });
  };
  return flush;
}

/**
 * @param {{
 *   range: HTMLInputElement|null,
 *   number: HTMLInputElement|null,
 *   min: number,
 *   max: number,
 *   persist: (n: number) => Promise<any>|any,
 *   setInputValue: (el: HTMLElement|null, value: any) => void,
 *   signal: AbortSignal
 * }} opts
 */
function bindNumericPair(opts) {
  const { range, number, min, max, persist, setInputValue, signal } = opts;
  const listenOpts = { signal, capture: true };
  trackRangeDrag(range, signal);
  const flush = coalesceNumericPersist(persist);
  const commit = (raw, source) => {
    if (source === number && isSettingsRangeDragging(range)) return;
    const n = clampNumber(raw, min, max);
    syncRangePair(range, number, n, source, setInputValue);
    flush(n);
  };
  range?.addEventListener('input', () => commit(range.value, range), listenOpts);
  number?.addEventListener('input', () => commit(number.value, number), listenOpts);
}

/**
 * @param {{
 *   controller: import('./settings-controller.js').SettingsController,
 *   el: (id: string) => HTMLElement|null,
 *   all: (sel: string) => NodeListOf<Element>|Element[],
 *   setInputValue: (el: HTMLElement|null, value: any) => void,
 *   signal: AbortSignal,
 *   withViewTransition?: (fn: () => void) => void
 * }} ctx
 */
export function bindSettingsControls(ctx) {
  const { controller, el, all, setInputValue, signal } = ctx;
  const listenOpts = { signal, capture: true };

  /**
   * @param {SettingsControlSpec} spec
   * @param {Promise<any>} work
   */
  const runUpdate = (spec, work) => {
    void Promise.resolve(work).then((s) => {
      if (spec.viewTransition && typeof ctx.withViewTransition === 'function') {
        ctx.withViewTransition(() => ctx.applyState?.(s));
      }
    });
  };

  for (const spec of SETTINGS_CONTROLS) {
    if (spec.type === 'toggle') {
      const node = /** @type {HTMLInputElement|null} */ (el(spec.id || ''));
      if (!node) continue;
      node.addEventListener('change', () => {
        const raw = spec.normalize ? spec.normalize(!!node.checked) : !!node.checked;
        runUpdate(spec, controller.update(spec.path, raw));
      }, listenOpts);
      continue;
    }

    if (spec.type === 'select') {
      const node = /** @type {HTMLSelectElement|null} */ (el(spec.id || ''));
      if (!node) continue;
      node.addEventListener('change', () => {
        const raw = spec.normalize ? spec.normalize(node.value) : node.value;
        runUpdate(spec, controller.update(spec.path, raw));
      }, listenOpts);
      continue;
    }

    if (spec.type === 'radio') {
      const radios = /** @type {HTMLInputElement[]} */ (Array.from(all(`input[name="${spec.name}"]`)));
      radios.forEach((radio) => {
        radio.addEventListener('change', () => {
          if (!radio.checked) return;
          const raw = spec.normalize ? spec.normalize(radio.value) : radio.value;
          runUpdate(spec, controller.update(spec.path, raw));
        }, listenOpts);
      });
      continue;
    }

    if (spec.type === 'rangePair') {
      bindNumericPair({
        range: /** @type {HTMLInputElement|null} */ (el(`${spec.baseId}-range`)),
        number: /** @type {HTMLInputElement|null} */ (el(`${spec.baseId}-number`)),
        min: spec.min ?? 0,
        max: spec.max ?? 0,
        persist: (n) => controller.update(spec.path, n),
        setInputValue,
        signal
      });
      continue;
    }

    if (spec.type === 'appearanceControl') {
      const node = /** @type {HTMLInputElement|null} */ (el(spec.id || ''));
      if (!node) continue;
      const eventName = spec.event || 'change';
      node.addEventListener(eventName, () => {
        const fromEl = spec.fromEl || ((e) => e.value);
        void controller.updateThemeOverride(spec.overridePath, fromEl(node));
      }, listenOpts);
      continue;
    }

    if (spec.type === 'appearanceRadio') {
      const radios = /** @type {HTMLInputElement[]} */ (Array.from(all(`input[name="${spec.name}"]`)));
      radios.forEach((radio) => {
        radio.addEventListener('change', () => {
          if (!radio.checked) return;
          const raw = spec.normalize ? spec.normalize(radio.value) : radio.value;
          void controller.updateThemeOverride(spec.overridePath, raw);
        }, listenOpts);
      });
      continue;
    }

    if (spec.type === 'appearanceRangePair') {
      const format = typeof spec.formatValue === 'function' ? spec.formatValue : (n) => `${n}px`;
      bindNumericPair({
        range: /** @type {HTMLInputElement|null} */ (el(`${spec.baseId}-range`)),
        number: /** @type {HTMLInputElement|null} */ (el(`${spec.baseId}-number`)),
        min: spec.min ?? 0,
        max: spec.max ?? 0,
        persist: (n) => controller.updateThemeOverride(spec.overridePath, format(n)),
        setInputValue,
        signal
      });
    }
  }
}
