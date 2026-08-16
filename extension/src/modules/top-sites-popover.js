/**
 * TopSitesPopover
 * Centered 16:9 overlay of common sites: Toolbar, Most Visited, Recent Bookmarks.
 */
import { MSG } from '../messaging/types.js';
import {
  createUrlListingContainer,
  parseUrlForThreeLineDisplay,
  renderUrlListing
} from '../ui/url-listing.js';
import { applyCardBackground } from '../ui/page-thumb-ui.js';
import {
  NCT_DARK_UI_BTN_BORDER,
  NCT_DARK_UI_BTN_GRADIENT,
  NCT_DARK_UI_BTN_RADIUS,
  NCT_DARK_UI_COLORS,
  NCT_DARK_UI_FONT,
  NCT_DARK_UI_PANEL_BACKGROUND,
  NCT_DARK_UI_PANEL_BORDER,
  NCT_DARK_UI_PANEL_BOX_SHADOW,
  NCT_DARK_UI_PANEL_RADIUS,
  NCT_DARK_UI_SCROLLBAR_CLASS,
  NCT_DARK_UI_TITLEBAR_GRADIENT,
  getNctDarkUiScrollbarCss
} from '../ui/nct-dark-ui.js';
import { ensureOpenChromeShadow, injectChromeStyles } from '../ui/kp-chrome-shadow.js';
import { storageGetValue, storageSetValue } from '../utils/storage.js';

const TAB_STATE_KEY = 'kpTopSitesSelectedTab_v1';
const POPUP_ID = 'kpv2-top-sites-popover';
const DEFAULT_WIDTH_PX = 600;
const ASPECT_RATIO = 16 / 9;
const DEFAULT_HEIGHT_PX = Math.round(DEFAULT_WIDTH_PX / ASPECT_RATIO);

/** @typedef {'toolbar'|'mostVisited'|'recentBookmarks'} TopSitesTabId */

const TABS = Object.freeze([
  Object.freeze({ id: 'toolbar', label: 'Toolbar' }),
  Object.freeze({ id: 'mostVisited', label: 'Most Visited' }),
  Object.freeze({ id: 'recentBookmarks', label: 'Recent Bookmarks' })
]);

const EMPTY_COPY = Object.freeze({
  toolbar: 'No bookmarks on the Bookmarks bar.',
  mostVisited: 'No frequently visited sites yet.',
  recentBookmarks: 'No recent bookmarks.'
});

const CARD_CLASS_NAMES = {
  row: 'kp-url-row',
  rowSelected: 'kp-url-row--selected',
  content: 'kp-url-content',
  text: 'kp-url-text',
  title: 'kp-url-domain',
  meta: 'kp-url-title',
  url: 'kp-url-path',
  favicon: 'kp-url-favicon'
};

/**
 * @param {{ url?: string, title?: string }} item
 * @param {{ titleEl: HTMLElement, metaEl: HTMLElement, urlEl: HTMLElement }} parts
 */
function renderCardText({ item, parts }) {
  const url = String(item?.url || '').trim();
  const title = String(item?.title || '').trim();
  const { domain, path } = parseUrlForThreeLineDisplay(url);
  parts.titleEl.textContent = domain || url || '';
  parts.metaEl.textContent = title && title !== domain ? title : '';
  parts.urlEl.textContent = path === '/' ? '' : path;
}

/**
 * @param {HTMLElement} row
 * @param {string} url
 */
function attachPageThumb(row, url) {
  const pageUrl = String(url || '').trim();
  if (!row || !pageUrl) return;
  applyCardBackground(row, pageUrl, {
    fallbackSolid: '',
    hoverSolid: '',
    manageHover: false,
    youtubePrefer: true,
    useCssVar: true,
    cssVarName: '--kp-page-thumb',
    readyClass: 'kp-has-page-thumb'
  });
}

