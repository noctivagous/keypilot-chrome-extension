/**
 * Macro Key runtime — in-memory state + execution stubs.
 *
 * Chrome content scripts cannot reliably inject OS-level keystrokes. This module
 * owns the execution API and state (round-robin index, continuous loops) so the
 * UI and KeyPilot can call one place. Real input injection is TODO.
 */

import {
  formatKeyStroke,
  normalizeMacroKeyConfig,
  summarizeMacroKey
} from '../config/macro-keys.js';
import { macroKeyKindFromFunctionId } from '../config/function-library.js';
import { getUserMacroKeyById } from './keyboard-layout-store.js';

/** @type {Map<string, number>} */
const _roundRobinIndex = new Map();

/** @type {Map<string, { timerId: any, strokeLabel: string }>} */
const _continuousTimers = new Map();

/**
 * @param {import('../config/macro-keys.js').UserMacroKey} mk
 * @returns {string}
 */
function describe(mk) {
  return `${mk.label || mk.kind}: ${summarizeMacroKey(mk)}`;
}

/**
 * @param {string} macroKeyId
 * @param {{ notify?: (msg: string, type?: string) => void }} [opts]
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function runMacroKeyById(macroKeyId, opts = {}) {
  const id = String(macroKeyId || '');
  if (!id) return { ok: false, message: 'Missing macro key id.' };

  const mk = await getUserMacroKeyById(id);
  if (!mk) return { ok: false, message: 'Macro key not found.' };

  return runKeystrokeFunction(id, mk.kind, mk.config, opts);
}

/**
 * Run a keystroke-primitive Function (see `FUNCTION_ID_BY_MACRO_KEY_KIND` in
 * function-library.js) directly from a Function id + bound parameters, i.e. from a
 * `UserAction` Action Instance rather than a legacy `UserMacroKey` record.
 *
 * @param {string} instanceId Stable id used to key round-robin/continuous state.
 * @param {string} functionId
 * @param {Record<string, any>} parameters bound Action Instance parameters (`{ config }`)
 * @param {{ notify?: (msg: string, type?: string) => void }} [opts]
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function runLegacyMacroKeyFunction(instanceId, functionId, parameters, opts = {}) {
  const kind = macroKeyKindFromFunctionId(functionId);
  if (!kind) return { ok: false, message: `Unknown keystroke function: ${functionId}` };
  return runKeystrokeFunction(String(instanceId || functionId), kind, parameters?.config, opts);
}

/**
 * Shared execution switch for both legacy `UserMacroKey` records and the unified
 * Function+parameters path.
 * @param {string} id
 * @param {import('../config/macro-keys.js').MacroKeyKind} kind
 * @param {any} rawConfig
 * @param {{ notify?: (msg: string, type?: string) => void }} opts
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function runKeystrokeFunction(id, kind, rawConfig, opts) {
  const mk = { kind, config: rawConfig };
  const cfg = normalizeMacroKeyConfig(kind, rawConfig);
  let message = '';

  switch (kind) {
    case 'hotkey':
    case 'key': {
      message = `Macro Key (stub): would send ${formatKeyStroke(cfg.stroke)}`;
      break;
    }
    case 'burst': {
      const seq = (cfg.steps || []).map(formatKeyStroke).join(' → ');
      message = `Macro Key (stub): would burst ${seq} (gap ${cfg.gapMs}ms)`;
      break;
    }
    case 'roundRobin': {
      const items = Array.isArray(cfg.items) ? cfg.items : [];
      if (!items.length) {
        message = 'Macro Key: round robin has no items.';
        break;
      }
      const prev = _roundRobinIndex.get(id) || 0;
      const idx = prev % items.length;
      _roundRobinIndex.set(id, idx + 1);
      message = `Macro Key (stub): round robin [${idx + 1}/${items.length}] → ${formatKeyStroke(items[idx])}`;
      break;
    }
    case 'continuous': {
      if (_continuousTimers.has(id)) {
        try {
          clearInterval(_continuousTimers.get(id)?.timerId);
        } catch { /* ignore */ }
        _continuousTimers.delete(id);
        message = `Macro Key: continuous STOPPED (${formatKeyStroke(cfg.stroke)})`;
      } else {
        const strokeLabel = formatKeyStroke(cfg.stroke);
        const intervalMs = Number(cfg.intervalMs) || 50;
        // Placeholder interval — does not inject keys yet; keeps toggle state honest.
        const timerId = setInterval(() => {
          /* future: inject stroke */
        }, intervalMs);
        _continuousTimers.set(id, { timerId, strokeLabel });
        message = `Macro Key (stub): continuous STARTED ${strokeLabel} every ${intervalMs}ms — press again to stop`;
      }
      break;
    }
    case 'mouse': {
      message = `Macro Key (stub): would ${cfg.button}-click under cursor`;
      break;
    }
    default:
      message = `Macro Key (stub): ${describe(mk)}`;
  }

  try {
    opts.notify?.(message, 'info');
  } catch { /* ignore */ }

  return { ok: true, message };
}

/**
 * Stop all continuous macro keys (e.g. on disable / navigation).
 */
export function stopAllContinuousMacroKeys() {
  for (const [id, entry] of _continuousTimers.entries()) {
    try {
      clearInterval(entry?.timerId);
    } catch { /* ignore */ }
    _continuousTimers.delete(id);
  }
}

/**
 * @param {string} macroKeyId
 * @returns {boolean}
 */
export function isContinuousMacroKeyActive(macroKeyId) {
  return _continuousTimers.has(String(macroKeyId || ''));
}
