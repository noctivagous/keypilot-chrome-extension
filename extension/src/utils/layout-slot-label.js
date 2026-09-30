/**
 * Human-readable labels for layout slot keys (`code:KeyQ`, `key:ñ`, `CHORD:…`).
 * Stored slot ids stay prefixed; only paint/copy uses these labels.
 */
import { localizeKeycapLabel } from './i18n.js';
import { getKeyboardHardwareLayout } from '../config/keyboard-hardware-layouts.js';
import {
  CHARACTER_SLOT_PREFIX,
  physicalCodeFromSlotKey
} from '../modules/keyboard-layout-store.js';
import { formatChordSlotKeyLabel, isChordSlotKey } from './key-chord.js';

/**
 * @param {string} code DOM `KeyboardEvent.code` (e.g. KeyQ)
 * @param {string} [hardwareLayoutId]
 * @returns {string}
 */
export function legendForPhysicalCode(code, hardwareLayoutId) {
  const raw = String(code || '');
  if (!raw) return '';
  const hw = getKeyboardHardwareLayout(hardwareLayoutId);
  for (const row of hw?.rows || []) {
    for (const key of row.keys || []) {
      if (key.code === raw) return localizeKeycapLabel(key.legends?.base || raw);
    }
  }
  if (/^Key[A-Z]$/.test(raw)) return raw.slice(3);
  if (/^Digit[0-9]$/.test(raw)) return raw.slice(5);
  return localizeKeycapLabel(raw);
}

/**
 * @param {string} slotKey
 * @param {string} [hardwareLayoutId]
 * @returns {string}
 */
export function formatLayoutSlotKeyLabel(slotKey, hardwareLayoutId) {
  const raw = String(slotKey || '');
  if (!raw) return '';
  if (isChordSlotKey(raw)) return formatChordSlotKeyLabel(raw);
  const code = physicalCodeFromSlotKey(raw);
  if (code) return legendForPhysicalCode(code, hardwareLayoutId) || code;
  if (raw.startsWith(CHARACTER_SLOT_PREFIX)) {
    return raw.slice(CHARACTER_SLOT_PREFIX.length);
  }
  return raw;
}
