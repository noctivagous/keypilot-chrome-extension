import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractReaderArticle,
  htmlFromSelection,
  escapeHtml,
  isReaderModeRestrictedUrl,
  isPromoHeading,
  extractLooksLikePromo,
  extractIsTooNarrow,
  isReaderChromeElement,
  pruneReaderChrome,
  isSamePageHashHref,
  normalizeElementId,
  claimElementId,
  mintHeadingId,
  collectReaderToc,
  MIN_ARTICLE_CHARS,
  MIN_READER_TOC_HEADINGS,
  READABILITY_MIN_CHARS
} from '../extension/src/utils/reader-mode-extract.js';

describe('reader mode extract', () => {
  it('prefers a non-empty selection over Readability', async () => {
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

    const article = await extractReaderArticle({
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

  it('uses Readability when there is no selection', async () => {
    class FakeReadability {
      constructor(doc) {
        this.doc = doc;
      }
      parse() {
        const body = 'Article body '.repeat(50);
        return {
          title: 'Distilled',
          byline: 'Byline',
          siteName: 'Example',
          publishedTime: '2026-09-24',
          content: `<p>${body}</p>`,
          textContent: body
        };
      }
    }

    const article = await extractReaderArticle({
      document: { cloneNode() { return { cloned: true }; } },
      selectionText: '   ',
      pageTitle: 'Fallback',
      pageUrl: 'https://example.com/article',
      Readability: FakeReadability
    });

    assert.equal(article.source, 'readability');
    assert.equal(article.title, 'Distilled');
    assert.equal(article.byline, 'Byline');
    assert.equal(article.siteName, 'Example');
    assert.equal(article.publishedTime, '2026-09-24');
    assert.match(article.html, /Article body/);
    assert.equal(READABILITY_MIN_CHARS, 500);
  });

  it('returns null when Readability finds too little text', async () => {
    class FakeReadability {
      parse() {
        return { title: 'T', content: '<p>Hi</p>', textContent: 'Hi' };
      }
    }

    const article = await extractReaderArticle({
      document: { cloneNode() { return {}; } },
      pageUrl: 'https://example.com/',
      Readability: FakeReadability
    });

    assert.equal(article, null);
    assert.ok(MIN_ARTICLE_CHARS > 10);
  });

  it('rejects restricted URLs', async () => {
    assert.equal(isReaderModeRestrictedUrl('chrome://settings'), true);
    assert.equal(isReaderModeRestrictedUrl('https://example.com/post'), false);

    const article = await extractReaderArticle({
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

  it('treats Sponsor Posts as a promo heading', () => {
    assert.equal(isPromoHeading('Sponsor Posts'), true);
    assert.equal(isPromoHeading('Top News'), false);
    assert.equal(extractLooksLikePromo('<h2>Sponsor Posts</h2><p>Paid blurb</p>', 'Techmeme'), true);
    assert.equal(extractIsTooNarrow(900, 15000), true);
    assert.equal(extractIsTooNarrow(8000, 15000), false);
  });

  it('falls back to the primary column when Readability returns a promo sliver', async () => {
    const riverText = 'Top News item '.repeat(400);
    const river = {
      id: 'topcol1',
      className: '',
      textContent: riverText,
      innerHTML: `<h2>Top News</h2><p>${riverText}</p>`
    };
    const clone = {
      cloneNode() { return this; },
      body: { textContent: `${riverText} ${'sidebar extra '.repeat(80)}` },
      querySelectorAll(sel) {
        if (String(sel).startsWith('h1')) return [];
        return [river];
      }
    };
    class FakeReadability {
      parse() {
        return {
          title: 'Techmeme',
          content: '<h2>Sponsor Posts</h2><p>A short sponsored blurb with enough characters to pass the floor.</p>',
          textContent: 'Sponsor Posts A short sponsored blurb with enough characters to pass the floor.'
        };
      }
    }

    const article = await extractReaderArticle({
      document: { cloneNode: () => clone },
      pageTitle: 'Techmeme',
      pageUrl: 'https://www.techmeme.com/',
      Readability: FakeReadability
    });

    assert.equal(article.source, 'region');
    assert.match(article.html, /Top News/);
    assert.doesNotMatch(article.html, /Sponsor Posts/);
  });

  it('keeps article headers and drops nav, footer, and site landmarks', () => {
    const el = (tagName, role = '') => ({
      nodeType: 1,
      tagName,
      getAttribute(name) { return name === 'role' ? role : null; }
    });
    assert.equal(isReaderChromeElement(el('NAV')), true);
    assert.equal(isReaderChromeElement(el('FOOTER')), true);
    assert.equal(isReaderChromeElement(el('HEADER')), false);
    assert.equal(isReaderChromeElement(el('HEADER', 'banner')), true);
    assert.equal(isReaderChromeElement(el('DIV', 'navigation')), true);
    assert.equal(isReaderChromeElement(el('DIV', 'banner')), true);
    assert.equal(isReaderChromeElement(el('DIV', 'contentinfo')), true);
    assert.equal(isReaderChromeElement(el('ARTICLE')), false);
    assert.equal(isReaderChromeElement(el('P')), false);

    let selector = '';
    pruneReaderChrome({
      querySelectorAll(sel) {
        selector = String(sel);
        return [];
      }
    });
    assert.match(selector, /\bnav\b/);
    assert.match(selector, /\bfooter\b/);
    assert.match(selector, /banner/);
    assert.match(selector, /contentinfo/);
    assert.doesNotMatch(selector, /(^|,\s*)header(\s*,|$)/);
  });

  it('builds a contents list from three or more h2 and h3 headings', () => {
    assert.equal(isSamePageHashHref('#Introduction'), true);
    assert.equal(isSamePageHashHref('#foo%20bar'), true);
    assert.equal(isSamePageHashHref('#'), false);
    assert.equal(isSamePageHashHref('https://example.com/a#b'), false);
    assert.equal(normalizeElementId(' Historical_example '), 'Historical_example');
    assert.equal(normalizeElementId('bad id'), '');

    const used = new Set();
    assert.equal(claimElementId('intro', used), 'intro');
    assert.equal(claimElementId('intro', used), '');
    assert.equal(mintHeadingId(used), 'kp-reader-h-1');
    assert.equal(MIN_READER_TOC_HEADINGS, 3);

    const heading = (tag, text, id) => ({
      tagName: tag,
      textContent: text,
      id,
      getAttribute(name) { return name === 'id' ? id : null; }
    });
    const root = (headings) => ({
      querySelectorAll() { return headings; }
    });

    assert.deepEqual(collectReaderToc(root([
      heading('H2', 'One', 'one'),
      heading('H2', 'Two', 'two')
    ])), []);
    assert.deepEqual(collectReaderToc(root([
      heading('H2', 'One', 'one'),
      heading('H3', '  Nested  ', 'nested'),
      heading('H2', '', 'empty'),
      heading('H4', 'Ignored', 'h4'),
      heading('H2', 'Three', 'three')
    ])), [
      { id: 'one', text: 'One', level: 2 },
      { id: 'nested', text: 'Nested', level: 3 },
      { id: 'three', text: 'Three', level: 2 }
    ]);
  });

  it('skips Readability when the page does not look readerable', async () => {
    let constructed = false;
    class FakeReadability {
      constructor() { constructed = true; }
      parse() {
        const body = 'Should not run '.repeat(40);
        return { title: 'Nope', content: `<p>${body}</p>`, textContent: body };
      }
    }
    const riverText = 'Column text '.repeat(40);
    const article = await extractReaderArticle({
      document: {
        cloneNode() {
          return {
            cloneNode() { return this; },
            body: { textContent: `${riverText} ${'sidebar extra '.repeat(80)}` },
            querySelectorAll(sel) {
              if (String(sel).startsWith('h1')) return [];
              if (String(sel).includes('nav')) return [];
              return [{
                id: 'content',
                className: 'article',
                textContent: riverText,
                innerHTML: `<p>${riverText}</p>`
              }];
            }
          };
        }
      },
      pageTitle: 'River',
      pageUrl: 'https://example.com/',
      Readability: FakeReadability,
      isProbablyReaderable: () => false
    });
    assert.equal(constructed, false);
    assert.equal(article.source, 'region');
    assert.match(article.html, /Column text/);
  });
});
