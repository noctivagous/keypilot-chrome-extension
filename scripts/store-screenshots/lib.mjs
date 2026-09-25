/**
 * Chrome store-listing screenshot pipeline.
 *
 * Discovers shipped `_locales` catalogs, composites locale GUI captures into
 * SVG templates, and writes dashboard PNGs. Chrome never reads these files
 * from the extension package.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pngDimensions } from './png.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '../..');

const PLACEHOLDER = /\{\{([a-zA-Z0-9_.]+)\}\}/g;
const TEST_LOCALE_MARK = /^\[[A-Z]{2}(?:_[A-Z0-9]+)?\]\s/;

export function storesRoot(root = repoRoot) {
  return path.join(root, 'online-stores');
}

export function loadSlots(root = repoRoot) {
  const file = path.join(storesRoot(root), 'chrome/slots.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function listShippedLocales(root = repoRoot) {
  const dir = path.join(root, 'extension/_locales');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((locale) => fs.existsSync(path.join(dir, locale, 'messages.json')))
    .sort();
}

export function isExcludedLocale(locale, slots) {
  return (slots.excludeLocales || []).includes(locale);
}

export function looksLikeTestLocaleCatalog(root, locale) {
  const file = path.join(root, 'extension/_locales', locale, 'messages.json');
  if (!fs.existsSync(file)) return false;
  const messages = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.values(messages).some(
    (entry) => typeof entry?.message === 'string' && TEST_LOCALE_MARK.test(entry.message)
  );
}

export function localesToGenerate(root, slots, { all = false, locale = null } = {}) {
  const shipped = listShippedLocales(root);
  const excluded = new Set(slots.excludeLocales || []);
  const marked = shipped.filter((item) => looksLikeTestLocaleCatalog(root, item));
  const eligible = shipped.filter((item) => !excluded.has(item) && !marked.includes(item));

  if (locale) {
    if (excluded.has(locale) || marked.includes(locale)) {
      throw new Error(`Locale "${locale}" is a test/excluded catalog and must not generate store assets`);
    }
    if (!eligible.includes(locale)) {
      throw new Error(`Locale "${locale}" is not a shipped extension catalog`);
    }
    return [locale];
  }

  if (all) return eligible;
  const initial = slots.initialLocales || ['en'];
  for (const item of initial) {
    if (!eligible.includes(item)) {
      throw new Error(`Initial locale "${item}" is not a shipped extension catalog`);
    }
  }
  return initial;
}

export function copyPath(root, slots, locale) {
  return path.join(storesRoot(root), slots.paths.copy, `${locale}.json`);
}

export function loadCopy(root, slots, locale) {
  const file = copyPath(root, slots, locale);
  if (!fs.existsSync(file)) {
    throw new Error(`Shipped locale "${locale}" is missing store copy at ${path.relative(root, file)}`);
  }
  const copy = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (copy.locale && copy.locale !== locale) {
    throw new Error(`Copy file locale "${copy.locale}" does not match requested locale "${locale}"`);
  }
  return copy;
}

export function assertCopyComplete(slots, locale, copy) {
  const limits = slots.copyLimits || {};
  for (const slot of slots.slots) {
    const entry = copy?.slots?.[slot.copyKey];
    if (!entry) {
      throw new Error(`Locale "${locale}" is missing copy for slot "${slot.id}"`);
    }
    if (typeof entry.headline !== 'string' || !entry.headline.trim()) {
      throw new Error(`Locale "${locale}" slot "${slot.id}" is missing a headline`);
    }
    if (!Array.isArray(entry.callouts) || entry.callouts.length < 1 || entry.callouts.length > 3) {
      throw new Error(`Locale "${locale}" slot "${slot.id}" must have 1 to 3 callouts`);
    }
    if (entry.callouts.some((text) => typeof text !== 'string' || !text.trim())) {
      throw new Error(`Locale "${locale}" slot "${slot.id}" has an empty callout`);
    }
    assertWithinLimit(entry.headline, limits.headline, `${locale} ${slot.id} headline`);
    for (const [index, text] of entry.callouts.entries()) {
    assertWithinLimit(String(text).replace(/\[\[([A-Za-z0-9]+)\]\]/g, '$1'), limits.callout, `${locale} ${slot.id} callout ${index}`);
    }
  }
}

function assertWithinLimit(text, maxChars, label) {
  if (!maxChars) return;
  const length = [...String(text)].length;
  if (length > maxChars) {
    throw new Error(`${label} exceeds safe region (${length} > ${maxChars} characters)`);
  }
}

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function unresolvedPlaceholders(svg) {
  return [...String(svg).matchAll(PLACEHOLDER)].map((match) => match[1]);
}

export function templatePlaceholders(template) {
  return unresolvedPlaceholders(template);
}

export function substitutionsForSlot(slot, copyEntry, captureHref) {
  const values = {
    captureHref,
    headline: copyEntry.headline,
    caption: copyEntry.caption || ''
  };
  for (const [index, text] of copyEntry.callouts.entries()) {
    values[`callout.${index}`] = text;
    const kbd = splitCalloutKbd(text);
    if (kbd) {
      const beforeWidth = estimateTitilliumWidth(kbd.before, CALLOUT_FONT_SIZE);
      const kbdX = Math.round(40 + beforeWidth + 8);
      values[`callout.${index}.before`] = kbd.before;
      values[`callout.${index}.kbd`] = kbd.kbd;
      values[`callout.${index}.after`] = kbd.after || ' ';
      values[`callout.${index}.kbdX`] = String(kbdX);
      values[`callout.${index}.afterX`] = String(kbdX + KBD_CHIP_SIZE + 6);
    }
  }
  return values;
}

/** Footer callout type, 1.15× the previous 22px size. */
const CALLOUT_FONT_SIZE = 25.3;
/** Inline key chip, scaled with the callout so the legend stays centered on the line. */
const KBD_CHIP_SIZE = 25.3;

