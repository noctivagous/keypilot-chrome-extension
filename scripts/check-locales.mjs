#!/usr/bin/env node

/**
 * Verifies that every shipped translation catalog matches the English source.
 *
 * Chrome can fall back for a missing message, which makes incomplete
 * translations easy to overlook. Keep this check in the release path so new
 * locale catalogs must explicitly account for every source message.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesRoot = join(root, 'extension', '_locales');
const sourceLocale = 'en';

function placeholders(entry) {
  return Object.keys(entry?.placeholders ?? {}).sort();
}

async function loadCatalog(locale) {
  const file = join(localesRoot, locale, 'messages.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${relative(root, file)}: ${error.message}`);
  }
}

function reportDifferences(source, translation, locale) {
  const sourceKeys = Object.keys(source);
  const translationKeys = new Set(Object.keys(translation));
  const missing = sourceKeys.filter((key) => !translationKeys.has(key));
  const extra = Object.keys(translation).filter((key) => !(key in source));
  const issues = [
    ...missing.map((key) => `${locale}: missing "${key}"`),
    ...extra.map((key) => `${locale}: extra "${key}"`)
  ];

  for (const key of sourceKeys) {
    const entry = translation[key];
    if (!entry) continue;
    if (typeof entry.message !== 'string' || !entry.message.trim()) {
      issues.push(`${locale}: "${key}" has an empty or invalid message`);
    }
    const expected = placeholders(source[key]).join(', ');
    const actual = placeholders(entry).join(', ');
    if (actual !== expected) {
      issues.push(`${locale}: "${key}" placeholders differ (expected [${expected}], found [${actual}])`);
    }
  }
  return issues;
}

const source = await loadCatalog(sourceLocale);
const localeEntries = await readdir(localesRoot, { withFileTypes: true });
const locales = localeEntries
  .filter((entry) => entry.isDirectory() && entry.name !== sourceLocale)
  .map((entry) => entry.name)
  .sort();

const issues = [];
for (const locale of locales) {
  issues.push(...reportDifferences(source, await loadCatalog(locale), locale));
}

if (issues.length) {
  console.error(`Locale catalog validation failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Locale catalogs are complete (${sourceLocale}${locales.length ? `; ${locales.join(', ')}` : ' only'}).`);
}