export class TopSitesPopover {
  /**
   * @param {object} opts
   * @param {import('./popup-manager.js').PopupManager} opts.popupManager
   */
  constructor({ popupManager } = {}) {
    this.popupManager = popupManager || null;
    /** @type {HTMLElement|null} */
    this._panel = null;
    /** @type {HTMLElement|null} */
    this._tabList = null;
    /** @type {HTMLElement|null} */
    this._grid = null;
    /** @type {HTMLElement|null} */
    this._status = null;
    this._open = false;
    this._openGen = 0;
    /** @type {TopSitesTabId} */
    this._tab = 'toolbar';
    /** @type {number} */
    this._selectedIndex = 0;
    /** @type {Array<{title?: string, url?: string}>} */
    this._items = [];
  }

  isOpen() {
    return this._open;
  }

  toggle() {
    if (this._open) this.hide();
    else void this.show();
  }

  async show() {
    if (!this.popupManager) return;
    if (this._open) return;
    this._open = true;
    const gen = ++this._openGen;

    await this._loadTabState();
    if (!this._stillOpen(gen)) return;

    this._ensureDom();
    this._injectStyles();
    this._syncTabButtons();

    this.popupManager.showModal({
      id: POPUP_ID,
      panel: this._panel,
      onRequestClose: () => this.hide(),
      resizable: true,
      blur: false,
      resizeOptions: {
        minWidth: 480,
        minHeight: 270,
        aspectRatio: ASPECT_RATIO
      }
    });

    try {
      this._panel?.focus?.({ preventScroll: true });
    } catch { /* ignore */ }

    await this._loadAndRender(gen);
  }

  hide() {
    if (!this._open && !this._panel) return;
    this._open = false;
    this._openGen += 1;
    void this._persistTabState();

    try {
      this.popupManager?.hideModal?.(POPUP_ID);
    } catch { /* ignore */ }

    try { this._panel?.remove?.(); } catch { /* ignore */ }
    this._panel = null;
    this._tabList = null;
    this._grid = null;
    this._status = null;
    this._items = [];
    this._selectedIndex = 0;
  }

