/**
 * CSS injection and style management
 */
import { CSS_CLASSES, ELEMENT_IDS, COLORS, Z_INDEX } from '../config/constants.js';

const BLUE_TINT_FILTER_ID = 'keypilot-blue-tint-filter';
const BLUE_TINT_SVG_ID = 'keypilot-blue-tint-filter-svg';

/**
 * Print / Save-as-PDF CSS for KeyPilot.
 *
 * Two tiers (critical):
 * - Tier A: hide pure injected chrome (control strip, overlays, popovers, …).
 * - Tier B: neutralize decorations applied to host page elements (hover rings,
 *   focus filters, text-input tints). Never display:none those — they are real
 *   page content with KP classes temporarily attached.
 *
 * Keep early-inject EARLY_CSS print block in sync with this helper.
 *
 * @returns {string}
 */
export function buildKeyPilotPrintCss() {
  const hide = [
    // Cursor + style filter host
    `#${ELEMENT_IDS.CURSOR}`,
    `#${BLUE_TINT_SVG_ID}`,
    // OverlayManager backends
    `.${CSS_CLASSES.CANVAS_OVERLAY}`,
    `.${CSS_CLASSES.CSS_PROPS_OVERLAY}`,
    `.${CSS_CLASSES.FOCUS_OVERLAY}`,
    `.${CSS_CLASSES.DELETE_OVERLAY}`,
    `.${CSS_CLASSES.INSPECTOR_OVERLAY}`,
    `.${CSS_CLASSES.INSPECTOR_MODE_INDICATOR}`,
    `.${CSS_CLASSES.COLS_OVERLAY}`,
    `.${CSS_CLASSES.COLS_SLIP_BAR}`,
    `.${CSS_CLASSES.HIGHLIGHT_OVERLAY}`,
    `.${CSS_CLASSES.HIGHLIGHT_SELECTION}`,
    `.${CSS_CLASSES.RIPPLE}`,
    `.${CSS_CLASSES.FOCUS_PULSE}`,
    `.${CSS_CLASSES.FOCUS_FLASH}`,
    `.${CSS_CLASSES.FOCUS_DASH}`,
    `.${CSS_CLASSES.FOCUS_MARQUEE}`,
    `.${CSS_CLASSES.IMAGE_COPY_PULSE}`,
    `.${CSS_CLASSES.EDGE_JUMP_FADE}`,
    `.${CSS_CLASSES.VIEWPORT_MODAL_FRAME}`,
    `.${CSS_CLASSES.ESC_EXIT_LABEL}`,
    // Omnibox + modal chrome
    `.${CSS_CLASSES.OMNIBOX_BACKDROP}`,
    `.${CSS_CLASSES.OMNIBOX_PANEL}`,
    `.${CSS_CLASSES.POPUP_BACKDROP}`,
    // Other injected chrome (hard-coded class names in modules)
    '.kpv2-toggle-notification',
    '.kpv2-flash-notification',
    '.kpv2-tab-history-panel',
    '.kpv2-popover-container',
    '.kpv2-preview-popover-container',
    '.kpv2-page-media-overlay',
    '#kpv2-debug-panel',
    '#kpv2-shadow-debug-hud',
    '.kpv2-shadow-debug-hud',
    '#kpv2-rectangle-intersection-root',
    // Light-DOM UI roots (kp-*)
    '.kp-control-strip',
    '.kp-floating-keyboard-help',
    '.kp-onboarding-panel',
    '.kp-launcher-container',
    '.kp-keybindings-popover',
    // Early-inject / attribute markers
    '[data-kp-control-strip]',
    '[data-kp-early-control-strip]',
    '[data-kp-early-floating-keyboard]',
    '[data-kp-ephemeral-effect]'
  ].join(',\n    ');

  return `
      /* Hide KeyPilot chrome + neutralize host decorations when printing / saving as PDF.
         Placed last so !important print rules beat earlier screen !important rules. */
      @media print {
        ${hide} {
          display: none !important;
          visibility: hidden !important;
        }

        /* Tier B: host-page hover / mode decorations — reset paint, keep the element. */
        .keypilot-focus-element,
        [data-kp-focus],
        .${CSS_CLASSES.FOCUS},
        .${CSS_CLASSES.DELETE},
        .${CSS_CLASSES.COLS},
        .${CSS_CLASSES.INSPECTOR},
        .${CSS_CLASSES.HIGHLIGHT} {
          outline: none !important;
          outline-offset: 0 !important;
          box-shadow: none !important;
          filter: none !important;
        }

        .keypilot-focus-element,
        [data-kp-focus="1"] {
          background: transparent !important;
        }

        .${CSS_CLASSES.TEXT_HOVER_INPUT},
        .${CSS_CLASSES.TEXT_HOVER_INPUT_PARENT},
        .${CSS_CLASSES.TEXT_FOCUS_INPUT},
        .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT} {
          background-image: none !important;
          background-color: revert !important;
          color: revert !important;
          text-shadow: none !important;
          caret-color: auto !important;
          filter: none !important;
          box-shadow: none !important;
          outline: none !important;
        }

        .${CSS_CLASSES.TEXT_HOVER_INPUT}::placeholder,
        .${CSS_CLASSES.TEXT_FOCUS_INPUT}::placeholder {
          color: revert !important;
          text-shadow: none !important;
        }
      }
  `;
}

/**
 * Build a CSS `url("data:image/svg+xml,...")` background for tiny upper-left
 * hint text painted on text inputs (not a DOM overlay).
 *
 * @param {string} text
 * @param {{ fill?: string, stroke?: string, fontSize?: number }} [opts]
 * @returns {string}
 */
