#!/usr/bin/env node

/**
 * Verifies shipped translation catalogs against the English source.
 *
 * A regional catalog may omit keys that its shipped parent language catalog
 * already defines. Language catalogs, and regional catalogs with no shipped
 * parent, must still account for every English key so English does not
 * appear by accident.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogIssues, parentCatalogLocale } from './locale-catalogs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesRoot = join(root, 'extension', '_locales');
const sourceLocale = 'en';

async function loadCatalog(locale) {
  const file = join(localesRoot, locale, 'messages.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${relative(root, file)}: ${error.message}`);
  }
}

const source = await loadCatalog(sourceLocale);
const localeEntries = await readdir(localesRoot, { withFileTypes: true });
const locales = localeEntries
  .filter((entry) => entry.isDirectory() && entry.name !== sourceLocale)
  .map((entry) => entry.name)
  .sort();
const available = new Set([sourceLocale, ...locales]);

const catalogs = new Map([[sourceLocale, source]]);
for (const locale of locales) {
  catalogs.set(locale, await loadCatalog(locale));
}

const issues = [];
for (const locale of locales) {
  const parentId = parentCatalogLocale(locale, available);
  const parent = parentId ? catalogs.get(parentId) : null;
  issues.push(...catalogIssues(source, catalogs.get(locale), locale, parent));
}

if (issues.length) {
  console.error(`Locale catalog validation failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Locale catalogs are complete (${sourceLocale}${locales.length ? `; ${locales.join(', ')}` : ' only'}).`);
}
