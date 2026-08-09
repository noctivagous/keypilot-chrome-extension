/**
 * Shared result destinations for Keyboard Layout Config procedures.
 *
 * Any Function / Macro Key that produces data can route it through `deliverActionResult` to the
 * clipboard, a result popover, back into the page, or (future) the Media Library / Scrapbook.
 *
 * See KEY_ACTION_ARCHITECTURE.md, "Data Acquisition & Result Destinations", for the full design
 * writeup — this module is the `ResultDestination` half of that split (the "where does the data
 * go" side; "what data was captured" is `dataSource`/`dataKind` on `FunctionDef`, see
 * function-library.js).
 */
import { COLORS } from '../config/constants.js';
import { showProcedureResultPopover } from '../ui/procedure-result-popover.js';

/**
 * `modifyPage` and `both` are historically/currently supported combinations; `mediaLibrary` and
 * `scrapbook` are reserved ids for sinks that don't exist yet (no delivery branch below handles
 * them — see KEY_ACTION_ARCHITECTURE.md).
 * @typedef {'clipboard'|'popover'|'both'|'modifyPage'|'mediaLibrary'|'scrapbook'} ActionResultDestination
 */

export const ACTION_RESULT_DESTINATIONS = Object.freeze({
  CLIPBOARD: 'clipboard',
  POPOVER: 'popover',
  BOTH: 'both',
  MODIFY_PAGE: 'modifyPage',
  MEDIA_LIBRARY: 'mediaLibrary',
  SCRAPBOOK: 'scrapbook'
});

/** Display labels for every known destination id, keyed the same as {@link ACTION_RESULT_DESTINATIONS}. */
const DESTINATION_LABELS = Object.freeze({
  [ACTION_RESULT_DESTINATIONS.CLIPBOARD]: 'Clipboard',
  [ACTION_RESULT_DESTINATIONS.POPOVER]: 'Popover',
  [ACTION_RESULT_DESTINATIONS.BOTH]: 'Clipboard and popover',
  [ACTION_RESULT_DESTINATIONS.MODIFY_PAGE]: 'Replace in page',
  [ACTION_RESULT_DESTINATIONS.MEDIA_LIBRARY]: 'Media Library (coming soon)',
  [ACTION_RESULT_DESTINATIONS.SCRAPBOOK]: 'Scrapbook (coming soon)'
});

/**
 * Build a `destination` parameter def scoped to only the destinations a given Function actually
 * supports (e.g. `TRANSLATE` offers `modifyPage`/`popover` but not `clipboard`; media-kind
 * Functions will offer `mediaLibrary` but not `modifyPage`). The first entry in
 * `applicableDestinations` is used as the default.
 *
 * Kept as a factory (rather than one shared frozen constant) because "which destinations make
 * sense" is a property of each Function, not universal — see KEY_ACTION_ARCHITECTURE.md.
 *
 * @param {ActionResultDestination[]} applicableDestinations
 * @returns {{ id: 'destination', label: string, type: 'enum', defaultValue: ActionResultDestination, options: Array<{ id: string, label: string }> }}
 */
export function buildResultDestinationParameter(applicableDestinations) {
  const ids = Array.isArray(applicableDestinations) && applicableDestinations.length
    ? applicableDestinations
    : [ACTION_RESULT_DESTINATIONS.CLIPBOARD];
  return Object.freeze({
    id: 'destination',
    label: 'Destination',
    type: 'enum',
    defaultValue: ids[0],
    options: Object.freeze(ids.map((id) => Object.freeze({ id, label: DESTINATION_LABELS[id] || id })))
  });
}

/**
 * @param {unknown} raw
 * @param {ActionResultDestination} [fallback='clipboard']
 * @returns {ActionResultDestination}
 */
export function normalizeActionResultDestination(raw, fallback = ACTION_RESULT_DESTINATIONS.CLIPBOARD) {
  const v = String(raw || '').trim();
  if (Object.prototype.hasOwnProperty.call(DESTINATION_LABELS, v)) {
    return /** @type {ActionResultDestination} */ (v);
  }
  return fallback;
}

/**
 * @param {ActionResultDestination} destination
 * @returns {{ clipboard: boolean, popover: boolean, modifyPage: boolean }}
 */
export function destinationFlags(destination) {
  const d = normalizeActionResultDestination(destination);
  return {
    clipboard: d === ACTION_RESULT_DESTINATIONS.CLIPBOARD || d === ACTION_RESULT_DESTINATIONS.BOTH,
    popover: d === ACTION_RESULT_DESTINATIONS.POPOVER || d === ACTION_RESULT_DESTINATIONS.BOTH,
    modifyPage: d === ACTION_RESULT_DESTINATIONS.MODIFY_PAGE
  };
}

/**
 * Deliver procedure output to the configured destination(s).
 *
 * `modifyPage` is the one destination that can't be implemented generically here: it needs to
 * know *where in the page* to write the result back to, which is caller-specific (a `Range`, a
 * specific element, etc.), not something this shared helper can infer from `text` alone. Callers
 * that support `modifyPage` (e.g. a future `TRANSLATE` Function) must pass `onModifyPage`; if the
 * resolved destination is `modifyPage` and no `onModifyPage` is given, this falls back to the
 * popover so the result is never silently dropped.
 *
 * @param {any} kp KeyPilot instance (needs copyToClipboard / showFlashNotification)
 * @param {{
 *   text: string,
 *   html?: string|null,
 *   title?: string,
 *   destination?: ActionResultDestination|string,
 *   successMessage?: string,
 *   onModifyPage?: (text: string) => (boolean|Promise<boolean>)
 * }} opts
 * @returns {Promise<{ clipboard: boolean, popover: boolean, modifyPage: boolean }>}
 */
export async function deliverActionResult(kp, opts = {}) {
  const text = String(opts.text ?? '');
  const flags = destinationFlags(opts.destination);
  const out = { clipboard: false, popover: false, modifyPage: false };

  if (flags.modifyPage) {
    if (typeof opts.onModifyPage === 'function') {
      try {
        out.modifyPage = !!(await opts.onModifyPage(text));
      } catch (e) {
        console.warn('[KeyPilot] onModifyPage handler failed:', e);
        out.modifyPage = false;
      }
    }
    if (!out.modifyPage) {
      // No page-write hook wired up (or it failed) — surface the result some other way rather
      // than losing it silently.
      flags.popover = true;
    }
  }

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
