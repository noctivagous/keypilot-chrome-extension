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
    'top_sites_empty_toolbar',
    'top_sites_options_aria',
    'top_sites_count',
    'top_sites_count_one'
  ]],
  ['extension/src/modules/tab-history-popover.js', [
    'tab_history_section_tabs',
    'tab_history_section_browser'
  ]],
  ['extension/src/modules/launcher-popover.js', [
    'launcher_title',
    'launcher_footer_hint',
    'launcher_subtab_launch_deck',
    'launcher_edit_deck',
    'launcher_filter_placeholder',
    'launcher_archive_search_label',
    'launcher_visited_on'
  ]],
  ['extension/src/keypilot.js', [
    'settings_static_009',
    'docs_document_title',
    'docs_text_size_label',
    'popup_docs'
  ]],
  ['extension/pages/settings.js', [
    'settings_static_018',
    'settings_click_effect_hint',
    'settings_paint_mode_hint',
    'settings_control_strip_lead'
  ]],
  ['extension/src/ui/keybindings-ui.js', [
    'key_info_key',
    'key_info_settings_hint',
    'key_info_config'
  ]],
  ['extension/src/ui/floating-keyboard-help.js', [
    'layout_picker_group_builtin',
    'layout_picker_group_custom',
    'layout_picker_docs',
    'layout_picker_settings',
    'context_menu_group_layout_editor',
    'context_menu_edit_layouts',
    'popup_tutorial'
  ]]
];

describe('overlay and popover localization', () => {
  it('defines overlay keys in English and the test locale', async () => {
    const [english, testLocale] = await Promise.all([
      readFile('extension/_locales/en/messages.json', 'utf8').then(JSON.parse),
      readFile('test/fixtures/locales/en_GB/messages.json', 'utf8').then(JSON.parse)
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
      readFile('test/fixtures/locales/en_GB/messages.json', 'utf8').then(JSON.parse)
    ]);
    assert.deepEqual(Object.keys(english).sort(), Object.keys(testLocale).sort());
  });
});
