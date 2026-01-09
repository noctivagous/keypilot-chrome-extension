/**
 * Shared pieces of the KeyPilot keybindings UI that need to stay consistent
 * across:
 * - bundled content UI (`src/ui/keybindings-ui.js`)
 * - early injection UI (`extension/early-inject.js`)
 *
 * NOTE: `early-inject.js` cannot import ESM at runtime (it must run at
 * `document_start` and is loaded directly by the manifest). Instead, the build
 * script stamps generated constants into `early-inject.js` from this module.
 */

export const KEYBINDINGS_UI_STYLE_ATTR = 'data-kp-keybindings-ui-style';
export const KEYBINDINGS_UI_ROOT_CLASS = 'kp-keybindings-ui';

// Used in generated CSS when runtime URLs are not available (e.g. build-time stamping into early-inject.js).
export const KEYBINDINGS_UI_FONT_PLACEHOLDERS = {
  ROBOTECH: '__KP_FONT_ROBOTECH_URL__',
  TITILLIUM: '__KP_FONT_TITILLIUM_URL__',
  CUBELLAN: '__KP_FONT_CUBELLAN_URL__',
  EZARION: '__KP_FONT_EZARION_URL__',
  DOSIS: '__KP_FONT_DOSIS_URL__'
};

import { DEFAULT_KEYBOARD_LAYOUT_ID, getKeyboardUiLayoutForLayout } from '../config/keyboard-layouts.js';

/**
 * Canonical keyboard layout used by both early-inject and the bundled UI.
 * Action keys reference IDs in `KEYBINDINGS`.
 */
export const KEYBINDINGS_KEYBOARD_LAYOUT = getKeyboardUiLayoutForLayout(DEFAULT_KEYBOARD_LAYOUT_ID);

/**
 * Generate the injected CSS used by the keyboard UI (both early + bundled).
 *
 * @param {Object} params
 * @param {number} params.zKeybindingsPopover
 */
