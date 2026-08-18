/**
 * Free Dictionary API helpers for LOOKUP_WORD.
 * API: GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}
 */

export const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Normalize a captured token for dictionary lookup.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function normalizeWordForLookup(raw) {
  let w = String(raw || '').trim();
  if (!w) return '';
  // Strip surrounding punctuation / quotes / brackets; keep internal hyphens and apostrophes.
  w = w.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
  w = w.trim().toLowerCase();
  return w;
}

/**
 * Format Free Dictionary API entry JSON into plain text for the result popover.
 * @param {any} data
 * @param {string} word
 * @returns {string}
 */
export function formatDictionaryEntries(data, word) {
  const entries = Array.isArray(data) ? data : [];
  if (!entries.length) return '';

  const lines = [];
  const head = String(entries[0]?.word || word || '').trim() || word;
  const phonetic =
    String(entries[0]?.phonetic || '').trim()
    || String(entries[0]?.phonetics?.find?.((p) => p?.text)?.text || '').trim();
  lines.push(phonetic ? `${head}  ${phonetic}` : head);

  let posCount = 0;
  for (const entry of entries) {
    const meanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
    for (const meaning of meanings) {
      if (posCount >= 3) break;
      const pos = String(meaning?.partOfSpeech || '').trim() || 'sense';
      const defs = Array.isArray(meaning?.definitions) ? meaning.definitions : [];
      if (!defs.length) continue;
      posCount += 1;
      lines.push('');
      lines.push(pos);
      let defCount = 0;
      for (const d of defs) {
        if (defCount >= 2) break;
        const definition = String(d?.definition || '').trim();
        if (!definition) continue;
        defCount += 1;
        lines.push(`${defCount}. ${definition}`);
        const example = String(d?.example || '').trim();
        if (example) lines.push(`   e.g. ${example}`);
      }
    }
    if (posCount >= 3) break;
  }

  if (posCount === 0) return '';

  lines.push('');
  lines.push('Source: Free Dictionary API');
  return lines.join('\n');
}

/**
 * Fetch and format a definition from the Free Dictionary API.
 * Intended for the service worker (host_permissions bypass CORS).
 *
 * @param {string} word Already-normalized word
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ ok: true, text: string, word: string }
 *   | { ok: false, error: string, word: string }>}
 */
export async function fetchDictionaryDefinition(word, opts = {}) {
  const w = normalizeWordForLookup(word);
  if (!w) {
    return { ok: false, error: 'No word under cursor', word: '' };
  }

  const url = `${DICTIONARY_API_BASE}/${encodeURIComponent(w)}`;
  let res;
  try {
    res = await fetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      cache: 'default',
      signal: opts.signal
    });
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'Dictionary request failed',
      word: w
    };
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 404 || data?.title === 'No Definitions Found') {
    return { ok: false, error: 'No definition found', word: w };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: `Dictionary lookup failed (${res.status})`,
      word: w
    };
  }

  const text = formatDictionaryEntries(data, w);
  if (!text) {
    return { ok: false, error: 'No definition found', word: w };
  }
  return { ok: true, text, word: w };
}
