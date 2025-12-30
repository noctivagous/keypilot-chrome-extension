/**
 * Cursor overlay management
 */
import { COLORS, Z_INDEX } from '../config/constants.js';

export class CursorManager {
  constructor() {
    this.cursorEl = null;
    this.lastPosition = { x: 0, y: 0 };
    this.isStuck = false;
    this.stuckCheckInterval = null;
    this.forceUpdateCount = 0;
    this.currentMode = null; // Cache current mode to avoid unnecessary updates
    this.currentModeKey = null; // Cache mode+options to allow updates within same mode
    this.uriCache = new Map(); // Cache generated URIs
  }

  ensure() {
    if (this.cursorEl) return;

    // Handoff from early-inject:
    // early-inject no longer creates a DOM cursor element, so we can't rely on
    // `#kpv2-cursor` existing to know early-inject is active. Instead, if the
    // early API exists, signal handoff once so early-inject stops managing UI.
    try {
      const earlyApi = window.KEYPILOT_EARLY;
      if (earlyApi && !window.__KP_EARLY_HANDOFF_DONE) {
        window.__KP_EARLY_HANDOFF_DONE = true;
        try {
          const earlyPosition = typeof earlyApi.getPosition === 'function' ? earlyApi.getPosition() : null;
          if (earlyPosition && typeof earlyPosition.x === 'number' && typeof earlyPosition.y === 'number') {
            this.lastPosition = earlyPosition;
          }
        } catch {
          // ignore
        }
        try {
          window.dispatchEvent(new CustomEvent('keypilot-main-loaded'));
        } catch {
          // ignore
        }
        if (window.KEYPILOT_DEBUG) {
          console.log('[KeyPilot] Took over from early injection, using CSS cursor');
        }
      }
    } catch {
      // ignore
    }

    // Mark cursor as initialized (using CSS cursor, no DOM element needed)
    this.cursorEl = { style: {} }; // Dummy object for compatibility

    // IMPORTANT:
    // Do NOT clobber an existing cursor that may already be applied by `early-inject.js`.
    // The main KeyPilot instance will immediately call `setMode()` with the correct
    // settings-derived options once settings + initial mode are known.
    //
    // Previously, calling `setMode('none', {})` here overwrote the cursor CSS variable
    // with hardcoded defaults (gap=0, size=15) until the first hover/mousemove updated state.
  }

  setMode(mode, options = {}) {
    if (!this.cursorEl) return;

    // Skip if mode+options haven't changed to avoid unnecessary CSS updates.
    // NOTE: Text focus mode needs to update cursor color based on hasClickableElement.
    const {
      cursorType = null,
      crossHairQuadrantWidth = 15,
      gap = 0,
      strokeLineCap = 'round',
      strokeWidth = 4,
      crossHairScalingFactor = 1,
      hasClickableElement = false
    } = options || {};
    const nextModeKey = `${mode}|${cursorType || ''}|${crossHairQuadrantWidth}|${gap}|${strokeLineCap}|${strokeWidth}|${crossHairScalingFactor}|${hasClickableElement ? 1 : 0}`;

    if (this.currentModeKey === nextModeKey) {
      return;
    }

    this.currentMode = mode;
    this.currentModeKey = nextModeKey;

    // Native cursor options bypass SVG entirely.
    if (cursorType === 'native_arrow') {
      document.documentElement.style.setProperty('--kpv2-cursor', 'default');
      if (document.documentElement.style.cursor) document.documentElement.style.cursor = '';
      if (document.body.style.cursor) document.body.style.cursor = '';
      return;
    }
    if (cursorType === 'native_pointer') {
      document.documentElement.style.setProperty('--kpv2-cursor', 'pointer');
      if (document.documentElement.style.cursor) document.documentElement.style.cursor = '';
      if (document.body.style.cursor) document.body.style.cursor = '';
      return;
    }

    // Always set cursor to ensure it works over links and other elements
    const cursorUri = this.getCursorDataUri(mode, options);
    const cursorValue = `url("${cursorUri}") 30 30, auto`;

    console.log('setMode: cursorValue', cursorValue);
    // Set cursor using CSS variable on document element
    // The StyleManager has a global rule to apply this to all elements
    document.documentElement.style.setProperty('--kpv2-cursor', cursorValue);

    // Clean up direct styles if they exist - they can interfere with the variable
    if (document.documentElement.style.cursor) document.documentElement.style.cursor = '';
    if (document.body.style.cursor) document.body.style.cursor = '';
  }


  updatePosition(x, y) {
    if (!this.cursorEl) return;
    // CSS cursor doesn't need position updates - browser handles it automatically
    // This method is kept for API compatibility but does nothing
    this.lastPosition = { x, y };
  }

  getCurrentMode() {
    return this.currentMode || 'none';
  }

