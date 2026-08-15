/**
 * Viewport-fixed Scroll Line chrome: origin dot + line to the pointer.
 * Uses the native Popover API (top layer) with pointer-events: none so it
 * sits above the page without blocking hit-testing or F-click.
 */
import { CSS_CLASSES, COLORS, Z_INDEX } from '../config/constants.js';

const STROKE = COLORS.ORANGE;
const DOT_R = 6;

export class ScrollLineOverlay {
  constructor() {
    this.root = null;
    this.svg = null;
    this.line = null;
    this.dot = null;
    this.targetBox = null;
    this.origin = { x: 0, y: 0 };
    this._usingPopover = false;
    this._lastTargetBox = null;
  }

  /**
   * @param {number} originX
   * @param {number} originY
   */
  show(originX, originY) {
    this.origin = { x: Number(originX) || 0, y: Number(originY) || 0 };
    this._ensure();
    if (!this.root) return;

    this._syncDot();
    this.updatePointer(this.origin.x, this.origin.y);

    try {
      if (!this.root.isConnected) {
        (document.body || document.documentElement).appendChild(this.root);
      }
    } catch { /* ignore */ }

    if (this._usingPopover) {
      try {
        if (typeof this.root.showPopover === 'function' && !this.root.matches(':popover-open')) {
          this.root.showPopover();
        }
      } catch { /* ignore */ }
    }

    this.root.hidden = false;
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  updatePointer(x, y) {
    if (!this.line) return;
    const px = Number(x);
    const py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    try {
      this.line.setAttribute('x2', String(px));
      this.line.setAttribute('y2', String(py));
    } catch { /* ignore */ }
  }

  /**
   * Viewport-fixed ring around a nested overflow container. Pass null to hide
   * (document / full-viewport scrollers).
   * @param {{ left: number, top: number, width: number, height: number, radius?: string }|null} box
   */
  setTargetBox(box) {
    this._ensure();
    if (!this.targetBox) return;

    if (!box || !(box.width > 4) || !(box.height > 4)) {
      this._lastTargetBox = null;
      try { this.targetBox.style.display = 'none'; } catch { /* ignore */ }
      return;
    }

    const left = Number(box.left) || 0;
    const top = Number(box.top) || 0;
    const width = Number(box.width) || 0;
    const height = Number(box.height) || 0;
    const radius = String(box.radius || '0');
    const prev = this._lastTargetBox;
    if (
      prev &&
      Math.abs(prev.left - left) < 0.5 &&
      Math.abs(prev.top - top) < 0.5 &&
      Math.abs(prev.width - width) < 0.5 &&
      Math.abs(prev.height - height) < 0.5 &&
      prev.radius === radius
    ) {
      return;
    }
    this._lastTargetBox = { left, top, width, height, radius };

    const el = this.targetBox;
    try {
      el.style.display = 'block';
      el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.borderRadius = radius;
    } catch { /* ignore */ }
  }

  hide() {
    if (!this.root) return;
    this.setTargetBox(null);
    if (this._usingPopover) {
      try {
        if (typeof this.root.hidePopover === 'function' && this.root.matches(':popover-open')) {
          this.root.hidePopover();
        }
      } catch { /* ignore */ }
    }
    try { this.root.hidden = true; } catch { /* ignore */ }
  }

  destroy() {
    this.hide();
    try { this.root?.remove?.(); } catch { /* ignore */ }
    this.root = null;
    this.svg = null;
    this.line = null;
    this.dot = null;
    this.targetBox = null;
    this._lastTargetBox = null;
  }

  _syncDot() {
    if (!this.dot || !this.line) return;
    const x = String(this.origin.x);
    const y = String(this.origin.y);
    try {
      this.dot.setAttribute('cx', x);
      this.dot.setAttribute('cy', y);
      this.line.setAttribute('x1', x);
      this.line.setAttribute('y1', y);
    } catch { /* ignore */ }
  }

  _ensure() {
    if (this.root) return;

    const doc = document;
    const root = doc.createElement('div');
    root.className = CSS_CLASSES.SCROLL_LINE_OVERLAY;
    root.id = CSS_CLASSES.SCROLL_LINE_OVERLAY;
    root.setAttribute('aria-hidden', 'true');
    root.hidden = true;

    const popoverOk = typeof HTMLElement !== 'undefined'
      && 'popover' in HTMLElement.prototype
      && typeof root.showPopover === 'function';

    this._usingPopover = popoverOk;
    if (popoverOk) {
      try { root.popover = 'manual'; } catch {
        try { root.setAttribute('popover', 'manual'); } catch { /* ignore */ }
      }
    }

    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'width:100%',
      'height:100%',
      'max-width:none',
      'max-height:none',
      'margin:0',
      'padding:0',
      'border:none',
      'background:transparent',
      'overflow:hidden',
      'pointer-events:none',
      `z-index:${Z_INDEX.CURSOR}`,
      'box-sizing:border-box'
    ].join(';');

    const targetBox = doc.createElement('div');
    targetBox.className = CSS_CLASSES.SCROLL_LINE_TARGET || 'kpv2-scroll-line-target';
    targetBox.setAttribute('aria-hidden', 'true');
    targetBox.style.cssText = [
      'display:none',
      'position:absolute',
      'left:0',
      'top:0',
      'box-sizing:border-box',
      'pointer-events:none',
      `border:3px solid ${STROKE}`,
      'background:transparent',
      `box-shadow:0 0 0 2px ${COLORS.ORANGE_SHADOW}, 0 0 10px 2px ${COLORS.ORANGE_SHADOW_LIGHT}`,
      'will-change:transform,width,height'
    ].join(';');

    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';

    const line = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', STROKE);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('fill', 'none');

    const dot = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', String(DOT_R));
    dot.setAttribute('fill', STROKE);
    dot.setAttribute('stroke', COLORS.TEXT_WHITE_PRIMARY);
    dot.setAttribute('stroke-width', '2');

    svg.appendChild(line);
    svg.appendChild(dot);
    root.appendChild(targetBox);
    root.appendChild(svg);

    this.root = root;
    this.svg = svg;
    this.line = line;
    this.dot = dot;
    this.targetBox = targetBox;
  }
}
