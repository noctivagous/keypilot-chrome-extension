import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const early = readFileSync('extension/early-inject.js', 'utf8');
const keyboardHelp = readFileSync('extension/src/ui/floating-keyboard-help.js', 'utf8');

describe('early Keyboard Reference bootstrap', () => {
  it('does not reveal a non-ANSI hardware layout from the early shell', () => {
    const gate = early.indexOf("hardwareId === 'us-ansi-qwerty'");
    const reveal = early.indexOf('const shouldShow = !!(isExtensionEnabled && keyboardHelpVisible && customReady && hardwareReady)');
    assert.ok(gate > 0, 'early visibility knows the ANSI hardware model');
    assert.ok(reveal > gate, 'reveal waits until the painted hardware model matches');
  });

  it('renders a different hardware layout before the bundled window is revealed', () => {
    const wait = keyboardHelp.indexOf('!this._earlyBuiltinPaintMatches(builtinLayoutId, hardwareLayoutId)');
    const render = keyboardHelp.indexOf('void this._renderAsync().finally(() => reveal({ render: false }))', wait);
    assert.ok(wait > 0, 'bundled show checks the early hardware paint');
    assert.ok(render > wait, 'mismatched hardware renders before reveal');
  });
});
