import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const FAMILY_MESSAGE_KEYS = [
  'layout_family_browsing_label',
  'layout_family_browsing_description',
  'layout_family_browsing_picker',
  'layout_family_navigation_label',
  'layout_family_navigation_description',
  'layout_family_navigation_picker',
  'layout_family_basic_navigation_label',
  'layout_family_basic_navigation_picker',
  'layout_picker_group_builtin',
  'layout_picker_group_custom',
  'layout_picker_docs',
  'layout_picker_settings'
];

describe('keyboard layout family localization', () => {
  it('keeps built-in family metadata as message keys', async () => {
    const [source, settings, buildSideEffects, earlyInject] = await Promise.all([
      readFile('extension/src/config/keyboard-layouts.js', 'utf8'),
      readFile('extension/pages/settings.js', 'utf8'),
      readFile('extension/build-side-effects.js', 'utf8'),
      readFile('extension/early-inject.js', 'utf8')
    ]);

    assert.match(source, /labelKey: 'layout_family_browsing_label'/);
    assert.match(source, /descriptionKey: 'layout_family_browsing_description'/);
    assert.match(source, /labelKey: 'layout_family_navigation_label'/);
    assert.match(source, /descriptionKey: 'layout_family_navigation_description'/);
    assert.match(source, /labelKey: fam\.labelKey/);
    assert.doesNotMatch(source, /label: 'Browsing'/);
    assert.doesNotMatch(source, /label: 'Navigation'/);
    assert.match(settings, /getMessage\(m\.labelKey\)/);
    assert.match(buildSideEffects, /m\.labelKey/);
    assert.match(earlyInject, /earlyMessage\(String\(pair\[1\]\)\)/);
    assert.match(source, /getMessage\(`fn_\$\{id\}_label`\)/);
  });

  it('defines all layout-family messages in English and the test locale', async () => {
    const [english, testLocale] = await Promise.all([
      readFile('extension/_locales/en/messages.json', 'utf8').then(JSON.parse),
      readFile('test/fixtures/locales/en_GB/messages.json', 'utf8').then(JSON.parse)
    ]);

    for (const key of FAMILY_MESSAGE_KEYS) {
      assert.equal(typeof english[key]?.message, 'string', `English catalog missing ${key}`);
      assert.equal(typeof testLocale[key]?.message, 'string', `Test locale missing ${key}`);
    }
  });
});
