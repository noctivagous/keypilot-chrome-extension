import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { KEYBOARD_HARDWARE_LAYOUTS } from '../extension/src/config/keyboard-hardware-layouts.js';

const early = readFileSync('extension/early-inject.js', 'utf8');
const keyboardHelp = readFileSync('extension/src/ui/floating-keyboard-help.js', 'utf8');

describe('early Keyboard Reference bootstrap', () => {
  it('stamps every shipped hardware model into the early renderer', () => {
    assert.match(early, /const KEYBOARD_LAYOUTS_BY_HARDWARE_ID =/);
    for (const hardwareLayoutId of Object.keys(KEYBOARD_HARDWARE_LAYOUTS)) {
      assert.match(early, new RegExp(`"${hardwareLayoutId}"`));
    }
  });

  it('uses matching layout keys so the bundled renderer adopts early hardware paint', () => {
    assert.match(early, /const paintKey = `\$\{desired\}:\$\{data\.hardwareId\}`/);
    assert.match(keyboardHelp, /_earlyBuiltinPaintMatches\(builtinLayoutId, hardwareLayoutId\)/);
  });

  it('fills the layout menu when early paint is adopted without a keyboard rebuild', () => {
    assert.match(
      keyboardHelp,
      /void this\._refreshLayoutSelectOptions\(\);\s*reveal\(\{ render: false \}\)/
    );
    assert.match(
      early,
      /const translated = earlyMessage\(String\(pair\[1\]\)\)/
    );
    assert.match(early, /keyboardLayoutSelectLabel/);
    assert.doesNotMatch(early, /let earlyLayoutLabel = 'Browsing'/);
    assert.match(early, /const slotKey = code \? `code:\$\{code\}` : ''/);
  });
});
