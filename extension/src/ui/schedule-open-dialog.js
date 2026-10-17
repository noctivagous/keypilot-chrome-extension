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
  shiftLocalFireAt,
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
  .kp-sod-time {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
  .kp-sod-time-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 0;
    min-width: 0;
  }
  .kp-sod-stepper {
    display: flex;
    align-items: stretch;
    gap: 4px;
  }
  .kp-sod-input,
  .kp-sod-select {
    box-sizing: border-box;
    width: 100%;
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
    padding: 4px;
    border-radius: 3px;
    opacity: 1;
  }
  .kp-sod-input::-webkit-calendar-picker-indicator:hover {
    background: rgba(255,255,255,0.15);
  }
  .kp-sod-step {
    margin: 0;
    flex: 0 0 auto;
    width: 32px;
    padding: 0;
    border-radius: ${NCT_DARK_UI_BTN_RADIUS};
    border: ${NCT_DARK_UI_BTN_BORDER};
    background: ${NCT_DARK_UI_BTN_GRADIENT};
    color: ${NCT_DARK_UI_COLORS.fg};
    font: inherit;
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
  .kp-sod-select:focus-visible,
  .kp-sod-step:focus-visible,
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
  if (action === 'ACTIVATE') return getMessage('deferred_open_dialog_title_click_element');
  if (action === 'CLOSE_TAB') return getMessage('deferred_open_dialog_title_close_tab');
  if (action === 'CLOSE_WINDOW') return getMessage('deferred_open_dialog_title_close_window');
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
      setTimeout(() => this._panel?.dateInput?.focus?.(), 0);
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
      width: 'min(420px, calc(100vw - 32px))',
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

    const label = doc.createElement('div');
    label.className = 'kp-sod-label';
    label.id = 'kp-sod-label';
    label.textContent = getMessage('deferred_open_dialog_label');

    const dateInput = doc.createElement('input');
    dateInput.type = 'date';
    dateInput.id = 'kp-sod-date';
    dateInput.className = 'kp-sod-input';
    dateInput.required = true;
    dateInput.setAttribute('aria-labelledby', 'kp-sod-label');

    const hourLabelText = getMessage('deferred_open_dialog_hour');
    const minuteLabelText = getMessage('deferred_open_dialog_minute');
    const earlierText = getMessage('deferred_open_dialog_earlier');
    const laterText = getMessage('deferred_open_dialog_later');

    const hourSelect = buildSelect(doc, 'kp-sod-hour', 24, (value) => hourOptionLabel(value));
    const minuteSelect = buildSelect(doc, 'kp-sod-minute', 60, (value) => pad2(value));
    hourSelect.setAttribute('aria-label', hourLabelText);
    minuteSelect.setAttribute('aria-label', minuteLabelText);

    /** @type {(part: 'hour'|'minute', delta: number) => void} */
    let shiftPart = () => {};
    const timeRow = doc.createElement('div');
    timeRow.className = 'kp-sod-time';
    timeRow.append(
      buildTimeField(doc, hourLabelText, hourSelect, 'hour', earlierText, laterText, (part, delta) => {
        shiftPart(part, delta);
      }),
      buildTimeField(doc, minuteLabelText, minuteSelect, 'minute', earlierText, laterText, (part, delta) => {
        shiftPart(part, delta);
      })
    );

    const chips = doc.createElement('div');
    chips.className = 'kp-sod-chips';
    const presets = [
      ['deferred_open_dialog_preset_1h', (base) => shiftLocalFireAt(base, { hours: 1 })],
      ['deferred_open_dialog_preset_1d', (base) => shiftLocalFireAt(base, { days: 1 })],
      ['deferred_open_dialog_preset_tomorrow', () => tomorrowMorningFireAt(this._now())]
    ];

    const error = doc.createElement('div');
    error.className = 'kp-sod-error';
    error.setAttribute('role', 'alert');

    body.append(label, dateInput, timeRow, chips, error);

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

    const readFireAt = () => parseDateTimeLocalValue(
      `${dateInput.value}T${pad2(hourSelect.value)}:${pad2(minuteSelect.value)}`
    );
    const applyFireAt = (ms) => {
      const formatted = formatDateTimeLocalValue(ms);
      const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(formatted);
      if (!match) return;
      dateInput.value = match[1];
      hourSelect.value = String(Number(match[2]));
      minuteSelect.value = String(Number(match[3]));
    };
    const currentOrNow = () => {
      const current = readFireAt();
      return Number.isFinite(current) ? current : this._now();
    };
    const refresh = () => {
      const fireAt = readFireAt();
      const valid = isValidManualFireAt(fireAt, this._now());
      submit.disabled = !valid;
      error.textContent = valid || !dateInput.value
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
    shiftPart = (part, delta) => {
      const base = currentOrNow();
      const next = part === 'minute'
        ? shiftLocalMinutes(base, delta)
        : shiftLocalFireAt(base, { hours: delta });
      applyFireAt(next);
      refresh();
    };

    for (const [messageKey, computeFireAt] of presets) {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'kp-sod-chip';
      chip.setAttribute('data-preset', messageKey);
      chip.textContent = getMessage(messageKey);
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const anchor = messageKey === 'deferred_open_dialog_preset_tomorrow'
          ? this._now()
          : currentOrNow();
        applyFireAt(computeFireAt(anchor));
        refresh();
      });
      chips.appendChild(chip);
    }

    for (const field of [dateInput, hourSelect, minuteSelect]) {
      field.addEventListener('input', refresh);
      field.addEventListener('change', refresh);
      field.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        commit();
      });
    }
    cancel.addEventListener('click', (e) => {
      e.preventDefault();
      this.hide();
    });
    submit.addEventListener('click', (e) => {
      e.preventDefault();
      commit();
    });

    const now = this._now();
    dateInput.min = formatDateTimeLocalValue(now).slice(0, 10);
    applyFireAt(defaultManualFireAt(now));
    refresh();

    return { host, dateInput, hourSelect, minuteSelect, submit, cancel, error };
  }
}

