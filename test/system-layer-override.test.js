import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

globalThis.chrome = {
  i18n: {
    getMessage: () => ''
  }
};

const { userLayoutClaimsKeyOverSystem } = await import('../extension/src/modules/system-layer-override.js');

describe('custom layout vs system keys', () => {
  it('lets Lookup Word on Quote replace Settings', () => {
    assert.equal(userLayoutClaimsKeyOverSystem({
      slots: { 'code:Quote': { type: 'function', id: 'LOOKUP_WORD' } },
      code: 'Quote',
      key: "'",
      actionId: 'OPEN_SETTINGS_POPOVER'
    }), true);
  });

  it('keeps Settings when the custom slot is still Settings', () => {
    assert.equal(userLayoutClaimsKeyOverSystem({
      slots: { 'code:Quote': { type: 'function', id: 'OPEN_SETTINGS_POPOVER' } },
      code: 'Quote',
      key: "'",
      actionId: 'OPEN_SETTINGS_POPOVER'
    }), false);
  });

  it('keeps a cleared key from falling back to the system action', () => {
    assert.equal(userLayoutClaimsKeyOverSystem({
      slots: { 'code:Quote': null },
      code: 'Quote',
      key: "'",
      actionId: 'OPEN_SETTINGS_POPOVER'
    }), true);
  });

  it('leaves system keys alone when the layout has no slot for them', () => {
    assert.equal(userLayoutClaimsKeyOverSystem({
      slots: { 'code:KeyF': { type: 'function', id: 'ACTIVATE' } },
      code: 'Quote',
      key: "'",
      actionId: 'OPEN_SETTINGS_POPOVER'
    }), false);
  });

  it('resolves an action instance that still is the system function', () => {
    assert.equal(userLayoutClaimsKeyOverSystem({
      slots: { 'code:KeyK': { type: 'function', id: 'action:kb' } },
      actions: [{ id: 'action:kb', functionId: 'TOGGLE_KEYBOARD_HELP' }],
      code: 'KeyK',
      key: 'k',
      actionId: 'TOGGLE_KEYBOARD_HELP'
    }), false);
    assert.equal(userLayoutClaimsKeyOverSystem({
      slots: { 'code:KeyK': { type: 'function', id: 'action:lookup' } },
      actions: [{ id: 'action:lookup', functionId: 'LOOKUP_WORD' }],
      code: 'KeyK',
      key: 'k',
      actionId: 'TOGGLE_KEYBOARD_HELP'
    }), true);
  });
});
