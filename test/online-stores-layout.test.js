import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..');
const storesRoot = join(root, 'online-stores');
const chromeRoot = join(storesRoot, 'chrome');

function listPngs(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { recursive: true }).filter((file) =>
    String(file).toLowerCase().endsWith('.png')
  );
}

describe('online-stores source layout', () => {
  const slots = JSON.parse(readFileSync(join(chromeRoot, 'slots.json'), 'utf8'));
  const englishCopy = JSON.parse(readFileSync(join(chromeRoot, 'copy', 'en.json'), 'utf8'));
  const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');

  it('keeps source templates, locale copy, captures, and generated output in separate trees', () => {
    assert.equal(existsSync(join(storesRoot, 'README.md')), true);
    assert.equal(existsSync(join(chromeRoot, 'slots.json')), true);
    assert.equal(existsSync(join(chromeRoot, 'copy', 'en.json')), true);
    assert.equal(existsSync(join(chromeRoot, 'templates', 'screenshots')), true);
    assert.equal(existsSync(join(chromeRoot, 'templates', 'promo')), true);
    assert.equal(existsSync(join(chromeRoot, 'captures', 'en')), true);
    assert.equal(existsSync(join(storesRoot, 'generated', 'README.md')), true);
    assert.equal(existsSync(join(storesRoot, 'firefox', 'README.md')), true);

    assert.equal(slots.paths.templates, 'chrome/templates');
    assert.equal(slots.paths.captures, 'chrome/captures');
    assert.equal(slots.paths.copy, 'chrome/copy');
    assert.equal(slots.paths.generated, 'generated/chrome');
    assert.equal(slots.paths.generated.startsWith('chrome/templates'), false);
  });

  it('defines five 1280×800 Chrome screenshot slots with matching English copy', () => {
    assert.equal(slots.screenshot.width, 1280);
    assert.equal(slots.screenshot.height, 800);
    assert.equal(slots.screenshot.maxPerLocale, 5);
    assert.equal(slots.slots.length, 5);
    assert.deepEqual(
      slots.slots.map((slot) => slot.id),
      ['key-click-browsing', 'keyboard-map', 'customize-workflow', 'walkthrough', 'context-menu']
    );
    assert.equal(englishCopy.locale, 'en');

    for (const slot of slots.slots) {
      assert.equal(slot.kind, 'screenshot');
      assert.equal(slot.localized, true);
      assert.equal(slot.width, 1280);
      assert.equal(slot.height, 800);
      assert.equal(slot.template.startsWith('chrome/templates/screenshots/'), true);
      assert.equal(slot.template.endsWith('.svg'), true);
      assert.equal(existsSync(join(storesRoot, slot.template)), true);
      assert.match(slot.captureFile, /\.png$/);
      assert.match(slot.outputFile, /^\d{2}-.+\.png$/);
      assert.equal(typeof slot.capture?.open, 'string');
      assert.ok(Array.isArray(slot.capture.requiredSelectors));
      assert.ok(slot.capture.requiredSelectors.length > 0);

      const copy = englishCopy.slots[slot.copyKey];
      assert.equal(typeof copy?.headline, 'string', `missing headline for ${slot.id}`);
      assert.equal(Array.isArray(copy.callouts), true, `missing callouts for ${slot.id}`);
      assert.ok(copy.callouts.length >= 1 && copy.callouts.length <= 3);
    }
  });

  it('reserves global English promo tiles outside localized screenshot output', () => {
    const [small, marquee] = slots.globalPromo;
    assert.equal(small.localized, false);
    assert.equal(small.width, 440);
    assert.equal(small.height, 280);
    assert.equal(marquee.localized, false);
    assert.equal(marquee.width, 1400);
    assert.equal(marquee.height, 560);
    assert.equal(small.outputFile.startsWith('generated/chrome/promo/'), true);
    assert.equal(marquee.outputFile.startsWith('generated/chrome/promo/'), true);
    assert.equal(existsSync(join(storesRoot, small.template)), true);
    assert.equal(existsSync(join(storesRoot, marquee.template)), true);
  });

  it('keeps generated and capture bitmaps out of the SVG template directory', () => {
    assert.match(gitignore, /online-stores\/generated\/\*\*\/\*\.png/);
    assert.match(gitignore, /online-stores\/\*\*\/templates\/\*\*\/\*\.png/);

    const templatePngs = listPngs(join(chromeRoot, 'templates'));
    assert.deepEqual(templatePngs, [], `PNG files in templates: ${templatePngs.join(', ')}`);

    for (const slot of slots.slots) {
      const templateDir = join(storesRoot, slot.template, '..');
      const capturePath = join(storesRoot, slots.paths.captures, 'en', slot.captureFile);
      const outputPath = join(storesRoot, slots.paths.generated, 'en', slot.outputFile);
      assert.equal(relative(templateDir, capturePath).startsWith('..'), true);
      assert.equal(relative(templateDir, outputPath).startsWith('..'), true);
    }
  });

  it('excludes marked test locales from store screenshot generation', () => {
    assert.deepEqual(slots.initialLocales, ['en']);
    assert.ok(slots.excludeLocales.includes('en_GB'));
  });
});
