/**
 * Shared "NCT dark UI" chrome tokens — now backed by the dark-pro theme package
 * (`extension/themes/`). Constants interpolate `var(--kp-*)` with NCT fallbacks
 * so existing CSS templates theme when ThemeManager applies CSS variables.
 */

/** Resolves through the active theme (`--kp-font-ui`); Helvetica fallback. */
export const NCT_DARK_UI_FONT = 'var(--kp-font-ui, Helvetica, Arial, sans-serif)';

export const NCT_DARK_UI_COLORS = {
  bg: '#0f0f10',
  panel: '#232323',
  panelEdge: '#3a3a3a',
  panelEdgeDark: '#111',
  titleTop: '#4c4c4c',
  titleMid: '#353535',
  titleBot: '#252525',
  btnTop: '#4a4a4a',
  btnMid: '#343434',
  btnBot: '#2a2a2a',
  litTop: '#5a7a9a',
  litBot: '#3a5570',
  litEdge: '#2a4a66',
  accent: '#4a90c8',
  fg: '#ddd',
  fgDim: '#aaa',
  fgMute: '#777',
  fieldBg: '#141414',
  fieldEdge: '#0a0a0a',
  fieldInsetTop: '#333'
};

/** `.panel` background fill (theme `--kp-panel-bg` / `--kp-color-panel`). */
export const NCT_DARK_UI_PANEL_BACKGROUND = 'var(--kp-panel-bg, var(--kp-color-panel, #232323))';

/**
 * `.panel` border + rim + drop shadow.
 * The outer neutral rim and restrained glow keep dark Pro windows legible on
 * near-black web pages without turning every panel into a bright focus state.
 */
export const NCT_DARK_UI_PANEL_BORDER = 'var(--kp-panel-border, 1px solid #111)';
export const NCT_DARK_UI_PANEL_BOX_SHADOW = 'var(--kp-panel-shadow)';
export const NCT_DARK_UI_PANEL_RADIUS = 'var(--kp-radius-panel, 3px)';

/**
 * Full-viewport modal dimmer + page blur (Launcher / PopupManager backdrop).
 * Keep this on a sibling *behind* the panel so backdrop-filter never blurs chrome.
 */
export const NCT_DARK_UI_BACKDROP_CLASS = 'kp-nct-backdrop';
export const NCT_DARK_UI_BACKDROP_BACKGROUND = 'var(--kp-backdrop-bg, rgba(0,0,0,0.35))';
export const NCT_DARK_UI_BACKDROP_BLUR = 'var(--kp-backdrop-blur, blur(6px))';

/**
 * Opt-in scrollbar class for NCT dark scroll regions.
 * Inject {@link getNctDarkUiScrollbarCss} into the same document/shadow tree.
 */
export const NCT_DARK_UI_SCROLLBAR_CLASS = 'kp-nct-scroll';

/**
 * CSS for the shared NCT dark modal backdrop.
 * @param {{ selector?: string }} [opts]
 * @returns {string}
 */
export function getNctDarkUiBackdropCss(opts = {}) {
  const selector = typeof opts.selector === 'string' && opts.selector.trim()
    ? opts.selector.trim()
    : `.${NCT_DARK_UI_BACKDROP_CLASS}`;
  return `
${selector} {
  position: absolute;
  inset: 0;
  background: ${NCT_DARK_UI_BACKDROP_BACKGROUND};
  backdrop-filter: ${NCT_DARK_UI_BACKDROP_BLUR};
  -webkit-backdrop-filter: ${NCT_DARK_UI_BACKDROP_BLUR};
  pointer-events: auto;
}
`.trim();
}

/**
 * CSS for the shared NCT dark scrollbar.
 * Styles `.kp-nct-scroll` (and descendants) under an optional host scope.
 * @param {{
 *   scopeSelector?: string,
 *   className?: string
 * }} [opts]
 * @returns {string}
 */
