/**
 * AI text helpers for Keyboard Layout Config Functions (Send Text To AI).
 *
 * Formats: "<prompt>: <selected text>"
 * Provider: Chrome built-in Prompt API (LanguageModel) when available;
 * otherwise returns a clear error so callers can notify the user.
 */

/**
 * @param {string} prompt Instruction / system-ish user prompt (e.g. "Translate to English")
 * @param {string} text Selected page text
 * @returns {string}
 */
export function formatSendTextToAiRequest(prompt, text) {
  const p = String(prompt || '').trim();
  const t = String(text || '').trim();
  if (!p) return t;
  if (!t) return p;
  // User example: "Translate to English: [selected text]"
  return `${p}: ${t}`;
}

/**
 * Resolve Chrome's on-device Prompt API constructor when present.
 * @returns {any|null}
 */
function getLanguageModelCtor() {
  try {
    if (typeof globalThis.LanguageModel === 'function') return globalThis.LanguageModel;
  } catch { /* ignore */ }
  try {
    if (typeof globalThis.ai?.languageModel?.create === 'function') {
      return globalThis.ai.languageModel;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * @param {any} LM
 * @returns {Promise<boolean>}
 */
async function isLanguageModelAvailable(LM) {
  try {
    if (typeof LM.availability === 'function') {
      const a = await LM.availability();
      return a === 'available' || a === 'readily' || a === 'after-download';
    }
  } catch { /* ignore */ }
  try {
    if (typeof LM.capabilities === 'function') {
      const c = await LM.capabilities();
      const avail = c?.available || c?.availability;
      return avail === 'readily' || avail === 'available' || avail === 'after-download';
    }
  } catch { /* ignore */ }
  // Older prototypes: assume create() will throw if unavailable.
  return typeof LM.create === 'function';
}

/**
 * Send composed text to an AI provider and return the response text.
 *
 * @param {{ prompt: string, text: string, signal?: AbortSignal }} opts
 * @returns {Promise<{ ok: true, text: string, request: string, provider: string }
 *   | { ok: false, error: string, request: string, provider?: string }>}
 */
export async function sendTextToAi(opts = {}) {
  const prompt = String(opts.prompt || '').trim();
  const text = String(opts.text || '').trim();
  const request = formatSendTextToAiRequest(prompt, text);

  if (!text) {
    return { ok: false, error: 'No text selected', request };
  }
  if (!prompt) {
    return { ok: false, error: 'Prompt is empty — set Instruction in Config', request };
  }

  const LM = getLanguageModelCtor();
  if (LM) {
    try {
      const available = await isLanguageModelAvailable(LM);
      if (!available) {
        return {
          ok: false,
          error: 'On-device AI is not available in this browser',
          request,
          provider: 'languageModel'
        };
      }
      const session = await LM.create({
        signal: opts.signal
      });
      try {
        const result = await session.prompt(request, { signal: opts.signal });
        const out = String(result ?? '').trim();
        if (!out) {
          return { ok: false, error: 'AI returned an empty response', request, provider: 'languageModel' };
        }
        return { ok: true, text: out, request, provider: 'languageModel' };
      } finally {
        try { session.destroy?.(); } catch { /* ignore */ }
      }
    } catch (e) {
      const msg = e?.message || String(e) || 'AI request failed';
      return { ok: false, error: msg, request, provider: 'languageModel' };
    }
  }

  return {
    ok: false,
    error: 'No AI provider available (Chrome Prompt API not supported here)',
    request
  };
}
