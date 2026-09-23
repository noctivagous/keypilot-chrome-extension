import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { urlFromAddressInput } from '../extension/src/utils/address-input.js';

describe('omnibox IDN address input', () => {
  it('navigates Unicode and punycode internationalized domain names', () => {
    assert.equal(urlFromAddressInput('例子.中国'), 'https://例子.中国');
    assert.equal(urlFromAddressInput('例子.中国/path?q=1'), 'https://例子.中国/path?q=1');
    assert.equal(urlFromAddressInput('例子。中国'), 'https://例子.中国');
    assert.equal(urlFromAddressInput('münchen.de'), 'https://münchen.de');
    assert.equal(urlFromAddressInput('xn--fsqu00a.xn--fiqs8s'), 'https://xn--fsqu00a.xn--fiqs8s');
    assert.equal(urlFromAddressInput('https://例子.中国'), 'https://例子.中国');
  });

  it('keeps CJK search text and spaced queries as searches', () => {
    assert.equal(urlFromAddressInput('中文搜索'), '');
    assert.equal(urlFromAddressInput('北京 天气'), '');
    assert.equal(urlFromAddressInput('alice in wonderland archive.org'), '');
  });

  it('preserves ASCII hosts, localhost, and IPv4 navigation', () => {
    assert.equal(urlFromAddressInput('example.com'), 'https://example.com');
    assert.equal(urlFromAddressInput('foo.io/path'), 'https://foo.io/path');
    assert.equal(urlFromAddressInput('localhost:3000'), 'https://localhost:3000');
    assert.equal(urlFromAddressInput('192.168.1.1'), 'https://192.168.1.1');
    assert.equal(urlFromAddressInput('user@例子.中国'), 'https://user@例子.中国');
  });
});
