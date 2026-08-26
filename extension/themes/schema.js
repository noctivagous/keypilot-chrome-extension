/**
 * KeyPilot theme token schema + CSS variable emission.
 *
 * Themes fill this shape; UI reads CSS vars (`--kp-*`) or `getActiveTheme()`.
 * `themeOverrides` (settings) is a shallow-merged partial of the same shape.
 */

export const DEFAULT_THEME_ID = 'dark-pro';

export const THEME_IDS = Object.freeze([
  'dark-pro',
  'gray-metal-pro',
  'gx-er'
]);

export const THEME_META = Object.freeze({
  'dark-pro': { name: 'Dark Pro' },
  'gray-metal-pro': { name: 'Gray Metal Pro' },
  'gx-er': { name: 'GX-er' }
});

const PRO_SANS = 'Helvetica, Arial, sans-serif';
const PRO_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const TYPE_ROLES = Object.freeze([
  'display',
  'heading',
  'subhead',
  'body',
  'ui',
  'kbd',
  'mono',
  'caption'
]);

/** Default type scale / weight / tracking (dark-pro / gray-metal). */
export function createProTypeTokens(stacks = {}) {
  return {
    stacks: {
      display: stacks.display || PRO_SANS,
      heading: stacks.heading || PRO_SANS,
      subhead: stacks.subhead || PRO_SANS,
      body: stacks.body || PRO_SANS,
      ui: stacks.ui || PRO_SANS,
      kbd: stacks.kbd || PRO_MONO,
      mono: stacks.mono || PRO_MONO,
      caption: stacks.caption || PRO_SANS
    },
    size: {
      display: '22px',
      h1: '22px',
      h2: '16px',
      h3: '14px',
      body: '13px',
      ui: '12px',
      kbd: '10px',
      caption: '11px',
      code: '12px'
    },
    scale: '1.25',
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    },
    letterSpacing: {
      display: '0.02em',
      titlebar: '0.02em',
      ui: 'normal'
    },
    textTransform: {
      display: 'none',
      titlebar: 'none'
    },
    lineHeight: {
      tight: '1.2',
      body: '1.35',
      prose: '1.55'
    }
  };
}

/** Titlebar chrome: title case, leading icon visibility, shortcut chip. */
export function createTitlebarChromeTokens(overrides = {}) {
  return {
    titleWeight: '600',
    iconDisplay: 'none',
    iconSize: '12px',
    kbdTransform: 'none',
    kbdTracking: '0.02em',
    ...overrides
  };
}

export function createProRadiusTokens(overrides = {}) {
  return {
    none: '0px',
    xs: '2px',
    sm: '3px',
    md: '6px',
    lg: '10px',
    pill: '999px',
    panel: '3px',
    btn: '2px',
    field: '2px',
    key: '7px',
    plate: '14px',
    ...overrides
  };
}

const KEY_CLIP_NONE = 'none';
const KEY_SHADE_BEVEL =
  'linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 18%, transparent 42%)';

/** Keyboard Reference keycap chrome. */
export function createKeyChromeTokens(overrides = {}) {
  return {
    shading: 'bevel',
    border: '1px solid rgba(0, 0, 0, 0.4)',
    cornerMode: 'radius',
    cutSize: '4px',
    ...overrides
  };
}

function keyClipPath(cutSize) {
  const s = cutSize || '4px';
  return `polygon(${s} 0, calc(100% - ${s}) 0, 100% ${s}, 100% calc(100% - ${s}), calc(100% - ${s}) 100%, ${s} 100%, 0 calc(100% - ${s}), 0 ${s})`;
}

/**
 * @param {object} theme
 * @returns {Record<string, string>}
 */
