/**
 * Number-row keys for the optional Deferred opening feature.
 * Built-in browsing layouts gain these only while the feature is on.
 * User layouts keep whatever is already in the slot until the user agrees.
 */

export const DEFERRED_NUMBER_ROW_SLOTS = Object.freeze([
  Object.freeze({
    code: 'Digit1',
    slot: 'code:Digit1',
    actionId: 'ACTIVATE_DEFERRED_RANDOM',
    label: '1'
  }),
  Object.freeze({
    code: 'Digit2',
    slot: 'code:Digit2',
    actionId: 'ACTIVATE_DEFERRED_SCHEDULED',
    label: '2'
  }),
  Object.freeze({
    code: 'Digit4',
    slot: 'code:Digit4',
    actionId: 'SCHEDULE_LINK_MANUAL',
    label: '4'
  })
]);

/**
 * @param {any} assigned
 * @param {string} actionId
 * @returns {boolean}
 */
function slotHoldsAction(assigned, actionId) {
  return !!(
    assigned
    && assigned.type === 'function'
    && String(assigned.id || '') === actionId
  );
}

/**
 * @param {any} slots
 * @returns {{
 *   conflicts: Array<{ code: string, slot: string, actionId: string, label: string, current: { type: string, id: string } }>,
 *   needsWrite: boolean
 * }}
 */
export function inspectDeferredNumberRowSlots(slots) {
  const map = slots && typeof slots === 'object' ? slots : {};
  /** @type {Array<{ code: string, slot: string, actionId: string, label: string, current: { type: string, id: string } }>} */
  const conflicts = [];
  let needsWrite = false;
  for (const spec of DEFERRED_NUMBER_ROW_SLOTS) {
    const assigned = map[spec.slot];
    if (!assigned || !assigned.type || !assigned.id) {
      needsWrite = true;
      continue;
    }
    if (slotHoldsAction(assigned, spec.actionId)) continue;
    needsWrite = true;
    conflicts.push({
      code: spec.code,
      slot: spec.slot,
      actionId: spec.actionId,
      label: spec.label,
      current: { type: String(assigned.type), id: String(assigned.id) }
    });
  }
  return { conflicts, needsWrite };
}

/**
 * @param {any} slots
 * @returns {Record<string, { type: 'function', id: string }|null>}
 */
export function applyDeferredNumberRowSlots(slots) {
  const next = { ...(slots && typeof slots === 'object' ? slots : {}) };
  for (const spec of DEFERRED_NUMBER_ROW_SLOTS) {
    next[spec.slot] = { type: 'function', id: spec.actionId };
  }
  return next;
}

/**
 * Clear 1, 2, and 4 only when they still hold the deferred actions.
 * @param {any} slots
 * @returns {Record<string, any>}
 */
export function clearDeferredNumberRowSlots(slots) {
  const next = { ...(slots && typeof slots === 'object' ? slots : {}) };
  for (const spec of DEFERRED_NUMBER_ROW_SLOTS) {
    if (slotHoldsAction(next[spec.slot], spec.actionId)) next[spec.slot] = null;
  }
  return next;
}
