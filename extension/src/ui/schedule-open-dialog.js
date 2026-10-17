/**
 * Modal dialog that lets the user pick an exact local date and time for a
 * deferred Open URLs / Random Bookmark action. Mounted through PopupManager.
 *
 * The dialog only collects and validates the time; the caller owns scheduling.
 * Cancel, Escape, backdrop click, and invalid input never call `onSubmit`.
 */

import { getMessage } from '../utils/i18n.js';
import {
  defaultManualFireAt,
  formatDateTimeLocalValue,
  isValidManualFireAt,
  parseDateTimeLocalValue,
  tomorrowMorningFireAt
} from '../utils/deferred-open.js';
import {
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_TITLEBAR_GRADIENT
} from './nct-dark-ui.js';
import { ensureOpenChromeShadow, injectChromeStyles } from './kp-chrome-shadow.js';

export const SCHEDULE_OPEN_DIALOG_ID = 'kp-schedule-open-dialog';

const STYLE_ATTR = 'data-kp-schedule-open-styles';

const CSS = `
  .kp-sod-header {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255,140,0,0.14);
    background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
    font-size: 14px;
    font-weight: 700;
  }
  .kp-sod-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px 6px;
  }
  .kp-sod-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,140,0,0.85);
  }
  .kp-sod-input-row {
    display: flex;
    align-items: stretch;
    gap: 6px;
  }
  .kp-sod-input {
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    padding: 8px 10px;
    border-radius: ${NCT_DARK_UI_BTN_RADIUS};
    border: ${NCT_DARK_UI_BTN_BORDER};
    background: rgba(0,0,0,0.3);
    color: ${NCT_DARK_UI_COLORS.fg};
    font: inherit;
    font-size: 14px;
    color-scheme: dark;
  }
  .kp-sod-input::-webkit-calendar-picker-indicator {
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
  }
  .kp-sod-input::-webkit-calendar-picker-indicator:hover {
    background: rgba(255,255,255,0.15);
  }
  .kp-sod-picker-btn {
    margin: 0;
    flex: 0 0 auto;
    width: 38px;
    padding: 0;
    border-radius: ${NCT_DARK_UI_BTN_RADIUS};
    border: ${NCT_DARK_UI_BTN_BORDER};
    background: ${NCT_DARK_UI_BTN_GRADIENT};
    color: ${NCT_DARK_UI_COLORS.fg};
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }
  .kp-sod-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
  }
  .kp-sod-chip {
    margin: 0;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.06);
    color: ${NCT_DARK_UI_COLORS.fg};
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .kp-sod-chip:hover,
  .kp-sod-chip:focus-visible {
    background: rgba(255,140,0,0.22);
    border-color: rgba(255,140,0,0.55);
  }
  .kp-sod-input:focus-visible,
  .kp-sod-picker-btn:focus-visible,
  .kp-sod-chip:focus-visible,
  .kp-sod-btn:focus-visible {
    outline: 2px solid rgba(255,140,0,0.85);
    outline-offset: 1px;
  }
  .kp-sod-error {
    min-height: 16px;
    font-size: 12px;
    color: #ff8a80;
  }
  .kp-sod-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 16px 14px;
  }
  .kp-sod-btn {
    margin: 0;
    padding: 7px 14px;
    border-radius: ${NCT_DARK_UI_BTN_RADIUS};
    border: ${NCT_DARK_UI_BTN_BORDER};
    background: ${NCT_DARK_UI_BTN_GRADIENT};
    color: ${NCT_DARK_UI_COLORS.fg};
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .kp-sod-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

/**
 * @param {string} action `OPEN_URLS` or `RANDOM_BOOKMARK`
 * @returns {string}
 */
function titleForAction(action) {
  return getMessage(
    action === 'OPEN_URLS'
      ? 'deferred_open_dialog_title_open_urls'
      : 'deferred_open_dialog_title_random_bookmarks'
  );
}

export class ScheduleOpenDialog {
  /**
   * @param {{ popupManager?: any, now?: () => number }} [opts]
   */
  constructor({ popupManager = null, now = () => Date.now() } = {}) {
    this.popupManager = popupManager;
    this._now = now;
    this._open = false;
    this._panel = null;
  }

  isOpen() {
    return this._open;
  }

  /**
   * @param {{ action: string, onSubmit: (fireAt: number) => void }} params
   * @returns {boolean} true when the dialog was shown
   */
  show({ action, onSubmit }) {
    if (!this.popupManager || typeof onSubmit !== 'function') return false;
    if (this._open) this.hide();

    this._panel = this._build(action, onSubmit);
    this._open = true;
    this.popupManager.showModal({
      id: SCHEDULE_OPEN_DIALOG_ID,
      panel: this._panel.host,
      onRequestClose: () => this.hide(),
      resizable: false
    });
    try {
      setTimeout(() => this._panel?.input?.focus?.(), 0);
    } catch { /* ignore */ }
    return true;
  }

  hide() {
    if (!this._open) return;
    this._open = false;
    this._panel = null;
    try {
      this.popupManager?.hideModal?.(SCHEDULE_OPEN_DIALOG_ID);
    } catch { /* ignore */ }
  }

  _build(action, onSubmit) {
    const doc = document;
    const title = titleForAction(action);

    const host = doc.createElement('div');
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-label', title);
    Object.assign(host.style, {
      boxSizing: 'border-box',
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: 'min(380px, calc(100vw - 32px))',
      borderRadius: NCT_DARK_UI_PANEL_RADIUS,
      border: `1px solid ${NCT_DARK_UI_COLORS.panelEdgeDark}`,
      background: NCT_DARK_UI_COLORS.panel,
      boxShadow: NCT_DARK_UI_PANEL_BOX_SHADOW,
      overflow: 'hidden',
      outline: 'none',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      color: 'rgba(255,255,255,0.92)'
    });

    const shadowRoot = ensureOpenChromeShadow(host, { id: 'schedule-open' });
    const shell = shadowRoot || host;
    if (shadowRoot) injectChromeStyles(shadowRoot, { attr: STYLE_ATTR, css: CSS });

    const header = doc.createElement('div');
    header.className = 'kp-sod-header';
    header.textContent = title;

    const body = doc.createElement('div');
    body.className = 'kp-sod-body';

    const label = doc.createElement('label');
    label.className = 'kp-sod-label';
    label.setAttribute('for', 'kp-sod-input');
    label.textContent = getMessage('deferred_open_dialog_label');

    const input = doc.createElement('input');
    input.type = 'datetime-local';
    input.id = 'kp-sod-input';
    input.className = 'kp-sod-input';
    input.step = '60';
    input.required = true;
    const now = this._now();
    input.min = formatDateTimeLocalValue(now);
    input.value = formatDateTimeLocalValue(defaultManualFireAt(now));

    const pickerBtn = doc.createElement('button');
    pickerBtn.type = 'button';
    pickerBtn.className = 'kp-sod-picker-btn';
    pickerBtn.textContent = '📅';
    pickerBtn.setAttribute('aria-label', getMessage('deferred_open_dialog_open_picker'));
    pickerBtn.title = getMessage('deferred_open_dialog_open_picker');
    pickerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        if (typeof input.showPicker === 'function') input.showPicker();
        else input.focus();
      } catch {
        try { input.focus(); } catch { /* ignore */ }
      }
    });

    const inputRow = doc.createElement('div');
    inputRow.className = 'kp-sod-input-row';
    inputRow.append(input, pickerBtn);

    const chips = doc.createElement('div');
    chips.className = 'kp-sod-chips';
    const presets = [
      ['deferred_open_dialog_preset_1h', () => this._now() + 60 * 60 * 1000],
      ['deferred_open_dialog_preset_1d', () => this._now() + 24 * 60 * 60 * 1000],
      ['deferred_open_dialog_preset_tomorrow', () => tomorrowMorningFireAt(this._now())]
    ];
    for (const [messageKey, computeFireAt] of presets) {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'kp-sod-chip';
      chip.textContent = getMessage(messageKey);
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        input.value = formatDateTimeLocalValue(computeFireAt());
        refresh();
        try { input.focus(); } catch { /* ignore */ }
      });
      chips.appendChild(chip);
    }

    const error = doc.createElement('div');
    error.className = 'kp-sod-error';
    error.setAttribute('role', 'alert');

    body.append(label, inputRow, chips, error);

    const actions = doc.createElement('div');
    actions.className = 'kp-sod-actions';

    const cancel = doc.createElement('button');
    cancel.type = 'button';
    cancel.className = 'kp-sod-btn';
    cancel.textContent = getMessage('deferred_open_dialog_cancel');

    const submit = doc.createElement('button');
    submit.type = 'button';
    submit.className = 'kp-sod-btn';
    submit.textContent = getMessage('deferred_open_dialog_schedule');

    actions.append(cancel, submit);
    shell.append(header, body, actions);

    const readFireAt = () => parseDateTimeLocalValue(input.value);
    const refresh = () => {
      const valid = isValidManualFireAt(readFireAt(), this._now());
      submit.disabled = !valid;
      error.textContent = valid || !input.value
        ? ''
        : getMessage('deferred_open_dialog_error_past');
      return valid;
    };
    const commit = () => {
      if (!refresh()) return;
      const fireAt = readFireAt();
      this.hide();
      onSubmit(fireAt);
    };

    input.addEventListener('input', refresh);
    input.addEventListener('change', refresh);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      commit();
    });
    cancel.addEventListener('click', (e) => {
      e.preventDefault();
      this.hide();
    });
    submit.addEventListener('click', (e) => {
      e.preventDefault();
      commit();
    });
    refresh();

    return { host, input, submit, cancel, error };
  }
}
