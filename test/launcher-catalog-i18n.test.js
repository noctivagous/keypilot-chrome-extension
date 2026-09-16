import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, beforeEach, describe, it } from 'node:test';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

let mock;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
});

describe('Launcher catalog localization', () => {
  it('keeps public site names and URLs separate from localized descriptions', async () => {
    const { LAUNCHER_SITE_CATALOG, getLauncherCatalog } = await import('../extension/src/config/launcher-sites.js');
    const firstRaw = LAUNCHER_SITE_CATALOG.social[0];
    mock.setI18nMessages({
      [firstRaw.descriptionKey]: { message: 'Localized social site description' }
    });

    assert.equal(firstRaw.title, 'Instagram');
    assert.equal(firstRaw.url, 'https://instagram.com');
    assert.equal(firstRaw.description, undefined);
    assert.equal(typeof firstRaw.descriptionKey, 'string');
    assert.equal(getLauncherCatalog('social')[0].description, 'Localized social site description');
  });

  it('preserves user-defined Launch Deck titles as stored data', async () => {
    const { normalizeLaunchDeckState } = await import('../extension/src/utils/launch-deck.js');
    const state = normalizeLaunchDeckState({
      social: {
        custom: [{ title: 'My personal shortcut', url: 'https://example.com' }]
      }
    });

    assert.equal(state.social.custom[0].title, 'My personal shortcut');
    assert.equal(state.social.custom[0].url, 'https://example.com');
  });

  it('defines all launcher description and category keys in English and the test locale', async () => {
    const [source, popoverSource, english, testLocale] = await Promise.all([
      readFile('extension/src/config/launcher-sites.js', 'utf8'),
      readFile('extension/src/modules/launcher-popover.js', 'utf8'),
      readFile('extension/_locales/en/messages.json', 'utf8').then(JSON.parse),
      readFile('test/fixtures/locales/en_GB/messages.json', 'utf8').then(JSON.parse)
    ]);
    const searchDescriptionMap = Array.from(
      source.matchAll(/SEARCH_ENGINE_DESCRIPTION_KEYS = Object\.freeze\(\{[\s\S]*?\}\);/g)
    )[0]?.[0] || '';
    const keys = new Set([
      ...[...source.matchAll(/descriptionKey: '([^']+)'/g)].map((match) => match[1]),
      ...[...searchDescriptionMap.matchAll(/:\s*'([^']+)'/g)].map((match) => match[1]),
      ...[...popoverSource.matchAll(/(?:labelKey|descriptionKey): '([^']+)'/g)].map((match) => match[1]),
      'launcher_title',
      'launcher_category_fallback_description'
    ]);

    for (const key of keys) {
      assert.equal(typeof english[key]?.message, 'string', `English catalog missing ${key}`);
      assert.equal(typeof testLocale[key]?.message, 'string', `Test locale missing ${key}`);
    }
    assert.deepEqual(
      Object.keys(english).filter((key) => key.startsWith('launcher_')).sort(),
      Object.keys(testLocale).filter((key) => key.startsWith('launcher_')).sort()
    );
  });
});
