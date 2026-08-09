/**
 * Per-action settings registry + floating config panel for Keyboard Reference keys.
 *
 * Keys declare optional modes / parameters here. The sticky key popover reads the
 * registry to render mode switches and a Config button that opens a draggable panel.
 *
 * Shared result destinations (clipboard / popover / both) live in
 * `action-result-delivery.js` and are reused by AI and future procedures.
 */
import { Z_INDEX, KP_UI_FONT } from '../config/constants.js';
import { getSettings, setSettings } from '../modules/settings-manager.js';
import { makePanelDraggable } from '../utils/panel-position.js';
import { RESULT_DESTINATION_PARAMETER } from '../modules/action-result-delivery.js';

/**
 * @typedef {{ id: string, label: string }} ActionModeOption
 * @typedef {{
 *   id: string,
 *   label: string,
 *   type: 'boolean'|'number'|'string'|'enum',
 *   defaultValue?: any,
 *   options?: Array<{ id: string, label: string }>,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   multiline?: boolean,
 *   placeholder?: string
 * }} ActionParameterDef
 * @typedef {{
 *   modes?: ActionModeOption[],
 *   defaultMode?: string,
 *   parameters?: ActionParameterDef[]
 * }} ActionSettingsDef
 */

/** Re-export for callers that configure procedure destinations. */
export { RESULT_DESTINATION_PARAMETER };

/** @type {Readonly<Record<string, ActionSettingsDef>>} */
export const ACTION_SETTINGS_REGISTRY = Object.freeze({
  RECTANGLE_HIGHLIGHT: Object.freeze({
    modes: Object.freeze([
      Object.freeze({ id: 'element', label: 'Element rectangle' }),
      Object.freeze({ id: 'cumulative', label: 'Pick cumulative' })
    ]),
    defaultMode: 'element',
    parameters: Object.freeze([])
  }),
  SEND_TEXT_TO_AI: Object.freeze({
    parameters: Object.freeze([
      Object.freeze({
        id: 'prompt',
        label: 'Instruction',
        type: 'string',
        multiline: true,
        defaultValue: 'Translate to English',
        placeholder: 'e.g. Translate to English'
      }),
      RESULT_DESTINATION_PARAMETER
    ])
  })
});

/**
 * @param {string} actionId
 * @returns {ActionSettingsDef|null}
 */