function splitCalloutKbd(text) {
  const match = String(text).match(/^(.*)\[\[([A-Za-z0-9]+)\]\](.*)$/s);
  if (!match) return null;
  return { before: match[1], kbd: match[2], after: match[3] };
}

function estimateTitilliumWidth(text, fontSize) {
  let width = 0;
  for (const ch of String(text)) {
    if (ch === ' ') width += fontSize * 0.25;
    else if ('iIlj.,:;!\''.includes(ch)) width += fontSize * 0.26;
    else if ('mwWM@'.includes(ch)) width += fontSize * 0.76;
    else width += fontSize * 0.5;
  }
  return width;
}

export function applyTemplate(template, values) {
  const required = new Set(templatePlaceholders(template));
  for (const key of required) {
    if (values[key] == null || values[key] === '') {
      throw new Error(`SVG placeholder "{{${key}}}" is unresolved`);
    }
  }
  const svg = template.replace(PLACEHOLDER, (_, key) => {
    if (values[key] == null) {
      throw new Error(`SVG placeholder "{{${key}}}" is unresolved`);
    }
    return key === 'captureHref' ? String(values[key]) : escapeXml(values[key]);
  });
  const leftover = unresolvedPlaceholders(svg);
  if (leftover.length) {
    throw new Error(`SVG placeholder "{{${leftover[0]}}}" is unresolved`);
  }
  return svg;
}

export function captureMetaPath(root, slots, locale) {
  return path.join(storesRoot(root), slots.paths.captures, locale, 'meta.json');
}

export function loadCaptureMeta(root, slots, locale) {
  const file = captureMetaPath(root, slots, locale);
  if (!fs.existsSync(file)) {
    throw new Error(`Capture locale metadata missing for "${locale}" (${path.relative(root, file)})`);
  }
  const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (meta.locale !== locale) {
    throw new Error(`Capture locale "${meta.locale}" does not match annotation locale "${locale}"`);
  }
  return meta;
}

export function captureFilePath(root, slots, locale, slot) {
  return path.join(storesRoot(root), slots.paths.captures, locale, slot.captureFile);
}