export function getNctDarkUiScrollbarCss(opts = {}) {
  const cls = typeof opts.className === 'string' && opts.className.trim()
    ? opts.className.trim().replace(/^\./, '')
    : NCT_DARK_UI_SCROLLBAR_CLASS;
  const scope = typeof opts.scopeSelector === 'string' && opts.scopeSelector.trim()
    ? `${opts.scopeSelector.trim()} `
    : '';
  const root = `${scope}.${cls}`;
  const thumb = 'var(--kp-scrollbar-thumb, #4a4a4a)';
  const thumbHover = 'var(--kp-scrollbar-thumb-hover, #5c5c5c)';
  const thumbActive = 'var(--kp-color-accent, #4a90c8)';
  const track = 'var(--kp-scrollbar-track, #141414)';
  const edge = 'var(--kp-color-panel-edge-dark, #111)';
  return `
${root} {
  scrollbar-width: thin;
  scrollbar-color: ${thumb} ${track};
}
${root}::-webkit-scrollbar,
${root} ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
${root}::-webkit-scrollbar-corner,
${root} ::-webkit-scrollbar-corner {
  background: ${track};
}
${root}::-webkit-scrollbar-track,
${root} ::-webkit-scrollbar-track {
  background: ${track};
  border-left: 1px solid ${edge};
  border-top: 1px solid ${edge};
}
${root}::-webkit-scrollbar-thumb,
${root} ::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #555 0%, ${thumb} 45%, #3a3a3a 100%);
  border: 1px solid ${edge};
  border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
  min-height: 28px;
  min-width: 28px;
}
${root}::-webkit-scrollbar-thumb:hover,
${root} ::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #666 0%, ${thumbHover} 45%, #444 100%);
}
${root}::-webkit-scrollbar-thumb:active,
${root} ::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, ${thumbActive} 0%, #3a6a94 100%);
  border-color: var(--kp-color-lit-edge, #2a4a66);
}
`.trim();
}

/** `.titlebar` gradient + rim. */
export const NCT_DARK_UI_TITLEBAR_GRADIENT = 'var(--kp-titlebar-bg)';
export const NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM = 'var(--kp-titlebar-border, 1px solid #111)';
export const NCT_DARK_UI_TITLEBAR_BOX_SHADOW = 'var(--kp-titlebar-shadow)';

/**
 * Text / typing mode orange cast over the NCT titlebar bevel
 * (COLORS.ORANGE #ff8c00). Shared by Keyboard Reference titlebar + control strip.
 */
export const NCT_DARK_UI_TITLEBAR_TEXT_MODE_BACKGROUND =
  `linear-gradient(180deg, rgba(255, 140, 0, 0.28) 0%, rgba(255, 140, 0, 0.14) 45%, rgba(255, 120, 0, 0.18) 100%), ` +
  `linear-gradient(180deg, ${NCT_DARK_UI_COLORS.titleTop} 0%, ${NCT_DARK_UI_COLORS.titleMid} 45%, ${NCT_DARK_UI_COLORS.titleBot} 100%)`;
export const NCT_DARK_UI_TITLEBAR_TEXT_MODE_BORDER_BOTTOM = '1px solid rgba(120, 70, 20, 0.85)';
export const NCT_DARK_UI_TITLEBAR_TEXT_MODE_TITLE_COLOR = 'rgba(255, 210, 150, 0.98)';
export const NCT_DARK_UI_TITLEBAR_TEXT_MODE_HINT_COLOR = 'rgba(253, 186, 116, 0.95)';

/** `.btn` default (gray bevel) gradient + rim. */
export const NCT_DARK_UI_BTN_GRADIENT = 'var(--kp-btn-bg)';
export const NCT_DARK_UI_BTN_BORDER = 'var(--kp-btn-border, 1px solid #111)';
export const NCT_DARK_UI_BTN_RADIUS = 'var(--kp-radius-btn, 2px)';

/** Outline ring for compact titlebar controls such as Close and Collapse. */
export const NCT_DARK_UI_ICON_BUTTON_OUTLINE =
  'inset 0 0 0 1px var(--kp-color-panel-edge, #3a3a3a)';

