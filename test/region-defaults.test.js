import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { regionDefaultFiles } from '../extension/src/config/region-defaults-data.js';
import {
  getLauncherSearchSites,
  getRegionDefaults,
  getStockSocialMediaUrls
} from '../extension/src/config/region-defaults.js';
import { getSearchEngineMeta } from '../extension/src/config/search-engines.js';
import { normalizeOpenUrlList } from '../extension/src/utils/open-url-list.js';

describe('region defaults', () => {
  it('packages every i18n region-defaults JSON file inside the extension', () => {
    const names = readdirSync('i18n/region-defaults').filter((name) => name.endsWith('.json')).sort();
    assert.deepEqual(Object.keys(regionDefaultFiles).sort(), names.map((name) => name.slice(0, -5)));
    for (const name of names) {
      const id = name.slice(0, -5);
      const json = JSON.parse(readFileSync(`i18n/region-defaults/${name}`, 'utf8'));
      assert.deepEqual(regionDefaultFiles[id], json);
    }
  });

  it('keeps the English Social Media URL list as the default', () => {
    assert.deepEqual(getStockSocialMediaUrls('en'), [
      'facebook.com',
      'instagram.com',
      'youtube.com',
      'x.com'
    ]);
    assert.deepEqual(normalizeOpenUrlList(getStockSocialMediaUrls('en')), [
      'https://facebook.com/',
      'https://instagram.com/',
      'https://youtube.com/',
      'https://x.com/'
    ]);
  });

  it('applies a non-English Social Media list and Google TLD', () => {
    assert.deepEqual(getStockSocialMediaUrls('ja'), [
      'youtube.com',
      'x.com',
      'instagram.com',
      'line.me',
      'tiktok.com'
    ]);
    assert.equal(getSearchEngineMeta('google', 'ja').homeUrl, 'https://www.google.co.jp/');
    assert.ok(getLauncherSearchSites('ja').some((row) => row.title === 'Yahoo Japan'));
  });

  it('fills omitted zh_HK social sites from zh_TW', () => {
    const urls = getStockSocialMediaUrls('zh-HK');
    assert.ok(urls.includes('line.me'));
    assert.equal(getRegionDefaults('zh-HK').searchEngineUrls.google.homeUrl, 'https://www.google.com.hk/');
  });

  it('fills omitted es_419 social sites from es', () => {
    assert.ok(getStockSocialMediaUrls('es-419').includes('whatsapp.com'));
    assert.equal(getSearchEngineMeta('google', 'es-419').homeUrl, 'https://www.google.com.mx/');
  });
});
