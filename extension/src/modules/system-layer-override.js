/**
 * Custom layouts seed Esc, Keyboard Reference, and Settings onto real keys, and
 * those keys can be replaced. While a user layout is current, an occupied slot
 * wins over the always-on system binding for that same key.
 */

import { getStockActionById, isStockActionId } from '../config/stock-actions.js';
import {
  characterSlotKeyForCharacter,
  physicalSlotKeyForCode
} from './keyboard-layout-store.js';

/**
 * @param {{ type?: string, id?: string }|null|undefined} assigned
 * @param {string} actionId
 * @param {Array<{ id?: string, functionId?: string }>|null|undefined} actions
 * @returns {boolean}
 */
function slotIsSystemAction(assigned, actionId, actions) {
  if (!assigned || assigned.type !== 'function') return false;
  const id = String(assigned.id || '');
  if (!id || !actionId) return false;
  if (id === actionId) return true;
  if (id.startsWith('action:')) {
    const instance = (actions || []).find((action) => action && action.id === id);
    return !!(instance && instance.functionId === actionId);
  }
  if (isStockActionId(id)) {
    const stock = getStockActionById(id);
    return !!(stock && stock.functionId === actionId);
  }
  return false;
}

/**
 * True when the current user layout owns this key, so the system binding must not run.
 * A missing slot key leaves the system binding in place. An empty slot claims the key.
 *
 * @param {{
 *   slots?: Record<string, { type?: string, id?: string }|null>|null,
 *   actions?: Array<{ id?: string, functionId?: string }>|null,
 *   code?: string,
 *   key?: string,
 *   actionId?: string
 * }} params
 * @returns {boolean}
 */
export function userLayoutClaimsKeyOverSystem(params) {
  const slots = params?.slots;
  const actionId = String(params?.actionId || '');
  if (!slots || typeof slots !== 'object' || !actionId) return false;

  const physicalSlot = physicalSlotKeyForCode(params?.code);
  const characterSlot = characterSlotKeyForCharacter(params?.key);
  let slotKey = '';
  if (physicalSlot && Object.prototype.hasOwnProperty.call(slots, physicalSlot)) {
    slotKey = physicalSlot;
  } else if (characterSlot && Object.prototype.hasOwnProperty.call(slots, characterSlot)) {
    slotKey = characterSlot;
  } else {
    return false;
  }

  return !slotIsSystemAction(slots[slotKey], actionId, params?.actions);
}
