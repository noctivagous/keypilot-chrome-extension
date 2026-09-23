import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID,
  getKeyboardHardwareLayout,
  KEYBOARD_HARDWARE_LAYOUTS,
  listKeyboardHardwareLayouts,
  validateKeyboardHardwareLayouts
} from '../extension/src/config/keyboard-hardware-layouts.js';

describe('keyboard hardware layout registry', () => {
  it('defines a valid US ANSI QWERTY baseline model', () => {
    assert.deepEqual(validateKeyboardHardwareLayouts(), []);

    const layout = getKeyboardHardwareLayout(DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID);
    assert.equal(layout.id, 'us-ansi-qwerty');
    assert.equal(layout.formFactor, 'ANSI');

    const keys = layout.rows.flatMap((physicalRow) => physicalRow.keys);
    assert.equal(keys.find((physicalKey) => physicalKey.code === 'KeyY')?.legends.base, 'Y');
    assert.equal(keys.find((physicalKey) => physicalKey.code === 'KeyZ')?.legends.base, 'Z');
    assert.equal(keys.find((physicalKey) => physicalKey.code === 'KeyY')?.hidUsage, '0x1C');
    assert.equal(keys.find((physicalKey) => physicalKey.code === 'KeyZ')?.hidUsage, '0x1D');

    assert.deepEqual(
      layout.keyboardReference.rows.map((referenceRow) => referenceRow.codes),
      [
        ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backspace'],
        ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
        ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight']
      ]
    );
    assert.deepEqual(layout.keyboardReference.numberRowCodes, [
      'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
      'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'
    ]);
    assert.equal(keys.find((physicalKey) => physicalKey.code === 'Backspace')?.width, 1.55);
    assert.equal(keys.find((physicalKey) => physicalKey.code === 'Enter')?.width, 2);
    assert.equal(keys.find((physicalKey) => physicalKey.code === 'ShiftLeft')?.width, 2.15);
  });

  it('falls back to the default model for unknown IDs', () => {
    assert.equal(getKeyboardHardwareLayout('unknown-layout').id, DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID);
    assert.deepEqual(listKeyboardHardwareLayouts(), Object.values(KEYBOARD_HARDWARE_LAYOUTS));
  });

  it('rejects duplicate physical identities and missing legends', () => {
    const invalid = {
      broken: {
        id: 'broken',
        labelKey: 'broken',
        formFactor: 'ANSI',
        keyboardReference: { rows: [], numberRowCodes: [] },
        rows: [{
          id: 'row',
          keys: [
            { code: 'KeyA', hidUsage: '0x04', legends: { base: 'A' } },
            { code: 'KeyA', hidUsage: '0x04', legends: {} }
          ]
        }]
      }
    };

    assert.deepEqual(validateKeyboardHardwareLayouts(invalid), [
      'keyboard hardware layout "broken" repeats DOM code "KeyA"',
      'keyboard hardware layout "broken" repeats HID usage "0x04"',
      'keyboard hardware layout "broken" key "KeyA" has no base legend'
    ]);
  });
});
