import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';
import { buildChordSlotKey } from '../extension/src/utils/key-chord.js';

/** @type {ReturnType<typeof installChromeMock>} */
let mock;

/** @type {typeof import('../extension/src/utils/platform.js')} */
let platform;

before(async () => {
  mock = installChromeMock({ isMac: false });
  platform = await import('../extension/src/utils/platform.js');
});

beforeEach(() => {
  resetChromeMock(mock);
});

/**
 * @param {{ isMac?: boolean, userAgentDataPlatform?: string, platform?: string, userAgent?: string }} host
 */
function stubNavigator(host) {
  const mac = host.isMac === true;
  const navigatorStub = {
    platform: host.platform ?? (mac ? 'MacIntel' : 'Win32'),
    userAgent:
      host.userAgent ??
      (mac
        ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    userAgentData: {
      platform: host.userAgentDataPlatform ?? (mac ? 'macOS' : 'Windows')
    }
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: navigatorStub,
    configurable: true,
    writable: true,
    enumerable: true
  });
}

describe('altModifierLabel / formatAltShortcut', () => {
  it('uses Opt on Mac for compact and spaced shortcuts', () => {
    stubNavigator({ isMac: true });
    assert.equal(platform.altModifierLabel(), 'Opt');
    assert.equal(platform.formatAltShortcut('K'), 'Opt+K');
    assert.equal(platform.formatAltShortcut('H', { joiner: ' + ' }), 'Opt + H');
  });

  it('uses Alt on Win32', () => {
    stubNavigator({ isMac: false });
    assert.equal(platform.altModifierLabel(), 'Alt');
    assert.equal(platform.formatAltShortcut('K'), 'Alt+K');
    assert.equal(platform.formatAltShortcut('H', { joiner: ' + ' }), 'Alt + H');
  });

  it('uses Alt on Linux', () => {
    stubNavigator({
      isMac: false,
      platform: 'Linux x86_64',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      userAgentDataPlatform: 'Linux'
    });
    assert.equal(platform.isMacPlatform(), false);
    assert.equal(platform.formatAltShortcut('K'), 'Alt+K');
    assert.equal(platform.formatAltShortcut('H', { joiner: ' + ' }), 'Alt + H');
  });

  it('uses Alt on ChromeOS', () => {
    stubNavigator({
      isMac: false,
      platform: 'Linux armv8l',
      userAgent: 'Mozilla/5.0 (X11; CrOS aarch64)',
      userAgentDataPlatform: 'Chrome OS'
    });
    assert.equal(platform.isMacPlatform(), false);
    assert.equal(platform.formatAltShortcut('J'), 'Alt+J');
  });
});

describe('chord slot canonical tokens', () => {
  it('keeps ALT in stored chord keys regardless of host OS', () => {
    stubNavigator({ isMac: true });
    assert.equal(
      buildChordSlotKey({ key: 'Q', ctrl: true, alt: true }),
      'CHORD:CTRL+ALT+Q'
    );
    stubNavigator({ isMac: false });
    assert.equal(
      buildChordSlotKey({ key: 'Q', ctrl: true, alt: true }),
      'CHORD:CTRL+ALT+Q'
    );
  });
});

describe('onboarding reopen tip', () => {
  it('substitutes Opt + I on Mac', async () => {
    stubNavigator({ isMac: true });
    mock.setI18nMessages({
      onboarding_reopen_tip: {
        message: 'Tip: Press $1$ to re-open this walkthrough later.',
        placeholders: { shortcut: { content: '$1' } }
      }
    });
    const { getOnboardingReopenTip } = await import('../extension/src/ui/onboarding-shared.js');
    assert.equal(
      getOnboardingReopenTip(),
      'Tip: Press Opt + I to re-open this walkthrough later.'
    );
  });
});
