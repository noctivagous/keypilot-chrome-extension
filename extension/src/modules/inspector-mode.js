/**
 * Shared inspector (element-pick) mode for KeyPilot.
 *
 * Delete Mode, Cols Toggle, Rectangle cumulative pick, and future tools share one lifecycle:
 *   1. Enter inspector with a kind → special cursor + hover outline on any element
 *   2. Move pointer to choose a target (inspectorEl)
 *   3. Confirm (same key again) → kind-specific action on target
 *      - single: exit after confirm
 *      - cumulative: add to pick set, grow union rect, stay active; Enter finalizes
 *   4. Esc → exit pick mode only (sticky effects like columns stay)
 *
 * Register new tools by adding an entry to INSPECTOR_DEFS + INSPECTOR_KIND.
 */
import { CSS_CLASSES, COLORS, INSPECTOR_KIND } from '../config/constants.js';

/**
 * @typedef {{
 *   kind: string,
 *   label: string,
 *   statusMode: string,
 *   cursorMode: string,
 *   hostClass: string,
 *   borderColor: string,
 *   shadowColor: string,
 *   shadowBrightColor: string,
 *   allowHtmlBody?: boolean,
 *   actionId?: string,
 *   instructionTemplate?: string,
 *   selectionMode?: 'single'|'cumulative',
 *   // Pointerdown dismisses this pick kind via cancelModes (same path as Esc).
 *   cancelOnPointerDown?: boolean
 * }} InspectorDef
 */

/**
 * Visual + metadata registry per inspector kind.
 * Action handlers stay in KeyPilot (or feature modules); this file owns pick chrome.
 *
 * @type {Readonly<Record<string, InspectorDef>>}
 */
export const INSPECTOR_DEFS = Object.freeze({
  [INSPECTOR_KIND.DELETE]: Object.freeze({
    kind: INSPECTOR_KIND.DELETE,
    label: 'Delete',
    statusMode: 'delete',
    cursorMode: 'delete',
    hostClass: CSS_CLASSES.DELETE,
    borderColor: COLORS.DELETE_RED,
    shadowColor: COLORS.DELETE_SHADOW,
    shadowBrightColor: COLORS.DELETE_SHADOW_BRIGHT,
    allowHtmlBody: false,
    actionId: 'DELETE',
    selectionMode: 'single',
    cancelOnPointerDown: true,
    instructionTemplate: 'Press {key} again to delete · Esc or click cancels'
  }),
  [INSPECTOR_KIND.COLS]: Object.freeze({
    kind: INSPECTOR_KIND.COLS,
    label: 'Cols',
    statusMode: 'cols',
    cursorMode: 'cols',
    hostClass: CSS_CLASSES.COLS,
    borderColor: COLORS.COLS_PURPLE,
    shadowColor: COLORS.COLS_SHADOW,
    shadowBrightColor: COLORS.COLS_SHADOW_BRIGHT,
    allowHtmlBody: true,
    actionId: 'COLS_TOGGLE',
    selectionMode: 'single',
    instructionTemplate: 'Hover an element · Press {key} again to columnize · Esc cancels'
  }),
  [INSPECTOR_KIND.RECTANGLE_PICK]: Object.freeze({
    kind: INSPECTOR_KIND.RECTANGLE_PICK,
    label: 'Select',
    statusMode: 'highlight',
    cursorMode: 'highlight',
    hostClass: CSS_CLASSES.HIGHLIGHT,
    borderColor: COLORS.HIGHLIGHT_BLUE,
    shadowColor: COLORS.HIGHLIGHT_SHADOW,
    shadowBrightColor: COLORS.HIGHLIGHT_SHADOW_BRIGHT,
    allowHtmlBody: false,
    actionId: 'RECTANGLE_HIGHLIGHT',
    selectionMode: 'cumulative',
    cancelOnPointerDown: true,
    instructionTemplate: 'Press {key} to add · Enter to finish · Esc or click cancels'
  })
});

/**
 * Build the top-right instruction string for an inspector kind.
 * @param {string|null|undefined} kind
 * @param {string} [confirmKey]
 * @returns {string}
 */
export function getInspectorInstructionText(kind, confirmKey) {
  const def = getInspectorDef(kind);
  const key = String(confirmKey || (kind === INSPECTOR_KIND.COLS ? '.' : 'Backspace') || '').trim() || '?';
  const template = def?.instructionTemplate || 'Press {key} again · Esc cancels';
  return template.replace(/\{key\}/g, key);
}

