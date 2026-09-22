import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { KP_SETTINGS_PANEL_IDS, parseKpDeepLink } from '../extension/src/utils/kp-deep-link.js';
import { rewriteExactAltKbdHtml } from '../extension/src/utils/platform.js';
import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const userdocsRoot = join(root, 'extension/userdocs');
const englishDir = join(userdocsRoot, 'en');

/** @type {ReturnType<typeof installChromeMock>} */
let mock;
/** @type {typeof fetch | undefined} */
let originalFetch;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
});

afterEach(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = undefined;
  }
});

function shippedDocsLocales() {
  return readdirSync(userdocsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'images')
    .map((entry) => entry.name);
}

function walkTopics(topics, acc = []) {
  for (const topic of topics || []) {
    acc.push(topic);
    walkTopics(topic.children, acc);
  }
  return acc;
}

function markdownFiles(locale) {
  return readdirSync(join(userdocsRoot, locale))
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(userdocsRoot, locale, name));
}

describe('docs locale fallback', () => {
  it('loads an exact regional catalog before the base language', async () => {
    const { loadLocalizedIndex } = await import('../extension/pages/docs.js');
    const tried = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const href = String(url);
      tried.push(href);
      if (href.endsWith('userdocs/es-MX/index.json')) {
        return { ok: true, json: async () => ({ topics: [{ id: 'intro', title: 'Exact', file: 'intro.md' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    };

    const result = await loadLocalizedIndex('es-MX');
    assert.equal(result.locale, 'es-MX');
    assert.equal(result.index.topics[0].title, 'Exact');
    assert.equal(tried.some((href) => href.includes('userdocs/es-MX/')), true);
    assert.equal(tried.some((href) => href.includes('userdocs/es/')), false);
  });

  it('falls back from a missing regional folder to the base-language catalog', async () => {
    const { loadLocalizedIndex } = await import('../extension/pages/docs.js');
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.endsWith('userdocs/es/index.json')) {
        return { ok: true, json: async () => ({ topics: [{ id: 'intro', title: 'Base', file: 'intro.md' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    };

    const result = await loadLocalizedIndex('es-MX');
    assert.equal(result.locale, 'es');
    assert.equal(result.index.topics[0].title, 'Base');
  });

  it('falls back to English when no matching locale catalog exists', async () => {
    const { loadLocalizedIndex } = await import('../extension/pages/docs.js');
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.endsWith('userdocs/en/index.json')) {
        return { ok: true, json: async () => ({ topics: [{ id: 'intro', title: 'English', file: 'intro.md' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    };

    const result = await loadLocalizedIndex('ja');
    assert.equal(result.locale, 'en');
    assert.equal(result.index.topics[0].title, 'English');
  });
});

describe('docs topic and deep links', () => {
  it('keeps kp:// docs and settings links valid in every shipped docs locale', () => {
    const locales = shippedDocsLocales();
    assert.deepEqual(locales.sort(), ['de', 'en', 'es', 'zh_CN', 'zh_TW']);

    for (const locale of locales) {
      const index = JSON.parse(readFileSync(join(userdocsRoot, locale, 'index.json'), 'utf8'));
      const topicIds = new Set(walkTopics(index.topics).map((topic) => topic.id));
      const files = markdownFiles(locale);
      assert.ok(files.length > 0, `${locale} has Markdown topics`);

      for (const file of files) {
        const markdown = readFileSync(file, 'utf8');
        const hrefs = [...markdown.matchAll(/\((kp:\/\/[^)]+)\)/g)].map((match) => match[1]);
        for (const href of hrefs) {
          const parsed = parseKpDeepLink(href);
          assert.ok(parsed, `${file} has a parseable deep link: ${href}`);
          if (parsed.kind === 'docs') {
            assert.equal(topicIds.has(parsed.id), true, `${file} docs link ${href} matches a topic id`);
          } else {
            assert.equal(
              KP_SETTINGS_PANEL_IDS.includes(parsed.id),
              true,
              `${file} settings link ${href} matches a panel id`
            );
          }
        }
      }
    }
  });
});

describe('docs screenshots', () => {
  it('uses shared or locale image slots and CSS fluid scale', () => {
    const css = readFileSync(join(root, 'extension/pages/docs.css'), 'utf8');
    assert.match(css, /\.docs-article img(?:\.docs-shot)?[\s\S]*max-width:\s*100%/);
    assert.match(css, /\.docs-article img(?:\.docs-shot)?[\s\S]*height:\s*auto/);

    const locales = shippedDocsLocales();
    for (const locale of locales) {
      assert.equal(
        existsSync(join(userdocsRoot, locale, 'images')),
        false,
        `${locale} has no locale-specific screenshots yet`
      );
      for (const file of markdownFiles(locale)) {
        const markdown = readFileSync(file, 'utf8');
        for (const [, src] of markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)) {
          assert.match(src, /^(?:\.\/)?(?:userdocs\/)?images\/[\w.-]+\.png$/, `${file} image ${src}`);
        }
      }
    }
  });
});

describe('docs source keeps canonical Alt tokens', () => {
  const smokeTopics = ['keyboard-system-keys.md', 'getting-started.md', 'browsing-modes.md', 'layout-config.md'];

  it('ships <kbd>Alt</kbd> and Alt chrome jargon without Opt in Markdown', () => {
    const systemKeys = readFileSync(join(englishDir, 'keyboard-system-keys.md'), 'utf8');
    const spanishStart = readFileSync(join(userdocsRoot, 'es', 'getting-started.md'), 'utf8');
    assert.match(systemKeys, /<kbd>Alt<\/kbd>/);
    assert.match(systemKeys, /\*\*Alt chrome\*\*/);
    assert.equal(systemKeys.includes('<kbd>Opt</kbd>'), false);
    assert.match(spanishStart, /Alternar piloto clave/);
    assert.match(spanishStart, /<kbd>Alt<\/kbd>/);
  });

  it('retargets kbd Alt to Opt on Mac for smoke-test topics in en/es/de', () => {
    mock = installChromeMock({ isMac: true });
    for (const locale of ['en', 'es', 'de']) {
      for (const file of smokeTopics) {
        const src = readFileSync(join(userdocsRoot, locale, file), 'utf8');
        assert.match(src, /<kbd>Alt<\/kbd>/, `${locale}/${file} source`);
        const out = rewriteExactAltKbdHtml(src);
        assert.match(out, /<kbd>Opt<\/kbd>/, `${locale}/${file} Mac render`);
        assert.equal(out.includes('<kbd>Alt</kbd>'), false, `${locale}/${file} no leftover kbd Alt`);
      }
    }
    const spanish = rewriteExactAltKbdHtml(
      readFileSync(join(userdocsRoot, 'es', 'getting-started.md'), 'utf8')
    );
    assert.match(spanish, /Alternar piloto clave/);
    const germanSystem = rewriteExactAltKbdHtml(
      readFileSync(join(userdocsRoot, 'de', 'keyboard-system-keys.md'), 'utf8')
    );
    assert.match(germanSystem, /\*\*Alt chrome\*\*/);
  });
});
