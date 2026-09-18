import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

/** @type {ReturnType<typeof installChromeMock>} */
let mock;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
  globalThis.KEYPILOT_DEBUG = false;
});

describe('i18n messages', () => {
  it('returns a configured localized message', async () => {
    mock.setI18nMessages({
      extension_name: { message: 'KeyPilot' }
    });
    const { getMessage } = await import('../extension/src/utils/i18n.js');

    assert.equal(getMessage('extension_name'), 'KeyPilot');
  });

  it('localizes named keycap legends and leaves glyphs unchanged', async () => {
    mock.setI18nMessages({
      keycap_shift: { message: 'Umschalt' },
      keycap_enter: { message: 'Eingabe' }
    });
    const { localizeKeycapLabel } = await import('../extension/src/utils/i18n.js');
    assert.equal(localizeKeycapLabel('Shift'), 'Umschalt');
    assert.equal(localizeKeycapLabel('Enter'), 'Eingabe');
    assert.equal(localizeKeycapLabel('Q'), 'Q');
    assert.equal(localizeKeycapLabel(''), '');
  });

  it('passes substitutions through to chrome.i18n', async () => {
    mock.setI18nMessages({
      greeting: {
        message: 'Hello, $name$!',
        placeholders: {
          name: { content: '$1' }
        }
      }
    });
    const { getMessage } = await import('../extension/src/utils/i18n.js');

    assert.equal(getMessage('greeting', 'Ana'), 'Hello, Ana!');
  });

  it('returns Chrome-compatible empty text for missing messages in release mode', async () => {
    const { getMessage } = await import('../extension/src/utils/i18n.js');

    assert.equal(getMessage('missing_message'), '');
  });

  it('warns and returns an identifiable marker for missing messages in debug mode', async () => {
    globalThis.KEYPILOT_DEBUG = true;
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      const { getMessage } = await import('../extension/src/utils/i18n.js');

      assert.equal(getMessage('missing_message'), '[i18n:missing_message]');
      assert.deepEqual(warnings, ['[KeyPilot i18n] Missing message: missing_message']);
    } finally {
      console.warn = originalWarn;
    }
  });
});
