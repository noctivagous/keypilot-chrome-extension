import { CSS_CLASSES, Z_INDEX } from '../config/constants.js';

/**
 * PopupManager
 * Centralizes popup stacking + shared blurred backdrop so we don't rely on the
 * browser Popover API "top layer" (which can block our cursor/green-click overlay).
 */
export class PopupManager {
  /**
   * @param {object} [opts]
   * @param {Document} [opts.doc]
   * @param {(type: string, data: any) => void} [opts.onPanelChange] Optional callback for panel lifecycle events
   */
  constructor({ doc, onPanelChange } = {}) {
    this.doc = doc || document;

    /** @type {HTMLDivElement|null} */
    this._backdrop = null;
    /** @type {Array<{id: string, panel: HTMLElement, onRequestClose?: () => void}>} */
    this._stack = [];

    /** @type {(type: string, data: any) => void|null} */
    this._onPanelChange = typeof onPanelChange === 'function' ? onPanelChange : null;

    this._backdropClickHandler = this._backdropClickHandler.bind(this);
  }

  isOpen() {
    return this._stack.length > 0;
  }

  top() {
    return this._stack.length ? this._stack[this._stack.length - 1] : null;
  }

  /**
   * Request closing the topmost popup.
   * Prefers the popup's onRequestClose hook (so callers can synchronize app state),
   * and falls back to removing the modal directly.
   */
  requestCloseTop() {
    const top = this.top();
    if (!top) return;
    try {
      if (typeof top.onRequestClose === 'function') {
        top.onRequestClose();
        return;
      }
    } catch {
      // ignore and fall back
    }
    this.hideModal(top.id);
  }

  /**
   * Show a modal popup panel with a shared blurred backdrop.
   * The panel is assigned a z-index *below* the click rectangle overlays.
   *
   * @param {object} params
   * @param {string} params.id
   * @param {HTMLElement} params.panel
   * @param {() => void} [params.onRequestClose]
   */
  showModal({ id, panel, onRequestClose } = {}) {
    if (!id || !panel) return;

    // If already open, bring to front and update close handler.
    const existingIdx = this._stack.findIndex((p) => p.id === id);
    if (existingIdx >= 0) {
      const existing = this._stack[existingIdx];
      existing.panel = panel;
      existing.onRequestClose = typeof onRequestClose === 'function' ? onRequestClose : existing.onRequestClose;
      this._stack.splice(existingIdx, 1);
      this._stack.push(existing);
      this._ensureMounted();
      this._recomputeZ();
      return;
    }

    this._stack.push({
      id: String(id),
      panel,
      onRequestClose: typeof onRequestClose === 'function' ? onRequestClose : undefined
    });

    this._ensureMounted();
    this._recomputeZ();
    
    // Notify about panel shown
    if (this._onPanelChange) {
      try {
        this._onPanelChange('panel-shown', { id: String(id), panel });
      } catch { /* ignore */ }
    }
  }

  /**
   * Hide a popup by id (or the top popup if id is omitted).
   * @param {string} [id]
   */
  hideModal(id) {
    const targetId = typeof id === 'string' && id ? id : (this.top()?.id || null);
    if (!targetId) return;

    const idx = this._stack.findIndex((p) => p.id === targetId);
    if (idx < 0) return;

    const removed = this._stack.splice(idx, 1)[0];
    
    // Notify about panel hidden
    if (this._onPanelChange) {
      try {
        this._onPanelChange('panel-hidden', { id: targetId, panel: removed?.panel });
      } catch { /* ignore */ }
    }
    
    this._withViewTransition(() => {
      try { removed?.panel?.remove?.(); } catch { /* ignore */ }
      if (!this._stack.length) {
        try { this._backdrop?.remove?.(); } catch { /* ignore */ }
        this._backdrop = null;
        
        // Notify about backdrop hidden
        if (this._onPanelChange) {
          try {
            this._onPanelChange('backdrop-hidden', {});
          } catch { /* ignore */ }
        }
      }
    });

    this._recomputeZ();
  }

