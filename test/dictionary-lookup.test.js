import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isWiktionaryNounHeading,
  isWiktionaryPosHeading,
  normalizeWordForLookup,
  wiktionaryOriginForLocale,
  wiktionaryUrlForLocalizedWord,
  wiktionaryUrlForWord
} from '../extension/src/utils/dictionary-lookup.js';

describe('dictionary lookup helpers', () => {
  it('builds a Wiktionary URL for a captured word', () => {
    assert.equal(wiktionaryUrlForWord('  Hello, '), 'https://en.wiktionary.org/wiki/hello');
    assert.equal(normalizeWordForLookup('"well-known"'), 'well-known');
  });

  it('uses the localized Wiktionary site for a UI locale', () => {
    assert.equal(wiktionaryOriginForLocale('de-DE'), 'https://de.wiktionary.org');
    assert.equal(wiktionaryOriginForLocale('es_419'), 'https://es.wiktionary.org');
    assert.equal(wiktionaryOriginForLocale('zh-HK'), 'https://zh.wiktionary.org');
    assert.equal(wiktionaryOriginForLocale('fr-FR'), 'https://en.wiktionary.org');
    assert.equal(
      wiktionaryUrlForLocalizedWord('Hallo', 'de-DE'),
      'https://de.wiktionary.org/wiki/hallo'
    );
  });

  it('stops English possessives before the apostrophe and keeps hyphens', () => {
    assert.equal(normalizeWordForLookup("cat's"), 'cat');
    assert.equal(normalizeWordForLookup('cat’s'), 'cat');
    assert.equal(normalizeWordForLookup("students'"), 'students');
    assert.equal(normalizeWordForLookup("mother-in-law's"), 'mother-in-law');
    assert.equal(normalizeWordForLookup("don't"), "don't");
  });

  it('returns empty when there is no word', () => {
    assert.equal(wiktionaryUrlForWord('   '), '');
    assert.equal(wiktionaryUrlForWord('…'), '');
    assert.equal(normalizeWordForLookup(null), '');
  });

  it('recognizes localized part-of-speech headings', () => {
    assert.equal(isWiktionaryNounHeading('Noun'), true);
    assert.equal(isWiktionaryNounHeading('Substantiv'), true);
    assert.equal(isWiktionaryNounHeading('名詞'), true);
    assert.equal(isWiktionaryPosHeading('Verb'), true);
    assert.equal(isWiktionaryPosHeading('Etymology'), false);
    assert.equal(isWiktionaryPosHeading('Pronunciation'), false);
    assert.equal(isWiktionaryPosHeading('Noun 2'), true);
  });
});
