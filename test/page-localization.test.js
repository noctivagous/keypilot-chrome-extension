import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const pages = [
  'extension/popup.html',
  'extension/pages/settings.html',
  'extension/pages/docs.html',
  'extension/pages/guide.html',
  'extension/pages/newtab.html'
];

const ENGLISH_CATALOG = 'extension/_locales/en/messages.json';
const TEST_LOCALE_CATALOG = 'test/fixtures/locales/en_GB/messages.json';

async function catalog(locale) {
  return JSON.parse(await readFile(locale === 'en' ? ENGLISH_CATALOG : TEST_LOCALE_CATALOG, 'utf8'));
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

  it('does not ship test-locale prefixes such as [GB] or [ES] in extension/_locales', async () => {
    const locales = await readdir('extension/_locales', { withFileTypes: true });
    const shipped = locales.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    assert.ok(shipped.includes('en'), 'English catalog is shipped');

    for (const locale of shipped) {
      const messages = JSON.parse(await readFile(`extension/_locales/${locale}/messages.json`, 'utf8'));
      for (const [key, entry] of Object.entries(messages)) {
        assert.equal(typeof entry?.message, 'string', `${locale} ${key}`);
        assert.doesNotMatch(
          entry.message,
          /^\[[A-Z]{2}(?:_[A-Z0-9]+)?\]\s/,
          `${locale}/${key} looks like a test marker, not a translation`
        );
      }
    }
  });

  it('keeps shortcut glyphs out of New Tab localization bindings', async () => {
    const html = await readFile('extension/pages/newtab.html', 'utf8');
    assert.doesNotMatch(html, /data-i18n="[^"]*">(?:Alt\+J|Alt\+K|K)<\/span>/);
  });

  it('marks popup and New Tab shortcut chips for host-OS fill-in', async () => {
    const popup = await readFile('extension/popup.html', 'utf8');
    assert.match(popup, /data-kp-alt-mod/);
    assert.match(popup, /data-kp-alt-shortcut="H"/);
    assert.match(popup, /data-kp-alt-shortcut="I"/);
    assert.match(popup, /data-kp-alt-shortcut="J"/);

    const newtab = await readFile('extension/pages/newtab.html', 'utf8');
    assert.match(newtab, /data-kp-alt-shortcut="K"/);
    assert.match(newtab, /data-kp-alt-shortcut="J"/);
  });

  it('uses $1 placeholders for OS-sensitive Alt/Opt catalog copy', async () => {
    const [english, testLocale] = await Promise.all([catalog('en'), catalog('en_GB')]);
    const keys = [
      'popup_hotkey_toggle_aria_label',
      'settings_static_038',
      'settings_static_104',
      'settings_static_218',
      'newtab_static_005',
      'newtab_static_024'
    ];
    for (const key of keys) {
      assert.match(english[key].message, /\$1/, `English ${key}`);
      assert.match(testLocale[key].message, /\$1/, `test-locale ${key}`);
      assert.equal(english[key].placeholders?.shortcut?.content, '$1', `English ${key} placeholder`);
      assert.equal(testLocale[key].placeholders?.shortcut?.content, '$1', `test-locale ${key} placeholder`);
    }
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
