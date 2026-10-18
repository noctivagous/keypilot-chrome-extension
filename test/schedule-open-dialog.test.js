import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

class FakeNode {
  constructor(tagName, ownerDocument = null) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.nodeType = tagName === '#shadow' ? 11 : 1;
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.shadowRoot = null;
  }

  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  querySelector() { return null; }
  focus() {}

  attachShadow() {
    this.shadowRoot = new FakeNode('#shadow', this.ownerDocument);
    return this.shadowRoot;
  }

  fire(type, extra = {}) {
    const event = { type, preventDefault() { this.defaultPrevented = true; }, ...extra };
    for (const fn of this.listeners[type] || []) fn(event);
    return event;
  }

  find(predicate) {
    if (predicate(this)) return this;
    for (const child of [...this.children, ...(this.shadowRoot ? [this.shadowRoot] : [])]) {
      const found = child.find?.(predicate);
      if (found) return found;
    }
    return null;
  }

  findAll(predicate, out = []) {
    if (predicate(this)) out.push(this);
    for (const child of [...this.children, ...(this.shadowRoot ? [this.shadowRoot] : [])]) {
      child.findAll?.(predicate, out);
    }
    return out;
  }
}

class FakePopupManager {
  constructor() {
    this.modals = new Map();
  }

  showModal({ id, panel, onRequestClose }) {
    this.modals.set(id, { panel, onRequestClose });
  }

  hideModal(id) {
    this.modals.delete(id);
  }

  requestCloseTop() {
    [...this.modals.values()].at(-1)?.onRequestClose?.();
  }
}

let mock;
let previousDocument;

before(() => {
  mock = installChromeMock();
  previousDocument = globalThis.document;
  const doc = { nodeType: 9 };
  doc.createElement = (tag) => new FakeNode(tag, doc);
  globalThis.document = doc;
});

after(() => {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
});

beforeEach(() => {
  resetChromeMock(mock);
});

async function openDialog(now = new Date(2030, 0, 1, 12, 0, 0, 0).getTime()) {
  const { ScheduleOpenDialog, SCHEDULE_OPEN_DIALOG_ID } = await import(
    '../extension/src/ui/schedule-open-dialog.js'
  );
  const utils = await import('../extension/src/utils/deferred-open.js');
  const popupManager = new FakePopupManager();
  const dialog = new ScheduleOpenDialog({ popupManager, now: () => now });
  const submitted = [];
  assert.equal(dialog.show({ action: 'OPEN_URLS', onSubmit: (fireAt) => submitted.push(fireAt) }), true);
  const host = popupManager.modals.get(SCHEDULE_OPEN_DIALOG_ID).panel;
  const root = host.shadowRoot;
  return {
    dialog,
    popupManager,
    submitted,
    host,
    now,
    utils,
    id: SCHEDULE_OPEN_DIALOG_ID,
    dateInput: root.find((n) => n.tagName === 'INPUT'),
    hourSelect: root.find((n) => n.className?.includes('kp-sod-hour')),
    minuteSelect: root.find((n) => n.className?.includes('kp-sod-minute')),
    buttons: root.findAll((n) => n.tagName === 'BUTTON' && n.className === 'kp-sod-btn'),
    steps: root.findAll((n) => n.tagName === 'BUTTON' && n.className === 'kp-sod-step'),
    chips: root.findAll((n) => n.tagName === 'BUTTON' && n.className === 'kp-sod-chip')
  };
}

function chosenTime({ dateInput, hourSelect, minuteSelect, utils }) {
  const hour = String(hourSelect.value).padStart(2, '0');
  const minute = String(minuteSelect.value).padStart(2, '0');
  return utils.parseDateTimeLocalValue(`${dateInput.value}T${hour}:${minute}`);
}

