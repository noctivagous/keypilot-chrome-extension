import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';
import { buildChordSlotKey, formatChordSlotKeyLabel } from '../extension/src/utils/key-chord.js';

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

  it('labels Option as Opt on Mac and Alt on Windows', async () => {
    const slot = 'CHORD:CTRL+ALT+Q';
    stubNavigator({ isMac: true });
    assert.equal(formatChordSlotKeyLabel(slot), 'Ctrl+Opt+Q');
    stubNavigator({ isMac: false });
    assert.equal(formatChordSlotKeyLabel(slot), 'Ctrl+Alt+Q');

    const { formatKeyStroke } = await import('../extension/src/config/macro-keys.js');
    stubNavigator({ isMac: true });
    assert.equal(formatKeyStroke({ key: 'c', ctrl: true, alt: true }), 'Ctrl+Opt+C');
    stubNavigator({ isMac: false });
    assert.equal(formatKeyStroke({ key: 'c', ctrl: true, alt: true }), 'Ctrl+Alt+C');
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

describe('docs and onboarding Alt token rewrite', () => {
  it('rewrites exact kbd Alt on Mac and leaves verbs and Alt chrome', () => {
    stubNavigator({ isMac: true });
    const html = [
      '<p>Press <kbd>Alt</kbd>+<kbd>K</kbd>.</p>',
      '<p><strong>Alt chrome</strong> hotkeys</p>',
      '<p>Alternar piloto clave</p>'
    ].join('');
    assert.equal(
      platform.rewriteExactAltKbdHtml(html),
      [
        '<p>Press <kbd>Opt</kbd>+<kbd>K</kbd>.</p>',
        '<p><strong>Alt chrome</strong> hotkeys</p>',
        '<p>Alternar piloto clave</p>'
      ].join('')
    );
  });

  it('keeps kbd Alt on Windows', () => {
    stubNavigator({ isMac: false });
    assert.equal(
      platform.rewriteExactAltKbdHtml('<kbd>Alt</kbd>'),
      '<kbd>Alt</kbd>'
    );
  });

  it('rewrites backtick Alt tokens and Alt+ nav chips on Mac', () => {
    stubNavigator({ isMac: true });
    assert.equal(
      platform.rewriteBacktickAltTokens('Return with `Alt`+`I`'),
      'Return with `Opt`+`I`'
    );
    assert.equal(platform.rewriteAltShortcutPrefix('Alt+;'), 'Opt+;');
    assert.equal(platform.rewriteAltShortcutPrefix('Alt+J'), 'Opt+J');
    assert.equal(platform.rewriteAltShortcutPrefix('K'), 'K');
  });
});
