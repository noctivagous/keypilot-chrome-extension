/**
 * In-extension deep links (kp://settings/<panel>, kp://docs/<topic>[#hash]).
 * Authoring scheme only — not a Chrome protocol_handler. Click handlers and
 * KeyPilot open APIs intercept these hrefs.
 */

/** Canonical Settings panel ids (keep in sync with pages/settings.js). */
export const KP_SETTINGS_PANEL_IDS = Object.freeze([
  'overview',
  'appearance',
  'keyboard',
  'click-mode',
  'text-mode',
  'scrolling',
  'cursor',
  'control-strip',
  'search',
  'about'
]);

/**
 * @typedef {{ kind: 'settings' | 'docs', id: string, hash?: string }} KpDeepLinkTarget
 */

/**
 * @param {string|null|undefined} href
 * @returns {boolean}
 */
export function isKpDeepLink(href) {
  return /^kp:\/\//i.test(String(href || '').trim());
}

/**
 * Parse a kp:// deep link.
 * @param {string|null|undefined} href
 * @returns {KpDeepLinkTarget|null}
 */
export function parseKpDeepLink(href) {
  const raw = String(href || '').trim();
  if (!raw) return null;
  // Reject path tricks before URL normalization collapses them.
  if (raw.includes('..')) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'kp:') return null;

  // URL parser: kp://settings/keyboard → host=settings, pathname=/keyboard
  // Also accept kp:/settings/keyboard (single slash) via pathname-only fallback.
  let kind = (url.hostname || '').toLowerCase();
  let pathId = (url.pathname || '').replace(/^\/+|\/+$/g, '');

  if (!kind && pathId) {
    const parts = pathId.split('/').filter(Boolean);
    kind = (parts[0] || '').toLowerCase();
    pathId = parts.slice(1).join('/');
  }

  if (kind !== 'settings' && kind !== 'docs') return null;

  // Only a single path segment (topic / panel id).
  if (pathId.includes('/')) return null;

  const id = String(pathId || '').trim();
  if (!id) return null;

  // Reject path traversal / odd characters; ids are slug-like.
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) return null;

  const hash = (url.hash || '').replace(/^#/, '').trim() || undefined;
  return { kind, id, ...(hash ? { hash } : {}) };
}

/**
 * Build a kp:// href for Settings or Docs.
 * @param {{ kind: 'settings' | 'docs', id: string, hash?: string }} opts
 * @returns {string}
 */
export function buildKpDeepLink(opts) {
  const kind = opts?.kind === 'settings' || opts?.kind === 'docs' ? opts.kind : null;
  const id = String(opts?.id || '').trim();
  if (!kind || !id || !/^[a-z0-9][a-z0-9_-]*$/i.test(id)) return '';
  const hash = String(opts?.hash || '').replace(/^#/, '').trim();
  return hash ? `kp://${kind}/${id}#${hash}` : `kp://${kind}/${id}`;
}

/**
 * Normalize a Settings panel id against the allow-list.
 * @param {string|null|undefined} panelId
 * @returns {string|null} Valid id or null
 */
export function normalizeSettingsPanelId(panelId) {
  const id = String(panelId || '').trim();
  return KP_SETTINGS_PANEL_IDS.includes(id) ? id : null;
}
