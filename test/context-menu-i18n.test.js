import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const CONTEXT_MENU_KEYS = [
  'extension_name',
  'context_menu_toggle_keypilot',
  'context_menu_group_windows',
  'context_menu_toggle_keyboard_reference',
  'context_menu_onboarding_tutorial',
  'context_menu_docs_help',
  'context_menu_settings',
  'context_menu_group_keyboard_reference',
  'context_menu_show_keyboard_reference',
  'context_menu_hide_keyboard_reference',
  'context_menu_group_builtin_layouts',
  'context_menu_group_custom_layouts',
  'context_menu_no_custom_layouts',
  'context_menu_group_layout_editor',
  'context_menu_edit_layouts',
  'context_menu_new_layout',
  'context_menu_duplicate_layout',
  'overlay_untitled'
];

describe('context-menu localization', () => {
  it('defines every context-menu message used by the service worker', async () => {
    const [english, testLocale, source] = await Promise.all([
      readFile('extension/_locales/en/messages.json', 'utf8').then(JSON.parse),
      readFile('test/fixtures/locales/en_GB/messages.json', 'utf8').then(JSON.parse),
      readFile('extension/background.js', 'utf8')
    ]);

    for (const key of CONTEXT_MENU_KEYS) {
      assert.equal(typeof english[key]?.message, 'string', `English catalog missing ${key}`);
      assert.equal(typeof testLocale[key]?.message, 'string', `Test locale missing ${key}`);
      assert.match(source, new RegExp(`getMessage\\('${key}'`));
    }

    assert.doesNotMatch(source, /title: 'KeyPilot'/);
    assert.doesNotMatch(source, /createGroup\('KeyPilot Windows'\)/);
    assert.doesNotMatch(source, /title: 'None'/);
  });

  it('refreshes context menus on first registration and browser startup', async () => {
    const source = await readFile('extension/background.js', 'utf8');

    assert.match(
      source,
      /onStartup\.addListener\(async \(\) => \{\s*void refreshKeyboardReferenceContextMenu\(\);/
    );
    assert.match(
      source,
      /onInstalled\.addListener\(async \(details\) => \{\s*void refreshKeyboardReferenceContextMenu\(\);/
    );
    assert.match(source, /scheduleContextMenuI18nRetry/);
    assert.match(
      source,
      /const rootTitle = getMessage\('extension_name'\);\s*if \(!rootTitle\) \{\s*scheduleContextMenuI18nRetry\(\);/
    );
  });
});