function pad2(value) {
  return String(Number(value) || 0).padStart(2, '0');
}

function hourOptionLabel(hour) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(
      new Date(2020, 0, 1, hour, 0, 0, 0)
    );
  } catch {
    return pad2(hour);
  }
}

function shiftLocalMinutes(ms, delta) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return NaN;
  date.setMinutes(date.getMinutes() + delta);
  return date.getTime();
}

/**
 * @param {Document} doc
 * @param {string} className
 * @param {number} count
 * @param {(value: number) => string} labelFor
 */
function buildSelect(doc, className, count, labelFor) {
  const select = doc.createElement('select');
  select.className = `kp-sod-select ${className}`;
  for (let value = 0; value < count; value += 1) {
    const option = doc.createElement('option');
    option.value = String(value);
    option.textContent = labelFor(value);
    select.appendChild(option);
  }
  return select;
}

/**
 * @param {Document} doc
 * @param {string} labelText
 * @param {HTMLSelectElement} select
 * @param {'hour'|'minute'} part
 * @param {string} earlierText
 * @param {string} laterText
 * @param {(part: 'hour'|'minute', delta: number) => void} onStep
 */
function buildTimeField(doc, labelText, select, part, earlierText, laterText, onStep) {
  const field = doc.createElement('div');
  field.className = 'kp-sod-time-field';

  const caption = doc.createElement('div');
  caption.className = 'kp-sod-label';
  caption.textContent = labelText;

  const stepper = doc.createElement('div');
  stepper.className = 'kp-sod-stepper';

  const earlier = doc.createElement('button');
  earlier.type = 'button';
  earlier.className = 'kp-sod-step';
  earlier.setAttribute('data-part', part);
  earlier.setAttribute('data-delta', '-1');
  earlier.textContent = '−';
  earlier.setAttribute('aria-label', `${earlierText} ${labelText}`);

  const later = doc.createElement('button');
  later.type = 'button';
  later.className = 'kp-sod-step';
  later.setAttribute('data-part', part);
  later.setAttribute('data-delta', '1');
  later.textContent = '+';
  later.setAttribute('aria-label', `${laterText} ${labelText}`);

  earlier.addEventListener('click', (e) => {
    e.preventDefault();
    onStep(part, -1);
  });
  later.addEventListener('click', (e) => {
    e.preventDefault();
    onStep(part, 1);
  });

  stepper.append(earlier, select, later);
  field.append(caption, stepper);
  return field;
}
