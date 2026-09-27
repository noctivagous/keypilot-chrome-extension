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

const WIKTIONARY_NOUN_HEADING = new RegExp(
  '^(?:' +
    [
      'noun',
      'proper noun',
      'substantiv',
      'eigenname',
      'sustantivo',
      'sustantivo propio',
      'nombre propio',
      'podstatné meno',
      'vlastné meno',
      '名詞',
      '固有名詞',
      '名词',
      '專有名詞',
      '专有名词'
    ].join('|') +
    ')(?:\\s+\\d+)?$',
  'iu'
);

const WIKTIONARY_POS_HEADING = new RegExp(
  '^(?:' +
    [
      'proper noun',
      'noun',
      'verb',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'conjunction',
      'interjection',
      'article',
      'determiner',
      'numeral',
      'particle',
      'prefix',
      'suffix',
      'phrase',
      'idiom',
      'proverb',
      'abbreviation',
      'symbol',
      'letter',
      'participle',
      'prepositional phrase',
      'substantiv',
      'eigenname',
      'adjektiv',
      'adverb',
      'pronomen',
      'präposition',
      'konjunktion',
      'interjektion',
      'artikel',
      'sustantivo propio',
      'nombre propio',
      'sustantivo',
      'verbo',
      'adjetivo',
      'adverbio',
      'pronombre',
      'preposición',
      'conjunción',
      'interjección',
      'artículo',
      'podstatné meno',
      'vlastné meno',
      'sloveso',
      'prídavné meno',
      'príslovka',
      '固有名詞',
      '名詞',
      '動詞',
      '形容詞',
      '副詞',
      '代名詞',
      '前置詞',
      '接続詞',
      '感動詞',
      '专有名词',
      '專有名詞',
      '名词',
      '动词',
      '形容词',
      '副词',
      '代词',
      '介词',
      '连词'
    ].join('|') +
    ')(?:\\s+\\d+)?$',
  'iu'
);

/**
 * @param {string|null|undefined} text
 * @returns {string}
 */
export function normalizeWiktionaryHeading(text) {
  return String(text || '')
    .replace(/\s*\[\s*edit[^\]]*\]\s*/gi, '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
export function isWiktionaryNounHeading(text) {
  return WIKTIONARY_NOUN_HEADING.test(normalizeWiktionaryHeading(text));
}

/**
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
export function isWiktionaryPosHeading(text) {
  return WIKTIONARY_POS_HEADING.test(normalizeWiktionaryHeading(text));
}

/**
 * @param {Element} el
 * @returns {number}
 */
function headingLevel(el) {
  const match = /^H([2-6])$/i.exec(el?.tagName || '');
  if (match) return Number(match[1]);
  const nested = el?.querySelector?.('h2, h3, h4, h5, h6');
  const nestedMatch = /^H([2-6])$/i.exec(nested?.tagName || '');
  return nestedMatch ? Number(nestedMatch[1]) : 99;
}

/**
 * Wiktionary wraps headings in a chrome div; after sanitize that wrapper
 * remains. Walk from the wrapper so the definition list is included.
 * @param {Element} heading
 * @param {ParentNode} root
 * @returns {Element}
 */
function sectionStart(heading, root) {
  let start = heading;
  while (start.parentNode && start.parentNode !== root) {
    const parent = start.parentNode;
    if (parent.nodeType !== 1) break;
    const hasArticleBlocks = [...parent.children].some((el) =>
      /^(P|OL|UL|DL|TABLE|FIGURE|BLOCKQUOTE)$/i.test(el.tagName)
    );
    if (hasArticleBlocks) break;
    start = parent;
  }
  return start;
}

/**
 * @param {ParentNode} root
 * @returns {Element|null}
 */
function findWiktionaryDefinitionHeading(root) {
  const headings = [...root.querySelectorAll('h2, h3, h4, h5')];
  if (!headings.length) return null;

  const firstLanguage = headings.find((el) => el.tagName === 'H2') || null;
  const start = firstLanguage ? headings.indexOf(firstLanguage) : 0;
  const inLanguage = [];

  for (let i = start; i < headings.length; i++) {
    const heading = headings[i];
    if (firstLanguage && i > start && heading.tagName === 'H2') break;
    if (heading === firstLanguage) continue;
    if (isWiktionaryPosHeading(heading.textContent)) inLanguage.push(heading);
  }

  return inLanguage.find((el) => isWiktionaryNounHeading(el.textContent)) || inLanguage[0] || null;
}

/**
 * Move the first definition / part-of-speech section to the top of the entry.
 * Wiktionary parse HTML leads with etymology and pronunciation; the inspect
 * popover should open on the senses.
 *
 * @param {ParentNode} root
 * @returns {boolean}
 */
export function promoteWiktionaryDefinition(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return false;
  const heading = findWiktionaryDefinitionHeading(root);
  if (!heading) return false;

  const start = sectionStart(heading, root);
  const firstElement = root.firstElementChild || null;
  if (start === firstElement) return false;

  const level = headingLevel(heading);
  const nodes = [start];
  let sibling = start.nextSibling;
  while (sibling) {
    const next = sibling.nextSibling;
    if (sibling.nodeType === 1 && headingLevel(sibling) <= level) break;
    nodes.push(sibling);
    sibling = next;
  }

  const doc = heading.ownerDocument;
  const fragment = doc.createDocumentFragment();
  for (const node of nodes) fragment.appendChild(node);
  root.insertBefore(fragment, root.firstChild);
  return true;
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
