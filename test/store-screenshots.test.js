import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  applyTemplate,
  assertCopyComplete,
  generateLocaleScreenshots,
  generatePromoTiles,
  loadCopy,
  loadSlots,
  localesToGenerate,
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

    assert.equal(slots.slots[0].capture.hoverSelector, '#kp-store-primary-link');
    assert.ok(slots.slots[0].capture.requiredSelectors.includes('.kp-control-strip'));
    assert.equal(slots.slots[1].capture.pinActionId, 'ACTIVATE');
    assert.equal(slots.slots[2].capture.libraryTab, 'functions');
  });

  it('keeps screenshot templates at 1280×800 with capture and copy placeholders', () => {
    for (const slot of slots.slots) {
      const svg = readFileSync(join(repoRoot, 'online-stores', slot.template), 'utf8');
      assert.match(svg, /width="1280"/);
      assert.match(svg, /height="800"/);
      assert.match(svg, /\{\{captureHref\}\}/);
      assert.match(svg, /\{\{headline\}\}/);
      assert.match(svg, /\{\{callout\.0\}\}/);
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
      ['key-click-browsing', 'keyboard-map', 'customize-workflow']
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
      extraLocale: 'es',
      extraCopy: JSON.stringify({ extension_name: { message: 'KeyPilot', description: 'name' } })
    });
    const localSlots = loadSlots(root);
    assert.throws(
      () => generateLocaleScreenshots(root, localSlots, 'es'),
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
});
