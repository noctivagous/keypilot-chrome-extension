import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, beforeEach, describe, it } from 'node:test';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

/** @type {ReturnType<typeof installChromeMock>} */
let mock;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
});

async function catalogs() {
  const [english, testLocale] = await Promise.all([
    readFile('extension/_locales/en/messages.json', 'utf8').then(JSON.parse),
    readFile('test/fixtures/locales/en_GB/messages.json', 'utf8').then(JSON.parse)
  ]);
  return { english, testLocale };
}

describe('catalog-to-display resolution', () => {
  it('resolves built-in layout family keys and keeps user layout labels', async () => {
    mock.setI18nMessages({
      layout_family_browsing_label: { message: 'Localized Browsing' },
      layout_family_navigation_label: { message: 'Localized Navigation' }
    });
    const { listLayoutPickerGroups } = await import('../extension/src/config/keyboard-layouts.js');
    const { getMessage } = await import('../extension/src/utils/i18n.js');

    const groups = listLayoutPickerGroups([
      { id: 'custom-1', label: 'My racing layout' }
    ]);

    assert.equal(groups.builtin[0].value, 'builtin:browsing');
    assert.equal(groups.builtin[0].label, undefined);
    assert.equal(groups.builtin[0].builtIn, true);
    assert.equal(getMessage(groups.builtin[0].labelKey), 'Localized Browsing');
    assert.equal(getMessage(groups.builtin[1].labelKey), 'Localized Navigation');

    assert.equal(groups.custom[0].value, 'user:custom-1');
    assert.equal(groups.custom[0].label, 'My racing layout');
    assert.equal(groups.custom[0].builtIn, false);
  });

  it('resolves Function catalog copy while keeping function IDs', async () => {
    mock.setI18nMessages({
      fn_PAGE_TOP_label: { message: 'Localized Top' },
      fn_PAGE_TOP_description: { message: 'Localized jump to top' },
      fn_param_jump_style: { message: 'Localized jump style' },
      fn_param_opt_fade: { message: 'Localized fade' },
      fn_cat_navigation_label: { message: 'Localized Navigation' }
    });
    const { getFunctionDef, getFunctionCategoryLabel } = await import('../extension/src/config/function-library.js');

    const pageTop = getFunctionDef('PAGE_TOP');
    assert.equal(pageTop.id, 'PAGE_TOP');
    assert.equal(pageTop.label, 'Localized Top');
    assert.equal(pageTop.description, 'Localized jump to top');
    assert.equal(pageTop.parameters[0].id, 'mode');
    assert.equal(pageTop.parameters[0].label, 'Localized jump style');
    assert.equal(pageTop.parameters[0].options[0].id, 'fade');
    assert.equal(pageTop.parameters[0].options[0].label, 'Localized fade');
    assert.equal(getFunctionCategoryLabel('Navigation'), 'Localized Navigation');
  });

  it('resolves launcher descriptions without translating public site names', async () => {
    const { LAUNCHER_SITE_CATALOG, getLauncherCatalog } = await import('../extension/src/config/launcher-sites.js');
    const first = LAUNCHER_SITE_CATALOG.social[0];
    mock.setI18nMessages({
      [first.descriptionKey]: { message: 'Localized Instagram blurb' }
    });

    const resolved = getLauncherCatalog('social')[0];
    assert.equal(resolved.title, 'Instagram');
    assert.equal(resolved.url, 'https://instagram.com');
    assert.equal(resolved.description, 'Localized Instagram blurb');
  });

  it('keeps search-engine product names as public labels', async () => {
    const { SEARCH_ENGINE_META, getSearchEngineMeta } = await import('../extension/src/config/search-engines.js');
    assert.equal(SEARCH_ENGINE_META.brave.label, 'Brave');
    assert.equal(getSearchEngineMeta('google').label, 'Google');
    assert.equal(getSearchEngineMeta('google').id, 'google');
  });

  it('maps English and test-locale catalogs to different display strings for the same keys', async () => {
    const { english, testLocale } = await catalogs();
    const { getMessage } = await import('../extension/src/utils/i18n.js');
    const keys = [
      'layout_family_browsing_label',
      'fn_PAGE_TOP_label',
      'context_menu_toggle_keypilot',
      'popup_keyboard_reference',
      'font_info_title'
    ];

    mock.setI18nMessages(english);
    const englishDisplay = Object.fromEntries(keys.map((key) => [key, getMessage(key)]));
    mock.setI18nMessages(testLocale);
    const testDisplay = Object.fromEntries(keys.map((key) => [key, getMessage(key)]));

    for (const key of keys) {
      assert.equal(englishDisplay[key], english[key].message, key);
      assert.equal(testDisplay[key], testLocale[key].message, key);
      assert.notEqual(testDisplay[key], englishDisplay[key], `${key} should differ in the test locale`);
      assert.match(testDisplay[key], /^\[GB\] /);
    }
  });
});
