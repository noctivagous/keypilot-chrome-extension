/**
 * New Tab "Theme" dropdown popover.
 *
 * Uses shared chrome:
 * - {@link createPopoverTitlebar} for the panel header
 * - {@link createSegmentedControl} for theme / font-size / UI-scale choices
 * - Popover API (`popover="auto"`) for light-dismiss dropdown behavior
 *
 * Built to grow: add more option rows inside the body without changing the shell.
 */

import { createPopoverTitlebar } from './popover-titlebar.js';
import { createSegmentedControl } from './segmented-control.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';

export const NEWTAB_THEME_STORAGE_KEY = 'kp_newtab_theme';
export const NEWTAB_FONT_SIZE_STORAGE_KEY = 'kp_newtab_font_size_px';
export const NEWTAB_UI_SCALE_STORAGE_KEY = 'kp_newtab_ui_scale';
/** @deprecated Migrated to {@link NEWTAB_FONT_SIZE_STORAGE_KEY}. */
export const NEWTAB_FONT_SCALE_STORAGE_KEY = 'kp_newtab_font_scale';

/** @typedef {'cyberforward' | 'earth'} NewtabThemeId */

export const NEWTAB_THEMES = /** @type {const} */ (['cyberforward', 'earth']);
export const DEFAULT_NEWTAB_THEME = 'cyberforward';

/** User-facing labels for theme ids. */
export const NEWTAB_THEME_LABELS = /** @type {const} */ ({
  cyberforward: 'Cyberforward',
  earth: 'Earth'
});

/**
 * Root font-size in CSS px. Design type is rem-based against this root.
 * Default 22px.
 */
export const DEFAULT_NEWTAB_FONT_SIZE_PX = 22;

/** Historical base for legacy `kp_newtab_font_scale` (1 = 24px root). */
const LEGACY_FONT_SCALE_BASE_PX = 24;
export const NEWTAB_FONT_SIZE_PX_OPTIONS = /** @type {const} */ ([16, 18, 20, 22, 24, 28, 32]);

/** Layout scale (CSS zoom). 1 = 100% of layout size. */
export const DEFAULT_NEWTAB_UI_SCALE = 1;
export const NEWTAB_UI_SCALE_OPTIONS = /** @type {const} */ ([1, 1.25, 1.5, 1.75, 2]);

/**
 * Content column max-width for `.topbar` + `.main` (default: 1200px).
 * `'full'` removes the cap so the column can use the full viewport (still shrinks with the window).
 * @typedef {980 | 1200 | 1400 | 1600 | 1920 | 'full'} NewtabContentWidth
 */
export const DEFAULT_NEWTAB_CONTENT_WIDTH = 1200;
export const NEWTAB_CONTENT_WIDTH_STORAGE_KEY = 'kp_newtab_content_width';
export const NEWTAB_CONTENT_WIDTH_OPTIONS = /** @type {const} */ ([980, 1200, 1400, 1600, 1920, 'full']);

const NEWTAB_DISPLAY_POPOVER_STYLE_ATTR = 'data-kp-newtab-display-popover-style';

/**
 * Keep component-local rules with the popover internals. The light-DOM host keeps
 * its existing new-tab stylesheet rules for Popover API top-layer geometry.
 *
 * @param {Document|ShadowRoot} root
 */
function ensureNewtabDisplayPopoverStyles(root) {
  injectChromeStyles(root, {
    attr: NEWTAB_DISPLAY_POPOVER_STYLE_ATTR,
    css: `
.nt-display-popover-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
}

.nt-display-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.nt-display-field-label {
  font-family: var(--nt-font-heading);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--nt-header-bar-fg);
}

.nt-display-segmented {
  width: 100%;
  justify-content: stretch;
}

.nt-display-segmented .kp-segmented-control-btn {
  flex: 1 1 auto;
}

.nt-display-popover-footer {
  display: flex;
  justify-content: stretch;
  align-items: center;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--nt-card-border);
}

.nt-display-reset-btn {
  width: 100%;
  text-align: center;
  font-weight: 600;
  background: var(--nt-btn-bg);
  border: 1px solid var(--nt-btn-secondary-border);
  color: var(--nt-fg-92);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.8125rem;
  font-family: var(--nt-font-heading);
  cursor: pointer;
}

.nt-display-reset-btn:hover {
  border-color: var(--nt-btn-border-hover);
}
`
  });
}

