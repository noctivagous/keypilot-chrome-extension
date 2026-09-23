import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { before, beforeEach, describe, it } from 'node:test';

import { installChromeMock, resetChromeMock } from './helpers/chrome-mock.js';

/** @type {ReturnType<typeof installChromeMock>} */
let mock;

before(() => {
  mock = installChromeMock({ isMac: false });
});

beforeEach(() => {
  resetChromeMock(mock);
  mock.setUiLanguage('en');
  globalThis.KEYPILOT_DEBUG = false;
});

function fakeDocElement() {
  const attrs = new Map();
  return {
    attrs,
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name) ?? null; }
  };
}

describe('CJK locale tags and document language', () => {
  it('normalizes the UI locale for lang attributes', async () => {
    const { getUILocaleTag } = await import('../extension/src/utils/i18n.js');
    mock.setUiLanguage('zh-CN');
    assert.equal(getUILocaleTag(), 'zh-CN');
    mock.setUiLanguage('zh_CN');
    assert.equal(getUILocaleTag(), 'zh-CN');
    mock.setUiLanguage('zh-TW');
    assert.equal(getUILocaleTag(), 'zh-TW');
    mock.setUiLanguage('zh-HK');
    assert.equal(getUILocaleTag(), 'zh-HK');
    mock.setUiLanguage('en-US');
    assert.equal(getUILocaleTag(), 'en-US');
  });

  it('prefers the catalog locale over the browser UI language', async () => {
    const { getUILocaleTag } = await import('../extension/src/utils/i18n.js');
    mock.setI18nMessages({ locale_tag: { message: 'en' } });
    mock.setUiLanguage('zh-CN');
    assert.equal(getUILocaleTag(), 'en');
    mock.setI18nMessages({ locale_tag: { message: 'zh_TW' } });
    mock.setUiLanguage('en');
    assert.equal(getUILocaleTag(), 'zh-TW');
    mock.setI18nMessages({ locale_tag: { message: 'zh-HK' } });
    assert.equal(getUILocaleTag(), 'zh-HK');
  });

  it('falls back to English without Chrome or with an invalid tag', async () => {
    const { getUILocaleTag } = await import('../extension/src/utils/i18n.js');
    const saved = globalThis.chrome;
    try {
      // @ts-ignore
      delete globalThis.chrome;
      assert.equal(getUILocaleTag(), 'en');
    } finally {
      globalThis.chrome = saved;
    }
    mock.setUiLanguage('!!!');
    assert.equal(getUILocaleTag(), 'en');
  });

  it('sets lang on the document root', async () => {
    const { applyDocumentLocale } = await import('../extension/src/utils/i18n.js');
    mock.setUiLanguage('zh-TW');
    const documentElement = fakeDocElement();
    applyDocumentLocale({ documentElement });
    assert.equal(documentElement.getAttribute('lang'), 'zh-TW');
  });

  it('sets lang when localizing a page, before visible UI is shown', async () => {
    const { localizeElements } = await import('../extension/src/utils/i18n.js');
    mock.setUiLanguage('zh-CN');
    const documentElement = fakeDocElement();
    localizeElements({ nodeType: 9, documentElement, querySelectorAll: () => [] });
    assert.equal(documentElement.getAttribute('lang'), 'zh-CN');
  });

  it('sets lang when localizing a subtree via its owner document', async () => {
    const { localizeElements } = await import('../extension/src/utils/i18n.js');
    mock.setUiLanguage('zh-TW');
    const documentElement = fakeDocElement();
    localizeElements({ ownerDocument: { documentElement }, querySelectorAll: () => [] });
    assert.equal(documentElement.getAttribute('lang'), 'zh-TW');
  });
});

