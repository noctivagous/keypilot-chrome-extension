/**
 * Shared result destinations for Keyboard Layout Config procedures.
 *
 * Any Function / Macro Key that produces text can route output through
 * `deliverActionResult` to clipboard, a result popover, or both.
 */
import { COLORS } from '../config/constants.js';
import { showProcedureResultPopover } from '../ui/procedure-result-popover.js';

/** @typedef {'clipboard'|'popover'|'both'} ActionResultDestination */

export const ACTION_RESULT_DESTINATIONS = Object.freeze({
  CLIPBOARD: 'clipboard',
  POPOVER: 'popover',
  BOTH: 'both'
});

/**
 * Shared ActionSettingsRegistry parameter for result routing.
 * Reuse in any action that produces output.
 */
export const RESULT_DESTINATION_PARAMETER = Object.freeze({
  id: 'destination',
  label: 'Destination',
  type: 'enum',
  defaultValue: ACTION_RESULT_DESTINATIONS.CLIPBOARD,
  options: Object.freeze([
    Object.freeze({ id: ACTION_RESULT_DESTINATIONS.CLIPBOARD, label: 'Clipboard' }),
    Object.freeze({ id: ACTION_RESULT_DESTINATIONS.POPOVER, label: 'Popover' }),
    Object.freeze({ id: ACTION_RESULT_DESTINATIONS.BOTH, label: 'Clipboard and popover' })
  ])
});

/**
 * @param {unknown} raw
 * @param {ActionResultDestination} [fallback='clipboard']
 * @returns {ActionResultDestination}
 */
export function normalizeActionResultDestination(raw, fallback = ACTION_RESULT_DESTINATIONS.CLIPBOARD) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === ACTION_RESULT_DESTINATIONS.CLIPBOARD
    || v === ACTION_RESULT_DESTINATIONS.POPOVER
    || v === ACTION_RESULT_DESTINATIONS.BOTH) {
    return /** @type {ActionResultDestination} */ (v);
  }
  return fallback;
}

/**
 * @param {ActionResultDestination} destination
 * @returns {{ clipboard: boolean, popover: boolean }}
 */
export function destinationFlags(destination) {
  const d = normalizeActionResultDestination(destination);
  return {
    clipboard: d === ACTION_RESULT_DESTINATIONS.CLIPBOARD || d === ACTION_RESULT_DESTINATIONS.BOTH,
    popover: d === ACTION_RESULT_DESTINATIONS.POPOVER || d === ACTION_RESULT_DESTINATIONS.BOTH
  };
}

/**
 * Deliver procedure output to the configured destination(s).
 *
 * @param {any} kp KeyPilot instance (needs copyToClipboard / showFlashNotification)
 * @param {{
 *   text: string,
 *   html?: string|null,
 *   title?: string,
 *   destination?: ActionResultDestination|string,
 *   successMessage?: string
 * }} opts
 * @returns {Promise<{ clipboard: boolean, popover: boolean }>}
 */
export async function deliverActionResult(kp, opts = {}) {
  const text = String(opts.text ?? '');
  const flags = destinationFlags(opts.destination);
  const out = { clipboard: false, popover: false };

  if (flags.clipboard) {
    try {
      const payload = opts.html
        ? { plainText: text, htmlContent: String(opts.html), hasRichContent: true }
        : text;
      out.clipboard = !!(await kp?.copyToClipboard?.(payload));
    } catch {
      out.clipboard = false;
    }
    if (out.clipboard && typeof kp?.showFlashNotification === 'function') {
      try {
        kp.showFlashNotification(
          opts.successMessage || 'Copied to clipboard',
          COLORS.NOTIFICATION_SUCCESS
        );
      } catch { /* ignore */ }
    } else if (flags.clipboard && !out.clipboard && typeof kp?.showFlashNotification === 'function') {
      try {
        kp.showFlashNotification('Could not copy to clipboard', COLORS.NOTIFICATION_ERROR);
      } catch { /* ignore */ }
    }
  }

  if (flags.popover) {
    try {
      showProcedureResultPopover({
        title: opts.title || 'Result',
        text,
        html: opts.html || null,
        onCopy: async () => {
          try {
            const payload = opts.html
              ? { plainText: text, htmlContent: String(opts.html), hasRichContent: true }
              : text;
            return !!(await kp?.copyToClipboard?.(payload));
          } catch {
            return false;
          }
        }
      });
      out.popover = true;
    } catch (e) {
      console.warn('[KeyPilot] Failed to show result popover:', e);
      out.popover = false;
    }
  }

  return out;
}
