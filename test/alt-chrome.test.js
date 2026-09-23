import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALT_CHROME,
  isAltChromeShortcut,
  isExclusiveAltModifier
} from '../extension/src/utils/alt-chrome.js';

/**
 * @param {Partial<KeyboardEvent> & { altGraph?: boolean }} partial
 */
function keyEvent(partial) {
  const altGraph = partial.altGraph === true;
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    code: '',
    key: '',
    getModifierState(name) {
      return name === 'AltGraph' && altGraph;
    },
    ...partial
  };
}

describe('isExclusiveAltModifier', () => {
  it('accepts Alt alone', () => {
    assert.equal(isExclusiveAltModifier(keyEvent({ altKey: true, code: 'KeyI', key: 'i' })), true);
  });

  it('rejects Ctrl, Meta, and Shift held with Alt', () => {
    assert.equal(isExclusiveAltModifier(keyEvent({ altKey: true, ctrlKey: true, code: 'KeyI', key: 'i' })), false);
    assert.equal(isExclusiveAltModifier(keyEvent({ altKey: true, metaKey: true, code: 'KeyI', key: 'i' })), false);
    assert.equal(isExclusiveAltModifier(keyEvent({ altKey: true, shiftKey: true, code: 'KeyI', key: 'I' })), false);
  });

  it('accepts AltGr reported as Ctrl+Alt', () => {
    assert.equal(
      isExclusiveAltModifier(keyEvent({ altKey: true, ctrlKey: true, altGraph: true, code: 'KeyI', key: 'i' })),
      true
    );
  });

  it('rejects a key with no Alt', () => {
    assert.equal(isExclusiveAltModifier(keyEvent({ code: 'KeyI', key: 'i' })), false);
    assert.equal(isExclusiveAltModifier(null), false);
  });
});

describe('isAltChromeShortcut', () => {
  it('matches Alt+I and not Ctrl+Alt+I', () => {
    assert.equal(
      isAltChromeShortcut(keyEvent({ altKey: true, code: 'KeyI', key: 'i' }), ALT_CHROME.TUTORIAL),
      true
    );
    assert.equal(
      isAltChromeShortcut(keyEvent({ altKey: true, ctrlKey: true, code: 'KeyI', key: 'i' }), ALT_CHROME.TUTORIAL),
      false
    );
  });

  it('does not treat Alt+K as the tutorial shortcut', () => {
    assert.equal(
      isAltChromeShortcut(keyEvent({ altKey: true, code: 'KeyK', key: 'k' }), ALT_CHROME.TUTORIAL),
      false
    );
    assert.equal(
      isAltChromeShortcut(keyEvent({ altKey: true, code: 'KeyK', key: 'k' }), ALT_CHROME.TOGGLE),
      true
    );
  });
});
