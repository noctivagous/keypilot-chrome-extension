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
