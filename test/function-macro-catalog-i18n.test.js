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

describe('Function and Macro catalog localization', () => {
  it('stores message keys rather than display copy in catalog definitions', async () => {
    const { FUNCTION_LIBRARY } = await import('../extension/src/config/function-library.js');
    const { MACRO_KEY_KIND_DEFS, MACRO_BUILDER_STEP_TYPES } = await import('../extension/src/config/macro-keys.js');

    const pageTop = FUNCTION_LIBRARY.PAGE_TOP;
    assert.equal(pageTop.label, undefined);
    assert.equal(pageTop.description, undefined);
    assert.equal(pageTop.labelKey, 'fn_PAGE_TOP_label');
    assert.equal(pageTop.parameters[0].labelKey, 'fn_param_jump_style');
    assert.equal(pageTop.parameters[0].options[0].labelKey, 'fn_param_opt_fade');

    for (const def of MACRO_KEY_KIND_DEFS) {
      assert.equal(typeof def.labelKey, 'string');
      assert.equal(typeof def.descriptionKey, 'string');
      assert.equal(def.label, undefined);
    }
    for (const step of MACRO_BUILDER_STEP_TYPES) {
      assert.equal(typeof step.labelKey, 'string');
      assert.equal(typeof step.descriptionKey, 'string');
    }
  });

  it('resolves representative Function parameters, categories, and Macro kinds for display', async () => {
    mock.setI18nMessages({
      fn_PAGE_TOP_label: { message: 'Top' },
      fn_PAGE_TOP_description: { message: 'Move to page top' },
      fn_param_jump_style: { message: 'Jump style' },
      fn_param_opt_fade: { message: 'Fade' },
      fn_cat_navigation_label: { message: 'Navigation' },
      mk_hotkey_label: { message: 'Combination / Hotkey' },
      mk_hotkey_description: { message: 'Send a modifier chord' }
    });
    const {
      getFunctionCategoryLabel,
      getFunctionDef
    } = await import('../extension/src/config/function-library.js');
    const {
      localizeMacroCatalogEntry,
      MACRO_KEY_KIND_DEFS
    } = await import('../extension/src/config/macro-keys.js');

    const pageTop = getFunctionDef('PAGE_TOP');
    assert.equal(pageTop.label, 'Top');
    assert.equal(pageTop.parameters[0].label, 'Jump style');
    assert.equal(pageTop.parameters[0].options[0].label, 'Fade');
    assert.equal(getFunctionCategoryLabel('Navigation'), 'Navigation');

    assert.deepEqual(localizeMacroCatalogEntry(MACRO_KEY_KIND_DEFS[0]), {
      id: 'hotkey',
      label: 'Combination / Hotkey',
      description: 'Send a modifier chord'
    });
  });

  it('defines every catalog message in English and the test locale', async () => {
    const [source, macroSource, buildSideEffects, earlyInject, english, testLocale] = await Promise.all([
      readFile('extension/src/config/function-library.js', 'utf8'),
      readFile('extension/src/config/macro-keys.js', 'utf8'),
      readFile('extension/build-side-effects.js', 'utf8'),
      readFile('extension/early-inject.js', 'utf8'),
      readFile('extension/_locales/en/messages.json', 'utf8').then(JSON.parse),
      readFile('test/fixtures/locales/en_GB/messages.json', 'utf8').then(JSON.parse)
    ]);
    const { FUNCTION_LIBRARY } = await import('../extension/src/config/function-library.js');
    const { MACRO_KEY_KIND_DEFS, MACRO_BUILDER_STEP_TYPES } = await import('../extension/src/config/macro-keys.js');
    const keys = new Set([
      ...[...source.matchAll(/(?:labelKey|descriptionKey|detailsKey|placeholderKey|groupKey|addLabelKey|removeLabelKey):\s*'([^']+)'/g)].map((match) => match[1]),
      ...[...macroSource.matchAll(/(?:labelKey|descriptionKey|detailsKey):\s*'([^']+)'/g)].map((match) => match[1]),
      ...[...source.matchAll(/:\s*'(fn_cat_[^']+|fn_section_[^']+)'/g)].map((match) => match[1])
    ]);
    assert.match(buildSideEffects, /labelKey: String\(def\.labelKey \|\| ''\)/);
    assert.match(earlyInject, /earlyMessage\(def\.labelKey\)/);
    assert.match(earlyInject, /earlyMessage\(`fn_\$\{item\.id\}_label`\)/);
    keys.add('early_configured_function');
    keys.add('fn_summary_empty');
    keys.add('fn_summary_previous_step');
    keys.add('fn_summary_script');
    keys.add('fn_summary_url_one');
    keys.add('fn_summary_url_count');
    keys.add('fn_open_urls_none');
    keys.add('fn_open_urls_opened_one');
    keys.add('fn_open_urls_opened');
    keys.add('fn_open_urls_failed');
    keys.add('fn_instance_name_label');
    keys.add('fn_open_bookmarks_none');
    keys.add('fn_open_bookmarks_empty');
    keys.add('fn_open_bookmarks_opened_one');
    keys.add('fn_open_bookmarks_opened');
    keys.add('fn_open_bookmarks_failed');
    keys.add('fn_summary_bookmark_folder');
    keys.add('fn_param_bookmark_folder_loading');
    keys.add('fn_param_bookmark_folder_empty');
    keys.add('fn_param_bookmark_folder_missing');
    keys.add('fn_param_bookmark_folder_hint');
    keys.add('mk_editor_key');
    for (const def of Object.values(FUNCTION_LIBRARY)) {
      for (const key of [def.labelKey, def.descriptionKey, def.detailsKey]) keys.add(key);
      for (const param of def.parameters || []) {
        for (const key of [param.labelKey, param.placeholderKey, param.groupKey]) keys.add(key);
        for (const option of param.options || []) keys.add(option?.labelKey);
      }
    }
    for (const def of [...MACRO_KEY_KIND_DEFS, ...MACRO_BUILDER_STEP_TYPES]) {
      keys.add(def.labelKey);
      keys.add(def.descriptionKey);
      keys.add(def.detailsKey);
    }

    for (const key of keys) {
      if (!key || key.includes('${')) continue;
      assert.equal(typeof english[key]?.message, 'string', `English catalog missing ${key}`);
      assert.equal(typeof testLocale[key]?.message, 'string', `Test locale missing ${key}`);
    }
  });
});
