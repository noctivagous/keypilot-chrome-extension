import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildKeyboardReferenceUiLayout,
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

  it('defines the initial ISO QWERTZ/QWERTY and JIS physical models', () => {
    assert.deepEqual(
      listKeyboardHardwareLayouts().map((layout) => layout.id),
      ['us-ansi-qwerty', 'de-de-qwertz-iso', 'es-es-qwerty-iso', 'sk-sk-qwertz-iso', 'ja-jis-106']
    );

    const keyFor = (layoutId, code) => getKeyboardHardwareLayout(layoutId)
      .rows.flatMap((physicalRow) => physicalRow.keys)
      .find((physicalKey) => physicalKey.code === code);

    assert.equal(keyFor('de-de-qwertz-iso', 'KeyY')?.legends.base, 'Z');
    assert.equal(keyFor('de-de-qwertz-iso', 'KeyZ')?.legends.base, 'Y');
    assert.equal(keyFor('es-es-qwerty-iso', 'Semicolon')?.legends.base, 'Ñ');
    assert.equal(keyFor('es-es-qwerty-iso', 'Backslash')?.legends.base, 'Ç');
    assert.equal(keyFor('sk-sk-qwertz-iso', 'KeyY')?.legends.base, 'Z');
    assert.equal(keyFor('ja-jis-106', 'IntlYen')?.legends.base, '¥');
    assert.equal(keyFor('ja-jis-106', 'IntlRo')?.legends.base, 'ろ');
    assert.equal(keyFor('ja-jis-106', 'Convert')?.legends.base, '変換');
    assert.equal(keyFor('ja-jis-106', 'NonConvert')?.legends.base, '無変換');
    assert.equal(keyFor('ja-jis-106', 'KanaMode')?.legends.base, 'かな');

    const spainReferenceCodes = getKeyboardHardwareLayout('es-es-qwerty-iso')
      .keyboardReference.rows.flatMap((referenceRow) => referenceRow.codes);
    const japaneseReferenceCodes = getKeyboardHardwareLayout('ja-jis-106')
      .keyboardReference.rows.flatMap((referenceRow) => referenceRow.codes);
    assert.ok(spainReferenceCodes.includes('IntlBackslash'));
    assert.ok(japaneseReferenceCodes.includes('IntlRo'));

    assert.equal(
      listKeyboardHardwareLayouts().some((layout) => layout.id.includes('es-419')),
      false
    );
  });

  it('falls back to the default model for unknown IDs', () => {
    assert.equal(getKeyboardHardwareLayout('unknown-layout').id, DEFAULT_KEYBOARD_HARDWARE_LAYOUT_ID);
    assert.deepEqual(listKeyboardHardwareLayouts(), Object.values(KEYBOARD_HARDWARE_LAYOUTS));
  });

  it('maps physical bindings onto the model instead of matching legends', () => {
    const rows = buildKeyboardReferenceUiLayout({
      keybindings: {
        TEST_ACTION: {
          bindingType: 'physical',
          keys: ['KeyY']
        },
        IGNORED_CHARACTER_ACTION: {
          bindingType: 'character',
          keys: ['y']
        }
      },
      includeNumberRow: true
    });

    assert.deepEqual(rows[0].map((item) => item.code), [
      'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
      'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'
    ]);
    const keyY = rows[1].find((item) => item.code === 'KeyY');
    assert.deepEqual(keyY, {
      type: 'action',
      code: 'KeyY',
      legend: 'Y',
      id: 'TEST_ACTION',
      fallbackText: 'TEST_ACTION'
    });
    assert.equal(rows.flat().some((item) => item.id === 'IGNORED_CHARACTER_ACTION'), false);
  });

  it('places German Y/Z actions by code while rendering German legends', () => {
    const rows = buildKeyboardReferenceUiLayout({
      hardwareLayoutId: 'de-de-qwertz-iso',
      keybindings: {
        ACTION_AT_PHYSICAL_KEY_Y: { bindingType: 'physical', keys: ['KeyY'] },
        ACTION_AT_PHYSICAL_KEY_Z: { bindingType: 'physical', keys: ['KeyZ'] }
      }
    });
    const cells = rows.flat();

    assert.deepEqual(
      cells.find((cell) => cell.code === 'KeyY'),
      {
        type: 'action',
        code: 'KeyY',
        legend: 'Z',
        id: 'ACTION_AT_PHYSICAL_KEY_Y',
        fallbackText: 'ACTION_AT_PHYSICAL_KEY_Y'
      }
    );
    assert.deepEqual(
      cells.find((cell) => cell.code === 'KeyZ'),
      {
        type: 'action',
        code: 'KeyZ',
        legend: 'Y',
        id: 'ACTION_AT_PHYSICAL_KEY_Z',
        fallbackText: 'ACTION_AT_PHYSICAL_KEY_Z'
      }
    );
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

  it('rejects Keyboard Reference geometry that cannot resolve to a physical key', () => {
    const invalid = {
      broken: {
        id: 'broken',
        labelKey: 'broken',
        formFactor: 'ANSI',
        rows: [{ id: 'row', keys: [{ code: 'KeyA', hidUsage: '0x04', legends: { base: 'A' } }] }],
        keyboardReference: {
          rows: [{ id: 'top', codes: ['KeyB'] }],
          numberRowCodes: []
        }
      }
    };

    assert.deepEqual(validateKeyboardHardwareLayouts(invalid), [
      'keyboard hardware layout "broken" Keyboard Reference uses unknown DOM code "KeyB"'
    ]);
  });
});
