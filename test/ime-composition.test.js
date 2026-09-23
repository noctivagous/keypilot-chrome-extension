import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isImeComposingKeyboardEvent,
  noteImeCompositionEnd,
  noteImeCompositionStart
} from '../extension/src/utils/dom-context.js';
import { EventManager } from '../extension/src/modules/event-manager.js';

function keyEvent(partial = {}) {
  return {
    isComposing: false,
    key: '',
    keyCode: 0,
    which: 0,
    ...partial
  };
}

describe('IME composition protection', () => {
  it('recognizes modern and legacy IME keyboard events', () => {
    assert.equal(isImeComposingKeyboardEvent(keyEvent({ isComposing: true, key: 'a' })), true);
    assert.equal(isImeComposingKeyboardEvent(keyEvent({ key: 'Process' })), true);
    assert.equal(isImeComposingKeyboardEvent(keyEvent({ keyCode: 229 })), true);
    assert.equal(isImeComposingKeyboardEvent(keyEvent({ which: 229 })), true);
    assert.equal(isImeComposingKeyboardEvent(keyEvent({ key: 'f' })), false);
  });

  it('keeps events protected for the composition lifecycle', () => {
    noteImeCompositionEnd();
    const events = new EventManager();

    events.handleCompositionStart();
    assert.equal(events.isImeComposing(keyEvent({ key: 'f' })), true);

    events.handleCompositionEnd();
    assert.equal(events.isImeComposing(keyEvent({ key: 'f' })), false);
  });
});
