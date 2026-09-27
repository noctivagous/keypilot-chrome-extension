/**
 * Word capture and Wiktionary URL helpers for LOOKUP_WORD.
 */

const WIKTIONARY_WIKI_BY_LANGUAGE = Object.freeze({
  de: 'de',
  en: 'en',
  es: 'es',
  ja: 'ja',
  sk: 'sk',
  zh: 'zh'
});

/**
 * Normalize a captured token for dictionary lookup.
 * English possessives stop before the apostrophe; internal hyphens stay.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function normalizeWordForLookup(raw) {
  let w = String(raw || '').trim();
  if (!w) return '';
  // Strip surrounding punctuation / quotes / brackets; keep internal hyphens.
  w = w.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
  w = w.trim();
  if (!w) return '';
  if (isLatinLookupToken(w)) {
    w = w.replace(/['\u2019\u02BC]s$/iu, '');
    w = w.replace(/['\u2019\u02BC]$/u, '');
  }
  return w.toLowerCase();
}

/**
 * @param {string} w
 */
function isLatinLookupToken(w) {
  return /^[\p{Script=Latin}\p{N}'\u2019\u02BC\-]+$/u.test(w);
}

/**
 * @param {string|null|undefined} raw
 * @returns {string} Empty when there is no usable word.
 */
export function wiktionaryUrlForWord(raw) {
  return wiktionaryUrlForLocalizedWord(raw);
}

/**
 * Wiktionary site selected from the extension UI locale.
 * @param {string|null|undefined} uiLocale
 * @returns {string}
 */
export function wiktionaryOriginForLocale(uiLocale) {
  const language = String(uiLocale || 'en').trim().replace(/_/g, '-').split('-')[0].toLowerCase();
  const wiki = WIKTIONARY_WIKI_BY_LANGUAGE[language] || 'en';
  return `https://${wiki}.wiktionary.org`;
}

/**
 * @param {string|null|undefined} raw
 * @param {string|null|undefined} [uiLocale]
 * @returns {string} Empty when there is no usable word.
 */
export function wiktionaryUrlForLocalizedWord(raw, uiLocale) {
  const w = normalizeWordForLookup(raw);
  if (!w) return '';
  return `${wiktionaryOriginForLocale(uiLocale)}/wiki/${encodeURIComponent(w)}`;
}

/**
 * Fetch the parsed, skin-free HTML of a localized Wiktionary entry.
 * Intended for the service worker so the request is independent of page CORS.
 *
 * @param {string} word
 * @param {string|null|undefined} [uiLocale]
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ ok: true, word: string, url: string, origin: string, html: string }
 *   | { ok: false, word: string, url: string, error: string }>}
 */
export async function fetchWiktionaryEntry(word, uiLocale, opts = {}) {
  const normalized = normalizeWordForLookup(word);
  const url = wiktionaryUrlForLocalizedWord(normalized, uiLocale);
  if (!normalized || !url) {
    return { ok: false, word: '', url: '', error: 'No word under cursor' };
  }

  const origin = wiktionaryOriginForLocale(uiLocale);
  const apiUrl = new URL('/w/api.php', origin);
  apiUrl.searchParams.set('action', 'parse');
  apiUrl.searchParams.set('page', normalized);
  apiUrl.searchParams.set('prop', 'text');
  apiUrl.searchParams.set('format', 'json');
  apiUrl.searchParams.set('formatversion', '2');

  let response;
  try {
    response = await fetch(apiUrl, {
      credentials: 'omit',
      redirect: 'follow',
      cache: 'default',
      signal: opts.signal
    });
  } catch (error) {
    return {
      ok: false,
      word: normalized,
      url,
      error: error?.message || 'Wiktionary request failed'
    };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  const html = typeof data?.parse?.text === 'string' ? data.parse.text.trim() : '';
  if (response.status === 404 || data?.error?.code === 'missingtitle') {
    return { ok: false, word: normalized, url, error: 'No definition found' };
  }
  if (!response.ok || data?.error) {
    return {
      ok: false,
      word: normalized,
      url,
      error: String(data?.error?.info || `Wiktionary lookup failed (${response.status})`)
    };
  }
  if (!html) return { ok: false, word: normalized, url, error: 'No definition found' };
  return { ok: true, word: normalized, url, origin, html };
}
