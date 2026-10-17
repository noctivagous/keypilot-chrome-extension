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
    input: root.find((n) => n.tagName === 'INPUT'),
    buttons: root.findAll((n) => n.tagName === 'BUTTON' && n.className === 'kp-sod-btn'),
    pickerBtn: root.find((n) => n.tagName === 'BUTTON' && n.className === 'kp-sod-picker-btn'),
    chips: root.findAll((n) => n.tagName === 'BUTTON' && n.className === 'kp-sod-chip')
  };
}

describe('ScheduleOpenDialog', () => {
  it('opens as an accessible modal pre-filled with a safe future time', async () => {
    const { host, input, buttons, now, utils } = await openDialog();
    assert.equal(host.getAttribute('role'), 'dialog');
    assert.equal(host.getAttribute('aria-modal'), 'true');
    assert.notEqual(host.getAttribute('aria-label'), null);
    assert.equal(input.type, 'datetime-local');
    assert.equal(input.value, utils.formatDateTimeLocalValue(utils.defaultManualFireAt(now)));
    assert.equal(input.min, utils.formatDateTimeLocalValue(now));
    const [cancel, submit] = buttons;
    assert.ok(cancel && submit);
    assert.equal(submit.disabled, false);
  });

  it('submits the exact local time chosen and closes', async () => {
    const { dialog, popupManager, submitted, input, buttons, id, utils } = await openDialog();
    input.value = '2030-03-04T05:06';
    input.fire('input');
    const [, submit] = buttons;
    assert.equal(submit.disabled, false);
    submit.fire('click');
    assert.deepEqual(submitted, [utils.parseDateTimeLocalValue('2030-03-04T05:06')]);
    assert.equal(dialog.isOpen(), false);
    assert.equal(popupManager.modals.has(id), false);
  });

  it('submits with Enter from the date field', async () => {
    const { submitted, input } = await openDialog();
    const event = input.fire('keydown', { key: 'Enter' });
    assert.equal(event.defaultPrevented, true);
    assert.equal(submitted.length, 1);
  });

  it('disables Schedule and queues nothing for past, current, or invalid times', async () => {
    const { submitted, input, buttons, dialog, now, utils } = await openDialog();
    const [, submit] = buttons;
    const bad = [
      utils.formatDateTimeLocalValue(now - 60_000),
      utils.formatDateTimeLocalValue(now),
      '2030-02-31T10:00',
      ''
    ];
    for (const value of bad) {
      input.value = value;
      input.fire('input');
      assert.equal(submit.disabled, true, value);
      submit.fire('click');
      input.fire('keydown', { key: 'Enter' });
    }
    assert.deepEqual(submitted, []);
    assert.equal(dialog.isOpen(), true);
  });

  it('offers a native-picker button that opens the control without typing', async () => {
    const { pickerBtn, input } = await openDialog();
    let opened = false;
    input.showPicker = () => { opened = true; };
    pickerBtn.fire('click');
    assert.equal(opened, true);
  });

  it('falls back to focusing the field when showPicker is unsupported', async () => {
    const { pickerBtn, input } = await openDialog();
    let focused = false;
    input.focus = () => { focused = true; };
    assert.equal(typeof input.showPicker, 'undefined');
    pickerBtn.fire('click');
    assert.equal(focused, true);
  });

  it('fills in the field from quick-pick chips instead of requiring typing', async () => {
    const { chips, input, buttons, now, utils } = await openDialog();
    assert.equal(chips.length, 3);
    const [, submit] = buttons;

    chips[0].fire('click'); // +1 hour
    assert.equal(input.value, utils.formatDateTimeLocalValue(now + 60 * 60 * 1000));
    assert.equal(submit.disabled, false);

    chips[1].fire('click'); // +1 day
    assert.equal(input.value, utils.formatDateTimeLocalValue(now + 24 * 60 * 60 * 1000));
    assert.equal(submit.disabled, false);

    chips[2].fire('click'); // Tomorrow morning
    assert.equal(input.value, utils.formatDateTimeLocalValue(utils.tomorrowMorningFireAt(now)));
    assert.equal(submit.disabled, false);
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