describe('CJK system-font-first stacks', () => {
  it('defines separate Japanese and Chinese stacks from OS system fonts', async () => {
    const {
      KP_CJK_UI_STACK_SC,
      KP_CJK_UI_STACK_TC,
      KP_CJK_UI_STACK_HK,
      KP_CJK_UI_STACK_JP,
      cjkScriptGroup,
      cjkUiFallbackStack
    } = await import('../extension/src/ui/locale-fonts.js');
    assert.match(KP_CJK_UI_STACK_SC, /PingFang SC/);
    assert.match(KP_CJK_UI_STACK_SC, /Microsoft YaHei/);
    assert.match(KP_CJK_UI_STACK_SC, /Noto Sans SC/);
    assert.match(KP_CJK_UI_STACK_SC, /Noto Sans CJK SC/);
    assert.match(KP_CJK_UI_STACK_TC, /PingFang TC/);
    assert.match(KP_CJK_UI_STACK_TC, /Microsoft JhengHei/);
    assert.match(KP_CJK_UI_STACK_TC, /Noto Sans TC/);
    assert.match(KP_CJK_UI_STACK_TC, /Noto Sans CJK TC/);
    assert.match(KP_CJK_UI_STACK_HK, /PingFang HK/);
    assert.match(KP_CJK_UI_STACK_HK, /Noto Sans HK/);
    assert.match(KP_CJK_UI_STACK_HK, /Noto Sans CJK HK/);
    assert.match(KP_CJK_UI_STACK_JP, /Hiragino Sans/);
    assert.match(KP_CJK_UI_STACK_JP, /Yu Gothic UI/);
    assert.match(KP_CJK_UI_STACK_JP, /Meiryo/);
    assert.match(KP_CJK_UI_STACK_JP, /Noto Sans JP/);
    assert.match(KP_CJK_UI_STACK_JP, /Noto Sans CJK JP/);
    assert.notEqual(KP_CJK_UI_STACK_SC, KP_CJK_UI_STACK_TC);
    assert.notEqual(KP_CJK_UI_STACK_TC, KP_CJK_UI_STACK_HK);
    assert.notEqual(KP_CJK_UI_STACK_JP, KP_CJK_UI_STACK_SC);

    const groups = {
      zh: 'sc',
      'zh-CN': 'sc',
      'zh_CN': 'sc',
      'zh-SG': 'sc',
      'zh-Hans': 'sc',
      'zh-Hans-CN': 'sc',
      'zh-TW': 'tc',
      'zh-Hant': 'tc',
      'zh-Hant-TW': 'tc',
      'zh-HK': 'hk',
      'zh-MO': 'hk',
      'zh-Hant-HK': 'hk',
      'zh-Hant-MO': 'hk',
      ja: 'jp',
      'ja-JP': 'jp',
      'zh-yue': ''
    };
    for (const [tag, group] of Object.entries(groups)) {
      assert.equal(cjkScriptGroup(tag), group, tag);
      const stack = cjkUiFallbackStack(tag);
      if (group === 'sc') assert.equal(stack, KP_CJK_UI_STACK_SC);
      else if (group === 'tc') assert.equal(stack, KP_CJK_UI_STACK_TC);
      else if (group === 'hk') assert.equal(stack, KP_CJK_UI_STACK_HK);
      else if (group === 'jp') assert.equal(stack, KP_CJK_UI_STACK_JP);
      else assert.equal(stack, '');
    }
  });

  it('keeps named CJK families out of the shared Latin UI stack', async () => {
    const { KP_UI_FONT } = await import('../extension/src/config/constants.js');
    assert.doesNotMatch(KP_UI_FONT, /PingFang|YaHei|JhengHei|Noto Sans|Hiragino Sans/);
  });

  it('bundles no CJK font files, only system font names', async () => {
    const mod = await import('../extension/src/ui/locale-fonts.js');
    const css = await readFile('extension/pages/kp-locale-fonts.css', 'utf8');
    const stripComments = (text) => String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    for (const text of [...Object.values(mod), css]) {
      const code = stripComments(text);
      assert.doesNotMatch(code, /@font-face/i, 'no embedded CJK families');
      assert.doesNotMatch(code, /url\(/i, 'no font file URLs');
      assert.doesNotMatch(code, /\.(ttf|otf|woff2?)\b/i, 'no font file references');
    }
    const fonts = await readdir('extension/fonts');
    assert.ok(!fonts.some((name) => /cjk|pingfang|yahei|jhenghei|noto/i.test(name)), 'no CJK files in extension/fonts');
  });

  it('scopes shadow stacks without a broad :lang(zh) rule', async () => {
    const { KP_CJK_SHADOW_CSS } = await import('../extension/src/ui/locale-fonts.js');
    assert.match(KP_CJK_SHADOW_CSS, /:host\(:lang\(zh-CN\)\)/);
    assert.match(KP_CJK_SHADOW_CSS, /:host\(:lang\(zh-TW\)\)/);
    assert.match(KP_CJK_SHADOW_CSS, /:host\(:lang\(zh-HK\)\)/);
    assert.match(KP_CJK_SHADOW_CSS, /:host\(:lang\(ja\)\)/);
    assert.match(KP_CJK_SHADOW_CSS, /:host\(:lang\(zh-Hant\):not\(:lang\(zh-Hant-HK\)\):not\(:lang\(zh-Hant-MO\)\)\)/);
    assert.doesNotMatch(KP_CJK_SHADOW_CSS, /:lang\(zh\)/);
  });

  it('writes the page stylesheet from the same stacks', async () => {
    const { renderLocaleFontStylesheet } = await import('../extension/src/ui/locale-fonts.js');
    const css = await readFile('extension/pages/kp-locale-fonts.css', 'utf8');
    assert.equal(css, renderLocaleFontStylesheet());
    assert.match(css, /html:lang\(zh-CN\) body/);
    assert.match(css, /html:lang\(zh-TW\) body/);
    assert.match(css, /html:lang\(zh-HK\) body/);
    assert.match(css, /html:lang\(ja\) body/);
    assert.doesNotMatch(css, /:lang\(zh\)/);
  });

  it('links the locale stylesheet after page styles in every extension page', async () => {
    const pages = {
      'extension/popup.html': 'pages/kp-locale-fonts.css',
      'extension/popup-v1.html': 'pages/kp-locale-fonts.css',
      'extension/pages/settings.html': 'kp-locale-fonts.css',
      'extension/pages/docs.html': 'kp-locale-fonts.css',
      'extension/pages/guide.html': 'kp-locale-fonts.css',
      'extension/pages/newtab.html': 'kp-locale-fonts.css',
      'extension/pages/key-new-tab.html': 'kp-locale-fonts.css'
    };
    for (const [page, href] of Object.entries(pages)) {
      const html = await readFile(page, 'utf8');
      const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)" \/>/g)].map((m) => m[1]);
      assert.equal(links.at(-1), href, `${page} loads locale fonts last`);
    }
  });
});

