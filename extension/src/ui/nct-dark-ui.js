/**
 * Shared "NCT dark UI" chrome tokens — the NLE-style pro-app design system
 * defined in `/gui-mockups` (keyboard-layout-config-A-toolbar.svg /
 * keyboard-layout-config-B-two-pane.*).
 *
 * Gray bevel chrome, tight radii, steel-blue accent. Used by the control strip,
 * Keyboard Reference / Keyboard Layout Config panels, and popover chrome
 * (titlebars, close/segmented/action buttons, fields).
 */

export const NCT_DARK_UI_FONT = 'Helvetica, Arial, sans-serif';

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

/** `.panel` background fill (NCT dark UI panels are flat `--panel`). */
export const NCT_DARK_UI_PANEL_BACKGROUND = NCT_DARK_UI_COLORS.panel;

/** `.panel` border + rim + drop shadow (dual-edge inset rim). */
export const NCT_DARK_UI_PANEL_BORDER = `1px solid ${NCT_DARK_UI_COLORS.panelEdgeDark}`;
export const NCT_DARK_UI_PANEL_BOX_SHADOW =
  `0 0 0 1px ${NCT_DARK_UI_COLORS.panelEdge} inset, 0 16px 40px rgba(0,0,0,0.55)`;
export const NCT_DARK_UI_PANEL_RADIUS = '3px';

/** `.titlebar` gradient + rim. */
export const NCT_DARK_UI_TITLEBAR_GRADIENT =
  `linear-gradient(180deg, ${NCT_DARK_UI_COLORS.titleTop} 0%, ${NCT_DARK_UI_COLORS.titleMid} 45%, ${NCT_DARK_UI_COLORS.titleBot} 100%)`;
export const NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM = `1px solid ${NCT_DARK_UI_COLORS.panelEdgeDark}`;
export const NCT_DARK_UI_TITLEBAR_BOX_SHADOW = `0 1px 0 ${NCT_DARK_UI_COLORS.panelEdge}`;

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
export const NCT_DARK_UI_BTN_GRADIENT =
  `linear-gradient(180deg, ${NCT_DARK_UI_COLORS.btnTop} 0%, ${NCT_DARK_UI_COLORS.btnMid} 50%, ${NCT_DARK_UI_COLORS.btnBot} 100%)`;
export const NCT_DARK_UI_BTN_BORDER = `1px solid ${NCT_DARK_UI_COLORS.panelEdgeDark}`;
export const NCT_DARK_UI_BTN_RADIUS = '2px';

/** Outline ring for compact titlebar controls such as Close and Collapse. */
export const NCT_DARK_UI_ICON_BUTTON_OUTLINE =
  `inset 0 0 0 1px ${NCT_DARK_UI_COLORS.panelEdge}`;

/** `.btn.lit` (active / primary steel-blue) gradient + rim. */
export const NCT_DARK_UI_BTN_LIT_GRADIENT =
  `linear-gradient(180deg, ${NCT_DARK_UI_COLORS.litTop} 0%, ${NCT_DARK_UI_COLORS.litBot} 100%)`;
export const NCT_DARK_UI_BTN_LIT_BORDER = `1px solid ${NCT_DARK_UI_COLORS.litEdge}`;

/** `.field` (recessed input) chrome. */
export const NCT_DARK_UI_FIELD_BACKGROUND = NCT_DARK_UI_COLORS.fieldBg;
export const NCT_DARK_UI_FIELD_BORDER = `1px solid ${NCT_DARK_UI_COLORS.fieldEdge}`;
export const NCT_DARK_UI_FIELD_BOX_SHADOW = `inset 0 1px 0 ${NCT_DARK_UI_COLORS.fieldInsetTop}`;
export const NCT_DARK_UI_FIELD_FOCUS_BORDER = NCT_DARK_UI_COLORS.accent;
export const NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW = `inset 0 0 0 1px rgba(74,144,200,0.35)`;

/** Accent focus ring for interactive chrome (buttons, segments). */
export const NCT_DARK_UI_FOCUS_RING = `inset 0 0 0 1px rgba(74,144,200,0.55)`;
export const NCT_DARK_UI_SELECTED_TINT = 'rgba(74,144,200,0.22)';
export const NCT_DARK_UI_SELECTED_TEXT = '#e8f0f8';
export const NCT_DARK_UI_HOVER_TINT = 'rgba(255,255,255,0.06)';

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
      borderRadius: '2px',
      border: '1px solid rgba(0,0,0,0.55)',
      fontSize: '12px',
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
      borderRadius: '2px',
      overflow: 'hidden',
      backgroundColor: '#141414',
      border: '1px solid rgba(0,0,0,0.55)',
      boxShadow:
        '0 0 0 1px rgba(255,255,255,0.18) inset, 0 6px 16px rgba(0,0,0,0.45)',
      lineHeight: '0'
    });
  } catch { /* ignore */ }
}