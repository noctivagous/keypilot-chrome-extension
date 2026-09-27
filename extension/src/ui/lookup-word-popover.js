/**
 * Lookup Word — Wiktionary in the shared anchored inspect popover.
 */
import { getMessage } from '../utils/i18n.js';
import { promoteWiktionaryDefinition } from '../utils/dictionary-lookup.js';
import { sanitizeArticleHtml } from '../utils/reader-mode-extract.js';
import {
  createInspectActionButton,
  hideAnchoredInspectPopover,
  isAnchoredInspectPopoverOpen,
  showAnchoredInspectPopover
} from './anchored-inspect-popover.js';

let _activeRequestId = null;

/**
 * @param {{
 *   word: string,
 *   url: string,
 *   html?: string,
 *   loading?: boolean,
 *   error?: string,
 *   requestId?: string,
 *   anchor?: { left?: number, top?: number, bottom?: number, width?: number }|null,
 *   onClose?: () => void,
 * }} opts
 */
export function showLookupWordPopover(opts = {}) {
  const word = String(opts.word || '').trim();
  const url = String(opts.url || '').trim();
  if (!word || !url) return;
  const requestId = String(opts.requestId || '');

  showAnchoredInspectPopover({
    title: `${getMessage('lookup_word_title')} — ${word}`,
    ariaLabel: getMessage('lookup_word_aria'),
    kind: 'lookup-word',
    fill: true,
    anchor: opts.anchor || null,
    onClose: () => {
      _activeRequestId = null;
      try { opts.onClose?.(); } catch { /* ignore */ }
    },
    renderBody(body, doc) {
      body.style.cssText = 'padding:12px;overflow:auto;background:#fff;color:#202122;font:14px/1.55 system-ui,sans-serif;';
      if (opts.loading) {
        body.textContent = getMessage('lookup_word_loading');
        return;
      }
      if (opts.error) {
        body.textContent = String(opts.error);
        return;
      }
      const fragment = sanitizeArticleHtml(resolveWiktionaryUrls(opts.html, url), doc);
      if (!fragment.childNodes.length) {
        body.textContent = getMessage('lookup_word_empty');
        return;
      }
      promoteWiktionaryDefinition(fragment);
      body.appendChild(fragment);
    },
    renderActions(actions, doc, btnClass) {
      const openBtn = createInspectActionButton(doc, {
        label: getMessage('preview_open_new_tab'),
        className: btnClass
      });
      openBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { window.open(url, '_blank', 'noopener'); } catch { /* ignore */ }
      };
      const doneBtn = createInspectActionButton(doc, {
        label: getMessage('font_info_done'),
        primary: true,
        className: btnClass
      });
      doneBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideAnchoredInspectPopover();
      };
      actions.append(openBtn, doneBtn);
    }
  });
  if (requestId) _activeRequestId = requestId;
}

/**
 * Resolve Wiktionary's relative links before the Reader Mode sanitizer keeps
 * them. The sanitizer then applies the extension's normal URL allowlist.
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string}
 */
function resolveWiktionaryUrls(html, baseUrl) {
  const raw = String(html || '');
  if (!raw) return '';
  try {
    const parsed = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
    for (const el of parsed.querySelectorAll('[href], [src]')) {
      for (const attr of ['href', 'src']) {
        const value = el.getAttribute(attr);
        if (!value || value.startsWith('#')) continue;
        try { el.setAttribute(attr, new URL(value, baseUrl).href); } catch { /* ignore */ }
      }
    }
    return parsed.body.innerHTML;
  } catch {
    return raw;
  }
}

/**
 * @param {string} requestId
 * @returns {boolean}
 */
export function isLookupWordPopoverCurrent(requestId) {
  return !!requestId && _activeRequestId === requestId && isAnchoredInspectPopoverOpen();
}
