import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyDeferredNumberRowSlots,
  clearDeferredNumberRowSlots,
  inspectDeferredNumberRowSlots
} from '../extension/src/utils/deferred-number-row.js';

describe('deferred number-row slots', () => {
  it('treats empty keys as a write with no conflict', () => {
    const inspected = inspectDeferredNumberRowSlots({
      'code:Digit1': null,
      'code:Digit3': { type: 'function', id: 'BACK' }
    });
    assert.equal(inspected.conflicts.length, 0);
    assert.equal(inspected.needsWrite, true);
  });

  it('keeps keys that already hold the deferred actions', () => {
    const slots = applyDeferredNumberRowSlots({});
    const inspected = inspectDeferredNumberRowSlots(slots);
    assert.deepEqual(inspected.conflicts, []);
    assert.equal(inspected.needsWrite, false);
  });

  it('reports a mixed conflict and replace overwrites only those keys', () => {
    const slots = {
      'code:Digit1': { type: 'function', id: 'ACTIVATE_DEFERRED_RANDOM' },
      'code:Digit2': { type: 'macro', id: 'macro:1' },
      'code:Digit4': null,
      'code:KeyF': { type: 'function', id: 'ACTIVATE' }
    };
    const inspected = inspectDeferredNumberRowSlots(slots);
    assert.deepEqual(inspected.conflicts.map((item) => item.slot), ['code:Digit2']);
    assert.equal(inspected.needsWrite, true);

    const next = applyDeferredNumberRowSlots(slots);
    assert.equal(next['code:Digit2'].id, 'ACTIVATE_DEFERRED_SCHEDULED');
    assert.equal(next['code:Digit4'].id, 'SCHEDULE_LINK_MANUAL');
    assert.equal(next['code:KeyF'].id, 'ACTIVATE');

    const cleared = clearDeferredNumberRowSlots({
      ...next,
      'code:Digit2': { type: 'function', id: 'BACK' }
    });
    assert.equal(cleared['code:Digit1'], null);
    assert.equal(cleared['code:Digit4'], null);
    assert.equal(cleared['code:Digit2'].id, 'BACK');
  });
});
