/**
 * Declarative Settings control binder.
 * Adapts DOM controls to SettingsController.update / updateThemeOverride.
 */

import { CLICK_EFFECT_IDS } from './settings-manager.js';
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
  { type: 'select', id: 'click-focus-color', path: 'clickMode.focusColor' },
  { type: 'toggle', id: 'click-overlay-fill', path: 'clickMode.overlayFillEnabled' },
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
      const range = /** @type {HTMLInputElement|null} */ (el(`${spec.baseId}-range`));
      const number = /** @type {HTMLInputElement|null} */ (el(`${spec.baseId}-number`));
      const commit = (raw) => {
        const n = clampNumber(raw, spec.min ?? 0, spec.max ?? 0);
        setInputValue(range, n);
        setInputValue(number, n);
        void controller.update(spec.path, n);
      };
      range?.addEventListener('input', () => commit(range.value), listenOpts);
      number?.addEventListener('input', () => commit(number.value), listenOpts);
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
      const range = /** @type {HTMLInputElement|null} */ (el(`${spec.baseId}-range`));
      const number = /** @type {HTMLInputElement|null} */ (el(`${spec.baseId}-number`));
      const format = typeof spec.formatValue === 'function' ? spec.formatValue : (n) => `${n}px`;
      const commit = (raw) => {
        const n = clampNumber(raw, spec.min ?? 0, spec.max ?? 0);
        setInputValue(range, n);
        setInputValue(number, n);
        void controller.updateThemeOverride(spec.overridePath, format(n));
      };
      range?.addEventListener('input', () => commit(range.value), listenOpts);
      number?.addEventListener('input', () => commit(number.value), listenOpts);
    }
  }
}