  /**
   * Generate SVG data URI for cursor mode
   */
  getCursorDataUri(mode, options = {}) {
    // Extract parameters with defaults
    const {
      cursorType = null,
      crossHairQuadrantWidth = 15,
      gap = 0,
      strokeLineCap = 'round',
      strokeWidth = 4,
      crossHairScalingFactor = 1,
      hasClickableElement = false
    } = options;

    // Apply scaling factor
    const scaledGap = gap * crossHairScalingFactor;
    const scaledWidth = crossHairQuadrantWidth * crossHairScalingFactor;

    // Calculate segment positions (center is now at 30,30 for 60x60 canvas)
    const centerX = 30;
    const centerY = 30;
    
    let segmentStart, segmentEnd, segmentStart2, segmentEnd2;
    
    if (scaledGap === 0) {
      // Intersecting lines: bars extend from center outward
      segmentStart = centerY - scaledWidth;
      segmentEnd = centerY;
      segmentStart2 = centerY;
      segmentEnd2 = centerY + scaledWidth;
    } else {
      // Four separate bars: each bar is `gap` pixels away from center
      segmentStart = centerY - scaledGap - scaledWidth;
      segmentEnd = centerY - scaledGap;
      segmentStart2 = centerY + scaledGap;
      segmentEnd2 = centerY + scaledGap + scaledWidth;
    }

    const cacheKey = `${mode}-${cursorType || ''}-${crossHairQuadrantWidth}-${gap}-${strokeLineCap}-${strokeWidth}-${crossHairScalingFactor}-${hasClickableElement ? 1 : 0}`;
    if (this.uriCache.has(cacheKey)) {
      return this.uriCache.get(cacheKey);
    }

    let svgContent = '';

    if (mode === 'text_focus' && cursorType === 't_square') {
      // Orange by default; green when a clickable element is armed/hovered in text focus.
      const color = hasClickableElement ? COLORS.FOCUS_GREEN_BRIGHT : COLORS.ORANGE;
      const scale = crossHairScalingFactor || 1;
      const half = 14 * scale;
      const x = 30 - half;
      const y = 30 - half;
      const w = 2 * half;
      const h = 2 * half;
      const tHalf = half * 0.6;
      const tTopY = 30 - half * 0.45;
      const tBottomY = 30 + half * 0.7;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />
        <line x1="${30 - tHalf}" y1="${tTopY}" x2="${30 + tHalf}" y2="${tTopY}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${tTopY}" x2="30" y2="${tBottomY}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else if (mode === 'text_focus') {
      // Orange crosshair by default; green when a clickable element is armed/hovered in text focus.
      const color = hasClickableElement ? COLORS.FOCUS_GREEN_BRIGHT : COLORS.ORANGE;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else if (mode === 'delete') {
      // Red X - scaled for 60x60 canvas
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="12" y1="12" x2="48" y2="48" stroke="${COLORS.DELETE_RED}" stroke-width="5" stroke-linecap="round"/>
        <line x1="48" y1="12" x2="12" y2="48" stroke="${COLORS.DELETE_RED}" stroke-width="5" stroke-linecap="round"/>
      </svg>`;
    } else if (mode === 'highlight') {
      // Blue crosshair
      const color = COLORS.HIGHLIGHT_BLUE;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    } else {
      // Default green crosshair
      const color = COLORS.FOCUS_GREEN_BRIGHT;
      svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
        <line x1="30" y1="${segmentStart}" x2="30" y2="${segmentEnd}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="30" y1="${segmentStart2}" x2="30" y2="${segmentEnd2}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart}" y1="30" x2="${segmentEnd}" y2="30" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
        <line x1="${segmentStart2}" y1="30" x2="${segmentEnd2}" y2="30" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLineCap}"/>
      </svg>`;
    }

    // Convert to data URI
    const encoded = encodeURIComponent(svgContent);
    const uri = `data:image/svg+xml,${encoded}`;
    this.uriCache.set(cacheKey, uri);
    return uri;
  }

  hide() {
    if (this.cursorEl) {
      // Hide cursor by setting the CSS variable to default
      document.documentElement.style.setProperty('--kpv2-cursor', 'default');
    }
  }

  show() {
    if (this.cursorEl) {
      // Show cursor by restoring current mode
      const currentMode = this.getCurrentMode();
      // Reset currentMode to force update in setMode
      const oldMode = this.currentMode;
      this.currentMode = null; 
      this.currentModeKey = null;
      this.setMode(currentMode, {});
    }
  }





  cleanup() {
    if (this.stuckCheckInterval) {
      clearInterval(this.stuckCheckInterval);
      this.stuckCheckInterval = null;
    }

    // Remove CSS cursor
    document.documentElement.style.cursor = '';
    document.body.style.cursor = '';
    // Also remove the CSS variable
    document.documentElement.style.removeProperty('--kpv2-cursor');
    
    this.cursorEl = null;
    this.currentMode = null; // Reset mode so setMode will update when re-enabled
    this.currentModeKey = null;
  }

  createElement(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === 'className') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }
}