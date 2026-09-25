import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  applyTemplate,
  assertCopyComplete,
  countBrightPixels,
  ensureOverlayCjkFonts,
  estimateOverlayWidth,
  generateLocaleScreenshots,
  generatePromoTiles,
  loadCopy,
  loadSlots,
  localesToGenerate,
  OVERLAY_FONT_FAMILY,
  pngToDataUri,
  renderSvgToPng,
  repoRoot,
  substitutionsForSlot,
  unresolvedPlaceholders
} from '../scripts/store-screenshots/lib.mjs';
import { pngDimensions } from '../scripts/store-screenshots/png.mjs';

const slots = loadSlots(repoRoot);

function makeTempRepo({ extraLocale = null, extraCopy = null, captures = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'kp-store-shots-'));
  mkdirSync(join(root, 'extension/_locales/en'), { recursive: true });
  mkdirSync(join(root, 'extension/fonts'), { recursive: true });
  writeFileSync(
    join(root, 'extension/_locales/en/messages.json'),
    JSON.stringify({ extension_name: { message: 'KeyPilot', description: 'name' } })
  );
  if (extraLocale) {
    mkdirSync(join(root, 'extension/_locales', extraLocale), { recursive: true });
    writeFileSync(
      join(root, 'extension/_locales', extraLocale, 'messages.json'),
      extraCopy || JSON.stringify({ extension_name: { message: '[GB] KeyPilot', description: 'name' } })
    );
  }
  cpSync(join(repoRoot, 'online-stores'), join(root, 'online-stores'), { recursive: true });
  const font = join(repoRoot, 'extension/fonts/TitilliumTextBold.ttf');
  if (existsSync(font)) {
    cpSync(font, join(root, 'extension/fonts/TitilliumTextBold.ttf'));
  }
  if (captures) {
    const captureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800"><rect width="1280" height="800" fill="#6b7280"/></svg>`;
    const png = renderSvgToPng(captureSvg, { width: 1280, height: 800, root });
    const capDir = join(root, 'online-stores/chrome/captures/en');
    mkdirSync(capDir, { recursive: true });
    for (const slot of slots.slots) {
      writeFileSync(join(capDir, slot.captureFile), png);
    }
    writeFileSync(
      join(capDir, 'meta.json'),
      JSON.stringify({ locale: 'en', viewport: { width: 1280, height: 800 } }, null, 2)
    );
  }
  return root;
}

