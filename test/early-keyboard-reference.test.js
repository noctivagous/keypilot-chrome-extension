import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync('extension/early-inject.js', 'utf8');

describe('early Keyboard Reference bootstrap', () => {
  it('constructs a hidden shell before awaiting the popover-window check', () => {
    const initStart = source.indexOf('async function init()');
    const popoverCheck = source.indexOf('await queryAmIPopoverWindow()', initStart);
    const shellCreation = source.lastIndexOf('ensureEarlyFloatingKeyboardHelpShell()', popoverCheck);

    assert.ok(initStart >= 0, 'early init exists');
    assert.ok(popoverCheck > initStart, 'popover-window check exists in early init');
    assert.ok(
      shellCreation > initStart && shellCreation < popoverCheck,
      'Keyboard Reference shell is created before the service-worker round trip'
    );
    assert.match(source, /root\.hidden = true;/);
    assert.match(source, /display: 'none'/);
  });

  it('keeps the document-start shell available for main-bundle adoption', () => {
    assert.match(source, /data-kp-early-floating-keyboard/);
    const keyboardHelpSource = readFileSync(
      'extension/src/ui/floating-keyboard-help.js',
      'utf8'
    );
    assert.match(
      keyboardHelpSource,
      /document\.querySelector\('\.kp-floating-keyboard-help\[data-kp-early-floating-keyboard="true"\]'\)/
    );
  });
});
