/**
 * Per-action settings + floating config panel for Keyboard Reference keys bound to a fixed
 * physical key (e.g. `SEND_TEXT_TO_AI`, `RECTANGLE_HIGHLIGHT`) rather than a user-assignable
 * `UserKeyboardLayout` slot.
 *
 * Parameter *schema* for these ids now lives on `FunctionDef.parameters` in
 * `function-library.js` (single source of truth, shared with the Function Library
 * browser/instance system) — this module just derives the legacy `ActionSettingsDef` shape
 * (mode-switch + Config-button UI) from it. Parameter *values* live on each Function's
 * canonical Action Instance (`getOrCreateBuiltinFunctionUserAction` in
 * `keyboard-layout-store.js`), not in global `settings.actionSettings[actionId]` anymore — see
 * KEY_ACTION_ARCHITECTURE.md, "Migration mapping".
 *
 * Shared result destinations (clipboard / popover / both / …) live in
 * `action-result-delivery.js` and are reused here and by AI and future procedures.
 */
import { Z_INDEX, KP_UI_FONT } from '../config/constants.js';
import { makePanelDraggable } from '../utils/panel-position.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';
import { getFunctionDef, groupFunctionParameters } from '../config/function-library.js';
import {
  NCT_DARK_UI_PANEL_BACKGROUND,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_FIELD_BACKGROUND,
  NCT_DARK_UI_FIELD_BORDER,
  NCT_DARK_UI_FIELD_BOX_SHADOW,
  NCT_DARK_UI_FIELD_FOCUS_BORDER,
  NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW,
  NCT_DARK_UI_COLORS
} from './nct-dark-ui.js';
import {
  getOrCreateBuiltinFunctionUserAction,
  setBuiltinFunctionUserActionParameter
} from '../modules/keyboard-layout-store.js';
import {
  filterFunctionParameterOptions,
  shouldShowFunctionParameter
} from '../modules/ai-text-service.js';

/**
 * @typedef {{ id: string, label: string }} ActionModeOption
 * @typedef {import('../config/function-library.js').FunctionParameterDef} ActionParameterDef
 * @typedef {{
 *   modes?: ActionModeOption[],
 *   defaultMode?: string,
 *   parameters?: ActionParameterDef[]
 * }} ActionSettingsDef
 */

/**
 * A Function parameter literally named `mode` of type `enum` is additionally surfaced as
 * `modes`/`defaultMode` for backward compat with the sticky popover's button-group mode switch
 * (e.g. `RECTANGLE_HIGHLIGHT`'s "Element rectangle" / "Pick cumulative", `HIGHLIGHT`'s
 * "Rich text" / "Plain text"). A `destination` enum
 * is likewise inlined on the key-info popover (Copy Image / Copy URL). Everything else is a
 * regular parameter rendered by {@link KeyActionConfigPanel}.
 */
const MODE_PARAMETER_ID = 'mode';
const DESTINATION_PARAMETER_ID = 'destination';
/** Enums painted as button groups on the Keyboard Reference key-info popover. */
const INLINE_ENUM_PARAMETER_IDS = Object.freeze(['mode', 'action', 'format', 'destination']);

/**
 * Derive an {@link ActionSettingsDef} from the Function Library. Returns null for Functions with
 * no parameter schema (nothing to configure) or that don't exist.
 * @param {string} actionId
 * @returns {ActionSettingsDef|null}
 */
export function getActionSettingsDef(actionId) {
  const def = getFunctionDef(actionId);
  if (!def || !def.parameters || def.parameters.length === 0) return null;
  const modeParam = def.parameters.find((p) => p && p.id === MODE_PARAMETER_ID && p.type === 'enum');
  return {
    modes: modeParam ? modeParam.options : undefined,
    defaultMode: modeParam ? modeParam.defaultValue : undefined,
    parameters: def.parameters
  };
}

/**
 * @param {string} actionId
 * @returns {boolean}
 */
export function actionHasModes(actionId) {
  const def = getActionSettingsDef(actionId);
  return !!(def?.modes && def.modes.length > 0);
}

