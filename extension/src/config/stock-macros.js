/**
 * Built-in (stock) macros — read-only catalog.
 * Editing/saving forks a user macro with `baseStockMacroId` (same product rule as
 * builtin keyboard layouts → user layouts). See KEY_ACTION_ARCHITECTURE.md.
 */

import { getFunctionDef } from './function-library.js';

export const STOCK_MACRO_ID_PREFIX = 'stock:';

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   icon?: string,
 *   steps: import('../modules/keyboard-layout-store.js').MacroStep[]
 * }} StockMacro
 */

/** @type {ReadonlyArray<StockMacro>} */
export const STOCK_MACROS = Object.freeze([
  Object.freeze({
    id: `${STOCK_MACRO_ID_PREFIX}ai-assist-flow`,
    label: 'AI Assist Flow',
    icon: 'placeholder',
    steps: Object.freeze([
      Object.freeze({ kind: 'function', functionId: 'HIGHLIGHT', parameters: {} }),
      Object.freeze({ kind: 'wait', ms: 80 }),
      Object.freeze({ kind: 'function', functionId: 'CLIPBOARD_COPY', parameters: {} }),
      Object.freeze({ kind: 'function', functionId: 'OPEN_POPOVER', parameters: {} })
    ])
  }),
  Object.freeze({
    id: `${STOCK_MACRO_ID_PREFIX}quick-nav`,
    label: 'Quick Nav',
    icon: 'placeholder',
    steps: Object.freeze([
      Object.freeze({ kind: 'function', functionId: 'PAGE_DOWN_INSTANT', parameters: {}, delayMsBefore: 0 }),
      Object.freeze({ kind: 'function', functionId: 'TAB_RIGHT', parameters: {}, delayMsBefore: 50 })
    ])
  }),
  Object.freeze({
    id: `${STOCK_MACRO_ID_PREFIX}clip-search`,
    label: 'Clip & Search',
    icon: 'placeholder',
    steps: Object.freeze([
      Object.freeze({ kind: 'function', functionId: 'CLIPBOARD_COPY', parameters: {} }),
      Object.freeze({ kind: 'gate', op: 'truthy', left: 'prior', thenSkip: 1 }),
      Object.freeze({ kind: 'function', functionId: 'OMNIBOX', parameters: {} })
    ])
  })
]);

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isStockMacroId(id) {
  return String(id || '').startsWith(STOCK_MACRO_ID_PREFIX);
}

/**
 * @param {string} id
 * @returns {StockMacro|null}
 */
export function getStockMacroById(id) {
  const key = String(id || '');
  const found = STOCK_MACROS.find((m) => m.id === key);
  return found || null;
}

/**
 * @returns {StockMacro[]}
 */
export function listStockMacros() {
  return STOCK_MACROS.map((m) => ({
    id: m.id,
    label: m.label,
    icon: m.icon,
    steps: m.steps.map((s) => ({ ...s, parameters: s.parameters ? { ...s.parameters } : undefined }))
  }));
}

/**
 * Resolve a macro id from user store or stock catalog.
 * @param {string} id
 * @param {Array<{ id: string, label?: string, steps?: any[] }>|null|undefined} userMacros
 * @returns {{ id: string, label: string, steps: any[], stock?: boolean, baseStockMacroId?: string }|null}
 */
export function resolveMacroById(id, userMacros) {
  const key = String(id || '');
  if (!key) return null;
  const users = Array.isArray(userMacros) ? userMacros : [];
  const user = users.find((m) => m && m.id === key);
  if (user) {
    return {
      id: user.id,
      label: String(user.label || 'Macro'),
      steps: Array.isArray(user.steps) ? user.steps : [],
      stock: false,
      baseStockMacroId: user.baseStockMacroId
    };
  }
  const stock = getStockMacroById(key);
  if (!stock) return null;
  return {
    id: stock.id,
    label: stock.label,
    steps: stock.steps.map((s) => ({ ...s })),
    stock: true
  };
}

/**
 * Drop stock steps whose Function ids are unknown (defensive).
 * @param {StockMacro} macro
 * @returns {boolean}
 */
export function stockMacroStepsAreValid(macro) {
  for (const step of macro.steps || []) {
    if (step.kind === 'function' || (!step.kind && step.functionId)) {
      if (!getFunctionDef(step.functionId)) return false;
    }
  }
  return true;
}
