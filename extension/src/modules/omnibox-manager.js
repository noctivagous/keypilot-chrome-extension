/**
 * Omnibox-like centered address bar overlay.
 * - Opens via KeyPilot (Alt+L)
 * - Suggests from History + Bookmarks via service worker
 * - Navigates current tab; non-URL becomes selected Search Engine query
 */
import { CSS_CLASSES, Z_INDEX } from '../config/constants.js';
import { buildSearchUrl, getEngineHomeUrl, getSettings, normalizeSearchEngine, SETTINGS_STORAGE_KEY } from './settings-manager.js';
import { createUrlListingContainer, renderUrlListing } from '../ui/url-listing.js';

export class OmniboxManager {
  /**
   * @param {object} opts
   * @param {() => void} [opts.onClose]
   */
  constructor({ onClose } = {}) {
    this.onClose = typeof onClose === 'function' ? onClose : null;

    this._open = false;
    this._backdrop = null;
    this._panel = null;
    this._input = null;
    this._list = null;

    /** @type {Array<{title: string, url: string, source: string}>} */
    this._suggestions = [];
    this._selectedIndex = -1;
    // Track whether the user has explicitly moved into the list via Arrow keys.
    // We use this to avoid "Enter always commits first row" unless that's intended.
    this._userNavigatedList = false;
    this._debounceTimer = null;
    this._lastQuery = '';

    /** @type {import('./settings-manager.js').SearchEngine} */
    this._searchEngine = 'brave';
    this._settingsListenerInstalled = false;

    this._onBackdropClick = this._onBackdropClick.bind(this);
    this._onInput = this._onInput.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    // Load settings once and keep local cache updated.
    this._installSettingsListener();
    this._refreshSettings();
  }

  isOpen() {
    return this._open;
  }

  show(initialValue = '') {
    if (this._open) {
      if (this._input) {
        this._input.focus();
        this._input.select();
      }
      return;
    }

    this._open = true;
    this._ensureDom();
    this._userNavigatedList = false;

    // Set value and focus.
    if (this._input) {
      this._input.value = typeof initialValue === 'string' ? initialValue : '';
      this._input.focus();
      try { this._input.select(); } catch { /* ignore */ }
    }

    // Populate initial suggestions (e.g. recent history) even when empty.
    this._scheduleSuggest();
  }

  hide() {
    if (!this._open) return;
    this._open = false;

    this._clearDebounce();
    this._suggestions = [];
    this._selectedIndex = -1;
    this._userNavigatedList = false;
    this._lastQuery = '';

    try {
      this._backdrop?.removeEventListener('click', this._onBackdropClick, true);
      this._input?.removeEventListener('input', this._onInput, true);
      this._input?.removeEventListener('keydown', this._onKeyDown, true);
    } catch {
      // ignore
    }

    try { this._backdrop?.remove(); } catch { /* ignore */ }

    this._backdrop = null;
    this._panel = null;
    this._input = null;
    this._list = null;

    if (this.onClose) {
      try { this.onClose(); } catch { /* ignore */ }
    }
  }