export function getActionSettingsDef(actionId) {
  if (!actionId) return null;
  return ACTION_SETTINGS_REGISTRY[actionId] || null;
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
 * @param {string} actionId
 * @returns {boolean}
 */
export function actionHasParameters(actionId) {
  const def = getActionSettingsDef(actionId);
  return !!(def?.parameters && def.parameters.length > 0);
}

/**
 * @param {Record<string, any>|null|undefined} actionSettings
 * @param {string} actionId
 * @returns {string}
 */
export function getActionMode(actionSettings, actionId) {
  const def = getActionSettingsDef(actionId);
  const fallback = def?.defaultMode || (def?.modes?.[0]?.id) || 'element';
  const stored = actionSettings?.[actionId]?.mode;
  if (typeof stored === 'string' && def?.modes?.some((m) => m.id === stored)) {
    return stored;
  }
  return fallback;
}

/**
 * Read a stored parameter with registry default fallback.
 * @param {Record<string, any>|null|undefined} actionSettings
 * @param {string} actionId
 * @param {string} paramId
 * @returns {any}
 */
export function getActionParameter(actionSettings, actionId, paramId) {
  const def = getActionSettingsDef(actionId);
  const paramDef = def?.parameters?.find((p) => p && p.id === paramId) || null;
  const stored = actionSettings?.[actionId]?.parameters?.[paramId];
  if (stored !== undefined) return stored;
  return paramDef ? paramDef.defaultValue : undefined;
}

/**
 * Persist a mode for an action id.
 * @param {string} actionId
 * @param {string} modeId
 * @returns {Promise<import('../modules/settings-manager.js').KeyPilotSettings>}
 */
export async function setActionMode(actionId, modeId) {
  const def = getActionSettingsDef(actionId);
  if (!def?.modes?.some((m) => m.id === modeId)) {
    throw new Error(`Unknown mode ${modeId} for action ${actionId}`);
  }
  const current = await getSettings();
  const prevAction = (current.actionSettings && current.actionSettings[actionId]) || {};
  return setSettings({
    actionSettings: {
      ...(current.actionSettings || {}),
      [actionId]: {
        ...prevAction,
        mode: modeId
      }
    }
  });
}

/**
 * Persist a single parameter value for an action.
 * @param {string} actionId
 * @param {string} paramId
 * @param {any} value
 */
export async function setActionParameter(actionId, paramId, value) {
  const current = await getSettings();
  const prevAction = (current.actionSettings && current.actionSettings[actionId]) || {};
  const prevParams = (prevAction.parameters && typeof prevAction.parameters === 'object')
    ? prevAction.parameters
    : {};
  return setSettings({
    actionSettings: {
      ...(current.actionSettings || {}),
      [actionId]: {
        ...prevAction,
        parameters: {
          ...prevParams,
          [paramId]: value
        }
      }
    }
  });
}

const CONFIG_PANEL_STYLE_ATTR = 'data-kp-action-config-style';

function ensureConfigPanelStyles(doc) {
  if (!doc?.head) return;
  let style = doc.head.querySelector(`style[${CONFIG_PANEL_STYLE_ATTR}]`);
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute(CONFIG_PANEL_STYLE_ATTR, 'true');
    doc.head.appendChild(style);
  }
  style.textContent = `
.kp-action-config-panel {
  position: fixed;
  z-index: ${Z_INDEX.KEY_ACTION_CONFIG || (Z_INDEX.KEYBINDINGS_POPOVER + 1)};
  min-width: 240px;
  max-width: min(360px, calc(100vw - 24px));
  color: rgba(248, 250, 252, 0.95);
  font-family: ${KP_UI_FONT};
  font-size: 12px;
  line-height: 1.4;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.45);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%),
    linear-gradient(180deg, #3a4150 0%, #2c313e 100%);
  box-shadow:
    0 1px 0 rgba(0,0,0,0.4),
    0 14px 32px rgba(0,0,0,0.45);
  box-sizing: border-box;
}
.kp-action-config-panel[hidden] { display: none !important; }
.kp-action-config-panel__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid rgba(0,0,0,0.35);
}
.kp-action-config-panel__title {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
}
.kp-action-config-panel__close {
  appearance: none;
  border: 0;
  background: rgba(0,0,0,0.25);
  color: inherit;
  width: 22px;
  height: 22px;
  border-radius: 6px;
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
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.4);
  background: rgba(0,0,0,0.22);
  color: inherit;
  padding: 6px 8px;
  font: inherit;
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
`;
}

/**
 * Floating, draggable parameter editor for a single action.
 */
export class KeyActionConfigPanel {
  constructor() {
    /** @type {HTMLElement|null} */
    this.root = null;
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
    ensureConfigPanelStyles(doc);
    this.actionId = actionId;

    if (!this.root) {
      this.root = doc.createElement('div');
      this.root.className = 'kp-action-config-panel';
      this.root.setAttribute('role', 'dialog');
      this.root.innerHTML = `
        <div class="kp-action-config-panel__titlebar" data-kp-config-drag="true">
          <div class="kp-action-config-panel__title"></div>
          <button type="button" class="kp-action-config-panel__close" aria-label="Close">×</button>
        </div>
        <div class="kp-action-config-panel__body"></div>
      `;
      doc.body.appendChild(this.root);

      const closeBtn = this.root.querySelector('.kp-action-config-panel__close');
      closeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      });

      const handle = this.root.querySelector('[data-kp-config-drag="true"]');
      this._dragApi = makePanelDraggable(this.root, handle, {
        excludeSelector: '.kp-action-config-panel__close'
      });
    }

    const titleEl = this.root.querySelector('.kp-action-config-panel__title');
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
    const body = this.root?.querySelector('.kp-action-config-panel__body');
    if (!body) return;
    body.replaceChildren();

    const settings = await getSettings();
    const storedParams = settings?.actionSettings?.[actionId]?.parameters || {};
    const params = Array.isArray(def.parameters) ? def.parameters : [];

    if (params.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kp-action-config-panel__empty';
      empty.textContent = 'No configurable parameters for this key.';
      body.appendChild(empty);
      return;
    }

    for (const param of params) {
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
        for (const opt of param.options) {
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
        control.rows = 3;
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

  dispose() {
    try { this._dragApi?.dispose?.(); } catch { /* ignore */ }
    this._dragApi = null;
    try { this.root?.remove(); } catch { /* ignore */ }
    this.root = null;
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
