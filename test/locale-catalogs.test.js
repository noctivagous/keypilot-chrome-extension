import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  catalogIssues,
  mergeLocaleCatalog,
  parentCatalogLocale
} from '../scripts/locale-catalogs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function entry(message, placeholders) {
  return placeholders ? { message, placeholders } : { message };
}

const source = {
  locale_tag: entry('en'),
  shared: entry('Shared'),
  named: entry('Hello $NAME$', { NAME: { content: '$1' } })
};

describe('parent catalog gaps', () => {
  const shipped = ['en', 'es', 'es_419', 'de', 'zh_CN', 'zh_HK'];

  it('uses a shipped language catalog as the parent of a regional catalog', () => {
    assert.equal(parentCatalogLocale('es_419', shipped), 'es');
    assert.equal(parentCatalogLocale('en_GB', ['en', 'es']), 'en');
    assert.equal(parentCatalogLocale('de', shipped), null);
    assert.equal(parentCatalogLocale('zh_HK', shipped), null);
    assert.equal(parentCatalogLocale('zh_CN', shipped), null);
  });

  it('accepts a regional key omitted from the child when the parent defines it', () => {
    const parent = {
      locale_tag: entry('es'),
      shared: entry('Compartido'),
      named: entry('Hola $NAME$', { NAME: { content: '$1' } })
    };
    const regional = {
      locale_tag: entry('es-419')
    };
    assert.deepEqual(catalogIssues(source, regional, 'es_419', parent), []);
  });

  it('rejects a gap the parent language catalog does not cover', () => {
    const parent = {
      locale_tag: entry('es'),
      shared: entry('Compartido')
    };
    const issues = catalogIssues(source, { locale_tag: entry('es-419') }, 'es_419', parent);
    assert.deepEqual(issues, ['es_419: missing "named"']);
  });

  it('still requires every English key in a language catalog', () => {
    const issues = catalogIssues(source, { locale_tag: entry('de') }, 'de', null);
    assert.deepEqual(issues, ['de: missing "shared"', 'de: missing "named"']);
  });

  it('rejects an empty override and a placeholder mismatch', () => {
    const parent = {
      locale_tag: entry('es'),
      shared: entry('Compartido'),
      named: entry('Hola $NAME$', { NAME: { content: '$1' } })
    };
    const regional = {
      locale_tag: entry('  '),
      named: entry('Hola')
    };
    assert.deepEqual(catalogIssues(source, regional, 'es_419', parent), [
      'es_419: "locale_tag" has an empty or invalid message',
      'es_419: "named" placeholders differ (expected [NAME], found [])'
    ]);
  });

  it('fills site keyboard strings from the parent catalog', () => {
    const merged = mergeLocaleCatalog(
      { keyboard_help_title: entry('Teclado'), only_parent: entry('padre') },
      { locale_tag: entry('es-419'), only_parent: entry('región') }
    );
    assert.equal(merged.keyboard_help_title.message, 'Teclado');
    assert.equal(merged.only_parent.message, 'región');
    assert.equal(merged.locale_tag.message, 'es-419');
  });

  it('lets the shipped es catalog cover an omitted es_419 key', () => {
    const en = JSON.parse(readFileSync(join(root, 'extension/_locales/en/messages.json'), 'utf8'));
    const es = JSON.parse(readFileSync(join(root, 'extension/_locales/es/messages.json'), 'utf8'));
    const es419 = JSON.parse(readFileSync(join(root, 'extension/_locales/es_419/messages.json'), 'utf8'));
    delete es419.extension_name;
    assert.ok(es.extension_name);
    assert.deepEqual(catalogIssues(en, es419, 'es_419', es), []);
  });
});
