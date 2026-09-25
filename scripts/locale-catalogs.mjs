/**
 * Chrome locale-catalog rules shared by the release check and the site build.
 *
 * A regional catalog such as es_419 may omit messages that exist in its
 * shipped parent language catalog (es). Chrome then fills those keys from
 * the parent. A language catalog has no parent catalog other than English,
 * so it must still define every English key. A regional catalog whose
 * language catalog is not shipped (zh_HK with no zh) must also stay complete,
 * because the next fallback is English.
 */

/**
 * @param {string} locale
 * @returns {string|null} Language subtag when the locale names a region.
 */
export function languageParent(locale) {
  const language = String(locale).split(/[-_]/)[0];
  if (!language || language === locale) return null;
  return language;
}

/**
 * @param {string} locale
 * @param {Iterable<string>} availableLocales Shipped catalog ids, including en.
 * @returns {string|null}
 */
export function parentCatalogLocale(locale, availableLocales) {
  const language = languageParent(locale);
  if (!language) return null;
  const available = availableLocales instanceof Set ? availableLocales : new Set(availableLocales);
  return available.has(language) ? language : null;
}

/**
 * Parent entries first, then the regional catalog. The regional file wins.
 * @param {object|null|undefined} parent
 * @param {object} translation
 * @returns {object}
 */
export function mergeLocaleCatalog(parent, translation) {
  if (!parent) return translation;
  return { ...parent, ...translation };
}

/**
 * @param {object|null|undefined} entry
 * @returns {string[]}
 */
export function placeholderNames(entry) {
  return Object.keys(entry?.placeholders ?? {}).sort();
}

/**
 * @param {object} source English catalog
 * @param {object} translation
 * @param {string} locale
 * @param {object|null} [parent] Shipped parent-language catalog.
 * @returns {string[]}
 */
export function catalogIssues(source, translation, locale, parent = null) {
  const sourceKeys = Object.keys(source);
  const translationKeys = new Set(Object.keys(translation));
  const covered = new Set(translationKeys);
  if (parent) {
    for (const key of Object.keys(parent)) covered.add(key);
  }
  const missing = sourceKeys.filter((key) => !covered.has(key));
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
    const expected = placeholderNames(source[key]).join(', ');
    const actual = placeholderNames(entry).join(', ');
    if (actual !== expected) {
      issues.push(`${locale}: "${key}" placeholders differ (expected [${expected}], found [${actual}])`);
    }
  }
  return issues;
}