/**
 * Non-`mode` parameters — i.e. parameters the Config panel actually needs to render, excluding
 * the one already covered by the mode-switch button group (see {@link actionHasModes}).
 * @param {string} actionId
 * @returns {ActionParameterDef[]}
 */
function nonModeParameters(actionId) {
  const def = getActionSettingsDef(actionId);
  return (def?.parameters || []).filter((p) => p && p.id !== MODE_PARAMETER_ID);
}

/**
 * Parameters that still need the Config panel (not already inlined on the key-info popover).
 * @param {string} actionId
 * @returns {ActionParameterDef[]}
 */
function configPanelParameters(actionId) {
  return nonModeParameters(actionId).filter(
    (p) => p
      && !INLINE_ENUM_PARAMETER_IDS.includes(p.id)
      && shouldShowFunctionParameter(actionId, p)
  );
}

/**
 * Enum parameters shown as button groups on the key-info popover.
 * @param {string} actionId
 * @returns {ActionParameterDef[]}
 */
export function getActionInlineEnumDefs(actionId) {
  const def = getActionSettingsDef(actionId);
  return (def?.parameters || []).filter(
    (p) => p && p.type === 'enum' && INLINE_ENUM_PARAMETER_IDS.includes(p.id)
  );
}

/**
 * @param {string} actionId
 * @returns {ActionParameterDef|null}
 */
export function getActionDestinationDef(actionId) {
  const def = getActionSettingsDef(actionId);
  const param = def?.parameters?.find((p) => p && p.id === DESTINATION_PARAMETER_ID && p.type === 'enum');
  return param || null;
}

/**
 * @param {string} actionId
 * @returns {boolean}
 */
export function actionHasParameters(actionId) {
  return configPanelParameters(actionId).length > 0;
}

/**
 * @param {string} actionId
 * @returns {boolean}
 */
export function actionHasDestination(actionId) {
  return !!getActionDestinationDef(actionId);
}

/**
 * @param {Record<string, any>|null|undefined} parameters Action Instance's bound `parameters`
 *   (e.g. `(await getOrCreateBuiltinFunctionUserAction(actionId)).parameters`) — NOT the old
 *   global `settings.actionSettings` blob.
 * @param {string} actionId
 * @returns {string}
 */
export function getActionMode(parameters, actionId) {
  const def = getActionSettingsDef(actionId);
  const fallback = def?.defaultMode || (def?.modes?.[0]?.id) || 'element';
  const stored = parameters?.[MODE_PARAMETER_ID];
  if (typeof stored === 'string' && def?.modes?.some((m) => m.id === stored)) {
    return stored;
  }
  return fallback;
}

/**
 * Read a bound parameter value with schema-default fallback.
 * @param {Record<string, any>|null|undefined} parameters see {@link getActionMode}
 * @param {string} actionId
 * @param {string} paramId
 * @returns {any}
 */
export function getActionParameter(parameters, actionId, paramId) {
  const def = getActionSettingsDef(actionId);
  const paramDef = def?.parameters?.find((p) => p && p.id === paramId) || null;
  const stored = parameters?.[paramId];
  if (stored !== undefined) return stored;
  return paramDef ? paramDef.defaultValue : undefined;
}

/**
 * Persist a mode for a built-in Function id, on its canonical Action Instance.
 * @param {string} actionId
 * @param {string} modeId
 * @returns {Promise<import('../modules/keyboard-layout-store.js').UserAction|null>}
 */
export async function setActionMode(actionId, modeId) {
  const def = getActionSettingsDef(actionId);
  if (!def?.modes?.some((m) => m.id === modeId)) {
    throw new Error(`Unknown mode ${modeId} for action ${actionId}`);
  }
  const action = await setBuiltinFunctionUserActionParameter(actionId, MODE_PARAMETER_ID, modeId);
  notifyActionSettingsChanged(actionId, action);
  return action;
}