  _ensureDom() {
    if (this._backdrop && this._input) return;

    const doc = document;

    const backdrop = doc.createElement('div');
    backdrop.className = CSS_CLASSES.OMNIBOX_BACKDROP;
    Object.assign(backdrop.style, {
      position: 'fixed',
      inset: '0',
      zIndex: String(Z_INDEX.OMNIBOX),
      background: 'rgba(0,0,0,0.35)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)'
    });
    backdrop.addEventListener('click', this._onBackdropClick, true);

    const panel = doc.createElement('div');
    panel.className = CSS_CLASSES.OMNIBOX_PANEL;
    Object.assign(panel.style, {
      position: 'absolute',
      top: '18vh',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(880px, calc(100vw - 32px))',
      borderRadius: '14px',
      border: '1px solid rgba(255,140,0,0.35)',
      boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
      background: 'rgba(20, 20, 20, 0.88)',
      overflow: 'hidden'
    });

    // Stop clicks inside panel from closing.
    panel.addEventListener('click', (e) => {
      e.stopPropagation();
    }, true);

    const input = doc.createElement('input');
    input.className = CSS_CLASSES.OMNIBOX_INPUT;
    input.setAttribute('type', 'text');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('inputmode', 'search');
    input.setAttribute('placeholder', 'Search or enter address');
    Object.assign(input.style, {
      width: '100%',
      boxSizing: 'border-box',
      border: 'none',
      outline: 'none',
      padding: '14px 16px',
      fontSize: '18px',
      fontWeight: '500',
      color: 'rgba(255,255,255,0.95)',
      background: 'rgba(0,0,0,0)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    });
    input.addEventListener('input', this._onInput, true);
    input.addEventListener('keydown', this._onKeyDown, true);

    const list = createUrlListingContainer({
      doc,
      view: 'list',
      className: CSS_CLASSES.OMNIBOX_SUGGESTIONS,
      maxHeight: '40vh',
      useInlineStyles: true,
      style: {
        borderTop: '1px solid rgba(255,140,0,0.15)'
      }
    });

    panel.appendChild(input);
    panel.appendChild(list);
    backdrop.appendChild(panel);
    doc.body.appendChild(backdrop);

    this._backdrop = backdrop;
    this._panel = panel;
    this._input = input;
    this._list = list;

    this._renderSuggestions();
  }

  _onBackdropClick(e) {
    // Click outside panel closes.
    e.preventDefault();
    e.stopPropagation();
    this.hide();
  }

  _onInput() {
    this._scheduleSuggest();
  }

  _onKeyDown(e) {
    if (!this._open) return;

    // Prevent the page from reacting to navigation keys while omnibox is open.
    const key = e.key;

    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.hide();
      return;
    }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this._userNavigatedList = true;
      this._moveSelection(key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this._commit();
      return;
    }
  }

  _moveSelection(delta) {
    const count = this._suggestions.length;
    if (!count) {
      this._selectedIndex = -1;
      this._renderSuggestions();
      return;
    }

    // Special behavior to make omnibox feel like a real address bar:
    // - When the "input row" is active (_selectedIndex === -1), ArrowDown moves into the list at 0.
    // - When the first row is selected, ArrowUp returns to input (clears selection).
    let next = this._selectedIndex;
    if (delta < 0 && next === 0) {
      next = -1;
    } else if (next === -1) {
      next = delta > 0 ? 0 : -1;
    } else {
      next = (next + delta + count) % count;
    }

    this._selectedIndex = next;
    this._renderSuggestions();
    this._scrollSelectedIntoView();
  }

  _scrollSelectedIntoView() {
    try {
      const el = this._list?.querySelector?.(`[data-kp-omnibox-index="${this._selectedIndex}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    } catch {
      // ignore
    }
  }

  _commit() {
    const raw = (this._input?.value || '').trim();
    const selected = this._selectedIndex >= 0 ? this._suggestions[this._selectedIndex] : null;
    // If the user hasn't explicitly navigated the list, treat Enter as committing the input,
    // UNLESS the selected row is our "closest domain" convenience row (source === 'domain').
    const allowSelected =
      this._selectedIndex >= 0 &&
      (this._userNavigatedList || selected?.source === 'domain');
    const target = allowSelected && selected?.url ? selected.url : raw;
    if (!target) {
      this.hide();
      return;
    }

    const url = this._toUrlOrSearch(target);
    this.hide();

    try {
      // Navigate current tab (top frame).
      window.location.assign(url);
    } catch {
      try { window.location.href = url; } catch { /* ignore */ }
    }
  }

  _installSettingsListener() {
    if (this._settingsListenerInstalled) return;
    this._settingsListenerInstalled = true;
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        if (!changes || !changes[SETTINGS_STORAGE_KEY]) return;
        this._refreshSettings();
      });
    } catch {
      // ignore
    }
  }

  async _refreshSettings() {
    try {
      const settings = await getSettings();
      this._searchEngine = normalizeSearchEngine(settings?.searchEngine);
    } catch {
      this._searchEngine = 'brave';
    }
  }

  _toUrlOrSearch(input) {
    const text = String(input || '').trim();
    if (!text) return getEngineHomeUrl(this._searchEngine);

    // Already a URL with a scheme.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text)) return text;

    // If it looks like a filename (e.g. "library.js"), treat it as search text
    // rather than a host. This avoids turning common file queries into bogus URLs.
    if (isLikelyFilenameQuery(text)) {
      return buildSearchUrl(this._searchEngine, text);
    }

    // If input contains spaces, it's likely a search query even if it contains domain-like text
    // This handles cases like "alice in wonderland archive.org" - treat as search, not URL
    if (/\s/.test(text)) {
      return buildSearchUrl(this._searchEngine, text);
    }

    // Looks like a host/path: domain.tld, localhost, or IP (+ optional port/path)
    const looksLikeHost =
      /(^localhost\b)/i.test(text) ||
      /(^\d{1,3}(\.\d{1,3}){3}\b)/.test(text) ||
      /([a-zA-Z0-9-]+\.[a-zA-Z]{2,})([\/:?#]|$)/.test(text);

    if (looksLikeHost) {
      return `https://${text}`;
    }

    return buildSearchUrl(this._searchEngine, text);
  }

  _clearDebounce() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  _scheduleSuggest() {
    this._clearDebounce();
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._fetchSuggestions();
    }, 90);
  }