/** `.btn.lit` (active / primary steel-blue) gradient + rim. */
export const NCT_DARK_UI_BTN_LIT_GRADIENT = 'var(--kp-btn-lit-bg)';
export const NCT_DARK_UI_BTN_LIT_BORDER = 'var(--kp-btn-lit-border, 1px solid #2a4a66)';

/** `.field` (recessed input) chrome. */
export const NCT_DARK_UI_FIELD_BACKGROUND = 'var(--kp-field-bg, #141414)';
export const NCT_DARK_UI_FIELD_BORDER = 'var(--kp-field-border, 1px solid #0a0a0a)';
export const NCT_DARK_UI_FIELD_BOX_SHADOW = 'var(--kp-field-shadow)';
export const NCT_DARK_UI_FIELD_FOCUS_BORDER = 'var(--kp-color-accent, #4a90c8)';
export const NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW = 'inset 0 0 0 1px color-mix(in srgb, var(--kp-color-accent, #4a90c8) 35%, transparent)';

/** Accent focus ring for interactive chrome (buttons, segments). */
export const NCT_DARK_UI_FOCUS_RING = 'var(--kp-color-focus-ring)';
export const NCT_DARK_UI_SELECTED_TINT = 'var(--kp-color-selected, rgba(74,144,200,0.22))';
export const NCT_DARK_UI_SELECTED_TEXT = 'var(--kp-color-selected-text, #e8f0f8)';
export const NCT_DARK_UI_HOVER_TINT = 'var(--kp-color-hover, rgba(255,255,255,0.06))';

/**
 * Compact NCT dark scale / range control (titlebars, overlay toolbars).
 * Inject {@link getNctDarkUiScaleSliderCss} into the same document/shadow tree,
 * or let {@link createNctDarkUiScaleSlider} embed the stylesheet.
 */
export const NCT_DARK_UI_SCALE_CLASS = 'kp-nct-scale';
export const NCT_DARK_UI_SCALE_STYLE_ATTR = 'data-kp-nct-scale-styles';

/**
 * CSS for the shared NCT dark scale slider.
 * @param {{
 *   className?: string,
 *   rangeWidth?: string
 * }} [opts]
 * @returns {string}
 */
export function getNctDarkUiScaleSliderCss(opts = {}) {
  const cls = typeof opts.className === 'string' && opts.className.trim()
    ? opts.className.trim().replace(/^\./, '')
    : NCT_DARK_UI_SCALE_CLASS;
  const rangeWidth = typeof opts.rangeWidth === 'string' && opts.rangeWidth.trim()
    ? opts.rangeWidth.trim()
    : '82px';
  return `
.${cls} {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 3px 8px;
  border: 1px solid var(--kp-color-panel-edge-dark, #111);
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  background: var(--kp-color-field-bg, #141414);
  box-shadow: 0 0 0 1px var(--kp-color-panel-edge, #3a3a3a) inset;
  color: var(--kp-color-fg, #ddd);
  font-family: ${NCT_DARK_UI_FONT};
  white-space: nowrap;
  box-sizing: border-box;
}
.${cls}-label {
  font-size: var(--kp-type-kbd-size, 10px);
  font-weight: var(--kp-type-weight-bold, 700);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--kp-color-fg-mute, #777);
  user-select: none;
}
.${cls}-edge {
  font-size: var(--kp-type-kbd-size, 10px);
  color: var(--kp-color-fg-dim, #aaa);
  font-variant-numeric: tabular-nums;
  user-select: none;
}
.${cls}-value {
  min-width: 2.6em;
  font-size: 11px;
  font-weight: 600;
  color: var(--kp-color-fg, #ddd);
  font-variant-numeric: tabular-nums;
  text-align: right;
  user-select: none;
}
.${cls}-range {
  -webkit-appearance: none;
  appearance: none;
  width: ${rangeWidth};
  height: 4px;
  border-radius: var(--kp-radius-xs, 2px);
  background: linear-gradient(90deg, var(--kp-color-panel-edge-dark, #111) 0%, var(--kp-color-accent, #4a90c8) 100%);
  outline: none;
  cursor: pointer;
  margin: 0;
  vertical-align: middle;
}
.${cls}-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: var(--kp-radius-xs, 2px);
  background: ${NCT_DARK_UI_BTN_LIT_GRADIENT};
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  box-shadow: 0 1px 3px rgba(0,0,0,0.55);
  cursor: pointer;
}
.${cls}-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: var(--kp-radius-xs, 2px);
  background: var(--kp-color-lit-bot, #3a5570);
  border: ${NCT_DARK_UI_BTN_LIT_BORDER};
  box-shadow: 0 1px 3px rgba(0,0,0,0.55);
  cursor: pointer;
}
.${cls}-range::-moz-range-track {
  height: 4px;
  border-radius: var(--kp-radius-xs, 2px);
  background: linear-gradient(90deg, var(--kp-color-panel-edge-dark, #111) 0%, var(--kp-color-accent, #4a90c8) 100%);
}
.${cls}-range:focus-visible {
  outline: none;
  box-shadow: ${NCT_DARK_UI_FOCUS_RING};
}
`.trim();
}