/**
 * Persist a single parameter value for a built-in Function id, on its canonical Action Instance.
 * @param {string} actionId
 * @param {string} paramId
 * @param {any} value
 * @returns {Promise<import('../modules/keyboard-layout-store.js').UserAction|null>}
 */
export async function setActionParameter(actionId, paramId, value) {
  const action = await setBuiltinFunctionUserActionParameter(actionId, paramId, value);
  notifyActionSettingsChanged(actionId, action);
  return action;
}

/**
 * Broadcast a value change so any live KeyPilot instance can update its own read cache
 * immediately (storage round-trips are too slow for "type a character, see it reflected").
 * @param {string} actionId
 * @param {import('../modules/keyboard-layout-store.js').UserAction|null} action
 */
function notifyActionSettingsChanged(actionId, action) {
  try {
    document.dispatchEvent(new CustomEvent('keypilot:action-settings-changed', {
      detail: { actionId, action }
    }));
  } catch { /* ignore */ }
}

const CONFIG_PANEL_STYLE_ATTR = 'data-kp-action-config-style';

function ensureConfigPanelStyles(root) {
  injectChromeStyles(root, { attr: CONFIG_PANEL_STYLE_ATTR, css: `
:host {
  position: fixed;
  z-index: ${Z_INDEX.KEY_ACTION_CONFIG || (Z_INDEX.KEYBINDINGS_POPOVER + 1)};
  min-width: 240px;
  max-width: min(360px, calc(100vw - 24px));
  color: ${NCT_DARK_UI_COLORS.fg};
  font-family: ${KP_UI_FONT};
  font-size: 12px;
  line-height: 1.4;
  border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
  border: ${NCT_DARK_UI_PANEL_BORDER};
  background: ${NCT_DARK_UI_PANEL_BACKGROUND};
  box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
  box-sizing: border-box;
}
:host([hidden]) { display: none !important; }
.kp-action-config-panel__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: grab;
  user-select: none;
  background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
  border-bottom: ${NCT_DARK_UI_TITLEBAR_BORDER_BOTTOM};
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
}
.kp-action-config-panel__title {
  font-weight: var(--kp-titlebar-title-weight, 600);
  font-size: 12px;
  letter-spacing: var(--kp-type-tracking-titlebar, 0.02em);
  text-transform: var(--kp-type-transform-titlebar, none);
  color: var(--kp-color-fg, inherit);
}
.kp-action-config-panel__close {
  appearance: none;
  background: ${NCT_DARK_UI_BTN_GRADIENT};
  border: ${NCT_DARK_UI_BTN_BORDER};
  color: inherit;
  width: 22px;
  height: 22px;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.kp-action-config-panel__body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.kp-action-config-panel__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kp-action-config-panel__label {
  opacity: 0.85;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.kp-action-config-panel__control {
  appearance: none;
  width: 100%;
  box-sizing: border-box;
  border-radius: ${NCT_DARK_UI_BTN_RADIUS};
  border: ${NCT_DARK_UI_FIELD_BORDER};
  background: ${NCT_DARK_UI_FIELD_BACKGROUND};
  box-shadow: ${NCT_DARK_UI_FIELD_BOX_SHADOW};
  color: inherit;
  padding: 6px 8px;
  font: inherit;
}
.kp-action-config-panel__control:focus {
  outline: none;
  border-color: ${NCT_DARK_UI_FIELD_FOCUS_BORDER};
  box-shadow: ${NCT_DARK_UI_FIELD_FOCUS_BOX_SHADOW};
}
.kp-action-config-panel__control[data-multiline="true"] {
  min-height: 64px;
  resize: vertical;
  line-height: 1.35;
}
.kp-action-config-panel__empty {
  opacity: 0.7;
  font-style: italic;
}
` });
}

/**
 * Floating, draggable parameter editor for a single action.
 */
export class KeyActionConfigPanel {
  constructor() {
    /** @type {HTMLElement|null} */
    this.root = null;
    /** @type {ShadowRoot|null} */
    this.shadowRoot = null;
    /** @type {string|null} */
    this.actionId = null;
    /** @type {{ dispose: () => void }|null} */
    this._dragApi = null;
    /** @type {((settings: any) => void)|null} */
    this.onSettingsChanged = null;
  }

