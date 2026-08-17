import { CSS_CLASSES, Z_INDEX } from '../config/constants.js';
import { makePopoverResizable } from '../utils/popover-resize.js';

/**
 * PopupManager
 * Centralizes popup stacking + shared blurred backdrop so we don't rely on the
 * browser Popover API "top layer" (which can block our cursor/green-click overlay).
 *
 * All modal panels are resizable by default (edge + corner handles + SE grip).
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
    /** @type {Array<{id: string, panel: HTMLElement, onRequestClose?: () => void, resizeDispose?: () => void, blur?: boolean}>} */
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
   * Close every modal in the stack (launcher, settings, guide, tab history, etc.).
   * Prefers each panel's onRequestClose so app state stays in sync; force-removes
   * anything that remains.
   */
  closeAll() {
    let guard = 32;
    while (this._stack.length && guard-- > 0) {
      const top = this.top();
      if (!top) break;
      const id = top.id;
      try {
        if (typeof top.onRequestClose === 'function') {
          top.onRequestClose();
        }
      } catch {
        // ignore
      }
      // If the close handler didn't remove this entry, force-unmount it.
      if (this._stack.some((p) => p.id === id)) {
        this.hideModal(id);
      }
    }
    // Hard reset if anything is stuck.
    if (this._stack.length) {
      const leftover = this._stack.splice(0, this._stack.length);
      for (const entry of leftover) {
        try { entry?.resizeDispose?.(); } catch { /* ignore */ }
        try { entry?.panel?.remove?.(); } catch { /* ignore */ }
      }
    }
    if (this._backdrop) {
      try { this._backdrop.remove(); } catch { /* ignore */ }
      this._backdrop = null;
      if (this._onPanelChange) {
        try { this._onPanelChange('backdrop-hidden', {}); } catch { /* ignore */ }
      }
    }
  }

  /**
   * Show a modal popup panel with a shared blurred backdrop.
   * The panel is assigned a z-index *below* the click rectangle overlays.
   * Panels are resizable by default (edges + corners + SE grip icon).
   *
   * @param {object} params
   * @param {string} params.id
   * @param {HTMLElement} params.panel
   * @param {() => void} [params.onRequestClose]
   * @param {boolean} [params.resizable=true] Attach resize handles (default true)
   * @param {boolean} [params.blur=true] Blur + dim the page behind the panel
   * @param {{ minWidth?: number, minHeight?: number, margin?: number, aspectRatio?: number|true }} [params.resizeOptions]
   */
  showModal({ id, panel, onRequestClose, resizable = true, resizeOptions, blur = true } = {}) {
    if (!id || !panel) return;

    const wantBlur = blur !== false;

    // If already open, bring to front and update close handler.
    const existingIdx = this._stack.findIndex((p) => p.id === id);
    if (existingIdx >= 0) {
      const existing = this._stack[existingIdx];
      existing.panel = panel;
      existing.onRequestClose = typeof onRequestClose === 'function' ? onRequestClose : existing.onRequestClose;
      existing.blur = wantBlur;
      this._stack.splice(existingIdx, 1);
      this._stack.push(existing);
      this._ensureMounted();
      this._recomputeZ();
      this._ensureResizable(existing, resizable, resizeOptions);
      return;
    }

    /** @type {{id: string, panel: HTMLElement, onRequestClose?: () => void, resizeDispose?: () => void, blur?: boolean}} */
    const entry = {
      id: String(id),
      panel,
      onRequestClose: typeof onRequestClose === 'function' ? onRequestClose : undefined,
      blur: wantBlur
    };
    this._stack.push(entry);

    this._ensureMounted();
    this._recomputeZ();
    this._ensureResizable(entry, resizable, resizeOptions);

    // Notify about panel shown
    if (this._onPanelChange) {
      try {
        this._onPanelChange('panel-shown', { id: String(id), panel });
      } catch { /* ignore */ }
    }
  }

  /**
   * @param {{ panel: HTMLElement, resizeDispose?: () => void }} entry
   * @param {boolean} resizable
   * @param {object} [resizeOptions]
   */
  _ensureResizable(entry, resizable, resizeOptions) {
    if (!entry?.panel) return;
    if (resizable === false) {
      try { entry.resizeDispose?.(); } catch { /* ignore */ }
      entry.resizeDispose = undefined;
      return;
    }
    // Already attached for this panel instance.
    if (typeof entry.resizeDispose === 'function') return;
    try {
      const api = makePopoverResizable(entry.panel, resizeOptions || {});
      if (api && typeof api.dispose === 'function') {
        entry.resizeDispose = () => {
          try { api.dispose(); } catch { /* ignore */ }
        };
      }
    } catch (e) {
      console.warn('[KeyPilot] Failed to attach popover resize handles:', e?.message || e);
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

    // Tear down resize handles before unmount.
    try { removed?.resizeDispose?.(); } catch { /* ignore */ }

    // Notify about panel hidden
    if (this._onPanelChange) {
      try {
        this._onPanelChange('panel-hidden', { id: targetId, panel: removed?.panel });
      } catch { /* ignore */ }
    }

    // Synchronous unmount — View Transitions here produced a blurry cross-fade
    // snapshot of the panel that lingered then snapped away.
    try { removed?.panel?.style && (removed.panel.style.viewTransitionName = 'none'); } catch { /* ignore */ }
    try { removed?.panel?.remove?.(); } catch { /* ignore */ }

    if (!this._stack.length) {
      try {
        if (this._backdrop) this._backdrop.style.viewTransitionName = 'none';
      } catch { /* ignore */ }
      try { this._backdrop?.remove?.(); } catch { /* ignore */ }
      this._backdrop = null;

      if (this._onPanelChange) {
        try {
          this._onPanelChange('backdrop-hidden', {});
        } catch { /* ignore */ }
      }
    }

    this._recomputeZ();
    this._applyBackdropVisual();
  }

  _ensureMounted() {
    const doc = this.doc;
    if (!doc || !doc.body) return;

    if (!this._backdrop) {
      const el = doc.createElement('div');
      el.className = CSS_CLASSES.POPUP_BACKDROP || 'kpv2-popup-backdrop';
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        outline: 'none',
        // zIndex assigned in _recomputeZ() before first paint when possible
        pointerEvents: 'auto',
        viewTransitionName: 'none'
      });
      el.addEventListener('click', this._backdropClickHandler, true);
      this._backdrop = el;
    }

    // Assign z-index before append so the first paint has correct stacking
    // (panel above backdrop — avoids a frame where the panel is blurred by
    // the backdrop-filter).
    this._recomputeZ();
    this._applyBackdropVisual();

    // Mount backdrop + panels in one synchronous batch. Separate
    // startViewTransition() calls used to cross-fade blurry snapshots of the
    // launcher on open.
    const backdropJustMounted = !!(this._backdrop && !this._backdrop.isConnected);
    if (backdropJustMounted) {
      try { doc.body.appendChild(this._backdrop); } catch { /* ignore */ }
      if (this._onPanelChange) {
        try {
          this._onPanelChange('backdrop-shown', { backdrop: this._backdrop });
        } catch { /* ignore */ }
      }
    }

    for (const entry of this._stack) {
      const panel = entry.panel;
      if (panel && !panel.isConnected) {
        try { panel.style.viewTransitionName = 'none'; } catch { /* ignore */ }
        try { doc.body.appendChild(panel); } catch { /* ignore */ }
      }
    }
  }

  /**
   * Dim+blur unless every open panel opted out (`blur: false`).
   * Click-outside still works with a transparent catcher.
   */
  _applyBackdropVisual() {
    const el = this._backdrop;
    if (!el) return;
    const wantBlur = this._stack.some((entry) => entry.blur !== false);
    if (wantBlur) {
      el.style.background = 'rgba(0,0,0,0.35)';
      el.style.backdropFilter = 'blur(6px)';
      el.style.webkitBackdropFilter = 'blur(6px)';
    } else {
      el.style.background = 'transparent';
      el.style.backdropFilter = 'none';
      el.style.webkitBackdropFilter = 'none';
    }
  }

  _recomputeZ() {
    // Backdrop below panels; panels in a bounded band below overlays.
    if (this._backdrop) {
      this._backdrop.style.zIndex = String(Z_INDEX.POPUP_BACKDROP ?? Z_INDEX.VIEWPORT_MODAL_FRAME);
      // Do not participate in View Transitions (blurry snapshot morphs).
      this._backdrop.style.viewTransitionName = 'none';

      // Notify about backdrop z-index update (for negative region tracking)
      if (this._onPanelChange && this._stack.length > 0) {
        try {
          this._onPanelChange('backdrop-updated', { backdrop: this._backdrop });
        } catch { /* ignore */ }
      }
    }

    const base = Z_INDEX.POPUP_PANEL_BASE ?? (Z_INDEX.VIEWPORT_MODAL_FRAME + 2);
    const max = Z_INDEX.POPUP_PANEL_MAX ?? (Z_INDEX.OVERLAYS_BELOW_2 - 1);

    for (let i = 0; i < this._stack.length; i++) {
      const entry = this._stack[i];
      const panel = entry.panel;
      if (!panel) continue;

      const z = Math.min(base + i, max);
      panel.style.zIndex = String(z);
      panel.style.viewTransitionName = 'none';

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
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      for (const n of path) {
        if (!n || n.nodeType !== 1) continue;
        const cls = n.classList;
        if (
          cls?.contains('kp-floating-keyboard-help') ||
          cls?.contains('kp-control-strip') ||
          cls?.contains('kp-layout-config-panel')
        ) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      const top = this.top();
      if (top?.onRequestClose) top.onRequestClose();
      else this.hideModal();
    } catch {
      // ignore
    }
  }
}


