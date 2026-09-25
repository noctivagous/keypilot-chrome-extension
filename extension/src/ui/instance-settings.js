/**
 * Shared Action Instance settings: name field plus schema-driven parameters.
 * The pinned key-info popover uses this. Other hosts can mount the same form.
 */

import { getFunctionDef } from '../config/function-library.js';
import {
  BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META,
  inferFamilyAndHandednessFromLayoutId,
  nextUserCopyLayoutLabel,
  normalizeKeyboardLayoutFamilyId
} from '../config/keyboard-layouts.js';
import { getStockActionById, isStockActionId } from '../config/stock-actions.js';
import { appendActionConfigFields } from '../modules/action-config-binder.js';
import { createActionConfigController } from '../modules/action-config-controller.js';
import {
  createUserAction,
  duplicateBuiltinLayoutToUserLayout,
  getUserActionById,
  listUserActions,
  listUserKeyboardLayouts,
  physicalSlotKeyForCode,
  upsertUserAction,
  upsertUserKeyboardLayout
} from '../modules/keyboard-layout-store.js';
import { getMessage } from '../utils/i18n.js';

/**
 * @param {HTMLElement} host
 * @param {{
 *   functionDef: import('../config/function-library.js').FunctionDef,
 *   instance: { id?: string, label?: string, parameters?: Record<string, any> },
 *   onDraft?: (draft: { label: string, parameters: Record<string, any> }) => void
 * }} args
 */
export function renderInstanceSettingsForm(host, { functionDef, instance, onDraft }) {
  if (!host || !functionDef) return;
  const doc = host.ownerDocument || document;
  host.replaceChildren();

  const parameters = { ...(instance?.parameters || {}) };
  if (Array.isArray(parameters.urls)) parameters.urls = parameters.urls.slice();

  const draft = {
    label: String(instance?.label || ''),
    parameters
  };
  const emit = () => {
    onDraft?.({
      label: draft.label,
      parameters: { ...draft.parameters }
    });
  };

  const nameRow = doc.createElement('div');
  nameRow.className = 'kp-popover-setting-row';
  const nameLabel = doc.createElement('div');
  nameLabel.className = 'kp-popover-setting-label';
  nameLabel.textContent = getMessage('fn_instance_name_label') || 'Name';
  const nameInput = doc.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'kp-popover-field';
  nameInput.value = draft.label;
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameInput.setAttribute('aria-label', nameLabel.textContent);
  nameInput.addEventListener('input', () => {
    draft.label = nameInput.value;
    emit();
  });
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  host.appendChild(nameRow);

  const controller = createActionConfigController();
  controller.load({
    functionId: functionDef.id,
    snapshot: draft.parameters,
    parameters: functionDef.parameters,
    persist: (_functionId, paramId, value) => {
      draft.parameters = { ...draft.parameters, [paramId]: value };
      emit();
    }
  });
  appendActionConfigFields(host, {
    controller,
    live: true,
    classes: {
      row: 'kp-popover-setting-row',
      label: 'kp-popover-setting-label',
      control: 'kp-popover-field'
    }
  });
}

/**
 * @param {string} builtinLayoutId
 * @returns {string}
 */
function familyBaseLabel(builtinLayoutId) {
  try {
    const inferred = inferFamilyAndHandednessFromLayoutId(builtinLayoutId);
    const familyId = normalizeKeyboardLayoutFamilyId(inferred.familyId || 'browsing');
    const meta = (BUILTIN_KEYBOARD_LAYOUT_FAMILIES_META || []).find((m) => m && m.id === familyId);
    return getMessage(
      familyId === 'basic-navigation'
        ? 'layout_family_basic_navigation_label'
        : (meta?.labelKey || 'layout_family_browsing_label')
    ) || 'Browsing';
  } catch {
    return getMessage('layout_family_browsing_label') || 'Browsing';
  }
}

/**
 * @param {any} kp
 * @param {HTMLElement|null} keyEl
 * @param {string} toId
 * @param {string} fromId
 * @returns {Promise<boolean>}
 */