describe('CJK shadow-host language', () => {
  function fakeShadowHost() {
    const attrs = new Map();
    const appended = [];
    const styleVars = new Map();
    const shadow = {
      nodeType: 11,
      ownerDocument: null,
      appended,
      querySelector() { return null; },
      appendChild(node) { appended.push(node); return node; }
    };
    const doc = {
      createElement() {
        const elAttrs = new Map();
        return {
          setAttribute(name, value) { elAttrs.set(name, String(value)); },
          textContent: ''
        };
      }
    };
    shadow.ownerDocument = doc;
    return {
      shadow,
      appended,
      host: {
        attrs,
        style: { setProperty(name, value) { styleVars.set(name, String(value)); } },
        classList: { add() {} },
        shadowRoot: null,
        setAttribute(name, value) { attrs.set(name, String(value)); },
        removeAttribute(name) { attrs.delete(name); },
        attachShadow() { return shadow; }
      }
    };
  }

  it('sets host lang and injects locale CSS for new shadows', async () => {
    const { ensureOpenChromeShadow } = await import('../extension/src/ui/kp-chrome-shadow.js');
    const { KP_CJK_SHADOW_CSS } = await import('../extension/src/ui/locale-fonts.js');
    mock.setUiLanguage('zh-CN');
    const { host, appended } = fakeShadowHost();
    const shadow = ensureOpenChromeShadow(host, { id: 'test' });
    assert.ok(shadow, 'shadow returned');
    assert.equal(host.attrs.get('lang'), 'zh-CN');
    const cjk = appended.find((node) => node.textContent === KP_CJK_SHADOW_CSS);
    assert.ok(cjk, 'locale CSS injected into shadow');
  });

  it('uses the exact UI locale tag on existing hosts', async () => {
    const { ensureOpenChromeShadow } = await import('../extension/src/ui/kp-chrome-shadow.js');
    mock.setUiLanguage('zh_TW');
    const { host } = fakeShadowHost();
    ensureOpenChromeShadow(host, { id: 'test' });
    assert.equal(host.attrs.get('lang'), 'zh-TW');
  });

  it('wires onboarding shell language through the shared locale helpers', async () => {
    const source = await readFile('extension/src/ui/onboarding-shared.js', 'utf8');
    assert.match(source, /from '\.\/locale-fonts\.js'/);
    assert.match(source, /getUILocaleTag\(\)/);
    assert.match(source, /cjkUiFallbackStack\(tag\)/);
    assert.match(source, /data-kp-cjk-fonts/);
    assert.match(source, /root\.setAttribute\('lang', shellLocaleTag\)/);
    assert.match(source, /onboardingUiFallbackStack\(shellLocaleTag\)/);
  });

  it('stamps host language and locale CSS into the eager early-inject path', async () => {
    const generator = await readFile('extension/build-side-effects.js', 'utf8');
    assert.match(generator, /host\.setAttribute\('lang', getUILocaleTag\(\)\)/);
    assert.match(generator, /data-kp-cjk-fonts/);
    assert.match(generator, /KP_CJK_SHADOW_CSS/);
    assert.match(generator, /begin stamped early-locale-fonts\.js/);
    assert.doesNotMatch(generator, /begin stamped i18n\.js/);
    assert.doesNotMatch(generator, /begin stamped locale-fonts\.js/);
  });

  it('keeps the stamped early locale runtime compact and complete', async () => {
    const source = await readFile('extension/early-inject.js', 'utf8');
    const begin = '// --- begin stamped early-locale-fonts.js ---';
    const end = '// --- end stamped early-locale-fonts.js ---';
    const start = source.indexOf(begin);
    const finish = source.indexOf(end);
    assert.ok(start >= 0, 'early locale runtime is stamped');
    assert.ok(finish > start, 'early locale runtime has an end marker');
    const runtime = source.slice(start, finish + end.length);
    assert.ok(Buffer.byteLength(runtime) < 4 * 1024, 'early locale runtime remains below 4 KiB');
    assert.match(runtime, /locale_tag/);
    assert.match(runtime, /PingFang SC/);
    assert.match(runtime, /PingFang TC/);
    assert.match(runtime, /PingFang HK/);
    assert.match(runtime, /Hiragino Sans/);
    assert.doesNotMatch(runtime, /localizeElements/);
    assert.doesNotMatch(runtime, /renderLocaleFontStylesheet/);
  });

  it('records a BCP-47 locale_tag in every shipped catalog', async () => {
    const { readdir } = await import('node:fs/promises');
    const locales = await readdir('extension/_locales');
    for (const locale of locales) {
      const catalog = JSON.parse(await readFile(`extension/_locales/${locale}/messages.json`, 'utf8'));
      const tag = String(catalog.locale_tag?.message || '');
      assert.equal(tag.replace(/_/g, '-').toLowerCase(), locale.replace(/_/g, '-').toLowerCase(), locale);
    }
  });
});