/**
 * @param {string|null|undefined} kind
 * @returns {InspectorDef|null}
 */
export function getInspectorDef(kind) {
  if (!kind) return null;
  return INSPECTOR_DEFS[kind] || null;
}

/**
 * Cursor mode string for CursorManager (kind-specific glyph).
 * @param {string|null|undefined} kind
 * @returns {string}
 */
export function getInspectorCursorMode(kind) {
  return getInspectorDef(kind)?.cursorMode || 'inspector';
}

/**
 * Status string for popup / control strip (legacy delete/cols labels).
 * @param {string|null|undefined} kind
 * @returns {string}
 */
export function getInspectorStatusMode(kind) {
  return getInspectorDef(kind)?.statusMode || 'inspector';
}

/**
 * All host CSS classes that may be painted on a hovered inspector target.
 * Used when clearing previous paint after kind switches.
 * @returns {string[]}
 */
export function getAllInspectorHostClasses() {
  const set = new Set();
  for (const def of Object.values(INSPECTOR_DEFS)) {
    if (def.hostClass) set.add(def.hostClass);
  }
  set.add(CSS_CLASSES.INSPECTOR);
  set.add(CSS_CLASSES.INSPECTOR_PICKED);
  return [...set];
}

/**
 * Union AABB of element bounding client rects (viewport coords).
 * @param {Element[]} elements
 * @returns {{ left: number, top: number, width: number, height: number }|null}
 */
