import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractReaderArticle,
  htmlFromSelection,
  escapeHtml,
  isReaderModeRestrictedUrl,
  MIN_ARTICLE_CHARS
} from '../extension/src/utils/reader-mode-extract.js';

describe('reader mode extract', () => {
  it('prefers a non-empty selection over Readability', () => {
    let constructed = false;
    class FakeReadability {
      constructor() { constructed = true; }
      parse() {
        return {
          title: 'Ignored',
          content: '<p>from readability</p>',
          textContent: 'from readability '.repeat(20)
        };
      }
    }

    const article = extractReaderArticle({
      document: { cloneNode() { return {}; } },
      selectionText: 'Hello\n\nWorld',
      pageTitle: 'Example',
      pageUrl: 'https://example.com/article',
      Readability: FakeReadability
    });

    assert.equal(constructed, false);
    assert.equal(article.source, 'selection');
    assert.equal(article.title, 'Example');
    assert.equal(article.html, '<p>Hello</p><p>World</p>');
  });

  it('uses Readability when there is no selection', () => {
    class FakeReadability {
      constructor(doc) {
        this.doc = doc;
      }
      parse() {
        const body = 'Article body '.repeat(20);
        return {
          title: 'Distilled',
          byline: 'Byline',
          content: `<p>${body}</p>`,
          textContent: body
        };
      }
    }

    const article = extractReaderArticle({
      document: { cloneNode() { return { cloned: true }; } },
      selectionText: '   ',
      pageTitle: 'Fallback',
      pageUrl: 'https://example.com/article',
      Readability: FakeReadability
    });

    assert.equal(article.source, 'readability');
    assert.equal(article.title, 'Distilled');
    assert.equal(article.byline, 'Byline');
    assert.match(article.html, /Article body/);
  });

  it('returns null when Readability finds too little text', () => {
    class FakeReadability {
      parse() {
        return { title: 'T', content: '<p>Hi</p>', textContent: 'Hi' };
      }
    }

    const article = extractReaderArticle({
      document: { cloneNode() { return {}; } },
      pageUrl: 'https://example.com/',
      Readability: FakeReadability
    });

    assert.equal(article, null);
    assert.ok(MIN_ARTICLE_CHARS > 10);
  });

  it('rejects restricted URLs', () => {
    assert.equal(isReaderModeRestrictedUrl('chrome://settings'), true);
    assert.equal(isReaderModeRestrictedUrl('https://example.com/post'), false);

    const article = extractReaderArticle({
      document: { cloneNode() { return {}; } },
      selectionText: 'Plenty of selected text for a reader overlay.',
      pageUrl: 'chrome://extensions',
      Readability: class { parse() { return null; } }
    });
    assert.equal(article, null);
  });

  it('escapes selection HTML', () => {
    assert.equal(escapeHtml('<b>&"'), '&lt;b&gt;&amp;&quot;');
    assert.equal(htmlFromSelection('a < b'), '<p>a &lt; b</p>');
  });
});