/**
 * @param {unknown} value
 * @returns {NewtabThemeId}
 */
export function normalizeNewtabTheme(value) {
  // Current ids + legacy storage values from earlier iterations.
  if (value === 'earth' || value === 'classic') return 'earth';
  if (value === 'cyberforward' || value === 'noctivagous') return 'cyberforward';
  return DEFAULT_NEWTAB_THEME;
}

/**
 * @param {unknown} theme
 * @returns {string}
 */
export function newtabThemeLabel(theme) {
  const id = normalizeNewtabTheme(theme);
  return NEWTAB_THEME_LABELS[id] || NEWTAB_THEME_LABELS[DEFAULT_NEWTAB_THEME];
}

/**
 * @param {unknown} value
 * @param {readonly number[]} options
 * @param {number} fallback
 */
function snapToOption(value, options, fallback) {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return fallback;
  let best = options[0];
  let bestDist = Math.abs(n - best);
  for (const opt of options) {
    const d = Math.abs(n - opt);
    if (d < bestDist) {
      best = opt;
      bestDist = d;
    }
  }
  return best;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeNewtabFontSizePx(value) {
  return snapToOption(value, NEWTAB_FONT_SIZE_PX_OPTIONS, DEFAULT_NEWTAB_FONT_SIZE_PX);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeNewtabUiScale(value) {
  return snapToOption(value, NEWTAB_UI_SCALE_OPTIONS, DEFAULT_NEWTAB_UI_SCALE);
}

/**
 * @param {unknown} value
 * @returns {NewtabContentWidth}
 */
export function normalizeNewtabContentWidth(value) {
  if (value === 'full' || value === 'none' || value === 'max') return 'full';
  if (value === 0 || value === '0') return 'full';
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return DEFAULT_NEWTAB_CONTENT_WIDTH;
  const numeric = NEWTAB_CONTENT_WIDTH_OPTIONS.filter((x) => typeof x === 'number');
  return /** @type {NewtabContentWidth} */ (
    snapToOption(n, numeric, DEFAULT_NEWTAB_CONTENT_WIDTH)
  );
}

/**
 * CSS value for --nt-content-max-width.
 * @param {unknown} width
 * @returns {string}
 */
export function contentWidthCssValue(width) {
  const w = normalizeNewtabContentWidth(width);
  return w === 'full' ? 'none' : `${w}px`;
}

/**
 * @param {unknown} width
 * @returns {string}
 */
export function contentWidthLabel(width) {
  const w = normalizeNewtabContentWidth(width);
  return w === 'full' ? 'Full' : `${w}px`;
}

/**
 * Migrate legacy font-scale multiplier (1 = 24px root) into px.
 * @param {unknown} scale
 * @returns {number|null}
 */
export function fontScaleToPx(scale) {
  const n = typeof scale === 'number' ? scale : parseFloat(String(scale ?? ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return normalizeNewtabFontSizePx(n * LEGACY_FONT_SCALE_BASE_PX);
}

/**
 * Apply theme + font size + UI scale + content width (and FOUC localStorage mirror).
 * @param {{ theme?: unknown, fontSizePx?: unknown, uiScale?: unknown, contentWidth?: unknown }} settings
 */
export function applyNewtabDisplaySettings(settings = {}) {
  const theme = normalizeNewtabTheme(settings.theme);
  const fontSizePx = normalizeNewtabFontSizePx(settings.fontSizePx);
  const uiScale = normalizeNewtabUiScale(settings.uiScale);
  const contentWidth = normalizeNewtabContentWidth(settings.contentWidth);

  try {
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    // ignore
  }

  try {
    document.documentElement.style.setProperty('--nt-font-size-px', String(fontSizePx));
    document.documentElement.style.setProperty('--nt-ui-scale', String(uiScale));
    document.documentElement.style.setProperty(
      '--nt-content-max-width',
      contentWidthCssValue(contentWidth)
    );
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(NEWTAB_THEME_STORAGE_KEY, theme);
    localStorage.setItem(NEWTAB_FONT_SIZE_STORAGE_KEY, String(fontSizePx));
    localStorage.setItem(NEWTAB_UI_SCALE_STORAGE_KEY, String(uiScale));
    localStorage.setItem(NEWTAB_CONTENT_WIDTH_STORAGE_KEY, String(contentWidth));
  } catch {
    // ignore
  }

  return { theme, fontSizePx, uiScale, contentWidth };
}

/**
 * @param {object} [config]
 * @param {Document} [config.doc]
 * @param {HTMLElement} config.anchorButton
 * @param {NewtabThemeId} [config.theme]
 * @param {number} [config.fontSizePx]
 * @param {number} [config.uiScale]
 * @param {NewtabContentWidth} [config.contentWidth]
 * @param {(theme: NewtabThemeId) => void} [config.onThemeChange]
 * @param {(fontSizePx: number) => void} [config.onFontSizeChange]
 * @param {(uiScale: number) => void} [config.onUiScaleChange]
 * @param {(contentWidth: NewtabContentWidth) => void} [config.onContentWidthChange]
 * @param {(defaults: { theme: NewtabThemeId, fontSizePx: number, uiScale: number, contentWidth: NewtabContentWidth }) => void} [config.onResetToDefaults]
 */
export function createNewtabDisplayPopover(config = {}) {
  const doc = config.doc || document;
  const anchor = config.anchorButton;
  if (!anchor) {
    throw new Error('createNewtabDisplayPopover requires anchorButton');
  }

  let theme = normalizeNewtabTheme(config.theme);
  let fontSizePx = normalizeNewtabFontSizePx(config.fontSizePx);
  let uiScale = normalizeNewtabUiScale(config.uiScale);
  let contentWidth = normalizeNewtabContentWidth(config.contentWidth);

  const supportsPopoverApi = (() => {
    try {
      return !!(
        typeof HTMLElement !== 'undefined' &&
        'popover' in HTMLElement.prototype &&
        typeof HTMLElement.prototype.showPopover === 'function'
      );
    } catch {
      return false;
    }
  })();

  const root = doc.createElement('div');
  root.id = 'nt-display-popover';
  root.className = 'nt-display-popover';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Theme options');
  if (supportsPopoverApi) {
    try {
      root.popover = 'auto';
    } catch {
      try {
        root.setAttribute('popover', 'auto');
      } catch {
        // ignore
      }
    }
  } else {
    root.hidden = true;
  }
  const shadowRoot = ensureOpenChromeShadow(root, { id: 'newtab-display-popover' });
  const panelRoot = shadowRoot || root;
  ensureNewtabDisplayPopoverStyles(panelRoot);

  const titlebarApi = createPopoverTitlebar({
    doc,
    title: 'Theme',
    variant: 'preview',
    showClose: true,
    closeTitle: 'Close',
    onClose: () => close(),
    className: 'nt-display-popover-titlebar kpv2-popover-titlebar'
  });

  const body = doc.createElement('div');
  body.className = 'nt-display-popover-body';

  const field = (labelText) => {
    const wrap = doc.createElement('div');
    wrap.className = 'nt-display-field';
    const lab = doc.createElement('div');
    lab.className = 'nt-display-field-label';
    lab.textContent = labelText;
    wrap.appendChild(lab);
    return { wrap, lab };
  };

  const afterLayoutChange = () => {
    syncAnchor();
    try {
      requestAnimationFrame(() => {
        if (isOpen()) positionNearAnchor();
      });
    } catch {
      if (isOpen()) positionNearAnchor();
    }
  };

  // --- Theme (Cyberforward / Earth) ---
  const themeField = field('Theme');
  const themeControl = createSegmentedControl({
    doc,
    value: theme,
    ariaLabel: 'New Tab theme',
    options: [
      {
        value: 'cyberforward',
        label: NEWTAB_THEME_LABELS.cyberforward,
        title: 'Cyberforward — slate + cyan (popup / website style)'
      },
      {
        value: 'earth',
        label: NEWTAB_THEME_LABELS.earth,
        title: 'Earth — original orange / black look'
      }
    ],
    onChange: (next) => {
      theme = normalizeNewtabTheme(next);
      if (typeof config.onThemeChange === 'function') {
        try {
          config.onThemeChange(theme);
        } catch {
          // ignore
        }
      }
      syncAnchor();
    }
  });
  themeControl.root.classList.add('nt-display-segmented');
  themeField.wrap.appendChild(themeControl.root);
  body.appendChild(themeField.wrap);

  // --- Font size (px) ---
  const fontField = field('Font size');
  const fontControl = createSegmentedControl({
    doc,
    value: String(fontSizePx),
    ariaLabel: 'New Tab font size',
    options: NEWTAB_FONT_SIZE_PX_OPTIONS.map((px) => ({
      value: String(px),
      label: `${px}px`,
      title:
        px === DEFAULT_NEWTAB_FONT_SIZE_PX
          ? `Default (${px}px)`
          : `Root type size ${px}px`
    })),
    onChange: (next) => {
      fontSizePx = normalizeNewtabFontSizePx(next);
      if (typeof config.onFontSizeChange === 'function') {
        try {
          config.onFontSizeChange(fontSizePx);
        } catch {
          // ignore
        }
      }
      afterLayoutChange();
    }
  });
  fontControl.root.classList.add('nt-display-segmented');
  fontField.wrap.appendChild(fontControl.root);
  body.appendChild(fontField.wrap);

  // --- UI scale (layout zoom) ---
  const scaleField = field('UI scale');
  const scaleControl = createSegmentedControl({
    doc,
    value: String(uiScale),
    ariaLabel: 'New Tab UI scale',
    options: NEWTAB_UI_SCALE_OPTIONS.map((s) => ({
      value: String(s),
      label: `${Math.round(s * 100)}%`,
      title:
        s === DEFAULT_NEWTAB_UI_SCALE
          ? 'Default layout scale'
          : `Layout scale ${Math.round(s * 100)}%`
    })),
    onChange: (next) => {
      uiScale = normalizeNewtabUiScale(next);
      if (typeof config.onUiScaleChange === 'function') {
        try {
          config.onUiScaleChange(uiScale);
        } catch {
          // ignore
        }
      }
      afterLayoutChange();
    }
  });
  scaleControl.root.classList.add('nt-display-segmented');
  scaleField.wrap.appendChild(scaleControl.root);
  body.appendChild(scaleField.wrap);

  // --- Content width (header + main max-width) ---
  const widthField = field('Width');
  const widthControl = createSegmentedControl({
    doc,
    value: String(contentWidth),
    ariaLabel: 'New Tab content width',
    options: NEWTAB_CONTENT_WIDTH_OPTIONS.map((w) => ({
      value: String(w),
      label: w === 'full' ? 'Full' : `${w}`,
      title:
        w === DEFAULT_NEWTAB_CONTENT_WIDTH
          ? `Default content width (${w}px)`
          : w === 'full'
            ? 'Use full window width (still shrinks with the viewport)'
            : `Content max-width ${w}px (shrinks if the window is narrower)`
    })),
    onChange: (next) => {
      contentWidth = normalizeNewtabContentWidth(next);
      if (typeof config.onContentWidthChange === 'function') {
        try {
          config.onContentWidthChange(contentWidth);
        } catch {
          // ignore
        }
      }
      afterLayoutChange();
    }
  });
  widthControl.root.classList.add('nt-display-segmented');
  widthField.wrap.appendChild(widthControl.root);
  body.appendChild(widthField.wrap);

  // Placeholder for future display params.
  const future = doc.createElement('div');
  future.className = 'nt-display-future';
  future.hidden = true;
  future.setAttribute('data-nt-display-future', 'true');
  body.appendChild(future);

  // --- Reset footer ---
  const footer = doc.createElement('div');
  footer.className = 'nt-display-popover-footer';

  const resetBtn = doc.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn btn-secondary nt-display-reset-btn';
  resetBtn.textContent = 'Reset to Defaults';
  resetBtn.title =
    `Restore default theme (${NEWTAB_THEME_LABELS[DEFAULT_NEWTAB_THEME]}), ` +
    `font ${DEFAULT_NEWTAB_FONT_SIZE_PX}px, UI ${Math.round(DEFAULT_NEWTAB_UI_SCALE * 100)}%, ` +
    `width ${contentWidthLabel(DEFAULT_NEWTAB_CONTENT_WIDTH)}`;
  footer.appendChild(resetBtn);
  body.appendChild(footer);

  panelRoot.appendChild(titlebarApi.titlebar);
  panelRoot.appendChild(body);
  doc.body.appendChild(root);

  /**
   * Restore factory defaults for theme, font size, UI scale, and content width.
   * Updates segmented controls, then notifies the host (single callback preferred).
   */
  function resetToDefaults() {
    theme = DEFAULT_NEWTAB_THEME;
    fontSizePx = DEFAULT_NEWTAB_FONT_SIZE_PX;
    uiScale = DEFAULT_NEWTAB_UI_SCALE;
    contentWidth = DEFAULT_NEWTAB_CONTENT_WIDTH;

    themeControl.setValue(theme, { silent: true });
    fontControl.setValue(String(fontSizePx), { silent: true });
    scaleControl.setValue(String(uiScale), { silent: true });
    widthControl.setValue(String(contentWidth), { silent: true });

    const defaults = { theme, fontSizePx, uiScale, contentWidth };

    if (typeof config.onResetToDefaults === 'function') {
      try {
        config.onResetToDefaults(defaults);
      } catch {
        // ignore
      }
    } else {
      // Fall back to individual change handlers when no bulk reset callback is provided.
      try {
        if (typeof config.onThemeChange === 'function') config.onThemeChange(theme);
      } catch {
        // ignore
      }
      try {
        if (typeof config.onFontSizeChange === 'function') config.onFontSizeChange(fontSizePx);
      } catch {
        // ignore
      }
      try {
        if (typeof config.onUiScaleChange === 'function') config.onUiScaleChange(uiScale);
      } catch {
        // ignore
      }
      try {
        if (typeof config.onContentWidthChange === 'function') {
          config.onContentWidthChange(contentWidth);
        }
      } catch {
        // ignore
      }
    }

    afterLayoutChange();
  }

  resetBtn.addEventListener('click', (e) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {
      // ignore
    }
    resetToDefaults();
  }, true);

  const syncAnchor = () => {
    try {
      const themeLabel = newtabThemeLabel(theme);
      const fontLabel = `${fontSizePx}px`;
      const scaleLabel = `${Math.round(uiScale * 100)}%`;
      const widthLabel = contentWidthLabel(contentWidth);
      anchor.setAttribute('aria-expanded', isOpen() ? 'true' : 'false');
      const summary = document.getElementById('btn-display-summary');
      if (summary) {
        summary.textContent = `Theme: ${themeLabel}`;
      }
      anchor.title = `Theme: ${themeLabel}, font ${fontLabel}, UI ${scaleLabel}, width ${widthLabel}`;
    } catch {
      // ignore
    }
  };

  const positionNearAnchor = () => {
    try {
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const vw = window.innerWidth || doc.documentElement?.clientWidth || 0;
      const vh = window.innerHeight || doc.documentElement?.clientHeight || 0;

      const popRect = root.getBoundingClientRect();
      const popW = popRect.width || 360;
      const popH = popRect.height || 240;

      let left = Math.round(rect.right - popW);
      let top = Math.round(rect.bottom + 6);

      if (left < margin) left = margin;
      if (left + popW > vw - margin) left = Math.max(margin, vw - popW - margin);

      if (top + popH > vh - margin) {
        top = Math.round(rect.top - popH - 6);
      }
      if (top < margin) top = margin;

      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
    } catch {
      // ignore
    }
  };

  function isOpen() {
    try {
      if (supportsPopoverApi && root.matches) {
        return root.matches(':popover-open');
      }
    } catch {
      // ignore
    }
    return root.hidden === false && root.style.display !== 'none';
  }

  function open() {
    if (supportsPopoverApi && typeof root.showPopover === 'function') {
      try {
        if (!root.matches?.(':popover-open')) root.showPopover();
      } catch {
        try {
          root.showPopover();
        } catch {
          // ignore
        }
      }
    } else {
      root.hidden = false;
      root.style.display = 'flex';
    }
    positionNearAnchor();
    try {
      requestAnimationFrame(() => positionNearAnchor());
    } catch {
      positionNearAnchor();
    }
    syncAnchor();
  }

  function close() {
    if (supportsPopoverApi && typeof root.hidePopover === 'function') {
      try {
        if (root.matches?.(':popover-open')) root.hidePopover();
      } catch {
        try {
          root.hidePopover();
        } catch {
          // ignore
        }
      }
    } else {
      root.hidden = true;
      root.style.display = 'none';
    }
    syncAnchor();
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  const onAnchorClick = (e) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {
      // ignore
    }
    toggle();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && isOpen()) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {
        // ignore
      }
      close();
      try {
        anchor.focus();
      } catch {
        // ignore
      }
    }
  };

  const onToggleEvent = () => {
    syncAnchor();
    if (isOpen()) positionNearAnchor();
  };

  const onResize = () => {
    if (isOpen()) positionNearAnchor();
  };

  const onDocPointerDown = (e) => {
    if (supportsPopoverApi) return;
    if (!isOpen()) return;
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (root.contains(t) || anchor.contains(t)) return;
    close();
  };

  anchor.setAttribute('aria-haspopup', 'dialog');
  anchor.setAttribute('aria-controls', root.id);
  anchor.addEventListener('click', onAnchorClick, true);
  doc.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onResize, true);
  doc.addEventListener('pointerdown', onDocPointerDown, true);
  try {
    root.addEventListener('toggle', onToggleEvent);
  } catch {
    // ignore
  }

  syncAnchor();

  return {
    root,
    open,
    close,
    toggle,
    isOpen,
    setTheme(next, opts = {}) {
      theme = normalizeNewtabTheme(next);
      themeControl.setValue(theme, { silent: !!opts.silent });
      if (!opts.silent && typeof config.onThemeChange === 'function') {
        try {
          config.onThemeChange(theme);
        } catch {
          // ignore
        }
      }
      syncAnchor();
    },
    setFontSizePx(next, opts = {}) {
      fontSizePx = normalizeNewtabFontSizePx(next);
      fontControl.setValue(String(fontSizePx), { silent: !!opts.silent });
      if (!opts.silent && typeof config.onFontSizeChange === 'function') {
        try {
          config.onFontSizeChange(fontSizePx);
        } catch {
          // ignore
        }
      }
      afterLayoutChange();
    },
    setUiScale(next, opts = {}) {
      uiScale = normalizeNewtabUiScale(next);
      scaleControl.setValue(String(uiScale), { silent: !!opts.silent });
      if (!opts.silent && typeof config.onUiScaleChange === 'function') {
        try {
          config.onUiScaleChange(uiScale);
        } catch {
          // ignore
        }
      }
      afterLayoutChange();
    },
    setContentWidth(next, opts = {}) {
      contentWidth = normalizeNewtabContentWidth(next);
      widthControl.setValue(String(contentWidth), { silent: !!opts.silent });
      if (!opts.silent && typeof config.onContentWidthChange === 'function') {
        try {
          config.onContentWidthChange(contentWidth);
        } catch {
          // ignore
        }
      }
      afterLayoutChange();
    },
    resetToDefaults,
    destroy() {
      try {
        anchor.removeEventListener('click', onAnchorClick, true);
      } catch {
        // ignore
      }
      try {
        doc.removeEventListener('keydown', onKeyDown, true);
      } catch {
        // ignore
      }
      try {
        window.removeEventListener('resize', onResize, true);
      } catch {
        // ignore
      }
      try {
        doc.removeEventListener('pointerdown', onDocPointerDown, true);
      } catch {
        // ignore
      }
      try {
        root.remove();
      } catch {
        // ignore
      }
    }
  };
}
