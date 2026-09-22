import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';
import {
  loadLocalizedOnboardingModel,
  onboardingModelStructure,
  parseOnboardingXml
} from '../extension/src/utils/onboarding-model.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const englishXml = join(root, 'extension/onboarding/en.xml');
const germanXml = join(root, 'extension/onboarding/de.xml');
const spanishXml = join(root, 'extension/onboarding/es.xml');
const simplifiedChineseXml = join(root, 'extension/onboarding/zh_CN.xml');
const traditionalChineseXml = join(root, 'extension/onboarding/zh_TW.xml');
const spanishFixture = join(root, 'test/fixtures/onboarding/es.xml');

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

function structureOf(path) {
  return onboardingModelStructure(parseOnboardingXml(readFileSync(path, 'utf8')));
}

describe('onboarding locale models', () => {
  it('parses unique English IDs and requires a when matcher on every task', () => {
    const model = parseOnboardingXml(readFileSync(englishXml, 'utf8'));
    const slideIds = new Set();
    const taskIds = new Set();

    for (const slide of model.slides) {
      assert.equal(slideIds.has(slide.id), false, `duplicate slide id: ${slide.id}`);
      slideIds.add(slide.id);
      for (const task of slide.tasks) {
        assert.equal(taskIds.has(task.id), false, `duplicate task id: ${task.id}`);
        taskIds.add(task.id);
        assert.ok(task.when?.type, `task ${task.id} is missing a when type`);
      }
    }

    assert.ok(model.slides.length >= 5);
    assert.equal(existsSync(join(root, 'extension/pages/onboarding.xml')), false);
  });

  it('keeps Spanish fixture IDs and action matchers aligned with English', () => {
    const english = parseOnboardingXml(readFileSync(englishXml, 'utf8'));
    const spanish = parseOnboardingXml(readFileSync(spanishFixture, 'utf8'));
    assert.deepEqual(structureOf(spanishFixture), structureOf(englishXml));
    assert.notEqual(spanish.slides[0].title, english.slides[0].title);
    assert.notEqual(spanish.slides[0].tasks[0].label, english.slides[0].tasks[0].label);
  });

  it('ships the Spanish model with English-compatible structure', () => {
    const english = parseOnboardingXml(readFileSync(englishXml, 'utf8'));
    const spanish = parseOnboardingXml(readFileSync(spanishXml, 'utf8'));
    assert.deepEqual(structureOf(spanishXml), structureOf(englishXml));
    assert.notEqual(spanish.slides[0].title, english.slides[0].title);
  });

  it('ships the German model with English-compatible structure', () => {
    const english = parseOnboardingXml(readFileSync(englishXml, 'utf8'));
    const german = parseOnboardingXml(readFileSync(germanXml, 'utf8'));
    assert.deepEqual(structureOf(germanXml), structureOf(englishXml));
    assert.notEqual(german.slides[0].title, english.slides[0].title);
  });

  it('ships Chinese models with English-compatible structure', () => {
    const english = parseOnboardingXml(readFileSync(englishXml, 'utf8'));
    for (const [locale, file] of [
      ['zh_CN', simplifiedChineseXml],
      ['zh_TW', traditionalChineseXml]
    ]) {
      const model = parseOnboardingXml(readFileSync(file, 'utf8'));
      assert.deepEqual(structureOf(file), structureOf(englishXml), locale);
      assert.notEqual(model.slides[0].title, english.slides[0].title, locale);
    }
  });
});