export function getKeybindingsUiCss({ zKeybindingsPopover, fontUrls } = {}) {
  const z = Number.isFinite(zKeybindingsPopover) ? zKeybindingsPopover : Number(zKeybindingsPopover);
  const zIndex = Number.isFinite(z) ? z : 1000010;

  // Font URLs are optional because `build.js` needs to stamp CSS into `early-inject.js`
  // without knowing the runtime extension ID. When omitted, we emit placeholders that
  // can be replaced at runtime (early-inject) or overwritten by the bundled UI.
  const urlRobotech = (fontUrls && fontUrls.robotech) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.ROBOTECH;
  const urlTitillium = (fontUrls && fontUrls.titillium) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.TITILLIUM;
  const urlCubellan = (fontUrls && fontUrls.cubellan) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.CUBELLAN;
  const urlEzarion = (fontUrls && fontUrls.ezarion) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.EZARION;
  const urlDosis = (fontUrls && fontUrls.dosis) || KEYBINDINGS_UI_FONT_PLACEHOLDERS.DOSIS;

  return `
/* KeyPilot Keybindings UI (injected) */
@font-face {
  font-family: "ROBOTECHGPRegular";
  src: url("${urlRobotech}") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "TitilliumText";
  src: url("${urlTitillium}") format("opentype");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Cubellan";
  src: url("${urlCubellan}") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Ezarion";
  src: url("${urlEzarion}") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Dosis";
  src: url("${urlDosis}") format("truetype");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

/* Style isolation: all keyboard rules are scoped so host page CSS won't override them */
.${KEYBINDINGS_UI_ROOT_CLASS} {
  --kp-accent: #5be2f1;
}

.keyboard-visual.${KEYBINDINGS_UI_ROOT_CLASS} {
  background: var(--bg, #0f172a);
  border-radius: 12px;
  padding: 14px;
  font-family: "Dosis", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 10px;
  line-height: 1.1;
  user-select: none;
  border: 1px solid var(--border, #334155);
  width: 100%;
  box-sizing: border-box;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .keyboard-row {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
  gap: 6px;
  width: 100%;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .keyboard-row:last-child {
  margin-bottom: 0;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key {
  position: relative;
  /* Reset button default styles */
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  cursor: pointer;
  /* End button reset */
  background: linear-gradient(180deg,
    rgba(45, 55, 72, 0.95) 0%,
    rgba(26, 32, 44, 0.95) 50%,
    rgba(15, 20, 30, 0.95) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-top: 1.5px solid rgba(255, 255, 255, 0.25);
  border-bottom: 1.5px solid rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  min-width: 32px;
  /* Keep keys closer to square in narrow containers (popup, floating panel). */
  min-height: 38px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fg, #f8fafc);
  text-align: center;
  padding: 4px;
  transition: all 0.2s ease;
  flex: 1;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(255, 255, 255, 0.1),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key::before {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  right: 1px;
  height: 30%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 100%);
  border-radius: 5px 5px 0 0;
  pointer-events: none;
}

.${KEYBINDINGS_UI_ROOT_CLASS} [data-kp-action-id] {
  cursor: pointer;
}

.${KEYBINDINGS_UI_ROOT_CLASS} [data-kp-action-id]:hover {
  transform: translateY(-2px);
  box-shadow:
    0 6px 8px rgba(0, 0, 0, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.6),
    inset 0 1px 2px rgba(255, 255, 255, 0.15),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key .key-main {
  font-size: 8px;
  opacity: 0.7;
  margin-bottom: 2px;
  text-transform: uppercase;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key .key-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--kp-accent);
  line-height: 1;
}

/* Special keys: keep them wider than normal, but not so wide that letter keys become skinny in the popup */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-tab { flex: 1.25; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-caps { flex: 1.35; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-enter { flex: 1.55; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-shift { flex: 1.65; }
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-backspace { flex: 1.55; }

/* Action-specific keys */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-activate,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-activate-new,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-activate-new-over,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-tab-right,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-new-tab,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-open-popover,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-preview-popover,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-up,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-down,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-up-instant,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-page-down-instant,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-help,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-omnibox {
  background: linear-gradient(180deg,
    rgba(34, 197, 94, 0.5) 0%,
    rgba(22, 163, 74, 0.6) 50%,
    rgba(21, 128, 61, 0.7) 100%);
  border-color: rgba(5, 150, 105, 0.6);
  border-top-color: rgba(34, 197, 94, 0.4);
  border-bottom-color: rgba(21, 128, 61, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(34, 197, 94, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(34, 197, 94, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-back,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-forward,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll-top,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll-bottom {
  background: linear-gradient(180deg,
    rgba(56, 189, 248, 0.5) 0%,
    rgba(14, 165, 233, 0.6) 50%,
    rgba(2, 132, 199, 0.7) 100%);
  border-color: rgba(4, 177, 225, 0.6);
  border-top-color: rgba(56, 189, 248, 0.4);
  border-bottom-color: rgba(2, 132, 199, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(56, 189, 248, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(56, 189, 248, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-delete,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-close-tab {
  background: linear-gradient(180deg,
    rgba(248, 113, 113, 0.5) 0%,
    rgba(239, 68, 68, 0.6) 50%,
    rgba(220, 38, 38, 0.7) 100%);
  border-color: rgba(220, 38, 38, 0.6);
  border-top-color: rgba(248, 113, 113, 0.4);
  border-bottom-color: rgba(220, 38, 38, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(248, 113, 113, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(248, 113, 113, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-highlight,
.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-rect-highlight {
  background: linear-gradient(180deg,
    rgba(245, 158, 11, 0.5) 0%,
    rgba(217, 119, 6, 0.6) 50%,
    rgba(180, 83, 9, 0.7) 100%);
  border-color: rgba(245, 158, 11, 0.6);
  border-top-color: rgba(245, 158, 11, 0.4);
  border-bottom-color: rgba(180, 83, 9, 0.8);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-scroll {
  background: linear-gradient(180deg,
    rgba(139, 69, 19, 0.5) 0%,
    rgba(101, 67, 33, 0.6) 50%,
    rgba(92, 64, 35, 0.7) 100%);
  border-color: rgba(139, 69, 19, 0.6);
  border-top-color: rgba(139, 69, 19, 0.4);
  border-bottom-color: rgba(92, 64, 35, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(139, 69, 19, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(139, 69, 19, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-purple {
  background: linear-gradient(180deg,
    rgba(147, 51, 234, 0.5) 0%,
    rgba(124, 58, 237, 0.6) 50%,
    rgba(88, 28, 135, 0.7) 100%);
  border-color: rgba(147, 51, 234, 0.6);
  border-top-color: rgba(147, 51, 234, 0.4);
  border-bottom-color: rgba(88, 28, 135, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(147, 51, 234, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(147, 51, 234, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-orange {
  background: linear-gradient(180deg,
    rgba(255, 165, 0, 0.5) 0%,
    rgba(255, 140, 0, 0.6) 50%,
    rgba(255, 69, 0, 0.7) 100%);
  border-color: rgba(255, 165, 0, 0.6);
  border-top-color: rgba(255, 165, 0, 0.4);
  border-bottom-color: rgba(255, 69, 0, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(255, 165, 0, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(255, 165, 0, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-launcher-orange {
  background: linear-gradient(180deg,
    rgba(184, 115, 51, 0.5) 0%,
    rgba(160, 82, 45, 0.6) 50%,
    rgba(139, 69, 19, 0.7) 100%);
  border-color: rgba(184, 115, 51, 0.6);
  border-top-color: rgba(184, 115, 51, 0.4);
  border-bottom-color: rgba(139, 69, 19, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(184, 115, 51, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(184, 115, 51, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-settings-dark {
  background: linear-gradient(180deg,
    rgba(31, 41, 55, 0.8) 0%,
    rgba(17, 24, 39, 0.9) 50%,
    rgba(0, 0, 0, 0.95) 100%);
  border-color: rgba(55, 65, 81, 0.8);
  border-top-color: rgba(75, 85, 99, 0.6);
  border-bottom-color: rgba(0, 0, 0, 0.95);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.5),
    0 1px 3px rgba(0, 0, 0, 0.7),
    inset 0 1px 1px rgba(107, 114, 128, 0.3),
    inset 0 -2px 4px rgba(0, 0, 0, 0.4),
    0 0 8px rgba(0, 0, 0, 0.2);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-gray {
  background: linear-gradient(180deg,
    rgba(128, 128, 128, 0.5) 0%,
    rgba(105, 105, 105, 0.6) 50%,
    rgba(85, 85, 85, 0.7) 100%);
  border-color: rgba(128, 128, 128, 0.6);
  border-top-color: rgba(128, 128, 128, 0.4);
  border-bottom-color: rgba(85, 85, 85, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(128, 128, 128, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(128, 128, 128, 0.15);
}
  border-top-color: rgba(255, 165, 0, 0.4);
  border-bottom-color: rgba(255, 69, 0, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(255, 165, 0, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(255, 165, 0, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-launcher {
  background: linear-gradient(180deg,
    rgba(6, 182, 212, 0.5) 0%,
    rgba(3, 105, 161, 0.6) 50%,
    rgba(2, 132, 199, 0.7) 100%);
  border-color: rgba(6, 182, 212, 0.6);
  border-top-color: rgba(6, 182, 212, 0.4);
  border-bottom-color: rgba(2, 132, 199, 0.8);
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(6, 182, 212, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(6, 182, 212, 0.15);
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-hatched {
  position: relative;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-hatched::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    repeating-linear-gradient(
      45deg,
      rgba(200, 200, 200, 0.4) 0px,
      rgba(200, 200, 200, 0.4) 1px,
      transparent 1px,
      transparent 4px
    );
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-radial-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center,
    rgba(150, 150, 150, 0.3) 0%,
    rgba(120, 120, 120, 0.25) 30%,
    transparent 70%);
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-checkerboard-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 25% 25%, rgba(160, 160, 160, 0.3) 2px, transparent 2px),
    radial-gradient(circle at 75% 75%, rgba(160, 160, 160, 0.3) 2px, transparent 2px);
  background-size: 8px 8px;
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-stripes-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(90deg, transparent 0%, transparent 40%, rgba(180, 180, 180, 0.25) 40%, rgba(180, 180, 180, 0.25) 60%, transparent 60%);
  background-size: 6px 100%;
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-crosshatch-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    repeating-linear-gradient(45deg, rgba(170, 170, 170, 0.25) 0px, rgba(170, 170, 170, 0.25) 1px, transparent 1px, transparent 4px),
    repeating-linear-gradient(-45deg, rgba(170, 170, 170, 0.25) 0px, rgba(170, 170, 170, 0.25) 1px, transparent 1px, transparent 4px);
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-noise-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    linear-gradient(45deg, rgba(80, 80, 80, 0.2) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(80, 80, 80, 0.2) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(80, 80, 80, 0.2) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(80, 80, 80, 0.2) 75%);
  background-size: 4px 4px;
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-conic-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: conic-gradient(
    from 45deg,
    rgba(100, 100, 100, 0.2) 0deg,
    rgba(120, 120, 120, 0.25) 90deg,
    rgba(140, 140, 140, 0.2) 180deg,
    rgba(100, 100, 100, 0.2) 360deg
  );
  pointer-events: none;
  border-radius: 4px;
}

.${KEYBINDINGS_UI_ROOT_CLASS} .key.key-dashed-overlay::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  box-shadow: inset 0 0 0 2px rgba(140, 140, 140, 0.4);
  pointer-events: none;
  border-radius: 4px;
}

/* Keydown/keyup feedback (used by the floating keyboard reference panel).
   Keep this AFTER action-specific key styles so it always wins the cascade. */
.${KEYBINDINGS_UI_ROOT_CLASS} .key.kp-key-pressed {
  transform: translateY(1px);
  outline: 2px solid rgba(91, 226, 241, 0.65);
  outline-offset: -2px;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.45),
    0 1px 2px rgba(0, 0, 0, 0.7),
    inset 0 0 0 2px rgba(91, 226, 241, 0.22),
    inset 0 -2px 4px rgba(0, 0, 0, 0.35),
    0 0 12px rgba(91, 226, 241, 0.28);
  filter: brightness(1.12) saturate(1.18);
}

/* Popover (tooltip) shown when clicking a key */
.kp-keybindings-popover {
  position: absolute;
  z-index: ${zIndex};
  max-width: 280px;
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.35;
  /* Position absolute relative to parent container avoids z-index stacking context issues */
}

.kp-keybindings-popover[hidden] { display: none; }

.kp-keybindings-popover .kp-popover-title {
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--fg);
}

.kp-keybindings-popover .kp-popover-keys {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  color: var(--muted);
  margin: 0 0 6px 0;
  font-size: 11px;
}

.kp-keybindings-popover .kp-popover-desc {
  margin: 0;
  color: var(--fg);
  opacity: 0.95;
}

.kp-keybindings-popover::before {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  left: var(--kp-arrow-left, 18px);
  border: 9px solid transparent;
}

.kp-keybindings-popover[data-placement="top"]::before {
  top: 100%;
  border-top-color: var(--border);
}

.kp-keybindings-popover[data-placement="top"]::after {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  left: var(--kp-arrow-left, 18px);
  top: calc(100% - 1px);
  border: 8px solid transparent;
  border-top-color: var(--surface);
}

.kp-keybindings-popover[data-placement="bottom"]::before {
  bottom: 100%;
  border-bottom-color: var(--border);
}

.kp-keybindings-popover[data-placement="bottom"]::after {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  left: var(--kp-arrow-left, 18px);
  bottom: calc(100% - 1px);
  border: 8px solid transparent;
  border-bottom-color: var(--surface);
}
`;
}


