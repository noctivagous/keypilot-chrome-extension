/**
 * CSS injection and style management
 */
import { CSS_CLASSES, ELEMENT_IDS, COLORS, Z_INDEX } from '../config/constants.js';

export class StyleManager {
  constructor() {
    this.injectedStyles = new Set();
    this.shadowRootStyles = new Map(); // Track shadow root styles for cleanup
    this.isEnabled = true; // Track if styles should be active
    // When false, KeyPilot must not override the page cursor at all.
    this.cursorOverridesEnabled = false;
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
      
      .${CSS_CLASSES.HIDDEN} { 
        display: none !important; 
      }
      
      @keyframes kpv2-ripple { 
        0% { transform: translate(-50%, -50%) scale(0.25); opacity: 0.35; }
        60% { transform: translate(-50%, -50%) scale(1); opacity: 0.2; }
        100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
      }
      
      .${CSS_CLASSES.RIPPLE} { 
        position: fixed; 
        left: 0; 
        top: 0; 
        z-index: ${Z_INDEX.OVERLAYS}; 
        pointer-events: none; 
        width: 46px; 
        height: 46px; 
        border-radius: 50%; 
        background: radial-gradient(circle, ${COLORS.RIPPLE_GREEN} 0%, ${COLORS.RIPPLE_GREEN_MID} 60%, ${COLORS.RIPPLE_GREEN_TRANSPARENT} 70%); 
        animation: kpv2-ripple 420ms ease-out forwards; 
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
      
      .${CSS_CLASSES.ACTIVE_TEXT_INPUT_FRAME} {
        position: fixed;
        pointer-events: none;
        z-index: ${Z_INDEX.OVERLAYS_ABOVE};
        border: var(--kpv2-text-stroke-width, 3px) solid ${COLORS.ORANGE};
        box-shadow: 0 0 0 2px ${COLORS.ORANGE_SHADOW}, 0 0 10px 2px ${COLORS.ORANGE_SHADOW_DARK};
        background: transparent;
        animation: kpv2-pulse 1.5s ease-in-out infinite;
        will-change: transform, opacity;
      }
      
      .${CSS_CLASSES.ACTIVE_TEXT_INPUT_FRAME}::before {
        content: "";
        display: none;
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

      /* Element styling for DOM hover mode */
      .keypilot-focus-element {
        box-shadow: 0 0 0 var(--keypilot-focus-ring-width, 3px) var(--keypilot-focus-ring-color, #2196f3) !important;
        outline: 1px solid var(--keypilot-focus-ring-color, #2196f3) !important;
        outline-offset: 1px !important;
        /* Semi-transparent background fill */
        background: var(--keypilot-focus-ring-bg-color, transparent) !important;
      }

      /* Inset fallback for clipped contexts (e.g. line-clamp / overflow hidden). */
      .keypilot-focus-element.keypilot-focus-element--inset {
        outline: none !important;
        box-shadow: inset 0 0 0 var(--keypilot-focus-ring-width, 3px) var(--keypilot-focus-ring-color, #2196f3) !important;
      }
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

      /* Element styling for DOM hover mode in shadow DOM */
      .keypilot-focus-element {
        box-shadow: 0 0 0 var(--keypilot-focus-ring-width, 3px) var(--keypilot-focus-ring-color, #2196f3) !important;
        outline: 1px solid var(--keypilot-focus-ring-color, #2196f3) !important;
        outline-offset: 1px !important;
        /* Semi-transparent background fill */
        background: var(--keypilot-focus-ring-bg-color, transparent) !important;
      }

      /* Inset fallback for clipped contexts in shadow DOM */
      .keypilot-focus-element.keypilot-focus-element--inset {
        outline: none !important;
        box-shadow: inset 0 0 0 var(--keypilot-focus-ring-width, 3px) var(--keypilot-focus-ring-color, #2196f3) !important;
      }

    `;
  }

  injectSharedStyles() {
    if (this.injectedStyles.has('main') || !this.isEnabled) return;

    const css = this._buildMainCSS();

    this.injectCSS(css, ELEMENT_IDS.STYLE);
    this.injectedStyles.add('main');

    // Only hide/override the cursor when explicitly enabled.
    if (this.cursorOverridesEnabled) {
      document.documentElement.classList.add(CSS_CLASSES.CURSOR_HIDDEN);
    } else {
      document.documentElement.classList.remove(CSS_CLASSES.CURSOR_HIDDEN);
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

  injectIntoShadowRoot(shadowRoot) {
    if (this.injectedStyles.has(shadowRoot) || !this.isEnabled) return;

    const css = this._buildShadowCSS();

    const style = document.createElement('style');
    style.id = 'keypilot-shadow-styles';
    style.textContent = css;
    shadowRoot.appendChild(style);

    this.injectedStyles.add(shadowRoot);
    this.shadowRootStyles.set(shadowRoot, style);
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
      CSS_CLASSES.HIGHLIGHT,
      CSS_CLASSES.HIDDEN,
      CSS_CLASSES.RIPPLE,
      CSS_CLASSES.VIEWPORT_MODAL_FRAME,
      CSS_CLASSES.ACTIVE_TEXT_INPUT_FRAME,
      CSS_CLASSES.ESC_EXIT_LABEL,
      CSS_CLASSES.HIGHLIGHT_OVERLAY,
      CSS_CLASSES.HIGHLIGHT_SELECTION
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