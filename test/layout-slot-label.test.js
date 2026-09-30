import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatLayoutSlotKeyLabel } from '../extension/src/utils/layout-slot-label.js';
import { altModifierLabel } from '../extension/src/utils/platform.js';

describe('formatLayoutSlotKeyLabel', () => {
  it('shows the hardware legend for physical code slots', () => {
    assert.equal(formatLayoutSlotKeyLabel('code:KeyQ'), 'Q');
    assert.equal(formatLayoutSlotKeyLabel('code:Semicolon'), ';');
    assert.equal(formatLayoutSlotKeyLabel('code:Digit1'), '1');
  });

  it('pretty-prints modifier chords and character slots', () => {
    assert.equal(formatLayoutSlotKeyLabel('CHORD:CTRL+ALT+Q'), `Ctrl+${altModifierLabel()}+Q`);
    assert.equal(formatLayoutSlotKeyLabel('key:ñ'), 'ñ');
  });

  it('does not invent a label for an empty slot', () => {
    assert.equal(formatLayoutSlotKeyLabel(''), '');
  });
});
