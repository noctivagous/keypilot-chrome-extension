import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

globalThis.chrome = {
  i18n: {
    getMessage: () => ''
  }
};

const { KEYBOARD_LAYOUT_STORE_KEY } = await import('../extension/src/modules/keyboard-layout-store.js');
const {
  FRAME_LAYOUT_STORE_KEY,
  buildFrameLocalKeybindingsFromUserLayout
} = await import('../extension/src/modules/frame-agent-user-keys.js');

describe('frame agent custom-layout keys', () => {
  it('reads the same layout store as KeyboardLayoutStore', () => {
    assert.equal(FRAME_LAYOUT_STORE_KEY, KEYBOARD_LAYOUT_STORE_KEY);
  });

  it('keeps Click Element and scroll keys from a custom layout', () => {
    const bindings = buildFrameLocalKeybindingsFromUserLayout({
      'code:KeyF': { type: 'function', id: 'ACTIVATE' },
      'code:KeyN': { type: 'function', id: 'ACTIVATE_NEW_TAB' },
      'code:KeyG': { type: 'function', id: 'ACTIVATE_NEW_TAB_BACKGROUND' },
      'code:KeyC': { type: 'function', id: 'PAGE_UP_INSTANT' },
      'code:KeyV': { type: 'function', id: 'PAGE_DOWN_INSTANT' },
      'code:KeyZ': { type: 'function', id: 'PAGE_TOP' },
      'code:KeyX': { type: 'function', id: 'PAGE_BOTTOM' },
      'code:KeyL': { type: 'function', id: 'OMNIBOX' },
      'code:KeyK': { type: 'macro', id: 'macro:1' },
      'CHORD:CTRL+ALT+KeyF': { type: 'function', id: 'ACTIVATE' },
      'code:KeyJ': { type: 'function', id: 'action:click-copy' },
      'key:ñ': { type: 'function', id: 'action:page-down-copy' }
    }, {
      'action:click-copy': { functionId: 'ACTIVATE' },
      'action:page-down-copy': { functionId: 'PAGE_DOWN_INSTANT' },
      'action:other': { functionId: 'OMNIBOX' }
    });

    assert.deepEqual(bindings.ACTIVATE, {
      bindingType: 'physical',
      keys: ['KeyF', 'KeyJ'],
      matchOn: ['code']
    });
    assert.deepEqual(bindings.ACTIVATE_NEW_TAB.keys, ['KeyN']);
    assert.deepEqual(bindings.ACTIVATE_NEW_TAB_BACKGROUND.keys, ['KeyG']);
    assert.deepEqual(bindings.PAGE_UP_INSTANT.keys, ['KeyC']);
    assert.deepEqual(bindings.PAGE_TOP.keys, ['KeyZ']);
    assert.deepEqual(bindings.PAGE_BOTTOM.keys, ['KeyX']);
    assert.deepEqual(bindings.PAGE_DOWN_INSTANT, {
      bindingType: 'physical',
      keys: ['KeyV', 'ñ'],
      matchOn: ['code', 'key']
    });
    assert.equal(bindings.OMNIBOX, undefined);
  });

  it('returns no click binding when the custom layout does not assign one', () => {
    const bindings = buildFrameLocalKeybindingsFromUserLayout({
      'code:KeyL': { type: 'function', id: 'OMNIBOX' }
    });
    assert.deepEqual(bindings, {});
  });
});