  /**
   * @param {string} actionId
   * @param {{ title?: string, anchorRect?: DOMRect|null }} [opts]
   */
  async open(actionId, opts = {}) {
    const def = getActionSettingsDef(actionId);
    if (!def) return;

    const doc = document;
    this.actionId = actionId;

    if (!this.root) {
      this.root = doc.createElement('div');
      this.root.className = 'kp-action-config-panel';
      this.root.setAttribute('role', 'dialog');
      this.shadowRoot = ensureOpenChromeShadow(this.root, { id: 'action-config', chromeWindow: true });
      const panelRoot = this.shadowRoot || this.root;
      ensureConfigPanelStyles(panelRoot);
      panelRoot.innerHTML = `
        <div class="kp-action-config-panel__titlebar" data-kp-config-drag="true">
          <div class="kp-action-config-panel__title"></div>
          <button type="button" class="kp-action-config-panel__close" aria-label="Close">×</button>
        </div>
        <div class="kp-action-config-panel__body"></div>
      `;
      doc.body.appendChild(this.root);

      const closeBtn = panelRoot.querySelector('.kp-action-config-panel__close');
      closeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      });

      const handle = panelRoot.querySelector('[data-kp-config-drag="true"]');
      this._dragApi = makePanelDraggable(this.root, handle, {
        excludeSelector: '.kp-action-config-panel__close'
      });
    }

    const panelRoot = this.shadowRoot || this.root.shadowRoot || this.root;
    ensureConfigPanelStyles(panelRoot);
    const titleEl = panelRoot.querySelector('.kp-action-config-panel__title');
    if (titleEl) titleEl.textContent = opts.title || `${actionId} settings`;

    await this._renderBody(actionId, def);
    this.root.hidden = false;

    // Place near anchor or center-ish.
    const margin = 12;
    const vw = window.innerWidth || 800;
    const vh = window.innerHeight || 600;
    const rect = opts.anchorRect;
    let left = rect ? rect.right + 10 : Math.round(vw * 0.5 - 120);
    let top = rect ? rect.top : Math.round(vh * 0.25);
    left = Math.max(margin, Math.min(left, vw - margin - 240));
    top = Math.max(margin, Math.min(top, vh - margin - 80));
    this.root.style.left = `${Math.round(left)}px`;
    this.root.style.top = `${Math.round(top)}px`;
    this.root.style.right = 'auto';
    this.root.style.bottom = 'auto';
  }

  close() {
    if (this.root) this.root.hidden = true;
    this.actionId = null;
  }

  isOpen() {
    return !!(this.root && !this.root.hidden);
  }

  /**
   * @param {string} actionId
   * @param {ActionSettingsDef} def
   */
  async _renderBody(actionId, def) {
    const panelRoot = this.shadowRoot || this.root?.shadowRoot || this.root;
    const body = panelRoot?.querySelector('.kp-action-config-panel__body');
    if (!body) return;
    body.replaceChildren();

    const action = await getOrCreateBuiltinFunctionUserAction(actionId);
    const storedParams = action?.parameters || {};
    const params = configPanelParameters(actionId);

    if (params.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kp-action-config-panel__empty';
      empty.textContent = 'No configurable parameters for this key.';
      body.appendChild(empty);
      return;
    }

    if (actionId === 'EXECUTE_JS') {
      const hint = document.createElement('div');
      hint.className = 'kp-action-config-panel__empty';
      hint.textContent = 'Bindings: kpHoveredClickable, kpHoverLeaf, kpFocusedTextField, kpMode, kpPageUrl, kpSelection, kpPriorResult. Callbacks are functions only when checked. See Keyboard Layout Config Inspector → docs icon, or Execute JS in KeyPilot Docs.';
      body.appendChild(hint);
    }

    for (const { group, params: groupParams } of groupFunctionParameters(params)) {
      if (group) {
        const heading = document.createElement('div');
        heading.className = 'kp-action-config-panel__label';
        heading.textContent = group;
        heading.style.fontWeight = '600';
        heading.style.marginTop = '8px';
        body.appendChild(heading);
      }
      for (const param of groupParams) {
      if (!shouldShowFunctionParameter(actionId, param)) continue;
      const row = document.createElement('div');
      row.className = 'kp-action-config-panel__row';

      const label = document.createElement('label');
      label.className = 'kp-action-config-panel__label';
      label.textContent = param.label || param.id;
      row.appendChild(label);

      const currentVal = storedParams[param.id] !== undefined
        ? storedParams[param.id]
        : param.defaultValue;

      let control;
      if (param.type === 'boolean') {
        control = document.createElement('input');
        control.type = 'checkbox';
        control.className = 'kp-action-config-panel__control';
        control.checked = !!currentVal;
        control.addEventListener('change', async () => {
          const next = await setActionParameter(actionId, param.id, !!control.checked);
          try { this.onSettingsChanged?.(next); } catch { /* ignore */ }
        });
      } else if (param.type === 'enum' && Array.isArray(param.options)) {
        control = document.createElement('select');
        control.className = 'kp-action-config-panel__control';
        const options = filterFunctionParameterOptions(actionId, param);
        for (const opt of options) {
          const o = document.createElement('option');
          o.value = opt.id;
          o.textContent = opt.label;
          if (opt.id === currentVal) o.selected = true;
          control.appendChild(o);
        }
        control.addEventListener('change', async () => {
          const next = await setActionParameter(actionId, param.id, control.value);
          try { this.onSettingsChanged?.(next); } catch { /* ignore */ }
        });
      } else if (param.type === 'number') {
        control = document.createElement('input');
        control.type = 'number';
        control.className = 'kp-action-config-panel__control';
        if (param.min != null) control.min = String(param.min);
        if (param.max != null) control.max = String(param.max);
        if (param.step != null) control.step = String(param.step);
        control.value = currentVal != null ? String(currentVal) : '';
        control.addEventListener('change', async () => {
          const n = Number(control.value);
          const next = await setActionParameter(actionId, param.id, Number.isFinite(n) ? n : param.defaultValue);
          try { this.onSettingsChanged?.(next); } catch { /* ignore */ }
        });
      } else if (param.multiline) {
        control = document.createElement('textarea');
        control.className = 'kp-action-config-panel__control';
        control.setAttribute('data-multiline', 'true');
        const rows = Number(param.rows);
        control.rows = Number.isFinite(rows) && rows > 0 ? rows : 3;
        if (param.placeholder) control.placeholder = String(param.placeholder);
        control.value = currentVal != null ? String(currentVal) : '';
        control.addEventListener('change', async () => {
          const next = await setActionParameter(actionId, param.id, control.value);
          try { this.onSettingsChanged?.(next); } catch { /* ignore */ }
        });
      } else {
        control = document.createElement('input');
        control.type = 'text';
        control.className = 'kp-action-config-panel__control';
        if (param.placeholder) control.placeholder = String(param.placeholder);
        control.value = currentVal != null ? String(currentVal) : '';
        control.addEventListener('change', async () => {
          const next = await setActionParameter(actionId, param.id, control.value);
          try { this.onSettingsChanged?.(next); } catch { /* ignore */ }
        });
      }

      row.appendChild(control);
      body.appendChild(row);
      }
    }
  }

  dispose() {
    try { this._dragApi?.dispose?.(); } catch { /* ignore */ }
    this._dragApi = null;
    try { this.root?.remove(); } catch { /* ignore */ }
    this.root = null;
    this.shadowRoot = null;
    this.actionId = null;
  }
}

/** Shared singleton used by keybindings popover. */
let _sharedConfigPanel = null;

/**
 * @returns {KeyActionConfigPanel}
 */
export function getSharedKeyActionConfigPanel() {
  if (!_sharedConfigPanel) {
    _sharedConfigPanel = new KeyActionConfigPanel();
  }
  return _sharedConfigPanel;
}