/**
 * Build a compact NCT dark scale slider.
 *
 * @param {{
 *   doc?: Document,
 *   label?: string,
 *   title?: string,
 *   ariaLabel?: string,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   value?: number,
 *   minLabel?: string|null,
 *   maxLabel?: string|null,
 *   formatValue?: (value: number) => string,
 *   onInput?: (value: number, event: Event) => void,
 *   className?: string,
 *   rangeWidth?: string,
 *   embedStyles?: boolean
 * }} [opts]
 * @returns {{
 *   root: HTMLElement,
 *   range: HTMLInputElement,
 *   valueEl: HTMLElement,
 *   getValue: () => number,
 *   setValue: (value: number, opts?: { silent?: boolean }) => void
 * }}
 */
export function createNctDarkUiScaleSlider(opts = {}) {
  const doc = opts.doc || document;
  const cls = typeof opts.className === 'string' && opts.className.trim()
    ? opts.className.trim().replace(/^\./, '')
    : NCT_DARK_UI_SCALE_CLASS;
  const min = Number.isFinite(Number(opts.min)) ? Number(opts.min) : 0.8;
  const max = Number.isFinite(Number(opts.max)) ? Number(opts.max) : 1.75;
  const step = Number.isFinite(Number(opts.step)) ? Number(opts.step) : 0.05;
  const initial = Number.isFinite(Number(opts.value)) ? Number(opts.value) : min;
  const formatValue = typeof opts.formatValue === 'function'
    ? opts.formatValue
    : (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return '';
      return `${n.toFixed(2).replace(/\.?0+$/, '')}×`;
    };

  const root = doc.createElement('label');
  root.className = cls;
  if (opts.title) root.title = String(opts.title);

  if (opts.embedStyles !== false) {
    const style = doc.createElement('style');
    style.setAttribute(NCT_DARK_UI_SCALE_STYLE_ATTR, 'true');
    style.textContent = getNctDarkUiScaleSliderCss({
      className: cls,
      rangeWidth: opts.rangeWidth
    });
    root.appendChild(style);
  }

  if (opts.label) {
    const label = doc.createElement('span');
    label.className = `${cls}-label`;
    label.textContent = String(opts.label);
    root.appendChild(label);
  }

  if (opts.minLabel != null && opts.minLabel !== '') {
    const minTag = doc.createElement('span');
    minTag.className = `${cls}-edge`;
    minTag.textContent = String(opts.minLabel);
    root.appendChild(minTag);
  }

  const range = doc.createElement('input');
  range.type = 'range';
  range.className = `${cls}-range`;
  range.min = String(min);
  range.max = String(max);
  range.step = String(step);
  range.value = String(initial);
  range.setAttribute(
    'aria-label',
    String(opts.ariaLabel || opts.title || opts.label || 'Scale')
  );
  root.appendChild(range);

  if (opts.maxLabel != null && opts.maxLabel !== '') {
    const maxTag = doc.createElement('span');
    maxTag.className = `${cls}-edge`;
    maxTag.textContent = String(opts.maxLabel);
    root.appendChild(maxTag);
  }

  const valueEl = doc.createElement('output');
  valueEl.className = `${cls}-value`;
  valueEl.textContent = formatValue(initial);
  root.appendChild(valueEl);

  const readValue = () => {
    const n = Number(range.value);
    return Number.isFinite(n) ? n : min;
  };

  const setValue = (value, setOpts = {}) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(max, Math.max(min, n));
    range.value = String(clamped);
    valueEl.textContent = formatValue(clamped);
    valueEl.value = formatValue(clamped);
    if (!setOpts.silent && typeof opts.onInput === 'function') {
      try { opts.onInput(clamped, null); } catch { /* ignore */ }
    }
  };

  const onSlide = (event) => {
    const next = readValue();
    valueEl.textContent = formatValue(next);
    valueEl.value = formatValue(next);
    if (typeof opts.onInput === 'function') {
      try { opts.onInput(next, event); } catch { /* ignore */ }
    }
  };
  range.addEventListener('input', onSlide);
  range.addEventListener('change', onSlide);

  return {
    root,
    range,
    valueEl,
    getValue: readValue,
    setValue
  };
}