  async _fetchSuggestions() {
    if (!this._open) return;

    const query = (this._input?.value || '').trim();
    this._lastQuery = query;

    /** @type {Array<{title: string, url: string, source: string}>} */
    let suggestions = [];

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        const resp = await chrome.runtime.sendMessage({
          type: 'KP_OMNIBOX_SUGGEST',
          query,
          maxResults: 12
        });

        if (resp && resp.type === 'KP_OMNIBOX_SUGGESTIONS' && Array.isArray(resp.suggestions)) {
          suggestions = resp.suggestions
            .filter((s) => s && typeof s.url === 'string' && s.url.trim())
            .slice(0, 12);
        }
      }
    } catch {
      // ignore
    }

    // Stale guard (if user typed more while we waited).
    if (!this._open) return;
    const current = (this._input?.value || '').trim();
    if (current !== this._lastQuery) return;

    this._suggestions = suggestions;
    // Default selection: nothing selected. User must press ArrowDown (or hover/click)
    // to move into the list.
    this._selectedIndex = -1;
    this._userNavigatedList = false;
    this._renderSuggestions();
  }

  _renderSuggestions() {
    if (!this._list) return;

    renderUrlListing({
      container: this._list,
      items: this._suggestions,
      view: 'list',
      useInlineStyles: true,
      emptyText: 'No suggestions',
      getTitle: (s) => s.title || s.url,
      getUrl: (s) => s.url,
      showFavicon: true,
      showMetaLine: false,
      showUrlLine: true,
      selectedIndex: this._selectedIndex,
      decorateRow: ({ row, item, idx, parts }) => {
        row.className = CSS_CLASSES.OMNIBOX_SUGGESTION;
        row.dataset.kpOmniboxIndex = String(idx);

        // Override the shared defaults to match the omnibox styling.
        const selected = idx === this._selectedIndex;
        Object.assign(row.style, {
          padding: '10px 16px',
          cursor: 'default',
          background: selected ? 'rgba(255,140,0,0.18)' : 'rgba(0,0,0,0)',
          borderLeft: selected ? '3px solid rgba(255,140,0,0.85)' : '3px solid transparent',
          borderTop: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          borderRadius: '0',
          margin: '0',
          border: 'none'
        });

        Object.assign(parts.titleEl.style, {
          fontSize: '14px',
          fontWeight: '600'
        });
        Object.assign(parts.urlEl.style, {
          fontSize: '12px'
        });

        // Slight spacing tuning now that we show favicons.
        if (parts.faviconEl) {
          Object.assign(parts.faviconEl.style, {
            width: '18px',
            height: '18px',
            borderRadius: '4px'
          });
        }
      },
      onRowMouseEnter: ({ idx }) => {
        this._selectedIndex = idx;
        this._userNavigatedList = true;
        this._renderSuggestions();
      },
      onRowMouseDown: ({ idx, event }) => {
        // Use mousedown to commit before input loses focus.
        event.preventDefault();
        event.stopPropagation();
        this._selectedIndex = idx;
        this._userNavigatedList = true;
        this._commit();
      }
    });
  }
}

/**
 * Heuristic: user typed something that is far more likely a filename than a hostname.
 * We only apply this when there is no scheme (handled earlier).
 *
 * Examples we want to treat as search:
 * - library.js
 * - README.md
 * - config.json
 *
 * Examples we still want to treat as URLs:
 * - example.com
 * - foo.io/path
 * - localhost:3000
 */
function isLikelyFilenameQuery(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/\s/.test(s)) return false; // filenames can, but this is almost always a search anyway
  if (/[\/?#:]/.test(s)) return false; // paths/ports/query/hash are much more URL-like
  if (!/^[^.\s@]+\.[a-z0-9]+$/i.test(s)) return false; // one dot, simple "name.ext"

  const ext = s.split('.').pop()?.toLowerCase() || '';
  // Keep this list intentionally small to avoid false negatives for real TLDs.
  // These extensions are extremely common in "search for a file" queries.
  const filenameExts = new Set([
    'js',
    'mjs',
    'cjs',
    'css',
    'html',
    'htm',
    'json',
    'xml',
    'txt',
    'md'
  ]);

  return filenameExts.has(ext);
}