describe('ScheduleOpenDialog', () => {
  it('opens as an accessible modal pre-filled with a safe future time', async () => {
    const state = await openDialog();
    const { host, dateInput, buttons, now, utils } = state;
    assert.equal(host.getAttribute('role'), 'dialog');
    assert.equal(host.getAttribute('aria-modal'), 'true');
    assert.notEqual(host.getAttribute('aria-label'), null);
    assert.equal(dateInput.type, 'date');
    assert.equal(chosenTime(state), utils.defaultManualFireAt(now));
    assert.equal(dateInput.min, utils.formatDateTimeLocalValue(now).slice(0, 10));
    assert.equal(state.steps.length, 4);
    const [cancel, submit] = buttons;
    assert.ok(cancel && submit);
    assert.equal(submit.disabled, false);
  });

  it('submits the exact local time chosen and closes', async () => {
    const state = await openDialog();
    const { dialog, popupManager, submitted, dateInput, hourSelect, minuteSelect, buttons, id, utils } = state;
    dateInput.value = '2030-03-04';
    hourSelect.value = '5';
    minuteSelect.value = '6';
    dateInput.fire('input');
    const [, submit] = buttons;
    assert.equal(submit.disabled, false);
    submit.fire('click');
    assert.deepEqual(submitted, [utils.parseDateTimeLocalValue('2030-03-04T05:06')]);
    assert.equal(dialog.isOpen(), false);
    assert.equal(popupManager.modals.has(id), false);
  });

  it('submits with Enter from the date field', async () => {
    const { submitted, dateInput } = await openDialog();
    const event = dateInput.fire('keydown', { key: 'Enter' });
    assert.equal(event.defaultPrevented, true);
    assert.equal(submitted.length, 1);
  });

  it('disables Schedule and queues nothing for past, current, or invalid times', async () => {
    const state = await openDialog();
    const { submitted, dateInput, hourSelect, minuteSelect, buttons, dialog, now } = state;
    const [, submit] = buttons;
    const apply = (ms) => {
      const date = new Date(ms);
      dateInput.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      hourSelect.value = String(date.getHours());
      minuteSelect.value = String(date.getMinutes());
      dateInput.fire('input');
    };
    apply(now - 60_000);
    assert.equal(submit.disabled, true);
    apply(now);
    assert.equal(submit.disabled, true);
    dateInput.value = '2030-02-31';
    hourSelect.value = '10';
    minuteSelect.value = '0';
    dateInput.fire('input');
    dateInput.value = '';
    dateInput.fire('input');
    assert.equal(submit.disabled, true);
    submit.fire('click');
    dateInput.fire('keydown', { key: 'Enter' });
    assert.deepEqual(submitted, []);
    assert.equal(dialog.isOpen(), true);
  });

  it('steps the hour and minute without opening a second calendar', async () => {
    const state = await openDialog();
    const start = chosenTime(state);
    const laterHour = state.steps.find((button) => (
      button.getAttribute('data-part') === 'hour' && button.getAttribute('data-delta') === '1'
    ));
    const laterMinute = state.steps.find((button) => (
      button.getAttribute('data-part') === 'minute' && button.getAttribute('data-delta') === '1'
    ));
    laterHour.fire('click');
    assert.equal(chosenTime(state), state.utils.shiftLocalFireAt(start, { hours: 1 }));
    laterMinute.fire('click');
    const afterHour = state.utils.shiftLocalFireAt(start, { hours: 1 });
    const expected = new Date(afterHour);
    expected.setMinutes(expected.getMinutes() + 1);
    assert.equal(chosenTime(state), expected.getTime());
  });

  it('adds an hour or a day to the time already shown, and repeats', async () => {
    const state = await openDialog();
    const { chips, buttons, now, utils } = state;
    assert.equal(chips.length, 3);
    const [, submit] = buttons;
    const start = utils.defaultManualFireAt(now);

    chips[0].fire('click');
    const plusOneHour = utils.shiftLocalFireAt(start, { hours: 1 });
    assert.equal(chosenTime(state), plusOneHour);
    chips[0].fire('click');
    assert.equal(chosenTime(state), utils.shiftLocalFireAt(plusOneHour, { hours: 1 }));
    assert.equal(submit.disabled, false);

    const beforeDay = chosenTime(state);
    chips[1].fire('click');
    assert.equal(chosenTime(state), utils.shiftLocalFireAt(beforeDay, { days: 1 }));
    chips[1].fire('click');
    assert.equal(chosenTime(state), utils.shiftLocalFireAt(beforeDay, { days: 2 }));

    chips[2].fire('click');
    assert.equal(chosenTime(state), utils.tomorrowMorningFireAt(now));
    chips[2].fire('click');
    assert.equal(chosenTime(state), utils.tomorrowMorningFireAt(now));
    assert.equal(submit.disabled, false);
  });

  it('sets the link dialog to a fixed number of minutes from now', async () => {
    const { ScheduleOpenDialog, SCHEDULE_OPEN_DIALOG_ID } = await import(
      '../extension/src/ui/schedule-open-dialog.js'
    );
    const utils = await import('../extension/src/utils/deferred-open.js');
    const now = new Date(2030, 0, 1, 12, 0, 0, 0).getTime();
    const popupManager = new FakePopupManager();
    const dialog = new ScheduleOpenDialog({ popupManager, now: () => now });
    assert.equal(dialog.show({ action: 'ACTIVATE', onSubmit: () => {} }), true);
    const root = popupManager.modals.get(SCHEDULE_OPEN_DIALOG_ID).panel.shadowRoot;
    const chips = root.findAll((n) => n.getAttribute('data-minutes-from-now'));
    assert.deepEqual(chips.map((chip) => chip.getAttribute('data-minutes-from-now')), [
      '5', '10', '15', '30', '45', '60'
    ]);
    const state = {
      dateInput: root.find((n) => n.tagName === 'INPUT'),
      hourSelect: root.find((n) => n.className?.includes('kp-sod-hour')),
      minuteSelect: root.find((n) => n.className?.includes('kp-sod-minute')),
      utils
    };
    chips[0].fire('click');
    assert.equal(chosenTime(state), utils.minutesFromNow(5, now));
    chips[3].fire('click');
    assert.equal(chosenTime(state), utils.minutesFromNow(30, now));
    chips[5].fire('click');
    assert.equal(chosenTime(state), utils.minutesFromNow(60, now));
  });

  it('asks for a URL above the date when scheduling a link manually', async () => {
    const { ScheduleOpenDialog, SCHEDULE_OPEN_DIALOG_ID } = await import(
      '../extension/src/ui/schedule-open-dialog.js'
    );
    const now = new Date(2030, 0, 1, 12, 0, 0, 0).getTime();
    const popupManager = new FakePopupManager();
    const dialog = new ScheduleOpenDialog({ popupManager, now: () => now });
    const submitted = [];
    assert.equal(dialog.show({
      action: 'SCHEDULE_LINK_MANUAL',
      onSubmit: (fireAt, details) => submitted.push({ fireAt, details })
    }), true);
    const root = popupManager.modals.get(SCHEDULE_OPEN_DIALOG_ID).panel.shadowRoot;
    const body = root.find((n) => n.className === 'kp-sod-body');
    const inputs = body.children.filter((n) => n.tagName === 'INPUT');
    assert.equal(inputs[0].id, 'kp-sod-url');
    assert.equal(inputs[1].id, 'kp-sod-date');
    const submit = root.findAll((n) => n.tagName === 'BUTTON' && n.className === 'kp-sod-btn')[1];
    assert.equal(submit.disabled, true);
    inputs[0].value = 'not a url';
    inputs[0].fire('input');
    assert.equal(submit.disabled, true);
    inputs[0].value = 'example.com/later';
    inputs[0].fire('input');
    assert.equal(submit.disabled, false);
    submit.fire('click');
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].details.url, 'https://example.com/later');
    assert.equal(dialog.isOpen(), false);
  });

  it('closes without scheduling on Cancel, Escape, and backdrop close requests', async () => {
    let state = await openDialog();
    state.buttons[0].fire('click');
    assert.equal(state.dialog.isOpen(), false);
    assert.equal(state.popupManager.modals.size, 0);
    assert.deepEqual(state.submitted, []);

    // Escape and backdrop click both reach PopupManager's top onRequestClose.
    state = await openDialog();
    state.popupManager.requestCloseTop();
    assert.equal(state.dialog.isOpen(), false);
    assert.equal(state.popupManager.modals.size, 0);
    assert.deepEqual(state.submitted, []);
  });
});