/**
 * NCT pro-app chrome for top-center flash / toggle toasts.
 * Keeps the caller's accent color as the fill; adds bevel rim + specular sheen.
 *
 * @param {HTMLElement|null} el
 * @param {{
 *   backgroundColor?: string,
 *   hasThumbnail?: boolean,
 *   zIndex?: number|string
 * }} [opts]
 */
export function applyFlashNotificationStyle(el, opts = {}) {
  if (!el) return;
  const color = String(opts.backgroundColor || '#4CAF50');
  const hasThumbnail = !!opts.hasThumbnail;
  const zIndex = opts.zIndex != null ? String(opts.zIndex) : '';
  try {
    Object.assign(el.style, {
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      // Specular bevel over the solid accent (color stays dominant).
      background:
        `linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.07) 34%, rgba(0,0,0,0.14) 100%), ${color}`,
      backgroundColor: color,
      color: '#fff',
      padding: hasThumbnail ? '8px 12px 8px 14px' : '8px 16px',
      borderRadius: 'var(--kp-radius-btn, 2px)',
      border: '1px solid rgba(0,0,0,0.55)',
      fontSize: 'var(--kp-type-ui-size, 12px)',
      fontWeight: '700',
      letterSpacing: '0.02em',
      fontFamily: NCT_DARK_UI_FONT,
      lineHeight: '1.35',
      textShadow: '0 1px 0 rgba(0,0,0,0.35)',
      zIndex,
      boxShadow:
        '0 0 0 1px rgba(255,255,255,0.22) inset, ' +
        '0 1px 0 rgba(255,255,255,0.16) inset, ' +
        '0 10px 28px rgba(0,0,0,0.50)',
      opacity: '0',
      transition: 'opacity 0.18s ease-out',
      pointerEvents: 'none',
      maxWidth: hasThumbnail ? '560px' : '420px',
      wordWrap: 'break-word',
      textAlign: hasThumbnail ? 'left' : 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: hasThumbnail ? 'flex-start' : 'center',
      gap: hasThumbnail ? '12px' : '0',
      boxSizing: 'border-box'
    });
  } catch { /* ignore */ }
}

/**
 * Thumbnail frame chrome for flash toasts that include a preview image.
 * @param {HTMLElement|null} el
 */
export function applyFlashNotificationThumbnailStyle(el) {
  if (!el) return;
  try {
    Object.assign(el.style, {
      flex: '0 0 auto',
      maxWidth: '150px',
      maxHeight: '150px',
      borderRadius: 'var(--kp-radius-btn, 2px)',
      overflow: 'hidden',
      backgroundColor: '#141414',
      border: '1px solid rgba(0,0,0,0.55)',
      boxShadow:
        '0 0 0 1px rgba(255,255,255,0.18) inset, 0 6px 16px rgba(0,0,0,0.45)',
      lineHeight: '0'
    });
  } catch { /* ignore */ }
}