import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const pages = [
  'extension/popup.html',
  'extension/pages/settings.html',
  'extension/pages/docs.html',
  'extension/pages/guide.html',
  'extension/pages/newtab.html'
];

async function catalog(locale) {
  return JSON.parse(await readFile(`extension/_locales/${locale}/messages.json`, 'utf8'));
}

describe('extension-page localization', () => {
  it('defines every static page binding in English and the test locale', async () => {
    const [english, testLocale] = await Promise.all([catalog('en'), catalog('en_GB')]);

    for (const page of pages) {
      const html = await readFile(page, 'utf8');
      const bindings = [...html.matchAll(/\bdata-i18n(?:-(?:placeholder|aria-label|title))?="([^"]+)"/g)];
      assert.ok(bindings.length > 0, `${page} has localized chrome`);
      for (const [, key] of bindings) {
        assert.equal(typeof english[key]?.message, 'string', `${page} English key: ${key}`);
        assert.equal(typeof testLocale[key]?.message, 'string', `${page} test-locale key: ${key}`);
      }
    }
  });

  it('keeps shortcut glyphs out of New Tab localization bindings', async () => {
    const html = await readFile('extension/pages/newtab.html', 'utf8');
    assert.doesNotMatch(html, /data-i18n="[^"]*">(?:Alt\+J|Alt\+K|K)<\/span>/);
  });

  it('binds document titles and placeholders in English and the test locale', async () => {
    const [english, testLocale] = await Promise.all([catalog('en'), catalog('en_GB')]);
    const titlePages = {
      'extension/popup.html': 'popup_document_title',
      'extension/pages/settings.html': 'settings_static_009',
      'extension/pages/docs.html': 'docs_document_title',
      'extension/pages/guide.html': 'guide_document_title',
      'extension/pages/newtab.html': 'newtab_static_019'
    };
    const placeholderPages = {
      'extension/pages/docs.html': 'docs_search_placeholder',
      'extension/pages/newtab.html': 'newtab_static_012'
    };

    for (const [page, key] of Object.entries(titlePages)) {
      const html = await readFile(page, 'utf8');
      assert.match(html, new RegExp(`<title[^>]*data-i18n="${key}"`));
      assert.equal(typeof english[key]?.message, 'string', `English title: ${key}`);
      assert.equal(typeof testLocale[key]?.message, 'string', `test-locale title: ${key}`);
    }

    for (const [page, key] of Object.entries(placeholderPages)) {
      const html = await readFile(page, 'utf8');
      assert.match(html, new RegExp(`data-i18n-placeholder="${key}"`));
      assert.equal(typeof english[key]?.message, 'string', `English placeholder: ${key}`);
      assert.equal(typeof testLocale[key]?.message, 'string', `test-locale placeholder: ${key}`);
    }
  });
});