describe('Chrome store screenshot pipeline', () => {
  it('defines viewport, fixture, and per-slot capture selectors', () => {
    assert.deepEqual(slots.captureDefaults.viewport, { width: 1280, height: 800 });
    assert.equal(slots.captureDefaults.deviceScaleFactor, 1);
    assert.equal(slots.captureDefaults.screenshot, 'viewport');
    assert.match(slots.captureDefaults.fixture, /store-screenshots\/fixture\.html$/);

    assert.equal(slots.slots.length, 5);
    assert.equal(slots.screenshot.maxPerLocale, 5);
    assert.deepEqual(
      slots.slots.map((slot) => slot.outputFile),
      [
        '01-key-click-browsing.png',
        '02-keyboard-map.png',
        '03-customize-workflow.png',
        '04-walkthrough.png',
        '05-context-menu.png'
      ]
    );

    assert.equal(slots.slots[0].capture.hoverSelector, '#kp-store-local-nav');
    assert.ok(slots.slots[0].capture.requiredSelectors.includes('#kp-store-local-nav'));
    assert.equal(slots.slots[1].capture.pinActionId, 'PREVIEW_LINK_POPOVER');
    assert.ok(slots.slots[2].capture.requiredSelectors.includes("[data-kp-lib-tab='functions']"));
    assert.ok(slots.slots[3].capture.requiredSelectors.includes('.kp-onboarding-panel'));
    assert.ok(slots.slots[4].capture.requiredSelectors.includes('#kp-store-context-menu'));
    for (const slot of slots.slots.slice(0, 4)) {
      assert.equal(slot.capture.hardwareLayoutId, 'us-ansi-qwerty', slot.id);
    }
  });

  it('keeps screenshot templates at 1280×800 with capture and copy placeholders', () => {
    for (const slot of slots.slots) {
      const svg = readFileSync(join(repoRoot, 'online-stores', slot.template), 'utf8');
      assert.match(svg, /width="1280"/);
      assert.match(svg, /height="800"/);
      assert.match(svg, /\{\{captureHref\}\}/);
      assert.match(svg, /\{\{headline\}\}/);
      assert.match(svg, /\{\{callout\.0\}\}/);
      assert.match(svg, /Noto Sans JP/);
      assert.match(svg, /Hiragino Sans/);
    }
  });

  it('defines global English promo templates without locale placeholders', () => {
    for (const promo of slots.globalPromo) {
      const svg = readFileSync(join(repoRoot, 'online-stores', promo.template), 'utf8');
      assert.equal(unresolvedPlaceholders(svg).length, 0);
      assert.match(svg, new RegExp(`width="${promo.width}"`));
      assert.match(svg, new RegExp(`height="${promo.height}"`));
      assert.equal(promo.localized, false);
    }
  });

  it('generates English first and refuses marked test locales', () => {
    assert.deepEqual(localesToGenerate(repoRoot, slots, {}), ['en']);
    assert.throws(
      () => localesToGenerate(repoRoot, slots, { locale: 'en_GB' }),
      /test\/excluded catalog/
    );
  });

  it('keeps a paste-ready detailed description under 16,000 characters per shipped copy locale', () => {
    const listingDir = join(repoRoot, 'online-stores/chrome/listing');
    const copyDir = join(repoRoot, 'online-stores/chrome/copy');
    const locales = readdirSync(copyDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort();
    assert.ok(locales.includes('zh_HK'), 'zh_HK store copy is present');
    for (const locale of locales) {
      assert.equal(existsSync(join(copyDir, `${locale}.json`)), true);
      const text = readFileSync(join(listingDir, `${locale}.txt`), 'utf8').trim();
      assert.ok(text.length > 0, `listing/${locale}.txt is empty`);
      assert.ok(text.length <= 16000, `listing/${locale}.txt exceeds Chrome's 16,000-character limit`);
      assert.match(text, /KeyPilot/);
      assert.match(text, /\bF\b/);
    }
  });

  it('requires complete copy before generating a shipped locale', () => {
    const copy = loadCopy(repoRoot, slots, 'en');
    assertCopyComplete(slots, 'en', copy);
    const incomplete = structuredClone(copy);
    delete incomplete.slots['keyboard-map'];
    assert.throws(() => assertCopyComplete(slots, 'es', incomplete), /missing copy/);
  });

  it('fails when an SVG placeholder is unresolved or copy exceeds the safe region', () => {
    assert.throws(
      () => applyTemplate('<text>{{headline}}</text>', { headline: '' }),
      /unresolved/
    );
    const long = { ...loadCopy(repoRoot, slots, 'en') };
    long.slots['key-click-browsing'] = {
      headline: 'x'.repeat(80),
      callouts: ['a', 'b']
    };
    assert.throws(() => assertCopyComplete(slots, 'en', long), /exceeds safe region/);
  });

  it('rasterizes global promo tiles once at Chrome dimensions', () => {
    const outputs = generatePromoTiles(repoRoot, slots, { write: false });
    assert.equal(outputs.length, 2);
    assert.equal(outputs.every((item) => item.localized === false), true);
  });

  it('composites English captures into 1280×800 listing PNGs and skips test locales', () => {
    const root = makeTempRepo();
    const localSlots = loadSlots(root);
    const outputs = generateLocaleScreenshots(root, localSlots, 'en');
    assert.deepEqual(
      outputs.map((item) => item.slot),
      ['key-click-browsing', 'keyboard-map', 'customize-workflow', 'walkthrough', 'context-menu']
    );
    for (const item of outputs) {
      const size = pngDimensions(readFileSync(item.file));
      assert.equal(size.width, 1280);
      assert.equal(size.height, 800);
    }

    const extra = makeTempRepo({ extraLocale: 'en_GB' });
    assert.deepEqual(localesToGenerate(extra, loadSlots(extra), { all: true }), ['en']);
    assert.throws(
      () => localesToGenerate(extra, loadSlots(extra), { locale: 'en_GB' }),
      /test\/excluded catalog/
    );
  });

  it('fails when a shipped locale has no store copy or the capture locale mismatches', () => {
    const root = makeTempRepo({
      extraLocale: 'fr',
      extraCopy: JSON.stringify({ extension_name: { message: 'KeyPilot', description: 'name' } })
    });
    const localSlots = loadSlots(root);
    assert.throws(
      () => generateLocaleScreenshots(root, localSlots, 'fr'),
      /missing store copy/
    );

    writeFileSync(
      join(root, 'online-stores/chrome/captures/en/meta.json'),
      JSON.stringify({ locale: 'es' })
    );
    assert.throws(
      () => generateLocaleScreenshots(root, localSlots, 'en'),
      /does not match annotation locale/
    );
  });

  it('embeds the capture as a data URI rather than a cross-locale file path', () => {
    const copy = loadCopy(repoRoot, slots, 'en').slots['key-click-browsing'];
    const values = substitutionsForSlot(slots.slots[0], copy, pngToDataUri(Buffer.from('png')));
    assert.match(values.captureHref, /^data:image\/png;base64,/);
    assert.equal(values.headline, copy.headline);
  });

  it('places the key chip after CJK callout prefixes at roughly 1em per glyph', () => {
    const latin = estimateOverlayWidth('Click ', 25.3);
    const cjk = estimateOverlayWidth('リンクに合わせて ', 25.3);
    assert.ok(cjk > latin * 1.5);
    const values = substitutionsForSlot(
      slots.slots[0],
      {
        headline: '見出し',
        callouts: ['リンクに合わせて [[F]] を押してクリック。']
      },
      'data:image/png;base64,aa'
    );
    assert.ok(Number(values['callout.0.kbdX']) > 40 + 25.3 * 6);
  });

  it('rasterizes CJK overlay glyphs instead of empty banner bars', async () => {
    await ensureOverlayCjkFonts(repoRoot);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="80">
      <rect width="480" height="80" fill="#14171c"/>
      <text x="20" y="54" fill="#f4f6f8" font-family="${OVERLAY_FONT_FAMILY}" font-size="36" font-weight="700">日本語の見出し中文標題</text>
    </svg>`;
    const bright = countBrightPixels(svg, { width: 480, height: 80, root: repoRoot, fullBleed: true });
    assert.ok(bright > 80, `expected CJK overlay glyphs, counted ${bright} bright pixels`);
  });
});