async function retargetInstanceSlot(kp, keyEl, toId, fromId) {
  if (!kp || !toId) return false;
  const code = keyEl?.dataset?.kpPhysicalCode || '';
  const slotKey = keyEl?.dataset?.kpSlot || (code ? physicalSlotKeyForCode(code) : '');
  const sel = String(kp._currentKeyboardLayoutId || '');
  let layout = null;
  if (sel.startsWith('user:') && kp._currentUserLayout && `user:${kp._currentUserLayout.id}` === sel) {
    layout = kp._currentUserLayout;
  } else {
    const builtinLayoutId = kp._keyboardLayoutId || 'browsing-right';
    const layouts = await listUserKeyboardLayouts();
    const label = nextUserCopyLayoutLabel(familyBaseLabel(builtinLayoutId), layouts);
    layout = await duplicateBuiltinLayoutToUserLayout({ builtinLayoutId, label });
  }
  if (!layout) return false;

  const slots = { ...(layout.slots || {}) };
  if (slotKey) {
    slots[slotKey] = { type: 'function', id: toId };
  } else {
    let found = false;
    for (const [key, value] of Object.entries(slots)) {
      if (value && value.type === 'function' && value.id === fromId) {
        slots[key] = { type: 'function', id: toId };
        found = true;
      }
    }
    if (!found) return false;
  }

  const savedLayout = await upsertUserKeyboardLayout({ ...layout, slots });
  const actions = await listUserActions();
  if (typeof kp.applyLiveUserLayout === 'function') {
    await kp.applyLiveUserLayout(savedLayout, {
      setAsCurrent: true,
      actions,
      macros: kp._currentUserMacros,
      rerender: false
    });
  }
  try { await kp.floatingKeyboardHelp?._refreshLayoutSelectOptions?.(); } catch { /* ignore */ }
  return true;
}

/**
 * Persist a name / parameter edit.
 * A bundled stock instance is forked into a UserAction and the key slot is retargeted.
 * Built-in layouts are duplicated first so the catalog instance stays unchanged.
 *
 * @param {{
 *   getKeyPilot?: () => any,
 *   instanceId: string,
 *   functionId: string,
 *   label: string,
 *   parameters: Record<string, any>,
 *   keyEl?: HTMLElement|null
 * }} args
 * @returns {Promise<import('../modules/keyboard-layout-store.js').UserAction|null>}
 */
export async function commitInstanceSettings({
  getKeyPilot,
  instanceId,
  functionId,
  label,
  parameters,
  keyEl
}) {
  const kp = typeof getKeyPilot === 'function' ? getKeyPilot() : null;
  if (isStockActionId(instanceId)) {
    const stock = getStockActionById(instanceId);
    if (!stock || !kp) return null;
    const created = await createUserAction({
      functionId: stock.functionId,
      label: label || stock.label,
      parameters
    });
    if (!created) return null;
    const rebound = await retargetInstanceSlot(kp, keyEl || null, created.id, stock.id);
    if (!rebound) return null;
    return created;
  }

  const saved = await upsertUserAction({
    id: instanceId,
    functionId,
    label,
    parameters
  });
  if (saved && kp) {
    try {
      const actions = await listUserActions();
      kp._currentUserActions = actions;
      if (kp.floatingKeyboardHelp) kp.floatingKeyboardHelp._currentUserActions = actions;
    } catch { /* ignore */ }
  }
  return saved;
}

/**
 * Instance id stamped on the key, or the action id when that id is itself an instance.
 * @param {HTMLElement|null|undefined} keyEl
 * @param {string} actionId
 * @returns {string}
 */
export function instanceIdForKey(keyEl, actionId) {
  const fromData = keyEl?.dataset?.kpInstanceId || '';
  if (fromData) return fromData;
  const id = String(actionId || '');
  if (isStockActionId(id) || id.startsWith('action:')) return id;
  return '';
}

/**
 * Resolve the Action Instance behind a keycap, if it has one.
 * @param {HTMLElement|null|undefined} keyEl
 * @param {string} actionId
 * @returns {Promise<{ id: string, functionId: string, label: string, parameters: Record<string, any> }|null>}
 */
export async function resolveKeyInstance(keyEl, actionId) {
  const fromData = keyEl?.dataset?.kpInstanceId || '';
  const instanceId = fromData
    || (isStockActionId(actionId) || String(actionId || '').startsWith('action:') ? actionId : '');
  if (!instanceId) return null;

  const stock = getStockActionById(instanceId);
  if (stock) {
    const def = getFunctionDef(stock.functionId);
    return {
      id: stock.id,
      functionId: stock.functionId,
      label: String(stock.label || def?.label || ''),
      parameters: { ...(stock.parameters || {}) }
    };
  }

  if (!String(instanceId).startsWith('action:')) return null;
  const action = await getUserActionById(instanceId);
  if (!action) return null;
  return {
    id: action.id,
    functionId: action.functionId,
    label: String(action.label || ''),
    parameters: { ...(action.parameters || {}) }
  };
}
