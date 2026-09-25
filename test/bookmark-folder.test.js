import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  collectBookmarkUrls,
  listBookmarkFolders,
  normalizeBookmarkFolderId,
  normalizeRandomBookmarkCount,
  OPEN_BOOKMARKS_MAX,
  pickRandomBookmarkUrls
} from '../extension/src/utils/bookmark-folder.js';

const TREE = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks bar',
        children: [
          { id: '10', title: 'News', url: 'https://news.example/' },
          {
            id: '11',
            title: 'Tech',
            children: [
              { id: '12', title: 'HN', url: 'news.ycombinator.com' },
              { id: '13', title: 'Bad', url: 'javascript:alert(1)' }
            ]
          },
          { id: '14', title: 'Again', url: 'https://news.example/' }
        ]
      },
      {
        id: '2',
        title: 'Other bookmarks',
        children: []
      }
    ]
  }
];

describe('bookmark folders', () => {
  it('lists folders in tree order and skips the root', () => {
    assert.deepEqual(listBookmarkFolders(TREE), [
      { id: '1', path: 'Bookmarks bar' },
      { id: '11', path: 'Bookmarks bar / Tech' },
      { id: '2', path: 'Other bookmarks' }
    ]);
  });

  it('collects the first website bookmarks, including subfolders', () => {
    assert.deepEqual(collectBookmarkUrls(TREE), [
      'https://news.example/',
      'https://news.ycombinator.com/',
      'https://news.example/'
    ]);
    assert.equal(normalizeBookmarkFolderId(' 12 '), '12');
    assert.equal(normalizeBookmarkFolderId('bad id'), '');
    const many = [{
      children: Array.from({ length: 40 }, (_item, index) => ({
        url: `https://site${index}.example/`
      }))
    }];
    assert.equal(collectBookmarkUrls(many).length, OPEN_BOOKMARKS_MAX);
    assert.equal(collectBookmarkUrls(many)[0], 'https://site0.example/');
    assert.equal(collectBookmarkUrls(many, Infinity).length, 40);
  });

  it('picks distinct random bookmarks up to the requested count', () => {
    assert.equal(normalizeRandomBookmarkCount(undefined), 1);
    assert.equal(normalizeRandomBookmarkCount(0), 1);
    assert.equal(normalizeRandomBookmarkCount(99), 30);
    assert.equal(normalizeRandomBookmarkCount(10.4), 10);
    const urls = ['https://a.example/', 'https://b.example/', 'https://a.example/', 'https://c.example/'];
    let step = 0;
    const rolls = [0, 0.99];
    assert.deepEqual(
      pickRandomBookmarkUrls(urls, 2, () => rolls[step++]),
      ['https://a.example/', 'https://c.example/']
    );
    assert.equal(pickRandomBookmarkUrls(urls, 10).length, 3);
  });
});