export function assertCaptureReady(root, slots, locale, slot) {
  const file = captureFilePath(root, slots, locale, slot);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${locale} GUI capture for "${slot.id}" at ${path.relative(root, file)}`);
  }
  const png = fs.readFileSync(file);
  const size = pngDimensions(png);
  const expected = slots.captureDefaults.viewport;
  if (size.width !== expected.width || size.height !== expected.height) {
    throw new Error(
      `Capture ${locale}/${slot.captureFile} is ${size.width}×${size.height}, expected ${expected.width}×${expected.height}`
    );
  }
  return { file, png };
}

export function pngToDataUri(png) {
  return `data:image/png;base64,${png.toString('base64')}`;
}

function loadResvg() {
  try {
    return require('@resvg/resvg-js').Resvg;
  } catch {
    throw new Error('Install @resvg/resvg-js to rasterize store listing SVGs (npm install --save-dev @resvg/resvg-js)');
  }
}

export function fontFiles(root = repoRoot) {
  const fontsDir = path.join(root, 'extension/fonts');
  if (!fs.existsSync(fontsDir)) return [];
  return fs
    .readdirSync(fontsDir)
    .filter((name) => /\.(ttf|otf)$/i.test(name))
    .map((name) => path.join(fontsDir, name));
}

function assertOpaqueCorners(pixels, width, height) {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  for (const pixel of corners) {
    const alpha = pixels[pixel * 4 + 3];
    if (alpha !== 255) {
      throw new Error('Generated PNG is not full-bleed (transparent corner)');
    }
  }
}

export function renderSvgToPng(svg, { width, height, root = repoRoot, fullBleed = true } = {}) {
  const Resvg = loadResvg();
  const files = fontFiles(root);
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: {
      fontFiles: files,
      defaultFontFamily: files.length ? 'Titillium Web' : 'sans-serif',
      loadSystemFonts: files.length === 0
    }
  });
  const rendered = renderer.render();
  if (width && height && (rendered.width !== width || rendered.height !== height)) {
    throw new Error(`Rendered PNG is ${rendered.width}×${rendered.height}, expected ${width}×${height}`);
  }
  if (fullBleed) assertOpaqueCorners(rendered.pixels, rendered.width, rendered.height);
  return rendered.asPng();
}

export function assertGeneratedPng(png, { width, height }) {
  if (png[0] !== 0x89 || png[1] !== 0x50) {
    throw new Error('Generated file is not a PNG');
  }
  const size = pngDimensions(png);
  if (size.width !== width || size.height !== height) {
    throw new Error(`Generated PNG is ${size.width}×${size.height}, expected ${width}×${height}`);
  }
  return size;
}

export function generateLocaleScreenshots(root, slots, locale, { write = true } = {}) {
  const copy = loadCopy(root, slots, locale);
  assertCopyComplete(slots, locale, copy);
  loadCaptureMeta(root, slots, locale);

  const outDir = path.join(storesRoot(root), slots.paths.generated, locale);
  if (write) fs.mkdirSync(outDir, { recursive: true });

  const outputs = [];
  for (const slot of slots.slots) {
    const { png: capturePng } = assertCaptureReady(root, slots, locale, slot);
    const templatePath = path.join(storesRoot(root), slot.template);
    const template = fs.readFileSync(templatePath, 'utf8');
    const neededCallouts = new Set(
      templatePlaceholders(template)
        .filter((key) => /^callout\.\d+/.test(key))
        .map((key) => key.split('.')[1])
    ).size;
    if (neededCallouts !== copy.slots[slot.copyKey].callouts.length) {
      throw new Error(
        `Locale "${locale}" slot "${slot.id}" has ${copy.slots[slot.copyKey].callouts.length} callouts, template needs ${neededCallouts}`
      );
    }
    const svg = applyTemplate(template, substitutionsForSlot(slot, copy.slots[slot.copyKey], pngToDataUri(capturePng)));
    const png = renderSvgToPng(svg, {
      width: slot.width,
      height: slot.height,
      root,
      fullBleed: slots.screenshot.fullBleed
    });
    assertGeneratedPng(png, { width: slot.width, height: slot.height });
    const dest = path.join(outDir, slot.outputFile);
    const svgDest = path.join(outDir, slot.outputFile.replace(/\.png$/i, '.svg'));
    if (write) {
      fs.writeFileSync(svgDest, svg);
      fs.writeFileSync(dest, png);
    }
    outputs.push({
      locale,
      slot: slot.id,
      file: dest,
      svgFile: svgDest,
      bytes: png.length
    });
  }
  return outputs;
}

export function generatePromoTiles(root, slots, { write = true } = {}) {
  const outputs = [];
  for (const promo of slots.globalPromo) {
    if (promo.localized) {
      throw new Error(`Promo tile "${promo.id}" must not be localized`);
    }
    const template = fs.readFileSync(path.join(storesRoot(root), promo.template), 'utf8');
    if (unresolvedPlaceholders(template).length) {
      throw new Error(`Promo tile "${promo.id}" must not contain locale placeholders`);
    }
    const png = renderSvgToPng(template, {
      width: promo.width,
      height: promo.height,
      root,
      fullBleed: true
    });
    assertGeneratedPng(png, { width: promo.width, height: promo.height });
    const dest = path.join(storesRoot(root), promo.outputFile);
    if (write) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, png);
    }
    outputs.push({ id: promo.id, file: dest, bytes: png.length, localized: false });
  }
  return outputs;
}
