/**
 * Pointer → Function bindings.
 *
 * Keys assign Functions via layouts/slots. Mouse buttons can assign the same
 * Functions through `FunctionDef.pointerBinding` (see function-library.js),
 * gated by a settings path so the mapping is optional and OS-defaulted.
 */

import { listPointerBoundFunctionDefs } from '../config/function-library.js';

/**
 * @param {MouseEvent|PointerEvent|null|undefined} e
 * @returns {'left'|'middle'|'right'|null}
 */
export function pointerButtonName(e) {
  if (!e || typeof e.button !== 'number') return null;
  if (e.button === 0) return 'left';
  if (e.button === 1) return 'middle';
  if (e.button === 2) return 'right';
  return null;
}

/**
 * @param {any} settings
 * @param {string|null|undefined} path  e.g. `scroll.middleClickScrollLine`
 * @returns {any}
 */
export function readSettingsPath(settings, path) {
  const s = String(path || '');
  if (!s) return undefined;
  let cur = settings;
  for (const part of s.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * First Function whose pointerBinding matches this event and is enabled in settings.
 * @param {MouseEvent|PointerEvent|null|undefined} e
 * @param {any} settings
 * @returns {import('../config/function-library.js').FunctionDef|null}
 */
export function matchPointerFunctionDef(e, settings) {
  const button = pointerButtonName(e);
  if (!button) return null;
  for (const def of listPointerBoundFunctionDefs()) {
    const b = def?.pointerBinding;
    if (!b || b.button !== button) continue;
    if (b.enabledSetting && !readSettingsPath(settings, b.enabledSetting)) continue;
    return def;
  }
  return null;
}
