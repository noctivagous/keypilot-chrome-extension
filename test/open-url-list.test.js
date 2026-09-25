import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';
import { normalizeOpenUrlList, OPEN_URLS_MAX } from '../extension/src/utils/open-url-list.js';

/** @type {ReturnType<typeof installChromeMock>} */
let mock;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
  mock.setI18nMessages({
    fn_summary_empty: { message: '(empty)' },
    fn_summary_url_one: { message: '1 URL' },
    fn_summary_url_count: {
      message: '$COUNT$ URLs',
      placeholders: { count: { content: '$1' } }
    }
  });
});

describe('open URL list', () => {
  it('keeps http(s) websites, adds https, and drops everything else', () => {
    assert.deepEqual(
      normalizeOpenUrlList([
        'news.ycombinator.com',
        'https://www.theverge.com/tech',
        'http://example.com/a',
        'javascript:alert(1)',
        'chrome://settings',
        'not a url',
        '',
        'https://www.theverge.com/tech'
      ]),
      [
        'https://news.ycombinator.com/',
        'https://www.theverge.com/tech',
        'http://example.com/a'
      ]
    );
  });

  it('caps the list', () => {
    const raw = Array.from({ length: 30 }, (_item, i) => `https://example.com/${i}`);
    assert.equal(normalizeOpenUrlList(raw).length, OPEN_URLS_MAX);
  });

  it('registers Open URLs as an instantiable key action', async () => {
    const {
      isFunctionInstantiable,
      functionAssignableToKey,
      normalizeFunctionParameters,
      summarizeFunctionParameters,
      getFunctionDef
    } = await import('../extension/src/config/function-library.js');

    assert.equal(isFunctionInstantiable('OPEN_URLS'), true);
    assert.equal(functionAssignableToKey('OPEN_URLS'), true);
    assert.equal(getFunctionDef('OPEN_URLS').handler, 'handleOpenUrlsKey');
    assert.equal(getFunctionDef('OPEN_URLS').category, 'Tab Control');
    const urlsParam = getFunctionDef('OPEN_URLS').parameters.find((param) => param.id === 'urls');
    assert.equal(urlsParam.presentation, 'table');
    assert.equal(urlsParam.visibleRows, 5);
    assert.equal(urlsParam.maxItems, OPEN_URLS_MAX);

    const parameters = normalizeFunctionParameters('OPEN_URLS', {
      urls: ['example.com', 'javascript:alert(1)', 'https://example.com/']
    });
    assert.deepEqual(parameters.urls, ['https://example.com/']);
    assert.equal(summarizeFunctionParameters('OPEN_URLS', { urls: [] }), '(empty)');
    assert.equal(
      summarizeFunctionParameters('OPEN_URLS', { urls: ['https://example.com'] }),
      '1 URL'
    );
    assert.equal(
      summarizeFunctionParameters('OPEN_URLS', {
        urls: ['https://a.example', 'https://b.example']
      }),
      '2 URLs'
    );
  });

  it('binds the bundled Social media instance on Browsing / and its left-handed mirror', async () => {
    const { buildKeybindingsForLayout } = await import('../extension/src/config/keyboard-layouts.js');
    const right = buildKeybindingsForLayout('browsing-right')['stock:social-media'];
    const left = buildKeybindingsForLayout('browsing-left')['stock:social-media'];
    assert.equal(right.keys[0], 'Slash');
    assert.equal(right.handler, 'handleOpenUrlsKey');
    assert.deepEqual(right.parameters.urls, [
      'https://facebook.com/',
      'https://instagram.com/',
      'https://youtube.com/',
      'https://x.com/'
    ]);
    assert.equal(left.keys[0], 'KeyZ');
    assert.deepEqual(left.parameters.urls, right.parameters.urls);
    assert.equal(buildKeybindingsForLayout('basic-navigation-right')['stock:social-media'], undefined);
    assert.equal(buildKeybindingsForLayout('click-history-left')['stock:social-media'], undefined);
  });

  it('binds the bundled Random Bookmark instance on Browsing comma and its left-handed mirror', async () => {
    const { buildKeybindingsForLayout } = await import('../extension/src/config/keyboard-layouts.js');
    const right = buildKeybindingsForLayout('browsing-right')['stock:random-bookmark'];
    const left = buildKeybindingsForLayout('browsing-left')['stock:random-bookmark'];
    assert.equal(right.keys[0], 'Comma');
    assert.equal(right.handler, 'handleRandomBookmarkKey');
    assert.equal(right.parameters.folderId, '');
    assert.equal(right.parameters.count, 1);
    assert.equal(left.keys[0], 'KeyC');
    assert.deepEqual(left.parameters, right.parameters);
    assert.equal(buildKeybindingsForLayout('basic-navigation-right')['stock:random-bookmark'], undefined);
    assert.equal(buildKeybindingsForLayout('click-history-left')['stock:random-bookmark'], undefined);
  });
});