  /**
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  handleKeyDown(e) {
    if (!this._open) return false;
    const key = e.key;
    const code = e.code;

    if (key === 'Escape' || code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      try { e.stopImmediatePropagation(); } catch { /* ignore */ }
      this.hide();
      return true;
    }

    if (key === '1' || key === '2' || key === '3') {
      const idx = Number(key) - 1;
      const tab = TABS[idx];
      if (tab) {
        e.preventDefault();
        e.stopPropagation();
        void this._selectTab(tab.id);
        return true;
      }
    }

    if (key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this._cycleTab(e.shiftKey ? -1 : 1);
      return true;
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const atTablist = this._eventInTabList(e);
      if (atTablist || e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        this._cycleTab(key === 'ArrowLeft' ? -1 : 1);
        return true;
      }
      e.preventDefault();
      e.stopPropagation();
      this._moveSelection(key === 'ArrowLeft' ? -1 : 1);
      return true;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const cols = this._gridColumnCount();
      this._moveSelection(key === 'ArrowUp' ? -cols : cols);
      return true;
    }

    if (key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      this._setSelectedIndex(0);
      return true;
    }
    if (key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      this._setSelectedIndex(this._items.length - 1);
      return true;
    }

    if (key === 'Enter' || key === ' ') {
      const item = this._items[this._selectedIndex];
      if (item?.url) {
        e.preventDefault();
        e.stopPropagation();
        void this._openUrl(item.url);
        return true;
      }
    }

    if (key === 'PageUp' || key === 'PageDown') {
      e.preventDefault();
      e.stopPropagation();
      try {
        const grid = this._grid;
        if (grid) {
          const delta = key === 'PageUp' ? -grid.clientHeight : grid.clientHeight;
          grid.scrollBy({ top: delta, behavior: 'smooth' });
        }
      } catch { /* ignore */ }
      return true;
    }

    return false;
  }

  /** @param {number} gen */
  _stillOpen(gen) {
    return this._open && this._openGen === gen;
  }

  async _loadTabState() {
    try {
      const raw = await storageGetValue(TAB_STATE_KEY, 'toolbar');
      const id = String(raw || '');
      this._tab = TABS.some((t) => t.id === id) ? /** @type {TopSitesTabId} */ (id) : 'toolbar';
    } catch {
      this._tab = 'toolbar';
    }
  }

  _persistTabState() {
    return storageSetValue(TAB_STATE_KEY, this._tab).catch(() => {});
  }

  _injectStyles() {
    const c = NCT_DARK_UI_COLORS;
    const css = `
      .kpv2-top-sites-panel {
        box-sizing: border-box;
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: ${DEFAULT_WIDTH_PX}px;
        height: ${DEFAULT_HEIGHT_PX}px;
        aspect-ratio: 16 / 9;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        display: flex;
        flex-direction: column;
        border-radius: ${NCT_DARK_UI_PANEL_RADIUS};
        border: ${NCT_DARK_UI_PANEL_BORDER};
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        box-shadow: ${NCT_DARK_UI_PANEL_BOX_SHADOW};
        overflow: hidden;
        outline: none;
        font-family: ${NCT_DARK_UI_FONT};
        color: ${c.fg};
      }

      .kpv2-top-sites-panel .kpv2-ts-tabstrip {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        padding: 10px 14px 0 12px;
        min-height: 48px;
        flex: 0 0 auto;
        background: ${NCT_DARK_UI_TITLEBAR_GRADIENT};
        border-bottom: 1px solid ${c.panelEdgeDark};
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.10);
      }

      .kpv2-top-sites-panel .kpv2-ts-tab {
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        margin: 0 0 -1px;
        padding: 11px 18px 13px;
        border: 1px solid ${c.panelEdgeDark};
        border-bottom: none;
        border-radius: 9px 9px 0 0;
        background: linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 55%, ${c.btnBot} 100%);
        color: ${c.fgDim};
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.01em;
        line-height: 1.15;
        cursor: pointer;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);
        z-index: 0;
      }

      .kpv2-top-sites-panel .kpv2-ts-tab:hover {
        color: ${c.fg};
        background: linear-gradient(180deg, #555 0%, ${c.btnMid} 55%, ${c.btnBot} 100%);
      }

      .kpv2-top-sites-panel .kpv2-ts-tab[aria-selected="true"] {
        color: ${c.fg};
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
        z-index: 1;
        padding-top: 13px;
        padding-bottom: 15px;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.16),
          0 0 0 1px ${c.litEdge};
      }

      .kpv2-top-sites-panel .kpv2-ts-tab:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 1px rgba(74,144,200,0.65);
      }

      .kpv2-top-sites-panel .kpv2-ts-close {
        margin: 0 0 8px auto;
        appearance: none;
        -webkit-appearance: none;
        box-sizing: border-box;
        width: 32px;
        height: 32px;
        border-radius: ${NCT_DARK_UI_BTN_RADIUS};
        border: ${NCT_DARK_UI_BTN_BORDER};
        background: ${NCT_DARK_UI_BTN_GRADIENT};
        color: ${c.fg};
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        flex: 0 0 auto;
        align-self: center;
      }

      .kpv2-top-sites-panel .kpv2-ts-body {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
        background: ${NCT_DARK_UI_PANEL_BACKGROUND};
      }

      .kpv2-top-sites-panel .kpv2-ts-status {
        padding: 6px 14px 0;
        font-size: 11px;
        font-weight: 600;
        color: ${c.fgMute};
        flex: 0 0 auto;
      }

      .kpv2-top-sites-panel .kpv2-ts-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
        grid-auto-rows: 80px;
        gap: 12px;
        padding: 10px 14px 14px;
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        align-items: start;
        align-content: start;
      }

      .kpv2-top-sites-panel .kpv2-ts-empty {
        grid-column: 1 / -1;
        padding: 28px 12px;
        text-align: center;
        font-size: 13px;
        font-weight: 600;
        color: ${c.fgMute};
      }

      .kpv2-top-sites-panel .kp-url-row {
        box-sizing: border-box;
        display: block;
        position: relative;
        align-self: start;
        width: 100%;
        height: 80px;
        min-height: 80px;
        max-height: 80px;
        padding: 8px 9px;
        border-radius: 10px;
        cursor: pointer;
        text-decoration: none;
        color: inherit;
        user-select: none;
        overflow: hidden;
        margin: 0;
        min-width: 0;
        background: linear-gradient(180deg, ${c.btnTop} 0%, ${c.btnMid} 48%, ${c.btnBot} 100%);
        border: 1px solid ${c.panelEdgeDark};
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.18),
          inset 0 -1px 0 rgba(0,0,0,0.45),
          0 4px 10px rgba(0,0,0,0.38);
      }

      .kpv2-top-sites-panel .kp-url-row:hover {
        transform: translateY(-1px);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.22),
          inset 0 -1px 0 rgba(0,0,0,0.5),
          0 8px 16px rgba(0,0,0,0.45);
      }

      .kpv2-top-sites-panel .kp-url-row:focus-visible,
      .kpv2-top-sites-panel .kp-url-row--selected {
        outline: none;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.18),
          0 0 0 2px ${c.litEdge},
          0 6px 14px rgba(0,0,0,0.4);
      }

      .kpv2-top-sites-panel .kp-url-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        gap: 4px;
      }

      .kpv2-top-sites-panel .kp-url-favicon {
        width: 22px;
        height: 22px;
        border-radius: 4px;
        flex: 0 0 auto;
        background: rgba(0,0,0,0.28);
      }

      .kpv2-top-sites-panel .kp-url-text {
        min-width: 0;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
        justify-content: flex-end;
      }

      .kpv2-top-sites-panel .kp-url-domain,
      .kpv2-top-sites-panel .kp-url-title,
      .kpv2-top-sites-panel .kp-url-path {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kpv2-top-sites-panel .kp-url-domain {
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,255,255,0.94);
      }

      .kpv2-top-sites-panel .kp-url-title {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,0.78);
      }

      .kpv2-top-sites-panel .kp-url-path {
        font-size: 10px;
        color: rgba(255,255,255,0.55);
      }

      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb {
        background-color: #0a0a0a;
        background-image: none;
        isolation: isolate;
      }

      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb::before {
        content: "";
        position: absolute;
        inset: -1px;
        z-index: 0;
        pointer-events: none;
        border-radius: inherit;
        background-color: #0a0a0a;
        background-image:
          linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.78) 100%),
          var(--kp-page-thumb);
        background-size: 100% 100%, cover;
        background-position: center, center;
        background-repeat: no-repeat, no-repeat;
      }

      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb > * {
        position: relative;
        z-index: 1;
      }

      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb .kp-url-domain,
      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb .kp-url-title,
      .kpv2-top-sites-panel .kp-url-row.kp-has-page-thumb .kp-url-path {
        text-shadow: 0 1px 2px rgba(0,0,0,0.85);
      }

      ${getNctDarkUiScrollbarCss({ scopeSelector: '.kpv2-top-sites-panel' })}
    `;
    const shadowRoot = this._panel?.shadowRoot || null;
    const localCss = shadowRoot
      ? css
        .replace('.kpv2-top-sites-panel {', ':host {')
        .replaceAll('.kpv2-top-sites-panel ', '')
      : css;
    injectChromeStyles(shadowRoot || document, {
      attr: 'data-kp-top-sites-styles',
      css: localCss
    });
  }

  _ensureDom() {
    if (this._panel && this._tabList && this._grid) return;

    const doc = document;
    const panel = doc.createElement('div');
    panel.className = 'kpv2-top-sites-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Top Sites');
    panel.tabIndex = -1;
    const shadowRoot = ensureOpenChromeShadow(panel, { id: 'top-sites' });
    const shell = shadowRoot || panel;

    const tabstrip = doc.createElement('div');
    tabstrip.className = 'kpv2-ts-tabstrip';
    tabstrip.setAttribute('role', 'tablist');
    tabstrip.setAttribute('aria-label', 'Top Sites lists');

    for (const tab of TABS) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'kpv2-ts-tab';
      btn.id = `kp-ts-tab-${tab.id}`;
      btn.setAttribute('role', 'tab');
      btn.dataset.tabId = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this._selectTab(tab.id);
      }, true);
      tabstrip.appendChild(btn);
    }

    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kpv2-ts-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
    }, true);
    tabstrip.appendChild(closeBtn);

    const body = doc.createElement('div');
    body.className = 'kpv2-ts-body';

    const status = doc.createElement('div');
    status.className = 'kpv2-ts-status';
    status.textContent = '';

    const grid = createUrlListingContainer({
      doc,
      view: 'grid',
      useInlineStyles: false,
      className: `kpv2-ts-grid ${NCT_DARK_UI_SCROLLBAR_CLASS}`,
      scrollY: true
    });
    grid.setAttribute('role', 'tabpanel');
    grid.id = 'kp-ts-panel';

    body.appendChild(status);
    body.appendChild(grid);
    shell.appendChild(tabstrip);
    shell.appendChild(body);

    this._panel = panel;
    this._tabList = tabstrip;
    this._grid = grid;
    this._status = status;
  }

  _syncTabButtons() {
    if (!this._tabList) return;
    const buttons = this._tabList.querySelectorAll('.kpv2-ts-tab');
    buttons.forEach((btn) => {
      const selected = btn.dataset.tabId === this._tab;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.tabIndex = selected ? 0 : -1;
    });
    if (this._grid) {
      this._grid.setAttribute('aria-labelledby', `kp-ts-tab-${this._tab}`);
    }
  }

  /**
   * @param {TopSitesTabId} tabId
   */
  async _selectTab(tabId) {
    if (!TABS.some((t) => t.id === tabId)) return;
    this._tab = tabId;
    this._selectedIndex = 0;
    this._syncTabButtons();
    void this._persistTabState();
    await this._loadAndRender(this._openGen);
  }

  /** @param {number} dir */
  _cycleTab(dir) {
    const idx = TABS.findIndex((t) => t.id === this._tab);
    const next = TABS[(idx + dir + TABS.length) % TABS.length];
    if (next) void this._selectTab(next.id);
  }

  /**
   * @param {KeyboardEvent} e
   */
  _eventInTabList(e) {
    const t = e.target;
    if (!(t instanceof Element) || !this._tabList) return false;
    return this._tabList.contains(t) || t.classList?.contains?.('kpv2-ts-tab');
  }

  _gridColumnCount() {
    const grid = this._grid;
    if (!grid) return 4;
    try {
      const style = getComputedStyle(grid);
      const cols = style.gridTemplateColumns;
      if (cols && cols !== 'none') return Math.max(1, cols.split(' ').length);
    } catch { /* ignore */ }
    return 4;
  }

  /** @param {number} delta */
  _moveSelection(delta) {
    if (!this._items.length) return;
    this._setSelectedIndex(this._selectedIndex + delta);
  }

  /** @param {number} index */
  _setSelectedIndex(index) {
    if (!this._items.length) {
      this._selectedIndex = 0;
      return;
    }
    const max = this._items.length - 1;
    this._selectedIndex = Math.max(0, Math.min(max, index));
    this._paintSelection();
    const row = this._grid?.querySelector?.(
      `.kp-url-row[data-kp-url-listing-index="${this._selectedIndex}"]`
    );
    try { row?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch { /* ignore */ }
  }

  _paintSelection() {
    if (!this._grid) return;
    const rows = this._grid.querySelectorAll('.kp-url-row');
    rows.forEach((row) => {
      const idx = Number(row.dataset.kpUrlListingIndex);
      row.classList.toggle('kp-url-row--selected', idx === this._selectedIndex);
    });
  }

  async _loadAndRender(gen) {
    if (!this._stillOpen(gen) || !this._grid || !this._status) return;
    this._status.textContent = 'Loading…';
    this._grid.textContent = '';
    this._items = [];

    let items = [];
    try {
      items = await this._fetchItems(this._tab);
    } catch {
      items = [];
    }
    if (!this._stillOpen(gen)) return;

    this._items = items;
    this._selectedIndex = 0;
    this._status.textContent = items.length
      ? `${items.length} site${items.length === 1 ? '' : 's'}`
      : '';
    this._renderGrid(items);
  }

  /**
   * @param {TopSitesTabId} tabId
   * @returns {Promise<Array<{title?: string, url?: string}>>}
   */
  async _fetchItems(tabId) {
    if (tabId === 'toolbar') {
      const response = await chrome.runtime.sendMessage({ type: MSG.GET_BOOKMARKS });
      const bookmarks = Array.isArray(response?.bookmarks) ? response.bookmarks : [];
      return this._usableSites(bookmarks.filter((b) =>
        !!(b?.url && (b.isToolbar === true || b.parentId === '1'))
      ));
    }
    if (tabId === 'mostVisited') {
      const response = await chrome.runtime.sendMessage({ type: MSG.GET_MOST_VISITED });
      return this._usableSites(Array.isArray(response?.sites) ? response.sites : []);
    }
    const response = await chrome.runtime.sendMessage({
      type: MSG.GET_RECENT_BOOKMARKS,
      maxResults: 24
    });
    return this._usableSites(Array.isArray(response?.bookmarks) ? response.bookmarks : []);
  }

  /**
   * @param {Array<{title?: string, url?: string}>} items
   * @returns {Array<{title?: string, url?: string}>}
   */
  _usableSites(items) {
    return (Array.isArray(items) ? items : []).filter((item) =>
      /^https?:/i.test(String(item?.url || ''))
    );
  }

  /**
   * @param {Array<{title?: string, url?: string}>} items
   */
  _renderGrid(items) {
    if (!this._grid) return;
    const emptyText = EMPTY_COPY[this._tab] || 'Nothing to show.';
    if (!items.length) {
      this._grid.textContent = '';
      const empty = (this._grid.ownerDocument || document).createElement('div');
      empty.className = 'kpv2-ts-empty';
      empty.textContent = emptyText;
      this._grid.appendChild(empty);
      return;
    }

    renderUrlListing({
      container: this._grid,
      items,
      view: 'grid',
      useInlineStyles: false,
      classNames: CARD_CLASS_NAMES,
      rowTag: 'a',
      getTitle: (it) => it.title || it.url,
      getUrl: (it) => String(it.url || ''),
      showFavicon: true,
      showMetaLine: true,
      showUrlLine: true,
      selectedIndex: this._selectedIndex,
      onRowClick: ({ item, event }) => {
        event.preventDefault();
        event.stopPropagation();
        void this._openUrl(item.url);
      },
      decorateRow: ({ row, item, idx, parts }) => {
        row.setAttribute('role', 'link');
        renderCardText({ item, parts });
        attachPageThumb(row, item.url);
        if (idx === this._selectedIndex) {
          row.classList.add('kp-url-row--selected');
        }
      }
    });
  }

  /**
   * @param {string} url
   */
  async _openUrl(url) {
    const href = String(url || '').trim();
    if (!href) return;
    this.hide();
    try {
      await chrome.runtime.sendMessage({ type: MSG.NAVIGATE_SAME_TAB, url: href });
    } catch {
      try { window.location.assign(href); } catch { /* ignore */ }
    }
  }
}