  _ensureMounted() {
    const doc = this.doc;
    if (!doc || !doc.body) return;

    this._ensureStyles();

    if (!this._backdrop) {
      const el = doc.createElement('div');
      el.className = CSS_CLASSES.POPUP_BACKDROP || 'kpv2-popup-backdrop';
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        outline: 'none',
        // zIndex assigned in _recomputeZ()
        pointerEvents: 'auto'
      });
      el.addEventListener('click', this._backdropClickHandler, true);
      this._backdrop = el;
    }

    // Ensure backdrop is in DOM before panels.
    if (this._backdrop && !this._backdrop.isConnected) {
      this._withViewTransition(() => {
        try { doc.body.appendChild(this._backdrop); } catch { /* ignore */ }
      });
      
      // Notify about backdrop shown
      if (this._onPanelChange) {
        try {
          this._onPanelChange('backdrop-shown', { backdrop: this._backdrop });
        } catch { /* ignore */ }
      }
    }

    for (const entry of this._stack) {
      const panel = entry.panel;
      if (panel && !panel.isConnected) {
        this._withViewTransition(() => {
          try { doc.body.appendChild(panel); } catch { /* ignore */ }
        });
      }
    }
  }

  _recomputeZ() {
    // Backdrop below panels; panels in a bounded band below overlays.
    if (this._backdrop) {
      this._backdrop.style.zIndex = String(Z_INDEX.POPUP_BACKDROP ?? Z_INDEX.VIEWPORT_MODAL_FRAME);
      // View transitions naming: backdrop participates, but only when something is open.
      this._backdrop.style.viewTransitionName = this._stack.length ? 'kpv2-popup-backdrop' : 'none';
      
      // Notify about backdrop z-index update (for negative region tracking)
      if (this._onPanelChange && this._stack.length > 0) {
        try {
          this._onPanelChange('backdrop-updated', { backdrop: this._backdrop });
        } catch { /* ignore */ }
      }
    }

    const base = Z_INDEX.POPUP_PANEL_BASE ?? (Z_INDEX.VIEWPORT_MODAL_FRAME + 2);
    const max = Z_INDEX.POPUP_PANEL_MAX ?? (Z_INDEX.OVERLAYS_BELOW_2 - 1);

    // Only one element can own the same view-transition-name.
    const top = this.top();

    for (let i = 0; i < this._stack.length; i++) {
      const entry = this._stack[i];
      const panel = entry.panel;
      if (!panel) continue;

      const z = Math.min(base + i, max);
      panel.style.zIndex = String(z);
      panel.style.viewTransitionName = (top && top.id === entry.id) ? 'kpv2-popup-panel' : 'none';
      
      // Notify about panel z-index update (for negative region tracking)
      if (this._onPanelChange) {
        try {
          this._onPanelChange('panel-updated', { id: entry.id, panel });
        } catch { /* ignore */ }
      }
    }
  }

  _backdropClickHandler(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
      const top = this.top();
      if (top?.onRequestClose) top.onRequestClose();
      else this.hideModal();
    } catch {
      // ignore
    }
  }

  _ensureStyles() {
    const doc = this.doc;
    if (!doc || !doc.head) return;

    const STYLE_ID = 'kpv2-popup-manager-styles';
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* View Transitions: keep animations subtle and scoped to popup elements */
      ::view-transition-old(kpv2-popup-backdrop),
      ::view-transition-new(kpv2-popup-backdrop) {
        animation-duration: 160ms;
        animation-timing-function: ease-out;
      }
      ::view-transition-old(kpv2-popup-panel),
      ::view-transition-new(kpv2-popup-panel) {
        animation-duration: 180ms;
        animation-timing-function: ease-out;
      }
    `;
    doc.head.appendChild(style);
  }

  _withViewTransition(updateDom) {
    const doc = this.doc;
    const fn = typeof updateDom === 'function' ? updateDom : () => {};

    // Prefer View Transitions when available; fall back cleanly if unsupported.
    const vt = doc && typeof doc.startViewTransition === 'function' ? doc.startViewTransition.bind(doc) : null;
    if (!vt) {
      fn();
      return;
    }

    try {
      vt(() => {
        try { fn(); } catch { /* ignore */ }
      });
    } catch {
      fn();
    }
  }
}