export function themeToCssVars(theme) {
  const t = theme && typeof theme === 'object' ? theme : {};
  const type = t.type || createProTypeTokens();
  const stacks = type.stacks || {};
  const size = type.size || {};
  const weight = type.weight || {};
  const ls = type.letterSpacing || {};
  const tf = type.textTransform || {};
  const lh = type.lineHeight || {};
  const radius = t.radius || createProRadiusTokens();
  const color = t.color || {};
  const effect = t.effect || {};
  const shape = t.shape || { cornerMode: 'radius', cutSize: '0px' };
  const keys = t.keys || createKeyChromeTokens();
  const keyCornerCut = (keys.cornerMode || 'radius') === 'cut';
  const icons = t.icons || {};
  const iconColor = icons.color || {};

  /** @type {Record<string, string>} */
  const vars = {
    '--kp-theme-id': String(t.id || DEFAULT_THEME_ID),
    '--kp-font-display': stacks.display || PRO_SANS,
    '--kp-font-heading': stacks.heading || PRO_SANS,
    '--kp-font-subhead': stacks.subhead || PRO_SANS,
    '--kp-font-body': stacks.body || PRO_SANS,
    '--kp-font-ui': stacks.ui || PRO_SANS,
    '--kp-font-kbd': stacks.kbd || PRO_MONO,
    '--kp-font-mono': stacks.mono || PRO_MONO,
    '--kp-font-caption': stacks.caption || PRO_SANS,
    '--kp-type-scale': String(type.scale || '1'),
    '--kp-type-display-size': size.display || '22px',
    '--kp-type-h1-size': size.h1 || '22px',
    '--kp-type-h2-size': size.h2 || '16px',
    '--kp-type-h3-size': size.h3 || '14px',
    '--kp-type-body-size': size.body || '13px',
    '--kp-type-ui-size': size.ui || '12px',
    '--kp-type-kbd-size': size.kbd || '10px',
    '--kp-type-caption-size': size.caption || '11px',
    '--kp-type-code-size': size.code || '12px',
    '--kp-type-weight-regular': weight.regular || '400',
    '--kp-type-weight-medium': weight.medium || '500',
    '--kp-type-weight-semibold': weight.semibold || '600',
    '--kp-type-weight-bold': weight.bold || '700',
    '--kp-type-tracking-display': ls.display || '0.02em',
    '--kp-type-tracking-titlebar': ls.titlebar || '0.02em',
    '--kp-type-tracking-ui': ls.ui || 'normal',
    '--kp-type-transform-display': tf.display || 'none',
    '--kp-type-transform-titlebar': tf.titlebar || 'none',
    '--kp-titlebar-title-weight': (t.titlebar && t.titlebar.titleWeight) || '600',
    '--kp-titlebar-icon-display': (t.titlebar && t.titlebar.iconDisplay) || 'none',
    '--kp-titlebar-icon-size': (t.titlebar && t.titlebar.iconSize) || '12px',
    '--kp-kbd-transform': (t.titlebar && t.titlebar.kbdTransform) || 'none',
    '--kp-kbd-tracking': (t.titlebar && t.titlebar.kbdTracking) || '0.02em',
    '--kp-type-leading-tight': lh.tight || '1.2',
    '--kp-type-leading-body': lh.body || '1.35',
    '--kp-type-leading-prose': lh.prose || '1.55',
    '--kp-radius-none': radius.none || '0px',
    '--kp-radius-xs': radius.xs || '2px',
    '--kp-radius-sm': radius.sm || '3px',
    '--kp-radius-md': radius.md || '6px',
    '--kp-radius-lg': radius.lg || '10px',
    '--kp-radius-pill': radius.pill || '999px',
    '--kp-radius-panel': radius.panel || '3px',
    '--kp-radius-btn': radius.btn || '2px',
    '--kp-radius-field': radius.field || '2px',
    '--kp-radius-key': radius.key || '7px',
    '--kp-radius-plate': radius.plate || '14px',
    '--kp-color-bg': color.bg || '#0f0f10',
    '--kp-color-panel': color.panel || '#232323',
    '--kp-color-panel-edge': color.panelEdge || '#3a3a3a',
    '--kp-color-panel-edge-dark': color.panelEdgeDark || '#111',
    '--kp-color-title-top': color.titleTop || '#4c4c4c',
    '--kp-color-title-mid': color.titleMid || '#353535',
    '--kp-color-title-bot': color.titleBot || '#252525',
    '--kp-color-btn-top': color.btnTop || '#4a4a4a',
    '--kp-color-btn-mid': color.btnMid || '#343434',
    '--kp-color-btn-bot': color.btnBot || '#2a2a2a',
    '--kp-color-lit-top': color.litTop || '#5a7a9a',
    '--kp-color-lit-bot': color.litBot || '#3a5570',
    '--kp-color-lit-edge': color.litEdge || '#2a4a66',
    '--kp-color-accent': color.accent || '#4a90c8',
    '--kp-color-accent-2': color.accent2 || color.accent || '#4a90c8',
    '--kp-color-fg': color.fg || '#ddd',
    '--kp-color-fg-dim': color.fgDim || '#aaa',
    '--kp-color-fg-mute': color.fgMute || '#777',
    '--kp-color-field-bg': color.fieldBg || '#141414',
    '--kp-color-field-edge': color.fieldEdge || '#0a0a0a',
    '--kp-color-field-inset': color.fieldInsetTop || '#333',
    '--kp-color-hover': color.hover || 'rgba(255,255,255,0.06)',
    '--kp-color-selected': color.selected || 'rgba(74,144,200,0.22)',
    '--kp-color-selected-text': color.selectedText || '#e8f0f8',
    '--kp-color-focus-ring': color.focusRing || 'inset 0 0 0 1px rgba(74,144,200,0.55)',
    '--kp-color-kbd-fg': color.kbdColor || color.fg || '#ddd',
    '--kp-titlebar-bg': (() => {
      const titleGrad = `linear-gradient(180deg, ${color.titleTop || '#4c4c4c'} 0%, ${color.titleMid || '#353535'} 45%, ${color.titleBot || '#252525'} 100%)`;
      const baked = String(effect.titlebarBg || '');
      const idx = baked.lastIndexOf('linear-gradient(180deg');
      return idx > 0 ? `${baked.slice(0, idx)}${titleGrad}` : titleGrad;
    })(),
    '--kp-titlebar-border': effect.titlebarBorder || `1px solid ${color.panelEdgeDark || '#111'}`,
    '--kp-titlebar-shadow': effect.titlebarShadow || `0 1px 0 ${color.panelEdge || '#3a3a3a'}`,
    '--kp-panel-bg': color.panel || effect.panelBg || '#232323',
    '--kp-panel-border': effect.panelBorder || `1px solid ${color.panelEdgeDark || '#111'}`,
    '--kp-panel-shadow': effect.panelShadow ||
      `0 0 0 1px ${color.panelEdge || '#3a3a3a'} inset, 0 0 0 1px rgba(190, 190, 190, 0.52), 0 0 10px rgba(255, 255, 255, 0.14), 0 16px 40px rgba(0,0,0,0.55)`,
    '--kp-btn-bg': effect.btnBg ||
      `linear-gradient(180deg, ${color.btnTop || '#4a4a4a'} 0%, ${color.btnMid || '#343434'} 50%, ${color.btnBot || '#2a2a2a'} 100%)`,
    '--kp-btn-border': effect.btnBorder || `1px solid ${color.panelEdgeDark || '#111'}`,
    '--kp-btn-lit-bg': effect.btnLitBg ||
      `linear-gradient(180deg, ${color.litTop || '#5a7a9a'} 0%, ${color.litBot || '#3a5570'} 100%)`,
    '--kp-btn-lit-border': effect.btnLitBorder || `1px solid ${color.litEdge || '#2a4a66'}`,
    '--kp-field-bg': effect.fieldBg || (color.fieldBg || '#141414'),
    '--kp-field-border': effect.fieldBorder || `1px solid ${color.fieldEdge || '#0a0a0a'}`,
    '--kp-field-shadow': effect.fieldShadow || `inset 0 1px 0 ${color.fieldInsetTop || '#333'}`,
    '--kp-kbd-bg': effect.kbdBg || (color.fieldBg || '#141414'),
    '--kp-kbd-border': effect.kbdBorder || `1px solid ${color.panelEdgeDark || '#111'}`,
    '--kp-kbd-shadow': effect.kbdShadow || 'none',
    '--kp-backdrop-bg': effect.backdropBg || 'rgba(0,0,0,0.35)',
    '--kp-backdrop-blur': effect.backdropBlur || 'blur(6px)',
    '--kp-hatch-edit': effect.hatchEdit ||
      'repeating-linear-gradient(-45deg, rgba(180, 200, 220, 0.08) 0px, rgba(180, 200, 220, 0.08) 1px, transparent 1px, transparent 7px)',
    '--kp-hatch-edit-titlebar-bg': effect.hatchEditTitlebarBg ||
      'linear-gradient(180deg, #646464 0%, #4a4a4a 45%, #383838 100%)',
    '--kp-hatch-edit-body-bg': effect.hatchEditBodyBg || '#1a1c20',
    '--kp-scrollbar-thumb': color.scrollbarThumb || '#4a4a4a',
    '--kp-scrollbar-thumb-hover': color.scrollbarThumbHover || '#5c5c5c',
    '--kp-scrollbar-track': color.scrollbarTrack || (color.fieldBg || '#141414'),
    '--kp-corner-mode': shape.cornerMode || 'radius',
    '--kp-cut-size': shape.cutSize || '0px',
    '--kp-key-shading': keys.shading || 'bevel',
    '--kp-key-border': keys.border || '1px solid rgba(0, 0, 0, 0.4)',
    '--kp-key-corner-mode': keys.cornerMode || 'radius',
    '--kp-key-cut-size': keys.cutSize || '4px',
    '--kp-key-clip': keyCornerCut ? keyClipPath(keys.cutSize || '4px') : KEY_CLIP_NONE,
    '--kp-key-effective-radius': keyCornerCut ? '0px' : (radius.key || '7px'),
    // Used by @supports (corner-shape: bevel) upgrade (clip-path baseline otherwise).
    '--kp-key-shape-radius': keyCornerCut ? (keys.cutSize || '4px') : (radius.key || '7px'),
    '--kp-key-corner-shape': keyCornerCut ? 'bevel' : 'round',
    '--kp-key-sheen-opacity': (keys.shading || 'bevel') === 'flat' ? '0' : '1',
    '--kp-key-shade-layer': (keys.shading || 'bevel') === 'flat' ? 'transparent' : KEY_SHADE_BEVEL,
    '--kp-icon-chrome': iconColor.chrome || (color.fg || '#ddd'),
    '--kp-icon-keycap': iconColor.keycap || (color.fg || '#0c1018'),
    '--kp-icon-accent': iconColor.accent || (color.accent || '#4a90c8'),
    '--kp-key-icon': iconColor.keycap || '#0c1018'
  };
  return vars;
}

