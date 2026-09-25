import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

let mock;
let store;

before(async () => {
  mock = installChromeMock({ isMac: false });
  store = await import('../extension/src/modules/keyboard-layout-store.js');
});

beforeEach(() => {
  resetChromeMock(mock);
});

describe('custom keyboard layout physical slots', () => {
  it('mirrors code-based slots while preserving character slots', () => {
    assert.equal(store.mirrorKeyboardLayoutSlotKey('code:KeyQ'), 'code:KeyP');
    assert.equal(store.mirrorKeyboardLayoutSlotKey('CHORD:CTRL+KeyQ'), 'CHORD:CTRL+KeyP');
    assert.equal(store.mirrorKeyboardLayoutSlotKey('key:ñ'), 'key:ñ');
  });

  it('duplicates built-ins into physical-code slots', async () => {
    const layout = await store.duplicateBuiltinLayoutToUserLayout({
      builtinLayoutId: 'browsing-right',
      label: 'Physical copy'
    });

    assert.deepEqual(layout.slots['code:KeyY'], {
      type: 'function',
      id: 'RECTANGLE_HIGHLIGHT'
    });
    assert.deepEqual(layout.slots['code:KeyZ'], {
      type: 'function',
      id: 'PAGE_TOP'
    });
    assert.deepEqual(layout.slots['code:Period'], {
      type: 'function',
      id: 'stock:social-media'
    });
    assert.deepEqual(layout.slots['code:Slash'], {
      type: 'function',
      id: 'TABS_OVERVIEW'
    });
    assert.equal(Object.hasOwn(layout.slots, 'key:y'), false);

    const left = await store.duplicateBuiltinLayoutToUserLayout({
      builtinLayoutId: 'browsing-left',
      label: 'Left physical copy'
    });
    assert.deepEqual(left.slots['code:KeyX'], {
      type: 'function',
      id: 'stock:social-media'
    });
    assert.deepEqual(left.slots['code:KeyZ'], {
      type: 'function',
      id: 'TABS_OVERVIEW'
    });
    assert.deepEqual(left.slots['code:Slash'], {
      type: 'function',
      id: 'PAGE_TOP'
    });
  });

  it('moves custom physical slots when changing handedness', async () => {
    const original = await store.upsertUserKeyboardLayout({
      id: 'layout:test',
      label: 'Physical layout',
      builtIn: false,
      baseBuiltinLayoutId: 'browsing-right',
      slots: {
        'code:KeyQ': { type: 'function', id: 'ACTIVATE' },
        'key:ñ': { type: 'function', id: 'PAGE_TOP' }
      }
    });
    const mirrored = await store.setUserKeyboardLayoutHandedness(original, 'left');

    assert.equal(mirrored.baseBuiltinLayoutId, 'browsing-left');
    assert.deepEqual(mirrored.slots['code:KeyP'], { type: 'function', id: 'ACTIVATE' });
    assert.deepEqual(mirrored.slots['key:ñ'], { type: 'function', id: 'PAGE_TOP' });
  });
});
