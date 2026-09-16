import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const OVERLAY_KEYS = [
  ['extension/src/ui/keypilot-hub.js', [
    'popup_keyboard_reference',
    'popup_docs',
    'popup_tutorial',
    'popup_settings',
    'popup_control_strip'
  ]],
  ['extension/src/ui/font-info-popover.js', [
    'font_info_title',
    'font_info_copy',
    'font_info_download',
    'font_info_done'
  ]],
  ['extension/src/ui/procedure-result-popover.js', [
    'procedure_result_copy',
    'procedure_result_done',
    'procedure_result_title'
  ]],
  ['extension/src/ui/media-library-overlay.js', [
    'media_library_title',
    'media_library_download_selected',
    'media_library_delete_selected'
  ]],
  ['extension/src/ui/page-media-overlay.js', [
    'page_media_tab_image',
    'page_media_empty',
    'page_media_empty_url'
  ]],
  ['extension/src/modules/top-sites-popover.js', [
    'top_sites_tab_toolbar',
    'top_sites_empty_toolbar'
  ]],
  ['extension/src/modules/tab-history-popover.js', [
    'tab_history_section_tabs',
    'tab_history_section_browser'
  ]]
];

describe('overlay and popover localization', () => {
  it('defines overlay keys in English and the test locale', async () => {
    const [english, testLocale] = await Promise.all([
      readFile('extension/_locales/en/messages.json', 'utf8').then(JSON.parse),
      readFile('extension/_locales/en_GB/messages.json', 'utf8').then(JSON.parse)
    ]);

    for (const [file, keys] of OVERLAY_KEYS) {
      const source = await readFile(file, 'utf8');
      for (const key of keys) {
        assert.equal(typeof english[key]?.message, 'string', `English catalog missing ${key}`);
        assert.equal(typeof testLocale[key]?.message, 'string', `Test locale missing ${key}`);
        assert.match(source, new RegExp(`'${key}'`));
      }
    }
  });

  it('keeps English and test-locale overlay catalogs in key parity', async () => {
    const [english, testLocale] = await Promise.all([
      readFile('extension/_locales/en/messages.json', 'utf8').then(JSON.parse),
      readFile('extension/_locales/en_GB/messages.json', 'utf8').then(JSON.parse)
    ]);
    assert.deepEqual(Object.keys(english).sort(), Object.keys(testLocale).sort());
  });
});