describe('onboarding locale fallback', () => {
  it('loads an exact regional model before the base language', async () => {
    const tried = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const href = String(url);
      tried.push(href);
      if (href.endsWith('onboarding/es-MX.xml')) {
        return { ok: true, text: async () => '<onboarding><slide id="basic_navigation" title="Exact"><task id="go_back" label="x"><when type="action" action="back" /></task></slide></onboarding>' };
      }
      return { ok: false, text: async () => '' };
    };

    const result = await loadLocalizedOnboardingModel({
      uiLanguage: 'es-MX',
      getURL: (path) => `chrome-extension://keypilot-test/${path}`
    });
    assert.equal(result.locale, 'es-MX');
    assert.equal(result.model.slides[0].title, 'Exact');
    assert.equal(tried.some((href) => href.includes('onboarding/es/')), false);
  });

  it('falls back from a missing regional file to the base-language model', async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.endsWith('onboarding/es.xml')) {
        return { ok: true, text: async () => readFileSync(spanishFixture, 'utf8') };
      }
      return { ok: false, text: async () => '' };
    };

    const result = await loadLocalizedOnboardingModel({
      uiLanguage: 'es-MX',
      getURL: (path) => `chrome-extension://keypilot-test/${path}`
    });
    assert.equal(result.locale, 'es');
    assert.equal(result.model.slides[0].title, 'Bienvenido a KeyPilot');
  });

  it('falls back to English when no matching locale model exists', async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.endsWith('onboarding/en.xml')) {
        return { ok: true, text: async () => readFileSync(englishXml, 'utf8') };
      }
      return { ok: false, text: async () => '' };
    };

    const result = await loadLocalizedOnboardingModel({
      uiLanguage: 'ja',
      getURL: (path) => `chrome-extension://keypilot-test/${path}`
    });
    assert.equal(result.locale, 'en');
    assert.equal(result.model.slides[0].title, 'Welcome to KeyPilot');
  });

  it('replaces an English early model with a localized fetch result using the same slide id', async () => {
    const early = parseOnboardingXml(readFileSync(englishXml, 'utf8'));
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.endsWith('onboarding/es.xml')) {
        return { ok: true, text: async () => readFileSync(spanishFixture, 'utf8') };
      }
      return { ok: false, text: async () => '' };
    };

    const loaded = await loadLocalizedOnboardingModel({
      uiLanguage: 'es',
      getURL: (path) => `chrome-extension://keypilot-test/${path}`
    });
    assert.equal(early.slides[0].id, loaded.model.slides[0].id);
    assert.notEqual(early.slides[0].title, loaded.model.slides[0].title);
    assert.deepEqual(onboardingModelStructure(early), onboardingModelStructure(loaded.model));
  });
});

describe('onboarding eager-path copy', () => {
  it('stamps only the English walkthrough into early-inject and keeps it out of content-bundled.js', () => {
    const early = readFileSync(join(root, 'extension/early-inject.js'), 'utf8');
    const bundled = readFileSync(join(root, 'extension/content-bundled.js'), 'utf8');
    assert.match(early, /Welcome to KeyPilot/);
    assert.equal(early.includes('Bienvenido a KeyPilot'), false);
    assert.equal(bundled.includes('Bienvenido a KeyPilot'), false);
    assert.match(bundled, /onboarding\//);
  });
});

describe('onboarding Control Strip status tokens', () => {
  it('substitutes `ON` / `OFF` from popup_status catalog keys', async () => {
    mock.setI18nMessages({
      popup_status_on: 'ACTIVADO',
      popup_status_off: 'DESACTIVADO'
    });
    const { formatKeyboardKeysHtml } = await import('../extension/src/ui/onboarding-shared.js');
    const html = formatKeyboardKeysHtml(
      'Hay una barra de control arriba que dice `ON`. Si dice `OFF`, enciéndelo.'
    );
    assert.match(html, /<kbd>ACTIVADO<\/kbd>/);
    assert.match(html, /<kbd>DESACTIVADO<\/kbd>/);
    assert.doesNotMatch(html, /<kbd>ON<\/kbd>/);
    assert.doesNotMatch(html, /<kbd>OFF<\/kbd>/);
  });

  it('keeps `ON` when the catalog key is missing', async () => {
    mock.setI18nMessages({});
    const { formatKeyboardKeysHtml } = await import('../extension/src/ui/onboarding-shared.js');
    assert.match(formatKeyboardKeysHtml('says `ON`'), /<kbd>ON<\/kbd>/);
  });
});

describe('onboarding later-slide Opt/Alt tokens', () => {
  it('rewrites `Alt` in laterTitle on Mac and keeps it on Windows', () => {
    const xml = readFileSync(englishXml, 'utf8');
    mock = installChromeMock({ isMac: false });
    const winModel = parseOnboardingXml(xml);
    const laterWin = winModel.slides
      .flatMap((slide) => slide.onEnter || [])
      .find((entry) => entry.laterTitle);
    assert.match(laterWin.laterTitle, /`Alt`/);
    assert.doesNotMatch(laterWin.laterTitle, /`Opt`/);

    mock = installChromeMock({ isMac: true });
    const macModel = parseOnboardingXml(xml);
    const laterMac = macModel.slides
      .flatMap((slide) => slide.onEnter || [])
      .find((entry) => entry.laterTitle);
    assert.match(laterMac.laterTitle, /`Opt`/);
    assert.doesNotMatch(laterMac.laterTitle, /`Alt`/);
  });
});
