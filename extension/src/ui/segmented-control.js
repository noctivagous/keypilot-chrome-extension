/**
 * Compact segmented control for popover chrome (titlebars, toolbars).
 *
 * Dark theme to match {@link createPopoverTitlebar} preview/modal variants.
 */

import { KP_UI_FONT } from '../config/constants.js';

/**
 * @typedef {object} SegmentedControlOption
 * @property {string} value
 * @property {string} label
 * @property {string} [title]
 * @property {string} [ariaLabel]
 */

/**
 * @typedef {object} SegmentedControlConfig
 * @property {Document} [doc]
 * @property {SegmentedControlOption[]} options
 * @property {string} [value] - initially selected value
 * @property {(value: string, previous: string|null) => void} [onChange]
 * @property {string} [className]
 * @property {string} [ariaLabel]
 */

/**
 * @param {SegmentedControlConfig} [config]
 * @returns {{
 *   root: HTMLElement,
 *   buttons: HTMLButtonElement[],
 *   getValue: () => string|null,
 *   setValue: (value: string, opts?: { silent?: boolean }) => void,
 *   getInteractiveElements: () => HTMLElement[]
 * }}
 */
export function createSegmentedControl(config = {}) {
  const doc = config.doc || document;
  const options = Array.isArray(config.options) ? config.options.filter(Boolean) : [];
  const className = typeof config.className === 'string' && config.className.trim()
    ? config.className.trim()
    : 'kp-segmented-control';

  /** @type {string|null} */
  let currentValue = null;
  if (config.value != null && options.some((o) => o.value === config.value)) {
    currentValue = String(config.value);
  } else if (options.length) {
    currentValue = String(options[0].value);
  }

  const root = doc.createElement('div');
  root.className = className;
  root.setAttribute('role', 'radiogroup');
  if (config.ariaLabel) {
    root.setAttribute('aria-label', config.ariaLabel);
  }
  root.style.cssText = `
    display: inline-flex;
    align-items: stretch;
    flex-shrink: 0;
    border: 1px solid #4a4a4a;
    border-radius: 5px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
    font-family: ${KP_UI_FONT};
  `;

  /** @type {HTMLButtonElement[]} */
  const buttons = [];

  const applySelectionStyles = () => {
    for (const btn of buttons) {
      const selected = btn.dataset.value === currentValue;
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
      btn.dataset.selected = selected ? '1' : '0';
      btn.style.background = selected ? 'rgba(255,255,255,0.12)' : 'transparent';
      btn.style.color = selected ? '#fff' : '#b8b8b8';
      btn.style.fontWeight = selected ? '600' : '500';
    }
  };

  /**
   * @param {string} value
   * @param {{ silent?: boolean }} [opts]
   */
  const setValue = (value, opts = {}) => {
    const next = value != null ? String(value) : null;
    if (!options.some((o) => o.value === next)) return;
    const prev = currentValue;
    if (prev === next) {
      applySelectionStyles();
      return;
    }
    currentValue = next;
    applySelectionStyles();
    if (!opts.silent && typeof config.onChange === 'function') {
      try {
        config.onChange(currentValue, prev);
      } catch { /* ignore */ }
    }
  };

  options.forEach((opt, index) => {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'kp-segmented-control-btn';
    btn.dataset.value = String(opt.value);
    btn.setAttribute('role', 'radio');
    btn.textContent = opt.label != null ? String(opt.label) : String(opt.value);
    if (opt.title) btn.title = opt.title;
    btn.setAttribute(
      'aria-label',
      opt.ariaLabel || opt.title || (opt.label != null ? String(opt.label) : String(opt.value))
    );
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 3px 8px;
      border: none;
      border-right: ${index < options.length - 1 ? '1px solid #4a4a4a' : 'none'};
      border-radius: 0;
      background: transparent;
      color: #b8b8b8;
      font-size: 11px;
      font-weight: 500;
      font-family: ${KP_UI_FONT};
      line-height: 1.2;
      letter-spacing: normal;
      text-transform: none;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.12s ease, color 0.12s ease;
    `;

    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.selected === '1') return;
      btn.style.background = 'rgba(255,255,255,0.06)';
      btn.style.color = '#e0e0e0';
    });
    btn.addEventListener('mouseleave', () => {
      applySelectionStyles();
    });
    btn.addEventListener('click', (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch { /* ignore */ }
      setValue(String(opt.value));
    });

    buttons.push(btn);
    root.appendChild(btn);
  });

  applySelectionStyles();

  return {
    root,
    buttons,
    getValue: () => currentValue,
    setValue,
    getInteractiveElements: () => buttons.slice()
  };
}
