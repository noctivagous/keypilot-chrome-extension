/**
 * Popup theme CSS variables used across KeyPilot UI surfaces.
 *
 * Keep this in sync with `extension/styles/popup.css` `:root { ... }`.
 * We centralize the JS-side usage here so multiple UI surfaces (floating help,
 * early-inject shell) don't each hardcode their own copies.
 */

export const POPUP_THEME_VARS = {
  '--fg': '#f8fafc',
  '--bg': '#0f172a',
  '--surface': '#1e293b',
  '--surface-light': '#334155',
  '--muted': '#94a3b8',
  '--ok': '#10b981',
  '--warn': '#f59e0b',
  '--err': '#44c7ef',
  '--brand': '#3b82f6',
  '--brand-dark': '#1e40af',
  '--border': '#334155',
  '--border2': '#4d617b'
};

export function applyPopupThemeVars(targetEl) {
  if (!targetEl || !targetEl.style) return;
  try {
    for (const [k, v] of Object.entries(POPUP_THEME_VARS)) {
      targetEl.style.setProperty(k, v);
    }
  } catch {
    // ignore
  }
}