export function unionElementRects(elements) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let any = false;

  for (const el of elements || []) {
    if (!el || el.nodeType !== 1 || !el.isConnected) continue;
    let rect;
    try {
      rect = el.getBoundingClientRect();
    } catch {
      continue;
    }
    if (!rect || (rect.width <= 0 && rect.height <= 0)) continue;
    any = true;
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  if (!any || !Number.isFinite(left)) return null;
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

/**
 * Coordinates inspector enter / exit / hover / resolve-target / cumulative picks.
 * Does not own confirm actions — callers run kind-specific effects.
 */
export class InspectorModeController {
  /**
   * @param {{
   *   state: import('./state-manager.js').StateManager,
   *   deepElementFromPoint: (x: number, y: number) => Element|null,
   *   onBeforeEnter?: (kind: string) => void,
   *   onPicksChanged?: (picks: Element[], unionRect: {left:number,top:number,width:number,height:number}|null) => void,
   * }} deps
   */
  constructor(deps) {
    this.state = deps.state;
    this.deepElementFromPoint = deps.deepElementFromPoint;
    this.onBeforeEnter = typeof deps.onBeforeEnter === 'function' ? deps.onBeforeEnter : null;
    this.onPicksChanged = typeof deps.onPicksChanged === 'function' ? deps.onPicksChanged : null;

    /** @type {'single'|'cumulative'} */
    this._selectionMode = 'single';
    /** @type {Element[]} */
    this._picked = [];
    /** @type {{ left: number, top: number, width: number, height: number }|null} */
    this._unionRect = null;
  }

  isActive() {
    return this.state.isInspectorMode?.() === true
      || (typeof this.state.getState === 'function' && this.state.getState().mode === 'inspector');
  }

  /**
   * @param {string} kind
   * @returns {boolean}
   */
  isKind(kind) {
    if (!this.isActive()) return false;
    return this.state.getState().inspectorKind === kind;
  }

  getKind() {
    if (!this.isActive()) return null;
    return this.state.getState().inspectorKind || null;
  }

  getTarget() {
    return this.state.getState().inspectorEl || null;
  }

  getDef() {
    return getInspectorDef(this.getKind());
  }

  /**
   * True when the active inspector kind opted into pointerdown dismiss.
   * @returns {boolean}
   */
  cancelsOnPointerDown() {
    return this.isActive() && !!this.getDef()?.cancelOnPointerDown;
  }

  /**
   * @returns {boolean}
   */
  isCumulative() {
    return this.isActive() && this._selectionMode === 'cumulative';
  }

  getSelectionMode() {
    return this._selectionMode;
  }

  /**
   * @returns {Element[]}
   */
  getPickedElements() {
    return this._picked.slice();
  }

  /**
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  getUnionRect() {
    return this._unionRect ? { ...this._unionRect } : null;
  }

  clearPicks() {
    this._picked = [];
    this._unionRect = null;
    try { this.onPicksChanged?.([], null); } catch { /* ignore */ }
  }

  /**
   * Enter (or switch to) an inspector kind. Replaces any other inspector kind.
   * @param {string} kind
   * @param {{ selectionMode?: 'single'|'cumulative' }} [opts]
   */
  enter(kind, opts = {}) {
    if (!getInspectorDef(kind)) {
      console.warn('[KeyPilot] Unknown inspector kind:', kind);
      return;
    }
    try {
      this.onBeforeEnter?.(kind);
    } catch (e) {
      console.warn('[KeyPilot] inspector onBeforeEnter failed:', e);
    }

    this.clearPicks();
    const def = getInspectorDef(kind);
    const requested = opts.selectionMode;
    if (requested === 'cumulative' || requested === 'single') {
      this._selectionMode = requested;
    } else {
      this._selectionMode = def?.selectionMode === 'cumulative' ? 'cumulative' : 'single';
    }

    this.state.enterInspector(kind);
  }

  /**
   * Exit pick mode; clear hover target and cumulative picks.
   * Does not reverse sticky effects (e.g. columns).
   */
  exit() {
    this.clearPicks();
    this._selectionMode = 'single';
    this.state.exitInspector();
  }

  /**
   * Hover tracking while inspector is active.
   * @param {Element|null|undefined} under
   */
  updateHover(under) {
    const st = this.state.getState();
    if (!this.isActive()) {
      if (st.inspectorEl) this.state.setInspectorElement(null);
      return;
    }
    const next = under && under.nodeType === 1 ? under : null;
    if (next !== st.inspectorEl) {
      this.state.setInspectorElement(next);
    }
  }

  /**
   * Element under cursor for confirm: state hover, else deep hit-test.
   * @returns {Element|null}
   */
  resolveTarget() {
    const st = this.state.getState();
    if (st.inspectorEl && st.inspectorEl.isConnected) {
      return st.inspectorEl;
    }
    try {
      const { x, y } = st.lastMouse || { x: 0, y: 0 };
      return this.deepElementFromPoint?.(x, y) || null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve target and exit pick mode (caller applies the action).
   * Single-shot tools (Delete, Cols).
   * @returns {Element|null}
   */
  confirmAndExit() {
    const target = this.resolveTarget();
    this.exit();
    return target;
  }

  /**
   * Cumulative: add hovered target to the pick set and stay in mode.
   * Recomputes the union bounding rect of all picks.
   * @returns {Element|null} added (or already-present) target
   */
  confirmAdd() {
    if (!this.isCumulative()) {
      return this.confirmAndExit();
    }

    const target = this.resolveTarget();
    if (!target || target.nodeType !== 1) return null;

    const def = this.getDef();
    if (!def?.allowHtmlBody) {
      if (target === document.documentElement || target === document.body) {
        return null;
      }
    }

    if (!this._picked.includes(target)) {
      this._picked.push(target);
    }

    // Drop disconnected nodes
    this._picked = this._picked.filter((el) => el && el.isConnected);
    this._unionRect = unionElementRects(this._picked);
    try { this.onPicksChanged?.(this.getPickedElements(), this.getUnionRect()); } catch { /* ignore */ }
    return target;
  }

  /**
   * Cumulative: return picked elements and exit (caller copies / applies).
   * @returns {{ elements: Element[], unionRect: {left:number,top:number,width:number,height:number}|null }}
   */
  finalizeAndExit() {
    const elements = this.getPickedElements().filter((el) => el && el.isConnected);
    const unionRect = this.getUnionRect();
    this.exit();
    return { elements, unionRect };
  }

  /**
   * Recompute union rect after scroll (viewport coords change).
   */
  refreshUnionRect() {
    if (!this.isCumulative() || this._picked.length === 0) {
      this._unionRect = null;
      return this._unionRect;
    }
    this._picked = this._picked.filter((el) => el && el.isConnected);
    this._unionRect = unionElementRects(this._picked);
    try { this.onPicksChanged?.(this.getPickedElements(), this.getUnionRect()); } catch { /* ignore */ }
    return this._unionRect;
  }
}
