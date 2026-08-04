/**
 * Shared inspector (element-pick) mode for KeyPilot.
 *
 * Delete Mode, Cols Toggle, and future tools share one lifecycle:
 *   1. Enter inspector with a kind → special cursor + hover outline on any element
 *   2. Move pointer to choose a target (inspectorEl)
 *   3. Confirm (same key again) → kind-specific action on target
 *   4. Esc → exit pick mode only (sticky side-effects like columns stay)
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
    allowHtmlBody: false
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
    allowHtmlBody: true
  })
});

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
  return [...set];
}

/**
 * Coordinates inspector enter / exit / hover / resolve-target.
 * Does not own confirm actions — callers run kind-specific effects.
 */
export class InspectorModeController {
  /**
   * @param {{
   *   state: import('./state-manager.js').StateManager,
   *   deepElementFromPoint: (x: number, y: number) => Element|null,
   *   onBeforeEnter?: (kind: string) => void,
   * }} deps
   */
  constructor(deps) {
    this.state = deps.state;
    this.deepElementFromPoint = deps.deepElementFromPoint;
    this.onBeforeEnter = typeof deps.onBeforeEnter === 'function' ? deps.onBeforeEnter : null;
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
   * Enter (or switch to) an inspector kind. Replaces any other inspector kind.
   * @param {string} kind
   */
  enter(kind) {
    if (!getInspectorDef(kind)) {
      console.warn('[KeyPilot] Unknown inspector kind:', kind);
      return;
    }
    try {
      this.onBeforeEnter?.(kind);
    } catch (e) {
      console.warn('[KeyPilot] inspector onBeforeEnter failed:', e);
    }
    this.state.enterInspector(kind);
  }

  /**
   * Exit pick mode; clear hover target. Does not reverse sticky effects (e.g. columns).
   */
  exit() {
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
   * @returns {Element|null}
   */
  confirmAndExit() {
    const target = this.resolveTarget();
    this.exit();
    return target;
  }
}