/**
 * @param {Record<string, string>} vars
 * @param {string} [selector]
 * @returns {string}
 */
export function cssVarsToBlock(vars, selector = ':host, :root, [data-kp-theme]') {
  const lines = Object.entries(vars || {}).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * Shared titlebar chrome driven by theme tokens (Layout Config language).
 * @returns {string}
 */
export function getTitlebarChromeCss() {
  return `
.kp-titlebar-icon {
  display: var(--kp-titlebar-icon-display, none);
  width: var(--kp-titlebar-icon-size, 12px);
  height: var(--kp-titlebar-icon-size, 12px);
  flex: 0 0 auto;
  background-color: var(--kp-icon-chrome, currentColor);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
[data-kp-titlebar-shortcut],
.kp-titlebar-kbd {
  font-family: var(--kp-font-kbd, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: var(--kp-type-kbd-size, 10px);
  font-weight: var(--kp-type-weight-regular, 400);
  line-height: 1.2;
  text-transform: var(--kp-kbd-transform, none);
  letter-spacing: var(--kp-kbd-tracking, 0.02em);
  padding: 1px 6px;
  border: var(--kp-kbd-border, 1px solid #111);
  border-radius: var(--kp-radius-btn, 2px);
  background: var(--kp-kbd-bg, #141414);
  color: var(--kp-color-kbd-fg, #ddd);
  box-shadow: var(--kp-kbd-shadow, none);
  box-sizing: border-box;
}
.kpv2-popover-titlebar,
[data-kp-popover-titlebar],
[data-kp-floating-keyboard-titlebar],
.kp-cfg-titlebar,
.kp-action-config-panel__titlebar,
.kp-procedure-result__titlebar,
.kp-practice-popover__header {
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
}
.kpv2-popover-titlebar-title,
[data-kp-floating-keyboard-title],
.kp-cfg-title,
.kp-action-config-panel__title,
.kp-procedure-result__title,
.kp-practice-popover__title {
  font-weight: var(--kp-titlebar-title-weight, 600);
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
  color: var(--kp-color-fg, inherit);
}
`.trim();
}

/**
 * Custom select trigger + Popover API list (icons + titlebar kbd chips).
 * @returns {string}
 */
export function getSelectMenuCss() {
  return `
.kp-select {
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  min-width: 0;
  box-sizing: border-box;
  font-family: var(--kp-font-ui, Helvetica, Arial, sans-serif);
}
.kp-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 2px 6px;
  border: var(--kp-field-border, 1px solid #0a0a0a);
  border-radius: var(--kp-radius-field, 2px);
  background: var(--kp-field-bg, #141414);
  color: var(--kp-color-fg, #ddd);
  box-shadow: var(--kp-field-shadow, none);
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
}
.kp-select--titlebar .kp-select-trigger {
  width: 190px;
  height: 22px;
  margin-left: 6px;
}
.kp-select-trigger:hover {
  background: color-mix(in srgb, var(--kp-color-hover, rgba(255,255,255,0.08)) 70%, var(--kp-field-bg, #141414));
}
.kp-select-trigger:focus-visible {
  outline: 1px solid var(--kp-color-focus-ring, var(--kp-color-accent, #4a90c8));
  outline-offset: 1px;
}
.kp-select.is-open .kp-select-trigger,
.kp-select-trigger[aria-expanded="true"] {
  border-color: var(--kp-color-accent, #4a90c8);
}
.kp-select-trigger-icon,
.kp-select-item-icon {
  display: none;
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  background-color: var(--kp-icon-chrome, currentColor);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
.kp-select-trigger-icon:not([hidden]),
.kp-select-item-icon:not([hidden]) {
  display: block;
}
.kp-select-trigger-label,
.kp-select-item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: normal;
}
.kp-select-chevron {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-left: 3.5px solid transparent;
  border-right: 3.5px solid transparent;
  border-top: 4px solid currentColor;
  opacity: 0.65;
  flex: 0 0 auto;
}
.kp-select-menu {
  position: fixed;
  /* Kill UA popover centering (inset 0 / margin auto) without locking longhands. */
  margin: 0;
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  width: max-content;
  height: fit-content;
  z-index: 2147483049;
  padding: 4px 0;
  min-width: 190px;
  max-width: min(360px, calc(100vw - 16px));
  max-height: min(320px, calc(100vh - 16px));
  overflow-x: hidden;
  overflow-y: scroll !important;
  box-sizing: border-box;
  border: var(--kp-panel-border, 1px solid #111);
  border-radius: var(--kp-radius-panel, 3px);
  background: var(--kp-panel-bg, #232323);
  box-shadow: var(--kp-panel-shadow, 0 8px 24px rgba(0,0,0,0.45));
  color: var(--kp-color-fg, #ddd);
  font-family: var(--kp-font-ui, Helvetica, Arial, sans-serif);
  font-size: 12px;
  line-height: 1.3;
  text-transform: none;
  letter-spacing: normal;
  scrollbar-color: #a8a8a8 #747474;
}
/* Blink: scrollbar-width uses overlay bars that only appear on scroll and
   suppress ::-webkit-scrollbar. Unset so the themed classic bar paints. */
@supports selector(::-webkit-scrollbar) {
  .kp-select-menu {
    scrollbar-width: unset;
    scrollbar-color: unset;
  }
}
.kp-select-menu::-webkit-scrollbar {
  -webkit-appearance: none;
  appearance: none;
  display: block !important;
  width: 10px !important;
  height: 10px !important;
  background: #747474;
}
.kp-select-menu::-webkit-scrollbar-corner {
  background: #747474;
}
.kp-select-menu::-webkit-scrollbar-track {
  background: #747474;
  border-left: 1px solid rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(0, 0, 0, 0.3);
}
.kp-select-menu::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #c0c0c0 0%, #a8a8a8 45%, #8d8d8d 100%);
  border: 1px solid #4a4a4a;
  border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  min-height: 28px;
  min-width: 28px;
}
.kp-select-menu::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #cecece 0%, #b5b5b5 45%, #999 100%);
}
.kp-select-menu::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #b5b5b5 0%, #8d8d8d 100%);
  border-color: #3d3d3d;
}
.kp-select-menu[data-kp-select-fallback="true"][hidden] {
  display: none !important;
}
.kp-select-group {
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--kp-color-fg-mute, #777);
  pointer-events: none;
  user-select: none;
}
.kp-select-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--kp-color-field-edge, #0a0a0a);
  border: 0;
  pointer-events: none;
}
.kp-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 5px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 400;
  text-align: left;
  text-transform: none;
  letter-spacing: normal;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  box-sizing: border-box;
  outline: none;
}
.kp-select-item:hover,
.kp-select-item.is-active {
  background: var(--kp-color-hover, rgba(255,255,255,0.08));
  outline: 1px solid var(--kp-color-focus-ring, var(--kp-color-accent, #4a90c8));
  outline-offset: -1px;
}
.kp-select-item[aria-selected="true"] {
  background: var(--kp-color-selected, rgba(74, 144, 200, 0.28));
  color: var(--kp-color-selected-text, var(--kp-color-fg, #ddd));
}
.kp-select-item .kp-titlebar-kbd {
  margin-left: auto;
  flex-shrink: 0;
}
`.trim();
}

/**
 * Chamfered chrome windows.
 * Baseline: clip-path polygon (works everywhere; clips borders/shadows).
 * Upgrade: corner-shape: bevel so border / outline / box-shadow follow the cut.
 *
 * `!important` on the upgrade border-radius is required: chrome shells set
 * inline `border-radius: var(--kp-radius-panel)`, and cut themes emit
 * `--kp-radius-panel: 0px` (legacy clip-path pairing). Without !important the
 * inline 0 wins, clip-path is cleared, and corners stay square.
 * @returns {string}
 */
export function getCutCornerCss() {
  return `
.kp-chrome-window {
  overflow: hidden;
}
.kp-chrome-window:not([data-kp-corner="cut"]) {
  border-radius: var(--kp-radius-panel, 3px);
}
/* Baseline (presentation): proven clip-path chamfer */
[data-kp-corner="cut"],
:host([data-kp-corner="cut"]),
.kp-chrome-window[data-kp-corner="cut"] {
  clip-path: polygon(
    var(--kp-cut-size, 8px) 0,
    calc(100% - var(--kp-cut-size, 8px)) 0,
    100% var(--kp-cut-size, 8px),
    100% calc(100% - var(--kp-cut-size, 8px)),
    calc(100% - var(--kp-cut-size, 8px)) 100%,
    var(--kp-cut-size, 8px) 100%,
    0 calc(100% - var(--kp-cut-size, 8px)),
    0 var(--kp-cut-size, 8px)
  );
  border-radius: 0;
}
/* Upgrade: native chamfer keeps stroke + shadow on the cut edge */
@supports (corner-shape: bevel) {
  [data-kp-corner="cut"],
  :host([data-kp-corner="cut"]),
  .kp-chrome-window[data-kp-corner="cut"] {
    clip-path: none !important;
    border-radius: var(--kp-cut-size, 8px) !important;
    corner-shape: bevel;
  }
}
`.trim();
}

/**
 * Shallow-merge nested theme objects (settings themeOverrides).
 * @param {object} base
 * @param {object} [overrides]
 */
export function mergeTheme(base, overrides) {
  if (!overrides || typeof overrides !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = mergeTheme(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeThemeId(raw) {
  const id = typeof raw === 'string' ? raw.trim() : '';
  return THEME_IDS.includes(id) ? id : DEFAULT_THEME_ID;
}

/**
 * True when the user has stored any appearance token edits.
 * @param {unknown} raw
 */
export function hasThemeOverrides(raw) {
  return !!(raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length > 0);
}