export function buildTextInputHintDataUri(text, opts = {}) {
  const raw = String(text || '').trim() || ' ';
  const fill = String(opts.fill || 'rgba(90, 45, 0, 0.78)');
  const stroke = String(opts.stroke || 'rgba(255,255,255,0.55)');
  const fontSize = Number.isFinite(opts.fontSize) ? opts.fontSize : 11;
  // Escape for XML text content.
  const safe = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // Approximate width (system UI is roughly 0.55–0.62em per glyph at this size).
  const width = Math.max(48, Math.ceil(raw.length * fontSize * 0.58) + 10);
  const height = fontSize + 5;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<text x="0" y="${fontSize}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" ` +
    `font-size="${fontSize}" font-weight="600" fill="${fill}" ` +
    `paint-order="stroke" stroke="${stroke}" stroke-width="2.5">${safe}</text>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export class StyleManager {
  constructor() {
    this.injectedStyles = new Set();
    this.shadowRootStyles = new Map(); // Track shadow root styles for cleanup
    /** @type {Set<Document>} same-origin iframe documents we injected into */
    this._foreignDocuments = new Set();
    this.isEnabled = true; // Track if styles should be active
    // When false, KeyPilot must not override the page cursor at all.
    this.cursorOverridesEnabled = false;

    // SVG background-image hints for orange text inputs (hover / focus).
    this._textHoverHintLabel = 'Press F to select text field';
    this._textFocusHintLabel = 'press Esc to exit';
    this._textHoverHintUri = buildTextInputHintDataUri(this._textHoverHintLabel);
    this._textFocusHintUri = buildTextInputHintDataUri(this._textFocusHintLabel, {
      fill: COLORS.ORANGE,
      stroke: '#000'
    });
  }

  /**
   * Update layout-aware hint copy and push CSS variables onto the document.
   * @param {{ hover?: string, focus?: string }} labels
   */
  setTextInputHintLabels(labels = {}) {
    if (typeof labels.hover === 'string' && labels.hover.trim()) {
      this._textHoverHintLabel = labels.hover.trim();
      this._textHoverHintUri = buildTextInputHintDataUri(this._textHoverHintLabel);
    }
    if (typeof labels.focus === 'string' && labels.focus.trim()) {
      this._textFocusHintLabel = labels.focus.trim();
      this._textFocusHintUri = buildTextInputHintDataUri(this._textFocusHintLabel, {
        fill: COLORS.ORANGE,
        stroke: '#000'
      });
    }
    this._applyTextInputHintCssVars();
  }

  /**
   * Write hint background-image CSS vars on documentElement (and any tracked shadow roots).
   */
  _applyTextInputHintCssVars() {
    const hoverUri = this._textHoverHintUri || 'none';
    const focusUri = this._textFocusHintUri || 'none';
    try {
      document.documentElement.style.setProperty('--kpv2-text-hover-hint-image', hoverUri);
      document.documentElement.style.setProperty('--kpv2-text-focus-hint-image', focusUri);
    } catch { /* ignore */ }
    try {
      for (const doc of this._foreignDocuments) {
        if (!doc || doc === document) continue;
        let alive = false;
        try { alive = !!doc.documentElement && doc.defaultView != null; } catch { alive = false; }
        if (!alive) {
          this._foreignDocuments.delete(doc);
          continue;
        }
        try {
          doc.documentElement.style.setProperty('--kpv2-text-hover-hint-image', hoverUri);
          doc.documentElement.style.setProperty('--kpv2-text-focus-hint-image', focusUri);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // Shadow roots inherit CSS variables from the host in most cases, but
    // open roots with closed inheritance may need the vars on :host — set on
    // the host element when we know it.
    try {
      for (const shadowRoot of this.shadowRootStyles.keys()) {
        const host = shadowRoot?.host;
        if (host && host.style) {
          host.style.setProperty('--kpv2-text-hover-hint-image', hoverUri);
          host.style.setProperty('--kpv2-text-focus-hint-image', focusUri);
        }
      }
    } catch { /* ignore */ }
  }

  setCursorOverridesEnabled(enabled) {
    const next = !!enabled;
    if (this.cursorOverridesEnabled === next) return;
    this.cursorOverridesEnabled = next;

    // Keep the html class in sync immediately.
    try {
      if (this.cursorOverridesEnabled) {
        document.documentElement.classList.add(CSS_CLASSES.CURSOR_HIDDEN);
      } else {
        document.documentElement.classList.remove(CSS_CLASSES.CURSOR_HIDDEN);
      }
    } catch {
      // ignore
    }

    // If we've already injected styles, update them in place so we don't require a full teardown.
    try {
      const mainStyle = document.getElementById(ELEMENT_IDS.STYLE);
      if (mainStyle && typeof mainStyle.textContent === 'string') {
        mainStyle.textContent = this._buildMainCSS();
      }
    } catch {
      // ignore
    }

    // Update any shadow-root styles we previously injected.
    try {
      for (const [shadowRoot, styleEl] of this.shadowRootStyles) {
        if (!shadowRoot || !styleEl) continue;
        try {
          styleEl.textContent = this._buildShadowCSS();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  _buildMainCSS() {
    const cursorCSS = this.cursorOverridesEnabled
      ? `
      html.${CSS_CLASSES.CURSOR_HIDDEN} * {
        cursor: var(--kpv2-cursor, auto) !important;
      }

      /* Ensure cursor overrides work on all interactive elements */
      html.${CSS_CLASSES.CURSOR_HIDDEN} a[href],
      html.${CSS_CLASSES.CURSOR_HIDDEN} button,
      html.${CSS_CLASSES.CURSOR_HIDDEN} input,
      html.${CSS_CLASSES.CURSOR_HIDDEN} select,
      html.${CSS_CLASSES.CURSOR_HIDDEN} textarea,
      html.${CSS_CLASSES.CURSOR_HIDDEN} [role="button"],
      html.${CSS_CLASSES.CURSOR_HIDDEN} [role="link"],
      html.${CSS_CLASSES.CURSOR_HIDDEN} [onclick],
      html.${CSS_CLASSES.CURSOR_HIDDEN} [tabindex] {
        cursor: var(--kpv2-cursor, auto) !important;
      }
      `
      : '';

    return `
      ${cursorCSS}
      
      .${CSS_CLASSES.FOCUS} { 
        filter: brightness(1.2) !important; 
      }
      
      .${CSS_CLASSES.DELETE} { 
        filter: brightness(0.8) contrast(1.2) !important; 
      }

      .${CSS_CLASSES.COLS} {
        filter: brightness(1.05) saturate(1.15) !important;
      }
      
      .${CSS_CLASSES.HIDDEN} { 
        display: none !important; 
      }

      .${CSS_CLASSES.EDGE_JUMP_FADE} {
        position: fixed;
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        box-sizing: border-box;
        z-index: ${Z_INDEX.EDGE_JUMP_FADE};
        pointer-events: none;
        opacity: 0;
        background: #fff;
        overflow: hidden;
        will-change: opacity, left, top, width, height;
      }

      .${CSS_CLASSES.EDGE_JUMP_FADE_ICON} {
        position: absolute;
        right: 18px;
        width: 56px;
        height: 56px;
        pointer-events: none;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.28));
      }

      .${CSS_CLASSES.EDGE_JUMP_FADE_ICON}[data-kp-edge="top"] {
        top: 18px;
        bottom: auto;
      }

      .${CSS_CLASSES.EDGE_JUMP_FADE_ICON}[data-kp-edge="bottom"] {
        bottom: 18px;
        top: auto;
      }
      
      @keyframes kpv2-ripple { 
        0% { transform: translate(-50%, -50%) scale(0.25); opacity: 0.35; }
        60% { transform: translate(-50%, -50%) scale(1); opacity: 0.2; }
        100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
      }

      /* F-key activation: outline scales up and fades out from the click target. */
      @keyframes kpv2-focus-pulse {
        0% {
          transform: scale(1);
          opacity: 1;
        }
        55% {
          transform: scale(1.12);
          opacity: 0.85;
        }
        100% {
          transform: scale(1.28);
          opacity: 0;
        }
      }

      /* F-key activation: hard strobe on the outline (minimal motion). */
      @keyframes kpv2-focus-flash {
        0% {
          opacity: 0;
          border-color: ${COLORS.FLASH_GREEN};
          box-shadow:
            0 0 0 0 transparent,
            0 0 0 0 transparent;
        }
        10% {
          opacity: 1;
          border-color: #ffffff;
          box-shadow:
            0 0 0 1px ${COLORS.FLASH_GREEN},
            0 0 8px 1px ${COLORS.FLASH_GREEN_GLOW};
        }
        40% {
          opacity: 1;
          border-color: ${COLORS.FLASH_GREEN};
          box-shadow:
            0 0 0 1px ${COLORS.FLASH_GREEN_SHADOW},
            0 0 5px 0 ${COLORS.FLASH_GREEN_GLOW};
        }
        100% {
          opacity: 0;
          border-color: ${COLORS.FLASH_GREEN};
          box-shadow:
            0 0 0 0 transparent,
            0 0 0 0 transparent;
        }
      }

      /* F-key activation: marquee chaser travels once around the perimeter, then fades. */
      @keyframes kpv2-focus-marquee-spin {
        0% {
          transform: translate(-50%, -50%) rotate(0deg);
          opacity: 1;
        }
        78% {
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) rotate(360deg);
          opacity: 0;
        }
      }

      @keyframes kpv2-focus-marquee-fade {
        0%, 70% {
          opacity: 1;
        }
        100% {
          opacity: 0;
        }
      }

      /* F-key activation: dashed stroke marches around the rect perimeter. */
      @keyframes kpv2-focus-dash-chase {
        0% {
          stroke-dashoffset: 0;
          opacity: 1;
        }
        78% {
          opacity: 1;
        }
        100% {
          stroke-dashoffset: calc(-1 * var(--kp-dash-peri, 200));
          opacity: 0;
        }
      }

      /*
       * Image copy (I-key): shutter flash → slight pop → shrink away
       * (read as "captured / pocketed" rather than the F-click expand-out pulse).
       */
      @keyframes kpv2-image-copy-pulse {
        0% {
          transform: scale(0.98);
          opacity: 0;
          background-color: ${COLORS.IMAGE_COPY_FLASH};
        }
        14% {
          transform: scale(1);
          opacity: 1;
          background-color: ${COLORS.IMAGE_COPY_FLASH};
        }
        32% {
          transform: scale(1.06);
          opacity: 1;
          background-color: ${COLORS.IMAGE_COPY_FILL};
        }
        100% {
          transform: scale(0.58);
          opacity: 0;
          background-color: ${COLORS.IMAGE_COPY_FILL};
        }
      }
      
      .${CSS_CLASSES.RIPPLE} { 
        position: fixed; 
        left: 0; 
        top: 0; 
        z-index: ${Z_INDEX.RIPPLE}; 
        pointer-events: none; 
        width: 46px; 
        height: 46px; 
        border-radius: 50%; 
        background: radial-gradient(circle, ${COLORS.RIPPLE_GREEN} 0%, ${COLORS.RIPPLE_GREEN_MID} 60%, ${COLORS.RIPPLE_GREEN_TRANSPARENT} 70%); 
        animation: kpv2-ripple 420ms ease-out forwards; 
      }

      .${CSS_CLASSES.FOCUS_PULSE} {
        position: fixed;
        left: 0;
        top: 0;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
        box-sizing: border-box;
        border: 3px solid ${COLORS.FLASH_GREEN};
        border-radius: 3px;
        box-shadow:
          0 0 0 2px ${COLORS.FLASH_GREEN_SHADOW},
          0 0 18px 4px ${COLORS.FLASH_GREEN_GLOW};
        background: transparent;
        transform-origin: center center;
        will-change: transform, opacity;
        animation: kpv2-focus-pulse 420ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }

      /* Flash / strobe: brief bright border + glow, almost no geometry motion. */
      .${CSS_CLASSES.FOCUS_FLASH} {
        position: fixed;
        left: 0;
        top: 0;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
        box-sizing: border-box;
        border: 3px solid ${COLORS.FLASH_GREEN};
        border-radius: 3px;
        background: transparent;
        will-change: opacity, box-shadow, border-color;
        animation: kpv2-focus-flash 320ms ease-out forwards;
      }

      /* Dash chase: SVG host; stroke animation lives on the child rect. */
      .${CSS_CLASSES.FOCUS_DASH} {
        position: fixed;
        left: 0;
        top: 0;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
        overflow: visible;
        filter: drop-shadow(0 0 6px ${COLORS.FLASH_GREEN_GLOW});
      }

      .${CSS_CLASSES.FOCUS_DASH}-stroke {
        will-change: stroke-dashoffset, opacity;
        animation: kpv2-focus-dash-chase 720ms linear forwards;
      }

      /*
       * Marquee click effect: a bright segment races around the element border
       * (theater marquee / runway lights). Mask keeps only a thin ring visible.
       */
      .${CSS_CLASSES.FOCUS_MARQUEE} {
        position: fixed;
        left: 0;
        top: 0;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
        box-sizing: border-box;
        border-radius: 3px;
        overflow: hidden;
        padding: 3px;
        background: transparent;
        /* Ring-only mask: paint border, punch out the interior. */
        -webkit-mask:
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask:
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0);
        mask-composite: exclude;
        animation: kpv2-focus-marquee-fade 720ms ease-out forwards;
      }

      .${CSS_CLASSES.FOCUS_MARQUEE}::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 220%;
        height: 220%;
        transform: translate(-50%, -50%) rotate(0deg);
        background: conic-gradient(
          from 0deg,
          transparent 0deg,
          transparent 250deg,
          ${COLORS.FLASH_GREEN_SHADOW} 280deg,
          ${COLORS.FLASH_GREEN} 310deg,
          #ffffff 328deg,
          ${COLORS.FLASH_GREEN} 342deg,
          transparent 360deg
        );
        box-shadow: 0 0 14px 2px ${COLORS.FLASH_GREEN_GLOW};
        will-change: transform, opacity;
        animation: kpv2-focus-marquee-spin 720ms linear forwards;
      }

      .${CSS_CLASSES.IMAGE_COPY_PULSE} {
        position: fixed;
        left: 0;
        top: 0;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
        box-sizing: border-box;
        border: 3px solid ${COLORS.IMAGE_COPY_FRAME};
        border-radius: 6px;
        box-shadow:
          0 0 0 2px ${COLORS.IMAGE_COPY_FRAME_SHADOW},
          0 0 22px 6px ${COLORS.IMAGE_COPY_FRAME_GLOW};
        background-color: ${COLORS.IMAGE_COPY_FILL};
        transform-origin: center center;
        will-change: transform, opacity, background-color;
        animation: kpv2-image-copy-pulse 520ms cubic-bezier(0.2, 0.75, 0.25, 1) forwards;
      }
      
      .${CSS_CLASSES.FOCUS_OVERLAY} { 
        position: fixed; 
        pointer-events: none; 
        z-index: ${Z_INDEX.OVERLAYS}; 
        border: 3px solid ${COLORS.FOCUS_GREEN}; 
        box-shadow: 0 0 0 2px ${COLORS.GREEN_SHADOW}, 0 0 10px 2px ${COLORS.GREEN_SHADOW_BRIGHT}; 
        background: transparent; 
      }
      
      .${CSS_CLASSES.DELETE_OVERLAY} { 
        position: fixed; 
        pointer-events: none; 
        z-index: ${Z_INDEX.OVERLAYS}; 
        border: 3px solid ${COLORS.DELETE_RED}; 
        box-shadow: 0 0 0 2px ${COLORS.DELETE_SHADOW}, 0 0 12px 2px ${COLORS.DELETE_SHADOW_BRIGHT}; 
        background: transparent; 
      }

      .${CSS_CLASSES.COLS_OVERLAY},
      .${CSS_CLASSES.INSPECTOR_OVERLAY} {
        position: fixed;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS};
        border: 3px solid ${COLORS.COLS_PURPLE};
        box-shadow: 0 0 0 2px ${COLORS.COLS_SHADOW}, 0 0 12px 2px ${COLORS.COLS_SHADOW_BRIGHT};
        background: transparent;
      }

      .${CSS_CLASSES.INSPECTOR} {
        filter: brightness(1.05) saturate(1.1) !important;
      }

      /* Applied multicol target — variables set by ColumnLayoutManager */
      .${CSS_CLASSES.COLS_ACTIVE} {
        column-width: var(--kpv2-cols-width, 40ch) !important;
        column-gap: var(--kpv2-cols-gap, 1.5rem) !important;
        column-fill: auto !important;
        height: var(--kpv2-cols-height, 100vh) !important;
        max-height: var(--kpv2-cols-height, 100vh) !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100% !important;
        scrollbar-width: none !important;
      }
      .${CSS_CLASSES.COLS_ACTIVE}::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }

      /* Column widget shell (outline + integrated slip bar) */
      .${CSS_CLASSES.COLS_SHELL} {
        box-sizing: border-box;
      }
      .${CSS_CLASSES.COLS_BODY} {
        min-width: 0;
        min-height: 0;
      }
      .${CSS_CLASSES.COLS_SLIP_BAR} {
        box-sizing: border-box;
      }
      .${CSS_CLASSES.COLS_SLIP_BAR}[data-kp-slip-empty="1"] .${CSS_CLASSES.COLS_SLIP_TRACK} {
        opacity: 0.45;
      }
      .${CSS_CLASSES.COLS_EXPAND_BTN}:focus-visible,
      .${CSS_CLASSES.COLS_CLOSE_BTN}:focus-visible {
        outline: 2px solid ${COLORS.COLS_PURPLE_BRIGHT};
        outline-offset: 1px;
      }

      /* Page-mode markers (html/body): critical layout is set inline by ColumnLayoutManager. */
      
      .${CSS_CLASSES.HIGHLIGHT_OVERLAY} { 
        position: fixed; 
        pointer-events: none; 
        z-index: ${Z_INDEX.OVERLAYS}; 
        border: 3px solid ${COLORS.HIGHLIGHT_BLUE}; 
        box-shadow: 0 0 0 2px ${COLORS.HIGHLIGHT_SHADOW}, 0 0 12px 2px ${COLORS.HIGHLIGHT_SHADOW_BRIGHT}; 
        background: transparent; 
      }
      
      .${CSS_CLASSES.HIGHLIGHT_SELECTION} { 
        position: fixed; 
        pointer-events: none; 
        z-index: ${Z_INDEX.HIGHLIGHT_SELECTION}; 
        background: ${COLORS.HIGHLIGHT_SELECTION_BG}; 
        border: 1px solid ${COLORS.HIGHLIGHT_SELECTION_BORDER}; 
      }

      /* Omnibox overlay */
      .${CSS_CLASSES.OMNIBOX_BACKDROP} {
        position: fixed;
        inset: 0;
        z-index: ${Z_INDEX.OMNIBOX};
        background: rgba(0,0,0,0.35);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .${CSS_CLASSES.OMNIBOX_PANEL} {
        position: absolute;
        top: 18vh;
        left: 50%;
        transform: translateX(-50%);
        width: min(880px, calc(100vw - 32px));
        border-radius: 14px;
        border: 1px solid ${COLORS.ORANGE_BORDER};
        box-shadow: 0 18px 60px rgba(0,0,0,0.55);
        background: rgba(20, 20, 20, 0.88);
        overflow: hidden;
      }
      .${CSS_CLASSES.OMNIBOX_INPUT} {
        width: 100%;
        box-sizing: border-box;
        border: none;
        outline: none;
        padding: 14px 16px;
        font-size: 18px;
        font-weight: 500;
        color: ${COLORS.TEXT_WHITE_PRIMARY};
        background: rgba(0,0,0,0);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .${CSS_CLASSES.OMNIBOX_SUGGESTIONS} {
        border-top: 1px solid rgba(255,140,0,0.15);
        max-height: 40vh;
        overflow-y: auto;
      }
      .${CSS_CLASSES.OMNIBOX_SUGGESTION} {
        padding: 10px 16px;
        cursor: default;
      }
      .${CSS_CLASSES.OMNIBOX_EMPTY} {
        padding: 10px 16px;
        font-size: 13px;
        color: ${COLORS.TEXT_WHITE_SECONDARY};
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      
      #${ELEMENT_IDS.CURSOR} { 
        position: fixed !important; 
        left: var(--cursor-x, 0) !important; 
        top: var(--cursor-y, 0) !important; 
        transform: translate(-50%, -50%) !important; 
        z-index: ${Z_INDEX.CURSOR} !important; 
        pointer-events: none !important;
        display: block !important;
        visibility: visible !important;
        will-change: transform, left, top !important;
      }
      
      .${CSS_CLASSES.VIEWPORT_MODAL_FRAME} {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        border: 9pt solid ${COLORS.ORANGE};
        opacity: 0.7;
        pointer-events: none;
        z-index: ${Z_INDEX.VIEWPORT_MODAL_FRAME};
        box-sizing: border-box;
        will-change: transform;
      }
      
      @keyframes kpv2-pulse { 
        0% { opacity: 0.7; }
        50% { opacity: 1; }
        100% { opacity: 0.7; }
      }

      /* Text-mode focus: inset left-edge bar pulse (width via --kpv2-text-left-edge-width). */
      @keyframes kpv2-text-left-edge-pulse {
        0%, 100% {
          box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE_SHADOW};
        }
        50% {
          box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE};
        }
      }
      
      .${CSS_CLASSES.ESC_EXIT_LABEL} {
        position: fixed;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
        background: ${COLORS.ORANGE};
        color: white;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: bold;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        white-space: nowrap;
        border-radius: 2px;
        animation: kpv2-pulse 1.5s ease-in-out infinite;
        will-change: transform, opacity;
      }

      .${CSS_CLASSES.ESC_EXIT_LABEL} kbd {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        padding: 1px 3px;
        font-family: monospace;
        font-size: 11px;
        font-weight: bold;
        color: white;
      }

      .${CSS_CLASSES.ESC_EXIT_LABEL} .countdown-number {
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 1px 3px;
        border-radius: 2px;
        font-weight: bold;
        font-size: 11px;
      }
      
      /* Add left padding to focused text inputs */
      input:focus,
      textarea:focus,
      [contenteditable="true"]:focus,
      [contenteditable=""]:focus {
        padding-left: 5pt !important;
      }

      /* Text inputs: hover / focus treatment + SVG hint labels.
         - Hover: orange outline only + SVG "Press F to select…" (no background wash)
         - Focus background_tint: full orange wash + SVG "press Esc to exit"
         - Focus left_edge (default): pulsating left inset bar + Esc SVG
         Hint copy is an SVG background-image (upper-left) — not a DOM overlay.
         Do not override the field’s own color / text-shadow / caret / placeholder. */
      /* Background-tint focus parents get a wash; left-edge parents stay clean. */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT}:not(.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE}) {
        background-color: var(--kpv2-text-input-focus-bg, rgba(255, 140, 0, 0.42)) !important;
      }

      /* Hover: SVG hint only — no background wash (outline is separate). */
      .${CSS_CLASSES.TEXT_HOVER_INPUT} {
        background-image: var(--kpv2-text-hover-hint-image, none) !important;
        background-repeat: no-repeat !important;
        background-position: left 6px top 3px !important;
        background-size: auto 12px !important;
      }

      /* Focus (background tint style): wash + Esc SVG. */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT}:not(.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE}):not(.${CSS_CLASSES.TEXT_FOCUS_DELEGATED}) {
        background-color: var(--kpv2-text-input-focus-bg, rgba(255, 140, 0, 0.42)) !important;
        background-image: var(--kpv2-text-focus-hint-image, none) !important;
        background-repeat: no-repeat !important;
        background-position: left 6px top 3px !important;
        background-size: auto 12px !important;
      }

      /* Field chrome painted on a taller wrapper — keep the input itself clean. */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT}.${CSS_CLASSES.TEXT_FOCUS_DELEGATED} {
        background-color: transparent !important;
        background-image: var(--kpv2-text-focus-hint-image, none) !important;
        background-repeat: no-repeat !important;
        background-position: left 6px top 3px !important;
        background-size: auto 12px !important;
        box-shadow: none !important;
        animation: none !important;
      }

      /* Left-edge bar on the visual shell (Gmail pill, etc.), not only the <input>. */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT}.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE} {
        box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE} !important;
        animation: kpv2-text-left-edge-pulse 1.5s ease-in-out infinite !important;
        will-change: box-shadow;
      }

      /* Focus (default left-edge style): inset orange bar that pulses + Esc SVG. */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT}.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE} {
        padding-left: calc(var(--kpv2-text-left-edge-width, 5px) + 4px) !important;
        background-color: transparent !important;
        background-image: var(--kpv2-text-focus-hint-image, none) !important;
        background-repeat: no-repeat !important;
        background-position: left calc(var(--kpv2-text-left-edge-width, 5px) + 6px) top 3px !important;
        background-size: auto 12px !important;
        box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE} !important;
        animation: kpv2-text-left-edge-pulse 1.5s ease-in-out infinite !important;
        will-change: box-shadow;
      }

      /* Short fields: keep focus chrome, hide the Esc SVG (it clips / overlaps text). */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT}.${CSS_CLASSES.TEXT_FOCUS_HINT_HIDDEN} {
        background-image: none !important;
      }

      /*
       * Element styling for DOM hover mode.
       * Prefer [data-kp-focus] over class alone: SPAs (e.g. X) often reconcile
       * className on hover and strip unknown classes, while data-* attributes
       * usually survive. Keep the class for backwards compatibility / DevTools.
       * Outline-first — many sites transition/zero box-shadow.
       */
      .keypilot-focus-element,
      [data-kp-focus="1"] {
        outline: var(--keypilot-focus-ring-width, 3px) solid var(--keypilot-focus-ring-color, #2196f3) !important;
        /* Graded by OverlayManager: +2 outer default → mild shrink → full inset */
        outline-offset: var(--keypilot-focus-outline-offset, 2px) !important;
        box-shadow: var(--keypilot-focus-box-shadow, none) !important;
        filter: none !important;
      }

      /* --inset kept for diagnostics; offset always comes from the graded var */
      .keypilot-focus-element.keypilot-focus-element--inset,
      [data-kp-focus="1"][data-kp-focus-inset="1"] {
        outline: var(--keypilot-focus-ring-width, 3px) solid var(--keypilot-focus-ring-color, #2196f3) !important;
        outline-offset: var(--keypilot-focus-outline-offset, calc(-1 * var(--keypilot-focus-ring-width, 3px))) !important;
        box-shadow: var(--keypilot-focus-box-shadow, none) !important;
        filter: none !important;
      }

      /* Translucent fill wash (thumbnails/links) only when a fill color is set.
         Base ring rules never override the element's own background on hover. */
      .keypilot-focus-element--fill {
        background: var(--keypilot-focus-ring-bg-color, transparent) !important;
      }

      /* Text-mode focused field: left-edge/wash only — never a hover outline. */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT}.keypilot-focus-element,
      .${CSS_CLASSES.TEXT_FOCUS_INPUT}[data-kp-focus="1"],
      .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT}.keypilot-focus-element,
      .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT}[data-kp-focus="1"] {
        outline: none !important;
        outline-offset: 0 !important;
      }

      /* If a ring marker still lands on the field, keep the left-edge pulse. */
      .keypilot-focus-element.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE},
      [data-kp-focus="1"].${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE} {
        box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE} !important;
        animation: kpv2-text-left-edge-pulse 1.5s ease-in-out infinite !important;
      }

      /*
       * Floating keyboard reference: host pages (e.g. Zapier) can override UA
       * [hidden]{display:none} with author display rules. Keep closed panels
       * invisible without relying on the attribute alone. Match early-inject.
       */
      .kp-floating-keyboard-help[hidden],
      .kp-floating-keyboard-help.${CSS_CLASSES.HIDDEN},
      .kp-floating-keyboard-help[aria-hidden="true"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      ${buildKeyPilotPrintCss()}
    `;
  }

  _buildShadowCSS() {
    const cursorCSS = this.cursorOverridesEnabled
      ? `
      /* Cursor override inside shadow DOM (archive.org and other web-components).
         Shadow roots don't inherit document-level CSS selectors like html.kpv2-cursor-hidden *,
         so we mirror the cursor rule via :host-context(). */
      :host-context(html.${CSS_CLASSES.CURSOR_HIDDEN}),
      :host-context(html.${CSS_CLASSES.CURSOR_HIDDEN}) * {
        cursor: var(--kpv2-cursor, auto) !important;
      }
      `
      : '';

    return `
      ${cursorCSS}

      .${CSS_CLASSES.FOCUS} { 
        filter: brightness(1.2) !important; 
      }
      
      .${CSS_CLASSES.DELETE} { 
        filter: brightness(0.8) contrast(1.2) !important; 
      }

      .${CSS_CLASSES.COLS} {
        filter: brightness(1.05) saturate(1.15) !important;
      }
      
      .${CSS_CLASSES.HIDDEN} { 
        display: none !important; 
      }
      
      /* Add left padding to focused text inputs in shadow DOM */
      input:focus,
      textarea:focus,
      [contenteditable="true"]:focus,
      [contenteditable=""]:focus {
        padding-left: 5pt !important;
      }

      @keyframes kpv2-text-left-edge-pulse {
        0%, 100% {
          box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE_SHADOW};
        }
        50% {
          box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE};
        }
      }

      /* Text inputs: same hover/focus + SVG hint treatment inside shadow DOM */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT}:not(.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE}) {
        background-color: var(--kpv2-text-input-focus-bg, rgba(255, 140, 0, 0.42)) !important;
      }

      .${CSS_CLASSES.TEXT_HOVER_INPUT} {
        background-image: var(--kpv2-text-hover-hint-image, none) !important;
        background-repeat: no-repeat !important;
        background-position: left 6px top 3px !important;
        background-size: auto 12px !important;
      }

      .${CSS_CLASSES.TEXT_FOCUS_INPUT}:not(.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE}):not(.${CSS_CLASSES.TEXT_FOCUS_DELEGATED}) {
        background-color: var(--kpv2-text-input-focus-bg, rgba(255, 140, 0, 0.42)) !important;
        background-image: var(--kpv2-text-focus-hint-image, none) !important;
        background-repeat: no-repeat !important;
        background-position: left 6px top 3px !important;
        background-size: auto 12px !important;
      }

      .${CSS_CLASSES.TEXT_FOCUS_INPUT}.${CSS_CLASSES.TEXT_FOCUS_DELEGATED} {
        background-color: transparent !important;
        background-image: var(--kpv2-text-focus-hint-image, none) !important;
        background-repeat: no-repeat !important;
        background-position: left 6px top 3px !important;
        background-size: auto 12px !important;
        box-shadow: none !important;
        animation: none !important;
      }

      .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT}.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE} {
        box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE} !important;
        animation: kpv2-text-left-edge-pulse 1.5s ease-in-out infinite !important;
        will-change: box-shadow;
      }

      .${CSS_CLASSES.TEXT_FOCUS_INPUT}.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE} {
        padding-left: calc(var(--kpv2-text-left-edge-width, 5px) + 4px) !important;
        background-color: transparent !important;
        background-image: var(--kpv2-text-focus-hint-image, none) !important;
        background-repeat: no-repeat !important;
        background-position: left calc(var(--kpv2-text-left-edge-width, 5px) + 6px) top 3px !important;
        background-size: auto 12px !important;
        box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE} !important;
        animation: kpv2-text-left-edge-pulse 1.5s ease-in-out infinite !important;
        will-change: box-shadow;
      }

      .${CSS_CLASSES.TEXT_FOCUS_INPUT}.${CSS_CLASSES.TEXT_FOCUS_HINT_HIDDEN} {
        background-image: none !important;
      }

      /* Element styling for DOM hover mode in shadow DOM (settings-driven ring). */
      .keypilot-focus-element,
      [data-kp-focus="1"] {
        outline: var(--keypilot-focus-ring-width, 3px) solid var(--keypilot-focus-ring-color, #2196f3) !important;
        /* Graded by OverlayManager: +2 outer default → mild shrink → full inset */
        outline-offset: var(--keypilot-focus-outline-offset, 2px) !important;
        box-shadow: var(--keypilot-focus-box-shadow, none) !important;
        filter: none !important;
      }

      /* --inset kept for diagnostics; offset always comes from the graded var */
      .keypilot-focus-element.keypilot-focus-element--inset,
      [data-kp-focus="1"][data-kp-focus-inset="1"] {
        outline: var(--keypilot-focus-ring-width, 3px) solid var(--keypilot-focus-ring-color, #2196f3) !important;
        outline-offset: var(--keypilot-focus-outline-offset, calc(-1 * var(--keypilot-focus-ring-width, 3px))) !important;
        box-shadow: var(--keypilot-focus-box-shadow, none) !important;
        filter: none !important;
      }

      /* Translucent fill wash (thumbnails/links) only when a fill color is set.
         Base ring rules never override the element's own background on hover. */
      .keypilot-focus-element--fill {
        background: var(--keypilot-focus-ring-bg-color, transparent) !important;
      }

      /* Text-mode focused field: left-edge/wash only — never a hover outline. */
      .${CSS_CLASSES.TEXT_FOCUS_INPUT}.keypilot-focus-element,
      .${CSS_CLASSES.TEXT_FOCUS_INPUT}[data-kp-focus="1"],
      .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT}.keypilot-focus-element,
      .${CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT}[data-kp-focus="1"] {
        outline: none !important;
        outline-offset: 0 !important;
      }

      /* If a ring marker still lands on the field, keep the left-edge pulse. */
      .keypilot-focus-element.${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE},
      [data-kp-focus="1"].${CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE} {
        box-shadow: inset var(--kpv2-text-left-edge-width, 5px) 0 0 0 ${COLORS.ORANGE} !important;
        animation: kpv2-text-left-edge-pulse 1.5s ease-in-out infinite !important;
      }

      ${buildKeyPilotPrintCss()}
    `;
  }

  injectSharedStyles() {
    if (this.injectedStyles.has('main') || !this.isEnabled) return;

    const css = this._buildMainCSS();

    this.injectCSS(css, ELEMENT_IDS.STYLE);
    this.injectedStyles.add('main');

    // Ensure the SVG filter exists as a real DOM node (CSS alone can't define it).
    this._ensureBlueTintFilterInDocument();

    // Paint default text-input hint SVG background-images (layout can override later).
    this._applyTextInputHintCssVars();

    // Only hide/override the cursor when explicitly enabled.
    if (this.cursorOverridesEnabled) {
      document.documentElement.classList.add(CSS_CLASSES.CURSOR_HIDDEN);
    } else {
      document.documentElement.classList.remove(CSS_CLASSES.CURSOR_HIDDEN);
    }
  }

  _ensureBlueTintFilterInDocument() {
    this._ensureBlueTintFilterInRoot(document);
  }

  _ensureBlueTintFilterInShadowRoot(shadowRoot) {
    this._ensureBlueTintFilterInRoot(shadowRoot);
  }

  _ensureBlueTintFilterInRoot(root) {
    try {
      const queryRoot = root && typeof root.querySelector === 'function' ? root : document;
      const existing = queryRoot.querySelector(`#${BLUE_TINT_SVG_ID}`);
      if (existing) return;

      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('id', BLUE_TINT_SVG_ID);
      svg.setAttribute('aria-hidden', 'true');
      // Hidden, but present in the DOM for url(#...) references.
      svg.style.position = 'absolute';
      svg.style.width = '0';
      svg.style.height = '0';
      svg.style.overflow = 'hidden';
      svg.style.pointerEvents = 'none';

      const defs = document.createElementNS(ns, 'defs');
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', BLUE_TINT_FILTER_ID);
      // Consistent, non-"hue rotate" blue cast.
      filter.setAttribute('color-interpolation-filters', 'sRGB');

      const matrix = document.createElementNS(ns, 'feColorMatrix');
      matrix.setAttribute('type', 'matrix');
      // 4x5 matrix (RGBA). Stronger blue cast + slightly reduced red/green.
      // R' = 0.82R + 0.06G + 0.06B
      // G' = 0.06R + 0.82G + 0.06B
      // B' = 0.12R + 0.12G + 1.05B + 0.12
      matrix.setAttribute(
        'values',
        '0.82 0.06 0.06 0 0  0.06 0.82 0.06 0 0  0.12 0.12 1.05 0 0.12  0 0 0 1 0'
      );

      // Slight brightness + contrast boost to keep tinted elements punchy.
      const transfer = document.createElementNS(ns, 'feComponentTransfer');
      const fr = document.createElementNS(ns, 'feFuncR');
      const fg = document.createElementNS(ns, 'feFuncG');
      const fb = document.createElementNS(ns, 'feFuncB');
      // slope > 1 increases contrast, intercept lifts brightness.
      fr.setAttribute('type', 'linear');
      fr.setAttribute('slope', '1.08');
      fr.setAttribute('intercept', '0.03');
      fg.setAttribute('type', 'linear');
      fg.setAttribute('slope', '1.08');
      fg.setAttribute('intercept', '0.03');
      fb.setAttribute('type', 'linear');
      fb.setAttribute('slope', '1.10');
      fb.setAttribute('intercept', '0.04');
      transfer.appendChild(fr);
      transfer.appendChild(fg);
      transfer.appendChild(fb);

      filter.appendChild(matrix);
      filter.appendChild(transfer);
      defs.appendChild(filter);
      svg.appendChild(defs);

      const parent = root instanceof ShadowRoot
        ? root
        : (document.body || document.documentElement || document);
      parent.appendChild(svg);
    } catch {
      // If this fails, the hover ring still works; we just won't apply the tint.
    }
  }

  injectCSS(css, id) {
    const existing = document.getElementById(id);
    if (existing) return;

    try {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    } catch (error) {
      // On chrome:// pages and other restricted contexts, DOM modifications may be blocked
      console.warn('[StyleManager] Cannot inject CSS on this page:', error.message);
      // Continue without styles - KeyPilot will still work but without visual enhancements
    }
  }

  /**
   * Ensure KeyPilot CSS applies for a node that may live inside open shadow DOM.
   * Document-level styles do not pierce shadow boundaries, so we inject into the
   * owning open ShadowRoot on first use (lazy). Safe / idempotent.
   *
   * @param {Node|null|undefined} node
   * @returns {boolean} true if styles are available for this node (document or injected shadow)
   */
  ensureStylesForNode(node) {
    if (!this.isEnabled || !node) return false;

    let root = null;
    try {
      root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
    } catch {
      root = null;
    }

    // Top-frame light DOM: main stylesheet already covers these nodes.
    if (!root || root === document) {
      return true;
    }

    // Same-origin iframe document (Gutenberg editor-canvas, etc.).
    // Do not use `instanceof Document` — iframe documents are another realm.
    if (root.nodeType === 9) {
      return this.injectIntoForeignDocument(/** @type {Document} */ (root));
    }

    if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
      const ok = this.injectIntoShadowRoot(root);
      // Keep optional IO discovery set in sync when we lazy-inject.
      if (ok) {
        try {
          window.keyPilot?.shadowDOMManager?.trackShadowRoot?.(root);
        } catch { /* ignore */ }
      }
      return ok;
    }

    // Closed shadow or unknown root: cannot inject.
    return false;
  }

  /**
   * Inject text-mode / hover chrome CSS into a same-origin child document.
   * Parent `document` styles do not apply inside an iframe.
   * @param {Document} doc
   * @returns {boolean}
   */
  injectIntoForeignDocument(doc) {
    if (!doc || !this.isEnabled || doc === document) return !!doc;
    try {
      const id = ELEMENT_IDS.STYLE || 'kpv2-style';
      let style = typeof doc.getElementById === 'function' ? doc.getElementById(id) : null;
      if (!style) {
        style = doc.createElement('style');
        style.id = id;
        style.textContent = this._buildShadowCSS();
        const head = doc.head || doc.documentElement;
        if (!head) return false;
        head.appendChild(style);
      }
      this._foreignDocuments.add(doc);
      try {
        const hoverUri = this._textHoverHintUri || 'none';
        const focusUri = this._textFocusHintUri || 'none';
        doc.documentElement.style.setProperty('--kpv2-text-hover-hint-image', hoverUri);
        doc.documentElement.style.setProperty('--kpv2-text-focus-hint-image', focusUri);
      } catch { /* ignore */ }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inject KeyPilot shadow CSS + blue-tint filter into an open shadow root.
   * Idempotent and wipe-resistant: Lit/SPA re-renders often replace shadow
   * children and drop our <style>. We always re-check the DOM (not only our
   * session Set) so archive.org-style nested open roots keep focus outlines.
   *
   * Used by:
   * - attachShadow pre-warm (ShadowDOMManager)
   * - lazy ensureStylesForNode on first hover/focus styling
   *
   * @param {ShadowRoot} shadowRoot
   * @returns {boolean}
   */
  injectIntoShadowRoot(shadowRoot) {
    if (!shadowRoot || !this.isEnabled) return false;

    try {
      // Prefer live DOM over injectedStyles Set — hosts may wipe our nodes.
      let style = typeof shadowRoot.querySelector === 'function'
        ? shadowRoot.querySelector('#keypilot-shadow-styles')
        : null;

      if (!style) {
        const css = this._buildShadowCSS();
        style = document.createElement('style');
        style.id = 'keypilot-shadow-styles';
        style.textContent = css;
        shadowRoot.appendChild(style);
      }

      // Filter must live in this shadow tree for url(#...) resolution on focus rings.
      this._ensureBlueTintFilterInShadowRoot(shadowRoot);

      this.injectedStyles.add(shadowRoot);
      this.shadowRootStyles.set(shadowRoot, style);

      // Keep text-input hint vars available on the host for CSS var resolution.
      try {
        const host = shadowRoot.host;
        if (host?.style) {
          host.style.setProperty('--kpv2-text-hover-hint-image', this._textHoverHintUri || 'none');
          host.style.setProperty('--kpv2-text-focus-hint-image', this._textFocusHintUri || 'none');
        }
      } catch { /* ignore */ }

      return true;
    } catch (error) {
      if (window.KEYPILOT_DEBUG) {
        console.warn('[StyleManager] Failed to inject styles into shadow root:', error);
      }
      return false;
    }
  }

  /**
   * Completely remove all KeyPilot CSS styles from the page
   * Used when extension is toggled off
   */
  removeAllStyles() {
    // Remove cursor hidden class
    document.documentElement.classList.remove(CSS_CLASSES.CURSOR_HIDDEN);

    // Remove main stylesheet
    const mainStyle = document.getElementById(ELEMENT_IDS.STYLE);
    if (mainStyle) {
      mainStyle.remove();
    }

    // Remove all shadow root styles
    for (const [shadowRoot, styleElement] of this.shadowRootStyles) {
      if (styleElement && styleElement.parentNode) {
        styleElement.remove();
      }
    }

    // Remove our injected SVG filters (document + tracked shadow roots)
    try {
      const svg = document.getElementById(BLUE_TINT_SVG_ID);
      if (svg) svg.remove();
    } catch {
      // ignore
    }
    for (const shadowRoot of this.shadowRootStyles.keys()) {
      try {
        const svg = shadowRoot && shadowRoot.querySelector
          ? shadowRoot.querySelector(`#${BLUE_TINT_SVG_ID}`)
          : null;
        if (svg) svg.remove();
      } catch {
        // ignore
      }
    }

    // Remove all KeyPilot classes from elements
    this.removeAllKeyPilotClasses();

    // Clear tracking
    this.injectedStyles.clear();
    this.shadowRootStyles.clear();
    this.isEnabled = false;
  }

  /**
   * Restore all KeyPilot CSS styles to the page
   * Used when extension is toggled back on
   */
  restoreAllStyles() {
    this.isEnabled = true;

    // Re-inject main styles
    this.injectSharedStyles();

    // Re-apply text-input hint SVG background vars after restore.
    this._applyTextInputHintCssVars();

    // Re-inject shadow root styles for any shadow roots we previously tracked
    // Note: We'll need to re-discover shadow roots since they may have changed
    // This will be handled by the shadow DOM manager during normal operation
  }

  /**
   * Remove all KeyPilot CSS classes from DOM elements
   */
  removeAllKeyPilotClasses() {
    const classesToRemove = [
      CSS_CLASSES.FOCUS,
      CSS_CLASSES.DELETE,
      CSS_CLASSES.COLS,
      CSS_CLASSES.INSPECTOR,
      CSS_CLASSES.COLS_ACTIVE,
      CSS_CLASSES.COLS_PAGE,
      CSS_CLASSES.HIGHLIGHT,
      CSS_CLASSES.HIDDEN,
      CSS_CLASSES.RIPPLE,
      CSS_CLASSES.VIEWPORT_MODAL_FRAME,
      CSS_CLASSES.ESC_EXIT_LABEL,
      CSS_CLASSES.HIGHLIGHT_OVERLAY,
      CSS_CLASSES.HIGHLIGHT_SELECTION,
      CSS_CLASSES.TEXT_FOCUS_INPUT,
      CSS_CLASSES.TEXT_FOCUS_INPUT_PARENT,
      CSS_CLASSES.TEXT_FOCUS_LEFT_EDGE,
      CSS_CLASSES.TEXT_FOCUS_DELEGATED,
      CSS_CLASSES.TEXT_FOCUS_HINT_HIDDEN,
      CSS_CLASSES.TEXT_HOVER_INPUT,
      CSS_CLASSES.TEXT_HOVER_INPUT_PARENT
    ];

    // Remove classes from main document
    classesToRemove.forEach(className => {
      const elements = document.querySelectorAll(`.${className}`);
      elements.forEach(el => el.classList.remove(className));
    });

    // Remove classes from shadow roots
    for (const shadowRoot of this.shadowRootStyles.keys()) {
      classesToRemove.forEach(className => {
        const elements = shadowRoot.querySelectorAll(`.${className}`);
        elements.forEach(el => el.classList.remove(className));
      });
    }
  }

  /**
   * Check if styles are currently enabled
   */
  isStylesEnabled() {
    return this.isEnabled;
  }

  cleanup() {
    this.removeAllStyles();
  }
}